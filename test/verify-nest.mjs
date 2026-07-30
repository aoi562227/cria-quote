// ══════════════════════════════════════════════════════════════════
//  verify-nest.mjs — NFP 배치 엔진 검증
// ══════════════════════════════════════════════════════════════════
//  검증 철학: NFP 결과를 NFP 로 확인하면 아무 의미가 없다.
//  그래서 **격자 샘플링으로 겹침 면적을 직접 재는 독립 검사기**를 만들어
//  그것으로 판정한다. 해석해가 있는 단순 도형(직사각형·L·T)은 손검산과 대조한다.
// ══════════════════════════════════════════════════════════════════
import {
  canonicalize, hull, minkowski, strictlyInside, lineInsideInterval,
  firstFree, preparePart, overlaps, solveLayout, verifyNoOverlap, bboxOf, rot90,
} from "../src/nest.mjs";

let pass = 0, fail = 0;
const ok  = (c, m) => { if (c) { pass++; console.log(`  ✓ ${m}`); } else { fail++; console.log(`  ✗ ${m}`); } };
const near = (a, b, t = 0.02) => Math.abs(a - b) <= t;

// ══ 독립 겹침 검사기 (NFP 를 쓰지 않는다) ══════════════════════════
const inTri = (p, a, b, c) => {
  const d = (u, v, w) => (v[0]-u[0])*(w[1]-u[1]) - (v[1]-u[1])*(w[0]-u[0]);
  const s1 = d(a,b,p), s2 = d(b,c,p), s3 = d(c,a,p);
  return (s1>=0 && s2>=0 && s3>=0) || (s1<=0 && s2<=0 && s3<=0);
};
/** 볼록 폴리곤 내부(경계 포함) 점 판정 — 팬 삼각분할 */
const inConvex = (p, poly) => {
  for (let i = 1; i + 1 < poly.length; i++) if (inTri(p, poly[0], poly[i], poly[i+1])) return true;
  return false;
};
const inPieces = (p, pieces) => pieces.some(q => inConvex(p, q));

/**
 * 격자 샘플링으로 두 조각집합의 겹침 면적을 수치적으로 측정한다.
 * step 을 작게 하면 참값에 수렴한다. 경계 접촉은 면적 0 이므로 검출되지 않는다 —
 * 즉 "닿음은 통과, 겹침은 검출" 이라는 우리 시맨틱과 정확히 일치한다.
 */
function overlapAreaSampled(A, B, step = 0.4) {
  const ba = bboxOf(A), bb = bboxOf(B);
  const x0 = Math.max(ba.x0, bb.x0), x1 = Math.min(ba.x1, bb.x1);
  const y0 = Math.max(ba.y0, bb.y0), y1 = Math.min(ba.y1, bb.y1);
  if (x1 <= x0 || y1 <= y0) return 0;
  let n = 0;
  for (let x = x0 + step / 2; x < x1; x += step)
    for (let y = y0 + step / 2; y < y1; y += step)
      if (inPieces([x, y], A) && inPieces([x, y], B)) n++;
  return n * step * step;
}

const shiftP = (pieces, dx, dy) => pieces.map(p => p.map(([x, y]) => [x + dx, y + dy]));

// ══ 전개도 조각 생성 (App.jsx BoxNet 기하 미러) ════════════════════
function getFlaps(W, D, H, t) {
  const dust = 0.43 * D + 7;
  if (t === "tuck_both") { const L = Math.round(0.03 * D + 10.6);
    return { type:"tuck", topLid:L, dust, botLid:L, botDust:dust }; }
  if (t === "cross")     return { type:"cross", topLid:0.08*D+9, dust, botLong:0.7*D, botShort:0.4*D+6 };
  if (t === "glue_3side")return { type:"glue3", topLid:0.88*D+0.09*W+20.6, dust:D/2-1,
                                  botLong:0.33*D+0.15*W+11.0, botShort:D/2 };
  return null;
}
function calcNet(W, D, H, t) {
  const netW = 2*(W+D) + 14.3;
  let topLid, botFloor;
  if (t === "tuck_both") { topLid = D + 16.5; botFloor = D + 16.5; }
  else if (t === "cross") { topLid = D*7/8 + 5.5; botFloor = D*7/8 + 5.5; }
  else { topLid = 0.88*D + 0.09*W + 20.6; botFloor = 0.33*D + 0.15*W + 11.0; }
  return { netW, netH: H + topLid + botFloor, topLid, botFloor };
}
/** BoxNet 과 동일한 볼록조각 4종 */
function dielinePieces(W, D, H, type) {
  const ns = calcNet(W, D, H, type), f = getFlaps(W, D, H, type);
  const bodyY0 = ns.topLid, bodyY1 = ns.topLid + H;
  const xE = [0, D, D+W, 2*D+W, 2*D+2*W, ns.netW];
  let topH, botH;
  if (f && f.type === "tuck") { topH = [f.dust, f.topLid, f.dust, 0]; botH = [f.botDust, 0, f.botDust, f.botLid]; }
  else if (f)                 { topH = [f.dust, f.topLid, f.dust, 0]; botH = [f.botShort, f.botLong, f.botShort, f.botLong]; }
  else                        { topH = [ns.topLid,ns.topLid,ns.topLid,ns.topLid]; botH = [ns.botFloor,ns.botFloor,ns.botFloor,ns.botFloor]; }
  const bigFlap = Math.max(ns.topLid, ns.botFloor, 1);
  const cham = (fh, pw) => fh <= 0 ? 0
    : (fh >= bigFlap*0.6 ? Math.min(2.5, pw*0.06, fh*0.3) : Math.min(pw*0.22, fh*0.45, 10));
  const out = [];
  for (let i = 0; i < 5; i++) {
    const x0 = xE[i], x1 = xE[i+1], pw = x1 - x0;
    if (pw <= 0) continue;
    if (i === 4) { const tc = Math.min(pw*0.55, H*0.12, 8);
      out.push([[x0,bodyY0],[x1,bodyY0+tc],[x1,bodyY1-tc],[x0,bodyY1]]); continue; }
    out.push([[x0,bodyY0],[x1,bodyY0],[x1,bodyY1],[x0,bodyY1]]);
    const tH = topH[i] ?? 0, bH = botH[i] ?? 0;
    if (tH > 0) { const c = cham(tH, pw), yT = bodyY0 - tH;
      out.push([[x0,bodyY0],[x0+c,yT],[x1-c,yT],[x1,bodyY0]]); }
    if (bH > 0) { const c = cham(bH, pw), yB = bodyY1 + bH;
      out.push([[x0,bodyY1],[x0+c,yB],[x1-c,yB],[x1,bodyY1]]); }
  }
  return { pieces: out, net: ns };
}

// ══════════════════════════════════════════════════════════════════
console.log("\n════ 1. 기하 프리미티브 (해석해 대조) ════");

const SQ = [[0,0],[1,0],[1,1],[0,1]];
{ const m = minkowski(SQ, SQ, +1), b = bboxOf([m]);
  ok(near(b.w,2) && near(b.h,2), `단위정사각형 ⊕ 자신 = 2×2  (실측 ${b.w}×${b.h})`); }
{ const m = minkowski(SQ, SQ, -1), b = bboxOf([m]);
  ok(near(b.w,2) && near(b.h,2) && near(b.x0,-1) && near(b.y0,-1),
     `단위정사각형 ⊖ 자신 = 원점중심 2×2  (x0=${b.x0} y0=${b.y0})`); }

const R = (w,h) => [[0,0],[w,0],[w,h],[0,h]];
{ // 직사각형 40×25: NFP(R,R) 는 원점중심 80×50 → 최소 dx=40, dy=25
  const p = preparePart([R(40,25)]);
  ok(!overlaps(p,[40,0],true)  && overlaps(p,[39.9,0],true),  "직사각형 40×25 최소 열피치 = 40 (경계 통과·내부 차단)");
  ok(!overlaps(p,[0,25],true)  && overlaps(p,[0,24.9],true),  "직사각형 40×25 최소 행피치 = 25");
  ok(overlaps(p,[0,0],true), "t=0 은 항상 겹침 (자기쌍 NFP 는 원점을 내부에 포함)"); }

{ const N = minkowski(SQ, SQ, -1);
  ok(!strictlyInside(N,[1,0]) && !strictlyInside(N,[1,1]), "경계점은 strictlyInside=false (닿음 허용)");
  ok(strictlyInside(N,[0,0]) && strictlyInside(N,[0.99,0]), "내부점은 true"); }

{ const N = minkowski(SQ, SQ, -1);
  const iv = lineInsideInterval(N, [0,0], [1,0]);
  ok(iv && near(iv[0],-1) && near(iv[1],1), `반사선 +x 내부구간 = (−1,1)  (실측 ${iv && iv.map(v=>v.toFixed(2))})`);
  ok(lineInsideInterval(N, [0,5], [1,0]) === null, "NFP 밖을 지나는 직선은 교차 없음(null)"); }

{ ok(near(firstFree([[-1,1]],0),1), "firstFree((−1,1),0) = 1");
  ok(near(firstFree([[-5,20],[30,35]],0),20), "firstFree — 자유집합이 상집합이 아님: (−5,20)∪(30,35) → 20 (32 는 다시 충돌)");
  ok(near(firstFree([[-5,20],[30,35]],31),35), "firstFree — 두번째 구간 안에서 시작하면 35 로 밀림");
  ok(near(firstFree([[-5,20],[19,35]],0),35), "firstFree — 연쇄 구간은 끝까지 밀림 → 35");
  ok(near(firstFree([[-5,20]],0),20) && near(firstFree([[0,20]],0),0), "구간 경계에서 시작하면 그대로 자유 (닿음 허용 시맨틱)"); }

{ ok(canonicalize([[0,0],[1,0],[2,0]]) === null, "공선 3점(면적 0) 조각은 제거");
  ok(canonicalize([[0,0],[1,0],[1,0],[1,1],[0,1]]).length === 4, "중복 정점 제거");
  const cw = canonicalize([[0,0],[0,1],[1,1],[1,0]]);
  ok(cw && area2(cw) > 0, "CW 입력을 CCW 로 정규화");
  function area2(p){let s=0;for(let i=0;i<p.length;i++){const[a,b]=p[i],[c,d]=p[(i+1)%p.length];s+=a*d-c*b;}return s;} }

console.log("\n════ 2. L자 맞물림 (독립 샘플링 대조) ════");
{
  // L자: 60×40 에서 우상단 30×20 을 뺀 형태 → 볼록 2조각으로 표현
  const L = [ [[0,0],[60,0],[60,20],[0,20]], [[0,20],[30,20],[30,40],[0,40]] ];
  const p = preparePart(L);
  // 180° 반전한 L 은 서로 끼워져 dy < 40 가능해야 한다
  const found = [];
  for (let dy = 40; dy >= 15; dy -= 0.5) if (!overlaps(p,[0,dy],false)) found.push(dy);
  const minDyFlip = Math.min(...found);
  const minDySame = (() => { for (let dy=40; dy>=1; dy-=0.5) if (overlaps(p,[0,dy],true)) return dy+0.5; return 0; })();
  ok(minDyFlip < minDySame - 0.4, `L자: 반전 최소행피치 ${minDyFlip} < 같은방향 ${minDySame} (반전이 유리)`);
  ok(near(minDyFlip, 20, 0.6), `L자 반전 최소행피치 = 20 (손검산: 두 L 이 20 높이 띠로 맞물림) — 실측 ${minDyFlip}`);

  // 독립 검사: 그 피치에서 실제 겹침 면적 0
  const A = p.pieces, B = shiftP(p.flipped, 0, minDyFlip);
  ok(overlapAreaSampled(A,B,0.25) < 0.5, `L자 반전 dy=${minDyFlip} 겹침면적 ≈ 0 (샘플링 독립확인)`);
  const Bbad = shiftP(p.flipped, 0, minDyFlip - 2);
  ok(overlapAreaSampled(A,Bbad,0.25) > 1, `L자 dy=${minDyFlip-2} 는 실제로 겹침 (검사기가 작동함을 증명)`);
}

console.log("\n════ 3. 실제 전개도 — 겹침 0 완전검증 ════");
const CASES = [
  ["삼면접착 130×130×55", 130,130,55, "glue_3side", 788,545],
  ["삼면E 90×70×130",      90, 70,130, "glue_3side", 394,545],
  ["맞뚜껑A 92×13×140",    92, 13,140, "tuck_both",  636,469],
  ["십자B 70×70×55",       70, 70, 55, "cross",      444,597],
];
for (const [nm,W,D,H,t,sw,sh] of CASES) {
  const { pieces, net } = dielinePieces(W,D,H,t);
  // 물림(gripper): 짧은변 −30 / 긴변 −20
  const long = Math.max(sw,sh), short = Math.min(sw,sh);
  const pw = long - 20, ph = short - 30;
  const r = solveLayout(pieces, pw, ph, { clearance: 0.5 });
  if (!r) { ok(false, `${nm} — 해 없음`); continue; }
  console.log(`  · ${nm}  전개도 ${net.netW.toFixed(1)}×${net.netH.toFixed(1)}  인쇄영역 ${pw}×${ph}`);
  console.log(`      → ${r.up}up (${r.cols}열×${r.rows}행) dx=${r.dx.toFixed(2)} dy=${r.dy.toFixed(2)} ` +
              `${r.rotated?"회전 ":""}${r.flipRule}${r.sx?" 엇갈림":""}  겹침 x${r.overlapX.toFixed(1)} y${r.overlapY.toFixed(1)}`);
  // 완전검증 재확인
  const v = verifyNoOverlap(r.part, r.cells, (i,j)=>r.cells.find(c=>c.i===i&&c.j===j)?.flip ?? false);
  ok(v.ok, `${nm} — 전 셀쌍 NFP 완전검증 겹침 0`);
  // 독립 샘플링 검증: 모든 셀쌍 실측
  let worst = 0, worstPair = null;
  for (let a=0;a<r.cells.length;a++) for (let b=a+1;b<r.cells.length;b++) {
    const A = r.cells[a], B = r.cells[b];
    if (Math.abs(B.x-A.x) >= r.netW || Math.abs(B.y-A.y) >= r.netH) continue;
    const PA = shiftP(A.flip ? r.part.flipped : r.part.pieces, A.x, A.y);
    const PB = shiftP(B.flip ? r.part.flipped : r.part.pieces, B.x, B.y);
    const ar = overlapAreaSampled(PA, PB, 0.5);
    if (ar > worst) { worst = ar; worstPair = [A,B]; }
  }
  ok(worst < 2, `${nm} — 독립 샘플링 최대 겹침면적 ${worst.toFixed(2)}mm² ≈ 0` +
     (worstPair && worst>=2 ? ` (셀 ${worstPair[0].i},${worstPair[0].j} ↔ ${worstPair[1].i},${worstPair[1].j})` : ""));
  // bbox 가 인쇄영역 안
  ok(r.bbox.w <= pw + 0.01 && r.bbox.h <= ph + 0.01,
     `${nm} — 배치 bbox ${r.bbox.w.toFixed(1)}×${r.bbox.h.toFixed(1)} ≤ 인쇄영역`);
}

console.log("\n════ 4. 퇴화·수치 케이스 ════");
{ ok(solveLayout([], 500, 400) === null, "빈 조각 → null");
  ok(solveLayout([[[0,0],[1,0],[2,0]]], 500, 400) === null, "면적 0 조각만 → null");
  const big = solveLayout([R(2000,50)], 500, 400);
  ok(big === null, "부품이 인쇄영역보다 큼 → null (회전해도 안 들어감)");
  const fit = solveLayout([R(300,50)], 500, 400);
  ok(fit && fit.up === Math.floor(500/300)*Math.floor(400/50) ||
     (fit && fit.up >= 8), `300×50 을 500×400 에 → ${fit?.up}up (회전 배치 포함 최적)`);
  const thin = solveLayout([R(0.5,300)], 500, 400, { maxUp: 2000 });
  ok(thin && thin.up === 1000 && near(thin.dx,0.5), `극단 비율 0.5×300 → ${thin?.up}up dx=${thin?.dx} (해석해 1000up)`);
  const capped = solveLayout([R(0.5,300)], 500, 400, { maxUp: 50 });
  ok(capped && capped.up <= 50, `maxUp=50 클램프 작동 → ${capped?.up}up (조용히 null 반환하지 않음)`);
}
{ // 반전쌍 NFP 비대칭성: 중심대칭이 아닌 도형에서 N_op ≠ −N_op
  const Lp = preparePart([ [[0,0],[60,0],[60,20],[0,20]], [[0,20],[30,20],[30,40],[0,40]] ]);
  let asym = false;
  for (const t of [[10,10],[20,5],[5,25],[15,18]])
    if (overlaps(Lp,t,false) !== overlaps(Lp,[-t[0],-t[1]],false)) asym = true;
  ok(asym, "N_op ≠ −N_op 확인 (비중심대칭 도형에서 반전쌍 NFP 는 비대칭 — 이걸 대칭이라 가정하면 버그)");
  // 자기쌍은 반드시 원점대칭
  let sym = true;
  for (const t of [[10,10],[20,5],[5,25],[33,7]])
    if (overlaps(Lp,t,true) !== overlaps(Lp,[-t[0],-t[1]],true)) sym = false;
  ok(sym, "N_same 는 원점대칭 (t ∈ N ⟺ −t ∈ N)");
}

console.log("\n════ 5. 종전 상수 근사가 기하 위반이었음을 증명 ════");
{
  const { pieces, net } = dielinePieces(130,130,55,"glue_3side");
  const p = preparePart(pieces);
  // 종전 코드: IL_W = 10mm → dx = netW − 10
  const dxOld = net.netW - 10;
  const violated = overlaps(p, [dxOld, 0], true);
  ok(violated, `IL_W=10mm (dx=${dxOld.toFixed(1)}) 는 같은방향 이웃과 실제로 겹침 — 종전 근사는 기하 위반`);
  const A = p.pieces, B = shiftP(p.pieces, dxOld, 0);
  const ar = overlapAreaSampled(A, B, 0.5);
  ok(ar > 10, `독립 샘플링으로도 겹침 확인: ${ar.toFixed(0)}mm² (칼선이 서로를 지나감)`);
  // 종전 코드: IL_H = botFloor → dy = netH − botFloor
  const dyOld = net.netH - net.botFloor;
  ok(overlaps(p, [0, dyOld], false),
     `IL_H=바닥날개(${net.botFloor.toFixed(1)}mm, dy=${dyOld.toFixed(1)}) 도 반전 이웃과 겹침`);
  // 실제 허용 최대 겹침
  let maxOv = 0;
  for (let dy = net.netH; dy >= 1; dy -= 0.1) { if (overlaps(p,[0,dy],false)) break; maxOv = net.netH - dy; }
  console.log(`      실제 허용 최대 행겹침(반전) = ${maxOv.toFixed(1)}mm  (종전 코드가 쓴 값 ${net.botFloor.toFixed(1)}mm)`);
}

console.log(`\n════ 결과: ${pass} 통과 / ${fail} 실패 ════\n`);
if (fail) process.exitCode = 1;

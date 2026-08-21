// ══════════════════════════════════════════════════════════════════
//  이 파일은 src/domain/dieline/{index,geometry}.mjs · src/domain/quote.mjs ·
//  src/domain/imposition.mjs 를 **직접 import** 한다.
//
//  구조별 전개도 공식 검증 — 견적용 칼선/디자인 PDF 실측 (규격 확인분)
//  접는선 좌표를 전수 추출해 패널 치수를 역산하고, 발주 규격과 대조.
//
//  종전에는 netW·netH 공식과 판걸이 모델(IL_W=10 상수 감산)을 이 파일이 복제했다.
//  그래서 앱이 nest 엔진으로 갈아탄 뒤에도 여기는 옛 모델을 계속 채점했다.
// ══════════════════════════════════════════════════════════════════
import { calcNetSize } from "../src/domain/dieline/index.mjs";
import { GLUE_TAB, xEdges } from "../src/domain/dieline/geometry.mjs";
import { buildDieline } from "../src/domain/quote.mjs";
import { solveImposition } from "../src/domain/imposition.mjs";
import { BASE_SHEETS } from "../src/domain/data/sheets.mjs";

const ID  = { glue3:"glue_3side", cross:"cross", tuck:"tuck_both" };
const NW  = (W,D) => calcNetSize(W,D,1,ID.glue3).netW;          // 구조 무관 (2(W+D)+GLUE_TAB)
const NH  = (k,W,D,H) => calcNetSize(W,D,H,ID[k]).netH;

// 폐기된 공식 기록 — App/domain 에 원본이 없다. 지우면 "왜 이 공식이 아닌가" 를 잃는다.
// ※ cross 는 현행 공식과 **같다** (십자조립은 한 번도 안 바뀌었다).
//   중복처럼 보여도 지우지 마라 — 「종전 Δ」 열이 비면 세 구조를 나란히 못 읽는다.
const OLD = {
  glue3: (W,D,H) => H + Math.round(D*0.059+12.65) + (D*0.65+4),
  cross: (W,D,H) => H + 2*(D*7/8 + 5.5),
  tuck:  (W,D,H) => H + (D<=15 ? D/2+50 : D/2+20) + (D<=15 ? D/2+55 : D/2+15),
};
const LBL = { glue3:"삼면접착 (자동바닥)", cross:"십자조립 (크로스바텀)", tuck:"맞뚜껑 (상하 텍)" };

// [구조, 이름, W, D, H, 실측 가로, 실측 세로]
const DIE = [
  ["glue3","칼선-09 240704",    41.46, 42,    116,   181.0, 202.0],
  ["glue3","칼선-10 240704",    49,    49.5,  143,   212.0, 243.5],
  ["glue3","칼선-01 240502",     45,    33.75, 109.5, 174.4, 193.2],
  ["glue3","칼선-02 240508",   71,    69.5,  175.5, 298.3, 307.0],
  ["glue3","칼선-03 240508",  100,    81,     50,   374.5, 206.0],
  ["glue3","칼선-04 240520",    265.5, 124,    243,   803.0, 490.0],
  ["glue3","★삼면E 250430",  90,    70,    130,   334.3, 265.0],
  ["glue3","★칼선-06 260311",  50,    50,    150,   214.3, 263.0],
  ["glue3","칼선-05 251119",     47,    47,    100,   202.3, 219.1],
  ["cross","칼선-13 240821", 80,    20,     48.5, 211.33, 95.0],
  ["cross","칼선-14 240717", 80,    44.5,   30,   264.3, 124.5],
  ["cross","칼선-11 240808",     70,    69,    151.5, 303.33,285.0],
  ["cross","칼선-12 240805",  190,   100,    109.5, 594.0, 298.7],
  ["tuck","칼선-07 240701",    150,    69.5,  149,   454.3, 321.0],
  ["tuck","칼선-08 240701",   150,    69.5,  219,   454.3, 391.0],
];

for (const k of ["glue3","cross","tuck"]) {
  const rows = DIE.filter(d => d[0] === k);
  console.log(`\n═══ ${LBL[k]} — 칼선 ${rows.length}건 ══════════════════════════════════════`);
  console.log("칼선".padEnd(20)+"W×D×H".padEnd(20)+"가로실측".padEnd(10)+"공식".padEnd(9)+"Δ".padEnd(8)+
              "세로실측".padEnd(10)+"공식".padEnd(9)+"Δ".padEnd(8)+"종전 Δ");
  console.log("-".repeat(104));
  let ew=0, eh=0, eo=0;
  for (const [,nm,W,D,H,gw,gh] of rows) {
    const a = NW(W,D), b = NH(k,W,D,H), o = OLD[k](W,D,H);
    ew += Math.abs(a-gw); eh += Math.abs(b-gh); eo += Math.abs(o-gh);
    console.log(nm.padEnd(20)+`${W}×${D}×${H}`.padEnd(20)+gw.toFixed(1).padEnd(10)+a.toFixed(1).padEnd(9)+
      (a-gw).toFixed(1).padEnd(8)+gh.toFixed(1).padEnd(10)+b.toFixed(1).padEnd(9)+
      (b-gh).toFixed(1).padEnd(8)+(o-gh).toFixed(1));
  }
  console.log("-".repeat(104));
  console.log(`평균절대오차:  가로 ${(ew/rows.length).toFixed(1)}mm   세로 ${(eh/rows.length).toFixed(1)}mm` +
              `   (종전 세로 ${(eo/rows.length).toFixed(1)}mm)`);
}
console.log(`
※ 삼면접착 세로 9건의 평균오차는 종전 회귀식(0.88D+0.09W+20.6 / 0.33D+0.15W+11)보다
  나빠 보인다. 그 회귀식은 이 9건의 bbox 에 맞춰 적합한 것이고, 실제로는 없는
  W 의존성이 들어가 있었다. 현행 공식은 칼선 **벡터 실측 3건**(웨이크버니 A·B ·
  소스코 — 위/아래 띠를 분리 측정)으로 세웠다. 근거의 강도가 다르다.`);

// ── 패널 x 경계 — 바이오머 맞뚜껑 150×15×150 벡터 실측 (오차 0.0mm) ──
{
  const ns = calcNetSize(150, 15, 150, ID.tuck);
  const got = xEdges(150, 15, ns.netW).map(v => +v.toFixed(1));
  const exp = [0, 15, 165, 180, 330, 344.3];
  const hit = got.every((v,i) => Math.abs(v - exp[i]) <= 0.05);
  console.log(`\n═══ 패널 x 경계 (바이오머 150×15×150 실측) ═══════════════════════════════`);
  console.log(`  ${hit?"✓":"✗"} xEdges ${got.join(", ")}   기대 ${exp.join(", ")}   (접착날개 ${GLUE_TAB})`);
  if (!hit) process.exitCode = 1;
}

console.log("\n═══ 견적서 판걸이 up 재현 — 실코드(solveImposition) ══════════════════════");
// buildDieline → solveImposition 이 앱이 실제로 타는 경로다.
// nest 엔진 + 발자국 92% 컷 + FIT_TOL 전부 그대로 적용된다(물림은 빼지 않는다).
// ★ 이 숫자가 **프로젝트 대표 판걸이 점수**다. scorecard2 는 printableArea 를
//   건너뛰므로(solveLayout 직접 호출) 앱 점수가 아니다 — 요약에 쓰지 마라.
const S = id => BASE_SHEETS.find(s => s.id === id);
const Q=[
 ["tuck","맞뚜껑A 92×13×140",   92,13,140,"guk2",6], ["tuck","맞뚜껑B 150×20×150",150,20,150,"4x62",2],
 ["glue3","삼면A 120×55×180",120,55,180,"ha4",2],  ["glue3","삼면B 210×90×180",210,90,180,"46",3],
 ["glue3","삼면C 52×50×90",       52,50,90,"4x64",4],  ["glue3","★삼면E 90×70×130",90,70,130,"4x64",2],
 ["glue3","삼면F 90×90×250",    90,90,250,"4x62",2], ["glue3","삼면D 82×7×126",82,7,126,"4x64",2],
 ["cross","십자A 47×47×176",        47,47,176,"4x62",6], ["cross","십자B 70×70×55",70,70,55,"ha4",4],
];
console.log("견적서 건".padEnd(24)+"판형".padEnd(7)+"전개도".padEnd(16)+"up".padEnd(6)+"배치".padEnd(9)+"발자국".padEnd(9)+"견적서");
console.log("-".repeat(92));
let n=0;
for(const [k,nm,W,D,H,sid,real] of Q){
  const dl = buildDieline({ mode:"box", structure:ID[k], W, D, H, hangTab:0 });
  const L  = solveImposition({ dieline: dl, sheet: S(sid), hangTab:0 });
  if(L.up===real)n++;
  const how = `${L.cols}×${L.rows}${L.rotated?"↺":""}${L.interlocked?"⇅":""}`;
  console.log(nm.padEnd(24)+sid.padEnd(7)+
    `${dl.net.netW.toFixed(0)}×${dl.net.netH.toFixed(0)}`.padEnd(16)+
    (L.up+(L.up===real?"✓":"")).padEnd(6)+how.padEnd(9)+(L.footPct+"%").padEnd(9)+real);
}
console.log("-".repeat(92));
console.log(`up 일치: ${n}/${Q.length}`);
console.log(`
※ 이력: 종전 이 표는 IL_W=10 상수 감산 모델을 복제해서 8/10 을 냈고(근거 없음 —
  verify-nest §5 가 기하 위반으로 반증), 엔진을 nest 로 갈면서 1/10 로 떨어졌다가
  물림 이중 차감을 제거하고 ${n}/10 이 됐다. A/B 는 test/scorecard-unit.mjs.
※ 남은 불일치 3건은 전부 **목형 설계 요인**이다 — 물림·엔진 문제가 아니다:
  · 삼면D 82×7×126 (6up vs 2up) — D=7 은 전개도 공식 검증범위(D≥13) 밖.
    netH 가 실제보다 작게 나와 배치가 과다하다.
  · 맞뚜껑B 150×20×150 (4up vs 2up) — 500ea 소량. 기존 2up 목형을 그대로 쓴 건.
  · 삼면B 210×90×180 (2up vs 3up) — 46전지를 990×720 으로 클램프한 뒤 3열이
    안 들어간다. 견적서 「단위」는 980×720 이므로 폭은 맞는데 공식 netW 가 크다.
  세 건 모두 「판걸이(up) 직접 입력」으로 보정하는 것이 정답이다.`);

console.log("\n═══ 비폴리곤 구조(G형·G형트레이·전개도 직접입력) 회귀 게이트 ══════════════");
// 이 3구조는 polygon:false → imposition.solveRect 경로를 탄다. 종전에는 커버리지가
// **0** 이었다(scorecard2·verify-net·verify-interlock·scorecard-unit 케이스가 전부
// 폴리곤 구조). 그래서 구코드가 사각형에도 맞물림 감산(IL_W=10 / IL_H=25)을
// 걸고 있었다는 사실도, 그게 사라져 up 이 줄었다는 사실도 아무 테스트가 못 잡았다.
// 기하학적으로는 신 동작이 맞다 — 직사각형은 맞물림이 물리적으로 불가능하다.
//
// ※ 여기 숫자는 대부분 「현재 동작 고정」이고, ✓견적서 표시가 붙은 것만 실측이다.
{
  const N = [
    // [이름, box, 판형, 기대 up, 근거]
    ["슬리브 646×258 · 46전지", { mode:"net", netW:646, netH:258 }, "46",   3, "현재동작"],
    ["슬리브 646×258 · 4×64",   { mode:"net", netW:646, netH:258 }, "4x64", 0,
     "기하 불가(646 > 545) — 견적서 4×64 1up 은 「단위」가 표준 4절이 아니었을 것. up 직접입력으로 보정"],
    ["조립형 428×324 · 하3",    { mode:"net", netW:428, netH:324 }, "ha3",  2, "✓견적서 하3 2up"],
    ["G형 180×120×85 · 국전",   { mode:"box", structure:"gtype", W:180, D:120, H:85 }, "guk", 1, "현재동작"],
    ["G형 300×40×70 · 국2",     { mode:"box", structure:"gtype", W:300, D:40,  H:70 }, "guk2", 3,
     "D/H=0.57 ≤ 0.8 → noRotate 분기. 회전이 막혀야 3up"],
    ["G형트레이 350×280×70 · 46전지",
     { mode:"box", structure:"gtype_tray", W:350, D:280, H:70 }, "46", 1, "✓견적서 G형A 46전지 1up"],
  ];
  console.log("케이스".padEnd(32)+"전개도".padEnd(15)+"up".padEnd(6)+"기대".padEnd(6)+"회전".padEnd(7)+"근거");
  console.log("-".repeat(104));
  let nOk = 0;
  for (const [nm, box, sid, exp, why] of N) {
    const dl = buildDieline(box);
    const L  = solveImposition({ dieline: dl, sheet: S(sid), hangTab: 0 });
    const hit = L.up === exp;
    if (hit) nOk++;
    console.log(nm.padEnd(32)+`${dl.net.netW.toFixed(0)}×${dl.net.netH.toFixed(0)}`.padEnd(15)+
      String(L.up).padEnd(6)+String(exp).padEnd(6)+
      (dl.net.noRotate ? "금지" : (L.rotated ? "↺" : "-")).padEnd(7)+(hit?"":"✗ ")+why);
  }
  console.log("-".repeat(104));
  console.log(`비폴리곤 구조 up: ${nOk}/${N.length}`);
  // 회전금지가 실제로 걸리는지 — 플래그만 true 고 배치가 회전하면 무의미하다
  const nr = buildDieline({ mode:"box", structure:"gtype", W:300, D:40, H:70 });
  const nrL = solveImposition({ dieline: nr, sheet: S("guk2"), hangTab: 0 });
  const nrOk = nr.net.noRotate === true && nrL.rotated === false;
  console.log(`회전금지 실효: netSize.noRotate=${nr.net.noRotate} → layout.rotated=${nrL.rotated}  ${nrOk?"✓":"✗"}`);
  if (nOk !== N.length || !nrOk) process.exitCode = 1;
}

console.log("\n═══ 행거탭(유로홀) 모델링 ════════════════════════════════════════════════");
// 맞뚜껑A 92×13×140 은 위쪽에 다이소 걸이봉용 유로홀 탭 15mm 가 올라가 있음.
// 행거탭은 위쪽 한 곳만 돌출 → 옆 열 빈공간에 끼워짐
// → 열 간격(피치)에는 안 더하고 **전체 외곽에 1회만** 더해야 함.
// imposition.solveNest 가 축별로 나눠 부른 뒤 rotated 로 걸러내는 방식으로 이걸 구현한다.
{
  console.log("행거탭".padEnd(10)+"몸판 전개도".padEnd(16)+"up".padEnd(6)+"배치".padEnd(10)+"ht=0 과 동일?");
  console.log("-".repeat(70));
  let same = true, base = null;
  for (const ht of [0,15,20]) {
    const dl = buildDieline({ mode:"box", structure:"tuck_both", W:92, D:13, H:140, hangTab:ht });
    const L  = solveImposition({ dieline: dl, sheet: S("guk2"), hangTab: ht });
    if (base === null) base = L.up; else if (L.up !== base) same = false;
    console.log(`${ht}mm`.padEnd(10)+
      `${dl.net.netW.toFixed(1)}×${dl.net.netH.toFixed(1)}`.padEnd(16)+
      String(L.up).padEnd(6)+`${L.cols}×${L.rows}${L.rotated?"↺":""}`.padEnd(10)+
      (L.up===base?"✓":"✗"));
  }
  console.log(`\n행거탭 up 불변: ${same?"✓":"✗"}  (0/15/20mm 전 구간 ${base}up)`);
  console.log(`
→ 행거탭은 몸판 netH 에 들어가지 않는다(위 「몸판 전개도」가 세 행 모두 같다).
  imposition 이 인쇄영역에서 축별로 1회만 빼므로 열 간격(피치)이 늘지 않는다 —
  행거탭은 위쪽 한 곳만 돌출해 옆 열 빈공간에 끼워지기 때문이다.
  ※ netH 에 그냥 합산하는 모델은 열마다 15mm 를 더해 up 을 떨어뜨린다.
    앱은 그 모델을 쓰지 않으므로 비교 구현을 여기 복제해 두지 않는다.
  ※ 절대값도 견적서와 일치한다 (${base}up = 견적서 6up).`);
  if (!same) process.exitCode = 1;
}

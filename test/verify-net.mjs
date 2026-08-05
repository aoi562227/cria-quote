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
// nest 엔진 + 물림 20/30 + 발자국 92% 컷 + FIT_TOL 전부 그대로 적용된다.
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
※ 종전 이 표는 IL_W=10 상수 감산 모델을 복제해서 8/10 을 냈다. 그 모델은
  verify-nest §5 가 기하 위반(칼선이 서로를 지나감, 독립 샘플링 464mm²)으로
  증명했으므로 점수 자체가 근거가 없었다.
※ 현행 경로의 남은 불일치는 두 갈래다:
  ① 물림 방침 — 판을 견적서 「단위」(=이미 재단된 크기)로 줄 때는 물림을 빼면
     이중 차감이다. printableArea 는 아직 표준 판형·주문생산 구분 없이 무조건 뺀다.
     그 단독 변경 전후 비교는 test/scorecard-unit.mjs (A: 물림 0 / C: 물림 적용).
  ② 목형 설계 요인 — 삼면D(D=7, 공식 검증범위 밖) / 맞뚜껑B(500ea 소량,
     기존 2up 목형 추정). 「판걸이(up) 직접 입력」으로 보정한다.`);

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
  ※ 이 건의 절대값(${base}up vs 견적서 6up)은 위 표와 같은 물림 방침 문제다.
    행거탭 모델과는 무관하다.`);
  if (!same) process.exitCode = 1;
}

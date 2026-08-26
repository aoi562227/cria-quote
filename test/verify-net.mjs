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
// 목형별 구조 옵션 픽스쳐 — 네 스위트가 같은 표를 읽는다(복제 금지). 근거는 그 파일이 소유한다.
import { dieOptOf, dieSrcOf, dieNote, measuredOnly } from "./die-profiles.mjs";
import { solveImposition, printableArea } from "../src/domain/imposition.mjs";
// ⚠ solveLayout 직접 호출은 「표 밖 실측」 진단 한 곳에서만 쓴다 — 그 자리 주석 참조.
import { solveLayout } from "../src/nest.mjs";
import { BASE_SHEETS, MAX_FOOT_PCT } from "../src/domain/data/sheets.mjs";

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
  // ★ 26-08-16 라벨 정정: 칼선-14(240717 엔이이에이)는 십자조립이 아니라 **삼면접착**이다.
  //   90° 눕혀 그려진 도면을 다시 뜯으니 띠가 34.48(자동바닥) / 59.98(뚜껑) 로 갈린다 —
  //   자동바닥 비 0.775D 는 삼면접착군(0.76~0.83)이고 십자군은 0.70D 로 뭉쳐 있다.
  //   삼면접착식 s=35.0 · b=59.5 → netH 124.5 (Δ0.04) / 십자식은 118.9 (Δ5.6).
  //   cross.mjs 회귀에는 안 쓰였지만 이 표의 cross 세로 MAE 를 혼자 끌어올리고 있었다.
  //   ★★ 26-08-18 — 이 표본은 **날개 프로파일의 두 번째 반례**다. 원본을 획(op=S)만
  //     남기고 다시 재면 (몸통은 90° 눕은 도면의 pdf x 68.13~98.13 = H 30.00):
  //       아래 띠(뚜껑 60.00) [탭 0, W1 **60.0**, D1 30.0, W2 0.0, D2 30.0]
  //       위 띠(자동바닥 34.50) [탭 0, W1 34.5, D1 34.5, W2 34.5, D2 34.5]
  //     깊은 날개가 **탭에 붙은 W1** — 소스코와 같은 계열이다. 즉 「실측 3/4 · 반례 1건」이
  //     아니라 **3/5 · 반례 2건**이고, 그 둘째 표본을 들여온 것이 바로 이 라벨 정정이다.
  //     자기 커밋이 늘린 표본을 근거 집계에서 빼면 안 된다. 판정은 glue3.mjs flaps() 참조.
  //   ⚠ 실측 D 는 44.5 가 아니라 **45.00** 이다(패널 폭 93.66→138.66 = 45.00 ·
  //     마지막 패널 44.30 = D−0.7). 아래 44.5 는 발주 표기이고 netW 공식 263.3 vs 실측
  //     264.3 의 +1.0 이 정확히 그 차이다. 표기를 바꾸지 않는 이유는 이 표가
  //     「발주 표기로 공식을 돌렸을 때의 오차」를 재는 표라서다 — 목형 값으로 바꾸면
  //     오차가 0 이 되지만 실무 입력은 발주 표기로 들어온다.
  ["glue3","칼선-14 240717", 80,    44.5,   30,   264.3, 124.5],
  ["cross","칼선-13 240821", 80,    20,     48.5, 211.33, 95.0],
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
※ 삼면접착 세로 10건의 평균오차는 종전 회귀식(0.88D+0.09W+20.6 / 0.33D+0.15W+11)보다
  나빠 보인다. 그 회귀식은 이 10건의 bbox 에 맞춰 적합한 것이고, 실제로는 없는
  W 의존성이 들어가 있었다. 현행 공식은 칼선 **벡터 실측 5건**(웨이크버니 A·B ·
  소스코 · 도솔 · 칼선-14 — 위/아래 띠를 분리 측정)으로 세웠다. 근거의 강도가 다르다.
※ 이 표는 **bbox(netW×netH) 만** 채점한다. 날개 프로파일 교체는 총합을
  안 건드린 재분배(삼면접착·맞뚜껑)라 여기 숫자를 거의 안 움직인다 — 움직인 것은
  십자(위/아래 분리 실측으로 netH 가 바뀜)와 칼선-14 라벨 정정 두 가지다.
  패널별 날개 깊이가 맞는지는 bbox 로 알 수 없다.
  ⚠ up 재현으로도 다 안 드러난다 — 26-08-16 프로파일은 소스코형 목형에서 up 을 안
    바꾸면서(2up 그대로) 실물 겹침 5,033.8mm² 인 판을 냈다. 금액도 bbox 도 같으니
    이 표와 scorecard 전부가 통과했다. 그걸 잡는 게이트는
    **verify-imposition 「실측 프로파일 겹침 게이트」** 하나다.`);

// ── 패널 x 경계 — 세로 크리스 **직접** 실측 (26-08-16 재측정) ──────────────
// ★ 종전 이 블록은 「바이오머 150×15×150 실측 · 오차 0.0mm」라고 적혀 있었지만
//   실제로는 **실측이 아니라 현행 코드를 검산**하고 있었다. 기대값 [0,15,165,180,330,344.3]
//   (= 패널 폭 [15,150,15,150,14.3]) 은 종전 xEdges 의 출력 그 자체다.
//   하필 바이오머는 D=15 = 탭 폭 15.0 이라 참·거짓 두 프레임이 **같은 값들의 순열**이
//   되어 오차 0.0mm 로 보였다. D≠15 인 표본이면 즉시 드러난다.
// 크리스를 가정 없이 직접 재면(세로 선분 길이 누적, 길이 ≥ 0.6H) 6/6 경계 잔차 0.00mm 로
//   패널 폭이 [D−0.70, W, D, W, **15.00**] 이다 — 탭은 15.0 이고 0.70 은 탭이 붙는
//   D 패널의 부족분이다(GLUE_TAB=14.3 은 탭 폭이 아니다).
// 그래서 이 게이트는 **D≠탭폭 인 표본으로 채점한다.** 바이오머는 여전히 넣되
//   「두 프레임을 구분하지 못하는 표본」이라는 사실을 같이 못박는다.
{
  console.log(`\n═══ 패널 x 경계 — 세로 크리스 직접 실측 ══════════════════════════════════`);
  // [이름, W, D, 구조, 실측 경계]  — 웨이크A·웨이크B·도솔은 6/6 잔차 0.00mm
  const XE = [
    ["웨이크A 46×46×138",   46,  46, ID.glue3, [0, 45.3,  91.3, 137.3, 183.3, 198.3]],
    ["웨이크B 36×36×168",   36,  36, ID.glue3, [0, 35.3,  71.3, 107.3, 143.3, 158.3]],
    ["도솔 50×50×150",      50,  50, ID.glue3, [0, 49.3,  99.3, 149.3, 199.3, 214.3]],
    ["바이오머 150×15×150", 150, 15, ID.tuck,  [0, 14.3, 164.3, 179.3, 329.3, 344.3]],
  ];
  let nOk = 0;
  for (const [nm, W, D, id, exp] of XE) {
    const ns  = calcNetSize(W, D, 100, id);
    const got = xEdges(W, D, ns.netW).map(v => +v.toFixed(2));
    const hit = got.every((v, i) => Math.abs(v - exp[i]) <= 0.05);
    if (hit) nOk++;
    // 탭 폭이 정말 15.0 인가 — 경계 배열이 맞아도 마지막 칸을 눈으로 못 보면 놓친다
    const tab = +(ns.netW - got[4]).toFixed(2);
    console.log(`  ${hit?"✓":"✗"} ${nm.padEnd(20)} ${got.join(", ").padEnd(42)} 탭 ${tab}`);
  }
  console.log(`  패널 x 경계: ${nOk}/${XE.length}   (netW 가산분 GLUE_TAB=${GLUE_TAB} = 탭 15.0 − D패널 부족분 0.7)`);
  console.log(`  ※ 바이오머(D=15)는 두 프레임을 **구분하지 못하는** 표본이다 — 이 한 건만으로`);
  console.log(`    「실측 확인됨」이라고 적으면 0.70mm 오류가 그대로 살아남는다(실제 이력).`);
  if (nOk !== XE.length) process.exitCode = 1;
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
// ★ 26-08-25 — **두 열**로 채점한다.
//   「기본」 = 목형 미지정(= 사용자가 아무 것도 안 넣은 상태) — 구조 기본값 안전 봉투로 계산된다.
//   「목형 지정」 = 그 목형의 실측 옵션을 `box.dieOpt` 로 넣었을 때.
//   둘을 같이 찍는 이유 — 앞에서만 재면 「앞이 응답을 못 한다」가 보이고,
//   뒤에서만 재면 「기본값로 받는 사용자가 실제로 얻는 점수」가 가려진다.
//   ⚠ **「목형 지정」 열은 대표 숫자가 아니다.** 목형표에 추정이 섞이면 이 열이 그만큼
//     부풀고, 그 부풀림은 견적서 up 에서 값을 역산한 것이라 순환이다(26-08-25 실제 사고:
//     이 열의 7/10 중 상승분 전부가 추정 3행에서 나왔고 실측 노브 기여는 0 이었다).
//     ⟹ 대표 숫자는 아래 `measuredOnly` 한 줄이고, 각주가 실측/추정/미실측 건수를 항상 찍는다.
//     현재 추정 0건(전부 걷어냈다) — 다시 0 이 아니게 되면 각주와 verify-imposition
//     「추정 되먹임 금지」 절이 동시에 운다.
console.log("견적서 건".padEnd(24)+"판형".padEnd(7)+"전개도(기본)".padEnd(16)+"기본".padEnd(6)+"목형".padEnd(6)+"배치(목형)".padEnd(11)+"발자국".padEnd(9)+"견적서  목형옵션");
console.log("-".repeat(118));
let n=0, nd=0; const dieRows=[];
for(const [k,nm,W,D,H,sid,real] of Q){
  const t = ID[k], dopt = dieOptOf(t,W,D,H);
  const dl = buildDieline({ mode:"box", structure:t, W, D, H, hangTab:0 });
  const L  = solveImposition({ dieline: dl, sheet: S(sid), hangTab:0 });
  const dlD = buildDieline({ mode:"box", structure:t, W, D, H, hangTab:0, dieOpt:dopt });
  const LD  = solveImposition({ dieline: dlD, sheet: S(sid), hangTab:0 });
  if(L.up===real)n++;
  if(LD.up===real)nd++;
  dieRows.push({ name:nm, ok:LD.up===real, t, W, D, H });
  const how = `${LD.cols}×${LD.rows}${LD.rotated?"↺":""}${LD.interlocked?"⇅":""}`;
  const tag = Object.keys(dopt).length
    ? `${dieSrcOf(t,W,D,H)} ${Object.entries(dopt).map(([a,b])=>`${a}=${b}`).join(",")}` : "—";
  console.log(nm.padEnd(24)+sid.padEnd(7)+
    `${dl.net.netW.toFixed(0)}×${dl.net.netH.toFixed(0)}`.padEnd(16)+
    (L.up+(L.up===real?"✓":"")).padEnd(6)+(LD.up+(LD.up===real?"✓":"")).padEnd(6)+
    how.padEnd(11)+(LD.footPct+"%").padEnd(9)+String(real).padEnd(6)+"  "+tag);
}
console.log("-".repeat(118));
console.log("  " + dieNote(Q.map(([k,,W,D,H])=>[ID[k],W,D,H])));
// ★ 기준값은 **하드코딩**한다. 종전에는 아래 이력 문장이 `${n}` 을 꽂아서
//   「26-08-18 교체로 이 표는 N/10 **불변**이다」라고 찍었는데, N 이 현재값이라
//   점수가 떨어져도 문장은 늘 「불변」이었다. 실제로 7/10 → 6/10 이 그렇게 가려졌다.
//   기준을 박아 두고 **다르면 다르다고 찍는다** — 갱신은 사람이 근거와 함께 한다.
// ★ 26-08-25(2차) — UP_DIE_BASE 7 → **6**. 7 을 만들던 두 행(십자A·십자B)이
//   **추정** 노브였고, 그 추정 규칙(십자 미실측 = 다수결 15.70)을 실측 목형에
//   되먹이면 니치어에서 실물 겹침 1,178.96mm² 가 자동선택 판형에 뜬다.
//   추정 행을 걷어냈으므로 점수가 내려간다 — **그게 정직한 값이다**(§7 갱신규칙 2).
const UP_BASE = 6, UP_DIE_BASE = 6;
const cmp = (got, base) => got === base ? `  (기준 ${base}/${Q.length} 과 같다)`
  : `  ⚠ 기준 ${base}/${Q.length} 과 **다르다** — 무엇이 움직였는지 아래 이력에 적어라`;
console.log(`up 일치(기본 · 목형 미지정): ${n}/${Q.length}` + cmp(n, UP_BASE));
console.log(`up 일치(목형 지정):            ${nd}/${Q.length}` + cmp(nd, UP_DIE_BASE));
if (nd < n) { console.log(`✗ 목형을 알려줍는데 점수가 내려갔다 — 목형표가 틀렸거나 노브 방향이 반대다.`); process.exitCode = 1; }
// ★ **대표 숫자는 이 줄이다** — 원본 도면이 없는 건(미실측)은 분모에서 뺀다.
//   그 건이 견적서와 어긋나는 것은 모델의 실패가 아니라 자료의 부재이고, 반대로
//   그 건에 추정값을 넣어 맞히는 것은 순환이다(die-profiles.mjs 머리말 ①②③).
console.log("  " + measuredOnly(dieRows).text);
console.log(`
※ 이력: 종전 이 표는 IL_W=10 상수 감산 모델을 복제해서 8/10 을 냈고(근거 없음 —
  verify-nest §5 가 기하 위반으로 반증), 엔진을 nest 로 갈면서 1/10 로 떨어졌다가
  물림 이중 차감을 제거하고 **7/10** 이 됐다. A/B 는 test/scorecard-unit.mjs.
※ 남은 불일치 4건 중 3건은 **목형 설계 요인**이다 — 물림·엔진 문제가 아니다:
  · 삼면D 82×7×126 (6up vs 2up) — D=7 은 전개도 공식 검증범위(D≥13) 밖.
    netH 가 실제보다 작게 나와 배치가 과다하다.
  · 맞뚜껑B 150×20×150 (4up vs 2up) — 500ea 소량. 기존 2up 목형을 그대로 쓴 건.
  · 삼면B 210×90×180 (2up vs 3up) — 46전지를 990×720 으로 클램프한 뒤 3열이
    안 들어간다. 견적서 「단위」는 980×720 이므로 폭은 맞는데 공식 netW 가 크다.
  세 건 모두 「판걸이(up) 직접 입력」으로 보정하는 것이 정답이다.
※ 날개 프로파일 A/B 에서 이 세 건은 **한 칸도 안 움직였다**(26-08-16 · 26-08-18 둘 다).
  즉 과다배치의 원인은 날개 프로파일이 아니다 — 프로파일 개편의 근거로 끌어오지 마라.
※ 26-08-18 안전봉투 교체는 이 표를 **안 움직였다**(그때도 7/10). 갈린 두 건은 이 표 밖:
  LUXEN 130×130×55 2up→1up (scorecard-unit §A) · 웨이크버니B 36×36×168 6up→4up.
  두 건 다 이 표에 없어서 점수에 안 잡힌다. LUXEN 을 여기 추가하려면 견적서의 판형
  id 가 필요한데 확보된 것은 재단크기 480×788 뿐이다 — 판형을 추측해 넣으면 점수만
  오르고 근거는 없는 줄이 된다. 그래서 넣지 않았다.
  ⚠ 웨이크버니B 의 「앱 실경로에서도 4up 으로 갈린다」는 **기본(목형 미지정)에서만 참**이다.
    아래 「표 밖 실측」이 두 열을 매번 다시 재서 그 문장이 아직 사실인지 보여준다.
※ ★ 이 표를 **7/10 → 6/10 으로 내린 것은 26-08-19 CROSS_TAB 14.3 → 23.33** 이다
  (안전봉투가 아니다 — 위 줄 참조). 움직인 행은 십자B 70×70×55 @하4 한 건:
    netW 294 → 303 → 배치 2×2(4up ✓) → 3×1↺(3up ✗)
  측정: 이 작업트리에서 cross.mjs 의 CROSS_TAB 만 14.3 으로 되돌리면 십자B 가 다시
  294×192 · 2×2 · 4up✓ 가 되고 표는 7/10 으로 돌아온다(나머지 9행 전부 불변).
  ⚠ 그래도 되돌리지 않는다 — 14.3 은 니치어 −9.03 / 칼선-10 −0.70 **부족**이라
    자동선택 판형에서 실물 겹침 1,269mm² · 100mm² 를 냈다(cross.mjs 「접착탭 폭이
    십자만 산포한다」). 점수 1칸보다 물리적으로 불가능한 판이 나쁘다. 점수는
    떨어진 대로 적는다(ARCHITECTURE §7 갱신규칙 2).`);

// ── 표 밖 실측 — **점수 아님** ────────────────────────────────────────────
// 위 표(견적서 10건)에 없는 건들이다. 여기에 두는 이유는 두 가지다.
//   ① 이 세 건에 관한 주장이 오래 **주석 안의 숫자**로만 있었고 그대로 늙었다.
//      특히 「실측 far 3벌은 up 을 한 칸도 안 움직인다」는 **웨이크버니B 에서 거짓**이다 —
//      기본 4up / 목형 지정 6up 이고 견적서가 6up 이다. 실측 노브가 앱 실경로에서
//      견적서를 재현하는 **유일한** 자리인데 어느 채점표도 안 세고 있었다.
//   ② 그렇다고 여기를 점수로 올리지 않는다. 점수로 세려면 위 표에 행을 더해야 하고,
//      그건 채점 정의를 바꾸는 일이라 사람이 근거와 함께 해야 한다(§7 갱신규칙 2·6).
//      숫자만 매번 다시 재서 **주장이 아직 사실인지**만 보여준다.
// ⚠ 아래에서 solveLayout 을 **직접** 부른다. 앱 코드에서는 금지지만(정책이 빠진 up 이
//   견적에 들어간다) 여기서 재려는 것이 바로 「상한이 무엇을 깎았는가」이고,
//   solveImposition 은 컷 **이전**의 발자국을 돌려주지 않는다. scorecard2 와 같은 용법이다.
console.log("\n── 표 밖 실측(견적서 10건에 없는 건) — **점수 아님** ──────────────────");
console.log("  건".padEnd(24)+"판형".padEnd(7)+"기본".padEnd(7)+"목형".padEnd(7)+"발자국(목형)".padEnd(13)+"컷 이전".padEnd(16)+"견적서  무엇을 말하나");
for (const [k,nm,W,D,H,sid,real,say] of [
  ["glue3","웨이크버니A 46×46×138",46,46,138,"guk2",6,
   `발자국 상한 MAX_FOOT_PCT=${MAX_FOOT_PCT} 가 6up 을 깎는다(비싸게 = 안전측). 상한을 올리면 재현되지만 전역 정책이다`],
  ["glue3","웨이크버니B 36×36×168",36,36,168,"guk2",6,
   "★ 실측 노브(far)가 앱 실경로에서 견적서를 재현하는 자리 — 기본은 못 맞힌다"],
  ["glue3","탈취제A 75×37.5×186",75,37.5,186,"4x62",4,
   "⚠ 앱이 견적서보다 **많이** 건다 = 싸게 부른다(영업 위험). 노브로 안 풀린다"],
]) {
  const t = ID[k], dopt = dieOptOf(t,W,D,H), sh = S(sid);
  const dlOf = o => buildDieline({ mode:"box", structure:t, W, D, H, hangTab:0, dieOpt:o });
  const up = o => solveImposition({ dieline: dlOf(o), sheet: sh, hangTab:0 });
  const L = up({}), LD = up(dopt);
  const pa = printableArea(sh);
  const raw = solveLayout(dlOf(dopt).pieces, pa.printW, pa.printH);
  const rawFoot = raw?.bbox ? raw.bbox.w * raw.bbox.h / (pa.long * pa.short) * 100 : NaN;
  console.log("  "+nm.padEnd(22)+sid.padEnd(7)+
    (L.up +(L.up ===real?"✓":"")).padEnd(7)+
    (LD.up+(LD.up===real?"✓":"")).padEnd(7)+
    `${LD.footPct}%${LD.utilCapped?" 컷":""}`.padEnd(13)+
    `${raw?.up}up ${rawFoot.toFixed(1)}%`.padEnd(16)+
    String(real).padEnd(6)+"  "+say);
}

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

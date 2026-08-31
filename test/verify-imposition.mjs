// 실제 대지(임포지션) 대조 — 목형이 이대로 파진 도면
//
// 출처: 250423 삼면E 환패키지 디자인 PDF
//   mediabox = 545.0 × 394.0mm = **정확히 4×64절**
//   4×64 대지 위에 2up 으로 앉힌 실제 모습 (실제 목형도 이대로 파짐)
//
// 이 파일은 src/domain/dieline/index.mjs 의 calcNetSize 를 **직접 import** 한다.
// 종전에는 netW/netH 공식을 이 파일이 복제해서, 앱 공식을 바꿔도 여기 「공식」 열은
// 옛 값을 계속 보여줬다. 그리고 pass/fail 카운터가 없어 몇 건이 틀려도 exit 0 이었다.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { calcNetSize, dielinePieces } from "../src/domain/dieline/index.mjs";
import { solveImposition } from "../src/domain/imposition.mjs";
import { BASE_SHEETS } from "../src/domain/data/sheets.mjs";
import { readDieline } from "../src/domain/pdf-dieline.mjs";
import { buildDieline } from "../src/domain/quote.mjs";
import { findBestSheet } from "../src/domain/sheet-select.mjs";
import { DEFAULT_PAPER } from "../src/domain/data/papers.mjs";
// ★ 목형별 구조 옵션 픽스처 — verify-net · scorecard-nest · scorecard-unit · scorecard2 와
//   **같은 한 벌**을 읽는다. 여기에 복제하면 그 사본이 늙어 「같은 목형인데 스위트마다
//   다른 도형」이 된다(die-profiles.mjs 머리말이 그 이유를 소유한다).
import { dieOptOf, dieSrcOf, DIE_TABLE } from "./die-profiles.mjs";

// ── 판정 집계 ──────────────────────────────────────────────────────
// known:"이유" 를 붙인 항목은 이미 문서화된 공식 오차다 (verify-total 의 knownDiff 와 같은 규약).
let PASS = 0; const KNOWN = [], FAIL = [];
function check(label, real, calc, tol, known) {
  const hit = Math.abs(calc - real) <= tol;
  if (hit) PASS++;
  else if (known) KNOWN.push([label, known, real, calc]);
  else FAIL.push([label, real, calc]);
  return hit;
}

const D = {
  name: "삼면E 90×70×130 · 삼면접착 자동바닥",
  sheet: [545.0, 394.0],          // 대지 = 4×64절
  W: 90, D: 70, H: 130,
  up: 2,
  rotated: true,                   // netW 가 세로(394축), netH 가 가로(545축)
  // 측정값 (접는선 좌표 전수 추출)
  netW: 335.0,                     // 세로 방향 실측
  netH: 251.6,                     // 가로 방향 실측
  box1: [33.1, 284.7],             // x 범위
  box2: [263.9, 516.1],
  bodySpan: 334.3,                 // 몸통 구간의 세로 커버 = netW 와 일치
};

const overlap = +(D.box1[1] - D.box2[0]).toFixed(1);
const span    = +(D.box2[1] - D.box1[0]).toFixed(1);
const marginL = D.box1[0], marginR = +(D.sheet[0] - D.box2[1]).toFixed(1);

console.log("═══ 실제 대지 측정 ═══════════════════════════════════════════════════════");
console.log(`  대지          ${D.sheet[0]} × ${D.sheet[1]} mm  ← 4×64절 정확히 일치`);
console.log(`  박스          ${D.up}up · ${D.rotated ? "회전(netH 가 가로)" : "정방향"}`);
console.log(`  전개도 실측    ${D.netW} (세로) × ${D.netH} (가로)`);
console.log(`  박스1 x       ${D.box1[0]} ~ ${D.box1[1]}`);
console.log(`  박스2 x       ${D.box2[0]} ~ ${D.box2[1]}`);
console.log(`  ─────────────────────────────────────────`);
console.log(`  겹침(맞물림)   ${overlap} mm      = 2×${D.netH} − ${span}`);
console.log(`  전체 점유      ${span} mm`);
console.log(`  좌우 여백      ${marginL} / ${marginR} mm  → 물림 ≈ 30mm`);

// ── 공식 대조 (실코드 calcNetSize) ─────────────────────────────────
const NS     = calcNetSize(D.W, D.D, D.H, "glue_3side");
const netW_f = NS.netW, netH_f = NS.netH;
const lid_f  = NS.topLid, bot_f = NS.botFloor;

console.log("\n═══ 현재 공식과 대조 ═════════════════════════════════════════════════════");
console.log("항목".padEnd(16)+"실측".padEnd(12)+"공식".padEnd(12)+"Δ");
console.log("-".repeat(56));
const rows = [
  ["전개도 가로(netW)", D.netW, netW_f, null],
  // netH 는 알려진 공식 오차다 — 삼면접착 세로는 칼선 벡터 실측 3건으로 세웠고
  // 이 대지(접는선 추출)는 그 3건에 포함되지 않는다.
  ["전개도 세로(netH)", D.netH, netH_f, "삼면접착 netH 공식이 이 대지보다 크다"],
];
for (const [k,a,b,known] of rows) {
  const hit = check(k, a, b, 2, known);
  console.log(k.padEnd(16)+a.toFixed(1).padEnd(12)+b.toFixed(1).padEnd(12)+
    ((b-a>0?"+":"")+(b-a).toFixed(1)) + (hit ? "  ✓" : "  ⚠"));
}
console.log(`뚜껑 / 바닥      ─           ${lid_f.toFixed(1)} / ${bot_f.toFixed(1)}   (실측 분리 불가)`);

// 대지가 물림 30mm 양쪽 안에 들어가는지 — 좌우 여백 33.1/28.9 의 근거
const fitReal = check("삼면E 대지 물림 30 이내", D.sheet[0] - 60, span, 3, null);

console.log(`
▶ netW 는 ${Math.abs(netW_f - D.netW).toFixed(1)}mm 오차로 정확 (접착날개 14.3 확인)
▶ netH 는 공식이 ${(netH_f - D.netH).toFixed(1)}mm 크다

▶ 맞물림 ${overlap}mm 이 실측값 — netH 의 ${(overlap/D.netH*100).toFixed(1)}% 다.
  종전 코드는 IL_H = 바닥날개(${bot_f.toFixed(0)}mm) 를 썼다. 견적서 up 재현(8/10)으로
  역산한 값이고, verify-nest §5 가 그 값이 기하 위반임을 증명했다.
  현행 nest 엔진은 폴리곤에서 실제로 피할 수 있는 만큼만 물린다.

  검산 — 실측값으로:  2 × ${D.netH} − ${overlap} = ${(2*D.netH-overlap).toFixed(1)} ≤ ${D.sheet[0]} − 60(물림 30×2) = ${D.sheet[0]-60}  ${fitReal?"✓":"✗"}

▶ 실무 확인: 맞물림은 **바닥이 아니라 뚜껑쪽**으로 물리는 경우가 가장 많음.
  → 이건 이제 고를 필요가 없다. nest 엔진이 반전 규칙 4종
    (none / rowAlt / colAlt / checker)을 전부 시도하고, 각 규칙마다 폴리곤에서
    실제로 피할 수 있는 최소 피치를 따로 푼 뒤 up 이 가장 큰 것을 고른다
    (nest.mjs FLIP_RULES). 채택된 규칙은 layout.candidates 로 화면에 나온다.
  대지 실측이 더 늘면 「엔진이 고른 규칙 = 실제 대지의 규칙」인지 대조할 수 있다.`);

// ══════════════════════════════════════════════════════════════════
// 대지 2건 — 맞물림은 「날개가 좌우로 끊겨 서로 지나가는」 방식
// ══════════════════════════════════════════════════════════════════
// 251110 칼선-05 모래시계 단상자 도면 (565.1 × 369.2 대지, 2up 상하)
//   상 박스 y 157.1~350.8 (193.7)
//   하 박스 y   7.4~201.0 (193.6)
//   → 겹침 43.9mm,  전체 343.4mm  (2×193.7 − 43.9 = 343.5 ✓)
//
// 겹침 구간(y 157~201) 의 x 점유를 보면 **좁은 구간 2개**뿐이다:
//   y=163~199 → "153" 과 "239-241"  (접는선 몇 개만)
// 즉 그 깊이에서는 각 박스가 **좁은 혀(tongue)** 만 내밀고 있어서
// 서로 옆을 지나갈 수 있다. 날개가 패널 폭을 꽉 채우지 않는다.
const IMPOSITIONS = [
  { name:"삼면E 90×70×130 (4×64절)", netH:251.6, overlap:20.8, span:483.0, up:2 },
  { name:"칼선-05 모래시계 (565×369)", netH:193.7, overlap:43.9, span:343.4, up:2 },
];
console.log("\n═══ 대지 2건 — 맞물림 실측 ═══════════════════════════════════════════════");
console.log("대지".padEnd(30)+"netH".padEnd(9)+"겹침".padEnd(9)+"겹침/netH".padEnd(11)+"검산");
console.log("-".repeat(80));
for (const d of IMPOSITIONS) {
  const calc = +(d.up*d.netH - d.overlap).toFixed(1);
  const hit = check(`대지 정합 ${d.name}`, d.span, calc, 1, null);
  console.log(d.name.padEnd(30)+d.netH.toFixed(1).padEnd(9)+d.overlap.toFixed(1).padEnd(9)+
    ((d.overlap/d.netH*100).toFixed(1)+"%").padEnd(11)+
    `${d.up}×${d.netH} − ${d.overlap} = ${calc} (실측 ${d.span})` +
    (hit ? " ✓" : " ✗"));
}
console.log(`
▶ 겹침이 8.3% ~ 22.7% 로 갈린다 → 고정 비율도 아니다.
  종전 코드는 IL_H = 바닥날개(85mm) 를 상수로 뺐고 두 실측값 사이에 있었지만,
  verify-nest §5 가 그 값(145.0mm)이 반전 이웃과 기하 위반임을 증명했다
  (실제 허용 최대 행겹침 26.0mm). 현행은 상수 감산을 쓰지 않고 NFP 가 푼다.

▶ 날개 테이퍼 — **해결됨** (이 절은 이력으로 남긴다)
  종전에는 날개를 패널 폭을 꽉 채운 사각형으로 그려서, 실제로는 좁은 혀 옆에
  있는 빈 틈이 사라지고 맞물림이 0mm 로 계산됐다.
  지금은 geometry.piecesFromFlaps 가 실측 테이퍼를 반영한다 —
    깊은 혀 인셋 10.2mm(TAPER_MAX) · 위 띠 끝단폭 10.8mm(TIP_W),
    그리고 [전폭 0~70%]+[사다리꼴 70~100%] 2조각 분리.
  ★ 26-08-18 정정 — 여기 적혀 있던 「아래날개 깊이 [0.10b, 0.40b, b, 0.40b]」는
    두 세대 전 값이다. 현행은 목형 5벌 실측 기반 안전 봉투
    [min(W,b)/2, b, min(W,b)/2, b] 이고 정본은 dieline/glue3.mjs flaps() 다.
    깊이 값을 이 파일에 복제하지 마라 — 복제본은 반드시 늙는다(이 줄이 증거다).
  근거는 웨이크버니 A·B 벡터 실측(아래 「날개 테이퍼 실측」 절), 검산은
  verify-dieline 불변식 360/360 (폴리곤 bbox === netW×netH 오차 0)
  + 아래 「실측 프로파일 겹침 게이트」.`);

// ══════════════════════════════════════════════════════════════════
//  칼선 실측 3건 — 맞뚜껑 날개 구조 (2026-07-31 벡터 추출)
// ══════════════════════════════════════════════════════════════════
//  파일: 바이오머테리얼즈코리아/디자인/맞뚜껑.pdf        (150×15×150)
//        더파이러츠/디자인/맞뚜껑.pdf                    (190×68×280, 도련 1.5mm)
//        도솔메디/…경옥고3입_패키지.pdf                  (2up 대지)
//
//  ① netW = 2(W+D) + 14.3  — 2샘플 오차 0.0mm
//       바이오머   2(150+15)+14.3 = 344.3  실측 344.3
//       더파이러츠 2(190+68)+14.3 = 530.3  실측 533.3 − 도련 3.0 = 530.3
//
//  ② xEdges — ★ 26-08-16 정정. 종전 이 자리에 적혀 있던
//       「xEdges = [0, D, D+W, 2D+W, 2D+2W, netW] · 바이오머 전 경계 오차 0.0mm」
//     는 **틀렸다.** 하필 바이오머는 D=15 = 접착탭 폭 15.0 이라 참·거짓 두 프레임이
//     같은 값들의 순열이 되어 오차 0.0 으로 보였을 뿐이다.
//     세로 크리스를 직접 재면 패널 폭은 [D−0.70, W, D, W, **15.00**] 이고
//     웨이크A·웨이크B·도솔 3건에서 6/6 경계 잔차 0.00mm 다.
//     현행 게이트는 test/verify-net.mjs 「패널 x 경계」(D≠15 표본 3건 포함).
//     ※ 더파이러츠는 접착탭이 왼쪽 끝이고 순서가 W,D,W,D — 도면마다 다르다.
//        전개도 폭은 같으므로 배치에는 영향 없고 그림 방향만 다르다.
//
//  ③ ★ 날개는 2단 구조다 (이게 맞물림의 정체)
//       세로 접는선의 y 범위로 몸통을 특정했다(아트워크에 오염되지 않는 방법):
//       바이오머   x=150 에서 y 46.7~196.7 → 몸통 150.0 = H 정확
//                  x=165·330 에서 y 31.7~211.7 → 180.0 = H + 2D
//                  즉 몸통 위아래로 D(15mm) 만큼 '뚜껑 패널'이 전폭으로 있고
//       더파이러츠 x=96.7 에서 y 99~379 → 몸통 280.0 = H 정확
//                  x=164.7·354.7 에서 y 31~447 → 416.0 = H + 2D (D=68)
//       netH 공식 H + 2(D+16.5) 와 차이 = 2×16.5 → 접는선 밖으로 16.5mm 더 나간다.
//
//   구조 결론:
//       [텍 혀 16.5mm  ← 좁다]
//       [뚜껑 패널 D    ← 전폭]
//       [몸통 H]
//       [바닥 패널 D    ← 전폭]
//       [텍 혀 16.5mm  ← 좁다]
//
//   현재 폴리곤 모델은 D+16.5 전체를 '전폭 사다리꼴 1개'(chamfer 2.5mm)로 그린다.
//   실제로는 D 구간만 전폭이고 16.5mm 혀는 좁다. 이 좁은 혀가 맞물림이 들어가는
//   유일한 공간인데 모델이 그걸 전폭으로 채워버려서 맞물림이 0mm 로 계산됐다.
//   → 실측 대지 20.8mm / 43.9mm 를 재현하지 못한 직접 원인.
//
//  ④ 도솔메디 대지: 576.0×295.0 에 288+288 = 같은 박스 2개가 경계 칼선을 공유.
//     맞물림이 아니라 '칼선 공유'(deepnest 의 merge common lines)다.
//     NFP 엔진은 닿음을 허용하므로 dx = netW 로 이 배치를 그대로 재현한다.
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
//  웨이크버니 삼면접착 2종 — 자동바닥 날개 테이퍼 실측 (2026-07-31)
//  파일: 고객사_진행중단/웨이크버니/디자인/웨이크버니삼면접착2종.pdf
//  견적서: 화장품2종 10,000ea · AB295라이트 국2(469×636) 220,653원/R · 6up
// ══════════════════════════════════════════════════════════════════
//  A 46×46×138  전개도 실측 198.3 × 234.0   몸통 y 35.0~173.0 (=138.0=H ✓)
//  B 36×36×168  전개도 실측 158.3 × 247.0   몸통 y 28.0~196.0 (=168.0=H ✓)
//
//  ① 큰 날개/작은 날개가 뒤바뀌어 있었다
//       실측 위 띠  A 35.0 / B 28.0   ← 종전 botFloor(0.33D+0.15W+11) 와 대응
//       실측 아래 띠 A 61.0 / B 51.0   ← 종전 topLid(0.88D+0.09W+20.6) 와 대응
//     합이 비슷해 netH 로는 안 보였지만 빈 구멍 위치가 뒤집혀 맞물림이 통째로 틀렸다.
//  ② 큰 날개 상수 −4.4 로 실측과 0.2mm 이내
//       A 0.88(46)+0.09(46)+16.2 = 60.82  실측 61.0
//       B 0.88(36)+0.09(36)+16.2 = 51.12  실측 51.0
//  ③ 접착탭이 왼쪽 끝 15mm (더파이러츠도 동일). 우리 모델은 오른쪽 14.3mm —
//     폭은 같고 방향만 달라 배치에는 영향 없다.
//
//  ★ ④ 자동바닥 날개는 강하게 테이퍼된다 — 이것이 맞물림 공간의 정체
//     B(36×36×168) 아래 날개대 y 196.0~247.0 (깊이 51.0) 를 y 레벨별로 절단:
//       y 196.0 (  0%)  4구간  [15.0-51.0] [51.7-85.8] [87.0-123.0] [124.1-158.3]
//       y 203.7 ( 15%)  3구간             [53.3-84.1] [87.0-123.0] [125.9-156.6]
//       y 211.3 ( 30%)  3구간             [56.6-83.7] [87.0-123.0] [126.3-153.4]
//       y 221.5 ( 50%)  1구간                         [87.0-123.0]
//       y 231.7 ( 70%)  2구간(노치)                   [87.0-95.0] [115.0-123.0]
//       y 239.3 ( 85%)  1구간                         [90.0-119.9]
//       y 246.5 (100%)  1구간                         [97.2-112.8]  ← 폭 15.6mm
//     읽어내면:
//       패널1 날개 ≈ 깊이 8mm  (15% 에서 소멸)
//       패널2·4 날개 ≈ 깊이 20mm (30~50% 사이 소멸)
//       패널3 날개 = 깊이 51.0mm, 폭이 36.0 → 15.6mm 로 좁아진다 (57% 축소)
//     즉 [작음, 중간, 깊고 좁음, 중간] 이고, 깊은 혀 양옆이 크게 비어 있다.
//     A 도 동일 패턴 (y 203.5 이후 [107.0-153.0] 한 구간만 남고 100% 에서 25.6mm).
//
//  현재 모델은 아래 날개를 [0, 0.36b, b, b] **전폭 사각형**으로 둔다.
//  높이는 맞췄지만 폭 테이퍼가 없어 깊은 혀 양옆의 빈 공간이 없다.
//  → 삼면접착 최대 겹침이 여전히 0mm 인 직접 원인.
//
//  필요 겹침 (6up/3up 성립 조건):
//     삼면A 120×55×180 @597×444   9.0mm
//     삼면B 210×90×180 @980×720  21.8mm
//     웨이크버니B      @636×469  25.8mm
//     LUXEN            @480×788  70.2mm  ← 과도. 별도 원인 의심
//  깊은 혀가 36.0→15.6mm 로 좁아지면 양옆 20mm 씩 비므로 20~25mm 급 맞물림이
//  기하학적으로 성립한다. 위 3건이 이 범위에 들어온다.
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
//  소스코 삼면접착 140×43×130 — 3번째 실측 (2026-08-04)
//  파일: 고객사_진행중단/소스코/디자인/삼면접착140x43x130.pdf
// ══════════════════════════════════════════════════════════════════
//  전개도 실측 380.3 × 223.5
//    netW 공식 2(140+43)+14.3 = 380.3  → 오차 0.0mm (4번째 확인)
//    패널 폭 실측 [15.0, 140.0, 43.0, 140.0, 42.3] = [접착탭, W, D, W, D−0.7]
//      접착탭이 왼쪽 15mm (더파이러츠·웨이크버니와 동일).
//      우리 xEdges 는 이걸 좌우로 뒤집은 것과 같으므로 배치에는 영향 없다.
//      ★ 26-08-16 — **이 줄이 0.70mm 를 이미 갖고 있었다.** 마지막 42.3 은 D 43 이
//        아니라 D−0.7 이고, 첫 칸 15.0 도 GLUE_TAB 14.3 이 아니다. 위 ② 참조 —
//        그때는 「탭 폭 = 14.3」이라는 이름을 믿어서 42.3 을 측정 오차로 읽었다.
//    가로 접는선 35.5 / 165.6 → 165.6−35.5 = 130.1 = H ✓
//    위 띠 35.5  아래 띠 223.5−165.6 = 57.9
//
//  ★ W≠D 인 첫 샘플이라 D·W 계수를 분리할 수 있었다. 3점 연립:
//      위 띠  s = 0.67D + 0.03W + 2.8    3건 오차 0.31mm 이내
//      아래 띠 b = D + 15                 3건 오차 0.1mm 이내
//                                        (W 계수 −0.001 ≈ 0 — 폭은 무관)
//      netH = H + s + b                   3건 오차 0.3mm 이내
//    b = D + 15 는 물리적으로도 맞다 — 뚜껑이 깊이 D 를 덮고 15mm 혀가 더 나간다.
//    종전 공식(0.88D+0.09W+16.2 / 0.33D+0.15W+11)은 bbox 만 보고 맞춘 회귀라
//    실제로 없는 W 의존성이 들어가 있었고, 소스코에서 netH 를 19.3mm 크게 냈다.
//
//  배치: 4×62(788×545) 에 2열×2행 = 4up (칼선공유, 맞물림 불필요)
//      2×380.3 = 760.6 ≤ 788 ✓ / 2×223.8 = 447.6 ≤ 545 ✓
//    실제 대지 이미지는 위아래 줄이 180° 반전돼 있는데, 끼워맞추려는 게 아니라
//    인쇄 방향·목형 편의로 보인다(반전 없이도 그대로 들어간다).
//
//  이 보정으로 삼면A 120×55×180 이 2up 으로 맞았다 —
//  netH 302.6 → 293.25 로 내려가 597 에 2열(회전)이 들어간다.
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
//  ★ 실물 겹침 게이트 — 「앱이 고른 판이 실물에서 성립하는가」
//
//  왜 이게 필요한가
//  ──────────────
//  nest 는 **모델 폴리곤**끼리 안 겹치는 것만 보증한다. 모델이 실물보다 작으면
//  「모델 겹침 0 · 실물 겹침 5,033mm²」인 판을 자신 있게 내놓는다. 실제로 밟았다 —
//  26-08-16 프로파일은 소스코형 목형의 아래 띠 W1(폭 140 전체에 58mm 날개)을
//  0 으로 그렸고, 격자 솔버가 그 빈자리를 물고 하4(444×597)에서
//    dy 223.81→181.00 (세로 물림 42.81) + sx 190.15 반피치 엇갈 = 2up
//  을 골랐다. up 은 2 로 같아 **금액이 안 갈리므로 어떤 금액 스코어카드도 못 잡는다.**
//  bbox 도 안 갈리므로 verify-dieline 불변식도 못 잡는다. 그래서 이 게이트가 있다.
//
//  ══ ★★ 26-08-19 개편 — 「진실」을 모델에서 원본 칼선 PDF 로 옮겼다 ══
//
//  종전 이 게이트의 「실물」은 실측 **날개 깊이만** 갈아끼우고 나머지는
//  `piecesFromFlaps` 로 **다시 합성한** 도형이었다. 그래서 모델과
//    · 같은 netW 공식 2(W+D)+14.3      · 같은 TIP_W 10.8
//    · 같은 테이퍼 규약(전폭 70% + 선형 사다리꼴 30%)   · 같은 xEdges
//  를 공유했고, 그 넷의 오차는 **정의상 0** 이라 원리적으로 검출 불가였다.
//  게이트가 자기가 검증할 공식으로 진실을 지은 것이다. 통과하고 있던 구멍 2개:
//    · 칼선-14 실측 netW **264.30** vs 모델 263.30 → 표준판형 10종 전부에서 실물 겹침
//    · addFlap 의 선형 사다리꼴이 실물의 「노치 후 재확대」 어깨를 잘라내
//      7목형 전부에 모델이 실물 외곽을 못 덮는 구간이 있었다(최대 −15.44mm)
//  ★ 이 저장소는 같은 함정을 이미 한 번 밟았다 — 「xEdges 실측 오차 0.0」이 사실은
//    코드 출력 자기검산이었던 건(geometry.mjs xEdges 주석). 두 번은 안 된다.
//
//  ══ ★★ 26-08-25 개편 — 「모델」을 **한 벌에서 두 벌로** 늘렸다 ══
//  목형별 구조 옵션(§15)이 생기면서 같은 W·D·H 가 **두 도형**을 낸다. 종전 이 게이트는
//  기본값 도형만 재서, 목형을 아는 사용자가 실제로 받는 도형이 무검증이었다.
//  지금은 세 게이트(겹침·잔차·커버리지)를 「목형 지정」·「기본값」 두 열로 잰다 —
//  아래 ORACLE 뒤 MODES 절 참조. 두 열이 같은 숫자를 내면 채점은 한 번만 한다.
//
//  ⟹ 지금 「실물」은 `readDieline` 이 원본 PDF 에서 뽑은 **폴리라인 그대로**다.
//     모델이 관여하는 곳은 **자리(layout.boxes)** 하나뿐이다. 도형은 PDF 가 소유한다.
//     PDF 를 못 읽거나 후보에 실측 bbox 가 없으면 그 목형은 「진실 없음」으로
//     **찍고** 뺀다 — 조용히 빼지 않는다(verify-pdf 「SKIP 은 실패다」와 같은 규약).
//
//  ★ 재는 방법 — NFP 를 쓰지 않는다
//    재려는 것이 「nest 가 고른 배치가 실물에서 겹치는가」인데 판정까지 nest 의 NFP 로
//    하면 같은 실수를 두 번 하고 통과한다(verify-nest 머리말과 같은 철학).
//    여기서는 **y 는 0.25mm 격자 · x 는 정확**이다. 행마다 폴리라인과의 교차 x 를
//    직접 구해 「재질 구간」을 만들고 두 도형의 구간을 교집합한다.
//    ⚠ 왜 2D 격자를 안 쓰나 — 폴리라인은 닫힌 링이 아니라서 채우려면 래스터가
//      필요한데, 래스터는 벽 두께가 1칸 생긴다. 칼선공유(dx=netW)로 **딱 붙은**
//      이웃끼리 그 벽이 겹쳐 접촉길이 200mm × 0.125mm ≈ 25mm² 의 **가짜 겹침**이
//      나온다. 잡으려는 신호가 23mm² 급이라 계측기가 신호보다 큰 잡음을 낸다.
//      x 를 정확히 풀면 딱 붙은 이웃의 교집합 길이가 정확히 0 이다.
//    래스터는 「이 구간이 재질인가」 판정에만 쓴다(구간 단위라 벽 두께에 둔감하고,
//    틀리는 방향도 **크게** = 안전측이다). 계측기 자기검사도 같이 돈다 — 같은 배치를
//    2% 확대해 겹침이 잡히는지.
// ══════════════════════════════════════════════════════════════════
//  오라클 = 원본 칼선 PDF (영업기밀이라 저장소 밖). 뿌리는 환경변수로 바꾼다.
const DR = process.env.PDF_ORACLE_DIR ?? "C:/이예찬_업무/연도별/2026";
const PR = process.env.DIE_ORACLE_DIR ?? "C:/이예찬_업무/private/도면/견적용도면";
const ALLOW_SKIP = process.env.PDF_ALLOW_SKIP === "1" || process.argv.includes("--allow-skip");

//  bbox = 그 PDF 에서 **채택할 후보를 특정**하는 열쇠다(1순위를 맹신하지 않는다).
//    verify-pdf §A 가 같은 값으로 추출기를 채점하고 있으므로 두 스위트가 서로를 묶는다.
//  rot90 = 도면이 90° 눕어 있다 → 모델 프레임(패널이 x 로 늘어섬)에 맞춰 돌린다.
//  tabLeft = 접착탭이 도면 왼쪽이다 → 모델 프레임(탭 오른쪽)에 맞춰 x 를 거울로 뒤집는다.
//    판정 근거는 **세로 크리스 실측**(패널 폭이 [탭, W, D, W, D−0.7] 인지 그 역순인지):
//      소스코 [15,140,43,140,42.3] · 웨이크A [15,46,46,46,45.3] · 웨이크B [15,36,36,36,35.3]
//      도솔 [15,50,50,50,49.3] · 바이오머 [15,150,15,150,14.3] · 더파이러츠 [15,258*,190,67.3]
//      니치어 [24,70,70,70,69.33] · 다빈기획 [15,190,100,190,99]
//      칼선-09 [14,42,42,42,41] · 칼선-10 [17,49,49,49,48]          ← 여기까지 탭 왼쪽
//      뉴로티엑스 [19.33,80,20,80,12] · 칼선-14 (눕힌 뒤 탭이 큰 x)  ← 탭 오른쪽
//      (*더파이러츠·바이오머는 W|D 크리스 하나가 도면에 없어 두 패널이 합쳐 읽힌다)
//  top/bot = 날개 깊이 실측 (현행 idx 0..3 = [D2, W2, D1, W1]. glue3.mjs 「사상」 참조).
//    **null 은 「그 칸은 실측이 없다」**는 뜻이고 잔차 게이트가 그 칸을 채점하지 않는다.
//    0 으로 적으면 「날개가 없다」가 되어 모델이 뭘 그리든 잔차가 +가 되므로 조용히 통과한다.
const ORACLE = [
  { n:"소스코",     id:"glue_3side", W:140, D:43,   H:130, top:[21.5,35.5,21.5,35.5], bot:[29,30,29,58],
    pdf:`${DR}/고객사_진행중단/소스코/디자인/C5AF4AD1-BB73-4581-A7B3-93697D2145DC.pdf`, page:0, bbox:[380.3,223.5], tabLeft:true },
  { n:"웨이크A",    id:"glue_3side", W:46,  D:46,   H:138, top:[23,35,23,35],         bot:[23,61,23,0],
    pdf:`${DR}/고객사_진행중단/웨이크버니/디자인/웨이크버니삼면접착2종.pdf`, page:0, bbox:[198.3,234.0], tabLeft:true },
  { n:"웨이크B",    id:"glue_3side", W:36,  D:36,   H:168, top:[18,28,18,28],         bot:[18,51,18,0],
    pdf:`${DR}/고객사_진행중단/웨이크버니/디자인/웨이크버니삼면접착2종.pdf`, page:1, bbox:[158.3,247.0], tabLeft:true },
  { n:"도솔",       id:"glue_3side", W:50,  D:50,   H:150, top:[25,38,25,38],         bot:[24,65,24,0],
    pdf:`${DR}/고객사/제작완료/주식회사도솔메디/제작완료/디자인/260129_코리팩_크리아_디자인(13554)_경옥고3입_패키지.pdf`, page:0, bbox:[214.3,253.0], tabLeft:true },
  { n:"칼선-14",    id:"glue_3side", W:80,  D:44.5, H:30,  top:[34.5,34.5,34.5,34.5], bot:[30,0,30,60],
    pdf:`${PR}/24~/240717_엔이이에이/240717_엔이이에이.pdf`, page:0, bbox:[124.5,264.3], rot90:true },
  { n:"바이오머",   id:"tuck_both",  W:150, D:15,   H:150, top:[13,30,13,0],          bot:[13,30,13,0],
    pdf:`${DR}/고객사/제작완료/바이오머테리얼즈코리아/디자인/맞뚜껑.pdf`, page:0, bbox:[344.3,210.0], tabLeft:true },
  { n:"더파이러츠", id:"tuck_both",  W:190, D:68,   H:280, top:[35,86,35,0],          bot:[35,86,35,0],
    pdf:`${DR}/고객사/제작완료/더파이러츠/디자인/맞뚜껑.pdf`, page:0, bbox:[530.3,452.0], tabLeft:true },
  // ── 십자조립 5벌 (26-08-19 등록) ────────────────────────────────
  //  ★ 왜 이제야 등록하나 — 등록을 안 한 것이 두 게이트가 초록이던 **유일한 이유**였다.
  //    게다가 이번 변경에서 netSize(netH 공식)까지 고친 유일한 구조가 cross 다.
  //    표본 0건인 구조의 공식을 고쳐 놓고 게이트가 초록인 것은 게이트가 아니다.
  //  날개 실측 = 이 PDF 들의 세로 크리스로 패널을 특정하고(5벌 전부 4경계 검출 성공)
  //    몸통 접는선 밖 최원점을 0.25mm 세로 스캔. 검산으로 cross.mjs 가 이미 적어 둔
  //    「아래 띠 D패널/W패널 비 32/49 · 68/70 · 14/14」가 3/3 정확히 재현됐다.
  //  ⚠ 뉴로티엑스만 접착탭이 **오른쪽**이라 실측 프레임이 곧 현행 프레임이다.
  //    나머지 4벌은 탭이 왼쪽이라 [탭,W1,D1,W2,D2] ↔ 현행 [4,3,2,1,0] 로 뒤집어 적었다.
  { n:"니치어",     id:"cross", W:70,  D:70,   H:151.5, top:[35,85,25.48,0],  bot:[32,49,32,49],
    pdf:`${PR}/240808_니치어/십자조립.pdf`, page:0, bbox:[303.33,285.0], tabLeft:true },
  { n:"다빈기획",   id:"cross", W:190, D:100,  H:109.5, top:[59,0,59,119.2],  bot:[68,70,68,70],
    pdf:`${PR}/240805_다빈기획/240805_다빈기획.pdf`, page:0, bbox:[594.0,298.7], tabLeft:true },
  { n:"뉴로티엑스", id:"cross", W:80,  D:20,   H:48.5,  top:[15.5,0,15.5,32], bot:[14,14,14,14],
    pdf:`${PR}/240821_뉴로티엑스/240821_뉴로티엑스(슬리브포함).pdf`, page:0, bbox:[211.33,95.0] },
  { n:"칼선-09",    id:"cross", W:42,  D:42,   H:117,   top:[20,55,20,0],     bot:[20,30,20,30],
    pdf:`${PR}/24~/240703_팀보/C017-42x42x117mm.pdf`, page:0, bbox:[181.0,202.0], tabLeft:true },
  { n:"칼선-10",    id:"cross", W:49,  D:49.5, H:144,   top:[23.5,65,23.5,0], bot:[23.5,34.5,23.5,34.5],
    pdf:`${PR}/24~/240703_팀보/C017-49x49x144mm.pdf`, page:0, bbox:[212.0,243.5], tabLeft:true },
];

// ══════════════════════════════════════════════════════════════════
//  ★ 26-08-25 — 게이트를 **두 열**로 잰다 (종전 1열: 기본 설정만)
//
//  왜 — 종전 이 스위트는 12벌 전부를 **기본 설정**으로 계량했다. 그런데 실측 목형은
//  이제 자기 옵션이 있고(§15 · glue3 `deepFlap` · cross `glueTabW`), 앱은 목형을 아는
//  사용자에게 **그 값으로** 계산해 준다. 기본값만 재면 「사용자가 실제로 받는 도형」이
//  통째로 무검증이다 — 그 도형은 봉투가 아니라 실측 크기라서 판이 더 빽빽해진다.
//
//    · 목형 지정(die) = test/die-profiles.mjs 가 그 목형에 실어 주는 값.
//                       ★ **절대선** — 실측 목형은 자기 옵션으로 실물 겹침 0 이어야 한다.
//                       견적서 up 재현보다 위다. 여기서 겹치면 견적서 up 이 아니라
//                       **모델의 다른 값**이 틀렸다는 신호다.
//    · 기본값(def)    = 옵션 없음. 목형을 **모르는** 사용자가 받는 도형.
//                       기본값이 실물에서 겹치면 앱이 물리적으로 불가능한 판을 판다.
//
//  ★ 목형표를 이 파일에 복제하지 않는다. 네 스위트가 같은 픽스처를 읽고, 한 목형의
//    실측이 갱신되면 다섯 곳이 같이 움직인다(die-profiles.mjs 머리말).
//  ⚠ 소스코·칼선-14 는 **실측이 near 인데 표가 일부러 비워 둔** 자리다(그 파일 ⚠ 두 자리).
//    그래서 두 열이 같은 값을 낸다 — 「목형을 알아도 앱은 봉투로 그린다」가 관측된다.
const optOfDie = o => dieOptOf(o.id, o.W, o.D, o.H);
const optStr   = opt => Object.keys(opt).sort().map(k => `${k}=${opt[k]}`).join(",") || "―";
const MODES = [
  { k: "die", label: "목형 지정", of: optOfDie },
  { k: "def", label: "기본값",   of: () => ({}) },
];
/** 그 목형·그 모드의 전개도. opt 는 dielinePieces 5번째 인자로 관통한다. */
const dpOf = (o, opt) => dielinePieces(o.W, o.D, o.H, o.id, opt);
/** 판걸이 캐시 키 — 옵션이 폴리곤을 바꾸므로 **키에 반드시 들어간다**
 *  (quote.mjs buildDieline 의 optKey 와 같은 규약. 빠지면 옛 배치를 돌려받는다). */
const ovlKey = (o, opt) => `ovl|${o.id}|${o.W}|${o.D}|${o.H}|${optStr(opt)}`;

// 원인이 특정된 **미해결** 겹침. 예산을 넘으면 실패다 — 알리바이가 아니다.
// 예산을 tol 로 쓰지 않는 이유: 그러면 예산 안의 건이 PASS 로 집계돼 조용히 잊힌다.
const KNOWN_OVERLAP = {
  // ★ 26-08-19 — 「도솔 12.0mm²」 예산을 **삭제했다.** 실물 y 자세를 측정으로 확정하면서
  //   (아래 resolveY — 삼면접착 4벌이 180° 뒤집혀 얹히고 있었다) 도솔 최대 겹침이
  //   0.70 → **0.47mm²** 로 내려가 잡음 하한 OVL_TOL 0.5 아래가 됐다. 원인(위 띠 s 공식
  //   잔차 −0.21mm)은 그대로 남아 있고 잔차 게이트 RES_BUDGET 도솔 −0.25 가 계속 지킨다.
  //   되돌아오면 이 줄이 아니라 「★신규」로 떠야 한다 — 예산으로 다시 덮지 마라.
  // ★ 26-08-19 — 「니치어 1500mm²」·「칼선-10 150mm²」 예산 2건을 **삭제했다.**
  //   그 둘은 십자 접착탭 산포(netW −9.03 / −0.70)로 생긴 실물 겹침이었는데, 예산이
  //   **자동선택 판형의 겹침**을 통과시키고 있었다 — 니치어 1,269.27mm² @국2(4000ea 실경로) ·
  //   칼선-10 100.17mm² @하4(1000ea 실경로). 즉 앱이 물리적으로 불가능한 판을 팔고 있었다.
  //   예산은 「원인이 특정된 **미해결**」의 자리다. 원인이 특정됐고 조치 방향이 안전측
  //   (도형을 크게 = up 감소 = 비싸게)이면 예산이 아니라 고칠 자리다.
  //   ⟹ cross.mjs CROSS_TAB = 23.33 (5벌 안전 봉투) 로 닫았다. 근거와 대가는 그 파일 주석.
  //   되돌리면 이 두 줄이 다시 필요해진다 = 되돌림을 이 파일이 즉시 드러낸다.
  // ★ 26-08-25 — 30.0 → **22.5** 로 **줄였다.** 실측값이 22.23 이고 남겨 둔 7.8 의 여유는
  //   근거가 없었다(= 돌연변이가 숨을 자리). 예산은 늘리는 물건이 아니다.
  "칼선-14": { max: 22.5, why: "발주 표기 D **44.5** vs 목형 실측 D **45.00** (패널 폭 93.66→138.66 = 45.00 · 마지막 패널 44.30 = D−0.7). netW 공식이 263.30 을 내는데 실측은 264.30 — 공식이 아니라 **표기차**다. D=45 를 넣으면 netW 264.30 으로 잔차 0.00 이 된다. 규격 표기를 고치는 것은 견적 입력 쪽 일이라 여기서 안 한다" },
};

const OVL_ROW = 0.25, OVL_TOL = 0.5;   // 행 0.25mm · x 정확. 0.5mm² = 잡음 하한

// ── 계측기 ①  폴리라인 → 「재질인가」 판정기 ──────────────────────
//  PDF 폴리라인은 닫힌 링이 아니다(2점짜리 오시선이 섞이고 T 접합으로 끊긴다).
//  그래서 링을 만들지 않고, **바깥에서 채워 들어가는 래스터**로 재질/공백을 가른다.
//  칼선이 아닌 오시선은 안쪽에 있어 채움을 막지 않으므로 저절로 무시된다.
const d2seg = (px, py, a, b) => {
  const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy;
  let t = L > 0 ? ((px - a[0]) * vx + (py - a[1]) * vy) / L : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a[0] + vx * t), py - (a[1] + vy * t));
};

/** 끊긴 끝 붙이기 + 중복 제거.
 *  · 끊긴 끝 = 다른 어떤 선분에서도 0.05mm 이상 떨어진 폴리라인 끝점. 그 끝에서
 *    **가장 가까운 선분 위의 점까지** 짧은 다리를 놓는다(≤3mm 만). 끝점끼리 짝지어
 *    잇는 방식은 틀린다 — 칼선-14 는 모서리 필렛(원호)에 T 로 만나야 하는 두 끝이
 *    0.21 / 0.07mm 떨어져 있고, 그 둘을 서로 이으면 0.76mm 짜리 엉뚱한 다리가 되어
 *    구멍이 그대로 남는다(채움이 2,931mm² 새서 도형이 실물보다 작아진다 = 겹침을 놓친다).
 *  · 3mm 를 넘으면 잇지 않는다 — 도면 끝까지 안 가는 오시선의 끝이 그렇고,
 *    그런 끝은 도형 안쪽이라 채움을 막지 않는다. 진짜 큰 구멍은 아래 누수검사가 잡는다.
 *  · 중복 = 같은 선을 두 번 그은 것(소스코 1건). 구간 판정에서 0 길이 구간을 양산한다. */
function healSegs(polys) {
  const segs = [];
  for (const p of polys) for (let k = 1; k < p.length; k++)
    if (Math.hypot(p[k][0] - p[k-1][0], p[k][1] - p[k-1][1]) > 1e-9) segs.push([p[k-1], p[k]]);
  const ends = [];
  polys.forEach((p, i) => { if (p.length >= 2) { ends.push({ p: p[0], i, e: 0 }); ends.push({ p: p[p.length-1], i, e: 1 }); } });
  const add = [];
  for (const q of ends) {
    let best = Infinity, foot = null;
    polys.forEach((p, i) => { for (let k = 1; k < p.length; k++) {
      if (i === q.i && ((q.e === 0 && k === 1) || (q.e === 1 && k === p.length - 1))) continue;
      const a = p[k-1], b = p[k];
      const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy;
      let t = L > 0 ? ((q.p[0] - a[0]) * vx + (q.p[1] - a[1]) * vy) / L : 0;
      t = Math.max(0, Math.min(1, t));
      const fx = a[0] + vx * t, fy = a[1] + vy * t, d = Math.hypot(q.p[0] - fx, q.p[1] - fy);
      if (d < best) { best = d; foot = [fx, fy]; }
    } });
    if (best > 0.05 && best <= 3.0) add.push([q.p, foot]);
  }
  // ② 끝점끼리 1.0mm 이하로 마주 본 자리도 다리를 놓는다.
  //    릴리프 슬릿(날개 사이 0.5~0.76mm 틈)의 **끝단 마감선이 도면에 없는** 목형이 있다.
  //    칼선-14 가 그렇다 — y=13.66 과 y=93.66 의 가로 칼선이 x 67.63 / 68.13 에서
  //    각각 끊겨 0.50mm 가 비어 있고, 두 끝점은 저마다 자기 이웃과 이어져 있어
  //    ①의 「끊긴 끝」에 잡히지 않는다. 그 0.50mm 구멍으로 채움이 들어가 **몸통 한 칸
  //    통째(123×80mm)** 가 공백으로 읽혔다(채움 21,189 → 18,628mm²).
  //    ⚠ 1.0mm 이하 다리는 도형을 **크게만** 만든다 = 안전 방향이다. 그래서 이 규칙은
  //      겹침을 지어내지언정 놓치지는 않는다(반대 방향이면 넣으면 안 된다).
  for (let i = 0; i < ends.length; i++) for (let j = i + 1; j < ends.length; j++) {
    const d = Math.hypot(ends[i].p[0] - ends[j].p[0], ends[i].p[1] - ends[j].p[1]);
    if (d < 1e-6 || d > 1.0) continue;
    add.push([ends[i].p, ends[j].p]);
  }
  const all = segs.concat(add), seen = new Set(), uniq = [];
  const q5 = v => Math.round(v / 0.005);
  for (const [a, b] of all) {
    const ka = `${q5(a[0])},${q5(a[1])}`, kb = `${q5(b[0])},${q5(b[1])}`;
    const key = ka < kb ? ka + "|" + kb : kb + "|" + ka;
    if (seen.has(key)) continue;
    seen.add(key); uniq.push([a, b]);
  }
  return { segs: uniq, healed: add, dup: all.length - uniq.length };
}

/** 바깥에서 채워 들어가는 래스터. 반환 isOut(x,y) 는 「바깥인가」. */
function buildMask(segs, step, dilate = 0) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [a, b] of segs) for (const p of [a, b]) {
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
  }
  const M = 3, nx = Math.ceil((x1 - x0) / step) + 2 * M + 1, ny = Math.ceil((y1 - y0) / step) + 2 * M + 1;
  let wall = new Uint8Array(nx * ny);
  const ci = x => Math.floor((x - x0) / step) + M, cj = y => Math.floor((y - y0) / step) + M;
  for (const [a, b] of segs) {
    const n = Math.max(2, Math.ceil(Math.hypot(b[0]-a[0], b[1]-a[1]) / (step * 0.25)));
    for (let k = 0; k <= n; k++) {
      const t = k / n, i = ci(a[0] + (b[0]-a[0]) * t), j = cj(a[1] + (b[1]-a[1]) * t);
      if (i >= 0 && i < nx && j >= 0 && j < ny) wall[j * nx + i] = 1;
    }
  }
  for (let d = 0; d < dilate; d++) {
    const w2 = wall.slice();
    for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) if (wall[j*nx+i]) {
      w2[j*nx+i-1] = 1; w2[j*nx+i+1] = 1; w2[(j-1)*nx+i] = 1; w2[(j+1)*nx+i] = 1;
    }
    wall = w2;
  }
  const out = new Uint8Array(nx * ny), st = [0]; out[0] = 1;
  while (st.length) {
    const c = st.pop(), i = c % nx, j = (c - i) / nx;
    for (const [p, q] of [[i-1,j],[i+1,j],[i,j-1],[i,j+1]]) {
      if (p < 0 || p >= nx || q < 0 || q >= ny) continue;
      const d = q * nx + p; if (out[d] || wall[d]) continue;
      out[d] = 1; st.push(d);
    }
  }
  let area = 0; for (let k = 0; k < nx * ny; k++) if (!out[k]) area++;
  return { area: area * step * step,
    isOut: (x, y) => { const i = ci(x), j = cj(y); return (i < 0 || i >= nx || j < 0 || j >= ny) ? 1 : out[j*nx+i]; } };
}

// ── 계측기 ②  「실물 한 장」 만들기 (PDF → 로컬 좌표 선분 + 재질 판정기) ──
//
//  ★ 프레임 정렬 — 이걸 안 하면 도형은 맞는데 **패널 순서가 뒤집힌 채** 얹힌다.
//    모델 프레임(geometry.xEdges)은 x 로 [D2, W2, D1, W1, 탭] 이고 y=0 이 **위 띠**다.
//    도면은 y 가 위로 가고 위 띠가 큰 y 쪽이며, 탭은 목형마다 좌/우가 갈린다
//    (세로 크리스 실측: 왼쪽 10벌 / 오른쪽 2벌 — 뉴로티엑스, 칼선-14(눕힌 뒤)).
//    ⟹ y 는 **항상** 뒤집고, 탭이 왼쪽인 목형은 x 도 거울로 뒤집는다.
//    ⚠ 이걸 빼먹으면 칼선공유(맞대기) 배치에서는 0.00 이 그대로 나와서 안 들킨다.
//      맞물림 배치가 하나 생기는 순간 뚜껑과 빈 슬롯의 자리가 뒤바뀌어 8,004mm² 같은
//      **가짜 겹침**이 나온다(t=18.0 로 바꾸자 바이오머가 정확히 그렇게 됐다).
const rot90Segs = (segs, h) => segs.map(([a, b]) => [[h - a[1], a[0]], [h - b[1], b[0]]]);
const mapSegs = (segs, f) => segs.map(([a, b]) => [f(a), f(b)]);
async function realFromPdf(o) {
  if (!fs.existsSync(o.pdf)) return { no: `PDF 없음 — ${o.pdf}` };
  let r;
  try { r = await readDieline(new Uint8Array(fs.readFileSync(o.pdf)), { source: o.n, page: o.page, maxCandidates: 20 }); }
  catch (e) { return { no: `readDieline 실패 — ${e.message}` }; }
  const c = r.candidates.find(k => Math.abs(k.bbox.w - o.bbox[0]) < 0.05 && Math.abs(k.bbox.h - o.bbox[1]) < 0.05);
  if (!c) return { no: `후보 ${r.candidates.length}개에 실측 bbox ${o.bbox[0]}×${o.bbox[1]} 이 없다 (1순위 ${r.bbox.w}×${r.bbox.h})` };
  const H = healSegs(c.polygons);
  let segs = H.segs.map(([a, b]) => [[a[0] - c.bbox.x0, a[1] - c.bbox.y0], [b[0] - c.bbox.x0, b[1] - c.bbox.y0]]);
  if (o.rot90) segs = rot90Segs(segs, c.bbox.h);          // 도면이 눕어 있으면 세운다
  const w = o.rot90 ? c.bbox.h : c.bbox.w, h = o.rot90 ? c.bbox.w : c.bbox.h;
  if (o.tabLeft) segs = mapSegs(segs, ([x, y]) => [w - x, y]);   // 탭을 오른쪽으로
  segs = mapSegs(segs, ([x, y]) => [x, h - y]);                  // 위 띠를 y=0 쪽으로
  // 누수 자기검사 — **거친 격자(0.5) vs 고운 격자(0.25)** 로 잰다.
  //   폭 g 인 구멍은 칸이 g 보다 크면 벽이 두꺼워 막히고, 작으면 뚫린다. 그래서
  //   거친 쪽이 크게 나오면 그 사이 폭의 구멍이 있다는 뜻이다. 구멍이 있으면 채움이
  //   새서 도형이 실물보다 **작아지고**, 그건 겹침을 놓치는 방향이라 진실로 못 쓴다.
  //   ⚠ 「벽 팽창」으로 재면 안 된다 — 팽창은 둘레 × 팽창폭 만큼 무조건 늘어서
  //     둘레가 긴 납작한 목형(칼선-14)이 구멍이 없어도 +15% 로 찍힌다.
  //   실측 분리도: 정상 11벌 +0.11~0.63% vs 구멍 있던 칼선-14 +13.7%.
  const mk = buildMask(segs, 0.25), coarse = buildMask(segs, 0.5);
  const leak = (coarse.area - mk.area) / mk.area * 100;
  if (leak > 3) return { no: `폴리라인 누수 ${leak.toFixed(1)}% (0.5mm 격자 대비 0.25mm 격자에서 채움이 그만큼 샌다 — 도형이 실물보다 작다)` };
  return { segs, w, h, mask: mk, leak, heal: H, fillPct: mk.area / (w * h) * 100 };
}

/** 자세 변환 — nest.placedPieces 규약을 그대로 재현한다.
 *  x,y 는 **발자국 bbox 의 좌상단**이고, rotated 는 rot90 후 원점 정규화,
 *  flipped 는 자기 bbox 중심 점대칭이다(nest.preparePart 의 reflect).
 *  ⚠ 실물 bbox 는 모델 netW×netH 와 다르다 — 같은 모서리에 앉힌다는 규약만 공유한다. */
function placeReal(R, box, scale = 1) {
  const { w, h } = R;
  const pw = box.rotated ? h : w, ph = box.rotated ? w : h;
  const cx = w / 2, cy = h / 2;
  const fwd = ([x, y]) => {
    let X = cx + (x - cx) * scale, Y = cy + (y - cy) * scale;
    let a, b;
    if (box.rotated) { a = h - Y; b = X; } else { a = X; b = Y; }
    if (box.flipped) { a = pw - a; b = ph - b; }
    return [a + box.x, b + box.y];
  };
  const inv = (X, Y) => {
    let a = X - box.x, b = Y - box.y;
    if (box.flipped) { a = pw - a; b = ph - b; }
    let x, y;
    if (box.rotated) { x = b; y = h - a; } else { x = a; y = b; }
    return [cx + (x - cx) / scale, cy + (y - cy) / scale];
  };
  const segs = R.segs.map(([a, b]) => [fwd(a), fwd(b)]);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [a, b] of segs) for (const p of [a, b]) {
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
    if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
  }
  // y 버킷 — 행마다 전 선분을 훑으면 판형 10종 × 목형 12벌이 분 단위가 된다
  const BH = 4, nb = Math.max(1, Math.ceil((y1 - y0) / BH) + 1), bucket = Array.from({ length: nb }, () => []);
  segs.forEach((s, i) => {
    const lo = Math.max(0, Math.floor((Math.min(s[0][1], s[1][1]) - y0) / BH));
    const hi = Math.min(nb - 1, Math.floor((Math.max(s[0][1], s[1][1]) - y0) / BH));
    for (let k = lo; k <= hi; k++) bucket[k].push(i);
  });
  return { segs, bucket, BH, bb: { x0, y0, x1, y1 },
    material: (X, Y) => { const [x, y] = inv(X, Y); return !R.mask.isOut(x, y); } };
}

/** 행 y 의 **재질 구간 전부**. x 는 근사하지 않는다(교차점을 직접 푼다).
 *  ⚠ 창(window)으로 미리 자르지 마라 — 잘린 조각의 중점이 도형 **바깥 0.25mm** 에
 *    떨어지면 래스터 벽 두께 때문에 「재질」로 읽힌다. 그러면 딱 붙은 이웃끼리
 *    가짜 겹침이 생긴다(모델 재측정 자기검사②가 바이오머 4×64 에서 3.58mm² 로 잡았다).
 *    구간을 도형 전폭에서 만들면 중점이 반드시 진짜 안/밖에 떨어진다. 자르기는 나중에. */
function spansAt(S, y) {
  const bi = Math.floor((y - S.bb.y0) / S.BH);
  const idx = (bi >= 0 && bi < S.bucket.length) ? S.bucket[bi] : [];
  const xs = [];
  for (const i of idx) {
    const [[xi, yi], [xj, yj]] = S.segs[i];
    if ((yi > y) === (yj > y)) continue;
    xs.push(xi + (xj - xi) * (y - yi) / (yj - yi));
  }
  if (xs.length < 2) return [];
  xs.sort((p, q) => p - q);
  const out = [];
  for (let i = 0; i + 1 < xs.length; i++) {
    const a = xs[i], b = xs[i + 1];
    if (b - a < 1e-9) continue;
    if (!S.material((a + b) / 2, y)) continue;
    if (out.length && a - out[out.length - 1][1] < 1e-9) out[out.length - 1][1] = b;
    else out.push([a, b]);
  }
  return out;
}
/** 두 구간열의 교집합 길이. [wx0,wx1] 로 자르는 것은 **여기서** 한다. */
const interLen = (A, B, wx0, wx1) => {
  let i = 0, j = 0, s = 0;
  while (i < A.length && j < B.length) {
    const lo = Math.max(A[i][0], B[j][0], wx0), hi = Math.min(A[i][1], B[j][1], wx1);
    if (hi > lo) s += hi - lo;
    if (A[i][1] < B[j][1]) i++; else j++;
  }
  return s;
};
/** 배치된 실물끼리의 최대 겹침 면적(mm²) */
function maxOverlap(placed, row = OVL_ROW) {
  let max = 0;
  for (let a = 0; a < placed.length; a++) for (let b = a + 1; b < placed.length; b++) {
    const A = placed[a].bb, B = placed[b].bb;
    const x0 = Math.max(A.x0, B.x0), x1 = Math.min(A.x1, B.x1);
    const y0 = Math.max(A.y0, B.y0), y1 = Math.min(A.y1, B.y1);
    if (x1 <= x0 + 1e-9 || y1 <= y0 + 1e-9) continue;
    let area = 0;
    for (let y = y0 + row / 2; y < y1; y += row)
      area += interLen(spansAt(placed[a], y), spansAt(placed[b], y), x0, x1);
    area *= row;
    if (area > max) max = area;
  }
  return max;
}
// ⑦ layout.cells 가 아니라 **layout.boxes** 를 읽는다. cells 에는 자세(rotated)가 없어
//   격자(자세 균일)에서는 우연히 맞지만 자유배치·손배치에 겨누는 순간 조용히 틀린다
//   (같은 배치를 boxes 로 복원하면 0.00, cells 로 복원하면 9,357mm² 가 나왔다).
const stampOn = (R, L, scale = 1) => L.boxes.map(b => placeReal(R, b, scale));

// ── ★ y 자세 확정 — 「위 띠가 y=0 쪽」을 **단정하지 말고 측정한다** ──────────
//
//  26-08-19 발견. realFromPdf 는 `h − y` 한 줄로 항상 뒤집고 「도면은 y 가 위로 가고
//  위 띠가 큰 y 쪽」이라고 단정했다. **그 단정이 틀린 목형이 있다** — 자동바닥 도면은
//  작은 띠(위 띠)를 페이지 아래쪽에 두고 그린 것이 흔하다. 틀리면 실물이 통째로 180°
//  뒤집힌 채 얹힌다. 위·아래 띠가 다른 glue3·cross 에서는 그게 곧 「뚜껑과 빈 슬롯의
//  자리 바뀜」이고, 겹침 게이트가 재는 숫자가 통째로 다른 도형의 것이 된다.
//    실측 반증(웨이크A, 열 스캔): 종전 자세에서 idx0 실물 y 38~222 · 모델 0~196 →
//    26mm 부족으로 읽혔다. 뒤집으면 실물 12~196 으로 모델과 **정확히** 맞는다
//    (오라클 top[0]=23 · bot[0]=23 그대로). idx3 도 61~231.9 → 2.1~173 = top 35 · bot 0 ✓.
//  ⚠ 맞뚜껑은 위·아래가 대칭이라 이 오류를 **원리적으로 못 드러낸다.** 종전 자세 검증이
//    바이오머로 이뤄진 것이 그래서 위험했다(대칭 표본으로 비대칭 규칙을 확인한 셈).
//
//  판정에 **모델을 쓰지 않는다** — 오라클의 손실측 날개 깊이 top[]/bot[] 만 쓴다.
//  올바른 자세라면 패널 i 의 「위쪽 여백」 = 위띠최대 − top[i], 「아래쪽 여백」 =
//  아래띠최대 − bot[i] 다. 네 몸통 패널의 중앙 열에서 실물 외곽 y 를 재서 두 자세의
//  총 오차를 비교하고 작은 쪽을 고른다. 대칭 구조(맞뚜껑)는 동점이 되고 그때는 유지한다
//  — 동점이라는 것은 자세가 결과에 영향이 없다는 뜻이라 안전하다.
//  ⚠ 「전폭 몸통 행」으로 판정하려던 첫 시도는 **실패했다**(기록으로 남긴다):
//    접착탭이 몸통보다 짧고 모따기가 커서 전폭 행이 몸통보다 4~12mm 짧게 잡힌다
//    (웨이크A 126.00 vs H 138). 그 오차가 판정 문턱보다 커서 12벌 중 10벌이
//    「진실 없음」으로 떨어졌다. 탭을 빼고 재면 이번엔 십자의 아래 띠(네 날개 전폭)가
//    몸통과 구분되지 않는다. 몸통은 이 판정의 기준이 될 수 없다.
const colExtent = (segs, x) => {
  let lo = Infinity, hi = -Infinity;
  for (const [[xi, yi], [xj, yj]] of segs) {
    if ((xi > x) === (xj > x)) continue;
    const y = yi + (yj - yi) * (x - xi) / (xj - xi);
    if (y < lo) lo = y; if (y > hi) hi = y;
  }
  return lo <= hi ? [lo, hi] : null;
};
function resolveY(o, R) {
  const dp = dielinePieces(o.W, o.D, o.H, o.id);
  const tB = Math.max(...o.top.filter(v => v !== null));
  const bB = Math.max(...o.bot.filter(v => v !== null));
  let sK = 0, sF = 0, n = 0; const rows = [];
  for (let i = 0; i < 4; i++) {
    const p = dp.panels?.find(q => q.i === i);
    if (!p || o.top[i] === null || o.bot[i] === null) continue;
    const e = colExtent(R.segs, (p.x0 + p.x1) / 2); if (!e) continue;
    const a = e[0], b = R.h - e[1];              // 실측 위쪽/아래쪽 여백
    const pa = tB - o.top[i], pb = bB - o.bot[i]; // 올바른 자세에서 기대되는 여백
    sK += Math.abs(a - pa) + Math.abs(b - pb);
    sF += Math.abs(b - pa) + Math.abs(a - pb);
    n += 2;
    rows.push(`idx${i} ${a.toFixed(1)}/${b.toFixed(1)}←${pa.toFixed(1)}/${pb.toFixed(1)}`);
  }
  if (!n) return { no: "몸통 패널 중앙 열에서 실물 외곽을 못 읽었다" };
  // ★ 판정은 **분리도**로 한다. 절대 정확도로 자르면 안 된다 —
  //   중앙 열 하나만 보므로 노치가 하필 중앙에 오는 목형(니치어 idx2)은 절대오차가
  //   4.94mm 까지 뜬다. 그런데 반대 자세는 41.56mm 라 **결론은 전혀 흔들리지 않는다.**
  //   절대 문턱 4.0 으로 잘랐더니 그 한 벌이 통째로 「진실 없음」이 됐다(실패 이력).
  //   0.5mm/칸 안쪽으로 붙으면 자세가 결과에 영향이 없다는 뜻이라 유지한다(대칭 구조).
  const eK = sK / n, eF = sF / n, sep = Math.abs(eK - eF);
  const use = sF < sK && sep >= 0.5;
  const d = Math.min(eK, eF);
  const info = `여백오차 유지 ${eK.toFixed(2)} / 뒤집음 ${eF.toFixed(2)} mm/칸 (분리 ${sep.toFixed(2)})  [${rows.join(" ")}]`;
  if (sep >= 0.5 && d > 8.0) return { no: `어느 자세도 오라클 날개 실측과 안 맞는다 (평균 ${d.toFixed(2)}mm) — ${info}` };
  if (use) {                                             // 실물을 뒤집는다 (마스크 조회도 같이)
    R.segs = R.segs.map(([a, b]) => [[a[0], R.h - a[1]], [b[0], R.h - b[1]]]);
    const m0 = R.mask;
    R.mask = { area: m0.area, isOut: (x, y) => m0.isOut(x, R.h - y) };
  }
  return { flipped: use, d, info };
}

// ── 진실 적재 ─────────────────────────────────────────────────────
console.log("\n═══ 실물 겹침 게이트 — 진실 = 원본 칼선 PDF 폴리라인 · 두 열(목형 지정/기본값) ═══");
const TRUTH = new Map(); const NO_TRUTH = [], YFRAME = new Map();
for (const o of ORACLE) {
  const R = await realFromPdf(o);
  if (R.no) { NO_TRUTH.push([o.n, R.no]); continue; }
  const y = resolveY(o, R);
  if (y.no) { NO_TRUTH.push([o.n, `y 자세 확정 실패 — ${y.no}`]); continue; }
  YFRAME.set(o.n, y);
  TRUTH.set(o.n, R);
}
console.log(`  진실 적재 ${TRUTH.size}/${ORACLE.length}벌` +
            (NO_TRUTH.length ? `  · 진실 없음 ${NO_TRUTH.length}벌` : ""));
for (const [n, why] of NO_TRUTH) console.log(`  ✗ ${n.padEnd(10)} 진실 없음 — ${why}`);
for (const o of ORACLE) {
  const R = TRUTH.get(o.n); if (!R) continue;
  const hl = R.heal.healed.map(s => Math.hypot(s[0][0]-s[1][0], s[0][1]-s[1][1]));
  console.log(`    ${o.n.padEnd(10)} ${R.w.toFixed(2)}×${R.h.toFixed(2)}mm  선분 ${String(R.segs.length).padStart(4)}` +
    `  채움 ${R.fillPct.toFixed(1)}%  누수검사 +${R.leak.toFixed(2)}%` +
    (hl.length ? `  이음 ${String(hl.length).padStart(3)}건 최대 ${Math.max(...hl).toFixed(2)}mm` : "") +
    (R.heal.dup ? `  중복제거 ${R.heal.dup}` : ""));
}
// y 자세는 **측정 결과**다 — 어느 목형을 뒤집었는지 화면에 남긴다(위 resolveY 참조).
{
  const fl = [...YFRAME].filter(([, v]) => v.flipped).map(([n]) => n);
  console.log(`  y 자세: 뒤집은 목형 ${fl.length}/${YFRAME.size}벌` + (fl.length ? ` — ${fl.join(" ")}` : "") +
              `  (판정 = 오라클 날개 실측 ↔ 패널 중앙 열 여백. 위·아래 대칭 구조는 동점이라 유지)`);
  for (const [n, v] of YFRAME) console.log(`    ${n.padEnd(10)} ${v.flipped ? "뒤집음" : "유지  "} Δ${v.d.toFixed(2)}mm  ${v.info}`);
}

// ⑥ 「자동 선택 판형에서 겹치는가」 — 수동 선택 겹침과 급이 다르다.
//    앱 실경로(findBestSheet)가 실제로 고르는 판형을 수량·지종별로 모아 표시한다.
const AUTO_QTY = [1000, 4000, 10000, 30000];
const AUTO_PAPER = [DEFAULT_PAPER.id, "AB350"];
function autoSheetsOf(o, dieOpt = {}) {
  // ⚠ dieOpt 를 buildDieline 에 그대로 넘긴다 — 앱 실경로가 목형 옵션을 받는 통로가
  //   `box.dieOpt` 하나이고, 그걸 빼면 「기본 도형으로 고른 판형」에 「목형 도형」을
  //   얹어 재는 짝이 안 맞는 측정이 된다.
  const dl = buildDieline({ mode: "box", W: o.W, D: o.D, H: o.H, structure: o.id, hangTab: 0, dieOpt });
  const set = new Map();
  if (!dl) return set;
  for (const qty of AUTO_QTY) for (const paperId of AUTO_PAPER) {
    const s = findBestSheet({ dieline: dl, qty, sheetIdHint: "auto", paperId, manualPrice: "", lossOpts: {} });
    if (s?.id) set.set(s.id, `${(set.get(s.id) ? set.get(s.id) + " " : "")}${qty}ea/${paperId}`);
  }
  return set;
}

// 계측기 자기검사 ② — **모델 폴리곤을 같은 방법으로 재면 반드시 0.00 이어야 한다.**
//   nest 가 보증하는 값이 0 이므로, 여기서 0 이 아니면 틀린 것은 모델이 아니라 이 계측기다
//   (자세 변환·프레임 정렬·구간 판정 중 하나). 실물 숫자를 믿기 전에 이 줄부터 봐라.
function modelTruth(dp) {
  const segs = [];
  for (const p of dp.pieces) for (let i = 0; i < p.length; i++)
    segs.push([p[i], p[(i + 1) % p.length]]);
  return { segs, w: dp.net.netW, h: dp.net.netH, mask: buildMask(segs, 0.25) };
}
{
  // ★ 두 모드 다 검사한다 — 목형 옵션이 들어간 폴리곤은 **다른 도형**이라, 기본 도형에서
  //   0.00 이었다는 것이 옵션 도형에서도 0.00 이라는 보증이 전혀 아니다.
  let bad = 0, worst = 0, worstAt = "";
  for (const o of ORACLE) for (const md of MODES) {
    const opt = md.of(o);
    if (md.k === "die" && !Object.keys(opt).length) continue;   // 기본값 열과 같은 계산
    const dp = dpOf(o, opt), M = modelTruth(dp);
    for (const s of BASE_SHEETS.filter(k => !k.custom)) {
      const L = solveImposition({ dieline: { key: ovlKey(o, opt), net: dp.net, pieces: dp.pieces, polygon: true, noRotate: false }, sheet: { w: s.w, h: s.h } });
      if (!L?.up) continue;
      const m = maxOverlap(stampOn(M, L));
      if (m > worst) { worst = m; worstAt = `${o.n}/${md.label} @${s.id}`; }
      if (m > OVL_TOL) bad++;
    }
  }
  check("겹침 계측기 자기검사 ② (모델 재측정 = 0)", 0, worst, OVL_TOL, null);
  console.log(`  자기검사②: 모델 폴리곤을 같은 계측기로 재측정(두 모드) → 최대 ${worst.toFixed(2)}mm²` +
    (worst > OVL_TOL ? ` @${worstAt} (${bad}조합)  ✗ **계측기가 틀렸다** — 실물 숫자를 믿지 마라` : "  ✓ nest 가 보증한 0 과 일치"));
}

{ // 계측기 자기검사 — 이빨이 없으면 아래 0.00 은 아무 뜻이 없다
  const o = ORACLE.find(k => TRUTH.has(k.n));
  // ★ 26-08-26 — 진실이 0 벌인 것은 **검사 실패가 아니라 미실행**이다.
  //   종전에는 여기서 무조건 FAIL 을 넣었고 그 FAIL 이 ALLOW_SKIP 면제를 안 받아
  //   **CI 가 통째로 빨개졌다**(오라클 8건은 고객사 도면이라 git 에 없다).
  //   ARCHITECTURE 가 「CI 경로는 안 돌렸다」로 남겨 둔 미해결이 실제로 터진 자리다.
  //   면제는 ALLOW_SKIP 일 때만 — 개발 PC 에서 오라클이 사라지면 여전히 빨개져야 한다
  //   (그때는 「도면을 못 찾는다」가 진짜 문제다).
  if (!o) {
    if (ALLOW_SKIP) console.log("  ⚠ 겹침 계측기 자기검사 **미실행 — 점수 아님** (진실 0벌 · PDF_ALLOW_SKIP=1)");
    else { check("겹침 계측기 자기검사", 1, 0, 0.5, null); console.log("  ✗ 자기검사 불가 — 진실이 한 벌도 없다"); }
  }
  else {
    const R = TRUTH.get(o.n), dp = dpOf(o, optOfDie(o));
    const L = solveImposition({ dieline: { key: `ovlSelf|${o.id}|${optStr(optOfDie(o))}`, net: dp.net, pieces: dp.pieces, polygon: true, noRotate: false }, sheet: { w: 788, h: 545 } });
    const a = maxOverlap(stampOn(R, L)), b = maxOverlap(stampOn(R, L, 1.02));
    check("겹침 계측기 자기검사", 1, b > 1 && a <= OVL_TOL ? 1 : 0, 0.5, null);
    console.log(`  자기검사(${o.n}): 원본 ${a.toFixed(2)}mm² → 같은 배치 2% 확대 ${b.toFixed(2)}mm²  ` +
                (b > 1 && a <= OVL_TOL ? "✓ 이빨 있음" : "✗ 계측기 고장 — 아래 숫자를 믿지 마라"));
  }
}

const SHEETS = BASE_SHEETS.filter(s => !s.custom);
/** 한 목형 · 한 옵션으로 표준판형 10종을 전부 재고, 최악값과 「자동선택 판형에서의 최악」을 낸다. */
function ovlScan(o, R, opt) {
  const dp = dpOf(o, opt), auto = autoSheetsOf(o, opt);
  let rows = 0, worst = 0, worstAt = "", worstAuto = 0, worstAutoAt = "";
  for (const s of SHEETS) {
    const L = solveImposition({ dieline: { key: ovlKey(o, opt), net: dp.net, pieces: dp.pieces, polygon: true, noRotate: false }, sheet: { w: s.w, h: s.h } });
    if (!L?.up) continue;
    rows++;
    const m = maxOverlap(stampOn(R, L));
    const at = `${s.id} ${L.up}up ${L.cols}×${L.rows}${L.rotated ? "↺" : ""}`;
    if (m > worst) { worst = m; worstAt = at; }
    if (auto.has(s.id) && m > worstAuto) { worstAuto = m; worstAutoAt = `${at} ← ${auto.get(s.id)}`; }
  }
  return { rows, worst, worstAt, worstAuto, worstAutoAt };
}
/** ★ 두 열이 **같은 숫자**면 한 번만 채점한다.
 *  왜 — 같은 사실을 두 번 세면 예산 건수가 그냥 두 배가 되어 「예산이 늘었다」로 읽힌다
 *  (예산의 값은 하나도 안 늘었는데). 숫자가 갈리는 순간 자동으로 두 줄로 갈라지므로
 *  감시력은 잃지 않는다 — 갈림 자체가 「옵션이 도형을 바꿨다」는 신호다. */
const tie2 = (a, b, ...ks) => ks.every(k => Math.abs(a[k] - b[k]) < 1e-9);

let ovlRows = 0, ovlBad = 0, autoBad = 0; const ovlKnown = [];
console.log("");
console.log("목형        옵션(목형 지정)        목형 지정 최대   기본값 최대   ← 기본값은 목형을 **모르는** 사용자가 받는 도형");
console.log("-".repeat(118));
for (const o of ORACLE) {
  const R = TRUTH.get(o.n);
  if (!R) { console.log(`  – ${o.n.padEnd(10)} 진실 없음 — 게이트에서 제외 (위 사유 참조)`); continue; }
  const dopt = optOfDie(o), same = !Object.keys(dopt).length;
  const def = ovlScan(o, R, {});
  const die = same ? def : ovlScan(o, R, dopt);       // 옵션이 없으면 같은 계산이다
  ovlRows += def.rows + (same ? 0 : die.rows);
  const budget = KNOWN_OVERLAP[o.n];
  // ★ 기본값 열도 **점수다.** 예산으로 덮지 않는다 — 기본값이 겹치면 목형을 모르는
  //   사용자가 물리적으로 불가능한 판을 받는다. 예산은 KNOWN_OVERLAP 한 벌뿐이고
  //   (칼선-14: 발주 표기차) 그 목형은 애초에 옵션이 없어 두 열이 같은 도형이다.
  const tie = same || tie2(die, def, "worst", "worstAuto");
  const cols = tie ? [["두 열 동일", die]] : [["목형 지정", die], ["기본값", def]];
  let line = "", ok = true;
  for (const [label, sc] of cols) {
    const known = budget && sc.worst <= budget.max ? budget.why : null;
    const hit = check(`실물 겹침 ${o.n} · ${label}`, 0, sc.worst, OVL_TOL, known);
    if (!hit && !known) { ovlBad++; ok = false; }
    if (sc.worstAuto > OVL_TOL) autoBad++;
    if (known && sc.worst > OVL_TOL) ovlKnown.push([o.n, sc.worst, sc.worstAt, budget.why]);
    if (sc.worst > OVL_TOL) line += `\n      ${label} ${sc.worst.toFixed(2)}mm² @${sc.worstAt}` +
      (known ? `  (기존 · 예산 ${budget.max})` : "  ★신규");
    if (sc.worstAuto > OVL_TOL) line += `\n      ★자동(${label}) ${sc.worstAuto.toFixed(2)}mm² @${sc.worstAutoAt}  ← 견적 실경로가 이 판을 고른다`;
  }
  const src = dieSrcOf(o.id, o.W, o.D, o.H);
  console.log(`  ${ok || budget ? "✓" : "✗"} ${o.n.padEnd(10)}${(optStr(dopt) + (src ? `(${src})` : "")).padEnd(22)}` +
    `${die.worst.toFixed(2).padStart(11)}mm²${def.worst.toFixed(2).padStart(13)}mm²` +
    (same ? "   (옵션 없음 = 두 열 같은 도형)" : tie ? "   (두 열 동값)" : "   ★두 열이 갈렸다") + line);
}
console.log(`  판형 조합 ${ovlRows}건 · 신규 겹침 ${ovlBad}건 · **자동선택 판형에서 겹치는 목형·모드 ${autoBad}건**`);
for (const [n, mm, at, why] of ovlKnown)
  console.log(`  ⚠ ${n} ${mm.toFixed(2)}mm² @${at} — 원인이 특정된 미해결 건: ${why}`);

// ══════════════════════════════════════════════════════════════════
//  ★ 실측 자세 열 — 「목형표가 **일부러 안 싣는** 옵션」을 계량한다
//
//  왜 필요한가
//  ──────────
//  위 두 열은 「앱이 내는 도형」만 본다. 그런데 소스코·칼선-14 는 **실측이 near 인데**
//  die-profiles.mjs 가 그 값을 일부러 비워 뒀다(그 파일 ⚠ 두 자리). 비운 이유는
//  「near 를 켜면 모델의 **다른 곳**이 실물을 못 덮어서 오히려 겹친다」이고, 그 근거는
//  지금까지 **주석 안의 숫자**로만 존재했다. 주석 안의 숫자는 늙는다.
//  ⟹ 그 숫자를 여기서 매번 다시 잰다. 이건 우리 겹침에 대한 **예산이 아니다** —
//    픽스처가 적어 둔 근거가 아직 사실인지 보는 **주장 검사**이고, 그래서 **양방향**으로
//    실패한다:
//      · 값이 커지면   → 미룬 대가가 커졌다. 조사할 일이다.
//      · 값이 0 이 되면 → 미룰 이유가 사라졌다. **목형표에 near 를 실어라**
//                        (그러면 견적서 up 재현이 그만큼 올라간다 — 지금 기준선이 그것이다).
//  ★ 절대선과의 관계 — 「실측 목형은 자기 옵션으로 실물 겹침 0」이 견적서 재현보다 위다.
//    소스코를 near 로 켜면 겹치므로, 켤 수 없는 것은 견적서 탓이 아니라 **모델의 다른 값**
//    (얕은 쪽 dust · 접착탭 날개 결손)이 틀렸다는 신호다. 아래 why 가 그 자리를 가리킨다.
const WITHHELD = [
  // ★ 26-08-25(2차) — max 에 **계측 잡음 폭**을 명시적으로 얹었다.
  //   이 게이트는 `sc.worst > max` 를 「커졌다 = 조사할 일」로 읽는 **양방향** 실패라
  //   숫자가 한 벌의 계측기에만 맞춰져 있으면 격자만 바꿔도 빨간불이 된다.
  //   실제로 갈렸다 — 같은 자세를 독립 계측기(0.2mm 2D 격자)로 재면
  //     소스코  41.64mm² (내 0.25mm 행 스캔 52.0 보다 **작다**)
  //     칼선-14 401.32mm² (내 값 398.0 보다 **+3.3 크다** = +0.8%)
  //   ⟹ max 는 「두 계측기가 다 들어오는 상한」으로 잡는다. 근거를 why 에 남긴다.
  //   ⚠ 이건 우리 겹침에 대한 **예산이 아니다.** 「픽스처가 적어 둔 근거가 아직
  //     사실인가」를 보는 주장 검사이고, 잡음 폭은 그 주장의 해상도일 뿐이다.
  { n:"소스코",  opt:{ deepFlap:"near" }, max: 60.0, why:
    "얕은 쪽 dust = min(W,b)/2 = 29.0 이 실측 W2 30.0 에 **1.0mm 부족**하다. " +
    "소스코 아래 띠는 [D2 29.0, W2 30.0, D1 29.0, W1 58.0] 로 「한쪽만 깊다」가 아니라 " +
    "**얕은 쪽에도 30.0 이 있는** 형태다. 고칠 자리는 deepFlap 이 아니라 얕은 쪽 깊이 공식. " +
    "계측: 이 스위트 52.0 / 독립 2D 격자 41.64 — max 60.0 은 둘 다 담는 상한이다" },
  { n:"칼선-14", opt:{ deepFlap:"near" }, max: 410.0, why:
    "모델이 **접착탭(idx4)에 아래 날개를 못 그린다**(flaps.top/bot 이 4칸뿐). near 를 켜면 " +
    "@46 에서 맞물림이 열리는데 실물 탭은 몸통 아래로 54.3mm 내려가 있어 그 자리를 문다. " +
    "커버리지 예산 칼선-14(54.3mm)와 **같은 한 건**이다 — 그 결손을 메우면 여기도 같이 닫힌다. " +
    "계측: 이 스위트 398.0 / 독립 2D 격자 401.32(+0.8%) — max 410.0 은 격자 차 ±1% 를 얹은 값이다" },
];
console.log("\n  ── 실측 자세(목형표가 일부러 안 싣는 옵션) — 미루는 대가를 매번 다시 잰다 ──");
for (const w of WITHHELD) {
  const o = ORACLE.find(k => k.n === w.n), R = TRUTH.get(w.n);
  if (!o) { check(`실측 자세 ${w.n}`, 1, 0, 0.5, null); console.log(`  ✗ ${w.n} — 오라클에 없다`); continue; }
  if (!R) { console.log(`  – ${w.n.padEnd(10)} 진실 없음 — 계량 불가`); continue; }
  const sc = ovlScan(o, R, w.opt);
  const grew = sc.worst > w.max + 1e-9, gone = sc.worst <= OVL_TOL;
  // 두 방향 다 실패다. 「같은 값이 유지됨」만 통과다 — 픽스처의 근거가 아직 사실이라는 뜻.
  check(`실측 자세 ${w.n} (${optStr(w.opt)}) 근거 유지`, 0, grew || gone ? 1 : 0, 0.5, null);
  console.log(`  ${grew || gone ? "✗" : "✓"} ${w.n.padEnd(10)}${optStr(w.opt).padEnd(16)}` +
    `겹침 ${sc.worst.toFixed(2).padStart(9)}mm² (기록 ≤${w.max}) @${sc.worstAt || "―"}` +
    (gone ? "\n      ★ **0 이 됐다 — 미룰 이유가 사라졌다.** die-profiles.mjs 에 이 옵션을 실어라(견적서 up 이 오른다)"
     : grew ? "\n      ★ **커졌다** — 미룬 대가가 늘었다. 아래 why 가 가리키는 자리를 조사해라" : ""));
  console.log(`      why: ${w.why}`);
}

// ══════════════════════════════════════════════════════════════════
//  ★ 추정 되먹임 금지 (26-08-25 2차 신설)
//
//  적대검증이 잡은 것 — 픽스처의 **추정 규칙**을 실측 목형에 되먹이면 실물이 겹친다.
//    「십자 미실측 = 실측 5벌 다수결 15.70」 → 니치어 70×70×151.5 에서 1,178.96mm²
//       (국전 6up 3×2 = **앱 자동선택 판형**). 니치어 up 은 15.70 에서도 6 그대로다
//       — 피치만 8.33mm 줄어 겹친다. 「점수가 안 움직였다」가 안전의 증거가 아니다.
//    「glue3 미실측 = far(다수결 3/5)」 → 소스코 2,817.88mm² · 칼선-14 401.32mm².
//       이 파일의 돌연변이표가 **같은 추론**(기본 both → far)을 이미 RED 로 판정한다.
//  ⟹ 규칙은 둘이다.
//    ① 점수에 실리는 노브는 **실측만** 허용한다(src="추정" 금지).
//    ② 그래도 추정을 넣고 싶으면, 그 값을 **같은 구조의 실측 12벌에 되먹여** 겹침 0 을
//       증명해야 한다. 아래 ①루프가 그 증명을 매번 다시 돌린다.
//  이 절은 점수판(verify-net·scorecard-*)의 **정직성 감시자**다 — 저기서 오른 점수가
//  견적서 역산으로 만든 것인지 여기서 잡는다.
//
//  ★★ 26-08-25 (2차·보강) — ②절 「철회된 후보 규칙 상설 시연」을 붙였다.
//  왜 필요한가 — ①루프는 픽스처에 추정 행이 **남아 있을 때만** 돈다. 추정 3행을
//  걷어낸 지금 ①은 「0건」만 찍고 아무것도 재지 않는다. 그러면 이번 사고의 근거 숫자
//  (니치어 1,178.96 · 소스코 2,817.88)가 **주석 안에만** 남는다.
//  이 저장소는 이미 같은 실수를 한 번 했다 — 「실측 자세」 절 머리말이 그 교훈을
//  한 줄로 적어 뒀다: **「주석 안의 숫자는 늙는다.」** 늙은 숫자는 다음 사람에게
//  「그때는 그랬다더라」가 되고, 그러면 같은 추정이 다시 들어온다.
//  ⟹ 철회한 후보 규칙을 **표로 남기고 매번 다시 먹인다.** 이 절이 있었으면 이번
//    추정이 애초에 못 들어왔다. 새 규칙을 만들려면 여기를 통과해야 한다.
//
//  ★ 이 절의 **이빨을 실측했다** (26-08-25 · 손 돌연변이 2건. 위 「겹침 계측기 자기검사」
//    와 같은 규약 — 이빨을 안 재고 초록인 게이트는 게이트가 아니다):
//      ① die-profiles 십자B 를 `{glueTabW:15.70}, src:"추정"` 으로 되돌림
//         → ①루프가 니치어 1,169.30mm² 를 짚고 **exit 1**.
//      ② 같은 값에 라벨만 `src:"미실측"` (= 점수 분모에서 빠져 「점수 아님」으로 위장하는 샛길)
//         → 필터가 `src !== "실측"` 이라 **똑같이 exit 1**.
//    재현 = 그 한 행을 고치고 `node test/verify-imposition.mjs` 를 돌린다.
//    ⚠ 이 표를 돌연변이 게이트(아래 MUT)에 넣지 않은 이유 — MUT 는 겹침을 안 돌린다
//      (그 파일 「목형 12 × 판형 10 × 열스캔 = 분 단위」 주석). 여기가 그 자리다.
// ══════════════════════════════════════════════════════════════════
console.log("\n  ── 추정 되먹임 금지 — 규칙을 실측 목형에 먹여 본다 ──");
{
  /** 한 규칙(opt)을 그 구조의 실측 목형 전부에 먹여 본다. */
  const feed = (id, opt) => {
    const out = [];
    for (const o of ORACLE) {
      if (o.id !== id) continue;
      const R = TRUTH.get(o.n); if (!R) continue;
      out.push([o, ovlScan(o, R, opt)]);
    }
    return out;
  };
  const scLine = (n, opt, sc) =>
    `${n.padEnd(10)}${optStr(opt).padEnd(18)}겹침 ${sc.worst.toFixed(2).padStart(9)}mm² @${sc.worstAt || "―"}` +
    (sc.worstAuto > OVL_TOL
      ? `\n          ★자동선택 판형에서 ${sc.worstAuto.toFixed(2)}mm² @${sc.worstAutoAt}` : "");

  // ── ① 점수에 실린 비실측 노브 — 있으면 되먹여 겹침 0 을 증명해야 한다 ──
  //  ⚠ 필터가 `src === "추정"` 이 아니라 **`src !== "실측"`** 인 이유 — `dieOptOf` 는
  //    src 를 **안 본다.** 「미실측」이라고 적어 놓고 opt 를 채우면 `measuredOnly` 의
  //    분모에서는 빠져(= 「점수 아님」으로 위장) 이 게이트를 피하면서, 겹침 게이트의
  //    「목형 지정」 열과 앱 실경로(box.dieOpt)에는 그 도형이 그대로 들어간다.
  //    라벨만 바꿔서 빠져나가는 길을 막는다.
  const loaded = Object.entries(DIE_TABLE)
    .filter(([, v]) => v.src !== "실측" && Object.keys(v.opt).length);
  check("비실측 노브가 점수에 실려 있지 않다", 0, loaded.length, 0.5, null);
  console.log(`  ${loaded.length ? "✗" : "✓"} 점수에 실린 비실측 노브 ${loaded.length}건` +
    (loaded.length ? ` — ${loaded.map(([k, v]) => `${k}(${v.src})`).join(" · ")}`
                   : "  (전부 실측이거나 미지정)"));
  for (const [key, v] of loaded) {
    for (const [o, sc] of feed(key.split("|")[0], v.opt)) {
      const hit = check(`비실측 되먹임 ${o.n} ← ${optStr(v.opt)}`, 0, sc.worst, OVL_TOL, null);
      console.log(`    ${hit ? "✓" : "✗"} ${scLine(o.n, v.opt, sc)}`);
    }
  }

  // ── ② 철회된 후보 규칙 상설 시연 ────────────────────────────────
  //  seen = 26-08-25 적대검증이 **독립 2D 격자(0.2mm)** 로 읽은 값. 이 스위트는
  //  0.25mm 행 스캔이라 같은 자세에서도 수 % 갈린다(「실측 자세」 절이 그 폭을 기록한다).
  //  ⟹ seen 은 **판정에 안 쓴다.** 판정은 「지금 이 계측기로 재도 RED 인가」 하나다.
  //    seen 은 옆에 찍어 두 계측기가 같은 결론(RED)인지 눈으로 대조하는 용도다.
  const RETIRED = [
    { id:"cross", n:"십자 미실측 = 실측 5벌 다수결 15.70", opt:{ glueTabW: 15.70 },
      seen:{ "니치어": 1178.96 },
      why: "십자B 70×70×55 를 견적서 4up 으로 맞추려고 넣었던 값. 반증은 두 겹이다 — " +
           "① 십자B 와 **W·D 가 같은 유일한 실측 목형**인 니치어 70×70×151.5 의 실측 탭이 " +
           "**24.03** 이다(최근접 실측이 정반대를 가리킨다). ② 그 15.70 을 니치어에 먹이면 " +
           "**앱 자동선택 판형**에서 실물이 겹친다. ⚠ 니치어 up 은 15.70 에서도 6 그대로다 " +
           "— 피치만 8.33mm 줄어 겹친다. **「점수가 안 움직였다」는 안전의 증거가 아니다.**" },
    { id:"glue_3side", n:"glue3 미실측 = 실측 다수결 far(3/5)", opt:{ deepFlap: "far" },
      seen:{ "소스코": 2817.88, "칼선-14": 401.32 },
      why: "LUXEN 130×130×55 를 견적서 2up 으로 맞추려고 넣었던 값. 반증은 세 겹이다 — " +
           "① 같은 5표본을 **W/D 로 갈면 far · H/W 로 갈면 near** 이고 1-feature 규칙 둘이 " +
           "표본을 **둘 다 완벽히 가르면서 반대 답**을 낸다 = 표본이 결정하지 못한다. " +
           "② far 실측 3벌 중 웨이크A·B 는 같은 PDF 2페이지 = 같은 목형족이라 독립 표본은 **2족**뿐이다. " +
           "③ 이 파일의 **돌연변이 게이트가 바로 그 추론**(기본 both → far)을 소스코 −29.00mm 로 " +
           "RED 판정한다 — 기본값에서 위험하다고 증명해 놓고 한 목형에만 점수용으로 허용할 수는 없다." },
  ];
  console.log("\n  ── 철회된 후보 규칙 — 「채택했다면 어땠는가」를 매번 다시 잰다 ──");
  let redAll = 0;
  for (const c of RETIRED) {
    const rows = feed(c.id, c.opt);
    const bad = rows.filter(([, sc]) => sc.worst > OVL_TOL);
    // ★ 양방향 게이트다 — RED 유지만 통과다.
    //   · RED 유지  → 철회 근거가 아직 사실이다. 통과.
    //   · 겹침 0 됨 → 모델이 바뀌어 **이 절의 반증이 사라졌다.** 조사할 일이다.
    //     ⚠ 겹침이 0 이 돼도 그 자체로 채택 근거는 아니다 — 이 규칙들이 철회된 1차 사유는
    //       「원본 도면이 없다」이고, 겹침은 그 위에 얹힌 2차 반증일 뿐이다. 채택 조건은
    //       여전히 **원본 칼선 PDF 를 ORACLE 에 넣고 그 값으로 재는 것** 하나다.
    // ★ 26-08-26 — 진실이 0 벌이면 「겹침 0」은 **반증이 사라진 것이 아니라 안 잰 것**이다.
    //   종전에는 그걸 구분 못 해 CI(오라클 없음)에서 이 절이 통째로 빨개졌다.
    //   rows 가 비었는지로 가른다 — 잰 목형이 하나도 없으면 판정을 미룬다.
    if (!rows.length) {
      if (ALLOW_SKIP) { console.log(`  ⚠ ${c.n}   ← **미실행 — 점수 아님** (진실 0벌)`); continue; }
      check(`철회 후보 「${c.n}」 을 잴 진실이 있다`, 1, 0, 0.5, null);
      console.log(`  ✗ ${c.n}   ← 진실 0벌 — 되먹임을 못 쟀다`);
      continue;
    }
    const red = bad.length > 0;
    check(`철회 후보 「${c.n}」 은 아직 RED 다`, 1, red ? 1 : 0, 0.5, null);
    if (red) redAll++;
    console.log(`  ${red ? "✓" : "✗"} ${c.n}   ← 철회 · 되먹임 ${red ? "RED" : "**겹침 0**"}`);
    for (const [o, sc] of rows) {
      const s = c.seen[o.n];
      console.log(`      ${sc.worst > OVL_TOL ? "✗RED" : "·   "} ${scLine(o.n, c.opt, sc)}` +
        (s ? `   (적대검증 독립 격자 ${s.toLocaleString()}mm²)` : ""));
    }
    if (!red) console.log("      ★ **겹침이 0 이 됐다** — 이 절의 반증이 사라졌다. 그래도 채택하지 마라: " +
                          "철회 1차 사유는 「원본 도면 없음」이다. 도면을 ORACLE 에 넣고 다시 재라");
    console.log(`      why: ${c.why}`);
  }
  console.log(`  철회 후보 ${RETIRED.length}건 · 되먹임 RED ${redAll}건` +
              "   ⟹ 새 규칙을 만들려면 이 절을 **먼저** 통과해야 한다(겹침 0 + 원본 도면)");
}

// ══════════════════════════════════════════════════════════════════
//  ★ 표기차 검산 — 칼선-14 를 목형 실측 D=45.00 으로 넣으면 닫히는가 (26-08-25 2차)
//
//  칼선-14 80×44.5×30 은 **기본값 열에서도** 실물이 겹치는 유일한 목형이고
//  (22.23mm² @46 15up — **앱 자동선택 판형**), 예산 22.5 와의 여유가 0.27mm²(1%)뿐이라
//  사실상 봉인돼 있다. 원인은 공식이 아니라 **발주 표기차**로 특정돼 있다:
//    발주 D 44.5 vs 목형 실측 D 45.00 (패널 폭 93.66→138.66 = 45.00)
//  ⟹ 예산을 더 손대는 대신 **입력 쪽이 정답**이라는 주장을 여기서 매번 실측한다.
//    D=45.00 을 넣었을 때 겹침 0 · 잔차 ≥0 이면 「고칠 곳은 규격 표기」가 사실이고,
//    그렇지 않으면 우리 공식이 아직 틀린 것이다(그때는 예산이 아니라 공식을 고쳐라).
//  ⚠ ORACLE 행 자체를 D=45 로 바꾸지 않는다. 사용자는 발주서의 44.5 를 입력하므로
//    그 경로의 위험(22.23mm²)은 **살아 있는 사실**이고 지우면 안 된다.
// ══════════════════════════════════════════════════════════════════
console.log("\n  ── 표기차 검산 — 칼선-14 @ 목형 실측 D=45.00 ──");
{
  const o = ORACLE.find(k => k.n === "칼선-14"), R = o && TRUTH.get("칼선-14");
  if (!R) console.log("  – 진실 없음 — 계량 불가");
  else {
    const o45 = { ...o, D: 45.0 };
    const sc44 = ovlScan(o, R, {}), sc45 = ovlScan(o45, R, {});
    const r44 = resOf(o, dpOf(o, {}), R), r45 = resOf(o45, dpOf(o45, {}), R);
    const hitO = check("표기차 검산 · D=45.00 겹침 0", 0, sc45.worst, OVL_TOL, null);
    const hitR = check("표기차 검산 · D=45.00 잔차 ≥ 0", 0, r45.min < 0 ? r45.min : 0, 0.05, null);
    console.log(`  ${hitO ? "✓" : "✗"} 겹침   발주 D 44.5 → ${sc44.worst.toFixed(2)}mm² @${sc44.worstAt || "―"}` +
                `   ·   목형 D 45.00 → ${sc45.worst.toFixed(2)}mm² @${sc45.worstAt || "―"}`);
    console.log(`  ${hitR ? "✓" : "✗"} 잔차   발주 D 44.5 → netW ${r44.rw.toFixed(2)} · 최소 ${r44.min.toFixed(2)}` +
                `   ·   목형 D 45.00 → netW ${r45.rw.toFixed(2)} · 최소 ${r45.min.toFixed(2)}`);
    console.log("      ⟹ 조치는 예산 조정이 아니라 **입력**이다 — 이 목형을 견적할 때 D 는 45.00 을 넣어라.");
  }
}

// ══════════════════════════════════════════════════════════════════
//  ★ 잔차 게이트 — 「모델이 실물보다 작지 않은가」를 **직접** 본다
//
//  왜 위 겹침 게이트만으로는 부족한가 (측정으로 확인했다)
//  ────────────────────────────────────────────
//  위 띠 D 패널을 D/2 로 되돌리는 돌연변이를 넣으면 칼선-14 에서 −12.25mm 부족해지는데,
//  **위 겹침 게이트는 그걸 못 잡는다**(66조합 신규 겹침 0건 · exit 0). 그 빈 자리를
//  격자 솔버가 마침 안 쓰기 때문이다. 즉 겹침 게이트는 「지금 판형표에서 사고가 나는가」만
//  보고, 「도형이 실물보다 작은가」는 못 본다. 판형이 하나 늘거나 clearance 가 바뀌면
//  그때 사고가 난다. 그래서 부족분 자체를 게이트로 만든다.
//
//  ★ 26-08-19 — **netW/netH 를 여기에 넣었다.** 종전에는 날개 깊이 8칸만 봤고,
//    전개도 총크기는 어느 게이트도 실측과 대조하지 않았다. 그래서 칼선-14 netW
//    −1.00mm 가 두 게이트를 다 통과했다. netW/netH 의 실측은 **PDF bbox** 다.
//
//  이 프로젝트의 안전 방향: 도형이 실물보다 **작으면 겹친다(최악)** · **크면 up 이 줄 뿐**
//  (verify-drag-shape 머리말과 같은 규약). 그래서 **음수 잔차만** 실패로 센다.
//
//  ⚠ 「안전 봉투」라는 이름을 믿지 마라 — 아래 「여유 0.00」 목록이 실제 여유다.
//    표본이 하나 더 들어오면 거기가 먼저 깨진다.
// ══════════════════════════════════════════════════════════════════
// 예산 = 원인이 특정된 미해결 부족분. 예산이 없으면 −0.05mm 도 실패다.
const RES_BUDGET = {
  "도솔":    { max: 0.25, why: "위 띠 s 공식 잔차 −0.21mm (netSize 문제 · 4표본 3계수 자유도 1)" },
  "칼선-14": { max: 1.05, why: "발주 표기 D 44.5 vs 목형 실측 D 45.00 → b 59.5/60.0 로 −0.50 · netW 263.3/264.30 로 −1.00. 둘 다 공식이 아니라 표기차다(D=45 를 넣으면 잔차 0.00·0.00)" },
  // ★ 26-08-19 — 「니치어 −9.10」·「칼선-10 −0.75」 예산 2건도 같이 **삭제했다**
  //   (위 KNOWN_OVERLAP 의 삭제 사유와 같은 한 건이다). cross.mjs CROSS_TAB 23.33 로
  //   잔차가 니치어 +0.00 · 칼선-10 +8.33 이 됐다. 니치어는 **여유 정확히 0.00** 이므로
  //   아래 「여유 0.00」 목록에 뜬다 — 탭 24.0 보다 큰 십자 목형이 하나 들어오면 여기가 깨진다.
};
/** 잔차 한 벌. **돌연변이 게이트가 같은 함수를 부른다** — 채점식을 두 벌 두면 늙는다. */
function resOf(o, dl, R) {
  const f = dl.flaps, vals = [], labels = [];
  const push = (v, lb) => { if (v !== null) { vals.push(v); labels.push(lb); } };
  // netW/netH — 실측은 PDF bbox (rot90 목형은 축을 세운 뒤 값)
  let rw = null, rh = null;
  if (R) {
    rw = +(dl.net.netW - R.w).toFixed(2); rh = +(dl.net.netH - R.h).toFixed(2);
    push(rw, "netW"); push(rh, "netH");
  }
  const rt = o.top.map((v, i) => v === null ? null : +((f?.top?.[i] ?? 0) - v).toFixed(2));
  const rb = o.bot.map((v, i) => v === null ? null : +((f?.bot?.[i] ?? 0) - v).toFixed(2));
  rt.forEach((v, i) => push(v, `위${i}`)); rb.forEach((v, i) => push(v, `아래${i}`));
  return { rw, rh, rt, rb, vals, labels, min: vals.length ? Math.min(...vals) : 0 };
}
/** 잔차가 실패인가 (예산 적용 후). 돌연변이 게이트와 공유한다. */
const resBad = (o, min) => {
  const bud = RES_BUDGET[o.n];
  return min < -0.05 && !(bud && min >= -bud.max);
};

console.log("\n═══ 잔차 게이트 — 모델 ≥ 실측 (netW·netH·날개 8칸) · 두 모드 ═══════════════");
console.log("목형/모드      netW    netH   위 띠 잔차 idx0..3(모델−실측)      아래 띠 잔차 idx0..3            최소");
console.log("-".repeat(118));
// ★ 「여유 0.00」 목록은 **목형 지정 열**에서 모은다 — 사용자가 실제로 받는 도형의 여유다.
//   목형 옵션은 봉투를 실측 크기로 좁히므로 0.00 칸이 늘어난다. 그게 사실이고 숨기지 않는다.
const zeroSlots = [];
for (const o of ORACLE) {
  const R = TRUTH.get(o.n);
  const dopt = optOfDie(o), same = !Object.keys(dopt).length;
  const bud = RES_BUDGET[o.n];
  const one = v => v === null ? "  ―――" : (v >= 0 ? "+" : "") + v.toFixed(2).padStart(6);
  const fmt = a => a.map(one).join(" ");
  const rDie = resOf(o, dpOf(o, dopt), R);
  const rDef = same ? rDie : resOf(o, dpOf(o, {}), R);
  rDie.vals.forEach((v, i) => { if (Math.abs(v) < 0.005) zeroSlots.push(`${o.n}:${rDie.labels[i]}`); });
  // 채점 단위는 **최소 잔차** 하나다. 두 열의 최소가 같으면 한 번만 센다(위 tie2 와 같은 이유).
  // ⚠ 채점만 합치고 **줄은 둘 다 찍는다** — 옵션이 어느 칸을 얼마나 좁혔는지가 보여야 한다.
  const tieR = same || Math.abs(rDie.min - rDef.min) < 1e-9;
  const rows2 = same ? [[o.n, rDie]] : [[`${o.n}/목형`, rDie], [`${o.n}/기본`, rDef]];
  rows2.forEach(([nm, r], i) => {
    const mn = r.min;
    const known = bud && mn >= -bud.max ? bud.why : null;
    let hit = true;
    if (i === 0 || !tieR)                              // 동값이면 첫 줄에서만 채점
      hit = check(`잔차 ${o.n} · ${tieR ? "두 열 동일" : i === 0 ? "목형 지정" : "기본값"}`, 0, mn < 0 ? mn : 0, 0.05, known);
    console.log(`${(hit || known ? "✓ " : "✗ ") + nm.padEnd(13)}${one(r.rw)} ${one(r.rh)}  ${fmt(r.rt)}   ${fmt(r.rb)}  ${mn.toFixed(2).padStart(7)}` +
      (known ? `  (기존 · 예산 −${bud.max})` : mn < -0.05 ? "  ★부족 = 겹침 방향" : "") +
      (i === 1 && tieR ? "  (최소 동값 — 위 줄에서 채점)" : ""));
  });
}
console.log("―――  = 그 칸에 실측이 없다 (0 으로 적으면 「날개 없음」이 되어 무엇을 그리든 통과한다)");
// ⑤ 「안전 봉투」의 실제 여유를 숨기지 않는다 — 여유 0.00 인 칸이 다음 표본에 깨질 자리다.
console.log(`\n  여유 정확히 0.00 인 칸 ${zeroSlots.length}개 — 표본 하나가 더 들어오면 여기가 먼저 깨진다:`);
for (let i = 0; i < zeroSlots.length; i += 6)
  console.log(`    ${zeroSlots.slice(i, i + 6).join("  ")}`);

// ══════════════════════════════════════════════════════════════════
//  ★ 커버리지 게이트 — 「모델 폴리곤이 원본 칼선을 **전부 덮는가**」 (열 0.2mm)
//
//  왜 필요한가 — 위 두 게이트에 **끝단폭·테이퍼 열이 없다**
//  ────────────────────────────────────────────────
//  잔차 게이트가 재는 것은 netW · netH · 날개 깊이 8칸, 전부 **스칼라 길이**다.
//  「날개가 얼마나 깊은가」는 채점하지만 「그 날개가 어떤 **모양**인가」는 채점하지 않는다.
//  겹침 게이트도 지금 판형표에서 그 자리가 실제로 물려야만 0 이 아닌 값을 낸다.
//  ⟹ 26-08-19 돌연변이 14건 중 **5건이 두 게이트를 출력 숫자 한 글자도 안 바꾸고 통과**했다:
//      TIP_W 10.8→5.0 · TAPER_MAX 10.2→18.0 · TAPER_SLOPE 0.30→0.60 ·
//      맞뚜껑 tipW TIP_FULL→null · 접착탭 쐐기(tc) 부활
//    전부 도형을 **작게** 만드는 = 겹침 방향이다. 독립 계측기로 다시 재도 신규 겹침 0 이라
//    계측기 문제가 아니라 **채점하는 열이 없었다.** 그 열을 여기서 만든다.
//
//  재는 방법 — 열(column) 0.2mm 로 「실물에 있는데 모델에 없는 재료」를 직접 잰다
//  ────────────────────────────────────────────────
//   · x 는 근사하지 않는다(선분과의 교차를 직접 푼다). 그 열의 재질 구간을 실물·모델
//     각각 만들고 **A \ B**(실물 빼기 모델)를 취한다. 겹침 게이트의 interLen 과 축만 바뀐 것.
//   · 좌표계는 잔차 게이트와 같은 로컬 프레임이다. 원점 (0,0) = [왼쪽 끝 · 위 띠 바깥]이고
//     실물은 realFromPdf 가 이미 그 프레임으로 돌려 놓았다(탭 오른쪽 · 위 띠 y=0).
//     그래서 netW·netH 부족도 같은 자로 같이 잡힌다 — 축이 늘어난 게 아니라 **면**이 됐다.
//   · **음수만** 센다. 모델이 더 큰 곳은 up 이 줄 뿐이라 안전이다(이 저장소 규약).
//
//  ⚠ 이 게이트는 켜는 순간 **12벌 전부 부족 구간을 낸다.** 그건 사실이고 숨기지 않는다 —
//    각 건의 원인·크기·조건을 COV_BUDGET 에 적었다. 예산을 tol 로 쓰지 않는 이유는
//    KNOWN_OVERLAP 과 같다: tol 로 쓰면 예산 안의 건이 PASS 로 집계돼 조용히 잊힌다.
// ══════════════════════════════════════════════════════════════════
const COV_STEP = 0.2;    // 열 폭. 0.1 로 줄여도 아래 숫자는 ±1% 안에서 같다(확인)
const COV_EPS  = 0.05;   // 이보다 짧은 부족 구간은 계측 잡음(실물 래스터 0.25mm · 선폭)

/** 볼록 조각 안인가. 모델 쪽 재질 판정은 래스터를 안 쓴다 — 정확하다. */
const inConvex = (poly, x, y) => {
  let neg = false, pos = false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (c < -1e-9) neg = true; else if (c > 1e-9) pos = true;
    if (neg && pos) return false;
  }
  return true;
};

/** 세로 스캔기 — spansAt 의 전치판(행→열). x 열의 재질 구간 전부, y 오름차순. */
function makeScan(segs, isMat) {
  let x0 = Infinity, x1 = -Infinity;
  for (const [a, b] of segs) for (const p of [a, b]) {
    if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
  }
  const BW = 4, nb = Math.max(1, Math.ceil((x1 - x0) / BW) + 1);
  const bucket = Array.from({ length: nb }, () => []);
  segs.forEach((s, i) => {
    const lo = Math.max(0, Math.floor((Math.min(s[0][0], s[1][0]) - x0) / BW));
    const hi = Math.min(nb - 1, Math.floor((Math.max(s[0][0], s[1][0]) - x0) / BW));
    for (let k = lo; k <= hi; k++) bucket[k].push(i);
  });
  return { x0, x1, spans(x) {
    const bi = Math.floor((x - x0) / BW);
    const idx = (bi >= 0 && bi < nb) ? bucket[bi] : [];
    const ys = [];
    for (const i of idx) {
      const [[xi, yi], [xj, yj]] = segs[i];
      if ((xi > x) === (xj > x)) continue;
      ys.push(yi + (yj - yi) * (x - xi) / (xj - xi));
    }
    if (ys.length < 2) return [];
    ys.sort((p, q) => p - q);
    const out = [];
    for (let i = 0; i + 1 < ys.length; i++) {
      const a = ys[i], b = ys[i + 1];
      if (b - a < 1e-9) continue;
      if (!isMat(x, (a + b) / 2)) continue;
      if (out.length && a - out[out.length - 1][1] < 1e-9) out[out.length - 1][1] = b;
      else out.push([a, b]);
    }
    return out;
  } };
}

/** A \ B (둘 다 정렬된 비겹침 구간열). */
function subSpans(A, B) {
  const out = [];
  for (const [a0, a1] of A) {
    let cur = a0;
    for (const [b0, b1] of B) {
      if (b1 <= cur) continue;
      if (b0 >= a1) break;
      if (b0 > cur) out.push([cur, Math.min(b0, a1)]);
      cur = Math.max(cur, b1);
      if (cur >= a1) break;
    }
    if (cur < a1) out.push([cur, a1]);
  }
  return out;
}

const modelScan = dp => {
  const segs = [];
  for (const p of dp.pieces) for (let i = 0; i < p.length; i++) segs.push([p[i], p[(i + 1) % p.length]]);
  return makeScan(segs, (x, y) => dp.pieces.some(p => inConvex(p, x, y)));
};
/** 실물 열 구간은 모델과 무관하다 → 목형당 한 번만 푼다(돌연변이 14회 재사용). */
function realCov(R) {
  if (R._cov) return R._cov;
  const S = makeScan(R.segs, (x, y) => !R.mask.isOut(x, y));
  const xs = [], sp = [];
  for (let x = COV_STEP / 2; x < R.w; x += COV_STEP) {
    const a = S.spans(x); if (a.length) { xs.push(x); sp.push(a); }
  }
  return (R._cov = { xs, sp });
}
/** 부족 = 실물에 있는데 모델에 없는 재료. area(mm²) · maxRun(한 열의 최대 연속 부족 깊이) */
function coverOf(R, dp) {
  const C = realCov(R), MS = modelScan(dp);
  let area = 0, maxRun = 0, at = null, cols = 0;
  for (let k = 0; k < C.xs.length; k++) {
    const x = C.xs[k], B = MS.spans(x);
    let len = 0;
    for (const [a, b] of subSpans(C.sp[k], B)) {
      const L = b - a; if (L <= COV_EPS) continue;
      len += L;
      if (L > maxRun) { maxRun = L; at = { x, y0: a, y1: b }; }
    }
    if (len > 0) { area += len * COV_STEP; cols++; }
  }
  return { area, maxRun, at, defW: cols * COV_STEP };
}
/** 부족 구간이 도형의 **어디**인가 — 원인을 사람이 읽을 수 있게. */
const whereOf = (o, dp, at) => {
  if (!at) return "";
  const p = dp.panels?.find(q => at.x >= q.x0 - 1e-9 && at.x <= q.x1 + 1e-9);
  const yA = dp.net.topLid, yB = yA + o.H;
  const band = at.y1 <= yA + 0.05 ? "위띠" : at.y0 >= yB - 0.05 ? "아래띠" : "몸통";
  return `x${at.x.toFixed(1)} y${at.y0.toFixed(1)}~${at.y1.toFixed(1)} ${band}·${p ? p.label + `(idx${p.i})` : "netW 밖"}`;
};

// 예산 = 원인이 특정된 **미해결** 부족. 값은 26-08-19 실측 그대로이고 여유를 안 붙였다
// (붙이면 그 여유가 돌연변이의 은신처가 된다 — 아래 돌연변이 게이트가 정확히 그 틈으로 뚫린다).
// ⚠ 12벌 전부에 예산이 있다는 것은 **12벌 전부 모델이 실물을 못 덮는다**는 뜻이다.
//   숨기지 않는다. 각 줄의 why 가 원인·크기·조건이고, 「조치」가 붙은 줄은 고칠 자리다.
//   고치지 않은 이유는 공통이다 — 전부 도형을 **크게** 만드는 조치라 up 이 줄고(=견적이
//   비싸지고) 절대선 「소스코 204원」과 16개 스위트를 다시 계량해야 한다. 이번 과제는
//   「채점되지 않던 축을 채점하게 만드는 것」이고, 그 축들이 이제 아래 숫자로 보인다.
const COV_BUDGET = {
  "소스코":   { run: 10.30, area:  942.5, why:
    "★ **TIP_W 10.8 이 소스코를 못 덮는다.** 최악 지점이 x45.3(전면 패널 왼쪽 끝) y0~10.24 — " +
    "모델의 위 띠는 끝단폭 10.8 사다리꼴이라 패널 가장자리가 마지막 30% 구간에서 사라지는데, " +
    "실물은 그 자리에 **끝까지 재료가 있다.** 10.8 의 출처는 웨이크버니 B 위 띠 100% 절단 " +
    "[17.9-23.2][42.5-48.0] = 5.3+5.5 인데 그건 **두 갈래 혀의 폭 합**이고 바깥 span 은 30.1mm 다. " +
    "geometry.mjs 는 「두 혀 사이 슬릿은 메워서 **보수적으로** 근사한다」고 적었지만 실제 코드는 " +
    "메운 게 아니라 **합으로 줄여** 가운데 하나로 모았다 — 보수적의 반대다. 게다가 웨이크 두 벌은 " +
    "패널 36·46mm 이고 소스코는 140mm 라 「끝단 10.8 상수」의 검증 범위 밖이다. " +
    "조치 = TIP_W 를 「바깥 span」으로 올리거나 패널폭 비례로. 도형이 커지므로 안전 방향이다" },
  "웨이크A":  { run:  9.60, area:  301.5, why:
    "아래 띠 깊은 혀의 **노치 후 재확대**. 실측 y레벨 절단(위 「★ ④」)에서 70% 가 [87.0-95.0][115.0-123.0] " +
    "두 노치로 갈렸다가 85% 에서 [90.0-119.9] 로 다시 넓어진다. addFlap 의 사다리꼴은 단조 감소라 " +
    "그 재확대를 **원리적으로** 못 그린다. 조치 = 사다리꼴 대신 「전폭 + 끝단 사각」 2단으로" },
  "웨이크B":  { run:  7.30, area:  209.0, why: "웨이크A 와 같은 목형족·같은 원인(노치 후 재확대)" },
  "도솔":     { run: 10.05, area:  342.5, why:
    "웨이크와 같은 원인(노치 후 재확대)에 위 띠 s 공식 잔차 −0.21mm 가 얹힌다(RES_BUDGET 도솔). " +
    "s 를 고치려면 netSize 를 건드려야 하고 4표본·3계수라 자유도가 1 이다" },
  "칼선-14":  { run: 54.30, area:  734.5, why:
    "★ **접착탭에 날개가 없다.** 최악 지점이 x248.5(탭 패널) y65.0~119.3 — 실물 탭이 몸통 아래로 " +
    "54.3mm 더 내려가 있는데 모델의 탭은 piecesFromFlaps 에서 **몸통 높이 직사각형 하나**다 " +
    "(flaps.top/bot 은 4칸뿐이라 탭에 날개를 줄 통로가 없다). H=30 의 극단 납작 목형이라 " +
    "아래 띠(59.5)가 몸통보다 두 배 깊고 탭이 그 띠를 따라 내려간다. " +
    "여기에 netW −1.00(발주 표기 D 44.5 vs 목형 45.00 · RES_BUDGET 칼선-14 와 같은 한 건)이 겹친다" },
  "바이오머":  { run:  3.05, area:  509.5, why:
    "netH **과대**의 앵커 부작용이다. 모델 netH 216 vs 실물 210(혀 18.0 = 5벌 상한, 안전측). " +
    "겹침 게이트 규약대로 둘을 **좌상단 모서리**에 맞춰 얹으므로 그 +6 이 전부 아래로 가고, " +
    "위 띠가 33 vs 30 이라 실물 몸통 윗 3mm 가 모델의 빈 칸(idx3 는 위 날개 0)과 겹친다. " +
    "폭 178.6mm × 3mm ≈ 509mm². 도형을 키워서 생긴 부족이라 **키워서는 못 고친다** — " +
    "고치려면 앵커를 몸통 기준으로 바꿔야 하는데 그러면 겹침 게이트의 자리 규약(nest 가 " +
    "bbox 모서리에 앉힌다)과 어긋난다. 실물 겹침은 0.00mm² 라 실害는 확인되지 않았다" },
  "더파이러츠": { run: 14.35, area:  196.5, why:
    "★ **TIP_FULL 이 아래 날개에는 안 걸린다.** piecesFromFlaps 는 tipW 를 위 날개에만 넘긴다 " +
    "(`addFlap(…, topOf(i), -1, flaps.tipW ?? null)` vs `addFlap(…, botOf(i), +1)`). 그래서 맞뚜껑 " +
    "**아래** 텍 혀가 사선 기울기형으로 한쪽 10.2mm 깎인다. 실측은 위·아래가 대칭이고(위 34.99/85.99 · " +
    "아래 35.01/86.01) 혀는 전폭(188.6/W190)이다 — 즉 26-08-19 에 위쪽만 고친 그 버그가 아래쪽에 남아 있다. " +
    "조치 = flaps 에 botTipW 를 따로 두고 넘긴다. tipW 를 그냥 아래에도 넘기면 삼면접착 아래 띠가 " +
    "인셋 10.2 → 64.6 으로 **작아져서**(W140 기준) 정반대로 위험해진다 — 한 줄로 고치지 마라" },
  "니치어":   { run: 44.30, area:  322.5, why:
    "십자 위 띠 뚜껑이 **패널 경계를 넘는다**(잠금 귀). 모델의 날개는 자기 패널 안에서만 그려지고 " +
    "이웃 패널 쪽으로 못 나간다. 최악 지점이 전면(idx1) 가장자리 열인 것이 그 증거다. " +
    "조치 = 구조 파일이 날개의 x 범위를 직접 주는 통로가 필요하다(현재 깊이 1개만 준다). " +
    "★ 26-08-26 area 321.5 → 322.5 (실측 321.1 → 322.1) — **모델이 나빠진 게 아니라 실물이 " +
    "더 잘 읽혔다.** pdf-dieline 이 허용오차 안의 끝점을 병합하게 되면서(JOIN_TOL 0.28) 이 " +
    "도면의 61.05×34.82 조각(@128.81,208.93 · 잠금 귀 자리, 칼선 bbox **안**)이 본체에 붙었다. " +
    "후보 2개 → 1개 · 선분 241 → 249 · 채움 71.6% → 74.1% · healSegs 인공 다리 103 → 101건. " +
    "실물에 재료가 1.0mm² 더 보이니 「실물 − 모델」도 그만큼 늘었다. bbox 는 303.33×285.00 " +
    "그대로이고 최대깊이 44.27 도 그대로이며 자세는 오히려 좋아졌다(여백오차 4.94 → 2.94mm/칸). " +
    "즉 늘어난 1.0mm² 는 새 결손이 아니라 **원래 있었는데 안 보이던 결손**이다. 원인 문장은 그대로다" },
  "다빈기획":  { run: 58.75, area:  679.5, why: "니치어와 같은 원인(뚜껑이 패널 경계를 넘음). W=190 이라 절대값이 가장 크다" },
  "뉴로티엑스": { run:  6.35, area:  103.0, why: "니치어와 같은 원인. 5벌 중 가장 작다(D=20 · 뚜껑 32)" },
  "칼선-09":  { run: 24.10, area:  201.0, why: "니치어와 같은 원인. DXF 유래라 칼선/오시선이 레이어로 갈려 있어 계측 신뢰도는 5벌 중 가장 높다" },
  "칼선-10":  { run: 36.20, area:  294.0, why: "칼선-09 와 같은 목형족·같은 원인" },
};

// 원인 조사 창구 — 부족 구간이 새로 뜨면 그 열/행의 실물·모델 구간을 직접 본다(찍고 즉시 종료).
//   COV_DEBUG=웨이크A COV_X=22.5,60 COV_Y=200,210 node test/verify-imposition.mjs
//   real(mask) 와 real(교차) 가 다르면 래스터 재질판정 탓이고, 같으면 도형 자체가 그렇다.
//   ★ 이 창구가 y 자세 오류(위 resolveY)를 찾아낸 도구다 — 지우지 마라.
if (process.env.COV_DEBUG) {
  const nm = process.env.COV_DEBUG;
  const o = ORACLE.find(k => k.n === nm), R = TRUTH.get(nm);
  const dp = dielinePieces(o.W, o.D, o.H, o.id);
  const RS = makeScan(R.segs, (x, y) => !R.mask.isOut(x, y));
  const RS2 = makeScan(R.segs, () => true);   // 재질판정 없이 = 순수 교차
  const MS = modelScan(dp);
  console.log(`\n[DEBUG ${nm}] real ${R.w}×${R.h}  model ${dp.net.netW}×${dp.net.netH} topLid ${dp.net.topLid.toFixed(2)} y1 ${(dp.net.topLid+o.H).toFixed(2)}`);
  console.log(`  panels ${dp.panels.map(p=>`${p.i}:${p.x0.toFixed(1)}~${p.x1.toFixed(1)}`).join(" ")}`);
  for (const x of (process.env.COV_X ?? "").split(",").filter(Boolean).map(Number)) {
    console.log(`  x=${x}  real(mask) ${JSON.stringify(RS.spans(x).map(s=>s.map(v=>+v.toFixed(1))))}`);
    console.log(`         real(교차)  ${JSON.stringify(RS2.spans(x).map(s=>s.map(v=>+v.toFixed(1))))}`);
    console.log(`         model       ${JSON.stringify(MS.spans(x).map(s=>s.map(v=>+v.toFixed(1))))}`);
  }
  const S = placeReal(R, { x:0, y:0, rotated:false, flipped:false });
  for (const y of (process.env.COV_Y ?? "").split(",").filter(Boolean).map(Number))
    console.log(`  y=${y}  real행 ${JSON.stringify(spansAt(S, y).map(s=>s.map(v=>+v.toFixed(1))))}`);
  process.exit(0);
}
/** 예산 조회 — 모드별 항목이 있으면 그것, 없으면 목형 공통. 두 모드가 같은 도형이면 같은 값이다. */
const covBud = (n, k) => COV_BUDGET[`${n}|${k}`] ?? COV_BUDGET[n];

console.log("\n═══ 커버리지 게이트 — 모델이 실물 칼선을 덮는가 (열 0.2mm · 부족만 센다) · 두 모드 ═══");
console.log("목형/모드     부족면적mm²  최대깊이mm  부족폭mm   최악 지점");
console.log("-".repeat(112));
const COV = new Map();
for (const o of ORACLE) {
  const R = TRUTH.get(o.n);
  if (!R) { console.log(`  – ${o.n.padEnd(10)} 진실 없음 — 게이트에서 제외`); continue; }
  const dopt = optOfDie(o), same = !Object.keys(dopt).length;
  const dpDie = dpOf(o, dopt), cvDie = coverOf(R, dpDie);
  const dpDef = same ? dpDie : dpOf(o, {}), cvDef = same ? cvDie : coverOf(R, dpDef);
  COV.set(`${o.n}|die`, cvDie); COV.set(`${o.n}|def`, cvDef);
  // 목형 옵션은 **탭 폭**(cross)과 **실측이 0 인 얕은 날개**(glue3 far)만 좁힌다 —
  // 둘 다 실물에 재료가 없는 자리라 「실물 − 모델」은 원리적으로 안 움직인다.
  // 그래서 두 열이 동값으로 나오는 것이 정상이고, 갈리면 그 자체가 조사거리다.
  const tieC = same || tie2(cvDie, cvDef, "area", "maxRun");
  const rows2 = same ? [[o.n, cvDie, dpDie]] : [[`${o.n}/목형`, cvDie, dpDie], [`${o.n}/기본`, cvDef, dpDef]];
  rows2.forEach(([nm, cv, dp], i) => {
    const bud = covBud(o.n, i === 0 ? "die" : "def");
    const known = bud && cv.maxRun <= bud.run + 1e-9 && cv.area <= bud.area + 1e-9 ? bud.why : null;
    const clean = cv.maxRun <= COV_EPS && cv.area <= 0.5;
    let hit = true;
    if (i === 0 || !tieC)
      hit = check(`커버리지 ${o.n} · ${tieC ? "두 열 동일" : i === 0 ? "목형 지정" : "기본값"}`, 0, clean ? 0 : 1, 0.5, known);
    console.log(`${(hit || known ? "✓ " : "✗ ") + nm.padEnd(12)}${cv.area.toFixed(1).padStart(10)}${cv.maxRun.toFixed(2).padStart(11)}` +
      `${cv.defW.toFixed(1).padStart(10)}   ${whereOf(o, dp, cv.at)}` +
      (known ? `  (기존 · 예산 ${bud.run}mm/${bud.area}mm²)` : clean ? "" : "  ★신규 부족 = 겹침 방향") +
      (i === 1 && tieC ? "  (동값 — 위 줄에서 채점)" : ""));
  });
}

// 계측기 자기검사 ③ — 이빨 확인. 모델을 2% 줄이면 12벌 전부 부족이 **늘어야** 한다.
// ⚠ 진실이 0벌이면 **검사하지 않는다.** tot=0/ok=0 은 자동 통과라 「이빨 없는데 초록」이 된다
//   (verify-pdf 「SKIP 은 실패다」와 같은 함정). 오라클 없는 환경은 이 줄을 보고 알아야 한다.
if (!TRUTH.size) console.log("  자기검사③: 진실 0벌 — **미실행(점수 아님)**");
else {
  let ok = 0, tot = 0, worst = "";
  for (const o of ORACLE) {
    const R = TRUTH.get(o.n); if (!R) continue;
    tot++;
    const dp = dpOf(o, optOfDie(o));               // 목형 지정 열로 검사한다(= 사용자가 받는 도형)
    const cx = dp.net.netW / 2, cy = dp.net.netH / 2;
    const sm = { ...dp, pieces: dp.pieces.map(p => p.map(([x, y]) => [cx + (x - cx) * 0.98, cy + (y - cy) * 0.98])) };
    const a = COV.get(`${o.n}|die`).area, b = coverOf(R, sm).area;
    if (b > a + 1) ok++; else worst = `${o.n} ${a.toFixed(1)}→${b.toFixed(1)}`;
  }
  check("커버리지 계측기 자기검사 ③ (모델 2% 축소 → 부족 증가)", tot, ok, 0, null);
  console.log(`  자기검사③: 모델 2% 축소 시 부족 면적이 늘어난 목형 ${ok}/${tot}` +
    (ok === tot ? "  ✓ 이빨 있음" : `  ✗ 계측기 고장 (${worst}) — 위 숫자를 믿지 마라`));
}

// ══════════════════════════════════════════════════════════════════
//  ★ 돌연변이 게이트 — 「상수를 작게 만들면 정말 빨간불이 켜지는가」
//
//  왜 게이트로 박는가
//  ────────────────
//  26-08-19 에 이 14건을 **손으로** 돌려서 5건이 통과하는 것을 발견했다. 손으로 돌린
//  것은 다음 사람에게 남지 않는다 — 남는 것은 게이트뿐이다. 그래서 스위트가 스스로
//  돌린다. 상수를 「최적화」하려는 다음 사람은 커밋 전에 여기서 걸린다.
//
//  어떻게 — **실코드를 통째로 복사해 한 글자만 바꾸고 다시 import 한다**
//   · src/domain/dieline/ 7파일을 임시 폴더에 복사(그 폴더는 외부 import 가 0줄이다) →
//     지정한 파일에서 find 문자열 1개를 repl 로 치환 → index.mjs 를 동적 import.
//   · 채점은 **위 두 게이트와 같은 함수**(resOf/coverOf)를 그대로 부른다. 채점식을
//     따로 쓰면 그 복제본이 늙어서, 게이트는 초록인데 돌연변이표만 초록이 된다.
//   · find 가 정확히 1회 나오지 않으면 **그 자체로 실패**다(조용한 no-op = 가짜 초록).
//     원문이 바뀌면 여기서 즉시 드러난다.
//  ⚠ 겹침 게이트는 돌연변이마다 돌리지 않는다(목형 12 × 판형 10 × 열스캔 = 분 단위).
//    아래 표의 「겹침」열이 없는 이유이고, 애초에 5건이 통과한 게이트가 그것이다.
// ══════════════════════════════════════════════════════════════════
const DIE_SRC = fileURLToPath(new URL("../src/domain/dieline/", import.meta.url));
const MUT = [
  // 축 = 이 돌연변이가 건드리는 기하 축. 「기대」는 없다 — 전부 잡혀야 한다.
  { ax:"netW",   n:"GLUE_TAB 14.3 → 12.0",            f:"geometry.mjs",  a:"export const GLUE_TAB = 14.3;",        b:"export const GLUE_TAB = 12.0;" },
  { ax:"netW",   n:"CROSS_TAB 23.33 → 14.3 (되돌림)",  f:"cross.mjs",     a:"const CROSS_TAB = 23.33;",             b:"const CROSS_TAB = 14.3;" },
  { ax:"netH",   n:"맞뚜껑 혀 18.0 → 16.5 (되돌림)",    f:"tuck-both.mjs", a:"const topLid = D + 18.0, botFloor = D + 18.0;", b:"const topLid = D + 16.5, botFloor = D + 16.5;" },
  { ax:"netH",   n:"십자 LID +11.3 → +10.2 (되돌림)",   f:"cross.mjs",     a:"const LID = D => 1.086 * D + 11.3;",   b:"const LID = D => 1.086 * D + 10.2;" },
  { ax:"netH",   n:"십자 FLOOR +0.6 → +0 (되돌림)",     f:"cross.mjs",     a:"const FLOOR = D => 0.70 * D + 0.6;",   b:"const FLOOR = D => 0.70 * D;" },
  { ax:"날개깊이", n:"삼면 위 띠 [s,s,s,s] → [D/2,s,D/2,s]", f:"glue3.mjs", a:"top: [s, s, s, s],",                  b:"top: [D / 2, s, D / 2, s]," },
  // ⚠ 26-08-25 — 앵커가 `bot: [botDust, b, botDust, b] };` 에서 아래로 옮겨졌다.
  //   glue3 아래 띠가 **목형별 노브**(opt.deepFlap)가 되면서 세 프로파일이 표로 바뀌었기
  //   때문이다. 감시하는 축은 그대로다 — **기본값(both) 봉투를 종전 [.., b, .., 0] 으로
  //   되돌리면 빨간불이 켜지는가.** 노브가 생겼다고 되돌림 감시를 놓으면 안 된다:
  //   기본값이 곧 「목형을 모르는 사용자가 받는 값」이고, 그 자리가 작아지면 소스코형
  //   목형에서 실물 겹침 5,033.8mm² 가 되살아난다.
  { ax:"날개깊이", n:"삼면 아래 띠 W1 b → 0 (되돌림)",   f:"glue3.mjs",     a:"both: [botDust, b, botDust, b],",     b:"both: [botDust, b, botDust, 0]," },
  { ax:"tip",    n:"TIP_W 10.8 → 5.0",                 f:"geometry.mjs",  a:"export const TIP_W = 10.8;",           b:"export const TIP_W = 5.0;" },
  { ax:"tip",    n:"TIP_W 10.8 → 2.0",                 f:"geometry.mjs",  a:"export const TIP_W = 10.8;",           b:"export const TIP_W = 2.0;" },
  { ax:"테이퍼",  n:"TAPER_MAX 10.2 → 18.0",            f:"geometry.mjs",  a:"TAPER_MAX = 10.2",                     b:"TAPER_MAX = 18.0" },
  { ax:"테이퍼",  n:"TAPER_SLOPE 0.30 → 0.60",          f:"geometry.mjs",  a:"TAPER_SLOPE = 0.30",                   b:"TAPER_SLOPE = 0.60" },
  { ax:"테이퍼",  n:"FULL_FRAC 0.7 → 0.3",              f:"geometry.mjs",  a:"FULL_FRAC = 0.7;",                     b:"FULL_FRAC = 0.3;" },
  { ax:"tip",    n:"맞뚜껑 tipW TIP_FULL → null",       f:"tuck-both.mjs", a:'return { type: "tuck", tipW: TIP_FULL,', b:'return { type: "tuck", tipW: null,' },
  { ax:"테이퍼",  n:"접착탭 쐐기(tc) 부활",              f:"geometry.mjs",
    a:`      pieces.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);\n      meta.push({ panel: 4, part: "tab" });\n      cuts.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);`,
    b:`      const tc = Math.min(pw * 0.55, H * 0.12, 8);\n      pieces.push([[x0, y0], [x1, y0 + tc], [x1, y1 - tc], [x0, y1]]);\n      meta.push({ panel: 4, part: "tab" });\n      cuts.push([[x0, y0], [x1, y0 + tc], [x1, y1 - tc], [x0, y1]]);` },
  // ── ★ 26-08-25 신설 2건 — **노브의 기본값**을 겨눈다 ─────────────────
  //  노브가 생기면 「목형을 아는 사용자」의 도형은 좋아지지만, 기본값은 목형을 **모르는**
  //  사용자가 받는 값이라 그 자리가 작아지면 앱이 물리적으로 불가능한 판을 판다.
  //  두 건 다 **기본값만** 건드린다 = 목형 지정 열은 한 글자도 안 바뀐다. 그래서
  //  judge() 가 두 모드를 다 채점하지 않으면 이 둘은 노브 뒤에 숨어 살아남는다
  //  (설계 확인용으로 넣은 것이 아니라, 실제로 다음 사람이 하려는 변경이 이 둘이다 —
  //   §15 「기본값을 15.70 으로 내리는 안」·「기본값을 far 로 낙관하는 안」).
  { ax:"기본값",  n:"CROSS_TAB_W 기본 24.03 → 15.70 (다수결)", f:"cross.mjs",
    a:"export const CROSS_TAB_W = CROSS_TAB + GLUE_TAB_SHORT;", b:"export const CROSS_TAB_W = 15.70;" },
  { ax:"기본값",  n:"glue3 기본 both → far (다수결 3/5)", f:"glue3.mjs",
    a:`? opt.deepFlap : "both";`, b:`? opt.deepFlap : "far";` },
  // ⚠ 넣으려다 **뺀** 돌연변이 2건 — 원리적으로 검출 불가라서다(가짜 이빨을 만들지 않는다):
  //   · `far: [botDust, b, botDust, botDust]` → `[.., 0]`  — far 3벌(웨이크A·B·도솔)의
  //     실측 idx3 이 **전부 0.0** 이라 0 으로 그려도 「모델 ≥ 실물」이 유지된다. 부족이 아니다.
  //   · `near:` 줄 전체 — 지금 **어느 목형도 near 를 쓰지 않는다**(die-profiles.mjs 가
  //     소스코·칼선-14 를 일부러 비워 뒀다). 표본이 그 줄을 안 지나가므로 채점할 수 없다.
  //     대신 아래 「실측 자세」 절이 그 줄을 직접 계량하고, 값이 바뀌면 거기서 죽는다.
];

/** 돌연변이 1건을 적용한 dielinePieces 를 돌려준다. 실패하면 이유를 돌려준다. */
async function mutate(m, k) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `cria-mut${k}-`));
  // ⚠ fs.cpSync 를 쓰지 마라 — node v24.14.1 · Windows 에서 이 소스 경로(한글 포함)를
  //   주면 프로세스가 **0xC0000409 로 즉사**한다(스택 버퍼 오버런). 에러가 아니라 크래시라
  //   try/catch 로도 못 잡고 스위트가 통째로 사라진다. dieline/ 은 평평한 폴더라 필요 없다.
  for (const f of fs.readdirSync(DIE_SRC)) if (f.endsWith(".mjs"))
    fs.copyFileSync(path.join(DIE_SRC, f), path.join(dir, f));
  const file = path.join(dir, m.f);
  const src = fs.readFileSync(file, "utf8");
  const hits = src.split(m.a).length - 1;
  if (hits !== 1) return { err: `패치 지점 ${hits}개 (1개여야 한다) — ${m.f} 원문이 바뀌었다` };
  fs.writeFileSync(file, src.replace(m.a, m.b));
  MUT_DIRS.push(dir);
  try {
    const mod = await import(pathToFileURL(path.join(dir, "index.mjs")).href);
    return { dp: mod.dielinePieces };
  } catch (e) { return { err: `import 실패 — ${e.message}` }; }
}
const MUT_DIRS = [];
/** 그 모델로 두 게이트를 다시 채점 → 걸린 목형·축 목록. 비면 **돌연변이가 살아남았다.** */
//  ★ 26-08-25 — **두 모드 다 채점한다.** 노브가 생긴 뒤로 한 모드만 보면 돌연변이가
//    노브 뒤에 숨는다. 실제로 그렇게 되는 축이 둘 있다:
//      · `CROSS_TAB_W` 기본값을 내리는 돌연변이 → 십자 5벌이 **전부 자기 탭폭을 지정**하고
//        있어서 목형 지정 열은 한 글자도 안 바뀐다. 기본값 열만 −8.33mm 로 죽는다.
//      · `glue3` 아래 띠 `both:` 프로파일을 깎는 돌연변이 → far 를 켠 3벌은 그 줄을 안 읽는다.
//    「어느 열이 잡았는가」를 표에 찍는다 — 한 열에서만 잡히는 축이 노브의 사각지대다.
function judge(dpFn) {
  const res = [], cov = [], by = { die: 0, def: 0 };
  for (const o of ORACLE) {
    const R = TRUTH.get(o.n); if (!R) continue;
    const dopt = optOfDie(o), same = !Object.keys(dopt).length;
    for (const md of MODES) {
      if (md.k === "def" && same) continue;
      const tag = same ? o.n : `${o.n}/${md.k === "die" ? "목형" : "기본"}`;
      let dp; try { dp = dpFn(o.W, o.D, o.H, o.id, md.of(o)); } catch { res.push(`${tag}:예외`); by[md.k]++; continue; }
      if (!dp) { res.push(`${tag}:도형없음`); by[md.k]++; continue; }
      const mn = resOf(o, dp, R).min;
      let bad = false;
      if (resBad(o, mn)) { res.push(`${tag} ${mn.toFixed(2)}mm`); bad = true; }
      const cv = coverOf(R, dp), bud = covBud(o.n, md.k);
      if (cv.maxRun > (bud?.run ?? 0) + COV_EPS || cv.area > (bud?.area ?? 0) + 0.5) {
        cov.push(`${tag} ${cv.maxRun.toFixed(2)}mm/${cv.area.toFixed(0)}mm²`); bad = true;
      }
      // 옵션이 없는 목형은 두 열이 **같은 도형**이라 한 번만 돌린다 — 그 한 번은 두 열
      // 모두를 대표한다. 여기서 한쪽에만 세면 「한 열에서만 잡혔다」로 오독된다.
      if (bad) { if (same) { by.die++; by.def++; } else by[md.k]++; }
    }
  }
  return { res, cov, by };
}

console.log(`\n═══ 돌연변이 게이트 — 상수를 작게 하면 빨간불이 켜지는가 (${MUT.length}건 · 두 열) ═══════`);
// ⚠ 진실이 0벌이면 **돌리지 않는다.** 채점할 실물이 없으니 14건 전부 「살아남음」으로
//   나오고 그건 코드가 아니라 환경 얘기다(오라클 없는 CI). 조용히 통과시키지도 않는다 —
//   「미실행(점수 아님)」이라고 찍는다. verify-pdf §A 와 같은 규약.
if (!TRUTH.size) console.log("  진실 0벌 — **미실행(점수 아님)**. 오라클 칼선 PDF 가 있어야 돌아간다.");
else {
console.log("축        돌연변이                                  잔차 커버리지  잡은 열   판정   최초 검출");
console.log("-".repeat(124));
let mutHit = 0; const mutMiss = [], modeOnly = [];
for (let k = 0; k < MUT.length; k++) {
  const m = MUT[k], r = await mutate(m, k);
  if (r.err) {
    mutMiss.push(`${m.n} — ${r.err}`);
    console.log(`✗ ${m.ax.padEnd(8)}${m.n.padEnd(42)}  ${r.err}`);
    continue;
  }
  const j = judge(r.dp), caught = j.res.length + j.cov.length > 0;
  if (caught) mutHit++; else mutMiss.push(m.n);
  // 「한 열에서만 잡힌다」 = 그 축이 노브의 사각지대다. 표에 찍고 아래에서 한 번 더 요약한다.
  const who = j.by.die && j.by.def ? "둘 다" : j.by.die ? "목형만" : j.by.def ? "기본만" : "―";
  if (caught && (!j.by.die || !j.by.def)) modeOnly.push(`${m.n} → ${who}`);
  const first = j.res[0] ?? j.cov[0] ?? "";
  console.log(`${caught ? "✓ " : "✗ "}${m.ax.padEnd(8)}${m.n.padEnd(42)}` +
    `${(j.res.length ? String(j.res.length) + "건" : " ―").padStart(5)}` +
    `${(j.cov.length ? String(j.cov.length) + "건" : " ―").padStart(8)}` +
    `${who.padStart(8)}   ${caught ? "RED " : "★통과"}  ${first}`);
}
for (const d of MUT_DIRS) try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* 임시폴더 청소 실패는 판정과 무관 */ }
check(`돌연변이 검출 ${mutHit}/${MUT.length}`, MUT.length, mutHit, 0, null);
console.log(`  검출 ${mutHit}/${MUT.length} (진실 ${TRUTH.size}/${ORACLE.length}벌 기준 · 목형 지정/기본값 **두 열**)` +
  (mutMiss.length ? `  ✗ **살아남은 돌연변이** — 그 축은 아직 채점되지 않는다:\n    · ` + mutMiss.join("\n    · ") : `  ✓ ${MUT.length}축 전부 채점된다`));
if (modeOnly.length) console.log(`  ⚠ **한 열에서만** 잡힌 축 ${modeOnly.length}건 — 그 열을 빼면 이 축이 노브 뒤로 숨는다:\n    · ` + modeOnly.join("\n    · "));
}

// 이 게이트가 무엇을 채점하고 무엇을 안 하는지 **화면에 찍는다.** 다음 사람이 속지 않게.
console.log(`
▶ 이 스위트가 채점하는 축 (돌연변이로 확인한 것만 적는다)
    ✓ netW · netH            잔차 게이트 (실측 = PDF bbox)
    ✓ 날개 깊이 8칸           잔차 게이트 (실측 = 세로 크리스 + 몸통 밖 최원점)
    ✓ 끝단폭(TIP_W)·테이퍼 기울기·전폭구간·접착탭 모따기
                             **커버리지 게이트** (열 0.2mm 포함검사) — 26-08-19 신설.
                             그 전까지 이 4축은 어느 게이트도 채점하지 않았고
                             돌연변이 5건이 출력 숫자를 한 글자도 안 바꾸고 통과했다.
    ✓ **목형별 구조 옵션이 실린 도형**   — 26-08-25 신설. 세 게이트를 **두 열**로 잰다:
                             「목형 지정」(die-profiles.mjs 가 그 목형에 실어 주는 값 =
                             사용자가 실제로 받는 도형)과 「기본값」(목형을 모를 때).
                             그 전까지 이 스위트는 기본값만 재서, 노브가 실린 도형이
                             통째로 무검증이었다.
    ✓ **노브의 기본값**       — 위 두 축을 각각 겨눈 돌연변이 2건(「기본값」 축).
                             그중 CROSS_TAB_W 는 **기본값 열에서만** 잡힌다 —
                             십자 5벌이 전부 자기 탭폭을 실어서 목형 지정 열은
                             한 글자도 안 바뀌기 때문이다. 그 열을 빼면 노브 뒤로 숨는다.
    ✓ **미룬 대가**           — 「실측 자세」 절. 목형표가 일부러 안 싣는 옵션(소스코·
                             칼선-14 의 near)을 매번 다시 재서, 픽스처 주석의 숫자가
                             아직 사실인지 본다. 0 이 되면 **실으라고** 실패한다.
    ✗ 날개 **옆면 모양**의 절대 정확도  — 커버리지는 「모델 ≥ 실물」만 본다.
                             모델이 실물보다 큰 것은 세지 않는다(up 감소 = 안전 방향).
    ✗ glue3 「near」 프로파일의 **잔차·커버리지** — 지금 어느 목형도 near 를 싣지 않으므로
                             표본이 그 줄을 안 지나간다. 겹침만 「실측 자세」 절이 잰다.
                             near 를 싣는 목형이 생기면 그때 자동으로 두 게이트에 들어온다.
    ✗ 배치 규칙(맞물림 종류)·금액   — verify-net · scorecard-* 의 일이다.`);

// ══════════════════════════════════════════════════════════════════
//  집계 — 종전에는 카운터가 없어 몇 건이 틀려도 항상 exit 0 이었다
// ══════════════════════════════════════════════════════════════════
const TOTAL = PASS + KNOWN.length + FAIL.length;
console.log(`\n${"=".repeat(74)}`);
console.log(`실측 대조: ${PASS}/${TOTAL}` +
            (KNOWN.length ? `  (+ 알려진 공식 오차 ${KNOWN.length}건)` : "") +
            (NO_TRUTH.length ? `  · ⚠ 진실 없음 ${NO_TRUTH.length}벌 — 그만큼 **미검증**이다` : ""));
for (const [label, why, real, calc] of KNOWN)
  console.log(`  ⚠ ${label}: 실측 ${real} → 공식 ${calc.toFixed(1)}  — ${why}`);
for (const [label, real, calc] of FAIL)
  console.log(`  ✗ ${label}: 실측 ${real} → 계산 ${typeof calc === "number" ? calc.toFixed(1) : calc}`);

// ── SKIP 은 실패다 (verify-pdf §A 와 같은 규약) ────────────────────
//  오라클 칼선 PDF 는 고객사 도면(영업기밀)이라 저장소 밖에 있다. 없는 것이 CI 에서는
//  정상이지만, **없는데 초록**이면 「실물 대조 0건인데 만점」이 된다 — 이 저장소가
//  이미 한 번 4주간 그렇게 속았다(ARCHITECTURE §10). 그래서 기본은 exit 1 이고,
//  면제하려면 환경이 스스로 밝혀야 한다(CI 두 워크플로가 PDF_ALLOW_SKIP=1 을 이미 건다).
if (NO_TRUTH.length) {
  console.log(`\n⚠ 실물 겹침·잔차 게이트의 진실(원본 칼선 PDF) ${NO_TRUTH.length}벌을 읽지 못했다:`);
  for (const [n, why] of NO_TRUTH) console.log(`   · ${n}: ${why}`);
  if (ALLOW_SKIP) {
    console.log(`  → PDF_ALLOW_SKIP=1 로 면제한다. 그 ${NO_TRUTH.length}벌은 **점수 아님**(미검증)이다.`);
    console.log(`     오라클이 다른 위치에 있으면:  PDF_ORACLE_DIR=<뿌리> DIE_ORACLE_DIR=<뿌리> node test/verify-imposition.mjs`);
  } else {
    console.log(`  → 면제하려면 PDF_ALLOW_SKIP=1 또는 --allow-skip. 면제 없이는 실패다.`);
    process.exitCode = 1;
  }
}
if (FAIL.length) process.exitCode = 1;

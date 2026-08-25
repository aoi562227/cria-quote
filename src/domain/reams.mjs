// ══════════════════════════════════════════════════════════════════
// [v8] 지대 R수 · 여분(손지) · 공정 R수
//   docs/ 견적서 78건(수량 티어 100여 개) 전수 역산 — 2026-07
//
// ▶ 지대 R수
//     정미(net) = ceil(수량 / up)
//     지대R     = (정미 + 여분) / (500 × 절수)
//                 전지급(절수1) → 0.1R 단위 올림 (= 50장 묶음)
//                 2절 이하      → 소수 3자리 올림
//   검증: 46전지 정미1667+300 = 1967장 → 3.934R → 0.1올림 4.0R ✓ (삼면B 5,000ea)
//         하3 정미5000+300 → 5300/1500 = 3.5333… → 3.534 ✓ (조립형 2종1만)
//         4×63 정미2000+300 → 2300/1500 → 1.534 ✓ (손잡이형)
//
// ▶ 여분(손지) = max(기본, 정미 × 5%)      ※ 전부 "장수" 기준. up을 곱하면 EA 환산
//     기본 300장 (인쇄 없이 박·톰슨만이라면 200장)
//     + 양면인쇄 100장   + 베다(바탕인쇄) 100장   + 형압 50장
//     ※ 박(금박·먹박)은 가산 없음 — 조립형 금박 2건이 여분 300 ✓
//   근거: 견적서 99건 중 정미 6,000장 이하 전건이 정확히 300장.
//         삼면E 견적서에 "500-300"(정미500/여분300) 메모가 직접 남아 있음.
//         양면 +100 은 십자B 한 장 안에서 직접 대조됨:
//           전면별2+후면원색4 → 여분 400 / 전면별2 단면 → 여분 300
//         베다 +100: G형C 별1베다+먹 단면 → 정미 2,000/3,000에 여분 400 ✓ 2건
//         인쇄없음 200: 트레이B(인쇄 무) 500ea → 700장 = 0.35R ✓
//     대량: 정미 8,334 → 416 (5.0%) ✓ / 정미 15,000 → 700 (4.7%) ✓
//
//   EA 환산 예 (46전지 3up, 여분 300장):
//     3,000ea → 정미 1,000 + 300 = 1,300장 × 3up = 3,900EA (여분 900EA) ✓ 견적서 일치
//     5,000ea → 정미 1,667 + 300 = 1,967장 → 0.1올림 2,000장 × 3up = 6,000EA ✓
//
//   ⚠ 재현 안 되는 실측 2건 (여분 수동 입력으로 보정):
//     · 맞뚜껑150×20×150 500ea → 여분 25 (정미 250, 초소량 단발성 이상치)
//     · 주문생산A 주문생산 40,000ea → 여분 800 (계산 500, Δ-0.3R)
//
// ▶ 공정 R수 (인쇄·코팅·톰슨·박·형압·재단) — 판형·절수 무관
//     공정R = ceil( 정미 / 1000 × 10 ) / 10        (0.1R 올림)
//     정미 < 1000장 → 1식 (최소 1R)
//   검증: 정미1667→1.7 ✓ / 8334→8.4 ✓ / 1250→1.3 ✓ / 15000→15 ✓ / 2000→2 ✓
//   ※ 지대는 절수 기준(판형별 1R 장수가 다름), 공정은 무조건 1,000장 = 1R
// ══════════════════════════════════════════════════════════════════

import { sheetsPerR } from "./data/sheets.mjs";
import { SPOT_WEIGHT, sideColors, sideFlat } from "./data/print-prices.mjs";
import { ceil1, ceil3 } from "./units.mjs";

export const LOSS_BASE      = 300;   // 기본 여분(장)
export const LOSS_BASE_NOPR = 200;   // 인쇄 없음(박·톰슨만) — 색맞춤 손지가 빠짐
export const LOSS_RATE      = 0.05;  // 대량 구간 여분율 (정미 6,000장 초과부터 이쪽이 큼)
export const LOSS_BOTHSIDES = 100;   // 양면인쇄 가산
export const LOSS_BEDA      = 100;   // 베다(바탕 전면 인쇄) 가산 — 잉크량 많아 손지 증가
export const LOSS_EMB       = 50;    // 형압 가산 (박은 가산 없음 — 조립형 금박 2건 여분 300)

/** 여분(손지) 장수 — options.manual 이 있으면 그 값을 그대로 사용.
 *  parseFloat 는 유지 — UI 가 빈 문자열/숫자 문자열을 그대로 넘긴다.
 *
 *  ⚠ 26-08-25 알려진 동작: **0 은 자동과 같다**(여분 300장). 1 은 먹힌다.
 *    `manual > 0` 이 0 을 빈값과 한 덩어리로 묶기 때문이다. 방향은 안전측이고
 *    (여분이 붙어 비싸진다) 화면 「▸ 자동 판단: … 여분 300장(표준)」 줄이 간접적으로
 *    말해 준다. **0 을 진짜 0장으로 받는 분기는 일부러 안 넣었다** — 인쇄 여분 0 은
 *    실무에서 성립하지 않고, 넣으면 방향이 「싸진다」로 바뀐다.
 *    입력칸 note(PaperPanel)가 이 사실을 명시한다. */
export function estimateLoss(net, options = {}) {
  const manual = parseFloat(options.manual);
  if (manual > 0) return Math.round(manual);
  const base = options.noPrint ? LOSS_BASE_NOPR : LOSS_BASE;
  let loss = Math.max(base, Math.round(net * LOSS_RATE));
  if (options.bothSides) loss += LOSS_BOTHSIDES;
  if (options.beda)      loss += LOSS_BEDA;
  if (options.hasEmb)    loss += LOSS_EMB;
  return loss;
}

/**
 * 지대 R수
 *   전지급(절수 1, 1R=500장) → 0.1R 단위 올림 (= 50장 묶음)
 *     ✓ 실측 전지급 R수는 전부 0.1 배수: 2.6 / 4.0 / 1.8 / 2.8 / 4.6 / 4.8 / 6.8 (7/7)
 *     ✓ 삼면B 46전지 5,000ea: 1,967장 → 3.934R → 0.1올림 4.0R (견적서 일치)
 *   2절 이하 → 계산값 그대로 (소수 3자리 올림)
 *     ✓ 하3 5,300/1,500 = 3.5333… → 3.534 / 4×63 2,300/1,500 → 1.534
 */
export function calcR(up, qty, sheet, options = {}) {
  if (!up || up === 0 || !qty) return 0;
  const net = Math.ceil(qty / up);
  const raw = (net + estimateLoss(net, options)) / sheetsPerR(sheet);
  return (sheet?.cut === 1) ? ceil1(raw) : ceil3(raw);
}

/** 공정 R수 — 1,000장 = 1R, 0.1R 올림, 최소 1식 */
export function calcProcessR(up, qty) {
  if (!up || up === 0 || !qty) return 1;
  const net = Math.ceil(qty / up);
  if (net < 1000) return 1;
  return ceil1(net / 1000);
}

/**
 * 여분 판단 옵션 (calcR / findBestSheet 공용).
 *
 * 종전 App.jsx 에는 이 판단이 두 사본으로 있었고 **결과는 동일했다**:
 *   lossOptsOf     — printUnits 를 추가로 계산 (판형 랭킹 전용)
 *   computeForQty  — printUnits 없음
 * 두 사본의 bothSides/noPrint/beda 식이 완전히 같음을 확인하고 하나로 합쳤다.
 * hasFoil 필드는 버렸다 — estimateLoss 가 읽지 않아 값이 그냥 버려지고 있었다.
 * 박은 여분 가산 없음이 확정 정책이다(조립형 금박 2건 여분 300).
 */
export function lossOptionsOf(print, finish, lossSheets) {
  // UV 는 도수가 0 이어도 인쇄한 것이다 (별도 UV기계) — 여분 판단에서 무인쇄가 아니다
  const ink  = sd => sideColors(sd) > 0 || !!sd.uv;
  const fInk = ink(print.front), bInk = ink(print.back);
  const spot = print.front.spot + print.back.spot;
  const flat = sideFlat(print.front) + sideFlat(print.back);
  return {
    manual:     lossSheets,
    bothSides:  fInk && bInk,
    noPrint:    !fInk && !bInk,
    beda:       !!print.beda && spot > 0,
    hasEmb:     !!finish?.hasEmb,
    printUnits: spot * SPOT_WEIGHT + flat,   // sheet-select 랭킹 전용 인쇄 도수 가중치
  };
}

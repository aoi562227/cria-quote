// ══════════════════════════════════════════════════════════════════
//  sheet-select.mjs — 최적 원지(판형) 선택
// ══════════════════════════════════════════════════════════════════
import {
  BASE_SHEETS, SHEET_PRIORITY, sheetsPerR, sheetTier, effectiveSheet, resolveSheet,
} from "./data/sheets.mjs";
import { PRINT_UNIT_DEFAULT } from "./data/print-prices.mjs";
import { RANK_COAT_EST, RANK_THOM_EST } from "./data/process-prices.mjs";
import { calcR, calcProcessR } from "./reams.mjs";
import { getPaperPriceInfo } from "./paper-repo.mjs";
import { solveImposition } from "./imposition.mjs";

// 하드롱 계열은 후순위 — 실무 기준
//   "하드롱은 왠만하면 안 쓴다. 국절이나 46절이 너무 수율이 안 좋을 때만 쓴다."
// 즉 몇 % 저렴한 정도로는 부족하고, 확실히 유리해야 선택된다.
// → 사륙·국전 최선안보다 **6% 이상 저렴할 때만** 하드롱을 쓴다.
//   (사륙·국전에서 up=0 이면 하드롱만 남으므로 그때는 자동 선택)
//
// ⚠ 배수 페널티(총비용 × 1.12)로 하면 안 된다. 총비용에는 판형과 무관한
//   공정추정이 섞여 있어 지대 우위가 희석된다. 실측으로 확인:
//     조립형 324×428 · AB400 · 3,000ea (견적서 = 하3 2up)
//       하3   지대 673,320 + 공정추정 262,500 = 935,820
//       4×62 지대 769,810 + 공정추정 262,500 = 1,032,310
//       하3 가 지대만 보면 12.5% 저렴하지만 총비용 기준으론 9.3%
//       → 12% 배수 페널티면 4×62 가 이겨서 실제 견적서와 어긋났음
export const HADRONG_EDGE = 0.06;

// ── 선택 규칙 ──────────────────────────────────────────────────
// 총비용(지대 + 공정추정) 이 최저값의 TIE_PCT 안에 들어오는 판형들은
// "실질적으로 같은 값"으로 보고 그 중 실무 우선순위가 높은 것을 쓴다.
//
// ⚠ 종전에는 우선순위를 총비용에 **곱했다**:  rankCost = 총비용 × (1 + (priority−1)×0.01)
//   그런데 공정추정에는 판형과 무관한 항(인쇄 도수 등)이 섞여 있어서,
//   도수만 바꿔도 곱해지는 밑값이 커지고 순위가 뒤집혔다.
//   실측 예) 삼면접착 50×40×81 · AB라이트295 · 1,000ea
//     하4  6up : 지대 70,375 (0.234R)   ← 지대가 7,465원 더 싸고 up 도 많다
//     4×64 4up : 지대 77,840 (0.275R)
//     별색1도 → 랭킹차 899원(0.4%)로 하4 선택 / 원색4도 → 4×64 선택
//   같은 박스인데 인쇄 도수 때문에 원지·판걸이·R수가 통째로 바뀌었다.
//
// 위 예는 하드롱 페널티(6%) 적용 후 4×64 로 확정된다 — 하4 가 3.3% 저렴한
// 정도로는 "수율이 너무 안 좋을 때" 에 해당하지 않기 때문.
export const TIE_PCT = 0.015;

// 추정 지대단가 페널티 — 룩업에 없어 면적환산으로 만든 단가는 실측만큼 못 믿는다.
//   실측 사례) 케이스 b(맞뚜껑 40×62×?) 에서 하2 의 AB350 단가는 면적환산 추정값이고
//   4×62 는 실측값인데, 추정 단가가 실측을 이겨 10.8% 더 비싼 견적을 냈다.
//   견적서에는 「⚠추정」이 뜨지만 선택 단계는 실측/추정을 구분하지 않았다.
//   면적환산의 관측 오차는 0.2%(AB350 4×64→하4)지만 다른 지종·절수는 표본이 없다.
//   그래서 "동급이면 실측을 고른다" 정도의 약한 페널티만 준다 — TIE_PCT(1.5%)보다
//   크게 잡아야 동가 구간에서 실측이 이긴다.
export const EST_PRICE_PENALTY = 0.03;

/**
 * @param {{dieline:Object, qty:number, sheetIdHint:string, paperId:string,
 *          manualPrice:string|number, lossOpts:Object, customSheet:?Object}} arg
 * @returns {Object|null} 선택된 판형 + up·R·단가 (종전 sheetInfo)
 */
export function findBestSheet({ dieline, qty, sheetIdHint, paperId,
                                manualPrice = "", lossOpts = {}, customSheet = null }) {
  if (!dieline?.net || !qty) return null;
  const { netW, netH, hangTab } = dieline.net;
  const fixed = sheetIdHint && sheetIdHint !== "auto";
  const candidates = fixed
    ? BASE_SHEETS.filter(s => s.id === sheetIdHint)
    : BASE_SHEETS.filter(s => !s.custom);

  const pool = [];
  for (const base of candidates) {
    // 주문생산은 사용자가 입력한 크기·절수를 사용
    const sh = resolveSheet(base, customSheet);
    if (!sh.w || !sh.h) continue;

    const up = solveImposition({ dieline, sheet: sh, hangTab: hangTab || 0 })?.up || 0;
    if (up === 0) continue;

    // solveImposition 이 이미 발자국 상한을 걸지만, 그래도 초과하면(전 배치 초과 케이스)
    // 실현 불가로 보고 제외 — 단 판형 수동 고정 시에는 남겨서 경고로 보여줌.
    // ※ 이 지역 수율은 >130 컷 전용이다. 화면에 나가는 수율의 정본은 layout.utilPct 다.
    const esh = effectiveSheet(sh.w, sh.h);
    const utilPct = (up * netW * netH) / (esh.long * esh.short) * 100;
    if (!fixed && utilPct > 130) continue;

    const spr       = sheetsPerR(sh);
    const R         = calcR(up, qty, sh, lossOpts);
    const info      = getPaperPriceInfo(paperId, base.id, manualPrice, customSheet);
    const price     = info.price;
    const paperCost = R * price;

    // 공정비 추정 (랭킹 전용) — 판형 티어별 코팅·톰슨 + 도수별 인쇄
    const tier      = sheetTier(sh);
    const coatEst   = RANK_COAT_EST[tier];
    const thomEst   = RANK_THOM_EST[tier];
    const printEst  = Math.max(1, lossOpts.printUnits || 4) * PRINT_UNIT_DEFAULT;
    const processCostEst = calcProcessR(up, qty) * (coatEst + thomEst + printEst);

    const priority = SHEET_PRIORITY[base.id] || 20;
    // rankCost 는 **랭킹 전용** 가공값이다 — 화면에 나가는 금액은 cost 다.
    const estimated = !info.confirmed && !info.manual;
    pool.push({ ...sh, id: base.id, up, R, cost: paperCost, price, priority,
                priceEstimated: estimated, priceEstimateFrom: info.estimateFrom || null,
                rankCost: (paperCost + processCostEst) * (estimated ? 1 + EST_PRICE_PENALTY : 1),
                sheetsPerR: spr, tier });
  }
  // ── 아래 두 함수가 판형 선택 「정책」 전부다. 테스트는 findBestSheet 를 직접
  //    부르거나(권장) 이 두 함수를 import 해서 검증한다. 비교식을 테스트에
  //    복제하면 정렬 키나 부등호 방향을 뒤집어도 테스트가 통과한다(실제 이력).
  if (!pool.length) return null;

  const bestMain = pickFrom(pool.filter(c => c.family !== "하드롱"));
  const bestHadr = pickFrom(pool.filter(c => c.family === "하드롱"));
  return chooseHadrong(bestMain, bestHadr);
}

/** 총비용 최저값의 TIE_PCT 안은 「같은 값」으로 보고 실무 우선순위로 고른다 */
export function pickFrom(list) {
  if (!list?.length) return null;
  const min  = Math.min(...list.map(c => c.rankCost));
  const near = list.filter(c => c.rankCost <= min * (1 + TIE_PCT));
  near.sort((a, b) => a.priority - b.priority || a.rankCost - b.rankCost);
  return near[0];
}

/** 하드롱은 사륙·국전 최선안보다 HADRONG_EDGE 이상 저렴할 때만 채택 */
export function chooseHadrong(bestMain, bestHadr) {
  if (!bestMain) return bestHadr || null;
  if (!bestHadr) return bestMain;
  return bestHadr.rankCost < bestMain.rankCost * (1 - HADRONG_EDGE) ? bestHadr : bestMain;
}

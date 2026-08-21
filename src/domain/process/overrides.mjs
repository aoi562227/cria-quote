import { rprFor } from "../data/process-prices.mjs";

/**
 * 공정 R당단가 — overrides.rprById 가 있으면 그 값.
 * UI 는 이 통로를 절대 채우지 않는다. 옛 견적서를 재현하는 테스트가
 * "그 시점의 단가"를 주입하는 전용 입구다 (단가는 2026-04·06 두 번 인상됐다).
 */
export const rprOf = (ctx, id, opt) => ctx.ov?.rprById?.[id] ?? rprFor(opt, ctx.sheet.tier);

/** 소량 1식 금액 — overrides.lotById 우선. ?? 를 써라. || 면 0 이 무시된다 */
export const lotOf = (ctx, id, opt) => ctx.ov?.lotById?.[id] ?? opt.min;

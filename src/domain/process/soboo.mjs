import { SOBOO_UNIT_DEFAULT } from "../data/print-prices.mjs";

/**
 * 소부 — 도수 기준. UV인쇄는 별도 UV기계라 소부 없음 (견적서 전건 확인).
 * 소부 도수 = 원색(4) + 별색 + 먹 — 원색과 별색은 병행 가능.
 */
export default {
  id: "soboo",
  applies: ctx => ctx.print.totalColors > 0,
  lines: ctx => {
    const unit = ctx.ov?.sobooUnit || SOBOO_UNIT_DEFAULT;
    const n = ctx.print.totalColors;
    return [{
      id: "soboo", name: "소부",
      spec: `${n}도 / ${Math.round(ctx.netSize.netW)}×${Math.round(ctx.netSize.netH)}`,
      qty: n, unit: "도", unitPrice: unit, amount: n * unit, fixed: true,
    }];
  },
};

import { GLUE_MIN_LOT } from "../data/process-prices.mjs";

/**
 * 접착
 * ⚠ 소량 규칙이 코팅·톰슨과 또 다르다 — 공정R 이 아니라 **수량 × 원/EA** 이고,
 *   그 값이 최소 1식(50,000) 미달일 때만 1식으로 올린다.
 */
export default {
  id: "glue",
  applies: ctx => ctx.opts.glue.id !== "none",
  lines: ctx => {
    const glue = ctx.opts.glue;
    const ea  = ctx.ov?.glueEa ?? glue.ea;
    const lot = ctx.ov?.lotById?.glue ?? GLUE_MIN_LOT;
    const raw = ctx.qty * ea;
    const isLot = raw < lot;
    return [{ id: "glue", name: "접착", spec: glue.label,
              qty: isLot ? 1 : ctx.qty, unit: isLot ? "식" : "EA",
              unitPrice: isLot ? lot : ea, amount: Math.max(raw, lot) }];
  },
};

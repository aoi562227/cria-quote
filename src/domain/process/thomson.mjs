import { rprOf, lotOf } from "./overrides.mjs";

/** 톰슨(도무송) — 코팅과 같은 isLot 규칙(소량은 opt.min 1식) */
export default {
  id: "thomson",
  applies: () => true,
  lines: ctx => {
    const thom = ctx.opts.thomson;
    const { processR, isLot } = ctx.reams;
    const rpr = rprOf(ctx, "thomson", thom), lot = lotOf(ctx, "thomson", thom);
    return [{ id: "thomson", name: "톰슨", spec: thom.label,
              qty: isLot ? 1 : processR, unit: isLot ? "식" : "R",
              unitPrice: isLot ? lot : rpr,
              amount: isLot ? lot : Math.round(processR * rpr) }];
  },
};

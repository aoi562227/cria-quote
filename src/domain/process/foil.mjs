import { FOIL_RPR_DEFAULT } from "../data/process-prices.mjs";

/**
 * 박 (금박·은박·먹박)
 * ⚠ isLot(소량 1식) 분기가 **없다** — 코팅·톰슨과 다르다. 공정R × R단가 × 면수.
 *   이 비대칭 때문에 공용 라인 빌더를 만들지 않았다. 묶으면 규칙 차이가 숨는다.
 * 여분 가산도 없다 (조립형 금박 2건 여분 300 ✓).
 */
const rprOfFoil = ctx =>
  ctx.ov?.rprById?.foil ?? (ctx.finish.foil.rpr || FOIL_RPR_DEFAULT);

export default {
  id: "foil",
  applies: ctx => !!ctx.finish.foil,
  lines: ctx => {
    const { processR } = ctx.reams;
    const rpr = rprOfFoil(ctx);
    const sides = Math.max(1, ctx.finish.foil.sides || 1);
    return [{
      id: "foil", name: "박",
      spec: `${ctx.finish.foil.type || "금박"}${sides > 1 ? ` (${sides}면)` : ""}`,
      qty: processR * sides, unit: "R", unitPrice: rpr,
      amount: Math.round(processR * rpr * sides),
    }];
  },
  devLines: ctx => {
    const amt = (ctx.dev.foilDevPrice || 25000) + (ctx.dev.foilFilmPrice || 35000);
    return [{ id: "dev_foil", name: "동판 + 동판필름", qty: 1, unitPrice: amt, amount: amt }];
  },
};

import { coatById, rprFor } from "../data/process-prices.mjs";

/**
 * 부분코팅
 * 종전에는 리터럴 95,000 이 계산부와 라인 표기부에 각각 한 벌씩 박혀 있었다.
 * COAT_OPTS 의 "part" 와 같은 값이므로 그 테이블을 읽는다
 * (small/mid/large 가 전부 95,000 이라 값은 동일하다 — 확인).
 * ⚠ isLot 분기 없음 (박·형압과 같다).
 */
export default {
  id: "partial_uv",
  applies: ctx => !!ctx.finish.puv,
  lines: ctx => {
    const { processR } = ctx.reams;
    const rpr = ctx.ov?.rprById?.partial_uv ?? rprFor(coatById("part"), ctx.sheet.tier);
    const sides = Math.max(1, ctx.finish.puv.sides || 1);
    return [{ id: "partial_uv", name: "부분코팅", spec: `${sides}면`,
              qty: processR * sides, unit: "R", unitPrice: rpr,
              amount: Math.round(processR * rpr * sides) }];
  },
};

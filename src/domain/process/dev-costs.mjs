/**
 * 개발비 중 공정 라인이 없는 항목 (목형 · 부분코팅 필름).
 * 박·형압은 공정 라인과 개발비를 함께 내므로 각자의 파일이 devLines 를 갖는다.
 */

/** 목형 — 실제 120,000~240,000원 */
export const die = {
  id: "dev_die",
  applies: ctx => !!ctx.dev.newDie,
  devLines: ctx => {
    const q = ctx.dev.dieQty || 1;
    const p = ctx.dev.diePrice || 140000;
    return [{ id: "dev_die", name: "목형", qty: q, unitPrice: p, amount: q * p }];
  },
};

/** 부분코팅 필름 — 금액이 입력됐을 때만 줄이 생긴다 */
export const puvFilm = {
  id: "dev_puv_film",
  applies: ctx => (ctx.dev.filmCost || 0) > 0,
  devLines: ctx => {
    const c = ctx.dev.filmCost || 0;
    return [{ id: "dev_puv_film", name: "부분코팅 필름", qty: 1, unitPrice: c, amount: c }];
  },
};

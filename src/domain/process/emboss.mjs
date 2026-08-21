import { EMB_RPR_DEFAULT } from "../data/process-prices.mjs";

/**
 * 형압 (디보싱 / 엠보싱)
 * ⚠ isLot 분기 없음 (박·부분코팅과 같다). 여분은 +50장 가산된다 (reams.LOSS_EMB).
 * 개발비는 **2줄**(개발비 + 필름)을 낸다 — 1공정 1라인 가정이 안 통하는 예.
 */
export default {
  id: "emboss",
  applies: ctx => !!ctx.finish.emb,
  lines: ctx => {
    const { processR } = ctx.reams;
    const rpr = ctx.ov?.rprById?.emb ?? (ctx.finish.emb.rpr || EMB_RPR_DEFAULT);
    return [{ id: "emb", name: "형압", spec: "디보싱",
              qty: processR, unit: "R", unitPrice: rpr,
              amount: Math.round(processR * rpr) }];
  },
  devLines: ctx => {
    const dev  = ctx.dev.embDevPrice  || 90000;
    const film = ctx.dev.embFilmPrice || 28000;
    return [
      { id: "dev_emb",      name: "형압 개발비", qty: 1, unitPrice: dev,  amount: dev  },
      { id: "dev_emb_film", name: "형압 필름",   qty: 1, unitPrice: film, amount: film },
    ];
  },
};

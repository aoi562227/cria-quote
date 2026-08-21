/** 지대 — 지대R × 원/R. 공급가액 = round(R × 단가) ✓ 견적서 전건 일치 */
export default {
  id: "paper",
  applies: () => true,
  lines: ctx => [{
    id: "paper", name: "지대",
    spec: `${ctx.paper.label} · ${ctx.sheet.label.split("(")[0].trim()}`,
    qty: ctx.reams.R, unit: "R",
    unitPrice: ctx.paperPrice.pricePerR,
    amount: ctx.paperPrice.amount,
    note: `${ctx.sheet.up}up · 정미 ${ctx.reams.net.toLocaleString()}` +
          `${ctx.paperPrice.confirmed ? "" : " ⚠추정"}`,
  }],
};

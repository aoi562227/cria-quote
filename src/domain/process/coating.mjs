import { rprOf, lotOf } from "./overrides.mjs";

/**
 * 코팅 — 전후면 같은 종류면 **양면 1줄로 합산**(견적서 표기 방식), 다르면 2줄.
 * 1공정 = 1라인 이 아니라서 공용 라인 빌더로 묶을 수 없다.
 * 소량(공정R 1식) 구간은 R당단가가 아니라 opt.min 을 그대로 청구한다.
 */
export default {
  id: "coating",
  applies: ctx => ctx.opts.coatFront.id !== "none" || ctx.opts.coatBack.id !== "none",
  // IR코팅은 접착면 처리 주의가 필요해 견적서에 경고를 띄운다. 그 사실을 아는 것은
  // 코팅 공정이므로 여기서 낸다 — quote 가 코팅 id 를 알 필요가 없어진다.
  flags: ctx => ({ irWarning: ctx.opts.coatFront.id === "ir" || ctx.opts.coatBack.id === "ir" }),
  lines: ctx => {
    const fc = ctx.opts.coatFront, bc = ctx.opts.coatBack;
    const { processR, isLot } = ctx.reams;
    const fcRpr = rprOf(ctx, "coat_front", fc), bcRpr = rprOf(ctx, "coat_back", bc);
    const fcLot = lotOf(ctx, "coat_front", fc), bcLot = lotOf(ctx, "coat_back", bc);
    const fcAmt = fc.id === "none" ? 0 : isLot ? fcLot : Math.round(processR * fcRpr);
    const bcAmt = bc.id === "none" ? 0 : isLot ? bcLot : Math.round(processR * bcRpr);

    if (fc.id !== "none" && bc.id !== "none" && fc.id === bc.id)
      return [{ id: "coat", name: "코팅", spec: `${fc.label} (양면)`,
                qty: isLot ? 2 : Math.round(processR * 2 * 1000) / 1000,
                unit: isLot ? "식" : "R",
                unitPrice: isLot ? fcLot : fcRpr, amount: fcAmt + bcAmt }];

    return [
      fc.id !== "none" && { id: "coat_front", name: bc.id !== "none" ? "코팅(전면)" : "코팅",
        spec: fc.label, qty: isLot ? 1 : processR, unit: isLot ? "식" : "R",
        unitPrice: isLot ? fcLot : fcRpr, amount: fcAmt },
      bc.id !== "none" && { id: "coat_back", name: "코팅(후면)",
        spec: bc.label, qty: isLot ? 1 : processR, unit: isLot ? "식" : "R",
        unitPrice: isLot ? bcLot : bcRpr, amount: bcAmt },
    ].filter(Boolean);
  },
};

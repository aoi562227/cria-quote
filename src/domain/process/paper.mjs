/**
 * 지대 단가의 **근거 표시** — 견적 라인 note 꼬리표. (정합 N1~N4, 26-09-15)
 *   ""        그 칸에 견적서가 있고 값도 그대로다            (basis "obs")
 *   계열환산   같은 **원지계열**에 견적서가 있다              (basis "fam")
 *             1R = 500 × 절수 = 원지 500장이라 절수가 달라도 원/R 이 같아야 하는
 *             자리다 — 추정이 아니라 **계산**이라 ⚠ 를 안 붙인다.
 *   ⚠환산     그 계열에 견적서가 없어 원지 면적비로 뻗었다    (basis "ratio")
 *   ⚠추정     정합층을 안 탄 옛 경로(지종이 표에 통째로 없을 때)
 * 고객 앞에 나가는 줄이라 세 글자를 안 넘긴다. 자세한 근거는 PaperPanel 이 적는다.
 */
export const markOf = pi =>
  pi.basis === "obs"   ? ""
: pi.basis === "fam"   ? " 계열환산"
: pi.basis === "ratio" ? " ⚠환산"
: pi.confirmed         ? ""
                       : " ⚠추정";

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
    // ★ 26-09-15 — 근거 표시가 2단(실측/⚠추정)에서 **3단**이 됐다(정합 N1~N4 · 위 markOf).
    //   ⚠ 표시는 confirmed 가 아니라 **basis** 를 따른다. 둘은 다른 질문이라서다 —
    //     confirmed 는 「이 칸에 견적서가 있나」(EST_PRICE_PENALTY 가 쓰는 축),
    //     basis 는 「이 **값**이 어디서 왔나」(화면이 말해야 하는 축)다.
    //     N3 로 증거 자격을 잃은 칸(AB295L 하4 · MK350 하4)이 정확히 둘이 갈리는 자리다:
    //     견적서는 있지만(confirmed) 그 수가 다른 계열에서 복사된 것이라 값은 환산이다.
    //     confirmed 로 찍으면 그 칸이 아무 표시 없이 나간다 — 조용히 틀리는 쪽이다.
    note: `${ctx.sheet.up}up · 정미 ${ctx.reams.net.toLocaleString()}` + markOf(ctx.paperPrice),
  }],
};

import { SOBOO_UNIT_DEFAULT } from "../data/print-prices.mjs";

/**
 * 소부 — **판수** 기준. 판수 = 원색(4) + 별색 + 먹 (원색과 별색은 병행 가능).
 *
 * ★ 26-09-15 정정 — 종전 주석은 「UV인쇄는 별도 UV기계라 소부 없음 (견적서 전건 확인)」
 *   이었다. 전 코퍼스 853레코드가 **반증한다**: UV 인쇄 줄이 있는 18건 **전부**가 소부
 *   줄을 따로 갖는다(중앙 22,000원). 「전건 확인」은 UV 금액이 도수와 무관하다는 것을
 *   「판도 없다」로 한 칸 더 밀어 읽은 것이었다. 근거·수치는 print-prices.mjs sidePlates.
 *   ⟹ totalColors(도수) 대신 platesTotal(판수)을 쓴다. 기존 값은 한 번도 안 내려간다.
 */
export default {
  id: "soboo",
  applies: ctx => ctx.print.platesTotal > 0,
  lines: ctx => {
    const unit = ctx.ov?.sobooUnit || SOBOO_UNIT_DEFAULT;
    const n = ctx.print.platesTotal;
    return [{
      id: "soboo", name: "소부",
      spec: `${n}도 / ${Math.round(ctx.netSize.netW)}×${Math.round(ctx.netSize.netH)}`,
      qty: n, unit: "도", unitPrice: unit, amount: n * unit, fixed: true,
    }];
  },
};

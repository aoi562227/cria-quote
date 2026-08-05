import { SPOT_WEIGHT, uvAmount } from "../data/print-prices.mjs";

/**
 * 한 면의 인쇄.
 * 원색·먹  : 공정R × 도수 × 도당단가
 * 별색     : ① 도수환산 → 공정R × (별색도수×3 + 원색·먹도수) × 도당단가
 *            ② R당 고정 → 공정R × 별색R단가  (+ 원색·먹은 도당단가로 따로 더함)
 *
 * 종전에는 computeForQty 클로저 안에 중첩돼 있어 export 가 물리적으로 불가능했고,
 * 그래서 verify-print 가 미러(로직 복제)를 택했다. 인자화해서 밖으로 꺼낸다.
 *
 * @param {{color:boolean,spot:number,black:boolean,uv:boolean}} side
 * @param {{processR:number,printUnit:number,spotMode:"weight"|"rpr",spotRpr:number,qty:number}} env
 * @returns {{qty:number,unit:string,unitPrice:number,amount:number}|null}
 */
export function printSide(side, { processR, printUnit, spotMode, spotRpr, qty }) {
  // UV인쇄: 도수 무관 수량 티어 고정가 (별도 UV기계)
  if (side.uv) {
    const a = uvAmount(qty);
    return { qty: 1, unit: "식", unitPrice: a, amount: a };
  }
  const flatDo = (side.color ? 4 : 0) + (side.black ? 1 : 0);   // 원색·먹 (가중치 1)
  const spotDo = side.spot;                                     // 별색 (가중치 3 또는 별도단가)
  if (flatDo + spotDo === 0) return null;

  if (spotDo > 0 && spotMode === "rpr") {
    const amount = Math.round(processR * spotRpr) + Math.round(processR * flatDo * printUnit);
    return { qty: processR, unit: "R", unitPrice: spotRpr, amount };
  }
  // 인쇄 수량 = 판 걸이 횟수 → 정수 올림
  //   ✓ 8.4R×4도 = 33.6 → 34 / 1.3R×4도 = 5.2 → 6 / 1.4R×4도 = 5.6 → 6 (실측 일치)
  const units = spotDo * SPOT_WEIGHT + flatDo;
  const q = Math.ceil(processR * units);
  return { qty: q, unit: "도·R", unitPrice: printUnit, amount: q * printUnit };
}

/** 견적서 「규격」칸 문자열 */
export const sideSpec = (side, beda) => [
  side.uv ? "UV인쇄" : "",
  side.color ? "원색 4도" : "",
  side.spot > 0 ? `별색 ${side.spot}도${beda ? " 베다" : ""}` : "",
  side.black ? "먹 1도" : "",
].filter(Boolean).join(" + ");

export default {
  id: "print",
  applies: ctx => ctx.print.fHasInk || ctx.print.bHasInk,
  lines: ctx => {
    const { front, back, beda, spotMode, spotRpr, printUnit, bHasInk } = ctx.print;
    const env = { processR: ctx.reams.processR, printUnit, spotMode, spotRpr, qty: ctx.qty };
    const f = printSide(front, env), b = printSide(back, env);
    return [
      f && { id: "print_front", name: bHasInk ? "인쇄(전면)" : "인쇄",
             spec: sideSpec(front, beda), ...f },
      b && { id: "print_back", name: "인쇄(후면)", spec: sideSpec(back, beda), ...b },
    ].filter(Boolean);
  },
};

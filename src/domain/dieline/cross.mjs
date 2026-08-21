import { GLUE_TAB } from "./geometry.mjs";

/**
 * 십자조립 (크로스바텀)
 * ✓ 실측 역산 확정: total_tuck = 7D/4 + 11
 *   70×70×151.5 → 303.33×285(실측) → topLid=66.75, netH=285 ✓
 *   80×20×49    → 211×95(실측)      → topLid=23,    netH=95  ✓
 */
export default {
  id: "cross", label: "십자조립 (크로스바텀)", polygon: true,

  netSize(W, D, H, { hangTab = 0 } = {}) {
    const topLid = D * 7 / 8 + 5.5, botFloor = D * 7 / 8 + 5.5;
    return { netW: 2 * (W + D) + GLUE_TAB, netH: H + topLid + botFloor,
             topLid, botFloor, glueTab: GLUE_TAB, hangTab };
  },

  flaps(W, D, H) {
    const ns = this.netSize(W, D, H);
    const dust = Math.min(0.43 * D + 7, ns.topLid * 0.85);
    return { type: "cross", tipW: null,
      top: [dust, ns.topLid, dust, 0],
      bot: [ns.botFloor * 0.55, ns.botFloor, ns.botFloor * 0.55, ns.botFloor] };
  },
};

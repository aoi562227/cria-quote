import { GLUE_TAB } from "./geometry.mjs";

/**
 * 맞뚜껑 (상하 텍 클로저) — 견적용 칼선 칼선-07 2건 실측 (규격 확인분)
 *   상하 대칭. 한쪽 날개 = 뚜껑패널(≈D) + 텍탭(≈16.5)
 *   netH = H + 2·(D + 16.5) = H + 2D + 33
 *
 *   칼선      W×D×H            실측 세로  공식    Δ
 *   칼선-07   150×69.5×149      321.0    321.0   0.0
 *   칼선-08   150×69.5×219      391.0    391.0   0.0
 *   → 종전 공식(D/2+20 / D/2+15)은 두 건 모두 −67.5mm 부족
 *
 *   칼선-07 접는선 실측: [탭 19.0][뚜껑 21.0+45.5=66.5][몸판 H][66.5][19.0]
 *   66.5 ≈ D−3 (여유), 19.0 = 텍탭
 *
 * ✓ 맞뚜껑A 92×13×140 국2: 224×199 → 회전 3×2 = 6up (견적서 6up 일치)
 *   종전 공식(224×258)으로는 4up 밖에 안 나왔음
 */
export default {
  id: "tuck_both", label: "맞뚜껑 (상하 텍 클로저)", polygon: true,

  netSize(W, D, H, { hangTab = 0 } = {}) {
    const topLid = D + 16.5, botFloor = D + 16.5;
    return { netW: 2 * (W + D) + GLUE_TAB, netH: H + topLid + botFloor,
             topLid, botFloor, glueTab: GLUE_TAB, hangTab };
  },

  flaps(W, D, H) {
    const ns = this.netSize(W, D, H);
    const dust = Math.min(0.43 * D + 7, ns.topLid * 0.85);   // 더스트는 뚜껑보다 낮다
    const bDust = Math.min(dust, ns.botFloor * 0.85);
    // 상단 뚜껑은 전면(1)에만, 하단 뚜껑은 후면(3)에만 — 뚜껑이 2개면 맞물림 불가
    return { type: "tuck", tipW: null,
      top: [dust, ns.topLid, dust, 0],
      bot: [bDust, 0, bDust, ns.botFloor] };
  },
};

/**
 * G형 (톰슨조립) — 하나의 박스 타입, D/H 비율로 공식만 자동 분기
 * 구조상 거싯/트레이 구분 없이 같은 톰슨조립 박스이나,
 * 실측 데이터상 박스 깊이 비율에 따라 두 가지 패턴이 확인됨:
 *   D/H > 0.8 → garo=W+4D+14, sero=2H+3D+1  (덮개·바닥 긴 구조)
 *     ✓ 315×126×113 → 781×592
 *     ✓ 315×113×126 → 833×605
 *   D/H ≤ 0.8 → garo=W+2D+14, sero=H+2D    (덮개·바닥 짧은 구조, 판걸이 회전없음)
 *     ✓ 180×120×85 / 300×200×70 / 300×100×70 / 270×370×70
 *   ⚠ D/H<0.2 극단 평판 → 공식 미확정 (예: 323×234×36은 실제 571×507)
 *
 * noRotate 는 **정적 플래그가 아니다** — netSize() 가 D/H 로 분기해 반환한다.
 * 교차형 전개도라 회전 배치가 물리적으로 불가능한 쪽만 true.
 *
 * polygon:false — 이 구조의 칼선 폴리곤은 확정돼 있지 않다. 배치는 netW×netH
 * 직사각 1조각으로 한다. 조용히 다른 구조의 폴리곤을 갖다 쓰면 G형이 망가진다.
 */
export default {
  id: "gtype", label: "G형 (톰슨조립)", labelJa: "G型（打ち抜き組立）",
  tag: "G형", polygon: false, thomsonDefault: "g_std",

  netSize(W, D, H, { hangTab = 0 } = {}) {
    const ratio = D / H;
    const useExtended = ratio > 0.8;
    let warning = null;
    if (ratio >= 0.7 && ratio <= 0.9) {
      warning = `D/H=${ratio.toFixed(2)} 경계값 — 공식 정확도 낮을 수 있음`;
    } else if (ratio < 0.2) {
      warning = `D/H=${ratio.toFixed(2)} 극단 평판 — 공식 오차 가능`;
    }
    // note = 「뚜껑/바닥/접착날개」 대신 화면에 찍을 한 줄. 구조가 소유하므로
    // BoxSpec 에 isGtype 같은 구조별 if 가 생기지 않는다.
    const common = { topLid: 0, botFloor: 0, glueTab: 14, hangTab, warning,
                     note: ["G형 (톰슨조립)", "접착날개 14mm"] };
    return useExtended
      ? { ...common, netW: W + 4 * D + 14, netH: 2 * H + 3 * D + 1, noRotate: false }
      : { ...common, netW: W + 2 * D + 14, netH: H + 2 * D,         noRotate: true  };
  },

  flaps: () => null,
};

/**
 * 전개도 전체크기 직접입력 — 슬리브·손잡이형·싸바리처럼 W·D·H 공식이 없는 구조.
 * hidden:true — UI 는 「규격 입력 방식」 드롭다운으로 고르고, 박스 구조 목록에는 안 낸다.
 * 사용자가 준 netW×netH 를 그대로 쓴다. 날개 계산이 없으므로 폴리곤도 직사각 1조각.
 */
export default {
  id: "direct", label: "전개도 전체크기 직접입력", tag: "직접입력",
  hidden: true, polygon: false,

  netSize(W, D, H, { netW = 0, netH = 0, hangTab = 0 } = {}) {
    if (!netW || !netH) return null;
    return { netW, netH, glueTab: 0, topLid: 0, botFloor: 0, hangTab,
             note: ["전체크기 직접입력", "날개 계산 없음"], warning: null };
  },

  flaps: () => null,
};

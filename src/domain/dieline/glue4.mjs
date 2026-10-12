/**
 * 4면접착 (규격도) — 사용자가 그려 준 규격 도면을 **패널 단위로 그대로** 옮긴 구조 (26-10-02)
 *
 *   전개도 가로 = W + 2·max(H + 20, 40)      전개도 세로 = 2D + 2H + 30
 *
 *            ┌────────┐                    가운데 열(폭 W) 위→아래
 *            │뚜껑날개 30│                      뚜껑날개 30 · 뚜껑 D · 뒷벽 H · 바닥 D · 앞벽 H
 *            ├────────┤                    뒷벽·앞벽 양옆: 모서리 접착날개  40 × H
 *            │ 뚜껑 D  │                    바닥 양옆   : 옆벽 H × D + 바깥 띠 20 × D
 *        ┌───┼────────┼───┐
 *        │날개│ 뒷벽 H  │날개│
 *     ┌─┬┴───┼────────┼───┴┬─┐
 *     │띠│옆벽 │ 바닥 D  │옆벽 │띠│
 *     └─┴┬───┼────────┼───┬┴─┘
 *        │날개│ 앞벽 H  │날개│
 *        └───┴────────┴───┘
 *
 * 근거 — `docs/g형예시/4면접착예시2_200x80x70.pdf` (이름에 치수가 적힌 쪽) 사각형 13개를 mm 로 읽어 대조:
 *     200×80×70 → 도면 380.6×330.0 / 식 380×330   (0.6 은 오른쪽 띠가 0.6mm 떨어져 그려진 탓 — 왼쪽은 딱 붙어 있다)
 *   13패널 전부 일치(test/verify-dieline 「규격 도면 대조」).
 *
 * ★ 고정 치수 셋 — LID 30 · CORNER 40 · STRIP 20
 *   두 도면(예시·예시2)에서 **같은 값**이었다(바닥이 250×100 이든 200×80 이든). 상자 크기에 비례하지 않는
 *   고정값으로 넣었다(사용자 「알아서」 26-10-02 — 관측 2/2). 실제 칼선이 오면 그 값으로 고쳐라.
 *
 * ⚠ **예시1(`4면접착예시.pdf` · 바닥 250×100)은 이 식에 안 맞는다 — 도면 자체가 벽 높이를 둘로 그렸다.**
 *     옆벽 40 · 앞/뒷벽 55. 상자는 벽 높이가 하나여야 모서리 날개가 옆벽에 붙는다.
 *     H=55 로 넣으면 옆벽 2칸·띠 2칸이 15mm 어긋나고, H=40 으로 넣으면 앞/뒷벽·모서리 6칸이 어긋난다.
 *   어느 쪽이 맞는지 **도면으로는 못 가른다** → 예시2 만 근거로 삼았다. verify-dieline 이 예시1 의 불일치를
 *   「문서화된 차이」로 찍는다(조용히 버리지 않는다). 사용자에게 물어야 풀린다.
 *
 * ⚠ 띠(STRIP 20)의 뜻(접착면인지 접어 넣는 날개인지)은 도면에 없다 — 별색으로 칠해져 있을 뿐이다.
 *   이름을 「바깥 띠」로만 두고 접착 표시(해칭)는 하지 않는다. 선 구분도 도면에 없어 folds 를 지어내지 않는다.
 *
 * ⚠ 접착 단가 — GLUE_OPTS 에 「4면」 칸이 **없다**(단면 20 · 삼면 30 …). 구조와 접착 방식은 별개 입력이고
 *   이 파일은 접착 기본값을 건드리지 않는다. 4면접착의 원/EA 는 견적서 근거가 생길 때 넣어라.
 */
import { rect } from "./geometry.mjs";

export const LID = 30, CORNER = 40, STRIP = 20;

/** 가운데 열 왼쪽 끝 x — 옆벽+띠(H+STRIP)와 모서리 날개(CORNER) 중 더 나온 쪽이 전개도 왼쪽 끝이다. */
const reach = H => Math.max(H + STRIP, CORNER);

/** 패널 13개 — [이름, x0, y0, x1, y1] (mm · 좌상단 원점 · y 아래로). */
export function panels(W, D, H) {
  const xC0 = reach(H), xC1 = xC0 + W;
  const y = [0, LID, LID + D, LID + D + H, LID + 2 * D + H, LID + 2 * D + 2 * H];
  const corner = (name, yi) => [
    [name + "(좌)", xC0 - CORNER, y[yi], xC0, y[yi + 1]],
    [name + "(우)", xC1, y[yi], xC1 + CORNER, y[yi + 1]],
  ];
  return [
    ["뚜껑날개", xC0, y[0], xC1, y[1]],
    ["뚜껑", xC0, y[1], xC1, y[2]],
    ["뒷벽", xC0, y[2], xC1, y[3]], ...corner("모서리날개(뒤)", 2),
    ["바닥", xC0, y[3], xC1, y[4]],
    ["옆벽(좌)", xC0 - H, y[3], xC0, y[4]], ["옆벽(우)", xC1, y[3], xC1 + H, y[4]],
    ["바깥 띠(좌)", xC0 - H - STRIP, y[3], xC0 - H, y[4]], ["바깥 띠(우)", xC1 + H, y[3], xC1 + H + STRIP, y[4]],
    ["앞벽", xC0, y[4], xC1, y[5]], ...corner("모서리날개(앞)", 4),
  ];
}

export default {
  id: "glue_4side", label: "4면접착 (규격도)", labelJa: "四面貼り（規格図）",
  tag: "4면접착",
  verified: "규격 도면 1건", polygon: true,

  netSize(W, D, H, { hangTab = 0 } = {}) {
    return {
      netW: W + 2 * reach(H), netH: LID + 2 * D + 2 * H,
      topLid: 0, botFloor: 0, glueTab: 0, noRotate: false, hangTab,
      note: ["4면접착 (규격도)", `뚜껑날개 ${LID} · 모서리날개 ${CORNER} · 띠 ${STRIP}`],
      warning: null,
    };
  },

  flaps: () => ({ type: "panels", top: [0], bot: [0] }),

  /** 배치용 볼록 조각 7개: 가운데 열 · 바닥 줄 좌/우(옆벽+띠) · 모서리 날개 4. */
  pieces(W, D, H) {
    const ps = panels(W, D, H);
    const xC0 = reach(H), xC1 = xC0 + W, netH = LID + 2 * D + 2 * H;
    const yBk0 = LID + D, yB0 = LID + D + H, yB1 = LID + 2 * D + H;
    const pieces = [
      rect(xC0, 0, xC1, netH),
      rect(xC0 - H - STRIP, yB0, xC0, yB1), rect(xC1, yB0, xC1 + H + STRIP, yB1),
      rect(xC0 - CORNER, yBk0, xC0, yB0), rect(xC1, yBk0, xC1 + CORNER, yB0),
      rect(xC0 - CORNER, yB1, xC0, netH), rect(xC1, yB1, xC1 + CORNER, netH),
    ];
    const meta = [
      { panel: 1, part: "body" }, { panel: 0, part: "wall" }, { panel: 2, part: "wall" },
      { panel: 4, part: "flap" }, { panel: 4, part: "flap" }, { panel: 4, part: "flap" }, { panel: 4, part: "flap" },
    ];
    const cuts = ps.map(([, x0, y0, x1, y1]) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]);
    return { pieces, meta, cuts, folds: [], panels: [] };
  },
};

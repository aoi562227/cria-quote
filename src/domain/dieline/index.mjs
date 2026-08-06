// ══════════════════════════════════════════════════════════════════
//  dieline/index.mjs — 박스 구조 레지스트리
//
//  구조를 추가하려면 파일 1개 + 아래 REGISTRY 배열 1줄이면 된다.
//  구조 파일이 소유하는 것 (UI·톰슨·배치가 자동으로 따라온다):
//    id · label · verified · polygon · thomsonDefault · netSize() · flaps() · pieces()?
// ══════════════════════════════════════════════════════════════════
import tuckBoth  from "./tuck-both.mjs";
import cross     from "./cross.mjs";
import glue3     from "./glue3.mjs";
import gtype     from "./gtype.mjs";
import gtypeTray from "./gtype-tray.mjs";
import direct    from "./direct.mjs";
import { rect, piecesFromFlaps } from "./geometry.mjs";

const REGISTRY = [tuckBoth, cross, glue3, gtype, gtypeTray, direct];
const BY_ID = Object.fromEntries(REGISTRY.map(s => [s.id, s]));

/**
 * UI 드롭다운 목록 (종전 BOX_TYPES).
 *   tag      = 견적서 배너용 짧은 이름 (없으면 label 첫 낱말)
 *   verified = 검증 근거 문자열 (예 "칼선 4건") 또는 undefined.
 *              ⚠ !!verified 로 접지 마라 — UI 가 그대로 찍어서 「✓true」가 된다.
 */
export const structures = () =>
  REGISTRY.filter(s => !s.hidden)
          .map(({ id, label, tag, verified }) =>
                ({ id, label, tag: tag || label.split(" ")[0], verified: verified || null }));

export const getStructure = id => BY_ID[id] ?? null;

/** 알 수 없는 id 는 null. 종전 default 분기(D/2+20)는 도달 불가였다 — 되살리지 않는다. */
export function calcNetSize(W, D, H, id = "tuck_both", opt = {}) {
  const st = BY_ID[id];
  return st ? st.netSize(W, D, H, opt) : null;
}

export function getFlaps(W, D, H, id) {
  return BY_ID[id]?.flaps?.(W, D, H) ?? null;
}

/**
 * 전개도를 볼록 조각의 합집합으로. NFP 배치와 화면 그림이 이걸 함께 쓴다.
 * @returns {{pieces, net, flaps, meta, cuts, folds, panels}|null}
 */
export function dielinePieces(W, D, H, id = "tuck_both", opt = {}) {
  const st = BY_ID[id];
  if (!st) return null;
  const net = st.netSize(W, D, H, opt);
  if (!net) return null;
  if (!st.polygon) {
    // ⚠ gtype·gtype_tray·direct 는 폴리곤이 확정돼 있지 않다. 직사각 1조각으로 대체한다.
    //   조용히 다른 구조의 폴리곤으로 갈아타면 G형이 망가진다 — 그래서 분기를 코드에 남긴다.
    return { pieces: [rect(0, 0, net.netW, net.netH)], net, flaps: null,
             meta: [{ panel: 0, part: "body" }],
             cuts: [[[0, 0], [net.netW, 0], [net.netW, net.netH], [0, net.netH], [0, 0]]],
             folds: [], panels: [] };
  }
  const flaps = st.flaps(W, D, H);
  // piecesFromFlaps 는 「몸통4+접착탭1」 슬리브 위상 전용이다. 다른 위상의 구조는
  // 자기 파일에 pieces() 를 선언해 geometry.mjs 를 건드리지 않고 끼어든다.
  const geo = st.pieces?.(W, D, H, { net, flaps, opt })
           ?? piecesFromFlaps({ W, D, H, net, flaps, opt });
  if (!geo) return null;           // 위상 불일치 — 조용히 틀린 도형을 흘리지 않는다
  return { ...geo, net, flaps };
}

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
// 노브의 허용범위는 **그 노브를 읽는 구조 파일**이 소유한다. 여기서 5/60 을 다시
// 적으면 두 벌이 되고, 한쪽만 고치는 순간 화면이 다시 거짓말을 한다.
import { TAB_MIN, TAB_MAX, isValidTabW } from "./cross.mjs";

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

/**
 * ★ 26-08-25 — `opt` 를 받는다(종전 3인자). 목형별 구조 옵션이 여기로 흐른다.
 *   기존 호출부는 opt 를 안 주므로 기본값으로 동작한다(하위호환).
 */
export function getFlaps(W, D, H, id, opt = {}) {
  return BY_ID[id]?.flaps?.(W, D, H, opt) ?? null;
}

/**
 * ★ 목형별 구조 옵션 — 「이 구조가 실제로 읽는 노브」의 단일 출처.
 *
 * 왜 레지스트리가 이걸 아나 — UI 가 구조 id 로 if 를 쓰기 시작하면 구조를 하나 더할 때
 * 화면 3곳을 같이 고쳐야 한다(§3 「새 박스 구조 추가 = 파일 1개 + 1줄」이 깨진다).
 * 화면은 이 표만 읽고 위젯을 뿌린다. 노브가 없는 구조는 빈 배열이라 아무것도 안 그린다.
 *
 * ⚠ 여기 적힌 값이 곧 **기본값의 정본**이다. 구조 파일과 두 벌이 되지 않게, 화면은
 *   「기본으로 계산하면 실제로 얼마가 나오는가」를 dieline.net 에서 다시 읽어 찍는다.
 *   (BoxSpec 「목형 미지정 — 표준 가정」 줄.)
 *
 *   kind "choice" → options[{id,label}] · kind "number" → unit·placeholder
 *   `auto` = 값을 안 준 상태의 화면 표기(= 구조 파일의 기본값)
 */
export const DIE_OPTS = {
  glue_3side: [{
    key: "deepFlap", kind: "choice", label: "아래 띠 깊은 날개",
    auto: "양쪽 다 깊게 (표준 가정)",
    note: "목형을 펼쳐 아래쪽 큰 날개가 접착탭에서 먼 쪽인지 붙은 쪽인지 보고 고른다. ⚠ 붙은 쪽은 지금 모델이 mm 단위로 못 덮는다(소스코 1.0mm 부족·칼선-14 탭 날개 결손) — 그 두 계열은 자동이 더 안전하다",
    options: [
      // ⚠ Select 는 `o.id ?? o` 를 value 로 읽는다 — 키 이름이 id 여야 한다.
      { id: "",     label: "자동 — 목형 미지정" },
      { id: "far",  label: "탭에서 먼 쪽만 깊다 (실측 3벌)" },
      // ⚠ near 는 **라이브 표본이 0** 이다 — 실측 near 목형 둘(소스코·칼선-14)을
      //   픽스처가 일부러 비워 뒀기 때문에 verify-imposition 의 잔차·커버리지
      //   게이트가 이 코드 줄을 원리적으로 안 지나간다(겹침만 「실측 자세」 절이 잰다).
      //   3지선다 중 하나가 무검증 경로라는 사실을 **라벨이 직접 말한다** — 화면에서
      //   고를 수 있는 값의 검증 상태를 사용자가 모르면 정직성 규약이 깨진다.
      { id: "near", label: "탭에 붙은 쪽만 깊다 (실측 2벌 · ⚠ 잔차·커버리지 미검증)" },
      { id: "both", label: "양쪽 다 깊다 (표준 가정과 같음)" },
    ],
  }],
  cross: [{
    key: "glueTabW", kind: "number", label: "접착탭 실폭", unit: "mm",
    auto: "24.03mm (실측 5벌 상한)", placeholder: "12.03 ~ 24.03",
    min: TAB_MIN, max: TAB_MAX, step: 0.01, valid: isValidTabW,
    note: "십자만 탭 폭이 목형마다 흩어진다(실측 24.03/15.70/14.70/13.70/12.03). " +
          `허용 ${TAB_MIN}~${TAB_MAX}mm — 그 밖은 오타로 보고 표준 봉투로 접는다`,
  }],
};

/**
 * 이 구조가 읽는 노브만 남긴 사본. 다른 구조의 값이 섞여 캐시 키를 흔들지 않게 한다.
 *
 * ★ 26-08-25 — **유효성까지 여기서 본다.** 종전에는 빈값만 걸렀고, 범위 밖 값은
 *   그대로 통과해 `dieline.dieOpt` 에 남았다. 구조 파일(cross.netSize)은 그걸 접고
 *   기본 봉투로 계산하는데 화면은 dieOpt 를 「적용된 값」이라 믿고 원값을 찍어서
 *   「✓ 목형 지정 — 접착탭 실폭 999mm 으로 계산했다」가 나왔다(cross.mjs 주석 참조).
 *   접는 판정을 한 곳으로 올렸으니 이제 `dieline.dieOpt` 는 **도메인이 실제로 쓴 값**
 *   그 자체다 — 화면·쇼룸·점수판이 그걸 그대로 믿어도 된다.
 *   · kind "choice" → options 의 id 중 **빈 id 가 아닌 것**만 통과
 *   · kind "number" → 구조가 준 `valid`(없으면 min/max)만 통과
 */
export function pickDieOpt(id, opt = {}) {
  const out = {};
  for (const k of DIE_OPTS[id] || []) {
    const v = opt[k.key];
    if (v === undefined || v === null || v === "") continue;
    if (k.kind === "choice") {
      if (!k.options.some(o => o.id !== "" && o.id === v)) continue;
      out[k.key] = v;
    } else {
      const n = Number(v);
      const ok = k.valid ? k.valid(n)
               : Number.isFinite(n) && (k.min == null || n >= k.min) && (k.max == null || n <= k.max);
      if (!ok) continue;
      out[k.key] = n;
    }
  }
  return out;
}

/**
 * 화면이 「넣은 값이 접혔다」를 말할 수 있게 — 거부된 노브 목록.
 * 정직성 규약: 접힌 사실을 화면이 **먼저** 말한다(BoxSpec 「범위 밖」 줄).
 *
 * ★ `allow` = 「그럼 뭐가 되는가」를 **레지스트리가 완성한 문장**으로 준다.
 *   왜 화면이 아니라 여기서 만드나 — 화면이 `min~max` 를 조립하면 choice 노브에서
 *   둘 다 undefined 라 「허용 undefined~undefined」가 찍힌다. 실제로 닿는 경로가
 *   있다: 사양 링크(`decodeSpec`)는 바깥에서 온 해시라 `dieDeep~zzz` 같은 값이
 *   상태에 그대로 앉는다(Select 는 그런 값을 못 만들지만 URL 은 만든다).
 *   허용 목록의 정본은 DIE_OPTS 이므로 문장도 여기서 만든다.
 * @returns {Array<{key,label,raw,kind,min,max,unit,allow}>}
 */
export function rejectedDieOpt(id, opt = {}) {
  const kept = pickDieOpt(id, opt);
  return (DIE_OPTS[id] || [])
    .filter(k => { const v = opt[k.key];
                   return v !== undefined && v !== null && v !== "" && kept[k.key] === undefined; })
    .map(k => ({ key: k.key, label: k.label, raw: opt[k.key], kind: k.kind,
                 min: k.min, max: k.max, unit: k.unit || "",
                 allow: k.kind === "choice"
                   ? k.options.filter(o => o.id !== "").map(o => o.label).join(" / ")
                   : `${k.min}~${k.max}${k.unit || ""}` }));
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
  // ★ 26-08-25 — flaps 에 opt 를 관통시킨다. 목형별 노브(glue3 deepFlap · cross
  //   glueTabW)가 폴리곤을 바꾸는 통로가 이 한 줄이다. 종전에는 netSize 만 opt 를 받고
  //   flaps 는 못 받아서, 「크기는 목형별인데 그림은 표준」인 두 벌이 생길 수 있었다.
  const flaps = st.flaps(W, D, H, opt);
  // piecesFromFlaps 는 「몸통4+접착탭1」 슬리브 위상 전용이다. 다른 위상의 구조는
  // 자기 파일에 pieces() 를 선언해 geometry.mjs 를 건드리지 않고 끼어든다.
  const geo = st.pieces?.(W, D, H, { net, flaps, opt })
           ?? piecesFromFlaps({ W, D, H, net, flaps, opt });
  if (!geo) return null;           // 위상 불일치 — 조용히 틀린 도형을 흘리지 않는다
  return { ...geo, net, flaps };
}

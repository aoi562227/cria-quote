// ══════════════════════════════════════════════════════════════════
//  box-types.mjs — 박스 구조 드롭다운 목록.
//
//  domain/dieline 레지스트리를 화면용으로 펼치는 지점을 **한 곳**으로 묶는다.
//  BoxSpec(드롭다운)과 QuoteSheet(견적서 구조 태그)가 같은 배열을 봐야 하므로,
//  양쪽에서 structures() 를 따로 부르지 않고 이 모듈을 공유한다.
// ══════════════════════════════════════════════════════════════════
import { structures, getStructure } from "../domain/dieline/index.mjs";

/**
 * 드롭다운 항목. 검증 표기(✓칼선 4건)는 **여기서** 붙인다 —
 * 구조 파일의 label 은 순수 이름이고 근거는 verified 필드다.
 * 종전에는 label 안에 「✓칼선실측」이 섞여 있어서 표시 문자열이 곧 근거 표기였고,
 * 태그 추출(label 첫 낱말) 규칙과도 얽혀 있었다.
 */
export const BOX_TYPES = structures().map(({ id, label, verified }) => ({
  id, label: verified ? `${label} ✓${verified}` : label,
}));

/** 견적서 배너의 구조 태그. 구조가 tag 를 소유하므로 label 을 문자열 자르지 않는다.
 *  hidden 구조(direct)도 물어볼 수 있게 레지스트리를 직접 본다. */
export const boxTypeTag = id => {
  const st = getStructure(id);
  return st ? (st.tag || st.label.split(" ")[0]) : null;
};

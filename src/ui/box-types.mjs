// ══════════════════════════════════════════════════════════════════
//  box-types.mjs — 박스 구조 드롭다운 목록.
//
//  domain/dieline 레지스트리를 화면용으로 펼치는 지점을 **한 곳**으로 묶는다.
//  BoxSpec(드롭다운)과 QuoteSheet(견적서 구조 태그)가 같은 배열을 봐야 하므로,
//  양쪽에서 structures() 를 따로 부르지 않고 이 모듈을 공유한다.
// ══════════════════════════════════════════════════════════════════
import { structures } from "../domain/dieline/index.mjs";

export const BOX_TYPES = structures();

/** 견적서 배너의 구조 태그 — 라벨 첫 낱말만 (예 "맞뚜껑 (상하 텍 클로저)" → "맞뚜껑") */
export const boxTypeTag = id => BOX_TYPES.find(b => b.id === id)?.label.split(" ")[0];

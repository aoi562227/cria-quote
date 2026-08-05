// ══════════════════════════════════════════════════════════════════
//  dieline.mjs — 재export shim
// ══════════════════════════════════════════════════════════════════
//  실물은 domain/dieline/ 로 옮겼다(구조 1개 = 파일 1개 레지스트리).
//  이 파일은 옛 import 경로를 살려 두기 위한 얇은 껍데기다.
//  test/scorecard2.mjs 가 이 경로로 들어와 up 재현율 10/15 를 재는데,
//  이관 직후 그 점수가 그대로 나오는지가 이관 정확성의 게이트였다.
//  테스트가 domain/dieline/index.mjs 를 직접 import 하도록 바뀌면 삭제한다.
// ══════════════════════════════════════════════════════════════════
export { calcNetSize, getFlaps, dielinePieces } from "./domain/dieline/index.mjs";
export { GLUE_TAB, TONGUE_INSET, xEdges } from "./domain/dieline/geometry.mjs";

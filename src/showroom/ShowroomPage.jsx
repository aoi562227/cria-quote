// ══════════════════════════════════════════════════════════════════
//  ShowroomPage.jsx — 전시회 부스에서 **고객에게 보여주는** 한 화면.
//
//  실무용 견적 앱(App.jsx 좌7섹션 + 견적서)과 목적이 다르다. 여기서 보여줄 것은 셋뿐이다:
//    ① 진짜 도면이 판 위에 **실제로 어떻게 앉는지** (겹치지 않는 칼선 윤곽)
//    ② 몇 개 앉는지 (up)
//    ③ 그래서 개당 얼마인지
//  그 외의 것 — 발자국%·세대수·seed·flipRule·물림 띠·후보 점수 — 은 **전면에 두지 않는다.**
//  고객은 그 숫자를 못 읽고, 읽으려는 순간 대화가 우리 내부 사정으로 끌려간다.
//
//  깔끔함의 규칙 (지키지 않으면 이 화면의 존재 이유가 사라진다)
//  ────────────────────────────────────────────────────
//   · 색은 **잉크 한 색 + 강조 한 색**. 칸마다 다른 색을 칠하지 않는다(LayoutViz 반면교사).
//   · 칸 위에 배지·번호를 붙이지 않는다. 선택은 테두리 하나로 말한다.
//     (SVG <text> 는 **0개**다. 도면 표기의 이름은 판 밖 HTML 범례가 갖는다 — Legend 참조.)
//   · 채우기는 **접착면 하나뿐**이고 그것도 칼선과 **같은 잉크의 투명도**다(색 추가 0).
//     판은 흰 종이, 도형은 얇은 검은 선. 실제 인쇄물이 그렇게 생겼다.
//     실측: stroke 색이 3종(#1b2129·#d5dae1·#c3cad4) → **2종**(#d5dae1 을 없앴다)으로 줄었다.
//   · ★ 접착면 표기는 **세 자리가 완전히 같아야 한다** — 미리보기 · 판 · 범례 견본.
//     한 자리만 해칭이고 나머지가 평톤이면 고객은 범례를 읽고 판에서 그 무늬를 찾다가
//     못 찾는다(적대검증 실측: 범례 해칭 vs 판 평톤, 둘 사이 거리 0px · 미리보기와 424px).
//     그래서 셋 다 **평톤 하나**로 통일했다. 왜 해칭을 버렸는지는 GLUE_TONE 주석에 있다.
//
//  ★ 겹침은 **절대 그리지 않는다.**
//    그릴 배치는 전부 showroom-core.auditItems 를 통과해야 한다(commit 이 게이트다).
//    드래그 미리보기도 마찬가지 — resolveDrop 이 ok 를 안 주면 **마지막으로 성립한
//    자리**에 머문다. 겹친 그림을 잠깐이라도 보여주지 않는다.
//
//  기하는 한 줄도 여기 없다. 스냅·겹침은 ui/viz/nest-drag.mjs, 자동 배치는
//  nest-free.mjs, 판은 imposition.printableArea, 단가는 domain/quote.buildQuote 다.
//  이 파일은 **그리기와 포인터**만 한다.
// ══════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { buildQuote } from "../domain/quote.mjs";
import { findSheetBase, resolveSheet, PRESS_MAX_LONG, PRESS_MAX_SHORT } from "../domain/data/sheets.mjs";
import { readDielineFile } from "../domain/pdf-dieline.mjs";
// 「고른 후보 → 그 후보의 polygons」 규칙은 state.mjs 가 소유한다 (두 벌 중 어느 쪽이
// 정답인지 아는 곳은 한 군데여야 한다 — ARCHITECTURE §10). 쇼룸도 같은 함수를 부른다.
// nextThomId — 구조가 톰슨 기본값을 선언했으면 그걸로 바꾼다. 견적 앱(App.jsx 의
// handleBoxType)과 **같은 함수**를 부른다: 여기서 따로 적으면 같은 구조를 골라도 두 화면의
// 톰슨이 갈린다. (⚠ BoxSpec.jsx 에는 이 호출이 없다 — 대조하려면 App.jsx 를 열어라.)
import { pdfPickOf, specHash, customSheetOf, noCostOfHash, nextThomId } from "../ui/state.mjs";
import { BOX_TYPES } from "../ui/box-types.mjs";
import { resolveDrop, findSpot, itemW, itemH, SNAP_PX } from "../ui/viz/nest-drag.mjs";
import {
  SHEET_CHOICES, frameOf, partOf, auditItems, autoPlace, fillMore,
  quoteInputOf, specSummaryOf, seedFromAuto, capToQuoteUp, seedOf, precisionKeyOf,
  linkStateOf, baseOf, specOf, qtyStepsOf, qtyRowsOf, upForPrice, resetKindOf,
  paperChoices, coatChoices, glueChoices, thomChoices, T, LANGS,
} from "./showroom-core.mjs";
// 고객에게 **얼마로 보여줄지**는 price-formula 가 소유한다 — 파서·반올림·통화 표기·
// 저장·「거부되면 원가로 안 돌아간다」까지 전부. 이 파일은 그 결과만 그린다.
import {
  shownPriceOf, shownRowsOf, adminViewOf, loadPriceCfg, savePriceCfg, isPriceOn,
  CUR_CHOICES, ADMIN_T,
} from "./price-formula.mjs";

// ── 색 · 치수 ──────────────────────────────────────────────────────
//  ★ 회색 두 단의 용도가 갈려 있다 — 섞지 마라.
//    · sub   #6a7280 = **읽어야 하는 글**. 범례 뜻풀이 · 출처 · 정밀도 · 표준사양 · 재단
//            안내. 판 배경(#eceff3) 대비 **4.20:1**.
//    · faint #aab2bd = **값에 붙은 이름표**(「가로 W」「전개도」처럼 옆의 숫자가 뜻을
//            나르는 것)와 장식. 대비 **1.86:1** — 글을 여기 두면 안 읽힌다.
//  종전에는 범례 뜻풀이·출처·정밀도가 faint 였다. 이 파일은 오시선 #d5dae1 의 1.41:1 을
//  「선이 있다는 사실조차 전달하지 못한다 · 부스 조명에서 통째로 소실된다」고 판정해
//  걷어냈는데(아래 도면 표기 절), **글자에는 그 기준을 안 쓰고 있었다.** 글자는 선보다
//  더 높은 대비가 필요하다. DOM 에 있는 정직성 문구는 읽히지 않으면 없는 것과 같다.
//  ⚠ 4.20:1 은 WCAG 1.4.3 의 4.5:1 에 아직 못 미친다. 더 올리려면 #5b6472(5.21:1)가
//    답인데 그건 **색을 하나 늘리는 것**이고, 이 화면의 규칙(알록달록 금지·색 추가 0)과
//    맞바꿀 값이 0.3 포인트뿐이다. 글자 크기를 24px 로 키우는 쪽은 레이아웃을 부순다.
const C = {
  bg: "#eceff3", panel: "#ffffff", line: "#dde2e9", soft: "#f5f7fa",
  ink: "#11161d", sub: "#6a7280", faint: "#aab2bd",
  acc: "#0b62d6", accBg: "#eaf1fd", bad: "#c0362c", warn: "#a15c07",
};
const FONT = "'Segoe UI','Noto Sans KR','Noto Sans JP',sans-serif";

// ══════════════════════════════════════════════════════════════════
//  도면 표기 3종 — 색을 늘리지 않는다. **잉크 한 색의 형태 차이**로만 가른다.
// ══════════════════════════════════════════════════════════════════
//  실측 근거 (칼선 PDF 6건 · 고객사 5곳 · 구조 2종):
//    · 칼선과 오시선은 원본에서 **같은 잉크(K100)·같은 굵기**다. dash 연산자 0회,
//      선굵기·색 분기 0회, stroke 연산자가 파일당 1~2회 — 한 그래픽 상태로 한 번에
//      그려진다. 즉 「실선/파선」도 「진함/옅음」도 **원본에는 없고 우리가 얹는 관용**이다.
//      그래서 색으로 가르지 않고 **파선 하나로만** 가른다 — 원본에 가장 충실하고
//      화면에서 가장 잘 보인다.
//    · 종전 오시선 #d5dae1 은 흰 판 대비 **1.41:1** 이었다(칼선 #1b2129 는 16.20:1).
//      1.41:1 은 「선이 있다」는 사실조차 전달하지 못한다 — 부스 조명·빔프로젝터에서
//      통째로 소실된다. 되돌리지 마라. 위계를 주고 싶으면 #5b6472(5.98:1) 까지다.
//  ⚠ dash 값의 단위는 **화면 px** 다 — 폴리라인이 vectorEffect="non-scaling-stroke"
//    이므로 굵기와 dash 가 둘 다 뷰박스 배율을 타지 않는다. 그래서 판을 작게 그려도
//    파선이 파선으로 보인다. 값은 가시성 산술로 정했다(실측값이 아니다): 우리가 그리는
//    가장 짧은 오시선이 접착탭 경계(맞뚜껑 D=15 → 15mm)이고 화면 배율 실측이
//    0.41~1.62 px/mm(미리보기 0.41~0.44 · 판 1.23~1.62)라 화면 길이가 6~24px 다.
//    종전 "4 3"(주기 7px)은 대시를 1~2개만 남겨 실선과 구별이 안 됐고,
//    "2.5 2"(주기 4.5px)면 최소 1.4주기가 남는다.
//    ★ 브라우저 실측으로 확인했다 — 같은 선을 배율 ×0.44 / ×1 / ×4 로 래스터해서 센 결과
//      non-scaling-stroke 는 세 배율 전부 **대시 3px · 주기 4.44px** 로 동일했고,
//      대조군(vectorEffect 없음)은 2.53 / 4.44 / 16.67px 로 배율을 그대로 탔다.
const INK = "#1b2129";        // 칼선·오시선·접착면 공통 잉크 (K100 먹)
const CUT_W = 0.9, CUT_W_SEL = 1.15, CUT_W_PREV = 1;
const CREASE_W = 0.7, CREASE_DASH = "2.5 2", CREASE_DASH_PREV = "3 2.5";
/**
 * 접착면 톤 — 같은 잉크의 투명도만 쓴다(색 추가 0). 칼선·오시선이 그 위에 올라간다.
 *
 * ⚠ 해칭(45° pattern)을 썼다가 **버렸다.** 두 가지 이유이고 둘 다 실측이다:
 *   ① `pattern` 은 `vectorEffect="non-scaling-stroke"` 같은 장치가 없어 간격이 mm(사용자
 *      단위)로 굳는다. 그런데 판의 배율은 컨테이너 크기에 따라 **0.45~1.62 px/mm** 로
 *      3.6배 움직인다(desktop 0.9351 · tablet 0.4496 · 좁은 판 1.62 실측). 어느 mm 값을
 *      골라도 한쪽 배율에서는 1px 미만으로 뭉개져 회색 덩어리가 되고, 폭 14.3mm 탭에서는
 *      그 덩어리가 곧 톤이다 — 즉 해칭은 **배율을 못 버틴다.**
 *   ② 그래서 해칭이 살아 있던 곳은 높이가 112px 로 **고정된** 미리보기 하나뿐이었고,
 *      판은 평톤, 범례 견본은 또 해칭이었다. 표기가 세 벌로 갈렸다(위 머리말 참조).
 *   되돌리려면 판의 실제 CTM 을 측정해 pattern 셀을 px 로 환산해야 한다(ResizeObserver
 *   + state). 표기 하나에 렌더 루프를 늘릴 값이 없다.
 *
 * 값 0.20 은 대비 산술로 정하고 **래스터로 확인했다**(칼선 실측이 주는 값이 아니다):
 *   흰 판(#fff) 위 #1b2129 α → 종전 0.10 은 **1.24:1** 로 WCAG 1.4.11(의미 있는 그래픽
 *   3:1)을 크게 밑돌았다. 0.20 은 산술 1.50:1 이고, 판 svg 를 그대로 캔버스에 그려 센
 *   실측이 **1.52:1** 이다 — desktop(1.26 px/mm · 탭 14×125px, 평균 209.3/255) 과
 *   tablet(0.45 px/mm · 탭 7×59px, 평균 209.7) 이 **같은 값**이다. 톤은 알파라 배율을
 *   타지 않는다(해칭을 버린 이유가 여기서 되돌아온다).
 *   3:1 은 톤으로는 원리적으로 못 넘는다 (#a0a4a9 급이 되어 그 위의 칼선·오시선을
 *   삼킨다 = 정보를 잃는다). 대신 이 화면에서 접착면의 **경계**는 칼선(16.20:1)과
 *   오시선이 이미 긋고 있고, 톤이 하는 일은 「이 닫힌 면이 그 면이다」 하나다.
 *   그 몫에는 1.52:1 이 선다.
 * ⚠ 테두리를 두르지 마라 — 접착탭의 한 변은 **오시선**이다. 실선 테두리를 깔면 파선의
 *   빈칸이 잉크로 채워져 「접히는 선」이 「잘리는 선」으로 보인다(표기가 거짓말을 한다).
 */
const GLUE_TONE = 0.2;
/** 범례 견본은 CSS 라 SVG fillOpacity 를 쓸 수 없다 — **같은 잉크·같은 알파**를 rgba 로
 *  적는다. 27,33,41 = #1b2129(INK). ⚠ 두 값이 갈리는 순간 「범례가 약속한 표기가 판에는
 *  없다」가 되살아난다. 한쪽만 고치지 마라. */
const GLUE_FILL_CSS = `rgba(27, 33, 41, ${GLUE_TONE})`;
/** 클릭과 드래그를 가르는 거리(mm 환산 전 화면 px) */
// ── 관리자 진입: 제목 연타 (26-08-26) ──────────────────────────────
//  **모듈 스코프**에 둔다. 컴포넌트 안 useRef 로 두었더니 클릭 사이에 초기화돼
//  사람 손 속도(간격 60ms 이상)에서 한 번도 안 열렸다 — ShowroomPage 의
//  bumpTitleTap 주석 참조. 여기 두면 무슨 일이 있어도 카운터가 산다.
//  간격 1200ms — 800 은 사람이 「또박또박 세 번」 누르는 속도에 빡빡하다.
//  부스에서 급할 때 눌러야 하는 것이라 넉넉한 쪽이 맞다. 우연히 세 번
//  연속 누를 일은 여전히 없다(라벨·배지·커서 변화가 없는 글자다).
const TAP_GAP_MS = 1200;
const TAP_NEED = 3;
const tapState = { n: 0, t: 0 };

const DRAG_MIN_PX = 2;
const UNDO_MAX = 30;
/** 판만 바뀌었을 때 「다시 앉히기」를 묶는 시간(ms).
 *  수량 칸은 키스트로크마다 상태가 바뀌고 그때도 자동판형이 뒤집힐 수 있다 —
 *  묶지 않으면 「5000」 네 글자에 최대 200만 회 탐색이 네 번 돈다(실측 1회 최대 153ms).
 *  400 = 사람이 다음 글자를 치기 전에 멈추는 시간보다 길고, 부스 대화에서 기다림으로
 *  느껴지기 전이다. 아래 reseat 효과 주석 참조. */
const RESEAT_MS = 400;

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const int = v => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
const mm1 = v => String(Math.round(v * 10) / 10);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ══════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════
//  ★ `carried` = 견적서 화면에서 URL 해시로 실려 온 **상태 한 벌**(없으면 null).
//    쇼룸은 그것을 계산의 바탕(base)으로 깔고, 화면에서 만질 수 있는 것만 덮어쓴다.
//    null 이면 종전 그대로 표준사양으로 돈다 — 단독 진입(#showroom)이 안 깨진다.
//    ⚠ 렌더 중에 바뀌지 않는다: 해시가 바뀌면 App 이 화면을 통째로 갈아끼운다.
//      그래서 아래 useState 초기화 함수로 한 번만 읽는다(값이 바뀌어 재초기화되기를
//      기대하지 마라 — 그건 마운트 때만 돈다).
export default function ShowroomPage({ carried = null }) {
  const [lang, setLang] = useState("ko");
  const t = T(lang);

  // 전개도 전체크기 직접입력으로 실려 온 사양(슬리브 등)은 W·D·H 공식이 없다.
  // 훅이 아니라 파생값이다 — carried 는 이 화면이 사는 동안 안 바뀐다.
  const netDims = carried?.sizeMode === "net";

  // ── 입력 (항목을 최소로) ────────────────────────────────────────
  //  기본값은 실려 온 사양이 있으면 그 값, 없으면 종전 표준 예시값이다.
  const [srcMode, setSrcMode] = useState("box");        // "box" | "pdf"
  const [boxType, setBoxType] = useState(() => carried?.boxType || "glue_3side");
  const [bW, setBW] = useState(() => carried?.bW ?? "140");
  const [bD, setBD] = useState(() => carried?.bD ?? "43");
  const [bH, setBH] = useState(() => carried?.bH ?? "130");
  const [nW, setNW] = useState(() => carried?.nW ?? "");
  const [nH, setNH] = useState(() => carried?.nH ?? "");
  const [pdfDl, setPdfDl] = useState(null);             // readDieline 결과 + page/pickIdx
  const [sheetId, setSheetId] = useState(() => carried?.sheetId || "auto");
  const [qty, setQty] = useState(() => carried?.qty ?? "4000");

  // ── ★ 고객과 같이 넣는 사양 한 벌 (26-08-26) ─────────────────────
  //  사용자 요구: 「고객이랑 같이 화면 보면서 이거 사양을 넣어야하는데?」 종전에는 도수·
  //  지종·코팅을 바꾸려면 원가 전체가 뜨는 견적 앱으로 돌아가야 했다 — 고객 앞에서 못 연다.
  //  ★ 칸 목록·초기값·거르기는 전부 showroom-core 가 소유한다(SHOWROOM_SPEC_KEYS / specOf).
  //    여기서 키를 다시 적으면 계산·링크·화면이 세 벌로 갈린다.
  //  ★ 초기값이 `baseOf(carried)` 인 것이 요점이다 — 계산의 바탕과 **같은 출처**라서,
  //    아무것도 안 만진 상태의 화면 값과 계산 값이 원리적으로 같다(단독 진입 223원 · 실려
  //    온 사양 204원이 그대로 산다). 상태 14칸을 따로 두면 그 둘이 조용히 갈린다.
  //  ⚠ 훅 하나에 묶은 이유: 칸마다 useState 를 두면 14개가 되고, quoteInputOf 에 넘길 때
  //    다시 객체로 모아야 해서 목록이 이 파일에 한 벌 더 생긴다.
  const [over, setOver] = useState(() => specOf(baseOf(carried)));
  const put = (k, v) => setOver(p => ({ ...p, [k]: v }));
  // 별색은 0~8 — 견적 앱(PrintPanel)과 같은 범위로 접는다. 여기서 넓히면 두 화면이 갈린다.
  const putSp = (k, v) => put(k, String(Math.max(0, Math.min(8, parseInt(v, 10) || 0))));

  // ── 배치 ────────────────────────────────────────────────────────
  const [items, setItemsRaw] = useState(null);          // 확정 배치 (null = 아직 안 앉힘)
  // ★ 그 배치가 **어느 판의 것인지**를 같이 든다 (26-08-26 · 적대검증 minor ⑥).
  //   배치 좌표는 판 좌표 mm 라, 판이 바뀌면 같은 배열이 **다른 판의 배치**를 뜻하게 된다.
  //   그 사이 한 렌더에서 「새 판 + 옛 up」으로 금액이 나가는 것을 upForPrice 가 막는다
  //   (판정은 showroom-core 가 소유한다 — 왜 그 프레임이 위험한지도 거기 적혀 있다).
  //   ⚠ setItems 를 지나지 않는 배치 갱신을 만들지 마라 — 그 순간 짝이 어긋난다.
  const [itemsSheet, setItemsSheet] = useState(null);
  const [hand, setHand] = useState(false);
  const [sel, setSel] = useState(null);
  const [undo, setUndo] = useState([]);
  const [autoInfo, setAutoInfo] = useState(null);
  const [busy, setBusy] = useState("");                 // "" | "pdf" | "auto" | "fill"
  const [msg, setMsg] = useState("");
  const [prev, setPrev] = useState(null);               // 드래그 미리보기
  const [dropping, setDropping] = useState(false);

  // ── 고객 표시가 (관리자 수식) ────────────────────────────────────
  //  ★ 관리자 진입은 **Ctrl+Alt+M** 하나뿐이다. 왜 버튼이 아니고 URL 도 아닌가:
  //   ① 부스에서 화면을 만지는 것은 **고객의 손가락**이다. 수식자 조합은 터치로
  //      원리적으로 만들 수 없다 — 눈에 안 띄는 버튼(모서리 3연타 같은 것)은
  //      우연히 열린다.
  //   ② 주소창은 **고객 앞에 떠 있다**(§13 이 거래처명을 안 싣는 이유가 그것이다).
  //      `?admin=1` 은 숨은 모드가 있다고 광고하는 셈이고, 게다가 이 화면은 300ms 마다
  //      replaceState 로 주소를 자기가 다시 쓴다 — 플래그가 그 동기화와 싸운다.
  //   ③ 조합을 M 으로 잡은 이유는 **마진**이다. Windows/Chrome 에서 Ctrl+Alt+M 은
  //      예약 조합이 아니다.
  //  ⚠ 손배치 단축키(onKey: r · Delete · Ctrl+Z)와 겹치지 않는다 — 그쪽은 판 위에
  //    포커스가 있을 때만 돌고 수식자 조합도 다르다.
  const [adminOpen, setAdminOpen] = useState(false);
  //  제목 3연타 → 관리자.
  //  ★ 26-08-26 재작성 — 종전 useRef 판은 **사람 손 속도에서 한 번도 안 열렸다.**
  //    실측: 간격 0ms 로 세 번이면 열리는데 60ms 를 두면 다섯 번을 눌러도 안 열린다
  //    (직접 핸들러 호출로도 재현 — 이벤트 경로 문제가 아니다). 즉 클릭 사이에
  //    카운터가 초기화됐다. 컴포넌트 상태(adminOpen)는 살아남는데 카운터만 죽는
  //    조합이라 원인을 특정하지 못했고, **원인을 더 파는 대신 카운터를 컴포넌트
  //    밖으로 뺐다** — 모듈 스코프면 React 가 인스턴스·ref 를 어떻게 다루든 산다.
  //    사용자가 「관리자페이지는 어딨지?」라고 두 번 물은 것이 이 고장이다.
  //  ⚠ 되돌려 useRef 로 옮기지 마라. 그러면 조용히 다시 안 열린다 —
  //    화면에 아무 표시가 없어서 **고장인지 사용법을 모르는 건지 구분이 안 된다.**
  //    verify-speclink 가 TAP_GAP_MS 와 TAP_NEED 를 계약으로 잡고 있다.
  const bumpTitleTap = () => {
    const now = Date.now();                       // performance.now 대신 — 탭 간 비교만 한다
    tapState.n = now - tapState.t > TAP_GAP_MS ? 1 : tapState.n + 1;
    tapState.t = now;
    if (tapState.n >= TAP_NEED) { tapState.n = 0; setAdminOpen(v => !v); }
  };
  const [priceCfg, setPriceCfg] = useState(loadPriceCfg);
  // ★ 이 주소가 「가격을 가림」 표시를 달고 왔는가 (state.noCostOfHash · §16).
  //   달고 왔는데 이 브라우저에 수식이 없으면 = **남에게 보낸 링크를 남이 연 것**이다.
  //   그때 원가로 접히면 감추려던 수가 그대로 뜬다 — 「—」를 그린다.
  //   ⚠ 마운트 때 한 번만 읽는다. 아래 syncHash 가 300ms 마다 주소를 다시 쓰므로
  //     계속 읽으면 우리가 방금 쓴 값을 되읽는 고리가 된다.
  const [linkNoCost, setLinkNoCost] = useState(
    () => (typeof window === "undefined" ? false : noCostOfHash(window.location.hash)));
  useEffect(() => { savePriceCfg(priceCfg); }, [priceCfg]);
  // 수식을 **전부 비웠다** = 관리자가 「이제 안 가린다」를 명시로 조작한 것이다.
  // 링크가 달고 온 가림 비트도 같이 내린다 — 안 내리면 화면이 「—」에 갇힌다.
  // (고객은 이 경로에 못 닿는다. 관리자 패널 안에서만 부른다.)
  const setCfg = fn => {
    const next = typeof fn === "function" ? fn(priceCfg) : fn;
    setPriceCfg(next);
    if (!isPriceOn(next)) setLinkNoCost(false);
  };
  useEffect(() => {
    if (typeof window === "undefined") return;
    const on = e => {
      if (e.ctrlKey && e.altKey && (e.key === "m" || e.key === "M" || e.code === "KeyM")) {
        e.preventDefault();
        setAdminOpen(v => !v);
      }
      // ★ 닫기는 **한 손가락**이어야 한다 — 열기와 대칭이 아닌 것이 맞다.
      //   우연히 닫히는 것은 무해하고, 우연히 열리는 것이 유출이다. 실측 지적:
      //   패널이 「원가(개당) 345원」을 띄운 채 떠 있는데 빠져나가는 길이 수식자
      //   두 개 조합과 33×18px 짜리 글자 링크뿐이라, 고객이 다가올 때 급히 못 닫았다.
      //   ⚠ 판 위 손배치의 Escape(선택 해제)와 안 부딪친다 — 그쪽은 svg 에 포커스가
      //     있을 때만 돌고, 이 핸들러는 패널이 열려 있을 때만 소비한다.
      else if (e.key === "Escape") setAdminOpen(v => (v ? false : v));
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const fileRef = useRef(null);
  const keptFile = useRef(null);

  // ── 도면 ────────────────────────────────────────────────────────
  const pick = useMemo(() => (srcMode === "pdf" ? pdfPickOf({ pdfDl }) : null), [srcMode, pdfDl]);
  // 규격 경로는 셋이다: PDF bbox / 전개도 직접입력 / W·D·H. 뒤 둘은 화면에서 만진다.
  //  ★ `over` 가 여기 실리면 지종·도수·코팅·후가공·접착·톰슨이 **한 덩어리로** 흐른다:
  //    아래 qAuto(판형 추천) · qShow(단가) · qtyRows(수량별) · linkState(링크)가 전부
  //    이 한 객체를 편다. 그래서 지종을 바꾸면 판형 추천도 같이 움직인다(실측: 아코팩350 →
  //    4×62 4up 에서 4×64 2up 으로 판형이 뒤집힌다).
  const spec = useMemo(() => ({
    mode: srcMode === "pdf" ? "pdf" : (netDims ? "net" : "box"),
    boxType, W: num(bW), D: num(bD), H: num(bH),
    netW: srcMode === "pdf" ? (pick?.bbox?.w ?? 0) : num(nW),
    netH: srcMode === "pdf" ? (pick?.bbox?.h ?? 0) : num(nH),
    qty: int(qty), over, carried,
  }), [srcMode, netDims, boxType, bW, bD, bH, nW, nH, pick, qty, over, carried]);

  // ── 견적 호출 2회 ────────────────────────────────────────────────
  //  ① qAuto : up 을 안 주고 부른다 → 도메인이 **판형을 고르고** 격자 배치를 푼다.
  //            그 판이 곧 화면에 그리는 판이고, 격자해는 자동 배치의 비교 대상이다.
  //  ② qShow : 앉힌 개수를 overrides.up 으로 넣어 부른다 → 그 up 의 지대R·단가.
  //  App.jsx 는 buildQuote 를 1회만 부르지만(성능 규율), 여기는 「판을 고르는 호출」과
  //  「내가 앉힌 up 으로 다시 재는 호출」이 원리적으로 둘이다. 둘 다 useMemo 로 묶는다.
  const qAuto = useMemo(() => {
    try { return buildQuote(quoteInputOf({ ...spec, sheetId, up: 0 })); }
    catch (e) { console.error(e); return null; }
  }, [spec, sheetId]);

  const sheetBase = useMemo(() => {
    const id = sheetId !== "auto" ? sheetId : (qAuto?.sheet?.id || null);
    return id ? findSheetBase(id) : null;
  }, [sheetId, qAuto?.sheet?.id]);
  // ⚠ 주문생산(custom) 판형은 쇼룸 **목록에는 없다**(크기 입력이 따로 필요해 뺐다).
  //   그런데 견적서에서 **실려 올 수는 있다.** 그때 크기를 같이 넘기지 않으면
  //   resolveSheet 가 기본값 890×670 으로 접혀서, **그린 판과 다른 판의 금액**이 나간다
  //   (금액 쪽은 base 의 cusW/cusH 로 제대로 계산된다 — 그래서 조용히 갈린다).
  //   판 크기를 읽는 규칙은 state.mjs 가 소유하므로 같은 함수를 부른다.
  const customSheet = useMemo(() => (carried ? customSheetOf(carried) : null), [carried]);
  const frame = useMemo(() => (sheetBase ? frameOf(resolveSheet(sheetBase, customSheet)) : null),
                        [sheetBase, customSheet]);

  // ★ 배치를 놓는 **유일한 문**. 배치와 「그 배치가 놓인 판」을 **한 번에** 갱신한다 —
  //   따로 두면 둘이 어긋나는 렌더가 생기고, 그게 minor ⑥ 이 잡은 −39% 저가 프레임이다.
  //   ⚠ setItemsRaw 를 직접 부르지 마라(여기 말고는 부를 이유가 없다).
  //   ⚠ 갱신함수 꼴(prev => next)은 안 받는다 — 지금 호출부가 전부 값을 준다.
  const setItems = next => { setItemsRaw(next); setItemsSheet(sheetBase?.id ?? null); };

  // 부품(충돌 도형 + 그릴 윤곽). dieline 은 **key** 로 의존한다 — 참조로 걸면 글자 한 자
  // 칠 때마다 NFP 사전계산(조각²)이 다시 돈다 (BoxSpec.handPart 와 같은 이유).
  const dlKey = qAuto?.dieline?.key || "";
  const part = useMemo(() => {
    if (srcMode === "pdf") return pick ? partOf({ kind: "pdf", pick }) : null;
    return qAuto?.dieline ? partOf({ kind: "box", dieline: qAuto.dieline }) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcMode, pick, dlKey]);

  // 도형이나 판이 바뀌면 앉힌 배치는 **뜻을 잃는다**(좌표가 다른 판의 좌표가 된다).
  // 조용히 남겨두면 옛 배치의 up 으로 새 도형의 단가가 나간다 — 지우고 다시 앉히게 한다.
  //
  // ★ 26-08-26 2차 — 키를 **둘로 갈랐다**(적대검증 major ①). 「도형이 바뀐 것」과
  //   「판만 바뀐 것」은 다른 사건이고, 뒤쪽이 **부스 표준 경로**다: 지종 드롭다운 한 번에
  //   자동판형이 뒤집히고(AB라이트295 → 두성 디프매트308 에서 4×62 → 4×64) 종전에는
  //   그 한 번에 배치·금액·수량표가 통째로 사라졌다. 판정은 showroom-core.resetKindOf.
  const shapeKey = `${srcMode}|${dlKey}|${pick?.bbox?.w ?? 0}x${pick?.bbox?.h ?? 0}` +
                   `|${pdfDl?.pickIdx ?? 0}|${pdfDl?.page ?? 0}`;
  const resetKey = `${shapeKey}|${sheetBase?.id ?? ""}`;
  const lastShape = useRef(shapeKey);
  // 판만 바뀌었을 때 「다시 앉히기」를 예약하는 카운터. 값 자체에는 뜻이 없다 —
  // **바뀌었다는 사실**만으로 아래 예약 효과를 다시 돌려 앞선 타이머를 지운다(= 디바운스).
  const [reseat, setReseat] = useState(0);
  useEffect(() => {
    // ⚠ items 는 의존 배열에 없다 — 이 효과가 도는 순간의 items 는 **방금 뜻을 잃은
    //   그 배치**이고, 우리가 알고 싶은 것은 「지울 것이 있었나」뿐이다.
    const kind = resetKindOf(lastShape.current, shapeKey, (items?.length || 0) > 0);
    lastShape.current = shapeKey;
    setItems(null); setHand(false); setSel(null); setUndo([]); setAutoInfo(null);
    // 침묵을 깬다 — 금액이 「—」로 가고 판이 빈 사각형이 되는 이유를 화면이 말한다.
    setMsg(kind === "sheet" ? t.sheetChanged : "");
    if (kind === "sheet") setReseat(n => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  // ★ 금액에 쓸 판걸이 수 — **배치가 지금 그리는 판의 것일 때만** 센다.
  //   판정은 showroom-core.upForPrice(그 주석이 −39% 저가 프레임의 실측을 갖고 있다).
  //   그래서 과도기 프레임의 금액은 원리적으로 「—」다.
  const up = upForPrice(items, itemsSheet, sheetBase?.id ?? null);
  const qShow = useMemo(() => {
    if (!(up > 0) || !sheetBase) return null;
    try { return buildQuote(quoteInputOf({ ...spec, sheetId: sheetBase.id, up })); }
    catch (e) { console.error(e); return null; }
  }, [spec, sheetBase?.id, up]);

  // ★ 그리기 게이트 — 확정 배치가 겹치거나 판 밖이면 **그리지 않는다.**
  //   commit 이 이미 막지만, 그리는 자리에서 한 번 더 재는 것이 이 화면의 계약이다.
  const audit = useMemo(() => (part && frame && items
    ? auditItems(part.P, items, frame) : null), [part, frame, items]);
  const drawable = !items || (audit?.ok ?? false);
  const drawItems = (prev?.items || items || []);

  // ── 배치 확정 (겹치면 안 받는다) ─────────────────────────────────
  const commit = (next, failMsg) => {
    if (!part || !frame) return false;
    const a = auditItems(part.P, next, frame);
    if (!a.ok) { setMsg(failMsg || t.overlapRefused); return false; }
    setUndo(u => [...u.slice(-(UNDO_MAX - 1)), items ?? []]);
    setItems(next); setMsg("");
    return true;
  };

  // ⚠ 꺼낼 값은 **렌더 클로저의 undo** 에서 읽는다. 종전에는 setUndo 의 갱신함수 안에서
  //   back 을 집어내 바깥 변수에 담았는데, React 는 그 함수를 **호출 시점에 부른다고
  //   보장하지 않는다**(렌더 단계에서 부른다. 조기 bailout 계산은 최적화일 뿐이다).
  //   실측: 같은 코드가 드래그 직후에는 되돌아가고 「빈 곳 채우기」 실패 뒤에는
  //   back 이 undefined 로 남아 조기 return — **스택만 비고 배치는 그대로**였다.
  //   되돌리기가 가끔 먹지 않는 것은 부스에서 제일 나쁜 종류의 고장이라 원인을 없앤다.
  const doUndo = () => {
    if (!undo.length) return;
    const back = undo[undo.length - 1];
    setUndo(u => u.slice(0, -1));
    setItems(back); setSel(null); setMsg("");
  };

  // ── PDF ─────────────────────────────────────────────────────────
  const loadPdf = async (file, page = 0) => {
    if (!file || busy) return;
    setBusy("pdf"); setMsg("");
    try {
      const r = await readDielineFile(file, { page });
      keptFile.current = file;
      // 1순위(chosen)를 기본 선택으로 — BoxSpec.loadPdf 와 **같은 규칙**이다.
      const idx = Math.max(0, (r.candidates || []).findIndex(c => c.chosen));
      setPdfDl({ ...r, page, pickIdx: idx });
      setSrcMode("pdf");
    } catch (e) {
      // 조용히 무시하면 「드롭이 안 먹었다」로 읽힌다. 이유를 그대로 남긴다.
      setPdfDl(null);
      setMsg(`✕ ${file.name} — ${e?.message || String(e)}`);
    } finally { setBusy(""); }
  };

  // 견적서가 판걸이를 고정해 왔으면 자동해를 그 수에 맞춘다 — 많으면 자르고, 적으면
  // 자유해로 **복원**한다(판정은 showroom-core.seedFromAuto). 복원에 실패하면 조용히
  // 되돌리지 않고 화면이 말한다 — 그 침묵이 major ⑨(+30%) 의 본체였다.
  // 사람이 직접 한 행동(+한 장 · 빈 곳 채우기 · 삭제)에는 걸지 않는다 — 아래 한 곳뿐이다.

  // ── 자동 배치 ────────────────────────────────────────────────────
  //  ⚠ 자동 재계산 금지 — 입력이 바뀌면 배치는 **지워질 뿐**이고 다시 풀지 않는다.
  //    거는 자리는 **셋뿐**이다: 이 버튼 · 사양이 실려 왔을 때의 **마운트 1회**
  //    (바로 아래 autoRan) · **판만 바뀌었을 때의 다시 앉히기**(그 아래 reseat).
  //    그 셋 말고 어디에도 걸지 마라.
  //  ★ 셋째를 26-08-26 2차에 더했다(major ①). 그 규율이 막으려던 것은 「글자 한 자 칠
  //    때마다 최대 200만 회 탐색」(실측 153ms)이고, 셋째는 그 경우가 **아니다**:
  //     · **도형이 그대로일 때만** 돈다(치수를 치면 도형이 바뀌므로 종전대로 안 돈다).
  //     · 400ms 디바운스라 수량을 「5 → 50 → 500 → 5000」으로 쳐도 **한 번만** 돈다.
  //    @param noteOf 성공했는데 고정 판걸이 안내가 없을 때 적을 말. (n) => string
  const runAuto = (noteOf) => {
    if (!part || !frame) { setMsg(t.needDraw); return; }
    // ⚠ 다시 앉히는 중(noteOf)에는 **먼저 뜬 말을 지우지 않는다** — 지우면 그 사이
    //   온보딩 문구(「「자동 배치」를 누르면 …」)가 깜빡이고, 그건 지금 상황이 아니다.
    setBusy("auto"); if (!noteOf) setMsg("");
    // 진행 표시를 **먼저 그리게** 한 뒤 계산한다. 같은 프레임에서 돌리면
    // 「계산 중…」이 화면에 뜨지 않고 브라우저만 멈춰 보인다.
    setTimeout(() => {
      let r = null;
      try { r = autoPlace(part.P, frame, qAuto?.layout?.up > 0 ? qAuto.layout.boxes : []); }
      catch (e) { console.error(e); }
      setBusy("");
      if (!r) { setMsg(t.overlapRefused); return; }
      setAutoInfo(r);
      setSel(null); setUndo([]);
      if (!r.up) { setItems([]); setMsg(r.rejected ? t.overlapRefused : t.noFit); return; }
      // ★ 여기서만 실려 온 고정 판걸이를 반영한다 (major ⑨ — 아래 주석)
      const s = seedFromAuto(carried, r);
      setItems(s.items);
      // 되돌아간 것을 **조용히** 두지 않는다: 되살렸으면 되살렸다고, 못 그렸으면
      // 못 그렸다고 화면이 말한다. 침묵이 +30% 의 본체였다.
      setMsg(s.restored ? t.pinRestored(s.restored)
           : s.shortOf  ? t.pinLost(s.shortOf, s.items.length)
           : typeof noteOf === "function" ? noteOf(s.items.length)
           : "");
    }, 24);
  };

  // ── 실려 온 사양은 **들어오자마자 앉힌다** (적대검증 minor ⑤) ────────
  //  204원을 확정해 넘어왔는데 첫 화면이 「— up · 개당 — 원」이면, 고객 앞에서
  //  화면을 넘긴 직후 빈 값이 보인다. 사양이 실려 온 것은 「이 값을 보여달라」는
  //  뜻이므로 버튼을 기다리지 않는다.
  //  ⚠ 위 「자동 재계산 금지」는 그대로다 — 이건 **마운트 1회**뿐이다(ref 가 막는다).
  //    입력이 바뀔 때마다 돌리면 치수 칸에 글자 한 자 칠 때마다 최대 200만 회 탐색이
  //    돈다(실측 최대 153ms). 그 규율을 깨지 않는다.
  //  ⚠ 단독 진입(#showroom · carried 없음)은 종전 그대로 안내문으로 시작한다 —
  //    그 화면의 첫 문장이 「「자동 배치」를 누르면 …」이고 그건 온보딩이다.
  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !carried || !part || !frame) return;
    autoRan.current = true;
    runAuto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carried, part, frame]);

  // ── ★ 판만 바뀌었을 때 **같은 도형을 새 판에 다시 앉힌다** (적대검증 major ①) ──
  //  부스 표준 경로다: 고객 앞에서 지종을 바꾸면 자동판형이 뒤집히고(4×62 → 4×64)
  //  종전에는 그 한 번에 금액이 「—」로 가고 판이 빈 사각형이 됐다. 도형은 그대로이므로
  //  재배치가 정당하고, 겹침 게이트(autoPlace 안의 auditItems)는 그대로 걸린다.
  //  ⚠ **여기서 판단하지 않는다** — 「판만 바뀌었나」는 showroom-core.resetKindOf 가
  //    위 리셋 효과에서 이미 정했고, 여기는 그 예약을 실행할 뿐이다.
  //  ⚠ 400ms 디바운스인 이유: 수량 칸은 키스트로크마다 상태가 바뀌고 그때도 자동판형이
  //    뒤집힐 수 있다(「5 → 50 → 500 → 5000」). 묶지 않으면 탐색이 네 번 돈다.
  //    reseat 가 다시 바뀌면 아래 정리 함수가 앞선 타이머를 지운다 = 마지막 한 번만.
  //  ⚠ 이 효과는 **runAuto 아래**에 있어야 한다 — 위에 두면 클로저가 옛 판의 frame·part
  //    를 물고 있어 방금 바뀐 판이 아니라 **옛 판**에 앉힌다.
  useEffect(() => {
    if (!reseat) return;
    const id = setTimeout(() => runAuto(n => t.sheetReseated(n)), RESEAT_MS);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reseat]);

  // ── 자유 배치 채택 ───────────────────────────────────────────────
  //  ★ 자동 배치가 **격자해**를 앉히는 이유는 autoPlace 주석에 있다(두 화면이 같은
  //    금액을 말해야 한다). 자유해는 버려지지 않고 이 버튼으로 온다 — 실무앱의
  //    「손배치로 이어받기」와 같은 **확정 절차**다. commit 을 지나므로 겹침 게이트가
  //    그대로 걸리고, 채택하면 up 이 올라 돌아가는 링크가 판걸이 직접입력으로
  //    그 up 을 실어 견적서도 같은 수로 청구한다.
  const adoptFree = () => {
    const xs = autoInfo?.freeItems;
    if (!xs?.length) return;
    setSel(null);
    if (commit(xs)) setMsg(t.adopted(xs.length));
  };

  const runFill = () => {
    if (!part || !frame || !items?.length) return;
    setBusy("fill"); setMsg("");
    setTimeout(() => {
      let r = null;
      try { r = fillMore(part.P, frame, items); } catch (e) { console.error(e); }
      setBusy("");
      if (!r || !r.ok || !r.added) { setMsg(t.addedNone); return; }
      setUndo(u => [...u.slice(-(UNDO_MAX - 1)), items]);
      setItems(r.items); setMsg(t.addedN(r.added));
    }, 24);
  };

  // ── 손배치 ───────────────────────────────────────────────────────
  const enterHand = () => {
    if (!part || !frame) { setMsg(t.needDraw); return; }
    if (!items) {
      // 씨앗은 자동 격자해 → 없으면 한 장. 한 장도 안 들어가면 켜지 않는다.
      // 손배치 씨앗도 고정값을 넘기지 않는다 — 넘치면 자른다(복원은 하지 않는다:
      // 손배치는 사람이 여기서부터 직접 만드는 자리라 자유해를 몰래 앉히면 안 된다).
      const seed = capToQuoteUp(carried, seedOf(qAuto?.layout?.up > 0 ? qAuto.layout.boxes : []));
      if (seed.length) setItems(seed);
      else {
        const proto = { x: 0, y: 0, flipped: false, rotated: false };
        const spot = findSpot(part.P, proto, [], { w: frame.fitW, h: frame.fitH }, { x: 0, y: 0 });
        if (!spot) { setMsg(t.noFit); return; }
        setItems([{ ...proto, ...spot }]);
      }
    }
    setHand(true); setMsg(t.hintHand);
  };

  const addOne = () => {
    if (!part || !frame) return;
    const base = items || [];
    const proto = base.length ? { ...base[base.length - 1] } : { x: 0, y: 0, flipped: false, rotated: false };
    const spot = findSpot(part.P, proto, base, { w: frame.fitW, h: frame.fitH }, { x: 0, y: 0 });
    if (!spot) { setMsg(t.noRoom); return; }   // 아무 데나 겹쳐 놓지 않는다
    if (commit([...base, { ...proto, ...spot }])) setSel(base.length);
  };

  const turn = deg90 => {
    if (sel == null || !items?.[sel]) return;
    const next = items.map((o, i) => (i !== sel ? o
      : deg90 ? { ...o, rotated: !o.rotated } : { ...o, flipped: !o.flipped }));
    commit(next, t.blocked);
  };

  const del = () => {
    if (sel == null || !items?.[sel]) return;
    const next = items.filter((_, i) => i !== sel);
    setSel(null);
    commit(next);
  };

  const reset = () => {
    setItems(null); setHand(false); setSel(null); setUndo([]); setAutoInfo(null); setMsg("");
  };

  // ── 포인터 → mm (viewBox 좌표) ───────────────────────────────────
  //  getScreenCTM 의 역행렬을 쓴다. 화면 비율·레터박스·CSS 확대와 무관하게 정확하다
  //  (rect 비율로 나누는 방식은 preserveAspectRatio 여백에서 어긋난다).
  const at = e => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM?.();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y, pxPerMM: Math.abs(m.a) || 1 };
  };

  const onDown = (e, i) => {
    if (!hand || !items?.[i]) return;
    e.preventDefault();
    const p = at(e); if (!p) return;
    setSel(i); setMsg("");
    dragRef.current = { i, sx: p.x, sy: p.y, base: items.map(o => ({ ...o })),
                        moved: false, last: null, items: null };
    try { svgRef.current?.setPointerCapture?.(e.pointerId); } catch { /* 마우스 없는 환경 */ }
    svgRef.current?.focus?.();
  };

  const onMove = e => {
    const d = dragRef.current;
    if (!d || !hand || !part || !frame) return;
    const p = at(e); if (!p) return;
    const dx = p.x - d.sx, dy = p.y - d.sy;
    if (!d.moved && Math.hypot(dx, dy) * p.pxPerMM < DRAG_MIN_PX) return;
    d.moved = true;
    const src = d.base[d.i];
    const others = d.base.filter((_, k) => k !== d.i);
    const w = itemW(part.P, src), h = itemH(part.P, src);
    // ① 판 안으로 먼저 가둔다 — resolveDrop 은 스냅만 하고 가두지 않는다.
    const x = clamp(src.x + dx, 0, Math.max(0, frame.fitW - w));
    const y = clamp(src.y + dy, 0, Math.max(0, frame.fitH - h));
    // ② NFP 접점으로 흡착. 스냅 반경은 **화면 거리**로 잡는다(작게 그린 판에서도 감이 일정).
    const r = resolveDrop(part.P, { ...src, x, y }, others,
                          { snap: SNAP_PX / p.pxPerMM, bounds: { w: frame.drawW, h: frame.drawH } });
    const inSheet = r.x >= -1e-6 && r.y >= -1e-6 &&
                    r.x + w <= frame.fitW + 1e-6 && r.y + h <= frame.fitH + 1e-6;
    // ★ 성립하지 않는 자리는 **그리지 않는다.** 마지막으로 성립한 자리에 머문다 —
    //   겹친 그림을 한 프레임도 보여주지 않기 위해서다.
    if (r.ok && inSheet) d.last = { x: r.x, y: r.y };
    const pos = d.last || { x: src.x, y: src.y };
    d.items = d.base.map((o, k) => (k === d.i ? { ...o, x: pos.x, y: pos.y } : o));
    setPrev({ items: d.items, blocked: !(r.ok && inSheet) });
  };

  const onUp = e => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setPrev(null);
    try { svgRef.current?.releasePointerCapture?.(e.pointerId); } catch { /* 무해 */ }
    if (!d.moved) return;                       // 클릭 = 고르기만
    if (!d.last) { setMsg(t.blocked); return; }
    commit(d.items);
  };

  const onKey = e => {
    if (!hand) return;
    const k = e.key, low = k.length === 1 ? k.toLowerCase() : k;
    if ((e.ctrlKey || e.metaKey) && low === "z") { e.preventDefault(); doUndo(); return; }
    if (k === "Delete" || k === "Backspace") { e.preventDefault(); del(); return; }
    if (low === "r") { e.preventDefault(); turn(!e.shiftKey); return; }
    if (k === "Escape") { e.preventDefault(); setSel(null); }
  };

  // ── 표시값 ───────────────────────────────────────────────────────
  const perEA = qShow?.totals?.perEA ?? null;
  // ★ 금액 칸은 **이 두 줄이 전부**다. 원가(perEA)는 여기서 price-formula 로 들어가고
  //   그 뒤로는 화면에 안 나온다 — 고객이 보는 것은 `shown`(원가·수식·이유가 없는
  //   객체)이고, 원가는 `av`(관리자 몫)에만 있으며 관리자 패널 안에서만 그린다.
  //   이 분리가 「고객 화면 DOM 에 원가가 없다」를 보증하는 자리다(verify-speclink §M).
  const shown = useMemo(() => shownPriceOf({ perEA, up, cfg: priceCfg, lang, hideCost: linkNoCost }),
                        [perEA, up, priceCfg, lang, linkNoCost]);
  const av = useMemo(() => (adminOpen
    ? adminViewOf({ perEA, up, cfg: priceCfg, lang, hideCost: linkNoCost }) : null),
                     [adminOpen, perEA, up, priceCfg, lang, linkNoCost]);

  // ── ★ 수량별 개당 — 「1,000개면 얼마, 5,000개면 얼마」 ─────────────
  //  ★ 이 파일은 **원가를 한 번도 만지지 않는다.** qtyRowsOf 가 도메인(buildQuoteRange)에서
  //    받은 원가 배열을 shownRowsOf 가 곧바로 표시값으로 바꾸고, 화면은 그 결과만 그린다 —
  //    큰 글씨(shown)와 **완전히 같은 구조**다. 그래서 「고객 화면 DOM 에 원가가 없다」가
  //    표에도 그대로 성립한다(verify-speclink §N · §M ⑯ 이 다섯 수량 전부를 훑는다).
  //  ⚠ 판형·판걸이는 화면 그대로 고정한 채 수량만 바꾼다 — 표 한 칸이 화면에 없는 판의
  //    금액이 되면 한 화면이 스스로와 갈린다. 대가와 그 방향은 qtyRowsOf 주석에 있다
  //    (⚠ 그 대가가 **늘 안전 방향은 아니다** — 105칸 중 8칸이 반대다. 거기 적었다).
  //  ⚠ **수식 미설정(mode "cost")이면 shownRowsOf 가 빈 배열을 준다 = 표가 안 뜬다.**
  //    그 판단은 price-formula 가 소유한다(원가 노출면이 1개 → 5개가 되는 것을 막는다).
  //    여기서 `qtyShown.length` 로만 표를 내는 것이 그래서 맞다 — 조건을 늘리지 마라.
  const qtySteps = useMemo(() => qtyStepsOf(int(qty)), [qty]);
  const qtyRows = useMemo(() => ((up > 0 && sheetBase)
    ? qtyRowsOf({ ...spec, sheetId: sheetBase.id, up }, qtySteps) : []),
                          [spec, sheetBase?.id, up, qtySteps]);
  const qtyShown = useMemo(
    () => shownRowsOf({ rows: qtyRows, cfg: priceCfg, lang, hideCost: linkNoCost }),
    [qtyRows, priceCfg, lang, linkNoCost]);
  // ★ 지금 원가를 가리고 있는가. 두 갈래다 — 이 브라우저에 수식이 있거나(부스 노트북),
  //   주소가 가림 표시를 달고 왔거나(고객이 받은 링크). 둘 중 하나라도 참이면
  //   ① 주소에 가림 비트를 싣고 ② 「견적 앱으로 →」 문을 고객 화면에서 치운다.
  const hiding = isPriceOn(priceCfg) || linkNoCost;
  const sheetLabel = frame ? (frame.sheet.label || frame.sheet.id).trim() : "";
  const netW = part?.w ?? 0, netH = part?.h ?? 0;
  // 자유 배치 제안 — **아직 안 채택했을 때만** 낸다. 조건이 `via === "free"` 가
  // 아니게 된 이유는 autoPlace 주석에 있다(이제 자동 배치는 격자해를 앉힌다).
  // 채택하면 up 이 freeUp 이 되므로 버튼이 스스로 사라진다.
  const gainUp = autoInfo && autoInfo.freeUp > autoInfo.gridUp && autoInfo.freeItems?.length
    ? autoInfo.freeUp : 0;
  const gain = gainUp > up ? t.gain(autoInfo.gridUp, gainUp) : null;
  // 정밀도 문구. **null 이면 그 줄을 내지 않는다** — 어느 경로가 null 인지와 그 이유는
  // showroom-core.precisionKeyOf 가 소유한다(치수 경로는 출처 줄이 대신 말한다).
  const pKey = part ? precisionKeyOf(part.P.mode) : null;
  const precisionNote = pKey ? t[pKey] : null;
  // 사양 줄 — 실려 온 사양이 있으면 **실제 견적 라인**에서 뽑아 적는다(showroom-core
  // 주석 참조). 아직 안 앉혔으면 판을 고르는 호출(qAuto)의 라인을 쓴다: 사양은
  // up 과 무관하므로 같은 말이 나오고, 「자동 배치」를 누르기 전에도 사양이 보인다.
  //  ⚠ 라인이 **없을 수도 있다** — 이 전개도가 들어가는 판형이 없으면 buildQuote 가
  //    빈 결과를 낸다(실측: 슬리브 646×258 을 4×64 에 걸었을 때). 그때 껍데기만 찍으면
  //    「견적서 사양 · (개당단가는 개발비 제외)」라는 뜻 없는 줄이 남는다. 그러면
  //    아무 말도 하지 않는다 — 설명할 단가 자체가 없다(결과도 「—」다).
  //    표준사양 문구로 접으면 안 된다: 실려 온 사양이 아닌 것을 말하게 된다.
  const specSum = carried ? specSummaryOf((qShow || qAuto)?.lines, t) : "";
  const specNote = carried
    ? (specSum ? `${t.specFrom} · ${specSum} ${t.exDev}` : "")
    : t.specLine;

  // ── 해시에 실을 상태 한 벌 ───────────────────────────────────────
  //  ★ **지금 화면의 값을 그대로 들고** 돌아간다. 부스에서 고객이 「조금 키우면?」
  //    하고 여기서 치수·수량·판형을 만졌는데 견적서가 옛 값으로 돌아가면, 그게 바로
  //    이번에 고치는 「두 화면이 따로 논다」의 반대 방향이다.
  //  조립 규칙(판걸이·규격·판형)은 **showroom-core.linkStateOf** 가 소유한다 —
  //  아래 두 용도가 같은 조립을 쓰게 하려고 함수로 뽑았다. 여기 다시 적지 마라.
  const linkState = sheetIdForLink => linkStateOf({
    carried, over, mode: spec.mode, boxType, bW, bD, bH,
    netW: spec.netW, netH: spec.netH, sheetId: sheetIdForLink, qty, up,
    gridUp: qAuto?.layout?.up ?? 0,
  });

  // ① 「견적 앱으로 →」 — 판형은 **해석된 실제 판형 id**. "auto" 를 실으면 판걸이
  //    직접입력과 겹쳐 견적서가 4×64 로 갈아타고 29% 싸게 부른다(linkStateOf 주석).
  //
  //  ── 「돌아가기」의 착지 상태 — 재확인했고 **유지한다** (적대검증 minor ⑦) ──
  //   지적: HEAD 는 이 버튼이 `#/` 를 넣어서 견적서가 INITIAL_STATE 로 떴다. 지금은
  //   사양이 실린다 — **새 버튼을 한 번도 안 눌러도** `#showroom` 단독 진입 후
  //   「돌아가기」만 하면 쇼룸 표준사양(140×43×130 · 원색4 · 223원)이 견적서에 깔린다.
  //   실무앱의 기존 동작을 바꾼 것이 맞다. 그래도 유지하는 이유 셋:
  //    · 이 버튼의 뜻이 「지금 보고 있는 박스를 견적서에서 이어서 보자」다. 방금
  //      화면에 있던 박스를 버리고 빈 폼을 띄우면 이번 연동의 반대 방향이 된다 —
  //      단독 진입 화면에서도 운영자는 치수·수량·판형을 만진다(그게 그 화면의 용도다).
  //    · **조용하지 않다.** 좌패널 7섹션이 실려 온 값을 그대로 표시하고 견적서가 눈앞에서
  //      다시 계산된다. ⑥ 처럼 「그럴듯한 다른 값이 맞는 값처럼 보이는」 상태가 아니다.
  //      새 세션에서 링크로 들어온 경우에는 견적서 위 안내 줄이 「링크로 받은 사양입니다」
  //      라고 명시한다(App.jsx 의 nameNote).
  //    · 「만졌으면 싣고 안 만졌으면 비운다」는 분기는 **또 하나의 숨은 상태**다.
  //      무엇을 만짐으로 셀지(언어 전환도? 후보 드롭다운도?)가 곧 낡는다.
  //   빈 견적서가 필요하면 주소에서 `?q=…` 를 지우면 된다 — 그게 「사양 없음」이다.
  //  ⚠ 이 해시에는 가림 비트를 **안 싣는다.** 이 문을 지나는 사람은 관리자뿐이고
  //    (아래 header 주석 — 가리는 중이면 버튼이 관리자 패널 안으로 들어간다),
  //    견적 앱은 원가를 보여주는 것이 존재 이유다. 비트를 실으면 「가렸다」고
  //    적힌 주소가 원가를 다 보여주는 화면을 가리키게 되어 표시가 거짓말이 된다.
  const backHash = () => specHash("", linkState(sheetBase?.id || sheetId));

  // ② 주소창 동기화 — **새로고침에 입력을 잃지 않기 위해서다** (적대검증 major ④).
  //    종전에는 해시가 「고객 화면으로 →」·「견적 앱으로 →」를 누를 때만 갱신되어,
  //    그 사이에 만진 치수·수량·판형이 주소창에 없었다. 부스에서 F5 한 번에
  //    실려 온 옛 사양으로 되돌아가고 **경고도 없었다**(숫자가 그럴듯해서 되돌아간
  //    줄도 모른다). 지금 화면이 곧 주소다.
  //  ⚠ pushState/`location.hash=` 가 아니라 **replaceState** 다:
  //     · location.hash 대입은 hashchange 를 쏘고, App 이 payload 를 key 로 쓰므로
  //       화면이 통째로 재마운트된다 — 글자 한 자 칠 때마다 배치·포커스가 날아간다.
  //     · pushState 는 히스토리를 키스트로크 수만큼 늘려 「돌아가기」를 못 쓰게 만든다.
  //    replaceState 는 hashchange 를 쏘지 않으므로 App 의 hash 상태는 그대로다(의도).
  //  ⚠ 판형은 여기서는 **드롭다운 값 그대로**다. 운영자가 고른 「자동」이 새로고침
  //    한 번에 고정으로 바뀌면 그것도 조용한 사양 변경이다.
  //  ⚠ 300ms 로 묶는다 — Safari 는 replaceState 호출 빈도에 상한이 있고(초과하면
  //    예외), 치수 칸은 키스트로크마다 상태가 바뀐다.
  //  ⚠ **주소를 아직 우리가 쥐고 있을 때만** 쓴다 — 「견적 앱으로 →」로 주소가 넘어간
  //    뒤에 묶어둔 타이머가 깨어나 쇼룸 주소로 되덮으면, 방금 넘긴 사양이 사라진다.
  //    언마운트 정리가 보통 먼저 돌지만 순서에 기대지 않는다.
  //  ★ 가리는 중이면 **가림 비트를 같이 싣는다**(`&nc=1`). 이 주소가 곧 부스 밖으로
  //    나가는 링크다 — 비트가 없으면 받는 브라우저가 원가로 접힌다(state.noCostOfHash
  //    주석의 실측 critical). 수식 자체는 여전히 안 싣는다.
  const syncHash = specHash("showroom", linkState(sheetId), { nc: hiding });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const id = setTimeout(() => {
      const cur = window.location.hash;
      if (cur !== syncHash && /^#\/?showroom\b/.test(cur))
        window.history.replaceState(null, "", syncHash);
    }, 300);
    return () => clearTimeout(id);
  }, [syncHash]);

  // ══════════════════════════════════════════════════════════════
  return (
    // 드롭은 **화면 어디에나** 받는다 (부스에서 파일을 정확한 상자에 떨구게 하지 않는다).
    // onDragOver 의 preventDefault 가 없으면 브라우저가 파일을 새 탭으로 열어버린다.
    <div data-showroom="1" onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); setDropping(false); loadPdf(e.dataTransfer?.files?.[0]); }}
      style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.bg,
               color: C.ink, font: `14px ${FONT}`, overflow: "hidden" }}>

      {/* ── 머리 ─────────────────────────────────────────────────── */}
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px",
                       height: 52, background: C.panel, borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
        {/* ★ 26-08-26 — 제목 **3번 클릭**으로도 관리자가 열린다.
            왜 필요했나: Ctrl+Alt+M 하나만 두었더니 **화면에 단서가 0** 이라 운영자가
            제 관리자 패널을 못 찾았다(사용자 지적 「관리자페이지는 어딨지?」).
            게다가 가리는 중에는 「견적 앱으로 →」를 관리자 패널로 옮겨 둔 터라,
            패널을 못 열면 **견적 화면으로 돌아갈 길도 같이 막힌다.**
            왜 3번인가 — 고객이 제목을 우연히 세 번 연속 누르지는 않는다(라벨도 배지도
            커서 변화도 없다). 단축키를 못 쓰는 상황(맥 키보드·IME·터치)에서도 열린다.
            ⚠ 눈에 보이는 「관리자」 버튼으로 만들지 마라 — 그 순간 고객이 누른다. */}
        <div onClick={bumpTitleTap} style={{ fontSize: 15, fontWeight: 800, letterSpacing: ".02em",
                                             userSelect: "none" }}>{t.title}</div>
        <div style={{ flex: 1 }}/>
        <div style={{ display: "flex", gap: 2 }}>
          {LANGS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setLang(id)} data-lang={id}
              style={{ ...tabStyle(lang === id), fontSize: 12, padding: "4px 10px" }}>{label}</button>
          ))}
        </div>
        {/* 해시를 비우면 브라우저마다 hashchange 가 안 뜨는 경우가 있다 —
            **다른 해시**로 바꿔서 App 의 라우터가 확실히 깨어나게 한다.
            이제 그 해시에 **지금 화면의 사양**이 실린다(backHash 주석 참조).

            ★ 가리는 중이면 이 버튼을 **고객 화면에서 치운다**(관리자 패널로 옮긴다).
            개당가 하나를 감추려고 파서를 짜 놓고, 그 옆에 **원가 전체로 가는 라벨 달린
            문**을 열어 두면 감춘 것이 아니다 — 실측: 누르면 「공정 합계」·「개당 단가」·
            「단가 399,651원/R」이 한국어로 뜬다. 호기심 있는 방문객이 누르는 버튼이다.
            없애지는 않는다(운영자에게는 필요한 문이다) — Ctrl+Alt+M 뒤로 옮길 뿐이다. */}
        {!hiding && (
          <button type="button" data-act="back" onClick={() => { window.location.hash = backHash(); }}
            style={{ border: "none", background: "none", cursor: "pointer",
                     fontSize: 12, color: C.sub, font: `12px ${FONT}` }}>{t.back} →</button>
        )}
      </header>

      <main style={{ flex: 1, display: "flex", minHeight: 0 }}>

        {/* ══ 왼쪽 — 입력 ══════════════════════════════════════════ */}
        <aside style={{ width: 292, flexShrink: 0, background: C.panel, borderRight: `1px solid ${C.line}`,
                        padding: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* 도면 */}
          <section>
            <Label>{t.draw}</Label>
            <div style={{ display: "flex", gap: 2, marginBottom: 10 }}>
              <button type="button" onClick={() => setSrcMode("pdf")} data-tab="pdf"
                style={{ ...tabStyle(srcMode === "pdf"), flex: 1 }}>{t.pdf}</button>
              <button type="button" onClick={() => setSrcMode("box")} data-tab="box"
                style={{ ...tabStyle(srcMode === "box"), flex: 1 }}>{t.dims}</button>
            </div>

            {srcMode === "pdf" ? (
              <>
                <div data-drop="1" onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDropping(true); }}
                  onDragLeave={() => setDropping(false)}
                  style={{ border: `1.5px dashed ${dropping ? C.acc : C.line}`,
                           background: dropping ? C.accBg : C.soft, borderRadius: 8,
                           padding: "18px 12px", textAlign: "center", cursor: "pointer",
                           fontSize: 12.5, color: dropping ? C.acc : C.sub, lineHeight: 1.7 }}>
                  {busy === "pdf" ? t.reading : <>{t.drop}<br/><span style={{ color: C.faint }}>{t.pick}</span></>}
                </div>
                <input ref={fileRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; loadPdf(f); }}/>
                {pdfDl && pick && (
                  <div style={{ marginTop: 10, fontSize: 12, color: C.sub, lineHeight: 1.8 }}>
                    <div style={{ color: C.ink, fontWeight: 600, wordBreak: "break-all" }}>{pdfDl.source}</div>
                    {pdfDl.pageCount > 1 && (
                      <Row label={t.page}>
                        <Select value={String(pdfDl.page ?? 0)} onChange={v => loadPdf(keptFile.current, int(v))}
                          options={Array.from({ length: pdfDl.pageCount }, (_, i) => [String(i), `${i + 1} / ${pdfDl.pageCount}`])}/>
                      </Row>
                    )}
                    {/* 후보가 여럿이면 바꿀 수 있어야 한다 — 「가장 그럴듯한 것」이 늘 맞지는 않다.
                        점수·선분 같은 내부 수치는 빼고 **크기만** 보여준다(고객 앞이다). */}
                    {pdfDl.candidates?.length > 1 && (
                      <Row label={t.cand}>
                        <Select value={String(pdfDl.pickIdx ?? 0)}
                          onChange={v => setPdfDl(p => ({ ...p, pickIdx: int(v) }))}
                          options={pdfDl.candidates.map((c, i) =>
                            [String(i), `${mm1(c.bbox.w)} × ${mm1(c.bbox.h)}`])}/>
                      </Row>
                    )}
                  </div>
                )}
              </>
            ) : netDims ? (
              // 전개도 전체크기로 실려 온 사양 — 구조 드롭다운도 W·D·H 도 뜻이 없다
              // (도메인이 "direct" 로 푼다). 두 칸만 낸다.
              <div style={{ display: "flex", gap: 6 }}>
                <Num label={t.nw} value={nW} onChange={setNW}/>
                <Num label={t.nh} value={nH} onChange={setNH}/>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {/* ⚠ 구조를 바꾸면 톰슨도 같이 바꾼다 — 견적 앱(App.jsx 의 handleBoxType)이
                    nextThomId 로 하는 것과 **같은 함수·같은 순서**다. 안 걸면 G형을 골라도 톰슨이
                    「일반형」에 남아 두 화면 금액이 갈린다(그 판정의 정본은 구조 파일의
                    thomsonDefault 이고 화면은 읽기만 한다). */}
                <Select value={boxType}
                  onChange={v => { setBoxType(v); put("thomId", nextThomId(v, over.thomId)); }}
                  options={BOX_TYPES.map(b => [b.id, b.label])}/>
                <div style={{ display: "flex", gap: 6 }}>
                  <Num label={t.w} value={bW} onChange={setBW}/>
                  <Num label={t.d} value={bD} onChange={setBD}/>
                  <Num label={t.h} value={bH} onChange={setBH}/>
                </div>
              </div>
            )}
          </section>

          {/* 도면 미리보기 — 판에 앉기 전의 「도면 한 장」 */}
          {part && <DrawPreview part={part} label={`${mm1(netW)} × ${mm1(netH)} mm`}/>}

          {/* 판형 */}
          <section>
            <Label>{t.sheet}</Label>
            {/* 실려 온 주문생산 판형은 목록에 없으므로 **한 줄 끼워 넣는다.** 안 넣으면
                고른 값이 목록에 없어 브라우저가 첫 항목(「자동」)을 보여주는데 상태는
                여전히 custom 이라, 화면이 실제와 다른 판형을 말한다. */}
            <Select value={sheetId} onChange={setSheetId}
              options={[["auto", `${t.auto}${qAuto?.sheet ? ` · ${(qAuto.sheet.label || "").trim()}` : ""}`],
                        ...(sheetId === "custom" && frame
                            ? [["custom", `${(frame.sheet.label || "").split("(")[0].trim()} ` +
                                          `(${mm1(frame.sheet.w)}×${mm1(frame.sheet.h)})`]] : []),
                        ...SHEET_CHOICES.map(b => [b.id, `${b.label.trim()}`])]}/>
          </section>

          {/* 수량 */}
          <section>
            <Label>{t.qty}</Label>
            <Num value={qty} onChange={setQty} suffix={t.ea} wide/>
          </section>

          {/* ══ 사양 — ★ 고객과 **같이 넣는** 칸 (26-08-26) ═══════════
              왜 왼쪽 아래인가 — 이 화면의 주인공은 도면과 판이다. 사양은 운영자가
              만지고 고객은 오른쪽에서 결과를 본다. 오른쪽에 두면 판이 그만큼 작아진다
              (실측: 결과 상자 아래에 한 줄 늘 때마다 판 높이가 ~30px 줄어든다).
              이 aside 는 overflowY:auto 라 여기서 늘어나도 **판은 한 픽셀도 안 줄어든다.**
              ⚠ 새 탭·새 화면을 만들지 않는다 — 구조·치수·판형·수량과 **한 덩어리**여야
                「이 박스를 이 사양으로」가 한 눈에 읽힌다.
              ⚠ 여기 칸을 늘리기 전에 showroom-core.SHOWROOM_SPEC_KEYS 주석의 「뺀 것과
                근거」를 읽어라. 특히 단가 직접입력·개발비는 **원가 구조 그 자체**다. */}
          <section>
            <Label>{t.secSpec}</Label>
            <Row label={t.fPaper}>
              <Select value={over.paperId} onChange={v => put("paperId", v)} options={paperChoices(lang)}/>
            </Row>

            {/* 인쇄 도수 — 앞/뒤 한 줄씩. 알약 두 개 + 별색 숫자 한 칸이면 부스 대화가 된다
                (「원색 4도에 별색 하나 더요」). 도수를 세는 것은 도메인이 한다 — 화면은
                켜고 끄기만 하고, 실제 도수·소부 판수는 사양 줄(specSummaryOf)이 말한다. */}
            <Row label={t.fPrint}>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[["f", t.sideF], ["b", t.sideB]].map(([sd, sl]) => (
                  <div key={sd} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <span style={{ fontSize: 11, color: C.faint, width: 15, flexShrink: 0 }}>{sl}</span>
                    <Pill on={!!over[`${sd}pColor`]} data-fx-print={`${sd}Color`}
                      onClick={() => put(`${sd}pColor`, !over[`${sd}pColor`])}>{t.oCmyk}</Pill>
                    <Pill on={!!over[`${sd}pBk`]} data-fx-print={`${sd}Bk`}
                      onClick={() => put(`${sd}pBk`, !over[`${sd}pBk`])}>{t.oBlack}</Pill>
                    {/* UV 인쇄 — 부스 이동폭 1위(+21%). 알약 하나면 된다. */}
                    <Pill on={!!over[`${sd}pUv`]} data-fx-print={`${sd}Uv`}
                      onClick={() => put(`${sd}pUv`, !over[`${sd}pUv`])}>{t.oUv}</Pill>
                    <span style={{ fontSize: 11, color: C.faint, marginLeft: 2 }}>{t.oSpot}</span>
                    <input value={over[`${sd}pSp`]} inputMode="numeric" data-fx-spot={sd}
                      onChange={e => putSp(`${sd}pSp`, e.target.value)}
                      style={{ width: 34, boxSizing: "border-box", padding: "4px 5px", borderRadius: 5,
                               border: `1px solid ${C.line}`, background: "#fff", color: C.ink,
                               font: `12px ${FONT}`, textAlign: "center",
                               fontVariantNumeric: "tabular-nums" }}/>
                  </div>
                ))}
              </div>
            </Row>

            {/* 코팅 앞/뒤 — 한 줄에 둘. 종류 이름이 짧아(무광·유광·IR) 좁아도 읽힌다 */}
            <Row label={t.fCoat}>
              <div style={{ display: "flex", gap: 5 }}>
                <Select value={over.fcId} onChange={v => put("fcId", v)} options={coatChoices(lang)}/>
                <Select value={over.bcId} onChange={v => put("bcId", v)} options={coatChoices(lang)}/>
              </div>
            </Row>

            {/* 후가공 — 켜고 끄기만. 박 종류·면수는 도면이 확정된 뒤의 이야기라 뺐다
                (SHOWROOM_SPEC_KEYS 주석). 켜면 도메인이 1면 기본으로 계산한다. */}
            <Row label={t.fFinish}>
              <div style={{ display: "flex", gap: 4 }}>
                <Pill on={!!over.foil} data-fx-fin="foil" onClick={() => put("foil", !over.foil)}>{t.oFoil}</Pill>
                <Pill on={!!over.emb} data-fx-fin="emb" onClick={() => put("emb", !over.emb)}>{t.oEmb}</Pill>
                <Pill on={!!over.puv} data-fx-fin="puv" onClick={() => put("puv", !over.puv)}>{t.oPuv}</Pill>
              </div>
            </Row>

            <Row label={t.fGlue}>
              <Select value={over.glueId} onChange={v => put("glueId", v)} options={glueChoices(lang)}/>
            </Row>
            <Row label={t.fThom}>
              <Select value={over.thomId} onChange={v => put("thomId", v)} options={thomChoices(lang)}/>
            </Row>
          </section>

          <div style={{ flex: 1 }}/>
          {/* 사양 — 이것도 정직성 줄이다(이 단가가 **어느 사양의** 값인지 말한다).
              출처 줄과 같은 등급이므로 같은 색을 쓴다 — C 주석의 sub/faint 규칙.
              ⚠ 견적서에서 사양이 실려 오면 이 줄이 **그 사양**을 말해야 한다. 표준사양
                문구를 그대로 두면 화면은 295AB 로 계산하고 글은 AB350 이라고 적는
                거짓말이 된다 (data-spec 으로 실측 확인한다). */}
          <div data-spec={carried ? "carried" : "std"}
            style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.7 }}>{specNote}</div>
        </aside>

        {/* ══ 오른쪽 — 판 · 결과 ═══════════════════════════════════ */}
        <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: 18, gap: 12 }}>

          {/* 버튼 줄 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button type="button" data-act="auto" onClick={() => runAuto()} disabled={!part || !!busy}
              style={btnStyle("primary", !!part && !busy)}>
              {busy === "auto" ? t.working : t.btnAuto}
            </button>
            <button type="button" data-act="hand" onClick={() => (hand ? setHand(false) : enterHand())}
              disabled={!part || !!busy} style={btnStyle(hand ? "on" : "ghost", !!part && !busy)}>
              {hand ? t.btnHandOff : t.btnHand}
            </button>
            <button type="button" data-act="reset" onClick={reset} disabled={!!busy}
              style={btnStyle("ghost", !busy)}>{t.btnReset}</button>

            {/* 손배치 도구 — 켰을 때만 나온다 */}
            {hand && (
              <div data-handbar="1" style={{ display: "flex", gap: 4, marginLeft: 4 }}>
                <button type="button" data-act="add" onClick={addOne} style={btnStyle("mini")}>{t.add}</button>
                <button type="button" data-act="rot" onClick={() => turn(true)} style={btnStyle("mini", sel != null)}
                  disabled={sel == null}>{t.rot}</button>
                <button type="button" data-act="flip" onClick={() => turn(false)} style={btnStyle("mini", sel != null)}
                  disabled={sel == null}>{t.flip}</button>
                <button type="button" data-act="del" onClick={del} style={btnStyle("mini", sel != null)}
                  disabled={sel == null}>{t.del}</button>
                <button type="button" data-act="fill" onClick={runFill} style={btnStyle("mini", !!items?.length && !busy)}
                  disabled={!items?.length || !!busy}>{busy === "fill" ? t.working : t.fill}</button>
                <button type="button" data-act="undo" onClick={doUndo} style={btnStyle("mini", undo.length > 0)}
                  disabled={!undo.length}>{t.undo}</button>
              </div>
            )}
            <div style={{ flex: 1 }}/>
            {/* ★ 칩이 아니라 **버튼**이다 — 누르지 않으면 화면 금액이 견적서와 같은
                격자 기준을 유지한다(autoPlace 주석: 고객 앞 화면이 청구보다 싸면 안 된다). */}
            {gain && (
              <button type="button" data-act="adopt-free" data-gain="1" onClick={adoptFree}
                disabled={!!busy} style={{ ...chip(C.acc, C.accBg), border: `1px solid ${C.acc}`,
                                           cursor: busy ? "default" : "pointer", font: `600 11.5px ${FONT}` }}>
                {gain}
              </button>
            )}
          </div>

          {/* 판 */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {frame ? (
              <Sheet
                innerRef={svgRef} frame={frame} part={part}
                items={drawable ? drawItems : []} sel={hand ? sel : null} hand={hand}
                blocked={!!prev?.blocked}
                onDown={onDown} onMove={onMove} onUp={onUp} onKey={onKey}
                onBlank={() => { setSel(null); setMsg(""); }}/>
            ) : (
              <div style={{ color: C.faint, fontSize: 13 }}>{t.needDraw}</div>
            )}
          </div>

          {/* 도면 범례 — 고객이 「어디가 잘리고 어디가 접히고 어디에 풀이 발리는지」를
              읽는 자리. 구분이 없으면 도면이 아니라 선 뭉치로 보인다.
              ⚠ 출처 줄은 **세 갈래**다. 조건이 `folds.length` 인 이유:
                G형·G형트레이는 dieline/index.mjs 의 `if (!st.polygon)` 분기로 빠져
                전개도가 **직사각 1조각**이다(cuts 1 · folds 0 · glue 0 — ARCHITECTURE
                「폴리곤 미확정 → 직사각」). 그 구조에 srcBox(「날개 모양은 표준형
                근사입니다」)를 내면 사실과 다르다 — 근사된 날개가 아니라 날개·오시선·
                접착면이 **아예 없다**. folds 가 0 이라는 것이 그 분기의 관측 가능한
                흔적이고(폴리곤이 확정된 구조는 folds 가 원리적으로 0 이 될 수 없다),
                그래서 화면 코드가 구조 id 목록을 들고 있지 않아도 갈릴 수 있다. */}
          {part && (
            <Legend t={t} crease={!!part.folds?.length} glue={!!part.glue?.length}
              note={srcMode === "pdf" ? t.srcPdf
                  : netDims ? t.srcNet
                  : (part.folds?.length ? t.srcBox : t.srcOutline)}/>
          )}

          {/* 안내 · 경고 한 줄 */}
          <div style={{ minHeight: 18, fontSize: 12, color: msg ? C.warn : C.sub }} data-msg="1">
            {msg || (!items ? t.hintStart : hand ? t.hintHand : "")}
            {frame?.capped && !msg && (
              // 「원지를 인쇄기 크기로 재단해서 겁니다」 — 고객이 「판형 788×1091 을
              // 골랐는데 화면 판은 990×720 이다」를 묻는 자리다. 읽혀야 하는 글이다.
              <span style={{ color: C.sub, marginLeft: 10 }}>
                {t.cappedNote(frame.sheet.w, frame.sheet.h, PRESS_MAX_LONG, PRESS_MAX_SHORT)}
              </span>
            )}
          </div>

          {/* ══ 결과 — 이 화면에서 **가장 큰 글씨** ══════════════════ */}
          {/* ⚠ data-perea 는 **수식 미설정일 때만** 원가를 싣는다. 종전에는 늘 실었고,
              수식을 켠 채로 그대로 두면 고객 앞 화면의 DOM 에 한국 원화 원가가
              남는다 — 화면에는 ¥35 인데 검사도구에는 204 다. 그건 이 기능이 막으려던
              것과 같은 유출이다. 수식이 켜지면 대신 **보여준 값**만 싣는다
              (data-shown) — 브라우저 실측이 「화면과 DOM 이 같은 말을 하는가」를
              잴 수 있어야 하기 때문이다. */}
          <div data-result="1" data-up={up} data-price-mode={shown.mode} data-cur={shown.cur}
            data-perea={shown.mode === "cost" ? (perEA ?? "") : ""} data-shown={shown.main}
            // ⚠ 줄바꿈 간격(rowGap)을 열 간격과 **가르는** 이유: 아래 수량 줄은
            //   flexBasis 100% 라 늘 새 줄이고, 종전처럼 gap 34 하나면 그 34px 이 통째로
            //   판 높이에서 빠진다(실측 1280×800: 판 465 → 387px). 열 간격은 그대로 34 다.
            style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10,
                     padding: "16px 22px", display: "flex", alignItems: "flex-end",
                     columnGap: 34, rowGap: 10, flexWrap: "wrap" }}>
            <Big value={up > 0 ? String(up) : "—"} unit={t.up}/>
            <div style={{ width: 1, alignSelf: "stretch", background: C.line }}/>
            <Big value={shown.main} unit={shown.unitKey ? t[shown.unitKey] : ""} pre={t.perEA}/>
            <div style={{ flex: 1 }}/>
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.9, textAlign: "right" }}>
              <div><span style={{ color: C.faint }}>{t.sheetSize}</span>{"  "}
                {sheetLabel} · {mm1(frame?.drawW ?? 0)} × {mm1(frame?.drawH ?? 0)} mm</div>
              <div><span style={{ color: C.faint }}>{t.netSize}</span>{"  "}
                {mm1(netW)} × {mm1(netH)} mm</div>
              {/* ⚠ 수량은 **지금 수량이 아래 표에 없을 때만** 여기서 말한다. 표에 있으면
                  강조된 칸으로 이미 크게 떠 있어 같은 값을 두 번 말하는 셈이고
                  (이 화면의 「같은 값을 두 번 말하지 않는다」 규칙 — specSummaryOf 주석),
                  그 한 줄이 판 높이를 22px 먹는다.
                  ★ 26-08-26 2차 — 조건이 종전 `length <= 1` 이었는데 **표준 눈금 4칸이 늘
                    있어서** 수량이 무효(빈칸·0·음수·문자)여도 거짓이었다. 실측: 큰 글씨는
                    「—」인데 표는 자신 있게 네 값을 말하고 강조된 칸이 하나도 없어, **지금
                    무엇을 견적한 것인지 화면이 안 말했다**(적대검증 minor ⑤).
                    개수가 아니라 「지금 수량이 표에 있는가」로 판정한다 — 수량이 문턱
                    (QTY_PIN_MIN) 아래일 때도 여기서 말하게 되는 것이 덤이다. */}
              {!qtyShown.some(r => r.qty === int(qty)) && (
                <div><span style={{ color: C.faint }}>{t.qtyShort}</span>{"  "}
                  {int(qty).toLocaleString()} {t.ea}</div>
              )}
            </div>

            {/* ══ ★ 수량별 개당 — 부스 대화의 본체 ═══════════════════
                「1,000개면 얼마, 5,000개면 얼마」. 별도 표가 아니라 **결과 상자 안의 한 줄**
                이다: 큰 글씨 바로 아래에 놓아야 「지금 값」과 「수량을 바꾸면」이 한 눈에
                읽히고, 판을 잡아먹지 않는다(한 줄 ~36px · 표로 만들면 ~150px).
                ⚠ 누르는 칩이 **아니다.** 눌러서 수량을 바꾸면 판형 추천이 뒤집힐 수 있고
                  (실측: 1,000개는 4×64 2up 이 싸다) 그러면 지금 그린 배치와 다른 판이 된다.
                  수량은 왼쪽 칸 하나로만 바꾼다.
                  (26-08-26 2차 — 그때 「금액이 「—」로 간다」던 부분은 이제 다르다:
                   판만 바뀐 경우 화면이 말하고 새 판에 다시 앉힌다(reseat 효과). 그래도
                   칩으로 만들지 않는다 — 표는 「이 배치로 수량만 바꾸면」을 답하는 자리다.)
                ⚠ 색은 이미 쓰는 두 벌(acc/accBg · soft/line)뿐이다. 칸마다 다른 색을
                  칠하지 않는다(이 파일 머리말의 규칙). */}
            {qtyShown.length > 1 && (
              <div data-qtyscale="1" style={{ flexBasis: "100%", display: "flex", flexWrap: "wrap",
                    alignItems: "center", gap: "6px 8px", borderTop: `1px solid ${C.line}`,
                    paddingTop: 11, marginTop: 3 }}>
                <span style={{ fontSize: 11, color: C.faint, marginRight: 2 }}>{t.qtyScale}</span>
                {qtyShown.map(r => {
                  const on = r.qty === int(qty);
                  return (
                    <div key={r.qty} data-qty={r.qty} data-qty-shown={r.main}
                      style={{ display: "flex", alignItems: "baseline", gap: 5,
                               padding: "3px 10px", borderRadius: 7,
                               background: on ? C.accBg : C.soft,
                               border: `1px solid ${on ? C.acc : C.line}` }}>
                      <span style={{ fontSize: 11, color: on ? C.acc : C.sub,
                                     fontVariantNumeric: "tabular-nums" }}>
                        {r.qty.toLocaleString()}{t.ea}
                      </span>
                      <span style={{ fontSize: 16, fontWeight: 700, color: on ? C.acc : C.ink,
                                     fontVariantNumeric: "tabular-nums" }}>{r.main}</span>
                      {r.unitKey && <span style={{ fontSize: 10.5, color: C.sub }}>{t[r.unitKey]}</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 정밀도 한 줄 — 근사면 근사라고 적는다. 작게, 그러나 반드시.
              ⚠ 치수 입력 경로에서는 **이 줄이 나오지 않는다**(precisionKeyOf 가 null).
              precisionKeyOf 는 「충돌 도형」의 정밀도이고 **그림의 정밀도가 아니다** —
              치수 경로에서 「칼선 폴리곤 그대로(근사 없음)」를 내면 같은 화면 173px 위의
              출처 줄 「날개 모양은 표준형 근사입니다」와 정면 충돌하고, 두 줄이 같은
              크기·같은 대비라 **더 확언조인 쪽**(근사 없음)이 이긴다. 치수 경로의 정직성은
              출처 줄이 이미 소유한다. 판정은 showroom-core.precisionKeyOf 가 갖는다.
              (경고 두 개는 경로와 무관하므로 이 줄이 비어도 그대로 뜬다.) */}
          {part && (precisionNote || autoInfo?.budgetHit || !drawable) && (
            <div data-precision={part.P.mode} style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.6 }}>
              {precisionNote}
              {autoInfo?.budgetHit && (
                <Bit color={C.warn} first={!precisionNote}>{t.budget}</Bit>
              )}
              {!drawable && (
                <Bit color={C.bad} first={!precisionNote && !autoInfo?.budgetHit}>{t.overlapRefused}</Bit>
              )}
            </div>
          )}
        </section>
      </main>

      {/* ★ 관리자 패널 — **떠 있다**(position:fixed). 흐름에 넣으면 열 때마다 오른쪽
          영역이 좁아져 판·도면이 작아진다. 부스에서 관리자가 수식을 만지는 동안에도
          고객이 보는 그림은 **한 픽셀도 움직이면 안 된다** — 그래서 레이아웃 밖이다.
          자리는 왼쪽 아래(운영자 쪽 입력 패널 위) — 판과 결과 상자를 가리지 않는다. */}
      {adminOpen && av && (
        <AdminPanel a={ADMIN_T} v={av} cfg={priceCfg} set={setCfg} hiding={hiding}
          onQuote={() => { window.location.hash = backHash(); }}
          onClose={() => setAdminOpen(false)}/>
      )}

      {/* ★ 인쇄 — 관리자 패널은 **종이로 나가면 안 된다.** 실측: 이 페이지의 모든
          스타일시트에 @media print 규칙이 0건이었고, 패널이 position:fixed 라
          Chrome 인쇄에서 첫 페이지에 원가와 수식이 그대로 찍혔다. 쇼룸을 인쇄할 일이
          잦지는 않지만 막는 비용이 한 줄이다.
          ⚠ 이 화면은 스타일이 전부 인라인이라 걸 자리가 없다 — 그래서 <style> 한 조각을
            둔다. 여기에 다른 규칙을 늘리지 마라(인라인 규율이 무너진다). */}
      <style>{"@media print{[data-admin]{display:none !important}}"}</style>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  판 그림 — 흰 종이 위 얇은 칼선. 채우기도 배지도 없다.
// ══════════════════════════════════════════════════════════════════
//  ⚠ ref 를 그대로 받지 않고 innerRef prop 으로 받는다 — 함수 컴포넌트에 ref 를 걸면
//    React 가 경고만 내고 **조용히 null** 이 되어 드래그가 통째로 죽는다.
function Sheet({ innerRef, frame, part, items, sel, hand, blocked, onDown, onMove, onUp, onKey, onBlank }) {
  const M = Math.max(10, frame.drawW * 0.025);          // 판 둘레 여백(mm)
  const vw = frame.drawW + 2 * M, vh = frame.drawH + 2 * M;
  const P = part?.P;

  return (
    <svg ref={innerRef} data-sheet="1"
      viewBox={`${-M} ${-M} ${vw} ${vh}`}
      tabIndex={hand ? 0 : undefined} onKeyDown={hand ? onKey : undefined}
      onPointerMove={hand ? onMove : undefined}
      onPointerUp={hand ? onUp : undefined}
      onPointerCancel={hand ? onUp : undefined}
      style={{ width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%",
               outline: "none", touchAction: hand ? "none" : undefined,
               userSelect: hand ? "none" : undefined, cursor: hand ? "default" : undefined }}>

      {/* 판 = 인쇄기에 실제로 걸리는 면. 물림 띠는 그리지 않는다 —
          판걸이는 물림을 빼지 않으므로(ARCHITECTURE §5) 띠를 그리면 폐기된 방침을
          화면이 다시 주장하게 된다. 고객에게도 설명할 수 없는 표시다. */}
      <rect x={0} y={0} width={frame.drawW} height={frame.drawH}
        fill="#ffffff" stroke="#c3cad4" strokeWidth={1} vectorEffect="non-scaling-stroke"
        onPointerDown={hand ? onBlank : undefined}/>

      {items.map((it, i) => {
        const fw = itemW(P, it);
        const tf = `translate(${it.x},${it.y})` + (it.rotated ? ` translate(${fw},0) rotate(90)` : "");
        // 반전(180°)은 **전개도 로컬 중심** 기준이다. 회전(90°)을 먼저 걸고 그 안에서 돈다
        // — SheetCanvas.boxTf 와 **같은 식**이라 두 화면의 그림이 갈리지 않는다.
        const flip = it.flipped ? `rotate(180,${part.w / 2},${part.h / 2})` : undefined;
        const on = sel === i;
        return (
          <g key={i} data-cell={i} data-sel={on ? "1" : undefined} transform={tf}
            onPointerDown={hand ? (e => onDown(e, i)) : undefined}
            style={hand ? { cursor: "move" } : undefined}>
            {/* 히트영역. ⚠ fill 은 **"transparent"** 다 — "none" 은 히트테스트 대상이
                아니라서 핸들러를 달아도 칸이 안 잡힌다 (ARCHITECTURE §10 실측). */}
            <rect x={0} y={0} width={part.w} height={part.h}
              fill={on ? "rgba(11,98,214,0.06)" : "transparent"}
              stroke={on ? C.acc : "none"} strokeWidth={on ? 1.4 : 0}
              vectorEffect="non-scaling-stroke"/>
            {/* ⚠ 세 종류 모두 이 <g> **안쪽**이어야 한다. 밖에 두면 위 히트영역
                rect(fill="transparent") 를 덮어 드래그가 죽는다 (ARCHITECTURE §10). */}
            <g transform={flip} fill="none" pointerEvents="none">
              {/* 접착면 — **평톤**. 미리보기·범례 견본과 **완전히 같은 표기**다
                  (GLUE_TONE 주석: 해칭은 판 배율 0.45~1.62 px/mm 를 못 버틴다).
                  이 배율에서 접착탭은 폭 6~23px 뿐이고 판에는 그 탭이 up 개(4~6) 뜬다 —
                  톤이 조용하다. ⚠ 부모 <g> 에 fill="none" 이 걸려 있어 fill 을
                  **명시**해야 칠해진다. 테두리는 그리지 않는다(GLUE_TONE 주석 마지막 줄:
                  탭의 한 변이 오시선이라 실선 테두리가 파선을 실선으로 만든다). */}
              {(part.glue || []).map((g, k) => (
                <polygon key={"g" + k} points={pts(g)} stroke="none"
                  fill={blocked ? "#9aa3ae" : INK} fillOpacity={GLUE_TONE}/>
              ))}
              {(part.folds || []).map((f, k) => (
                <polyline key={"f" + k} points={pts(f)}
                  stroke={on ? C.acc : (blocked ? "#9aa3ae" : INK)} strokeWidth={CREASE_W}
                  strokeDasharray={CREASE_DASH} vectorEffect="non-scaling-stroke"/>
              ))}
              {(part.cuts || []).map((c, k) => (
                <polyline key={"c" + k} points={pts(c)}
                  stroke={on ? C.acc : (blocked ? "#9aa3ae" : INK)} strokeWidth={on ? CUT_W_SEL : CUT_W}
                  strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
              ))}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
const pts = poly => poly.map(([x, y]) => `${x},${y}`).join(" ");

/** 왼쪽 도면 미리보기 — 판과 **같은 도형·같은 선**으로 그린다 */
function DrawPreview({ part, label }) {
  const M = Math.max(part.w, part.h) * 0.04;
  const vh = part.h + 2 * M;
  return (
    <section>
      <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, background: C.soft, padding: 10 }}>
        <svg data-preview="1" viewBox={`${-M} ${-M} ${part.w + 2 * M} ${vh}`}
          style={{ width: "100%", height: 112, display: "block" }}>
          {/* 접착면 — 판·범례와 **같은 평톤**. 종전에는 여기만 45° 해칭이었는데, 이 svg 는
              높이가 112px 로 고정이라 pattern 셀을 mm 로 굳혀도 배율이 안 변했기 때문이다.
              판은 그렇지 않다(0.45~1.62 px/mm) — 그래서 표기가 미리보기/판/범례 세 벌로
              갈렸다. 이 자리에서만 맞는 최적화보다 세 자리가 같은 것이 낫다. */}
          <g fill="none">
            {(part.glue || []).map((g, k) => (
              <polygon key={"g" + k} points={pts(g)} fill={INK} fillOpacity={GLUE_TONE} stroke="none"/>
            ))}
            {(part.folds || []).map((f, k) => (
              <polyline key={"f" + k} points={pts(f)} stroke={INK} strokeWidth={CREASE_W}
                strokeDasharray={CREASE_DASH_PREV} vectorEffect="non-scaling-stroke"/>
            ))}
            {(part.cuts || []).map((c, k) => (
              <polyline key={"c" + k} points={pts(c)} stroke={INK} strokeWidth={CUT_W_PREV}
                strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
            ))}
          </g>
        </svg>
        <div style={{ fontSize: 11.5, color: C.sub, textAlign: "center", marginTop: 4,
                      fontVariantNumeric: "tabular-nums" }}>{label}</div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
//  범례 — 판 밖 한 줄. **HTML 이다** (SVG <text> 를 늘리지 않는다)
// ══════════════════════════════════════════════════════════════════
//  ⚠ 왜 도면 안에 「접착」 글자를 안 넣는가 — **읽히지 않기 때문이다.** 브라우저 실측:
//  접착탭(14.3mm)의 화면 폭이 미리보기 **5.9px**(0.41 px/mm) · 판 **13~23px**
//  (1.23~1.62 px/mm)이다. 탭 안에 세로로 세운 글자는 글자 높이가 탭 폭을 넘을 수 없어
//  최대 6~23px 인데, 미리보기 쪽은 6px 로 원리적으로 못 읽는다. 판 쪽은 읽힐 크기지만
//  탭이 up 개(4~6) 뜨고 180° 반전 칸에서는 글자가 거꾸로 뒤집힌다 — 「칸 위에 배지를
//  붙이지 않는다」는 이 화면의 규칙과 정면으로 부딪친다.
//  (같은 판단의 선례: 니크 0.89mm · 뚜껑 오시선 0.5mm 오프셋도 쇼룸 배율에서 1px 미만이라
//   그리지 않기로 했다. 읽히지 않는 표기는 정보가 아니라 잡티다.)
//  그래서 **견본(swatch)은 도형과 완전히 같은 표기**로 그리고 글자는 여기 둔다.
//  ※ 판 뷰의 선택된 칸 하나에만 라벨을 붙이는 것은 가능하다(판 배율이면 읽힌다) —
//    필요해지면 그때 넣어라. 지금은 SVG <text> 를 0 으로 유지하는 편을 택했다.
//
//  ★ 자기검증 — 범례는 **화면에 실제로 있는 것만** 말한다. folds·glue 가 비면
//    그 줄을 아예 내지 않는다. 그래서 「범례에는 있는데 도면에는 없다」가 원리적으로
//    불가능하다. PDF 모드가 정확히 그 경우다(오시선·접착면 표기가 원본에 없다) —
//    빠진 이유는 note 줄이 말한다.
function Legend({ t, crease, glue, note }) {
  return (
    <div data-legend="1" style={{ display: "flex", flexWrap: "wrap", alignItems: "center",
                                 gap: "5px 20px", fontSize: 11.5, color: C.sub }}>
      <Key name={t.lgCut} sub={t.lgCutSub} kind="cut"
        sw={{ height: 0, borderTop: `${CUT_W_PREV + 0.4}px solid ${INK}` }}/>
      {crease && (
        <Key name={t.lgCrease} sub={t.lgCreaseSub} kind="crease"
          sw={{ height: 0, borderTop: `${CREASE_W + 0.4}px dashed ${INK}` }}/>
      )}
      {glue && (
        // 견본 = 판 위 접착면의 **축소 모형**이다. 안은 GLUE_FILL_CSS(판의 fillOpacity 와
        // 같은 알파), 둘레는 1px INK — 판에서 접착면의 경계를 긋는 것이 칼선·오시선(같은
        // 잉크)이기 때문이다. ⚠ 견본에만 있는 무늬를 넣지 마라(종전 45° 해칭이 그랬다).
        <Key name={t.lgGlue} sub={t.lgGlueSub} kind="glue"
          sw={{ height: 10, border: `1px solid ${INK}`, background: GLUE_FILL_CSS }}/>
      )}
      {/* ★ 출처 — 이 줄이 정직성 게이트다. 빠지면 고객이 우리 관용을 실측으로 읽는다.
          그래서 **읽히는 색**이어야 한다(C.sub). 안 읽히는 정직성은 정직성이 아니다. */}
      <div data-source="1" style={{ flexBasis: "100%", fontSize: 10.5, color: C.sub,
                                    lineHeight: 1.65 }}>{note}</div>
    </div>
  );
}

const Key = ({ sw, name, sub, kind }) => (
  <span data-key={kind} style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
    <span data-sw={kind} style={{ width: 20, flexShrink: 0, ...sw }}/>
    {/* 이름은 줄바꿈 금지 — 좁은 창에서 「오시\n선」으로 쪼개져 고장난 것처럼 보였다.
        이름은 3~4자(≤30px)라 어느 폭에서도 한 줄에 들고, 뜻풀이는 그대로 접히므로
        nowrap 을 이름에만 준다(둘 다 주면 범례가 판 폭을 넘겨 가로 스크롤이 생긴다). */}
    <span style={{ color: C.ink, fontWeight: 600, whiteSpace: "nowrap" }}>{name}</span>
    {/* 뜻풀이는 **글**이다 — C.sub. faint 로 두면 이름(칼선/오시선/접착면)만 읽히고
        뜻이 사라져 범례가 반만 전달된다 (C 주석 참조). */}
    <span style={{ color: C.sub }}>{sub}</span>
  </span>
);

// ══════════════════════════════════════════════════════════════════
//  작은 조각들 (이 화면 전용 — 다크 테마인 ui/primitives 와 섞지 않는다)
// ══════════════════════════════════════════════════════════════════
const Label = ({ children }) => (
  <div style={{ fontSize: 10.5, fontWeight: 700, color: C.faint, letterSpacing: ".14em",
                textTransform: "uppercase", marginBottom: 7 }}>{children}</div>
);

/** 정밀도 줄의 뒷조각(예산·겹침거부). 「·」는 **앞에 말이 있을 때만** 붙인다 —
 *  치수 경로는 정밀도 문구가 없어서(위 참조) 첫 조각이 이것일 수 있고, 그때 「·」로
 *  시작하면 앞말이 잘려나간 것처럼 읽힌다. */
const Bit = ({ color, first, children }) => (
  <span style={{ color, marginLeft: first ? 0 : 8 }}>{first ? "" : "· "}{children}</span>
);

const Row = ({ label, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
    <span style={{ fontSize: 11.5, color: C.faint, width: 54, flexShrink: 0 }}>{label}</span>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);

/** 켜고 끄는 알약 — 사양 칸 전용. 체크박스가 아니라 알약인 이유는 **부스에서 손가락으로
 *  누르기 때문**이다(체크박스 히트영역은 13px). 색은 탭(tabStyle)과 같은 두 벌만 쓴다. */
const Pill = ({ on, onClick, children, ...rest }) => (
  <button type="button" onClick={onClick} data-on={on ? "1" : undefined} {...rest}
    style={{ padding: "4px 8px", borderRadius: 999, cursor: "pointer", whiteSpace: "nowrap",
             border: `1px solid ${on ? C.acc : C.line}`, background: on ? C.accBg : "#fff",
             color: on ? C.acc : C.sub, font: `${on ? 700 : 500} 11.5px ${FONT}` }}>{children}</button>
);

const Select = ({ value, onChange, options }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ width: "100%", boxSizing: "border-box", padding: "7px 8px", borderRadius: 6,
             border: `1px solid ${C.line}`, background: "#fff", color: C.ink,
             font: `13px ${FONT}`, cursor: "pointer" }}>
    {options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
  </select>
);

const Num = ({ label, value, onChange, suffix, wide }) => (
  <label style={{ flex: 1, minWidth: 0, display: "block" }}>
    {label && <div style={{ fontSize: 11, color: C.faint, marginBottom: 3 }}>{label}</div>}
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <input value={value} inputMode="numeric" onChange={e => onChange(e.target.value)}
        style={{ width: "100%", minWidth: 0, boxSizing: "border-box", padding: "7px 8px",
                 borderRadius: 6, border: `1px solid ${C.line}`, background: "#fff", color: C.ink,
                 font: `${wide ? 15 : 13}px ${FONT}`, fontVariantNumeric: "tabular-nums" }}/>
      {suffix && <span style={{ fontSize: 12, color: C.faint }}>{suffix}</span>}
    </div>
  </label>
);

const Big = ({ value, unit, pre }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
    {pre && <span style={{ fontSize: 13, color: C.sub }}>{pre}</span>}
    <span style={{ fontSize: 46, fontWeight: 700, lineHeight: 1, letterSpacing: "-.02em",
                   fontVariantNumeric: "tabular-nums" }}>{value}</span>
    <span style={{ fontSize: 15, color: C.sub, fontWeight: 600 }}>{unit}</span>
  </div>
);

const chip = (fg, bg) => ({ fontSize: 11.5, color: fg, background: bg, borderRadius: 999,
                            padding: "4px 11px", fontWeight: 600 });

// ══════════════════════════════════════════════════════════════════
//  관리자 패널 — **고객은 원리적으로 볼 수 없다** (Ctrl+Alt+M 으로만 열린다)
// ══════════════════════════════════════════════════════════════════
//  여기서만 원가·수식·마진이 화면에 나온다. 원가와 적용 결과를 **한 줄에 나란히**
//  놓는 것이 요점이다 — 부스에서 「204 원이 ¥35 로 맞나」를 눈으로 즉석 검산한다.
//  거부됐으면 그 이유가 여기에만 뜨고, 고객 화면 금액 자리는 「—」다(원가로 안 돌아간다).
//  ⚠ 문구는 price-formula 의 ADMIN_T 가 소유한다(한국어 한 벌 — 왜인지는 그 파일 주석).
const AdminPanel = ({ a, v, cfg, set, hiding, onQuote, onClose }) => {
  const row = { display: "flex", alignItems: "center", gap: 8 };
  const lab = { fontSize: 11, color: C.faint, width: 62, flexShrink: 0 };
  const fx = (key, label) => (
    <div style={row}>
      <div style={lab}>{label}</div>
      <input value={cfg[key]} placeholder={a.ph} spellCheck={false}
        data-fx={key} onChange={e => set(c => ({ ...c, [key]: e.target.value }))}
        style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "6px 8px",
                 borderRadius: 6, border: `1px solid ${v.cur === key && v.mode === "blocked" ? C.bad : C.line}`,
                 background: "#fff", color: C.ink, font: `13px ${FONT}`,
                 fontVariantNumeric: "tabular-nums" }}/>
    </div>
  );
  return (
    <div data-admin="1" style={{
      position: "fixed", left: 16, bottom: 16, width: 336, zIndex: 60,
      background: C.panel, border: `1px solid ${C.acc}`, borderRadius: 10,
      boxShadow: "0 8px 28px rgba(17,22,29,.18)", padding: 14,
      display: "flex", flexDirection: "column", gap: 9, font: `13px ${FONT}`, color: C.ink }}>
      <div style={{ ...row, justifyContent: "space-between" }}>
        <div style={{ fontSize: 12.5, fontWeight: 800, color: C.acc }}>{a.title}</div>
        <button type="button" data-act="admin-close" onClick={onClose}
          style={{ border: "none", background: "none", cursor: "pointer",
                   fontSize: 11.5, color: C.sub, font: `11.5px ${FONT}` }}>{a.close}</button>
      </div>

      {/* 여는 법을 패널 안에 적는다 — 화면 밖에 적으면 고객이 읽는다. */}
      <div style={{ fontSize: 11, color: C.sub, font: `11px ${FONT}`, marginTop: -4 }}>{a.howto}</div>

      <div style={row}>
        <div style={lab}>{a.cur}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Select value={cfg.cur} onChange={c => set(p => ({ ...p, cur: c }))} options={CUR_CHOICES}/>
        </div>
      </div>
      {fx("KRW", a.fxKRW)}
      {fx("JPY", a.fxJPY)}

      {/* 원가 ↔ 적용 결과 — 나란히. 이 줄이 이 패널의 본체다. */}
      <div style={{ display: "flex", gap: 10, background: C.soft, borderRadius: 8, padding: "9px 11px" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: C.faint }}>{a.cost}</div>
          <div data-admin-cost={v.cost ?? ""} style={{ fontSize: 17, fontWeight: 700,
                fontVariantNumeric: "tabular-nums" }}>
            {v.cost != null ? `${v.cost.toLocaleString()}원` : a.none}
          </div>
        </div>
        <div style={{ width: 1, background: C.line }}/>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, color: C.faint }}>{a.out} · {v.cur}</div>
          <div data-admin-out={v.main} style={{ fontSize: 17, fontWeight: 700,
                color: v.mode === "blocked" ? C.bad : C.ink, fontVariantNumeric: "tabular-nums" }}>
            {v.main}
          </div>
        </div>
      </div>

      {/* 거부 사유 — **여기에만** 뜬다. mode "hidden"(가림 표시를 달고 온 링크인데
          이 브라우저에 수식이 없다)도 이유를 말해야 한다 — 안 그러면 운영자가
          「왜 —만 뜨지」에서 멈춘다. */}
      {(v.mode === "blocked" || v.mode === "hidden") && (
        <div data-admin-why="1" style={{ fontSize: 11.5,
              color: v.mode === "blocked" ? C.bad : C.warn, lineHeight: 1.6 }}>{v.why}</div>
      )}
      {/* ★ 상식 밴드 밖 — **거부가 아니라 경고**다(price-formula BAND).
          ¥0 은 누가 봐도 틀렸지만 `/10` 이 빠진 ¥379 는 진짜처럼 보인다. 그래서 붉게. */}
      {!!v.warn && (
        <div data-admin-warn="1" style={{ fontSize: 11.5, color: C.bad, lineHeight: 1.6 }}>{v.warn}</div>
      )}
      {/* 「자동」이 통화를 넘겼으면 그 사실을 말한다 — 조용히 넘기면 화면의 ¥ 가 어디서
          왔는지 아무도 모른다 (price-formula pickCur). */}
      {!!v.fell && (
        <div data-admin-fell={v.cur} style={{ fontSize: 10.5, color: C.warn, lineHeight: 1.65 }}>
          {a.fell(v.cur)}
        </div>
      )}
      {/* 반올림 규칙을 글로 — 숨은 반올림은 부스에서 「왜 계산이 안 맞죠」가 된다 */}
      <div style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.65 }}>
        {v.roundNote}
        {v.mode === "value" && v.exact !== v.value && (
          <span style={{ color: C.faint }}>{`  (${v.exact} → ${v.value})`}</span>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.65 }}>{a.hint}</div>
      <div style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.65 }}>
        {v.mode === "cost" ? a.off : v.mode === "hidden" ? a.hidden : a.on}
      </div>
      {/* 「자동」으로 두면 새로고침 한 번에 통화가 언어를 따라 돌아간다 — 실측한 함정이다 */}
      {cfg.cur === "auto" && v.mode !== "cost" && (
        <div data-admin-autowarn="1" style={{ fontSize: 10.5, color: C.warn, lineHeight: 1.65 }}>
          {a.autoWarn}
        </div>
      )}
      {/* ★ 링크가 무엇을 싣고 무엇을 안 싣는지 — **안심시키지 않는다.** 종전 문구
          「링크·주소창에는 싣지 않습니다 (마진 유출 방지)」는 운영자가 「이 링크는
          보내도 안전하다」로 읽었고, 그때 그 링크는 원가를 완전히 드러내고 있었다
          (price-formula ⑥ 절 ★★ — 실측 critical). 지금은 비트를 싣고, 문구는
          「지우면 보인다」까지 적는다. 읽히는 색이어야 한다 — faint 는 안 읽힌다. */}
      <div style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.65 }}>{a.store}</div>
      <div data-admin-link="1" style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.65 }}>{a.link}</div>
      {/* 고객 화면에서 치운 「견적 앱으로 →」 문. 여기에만 둔다(header 주석 참조). */}
      {hiding && (
        <button type="button" data-act="admin-toquote" onClick={onQuote}
          style={{ alignSelf: "flex-start", border: `1px solid ${C.line}`, background: "#fff",
                   borderRadius: 6, padding: "5px 9px", cursor: "pointer",
                   font: `11.5px ${FONT}`, color: C.sub }}>{a.toQuote}</button>
      )}
      <div style={{ fontSize: 10.5, color: C.faint, lineHeight: 1.65 }}>{a.key}</div>
    </div>
  );
};

const tabStyle = on => ({
  padding: "6px 10px", borderRadius: 6, cursor: "pointer", font: `12.5px ${FONT}`,
  border: `1px solid ${on ? C.acc : C.line}`, background: on ? C.accBg : "#fff",
  color: on ? C.acc : C.sub, fontWeight: on ? 700 : 500,
});

function btnStyle(kind, on = true) {
  const base = { borderRadius: 7, cursor: on ? "pointer" : "default", font: `13px ${FONT}`,
                 padding: "9px 18px", fontWeight: 600, whiteSpace: "nowrap",
                 opacity: on ? 1 : 0.45, transition: "background .12s" };
  if (kind === "primary") return { ...base, border: "1px solid transparent", background: C.acc, color: "#fff" };
  if (kind === "on")      return { ...base, border: `1px solid ${C.acc}`, background: C.accBg, color: C.acc };
  if (kind === "mini")    return { ...base, padding: "6px 10px", fontSize: 12, fontWeight: 500,
                                   border: `1px solid ${C.line}`, background: "#fff", color: C.sub };
  return { ...base, border: `1px solid ${C.line}`, background: "#fff", color: C.ink };
}

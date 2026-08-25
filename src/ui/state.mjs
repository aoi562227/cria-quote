// ══════════════════════════════════════════════════════════════════
//  state.mjs — UI 상태 ↔ 도메인 입력 변환
//
//  변환은 **여기 한 곳**에서만 한다. parseInt(s.printU) 같은 코드가 도메인에
//  있으면 테스트가 UI 키 64개를 알아야 한다.
// ══════════════════════════════════════════════════════════════════
import { SOBOO_UNIT_DEFAULT } from "../domain/data/print-prices.mjs";
import { EMB_RPR_DEFAULT, FOIL_RPR_DEFAULT } from "../domain/data/process-prices.mjs";
import { structures, getStructure } from "../domain/dieline/index.mjs";
import { today } from "./format.mjs";

// ⚠ parseFloat 필수: parseInt("15.5")=15 → D≤15 조건 오작동, parseInt("73.5")=73 오차
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const int = v => { const n = parseInt(v);   return Number.isFinite(n) ? n : 0; };

export const INITIAL_STATE = {
  customer: "코리팩", product: "십자B 패키지", date: today(),
  // 규격 입력: sizeMode "box" = W·D·H로 전개도 자동계산 / "net" = 전개도 전체크기 직접입력
  sizeMode: "box",
  bW: "40", bD: "40", bH: "133", boxType: "tuck_both",
  // ── 목형별 구조 옵션 (26-08-25) ─────────────────────────────────
  //  빈 문자열 = 「목형 미지정」이고, 그때 도메인은 구조의 **기본값**(안전 봉투)으로
  //  계산한다. 「자동」이 안전한 가정이지 정답이 아니라는 사실은 화면이 말한다
  //  (BoxSpec 「목형 미지정 — 표준 가정」 줄). 숨기면 견적이 가정 위에 선 것을 숨기는 것이다.
  //  ⚠ 구조를 바꿔도 **지우지 않는다.** 도메인이 pickDieOpt 로 그 구조의 노브만 걸러
  //    읽으므로 섞이지 않고, 지우면 십자↔삼면을 오갈 때 넣어둔 실측값이 사라진다.
  dieDeep: "",                   // 삼면접착 아래 띠 깊은 날개: "" | "far" | "near" | "both"
  dieTabW: "",                   // 십자 접착탭 실폭 mm (빈값 = 표준 24.03)
  nW: "646", nH: "258",           // 전개도 전체크기 직접입력 (예: 슬리브 646×258)
  // 칼선 PDF 추출 결과 한 벌. readDieline 이 준 객체를 **그대로** 담는다
  //   { pageSize, bbox, polygons, candidates, source, warnings, pageCount, sheetId }
  //   + UI 가 얹는 2개: pickIdx(후보 드롭다운 선택) · page(「2종」 도면의 페이지)
  // 왜 통째로 보관하나: polygons 가 3단계(마우스 드래그 배치)의 입력이다. bbox 만
  // 남기면 그때 추출을 다시 만들어야 한다. pickIdx 는 후보 드롭다운의 선택이다.
  // 도메인은 이 값을 읽지 않는다 — 치수는 위 nW/nH 로 흘러가고(sizeMode="net"),
  // 여기 있는 건 화면·3단계용 원본이다. 그래서 toQuoteInput 에 넣지 않았다.
  //
  // ⚠ 3단계는 `s.pdfDl.polygons` 를 읽지 마라 — **`pdfPickOf(s).polygons` 를 읽어라.**
  //   polygons 가 두 벌이다: s.pdfDl.polygons(추출기 1순위) 와
  //   s.pdfDl.candidates[pickIdx].polygons(사용자가 드롭다운에서 고른 것). 정답은 후자다.
  //   앞쪽을 읽으면 사용자가 후보를 바꾼 뒤에도 **바꾸기 전 도형**을 조용히 그린다.
  //   iSHAP 무제-3 은 후보가 4개(2up 대지의 좌/우 × 도련/칼선)라 실제로 밟히는 경로다.
  pdfDl: null,
  // ── 3단계 손배치(마우스 드래그) ──────────────────────────────────
  // placement = 앉힌 배치 배열 [{x,y,flipped,rotated}] (판 좌표 mm, y 아래로).
  //   ⚠ toQuoteInput 에 **넣지 않는다.** 치수는 nW/nH 로만 흐른다는 §9 규칙을 지키고,
  //     개수(up)는 아래 mUp/mUpV = overrides.up 이라는 **기존 통로**로만 흘린다.
  //     그래서 도메인은 손배치를 모른다 — quote.mjs 수정 0줄.
  //   w/h 를 같이 저장하지 않는 이유: 90° 회전은 발자국이 w↔h 로 바뀌므로 저장하면
  //     부품(itemW/itemH)과 두 벌이 갈린다. 발자국은 늘 부품에서 파생시킨다.
  // handPrev = 손배치를 켜기 **전** 값 한 벌. 끄면 그대로 되돌린다.
  //   sheetId 까지 담는 이유: mUp 이 켜지면 decideSheet ① 분기가
  //   findSheetBase("auto") → BASE_SHEETS[3](4×64) 로 떨어져 **판이 통째로 바뀐다.**
  //   앉혀둔 좌표가 다른 판의 좌표가 되므로 켜는 순간 지금 판으로 못 박아야 한다.
  handMode: false, placement: null, handPrev: null,
  paperId: "AB350", sheetId: "auto",
  cusW: "890", cusH: "670", cusCut: "2",   // 주문생산 판형 크기·절수
  mR: false, mRV: "",
  mUp: false, mUpV: "",          // 판걸이(up) 직접 입력
  hang: false, hangV: "15",      // 행거탭(유로홀) 돌출 mm
  lossSheets: "",                // 여분(손지) 수동 입력 장수 (빈값=자동)
  mPrice: false, mPriceV: "",
  qty: "5000",
  fpSp: "1", fpBk: true,  fpUv: false, fpColor: false,
  bpSp: "0", bpBk: false, bpUv: false, bpColor: false,
  beda: false,                   // 별색 베다(바탕 전면 인쇄) → 별색 R단가 상향
  spotMode: "weight",            // "weight"=별색 도수환산(×3) / "rpr"=별색 R당 고정단가
  spotRprV: "", printU: "",      // 별색 R단가 / 인쇄 도당단가 (빈값=판형별 기본)
  sobooU: String(SOBOO_UNIT_DEFAULT),
  fcId: "ir", bcId: "none",
  puv: false, puvS: "1",
  thomId: "n", glueId: "dan",
  admin: "100000", adminManual: false,
  newDie: true, dieQ: "1", dieP: "140000", filmC: "",
  emb: false, embRpr: String(EMB_RPR_DEFAULT), embDevP: "90000", embFilmP: "28000",
  foil: false, foilType: "금박", foilS: "1", foilRpr: String(FOIL_RPR_DEFAULT),
  foilDevP: "25000", foilFilmP: "35000",
  showCompare: false, showSheetCompare: false, showViz: true, showNet: false,
  showSheet: false,              // 판형 캔버스(판 + 물림 + 자)
};

/** 구조가 톰슨 기본값을 선언했으면 그걸로 강제 전환하고, 아니면 복귀시킨다.
 *  종전에는 `boxType === "gtype" ? "g_std"` 로 문자열이 여기 박혀 있어서
 *  레지스트리의 thomsonDefault 가 선언만 되고 아무도 읽지 않았다.
 *  복귀 조건도 "어떤 구조든 자기 기본값이던 값이면 일반(n)으로" 로 일반화했다.
 *  ※ 박스 구조와 접착 방식은 별개다 — 삼면접착 구조여도 접착 작업은 단면이 일반적(실측). */
const THOM_DEFAULTS = new Set(
  structures().map(st => getStructure(st.id)?.thomsonDefault).filter(Boolean));

export const nextThomId = (boxType, cur) =>
  getStructure(boxType)?.thomsonDefault ?? (THOM_DEFAULTS.has(cur) ? "n" : cur);

/**
 * 칼선 PDF 에서 **지금 고른 후보 한 개**를 푼다 — `{ bbox:{w,h,x0,y0}, polygons }`.
 *
 * ★ pdfDl 의 polygons 는 두 벌이다. 그 둘 중 무엇이 정답인지 아는 규칙은 **여기 하나**다.
 *   ① s.pdfDl.polygons                        추출기 1순위 (사용자 선택 반영 안 됨)
 *   ② s.pdfDl.candidates[pickIdx].polygons    사용자가 드롭다운에서 고른 것 ← 정답
 *   종전에는 이 규칙이 BoxSpec.jsx 안의 모듈 private const 여서, 3단계 구현자가 ① 을
 *   읽으면 후보를 바꾼 뒤에도 바꾸기 전 도형을 조용히 그리게 돼 있었다. state 를 읽는
 *   규칙은 state 가 갖는다 — 화면(BoxSpec)과 3단계가 같은 함수를 부른다.
 *
 * candidates 가 비어 있어도 최상위 bbox 로 접혀 동작한다 (readDieline 계약이 bbox·
 * polygons 를 항상 채운다). 에러 결과·미로드는 null.
 */
export function pdfPickOf(s) {
  const r = s?.pdfDl;
  if (!r || r.error) return null;
  return r.candidates?.[r.pickIdx ?? 0]
    ?? { bbox: { w: r.bbox.w, h: r.bbox.h, x0: 0, y0: 0 }, polygons: r.polygons };
}

/** 주문생산 판형 크기·절수 (판형이 custom 일 때만 유효) */
export function customSheetOf(s) {
  const w = num(s.cusW), h = num(s.cusH), cut = int(s.cusCut) || 2;
  return (w > 0 && h > 0) ? { w, h, cut } : null;
}

/**
 * UI 상태 → QuoteInput.
 *
 * ⚠ overrides 의 값들은 **빈칸이면 undefined** 여야 한다. 0 을 넣으면 도메인이
 *   "0원으로 계산해달라" 는 지시로 받는다(?? 로 읽으므로). 종전 `parseInt(x) || 기본값`
 *   동작을 유지하려면 여기서 0 을 undefined 로 접어야 한다.
 */
export function toQuoteInput(s) {
  const hangTab = s.hang ? (num(s.hangV) || 15) : 0;
  const mUp = int(s.mUpV);
  return {
    qty: int(s.qty),
    box: {
      mode: s.sizeMode, structure: s.boxType, hangTab,
      W: num(s.bW), D: num(s.bD), H: num(s.bH),
      netW: num(s.nW), netH: num(s.nH),
      // ★ 목형별 구조 옵션. 빈칸은 **빼고 넘긴다** — 0 이나 "" 를 넘기면 도메인이
      //   「그 값으로 계산해달라」로 읽는다(overrides 와 같은 함정). 빠지면 기본값.
      dieOpt: {
        ...(s.dieDeep ? { deepFlap: s.dieDeep } : {}),
        ...(num(s.dieTabW) > 0 ? { glueTabW: num(s.dieTabW) } : {}),
      },
    },
    paper: { paperId: s.paperId, sheetId: s.sheetId, custom: customSheetOf(s) },
    print: {
      front: { color: !!s.fpColor, spot: int(s.fpSp), black: !!s.fpBk, uv: !!s.fpUv },
      back:  { color: !!s.bpColor, spot: int(s.bpSp), black: !!s.bpBk, uv: !!s.bpUv },
      beda: !!s.beda, spotMode: s.spotMode || "weight",
    },
    finish: {
      coatFrontId: s.fcId, coatBackId: s.bcId, thomsonId: s.thomId, glueId: s.glueId,
      foil: s.foil ? { type: s.foilType, sides: Math.max(1, int(s.foilS) || 1),
                       rpr: int(s.foilRpr) } : null,
      emb:  s.emb  ? { rpr: int(s.embRpr) } : null,
      puv:  s.puv  ? { sides: Math.max(1, int(s.puvS) || 1) } : null,
    },
    overrides: {
      up:             (s.mUp && mUp > 0) ? mUp : undefined,
      reams:          s.mR ? num(s.mRV) : undefined,
      paperPricePerR: s.mPrice ? num(s.mPriceV) : undefined,
      lossSheets:     s.lossSheets,
      printUnit:      int(s.printU)   || undefined,
      spotRpr:        int(s.spotRprV) || undefined,
      sobooUnit:      int(s.sobooU)   || undefined,
      admin:          s.adminManual ? (int(s.admin) || 100000) : undefined,
    },
    dev: {
      newDie: !!s.newDie, dieQty: int(s.dieQ), diePrice: int(s.dieP),
      filmCost: int(s.filmC),
      embDevPrice: int(s.embDevP), embFilmPrice: int(s.embFilmP),
      foilDevPrice: int(s.foilDevP), foilFilmPrice: int(s.foilFilmP),
    },
  };
}

// ══════════════════════════════════════════════════════════════════
//  ★ 사양 링크 — 견적서 화면 ↔ 쇼룸 화면 (26-08-18)
// ══════════════════════════════════════════════════════════════════
//  왜 이 코덱이 **state.mjs 안에** 있나
//  ──────────────────────────────────
//  싣고 내리는 것이 곧 「toQuoteInput 이 읽는 키」다. 다른 파일에 두면 단가를
//  움직이는 키가 하나 늘 때 toQuoteInput 만 고쳐지고 이 목록은 조용히 낡는다 —
//  그 순간 증상은 「같은 박스인데 두 화면 금액이 다르다」이고, 그게 지금 고치는
//  고장이다(실측: 삼면접착 140×43×130 · 295AB · 4×62 · 4,000 → 견적서 204원 ·
//  쇼룸 223원. 갈린 항목은 지대 한 줄이고 원인은 지종이 안 넘어간 것뿐이었다).
//  변환기 바로 아래 두면 다음 사람이 두 개를 같이 본다.
//
//  왜 URL 해시인가 — 후보 셋을 견줬다
//  ────────────────────────────────
//   · App 으로 상태 끌어올리기 : 새로고침에 날아간다. 부스 노트북이 한 번
//     새로고침되면 잡아둔 사양이 사라진다. QuoteApp 의 상태 64칸을 App 이 들어야
//     하므로 「실무앱은 버튼 하나만 추가」라는 이번 범위도 넘긴다.
//   · sessionStorage : 새로고침은 살지만 **링크가 되지 않는다.** 부스에서
//     「그 사양 그대로 다시 띄워 주세요」를 주소 하나로 못 넘긴다.
//   · URL 해시 ← **채택.** 북마크·재현·공유가 공짜로 따라오고, 브라우저 뒤로가기가
//     그대로 「돌아가기」가 된다(hashchange 라우터가 App 에 이미 있다). 새로고침에도
//     산다. 값이 주소창에 보이므로 「무엇이 넘어갔나」를 눈으로 확인할 수 있다.
//
//  ⚠ 고객사·품명은 **싣지 않는다.** 단가를 움직이지 않고(위 Proxy 측정에서도
//    toQuoteInput 이 읽지 않는다), 이 주소는 부스에서 **고객 앞 화면의 주소창**에
//    뜨며 링크로 보내지기도 한다 — 거기 다른 고객사 이름이 실려 있으면 안 된다.
//    ★ 대가는 아래 saveNames/loadNames 가 갚는다 — 그 두 칸은 **같은 탭의 세션**이
//    나른다(URL 0바이트). 종전에는 대가를 안 갚아서 왕복하면 두 칸이 조용히
//    「코리팩/십자B 패키지」로 돌아갔다. 싣기로 방침이 바뀌면 SPEC_KEYS 에 두 줄.

/**
 * 화면 사이로 넘기는 키 — **toQuoteInput 이 읽는 것과 같아야 한다.**
 *
 * 눈으로 세지 않았다: `test/verify-speclink` 가 Proxy 로 toQuoteInput 의 실제 읽기를
 * 잡아 이 배열과 대조한다. 토글을 켠 판·끈 판을 **합집합**으로 재는 것이 핵심이다 —
 * 9개(hangV·mRV·mPriceV·admin·embRpr·foilType·foilS·foilRpr·puvS)는 짝 불리언이
 * 참일 때만 읽혀서, 기본 상태 한 번만 재면 「빠졌는데 초록」이 된다.
 */
export const SPEC_KEYS = [
  // 규격·구조 (행거탭은 netH 를 바꾼다 = 전개도가 달라진다)
  "sizeMode", "boxType", "bW", "bD", "bH", "nW", "nH", "hang", "hangV",
  // 목형별 구조 옵션 — **폴리곤을 바꾼다 = 판걸이가 바뀐다 = 금액이 바뀐다.**
  //   빠지면 증상은 「같은 박스인데 견적서 2up · 쇼룸 1up」이고, 이 스위트가 고치는
  //   204원 고장과 정확히 같은 종류다. §A 가 Proxy 로 실측해 빠짐을 잡는다.
  "dieDeep", "dieTabW",
  "qty",
  // 지종·판형 (주문생산 판형은 크기·절수까지 있어야 같은 판이 된다)
  "paperId", "sheetId", "cusW", "cusH", "cusCut",
  // 인쇄 — 앞/뒤 · 원색 · 별색 · 먹 · UV · 베다 · 별색환산방식
  "fpColor", "fpSp", "fpBk", "fpUv", "bpColor", "bpSp", "bpBk", "bpUv",
  "beda", "spotMode",
  // 코팅 · 톰슨 · 접착 · 후가공(박·형압·부분UV)
  "fcId", "bcId", "thomId", "glueId",
  "foil", "foilType", "foilS", "foilRpr", "emb", "embRpr", "puv", "puvS",
  // 직접입력(override) — 켜져 있으면 금액을 지배하므로 빠지면 안 된다
  "mUp", "mUpV", "mR", "mRV", "mPrice", "mPriceV", "lossSheets",
  "printU", "spotRprV", "sobooU", "adminManual", "admin",
  // 개발비 (perEA 에는 안 들어가지만 견적서 총액에는 들어간다)
  "newDie", "dieQ", "dieP", "filmC", "embDevP", "embFilmP", "foilDevP", "foilFilmP",
];

// ── 거래처·품명은 URL 이 아니라 **세션**이 나른다 (26-08-19) ─────────
//  위 방침(주소창·링크에 고객사 이름을 싣지 않는다)은 그대로다. 그런데 그 대가로
//  왕복하면 두 칸이 **조용히 초기값으로 돌아갔다** — 그리고 초기값 「코리팩」은
//  빈칸이 아니라 **그럴듯한 다른 고객사 이름**이다. 그대로 출력하면 남의 고객사
//  이름이 박힌 견적서가 나간다(적대검증 minor ⑥). 방향이 「조용히 틀린 출력」이라
//  금액 버그와 같은 등급으로 다룬다.
//
//  왜 sessionStorage 인가 — 위에서 사양을 sessionStorage 로 나르는 안을 버린 이유는
//  「링크가 되지 않는다」였다. 이 두 칸에는 그것이 **정확히 원하는 성질**이다:
//    · 링크·주소창에 안 실린다 → 유출 방침이 그대로 지켜진다
//    · 같은 탭에서는 산다      → 왕복·새로고침에서 이름이 안 사라진다
//    · 탭이 닫히면 사라진다    → 다음 사람이 남의 거래처명을 물려받지 않는다
//  복원에 실패하면(다른 탭에서 링크를 열었다 · 사생활 보호 모드) **비운다.**
//  「코리팩」으로 접으면 안 된다 — 그게 이 고장의 본체다. 비었다는 사실은 화면이
//  말한다(App.jsx 의 링크 안내 줄).
const NAMES_KEY = "cria-quote.names.v1";

/** 거래처·품명을 이 탭에 적어둔다. 실패는 무해하다(안내 줄이 대신 말한다). */
export function saveNames(s) {
  try {
    sessionStorage.setItem(NAMES_KEY, JSON.stringify(
      { customer: String(s?.customer ?? ""), product: String(s?.product ?? "") }));
  } catch { /* 사생활 보호 모드 등 — 비운 채로 간다 */ }
}

/** 이 탭에 적어둔 거래처·품명. 없으면 **null**(= 「모른다」, 초기값이 아니다). */
export function loadNames() {
  try {
    const r = JSON.parse(sessionStorage.getItem(NAMES_KEY) || "null");
    if (!r || typeof r !== "object") return null;
    return { customer: String(r.customer ?? ""), product: String(r.product ?? "") };
  } catch { return null; }
}

/**
 * ★ 청구 up ↔ 그린 up 게이트 (26-08-19).
 *
 * ARCHITECTURE §12-3 은 쇼룸에 대해 「그릴 배치는 전부 게이트를 통과해야 한다」를
 * 못박았다. **견적서에도 같은 규칙이 필요하다** — 근거는 실측이다:
 *   국2 · 판걸이 직접입력 3 → 요약·지대는 「3 up · 1.634R · 240원」인데 같은 화면의
 *   배치 시각화는 「2 up · 1열×2행 · 수율 57%」를 그리고 칸도 2개만 그린다.
 *   4×62 에서는 청구 3 vs 그린 4 로 갈린다. 경고가 하나도 없었다.
 * 원인은 도메인 구조다(고장이 아니다): decideSheet ①② 는 up·R 을 사용자 값으로
 * 받아 배치 계산을 **우회**하는데, layout 은 그와 무관하게 solveImposition 이
 * 따로 푼다. 즉 두 수는 원리적으로 갈릴 수 있다 — 갈리면 **그림 쪽을 접어야** 한다.
 * 청구가 진실이고(돈이 그 수로 나간다) 그림은 「규칙격자로 푼 다른 배치」다.
 *
 * ⚠ 숫자(원지·R수·지대단가·판걸이)는 전부 sheet 에서 온다 = 청구 진실이므로 남긴다.
 *   접는 것은 **배치에서 파생된 주장**뿐이다: 배치 그림 · 열×행 · 수율 · 회전/인터로킹.
 * @returns {{billed:number, drawn:?number, mismatch:boolean}}
 */
export function upGateOf(q) {
  const billed = q?.sheet?.up ?? 0;
  const drawn = q?.layout ? (q.layout.up ?? 0) : null;
  return { billed, drawn, mismatch: drawn != null && billed > 0 && drawn !== billed };
}

/** 형식 버전. 이 한 쌍이 늘 실리므로 **초기값 그대로여도 페이로드가 비지 않는다** —
 *  비면 받는 쪽이 「사양 없음(단독 진입)」으로 읽어 자기 기본값을 쓴다. 초기값
 *  그대로인 사양을 넘겼는데 쇼룸이 표준사양으로 갈아타면 그것도 금액이 갈리는 길이다. */
const SPEC_V = "1";

/**
 * 상태 → 페이로드. **초기값과 다른 키만** 싣는다.
 *
 * 형식 `키~값;키~값` — 부스에서 주소창을 그대로 읽을 수 있다(`bW~140;paperId~AB295L`).
 * `~` `;` 는 조각(fragment)에서 그대로 허용된다(RFC 3986 sub-delims / unreserved).
 * 값만 encodeURIComponent 한다: 숫자·영문 id 는 손대지 않아 읽히고, 「금박」 같은
 * 한글이나 사용자가 친 이상한 글자는 안전하게 접힌다.
 * 불리언은 1/0 — "false" 로 적으면 되읽을 때 참인 문자열이 된다.
 */
export function encodeSpec(s) {
  const out = [`v~${SPEC_V}`];
  for (const k of SPEC_KEYS) {
    const d = INITIAL_STATE[k];
    const cur = typeof d === "boolean" ? (s?.[k] ? "1" : "0") : String(s?.[k] ?? "");
    const def = typeof d === "boolean" ? (d ? "1" : "0") : String(d ?? "");
    if (cur !== def) out.push(`${k}~${encodeURIComponent(cur)}`);
  }
  return out.join(";");
}

/**
 * 페이로드 → 상태 한 벌 (INITIAL_STATE 위에 얹는다). 페이로드가 비면 **null** —
 * 「사양 없음」이고, 그러면 두 화면 다 종전 기본값으로 뜬다(쇼룸 단독 진입).
 *
 * ⚠ 해시는 **바깥에서 들어오는 값**이다(누가 링크를 고쳐 보낼 수 있다). 그래서
 *   ① SPEC_KEYS 에 있는 키만 받고 ② 초기값의 **타입으로 강제**한다. 모르는 키는
 *   조용히 버린다 — 상태에 없던 칸이 생기면 화면이 아니라 도메인이 깨진다.
 *   깨진 %-이스케이프도 그 쌍만 버리고 나머지는 살린다(링크 하나가 화면을 못 죽인다).
 */
export function decodeSpec(payload) {
  const raw = String(payload || "").trim();
  if (!raw) return null;
  const known = new Set(SPEC_KEYS);
  const out = { ...INITIAL_STATE };
  for (const pair of raw.split(";")) {
    const i = pair.indexOf("~");
    if (i < 0) continue;
    const k = pair.slice(0, i);
    if (!known.has(k)) continue;                 // v(버전)와 낯선 키가 여기서 걸린다
    let v;
    try { v = decodeURIComponent(pair.slice(i + 1)); } catch { continue; }
    out[k] = typeof INITIAL_STATE[k] === "boolean" ? v === "1" : v;
  }
  return out;
}

/** 사양을 실은 해시. route 는 "" (견적서) 또는 "showroom".
 *  ⚠ App 의 라우터가 `/^#\/?showroom\b/` 이므로 `#/showroom?…` 이 그 정규식에 맞아야 한다. */
export const specHash = (route, s) => `#/${route}?q=${encodeSpec(s)}`;

/** 해시에서 페이로드만 뽑는다. `#/showroom?q=…` · `#showroom?q=…` 둘 다 받는다.
 *  페이로드에 `&` 는 원리적으로 없다 — encodeURIComponent 가 %26 으로 접는다. */
export function payloadOfHash(hash) {
  const h = String(hash || "");
  const i = h.indexOf("?");
  if (i < 0) return "";
  for (const part of h.slice(i + 1).split("&"))
    if (part.startsWith("q=")) return part.slice(2);
  return "";
}

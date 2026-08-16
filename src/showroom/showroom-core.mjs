// ══════════════════════════════════════════════════════════════════
//  showroom-core.mjs — 쇼룸(전시회용) 페이지의 **React 아닌 부분** 전부.
//
//  왜 이 파일이 따로 있나
//  ────────────────────
//  ShowroomPage.jsx 는 「그리기 + 포인터」만 하게 두고, 「무엇을 그릴지 정하는
//  판단」은 여기 모은다. 판단이란 셋뿐이다:
//    ① 도면 한 장 → 충돌 부품 P + 그릴 윤곽   (partOf)
//    ② 자동 배치 결과 중 **무엇을 채택하나**   (autoPlace / fillMore)
//    ③ 그 배치를 **그려도 되는가**             (auditItems ← ★ 겹침 게이트)
//  ③ 이 이 파일의 존재 이유다. 겹친 배치를 고객 앞에서 그리면 신뢰를 잃는다 —
//  그래서 「그리기 직전에 재는」 함수를 화면 코드 밖에 두고 반드시 통과시킨다.
//
//  ★ 새 기하를 한 줄도 짜지 않는다.
//    · 자동 배치 = nest-free.solveFree (이미 있다)
//    · 손배치 스냅·겹침 = ui/viz/nest-drag.mjs (이미 있다)
//    · 판 = imposition.printableArea (도메인 정의 그대로)
//    · 단가 = domain/quote.buildQuote (**도메인 수정 0줄** — up 은 기존
//      overrides.up 통로로만 흘린다: state.mUp/mUpV → toQuoteInput)
//    이 파일이 실제로 소유하는 것은 「어느 해를 고르나」와 「표준 사양 한 벌」뿐이다.
//
//  배치 1개의 규약은 세 모듈이 **이미 같다** — {x, y, flipped, rotated},
//  x·y 는 발자국 bbox 좌상단, 판 좌표 mm, y 아래로.
//    solveFree 가 내는 items · nest-drag 가 끄는 items · imposition 의 layout.boxes
//  그래서 어댑터가 필요 없다. (layout.boxes 만 w/h/idx 를 더 갖고 있어 아래
//  seedOf 에서 네 필드만 뽑는다 — 그것이 유일한 변환이고 한 줄이다.)
// ══════════════════════════════════════════════════════════════════
import { BASE_SHEETS } from "../domain/data/sheets.mjs";
import { printableArea } from "../domain/imposition.mjs";
import { INITIAL_STATE, toQuoteInput } from "../ui/state.mjs";
import { solveFree, fillGaps } from "../nest-free.mjs";
import {
  makeDragPart, pdfLocalPolylines, overlapPairs, boundsCheck,
} from "../ui/viz/nest-drag.mjs";

// ══════════════════════════════════════════════════════════════════
//  판 (sheet)
// ══════════════════════════════════════════════════════════════════

/** 고를 수 있는 판형. 주문생산(custom)은 크기 입력이 따로 필요해 쇼룸에서 뺀다 —
 *  「항목을 최소로」가 이 화면의 규칙이다. */
export const SHEET_CHOICES = BASE_SHEETS.filter(b => b.id !== "custom");

/**
 * 판 한 장의 두 좌표계. **하나로 합치지 마라** — SheetCanvas 가 같은 이유로 둘을 쓴다.
 *  · draw : 눈에 보이는 판 = 인쇄기 990×720 클램프 후 실제로 걸리는 면
 *  · fit  : 배치 판정면 = printableArea (FIT_TOL 여유 포함). 이걸로 재야
 *           도메인이 푼 격자 배치를 씨앗으로 받았을 때 「판 밖」이 뜨지 않는다.
 */
export function frameOf(sheet) {
  const pa = printableArea(sheet);
  return { sheet, drawW: pa.long, drawH: pa.short, capped: pa.capped,
           fitW: pa.printW, fitH: pa.printH };
}

// ══════════════════════════════════════════════════════════════════
//  도면 한 장 → 충돌 부품 + 그릴 윤곽
// ══════════════════════════════════════════════════════════════════

/**
 * @param {{kind:"pdf", pick:Object} | {kind:"box", dieline:Object}} source
 * @returns {{P, cuts:number[][][], folds:number[][][], w:number, h:number}|null}
 *
 * ⚠ 그림(cuts)과 충돌 도형(P)은 **같은 출처**여야 한다. 갈리면 「닿아 보이는데
 *   안 놓이는」 자리가 생기고 눈으로는 못 잡는다 (nest-drag 머리말과 같은 규칙).
 */
export function partOf(source) {
  if (!source) return null;
  if (source.kind === "pdf") {
    const pick = source.pick;
    const polylines = pdfLocalPolylines(pick);          // 페이지 절대좌표 → 판 로컬
    if (!polylines?.length) return null;
    const P = makeDragPart({ polylines, w: pick.bbox.w, h: pick.bbox.h });
    // PDF 는 칼선/접는선이 구분돼 오지 않는다 — 온 그대로 그린다(그게 실물이다).
    return P ? { P, cuts: polylines, folds: [], w: P.w, h: P.h } : null;
  }
  const dl = source.dieline;
  if (!dl?.pieces?.length) return null;
  const P = makeDragPart({ pieces: dl.pieces, w: dl.net.netW, h: dl.net.netH });
  return P ? { P, cuts: dl.cuts || [], folds: dl.folds || [], w: P.w, h: P.h } : null;
}

/** 충돌 도형의 정밀도를 **한 줄로** 말한다. 근사면 근사라고 적는다 —
 *  숨기면 고객이 「정확한 배치」로 읽는다. 문구는 T(언어사전)가 갖는다. */
export const precisionKeyOf = mode =>
  mode === "exact" ? "pExact" : mode === "stitched" ? "pStitched"
  : mode === "raster" ? "pRaster" : mode === "hull" ? "pHull" : "pBbox";

// ══════════════════════════════════════════════════════════════════
//  ★ 겹침 게이트 — 그리기 전에 **반드시** 통과해야 한다
// ══════════════════════════════════════════════════════════════════

/**
 * 이 배치를 그려도 되는가. overlapPairs 는 **겹친 칸의 인덱스 Set** 을 준다
 * (쌍 배열이 아니다 — BoxSpec.handWarn 이 같은 실수를 한 이력이 있다).
 * @returns {{overlap:Set<number>, off:number[], ok:boolean}}
 */
export function auditItems(P, items, frame) {
  if (!P || !items?.length) return { overlap: new Set(), off: [], ok: true };
  const overlap = overlapPairs(P, items);
  const { off } = boundsCheck(P, items, { w: frame.fitW, h: frame.fitH });
  return { overlap, off, ok: overlap.size === 0 && off.length === 0 };
}

// ══════════════════════════════════════════════════════════════════
//  자동 배치
// ══════════════════════════════════════════════════════════════════

/** 자유배치 탐색 예산(겹침 판정 횟수). 실측(test-pdf 3건 · 구조 4건 × 판형 3개)에서
 *  최대 14만 회 · 153ms 였다. 200만이면 그 10배가 넘어 실무 범위를 덮는다.
 *  ⚠ 시간(ms)이 아니라 횟수로 끊는 이유는 nest-free 머리말 「결정성」 참조. */
export const AUTO_OPS = 2_000_000;

/** layout.boxes(도메인 격자해) → 배치 규약 4필드. 이 한 줄이 유일한 변환이다. */
export const seedOf = boxes => (boxes || []).map(b =>
  ({ x: b.x, y: b.y, flipped: !!b.flipped, rotated: !!b.rotated }));

/**
 * 자동 배치 — **격자해와 자유해 중 큰 쪽**.
 *
 * 왜 둘을 다 돌리나: 격자(nest.solveLayout)는 규칙격자만 만들고 자유(solveFree)는
 * 최적을 보장하지 않는다. 어느 하나가 항상 이기지 않는다 — 실측에서 자유가 이긴 건
 * (t-wake2 p0 국2 6 vs 4 · 십자 4×62 7 vs 6), 격자가 이긴 건도 있다.
 * nest-free 머리말이 「부르는 쪽은 두 결과를 비교해서 큰 쪽을 쓴다」고 지시한다.
 *
 * ★ 큰 쪽을 고른 뒤 **다시 잰다**(auditItems). 통과 못 하면 그 해를 버리고 다음 해로
 *   내려간다 — 겹친 배치를 그리느니 up 이 적은 편이 낫다.
 */
export function autoPlace(P, frame, gridBoxes) {
  const t0 = now();
  const grid = seedOf(gridBoxes);
  const free = solveFree(P.pieces, frame.fitW, frame.fitH, { ops: AUTO_OPS });
  const cands = [];
  if (free?.items?.length) cands.push({ items: free.items, via: "free" });
  if (grid.length)         cands.push({ items: grid,       via: "grid" });
  cands.sort((a, b) => b.items.length - a.items.length);

  let chosen = null, rejected = 0;
  for (const c of cands) {
    if (auditItems(P, c.items, frame).ok) { chosen = c; break; }
    rejected++;                       // 정상 동작에서는 0 이다. 0 이 아니면 숨기지 않는다.
  }
  return {
    items: chosen?.items ?? [], up: chosen?.items.length ?? 0, via: chosen?.via ?? null,
    gridUp: grid.length, freeUp: free?.up ?? 0, rejected,
    budgetHit: !!free?.budgetHit, ms: Math.round(now() - t0),
  };
}

/**
 * 사람이 앉힌 배치는 **한 칸도 옮기지 않고** 빈자리에만 더 넣는다.
 * fillGaps 가 그 계약을 갖고 있고, 여기서는 결과를 다시 재기만 한다.
 */
export function fillMore(P, frame, items) {
  const t0 = now();
  const r = fillGaps(P.pieces, frame.fitW, frame.fitH, items, { ops: AUTO_OPS });
  const out = r?.items;
  if (!out || !auditItems(P, out, frame).ok)
    return { items, added: 0, ok: false, ms: Math.round(now() - t0) };
  return { items: out, added: r.added, ok: true, ms: Math.round(now() - t0) };
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

// ══════════════════════════════════════════════════════════════════
//  단가 — 도메인 수정 0줄
// ══════════════════════════════════════════════════════════════════

/**
 * 쇼룸 표준 사양 한 벌. **화면에 그대로 적어서 보여준다**(specLine) —
 * 숨은 가정으로 단가를 내면 고객이 다른 사양의 값으로 읽는다.
 * 값은 실무 표준(★ 개당 204원 회귀 케이스와 같은 사양: 원색 4도 · IR · 단면접착)이다.
 */
export const STD = {
  paperId: "AB350",        // AB 350g — 앱 기본값과 같다
  fpColor: true, fpSp: "0", fpBk: false, fpUv: false,   // 앞면 원색 4도
  bpColor: false, bpSp: "0", bpBk: false, bpUv: false,  // 뒷면 없음
  beda: false, fcId: "ir", bcId: "none",                // IR 코팅 (앞면)
  glueId: "dan", thomId: "n",                           // 단면접착 · 일반 톰슨
  hang: false, mR: false, mPrice: false, lossSheets: "",
};

/**
 * 쇼룸 상태 → QuoteInput.
 *
 * ★ 새 도메인 경로를 만들지 않는다. 기존 UI 변환기(ui/state.toQuoteInput)에
 *   기본 상태 한 벌을 얹어 넘길 뿐이고, 판걸이는 **기존 직접입력 통로**
 *   (mUp/mUpV → overrides.up → quote.decideSheet ① 분기)로만 흘린다.
 *   그 분기가 R = calcR(up, …) 을 다시 재므로 지대R·금액이 자동으로 따라온다.
 *
 * ⚠ up 을 넘기려면 판형이 **구체적인 id** 여야 한다. decideSheet ① 은 "auto" 를
 *   받으면 BASE_SHEETS[3](4×64)로 떨어뜨린다 — 화면에 그린 판과 다른 판으로 값이
 *   나가는 사고다. 그래서 호출부가 resolvedSheetId 를 넘긴다.
 */
export function quoteInputOf({ mode, boxType, W, D, H, netW, netH, sheetId, qty, up }) {
  return toQuoteInput({
    ...INITIAL_STATE, ...STD,
    sizeMode: mode === "pdf" ? "net" : "box",
    boxType,
    bW: String(W ?? ""), bD: String(D ?? ""), bH: String(H ?? ""),
    nW: String(netW ?? ""), nH: String(netH ?? ""),
    paperId: STD.paperId,
    sheetId: sheetId || "auto",
    qty: String(qty ?? ""),
    mUp: up > 0, mUpV: up > 0 ? String(up) : "",
  });
}

// ══════════════════════════════════════════════════════════════════
//  말 (한국어 / 일본어)
// ══════════════════════════════════════════════════════════════════
//  왜 두 벌인가 — 이 화면은 **일본 전시회 부스에서 고객에게 보여준다.** 운영자는
//  한국어로 조작하고 고객은 일본어를 읽는다. 사전을 여기 한 곳에 두고 화면은
//  T(lang).키 로만 쓴다 — JSX 안에 문자열을 흩뿌리면 한쪽만 고쳐진다.
const KO = {
  title: "판걸이 · 단가 시뮬레이터", back: "견적 앱으로",
  draw: "도면", pdf: "칼선 PDF", dims: "치수 입력",
  drop: "칼선 PDF 를 여기에 놓으세요", pick: "파일 선택", reading: "읽는 중…",
  page: "페이지", cand: "도형 후보", struct: "구조",
  w: "가로 W", d: "깊이 D", h: "높이 H", mm: "mm",
  sheet: "판형", auto: "자동", qty: "수량", ea: "개",
  btnAuto: "자동 배치", btnHand: "직접 앉히기", btnHandOff: "배치 끝내기", btnReset: "초기화",
  add: "+ 한 장", rot: "90°", flip: "180°", del: "삭제", fill: "빈 곳 채우기", undo: "되돌리기",
  up: "up", perEA: "개당", won: "원",
  netSize: "전개도", sheetSize: "판형", qtyShort: "수량",
  hintStart: "「자동 배치」를 누르면 이 판에 몇 개가 앉는지 계산합니다.",
  hintHand: "칼선을 끌어 옮기세요. 이웃에 닿으면 자동으로 딱 붙습니다.",
  working: "배치를 찾는 중…",
  blocked: "그 자리는 겹칩니다 — 놓지 않았습니다",
  noFit: "이 판에는 한 장도 들어가지 않습니다 — 판형을 바꿔 보세요",
  noRoom: "판에 빈자리가 없습니다",
  needDraw: "먼저 도면을 넣거나 치수를 입력하세요",
  addedN: n => `빈자리에 ${n}장 더 앉혔습니다`,
  addedNone: "더 들어갈 자리가 없습니다",
  gain: (g, f) => `격자 배치 ${g}up → 자유 배치 ${f}up`,
  cappedNote: (a, b, c, d) => `원지 ${a}×${b} 를 인쇄기 최대 ${c}×${d} 로 재단해서 겁니다`,
  overlapRefused: "겹치는 배치가 나와 버렸습니다 (그리지 않습니다)",
  budget: "탐색 예산에 도달했습니다 — 더 나은 배치가 있을 수 있습니다",
  specLine: "표준 사양 · AB 350g · 원색 4도 · IR 코팅 · 단면접착 (개당단가는 개발비 제외)",
  pExact: "칼선 폴리곤 그대로 (근사 없음)",
  pStitched: "PDF 칼선 그대로 (근사 없음)",
  pRaster: "PDF 칼선을 격자 윤곽으로 근사 — 실물 칼선이 전부 이 도형 안에 있어 겹치지 않습니다",
  pHull: "PDF 칼선이 닫히지 않아 볼록껍질로 근사 — 안전한 쪽(오목한 틈은 파고들지 않습니다)",
  pBbox: "PDF 칼선을 사각형으로 근사 — 맞물림 없이 칼선 공유만 합니다",
};
const JA = {
  title: "面付け・単価シミュレーター", back: "見積アプリへ",
  draw: "図面", pdf: "カットラインPDF", dims: "寸法入力",
  drop: "カットラインPDF をここにドロップ", pick: "ファイル選択", reading: "読み込み中…",
  page: "ページ", cand: "形状の候補", struct: "形式",
  w: "幅 W", d: "奥行 D", h: "高さ H", mm: "mm",
  sheet: "シート", auto: "自動", qty: "数量", ea: "個",
  btnAuto: "自動面付け", btnHand: "手動で配置", btnHandOff: "配置を終える", btnReset: "リセット",
  add: "+ 1枚", rot: "90°", flip: "180°", del: "削除", fill: "空きに追加", undo: "元に戻す",
  up: "面付", perEA: "1個あたり", won: "ウォン",
  netSize: "展開図", sheetSize: "シート", qtyShort: "数量",
  hintStart: "「自動面付け」を押すと、このシートに何個入るかを計算します。",
  hintHand: "カットラインをドラッグしてください。隣に触れると自動で吸着します。",
  working: "配置を探しています…",
  blocked: "そこは重なります — 配置しませんでした",
  noFit: "このシートには1枚も入りません — シートを変えてください",
  noRoom: "シートに空きがありません",
  needDraw: "先に図面か寸法を入力してください",
  addedN: n => `空きに ${n} 枚追加しました`,
  addedNone: "これ以上入る場所がありません",
  gain: (g, f) => `格子配置 ${g} → 自由配置 ${f}`,
  cappedNote: (a, b, c, d) => `原紙 ${a}×${b} を印刷機の最大 ${c}×${d} に断裁して掛けます`,
  overlapRefused: "重なった配置が出たため描画しません",
  budget: "探索の上限に達しました — さらに良い配置がある可能性があります",
  specLine: "標準仕様・AB 350g・プロセス4色・IRコート・片面貼り（単価に開発費は含みません）",
  pExact: "カットライン多角形そのまま（近似なし）",
  pStitched: "PDFカットラインそのまま（近似なし）",
  pRaster: "PDFカットラインをグリッド輪郭で近似 — 実物の線がすべて内側にあり重なりません",
  pHull: "PDFカットラインが閉じないため凸包で近似 — 安全側（凹部には入り込みません）",
  pBbox: "PDFカットラインを矩形で近似 — かみ合わせなし、突き合わせのみ",
};
export const T = lang => (lang === "ja" ? JA : KO);
export const LANGS = [["ko", "한국어"], ["ja", "日本語"]];

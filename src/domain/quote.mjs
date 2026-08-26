// ══════════════════════════════════════════════════════════════════
//  quote.mjs — 견적 1건 조립. 도메인의 단일 진입점.
//
//  단계는 딱 3개다. 미들웨어 체인·플러그인 라이프사이클·훅 시스템은 없다.
//    buildContext(input) → collectLines(ctx) → summarize(ctx, lines, devLines)
//
//  출력 순서: 공정합계 → 개발비 → 개당단가 → 총공급가액 → 부가세
//    개당단가 = round(공정합계 / 수량)   ← floor 아님
//    검증: 맞뚜껑A 30,000ea 2,335,185/30,000 = 77.84 → 78 ✓ (floor면 77 ✗)
//          삼면B 3,000ea 1,775,894/3,000 = 591.96 → 592 ✓
//    지대 공급가액 = round(지대R × 지대단가)  ✓ 견적서 전건 일치
// ══════════════════════════════════════════════════════════════════
import { dielinePieces, pickDieOpt } from "./dieline/index.mjs";
import {
  BASE_SHEETS, sheetsPerR, sheetTier, effectiveSheet, resolveSheet, findSheetBase,
} from "./data/sheets.mjs";
import { PAPERS, DEFAULT_PAPER } from "./data/papers.mjs";
import {
  printUnitFor, SPOT_RPR_BEDA, SPOT_RPR_PLAIN, sideColors,
} from "./data/print-prices.mjs";
import { coatById, glueById, thomsonById } from "./data/process-prices.mjs";
import { calcR, calcProcessR, estimateLoss, lossOptionsOf } from "./reams.mjs";
import { getPaperPriceInfo, getPaperPrice } from "./paper-repo.mjs";
import { solveImposition } from "./imposition.mjs";
import { findBestSheet } from "./sheet-select.mjs";
import { collectLines, collectDevLines, collectFlags } from "./process/index.mjs";

/**
 * @typedef {Object} PrintSide  {color:boolean, spot:number, black:boolean, uv:boolean}
 * @typedef {Object} QuoteInput
 *  @property {number} qty
 *  @property {{mode:"box"|"net", W:number,D:number,H:number, structure:string,
 *              hangTab:number, netW?:number, netH?:number,
 *              dieOpt?:Object}} box
 *    dieOpt = 목형별 구조 옵션(glue3 deepFlap · cross glueTabW). 없으면 구조 기본값.
 *  @property {{paperId:string, sheetId:"auto"|string, custom:?{w,h,cut}}} paper
 *  @property {{front:PrintSide, back:PrintSide, beda:boolean, spotMode:"weight"|"rpr"}} print
 *  @property {{coatFrontId:string, coatBackId:string, thomsonId:string, glueId:string,
 *              foil:?{type,sides,rpr}, emb:?{rpr}, puv:?{sides}}} finish
 *  @property {Object} [overrides]  전부 optional. 비면 자동계산
 *    up, reams(지대R), lossSheets, paperPricePerR, printUnit, spotRpr, sobooUnit, admin,
 *    rprById:{[lineId]:number}, lotById:{[lineId]:number}, glueEa
 *  @property {Object} [dev]  newDie,dieQty,diePrice,filmCost,embDevPrice,embFilmPrice,
 *                            foilDevPrice,foilFilmPrice
 */

const ZERO_SIDE = { color: false, spot: 0, black: false, uv: false };
const normSide = sd => ({ ...ZERO_SIDE, ...(sd || {}) });

const emptyResult = (netSize, dieline, warnings) => ({
  netSize, dieline, sheet: null, layout: null,
  reams: null, paperPrice: null, print: null,
  lines: null, devLines: null, totals: null, flags: {}, warnings,
});

/**
 * 판형 결정 — 3분기.
 *   ① 판걸이(up) 직접 입력 : 목형이 이미 정해진 건. 배치 계산을 우회한다.
 *   ② R수 직접 입력       : 판형은 고정, up 은 자동, R 만 사용자 값.
 *   ③ 자동/판형 고정      : findBestSheet
 * ①② 에서 판형이 "auto" 면 BASE_SHEETS[3](4×64) 로 떨어진다 — 종전 동작 유지.
 */
function decideSheet({ dieline, qty, paperId, sheetId, customSheet, manualPrice, lossOpts, ov }) {
  const hangTab = dieline.net.hangTab || 0;
  const fixedBase = () => findSheetBase(sheetId) || BASE_SHEETS[3];

  // 수율(utilPct)은 여기서 계산하지 않는다 — 정본은 layout.utilPct 하나다.
  // 종전에는 이 두 분기와 compareSheets 가 각자 계산했고 분모가 두 종류(인쇄기
  // 클램프 면적 / 원지 생면적)라 같은 화면에서 53% 와 44% 가 동시에 보였다.
  if (ov.up > 0) {
    const base = fixedBase();
    const sh = resolveSheet(base, customSheet);
    const R = ov.reams != null ? ov.reams : calcR(ov.up, qty, sh, lossOpts);
    return { ...sh, id: base.id, up: ov.up, R, manualUp: true,
             sheetsPerR: sheetsPerR(sh), tier: sheetTier(sh),
             price: getPaperPrice(paperId, base.id, manualPrice, customSheet) };
  }
  if (ov.reams != null) {
    const base = fixedBase();
    const sh = resolveSheet(base, customSheet);
    const up = solveImposition({ dieline, sheet: sh, hangTab })?.up || 0;
    return { ...sh, id: base.id, up, R: ov.reams,
             sheetsPerR: sheetsPerR(sh), tier: sheetTier(sh),
             price: getPaperPrice(paperId, base.id, manualPrice, customSheet) };
  }
  return findBestSheet({ dieline, qty, sheetIdHint: sheetId === "auto" ? "auto" : sheetId,
                         paperId, manualPrice, lossOpts, customSheet });
}

/**
 * 수량 정규화 — **음수는 0 으로 접는다**(= 「견적 없음」).
 *
 * ⚠ 26-08-25 실측 구멍: qty=-100 이 견적을 **냈다**. 4up · 지대R 0.275 · 개당 0원.
 *   qty=0 · W=0 · H="abc" 는 전부 정상적으로 접히는데 음수 분기만 빠져나갔다
 *   (`input.qty || 0` 은 음수를 참으로 읽는다). 방향이 「가장 싼 쪽(0원)」이고
 *   경고도 없어서 안전방향 표의 「싸게 부른다」 칸에 그대로 들어간다.
 *   여기 한 곳에서 접는 이유 — buildContext·compareSheets 두 진입점이 각자
 *   `input.qty || 0` 을 복제하고 있었다. 한쪽만 고치면 판형 비교표가 조용히 갈린다.
 */
export const normQty = input => {
  const q = Math.trunc(Number(input?.qty));
  return Number.isFinite(q) && q > 0 ? q : 0;
};

/** 전개도(치수 + 폴리곤). 규격이 덜 채워졌으면 null */
export function buildDieline(box) {
  const b = box || {};
  const structure = b.mode === "net" ? "direct" : (b.structure || "tuck_both");
  const W = b.W || 0, D = b.D || 0, H = b.H || 0;
  if (b.mode !== "net" && !(W && D && H)) return null;
  // ★ 목형별 구조 옵션 — 그 구조가 실제로 읽는 노브만 걸러 받는다(pickDieOpt).
  //   걸러 받는 이유는 캐시 키다: 십자 노브가 삼면접착 전개도의 키에 섞이면 값을
  //   만질 때마다 같은 폴리곤이 캐시를 새로 잡는다(무해하지만 조용한 낭비), 반대로
  //   안 섞으면 **키가 폴리곤을 결정하는 입력 전부**라는 아래 계약이 깨진다.
  const dieOpt = pickDieOpt(structure, b.dieOpt || {});
  const dl = dielinePieces(W, D, H, structure, {
    hangTab: b.hangTab || 0, netW: b.netW || 0, netH: b.netH || 0, ...dieOpt,
  });
  if (!dl) return null;
  // ⚠ 목형 옵션은 **반드시 키에 들어간다.** 폴리곤을 바꾸는데 키에 없으면 판걸이
  //   캐시(imposition ck)가 옛 배치를 돌려준다 — 화면 표시 없이 up 만 틀리는 사고이고
  //   §5 「판걸이 캐시 키에 custom 을 넣었다」가 경고한 것과 정확히 같은 종류다.
  const optKey = Object.keys(dieOpt).sort().map(k => `${k}=${dieOpt[k]}`).join(",");
  return {
    ...dl,
    dieOpt,
    // 캐시 키 — 폴리곤을 결정하는 입력 전부. hangTab 은 폴리곤을 바꾸지 않으므로
    // solveImposition 쪽 키에만 들어간다.
    key: `${structure}|${W}|${D}|${H}|${b.netW || 0}|${b.netH || 0}|${optKey}`,
    structure,
    polygon: !!dl.flaps,
    noRotate: !!dl.net.noRotate,
  };
}

/**
 * 입력 정규화 — buildContext 와 compareSheets 가 **공유**한다.
 *
 * 종전에는 compareSheets 가 이 7줄(normSide / lossOptionsOf 인자 / paperCfg·
 * customSheet·manualPrice·hangTab)을 복제했다. 결과는 같았지만 여분 정책 인자가
 * 하나 늘면 판형별 비교표만 조용히 옛 정책으로 남는 구조다.
 * 리팩토링 전 App.jsx 에서 lossOptsOf/computeForQty 두 사본으로 똑같은 사고가
 * 있었고 reams.mjs:89 주석이 그 이력을 적어놨다 — 같은 실수를 반복하지 않는다.
 * @returns {{ov,dieline,front,back,beda,finish,lossOpts,paperCfg,customSheet,manualPrice,hangTab}|null}
 */
export function normalizeQuoteInput(input) {
  const dieline = buildDieline(input.box);
  if (!dieline) return null;
  const ov = input.overrides || {};
  const pin = input.print || {};
  const front = normSide(pin.front), back = normSide(pin.back);
  const beda = !!pin.beda;
  const finish = input.finish || {};
  const paperCfg = input.paper || {};
  return {
    ov, dieline, front, back, beda, finish, paperCfg,
    lossOpts: lossOptionsOf({ front, back, beda }, { hasEmb: !!finish.emb }, ov.lossSheets),
    customSheet: paperCfg.custom || null,
    manualPrice: ov.paperPricePerR || "",
    hangTab: dieline.net.hangTab || 0,
  };
}

/** @returns {Object|null} ctx (얕은 freeze). 판형까지 못 정하면 null */
export function buildContext(input) {
  const norm = normalizeQuoteInput(input);
  if (!norm) return null;
  const { ov, dieline, front, back, beda, finish,
          paperCfg, lossOpts, customSheet, manualPrice } = norm;
  const netSize = dieline.net;

  const sheet = decideSheet({
    dieline, qty: normQty(input),
    paperId: paperCfg.paperId, sheetId: paperCfg.sheetId || "auto",
    customSheet, manualPrice, lossOpts, ov,
  });
  // 실패해도 **무엇을 고르려 했는지**는 들고 나간다 — 화면이 이유를 말할 수 있게
  // (아래 noFitReason). 종전에는 이 자리에서 판형 요청이 통째로 사라졌다.
  if (!sheet) return { dieline, netSize, sheet: null, wantSheetId: paperCfg.sheetId || "auto" };

  const layout = solveImposition({ dieline, sheet, hangTab: norm.hangTab });

  // ─── 지대 R수 · 여분 ───────────────────────────────────────────
  const qty = normQty(input);
  const net = sheet.up > 0 ? Math.ceil(qty / sheet.up) : 0;
  const R = sheet.R;
  const processR = calcProcessR(sheet.up, qty);
  const tier = sheet.tier || sheetTier(sheet);

  // != null 이 곧 "단가 직접입력 모드" 다. 빈칸으로 켜두면 0원이 나오는 것도
  // 종전 동작 그대로다 — 사용자가 입력할 때까지 표에 0 이 보이는 게 의도된 신호다.
  const paperInfo = ov.paperPricePerR != null
    ? { price: ov.paperPricePerR || 0, confirmed: true, manual: true }
    : getPaperPriceInfo(paperCfg.paperId, sheet.id, "",
                        sheet.custom ? { w: sheet.w, h: sheet.h, cut: sheet.cut } : null);

  // ─── 인쇄 도수 파생 ────────────────────────────────────────────
  const fColors = sideColors(front), bColors = sideColors(back);
  const fHasInk = fColors > 0 || front.uv;
  const bHasInk = bColors > 0 || back.uv;

  const ctx = {
    input, ov, qty, dieline, netSize, sheet, layout, tier,
    paper: PAPERS.find(p => p.id === paperCfg.paperId) || DEFAULT_PAPER,
    reams: { net, R, processR, loss: estimateLoss(net, lossOpts), lossOpts,
             isLot: net > 0 && net < 1000 },   // 1식(최소) 구간
    paperPrice: { ...paperInfo, pricePerR: paperInfo.price,
                  amount: Math.round(R * paperInfo.price) },
    print: {
      front, back, beda,
      // ── 베다는 R당 고정 모드를 강제한다 ─────────────────────────────
      // 종전에는 베다가 두 곳에 걸렸는데 하나가 조건부였다:
      //   · 여분 +100장 (reams.LOSS_BEDA)          → 항상 적용
      //   · 별색 R단가 50,000 → 75,000 (SPOT_RPR)  → spotMode==="rpr" 에서만
      // 기본 모드가 "weight"(도수환산 ×3) 이라, 기본값으로 쓰면 **베다를 켜도
      // 인쇄비는 그대로이고 종이(여분)만 올랐다.** 실무가 정확히 이걸 지적했다.
      //
      // 실측 근거: 견적서의 베다는 R당 고정으로 청구된다.
      //   verify-total 「G형A 350×280×70 (별1베다+먹)」
      //     인쇄비 150,000 = round(2.0R × 75,000)  — 원 단위 일치
      //   verify-r E67a/E67b G형C {beda:true} — 여분 가산 근거 2건
      // 도수환산 + 베다 조합으로 청구된 견적서는 **한 건도 없다.** 그래서
      // 도수환산 모드에 베다 배수(예 ×1.5)를 넣는 쪽은 근거가 없어 택하지 않았다.
      // 근거 없는 상수는 다음 사람이 지운다 — 이 프로젝트의 규칙이다.
      //
      // ⚠ 사용자가 도수환산을 골라도 베다면 뒤집힌다. UI 가 그 사실을 표시해야 한다
      //   (PrintPanel 의 베다 토글 옆 안내문). 조용히 뒤집으면 안 된다.
      spotMode: beda ? "rpr" : (input.print?.spotMode || "weight"),
      spotModeForcedByBeda: beda && (input.print?.spotMode || "weight") !== "rpr",
      spotRpr: ov.spotRpr || (beda ? SPOT_RPR_BEDA : SPOT_RPR_PLAIN),
      printUnit: ov.printUnit ?? printUnitFor(tier),
      fColors, bColors, totalColors: fColors + bColors,
      fHasInk, bHasInk, bothSides: fHasInk && bHasInk,   // 양면인쇄 → 여분 +100장
    },
    opts: {
      coatFront: coatById(finish.coatFrontId),
      coatBack:  coatById(finish.coatBackId),
      thomson:   thomsonById(finish.thomsonId),
      glue:      glueById(finish.glueId),
    },
    // finish 는 **통과시킨다**. 화이트리스트로 재조립하면 새 공정이 자기 입력을
    // 읽을 통로가 원천 차단된다 — 종전에는 {foil,emb,puv} 세 키만 남겨서
    // finish.holo 같은 새 키가 ctx 에서 사라졌고(input.finish 에만 살아 있었다),
    // 「공정 추가 = 파일 1개 + 배열 1줄」 이 사실이 아니게 되는 지점이었다.
    // null 정규화만 얹는다 — 공정들이 `ctx.finish.foil &&` 로 읽기 때문.
    finish: { ...finish, foil: finish.foil || null, emb: finish.emb || null,
              puv: finish.puv || null },
    dev: input.dev || {},
  };
  // 얕은 freeze — 공정이 공유 상태를 몰래 고치면 라인 순서에 따라 결과가 달라지는
  // 최악의 버그가 생기고 스냅샷으로도 안 잡힌다. 깊은 freeze 는 성능만 먹는다.
  return Object.freeze(ctx);
}

export function summarize(ctx, lines, devLines) {
  const process = lines.reduce((a, l) => a + (l.amount || 0), 0);
  const dev     = devLines.reduce((a, l) => a + (l.amount || 0), 0);
  const grand   = process + dev;
  return { process, dev, grand,
           perEA: ctx.qty > 0 ? Math.round(process / ctx.qty) : 0,
           vat: Math.round(grand * 0.1) };
}

/**
 * 「판형이 없다」를 **이유까지** 말한다 (26-08-19 신설).
 *
 * ⚠ 종전 문구는 「이 전개도가 들어가는 판형이 없습니다」 한 줄이었다. 화면에 그 말만
 *   뜨는데, 정작 쓸모 있는 정보는 **몇 mm 가 모자라는가**다. 실측으로 밟았다:
 *   십자 190×100×109.5 를 하4(444×597)에 고정하면 netW 603.33 이 597 을 6.33mm 넘겨
 *   견적 6건(1,000/4,000/10,000 × 지종 2)이 통째로 사라지는데 화면은 침묵했다.
 *   그 6.33 의 출처는 CROSS_TAB 안전봉투 14.3 → 23.33 이다(cross.mjs). 실측 목형
 *   (다빈기획)의 탭은 14.00 이라 **그 목형은 실제로 하4 에 들어간다** — 봉투가 5벌
 *   최대치(니치어 23.33)라서 안 들어가는 것이다. 봉투를 낮추는 것은 니치어에서
 *   1,269mm² 실물 겹침을 되살리는 일이라 하지 않는다. 대신 **화면이 이유를 말한다.**
 *   ⟹ 사용자의 조치는 둘: 판형을 「자동」으로 두거나(십자 190×100×109.5 는 국2 3up 으로
 *      정상 산출된다) 「판걸이(up) 직접 입력」으로 목형 실측값을 넣는 것이다.
 */
function noFitReason(ctx) {
  const n = ctx.netSize;
  const dim = n ? `전개도 ${n.netW.toFixed(1)}×${n.netH.toFixed(1)}mm` : "전개도";
  const sb = ctx.wantSheetId && ctx.wantSheetId !== "auto" ? findSheetBase(ctx.wantSheetId) : null;
  if (!sb || !n)
    return `${dim} 가 들어가는 판형이 없습니다 — 표준 판형 전부에서 배치에 실패했습니다`;
  // 두 자세 각각의 초과분. 둘 중 작은 쪽이 「가장 아쉬운 만큼」이다.
  const over = Math.min(Math.max(n.netW - sb.w, n.netH - sb.h),
                        Math.max(n.netW - sb.h, n.netH - sb.w));
  // 라벨이 이미 「하4   (444×597)」처럼 치수를 품고 있다 — 여기서 또 붙이면 두 번 말한다.
  const where = (sb.label || `${sb.id} (${sb.w}×${sb.h})`).replace(/\s+/g, " ").trim();
  return over > 0
    ? `${dim} 가 ${where} 를 ${over.toFixed(1)}mm 넘습니다 — 판형을 「자동」으로 바꾸거나 ` +
      `판걸이(up)를 직접 입력하세요`
    : `${dim} 는 ${where} 에 들어가지만 배치가 성립하지 않습니다 ` +
      `(인쇄기 상한 990×720 · 발자국 상한) — 판형을 「자동」으로 바꿔 보세요`;
}

/**
 * @returns {Object} QuoteResult — **null 을 반환하지 않는다.**
 *   입력이 불충분해도 객체를 돌려주고 warnings 로 이유를 알린다.
 *   종전에는 호출부가 try/catch 로 예외를 통째로 삼켜 잘못된 입력과 버그를
 *   구분할 수 없었다. netSize:null(규격 미입력) / sheet:null(배치 불가) /
 *   lines:null(계산 불가) 는 각각 독립적으로 가능한 상태다.
 */
export function buildQuote(input) {
  const ctx = buildContext(input);
  if (!ctx) return emptyResult(null, null, ["규격이 덜 입력됐습니다 (W·D·H 또는 전개도 크기)"]);
  if (!ctx.sheet)
    return emptyResult(ctx.netSize, ctx.dieline, [noFitReason(ctx)]);

  const lines = collectLines(ctx);
  const devLines = collectDevLines(ctx);
  return {
    netSize: ctx.netSize, dieline: ctx.dieline, sheet: ctx.sheet, layout: ctx.layout,
    reams: ctx.reams, paperPrice: ctx.paperPrice, print: ctx.print,
    paper: ctx.paper, opts: ctx.opts,
    // 경고 플래그도 공정이 소유한다(coating 이 irWarning 을 낸다). quote 는 병합만 —
    // 종전에는 quote 가 `finish.coatFrontId === "ir"` 을 직접 알아야 했다.
    flags: collectFlags(ctx),
    lines, devLines, totals: summarize(ctx, lines, devLines),
    warnings: [],
  };
}

/** 수량 비교표 — 수량마다 판형이 다시 뽑힌다. ctx 를 재사용하면 안 된다.
 *  판걸이는 수량과 무관하므로 imposition 캐시가 재계산을 흡수한다. */
export const buildQuoteRange = (input, qtys) => qtys.map(q => buildQuote({ ...input, qty: q }));

/** 판형별 비교표 → {rows, bestId}. 입력 정규화는 buildContext 와 **같은 함수**를 쓴다 */
export function compareSheets(input) {
  const norm = normalizeQuoteInput(input);
  const qty = normQty(input);
  if (!norm || !qty) return { rows: [], bestId: null };
  const { dieline, paperCfg, lossOpts, customSheet, manualPrice, hangTab } = norm;

  const best = findBestSheet({ dieline, qty, sheetIdHint: "auto",
                               paperId: paperCfg.paperId, manualPrice, lossOpts, customSheet });

  const rows = BASE_SHEETS.map(base => {
    const sh = resolveSheet(base, customSheet);
    if (!sh.w || !sh.h) return null;
    const layout = solveImposition({ dieline, sheet: sh, hangTab });
    if (!layout || layout.up === 0) return null;
    const R = calcR(layout.up, qty, sh, lossOpts);
    const price = getPaperPrice(paperCfg.paperId, base.id, manualPrice, customSheet);
    return {
      id: base.id, label: sh.label, sheet: sh, layout, up: layout.up,
      utilPct: layout.utilPct,       // 정본 하나 — 여기서 다시 계산하지 않는다
      R, price, cost: Math.round(R * price), sheetsPerR: sheetsPerR(sh),
    };
  }).filter(Boolean);

  return { rows, bestId: best?.id ?? null };
}

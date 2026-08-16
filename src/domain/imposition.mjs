// ══════════════════════════════════════════════════════════════════
//  imposition.mjs — 판걸이(배치) 어댑터
//
//  nest.mjs(격자) 와 nest-free.mjs(자유배치) 를 부르는 **유일한** 지점이다.
//  다른 곳에서 solveLayout / solveFree 를 직접 import 하면 아래 3대 정책
//  (인쇄기 클램프·발자국 상한·행거탭)이 적용되지 않은 up 이 견적에 들어간다.
// ══════════════════════════════════════════════════════════════════
import { effectiveSheet, FIT_TOL, MAX_FOOT_PCT } from "./data/sheets.mjs";
import { solveLayout, itemW, itemH } from "../nest.mjs";
import { solveFree } from "../nest-free.mjs";

/** clearance 는 nest 기본값 0.5 그대로 — scorecard 표들과 같은 조건이어야 A/B 가 의미를 갖는다 */
const CLEARANCE = 0.5;

/**
 * 배치 엔진 — 호출자가 **명시적으로** 고른다.
 *
 *  grid  규칙격자(nest.solveLayout). (dx,dy,sx,반전규칙) 5개가 배치 전체를 정한다.
 *        **기본값이고 기준선이다** — 목형은 규칙적이어야 톰슨이 서고, 견적서 78건 역산과
 *        verify-net·scorecard-nest 의 재현율이 전부 이 엔진 위에서 교정됐다.
 *  free  자유배치(nest-free.solveFree). 한 장씩 앉히므로 자리마다 자세가 다를 수 있고
 *        남는 틈에 **한 장만** 더 넣을 수 있다. 규칙성을 잃는다(사람이 확인해야 한다).
 *
 * ⚠ 기본을 free 로 바꾸지 마라. 재현율 기준선이 격자이고, 자유배치는 최적해를
 *   보장하지 않는다(nest-free.mjs 「한계」). 견적으로 흘리려면 사람이 손배치로
 *   받아 확정하는 통로(overrides.up = state 의 mUp/mUpV)를 지나야 한다.
 */
export const LAYOUT_ENGINE = { GRID: "grid", FREE: "free" };
export const DEFAULT_ENGINE = LAYOUT_ENGINE.GRID;

/** 자유배치 한 판에 앉힐 최대 개수 — 판이 크고 도형이 아주 작을 때 폭주를 막는다.
 *  nest-free.DEFAULT_MAX_UP 과 같은 값이지만 **정책은 여기 것이 정본**이다. */
const FREE_MAX_UP = 200;

/**
 * 판형 ∩ 인쇄기 상한(990×720) → 실제 인쇄 가능 영역.
 *
 * ── 물림(gripper) — 「표준=원지 / 사용자입력=재단」 분기를 시도했고 반증됐다 ──
 * (2026-08-07 조사. 이 절을 읽었으면 같은 조사를 다시 하지 마라.)
 *
 * 물림 자체는 실재한다 — 코리팩 산출식 엑셀 「종이 규격」 vs 「제작 규격(여분제외)」
 * 차이가 짧은변 −30 / 긴변 −20 이다(sheets.mjs BITE_SHORT/BITE_LONG 에 근거 보존).
 * 쟁점은 물림의 존재가 아니라 **이 함수에 들어오는 숫자가 물림 이전(원지)인지
 * 이후(재단)인지**다. 「표준 판형은 원지니까 차감하고, 사용자가 직접 준 크기
 * (주문생산 custom)는 이미 재단됐으니 차감하지 않는다」는 갈래를 실제로 구현해
 * 6개 스위트를 돌렸다. 결과는 **차감하지 않는 현행이 옳다**는 것이다.
 *
 * ① 결정적 근거 — 「단위」와 BASE_SHEETS 절지는 **같은 숫자**다.
 *    견적서 「단위」열이 재단 크기라는 것은 확정 사실이다. 그 12건을 BASE_SHEETS 와
 *    대조하면 **8건이 완전 동일**하다(국2 636×469 · 4×62 788×545 · 하4 444×597 ·
 *    4×64 394×545). 나머지 4건(760×480 · 980×720 · 480×788)은 전지·2절급 주문재단이다.
 *    → 재단 크기와 숫자가 같으므로 BASE_SHEETS 절지도 재단 크기다. 표준이라는
 *      이유로 여기서 30/20 을 빼는 것은 정의상 이중 차감이다.
 *
 * ② 실측 A/B (2026-08-07 · 6개 스위트 전부 직접 실행)
 *      측정                             미차감(채택)  표준 전부 차감  전지급만 차감
 *      verify-net 판걸이 up              7/10          3/10 EXIT=1    7/10
 *      verify-net 비폴리곤 구조 up       6/6           5/6            6/6
 *      scorecard-nest up                 7/10          3/10           7/10
 *      scorecard-nest 지대금액 평균오차  14.4%         36.3%          14.4%
 *      scorecard2 / scorecard-unit §A    10/15 · 7/12  변화 없음      변화 없음
 *      verify-total / verify-r           24/26 · 37/39 변화 없음      변화 없음
 *    · 위 「표준 전부 차감」은 물림에 **가장 유리한** 구현이다 — printW/printH 만 줄이고
 *      발자국 분모(long/short)는 그대로 뒀다. 분모까지 줄이면 MAX_FOOT_PCT 가 같이
 *      세져서 3/10 → **1/10**, 지대오차 36.3% → **48.9%** 가 된다(둘 다 실행 확인.
 *      ARCHITECTURE.md §5 표의 1/10 · 48.9% 가 이 분모까지 줄인 쪽 숫자다).
 *      유리하게 구현해도 무너진다는 것이 요점이다.
 *    · 「표준 전부 차감」이 깨뜨린 4건은 **전부 ① 의 8건에 속한다**:
 *      맞뚜껑A 국2 6→4 · 삼면A 하4 2→1 · 삼면C 4×64 4→2 · 십자B 하4 4→3.
 *      즉 이중 차감이 일어난 판형에서만 정확히 무너졌다 — 우연이 아니다.
 *    · 「전지급(cut=1)만 차감」은 **점수가 하나도 움직이지 않는다.** 바뀌는 것은
 *      삼면B 46전지의 배치 모양뿐이고(칼선공유 → 맞물림 ↕18mm) up 은 2 그대로다.
 *      득도 실도 없는 분기는 넣지 않는다 — 근거 없는 분기는 다음 사람이 지운다.
 *    · verify-total·verify-r 이 불변인 이유는 그 두 스위트가 overrides.up 으로
 *      판걸이를 고정하기 때문이다(verify-total.mjs:7 분업 주석). 물림 방침의
 *      회귀를 **잡지 못한다** — 여기서 24/26 이 유지된 것을 안전 신호로 읽지 마라.
 *
 * ③ 그럼 「원지에서 시작하면 물림이 실재한다」는 관찰은 어떻게 되나 — 그것도 참이다.
 *    iSHAP 대지(무제-3.pdf, page 788×545)의 배치 외곽 726.0×413.8 은 물림을 충족한다.
 *    하지만 그것은 **원지 크기가 입력으로 들어오는 경우**의 이야기고, 이 함수의 입력에
 *    그런 값은 없다(전지급조차 effectiveSheet 가 990×720 으로 클램프해 재단 크기가 된다).
 *    물림을 살리려면 BASE_SHEETS 를 원지 규격으로 재정의하고 견적서 78건을 다시
 *    역산하는 것이 먼저다 — 판형 숫자를 그대로 둔 채 이 함수만 고치는 길은 ①② 로 닫혔다.
 *
 * ④ 재현 방법(2줄): printW/printH 를 `(es.long - BITE_LONG)` · `(es.short - BITE_SHORT)`
 *    로 바꾸고 verify-net·scorecard-nest 를 돌려라. 위 ② 열이 그대로 나온다.
 *    ⚠ long/short 는 절대 줄이지 마라 — footPct·utilPct 의 분모이고 MAX_FOOT_PCT=92 가
 *      그 분모로 교정된 값이다. 물림은 printW/printH 에만 걸린다.
 *
 * ※ 사용자가 직접 준 크기(주문생산 custom)도 결론이 같은 「미차감」이라, 갈래가 코드에
 *   분기로 남아 있지 않다. 그래도 **캐시 키에는 custom 이 들어 있다**(solveImposition ck)
 *   — 언젠가 갈래가 갈리는 순간 같은 w×h 의 표준/주문생산이 서로의 배치를 돌려받는
 *   사고를 막는 예방선이다. 지우지 마라.
 */
export function printableArea(sheet) {
  const es = effectiveSheet(sheet.w, sheet.h);
  return {
    long: es.long, short: es.short, capped: es.capped,
    printW: es.long  * (1 + FIT_TOL),
    printH: es.short * (1 + FIT_TOL),
  };
}

/**
 * 직사각 배치 — 폴리곤이 확정되지 않은 구조(G형·전개도 직접입력) 전용.
 * 직사각형은 맞물림이 물리적으로 불가능하므로 nest 와 결과가 같고,
 * 대신 **회전 금지**를 표현할 수 있다(nest 에는 회전 금지 옵션이 없다).
 */
function solveRect(netW, netH, printW, printH, HT, allowRotate) {
  const out = [];
  const push = (w, h, pw, ph, rotated) => {
    const c = Math.floor(pw / w), r = Math.floor(ph / h);
    if (c > 0 && r > 0)
      out.push({ up: c * r, cols: c, rows: r, dx: w, dy: h, sx: 0, rotated,
                 netW: w, netH: h, interlocked: false, overlapX: 0, overlapY: 0,
                 bbox: { w: c * w, h: r * h },
                 cells: Array.from({ length: c * r }, (_, k) => {
                   const i = k % c, j = Math.floor(k / c);
                   return { i, j, x: i * w, y: j * h, flip: false };
                 }) });
  };
  // HT(행거탭)는 netH 축에만 1회 붙는다 → 회전하면 x 축으로 넘어간다
  push(netW, netH, printW, printH - HT, false);
  if (allowRotate) push(netH, netW, printW - HT, printH, true);
  out.sort((a, b) => b.up - a.up);
  return out;
}

/** nest 결과를 solveRect 와 같은 모양으로 정규화 */
const normalizeNest = r => r && ({
  up: r.up, cols: r.cols, rows: r.rows, dx: r.dx, dy: r.dy, sx: r.sx,
  rotated: r.rotated, netW: r.netW, netH: r.netH,
  interlocked: r.interlocked, overlapX: r.overlapX, overlapY: r.overlapY,
  bbox: r.bbox, cells: r.cells, flipRule: r.flipRule,
});

/**
 * nest 엔진 호출. 회전을 nest 가 내부에서 정하므로 행거탭 축을 지정할 방법이 없다
 * → 축별로 나눠 부른 뒤 rotated 로 걸러낸다.
 *   (종전 레거시 후보 ①③ = printH−HT, ②④ = printW−HT 와 정확히 같은 의미다)
 * HT === 0 이면 두 호출이 동일하므로 한 번만 부른다 (1회 20~60ms — 낭비 금지).
 */
function solveNest(pieces, printW, printH, HT, extra) {
  const call = (pw, ph) => (pw > 0 && ph > 0)
    ? normalizeNest(solveLayout(pieces, pw, ph, { clearance: CLEARANCE, ...extra }))
    : null;
  if (HT <= 0) {
    const r = call(printW, printH);
    return r ? [r] : [];
  }
  const A = call(printW, printH - HT);        // 채택 조건 !A.rotated
  const B = call(printW - HT, printH);        // 채택 조건  B.rotated
  const ok = [];
  if (A && !A.rotated) ok.push(A);
  if (B && B.rotated)  ok.push(B);
  if (!ok.length) {
    // 두 호출 모두 HT 를 반대 축에 둔 방향을 골랐다 — 양축에서 빼는 보수적 해로 간다.
    // (여기서 A/B 를 그냥 쓰면 행거탭 자리를 침범한 배치가 된다)
    const C = call(printW - HT, printH - HT);
    if (C) ok.push(C);
  }
  ok.sort((a, b) => b.up - a.up);
  return ok;
}

/**
 * 자유배치 1회. 격자와 **같은 인쇄영역**에서 돌아야 두 숫자를 나란히 놓을 수 있다.
 *
 * 행거탭(HT): 격자는 배치 전체가 rotated 한 값이라 「탭이 나가는 축」을 고를 수 있고
 *   그래서 solveNest 가 축별로 나눠 부른다. 자유배치는 **자리마다 자세가 다를 수 있어**
 *   배치 하나에 축이 하나로 정해지지 않는다 → 양축에서 뺀다. 이것은 solveNest 가
 *   두 축 다 실패했을 때 쓰는 보수적 분기(C)와 같은 뜻이고, 탭 자리를 침범하지 않는
 *   유일한 선택이다. HT=0 이면 격자와 완전히 같은 판이다(실무 대부분).
 *   ⚠ 그래서 HT>0 에서는 자유 up 이 격자보다 **작을 수 있다.** 버그가 아니라 판이
 *     좁아서다 — 그 경우 아래 solveImposition 이 격자를 그대로 쓴다.
 *
 * clearance 는 넘기지 않는다: nest-free 는 makePart(=NFP 원본)로 판정하므로
 * 격자의 CLEARANCE(피치에 더하는 여유)와 개념이 다르다. 여유를 지어내지 않는다.
 */
function solveFreeOne(pieces, printW, printH, HT, allowRotate) {
  const pw = printW - HT, ph = printH - HT;
  if (!(pw > 0 && ph > 0) || !pieces?.length) return null;
  return solveFree(pieces, pw, ph, { allowRotate, maxUp: FREE_MAX_UP });
}

// ── 캐시 ───────────────────────────────────────────────────────────
// 판걸이는 **수량과 무관**하다. 수량비교표(9수량) × 판형(11) = 99회 호출이
// 캐시로 11회가 된다. nest 1회가 20~60ms 이므로 이게 없으면 렌더가 초 단위로 멈춘다.
const CACHE = new Map();
const CACHE_MAX = 500;

/**
 * @param {{key:string, net:Object, pieces:number[][][], polygon:boolean, noRotate:boolean}} dieline
 *   ★ key 는 「폴리곤을 결정하는 입력 전부」여야 한다 — 캐시 키가 이걸 그대로 쓴다.
 *     PDF 칼선처럼 도메인 구조가 아닌 도형을 넣을 때도 이 계약만 지키면 된다.
 * @param {{w:number,h:number,custom?:boolean}} sheet
 * @param {"grid"|"free"} [engine] LAYOUT_ENGINE. 기본 grid — 위 상수 주석 참조
 * @returns {Object|null} Layout — up=0 이면 배치 불가.
 *   engine:"free" 로 불러도 반환 모양은 같다. 더해지는 필드 셋:
 *     · engine    실제로 채택된 엔진 ("grid"|"free")
 *     · freeUsed  자유배치 결과를 채택했는가
 *     · free      자유배치 **원본** 요약 {up, footPct, …} — max 를 씌우지 않은 날숫자다.
 *                 비교표가 「자유가 격자보다 낮은가」를 보려면 이걸 읽어야 한다.
 */
export function solveImposition({ dieline, sheet, hangTab = 0, engine = DEFAULT_ENGINE }) {
  if (!dieline?.net || !sheet?.w || !sheet?.h) return null;
  // 폴리곤이 없는 구조(G형·직접입력)는 직사각 경로 (회전금지를 표현할 수 있는 유일한 길).
  const useRect = !dieline.polygon;
  // 종전에는 「엔진 선택 스위치를 두지 않는다」가 규칙이었다. 이유는 스위치 자체가
  // 아니라 **캐시 키**였다 — 호출자가 넘긴 파라미터가 키에서 빠지면 조용히 틀린 배치를
  // 돌려준다. 그래서 스위치를 넣되 키의 **첫 조각**으로 박았다. 규칙은 살아 있다.
  // 정규화도 여기서 한 번만 한다(오타 "Free" 가 키를 갈라 캐시를 두 배로 만들지 않게).
  const eng = engine === LAYOUT_ENGINE.FREE ? LAYOUT_ENGINE.FREE : LAYOUT_ENGINE.GRID;
  // custom 을 키에 넣는 이유: 지금은 printableArea 가 표준/주문생산을 구분하지 않아
  // 같은 w×h 면 배치가 정말 같다. 하지만 물림처럼 **custom 으로 갈리는 정책**이 하나라도
  // 들어오는 순간, 키가 구분하지 못하면 사용자가 890×670 을 직접 입력했을 때 표준 판형이
  // 캐시에 남긴 배치를 그대로 돌려받는다. 그 사고는 화면상 아무 표시 없이 up 만 틀린다.
  // ⚠ 엔진도 같은 이유로 키에 있다 — 빠지면 자유배치를 한 번 돌린 뒤 같은 규격의
  //   **견적 경로**(격자)가 자유배치 결과를 캐시에서 돌려받는다. 화면 표시 없이 up 만 틀린다.
  const ck = `${eng}|${useRect ? "rect" : "nest"}|${dieline.key}|${sheet.w}x${sheet.h}` +
             `|${hangTab}|${sheet.custom ? "c" : "s"}`;
  const hit = CACHE.get(ck);
  if (hit) return hit;

  const pa = printableArea(sheet);
  const { printW, printH } = pa;
  const net = dieline.net;
  const HT = hangTab || 0;
  const allowRotate = !dieline.noRotate;

  const run = extra => useRect
    ? solveRect(net.netW, net.netH, printW, printH, HT, allowRotate)
    : solveNest(dieline.pieces, printW, printH, HT, extra);

  // 발자국·수율의 분모는 **판형 면적**이다(인쇄가능영역이 아니다).
  // MAX_FOOT_PCT=92 가 이 분모로 교정된 값이라 여기가 갈리면 상한이 조용히 세진다.
  const sheetArea = pa.long * pa.short;
  const footOf = r => (r.bbox.w * r.bbox.h) / sheetArea * 100;

  const pool = run({});
  const first = pool[0] || null;

  // ── 발자국 상한 ─────────────────────────────────────────────────
  // 초과하면 maxUp 을 한 단계 줄여 재시도한다. 전부 초과하면 최선안을 그대로 남긴다
  // (up=0 으로 떨어뜨리면 견적이 통째로 사라진다).
  let chosen = first, utilCapped = false;
  if (first && footOf(first) > MAX_FOOT_PCT) {
    let cur = first, guard = 0;
    while (cur && cur.up > 1 && guard++ < 8) {
      const next = run({ maxUp: cur.up - 1 })[0];
      if (!next || next.up >= cur.up) break;
      if (footOf(next) <= MAX_FOOT_PCT) { chosen = next; utilCapped = true; break; }
      cur = next;
    }
  }

  if (!chosen) {
    const empty = {
      up: 0, cols: 0, rows: 0, rotated: false, interlocked: false,
      boxW: 0, boxH: 0, boxes: [], cells: [], candidates: [],
      sheetW: pa.long, sheetH: pa.short, pressCapped: pa.capped,
      utilPct: 0, footPct: 0, utilCapped: false, overlapInfo: null,
      alt: { up: 0, rotated: false, interlocked: false },
      printW, printH, dx: 0, dy: 0, sx: 0,
      engine: LAYOUT_ENGINE.GRID, freeUsed: false, free: null,
    };
    // 격자가 0개면 도형이 판에 아예 안 들어간다는 뜻이다 — 자유배치도 같은 조건에서
    // 같은 답을 낸다(둘 다 「부품 bbox 가 판보다 크면 후보 0」). 예산만 태우지 않는다.
    return cache(ck, empty);
  }

  // 맞물림 없는 기준안 — LayoutViz 의 비교줄·차선 표시용.
  // "칼선공유만 했을 때 몇 up 인가" 가 맞물림의 이득을 보여주는 유일한 숫자다.
  const ref = useRect ? null : solveNest(dieline.pieces, printW, printH, HT, { noInterlock: true })[0];

  const boxes = chosen.cells.map((c, i) => ({
    x: c.x, y: c.y, w: chosen.netW, h: chosen.netH,
    flipped: !!c.flip, rotated: chosen.rotated, idx: i,
  }));

  const usedArea = chosen.up * net.netW * net.netH;
  const candidates = [
    { cols: chosen.cols, rows: chosen.rows, up: chosen.up,
      rotated: chosen.rotated, interlocked: chosen.interlocked },
  ];
  if (ref && (ref.up !== chosen.up || ref.rotated !== chosen.rotated))
    candidates.push({ cols: ref.cols, rows: ref.rows, up: ref.up,
                      rotated: ref.rotated, interlocked: false });

  const layout = {
    up: chosen.up, cols: chosen.cols, rows: chosen.rows,
    rotated: chosen.rotated, interlocked: chosen.interlocked,
    boxW: chosen.netW, boxH: chosen.netH,
    boxes, cells: chosen.cells, candidates,
    sheetW: pa.long, sheetH: pa.short, pressCapped: pa.capped,
    // 수율(utilPct)의 정본은 여기 하나다. 종전에는 quote.mjs 3곳이 각자 계산했고
    // 분모가 두 종류라 같은 화면에서 53%/44% 로 갈렸다.
    utilPct: Math.round(usedArea / sheetArea * 100),
    footPct: Math.round(footOf(chosen)),
    utilCapped,
    overlapInfo: chosen.interlocked
      ? `맞물림 ↔${chosen.overlapX.toFixed(0)}mm ↕${chosen.overlapY.toFixed(0)}mm` +
        (chosen.sx ? ` · 엇갈림 ${chosen.sx.toFixed(0)}mm` : "")
      : null,
    alt: candidates[1] || { up: 0, rotated: false, interlocked: false },
    printW, printH, dx: chosen.dx, dy: chosen.dy, sx: chosen.sx,
    engine: LAYOUT_ENGINE.GRID, freeUsed: false, free: null,
  };
  if (eng !== LAYOUT_ENGINE.FREE) return cache(ck, layout);

  // ══ 자유배치 ═══════════════════════════════════════════════════════
  const fr = solveFreeOne(dieline.pieces, printW, printH, HT, allowRotate);
  const free = fr && {
    // ★ **원본 up 이다.** 여기에 Math.max(격자) 를 씌우지 마라 — 비교표가
    //   「자유 < 격자」(= 자유배치 결함)를 못 보게 된다. 채택 여부는 freeUsed 다.
    up: fr.up,
    utilPct: Math.round(fr.up * net.netW * net.netH / sheetArea * 100),
    footPct: Math.round(footOf(fr)),
    // 발자국 상한을 **적용하지 않고 알린다.** 격자의 상한 루프는 「maxUp 을 한 단계
    // 줄이면 열·행이 하나 빠져 외곽이 실제로 작아진다」는 격자 성질에 기댄 것이고,
    // 자유배치는 한 장을 빼도 bbox 가 그대로일 수 있어 그 루프가 성립하지 않는다.
    // 조용히 자르는 대신 사실을 싣는다 — 사람이 손배치로 받아 확정하는 경로다.
    footOver: footOf(fr) > MAX_FOOT_PCT,
    bbox: fr.bbox, strategy: fr.strategy, ops: fr.ops,
    budgetHit: fr.budgetHit, rejected: fr.rejected, tried: fr.tried,
    printW: printW - HT, printH: printH - HT,
  };

  // ★ 자유 ⊇ 격자 — nest-free 는 최적해를 보장하지 않는다(그 파일 「한계」).
  //   그래서 **두 결과 중 큰 쪽**을 쓴다. 이게 nest-free 가 부르는 쪽에 요구한 계약이다.
  //   동점이면 격자를 남긴다 — 같은 up 이면 규칙격자가 목형·톰슨에 유리하다.
  if (!fr || fr.up <= layout.up)
    return cache(ck, { ...layout, engine: LAYOUT_ENGINE.GRID, freeUsed: false, free });

  const P = fr.part;
  const freeBoxes = fr.items.map((it, i) => ({
    x: it.x, y: it.y, w: itemW(P, it), h: itemH(P, it),
    flipped: !!it.flipped, rotated: !!it.rotated, idx: i,
  }));
  const nRot = fr.items.reduce((n, it) => n + (it.rotated ? 1 : 0), 0);
  const freeLayout = {
    ...layout,
    engine: LAYOUT_ENGINE.FREE, freeUsed: true, free,
    up: fr.up,
    // 열·행·피치·엇갈림은 자유배치에 **존재하지 않는다.** 0 으로 둔다 —
    // 숫자를 지어내면 화면이 「3×2」 같은 없는 격자를 주장하고, 그걸 본 사람이
    // 목형을 그 격자로 짠다. 없는 것은 없다고 말한다.
    cols: 0, rows: 0, dx: 0, dy: 0, sx: 0,
    rotated: nRot === fr.up,        // 전부 돌았을 때만 「회전 배치」다 (섞이면 false)
    interlocked: false,
    boxW: P.w, boxH: P.h,
    boxes: freeBoxes,
    cells: fr.items.map((it, i) => ({ i, j: 0, x: it.x, y: it.y, flip: !!it.flipped })),
    candidates: [{ cols: 0, rows: 0, up: fr.up, rotated: nRot === fr.up, interlocked: false }],
    // 차선 = 격자 결과. 「자유배치가 몇 up 을 더 벌었나」가 이 줄에서 읽힌다.
    alt: { up: layout.up, rotated: layout.rotated, interlocked: layout.interlocked },
    utilPct: free.utilPct,
    footPct: free.footPct,
    utilCapped: false,
    overlapInfo: `자유배치 ${fr.up}up (격자 ${layout.up}up) · ${fr.strategy}` +
                 (nRot && nRot < fr.up ? ` · 90° ${nRot}칸 섞임` : ""),
  };
  return cache(ck, freeLayout);
}

function cache(k, v) {
  // 단일 사용자 앱 — LRU 라이브러리 대신 가장 오래된 항목부터 버린다
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(k, v);
  return v;
}

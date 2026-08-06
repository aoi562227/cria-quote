// ══════════════════════════════════════════════════════════════════
//  imposition.mjs — 판걸이(배치) 어댑터
//
//  nest.mjs 를 부르는 **유일한** 지점이다. 다른 곳에서 solveLayout 을
//  직접 import 하면 아래 3대 정책(인쇄기 클램프·발자국 상한·행거탭)이
//  적용되지 않은 up 이 견적에 들어간다.
// ══════════════════════════════════════════════════════════════════
import { effectiveSheet, FIT_TOL, MAX_FOOT_PCT } from "./data/sheets.mjs";
import { solveLayout } from "../nest.mjs";

/** clearance 는 nest 기본값 0.5 그대로 — scorecard 표들과 같은 조건이어야 A/B 가 의미를 갖는다 */
const CLEARANCE = 0.5;

/**
 * 판형 ∩ 인쇄기 상한(990×720) → 실제 인쇄 가능 영역.
 *
 * ── 물림(gripper)을 여기서 빼지 않는 이유 ─────────────────────────────
 * 물림 자체는 실재한다 — 코리팩 산출식 엑셀의 「종이 규격」 vs 「제작 규격(여분제외)」
 * 차이가 짧은변 −30 / 긴변 −20 이다(sheets.mjs BITE_SHORT/BITE_LONG 에 근거 보존).
 * 그런데 **그 차감은 이미 판형 숫자 안에 들어 있다.** 견적서 「단위」열(760×480,
 * 980×720 …)과 BASE_SHEETS 의 절지 규격은 원지가 아니라 **인쇄기에 걸리는 재단 크기**고,
 * 견적서의 up 은 그 크기 위에서 실제로 나온 값이다. 여기서 또 빼면 이중 차감이다.
 *
 * 반증 불가능한 실측 사례: 삼면E 90×70×130 을 545×394(4×64)에 2up.
 *   회전 2열이 545 중 536mm 를 쓴다 → 남는 여백이 전체 9mm.
 *   긴변에서 20mm 를 더 빼면 그 대지가 물리적으로 성립하지 않는데, 견적서에 실존한다.
 *
 * A/B 측정 (test/scorecard-unit.mjs — 판을 견적서 「단위」로 직접 주고 up 채점):
 *     물림 0     → 7/12       ← 현행
 *     물림 20/30 → 1/12
 * 앱 실경로(test/verify-net.mjs · test/scorecard-nest.mjs)도 같은 방향으로 1/10 → 7/10.
 *
 * ⚠ "물림은 물리적으로 항상 필요하다" 는 이유로 되돌리지 마라. 물리적으로는 맞지만
 *   이 함수에 들어오는 크기가 이미 물림이 반영된 재단 크기다. 되돌리려면 먼저
 *   BASE_SHEETS 를 원지 규격으로 재정의하고 견적서 78건을 다시 역산해야 한다.
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

// ── 캐시 ───────────────────────────────────────────────────────────
// 판걸이는 **수량과 무관**하다. 수량비교표(9수량) × 판형(11) = 99회 호출이
// 캐시로 11회가 된다. nest 1회가 20~60ms 이므로 이게 없으면 렌더가 초 단위로 멈춘다.
const CACHE = new Map();
const CACHE_MAX = 500;

/**
 * @param {{key:string, net:Object, pieces:number[][][], polygon:boolean, noRotate:boolean}} dieline
 * @param {{w:number,h:number,custom?:boolean}} sheet
 * @returns {Object|null} Layout — up=0 이면 배치 불가
 */
export function solveImposition({ dieline, sheet, hangTab = 0 }) {
  if (!dieline?.net || !sheet?.w || !sheet?.h) return null;
  // 폴리곤이 없는 구조(G형·직접입력)는 직사각 경로. 엔진 선택 스위치는 두지 않는다 —
  // 넘기는 호출자가 없는 파라미터는 캐시 키에서 빠져 조용히 틀린 배치를 돌려준다.
  const useRect = !dieline.polygon;
  const ck = `${useRect ? "rect" : "nest"}|${dieline.key}|${sheet.w}x${sheet.h}|${hangTab}`;
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
    };
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
  };
  return cache(ck, layout);
}

function cache(k, v) {
  // 단일 사용자 앱 — LRU 라이브러리 대신 가장 오래된 항목부터 버린다
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(k, v);
  return v;
}

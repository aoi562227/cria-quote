// ══════════════════════════════════════════════════════════════════
//  imposition.mjs — 판걸이(배치) 어댑터
//
//  nest.mjs 를 부르는 **유일한** 지점이다. 다른 곳에서 solveLayout 을
//  직접 import 하면 아래 3대 정책(인쇄기 클램프·발자국 상한·행거탭)이
//  적용되지 않은 up 이 견적에 들어간다.
// ══════════════════════════════════════════════════════════════════
import {
  effectiveSheet, BITE_LONG, BITE_SHORT, FIT_TOL, MAX_FOOT_PCT,
} from "./data/sheets.mjs";
import { solveLayout } from "../nest.mjs";

/** 배치 엔진. "nest" = NFP 무겹침(정본) / "rect" = 직사각 단순 나눗셈 */
export const LAYOUT_ENGINE = "nest";

/** clearance 는 nest 기본값 0.5 그대로 — scorecard2 와 같은 조건이어야 A/B 표가 의미를 갖는다 */
const CLEARANCE = 0.5;

/**
 * 판형 ∩ 인쇄기 상한(990×720) → 물림 차감 → 실제 인쇄 가능 영역.
 *
 * ── 물림(gripper) 방침 ──────────────────────────────────────────────
 * 표준 판형(BASE_SHEETS)은 **원지 규격**이다. 원지를 판에 걸면 그리퍼가 잡는
 * 띠를 인쇄에 못 쓰므로 여기서 뺀다.
 *   짧은변 −30 / 긴변 −20  (코리팩 산출식 엑셀 「제작 규격(여분제외)」 역산. 비대칭이다)
 *
 * ⚠ 여기가 다음 단계의 최우선 재검토 지점이다. 엔진을 nest 로 바꾸면서 측정한
 *   견적서 15건 up 재현율 (판 = 견적서 「단위」열 = 실제 재단 크기):
 *       레거시(IL_W=10 상수 감산) + 물림 20/30 → 11/15
 *       nest(NFP 무겹침)         + 물림 20/30 →  2/15
 *       nest(NFP 무겹침)         + 물림 0     → 10/15
 *   즉 재현율을 움직이는 것은 엔진이 아니라 **물림 방침**이다. 레거시는
 *   물림 차감(과소)과 맞물림 상수 감산(과대)이 서로 상쇄돼 맞아 보였을 뿐이고,
 *   그 맞물림은 verify-nest §5 가 기하 위반으로 증명했다(칼선이 서로를 지나감).
 *
 *   물림 0 이 맞을 근거: 견적서 「단위」열은 원지 규격이 아니라 **이미 재단된 크기**다.
 *   실제 대지(250423 삼면E 545×394 2up)를 재보면 배치 외곽이 545 중 514mm 를 써서
 *   한쪽 여백이 15mm 밖에 없다 — 긴변 20mm 를 또 빼면 그 대지가 성립하지 않는다.
 *
 *   그럼에도 이 커밋에서는 종전 동작(무조건 차감)을 **그대로 유지한다**.
 *   물림 방침은 그 자체로 단독 변경이어야 한다. 엔진 교체와 같이 바꾸면
 *   어느 쪽이 재현율을 움직였는지 영구히 알 수 없게 된다.
 */
export function printableArea(sheet) {
  const es = effectiveSheet(sheet.w, sheet.h);
  const biteLong  = BITE_LONG;
  const biteShort = BITE_SHORT;
  return {
    long: es.long, short: es.short, capped: es.capped, biteLong, biteShort,
    printW: (es.long  - biteLong)  * (1 + FIT_TOL),
    printH: (es.short - biteShort) * (1 + FIT_TOL),
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
export function clearImpositionCache() { CACHE.clear(); }

/**
 * @param {{key:string, net:Object, pieces:number[][][], polygon:boolean, noRotate:boolean}} dieline
 * @param {{w:number,h:number,custom?:boolean}} sheet
 * @returns {Object|null} Layout — up=0 이면 배치 불가
 */
export function solveImposition({ dieline, sheet, hangTab = 0, engine = LAYOUT_ENGINE, opts = {} }) {
  if (!dieline?.net || !sheet?.w || !sheet?.h) return null;
  const useRect = !dieline.polygon || engine === "rect";
  const ck = `${useRect ? "rect" : engine}|${dieline.key}|${sheet.w}x${sheet.h}|${hangTab}`;
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

  const sheetArea = pa.long * pa.short;
  const footOf = r => (r.bbox.w * r.bbox.h) / (printW * printH) * 100;

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
      printW, printH, biteLong: pa.biteLong, biteShort: pa.biteShort,
      dx: 0, dy: 0, sx: 0, engine: useRect ? "rect" : engine,
    };
    return cache(ck, empty);
  }

  // 맞물림 없는 기준안 — LayoutViz 의 비교줄·차선 표시용.
  // "칼선공유만 했을 때 몇 up 인가" 가 맞물림의 이득을 보여주는 유일한 숫자다.
  const ref = useRect ? null : solveNest(dieline.pieces, printW, printH, HT, { noInterlock: true })[0];

  const boxes = chosen.cells.map((c, i) => ({
    x: pa.biteLong  + c.x,
    y: pa.biteShort + c.y,
    w: chosen.netW, h: chosen.netH,
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
    utilPct: Math.round(usedArea / sheetArea * 100),
    footPct: Math.round(footOf(chosen)),
    utilCapped,
    overlapInfo: chosen.interlocked
      ? `맞물림 ↔${chosen.overlapX.toFixed(0)}mm ↕${chosen.overlapY.toFixed(0)}mm` +
        (chosen.sx ? ` · 엇갈림 ${chosen.sx.toFixed(0)}mm` : "")
      : null,
    alt: candidates[1] || { up: 0, rotated: false, interlocked: false },
    printW, printH, biteLong: pa.biteLong, biteShort: pa.biteShort,
    dx: chosen.dx, dy: chosen.dy, sx: chosen.sx,
    engine: useRect ? "rect" : engine,
  };
  return cache(ck, layout);
}

function cache(k, v) {
  // 단일 사용자 앱 — LRU 라이브러리 대신 가장 오래된 항목부터 버린다
  if (CACHE.size >= CACHE_MAX) CACHE.delete(CACHE.keys().next().value);
  CACHE.set(k, v);
  return v;
}

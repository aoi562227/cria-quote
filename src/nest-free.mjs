// ══════════════════════════════════════════════════════════════════
//  nest-free.mjs — **자유배치** 네스터. 격자를 쓰지 않고 한 장씩 앉힌다.
//
//  ★ 알고리즘 출처: SVGnest(MIT) 방식 — NFP 접점 배치 + 순서/자세 탐색.
//    **코드 복사 없음.** 공개된 알고리즘을 우리 자료구조로 다시 구현했다.
//    deepnest 는 GPLv3 라 한 줄만 들어와도 이 저장소가 전염된다 — 그래서 저장소를
//    열지 않고 아래 요점만으로 짰다:
//      ① 최적 위치는 「무언가에 닿는 자리」= NFP **경계** 위다
//      ② 판 안쪽 적합영역으로 후보를 제한한다
//      ③ 한 장씩 넣고 위치는 정렬키로 고른다 (bottom-left 계열)
//      ④ 넣는 순서·자세를 탐색한다 (SVGnest 는 GA — 우리는 전수, 아래 「결정성」)
//    민코프스키·NFP·구간 스윕은 **이미 우리 것**이다 (nest.mjs · verify-nest 44/44).
//
//  왜 격자 솔버(nest.solveLayout)로 부족한가
//  ───────────────────────────────────────
//  solveLayout 은 **규칙격자**만 만든다: (dx, dy, sx, sy, 반전규칙) 5개가 배치 전체를
//  결정한다. 목형은 규칙적이어야 톰슨이 서고 견적서 78건이 그 모양이라 그게 정본이다.
//  하지만 규칙격자가 원리적으로 못 하는 것이 둘 있다 —
//    · 자리마다 자세가 다른 배치 (3장은 0°, 남는 틈에 1장만 90°)
//    · 남은 여백에 **한 장만** 더 넣기 (격자는 열·행 단위로만 늘어난다)
//  자유배치는 그 둘을 한다. 대신 규칙성을 잃는다 — 아래 「한계」.
//
//  ⚠ 이 파일은 **견적 경로가 아니다.** imposition.mjs 는 계속 solveLayout 만 부른다.
//    자유배치 결과는 **손배치의 씨앗**으로만 흐르고, 사람이 보고 확정해야 up 이 된다
//    (그 통로는 overrides.up = state 의 mUp/mUpV 하나뿐이다).
//    그래서 격자를 지우지 않았고, 개당단가가 이 파일 때문에 움직이지 않는다.
//
//  후보를 어떻게 얻나 — 「열거」가 아니라 「떨어뜨려 밀어붙이기」
//  ────────────────────────────────────────────────────
//  NFP 경계 정점을 전부 열거하면 정확하지만 비용이 터진다: 조각 n 개면 NFP 가 n²개고
//  (PDF 실측 부품이 9~16조각 → 81~256개), 앉힌 장수마다 그게 곱해진다.
//  같은 자리를 값싸게 얻는 방법이 **드롭 & 슬라이드**다 — 판 아래(또는 오른쪽)에서
//  떨어뜨려 닿을 때까지 민다. 미는 거리는 nest 의 구간 스윕(forbiddenAlong)으로
//  **정확히** 계산하므로 멈추는 자리가 곧 NFP 경계다. 이분탐색이 아니다.
//    · 얻는 것: 오목한 틈에 파고드는 맞물림도 나온다 (x 를 촘촘히 스캔하므로)
//    · 잃는 것: 「두 이웃에 동시에 닿아야만 가능한」 자리 일부를 놓친다
//      → 놓쳐도 **겹치지 않는다.** 덜 촘촘할 뿐이다 (안전한 방향의 근사)
//
//  결정성 — 같은 입력이면 **항상** 같은 결과
//  ────────────────────────────────────
//  ① 난수를 쓰지 않는다. SVGnest 의 순서 탐색은 GA(난수)인데 우리 입력은 **같은 도형
//     하나**뿐이라 「순서」에 뜻이 없다 — 순열을 섞어도 같은 해다. 실제 탐색 차원은
//     (정렬키 × 자세 조합)이고 유한해서 전수로 돈다. GA 를 넣으면 씨앗 관리 비용만 생긴다.
//  ② 예산을 **시간(ms)으로 재지 않는다.** Date.now() 로 끊으면 빠른 PC 와 느린 PC 가
//     다른 답을 내고 그 순간 테스트가 무의미해진다(같은 입력 다른 결과).
//     대신 `ops`(겹침 판정 횟수)를 세서 끊는다 — 기계와 무관하게 재현된다.
//  ③ 후보 좌표를 0.01mm 로 양자화하고 정렬키에 **완전순서**를 준다. 부동소수 tie 로
//     순서가 흔들리면 결과가 갈린다.
//
//  한계 (숨기지 마라)
//  ────────────────
//  · 규칙격자가 아니라서 톰슨 목형으로 그대로 못 쓸 수 있다. 사람이 확인해야 한다.
//  · 0°×90° 가 섞인 쌍은 볼록조각쌍 NFP 를 새로 깔지 않고 **bbox** 로 막는다
//    (nest.nfpSetOf). 그 쌍은 촘촘함을 잃는다 — 겹침을 놓치는 쪽이 아니라 더 막는 쪽이다.
//  · 최적해를 보장하지 않는다. 격자 솔버보다 up 이 **적을 수도** 있다 —
//    그래서 부르는 쪽은 두 결과를 비교해서 큰 쪽을 쓴다.
// ══════════════════════════════════════════════════════════════════
import {
  makePart, itemW, itemH, pairOverlaps, freeAt, forbiddenAlong,
} from "./nest.mjs";

/** 위치 양자화(mm). nest.firstFree 의 PITCH_QUANT 와 같은 값이어야 한다 —
 *  다르면 「닿는 자리」가 두 곳에서 다르게 반올림돼 접촉이 겹침으로 뒤집힌다. */
const Q = 0.01;
const qz = v => Math.round(v / Q) * Q;
const EPS = 1e-7;

/** 기본 예산(겹침 판정 횟수). 실측(아래 verify-drag §D)에서 판 하나를 꽉 채우는 데
 *  20~60만이라 200만이면 실무 범위를 덮는다. 넘으면 **그때까지의 해**를 돌려주고
 *  budgetHit 을 세운다 — 조용히 끊으면 사용자가 「이게 최선」이라고 오해한다. */
export const DEFAULT_OPS = 2_000_000;
/** 한 장씩 앉히는 최대 개수. 판이 크고 도형이 아주 작을 때 폭주를 막는다. */
export const DEFAULT_MAX_UP = 200;
/** 한 걸음에서 실제로 밀어붙여 볼 후보 수. 정렬키 오름차순으로 앞에서부터 본다 —
 *  밀기는 키를 **낮추는 방향**이라 앞쪽 후보에서 최선이 나올 확률이 높다.
 *  키우면 조금 더 촘촘해지고 그만큼 느려진다(선형). */
const PROBE_MAX = 28;
/** x(또는 y) 스캔 격자 = 도형 짧은변 / 이 값. 촘촘하면 맞물림을 더 찾고 느려진다. */
const SCAN_DIV = 10;

/** 자세 후보 — 배열 순서가 곧 탐색 우선순위다(결정성). */
const POSES = [
  { rotated: false, flipped: false },
  { rotated: false, flipped: true },
  { rotated: true,  flipped: false },
  { rotated: true,  flipped: true },
];

/**
 * 정렬키 — 「어느 빈자리를 먼저 쓰나」. 자유배치의 성격을 정하는 값이다.
 *  · bl    : 위→왼쪽. 한 줄을 채우고 다음 줄로 (bottom-left 고전)
 *  · lb    : 왼쪽→위. 세로로 먼저 채운다
 *  · tight : 배치 외곽 bbox 를 가장 덜 키우는 자리 (발자국을 작게 유지)
 * 어느 하나가 항상 이기지 않으므로 전수로 돌려 up 이 큰 것을 고른다.
 */
const KEYS = ["bl", "lb", "tight"];

const inBounds = (P, it, W, H) =>
  it.x >= -EPS && it.y >= -EPS &&
  it.x + itemW(P, it) <= W + EPS && it.y + itemH(P, it) <= H + EPS;

/** it 를 막을 **가능성이 있는** 이웃만 남긴다.
 *  −y(또는 +y) 로 밀 때는 x 구간이 겹치는 이웃만 방해할 수 있다 — 축평행 이동에서는
 *  이게 근사가 아니라 **정확**하다. 안 걸러내면 60장 앉힌 판에서 한 걸음이
 *  60 × NFP(n²) 가 되어 초 단위가 된다. */
function band(P, it, others, axis) {
  const w = itemW(P, it), h = itemH(P, it);
  return others.filter(o => axis === "y"
    ? it.x < o.x + itemW(P, o) - EPS && o.x < it.x + w - EPS
    : it.y < o.y + itemH(P, o) - EPS && o.y < it.y + h - EPS);
}

/**
 * it 를 v 방향으로 「닿을 때까지」 민다. 판 벽도 벽으로 본다.
 * 멈추는 자리 = 금지구간(strict 겹침)의 시작점 = **NFP 경계** = 딱 닿음.
 */
function slide(P, it, others, W, H, v, budget) {
  const w = itemW(P, it), h = itemH(P, it);
  const lim = v[0] < 0 ? it.x : v[1] < 0 ? it.y : v[0] > 0 ? W - w - it.x : H - h - it.y;
  if (!(lim > Q)) return it;
  const near = band(P, it, others, v[1] !== 0 ? "y" : "x");
  const ivs = forbiddenAlong(P, [it.x, it.y], it, near, v);
  budget.ops += near.length + 1;
  let s = lim;
  for (const [lo, hi] of ivs) {
    if (hi <= EPS) continue;             // 진행방향 뒤쪽 구간 — 무관
    if (lo <= EPS) return it;            // 출발점에서 이미 금지 = 못 민다
    if (lo < s) s = lo;
  }
  s = Math.floor((s - EPS) / Q) * Q;     // 항상 **덜** 미는 쪽으로 양자화 = 안전
  if (!(s > EPS)) return it;
  const moved = { ...it, x: qz(it.x + s * v[0]), y: qz(it.y + s * v[1]) };
  budget.ops += others.length;
  // 밀고 나서 **다시 검사한다.** 구간 스윕은 축 위에서만 정확하고 양자화도 끼므로
  // 결과를 믿지 않고 확인한다 — 여기서 걸리면 안 민 자리를 그대로 쓴다.
  return freeAt(P, moved, others) && inBounds(P, moved, W, H) ? moved : it;
}

/** 두 번 밀어 압착한다 (위→왼쪽 또는 왼쪽→위). 한 번 왼쪽으로 가면 더 올라갈 수
 *  있는 자리가 열리므로 왕복 2회를 돈다 — 3회 이상은 실측에서 거의 안 움직였다. */
function compact(P, it, others, W, H, kind, budget) {
  const seq = kind === "lb" ? [[-1, 0], [0, -1]] : [[0, -1], [-1, 0]];
  let c = it;
  for (let r = 0; r < 2; r++) for (const v of seq) c = slide(P, c, others, W, H, v, budget);
  return c;
}

/** 떨어뜨릴 출발점들. **정렬 가능한 유한 집합**이어야 한다(결정성). */
function dropPoints(P, pose, placed, W, H, kind) {
  const probe = { ...pose, x: 0, y: 0 };
  const w = itemW(P, probe), h = itemH(P, probe);
  if (w > W + EPS || h > H + EPS) return [];
  const along = new Set(), from = [];
  const add = (set, v, hi) => { const q = qz(v); if (q >= -EPS && q <= hi + EPS) set.add(q); };
  const scan = kind === "lb" ? h : w;                  // 스캔축: bl→x, lb→y
  const hi   = kind === "lb" ? H - h : W - w;
  const step = Math.max(10 * Q, Math.min(w, h) / SCAN_DIV);
  for (let v = 0; v <= hi + EPS; v += step) add(along, v, hi);
  add(along, hi, hi);
  // 이웃이 만드는 「줄」 — 칼선 공유(딱 옆·딱 아래)가 실무 최선이라 반드시 넣는다
  for (const o of placed) {
    const ow = itemW(P, o), oh = itemH(P, o);
    if (kind === "lb") { add(along, o.y, hi); add(along, o.y + oh, hi); add(along, o.y - h, hi); }
    else               { add(along, o.x, hi); add(along, o.x + ow, hi); add(along, o.x - w, hi); }
  }
  // 떨어뜨리는 축의 출발 높이 — 판 끝 + 이웃 위/아래. 판 끝 하나만 쓰면 이미 채워진
  // 열에서는 출발점이 막혀 그 열을 통째로 놓친다.
  const dropHi = kind === "lb" ? W - w : H - h;
  const drops = new Set([qz(dropHi), 0]);
  for (const o of placed) {
    if (kind === "lb") { add(drops, o.x + itemW(P, o), dropHi); add(drops, o.x - w, dropHi); }
    else               { add(drops, o.y + itemH(P, o), dropHi); add(drops, o.y - h, dropHi); }
  }
  for (const a of [...along].sort((p, q) => p - q))
    for (const d of [...drops].sort((p, q) => p - q))
      from.push(kind === "lb" ? { ...pose, x: d, y: a } : { ...pose, x: a, y: d });
  return from;
}

const keyOf = (kind, P, it, bb) => {
  if (kind === "bl") return [it.y, it.x];
  if (kind === "lb") return [it.x, it.y];
  const nw = Math.max(bb.w, it.x + itemW(P, it)), nh = Math.max(bb.h, it.y + itemH(P, it));
  return [nw * nh, it.y, it.x];
};
/** 완전순서 비교 — 마지막에 자세 인덱스까지 넣어 tie 를 없앤다 */
const lessKey = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (Math.abs(d) > 1e-9) return d < 0;
  }
  return false;
};
const poseIdx = it => (it.rotated ? 2 : 0) + (it.flipped ? 1 : 0);

/** 한 걸음 — 다음 한 장을 앉힐 최선의 자리. 없으면 null. */
function step1(P, placed, W, H, kind, poses, bb, budget) {
  const cand = [];
  for (const pose of poses)
    for (const p of dropPoints(P, pose, placed, W, H, kind))
      cand.push([keyOf(kind, P, p, bb).concat(poseIdx(p)), p]);
  // 키 오름차순 — 앞에서부터 PROBE_MAX 개만 실제로 밀어본다
  cand.sort((a, b) => (lessKey(a[0], b[0]) ? -1 : lessKey(b[0], a[0]) ? 1 : 0));
  let best = null, bestKey = null, probed = 0;
  for (const [, p] of cand) {
    if (!inBounds(P, p, W, H)) continue;
    budget.ops += placed.length;
    if (!freeAt(P, p, placed)) continue;
    const c = compact(P, p, placed, W, H, kind, budget);
    const k = keyOf(kind, P, c, bb).concat(poseIdx(c));
    if (!bestKey || lessKey(k, bestKey)) { best = c; bestKey = k; }
    if (++probed >= PROBE_MAX) break;
  }
  return best;
}

/** 한 전략(정렬키 × 허용자세)으로 끝까지 앉힌다. */
function fill(P, W, H, kind, poses, maxUp, budget, seed = []) {
  const placed = seed.map(o => ({ ...o }));
  let bb = { w: 0, h: 0 };
  for (const o of placed)
    bb = { w: Math.max(bb.w, o.x + itemW(P, o)), h: Math.max(bb.h, o.y + itemH(P, o)) };
  let added = 0;
  while (placed.length < maxUp) {
    if (budget.ops > budget.cap) { budget.hit = true; break; }
    const it = step1(P, placed, W, H, kind, poses, bb, budget);
    if (!it) break;
    placed.push(it);
    added++;
    bb = { w: Math.max(bb.w, it.x + itemW(P, it)), h: Math.max(bb.h, it.y + itemH(P, it)) };
  }
  return { items: placed, bbox: bb, added };
}

/** 겹치는 쌍의 개수. 0 이어야 한다 — 이 함수가 「해를 버리는」 판정이다. */
export function overlapCount(P, items) {
  let n = 0;
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      if (pairOverlaps(P, items[i], items[j])) n++;
  return n;
}

/** 허용 자세 조합. 회전을 허용하면 0°/90° 가 섞일 수 있고 그 쌍은 bbox 로 막힌다 —
 *  그래서 「0°만」·「90°만」·「섞음」 셋을 각각 돌려보고 결과로 판정한다. */
function poseSetsOf(opt) {
  const flips = opt.allowFlip === false ? [false] : [false, true];
  const rotSets = opt.allowRotate === false ? [[false]] : [[false], [true], [false, true]];
  return rotSets.map(rots => POSES.filter(p => rots.includes(p.rotated) && flips.includes(p.flipped)))
                .filter(s => s.length);
}

/**
 * 자유배치로 판 W×H 를 채운다.
 *
 * @param {number[][][]} rawPieces 볼록 조각 목록 (전개도 1장). nest 와 같은 규약.
 * @param {number} W 판 가로(= 인쇄가능영역). **물림은 여기서 빼지 않는다** —
 *                   빼고 넣을지는 부르는 쪽이 정한다 (ARCHITECTURE §5).
 * @param {number} H 판 세로
 * @param {{maxUp?:number, ops?:number, allowRotate?:boolean, allowFlip?:boolean}} opt
 * @returns {{items,up,bbox,strategy,ops,budgetHit,tried,rejected,part,utilPct,footPct}|null}
 *   items = [{x,y,flipped,rotated}] — **손배치와 같은 규약**이라 그대로 씨앗이 된다.
 *   rejected = 겹침 때문에 **버린** 해의 개수. 정상 동작에서는 0 이다. 0 이 아니면
 *              알고리즘 결함이므로 숨기지 않고 밖으로 낸다.
 */
export function solveFree(rawPieces, W, H, opt = {}) {
  if (!(W > 0 && H > 0)) return null;
  const P = makePart(rawPieces);
  if (!P) return null;
  const maxUp = opt.maxUp ?? DEFAULT_MAX_UP;
  const budget = { ops: 0, cap: opt.ops ?? DEFAULT_OPS, hit: false };

  let best = null, tried = 0, rejected = 0;
  for (const kind of KEYS) {
    for (const poses of poseSetsOf(opt)) {
      tried++;
      const r = fill(P, W, H, kind, poses, maxUp, budget);
      // ★ 겹침이 하나라도 있으면 **그 해를 버린다.** 목형이 깨지는 결과를 내보내는 것보다
      //   up 이 적은 편이 낫다. NFP 로 앉혔으니 걸릴 일이 없어야 정상이다.
      if (overlapCount(P, r.items) > 0) { rejected++; continue; }
      const cand = { ...r, up: r.items.length,
                     strategy: `${kind}·자세${poses.map(p => (p.rotated ? "R" : "0") + (p.flipped ? "f" : "")).join("/")}` };
      if (!best || cand.up > best.up ||
          (cand.up === best.up && cand.bbox.w * cand.bbox.h < best.bbox.w * best.bbox.h)) best = cand;
      if (budget.hit) break;
    }
    if (budget.hit) break;
  }
  if (!best) return null;
  return { ...best, ops: budget.ops, budgetHit: budget.hit, tried, rejected,
           part: P, sheet: { w: W, h: H },
           utilPct: +(100 * best.up * P.w * P.h / (W * H)).toFixed(1),
           footPct: +(100 * best.bbox.w * best.bbox.h / (W * H)).toFixed(1) };
}

/**
 * 이미 앉힌 배치에 **더 들어가는 만큼만** 추가한다 (손배치 「빈자리 채우기」).
 * 기존 배치는 한 칸도 옮기지 않는다 — 사람이 맞춰 둔 자리를 엔진이 움직이면
 * 그건 도움이 아니라 사고다.
 * @returns {{items, added, ops, budgetHit, rejected}|null} items = 기존 + 추가
 */
export function fillGaps(rawPieces, W, H, existing, opt = {}) {
  if (!(W > 0 && H > 0)) return null;
  const P = makePart(rawPieces);
  if (!P) return null;
  const seed = (existing || []).map(o => ({
    x: qz(+o.x), y: qz(+o.y), flipped: !!o.flipped, rotated: !!o.rotated }));
  if (seed.some(o => !Number.isFinite(o.x) || !Number.isFinite(o.y))) return null;
  const budget = { ops: 0, cap: opt.ops ?? DEFAULT_OPS, hit: false };
  // 씨앗 자체가 이미 겹쳐 있으면 채우지 않는다 — 겹친 배치에 더 얹으면 원인을 못 찾는다.
  const seedOv = overlapCount(P, seed);
  if (seedOv > 0) return { items: seed, added: 0, ops: budget.ops, budgetHit: false, rejected: seedOv };

  let best = null;
  for (const kind of KEYS) {
    for (const poses of poseSetsOf(opt)) {
      const r = fill(P, W, H, kind, poses, opt.maxUp ?? DEFAULT_MAX_UP, budget, seed);
      if (overlapCount(P, r.items) > 0) continue;      // 버린다
      if (!best || r.added > best.added) best = r;
      if (budget.hit) break;
    }
    if (budget.hit) break;
  }
  if (!best) return { items: seed, added: 0, ops: budget.ops, budgetHit: budget.hit, rejected: 0 };
  return { items: best.items, added: best.added, ops: budget.ops, budgetHit: budget.hit, rejected: 0 };
}

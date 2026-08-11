// ══════════════════════════════════════════════════════════════════
//  nest-drag.mjs — 손배치(마우스 드래그)의 **기하 엔진**. 3단계 전용.
//
//  왜 이 파일이 따로 있나
//  ────────────────────
//  SheetCanvas 는 그림이고, nest.mjs 는 「판형에 최대로 앉히는 솔버」다. 손배치는
//  둘 중 어느 쪽도 아니다 — 사람이 대충 끌면 **엔진이 정확한 맞물림을 잡아주는**
//  대화형 기하다. 그림 파일에 넣으면 JSX 사이에 민코프스키가 섞이고, nest.mjs 에
//  넣으면 순수 솔버가 포인터 좌표를 알게 된다. 그래서 한 파일을 새로 판다.
//  ⚠ 이 파일이 **유일한** 3단계 신규 파일이다. UI 는 SheetCanvas.jsx 를 확장한다.
//
//  nest.mjs 를 어떻게 재사용하나
//  ──────────────────────────
//  겹침 판정·스냅 전부 nest 의 NFP 를 그대로 쓴다 (preparePart / overlaps /
//  minkowski / strictlyInside / lineInsideInterval / firstFree). 새 기하를 짜지 않는다 —
//  솔버와 손배치가 다른 겹침 기준을 쓰면 「자동은 되는데 손으로는 안 되는」 자리가 생긴다.
//
//  ⚠ overlaps 는 **볼록 조각 리스트**를 받는다. 입력이 둘로 갈린다:
//   · 구조 전개도(dieline.pieces)  → 이미 볼록이다. 그대로 쓴다 (mode "exact").
//   · 칼선 PDF 의 polygons          → **폴리라인 묶음**이다. 닫힌 윤곽도 볼록도 아니고
//     2점짜리 선분이 다수 섞인다(pdf-dieline.mjs polysOf 주석). 그래서
//       ① 끝점 스티칭으로 닫힌 링을 만들고            stitchRings
//       ② 가장 큰 링(= 바깥 윤곽)만 남긴 뒤            ← 안쪽 링(접는선)은 부분집합이라 무시
//       ③ 귀 자르기로 삼각분할하고                     earClip
//       ④ 인접 삼각형을 볼록하게 병합한다              mergeConvex (Hertel–Mehlhorn)
//     넷 중 하나라도 실패하거나 조각이 상한을 넘으면 **볼록껍질 → bbox** 로 내려간다.
//     내려간 사실은 반드시 화면에 뜬다 (mode/note) — 일부만 맞는 스냅을 정확한
//     스냅으로 오해하는 것이 폴백 자체보다 위험하다.
//
//  회전 규약
//  ────────
//  손배치가 다루는 자세는 3가지다: 0° / 0°+180°반전 / 90° (+반전).
//  180° 반전은 nest 의 N_op 가 이미 정확히 그 쌍이다. 90° 는 **부품을 따로 한 벌 더**
//  깔아서(preparePart(rot90(pieces))) 같은 방향끼리는 정확하게 판정한다.
//  ⚠ 0°×90° 처럼 **방향이 다른 쌍**은 볼록조각쌍 NFP 를 새로 깔지 않고 bbox NFP 로
//    보수적으로 막는다 (겹침을 놓치는 쪽이 아니라 **더 막는** 쪽으로 틀린다).
//    자동 배치는 판 하나에 한 방향만 쓰므로 실무에서 섞이는 일이 드물고, 섞였을 때
//    잘못 「안 겹친다」고 통과시키는 것보다 못 붙이는 편이 안전하다.
//
//  좌표계: SheetCanvas 의 판 좌표(mm, y **아래로**, 원점 = 판 좌상단).
//  배치 1개 = { x, y, flipped, rotated } 이고 x,y 는 **발자국 bbox 의 좌상단**이다
//  (layout.boxes 와 같은 규약 — 그래서 자동 배치를 그대로 씨앗으로 쓸 수 있다).
// ══════════════════════════════════════════════════════════════════
import {
  preparePart, overlaps, minkowski, strictlyInside, lineInsideInterval,
  firstFree, bboxOf, hull, canonicalize, rot90,
} from "../../nest.mjs";

/** 스냅 반경(화면 px). mm 로 환산할 때 scale 로 나눈다 — 판이 작게 그려졌을 때
 *  6mm 스냅은 2px 라 손가락으로 못 맞춘다. 화면 거리로 잡아야 감이 일정하다. */
export const SNAP_PX = 9;
/** 스냅 반경 mm 하한/상한. 작게 그린 판에서 무한정 커지지 않게 자른다. */
const SNAP_MM_MIN = 3, SNAP_MM_MAX = 16;
/** 볼록 조각 상한. 넘으면 폴백한다 — overlaps 는 조각쌍 n² 을 도므로 n 이 커지면
 *  드래그 한 프레임이 수백 ms 가 된다. 실측(t-sosco/t-wake2/t-ishap)은 아래 참조. */
export const MAX_PIECES = 48;
/** 삼각분할 전 링 정점 상한. 귀 자르기가 O(n³) 이라 여기서 잘라야 한다. */
const RING_MAX = 300;

const EPS = 1e-9;
const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
const area2 = p => {
  let s = 0;
  for (let i = 0; i < p.length; i++) { const a = p[i], b = p[(i + 1) % p.length]; s += a[0] * b[1] - b[0] * a[1]; }
  return s;
};
const rectPoly = (w, h) => [[0, 0], [w, 0], [w, h], [0, h]];

// ══════════════════════════════════════════════════════════════════
//  ① 폴리라인 → 닫힌 링 (스티칭)
// ══════════════════════════════════════════════════════════════════

/**
 * 끝점이 맞닿는 폴리라인들을 이어 붙여 닫힌 링을 만든다.
 *
 * PDF 칼선은 한 윤곽이 여러 폴리라인으로 쪼개져 나온다(실측: 소스코 8조각 중
 * 2/2/6/17/2/2/2/9 점). 그래서 이어 붙이지 않으면 「면」이 하나도 없다.
 * 격자 해시 + 3×3 이웃 조회 — 좌표가 0.01mm 로 반올림돼 오므로 exact 매칭이
 * 대부분 맞지만, 격자 경계에 걸린 점 하나가 링 전체를 못 닫게 만들면 폴백으로
 * 떨어지므로 이웃까지 본다.
 *
 * ⚠ T 자 접합(접는선이 칼선에 붙은 자리)에서는 어느 가지로 갈지 정보가 없다.
 *   여기서는 **먼저 찾은 미사용 가지**로 간다 — 틀리면 링이 안 닫히거나 작게
 *   닫히고, 그 경우 아래 decomposePolylines 의 bbox 검사가 폴백으로 보낸다.
 *   추측으로 만든 도형을 조용히 쓰지 않는 것이 요점이다.
 */
export function stitchRings(polylines, eps = 0.08) {
  const chains = (polylines || []).filter(p => p && p.length >= 2).map(p => p.slice());
  const G = 1 / eps;
  const map = new Map();
  const add = (x, y, v) => {
    const k = `${Math.round(x * G)},${Math.round(y * G)}`;
    const a = map.get(k); if (a) a.push(v); else map.set(k, [v]);
  };
  chains.forEach((c, i) => { add(c[0][0], c[0][1], { i, end: 0 }); add(c[c.length - 1][0], c[c.length - 1][1], { i, end: 1 }); });
  const near = (x, y) => {
    const gx = Math.round(x * G), gy = Math.round(y * G), out = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
      const a = map.get(`${gx + dx},${gy + dy}`); if (a) out.push(...a);
    }
    return out;
  };
  const same = (a, b) => Math.abs(a[0] - b[0]) <= eps && Math.abs(a[1] - b[1]) <= eps;

  const used = new Array(chains.length).fill(false);
  const rings = [], opens = [];
  for (let i = 0; i < chains.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    let pts = chains[i].slice();
    let closed = pts.length >= 4 && same(pts[0], pts[pts.length - 1]);
    let guard = 0;
    while (!closed && guard++ <= chains.length) {
      const tail = pts[pts.length - 1];
      let hit = null;
      for (const c of near(tail[0], tail[1])) {
        if (used[c.i]) continue;
        const q = chains[c.i];
        if (!same(tail, c.end === 0 ? q[0] : q[q.length - 1])) continue;
        hit = c; break;
      }
      if (!hit) break;
      used[hit.i] = true;
      const q = hit.end === 0 ? chains[hit.i] : chains[hit.i].slice().reverse();
      pts = pts.concat(q.slice(1));
      closed = same(pts[0], pts[pts.length - 1]);
    }
    if (closed) { pts.pop(); if (pts.length >= 3) rings.push(pts); }
    else opens.push(pts);
  }
  return { rings, opens };
}

// ══════════════════════════════════════════════════════════════════
//  ② 링 정리 — 중복·공선 정점 제거
// ══════════════════════════════════════════════════════════════════

/** 베지어 분할(BEZ_STEPS=8)이 만든 촘촘한 점을 걷어낸다. tol 은 **점→현 수직거리**라
 *  도형이 tol 이상 줄지 않는다. 0.03mm 는 칼선 실측 오차(0.0~0.04mm)보다 작다. */
function dropCollinear(ring, tol) {
  let out = [];
  for (const p of ring) {                              // 중복점
    const q = out[out.length - 1];
    if (q && Math.abs(q[0] - p[0]) < tol && Math.abs(q[1] - p[1]) < tol) continue;
    out.push([p[0], p[1]]);
  }
  while (out.length > 3 && Math.abs(out[0][0] - out[out.length - 1][0]) < tol
                        && Math.abs(out[0][1] - out[out.length - 1][1]) < tol) out.pop();
  let changed = true, guard = 0;
  while (changed && guard++ < 8 && out.length > 3) {
    changed = false;
    for (let k = 0; k < out.length && out.length > 3;) {
      const n = out.length;
      const p0 = out[(k - 1 + n) % n], p1 = out[k], p2 = out[(k + 1) % n];
      const ex = p2[0] - p0[0], ey = p2[1] - p0[1], L = Math.hypot(ex, ey);
      const d = L < 1e-9 ? Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
                         : Math.abs((p1[0] - p0[0]) * ey - (p1[1] - p0[1]) * ex) / L;
      if (d <= tol) { out.splice(k, 1); changed = true; } else k++;
    }
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════
//  ③ 귀 자르기 삼각분할  ④ 인접 삼각형 볼록 병합 (Hertel–Mehlhorn)
// ══════════════════════════════════════════════════════════════════

const inTriStrict = (p, a, b, c) => {
  const t = 1e-9, s1 = cr(a, b, p), s2 = cr(b, c, p), s3 = cr(c, a, p);
  return (s1 > t && s2 > t && s3 > t) || (s1 < -t && s2 < -t && s3 < -t);
};

/** 단순다각형 → 삼각형 인덱스 목록. 실패(자기교차·퇴화)면 null.
 *  자기교차 링을 조용히 삼각분할하면 **뒤집힌 조각**이 나와 NFP 가 틀린다 — 그래서
 *  귀를 하나도 못 자르는 순간 멈추고 null 을 돌려 폴백으로 보낸다. */
function earClip(pts) {
  const n = pts.length;
  if (n < 3) return null;
  let idx = Array.from({ length: n }, (_, i) => i);
  if (area2(pts) < 0) idx.reverse();                   // CCW 강제
  const tris = [];
  let guard = 0;
  while (idx.length > 3) {
    if (guard++ > n * n + 16) return null;
    const m = idx.length;
    let cut = -1;
    for (let i = 0; i < m; i++) {
      const ia = idx[(i - 1 + m) % m], ib = idx[i], ic = idx[(i + 1) % m];
      const a = pts[ia], b = pts[ib], c = pts[ic];
      if (cr(a, b, c) <= 1e-12) continue;              // 반사정점(또는 공선)
      let bad = false;
      for (let j = 0; j < m; j++) {
        const q = idx[j];
        if (q === ia || q === ib || q === ic) continue;
        if (inTriStrict(pts[q], a, b, c)) { bad = true; break; }
      }
      if (bad) continue;
      tris.push([ia, ib, ic]); cut = i; break;
    }
    if (cut < 0) return null;
    idx.splice(cut, 1);
  }
  tris.push([idx[0], idx[1], idx[2]]);
  return tris;
}

/** A 와 B 가 공유하는 에지(a→b in A, b→a in B)를 지우고 하나로 합친다.
 *  결과 = [a] + B(a 다음부터 b 까지) + A(b 다음부터 a 앞까지]. 정점 수 = |A|+|B|−2. */
function spliceOn(A, B, a, b) {
  const i = A.findIndex((v, k) => v === a && A[(k + 1) % A.length] === b);
  const j = B.findIndex((v, k) => v === b && B[(k + 1) % B.length] === a);
  if (i < 0 || j < 0) return null;
  const out = [a];
  for (let k = 1; k <= B.length - 1; k++) out.push(B[(j + 1 + k) % B.length]);
  for (let k = 1; k <= A.length - 2; k++) out.push(A[(i + 1 + k) % A.length]);
  return new Set(out).size === out.length ? out : null;   // 정점 중복 = 비단순 → 거부
}

const isConvexCCW = (pts, poly) => {
  if (poly.length < 3) return false;
  for (let i = 0; i < poly.length; i++) {
    const a = pts[poly[(i - 1 + poly.length) % poly.length]], b = pts[poly[i]], c = pts[poly[(i + 1) % poly.length]];
    if (cr(a, b, c) < -1e-9) return false;
  }
  return true;
};

/** 삼각형들을 인접 에지를 지워가며 볼록 다각형으로 합친다.
 *  합칠 때마다 인접표를 다시 만든다 — 낡은 표로 합치면 이미 사라진 면을 가리킨다. */
function mergeConvex(pts, tris) {
  let polys = tris.map(t => t.slice());
  let guard = 0;
  for (;;) {
    if (guard++ > polys.length * 4 + 64) break;
    const edge = new Map();
    polys.forEach((p, pi) => {
      for (let i = 0; i < p.length; i++) {
        const a = p[i], b = p[(i + 1) % p.length];
        const k = a < b ? `${a}|${b}` : `${b}|${a}`;
        const arr = edge.get(k); if (arr) arr.push({ pi, a, b }); else edge.set(k, [{ pi, a, b }]);
      }
    });
    let did = false;
    for (const list of edge.values()) {
      if (list.length !== 2) continue;
      const [u, v] = list;
      if (u.pi === v.pi) continue;
      const m = spliceOn(polys[u.pi], polys[v.pi], u.a, u.b);
      if (!m || !isConvexCCW(pts, m)) continue;
      polys[u.pi] = m;
      polys.splice(v.pi, 1);
      did = true; break;
    }
    if (!did) break;
  }
  return polys;
}

/** 링 하나를 볼록 조각들로. 실패하면 null. */
function ringToPieces(ring, maxPieces) {
  const tris = earClip(ring);
  if (!tris) return null;
  const pieces = mergeConvex(ring, tris).map(p => canonicalize(p.map(i => ring[i]))).filter(Boolean);
  if (!pieces.length || pieces.length > maxPieces) return null;
  return pieces;
}

// ── 래스터 경로 ────────────────────────────────────────────────────
//  왜 이게 필요한가 — **실측 3건이 전부 스티칭으로 안 닫힌다.**
//    소스코   : 끝점이 1.7mm 어긋난다 (338.70,58) vs (337.00,58). 끝점 차수 {1:13, 2:2, 3:1}
//    웨이크버니: T 접합 8곳 (접는선이 칼선에 붙어 있어 어느 가지인지 정보가 없다)
//    iSHAP   : 176개가 **전부 닫힌 경로**다 — 선이 굵기 윤곽으로 벡터화돼 있다
//  세 실패 양상이 서로 다르고, 전부 "끝점 위상"으로는 못 푼다. 그래서 위상을 버리고
//  **면**으로 간다: 선을 격자에 굽고 → 바깥에서 물을 채우고 → 안 잠긴 곳이 전개도다.
//  틈은 벽을 1칸 부풀려 막는다(2×cell 까지). 그만큼 도형이 커지므로 다시 1칸 깎는다.
/** RDP 단순화 (닫힌 링). tol 은 mm. */
function rdpRing(ring, tol) {
  if (ring.length < 5) return ring;
  const seg = (pts, i, j, out) => {
    let far = -1, d = tol;
    const a = pts[i], b = pts[j], ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey);
    for (let k = i + 1; k < j; k++) {
      const p = pts[k];
      const dd = L < 1e-9 ? Math.hypot(p[0] - a[0], p[1] - a[1])
                          : Math.abs((p[0] - a[0]) * ey - (p[1] - a[1]) * ex) / L;
      if (dd > d) { d = dd; far = k; }
    }
    if (far < 0) { out.push(pts[j]); return; }
    seg(pts, i, far, out); seg(pts, far, j, out);
  };
  // 닫힌 링은 시작점이 임의라 두 극점으로 갈라 각각 단순화한다
  let fi = 0, fd = -1;
  for (let k = 1; k < ring.length; k++) {
    const d = Math.hypot(ring[k][0] - ring[0][0], ring[k][1] - ring[0][1]);
    if (d > fd) { fd = d; fi = k; }
  }
  const out = [ring[0]];
  seg(ring, 0, fi, out);
  const tail = ring.slice(fi).concat([ring[0]]);
  const out2 = [];
  seg(tail, 0, tail.length - 1, out2);
  const res = out.concat(out2);
  res.pop();                                     // 마지막은 시작점과 같다
  return res.length >= 3 ? res : ring;
}

function rasterDecompose(polylines, bb, maxPieces) {
  const md = Math.max(bb.w, bb.h);
  for (const cell of [Math.min(2, Math.max(0.8, md / 300)), Math.min(3, Math.max(1.6, md / 150))]) {
    const M = 2;                                                   // 바깥 여백 칸
    const nx = Math.ceil(bb.w / cell) + 2 * M, ny = Math.ceil(bb.h / cell) + 2 * M;
    if (nx * ny > 1_200_000) continue;
    const gi = (x, y) => y * nx + x;
    const wall = new Uint8Array(nx * ny);
    const put = (mx, my) => {
      const x = Math.round(mx / cell) + M, y = Math.round(my / cell) + M;
      if (x >= 0 && x < nx && y >= 0 && y < ny) wall[gi(x, y)] = 1;
    };
    for (const p of polylines) {
      for (let k = 0; k + 1 < p.length; k++) {
        const [x0, y0] = p[k], [x1, y1] = p[k + 1];
        const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (cell * 0.5)));
        for (let t = 0; t <= n; t++) put(x0 + (x1 - x0) * t / n, y0 + (y1 - y0) * t / n);
      }
      if (p.length === 1) put(p[0][0], p[0][1]);
    }
    // 벽 1칸 부풀리기 — 끝점이 안 맞는 칼선의 틈을 막는다 (2×cell 까지)
    const wd = new Uint8Array(wall);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      if (!wall[gi(x, y)]) continue;
      if (x) wd[gi(x - 1, y)] = 1; if (x + 1 < nx) wd[gi(x + 1, y)] = 1;
      if (y) wd[gi(x, y - 1)] = 1; if (y + 1 < ny) wd[gi(x, y + 1)] = 1;
    }
    // 바깥에서 물 채우기 (4이웃)
    const out = new Uint8Array(nx * ny);
    const st = [0];
    out[0] = 1;
    while (st.length) {
      const c = st.pop(), x = c % nx, y = (c - x) / nx;
      const push = (a, b) => { const k = gi(a, b); if (!out[k] && !wd[k]) { out[k] = 1; st.push(k); } };
      if (x) push(x - 1, y); if (x + 1 < nx) push(x + 1, y);
      if (y) push(x, y - 1); if (y + 1 < ny) push(x, y + 1);
    }
    // 안쪽 = 안 잠긴 칸. 벽을 부풀린 만큼 1칸 깎아 원래 크기로 되돌린다.
    const inA = new Uint8Array(nx * ny);
    for (let i = 0; i < inA.length; i++) inA[i] = out[i] ? 0 : 1;
    const inB = new Uint8Array(inA);
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      if (!inA[gi(x, y)]) continue;
      if (!x || !y || x + 1 >= nx || y + 1 >= ny ||
          !inA[gi(x - 1, y)] || !inA[gi(x + 1, y)] || !inA[gi(x, y - 1)] || !inA[gi(x, y + 1)]) inB[gi(x, y)] = 0;
    }
    let cnt = 0; for (const v of inB) if (v) cnt++;
    if (cnt * cell * cell < bb.w * bb.h * 0.12) continue;           // 물이 새어 들어갔다

    // 안쪽 칸 경계에지 → 닫힌 윤곽. 면적 최대 = 바깥 윤곽 (안쪽 구멍은 무시 = 보수적)
    const emap = new Map();
    const key = (a, b) => `${a},${b}`;
    const push = (ax, ay, bx, by) => { emap.set(key(ax, ay), [bx, by]); };
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      if (!inB[gi(x, y)]) continue;
      if (!y || !inB[gi(x, y - 1)]) push(x, y, x + 1, y);
      if (x + 1 >= nx || !inB[gi(x + 1, y)]) push(x + 1, y, x + 1, y + 1);
      if (y + 1 >= ny || !inB[gi(x, y + 1)]) push(x + 1, y + 1, x, y + 1);
      if (!x || !inB[gi(x - 1, y)]) push(x, y + 1, x, y);
    }
    let outer = null, aBest = 0;
    const seen = new Set();
    for (const start of emap.keys()) {
      if (seen.has(start)) continue;
      const loop = [];
      let k = start, guard = 0;
      while (emap.has(k) && !seen.has(k) && guard++ < emap.size + 2) {
        seen.add(k);
        const [bx, by] = emap.get(k);
        loop.push([bx, by]);
        k = key(bx, by);
      }
      if (loop.length < 4) continue;
      const a = Math.abs(area2(loop)) / 2;
      if (a > aBest) { aBest = a; outer = loop; }
    }
    if (!outer) continue;

    const mm = outer.map(([x, y]) => [(x - M) * cell, (y - M) * cell]);
    for (const tol of [cell * 0.9, cell * 1.8, cell * 3.5]) {
      let ring = dropCollinear(rdpRing(mm, tol), 0.02);
      if (ring.length > RING_MAX) continue;
      const pieces = ringToPieces(ring, maxPieces);
      if (pieces) return { pieces, cell, verts: ring.length };
    }
  }
  return null;
}

/**
 * PDF 폴리라인 묶음 → 볼록 조각 목록.
 *  ① 끝점 스티칭 (성공하면 좌표 그대로라 가장 정확하다)
 *  ② 실패하면 래스터 윤곽 (실측 3건이 전부 여기로 온다)
 * @returns {{pieces:(number[][][]|null), mode:string, why:string, cell?:number}}
 */
export function decomposePolylines(polylines, bb, maxPieces = MAX_PIECES) {
  let why = "";
  const { rings } = stitchRings(polylines);
  if (!rings.length) why = "끝점이 이어지는 닫힌 윤곽이 없다";
  else {
    let outer = null, aMax = 0;
    for (const r of rings) { const a = Math.abs(area2(r)) / 2; if (a > aMax) { aMax = a; outer = r; } }
    const rb = bboxOf([outer]);
    if (rb.w < bb.w - 0.6 || rb.h < bb.h - 0.6)
      why = `닫힌 윤곽 ${rb.w.toFixed(1)}×${rb.h.toFixed(1)} 가 칼선 bbox ${bb.w}×${bb.h} 를 못 덮는다`;
    else {
      let ring = dropCollinear(outer, 0.03);
      for (let t = 0.08; ring.length > RING_MAX && t <= 4; t *= 2) ring = dropCollinear(ring, t);
      const pieces = ring.length <= RING_MAX ? ringToPieces(ring, maxPieces) : null;
      if (pieces) return { pieces, mode: "stitched", why: "" };
      why = `윤곽 ${ring.length}정점을 볼록 ${maxPieces}조각 이하로 못 나눴다`;
    }
  }
  const r = rasterDecompose(polylines, bb, maxPieces);
  if (r) return { pieces: r.pieces, mode: "raster", why: "", cell: r.cell, verts: r.verts };
  return { pieces: null, mode: "hull", why: `${why}; 래스터 윤곽도 실패` };
}

// ══════════════════════════════════════════════════════════════════
//  부품 만들기
// ══════════════════════════════════════════════════════════════════

/**
 * 손배치가 쓸 부품 한 벌. 0° / 90° 두 자세를 미리 깔아 둔다.
 *
 * @param {{pieces?:number[][][], polylines?:number[][][], w:number, h:number}} src
 *        pieces  = 이미 볼록 (구조 전개도) — 그대로 쓴다
 *        polylines = PDF 폴리라인 (판 좌표 기준 로컬, y 아래로) — 분해한다
 * @returns {{base,rot,w,h,pieces,mode,note,nfpCross}|null}
 *        mode: "exact"(구조 폴리곤) / "stitched"(PDF 분해 성공) / "hull" / "bbox"
 */
export function makeDragPart(src) {
  const w = +src?.w, h = +src?.h;
  if (!(w > 0 && h > 0)) return null;

  let pieces = null, mode = "bbox", why = "", cell = 0;
  if (src.pieces?.length) { pieces = src.pieces; mode = "exact"; }
  else if (src.polylines?.length) {
    const r = decomposePolylines(src.polylines, { w, h });
    if (r.pieces) { pieces = r.pieces; mode = r.mode; cell = r.cell || 0; }
    else {
      why = r.why;
      const pts = [];
      for (const p of src.polylines) for (const q of p) pts.push(q);
      const hl = canonicalize(hull(pts));
      if (hl) { pieces = [hl]; mode = "hull"; }
    }
  }
  if (!pieces?.length) { pieces = [rectPoly(w, h)]; mode = mode === "exact" ? "exact" : "bbox"; }

  const base = preparePart(pieces);
  if (!base) return null;
  // 분해가 bbox 를 못 채우면 그림(bbox 칸)과 충돌 도형이 어긋난다 → bbox 로 내린다.
  if (Math.abs(base.netW - w) > 0.6 || Math.abs(base.netH - h) > 0.6) {
    why = why || `분해 결과 ${base.netW.toFixed(1)}×${base.netH.toFixed(1)} 가 칼선 ${w}×${h} 와 다르다`;
    pieces = [rectPoly(w, h)]; mode = "bbox";
  }
  const P = {
    base: mode === "bbox" ? preparePart(pieces) : base,
    rot: preparePart(rot90(pieces)),
    w, h, pieces, mode,
    // 방향이 다른 쌍(0°×90°)용 bbox NFP. 첫째=고정, 둘째=이동 (nest 의 부호 규약).
    nfpCross: [minkowski(rectPoly(w, h), rectPoly(h, w), -1),
               minkowski(rectPoly(h, w), rectPoly(w, h), -1)],
    // 폴백은 **반드시 화면에 뜬다.** 일부만 맞는 스냅을 정확한 스냅으로 오해하는 것이
    // 폴백 자체보다 위험하다 (SheetCanvas 범례가 이 문자열을 그대로 찍는다).
    note: mode === "exact" || mode === "stitched" ? null
        : mode === "raster" ? `칼선 끝점이 안 이어져 격자 ${cell.toFixed(2)}mm 윤곽으로 근사했다 — 접촉 정밀도 ±${cell.toFixed(1)}mm.`
        : mode === "hull" ? `⚠ 칼선 폴리곤을 볼록 분해하지 못해 **볼록껍질**로 스냅한다 — ${why}. 오목한 틈(맞물림)은 못 파고든다.`
        : `⚠ 칼선 폴리곤을 볼록 분해하지 못해 **bbox 사각형**으로 스냅한다 — ${why}. 맞물림 없이 칼선 공유만 된다.`,
  };
  P.pieceCount = P.base.pieces.length;
  return P;
}

/**
 * PDF 후보 하나(pdfPickOf 가 준 것)의 polygons 를 **판 좌표계로 옮긴다**.
 * PDF 는 페이지 절대좌표(mm, y 위로)이고 판은 로컬(0..w, y 아래로)이다 —
 * SheetCanvas 가 SVG 에 거는 `translate(-x0, y0+h) scale(1,-1)` 와 **같은 식**이다.
 * 두 곳이 갈리면 그림과 충돌 도형이 어긋나므로 식은 여기 한 곳에 둔다.
 */
export function pdfLocalPolylines(pick) {
  const b = pick?.bbox;
  if (!b || !(pick.polygons?.length)) return null;
  const ox = b.x0 ?? 0, oy = (b.y0 ?? 0) + b.h;
  return pick.polygons.map(p => p.map(([x, y]) => [x - ox, oy - y]));
}

export const itemW = (P, it) => (it.rotated ? P.h : P.w);
export const itemH = (P, it) => (it.rotated ? P.w : P.h);

/** 배치 1개의 조각들을 **판 좌표**로. 그림에는 쓰지 않는다(그림은 SVG transform) —
 *  겹침 샘플링 검증과 스냅 디버깅이 쓴다. */
export function placedPieces(P, it) {
  const part = it.rotated ? P.rot : P.base;
  const src = it.flipped ? part.flipped : part.pieces;
  return src.map(p => p.map(([x, y]) => [x + it.x, y + it.y]));
}

// ══════════════════════════════════════════════════════════════════
//  겹침 판정 — nest 의 NFP 를 그대로
// ══════════════════════════════════════════════════════════════════

/** 고정 a 에 대해 이동 b 를 판정할 때 쓸 NFP 집합과 이동벡터 부호.
 *  부호 규약은 nest.verifyNoOverlap 과 **똑같다**: t = b.pos − a.pos 이고
 *  「a 가 반전, b 가 정방향」일 때만 −t 로 뒤집는다. */
function nfpSetOf(P, a, b) {
  if (!!a.rotated === !!b.rotated) {
    const part = a.rotated ? P.rot : P.base;
    if (!!a.flipped === !!b.flipped) return { set: part.N_same, sg: 1 };
    return { set: part.N_op, sg: a.flipped ? -1 : 1 };
  }
  return { set: [P.nfpCross[a.rotated ? 1 : 0]], sg: 1 };   // 방향 다름 → bbox 로 보수적
}

/** 두 배치가 겹치는가 (닿음은 겹침이 아니다 — strictlyInside 시맨틱). */
export function pairOverlaps(P, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  // bbox 프리필터 — 대부분 즉시 기각 (nest.verifyNoOverlap 과 같은 수법)
  if (dx >= itemW(P, a) - 1e-7 || -dx >= itemW(P, b) - 1e-7) return false;
  if (dy >= itemH(P, a) - 1e-7 || -dy >= itemH(P, b) - 1e-7) return false;
  if (!!a.rotated === !!b.rotated) {
    const part = a.rotated ? P.rot : P.base;
    if (!!a.flipped === !!b.flipped) return overlaps(part, [dx, dy], true);
    if (!a.flipped) return overlaps(part, [dx, dy], false);
    return overlaps(part, [-dx, -dy], false);
  }
  return strictlyInside(P.nfpCross[a.rotated ? 1 : 0], [dx, dy]);
}

/** it 가 others 전부와 안 겹치는가 */
export const freeAt = (P, it, others) => !others.some(o => pairOverlaps(P, o, it));

/** 배치 전체의 겹치는 쌍 인덱스 (화면 빨간 표시용) */
export function overlapPairs(P, items) {
  const bad = new Set();
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++)
      if (pairOverlaps(P, items[i], items[j])) { bad.add(i); bad.add(j); }
  return bad;
}

// ══════════════════════════════════════════════════════════════════
//  스냅 — 「대충 끌면 딱 닿는 자리로」
// ══════════════════════════════════════════════════════════════════

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
  .map(([x, y]) => { const L = Math.hypot(x, y); return [x / L, y / L]; });

/** v 방향 직선 위에서 「겹치는 s 구간」들. 접점(구간 끝)이 곧 딱 닿는 자리다. */
function forbiddenAlong(P, from, moving, others, v) {
  const ivs = [];
  for (const o of others) {
    const { set, sg } = nfpSetOf(P, o, moving);
    const ov = [sg * (from[0] - o.x), sg * (from[1] - o.y)];
    const vv = [sg * v[0], sg * v[1]];
    for (const N of set) {
      const iv = lineInsideInterval(N, ov, vv);
      if (iv && Number.isFinite(iv[0]) && Number.isFinite(iv[1])) ivs.push(iv);
    }
  }
  return ivs;
}

const axisSnap = (v, targets, snap) => {
  let best = v, d = snap;
  for (const t of targets) { const e = Math.abs(v - t); if (e < d) { d = e; best = t; } }
  return best;
};

/**
 * 놓으려는 자리를 확정한다. 이 함수가 3단계의 **핵심 가치**다.
 *
 *  ① 판 가장자리·물림선·이웃 모서리에 축별로 붙인다 (예측 가능한 큰 스냅)
 *  ② NFP 접점으로 흡착 — 8방향 직선이 NFP 경계를 뚫는 지점이 「딱 닿는 자리」다.
 *     자유롭게 떠 있어도 스냅 반경 안에 접점이 있으면 붙인다.
 *  ③ 겹쳐 있으면 firstFree 로 밀어낸다. 밀어낼 거리가 pushMax 를 넘으면
 *     **놓을 수 없다(ok:false)** — 화면이 빨갛게 되고 드롭이 취소된다.
 *
 * @returns {{x,y,ok,snapped,pushed}}
 */
export function resolveDrop(P, moving, others, opt = {}) {
  const snap = Math.min(SNAP_MM_MAX, Math.max(SNAP_MM_MIN, opt.snap ?? 8));
  const w = itemW(P, moving), h = itemH(P, moving);
  const pushMax = opt.pushMax ?? (snap + 0.35 * Math.min(w, h));
  const b = opt.bounds;

  // ① 축별 스냅 타깃
  const xs = [], ys = [];
  if (b) {
    xs.push(0, b.w - w); ys.push(0, b.h - h);
    if (b.biteX) xs.push(b.biteX);
    if (b.biteY) ys.push(b.biteY);
  }
  for (const o of others) {
    xs.push(o.x, o.x + itemW(P, o), o.x - w);
    ys.push(o.y, o.y + itemH(P, o), o.y - h);
  }
  const p0 = [moving.x, moving.y];
  let p = [axisSnap(p0[0], xs, snap), axisSnap(p0[1], ys, snap)];
  const edgeSnapped = p[0] !== p0[0] || p[1] !== p0[1];

  // ⚠ 사정거리 밖 이웃은 통째로 뺀다. 안 빼면 30개 앉힌 판에서 한 프레임이
  //   30 × 조각쌍(최대 48²) × 8방향 = 55만 번이라 드래그가 멈춘다.
  //   pushMax 만큼 부풀린 사각형이라 **후보 위치 전 범위**를 덮는다 → 판정은 그대로 정확하다.
  const reach = others.filter(o =>
    p[0] < o.x + itemW(P, o) + pushMax + 1e-6 && o.x < p[0] + w + pushMax + 1e-6 &&
    p[1] < o.y + itemH(P, o) + pushMax + 1e-6 && o.y < p[1] + h + pushMax + 1e-6);

  const at = (x, y) => ({ ...moving, x, y });
  const free0 = freeAt(P, at(p[0], p[1]), reach);
  const R = free0 ? snap : pushMax;

  // ② / ③ NFP 접점 후보
  let best = null;
  for (const v of DIRS) {
    const ivs = forbiddenAlong(P, p, moving, reach, v);
    if (!ivs.length) continue;
    const cand = [];
    for (const [lo, hi] of ivs) { cand.push(lo, hi); }
    if (!free0) { const f = firstFree(ivs, 0); if (f > 0) cand.push(f); }
    for (const s of cand) {
      const d = Math.abs(s);
      if (d < 1e-6 || d > R || (best && d >= best[2])) continue;
      const x = p[0] + s * v[0], y = p[1] + s * v[1];
      if (!freeAt(P, at(x, y), reach)) continue;
      best = [x, y, d];
    }
  }

  if (free0) {
    if (best) return { x: best[0], y: best[1], ok: true, snapped: true, pushed: false };
    return { x: p[0], y: p[1], ok: true, snapped: edgeSnapped, pushed: false };
  }
  if (best) return { x: best[0], y: best[1], ok: true, snapped: true, pushed: true };
  return { x: p[0], y: p[1], ok: false, snapped: false, pushed: false };
}

/** 새 도형을 앉힐 빈자리. 이웃 오른쪽·아래를 먼저 보고(칼선 공유가 최선이라),
 *  없으면 격자를 훑는다. 못 찾으면 null — 아무 데나 겹쳐 놓지 않는다. */
export function findSpot(P, proto, others, bounds, seed) {
  const w = itemW(P, proto), h = itemH(P, proto);
  const cand = [];
  if (seed) cand.push([seed.x, seed.y]);
  for (const o of others) cand.push([o.x + itemW(P, o), o.y], [o.x, o.y + itemH(P, o)]);
  cand.push([bounds.biteX || 0, bounds.biteY || 0], [0, 0]);
  const gx = Math.max(2, w / 3), gy = Math.max(2, h / 3);
  for (let y = 0; y <= bounds.h - h + 1e-6; y += gy)
    for (let x = 0; x <= bounds.w - w + 1e-6; x += gx) cand.push([x, y]);
  for (const [x, y] of cand) {
    if (x < -1e-6 || y < -1e-6 || x + w > bounds.w + 1e-6 || y + h > bounds.h + 1e-6) continue;
    const it = { ...proto, x, y };
    if (freeAt(P, it, others)) return { x, y };
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════
//  판 경계 / 물림 경고
// ══════════════════════════════════════════════════════════════════

/**
 * 판 밖으로 나갔거나 물림 띠를 침범한 배치 인덱스.
 * ⚠ **자동 배치에는 절대 쓰지 마라.** imposition.printableArea 는 물림을 빼지 않고
 *   (ARCHITECTURE §5), 자동 배치가 띠를 덮는다고 경고하면 화면이 폐기된 방침을 다시
 *   주장하게 된다. 여기 경고는 **사람이 직접 앉힌 배치**에만 붙는 작업자용 표시다.
 */
export function boundsCheck(P, items, bounds) {
  const off = [], bite = [];
  items.forEach((it, i) => {
    const w = itemW(P, it), h = itemH(P, it);
    if (it.x < -1e-6 || it.y < -1e-6 || it.x + w > bounds.w + 1e-6 || it.y + h > bounds.h + 1e-6) off.push(i);
    else if (it.x < (bounds.biteX || 0) - 1e-6 || it.y < (bounds.biteY || 0) - 1e-6) bite.push(i);
  });
  return { off, bite };
}

// ══════════════════════════════════════════════════════════════════
//  겹침 0 독립 검증 — **NFP 를 쓰지 않는다**
// ══════════════════════════════════════════════════════════════════
//  NFP 결과를 NFP 로 확인하면 아무 의미가 없다 (verify-nest.mjs 머리말과 같은 철학).
//  그래서 점-삼각형 판정으로 격자를 훑어 겹침 **면적**을 직접 잰다.
//  경계 접촉은 면적 0 이므로 "닿음은 통과, 겹침은 검출" 시맨틱과 정확히 일치한다.

const inTriCl = (p, a, b, c) => {
  const s1 = cr(a, b, p), s2 = cr(b, c, p), s3 = cr(c, a, p);
  return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0);
};
const inConvex = (p, poly) => {
  for (let i = 1; i + 1 < poly.length; i++) if (inTriCl(p, poly[0], poly[i], poly[i + 1])) return true;
  return false;
};
const inPieces = (p, ps) => ps.some(q => inConvex(p, q));

export function overlapAreaSampled(A, B, step = 0.5) {
  const ba = bboxOf(A), bb = bboxOf(B);
  const x0 = Math.max(ba.x0, bb.x0), x1 = Math.min(ba.x1, bb.x1);
  const y0 = Math.max(ba.y0, bb.y0), y1 = Math.min(ba.y1, bb.y1);
  if (x1 <= x0 || y1 <= y0) return 0;
  let n = 0;
  for (let x = x0 + step / 2; x < x1; x += step)
    for (let y = y0 + step / 2; y < y1; y += step)
      if (inPieces([x, y], A) && inPieces([x, y], B)) n++;
  return n * step * step;
}

/** 앉힌 배치 전체를 샘플링으로 감사한다. worst 가 0 이어야 한다. */
export function auditPlacement(P, items, step = 0.5) {
  const cache = items.map(it => placedPieces(P, it));
  let worst = 0, total = 0, pairs = 0, worstPair = null;
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) {
      pairs++;
      const v = overlapAreaSampled(cache[i], cache[j], step);
      total += v;
      if (v > worst) { worst = v; worstPair = [i, j]; }
    }
  return { pairs, worst: +worst.toFixed(4), total: +total.toFixed(4), worstPair, step, n: items.length };
}

// ══════════════════════════════════════════════════════════════════
//  저장 / 불러오기 (목형 재사용)
// ══════════════════════════════════════════════════════════════════

export const PLACEMENT_FORMAT = "cria-quote/placement@1";

export function serializePlacement(items, meta = {}) {
  return JSON.stringify({
    format: PLACEMENT_FORMAT,
    savedAt: new Date().toISOString(),
    sheet: meta.sheet ?? null,          // { id, label, w, h } — 다른 판에 붙일 때 경고용
    part: meta.part ?? null,            // { w, h, mode, source }
    items: items.map(it => ({ x: +it.x.toFixed(3), y: +it.y.toFixed(3),
                              flipped: !!it.flipped, rotated: !!it.rotated })),
  }, null, 1);
}

/** 파싱은 **던지지 않는다** — 화면이 이유를 그대로 보여줘야 하므로 문자열로 돌려준다. */
export function parsePlacement(text) {
  let j;
  try { j = JSON.parse(text); } catch (e) { return { error: `JSON 이 아니다 — ${e.message}` }; }
  if (!j || typeof j !== "object") return { error: "객체가 아니다" };
  if (j.format !== PLACEMENT_FORMAT) return { error: `형식이 다르다 (${j.format ?? "없음"})` };
  if (!Array.isArray(j.items)) return { error: "items 배열이 없다" };
  const items = [];
  for (const it of j.items) {
    const x = Number(it?.x), y = Number(it?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return { error: "x/y 가 숫자가 아닌 항목이 있다" };
    items.push({ x, y, flipped: !!it.flipped, rotated: !!it.rotated });
  }
  return { items, sheet: j.sheet ?? null, part: j.part ?? null };
}

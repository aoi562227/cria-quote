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
//  겹침 판정은 **한 줄도 여기 없다.** nest.mjs 의 「자세 계층」을 그대로 쓴다
//  (makePart / nfpSetOf / pairOverlaps / freeAt / forbiddenAlong / placedPieces).
//  솔버·손배치·자유배치가 다른 겹침 기준을 쓰면 「자동은 되는데 손으로는 안 되는」
//  자리가 생기고, 그때 틀린 쪽이 목형을 깬다.
//  이 파일이 실제로 소유하는 것은 **PDF 폴리라인 → 볼록 조각** 변환과 스냅뿐이다.
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
//  깔아서(nest.makePart 가 rot90 으로 깐다) 같은 방향끼리는 정확하게 판정한다.
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
  firstFree, bboxOf, hull, canonicalize,
  makePart, itemW, itemH, pairOverlaps, freeAt, forbiddenAlong, placedPieces,
} from "../../nest.mjs";
// 자세·겹침 판정은 **엔진이 소유한다** (nest.mjs 「자세 계층」). 여기서 다시 짜지 않고
// 그대로 내보낸다 — 솔버·손배치·자유배치가 같은 한 벌을 써야 「자동은 되는데 손으로는
// 안 되는」 자리가 안 생긴다. 종전엔 이 파일이 같은 함수를 복제해 갖고 있었다.
export { itemW, itemH, pairOverlaps, freeAt, placedPieces };

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

/** 단순다각형 → 삼각형 인덱스 목록. 실패(자기교차)면 null.
 *  자기교차 링을 조용히 삼각분할하면 **뒤집힌 조각**이 나와 NFP 가 틀린다 — 그래서
 *  진짜로 막히면 null 을 돌려 폴백으로 보낸다.
 *
 *  ★ 「귀를 못 자르면 곧 실패」는 **틀렸다** (26-08-16 계측으로 잡았다).
 *    귀 자르기는 마지막에 **면적 0 짜리 공선 잔여물**을 남기는 것이 정상이다. 종전 코드는
 *    그 정상 종료를 null 로 읽어 폴백시켰다. 빗·계단 모양 — 즉 **날개가 여럿인 전개도** —
 *    가 정확히 그 모양이라 실무 도형이 통째로 걸렸다:
 *      빗 3날(14정점)   → 잔여 6정점이 전부 y=10 위 (cr 전부 0.000) → null
 *      혀+날개(12정점)  → 잔여 4정점이 전부 y=70 위 (cr 전부 0.000) → null
 *    둘 다 잔여 면적이 **정확히 0** 이고, 실제 면적은 이미 자른 귀들이 전부 갖고 있다.
 *    그래서 ① 잔여 면적 0 이면 정상 종료 ② 면적이 남았는데 볼록 귀가 없으면 공선 정점을
 *    하나 지우고 계속(면적 보존) ③ 둘 다 아니면 그때 null.
 *    ⚠ ① 이 도형을 줄이지 않는다는 것은 추론이 아니라 계측이다 —
 *      verify-drag-shape §C 가 격자 샘플링으로 「덜 덮었는가」를 직접 잰다. */
function earClip(pts) {
  const n = pts.length;
  if (n < 3) return null;
  let idx = Array.from({ length: n }, (_, i) => i);
  if (area2(pts) < 0) idx.reverse();                   // CCW 강제
  const tris = [];
  const ok3 = t => Math.abs(cr(pts[t[0]], pts[t[1]], pts[t[2]])) > 1e-12;  // 퇴화 삼각형 배제
  let guard = 0;
  while (idx.length > 3) {
    if (guard++ > 2 * n * n + 16) return null;
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
    if (cut >= 0) { idx.splice(cut, 1); continue; }

    // ① 잔여물의 면적이 0 = 자를 것이 남지 않았다. 버려도 도형이 줄지 않는다.
    if (Math.abs(area2(idx.map(i => pts[i]))) <= 1e-7) return tris.length ? tris : null;
    // ② 면적이 남았다 = 공선 정점이 귀를 막고 있다. 하나 지운다 — 공선 정점 제거는
    //    면적을 보존하므로 이 단계도 도형을 줄이지 않는다.
    let k = -1;
    for (let i = 0; i < m; i++) {
      const a = pts[idx[(i - 1 + m) % m]], b = pts[idx[i]], c = pts[idx[(i + 1) % m]];
      if (Math.abs(cr(a, b, c)) <= 1e-9) { k = i; break; }
    }
    if (k < 0) return null;                            // ③ 진짜로 막혔다 (자기교차)
    idx.splice(k, 1);
  }
  const last = [idx[0], idx[1], idx[2]];
  if (ok3(last)) tris.push(last);                      // 마지막 삼각형도 퇴화면 버린다
  return tris.length ? tris : null;
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

/** 링 하나를 볼록 조각들로. 실패하면 null.
 *  export 인 이유: 「오목 링을 볼록으로 쪼갤 때 **면적을 잃지 않는가**」가 이 파일에서
 *  가장 조용히 틀릴 수 있는 자리다(귀 자르기가 귀를 하나 빼먹어도 조각은 나온다).
 *  verify-drag-shape §C 가 격자 샘플링으로 그걸 직접 잰다 — NFP 도 이 파일의 겹침
 *  판정도 쓰지 않는 **독립** 계측이라, 재려면 이 함수가 밖에서 보여야 한다. */
export function ringToPieces(ring, maxPieces = MAX_PIECES) {
  const tris = earClip(ring);
  if (!tris) return null;
  const pieces = mergeConvex(ring, tris).map(p => canonicalize(p.map(i => ring[i]))).filter(Boolean);
  if (!pieces.length || pieces.length > maxPieces) return null;
  return pieces;
}

// ── 래스터 경로 ────────────────────────────────────────────────────
//  왜 이게 필요한가 — **실측 3건이 전부 스티칭으로 안 닫힌다.**
//    소스코   : 끝점 차수 {1:13, 2:2, 3:1} — 열린 끝이 13개다
//    웨이크버니: T 접합 8곳 (접는선이 칼선에 붙어 있어 어느 가지인지 정보가 없다)
//    iSHAP   : 176개가 **전부 닫힌 경로**다 — 선이 굵기 윤곽으로 벡터화돼 있다
//  세 실패 양상이 서로 다르고, 전부 "끝점 위상"으로는 못 푼다. 그래서 위상을 버리고
//  **면**으로 간다: 선을 격자에 굽고 → 바깥에서 물을 채우고 → 안 잠긴 곳이 전개도다.
//  틈은 벽을 1칸 부풀려 막는다(2×cell 까지). 부풀린 만큼은 **되깎지 않는다** —
//  이유는 아래 inB 주석(계측으로 반증된 침식)에 있다.
//
//  ★ 소스코(t-sosco)는 래스터로도 **원리적으로 못 푼다** — 규명 결과를 수치로 남긴다.
//    분해가 어려운 게 아니라 **입력에 벽이 없다.** 채택 후보(chosen, 10 폴리라인 ·
//    128 선분)의 계측값:
//      · 열린 끝 13개. 그중 (154.30,15.00) 은 **다른 어떤 폴리라인에서도 130.30mm**
//        떨어져 있다 (몸통 윗변 y=15 이 x 24~337 구간에서 아예 안 그려져 있다.
//        텍 혀 바깥선만 있고 혀 밑동 접는선과 그 오른쪽 윗변이 통째로 없다).
//      · 그린 선 총 길이 1,419.7mm < 「닫힌 윤곽이라면 최소」인 bbox 둘레 1,207.6mm 의
//        1.18배 — 삼면접착 한 장 치고 턱없이 짧다. 즉 윤곽이 **불완전**하다.
//    래스터는 벽을 1칸만 부풀리므로 폭 g 인 틈을 막으려면 cell ≥ g/2 가 필요하다.
//    130.30mm 틈이면 cell ≥ 65.15mm = 부품 짧은변(223.5)의 29% — 그 격자로 만든 도형은
//    전개도가 아니라 얼룩이다. **어떤 격자로도 못 막는다.**
//    실제 두 격자 전부 물이 다 들어온다 — 벽을 뺀 「갇힌 내부」가 bbox 의 2.3~3.5% 뿐이다.
//    그래서 소스코는 **볼록껍질을 유지한다.** 껍질은 실물의 상위집합이라 겹침을 놓치지
//    않는다(계측: 0.03mm 간격 47,516 표본 전부 도형 안, 이탈 0.0000mm). 고치려면 이
//    파일이 아니라 추출기(pdf-dieline)가 빠진 벽을 찾아와야 한다 — 없는 선을 여기서
//    지어내면 그 순간 「그럴듯한데 틀린 도형」이 된다.
//
//    ⚠ 여기서 한 번 **잘못 통과시킨 이력**이 있다. earClip 버그를 고치자 소스코가
//      갑자기 raster 29조각으로 통과했다 — 좋아 보였지만 그 도형은 실물 전개도의
//      **13%**(10,940 / ≈81,000mm²)였다. 물이 다 새서 「부풀린 벽」만 남은 것이고,
//      담기 게이트(leakOf)는 칼선이 전부 그 벽 안에 있으니 0mm 로 통과시켰다.
//      선이 담긴다고 면이 담기는 게 아니다. 그래서 위 inB 절에 **갇힌 내부** 게이트를
//      따로 세웠다. 「통과했다」를 「맞았다」로 읽지 마라 — 이 파일의 실패는 조용하다.
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

// ── 격자 ↔ mm 「반칸」 보정 ─────────────────────────────────────────
//  ★ 왜 종전 래스터가 축당 +1칸 커졌나 (계측으로 재현했다)
//    put() 은 선 위 표본을 **가장 가까운 칸 중심**에 굽는다 → 칸 i 는 mm i·cell 을 뜻한다.
//    그런데 윤곽은 칸의 **면**을 따라 뽑으므로 아래 mm 환산이 칸 i 를
//    [i·cell, (i+1)·cell] 로 읽는다. 이 반칸 편차 때문에 낮은쪽 변은 정확히 맞고
//    높은쪽 변만 +1칸 삐져나갔다 —
//      t-wake2 cell 0.80 → 199.20×235.20 vs 칼선 198.3×234   = +0.90/+1.20
//      t-ishap cell 1.857 → 558.96×326.83 vs 칼선 557.1×324.16 = +1.86/+2.67
//    그래서 makeDragPart 의 |Δ|>0.6 게이트를 **원리적으로** 못 넘었고(cell 하한 0.8mm),
//    mode==="raster" 용 note 문자열은 도달 불가 코드였다.
//
//  −0.5칸 하면 대칭이 된다: 변이 mm u 에 있으면 벽칸은 c = round(u/cell) 이고
//    그 칸의 면이 (c∓0.5)·cell 에 오므로 |c·cell − u| ≤ 0.5·cell 만큼 대칭으로 어긋난다.
//
//  ⚠ 「그래서 축평행 변은 항상 바깥쪽이니 안전하다」는 종전 주석은 **반증됐다.**
//    축평행 변에서만 맞는 얘기고, 대각·곡선에서는 침식이 벽칸을 옆으로 밀어 도형이
//    실물보다 **작아진다**. 계측(leakOf): 깎기 있음 → t-wake2 0.327mm · t-ishap 0.608mm
//    가 도형 **밖**. 그래서 지금은 깎지 않고(rasterDecompose inB 주석) 그 위에
//    담기 게이트를 걸어 **재서 확인한다.** 추론으로 안전을 주장하지 않는다.
const HALF_CELL = 0.5;
/** 윤곽 bbox 가 칼선 bbox 보다 이만큼(칸 수) 넘게 크면 물이 샌 것으로 보고 폐기한다.
 *  부풀림을 되돌리지 않으므로(아래 「깎지 않는다」 절) 정상값이 **축당 3칸**(한 변 1.5칸)
 *  이다. 5칸은 거기에 격자 반올림 여유를 더한 값이고, 그 이상이면 물이 샌 것이다.
 *  ⚠ 이 값을 3 으로 내리면 정상 케이스가 전부 폐기된다(실측: 웨이크버니 축당 2.9칸). */
const LEAK_CELLS = 5;
/** ② 늘리기 상한(칸 수). 이만큼도 못 채우면 윤곽이 칼선을 대표하지 못한다 → 폐기. */
const STRETCH_CELLS = 3;
/** 실물 칼선이 충돌 도형 **밖**으로 새도 되는 최대 거리(mm).
 *  이 숫자가 곧 「엔진은 안 겹친다는데 인쇄에서는 겹치는」 폭이라 0 이어야 한다.
 *  0.02 는 부동소수·표본 격자 잡음 몫이다 — 여유가 아니다. */
const LEAK_MM = 0.02;

/**
 * 래스터 윤곽을 **칼선 bbox 에 못 박는다.**
 *
 * 왜 필요한가 — 그림과 충돌 도형이 같은 사각형에 앉아야 한다. SheetCanvas 는 칸
 * rect(= bbox w×h) 안에 PDF 폴리라인을 얹고 반전도 bbox 중심(pb.w/2, pb.h/2)으로 돈다.
 * 충돌 도형의 bbox 가 다르면 「그린 칸」과 「막는 도형」이 어긋난다. 종전 코드는 그걸
 * **폐기 사유**로만 썼다 — 위 반칸 편차와 합쳐져 PDF 는 늘 bbox·볼록껍질로 떨어졌고
 * 그래서 오목한 틈을 파고드는 맞물림이 원리적으로 불가능했다.
 *
 * 두 단계다:
 *  ① bbox 밖 오버행을 자른다. 칼선 bbox 밖은 실물이 아니므로 **덩어리로는** 안전하다
 *     (bbox 는 추출기가 이 폴리라인들의 합집합으로 낸 값이고 nW/nH 로 견적에도 그게 갔다).
 *     ⚠ 다만 이건 「그러므로 안전하다」가 아니다 — 정점만 clamp 하므로 경계를 **비스듬히**
 *       가로지르는 에지는 모서리가 잘려 bbox **안쪽**까지 조금 얇아질 수 있다. 즉 ① 은
 *       국소적으로 위험한 방향으로 틀릴 수 있는 유일한 단계다. 이 파일은 그걸 추론으로
 *       덮지 않고 **잰다**: 호출부(rasterDecompose)가 곧바로 leakOf 로 실물 칼선을 찍어
 *       보고 LEAK_MM 를 넘게 새면 그 해를 버린다. 실측 3건은 0.03mm 간격 표본에서
 *       이탈 0.0000mm 였다(웨이크 p0 65,013 · p1 63,592 · iSHAP 408,751 표본).
 *  ② 그래도 bbox 를 못 채우면 **늘린다** — sx,sy ≥ 1 만 쓴다. 줄이는 스케일은 안 쓴다:
 *     실물보다 작아지면 손배치가 「안 겹친다」고 통과시키고 인쇄에서 겹친다.
 *     ★ 이 파일 전체의 기울기다: 도형이 **작아지면 겹친다(위험) · 커지면 up 만 준다(안전).**
 *       그래서 반올림·클램프·스케일이 갈릴 때마다 **큰 쪽**을 고른다.
 * @returns {{ring:number[][], over:number[], stretch:number[]}|null}
 */
function fitRingToBox(ring, w, h, cell) {
  const cl = ring.map(([x, y]) => [Math.min(w, Math.max(0, x)), Math.min(h, Math.max(0, y))]);
  const rb = bboxOf([ring]);
  // 자르기 전 오버행(각 축 최대) — note 에 「얼마나 컸나」를 숫자로 싣는다
  const over = [Math.max(0, -rb.x0) + Math.max(0, rb.x1 - w),
                Math.max(0, -rb.y0) + Math.max(0, rb.y1 - h)];
  const b = bboxOf([cl]);
  if (!(b.w > 1e-6 && b.h > 1e-6)) return null;
  const sx = w / b.w, sy = h / b.h;                 // clamp 뒤라 둘 다 ≥ 1
  if (w - b.w > STRETCH_CELLS * cell || h - b.h > STRETCH_CELLS * cell) return null;
  const out = cl.map(([x, y]) => [(x - b.x0) * sx, (y - b.y0) * sy]);
  return { ring: out, over, stretch: [w - b.w, h - b.h] };
}

function rasterDecompose(polylines, bb, maxPieces) {
  const md = Math.max(bb.w, bb.h);
  // 실패 사유를 모은다 — 화면 note 가 「왜 정밀도를 잃었나」를 말해야 한다.
  // 한 줄도 안 남기면 사용자는 폴백을 「원래 그런 것」으로 읽는다.
  const rw = [];
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
    // 안쪽 = 안 잠긴 칸 = 부풀린 벽 ∪ 내부.
    //
    // ★ 부풀림을 **되돌리지 않는다** (종전엔 1칸 깎아 원래 크기로 돌렸다).
    //   깎으면 도형이 실물보다 **작아질 수 있고**, 작아진 충돌 도형은 「안 겹친다」고
    //   통과시킨 뒤 인쇄에서 겹친다 = 목형이 깨진다. 계측으로 확인했다 —
    //   깎기 있음: 실물 표본이 도형 밖으로 새는 최대 거리
    //     t-wake2 0.327mm (표본 6,724개 중 52개) · t-ishap 0.608mm (49,111개 중 690개)
    //   깎기 없음: 두 파일 **0.000mm / 0개**.
    //   왜 깎기가 새게 하나 — 침식은 「4이웃이 전부 안쪽인 칸」만 남기므로 대각 계단에서
    //   원래 벽칸이 아닌 칸이 살아남는다(칸이 선 위에서 옆으로 밀린다). 축평행 변에서는
    //   ±0.5칸 대칭이 맞지만 대각·곡선에서는 그 대칭이 성립하지 않는다.
    //
    //   대가는 숨기지 않는다: 도형이 한 변당 최대 1.5칸 두꺼워지므로 **덜 붙는다**
    //   (접촉면이 그만큼 벌어진다 → up 이 줄 수 있다). 바깥 테두리는 fitRingToBox 가
    //   칼선 bbox 로 되잘라서 영향이 없고, 두꺼워지는 곳은 오목한 안쪽 틈이다.
    //   "겹칠 수도 있지만 잘 붙는다" 와 "확실히 안 겹치지만 덜 붙는다" 중 후자를 고른다.
    const inB = new Uint8Array(nx * ny);
    for (let i = 0; i < inB.length; i++) inB[i] = out[i] ? 0 : 1;

    // ★ 물 샘 판별 — 「안쪽」이 아니라 **갇힌 내부**를 재야 한다 (26-08-16 계측으로 고침)
    //   ─────────────────────────────────────────────────────────
    //   종전 게이트는 `안쪽 면적 ≥ bbox 의 12%` 였다. **물이 새면 정확히 그 값이 남는다** —
    //   물이 다 들어와도 부풀린 벽 자체는 안 잠기므로 「안쪽 = 벽」이 되고, 벽 면적은
    //   선 길이 × 3칸이라 12% 를 쉽게 넘긴다. t-sosco 가 그렇게 통과했다:
    //     cell 2.54 → 안쪽 12,187mm² (bbox 의 14.3%) 인데 그중 벽이 10,259mm² 다.
    //     그 결과 충돌 도형이 실물 전개도(≈81,000mm²)의 **13%** 밖에 안 됐다.
    //     담기 게이트(leakOf)는 이걸 **못 잡는다** — 칼선(선)은 전부 두꺼운 벽 안에 있다.
    //     빈 곳은 종이인데 도형이 비어 있으니 이웃 부품이 몸통 한가운데로 파고든다 =
    //     엔진은 「안 겹친다」, 인쇄는 겹친다. 이 파일에서 가장 위험한 실패 양상이다.
    //   그래서 벽을 빼고 **진짜로 갇힌 칸**만 센다. 실측 분리도(두 격자 모두):
    //     t-sosco 2.3~3.5% of bbox · 안쪽의 15.8~36.2%   ← 물이 샘
    //     t-wake2 p0 62.9~74.9% · 76.9~88.6% / p1 66.0~74.3% · 74.5~86.5%
    //     t-ishap    42.1~50.5% · 69.5~80.6%
    //   문턱 25% / 50% 는 그 사이에 있고 정상쪽 최솟값(42.1% · 69.5%)에서 1.7배·1.4배 뜬다.
    //   ⚠ 이 게이트가 잡는 것은 **전면 누수**다. 칸막이 하나만 빠진 부분 누수는 원리적으로
    //     못 잡는다 — 그건 추출기가 잃은 벽이다. 그래서 아래 note 에 채움률을 숫자로 실어
    //     사람이 보게 한다(13% 짜리 도형은 한눈에 이상하다). 조용히 넘기지 않는 것이 요점이다.
    let cnt = 0, core = 0;
    for (let i = 0; i < inB.length; i++) if (inB[i]) { cnt++; if (!wd[i]) core++; }
    const A = cell * cell, bA = bb.w * bb.h;
    const corePct = 100 * core * A / bA, coreOfIn = 100 * core / Math.max(1, cnt);
    if (corePct < 25 || coreOfIn < 50) {
      rw.push(`격자 ${cell.toFixed(2)}mm: 벽을 뺀 **갇힌 내부**가 bbox 의 ${corePct.toFixed(1)}% ` +
              `(안쪽 면적의 ${coreOfIn.toFixed(0)}%) 뿐 — 칼선에 틈이 있어 물이 새어들어갔고 ` +
              `「벽만 남은 도형」이 됐다. 그대로 쓰면 몸통 한가운데가 빈 곳으로 잡힌다`);
      continue;
    }
    const fillPct = 100 * cnt * A / bA;

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
    if (!outer) { rw.push(`격자 ${cell.toFixed(2)}mm: 닫힌 윤곽을 못 뽑았다`); continue; }

    // 반칸 보정(위 HALF_CELL 주석) — 이 한 항이 없으면 축당 +1칸 커진다
    const mm = outer.map(([x, y]) => [(x - M - HALF_CELL) * cell, (y - M - HALF_CELL) * cell]);
    // 물 샘 감지 ② — 위 「갇힌 내부」 문턱을 통과했어도 윤곽이 칼선보다 몇 칸씩 크면
    // 새어들어간 것이다. 그 상태로 아래 clamp 를 걸면 「bbox 사각형」을 정밀한 윤곽으로
    // 위장한다. (앞 문턱은 면적을, 이건 **테두리 위치**를 본다 — 서로 못 잡는 것이 다르다.)
    const rb0 = bboxOf([mm]);
    if (rb0.w > bb.w + LEAK_CELLS * cell || rb0.h > bb.h + LEAK_CELLS * cell) {
      rw.push(`격자 ${cell.toFixed(2)}mm: 윤곽 ${rb0.w.toFixed(1)}×${rb0.h.toFixed(1)} 가 칼선 ${bb.w}×${bb.h} 보다 ${LEAK_CELLS}칸 넘게 크다 (물 샘)`);
      continue;
    }

    // 단순화 tol 은 **작은 것부터**. RDP 는 윤곽을 안쪽으로도 당길 수 있어서(= 위험한
    // 방향) 부풀림으로 번 여유를 tol 이 갉아먹는다. 큰 tol 은 아래 leakOf 게이트가
    // 실제로 새는지 재서 잘라낸다 — 「정점이 적다」가 아니라 「실물을 담는다」가 기준이다.
    const step = Math.min(0.5, Math.max(0.15, cell / 4));
    let worstLeak = null;
    for (const tol of [cell * 0.5, cell * 1.0, cell * 2.0, cell * 3.5]) {
      let ring = dropCollinear(rdpRing(mm, tol), 0.02);
      if (ring.length > RING_MAX) continue;
      const fit = fitRingToBox(ring, bb.w, bb.h, cell);
      if (!fit) continue;
      // clamp 가 만든 중복·공선 정점을 다시 걷어낸다 (귀 자르기가 퇴화에 약하다)
      ring = dropCollinear(fit.ring, Math.min(0.05, cell * 0.05));
      if (ring.length < 3 || ring.length > RING_MAX) continue;
      const pieces = ringToPieces(ring, maxPieces);
      if (!pieces) continue;
      // ★ 담기 게이트 — **NFP 를 쓰지 않는 독립 계측**이다. 실물 칼선을 촘촘히 찍어
      //   전부 도형 안에 있는지 본다. 새면 그 해를 **버린다** (다음 tol → 다음 cell →
      //   끝내 없으면 볼록껍질). 「조금 새는 정밀한 윤곽」보다 「무딘 껍질」이 안전하다:
      //   껍질은 반드시 실물을 담으므로 겹침을 놓치지 않는다.
      const leak = leakOf(polylines, pieces, step, LEAK_MM);
      if (leak.worst > LEAK_MM) {
        if (!worstLeak || leak.worst < worstLeak) worstLeak = leak.worst;
        continue;
      }
      // ring 을 같이 돌려준다 — 이 오목 링이 아래 pieces 의 **원본**이고,
      // 「분해가 원본을 덜 덮지 않는가」를 밖에서 재려면 둘 다 필요하다.
      return { pieces, ring, cell, verts: ring.length, tol, over: fit.over, stretch: fit.stretch, leak, fillPct };
    }
    if (worstLeak != null)
      rw.push(`격자 ${cell.toFixed(2)}mm: 윤곽이 실물 칼선을 ${worstLeak.toFixed(2)}mm 못 덮었다 (담기 게이트)`);
    else rw.push(`격자 ${cell.toFixed(2)}mm: 윤곽을 볼록 ${maxPieces}조각 이하로 못 나눴다`);
  }
  return { pieces: null, why: rw.join(" / ") || "래스터를 돌릴 격자가 없었다" };
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
      if (pieces) return { pieces, ring, mode: "stitched", why: "" };
      why = `윤곽 ${ring.length}정점을 볼록 ${maxPieces}조각 이하로 못 나눴다`;
    }
  }
  const r = rasterDecompose(polylines, bb, maxPieces);
  if (r.pieces) return { pieces: r.pieces, ring: r.ring, mode: "raster", why: "", cell: r.cell, verts: r.verts,
                         tol: r.tol, over: r.over, stretch: r.stretch, leak: r.leak, fillPct: r.fillPct };
  return { pieces: null, mode: "hull", why: `${why}; 래스터도 실패 — ${r.why}` };
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

  let pieces = null, mode = "bbox", why = "", cell = 0, over = null, stretch = null, leak = null, fillPct = null;
  if (src.pieces?.length) { pieces = src.pieces; mode = "exact"; }
  else if (src.polylines?.length) {
    const r = decomposePolylines(src.polylines, { w, h });
    if (r.pieces) { pieces = r.pieces; mode = r.mode; cell = r.cell || 0; over = r.over; stretch = r.stretch; leak = r.leak; fillPct = r.fillPct ?? null; }
    else {
      why = r.why;
      const pts = [];
      for (const p of src.polylines) for (const q of p) pts.push(q);
      const hl = canonicalize(hull(pts));
      if (hl) { pieces = [hl]; mode = "hull"; }
    }
  }
  if (!pieces?.length) { pieces = [rectPoly(w, h)]; mode = mode === "exact" ? "exact" : "bbox"; }

  let PB = makePart(pieces);
  if (!PB) return null;
  // 분해가 bbox 를 못 채우면 그림(bbox 칸)과 충돌 도형이 어긋난다 → bbox 로 내린다.
  // ⚠ 이 게이트는 「래스터 결과를 버리는 자리」가 아니다. 래스터는 fitRingToBox 가
  //   이미 칼선 bbox 에 맞춰 놓았으므로 여기서는 **그게 실제로 됐는지 확인**만 한다.
  //   그래서 허용폭이 0.6mm(= cell 하한 0.8mm 를 원리적으로 못 넘던 값)가 아니라
  //   부동소수 오차 수준이다. 여기서 걸리면 정규화가 깨진 것이고, 조용히 넘기면
  //   그린 칸과 막는 도형이 어긋난 채로 손배치가 돈다.
  if (Math.abs(PB.w - w) > 0.05 || Math.abs(PB.h - h) > 0.05) {
    why = why || `분해 결과 ${PB.w.toFixed(2)}×${PB.h.toFixed(2)} 가 칼선 ${w}×${h} 와 다르다`;
    pieces = [rectPoly(w, h)]; mode = "bbox";
    PB = makePart(pieces);
    if (!PB) return null;
  }
  const P = {
    ...PB,
    mode,
    // 폴백은 **반드시 화면에 뜬다.** 일부만 맞는 스냅을 정확한 스냅으로 오해하는 것이
    // 폴백 자체보다 위험하다 (SheetCanvas 범례가 이 문자열을 그대로 찍는다).
    // ⚠ raster 는 폴백이 아니라 **근사**다 — 오목한 틈을 파고들 수 있고, 대신 도형이
    //   격자 한두 칸만큼 두껍다. 그 숫자를 감추지 않는다. 특히 **담기 계측 결과**를
    //   그대로 싣는다: 「실물 표본 N개 전부 도형 안」이 곧 겹침 안전의 근거다.
    note: mode === "exact" || mode === "stitched" ? null
        : mode === "raster"
          ? `칼선 끝점이 안 이어져 격자 ${cell.toFixed(2)}mm 윤곽으로 근사했다. ` +
            `실물 칼선 표본 ${(leak?.n ?? 0).toLocaleString()}개가 전부 이 도형 안에 있다(이탈 ` +
            `${(leak?.worst ?? 0).toFixed(3)}mm) — 그래서 **겹침을 놓치지 않는다.** ` +
            `대신 도형이 한 변당 최대 ${(cell * 1.5).toFixed(1)}mm 두꺼워서 그만큼 **덜 붙는다**(up 이 줄 수 있다). ` +
            // 채움률을 굳이 화면에 싣는 이유: 물이 **부분적으로** 새면(칸막이 하나만 빠진
            // 경우) 자동 게이트가 원리적으로 못 잡는다. 그때 도형은 실물보다 작고 =
            // 겹침을 놓친다. 사람은 「전개도가 판의 13% 뿐」을 한눈에 알아본다.
            `이 도형은 칼선 bbox 의 ${(fillPct ?? 0).toFixed(0)}% 를 채운다(전개도 모양과 견주어 보라). ` +
            `바깥 테두리는 칼선 bbox ${w}×${h} 로 되잘랐다(오버행 ${(over?.[0] ?? 0).toFixed(2)}/${(over?.[1] ?? 0).toFixed(2)}mm` +
            `${stretch && (stretch[0] > 0.005 || stretch[1] > 0.005) ? `, 미달 ${stretch[0].toFixed(2)}/${stretch[1].toFixed(2)}mm 는 바깥으로 늘림` : ""}).`
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

// ══════════════════════════════════════════════════════════════════
//  겹침 판정 — nest 의 자세 계층을 그대로 (이 파일에 복제본을 두지 마라)
// ══════════════════════════════════════════════════════════════════

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

/** 점에서 볼록조각 경계까지의 최단거리 (밖에 있을 때만 쓴다). */
function distToPieces(p, ps) {
  let best = Infinity;
  for (const q of ps) for (let i = 0; i < q.length; i++) {
    const a = q[i], b = q[(i + 1) % q.length];
    const ex = b[0] - a[0], ey = b[1] - a[1], L2 = ex * ex + ey * ey;
    let t = L2 < 1e-12 ? 0 : ((p[0] - a[0]) * ex + (p[1] - a[1]) * ey) / L2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(p[0] - a[0] - t * ex, p[1] - a[1] - t * ey);
    if (d < best) best = d;
  }
  return best === Infinity ? 0 : best;
}

/**
 * ★ 「충돌 도형이 실물 칼선을 담는가」 — 담기 계측. **NFP 를 쓰지 않는다.**
 *
 * 이 프로젝트에서 겹침은 목형 파괴 = critical 이다. 그런데 래스터·RDP·클램프는
 * 전부 근사라서 도형이 실물보다 **작아질 수 있다.** 작아진 도형은 조용히 위험하다 —
 * 손배치가 「안 겹친다」고 통과시키고, 인쇄에서 칼선이 서로를 지나간다.
 * 그래서 근사 결과를 **믿지 않고 재서** 새면 버린다 (rasterDecompose 의 게이트).
 *
 * 재는 방법: 실물 폴리라인을 step mm 로 찍어 각 점이 볼록조각 안에 있는지 본다.
 * 경계 접촉은 안쪽으로 센다(inTriCl 이 부등호에 등호를 포함) — 「닿음은 겹침이 아니다」
 * 라는 이 파일 전체의 시맨틱과 같다.
 *
 * @param cap 이 값을 넘는 순간 계측을 중단한다(bailed). 버릴 후보에 시간을 쓰지 않는다.
 * @returns {{n:number,out:number,worst:number,bailed:boolean}} worst = 최대 이탈(mm)
 */
export function leakOf(polylines, pieces, step = 0.4, cap = Infinity) {
  let n = 0, out = 0, worst = 0;
  const hit = q => {
    n++;
    if (inPieces(q, pieces)) return false;
    // ⚠ 경계에 **정확히** 놓인 표본은 밖으로 세지 않는다.
    //   inTriCl 은 등호를 포함하지만 부동소수라, 변 위의 점에서 세 외적 중 하나가
    //   −1e-13 처럼 떨어져 세 부채꼴 전부를 빠져나간다. 그러면 이탈거리는 0.0000mm 인데
    //   out 만 수백 개로 찍혀 「샌다」로 읽힌다 — 실측: t-sosco 볼록껍질에서
    //   28,579 표본 중 460개(전부 d=0)가 그렇게 잡혔다. 껍질은 정의상 상위집합이라
    //   샐 수가 없다. TOUCH 는 1nm 라 실제 겹침(0.02mm 게이트)과는 6자리 떨어져 있다.
    const TOUCH = 1e-6;
    const d = distToPieces(q, pieces);
    if (d <= TOUCH) return false;
    out++;
    if (d > worst) worst = d;
    return worst > cap;
  };
  for (const p of polylines || []) {
    if (p.length === 1) { if (hit(p[0])) return { n, out, worst, bailed: true }; continue; }
    for (let k = 0; k + 1 < p.length; k++) {
      const [x0, y0] = p[k], [x1, y1] = p[k + 1];
      const m = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let t = 0; t <= m; t++)
        if (hit([x0 + (x1 - x0) * t / m, y0 + (y1 - y0) * t / m]))
          return { n, out, worst, bailed: true };
    }
  }
  return { n, out, worst: +worst.toFixed(4), bailed: false };
}

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

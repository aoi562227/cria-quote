// ══════════════════════════════════════════════════════════════════
//  nest.mjs — NFP(No-Fit Polygon) 기반 무겹침 판걸이 배치
// ══════════════════════════════════════════════════════════════════
//
//  왜 이 파일이 따로 있는가
//  ────────────────────────
//  종전 판걸이 계산은 맞물림을 상수 감산으로 근사했다.
//      span = base * n - IL * (n-1)      // IL_W = 10mm 고정
//  충돌 검사가 아예 없어서 실제로 도형이 겹쳤다 — 목형이 서로를 지나가
//  칼이 파괴되는 배치를 "맞물림 성공"으로 표시했다.
//  (실측: IL_W=10mm 는 검사한 4케이스 전부에서 기하학 위반. 접착탭 쐐기가
//   왼쪽 이웃 패널 몸통 안으로 파고든다.)
//
//  여기서는 deepnest 계열의 정공법을 쓴다.
//      NFP(A,B) := A ⊕ (−B) = { a − b : a∈A, b∈B }
//      t ∈ int NFP  → 겹침(불법) / t ∈ ∂NFP → 닿음(합법·최적) / t ∉ NFP → 분리
//  즉 "겹치게 되는 이동벡터의 집합"을 도형으로 미리 구해두고, 이동벡터가
//  그 내부에 들어가지 않는 최소 피치를 정확히 계산한다.
//
//  deepnest 는 임의 도형·임의 회전을 다루므로 C++ 민코프스키 애드온 +
//  ClipperLib 불리언 + 유전알고리즘이 필요하다. 우리는 전부 불필요하다:
//   · 전개도를 우리가 생성하므로 처음부터 **볼록 조각의 합집합**이다
//     (패널 몸통=직사각형, 날개=사다리꼴, 접착탭=쐐기꼴 — 전부 볼록 4각형)
//   · 정리: A=∪Pi, B=∪Qj (볼록) 일 때
//         int A ∩ int(B+t) ≠ ∅  ⟺  ∃(i,j): t ∈ int(Pi ⊕ (−Qj))
//     ⟹ NFP 합집합 폴리곤을 만들 필요가 없다 → 다각형 불리언 전부 제거
//   · 목형은 규칙적 격자 + 0/180° 만 허용 → 탐색공간이 유한, GA 불필요
//
//  부호 규약 (틀리면 한쪽 방향만 검사한 셈이 된다)
//  ────────────────────────────────────────────
//  첫 인자가 고정, 둘째 인자가 −부호를 먹고 이동한다. t 는 항상 "둘째를 얼마나 옮기나".
//  NFP(X,Y) = −NFP(Y,X).  −B 는 점반사(det=+1)라 CCW 를 보존한다 —
//  거울반사와 혼동해 정점 순서를 reverse 하면 '내부는 왼쪽' 규약이 전부 깨진다.
//
//  180° 반전쌍은 NFP 가 3종류라는 점이 최대 함정이다.
//  A' = 2c − A (c = bbox 중심) 이라 하면
//      N_same = A ⊕ (−A)
//      N_op   = A ⊕ (−A') = (A ⊕ A) − 2c     ← 민코프스키 '합'! (−Qj 아니라 +Pj)
//      N_po   = A' ⊕ (−A) = −N_op
//  N_op ≠ −N_op 이 일반적이다. A 가 중심대칭일 때만 같아지는데, 직사각형
//  근사에서는 우연히 같아져서 버그가 숨는다.
//
//  좌표계: BoxNet 과 동일한 mm · y-down. 다만 방향 판정은 부호있는 면적으로
//  정규화하므로 y 방향 규약에 의존하지 않는다.
// ══════════════════════════════════════════════════════════════════

/** 피치를 0.01mm 단위로 올림 — 부동소수 오차를 항상 '벌리는' 쪽으로 흘린다 */
const PITCH_QUANT = 0.01;
const EPS = 1e-9;

const cross = (ox, oy, ax, ay, bx, by) => (ax - ox) * (by - oy) - (ay - oy) * (bx - ox);

/** 부호있는 면적 ×2 */
function area2(p) {
  let s = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const [x0, y0] = p[i], [x1, y1] = p[(i + 1) % n];
    s += x0 * y1 - x1 * y0;
  }
  return s;
}

/**
 * 볼록다각형 정규화: 면적 0 제거, CCW(양의 면적) 강제, 공선/중복 정점 제거.
 * 면적 0 조각을 남기면 볼록분해 정리의 '양의 면적' 가정이 깨지고
 * 길이 0 에지가 법선을 정의 불가로 만든다 → 반드시 사전 제거.
 */
export function canonicalize(poly) {
  const pts = [];
  for (const q of poly) {
    const last = pts[pts.length - 1];
    if (last && Math.abs(last[0] - q[0]) < EPS && Math.abs(last[1] - q[1]) < EPS) continue;
    pts.push([q[0], q[1]]);
  }
  while (pts.length > 1) {
    const a = pts[0], b = pts[pts.length - 1];
    if (Math.abs(a[0] - b[0]) < EPS && Math.abs(a[1] - b[1]) < EPS) pts.pop();
    else break;
  }
  if (pts.length < 3) return null;
  const a2 = area2(pts);
  if (Math.abs(a2) < 1e-7) return null;          // 면적 0 (공선)
  if (a2 < 0) pts.reverse();                      // CCW 강제
  // 공선 정점 제거
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const p0 = pts[(i - 1 + pts.length) % pts.length], p1 = pts[i], p2 = pts[(i + 1) % pts.length];
    if (Math.abs(cross(p0[0], p0[1], p1[0], p1[1], p2[0], p2[1])) < 1e-9) continue;
    out.push(p1);
  }
  return out.length >= 3 ? out : null;
}

/** 볼록껍질 (monotone chain) — CCW, 공선점 배제 */
export function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const build = src => {
    const st = [];
    for (const q of src) {
      while (st.length >= 2 &&
             cross(st[st.length - 2][0], st[st.length - 2][1],
                   st[st.length - 1][0], st[st.length - 1][1], q[0], q[1]) <= 0) st.pop();
      st.push(q);
    }
    return st;
  };
  const lo = build(p), up = build(p.slice().reverse());
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

/**
 * 볼록 ⊕ 볼록 민코프스키 합.
 * 정점쌍 볼록껍질 방식 — 조각이 4각형(정점 ≤ 6)이라 16~36점, 비용 무시가능.
 * 에지각도 병합보다 느리지만 평행에지·중복정점 퇴화에 구조적으로 면역이다.
 * sign=-1 이면 B 를 점반사해서 더한다 (= 민코프스키 차 = NFP).
 */
export function minkowski(A, B, sign = -1) {
  const pts = [];
  for (const [ax, ay] of A) for (const [bx, by] of B) pts.push([ax + sign * bx, ay + sign * by]);
  return hull(pts);
}

/** 볼록다각형(CCW) 내부에 t 가 **엄격히** 있는가. 경계는 false(닿음 허용). */
export function strictlyInside(N, t) {
  for (let i = 0, n = N.length; i < n; i++) {
    const a = N[i], b = N[(i + 1) % n];
    if (cross(a[0], a[1], b[0], b[1], t[0], t[1]) <= 0) return false;
  }
  return true;
}

/**
 * 아핀직선 t(s) = o + s·v 가 볼록 N 내부에 엄격히 있는 s 의 열린구간.
 * 에지 (a→b) 에 대한 내부조건 cross(b−a, t(s)−a) > 0 을 s 의 1차 부등식으로 풀어
 * lo/hi 를 좁혀간다. A=0 이고 B≤0 이면 어떤 s 도 내부가 아니다.
 * 반환 null = 교차 없음.
 */
export function lineInsideInterval(N, o, v) {
  let lo = -Infinity, hi = Infinity;
  for (let i = 0, n = N.length; i < n; i++) {
    const a = N[i], b = N[(i + 1) % n];
    const ex = b[0] - a[0], ey = b[1] - a[1];
    const A = ex * v[1] - ey * v[0];                       // cross(e, v)
    const B = ex * (o[1] - a[1]) - ey * (o[0] - a[0]);     // cross(e, o−a)
    if (Math.abs(A) < EPS) { if (B <= EPS) return null; continue; }
    const r = -B / A;
    if (A > 0) { if (r > lo) lo = r; } else { if (r < hi) hi = r; }
    if (lo >= hi - EPS) return null;
  }
  return lo < hi - EPS ? [lo, hi] : null;
}

/**
 * 열린구간들의 합집합에서 s ≥ from 인 최소 자유값.
 * 비볼록 도형에서는 자유집합이 상집합(up-set)이 아니다 —
 * 금지구간이 (0,20)∪(30,35) 이면 22 는 자유인데 32 는 다시 충돌한다.
 * 그래서 단순히 max(hi) 를 쓰면 안 되고 스윕이 필요하다.
 */
export function firstFree(intervals, from = 0) {
  let s = from, moved = true, guard = 0;
  while (moved && guard++ <= intervals.length + 2) {
    moved = false;
    for (const [lo, hi] of intervals) {
      if (lo < s - EPS && s < hi - EPS) { s = hi; moved = true; }
    }
  }
  return Math.ceil(s / PITCH_QUANT - EPS) * PITCH_QUANT;   // 항상 벌리는 쪽으로 양자화
}

/** 같은 금지구간 집합에서 from 이후의 '갬 시작점' 후보들 (자유집합이 상집합이 아니므로 필요) */
export function freeCandidates(intervals, from = 0, limit = 6) {
  const out = [firstFree(intervals, from)];
  const his = intervals.map(iv => iv[1]).sort((a, b) => a - b);
  for (const h of his) {
    if (h <= out[out.length - 1] + EPS) continue;
    const f = firstFree(intervals, h);
    if (f > out[out.length - 1] + PITCH_QUANT / 2) out.push(f);
    if (out.length >= limit) break;
  }
  return out;
}

// ══ 부품(전개도) ═══════════════════════════════════════════════════

/** 조각 리스트의 bbox */
export function bboxOf(pieces) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pieces) for (const [x, y] of p) {
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

const reflect = (pieces, cx, cy) => pieces.map(p => p.map(([x, y]) => [2 * cx - x, 2 * cy - y]));
const rot90   = pieces => pieces.map(p => p.map(([x, y]) => [-y, x]));
const shift   = (pieces, dx, dy) => pieces.map(p => p.map(([x, y]) => [x + dx, y + dy]));

/**
 * 부품 준비: 정규화 → 좌상단을 원점으로 이동 → 반전본 생성 → NFP 사전계산.
 * clearance r(mm)>0 이면 모든 NFP 를 r 만큼 부풀린 효과를 내기 위해
 * 조각을 사전에 r/2 씩 확장한다(볼록이므로 정점 방향 스케일 대신
 * 안전하게 bbox 기준 확장은 쓰지 않고, 여기서는 피치에 r 을 더하는 방식을 택함 — 아래 solve 참조).
 */
export function preparePart(rawPieces) {
  const pieces0 = rawPieces.map(canonicalize).filter(Boolean);
  if (!pieces0.length) return null;
  const bb = bboxOf(pieces0);
  const P = shift(pieces0, -bb.x0, -bb.y0);
  const netW = bb.w, netH = bb.h;
  const cx = netW / 2, cy = netH / 2;
  const Pr = reflect(P, cx, cy);

  // NFP 사전계산. N_same[i][j] = Pi ⊕ (−Pj),  N_op[i][j] = (Pi ⊕ Pj) − 2c
  const n = P.length;
  const N_same = [], N_op = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      N_same.push(minkowski(P[i], P[j], -1));
      // 반전쌍: −A' = −(2c − A) = A − 2c 이므로 **합**을 쓰고 −2c 평행이동
      N_op.push(minkowski(P[i], P[j], +1).map(([x, y]) => [x - 2 * cx, y - 2 * cy]));
    }
  }
  return { pieces: P, flipped: Pr, netW, netH, cx, cy, N_same, N_op };
}

/** 이동벡터 t 로 두 부품(방향 o1, o2)이 겹치는가 */
export function overlaps(part, t, sameOrient) {
  const set = sameOrient ? part.N_same : part.N_op;
  for (const N of set) if (strictlyInside(N, t)) return true;
  return false;
}

// ══ 격자 솔버 ══════════════════════════════════════════════════════

const FLIP_RULES = {
  none:    () => false,
  rowAlt:  (i, j) => j % 2 === 1,
  colAlt:  (i, j) => i % 2 === 1,
  checker: (i, j) => (i + j) % 2 === 1,
};

/**
 * 배치가 진짜로 겹침 0 인지 **전 셀쌍 완전탐색**으로 검증.
 * 차이집합 추론(1칸/2칸만 검사)은 절대 불충분하다 — 비볼록 도형에서
 * 자유집합이 상집합이 아니므로 k배수마다 독립적으로 충돌할 수 있고,
 * 맞물림에서는 dx < netW 라 대각쌍의 열 분리도 자동 보장되지 않는다.
 * 여기서 완전탐색을 담당하므로 후보생성 단계의 패리티·부호 실수가 구조적으로 무해해진다.
 */
export function verifyNoOverlap(part, cells, flipFn) {
  for (let a = 0; a < cells.length; a++) {
    for (let b = a + 1; b < cells.length; b++) {
      const A = cells[a], B = cells[b];
      const t = [B.x - A.x, B.y - A.y];
      // bbox 프리필터 — 대부분 즉시 기각
      if (Math.abs(t[0]) >= part.netW - EPS || Math.abs(t[1]) >= part.netH - EPS) continue;
      const fa = flipFn(A.i, A.j), fb = flipFn(B.i, B.j);
      // NFP(A_oa, A_ob): oa==ob → same. 다르면 oa=0°기준 t, oa=180°기준은 −t 대칭 이용
      if (fa === fb) { if (overlaps(part, t, true)) return { ok: false, a: A, b: B, t }; }
      else if (!fa)  { if (overlaps(part, t, false)) return { ok: false, a: A, b: B, t }; }
      else           { if (overlaps(part, [-t[0], -t[1]], false)) return { ok: false, a: A, b: B, t }; }
    }
  }
  return { ok: true };
}

/**
 * 판형(인쇄가능영역 printW × printH)에 부품을 최대 개수로 앉힌다.
 * 후보: {배열회전 0/90} × {반전규칙 4종} × {엇갈림 0, dx/2} × {dy 갬 후보}
 * 각 후보마다 정확한 최소 피치를 NFP 로 구하고, 완전탐색으로 겹침 0 을 보증한다.
 *
 * clearance: 칼선 사이 최소 여유(mm). 목형 칼 두께·재단 공차를 흡수한다.
 *   NFP 를 부풀리는 대신 피치에 더한다 — 볼록조각 오프셋은 정점에서
 *   원호가 생겨 정확도가 떨어지고, 격자 피치에서는 두 방법이 사실상 동일하다.
 */
export function solveLayout(rawPieces, printW, printH, opts = {}) {
  const clearance = opts.clearance ?? 0.5;
  const maxUp     = opts.maxUp ?? 200;
  // 맞물림 금지 모드 — 피치를 전개도 크기로 고정해 '칼선 공유'만 허용한다.
  // 실무에서 맞물림 목형은 드물다(측면 풀발이 등 특수 케이스). 기본 배치가
  // 무엇인지 판정하기 위한 스위치.
  const noIL      = !!opts.noInterlock;
  const base = preparePart(rawPieces);
  if (!base) return null;

  let best = null;

  for (const g of [0, 90]) {
    const part = g === 0 ? base : preparePart(rot90(base.pieces));
    if (!part) continue;
    const { netW, netH } = part;
    if (netW > printW + EPS || netH > printH + EPS) continue;

    for (const [ruleName, flipFn] of Object.entries(FLIP_RULES)) {
      // ── dy 후보: t = (0, k·dy) → o=(0,0), v=(0,k) 로 클리핑
      const Rcap = Math.max(1, Math.min(16, Math.floor(printH / Math.max(netH * 0.15, 1)) + 1));
      const dyForbid = [];
      for (let k = 1; k <= Rcap; k++) {
        const same = flipFn(0, 0) === flipFn(0, k);
        const set = same ? part.N_same : part.N_op;
        for (const N of set) {
          const iv = lineInsideInterval(N, [0, 0], [0, k]);
          if (iv) dyForbid.push(iv);
        }
      }
      const dyCands = noIL ? [netH] : (() => {
        const c = freeCandidates(dyForbid, 0, 4)
          .map(d => Math.max(d, PITCH_QUANT) + clearance)
          .filter(d => d <= netH + EPS);
        if (!c.includes(netH)) c.push(netH);   // 겹침 0 배치도 항상 후보
        return c;
      })();

      for (const dy of dyCands) {
        // maxUp 은 행에도 걸어야 한다 — 열만 깎으면 행이 단독으로 한도를 넘는다
        const R = Math.max(1, Math.min(maxUp, Math.floor((printH - netH) / dy + 1e-7) + 1));
        for (const sxMode of (noIL ? ['none'] : ['none', 'half'])) {
          // ── dx 후보: Δ=(Δi,Δj), t = (Δi·dx + Δj·sx, Δj·dy)
          //    sx = dx/2 이면 t.x 가 dx 에 대해 (Δi + Δj/2)·dx → v.x 계수에 반영
          const dxForbid = [];
          const Ccap = Math.max(1, Math.min(16, Math.floor(printW / Math.max(netW * 0.15, 1)) + 1));
          for (let dj = 0; dj < R; dj++) {
            for (let di = -Ccap; di <= Ccap; di++) {
              if (di === 0 && dj === 0) continue;
              if (dj === 0 && di < 0) continue;            // Δ 와 −Δ 는 동일조건
              const coef = di + (sxMode === 'half' ? dj / 2 : 0);
              const same = flipFn(0, 0) === flipFn(di, dj);
              const set = same ? part.N_same : part.N_op;
              const o = [0, dj * dy];
              if (Math.abs(coef) < EPS) {
                // dx 와 무관한 제약 — 고정점 판정
                for (const N of set) if (strictlyInside(N, o)) { dxForbid.push([-Infinity, Infinity]); break; }
                continue;
              }
              for (const N of set) {
                const iv = lineInsideInterval(N, o, [coef, 0]);
                if (iv) dxForbid.push(iv);
              }
            }
          }
          if (dxForbid.some(iv => iv[0] === -Infinity)) continue;
          const dxCands = noIL ? [netW] : (() => {
            const c = freeCandidates(dxForbid, 0, 3)
              .map(d => Math.max(d, PITCH_QUANT) + clearance)
              .filter(d => d <= netW + EPS);
            if (!c.includes(netW)) c.push(netW);
            return c;
          })();

          for (const dx of dxCands) {
            const sx = sxMode === 'half' ? dx / 2 : 0;
            // maxUp 초과분은 열 수를 깎는다 — 후보를 조용히 버리면 해가 없는 것처럼 보인다
            let C = Math.max(1, Math.floor((printW - netW - (R - 1) * sx) / dx + 1e-7) + 1);
            C = Math.min(C, Math.max(1, Math.floor(maxUp / R)));
            if (C < 1) continue;

            const cells = [];
            for (let j = 0; j < R; j++) for (let i = 0; i < C; i++)
              cells.push({ i, j, x: i * dx + j * sx, y: j * dy, flip: flipFn(i, j) });

            const bb = { w: (C - 1) * dx + (R - 1) * sx + netW, h: (R - 1) * dy + netH };
            if (bb.w > printW + EPS || bb.h > printH + EPS) continue;

            const v = verifyNoOverlap(part, cells, flipFn);
            if (!v.ok) continue;                            // 후보 폐기 (설계 버그 신호)

            const up = C * R;
            const foot = (bb.w * bb.h) / (printW * printH);
            const cand = {
              up, cols: C, rows: R, dx, dy, sx, rotated: g === 90, flipRule: ruleName,
              netW, netH, bbox: bb, footprint: foot,
              interlocked: dx < netW - 0.05 || dy < netH - 0.05,
              overlapX: Math.max(0, netW - dx), overlapY: Math.max(0, netH - dy),
              cells, part,
            };
            if (!best || cand.up > best.up ||
                (cand.up === best.up && cand.footprint < best.footprint)) best = cand;
          }
        }
      }
    }
  }
  return best;
}

export { rot90, reflect, shift, FLIP_RULES };

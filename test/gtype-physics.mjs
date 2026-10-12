// ══════════════════════════════════════════════════════════════════
//  gtype-physics.mjs — G형 도면 생성기의 **기하·접기 검사기** (26-10-08)
//
//  왜: 더는 G형 실물 칼선을 얻을 수 없다(사용자 26-10-08). 실물 3장(모자 · 유니다 · 아이엠)에서 세운 규칙을
//  **그 3장 밖의 크기**에 쓸 때 도면이 물리적으로 성립하는지는 칼선 없이도 잴 수 있다 — 그게 이 파일이다.
//  verify-dieline 이 import 해서 크기 스윕을 돈다. 도면 하나를 받아 위반 목록을 돌려준다(빈 배열 = 통과).
//
//  검사 (전부 도면 dl 과 생성기가 내보낸 치수 dl.geo 만 본다 — 정답을 재계산하지 않는다):
//    G1 윤곽이 닫혀 있고 좌표가 전부 유한하다
//    G2 윤곽이 **스스로 교차하지 않는다**(단순 다각형) — 날개가 꼬이거나 비탈이 뒤집히면 여기서 걸린다
//    G3 윤곽이 전개도(netW×netH) 안에 있다
//    G4 배치 조각이 윤곽 꼭짓점을 전부 **덮는다**(모델 ≥ 실물 — 판 위에서 겹침을 놓치지 않는다) · 조각끼리 안 겹친다
//    P1 모서리 날개(앞·뒤 두 장)가 옆벽 길이 안에 같이 들어간다     : back + front ≤ 옆벽 길이
//    P2 옆날개가 접혀 내려갈 때 안벽 높이를 넘지 않는다             : earDepth ≤ 안벽 높이
//    P3 옆날개가 뚜껑 길이 안에 들어간다(비탈·모서리 포함)          : 2·(gap + slantY + r) ≤ 뚜껑 길이
//    P4 꽂이 어깨가 옆날개 깊이를 넘지 않는다(어깨는 옆벽 주머니로 들어간다 — 실물 3/3 이 이 관계) : shoulder ≤ earDepth
//    P5 탭이 안벽 길이 안에 있고 서로 안 겹친다
// ══════════════════════════════════════════════════════════════════

const EPS = 1e-6;

function segX(a, b, c, d) {               // 선분 ab 와 cd 가 **꼭짓점 공유 없이** 교차하는가
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const d1 = o(c, d, a), d2 = o(c, d, b), d3 = o(a, b, c), d4 = o(a, b, d);
  return ((d1 > EPS && d2 < -EPS) || (d1 < -EPS && d2 > EPS)) && ((d3 > EPS && d4 < -EPS) || (d3 < -EPS && d4 > EPS));
}
const rbox = q => [Math.min(...q.map(v => v[0])), Math.min(...q.map(v => v[1])), Math.max(...q.map(v => v[0])), Math.max(...q.map(v => v[1]))];

/** @returns {string[]} 위반 목록 */
export function checkGtype(dl, label = "") {
  const bad = [];
  const say = (code, msg) => bad.push(`${label} ${code} ${msg}`);
  const o = dl.cuts?.[0];
  if (!o || o.length < 4) { say("G1", "윤곽이 없다"); return bad; }
  if (o.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) say("G1", "좌표에 NaN/∞");
  const last = o.at(-1);
  if (Math.abs(o[0][0] - last[0]) > EPS || Math.abs(o[0][1] - last[1]) > EPS) say("G1", "윤곽이 안 닫혔다");
  // G2 — 이웃이 아닌 변끼리 교차
  const n = o.length - 1;
  let cross = 0;
  for (let i = 0; i < n && cross < 3; i++)
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segX(o[i], o[i + 1], o[j], o[j + 1])) { cross++; if (cross <= 2) say("G2", `변 ${i}·${j} 가 교차 @(${o[i][0].toFixed(1)},${o[i][1].toFixed(1)})`); break; }
    }
  // G3
  const W = dl.net.netW, H = dl.net.netH;
  if (o.some(p => p[0] < -1e-6 || p[1] < -1e-6 || p[0] > W + 1e-6 || p[1] > H + 1e-6)) say("G3", `윤곽이 전개도 ${W}×${H} 밖으로 나간다`);
  // G4 — 덮개 · 겹침
  const R = dl.pieces.map(rbox);
  const miss = o.filter(p => !R.some(r => p[0] >= r[0] - 1e-6 && p[0] <= r[2] + 1e-6 && p[1] >= r[1] - 1e-6 && p[1] <= r[3] + 1e-6));
  if (miss.length) say("G4", `조각이 덮지 못한 윤곽 꼭짓점 ${miss.length}개 (예 ${miss[0][0].toFixed(1)},${miss[0][1].toFixed(1)})`);
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const ov = Math.max(0, Math.min(R[i][2], R[j][2]) - Math.max(R[i][0], R[j][0])) * Math.max(0, Math.min(R[i][3], R[j][3]) - Math.max(R[i][1], R[j][1]));
    if (ov > 1e-6) say("G4", `조각 ${i}·${j} 가 ${ov.toFixed(1)}mm² 겹친다`);
  }
  // P — 접기 조건 (생성기가 내보낸 치수)
  const g = dl.geo;
  if (!g) { say("P0", "dl.geo(접기 치수)가 없다"); return bad; }
  if (g.flapBack + g.flapFront > g.sideLen + 1e-6) say("P1", `모서리 날개 ${g.flapBack.toFixed(1)}+${g.flapFront.toFixed(1)} > 옆벽 길이 ${g.sideLen.toFixed(1)}`);
  if (g.earDepth > g.innerH + 1e-6) say("P2", `옆날개 깊이 ${g.earDepth.toFixed(1)} > 안벽 높이 ${g.innerH.toFixed(1)}`);
  if (2 * (g.earGap + g.earSlantY + g.earR) > g.lidLen + 1e-6) say("P3", `옆날개 세로 ${(2 * (g.earGap + g.earSlantY + g.earR)).toFixed(1)} > 뚜껑 ${g.lidLen.toFixed(1)}`);
  if (g.shoulder > g.earDepth + 1e-6) say("P4", `꽂이 어깨 ${g.shoulder.toFixed(1)} > 옆날개 깊이 ${g.earDepth.toFixed(1)}`);
  if (g.tabs) {
    const t = g.tabs.slice().sort((a, b) => a[0] - b[0]);
    if (t.some(([a, b]) => a < g.innerY0 - 1e-6 || b > g.innerY1 + 1e-6)) say("P5", "탭이 안벽 길이 밖");
    for (let i = 0; i + 1 < t.length; i++) if (t[i][1] > t[i + 1][0] + 1e-6) say("P5", "탭끼리 겹친다");
  }
  return bad;
}

/** 크기 스윕 — 실물 3장의 범위를 넉넉히 덮고 극단(납작·높은·좁은)을 넣는다. */
export const SWEEP = (() => {
  const out = [];
  for (const W of [40, 80, 150, 300, 500]) for (const D of [40, 80, 150, 300, 500]) for (const H of [10, 20, 30, 50, 80, 120, 200]) out.push([W, D, H]);
  return out;
})();

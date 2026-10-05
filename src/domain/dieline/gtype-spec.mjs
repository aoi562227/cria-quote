/**
 * G형 (판지 · 얇은 옆벽) — 앞벽 한 겹 · 옆벽 두 겹 · 뚜껑일체 조립형 (26-10-02)
 *
 *   전개도 가로 = W + 4H + 8        전개도 세로 = 2D + 3H + 0.5
 *
 *            ┌───────┐                     가운데 열 위→아래
 *            │  꽂이  │                       꽂이날개 H−2 · 뚜껑 D+5.5 · 뒷벽 H−2 · 바닥 D−1 · 앞벽 H
 *        ┌───┼───────┼───┐                 가로 방향 왼→오
 *        │날개│  뚜껑  │날개│                   안벽 H+2.5 · 바깥벽 H+0.5 · 바닥 W+2 · 바깥벽 H+0.5 · 안벽 H+2.5
 *        ├───┼───────┼───┤                 뚜껑·뒷벽·앞벽 줄의 양옆(옆날개·모서리 날개)은 바깥벽 폭 안에 든다
 *        │모서│  뒷벽  │모서│
 *    ┌───┼───┼───────┼───┼───┐
 *    │안벽│바깥│  바닥  │바깥│안벽│
 *    └───┼───┼───────┼───┼───┘
 *        │모서│  앞벽  │모서│
 *        └───┴───────┴───┘
 *
 * ★ 치수의 근거 — **실제 칼선이 정식이다**(사용자 26-10-02: 「사각형 그린 것보다 실제 도면이 정식」 · 「견적 맞게 알아서」)
 *   트렌드스페이스 모자 패키지 칼선 `G형220x210x110.pdf`(판지 BW350 · 26-07-06 견적 · 재단 800×700)의 접는선:
 *     긴 축  770.5 = 앞벽 110 · 바닥 219 · 뒷벽 108 · 뚜껑 225.5 · 꽂이 108          (뚜껑이 덮어 가는 변 220 = D)
 *     짧은 축 658  = 안벽 112.5(탭 3.5 포함) · 바깥벽 110.5 · 바닥 212 · 바깥벽 110.5 · 안벽 112.5   (그 변 210 = W)
 *   H=110 · D=220 · W=210 으로 풀면 위 여유분(ALLOW)이 나온다. 이 구조에 210×220×110 을 넣으면 **658 × 770.5 = 실측과 0.0mm**.
 *   ⚠ 근거 칼선은 **1장**이다. 여유분이 상자 크기에 따라 달라지는지는 모른다 — 상수로 넣었다(다른 얇은 벽 칼선이 오면 맞대라).
 *   ⚠ 실물은 꽂이가 둥글고 뒷벽 옆 날개가 사다리꼴이며 벽 끝에 탭이 있다. 여기서는 **직사각 패널로 덮는다**(모델 ≥ 실물 · 안전측).
 *     바깥벽 줄의 옆날개·모서리 날개는 실물이 더 짧다(모서리 90.5 < 110.5) — 맞물림 여지를 버린 것이지 틀린 것이 아니다.
 *
 * ★ 뼈대는 사용자 규격 도면과 같다 — `panels(W, D, H, SKELETON)` 이 여유분 0 인 뼈대((W+4H) × (2D+3H))를 낸다.
 *   규격 도면 2장(`docs/g형예시/G형예시*.pdf`)의 16칸 중 15칸이 그 뼈대와 1:1 이다(verify-dieline 「규격 도면 대조」).
 *   안 맞는 1칸은 도면의 「앞벽 아래 칸」 — 사용자가 「두 겹은 실수 · 다 한 겹 기준」이라 한 칸이다(26-10-02).
 *   ⚠ 영상 143436612(빨강·흰 상자)는 실제로 앞벽을 접어 넘기는 상자였다. 그런 물건은 존재하지만 이 앱의 기준은 한 겹이다.
 *
 * ★ 견적서와 맞는가 (verify-dieline 이 상시 감시)
 *   · 모자 26-07-06(210×220×110 · BW350)  658×770.5 → 46전지 1up · 지대R 1.8/2.8 · 지대 689,155/1,072,019 = 문서와 원 단위
 *   · 마스크 26-03-16(270×370×70 · AB400)  558×950.5 → 재단 990×590 안 · 46전지 1up · 지대R 4.8/6.8 = 문서
 *       (견적서 도면의 여유분 없는 뼈대는 550×950 이다.)
 *
 * ⚠ 벽 두께가 여유분을 가른다 — 이 구조는 **얇은 옆벽**이다. 옆벽이 두꺼운 끼움형·골판지는 (W+4H+44)×(2D+3H+14.5)
 *   (유니다·아이엠 칼선 2장 · 0.0mm)이고 그쪽은 `gtype_tray` 다. 둘을 섞지 마라 — 짧은 축이 36mm 벌어진다.
 * ⚠ W·D 는 「뚜껑이 덮어 가는 변 = D」다. 실물 둘 다 **큰 변**이 그 변이었다(370>270 · 220>210) — 2건이라 자동으로 바꾸지 않는다.
 * ⚠ 선 구분(칼선/접는선)은 지어내지 않는다 — 패널 테두리를 전부 cuts 로 낸다. 배치에 쓰는 것은 윤곽뿐이다.
 */
import { rect } from "./geometry.mjs";

/** 실물 칼선(모자 220×210×110)에서 읽은 패널별 여유분(mm). 합: 가로 +8 · 세로 +0.5. */
export const ALLOW = { inner: 2.5, outer: 0.5, baseW: 2, tuck: -2, lid: 5.5, back: -2, baseD: -1, front: 0 };
/** 여유분 0 — 사용자 규격 도면의 뼈대. 검증(규격 도면 대조)이 쓴다. */
export const SKELETON = { inner: 0, outer: 0, baseW: 0, tuck: 0, lid: 0, back: 0, baseD: 0, front: 0 };

const grid = (W, D, H, a) => {
  const x = [0, H + a.inner, 2 * H + a.inner + a.outer];           // 안벽 | 바깥벽 | 가운데 열 시작
  x.push(x[2] + W + a.baseW, x[2] + W + a.baseW + H + a.outer);    // 가운데 열 끝 | 오른쪽 바깥벽 끝
  x.push(x[4] + H + a.inner);                                       // 오른쪽 안벽 끝
  const y = [0, H + a.tuck];
  y.push(y[1] + D + a.lid, y[1] + D + a.lid + H + a.back);
  y.push(y[3] + D + a.baseD, y[3] + D + a.baseD + H + a.front);
  return { x, y };
};

/**
 * 모양 상수 — 모자 칼선(H=110 · D=220)에서 읽은 값을 **H 비례**로 옮긴 것. 괄호가 실측(mm)이다.
 *   꽂이 : 길이 H−2(108) · 뿌리가 뚜껑 밖으로 tuckRoot(70.8) · 가장 넓은 자리 tuckBulge(98.5) 가 끝에서 tuckBulgeY(66.6)
 *   옆날개: 깊이 H−3.5(106.5) · 꼭짓점 틈 3.7 · 비탈 ↓47.4 →100.2 · 모서리 r15
 *   모서리 날개: 길이 H−19.5(90.5) · 바깥 모서리 r10 · 앞벽 쪽은 벽 끝에서 1 안쪽
 *   안벽 탭: 폭 41 · 깊이 3.5 · 모따기 2 · 바닥 중심에서 ±0.215·D(±47)
 */
/** 꽂이 어깨 곡선 — 모자 칼선(H=110)의 꼭짓점 25개를 (바깥쪽 거리/H, 끝에서 거리/H)로 적은 것. 끝(0,0)에서 뿌리(0.64, 0.98)까지. */
export const TUCK_PROFILE = [
  [0, 0], [0.145, 0.0155], [0.2845, 0.0475], [0.4166, 0.0991], [0.5393, 0.169], [0.6505, 0.256], [0.7484, 0.3586],
  [0.8308, 0.4756], [0.8959, 0.6057], [0.9067, 0.6377], [0.9135, 0.6705], [0.9162, 0.7035], [0.9149, 0.7366],
  [0.9095, 0.7693], [0.9003, 0.8011], [0.8871, 0.8318], [0.87, 0.8611], [0.8495, 0.8879], [0.826, 0.9118],
  [0.8, 0.9325], [0.7718, 0.9497], [0.7418, 0.9635], [0.7102, 0.9735], [0.6773, 0.9797], [0.6435, 0.9818],
];

export function shape(H, D) {
  const r = v => Math.max(0, v);
  return {
    tuckRoot: r(0.644 * H), tuckBulge: r(0.895 * H), tuckBulgeY: r(0.617 * (H - 2)),
    earDepth: r(H - 3.5), earGap: Math.min(3.7, H / 4), earSlantY: r(0.431 * H), earSlantX: Math.min(r(0.911 * H), r(H - 5.5)), earR: Math.min(15, H / 7),   // 비탈이 날개 깊이를 넘지 않게(H<39 보호)
    flap: r(H - 19.5), flapR: Math.min(10, r(H - 19.5) / 2), frontIn: 1,
    tabW: Math.min(41, D / 4), tabD: 3.5, tabC: 2, tabAt: 0.2146 * D,
  };
}

/** 패널 15개 — [이름, x0, y0, x1, y1] (mm · 좌상단 원점 · y 아래로). 그림·배치·검증이 전부 이것 하나를 읽는다. */
export function panels(W, D, H, a = ALLOW) {
  const { x, y } = grid(W, D, H, a);
  const side = (name, yi) => [
    [name + "(좌)", x[1], y[yi], x[2], y[yi + 1]],
    [name + "(우)", x[3], y[yi], x[4], y[yi + 1]],
  ];
  return [
    ["꽂이날개", x[2], y[0], x[3], y[1]],
    ["뚜껑", x[2], y[1], x[3], y[2]], ...side("뚜껑 옆날개", 1),
    ["뒷벽", x[2], y[2], x[3], y[3]], ...side("모서리(뒤)", 2),
    ["바닥", x[2], y[3], x[3], y[4]], ...side("바깥벽", 3),
    ["안벽(좌)", x[0], y[3], x[1], y[4]], ["안벽(우)", x[4], y[3], x[5], y[4]],
    ["앞벽", x[2], y[4], x[3], y[5]], ...side("모서리(앞)", 4),
  ];
}

export default {
  id: "gtype_spec", label: "G형 (판지 · 얇은 옆벽)", labelJa: "G型（板紙・側壁薄め）",
  tag: "G형",
  verified: "실물 칼선 1건 · 견적서 2건 · 규격 도면 2건", polygon: true, thomsonDefault: "g_std",

  netSize(W, D, H, { hangTab = 0 } = {}) {
    const { x, y } = grid(W, D, H, ALLOW);
    return {
      netW: x[5], netH: y[5],
      topLid: 0, botFloor: 0, glueTab: 0, noRotate: false, hangTab,
      note: ["G형 (판지 · 얇은 옆벽)", "W+4H+8 × 2D+3H+0.5 · 실물 칼선"],
      warning: W > D ? `가로(${W}) > 깊이(${D}) — 뚜껑이 덮어 가는 변을 D 로 넣는다. 실물 2건은 큰 변이 D 였다` : null,
    };
  },

  // 슬리브 위상(몸통4+접착탭)이 아니라 날개 프로파일이 없다. 계약(폴리곤 구조는 flaps 를 준다 ·
  // max(top)=topLid)을 지키기 위해 **0 짜리 프로파일**을 준다 — 도형은 아래 pieces() 가 만든다.
  flaps: () => ({ type: "panels", top: [0], bot: [0] }),

  /**
   * 도면 — 실물 칼선(모자 220×210×110)의 모양을 **치수 비례로** 그린다. 26-10-05 사용자: 「삼면접착·십자조립처럼 G형 도면을 직접 그려라」.
   *   cuts  = 바깥 윤곽 하나(닫힌 폴리라인) · folds = 패널 사이 접는선 · panels = 이름표 자리
   *   pieces = 배치용 볼록 조각 7개 — 윤곽을 **덮는** 직사각형이다(모델 ≥ 실물 · 겹침은 안 나고 맞물림 여지는 버린다)
   * ⚠ 모양 상수(SHAPE)는 칼선 1장에서 H 비례로 읽은 것이다 — 다른 H 에서 실물이 같은 비례인지는 모른다. 바닥 홈·잠금 홈은 안 그린다.
   */
  pieces(W, D, H) {
    const g = grid(W, D, H, ALLOW), x = g.x, y = g.y;
    const [xA0, xA1, xC0, xC1, xB1, xE] = x, [, yT, yL, yK, yB, yF] = y;
    const S = shape(H, D);
    const mid = (xC0 + xC1) / 2;
    // ── 왼쪽 반 윤곽: 꽂이 끝(xC0,0)에서 시계 반대 방향으로 내려가 앞벽 아래 가운데(mid,yF)까지 ──
    const L = [];
    const arc = (cx, cy, rx, ry, a0, a1, n = 8) => { for (let i = 1; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; L.push([cx + rx * Math.cos(t), cy + ry * Math.sin(t)]); } };
    const curve = (p0, c, p1, n = 5) => { for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; L.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]); } };
    // 꽂이 어깨 — 실물 곡선을 H 비례 점표(TUCK_PROFILE)로 그대로 옮긴다(타원 근사는 최대 6.5mm 벗어났다).
    for (const [out, down] of TUCK_PROFILE) L.push([xC0 - out * H, Math.min(down * H, yT)]);
    L.push([xC0, yT], [xC0, yT + S.earGap]);                                                 // 뚜껑 끝 모서리 · 옆날개 꼭짓점 틈
    const ya = yT + S.earGap, yb = yL - S.earGap, xEar = xC0 - S.earDepth;
    L.push([xC0 - S.earSlantX, ya + S.earSlantY]);
    curve([xC0 - S.earSlantX, ya + S.earSlantY], [xEar, ya + S.earSlantY + S.earR * 0.4], [xEar, ya + S.earSlantY + S.earR]);
    L.push([xEar, yb - S.earSlantY - S.earR]);
    curve([xEar, yb - S.earSlantY - S.earR], [xEar, yb - S.earSlantY - S.earR * 0.4], [xC0 - S.earSlantX, yb - S.earSlantY]);
    L.push([xC0, yb], [xC0, yL]);                                                             // 옆날개 → 뚜껑/뒷벽 경계
    const xFl = xC0 - S.flap;                                                                // 뒷벽 모서리 날개 (뚜껑 쪽 모서리 둥글다)
    L.push([xFl + S.flapR, yL]);
    arc(xFl + S.flapR, yL + S.flapR, S.flapR, S.flapR, -Math.PI / 2, -Math.PI, 4);
    L.push([xFl, yK], [xA1, yK], [xA0 + S.tabD, yK]);                                       // 날개 아래 → 바깥벽·안벽 윗변
    const cB = (yK + yB) / 2;                                                                 // 안벽 바깥 변 — 탭 2개
    for (const cy of [cB - S.tabAt, cB + S.tabAt]) {
      L.push([xA0 + S.tabD, cy - S.tabW / 2 - S.tabC], [xA0, cy - S.tabW / 2], [xA0, cy + S.tabW / 2], [xA0 + S.tabD, cy + S.tabW / 2 + S.tabC]);
    }
    L.push([xA0 + S.tabD, yB], [xA1, yB], [xC0 - S.flap, yB]);                              // 안벽·바깥벽 아랫변 → 앞벽 모서리 날개
    const yFf = yF - S.frontIn;
    L.push([xC0 - S.flap, yFf - S.flapR]);
    arc(xC0 - S.flap + S.flapR, yFf - S.flapR, S.flapR, S.flapR, Math.PI, Math.PI / 2, 4);
    L.push([xC0, yFf], [xC0, yF], [mid, yF]);
    const R = L.slice().reverse().map(([px, py]) => [2 * mid - px, py]);
    const outline = [...L, ...R, L[0]];
    // ── 접는선 ──
    const folds = [
      [[xC0, yT], [xC1, yT]], [[xC0, yL], [xC1, yL]], [[xC0, yK], [xC1, yK]], [[xC0, yB], [xC1, yB]],   // 가운데 열 가로 접는선
      [[xC0, ya], [xC0, yb]], [[xC1, ya], [xC1, yb]],                                                   // 뚜껑 옆날개
      [[xC0, yL], [xC0, yK]], [[xC1, yL], [xC1, yK]],                                                   // 뒷벽 모서리 날개
      [[xC0, yK], [xC0, yB]], [[xC1, yK], [xC1, yB]],                                                   // 바닥|바깥벽
      [[xA1, yK], [xA1, yB]], [[xB1, yK], [xB1, yB]],                                                   // 바깥벽|안벽
      [[xC0, yB], [xC0, yFf]], [[xC1, yB], [xC1, yFf]],                                                 // 앞벽 모서리 날개
      [[xFl, yK], [xC0, yK]], [[xC1, yK], [xC1 + S.flap, yK]],                                          // 모서리 날개|바깥벽 (실물은 칼선+오시 겹침 — 접는선으로 둔다)
    ];
    // ── 배치용 조각 (덮개) ──
    const pieces = [
      rect(xC0, 0, xC1, yF),                                   // 가운데 열
      rect(xC0 - S.tuckBulge, 0, xC0, yT), rect(xC1, 0, xC1 + S.tuckBulge, yT),   // 꽂이 어깨
      rect(xA1, yT, xC0, yF), rect(xC1, yT, xB1, yF),         // 바깥벽 열(옆날개·모서리·바깥벽·모서리)
      rect(xA0, yK, xA1, yB), rect(xB1, yK, xE, yB),           // 안벽
    ];
    const meta = [
      { panel: 1, part: "body" }, { panel: 1, part: "flap" }, { panel: 1, part: "flap" },
      { panel: 0, part: "wall" }, { panel: 2, part: "wall" }, { panel: 4, part: "wall" }, { panel: 4, part: "wall" },
    ];
    // ── 이름표 (NetDiagram 이 y 를 읽는다) ──
    const lab = (label, x0, x1, yc) => ({ i: label, x0, x1, y: yc, label });
    const panels = [
      lab("꽂이", xC0, xC1, yT / 2), lab("뚜껑", xC0, xC1, (yT + yL) / 2), lab("뒷벽", xC0, xC1, (yL + yK) / 2),
      lab("바닥", xC0, xC1, (yK + yB) / 2), lab("앞벽", xC0, xC1, (yB + yF) / 2),
      lab("옆벽", xA1, xC0, (yK + yB) / 2), lab("옆벽", xC1, xB1, (yK + yB) / 2),
      lab("안벽", xA0, xA1, (yK + yB) / 2), lab("안벽", xB1, xE, (yK + yB) / 2),
      lab("날개", xEar, xC0, (yT + yL) / 2), lab("날개", xC1, xC1 + S.earDepth, (yT + yL) / 2),
    ];
    return { pieces, meta, cuts: [outline], folds, panels };
  },
};

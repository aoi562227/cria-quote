// ══════════════════════════════════════════════════════════════════
//  dieline.mjs — 전개도 치수와 폴리곤의 단일 출처
// ══════════════════════════════════════════════════════════════════
//
//  왜 이 파일을 만들었나
//  ────────────────────
//  종전에는 전개도 '크기'(calcNetSize)와 '그림'(getFlaps)이 서로 다른
//  회귀식을 썼다. 출처가 다른 두 벌이 섞여 폴리곤이 netH 와 어긋났다.
//      맞뚜껑  netH = H + 2(D+16.5)  ↔  그려지는 높이 = H + 2·round(0.03D+10.6)
//               → 92×13×140 에서 199.0 vs 165.2  (−33.8mm)
//               → 150×69.5×149 에서 321.0 vs 222.8 (−98.2mm)
//      십자    netH = H + 2(7D/8+5.5) ↔  그려지는 높이 = H + (0.08D+9) + 0.7D
//               → 70×70×55 에서 188.5 vs 141.1  (−47.4mm)
//      삼면접착 만 우연히 일치했다.
//  NFP 배치는 폴리곤을 입력으로 쓰므로, 도형이 25~30% 작으면 실제로는
//  불가능한 배치를 가능하다고 판정한다. 십자B 가 4up 이 아니라 6up 으로
//  나온 원인이 이것이다(clearance 부족이 아니었다).
//
//  그래서 크기와 그림을 한 파일에서 만들고, 다음 불변식을 강제한다.
//      max(topHmm) === netSize.topLid
//      max(botHmm) === netSize.botFloor
//      폴리곤 bbox === netW × netH        (오차 0)
//  verify-dieline.mjs 가 전 구조·전 치수에서 이 불변식을 검사한다.
//
//  치수 공식의 근거 (2026-07-31 칼선 벡터 실측)
//  ──────────────────────────────────────────
//      netW = 2(W+D) + 14.3          2샘플 오차 0.0mm
//      xEdges = [0,D,D+W,2D+W,2D+2W,netW]   경계 6개 전부 오차 0.0mm
//      netH = H + 2(D+16.5)  (맞뚜껑)  2샘플 오차 0.0mm
//  → calcNetSize 쪽이 실측으로 검증된 정본이다. getFlaps 를 여기에 맞춘다.
//
//  ★ 날개는 2단 구조다 (칼선 실측)
//      [텍 혀  topLid − D]   ← 좁다. 상자 아가리로 들어가야 하므로 안쪽으로 물림
//      [뚜껑 패널  D    ]   ← 전폭. 윗면을 덮는 판
//      [몸통  H        ]
//    바이오머 150×15×150: 몸통 150.0 / 뚜껑패널 접는선까지 180.0(=H+2D) / 전체 213.0
//    더파이러츠 190×68×280: 몸통 280.0 / 416.0(=H+2D) / 전체 449.0
//    좁은 혀 옆의 빈 공간이 맞물림이 들어가는 유일한 자리다.
//    종전 모델은 topLid 전체를 전폭 사다리꼴 1개로 그려 이 공간을 없앴다.
// ══════════════════════════════════════════════════════════════════

export const GLUE_TAB = 14.3;   // 접착날개 — 칼선 3샘플에서 정확히 14.3

/** 텍 혀가 뚜껑 패널보다 한쪽당 얼마나 좁은가(mm). 맞물림 깊이를 직접 결정한다. */
export const TONGUE_INSET = 6;

/** 전개도 치수 — 실측 칼선으로 검증된 정본 */
export function calcNetSize(W, D, H, type) {
  const netW = 2 * (W + D) + GLUE_TAB;
  let topLid, botFloor;
  switch (type) {
    case "tuck_both":  topLid = D + 16.5;                     botFloor = D + 16.5; break;
    case "cross":      topLid = D * 7 / 8 + 5.5;              botFloor = D * 7 / 8 + 5.5; break;
    default:           topLid = 0.88 * D + 0.09 * W + 20.6;   botFloor = 0.33 * D + 0.15 * W + 11.0;
  }
  return { netW, netH: H + topLid + botFloor, topLid, botFloor };
}

/**
 * 패널별 날개 높이. **반드시** max(top)=topLid, max(bot)=botFloor 를 만족한다.
 * 보조 날개(더스트·짧은날개)만 구조별 비율로 두고, 주 날개는 정본 값을 그대로 쓴다.
 */
export function getFlaps(W, D, H, type) {
  const ns = calcNetSize(W, D, H, type);
  const dust = Math.min(0.43 * D + 7, ns.topLid * 0.85);   // 더스트는 뚜껑보다 낮다
  switch (type) {
    case "tuck_both":
      // 상단 뚜껑은 전면(1)에만, 하단 뚜껑은 후면(3)에만 — 뚜껑이 2개면 맞물림 불가
      return { type: "tuck", ns,
        top: [dust, ns.topLid, dust, 0],
        bot: [Math.min(dust, ns.botFloor * 0.85), 0, Math.min(dust, ns.botFloor * 0.85), ns.botFloor] };
    case "cross":
      return { type: "cross", ns,
        top: [dust, ns.topLid, dust, 0],
        bot: [ns.botFloor * 0.55, ns.botFloor, ns.botFloor * 0.55, ns.botFloor] };
    default:
      return { type: "glue3", ns,
        top: [Math.min(D / 2 - 1, ns.topLid * 0.85), ns.topLid,
              Math.min(D / 2 - 1, ns.topLid * 0.85), 0],
        bot: [Math.min(D / 2, ns.botFloor * 0.9), ns.botFloor,
              Math.min(D / 2, ns.botFloor * 0.9), ns.botFloor] };
  }
}

/** 패널 x 경계 — 실측 오차 0.0mm */
export const xEdges = (W, D, netW) => [0, D, D + W, 2 * D + W, 2 * D + 2 * W, netW];

/**
 * 전개도를 **볼록 조각의 합집합**으로 만든다. NFP 와 화면 그림이 이걸 함께 쓴다.
 * 조각이 전부 볼록이라 다각형 불리언 없이 정확한 민코프스키 합이 가능하다.
 *
 * 날개 2단 분리:
 *   flapH > D 이면  [전폭 패널 D] + [좁은 혀 flapH−D]  두 조각으로 쪼갠다.
 *   좁은 혀 옆의 빈 공간이 맞물림 공간이다. 한 덩어리로 그리면 그 공간이 사라진다.
 */
export function dielinePieces(W, D, H, type, opt = {}) {
  const inset = opt.tongueInset ?? TONGUE_INSET;
  const twoStage = opt.twoStage !== false;
  const f = getFlaps(W, D, H, type), ns = f.ns;
  const y0 = ns.topLid, y1 = ns.topLid + H;
  const xE = xEdges(W, D, ns.netW);
  const out = [];

  const addFlap = (x0, x1, base, h, dir) => {      // dir = -1 위, +1 아래
    if (h <= 0) return;
    const pw = x1 - x0;
    const panelH = twoStage ? Math.min(D, h) : h;   // 전폭 구간
    const tongueH = h - panelH;                     // 좁은 혀
    const yP = base + dir * panelH;
    if (panelH > 0.05) {
      const c = Math.min(2.0, pw * 0.05);           // 전폭 구간은 거의 안 깎인다
      out.push([[x0, base], [x0 + c, yP], [x1 - c, yP], [x1, base]]);
    }
    if (tongueH > 0.05) {
      const ins = Math.min(inset, pw * 0.35);       // 혀는 양쪽으로 확실히 좁다
      const yT = yP + dir * tongueH;
      out.push([[x0 + ins, yP], [x0 + ins + 1.2, yT], [x1 - ins - 1.2, yT], [x1 - ins, yP]]);
    }
  };

  for (let i = 0; i < 5; i++) {
    const x0 = xE[i], x1 = xE[i + 1], pw = x1 - x0;
    if (pw <= 0.05) continue;
    if (i === 4) {                                   // 접착탭 — 위아래가 좁아지는 쐐기
      const tc = Math.min(pw * 0.55, H * 0.12, 8);
      out.push([[x0, y0], [x1, y0 + tc], [x1, y1 - tc], [x0, y1]]);
      continue;
    }
    out.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);   // 몸통
    addFlap(x0, x1, y0, f.top[i] ?? 0, -1);
    addFlap(x0, x1, y1, f.bot[i] ?? 0, +1);
  }
  return { pieces: out, net: ns, flaps: f };
}

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
    // ── 삼면접착 ──────────────────────────────────────────────
    // 2026-07-31 웨이크버니 칼선 2건 실측으로 재보정. 두 가지가 틀려 있었다.
    //
    // (1) 큰 날개와 작은 날개가 **뒤바뀌어** 있었다.
    //     실측 A(46×46×138): 위 띠 35.0 / 아래 띠 61.0
    //     실측 B(36×36×168): 위 띠 28.0 / 아래 띠 51.0
    //     종전 공식은 topLid(=0.88D+0.09W+20.6) 를 위, botFloor 를 아래로 뒀다.
    //     실측 아래 띠가 종전 topLid 와, 실측 위 띠가 종전 botFloor 와 대응한다.
    //     합이 비슷해 netH 로는 티가 안 났지만, **어느 띠에 빈 구멍이 있는지**가
    //     뒤집혀서 맞물림 계산이 통째로 틀렸다.
    //     (몸통은 정확했다 — A 173.0−35.0=138.0=H, B 196.0−28.0=168.0=H)
    //
    // (2) 큰 날개가 4.4mm 크게 나왔다. 상수만 내리면 실측과 0.2mm 이내로 맞는다.
    //     A 0.88(46)+0.09(46)+16.2 = 60.82  실측 61.0
    //     B 0.88(36)+0.09(36)+16.2 = 51.12  실측 51.0
    //     작은 띠 공식(0.33D+0.15W+11)은 A −1.9 / B +0.3 로 기존 회귀 오차 범위라 유지.
    //     (W=D 인 2건뿐이라 D·W 계수를 재분리하면 과적합이 된다)
    default:           topLid = 0.33 * D + 0.15 * W + 11.0;    // 작은 띠 (위)
                       botFloor = 0.88 * D + 0.09 * W + 16.2;  // 큰 띠 = 뚜껑 (아래)
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
    default: {
      // ── 자동바닥 날개 깊이 (웨이크버니 A·B y레벨 절단 실측) ─────────
      // 아래 날개대를 깊이별로 자르면 살아남는 구간이 줄어든다:
      //   0%   4구간 전부  /  15% 패널0 소멸  /  30% 3구간  /  50% 패널2 만
      // ⟹ 깊이 = [0.10b, 0.40b, b, 0.40b]
      //   패널0 은 15% 전에 끝나고, 패널1·3 은 30~50% 사이에 끝나고,
      //   패널2 만 밑바닥까지 내려간다.
      //
      // 왜 이 패턴이어야 맞물림이 성립하는가 (이론 검산)
      //   반전(rowAlt) 배치의 무겹침 조건은
      //       dy ≥ s + H + max_x[ bot(x) + bot_mirror(x) ] − b
      //   거울상은 깊은 패널2 를 다른 x 로 보내므로 합의 최대가 1.4b 가 되고
      //       겹침 = netH − dy = 0.6b
      //   삼면A 45.2 / 삼면B 68.6 / 웨이크버니B 30.7 / LUXEN 85.4mm
      //   필요 겹침 9.0 / 21.8 / 25.8 / 70.2mm 를 모두 덮는다.
      //   깊은 패널이 둘 붙어 있으면(종전 [0,0.36b,b,b]) 거울상과 항상 충돌해
      //   합의 최대가 2b 가 되고 겹침이 0 이 된다 — 그게 종전 실패 원인이었다.
      const b = ns.botFloor;
      return { type: "glue3", ns,
        top: [ns.topLid, ns.topLid, ns.topLid, ns.topLid],
        bot: [b * 0.10, b * 0.40, b, b * 0.40] };
    }
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
  const taper = opt.taper !== false;
  const f = getFlaps(W, D, H, type), ns = f.ns;
  const y0 = ns.topLid, y1 = ns.topLid + H;
  const xE = xEdges(W, D, ns.netW);
  const out = [];

  // 날개 폭 테이퍼 — 웨이크버니 실측
  //   깊은 날개(패널2) 끝 폭:  A 46.0→25.6  B 36.0→15.6
  //   한쪽 인셋으로 환산하면 A (46−25.6)/2 = 10.2,  B (36−15.6)/2 = 10.2
  //   ⟹ 비율이 아니라 **한쪽 10.2mm 고정**이다 (두 케이스 완전 일치)
  //   얕은 날개는 사선 기울기 dx/dy ≈ 0.30 (A 0.284 / B 0.32) 로 좁아진다
  //   ⟹ 인셋 = min(10.2, 0.30·깊이, 패널폭·0.30)
  // 위 띠(작은 띠)도 강하게 테이퍼된다 — 웨이크버니 y레벨 절단 실측
  //   B 위 띠 28.0mm:  접는선 [15.0-50.4] 거의 전폭
  //                    70%   [17.1-32.5][34.6-48.6]  ← 가운데 슬릿으로 갈라짐
  //                    100%  [17.9-23.2][42.5-48.0]  ← 혀 폭 5.4mm 씩 2개
  //   끝단 재료가 패널당 10.8mm 뿐이고 A(46mm 패널)도 10.8mm — **상수**다.
  //   두 혀 사이 슬릿은 메워서(보수적으로) 사다리꼴 하나로 근사한다.
  const TIP_W = 10.8;
  const TAPER_MAX = 10.2, TAPER_SLOPE = 0.30, FULL_FRAC = 0.7;
  const addFlap = (x0, x1, base, h, dir, tipW) => {
    if (h <= 0.05) return;
    const pw = x1 - x0;
    const ins = tipW != null
      ? Math.max(0, (pw - tipW) / 2)                       // 끝단 폭 고정형 (위 띠)
      : Math.min(TAPER_MAX, TAPER_SLOPE * h, pw * 0.30);   // 사선 기울기형 (아래 띠)
    if (!taper || ins <= 0.05) {                    // 테이퍼 없음 = 종전 전폭 사각형
      out.push([[x0, base], [x0, base + dir * h], [x1, base + dir * h], [x1, base]]);
      return;
    }
    // 실측은 깊이 70% 까지 전폭을 유지하다 끝에서 급히 좁아진다.
    // 밑변부터 선형으로 좁히면 중간이 실물보다 얇아져 up 을 과대평가한다 →
    // 안전측으로 [전폭 0~70%] + [사다리꼴 70~100%] 두 조각으로 나눈다.
    const yF = base + dir * h * FULL_FRAC, yT = base + dir * h;
    out.push([[x0, base], [x0, yF], [x1, yF], [x1, base]]);
    out.push([[x0, yF], [x0 + ins, yT], [x1 - ins, yT], [x1, yF]]);
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
    addFlap(x0, x1, y0, f.top[i] ?? 0, -1, f.type === 'glue3' ? TIP_W : null);
    addFlap(x0, x1, y1, f.bot[i] ?? 0, +1);
  }
  return { pieces: out, net: ns, flaps: f };
}

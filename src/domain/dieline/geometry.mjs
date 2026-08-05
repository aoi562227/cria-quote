// ══════════════════════════════════════════════════════════════════
//  geometry.mjs — 전개도 폴리곤 생성 (치수와 그림의 단일 출처)
// ══════════════════════════════════════════════════════════════════
//
//  왜 이 파일이 있나
//  ────────────────
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
//  그래서 크기와 그림을 한 곳에서 만들고, 다음 불변식을 강제한다.
//      max(top) === netSize.topLid
//      max(bot) === netSize.botFloor
//      폴리곤 bbox === netW × netH        (오차 0)
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

// 전개도 가로 = 2(W + D) + 접착날개 14.3
//   실제 발주 규격이 확인된 칼선 3건이 **전부 정확히 14.3** (오차 0.0):
//     삼면E   90×70 → 2(W+D)=320.0, 실측 334.3  → 14.3
//     칼선-06 50×50 → 200.0, 실측 214.3  → 14.3
//     칼선-05 47×47 → 188.0, 실측 202.3  → 14.3
//   (규격 미확인 칼선 4건은 12.5~24 로 흩어짐 — 패널 폭을 접는선에서 추정했기 때문)
//   회귀계수도 2.09·W + 1.86·D 로 2·2 수렴 확인.
export const GLUE_TAB = 14.3;   // 접착날개 (대형 250mm+ 는 24 내외)

/** 텍 혀가 뚜껑 패널보다 한쪽당 얼마나 좁은가(mm). 맞물림 깊이를 직접 결정한다. */
export const TONGUE_INSET = 6;

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
export const TIP_W = 10.8;
export const TAPER_MAX = 10.2, TAPER_SLOPE = 0.30, FULL_FRAC = 0.7;

/** 패널 x 경계 — 실측 오차 0.0mm */
export const xEdges = (W, D, netW) => [0, D, D + W, 2 * D + W, 2 * D + 2 * W, netW];

export const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];

/**
 * 전개도를 **볼록 조각의 합집합**으로 만든다. NFP 배치와 화면 그림이 이걸 함께 쓴다.
 * 조각이 전부 볼록이라 다각형 불리언 없이 정확한 민코프스키 합이 가능하다.
 *
 * 날개 2단 분리:
 *   테이퍼가 있으면 [전폭 0~70%] + [사다리꼴 70~100%] 두 조각으로 쪼갠다.
 *   좁은 혀 옆의 빈 공간이 맞물림 공간이다. 한 덩어리로 그리면 그 공간이 사라진다.
 *
 * cuts/folds 를 **같은 루프에서** 낸다 — 화면이 배치와 다른 도형을 그리는 일을
 * 구조적으로 불가능하게 만드는 것이 이 파일의 존재 이유다.
 * @returns {{pieces:number[][][], meta:Object[], cuts:number[][][], folds:number[][][]}}
 *   pieces = 볼록 4~6각형(배치 입력) / meta = 조각별 패널 번호·역할(색칠용)
 *   cuts   = 칼선 폴리라인(열린 선)   / folds = 접는선 2점 선분
 */
export function piecesFromFlaps({ W, D, H, net, flaps, opt = {} }) {
  const taper = opt.taper !== false;
  const y0 = net.topLid, y1 = net.topLid + H;
  const xE = xEdges(W, D, net.netW);
  const pieces = [], meta = [], cuts = [], folds = [];
  const topOf = i => flaps.top?.[i] ?? 0;
  const botOf = i => flaps.bot?.[i] ?? 0;

  const addFlap = (panel, x0, x1, base, h, dir, tipW) => {
    if (h <= 0.05) return;
    const pw = x1 - x0;
    const ins = tipW != null
      ? Math.max(0, (pw - tipW) / 2)                       // 끝단 폭 고정형 (위 띠)
      : Math.min(TAPER_MAX, TAPER_SLOPE * h, pw * 0.30);   // 사선 기울기형 (아래 띠)
    const part = dir < 0 ? "flapTop" : "flapBot";
    if (!taper || ins <= 0.05) {                    // 테이퍼 없음 = 종전 전폭 사각형
      const yT = base + dir * h;
      pieces.push([[x0, base], [x0, yT], [x1, yT], [x1, base]]);
      meta.push({ panel, part });
      cuts.push([[x0, base], [x0, yT], [x1, yT], [x1, base]]);
      return;
    }
    // 실측은 깊이 70% 까지 전폭을 유지하다 끝에서 급히 좁아진다.
    // 밑변부터 선형으로 좁히면 중간이 실물보다 얇아져 up 을 과대평가한다 →
    // 안전측으로 [전폭 0~70%] + [사다리꼴 70~100%] 두 조각으로 나눈다.
    const yF = base + dir * h * FULL_FRAC, yT = base + dir * h;
    pieces.push([[x0, base], [x0, yF], [x1, yF], [x1, base]]);
    meta.push({ panel, part });
    pieces.push([[x0, yF], [x0 + ins, yT], [x1 - ins, yT], [x1, yF]]);
    meta.push({ panel, part });
    // 칼선은 두 조각의 **외곽만** 따라간다. yF 의 이음선은 칼도 접는선도 아니다
    // (조각 분할은 볼록성을 얻기 위한 계산상의 편의일 뿐 실물에 없는 선이다).
    cuts.push([[x0, base], [x0, yF], [x0 + ins, yT], [x1 - ins, yT], [x1, yF], [x1, base]]);
  };

  for (let i = 0; i < 5; i++) {
    const x0 = xE[i], x1 = xE[i + 1], pw = x1 - x0;
    if (pw <= 0.05) continue;
    if (i === 4) {                                   // 접착탭 — 위아래가 좁아지는 쐐기
      const tc = Math.min(pw * 0.55, H * 0.12, 8);
      pieces.push([[x0, y0], [x1, y0 + tc], [x1, y1 - tc], [x0, y1]]);
      meta.push({ panel: 4, part: "tab" });
      cuts.push([[x0, y0], [x1, y0 + tc], [x1, y1 - tc], [x0, y1]]);
      continue;
    }
    pieces.push([[x0, y0], [x1, y0], [x1, y1], [x0, y1]]);   // 몸통
    meta.push({ panel: i, part: "body" });
    addFlap(i, x0, x1, y0, topOf(i), -1, flaps.tipW ?? null);
    addFlap(i, x0, x1, y1, botOf(i), +1);
    // 날개가 없는 구간의 몸통 위/아래 경계는 접는선이 아니라 칼선이다
    if (topOf(i) <= 0.05) cuts.push([[x0, y0], [x1, y0]]);
    if (botOf(i) <= 0.05) cuts.push([[x0, y1], [x1, y1]]);
  }

  // 패널 사이 접는선 — 날개가 있는 쪽은 양쪽 날개가 겹치는 깊이까지만 이어진다
  for (let i = 1; i <= 4; i++) {
    if (xE[i + 1] - xE[i] <= 0.05) continue;
    const yA = y0 - Math.min(topOf(i - 1), topOf(i));
    const yB = y1 + Math.min(botOf(i - 1), botOf(i));
    folds.push([[xE[i], yA], [xE[i], yB]]);
  }
  // 몸통 상·하 접는선 (날개가 붙은 구간만)
  for (const [y, of_] of [[y0, topOf], [y1, botOf]]) {
    for (let i = 0; i < 4; i++) {
      if (of_(i) > 0.05) folds.push([[xE[i], y], [xE[i + 1], y]]);
    }
  }
  // 좌측 최외곽 칼선 (패널0 왼쪽)
  cuts.push([[0, y0], [0, y1]]);

  return { pieces, meta, cuts, folds };
}

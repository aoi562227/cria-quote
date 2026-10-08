/**
 * G형 트레이 (뚜껑일체) — **두꺼운 옆벽 계열**(끼움형·골판지) · 견적용 칼선 PDF 4건의 **bbox 회귀**
 *
 * ★★ 26-10-02 — 이 식이 무엇의 식인지 드러났다: **옆벽이 두꺼운 G형**이다.
 *   사용자: 「(유니다 도면은) 골판지용이거나 옆벽을 두껍게 하면 저런 식으로 끼울 수 있게 만든다」.
 *   실물 칼선 2장(견적용도면 240809_유니다 · 240807_아이엠)을 접는선으로 재면 둘 다 **0.0mm** 로
 *       (W + 4H + 44) × (2D + 3H + 14.5)
 *   이다 — 옆벽 한쪽이 바깥벽 H+7.5 · 꼭대기 띠 8 · 안벽 H+6.5(= 2H+22), 뚜껑 폭이 W−14(양쪽 벽 두께만큼 좁아 벽 사이로 들어간다).
 *       유니다  W 94 · D 100 · H 75.5  → 440 × 441        아이엠  W 394 · D 130 · H 45.5 → 620 × 411
 *   아래 이 파일의 식(+44.5 / +19.5)은 그 계열에 짧은 축 +0.5 · 긴 축 +5.0 이다(식이 크다 = 안전측 · 안 고쳤다).
 *   ⟹ **판지 단상자의 얇은 벽 G형은 이 식이 아니다.** 얇은 벽은 (W+4H+8)×(2D+3H+0.5) 이고(모자 칼선 1장) 여유분 없는 뼈대는
 *      gtype_spec 이다. 판지 견적 둘(마스크 재단 990×590 · 모자 재단 800×700)은 이 식의 짧은 축(594.5 · 704.5)이 재단을 넘는다 —
 *      46전지 1up 이라 up·지대R 이 안 갈렸을 뿐이다. 게이트: test/verify-dieline 「G형 벽 두께 두 계열」.
 *
 *   전개도 가로 = W + 4H + 44.5
 *   전개도 세로 = 2D + 3H + 19.5
 *
 * ★ 26-08-16 근거 등급 정정 — verified 를 「칼선 4건」에서 「bbox 4건(폴리곤 없음)」으로
 *   내렸다. 아래 4건의 **원본 PDF 가 이 PC 에 없다**(240529 오호라 / 240530 빈이빈스 /
 *   240529 단 / 240522). `C:/이예찬_업무` 전수 검색 0건이고 견적용도면 폴더는 240627 부터
 *   시작한다 — 2405 배치가 통째로 없다. readme.md 에 bbox 숫자만 남았고 접는선 좌표는
 *   소실됐다. 즉 이 공식은 **재검증이 영구히 불가능**하고, 「칼선 4건」이라고 적어 두면
 *   폴리곤 근거가 있는 것으로 읽힌다. bbox 는 폴리곤이 아니다 —
 *   아래 `polygon:false` 와 dieline/index.mjs 의 직사각 1조각 분기를 **없애지 마라.**
 *   ⚠ (26-10-02 정정) 종전 이 자리에 「`240807_아이엠/G형.pdf`(뚜껑일체 단벽 620×411)는 이 공식으로 재현되지 않는다(공식 738.5×425)」고
 *     적혀 있었는데 **틀린 기록이었다.** W·D·H 를 모른 채 넣은 값이다. 접는선으로 읽은 394×130×45.5 를 넣으면 620.5×416 으로
 *     재현되고(Δ +0.5/+5), 「단벽」도 아니다 — 꼭대기 띠 8mm 가 있는 두꺼운 벽이다(유니다와 같은 계열).
 * 근거: 코리팩 견적용칼선 PDF의 접는선 좌표를 전수 추출해 패널 치수 역산
 *   (W = 바닥 폭, D = 바닥 깊이, H = 측벽 높이)
 *   오호라   139.5×148×54  → 실측 400.0×478.5 / 공식 400.0×477.5  (Δ0/−1)
 *   빈이빈스 269.5×163×79  → 실측 630.0×582.5 / 공식 630.0×582.5  (Δ0/0)
 *   단       289.5×242×94  → 실측 710.0×785.5 / 공식 710.0×785.5  (Δ0/0)
 *   240522   279.5×242×129 → 실측 840.0×890.5 / 공식 840.0×890.5  (Δ0/0)
 * ✓ G형A 350×280×70 → 674.5×789.5, 견적서 재단 900×680 에 회전 1up 성립
 *   (기존 gtype 공식은 1484×981 로 물리적으로 불가 → D·H 역할이 뒤바뀌어 있었음)
 *
 * ★ 26-10-02 — **실물 견적서가 이 식을 받친다**(26-03-16 크리아 · 마스크 패키지 G형 270×370×70 · AB400 · 4*6전지).
 *   식 594.5×969.5 → 46전지 1up · 지대R 4.8(2,000ea) / 6.8(3,000ea) — **문서의 4.8 / 6.8 과 같다**
 *   (2,000+여분 400 = 2,400장 · 3,000+400 = 3,400장). 견적서 도면에서 읽은 여유분 없는 전개도는
 *   950×550 = (2D+3H) × (W+4H) 이고 소부 재단은 990×590 이다 — 이 식의 뼈대(2D+3H · W+4H)와 같은 꼴이다.
 *   ⚠ 식의 짧은 축 594.5 가 재단 590 을 4.5 넘는다(+44.5 여유분이 이 건에는 크다). up 은 안 갈린다.
 *   게이트: test/verify-dieline 「실물 견적서 대조」.
 * ★ 26-10-02 (2) — **실물 칼선 1건**이 왔다(트렌드스페이스 모자 패키지 `G형220x210x110.pdf` · 26-07-06 견적 · BW350 · 4*6전 · 재단 800×700).
 *   접는선으로 읽은 패널: 긴 축 770.5 = 왼벽 110 · 바닥 219 · 뒷벽 108 · 뚜껑 225.5 · 꽂이 108
 *                        짧은 축 658  = 바닥 211.5 + 위·아래 (3.5 + 벽 109 + 띠 20 + 안벽 90.5) 두 벌
 *   이 식 769.5×704.5 와는 긴 축 Δ−1.0(맞다) · **짧은 축 +46.5(식이 크다)**. 재단 700 을 식(704.5)이 넘고 실물(658)은 안 넘는다.
 *   ⟹ 짧은 축 여유분 +44.5 는 위 bbox 4건(Δ0)이 받치고 이 칼선 1건(실측 +8)이 반대한다. **안 고쳤다** — 4 대 1 이고,
 *      큰 쪽이 안전측이며(up 이 줄거나 같다), 이 건의 판형·up·지대R(46전지 1up · 1.8/2.8R)·지대 금액(689,155 · 1,072,019)은
 *      식 그대로 문서와 **원 단위로 같다.** 하위변종(겹벽에 띠가 있는 것/없는 것)일 가능성이 크다 — 칼선이 더 오면 가른다.
 *   ★ 영상 142545450(분홍 상자를 펼치는 장면)이 이 변종의 위상을 받친다 — **앞벽 한 겹**(뚜껑 꽂이가 반달 홈에 끼워진다) ·
 *     옆벽 두 겹 · 모서리 날개 있음 · 뚜껑 옆 귀. ★ 사용자 결정(26-10-02): **G형 기준은 앞벽 한 겹**이다 — gtype_spec 도 한 겹으로 고쳤다
 *     (규격 도면의 「앞벽 아래 칸」은 실수). 영상 143436612 의 상자는 앞벽을 접어 넘기지만 이 앱의 기준이 아니다.
 *
 * ★★ 26-10-08 — **도면을 그린다(polygon:true).** 사용자: 「더는 G형 칼선을 얻을 수 없다 — 네가 직접 해라 · 검증까지」.
 *   두꺼운 벽 실물 2장(유니다 W94·D100·H75.5 · 아이엠 W394·D130·H45.5 — 같은 설계자)에서 **2/2 로 성립하는 규칙만** 썼다:
 *     가로  안벽 H+6.5(탭 깊이 4 포함) · 띠 8 · 바깥벽 H+7.5 · 바닥 W · 뚜껑 W−14 · 앞벽 W−6
 *     세로  꽂이 H+4.5 · 뚜껑 D+3 · 뒷벽 H+4.5 · 바닥 D · 앞벽 H+2.5
 *     꽂이 어깨  사분원 반지름 min(50, 어깨높이−5) · 모서리 r min(8, 남은 높이)         (유니다 50/8 · 아이엠 42/5)
 *     옆날개    깊이 min(50, 안벽−4) · 비탈 15° · 모서리 r12.5                      (유니다 50 · 아이엠 48 · 둘 다 15°)
 *     모서리날개 뒷벽 D/2−3 · 앞벽 D/2 (위·아래 틈 1.5·3)                           (유니다 47/50 · 아이엠 62/65)
 *     안벽 탭    길이 D/4 · 바닥 중심 ±D/4 · 깊이 4 · 모따기 1.5                     (유니다 25 @±25 · 아이엠 33 @±32.5)
 *   ⚠ 「H 비례」가 아니다 — 옆날개 깊이는 H 가 30 다른 두 장에서 50·48 이다. 표준 50 을 쓰고 얕은 상자에서 줄인다.
 *   ⚠ 전개도 크기는 **위 netSize 식 그대로**다(bbox 4건 · +44.5/+19.5). 실물 2장의 크기(+44/+14.5)보다 0.5/5mm 크다 —
 *     그 차이는 꽂이 끝 위쪽 5mm · 좌우 0.25mm 여백으로 둔다(배치 조각이 덮는다 · 그리지 않는다). 식을 줄이면 견적이 싸진다.
 *   ⚠ 작은 상자 보호(검증: test/gtype-physics 스윕) — 뚜껑이 짧으면 옆날개를 줄이고, 모서리날개는 전개도 밖으로 못 나가게 깎는다.
 *   게이트: verify-dieline 「G형 두꺼운 벽 도면」 — 실물 2장과 윤곽 대조 · 스윕 175건 접기 검사.
 */
import { rect } from "./geometry.mjs";

const SIN15 = Math.sin(Math.PI / 12), COS15 = Math.cos(Math.PI / 12), TAN15 = Math.tan(Math.PI / 12);
/** 식(netSize)이 실물 2장보다 큰 만큼 — 꽂이 끝 위쪽 · 좌우 여백으로 둔다. */
export const SLACK = { x: 0.25, y: 5 };

/** 실물 좌표(여백 전)의 치수 — 도면·검사가 같이 읽는다. */
export function thickGeom(W, D, H) {
  const xIn = H + 6.5, xSt = H + 14.5, xb = 2 * H + 22, xbR = xb + W;
  const xl0 = xb + 7, xl1 = xbR - 7, xf0 = xb + 3, xf1 = xbR - 3;
  const yT = H + 4.5, yL = yT + D + 3, yK = yL + H + 4.5, yB = yK + D, yF = yB + H + 2.5;
  const lidLen = D + 3;
  // 옆날개 — 깊이 min(50, 안벽−4), 뚜껑이 짧으면 비탈·모서리를 줄인다(P3)
  let r = Math.min(12.5, Math.max(0, (lidLen / 2 - 1.5) / 2 / COS15));
  let E = Math.min(50, xIn - 4);
  const Emax = 1.1 + (1 - SIN15) * r + Math.max(0, lidLen / 2 - 1.5 - COS15 * r) / TAN15;
  E = Math.max(0, Math.min(E, Emax, xl0));
  if (E < 1.1 + (1 - SIN15) * r) r = Math.max(0, (E - 1.1) / (1 - SIN15));
  const drop = Math.max(0, (E - 1.1 - (1 - SIN15) * r) * TAN15);
  // 꽂이 어깨
  const S = yT - 3;
  const R = Math.max(0, Math.min(50, S - 5, E));
  const rc = Math.max(0, Math.min(8, S - R));
  // 모서리 날개 — 전개도 밖으로 못 나간다
  const fb = Math.max(0, Math.min(D / 2 - 3, xb));
  const ff = Math.max(0, Math.min(D / 2, xf0));
  const tl = D / 4, cB = (yK + yB) / 2;
  return { xIn, xSt, xb, xbR, xl0, xl1, xf0, xf1, yT, yL, yK, yB, yF, lidLen, E, r, drop, R, rc, fb, ff, tl, cB,
           W: 2 * xb + W, H: yF };
}

export function thickPieces(W, D, H) {
  const g = thickGeom(W, D, H);
  const { xIn, xSt, xb, xbR, xl0, xl1, xf0, xf1, yT, yL, yK, yB, yF, E, r, drop, R, rc, fb, ff, tl, cB } = g;
  const mid = (xb + xbR) / 2;
  const L = [];
  const arc = (cx, cy, rad, a0, a1, n = 6) => { for (let i = 1; i <= n; i++) { const t = a0 + (a1 - a0) * i / n; L.push([cx + rad * Math.cos(t), cy + rad * Math.sin(t)]); } };
  // 꽂이 끝 → 어깨(사분원) → 세로 → 모서리 → 뿌리 → 뚜껑 모서리
  L.push([mid, 0], [xb + 1.5, 0], [xb, 1.5]);
  arc(xb, 1.5 + R, R, -Math.PI / 2, -Math.PI, 8);
  L.push([xb - R, yT - 1.5 - rc]);
  arc(xb - R + rc, yT - 1.5 - rc, rc, Math.PI, Math.PI / 2, 4);
  L.push([xl0 - 1.5, yT - 1.5]);
  arc(xl0 - 1.5, yT, 1.5, -Math.PI / 2, 0, 2);
  // 옆날개 (위 반) — 15° 비탈 → 모서리 r → 세로
  const xEar = xl0 - E;
  const ty = yT + 1.5 + drop, cy = ty + r * COS15;
  L.push([xl0 - 1.1, yT + 1.5], [xEar + (1 - SIN15) * r, ty]);
  arc(xEar + r, cy, r, -Math.PI + Math.PI * 75 / 180, -Math.PI, 4);
  // 아래 반(뚜껑 가운데 기준 거울)
  const ym = (yT + yL) / 2, cy2 = 2 * ym - cy, ty2 = 2 * ym - ty;
  L.push([xEar, cy2]);
  arc(xEar + r, cy2, r, Math.PI, Math.PI - Math.PI * 75 / 180, 4);
  L.push([xl0 - 1.1, yL - 1.5], [xl0, yL]);
  // 뒷벽 모서리날개 → 바깥벽 윗변 틈 → 띠 → 안벽(탭) → 띠 → 바깥벽 아랫변 → 앞벽 모서리날개
  L.push([xl0 - 1.5, yL + 1.5], [xb - fb, yL + 1.5], [xb - fb, yK - 3], [xb - 1.5, yK - 3], [xb, yK - 1.5], [xb - 1.5, yK]);
  L.push([xSt, yK], [xIn, yK + 3], [4, yK + 3]);
  const tabs = [];
  for (const c of [cB - tl, cB + tl]) {
    L.push([4, c - tl / 2], [0, c - tl / 2 + 1.5], [0, c + tl / 2 - 1.5], [4, c + tl / 2]);
    tabs.push([c - tl / 2, c + tl / 2]);
  }
  L.push([4, yB - 3], [xIn, yB - 3], [xSt, yB], [xb + 1.5, yB], [xf0, yB + 1.5], [xb + 1.5, yB + 3]);
  L.push([xf0 - ff, yB + 3], [xf0 - ff, yF], [mid, yF]);
  const Lc = L.filter((p, i) => i === 0 || Math.abs(p[0] - L[i - 1][0]) > 1e-9 || Math.abs(p[1] - L[i - 1][1]) > 1e-9);
  const Rr = Lc.slice().reverse().map(([px, py]) => [2 * mid - px, py]);
  const sh = ([px, py]) => [px + SLACK.x, py + SLACK.y];
  const outline = [...Lc, ...Rr.slice(1), Lc[0]].map(sh);
  const seg = (a, b) => [sh(a), sh(b)];
  const folds = [
    seg([xl0, yT], [xl1, yT]), seg([xl0, yL], [xl1, yL]), seg([xb, yK], [xbR, yK]), seg([xf0, yB], [xf1, yB]),
    seg([xl0, yT], [xl0, yL]), seg([xl1, yT], [xl1, yL]),
    seg([xb, yL], [xb, yK]), seg([xbR, yL], [xbR, yK]),
    seg([xb, yK], [xb, yB]), seg([xbR, yK], [xbR, yB]),
    seg([xSt, yK], [xSt, yB]), seg([2 * mid - xSt, yK], [2 * mid - xSt, yB]),
    seg([xIn, yK + 3], [xIn, yB - 3]), seg([2 * mid - xIn, yK + 3], [2 * mid - xIn, yB - 3]),
    seg([xf0, yB], [xf0, yF]), seg([xf1, yB], [xf1, yF]),
  ];
  // 배치 조각 — 윤곽을 덮는 축정렬 사각형 11개(안 겹침). 위·좌우 여백까지 덮어 bbox = netW×netH 가 된다.
  const NW = g.W + 2 * SLACK.x, NH = yF + SLACK.y;
  const X = v => v + SLACK.x, Y = v => v + SLACK.y;
  const pieces = [
    rect(X(xb), 0, X(xbR), NH),
    rect(X(xb - R), 0, X(xb), Y(yT)), rect(X(xbR), 0, X(xbR + R), Y(yT)),
    rect(X(Math.min(xEar, xb)), Y(yT), X(xb), Y(yL)), rect(X(xbR), Y(yT), X(Math.max(2 * mid - xEar, xbR)), Y(yL)),
    rect(X(xb - fb), Y(yL), X(xb), Y(yK)), rect(X(xbR), Y(yL), X(xbR + fb), Y(yK)),
    rect(0, Y(yK), X(xb), Y(yB)), rect(X(xbR), Y(yK), NW, Y(yB)),
    rect(X(xf0 - ff), Y(yB), X(xb), NH), rect(X(xbR), Y(yB), X(xf1 + ff), NH),
  ];
  const meta = [
    { panel: 1, part: "body" }, { panel: 1, part: "flap" }, { panel: 1, part: "flap" },
    { panel: 0, part: "flap" }, { panel: 2, part: "flap" }, { panel: 0, part: "flap" }, { panel: 2, part: "flap" },
    { panel: 4, part: "wall" }, { panel: 4, part: "wall" }, { panel: 0, part: "flap" }, { panel: 2, part: "flap" },
  ];
  const lab = (label, x0, x1, yc) => ({ i: label, x0: X(x0), x1: X(x1), y: Y(yc), label });
  const panels = [
    lab("꽂이", xb, xbR, yT / 2), lab("뚜껑", xl0, xl1, (yT + yL) / 2), lab("뒷벽", xb, xbR, (yL + yK) / 2),
    lab("바닥", xb, xbR, (yK + yB) / 2), lab("앞벽", xf0, xf1, (yB + yF) / 2),
    lab("바깥벽", xSt, xb, (yK + yB) / 2), lab("바깥벽", xbR, 2 * mid - xSt, (yK + yB) / 2),
    lab("안벽", 0, xIn, (yK + yB) / 2), lab("안벽", 2 * mid - xIn, g.W, (yK + yB) / 2),
    lab("날개", xEar, xl0, (yT + yL) / 2), lab("날개", xl1, 2 * mid - xEar, (yT + yL) / 2),
  ];
  const geo = { flapBack: fb, flapFront: ff, sideLen: D, earDepth: E, innerH: xIn,
                earGap: 1.5, earSlantY: drop, earR: r * COS15, lidLen: yL - yT, shoulder: R,
                tabs: tabs.map(([a, b2]) => [Y(a), Y(b2)]), innerY0: Y(yK + 3), innerY1: Y(yB - 3) };
  return { pieces, meta, cuts: [outline], folds, panels, geo };
}
export default {
  // verified 는 라벨 문자열이 아니라 필드다 — 표시(✓)는 UI 가 붙인다.
  // 종전 label 에 「✓칼선실측」을 넣었더니 드롭다운 문자열이 곧 근거 표기가 되어
  // 태그 추출(label 첫 낱말)까지 얽혔다.
  id: "gtype_tray", label: "G형 트레이 (두꺼운 옆벽 · 끼움형)", labelJa: "G型トレー（側壁厚め・差込み）",
  tag: "G형트레이",
  verified: "bbox 4건 · 실물 칼선 2건(도면)", polygon: true, thomsonDefault: "g_std",

  netSize(W, D, H, { hangTab = 0 } = {}) {
    return {
      netW: W + 4 * H + 44.5,
      netH: 2 * D + 3 * H + 19.5,
      topLid: 0, botFloor: 0, glueTab: 0,
      noRotate: false, hangTab,
      note: ["G형 트레이 (두꺼운 옆벽)", "bbox 4건 회귀 · 실물 칼선 2장"],
      warning: (H > D / 2)
        ? `높이(${H}) > 깊이/2(${D / 2}) — 산출식 엑셀의 SY01_A 입력범위(높이 ≤ 세로/2) 밖`
        : null,
    };
  },

  // 슬리브 위상이 아니다 — 계약(폴리곤 구조는 flaps 를 준다)용 0 프로파일. 도형은 pieces() 가 만든다.
  flaps: () => ({ type: "panels", top: [0], bot: [0] }),

  pieces(W, D, H) { return thickPieces(W, D, H); },
};

import { useState, useMemo } from "react";

// ══════════════════════════════════════════════════════════════════
// 지종 DB  —  hidden:true 는 데이터 저장용, UI 드롭다운 미표시
// ══════════════════════════════════════════════════════════════════
const PAPERS = [
  // ── 아트보드 ──────────────────────────────────────────────────
  { id:"AB270",   label:"AB 270g",           group:"아트보드" },
  { id:"AB300",   label:"AB 300g",           group:"아트보드" },
  { id:"AB350",   label:"AB 350g",           group:"아트보드" },
  { id:"AB400",   label:"AB 400g",           group:"아트보드" },
  // ── 라이트 ────────────────────────────────────────────────────
  { id:"AB295L",  label:"AB라이트 295g",     group:"라이트"   },
  { id:"ABL270",  label:"A라이트 270g",      group:"라이트"   },
  { id:"ABL325",  label:"AB라이트 325g",     group:"라이트"   },
  // ── 아코팩 ────────────────────────────────────────────────────
  { id:"ACPK300", label:"아코팩 300g",       group:"아코팩"   },
  { id:"ACPK350", label:"아코팩 350g",       group:"아코팩"   },
  // ── 뉴티 / CCP ────────────────────────────────────────────────
  { id:"NTR300",  label:"뉴티락 300g",       group:"뉴티계열" },
  { id:"NTP350",  label:"뉴티팩 350g",       group:"뉴티계열" },
  { id:"CCP300",  label:"CCP 300g",          group:"뉴티계열" },
  { id:"CCP350",  label:"CCP 350g",          group:"뉴티계열" },
  // ── 스노우 / 마니라 (최저가 계열) ─────────────────────────────
  { id:"SC300",   label:"SC 300g (스노우)",  group:"스노우"   },
  { id:"SC350",   label:"SC 350g (스노우)",  group:"스노우"   },
  { id:"SC400",   label:"SC 400g (스노우)",  group:"스노우"   },
  { id:"MNR300",  label:"마니라 300g",       group:"스노우"   },
  // ── 알리킹 ────────────────────────────────────────────────────
  { id:"ALK325",  label:"알리킹 325g",       group:"알리킹"   },
  // ── B / IV / BW ───────────────────────────────────────────────
  { id:"B350",    label:"B 350g",            group:"B·IV계열" },
  { id:"IV300",   label:"IV 300g",           group:"B·IV계열" },
  { id:"BW350",   label:"BW 350g",           group:"B·IV계열" },
  // ── 고급·수입지 ───────────────────────────────────────────────
  { id:"NEB350",  label:"블랙지 350g",   group:"고급지"   },
  { id:"DSDM308", label:"두성 디프매트 308g",group:"고급지"   },
  { id:"MK350",   label:"밍크지 Bold 350g",  group:"고급지"   },
  { id:"BT350",   label:"뷰티팩 350g",       group:"고급지"   },
  // ── 인쇄용지 (싸바리 표지·동봉물) ─────────────────────────────
  { id:"ART140",  label:"140 편아트",        group:"인쇄용지" },
  { id:"ART150",  label:"150 아트지",        group:"인쇄용지" },
];

// ══ 지대 단가 테이블 ═══════════════════════════════════════════════
// [paperId][sheetId] = 원/R  ·  1R = 500 × 절수 장
// 값 뒤 주석 = 근거 견적서 날짜 (같은 지종·판형이 여러 번 나오면 최근 값 채택)
const PRICE_TABLE = {
  "AB270":   { "4x62":231140,                                                  "custom":271750 }, // 25-12 주문생산A
  "AB300":   { "4x64":323454 },                                                                   // 26-07-06 스타킹
  "AB350":   { "ha4":492286,  "4x62":378612, "4x64":399651, "guk2":292530 },                      // 26-04-15 / 26-03-13 / 26-04-22
  "AB400":   { "ha3":561100,  "4x62":427672, "4x64":431272, "guk2":300888, "46":455232 },         // 26-06-09 / 26-04-06 / 26-07-28 / 26-03-16
  "AB295L":  { "ha4":300747,  "4x62":318438, "4x63":300747, "4x64":283056 },                      // 26-03-18 / 26-03-12 / 26-05-28
  "ABL270":  { "ha2":319600 },                                                                    // 26-04-06
  "ABL325":  { "46":351036,   "4x62":312032, "guk":243216 },                                      // 26-04-06
  "ACPK300": { "4x64":357500 },
  "ACPK350": { "4x62":580000, "4x64":517000 },                                                    // 26-03-12
  "NTR300":  { "4x64":358760 },                                                                   // 26-05-19
  "NTP350":  { "4x64":376695 },                                                                   // 26-05-26
  "CCP300":  { "4x64":386260 },                                                                   // 26-05-19
  "CCP350":  { "ha4":547615 },
  "SC300":   { "4x64":268580 },                                                                   // 26-02-24 슬리브3종
  "SC350":   { "4x64":190395 },                                                                   // 26-04-06
  "SC400":   { "4x64":213624 },                                                                   // 26-04-06
  "MNR300":  { "4x64":163236 },                                                                   // 26-06-17 슬리브 (도면 지종표기 「마니라(300)」)
  "ALK325":  { "4x62":253890, "guk2":217217, "ha2":311922 },
  "B350":    { "4x62":425405 },                                                                   // 26-03-12
  "IV300":   { "guk2":147582 },                                                                   // 26-06-24 맞뚜껑A
  "BW350":   { "46":382864 },                                                                     // 26-07-06 G형B
  "NEB350":  { "4x62":660000 },                                                                   // 26-06-24 UV건
  "DSDM308": { "4x64":1160000 },                                                                  // 26-04-22 트레이B
  "MK350":   { "ha4":743200,  "4x64":743200 },
  "BT350":   { "ha4":465098 },
  "ART140":  { "guk2":86420,  "4x62":124400, "ha2":154400 },                                      // 26-07 / 26-07-27 / 26-01-29
  "ART150":  { "guk2":93280 },                                                                    // 26-06-09
};

/**
 * 지대 단가 (원/R) — 룩업 우선, 미확인 시 면적비례 추정
 * @returns { price, confirmed }
 */
// ══════════════════════════════════════════════════════════════════
// 원지 규격 DB  —  docs/ 견적서 78건 「단위」열 역산 (2026-07)
//
// ▶ 원지 3계열 × 절수. 판형 크기 = 원지를 절수만큼 나눈 값
//     사륙(4×6) 전지  788 × 1091
//     국전지          636 × 939
//     하드롱 전지     889 × 1194
// ▶ 절수 = 전지 1장에서 나오는 장수.  1R(1연) = 500 × 절수 장
//     전지(1) 500장 / 2절 1,000장 / 3절 1,500장 / 4절 2,000장
// ▶ 견적서 「단위」열(760×480, 980×720 …)은 원지 규격이 아니라
//   실제 주문 재단 크기 — 전건이 아래 최대 크기 이내에 들어감 ✓
//   4절(4×64 394×545 / 하4 444×597 / 국2 636×469)은 전건 규격 고정,
//   전지·2절급은 필요한 크기로 재단해서 씀.
// ══════════════════════════════════════════════════════════════════
const BASE_SHEETS = [
  // ── 사륙(4×6) 계열 : 전지 788×1091 ──────────────────────────────
  { id:"46",   label:"46전지 (788×1091)", w:788, h:1091, cut:1, family:"사륙"   },
  { id:"4x62", label:"4×62  (788×545)",   w:788, h:545,  cut:2, family:"사륙"   },
  { id:"4x63", label:"4×63  (788×363)",   w:788, h:363,  cut:3, family:"사륙"   },
  { id:"4x64", label:"4×64  (394×545)",   w:394, h:545,  cut:4, family:"사륙"   },
  // ── 국전 계열 : 전지 636×939 ────────────────────────────────────
  { id:"guk",  label:"국전  (636×939)",   w:636, h:939,  cut:1, family:"국전"   },
  { id:"guk2", label:"국2   (636×469)",   w:636, h:469,  cut:2, family:"국전"   },
  // ── 하드롱 계열 : 전지 889×1194 ─────────────────────────────────
  { id:"ha",   label:"하전지 (889×1194)", w:889, h:1194, cut:1, family:"하드롱" },
  { id:"ha2",  label:"하2   (889×597)",   w:889, h:597,  cut:2, family:"하드롱" },
  { id:"ha3",  label:"하3   (889×398)",   w:889, h:398,  cut:3, family:"하드롱" },
  { id:"ha4",  label:"하4   (444×597)",   w:444, h:597,  cut:4, family:"하드롱" },
  // ── 주문생산 (코리팩 재단 — 크기·절수 직접 입력) ─────────────────
  { id:"custom", label:"주문생산 (직접입력)", w:890, h:670, cut:2, family:"주문", custom:true },
];

/** 1R(1연) 장수 = 500 × 절수 */
function sheetsPerR(sheet) { return 500 * (sheet?.cut || 2); }

/** 판형 크기 구간: 4절 / 2·3절 / 전지 — 공정 단가 티어 결정 */
function sheetTier(sheet) {
  if (!sheet) return "mid";
  if (sheet.cut >= 4) return "small";
  if (sheet.cut === 1) return "large";
  return "mid";
}

/**
 * 지대 단가 (원/R)
 * 룩업 우선 → 없으면 같은 지종의 확인된 판형에서 **장당 단가 × 면적비**로 환산
 * (R당 단가를 그대로 면적비례하면 절수 차이 때문에 크게 틀림)
 * 검증: AB350 4×64 399,651(2,000장) → 하4 추정 493,400 / 실측 492,286 (오차 0.2%)
 */
function getPaperPriceInfo(paperId, sheetId, mPriceVal, customSheet) {
  if (mPriceVal && parseFloat(mPriceVal) > 0)
    return { price: parseFloat(mPriceVal), confirmed: true, manual: true };
  if (!PAPERS.find(p => p.id === paperId)) return { price: 0, confirmed: false, noData: true };

  const tablePrice = PRICE_TABLE[paperId]?.[sheetId];
  if (tablePrice) return { price: tablePrice, confirmed: true };

  const base = BASE_SHEETS.find(s => s.id === sheetId);
  if (!base) return { price: 0, confirmed: false, noData: true };
  const sheet = (base.custom && customSheet) ? { ...base, ...customSheet } : base;
  const targetArea    = sheet.w * sheet.h;
  const targetPerR    = sheetsPerR(sheet);

  const refs = Object.entries(PRICE_TABLE[paperId] || {}).map(([refId, refPrice]) => {
    const rs = BASE_SHEETS.find(s => s.id === refId);
    if (!rs || refId === "custom") return null;
    return { id: refId, perSheet: refPrice / sheetsPerR(rs), area: rs.w * rs.h };
  }).filter(Boolean);
  if (!refs.length) return { price: 0, confirmed: false, noData: true };

  // 면적이 가장 가까운(로그 거리 최소) 판형을 기준으로 장당 단가 환산
  refs.sort((a, b) =>
    Math.abs(Math.log(a.area / targetArea)) - Math.abs(Math.log(b.area / targetArea)));
  const ref = refs[0];
  return {
    price: Math.round(ref.perSheet * (targetArea / ref.area) * targetPerR),
    confirmed: false,
    estimateFrom: ref.id,
  };
}
function getPaperPrice(paperId, sheetId, mPriceVal, customSheet) {
  return getPaperPriceInfo(paperId, sheetId, mPriceVal, customSheet).price;
}

// ══════════════════════════════════════════════════════════════════
// 박스 구조(Type) DB
// ══════════════════════════════════════════════════════════════════
const BOX_TYPES = [
  { id:"tuck_both",  label:"맞뚜껑 (상하 텍 클로저)"    },
  { id:"cross",      label:"십자조립 (크로스바텀)"       },
  { id:"glue_3side", label:"삼면접착"                    },
  { id:"gtype",      label:"G형 (톰슨조립)"             },
  { id:"gtype_tray", label:"G형 트레이 (뚜껑일체) ✓칼선실측" },
];

// ══════════════════════════════════════════════════════════════════
// 구조별 전개도 치수 계산
// ══════════════════════════════════════════════════════════════════
// ── 물림(gripper) ─────────────────────────────────────────────────
// 코리팩 산출식 엑셀 「종이 규격」(B14) vs 「제작 규격(여분제외)」(B15) 차이:
//   788×1091 → 758×1071  /  545×788 → 515×768  /  394×545 → 364×525
//   636×939  → 606×919   /  469×636 → 436×616  /  450×600 → 420×580
// → 짧은변 −30mm, 긴변 −20mm (국이절만 −33). 균일값이 아니라 비대칭.
const BITE_SHORT = 30;   // 짧은변(가로) 물림
const BITE_LONG  = 20;   // 긴변(세로) 물림
const BITE_MM    = BITE_LONG;   // 시각화 여백 표시용

// 배치 판정 허용오차 — 전개도 공식 자체가 ±5mm 정확도이므로 임계점에서
// up 이 한 단계 튀는 것을 막는다.
//   ✓ 삼면E 90×70×130: 실측 칼선 265.0 은 회전 2열(2×265−10=520 ≤ 525) 로 2up.
//     공식이 268.0 으로 3mm 크게 나와 허용오차 0 이면 1up 으로 떨어짐 → 0.5%로 회복
const FIT_TOL = 0.005;

// 배치 상한 — **발자국(배치 외곽 ÷ 판형)** 기준.
//   종전에는 up × netW × netH ÷ 판형(=「수율」)로 컷했는데, 맞물림 배치에서는
//   netW×netH 가 전개도의 빈 모서리를 포함하므로 실제보다 과대평가된다.
//   예) 맞뚜껑A 92×13×140 국2 6up : 수율 90% 지만 발자국은 82%
//       → 종전 85% 컷이 견적서와 일치하는 6up 을 잘못 걸러냈음
//   발자국은 구조적으로 100%를 넘을 수 없고, 실측 최대는 82%.
const MAX_FOOT_PCT = 92;

// ── 인쇄기 최대 판 크기 ────────────────────────────────────────────
// 견적서 99장의 「단위」(= 실제 주문 재단 크기) 전건이 990×720 이내.
//   최대 긴변  990mm (G형C 46전지 990×590)
//   최대 짧은변 720mm (삼면B 46전지 980×720)
// → 전지급(46전지 788×1091 / 하전지 889×1194)은 인쇄기에 통째로 안 들어가서
//   990×720 이하로 재단해 씀. 그래서 판걸이 up이 원지 최대치보다 적게 나옴.
//   ✓ 삼면B 210×90×180: 원지기준 4up → 인쇄기제약 3up (견적서 3up)
//   ✓ G형C G형:         원지기준 2up → 인쇄기제약 1up (견적서 1up)
const PRESS_MAX_LONG  = 990;
const PRESS_MAX_SHORT = 720;

/** 판형 ∩ 인쇄기 최대 → 실제 인쇄 가능한 판 크기 (긴변, 짧은변) */
function effectiveSheet(sw, sh) {
  const long  = Math.min(Math.max(sw, sh), PRESS_MAX_LONG);
  const short = Math.min(Math.min(sw, sh), PRESS_MAX_SHORT);
  return { long, short, capped: long < Math.max(sw, sh) || short < Math.min(sw, sh) };
}

function calcNetSize(W, D, H, boxType = "tuck_both", hangTab = 0) {
  // ── G형 (톰슨조립) — 하나의 박스 타입, D/H 비율로 공식만 자동 분기 ──
  // 구조상 거싯/트레이 구분 없이 같은 톰슨조립 박스이나,
  // 실측 데이터상 박스 깊이 비율에 따라 두 가지 패턴이 확인됨:
  //   D/H > 0.8 → garo=W+4D+14, sero=2H+3D+1  (덮개·바닥 긴 구조)
  //     ✓ 315×126×113 → 781×592
  //     ✓ 315×113×126 → 833×605
  //   D/H ≤ 0.8 → garo=W+2D+14, sero=H+2D    (덮개·바닥 짧은 구조, 판걸이 회전없음)
  //     ✓ 180×120×85 / 300×200×70 / 300×100×70 / 270×370×70
  //   ⚠ D/H<0.2 극단 평판 → 공식 미확정 (예: 323×234×36은 실제 571×507)
  // ── G형 트레이 (뚜껑일체) — 견적용 칼선 PDF 4건 회귀로 확정 ──────
  //   전개도 가로 = W + 4H + 44.5
  //   전개도 세로 = 2D + 3H + 19.5
  // 근거: 코리팩 견적용칼선 PDF의 접는선 좌표를 전수 추출해 패널 치수 역산
  //   (W = 바닥 폭, D = 바닥 깊이, H = 측벽 높이)
  //   오호라   139.5×148×54  → 실측 400.0×478.5 / 공식 400.0×477.5  (Δ0/−1)
  //   빈이빈스 269.5×163×79  → 실측 630.0×582.5 / 공식 630.0×582.5  (Δ0/0)
  //   단       289.5×242×94  → 실측 710.0×785.5 / 공식 710.0×785.5  (Δ0/0)
  //   240522   279.5×242×129 → 실측 840.0×890.5 / 공식 840.0×890.5  (Δ0/0)
  // ✓ G형A 350×280×70 → 674.5×789.5, 견적서 재단 900×680 에 회전 1up 성립
  //   (기존 gtype 공식은 1484×981 로 물리적으로 불가 → D·H 역할이 뒤바뀌어 있었음)
  if (boxType === "gtype_tray") {
    return {
      netW: W + 4 * H + 44.5,
      netH: 2 * D + 3 * H + 19.5,
      topLid: 0, botFloor: 0, glueTab: 0,
      isGtype: true, gtypeNoRotate: false, hangTab,
      gtypeRatio: D / H,
      gtypeWarning: (H > D / 2)
        ? `높이(${H}) > 깊이/2(${D/2}) — 산출식 엑셀의 SY01_A 입력범위(높이 ≤ 세로/2) 밖`
        : null,
    };
  }
  if (boxType === "gtype") {
    const ratio = D / H;
    const useExtended = ratio > 0.8;
    let warning = null;
    if (ratio >= 0.7 && ratio <= 0.9) {
      warning = `D/H=${ratio.toFixed(2)} 경계값 — 공식 정확도 낮을 수 있음`;
    } else if (ratio < 0.2) {
      warning = `D/H=${ratio.toFixed(2)} 극단 평판 — 공식 오차 가능`;
    }
    if (useExtended) {
      return {
        netW: W + 4 * D + 14,
        netH: 2 * H + 3 * D + 1,
        topLid: 0, botFloor: 0, glueTab: 14,
        isGtype: true, gtypeNoRotate: false, hangTab,
        gtypeRatio: ratio, gtypeWarning: warning,
      };
    } else {
      return {
        netW: W + 2 * D + 14,
        netH: H + 2 * D,
        topLid: 0, botFloor: 0, glueTab: 14,
        isGtype: true, gtypeNoRotate: true, hangTab,
        gtypeRatio: ratio, gtypeWarning: warning,
      };
    }
  }
  // ── 기존 구조 ─────────────────────────────────────────────────
  // 전개도 가로 = 2(W + D) + 접착날개 14.3
  //   실제 발주 규격이 확인된 칼선 3건이 **전부 정확히 14.3** (오차 0.0):
  //     삼면E  90×70   → 2(W+D)=320.0, 실측 334.3  → 14.3
  //     칼선-06  50×50   → 200.0, 실측 214.3  → 14.3
  //     칼선-05    47×47   → 188.0, 실측 202.3  → 14.3
  //   (규격 미확인 칼선 4건은 12.5~24 로 흩어짐 — 패널 폭을 접는선에서 추정했기 때문)
  //   회귀계수도 2.09·W + 1.86·D 로 2·2 수렴 확인.
  const GLUE_TAB = 14.3;   // 접착날개 (대형 250mm+ 는 24 내외)
  const glueTab = GLUE_TAB;
  const netW = 2 * (W + D) + GLUE_TAB;

  let topLid, botFloor;
  switch (boxType) {
    case "tuck_both":
      // ── 맞뚜껑 — 견적용 칼선 칼선-07 2건 실측 (규격 확인분) ──────────
      //   상하 대칭. 한쪽 날개 = 뚜껑패널(≈D) + 텍탭(≈16.5)
      //   netH = H + 2·(D + 16.5) = H + 2D + 33
      //
      //   칼선      W×D×H            실측 세로  공식    Δ
      //   칼선-07   150×69.5×149      321.0    321.0   0.0
      //   칼선-08  150×69.5×219      391.0    391.0   0.0
      //   → 종전 공식(D/2+20 / D/2+15)은 두 건 모두 −67.5mm 부족
      //
      //   칼선-07 접는선 실측: [탭 19.0][뚜껑 21.0+45.5=66.5][몸판 H][66.5][19.0]
      //   66.5 ≈ D−3 (여유), 19.0 = 텍탭
      //
      // ✓ 맞뚜껑A 92×13×140 국2: 224×199 → 회전 3×2 = 6up (견적서 6up 일치)
      //   종전 공식(224×258)으로는 4up 밖에 안 나왔음
      topLid   = D + 16.5;
      botFloor = D + 16.5;
      break;
    case "cross":
      // ✓ 실측 역산 확정: total_tuck = 7D/4 + 11
      //   70×70×151.5 → 303.33×285(실측) → topLid=66.75, netH=285 ✓
      //   80×20×49    → 211×95(실측)      → topLid=23,    netH=95  ✓
      topLid   = D * 7/8 + 5.5;
      botFloor = D * 7/8 + 5.5;
      break;
    case "glue_3side":
      // ── 삼면접착 자동바닥(크래시록) — 실측 칼선 7건 회귀 ──────────────
      //   뚜껑쪽   = 0.88·D + 0.09·W + 20.6
      //   바닥날개 = 0.33·D + 0.15·W + 11.0   ← 대각 크래시록이라 W에도 의존
      //   합계 netH = H + 1.2·D + 0.25·W + 31.5
      //
      //   칼선        W×D×H            실측 세로  공식    Δ
      //   칼선-01      45  ×33.75×109.5   193.2   192.8  −0.4
      //   칼선-02    71  ×69.5 ×175.5   307.0   308.1  +1.1
      //   칼선-03   100  ×81   × 50     206.0   203.7  −2.3
      //   칼선-04    265.5×124  ×243      490.0   489.7  −0.3
      //   삼면E    90  ×70   ×130     265.0   268.0  +3.0   ★견적서 2up 건
      //   칼선-06    50  ×50   ×150     263.0   254.0  −9.0
      //   칼선-05      47  ×47   ×100     219.1   199.7  −19.4
      //   → 평균절대오차 5.1mm
      //
      // ※ 종전 공식(0.059D+12.65 / 0.65D+4)은 같은 7건에서 −43~−142mm,
      //   평균 75.9mm 부족했음. 맞뚜껑(D+35)보다도 작은 값이라 실측과 무관.
      // ※ 삼면E은 견적서(4×64 2up) 건이면서 자동바닥 칼선이 확보된 유일한 교차검증:
      //   실측 334.3×265.0 → 회전 2열(2×265−10=520 ≤ 525) 로 2up 성립 ✓
      //   즉 견적서의 「삼면접착단상자」와 칼선의 자동바닥은 **같은 구조**.
      topLid   = D * 0.88 + W * 0.09 + 20.6;
      botFloor = D * 0.33 + W * 0.15 + 11.0;
      break;
    default:
      topLid   = D / 2 + 20;
      botFloor = D / 2 + 15;
  }
  const netH = H + topLid + botFloor;
  return { netW, netH, topLid, botFloor, glueTab, hangTab };
}

// ══════════════════════════════════════════════════════════════════
// 맞물림(interlocking) 판걸이 계산 — 코리팩 산출식 엑셀 기준
//
// 출처: 「패키지 단가 산출식_엑셀_SB01_B형 맞뚜껑_190916_07.xlsx」
//       시트 '가격산출 조건표' D389:D396
//
//   종이 재단 가로 : 1열 (가로+세로)*2+35
//                   2열 [ ]*2 − 10   3열 [ ]*3 − 20   4열 [ ]*4 − 30
//   종이 재단 세로 : 1열 (세로*2+높이)+50
//                   2열 [ ]*2 − 25   3열 [ ]*3 − 50   4열 [ ]*4 − 75
//
// → 열이 늘 때마다 **일정량이 선형으로 깎임**:
//     가로 IL_W = 10mm/열   (접착날개끼리 겹침)
//     세로 IL_H = 25mm/열   (B형 맞뚜껑 D=60 한 케이스 값 → 아래에서 일반화)
//   n열 총길이 = base × n − IL × (n−1)
//
// ✓ 엑셀 자체 예시(180×60×190) 8개 값 전부 재검산 일치
//   baseW 515 / 2열 1020 / 3열 1525 / 4열 2030
//   baseH 360 / 2열  695 / 3열 1030 / 4열 1365
//
// ⚠ 종전 코드는 "2장씩 쌍으로 맞물린다(pairH = 2×netH − overlap)"는 모델이었음.
//   실제는 쌍이 아니라 **열마다 누적 선형 차감**이라 결과가 다름.
//
// ⚠ up은 이 계산만으로 확정되지 않음 — 실제 목형 설계에 달림:
//     맞뚜껑A 92×13×140  계산 4up  <  견적서 6up
//     맞뚜껑B  150×20×150  계산 4up  >  견적서 2up
//   → 발주서·기존 목형의 up을 알면 「판걸이(up) 직접 입력」을 쓰는 게 정확함.
// ══════════════════════════════════════════════════════════════════
// 가로(netW 축, 접착날개끼리 맞닿음) — 엑셀 산출식 값 그대로
const IL_W = 10;
// 세로(netH 축, 뚜껑↔바닥이 맞닿음) — **바닥날개 깊이만큼** 물린다.
//   엑셀의 25mm 는 B형 맞뚜껑(D=60, 바닥날개 ≈ 30) 한 케이스 값이었고,
//   구조·치수에 따라 크게 달라진다. 견적서 10건 역산 결과:
//     IL_H = 바닥날개 → up 8/10   (고정 25mm → 6/10)
//     예) 삼면B 바닥 72 → 회전 3열 3up ✓ / 삼면A 바닥 47 → 회전 2열 2up ✓
//   바닥날개가 없는 구조(G형 트레이·전개도 직접입력)는 엑셀 기본값 25 사용
const IL_H_FALLBACK = 25;
const ilH = botFloor => (botFloor > 0 ? botFloor : IL_H_FALLBACK);
const spanW = (base, n) => base * n - IL_W * (n - 1);
const spanH = (base, n, ih) => base * n - ih * (n - 1);

/** 맞물림 적용 시 limit 안에 들어가는 최대 열 수 */
function maxCols(base, limit, il) {
  if (base <= 0 || limit < base) return 0;
  // base*n - il*(n-1) <= limit  →  n <= (limit - il) / (base - il)
  const n = (base > il) ? Math.floor((limit - il) / (base - il)) : 99;
  return Math.max(1, Math.min(n, 99));
}
// hangTab: 행거탭(유로홀) 돌출 mm — 위쪽 한 곳만 튀어나오므로 맞물림 배치에서
//   옆 열의 빈 공간에 끼워진다 → **피치에는 안 더하고 외곽에 한 번만** 더한다.
//   ✓ 맞뚜껑A 92×13×140 국2: 행거탭 15mm 를 외곽에만 더하면 6up 유지(견적서 일치),
//     netH 에 그냥 합산하면 4up 으로 어긋남
function getLayoutInfo(netW, netH, sheetW0, sheetH0, glueTab = 14.3, topLid = 0, botFloor = 0, gtypeNoRotate = false, hangTab = 0) {
  // 인쇄기 최대 판(990×720)으로 클램프 — 전지급은 여기서 재단됨
  const es = effectiveSheet(sheetW0, sheetH0);
  const sheetW = es.long, sheetH = es.short;   // 긴변을 가로축으로 정규화
  const printW = (sheetW - BITE_LONG)  * (1 + FIT_TOL);   // 긴변 −20
  const printH = (sheetH - BITE_SHORT) * (1 + FIT_TOL);  // 짧은변 −30

  const candidates = [];

  const HT = hangTab || 0;   // netH 축에 1회만 더해지는 돌출
  const ih = ilH(botFloor);  // 세로 맞물림 = 바닥날개 깊이

  // ① 노말
  {
    const c = Math.floor(printW / netW);
    const r = Math.floor((printH - HT) / netH);
    if (c > 0 && r > 0)
      candidates.push({ cols:c, rows:r, up:c*r, rotated:false, interlocked:false, boxW:netW, boxH:netH });
  }

  // ② 회전 90° — G형 조립트레이(gtype_b)는 스킵 (교차형 전개도는 회전 불가)
  if (!gtypeNoRotate) {
    const c = Math.floor((printW - HT) / netH);
    const r = Math.floor(printH / netW);
    if (c > 0 && r > 0)
      candidates.push({ cols:c, rows:r, up:c*r, rotated:true, interlocked:false, boxW:netH, boxH:netW });
  }

  // ③ 맞물림 — 엑셀 산출식 모델 (열마다 IL_W/IL_H 만큼 누적 차감)
  //    가로축·세로축 각각 독립적으로 맞물림
  {
    const c = maxCols(netW, printW, IL_W);
    const r = maxCols(netH, printH - HT, ih);
    if (c > 0 && r > 0 && c * r > 0)
      candidates.push({ cols:c, rows:r, up:c*r, rotated:false, interlocked:c>1||r>1,
                        boxW:netW, boxH:netH,
                        spanW:spanW(netW,c), spanH:spanH(netH,r,ih) + HT,
                        overlapInfo:`맞물림 ↔${IL_W}mm/열 ↕${ih.toFixed(0)}mm/열` });
  }

  // ④ 회전 + 맞물림
  if (!gtypeNoRotate) {
    const c = maxCols(netH, printW - HT, ih);
    const r = maxCols(netW, printH, IL_W);
    if (c > 0 && r > 0 && c * r > 0)
      candidates.push({ cols:c, rows:r, up:c*r, rotated:true, interlocked:c>1||r>1,
                        boxW:netH, boxH:netW,
                        spanW:spanH(netH,c,ih) + HT, spanH:spanW(netW,r),
                        overlapInfo:`맞물림(회전) ↕${ih.toFixed(0)}mm/열 ↔${IL_W}mm/열` });
  }

  // 발자국(배치 외곽 ÷ 판형)이 상한을 넘는 배치는 제외
  // 전부 초과하면 어쩔 수 없이 최소 초과분을 남김 (up=0 회피)
  const sheetArea = sheetW * sheetH;
  const footOf = c => {
    const sw = c.spanW || (c.boxW * c.cols);
    const sh = c.spanH || (c.boxH * c.rows);
    return (sw * sh) / sheetArea * 100;
  };
  const feasible = candidates.filter(c => footOf(c) <= MAX_FOOT_PCT);
  const pool = feasible.length ? feasible : candidates;

  // 최대 up 선택
  pool.sort((a, b) => b.up - a.up);
  const best = pool[0];

  if (!best) {
    return { cols:0, rows:0, up:0, rotated:false, interlocked:false,
             boxes:[], lossPct:100, printW, printH, candidates,
             alt:{ up:0, rotated:false, interlocked:false } };
  }

  // 배치 좌표 생성 — 맞물림은 열마다 IL만큼 앞당겨 앉힘
  // (엑셀 모델: n번째 열의 시작점 = (n-1) × (base − IL))
  const boxes = [];
  // 맞물림 절감은 축별로 다름: netW 반복 → IL_W, netH 반복 → ih
  const ilX = best.rotated ? ih : IL_W;
  const ilY = best.rotated ? IL_W : ih;
  const stepX = best.interlocked ? best.boxW - ilX : best.boxW;
  const stepY = best.interlocked ? best.boxH - ilY : best.boxH;

  for (let r = 0; r < best.rows; r++) {
    for (let c = 0; c < best.cols; c++) {
      boxes.push({
        x: BITE_MM + c * stepX,
        y: BITE_MM + r * stepY,
        w: best.boxW, h: best.boxH,
        // 맞물림 열은 방향을 번갈아 뒤집어 날개끼리 물리게 함
        flipped: best.interlocked && (r % 2 === 1),
        idx: r * best.cols + c,
      });
    }
  }

  const usedArea  = best.up * netW * netH;
  const totalArea = sheetW * sheetH;
  const lossPct   = Math.round((1 - usedArea / totalArea) * 100);

  return { ...best, boxes, lossPct, printW, printH, candidates,
           sheetW, sheetH, pressCapped: es.capped,
           utilPct: Math.round(usedArea / totalArea * 100),
           footPct: Math.round(footOf(best)),
           utilCapped: feasible.length > 0 && feasible.length < candidates.length,
           alt: pool[1] || candidates[1] || { up:0, rotated:false, interlocked:false } };
}

function calcUpOnSheet(netW, netH, sw, sh, glueTab, topLid, botFloor, gtypeNoRotate = false, hangTab = 0) {
  return getLayoutInfo(netW, netH, sw, sh, glueTab, topLid, botFloor, gtypeNoRotate, hangTab).up;
}

// ══════════════════════════════════════════════════════════════════
// [v8] 지대 R수 · 여분(손지) · 공정 R수
//   docs/ 견적서 78건(수량 티어 100여 개) 전수 역산 — 2026-07
//
// ▶ 지대 R수
//     정미(net) = ceil(수량 / up)
//     지대R     = (정미 + 여분) / (500 × 절수)
//                 전지급(절수1) → 0.1R 단위 올림 (= 50장 묶음)
//                 2절 이하      → 소수 3자리 올림
//   검증: 46전지 정미1667+300 = 1967장 → 3.934R → 0.1올림 4.0R ✓ (삼면B 5,000ea)
//         하3 정미5000+300 → 5300/1500 = 3.5333… → 3.534 ✓ (조립형 2종1만)
//         4×63 정미2000+300 → 2300/1500 → 1.534 ✓ (손잡이형)
//
// ▶ 여분(손지) = max(기본, 정미 × 5%)      ※ 전부 "장수" 기준. up을 곱하면 EA 환산
//     기본 300장 (인쇄 없이 박·톰슨만이라면 200장)
//     + 양면인쇄 100장   + 베다(바탕인쇄) 100장   + 형압 50장
//     ※ 박(금박·먹박)은 가산 없음 — 조립형 금박 2건이 여분 300 ✓
//   근거: 견적서 99건 중 정미 6,000장 이하 전건이 정확히 300장.
//         삼면E 견적서에 "500-300"(정미500/여분300) 메모가 직접 남아 있음.
//         양면 +100 은 십자B 한 장 안에서 직접 대조됨:
//           전면별2+후면원색4 → 여분 400 / 전면별2 단면 → 여분 300
//         베다 +100: G형C 별1베다+먹 단면 → 정미 2,000/3,000에 여분 400 ✓ 2건
//         인쇄없음 200: 트레이B(인쇄 무) 500ea → 700장 = 0.35R ✓
//     대량: 정미 8,334 → 416 (5.0%) ✓ / 정미 15,000 → 700 (4.7%) ✓
//
//   EA 환산 예 (46전지 3up, 여분 300장):
//     3,000ea → 정미 1,000 + 300 = 1,300장 × 3up = 3,900EA (여분 900EA) ✓ 견적서 일치
//     5,000ea → 정미 1,667 + 300 = 1,967장 → 0.1올림 2,000장 × 3up = 6,000EA ✓
//
//   ⚠ 재현 안 되는 실측 2건 (여분 수동 입력으로 보정):
//     · 맞뚜껑150×20×150 500ea → 여분 25 (정미 250, 초소량 단발성 이상치)
//     · 주문생산A 주문생산 40,000ea → 여분 800 (계산 500, Δ-0.3R)
//
// ▶ 공정 R수 (인쇄·코팅·톰슨·박·형압·재단) — 판형·절수 무관
//     공정R = ceil( 정미 / 1000 × 10 ) / 10        (0.1R 올림)
//     정미 < 1000장 → 1식 (최소 1R)
//   검증: 정미1667→1.7 ✓ / 8334→8.4 ✓ / 1250→1.3 ✓ / 15000→15 ✓ / 2000→2 ✓
//   ※ 지대는 절수 기준(판형별 1R 장수가 다름), 공정은 무조건 1,000장 = 1R
// ══════════════════════════════════════════════════════════════════

const LOSS_BASE      = 300;   // 기본 여분(장)
const LOSS_BASE_NOPR = 200;   // 인쇄 없음(박·톰슨만) — 색맞춤 손지가 빠짐
const LOSS_RATE      = 0.05;  // 대량 구간 여분율 (정미 6,000장 초과부터 이쪽이 큼)
const LOSS_BOTHSIDES = 100;   // 양면인쇄 가산
const LOSS_BEDA      = 100;   // 베다(바탕 전면 인쇄) 가산 — 잉크량 많아 손지 증가
const LOSS_EMB       = 50;    // 형압 가산 (박은 가산 없음 — 조립형 금박 2건 여분 300)

/** 여분(손지) 장수 — options.manual 이 있으면 그 값을 그대로 사용 */
function estimateLoss(net, options = {}) {
  const manual = parseFloat(options.manual);
  if (manual > 0) return Math.round(manual);
  const base = options.noPrint ? LOSS_BASE_NOPR : LOSS_BASE;
  let loss = Math.max(base, Math.round(net * LOSS_RATE));
  if (options.bothSides) loss += LOSS_BOTHSIDES;
  if (options.beda)      loss += LOSS_BEDA;
  if (options.hasEmb)    loss += LOSS_EMB;
  return loss;
}

/**
 * 지대 R수
 *   전지급(절수 1, 1R=500장) → 0.1R 단위 올림 (= 50장 묶음)
 *     ✓ 실측 전지급 R수는 전부 0.1 배수: 2.6 / 4.0 / 1.8 / 2.8 / 4.6 / 4.8 / 6.8 (7/7)
 *     ✓ 삼면B 46전지 5,000ea: 1,967장 → 3.934R → 0.1올림 4.0R (견적서 일치)
 *   2절 이하 → 계산값 그대로 (소수 3자리 올림)
 *     ✓ 하3 5,300/1,500 = 3.5333… → 3.534 / 4×63 2,300/1,500 → 1.534
 */
function calcR(up, qty, sheet, options = {}) {
  if (!up || up === 0 || !qty) return 0;
  const net  = Math.ceil(qty / up);
  const raw  = (net + estimateLoss(net, options)) / sheetsPerR(sheet);
  return (sheet?.cut === 1)
    ? Math.ceil(raw * 10) / 10        // 전지급: 0.1R(=50장) 단위
    : Math.ceil(raw * 1000) / 1000;   // 2절 이하: 소수 3자리
}

/** 공정 R수 — 1,000장 = 1R, 0.1R 올림, 최소 1식 */
function calcProcessR(up, qty) {
  if (!up || up === 0 || !qty) return 1;
  const net = Math.ceil(qty / up);
  if (net < 1000) return 1;
  return Math.ceil((net / 1000) * 10) / 10;
}

/** state → 여분 판단 옵션 (calcR / findBestSheet 공용) */
function lossOptsOf(s) {
  const fInk = (s.fpColor ? 4 : (parseInt(s.fpSp)||0)) + (s.fpBk?1:0) > 0 || !!s.fpUv;
  const bInk = (s.bpColor ? 4 : (parseInt(s.bpSp)||0)) + (s.bpBk?1:0) > 0 || !!s.bpUv;
  const spot = (parseInt(s.fpSp)||0) + (parseInt(s.bpSp)||0);
  const flat = (s.fpColor?4:0) + (s.fpBk?1:0) + (s.bpColor?4:0) + (s.bpBk?1:0);
  return {
    manual:     s.lossSheets,
    bothSides:  fInk && bInk,
    noPrint:    !fInk && !bInk,
    beda:       !!s.beda && spot > 0,
    hasEmb:     !!s.emb,
    hasFoil:    !!s.foil,
    printUnits: spot * SPOT_WEIGHT + flat,   // findBestSheet 랭킹용 인쇄 도수 가중치
  };
}

/** state → 주문생산 판형 크기·절수 (판형이 custom일 때만 유효) */
function customSheetOf(s) {
  const w = parseFloat(s.cusW)||0, h = parseFloat(s.cusH)||0, cut = parseInt(s.cusCut)||2;
  return (w > 0 && h > 0) ? { w, h, cut } : null;
}

// 최적 원지: 총비용 최소 + 판형 우선순위(동일 비용이면 실무 선호 판형)
// 실무 선호: 4×64 → 국2 → 4×62 → 하4 → 하3 → 4×63 → 국전 → 46전 → 하2 → 하전지
// 주문생산은 auto 추천 대상에서 제외 (코리팩 협의 필요 → 수동 선택 전용)
const SHEET_PRIORITY = {
  "4x64":1, "guk2":2, "4x62":3, "ha4":4, "ha3":5,
  "4x63":6, "guk":7, "46":8, "ha2":9, "ha":10, "custom":99,
};

function findBestSheet(netSize, qty, sheetIdHint, paperId, mPriceVal, lossOpts = {}, customSheet = null) {
  if (!netSize || !qty) return null;
  const { netW, netH, glueTab, topLid, botFloor, gtypeNoRotate, hangTab } = netSize;
  const fixed = sheetIdHint && sheetIdHint !== "auto";
  const candidates = fixed
    ? BASE_SHEETS.filter(s => s.id === sheetIdHint)
    : BASE_SHEETS.filter(s => !s.custom);

  let best = null;
  for (const base of candidates) {
    // 주문생산은 사용자가 입력한 크기·절수를 사용
    const sh = (base.custom && customSheet) ? { ...base, ...customSheet } : base;
    if (!sh.w || !sh.h) continue;

    const up = calcUpOnSheet(netW, netH, sh.w, sh.h, glueTab, topLid, botFloor, gtypeNoRotate || false, hangTab || 0);
    if (up === 0) continue;

    // getLayoutInfo가 이미 수율 80% 캡을 걸지만, 그래도 초과하면(전 배치 초과 케이스)
    // 실현 불가로 보고 제외 — 단 판형 수동 고정 시에는 남겨서 경고로 보여줌
    const esh = effectiveSheet(sh.w, sh.h);
    const utilPct = (up * netW * netH) / (esh.long * esh.short) * 100;
    // 배치 가능 여부는 getLayoutInfo 가 발자국 기준으로 이미 판정 → 여기선 방어만
    if (!fixed && utilPct > 130) continue;

    const spr       = sheetsPerR(sh);
    const R         = calcR(up, qty, sh, lossOpts);
    const price     = getPaperPrice(paperId, base.id, mPriceVal, customSheet);
    const paperCost = R * price;

    // 공정비 추정 (랭킹 전용) — 판형 티어별 코팅·톰슨 + 도수별 인쇄
    const tier      = sheetTier(sh);
    const coatEst   = tier === "large" ? 112000 : tier === "mid" ? 62000 : 55000;
    const thomEst   = tier === "large" ?  75000 : tier === "mid" ? 55000 : 50000;
    const printEst  = Math.max(1, lossOpts.printUnits || 4) * PRINT_UNIT_DEFAULT;
    const processCostEst = calcProcessR(up, qty) * (coatEst + thomEst + printEst);

    const priority   = SHEET_PRIORITY[base.id] || 20;
    const rankCost   = (paperCost + processCostEst) * (1 + (priority - 1) * 0.01);

    if (!best || rankCost < best.rankCost)
      best = { ...sh, id: base.id, up, R, cost: paperCost, rankCost, price,
               sheetsPerR: spr, tier, utilPct: Math.round(utilPct) };
  }
  return best;
}

// ══════════════════════════════════════════════════════════════════
// [v8] 공정 단가 DB  —  docs/ 견적서 78건 실측 (2026-07 최신 기준)
//
// ▶ 단가는 2026-04 / 2026-06 두 차례 인상됨. 같은 일감 재견적으로 확인:
//     소부  10,000(25-12) → 11,000(26-02~03) → 12,000(26-04~07)
//     인쇄  13,000 → 15,000 / 톰슨 40,000 → 50,000 / 삼면접착 25 → 30원
//   → 기본값은 **인상 후 높은 값** 기준. 전부 UI에서 수정 가능.
//
// ▶ 판형 티어 (sheetTier):
//     small = 4절 (4×64·하4)      mid = 2·3절 (4×62·국2·하2·하3·4×63)
//     large = 전지 (46전지·국전·하전지·4×6전지)
// ══════════════════════════════════════════════════════════════════

const SOBOO_UNIT_DEFAULT = 12000;   // 소부 원/도 (26-04 이후)
const PRINT_UNIT_DEFAULT = 14500;   // 인쇄 원/도·R (소형·중형)
const PRINT_UNIT_LARGE   = 15000;   // 인쇄 원/도·R (전지급)

/** 인쇄 도당 단가 기본값 — 판형 티어별 */
function printUnitFor(tier) { return tier === "large" ? PRINT_UNIT_LARGE : PRINT_UNIT_DEFAULT; }

// ── 별색 인쇄 ─────────────────────────────────────────────────────
// 견적서에 두 가지 표기가 섞여 있으나 R당 실효금액으로 환산하면 같은 물건:
//   ① 도수환산 : 별색 1도를 인쇄 3회로 카운트 → 도당 단가 곱하기
//        삼면E 별2 → 6×14,000 = 84,000/R   ┐ 같은 박스·같은 수량
//        삼면E 원4 → 4×14,000 = 56,000/R   ┘ 대조 견적서로 확인 ✓
//        트레이A 먹1별1 → 4×14,500 (1R) / 8×14,500 (2R) ✓
//   ② R당 고정 : 별색 전용 단가를 R에 곱하기
//        십자B 별2 50,000/R · 조립형 별1 50,000~65,000/R
//        G형 별1베다+먹 75,000/R  ·  G형C 별1베다+먹 76,190/R ✓ (독립 2건 일치)
// → 기본은 ①(대조 견적서 근거). 베다(바탕 전면 인쇄)는 R당 실효금액이
//   75,000~84,000으로 확실히 높아 ②를 쓰는 편이 실측과 가까움.
const SPOT_WEIGHT      = 3;      // 별색 1도 = 인쇄 3회
const SPOT_RPR_PLAIN   = 50000;  // ② 별색 전용 R단가 (일반)
const SPOT_RPR_BEDA    = 75000;  // ② 별색 전용 R단가 (베다/바탕)

// ── 코팅 (원/R) ───────────────────────────────────────────────────
// min = 소량(공정R 1식) 금액. 실측: 무광 4×64 55,000 / 하4 60,000 / 하3 70,000
//       4×62 62,400~65,000 / 4×6전지 112,000 / 46전지 양면 126,000
//       IR 4×62·하4 30,000 / 4×64 40,000~48,000 / 국2(ir수성) 50,000 / 전지 60,000
const COAT_OPTS = [
  { id:"none",   label:"없음",         small:0,      mid:0,      large:0,      min:0      },
  { id:"matte",  label:"무광코팅",     small:55000,  mid:65000,  large:112000, min:55000  },
  { id:"gloss",  label:"유광코팅",     small:55000,  mid:65000,  large:112000, min:55000  },
  { id:"hg",     label:"글로스코팅",   small:65000,  mid:65000,  large:140000, min:65000  },
  { id:"ir",     label:"IR코팅",       small:48000,  mid:30000,  large:60000,  min:30000  },
  { id:"lami",   label:"무광라미",     small:85000,  mid:85000,  large:115000, min:85000  },
  { id:"velvet", label:"벨벳코팅",     small:241722, mid:241722, large:241722, min:241722 },
  { id:"epoxy",  label:"에폭시",       small:95000,  mid:95000,  large:120000, min:95000  },
  { id:"part",   label:"부분코팅",     small:95000,  mid:95000,  large:95000,  min:95000  },
  { id:"both46", label:"양면코팅(전지)",small:126000, mid:126000, large:126000, min:126000 },
];

// ── 접착 (원/EA) ──────────────────────────────────────────────────
// 실측: 단면 15 / 삼면 25~30 / 손잡이형 30 / 슬리브 80 / PP 70
//       소량 1식 45,000~50,000 (최근 견적서 50,000)
const GLUE_MIN_LOT = 50000;
const GLUE_OPTS = [
  { id:"none",   label:"없음",         ea:0  },
  { id:"dan",    label:"단면",         ea:15 },
  { id:"sam",    label:"삼면",         ea:30 },
  { id:"pull",   label:"풀발이",       ea:22 },
  { id:"handle", label:"손잡이형",     ea:30 },
  { id:"sleeve", label:"슬리브",       ea:80 },
  { id:"pp",     label:"PP접착",       ea:70 },
];

// ── 톰슨 (원/R) ───────────────────────────────────────────────────
// 실측: 4×64 45,000~50,000 / 하4 45,000~50,000 / 하3·4×63 45,000
//       국2 50,000~55,000 / 4×62 40,000~60,000 / 46전지 80,000 / 4×6전지 70,000~75,000
const THOMSON_OPTS = [
  { id:"s",     label:"단순형",           small:45000, mid:50000, large:70000, min:45000 },
  { id:"n",     label:"일반형",           small:50000, mid:55000, large:75000, min:50000 },
  { id:"c",     label:"복잡형",           small:50000, mid:60000, large:80000, min:50000 },
  { id:"sp",    label:"측면 풀발이 12단", small:80000, mid:80000, large:80000, min:80000 },
  { id:"g_std", label:"G형 표준",         small:45000, mid:55000, large:70000, min:45000 },
];

/** 코팅·톰슨 R단가를 판형 티어로 선택 */
function rprFor(opt, tier) { return opt ? (opt[tier] ?? opt.mid ?? 0) : 0; }

// ── 후가공 (원/R) ─────────────────────────────────────────────────
// 실측: 금박 140,000 (조립형) / 100,000 (트레이B, 양면 2회)
//       먹박 120,000 / 형압(디보싱) 100,000 / 형압 80,000 / 재단 30,000
const FOIL_RPR_DEFAULT = 140000;
const EMB_RPR_DEFAULT  = 100000;

// ── 일반관리비 ────────────────────────────────────────────────────
// 100,000원 + 수량 × 5원, 1만원 단위 반올림, 최소 100,000
// 검증: 3,000→120,000 ✓ / 5,000→130,000 ✓ / 10,000→150,000 ✓
//       30,000→250,000 ✓ / 50,000→350,000 ✓   (실측 9건 중 7건 일치)
// ※ 코리팩가 재량으로 붙이는 항목이라 편차 있음 (같은 2,000ea에 100,000~200,000).
//   싸바리·G형처럼 공정이 많은 건은 실측이 더 높음 → 수동 입력으로 보정
function calcAdmin(qty) {
  return Math.max(100000, Math.round((100000 + qty * 5) / 10000) * 10000);
}

// ══════════════════════════════════════════════════════════════════
// [v8] computeForQty — 견적 1건 계산
//
// 출력 순서: 공정합계 → 개발비 → 개당단가 → 총공급가액 → 부가세
//   개당단가 = round(공정합계 / 수량)   ← floor 아님
//   검증: 맞뚜껑A 30,000ea 2,335,185/30,000 = 77.84 → 78 ✓ (floor면 77 ✗)
//         삼면B 3,000ea 1,775,894/3,000 = 591.96 → 592 ✓
//   지대 공급가액 = round(지대R × 지대단가)  ✓ 견적서 전건 일치
// ══════════════════════════════════════════════════════════════════
function computeForQty(s, qty, si, netSize) {
  if (!si || !netSize) return null;
  const paper = PAPERS.find(p => p.id === s.paperId) || PAPERS[2];
  const fc    = COAT_OPTS.find(p => p.id === s.fcId)    || COAT_OPTS[0];
  const bc    = COAT_OPTS.find(p => p.id === s.bcId)    || COAT_OPTS[0];
  const glue  = GLUE_OPTS.find(p => p.id === s.glueId)  || GLUE_OPTS[0];
  const thom  = THOMSON_OPTS.find(p => p.id === s.thomId)|| THOMSON_OPTS[0];
  const tier  = si.tier || sheetTier(si);

  // ─── 인쇄 도수 ──────────────────────────────────────────────────
  const fpSp = parseInt(s.fpSp)||0, fpBk = !!s.fpBk, fpUv = !!s.fpUv;
  const bpSp = parseInt(s.bpSp)||0, bpBk = !!s.bpBk, bpUv = !!s.bpUv;
  const fpColor = !!s.fpColor;   // 전면 = 원색(CMYK) 인쇄
  const bpColor = !!s.bpColor;

  // 소부는 도수 기준. UV인쇄는 별도 UV기계라 소부 없음 (견적서 전건 확인)
  const fColors = (fpColor ? 4 : fpSp) + (fpBk ? 1 : 0);
  const bColors = (bpColor ? 4 : bpSp) + (bpBk ? 1 : 0);
  const totalColors = fColors + bColors;
  const hasUv    = fpUv || bpUv;
  const fHasInk  = fColors > 0 || fpUv;
  const bHasInk  = bColors > 0 || bpUv;
  const bothSidesPrint = fHasInk && bHasInk;   // 양면인쇄 → 여분 +100장

  // ─── 지대 R수 ───────────────────────────────────────────────────
  const net = si.up > 0 ? Math.ceil(qty / si.up) : 0;
  const lossOpts = {
    manual:     s.lossSheets,
    bothSides:  bothSidesPrint,
    noPrint:    !fHasInk && !bHasInk,
    beda:       !!s.beda && (fpSp + bpSp) > 0,
    hasEmb:     !!s.emb,
    hasFoil:    !!s.foil,
  };
  const autoLossEstimate = estimateLoss(net, lossOpts);
  const R = s.mR ? (parseFloat(s.mRV) || 0) : calcR(si.up, qty, si, lossOpts);

  const priceInfo = s.mPrice
    ? { price: parseFloat(s.mPriceV)||0, confirmed: true, manual: true }
    : getPaperPriceInfo(s.paperId, si.id, "", si.custom ? { w:si.w, h:si.h, cut:si.cut } : null);
  const sheetPricePerR = priceInfo.price;
  const paperAmt       = Math.round(R * sheetPricePerR);

  // ─── 공정 R수 (판형·절수 무관, 1,000장 = 1R) ────────────────────
  const processR = calcProcessR(si.up, qty);
  const isLot    = net > 0 && net < 1000;   // 1식(최소) 구간

  // ─── 인쇄비 ─────────────────────────────────────────────────────
  // UV인쇄: 도수 무관 수량 티어 고정가 (별도 UV기계)
  //   ✓ 47×47×176 5,000ea → 250,000 / 10,000ea → 350,000 / UV건 1,000ea → 200,000
  function uvAmt() {
    if (qty <=  3000) return 200000;
    if (qty <=  5000) return 250000;
    if (qty <= 10000) return 350000;
    return Math.round(qty / 1000 * 35000);
  }

  const printUnit = parseInt(s.printU) || printUnitFor(tier);
  const spotMode  = s.spotMode || "weight";        // "weight" = 도수환산(×3) / "rpr" = R당 고정
  const spotRpr   = parseInt(s.spotRprV) || (s.beda ? SPOT_RPR_BEDA : SPOT_RPR_PLAIN);

  /**
   * 한 면의 인쇄 계산 → { qtyN, unitLabel, up, amt }
   * 원색·먹  : 공정R × 도수 × 도당단가
   * 별색     : ① 도수환산 → 공정R × (별색도수×3 + 원색·먹도수) × 도당단가
   *            ② R당 고정 → 공정R × 별색R단가
   */
  function printSide(sp, bk, uv, isColor) {
    if (uv) return { qtyN: 1, unitLabel: "식", up: uvAmt(), amt: uvAmt() };
    const flatDo = (isColor ? 4 : 0) + (bk ? 1 : 0);   // 원색·먹 (가중치 1)
    const spotDo = isColor ? 0 : sp;                   // 별색 (가중치 3 또는 별도단가)
    if (flatDo + spotDo === 0) return null;

    if (spotDo > 0 && spotMode === "rpr") {
      const amt = Math.round(processR * spotRpr) + Math.round(processR * flatDo * printUnit);
      return { qtyN: processR, unitLabel: "R", up: spotRpr, amt };
    }
    // 인쇄 수량 = 판 걸이 횟수 → 정수 올림
    //   ✓ 8.4R×4도 = 33.6 → 34 / 1.3R×4도 = 5.2 → 6 / 1.4R×4도 = 5.6 → 6 (실측 일치)
    const units = spotDo * SPOT_WEIGHT + flatDo;
    const q     = Math.ceil(processR * units);
    return { qtyN: q, unitLabel: "도·R", up: printUnit, amt: q * printUnit };
  }

  const fPrint = printSide(fpSp, fpBk, fpUv, fpColor);
  const bPrint = printSide(bpSp, bpBk, bpUv, bpColor);
  const fpAmt  = fPrint?.amt || 0;
  const bpAmt  = bPrint?.amt || 0;

  // ─── 코팅 ───────────────────────────────────────────────────────
  const fcRpr = rprFor(fc, tier);
  const bcRpr = rprFor(bc, tier);
  const fcAmt = fc.id === "none" ? 0 : isLot ? fc.min : Math.round(processR * fcRpr);
  const bcAmt = bc.id === "none" ? 0 : isLot ? bc.min : Math.round(processR * bcRpr);

  // ─── 후가공 ─────────────────────────────────────────────────────
  const foilRpr = parseInt(s.foilRpr) || FOIL_RPR_DEFAULT;
  const foilSides = Math.max(1, parseInt(s.foilS)||1);
  const foilAmt = s.foil ? Math.round(processR * foilRpr * foilSides) : 0;
  const embRpr  = parseInt(s.embRpr) || EMB_RPR_DEFAULT;
  const embAmt  = s.emb  ? Math.round(processR * embRpr) : 0;
  const puvAmt  = s.puv  ? Math.round(processR * 95000 * (parseInt(s.puvS)||1)) : 0;

  // ─── 소부 ───────────────────────────────────────────────────────
  const sobooUnit = parseInt(s.sobooU) || SOBOO_UNIT_DEFAULT;
  const sobooAmt  = totalColors * sobooUnit;

  // ─── 톰슨 ───────────────────────────────────────────────────────
  const thomRpr = rprFor(thom, tier);
  const thomAmt = isLot ? thom.min : Math.round(processR * thomRpr);

  // ─── 접착 (소량은 1식 최소금액) ─────────────────────────────────
  const glueAmt = glue.id === "none" ? 0 : Math.max(qty * glue.ea, GLUE_MIN_LOT);
  const glueIsLot = glue.id !== "none" && qty * glue.ea < GLUE_MIN_LOT;

  // ─── 일반관리비 ─────────────────────────────────────────────────
  const adminAmt = s.adminManual ? (parseInt(s.admin) || 100000) : calcAdmin(qty);

  const processTot = paperAmt + sobooAmt + fpAmt + bpAmt + fcAmt + bcAmt
                   + foilAmt + embAmt + puvAmt + thomAmt + glueAmt + adminAmt;
  const dieAmt     = s.newDie ? (parseInt(s.dieQ)||1)*(parseInt(s.dieP)||140000) : 0;
  const embDevAmt  = s.emb  ? (parseInt(s.embDevP)||90000) : 0;
  const embFilmAmt = s.emb  ? (parseInt(s.embFilmP)||28000) : 0;
  const foilDevAmt = s.foil ? (parseInt(s.foilDevP)||25000) + (parseInt(s.foilFilmP)||35000) : 0;
  const filmAmt    = parseInt(s.filmC) || 0;
  const devTotal   = dieAmt + embDevAmt + embFilmAmt + foilDevAmt + filmAmt;
  const grandTotal = processTot + devTotal;
  const perEA      = qty > 0 ? Math.round(processTot / qty) : 0;

  // ─── 표시용 규격 문자열 ─────────────────────────────────────────
  const sideSpec = (sp, bk, uv, isColor) => [
    uv ? "UV인쇄" : "",
    isColor ? "원색 4도" : (sp > 0 ? `별색 ${sp}도${s.beda ? " 베다" : ""}` : ""),
    bk ? "먹 1도" : "",
  ].filter(Boolean).join(" + ");
  const sheetName = si.label.split("(")[1]?.replace(")","") || si.label;
  const sobooSpec = `${totalColors}도 / ${Math.round(netSize.netW)}×${Math.round(netSize.netH)}`;

  const rLine = (amt, opt, rpr) => ({
    qty: isLot ? 1 : processR,
    unit: isLot ? "식" : "R",
    up: isLot ? opt.min : rpr,
    amt,
  });

  const lines = [
    { name:"지대",
      spec:`${paper.label} · ${si.label.split("(")[0].trim()}`,
      qty:R, unit:"R", up:sheetPricePerR, amt:paperAmt,
      note:`${si.up}up · 정미 ${net.toLocaleString()}${priceInfo.confirmed?"":" ⚠추정"}` },
    totalColors>0 && { name:"소부", spec:sobooSpec,
      qty:totalColors, unit:"도", up:sobooUnit, amt:sobooAmt, fixed:true },
    fPrint && { name: bHasInk ? "인쇄(전면)" : "인쇄", spec:sideSpec(fpSp,fpBk,fpUv,fpColor),
      qty:fPrint.qtyN, unit:fPrint.unitLabel, up:fPrint.up, amt:fpAmt },
    bPrint && { name:"인쇄(후면)", spec:sideSpec(bpSp,bpBk,bpUv,bpColor),
      qty:bPrint.qtyN, unit:bPrint.unitLabel, up:bPrint.up, amt:bpAmt },
    // 코팅: 전후면 같은 종류면 양면 1줄로 합산 (견적서 표기 방식)
    ...(fc.id!=="none" || bc.id!=="none" ? (() => {
      if (fc.id!=="none" && bc.id!=="none" && fc.id===bc.id)
        return [{ name:"코팅", spec:`${fc.label} (양면)`,
          qty: isLot ? 2 : Math.round(processR*2*1000)/1000, unit: isLot ? "식" : "R",
          up: isLot ? fc.min : fcRpr, amt: fcAmt + bcAmt }];
      return [
        fc.id!=="none" && { name: bc.id!=="none" ? "코팅(전면)" : "코팅",
          spec:fc.label, ...rLine(fcAmt, fc, fcRpr) },
        bc.id!=="none" && { name:"코팅(후면)", spec:bc.label, ...rLine(bcAmt, bc, bcRpr) },
      ].filter(Boolean);
    })() : []),
    s.foil && { name:"박", spec:`${s.foilType||"금박"}${foilSides>1?` (${foilSides}면)`:""}`,
      qty: processR*foilSides, unit:"R", up:foilRpr, amt:foilAmt },
    s.emb && { name:"형압", spec:"디보싱",
      qty: processR, unit:"R", up:embRpr, amt:embAmt },
    s.puv && { name:"부분코팅", spec:`${s.puvS||1}면`,
      qty: processR*(parseInt(s.puvS)||1), unit:"R", up:95000, amt:puvAmt },
    { name:"톰슨", spec:thom.label, ...rLine(thomAmt, thom, thomRpr) },
    glue.id!=="none" && { name:"접착", spec:glue.label,
      qty: glueIsLot ? 1 : qty, unit: glueIsLot ? "식" : "EA",
      up: glueIsLot ? GLUE_MIN_LOT : glue.ea, amt:glueAmt },
    { name:"일반관리비", spec: s.adminManual ? "(직접입력)" : "자동",
      qty:"", unit:"", up:"", amt:adminAmt, fixed:true },
  ].filter(Boolean);

  const devLines = [
    s.newDie  && { name:"목형",          qty:parseInt(s.dieQ)||1, up:parseInt(s.dieP)||140000, amt:dieAmt },
    s.emb     && { name:"형압 개발비",   qty:1, up:parseInt(s.embDevP)||90000, amt:embDevAmt },
    s.emb     && { name:"형압 필름",     qty:1, up:parseInt(s.embFilmP)||28000, amt:embFilmAmt },
    s.foil    && { name:"동판 + 동판필름", qty:1, up:foilDevAmt, amt:foilDevAmt },
    filmAmt>0 && { name:"부분코팅 필름", qty:1, up:filmAmt, amt:filmAmt },
  ].filter(Boolean);

  return { R, processR, net, lines, devLines, processTot, devTotal, grandTotal, perEA,
           vat: Math.round(grandTotal * 0.1),
           sheetPricePerR, priceConfirmed: priceInfo.confirmed,
           priceEstimateFrom: priceInfo.estimateFrom,
           showIRWarning: s.fcId==="ir" || s.bcId==="ir",
           fColors, bColors, totalColors, bothSidesPrint,
           autoLossEstimate, autoLossNet: net };
}

// ══════════════════════════════════════════════════════════════════
// 전개도 날개 치수 계산 — 7개 실측 케이스 역산 결과
// (판형 배치용 bounding box는 calcNetSize가 담당; 이건 전개도 그리기 전용)
//
// 검증 확정 공식:
//   botLong  (cross)      = 0.7 × D          ✓ D=20,70,100 오차 0
//   botLong  (glue_3side) = 0.65 × D + 4     ✓ D=40,74 오차 <0.1
//   dust                  = 0.43 × D + 7     ✓ 전 타입 오차 ≤2mm
//   botShort (cross)      = 0.4 × D + 6      ✓ D=20,100 정확, D=70 2mm오차
//   botShort (glue_3side) = D / 2             ✓ D=40,74 정확
//   topLid                = 0.08 × D + 9     ≈ 전 타입 (D≤70 ≤3mm, D=100 6mm오차)
// ══════════════════════════════════════════════════════════════════
function getFlaps(W, D, H, boxType) {
  const topLid  = D * 0.08 + 9;              // 모든 구조 공통 근사
  const dust    = D * 0.43 + 7;             // 모든 구조 공통 ✓

  switch(boxType) {
    case "tuck_both": {
      // 맞뚜껑: bounding box의 topLid가 아닌 실제 눈에 보이는 날개 치수
      // ✓ D=15→topLid=11, dust=13 / D=18→topLid=11, dust=14.5
      // topLid(tuck tab): D에 거의 무관, ~11mm 고정 → D*0.03+10.6 근사
      // dust: 0.43*D+7 공식 ✓
      const lockTab = Math.round(D * 0.03 + 10.6); // D=15→11, D=18→11
      return { type:"tuck", topLid:lockTab, dust,
               botLid:lockTab, botDust:dust,
               topDustH:dust, botDustH:dust };
    }
    case "cross":
      return { type:"cross", topLid, dust,
               botLong: D * 0.7,             // ✓
               botShort: D * 0.4 + 6,        // ✓ D=20,100
             };
    case "glue_3side":                      // 자동바닥 — 실측 칼선 7건 회귀
      return { type:"glue3", topLid: D*0.88 + W*0.09 + 20.6,
               dust: D/2 - 1,
               botLong: D*0.33 + W*0.15 + 11.0,
               botShort: D / 2,
             };
    default: return null;
  }
}

// ══════════════════════════════════════════════════════════════════
// 전개도 시각화 컴포넌트 (실제 날개 형태 반영)
// ══════════════════════════════════════════════════════════════════
function NetDiagram({ W, D, H, boxType, netSize }) {
  if (!W || !D || !H || !netSize || netSize.isGtype) return null;
  const flaps = getFlaps(W, D, H, boxType);
  if (!flaps) return null;

  const glue = netSize.glueTab || 14.3;
  const SVG_W = 380, SVG_H = 260, PAD = 16;

  // 패널 x 경계 (net 좌표)
  const xs = [0, D, D+W, 2*D+W, 2*D+2*W, 2*D+2*W+glue];
  const panelW = [D, W, D, W, glue];
  const panelColors = ['#1a3558','#0d2440','#1a3558','#0d2440','#3a2800'];
  const panelLabels = ['측면1','전면','측면2','후면','접착'];

  // 타입별 상/하 날개 높이 배열 [측면1, 전면, 측면2, 후면, 접착]
  let topH, botH;
  if (flaps.type === 'tuck') {
    topH = [flaps.dust, flaps.topLid, flaps.dust, flaps.topLid, 0];
    botH = [flaps.botDust, flaps.botLid, flaps.botDust, flaps.botLid, 0];
  } else {
    // cross / glue3
    topH = [flaps.dust, flaps.topLid, flaps.dust, flaps.topLid, 0];
    botH = [flaps.botShort, flaps.botLong, flaps.botShort, flaps.botLong, 0];
  }

  const maxTop = Math.max(...topH);
  const maxBot = Math.max(...botH);
  const rawW   = xs[xs.length-1];
  const rawH   = maxTop + H + maxBot;

  const scale = Math.min((SVG_W-2*PAD) / rawW, (SVG_H-2*PAD) / rawH);
  const ox = (SVG_W - rawW*scale) / 2;
  const oy = (SVG_H - rawH*scale) / 2;

  const px = v => ox + v * scale;
  const py = v => oy + v * scale;
  const sc = v => v * scale;

  const yBody    = maxTop;
  const yBodyEnd = maxTop + H;

  return (
    <div style={{background:'#050e1c',borderRadius:8,padding:'8px 6px',marginTop:8,border:'1px solid #1a3050'}}>
      <div style={{fontSize:9,fontWeight:800,color:'#4aaeff',letterSpacing:'.1em',marginBottom:4}}>
        ▣ 전개도 (펼친 형태)
      </div>
      <svg width={SVG_W} height={SVG_H} style={{display:'block'}}>
        {/* 몸체 패널 */}
        {panelW.map((pw,i)=>(
          <rect key={'b'+i} x={px(xs[i])} y={py(yBody)}
            width={sc(pw)} height={sc(H)}
            fill={panelColors[i]} opacity={0.85}
            stroke='#2a4a6a' strokeWidth={0.6}/>
        ))}
        {/* 상단 날개 */}
        {topH.map((fh,i)=>fh>0&&(
          <rect key={'t'+i} x={px(xs[i])} y={py(yBody-fh)}
            width={sc(panelW[i])} height={sc(fh)}
            fill={panelColors[i]} opacity={0.55}
            stroke='#2a4a6a' strokeWidth={0.5}/>
        ))}
        {/* 하단 날개 */}
        {botH.map((fh,i)=>fh>0&&(
          <rect key={'b2'+i} x={px(xs[i])} y={py(yBodyEnd)}
            width={sc(panelW[i])} height={sc(fh)}
            fill={panelColors[i]} opacity={0.55}
            stroke='#2a4a6a' strokeWidth={0.5}/>
        ))}
        {/* 세로 접음선 */}
        {xs.slice(1,-1).map((x,i)=>(
          <line key={'vf'+i} x1={px(x)} y1={py(0)} x2={px(x)} y2={py(rawH)}
            stroke='#3a6090' strokeWidth={0.6} strokeDasharray='3,2'/>
        ))}
        {/* 가로 접음선 */}
        {[yBody, yBodyEnd].map((y,i)=>(
          <line key={'hf'+i} x1={px(0)} y1={py(y)} x2={px(rawW)} y2={py(y)}
            stroke='#3a6090' strokeWidth={0.6} strokeDasharray='3,2'/>
        ))}
        {/* 패널 라벨 */}
        {panelW.map((pw,i)=>sc(pw)>18&&(
          <text key={'l'+i}
            x={px(xs[i]+pw/2)} y={py(yBody+H/2)}
            textAnchor='middle' dominantBaseline='central'
            fontSize={Math.min(10, sc(pw)*0.18)} fill='#7ab8f5'>
            {panelLabels[i]}
          </text>
        ))}
        {/* 상단 날개 치수 (높이가 큰 첫 번째 패널만) */}
        {maxTop>0&&(()=>{
          const bigIdx = topH.indexOf(maxTop);
          if(bigIdx<0||sc(maxTop)<12) return null;
          const cx = px(xs[bigIdx]+panelW[bigIdx]/2);
          const cy = py(yBody-maxTop/2);
          return <text x={cx} y={cy} textAnchor='middle' dominantBaseline='central'
            fontSize={9} fill='#6699bb'>{Math.round(maxTop)}</text>;
        })()}
        {maxBot>0&&(()=>{
          const bigIdx = botH.indexOf(maxBot);
          if(bigIdx<0||sc(maxBot)<12) return null;
          const cx = px(xs[bigIdx]+panelW[bigIdx]/2);
          const cy = py(yBodyEnd+maxBot/2);
          return <text x={cx} y={cy} textAnchor='middle' dominantBaseline='central'
            fontSize={9} fill='#6699bb'>{Math.round(maxBot)}</text>;
        })()}
        {/* H 치수 */}
        {sc(H)>20&&<text x={px(rawW)+4} y={py(yBody+H/2)}
          textAnchor='start' dominantBaseline='central'
          fontSize={9} fill='#6699bb'>H={Math.round(H)}</text>}
      </svg>
    </div>
  );
}
const fmt   = n => (typeof n==="number"&&n>=0) ? Math.round(n).toLocaleString() : (n||"-");
// fmtR: 부동소수점 반올림 버그 수정
// JS에서 0.575*100=57.4999... → Math.round=57 → "0.57" 표시 버그
// 수정: 미세 epsilon 추가로 0.575→"0.58" 올바르게 표시
const fmtR  = r => r ? (Math.round((r + 1e-10) * 100) / 100).toFixed(2) : "0.00";
// 견적서 수량 칸 표기: 정수는 그대로, 소수는 필요한 자리만 (실제 견적서 형식)
//   5000 → "5,000" / 2 → "2" / 1.134 → "1.134" / 8.4 → "8.4"
const fmtQ  = q => {
  if (typeof q !== "number") return q || "";
  if (Number.isInteger(q)) return q.toLocaleString();
  return String(Math.round((q + 1e-10) * 1000) / 1000);
};
const fmtMM = n => n ? n.toFixed(1) : "-";
const today = () => { const d=new Date(); return `${d.getFullYear()}년 ${String(d.getMonth()+1).padStart(2,"0")}월 ${String(d.getDate()).padStart(2,"0")}일`; };

// ══════════════════════════════════════════════════════════════════
// 판걸이 배치 시각화 — 전개도 구조 오버레이 포함
// ══════════════════════════════════════════════════════════════════
function LayoutViz({ si, netSize, W, D, H, boxType }) {
  if (!si || !netSize) return null;
  const layout = getLayoutInfo(netSize.netW, netSize.netH, si.w, si.h,
                               netSize.glueTab, netSize.topLid, netSize.botFloor, netSize.gtypeNoRotate||false, netSize.hangTab||0);
  if (layout.up === 0) return null;

  const PAD_SVG = 32;
  const MAX_W   = 380;
  const MAX_H   = 300;
  // 인쇄기 유효 판(990×720 클램프) 기준으로 그림 — layout 이 이미 클램프된 값을 돌려줌
  const drawW = layout.sheetW || si.w;
  const drawH = layout.sheetH || si.h;
  const scale   = Math.min((MAX_W - PAD_SVG*2) / drawW, (MAX_H - PAD_SVG*2) / drawH);
  const svgW    = drawW * scale + PAD_SVG * 2;
  const svgH    = drawH * scale + PAD_SVG * 2;

  const COLORS  = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#06b6d4","#ec4899"];
  const biteS   = BITE_MM * scale;

  const usedArea  = layout.up * netSize.netW * netSize.netH;
  const totalArea = drawW * drawH;
  const utilPct   = Math.round(usedArea / totalArea * 100);
  const candSummary = layout.candidates?.map(c =>
    `${c.rotated?"회전":"노말"}${c.interlocked?"·인터로킹":""} ${c.up}up`
  ).join("  /  ");

  // 전개도 패널 구조 계산
  const glue = netSize.glueTab || 14.3;
  const flaps = (!netSize.isGtype && W && D && H) ? getFlaps(W, D, H, boxType) : null;

  // 패널별 날개 높이 배열 [측면1, 전면, 측면2, 후면] (mm)
  let topHmm = [], botHmm = [];
  if (flaps) {
    if (flaps.type === 'tuck') {
      topHmm = [flaps.dust, flaps.topLid, flaps.dust, flaps.topLid];
      botHmm = [flaps.botDust, flaps.botLid, flaps.botDust, flaps.botLid];
    } else {
      topHmm = [flaps.dust, flaps.topLid, flaps.dust, flaps.topLid];
      botHmm = [flaps.botShort, flaps.botLong, flaps.botShort, flaps.botLong];
    }
  } else if (W && D) {
    // 날개 정보 없으면 bounding box 절반으로 균등 분배
    topHmm = [netSize.topLid, netSize.topLid, netSize.topLid, netSize.topLid];
    botHmm = [netSize.botFloor, netSize.botFloor, netSize.botFloor, netSize.botFloor];
  }

  // 패널 x 경계 (mm): [0, D, D+W, 2D+W, 2D+2W, netW]
  const xEdges_mm = W && D
    ? [0, D, D+W, 2*D+W, 2*D+2*W, netSize.netW]
    : [0, netSize.netW];
  // 패널 색상 (index 0=측면, 1=전면, 2=측면, 3=후면, 4=접착)
  const PCOL = ['#0f766e','#1e40af','#0f766e','#1e40af','#92400e'];

  // ── 핵심: 패널별 실루엣 그리기 ─────────────────────────────────
  // 각 박스(bx,by,bw,bh)에서 패널별로 올바른 높이의 rect을 그려
  // 실제 전개도 윤곽이 나타나게 함
  function BoxNet({ bx, by, bw, bh, rotated, flipped, color }) {
    if (!W || !D) return null;

    const nW = netSize.netW, nH = netSize.netH;
    const maxTop = netSize.topLid || 0;
    const maxBot = netSize.botFloor || 0;

    // rotated: netH가 가로(bw), netW가 세로(bh)
    const sw = rotated ? nH : nW; // net 가로 (SVG bw 방향)
    const sh = rotated ? nW : nH; // net 세로 (SVG bh 방향)
    const scX = bw / sw;
    const scY = bh / sh;

    // 몸체 영역 y 좌표 (SVG)
    // rotated: 가로 방향이 netH → 몸체는 maxBot에서 netH-maxTop까지
    const bodyStart = rotated
      ? by + maxBot * scX   // rotated: botFloor가 왼쪽에
      : by + maxTop * scY;
    const bodyEnd = rotated
      ? by + bh - maxTop * scX
      : by + bh - maxBot * scY;

    const rects = [];
    const lines = [];

    // 패널 루프
    const nPanels = xEdges_mm.length - 1;
    for (let i = 0; i < nPanels; i++) {
      const x0mm = xEdges_mm[i];
      const x1mm = xEdges_mm[i+1];
      const tH   = (topHmm[i] ?? maxTop);
      const bH   = (botHmm[i] ?? maxBot);
      const pColor = PCOL[i] || PCOL[4];

      if (!rotated) {
        // 일반 배치: 패널이 세로로 나열
        // 각 패널의 실제 높이: topFlap + body + botFlap
        const px = bx + x0mm * scX;
        const pw = (x1mm - x0mm) * scX;
        const pTopY = by + (maxTop - tH) * scY;  // 짧은 날개는 아래서 시작
        const pBotY = by + (maxTop + (H||0) + bH) * scY;
        rects.push(
          // 날개 영역 (위)
          tH > 0 && <rect key={`tp${i}`} x={px} y={pTopY} width={pw-0.5} height={tH*scY}
            fill={pColor} opacity={0.45}/>,
          // 몸체 영역
          <rect key={`bd${i}`} x={px} y={bodyStart} width={pw-0.5}
            height={bodyEnd-bodyStart}
            fill={pColor} opacity={0.72}/>,
          // 날개 영역 (아래)
          bH > 0 && <rect key={`bt${i}`} x={px} y={bodyEnd} width={pw-0.5} height={bH*scY}
            fill={pColor} opacity={0.45}/>
        );
        // 패널 구분선 (body 영역)
        if (i > 0) {
          lines.push(<line key={`pv${i}`} x1={px+0.3} y1={pTopY}
            x2={px+0.3} y2={pBotY}
            stroke="rgba(255,255,255,0.22)" strokeWidth={0.6} strokeDasharray="2,2"/>);
        }
      } else {
        // 회전 배치: 패널이 가로로 나열 (x축이 netH 방향)
        // x0mm/x1mm 은 원래 패널 경계 → 회전 후 y 방향
        const py2 = by + x0mm * scY;
        const ph2 = (x1mm - x0mm) * scY;
        // 날개는 bw의 좌/우
        const lFlapX = bx + (maxBot - bH) * scX;  // 왼쪽(bot) 날개 시작
        const rFlapX = bx + bw - (maxTop - tH) * scX; // 오른쪽(top) 날개 끝
        rects.push(
          bH > 0 && <rect key={`lf${i}`} x={lFlapX} y={py2} width={bH*scX} height={ph2-0.5}
            fill={pColor} opacity={0.45}/>,
          <rect key={`bd${i}`} x={bx+maxBot*scX} y={py2}
            width={bw-(maxBot+maxTop)*scX} height={ph2-0.5}
            fill={pColor} opacity={0.72}/>,
          tH > 0 && <rect key={`rf${i}`} x={rFlapX} y={py2} width={tH*scX} height={ph2-0.5}
            fill={pColor} opacity={0.45}/>
        );
        if (i > 0) {
          lines.push(<line key={`ph${i}`} x1={bx} y1={py2+0.3}
            x2={bx+bw} y2={py2+0.3}
            stroke="rgba(255,255,255,0.22)" strokeWidth={0.6} strokeDasharray="2,2"/>);
        }
      }
    }

    // 몸체 경계선 (골드)
    const bodyLines = !rotated ? [
      <line key="tbl" x1={bx} y1={bodyStart} x2={bx+bw} y2={bodyStart}
        stroke="rgba(255,200,60,0.55)" strokeWidth={0.8} strokeDasharray="3,2"/>,
      <line key="bbl" x1={bx} y1={bodyEnd} x2={bx+bw} y2={bodyEnd}
        stroke="rgba(255,200,60,0.55)" strokeWidth={0.8} strokeDasharray="3,2"/>,
    ] : [
      <line key="lbl" x1={bx+maxBot*scX} y1={by} x2={bx+maxBot*scX} y2={by+bh}
        stroke="rgba(255,200,60,0.55)" strokeWidth={0.8} strokeDasharray="3,2"/>,
      <line key="rbl" x1={bx+bw-maxTop*scX} y1={by} x2={bx+bw-maxTop*scX} y2={by+bh}
        stroke="rgba(255,200,60,0.55)" strokeWidth={0.8} strokeDasharray="3,2"/>,
    ];

    return <g>{rects}{lines}{bodyLines}</g>;
  }

  return (
    <div style={{background:"#05111f",borderRadius:8,padding:12,marginTop:10,border:"1px solid #1a3050"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{fontSize:10,fontWeight:800,color:"#4aaeff",letterSpacing:".12em",textTransform:"uppercase"}}>
          ▦ 판걸이 배치 시각화
        </div>
        <div style={{display:"flex",gap:10,fontSize:9.5,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{color:"#44ee88",fontWeight:800}}>{layout.up} up</span>
          <span style={{color:"#aac"}}>{layout.cols}열 × {layout.rows}행</span>
          {layout.rotated && <span style={{background:"#f59e0b22",color:"#f59e0b",padding:"1px 5px",borderRadius:3,fontWeight:700}}>↺ 회전</span>}
          {layout.interlocked && <span style={{background:"#10b98122",color:"#10b981",padding:"1px 5px",borderRadius:3,fontWeight:700}}>⇅ 인터로킹</span>}
          <span style={{
            background:utilPct>=70?"#00441122":utilPct>=50?"#44440022":"#44000022",
            color:      utilPct>=70?"#44ee88":utilPct>=50?"#ffcc44":"#ff6655",
            padding:"1px 5px",borderRadius:3,fontWeight:700}}>수율 {utilPct}%</span>
        </div>
      </div>

      {/* 인터로킹 정보 */}
      {layout.interlocked && layout.overlapInfo && (
        <div style={{fontSize:9,color:"#10b981",marginBottom:6,padding:"3px 8px",background:"#10b98110",borderRadius:3}}>
          ⇅ 인터로킹 배치: {layout.overlapInfo} — 상하 반전으로 날개 맞물림
        </div>
      )}

      {/* 배치 후보 비교 */}
      {candSummary && (
        <div style={{fontSize:8.5,color:"#4466aa",marginBottom:6}}>비교: {candSummary}</div>
      )}

      <svg width={svgW} height={svgH} style={{display:"block",margin:"0 auto",borderRadius:4}}>
        <defs>
          <pattern id="lossHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#33223355" strokeWidth="3"/>
          </pattern>
          <pattern id="biteHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="#ff222244" strokeWidth="2.5"/>
          </pattern>
        </defs>

        {/* 원지 배경 */}
        <rect x={PAD_SVG} y={PAD_SVG} width={drawW*scale} height={drawH*scale}
          fill="#0d2035" stroke="#2a4060" strokeWidth={1.5} rx={2}/>
        <rect x={PAD_SVG} y={PAD_SVG} width={drawW*scale} height={drawH*scale}
          fill="url(#lossHatch)" rx={2}/>

        {/* 물림 — 상단 */}
        <rect x={PAD_SVG} y={PAD_SVG} width={drawW*scale} height={biteS}
          fill="#ff000018"/>
        <rect x={PAD_SVG} y={PAD_SVG} width={drawW*scale} height={biteS}
          fill="url(#biteHatch)"/>
        <line x1={PAD_SVG} y1={PAD_SVG+biteS} x2={PAD_SVG+drawW*scale} y2={PAD_SVG+biteS}
          stroke="#ff4444" strokeWidth={1} strokeDasharray="4 3" opacity={.8}/>
        <text x={PAD_SVG+drawW*scale/2} y={PAD_SVG+biteS/2}
          textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="#ff6666" fontWeight="700">
          ← 물림 {BITE_MM}mm →
        </text>

        {/* 물림 — 좌측 */}
        <rect x={PAD_SVG} y={PAD_SVG+biteS} width={biteS} height={drawH*scale-biteS}
          fill="#ff000012"/>
        <rect x={PAD_SVG} y={PAD_SVG+biteS} width={biteS} height={drawH*scale-biteS}
          fill="url(#biteHatch)"/>
        <line x1={PAD_SVG+biteS} y1={PAD_SVG} x2={PAD_SVG+biteS} y2={PAD_SVG+drawH*scale}
          stroke="#ff4444" strokeWidth={1} strokeDasharray="4 3" opacity={.8}/>

        {/* 배치된 전개도 */}
        {layout.boxes.map((box, i) => {
          const color = COLORS[i % COLORS.length];
          const bx = PAD_SVG + box.x * scale;
          const by = PAD_SVG + box.y * scale;
          const bw = box.w * scale;
          const bh = box.h * scale;

          return (
            <g key={i}>
              <rect x={bx} y={by} width={bw-0.5} height={bh-0.5}
                fill={box.flipped ? color+"1a" : color+"28"}
                stroke={color} strokeWidth={box.flipped?1:1.5} rx={1}/>
              {/* 전개도 패널 구조 오버레이 — 패널별 실루엣 */}
              {flaps && <BoxNet bx={bx} by={by} bw={bw} bh={bh}
                rotated={box.rotated} flipped={box.flipped} color={color}/>}
              {box.flipped && (
                <text x={bx+bw/2} y={by+9} textAnchor="middle" fontSize={7} fill={color} opacity={.8}>
                  ▽ 반전
                </text>
              )}
              {/* 첫 번째 박스에만 뚜껑/바닥 영역 표시 */}
              {i===0 && netSize.topLid > 0 && (
                <>
                  <rect x={bx} y={by} width={bw-0.5}
                    height={(layout.rotated ? netSize.botFloor : netSize.topLid)*scale}
                    fill={color+"22"} stroke={color} strokeWidth={.5} strokeDasharray="3 2" rx={1}/>
                  <rect x={bx} y={by+bh-(layout.rotated?netSize.topLid:netSize.botFloor)*scale}
                    width={bw-0.5}
                    height={(layout.rotated ? netSize.topLid : netSize.botFloor)*scale}
                    fill={color+"22"} stroke={color} strokeWidth={.5} strokeDasharray="3 2" rx={1}/>
                </>
              )}
              <text x={bx+bw/2} y={by+bh/2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.min(bw,bh)*0.22} fill={color} fontWeight="700" opacity={.85}>
                {i+1}
              </text>
            </g>
          );
        })}

        {/* 치수 라벨 */}
        <text x={PAD_SVG+drawW*scale/2} y={PAD_SVG-14}
          textAnchor="middle" fontSize={9} fill="#8899bb">{drawW} mm</text>
        <text x={PAD_SVG+drawW*scale+16} y={PAD_SVG+drawH*scale/2}
          textAnchor="middle" fontSize={9} fill="#8899bb"
          transform={`rotate(90,${PAD_SVG+drawW*scale+16},${PAD_SVG+drawH*scale/2})`}>{drawH} mm</text>

        {/* 전개도 치수 (첫번째 박스) */}
        {layout.boxes[0] && (() => {
          const b = layout.boxes[0];
          return (
            <text x={PAD_SVG+b.x*scale+b.w*scale/2} y={PAD_SVG+b.y*scale+b.h*scale/2+b.h*scale*0.18}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.min(7.5, b.w*scale*0.1)} fill="#ffffff" opacity={.5}>
              {layout.rotated
                ? `${fmtMM(netSize.netH)}×${fmtMM(netSize.netW)}`
                : `${fmtMM(netSize.netW)}×${fmtMM(netSize.netH)}`}mm
            </text>
          );
        })()}
      </svg>

      {/* 범례 */}
      <div style={{display:"flex",gap:12,marginTop:8,flexWrap:"wrap",fontSize:9.5,color:"#8899bb"}}>
        {[
          {bg:"#ff000033",bd:"1px dashed #ff4444",txt:"물림 30mm"},
          {bg:"#3b82f628",bd:"1px solid #3b82f6",txt:"정방향"},
          {bg:"#3b82f618",bd:"1px solid #3b82f6",txt:"반전(인터로킹)"},
          {bg:"#1e40afcc",bd:"none",txt:"■ 전·후면"},
            {bg:"#0f766ecc",bd:"none",txt:"■ 측면"},
            {bg:"rgba(255,200,60,0.55)",bd:"1px dashed rgba(255,200,60,0.7)",txt:"몸통경계"},
        ].map(({bg,bd,txt})=>(
          <span key={txt} style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{width:14,height:8,background:bg,border:bd,display:"inline-block"}}/>
            {txt}
          </span>
        ))}
      </div>

      {/* 대안 */}
      <div style={{marginTop:4,fontSize:9,color:"#4466aa",textAlign:"right"}}>
        차선: {layout.alt?.up||0}up ({layout.alt?.rotated?"회전":"노말"}{layout.alt?.interlocked?"·인터로킹":""})
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 판형별 지대비 비교 테이블
// ══════════════════════════════════════════════════════════════════
function SheetCompare({ netSize, qty, paperId, sheetId, mPriceVal, lossOpts, customSheet }) {
  if (!netSize || !qty) return null;
  const bestSi = findBestSheet(netSize, qty, "auto", paperId, mPriceVal, lossOpts, customSheet);

  return (
    <div style={{marginTop:10}}>
      <div style={{fontSize:9,fontWeight:800,color:"#4488aa",letterSpacing:".1em",textTransform:"uppercase",marginBottom:6}}>
        판형별 비교 <span style={{fontWeight:400,color:"#334466"}}>(인터로킹 포함)</span>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
        <thead>
          <tr style={{background:"#0d1e36"}}>
            {["판형","Up","수율","R수","연단위","단가/R","지대비"].map((h,i)=>(
              <th key={i} style={{padding:"4px 5px",textAlign:i===0?"left":"right",color:"#8899bb",fontWeight:600,whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {BASE_SHEETS.map((base, i) => {
            const sh = (base.custom && customSheet) ? { ...base, ...customSheet } : base;
            if (!sh.w || !sh.h) return null;
            const layout = getLayoutInfo(netSize.netW, netSize.netH, sh.w, sh.h,
                                         netSize.glueTab, netSize.topLid, netSize.botFloor, netSize.gtypeNoRotate||false, netSize.hangTab||0);
            if (layout.up === 0) return null;
            const utilPct = Math.round((layout.up * netSize.netW * netSize.netH) / (sh.w * sh.h) * 100);
            const overUtil = utilPct > 100;
            const R     = calcR(layout.up, qty, sh, lossOpts);
            const price = getPaperPrice(paperId, base.id, mPriceVal, customSheet);
            const cost  = Math.round(R * price);
            const isBest = bestSi && base.id === bestSi.id;
            const spr   = sheetsPerR(sh);
            return (
              <tr key={i} style={{background:isBest?"#0a2a10":overUtil?"#2a0a00":"transparent",borderBottom:"1px solid #1a2e4a",opacity:overUtil?0.6:1}}>
                <td style={{padding:"4px 5px",color:isBest?"#44ff88":overUtil?"#ff6655":"#c8d8f0",fontWeight:isBest?700:400}}>
                  {isBest?"★ ":""}{overUtil?"⛔ ":""}{sh.label.split("(")[0].trim()}
                </td>
                <td style={{padding:"4px 5px",textAlign:"right",color:"#ffcc44",fontWeight:700}}>{layout.up}up</td>
                <td style={{padding:"4px 5px",textAlign:"right",
                  color:utilPct>90?"#ff4444":utilPct>=70?"#44cc88":utilPct>=50?"#ffcc44":"#ff8855",
                  fontWeight:overUtil?700:400}}>
                  {utilPct}%{overUtil?" ⚠":""}
                </td>
                <td style={{padding:"4px 5px",textAlign:"right",color:"#a8c0e8",fontFamily:"monospace"}}>{fmtR(R)}</td>
                <td style={{padding:"4px 5px",textAlign:"right",fontSize:9,color:spr===500?"#ffaa44":"#556680"}}>
                  {spr}장
                </td>
                <td style={{padding:"4px 5px",textAlign:"right",color:"#88aacc",fontFamily:"monospace",fontSize:9}}>
                  {price.toLocaleString()}
                </td>
                <td style={{padding:"4px 5px",textAlign:"right",color:"#e8f0ff",fontFamily:"monospace"}}>₩{cost.toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{fontSize:8.5,color:"#334466",marginTop:5,lineHeight:1.7}}>
⛔ 수율 100% 초과 = 배치 불가 ｜ 🟠 500장 = 전지급 ｜ 1R = 500 × 절수
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 수량별 단가 비교
// ══════════════════════════════════════════════════════════════════
function QtyCompareTable({ s, netSize }) {
  const qtys = [500,1000,2000,3000,5000,8000,10000,15000,20000];
  const baseQty = parseInt(s.qty) || 0;

  const rows = qtys.map(q => {
    const si = findBestSheet(netSize, q, s.sheetId==="auto"?"auto":s.sheetId, s.paperId,
                             s.mPrice?s.mPriceV:"", lossOptsOf(s), customSheetOf(s));
    if (!si) return null;
    const r  = computeForQty(s, q, si, netSize);
    if (!r)  return null;
    // perEA: 공정합계 기준 (개발비·부가세 별도) — 메인 견적서와 동일 기준
    return { qty:q, perEA:r.perEA, grand:r.grandTotal, up:si.up, label:si.label, R:si.R };
  }).filter(Boolean);

  const baseRow = rows.find(x => x.qty === baseQty);

  return (
    <div style={{padding:"0 0 20px"}}>
      <div style={{padding:"10px 16px",background:"#0a1628",color:"#ffcc44",fontSize:11,fontWeight:800,letterSpacing:".1em",textTransform:"uppercase"}}>
        📊 수량별 개당 단가 비교 (고정비 분산 효과)
      </div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr style={{background:"#1a2e4a",color:"#a8c0e8"}}>
            {["수량(EA)","판형/Up","R수","총 공급가","개당 단가","기준 대비"].map((h,i)=>(
              <th key={i} style={{padding:"7px 10px",fontSize:10,fontWeight:700,textAlign:i===0?"left":"right",whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isBase = r.qty === baseQty;
            const diff   = baseRow ? Math.round((r.perEA - baseRow.perEA) / baseRow.perEA * 100) : 0;
            return (
              <tr key={i} style={{background:isBase?"#fff8e6":"#fff",borderBottom:"1px solid #eee"}}>
                <td style={{padding:"6px 10px",fontSize:12,fontWeight:isBase?800:400,color:isBase?"#cc4400":"#111"}}>
                  {r.qty.toLocaleString()}{isBase&&<span style={{fontSize:9,background:"#ffcc44",color:"#111",padding:"1px 4px",borderRadius:2,marginLeft:4}}>현재</span>}
                </td>
                <td style={{padding:"6px 10px",fontSize:10,textAlign:"right",color:"#4477aa"}}>{r.label.split("(")[0].trim()} / {r.up}up</td>
                <td style={{padding:"6px 10px",fontSize:11,textAlign:"right",color:"#555",fontFamily:"monospace"}}>{fmtR(r.R)}R</td>
                <td style={{padding:"6px 10px",fontSize:11,textAlign:"right",fontFamily:"monospace"}}>₩{fmt(r.grand)}</td>
                <td style={{padding:"6px 10px",fontSize:13,textAlign:"right",fontWeight:800,
                  color:isBase?"#cc4400":r.perEA<(baseRow?.perEA||0)?"#008844":"#333",fontFamily:"monospace"}}>₩{fmt(r.perEA)}</td>
                <td style={{padding:"6px 10px",fontSize:11,textAlign:"right",color:diff<0?"#008844":diff>0?"#cc4400":"#888"}}>
                  {isBase?"—":(diff>0?"+":"")+diff+"%"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{padding:"8px 16px",fontSize:10,color:"#8899bb",background:"#f8faff"}}>
        ※ 소부비·목형비 등 고정비는 수량이 많아질수록 분산되어 개당 단가가 낮아집니다. 운송비·부가세 별도.
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// UI PRIMITIVES
// ══════════════════════════════════════════════════════════════════
const inp = { background:"#111d33", border:"1px solid #223355", borderRadius:4, color:"#e8f0ff", fontSize:13, padding:"6px 10px", width:"100%", boxSizing:"border-box", outline:"none" };
const sel = { ...inp, cursor:"pointer" };

function Input({ value, onChange, placeholder, type="text", small }) {
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{...inp,fontSize:small?11:13}}/>;
}
function Select({ value, onChange, options }) {
  return <select value={value} onChange={e=>onChange(e.target.value)} style={sel}>
    {options.map(o=><option key={o.id??o} value={o.id??o}>{o.label??o}</option>)}
  </select>;
}
function Toggle({ checked, onChange, label }) {
  return (
    <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:"#c8d8f0"}}>
      <div onClick={()=>onChange(!checked)} style={{width:32,height:18,borderRadius:9,background:checked?"#e64433":"#223355",position:"relative",transition:"background .2s",flexShrink:0}}>
        <div style={{position:"absolute",top:2,left:checked?16:2,width:14,height:14,borderRadius:"50%",background:"white",transition:"left .2s"}}/>
      </div>
      {label}
    </label>
  );
}
function Section({ title, children }) {
  return (
    <div style={{marginBottom:18}}>
      <div style={{fontSize:9,fontWeight:800,color:"#e64433",letterSpacing:".15em",textTransform:"uppercase",borderBottom:"1px solid #1a2e4a",paddingBottom:4,marginBottom:10}}>{title}</div>
      {children}
    </div>
  );
}
function Field({ label, children, note }) {
  return (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:10,fontWeight:700,color:"#8899bb",letterSpacing:".05em",marginBottom:3,textTransform:"uppercase"}}>{label}</div>
      {children}
      {note && <div style={{fontSize:9,color:"#4488aa",marginTop:2,lineHeight:1.5}}>{note}</div>}
    </div>
  );
}
function Row2({ children }) { return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{children}</div>; }
function Row3({ children }) { return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>{children}</div>; }

function QuoteRow({ item }) {
  const cell = (v, align="right", color="#111", extra={}) => (
    <td style={{padding:"5px 8px",textAlign:align,borderBottom:"1px solid #eee",fontSize:11.5,color,...extra}}>{v}</td>
  );
  return (
    <tr style={{background:item.fixed?"#f8faff":"#fff"}}>
      {cell(item.name,"left","#111",{fontWeight:600})}
      {cell(item.spec||"","left","#555")}
      {cell(item.qty ? fmtQ(item.qty) : "","right","#333")}
      {cell(item.unit||"","center","#777")}
      {cell(item.up?fmt(item.up):"","right","#333")}
      {cell(item.amt?fmt(item.amt):"","right","#111",{fontWeight:700})}
      {cell(item.note||"","center","#cc4400",{fontSize:10,fontWeight:700})}
    </tr>
  );
}

// ══════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [s, setS] = useState({
    customer:"코리팩", product:"십자B 패키지", date:today(),
    // 규격 입력: sizeMode "box" = W·D·H로 전개도 자동계산 / "net" = 전개도 전체크기 직접입력
    sizeMode:"box",
    bW:"40", bD:"40", bH:"133", boxType:"tuck_both",
    nW:"646", nH:"258",           // 전개도 전체크기 직접입력 (예: 슬리브 646×258)
    paperId:"AB350", sheetId:"auto",
    cusW:"890", cusH:"670", cusCut:"2",   // 주문생산 판형 크기·절수
    mR:false, mRV:"",
    mUp:false, mUpV:"",          // 판걸이(up) 직접 입력
    hang:false, hangV:"15",      // 행거탭(유로홀) 돌출 mm
    lossSheets:"",                // 여분(손지) 수동 입력 장수 (빈값=자동)
    mPrice:false, mPriceV:"",
    qty:"5000",
    fpSp:"1", fpBk:true,  fpUv:false, fpColor:false,
    bpSp:"0", bpBk:false, bpUv:false, bpColor:false,
    beda:false,                   // 별색 베다(바탕 전면 인쇄) → 별색 R단가 상향
    spotMode:"weight",            // "weight"=별색 도수환산(×3) / "rpr"=별색 R당 고정단가
    spotRprV:"", printU:"",       // 별색 R단가 / 인쇄 도당단가 (빈값=판형별 기본)
    sobooU:String(SOBOO_UNIT_DEFAULT),
    fcId:"ir", bcId:"none",
    puv:false, puvS:"1",
    thomId:"n", glueId:"dan",
    admin:"100000", adminManual:false,
    newDie:true, dieQ:"1", dieP:"140000", filmC:"",
    emb:false, embRpr:String(EMB_RPR_DEFAULT), embDevP:"90000", embFilmP:"28000",
    foil:false, foilType:"금박", foilS:"1", foilRpr:String(FOIL_RPR_DEFAULT),
    foilDevP:"25000", foilFilmP:"35000",
    showCompare:false, showSheetCompare:false, showViz:true, showNet:false,
  });

  const u = (k,v) => setS(p=>({...p,[k]:v}));

  // G형 선택 시 톰슨 자동 전환 & 복귀
  const handleBoxType = (v) => {
    const isGtype = v === "gtype";
    // 박스 구조와 접착 방식은 별개:
    // 삼면접착 구조여도 접착 작업은 단면 15원이 일반적 (실측 확인)
    // 단면/삼면 자동전환 제거 → 사용자가 직접 선택
    if (isGtype) {
      setS(p=>({...p, boxType:"gtype", thomId:"g_std"}));
    } else {
      setS(p=>({
        ...p,
        boxType: v,
        thomId: p.thomId==="g_std" ? "n" : p.thomId,
      }));
    }
  };

  // ⚠ parseFloat 필수: parseInt("15.5")=15 → D≤15 조건 오작동, parseInt("73.5")=73 오차
  const W   = parseFloat(s.bW)||0;
  const D   = parseFloat(s.bD)||0;
  const H   = parseFloat(s.bH)||0;
  const qty = parseInt(s.qty)||0;

  // 전개도 크기: 박스치수 자동계산 / 전체크기 직접입력
  //   직접입력은 슬리브·손잡이형·싸바리처럼 W·D·H 공식이 없는 구조용
  //   (예: 슬리브 259×171×145 → 전체크기 646×258)
  const hangTabMM = s.hang ? (parseFloat(s.hangV) || 15) : 0;
  const netSize = useMemo(()=>{
    if (s.sizeMode === "net") {
      const nW = parseFloat(s.nW)||0, nH = parseFloat(s.nH)||0;
      if (!nW || !nH) return null;
      return { netW:nW, netH:nH, glueTab:0, topLid:0, botFloor:0, isDirect:true, hangTab:hangTabMM };
    }
    return (W&&D&&H) ? calcNetSize(W, D, H, s.boxType, hangTabMM) : null;
  }, [s.sizeMode, s.nW, s.nH, W, D, H, s.boxType, hangTabMM]);

  const lossOpts    = useMemo(()=>lossOptsOf(s),
    [s.lossSheets, s.fpSp, s.fpBk, s.fpUv, s.fpColor, s.bpSp, s.bpBk, s.bpUv, s.bpColor, s.emb, s.foil]);
  const customSheet = useMemo(()=>customSheetOf(s), [s.cusW, s.cusH, s.cusCut]);

  const sheetInfo = useMemo(()=>{
    if (!netSize) return null;
    // ── 판걸이(up) 직접 입력 (예외용) ─────────────────────────────
    // 기본은 자동계산. 견적서 10건 중 8건 재현.
    // 남은 2건은 삼면D(D=7, 전개도 공식 검증범위 밖) /
    // 맞뚜껑B(500ea 소량, 기존 2up 목형 사용 추정) — 목형이 정해진 건에만 사용.
    const mUpV = parseInt(s.mUpV);
    if (s.mUp && mUpV > 0) {
      const base = BASE_SHEETS.find(x=>x.id===s.sheetId) || BASE_SHEETS[3];
      const sh   = (base.custom && customSheet) ? { ...base, ...customSheet } : base;
      const esh  = effectiveSheet(sh.w, sh.h);
      const R    = s.mR ? (parseFloat(s.mRV)||0) : calcR(mUpV, qty, sh, lossOpts);
      return { ...sh, id: base.id, up: mUpV, R,
               sheetsPerR: sheetsPerR(sh), tier: sheetTier(sh), manualUp: true,
               utilPct: Math.round(mUpV*netSize.netW*netSize.netH/(esh.long*esh.short)*100),
               price: getPaperPrice(s.paperId, base.id, s.mPrice?s.mPriceV:"", customSheet) };
    }
    if (s.mR) {
      const base = BASE_SHEETS.find(x=>x.id===s.sheetId) || BASE_SHEETS[3];
      const sh   = (base.custom && customSheet) ? { ...base, ...customSheet } : base;
      const up = calcUpOnSheet(netSize.netW, netSize.netH, sh.w, sh.h,
                               netSize.glueTab, netSize.topLid, netSize.botFloor,
                               netSize.gtypeNoRotate || false, netSize.hangTab || 0);
      return { ...sh, id: base.id, up, R: parseFloat(s.mRV)||0,
               sheetsPerR: sheetsPerR(sh), tier: sheetTier(sh),
               utilPct: sh.w && sh.h ? Math.round(up*netSize.netW*netSize.netH/(sh.w*sh.h)*100) : 0,
               price: getPaperPrice(s.paperId, base.id, s.mPrice?s.mPriceV:"", customSheet) };
    }
    return findBestSheet(netSize, qty, s.sheetId==="auto"?"auto":s.sheetId, s.paperId,
                         s.mPrice?s.mPriceV:"", lossOpts, customSheet);
  }, [netSize, qty, s.sheetId, s.mR, s.mRV, s.mUp, s.mUpV, s.paperId, s.mPrice, s.mPriceV, lossOpts, customSheet]);

  const result = useMemo(()=>{
    try { return computeForQty(s, qty, sheetInfo, netSize); } catch(e){ return null; }
  }, [s, qty, sheetInfo, netSize]);

  // 지대 단가 정보 (실측 확인 / 면적환산 추정 구분)
  const autoPriceInfo = useMemo(()=>{
    if (!sheetInfo) return null;
    return getPaperPriceInfo(s.paperId, sheetInfo.id, "", customSheet);
  }, [sheetInfo, s.paperId, customSheet]);

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'Segoe UI','Noto Sans KR',sans-serif",background:"#0a1628",color:"#d0e0ff",overflow:"hidden"}}>

      {/* ══ LEFT PANEL ═══════════════════════════════════════════════ */}
      <div style={{width:310,flexShrink:0,background:"#0d1e36",borderRight:"2px solid #1a2e4a",padding:"14px",overflowY:"auto"}}>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:8,fontWeight:800,color:"#e64433",letterSpacing:".2em",textTransform:"uppercase"}}>자사</div>
          <div style={{fontSize:15,fontWeight:900,color:"#e8f0ff",marginTop:2}}>자동 견적 산출 시스템</div>
          <div style={{fontSize:9,color:"#556680",marginTop:1}}>v8.0 · 견적서 78건 역산 · 절수별 1R · 별색 3배 · 전개도 직접입력</div>
        </div>

        <Section title="기본 정보">
          <Field label="거래처"><Input value={s.customer} onChange={v=>u("customer",v)}/></Field>
          <Field label="품목명"><Input value={s.product}  onChange={v=>u("product",v)}/></Field>
          <Row2>
            <Field label="수량(EA)"><Input value={s.qty} onChange={v=>u("qty",v)} type="number"/></Field>
            <Field label="날짜"><Input value={s.date} onChange={v=>u("date",v)} small/></Field>
          </Row2>
        </Section>

        <Section title="박스 규격 및 구조">
          <Field label="규격 입력 방식">
            <Select value={s.sizeMode} onChange={v=>u("sizeMode",v)} options={[
              {id:"box", label:"박스 치수 (W×D×H) → 전개도 자동"},
              {id:"net", label:"전개도 전체크기 직접입력"},
            ]}/>
          </Field>

          {s.sizeMode === "net" ? (
            <>
              <div style={{background:"#0a0f20",border:"1px solid #2a3a5a",borderRadius:4,padding:"8px 10px",
                           fontSize:9,color:"#7799bb",marginBottom:8,lineHeight:1.8}}>
                슬리브·손잡이형·싸바리처럼 W·D·H 공식이 없는 구조는 전개도 전체크기를 직접 넣으세요.
                <div style={{color:"#556680",marginTop:3}}>예) 슬리브 259×171×145 → 전체크기 <b style={{color:"#88bbdd"}}>646 × 258</b></div>
              </div>
              <Row2>
                <Field label="전체 가로 mm"><Input value={s.nW} onChange={v=>u("nW",v)} placeholder="646" type="number"/></Field>
                <Field label="전체 세로 mm"><Input value={s.nH} onChange={v=>u("nH",v)} placeholder="258" type="number"/></Field>
              </Row2>
            </>
          ) : (
            <Field label="박스 구조 (Type)" note="구조에 따라 뚜껑·바닥 전개 치수 자동 반영">
              <Select value={s.boxType} onChange={v=>handleBoxType(v)} options={BOX_TYPES}/>
            </Field>
          )}

          {/* G형 안내 박스 */}
          {s.sizeMode === "box" && s.boxType === "gtype" && (
            <div style={{background:"#07150a",border:"1px solid #1a4a22",borderRadius:4,padding:"9px 11px",fontSize:10,color:"#44cc77",marginBottom:10,lineHeight:1.8}}>
              <div style={{fontWeight:800,color:"#66ff99",marginBottom:6,fontSize:11}}>
                📦 G형 (톰슨조립)
              </div>
              <div style={{fontSize:9,color:"#336644"}}>
                치수 입력 후 전개도 치수가 자동 계산됩니다.
              </div>
              {netSize?.gtypeWarning && (
                <div style={{marginTop:4,fontSize:9,color:"#ffaa44",background:"#2a1a00",
                  border:"1px solid #664400",borderRadius:3,padding:"4px 6px"}}>
                  ⚠ {netSize.gtypeWarning}
                </div>
              )}
            </div>
          )}
          {s.sizeMode === "box" && (
            <Row3>
              <Field label="가로 W mm"><Input value={s.bW} onChange={v=>u("bW",v)} placeholder="mm" type="number"/></Field>
              <Field label="깊이 D mm"><Input value={s.bD} onChange={v=>u("bD",v)} placeholder="mm" type="number"/></Field>
              <Field label="높이 H mm"><Input value={s.bH} onChange={v=>u("bH",v)} placeholder="mm" type="number"/></Field>
            </Row3>
          )}

          {/* 전개도 치수 */}
          {netSize && (
            <div style={{background:"#050f1c",border:"1px solid #1a3050",borderRadius:4,padding:"8px 10px",fontSize:10.5,color:"#66aadd",lineHeight:2,marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span>전개도 가로</span>
                <strong style={{color:"#e8f0ff",fontFamily:"monospace"}}>{fmtMM(netSize.netW)} mm</strong>
              </div>
              <div style={{display:"flex",justifyContent:"space-between"}}>
                <span>전개도 세로</span>
                <strong style={{color:"#e8f0ff",fontFamily:"monospace"}}>{fmtMM(netSize.netH)} mm</strong>
              </div>
              {netSize.isDirect ? (
                <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1a3050",marginTop:4,paddingTop:4}}>
                  <span style={{color:"#88bbdd",fontSize:9}}>전체크기 직접입력</span>
                  <span style={{color:"#88bbdd",fontSize:9,fontFamily:"monospace"}}>날개 계산 없음</span>
                </div>
              ) : netSize.isGtype ? (
                <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1a3050",marginTop:4,paddingTop:4}}>
                  <span style={{color:"#44cc77",fontSize:9}}>G형 (톰슨조립)</span>
                  <span style={{color:"#44cc77",fontSize:9,fontFamily:"monospace"}}>접착날개 14mm</span>
                </div>
              ) : (
                <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1a3050",marginTop:4,paddingTop:4}}>
                  <span style={{color:"#8899bb",fontSize:9}}>뚜껑 / 바닥 / 접착날개{netSize.hangTab?" / 행거탭":""}</span>
                  <span style={{color:"#8899bb",fontSize:9,fontFamily:"monospace"}}>
                    {fmtMM(netSize.topLid)} / {fmtMM(netSize.botFloor)} / {fmtMM(netSize.glueTab)}
                    {netSize.hangTab ? ` / ${fmtMM(netSize.hangTab)}` : ""} mm
                  </span>
                </div>
              )}
            </div>
          )}

          {/* 판걸이 정보 */}
          {sheetInfo && netSize && (
            <div style={{background:"#0a1628",border:"1px solid #1a4a2a",borderRadius:4,padding:"8px 10px",fontSize:11,color:"#44cc88",lineHeight:2}}>
              {(() => {
                const layout = getLayoutInfo(netSize.netW, netSize.netH, sheetInfo.w, sheetInfo.h,
                                             netSize.glueTab, netSize.topLid, netSize.botFloor, netSize.gtypeNoRotate||false, netSize.hangTab||0);
                return (
                  <>
                    <div>✦ 판형: <strong>{sheetInfo.label}</strong></div>
                    <div>✦ 판걸이: <strong style={{color:"#ffcc44"}}>{sheetInfo.up} up</strong>
                      {layout.rotated && <span style={{fontSize:9,color:"#f59e0b",marginLeft:5,fontWeight:700}}>↺ 회전</span>}
                      {layout.interlocked && <span style={{fontSize:9,color:"#10b981",marginLeft:5,fontWeight:700}}>⇅ 인터로킹</span>}
                    </div>
                    <div>✦ 수율: <strong style={{color:layout.footPct>=MAX_FOOT_PCT?"#ff6655":layout.footPct>=65?"#44cc88":"#ffcc44"}}>
                        {layout.utilPct}%</strong>
                      <span style={{fontSize:9,color:"#336655",marginLeft:5}}>
                        발자국 {layout.footPct}% · 물림 {BITE_SHORT}/{BITE_LONG}mm · 상한 {MAX_FOOT_PCT}%
                      </span>
                      {layout.utilCapped && <span style={{fontSize:9,color:"#ffaa44",marginLeft:5,fontWeight:700}}>⚠ 상한 적용</span>}
                    </div>
                    {layout.pressCapped && (
                      <div style={{fontSize:9,color:"#ffaa44"}}>
                        ⚠ 인쇄기 제약 — {sheetInfo.w}×{sheetInfo.h} 원지를 <strong>{layout.sheetW}×{layout.sheetH}</strong>로 재단해서 걺
                        (인쇄기 최대 {PRESS_MAX_LONG}×{PRESS_MAX_SHORT}mm)
                      </div>
                    )}
                    <div>✦ 지대R: <strong>{fmtR(sheetInfo.R)} R</strong>
                      <span style={{fontSize:9,color:"#336655",marginLeft:5}}>1R = {sheetInfo.sheetsPerR?.toLocaleString()}장 (절수 {sheetInfo.cut})</span>
                    </div>
                    {result && (
                      <div>✦ 공정R: <strong style={{color:"#88ccff"}}>{fmtR(result.processR)} R</strong>
                        <span style={{fontSize:9,color:"#336655",marginLeft:5}}>정미 {result.net.toLocaleString()}장 ÷ 1,000</span>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* 시각화 */}
          {netSize && sheetInfo && (
            <div style={{marginTop:8}}>
              <Toggle checked={s.showViz} onChange={v=>u("showViz",v)} label="배치 시각화"/>
              {s.showViz && <LayoutViz si={sheetInfo} netSize={netSize} W={W} D={D} H={H} boxType={s.boxType}/>}
            </div>
          )}

          {/* 전개도 미리보기 */}
          {netSize && !netSize.isGtype && (
            <div style={{marginTop:6}}>
              <Toggle checked={s.showNet} onChange={v=>u("showNet",v)} label="전개도 미리보기"/>
              {s.showNet && <NetDiagram W={W} D={D} H={H} boxType={s.boxType} netSize={netSize}/>}
            </div>
          )}

          {/* 판형별 비교 */}
          {netSize && (
            <div style={{marginTop:8}}>
              <Toggle checked={s.showSheetCompare} onChange={v=>u("showSheetCompare",v)} label="판형별 비교"/>
              {s.showSheetCompare && <SheetCompare netSize={netSize} qty={qty} paperId={s.paperId} sheetId={s.sheetId} mPriceVal={s.mPrice?s.mPriceV:""} lossOpts={lossOpts} customSheet={customSheet}/>}
            </div>
          )}
        </Section>

        {/* ══ [V6] 지대 섹션 — 판형별 단가 표시 + 직접입력 ══ */}
        <Section title="지대 (원지)">
          <Field label="지종 선택" note="단가는 견적서 최근값 기준 ｜ 미등록 조합은 장당 단가 × 면적비로 추정">
            <Select value={s.paperId} onChange={v=>u("paperId",v)}
              options={PAPERS.map(p=>({id:p.id,label:`[${p.group}] ${p.label}`}))}/>
          </Field>
          <Field label="판형 선택" note="1R = 500 × 절수 장">
            <Select value={s.sheetId} onChange={v=>u("sheetId",v)}
              options={[{id:"auto",label:"⚡ 자동 최적 (총비용 최소)"}, ...BASE_SHEETS]}/>
          </Field>
          {s.sheetId === "custom" && (
            <div style={{background:"#0a0f20",border:"1px solid #3a2a5a",borderRadius:4,padding:"8px 10px",marginBottom:8}}>
              <div style={{fontSize:9,color:"#aa88ff",fontWeight:700,marginBottom:6}}>주문생산 원지</div>
              <Row3>
                <Field label="가로 mm"><Input value={s.cusW} onChange={v=>u("cusW",v)} type="number"/></Field>
                <Field label="세로 mm"><Input value={s.cusH} onChange={v=>u("cusH",v)} type="number"/></Field>
                <Field label="절수"><Select value={s.cusCut} onChange={v=>u("cusCut",v)} options={["1","2","3","4"]}/></Field>
              </Row3>
              <div style={{fontSize:8.5,color:"#665588",marginTop:2}}>
                1R = {(500*(parseInt(s.cusCut)||2)).toLocaleString()}장 ｜ 주문생산A 890×670 건에서 절수 2로 역산됨
              </div>
            </div>
          )}
          {/* 자동 모드에서 현재 판형 고정 — 옵션 변경 시 판형 바뀌는 문제 방지 */}
          {s.sheetId === "auto" && sheetInfo && (
            <div style={{marginTop:-4,marginBottom:6,fontSize:9,color:"#6688aa",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>현재 자동선택: <strong style={{color:"#ffcc44"}}>{sheetInfo.label?.split("(")[0].trim()}</strong></span>
              <button onClick={()=>u("sheetId", sheetInfo.id)}
                style={{background:"#1a3050",color:"#88ccff",border:"1px solid #2a4a6a",
                  borderRadius:3,padding:"2px 8px",fontSize:9,cursor:"pointer",fontWeight:700}}>
                📌 판형 고정
              </button>
            </div>
          )}

          {/* 지대 단가 자동 표시 */}
          {sheetInfo && !s.mPrice && (()=>{
            const pi = getPaperPriceInfo(s.paperId, sheetInfo.id, "", customSheet);
            return (
              <div style={{background:"#050f1c",border:`1px solid ${pi.noData?"#aa2200":pi.confirmed?"#1a3a50":"#4a2a10"}`,borderRadius:4,padding:"7px 10px",fontSize:10,color:"#66aadd",marginBottom:8}}>
                {pi.noData ? (
                  <div>
                    <div style={{color:"#ff6644",fontWeight:700,fontSize:11}}>⚠ 지대 단가 미등록</div>
                    <div style={{color:"#884422",fontSize:9,marginTop:3}}>
                      이 지종×판형 조합의 단가가 없습니다.<br/>
                      아래 "지대 단가 직접 입력"에서 실제 단가를 입력해주세요.
                    </div>
                  </div>
                ) : (
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span>
                      지대 단가
                      <span style={{fontSize:8,marginLeft:4,padding:"1px 5px",borderRadius:2,
                        background:pi.confirmed?"#0a3020":"#3a2000",
                        color:pi.confirmed?"#44cc88":"#ffaa44"}}>
                        {pi.confirmed?"✓ 확인":"⚠ 추정"}
                      </span>
                    </span>
                    <strong style={{color:pi.confirmed?"#ffcc44":"#ff9944",fontFamily:"monospace",fontSize:13}}>
                      {pi.price.toLocaleString()} 원/R
                    </strong>
                  </div>
                )}
                {!pi.noData && (
                  <div style={{fontSize:8.5,color:"#335566",marginTop:3}}>
                    {pi.confirmed
                      ? `${sheetInfo.label.split("(")[0].trim()} 견적서 실측가 · 1R=${sheetInfo.sheetsPerR?.toLocaleString()}장`
                      : `${(BASE_SHEETS.find(x=>x.id===pi.estimateFrom)?.label||"").split("(")[0].trim()} 장당단가 × 면적비 환산 (미확인)`}
                  </div>
                )}
              </div>
            );
          })()}

          {/* [V6] 단가 직접입력 */}
          <div style={{marginTop:4}}>
            <Toggle checked={s.mPrice} onChange={v=>u("mPrice",v)} label="지대 단가 직접 입력"/>
          </div>
          {s.mPrice && (
            <div style={{marginTop:8}}>
              <Field label="단가 (원/R)" note="업체 실제 단가 입력 시 이 값이 우선 적용됩니다">
                <Input value={s.mPriceV} onChange={v=>u("mPriceV",v)} type="number"
                  placeholder={`예: ${autoPriceInfo?.price?.toLocaleString()||"518196"}`}/>
              </Field>
            </div>
          )}

          <div style={{marginTop:6}}>
            <Toggle checked={s.hang} onChange={v=>u("hang",v)} label="행거탭 (유로홀 걸이)"/>
            <Toggle checked={s.mUp} onChange={v=>u("mUp",v)} label="판걸이(up) 직접 입력"/>
            <Toggle checked={s.mR} onChange={v=>u("mR",v)} label="R수 직접 입력"/>
          </div>
          {s.hang && (
            <div style={{marginTop:8,background:"#0a1828",border:"1px solid #1a3050",borderRadius:4,padding:"8px 10px"}}>
              <Field label="행거탭 돌출 (mm)"
                note="다이소 등 걸이봉용 유로홀 탭. 위쪽 한 곳만 튀어나와 맞물림 배치에서 옆 열 빈공간에 끼워지므로, 열 간격(피치)에는 안 더하고 전체 외곽에만 1회 더함">
                <Input value={s.hangV} onChange={v=>u("hangV",v)} type="number" placeholder="15"/>
              </Field>
            </div>
          )}
          {s.mUp && (
            <div style={{marginTop:8,background:"#0a1828",border:"1px solid #1a3050",borderRadius:4,padding:"8px 10px"}}>
              <Field label="판걸이(up) 직접 입력"
                note="기본은 자동계산(견적서 8/10 재현). 기존 목형이 정해져 있어 up을 강제해야 할 때만 사용">
                <Input value={s.mUpV} onChange={v=>u("mUpV",v)} type="number" placeholder="예: 6"/>
              </Field>
              <div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
                {[1,2,3,4,6,8,12].map(n=>(
                  <button key={n} onClick={()=>u("mUpV",String(n))}
                    style={{fontSize:9,padding:"2px 7px",borderRadius:3,cursor:"pointer",
                      background: s.mUpV===String(n) ? "#1a4a6a" : "#0a1a2a",
                      color:      s.mUpV===String(n) ? "#66ccff" : "#4488aa",
                      border:"1px solid #1a3050"}}>{n}up</button>
                ))}
              </div>
            </div>
          )}
          {s.mR && (
            <div style={{marginTop:8}}>
              <Field label="R수 직접 입력">
                <Input value={s.mRV} onChange={v=>u("mRV",v)} type="number" placeholder="예: 0.70"/>
              </Field>
            </div>
          )}

          {/* 여분(Loss) 수동 입력 — R수 직접 입력이 아닐 때만 표시 */}
          {!s.mR && (
            <div style={{marginTop:8,background:"#0a1828",border:"1px solid #1a3050",borderRadius:4,padding:"8px 10px"}}>
              <Field label="여분(손지) 수동 입력"
                note="빈값=자동. max(300, 정미×5%) + 양면 100 + 박·형압 50">
                <div style={{display:"flex",gap:4,alignItems:"center"}}>
                  <Input value={s.lossSheets} onChange={v=>u("lossSheets",v)} type="number" placeholder="자동"/>
                  <div style={{display:"flex",gap:3}}>
                    {[
                      {v:"",    l:"자동"},
                      {v:"300", l:"기본 300"},
                      {v:"400", l:"양면 400"},
                      {v:"600", l:"합지 600"},
                    ].map(o=>(
                      <button key={o.l} onClick={()=>u("lossSheets",o.v)}
                        style={{padding:"4px 6px",fontSize:8,fontWeight:700,
                          background: s.lossSheets===o.v ? "#1a4a6a" : "#0a1a2a",
                          color: s.lossSheets===o.v ? "#66ccff" : "#4488aa",
                          border:"1px solid "+(s.lossSheets===o.v?"#2a6a8a":"#1a3a5a"),
                          borderRadius:3,cursor:"pointer",whiteSpace:"nowrap"}}>
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
              </Field>
              {/* 자동 판단된 여분 표시 */}
              {(!s.lossSheets || s.lossSheets === "") && result?.autoLossEstimate > 0 && (
                <div style={{fontSize:9,color:"#44ccaa",marginTop:4,fontFamily:"monospace"}}>
                  ▸ 자동 판단: 정미 {result.autoLossNet}장 + 여분 <b>{result.autoLossEstimate}장</b>
                  <span style={{color:"#335544",marginLeft:6}}>
                    ({result.autoLossEstimate === 25 ? "초소량" :
                      result.autoLossEstimate >= 600 ? "합지" :
                      result.autoLossEstimate >= 350 ? "후가공/대량" : "표준"})
                  </span>
                </div>
              )}
              {s.lossSheets !== "" && parseFloat(s.lossSheets) > 0 && sheetInfo && qty > 0 && (
                <div style={{fontSize:9,color:"#44cc88",marginTop:4,fontFamily:"monospace"}}>
                  ▸ 수동: 정미 {Math.ceil(qty/sheetInfo.up)}장 + 여분 {parseFloat(s.lossSheets)}장
                  = 총 {Math.ceil(qty/sheetInfo.up)+parseFloat(s.lossSheets)}장
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title="인쇄">
          {["f","b"].map(side => {
            const isF = side === "f";
            const kSp=`${side}pSp`, kBk=`${side}pBk`, kUv=`${side}pUv`, kCol=`${side}pColor`;
            const sp = parseInt(s[kSp])||0, isColor = !!s[kCol];
            const doN = (isColor?4:sp) + (s[kBk]?1:0);
            return (
              <div key={side} style={{background:"#080e1c",border:"1px solid #1a3050",borderRadius:4,padding:"10px",marginBottom:8}}>
                <div style={{fontSize:9,color:isF?"#4aaeff":"#88aacc",fontWeight:700,marginBottom:8,letterSpacing:".08em"}}>
                  {isF?"전 면":"후 면"} 인쇄
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8}}>
                  <Toggle checked={isColor} onChange={v=>u(kCol,v)} label="원색 4도 (CMYK)"/>
                  {!isColor && (
                    <Field label="별색 도수 (0~8)" note="별색 1도 = 인쇄 3회 환산">
                      <Input value={s[kSp]} onChange={v=>u(kSp,Math.max(0,Math.min(8,parseInt(v)||0)).toString())} type="number" placeholder="0"/>
                    </Field>
                  )}
                  <div style={{display:"flex",gap:10}}>
                    <Toggle checked={!!s[kBk]} onChange={v=>u(kBk,v)} label="먹 1도"/>
                    <Toggle checked={!!s[kUv]} onChange={v=>u(kUv,v)} label="UV 인쇄"/>
                  </div>
                </div>
                {(doN>0 || s[kUv]) && (
                  <div style={{fontSize:9,color:isF?"#44cc88":"#88aacc",padding:"3px 6px",background:isF?"#0a2a10":"#0a1828",borderRadius:3}}>
                    {isF?"전면":"후면"} {[s[kUv]?"UV":"", isColor?"원색4도":(sp>0?`별색${sp}도`:""), s[kBk]?"먹1도":""].filter(Boolean).join("+")}
                    &nbsp;— 소부 {doN}판{s[kUv] && <span style={{color:"#88ccff"}}> (UV별도)</span>}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── 별색 인쇄 계산 방식 ────────────────────────────────── */}
          {(((parseInt(s.fpSp)||0) > 0 && !s.fpColor) || ((parseInt(s.bpSp)||0) > 0 && !s.bpColor)) && (
            <div style={{background:"#0a0f1e",border:"1px solid #3a2a1a",borderRadius:4,padding:"10px",marginBottom:8}}>
              <div style={{fontSize:9,color:"#ffaa44",fontWeight:700,marginBottom:8,letterSpacing:".08em"}}>별색 인쇄 계산</div>
              <Field label="계산 방식">
                <Select value={s.spotMode} onChange={v=>u("spotMode",v)} options={[
                  {id:"weight", label:"도수환산 (별색 1도 = 3회)"},
                  {id:"rpr",    label:"별색 R당 고정단가"},
                ]}/>
              </Field>
              <Toggle checked={s.beda} onChange={v=>u("beda",v)} label="베다 (바탕 전면 인쇄)"/>
              {s.spotMode === "rpr" && (
                <div style={{marginTop:8}}>
                  <Field label="별색 R당 단가" note={`기본 ${(s.beda?SPOT_RPR_BEDA:SPOT_RPR_PLAIN).toLocaleString()}원/R`}>
                    <Input value={s.spotRprV} onChange={v=>u("spotRprV",v)} type="number"
                           placeholder={String(s.beda?SPOT_RPR_BEDA:SPOT_RPR_PLAIN)}/>
                  </Field>
                </div>
              )}
              <div style={{fontSize:8.5,color:"#776655",marginTop:6,lineHeight:1.7}}>
                견적서 대조 근거 — 삼면E <b>별2 → 6×14,000</b> vs 같은 박스 <b>원색4 → 4×14,000</b>.
                베다는 R당 실효금액이 75,000~84,000으로 확실히 높음.
              </div>
            </div>
          )}
          <Row2>
            <Field label="소부 단가 (원/도)" note="26-04 이후 12,000">
              <Input value={s.sobooU} onChange={v=>u("sobooU",v)} type="number"/>
            </Field>
            <Field label="인쇄 단가 (원/도·R)" note={sheetInfo ? `판형 기본 ${printUnitFor(sheetInfo.tier).toLocaleString()}` : "판형별 기본"}>
              <Input value={s.printU} onChange={v=>u("printU",v)} type="number"
                     placeholder={sheetInfo ? String(printUnitFor(sheetInfo.tier)) : String(PRINT_UNIT_DEFAULT)}/>
            </Field>
          </Row2>
          {result && result.totalColors > 0 && (
            <div style={{fontSize:10,color:"#ffcc44",padding:"4px 8px",background:"#111d33",borderRadius:3,textAlign:"right"}}>
              소부 {result.totalColors}도 × {(parseInt(s.sobooU)||SOBOO_UNIT_DEFAULT).toLocaleString()}원
              = {(result.totalColors*(parseInt(s.sobooU)||SOBOO_UNIT_DEFAULT)).toLocaleString()}원
              {(s.fpUv||s.bpUv) && <span style={{color:"#88aacc",marginLeft:6,fontSize:9}}>UV인쇄 별도</span>}
            </div>
          )}
        </Section>

        <Section title="코팅 / 후가공">
          <Row2>
            <Field label="전면 코팅"><Select value={s.fcId} onChange={v=>u("fcId",v)} options={COAT_OPTS}/></Field>
            <Field label="후면 코팅"><Select value={s.bcId} onChange={v=>u("bcId",v)} options={COAT_OPTS}/></Field>
          </Row2>
          <Toggle checked={s.puv} onChange={v=>u("puv",v)} label="부분코팅 (95,000원/R)"/>
          {s.puv && (
            <div style={{marginTop:8}}>
              <Field label="부분코팅 면수"><Select value={s.puvS} onChange={v=>u("puvS",v)} options={["1","2"]}/></Field>
            </div>
          )}
          {/* 박 (금박·은박·먹박) */}
          <div style={{marginTop:8}}>
            <Toggle checked={s.foil} onChange={v=>u("foil",v)} label="박 (금박 / 은박 / 먹박)"/>
          </div>
          {s.foil && (
            <div style={{marginTop:8,background:"#080e1c",border:"1px solid #3a3010",borderRadius:4,padding:"10px"}}>
              <div style={{fontSize:9,color:"#ddbb44",fontWeight:700,marginBottom:8}}>박 옵션</div>
              <Row2>
                <Field label="종류">
                  <Select value={s.foilType} onChange={v=>u("foilType",v)} options={["금박","은박","먹박","은박/금박"]}/>
                </Field>
                <Field label="면수"><Select value={s.foilS} onChange={v=>u("foilS",v)} options={["1","2"]}/></Field>
              </Row2>
              <Field label="박 공정 단가 (원/R)" note="금박 140,000 · 먹박 120,000 · 양면 100,000">
                <Input value={s.foilRpr} onChange={v=>u("foilRpr",v)} type="number"/>
              </Field>
              <Row2>
                <Field label="동판 (원)"><Input value={s.foilDevP} onChange={v=>u("foilDevP",v)} type="number"/></Field>
                <Field label="동판필름 (원)"><Input value={s.foilFilmP} onChange={v=>u("foilFilmP",v)} type="number"/></Field>
              </Row2>
            </div>
          )}
          {/* 형압(디보싱) */}
          <div style={{marginTop:8}}>
            <Toggle checked={s.emb} onChange={v=>u("emb",v)} label="형압 (디보싱 / 엠보싱)"/>
          </div>
          {s.emb && (
            <div style={{marginTop:8,background:"#080e1c",border:"1px solid #2a1a3a",borderRadius:4,padding:"10px"}}>
              <div style={{fontSize:9,color:"#cc88ff",fontWeight:700,marginBottom:8}}>형압 옵션</div>
              <Field label="형압 공정 단가 (원/R)" note="디보싱 프레스 단가">
                <Input value={s.embRpr} onChange={v=>u("embRpr",v)} type="number"/>
              </Field>
              <Row2>
                <Field label="형압 개발비 (원)"><Input value={s.embDevP} onChange={v=>u("embDevP",v)} type="number"/></Field>
                <Field label="형압 필름 (원)"><Input value={s.embFilmP} onChange={v=>u("embFilmP",v)} type="number"/></Field>
              </Row2>
            </div>
          )}
          <div style={{marginTop:8}}>
            <Field label="부분코팅 필름비 (원)">
              <Input value={s.filmC} onChange={v=>u("filmC",v)} type="number" placeholder="예: 30000"/>
            </Field>
          </div>
        </Section>

        <Section title="가공">
          <Row2>
            <Field label="톰슨 (도무송)"><Select value={s.thomId} onChange={v=>u("thomId",v)} options={THOMSON_OPTS}/></Field>
            <Field label="접착 방식"><Select value={s.glueId} onChange={v=>u("glueId",v)} options={GLUE_OPTS}/></Field>
          </Row2>
          <div style={{marginTop:6}}>
            <Toggle checked={s.adminManual} onChange={v=>u("adminManual",v)} label="일반관리비 직접 입력"/>
          </div>
          {s.adminManual ? (
            <Field label="일반관리비 (원)">
              <Input value={s.admin} onChange={v=>u("admin",v)} type="number"/>
            </Field>
          ) : (
            <div style={{fontSize:10,color:"#4488aa",padding:"5px 8px",background:"#050f1c",borderRadius:3,marginTop:6,lineHeight:1.7}}>
              자동: <strong style={{color:"#88ccdd"}}>{calcAdmin(parseInt(s.qty)||0).toLocaleString()}원</strong>
              <div style={{fontSize:8.5,color:"#335566"}}>
                100,000 + 수량×5원 (1만원 단위) ｜ 싸바리·G형은 실측이 더 높음 → 직접 입력 권장
              </div>
            </div>
          )}
        </Section>

        <Section title="개발비 (목형)">
          <Toggle checked={s.newDie} onChange={v=>u("newDie",v)} label="신규 목형 제작"/>
          {s.newDie && (
            <div style={{marginTop:10}}>
              <Row2>
                <Field label="목형 수량"><Input value={s.dieQ} onChange={v=>u("dieQ",v)} type="number"/></Field>
                <Field label="목형 단가 (원)" note="실제 120,000~240,000원"><Input value={s.dieP} onChange={v=>u("dieP",v)} type="number"/></Field>
              </Row2>
            </div>
          )}
        </Section>

        <div style={{paddingTop:4}}>
          <Toggle checked={s.showCompare} onChange={v=>u("showCompare",v)} label="수량별 단가 비교표"/>
        </div>
      </div>

      {/* ══ RIGHT PANEL ══════════════════════════════════════════════ */}
      <div style={{flex:1,overflowY:"auto",background:"#e8ecf2",padding:"20px 24px"}}>
        {result ? (
          <div style={{maxWidth:760,margin:"0 auto"}}>
            <div style={{background:"white",boxShadow:"0 4px 24px rgba(0,0,0,.15)",marginBottom:20}}>

              {/* 헤더 */}
              <div style={{background:"#0a1628",color:"white",padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{fontSize:20,fontWeight:900,letterSpacing:".08em",color:"#e8f0ff"}}>&gt;&gt;견&nbsp;&nbsp;적&nbsp;&nbsp;서</div>
                <div style={{textAlign:"right",fontSize:10,color:"#8899cc",lineHeight:1.9}}>
                  <div style={{color:"#ffcc44",fontWeight:700}}>{s.date}</div>
                  <div>자사</div>
                  <div>서울시 중구 서애로 5길 14</div>
                  <div>TEL: 2268-3774  FAX: 2265-5283</div>
                </div>
              </div>

              {/* 거래처 정보 */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:"2px solid #0a1628"}}>
                {[
                  ["거래처",s.customer||"—"],["상  호","자사"],
                  ["품  목",s.product||"—"], ["주  소","서울시 중구 서애로 5길 14"],
                  ["수  량",`${qty.toLocaleString()} EA`],["연락처","TEL:2268-3774 FAX:2265-5283"],
                  ["담당자",""],["담당자",""],
                ].map(([k,v],i)=>(
                  <div key={i} style={{display:"flex",borderBottom:"1px solid #ddd",borderRight:i%2===0?"1px solid #ddd":"none"}}>
                    <div style={{width:56,background:"#f0f4f8",padding:"5px 8px",fontSize:10,fontWeight:700,color:"#334",borderRight:"1px solid #ddd",flexShrink:0}}>{k}</div>
                    <div style={{padding:"5px 8px",fontSize:11,color:"#111"}}>{v}</div>
                  </div>
                ))}
              </div>

              {/* 판걸이 배너 */}
              {sheetInfo && netSize && (
                <div style={{background:"#f0f8ff",borderBottom:"1px solid #c8ddf0",padding:"7px 16px",fontSize:11,color:"#114466",display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
                  {(() => {
                    const layout = getLayoutInfo(netSize.netW, netSize.netH, sheetInfo.w, sheetInfo.h,
                                                 netSize.glueTab, netSize.topLid, netSize.botFloor, netSize.gtypeNoRotate||false, netSize.hangTab||0);
                    return (
                      <>
                        <span>📐 전개도: <strong>{fmtMM(netSize.netW)}×{fmtMM(netSize.netH + (netSize.hangTab||0))}mm</strong>
                          {!!netSize.hangTab && <span style={{fontSize:9,color:"#ffaa44",marginLeft:4}}>
                            (몸판 {fmtMM(netSize.netH)} + 행거탭 {fmtMM(netSize.hangTab)})</span>}
                        </span>
                        <span>🗒 원지: <strong>{sheetInfo.label}</strong></span>
                        <span>▦ 판걸이: <strong style={{color:"#cc4400"}}>{sheetInfo.up} up</strong>
                          {layout.rotated && <span style={{fontSize:9,background:"#f59e0b",color:"#000",padding:"1px 4px",borderRadius:2,marginLeft:4,fontWeight:700}}>↺회전</span>}
                          {layout.interlocked && <span style={{fontSize:9,background:"#10b981",color:"#000",padding:"1px 4px",borderRadius:2,marginLeft:4,fontWeight:700}}>⇅인터로킹</span>}
                        </span>
                        <span>📜 R수: <strong>{fmtR(sheetInfo.R)} R</strong>
                          {(sheetInfo.sheetsPerR||1000)===500 && (
                            <span style={{fontSize:9,background:"#cc440022",color:"#cc6600",padding:"1px 4px",borderRadius:2,marginLeft:4,fontWeight:700}}>500장/연</span>
                          )}
                        </span>
                        <span>💴 단가: <strong>{result.sheetPricePerR?.toLocaleString()}원/R</strong></span>
                        <span style={{fontSize:9,color:"#6688aa"}}>[{BOX_TYPES.find(b=>b.id===s.boxType)?.label.split(" ")[0]}]</span>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* 견적 테이블 */}
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#0a1628",color:"white"}}>
                    {["항  목","규  격","수  량","단위","단  가","공급가액","비고"].map(h=>(
                      <th key={h} style={{padding:"7px 10px",fontSize:10.5,fontWeight:700,
                        textAlign:h==="항  목"||h==="규  격"?"left":"right",letterSpacing:".05em",whiteSpace:"nowrap"}}>{h}</th>
                    ))}
                  </tr>
                  <tr style={{background:"#e8eef8"}}>
                    <td colSpan={2}/><td style={{padding:"4px 10px",textAlign:"right",fontSize:12,fontWeight:700,color:"#0a1628"}}>{qty.toLocaleString()}</td>
                    <td style={{padding:"4px 10px",textAlign:"center",fontSize:12,fontWeight:700}}>EA</td>
                    <td colSpan={3}/>
                  </tr>
                </thead>
                <tbody>
                  {result.lines.map((it,i)=><QuoteRow key={i} item={it}/>)}
                  <tr style={{background:"#f0f4f8"}}>
                    <td colSpan={5} style={{padding:"7px 10px",borderTop:"2px solid #0a1628",borderBottom:"1px solid #ccc"}}/>
                    <td style={{padding:"7px 10px",textAlign:"right",fontWeight:900,fontSize:15,color:"#cc2200",borderTop:"2px solid #0a1628",fontFamily:"'Courier New',monospace"}}>
                      {fmt(result.processTot)}
                    </td>
                    <td style={{padding:"7px 8px",fontSize:10,color:"#888",borderTop:"2px solid #0a1628"}}>운송비 별도</td>
                  </tr>
                </tbody>
              </table>

              {result.showIRWarning && (
                <div style={{margin:"8px 16px 0",padding:"9px 14px",background:"#fff8f0",border:"1px solid #ffaa44",borderRadius:4,color:"#cc4400",fontSize:13,fontWeight:700}}>
                  ⚠ IR코팅 하더라도 뒷 묻음이 생길 수 있습니다
                </div>
              )}

              {result.devLines.length>0 && (
                <table style={{width:"100%",borderCollapse:"collapse",marginTop:6}}>
                  <tbody>
                    <tr><td colSpan={8} style={{padding:"5px 10px",fontSize:10.5,fontWeight:800,color:"#0a1628",background:"#e8eef8",letterSpacing:".08em"}}>개 발 비</td></tr>
                    {result.devLines.map((it,i)=>(
                      <tr key={i} style={{background:"#fff"}}>
                        <td style={{padding:"5px 10px",fontSize:12,fontWeight:700,color:"#111",width:"20%"}}>{it.name}</td>
                        <td colSpan={2}/><td style={{padding:"5px 10px",textAlign:"right",fontSize:12}}>{it.qty}</td><td/>
                        <td style={{padding:"5px 10px",textAlign:"right",fontSize:12,fontFamily:"monospace"}}>{fmt(it.up)}</td>
                        <td style={{padding:"5px 10px",textAlign:"right",fontWeight:700,fontSize:13,fontFamily:"monospace"}}>{fmt(it.amt)}</td>
                        <td/>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div style={{padding:"10px 16px",borderTop:"2px solid #0a1628",fontSize:10.5,color:"#444",lineHeight:2}}>
                <div>&gt;&gt;위와 같이 견적합니다.</div>
                <div>&gt;&gt;제작 내용의 변동에 따라 상기 금액이 증감될 수 있음.</div>
                <div>&gt;&gt;부가가치세 별도.</div>
              </div>

              {/* 합계 — 공정합계·개발비·개당단가·총공급가액·부가세·합계 */}
              <div style={{margin:"0 16px 20px",background:"#0a1628",borderRadius:6,overflow:"hidden"}}>
                {/* 1행: 공정합계 · 개발비 · 개당단가 */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:"1px solid #1a2e4a"}}>
                  {[
                    {label:"공정 합계",  val:result.processTot,  note:"운송비·부가세 별도"},
                    {label:"개발비",     val:result.devTotal,    note:"목형 등"},
                    {label:"개당 단가",  val:result.perEA,       note:"공정합계÷수량", green:true, unit:"원"},
                  ].map(({label,val,note,green,unit},i)=>(
                    <div key={i} style={{padding:"10px 14px",borderRight:i<2?"1px solid #1a2e4a":"none",background:green?"#071a0e":"#0d1a2e"}}>
                      <div style={{fontSize:8,color:green?"#44cc77":"#8899bb",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{label}</div>
                      <div style={{fontSize:green?22:15,fontWeight:900,color:green?"#44ff88":"#e8f0ff",fontFamily:"'Courier New',monospace",letterSpacing:green?".02em":"0"}}>
                        {green ? `${val.toLocaleString()}원` : `₩${fmt(val)}`}
                      </div>
                      <div style={{fontSize:8,color:green?"#337744":"#334466",marginTop:2}}>{note}</div>
                    </div>
                  ))}
                </div>
                {/* 2행: 총공급가액 · 부가세 · 합계(VAT포함) */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
                  {[
                    {label:"총 공급가액", val:result.grandTotal,          bg:"#0d1a2e"},
                    {label:"부가세 (10%)",val:result.vat,                 bg:"#0d1a2e"},
                    {label:"합계 (VAT포함)", val:result.grandTotal+result.vat, bg:"#cc2200", accent:true},
                  ].map(({label,val,bg,accent},i)=>(
                    <div key={i} style={{padding:"10px 14px",borderRight:i<2?"1px solid #1a2e4a":"none",background:bg,borderTop:accent?"none":"none"}}>
                      <div style={{fontSize:8,color:accent?"#ffcccc":"#8899bb",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{label}</div>
                      <div style={{fontSize:15,fontWeight:900,color:accent?"#fff":"#e8f0ff",fontFamily:"'Courier New',monospace"}}>₩{fmt(val)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {s.showCompare && netSize && (
              <div style={{background:"white",boxShadow:"0 4px 24px rgba(0,0,0,.15)"}}>
                <QtyCompareTable s={s} netSize={netSize}/>
              </div>
            )}
          </div>
        ) : (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#4466aa",fontSize:14,flexDirection:"column",gap:12}}>
            <div style={{fontSize:32,opacity:.4}}>📦</div>
            <div>좌측 패널에 정보를 입력하면 견적서가 자동 생성됩니다.</div>
            <div style={{fontSize:11,color:"#334455",opacity:.6}}>박스 구조와 W·D·H를 입력하면 정확한 전개도 치수가 계산됩니다.</div>
          </div>
        )}
      </div>
    </div>
  );
}
import { useState, useMemo } from "react";

// ══════════════════════════════════════════════════════════════════
// 지종 DB  —  hidden:true 는 데이터 저장용, UI 드롭다운 미표시
// ══════════════════════════════════════════════════════════════════
const PAPERS = [
  // ── UI 표시 지종 ──────────────────────────────────────────────
  { id:"AB270",   label:"AB 270g",           group:"아트보드", priceHa4:231140  },
  { id:"AB300",   label:"AB 300g",           group:"아트보드", priceHa4:245000  },
  { id:"AB350",   label:"AB 350g",           group:"아트보드", priceHa4:518196  },
  { id:"AB400",   label:"AB 400g",           group:"아트보드", priceHa4:620000  },
  { id:"AB295L",  label:"ABL 295g (라이트)", group:"라이트",   priceHa4:300747  },
  { id:"ABL325",  label:"ABL 325g (라이트)", group:"라이트",   priceHa4:0       },
  { id:"ALK325",  label:"알리킹 325g",       group:"알리킹",   priceHa4:0       },
  { id:"ACPK300", label:"아코팩 300g",       group:"아코팩",   priceHa4:357500  },  // 복구
  { id:"ACPK350", label:"아코팩 350g",       group:"아코팩",   priceHa4:580000  },
  { id:"BT350",   label:"뷰티팩 350g",       group:"특수지",   priceHa4:465098  },
  { id:"MK350",   label:"밍크지 Bold 350g",  group:"특수지",   priceHa4:743200  },
  { id:"CCP350",  label:"CCP 350g",          group:"특수지",   priceHa4:547615  },
  { id:"SC350",   label:"SC 350g (스노우)",  group:"특수지",   priceHa4:0       },
  { id:"SC400",   label:"SC 400g (스노우)",  group:"특수지",   priceHa4:0       },  // ✓ 4×64 213,624
  // ── 데이터 저장용 (UI 숨김 — 단가 직접입력 시 참고) ──────────
  { id:"ABL270",  label:"ABL 270g (라이트)", group:"라이트",   priceHa4:319600, hidden:true },
  { id:"ALK295",  label:"알리킹 295g",       group:"알리킹",   priceHa4:0,      hidden:true },
  { id:"ALK215",  label:"알리킹 215g",       group:"알리킹",   priceHa4:0,      hidden:true },
  { id:"B300",    label:"B 300g",            group:"B계열",    priceHa4:0,      hidden:true },
  { id:"B350",    label:"B 350g",            group:"B계열",    priceHa4:0,      hidden:true },
  { id:"SW300",   label:"SW 300g",           group:"기타",     priceHa4:0,      hidden:true },
  { id:"IV350",   label:"IV 350g",           group:"기타",     priceHa4:0,      hidden:true },
];

// ══ 실제 견적서 확인 단가 테이블 ══════════════════════════════════
// [paperId][sheetId] = 원/R  (✓ 확인 / 주석없음 = 미확인)
const PRICE_TABLE = {
  // ── 아트보드 ─────────────────────────────────────────────────
  "AB270":   { "4x62":231140 },
  "AB300":   { "ha4":245000,  "4x64":323454 },
  "AB350":   { "ha4":518196,  "4x62":378612,  "guk2":292530 },  // ✓ 4×62 378,612 워터보틀30k확인
  "AB400":   { "4x62":427672, "4x64":427672,  "guk2":300888,  "46":455232 },
  // ── 라이트 계열 ──────────────────────────────────────────────
  "AB295L":  { "ha4":300747,  "ha2":319600,   "4x64":300747,  "4x62":318438, "guk2":208394 }, // ✓ 4x62 318,438 확인
  "ABL270":  { "ha4":319600,  "ha2":319600 },                                                   // ✓ 하2 319,600 확인
  "ABL325":  { "4x62":312032, "guk":243216, "46":351036 },   // ✓ 46전지 351,036 / 4×62 318,438?
  // ── 아코팩 ───────────────────────────────────────────────────
  "ACPK300": { "ha4":357500, "4x64":357500 },               // ✓ 아코팩300 4×64 357,500 확인 (2025-11)
  "ACPK350": { "ha4":580000, "4x62":580000, "4x64":517000 }, // ✓ 아코팩350 4×64 517,000 확인
  // ── 특수지 ───────────────────────────────────────────────────
  "BT350":   { "ha4":465098 },
  "MK350":   { "ha4":743200,  "4x64":743200 },
  "CCP350":  { "ha4":547615 },
  "SC350":   { "4x64":190395 },
  "SC400":   { "4x64":213624 },           // ✓ 4×64 213,624 확인
  // ── 알리킹 ───────────────────────────────────────────────────
  "ALK325":  { "4x62":253890, "ha2":311922,   "guk2":217217 },
  "ALK295":  { "4x62":255905 },
  "ALK215":  { "guk2":130975 },
  // ── B계열 ────────────────────────────────────────────────────
  "B300":    { "4x64":327082 },
  "B350":    { "4x62":425405 },
  // ── 기타 ─────────────────────────────────────────────────────
  "SW300":   { "4x64":268580 },
  "IV350":   { "4x62":272253 },
};

const HA4_AREA = 444 * 597; // 265,068 mm²

/**
 * 지대 단가 (원/R) — 룩업 우선, 미확인 시 면적비례 추정
 * @returns { price, confirmed }
 */
function getPaperPriceInfo(paperId, sheetId, mPriceVal) {
  if (mPriceVal && parseFloat(mPriceVal) > 0)
    return { price: parseFloat(mPriceVal), confirmed: true, manual: true };
  const paper = PAPERS.find(p => p.id === paperId);
  if (!paper) return { price: 0, confirmed: false, noData: true };
  // 룩업 테이블 확인
  const tablePrice = PRICE_TABLE[paperId]?.[sheetId];
  if (tablePrice) return { price: tablePrice, confirmed: true };
  // priceHa4 = ha4 기준 (확인된 경우)
  if (!sheetId || sheetId === "ha4") {
    if (paper.priceHa4 > 0) return { price: paper.priceHa4, confirmed: true };
    return { price: 0, confirmed: false, noData: true };
  }
  // 면적비례 추정 — priceHa4가 0이면 추정 불가
  const base = paper.priceHa4 || 0;
  if (base === 0) return { price: 0, confirmed: false, noData: true };
  const sheet = BASE_SHEETS.find(s => s.id === sheetId);
  if (!sheet) return { price: base, confirmed: false };
  return { price: Math.round(base * (sheet.w * sheet.h) / HA4_AREA), confirmed: false };
}
function getPaperPrice(paperId, sheetId, mPriceVal) {
  return getPaperPriceInfo(paperId, sheetId, mPriceVal).price;
}

// ══════════════════════════════════════════════════════════════════
// 원지 규격 DB
// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// 원지 규격 DB
// sheetsPerR: 판형별 연당 장수
//   소형 (하4/하2/4×62/4×64/국2): 1000장/연
//   대형 전지 (국전/46전지): 500장/연  ← 핵심 차이
// 검증: 냉동식품 46전지 3up 3000ea → R=2.6 ✓ (3000/3/500×1.30=2.6)
//       냉동식품 46전지 3up 5000ea → R=4.0 ✓ (5000/3/500×1.20=4.0)
// ══════════════════════════════════════════════════════════════════
const BASE_SHEETS = [
  { id:"ha4",  label:"하4   (444×597)",      w:444,  h:597,  sheetsPerR:1000 },
  { id:"ha2",  label:"하2   (888×597)",      w:888,  h:597,  sheetsPerR:1000 },
  { id:"4x62", label:"4×62  (788×545)",      w:788,  h:545,  sheetsPerR:1000 },
  { id:"4x64", label:"4×64  (545×394)",      w:545,  h:394,  sheetsPerR:1000 },
  { id:"guk2", label:"국2   (469×636)",      w:469,  h:636,  sheetsPerR:1000 },
  { id:"guk",  label:"국전  (636×939)",      w:636,  h:939,  sheetsPerR:500  },
  { id:"46",   label:"46전  (788×1091)",     w:788,  h:1091, sheetsPerR:500  },
];

// ══════════════════════════════════════════════════════════════════
// 박스 구조(Type) DB
// ══════════════════════════════════════════════════════════════════
const BOX_TYPES = [
  { id:"tuck_both",  label:"맞뚜껑 (상하 텍 클로저)"    },
  { id:"cross",      label:"십자조립 (크로스바텀)"       },
  { id:"glue_3side", label:"삼면접착"                    },
  { id:"gtype",      label:"G형 (톰슨조립)"             },
];

// ══════════════════════════════════════════════════════════════════
// 구조별 전개도 치수 계산
// 검증: 70×70×55 텍뚜껑+자동바닥 → 294.3×190.0mm (일러스트 실측 일치)
// ══════════════════════════════════════════════════════════════════
const BITE_MM = 30;   // 물림 여분 (상하좌우 각 30mm)
const MARGIN  = 1.10; // 손지 10%

function calcNetSize(W, D, H, boxType = "tuck_both") {
  // ── G형 (톰슨조립) — D/H 비율로 공식 자동 판별 ────────────────
  // D/H > 0.8 → A형 (거싯날개): garo=W+4D+14, sero=2H+3D+1
  //   검증: 315×126×113(D/H=0.90)→781×592 ✓  315×113×126(D/H=1.11)→833×605 ✓
  // D/H ≤ 0.8 → B형 (납작트레이): garo=W+2D+14, sero=H+2D, 회전없음
  //   검증: 180×120×85(D/H=0.71)→364×290 하4 2up ✓
  //         300×200×70(D/H=0.35)→454×340 4×62 1up ✓
  //         300×100×70(D/H=0.70)→454×240 하2 2up ✓
  //         270×370×70(D/H=0.19)→424×510 46전지 2up ✓
  if (boxType === "gtype") {
    const ratio = D / H;
    const isTypeA = ratio > 0.8;
    if (isTypeA) {
      return {
        netW: W + 4 * D + 14,
        netH: 2 * H + 3 * D + 1,
        topLid: 0, botFloor: 0, glueTab: 14,
        isGtype: true, gtypeNoRotate: false,
        gtypeVariant: "A", gtypeRatio: ratio,
      };
    } else {
      return {
        netW: W + 2 * D + 14,
        netH: H + 2 * D,
        topLid: 0, botFloor: 0, glueTab: 14,
        isGtype: true, gtypeNoRotate: true,
        gtypeVariant: "B", gtypeRatio: ratio,
      };
    }
  }
  // ── 기존 구조 ─────────────────────────────────────────────────
  const glueTab = 14.3;  // 접착날개 — 케이스별 10~23mm로 가변, 14.3mm이 평균 오차 최소
  const netW = 2 * (W + D) + glueTab;

  let topLid, botFloor;
  switch (boxType) {
    case "tuck_both":
      // D≤15(매우 얇은 박스): 뚜껑이 길어지는 특성
      // 검증: 의료기기 150×15×150 netH=270 → 2up ✓
      topLid   = D <= 15 ? D / 2 + 50 : D / 2 + 20;
      botFloor = D <= 15 ? D / 2 + 55 : D / 2 + 15;
      break;
    case "cross":
      // ✓ 실측 역산 확정: total_tuck = 7D/4 + 11
      //   70×70×151.5 → 303.33×285(실측) → topLid=66.75, netH=285 ✓
      //   80×20×49    → 211×95(실측)      → topLid=23,    netH=95  ✓
      topLid   = D * 7/8 + 5.5;
      botFloor = D * 7/8 + 5.5;
      break;
    case "glue_3side":
      // ✓ 실측 역산 확정 (2케이스):
      // topLid: D=40→15, D=74→17 (근사: 0.059D+12.65)
      // botFloor: D=40→30, D=74→52 (정확: 0.65D+4)
      topLid   = Math.round(D * 0.059 + 12.65);
      botFloor = D * 0.65 + 4;
      break;
    default:
      topLid   = D / 2 + 20;
      botFloor = D / 2 + 15;
  }
  const netH = H + topLid + botFloor;
  return { netW, netH, topLid, botFloor, glueTab };
}

// ══════════════════════════════════════════════════════════════════
// [V6 핵심변경 2] 인터로킹 포함 판걸이 최적화
//
// 4가지 경우를 모두 계산 → 최대 up 선택:
//
//  ① 노말           : cols = ⌊printW/netW⌋, rows = ⌊printH/netH⌋
//  ② 회전           : cols = ⌊printW/netH⌋, rows = ⌊printH/netW⌋
//  ③ 노말+인터로킹  : 뚜껑·바닥 날개 맞물림 → pairH = 2×netH − min(topLid,botFloor)
//  ④ 회전+인터로킹  : 접착날개 맞물림      → pairW = 2×netW − glueTab
//
// 검증: 70×70×55, 하4(444×597)
//   ④ cols=⌊429/190⌋=2, pairW=574.3, pairs=⌊582/574.3⌋=1 → 2×2=4up ✓
// ══════════════════════════════════════════════════════════════════
function getLayoutInfo(netW, netH, sheetW, sheetH, glueTab = 14.3, topLid = 0, botFloor = 0, gtypeNoRotate = false) {
  const printW = sheetW - BITE_MM;
  const printH = sheetH - BITE_MM;

  const candidates = [];

  // ① 노말
  {
    const c = Math.floor(printW / netW);
    const r = Math.floor(printH / netH);
    if (c > 0 && r > 0)
      candidates.push({ cols:c, rows:r, up:c*r, rotated:false, interlocked:false, boxW:netW, boxH:netH });
  }

  // ② 회전 90° — G형 조립트레이(gtype_b)는 스킵 (교차형 전개도는 회전 불가)
  if (!gtypeNoRotate) {
    const c = Math.floor(printW / netH);
    const r = Math.floor(printH / netW);
    if (c > 0 && r > 0)
      candidates.push({ cols:c, rows:r, up:c*r, rotated:true, interlocked:false, boxW:netH, boxH:netW });
  }

  // ③ 노말 + 인터로킹 — pairs ≥ 1부터 허용 (실제 현장에서 1쌍 인터로킹도 사용)
  // 단, 노말보다 up수가 높을 때만 최종 선택됨
  if (topLid > 0 && botFloor > 0) {
    const c       = Math.floor(printW / netW);
    const overlap = Math.min(topLid, botFloor);
    const pairH   = 2 * netH - overlap;
    const pairs   = Math.floor((printH - netH) / pairH);
    if (c > 0 && pairs >= 1)
      candidates.push({ cols:c, rows:pairs*2, up:c*pairs*2, rotated:false, interlocked:true,
                        boxW:netW, boxH:netH, pairH, overlapInfo:`↕ ${overlap.toFixed(1)}mm 맞물림` });
  }

  // ④ 회전 + 인터로킹은 현장에서 사용하지 않음 (견적서 비고 대조 결과)
  // 제거됨

  // 최대 up 선택
  candidates.sort((a, b) => b.up - a.up);
  const best = candidates[0];

  if (!best) {
    return { cols:0, rows:0, up:0, rotated:false, interlocked:false,
             boxes:[], lossPct:100, printW, printH, candidates,
             alt:{ up:0, rotated:false, interlocked:false } };
  }

  // 배치 좌표 생성
  const boxes = [];
  const _pairH = best.pairH || (2 * netH - Math.min(topLid, botFloor));

  for (let r = 0; r < best.rows; r++) {
    for (let c = 0; c < best.cols; c++) {
      const isFlipped = best.interlocked && (r % 2 === 1);

      let yCoord;
      if (best.interlocked) {
        const pairIdx = Math.floor(r / 2);
        yCoord = BITE_MM + pairIdx * _pairH + (isFlipped ? netH : 0);
      } else {
        yCoord = BITE_MM + r * (best.rotated ? netW : netH);
      }

      boxes.push({
        x: BITE_MM + c * best.boxW,
        y: yCoord,
        w: best.boxW, h: best.boxH,
        flipped: isFlipped,
        idx: r * best.cols + c,
      });
    }
  }

  const usedArea  = best.up * netW * netH;
  const totalArea = sheetW * sheetH;
  const lossPct   = Math.round((1 - usedArea / totalArea) * 100);

  return { ...best, boxes, lossPct, printW, printH, candidates,
           alt: candidates[1] || { up:0, rotated:false, interlocked:false } };
}

function calcUpOnSheet(netW, netH, sw, sh, glueTab, topLid, botFloor, gtypeNoRotate = false) {
  return getLayoutInfo(netW, netH, sw, sh, glueTab, topLid, botFloor, gtypeNoRotate).up;
}

// ══════════════════════════════════════════════════════════════════
// [V9] R수 계산: 매수/up 기반 — 실측 견적서 전수 역산 확정
//
// R = floor 또는 round(qty/up/1000 × 손지계수 / 0.025) × 0.025
//   + 최솟값 0.25R
//
// 규칙:
//   base(=qty/up/1000) < 1 → floor  (소량: 초과 주문 없이 딱 맞게)
//   base >= 1            → round  (대량: 손지 포함 반올림)
//
// 손지계수:
//   1도 / UV / 3도:  1.00  (색 맞춤 손지 미미)
//   2도:             1.10  (≤2만ea), 1.08 (>2만ea)
//   4도+:            1.10  (≤2만ea), 1.08 (>2만ea)
//
// 최솟값: 0.25R (250장 미만은 주문 의미 없음)
//
// 검증:
//   ABL295 1000ea/4up 별1  → 0.25×1.0  floor=0.25  min→0.25  ✓
//   ABL295 4000ea/6up 별1  → 0.667×1.0 floor=0.65  min→0.65  ✓
//   ABL295 500ea/2up 별1먹 → 0.25×1.10 floor=0.275 min→0.275 ✓
//   AB270 10000ea/4up 4도  → 2.5×1.10  round=2.75  (실제2.8, 허용)
//   AB270 10000ea/4up 별1  → 2.5×1.0   round=2.5   ✓
//   CCP350 40000ea/4up 별1먹→10×1.08   round=10.8  ✓
// ══════════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════
// [V7.3] R수 계산 — 부동소수점 버그 수정 + 손지계수 보정
//
// ⚠ JS 부동소수점: 0.575/0.025 = 22.9999... → floor=22 (버그!)
//   수정: raw*40 정수 연산으로 처리 (1/0.025=40)
//
// 손지계수 (소형 1000장/연):
//   ≤3000ea: 1.15 / ≤20000ea: 1.10 / >20000ea: 1.047
//   ✓ AB350 4×62 2up 30000ea → base=15 × 1.047 → round(628.2)×0.025 = 15.7R
//
// 손지계수 (대형 500장/연):
//   ≤3000: 1.30 / ≤10000: 1.20 / >10000: 1.10
// ══════════════════════════════════════════════════════════════════
function calcR(up, qty, totalColors, hasUv, sheetsPerR = 1000) {
  if (!up || up === 0) return 0;
  const base = qty / up / sheetsPerR;

  let factor;
  if (sheetsPerR <= 500) {
    if      (qty <= 3000)  factor = 1.30;
    else if (qty <= 10000) factor = 1.20;
    else                   factor = 1.10;
  } else {
    factor = 1.00;
    if (!hasUv) {
      if (totalColors === 2 || totalColors >= 4) {
        if      (qty <= 3000)  factor = 1.15;
        else if (qty <= 20000) factor = 1.10;
        else                   factor = 1.047; // ✓ 30000ea→15.7R
      }
    }
  }

  const raw = base * factor;

  // 부동소수점 수정: raw*40 정수연산 (0.025 = 1/40)
  // Math.round(N*1000)/1000 로 3자리 정밀도 확보 후 floor/round
  const units = Math.round(raw * 40000) / 1000; // units = raw/0.025 (float-safe)
  const r = base < 1
    ? Math.floor(units) / 40          // 소량: floor (반올림 없이)
    : Math.round(units) / 40;         // 대량: round

  return Math.max(0.25, r || 0.25);
}

// [V9] 최적 원지: 판형 우선순위 반영
// 실무 우선순위: 4×64 → 국2 → 4×62 → 국전 → 46전 → 하2 → 주문생산 → 하4(최하위)
// 하4는 다른 판형에서 up=0이거나 수율이 너무 낮을 때만 사용
const SHEET_PRIORITY = { "4x64":1, "guk2":2, "4x62":3, "guk":4, "46":5, "ha2":6, "ha4":99 };

function findBestSheet(netSize, qty, sheetIdHint, paperId, mPriceVal, totalColors, hasUv) {
  if (!netSize || !qty) return null;
  const { netW, netH, glueTab, topLid, botFloor, gtypeNoRotate } = netSize;
  const candidates = (sheetIdHint && sheetIdHint !== "auto")
    ? BASE_SHEETS.filter(s => s.id === sheetIdHint)
    : BASE_SHEETS;

  let best = null;
  for (const sh of candidates) {
    const up = calcUpOnSheet(netW, netH, sh.w, sh.h, glueTab, topLid, botFloor, gtypeNoRotate || false);
    if (up === 0) continue;

    // 수율 계산 — 90% 초과 판형은 auto 추천에서 제외 (비현실적 배치)
    const utilPct = (up * netW * netH) / (sh.w * sh.h) * 100;
    if (sheetIdHint === "auto" && utilPct > 90) continue;

    const spr   = sh.sheetsPerR || 1000;
    const R     = calcR(up, qty, totalColors || 0, hasUv || false, spr);
    const price = getPaperPrice(paperId, sh.id, mPriceVal);
    const paperCost = R * price;

    // 공정비 추정 (랭킹용): 공정 base는 항상 1000장/연
    // up이 많을수록 공정 lots 적어져 총비용 유리 → up 보정 포함한 총비용으로 랭킹
    const processBase1000 = qty / up / 1000;
    const estimatedProcessPerR = 150000; // 코팅+톰슨+인쇄 합산 추정 (원/R)
    const processCostEst = processBase1000 * estimatedProcessPerR;
    const totalCostEst = paperCost + processCostEst;

    const priority = SHEET_PRIORITY[sh.id] || 5;
    const priorityAdj = 1 + (priority - 1) * 0.01; // 판형 우선순위 보정 (약화)
    const rankCost = totalCostEst * priorityAdj;

    if (!best || rankCost < best.rankCost)
      best = { ...sh, up, R, cost: paperCost, rankCost, price, sheetsPerR: spr, utilPct: Math.round(utilPct) };
  }
  return best;
}

// ══════════════════════════════════════════════════════════════════
// 공정 옵션 DB
// [V9] 인쇄: 별색도수/먹/UV 직접 입력 방식
// ══════════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════
// [V9 최종] 인쇄/코팅/톰슨 수량 로직 — 실측 견적서 역산 확정
//
// ▶ base_print_R = qty / up / 1000
//
// base ≤ 1 (소량): 1식 고정금액
//   별색 1~2도: 40,000원 고정  (이미지4,5 별1먹1 = 40,000)
//   별색 3도+:  45,000원 고정  (이미지6 별2먹1  = 45,000)
//   UV:         qty 티어 기준 (≤3000→200k, ≤5000→250k, ≤10000→350k)
//   코팅: fc.min  / 톰슨: thom.min
//
// base > 1 (대량): processR = round(base×2)/2 (0.5R 단위)
//   별색: processR × 45,000원/R
//   원색4도+: max(도수, round(qty/1000)) × 13,000원
//   코팅: processR × fc.rpr  / 톰슨: processR × thom.rpr
// ══════════════════════════════════════════════════════════════════

// 무광·유광 단가 동일 / IR < 무광·유광
const COAT_OPTS = [
  { id:"none",  label:"없음",       rpr_large:0,      rpr_small:0,     min:0      },
  { id:"matte", label:"무광코팅",   rpr_large:126000, rpr_small:62400, min:55000  }, // ✓ 무광=유광 동일단가
  { id:"gloss", label:"유광코팅",   rpr_large:126000, rpr_small:62400, min:55000  }, // ✓ 무광=유광 동일단가
  { id:"hg",    label:"글로스코팅", rpr_large:140000, rpr_small:70000, min:65000  },
  { id:"ir",    label:"IR코팅",     rpr_large:50000,  rpr_small:30000, min:30000  }, // ✓ IR < 무광·유광
  { id:"epoxy", label:"에폭시",     rpr_large:120000, rpr_small:95000, min:95000  },
];
const GLUE_OPTS = [
  { id:"none",   label:"없음",          ea:0  },
  { id:"dan",    label:"단면",          ea:15 }, // ✓ 일반 단면 15원/ea
  { id:"dan_20", label:"단면(특수지)",  ea:20 }, // ✓ 아코팩 등 특수지 20원/ea
  { id:"sam",    label:"삼면",          ea:20 }, // ✓ 삼면 20원/ea
  { id:"pull",   label:"풀발이",        ea:22 },
  { id:"pp",     label:"PP접착",        ea:70 }, // ✓ 냉동식품 PP접착 70원/ea 확인
];
// rpr_large: 대형 전지 (46전지·국전) / rpr_small: 소형 (하4~국2)
// ✓ 소형 50,000/R — AB400g 4×62 2000ea: 2R×50k=100k 확인
// ✓ 대형 80,000/R — 냉동식품 46전지 3up: 1.1R×80k=88k 확인
const THOMSON_OPTS = [
  { id:"s",     label:"단순형",              rpr_large:60000,  rpr_small:45000,  min:45000 },
  { id:"n",     label:"일반형",              rpr_large:80000,  rpr_small:40000,  min:45000 }, // ✓ 소형 15R×40,000=600,000 워터보틀확인
  { id:"c",     label:"복잡형",              rpr_large:80000,  rpr_small:60000,  min:45000 },
  { id:"sp",    label:"측면 풀발이 12단",    rpr_large:80000,  rpr_small:80000,  min:80000 },
  { id:"g_std", label:"G형 표준 (45,000/R)", rpr_large:45000,  rpr_small:45000,  min:45000 },
];

// ══════════════════════════════════════════════════════════════════
// [V9] computeForQty — 별색 N도 자유입력 기반
// ══════════════════════════════════════════════════════════════════
function computeForQty(s, qty, si, netSize) {
  if (!si || !netSize) return null;
  const paper = PAPERS.find(p => p.id === s.paperId) || PAPERS[2];
  const fc    = COAT_OPTS.find(p => p.id === s.fcId)    || COAT_OPTS[0];
  const bc    = COAT_OPTS.find(p => p.id === s.bcId)    || COAT_OPTS[0];
  const glue  = GLUE_OPTS.find(p => p.id === s.glueId)  || GLUE_OPTS[0];
  const thom  = THOMSON_OPTS.find(p => p.id === s.thomId)|| THOMSON_OPTS[0];

  // [V9] 인쇄 도수 파싱 (R 계산 전에 먼저 선언)
  const fpSp  = parseInt(s.fpSp)||0;
  const fpBk  = !!s.fpBk;
  const fpUv  = !!s.fpUv;
  const bpSp  = parseInt(s.bpSp)||0;
  const bpBk  = !!s.bpBk;
  const bpUv  = !!s.bpUv;

  const fColors = fpSp + (fpBk?1:0) + (fpUv?1:0);
  const bColors = bpSp + (bpBk?1:0) + (bpUv?1:0);
  const totalColors = fColors + bColors;
  const hasUv = fpUv || bpUv;

  // ✓ UV인쇄는 소부(제판) 판수에 포함하지 않음 (별도 UV 인쇄기 사용)
  // 소부 = 별색도수 + 먹 (UV 제외)
  const fColors_sobu = fpSp + (fpBk?1:0);
  const bColors_sobu = bpSp + (bpBk?1:0);
  const totalColors_sobu = fColors_sobu + bColors_sobu;

  // [V9] 지대 R수 (손지 포함, 매수/up 기반)
  const spr = si.sheetsPerR || 1000;  // 판형별 연당 장수
  const R = s.mR ? (parseFloat(s.mRV) || 0)
                 : calcR(si.up, qty, totalColors, hasUv, spr);

  // 지대 단가
  const priceInfo      = s.mPrice
    ? { price: parseFloat(s.mPriceV)||0, confirmed: true }
    : getPaperPriceInfo(s.paperId, si.id);
  const sheetPricePerR = priceInfo.price;
  const paperAmt       = Math.round(R * sheetPricePerR);

  // ─── [V7.3] 공정 R 계산 ──────────────────────────────────────────
  // processR = round(processBase×2)/2 (0.5R 단위, 손지계수 미적용)
  // ✓ 워터보틀 30,000ea 2up → processBase=15 → processR=15R
  // ✓ 냉동식품 46전지 3up 3000ea → processBase=3000/3/1000=1.0 → processR=1.0R
  const processBase = si.up > 0 ? qty / si.up / 1000 : 0;
  const isFixed   = processBase < 1;
  const processR  = isFixed ? 1 : Math.round(processBase * 2) / 2; // 0.5R 단위
  // 인쇄 손지(>20000ea용) — 인쇄 lots 계산에만 사용
  const hasColorProcess = totalColors >= 4 || totalColors === 2;

  // ─── 인쇄비 ───────────────────────────────────────────────────
  function uvAmt() {
    if (qty <= 3000)  return 200000;
    if (qty <= 5000)  return 250000;
    if (qty <= 10000) return 350000;
    return Math.round(qty / 1000 * 35000);
  }
  // 별색 인쇄비
  function frontPrintAmt(sp, bk, uv) {
    const tot = sp + (bk?1:0);
    if (uv) return uvAmt();
    if (!tot) return 0;
    if (isFixed) return tot >= 3 ? 45000 : 40000;
    return Math.round(processR * 45000);
  }
  // 원색/복잡인쇄 비용
  // ✓ 1000ea 4도=52k(max(4,1)×13k) / 10000ea 4도=130k(max(4,10)×13k)
  // ✓ 60000ea 별6+먹1: lots=max(7, round(60×1.08))=65 → 65×13k=845k
  function calcFpAmt() {
    if (!fHasInk) return 0;
    // 별색4도 이상(먹 포함여부 무관) → 원색방식
    const isColorPrint = fpSp >= 4 && !fpUv;
    if (isColorPrint) {
      const frontDo = fpSp + (fpBk?1:0);
      const baseLots = Math.max(1, Math.round(qty / 1000));
      // qty>20000이면 손지계수 적용 (실측: 60000ea 별6+먹1 → ×1.08=65)
      const lotsWithLoss = qty > 20000
        ? Math.max(1, Math.round(qty / 1000 * 1.08))
        : baseLots;
      return Math.max(frontDo, lotsWithLoss) * 13000;
    }
    return frontPrintAmt(fpSp, fpBk, fpUv);
  }
  function calcBpAmt() {
    if (!bHasInk) return 0;
    // calcFpAmt와 동일 로직 적용 (먹 포함 무관, 별색4도+ → 원색방식)
    const isColorPrint = bpSp >= 4 && !bpUv;
    if (isColorPrint) {
      const backDo = bpSp + (bpBk?1:0);
      const baseLots = Math.max(1, Math.round(qty / 1000));
      const lotsWithLoss = qty > 20000
        ? Math.max(1, Math.round(qty / 1000 * 1.08))
        : baseLots;
      return Math.max(backDo, lotsWithLoss) * 13000;
    }
    return frontPrintAmt(bpSp, bpBk, bpUv);
  }

  const fHasInk = fpSp > 0 || fpBk || fpUv;
  const bHasInk = bpSp > 0 || bpBk || bpUv;
  const fpAmt   = calcFpAmt();
  const bpAmt   = calcBpAmt();

  // ─── 코팅비: 판형 크기별 단가 분기 ────────────────────────────
  // 대형(46전지·국전, 500장/연): rpr_large / 소형: rpr_small
  const isLargeSheet = (si.sheetsPerR || 1000) <= 500;
  const fcRpr = isLargeSheet ? fc.rpr_large : fc.rpr_small;
  const bcRpr = isLargeSheet ? bc.rpr_large : bc.rpr_small;

  const fcAmt  = fc.id==="none" ? 0
    : isFixed ? fc.min
    : Math.round(processR * fcRpr);
  const bcAmt  = bc.id==="none" ? 0
    : isFixed ? bc.min
    : Math.round(processR * bcRpr);

  const puvAmt = s.puv ? Math.round(processR * 90000 * (parseInt(s.puvS)||1)) : 0;
  const embAmt = s.emb ? Math.round(processR * (parseInt(s.embRpr)||100000)) : 0;

  // ─── 소부비 ────────────────────────────────────────────────────
  const sobooUnit   = parseInt(s.sobooU) || 11000;
  const sobooAmt    = totalColors_sobu * sobooUnit;  // UV 제외 도수 기준

  const thomRpr = isLargeSheet ? thom.rpr_large : thom.rpr_small;
  // ─── 톰슨: isFixed→min고정 / 대량→processR×rpr ─────────────────
  const thomAmt = isFixed ? thom.min : Math.round(processR * thomRpr);

  // ─── 접착비: 최소 40,000원 보장 ────────────────────────────────
  // ✓ 소량(500ea×15=7,500)도 실제 견적서에서 1식 40,000원 적용 확인
  const glueRaw = qty * glue.ea;
  const glueAmt = glue.id === "none" ? 0 : Math.max(glueRaw, 40000);

  // ─── [V7.3] 관리비: 실측 기반 티어 ────────────────────────────
  // ✓ ≤5,000: 100k / ≤10,000: 130k / ≤50,000: 200k / ≤100,000: 300k / 초과: 350k
  // 검증: 8,000ea→130k ✓ / 40,000ea→200k ✓ / 60,000ea→300k ✓
  function calcAdminAmt() {
    if (s.adminManual) return parseInt(s.admin) || 100000;
    if (qty <=   5000) return 100000;
    if (qty <=  10000) return 130000;
    if (qty <=  50000) return 200000;
    if (qty <= 100000) return 300000;
    return 350000;
  }
  const adminAmt = calcAdminAmt();

  const processTot = paperAmt + sobooAmt + fpAmt + bpAmt + fcAmt + bcAmt + puvAmt + embAmt + thomAmt + glueAmt + adminAmt;
  const dieAmt     = s.newDie ? (parseInt(s.dieQ)||1)*(parseInt(s.dieP)||180000) : 0;
  const embDevAmt  = s.emb ? (parseInt(s.embDevP)||90000) : 0;
  const embFilmAmt = s.emb ? (parseInt(s.embFilmP)||28000) : 0;
  const filmAmt    = parseInt(s.filmC) || 0;
  const devTotal   = dieAmt + embDevAmt + embFilmAmt + filmAmt;
  const grandTotal = processTot + devTotal;
  const perEA      = qty > 0 ? Math.floor(processTot / qty) : 0; // 개당단가 = 공정합계÷수량 (개발비·부가세 별도)

  // 인쇄 규격 문자열 생성
  const fSpec = [fpUv?"UV인쇄":"", fpSp>0?`별색 ${fpSp}도`:"", fpBk?"먹 1도":""].filter(Boolean).join("+") || "";
  const bSpec = [bpUv?"UV인쇄":"", bpSp>0?`별색 ${bpSp}도`:"", bpBk?"먹 1도":""].filter(Boolean).join("+") || "";
  const sheetName = si.label.split("(")[1]?.replace(")","") || si.label;
  // 소부 규격: UV제외 도수 표시
  const sobooSpec = netSize?.isGtype
    ? `${totalColors_sobu}도 / ${Math.round(netSize.netW)}×${Math.round(netSize.netH)}`
    : `${totalColors_sobu}도 / ${sheetName}`;

  // ─── 인쇄 라인 수량 표시 결정 ──────────────────────────────────
  // 원색/복잡(별색4도 이상, UV없음): qty=천매단위, 단가=13,000
  //   ≤20,000ea: max(도수, round(qty/1000)) × 13,000
  //   >20,000ea: max(도수, round(qty/1000×손지)) × 13,000  ✓ 60,000ea 별6먹1→65 ✓
  // 별색(3도 이하, 또는 UV): isFixed→1식, 대량→processR×45,000
  const fIsColor = fpSp >= 4 && !fpUv;  // 먹 무관하게 별색4도+ → 원색방식
  const bIsColor = bpSp >= 4 && !bpUv;

  function colorPrintLots(sp, bk) {
    const frontDo = sp + (bk?1:0);
    const baseLots = Math.max(1, Math.round(qty / 1000));
    const lotsWithLoss = qty > 20000
      ? Math.max(1, Math.round(qty / 1000 * 1.08))
      : baseLots;
    return Math.max(frontDo, lotsWithLoss);
  }

  const fPrintQty = isFixed ? 1
    : fIsColor ? colorPrintLots(fpSp, fpBk)
    : processR;
  const fPrintUnit = isFixed ? "식" : fIsColor ? "천매" : "R";
  const fPrintUp   = isFixed ? fpAmt : fIsColor ? 13000 : 45000;

  const bPrintQty = isFixed ? 1
    : bIsColor ? colorPrintLots(bpSp, bpBk)
    : processR;
  const bPrintUnit = isFixed ? "식" : bIsColor ? "천매" : "R";
  const bPrintUp   = isFixed ? bpAmt : bIsColor ? 13000 : 45000;

  const lines = [
    { name:"지대",
      spec:`${paper.label} · ${si.label.split("(")[0].trim()}`,
      qty:R, unit:"R", up:sheetPricePerR, amt:paperAmt,
      note:`${si.up}up${priceInfo.confirmed?"":" ⚠"}` },
    totalColors_sobu>0 && { name:"소부",
      spec: sobooSpec,
      qty:totalColors_sobu, unit:"도", up:sobooUnit, amt:sobooAmt, fixed:true },
    fHasInk && { name:"인쇄(전면)", spec:fSpec,
      qty: fPrintQty, unit: fPrintUnit, up: fPrintUp, amt: fpAmt },
    bHasInk && { name:"인쇄(후면)", spec:bSpec,
      qty: bPrintQty, unit: bPrintUnit, up: bPrintUp, amt: bpAmt },
    // 코팅: 전후면 동일 종류이면 양면 합산 표시 (실제 견적서 형식)
    // 양면 qty = processR×2, 단가 = rpr (각 면당), 합계 = fcAmt+bcAmt
    ...(fc.id!=="none" || bc.id!=="none" ? (() => {
      const sameCoat = fc.id !== "none" && bc.id !== "none" && fc.id === bc.id;
      if (sameCoat) {
        // 양면 합산 라인
        return [{ name:"코팅", spec:`${fc.label} (양면)`,
          qty: isFixed ? 2 : fmtR(processR * 2),
          unit: isFixed ? "식" : "R",
          up: isFixed ? fc.min : fc.rpr,
          amt: fcAmt + bcAmt }];
      }
      return [
        fc.id!=="none" && { name:"코팅(전면)", spec:fc.label,
          qty: isFixed ? 1 : fmtR(processR),
          unit: isFixed ? "식" : "R",
          up: isFixed ? fc.min : fc.rpr,
          amt: fcAmt },
        bc.id!=="none" && { name:"코팅(후면)", spec:bc.label,
          qty: isFixed ? 1 : fmtR(processR),
          unit: isFixed ? "식" : "R",
          up: isFixed ? bc.min : bc.rpr,
          amt: bcAmt },
      ].filter(Boolean);
    })() : []),
    s.puv && { name:"부분UV", spec:`${s.puvS||1}면`,
      qty: fmtR(processR), unit:"R", up:90000, amt:puvAmt },
    s.emb && { name:"형압(디보싱)", spec:"디보싱",
      qty: fmtR(processR), unit:"R", up:parseInt(s.embRpr)||100000, amt:embAmt },
    { name: netSize?.isGtype ? "툴슨(G형)" : "톰슨",
      spec:thom.label,
      qty: isFixed ? 1 : fmtR(processR),
      unit: isFixed ? "식" : "R",
      up: isFixed ? thom.min : thomRpr,
      amt: thomAmt },
    glue.id!=="none" && { name:"접착", spec:glue.label, qty:qty, unit:"EA", up:glue.ea, amt:glueAmt },
    { name:"일반관리비", spec: s.adminManual ? "(직접입력)" : "자동",
      qty:"", unit:"", up:"", amt:adminAmt, fixed:true },
  ].filter(Boolean);

  const devLines = [
    s.newDie     && { name:"목형",          qty:parseInt(s.dieQ)||1, up:parseInt(s.dieP)||180000, amt:dieAmt },
    s.emb        && { name:"형압 개발비",   qty:1, up:parseInt(s.embDevP)||90000, amt:embDevAmt },
    s.emb        && { name:"형압 필름",     qty:1, up:parseInt(s.embFilmP)||28000, amt:embFilmAmt },
    filmAmt>0    && { name:"부분코팅 필름", qty:1, up:filmAmt, amt:filmAmt },
  ].filter(Boolean);

  return { R, lines, devLines, processTot, devTotal, grandTotal, perEA,
           vat: Math.round(grandTotal * 0.1),
           sheetPricePerR, priceConfirmed: priceInfo.confirmed,
           showIRWarning: s.fcId==="ir" || s.bcId==="ir",
           fColors, bColors, totalColors };
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
    case "glue_3side":
      return { type:"glue3", topLid: Math.round(D*0.059+12.65), // ✓ D=40→15, D=74→17
               dust: D/2 - 1,               // ✓ D=40→19, D=74→36
               botLong: D * 0.65 + 4,       // ✓
               botShort: D / 2,             // ✓ D=40→20, D=74→37
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
const fmtMM = n => n ? n.toFixed(1) : "-";
const today = () => { const d=new Date(); return `${d.getFullYear()}년 ${String(d.getMonth()+1).padStart(2,"0")}월 ${String(d.getDate()).padStart(2,"0")}일`; };

// ══════════════════════════════════════════════════════════════════
// 판걸이 배치 시각화 — 전개도 구조 오버레이 포함
// ══════════════════════════════════════════════════════════════════
function LayoutViz({ si, netSize, W, D, H, boxType }) {
  if (!si || !netSize) return null;
  const layout = getLayoutInfo(netSize.netW, netSize.netH, si.w, si.h,
                               netSize.glueTab, netSize.topLid, netSize.botFloor, netSize.gtypeNoRotate||false);
  if (layout.up === 0) return null;

  const PAD_SVG = 32;
  const MAX_W   = 380;
  const MAX_H   = 300;
  const scale   = Math.min((MAX_W - PAD_SVG*2) / si.w, (MAX_H - PAD_SVG*2) / si.h);
  const svgW    = si.w * scale + PAD_SVG * 2;
  const svgH    = si.h * scale + PAD_SVG * 2;

  const COLORS  = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#06b6d4","#ec4899"];
  const biteS   = BITE_MM * scale;

  const usedArea  = layout.up * netSize.netW * netSize.netH;
  const totalArea = si.w * si.h;
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
        <rect x={PAD_SVG} y={PAD_SVG} width={si.w*scale} height={si.h*scale}
          fill="#0d2035" stroke="#2a4060" strokeWidth={1.5} rx={2}/>
        <rect x={PAD_SVG} y={PAD_SVG} width={si.w*scale} height={si.h*scale}
          fill="url(#lossHatch)" rx={2}/>

        {/* 물림 — 상단 */}
        <rect x={PAD_SVG} y={PAD_SVG} width={si.w*scale} height={biteS}
          fill="#ff000018"/>
        <rect x={PAD_SVG} y={PAD_SVG} width={si.w*scale} height={biteS}
          fill="url(#biteHatch)"/>
        <line x1={PAD_SVG} y1={PAD_SVG+biteS} x2={PAD_SVG+si.w*scale} y2={PAD_SVG+biteS}
          stroke="#ff4444" strokeWidth={1} strokeDasharray="4 3" opacity={.8}/>
        <text x={PAD_SVG+si.w*scale/2} y={PAD_SVG+biteS/2}
          textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="#ff6666" fontWeight="700">
          ← 물림 {BITE_MM}mm →
        </text>

        {/* 물림 — 좌측 */}
        <rect x={PAD_SVG} y={PAD_SVG+biteS} width={biteS} height={si.h*scale-biteS}
          fill="#ff000012"/>
        <rect x={PAD_SVG} y={PAD_SVG+biteS} width={biteS} height={si.h*scale-biteS}
          fill="url(#biteHatch)"/>
        <line x1={PAD_SVG+biteS} y1={PAD_SVG} x2={PAD_SVG+biteS} y2={PAD_SVG+si.h*scale}
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
        <text x={PAD_SVG+si.w*scale/2} y={PAD_SVG-14}
          textAnchor="middle" fontSize={9} fill="#8899bb">{si.w} mm</text>
        <text x={PAD_SVG+si.w*scale+16} y={PAD_SVG+si.h*scale/2}
          textAnchor="middle" fontSize={9} fill="#8899bb"
          transform={`rotate(90,${PAD_SVG+si.w*scale+16},${PAD_SVG+si.h*scale/2})`}>{si.h} mm</text>

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
function SheetCompare({ netSize, qty, paperId, sheetId, mPriceVal, totalColors, hasUv }) {
  if (!netSize || !qty) return null;
  const bestSi = findBestSheet(netSize, qty, "auto", paperId, mPriceVal, totalColors, hasUv);

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
          {BASE_SHEETS.map((sh, i) => {
            const layout = getLayoutInfo(netSize.netW, netSize.netH, sh.w, sh.h,
                                         netSize.glueTab, netSize.topLid, netSize.botFloor, netSize.gtypeNoRotate||false);
            if (layout.up === 0) return null;
            const utilPct = Math.round((layout.up * netSize.netW * netSize.netH) / (sh.w * sh.h) * 100);
            const overUtil = utilPct > 90;
            const R     = calcR(layout.up, qty, totalColors, hasUv, sh.sheetsPerR||1000);
            const price = getPaperPrice(paperId, sh.id, mPriceVal);
            const cost  = Math.round(R * price);
            const isBest = bestSi && sh.id === bestSi.id;
            const spr   = sh.sheetsPerR || 1000;
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
        ⛔ 수율 90% 초과 판형은 자동 추천 제외 (물리적 여유 부족) ｜ 🟠 연단위 500장 = 46전지·국전 대형전지
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
    const fpSp=(parseInt(s.fpSp)||0), bpSp=(parseInt(s.bpSp)||0);
    // UV는 R 손지계수에 영향 없음 → UV 제외한 도수로 calcR 호출 (소부와 동일 기준)
    const tColors = fpSp+(s.fpBk?1:0)+bpSp+(s.bpBk?1:0);
    const hUv = !!(s.fpUv||s.bpUv);
    const si = findBestSheet(netSize, q, s.sheetId==="auto"?"auto":s.sheetId, s.paperId, s.mPrice?s.mPriceV:"", tColors, hUv);
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
      {cell(item.qty?(typeof item.qty==="number"?fmtR(item.qty):item.qty):"","right","#333")}
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
    customer:"코리팩", product:"에스앤브이 패키지", date:today(),
    bW:"40", bD:"40", bH:"133", boxType:"tuck_both",
    paperId:"AB350", sheetId:"auto",
    mR:false, mRV:"",
    mPrice:false, mPriceV:"",
    qty:"5000",
    fpSp:"1", fpBk:true,  fpUv:false,
    bpSp:"0", bpBk:false, bpUv:false,
    sobooU:"11000",
    fcId:"ir", bcId:"none",
    puv:false, puvS:"1",
    thomId:"n", glueId:"dan",
    admin:"100000", adminManual:false,
    newDie:true, dieQ:"1", dieP:"180000", filmC:"",
    emb:false, embRpr:"100000", embDevP:"90000", embFilmP:"28000",
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

  const netSize = useMemo(()=>
    (W&&D&&H) ? calcNetSize(W, D, H, s.boxType) : null,
  [W, D, H, s.boxType]);

  // 인쇄 도수 (sheetInfo 계산용)
  const fpSpN = parseInt(s.fpSp)||0;
  const bpSpN = parseInt(s.bpSp)||0;
  // UV는 R 손지계수에 영향 없음 → UV 제외한 도수로 R 계산 (소부 기준과 동일)
  const totalColorsForR = fpSpN+(s.fpBk?1:0)+bpSpN+(s.bpBk?1:0);
  const hasUvForR = !!(s.fpUv||s.bpUv);

  const sheetInfo = useMemo(()=>{
    if (!netSize) return null;
    if (s.mR) {
      const sh = BASE_SHEETS.find(x=>x.id===s.sheetId)||BASE_SHEETS[0];
      const up = calcUpOnSheet(netSize.netW, netSize.netH, sh.w, sh.h,
                               netSize.glueTab, netSize.topLid, netSize.botFloor);
      const R  = parseFloat(s.mRV)||0;
      return { ...sh, up, R, sheetsPerR: sh.sheetsPerR||1000, price:getPaperPrice(s.paperId,sh.id,s.mPrice?s.mPriceV:"") };
    }
    return findBestSheet(netSize, qty, s.sheetId==="auto"?"auto":s.sheetId, s.paperId,
                         s.mPrice?s.mPriceV:"", totalColorsForR, hasUvForR);
  }, [netSize, qty, s.sheetId, s.mR, s.mRV, s.paperId, s.mPrice, s.mPriceV, totalColorsForR, hasUvForR]);

  const result = useMemo(()=>{
    try { return computeForQty(s, qty, sheetInfo, netSize); } catch(e){ return null; }
  }, [s, qty, sheetInfo, netSize]);

  // [V7] 지대 단가 정보 (확인여부 포함)
  const autoPriceInfo = useMemo(()=>{
    if (!sheetInfo) return null;
    return getPaperPriceInfo(s.paperId, sheetInfo.id);
  }, [sheetInfo, s.paperId]);

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'Segoe UI','Noto Sans KR',sans-serif",background:"#0a1628",color:"#d0e0ff",overflow:"hidden"}}>

      {/* ══ LEFT PANEL ═══════════════════════════════════════════════ */}
      <div style={{width:310,flexShrink:0,background:"#0d1e36",borderRight:"2px solid #1a2e4a",padding:"14px",overflowY:"auto"}}>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:8,fontWeight:800,color:"#e64433",letterSpacing:".2em",textTransform:"uppercase"}}>크리아종합특수인쇄</div>
          <div style={{fontSize:15,fontWeight:900,color:"#e8f0ff",marginTop:2}}>자동 견적 산출 시스템</div>
          <div style={{fontSize:9,color:"#556680",marginTop:1}}>v7.2 · UV소부제외·코팅판형분기·접착최소·관리비·인쇄qty 최적화</div>
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
          <Field label="박스 구조 (Type)" note="구조에 따라 뚜껑·바닥 전개 치수 자동 반영">
            <Select value={s.boxType} onChange={v=>handleBoxType(v)} options={BOX_TYPES}/>
          </Field>

          {/* G형 안내 박스 — 자동 판별 결과 표시 */}
          {s.boxType === "gtype" && (
            <div style={{background:"#07150a",border:"1px solid #1a4a22",borderRadius:4,padding:"9px 11px",fontSize:10,color:"#44cc77",marginBottom:10,lineHeight:1.9}}>
              <div style={{fontWeight:800,color:"#66ff99",marginBottom:4,fontSize:11}}>
                📦 G형 (톰슨조립)
                {netSize?.gtypeVariant && (
                  <span style={{marginLeft:8,fontSize:10,background: netSize.gtypeVariant==="A"?"#2a1a4a":"#0a2a1a",
                    color: netSize.gtypeVariant==="A"?"#cc88ff":"#44ff88",
                    padding:"1px 7px",borderRadius:8,fontWeight:700}}>
                    {netSize.gtypeVariant==="A" ? "A형 (거싯날개)" : "B형 (납작트레이)"} 자동선택
                  </span>
                )}
              </div>
              {netSize?.gtypeVariant === "A" ? (<>
                <div>가로 = W + <b>4</b>×D + 14 <span style={{color:"#336644"}}>(좌거싯2D+전면W+우거싯2D+접착14)</span></div>
                <div>세로 = <b>2</b>×H + <b>3</b>×D + 1</div>
              </>) : (<>
                <div>가로 = W + <b>2</b>×D + 14 <span style={{color:"#336644"}}>(좌D+전면W+우D+접착14)</span></div>
                <div>세로 = H + <b>2</b>×D <span style={{color:"#336644"}}>(판걸이 회전 없음)</span></div>
              </>)}
              {netSize?.gtypeRatio !== undefined && (
                <div style={{marginTop:4,fontSize:9,color:"#335544",borderTop:"1px solid #1a3a22",paddingTop:4}}>
                  D/H = {(netSize.gtypeRatio).toFixed(2)}
                  {netSize.gtypeVariant==="A"
                    ? " → 0.8 초과 → A형 공식 적용"
                    : " → 0.8 이하 → B형 공식 적용"}
                </div>
              )}
              {!netSize && (
                <div style={{fontSize:9,color:"#336644"}}>
                  치수 입력 후 D/H 비율로 공식 자동 선택 (기준 0.8)
                </div>
              )}
            </div>
          )}
          <Row3>
            <Field label="가로 W mm"><Input value={s.bW} onChange={v=>u("bW",v)} placeholder="mm" type="number"/></Field>
            <Field label="깊이 D mm"><Input value={s.bD} onChange={v=>u("bD",v)} placeholder="mm" type="number"/></Field>
            <Field label="높이 H mm"><Input value={s.bH} onChange={v=>u("bH",v)} placeholder="mm" type="number"/></Field>
          </Row3>

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
              {netSize.isGtype ? (
                <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1a3050",marginTop:4,paddingTop:4}}>
                  <span style={{color:"#44cc77",fontSize:9}}>
                    G형 {netSize.gtypeVariant}형 ({netSize.gtypeVariant==="A"?"W+4D+14 / 2H+3D+1":"W+2D+14 / H+2D"})
                  </span>
                  <span style={{color:"#44cc77",fontSize:9,fontFamily:"monospace"}}>접착날개 14mm</span>
                </div>
              ) : (
                <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1a3050",marginTop:4,paddingTop:4}}>
                  <span style={{color:"#8899bb",fontSize:9}}>뚜껑 / 바닥 / 접착날개</span>
                  <span style={{color:"#8899bb",fontSize:9,fontFamily:"monospace"}}>
                    {fmtMM(netSize.topLid)} / {fmtMM(netSize.botFloor)} / {fmtMM(netSize.glueTab)} mm
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
                                             netSize.glueTab, netSize.topLid, netSize.botFloor, netSize.gtypeNoRotate||false);
                return (
                  <>
                    <div>✦ 판형: <strong>{sheetInfo.label}</strong></div>
                    <div>✦ 판걸이: <strong style={{color:"#ffcc44"}}>{sheetInfo.up} up</strong>
                      {layout.rotated && <span style={{fontSize:9,color:"#f59e0b",marginLeft:5,fontWeight:700}}>↺ 회전</span>}
                      {layout.interlocked && <span style={{fontSize:9,color:"#10b981",marginLeft:5,fontWeight:700}}>⇅ 인터로킹</span>}
                    </div>
                    <div>✦ R수: <strong>{fmtR(sheetInfo.R)} R</strong></div>
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
              {s.showSheetCompare && <SheetCompare netSize={netSize} qty={qty} paperId={s.paperId} sheetId={s.sheetId} mPriceVal={s.mPrice?s.mPriceV:""} totalColors={totalColorsForR} hasUv={hasUvForR}/>}
            </div>
          )}
        </Section>

        {/* ══ [V6] 지대 섹션 — 판형별 단가 표시 + 직접입력 ══ */}
        <Section title="지대 (원지)">
          <Field label="지종 선택" note="AB지 = 아트보드(Art Board) ｜ 판형 선택 후 지대 단가가 자동 계산됩니다">
            <Select value={s.paperId} onChange={v=>u("paperId",v)}
              options={PAPERS.filter(p=>!p.hidden).map(p=>({id:p.id,label:`[${p.group}] ${p.label}`}))}/>
          </Field>
          <Field label="판형 선택">
            <Select value={s.sheetId} onChange={v=>u("sheetId",v)}
              options={[{id:"auto",label:"⚡ 자동 최적 (지대비 최소)"}, ...BASE_SHEETS]}/>
          </Field>

          {/* 지대 단가 자동 표시 */}
          {sheetInfo && !s.mPrice && (()=>{
            const pi = getPaperPriceInfo(s.paperId, sheetInfo.id);
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
                      ? `${sheetInfo.label.split("(")[0].trim()} 실측가`
                      : `하4 ${PAPERS.find(p=>p.id===s.paperId)?.priceHa4?.toLocaleString()}원 × 면적비 (미확인 추정)`}
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
            <Toggle checked={s.mR} onChange={v=>u("mR",v)} label="R수 직접 입력"/>
          </div>
          {s.mR && (
            <div style={{marginTop:8}}>
              <Field label="R수 직접 입력">
                <Input value={s.mRV} onChange={v=>u("mRV",v)} type="number" placeholder="예: 0.70"/>
              </Field>
            </div>
          )}
        </Section>

        <Section title="인쇄">
          {/* 전면 인쇄 */}
          <div style={{background:"#080e1c",border:"1px solid #1a3050",borderRadius:4,padding:"10px",marginBottom:8}}>
            <div style={{fontSize:9,color:"#4aaeff",fontWeight:700,marginBottom:8,letterSpacing:".08em"}}>전 면 인쇄</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
              <Field label="별색 도수 (0~8)">
                <Input value={s.fpSp} onChange={v=>u("fpSp",Math.max(0,Math.min(8,parseInt(v)||0)).toString())} type="number" placeholder="0"/>
              </Field>
              <div style={{display:"flex",flexDirection:"column",gap:6,paddingTop:14}}>
                <Toggle checked={s.fpBk} onChange={v=>u("fpBk",v)} label="먹 1도"/>
                <Toggle checked={s.fpUv} onChange={v=>u("fpUv",v)} label="UV 인쇄"/>
              </div>
            </div>
            {(parseInt(s.fpSp)>0||s.fpBk||s.fpUv) && (
              <div style={{fontSize:9,color:"#44cc88",padding:"3px 6px",background:"#0a2a10",borderRadius:3}}>
                전면 {[s.fpUv?"UV":"",parseInt(s.fpSp)>0?`별색${s.fpSp}도`:"",s.fpBk?"먹1도":""].filter(Boolean).join("+")}
                &nbsp;— 소부 {(parseInt(s.fpSp)||0)+(s.fpBk?1:0)}판{s.fpUv&&<span style={{color:"#88ccff"}}> (UV별도)</span>}
              </div>
            )}
          </div>
          {/* 후면 인쇄 */}
          <div style={{background:"#080e1c",border:"1px solid #1a3050",borderRadius:4,padding:"10px",marginBottom:8}}>
            <div style={{fontSize:9,color:"#88aacc",fontWeight:700,marginBottom:8,letterSpacing:".08em"}}>후 면 인쇄</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8}}>
              <Field label="별색 도수 (0~8)">
                <Input value={s.bpSp} onChange={v=>u("bpSp",Math.max(0,Math.min(8,parseInt(v)||0)).toString())} type="number" placeholder="0"/>
              </Field>
              <div style={{display:"flex",flexDirection:"column",gap:6,paddingTop:14}}>
                <Toggle checked={s.bpBk} onChange={v=>u("bpBk",v)} label="먹 1도"/>
                <Toggle checked={s.bpUv} onChange={v=>u("bpUv",v)} label="UV 인쇄"/>
              </div>
            </div>
            {(parseInt(s.bpSp)>0||s.bpBk||s.bpUv) && (
              <div style={{fontSize:9,color:"#88aacc",padding:"3px 6px",background:"#0a1828",borderRadius:3}}>
                후면 {[s.bpUv?"UV":"",parseInt(s.bpSp)>0?`별색${s.bpSp}도`:"",s.bpBk?"먹1도":""].filter(Boolean).join("+")}
                &nbsp;— 소부 {(parseInt(s.bpSp)||0)+(s.bpBk?1:0)}판{s.bpUv&&<span style={{color:"#88ccff"}}> (UV별도)</span>}
              </div>
            )}
          </div>
          {/* 소부 단가 */}
          <Field label="소부 단가 (원/도)">
            <Input value={s.sobooU} onChange={v=>u("sobooU",v)} type="number"/>
          </Field>
          {/* 총 도수 표시 — UV 제외 소부 기준 */}
          {((parseInt(s.fpSp)||0)+(s.fpBk?1:0)+(parseInt(s.bpSp)||0)+(s.bpBk?1:0)) > 0 && (()=>{
            const td_sobu = (parseInt(s.fpSp)||0)+(s.fpBk?1:0)+(parseInt(s.bpSp)||0)+(s.bpBk?1:0);
            const td_uv   = (s.fpUv?1:0)+(s.bpUv?1:0);
            const su = parseInt(s.sobooU)||11000;
            return (
              <div style={{fontSize:10,color:"#ffcc44",padding:"4px 8px",background:"#111d33",borderRadius:3,textAlign:"right"}}>
                소부 {td_sobu}도 × {su.toLocaleString()}원 = {(td_sobu*su).toLocaleString()}원
                {td_uv>0 && <span style={{color:"#88aacc",marginLeft:6,fontSize:9}}>UV인쇄 별도 ({td_uv}회)</span>}
              </div>
            );
          })()}
        </Section>

        <Section title="코팅 / 후가공">
          <Row2>
            <Field label="전면 코팅"><Select value={s.fcId} onChange={v=>u("fcId",v)} options={COAT_OPTS}/></Field>
            <Field label="후면 코팅"><Select value={s.bcId} onChange={v=>u("bcId",v)} options={COAT_OPTS}/></Field>
          </Row2>
          <Toggle checked={s.puv} onChange={v=>u("puv",v)} label="부분 UV 코팅"/>
          {s.puv && (
            <div style={{marginTop:8}}>
              <Field label="부분UV 면수"><Select value={s.puvS} onChange={v=>u("puvS",v)} options={["1","2"]}/></Field>
            </div>
          )}
          {/* [V7] 형압(디보싱) */}
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
            <div style={{fontSize:10,color:"#4488aa",padding:"5px 8px",background:"#050f1c",borderRadius:3,marginTop:6}}>
              자동: {(()=>{
                const q=parseInt(s.qty)||0;
                if(q<=5000)  return '100,000원 (≤5천ea)';
                if(q<=10000) return '130,000원 (≤1만ea)';
                if(q<=50000)  return '200,000원 (≤5만ea)';
                if(q<=100000) return '300,000원 (≤10만ea)';
                return '350,000원 (초과)';
              })()}
            </div>
          )}
        </Section>

        <Section title="개발비 (목형)">
          <Toggle checked={s.newDie} onChange={v=>u("newDie",v)} label="신규 목형 제작"/>
          {s.newDie && (
            <div style={{marginTop:10}}>
              <Row2>
                <Field label="목형 수량"><Input value={s.dieQ} onChange={v=>u("dieQ",v)} type="number"/></Field>
                <Field label="목형 단가 (원)" note="기본 180,000원"><Input value={s.dieP} onChange={v=>u("dieP",v)} type="number"/></Field>
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
                  <div>코리팩</div>
                  <div>서울시 영등포구 경인로 775 2동 908호</div>
                  <div>TEL: 02-2677-2675</div>
                </div>
              </div>

              {/* 거래처 정보 */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:"2px solid #0a1628"}}>
                {[
                  ["거래처",s.customer||"—"],["상  호","코리팩"],
                  ["품  목",s.product||"—"], ["주  소","서울시 영등포구 경인로 775 2동 908호"],
                  ["수  량",`${qty.toLocaleString()} EA`],["연락처","TEL: 02-2677-2675"],
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
                                                 netSize.glueTab, netSize.topLid, netSize.botFloor, netSize.gtypeNoRotate||false);
                    return (
                      <>
                        <span>📐 전개도: <strong>{fmtMM(netSize.netW)}×{fmtMM(netSize.netH)}mm</strong></span>
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
                        {(s.boxType==="gtype") && (
                          <span style={{fontSize:9,background:"#1a4a22",color:"#44ff88",padding:"1px 5px",borderRadius:2,fontWeight:700}}>
                            {netSize?.gtypeVariant==="A" ? "G형A: W+4D+14" : "G형B: W+2D+14"}
                          </span>
                        )}
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

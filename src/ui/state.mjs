// ══════════════════════════════════════════════════════════════════
//  state.mjs — UI 상태 ↔ 도메인 입력 변환
//
//  변환은 **여기 한 곳**에서만 한다. parseInt(s.printU) 같은 코드가 도메인에
//  있으면 테스트가 UI 키 64개를 알아야 한다.
// ══════════════════════════════════════════════════════════════════
import { SOBOO_UNIT_DEFAULT } from "../domain/data/print-prices.mjs";
import { EMB_RPR_DEFAULT, FOIL_RPR_DEFAULT } from "../domain/data/process-prices.mjs";
import { structures, getStructure } from "../domain/dieline/index.mjs";
import { today } from "./format.mjs";

// ⚠ parseFloat 필수: parseInt("15.5")=15 → D≤15 조건 오작동, parseInt("73.5")=73 오차
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const int = v => { const n = parseInt(v);   return Number.isFinite(n) ? n : 0; };

export const INITIAL_STATE = {
  customer: "코리팩", product: "십자B 패키지", date: today(),
  // 규격 입력: sizeMode "box" = W·D·H로 전개도 자동계산 / "net" = 전개도 전체크기 직접입력
  sizeMode: "box",
  bW: "40", bD: "40", bH: "133", boxType: "tuck_both",
  nW: "646", nH: "258",           // 전개도 전체크기 직접입력 (예: 슬리브 646×258)
  paperId: "AB350", sheetId: "auto",
  cusW: "890", cusH: "670", cusCut: "2",   // 주문생산 판형 크기·절수
  mR: false, mRV: "",
  mUp: false, mUpV: "",          // 판걸이(up) 직접 입력
  hang: false, hangV: "15",      // 행거탭(유로홀) 돌출 mm
  lossSheets: "",                // 여분(손지) 수동 입력 장수 (빈값=자동)
  mPrice: false, mPriceV: "",
  qty: "5000",
  fpSp: "1", fpBk: true,  fpUv: false, fpColor: false,
  bpSp: "0", bpBk: false, bpUv: false, bpColor: false,
  beda: false,                   // 별색 베다(바탕 전면 인쇄) → 별색 R단가 상향
  spotMode: "weight",            // "weight"=별색 도수환산(×3) / "rpr"=별색 R당 고정단가
  spotRprV: "", printU: "",      // 별색 R단가 / 인쇄 도당단가 (빈값=판형별 기본)
  sobooU: String(SOBOO_UNIT_DEFAULT),
  fcId: "ir", bcId: "none",
  puv: false, puvS: "1",
  thomId: "n", glueId: "dan",
  admin: "100000", adminManual: false,
  newDie: true, dieQ: "1", dieP: "140000", filmC: "",
  emb: false, embRpr: String(EMB_RPR_DEFAULT), embDevP: "90000", embFilmP: "28000",
  foil: false, foilType: "금박", foilS: "1", foilRpr: String(FOIL_RPR_DEFAULT),
  foilDevP: "25000", foilFilmP: "35000",
  showCompare: false, showSheetCompare: false, showViz: true, showNet: false,
};

/** 구조가 톰슨 기본값을 선언했으면 그걸로 강제 전환하고, 아니면 복귀시킨다.
 *  종전에는 `boxType === "gtype" ? "g_std"` 로 문자열이 여기 박혀 있어서
 *  레지스트리의 thomsonDefault 가 선언만 되고 아무도 읽지 않았다.
 *  복귀 조건도 "어떤 구조든 자기 기본값이던 값이면 일반(n)으로" 로 일반화했다.
 *  ※ 박스 구조와 접착 방식은 별개다 — 삼면접착 구조여도 접착 작업은 단면이 일반적(실측). */
const THOM_DEFAULTS = new Set(
  structures().map(st => getStructure(st.id)?.thomsonDefault).filter(Boolean));

export const nextThomId = (boxType, cur) =>
  getStructure(boxType)?.thomsonDefault ?? (THOM_DEFAULTS.has(cur) ? "n" : cur);

/** 주문생산 판형 크기·절수 (판형이 custom 일 때만 유효) */
export function customSheetOf(s) {
  const w = num(s.cusW), h = num(s.cusH), cut = int(s.cusCut) || 2;
  return (w > 0 && h > 0) ? { w, h, cut } : null;
}

/**
 * UI 상태 → QuoteInput.
 *
 * ⚠ overrides 의 값들은 **빈칸이면 undefined** 여야 한다. 0 을 넣으면 도메인이
 *   "0원으로 계산해달라" 는 지시로 받는다(?? 로 읽으므로). 종전 `parseInt(x) || 기본값`
 *   동작을 유지하려면 여기서 0 을 undefined 로 접어야 한다.
 */
export function toQuoteInput(s) {
  const hangTab = s.hang ? (num(s.hangV) || 15) : 0;
  const mUp = int(s.mUpV);
  return {
    qty: int(s.qty),
    box: {
      mode: s.sizeMode, structure: s.boxType, hangTab,
      W: num(s.bW), D: num(s.bD), H: num(s.bH),
      netW: num(s.nW), netH: num(s.nH),
    },
    paper: { paperId: s.paperId, sheetId: s.sheetId, custom: customSheetOf(s) },
    print: {
      front: { color: !!s.fpColor, spot: int(s.fpSp), black: !!s.fpBk, uv: !!s.fpUv },
      back:  { color: !!s.bpColor, spot: int(s.bpSp), black: !!s.bpBk, uv: !!s.bpUv },
      beda: !!s.beda, spotMode: s.spotMode || "weight",
    },
    finish: {
      coatFrontId: s.fcId, coatBackId: s.bcId, thomsonId: s.thomId, glueId: s.glueId,
      foil: s.foil ? { type: s.foilType, sides: Math.max(1, int(s.foilS) || 1),
                       rpr: int(s.foilRpr) } : null,
      emb:  s.emb  ? { rpr: int(s.embRpr) } : null,
      puv:  s.puv  ? { sides: Math.max(1, int(s.puvS) || 1) } : null,
    },
    overrides: {
      up:             (s.mUp && mUp > 0) ? mUp : undefined,
      reams:          s.mR ? num(s.mRV) : undefined,
      paperPricePerR: s.mPrice ? num(s.mPriceV) : undefined,
      lossSheets:     s.lossSheets,
      printUnit:      int(s.printU)   || undefined,
      spotRpr:        int(s.spotRprV) || undefined,
      sobooUnit:      int(s.sobooU)   || undefined,
      admin:          s.adminManual ? (int(s.admin) || 100000) : undefined,
    },
    dev: {
      newDie: !!s.newDie, dieQty: int(s.dieQ), diePrice: int(s.dieP),
      filmCost: int(s.filmC),
      embDevPrice: int(s.embDevP), embFilmPrice: int(s.embFilmP),
      foilDevPrice: int(s.foilDevP), foilFilmPrice: int(s.foilFilmP),
    },
  };
}

// ══════════════════════════════════════════════════════════════════
//  paper-repo.mjs — 지종×판형 → 지대 단가 조회
// ══════════════════════════════════════════════════════════════════
import { PAPERS } from "./data/papers.mjs";
import { PRICE_TABLE } from "./data/paper-prices.mjs";
import { BASE_SHEETS, sheetsPerR, resolveSheet, findSheetBase } from "./data/sheets.mjs";

/**
 * 이 지종×판형 조합에 「확인된」 지대 단가가 있는가.
 * auto / custom 은 항상 허용 (auto 는 추정치까지 써서 탐색, custom 은 직접입력 전제).
 * UI 에서 추정 조합을 회색·비활성으로 막는 데 사용.
 */
export function paperSheetConfirmed(paperId, sheetId) {
  if (!paperId || !sheetId) return false;
  if (sheetId === "auto" || sheetId === "custom") return true;
  return PRICE_TABLE[paperId]?.[sheetId] > 0;
}

/**
 * 지대 단가 (원/R) — 룩업 우선, 미확인 시 면적비례 추정
 * 룩업 우선 → 없으면 같은 지종의 확인된 판형에서 **장당 단가 × 면적비**로 환산
 * (R당 단가를 그대로 면적비례하면 절수 차이 때문에 크게 틀림)
 * 검증: AB350 4×64 399,651(2,000장) → 하4 추정 493,400 / 실측 492,286 (오차 0.2%)
 * @returns {{price:number, confirmed:boolean, manual?:true, estimateFrom?:string, noData?:true}}
 */
export function getPaperPriceInfo(paperId, sheetId, mPriceVal, customSheet) {
  if (mPriceVal && parseFloat(mPriceVal) > 0)
    return { price: parseFloat(mPriceVal), confirmed: true, manual: true };
  if (!PAPERS.find(p => p.id === paperId)) return { price: 0, confirmed: false, noData: true };

  const tablePrice = PRICE_TABLE[paperId]?.[sheetId];
  if (tablePrice) return { price: tablePrice, confirmed: true };

  const base = findSheetBase(sheetId);
  if (!base) return { price: 0, confirmed: false, noData: true };
  const sheet = resolveSheet(base, customSheet);
  const targetArea = sheet.w * sheet.h;
  const targetPerR = sheetsPerR(sheet);

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

export const getPaperPrice = (paperId, sheetId, mPriceVal, customSheet) =>
  getPaperPriceInfo(paperId, sheetId, mPriceVal, customSheet).price;

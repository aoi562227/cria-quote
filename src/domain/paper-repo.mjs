// ══════════════════════════════════════════════════════════════════
//  paper-repo.mjs — 지종×판형 → 지대 단가 조회
// ══════════════════════════════════════════════════════════════════
import { PAPERS } from "./data/papers.mjs";
import { PRICE_TABLE } from "./data/paper-prices.mjs";
import { lookup as coherentLookup, GSM_ROW } from "./data/paper-coherence.mjs";
import { BASE_SHEETS, sheetsPerR, resolveSheet, findSheetBase } from "./data/sheets.mjs";

/**
 * 이 지종×판형 조합에 「확인된」 지대 단가가 있는가.
 * auto / custom 은 항상 허용 (auto 는 추정치까지 써서 탐색, custom 은 직접입력 전제).
 * UI 에서 추정 조합을 회색·비활성으로 막는 데 사용.
 *
 * ★ 26-09-15 정합 도입에도 **이 함수는 안 바뀐다.** 정합은 「값」을 고치는 일이고
 *   이 함수는 「그 칸에 견적서가 있느냐」를 묻는다 — 서로 다른 질문이다. 아래
 *   getPaperPriceInfo 의 confirmed 도 같은 이유로 뜻을 그대로 둔다.
 */
export function paperSheetConfirmed(paperId, sheetId) {
  if (!paperId || !sheetId) return false;
  if (sheetId === "auto" || sheetId === "custom") return true;
  return PRICE_TABLE[paperId]?.[sheetId] > 0;
}

/**
 * 지대 단가 (원/R) — **정합층(paper-coherence.mjs N1~N4) 우선**, 없으면 면적비례 추정
 *
 * ★ 26-09-15 정합 도입 — 종전에는 `PRICE_TABLE[지종][판형]` 을 직접 읽고, 빈 칸이면
 *   아래 「면적이 가장 가까운 칸」 환산으로 떨어졌다. 그 ref 선택이 **원지계열을 안 봐서**
 *   같은 사륙 칸을 채우는 데 하드롱·국전 칸을 쓰는 일이 생겼고, 1R = 원지 500장 항등식이
 *   금지하는 값이 나왔다(예: AB350 4x63 이 같은 사륙 4x62 378,617 을 두고 국2 기준
 *   420,789 로 채워졌다 — 사용자가 「같은 46판인데 4절이 더 비싸다」고 지적한 그 자리다).
 *   ⟹ 이제 정합층이 계열 항등(N1)·계열 환산(N2)·계열중복 무효(N3)·하향 금지(N4)로
 *     10칸을 먼저 채운다. 아래 fallback 은 **지종 자체가 표에 없을 때만** 남는다.
 *
 * ⚠ PRICE_TABLE 은 여전히 한 글자도 안 고쳤다. 정합층은 순수 파생이다.
 * @returns {{price:number, confirmed:boolean, basis?:"obs"|"fam"|"ratio", raw?:number,
 *            anchorFam?:string, anchorSheet?:string,
 *            manual?:true, estimateFrom?:string, noData?:true}}
 */
export function getPaperPriceInfo(paperId, sheetId, mPriceVal, customSheet) {
  if (mPriceVal && parseFloat(mPriceVal) > 0)
    return { price: parseFloat(mPriceVal), confirmed: true, manual: true };
  if (!PAPERS.find(p => p.id === paperId)) return { price: 0, confirmed: false, noData: true };

  const hit = coherentLookup(paperId, sheetId);
  if (hit) return {
    price: hit.v,
    // ★★ confirmed 의 뜻을 **바꾸지 않는다** — 「그 칸에 견적서가 있다」 그대로다.
    //   정합이 값을 고쳐도 없던 견적서가 생기는 건 아니다. 그리고 이 한 줄이
    //   EST_PRICE_PENALTY(3%)가 걸리는 범위를 종전과 **한 칸도 다르지 않게** 유지한다.
    //   ⚠ 여기서 fam 까지 confirmed 로 올렸다가 되돌린 이력이 있다(26-09-15).
    //     페널티는 단가를 못 믿어서만 있는 게 아니라, **표에 칸이 있다는 사실 자체가
    //     「이 업체가 이 지종을 이 판형에 실제로 태운다」는 증거**로도 작동하고 있었다.
    //     fam 을 confirmed 로 올리니 AB295L 46전지처럼 **견적서에 한 번도 안 나온
    //     조합**이 페널티를 벗고 auto 에서 이겨, verify-speclink §N⑪ 스윕의 예외가
    //     3칸 → 6칸(최악 −3.7% → −6.5%)으로 나빠졌다. 값만 고치고 선택 성향은 둔다.
    //   ⟹ 그래서 기준은 basis 가 아니라 **raw > 0**(그 칸에 견적서가 있느냐)이다.
    //     N1 이 값을 올린 관측칸(AB400 4x62 427,672 → 431,272)도 견적서는 그대로
    //     있으므로 「확인」이다. basis 로 갈랐다가 이 칸이 ⚠추정으로 떨어져
    //     verify-print §D 첫 줄이 깨졌다 — 판형은 맞는데 근거만 뒤집힌 형태였다.
    //     이 정의는 위 paperSheetConfirmed 와 **정확히 같다**(화면 배지와 드롭다운이
    //     어긋나면 안 된다).
    confirmed: hit.raw > 0,
    basis: hit.basis, raw: hit.raw,
    anchorFam: hit.anchorFam, anchorSheet: hit.anchorSheet, famSheet: hit.famSheet,
    // 평량 파생(N5~N8)이면 근거 뭉치를 그대로 넘긴다 — 화면이 「무엇에서 어떻게 왔는지」
    // 를 적어야 한다(⚠평량 배지). 없는 칸에는 undefined 라 종전 경로는 안 움직인다.
    ...(hit.gsm ? { gsm: hit.gsm } : {}),
    // 화면이 「무엇에서 뻗어 왔는지」를 적을 수 있게 종전 필드명을 그대로 채운다.
    ...(hit.raw > 0 ? {} : { estimateFrom: hit.anchorSheet }),
  };

  // ── 아래는 정합층이 못 덮는 **잔여 경로**다. 일부러 안 건드렸다 ────────────────
  //  ① 주문생산(custom) — 그 지종에 custom 칸이 없을 때. 원지계열이 없어 N1~N4 의
  //     「같은 원지」라는 말이 성립하지 않는다(코리팩이 임의 치수로 재단한다).
  //     ⟹ 종전 면적환산 그대로 둔다. 실측 31지종 전부 값이 **한 원도 안 변했다.**
  //     화면도 「코리팩 협의 · 단가 직접입력」을 이미 권한다.
  //  ② 지종이 PRICE_TABLE 에 통째로 없을 때 — refs 가 비어 noData 로 떨어진다.
  //  ⚠ 여기 남은 「면적이 가장 가까운 칸」 정렬은 **원지계열을 안 본다.** 정합층이
  //    그 결함을 고친 것이므로, 이 경로를 넓히지 마라. 넓혀야 하면 정합층으로 가라.
  const base = findSheetBase(sheetId);
  if (!base) return { price: 0, confirmed: false, noData: true };
  const sheet = resolveSheet(base, customSheet);
  const targetArea = sheet.w * sheet.h;
  const targetPerR = sheetsPerR(sheet);

  // ⚠ 26-09-17 — `|| GSM_ROW[paperId]` 한 조각. 평량 파생(N5~N8)으로 들어온 지종은
  //   PRICE_TABLE 에 줄이 **통째로 없어서** 여기서 refs 가 비고 주문생산(custom)이
  //   noData 로 떨어진다(정합층은 원지계열이 있는 칸만 덮는데 custom 은 원지계열이 없다).
  //   GSM_ROW 는 그 지종의 「평량을 잰 칸 한 줄」이라 종전 면적환산 식이 그대로 돈다.
  //   ⚠ 순서가 중요하다 — PRICE_TABLE 이 **먼저**다. 관측이 있으면 추정은 안 본다(N8④).
  const refs = Object.entries(PRICE_TABLE[paperId] || GSM_ROW[paperId] || {}).map(([refId, refPrice]) => {
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

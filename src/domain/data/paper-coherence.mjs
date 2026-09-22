// ══════════════════════════════════════════════════════════════════
//  paper-coherence.mjs — 지대 단가 **정합층** (원지 정합 규칙 N1~N4)
//
//  ★ 이 파일은 paper-prices.mjs 를 **읽기만 한다. 한 글자도 안 고친다.**
//    PRICE_TABLE 은 견적서에서 읽은 **관측**(증거)이고, 여기서 만드는 EFFECTIVE 는
//    그 증거에서 **파생**한 값이다. 둘을 파일로 갈라 두는 이유:
//      · 되돌릴 데이터가 없다 — 이 파일을 지우면 그대로 종전 거동이다.
//      · 새 견적서가 오면 평소대로 PRICE_TABLE 에 한 줄 넣으면 된다.
//        파생은 import 시점에 다시 계산되므로 **손으로 다시 깔 일이 없다.**
// ══════════════════════════════════════════════════════════════════
//
//  ── 왜 필요한가 (사용자 지적, 26-09-15) ────────────────────────────
//   「같은 국판이나 46판인데도 2절보다 4절이 비싸고 …」
//   실제로 AB295L 은 같은 **사륙 원지**인데 4x62 318,438 · 4x63 300,747 ·
//   4x64 283,056 으로 12.5% 벌어져 있었다. 이건 종이값 차이가 아니다 —
//   **칸마다 견적서 날짜가 다르기 때문**이다(paper-prices.mjs 머리말이 이미
//   「견적 시점이 달라서다」라고 적어 뒀다).
//
//  ── 근거가 되는 항등식 ──────────────────────────────────────────
//   1R = 500 × 절수 장 (sheets.mjs) 이고, 절수는 원지 1장에서 나오는 장수다.
//   ⟹ **어느 절수든 1R 은 원지 500장분이다.**
//   ⟹ 같은 지종·같은 원지계열이면 절수가 달라도 원/R 은 **같아야 한다.**
//      이건 모델이 아니라 정의에서 나오는 **항등식**이다. 근거를 따질 것이 없다.
//   ⟹ 원지계열이 다르면 원지 **면적비**로만 갈려야 한다:
//      사륙 788×1091 = 859,708 · 국전 636×939 = 597,204 · 하드롱 889×1194 = 1,061,466
//
//   ※ 이 앱은 **이미** 이 모델을 쓰고 있다. paper-repo.mjs 의 면적환산 추정식을
//     전개하면 절수가 약분되고 원지 면적비 하나만 남는다:
//       refPrice/(500·refCut) × (targetArea/refArea) × 500·targetCut  ≈  refPrice × rawT/rawR
//     (절수 치수 반올림 탓에 ±0.19% 잔차가 남는다 — 아래 MOTHER 주석 참조.)
//     그러니 새 모델을 들여오는 게 아니라 **이미 쓰는 모델을 표 전체에 적용**하는 일이다.
//
//  ── 이 표가 스스로 증명하는 것 (26-09-15 실측) ───────────────────
//   ① 같은 계열에서 **절수가 달라도 값이 정확히 같은** 지종이 4개다 —
//        AB350 4x62 = 4x64 = 378,617 (26-08-07 / 26-09-09, 날짜가 다른데 같다)
//        CCP300 4x62 = 4x64 = 386,260 · IV450 4x62 = 4x63 = 4x64 = 275,169
//        AB400 46 = 4x64 = 431,272
//      ⟹ 원/R 에 **절단비가 안 섞여 있다**는 증거다. 그래서 계열 내에 별도
//        페널티를 두지 않는다(아래 basis:"fam" 을 confirmed 로 치는 근거).
//   ② 계열을 넘는 면적비 모델의 성적은 **계열마다 다르다**:
//        하드롱↔사륙  제공권 5건 전부 ±5.4% 안 (+5.3 · +5.4 · −0.0 · −0.5 · +0.5)
//        국전↔사륙    7건이 −0.3 ~ +36.0% 로 흩어지고 **6건이 사륙보다 비싸다**
//      ⟹ 국전은 면적비보다 **비싸게** 나온다(드문 규격의 할증으로 읽힌다).
//        그래서 ⓐ 앵커 순서에서 국전을 **맨 뒤**로 두고, ⓑ N4(하향 금지)를 둔다.
//        국전 칸을 사륙에서 뻗어 내리면 **체계적으로 싸진다** = 회사가 손해 보는 방향이다.
//   ③ 모델이 크게 빗나가는 칸 3개는 **전부 출처가 부실한 칸**이다 —
//        AB295L ha4 −23.5% · MK350 ha4 −19.0% (둘 다 N3 가 기계적으로 잡는다)
//        CCP350 ha4 +41.7% (paper-prices.mjs 머리말 ③ 이 스스로 「판형이 안 찍혀
//        귀속 불가」라고 적어 둔 값이 ha4 칸에 앉아 있다)
//      ⟹ 모델의 실패가 **출처가 나쁜 칸에만** 몰린다. 모델을 믿을 근거가 하나 더 생긴다.
//
// ══════════════════════════════════════════════════════════════════
//  ★ 정합 규칙 N1 ~ N4  (이 저장소의 R1~R6 · C1~C3 · P1~P4 와 같은 급의 규칙이다)
//
//   N1 계열 항등 — 같은 원지계열 칸은 **그 계열의 최댓값**으로 같이 간다.
//      1R = 원지 500장 항등식이 「같아야 한다」고 말하고, 어느 값으로 합칠지는
//      C3(못 가르면 비싼 쪽)가 정한다. 계열 내 차이는 100% 견적 날짜 잡음이다.
//
//   N2 계열 환산 — 관측이 없는 계열 칸은 **앵커 계열**의 값을 원지 면적비로 뻗어 채운다.
//      앵커 순서 = 사륙 → 하드롱 → 국전.
//        · 사륙 먼저: 관측 36칸(하드롱 11 · 국전 9)이고, ★절대선이 사륙이다.
//        · 하드롱 다음: 위 ② 대로 사륙과 ±5.4% 안에서 맞는다.
//        · 국전 맨 뒤: 위 ② 대로 사륙과 최대 36% 어긋나고 **늘 비싼 쪽**이다.
//          국전을 앵커로 쓰면 사륙 칸이 부당하게 올라가고(AB295L 4x62 가
//          318,438 → 433,145 로 튀어 **★절대선 개당 204원이 즉시 깨진다**),
//          반대로 국전을 뻗어 받으면 부당하게 싸진다. 그래서 **마지막**이다.
//
//   N3 계열중복 무효 — 같은 지종에서 **두 계열에 똑같은 수**가 박혀 있으면,
//      면적비상 두 계열의 원/R 이 같을 수는 없으므로(계수 0.81 / 1.44) 한쪽은 복사다.
//      관측 칸이 **적은** 계열의 그 칸이 증거 자격을 잃고 N2 로 다시 채워진다
//      (동수면 앵커 순서가 낮은 쪽). ★ 값을 지우거나 내리는 게 아니다 — N4 가 받친다.
//      ⚠ 이건 손으로 적은 명단이 아니라 **탐지 규칙**이다. 아래 crossFamilyDupes()
//        를 돌리면 다음 사람이 언제든 다시 뽑을 수 있다. 지금 잡히는 건 딱 2건이고,
//        둘 다 채굴(quotes.json 853레코드)이 독립으로 뒷받침한다 — anchorSafe 참조.
//
//   N4 하향 금지 — **어떤 칸도 표에 적힌 값 아래로 내려가지 않는다.**
//      관측은 「실제로 그 값에 팔았다」는 사실이고, 근거가 반반인 모델로 그 아래를
//      깎는 건 회사가 손해 보는 방향이다. 이 저장소의 확립된 규율이다
//      (GLUE_MIN_LOT 선례 · C3 · paper-prices.mjs guk2 판정).
//      ⟹ 정직하게 적자면 결과는 「표가 정합한다」가 아니라
//         **「표가 정합하거나, 정합보다 비싸다」**이다.
// ══════════════════════════════════════════════════════════════════
//  ★ 평량 정합 규칙 N5 ~ N8  (26-09-17 수립 — 선주 지시 「없는건 다른 종이 판형별
//    단가 비율 추정으로 넣어줘」. N1~N4 가 **판형** 축을 풀었고, 이것이 **평량** 축이다)
//
//   N5 평량 축은 **같은 계열 × 같은 원지계열** 안에서만 잰다.
//      평량비와 원지 면적비를 한 식에 곱하면 어느 축이 틀렸는지 못 가른다. 그래서
//      평량당 원/R 은 판형 환산이 **한 번도 안 들어간** 자리에서만 재고, 그 결과를
//      판형으로 뻗는 일은 N1·N2 에 그대로 맡긴다. 축을 하나씩 푼다.
//      ⚠ 「계열」은 지종 id 에서 숫자를 뺀 것이다 — AB250L·ABL270·AB295L·ABL325 가
//        전부 "ABL" 로 모이고 AB270 은 "AB" 로 갈린다(아래 seriesOf). 라벨이 아니라
//        id 가 기준인 이유: id 는 저장된 견적이 들고 있는 키라 함부로 안 바뀐다.
//
//   N6 평량 비례 — 같은 칸의 평량당 원/R 이 **±2% 안**에 모이면 원/R ∝ 평량이다.
//      그 상수로 채운다. 값이 여럿이면 **최댓값**을 쓴다(C3 — 못 가르면 비싼 쪽).
//
//   N7 평량 보간 — 비례가 안 서고 **단조**(평량↑ ⟹ 원/R↑)만 서면, 관측 두 점
//      **사이**를 선형 보간한다. 기울기를 관측에서 읽을 뿐 지어내지 않는다.
//
//   N8 평량 규칙을 **쓰지 않는 자리** — 넷이다. 하나라도 걸리면 값을 안 만든다.
//      ① **외삽** — 관측 평량의 바깥. 실측이 왜 금지인지 보여 준다(아래 ③).
//      ② **단조 파탄 계열** — 평량이 큰데 원/R 이 더 싼 칸이 있는 계열.
//      ③ 같은 칸에 평량 관측이 **하나뿐**인 계열. 한 점으로는 기울기가 없다.
//      ④ **이미 관측이 있는 지종** — N4 와 같은 방향이다. 추정이 관측을 못 덮는다.
//
//  ── 실측 (26-09-17 · 이 표 전수 · 판형 환산 0회) ──────────────────────────
//   ★비례 성립(N6) — 평량당 원/R · 산포
//     AB   하드롱 350·400   1406.5 · 1402.8              **0.27%**
//     AB   사륙   300·350·400  1078.2 · 1081.8 · 1078.2  **0.33%**  (270 을 뺀 구간)
//     ABL  사륙   295·325   1079.5 · 1080.1              **0.06%**  (250·270 을 뺀 구간)
//     ART  국2    140·150    617.3 ·  621.9              **0.74%**
//     CCP  하드롱 300·350   1589.7 · 1564.6              **1.60%**
//     ⚠ AB300 4x64 323,454(26-07-06 스토리컴퍼니) × 4/3 = AB400 431,272(26-07-28
//       정앤바이오 · 26-07-06 카카오스타일) — **원 단위로 정확히** 같다. 다른 거래처·
//       다른 판형·다른 문서에서 나온 두 수가 평량비로 딱 맞는다. 공급사가 이 구간을
//       평량 × 상수로 매긴다는 직접 증거다(코퍼스 853레코드에서 확인).
//
//   ✗ 같은 계열인데 **구간이 다르면 안 선다**(N8① 의 근거)
//     AB270   856.1  (AB 사륙 1078.2 대비 **−20.6%**)
//     ABL270  958.7  (ABL 사륙 1079.5 대비 **−11.2%**)   ← 하드롱 ha2 319,600 환산
//     ABL250  786.2  (ABL 사륙 1079.5 대비 **−27.2%**)   ← 26-07-30 실무 제공. 최신값인데도 낮다
//     ⟹ 비례는 **계열의 성질이 아니라 구간의 성질**이다. 295g 언저리에서 꺾인다.
//       그래서 N6 도 외삽은 안 한다 — AB 구간 상수 1081.8 을 270 에 뻗으면 292,086 이
//       나오는데 실제 관측은 231,140 이다(+26.4% 과대).
//
//   ✗ 단조 파탄(N8②) — 이 넷에는 N6·N7 을 아예 안 쓴다
//     SC  사륙 300 268,580 > 350 211,551 > … 400 213,624   (표가 이미 의심 표시를 달아 뒀다)
//     CCP 사륙 300 386,260 > 350 313,040                   (313,040 은 지종·판형 표기가
//                                                           둘 다 틀린 26-09-10 미구하라 건)
//     ABL 하드롱 270 319,600 > 295 300,747                 (300,747 은 4x63 복사 — 아래 참조)
//     ABL 국2   295 300,888 > 325 243,216
//
//   · 단조만 서는 계열(N7 보간만 가능) — AB 국2 11.11% · ACPK 사륙 9.53% ·
//     ALK 국2 **22.41%** · B 사륙 11.48% · **IV 국2 8.81%**
//     ⚠ 26-09-18 정정 — 앞 판은 ALK 국2 를 「215·270 · 11.6%」라 적었다. **한 점을 빠뜨린
//       수다.** 이 계열의 국전 관측은 셋이다: 215 130,975 · 270 147,420 · **325 217,217**
//       (ALK325 의 guk2 칸 — ac 작업 전부터 있던 값이다). 셋을 다 넣으면 평량당이
//       609.2 · 546.0 · **668.4** 이고 산포는 22.41% 다. 결론(단조만 → N7)은 안 바뀌지만
//       **수를 믿고 다음 판단을 얹으면 갈린다** — 실제로 gsmDerive("ALK300") 은 이 세 점
//       중 270↔325 사이를 보간해 **185,491**(국2)을 낸다. 11.6% 짜리 두 점 표로는
//       그 수가 어디서 나오는지 설명이 안 된다.
//       ⟹ 이 표를 고칠 때는 손으로 세지 말고 PRICE_TABLE 을 **전수로** 훑어라.
// ══════════════════════════════════════════════════════════════════
import { PRICE_TABLE } from "./paper-prices.mjs";
import { PAPERS } from "./papers.mjs";
import { BASE_SHEETS } from "./sheets.mjs";

// 원지 면적 — **BASE_SHEETS 의 전지(cut:1) 칸에서 직접 읽는다.**
// ⚠ 절수 칸(788×545 등)에서 역산하면 안 된다. 1091/2=545.5→545, 889/2=444.5→444
//   반올림 때문에 ±0.19% 가 다시 들어와 표가 스스로 정합하지 못한다.
//   전지 칸은 원지 치수 그대로라 잔차가 0 이다.
export const MOTHER = {};
// 판형 → 원지계열. custom(주문생산)은 원지계열이 없으므로 **반드시 제외**한다.
export const FAM_OF = {};
for (const s of BASE_SHEETS) {
  if (s.custom) continue;
  FAM_OF[s.id] = s.family;
  if (s.cut === 1) MOTHER[s.family] = s.w * s.h;
}

/** 사륙 환산계수 — 그 계열 값 × K(계열) = 사륙 기준 원/R */
export const K = fam => MOTHER["사륙"] / MOTHER[fam];

/** N2 앵커 순서 — 근거는 머리말 ②. 바꾸면 ★절대선이 움직인다. */
export const ANCHOR_ORDER = ["사륙", "하드롱", "국전"];

/**
 * N3 탐지기 — 같은 지종에서 계열을 넘어 값이 똑같은 칸을 찾는다.
 * 손으로 적은 명단이 아니라 **규칙**이라는 것이 요점이다. 새 견적서를 넣은 뒤
 * 이 함수를 다시 돌리면 명단이 자동으로 갱신된다.
 * @returns {Array<{paperId, value, sheets:string[], families:string[], drop:string}>}
 */
export function crossFamilyDupes(table = PRICE_TABLE) {
  const out = [];
  for (const [paperId, row] of Object.entries(table)) {
    const byVal = {}, cnt = {};
    for (const [sid, v] of Object.entries(row)) {
      if (!FAM_OF[sid] || !(v > 0)) continue;
      (byVal[v] ||= []).push(sid);
      cnt[FAM_OF[sid]] = (cnt[FAM_OF[sid]] || 0) + 1;
    }
    for (const [v, sheets] of Object.entries(byVal)) {
      const fams = [...new Set(sheets.map(s => FAM_OF[s]))];
      if (fams.length < 2) continue;
      // 관측 칸이 **적은** 계열을 복사본으로 본다(원본이 있는 쪽에 칸이 더 모여 있다).
      // 동수면 앵커 순서가 **뒤인** 쪽이 진다 — 그래서 indexOf 는 b−a 로 내림차순이다.
      const loser = fams.slice().sort((a, b) =>
        (cnt[a] - cnt[b]) || (ANCHOR_ORDER.indexOf(b) - ANCHOR_ORDER.indexOf(a)))[0];
      for (const sid of sheets) if (FAM_OF[sid] === loser)
        out.push({ paperId, value: +v, sheets, families: fams, drop: sid });
    }
  }
  return out;
}

// ── N5~N8 평량 축 ───────────────────────────────────────────────────
/** 지종 id → 계열. **숫자를 뺀 것**이다 — AB250L·ABL270·AB295L·ABL325 → "ABL",
 *  AB270 → "AB", DSDM308 → "DSDM". 33지종 전부 이 규약을 따른다(papers.mjs).
 *  ⚠ 새 지종 id 를 지을 때 이 규약을 깨면 평량 축이 조용히 틀린다. */
export const seriesOf = id => String(id).replace(/\d/g, "");
/** 지종 id → 평량(g). id 안의 첫 숫자 덩어리. */
export const gsmOf = id => Number(String(id).match(/\d+/)?.[0] || 0);

/** N6 비례 게이트 — 평량당 원/R 산포가 이 안이면 「비례한다」고 본다. */
export const GSM_TOL = 0.02;

/**
 * N5~N8 탐지기 — 관측이 하나도 없는 지종의 원/R 을 **같은 계열의 다른 평량**에서 잰다.
 * crossFamilyDupes 와 같은 성격이다: 손으로 적은 명단이 아니라 **규칙**이라
 * 표가 바뀌면 답도 따라 바뀐다. 다음 사람이 언제든 다시 돌려 보면 된다.
 *
 * @returns {{paperId, fam, sheet, v, via:"비례"|"보간", from:Array<{gsm,v,sid}>,
 *            spread:number, blocked:string[]}|null}  못 재면 null (지어내지 않는다)
 */
// ★★ 26-09-18 — **papers.mjs 에 id 한 줄을 더하는 것이 곧 「추정 단가를 만드는 스위치」다.**
//   gsmDerive 는 PRICE_TABLE 에 줄이 통째로 없는 지종만 돈다 ⟹ 지금 실제 파생은 IV350·IV400 둘뿐이다.
//   그런데 N8② 는 **단조만** 본다. 이 파일 머리말이 스스로 「비례는 계열의 성질이 아니라 **구간**의
//   성질 — 295g 언저리에서 꺾인다」고 적어 뒀는데, N7 에는 **구간 게이트가 없다.**
//   그래서 누가 papers.mjs 에 `ABL280` 한 줄을 넣으면 N7 이 250↔295 를 **가로질러** 보간해
//   277,812(평량당 992.2)을 태연히 만든다 — 그 구간은 꺾이는 자리라 믿을 수 없는 수다.
//   ⟹ 새 지종 id 를 더할 때는 **그 평량이 형제들과 같은 구간인지** 먼저 보라.
//     (지금 깨진 것은 아니다. 다음 사람 몫으로 남긴다.)
export function gsmDerive(paperId, table = PRICE_TABLE) {
  const ser = seriesOf(paperId), g = gsmOf(paperId);
  const blocked = [];
  if (!ser || !g) return null;

  // ① 같은 계열의 형제 관측을 **원지계열별로** 모은다 (N5 — 판형 환산을 안 섞는다)
  //    같은 평량·같은 원지계열에 칸이 여럿이면 최댓값 하나 (N1 과 같은 손질)
  const byFam = {};
  for (const [pid, row] of Object.entries(table)) {
    if (pid === paperId || seriesOf(pid) !== ser) continue;
    const gs = gsmOf(pid); if (!gs) continue;
    for (const [sid, v] of Object.entries(row)) {
      const f = FAM_OF[sid]; if (!f || !(v > 0)) continue;
      const cur = (byFam[f] ||= {});
      if (!(gs in cur) || v > cur[gs].v) cur[gs] = { v, sid };
    }
  }

  // ② 앵커 순서대로 자격을 본다 (N2 와 **같은 순서** — 축이 둘이라고 순서를 둘로 두지 않는다)
  for (const fam of ANCHOR_ORDER) {
    const pts = Object.entries(byFam[fam] || {})
      .map(([gs, o]) => ({ gsm: +gs, v: o.v, sid: o.sid }))
      .sort((a, b) => a.gsm - b.gsm);
    if (pts.length < 2) { if (pts.length) blocked.push(`${fam}: 평량 관측 1개 (N8③)`); continue; }

    let mono = true;
    for (let i = 1; i < pts.length; i++) if (pts[i].v <= pts[i - 1].v) mono = false;
    if (!mono) { blocked.push(`${fam}: 단조 파탄 (N8②)`); continue; }

    // N8① 외삽 금지 — 관측 평량 바깥이면 이 계열로는 못 만든다.
    if (g < pts[0].gsm || g > pts[pts.length - 1].gsm) {
      blocked.push(`${fam}: ${g}g 이 관측 ${pts[0].gsm}~${pts[pts.length - 1].gsm}g 밖 (N8①)`);
      continue;
    }

    const per = pts.map(p => p.v / p.gsm);
    const spread = Math.max(...per) / Math.min(...per) - 1;
    if (spread <= GSM_TOL)                                   // N6 비례
      return { paperId, fam, sheet: pts[0].sid, via: "비례", from: pts, spread, blocked,
               v: Math.round(Math.max(...per) * g) };        //   C3 — 못 가르면 비싼 쪽

    const lo = [...pts].reverse().find(p => p.gsm <= g);      // N7 보간
    const hi = pts.find(p => p.gsm >= g);
    if (!lo || !hi || lo.gsm === hi.gsm) continue;            // (관측 평량과 같으면 ④ 가 막는다)
    return { paperId, fam, sheet: lo.sid, via: "보간", from: [lo, hi], spread, blocked,
             v: Math.round(lo.v + (g - lo.gsm) / (hi.gsm - lo.gsm) * (hi.v - lo.v)) };
  }
  return null;
}

// ── 파생 테이블 계산 (import 시점에 한 번) ──────────────────────────
/** @type {Object<string, Object<string, {v:number, basis:"obs"|"fam"|"ratio"|"gsm",
 *          raw:number, fam:string, anchorFam:string, anchorSheet:string}>>} */
export const EFFECTIVE = {};

{
  const dropped = new Set(crossFamilyDupes().map(d => `${d.paperId}.${d.drop}`));

  for (const [paperId, row] of Object.entries(PRICE_TABLE)) {
    // ① 계열별 **유효** 관측 모으기 (N3 로 자격을 잃은 칸은 여기서 빠진다)
    const obs = {}, obsSheet = {};
    for (const [sid, v] of Object.entries(row)) {
      const f = FAM_OF[sid];
      if (!f || !(v > 0)) continue;                       // custom · 0 은 제외
      if (dropped.has(`${paperId}.${sid}`)) continue;      // N3
      if (!(f in obs) || v > obs[f]) { obs[f] = v; obsSheet[f] = sid; }   // N1: 계열 최댓값
    }

    // ② 앵커 — 순서대로 관측이 있는 첫 계열 (N2)
    const anchorFam = ANCHOR_ORDER.find(f => obs[f] != null);
    const cells = {};
    EFFECTIVE[paperId] = cells;

    // custom(주문생산)은 원지계열이 없다 — 표값 그대로 통과시킨다.
    // ⚠ 안 거르면 FAM_OF 에 없어 NaN 이 나간다(AB270 이 실제로 "custom":271750 을 들고 있다).
    //   ⚠ 앵커 검사보다 **먼저** 해야 한다. 관측이 custom 뿐인 지종이 들어오면
    //     아래 continue 에 걸려 값이 통째로 사라진다.
    if (row.custom > 0)
      cells.custom = { v: row.custom, basis: "obs", raw: row.custom,
                       fam: "주문", anchorFam: anchorFam || "주문",
                       anchorSheet: obsSheet[anchorFam] || "custom", famSheet: "custom" };

    if (!anchorFam) continue;                             // 관측이 custom 뿐인 지종
    const aN = obs[anchorFam] * K(anchorFam);             // 사륙 기준 앵커값

    // ③ 칸마다 값을 정한다
    for (const sid of Object.keys(FAM_OF)) {
      const f   = FAM_OF[sid];
      const raw = row[sid] > 0 ? row[sid] : 0;
      let v, basis;
      if (obs[f] != null) {
        v = obs[f];                                       // N1 계열 항등
        basis = raw === v ? "obs" : "fam";
      } else {
        v = Math.round(aN / K(f));                        // N2 계열 환산
        basis = "ratio";
      }
      // N4 하향 금지 — 표에 적힌 값 아래로는 절대 안 내려간다.
      if (raw > v) { v = raw; basis = "obs"; }
      // famSheet = **그 칸과 같은 계열**에서 값을 준 판형. anchorSheet 와 다를 수 있다
      // (ALK325 하4 는 값을 하2 에서 받지만 앵커는 사륙 4x62 다). 화면이 근거를 적을 때
      // 둘을 섞으면 「4×62 실측가로 정합 · 같은 하드롱 원지」 같은 거짓말이 나간다.
      cells[sid] = { v, basis, raw, fam: f, anchorFam,
                     anchorSheet: obsSheet[anchorFam], famSheet: obsSheet[f] || null };
    }
  }
}

// ── N5~N8 평량 파생 — PRICE_TABLE 에 줄이 **통째로 없는** 지종만 ──────────
//  ⚠ 여기서 채우는 지종은 견적서가 **한 장도 없다.** 그래서
//    · raw 는 전 칸 0 이다 ⟹ confirmed=false ⟹ EST_PRICE_PENALTY(3%)가 그대로 걸리고
//      드롭다운도 회색이다. 「칸이 있다」는 사실을 이 추정이 만들어 내면 안 된다.
//    · basis 는 **"gsm"** — 화면이 4단째 배지(⚠평량)를 찍는 축이다(process/paper.mjs).
//  ⚠ 관측이 있는 지종은 EFFECTIVE 에 이미 줄이 있어 여기서 **건너뛴다**(N8④).
//    추정이 관측을 덮는 일은 이 파일에 없다.
/** 평량 파생이 실제로 만든 지종 — 근거를 화면·검수대가 읽는다. @type {Object<string,object>} */
export const GSM_DERIVED = {};
/** 평량 파생 지종의 **관측 대용 한 줄** — paper-repo 의 주문생산(custom) 잔여 경로가 쓴다.
 *  그 경로는 PRICE_TABLE 을 직접 읽는데, 이 지종들은 거기 줄이 없어 noData 로 떨어진다. */
export const GSM_ROW = {};
for (const p of PAPERS) {
  if (EFFECTIVE[p.id]) continue;                       // N8④
  const d = gsmDerive(p.id);
  if (!d) continue;                                    // 못 재면 그대로 둔다 — 지어내지 않는다
  GSM_DERIVED[p.id] = d;
  GSM_ROW[p.id] = { [d.sheet]: d.v };
  const aN = d.v * K(d.fam);                           // 사륙 기준 (N2 와 같은 식)
  const cells = {};
  for (const sid of Object.keys(FAM_OF)) {
    const f = FAM_OF[sid];
    cells[sid] = {
      v: f === d.fam ? d.v : Math.round(aN / K(f)),
      basis: "gsm", raw: 0, fam: f,
      // 앵커는 **평량을 잰 그 칸**이다. 화면이 「무엇에서 어떻게 왔는지」를 적을 때
      // 이 둘과 gsm.from 을 같이 읽는다(PaperPanel).
      anchorFam: d.fam, anchorSheet: d.sheet, famSheet: null, gsm: d,
    };
  }
  EFFECTIVE[p.id] = cells;
}

/** 정합 적용 후 단가 조회. 표에 없는 지종이면 null. */
export const lookup = (paperId, sheetId) => EFFECTIVE[paperId]?.[sheetId] || null;

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
import { PRICE_TABLE } from "./paper-prices.mjs";
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

// ── 파생 테이블 계산 (import 시점에 한 번) ──────────────────────────
/** @type {Object<string, Object<string, {v:number, basis:"obs"|"fam"|"ratio",
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

/** 정합 적용 후 단가 조회. 표에 없는 지종이면 null. */
export const lookup = (paperId, sheetId) => EFFECTIVE[paperId]?.[sheetId] || null;

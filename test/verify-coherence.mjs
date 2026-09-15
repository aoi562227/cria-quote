// ══════════════════════════════════════════════════════════════════
//  verify-coherence.mjs — 원지 정합 규칙 N1~N4 의 감시자
//
//  ★ 이 파일이 없으면 정합 변경은 **무방비다.** 16개 스위트가 전부 초록인 채로
//    전 견적이 ±20% 움직일 수 있다. 실제로 그렇다 —
//      · verify-total 26건은 전부 `paperPricePerR` 를 override 로 못 박아
//        **단가표를 아예 안 읽는다.** 26/26 이 그대로인 것은 합격이 아니라 침묵이다.
//      · verify-speclink §B(★절대선)는 sheetId:"4x62" **고정**이라 한 칸만 본다.
//      · verify-print §D 는 페널티 게이트지 정합 게이트가 아니다.
//    (speclink 머리말이 「58/58 초록인 채로 critical 이 살아 있었다」고 적은 것과
//     같은 구조다. 그래서 규칙을 세운 커밋에서 게이트를 같이 넣는다.)
// ══════════════════════════════════════════════════════════════════
import { EFFECTIVE, crossFamilyDupes, MOTHER, K, FAM_OF, ANCHOR_ORDER }
  from "../src/domain/data/paper-coherence.mjs";
import { PRICE_TABLE } from "../src/domain/data/paper-prices.mjs";
import { BASE_SHEETS } from "../src/domain/data/sheets.mjs";
import { getPaperPriceInfo, paperSheetConfirmed } from "../src/domain/paper-repo.mjs";
import { buildQuote } from "../src/domain/quote.mjs";

let pass = 0, fail = 0;
const ok = (name, cond, detail = "") => {
  if (cond) { pass++; console.log("✅ " + name); }
  else { fail++; console.log("❌ " + name); if (detail) console.log("     " + detail); }
};
const SHEETS = BASE_SHEETS.filter(s => !s.custom).map(s => s.id);
const PAPERS_ = Object.keys(PRICE_TABLE);

console.log("═══ §1  원지 면적 — 정본은 전지(cut:1) 칸이다 ═══════════════════════════");
// ⚠ 절수 칸(788×545 등)에서 역산하면 1091/2=545.5→545, 889/2=444.5→444 반올림 탓에
//   ±0.19% 가 들어와 표가 스스로 정합하지 못한다. 그 잔차를 여기서 계량해 못 박는다.
ok(`원지 면적 3계열 — 사륙 ${MOTHER["사륙"].toLocaleString()} · 국전 ${MOTHER["국전"].toLocaleString()}` +
   ` · 하드롱 ${MOTHER["하드롱"].toLocaleString()}`,
   MOTHER["사륙"] === 788 * 1091 && MOTHER["국전"] === 636 * 939 && MOTHER["하드롱"] === 889 * 1194);
{
  // 이빨: 절수 칸으로 역산하면 실제로 어긋난다는 것을 보인다(안 어긋나면 위 줄이 무의미하다)
  const worst = Math.max(...BASE_SHEETS.filter(s => !s.custom).map(s =>
    Math.abs(s.w * s.h * s.cut / MOTHER[s.family] - 1)));
  ok(`이빨: 절수 치수로 역산하면 최대 ${(worst * 100).toFixed(3)}% 어긋난다 (그래서 전지를 쓴다)`,
     worst > 0.001, `최대 잔차 ${(worst * 100).toFixed(4)}%`);
}

console.log("\n═══ §2  N1 계열 항등 — 같은 원지계열은 같은 원/R ════════════════════════");
// 1R = 500 × 절수 = 원지 500장. 절수가 달라도 1R 이 같은 원지량이므로 원/R 이 같아야 한다.
// ★ 사용자가 지적한 증상이 바로 이것이다 —
//   「같은 국판이나 46판인데도 2절보다 4절이 비싸고 …」
{
  const bad = [];
  for (const p of PAPERS_) {
    const byFam = {};
    for (const s of SHEETS) (byFam[FAM_OF[s]] ||= []).push(getPaperPriceInfo(p, s, "", null).price);
    for (const [f, vals] of Object.entries(byFam))
      if (new Set(vals).size > 1) bad.push(`${p}·${f}: ${[...new Set(vals)].join("/")}`);
  }
  ok(`★ 31지종 × 3계열 — 계열 안에서 원/R 이 갈리는 곳 ${bad.length}곳 (0 이어야 한다)`,
     bad.length === 0, bad.slice(0, 8).join("\n     "));
}
{
  // 이빨: 정합 **전** 표에는 실제로 그 증상이 있었다. 0 이면 이 절이 없는 것을 재고 있다.
  const was = [];
  for (const p of PAPERS_) {
    const byFam = {};
    for (const [s, v] of Object.entries(PRICE_TABLE[p])) if (FAM_OF[s]) (byFam[FAM_OF[s]] ||= []).push(v);
    for (const [f, vals] of Object.entries(byFam)) if (new Set(vals).size > 1) was.push(`${p}·${f}`);
  }
  ok(`이빨: 원표에는 그 증상이 실재한다 (${was.length}곳 — ${was.join(" ")})`, was.length >= 3);
}

console.log("\n═══ §3  N3 계열중복 무효 — 손 명단이 아니라 탐지 규칙이다 ═══════════════");
// 같은 지종에서 두 계열에 똑같은 수가 박혀 있으면 면적비상 둘 다 진짜일 수 없다(계수 0.81/1.44).
{
  const d = crossFamilyDupes();
  const sig = d.map(x => `${x.paperId}.${x.drop}(${x.value})`).sort().join(" ");
  ok(`탐지 ${d.length}건 — ${sig}`, d.length === 2
     && sig === "AB295L.ha4(300747) MK350.ha4(743200)",
     `실제: ${sig}`);
  // 두 건 모두 채굴 853레코드가 독립으로 뒷받침한다:
  //   AB295L 300,747 은 7건 전부 **사륙**(라로제 4×62 / 스쿨380 4×64 / 카타치 4×63) — 하드롱 0건
  //   MK350  743,200 은 4건 전부 **4×62**(데카르트 25-04) — 하드롱 0건
  ok("탐지된 칸은 둘 다 하드롱이다 (사륙 값이 하드롱 칸에 복사된 모양)",
     d.every(x => FAM_OF[x.drop] === "하드롱"));
  // 이빨: 규칙이 실제로 값을 움직여야 한다. 안 움직이면 죽은 절이다.
  ok("이빨: 무효 처리된 칸은 실제로 다시 채워진다",
     d.every(x => getPaperPriceInfo(x.paperId, x.drop, "", null).price !== x.value));
}

console.log("\n═══ §4  N4 하향 금지 — 표에 적힌 값 아래로는 안 내려간다 ═══════════════");
// 관측은 「실제로 그 값에 팔았다」는 사실이다. 근거 반반인 모델로 그 아래를 깎는 건
// 회사가 손해 보는 방향이다 (GLUE_MIN_LOT 선례 · C3).
//
// ⚠ 정직하게 적는다 — **오늘 데이터에서 N4 의 max() 는 한 번도 안 걸린다.**
//   「안 내려간다」는 성질은 N1 이 계열 **최댓값**을 고르는 데서 이미 나온다.
//   그래도 N4 를 규칙으로 두는 이유는 **닿을 수 있는 경우**가 있기 때문이다:
//   사륙 값이 **국전** 칸에 복사돼 N3 가 그 칸의 자격을 뺏으면, 국전 환산값은
//   앵커 × 0.6947 이라 복사된 원값보다 **작다** — 그때 N4 가 유일한 방어선이다.
//   (이 저장소는 그 모양을 이미 한 번 봤다: AB295L guk2 316,355 는 하드롱 값이
//    국2 줄에 섞인 판형 오기였다. paper-prices.mjs 충돌 판정 ② 참조.)
//   ⟹ 이 절은 지금 「슬랙」이지만, 규칙을 바꾸면(예: N1 을 중앙값으로) 즉시 빨개진다.
{
  const below = [];
  for (const p of PAPERS_) for (const s of SHEETS) {
    const raw = PRICE_TABLE[p][s] || 0;
    if (raw > 0 && getPaperPriceInfo(p, s, "", null).price < raw)
      below.push(`${p}.${s} ${raw}→${getPaperPriceInfo(p, s, "", null).price}`);
  }
  ok(`★ 관측 56칸 중 값이 내려간 칸 ${below.length}곳 (0 이어야 한다)`,
     below.length === 0, below.join("\n     "));
}

console.log("\n═══ §5  전 조합 건전성 — NaN · noData · custom ══════════════════════════");
{
  let nan = 0, noData = 0;
  for (const p of PAPERS_) for (const s of SHEETS) {
    const i = getPaperPriceInfo(p, s, "", null);
    if (!Number.isFinite(i.price) || i.price <= 0) nan++;
    if (i.noData) noData++;
  }
  ok(`지종 ${PAPERS_.length} × 판형 ${SHEETS.length} = ${PAPERS_.length * SHEETS.length}칸 — ` +
     `NaN/0원 ${nan} · noData ${noData}`, nan === 0 && noData === 0);
  // ⚠ custom(주문생산)은 원지계열이 없다. 안 거르면 NaN 이 합의값을 먹는다 —
  //   AB270 이 실제로 "custom":271750 을 들고 있어서 이 줄이 빈 줄이 아니다.
  ok(`custom 은 표값 그대로 통과한다 (AB270 ${getPaperPriceInfo("AB270", "custom", "", null).price})`,
     getPaperPriceInfo("AB270", "custom", "", null).price === PRICE_TABLE.AB270.custom);
  ok("custom 은 어느 원지계열에도 안 들어간다", FAM_OF.custom === undefined);
}

console.log("\n═══ §6  ★★ 절대선 — AB295L 4×62 = 318,438 (개당 204원) ═══════════════");
// 왜 이 칸이 규칙의 **고정점**인가:
//   AB295L 사륙 세 칸은 4x62 318,438 · 4x63 300,747 · 4x64 283,056 이고,
//   N1 은 「계열 최댓값」을 고르므로 앵커가 **4x62 자신**이다. N4 가 그 아래를 막는다.
//   ⟹ 데이터 운이 아니라 **규칙상** 안 움직인다. 위험방향 규율(비싼 쪽)과 같은 칸을 가리킨다.
// ⚠ 반대로 「계열 정규화값이 가장 비싼 계열을 앵커로」 골랐다면 AB295L 앵커는 국2 가 되고
//   4x62 가 433,145(+36%)로 튀어 204원이 즉시 깨진다. ANCHOR_ORDER 를 손대지 마라.
{
  ok(`★ AB295L 4x62 = ${getPaperPriceInfo("AB295L", "4x62", "", null).price.toLocaleString()}`,
     getPaperPriceInfo("AB295L", "4x62", "", null).price === 318438);
  ok("★ 그 칸의 근거는 obs (정합이 손대지 않았다)",
     getPaperPriceInfo("AB295L", "4x62", "", null).basis === "obs");
  ok(`★ 앵커 순서는 사륙 먼저다 (${ANCHOR_ORDER.join(" → ")})`, ANCHOR_ORDER[0] === "사륙");
  // 이빨: 국전을 앵커로 쓰면 실제로 절대선이 깨진다는 것을 계량해 둔다.
  const gukAnchored = Math.round(PRICE_TABLE.AB295L.guk2 * K("국전") / K("사륙"));
  ok(`이빨: 국2 를 앵커로 삼으면 4x62 가 ${gukAnchored.toLocaleString()} 로 튄다 (+` +
     `${((gukAnchored / 318438 - 1) * 100).toFixed(1)}%) — 그래서 국전이 맨 뒤다`,
     gukAnchored > 318438 * 1.3);
}

console.log("\n═══ §7  ★★ 차선 분리 — 청구는 랭킹 단가를 타지 않는다 ═══════════════════");
// quote.mjs buildContext 는 청구 단가를 `getPaperPriceInfo` 를 **다시 불러서** 만든다.
// findBestSheet 가 pool 에 실어 준 price/cost 는 청구에 안 쓰인다.
// ⚠ 누가 이걸 「중복 호출이다」라며 sheet.price 재사용으로 바꾸면 두 차선이 **합쳐지고**
//   랭킹 쪽 변경이 청구로 샌다. 조용히 깨진다 — §B 는 sheetId 고정이라 못 잡는다.
//   그래서 그 사실 자체를 여기서 잰다.
{
  const src = await import("node:fs").then(fs =>
    fs.readFileSync(new URL("../src/domain/quote.mjs", import.meta.url), "utf8"));
  const ctx = src.slice(src.indexOf("const paperInfo"), src.indexOf("const paperInfo") + 400);
  ok("buildContext 가 청구 단가를 getPaperPriceInfo 로 **다시 부른다**",
     /getPaperPriceInfo\(\s*paperCfg\.paperId/.test(ctx), ctx.slice(0, 200));
  ok("이빨: 그 자리에서 sheet.price 를 재사용하지 않는다 (두 차선이 갈려 있다)",
     !/paperInfo[\s\S]{0,200}sheet\.price/.test(ctx));
}

console.log("\n═══ §8  ★ 소스코 실물 — 개당 204원 · 공정합계 814,969원 ═══════════════");
// speclink §B 와 같은 사양을 판형 **auto** 로도 돌린다. §B 는 4x62 고정이라
// 랭킹 경로를 원리적으로 안 타기 때문이다 — auto 줄이 있어야 랭킹까지 덮인다.
{
  const inp = {
    box: { mode: "box", structure: "glue_3side", W: 140, D: 43, H: 130, hangTab: 0 },
    qty: 4000,
    paper: { paperId: "AB295L", sheetId: "auto" },
    print: { front: { color: true, spot: 0, black: false, uv: false },
             back:  { color: false, spot: 0, black: false, uv: false }, beda: false },
    finish: { coatFrontId: "ir", coatBackId: "none", thomsonId: "s", glueId: "dan" },
  };
  const q = buildQuote(inp);
  ok(`★ auto 로도 4x62 · 4up 을 고른다 — ${q?.sheet?.id} ${q?.sheet?.up}up`,
     q?.sheet?.id === "4x62" && q?.sheet?.up === 4, JSON.stringify(q?.sheet?.id));
  ok(`★ 청구 지대단가 318,438 — ${q?.paperPrice?.pricePerR?.toLocaleString()}`,
     q?.paperPrice?.pricePerR === 318438);
}

console.log("\n═══ §9  근거 표시 3단이 실제로 다 나온다 ════════════════════════════════");
// 화면이 obs / fam / ratio 를 구별해 적을 수 있어야 한다. 한 종류라도 0 이면 표시가 죽는다.
{
  const c = { obs: 0, fam: 0, ratio: 0 };
  for (const p of PAPERS_) for (const s of SHEETS) c[EFFECTIVE[p][s].basis]++;
  ok(`basis 분포 — obs ${c.obs} · fam ${c.fam} · ratio ${c.ratio}`,
     c.obs > 0 && c.fam > 0 && c.ratio > 0);
  // confirmed 는 **뜻이 안 바뀌었다** — 「그 칸에 견적서가 있다」. EST_PRICE_PENALTY 가
  // 걸리는 범위가 종전과 한 칸도 다르면 안 된다(그러면 판형 선택 성향이 같이 움직인다).
  const mism = [];
  for (const p of PAPERS_) for (const s of SHEETS) {
    const want = PRICE_TABLE[p][s] > 0;
    if (getPaperPriceInfo(p, s, "", null).confirmed !== want) mism.push(`${p}.${s}`);
    if (paperSheetConfirmed(p, s) !== want) mism.push(`dropdown ${p}.${s}`);
  }
  ok(`★ confirmed 집합이 원표와 정확히 같다 (어긋난 칸 ${mism.length})`,
     mism.length === 0, mism.slice(0, 10).join(" "));
}

console.log("\n═══ §9b  N3 칸은 화면에서 «환산» 으로 나가야 한다 ═══════════════════════");
// 이 두 칸은 견적서가 **있다**(confirmed=true, 페널티 축은 종전대로). 그런데 그 수가
// 다른 계열에서 복사된 것이라 **값은 환산**이다. 표시를 confirmed 로 찍으면 아무 표시
// 없이 나가서 조용히 틀린다 — 그래서 markOf 는 basis 를 따른다.
{
  const { markOf } = await import("../src/domain/process/paper.mjs");
  const n3 = crossFamilyDupes();
  const bad = n3.filter(d => {
    const i = getPaperPriceInfo(d.paperId, d.drop, "", null);
    return !(i.confirmed === true && i.basis === "ratio" && markOf(i) === " ⚠환산");
  });
  ok(`N3 칸 ${n3.length}개 — confirmed=true 인데 표시는 «⚠환산» (어긋난 칸 ${bad.length})`,
     bad.length === 0, bad.map(d => `${d.paperId}.${d.drop}`).join(" "));
  // 세 표시가 실제로 다 나온다
  const marks = new Set();
  for (const p of PAPERS_) for (const s of SHEETS) marks.add(markOf(getPaperPriceInfo(p, s, "", null)));
  ok(`표시 3종이 전부 나온다 — ${[...marks].map(m => `«${m.trim() || "(없음)"}»`).join(" ")}`,
     marks.has("") && marks.has(" 계열환산") && marks.has(" ⚠환산"));
}

console.log("\n═══ §10  근거 출처가 화면에서 거짓말하지 않는가 ══════════════════════════");
// basis "fam" 은 **같은 계열**의 칸에서 값을 받았다. 화면이 anchorSheet(앵커 계열)를
// 적으면 「4×62 실측가로 정합 · 같은 하드롱 원지」처럼 계열이 어긋난 문장이 나간다.
// PaperPanel 이 famSheet 를 쓰는 근거가 이 절이다.
{
  const bad = [];
  for (const p of PAPERS_) for (const s of SHEETS) {
    const e = EFFECTIVE[p][s];
    if (e.basis === "fam" && FAM_OF[e.famSheet] !== e.fam) bad.push(`${p}.${s} famSheet=${e.famSheet}`);
    if (e.basis === "ratio" && e.famSheet !== null) bad.push(`${p}.${s} ratio 인데 famSheet 가 있다`);
  }
  ok(`fam 칸의 출처가 전부 같은 계열이다 (어긋난 칸 ${bad.length})`, bad.length === 0,
     bad.slice(0, 6).join(" "));
  // 이빨: anchorSheet 와 famSheet 가 **다른** 칸이 실재해야 이 절이 의미가 있다
  const diff = [];
  for (const p of PAPERS_) for (const s of SHEETS) {
    const e = EFFECTIVE[p][s];
    if (e.basis === "fam" && e.famSheet !== e.anchorSheet) diff.push(`${p}.${s}`);
  }
  ok(`이빨: 둘이 다른 칸이 실재한다 (${diff.length}칸 — 예 ${diff.slice(0, 3).join(" ")})`,
     diff.length > 0);
}

console.log("\n" + "=".repeat(78));
console.log(`원지 정합 N1~N4: ${pass}/${pass + fail}`);
if (fail) process.exitCode = 1;

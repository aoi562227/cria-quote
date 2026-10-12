// ══════════════════════════════════════════════════════════════════
//  verify-corpus.mjs — 전 코퍼스 검수대 (26-09-15)
//
//  왜 이 파일이 있나
//  ────────────────
//  test/verify-total.mjs 는 손으로 고른 **26건**만 본다. 그런데 회사 폴더 견적서
//  529장에서 캔 **853레코드**가 있다. 더 나쁜 것은 verify-total 의 `inputOf` 가
//  케이스마다 printUnit·sobooUnit·coat·thom·glueEa·admin·paperR·lossManual 을
//  **전부 overrides 로 주입**한다는 점이다 — 그래서 단가표를 아무 값으로 바꿔도
//  26건이 전부 초록이다. 그 스위트는 「산식이 견적서와 맞는가」를 재고 있고
//  「우리 단가표가 맞는가」는 **한 건도 재지 않는다.**
//
//  이 검수대는 반대다. 문서에서 받는 것은 **사양**뿐이고 **값은 전부 우리 표**다.
//    A 트랙 — 협력사 원가 견적(크리아 PNG). up·판형·지종·수량·도수만 받고
//             지대단가·소부·인쇄·코팅·톰슨·접착·관리비는 우리 표로 계산해 줄별 대조.
//    B 트랙 — 자사 견적서(PDF). **치수·지종·수량·사양만** 받고 전개도→판걸이→R→
//             줄→합계→개당 전 사슬을 우리가 낸 뒤 문서의 원가개당과 대조.
//    C 트랙 — 여분·지대R 진단(문서가 적어 둔 값과 우리 추정).
//
//  ★ 조용히 거르지 않는다. 사양이 모자라 못 돌린 건은 **이유별로 세어 찍는다.**
//    조용히 거르면 적중률이 부풀려진다 — 이 저장소가 반복해서 데인 자리다.
//    (지대는 채점하고 인쇄만 못 채점하는 건이 정상이다. 그래서 **줄마다 분모가 다르다.**)
//
//  ★ 가정에는 표를 붙인다. 코팅 종류·인쇄 도수구성·접착 종류는 문서가 자주 안 적는다.
//    그 줄은 「확정」과 「가정」을 **따로 센다** — 합쳐서 한 숫자로 내면 거짓말이 된다.
//
//  오라클 없는 환경(CI)
//  ──────────────────
//  quotes.json 은 스크래치패드에 있고 저장소에 없다(docs/ 는 .gitignore 대상).
//  없으면 **크게 찍고 건너뛴다** — test/oracle-path.mjs 가 이미 세운 방식이다.
//  경로는 CRIA_CORPUS 로 덮을 수 있고, 없으면 임시폴더 아래에서 파일명으로 찾는다.
//  찾았으면 「어디서 찾았다」를 찍는다(낡은 경로가 소스에 박히지 않게).
//
//  쓰는 법
//    node test/verify-corpus.mjs              전체
//    node test/verify-corpus.mjs --top 30     크게 틀리는 건 30개까지
//    node test/verify-corpus.mjs --dump x.json 건별 결과를 JSON 으로
//    CRIA_CORPUS=D:/q.json node test/verify-corpus.mjs
// ══════════════════════════════════════════════════════════════════
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { buildQuote } from "../src/domain/quote.mjs";

const ARG = process.argv.slice(2);
const argOf = (k, d) => { const i = ARG.indexOf(k); return i >= 0 ? ARG[i + 1] : d; };
const TOPN = Number(argOf("--top", 12));
const DUMP = argOf("--dump", null);

// ─────────────────────────────────────────────────────────────────
//  0. 오라클 찾기
// ─────────────────────────────────────────────────────────────────
const NAME = "quotes.json";
/** 임시폴더 아래를 이 깊이까지만 본다. claude/<해시>/<세션>/scratchpad/quotes.json = 4 단. */
const MAX_DEPTH = 5;

function search(root, depth = 0) {
  if (depth > MAX_DEPTH) return [];
  let ents;
  try { ents = readdirSync(root, { withFileTypes: true }); } catch { return []; }
  const out = [];
  for (const e of ents) if (e.isFile() && e.name === NAME) out.push(join(root, e.name));
  for (const e of ents) {
    if (!e.isDirectory() || /^(node_modules|\.git)$/i.test(e.name)) continue;
    out.push(...search(join(root, e.name), depth + 1));
  }
  return out;
}

function findCorpus() {
  if (process.env.CRIA_CORPUS)
    return existsSync(process.env.CRIA_CORPUS)
      ? { path: process.env.CRIA_CORPUS, how: "CRIA_CORPUS 환경변수" }
      : { path: null, how: `CRIA_CORPUS 가 가리키는 파일이 없다: ${process.env.CRIA_CORPUS}` };
  const near = [
    new URL("../docs/quotes.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
    new URL("../quotes.json", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
  ];
  for (const p of near) if (existsSync(p)) return { path: p, how: "저장소 옆" };
  // 스크래치패드는 세션마다 경로가 달라진다 — 박아 두면 다음 세션에 바로 늙는다.
  const hits = search(join(tmpdir(), "claude"));
  if (!hits.length) return { path: null, how: "임시폴더에서도 못 찾음" };
  hits.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return { path: hits[0], how: `임시폴더에서 파일명으로 찾음 (후보 ${hits.length}개 중 최신)` };
}

const FOUND = findCorpus();
if (!FOUND.path) {
  console.log("");
  console.log("╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║  전 코퍼스 검수대 — ⏭  건너뛴다.  오라클(quotes.json)이 없다.        ║");
  console.log("╚══════════════════════════════════════════════════════════════════════╝");
  console.log(`  이유: ${FOUND.how}`);
  console.log("  quotes.json 은 회사 견적서 529장에서 캔 853레코드로, 저장소에 없다");
  console.log("  (고객사 자료 · docs/ 는 .gitignore 대상).");
  console.log("  재현하려면: CRIA_CORPUS=<quotes.json 경로> node test/verify-corpus.mjs");
  console.log("  ⚠ 초록이 아니다. **아무것도 검증하지 않았다.**");
  console.log("");
  process.exit(0);
}

const RAW = JSON.parse(readFileSync(FOUND.path, "utf8"));
const RECS = RAW["건"] || [];

// ─────────────────────────────────────────────────────────────────
//  1. 사양 대응표 — 코퍼스 표기 → 저장소 id
//     ⚠ 여기서 **값을 지어내지 않는다.** 대응이 없으면 unmapped 로 세서 찍는다.
//        찍힌 목록이 다음 사람이 표를 늘릴 자리다.
// ─────────────────────────────────────────────────────────────────
const norm = s => String(s || "").toLowerCase().replace(/\s+/g, "");

/** 지종 계열 별칭 — **긴 것부터**. 'ab라이트' 가 'ab' 보다 먼저여야 한다. */
const FAM_ALIAS = [
  [/편아트|펴아트/, "편아트"], [/아트지/, "아트지"],
  [/디프매트|dsdm/, "디프매트"], [/밍크/, "밍크지"], [/뷰티팩/, "뷰티팩"],
  [/블랙지|뉴에코블랙/, "블랙지"], [/알리킹|alk/, "알리킹"], [/마니라|mnr/, "마니라"],
  [/아코팩|arcopack|acpk/, "아코팩"], [/뉴티락|ntr/, "뉴티락"], [/뉴티팩|ntp/, "뉴티팩"],
  [/ab라이트|라이트ab|abl/, "ab라이트"], [/a라이트/, "a라이트"],
  [/ccp/, "ccp"], [/bw/, "bw"], [/sc|스노우/, "sc"], [/iv|아이보리/, "iv"],
  // ★ 26-09-17 — 「ac」를 **아코팩에서 알리킹으로** 옮겼다. 선주 답: 「ac는 알리킹 싼종이야」.
  //   바로 위 줄이 스스로 「아코팩으로 읽는 것은 **가정**이다」라고 적어 뒀고, 그 가정이 반증됐다.
  //   ⚠ 반증은 답 하나가 아니다 — 코퍼스가 아코팩을 「아코팩」 7건 · 「arcopack」 10건으로
  //     **따로** 적고(그 둘은 위 줄에서 먼저 걸린다), 단가도 2.04~3.76배 벌어진다.
  //     근거 전문과 재현 수치는 src/domain/data/paper-prices.mjs 의 ALK 판정 주석에 있다.
  //   ★ 이 한 줄이 바꾼 것: 종전엔 「300ac」 4건이 **ACPK300(544,500)** 으로 붙어 문서값
  //     154,167 에 대고 채점되고 있었다(+253%). 지금은 알리킹 300 → 표에 칸이 없어 결측이다.
  //     결측이 맞다 — 그 단가는 알리킹이 아니고(paper-prices.mjs 반증), 아코팩은 더 아니다.
  [/(^|[^a-z])ac(?![a-z])/, "알리킹"],
  [/ab/, "ab"], [/라이트/, "ab라이트"], [/(^|[^a-z])b(?![a-z])/, "b"],
];

const PAPER_BY_FAM_W = {
  // ★ 26-09-17 「ab」에 **295 를 더했다.** 선주 확인 — 「295ab = AB라이트 295g = AB295L」.
  //   바로 아래 270 선례와 **같은 모양의 구멍**이다(방향만 반대다). 표기 「295ab」에는 '라이트'
  //   글자가 없어서 FAM_ALIAS 가 'ab라이트' 가 아니라 'ab' 로 떨어뜨리는데, 이 줄에 295 칸이
  //   없어서 **협력사 PNG 8건이 통째로 「지종표에 없다」로 떨어졌다.**
  //   ⚠ 「단가가 이미 맞는다」고 읽지 마라 — 8건 중 **원 단위로 맞는 건 소스코 하나뿐**이다
  //     (26-09-17 실측. 앞 판이 이 자리에 「원 단위로 같은데도 못 붙는다」고 적었는데 **거짓이었다**):
  //       26-08-04 소스코     4×62  문서 318,438  vs 우리 318,438   **= 0.00%**  ✓
  //       25-11-21 카드패키지  4×64  문서 300,747  vs 우리 318,438   **+5.88%**  (4건)
  //       25-12-08 덴탈맥스    4×64  문서 231,140  vs 우리 318,438  **+37.77%**  (3건)
  //     우리가 세 판형에 **전부 318,438** 을 부르는 것은 정합층 때문이다 — PRICE_TABLE 의
  //     raw 는 4x63 300,747 · 4x64 283,056 이지만 N1(계열 최댓값)이 사륙 4칸을 4x62 값으로
  //     맞춘다(paper-coherence.mjs). 즉 **표의 raw 와 우리가 실제로 부르는 값은 다르다** —
  //     「PRICE_TABLE 에 그 수가 있다」를 「우리가 그 수를 부른다」로 읽지 마라. 이 자리가
  //     바로 그 오독으로 틀린 문장을 커밋할 뻔한 자리다.
  //   ⟹ 그래도 붙이는 근거는 **단가 일치가 아니라 지종 동일성**이다(선주 확인 + 위생 전수).
  //     8건 모두 레코드의 평량 필드가 295 이고 계열이 ab 이며 골판지·싸바리·합성표기 0건이다.
  //     모수를 늘려 저울에 올린 것 자체가 옳다 — 안 붙이면 8건이 **안 재어진 채로** 남는다.
  //   ★ 새로 들어온 8건만 따로 채점하면 — **거의 다 틀린다**(26-09-17 실측. 8건만 담은
  //     코퍼스를 만들어 같은 명령으로 돌렸다):
  //       공정합계 0.0% · 개당 0.0% · 관리비 0.0% · 코팅(무광가정 n=7) 0.0% · 인쇄(별색포함 n=5) 0.0%
  //       지대 12.5% · 지대단가 12.5% · 소부 12.5% · 접착 12.5% · 톰슨 62.5%
  //       반기로 가르면 한 줄로 보인다 — **지대 단가적중 25H2 0%(7건) · 26H2 100%(1건)**.
  //     ⟹ 이 8건은 성적을 **내리는** 표본이다. 붙였다고 실력이 는 것이 아니다 —
  //       전체 표의 적중률이 움직였다면 그건 **모수가 늘어서**다. ARCHITECTURE §4 의
  //       「26-09-17 새 기준표」와 비교해라(그 전 수치와 비교하면 모수가 달라 거짓말이 된다).
  //   ⚠ 295g 는 라이트만 있다 — 270 처럼 「ab 270 = AB270 / ab라이트 270 = ABL270」로 갈릴
  //     물건이 없으므로(papers.mjs 에 라이트 아닌 「AB 295g」 줄이 없다) 두 줄이 같은 id 로 가도 안전하다.
  //   ⚠ 같은 칸으로 「ab295g라이트」 2건(26-07-31 웨이크버니)도 붙는다. 그 2건은 판형코드가
  //     없어 A 트랙에서 더 앞에서 걸러지므로 **채점 수는 한 자리도 안 움직인다**(실측 확인) —
  //     그래도 붙이는 이유는 paper-prices.mjs 가 그 220,653 을 이미 AB295L 로 적어 뒀기
  //     때문이다(「판형이 안 찍혀 귀속 불가」 항). 결측 목록에 남겨 두면 다음 사람이
  //     papers.mjs 를 늘릴 자리로 오해한다.
  //
  //   ★★ 이 한 줄이 **절대선의 원천 문서를 검수대 위로 올렸다** — 그래서 드러난 것 하나.
  //     #166(26-08-04 소스코)은 ★절대선 817,969 의 그 견적서다. 전수 경로로 다시 계산하면:
  //       지대 413,969 ✓ · 소부 48,000 ✓ · 인쇄 56,000 ✓ · 코팅 40,000 ✓ · 톰슨 50,000 ✓ ·
  //       접착 80,000 ✓ · **관리비 120,000 vs 문서 130,000 (−10,000)**
  //       ⟹ 공정합계 **807,969** (문서 817,969 · **−1.22%**) · 개당 **202** (문서 204)
  //     즉 **일곱 줄 중 여섯은 자동값으로도 원 단위로 같고, 어긋나는 것은 관리비 한 줄뿐**이다.
  //     이건 고장이 아니라 **설계**다 — 관리비는 재량값이라 식이 아니라 출발점이고
  //     (process/admin.mjs 「26-09-16」), 실측은 화면의 직접입력(ov.admin)으로 들어온다.
  //     verify-speclink §B 는 그 통로로 130,000 을 주입하므로 817,969 를 낸다.
  //     ⚠ 그러니 「§B 가 초록이니 전수에서도 앵커가 재현된다」고 읽지 마라. **재현되지 않는다.**
  //       −10,000 은 우리가 **싸게** 부르는 방향이고, 그 크기를 아는 채로 두는 것이 이 기록이다.
  //       감시자는 verify-speclink §B 의 「기본 진입 관리비 = calcAdmin」 단언이다(26-09-17 신설).
  "ab":       { 270: "AB270", 295: "AB295L", 300: "AB300", 350: "AB350", 400: "AB400" },
  // ★ 26-09-16 「ab라이트」에 **270 을 더했다.** 선주 확인 — 「ab라이트 270g」과
  //   「a라이트 270」은 **같은 물건**이다(papers.mjs ABL270 주석에 근거·건수).
  //   종전에는 FAM_ALIAS 가 긴 것부터라 'ab라이트' 가 먼저 걸렸는데 이 표에 270 칸이 없어서
  //   **자사 PDF 8건이 통째로 「지종표에 없다」로 떨어졌다** — 표에 칸이 있는데도 못 붙는
  //   상태였다. 두 별칭이 같은 id 로 간다.
  "ab라이트": { 250: "AB250L", 270: "ABL270", 295: "AB295L", 325: "ABL325" },
  "a라이트":  { 270: "ABL270" },
  "아코팩":   { 300: "ACPK300", 350: "ACPK350" },
  "뉴티락":   { 300: "NTR300" }, "뉴티팩": { 350: "NTP350" },
  "ccp":      { 300: "CCP300", 350: "CCP350" },
  "sc":       { 300: "SC300", 350: "SC350", 400: "SC400" },
  "마니라":   { 300: "MNR300" },
  // ★ 26-09-17 「알리킹」에 **215·270 을 더했다.** 선주 확인 — 「ac는 알리킹 싼종이야」.
  //   위 FAM_ALIAS 의 ac 줄과 짝이다. 이 둘이 같이 가야 「215AC」·「270ac」·「알리킹 270G」가
  //   한 id 로 모인다(내부 약어와 고객용 정식명이 같은 물건이다 — paper-prices.mjs ALK 주석 ①).
  //   ⚠ **300 칸은 일부러 비워 둔다.** 「300ac」는 결측으로 떨어지는 게 맞다 — 그 문서의
  //     고객용 PDF 는 지종을 「SC 300G」라 적었고, 평량당 원/R 이 형제 세 평량에서 −34.2%
  //     어긋난다. 여기에 { 300: "SC300" } 을 적고 싶어지겠지만 그건 **별개의 판정**이다.
  //     하려면 그 한 가지만 따로 해라 — 섞으면 무엇이 성적을 움직였는지 못 가린다.
  "알리킹":   { 215: "ALK215", 270: "ALK270", 325: "ALK325" },
  "b":        { 300: "B300", 350: "B350", 400: "B400" },
  // ★ 26-09-17 「iv」에 **350·400 을 더했다.** 선주가 이름으로 지목한 두 칸이고,
  //   결측 목록에 「iv400g」 4건 · 「iv350g」 2건으로 앉아 있던 것들이다.
  //   ⚠ 이 둘은 **견적서가 한 장도 없는 지종**이다 — 값은 평량 보간(N7)이고
  //     paper-prices.mjs 에는 줄이 없다(papers.mjs IV350 주석). 그래도 여기 붙이는
  //     이유는 295ab·215AC 때와 같다: 안 붙이면 6건이 **안 재어진 채로** 남는다.
  //   ⚠ 붙이면 모수가 늘어 적중률이 저절로 움직인다. 이 6건은 판형이 안 찍혀
  //     A 트랙 앞에서 걸리므로 **채점 수는 안 움직이고 결측만 6 줄어든다**(실측).
  "iv":       { 300: "IV300", 350: "IV350", 400: "IV400", 450: "IV450" },
  "bw":       { 350: "BW350" }, "블랙지": { 350: "NEB350" },
  "디프매트": { 308: "DSDM308" }, "밍크지": { 350: "MK350" },
  "뷰티팩":   { 350: "BT350" },
  "편아트":   { 140: "ART140" }, "아트지": { 150: "ART150" },
};

/** 지종 문자열 → paperId. 못 찾으면 null. */
function paperIdOf(rec) {
  const t = norm(rec["지종정규"] || rec["지종"]);
  if (!t) return null;
  let fam = null;
  for (const [re, f] of FAM_ALIAS) if (re.test(t)) { fam = f; break; }
  if (!fam) return null;
  // 평량: 레코드가 이미 뽑아 둔 값을 먼저 믿고, 없으면 문자열에서 100~1000 을 줍는다.
  let w = Number(rec["평량"]) || 0;
  if (!w) { const m = t.match(/(\d{3})(?!\d)/); if (m) w = Number(m[1]); }
  if (!w) { const m = t.match(/(\d{2,4})/); if (m) w = Number(m[1]); }
  return PAPER_BY_FAM_W[fam]?.[w] || null;
}

// ─────────────────────────────────────────────────────────────────
//  1-b. 범위 밖 — **골판지**  (★ 26-09-16 선주 지시)
//     「sc240은 골판지라서 그냥 없애줘 골판지는 나중에 만들거야」
//
//  ⚠ 「지종표에 없다」(결측)와 **절대 같이 세지 마라.**
//     결측은 papers.mjs 를 늘릴 자리이고, 범위밖은 **늘릴 자리가 아니다.**
//     섞으면 「지종표를 늘려라」라는 잘못된 결론이 나오고 적중률의 분모도 거짓말이 된다.
//     종전에 SC240 40건(sc240g 37 + 회sc240g 3)이 바로 그렇게 섞여 있었다.
//
//  · 라이너/골 코드 — BA · KLB · KLS · SK. · WT. · BB · S.S.S · 「골」
//  · sc240  — 선주가 **골판지라고 직접 지정**했다. 코퍼스 58건 전부 자사 PDF 이고
//    지대단가 0건 · 판형 0건이라 어차피 캘 값도 없다(합성표기 「ab300g+sc240g」류 포함).
//
//  ⚠ 이 정규식이 **놓치는 골판지 후보**가 코퍼스에 아직 12건 남아 있다(26-09-16 실측).
//    지금은 일부러 안 잡는다 — 「골」도 라이너 코드도 없어서 규칙으로 못 가르고, 손으로
//    명단을 박으면 다음 채굴에 바로 늙는다. **나중에 골판지 앱을 만들 때 쓸 목록이다:**
//        e/s.wk 5 · e/wk.s 4 · b/s.k 1 (자사 PDF)  ·  e-보드350g 1 (협력사 PNG) · 보드350g 1
//    (지우지 마라. 이것들은 지금 「지종표에 없다」로 세어지고 있고, 그게 지금은 맞다 —
//     골판지라고 단정할 근거가 표기 관례뿐이라 확인 전에는 결측이 더 정직하다.)
const CORRUGATED = /골|klb|kls|sk\.|wt\.|\bbb\b|s\.s\.s|sc240/;
/** 범위밖으로 세어진 지종 표기 — 아래 출력에서 결측 목록과 **따로** 찍는다. */
const outOfScope = new Map();
function isCorrugated(rec) {
  const t = norm(rec["지종정규"] || rec["지종"]);
  if (!t || !CORRUGATED.test(t)) return false;
  outOfScope.set(rec["지종정규"] || rec["지종"], (outOfScope.get(rec["지종정규"] || rec["지종"]) || 0) + 1);
  return true;
}

const SHEET_BY_CODE = {
  "4*64": "4x64", "4*63": "4x63", "4*62": "4x62", "4*6전": "46", "4*6전지": "46",
  "국2": "guk2", "국전": "guk",
  "하4": "ha4", "하3": "ha3", "하2": "ha2", "하전": "ha", "하전지": "ha",
};

/** 구조 키워드 — **긴 것부터**. '십자조립' 이 '조립' 보다 먼저여야 한다. */
const STRUCT_KEY = [
  [/십자|크로스/, "cross"], [/삼면/, "glue_3side"],
  [/맞뚜껑|맞뚝/, "tuck_both"], [/g형|지형상자/, "gtype"],
];
/** 모델 밖 구조 — 억지로 접착식을 빌려 쓰지 않는다. 세서 찍는다. */
const STRUCT_OUT = [/싸바리/, /슬리브/, /합지/, /쇼핑백/, /띠지/, /라벨/, /스티커/];

const COAT_KEY = [
  [/벨벳/, "velvet"], [/글로스/, "hg"], [/무광|매트|matte/, "matte"],
  [/유광/, "gloss"], [/ir|수성/, "ir"],
];
const GLUE_KEY = [
  [/pp접착|pp/, "pp"], [/슬리브/, "sleeve"], [/손잡이/, "handle"],
  [/풀발이/, "pull"], [/삼면/, "sam"], [/단면|자동접착/, "dan"],
];

const first = (table, t) => { for (const [re, v] of table) if (re.test(t)) return v; return null; };

// ─────────────────────────────────────────────────────────────────
//  2. 채점 도구
// ─────────────────────────────────────────────────────────────────
const isNum = v => typeof v === "number" && Number.isFinite(v);
const R2 = v => Math.round(v * 100) / 100;

class Cell {
  constructor(label) { this.label = label; this.n = 0; this.exact = 0; this.errs = []; }
  /**
   * @param tol 「정확」의 허용폭. 금액은 원 단위라 0.5(=반올림 일치),
   *   R·여분처럼 소수인 칸은 호출부가 0.0005 를 넘긴다.
   *   ⚠ 종전에 Math.round 로 굳혀 놨더니 지대R 1.3 과 1.49 가 **같다고 세어졌다** —
   *     ±10% 보다 「정확」이 더 높게 나오는 말이 안 되는 표가 그 증거였다.
   */
  add(ours, doc, tol = 0.5) {
    if (!isNum(ours) || !isNum(doc) || doc === 0) return;
    this.n++;
    if (Math.abs(ours - doc) <= tol) this.exact++;
    this.errs.push((ours - doc) / doc);
  }
  /** 값이 똑같은가만 보는 칸(수량·단가) — 오차분포는 무의미하다 */
  addEq(ours, doc, tol = 0.001) {
    if (!isNum(ours) || !isNum(doc)) return;
    this.n++;
    if (Math.abs(ours - doc) <= tol) this.exact++;
  }
  pct() { return this.n ? Math.round(this.exact / this.n * 1000) / 10 : null; }
  within(p) {
    if (!this.n) return null;
    const k = this.errs.filter(e => Math.abs(e) <= p).length;
    return Math.round(k / this.n * 1000) / 10;
  }
  q(p) {
    if (!this.errs.length) return null;
    const s = [...this.errs].sort((a, b) => a - b);
    return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * p))] * 1000) / 10;
  }
}

const census = new Map();
const bump = (k, by = 1) => census.set(k, (census.get(k) || 0) + by);

// ─────────────────────────────────────────────────────────────────
//  3. 코퍼스 줄 → 우리 줄 묶음
//     ⚠ 부분/부부코팅·형압·박은 **별도 공정**이다(코팅 드롭다운이 아니다).
//       코팅 묶음에 섞으면 코팅 적중률이 조용히 망가진다.
// ─────────────────────────────────────────────────────────────────
const nm = l => String(l["이름"] || "");
const GROUPS = {
  "지대":  l => /지대/.test(nm(l)),
  "소부":  l => nm(l) === "소부",
  "인쇄":  l => /^인쇄/.test(nm(l)),
  "코팅":  l => /^코팅/.test(nm(l)) || nm(l) === "글로스",
  "톰슨":  l => nm(l) === "톰슨",
  "접착":  l => /접착/.test(nm(l)),
  "관리비": l => /일반관리비|관리비/.test(nm(l)),
};
/** 우리 모델에 대응 공정이 있는 줄(금액 비교에 넣어도 되는 줄) */
const IN_MODEL = l =>
  Object.values(GROUPS).some(f => f(l)) ||
  /부분코팅|부부코팅|에폭시|형압|먹박|금박/.test(nm(l));
const moneyLines = rec => (rec["라인"] || []).filter(l => isNum(l["금액"]) && l["금액"] > 0);
const pick = (rec, g) => moneyLines(rec).filter(GROUPS[g]);
const sum = ls => ls.reduce((a, l) => a + l["금액"], 0);

// ─────────────────────────────────────────────────────────────────
//  4. 레코드 → QuoteInput
// ─────────────────────────────────────────────────────────────────
/** 배치를 우회하는 A 트랙 전용 크기. up 이 override 되면 전개도는 어떤 금액에도 안 들어간다. */
const NOMINAL_BOX = { mode: "net", netW: 300, netH: 200 };

/**
 * 인쇄 도수 구성. 문서는 도수(판수)만 적고 원색/별색을 자주 안 가른다.
 * 별색은 가중치 3 이라 잘못 읽으면 인쇄비가 3배 틀린다 — 그래서 **확정과 가정을 나눈다.**
 * @returns {{front,back,sure:boolean}|null}
 */
/** 사양 문구 한 조각 → 한 면의 인쇄 구성. '4도 별1' = 원색4 + 별1 = 판 5장. */
function sideFrom(t) {
  const o = {};
  // UV 는 **잉크 구성과 배타가 아니다** — 같은 면이 'UV인쇄' 이면서 소부 규격이 '4도' 인
  // 건이 코퍼스에 여럿이다. 종전에는 여기서 바로 반환해 구성을 버렸고, 그래서 소부
  // 판수가 문서의 4·5판이 아니라 0판으로 채점됐다. 켜 두기만 하고 계속 읽는다.
  //   ⚠ 인쇄 줄은 안 흔들린다 — process/print.mjs printSide 가 side.uv 를 **먼저** 보고
  //     수량 티어 정액으로 빠져나가므로 색 플래그를 봐도 금액이 안 변한다. 아래 UV 오독
  //     방지 주석(라로제)은 그대로 유효하다.
  if (/uv/.test(t)) o.uv = true;
  const m = t.match(/별(?:색)?(\d)/);
  if (m) o.spot = Number(m[1]);
  if (/먹/.test(t)) o.black = true;
  // 원색은 **별색·먹 표기를 걷어낸 뒤** 남은 4 로 읽는다 — '별4' 를 원색으로 오독하지 않게.
  const rest = t.replace(/별(?:색)?\d?/g, "").replace(/먹\d?도?/g, "");
  if (/원색|칼라|4도|(^|[^\d])4($|[^\d])/.test(rest)) o.color = true;
  return o;
}
const plates = sd => (sd.color ? 4 : 0) + (sd.spot || 0) + (sd.black ? 1 : 0);

function printOf(rec) {
  const ls = pick(rec, "인쇄");
  const sb = pick(rec, "소부")[0];
  const n = sb && isNum(sb["수량"]) ? sb["수량"] : 0;
  // ★ 구성은 소부 줄의 규격칸이 제일 잘 적는다('4도 별1' · '전면 : 별5 / 후면 : 별2').
  //   인쇄 줄 규격은 비어 있는 경우가 훨씬 많다.
  const txt = norm([sb && sb["규격"], ...ls.map(l => l["규격"])].filter(Boolean).join(" / "));
  // ★ UV 는 **‹UNK› 게이트보다 먼저** 본다. 소부 규격이 못 읽혀도 인쇄 규격의 'UV인쇄' 는
  //   읽힌다(코퍼스 18건 중 6건이 그 모양이다). 종전에는 게이트에 막혀 아래 n 기반 추측으로
  //   떨어졌고, 그 결과 UV 건이 **별색 2도**로 둔갑해 인쇄비가 도수환산(×3)으로 채점됐다.
  const uvSeen = /uv/.test(txt);
  if (txt && !/unk/.test(txt)) {
    // ⚠ UV 는 **전체 문구에서 먼저** 본다. 소부 규격이 '4도' 이고 인쇄 규격이 'UV인쇄' 인
    //   건이 실제로 있는데(라로제 모래시계), 앞 조각만 읽으면 원색 4도로 오독해 인쇄비가
    //   74만원 어긋난다 — 이 검수대가 최악 1위로 잡아낸 자리가 바로 그 오독이었다.
    const seg = txt.split("/");
    const sided = seg.some(s => /전면|후면/.test(s));
    //   UV 는 **면 전체**에 걸린다(인쇄 줄에만 적히고 소부 줄엔 잉크 구성만 적히는 탓에
    //   조각별로 읽으면 한쪽에만 붙는다). 전/후 구분이 없으면 앞면 하나로 몰아 읽되
    //   구성은 살린다 — 소부 판수가 그 구성으로 채점돼야 한다(위 sideFrom 주석).
    if (/uv/.test(txt) && !sided) {
      const f = { ...sideFrom(txt.replace(/uv\s*인?쇄?/g, " ")), uv: true };
      return { front: f, back: {}, sure: !n || plates(f) === n };
    }
    const fTxt = seg.find(s => /전면|전\d|^전/.test(s)) ?? seg[0];
    const bTxt = seg.find(s => /후면|후\d|^후/.test(s));
    const front = sideFrom(fTxt), back = bTxt ? sideFrom(bTxt) : {};
    const beda = /베다/.test(txt);
    // ★ 읽은 구성을 **판수로 검산한다.** 소부 수량과 맞으면 확정, 어긋나면 가정으로 내린다.
    //   이 한 줄이 「그럴듯하게 읽었다」와 「문서가 실제로 그렇게 적었다」를 가른다.
    if (plates(front) + plates(back) > 0)
      return { front, back, beda, sure: !n || plates(front) + plates(back) === n };
    if (front.uv) return { front, back: {}, sure: true };
  }
  // ★ UV 인데 구성이 안 읽히는 건 — **문서의 소부 수량을 구성으로 되먹이지 않는다.**
  //   되먹이면 우리 소부 수량이 문서 수량과 항상 같아져(아래 n 기반 분기가 바로 그것이다)
  //   「소부 수량 적중」이 자기충족이 된다. UV 면 하나로만 두고 정직하게 틀리게 둔다.
  if (uvSeen) return { front: { uv: true }, back: {}, sure: false };
  if (!n) return null;
  if (n === 4) return { front: { color: true }, back: {}, sure: true };
  if (n === 5) return { front: { color: true, black: true }, back: {}, sure: true };
  // 아래는 **가정**이다. 소부 1도는 먹, 2~3도는 별색 — 코퍼스의 별2/별3 라벨과 같은 자리.
  if (n === 1) return { front: { black: true }, back: {}, sure: false };
  if (n === 2 || n === 3) return { front: { spot: n }, back: {}, sure: false };
  // 6·7·8 도는 전/후면을 어떻게 가르는지 문서가 안 적는다 → **인쇄 칸만** 포기한다.
  //   ⚠ 여기서 도수를 0 으로 두면 소부 줄이 통째로 사라져 「우리 소부 0원 vs 문서 84,000원」이
  //     소부 적중률에 섞인다 — 못 읽은 것을 틀린 것으로 세는 사고다. 판수는 문서가 적어 뒀으니
  //     그 수만 살려 넣고(합계·인쇄는 아래에서 제외), 소부는 정직하게 채점한다.
  return { front: { spot: n }, back: {}, sure: false, unknown: true };
}

/** 코팅 — 앞/뒤 두 줄이면 양면. 종류를 못 읽으면 무광 가정. */
function coatOf(rec) {
  const ls = pick(rec, "코팅");
  if (!ls.length) return { front: "none", back: "none", sure: true, has: false };
  const t = norm(ls.map(l => `${l["이름"]} ${l["규격"] || ""}`).join(" "));
  const id = first(COAT_KEY, t);
  const both = ls.length >= 2 || /양면/.test(t);
  return { front: id || "matte", back: both ? (id || "matte") : "none",
           sure: !!id, has: true };
}

function glueOf(rec) {
  const ls = pick(rec, "접착");
  if (!ls.length) return { id: "none", sure: true, has: false };
  const t = norm(ls.map(l => `${l["이름"]} ${l["규격"] || ""}`).join(" ") +
                 " " + (rec["품목"] || "") + " " + (rec["file"] || ""));
  const id = first(GLUE_KEY, t);
  return { id: id || "dan", sure: !!id, has: true };
}

/** 문서에 박·형압·부분코팅 줄이 있으면 **그 공정이 있다는 사실**만 받는다. 단가는 우리 것. */
function finishExtras(rec) {
  const t = moneyLines(rec).map(nm).join(" ");
  return {
    foil: /먹박|금박|박$/.test(t) ? { type: /먹박/.test(t) ? "먹박" : "금박", sides: 1 } : null,
    emb:  /형압/.test(t) ? {} : null,
    puv:  /부분코팅|부부코팅|에폭시/.test(t) ? { sides: 1 } : null,
  };
}

// ─────────────────────────────────────────────────────────────────
//  5. A 트랙 — 협력사 원가 견적 줄별
// ─────────────────────────────────────────────────────────────────
const CELLS_A = {};
const cellA = k => (CELLS_A[k] ||= new Cell(k));
const worstA = [];
const unmappedPaper = new Map(), unmappedSheet = new Map();
/** 단가 적중 × 반기 — 단가는 날짜의 함수이므로 한 숫자로 뭉치면 아무 말도 못 한다 */
const UNIT_BY_HALF = {};

const PNG = RECS.filter(r => /PNG/.test(r["원천"] || ""));
const PDF = RECS.filter(r => /PDF/.test(r["원천"] || ""));

for (const rec of PNG) {
  const qty = rec["수량"], up = rec["up"], code = rec["판형코드"];
  if (!isNum(qty) || qty <= 0) { bump("A: 수량이 문서에 없다"); continue; }
  if (!isNum(up) || up <= 0) { bump("A: 판걸이(up)가 문서에 없다"); continue; }
  if (!code) { bump("A: 판형코드가 문서에 없다"); continue; }
  const sheetId = SHEET_BY_CODE[code];
  if (!sheetId) {
    bump("A: 판형코드를 우리 판형에 못 붙인다");
    unmappedSheet.set(code, (unmappedSheet.get(code) || 0) + 1); continue;
  }
  // ★ 26-09-16 범위밖(골판지)을 **지종 매핑보다 먼저** 가른다 — 결측과 섞이면 안 된다.
  //   (실측: A 트랙 PNG 209건에 골판지는 0건이다. 그래도 둔다 — B 와 같은 규칙을 쓰지 않으면
  //    협력사 견적서에 골판지가 한 장 들어오는 날 조용히 결측으로 섞인다.)
  if (isCorrugated(rec)) { bump("A: 범위 밖 — 골판지(선주 26-09-16)"); continue; }
  const paperId = paperIdOf(rec);
  if (!paperId) {
    bump("A: 지종을 우리 지종표에 못 붙인다");
    const k = rec["지종정규"] || rec["지종"] || "(빈칸)";
    unmappedPaper.set(k, (unmappedPaper.get(k) || 0) + 1); continue;
  }
  if (!moneyLines(rec).length) { bump("A: 금액이 찍힌 줄이 없다"); continue; }
  // ⚠ 문서가 스스로 모순인 건은 뺀다 — 장수가 정미장수보다 **적다**(여분 음수)는 것은
  //   물리적으로 불가능하다. up 과 지대R 중 하나가 문서/추출에서 어긋난 것이고, 우리는
  //   그 up 을 입력으로 받는다. 이런 건을 남겨 두면 「지대가 +55% 틀렸다」가 최상위로 올라와
  //   진짜 한계를 가린다. 실측 2건이고, 둘 다 A 트랙 최악 상위였다.
  const yeChk = rec["여분"];
  if (yeChk && isNum(yeChk["여분"]) && yeChk["여분"] < 0) {
    bump("A: 문서 자체 모순 — 장수 < 정미장수(여분 음수)"); continue;
  }
  // ⚠ 톰슨이 두 줄이면 둘째는 **파지(합지용 판지) 톰슨**이다 — 단상자의 톰슨이 아니다.
  //   process-prices.mjs 26-09-13 주석이 세운 모수 규칙. 여기서도 같은 규칙을 쓴다.
  const twoThom = pick(rec, "톰슨").length >= 2;
  if (twoThom) bump("A: 톰슨이 2줄(파지 톰슨 동반) — 톰슨·합계만 제외");

  const pr = printOf(rec);
  const co = coatOf(rec);
  const gl = glueOf(rec);
  const ex = finishExtras(rec);

  const input = {
    qty, box: NOMINAL_BOX,
    paper: { paperId, sheetId, custom: null },
    // 베다는 문서가 「별1(베다)」처럼 적어 둘 때만 켠다 — 켜면 엔진이 별색을 R당 고정가로
    // 뒤집고 여분을 +100 한다(quote.mjs spotModeForcedByBeda).
    print: { front: pr ? pr.front : {}, back: pr ? pr.back : {},
             beda: !!(pr && pr.beda), spotMode: "weight" },
    finish: { coatFrontId: co.front, coatBackId: co.back,
              // 복잡도 라벨은 견적서에 **안 찍힌다**. 그래서 앱 기본값을 쓴다 —
              // 사용자가 실제로 받는 값이 이것이다(ui/state.mjs INITIAL_STATE.thomId).
              // ★ 26-09-16 "n"(일반형) → "s"(단순형). 앱 기본값이 내려갔으므로 여기도 같이
              //   내린다 — 갈리면 이 검수대가 **사용자가 받지 않는 물건**을 재게 된다.
              thomsonId: "s", glueId: gl.id, ...ex },
    // ★ 주입하는 것은 up **하나**다. 단가·여분·R 은 한 개도 넣지 않는다.
    overrides: { up },
  };
  const q = buildQuote(input);
  if (!q.lines) { bump("A: 엔진이 견적을 못 냈다 — " + (q.warnings[0] || "이유없음")); continue; }

  const ourAmt = id => q.lines.filter(l => l.id === id || l.id.startsWith(id + "_"))
                              .reduce((a, l) => a + (l.amount || 0), 0);
  const ourQty = id => { const l = q.lines.find(x => x.id === id || x.id.startsWith(id + "_"));
                         return l && isNum(l.qty) ? l.qty : null; };
  const ourPrc = id => { const l = q.lines.find(x => x.id === id || x.id.startsWith(id + "_"));
                         return l && isNum(l.unitPrice) ? l.unitPrice : null; };

  const docSum = g => { const ls = pick(rec, g); return ls.length ? sum(ls) : null; };
  const docOne = (g, f) => { const ls = pick(rec, g);
                             return ls.length === 1 && isNum(ls[0][f]) ? ls[0][f] : null; };

  // ── 줄별 — 묶음마다 분모가 다르다 ────────────────────────────────
  const put = (key, ourId, docG, opts = {}) => {
    const d = docSum(docG);
    if (d == null) return;
    if (opts.silent) return;   // 이유는 위에서 이미 한 번 셌다 — 두 번 세지 않는다
    cellA(key).add(ourAmt(ourId), d);
    cellA(key + " 수량").addEq(ourQty(ourId), docOne(docG, "수량"));
    cellA(key + " 단가").addEq(ourPrc(ourId), docOne(docG, "단가"), 0.5);
  };
  put("지대", "paper", "지대");
  put("소부", "soboo", "소부");
  // 인쇄는 **별색이 섞였는가**로 갈라서 잰다. 엔진의 기본 모드는 도수환산(별색 1도 = 3회)
  // 이고, 코퍼스는 별색을 원/R 고정가로 청구하는 쪽이 많다 — 한 칸에 뭉치면 「표 값이 틀렸다」와
  // 「단위가 다르다」가 섞여 어느 쪽인지 말할 수 없게 된다.
  if (pr && !pr.unknown) {
    const hasSpot = (pr.front.spot || 0) + (pr.back.spot || 0) > 0;
    const tag = pr.sure ? "" : "·가정";
    put(`인쇄(${hasSpot ? "별색포함" : "원색·먹만"}${tag})`, "print", "인쇄");
  }
  else if (docSum("인쇄") != null) bump("A: 인쇄 도수구성을 문서가 안 가른다(6·7·8도) — 인쇄·합계만 제외");
  if (co.has) put(co.sure ? "코팅(종류명시)" : "코팅(무광가정)", "coat", "코팅");
  put("톰슨", "thomson", "톰슨", twoThom ? { silent: true } : {});
  if (gl.has) put(gl.sure ? "접착(종류명시)" : "접착(단면가정)", "glue", "접착");
  put("관리비", "admin", "관리비");

  // ── 공정합계 — 모델 밖 줄(파지·가공·합지물·‹UNK›…)이 있으면 애초에 못 맞춘다 ──
  const outLines = moneyLines(rec).filter(l => !IN_MODEL(l));
  const docTotal = rec["합계"];
  if (isNum(docTotal) && docTotal > 0) {
    if (outLines.length) bump("A: 합계 — 모델 밖 줄이 섞여 제외 (" + [...new Set(outLines.map(nm))].join(",") + ")");
    else if (twoThom) bump("A: 합계 — 톰슨 2줄이라 제외");
    else if (pr && pr.unknown) bump("A: 합계 — 인쇄 도수구성 미상이라 제외");
    else {
      cellA("공정합계").add(q.totals.process, docTotal);
      if (isNum(rec["개당"])) cellA("개당").add(q.totals.perEA, rec["개당"]);
      worstA.push({
        file: rec["file"], date: rec["date"], qty, up, sheetId, paperId,
        // 문서 자신의 여분율 — 1.0 을 넘으면 「정미의 2배 넘게 종이를 샀다」는 뜻이라
        // up 이나 R 중 하나가 문서/추출에서 어긋났을 가능성이 높다. 읽는 사람이
        // 「우리 오류」와 「오라클 잡음」을 눈으로 가를 수 있게 같이 찍는다.
        lossRate: rec["여분"] && isNum(rec["여분"]["여분율"]) ? rec["여분"]["여분율"] : null,
        ours: q.totals.process, doc: docTotal, d: q.totals.process - docTotal,
        parts: Object.keys(GROUPS).map(g => {
          const dd = docSum(g); if (dd == null) return null;
          const oid = { "지대": "paper", "소부": "soboo", "인쇄": "print", "코팅": "coat",
                        "톰슨": "thomson", "접착": "glue", "관리비": "admin" }[g];
          return { g, ours: ourAmt(oid), doc: dd, d: ourAmt(oid) - dd };
        }).filter(Boolean),
      });
    }
  }

  // ── C 트랙 진단 : 여분·지대R ─────────────────────────────────────
  //   ⚠ R 은 소수(0.05·0.001 단위)다. 원 단위 허용폭 0.5 를 그대로 쓰면 1.3 과 1.7 이
  //     「정확」으로 세어진다 — 그래서 0.0005 를 넘긴다.
  const ye = rec["여분"];
  if (ye && isNum(ye["여분"]) && ye["여분"] > 0) cellA("[C] 여분(장)").add(q.reams.loss, ye["여분"]);
  if (isNum(rec["지대R"]) && rec["지대R"] > 0) cellA("[C] 지대R").add(q.reams.R, rec["지대R"], 0.0005);
  const docPR = pick(rec, "톰슨")[0]?.["수량"];
  if (isNum(docPR) && docPR > 0 && !twoThom) cellA("[C] 공정R(톰슨 수량칸)").add(q.reams.processR, docPR, 0.0005);
  if (isNum(rec["지대단가"]) && rec["지대단가"] > 0)
    cellA("[C] 지대 원/R").add(q.paperPrice.pricePerR, rec["지대단가"]);

  // ── 단가 적중을 **반기로 쪼갠다** — 단가는 날짜의 함수다(26-04·06 두 번 인상) ──
  const half = String(rec["date"] || "").slice(0, 2) + (Number(String(rec["date"]).slice(3, 5)) <= 6 ? "H1" : "H2");
  const unitHit = (key, ourId, g) => {
    const ls = pick(rec, g); if (ls.length !== 1 || !isNum(ls[0]["단가"])) return;
    const o = ourPrc(ourId); if (!isNum(o)) return;
    const m = (UNIT_BY_HALF[key] ||= new Map());
    const cur = m.get(half) || { n: 0, ok: 0 };
    cur.n++; if (Math.abs(o - ls[0]["단가"]) <= 0.5) cur.ok++;
    m.set(half, cur);
  };
  unitHit("소부", "soboo", "소부");
  unitHit("인쇄", "print", "인쇄");
  unitHit("코팅", "coat", "코팅");
  unitHit("톰슨", "thomson", "톰슨");
  unitHit("지대", "paper", "지대");
}

// ─────────────────────────────────────────────────────────────────
//  6. B 트랙 — 치수→개당원가 전 사슬
//     문서에서 받는 것: 치수·지종·수량·사양문구. 그 외 전부 우리 것.
// ─────────────────────────────────────────────────────────────────
const CELLS_B = {};
const cellB = k => (CELLS_B[k] ||= new Cell(k));
const worstB = [];
const unmappedStruct = new Map();

for (const rec of PDF) {
  const dim = rec["치수"], qty = rec["수량"];
  if (!Array.isArray(dim) || dim.length !== 3) { bump("B: 치수(W×D×H)가 문서에 없다"); continue; }
  if (!isNum(qty) || qty <= 0) { bump("B: 수량이 문서에 없다"); continue; }
  const cost = rec["개당"], sale = rec["개당판매"];
  if (!isNum(cost) || cost <= 0) { bump("B: 원가개당 칸이 비어 있다"); continue; }
  // ⚠ 원가개당은 **판매개당과 짝일 때만** 믿는다.
  //   · 개당 == 개당판매 → 추출기가 판매가를 두 칸에 같이 넣은 것(원가 칸 없음).
  //   · 개당판매 가 비어 있음 → 교차검산이 안 된다. 실측으로 이 구멍에 걸린 건이
  //     「…_3천개.pdf」로, 문서 머리의 수량(5,000)과 줄의 단(3,000ea)이 달라 개당이
  //     750원으로 찍혀 있었다 — B 트랙 최악 1위(−86.8%)가 **우리 오류가 아니었다.**
  if (!isNum(sale) || sale <= cost) { bump("B: 원가개당을 판매개당으로 교차검산할 수 없다"); continue; }

  // ⚠ 골판지(BA/KLB/SK 코드·E골·B골 **및 SC240**)는 **이 앱의 물건이 아니다.**
  //   지종표 구멍과 섞어서 세면 「지종표를 늘려라」라는 잘못된 결론이 나온다 — 따로 센다.
  //   ★ 26-09-16 SC240 을 여기로 옮겼다(선주 지시). 종전에는 아래 paperIdOf 가 null 을
  //     내서 40건이 「지종표에 없다」 117건 속에 섞여 있었다. 규칙은 위 CORRUGATED 하나다.
  if (isCorrugated(rec)) { bump("B: 범위 밖 — 골판지(선주 26-09-16)"); continue; }
  const paperId = paperIdOf(rec);
  if (!paperId) {
    bump("B: 지종을 우리 지종표에 못 붙인다");
    const k = rec["지종정규"] || rec["지종"] || "(빈칸)";
    unmappedPaper.set(k, (unmappedPaper.get(k) || 0) + 1); continue;
  }
  const spec = norm([rec["품목"], rec["규격"],
                     ...(rec["라인"] || []).flatMap(l => [l["이름"], l["사양"], l["규격"]]),
                     rec["file"]].filter(Boolean).join(" "));
  if (STRUCT_OUT.some(re => re.test(spec))) { bump("B: 우리가 모델링하지 않는 구조(싸바리·슬리브·합지…)"); continue; }
  const structure = first(STRUCT_KEY, spec);
  if (!structure) {
    bump("B: 구조(맞뚜껑·삼면·십자·G형)를 사양문구가 안 적는다");
    unmappedStruct.set((rec["품목"] || "?").slice(0, 24), (unmappedStruct.get((rec["품목"] || "?").slice(0, 24)) || 0) + 1);
    continue;
  }
  // 인쇄 — 사양문구에서만 읽는다. 아무 표기가 없으면 **무지로 단정하지 않고 건너뛴다**
  //   (추출기가 못 읽은 것과 정말 무지인 것을 못 가른다).
  let front = null;
  if (/uv인쇄|uv코팅없.*인쇄/.test(spec)) front = { uv: true };
  else {
    const sp = spec.match(/별색?(\d)도/);
    const flat = /원색4도|인쇄4도|4도|옵셋전면4도|칼라4도/.test(spec);
    const blk = /먹1도|먹인쇄/.test(spec);
    if (sp) front = { spot: Number(sp[1]), ...(flat ? { color: true } : {}), ...(blk ? { black: true } : {}) };
    else if (flat) front = { color: true, ...(blk ? { black: true } : {}) };
    else if (blk) front = { black: true };
  }
  if (!front) { bump("B: 인쇄 도수를 사양문구가 안 적는다"); continue; }
  const coatId = first(COAT_KEY, spec) || (/라미|코팅/.test(spec) ? "matte" : "none");
  if (coatId === "none") bump("B: 코팅 표기가 없어 코팅 없음으로 계산");
  const glueId = /접착/.test(spec) ? (first(GLUE_KEY, spec) || "dan")
               : (structure === "glue_3side" ? "sam" : "none");

  const input = {
    qty, box: { mode: "box", W: dim[0], D: dim[1], H: dim[2], structure, hangTab: 0 },
    paper: { paperId, sheetId: "auto", custom: null },
    print: { front, back: {}, beda: false, spotMode: "weight" },
    // ★ 26-09-16 "n"(일반형) → "s"(단순형). A 트랙(:457)과 **같은 취지**다 —
    //   앱 기본값이 s 로 내려갔으므로(ui/state.mjs INITIAL_STATE.thomId) 여기도 같이 내린다.
    //   갈리면 이 검수대가 **사용자가 받지 않는 물건**을 재게 되고, 그 적중률로 판단하면
    //   화면에서 일어난 일과 표가 어긋난다. 두 트랙이 갈리는 것은 더 나쁘다 — 같은 앱을
    //   두 기준으로 재는 표가 한 화면에 나란히 찍힌다.
    finish: { coatFrontId: coatId, coatBackId: "none", thomsonId: "s", glueId },
    overrides: {},           // ★ 아무것도 주입하지 않는다
  };
  const q = buildQuote(input);
  if (!q.lines) { bump("B: 엔진이 견적을 못 냈다 — " + (q.warnings[0] || "이유없음").slice(0, 40)); continue; }

  const key = isNum(sale) && Math.abs(sale / cost - 1.2) <= 0.03
            ? "개당원가 (마진 1.2 확인건)" : "개당원가 (마진 기타)";
  cellB(key).add(q.totals.perEA, cost);
  cellB("개당원가 (전체)").add(q.totals.perEA, cost);
  cellB("  └ " + structure).add(q.totals.perEA, cost);
  worstB.push({ file: rec["file"], date: rec["date"], qty, dim, structure, paperId,
                sheetId: q.sheet.id, up: q.sheet.up,
                ours: q.totals.perEA, doc: cost, d: q.totals.perEA - cost,
                rel: (q.totals.perEA - cost) / cost });
}

// ─────────────────────────────────────────────────────────────────
//  7. 출력
// ─────────────────────────────────────────────────────────────────
const pad = (s, n) => String(s ?? "").padEnd(n);
const lpad = (s, n) => String(s ?? "").padStart(n);
const pc = v => v == null ? "   —" : lpad(v.toFixed(1), 5) + "%";

console.log("");
console.log("══════════════════════════════════════════════════════════════════════════════");
console.log("  전 코퍼스 검수대 — 사양만 문서에서 받고 **값은 전부 우리 표**로 계산한다");
console.log("══════════════════════════════════════════════════════════════════════════════");
console.log(`  오라클: ${FOUND.path}`);
console.log(`          (${FOUND.how})`);
if (!/CRIA_CORPUS/.test(FOUND.how))
  console.log("  ⚠ 경로가 세션마다 바뀐다 — 고정하려면 CRIA_CORPUS 로 넘겨라.");
console.log(`  레코드 ${RECS.length} = 협력사PNG ${PNG.length} · 자사PDF ${PDF.length} · 기타 ${RECS.length - PNG.length - PDF.length}`);
console.log("");

function table(cells, title, note) {
  console.log(`▌${title}`);
  if (note) console.log(`  ${note}`);
  console.log("  " + pad("줄", 22) + lpad("n", 5) + "  " + lpad("수량", 6) + " " + lpad("단가", 6) +
              "  " + lpad("금액", 6) + " " + lpad("±10%", 6) + " " + lpad("±20%", 6) +
              "   오차 p10 / 중앙 / p90");
  console.log("  " + "─".repeat(86));
  const keys = Object.keys(cells).filter(k => !/ 수량$| 단가$/.test(k));
  for (const k of keys) {
    const c = cells[k], qc = cells[k + " 수량"], uc = cells[k + " 단가"];
    if (!c.n) continue;
    console.log("  " + pad(k, 22) + lpad(c.n, 5) + "  " +
      (qc && qc.n ? pc(qc.pct()) : "   — ") + " " + (uc && uc.n ? pc(uc.pct()) : "   — ") + "  " +
      pc(c.pct()) + " " + pc(c.within(0.10)) + " " + pc(c.within(0.20)) + "   " +
      lpad(c.q(0.10) == null ? "—" : c.q(0.10) + "%", 7) + " / " +
      lpad(c.q(0.50) == null ? "—" : c.q(0.50) + "%", 7) + " / " +
      lpad(c.q(0.90) == null ? "—" : c.q(0.90) + "%", 7));
  }
  console.log("");
}

table(CELLS_A,
  `A 트랙 — 협력사 원가 견적 줄별 (PNG ${PNG.length}건)`,
  "주입한 것은 up **하나**. 지대단가·소부·인쇄·코팅·톰슨·접착·관리비·여분은 전부 우리 표다.");

table(CELLS_B,
  `B 트랙 — 자사 견적서 치수 → 개당원가, 전 사슬 (PDF ${PDF.length}건)`,
  "치수·지종·수량·사양문구만 받고 전개도→판걸이→판형→R→줄→합계→개당을 전부 우리가 냈다.");

// ── 단가 적중 × 반기 ─────────────────────────────────────────────
//   단가표는 **한 시점의 값 하나**를 들고 있다. 코퍼스는 2년치다. 한 숫자로 뭉치면
//   「표가 틀렸다」와 「표가 그 시점에는 맞았다」를 못 가른다.
{
  const halves = [...new Set(Object.values(UNIT_BY_HALF).flatMap(m => [...m.keys()]))].sort();
  if (halves.length) {
    console.log("▌단가 적중 × 반기 — 단가표는 한 시점의 값 하나를 들고 있다");
    console.log("  " + pad("", 8) + halves.map(h => lpad(h, 12)).join(""));
    for (const [k, m] of Object.entries(UNIT_BY_HALF)) {
      console.log("  " + pad(k, 8) + halves.map(h => {
        const c = m.get(h);
        return lpad(c ? `${Math.round(c.ok / c.n * 100)}% (${c.n})` : "·", 12);
      }).join(""));
    }
    console.log("");
  }
}

// ── 건너뛴 이유 ──────────────────────────────────────────────────
console.log("▌건너뛴 이유 — 조용히 거르면 적중률이 부풀려진다");
const cs = [...census.entries()].sort((a, b) => b[1] - a[1]);
for (const [k, v] of cs) console.log("  " + lpad(v, 5) + "  " + k);
console.log("");

if (unmappedPaper.size) {
  console.log("  ▸ 우리 지종표에 없는 지종 = **결측** (papers.mjs 를 늘릴 자리):");
  [...unmappedPaper.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([k, v]) => console.log("      " + lpad(v, 4) + "  " + k));
  console.log("");
}
// ★ 26-09-16 — **결측 바로 다음에, 그러나 따로** 찍는다. 붙여 두는 이유는 두 목록이
//   한눈에 비교돼야 「늘릴 자리」와 「늘리면 안 되는 자리」가 안 헷갈리기 때문이다.
if (outOfScope.size) {
  const tot = [...outOfScope.values()].reduce((a, b) => a + b, 0);
  console.log(`  ▸ 범위 밖 = **골판지** ${tot}건 — papers.mjs 를 늘릴 자리가 **아니다**`);
  console.log("     (이 앱은 단상자(판지)용. 골판지는 나중에 따로 만든다 — 선주 26-09-16)");
  [...outOfScope.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
    .forEach(([k, v]) => console.log("      " + lpad(v, 4) + "  " + k));
  console.log("");
}
if (unmappedSheet.size) {
  console.log("  ▸ 우리 판형에 없는 판형코드:");
  [...unmappedSheet.entries()].forEach(([k, v]) => console.log("      " + lpad(v, 4) + "  " + k));
  console.log("");
}
if (unmappedStruct.size) {
  console.log("  ▸ 구조를 못 읽은 품목 (상위 10):");
  [...unmappedStruct.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    .forEach(([k, v]) => console.log("      " + lpad(v, 4) + "  " + k));
  console.log("");
}

// ── 가장 크게 틀리는 건 ───────────────────────────────────────────
worstA.sort((a, b) => Math.abs(b.d / b.doc) - Math.abs(a.d / a.doc));
console.log(`▌A 트랙 — 상대오차가 가장 큰 ${Math.min(TOPN, worstA.length)}건 (공정합계)`);
for (const w of worstA.slice(0, TOPN)) {
  const rel = (w.d / w.doc * 100).toFixed(1);
  const lr = w.lossRate == null ? "" : `  [문서 여분율 ${(w.lossRate * 100).toFixed(0)}%${w.lossRate > 1 ? " ⚠오라클 의심" : ""}]`;
  console.log(`  ${w.date}  ${w.paperId}/${w.sheetId} up${w.up} ${w.qty.toLocaleString()}ea  ` +
              `우리 ${w.ours.toLocaleString()} vs 문서 ${w.doc.toLocaleString()}  (${rel > 0 ? "+" : ""}${rel}%)${lr}`);
  console.log("      " + w.parts.map(p => `${p.g} ${p.d > 0 ? "+" : ""}${Math.round(p.d).toLocaleString()}`).join(" · "));
  console.log("      " + String(w.file).split(/[\\/]/).slice(-2).join("/"));
}
console.log("");

worstB.sort((a, b) => Math.abs(b.rel) - Math.abs(a.rel));
console.log(`▌B 트랙 — 상대오차가 가장 큰 ${Math.min(TOPN, worstB.length)}건 (개당원가)`);
for (const w of worstB.slice(0, TOPN)) {
  console.log(`  ${w.date}  ${w.dim.join("×")} ${w.structure} ${w.paperId} ${w.qty.toLocaleString()}ea ` +
              `→ ${w.sheetId} ${w.up}up  우리 ${w.ours} vs 문서 ${w.doc}  (${w.rel > 0 ? "+" : ""}${(w.rel * 100).toFixed(1)}%)`);
}
console.log("");

// ── 부호 — 방향이 어느 쪽인가 (위험방향 규율이 읽는 숫자) ─────────────
console.log("▌방향 — 값을 **내리면 회사가 손해**다. 우리가 싸게 부르는 비율을 따로 센다");
for (const [nmk, cells] of [["A 공정합계", CELLS_A["공정합계"]], ["B 개당원가", CELLS_B["개당원가 (전체)"]]]) {
  if (!cells || !cells.n) continue;
  const lo = cells.errs.filter(e => e < -0.02).length;
  const hi = cells.errs.filter(e => e > 0.02).length;
  console.log(`  ${pad(nmk, 12)} n=${lpad(cells.n, 4)}  싸게 ${lpad(lo, 4)} (${(lo / cells.n * 100).toFixed(1)}%)` +
              `   비슷 ${lpad(cells.n - lo - hi, 4)}   비싸게 ${lpad(hi, 4)} (${(hi / cells.n * 100).toFixed(1)}%)`);
}
console.log("");

if (DUMP) {
  writeFileSync(DUMP, JSON.stringify({ oracle: FOUND.path, A: worstA, B: worstB,
    census: Object.fromEntries(census) }, null, 1), "utf8");
  console.log(`  건별 결과를 ${DUMP} 에 썼다.`);
}

console.log("══════════════════════════════════════════════════════════════════════════════");
console.log("  ⚠ 이 검수대는 **게이트가 아니다.** 실패로 빨개지지 않는다 —");
console.log("    지금은 「현행이 어디서 얼마나 틀리는가」를 재는 자다. 값을 고치기 전과 후에");
console.log("    같은 명령으로 두 번 돌려 표를 비교해라.");
console.log("══════════════════════════════════════════════════════════════════════════════");
console.log("");

// ══════════════════════════════════════════════════════════════════
//  verify-speclink — 견적서 화면 ↔ 쇼룸 화면 **사양 연동**을 수치로 잰다.
//
//  왜 별도 스위트인가
//  ────────────────
//  이 파일이 재는 것은 금액 공식이 아니라 **두 화면이 같은 입력을 보는가**다.
//  고장 났을 때의 증상이 「공식이 틀렸다」가 아니라 「같은 박스인데 견적서 204원 ·
//  쇼룸 223원」이고, 그 고장은 verify-total(공식) 도 verify-net(배치) 도 못 잡는다.
//  실제로 26-08-18 이전까지 15개 스위트 전부 초록인 채로 이 고장이 살아 있었다.
//
//  §A  SPEC_KEYS 빠짐없음 — toQuoteInput 이 **실제로 읽는 키**와 대조 (Proxy 측정)
//  §B  ★ 204원 게이트 — 같은 사양이면 두 화면의 개당단가가 **같은 수**여야 한다
//  §C  사양 줄이 참인가 — 화면에 적는 사양 문구 ↔ 실제 견적 라인
//  §D  코덱 왕복 — 실어 보낸 상태가 그대로 돌아오는가 (해시 문자열을 거쳐서)
//  §E  단독 진입 — 사양이 없으면 쇼룸은 **종전 표준사양 그대로** 돈다
//  §F  왕복 고리 — 쇼룸에서 배치를 바꿔 복귀한 뒤 **다시 들어가도** 같은 금액인가
//  §G  가장자리 — 쇼룸이 화면에서 뺀 사양(주문생산 판형 · 전개도 직접입력)이 실려 올 때
//  §H  ★ 전 판형 왕복 불변식 — 판형·up·개당단가가 왕복에서 **안 바뀐다** (26-08-19)
//  §I  청구 up ↔ 그린 up 게이트 — 갈리면 잡히는가 (견적서판 §12-3)
//  §J  거래처·품명 — 링크에 안 싣고 **초기값으로 접지도 않는다**
//  §M  ★ 관리자 수식 → 고객 표시가 — 파서 · 원가 유출 · 거부 거동 · 하위호환 (26-08-25)
//  §N  ★ 고객과 같이 넣는 사양 칸 + 수량별 개당단가 — 왕복 불변식 · 원가 유출 (26-08-26)
//  §O  ★ 별색 팬톤 조회 — 가격 불변 · 정직성 문구 · 검색 · 오프라인 거동 (26-08-27)
//
//  ── 26-08-19: 이 스위트가 「장식」이던 자리 둘을 고쳤다 ─────────────
//  58/58 초록인 채로 critical 1건 + major 1건이 살아 있었다. 이유가 둘 다 구조적이다:
//   ① §F 가 복귀 상태를 **손으로 지었다**(`{...SOSCO, mUp:true, mUpV:"3"}`). 실제 화면이
//      판형을 무엇으로 싣는지 한 번도 재지 않았고, 그 값("auto")이 곧 고장이었다.
//      ⟹ 이제 화면과 **같은 조립기**(showroom-core.linkStateOf)를 부른다. §H.
//   ② showroomScreen 이 배치를 **격자해로 가정**했다. 화면은 자유해도 채택했으므로
//      실제 화면 금액을 재지 않았다. 기준 케이스 4×62 는 격자=자유(4=4)라 그 차이가
//      원리적으로 안 보인다. ⟹ 이제 실제 autoPlace 를 부르고, 스윕에 자유 우위
//      판형이 실제로 들어 있는지까지 센다(§H 「이빨」).
//  ★ 새 판정을 넣을 때 **고친 그 자리가 무방비면 빨개지는지** 같이 확인해라(§H 이빨 ②:
//    종전 동작을 되살려 실제로 갈리는 것을 본다). 그게 없으면 다음 사람이 또 초록을 믿는다.
// ══════════════════════════════════════════════════════════════════
import { buildQuote } from "../src/domain/quote.mjs";
import { findSheetBase, resolveSheet } from "../src/domain/data/sheets.mjs";
import {
  INITIAL_STATE, toQuoteInput, customSheetOf, SPEC_KEYS, encodeSpec, decodeSpec,
  specHash, payloadOfHash, noCostOfHash,
} from "../src/ui/state.mjs";
import {
  quoteInputOf, specSummaryOf, capToQuoteUp, seedFromAuto, linkStateOf,
  frameOf, partOf, autoPlace, STD, T,
  // §N — 쇼룸에서 고객과 같이 넣는 사양 칸 + 수량별 개당단가 (26-08-26)
  SHOWROOM_SPEC_KEYS, specOf, baseOf, qtyStepsOf, qtyRowsOf, QTY_STEPS, QTY_PIN_MIN,
  paperChoices, coatChoices, glueChoices, thomChoices,
  upForPrice, resetKindOf,
} from "../src/showroom/showroom-core.mjs";
import { upGateOf, pmsOfHash } from "../src/ui/state.mjs";
// §O — 별색 팬톤 조회 (26-08-27). 도메인이 아니라 **표시·주석 레이어**다: 금액을 한 원도
//   안 움직인다(그 논증은 state.mjs 의 `pf=`·`pb=` 주석과 pantone.mjs 머리말이 소유한다).
import {
  loadPantone, searchPantone, findPantone, cmykTextOf, pmsCodeOf, _resetPantoneCache,
} from "../src/showroom/pantone.mjs";
// §M — 관리자 수식 → 고객 표시가. 도메인이 아니라 **표시 레이어**다(그 파일 머리말).
import {
  applyFormula, roundFor, shownPriceOf, shownRowsOf, adminViewOf,
  savePriceCfg, loadPriceCfg, EMPTY_PRICE_CFG, ADMIN_T,
} from "../src/showroom/price-formula.mjs";
import { readFileSync, readdirSync } from "node:fs";

let pass = 0, total = 0;
const fails = [];
const ok = (name, good, detail = "") => {
  total++; if (good) pass++; else fails.push(name);
  console.log(`${good ? "✅" : "❌"} ${name}${detail ? `\n     ${detail}` : ""}`);
};

// ══════════════════════════════════════════════════════════════════
//  §A  SPEC_KEYS 는 toQuoteInput 이 읽는 키와 같아야 한다
// ══════════════════════════════════════════════════════════════════
//  ⚠ **합집합으로 재라.** 9개 키(hangV·mRV·mPriceV·admin·embRpr·foilType·foilS·
//    foilRpr·puvS)는 짝 불리언이 참일 때만 읽힌다. 기본 상태 한 번만 재면 48개만
//    잡히고, 그 9개가 SPEC_KEYS 에서 빠져 있어도 이 테스트가 초록이 된다
//    — 즉 「죽은 픽스처」가 된다.
//  ⚠ 종전 이 줄은 「실측: 기본 1회 48개 / 합집합 57개」라고 **주석에 숫자를 적고** 있었고,
//    노브 2개(dieDeep·dieTabW)가 늘자 그대로 늙었다. 그래서 두 수를 **아래에서 찍는다** —
//    이 저장소의 교훈 「주석 안의 숫자는 늙는다」.
console.log("\n── §A  실려 나가는 키가 빠짐없는가 (Proxy 실측) ──────────────");
const readKeys = new Set();
const probe = base => {
  toQuoteInput(new Proxy({ ...base }, {
    get(t, k) { if (typeof k === "string") readKeys.add(k); return t[k]; },
  }));
};
const flags = Object.keys(INITIAL_STATE).filter(k => typeof INITIAL_STATE[k] === "boolean");
probe(INITIAL_STATE);
const baseOnly = readKeys.size;   // 기본 상태 1회만 쟀을 때 (= 합집합으로 안 재면 이만큼만 잡힌다)
probe({ ...INITIAL_STATE, ...Object.fromEntries(flags.map(k => [k, true])) });
probe({ ...INITIAL_STATE, ...Object.fromEntries(flags.map(k => [k, false])) });
probe({ ...INITIAL_STATE, sizeMode: "net" });

const spec = new Set(SPEC_KEYS);
const missing = [...readKeys].filter(k => !spec.has(k)).sort();
const extra   = SPEC_KEYS.filter(k => !readKeys.has(k)).sort();
ok(`toQuoteInput 이 읽는 ${readKeys.size}개가 전부 SPEC_KEYS 에 있다`,
   missing.length === 0,
   `기본 1회 ${baseOnly}개 / 합집합 ${readKeys.size}개 — 합집합으로 안 재면 ${readKeys.size - baseOnly}개가 안 잡힌다` +
   (missing.length ? `\n     빠진 키: ${missing.join(", ")}` : ""));
// 남는 키도 잡는다 — 오타로 넣은 키는 영원히 아무것도 안 나른다(조용한 실패다).
ok("SPEC_KEYS 에 안 읽히는 키가 없다", extra.length === 0,
   extra.length ? `안 읽히는 키: ${extra.join(", ")}` : "");
ok("SPEC_KEYS 에 중복이 없다", spec.size === SPEC_KEYS.length);
// 방침: 고객사·품명은 **일부러** 안 싣는다 (부스 주소창에 뜨고 링크로 나간다).
//   단가에 안 들어간다는 것을 여기서 못 박는다 — 들어가기 시작하면 방침을 바꿔야 한다.
ok("고객사·품명은 단가에 안 들어간다 (그래서 안 싣는다)",
   !readKeys.has("customer") && !readKeys.has("product") && !readKeys.has("date"));

// ══════════════════════════════════════════════════════════════════
//  §B  ★ 204원 게이트
// ══════════════════════════════════════════════════════════════════
//  사용자 지적 원문: 「견적서와 쇼잉 페이지 둘이 연동이 안되고 있어 … 몇도 인쇄라던가
//  그런게 연동이안된다」. 합격 기준은 **두 화면의 개당단가가 같은 수**다.
//  기준 케이스 = verify-total 「소스코 140×43×130 · 295AB 4×62 4up 4,000ea」 = 204원.
console.log("\n── §B  같은 사양이면 두 화면의 개당단가가 같은가 ─────────────");

/** 견적서 화면이 하는 일 — App.jsx: toQuoteInput(s) 한 번. */
const quoteScreen = s => buildQuote(toQuoteInput(s));

/**
 * 쇼룸 화면이 하는 일 — ShowroomPage 를 **같은 순서로** 흉내낸다.
 *   ① 판을 고르는 호출(up 0) → ② 판(frame)·부품(part) → ③ autoPlace(자동 배치 버튼)
 *   → ④ capToQuoteUp(견적서가 판걸이를 고정해 왔으면 자른다) → ⑤ 그 up 으로 재호출
 *
 * ⚠ ②③④ 를 **건너뛰지 마라.** 종전에는 이 함수가 `auto.layout.up`(격자해)을 그대로
 *   썼고, 주석은 「배치는 verify-net 의 몫이다 · 배치가 더 앉히면 금액이 갈리는 것이
 *   정상이다」라고 적어 그 생략을 정당화했다. 그 문장이 틀렸다 — 갈리는 방향이
 *   **「고객 앞 화면이 견적서보다 싸다」**이면 그건 고장이다. 실측(적대검증 major ②):
 *   국2 견적서 312원(2up) vs 쇼룸 240원(3up) −23% · 하3 263 vs 216 · 46 259 vs 243 ·
 *   하전지 296 vs 277 — 10판형 중 4~6. 기준 케이스 4×62 는 격자=자유(4=4)라
 *   **이 스위트를 포함한 16개가 전부 초록인 채로** 그 고장이 살아 있었다.
 *   ⟹ 여기서 실제 autoPlace 를 부른다. 그래야 배치 정책이 바뀌면 이 스위트가 안다.
 */
const showroomScreen = (carried, over = {}) => {
  const base = {
    mode: (over.mode ?? (carried?.sizeMode === "net" ? "net" : "box")),
    boxType: over.boxType ?? carried?.boxType,
    W: +(over.bW ?? carried?.bW ?? 0), D: +(over.bD ?? carried?.bD ?? 0),
    H: +(over.bH ?? carried?.bH ?? 0),
    netW: +(over.nW ?? carried?.nW ?? 0), netH: +(over.nH ?? carried?.nH ?? 0),
    sheetId: over.sheetId ?? carried?.sheetId ?? "auto",
    qty: +(over.qty ?? carried?.qty ?? 0),
    // ★ 26-08-26 — 화면의 사양 칸 한 벌(ShowroomPage 의 `over` state). 초기값이
    //   `specOf(baseOf(carried))` 인 것까지 화면과 같다: 아무것도 안 만진 상태에서는
    //   base 와 같은 값이라 덮어써도 무변화여야 한다(§B 204원·§E 223원이 그 증인이다).
    over: over.spec ?? specOf(baseOf(carried)),
    carried,
  };
  const nil = q => ({ up: 0, perEA: null, q, sheetId: null, gridUp: 0, freeUp: 0, freeItems: [] });
  const auto = buildQuote(quoteInputOf({ ...base, up: 0 }));
  if (!auto?.sheet) return nil(auto);
  // 화면이 그리는 판 — 드롭다운이 「자동」이면 도메인이 고른 판이다(ShowroomPage.sheetBase).
  const sheetBase = findSheetBase(base.sheetId !== "auto" ? base.sheetId : auto.sheet.id);
  if (!sheetBase) return nil(auto);
  const frame = frameOf(resolveSheet(sheetBase, carried ? customSheetOf(carried) : null));
  const part = auto.dieline ? partOf({ kind: "box", dieline: auto.dieline }) : null;
  if (!part) return nil(auto);
  const ap = autoPlace(part.P, frame, auto.layout?.up > 0 ? auto.layout.boxes : []);
  // ⚠ 화면과 **같은 함수**로 씨앗을 정한다(ShowroomPage.runAuto). 종전에는 여기서
  //   capToQuoteUp 만 불렀는데, 그건 「자르기」밖에 못 해서 재진입 복원(seedFromAuto)을
  //   한 번도 재지 않았다 — 왕복 2회차 −30% 가 108개 초록 아래에서 살아 있던 이유다.
  const seed = seedFromAuto(carried, ap);
  // over.adoptFree: 운영자가 「자유 배치 N up 채택」 버튼을 누른 경우(확정 절차).
  const items = (over.adoptFree && ap.freeUp > seed.items.length) ? ap.freeItems : seed.items;
  const up = items.length;
  if (!up) return { ...nil(auto), gridUp: ap.gridUp, freeUp: ap.freeUp };
  const q = buildQuote(quoteInputOf({ ...base, sheetId: sheetBase.id, up }));
  return { up, perEA: q?.totals?.perEA ?? null, q, sheetId: sheetBase.id,
           gridUp: ap.gridUp, freeUp: ap.freeUp, freeItems: ap.freeItems,
           restored: seed.restored, shortOf: seed.shortOf };
};

const SOSCO = {
  ...INITIAL_STATE,
  boxType: "glue_3side", sizeMode: "box", bW: "140", bD: "43", bH: "130",
  paperId: "AB295L", sheetId: "4x62", qty: "4000",
  fpColor: true, fpSp: "0", fpBk: false, fpUv: false,
  bpColor: false, bpSp: "0", bpBk: false, bpUv: false,
  fcId: "ir", bcId: "none", glueId: "dan", thomId: "n",
};

{
  const a = quoteScreen(SOSCO), b = showroomScreen(SOSCO);
  ok(`★ 소스코 140×43×130 · 295AB · 4×62 · 4,000 · 원색4 · IR · 단면접착 — ` +
     `견적서 ${a.totals.perEA}원 = 쇼룸 ${b.perEA}원`,
     a.totals.perEA === 204 && b.perEA === 204,
     `견적서 ${a.totals.perEA} / 쇼룸 ${b.perEA} (기대 204/204)`);
  // ★ 26-08-25(2차) — **공정합계까지 못박는다.** 204원은 반올림이라
  //   `round(공정합계/4000)` 의 203.5~204.5 구간 전체를 통과시킨다.
  //   현행 814,969원 → 203.74. 즉 **−970원** 이면 화면이 203원으로 떨어지고,
  //   그 전까지는 개당단가 게이트가 침묵한다. 반대쪽 여유는 +3,031원(견적서 실측 817,969)으로 넓다
  //   — 즉 이 절대선은 「비싸지는 변경」에는 강하고 「싸지는 변경」에는 약하다.
  //   갈리는 항목은 셋(인쇄 58,000 vs 56,000 · 톰슨 55,000 vs 50,000 · 관리비 120,000 vs 130,000)이고
  //   verify-total 은 그 셋을 **견적서 실측**으로 고정해 재므로 이 여유를 감시하지 못한다.
  //   ⚠ 이 숫자를 갱신하기 전에 그 여유부터 다시 재라.
  ok(`★ 그 204원의 공정합계까지 같다 — ${a.totals.process.toLocaleString()}원 (반올림 여유 −970원)`,
     a.totals.process === 814969 && b.q?.totals?.process === 814969,
     `견적서 ${a.totals.process} / 쇼룸 ${b.q?.totals?.process} (기대 814969)`);
}

// ── 「몇 도 인쇄」가 실제로 따라가는가 ────────────────────────────
//  사용자가 이름을 대서 지적한 항목이다. 도수를 바꿔 **두 화면이 같이 움직이는지**,
//  그리고 **금액이 실제로 변하는지**(안 변하면 테스트가 아무것도 안 잰다) 둘 다 본다.
console.log("\n── §B-2  도수를 바꾸면 두 화면이 같이 움직이는가 ─────────────");
const PRINT_VARIANTS = [
  ["원색4 (기준)",        { fpColor: true,  fpSp: "0", fpBk: false }],
  ["원색1 = 별색 1도",    { fpColor: false, fpSp: "1", fpBk: false }],
  ["별색 2도 + 먹",       { fpColor: false, fpSp: "2", fpBk: true  }],
  ["원색4 + 별1 + 베다",  { fpColor: true,  fpSp: "1", fpBk: false, beda: true }],
  ["양면 (뒤 원색4)",     { fpColor: true,  fpSp: "0", bpColor: true }],
];
const seen = new Set();
for (const [name, over] of PRINT_VARIANTS) {
  const s = { ...SOSCO, ...over };
  const a = quoteScreen(s).totals.perEA, b = showroomScreen(s).perEA;
  seen.add(a);
  ok(`인쇄 ${name} — 견적서 ${a}원 = 쇼룸 ${b}원`, a === b, `견적서 ${a} / 쇼룸 ${b}`);
}
// ★ 이빨 확인 — 도수를 바꿔도 값이 하나뿐이면 위 5줄은 아무것도 안 잰 것이다.
ok(`도수를 바꾸면 금액이 실제로 갈린다 (서로 다른 값 ${seen.size}종)`, seen.size >= 4,
   `나온 개당단가: ${[...seen].sort((x, y) => x - y).join(" / ")}`);

// ── 나머지 축 — 단가를 움직이는 것 전부가 따라가는가 ──────────────
console.log("\n── §B-3  지종·판형·수량·코팅·후가공·톰슨·접착·override ───────");
const AXES = [
  ["지종 295AB→350AB",  { paperId: "AB350" }],
  ["판형 4×62→국2",      { sheetId: "guk2" }],
  ["판형 자동",          { sheetId: "auto" }],
  ["수량 4,000→20,000",  { qty: "20000" }],
  ["코팅 IR→없음",       { fcId: "none" }],
  ["코팅 양면",          { bcId: "ir" }],
  ["박(금박) 1면",       { foil: true }],
  ["형압",               { emb: true }],
  ["부분UV 2면",         { puv: true, puvS: "2" }],
  ["톰슨 자동형",        { thomId: "a" }],
  ["접착 양면",          { glueId: "yang" }],
  ["행거탭 15mm",        { hang: true, hangV: "15" }],
  ["별색 R단가 방식",    { fpColor: false, fpSp: "2", spotMode: "rpr", spotRprV: "50000" }],
  ["인쇄 도당단가 직입", { printU: "20000" }],
  ["소부 단가 직입",     { sobooU: "11000" }],
  ["지대단가 직입",      { mPrice: true, mPriceV: "400000" }],
  ["R수 직입",           { mR: true, mRV: "2.5" }],
  ["여분 수동 300장",    { lossSheets: "300" }],
  ["일반관리비 수동",    { adminManual: true, admin: "300000" }],
  ["주문생산 판형",      { sheetId: "custom", cusW: "900", cusH: "640", cusCut: "2" }],
  ["구조 맞뚜껑",        { boxType: "tuck_both" }],
  ["전개도 직접입력",    { sizeMode: "net", nW: "646", nH: "258" }],
];
for (const [name, over] of AXES) {
  const s = { ...SOSCO, ...over };
  const a = quoteScreen(s).totals?.perEA ?? null, b = showroomScreen(s).perEA;
  ok(`${name} — 견적서 ${a}원 = 쇼룸 ${b}원`, a != null && a === b, `견적서 ${a} / 쇼룸 ${b}`);
}

// ══════════════════════════════════════════════════════════════════
//  §C  화면에 적는 사양 문구가 참인가
// ══════════════════════════════════════════════════════════════════
//  이 화면의 규칙: 「이 단가가 어느 사양의 값인지 말한다」. 말이 계산과 어긋나면
//  고객이 다른 사양의 값으로 읽는다 — 표기 고장 중 가장 나쁜 종류다.
console.log("\n── §C  사양 줄이 계산과 같은 말을 하는가 ────────────────────");
{
  const b = showroomScreen(SOSCO);
  const line = specSummaryOf(b.q.lines);
  const wants = ["AB라이트 295g", "원색 4도", "IR코팅", "톰슨", "접착"];
  const miss = wants.filter(w => !line.includes(w));
  ok(`실려 온 사양 줄이 실제 라인을 말한다 — 「${line}」`, miss.length === 0,
     miss.length ? `빠진 말: ${miss.join(", ")}` : "");
  ok("사양 줄에 판형이 중복으로 들어가지 않는다 (결과 상자가 이미 적는다)",
     !line.includes("4×62"));
}
{
  // 단독 진입의 손글씨 표준사양 문구(T.specLine)가 STD 와 어긋나지 않는지.
  // ⚠ 이게 없으면 STD.paperId 를 바꿔도 화면 글자만 낡은 채 초록으로 남는다.
  const b = showroomScreen(null, {
    mode: "box", boxType: "glue_3side", bW: 140, bD: 43, bH: 130,
    sheetId: "auto", qty: 4000,
  });
  const line = specSummaryOf(b.q.lines);
  const ko = T("ko").specLine;
  // 손글씨 문구가 주장하는 것: AB 350g · 원색 4도 · IR · 단면
  const claims = [["AB 350g", "AB 350g"], ["원색 4도", "원색 4도"],
                  ["IR", "IR코팅"], ["단면", "접착 단면"]];
  const bad = claims.filter(([inLine, inCalc]) =>
    ko.includes(inLine) && !line.includes(inCalc));
  ok(`표준사양 손글씨 문구가 STD 계산과 일치한다 — 계산 「${line}」`, bad.length === 0,
     bad.length ? `문구는 주장하는데 계산에 없다: ${bad.map(c => c[1]).join(", ")}` : "");
  ok("STD 는 견적서 기본 지종과 같다 (AB350)", STD.paperId === "AB350");
}

// ══════════════════════════════════════════════════════════════════
//  §D  코덱 왕복 — 해시 문자열을 실제로 거친다
// ══════════════════════════════════════════════════════════════════
console.log("\n── §D  URL 해시를 거친 왕복에서 사양이 보존되는가 ────────────");
{
  // 값이 특이한 것들을 일부러 섞는다: 소수점 · 한글 · 빈칸 · 불리언 false 로 되돌림
  const s = { ...SOSCO, bD: "43.5", foil: true, foilType: "은박", foilS: "2",
              lossSheets: "300", fpBk: true, newDie: false, dieQ: "2",
              spotMode: "rpr", spotRprV: "50000", mUp: true, mUpV: "6" };
  const hash = specHash("showroom", s);
  const back = decodeSpec(payloadOfHash(hash));
  const diff = SPEC_KEYS.filter(k => String(s[k]) !== String(back[k]));
  ok(`SPEC_KEYS ${SPEC_KEYS.length}개가 해시 왕복에서 그대로다`, diff.length === 0,
     diff.length ? diff.map(k => `${k}: ${s[k]} → ${back[k]}`).join(" / ") : "");
  ok("해시가 App 라우터의 쇼룸 정규식에 걸린다", /^#\/?showroom\b/.test(hash),
     hash.slice(0, 40));
  ok("왕복한 사양의 개당단가가 같다",
     quoteScreen(s).totals.perEA === quoteScreen(back).totals.perEA);
  // 초기값과 다른 것만 싣는다 — 주소창에서 읽을 수 있어야 한다
  ok(`페이로드가 짧다 (${payloadOfHash(hash).length}자 · ${SPEC_KEYS.length}개 전부면 400자를 넘는다)`,
     payloadOfHash(hash).length < 400);
}
{
  // 초기값 **그대로**를 넘겨도 「사양 없음」으로 읽히면 안 된다 (그러면 쇼룸이
  // 자기 표준사양으로 갈아타 금액이 갈린다). 형식 버전 v~1 이 그걸 막는다.
  const hash = specHash("showroom", INITIAL_STATE);
  const back = decodeSpec(payloadOfHash(hash));
  ok("초기값 그대로도 「사양 있음」으로 읽힌다", back !== null, `payload=${payloadOfHash(hash)}`);
  const diff = back ? SPEC_KEYS.filter(k => String(INITIAL_STATE[k]) !== String(back[k])) : ["decode=null"];
  ok("초기값 왕복도 무손실", diff.length === 0, diff.join(", "));
}
{
  // 해시는 바깥에서 들어오는 값이다. 이상한 링크가 화면을 죽이면 안 된다.
  const junk = [
    "v~1;__proto__~oops;boxType~glue_3side",
    "v~1;qty~100;notAKey~1;bW~%E1%",          // 깨진 %-이스케이프
    "v~1;;;~;bD~43",
    "bogus", "", null, undefined,
  ];
  let survived = 0;
  for (const j of junk) {
    try { const r = decodeSpec(j); if (r === null || typeof r === "object") survived++; }
    catch { /* 아래에서 실패로 센다 */ }
  }
  ok(`이상한 페이로드 ${junk.length}건에 안 죽는다`, survived === junk.length);
  const p = decodeSpec("v~1;__proto__~oops;boxType~glue_3side");
  ok("모르는 키는 상태에 안 들어간다", p.boxType === "glue_3side" &&
     !Object.prototype.hasOwnProperty.call(p, "__proto__") && ({}).oops === undefined);
  ok("불리언은 문자열이 아니라 진리값으로 돌아온다",
     decodeSpec("v~1;foil~0").foil === false && decodeSpec("v~1;foil~1").foil === true);
}

// ══════════════════════════════════════════════════════════════════
//  §E  단독 진입 — 사양이 없으면 종전 그대로
// ══════════════════════════════════════════════════════════════════
console.log("\n── §E  쇼룸 단독 진입(#showroom)이 종전대로 도는가 ──────────");
{
  ok("해시에 사양이 없으면 decodeSpec 이 null 이다",
     decodeSpec(payloadOfHash("#showroom")) === null &&
     decodeSpec(payloadOfHash("#/showroom")) === null);
  // 종전 값 = 이번 변경 전 쇼룸이 내던 수. 삼면접착 140×43×130 · 4,000 · STD.
  //   ⚠ 이 223 은 「맞는 금액」이 아니라 **표준사양의 금액**이다. 견적서가 295AB 를
  //     잡으면 204 가 맞다 — 두 수가 다른 것이 정상이고, §B 가 그 경우를 잰다.
  const b = showroomScreen(null, {
    mode: "box", boxType: "glue_3side", bW: 140, bD: 43, bH: 130,
    sheetId: "auto", qty: 4000,
  });
  ok(`단독 진입 금액이 종전과 같다 (AB350 표준사양 → ${b.perEA}원 · 4up)`,
     b.perEA === 223 && b.up === 4, `up ${b.up} · ${b.perEA}원`);
}

// ══════════════════════════════════════════════════════════════════
//  §F  왕복 고리가 닫히는가 — 「쇼룸에서 배치를 바꿔 → 복귀 → 다시 쇼룸」
// ══════════════════════════════════════════════════════════════════
//  이 고리가 안 닫히면 두 화면이 **또** 갈린다. 브라우저 실측으로 먼저 밟은 경로다:
//  쇼룸에서 한 칸 지워 3up(247원) → 복귀하면 견적서가 판걸이 직접입력 3 으로 247원 →
//  다시 고객 화면으로 가면 쇼룸이 스스로 4up 을 풀어 **204원**. 방향이 「앱이 싸게
//  부른다」라 영업 위험이다. capToQuoteUp 이 그 자리를 막는다.
console.log("\n── §F  배치를 바꾼 뒤 왕복해도 두 화면이 같은가 ─────────────");
{
  // ① 쇼룸이 3up 으로 앉혔다 (자동해 4up 에서 한 칸 뺀 상태)
  const auto4 = [0, 1, 2, 3].map(i => ({ x: i, y: 0, flipped: false, rotated: false }));
  const priced = up => buildQuote(quoteInputOf({
    mode: "box", boxType: "glue_3side", W: 140, D: 43, H: 130,
    sheetId: "4x62", qty: 4000, up, carried: SOSCO })).totals.perEA;
  const at3 = priced(3), at4 = priced(4);
  ok(`쇼룸 3up 과 4up 의 금액이 실제로 다르다 (${at3} vs ${at4})`, at3 !== at4);

  // ② 복귀 링크가 그 3 을 판걸이 직접입력으로 싣는다 (up ≠ 격자해 4)
  const backState = { ...SOSCO, mUp: true, mUpV: "3" };
  const backHash = specHash("", backState);
  const restored = decodeSpec(payloadOfHash(backHash));
  ok(`복귀 상태에서 견적서도 ${at3}원이다 (판걸이 직접입력 3)`,
     quoteScreen(restored).totals.perEA === at3,
     `견적서 ${quoteScreen(restored).totals.perEA} / 쇼룸 ${at3}`);

  // ③ 그 상태로 **다시** 쇼룸에 들어가면 자동해를 3 으로 자른다 → 같은 금액
  const capped = capToQuoteUp(restored, auto4);
  ok("다시 쇼룸에 들어가면 자동해 4장을 3장으로 자른다", capped.length === 3,
     `자른 결과 ${capped.length}장`);
  ok(`고리가 닫힌다 — 쇼룸 ${priced(capped.length)}원 = 견적서 ${at3}원`,
     priced(capped.length) === at3);

  // ④ 고정값이 실제로 들어가는 수보다 많으면 **줄이지 않는다** (없는 자리는 못 그린다)
  const over = capToQuoteUp({ ...SOSCO, mUp: true, mUpV: "9" }, auto4);
  ok("고정값이 실제보다 크면 자르지 않는다 (겹침을 그리지 않는 계약이 우선)",
     over.length === 4);
  // ⑤ 고정이 없으면 손대지 않는다 — 단독 진입·평상시 경로가 안 바뀐다
  ok("판걸이 고정이 없으면 자동해를 그대로 쓴다",
     capToQuoteUp(SOSCO, auto4).length === 4 && capToQuoteUp(null, auto4).length === 4);
}

// ══════════════════════════════════════════════════════════════════
//  §G  실려 온 사양의 가장자리 — 쇼룸 화면이 원래 안 다루던 것들
// ══════════════════════════════════════════════════════════════════
//  쇼룸은 「항목을 최소로」라서 주문생산 판형과 전개도 직접입력을 **화면에서 뺐다.**
//  그런데 견적서에서는 **실려 올 수 있다.** 빼 놓은 것이 실려 오면 조용히 다른 값이
//  된다 — 아래 둘 다 브라우저 실측에서 먼저 밟았다.
console.log("\n── §G  쇼룸이 원래 안 다루던 사양이 실려 왔을 때 ────────────");
{
  // ① 주문생산 판형 — **그린 판**과 **계산에 쓴 판**이 같아야 한다.
  //    resolveSheet 에 크기를 안 넘기면 기본값 890×670 으로 접히는데, 금액 쪽은
  //    base 의 cusW/cusH 로 제대로 계산된다 → 화면과 금액이 조용히 갈린다.
  const cus = { ...SOSCO, sheetId: "custom", cusW: "900", cusH: "640", cusCut: "2" };
  const base = findSheetBase("custom");
  const drawn = resolveSheet(base, customSheetOf(cus));
  ok(`주문생산 판형은 실려 온 크기로 그린다 (${drawn.w}×${drawn.h})`,
     drawn.w === 900 && drawn.h === 640,
     `크기를 안 넘기면 ${base.w}×${base.h} 로 접힌다`);
  const q = buildQuote(toQuoteInput(cus));
  ok("그 판이 계산에 쓰인 판과 같다",
     q.sheet.w === drawn.w && q.sheet.h === drawn.h,
     `계산 ${q.sheet.w}×${q.sheet.h} / 그림 ${drawn.w}×${drawn.h}`);

  // ② 이 전개도가 들어가는 판형이 없으면 라인이 **없다**(buildQuote 가 빈 결과).
  //    그때 사양 줄을 껍데기로 찍으면 「견적서 사양 · (개당단가는 개발비 제외)」가
  //    남는다 — 화면 코드가 빈 문자열을 보고 줄을 접을 수 있어야 한다.
  const tooBig = buildQuote(toQuoteInput({ ...SOSCO, sizeMode: "net", nW: "646", nH: "258",
                                           sheetId: "4x64" }));
  ok("판에 안 들어가면 견적 라인이 없다 (실측: 슬리브 646×258 → 4×64)",
     !tooBig.lines || tooBig.lines.length === 0,
     `lines=${tooBig.lines ? tooBig.lines.length : "null"} · warnings=${(tooBig.warnings||[]).join("/")}`);
  ok("라인이 없으면 사양 요약이 빈 문자열이다 (껍데기 줄을 안 만든다)",
     specSummaryOf(tooBig.lines) === "" && specSummaryOf(null) === "" && specSummaryOf([]) === "");
}

// ══════════════════════════════════════════════════════════════════
//  §H  ★ 전 판형 왕복 불변식 — 견적서 → 쇼룸 → 견적서 에서 판이 안 바뀐다
// ══════════════════════════════════════════════════════════════════
//  이 절이 이번 critical 을 잡는다. 실측 재현:
//    견적서 삼면접착 140×43×130 · 295AB · 판형 **자동**(→4×62) · 4,000 = 204원 4up
//    → 고객 화면으로 → 쇼룸 4up → 칸 1개 삭제 → 3up 247원
//    → 견적 앱으로 → 견적서 **176원 · 4×64(394×545)**   ← 판이 통째로 바뀌었다
//  Δ −71원/개(−29%) · 경고 없음 · 방향은 「앱이 싸게 부른다」.
//  원인: 복귀 링크가 판형을 드롭다운 값 그대로("auto")로 실었고, 같은 링크에
//  mUp~1;mUpV~3 이 함께 실린다. 견적서에서 그 조합은 decideSheet ① 로 가고
//  그 분기는 `findSheetBase("auto") || BASE_SHEETS[3]` = 4×64 다.
//
//  ⚠ 조립을 여기서 **복제하지 않는다** — 화면과 같은 showroom-core.linkStateOf 를
//    부른다. 종전 §F 는 복귀 상태를 손으로 지어서(`{...SOSCO, mUp:true, mUpV:"3"}`)
//    실제 화면이 판형을 어떻게 싣는지 **한 번도 재지 않았다.** 그게 이 고장이
//    16개 스위트를 통과한 이유다.
console.log("\n── §H  전 판형에서 왕복해도 판형·up·개당단가가 같은가 ────────");

const SHEET_IDS = ["auto", "46", "4x62", "4x63", "4x64", "guk", "guk2", "ha", "ha2", "ha3", "ha4"];

/** 「견적 앱으로 →」를 눌렀을 때 견적서가 받는 상태 — 화면과 같은 조립기를 쓴다.
 *  sheetIdForLink 를 인자로 받는 이유: 이 값이 이번 critical 의 본체다(아래 이빨 확인). */
const backTo = (carried, r, sheetIdForLink, up) => decodeSpec(payloadOfHash(specHash("",
  linkStateOf({
    carried, mode: carried?.sizeMode === "net" ? "net" : "box",
    boxType: carried.boxType, bW: carried.bW, bD: carried.bD, bH: carried.bH,
    netW: +carried.nW, netH: +carried.nH,
    sheetId: sheetIdForLink, qty: carried.qty, up, gridUp: r.gridUp,
  }))));

let rtPass = 0, rtSeenFreeGain = 0, delTested = 0;
for (const id of SHEET_IDS) {
  const s = { ...SOSCO, sheetId: id };
  const a = quoteScreen(s);
  const r = showroomScreen(s);
  if (!a?.lines || !r.up) { ok(`${id} — 판형 스윕에서 빠졌다(견적/배치 없음)`, false); continue; }
  if (r.freeUp > r.gridUp) rtSeenFreeGain++;

  // ① 같은 링크에서 두 화면이 같은 금액 — 적대검증 major ② 의 전 판형 판정
  ok(`${id} · 같은 사양 — 견적서 ${a.totals.perEA}원(${a.sheet.up}up) = 쇼룸 ${r.perEA}원(${r.up}up)`,
     a.totals.perEA === r.perEA && a.sheet.up === r.up,
     `견적서 ${a.sheet.up}up ${a.totals.perEA}원 / 쇼룸 ${r.up}up ${r.perEA}원 ` +
     `(격자 ${r.gridUp} · 자유 ${r.freeUp})`);

  // ② 그대로 왕복 — 판형·up·개당단가 셋 다 그대로여야 한다
  const b = quoteScreen(backTo(s, r, r.sheetId, r.up));
  const same = b.sheet.id === r.sheetId && b.sheet.up === r.up && b.totals.perEA === r.perEA;
  ok(`${id} · 왕복 — 판형 ${b.sheet.id} · ${b.sheet.up}up · ${b.totals.perEA}원 (그대로)`, same,
     `쇼룸 ${r.sheetId}/${r.up}up/${r.perEA}원 → 복귀 ${b.sheet.id}/${b.sheet.up}up/${b.totals.perEA}원`);
  if (same) rtPass++;

  // ③ ★ 칸 하나를 지우고 왕복 — 실측 경로 그대로. 여기서 판걸이 직접입력이 켜지므로
  //    판형을 "auto" 로 실으면 4×64 로 갈아탄다. up ≥ 2 인 판형에서만 지운다.
  if (r.up >= 2) {
    delTested++;
    const cut = r.up - 1;
    const shown = buildQuote(quoteInputOf({
      mode: "box", boxType: s.boxType, W: +s.bW, D: +s.bD, H: +s.bH,
      sheetId: r.sheetId, qty: +s.qty, up: cut, carried: s })).totals.perEA;
    const c = quoteScreen(backTo(s, r, r.sheetId, cut));
    ok(`${id} · 칸 1개 삭제(${r.up}→${cut}up) 왕복 — 쇼룸 ${shown}원 = 견적서 ${c.totals.perEA}원 · ` +
       `판형 ${c.sheet.id}`,
       c.sheet.id === r.sheetId && c.sheet.up === cut && c.totals.perEA === shown,
       `쇼룸 ${r.sheetId}/${cut}up/${shown}원 → 복귀 ${c.sheet.id}/${c.sheet.up}up/${c.totals.perEA}원`);
  }
}
ok(`왕복 불변식이 판형 ${SHEET_IDS.length}개 전부에서 성립한다`, rtPass === SHEET_IDS.length,
   `${rtPass}/${SHEET_IDS.length}`);
// 이빨 ①: 자유해가 격자해를 이기는 판형이 스윕 안에 실제로 있어야 한다. 없으면 위
//   「같은 금액」 줄들은 배치 정책을 **아무것도 안 잰 것**이다(4×62 만 보면 4=4 라 늘 초록).
ok(`스윕에 자유해가 격자해를 이기는 판형이 있다 (${rtSeenFreeGain}개)`, rtSeenFreeGain >= 3,
   `자유 우위 판형 ${rtSeenFreeGain}개 — 0 이면 이 스윕은 ② 를 못 잡는다`);
ok(`칸 삭제 왕복을 실제로 밟은 판형이 있다 (${delTested}개)`, delTested >= 8);

// ── 이빨 ②: **고친 그 자리**가 무방비면 빨개지는가 ────────────────
//  고장을 되살려 본다 — 복귀 링크에 판형을 "auto" 로 실으면(종전 동작) 판이 바뀌는가.
//  이 줄이 초록이면 §H 는 「항상 통과하는 장식」이 아니다: 실제로 갈리는 입력을 알고
//  있고, 위에서는 안 갈린다는 것을 확인한 셈이다.
{
  const s = { ...SOSCO, sheetId: "auto" };
  const r = showroomScreen(s);
  const cut = r.up - 1;
  const fixed = quoteScreen(backTo(s, r, r.sheetId, cut));   // 지금 동작 (해석된 id)
  const old   = quoteScreen(backTo(s, r, "auto", cut));      // 종전 동작 (드롭다운 값)
  ok(`이빨 — 판형을 "auto" 로 실으면 판이 바뀐다: ${old.sheet.id}(${old.sheet.w}×${old.sheet.h}) ` +
     `${old.totals.perEA}원 ≠ 해석된 id ${fixed.sheet.id} ${fixed.totals.perEA}원`,
     old.sheet.id !== fixed.sheet.id && old.totals.perEA !== fixed.totals.perEA,
     `종전 ${old.sheet.id}/${old.totals.perEA}원 · 지금 ${fixed.sheet.id}/${fixed.totals.perEA}원`);
  ok(`그 고장의 방향이 「싸게 부른다」였다 (${old.totals.perEA} < ${fixed.totals.perEA}원 · ` +
     `${Math.round((old.totals.perEA / fixed.totals.perEA - 1) * 100)}%)`,
     old.totals.perEA < fixed.totals.perEA);
  // 주소창 동기화용 해시는 반대로 **드롭다운 값**을 실어야 한다 — 새로고침 한 번에
  // 운영자가 고른 「자동」이 고정으로 바뀌면 그것도 조용한 사양 변경이다.
  const sync = linkStateOf({ carried: s, mode: "box", boxType: s.boxType, bW: s.bW, bD: s.bD,
                             bH: s.bH, sheetId: "auto", qty: s.qty, up: r.up, gridUp: r.gridUp });
  ok(`주소창 동기화는 「자동」을 자동으로 유지한다`, sync.sheetId === "auto");
}

// ══════════════════════════════════════════════════════════════════
//  §I  청구 up ↔ 그린 up — 갈리면 화면이 **그리지 않거나 경고해야** 한다
// ══════════════════════════════════════════════════════════════════
//  ARCHITECTURE §12-3 은 쇼룸에 대해 「그릴 배치는 전부 게이트를 통과해야 한다」를
//  못박았다. 견적서에는 그 게이트가 없었다 — 실측(적대검증 major ③):
//    국2 · 판걸이 직접입력 3 → 요약 「판걸이 3 up」 · 지대 「1.634R … 3up」 · 240원
//    인데 같은 화면의 배치 시각화는 「2 up · 1열×2행 · 수율 57%」를 그리고 칸도 2개다.
//  판정은 ui/state.upGateOf 가 소유하고 App.jsx 가 그걸 화면에 반영한다.
console.log("\n── §I  청구 up 과 그린 up 이 갈리는 것을 잡는가 ───────────────");
{
  const cases = [
    ["국2 · 판걸이 직접입력 3", { ...SOSCO, sheetId: "guk2", mUp: true, mUpV: "3" }, true],
    ["4×62 · 판걸이 직접입력 3", { ...SOSCO, sheetId: "4x62", mUp: true, mUpV: "3" }, true],
    ["4×62 · 판걸이 직접입력 4 (격자와 같다)", { ...SOSCO, sheetId: "4x62", mUp: true, mUpV: "4" }, false],
    ["평상시 (직접입력 없음)", SOSCO, false],
  ];
  for (const [name, s, wantMismatch] of cases) {
    const g = upGateOf(quoteScreen(s));
    ok(`${name} — 청구 ${g.billed}up · 그린 ${g.drawn}up → ${g.mismatch ? "갈림 판정" : "일치"}`,
       g.mismatch === wantMismatch, `기대 ${wantMismatch ? "갈림" : "일치"}`);
  }
  // 전 판형 평상시 경로는 하나도 걸리지 않아야 한다 — 걸리면 배너가 늘 떠서 무의미해진다
  const noisy = SHEET_IDS.filter(id => upGateOf(quoteScreen({ ...SOSCO, sheetId: id })).mismatch);
  ok(`평상시에는 판형 ${SHEET_IDS.length}개 전부 안 걸린다 (거짓 경보 0)`, noisy.length === 0,
     `걸린 판형: ${noisy.join(", ")}`);
  // 칸 삭제 왕복은 **걸려야 한다** — 그 3up 은 규칙격자가 아니라 사람이 확정한 배치다.
  {
    const s = { ...SOSCO, sheetId: "4x62" };
    const r = showroomScreen(s);
    const g = upGateOf(quoteScreen(backTo(s, r, r.sheetId, r.up - 1)));
    ok(`칸 삭제 왕복은 갈림으로 잡힌다 (청구 ${g.billed} vs 그린 ${g.drawn}) — ` +
       `그림을 접고 경고한다`, g.mismatch === true);
  }
  ok("결과가 없어도 안 죽는다", upGateOf(null).mismatch === false &&
     upGateOf({ sheet: null, layout: null }).mismatch === false);
}

// ══════════════════════════════════════════════════════════════════
//  §J  거래처·품명 — 링크에는 안 싣고, **초기값으로 접지도 않는다**
// ══════════════════════════════════════════════════════════════════
//  실측(적대검증 minor ⑥): 「테스트상사/검증박스A」로 잡아 왕복하면 금액은 그대로인데
//  거래처가 **「코리팩/십자B 패키지」**로 바뀐다. 빈칸이면 눈에 띄지만 「코리팩」은
//  그럴듯한 다른 고객사 이름이라, 그대로 출력하면 남의 고객사 이름이 박힌 견적서가 나간다.
console.log("\n── §J  거래처·품명이 조용히 남의 이름으로 바뀌지 않는가 ─────");
{
  const s = { ...SOSCO, customer: "테스트상사", product: "검증박스A" };
  const back = decodeSpec(payloadOfHash(specHash("showroom", s)));
  ok("링크에는 안 실린다 (방침 유지 — 고객 앞 주소창·공유 링크)",
     !payloadOfHash(specHash("showroom", s)).includes("테스트상사") &&
     !payloadOfHash(specHash("showroom", s)).includes("customer"));
  // decodeSpec 은 INITIAL_STATE 를 깔고 오므로 **초기값이 딸려 온다** — 그래서
  // App.jsx 가 그 두 칸을 세션값으로 덮거나 비워야 한다. 그 사실을 여기 못 박는다.
  ok("그래서 decodeSpec 결과의 두 칸은 「초기값」이다 = 화면이 접어야 한다",
     back.customer === INITIAL_STATE.customer && back.product === INITIAL_STATE.product,
     `${back.customer} / ${back.product}`);
  ok("초기값이 빈칸이 아니라 **그럴듯한 이름**이다 (그래서 조용히 두면 위험하다)",
     INITIAL_STATE.customer.trim().length > 0 && INITIAL_STATE.product.trim().length > 0,
     `「${INITIAL_STATE.customer}」/「${INITIAL_STATE.product}」`);
  ok("두 칸은 금액에 안 들어간다 (그래서 비워도 견적은 같다)",
     quoteScreen(s).totals.perEA === quoteScreen({ ...s, customer: "", product: "" }).totals.perEA);
}

// ══════════════════════════════════════════════════════════════════
//  §K  ★ 왕복 **2~3회차** 불변식 — 확정한 판걸이가 재진입에서 살아남는가
// ══════════════════════════════════════════════════════════════════
//  왜 1회차만 보면 못 잡나 — 실측 재현(적대검증 major ⑨ · 실브라우저 실제 클릭):
//    국2 · 삼면접착 140×43×130 · AB295L · 4,000
//      쇼룸 2up 312원 → 「격자 2up → 자유 배치 3up 채택」 → 3up **240원**
//      → 견적 앱으로 → 견적서 국2 3up 240원 ✓        ← **여기까지는 §H 도 초록이다**
//      → 다시 고객 화면으로 → 쇼룸이 **2up 312원** 으로 돌아가고 mUp 이 주소에서 증발
//      → 견적 앱으로 → 견적서 **2up 312원 · 경고 없음**
//    Δ **+72원/개(+30%)**. 운영자가 확정한 배치가 왕복 한 번에 사라진다.
//  §H 는 「쇼룸 → 견적서」 한 번만 재므로 2회차의 소실을 **원리적으로 못 본다.**
//  그래서 여기서 고리를 **세 바퀴** 돌린다. 2회차 = 3회차 = 1회차여야 한다.
//
//  ⚠ 이 절이 재는 것은 「값이 안 변한다」이지 「값이 크다」가 아니다. 복원에 실패하면
//    (사람이 손으로 끌어 만든 배치 등) 쇼룸은 **덜 앉히고 그 수로 청구**한다 —
//    비싸지는 쪽이라 안전하고, 그때는 아래 「고정 소실은 조용하지 않다」가 지킨다.
console.log("\n── §K  왕복 2~3회차에서 판형·up·개당단가가 그대로인가 ────────");

/** 쇼룸 한 바퀴 = 화면(showroomScreen) → 「견적 앱으로」 링크(linkStateOf) → 견적서.
 *  ★ 링크 조립도 화면과 같은 함수를 쓴다 — 여기서 손으로 지으면 §F 의 실패가 재발한다. */
const oneLap = (carried, adoptFree) => {
  const r = showroomScreen(carried, adoptFree ? { adoptFree: true } : {});
  if (!r.up) return { r, back: null, q: null };
  const back = decodeSpec(payloadOfHash(specHash("", linkStateOf({
    carried, mode: carried?.sizeMode === "net" ? "net" : "box",
    boxType: carried.boxType, bW: carried.bW, bD: carried.bD, bH: carried.bH,
    netW: +carried.nW, netH: +carried.nH,
    sheetId: r.sheetId, qty: carried.qty, up: r.up, gridUp: r.gridUp,
  }))));
  return { r, back, q: quoteScreen(back) };
};
const sig = l => `${l.r.sheetId}/${l.r.up}up/${l.q.totals.perEA}원`;

let lapPass = 0, lapAdopted = 0, lapSheets = 0;
for (const id of SHEET_IDS) {
  const s0 = { ...SOSCO, sheetId: id };
  // 1회차 — 운영자가 자유해를 **채택한다**(있으면). 이게 실측이 밟은 그 클릭이다.
  const l1 = oneLap(s0, true);
  if (!l1.q) { ok(`${id} — 3회차 스윕에서 빠졌다(배치 없음)`, false); continue; }
  lapSheets++;
  if (l1.r.up > l1.r.gridUp) lapAdopted++;

  // 2회차 — 그 링크로 **다시** 쇼룸에 들어간다. 버튼은 안 누른다(자동 배치만 돈다).
  const l2 = oneLap(l1.back, false);
  // 3회차 — 한 바퀴 더. 2회차와 3회차가 다르면 값이 계속 흐르고 있다는 뜻이다.
  const l3 = l2.q ? oneLap(l2.back, false) : { r: l2.r, back: null, q: null };

  const same = !!l2.q && !!l3.q && sig(l1) === sig(l2) && sig(l2) === sig(l3);
  ok(`${id} · 왕복 1→2→3회차 — ${sig(l1)} = ${l2.q ? sig(l2) : "없음"} = ${l3.q ? sig(l3) : "없음"}`,
     same,
     `1회차 ${sig(l1)} / 2회차 ${l2.q ? sig(l2) : "없음"} / 3회차 ${l3.q ? sig(l3) : "없음"} ` +
     `(격자 ${l1.r.gridUp} · 자유 ${l1.r.freeUp} · 2회차 복원 ${l2.r.restored} · 부족 ${l2.r.shortOf})`);
  if (same) lapPass++;

  // 2회차 링크에 판걸이가 **실려 있어야** 한다 — 이 고장의 실제 증상이 「주소에서
  // mUp 이 사라진다」였다. 격자해와 같은 수일 때만 안 싣는 것이 정상이다.
  if (l2.q) {
    const wantPin = l2.r.up !== l2.r.gridUp;
    ok(`${id} · 2회차 링크의 판걸이 표기가 맞다 (${l2.back.mUp ? `mUpV=${l2.back.mUpV}` : "없음"})`,
       !!l2.back.mUp === wantPin && (!wantPin || +l2.back.mUpV === l2.r.up),
       `그린 ${l2.r.up}up · 격자 ${l2.r.gridUp}up → ${wantPin ? "실어야" : "안 실어야"} 한다`);
  }
}
ok(`왕복 3회차 불변식이 판형 ${lapSheets}개 전부에서 성립한다`, lapPass === lapSheets && lapSheets > 0,
   `${lapPass}/${lapSheets}`);
// 이빨 ①: 자유해를 실제로 채택한 판형이 스윕에 있어야 한다. 0 이면 위 줄들은
//   「격자해가 격자해로 돌아온다」만 잰 것이고, 이 고장을 원리적으로 못 밟는다.
ok(`스윕에서 자유해를 실제로 채택한 판형이 있다 (${lapAdopted}개)`, lapAdopted >= 3,
   `채택 ${lapAdopted}개 — 0 이면 §K 는 major ⑨ 를 못 잡는다`);

// ── 이빨 ②: **고친 그 자리**를 되돌리면 빨개지는가 ────────────────
//  종전 동작 = 재진입 씨앗을 capToQuoteUp 만으로 정한다(자르기만 · 복원 없음).
//  그 씨앗으로 2회차를 돌리면 실측 그대로 up 이 줄고 개당단가가 오르는지 센다.
{
  const s0 = { ...SOSCO, sheetId: "guk2" };
  const l1 = oneLap(s0, true);
  const c = l1.back;
  // 2회차를 **종전 규칙**으로 다시 푼다
  const auto = buildQuote(quoteInputOf({
    mode: "box", boxType: c.boxType, W: +c.bW, D: +c.bD, H: +c.bH,
    sheetId: c.sheetId, qty: +c.qty, up: 0, carried: c }));
  const sb = findSheetBase(c.sheetId);
  const fr = frameOf(resolveSheet(sb, customSheetOf(c)));
  const pt = partOf({ kind: "box", dieline: auto.dieline });
  const ap = autoPlace(pt.P, fr, auto.layout?.up > 0 ? auto.layout.boxes : []);
  const oldUp = capToQuoteUp(c, ap.items).length;                  // 종전
  const newUp = seedFromAuto(c, ap).items.length;                  // 지금
  const priced = n => buildQuote(quoteInputOf({
    mode: "box", boxType: c.boxType, W: +c.bW, D: +c.bD, H: +c.bH,
    sheetId: c.sheetId, qty: +c.qty, up: n, carried: c })).totals.perEA;
  ok(`이빨 — 국2 에서 자유해 채택이 실제로 일어난다 (격자 ${ap.gridUp} → 자유 ${ap.freeUp})`,
     ap.freeUp > ap.gridUp, `격자 ${ap.gridUp} · 자유 ${ap.freeUp}`);
  ok(`이빨 — 종전 씨앗(자르기만)이면 2회차에 ${oldUp}up 으로 되돌아간다 ` +
     `(지금은 ${newUp}up 을 되살린다)`, oldUp < newUp && newUp === +c.mUpV,
     `종전 ${oldUp}up · 지금 ${newUp}up · 실려온 고정 ${c.mUpV}`);
  ok(`그 되돌아감의 방향이 「+30%」였다 — ${priced(newUp)}원 → ${priced(oldUp)}원 ` +
     `(+${Math.round((priced(oldUp) / priced(newUp) - 1) * 100)}%)`,
     priced(oldUp) > priced(newUp));
}

// ── 고정 소실은 **조용하지 않다** ─────────────────────────────────
//  복원이 원리적으로 안 되는 경우(사람이 손으로 끌어 만든 배치)는 덜 앉히고 그 수로
//  청구한다 = 비싸지는 쪽이라 안전하다. 그래도 화면이 **말해야** 한다 — 이번 고장의
//  본체는 숫자가 아니라 **침묵**이었다. seedFromAuto 가 shortOf 로 그것을 낸다.
{
  const s0 = { ...SOSCO, sheetId: "4x62" };
  const r = showroomScreen(s0);
  const impossible = { ...s0, mUp: true, mUpV: String(r.up + 5) };   // 판에 안 들어가는 수
  const r2 = showroomScreen(impossible);
  ok(`복원 못 하면 shortOf 로 알린다 (고정 ${r.up + 5} · 실제 ${r2.up})`,
     r2.shortOf === r.up + 5 && r2.up < r.up + 5, `shortOf=${r2.shortOf} · up=${r2.up}`);
  // ⚠ 26-08-19 정정 — 아래 두 판정을 **갈랐다.**
  //   종전에는 `r2.perEA >= r.perEA` 하나였고 실측이 204 → 204(같음)이라 **등호로만**
  //   통과했다. 즉 「비싸진다」를 한 번도 관측하지 않은 채 초록이었다. 게다가 이 구성은
  //   원리적으로 늘 등호다 — 고정 수가 판에 안 들어가면 seedFromAuto 가 capToQuoteUp
  //   으로 떨어지고, 자를 것이 없으므로 그린 수 = 자동 배치 수(= r.up) 그대로다.
  //   ⟹ ① 그 등호를 등호라고 부른다(관측 여부를 출력에 남긴다).
  //      ② 「비싸지는 쪽」은 **고정 수로 청구했을 때와 비교해서** 실제로 관측한다.
  const same = r2.perEA === r.perEA;
  ok(`그린 수가 자동 배치 수와 같으니 단가도 같다` +
     `${same ? "  — 이 줄은 **등호로 통과**한다 = 「비싸진다」는 여기서 관측되지 않는다" : ""}`,
     r2.perEA >= r.perEA, `${r.perEA}원 → ${r2.perEA}원`);
  // 「비싸지는 쪽」의 실관측 — 고정 수(복원됐다면 청구했을 수)로 값을 매겨 대조한다.
  //   overrides.up 경로라 판에 안 들어가는 수도 값이 매겨진다(quote.decideSheet).
  const priceAtUp = n => quoteScreen({ ...s0, mUp: true, mUpV: String(n) })?.totals?.perEA ?? null;
  const lostUp = r.up + 5, pinned = priceAtUp(lostUp), drawn = priceAtUp(r2.up);
  ok(`그 방향이 「비싸지는 쪽」인 것을 **부등호로 관측**한다 — ` +
     `고정 ${lostUp}up ${pinned}원 → 그린 ${r2.up}up ${drawn}원 (+${drawn - pinned}원)`,
     drawn > pinned, `${pinned}원 → ${drawn}원`);
  const tt = T("ko");
  ok("그 두 상황의 문구가 화면 사전에 있다 (침묵하지 않는다)",
     typeof tt.pinRestored === "function" && typeof tt.pinLost === "function" &&
     tt.pinRestored(3).includes("3") && tt.pinLost(3, 2).includes("3"));
}

// ══════════════════════════════════════════════════════════════════
//  §L  ★ 목형별 구조 옵션 왕복 불변식 (26-08-25)
//
//  왜 새 절이 필요한가 — 이 노브는 **폴리곤을 바꾼다.** 폴리곤이 바뀌면 판걸이가
//  바뀌고 그러면 금액이 바뀐다. 즉 이 두 칸은 §B 가 재는 204원 게이트와 **같은 등급**이다.
//  실리면 증상은 「같은 박스인데 견적서 2up · 쇼룸 1up」이고, 방향이 하필
//  **쇼룸(고객 앞 화면)이 더 비싸게** 나오는 쪽이라 부스에서 그대로 들킨다.
//
//  §A 가 SPEC_KEYS 빠짐을 Proxy 로 잡지만 그것만으로는 부족하다 — 키가 실려도
//  도메인까지 **관통**하지 않으면(quote.buildDieline → dielinePieces → st.flaps)
//  두 화면이 같은 값을 받고도 같은 도형을 안 그린다. 그래서 여기는
//  「키가 실렸는가」가 아니라 **「값이 금액을 움직이고, 그 움직임이 왕복에서 산다」**를 잰다.
// ══════════════════════════════════════════════════════════════════
console.log("\n── §L  목형별 구조 옵션이 두 화면에 같이 흘러가는가 ──────────");
{
  // 사례 ① 삼면접착 LUXEN 130×130×55 @788×480 — 견적서 2up.
  //   기본(미지정)은 1up · deepFlap=far 로 지정하면 2up 이 된다.
  const LUX = { ...INITIAL_STATE, ...STD, boxType: "glue_3side",
                bW: "130", bD: "130", bH: "55", sheetId: "custom",
                cusW: "788", cusH: "480", cusCut: "2", qty: "4000" };
  const auto = quoteScreen(LUX), far = quoteScreen({ ...LUX, dieDeep: "far" });
  // ★ 26-08-25(2차) — 단언을 **방향에서 관통으로** 약화했다.
  //   종전: `far.sheet.up > auto.sheet.up && far.totals.perEA < auto.totals.perEA`.
  //   그건 「far 가 up 을 늘리고 개당단가를 낮춘다」는 **미검증 모델 가정**을 배선
  //   검사에 계약으로 박은 것이다. 모델이 나중에 고쳐져 far 가 up 을 못 벌면 배선이
  //   멀쩡한데도 이 줄이 죽는다(실제로 LUXEN 추정 철회로 그 상황이 왔다).
  //   §L 의 목적은 「노브가 도메인까지 도달하고 왕복해도 같은 금액이 나온다」이고,
  //   방향 주장은 **점수판(verify-net·scorecard-*)이 소유한다.**
  ok(`① deepFlap 이 도메인까지 도달한다 (미지정 ${auto.sheet.up}up ${auto.totals.perEA}원 ` +
     `→ far ${far.sheet.up}up ${far.totals.perEA}원)`,
     far.dieline.dieOpt.deepFlap === "far" && auto.dieline.dieOpt.deepFlap === undefined &&
     far.dieline.key !== auto.dieline.key,
     `dieOpt ${JSON.stringify(far.dieline.dieOpt)} · key ${far.dieline.key}`);
  // 사례 ② 십자 70×70×55 @하4. 기본은 탭 24.03(안전 봉투).
  const CRS = { ...INITIAL_STATE, ...STD, boxType: "cross",
                bW: "70", bD: "70", bH: "55", sheetId: "ha4", qty: "4000" };
  const cAuto = quoteScreen(CRS), cDie = quoteScreen({ ...CRS, dieTabW: "15.7" });
  ok(`② glueTabW 가 도메인까지 도달한다 (미지정 ${cAuto.sheet.up}up ${cAuto.totals.perEA}원 ` +
     `→ 15.7mm ${cDie.sheet.up}up ${cDie.totals.perEA}원)`,
     cDie.dieline.dieOpt.glueTabW === 15.7 && cAuto.dieline.dieOpt.glueTabW === undefined &&
     Math.abs(cDie.dieline.net.netW - cAuto.dieline.net.netW) > 0.01,
     `netW ${cAuto.dieline.net.netW} → ${cDie.dieline.net.netW}`);

  // ★ 본게임: 그 움직임이 **쇼룸에도 같이** 간다. 해시를 실제로 거친다 —
  //   SPEC_KEYS 가 이 두 키를 빠뜨리면 여기서 죽는다.
  for (const [nm, st] of [["① LUXEN far", { ...LUX, dieDeep: "far" }],
                          ["② 십자 탭 15.7", { ...CRS, dieTabW: "15.7" }]]) {
    const back = decodeSpec(payloadOfHash(specHash("showroom", st)));
    ok(`${nm} — 목형 옵션이 해시 왕복에서 살아온다`,
       back?.dieDeep === st.dieDeep && back?.dieTabW === st.dieTabW,
       `dieDeep ${back?.dieDeep} · dieTabW ${back?.dieTabW}`);
    const a = quoteScreen(st), b = quoteScreen(back);
    ok(`${nm} — 왕복 후에도 개당단가가 같다 (${a.totals.perEA}원)`,
       a.totals.perEA === b.totals.perEA && a.sheet.up === b.sheet.up,
       `${a.sheet.up}up ${a.totals.perEA}원 → ${b.sheet.up}up ${b.totals.perEA}원`);
    // 쇼룸 화면이 실제로 그 도형을 받는가 — quoteInputOf 는 baseOf(carried) 를
    // 펼치므로 상태 한 벌이 통째로 넘어간다. 그 경로를 직접 잰다.
    const qi = quoteInputOf({ mode: "box", boxType: back.boxType, W: +back.bW, D: +back.bD,
                              H: +back.bH, sheetId: back.sheetId, qty: +back.qty, up: 0,
                              carried: back });
    ok(`${nm} — 쇼룸 경로(quoteInputOf)에도 같은 목형 옵션이 실린다`,
       String(qi.box.dieOpt.deepFlap ?? "") === String(st.dieDeep) &&
       String(qi.box.dieOpt.glueTabW ?? "") === String(st.dieTabW),
       JSON.stringify(qi.box.dieOpt));
    ok(`${nm} — 쇼룸 화면 개당단가가 견적서와 같다`,
       showroomScreen(back, { mode: "box", boxType: back.boxType, bW: +back.bW, bD: +back.bD,
                              bH: +back.bH, sheetId: back.sheetId, qty: +back.qty }).perEA
         === a.totals.perEA,
       `견적서 ${a.totals.perEA}원`);
  }

  // ⚠ 값을 **안 준** 상태가 왕복에서 조용히 값이 생기면 안 된다 — 기본값은 안전
  //   봉투고, 왕복만 했는데 견적이 싸지면 그게 곧 「조용히 싸게 부른다」다.
  const plain = decodeSpec(payloadOfHash(specHash("showroom", LUX)));
  ok("⚠ 미지정은 왕복해도 미지정이다 (자동으로 켜지지 않는다)",
     plain.dieDeep === "" && plain.dieTabW === "" &&
     quoteScreen(plain).sheet.up === auto.sheet.up,
     `dieDeep="${plain.dieDeep}" dieTabW="${plain.dieTabW}" up=${quoteScreen(plain).sheet.up}`);
  // 범위 밖 오타는 도메인이 기본 봉투로 접는다 — 작게 그려 겹치는 판을 내는 것보다 낫다.
  for (const bad of ["0.5", "999", "61"]) {
    const q = quoteScreen({ ...CRS, dieTabW: bad });
    ok(`⚠ 범위 밖 탭폭(${bad}mm)은 기본 봉투로 접힌다`,
       q.sheet.up === cAuto.sheet.up &&
       Math.abs(q.dieline.net.netW - cAuto.dieline.net.netW) < 0.001,
       `up ${q.sheet.up} netW ${q.dieline.net.netW}`);
    // ★ 26-08-25(2차) 신설 — **화면 문구까지** 잰다.
    //   종전에는 접힘(위 줄)만 재고 문구는 안 쟀다. 그 사이에 실제 사고가 있었다:
    //   접기가 cross.netSize 안에서만 일어나고 pickDieOpt 는 빈값만 걸러서
    //   `dieline.dieOpt.glueTabW` 에 **원값 999** 가 남았고, BoxSpec 은 그걸
    //   「적용된 값」이라 믿고 「✓ 목형 지정 — 접착탭 실폭 999mm 으로 계산했다」고
    //   진술했다. 화면이 dieline.dieOpt 를 읽으므로 여기서 그 칸이 비어 있으면
    //   화면은 자동으로 「⚠ 목형 미지정」이 된다.
    //   특히 61(=상한 초과)은 종전에 netW 를 303.33 → 340.30 이 아니라 **작게**
    //   만들어 up 을 늘리고 최대 −36.6% 싸게 청구했다 = 안전방향 표의 최악 칸.
    ok(`⚠ 범위 밖 탭폭(${bad}mm)이 화면 문구에 그대로 안 나온다 (dieOpt 가 비어 있다)`,
       q.dieline.dieOpt.glueTabW === undefined,
       `dieOpt ${JSON.stringify(q.dieline.dieOpt)}`);
  }
  // 허용범위 안이면 **반드시** 실린다 — 위 게이트가 「전부 버린다」로 통과하지 못하게.
  for (const good of ["12.03", "24.03", "5", "60"]) {
    const q = quoteScreen({ ...CRS, dieTabW: good });
    ok(`✓ 허용범위 탭폭(${good}mm)은 dieOpt 에 실린다`,
       q.dieline.dieOpt.glueTabW === Number(good),
       `dieOpt ${JSON.stringify(q.dieline.dieOpt)}`);
  }
  // choice 노브도 같은 규약 — options 에 없는 id 는 안 실린다.
  {
    const q = quoteScreen({ ...LUX, dieDeep: "sideways" });
    ok("⚠ 목록에 없는 deepFlap 값은 dieOpt 에 안 실린다",
       q.dieline.dieOpt.deepFlap === undefined && q.sheet.up === auto.sheet.up,
       `dieOpt ${JSON.stringify(q.dieline.dieOpt)}`);
  }
}

// ══════════════════════════════════════════════════════════════════
//  §M  ★ 관리자 수식 → 고객 표시가 (26-08-25)
//
//  왜 여기인가 — 새 스위트를 만들지 않았다. 이 절이 재는 것은 **쇼룸이 고객에게
//  보여주는 금액**이고, 그건 §B 의 204원 게이트와 같은 대상이다. 두 파일로 갈리면
//  「§B 는 204 를 지키는데 §M 은 그 204 가 화면에 안 나오는지를 지킨다」는 관계가
//  다음 사람에게 안 보인다.
//
//  이 기능의 위험은 셋이고 셋 다 여기서 잰다:
//   ① 부스에서 사람이 치는 문자열이 **코드가 되는 것** → eval·Function 0건 grep
//   ② 수식이 켜졌는데 화면·DOM 에 **원가가 남는 것** → 원가 유출 검사(이 절의 본체)
//   ③ 수식이 틀렸을 때 **원가로 조용히 되돌아가는 것** → 거부는 「—」다
//  그리고 넷째 — 수식을 안 넣은 사람에게는 **아무것도 안 바뀌어야 한다**(하위호환).
// ══════════════════════════════════════════════════════════════════
console.log("\n── §M  관리자 수식 → 고객 표시가 ─────────────────────────────");
{
  // ── ① 파서 단위시험 ────────────────────────────────────────────
  //  원가 204(★ 기준 케이스)를 좌변으로 놓고 잰다. 사용자가 실제로 쓰는 형태는
  //  **접두 연산자 사슬**(`*1.7/10`)이고, 완전식도 같은 답을 내야 한다.
  const GOOD = [
    ["*1.7/10", 34.68],   ["(*1.7/10)", 34.68], ["x*1.7/10", 34.68],
    ["원가*1.7/10", 34.68], ["(x*1.7)/10", 34.68], [" * 1.7 / 10 ", 34.68],
    ["*1.7", 346.8],      ["/10", 20.4],        ["+500", 704],
    ["-4", 200],          ["x", 204],           ["X", 204],
    ["x*1.7/10+500", 534.68],                   ["*1.7/10-4", 30.68],
    ["2+3*4", 14],        ["(2+3)*4", 20],      ["x/2/2", 51],
    ["x-1-1", 202],       ["x*.5", 102],        ["*2*3", 1224],
    ["x*(1.7/10)", 34.68],                      ["/10*2", 40.8],
    ["500", 500],         ["x*1+0", 204],
  ];
  let gp = 0;
  for (const [src, want] of GOOD) {
    const r = applyFormula(src, 204);
    const good = r.ok && Math.abs(r.v - want) < 1e-9;
    if (good) gp++;
    else ok(`정상 «${src}» → ${want}`, false, r.ok ? `실제 ${r.v}` : r.why);
  }
  ok(`정상 수식 ${GOOD.length}건이 전부 기대값을 낸다 (원가 204 기준)`,
     gp === GOOD.length, `${gp}/${GOOD.length}`);
  ok(`정상 케이스가 ${GOOD.length}건 이상이다 (요구 20건)`, GOOD.length >= 20);

  // 좌결합·우선순위를 **따로** 못박는다 — 위 표가 통째로 늙어도 이 셋은 남는다.
  ok("좌결합: 100/2/5 = 10 (100/(2/5)=250 이 아니다)", applyFormula("100/2/5", 0).v === 10);
  ok("우선순위: 2+3*4 = 14 (20 이 아니다)", applyFormula("2+3*4", 0).v === 14);
  ok("괄호가 우선순위를 이긴다: (2+3)*4 = 20", applyFormula("(2+3)*4", 0).v === 20);

  // ── ② 거부 ─────────────────────────────────────────────────────
  //  ★ 거부는 **조용하지 않다** — 이유 문자열이 반드시 있어야 한다. 조용히 막으면
  //    관리자가 부스에서 「왜 —만 뜨지」를 알 방법이 없다.
  const BAD = [
    ["", "빈 문자열"], ["   ", "공백뿐"], ["*", "연산자로 끝남"], ["/", "연산자로 끝남"],
    ["1.2.3", "소수점 둘"], [".", "소수점만"], ["(1+2", "괄호 안 닫힘"],
    ["1+2)", "괄호 안 열림"], ["()", "빈 괄호"], ["/0", "0 나눗셈"],
    ["x/(1-1)", "0 나눗셈(계산 결과)"], ["-1000", "결과 음수"], ["*-2", "결과 음수"],
    ["y*2", "모르는 식별자"], ["cost*2", "모르는 식별자"], ["1e9", "지수표기 미지원"],
    ["2^3", "쓸 수 없는 글자"], ["1,7", "쓸 수 없는 글자"], ["*1.7;alert(1)", "구분자 주입"],
    ["*1.7/10 && 1", "논리연산 주입"], ["*99999999", "결과 상한"],
    ["x".repeat(200), "길이 상한"], ["(".repeat(25) + "1" + ")".repeat(25), "괄호 깊이"],
    ["x x", "토큰이 남음"], ["원가2", "모르는 식별자"],
  ];
  let bp = 0;
  for (const [src, why] of BAD) {
    const r = applyFormula(src, 204);
    const good = !r.ok && typeof r.why === "string" && r.why.length > 0;
    if (good) bp++;
    else ok(`거부 «${src.slice(0, 24)}» (${why})`, false, r.ok ? `통과해버림 → ${r.v}` : "이유가 비었다");
  }
  ok(`거부 ${BAD.length}건이 전부 **이유와 함께** 거부된다`, bp === BAD.length, `${bp}/${BAD.length}`);
  ok(`거부 케이스가 ${BAD.length}건 이상이다 (요구 15건)`, BAD.length >= 15);

  // ── ③ ★ 실제 204원 → *1.7/10 → 34.68 → 35 ──────────────────────
  //  숫자를 손으로 적지 않는다. §B 와 **같은 경로**로 204 를 만들어 넣는다 —
  //  단가 규칙이 움직이면 이 줄도 같이 움직여야 한다.
  const real = quoteScreen(SOSCO).totals.perEA;
  ok(`기준 케이스 원가가 ★204원이다 (수식은 원가를 안 건드린다)`, real === 204, `${real}원`);
  {
    const r = applyFormula("*1.7/10", real);
    ok(`«*1.7/10» 이 원가 ${real} 을 ${r.v} 로 만든다`, r.ok && Math.abs(r.v - 34.68) < 1e-9, `${r.v}`);
    ok(`엔 반올림이 ${r.v} → 35 다 (1엔 단위)`, roundFor("JPY", r.v) === 35, `${roundFor("JPY", r.v)}`);
    const jp = shownPriceOf({ perEA: real, up: 4, cfg: { cur: "JPY", KRW: "", JPY: "*1.7/10" }, lang: "ja" });
    ok(`고객 화면에 «¥35» 로 뜬다`, jp.main === "¥35" && jp.mode === "value" && jp.cur === "JPY",
       JSON.stringify(jp));
    const kr = shownPriceOf({ perEA: real, up: 4, cfg: { cur: "KRW", KRW: "*1.35", JPY: "" }, lang: "ko" });
    ok(`원화 수식은 «275원» 형식이다 (숫자 + 단위키 won)`,
       kr.main === "275" && kr.unitKey === "won", JSON.stringify(kr));
  }

  // ── ④ ★ 원가 유출 검사 — 이 기능의 핵심 안전 검사 ────────────────
  //  수식이 켜진 상태에서 **고객이 보는 것**에 원가 숫자가 있으면 안 된다.
  //  shownPriceOf 의 반환값이 곧 고객 화면 금액 칸의 전부이므로(ShowroomPage 가
  //  그 객체만 그린다 — 아래 ⑥ 소스 계약이 그것을 강제한다) 이 객체를 문자열로
  //  훑는 것이 실제 DOM 을 훑는 것과 같은 뜻이 된다.
  for (const [nm, cfg, lang] of [
    ["엔화 *1.7/10", { cur: "JPY", KRW: "", JPY: "*1.7/10" }, "ja"],
    ["원화 *1.35",   { cur: "KRW", KRW: "*1.35", JPY: "" }, "ko"],
    ["엔화인데 수식 없음(거부)", { cur: "JPY", KRW: "*1.35", JPY: "" }, "ja"],
    ["엔화 수식이 틀림(거부)",   { cur: "JPY", KRW: "", JPY: "*1.7/" }, "ja"],
  ]) {
    const seen = JSON.stringify(shownPriceOf({ perEA: real, up: 4, cfg, lang }));
    ok(`⑀ 원가 유출 없음 — ${nm}: 고객 화면 문자열에 «${real}» 이 없다`,
       !seen.includes(String(real)), seen);
  }
  // ★ 이빨 — 위 검사가 「무엇을 봐도 통과」가 아니라는 증거. 같은 입력에서
  //   **관리자 몫**에는 원가가 반드시 있다(없으면 즉석 검산을 못 한다).
  {
    const admin = JSON.stringify(adminViewOf({
      perEA: real, up: 4, cfg: { cur: "JPY", KRW: "", JPY: "*1.7/10" }, lang: "ja" }));
    ok("이빨: 같은 입력에서 **관리자 몫**에는 원가가 있다 (검사가 공허하지 않다)",
       admin.includes(String(real)) && admin.includes("*1.7/10"), admin);
  }

  // ── ⑤ ★ 거부는 원가로 폴백하지 않는다 ───────────────────────────
  for (const src of ["*1.7/", "y*2", "/0", "-99999"]) {
    const s = shownPriceOf({ perEA: real, up: 4, cfg: { cur: "JPY", KRW: "", JPY: src }, lang: "ja" });
    ok(`거부 «${src}» → 고객 화면은 «—» (원가 폴백 없음)`,
       s.mode === "blocked" && s.main === "—", JSON.stringify(s));
    const a = adminViewOf({ perEA: real, up: 4, cfg: { cur: "JPY", KRW: "", JPY: src }, lang: "ja" });
    ok(`거부 «${src}» → 이유는 **관리자에게만** 있다`, !!a.why && a.why.length > 0, a.why);
  }

  // ── ⑥ 하위호환 — 수식 미설정이면 **종전 동작 그대로** ────────────
  //  종전 렌더는 `perEA != null && up > 0 ? perEA.toLocaleString() : "—"` + 단위 t.won.
  //  그 표현을 여기 그대로 적어 두 결과가 **같은 문자열**인지 잰다.
  for (const [perEA, up] of [[204, 4], [223, 4], [null, 0], [204, 0]]) {
    const before = perEA != null && up > 0 ? perEA.toLocaleString() : "—";
    const s = shownPriceOf({ perEA, up, cfg: EMPTY_PRICE_CFG, lang: "ko" });
    ok(`하위호환 (perEA ${perEA} · up ${up}) — 종전과 같은 문자열 «${before}» + 단위 won`,
       s.mode === "cost" && s.main === before && s.unitKey === "won", JSON.stringify(s));
  }
  ok("하위호환 — 언어가 일본어여도 미설정이면 원가 원화 그대로다",
     shownPriceOf({ perEA: 204, up: 4, cfg: EMPTY_PRICE_CFG, lang: "ja" }).main === "204");

  // ── ⑦ 통화 두 벌 · 언어와 안 묶인다 ─────────────────────────────
  {
    const both = { cur: "auto", KRW: "*1.35", JPY: "*1.7/10" };
    ok("auto — 한국어면 원화 수식을 쓴다", shownPriceOf({ perEA: 204, up: 4, cfg: both, lang: "ko" }).cur === "KRW");
    ok("auto — 일본어면 엔화 수식을 쓴다", shownPriceOf({ perEA: 204, up: 4, cfg: both, lang: "ja" }).cur === "JPY");
    ok("★ 언어와 통화는 안 묶인다 — 일본어에서 원화를 고정할 수 있다",
       shownPriceOf({ perEA: 204, up: 4, cfg: { ...both, cur: "KRW" }, lang: "ja" }).main === "275");
    ok("★ 한국어에서 엔화를 고정할 수 있다",
       shownPriceOf({ perEA: 204, up: 4, cfg: { ...both, cur: "JPY" }, lang: "ko" }).main === "¥35");
    ok("두 통화가 **각자 수식**을 갖는다 (같은 원가에서 다른 값)",
       shownPriceOf({ perEA: 204, up: 4, cfg: { ...both, cur: "KRW" }, lang: "ko" }).main !==
       shownPriceOf({ perEA: 204, up: 4, cfg: { ...both, cur: "JPY" }, lang: "ko" }).main);
  }

  // ── ⑧ ★ eval / Function 이 소스에 없다 ──────────────────────────
  //  이 수식은 부스에서 **사람이 손으로 치고** 저장소에서 되읽힌다. 코드가 되면 안 된다.
  //
  //  ★★ 이 게이트가 **무엇을 보증하지 않는지** 먼저 적는다 (26-08-26 적대검증 minor).
  //  종전 정규식은 `\beval\s*\(` · `\bnew\s+Function\b` · `\bFunction\s*\(["'\`]` 였고,
  //  실측으로 **별칭 한 번에 뚫렸다**: `const EV = (0, eval); EV(str)` 는 `eval)` 이라
  //  호출 괄호가 안 붙어 안 걸리고, `Object.getPrototypeOf(function(){}).constructor`
  //  경로에는 **Function 이라는 글자가 아예 없다**. 백도어를 심고 돌렸더니 초록이었다.
  //  ⟹ 호출 형태를 안 따지도록 넓혔다(`\beval\b` · `\bFunction\b` · `.constructor`).
  //     그래도 grep 은 `globalThis["ev"+"al"]` 같은 조립을 원리적으로 못 잡는다.
  //     그래서 이 줄이 보증하는 것은 **「그 이름들이 소스에 안 나온다」**까지다 —
  //     정직한 실수와 흔한 별칭은 잡고, 작정한 우회는 못 잡는다. 과신하지 마라.
  {
    const dir = new URL("../src/", import.meta.url);
    const files = [];
    (function walk(u) {
      for (const e of readdirSync(u, { withFileTypes: true })) {
        const c = new URL(e.name + (e.isDirectory() ? "/" : ""), u);
        if (e.isDirectory()) walk(c); else if (/[.](mjs|jsx|js)$/.test(e.name)) files.push(c);
      }
    })(dir);
    const NAMES = [/\beval\b/, /\bFunction\b/, /\.constructor\b/, /\bimport\s*\(/];
    const hits = [];
    for (const f of files) {
      const txt = readFileSync(f, "utf8");
      txt.split("\n").forEach((ln, i) => {
        // 주석 줄은 뺀다 — 「왜 안 쓰는가」를 적은 줄이 스스로를 잡으면 안 된다.
        // CR 을 먼저 턴다 — 작업 트리가 CRLF 가 되면 JS 의 . 이 CR 을 안 먹어
        // .*$ 가 줄 끝에 못 닿고 주석 제거가 통째로 실패한다. 그러면 price-formula
        // 머리말의 「eval 을 쓰지 않는다」 주석이 스스로를 잡아 이 게이트가 거짓 실패한다.
        // 실제로 한 번 그렇게 빨개졌다. 정규식에 CR 을 직접 적지 마라 — 날 CR 은
        // 정규식 리터럴을 끊는다. trimEnd() 는 이스케이프가 없어 도구를 안 탄다.
        const code = ln.trimEnd().replace(/^\s*(\/\/|\*|\/\*).*$/, "");
        if (NAMES.some(re => re.test(code))) hits.push(`${f.pathname.split("/src/")[1]}:${i + 1}`);
      });
    }
    ok(`src/ ${files.length}개 파일에 eval·Function·.constructor·동적 import 라는 **이름이 0건**이다`,
       hits.length === 0, hits.join(" · "));
    // ★ 이빨 — 넓힌 정규식이 실제로 별칭을 잡는가. 실측으로 뚫렸던 두 형태를 그대로 먹인다.
    //   ⚠ 잡는 대상은 **이름이 적힌 줄**이다. 호출부(`EV(str)`)는 이름이 없어 원리적으로
    //     못 잡는다 — 그래서 선언부를 잡는 것으로 족하다(선언 없이는 호출도 없다).
    const PIERCE = ["const EV = (0, eval);", "getPrototypeOf(f).constructor(s)",
                    "const F = Function;", 'globalThis.eval("1")'];
    const caught = PIERCE.filter(s => NAMES.some(re => re.test(s)));
    ok(`이빨: 종전 게이트를 뚫던 별칭 ${PIERCE.length}건을 지금은 전부 잡는다`,
       caught.length === PIERCE.length, `${caught.length}/${PIERCE.length}`);
    // ★ 한계를 **실행 가능한 사실로** 적어둔다 — 다음 사람이 「eval 0건」을 넓게 읽지 않게.
    ok("⚠ 알려진 한계: 조립한 이름(«'ev'+'al'»)은 grep 이 원리적으로 못 잡는다",
       !NAMES.some(re => re.test("window['ev'+'al'](s)")));
  }

  // ── ⑨ ★ 수식은 링크에 안 실린다 (마진 유출) ─────────────────────
  //  §13 이 거래처·품명에 내린 것과 **같은 종류의 판단**이다. 주소는 고객 앞에 뜨고
  //  링크로 나간다 — 거기 우리 마진율이 적혀 있으면 안 된다.
  {
    const payload = encodeSpec({ ...SOSCO, KRW: "*1.35", JPY: "*1.7/10", cur: "JPY" });
    ok("수식·통화가 해시 페이로드에 **없다**",
       !payload.includes("1.7") && !payload.includes("1.35") && !/(^|;)(cur|JPY|KRW)~/.test(payload),
       payload.slice(0, 90));
    const priceKeys = SPEC_KEYS.filter(k => /^(cur|KRW|JPY|fx|margin)/i.test(k));
    ok("SPEC_KEYS 에 표시가 관련 키가 없다 (실으려면 여기 한 줄이고, 그건 유출이다)",
       priceKeys.length === 0, priceKeys.join(","));
  }

  // ── ⑩ 저장 — 새로고침·재시작에 살아남고, 못 읽으면 **미설정**으로 접는다 ──
  //  node 에는 localStorage 가 없다. 코덱 계약을 재려고 최소 구현을 끼운다.
  {
    const box = new Map();
    const real = globalThis.localStorage;
    globalThis.localStorage = {
      getItem: k => (box.has(k) ? box.get(k) : null),
      setItem: (k, v) => box.set(k, String(v)),
    };
    savePriceCfg({ cur: "JPY", KRW: "*1.35", JPY: "*1.7/10" });
    const back = loadPriceCfg();
    ok("저장 왕복 — 수식·통화가 그대로 돌아온다",
       back.cur === "JPY" && back.KRW === "*1.35" && back.JPY === "*1.7/10", JSON.stringify(back));
    box.set("cria-quote.showprice.v1", "{깨진 JSON");
    ok("깨진 저장값이 화면을 안 죽인다 — 미설정으로 접는다",
       loadPriceCfg().JPY === "" && loadPriceCfg().cur === "auto");
    box.set("cria-quote.showprice.v1", JSON.stringify({ cur: "USD", KRW: 7, JPY: null }));
    const co = loadPriceCfg();
    ok("모르는 통화·이상한 타입은 접힌다 (cur auto · 문자열 강제)",
       co.cur === "auto" && co.KRW === "7" && co.JPY === "", JSON.stringify(co));
    globalThis.localStorage = { getItem() { throw new Error("사생활 보호 모드"); },
                                setItem() { throw new Error("사생활 보호 모드"); } };
    ok("저장소가 던져도 안 죽는다 — 미설정(= 종전 동작)으로 간다",
       loadPriceCfg().JPY === "" && (savePriceCfg({ cur: "JPY", JPY: "*2" }), true));
    if (real === undefined) delete globalThis.localStorage; else globalThis.localStorage = real;
  }

  // ── ⑪ 소스 계약 — 페이지가 원가를 **직접** 그리지 않는다 ─────────
  //  ④ 는 모델을 쟀다. 그 모델이 곧 화면인지는 **소스가** 보증해야 한다.
  {
    const p = readFileSync(new URL("../src/showroom/ShowroomPage.jsx", import.meta.url), "utf8");
    ok("금액 칸이 shown.main 만 그린다 (원가를 직접 안 쓴다)",
       /<Big value=\{shown\.main\}/.test(p) && !/<Big value=\{perEA/.test(p));
    ok("data-perea 가 **무조건** 원가를 싣지 않는다 (수식 미설정일 때만)",
       !/data-perea=\{perEA/.test(p) && /data-perea=\{shown\.mode === "cost"/.test(p));
    // 원가가 나오는 자리를 센다 — 정의 1 · shownPriceOf 투입 1 + 의존배열 1 ·
    // adminViewOf 투입 1 + 의존배열 1 · data 가드 1 = **6줄**. 이 수가 늘었다면
    // 누군가 원가를 화면에 직접 쓰기 시작한 것이다.
    // (t.perEA 는 「개당」이라는 **라벨**이지 값이 아니다 — 센 데서 뺀다.)
    const lines = p.split("\n").filter(l => /perEA/.test(l) && !/^\s*(\/\/|\*)/.test(l)
                                            && !/t\.perEA/.test(l));
    ok(`원가를 만지는 줄이 ${lines.length}줄뿐이다 (정의·모델투입·가드)`, lines.length <= 6,
       lines.map(l => l.trim().slice(0, 46)).join(" / "));
    ok("관리자 진입이 눈에 띄는 버튼이 아니다 (Ctrl+Alt+M 키 조합)",
       /e\.ctrlKey && e\.altKey/.test(p) && !/data-act="admin-open"/.test(p));
    // ★ 26-08-26 — 연타 카운터는 **모듈 스코프**여야 한다.
    //   컴포넌트 안 useRef 판은 클릭 사이에 초기화돼 **사람 손 속도에서 한 번도 안 열렸다**
    //   (실측: 간격 0ms 3연타는 열리고 60ms 는 다섯 번도 안 열림 · 직접 호출로도 재현).
    //   사용자가 「관리자페이지는 어딨지?」를 두 번 물은 것이 이 고장이고, 화면에 아무
    //   표시가 없어서 **고장인지 사용법을 모르는 건지 구분이 안 된다** — 그래서 계약으로 잡는다.
    ok("연타 카운터가 모듈 스코프다 (컴포넌트 안 ref 면 사람 속도에서 안 열린다)",
       /^const tapState = \{ n: 0, t: 0 \};$/m.test(p) && !/useRef\(\{ n: 0, t: 0 \}\)/.test(p));
    {
      // 간격 한계와 필요 횟수를 **값으로** 잡는다. 800ms 는 「또박또박 세 번」에 빡빡했다.
      const gap = +(p.match(/^const TAP_GAP_MS = (\d+);$/m)?.[1] ?? 0);
      const need = +(p.match(/^const TAP_NEED = (\d+);$/m)?.[1] ?? 0);
      ok(`연타 간격이 사람 손 속도를 덮는다 (TAP_GAP_MS=${gap} ≥ 1000)`, gap >= 1000, `실측 150·400ms 통과`);
      ok(`연타 횟수가 우연을 막는다 (TAP_NEED=${need} ≥ 3)`, need >= 3);
    }
    ok("관리자 패널이 레이아웃을 안 민다 (position fixed)",
       /data-admin="1"[\s\S]{0,400}?position: "fixed"/.test(p));
    // ★ 닫기는 **한 손가락**이어야 한다. 실측 지적: 원가 345원을 띄운 패널에서 빠져나가는
    //   길이 수식자 두 개 조합과 33×18px 글자 링크뿐이라, 고객이 다가올 때 못 닫았다.
    ok("Esc 로 관리자 패널이 닫힌다 (열기는 은밀하게 · 닫기는 한 손가락)",
       /e\.key === "Escape"[\s\S]{0,80}setAdminOpen/.test(p));
    // ★ 인쇄에 원가·수식이 실리면 안 된다 — 패널이 position:fixed 라 첫 페이지에 찍힌다.
    ok("인쇄에서 관리자 패널이 빠진다 (@media print)",
       /@media print\{\[data-admin\]\{display:none/.test(p));
    // ★ 가리는 중에는 「견적 앱으로 →」 문을 고객 화면에서 치운다 (원가 전체로 가는 문)
    ok("가리는 중이면 고객 화면의 «견적 앱으로 →» 버튼이 없다 (관리자 패널로 옮긴다)",
       /\{!hiding && \([\s\S]{0,200}data-act="back"/.test(p) &&
       /data-act="admin-toquote"/.test(p));
    // ⚠ 26-08-27 — 종전에는 **호출 한 줄을 통째로** 리터럴 대조했다(`{ nc: hiding }`).
    //   그러면 같은 opt 객체에 형제 파라미터가 하나 늘 때(팬톤 `pf`·`pb`) 「가림 비트가
    //   빠졌다」고 **거짓 실패**한다 — 비트는 그대로 있는데. 이 줄이 재려는 것은
    //   「syncHash 가 nc 를 나르는가」 하나이므로 거기까지만 잰다. 자리(어느 호출의 opt 인가)는
    //   그대로 못박는다 — 다른 곳에 `nc: hiding` 이 적혀 있는 것으로는 안 통과한다.
    ok("주소에 가림 비트를 싣는다 (syncHash 에 nc)",
       /specHash\("showroom", linkState\(sheetId\), \{[^}]*\bnc: hiding\b[^}]*\}\)/.test(p));
    // ★ 26-08-26 — 수량별 표도 **표시값만** 그린다. 이 표는 화면에서 가장 여러 번 읽히는
    //   숫자라(부스 대화의 본체), 여기로 원가가 새면 큰 글씨 하나를 가린 것이 무의미해진다.
    //   위 「원가를 만지는 줄 6줄」이 안 늘어난 것과 짝이다 — 표는 원가 배열을 받지 않고
    //   price-formula.shownRowsOf 가 만든 표시행만 받는다.
    ok("수량별 표가 shownRowsOf 결과만 그린다 (원가 배열을 직접 안 그린다)",
       /shownRowsOf\(\{ rows: qtyRows/.test(p) &&
       /data-qty-shown=\{r\.main\}/.test(p) &&
       !/data-qty(-shown)?=\{[^}]*perEA/.test(p));
  }

  // ── ⑫ ★★ 0 게이트 — 고객 화면에 0 이 뜨는 경로 **전수** ──────────
  //  실측으로 나온 지적: `*0` 이 거부되지 않고 mode "value" 로 **¥0** 을 그렸다.
  //  산술은 맞다 — 틀린 것은 「화면에 0 을 띄워도 된다」는 가정이다. 부스에서 오타
  //  하나가 고객 앞에 ¥0 을 놓으면 그 자리에서 발주를 받을 수 없다.
  //  ★ 게이트는 **반올림 뒤**에 있다(price-formula ZERO GATE). 그래서 세 부류가
  //    한 자리에서 막힌다 — 정확한 0 · 반올림해서 0 · IEEE 음의 0.
  {
    const Z_EXACT = ["*0", "*0.0", "*.0", "*00", "x*0", "X*0", "원가*0", "(*0)", "*0*5",
                     "0", "0.0", "(0)", "*(1-1)", "-204", "x-204", "x-x", "204-x",
                     "+0-204", "*1-204", "+(-204)"];
    const Z_ROUND = ["/1000000000", "/100000000", "*0.001", "*0.0001", "/10000", "/500",
                     "/409", "/408.1", "*0.002", "*0.00245", "-203.6", "x*0.0024", "*2/1000"];
    // ★ IEEE -0 — `v < 0` 은 **-0 < 0 === false** 라 음수 검사를 그냥 통과했고,
    //   Math.round(-0) === -0 · (-0).toLocaleString() === "-0" 이라 화면에 「¥-0」이
    //   떴다(브라우저 실측). 부호는 evalFormula 가 지우고 값은 0 게이트가 막는다.
    const Z_NEG0 = ["*-0", "*0*-1", "*-0.0", "x*-0", "(*-0)", "/1*-0", "*0/-1", "*(0*-1)", "*(-0)"];
    const ALL = [...Z_EXACT, ...Z_ROUND, ...Z_NEG0];
    const leaked = [];
    for (const src of ALL) {
      for (const [cur, lang] of [["JPY", "ja"], ["KRW", "ko"]]) {
        const s = shownPriceOf({ perEA: real, up: 4,
          cfg: { cur, KRW: cur === "KRW" ? src : "", JPY: cur === "JPY" ? src : "" }, lang });
        // 「—」가 아니거나 mode 가 blocked 가 아니면 화면에 0 이 뜬 것이다.
        if (s.mode !== "blocked" || s.main !== "—") leaked.push(`${cur} «${src}» → ${s.main}`);
      }
    }
    ok(`0 부류 ${ALL.length}건 × 통화 2벌이 **전부** 거부된다 — 화면에 0 이 안 뜬다`,
       leaked.length === 0, leaked.slice(0, 6).join(" / "));
    ok(`0 부류 표본이 ${ALL.length}건 이상이다 (정확한 0 ${Z_EXACT.length} · 반올림 0 ` +
       `${Z_ROUND.length} · 음의 0 ${Z_NEG0.length})`, ALL.length >= 40);
    // 이유가 **있어야** 한다 — 조용히 「—」면 부스에서 왜인지 알 수 없다.
    {
      const a = adminViewOf({ perEA: real, up: 4, cfg: { cur: "JPY", KRW: "", JPY: "*0" }, lang: "ja" });
      ok("0 거부에는 이유가 붙는다 (관리자에게만)", /0/.test(a.why) && a.why.length > 10, a.why);
    }
    // ★ 경계 — 반열림 [0, 0.5) 만 0 이다. 정확히 0.5 는 살아서 ¥1 이 된다.
    //   (이 두 줄이 「0 게이트가 너무 넓게 먹는다」를 막는다.)
    for (const [src, want] of [["/408", "¥1"], ["-203.5", "¥1"]]) {
      const s = shownPriceOf({ perEA: 204, up: 4, cfg: { cur: "JPY", KRW: "", JPY: src }, lang: "ja" });
      ok(`경계 «${src}» 는 정확히 0.5 라 살아남는다 → ${want}`, s.main === want, JSON.stringify(s));
    }
    // ★ 원가가 작을 때 — **정확값으로 재면 못 잡는** 자리다(0.4 는 0 이 아니다).
    ok("원가 1원의 «*0.4» 도 막힌다 (정확값 0.4 → 화면 0) — 반올림 뒤에 재는 이유",
       shownPriceOf({ perEA: 1, up: 4, cfg: { cur: "JPY", KRW: "", JPY: "*0.4" }, lang: "ja" })
         .mode === "blocked");
    ok("원가 1원의 «*0.6» 은 살아난다 (화면 ¥1)",
       shownPriceOf({ perEA: 1, up: 4, cfg: { cur: "JPY", KRW: "", JPY: "*0.6" }, lang: "ja" })
         .main === "¥1");
  }

  // ── ⑬ 상식 밴드 — 0 의 **반대쪽 끝**. 거부가 아니라 관리자 경고다 ──
  //  ¥0 은 누가 봐도 틀렸지만 `/10` 이 빠진 ¥379 는 진짜처럼 보인다 — 상업적으로
  //  이쪽이 더 위험하다. 밴드가 **통화마다** 다른 것이 요점이다(배율 1.7 은 원화에서
  //  정상 마진 · 엔화에서 「환율을 안 나눴다」).
  {
    const av = (src, cur) => adminViewOf({ perEA: 223, up: 4,
      cfg: { cur, KRW: cur === "KRW" ? src : "", JPY: cur === "JPY" ? src : "" }, lang: "ja" });
    ok("정상 «*1.7/10» (엔) 에는 경고가 없다", av("*1.7/10", "JPY").warn === "");
    ok("정상 «*1.35» (원) 에는 경고가 없다", av("*1.35", "KRW").warn === "");
    for (const src of ["*1.7", "*17/10", "*1.7*10"]) {
      const a = av(src, "JPY");
      ok(`엔 «${src}» → ${a.main} 는 화면에 뜨되 **관리자에게 붉게** 경고한다`,
         a.mode === "value" && !!a.warn, a.warn);
      ok(`엔 «${src}» 경고가 고객 몫에는 **없다**`,
         !JSON.stringify(shownPriceOf({ perEA: 223, up: 4,
           cfg: { cur: "JPY", KRW: "", JPY: src }, lang: "ja" })).includes("밴드"));
    }
    ok("원 «*0.9» — 원가보다 낮으면 경고한다 (손해)", !!av("*0.9", "KRW").warn);
    ok("★ 거부가 아니다 — 밴드 밖이어도 값은 그린다 (환율은 그날 그날이다)",
       av("*1.7", "JPY").main === "¥379");
  }

  // ── ⑭ 全角(전각) — 일본 IME 가 실제로 내는 글자를 읽는다 ──────────
  //  실측: 日本語 IME 전각 모드에서 `*1.7/10` 은 `＊1.7／10` 으로 들어왔고 종전에는
  //  「쓸 수 없는 글자입니다 — «＊»」로 거부됐다. 11.5px 에서 ＊ 와 * 는 구별되지
  //  않는다 — 거부는 안전했지만 **부스에서 고칠 수가 없었다.**
  {
    for (const src of ["＊1.7/10", "*１.７/１０", "*1.7／10", "＊１．７／１０", "ｘ*1.7/10", "＊1.7　/　10"]) {
      const r = applyFormula(src, 204);
      ok(`전각 «${src}» 이 반각과 같은 값을 낸다 (34.68)`,
         r.ok && Math.abs(r.v - 34.68) < 1e-9, r.ok ? String(r.v) : r.why);
    }
    ok("전각 ー(長音符) 는 빼기다 — 전각 모드에서 «-» 키가 내는 글자",
       applyFormula("*1.7ー4", 204).v === 342.8);
    // 모르는 글자는 여전히 거부한다. 다만 **코드포인트를 같이** 말한다 —
    // 제로폭 공백은 «» 로 보여 꺾쇠 사이가 비어 있었다(운영자가 판독 불가).
    const zw = applyFormula("*1.7​/10", 204);
    ok("보이지 않는 글자(제로폭 공백)를 거부하고 **이름을 말한다**",
       !zw.ok && zw.why.includes("U+200B"), zw.why);
    ok("모르는 글자는 여전히 거부한다 (전각 정규화가 문법을 넓히지 않는다)",
       !applyFormula("*1.7¥10", 204).ok && !applyFormula("2^3", 204).ok);
  }

  // ── ⑮ ★★ 「가격을 가림」 비트 — 링크가 원가를 흘리지 않는가 ────────
  //  실측 critical: 수식을 해시에 안 싣는 판단은 옳았지만, 해시는 **사양 전부**를
  //  싣는다. 부스가 ¥59 를 띄우던 그 주소를 빈 브라우저(= 링크를 받은 고객)에서 열면
  //  isPriceOn 이 거짓 → mode "cost" → **「345 원」**이 그대로 그려졌다.
  {
    const st = { ...SOSCO, mUp: true, mUpV: "4" };
    const plain = specHash("showroom", st);
    const hidden = specHash("showroom", st, { nc: true });
    ok("가림 비트를 안 주면 해시가 **종전과 바이트 동일**하다 (기존 링크가 안 움직인다)",
       plain === specHash("showroom", st, {}) && !noCostOfHash(plain), plain.slice(0, 60));
    ok("가림 비트를 실으면 주소가 «&nc=1» 을 단다", hidden.endsWith("&nc=1") && noCostOfHash(hidden));
    ok("비트를 달아도 **사양은 그대로 왕복한다** (payloadOfHash 는 q 만 읽는다)",
       JSON.stringify(decodeSpec(payloadOfHash(hidden))) ===
       JSON.stringify(decodeSpec(payloadOfHash(plain))));
    ok("비트에 마진이 안 실린다 — 주소에 1.7 도 1.35 도 없다",
       !hidden.includes("1.7") && !hidden.includes("1.35"));
    // ★ 본체 — 그 주소를 **남의 브라우저**(수식 없음)에서 열면 원가로 접히지 않는다.
    const asCustomer = shownPriceOf({ perEA: real, up: 4, cfg: EMPTY_PRICE_CFG, lang: "ko",
                                      hideCost: noCostOfHash(hidden) });
    ok(`★ 가림 링크를 남의 브라우저에서 열면 «—» 다 (원가 ${real} 이 안 보인다)`,
       asCustomer.main === "—" && asCustomer.mode === "hidden" &&
       !JSON.stringify(asCustomer).includes(String(real)), JSON.stringify(asCustomer));
    // 이빨 — 비트가 없으면 **종전대로 원가가 뜬다**. 이 줄이 위 검사가 공허하지 않다는 증거다.
    const asBefore = shownPriceOf({ perEA: real, up: 4, cfg: EMPTY_PRICE_CFG, lang: "ko",
                                    hideCost: noCostOfHash(plain) });
    ok(`이빨: 비트가 없으면 종전대로 원가(${real})가 뜬다 — 하위호환이 안 깨졌다`,
       asBefore.mode === "cost" && asBefore.main === String(real), JSON.stringify(asBefore));
    ok("관리자에게는 왜 «—» 인지 이유가 있다 (없으면 부스에서 못 고친다)",
       !!adminViewOf({ perEA: real, up: 4, cfg: EMPTY_PRICE_CFG, lang: "ko", hideCost: true }).why);
    // ⚠ 이 비트가 막는 것은 실수이지 고의가 아니다 — 지우면 보인다. 그 사실을 **적어둔다**
    //   (게이트가 보증하지 않는 것을 게이트 옆에 적는 것이 이 스위트의 규율이다).
    ok("⚠ 알려진 한계: 주소에서 nc=1 을 지우면 원가가 보인다 (계산이 클라이언트에 있다)",
       shownPriceOf({ perEA: real, up: 4, cfg: EMPTY_PRICE_CFG, lang: "ko",
                      hideCost: noCostOfHash(hidden.replace("&nc=1", "")) }).mode === "cost");
    // 관리자 문구가 **안심시키지 않는다** — 종전 문구가 「보내도 안전하다」로 읽혔다.
    ok("관리자 문구가 링크의 위험을 명시한다 (안심시키는 어조 금지)",
       ADMIN_T.link.includes("지우면") && ADMIN_T.link.includes("원가가 보입니다") &&
       !/유출 방지/.test(ADMIN_T.store), ADMIN_T.store);
  }

  // ── ⑯ ★★ 렌더 게이트 — **모델이 아니라 화면 문자열**을 잰다 ────────
  //  왜 필요한가 (26-08-26 적대검증 critical): ④ 는 shownPriceOf 의 **반환 객체**를
  //  훑고 ⑪ 은 소스를 정규식으로 본다. 둘 다 **관리자 패널 렌더 경로를 안 지나간다.**
  //  실증된 구멍: ShowroomPage 에서 `adminOpen ? adminViewOf(…) : null` 의 조건을
  //  없애고 `{adminOpen && av && (` 를 `{av && (` 로 바꾸면 **원가·수식·마진이 고객
  //  화면에 영구히 박히는데** 이 스위트는 209/209 초록이었다(브라우저로도 확인).
  //  「화면에 원가 문자열이 없다」를 재려면 **화면 문자열이 있어야 한다** — 그래서
  //  react-dom/server 로 페이지를 실제로 그려서 훑는다.
  //
  //  ⚠ 이 게이트가 못 보는 것: SSR 은 useEffect 를 안 돌리므로 **자동 배치가 안 앉는다**
  //    (items 가 null → up 0 → 원가 자체가 없다). 그래서 원가 **숫자**를 재려면
  //    씨앗을 심어야 하고, 그 자리는 아래 (c) 에서 **명시적으로** 심는다.
  {
    const { transform } = await import("esbuild");
    const React = (await import("react")).default;
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { mkdirSync, writeFileSync, rmSync } = await import("node:fs");
    const jsxUrl = new URL("../src/showroom/ShowroomPage.jsx", import.meta.url);
    const outDir = new URL("../node_modules/.speclink/", import.meta.url);
    mkdirSync(outDir, { recursive: true });
    let seq = 0;

    /** JSX 를 그대로(또는 mutate 한 뒤) 변환해 실제로 렌더한다.
     *  hash·store 를 주면 브라우저 전역을 흉내낸다 — 컴포넌트가 마운트 때 읽는 값이다. */
    const render = async ({ mutate, hash, store } = {}) => {
      const src = mutate ? mutate(readFileSync(jsxUrl, "utf8")) : readFileSync(jsxUrl, "utf8");
      const out = await transform(src, { loader: "jsx", format: "esm", jsx: "automatic" });
      // 상대 import 를 절대 URL 로 바꾼다 — 변환본이 원본과 다른 폴더에 놓이기 때문이다.
      const code = out.code.replace(/(\bfrom\s*")(\.[^"]*)(")/g,
                                    (_, a, spec, c) => a + new URL(spec, jsxUrl).href + c);
      const file = new URL(`ssr${seq++}.mjs`, outDir);
      writeFileSync(file, code);
      const win = globalThis.window, ls = globalThis.localStorage;
      if (hash) globalThis.window = { location: { hash } };
      if (store) globalThis.localStorage = { getItem: () => JSON.stringify(store), setItem() {} };
      try {
        const Page = (await import(file.href)).default;
        return renderToStaticMarkup(React.createElement(Page, { carried: SOSCO }));
      } finally {
        if (win === undefined) delete globalThis.window; else globalThis.window = win;
        if (ls === undefined) delete globalThis.localStorage; else globalThis.localStorage = ls;
      }
    };

    // 관리자 패널에만 나오는 문자열들 — 하나라도 고객 화면 마크업에 있으면 유출이다.
    //  ⚠ `data-admin` 이 아니라 `data-admin="` 로 잰다 — 인쇄 규칙
    //    `@media print{[data-admin]{…}}` 이 그 이름을 정당하게 갖고 있다(속성이 아니라 CSS).
    const ADMIN_MARKS = ['data-admin="', ADMIN_T.title, ADMIN_T.cost, ADMIN_T.hint, ADMIN_T.link];

    // (a) 있는 그대로 — 고객 화면에 관리자 표면이 **없다**
    const html = await render();
    ok("렌더 게이트가 공허하지 않다 — 실제로 결과 상자가 그려졌다",
       html.includes('data-result="1"') && html.length > 3000, `${html.length}자`);
    const found = ADMIN_MARKS.filter(m => html.includes(m));
    ok("★ 고객 화면 렌더에 관리자 표면(원가·수식·마진)이 **한 조각도 없다**",
       found.length === 0, found.join(" / "));

    // (b) ★ 이빨 — 실증된 그 2줄 주입을 **이 테스트가 직접 넣고** 빨개지는지 본다.
    //     이것이 없으면 다음 사람이 또 초록을 믿는다(§H 이빨과 같은 규율).
    const inject = s => s
      .replace(/const av = useMemo\(\(\) => \(adminOpen/, "const av = useMemo(() => (true")
      .replace(/\{adminOpen && av && \(/, "{av && (");
    const mutated = inject(readFileSync(jsxUrl, "utf8"));
    ok("이빨 준비: 주입이 실제로 소스를 바꿨다 (안 바뀌면 아래 줄이 공허하다)",
       mutated !== readFileSync(jsxUrl, "utf8") && !/\{adminOpen && av && \(/.test(mutated));
    const badHtml = await render({ mutate: inject });
    const caught = ADMIN_MARKS.filter(m => badHtml.includes(m));
    ok("★ 이빨: 관리자 패널을 상시 노출시키는 2줄 주입에서 게이트가 **빨개진다**",
       caught.length >= 3, `잡은 표식 ${caught.length}/${ADMIN_MARKS.length}`);

    // (c) ★ 원가 **숫자**가 화면에 없는가. SSR 은 배치를 안 앉히므로 여기서만
    //     `items` 씨앗을 심는다 — **배치만** 손대고 금액 경로는 원본 그대로다.
    //     (심지 않으면 up 0 · 원가 없음이라 「원가가 없다」가 공허해진다.)
    //  ⚠ 씨앗이 **두 개**다 (26-08-26 2차): 배치와 「그 배치가 놓인 판」. 짝이 안 맞으면
    //    upForPrice 가 0 을 돌려주고 금액이 「—」가 된다(minor ⑥ 의 가드가 그것이다) —
    //    즉 씨앗 하나만 심으면 아래 (c)·(c-2) 가 통째로 공허해진다. "4x62" 는 SOSCO.sheetId.
    const seed = s => s
      .replace("const [items, setItemsRaw] = useState(null);",
        'const [items, setItemsRaw] = useState([{ x: 0, y: 0, flipped: false, rotated: false }]);')
      .replace("const [itemsSheet, setItemsSheet] = useState(null);",
        'const [itemsSheet, setItemsSheet] = useState("4x62");');
    ok("(c) 준비: 배치 씨앗 2개(배치 + 그 판)가 심어졌다",
       /useState\(\[\{ x: 0/.test(seed(readFileSync(jsxUrl, "utf8"))) &&
       /useState\("4x62"\)/.test(seed(readFileSync(jsxUrl, "utf8"))));
    const live = await render({ mutate: seed, hash: "#/showroom?q=x",
                                store: { cur: "JPY", KRW: "", JPY: "*1.7/10" } });
    const mShown = /data-shown="([^"]*)"/.exec(live);
    const mCost = /data-perea="([^"]*)"/.exec(live);
    ok(`(c) 준비: 수식이 실제로 적용됐다 — 화면 금액이 «${mShown?.[1]}» 다`,
       /^¥[\d,]+$/.test(mShown?.[1] || ""), live.slice(live.indexOf("data-result"), live.indexOf("data-result") + 160));
    ok("★ 수식이 켜진 화면 렌더에 data-perea 가 **비어 있다** (DOM 에 원가가 없다)",
       mCost?.[1] === "", mCost?.[1]);
    // 1up 원가를 같은 경로로 따로 구해 **그 숫자 문자열**이 마크업에 없는지 본다.
    {
      const q1 = buildQuote(quoteInputOf({
        mode: "box", boxType: SOSCO.boxType, W: +SOSCO.bW, D: +SOSCO.bD, H: +SOSCO.bH,
        netW: 0, netH: 0, sheetId: SOSCO.sheetId, qty: +SOSCO.qty, carried: SOSCO, up: 1 }));
      const c1 = q1?.totals?.perEA ?? null;
      const digits = c1 != null ? c1.toLocaleString() : "";
      ok(`(c) 준비: 1up 원가가 구해졌다 (${digits}원)`, !!digits && c1 > 0);
      ok(`★ 고객 화면 렌더 어디에도 원가 «${digits}» 가 없다 (수식이 켜진 상태)`,
         !!digits && !live.includes(digits), digits);
    }
    // (c-2) ★ 26-08-26 — 수량별 표가 붙으면서 **한 화면의 원가가 다섯 벌**이 됐다.
    //   위 검사는 지금 수량 하나만 본다. 표의 나머지 칸으로 새면 그대로 통과한다.
    {
      const shownCells = [...live.matchAll(/data-qty-shown="([^"]*)"/g)].map(m => m[1]);
      ok(`(c-2) 준비: 수량별 표가 실제로 그려졌다 (${shownCells.length}칸)`,
         shownCells.length >= 4, shownCells.join(" "));
      ok("★ 수량별 표의 **모든 칸**이 표시가다 (원화 원가가 한 칸도 없다)",
         shownCells.length > 0 && shownCells.every(v => /^¥[\d,]+$/.test(v)),
         shownCells.join(" "));
      // 같은 인자로 원가 다섯 벌을 구해, 그 숫자가 표 칸에도 마크업에도 없는지 훑는다.
      const steps = qtyStepsOf(+SOSCO.qty);
      const rows = qtyRowsOf({ mode: "box", boxType: SOSCO.boxType, W: +SOSCO.bW, D: +SOSCO.bD,
                               H: +SOSCO.bH, netW: 0, netH: 0, sheetId: SOSCO.sheetId,
                               qty: +SOSCO.qty, up: 1, carried: SOSCO,
                               over: specOf(baseOf(SOSCO)) }, steps);
      const costs = rows.map(r => r.perEA);
      ok(`(c-2) 준비: 수량 ${steps.length}칸의 원가가 구해졌다 (${costs.join(" / ")}원)`,
         costs.length === shownCells.length && costs.every(c => c > 0), costs.join(" / "));
      const same = shownCells.filter((v, i) => costs[i] != null &&
        (v === String(costs[i]) || v === costs[i].toLocaleString()));
      ok("★ 표 칸의 값이 그 수량의 원가와 **다르다** (표시가를 거쳤다)", same.length === 0, same.join(" "));
      // ★ **사람·검사도구가 보는 표면**에서 다섯 벌을 전부 훑는다.
      //   원본 마크업 그대로 훑으면 세 자리 원가(557 …)가 SVG 좌표·style 값과 우연히
      //   같아 오탐이 난다. 그렇다고 「네 자리만」으로 접으면 1up 원가는 전부 세 자리라
      //   **재는 것이 하나도 없는 죽은 단언**이 된다(실측: big 이 빈 배열이었다).
      //   그래서 표면을 만든다 — 태그는 `data-*` 값만 남기고, 태그 밖 글자는 그대로 둔다.
      //   그것이 화면 글자 + 검사도구에서 읽히는 값의 전부다.
      const visible = live
        .replace(/<[^>]*>/g, tag => ` ${(tag.match(/data-[a-z-]+="[^"]*"/g) || []).join(" ")} `);
      const seen2 = costs.filter(c => c != null &&
        new RegExp(`(?<![\\d,.])${c}(?![\\d,.])`).test(visible));
      ok(`★ 화면 글자·data 속성 어디에도 수량별 원가 «${costs.join(" ")}» 가 없다`,
         seen2.length === 0, `${seen2.join(" ")} · 표면 ${visible.replace(/\s+/g, " ").trim().slice(0, 150)}`);
      // 이빨 — 위 표면 검사가 실제로 무언가를 볼 수 있는가(표시가는 거기서 잡혀야 한다)
      ok("이빨: 그 표면 검사가 표시가는 실제로 잡는다 (공허하지 않다)",
         shownCells.every(v => visible.includes(v)), shownCells.join(" "));
    }
    // (d) ★ 가림 비트를 달고 온 주소 — 수식이 없어도 원가로 접히지 않는다(브라우저 경로).
    const asCust = await render({ hash: "#/showroom?q=x&nc=1", store: null });
    ok("★ nc=1 주소를 수식 없는 브라우저에서 렌더하면 금액이 «—» 다",
       /data-price-mode="hidden"/.test(asCust) && /data-shown="—"/.test(asCust),
       (/data-price-mode="[^"]*"/.exec(asCust) || [])[0]);
    ok("가림 중이면 «견적 앱으로 →» 문이 고객 화면 마크업에 없다",
       !/data-act="back"/.test(asCust) && /data-act="back"/.test(html));

    rmSync(outDir, { recursive: true, force: true });
  }
}

// ══════════════════════════════════════════════════════════════════
//  §N  ★ 고객과 같이 넣는 사양 칸 + 수량별 개당단가 (26-08-26)
//
//  사용자 요구 원문: 「고객이랑 같이 화면 보면서 이거 사양을 넣어야하는데?」
//  종전 쇼룸에서 바꿀 수 있는 것은 구조·W/D/H·판형·수량뿐이었고, 도수·지종·코팅을
//  바꾸려면 **원가 전체가 뜨는 견적 앱**으로 돌아가야 했다 — 고객 앞에서 열 수 없는 화면이다.
//
//  이 절이 재는 것은 셋이다. 셋 다 이 저장소가 이미 밟은 고장의 재발 경로다:
//   ① 새 칸이 **금액을 실제로 움직이는가**(이빨) · 그리고 두 화면이 **같은 수**인가 → §B 의 204원
//   ② 그 값이 **왕복 3회차까지** 사는가 → §H·§K 와 같은 불변식. 링크에 안 실리면
//      「고객 앞에서 지종을 바꿔 보여줬는데 견적서는 옛 지종」이 된다(204 vs 223 의 형태).
//   ③ 수량별 표로 **원가가 새지 않는가** → §16 이 큰 글씨 하나를 가려 놓았는데, 화면에서
//      제일 여러 번 읽히는 숫자가 표라서 여기로 새면 그 전부가 무의미해진다.
// ══════════════════════════════════════════════════════════════════
console.log("\n── §N  고객과 같이 넣는 사양 + 수량별 개당단가 ───────────────");
{
  // ── ① 목록 계약 — SHOWROOM_SPEC_KEYS 는 SPEC_KEYS 의 부분집합이어야 한다 ──
  //  링크가 나르는 것은 SPEC_KEYS 뿐이다. 여기 있는 키가 거기 없으면 **화면에서 만진
  //  값이 왕복에서 사라진다** — 조용히, 그리고 방향은 「옛 사양으로 되돌아간다」다.
  const inSpec = new Set(SPEC_KEYS);
  const orphan = SHOWROOM_SPEC_KEYS.filter(k => !inSpec.has(k));
  ok(`쇼룸 사양 칸 ${SHOWROOM_SPEC_KEYS.length}개가 전부 SPEC_KEYS 에 있다 (링크가 나른다)`,
     orphan.length === 0, orphan.join(", "));
  ok("쇼룸 사양 칸에 중복이 없다",
     new Set(SHOWROOM_SPEC_KEYS).size === SHOWROOM_SPEC_KEYS.length);
  ok("쇼룸 사양 칸이 전부 INITIAL_STATE 에 있다 (없는 칸은 도메인이 못 읽는다)",
     SHOWROOM_SPEC_KEYS.every(k => k in INITIAL_STATE),
     SHOWROOM_SPEC_KEYS.filter(k => !(k in INITIAL_STATE)).join(", "));
  // ★ **부분집합이어야 한다** — 50칸을 그대로 옮기면 고객 앞 화면이 견적 앱이 된다.
  //   특히 단가 직접입력·개발비는 원가 구조 그 자체라 입력칸으로도 두면 안 된다.
  const BANNED = ["printU", "sobooU", "spotRprV", "mPrice", "mPriceV", "mR", "mRV",
                  "lossSheets", "admin", "adminManual", "foilRpr", "embRpr",
                  "newDie", "dieQ", "dieP", "filmC", "embDevP", "embFilmP",
                  "foilDevP", "foilFilmP", "mUp", "mUpV"];
  const leak = BANNED.filter(k => SHOWROOM_SPEC_KEYS.includes(k));
  ok("★ 원가 구조(단가 직접입력·개발비)와 판걸이는 고객 화면 입력칸이 **아니다**",
     leak.length === 0, leak.join(", "));
  ok(`쇼룸 사양 칸이 SPEC_KEYS(${SPEC_KEYS.length})의 진부분집합이다 — 「항목을 최소로」`,
     SHOWROOM_SPEC_KEYS.length < SPEC_KEYS.length,
     `${SHOWROOM_SPEC_KEYS.length} / ${SPEC_KEYS.length}`);
  // 드롭다운 선택지가 도메인 테이블에서 온다 — 비면 화면에 빈 목록이 뜬다
  const koPaper = paperChoices("ko"), koCoat = coatChoices("ko");
  const koGlue = glueChoices("ko"), koThom = thomChoices("ko");
  ok(`드롭다운 선택지가 도메인에서 온다 (지종 ${koPaper.length} · 코팅 ${koCoat.length} ` +
     `· 접착 ${koGlue.length} · 톰슨 ${koThom.length})`,
     koPaper.length > 10 && koCoat.length > 3 && koGlue.length > 3 && koThom.length > 3);
  ok("hidden 선택지(부분코팅)는 목록에 없다", !koCoat.some(([id]) => id === "part"));

  // ── ①-2 ★ 일본어 선택지 — 「일본어가 1급이다」 (26-08-26 2차 · 적대검증 minor ⑦) ──
  //  종전에는 칸 이름만 번역돼 있고 **선택지 52개가 전부 한국어**였다. 고객과 **같이 보는**
  //  왼쪽 칸 전체다. 정본 경로는 도메인의 `labelJa` 이고 화면은 문자열을 다시 짓지 않는다.
  //  ⚠ 이 게이트는 「전부 일본어」를 요구하지 **않는다** — 지종 28개는 제품명이라 일부러
  //    비웠고(papers.mjs 주석), 근거 없는 제품명을 지어내는 것이 더 나쁘다는 판단이다.
  //    그래서 재는 것은 셋이다: ① 공정명은 일본어다 ② 없으면 한국어로 **떨어진다**
  //    ③ 한국어 화면은 **한 글자도 안 움직인다**(하위호환).
  {
    const jaCoat = coatChoices("ja"), jaGlue = glueChoices("ja"), jaThom = thomChoices("ja");
    const lab = (list, id) => (list.find(([i]) => i === id) || [])[1];
    const WANT = [
      [jaCoat, "none", "無し"], [jaCoat, "matte", "マットPP"], [jaCoat, "gloss", "グロスPP"],
      [jaCoat, "ir", "IRコート"], [jaCoat, "velvet", "ベルベット"],
      [jaGlue, "dan", "片面貼り"], [jaGlue, "sam", "三面貼り"], [jaGlue, "sleeve", "スリーブ"],
      [jaGlue, "pp", "PP貼り"], [jaGlue, "handle", "手提げ型"],
      [jaThom, "s", "単純型"], [jaThom, "n", "標準型"], [jaThom, "c", "複雑型"],
      [jaThom, "g_std", "G型 標準"],
    ];
    const wrong = WANT.filter(([l, id, want]) => lab(l, id) !== want).map(([, id]) => id);
    ok(`★ 일본어 화면에서 공정명 ${WANT.length}개가 일본어다 (코팅·접착·톰슨)`,
       wrong.length === 0, wrong.join(", "));
    // 근거가 없어 비운 자리는 **한국어로 떨어진다** — 빈칸도 「??」도 아니다.
    ok("labelJa 가 없는 항목은 한국어로 떨어진다 (글로스코팅·풀발이·측면 풀발이 12단)",
       lab(jaCoat, "hg") === "글로스코팅" && lab(jaGlue, "pull") === "풀발이" &&
       lab(jaThom, "sp") === "측면 풀발이 12단",
       `${lab(jaCoat, "hg")} / ${lab(jaGlue, "pull")} / ${lab(jaThom, "sp")}`);
    ok(`지종 ${paperChoices("ja").length}개는 일본어를 **일부러 안 지었다** (제품명이다)`,
       JSON.stringify(paperChoices("ja")) === JSON.stringify(koPaper));
    // 하위호환 — 한국어 화면은 한 글자도 안 움직인다
    ok("한국어 화면의 선택지는 종전과 **바이트 동일**하다",
       koCoat.every(([, l]) => /[가-힣A-Z]/.test(l)) &&
       JSON.stringify(coatChoices()) === JSON.stringify(koCoat) &&
       JSON.stringify(glueChoices("ko")) === JSON.stringify(koGlue));
    // 이빨 — 일본어 목록이 한국어와 **실제로 다르다**(같으면 위 줄들이 공허하다)
    ok("이빨: 일본어 코팅·접착·톰슨 목록이 한국어와 다르다",
       JSON.stringify(jaCoat) !== JSON.stringify(koCoat) &&
       JSON.stringify(jaGlue) !== JSON.stringify(koGlue) &&
       JSON.stringify(jaThom) !== JSON.stringify(koThom));
  }

  // ── ② specOf 는 **모르는 키를 버린다** ─────────────────────────
  //  상태 한 벌을 통째로 얹으면 쇼룸이 안 그리는 칸까지 화면이 소유하게 되고, 그때부터
  //  실려 온 값과 조용히 갈린다(decodeSpec 이 낯선 키를 버리는 것과 같은 규율).
  {
    const picked = specOf({ paperId: "SC300", printU: "99999", 없는키: 1, dieP: "1" });
    ok("specOf 가 목록에 없는 키를 버린다",
       picked.paperId === "SC300" && !("printU" in picked) && !("없는키" in picked) &&
       !("dieP" in picked), JSON.stringify(picked));
    ok("specOf(null) 은 빈 객체다 (단독 진입에서 안 죽는다)",
       Object.keys(specOf(null)).length === 0);
  }

  // ── ③ 하위호환 — **안 만지면 종전과 같은 값** ────────────────────
  //  화면의 초기 over 는 specOf(baseOf(carried)) 다. base 와 같은 값을 덮어쓰는 것이므로
  //  결과가 한 원도 달라지면 안 된다. 이 줄이 §B(204)·§E(223)의 보증을 새 경로로 옮긴다.
  {
    const noOver = quoteInputOf({ mode: "box", boxType: SOSCO.boxType, W: +SOSCO.bW,
      D: +SOSCO.bD, H: +SOSCO.bH, sheetId: SOSCO.sheetId, qty: +SOSCO.qty, up: 0, carried: SOSCO });
    const withOver = quoteInputOf({ mode: "box", boxType: SOSCO.boxType, W: +SOSCO.bW,
      D: +SOSCO.bD, H: +SOSCO.bH, sheetId: SOSCO.sheetId, qty: +SOSCO.qty, up: 0, carried: SOSCO,
      over: specOf(baseOf(SOSCO)) });
    ok("★ over 를 안 만지면 QuoteInput 이 **바이트 동일**하다 (하위호환)",
       JSON.stringify(noOver) === JSON.stringify(withOver));
    const l0 = linkStateOf({ carried: SOSCO, mode: "box", boxType: SOSCO.boxType, bW: SOSCO.bW,
      bD: SOSCO.bD, bH: SOSCO.bH, sheetId: SOSCO.sheetId, qty: SOSCO.qty, up: 4, gridUp: 4 });
    const l1 = linkStateOf({ carried: SOSCO, over: specOf(baseOf(SOSCO)), mode: "box",
      boxType: SOSCO.boxType, bW: SOSCO.bW, bD: SOSCO.bD, bH: SOSCO.bH,
      sheetId: SOSCO.sheetId, qty: SOSCO.qty, up: 4, gridUp: 4 });
    ok("★ over 를 안 만지면 링크 해시도 **바이트 동일**하다 (기존 링크가 안 움직인다)",
       specHash("showroom", l0) === specHash("showroom", l1));
  }

  // ── ④ ★ 이빨 — 칸마다 금액이 **실제로** 움직이고 두 화면이 같은 수인가 ──
  //  안 움직이는 칸은 화면에 있을 이유가 없다(= 죽은 위젯). 그리고 움직이는데 두 화면이
  //  갈리면 그게 이 스위트가 존재하는 이유인 204 vs 223 이다.
  const CASES = [
    ["지종 AB350 → 스노우350",   { paperId: "SC350" }],
    ["지종 AB350 → 두성 디프매트", { paperId: "DSDM308" }],
    ["앞 원색4 → 별색2+먹",       { fpColor: false, fpSp: "2", fpBk: true }],
    ["앞 원색4 끄기",             { fpColor: false, fpSp: "0", fpBk: true }],
    ["뒤 원색4 켜기 (양면)",      { bpColor: true }],
    ["뒤 별색1 + 먹",             { bpSp: "1", bpBk: true }],
    ["앞 코팅 IR → 벨벳",         { fcId: "velvet" }],
    ["뒤 코팅 없음 → 무광",       { bcId: "matte" }],
    ["박 켜기",                   { foil: true }],
    ["형압 켜기",                 { emb: true }],
    ["부분UV 켜기",               { puv: true }],
    ["접착 단면 → 삼면",          { glueId: "sam" }],
    ["톰슨 일반 → 복잡",          { thomId: "c" }],
  ];
  // 기준선 — SOSCO 그대로 (§B 의 204원)
  const base0 = quoteScreen(SOSCO).totals.perEA;
  const moved = new Set();
  for (const [name, ov] of CASES) {
    // 견적서 화면 = 상태 한 벌에 그대로 얹는다 (App.jsx 가 하는 일)
    const a = quoteScreen({ ...SOSCO, ...ov }).totals?.perEA ?? null;
    // 쇼룸 화면 = 실려 온 사양 위에 **화면에서 만진 사양**을 얹는다
    const b = showroomScreen(SOSCO, { spec: { ...specOf(baseOf(SOSCO)), ...ov } }).perEA;
    ok(`${name} — 견적서 ${a}원 = 쇼룸 ${b}원`, a != null && a === b, `${a} / ${b}`);
    if (a !== base0) moved.add(name);
  }
  ok(`★ ${CASES.length}칸이 전부 금액을 움직인다 (기준 ${base0}원) — 죽은 위젯이 없다`,
     moved.size === CASES.length,
     `안 움직인 칸: ${CASES.filter(([n]) => !moved.has(n)).map(([n]) => n).join(", ") || "없음"}`);

  // ── ⑤ ★ 왕복 1·2·3회차 — 만진 사양이 살아남는가 ─────────────────
  //  §K 와 같은 규율이다: 1회차만 맞추면 2회차에서 갈린다. 여기서는 **판걸이가 아니라
  //  사양**이 되돌아가는지를 본다(고객 앞에서 지종을 바꿨는데 견적서는 옛 지종).
  {
    const touched = { ...specOf(baseOf(SOSCO)),
                      paperId: "SC350", fpColor: false, fpSp: "2", fpBk: true,
                      fcId: "matte", bcId: "matte", foil: true, emb: true, puv: true,
                      glueId: "sam", thomId: "c" };
    let cur = SOSCO, prev = null, same = 0;
    for (let lap = 1; lap <= 3; lap++) {
      const r = showroomScreen(cur, { spec: touched });
      // 화면이 조립하는 복귀 링크 — **화면과 같은 함수**로 짓는다(§H 의 교훈)
      const back = linkStateOf({
        carried: cur, over: touched, mode: "box", boxType: cur.boxType,
        bW: cur.bW, bD: cur.bD, bH: cur.bH, netW: 0, netH: 0,
        sheetId: r.sheetId || cur.sheetId, qty: cur.qty, up: r.up, gridUp: r.gridUp });
      const hashed = decodeSpec(payloadOfHash(specHash("", back)));
      const q = quoteScreen(hashed);
      const now = { sheet: r.sheetId, up: r.up, perEA: r.perEA,
                    qSheet: q.sheet?.id, qUp: q.sheet?.up, qPerEA: q.totals?.perEA };
      ok(`${lap}회차 — 쇼룸 ${now.sheet} ${now.up}up ${now.perEA}원 = 견적서 ` +
         `${now.qSheet} ${now.qUp}up ${now.qPerEA}원`,
         now.perEA != null && now.perEA === now.qPerEA && now.up === now.qUp,
         JSON.stringify(now));
      // 만진 사양이 해시를 지나 그대로 돌아왔는가 — 한 칸이라도 되돌아가면 여기서 죽는다
      const lost = SHOWROOM_SPEC_KEYS.filter(k => {
        const want = typeof INITIAL_STATE[k] === "boolean" ? !!touched[k] : String(touched[k]);
        const got = typeof INITIAL_STATE[k] === "boolean" ? !!hashed[k] : String(hashed[k]);
        return want !== got;
      });
      ok(`${lap}회차 — 만진 사양 ${SHOWROOM_SPEC_KEYS.length}칸이 해시 왕복에서 전부 산다`,
         lost.length === 0, lost.join(", "));
      if (prev && prev.perEA === now.perEA && prev.sheet === now.sheet && prev.up === now.up) same++;
      prev = now;
      cur = hashed;
    }
    ok("★ 2·3회차가 1회차와 같다 (사양이 회차마다 흔들리지 않는다)", same === 2, `같은 회차 ${same}/2`);
    // 이빨 — 만진 사양이 **원래와 다른 금액**이어야 이 절이 무엇인가를 잰 것이다
    ok(`이빨: 만진 사양의 금액이 기준(${base0}원)과 다르다 (${prev.perEA}원)`,
       prev.perEA !== base0, `${base0} → ${prev.perEA}`);
  }

  // ── ⑥ 수량별 개당단가 — 「1,000개면 얼마, 5,000개면 얼마」 ──────────
  {
    const steps = qtyStepsOf(4000);
    ok(`수량 눈금에 지금 수량이 끼워진다 (${steps.join(" / ")})`,
       steps.includes(4000) && QTY_STEPS.every(q => steps.includes(q)) &&
       steps.every((v, i) => i === 0 || v > steps[i - 1]), steps.join(","));
    ok("같은 수량은 두 번 안 들어간다", qtyStepsOf(5000).filter(q => q === 5000).length === 1);
    // ★ 끼워넣기 문턱 — **입력 중인 중간 상태**를 고객 화면 칩으로 만들지 않는다
    //   (적대검증 minor ④: 「5個 ¥15,034」가 실제로 페인트됐다. rAF 샘플러 실측).
    //   ⚠ 큰 글씨는 종전대로 즉시 따라간다 — 이건 표에만 안 끼우는 규칙이다.
    ok(`타이핑 중간 상태(문턱 ${QTY_PIN_MIN} 미만)는 표에 안 끼운다 — 5 · 50 · 99`,
       [5, 50, 99].every(n => !qtyStepsOf(n).includes(n)) &&
       [5, 50, 99].every(n => qtyStepsOf(n).length === QTY_STEPS.length),
       qtyStepsOf(5).join(","));
    ok(`문턱 이상은 종전대로 끼운다 — ${QTY_PIN_MIN} · 500 · 4,000`,
       [QTY_PIN_MIN, 500, 4000].every(n => qtyStepsOf(n).includes(n)));
    ok("무효 수량(빈칸·0·음수·문자)은 눈금만 남는다",
       ["", "0", "-100", "abc", null, undefined].every(v =>
         JSON.stringify(qtyStepsOf(v)) === JSON.stringify(QTY_STEPS)));

    const args = { mode: "box", boxType: SOSCO.boxType, W: +SOSCO.bW, D: +SOSCO.bD, H: +SOSCO.bH,
                   netW: 0, netH: 0, sheetId: "4x62", qty: 4000, up: 4, carried: SOSCO,
                   over: specOf(baseOf(SOSCO)) };
    const rows = qtyRowsOf(args, steps);
    ok(`수량 ${steps.length}칸이 전부 값을 낸다 (${rows.map(r => `${r.qty}→${r.perEA}`).join(" ")})`,
       rows.length === steps.length && rows.every(r => r.perEA > 0));
    // ★ 부스에서 눈으로 확인해야 하는 그것 — 수량이 오르면 개당가가 내린다(고정비 분산)
    ok("★ 수량이 오르면 개당단가가 **내려간다** (1,000 → 10,000)",
       rows.every((r, i) => i === 0 || r.perEA < rows[i - 1].perEA),
       rows.map(r => `${r.qty}:${r.perEA}`).join(" "));
    // ★ 지금 수량 칸은 큰 글씨와 **원리적으로 같은 수**다 (같은 인자·같은 함수)
    const big = buildQuote(quoteInputOf(args))?.totals?.perEA;
    ok(`★ 지금 수량 칸(${rows.find(r => r.qty === 4000)?.perEA}원)이 큰 글씨(${big}원)와 같다`,
       rows.find(r => r.qty === 4000)?.perEA === big);
    // ── ⑥-2 ★★ 판·판걸이 고정의 대가 — **전 칸을 재고, 부등호를 계약에서 내린다** ──
    //  26-08-26 2차 (적대검증 major ③). 종전 이 자리에는 `rows[0].perEA >= autoLow` 한
    //  줄뿐이었고, 그건 **1,000개 한 칸**(531 ≥ 469)만 보는 것이었다. 나머지 네 칸을 재면
    //  부등호가 깨진다 — 3,000개에서 표 237 vs 재견적 239 로 **고객 앞 화면이 청구보다 싸다**.
    //  ARCHITECTURE 머리의 안전 방향 규약이 금지한 방향이고, §17 은 「§N ⑥ 이 그 부등호를
    //  매번 관측한다」고 적어 그 거짓을 **정상으로 못박고 있었다.**
    //  원인: findBestSheet 의 랭킹이 최종 perEA 최소화가 아니다(EST_PRICE_PENALTY ·
    //  SHEET_PRIORITY · TIE_PCT). 「자동이 늘 더 싸다」가 성립하지 않는다.
    //  ⟹ 부등호를 **계약에서 내리고**, 전 칸을 재서 「몇 칸이 반대이고 최악이 몇 %인가」를
    //     기록값과 대조한다(예산 게이트). 나빠지면 여기가 빨개진다.
    {
      const cmp = rows.map(r => {
        const re = buildQuote(quoteInputOf({ ...args, sheetId: "auto", qty: r.qty, up: 0 }));
        const rp = re?.totals?.perEA ?? null;
        return { qty: r.qty, tab: r.perEA, re: rp, sheet: re?.sheet?.id,
                 pct: rp ? (r.perEA / rp - 1) * 100 : 0 };
      });
      const line = cmp.map(c => `${c.qty}:${c.tab}vs${c.re}(${c.pct.toFixed(1)}%)`).join(" ");
      ok(`★ 기준 사양 ${cmp.length}칸을 **전부** 잰다 — ${line}`, cmp.length === steps.length);
      // 기록값 (26-08-26 실측): 1,000 +13.2% · 3,000 **−0.8%** · 나머지 셋 0.0%
      const worst1 = Math.min(...cmp.map(c => c.pct));
      ok(`★ 기준 사양의 최악 방향이 −1.0% 이내다 (지금 ${worst1.toFixed(1)}% · 3,000개)`,
         worst1 >= -1.0, line);
    }
    // 배치가 없으면(up 0) 표도 없다 — 「—」인 큰 글씨 옆에 값이 있으면 안 된다
    ok("배치가 없으면 표 값도 없다", qtyRowsOf({ ...args, up: 0 }, steps).every(r => r.up === 0));

    // ── ⑦ ★★ 원가 유출 — 표에도 원가가 없어야 한다 (§16 과 같은 계약) ──
    const cfg = { cur: "JPY", KRW: "", JPY: "*1.7/10" };
    const shownRows = shownRowsOf({ rows, cfg, lang: "ja" });
    const asText = JSON.stringify(shownRows);
    const leaked = rows.map(r => String(r.perEA)).filter(d => asText.includes(d));
    ok("★ shownRowsOf 반환에 원가가 **한 칸도** 없다 (모델 검사)",
       leaked.length === 0 && !/perEA|cost|why|warn|src/.test(asText),
       `${leaked.join(" ")} · ${asText.slice(0, 120)}`);
    ok(`★ 표의 모든 칸이 표시가다 (${shownRows.map(r => r.main).join(" ")})`,
       shownRows.every(r => r.mode === "value" && /^¥[\d,]+$/.test(r.main)));
    ok("표도 수량이 오르면 표시가가 내려간다 (반올림 뒤에도 순서가 산다)",
       shownRows.every((r, i) => i === 0 ||
         Number(r.main.replace(/[^\d]/g, "")) < Number(shownRows[i - 1].main.replace(/[^\d]/g, ""))),
       shownRows.map(r => r.main).join(" "));
    // 수식이 거부되면 **그 칸도** 「—」다 — 한 칸이라도 원가로 되돌아가면 안 된다
    const bad = shownRowsOf({ rows, cfg: { cur: "JPY", KRW: "", JPY: "*0" }, lang: "ja" });
    ok("★ 수식이 거부되면 표의 모든 칸이 «—» 다 (원가로 안 돌아간다)",
       bad.every(r => r.main === "—" && r.mode === "blocked"), bad.map(r => r.main).join(" "));
    // 가림 비트를 달고 온 링크 — 수식이 없어도 표가 원가로 접히면 안 된다
    const hid = shownRowsOf({ rows, cfg: EMPTY_PRICE_CFG, lang: "ja", hideCost: true });
    ok("★ nc=1 링크에서는 표도 «—» 다", hid.every(r => r.main === "—" && r.mode === "hidden"));
    // ── ★★ 수식 미설정(mode "cost") — **표를 안 그린다** (26-08-26 2차 · major ②) ──
    //  종전 이 자리의 이빨은 「수식 미설정이면 표는 종전대로 원가 원화다」였고, 그것이
    //  **고객 화면의 원가를 1개 → 5개로 늘린 것을 정상으로 못박고 있었다.**
    //  브라우저 실측(localStorage 비움): 「4 up · 개당 204 원」 + 「1,000개 531 / 3,000개 237 /
    //  4,000개 204 / 5,000개 196 / 10,000개 167」. 1,000개 531원은 4,000개 204원의 2.6배 —
    //  단가 하나가 아니라 **고정비/변동비 구조(원가 곡선)**를 고객에게 그려 보인다.
    //  「미설정이면 종전대로」의 종전에는 **표가 없었다.** 그래서 표를 접는다.
    const off = shownRowsOf({ rows, cfg: EMPTY_PRICE_CFG, lang: "ko" });
    ok("★ 수식 미설정이면 수량표를 **아예 안 그린다** (종전 노출면 = 큰 글씨 하나)",
       off.length === 0, JSON.stringify(off).slice(0, 120));
    // 이빨 — 「0칸」이 공허하지 않다: 큰 글씨는 여전히 종전대로 원가 원화다(하위호환).
    ok(`이빨: 큰 글씨는 종전대로 원가 원화다 (${rows[0].perEA}원)`,
       shownPriceOf({ perEA: rows[0].perEA, up: 4, cfg: EMPTY_PRICE_CFG, lang: "ko" })
         .main === rows[0].perEA.toLocaleString());
    // 이빨 — 수식을 켜면 표가 **다시 5칸** 뜬다(접는 규칙이 표를 죽인 것이 아니다)
    ok(`이빨: 수식을 켜면 표가 ${rows.length}칸 그대로 뜬다`, shownRows.length === rows.length);
    // 한 칸이라도 cost 면 통째로 접는다 — 섞인 표(4칸 표시가 + 1칸 원가)를 만들지 않는다
    ok("cost 가 한 칸이라도 있으면 표 전체를 접는다",
       shownRowsOf({ rows: [rows[0]], cfg: EMPTY_PRICE_CFG, lang: "ko" }).length === 0);
  }

  // ── ⑧ 사양 줄이 새 사양을 **말하는가** (§C 와 같은 규율) ────────────
  //  화면 왼쪽 아래 사양 줄은 실제 견적 라인에서 뽑는다. 지종을 바꿨는데 줄이 옛 지종을
  //  적으면 화면이 거짓말을 한다 — 그것이 이 스위트의 출발점이었다.
  {
    const r = showroomScreen(SOSCO, { spec: { ...specOf(baseOf(SOSCO)),
                                              paperId: "SC350", fcId: "matte", glueId: "sam" } });
    const line = specSummaryOf(r.q?.lines);
    ok(`사양 줄이 바꾼 사양을 말한다 — «${line}»`,
       line.includes("SC 350") && line.includes("무광") && line.includes("삼면") &&
       !line.includes("AB라이트 295"), line);
  }

  // ── ⑨ ★★ 판형 「자동」에서 사양을 바꾸면 판이 뒤집힌다 — 그때를 재는가 ──
  //  26-08-26 2차 (적대검증 major ①). **이것이 부스 표준 경로다**: 단독 진입은 늘
  //  `carried?.sheetId || "auto"` 이고 견적 앱 기본값(INITIAL_STATE.sheetId)도 "auto" 다.
  //  그런데 종전 §N 은 SOSCO.sheetId="4x62" 고정이라 이 경로를 **한 번도 안 밟았다.**
  //  종전 화면의 증상: 지종 하나 바꾸면 자동판형이 4×62 → 4×64 로 뒤집히고 resetKey 가
  //  바뀌어 배치가 통째로 지워진다 → ¥35 가 「—」로 · 판은 빈 사각형 · 수량표 5칸 소멸 ·
  //  msg 도 "" 로 지워져 **화면이 이유를 말하지 않는다.**
  //  ⚠ 재는 것을 정직하게 적는다 — 이 스위트는 React 상태 전이를 못 돈다. 그래서
  //    ⓐ **복구 목적지가 성립하는가**(새 판에서 두 화면이 같은 금액을 내는가)를 실계산으로,
  //    ⓑ **화면이 그 복구를 하기로 되어 있는가**를 판단 함수(모델)와 소스 계약으로 잰다.
  {
    const AUTO = { ...SOSCO, sheetId: "auto" };
    const base0auto = showroomScreen(AUTO);
    let flipped = 0; const broken = [];
    for (const [name, ov] of CASES) {
      const r = showroomScreen(AUTO, { spec: { ...specOf(baseOf(AUTO)), ...ov } });
      if (r.sheetId !== base0auto.sheetId) flipped++;
      const a = quoteScreen({ ...AUTO, ...ov }).totals?.perEA ?? null;
      if (!(r.perEA > 0) || r.perEA !== a)
        broken.push(`${name}: 쇼룸 ${r.sheetId} ${r.up}up ${r.perEA} vs 견적서 ${a}`);
    }
    ok(`★ 사양 ${CASES.length}칸을 판형 「자동」에서 바꿔도 전부 금액이 살아 있고 두 화면이 같다`,
       broken.length === 0, broken.join(" · "));
    ok(`이빨: 그중 판형이 실제로 뒤집히는 칸이 있다 (${flipped}칸) — 0 이면 위 줄이 공허하다`,
       flipped > 0, `${flipped} / ${CASES.length}`);
    // ⓑ-1 모델 — 「판만 바뀐 것」과 「도형이 바뀐 것」은 다른 사건이다
    ok("resetKindOf: 도형 그대로 + 앉힌 것 있음 → «sheet» (다시 앉힌다)",
       resetKindOf("a", "a", true) === "sheet");
    ok("resetKindOf: 도형이 바뀌면 «shape» (다시 앉히지 않는다 — 좌표가 뜻을 잃었다)",
       resetKindOf("a", "b", true) === "shape");
    ok("resetKindOf: 지울 배치가 없었으면 «none» (첫 화면에서 자동 배치가 안 돈다)",
       resetKindOf("a", "a", false) === "none" && resetKindOf("a", "b", false) === "shape");
    // ⓑ-2 소스 계약 — 화면이 ① 말하고 ② 다시 앉히는가 (§M ⑪ 과 같은 방식)
    const page = readFileSync(new URL("../src/showroom/ShowroomPage.jsx", import.meta.url), "utf8");
    ok("★ 화면이 판 변경을 **말한다** (침묵이 이 고장의 본체였다)",
       /setMsg\(kind === "sheet" \? t\.sheetChanged : ""\)/.test(page));
    ok("★ 화면이 판만 바뀌면 **다시 앉힌다** (예약 + runAuto)",
       /if \(kind === "sheet"\) setReseat\(n => n \+ 1\);/.test(page) &&
       /runAuto\(n => t\.sheetReseated\(n\)\)/.test(page));
    ok("다시 앉히기는 **묶어서 한 번만** 돈다 (수량 키스트로크마다 200만 회 탐색 금지)",
       /clearTimeout\(id\)/.test(page) && /RESEAT_MS/.test(page));
    ok("판 변경 문구가 KO·JA 두 벌 다 있다",
       !!T("ko").sheetChanged && !!T("ja").sheetChanged &&
       typeof T("ko").sheetReseated === "function" && typeof T("ja").sheetReseated === "function" &&
       T("ko").sheetChanged !== T("ja").sheetChanged);
  }

  // ── ⑩ ★★ 과도기 프레임 — 배치가 **다른 판의 것**이면 그 up 을 안 쓴다 ──
  //  적대검증 minor ⑥. 지종 변경으로 판이 뒤집히는 순간 sheetBase 는 이미 새 판인데
  //  items 는 아직 옛 판의 것이라, 한 렌더에서 「4×64 판에 up 4」라는 물리적으로 불가능한
  //  배치의 금액이 DOM 에 커밋된다. rAF 로는 안 잡히지만(9.5ms 안에 덮인다) 그 무해함이
  //  useEffect 의 실행 시점에 걸려 있다 — 원리적으로 「—」가 되게 만든다.
  {
    const four = [{}, {}, {}, {}];
    ok("upForPrice: 같은 판이면 그린 수 그대로", upForPrice(four, "4x62", "4x62") === 4);
    ok("★ upForPrice: 판이 다르면 0 (불가능한 배치의 금액이 원리적으로 안 나온다)",
       upForPrice(four, "4x62", "4x64") === 0);
    ok("upForPrice: 모르면 0 (판 미정 · 배치 없음 · 빈 배열)",
       upForPrice(four, null, "4x64") === 0 && upForPrice(null, "4x62", "4x62") === 0 &&
       upForPrice([], "4x62", "4x62") === 0);
    // 이빨 — 막지 않으면 얼마나 틀리는가. 4×64 에 SOSCO 도형은 2up 이 진실이다.
    const a64 = { mode: "box", boxType: SOSCO.boxType, W: +SOSCO.bW, D: +SOSCO.bD, H: +SOSCO.bH,
                  netW: 0, netH: 0, sheetId: "4x64", qty: +SOSCO.qty, carried: SOSCO,
                  over: specOf(baseOf(SOSCO)) };
    const trueUp = buildQuote(quoteInputOf({ ...a64, up: 0 }))?.sheet?.up ?? 0;
    const fake = buildQuote(quoteInputOf({ ...a64, up: 4 }))?.totals?.perEA ?? 0;
    const real = buildQuote(quoteInputOf({ ...a64, up: trueUp }))?.totals?.perEA ?? 0;
    ok(`이빨: 안 막으면 4×64 에 up 4 로 ${fake}원이 나간다 — 그 판의 진실은 ${trueUp}up ` +
       `${real}원 (${Math.round((fake / real - 1) * 100)}%)`,
       trueUp > 0 && trueUp < 4 && fake > 0 && fake < real * 0.9, `${fake} vs ${real}`);
  }

  // ── ⑪ ★★ 105칸 스윕 — 「고정의 대가는 늘 안전 방향」이 **거짓**임을 계량한다 ──
  //  적대검증 major ③. 부등호를 계약에서 내리는 대신 **몇 칸이 반대이고 최악이 몇 %인지**를
  //  기록값과 대조한다. 나빠지면 여기가 빨개진다 — 그것이 이 절이 계약을 대신하는 방식이다.
  //  ⚠ 여기서는 autoPlace 를 부르지 않고 격자해(`layout.up`)를 쓴다. 21개 표본에서
  //    autoPlace 결과가 격자해와 **전부 같음을 확인했고**(26-08-26), autoPlace 는 탐색
  //    예산이 있어 시간에 따라 흔들릴 수 있어 스윕에는 부적합하다. 화면 실경로는
  //    위 ④⑤⑨ 가 showroomScreen 으로 밟는다.
  {
    const BOXES = [
      ["삼면 140×43×130", { boxType: "glue_3side", bW: "140", bD: "43", bH: "130" }],
      ["삼면 90×70×130",  { boxType: "glue_3side", bW: "90",  bD: "70",  bH: "130" }],
      ["맞뚜껑 100×60×150", { boxType: "tuck_both", bW: "100", bD: "60", bH: "150" }],
      ["맞뚜껑 60×40×90",   { boxType: "tuck_both", bW: "60",  bD: "40", bH: "90" }],
      ["십자 120×80×40",   { boxType: "cross", bW: "120", bD: "80", bH: "40" }],
      ["G형 120×80×40",    { boxType: "gtype", bW: "120", bD: "80", bH: "40" }],
      ["G트레이 150×100×50", { boxType: "gtype_tray", bW: "150", bD: "100", bH: "50" }],
    ];
    let cells = 0, worst = 0; const viol = [];
    for (const [bn, box] of BOXES) for (const pid of ["AB295L", "SC350", "ACPK350"]) {
      const carried = { ...SOSCO, ...box, paperId: pid, sheetId: "auto" };
      const b = { mode: "box", boxType: carried.boxType, W: +carried.bW, D: +carried.bD,
                  H: +carried.bH, netW: 0, netH: 0, sheetId: "auto", qty: +carried.qty,
                  carried, over: specOf(baseOf(carried)) };
      const auto = buildQuote(quoteInputOf({ ...b, up: 0 }));
      const up = auto?.layout?.up ?? 0;
      if (!auto?.sheet || !up) continue;
      const steps = qtyStepsOf(+carried.qty);
      for (const r of qtyRowsOf({ ...b, sheetId: auto.sheet.id, up }, steps)) {
        if (r.perEA == null) continue;
        const re = buildQuote(quoteInputOf({ ...b, sheetId: "auto", qty: r.qty, up: 0 }));
        const rp = re?.totals?.perEA ?? null;
        if (rp == null) continue;
        cells++;
        if (r.perEA < rp) {
          const pct = (r.perEA / rp - 1) * 100;
          if (pct < worst) worst = pct;
          viol.push(`${bn}·${pid}·${r.qty}: 표 ${r.perEA} vs 재견적 ${rp}(${re.sheet.id} ${re.sheet.up}up) ${pct.toFixed(1)}%`);
        }
      }
    }
    // 기록값 (26-08-26 실측): 105칸 · 위반 8칸 · 최악 −3.7%
    ok(`★ 스윕 ${cells}칸 — 안전 방향 ${cells - viol.length}칸 · **예외 ${viol.length}칸** ` +
       `(최악 ${worst.toFixed(1)}%)`,
       cells >= 100 && viol.length <= 8 && worst >= -3.8, viol.join("\n     "));
    // 이빨 — 예외가 0 이면 위 줄이 「없는 것을 재고 있다」이고, 그러면 부등호를 되살려야 한다
    ok("이빨: 예외가 실제로 존재한다 (0 이면 계약을 부등호로 되돌려라)", viol.length > 0);
  }

  // ── ⑫ ★ 인쇄를 0 도로 만들면 사양 줄이 «인쇄 없음» 이라고 적는가 ──
  //  적대검증 minor ⑧. 종전에는 도수를 쇼룸에서 못 만졌으니 이 상태를 화면에서 만들 수
  //  없었는데, 이제 「원색4」 알약 **1탭**이면 만들어진다. 견적 라인에서 뽑는 방식은
  //  「안 한 공정은 줄이 없다」라서 조용하다 — 고객은 그 단가가 무인쇄 값인지 못 읽는다.
  {
    const r = showroomScreen(SOSCO, { spec: { ...specOf(baseOf(SOSCO)),
                                              fpColor: false, fpSp: "0", fpBk: false } });
    const ko = specSummaryOf(r.q?.lines, T("ko")), ja = specSummaryOf(r.q?.lines, T("ja"));
    ok(`★ 무인쇄면 «인쇄 없음» 을 명시한다 — «${ko}»`, ko.includes("인쇄 없음"), ko);
    ok(`★ 일본어 화면은 «印刷なし» 다 — «${ja}»`, ja.includes("印刷なし"), ja);
    ok("자리가 지종 **바로 뒤**다 (맨 끝에 붙이면 덧붙인 말처럼 읽힌다)",
       /^[^·]+ · 인쇄 없음 · /.test(ko), ko);
    ok("이빨: 인쇄가 있으면 그 말이 없다",
       !specSummaryOf(showroomScreen(SOSCO).q?.lines, T("ko")).includes("인쇄 없음"));
    ok("라인이 0건이면 아무 말도 안 한다 (설명할 단가 자체가 없는 화면)",
       specSummaryOf([], T("ko")) === "" && specSummaryOf(null) === "");
    ok("사전을 안 넘겨도 안 죽는다 (한국어로 떨어진다)",
       specSummaryOf(r.q?.lines).includes("인쇄 없음"));
  }
}

// ══════════════════════════════════════════════════════════════════
//  §O  ★ 별색 팬톤 조회 (26-08-27)
//
//  사용자 요구 원문: 「우리꺼에 팬톤색상 검색하면 나올 수 있도록 그런 기능은 추가가안되나?」
//
//  이 기능의 위험은 **금액이 아니라 말**이다. 그래서 이 절이 재는 것도 넷 다 「말」이다:
//   ① ★ **가격이 안 바뀐다** — 팬톤은 금액 경로에 닿으면 안 된다. 링크 전 구간을 태워서 잰다.
//   ② ★ **정직성 문구가 화면에 있다** — 모니터로 색을 승인받으면 그게 그대로 분쟁이 된다.
//      출처·라이선스·상표(Pantone LLC 무관)도 화면에 있어야 한다(이 앱은 공개 배포된다).
//   ③ 검색이 **부스에서 치는 것**을 찾는다 — 번호 정확일치가 이름 부분일치보다 위다.
//   ④ 색표를 **못 받았을 때 조용히 죽지 않는다** — 오프라인 부스·404 가 실제 경로다.
// ══════════════════════════════════════════════════════════════════
console.log("\n── §O  별색 팬톤 조회 ────────────────────────────────────────");
{
  // ── ① 데이터 파일 — 있는가 · 온전한가 · 고지가 붙어 있는가 ─────────
  //  ⚠ 이 파일이 사라지거나 반쪽이 되면 부스에서 검색칸이 통째로 죽는다. CI 가 잡아야 한다.
  const dataUrl = new URL("../public/pantone-approx.json", import.meta.url);
  const j = JSON.parse(readFileSync(dataUrl, "utf8"));
  ok(`색표가 public/ 에 있고 2,415건이다 (실측 ${j.colors?.length}건)`, j.colors?.length === 2415);
  const HEXRE = /^#[0-9A-Fa-f]{6}$/;
  const badHex = j.colors.filter(o => !HEXRE.test(String(o.hex))).length;
  const badName = j.colors.filter(o => !/^Pantone .+ [CUM]$|^Pantone .+$/.test(String(o.name))).length;
  const badCmyk = j.colors.filter(o => ["c", "m", "y", "k"]
    .some(k => typeof o[k] !== "number" || o[k] < 0 || o[k] > 100)).length;
  ok("hex 가 전부 «#RRGGBB» 다 (깨진 항목 0건)", badHex === 0, `${badHex}건`);
  ok("이름 형식이 고르다 «Pantone …» (깨진 항목 0건)", badName === 0, `${badName}건`);
  ok("CMYK 가 전부 0–100 이다 (깨진 항목 0건)", badCmyk === 0, `${badCmyk}건`);
  //  ★ 고지 — **이 앱은 gh-pages 로 공개 배포된다.** 화면이 「팬톤 인증 색상」이라고
  //    말하면 안 되고, 파일도 그렇게 말하면 안 된다.
  const nt = JSON.stringify(j._notice || {});
  ok("파일 머리에 **출처**가 있다 (mcp-print)", /mcp-print/.test(nt));
  ok("파일 머리에 **라이선스**가 있고 «코드에 붙은 MIT» 라고 적혀 있다",
     /MIT/.test(nt) && /코드/.test(nt));
  ok("파일 머리가 **근사치**임을 말한다 (인증 색상이 아니다)",
     /근사/.test(nt) && /인증 색상이 아니다/.test(nt));
  ok("파일 머리에 **Pantone LLC 와 무관**하다고 적혀 있다",
     /Pantone LLC/.test(nt) && /(무관|not affiliated)/.test(nt));
  ok("파일 머리가 **수록 범위가 팬톤 전체가 아님**을 말한다 (2925 가 없다)",
     /팬톤 전체가 아니다/.test(nt) && /2925/.test(nt));

  // ── ② 로드 — fetch 를 세워 **실제 경로**를 태운다 ────────────────
  const realFetch = globalThis.fetch;
  const setFetch = f => { globalThis.fetch = f; _resetPantoneCache(); };
  setFetch(async () => ({ ok: true, status: 200, json: async () => j }));
  const loaded = await loadPantone();
  ok(`색표를 받아 색인 ${loaded.list.length}건을 세운다`, loaded.ok && loaded.list.length === 2415);
  const L = loaded.list;

  // ── ③ ★ 검색 — 부스에서 실제로 치는 넷 ─────────────────────────
  const hit = (q, n) => searchPantone(L, q, n);
  ok("«185» → Pantone 185 C 가 **맨 위** (번호 정확일치가 1순위)",
     hit("185").hits[0]?.name === "Pantone 185 C", hit("185").hits.map(o => o.name).join(" | "));
  ok("«185» 는 C·U·M 세 벌만 나온다 (번호 정확일치)",
     hit("185").total === 3, `${hit("185").total}건`);
  ok("«185 C» · «185c» · «Pantone 185C» 가 **같은 한 건**이다 (대소문자·공백·접두 무시)",
     ["185 C", "185c", "Pantone 185C", "pms 185-c"].every(
       q => hit(q).total === 1 && hit(q).hits[0].name === "Pantone 185 C"));
  ok("«reflex» → Reflex Blue (이름 부분일치)",
     hit("reflex").hits[0]?.name === "Pantone Reflex Blue C" && hit("reflex").total === 3);
  ok("«black» → Pantone Black C 가 맨 위 (이름 정확일치가 «Black 2» 보다 위)",
     hit("black").hits[0]?.name === "Pantone Black C", hit("black").hits.map(o => o.name).join(" | "));
  //  ★ 「없는 번호」다 — **없는 색이 아니다.** 이 색표는 100–699 · 7400–7549 · 이름색 55 뿐이다.
  //    부스에서 운영자가 「그런 색 없습니다」라고 말해 버리면 하지 않은 확인을 한 셈이 된다.
  //    화면 문구가 그 구별을 하는지는 아래 ⑥ 이 잰다.
  ok("«2925» 는 **이 색표에 없다** (0건) — 화면이 「없는 번호」라고 말해야 한다",
     hit("2925").total === 0);
  ok("이빨: 그 0건이 검색 고장이 아니다 — 같은 자리 «292» 는 찾힌다",
     hit("292").total > 0, hit("292").hits.map(o => o.name).join(" | "));
  ok("결과는 몇 개만 — 24건 매칭이어도 6건까지만 준다 (total 은 24 로 남는다)",
     hit("black", 6).hits.length === 6 && hit("black", 6).total === 24);
  ok("빈 질의는 0건 (전체 2,415건을 쏟지 않는다)",
     hit("").total === 0 && hit("   ").total === 0);
  //  ★ 실측 — 2,415건 선형 스캔이 타이핑마다 돌아도 되는가. 최악 질의로 잰다.
  {
    const N = 200, t0 = Date.now();
    for (let i = 0; i < N; i++) searchPantone(L, "1", 6);
    const per = (Date.now() - t0) / N;
    ok(`최악 질의 «1»(542건 매칭)이 60fps 예산 16.7ms 안에 든다 — ${per.toFixed(3)}ms/회`,
       per < 2, `${per}ms`);
  }

  // ── ④ ★ 못 받았을 때 — 조용히 죽지 않는다 ───────────────────────
  for (const [nm, f] of [
    ["오프라인 (네트워크 없음)", async () => { throw new Error("offline"); }],
    ["404 (배포 누락)", async () => ({ ok: false, status: 404, json: async () => ({}) })],
    ["빈 파일", async () => ({ ok: true, status: 200, json: async () => ({ colors: [] }) })],
    ["깨진 JSON", async () => ({ ok: true, status: 200, json: async () => { throw new Error("bad"); } })],
  ]) {
    setFetch(f);
    const r = await loadPantone();
    ok(`${nm} — 던지지 않고 «못 받았다»를 값으로 준다 (화면이 말할 수 있다)`,
       r.ok === false && Array.isArray(r.list) && r.list.length === 0 && !!r.why, JSON.stringify(r).slice(0, 90));
  }
  // 캐시 — 두 번 부르면 요청은 한 번이다(타이핑마다 178KB 를 다시 받지 않는다)
  {
    let n = 0;
    setFetch(async () => { n++; return { ok: true, status: 200, json: async () => j }; });
    await loadPantone(); await loadPantone(); await loadPantone();
    ok("색표는 **한 번만** 받는다 (모듈 캐시)", n === 1, `요청 ${n}회`);
  }
  setFetch(async () => ({ ok: true, status: 200, json: async () => j }));
  await loadPantone();

  // ── ⑤ ★★ 가격 불변 — 이 절의 본체 ──────────────────────────────
  //  팬톤은 **금액을 한 원도 안 움직인다.** 움직이는 것은 별색 도수(fpSp/bpSp)다.
  //  구조로 증명한다: ① 목록에 없다 ② 페이로드에 없다 ③ 링크 전 구간을 태워도 204 다.
  {
    const pmsish = k => /pms|pantone|팬톤|^pf$|^pb$/i.test(k);
    ok("★ SPEC_KEYS 에 팬톤 키가 없다 (SPEC_KEYS 는 「금액을 움직이는 키」의 목록이다)",
       !SPEC_KEYS.some(pmsish), SPEC_KEYS.filter(pmsish).join(","));
    ok("★ 쇼룸 사양 칸(SHOWROOM_SPEC_KEYS)에도 없다 — quoteInputOf 로 안 흘러간다",
       !SHOWROOM_SPEC_KEYS.some(pmsish), SHOWROOM_SPEC_KEYS.filter(pmsish).join(","));
    const payload = encodeSpec({ ...SOSCO, fpSp: "2" });
    ok("페이로드(q=)에 팬톤이 없다", !/pf~|pb~|antone/i.test(payload), payload.slice(0, 80));

    // ★ 링크 전 구간 — 팬톤을 실은 주소를 견적서가 받아도 **204원 그대로**다.
    const spotSpec = { ...SOSCO, fpSp: "2" };
    const plain = specHash("showroom", spotSpec);
    const withPms = specHash("showroom", spotSpec, { pf: "185 C", pb: "Reflex Blue C" });
    const back = decodeSpec(payloadOfHash(withPms));
    const a = quoteScreen(spotSpec).totals, b = quoteScreen(back).totals;
    ok(`★★ 팬톤을 실은 링크가 **같은 금액**으로 돌아온다 — 개당 ${a.perEA}원 = ${b.perEA}원 · ` +
       `공정합계 ${a.process.toLocaleString()}원 = ${b.process.toLocaleString()}원`,
       a.perEA === b.perEA && a.process === b.process && a.perEA > 0,
       `${a.perEA}/${b.perEA} · ${a.process}/${b.process}`);
    ok("★ 팬톤이 붙어도 `q=` 페이로드는 **한 글자도 안 바뀐다**",
       payloadOfHash(plain) === payloadOfHash(withPms));
    ok("팬톤이 비면 주소가 **종전과 바이트 동일**하다 (기존 링크·왕복 게이트가 안 움직인다)",
       specHash("showroom", spotSpec, { pf: "", pb: "" }) === plain &&
       specHash("showroom", spotSpec, {}) === plain);
    // 이빨 — 위 「금액이 같다」가 「아무것도 안 실렸으니 같다」가 아님을 보인다.
    ok("이빨: 그래도 팬톤은 **주소에 실려 있다** (안 실리면 새로고침에 사라진다)",
       /&pf=185(%20| )C/.test(withPms) && /&pb=Reflex(%20| )Blue(%20| )C/.test(withPms), withPms.slice(-40));
    // 이빨 — 별색 **도수**는 금액을 실제로 움직인다(그래서 SPEC_KEYS 에 있다)
    ok("이빨: 별색 도수는 금액을 움직인다 (204 ≠ 별색 2도)",
       quoteScreen(SOSCO).totals.perEA !== a.perEA,
       `원색4 ${quoteScreen(SOSCO).totals.perEA}원 / +별색2 ${a.perEA}원`);
  }

  // ── ⑥ 해시 왕복 — 부스에서 새로고침·주소 공유에 살아남는가 ────────
  {
    const h = specHash("showroom", SOSCO, { nc: true, pf: "185 C", pb: "Reflex Blue C" });
    const got = pmsOfHash(h);
    ok("팬톤이 해시 왕복에서 그대로다", got.f === "185 C" && got.b === "Reflex Blue C", JSON.stringify(got));
    ok("가림 비트와 **같이** 실려도 서로 안 먹는다",
       noCostOfHash(h) && pmsOfHash(h).f === "185 C" && payloadOfHash(h) === encodeSpec(SOSCO));
    ok("팬톤이 없는 주소는 빈 값을 준다", JSON.stringify(pmsOfHash(specHash("showroom", SOSCO))) ===
       JSON.stringify({ f: "", b: "" }));
    //  ⚠ 해시는 **바깥에서 들어오는 값**이다 — 누가 링크를 고쳐 보낼 수 있다.
    ok("깨진 %-쌍은 그 칸만 버린다 (링크 하나가 화면을 못 죽인다)",
       pmsOfHash("#/showroom?q=x&pf=%E0%A4%A&pb=185%20C").b === "185 C");
    ok("긴 문자열은 32자로 자른다 (주소 오염 방어)",
       pmsOfHash(`#/showroom?q=x&pf=${"A".repeat(200)}`).f.length === 32);
    //  ★★ 낯선 문자열로 **견본을 칠하지 않는다** — 출처를 못 대는 색을 고객에게
    //     보여주는 것이 이 기능이 막으려는 바로 그 일이다.
    ok("★ 색표에 없는 이름은 findPantone 이 null 이다 (견본을 못 그린다)",
       findPantone(L, "<script>x</script>") === null &&
       findPantone(L, "Pantone 2925 C") === null && findPantone(L, "") === null);
    ok("이빨: 색표에 있는 이름은 찾는다 (검사가 공허하지 않다)",
       findPantone(L, "185 C")?.hex === "#FF173D" && findPantone(L, "Pantone 185 C")?.name === "Pantone 185 C");
    ok("주소에 실을 코드가 짧다 «185 C» (부스에서 주소창을 그대로 읽는다)",
       pmsCodeOf(findPantone(L, "Pantone 185 C")) === "185 C");
    ok("CMYK 는 출처 값 그대로 적는다 (우리가 환산하지 않는다)",
       cmykTextOf(findPantone(L, "185 C")) === "C 0 · M 91 · Y 76 · K 0", cmykTextOf(findPantone(L, "185 C")));
  }

  // ── ⑦ 사양 줄 — 「별색 2도」로 끝나면 무슨 색인지가 화면에서 빠진다 ─
  {
    const r = showroomScreen(SOSCO, { spec: { ...specOf(baseOf(SOSCO)), fpSp: "2", bpSp: "1", bpColor: true } });
    const plain = specSummaryOf(r.q?.lines, T("ko"));
    const withP = specSummaryOf(r.q?.lines, T("ko"), { f: "Pantone 185 C", b: "Pantone Reflex Blue C" });
    ok("사양 줄에 팬톤 이름이 남는다 (앞·뒤 각각)",
       withP.includes("(Pantone 185 C)") && withP.includes("(Pantone Reflex Blue C)"), withP);
    // ★ 자리 — **그 면의 인쇄 줄 안**이다. 맨 끝에 붙이면 어느 면 이야기인지 사라진다.
    ok("★ 자리가 그 면의 인쇄 줄 **안**이다 (맨 끝이 아니다)",
       /별색[^·]*\(Pantone 185 C\)/.test(withP) && !/\(Pantone 185 C\)\s*$/.test(withP), withP);
    ok("일본어 화면에서도 같은 자리에 남는다",
       /特色|별색/.test(specSummaryOf(r.q?.lines, T("ja"), { f: "Pantone 185 C" })) &&
       specSummaryOf(r.q?.lines, T("ja"), { f: "Pantone 185 C" }).includes("(Pantone 185 C)"));
    ok("★ 하위호환 — 팬톤을 안 넘기면 **종전과 같은 문자열**이다",
       specSummaryOf(r.q?.lines, T("ko"), undefined) === plain &&
       specSummaryOf(r.q?.lines, T("ko"), { f: "", b: "" }) === plain, plain);
  }

  // ── ⑧ ★ 화면이 정직성을 **말하는가** (소스 대조 · §M ⑪ 과 같은 규율) ──
  //  이 기능의 절반이 이 문구다. 지우면 이 게이트가 빨개진다.
  {
    const p = readFileSync(new URL("../src/showroom/ShowroomPage.jsx", import.meta.url), "utf8");
    const pm = readFileSync(new URL("../src/showroom/pantone.mjs", import.meta.url), "utf8");
    ok("★ 견본 옆에 «화면 색은 참고» 가 있다 (모니터로 색을 승인받으면 분쟁이 된다)",
       /data-pms-warn="screen"/.test(p) && /warnScreen/.test(p));
    ok("★ 견본 옆에 «색을 골라도 금액은 안 바뀐다» 가 있다",
       /data-pms-warn="price"/.test(p) && /warnPrice/.test(p));
    ok("★ 검색 패널 안에 출처·상표 한 줄이 있다",
       /data-pms-src="1"/.test(p) && /warnScreen[\s\S]{0,900}data-pms-src/.test(p));
    ok("두 언어 다 있다 — 일본어는 1급이다 (고객이 읽는 쪽)",
       ["warnScreen", "warnPrice", "src", "none", "offline", "unknown", "loading"]
         .every(k => new RegExp(`\\b${k}:`).test(pm.split("const PMS_JA")[0]) &&
                     new RegExp(`\\b${k}:`).test(pm.split("const PMS_JA")[1] || "")));
    ok("일본어 문구가 실제로 일본어다 (한국어 사전을 복사해 두지 않았다)",
       /画面の色は参考です/.test(pm) && /金額は変わりません/.test(pm) &&
       /Pantone LLC とは無関係/.test(pm));
    ok("한국어 문구가 «Pantone LLC 와 무관» 을 명시한다",
       /Pantone LLC 와 무관/.test(pm) && /등록상표/.test(pm) && /근사값/.test(pm));
    ok("★ 「없는 번호」와 「없는 색」을 구별해 말한다 (수록 범위를 적는다)",
       /팬톤 전체가 아닙니다/.test(pm) && /100–699/.test(pm) &&
       /パントン全体ではありません/.test(pm));
    ok("★ 못 받으면 화면이 말한다 (조용히 안 죽는다)",
       /data-pms-offline/.test(p) && /色表を読み込めませんでした/.test(pm) &&
       /색표를 못 불러왔습니다/.test(pm));
    // ★ **받는 중에는 검색칸을 안 잠근다** — 색표를 받기 시작하는 순간이 곧 운영자가
    //   이 칸을 누르는 순간이다(별색 도수를 올린 직후). 전시장 Wi-Fi 에서 178KB 가
    //   한두 초 걸리는데 그동안 잠겨 있으면 고객 앞에서 친 「185」가 통째로 사라진다.
    ok("★ 받는 중(pmsData null)에는 검색칸이 안 잠긴다 — 잠그는 것은 못 받았을 때뿐이다",
       /disabled=\{!!pmsData && !pmsData\.ok\}/.test(p) && !/disabled=\{!pmsData\?\.ok\}/.test(p));
    // ★ 별색 0 이면 접힌다 — 안 쓰는 칸이 고객 앞 화면을 채우지 않는다.
    ok("별색이 0 이면 팬톤 칸이 통째로 접힌다",
       /const pmsNeeded = spotOf\("f"\) > 0 \|\| spotOf\("b"\) > 0;/.test(p) &&
       /\{pmsNeeded && \(/.test(p) &&
       /\["f", "b"\]\.filter\(sd => spotOf\(sd\) > 0\)/.test(p));
    // ★ 팬톤은 `over`(= quoteInputOf 로 흘러가는 사양 한 벌)와 **다른 상태**다.
    //   같은 훅에 끼우는 순간 팬톤이 금액 계산기의 입력이 된다.
    ok("★ 팬톤이 `over` 가 아니라 **별개 상태**다 (금액 경로에 안 닿는다)",
       /const \[pms, setPms\] = useState\(/.test(p) && !/put\("[fb]p[A-Za-z]*[Pp]ms/.test(p));
    // ★ 견본은 **색표에서 찾은 항목**으로만 칠한다.
    ok("★ 견본은 findPantone 이 찾은 항목(rec)으로만 칠한다 — 링크 문자열로 안 칠한다",
       /background: rec\.hex/.test(p) && /rec \? \(<>/.test(p) && !/background: pms\[sd\]/.test(p));
    // ★ 첫 화면을 무겁게 하지 않는다 — 178KB 는 fetch 로 미룬다(동적 import 는 금지다).
    ok("색표를 번들에 안 넣는다 (fetch · import.meta.env.BASE_URL)",
       /fetch\(urlOf\(\)\)/.test(pm) && /import\.meta\.env\?\.BASE_URL/.test(pm) &&
       !/from "\.\..*pantone-approx/.test(pm));
  }

  globalThis.fetch = realFetch; _resetPantoneCache();
}

console.log(`\n${"=".repeat(78)}`);
console.log(`사양 연동: ${pass}/${total}`);
if (fails.length) {
  console.log(`\n❌ 실패 ${fails.length}건:`);
  for (const f of fails) console.log(`  · ${f}`);
  process.exitCode = 1;
}

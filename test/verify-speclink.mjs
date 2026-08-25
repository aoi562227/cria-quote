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
  specHash, payloadOfHash,
} from "../src/ui/state.mjs";
import {
  quoteInputOf, specSummaryOf, capToQuoteUp, seedFromAuto, linkStateOf,
  frameOf, partOf, autoPlace, STD, T,
} from "../src/showroom/showroom-core.mjs";
import { upGateOf } from "../src/ui/state.mjs";

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
    qty: +(over.qty ?? carried?.qty ?? 0), carried,
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

console.log(`\n${"=".repeat(78)}`);
console.log(`사양 연동: ${pass}/${total}`);
if (fails.length) {
  console.log(`\n❌ 실패 ${fails.length}건:`);
  for (const f of fails) console.log(`  · ${f}`);
  process.exitCode = 1;
}

// ══════════════════════════════════════════════════════════════════
//  pantone.mjs — 부스에서 고객이 **부르는 팬톤 번호**를 찾아 견본을 띄운다.
//
//  사용자 요구 원문: 「우리꺼에 팬톤색상 검색하면 나올 수 있도록 그런 기능은 추가가안되나?」
//  일본 전시회 부스에서 고객이 「이 색」 하고 번호를 부른다. 그때 운영자가 종이 컬러칩을
//  뒤지는 대신 화면에서 번호를 쳐서 **무슨 색인지 서로 확인**하는 것이 이 파일의 전부다.
//
//  ★★ 이 기능의 절반은 **정직성**이고, 그 문구는 아래 PMS_T 가 소유한다. 세 가지다:
//   ① 이 값은 **팬톤 인증 색상이 아니다.** 커뮤니티가 모은 근사치이고, PANTONE 은
//      Pantone LLC 의 등록상표다. 이 앱은 gh-pages 로 공개 배포된다 — 화면이 「팬톤
//      색상표」라고 말하는 순간 우리가 남의 IP 를 배포한다고 주장하는 셈이 된다.
//   ② ★ **모니터로 색을 승인받으면 안 된다.** sRGB 화면은 별색을 재현하지 못한다.
//      부스에서 고객이 화면 견본을 보고 「이 색으로 해주세요」 하면 그게 그대로 분쟁이
//      된다 — 인쇄물이 화면과 다른 것은 **정상**인데 고객은 화면을 봤다고 기억한다.
//      그래서 그 경고를 견본 **바로 옆**에 둔다(구석의 작은 글씨가 아니다).
//   ③ **가격은 안 바뀐다.** 금액을 움직이는 것은 별색 **도수**(fpSp/bpSp)이고
//      「어느 팬톤인가」는 한 원도 안 움직인다. 색을 골랐는데 숫자가 그대로면 고객은
//      「반영이 안 됐나」로 읽는다 — 그래서 화면이 먼저 말한다.
//
//  ★ 왜 번들이 아니라 fetch 인가 — 색표가 178KB 다. import 로 묶으면 **첫 화면**이
//    그만큼 무거워지는데, 이 화면의 주인공은 도면과 판이고 팬톤은 별색을 쓸 때만
//    열리는 곁가지다. public/ 에 두고 **처음 쓸 때 한 번** 받아서 모듈에 캐시한다.
//    ⚠ 동적 import 로 지연 로딩하지 마라 — verify-speclink §M ⑧ 이 src/ 에서
//      `import(` 를 grep 으로 금지한다(부스에서 사람이 친 문자열이 코드가 되는 길).
//
//  ★ 못 받았을 때(오프라인 부스 · 404 · 배포 누락) **조용히 죽지 않는다.** loadPantone 은
//    던지지 않고 `{ ok:false, why }` 를 준다. 검색칸이 그 사실을 말하고 나머지 화면은
//    종전 그대로 돈다 — 색표 하나가 견적 화면을 못 죽인다.
// ══════════════════════════════════════════════════════════════════

/** public/ 에 둔 색표 파일 이름. `-approx` 를 파일명에 박아 둔 것이 의도다 —
 *  dist/ 로 복사되어 공개 주소에 그대로 뜨는 파일이고, 그 주소를 직접 여는 사람도
 *  **이름만 보고** 「인증 색상표가 아니라 근사값」임을 알아야 한다. 파일 머리의
 *  `_notice` 에 출처·라이선스·상표·수록범위·검증결과가 전부 적혀 있다. */
export const PANTONE_FILE = "pantone-approx.json";

/**
 * 색표 주소. **`import.meta.env.BASE_URL` 을 쓴다** — 배포 base 가 `/cria-quote/` 다
 * (gh-pages). `/pantone-approx.json` 으로 적으면 dev 서버에서만 되고 배포에서 404 다.
 * ⚠ node(SSR 렌더 게이트 · verify-speclink §M ⑯)에는 `import.meta.env` 가 없다.
 *   그래서 옵셔널 체이닝으로 읽고 "/" 로 떨어진다 — 이 줄이 모듈 로드 때 던지면
 *   쇼룸 화면 전체가 SSR 에서 못 그려진다.
 */
const urlOf = () => `${import.meta.env?.BASE_URL ?? "/"}${PANTONE_FILE}`;

// ── 캐시 ────────────────────────────────────────────────────────────
//  모듈 스코프다(컴포넌트 상태가 아니다). 언어를 바꾸거나 화면이 다시 마운트돼도
//  두 번 받지 않는다. `inflight` 는 **동시 호출 합류**용 — 앞/뒤 두 칸이 같은 프레임에
//  열리면 요청이 두 번 나간다.
let cache = null;
let inflight = null;

/** 실패도 **값**이다 — 던지지 않는다. 화면이 그 사실을 말해야 하기 때문이다. */
const fail = why => ({ ok: false, list: [], why });

/**
 * 색표 한 벌. 처음 부를 때 한 번 받고 그 뒤로는 캐시.
 * @returns {Promise<{ok:boolean, list:Array, why:string}>}
 */
export function loadPantone() {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  if (typeof fetch !== "function") {           // node · 아주 오래된 브라우저
    cache = fail("no-fetch");
    return Promise.resolve(cache);
  }
  inflight = fetch(urlOf())
    .then(r => (r.ok ? r.json() : Promise.reject(new Error(`http-${r.status}`))))
    .then(j => {
      const rows = Array.isArray(j) ? j : (j && Array.isArray(j.colors) ? j.colors : null);
      if (!rows || rows.length === 0) return fail("empty");
      const list = rows.map(indexOne).filter(Boolean);
      // ⚠ 「몇 건 받았는가」를 믿지 않는다 — 배포가 반쪽 파일을 올렸을 수도 있다.
      //   한 건도 못 세우면 실패로 접는다(빈 검색칸을 정상처럼 보여주지 않는다).
      return list.length ? { ok: true, list, why: "" } : fail("empty");
    })
    .catch(e => fail(String((e && e.message) || e || "error")))
    .then(r => { cache = r; inflight = null; return r; });
  return inflight;
}

/** 시험·오프라인 시연에서 캐시를 비운다. 화면 코드는 안 부른다. */
export function _resetPantoneCache() { cache = null; inflight = null; }

// ── 색인 ────────────────────────────────────────────────────────────
//  ★ 왜 색인을 미리 세우는가 — **실측**이다. 2,415건 선형 스캔은 타이핑마다 도는데,
//    항목마다 `toLowerCase()` + `replace()` 를 부르면 그 두 개가 비용의 전부다.
//    받을 때 한 번만 접어 두면 검색은 문자열 비교만 남는다(수치는 파일 끝 주석).
const HEX = /^#[0-9A-Fa-f]{6}$/;

/** 「Pantone 185 C」 → { code:"185", sfx:"C", key:"185c", num:185 } 를 덧붙인다.
 *  형식이 아닌 항목은 **버린다**(null) — 견본을 그릴 수 없는 줄을 목록에 두면
 *  고객 앞에서 빈 네모가 뜬다. */
function indexOne(o) {
  if (!o || typeof o.name !== "string" || typeof o.hex !== "string") return null;
  if (!HEX.test(o.hex)) return null;
  const name = o.name.trim();
  if (!name) return null;
  const body = name.replace(/^pantone\s+/i, "");
  const m = /^(.*?)\s+([CUM])$/.exec(body);
  const code = (m ? m[1] : body).trim();
  const sfx = m ? m[2] : "";
  const numM = /^(\d+)$/.exec(code);
  return {
    name, hex: o.hex.toUpperCase(),
    c: n100(o.c), m: n100(o.m), y: n100(o.y), k: n100(o.k),
    code, sfx,
    key: norm(body),                 // "185c" · "reflexbluec"
    ckey: norm(code),                // "185"  · "reflexblue"
    num: numM ? Number(numM[1]) : -1,
  };
}
const n100 = v => (typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0);

/** 대소문자·공백·구두점을 없앤다. 부스에서 치는 것은 「185」「185 C」「185-C」다. */
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** 「pantone 185c」「pms 185」「팬톤 185」「パントン 185」처럼 앞에 붙여 치는 말을 턴다. */
const stripLead = s => String(s || "")
  .replace(/^\s*(pantone|pms|팬톤|판톤|パントン|パントーン)\s*/i, "");

// C 를 맨 앞에 둔다 — 우리 견적이 실제로 받는 지시는 거의 **코팅지(C)** 기준이다.
const SFX_ORDER = { C: 0, U: 1, M: 2, "": 3 };

/**
 * 검색. **번호 정확일치를 이름 부분일치보다 위로** 올린다 — 부스에서 치는 것은 번호다.
 *
 * 순위 (작을수록 위)
 *   0  전체 정확일치   「185 c」 → Pantone 185 C
 *   1  번호 정확일치   「185」   → Pantone 185 C/U/M   ← 부스의 기본 동작
 *   2  앞자리 일치     「18」    → 180 C · 181 C …
 *   3  이름 부분일치   「reflex」→ Reflex Blue C/U/M
 * 같은 순위 안에서는 **C·U·M 순 → 번호 오름차순 → 이름** 이다.
 *
 * @returns {{hits:Array, total:number}} total 은 자르기 **전** 건수 —
 *   화면이 「6/24」처럼 적어야 운영자가 「이게 전부」로 오해하지 않는다.
 */
export function searchPantone(list, query, limit = 6) {
  const q = norm(stripLead(query));
  if (!q || !Array.isArray(list)) return { hits: [], total: 0 };
  const found = [];
  for (const o of list) {
    let rank = -1;
    if (o.key === q) rank = 0;
    else if (o.ckey === q) rank = 1;
    else if (o.key.startsWith(q)) rank = 2;
    else if (o.key.includes(q)) rank = 3;
    if (rank >= 0) found.push({ rank, o });
  }
  found.sort((a, b) =>
    a.rank - b.rank ||
    (SFX_ORDER[a.o.sfx] ?? 9) - (SFX_ORDER[b.o.sfx] ?? 9) ||
    a.o.num - b.o.num ||
    (a.o.name < b.o.name ? -1 : a.o.name > b.o.name ? 1 : 0));
  return { hits: found.slice(0, Math.max(1, limit)).map(f => f.o), total: found.length };
}

/** 링크에서 돌아온 이름 하나를 목록에서 되찾는다. 못 찾으면 null —
 *  ⚠ 해시는 **바깥에서 들어오는 값**이다(누가 링크를 고쳐 보낼 수 있다). 목록에 없는
 *    이름으로 **견본을 칠하면 안 된다** — 우리가 출처를 못 대는 색을 고객에게
 *    보여주는 것이고, 그게 이 파일이 막으려는 바로 그 일이다. */
export const findPantone = (list, name) => {
  const k = norm(stripLead(name));
  if (!k || !Array.isArray(list)) return null;
  return list.find(o => o.key === k) || null;
};

/** CMYK 를 한 줄로. 값은 출처 그대로이고 **우리가 환산하지 않는다** — 환산하면
 *  그 수는 우리 주장이 된다. */
export const cmykTextOf = o => (o ? `C ${o.c} · M ${o.m} · Y ${o.y} · K ${o.k}` : "");

// ── 링크에 싣기 ──────────────────────────────────────────────────────
//  해시 **형식**은 state.mjs 가 소유한다(specHash · payloadOfHash · noCostOfHash 와
//  같은 자리). 쓰는 쪽과 읽는 쪽이 다른 파일에 있으면 조용히 갈린다 — 이 저장소가
//  SHOWROOM_SPEC_KEYS 에 대해 「이 배열이 유일한 출처다」라고 못박은 것과 같은 규율이다.
//  ⟹ `pf=` · `pb=` 를 짓고 읽는 것은 state.mjs 의 specHash / pmsOfHash 이고,
//     **왜 SPEC_KEYS 가 아니라 형제 파라미터인가**의 논증도 거기에 있다(요지: 팬톤
//     번호는 금액을 한 원도 안 움직이는데 SPEC_KEYS 는 「금액을 움직이는 키」의 목록이다).
//  ⚠ 알려진 한계: 「견적 앱으로 →」로 나갔다가 견적 앱의 「쇼룸으로」로 되돌아오면
//    이 값은 **사라진다**(견적 앱은 자기 상태에서 해시를 다시 짓는다). 견적서 화면에는
//    팬톤을 적을 자리가 없으므로 지금은 그게 맞는 동작이다 — 나르려면 App.jsx 가
//    쓰지도 않는 값을 통과시켜야 하고, 그건 「이 화면이 쓰는 것만 이 화면이 든다」를 깬다.
//  ⚠ 반대로 **쇼룸 안**(새로고침 · 주소 공유 · 뒤로가기)에서는 그대로 산다. 부스에서
//    「그 사양 그대로 다시 띄워 주세요」가 주소 하나로 넘어가는 것이 요구의 본체다.

/** 주소에 실을 때 쓰는 짧은 코드 — 「Pantone 185 C」 → 「185 C」.
 *  부스에서 **주소창을 그대로 읽을 수 있어야 한다**(encodeSpec 주석과 같은 규율). */
export const pmsCodeOf = o => (o ? `${o.code}${o.sfx ? ` ${o.sfx}` : ""}` : "");

// ══════════════════════════════════════════════════════════════════
//  말 (한국어 / 일본어) — ★ 이 사전이 이 기능의 절반이다
// ══════════════════════════════════════════════════════════════════
//  왜 여기인가 — showroom-core 의 T 는 「판걸이 화면의 말」이고, 이 사전은 **팬톤이라는
//  남의 상표를 다루는 말**이라 출처·면책과 한 덩어리로 읽혀야 한다. price-formula 가
//  ADMIN_T 를 직접 들고 있는 것과 같은 판단이다.
//  ⚠ 일본어는 **1급**이다(고객이 읽는 쪽이다). 한쪽만 고치지 마라.
const PMS_KO = {
  label: "팬톤",
  ph: "번호 또는 이름 (185 · 185 C · reflex)",
  open: "팬톤 찾기", close: "닫기", clear: "지우기",
  // ★ 견본 **바로 옆**에 붙는 두 줄. 구석의 작은 글씨로 내리지 마라 — 그 두 줄이
  //   이 기능을 「부스에서 써도 되는 것」으로 만든다.
  warnScreen: "화면 색은 참고입니다 — 실제 색은 팬톤 컬러칩으로 확인하세요.",
  warnPrice: "색을 골라도 금액은 바뀌지 않습니다 (금액은 별색 도수로 정해집니다).",
  // 검색 패널 안 한 줄 — 출처·라이선스·상표.
  src: "참고용 근사값 · 출처 mcp-print (MIT) · PANTONE® 은 Pantone LLC 의 등록상표이며 " +
       "이 앱은 Pantone LLC 와 무관합니다.",
  // ★ 「없는 번호」와 「없는 색」을 구별해 말한다 — 이 색표는 팬톤 전체가 아니다
  //   (수록 100–699 · 7400–7549 · 이름색 55). 부스에서 운영자가 「그런 색 없습니다」라고
  //   말해 버리면 그건 우리가 하지 않은 확인을 한 것처럼 구는 것이다.
  none: "이 색표에 없는 번호입니다. 색표는 팬톤 전체가 아닙니다 " +
        "(수록: 100–699 · 7400–7549 · 이름색 55). 컬러칩으로 확인하세요.",
  more: (n, t) => `${n}/${t}건 표시`,
  loading: "색표를 읽는 중…",
  // 오프라인 부스·404 — 조용히 죽지 않는다.
  offline: "색표를 못 불러왔습니다 — 팬톤 번호는 컬러칩으로 확인하세요.",
  retry: "다시 시도",
  // 링크로 돌아온 코드를 목록에서 못 찾았다. 견본을 **안 그린다**.
  unknown: c => `링크의 「${c}」 는 이 색표에서 확인하지 못했습니다 — 견본을 그리지 않습니다.`,
};
const PMS_JA = {
  label: "パントン",
  ph: "番号または名称 (185 · 185 C · reflex)",
  open: "パントンを探す", close: "閉じる", clear: "クリア",
  warnScreen: "画面の色は参考です — 実際の色はパントンのカラーチップでご確認ください。",
  warnPrice: "色を選んでも金額は変わりません（金額は特色の色数で決まります）。",
  src: "参考用の近似値 · 出典 mcp-print (MIT) · PANTONE® は Pantone LLC の登録商標です。" +
       "本アプリは Pantone LLC とは無関係です。",
  none: "この色表には無い番号です。色表はパントン全体ではありません" +
        "（収録: 100–699 · 7400–7549 · 名称色 55）。カラーチップでご確認ください。",
  more: (n, t) => `${t}件中 ${n}件を表示`,
  loading: "色表を読み込み中…",
  offline: "色表を読み込めませんでした — パントン番号はカラーチップでご確認ください。",
  retry: "再試行",
  unknown: c => `リンクの「${c}」はこの色表で確認できませんでした — 見本は表示しません。`,
};
export const TP = lang => (lang === "ja" ? PMS_JA : PMS_KO);

// ── 실측 (26-08-27 · node 20 · 이 PC) ────────────────────────────────
//  「2,415건 선형 스캔이면 충분한가」를 **재고** 넣었다. 색인을 세운 뒤 질의 4개를
//  1,000회씩 돌린 **중앙값**:
//      「reflex」0.009ms · 「black」0.015ms · 「185」0.031ms · 「1」0.095ms(최악)
//      최악 질의의 p99 0.17ms · 관측 최대 0.41ms
//  최악이 「1」인 이유는 매칭이 542건이라 정렬이 커지기 때문이지 스캔 때문이 아니다.
//  타이핑 한 글자에 60fps 예산이 16.7ms 이므로 **0.6%** 를 쓴다 — 해시맵·트라이를 더
//  세울 값이 없다. 비용의 대부분은 위 indexOne 이 **받을 때 한 번** 치른다(2,415건 2.8ms).
//  ⚠ 되돌려 검색 안에서 toLowerCase/replace 를 부르면 여기 수치가 무의미해진다.

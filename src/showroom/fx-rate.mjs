// ══════════════════════════════════════════════════════════════════
//  fx-rate.mjs — 환율을 **네트워크에서** 받아 온다 (26-09-04 신설)
//  설계 판단 전문은 ARCHITECTURE §18. 이 주석은 코드 옆에 있어야 하는 만큼만 적는다.
//
//  왜 이 파일이 있는가
//  ─────────────────
//  price-formula 의 수식은 `*1.7/10` 처럼 쓰였다 — **마진 1.7 배와 환율 10 이 한
//  상수에 섞여** 있었다. 그래서 ① 환율이 움직여도 화면은 조용히 그대로였고
//  ② 운영자가 환율을 고치려면 마진이 적힌 문자열을 고쳐야 했다(마진을 잘못 만질 자리다)
//  ③ 화면이 「환율 얼마로 환산했는지」를 원리적으로 말할 수 없었다.
//  이제 수식에 **환율 토큰**이 있다: `*1.7/환율`. 마진은 수식에, 환율은 이 파일에.
//
//  ★ 이 파일이 하는 일은 **하나뿐이다 — 「지금 쓸 원/엔 값 하나」를 정직하게 내놓는다.**
//    계산도 표시도 안 한다(그건 price-formula). 원가는 이름조차 안 나온다.
//
//  ★★ **틀린 값을 내놓지 않는 것**이 이 파일의 존재 이유다.
//  ────────────────────────────────────────────────────────────────
//  고객 앞에 뜨는 가격의 분모다. 여기서 8.7 대신 0.87 이 나오면 화면은 ¥399 를 띄우고
//  그 수는 **진짜처럼 보인다**(price-formula BAND 주석의 ¥379 와 같은 사고다).
//  그래서 이 파일은 의심하는 쪽으로 넉넉히 기울어 있다:
//    · 상식 밴드 밖이면 **안 쓴다**(경고가 아니라 거부다 — 아래 BAND 주석).
//    · 통화 키가 없거나 result 가 success 가 아니면 안 쓴다.
//    · 못 받으면 **원가로 폴백하지 않는다** — 마지막으로 받은 값(시각을 화면에 적는다)
//      이나 수동 값을 쓰고, 둘 다 없으면 price-formula 가 「—」를 놓는다.
//    · 저장소에 남은 값도 되읽을 때 **다시 검사한다**(오래된 코드가 심어둔 값일 수 있다).
//
//  ★ 갱신 시점을 **코드가 통제한다.** 타이머로 갱신하지 않는다 —
//    고객에게 ¥38 을 보여준 뒤 환율이 갱신돼 ¥39 가 되면 그 자체가 사고다.
//    갱신은 두 곳뿐이다: **화면 진입 시 1회**(그것도 캐시가 낡았을 때만) ·
//    **관리자가 「지금 갱신」을 누를 때.** ShowroomPage 가 그 두 곳을 소유한다.
//
//  ★ fetch 를 **주입 가능하게** 받는다(fetchFxRate 의 fetchImpl). CI 에는 망이 없고,
//    테스트가 실제 망을 타면 CI 가 남의 서버 상태에 묶인다. 게이트는 가짜 fetch 로
//    응답 모양·거부 조건을 재고, 실측은 브라우저에서 한다(둘이 다른 일을 한다).
// ══════════════════════════════════════════════════════════════════

// ── ★ 상식 밴드 — KRW→JPY (1원이 몇 엔인가) ────────────────────────
//  대략 0.08~0.15 다. 2026-09 실측 0.115(1엔 ≈ 8.70원) — 즉 1엔 = 6.67~12.50원.
//
//  ★★ **이 밴드는 「역사적 전 구간」이 아니다. 일부러 좁다.** 앞선 주석은 「1엔이
//    7원~13원을 벗어난 적이 없다」고 적었는데 **그건 사실이 아니다** — 2008~09 금융
//    위기에 100엔이 1,500~1,600원(= 1엔 15~16원)까지 갔다. 그리고 지금 상한 12.50 은
//    그 문장이 든 13원조차 안 덮는다. 틀린 근거를 지우고 진짜 이유를 적는다:
//      · 이 밴드가 막으려는 것은 **환율 변동이 아니라 우리의 오독**이다. 실제로
//        재현되는 오독은 전부 자릿수 사고다(뒤집힘 0.11 · 100배 0.09 · 1/100 869 ·
//        USD 를 JPY 키로 1389 — 전부 밴드 밖). 좁혀도 그 검출력은 그대로다.
//      · 넓히면 잃는 것이 크다. 20 까지 열면 KRW→INR(≈16.4) 같은 **다른 통화 값이
//        통과**한다 — 그 순간 화면이 조용히 틀린 가격을 낸다. 이 파일이 막으려는 바로 그것.
//      · 좁아서 지는 비용은 **조용하지 않다.** 진짜 환율이 12.50 을 넘는 날이 오면
//        받기를 **거부**하고 관리자 패널이 이유를 글자로 띄운다(「상식 범위를
//        벗어납니다」). 값이 틀리는 게 아니라 안 들어온다 — 그리고 운영자는 수동
//        입력으로 즉시 넘어갈 수 있다(⑤ manualFxOf). 그 탈출구가 있다는 것이
//        상한을 좁게 둘 수 있는 근거다.
//    ⟹ 환율이 밴드를 벗어난 채 며칠 가면 **밴드를 넓히지 말고** 수동으로 운용하다가,
//       그때의 실제 시세를 보고 이 두 상수를 고쳐라(고칠 때 이 문단도 같이 고쳐라).
//  ⚠ price-formula 의 BAND 와 **다른 성질**이다. 그쪽은 「사람이 친 수식」이라
//    거부하면 부스에서 맞는 수식이 막히므로 **경고**였다. 여기는 「기계가 준 수」다 —
//    범위 밖이면 우리가 응답 모양을 잘못 읽었거나 API 가 바뀐 것이고, 둘 다
//    **그 값을 쓰면 안 되는** 경우다. 그래서 거부한다.
const JPY_PER_KRW_MIN = 0.08;
const JPY_PER_KRW_MAX = 0.15;

/** 수식이 쓰는 단위는 그 **역수**다 — 「1엔이 몇 원인가」. 종전 `*1.7/10` 의 10 자리.
 *  왜 역수인가: 운영자가 이미 그 자리에 10 을 적어 왔다. `10` → `환율` 한 낱말만
 *  바꾸면 되는 것이 가장 안 틀리는 이사다(곱셈으로 뒤집으면 수식을 다시 지어야 한다). */
export const FX_MIN = 1 / JPY_PER_KRW_MAX;   // 6.666… 원/엔
export const FX_MAX = 1 / JPY_PER_KRW_MIN;   // 12.5   원/엔

/** 며칠 지나면 「낡았다」고 말하는가.
 *  3 일인 이유 — ECB 는 **영업일에만** 낸다. 월요일 아침에 받은 값의 기준일은
 *  금요일이고 그것이 정상이다(3 일). 4 일 이상이면 연휴이거나 우리가 며칠째
 *  망 없이 캐시를 쓰고 있는 것이고, 둘 다 사람이 알아야 한다. */
export const FX_STALE_DAYS = 3;

/** 캐시가 이만큼 지났으면 진입 시 다시 받는다. 「하루에 몇 번」이면 충분하다 —
 *  부스에서 새로고침을 50 번 해도 망을 50 번 타지 않는다(태블릿에서 그 대가가 크다). */
export const FX_FRESH_MS = 6 * 60 * 60 * 1000;

const TIMEOUT_MS = 6000;   // 부스 와이파이가 죽어 있을 때 화면이 6 초 넘게 기다리지 않는다

// ══════════════════════════════════════════════════════════════════
//  ① 어디서 받나 — **실제로 호출해 보고** 고른 목록이다 (26-09-04 실측)
// ══════════════════════════════════════════════════════════════════
//  요건: 키 없음 · CORS 허용 · KRW→JPY · https.
//
//  ★★ **node 에서 되는 것과 브라우저에서 되는 것이 달랐다.** 실측 기록:
//    · api.frankfurter.app — node 의 fetch 로는 200 이고 응답 헤더에
//      `access-control-allow-origin: *` 까지 있었다. 그런데 **브라우저에서는 막혔다**:
//        Access to fetch at 'https://api.frankfurter.app/latest?from=KRW&to=JPY'
//        from origin 'http://localhost:5173' has been blocked by CORS policy:
//        No 'Access-Control-Allow-Origin' header is present on the requested resource.
//      캐시버스터를 붙여도 같았다(엣지 캐시 문제가 아니다). ⟹ **못 쓴다.**
//      문서만 읽고 골랐으면 부스에서 처음 알았을 자리다.
//    · api.exchangerate.host — 200 이지만 본문이
//      `{"success":false,"error":{"code":101,"type":"missing_access_key"}}` 다.
//      이제 키가 필요하다. ⟹ **못 쓴다.** (「키 없음」이 요건이다.)
//  ⟹ 살아남은 둘만 싣는다. 아래 두 줄은 브라우저에서 200 을 받아 본 주소다.
//
//  왜 둘인가 — 하나가 죽으면 부스에서 고칠 방법이 없다. 순서대로 시도하고 **처음
//  통과한 하나**를 쓴다(두 값을 평균하지 않는다 — 그러면 화면의 환율이 어느 출처의
//  수도 아니게 되고, 고객이 검산할 수 있는 수가 아니게 된다).
//  실측 대조: 두 출처가 0.115068 대 0.11495 로 **0.10% 차이**였다. 어느 쪽을 써도
//  ¥ 한 자리가 안 바뀐다 — 그래서 순서만 정하고 교차검증은 안 한다.
export const FX_SOURCES = [
  {
    // 매일(주말 포함) 갱신되고 갱신 시각을 초 단위로 준다. 브라우저에서 ACAO `*` 확인.
    id: "erapi",
    label: "open.er-api.com (exchangerate-api 무료)",
    url: "https://open.er-api.com/v6/latest/KRW",
    // 실제 응답(2026-09-04): {"result":"success",…,"time_last_update_unix":1788480151,
    //   "time_last_update_utc":"Fri, 04 Sep 2026 00:02:31 +0000","base_code":"KRW",
    //   "rates":{"KRW":1,…,"JPY":0.115068,…}}   ← 전 세계 통화가 다 와서 2.9KB 다
    read: j => {
      if (!j || typeof j !== "object") return { why: "응답이 JSON 객체가 아닙니다" };
      // ⚠ 이 API 는 **실패도 200 으로** 온다. 상태코드만 보면 안 된다.
      if (j.result !== "success") return { why: `result 가 «${j.result ?? "없음"}» 입니다` };
      if (j.base_code !== "KRW") return { why: `기준통화가 «${j.base_code ?? "없음"}» 입니다 (KRW 여야 합니다)` };
      const v = j.rates ? j.rates.JPY : undefined;
      if (typeof v !== "number") return { why: "응답에 rates.JPY 가 없습니다" };
      return { jpyPerKrw: v, asOf: ymdOfUnix(j.time_last_update_unix) };
    },
  },
  {
    // ECB 참조환율. 71 바이트로 가장 가볍고 기준일(date)을 명시로 준다.
    // ⚠ 호스트가 **.dev 다.** .app 은 위에서 적은 이유로 브라우저에서 막힌다 —
    //   되돌려 .app 으로 바꾸지 마라. 바꾸면 부스에서 조용히 「환율 못 받음」이 된다.
    id: "frankfurter",
    label: "api.frankfurter.dev (ECB 참조환율)",
    url: "https://api.frankfurter.dev/v1/latest?base=KRW&symbols=JPY",
    // 실제 응답(2026-09-04): {"amount":1.0,"base":"KRW","date":"2026-09-03","rates":{"JPY":0.11495}}
    read: j => {
      if (!j || typeof j !== "object") return { why: "응답이 JSON 객체가 아닙니다" };
      if (j.base !== "KRW") return { why: `기준통화가 «${j.base ?? "없음"}» 입니다 (KRW 여야 합니다)` };
      const v = j.rates ? j.rates.JPY : undefined;
      if (typeof v !== "number") return { why: "응답에 rates.JPY 가 없습니다" };
      return { jpyPerKrw: v, asOf: ymdOf(j.date) };
    },
  },
];

// ── 날짜 — **YYYY-MM-DD 한 모양**으로 모은다 ──────────────────────
//  출처마다 모양이 다르다(초 단위 unix · "2026-09-03" 문자열). 화면과 낡음 판정이
//  둘을 구별할 이유가 없으므로 경계에서 하나로 만든다.
//  ⚠ UTC 로 자른다. 로컬 자정 근처에서 기준일이 하루 흔들리면 「어제 값을 오늘 값으로」
//    또는 그 반대로 말하게 된다 — 두 출처가 다 UTC 기준으로 낸다.
const ymdOf = s => (/^\d{4}-\d{2}-\d{2}$/.test(String(s ?? "")) ? String(s) : "");
const ymdOfUnix = sec => {
  if (!Number.isFinite(sec) || sec <= 0) return "";
  const d = new Date(sec * 1000);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};
/** ms 시각 → YYYY-MM-DD (수동 입력의 「기준일」은 **입력한 날**이다 — 그것이 참이다). */
export const ymdOfMs = ms => (Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : "");

// ══════════════════════════════════════════════════════════════════
//  ② 값 검사 — **화면에 닿기 전에** 두 번 다 여기를 지난다
// ══════════════════════════════════════════════════════════════════
//  ★ 화면에 뜨는 수와 계산에 쓰는 수를 **같게** 만든다: 소수 둘째 자리에서 끊는다.
//    왜 — 부스에서 고객이 화면의 환율로 검산하면 화면의 금액이 나와야 한다.
//    8.6905 로 계산하고 「8.70」이라고 적으면 경계에서 ¥1 이 갈리고, 그 한 엔을
//    설명할 방법이 없다. 잃는 정밀도는 0.01/8.7 = **0.11%** 로 마진 자릿수 아래다.
export const roundFx = v => Math.round(v * 100) / 100;

/** 표시 문자열 — 「8.70」. 화면·관리자 패널·참고견적 줄이 **이 함수 하나**를 쓴다. */
export const fmtFx = v => (Number.isFinite(v) ? v.toFixed(2) : "—");

/**
 * 원/엔 값 하나를 받아 쓸 수 있는지 판정한다.
 * @returns {{ok:true, v:number} | {ok:false, why:string}}  why 는 관리자 화면에 그대로 나간다
 */
export function checkFx(raw) {
  const v = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(v)) return { ok: false, why: `환율이 수가 아닙니다 («${raw}»)` };
  if (v <= 0) return { ok: false, why: `환율이 0 이하입니다 (${v})` };
  const r = roundFx(v);
  if (r < FX_MIN || r > FX_MAX) {
    return { ok: false, why:
      `환율 ${fmtFx(r)} 원/엔 은 상식 범위를 벗어납니다 ` +
      `(1엔 = ${fmtFx(FX_MIN)}~${fmtFx(FX_MAX)}원). 응답을 잘못 읽었거나 API 가 바뀐 것입니다 — ` +
      `이 값은 쓰지 않습니다.` };
  }
  return { ok: true, v: r };
}

// ══════════════════════════════════════════════════════════════════
//  ③ 받아 오기 — 오프라인·404·타임아웃·이상한 응답을 **전부** 이유로 바꾼다
// ══════════════════════════════════════════════════════════════════
/**
 * 순서대로 시도하고 처음 통과한 출처를 쓴다.
 * ★ 예외를 던지지 않는다 — 부르는 쪽은 렌더 중의 효과 안이고, 거기서 던지면
 *   부스 화면이 하얘진다. 실패는 전부 `{ok:false, why, tried}` 다.
 * ⚠ fetchImpl 을 주입 가능하게 받는 이유는 이 파일 머리말에 있다(CI 에 망이 없다).
 * @returns {Promise<{ok:true, rec:object} | {ok:false, why:string, tried:string[]}>}
 */
export async function fetchFxRate({
  fetchImpl,
  timeoutMs = TIMEOUT_MS,
  nowMs = Date.now(),
  sources = FX_SOURCES,
} = {}) {
  // ⚠ 전역 fetch 는 **묶어서** 쓴다. 떼어내 부르면 브라우저에 따라
  //   「Illegal invocation」로 던진다(지금 크롬은 봐 주지만 계약이 아니다).
  //   그 예외는 아래 catch 가 삼켜서 「환율을 못 받았습니다」로만 보이므로,
  //   부스에서 원인을 못 찾는 종류의 고장이 된다.
  const f = fetchImpl ||
    (typeof globalThis.fetch === "function" ? globalThis.fetch.bind(globalThis) : null);
  if (!f) return { ok: false, why: "이 브라우저에 fetch 가 없습니다", tried: [] };
  const tried = [];
  for (const s of sources) {
    // 출처 하나가 어떻게 실패해도 다음 출처로 간다 — 한 줄의 throw 로 전체가 죽지 않게.
    try {
      // ⚠ 타임아웃을 우리가 건다. 걸지 않으면 부스 와이파이가 「연결됐지만 안 나가는」
      //   상태일 때 화면이 무한히 기다린다(가장 흔한 전시장 장애다).
      const ac = new AbortController();
      const timer = setTimeout(() => ac.abort(), timeoutMs);
      let r;
      try { r = await f(s.url, { signal: ac.signal, cache: "no-store" }); }
      finally { clearTimeout(timer); }
      if (!r || !r.ok) { tried.push(`${s.id}: HTTP ${r ? r.status : "응답 없음"}`); continue; }
      const j = await r.json();
      const got = s.read(j);
      if (got.why) { tried.push(`${s.id}: ${got.why}`); continue; }
      // ⚠ **뒤집기 전에** 원문 수를 검사한다. 0 을 그냥 뒤집으면 Infinity 가 되고
      //   메시지가 「환율이 수가 아닙니다 («Infinity»)」가 된다 — 운영자는 API 가 무엇을
      //   줬는지 알 수 없다(실측). 여기서 막으면 「rates.JPY 가 0 입니다」라고 말한다.
      if (!Number.isFinite(got.jpyPerKrw) || got.jpyPerKrw <= 0) {
        tried.push(`${s.id}: rates.JPY 가 «${got.jpyPerKrw}» 입니다 (0 보다 커야 합니다)`);
        continue;
      }
      // KRW→JPY 를 **원/엔으로 뒤집는다**(수식이 쓰는 단위 — FX_MIN 주석).
      const chk = checkFx(1 / got.jpyPerKrw);
      if (!chk.ok) { tried.push(`${s.id}: ${chk.why}`); continue; }
      return { ok: true, rec: {
        v: chk.v,                                   // ★ 쓰는 값 = 화면에 적는 값
        raw: got.jpyPerKrw,                         // 받은 원문 수 (관리자 몫 · 검산용)
        asOf: got.asOf || ymdOfMs(nowMs),           // 기준일. 못 읽었으면 받은 날로 둔다
        at: nowMs,                                  // 받은 시각
        src: s.id, srcLabel: s.label,
      } };
    } catch (e) {
      // 오프라인(TypeError: Failed to fetch) · 타임아웃(AbortError) · JSON 깨짐이 다 여기로 온다.
      const nm = e && e.name === "AbortError" ? `${timeoutMs}ms 안에 응답이 없습니다` : String(e && e.message || e);
      tried.push(`${s.id}: ${nm}`);
    }
  }
  return { ok: false, tried, why: `환율을 못 받았습니다 — ${tried.join(" · ")}` };
}

// ══════════════════════════════════════════════════════════════════
//  ④ 저장 — 마지막으로 받은 값과 수동 값을 **이 브라우저에** 적어둔다
// ══════════════════════════════════════════════════════════════════
//  ★ localStorage 다(sessionStorage 가 아니다). price-formula ⑥ 절이 수식에 대해
//    내린 판단과 **같은 이유**다: 노트북이 한 번 재시작되면 환율이 사라지고, 망이
//    없는 부스에서 그것은 화면이 「—」가 된다는 뜻이다. 환율은 우리 설정이지
//    고객 데이터가 아니다.
//  ⚠ 링크(URL 해시)에는 **안 싣는다.** 받는 쪽 브라우저가 자기 값을 받으면 되고,
//    남의 낡은 환율을 물려받는 것이 오히려 사고다. (§13·§16 과 같은 방향이다.)
const FX_KEY = "cria-quote.fx.v1";

/** 저장 기록 하나를 되읽으며 **다시 검사한다.** 옛 코드·손댄 저장소가 심은 값이
 *  화면에 닿는 유일한 경로가 여기라서, 여기서 한 번 더 거른다. */
function recOf(r, kind) {
  if (!r || typeof r !== "object") return null;
  const chk = checkFx(r.v);
  if (!chk.ok) return null;                       // 밴드 밖이면 **버린다** — 낡은 값보다 나쁘다
  const at = Number(r.at);
  return {
    v: chk.v,
    raw: Number.isFinite(Number(r.raw)) ? Number(r.raw) : null,
    asOf: ymdOf(r.asOf),
    at: Number.isFinite(at) && at > 0 ? at : 0,
    src: kind === "manual" ? "manual" : String(r.src ?? ""),
    srcLabel: kind === "manual" ? "" : String(r.srcLabel ?? ""),
  };
}

/** 적어둔다. 실패는 무해하다 — 이번 세션에만 살고 만다(사생활 보호 모드 등). */
export function saveFx(store) {
  try {
    localStorage.setItem(FX_KEY, JSON.stringify({
      net: store?.net ?? null, manual: store?.manual ?? null,
    }));
  } catch { /* 무해 */ }
}

/** 되읽는다. 없거나 못 읽으면 **둘 다 없음**(= price-formula 가 「—」를 놓는다).
 *  ⚠ 여기서 예외가 새면 부스 화면이 마운트에서 죽는다. 전부 접는다. */
export function loadFx() {
  try {
    const r = JSON.parse(localStorage.getItem(FX_KEY) || "null");
    if (!r || typeof r !== "object") return { net: null, manual: null };
    return { net: recOf(r.net, "net"), manual: recOf(r.manual, "manual") };
  } catch { return { net: null, manual: null }; }
}

/** 운영자가 손으로 친 값 → 저장 기록. 「1엔 = ? 원」을 그대로 받는다.
 *  왜 수동이 필요한가 — 부스에 망이 없을 수 있고, 회사가 쓰는 **사내 환율**이 따로
 *  있을 수 있다(본사가 정한 월 환율로 견적을 내는 관행이 실제로 있다). */
export function manualFxOf(text, nowMs = Date.now()) {
  const s = String(text ?? "").trim();
  if (!s) return { ok: false, why: "환율을 입력하세요 (1엔이 몇 원인가 · 예 8.70)" };
  // 전각 숫자·전각 소수점은 받아 준다 — 일본 노트북 IME 가 실제로 내는 글자다
  // (price-formula ⑭ 와 같은 이유: 11.5px 에서 ７ 과 7 은 구별되지 않는다).
  // ⚠ 쉼표는 **안 지운다.** 이 밴드(6.67~12.5)에 천단위 쉼표가 들어올 일이 없고,
  //   유럽식 소수 쉼표 「8,70」을 지우면 870 이 되어 「상식 범위를 벗어납니다」라는
  //   엉뚱한 메시지가 뜬다. 그냥 못 읽는 글자로 두면 「숫자로 읽을 수 없습니다 — «8,70»」
  //   이라고 정확히 말한다.
  let n = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp >= 0xFF10 && cp <= 0xFF19) n += String.fromCharCode(cp - 0xFEE0);   // 전각 0~9
    else if (ch === "．") n += ".";
    else n += ch;
  }
  if (!/^\d*\.?\d+$/.test(n)) return { ok: false, why: `숫자로 읽을 수 없습니다 — «${s}»` };
  const chk = checkFx(Number(n));
  if (!chk.ok) return chk;
  return { ok: true, rec: { v: chk.v, raw: null, asOf: ymdOfMs(nowMs), at: nowMs,
                            src: "manual", srcLabel: "" } };
}

// ══════════════════════════════════════════════════════════════════
//  ⑤ 지금 쓸 값 하나 — 화면과 관리자 패널이 **같은 객체**를 본다
// ══════════════════════════════════════════════════════════════════
/**
 * @param {{net:?object, manual:?object}} store  loadFx / 화면 상태
 * @param {number} nowMs  낡음을 재는 기준. **인자로 받는다** — 렌더마다 Date.now() 를
 *   부르면 같은 화면이 스스로와 갈리고, 테스트가 낡음을 재현할 수 없다.
 * @returns {{v:?number, text:string, from:?string, asOf:string, at:?number,
 *            srcLabel:string, ageDays:?number, stale:boolean, net:?object, manual:?object}}
 */
export function fxViewOf(store, nowMs = Date.now()) {
  const net = store?.net ?? null;
  const manual = store?.manual ?? null;
  // ★ 수동이 있으면 **수동이 이긴다.** 운영자가 명시로 조작한 값이고, 망에서 받은
  //   수가 그것을 조용히 뒤집으면 「사내 환율로 맞춰 뒀는데 왜 다르지」가 된다.
  //   (관리자 패널은 그래도 net 을 나란히 보여준다 — 대조는 사람이 한다.)
  const use = manual || net;
  const asOf = use ? use.asOf : "";
  const ageDays = asOf ? dayDiff(asOf, nowMs) : null;
  return {
    v: use ? use.v : null,
    text: use ? fmtFx(use.v) : "—",
    from: use ? (manual ? "manual" : "net") : null,
    asOf,
    at: use ? (use.at || null) : null,
    srcLabel: use ? (manual ? "" : use.srcLabel || use.src) : "",
    ageDays,
    stale: ageDays != null && ageDays > FX_STALE_DAYS,
    net, manual,
  };
}

/** 기준일(YYYY-MM-DD)로부터 며칠 지났나. UTC 자정 기준으로만 센다 —
 *  시각까지 섞으면 「0.9 일」이 0 일이 되는 경계가 생긴다. */
function dayDiff(ymd, nowMs) {
  const t = Date.parse(`${ymd}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  const today = Math.floor(nowMs / 86400000) * 86400000;
  return Math.round((today - t) / 86400000);
}

/** 진입 시 망을 타야 하나. **캐시가 신선하면 안 탄다** — 태블릿에서 새로고침이
 *  즉시 끝나고, 「하루에 몇 번」이면 충분하다는 요건도 이 한 줄이 지킨다.
 *  ⚠ 수동 값이 켜져 있으면 그래도 받아 둔다(대조용). 쓰는 값은 안 바뀐다. */
export const needFxFetch = (store, nowMs = Date.now()) => {
  const at = store?.net?.at;
  return !Number.isFinite(at) || at <= 0 || nowMs - at > FX_FRESH_MS;
};

// ══════════════════════════════════════════════════════════════════
//  ⑥ 관리자 패널의 말 — **한국어 한 벌** (운영자는 한국인이다)
// ══════════════════════════════════════════════════════════════════
//  price-formula 의 ADMIN_T 와 **같은 규율**이다: 고객이 읽는 사전(showroom-core 의
//  KO/JA)에 안 섞는다. 그 사전은 고객이 읽는 화면의 말이고 이 문구들은 고객이
//  원리적으로 볼 수 없다. 여기 두는 이유는 「환율을 아는 파일이 환율을 말한다」 —
//  ADMIN_T 에 두면 저 파일이 이 파일의 거동을 설명하게 된다.
export const FX_ADMIN_T = {
  // ⚠ 제목이 짧아야 한다 — 라벨 칸이 62px 고정이라 「환율 (1엔 = ? 원)」은 두 줄로
  //   접히고 그 줄만 상자에서 튀어나왔다(실측). 단위는 값 옆에 붙인다.
  title: "환율", unit: "원/엔",
  now: "지금 값", src: "출처", got: "받은 시각", asOf: "기준일",
  none: "—",
  fetching: "받는 중…",
  refresh: "지금 갱신",
  manualLab: "수동",
  apply: "적용", clear: "해제",
  manualPh: "예: 8.70",
  manualOn: v => `수동 값 ${fmtFx(v)} 원/엔 을 쓰고 있습니다 — 망에서 받은 값보다 이것이 이깁니다.`,
  netAlso: r => `망에서 받은 값은 ${fmtFx(r.v)} (${r.asOf || "기준일 모름"} · ${r.srcLabel || r.src}) 입니다.`,
  stale: (d, ymd) => `⚠ ${d}일 지난 값입니다 (기준일 ${ymd}). 망이 되면 「지금 갱신」을 누르세요.`,
  // ★ 「환율을 안 씁니다」가 **가장 값싼 사고**다: 수식이 `*1.7/10` 이면 받아 온 환율이
  //   화면에 아무 영향이 없는데, 관리자 패널에는 환율이 8.70 이라고 떠 있어서
  //   운영자는 반영됐다고 믿는다. 그 착각을 여기서 깨야 한다.
  // ⚠ 「받아 온」이라고 쓰지 마라 — 수동 값일 때 틀린 말이 된다(실측: 수동 9.55 에
  //   대고 「받아 온 9.55」라고 적혔다). 위 칸의 값이라고만 가리킨다.
  notUsed: v => `⚠ 지금 수식은 환율을 쓰지 않습니다 — 위 환율 ${fmtFx(v)} 가 금액에 ` +
                `반영되지 않습니다. 나눗수를 «환율» 로 바꾸세요 (예: *1.7/10 → *1.7/환율).`,
  used: "이 수식은 환율을 씁니다 — 위 값이 그대로 분모입니다.",
  // 못 받았을 때. **원가로 돌아가지 않는다**는 사실을 같이 적는다.
  failed: why => `${why}\n마지막으로 받은 값이나 수동 값을 씁니다. 둘 다 없으면 고객 화면 ` +
                 `금액은 「—」입니다 — 원가로 되돌아가지 않습니다.`,
  hint: "환율은 이 브라우저에만 저장되고 링크에는 안 실립니다. 갱신은 화면 진입 시 1회와 " +
        "이 버튼뿐입니다 — 상담 중에 값이 조용히 바뀌지 않게 하려는 것입니다.",
};

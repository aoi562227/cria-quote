// ══════════════════════════════════════════════════════════════════
//  App.jsx — 상태 한 벌과 2단 레이아웃만. 계산도 그림도 여기 없다.
//
//  하는 일 딱 셋: useState(s) 보관 / toQuoteInput → buildQuote 를 **한 번** 호출 /
//  그 결과를 좌패널 7섹션과 우패널 견적서에 나눠 준다.
//  표시 로직을 여기 다시 적지 마라 — 각 패널·viz 파일이 소유한다.
//
//  ── 화면이 둘이다 (26-08-16 · 사양 연동 26-08-18) ─────────────────
//  기본 = 실무용 견적 앱(QuoteApp, 아래). URL 해시가 `#showroom` 이면 전시회용
//  쇼룸 화면(src/showroom/)이 대신 뜬다.
//
//  ★ 두 화면은 **URL 해시로 사양 한 벌을 주고받는다.**
//    종전 주석의 「두 화면은 상태를 공유하지 않는다」는 **폐기됐다** — 그 설계가
//    낸 증상이 「같은 박스인데 견적서 204원 · 쇼룸 223원」이었다(쇼룸이 자기
//    표준사양으로 계산해서 지종이 안 따라갔다). 무엇이 실리고 왜 해시인지는
//    `ui/state.mjs` 「사양 링크」 절이 소유한다 — 여기 다시 적지 마라.
//    해시에 사양이 없으면 두 화면 다 **종전 기본값 그대로** 뜬다:
//    `#showroom` 단독 진입은 지금까지처럼 쇼룸 표준사양으로 동작한다.
//
//  ⚠ 종전 주석의 **다른 절반은 여전히 유효하다** — 라우팅을 QuoteApp 안에서
//    조건부 return 으로 하지 마라. 훅 순서가 렌더마다 달라진다(조건부 훅).
//    그래서 App 은 **분기만** 하고 화면은 각자 컴포넌트다.
// ══════════════════════════════════════════════════════════════════
import { useState, useMemo, useEffect } from "react";

import { getPaperPriceInfo } from "./domain/paper-repo.mjs";
import { buildQuote } from "./domain/quote.mjs";
import { INITIAL_STATE, toQuoteInput, nextThomId,
         decodeSpec, specHash, payloadOfHash,
         saveNames, loadNames, upGateOf } from "./ui/state.mjs";
import { Toggle } from "./ui/primitives.jsx";
import QuoteSheet from "./ui/QuoteSheet.jsx";
import BasicInfo from "./ui/panels/BasicInfo.jsx";
import BoxSpec from "./ui/panels/BoxSpec.jsx";
import PaperPanel from "./ui/panels/PaperPanel.jsx";
import PrintPanel from "./ui/panels/PrintPanel.jsx";
import CoatingPanel from "./ui/panels/CoatingPanel.jsx";
import ProcessPanel from "./ui/panels/ProcessPanel.jsx";
import DevCostPanel from "./ui/panels/DevCostPanel.jsx";
import ShowroomPage from "./showroom/ShowroomPage.jsx";

// ══════════════════════════════════════════════════════════════════
// ROUTER — 해시 하나로 갈린다. 기본은 실무용 견적 앱이다.
// ══════════════════════════════════════════════════════════════════
const isShowroom = h => /^#\/?showroom\b/.test(h || "");

export default function App() {
  const [hash, setHash] = useState(() =>
    (typeof window === "undefined" ? "" : window.location.hash));
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);

  // 해시에 실린 사양 한 벌. 없으면 null = 「사양 없음」이고 두 화면 다 자기 기본값이다.
  const payload = payloadOfHash(hash);
  const carried = useMemo(() => decodeSpec(payload), [payload]);

  // ⚠ key 가 페이로드다 — **두 화면 다** 걸어야 한다. 「URL 이 사양이다」를 강제한다.
  //   화면 종류가 바뀔 때는 어차피 새로 마운트되지만, 같은 화면에 **머문 채로 사양만
  //   바뀌는** 경우(주소창 직접 편집 · 뒤로가기 · `#showroom?q=…` → `#showroom`)에는
  //   useState 초기화 함수가 다시 돌지 않아 낡은 상태가 남는다.
  //   ★ 브라우저 실측으로 밟았다: 사양을 실어 들어간 쇼룸에서 `#showroom` 으로만
  //     바꾸니 입력칸은 실려 온 값(140×43×130 · 4×62) 그대로인데 단가만 표준사양
  //     223원으로 갈렸다 — 화면과 주소가 서로 다른 사양을 말하는 상태다. 지우지 마라.
  return isShowroom(hash)
    ? <ShowroomPage key={payload} carried={carried}/>
    : <QuoteApp    key={payload} carried={carried}/>;
}

// ══════════════════════════════════════════════════════════════════
// MAIN — 실무용 견적 앱
//   ★ 입력 7섹션과 견적서(QuoteSheet)는 **손대지 않았다.** 여기 얹힌 것은 넷이고
//     전부 「조용히 틀리는 것을 소리 나게 하는」 배선이다:
//     ① 초기 상태를 해시에서 받는다 + 「고객 화면으로」 버튼 (사양 연동)
//     ② 주소창을 지금 상태로 계속 덮어쓴다 (새로고침에 입력을 안 잃는다 · ④)
//     ③ 거래처·품명은 세션이 나르고, 못 되살리면 비우고 말한다 (⑥)
//     ④ 청구 up ≠ 그린 up 이면 그 배치를 그리지 않고 경고한다 (③)
// ══════════════════════════════════════════════════════════════════
function QuoteApp({ carried }) {
  // 해시에 사양이 실려 있으면 그걸로 시작한다(쇼룸에서 돌아온 길 · 북마크 · 새로고침).
  //
  // ★ 거래처·품명은 **해시에 없다**(방침: 고객 앞 주소창·링크 유출 — state.mjs 참조).
  //   그래서 실려 온 사양으로 시작할 때 그 두 칸을 어디서 얻느냐가 문제가 된다.
  //   종전에는 carried 가 INITIAL_STATE 를 깔고 오므로 **초기값이 조용히 들어왔다** —
  //   그리고 그 초기값은 빈칸이 아니라 「코리팩 / 십자B 패키지」, 즉 **그럴듯한 다른
  //   고객사 이름**이다. 실측: 「테스트상사/검증박스A」로 견적을 잡아 왕복하면 금액은
  //   그대로인데 거래처가 「코리팩」으로 바뀌어 있었다. 그대로 인쇄하면 남의 고객사
  //   이름이 박힌 견적서가 나간다(적대검증 minor ⑥).
  //   ⟹ 같은 탭의 세션에 적어둔 값으로 되살리고(loadNames), 없으면 **비운다.**
  //     초기값으로 접지 않는다. 비었다는 사실은 아래 안내 줄이 말한다.
  const [s, setS] = useState(() => {
    if (!carried) return INITIAL_STATE;
    const names = loadNames();
    return { ...carried, customer: names?.customer ?? "", product: names?.product ?? "" };
  });
  const u = (k,v) => setS(p=>({...p,[k]:v}));

  // 거래처·품명을 이 탭에 적어둔다 — URL 에는 0바이트, 새로고침·왕복에는 남는다.
  useEffect(()=>{ saveNames(s); }, [s.customer, s.product]);

  // ── ★ 주소창이 곧 지금 화면이다 (적대검증 major ④) ──────────────────
  //  종전에는 해시가 「고객 화면으로 →」를 누를 때만 갱신되어, 그 사이 입력이
  //  주소창에 없었다. 실측 두 건 다 경고 없이 사양이 바뀌었다:
  //    (a) 해시 없이 입력(217원) → F5 → 145원 (INITIAL_STATE 로 전부 초기화)
  //    (b) 해시 진입(204원) → 수량·지종 수정(131원) → F5 → **204원** (옛 해시로 복귀)
  //  (b) 는 숫자가 그럴듯해서 되돌아간 줄도 모른다 — 부스에서 실수 한 번에 사양이
  //  바뀌면 안 된다. 그래서 상태가 바뀔 때마다 해시를 지금 값으로 **덮어쓴다**.
  //  ⚠ replaceState 다(`location.hash=` 도 pushState 도 아니다):
  //     · location.hash 대입은 hashchange 를 쏘고, App 이 payload 를 key 로 쓰므로
  //       화면이 재마운트된다 — 글자 한 자 칠 때마다 입력 포커스가 날아간다.
  //     · pushState 는 히스토리를 키스트로크 수만큼 늘려 뒤로가기를 못 쓰게 만든다.
  //    replaceState 는 hashchange 를 쏘지 않으므로 App 의 hash 상태는 그대로다(의도).
  //  ⚠ 300ms 로 묶는다 — Safari 에 replaceState 빈도 상한이 있고, 여기는 숫자 칸
  //    키스트로크마다 상태가 바뀐다.
  //  ⚠ **주소를 아직 우리가 쥐고 있을 때만** 쓴다. 「고객 화면으로 →」를 누르면 주소가
  //    쇼룸으로 바뀌고 이 화면은 언마운트되는데, 그 사이(≤300ms)에 묶어둔 타이머가
  //    깨어나면 쇼룸 주소를 견적서 주소로 덮어쓴다. 언마운트 정리(clearTimeout)가
  //    보통 먼저지만 순서에 기대지 않는다 — 주소가 다른 화면 것이면 손대지 않는다.
  const syncHash = useMemo(()=>specHash("", s), [s]);
  useEffect(()=>{
    if (typeof window === "undefined") return;
    const id = setTimeout(()=>{
      const cur = window.location.hash;
      if (cur !== syncHash && !/^#\/?showroom\b/.test(cur))
        window.history.replaceState(null, "", syncHash);
    }, 300);
    return ()=>clearTimeout(id);
  }, [syncHash]);

  // G형 선택 시 톰슨 자동 전환 & 복귀
  const handleBoxType = v => setS(p=>({ ...p, boxType:v, thomId: nextThomId(v, p.thomId) }));

  const input = useMemo(()=>toQuoteInput(s), [s]);
  const qty   = input.qty;
  const { H } = input.box;      // 전개도 그림이 몸판 높이만 따로 필요하다

  // 도메인 호출은 이 한 번뿐이다. 종전에는 netSize·lossOpts·sheetInfo·result 를
  // 4개 useMemo 로 나눠 계산하고 판걸이를 4곳에서 따로 다시 구했다.
  const q = useMemo(()=>{
    try { return buildQuote(input); } catch(e){ console.error(e); return null; }
  }, [input]);

  // 3단 조건 — 규격만 있고 판형이 없는 상태, 판형까지 있고 계산이 안 되는 상태가
  // 각각 화면에 존재한다. 하나로 합치면 입력 중 화면이 통째로 사라진다.
  const netSize   = q?.netSize ?? null;
  const dieline   = q?.dieline ?? null;
  const sheetInfo = q?.sheet   ?? null;
  const layout    = q?.layout  ?? null;
  const result    = q?.lines ? q : null;

  // 지대 단가 정보 (실측 확인 / 면적환산 추정 구분) — 단가 직접입력 중에도
  // placeholder 로 자동값을 보여줘야 하므로 별도로 조회한다
  const autoPriceInfo = useMemo(()=>
    sheetInfo ? getPaperPriceInfo(s.paperId, sheetInfo.id, "", input.paper.custom) : null,
    [sheetInfo, s.paperId, input.paper.custom]);

  // ── ★ 청구 up ↔ 그린 up 게이트 (적대검증 major ③) ────────────────────
  //  판정은 ui/state.upGateOf 가 소유한다(왜 갈릴 수 있는지도 거기 적혀 있다).
  //  여기서 하는 일은 **그 판정을 화면에 반영하는 것**뿐이다:
  //    · 배치에서 파생된 주장은 그리지 않는다 — 배치 그림 · 열×행 · 수율 · 판형
  //      캔버스 · 손배치 씨앗. 그래서 BoxSpec 에 layout 을 넘기지 않는다.
  //      (실측: 국2 왕복 후 요약은 「3 up · 1.634R · 240원」인데 같은 화면의 시각화가
  //       「2 up · 1열×2행 · 수율 57%」를 그리고 칸도 2개만 그렸다. 경고 0.)
  //    · 숫자는 남긴다 — 원지·R수·지대단가·판걸이는 전부 sheetInfo(청구 진실)에서
  //      온다. 그걸 같이 숨기면 「청구가 뭔지 아무데도 안 적힌」 견적서가 된다.
  //      단 배치가 낳은 배지(회전·인터로킹)는 청구 up 에 대해 참이라고 말할 수 없어
  //      **끈다** — 새 값을 만드는 게 아니라 못 하는 주장을 접는 것이다.
  //    · 그리고 **글로 말한다**(우패널 위 Notice). 조용한 불일치가 이 고장의 본체였다.
  const gate = useMemo(()=>upGateOf(q), [q]);
  const layoutViz   = gate.mismatch ? null : layout;
  const layoutSheet = gate.mismatch && layout
    ? { ...layout, rotated:false, interlocked:false } : layout;

  // 링크로 받은 사양인데 거래처·품명을 되살릴 수 없었던 경우 (다른 탭에서 링크를
  // 열었다 · 사생활 보호 모드). 조용히 두면 「—」가 왜 비었는지 알 수 없고, 초기값을
  // 넣으면 남의 고객사 이름이 나간다. 그래서 **말한다.** 한 칸이라도 채우면 사라진다.
  const nameNote = !!carried && !String(s.customer||"").trim() && !String(s.product||"").trim();

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'Segoe UI','Noto Sans KR',sans-serif",background:"#0a1628",color:"#d0e0ff",overflow:"hidden"}}>

      {/* ══ LEFT PANEL ═══════════════════════════════════════════════ */}
      <div style={{width:310,flexShrink:0,background:"#0d1e36",borderRight:"2px solid #1a2e4a",padding:"14px",overflowY:"auto"}}>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:8,fontWeight:800,color:"#e64433",letterSpacing:".2em",textTransform:"uppercase"}}>자사</div>
          <div style={{fontSize:15,fontWeight:900,color:"#e8f0ff",marginTop:2}}>자동 견적 산출 시스템</div>
          <div style={{fontSize:9,color:"#556680",marginTop:1}}>v8.0 · 견적서 78건 역산 · NFP 무겹침 판걸이 · 칼선 실측 전개도</div>
        </div>

        {/* ── 고객 화면으로 ────────────────────────────────────────────
            지금 잡은 사양을 **그대로 들고** 쇼룸으로 넘어간다. 이 버튼이 없어서
            사용자가 주소를 직접 쳐야 했고, 그렇게 들어간 쇼룸은 자기 표준사양으로
            계산해 금액이 갈렸다. 무엇이 실리는지는 ui/state.mjs 「사양 링크」 절.
            ⚠ 자리는 머리글 **바로 아래**다. 좌패널은 스크롤되므로 아래쪽에 두면
              접힌 화면에서 안 보인다 — 부스에서 못 찾는 버튼은 없는 버튼이다. */}
        <button type="button" data-act="showroom"
          onClick={()=>{ window.location.hash = specHash("showroom", s); }}
          style={{width:"100%",marginBottom:14,padding:"8px 10px",borderRadius:6,
                  border:"1px solid #24456f",background:"#12253f",color:"#9fc4ff",
                  font:"600 11.5px 'Segoe UI','Noto Sans KR',sans-serif",cursor:"pointer"}}>
          고객 화면으로 →
        </button>

        <BasicInfo s={s} u={u}/>

        {/* ⚠ layout 이 아니라 **layoutViz** 다 — 청구 up 과 갈린 배치는 그리지 않는다
            (위 게이트 주석). 손배치 씨앗도 여기서 끊긴다: 청구와 다른 배치를 씨앗으로
            받으면 그 위에 앉힌 결과가 또 다른 세 번째 up 이 된다. */}
        <BoxSpec s={s} u={u} handleBoxType={handleBoxType} input={input}
          netSize={netSize} dieline={dieline} sheetInfo={sheetInfo} layout={layoutViz}
          result={result} H={H}/>

        <PaperPanel s={s} u={u} sheetInfo={sheetInfo} autoPriceInfo={autoPriceInfo} result={result}/>

        <PrintPanel s={s} u={u} sheetInfo={sheetInfo} result={result}/>

        <CoatingPanel s={s} u={u}/>

        <ProcessPanel s={s} u={u} qty={qty}/>

        <DevCostPanel s={s} u={u}/>

        <div style={{paddingTop:4}}>
          <Toggle checked={s.showCompare} onChange={v=>u("showCompare",v)} label="수량별 단가 비교표"/>
        </div>
      </div>

      {/* ══ RIGHT PANEL ══════════════════════════════════════════════ */}
      <div style={{flex:1,overflowY:"auto",background:"#e8ecf2",padding:"20px 24px"}}>

        {/* ── 조용하면 안 되는 것들. 견적서 **위**다 ─────────────────────
            자리를 여기 잡은 이유: 이 두 줄은 「출력하기 전에 읽어야 하는 말」이다.
            좌패널은 스크롤되고 견적서 아래는 안 읽힌다. */}
        {gate.mismatch && (
          <Notice tone="bad" mark="up-mismatch">
            청구 판걸이 <b>{gate.billed} up</b> 과 규칙격자 배치 <b>{gate.drawn} up</b> 이 다릅니다 —
            배치 그림·수율·판형 캔버스를 그리지 않습니다(그리면 견적서가 두 개의 up 을 말합니다).
            금액은 <b>{gate.billed} up</b> 으로 청구됩니다.
            {s.mUp
              ? <> 판걸이 직접입력({s.mUpV || "—"})이 켜져 있습니다 — 쇼룸의 자유배치·손배치에서
                  확정한 값이면 그대로 두고, 규칙격자 배치를 보려면 직접입력을 끄세요.</>
              : <> 판걸이·R수 직접입력을 확인하세요.</>}
          </Notice>
        )}
        {nameNote && (
          <Notice tone="warn" mark="names-dropped">
            링크로 받은 사양입니다 — <b>거래처·품명은 링크에 실리지 않습니다</b>
            (고객 앞 주소창과 공유 링크에 다른 고객사 이름이 실리면 안 되기 때문입니다).
            초기값을 대신 넣지 않았으니 직접 입력하세요.
          </Notice>
        )}

        <QuoteSheet s={s} qty={qty} input={input} result={result}
          sheetInfo={sheetInfo} layout={layoutSheet} netSize={netSize} warnings={q?.warnings}/>
      </div>
    </div>
  );
}

/** 견적서 위 안내 한 줄. 우패널은 **밝은 배경**이므로(좌패널의 다크 팔레트와 다르다)
 *  ui/primitives 의 조각을 쓰지 않는다. data-notice 로 실측한다. */
const Notice = ({ tone, mark, children }) => {
  const c = tone === "bad"
    ? { bg:"#fdecea", bd:"#e0a49c", fg:"#8d2b20" }
    : { bg:"#fff6e0", bd:"#ddbf7e", fg:"#7a5410" };
  return (
    <div data-notice={mark} style={{maxWidth:760,margin:"0 auto 12px",background:c.bg,
      border:`1px solid ${c.bd}`,borderRadius:6,padding:"9px 13px",
      font:"12px 'Segoe UI','Noto Sans KR',sans-serif",lineHeight:1.75,color:c.fg}}>
      ⚠ {children}
    </div>
  );
};

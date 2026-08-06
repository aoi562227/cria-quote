// ══════════════════════════════════════════════════════════════════
//  App.jsx — 상태 한 벌과 2단 레이아웃만. 계산도 그림도 여기 없다.
//
//  하는 일 딱 셋: useState(s) 보관 / toQuoteInput → buildQuote 를 **한 번** 호출 /
//  그 결과를 좌패널 7섹션과 우패널 견적서에 나눠 준다.
//  표시 로직을 여기 다시 적지 마라 — 각 패널·viz 파일이 소유한다.
// ══════════════════════════════════════════════════════════════════
import { useState, useMemo } from "react";

import { getPaperPriceInfo } from "./domain/paper-repo.mjs";
import { buildQuote } from "./domain/quote.mjs";
import { INITIAL_STATE, toQuoteInput, nextThomId } from "./ui/state.mjs";
import { Toggle } from "./ui/primitives.jsx";
import QuoteSheet from "./ui/QuoteSheet.jsx";
import BasicInfo from "./ui/panels/BasicInfo.jsx";
import BoxSpec from "./ui/panels/BoxSpec.jsx";
import PaperPanel from "./ui/panels/PaperPanel.jsx";
import PrintPanel from "./ui/panels/PrintPanel.jsx";
import CoatingPanel from "./ui/panels/CoatingPanel.jsx";
import ProcessPanel from "./ui/panels/ProcessPanel.jsx";
import DevCostPanel from "./ui/panels/DevCostPanel.jsx";

// ══════════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════════
export default function App() {
  const [s, setS] = useState(INITIAL_STATE);
  const u = (k,v) => setS(p=>({...p,[k]:v}));

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

  return (
    <div style={{display:"flex",height:"100vh",fontFamily:"'Segoe UI','Noto Sans KR',sans-serif",background:"#0a1628",color:"#d0e0ff",overflow:"hidden"}}>

      {/* ══ LEFT PANEL ═══════════════════════════════════════════════ */}
      <div style={{width:310,flexShrink:0,background:"#0d1e36",borderRight:"2px solid #1a2e4a",padding:"14px",overflowY:"auto"}}>
        <div style={{marginBottom:14}}>
          <div style={{fontSize:8,fontWeight:800,color:"#e64433",letterSpacing:".2em",textTransform:"uppercase"}}>자사</div>
          <div style={{fontSize:15,fontWeight:900,color:"#e8f0ff",marginTop:2}}>자동 견적 산출 시스템</div>
          <div style={{fontSize:9,color:"#556680",marginTop:1}}>v8.0 · 견적서 78건 역산 · NFP 무겹침 판걸이 · 칼선 실측 전개도</div>
        </div>

        <BasicInfo s={s} u={u}/>

        <BoxSpec s={s} u={u} handleBoxType={handleBoxType} input={input}
          netSize={netSize} dieline={dieline} sheetInfo={sheetInfo} layout={layout}
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
        <QuoteSheet s={s} qty={qty} input={input} result={result}
          sheetInfo={sheetInfo} layout={layout} netSize={netSize} warnings={q?.warnings}/>
      </div>
    </div>
  );
}

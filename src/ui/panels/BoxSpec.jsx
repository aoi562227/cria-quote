// ══════════════════════════════════════════════════════════════════
//  BoxSpec.jsx — 규격 입력(W·D·H 또는 전개도 직접) + 구조 선택 + 그 결과 표시.
//
//  전개도 치수·판걸이·수율·R수를 **읽어서만** 보여준다. netSize/layout/sheetInfo 는
//  buildQuote 가 준 값이고, 여기서 다시 재면 화면과 청구가 갈린다.
//  전개도·배치·판형비교 그림은 토글로 감싸 자식 컴포넌트에 넘긴다.
// ══════════════════════════════════════════════════════════════════
import { PRESS_MAX_LONG, PRESS_MAX_SHORT, MAX_FOOT_PCT } from "../../domain/data/sheets.mjs";
import { Section, Field, Row2, Row3, Input, Select, Toggle } from "../primitives.jsx";
import { BOX_TYPES } from "../box-types.mjs";
import { fmtR, fmtMM } from "../format.mjs";
import NetDiagram from "../viz/NetDiagram.jsx";
import LayoutViz from "../viz/LayoutViz.jsx";
import SheetCompare from "../viz/SheetCompare.jsx";

export default function BoxSpec({
  s, u, handleBoxType, input, netSize, dieline, sheetInfo, layout, result, W, D, H,
}) {
  return (
    <Section title="박스 규격 및 구조">
      <Field label="규격 입력 방식">
        <Select value={s.sizeMode} onChange={v=>u("sizeMode",v)} options={[
          {id:"box", label:"박스 치수 (W×D×H) → 전개도 자동"},
          {id:"net", label:"전개도 전체크기 직접입력"},
        ]}/>
      </Field>

      {s.sizeMode === "net" ? (
        <>
          <div style={{background:"#0a0f20",border:"1px solid #2a3a5a",borderRadius:4,padding:"8px 10px",
                       fontSize:9,color:"#7799bb",marginBottom:8,lineHeight:1.8}}>
            슬리브·손잡이형·싸바리처럼 W·D·H 공식이 없는 구조는 전개도 전체크기를 직접 넣으세요.
            <div style={{color:"#556680",marginTop:3}}>예) 슬리브 259×171×145 → 전체크기 <b style={{color:"#88bbdd"}}>646 × 258</b></div>
          </div>
          <Row2>
            <Field label="전체 가로 mm"><Input value={s.nW} onChange={v=>u("nW",v)} placeholder="646" type="number"/></Field>
            <Field label="전체 세로 mm"><Input value={s.nH} onChange={v=>u("nH",v)} placeholder="258" type="number"/></Field>
          </Row2>
        </>
      ) : (
        <Field label="박스 구조 (Type)" note="구조에 따라 뚜껑·바닥 전개 치수 자동 반영">
          <Select value={s.boxType} onChange={v=>handleBoxType(v)} options={BOX_TYPES}/>
        </Field>
      )}

      {/* G형 안내 박스 */}
      {s.sizeMode === "box" && s.boxType === "gtype" && (
        <div style={{background:"#07150a",border:"1px solid #1a4a22",borderRadius:4,padding:"9px 11px",fontSize:10,color:"#44cc77",marginBottom:10,lineHeight:1.8}}>
          <div style={{fontWeight:800,color:"#66ff99",marginBottom:6,fontSize:11}}>
            📦 G형 (톰슨조립)
          </div>
          <div style={{fontSize:9,color:"#336644"}}>
            치수 입력 후 전개도 치수가 자동 계산됩니다.
          </div>
          {netSize?.gtypeWarning && (
            <div style={{marginTop:4,fontSize:9,color:"#ffaa44",background:"#2a1a00",
              border:"1px solid #664400",borderRadius:3,padding:"4px 6px"}}>
              ⚠ {netSize.gtypeWarning}
            </div>
          )}
        </div>
      )}
      {s.sizeMode === "box" && (
        <Row3>
          <Field label="가로 W mm"><Input value={s.bW} onChange={v=>u("bW",v)} placeholder="mm" type="number"/></Field>
          <Field label="깊이 D mm"><Input value={s.bD} onChange={v=>u("bD",v)} placeholder="mm" type="number"/></Field>
          <Field label="높이 H mm"><Input value={s.bH} onChange={v=>u("bH",v)} placeholder="mm" type="number"/></Field>
        </Row3>
      )}

      {/* 전개도 치수 */}
      {netSize && (
        <div style={{background:"#050f1c",border:"1px solid #1a3050",borderRadius:4,padding:"8px 10px",fontSize:10.5,color:"#66aadd",lineHeight:2,marginBottom:8}}>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span>전개도 가로</span>
            <strong style={{color:"#e8f0ff",fontFamily:"monospace"}}>{fmtMM(netSize.netW)} mm</strong>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span>전개도 세로</span>
            <strong style={{color:"#e8f0ff",fontFamily:"monospace"}}>{fmtMM(netSize.netH)} mm</strong>
          </div>
          {netSize.isDirect ? (
            <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1a3050",marginTop:4,paddingTop:4}}>
              <span style={{color:"#88bbdd",fontSize:9}}>전체크기 직접입력</span>
              <span style={{color:"#88bbdd",fontSize:9,fontFamily:"monospace"}}>날개 계산 없음</span>
            </div>
          ) : netSize.isGtype ? (
            <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1a3050",marginTop:4,paddingTop:4}}>
              <span style={{color:"#44cc77",fontSize:9}}>G형 (톰슨조립)</span>
              <span style={{color:"#44cc77",fontSize:9,fontFamily:"monospace"}}>접착날개 14mm</span>
            </div>
          ) : (
            <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1a3050",marginTop:4,paddingTop:4}}>
              <span style={{color:"#8899bb",fontSize:9}}>뚜껑 / 바닥 / 접착날개{netSize.hangTab?" / 행거탭":""}</span>
              <span style={{color:"#8899bb",fontSize:9,fontFamily:"monospace"}}>
                {fmtMM(netSize.topLid)} / {fmtMM(netSize.botFloor)} / {fmtMM(netSize.glueTab)}
                {netSize.hangTab ? ` / ${fmtMM(netSize.hangTab)}` : ""} mm
              </span>
            </div>
          )}
        </div>
      )}

      {/* 판걸이 정보 */}
      {sheetInfo && layout && (
        <div style={{background:"#0a1628",border:"1px solid #1a4a2a",borderRadius:4,padding:"8px 10px",fontSize:11,color:"#44cc88",lineHeight:2}}>
          <div>✦ 판형: <strong>{sheetInfo.label}</strong></div>
          <div>✦ 판걸이: <strong style={{color:"#ffcc44"}}>{sheetInfo.up} up</strong>
            {layout.rotated && <span style={{fontSize:9,color:"#f59e0b",marginLeft:5,fontWeight:700}}>↺ 회전</span>}
            {layout.interlocked && <span style={{fontSize:9,color:"#10b981",marginLeft:5,fontWeight:700}}>⇅ 인터로킹</span>}
          </div>
          <div>✦ 수율: <strong style={{color:layout.footPct>=MAX_FOOT_PCT?"#ff6655":layout.footPct>=65?"#44cc88":"#ffcc44"}}>
              {layout.utilPct}%</strong>
            <span style={{fontSize:9,color:"#336655",marginLeft:5}}>
              발자국 {layout.footPct}% · 물림 {layout.biteShort}/{layout.biteLong}mm · 상한 {MAX_FOOT_PCT}%
            </span>
            {layout.utilCapped && <span style={{fontSize:9,color:"#ffaa44",marginLeft:5,fontWeight:700}}>⚠ 상한 적용</span>}
          </div>
          {layout.pressCapped && (
            <div style={{fontSize:9,color:"#ffaa44"}}>
              ⚠ 인쇄기 제약 — {sheetInfo.w}×{sheetInfo.h} 원지를 <strong>{layout.sheetW}×{layout.sheetH}</strong>로 재단해서 걺
              (인쇄기 최대 {PRESS_MAX_LONG}×{PRESS_MAX_SHORT}mm)
            </div>
          )}
          <div>✦ 지대R: <strong>{fmtR(sheetInfo.R)} R</strong>
            <span style={{fontSize:9,color:"#336655",marginLeft:5}}>1R = {sheetInfo.sheetsPerR?.toLocaleString()}장 (절수 {sheetInfo.cut})</span>
          </div>
          {result && (
            <div>✦ 공정R: <strong style={{color:"#88ccff"}}>{fmtR(result.reams.processR)} R</strong>
              <span style={{fontSize:9,color:"#336655",marginLeft:5}}>정미 {result.reams.net.toLocaleString()}장 ÷ 1,000</span>
            </div>
          )}
        </div>
      )}

      {/* 시각화 */}
      {layout && (
        <div style={{marginTop:8}}>
          <Toggle checked={s.showViz} onChange={v=>u("showViz",v)} label="배치 시각화"/>
          {s.showViz && <LayoutViz layout={layout} dieline={dieline}/>}
        </div>
      )}

      {/* 전개도 미리보기 */}
      {dieline?.polygon && (
        <div style={{marginTop:6}}>
          <Toggle checked={s.showNet} onChange={v=>u("showNet",v)} label="전개도 미리보기"/>
          {s.showNet && <NetDiagram dieline={dieline} W={W} D={D} H={H}/>}
        </div>
      )}

      {/* 판형별 비교 */}
      {netSize && (
        <div style={{marginTop:8}}>
          <Toggle checked={s.showSheetCompare} onChange={v=>u("showSheetCompare",v)} label="판형별 비교"/>
          {s.showSheetCompare && <SheetCompare input={input}/>}
        </div>
      )}
    </Section>
  );
}

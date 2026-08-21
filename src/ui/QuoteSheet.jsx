// ══════════════════════════════════════════════════════════════════
//  QuoteSheet.jsx — 우패널 견적서 출력 (헤더·거래처·판걸이 배너·라인표·개발비·합계).
//
//  금액을 하나도 계산하지 않는다. result.lines / result.devLines / result.totals 를
//  map 하고 fmt 로 찍을 뿐이다 — 새 공정이 늘면 이 파일은 손대지 않아도 된다.
//  견적이 안 나오는 상태(규격 미입력·배치 불가)의 안내문도 여기서 낸다.
// ══════════════════════════════════════════════════════════════════
import { fmt, fmtR, fmtMM } from "./format.mjs";
import { boxTypeTag } from "./box-types.mjs";
import QuoteRow from "./QuoteRow.jsx";
import QtyCompareTable from "./viz/QtyCompareTable.jsx";

export default function QuoteSheet({ s, qty, input, result, sheetInfo, layout, netSize, warnings }) {
  if (!result) {
    return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#4466aa",fontSize:14,flexDirection:"column",gap:12}}>
        <div style={{fontSize:32,opacity:.4}}>📦</div>
        <div>좌측 패널에 정보를 입력하면 견적서가 자동 생성됩니다.</div>
        <div style={{fontSize:11,color:"#334455",opacity:.6}}>박스 구조와 W·D·H를 입력하면 정확한 전개도 치수가 계산됩니다.</div>
        {warnings?.length > 0 && (
          <div style={{fontSize:11,color:"#886644"}}>⚠ {warnings.join(" / ")}</div>
        )}
      </div>
    );
  }

  return (
    <div style={{maxWidth:760,margin:"0 auto"}}>
      <div style={{background:"white",boxShadow:"0 4px 24px rgba(0,0,0,.15)",marginBottom:20}}>

        {/* 헤더 */}
        <div style={{background:"#0a1628",color:"white",padding:"14px 20px",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div style={{fontSize:20,fontWeight:900,letterSpacing:".08em",color:"#e8f0ff"}}>&gt;&gt;견&nbsp;&nbsp;적&nbsp;&nbsp;서</div>
          <div style={{textAlign:"right",fontSize:10,color:"#8899cc",lineHeight:1.9}}>
            <div style={{color:"#ffcc44",fontWeight:700}}>{s.date}</div>
            <div>자사</div>
            <div>서울시 중구 서애로 5길 14</div>
            <div>TEL: 2268-3774  FAX: 2265-5283</div>
          </div>
        </div>

        {/* 거래처 정보 */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",borderBottom:"2px solid #0a1628"}}>
          {[
            ["거래처",s.customer||"—"],["상  호","자사"],
            ["품  목",s.product||"—"], ["주  소","서울시 중구 서애로 5길 14"],
            ["수  량",`${qty.toLocaleString()} EA`],["연락처","TEL:2268-3774 FAX:2265-5283"],
            ["담당자",""],["담당자",""],
          ].map(([k,v],i)=>(
            <div key={i} style={{display:"flex",borderBottom:"1px solid #ddd",borderRight:i%2===0?"1px solid #ddd":"none"}}>
              <div style={{width:56,background:"#f0f4f8",padding:"5px 8px",fontSize:10,fontWeight:700,color:"#334",borderRight:"1px solid #ddd",flexShrink:0}}>{k}</div>
              <div style={{padding:"5px 8px",fontSize:11,color:"#111"}}>{v}</div>
            </div>
          ))}
        </div>

        {/* 판걸이 배너 */}
        {sheetInfo && layout && (
          <div style={{background:"#f0f8ff",borderBottom:"1px solid #c8ddf0",padding:"7px 16px",fontSize:11,color:"#114466",display:"flex",gap:16,flexWrap:"wrap",alignItems:"center"}}>
            <span>📐 전개도: <strong>{fmtMM(netSize.netW)}×{fmtMM(netSize.netH + (netSize.hangTab||0))}mm</strong>
              {!!netSize.hangTab && <span style={{fontSize:9,color:"#ffaa44",marginLeft:4}}>
                (몸판 {fmtMM(netSize.netH)} + 행거탭 {fmtMM(netSize.hangTab)})</span>}
            </span>
            <span>🗒 원지: <strong>{sheetInfo.label}</strong></span>
            <span>▦ 판걸이: <strong style={{color:"#cc4400"}}>{sheetInfo.up} up</strong>
              {layout.rotated && <span style={{fontSize:9,background:"#f59e0b",color:"#000",padding:"1px 4px",borderRadius:2,marginLeft:4,fontWeight:700}}>↺회전</span>}
              {layout.interlocked && <span style={{fontSize:9,background:"#10b981",color:"#000",padding:"1px 4px",borderRadius:2,marginLeft:4,fontWeight:700}}>⇅인터로킹</span>}
            </span>
            <span>📜 R수: <strong>{fmtR(sheetInfo.R)} R</strong>
              {(sheetInfo.sheetsPerR||1000)===500 && (
                <span style={{fontSize:9,background:"#cc440022",color:"#cc6600",padding:"1px 4px",borderRadius:2,marginLeft:4,fontWeight:700}}>500장/연</span>
              )}
            </span>
            <span>💴 단가: <strong>{result.paperPrice.pricePerR?.toLocaleString()}원/R</strong></span>
            <span style={{fontSize:9,color:"#6688aa"}}>[{boxTypeTag(s.boxType)}]</span>
          </div>
        )}

        {/* 견적 테이블 */}
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr style={{background:"#0a1628",color:"white"}}>
              {["항  목","규  격","수  량","단위","단  가","공급가액","비고"].map(h=>(
                <th key={h} style={{padding:"7px 10px",fontSize:10.5,fontWeight:700,
                  textAlign:h==="항  목"||h==="규  격"?"left":"right",letterSpacing:".05em",whiteSpace:"nowrap"}}>{h}</th>
              ))}
            </tr>
            <tr style={{background:"#e8eef8"}}>
              <td colSpan={2}/><td style={{padding:"4px 10px",textAlign:"right",fontSize:12,fontWeight:700,color:"#0a1628"}}>{qty.toLocaleString()}</td>
              <td style={{padding:"4px 10px",textAlign:"center",fontSize:12,fontWeight:700}}>EA</td>
              <td colSpan={3}/>
            </tr>
          </thead>
          <tbody>
            {result.lines.map((it,i)=><QuoteRow key={it.id||i} item={it}/>)}
            <tr style={{background:"#f0f4f8"}}>
              <td colSpan={5} style={{padding:"7px 10px",borderTop:"2px solid #0a1628",borderBottom:"1px solid #ccc"}}/>
              <td style={{padding:"7px 10px",textAlign:"right",fontWeight:900,fontSize:15,color:"#cc2200",borderTop:"2px solid #0a1628",fontFamily:"'Courier New',monospace"}}>
                {fmt(result.totals.process)}
              </td>
              <td style={{padding:"7px 8px",fontSize:10,color:"#888",borderTop:"2px solid #0a1628"}}>운송비 별도</td>
            </tr>
          </tbody>
        </table>

        {result.flags.irWarning && (
          <div style={{margin:"8px 16px 0",padding:"9px 14px",background:"#fff8f0",border:"1px solid #ffaa44",borderRadius:4,color:"#cc4400",fontSize:13,fontWeight:700}}>
            ⚠ IR코팅 하더라도 뒷 묻음이 생길 수 있습니다
          </div>
        )}

        {result.devLines.length>0 && (
          <table style={{width:"100%",borderCollapse:"collapse",marginTop:6}}>
            <tbody>
              <tr><td colSpan={8} style={{padding:"5px 10px",fontSize:10.5,fontWeight:800,color:"#0a1628",background:"#e8eef8",letterSpacing:".08em"}}>개 발 비</td></tr>
              {result.devLines.map((it,i)=>(
                <tr key={it.id||i} style={{background:"#fff"}}>
                  <td style={{padding:"5px 10px",fontSize:12,fontWeight:700,color:"#111",width:"20%"}}>{it.name}</td>
                  <td colSpan={2}/><td style={{padding:"5px 10px",textAlign:"right",fontSize:12}}>{it.qty}</td><td/>
                  <td style={{padding:"5px 10px",textAlign:"right",fontSize:12,fontFamily:"monospace"}}>{fmt(it.unitPrice)}</td>
                  <td style={{padding:"5px 10px",textAlign:"right",fontWeight:700,fontSize:13,fontFamily:"monospace"}}>{fmt(it.amount)}</td>
                  <td/>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{padding:"10px 16px",borderTop:"2px solid #0a1628",fontSize:10.5,color:"#444",lineHeight:2}}>
          <div>&gt;&gt;위와 같이 견적합니다.</div>
          <div>&gt;&gt;제작 내용의 변동에 따라 상기 금액이 증감될 수 있음.</div>
          <div>&gt;&gt;부가가치세 별도.</div>
        </div>

        {/* 합계 — 공정합계·개발비·개당단가·총공급가액·부가세·합계 */}
        <div style={{margin:"0 16px 20px",background:"#0a1628",borderRadius:6,overflow:"hidden"}}>
          {/* 1행: 공정합계 · 개발비 · 개당단가 */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:"1px solid #1a2e4a"}}>
            {[
              {label:"공정 합계",  val:result.totals.process, note:"운송비·부가세 별도"},
              {label:"개발비",     val:result.totals.dev,     note:"목형 등"},
              {label:"개당 단가",  val:result.totals.perEA,   note:"공정합계÷수량", green:true},
            ].map(({label,val,note,green},i)=>(
              <div key={i} style={{padding:"10px 14px",borderRight:i<2?"1px solid #1a2e4a":"none",background:green?"#071a0e":"#0d1a2e"}}>
                <div style={{fontSize:8,color:green?"#44cc77":"#8899bb",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{label}</div>
                <div style={{fontSize:green?22:15,fontWeight:900,color:green?"#44ff88":"#e8f0ff",fontFamily:"'Courier New',monospace",letterSpacing:green?".02em":"0"}}>
                  {green ? `${val.toLocaleString()}원` : `₩${fmt(val)}`}
                </div>
                <div style={{fontSize:8,color:green?"#337744":"#334466",marginTop:2}}>{note}</div>
              </div>
            ))}
          </div>
          {/* 2행: 총공급가액 · 부가세 · 합계(VAT포함) */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr"}}>
            {[
              {label:"총 공급가액", val:result.totals.grand,                    bg:"#0d1a2e"},
              {label:"부가세 (10%)",val:result.totals.vat,                      bg:"#0d1a2e"},
              {label:"합계 (VAT포함)", val:result.totals.grand+result.totals.vat, bg:"#cc2200", accent:true},
            ].map(({label,val,bg,accent},i)=>(
              <div key={i} style={{padding:"10px 14px",borderRight:i<2?"1px solid #1a2e4a":"none",background:bg}}>
                <div style={{fontSize:8,color:accent?"#ffcccc":"#8899bb",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",marginBottom:3}}>{label}</div>
                <div style={{fontSize:15,fontWeight:900,color:accent?"#fff":"#e8f0ff",fontFamily:"'Courier New',monospace"}}>₩{fmt(val)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {s.showCompare && (
        <div style={{background:"white",boxShadow:"0 4px 24px rgba(0,0,0,.15)"}}>
          <QtyCompareTable input={input}/>
        </div>
      )}
    </div>
  );
}

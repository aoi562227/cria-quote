// ══════════════════════════════════════════════════════════════════
//  QtyCompareTable.jsx — 수량 9구간의 개당단가를 나란히 놓는 표 (고정비 분산).
//
//  수량마다 판형이 다시 뽑히므로 buildQuoteRange 가 견적을 9번 새로 짠다.
//  이 파일은 그 9개 결과를 골라 찍기만 한다 — 개당단가를 여기서 나누지 않는다.
// ══════════════════════════════════════════════════════════════════
import { useMemo } from "react";
import { buildQuoteRange } from "../../domain/quote.mjs";
import { fmt, fmtR } from "../format.mjs";

// ══════════════════════════════════════════════════════════════════
// 수량별 단가 비교
// ══════════════════════════════════════════════════════════════════
const COMPARE_QTYS = [500,1000,2000,3000,5000,8000,10000,15000,20000];

export default function QtyCompareTable({ input }) {
  const rows = useMemo(() =>
    buildQuoteRange(input, COMPARE_QTYS)
      .map((q, i) => q.lines ? {
        qty: COMPARE_QTYS[i], perEA: q.totals.perEA, grand: q.totals.grand,
        up: q.sheet.up, label: q.sheet.label, R: q.reams.R,
      } : null)
      .filter(Boolean), [input]);

  const baseQty = input.qty;
  const baseRow = rows.find(x => x.qty === baseQty);

  return (
    <div style={{padding:"0 0 20px"}}>
      <div style={{padding:"10px 16px",background:"#0a1628",color:"#ffcc44",fontSize:11,fontWeight:800,letterSpacing:".1em",textTransform:"uppercase"}}>
        📊 수량별 개당 단가 비교 (고정비 분산 효과)
      </div>
      <table style={{width:"100%",borderCollapse:"collapse"}}>
        <thead>
          <tr style={{background:"#1a2e4a",color:"#a8c0e8"}}>
            {["수량(EA)","판형/Up","R수","총 공급가","개당 단가","기준 대비"].map((h,i)=>(
              <th key={i} style={{padding:"7px 10px",fontSize:10,fontWeight:700,textAlign:i===0?"left":"right",whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const isBase = r.qty === baseQty;
            const diff   = baseRow ? Math.round((r.perEA - baseRow.perEA) / baseRow.perEA * 100) : 0;
            return (
              <tr key={i} style={{background:isBase?"#fff8e6":"#fff",borderBottom:"1px solid #eee"}}>
                <td style={{padding:"6px 10px",fontSize:12,fontWeight:isBase?800:400,color:isBase?"#cc4400":"#111"}}>
                  {r.qty.toLocaleString()}{isBase&&<span style={{fontSize:9,background:"#ffcc44",color:"#111",padding:"1px 4px",borderRadius:2,marginLeft:4}}>현재</span>}
                </td>
                <td style={{padding:"6px 10px",fontSize:10,textAlign:"right",color:"#4477aa"}}>{r.label.split("(")[0].trim()} / {r.up}up</td>
                <td style={{padding:"6px 10px",fontSize:11,textAlign:"right",color:"#555",fontFamily:"monospace"}}>{fmtR(r.R)}R</td>
                <td style={{padding:"6px 10px",fontSize:11,textAlign:"right",fontFamily:"monospace"}}>₩{fmt(r.grand)}</td>
                <td style={{padding:"6px 10px",fontSize:13,textAlign:"right",fontWeight:800,
                  color:isBase?"#cc4400":r.perEA<(baseRow?.perEA||0)?"#008844":"#333",fontFamily:"monospace"}}>₩{fmt(r.perEA)}</td>
                <td style={{padding:"6px 10px",fontSize:11,textAlign:"right",color:diff<0?"#008844":diff>0?"#cc4400":"#888"}}>
                  {isBase?"—":(diff>0?"+":"")+diff+"%"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{padding:"8px 16px",fontSize:10,color:"#8899bb",background:"#f8faff"}}>
        ※ 소부비·목형비 등 고정비는 수량이 많아질수록 분산되어 개당 단가가 낮아집니다. 운송비·부가세 별도.
      </div>
    </div>
  );
}

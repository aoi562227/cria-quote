// ══════════════════════════════════════════════════════════════════
//  SheetCompare.jsx — 판형 11개를 up·수율·R수·지대비로 나란히 놓는 표.
//
//  행 계산은 domain/quote 의 compareSheets 가 전부 한다. 이 파일은 그 결과에
//  색만 입힌다 (수율 100% 초과 = 배치 불가 ⛔, 최적 판형 ★).
// ══════════════════════════════════════════════════════════════════
import { useMemo } from "react";
import { compareSheets } from "../../domain/quote.mjs";
import { fmtR } from "../format.mjs";

// ══════════════════════════════════════════════════════════════════
// 판형별 지대비 비교 테이블
// ══════════════════════════════════════════════════════════════════
export default function SheetCompare({ input }) {
  const { rows, bestId } = useMemo(() => compareSheets(input), [input]);
  if (!rows.length) return null;

  return (
    <div style={{marginTop:10}}>
      <div style={{fontSize:9,fontWeight:800,color:"#4488aa",letterSpacing:".1em",textTransform:"uppercase",marginBottom:6}}>
        판형별 비교 <span style={{fontWeight:400,color:"#334466"}}>(인터로킹 포함)</span>
      </div>
      <table style={{width:"100%",borderCollapse:"collapse",fontSize:10}}>
        <thead>
          <tr style={{background:"#0d1e36"}}>
            {["판형","Up","수율","R수","연단위","단가/R","지대비"].map((h,i)=>(
              <th key={i} style={{padding:"4px 5px",textAlign:i===0?"left":"right",color:"#8899bb",fontWeight:600,whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const overUtil = r.utilPct > 100;
            const isBest   = r.id === bestId;
            return (
              <tr key={i} style={{background:isBest?"#0a2a10":overUtil?"#2a0a00":"transparent",borderBottom:"1px solid #1a2e4a",opacity:overUtil?0.6:1}}>
                <td style={{padding:"4px 5px",color:isBest?"#44ff88":overUtil?"#ff6655":"#c8d8f0",fontWeight:isBest?700:400}}>
                  {isBest?"★ ":""}{overUtil?"⛔ ":""}{r.label.split("(")[0].trim()}
                </td>
                <td style={{padding:"4px 5px",textAlign:"right",color:"#ffcc44",fontWeight:700}}>{r.up}up</td>
                <td style={{padding:"4px 5px",textAlign:"right",
                  color:r.utilPct>90?"#ff4444":r.utilPct>=70?"#44cc88":r.utilPct>=50?"#ffcc44":"#ff8855",
                  fontWeight:overUtil?700:400}}>
                  {r.utilPct}%{overUtil?" ⚠":""}
                </td>
                <td style={{padding:"4px 5px",textAlign:"right",color:"#a8c0e8",fontFamily:"monospace"}}>{fmtR(r.R)}</td>
                <td style={{padding:"4px 5px",textAlign:"right",fontSize:9,color:r.sheetsPerR===500?"#ffaa44":"#556680"}}>
                  {r.sheetsPerR}장
                </td>
                <td style={{padding:"4px 5px",textAlign:"right",color:"#88aacc",fontFamily:"monospace",fontSize:9}}>
                  {r.price.toLocaleString()}
                </td>
                <td style={{padding:"4px 5px",textAlign:"right",color:"#e8f0ff",fontFamily:"monospace"}}>₩{r.cost.toLocaleString()}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{fontSize:8.5,color:"#334466",marginTop:5,lineHeight:1.7}}>
⛔ 수율 100% 초과 = 배치 불가 ｜ 🟠 500장 = 전지급 ｜ 1R = 500 × 절수
      </div>
    </div>
  );
}

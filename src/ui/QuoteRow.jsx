// ══════════════════════════════════════════════════════════════════
//  QuoteRow.jsx — 견적서 라인 1줄. domain 이 만든 Line 객체 하나를 <tr> 로.
//
//  ⚠ 필드명은 unitPrice/amount 다. 종전 up/amt 로 읽으면 undefined 가 빈 셀로
//    렌더돼 **예외 없이** 금액칸만 조용히 비어버린다.
// ══════════════════════════════════════════════════════════════════
import { fmt, fmtQ } from "./format.mjs";

export default function QuoteRow({ item }) {
  const cell = (v, align="right", color="#111", extra={}) => (
    <td style={{padding:"5px 8px",textAlign:align,borderBottom:"1px solid #eee",fontSize:11.5,color,...extra}}>{v}</td>
  );
  return (
    <tr style={{background:item.fixed?"#f8faff":"#fff"}}>
      {cell(item.name,"left","#111",{fontWeight:600})}
      {cell(item.spec||"","left","#555")}
      {cell(item.qty ? fmtQ(item.qty) : "","right","#333")}
      {cell(item.unit||"","center","#777")}
      {cell(item.unitPrice?fmt(item.unitPrice):"","right","#333")}
      {cell(item.amount?fmt(item.amount):"","right","#111",{fontWeight:700})}
      {cell(item.note||"","center","#cc4400",{fontSize:10,fontWeight:700})}
    </tr>
  );
}

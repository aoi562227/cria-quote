// ══════════════════════════════════════════════════════════════════
//  PrintPanel.jsx — 전·후면 인쇄 도수, 별색 계산 방식, 소부·인쇄 단가.
//
//  도수는 domain 의 sideColors 로 세고, 소부 금액은 견적서에 실린 soboo 라인을
//  되읽는다 — 화면이 자기 식으로 세면 배지 도수와 청구 도수가 갈린다.
// ══════════════════════════════════════════════════════════════════
import {
  PRINT_UNIT_DEFAULT, SPOT_RPR_PLAIN, SPOT_RPR_BEDA, printUnitFor, sideColors,
} from "../../domain/data/print-prices.mjs";
import { Section, Field, Row2, Input, Select, Toggle } from "../primitives.jsx";

export default function PrintPanel({ s, u, sheetInfo, result }) {
  return (
    <Section title="인쇄">
      {["f","b"].map(side => {
        const isF = side === "f";
        const kSp=`${side}pSp`, kBk=`${side}pBk`, kUv=`${side}pUv`, kCol=`${side}pColor`;
        const sp = parseInt(s[kSp])||0, isColor = !!s[kCol];
        // 도수 세는 법은 도메인 것을 쓴다 — 여기 따로 적으면 "원색+별색 병행" 을
        // 고칠 때 화면과 청구가 갈린다 (실제로 갈렸던 이력이 있다)
        const doN = sideColors({ color:isColor, spot:sp, black:!!s[kBk] });
        return (
          <div key={side} style={{background:"#080e1c",border:"1px solid #1a3050",borderRadius:4,padding:"10px",marginBottom:8}}>
            <div style={{fontSize:9,color:isF?"#4aaeff":"#88aacc",fontWeight:700,marginBottom:8,letterSpacing:".08em"}}>
              {isF?"전 면":"후 면"} 인쇄
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:8}}>
              <Toggle checked={isColor} onChange={v=>u(kCol,v)} label="원색 4도 (CMYK)"/>
              <Field label="별색 도수 (0~8)"
                note={isColor ? "원색과 병행 가능 — 원색4도 + 별색2도 = 6도" : "별색 1도 = 인쇄 3회 환산"}>
                <Input value={s[kSp]} onChange={v=>u(kSp,Math.max(0,Math.min(8,parseInt(v)||0)).toString())} type="number" placeholder="0"/>
              </Field>
              <div style={{display:"flex",gap:10}}>
                <Toggle checked={!!s[kBk]} onChange={v=>u(kBk,v)} label="먹 1도"/>
                <Toggle checked={!!s[kUv]} onChange={v=>u(kUv,v)} label="UV 인쇄"/>
              </div>
            </div>
            {(doN>0 || s[kUv]) && (
              <div style={{fontSize:9,color:isF?"#44cc88":"#88aacc",padding:"3px 6px",background:isF?"#0a2a10":"#0a1828",borderRadius:3}}>
                {isF?"전면":"후면"} {[s[kUv]?"UV":"", isColor?"원색4도":"", sp>0?`별색${sp}도`:"", s[kBk]?"먹1도":""].filter(Boolean).join("+")}
                &nbsp;— 소부 {doN}판{s[kUv] && <span style={{color:"#88ccff"}}> (UV별도)</span>}
              </div>
            )}
          </div>
        );
      })}

      {/* ── 별색 인쇄 계산 방식 ────────────────────────────────── */}
      {((parseInt(s.fpSp)||0) > 0 || (parseInt(s.bpSp)||0) > 0) && (
        <div style={{background:"#0a0f1e",border:"1px solid #3a2a1a",borderRadius:4,padding:"10px",marginBottom:8}}>
          <div style={{fontSize:9,color:"#ffaa44",fontWeight:700,marginBottom:8,letterSpacing:".08em"}}>별색 인쇄 계산</div>
          <Field label="계산 방식">
            <Select value={s.spotMode} onChange={v=>u("spotMode",v)} options={[
              {id:"weight", label:"도수환산 (별색 1도 = 3회)"},
              {id:"rpr",    label:"별색 R당 고정단가"},
            ]}/>
          </Field>
          <Toggle checked={s.beda} onChange={v=>u("beda",v)} label="베다 (바탕 전면 인쇄)"/>
          {s.spotMode === "rpr" && (
            <div style={{marginTop:8}}>
              <Field label="별색 R당 단가" note={`기본 ${(s.beda?SPOT_RPR_BEDA:SPOT_RPR_PLAIN).toLocaleString()}원/R`}>
                <Input value={s.spotRprV} onChange={v=>u("spotRprV",v)} type="number"
                       placeholder={String(s.beda?SPOT_RPR_BEDA:SPOT_RPR_PLAIN)}/>
              </Field>
            </div>
          )}
          <div style={{fontSize:8.5,color:"#776655",marginTop:6,lineHeight:1.7}}>
            견적서 대조 근거 — 삼면E <b>별2 → 6×14,000</b> vs 같은 박스 <b>원색4 → 4×14,000</b>.
            베다는 R당 실효금액이 75,000~84,000으로 확실히 높음.
          </div>
        </div>
      )}
      <Row2>
        <Field label="소부 단가 (원/도)" note="26-04 이후 12,000">
          <Input value={s.sobooU} onChange={v=>u("sobooU",v)} type="number"/>
        </Field>
        <Field label="인쇄 단가 (원/도·R)" note={sheetInfo ? `판형 기본 ${printUnitFor(sheetInfo.tier).toLocaleString()}` : "판형별 기본"}>
          <Input value={s.printU} onChange={v=>u("printU",v)} type="number"
                 placeholder={sheetInfo ? String(printUnitFor(sheetInfo.tier)) : String(PRINT_UNIT_DEFAULT)}/>
        </Field>
      </Row2>
      {/* 견적서에 실제로 실린 소부 라인을 그대로 되읽는다 — 단가 fallback 을
          화면에서 한 번 더 적으면 청구액과 갈린다 */}
      {(()=>{
        const sb = result?.lines.find(l=>l.id==="soboo");
        return sb && (
          <div style={{fontSize:10,color:"#ffcc44",padding:"4px 8px",background:"#111d33",borderRadius:3,textAlign:"right"}}>
            소부 {sb.qty}도 × {sb.unitPrice.toLocaleString()}원 = {sb.amount.toLocaleString()}원
            {(s.fpUv||s.bpUv) && <span style={{color:"#88aacc",marginLeft:6,fontSize:9}}>UV인쇄 별도</span>}
          </div>
        );
      })()}
    </Section>
  );
}

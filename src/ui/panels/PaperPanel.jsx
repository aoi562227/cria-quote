// ══════════════════════════════════════════════════════════════════
//  PaperPanel.jsx — 지종·판형 선택 + 지대 단가 표시 + up/R수/여분 수동 입력.
//
//  드롭다운의 "확인 단가 있음/추정" 판정은 domain/paper-repo 의
//  paperSheetConfirmed 를 그대로 쓴다 — 화면이 자체 판정표를 갖는 순간
//  단가표를 갱신해도 회색이 안 풀린다.
//  여분·정미 표시는 result.reams 값을 그대로 찍는다(재계산 금지).
// ══════════════════════════════════════════════════════════════════
import { PAPERS } from "../../domain/data/papers.mjs";
import { BASE_SHEETS, sheetsPerR } from "../../domain/data/sheets.mjs";
import { paperSheetConfirmed } from "../../domain/paper-repo.mjs";
import { Section, Field, Row3, Input, Select, Toggle } from "../primitives.jsx";

export default function PaperPanel({ s, u, sheetInfo, autoPriceInfo, result }) {
  return (
    /* ══ [V6] 지대 섹션 — 판형별 단가 표시 + 직접입력 ══ */
    <Section title="지대 (원지)">
      <Field label="지종 선택" note={s.mPrice ? "단가 직접입력 중 — 모든 조합 선택 가능"
            : s.sheetId==="auto" || s.sheetId==="custom"
              ? "단가는 견적서 최근값 기준 ｜ 회색 = 확인 단가 없음"
              : `${BASE_SHEETS.find(x=>x.id===s.sheetId)?.label ?? ""} 확인 단가가 있는 지종만 선택 가능`}>
        <Select value={s.paperId} onChange={v=>u("paperId",v)}
          options={PAPERS.map(p=>{
            const ok = !!s.mPrice || paperSheetConfirmed(p.id, s.sheetId);
            return { id:p.id, disabled: !ok && p.id!==s.paperId,
                     label:`${ok?"":"· "}[${p.group}] ${p.label}${ok?"":"  (추정)"}` };
          })}/>
      </Field>
      <Field label="판형 선택" note={s.mPrice ? "1R = 500 × 절수 장 ｜ 단가 직접입력 중"
            : `1R = 500 × 절수 장 ｜ ${PAPERS.find(x=>x.id===s.paperId)?.label ?? ""} 확인 단가가 있는 판형만 선택 가능`}>
        <Select value={s.sheetId} onChange={v=>u("sheetId",v)}
          options={[{id:"auto",label:"⚡ 자동 최적 (총비용 최소)"},
            ...BASE_SHEETS.map(sh=>{
              const ok = !!s.mPrice || sh.custom || paperSheetConfirmed(s.paperId, sh.id);
              return { id:sh.id, disabled: !ok && sh.id!==s.sheetId,
                       label:`${ok?"":"· "}${sh.label}${ok?"":"  (추정)"}` };
            })]}/>
      </Field>
      {s.sheetId === "custom" && (
        <div style={{background:"#0a0f20",border:"1px solid #3a2a5a",borderRadius:4,padding:"8px 10px",marginBottom:8}}>
          <div style={{fontSize:9,color:"#aa88ff",fontWeight:700,marginBottom:6}}>주문생산 원지</div>
          <Row3>
            <Field label="가로 mm"><Input value={s.cusW} onChange={v=>u("cusW",v)} type="number"/></Field>
            <Field label="세로 mm"><Input value={s.cusH} onChange={v=>u("cusH",v)} type="number"/></Field>
            <Field label="절수"><Select value={s.cusCut} onChange={v=>u("cusCut",v)} options={["1","2","3","4"]}/></Field>
          </Row3>
          <div style={{fontSize:8.5,color:"#665588",marginTop:2}}>
            1R = {sheetsPerR({cut:parseInt(s.cusCut)||2}).toLocaleString()}장 ｜ 주문생산A 890×670 건에서 절수 2로 역산됨
          </div>
        </div>
      )}
      {/* 자동 모드에서 현재 판형 고정 — 옵션 변경 시 판형 바뀌는 문제 방지 */}
      {s.sheetId === "auto" && sheetInfo && (
        <div style={{marginTop:-4,marginBottom:6,fontSize:9,color:"#6688aa",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>현재 자동선택: <strong style={{color:"#ffcc44"}}>{sheetInfo.label?.split("(")[0].trim()}</strong></span>
          <button onClick={()=>u("sheetId", sheetInfo.id)}
            style={{background:"#1a3050",color:"#88ccff",border:"1px solid #2a4a6a",
              borderRadius:3,padding:"2px 8px",fontSize:9,cursor:"pointer",fontWeight:700}}>
            📌 판형 고정
          </button>
        </div>
      )}

      {/* 지대 단가 자동 표시 */}
      {sheetInfo && !s.mPrice && autoPriceInfo && (()=>{
        const pi = autoPriceInfo;
        return (
          <div style={{background:"#050f1c",border:`1px solid ${pi.noData?"#aa2200":pi.confirmed?"#1a3a50":"#4a2a10"}`,borderRadius:4,padding:"7px 10px",fontSize:10,color:"#66aadd",marginBottom:8}}>
            {pi.noData ? (
              <div>
                <div style={{color:"#ff6644",fontWeight:700,fontSize:11}}>⚠ 지대 단가 미등록</div>
                <div style={{color:"#884422",fontSize:9,marginTop:3}}>
                  이 지종×판형 조합의 단가가 없습니다.<br/>
                  아래 "지대 단가 직접 입력"에서 실제 단가를 입력해주세요.
                </div>
              </div>
            ) : (
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span>
                  지대 단가
                  <span style={{fontSize:8,marginLeft:4,padding:"1px 5px",borderRadius:2,
                    background:pi.confirmed?"#0a3020":"#3a2000",
                    color:pi.confirmed?"#44cc88":"#ffaa44"}}>
                    {pi.confirmed?"✓ 확인":"⚠ 추정"}
                  </span>
                </span>
                <strong style={{color:pi.confirmed?"#ffcc44":"#ff9944",fontFamily:"monospace",fontSize:13}}>
                  {pi.price.toLocaleString()} 원/R
                </strong>
              </div>
            )}
            {!pi.noData && (
              <div style={{fontSize:8.5,color:"#335566",marginTop:3}}>
                {pi.confirmed
                  ? `${sheetInfo.label.split("(")[0].trim()} 견적서 실측가 · 1R=${sheetInfo.sheetsPerR?.toLocaleString()}장`
                  : `${(BASE_SHEETS.find(x=>x.id===pi.estimateFrom)?.label||"").split("(")[0].trim()} 장당단가 × 면적비 환산 (미확인)`}
              </div>
            )}
          </div>
        );
      })()}

      {/* [V6] 단가 직접입력 */}
      <div style={{marginTop:4}}>
        <Toggle checked={s.mPrice} onChange={v=>u("mPrice",v)} label="지대 단가 직접 입력"/>
      </div>
      {s.mPrice && (
        <div style={{marginTop:8}}>
          <Field label="단가 (원/R)" note="업체 실제 단가 입력 시 이 값이 우선 적용됩니다">
            <Input value={s.mPriceV} onChange={v=>u("mPriceV",v)} type="number"
              placeholder={`예: ${autoPriceInfo?.price?.toLocaleString()||"518196"}`}/>
          </Field>
        </div>
      )}

      <div style={{marginTop:6}}>
        <Toggle checked={s.hang} onChange={v=>u("hang",v)} label="행거탭 (유로홀 걸이)"/>
        <Toggle checked={s.mUp} onChange={v=>u("mUp",v)} label="판걸이(up) 직접 입력"/>
        <Toggle checked={s.mR} onChange={v=>u("mR",v)} label="R수 직접 입력"/>
      </div>
      {s.hang && (
        <div style={{marginTop:8,background:"#0a1828",border:"1px solid #1a3050",borderRadius:4,padding:"8px 10px"}}>
          <Field label="행거탭 돌출 (mm)"
            note="다이소 등 걸이봉용 유로홀 탭. 위쪽 한 곳만 튀어나와 맞물림 배치에서 옆 열 빈공간에 끼워지므로, 열 간격(피치)에는 안 더하고 전체 외곽에만 1회 더함">
            <Input value={s.hangV} onChange={v=>u("hangV",v)} type="number" placeholder="15"/>
          </Field>
        </div>
      )}
      {s.mUp && (
        <div style={{marginTop:8,background:"#0a1828",border:"1px solid #1a3050",borderRadius:4,padding:"8px 10px"}}>
          <Field label="판걸이(up) 직접 입력"
            note="기본은 자동계산. 기존 목형이 정해져 있어 up을 강제해야 할 때만 사용">
            <Input value={s.mUpV} onChange={v=>u("mUpV",v)} type="number" placeholder="예: 6"/>
          </Field>
          <div style={{display:"flex",gap:4,marginTop:5,flexWrap:"wrap"}}>
            {[1,2,3,4,6,8,12].map(n=>(
              <button key={n} onClick={()=>u("mUpV",String(n))}
                style={{fontSize:9,padding:"2px 7px",borderRadius:3,cursor:"pointer",
                  background: s.mUpV===String(n) ? "#1a4a6a" : "#0a1a2a",
                  color:      s.mUpV===String(n) ? "#66ccff" : "#4488aa",
                  border:"1px solid #1a3050"}}>{n}up</button>
            ))}
          </div>
        </div>
      )}
      {s.mR && (
        <div style={{marginTop:8}}>
          <Field label="R수 직접 입력">
            <Input value={s.mRV} onChange={v=>u("mRV",v)} type="number" placeholder="예: 0.70"/>
          </Field>
        </div>
      )}

      {/* 여분(Loss) 수동 입력 — R수 직접 입력이 아닐 때만 표시 */}
      {!s.mR && (
        <div style={{marginTop:8,background:"#0a1828",border:"1px solid #1a3050",borderRadius:4,padding:"8px 10px"}}>
          <Field label="여분(손지) 수동 입력"
            note="빈값=자동. max(300, 정미×5%) + 양면 100 + 박·형압 50">
            <div style={{display:"flex",gap:4,alignItems:"center"}}>
              <Input value={s.lossSheets} onChange={v=>u("lossSheets",v)} type="number" placeholder="자동"/>
              <div style={{display:"flex",gap:3}}>
                {[
                  {v:"",    l:"자동"},
                  {v:"300", l:"기본 300"},
                  {v:"400", l:"양면 400"},
                  {v:"600", l:"합지 600"},
                ].map(o=>(
                  <button key={o.l} onClick={()=>u("lossSheets",o.v)}
                    style={{padding:"4px 6px",fontSize:8,fontWeight:700,
                      background: s.lossSheets===o.v ? "#1a4a6a" : "#0a1a2a",
                      color: s.lossSheets===o.v ? "#66ccff" : "#4488aa",
                      border:"1px solid "+(s.lossSheets===o.v?"#2a6a8a":"#1a3a5a"),
                      borderRadius:3,cursor:"pointer",whiteSpace:"nowrap"}}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          </Field>
          {/* 자동 판단된 여분 표시 */}
          {(!s.lossSheets || s.lossSheets === "") && result?.reams.loss > 0 && (
            <div style={{fontSize:9,color:"#44ccaa",marginTop:4,fontFamily:"monospace"}}>
              ▸ 자동 판단: 정미 {result.reams.net}장 + 여분 <b>{result.reams.loss}장</b>
              <span style={{color:"#335544",marginLeft:6}}>
                ({result.reams.loss === 25 ? "초소량" :
                  result.reams.loss >= 600 ? "합지" :
                  result.reams.loss >= 350 ? "후가공/대량" : "표준"})
              </span>
            </div>
          )}
          {/* 정미·여분을 여기서 다시 계산하지 않는다 — 실제 R수에 들어간 값을 그대로 보여준다.
              종전에는 화면이 parseFloat(입력값) 을, 계산은 round 한 값을 써서 어긋날 수 있었다 */}
          {s.lossSheets !== "" && parseFloat(s.lossSheets) > 0 && result?.reams.net > 0 && (
            <div style={{fontSize:9,color:"#44cc88",marginTop:4,fontFamily:"monospace"}}>
              ▸ 수동: 정미 {result.reams.net}장 + 여분 {result.reams.loss}장
              = 총 {result.reams.net + result.reams.loss}장
            </div>
          )}
        </div>
      )}
    </Section>
  );
}

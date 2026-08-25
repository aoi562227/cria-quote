// ══════════════════════════════════════════════════════════════════
//  primitives.jsx — 좌패널 공용 입력 위젯과 그 스타일.
//
//  스타일 상수 inp/sel 을 여기 한 곳에 두는 이유: 종전에는 패널마다 인라인
//  style 을 복붙해서, 배경색 하나 바꾸려면 App.jsx 를 훑어야 했다.
//  도메인·포맷을 import 하지 않는다 — 값을 모르는 순수 표시 부품이다.
// ══════════════════════════════════════════════════════════════════

const inp = { background:"#111d33", border:"1px solid #223355", borderRadius:4, color:"#e8f0ff", fontSize:13, padding:"6px 10px", width:"100%", boxSizing:"border-box", outline:"none" };
const sel = { ...inp, cursor:"pointer" };

// min/max/step 은 **브라우저 힌트일 뿐**이다(스피너 한계·모바일 키패드). 도메인이
// 범위를 다시 보는 것이 정본이다 — 붙여넣기·자동완성은 이 속성을 우회한다.
export function Input({ value, onChange, placeholder, type="text", small, min, max, step }) {
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
                min={min} max={max} step={step} style={{...inp,fontSize:small?11:13}}/>;
}
export function Select({ value, onChange, options }) {
  return <select value={value} onChange={e=>onChange(e.target.value)} style={sel}>
    {options.map(o=>(
      <option key={o.id??o} value={o.id??o} disabled={!!o.disabled}
              style={o.disabled?{color:"#5a6a80"}:undefined}>
        {o.label??o}
      </option>
    ))}
  </select>;
}
export function Toggle({ checked, onChange, label }) {
  return (
    <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:"#c8d8f0"}}>
      <div onClick={()=>onChange(!checked)} style={{width:32,height:18,borderRadius:9,background:checked?"#e64433":"#223355",position:"relative",transition:"background .2s",flexShrink:0}}>
        <div style={{position:"absolute",top:2,left:checked?16:2,width:14,height:14,borderRadius:"50%",background:"white",transition:"left .2s"}}/>
      </div>
      {label}
    </label>
  );
}
export function Section({ title, children }) {
  return (
    <div style={{marginBottom:18}}>
      <div style={{fontSize:9,fontWeight:800,color:"#e64433",letterSpacing:".15em",textTransform:"uppercase",borderBottom:"1px solid #1a2e4a",paddingBottom:4,marginBottom:10}}>{title}</div>
      {children}
    </div>
  );
}
export function Field({ label, children, note }) {
  return (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:10,fontWeight:700,color:"#8899bb",letterSpacing:".05em",marginBottom:3,textTransform:"uppercase"}}>{label}</div>
      {children}
      {note && <div style={{fontSize:9,color:"#4488aa",marginTop:2,lineHeight:1.5}}>{note}</div>}
    </div>
  );
}
export function Row2({ children }) { return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{children}</div>; }
export function Row3({ children }) { return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>{children}</div>; }

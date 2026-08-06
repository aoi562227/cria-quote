// ══════════════════════════════════════════════════════════════════
//  LayoutViz.jsx — 인쇄판 위 판걸이 배치 그림 (전개도 오버레이 · 범례).
//
//  좌표·회전·반전 전부 layout 이 실어 준 값만 쓴다. 여기서 배치를
//  다시 풀면 그림이 통과시킨 배치와 실제 걸리는 배치가 갈린다.
//
//  물림 띠는 그리지 않는다 — printableArea 가 물림을 빼지 않기 때문이다
//  (판형 크기가 이미 재단 크기다. 근거는 imposition.printableArea 주석).
// ══════════════════════════════════════════════════════════════════
import { fmtMM } from "../format.mjs";
import DielineShape from "./DielineShape.jsx";

// ══════════════════════════════════════════════════════════════════
// 판걸이 배치 시각화 — 전개도 폴리곤 오버레이 포함
// ══════════════════════════════════════════════════════════════════
export default function LayoutViz({ layout, dieline }) {
  if (!layout || !dieline || layout.up === 0) return null;
  const netSize = dieline.net;

  const PAD_SVG = 32;
  const MAX_W   = 380;
  const MAX_H   = 300;
  // 인쇄기 유효 판(990×720 클램프) 기준으로 그림 — layout 이 이미 클램프된 값을 돌려줌
  const drawW = layout.sheetW, drawH = layout.sheetH;
  const scale = Math.min((MAX_W - PAD_SVG * 2) / drawW, (MAX_H - PAD_SVG * 2) / drawH);
  const svgW  = drawW * scale + PAD_SVG * 2;
  const svgH  = drawH * scale + PAD_SVG * 2;

  const COLORS = ["#3b82f6","#10b981","#f59e0b","#8b5cf6","#06b6d4","#ec4899"];
  const utilPct = layout.utilPct;
  const candSummary = layout.candidates?.map(c =>
    `${c.rotated ? "회전" : "노말"}${c.interlocked ? "·인터로킹" : ""} ${c.up}up`
  ).join("  /  ");

  const nW = netSize.netW, nH = netSize.netH;

  return (
    <div style={{background:"#05111f",borderRadius:8,padding:12,marginTop:10,border:"1px solid #1a3050"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
        <div style={{fontSize:10,fontWeight:800,color:"#4aaeff",letterSpacing:".12em",textTransform:"uppercase"}}>
          ▦ 판걸이 배치 시각화
        </div>
        <div style={{display:"flex",gap:10,fontSize:9.5,alignItems:"center",flexWrap:"wrap"}}>
          <span style={{color:"#44ee88",fontWeight:800}}>{layout.up} up</span>
          <span style={{color:"#aac"}}>{layout.cols}열 × {layout.rows}행</span>
          {layout.rotated && <span style={{background:"#f59e0b22",color:"#f59e0b",padding:"1px 5px",borderRadius:3,fontWeight:700}}>↺ 회전</span>}
          {layout.interlocked && <span style={{background:"#10b98122",color:"#10b981",padding:"1px 5px",borderRadius:3,fontWeight:700}}>⇅ 인터로킹</span>}
          <span style={{
            background:utilPct>=70?"#00441122":utilPct>=50?"#44440022":"#44000022",
            color:      utilPct>=70?"#44ee88":utilPct>=50?"#ffcc44":"#ff6655",
            padding:"1px 5px",borderRadius:3,fontWeight:700}}>수율 {utilPct}%</span>
        </div>
      </div>

      {/* 인터로킹 정보 */}
      {layout.interlocked && layout.overlapInfo && (
        <div style={{fontSize:9,color:"#10b981",marginBottom:6,padding:"3px 8px",background:"#10b98110",borderRadius:3}}>
          ⇅ 인터로킹 배치: {layout.overlapInfo} — NFP 무겹침 검증 통과
        </div>
      )}

      {/* 배치 후보 비교 */}
      {candSummary && (
        <div style={{fontSize:8.5,color:"#4466aa",marginBottom:6}}>비교: {candSummary}</div>
      )}

      <svg width={svgW} height={svgH} style={{display:"block",margin:"0 auto",borderRadius:4}}>
        <defs>
          <pattern id="lossHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#33223355" strokeWidth="3"/>
          </pattern>
        </defs>

        {/* 재단된 판 배경 (= 인쇄기에 걸리는 크기. 전지급은 990×720 으로 클램프됨) */}
        <rect x={PAD_SVG} y={PAD_SVG} width={drawW*scale} height={drawH*scale}
          fill="#0d2035" stroke="#2a4060" strokeWidth={1.5} rx={2}/>
        <rect x={PAD_SVG} y={PAD_SVG} width={drawW*scale} height={drawH*scale}
          fill="url(#lossHatch)" rx={2}/>

        {/* 배치된 전개도 */}
        {layout.boxes.map((box, i) => {
          const color = COLORS[i % COLORS.length];
          const bx = PAD_SVG + box.x * scale;
          const by = PAD_SVG + box.y * scale;
          const bw = box.w * scale;
          const bh = box.h * scale;
          // 회전 배치는 좌표를 다시 계산하지 않고 rotate(90) 으로 처리한다.
          // 반전은 mm 공간에서 rotate(180, netW/2, netH/2) — 전개도 bbox 중심 대칭이라 정확.
          const tf = box.rotated
            ? `translate(${bx},${by}) scale(${bw/nH},${bh/nW}) translate(${nH},0) rotate(90)`
            : `translate(${bx},${by}) scale(${bw/nW},${bh/nH})`;
          const flipTf = box.flipped ? ` rotate(180,${nW/2},${nH/2})` : "";

          return (
            <g key={i}>
              {/* 전개도 실루엣이 있으면 바운딩 박스는 점선 외곽만 —
                  맞물림 배치에서 사각형을 채우면 서로 겹쳐 보여 실제 앉힘이 안 보인다 */}
              {dieline.polygon ? (
                <rect x={bx} y={by} width={bw-0.5} height={bh-0.5}
                  fill="none" stroke={color} strokeWidth={0.5} strokeDasharray="2 3"
                  opacity={.35} rx={1}/>
              ) : (
                <rect x={bx} y={by} width={bw-0.5} height={bh-0.5}
                  fill={box.flipped ? color+"1a" : color+"28"}
                  stroke={color} strokeWidth={box.flipped?1:1.5} rx={1}/>
              )}
              {dieline.polygon && (
                <g transform={tf + flipTf}><DielineShape dl={dieline} color={color}/></g>
              )}
              {box.flipped && (
                <text x={bx+bw/2} y={by+9} textAnchor="middle" fontSize={7} fill={color} opacity={.8}>
                  ▽ 반전 (뚜껑 맞물림)
                </text>
              )}
              {/* 첫 번째 박스에만 뚜껑/바닥 영역 표시 */}
              {i===0 && netSize.topLid > 0 && (
                <>
                  <rect x={bx} y={by} width={bw-0.5}
                    height={(layout.rotated ? netSize.botFloor : netSize.topLid)*scale}
                    fill={color+"22"} stroke={color} strokeWidth={.5} strokeDasharray="3 2" rx={1}/>
                  <rect x={bx} y={by+bh-(layout.rotated?netSize.topLid:netSize.botFloor)*scale}
                    width={bw-0.5}
                    height={(layout.rotated ? netSize.topLid : netSize.botFloor)*scale}
                    fill={color+"22"} stroke={color} strokeWidth={.5} strokeDasharray="3 2" rx={1}/>
                </>
              )}
              <text x={bx+bw/2} y={by+bh/2}
                textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.min(bw,bh)*0.22} fill={color} fontWeight="700" opacity={.85}>
                {i+1}
              </text>
            </g>
          );
        })}

        {/* 치수 라벨 */}
        <text x={PAD_SVG+drawW*scale/2} y={PAD_SVG-14}
          textAnchor="middle" fontSize={9} fill="#8899bb">{drawW} mm</text>
        <text x={PAD_SVG+drawW*scale+16} y={PAD_SVG+drawH*scale/2}
          textAnchor="middle" fontSize={9} fill="#8899bb"
          transform={`rotate(90,${PAD_SVG+drawW*scale+16},${PAD_SVG+drawH*scale/2})`}>{drawH} mm</text>

        {/* 전개도 치수 (첫번째 박스) */}
        {layout.boxes[0] && (() => {
          const b = layout.boxes[0];
          return (
            <text x={PAD_SVG+b.x*scale+b.w*scale/2} y={PAD_SVG+b.y*scale+b.h*scale/2+b.h*scale*0.18}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={Math.min(7.5, b.w*scale*0.1)} fill="#ffffff" opacity={.5}>
              {layout.rotated ? `${fmtMM(nH)}×${fmtMM(nW)}` : `${fmtMM(nW)}×${fmtMM(nH)}`}mm
            </text>
          );
        })()}
      </svg>

      {/* 범례 */}
      <div style={{display:"flex",gap:12,marginTop:8,flexWrap:"wrap",fontSize:9.5,color:"#8899bb"}}>
        {[
          {bg:"none",bd:"1px dashed #3b82f6aa",txt:"전개도 외곽(바운딩)"},
          {bg:"#3b82f628",bd:"1px solid #3b82f6",txt:"반전 = 맞물림"},
          {bg:"#1e40afcc",bd:"none",txt:"■ 전·후면"},
            {bg:"#0f766ecc",bd:"none",txt:"■ 측면"},
            {bg:"rgba(255,200,60,0.55)",bd:"1px dashed rgba(255,200,60,0.7)",txt:"몸통경계"},
        ].map(({bg,bd,txt})=>(
          <span key={txt} style={{display:"flex",alignItems:"center",gap:4}}>
            <span style={{width:14,height:8,background:bg,border:bd,display:"inline-block"}}/>
            {txt}
          </span>
        ))}
      </div>

      {/* 대안 */}
      <div style={{marginTop:4,fontSize:9,color:"#4466aa",textAlign:"right"}}>
        차선: {layout.alt?.up||0}up ({layout.alt?.rotated?"회전":"노말"}{layout.alt?.interlocked?"·인터로킹":""})
      </div>
    </div>
  );
}

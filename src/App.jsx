import { useState, useMemo } from "react";

import { PAPERS } from "./domain/data/papers.mjs";
import { BASE_SHEETS, PRESS_MAX_LONG, PRESS_MAX_SHORT, MAX_FOOT_PCT } from "./domain/data/sheets.mjs";
import {
  SOBOO_UNIT_DEFAULT, PRINT_UNIT_DEFAULT, SPOT_RPR_PLAIN, SPOT_RPR_BEDA, printUnitFor,
} from "./domain/data/print-prices.mjs";
import { COAT_OPTS, GLUE_OPTS, THOMSON_OPTS } from "./domain/data/process-prices.mjs";
import { paperSheetConfirmed, getPaperPriceInfo } from "./domain/paper-repo.mjs";
import { structures } from "./domain/dieline/index.mjs";
import { xEdges } from "./domain/dieline/geometry.mjs";
import { calcAdmin } from "./domain/process/admin.mjs";
import { buildQuote, buildQuoteRange, compareSheets } from "./domain/quote.mjs";
import { INITIAL_STATE, toQuoteInput, nextThomId } from "./ui/state.mjs";
import { fmt, fmtR, fmtQ, fmtMM } from "./ui/format.mjs";

const BOX_TYPES = structures();

// ══════════════════════════════════════════════════════════════════
// 전개도 렌더러 — domain/dieline 의 폴리곤을 **그대로** 그린다
//
// 화면과 배치(NFP)가 같은 도형을 쓰는 것이 이 구조의 핵심이다.
// 종전에는 그림 전용 날개 근사식이 따로 있어서, 그려진 도형이 배치에 쓰인
// 도형보다 25~30% 작았다. 그 상태로는 "그림상 가능해 보이는데 실제로는
// 겹치는" 배치를 눈으로 잡아낼 방법이 아예 없었다.
//
// mm 좌표계(0..netW, 0..netH) 그대로 그리고, 배치 위치·회전·반전은 호출부가
// SVG transform 으로 건다 — 좌표를 다시 계산하지 않으므로 축 불일치가 원천 차단된다.
// ══════════════════════════════════════════════════════════════════
const PCOL = ['#0f766e', '#1e40af', '#0f766e', '#1e40af', '#92400e'];
const pts = poly => poly.map(([x, y]) => `${x},${y}`).join(" ");

function DielineShape({ dl, color }) {
  return (
    <>
      {dl.pieces.map((p, i) => (
        <polygon key={'f' + i} points={pts(p)}
          fill={PCOL[dl.meta[i]?.panel ?? 0] || PCOL[4]}
          opacity={dl.meta[i]?.part === "body" || dl.meta[i]?.part === "tab" ? 0.7 : 0.4}/>
      ))}
      {/* 접는선 (점선) */}
      <g fill="none" stroke="rgba(255,255,255,0.30)" strokeWidth={0.7}
         strokeDasharray="3,2.2" vectorEffect="non-scaling-stroke">
        {dl.folds.map((f, i) => <polyline key={'d' + i} points={pts(f)}/>)}
      </g>
      {/* 칼선 (실선) */}
      <g fill="none" stroke={color || "rgba(120,220,255,0.85)"} strokeWidth={0.9}
         strokeLinejoin="round" vectorEffect="non-scaling-stroke">
        {dl.cuts.map((c, i) => <polyline key={'c' + i} points={pts(c)}/>)}
      </g>
    </>
  );
}

// ══════════════════════════════════════════════════════════════════
// 전개도 미리보기 (펼친 형태)
// ══════════════════════════════════════════════════════════════════
function NetDiagram({ dieline, W, D, H }) {
  if (!dieline?.polygon) return null;
  const net = dieline.net;
  const SVG_W = 380, SVG_H = 260, PAD = 16;
  const rawW = net.netW, rawH = net.netH;
  if (!(rawW > 0 && rawH > 0)) return null;

  const scale = Math.min((SVG_W - 2 * PAD) / rawW, (SVG_H - 2 * PAD) / rawH);
  const ox = (SVG_W - rawW * scale) / 2;
  const oy = (SVG_H - rawH * scale) / 2;
  const px = v => ox + v * scale;
  const py = v => oy + v * scale;
  const sc = v => v * scale;

  const xs = xEdges(W, D, net.netW);
  const panelLabels = ['측면1', '전면', '측면2', '후면', '접착'];
  const yBody = net.topLid, yBodyEnd = net.topLid + H;
  const topArr = dieline.flaps?.top || [], botArr = dieline.flaps?.bot || [];

  // 치수 숫자는 **가장 깊은 날개** 위에 얹는다 (그 값이 topLid/botFloor 정본이다)
  const dimAt = (arr, val, y) => {
    const i = arr.indexOf(Math.max(...arr));
    if (i < 0 || sc(val) < 12) return null;
    return <text x={px((xs[i] + xs[i + 1]) / 2)} y={py(y)} textAnchor='middle'
      dominantBaseline='central' fontSize={9} fill='#6699bb'>{Math.round(val)}</text>;
  };

  return (
    <div style={{background:'#050e1c',borderRadius:8,padding:'8px 6px',marginTop:8,border:'1px solid #1a3050'}}>
      <div style={{fontSize:9,fontWeight:800,color:'#4aaeff',letterSpacing:'.1em',marginBottom:4}}>
        ▣ 전개도 (펼친 형태) — 칼선 실선 / 접는선 점선
      </div>
      <svg width={SVG_W} height={SVG_H} style={{display:'block'}}>
        <g transform={`translate(${ox},${oy}) scale(${scale})`}>
          <DielineShape dl={dieline} color="rgba(120,220,255,0.9)"/>
        </g>
        {/* 패널 라벨 */}
        {panelLabels.map((lbl, i) => sc(xs[i + 1] - xs[i]) > 18 && (
          <text key={'l' + i} x={px((xs[i] + xs[i + 1]) / 2)} y={py(yBody + H / 2)}
            textAnchor='middle' dominantBaseline='central'
            fontSize={Math.min(10, sc(xs[i + 1] - xs[i]) * 0.18)} fill='#7ab8f5'>{lbl}</text>
        ))}
        {net.topLid > 0 && dimAt(topArr, net.topLid, yBody - net.topLid / 2)}
        {net.botFloor > 0 && dimAt(botArr, net.botFloor, yBodyEnd + net.botFloor / 2)}
        {sc(H) > 20 && <text x={px(rawW) + 4} y={py(yBody + H / 2)}
          textAnchor='start' dominantBaseline='central'
          fontSize={9} fill='#6699bb'>H={Math.round(H)}</text>}
      </svg>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 판걸이 배치 시각화 — 전개도 폴리곤 오버레이 포함
// ══════════════════════════════════════════════════════════════════
function LayoutViz({ layout, dieline }) {
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
  // 가로축(drawW)은 긴변이라 물림 20, 세로축(drawH)은 짧은변이라 물림 30.
  // 종전에는 둘 다 20 으로 그려서 범례와 실제 감산이 어긋났다. 이제 두 값 모두
  // layout 이 실어 준다 — 물림 방침이 바뀌면 그림도 자동으로 따라간다.
  const biteX = layout.biteLong  * scale;
  const biteY = layout.biteShort * scale;

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
          <pattern id="biteHatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="#ff222244" strokeWidth="2.5"/>
          </pattern>
        </defs>

        {/* 원지 배경 */}
        <rect x={PAD_SVG} y={PAD_SVG} width={drawW*scale} height={drawH*scale}
          fill="#0d2035" stroke="#2a4060" strokeWidth={1.5} rx={2}/>
        <rect x={PAD_SVG} y={PAD_SVG} width={drawW*scale} height={drawH*scale}
          fill="url(#lossHatch)" rx={2}/>

        {/* 물림 — 상단 */}
        <rect x={PAD_SVG} y={PAD_SVG} width={drawW*scale} height={biteY} fill="#ff000018"/>
        <rect x={PAD_SVG} y={PAD_SVG} width={drawW*scale} height={biteY} fill="url(#biteHatch)"/>
        <line x1={PAD_SVG} y1={PAD_SVG+biteY} x2={PAD_SVG+drawW*scale} y2={PAD_SVG+biteY}
          stroke="#ff4444" strokeWidth={1} strokeDasharray="4 3" opacity={.8}/>
        <text x={PAD_SVG+drawW*scale/2} y={PAD_SVG+biteY/2}
          textAnchor="middle" dominantBaseline="middle" fontSize={8} fill="#ff6666" fontWeight="700">
          ← 물림 {layout.biteShort}mm (짧은변) →
        </text>

        {/* 물림 — 좌측 */}
        <rect x={PAD_SVG} y={PAD_SVG+biteY} width={biteX} height={drawH*scale-biteY} fill="#ff000012"/>
        <rect x={PAD_SVG} y={PAD_SVG+biteY} width={biteX} height={drawH*scale-biteY} fill="url(#biteHatch)"/>
        <line x1={PAD_SVG+biteX} y1={PAD_SVG} x2={PAD_SVG+biteX} y2={PAD_SVG+drawH*scale}
          stroke="#ff4444" strokeWidth={1} strokeDasharray="4 3" opacity={.8}/>

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
          {bg:"#ff000033",bd:"1px dashed #ff4444",txt:`물림 ${layout.biteShort}mm`},
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

// ══════════════════════════════════════════════════════════════════
// 판형별 지대비 비교 테이블
// ══════════════════════════════════════════════════════════════════
function SheetCompare({ input }) {
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

// ══════════════════════════════════════════════════════════════════
// 수량별 단가 비교
// ══════════════════════════════════════════════════════════════════
const COMPARE_QTYS = [500,1000,2000,3000,5000,8000,10000,15000,20000];

function QtyCompareTable({ input }) {
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

// ══════════════════════════════════════════════════════════════════
// UI PRIMITIVES
// ══════════════════════════════════════════════════════════════════
const inp = { background:"#111d33", border:"1px solid #223355", borderRadius:4, color:"#e8f0ff", fontSize:13, padding:"6px 10px", width:"100%", boxSizing:"border-box", outline:"none" };
const sel = { ...inp, cursor:"pointer" };

function Input({ value, onChange, placeholder, type="text", small }) {
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={{...inp,fontSize:small?11:13}}/>;
}
function Select({ value, onChange, options }) {
  return <select value={value} onChange={e=>onChange(e.target.value)} style={sel}>
    {options.map(o=>(
      <option key={o.id??o} value={o.id??o} disabled={!!o.disabled}
              style={o.disabled?{color:"#5a6a80"}:undefined}>
        {o.label??o}
      </option>
    ))}
  </select>;
}
function Toggle({ checked, onChange, label }) {
  return (
    <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",fontSize:12,color:"#c8d8f0"}}>
      <div onClick={()=>onChange(!checked)} style={{width:32,height:18,borderRadius:9,background:checked?"#e64433":"#223355",position:"relative",transition:"background .2s",flexShrink:0}}>
        <div style={{position:"absolute",top:2,left:checked?16:2,width:14,height:14,borderRadius:"50%",background:"white",transition:"left .2s"}}/>
      </div>
      {label}
    </label>
  );
}
function Section({ title, children }) {
  return (
    <div style={{marginBottom:18}}>
      <div style={{fontSize:9,fontWeight:800,color:"#e64433",letterSpacing:".15em",textTransform:"uppercase",borderBottom:"1px solid #1a2e4a",paddingBottom:4,marginBottom:10}}>{title}</div>
      {children}
    </div>
  );
}
function Field({ label, children, note }) {
  return (
    <div style={{marginBottom:10}}>
      <div style={{fontSize:10,fontWeight:700,color:"#8899bb",letterSpacing:".05em",marginBottom:3,textTransform:"uppercase"}}>{label}</div>
      {children}
      {note && <div style={{fontSize:9,color:"#4488aa",marginTop:2,lineHeight:1.5}}>{note}</div>}
    </div>
  );
}
function Row2({ children }) { return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{children}</div>; }
function Row3({ children }) { return <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6}}>{children}</div>; }

function QuoteRow({ item }) {
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
  const { W, D, H } = input.box;

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

        <Section title="기본 정보">
          <Field label="거래처"><Input value={s.customer} onChange={v=>u("customer",v)}/></Field>
          <Field label="품목명"><Input value={s.product}  onChange={v=>u("product",v)}/></Field>
          <Row2>
            <Field label="수량(EA)"><Input value={s.qty} onChange={v=>u("qty",v)} type="number"/></Field>
            <Field label="날짜"><Input value={s.date} onChange={v=>u("date",v)} small/></Field>
          </Row2>
        </Section>

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

        {/* ══ [V6] 지대 섹션 — 판형별 단가 표시 + 직접입력 ══ */}
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
                1R = {(500*(parseInt(s.cusCut)||2)).toLocaleString()}장 ｜ 주문생산A 890×670 건에서 절수 2로 역산됨
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
              {s.lossSheets !== "" && parseFloat(s.lossSheets) > 0 && sheetInfo?.up > 0 && qty > 0 && (
                <div style={{fontSize:9,color:"#44cc88",marginTop:4,fontFamily:"monospace"}}>
                  ▸ 수동: 정미 {Math.ceil(qty/sheetInfo.up)}장 + 여분 {parseFloat(s.lossSheets)}장
                  = 총 {Math.ceil(qty/sheetInfo.up)+parseFloat(s.lossSheets)}장
                </div>
              )}
            </div>
          )}
        </Section>

        <Section title="인쇄">
          {["f","b"].map(side => {
            const isF = side === "f";
            const kSp=`${side}pSp`, kBk=`${side}pBk`, kUv=`${side}pUv`, kCol=`${side}pColor`;
            const sp = parseInt(s[kSp])||0, isColor = !!s[kCol];
            const doN = (isColor?4:0) + sp + (s[kBk]?1:0);
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
          {result && result.print.totalColors > 0 && (
            <div style={{fontSize:10,color:"#ffcc44",padding:"4px 8px",background:"#111d33",borderRadius:3,textAlign:"right"}}>
              소부 {result.print.totalColors}도 × {(parseInt(s.sobooU)||SOBOO_UNIT_DEFAULT).toLocaleString()}원
              = {(result.print.totalColors*(parseInt(s.sobooU)||SOBOO_UNIT_DEFAULT)).toLocaleString()}원
              {(s.fpUv||s.bpUv) && <span style={{color:"#88aacc",marginLeft:6,fontSize:9}}>UV인쇄 별도</span>}
            </div>
          )}
        </Section>

        <Section title="코팅 / 후가공">
          <Row2>
            <Field label="전면 코팅"><Select value={s.fcId} onChange={v=>u("fcId",v)} options={COAT_OPTS}/></Field>
            <Field label="후면 코팅"><Select value={s.bcId} onChange={v=>u("bcId",v)} options={COAT_OPTS}/></Field>
          </Row2>
          <Toggle checked={s.puv} onChange={v=>u("puv",v)} label="부분코팅 (95,000원/R)"/>
          {s.puv && (
            <div style={{marginTop:8}}>
              <Field label="부분코팅 면수"><Select value={s.puvS} onChange={v=>u("puvS",v)} options={["1","2"]}/></Field>
            </div>
          )}
          {/* 박 (금박·은박·먹박) */}
          <div style={{marginTop:8}}>
            <Toggle checked={s.foil} onChange={v=>u("foil",v)} label="박 (금박 / 은박 / 먹박)"/>
          </div>
          {s.foil && (
            <div style={{marginTop:8,background:"#080e1c",border:"1px solid #3a3010",borderRadius:4,padding:"10px"}}>
              <div style={{fontSize:9,color:"#ddbb44",fontWeight:700,marginBottom:8}}>박 옵션</div>
              <Row2>
                <Field label="종류">
                  <Select value={s.foilType} onChange={v=>u("foilType",v)} options={["금박","은박","먹박","은박/금박"]}/>
                </Field>
                <Field label="면수"><Select value={s.foilS} onChange={v=>u("foilS",v)} options={["1","2"]}/></Field>
              </Row2>
              <Field label="박 공정 단가 (원/R)" note="금박 140,000 · 먹박 120,000 · 양면 100,000">
                <Input value={s.foilRpr} onChange={v=>u("foilRpr",v)} type="number"/>
              </Field>
              <Row2>
                <Field label="동판 (원)"><Input value={s.foilDevP} onChange={v=>u("foilDevP",v)} type="number"/></Field>
                <Field label="동판필름 (원)"><Input value={s.foilFilmP} onChange={v=>u("foilFilmP",v)} type="number"/></Field>
              </Row2>
            </div>
          )}
          {/* 형압(디보싱) */}
          <div style={{marginTop:8}}>
            <Toggle checked={s.emb} onChange={v=>u("emb",v)} label="형압 (디보싱 / 엠보싱)"/>
          </div>
          {s.emb && (
            <div style={{marginTop:8,background:"#080e1c",border:"1px solid #2a1a3a",borderRadius:4,padding:"10px"}}>
              <div style={{fontSize:9,color:"#cc88ff",fontWeight:700,marginBottom:8}}>형압 옵션</div>
              <Field label="형압 공정 단가 (원/R)" note="디보싱 프레스 단가">
                <Input value={s.embRpr} onChange={v=>u("embRpr",v)} type="number"/>
              </Field>
              <Row2>
                <Field label="형압 개발비 (원)"><Input value={s.embDevP} onChange={v=>u("embDevP",v)} type="number"/></Field>
                <Field label="형압 필름 (원)"><Input value={s.embFilmP} onChange={v=>u("embFilmP",v)} type="number"/></Field>
              </Row2>
            </div>
          )}
          <div style={{marginTop:8}}>
            <Field label="부분코팅 필름비 (원)">
              <Input value={s.filmC} onChange={v=>u("filmC",v)} type="number" placeholder="예: 30000"/>
            </Field>
          </div>
        </Section>

        <Section title="가공">
          <Row2>
            <Field label="톰슨 (도무송)"><Select value={s.thomId} onChange={v=>u("thomId",v)} options={THOMSON_OPTS}/></Field>
            <Field label="접착 방식"><Select value={s.glueId} onChange={v=>u("glueId",v)} options={GLUE_OPTS}/></Field>
          </Row2>
          <div style={{marginTop:6}}>
            <Toggle checked={s.adminManual} onChange={v=>u("adminManual",v)} label="일반관리비 직접 입력"/>
          </div>
          {s.adminManual ? (
            <Field label="일반관리비 (원)">
              <Input value={s.admin} onChange={v=>u("admin",v)} type="number"/>
            </Field>
          ) : (
            <div style={{fontSize:10,color:"#4488aa",padding:"5px 8px",background:"#050f1c",borderRadius:3,marginTop:6,lineHeight:1.7}}>
              자동: <strong style={{color:"#88ccdd"}}>{calcAdmin(qty).toLocaleString()}원</strong>
              <div style={{fontSize:8.5,color:"#335566"}}>
                100,000 + 수량×5원 (1만원 단위) ｜ 싸바리·G형은 실측이 더 높음 → 직접 입력 권장
              </div>
            </div>
          )}
        </Section>

        <Section title="개발비 (목형)">
          <Toggle checked={s.newDie} onChange={v=>u("newDie",v)} label="신규 목형 제작"/>
          {s.newDie && (
            <div style={{marginTop:10}}>
              <Row2>
                <Field label="목형 수량"><Input value={s.dieQ} onChange={v=>u("dieQ",v)} type="number"/></Field>
                <Field label="목형 단가 (원)" note="실제 120,000~240,000원"><Input value={s.dieP} onChange={v=>u("dieP",v)} type="number"/></Field>
              </Row2>
            </div>
          )}
        </Section>

        <div style={{paddingTop:4}}>
          <Toggle checked={s.showCompare} onChange={v=>u("showCompare",v)} label="수량별 단가 비교표"/>
        </div>
      </div>

      {/* ══ RIGHT PANEL ══════════════════════════════════════════════ */}
      <div style={{flex:1,overflowY:"auto",background:"#e8ecf2",padding:"20px 24px"}}>
        {result ? (
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
                  <span style={{fontSize:9,color:"#6688aa"}}>[{BOX_TYPES.find(b=>b.id===s.boxType)?.label.split(" ")[0]}]</span>
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
                    {label:"개당 단가",  val:result.totals.perEA,   note:"공정합계÷수량", green:true, unit:"원"},
                  ].map(({label,val,note,green,unit},i)=>(
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
        ) : (
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:"100%",color:"#4466aa",fontSize:14,flexDirection:"column",gap:12}}>
            <div style={{fontSize:32,opacity:.4}}>📦</div>
            <div>좌측 패널에 정보를 입력하면 견적서가 자동 생성됩니다.</div>
            <div style={{fontSize:11,color:"#334455",opacity:.6}}>박스 구조와 W·D·H를 입력하면 정확한 전개도 치수가 계산됩니다.</div>
            {q?.warnings?.length > 0 && (
              <div style={{fontSize:11,color:"#886644"}}>⚠ {q.warnings.join(" / ")}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

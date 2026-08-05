// ══════════════════════════════════════════════════════════════════
//  NetDiagram.jsx — 전개도 펼친 그림 + 패널 라벨 + 뚜껑/바닥 치수 숫자.
//
//  치수는 domain 이 준 net.topLid / net.botFloor 를 그대로 찍는다. 여기서
//  날개 깊이를 다시 재면 그림과 청구가 갈린다 — 실제로 갈렸던 이력이 있다.
// ══════════════════════════════════════════════════════════════════
import { xEdges } from "../../domain/dieline/geometry.mjs";
import DielineShape from "./DielineShape.jsx";

// ══════════════════════════════════════════════════════════════════
// 전개도 미리보기 (펼친 형태)
// ══════════════════════════════════════════════════════════════════
export default function NetDiagram({ dieline, W, D, H }) {
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

// ══════════════════════════════════════════════════════════════════
//  DielineShape.jsx — 전개도 폴리곤 하나를 mm 좌표로 그리는 부품.
//
//  NetDiagram(펼친 그림)과 LayoutViz(판 위 배치)가 **이 하나**를 공유한다.
//  계산은 없다 — domain/dieline 이 준 pieces/folds/cuts 를 좌표 그대로 옮긴다.
// ══════════════════════════════════════════════════════════════════

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
export const pts = poly => poly.map(([x, y]) => `${x},${y}`).join(" ");

export default function DielineShape({ dl, color }) {
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

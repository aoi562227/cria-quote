// ══════════════════════════════════════════════════════════════════
//  SheetCanvas.jsx — 판형 캔버스. 판 한 장을 mm 자(ruler) 위에 그린다.
//
//  담당은 셋뿐이다: ① 판(= 인쇄기에 걸리는 재단면) ② 물림 띠 ③ 자.
//  얹히는 **도형은 다른 파일이 소유한다** — 폴리곤 구조는 DielineShape 를 그대로
//  재사용하고, PDF 실측 칼선은 pdf.polygons 를 좌표 그대로 폴리라인으로 옮긴다.
//  배치는 layout.boxes 만 읽는다. 여기서 배치를 다시 풀지 않는다(LayoutViz 와 같은
//  규칙 — 그림이 통과시킨 배치와 실제 걸리는 배치가 갈리면 눈으로 잡을 방법이 없다).
//
//  상태를 소유하지 않는다. props 만의 함수다 — 그래서 판형을 바꾸면 판만 바뀌고
//  얹힌 것(layout·pdf)은 호출부가 넘겨주는 그대로 유지된다.
//
//  3단계(마우스 드래그 배치) 이음새 — 셋이 전부다:
//   ① 좌표 변환   px(mm) py(mm) sc(mm) · boxTf(box).  역변환은 (v - RULER) / scale.
//   ② 그릴 배치   props.placement.  주면 그걸 그리고, 없으면 layout.boxes 를 그린다.
//                 되돌림은 placement={null} 하나다.
//   ③ 히트영역    <g data-cell={i}> 안의 rect 는 fill="transparent" 다 — 핸들러만 달면
//                 칸이 잡힌다. ⚠ fill="none" 으로 바꾸지 마라: "none" 은 히트테스트
//                 **대상이 아니고** "transparent" 는 대상이다. 종전에 "none" 이라
//                 칸 0 내부 81표본 중 4개만 잡혔고(그 4개도 rect 가 아니라 칸번호 text)
//                 나머지는 판 배경 rect 로 빠졌다 — 핸들러를 달아도 안 잡히는 상태였다.
//  계산으로의 되먹임은 여기가 아니다 — overrides.up(state 의 mUp/mUpV → quote.mjs 분기 ①)이
//  이미 있으므로 손배치의 up 을 견적에 넣으려면 그 통로를 쓰면 되고 도메인은 손대지 않는다.
// ══════════════════════════════════════════════════════════════════
import {
  BITE_LONG, BITE_SHORT, PRESS_MAX_LONG, PRESS_MAX_SHORT, effectiveSheet,
} from "../../domain/data/sheets.mjs";
import DielineShape from "./DielineShape.jsx";

const MAX_W = 278, MAX_H = 236;   // 좌패널 내용폭(310 − padding 28) 안에 들어가는 크기
const RULER = 20, PAD_R = 12;     // 자 눈금 여백 / 반대쪽 여백

/** 폴리곤 상한. 넘으면 자르되 **잘랐다는 사실을 반드시 알린다** —
 *  일부가 빠진 그림을 맞는 그림으로 오해하는 것이 상한보다 위험하다.
 *  실측 3건은 소스코 10 · 웨이크버니 58 · iSHAP 176 이라 걸리지 않는다. */
const POLY_MAX = 2000;

export default function SheetCanvas({ sheet, layout, dieline, pdf, placement, note }) {
  if (!(sheet?.w > 0 && sheet?.h > 0)) return null;

  // ── 축 ──────────────────────────────────────────────────────────
  // x축 = 긴치수, y축 = 짧은치수. layout.boxes 가 이 축으로 온다
  // (imposition.printableArea → effectiveSheet 가 long/short 로 판을 잡는다).
  const rawLong  = Math.max(sheet.w, sheet.h);
  const rawShort = Math.min(sheet.w, sheet.h);
  const es       = effectiveSheet(sheet.w, sheet.h);   // 인쇄기 990×720 클램프

  const scale = Math.min((MAX_W - RULER - PAD_R) / rawLong,
                         (MAX_H - RULER - PAD_R) / rawShort);
  const svgW = RULER + rawLong  * scale + PAD_R;
  const svgH = RULER + rawShort * scale + PAD_R;
  const px = mm => RULER + mm * scale;
  const py = mm => RULER + mm * scale;
  const sc = mm => mm * scale;

  // ── 물림 띠 — 축을 섞지 마라 ─────────────────────────────────────
  // 코리팩 엑셀 실측 788×1091 → 758×1071 은 「짧은치수 −30 / 긴치수 −20」이다.
  //   x축(긴치수) 감산  = BITE_LONG(20)  → 좌측 띠 폭
  //   y축(짧은치수) 감산 = BITE_SHORT(30) → 상단 띠 높이
  // 양축을 한 값으로 쓰면 배치가 상단 물림을 10mm 침범한 그림이 된다(커밋 81723c8).
  //
  // ⚠ 이 띠는 **참고 표시이고 제약이 아니다.** imposition.printableArea 는 물림을
  //   빼지 않는다 — 판형 숫자가 이미 재단 크기여서 또 빼면 이중 차감이고, 실측 up
  //   재현이 7/12 → 1/12 로 무너진다(ARCHITECTURE §5). 그래서 배치가 이 띠를 덮어도
  //   경고하지 않는다. 경고를 붙이면 화면이 폐기된 방침을 다시 주장하게 된다.
  const biteX = BITE_LONG;    // 긴치수 = x축
  const biteY = BITE_SHORT;   // 짧은치수 = y축

  // ── 자 눈금 ─────────────────────────────────────────────────────
  const step = rawLong >= 700 ? 100 : 50;
  const ticks = max => {
    const t = [];
    for (let v = 0; v <= max + 1e-6; v += step) t.push(v);
    if (max - t[t.length - 1] > step * 0.35) t.push(max);
    return t;
  };

  // ── 얹는 것 ─────────────────────────────────────────────────────
  // ★ 3단계 이음새 ② — 그릴 배치를 **외부에서 갈아끼울 수 있다.**
  //   placement 를 주면 그걸 그리고, 없으면 도메인이 푼 layout.boxes 를 그린다.
  //   왜 파생이 아니라 prop 인가: 손으로 옮긴 배치를 그리려면 호출부가 layout 객체를
  //   위조해야 했고, layout.up === 0 이면 칸이 0개라 손배치를 시작할 발판조차 없었다
  //   (그게 바로 손배치가 가장 필요한 상태다).
  const solved = layout?.up > 0 ? (layout.boxes || []) : [];
  const boxes = placement ?? solved;
  const nW = dieline?.net?.netW || 0, nH = dieline?.net?.netH || 0;
  const usePoly = !!dieline?.polygon && nW > 0 && nH > 0;
  // PDF 폴리곤은 페이지 좌표(mm, y 위로) 다. 전개도 로컬 좌표(y 아래로)로 옮기는
  // 변환 하나만 씌운다 — 좌표 배열을 다시 만들지 않는다(3단계가 같은 배열을 쓴다).
  const pb = pdf?.bbox;
  const pdfTf = pb ? `translate(${-pb.x0},${pb.y0 + pb.h}) scale(1,-1)` : null;
  const pdfAll = pdfTf ? (pdf.polygons || []) : [];
  const pdfPolys = pdfAll.slice(0, POLY_MAX);
  const polyCut = pdfAll.length - pdfPolys.length;   // >0 이면 아래 범례에서 알린다

  // ── 판에 안 들어가는 경우 — 빈 판만 그리지 않는다 ────────────────
  //   layout.up === 0 이면 칸이 0개고, sheetInfo 도 같이 null 이라 판걸이 정보 블록까지
  //   사라진다. 그러면 큰 대지 PDF 를 넣은 사용자는 **왜 아무것도 안 보이는지 모른다.**
  //   그래서 원점에 1개를 그린다 — 판 밖으로 삐져나온 그림이 숫자보다 진단력이 높다.
  const gw = usePoly ? nW : (pdfPolys.length ? pb.w : nW);
  const gh = usePoly ? nH : (pdfPolys.length ? pb.h : nH);
  const ghost = boxes.length === 0 && gw > 0 && gh > 0
    ? { x: 0, y: 0, w: gw, h: gh, rotated: false, flipped: false } : null;
  const ghostNote = ghost
    ? `전개도 ${+gw.toFixed(1)}×${+gh.toFixed(1)} 가 판 ${es.long}×${es.short}` +
      `${es.capped ? "(인쇄기 클램프 후)" : ""} 에 1개도 안 들어간다 — 원점에 1개만 판 밖으로 걸쳐 그렸다.`
    : null;
  const cells = ghost ? [ghost] : boxes;

  /** 배치 1칸의 mm→svg 변환. 회전은 좌표를 다시 계산하지 않고 rotate(90) 으로 돌린다
   *  (좌표를 다시 만들면 축 불일치가 들어온다 — DielineShape 주석과 같은 이유).
   *  b.w 는 **앉힌 발자국 폭**이라 회전칸에서는 전개도 netH 다 → translate(b.w,0) 이
   *  LayoutViz 의 translate(netH,0) 과 같은 값이다. */
  const boxTf = b =>
    `translate(${px(b.x)},${py(b.y)}) scale(${scale})` +
    (b.rotated ? ` translate(${b.w},0) rotate(90)` : "");

  return (
    <div style={{background:"#05111f",borderRadius:8,padding:"10px 8px",marginTop:8,border:"1px solid #1a3050"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5,gap:6}}>
        <div style={{fontSize:9.5,fontWeight:800,color:"#4aaeff",letterSpacing:".1em",textTransform:"uppercase"}}>
          ▤ 판형 캔버스
        </div>
        <div style={{fontSize:9,color:"#8899bb",textAlign:"right"}}>
          {sheet.label || sheet.id} · <span style={{fontFamily:"monospace",color:"#c8d8f0"}}>{rawLong}×{rawShort}</span>
        </div>
      </div>

      <svg width={svgW} height={svgH} style={{display:"block",margin:"0 auto"}}>
        <defs>
          <pattern id="scBite" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="#ff444455" strokeWidth="2"/>
          </pattern>
          <pattern id="scCut" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="#66778855" strokeWidth="2"/>
          </pattern>
        </defs>

        {/* ① 원지 재단면 전체 */}
        <rect x={px(0)} y={py(0)} width={sc(rawLong)} height={sc(rawShort)}
          fill="#0d2035" stroke="#2a4060" strokeWidth={1.2} rx={2}/>

        {/* 인쇄기 990×720 밖 — 통째로 안 들어가서 잘라내는 부분 */}
        {es.capped && (
          <>
            <rect x={px(es.long)} y={py(0)} width={sc(rawLong - es.long)} height={sc(rawShort)}
              fill="url(#scCut)"/>
            <rect x={px(0)} y={py(es.short)} width={sc(es.long)} height={sc(rawShort - es.short)}
              fill="url(#scCut)"/>
            <rect x={px(0)} y={py(0)} width={sc(es.long)} height={sc(es.short)}
              fill="none" stroke="#ff9944" strokeWidth={1} strokeDasharray="4 3" opacity={.85}/>
          </>
        )}

        {/* ② 물림 띠 — 상단(짧은치수 30) / 좌측(긴치수 20) */}
        <rect x={px(0)} y={py(0)} width={sc(es.long)} height={sc(biteY)} fill="#ff000016"/>
        <rect x={px(0)} y={py(0)} width={sc(es.long)} height={sc(biteY)} fill="url(#scBite)"/>
        <rect x={px(0)} y={py(0)} width={sc(biteX)} height={sc(es.short)} fill="#ff000016"/>
        <rect x={px(0)} y={py(0)} width={sc(biteX)} height={sc(es.short)} fill="url(#scBite)"/>
        <line x1={px(0)} y1={py(biteY)} x2={px(es.long)} y2={py(biteY)}
          stroke="#ff5544" strokeWidth={.8} strokeDasharray="3 2.5" opacity={.75}/>
        <line x1={px(biteX)} y1={py(0)} x2={px(biteX)} y2={py(es.short)}
          stroke="#ff5544" strokeWidth={.8} strokeDasharray="3 2.5" opacity={.75}/>
        {sc(biteY) > 7 && (
          <text x={px(es.long / 2)} y={py(biteY / 2)} textAnchor="middle" dominantBaseline="middle"
            fontSize={7} fill="#ff7766" fontWeight={700}>물림 {biteY}mm (짧은치수)</text>
        )}

        {/* ③ 얹힌 배치 — 좌표·회전·반전 전부 placement(또는 layout.boxes) 그대로.
               ⚠ 칸 rect 의 fill 은 **"transparent"** 다. "none" 은 히트테스트 대상이
                 아니어서 <g data-cell> 에 핸들러를 달아도 칸이 안 잡힌다 (파일 머리 ③). */}
        {cells.map((b, i) => (
          <g key={i} data-cell={i} data-ghost={ghost ? "1" : undefined}>
            <rect x={px(b.x)} y={py(b.y)} width={sc(b.w) - .4} height={sc(b.h) - .4}
              fill={usePoly || pdfPolys.length ? "transparent" : "#3b82f628"}
              stroke={ghost ? "#ff9944" : "#3b82f6"} strokeWidth={ghost ? 1 : .7}
              strokeDasharray={ghost ? "5 3" : (usePoly || pdfPolys.length ? "2 2.5" : undefined)}
              opacity={ghost ? .9 : (usePoly || pdfPolys.length ? .45 : 1)} rx={1}/>
            {usePoly && (
              <g transform={boxTf(b) + (b.flipped ? ` rotate(180,${nW/2},${nH/2})` : "")}>
                <DielineShape dl={dieline} color="#78dcff"/>
              </g>
            )}
            {!usePoly && pdfPolys.length > 0 && (
              <g transform={boxTf(b) + (b.flipped ? ` rotate(180,${pb.w/2},${pb.h/2})` : "")}>
                <g transform={pdfTf} fill="none" stroke="#7ce0ff" strokeWidth={.9}
                   strokeLinejoin="round" vectorEffect="non-scaling-stroke">
                  {pdfPolys.map((p, k) => (
                    <polyline key={k} points={p.map(([x,y]) => `${x},${y}`).join(" ")}/>
                  ))}
                </g>
              </g>
            )}
            {!ghost && sc(Math.min(b.w, b.h)) > 14 && (
              <text x={px(b.x + b.w/2)} y={py(b.y + b.h/2)} textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.min(sc(b.w), sc(b.h)) * 0.3} fill="#5a9fe0" fontWeight={700} opacity={.7}>
                {i+1}
              </text>
            )}
          </g>
        ))}

        {/* ④ 자 — 상단(긴치수) / 좌측(짧은치수) */}
        <g stroke="#3a5a80" strokeWidth={.8}>
          <line x1={px(0)} y1={RULER-1} x2={px(rawLong)} y2={RULER-1}/>
          <line x1={RULER-1} y1={py(0)} x2={RULER-1} y2={py(rawShort)}/>
          {ticks(rawLong).map(v => <line key={"tx"+v} x1={px(v)} y1={RULER-1} x2={px(v)} y2={RULER-5}/>)}
          {ticks(rawShort).map(v => <line key={"ty"+v} x1={RULER-1} y1={py(v)} x2={RULER-5} y2={py(v)}/>)}
        </g>
        <g fontSize={6.5} fill="#6688aa">
          {ticks(rawLong).map(v => (
            <text key={"lx"+v} x={px(v)} y={RULER-7} textAnchor="middle">{Math.round(v)}</text>
          ))}
          {ticks(rawShort).map(v => (
            <text key={"ly"+v} x={RULER-7} y={py(v)} textAnchor="middle" dominantBaseline="middle"
              transform={`rotate(-90,${RULER-7},${py(v)})`}>{Math.round(v)}</text>
          ))}
        </g>
      </svg>

      {/* 클램프 경고 — 이쪽은 실제 제약이다(물림과 달리 판이 정말 잘려 나간다) */}
      {es.capped && (
        <div style={{fontSize:9,color:"#ffaa44",background:"#2a1a00",border:"1px solid #664400",
                     borderRadius:4,padding:"5px 8px",marginTop:7,lineHeight:1.6}}>
          ⚠ 인쇄기 최대 {PRESS_MAX_LONG}×{PRESS_MAX_SHORT}mm — {rawLong}×{rawShort} 원지를{" "}
          <strong>{es.long}×{es.short}</strong>로 재단해서 걺 (사선 부분은 판걸이에 못 씀)
        </div>
      )}

      {/* 판에 1개도 안 들어감 — 빈 판을 아무 설명 없이 보여주지 않는다 */}
      {ghostNote && (
        <div style={{fontSize:9,color:"#ffaa44",background:"#2a1a00",border:"1px solid #664400",
                     borderRadius:4,padding:"5px 8px",marginTop:7,lineHeight:1.6}}>
          ⚠ {ghostNote}
        </div>
      )}

      <div style={{display:"flex",gap:10,marginTop:7,flexWrap:"wrap",fontSize:8.5,color:"#7788aa",lineHeight:1.6}}>
        <span><span style={{color:"#ff7766"}}>▨</span> 물림 짧은치수 {biteY} / 긴치수 {biteX}mm <span style={{color:"#556680"}}>(참고 표시 — 판걸이는 빼지 않음)</span></span>
        {es.capped && <span><span style={{color:"#889"}}>▨</span> 인쇄기 밖</span>}
        {boxes.length > 0 && (
          <span><span style={{color:"#7ce0ff"}}>─</span> 칼선 {boxes.length}up
            {placement && <span style={{color:"#556680"}}> (손배치)</span>}
          </span>
        )}
        {ghost && <span><span style={{color:"#ff9944"}}>┈</span> 판에 안 들어가는 전개도 1개</span>}
        {/* 상한에 걸려 잘렸다는 사실을 알린다 — 조용히 자르면 일부 빠진 그림을 맞다고 읽는다 */}
        {polyCut > 0 && (
          <span style={{color:"#ffaa44"}}>⚠ 폴리곤 {POLY_MAX.toLocaleString()}개에서 끊음 ({polyCut.toLocaleString()}개 안 그림)</span>
        )}
      </div>
      {note && <div style={{fontSize:8.5,color:"#556680",marginTop:3,lineHeight:1.6}}>{note}</div>}
    </div>
  );
}

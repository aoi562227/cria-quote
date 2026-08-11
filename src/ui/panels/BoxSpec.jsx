// ══════════════════════════════════════════════════════════════════
//  BoxSpec.jsx — 규격 입력(W·D·H / 전개도 직접 / 칼선 PDF) + 구조 선택 + 그 결과 표시.
//
//  전개도 치수·판걸이·수율·R수를 **읽어서만** 보여준다. netSize/layout/sheetInfo 는
//  buildQuote 가 준 값이고, 여기서 다시 재면 화면과 청구가 갈린다.
//  전개도·배치·판형캔버스·판형비교 그림은 토글로 감싸 자식 컴포넌트에 넘긴다.
//
//  칼선 PDF 는 **새 도메인 경로를 만들지 않는다** — 「전개도 전체크기 직접입력」
//  (sizeMode="net" → dieline/direct.mjs)이 이미 있으므로, 추출한 실측 bbox 를 그
//  입력(nW/nH)에 넣는 것이 전부다. 도메인은 PDF 를 모른다.
// ══════════════════════════════════════════════════════════════════
import { useMemo, useRef, useState } from "react";
import { PRESS_MAX_LONG, PRESS_MAX_SHORT, MAX_FOOT_PCT, findSheetBase, resolveSheet } from "../../domain/data/sheets.mjs";
import { readDielineFile } from "../../domain/pdf-dieline.mjs";
import { Section, Field, Row2, Row3, Input, Select, Toggle } from "../primitives.jsx";
import { BOX_TYPES } from "../box-types.mjs";
import { fmtR, fmtMM } from "../format.mjs";
// 「지금 고른 후보 → 그 후보의 polygons」 규칙은 state.mjs 가 소유한다 (두 벌 중
// 어느 쪽이 정답인지 아는 곳이 한 군데여야 3단계가 다른 걸 읽지 않는다).
import { pdfPickOf, customSheetOf } from "../state.mjs";
import NetDiagram from "../viz/NetDiagram.jsx";
import LayoutViz from "../viz/LayoutViz.jsx";
import SheetCompare from "../viz/SheetCompare.jsx";
import SheetCanvas from "../viz/SheetCanvas.jsx";
// 손배치의 기하 엔진. UI 는 여기서 **부품 한 벌만 만들고** 나머지(스냅·겹침·감사)는
// SheetCanvas 가 좌표와 함께 부른다. 새 기하를 짜지 않는다.
import { makeDragPart, pdfLocalPolylines, serializePlacement, parsePlacement } from "../viz/nest-drag.mjs";

export default function BoxSpec({
  s, u, handleBoxType, input, netSize, dieline, sheetInfo, layout, result, H,
}) {
  // 파싱 진행·드래그 하이라이트만 로컬 상태다 — 값이 아니라 순간 UI 라서 s 에 넣지 않는다
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);
  // 손배치 되돌리기 스택 + 배치파일 불러오기 안내문. 둘 다 순간 UI 다
  // (스택은 「값」이 아니라 조작 이력이고, 세션을 넘겨 보존할 이유가 없다).
  const [undo, setUndo] = useState([]);
  const [plcMsg, setPlcMsg] = useState("");
  const plcRef = useRef(null);
  // 페이지를 바꿔 다시 읽기 위한 File 손잡이. **값이 아니라 원본 핸들**이라 s 에 넣지 않는다
  // (브라우저가 디스크 핸들만 들고 있어 메모리 비용도 거의 없다).
  const keptFile = useRef(null);

  const pdf     = s.pdfDl;
  const pdfPick = pdfPickOf(s);

  /** 후보 하나를 규격 입력에 적용. u() 는 함수형 setState 라 4번 불러도 순서가 안전하다. */
  const applyPick = (r, idx) => {
    const bb = (r.candidates?.[idx] ?? { bbox: r.bbox }).bbox;
    u("sizeMode", "net");                     // 기존 경로 재사용 — 새 모드를 만들지 않는다
    u("nW", String(bb.w));
    u("nH", String(bb.h));
    u("pdfDl", { ...r, pickIdx: idx });       // polygons 까지 통째로 — 3단계 입력이다
  };

  /** page: 여러 판이 한 파일에 든 「2종」 도면이 실무에 있다 (웨이크버니 2종 =
   *  p0 198.3×234 / p1 158.3×247). readDieline 이 이미 opt.page 를 받으므로
   *  다시 읽기만 하면 된다 — 추출을 손댈 필요가 없다. */
  const loadPdf = async (file, page = 0) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const r = await readDielineFile(file, { page });
      keptFile.current = file;
      // 1순위(chosen)를 기본 선택으로. 사용자는 아래 드롭다운에서 바꿀 수 있다.
      applyPick({ ...r, page }, Math.max(0, (r.candidates || []).findIndex(c => c.chosen)));
    } catch (e) {
      // 조용히 무시하면 사용자는 "드롭이 안 먹었다" 로 읽는다. 이유를 그대로 남긴다
      // (암호화·/ObjStm 압축객체·이미지만 있는 PDF 는 전부 서로 다른 대처가 필요하다).
      u("pdfDl", { error: e?.message || String(e), source: file.name });
    } finally { setBusy(false); }
  };

  const pdfSheet   = pdf?.sheetId ? findSheetBase(pdf.sheetId) : null;
  // 사용자가 판형을 직접 고른 경우(auto 아님)의 그 판. 주문생산은 cusW/cusH 를 얹는다.
  const fixedSheet = s.sheetId !== "auto"
    ? resolveSheet(findSheetBase(s.sheetId), customSheetOf(s)) : null;
  // 판형 캔버스가 그릴 판: ① 견적이 고른 판형 ② PDF 페이지에서 인식한 판형
  //   ③ 사용자가 직접 고른 판형
  // ③ 이 필요한 이유: 전개도가 **어떤 판에도 안 들어가면** 견적이 판형을 못 골라
  //   sheetInfo 가 null 이 되고, 그러면 판걸이 정보 블록과 함께 캔버스 토글까지 통째로
  //   사라졌다. 큰 대지 PDF 를 넣은 사용자는 그때 화면에서 아무 신호도 못 받는다 —
  //   가장 진단이 필요한 순간에 화면이 비는 셈이다. SheetCanvas 는 이 판 위에 전개도 1개를
  //   판 밖으로 걸쳐 그려서 「안 들어간다」를 눈으로 보여준다.
  const canvasSheet = sheetInfo || pdfSheet || fixedSheet;
  // 지금 그리는 판이 견적이 고른 판이 아니면 그 사실을 캔버스 밑에 적는다 (조용히 다른
  // 판을 보여주면 사용자가 그 판으로 견적이 났다고 읽는다).
  const canvasNote = sheetInfo ? null
    : pdfSheet ? "판형은 PDF 페이지 크기에서 인식한 값이다 (견적 판형이 아직 없음)."
    : fixedSheet ? `판형은 위에서 직접 고른 ${fixedSheet.label} 이다 — 견적은 아직 판형을 못 골랐다.`
    : null;
  // PDF 칼선을 판 위에 얹을지 — **지금 계산에 쓰이는 전개도와 같은 도형일 때만** 얹는다.
  // (박스 치수 모드로 되돌렸거나 nW/nH 를 손으로 고쳤으면 칸 크기와 폴리곤이 어긋난다)
  const pdfOverlay = (pdfPick && netSize &&
    Math.abs(netSize.netW - pdfPick.bbox.w) < 0.05 &&
    Math.abs(netSize.netH - pdfPick.bbox.h) < 0.05) ? pdfPick : null;

  // ══ 손배치(3단계) 배선 ═══════════════════════════════════════════
  //  엔진은 viz/nest-drag.mjs 가, 조작·그림은 SheetCanvas 가 갖는다.
  //  여기가 갖는 것은 **상태와 견적 되먹임**뿐이다: s.placement / s.handMode /
  //  되돌리기 스택 / mUp·mUpV / 배치파일 입출력.
  const handOn = !!s.handMode;

  // 도형 소스는 둘이다. **SheetCanvas 가 그리는 것과 같은 도형**이어야 한다 —
  // 그림과 충돌 도형이 갈리면 「닿아 보이는데 안 놓이는」 자리가 생기고 눈으로 못 잡는다.
  //   · PDF 칼선(polygons) 우선 — 폴리라인 묶음이라 봉합·볼록분해가 필요하다
  //   · 없으면 구조 전개도(dieline.pieces) — 이미 볼록이라 그대로 쓴다("exact")
  // 두 소스는 실무에서 배타적이다: PDF 를 넣으면 applyPick 이 sizeMode="net" 으로
  // 바꾸고 그 경로의 구조는 direct(polygon:false) 라 SheetCanvas 의 usePoly 가 false 다.
  const handSrc = pdfOverlay ? "pdf" : (dieline?.pieces?.length ? "dieline" : null);
  const handPart = useMemo(() => {
    if (!handOn || !handSrc) return null;
    if (handSrc === "pdf")
      return makeDragPart({ polylines: pdfLocalPolylines(pdfOverlay),
                            w: pdfOverlay.bbox.w, h: pdfOverlay.bbox.h });
    return makeDragPart({ pieces: dieline.pieces,
                          w: dieline.net.netW, h: dieline.net.netH });
    // ⚠ 참조를 키로 쓰지 마라. buildQuote 는 상태가 바뀔 때마다 dieline 을 새로 만들므로
    //   dieline.pieces 를 의존성에 넣으면 **글자 한 자 칠 때마다** NFP 사전계산(조각²)이
    //   다시 돈다. dieline.key 가 「폴리곤을 결정하는 입력 전부」라 그것으로 충분하다
    //   (quote.mjs buildDieline 의 key 주석). PDF 쪽 polygons 는 s.pdfDl 안의 안정된
    //   배열이라 참조를 그대로 써도 된다.
  }, [handOn, handSrc, dieline?.key, pdfOverlay?.polygons,
      pdfOverlay?.bbox?.w, pdfOverlay?.bbox?.h, pdfOverlay?.bbox?.x0, pdfOverlay?.bbox?.y0]);

  /**
   * 손배치 확정 — 되돌리기 스냅샷을 쌓고 개수를 견적에 흘린다.
   * ★ 새 도메인 경로를 만들지 않는다: up 은 **기존 직접입력 통로**(mUp/mUpV →
   *   toQuoteInput.overrides.up → quote.mjs decideSheet ① 분기)로만 간다.
   *   그 분기가 R = calcR(up, …) 을 다시 재므로 지대R·금액이 자동으로 따라온다.
   */
  const commitPlacement = (next, { snapshot = true } = {}) => {
    if (snapshot) setUndo(st => [...st.slice(-49), s.placement ?? []]);
    u("placement", next);
    u("mUp", true);
    // 0개면 toQuoteInput 이 `mUp && up>0` 에서 걸려 **자동 up 으로 되돌아간다.**
    // 조용히 0원을 만들지 않는 게 낫고, 캔버스가 그 사실을 글로 알린다.
    u("mUpV", String(next.length));
  };

  /** Ctrl+Z. 되돌릴 것이 없으면 false — 캔버스가 그 사실을 글로 알린다. */
  const undoPlacement = () => {
    if (!undo.length) return false;
    const back = undo[undo.length - 1];
    setUndo(st => st.slice(0, -1));
    commitPlacement(back, { snapshot: false });
    return true;
  };

  const enterHand = () => {
    // 씨앗은 자동 배치다 (ARCHITECTURE §10-2). layout.up === 0 이면 앉힐 발판이 없으므로
    // 원점에 1개를 둔다 — 캔버스가 판 밖으로 걸쳐 그려서 「안 들어간다」를 보여준다.
    const seed = (layout?.up > 0 ? layout.boxes : []).map(b => ({
      x: b.x, y: b.y, flipped: !!b.flipped, rotated: !!b.rotated }));
    const items = s.placement?.length ? s.placement
                : (seed.length ? seed : [{ x: 0, y: 0, flipped: false, rotated: false }]);
    setUndo([]); setPlcMsg("");
    // u() 는 함수형 setState 라 순서가 안전하다. handPrev 는 **이 렌더의 s**(= 켜기 전 값)를
    // 담으므로 뒤이은 u() 들이 덮어도 원본이 보존된다.
    u("handPrev", { mUp: s.mUp, mUpV: s.mUpV, sheetId: s.sheetId });
    // 판을 못 박는다 — state.mjs handPrev 주석의 4×64 사고를 막는 자리다.
    if (s.sheetId === "auto") u("sheetId", sheetInfo?.id || canvasSheet?.id || "auto");
    u("placement", items);
    u("mUp", true); u("mUpV", String(items.length));
    u("showSheet", true);          // 캔버스가 닫혀 있으면 켠 표시가 아무 데도 안 보인다
    u("handMode", true);
  };

  const exitHand = () => {
    const pv = s.handPrev;
    u("handMode", false);
    // 자동 up 으로 되돌아가야 한다 — 켜기 전 값 그대로. 판형도 같이 되돌린다.
    if (pv) { u("mUp", pv.mUp); u("mUpV", pv.mUpV); u("sheetId", pv.sheetId); }
    else u("mUp", false);
    u("handPrev", null);
    setPlcMsg("");
    // placement 는 지우지 않는다 — 다시 켜면 이어서 쓴다. 꺼진 동안은 아무 데도 안 흐른다.
  };

  /** 배치 저장 — 목형이 정해진 건을 다른 견적에서 다시 쓰는 통로다. */
  const savePlacement = () => {
    const txt = serializePlacement(s.placement || [], {
      sheet: canvasSheet ? { id: canvasSheet.id, label: canvasSheet.label,
                             w: canvasSheet.w, h: canvasSheet.h } : null,
      part: handPart ? { w: handPart.w, h: handPart.h, mode: handPart.mode, source: handSrc } : null,
    });
    const url = URL.createObjectURL(new Blob([txt], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `배치_${(s.product || "배치").replace(/[\\/:*?"<>|]/g, "_")}_${(s.placement||[]).length}up.json`;
    a.click();
    URL.revokeObjectURL(url);
    setPlcMsg(`저장했다 — ${(s.placement || []).length}개`);
  };

  /** 배치 불러오기. **막지 않고 알린다** — 다른 판·다른 도형에 붙이는 것이 목형 재사용의
   *  실무 목적이기도 하다. 대신 다르면 그 사실을 반드시 띄운다(겹침은 캔버스가 빨갛게 잡는다). */
  const loadPlacement = async file => {
    if (!file) return;
    const r = parsePlacement(await file.text());
    if (r.error) { setPlcMsg(`✕ 배치 파일을 못 읽었다 — ${r.error}`); return; }
    const warn = [];
    if (r.sheet && canvasSheet && (r.sheet.w !== canvasSheet.w || r.sheet.h !== canvasSheet.h))
      warn.push(`판이 다르다 (저장 ${r.sheet.w}×${r.sheet.h} → 지금 ${canvasSheet.w}×${canvasSheet.h})`);
    if (r.part && handPart && (Math.abs(r.part.w - handPart.w) > 0.05 || Math.abs(r.part.h - handPart.h) > 0.05))
      warn.push(`도형 크기가 다르다 (저장 ${fmtMM(r.part.w)}×${fmtMM(r.part.h)} → 지금 ${fmtMM(handPart.w)}×${fmtMM(handPart.h)})`);
    setPlcMsg(warn.length ? `⚠ ${r.items.length}개 불러왔다 — ${warn.join(" · ")}`
                          : `불러왔다 — ${r.items.length}개`);
    commitPlacement(r.items);
  };

  return (
    <Section title="박스 규격 및 구조">
      <Field label="규격 입력 방식">
        <Select value={s.sizeMode} onChange={v=>u("sizeMode",v)} options={[
          {id:"box", label:"박스 치수 (W×D×H) → 전개도 자동"},
          {id:"net", label:"전개도 전체크기 직접입력"},
        ]}/>
      </Field>

      {/* ── 칼선 PDF 드롭 ───────────────────────────────────────────────
          왜: W·D·H 회귀식은 변종(뚜껑 위치가 다르고 날개가 짧은 삼면접착 등)을
          못 잡는다. iSHAP 120×150×80 은 netW 는 맞는데 netH 실측 324.2 가 어느 구조
          공식으로도 안 나온다. 협력사 PDF 의 실측 bbox 를 넣으면 추측이 사라진다. */}
      <div
        onDragOver={e=>{ e.preventDefault(); setDrag(true); }}
        onDragLeave={()=>setDrag(false)}
        onDrop={e=>{ e.preventDefault(); setDrag(false); loadPdf(e.dataTransfer?.files?.[0]); }}
        style={{border:`1px dashed ${drag?"#4aaeff":"#2a3a5a"}`,background:drag?"#0d2440":"#0a0f20",
                borderRadius:4,padding:"6px 8px",marginBottom:8,display:"flex",alignItems:"center",
                justifyContent:"space-between",gap:6,fontSize:9,color:"#7799bb",lineHeight:1.5}}>
        <span>{busy ? "칼선 PDF 읽는 중…" : "칼선 PDF 드롭 → 실측 전개도"}</span>
        {/* 드래그가 안 되는 상황(원격·터치)도 있으므로 파일 선택 버튼을 같이 둔다 */}
        <button type="button" onClick={()=>fileRef.current?.click()} disabled={busy}
          style={{background:"#16283f",border:"1px solid #2a3a5a",borderRadius:3,color:"#a8c8e8",
                  fontSize:9,padding:"3px 7px",cursor:busy?"default":"pointer",whiteSpace:"nowrap"}}>
          파일 선택
        </button>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" style={{display:"none"}}
          onChange={e=>{ const f = e.target.files?.[0]; e.target.value = ""; loadPdf(f); }}/>
      </div>

      {/* ── PDF 읽기 실패 ── 왜 실패했는지 보여준다. 조용히 넘기지 않는다 ── */}
      {pdf?.error && (
        <div style={{marginBottom:8,fontSize:9,color:"#ff8877",background:"#2a0a06",
                     border:"1px solid #663322",borderRadius:4,padding:"6px 9px",lineHeight:1.7}}>
          <div style={{fontWeight:700}}>✕ PDF 를 읽지 못했다 — {pdf.source}</div>
          <div style={{color:"#ffbbaa",marginTop:2}}>{pdf.error}</div>
          <button type="button" onClick={()=>u("pdfDl",null)}
            style={{marginTop:4,background:"none",border:"none",color:"#886666",fontSize:8.5,
                    cursor:"pointer",padding:0,textDecoration:"underline"}}>지우기</button>
        </div>
      )}

      {/* ── PDF 읽기 성공 ─────────────────────────────────────────────
          ⚠ 값을 조용히 견적에 넣지 마라. 칼선이 아닌 PDF(견적서 표 괘선 등)도
            그럴듯한 숫자를 낸다 — 도구가 원리적으로 구분할 수 없다. 그래서 후보와
            경고를 같이 띄우고 사용자가 확인하게 한다. */}
      {pdf && !pdf.error && pdfPick && (
        <div style={{marginBottom:8,fontSize:9,background:"#041a12",border:"1px solid #1a5038",
                     borderRadius:4,padding:"7px 9px",color:"#7fd0a8",lineHeight:1.8}}>
          <div style={{display:"flex",justifyContent:"space-between",gap:6}}>
            <span style={{color:"#aee8cc",fontWeight:700,wordBreak:"break-all"}}>📄 {pdf.source}</span>
            <button type="button" onClick={()=>u("pdfDl",null)}
              style={{background:"none",border:"none",color:"#557766",fontSize:8.5,cursor:"pointer",
                      padding:0,textDecoration:"underline",whiteSpace:"nowrap",flexShrink:0}}>지우기</button>
          </div>
          <div style={{display:"flex",justifyContent:"space-between"}}>
            <span>실측 전개도</span>
            <strong style={{color:"#e8f0ff",fontFamily:"monospace"}}>
              {fmtMM(pdfPick.bbox.w)} × {fmtMM(pdfPick.bbox.h)} mm
            </strong>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",color:"#5a9f80"}}>
            <span>페이지 {pdf.pageCount > 1 ? `${(pdf.page ?? 0)+1}/${pdf.pageCount}` : ""}</span>
            <span style={{fontFamily:"monospace"}}>{fmtMM(pdf.pageSize.w)} × {fmtMM(pdf.pageSize.h)}</span>
          </div>

          {/* 「2종」 도면 — 한 파일에 판이 여러 개다. 페이지를 바꾸면 그 페이지를 다시 읽는다 */}
          {pdf.pageCount > 1 && (
            <div style={{marginTop:4}}>
              <div style={{fontSize:8.5,color:"#5a9f80",marginBottom:2}}>
                판이 {pdf.pageCount}장 — 다른 판을 쓰려면 페이지를 바꿔라
              </div>
              <Select value={String(pdf.page ?? 0)}
                onChange={v=>loadPdf(keptFile.current, Number(v))}
                options={Array.from({length: pdf.pageCount}, (_,i)=>({
                  id: String(i), label: `${i+1} 페이지`,
                }))}/>
            </div>
          )}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",color:"#5a9f80"}}>
            <span>인식 판형</span>
            <span>
              {pdfSheet ? (
                <>
                  <strong style={{color:"#aee8cc"}}>{pdfSheet.label}</strong>
                  {s.sheetId !== pdf.sheetId && (
                    <button type="button" onClick={()=>u("sheetId", pdf.sheetId)}
                      style={{marginLeft:5,background:"#16283f",border:"1px solid #2a4a3a",borderRadius:3,
                              color:"#88ccaa",fontSize:8,padding:"1px 5px",cursor:"pointer"}}>판형 적용</button>
                  )}
                </>
              ) : <span style={{color:"#66887a"}}>표준 판형과 안 맞음 (±3mm)</span>}
            </span>
          </div>

          {/* 후보가 2개 이상이면 바꿀 수 있게 — 「가장 그럴듯한 것」이 늘 맞지는 않다.
              도솔메디 2up 대지는 아트보드 밖에 있어서 7순위로 들어온다. */}
          {pdf.candidates?.length > 1 && (
            <div style={{marginTop:4}}>
              <div style={{fontSize:8.5,color:"#5a9f80",marginBottom:2}}>
                도형 후보 {pdf.candidates.length}개 — 다르면 바꿔라
              </div>
              {/* ⚠ 라벨에 위치(@x0,y0)를 넣는다. 크기·점수·선분만 쓰면 서로 다른 후보가
                    **완전히 같은 문자열**로 보인다 — iSHAP 무제-3 실측에서
                    "1. 569.0×335.7 (점수 0.4982 · 선분 425)" 가 1·2번 동일, 3·4번 동일이라
                    2up 대지의 좌판/우판을 화면에서 구분할 방법이 없었다.
                    candidates 가 이미 x0/y0 를 담고 있으므로 추출기는 손대지 않는다. */}
              <Select value={String(pdf.pickIdx ?? 0)}
                onChange={v=>applyPick(pdf, Number(v))}
                options={pdf.candidates.map((c,i)=>({
                  id: String(i),
                  // 위치는 fmtMM 을 쓰지 않는다 — fmtMM(0) 이 "-" 라서 페이지 원점에 있는
                  // 후보가 "@-,-" 로 찍힌다. 위치는 0 도 의미 있는 값이다.
                  label: `${i+1}. ${fmtMM(c.bbox.w)}×${fmtMM(c.bbox.h)} @${c.bbox.x0.toFixed(1)},${c.bbox.y0.toFixed(1)}  ` +
                         `(점수 ${c.score} · 선분 ${c.segs}${c.parts>1?` · ${c.parts}성분`:""}` +
                         `${c.offPct>1?` · 판밖 ${c.offPct}%`:""})`,
                }))}/>
            </div>
          )}

          {pdf.warnings?.length > 0 && (
            <div style={{marginTop:4,paddingTop:4,borderTop:"1px solid #1a5038",
                         fontSize:8.5,color:"#ffcc88",lineHeight:1.7}}>
              {pdf.warnings.map((w,i)=><div key={i}>⚠ {w}</div>)}
            </div>
          )}

          {s.sizeMode !== "net" && (
            <div style={{marginTop:4,fontSize:8.5,color:"#ffaa66"}}>
              ⚠ 지금 규격 입력 방식이 「박스 치수」다 — 위 실측값은 견적에 쓰이지 않는다.
            </div>
          )}
        </div>
      )}

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

      {/* 구조가 낸 입력범위 경고 — 구조별 if 없이 netSize.warning 하나만 본다.
          새 구조가 제약(예: 트레이 H ≤ D/2)을 알리려면 warning 문자열만 내면 된다. */}
      {netSize?.warning && (
        <div style={{marginBottom:10,fontSize:9.5,color:"#ffaa44",background:"#2a1a00",
          border:"1px solid #664400",borderRadius:4,padding:"6px 9px",lineHeight:1.7}}>
          ⚠ {netSize.warning}
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
          {/* note 를 내는 구조는 그 한 줄을, 안 내는 구조(날개가 있는 폴리곤 구조)는
              뚜껑/바닥/접착날개 내역을 찍는다. 구조 id 로 분기하지 않는다. */}
          <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #1a3050",marginTop:4,paddingTop:4}}>
            {netSize.note ? (
              <>
                <span style={{color:"#88bbdd",fontSize:9}}>{netSize.note[0]}</span>
                <span style={{color:"#88bbdd",fontSize:9,fontFamily:"monospace"}}>{netSize.note[1]}</span>
              </>
            ) : (
              <>
                <span style={{color:"#8899bb",fontSize:9}}>뚜껑 / 바닥 / 접착날개{netSize.hangTab?" / 행거탭":""}</span>
                <span style={{color:"#8899bb",fontSize:9,fontFamily:"monospace"}}>
                  {fmtMM(netSize.topLid)} / {fmtMM(netSize.botFloor)} / {fmtMM(netSize.glueTab)}
                  {netSize.hangTab ? ` / ${fmtMM(netSize.hangTab)}` : ""} mm
                </span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 판형을 못 골랐을 때 — 침묵하지 않는다.
          전개도가 어떤 판형에도 1개도 안 들어가면 sheetInfo·layout 이 둘 다 null 이라
          아래 판걸이 블록이 사라진다. 큰 대지 PDF 를 넣은 사용자는 그때 화면에서 아무
          신호도 못 받았다 — 무엇이 잘못됐는지 말해주는 것이 이 블록의 전부다.
          (판형이 있으면 아래 판형 캔버스가 전개도를 판 밖으로 걸쳐 그려 눈으로도 보여준다.
           판형이 "auto" 인데 후보가 0개면 그릴 판이 없으므로 여기서 글로만 알린다 —
           고르지 않은 판을 그려서 「이 판으로 견적이 났다」고 오해하게 만들지 않는다.) */}
      {!sheetInfo && netSize?.netW > 0 && (
        <div style={{background:"#2a1a00",border:"1px solid #664400",borderRadius:4,
                     padding:"8px 10px",fontSize:10,color:"#ffaa44",lineHeight:1.8}}>
          ✕ 전개도 <strong style={{fontFamily:"monospace"}}>{fmtMM(netSize.netW)}×{fmtMM(netSize.netH)}mm</strong> 가
          {" "}<strong>어떤 판형에도 1개도 안 들어간다</strong> — 그래서 판걸이·R수·지대가 계산되지 않았다.
          <div style={{color:"#cc8844",fontSize:9,marginTop:2}}>
            인쇄기 최대 {PRESS_MAX_LONG}×{PRESS_MAX_SHORT}mm 다. 규격을 확인하거나,
            2up 대지 PDF 를 넣었다면 위 후보 드롭다운에서 <b>판 1개</b>를 골라라.
          </div>
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
              발자국 {layout.footPct}% · 상한 {MAX_FOOT_PCT}%
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

      {/* 판형 캔버스 — 판 + 물림 + 자. 얹힌 것(layout·PDF 칼선)은 소유하지 않고 넘겨만 준다 */}
      {canvasSheet && (
        <div style={{marginTop:8}}>
          <Toggle checked={s.showSheet} onChange={v=>u("showSheet",v)} label="판형 캔버스 (판·물림·자)"/>

          {/* ── 손배치 모드 ─────────────────────────────────────────────
              켜면 앉힌 개수가 그대로 up 이 되고 지대R·금액이 따라 움직인다.
              끄면 자동 판걸이로 되돌아간다(handPrev 복원). */}
          <div style={{marginTop:4}}>
            <Toggle checked={handOn} onChange={v=>v ? enterHand() : exitHand()}
              label="손배치 (마우스 드래그 · NFP 스냅)"/>
          </div>

          {handOn && (
            <div style={{background:"#0a1020",border:"1px solid #24344e",borderRadius:4,
                         padding:"6px 8px",marginTop:5,fontSize:9,color:"#8899bb",lineHeight:1.7}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:6}}>
                <span>앉힌 개수 <strong style={{color:"#ffcc44"}}>{(s.placement||[]).length} up</strong>
                  <span style={{color:"#556680"}}> → 견적 판걸이</span></span>
                <span style={{display:"flex",gap:3}}>
                  <button type="button" onClick={savePlacement}
                    style={{background:"#16283f",border:"1px solid #2a3a5a",borderRadius:3,
                            color:"#a8c8e8",fontSize:8.5,padding:"2px 6px",cursor:"pointer"}}>배치 저장</button>
                  <button type="button" onClick={()=>plcRef.current?.click()}
                    style={{background:"#16283f",border:"1px solid #2a3a5a",borderRadius:3,
                            color:"#a8c8e8",fontSize:8.5,padding:"2px 6px",cursor:"pointer"}}>불러오기</button>
                  <input ref={plcRef} type="file" accept="application/json,.json" style={{display:"none"}}
                    onChange={e=>{ const f=e.target.files?.[0]; e.target.value=""; loadPlacement(f); }}/>
                </span>
              </div>
              {/* 판을 못 박았다는 사실을 숨기지 않는다 — 자동 선택이 멈춘 이유다 */}
              {s.handPrev?.sheetId === "auto" && (
                <div style={{color:"#66889f"}}>
                  판형을 <strong style={{color:"#a8c8e8"}}>{canvasSheet.label || canvasSheet.id}</strong> 로 고정했다
                  (손배치는 판이 고정돼야 좌표가 뜻을 갖는다). 끄면 자동으로 되돌아간다.
                </div>
              )}
              {!handPart && (
                <div style={{color:"#ffaa44"}}>⚠ 앉힐 도형이 없다 — 규격을 먼저 넣어라</div>
              )}
              {plcMsg && <div style={{color:"#ffd08a"}}>{plcMsg}</div>}
            </div>
          )}

          {s.showSheet && (
            // 3단계 이음새 ②③④ 가 여기 한 줄이다. hand 를 주면 캔버스가 조작면이 되고,
            // 안 주면(=null) 도메인이 푼 layout.boxes 를 그리는 1·2단계 상태로 정확히 돌아간다.
            <SheetCanvas sheet={canvasSheet} layout={layout} dieline={dieline} pdf={pdfOverlay}
              note={canvasNote}
              hand={handOn && handPart ? {
                part: handPart,
                items: s.placement || [],
                onCommit: commitPlacement,
                onUndo: undoPlacement,
                canUndo: undo.length > 0,
                source: handSrc === "pdf" ? "PDF 칼선" : "구조 전개도",
                sourceNote: handSrc === "pdf"
                  ? `${pdf?.source || ""} · 후보 ${(pdf?.pickIdx ?? 0) + 1}`
                  : (dieline?.polygon ? "폴리곤 확정 구조" : "폴리곤 미확정 → 직사각 1조각"),
              } : null}/>
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
          {s.showNet && <NetDiagram dieline={dieline} H={H}/>}
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
  );
}

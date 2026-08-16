// ══════════════════════════════════════════════════════════════════
//  ShowroomPage.jsx — 전시회 부스에서 **고객에게 보여주는** 한 화면.
//
//  실무용 견적 앱(App.jsx 좌7섹션 + 견적서)과 목적이 다르다. 여기서 보여줄 것은 셋뿐이다:
//    ① 진짜 도면이 판 위에 **실제로 어떻게 앉는지** (겹치지 않는 칼선 윤곽)
//    ② 몇 개 앉는지 (up)
//    ③ 그래서 개당 얼마인지
//  그 외의 것 — 발자국%·세대수·seed·flipRule·물림 띠·후보 점수 — 은 **전면에 두지 않는다.**
//  고객은 그 숫자를 못 읽고, 읽으려는 순간 대화가 우리 내부 사정으로 끌려간다.
//
//  깔끔함의 규칙 (지키지 않으면 이 화면의 존재 이유가 사라진다)
//  ────────────────────────────────────────────────────
//   · 색은 **잉크 한 색 + 강조 한 색**. 칸마다 다른 색을 칠하지 않는다(LayoutViz 반면교사).
//   · 칸 위에 배지·번호를 붙이지 않는다. 선택은 테두리 하나로 말한다.
//   · 채우기 없음. 판은 흰 종이, 도형은 얇은 검은 선. 실제 인쇄물이 그렇게 생겼다.
//
//  ★ 겹침은 **절대 그리지 않는다.**
//    그릴 배치는 전부 showroom-core.auditItems 를 통과해야 한다(commit 이 게이트다).
//    드래그 미리보기도 마찬가지 — resolveDrop 이 ok 를 안 주면 **마지막으로 성립한
//    자리**에 머문다. 겹친 그림을 잠깐이라도 보여주지 않는다.
//
//  기하는 한 줄도 여기 없다. 스냅·겹침은 ui/viz/nest-drag.mjs, 자동 배치는
//  nest-free.mjs, 판은 imposition.printableArea, 단가는 domain/quote.buildQuote 다.
//  이 파일은 **그리기와 포인터**만 한다.
// ══════════════════════════════════════════════════════════════════
import { useEffect, useMemo, useRef, useState } from "react";
import { buildQuote } from "../domain/quote.mjs";
import { findSheetBase, resolveSheet, PRESS_MAX_LONG, PRESS_MAX_SHORT } from "../domain/data/sheets.mjs";
import { readDielineFile } from "../domain/pdf-dieline.mjs";
// 「고른 후보 → 그 후보의 polygons」 규칙은 state.mjs 가 소유한다 (두 벌 중 어느 쪽이
// 정답인지 아는 곳은 한 군데여야 한다 — ARCHITECTURE §10). 쇼룸도 같은 함수를 부른다.
import { pdfPickOf } from "../ui/state.mjs";
import { BOX_TYPES } from "../ui/box-types.mjs";
import { resolveDrop, findSpot, itemW, itemH, SNAP_PX } from "../ui/viz/nest-drag.mjs";
import {
  SHEET_CHOICES, frameOf, partOf, auditItems, autoPlace, fillMore,
  quoteInputOf, seedOf, precisionKeyOf, T, LANGS,
} from "./showroom-core.mjs";

// ── 색 · 치수 ──────────────────────────────────────────────────────
const C = {
  bg: "#eceff3", panel: "#ffffff", line: "#dde2e9", soft: "#f5f7fa",
  ink: "#11161d", sub: "#6a7280", faint: "#aab2bd",
  acc: "#0b62d6", accBg: "#eaf1fd", bad: "#c0362c", warn: "#a15c07",
};
const FONT = "'Segoe UI','Noto Sans KR','Noto Sans JP',sans-serif";
/** 클릭과 드래그를 가르는 거리(mm 환산 전 화면 px) */
const DRAG_MIN_PX = 2;
const UNDO_MAX = 30;

const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const int = v => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
const mm1 = v => String(Math.round(v * 10) / 10);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// ══════════════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════════════
export default function ShowroomPage() {
  const [lang, setLang] = useState("ko");
  const t = T(lang);

  // ── 입력 (항목을 최소로) ────────────────────────────────────────
  const [srcMode, setSrcMode] = useState("box");        // "box" | "pdf"
  const [boxType, setBoxType] = useState("glue_3side");
  const [bW, setBW] = useState("140");
  const [bD, setBD] = useState("43");
  const [bH, setBH] = useState("130");
  const [pdfDl, setPdfDl] = useState(null);             // readDieline 결과 + page/pickIdx
  const [sheetId, setSheetId] = useState("auto");
  const [qty, setQty] = useState("4000");

  // ── 배치 ────────────────────────────────────────────────────────
  const [items, setItems] = useState(null);             // 확정 배치 (null = 아직 안 앉힘)
  const [hand, setHand] = useState(false);
  const [sel, setSel] = useState(null);
  const [undo, setUndo] = useState([]);
  const [autoInfo, setAutoInfo] = useState(null);
  const [busy, setBusy] = useState("");                 // "" | "pdf" | "auto" | "fill"
  const [msg, setMsg] = useState("");
  const [prev, setPrev] = useState(null);               // 드래그 미리보기
  const [dropping, setDropping] = useState(false);

  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const fileRef = useRef(null);
  const keptFile = useRef(null);

  // ── 도면 ────────────────────────────────────────────────────────
  const pick = useMemo(() => (srcMode === "pdf" ? pdfPickOf({ pdfDl }) : null), [srcMode, pdfDl]);
  const spec = useMemo(() => ({
    mode: srcMode, boxType, W: num(bW), D: num(bD), H: num(bH),
    netW: pick?.bbox?.w ?? 0, netH: pick?.bbox?.h ?? 0, qty: int(qty),
  }), [srcMode, boxType, bW, bD, bH, pick, qty]);

  // ── 견적 호출 2회 ────────────────────────────────────────────────
  //  ① qAuto : up 을 안 주고 부른다 → 도메인이 **판형을 고르고** 격자 배치를 푼다.
  //            그 판이 곧 화면에 그리는 판이고, 격자해는 자동 배치의 비교 대상이다.
  //  ② qShow : 앉힌 개수를 overrides.up 으로 넣어 부른다 → 그 up 의 지대R·단가.
  //  App.jsx 는 buildQuote 를 1회만 부르지만(성능 규율), 여기는 「판을 고르는 호출」과
  //  「내가 앉힌 up 으로 다시 재는 호출」이 원리적으로 둘이다. 둘 다 useMemo 로 묶는다.
  const qAuto = useMemo(() => {
    try { return buildQuote(quoteInputOf({ ...spec, sheetId, up: 0 })); }
    catch (e) { console.error(e); return null; }
  }, [spec, sheetId]);

  const sheetBase = useMemo(() => {
    const id = sheetId !== "auto" ? sheetId : (qAuto?.sheet?.id || null);
    return id ? findSheetBase(id) : null;
  }, [sheetId, qAuto?.sheet?.id]);
  const frame = useMemo(() => (sheetBase ? frameOf(resolveSheet(sheetBase, null)) : null), [sheetBase]);

  // 부품(충돌 도형 + 그릴 윤곽). dieline 은 **key** 로 의존한다 — 참조로 걸면 글자 한 자
  // 칠 때마다 NFP 사전계산(조각²)이 다시 돈다 (BoxSpec.handPart 와 같은 이유).
  const dlKey = qAuto?.dieline?.key || "";
  const part = useMemo(() => {
    if (srcMode === "pdf") return pick ? partOf({ kind: "pdf", pick }) : null;
    return qAuto?.dieline ? partOf({ kind: "box", dieline: qAuto.dieline }) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [srcMode, pick, dlKey]);

  // 도형이나 판이 바뀌면 앉힌 배치는 **뜻을 잃는다**(좌표가 다른 판의 좌표가 된다).
  // 조용히 남겨두면 옛 배치의 up 으로 새 도형의 단가가 나간다 — 지우고 다시 앉히게 한다.
  const resetKey = `${srcMode}|${dlKey}|${pick?.bbox?.w ?? 0}x${pick?.bbox?.h ?? 0}` +
                   `|${pdfDl?.pickIdx ?? 0}|${pdfDl?.page ?? 0}|${sheetBase?.id ?? ""}`;
  useEffect(() => {
    setItems(null); setHand(false); setSel(null); setUndo([]); setAutoInfo(null); setMsg("");
  }, [resetKey]);

  const up = items?.length || 0;
  const qShow = useMemo(() => {
    if (!(up > 0) || !sheetBase) return null;
    try { return buildQuote(quoteInputOf({ ...spec, sheetId: sheetBase.id, up })); }
    catch (e) { console.error(e); return null; }
  }, [spec, sheetBase?.id, up]);

  // ★ 그리기 게이트 — 확정 배치가 겹치거나 판 밖이면 **그리지 않는다.**
  //   commit 이 이미 막지만, 그리는 자리에서 한 번 더 재는 것이 이 화면의 계약이다.
  const audit = useMemo(() => (part && frame && items
    ? auditItems(part.P, items, frame) : null), [part, frame, items]);
  const drawable = !items || (audit?.ok ?? false);
  const drawItems = (prev?.items || items || []);

  // ── 배치 확정 (겹치면 안 받는다) ─────────────────────────────────
  const commit = (next, failMsg) => {
    if (!part || !frame) return false;
    const a = auditItems(part.P, next, frame);
    if (!a.ok) { setMsg(failMsg || t.overlapRefused); return false; }
    setUndo(u => [...u.slice(-(UNDO_MAX - 1)), items ?? []]);
    setItems(next); setMsg("");
    return true;
  };

  const doUndo = () => {
    let back;
    setUndo(u => { if (!u.length) return u; back = u[u.length - 1]; return u.slice(0, -1); });
    if (back === undefined) return;
    setItems(back); setSel(null); setMsg("");
  };

  // ── PDF ─────────────────────────────────────────────────────────
  const loadPdf = async (file, page = 0) => {
    if (!file || busy) return;
    setBusy("pdf"); setMsg("");
    try {
      const r = await readDielineFile(file, { page });
      keptFile.current = file;
      // 1순위(chosen)를 기본 선택으로 — BoxSpec.loadPdf 와 **같은 규칙**이다.
      const idx = Math.max(0, (r.candidates || []).findIndex(c => c.chosen));
      setPdfDl({ ...r, page, pickIdx: idx });
      setSrcMode("pdf");
    } catch (e) {
      // 조용히 무시하면 「드롭이 안 먹었다」로 읽힌다. 이유를 그대로 남긴다.
      setPdfDl(null);
      setMsg(`✕ ${file.name} — ${e?.message || String(e)}`);
    } finally { setBusy(""); }
  };

  // ── 자동 배치 ────────────────────────────────────────────────────
  //  ⚠ 자동 재계산 금지 — 버튼으로만 돈다. 입력이 바뀌면 배치가 지워질 뿐이다.
  const runAuto = () => {
    if (!part || !frame) { setMsg(t.needDraw); return; }
    setBusy("auto"); setMsg("");
    // 진행 표시를 **먼저 그리게** 한 뒤 계산한다. 같은 프레임에서 돌리면
    // 「계산 중…」이 화면에 뜨지 않고 브라우저만 멈춰 보인다.
    setTimeout(() => {
      let r = null;
      try { r = autoPlace(part.P, frame, qAuto?.layout?.up > 0 ? qAuto.layout.boxes : []); }
      catch (e) { console.error(e); }
      setBusy("");
      if (!r) { setMsg(t.overlapRefused); return; }
      setAutoInfo(r);
      setSel(null); setUndo([]);
      if (!r.up) { setItems([]); setMsg(r.rejected ? t.overlapRefused : t.noFit); return; }
      setItems(r.items); setMsg("");
    }, 24);
  };

  const runFill = () => {
    if (!part || !frame || !items?.length) return;
    setBusy("fill"); setMsg("");
    setTimeout(() => {
      let r = null;
      try { r = fillMore(part.P, frame, items); } catch (e) { console.error(e); }
      setBusy("");
      if (!r || !r.ok || !r.added) { setMsg(t.addedNone); return; }
      setUndo(u => [...u.slice(-(UNDO_MAX - 1)), items]);
      setItems(r.items); setMsg(t.addedN(r.added));
    }, 24);
  };

  // ── 손배치 ───────────────────────────────────────────────────────
  const enterHand = () => {
    if (!part || !frame) { setMsg(t.needDraw); return; }
    if (!items) {
      // 씨앗은 자동 격자해 → 없으면 한 장. 한 장도 안 들어가면 켜지 않는다.
      const seed = seedOf(qAuto?.layout?.up > 0 ? qAuto.layout.boxes : []);
      if (seed.length) setItems(seed);
      else {
        const proto = { x: 0, y: 0, flipped: false, rotated: false };
        const spot = findSpot(part.P, proto, [], { w: frame.fitW, h: frame.fitH }, { x: 0, y: 0 });
        if (!spot) { setMsg(t.noFit); return; }
        setItems([{ ...proto, ...spot }]);
      }
    }
    setHand(true); setMsg(t.hintHand);
  };

  const addOne = () => {
    if (!part || !frame) return;
    const base = items || [];
    const proto = base.length ? { ...base[base.length - 1] } : { x: 0, y: 0, flipped: false, rotated: false };
    const spot = findSpot(part.P, proto, base, { w: frame.fitW, h: frame.fitH }, { x: 0, y: 0 });
    if (!spot) { setMsg(t.noRoom); return; }   // 아무 데나 겹쳐 놓지 않는다
    if (commit([...base, { ...proto, ...spot }])) setSel(base.length);
  };

  const turn = deg90 => {
    if (sel == null || !items?.[sel]) return;
    const next = items.map((o, i) => (i !== sel ? o
      : deg90 ? { ...o, rotated: !o.rotated } : { ...o, flipped: !o.flipped }));
    commit(next, t.blocked);
  };

  const del = () => {
    if (sel == null || !items?.[sel]) return;
    const next = items.filter((_, i) => i !== sel);
    setSel(null);
    commit(next);
  };

  const reset = () => {
    setItems(null); setHand(false); setSel(null); setUndo([]); setAutoInfo(null); setMsg("");
  };

  // ── 포인터 → mm (viewBox 좌표) ───────────────────────────────────
  //  getScreenCTM 의 역행렬을 쓴다. 화면 비율·레터박스·CSS 확대와 무관하게 정확하다
  //  (rect 비율로 나누는 방식은 preserveAspectRatio 여백에서 어긋난다).
  const at = e => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM?.();
    if (!m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y, pxPerMM: Math.abs(m.a) || 1 };
  };

  const onDown = (e, i) => {
    if (!hand || !items?.[i]) return;
    e.preventDefault();
    const p = at(e); if (!p) return;
    setSel(i); setMsg("");
    dragRef.current = { i, sx: p.x, sy: p.y, base: items.map(o => ({ ...o })),
                        moved: false, last: null, items: null };
    try { svgRef.current?.setPointerCapture?.(e.pointerId); } catch { /* 마우스 없는 환경 */ }
    svgRef.current?.focus?.();
  };

  const onMove = e => {
    const d = dragRef.current;
    if (!d || !hand || !part || !frame) return;
    const p = at(e); if (!p) return;
    const dx = p.x - d.sx, dy = p.y - d.sy;
    if (!d.moved && Math.hypot(dx, dy) * p.pxPerMM < DRAG_MIN_PX) return;
    d.moved = true;
    const src = d.base[d.i];
    const others = d.base.filter((_, k) => k !== d.i);
    const w = itemW(part.P, src), h = itemH(part.P, src);
    // ① 판 안으로 먼저 가둔다 — resolveDrop 은 스냅만 하고 가두지 않는다.
    const x = clamp(src.x + dx, 0, Math.max(0, frame.fitW - w));
    const y = clamp(src.y + dy, 0, Math.max(0, frame.fitH - h));
    // ② NFP 접점으로 흡착. 스냅 반경은 **화면 거리**로 잡는다(작게 그린 판에서도 감이 일정).
    const r = resolveDrop(part.P, { ...src, x, y }, others,
                          { snap: SNAP_PX / p.pxPerMM, bounds: { w: frame.drawW, h: frame.drawH } });
    const inSheet = r.x >= -1e-6 && r.y >= -1e-6 &&
                    r.x + w <= frame.fitW + 1e-6 && r.y + h <= frame.fitH + 1e-6;
    // ★ 성립하지 않는 자리는 **그리지 않는다.** 마지막으로 성립한 자리에 머문다 —
    //   겹친 그림을 한 프레임도 보여주지 않기 위해서다.
    if (r.ok && inSheet) d.last = { x: r.x, y: r.y };
    const pos = d.last || { x: src.x, y: src.y };
    d.items = d.base.map((o, k) => (k === d.i ? { ...o, x: pos.x, y: pos.y } : o));
    setPrev({ items: d.items, blocked: !(r.ok && inSheet) });
  };

  const onUp = e => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setPrev(null);
    try { svgRef.current?.releasePointerCapture?.(e.pointerId); } catch { /* 무해 */ }
    if (!d.moved) return;                       // 클릭 = 고르기만
    if (!d.last) { setMsg(t.blocked); return; }
    commit(d.items);
  };

  const onKey = e => {
    if (!hand) return;
    const k = e.key, low = k.length === 1 ? k.toLowerCase() : k;
    if ((e.ctrlKey || e.metaKey) && low === "z") { e.preventDefault(); doUndo(); return; }
    if (k === "Delete" || k === "Backspace") { e.preventDefault(); del(); return; }
    if (low === "r") { e.preventDefault(); turn(!e.shiftKey); return; }
    if (k === "Escape") { e.preventDefault(); setSel(null); }
  };

  // ── 표시값 ───────────────────────────────────────────────────────
  const perEA = qShow?.totals?.perEA ?? null;
  const sheetLabel = frame ? (frame.sheet.label || frame.sheet.id).trim() : "";
  const netW = part?.w ?? 0, netH = part?.h ?? 0;
  const gain = autoInfo && autoInfo.via === "free" && autoInfo.freeUp > autoInfo.gridUp
    ? t.gain(autoInfo.gridUp, autoInfo.freeUp) : null;

  // ══════════════════════════════════════════════════════════════
  return (
    // 드롭은 **화면 어디에나** 받는다 (부스에서 파일을 정확한 상자에 떨구게 하지 않는다).
    // onDragOver 의 preventDefault 가 없으면 브라우저가 파일을 새 탭으로 열어버린다.
    <div data-showroom="1" onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); setDropping(false); loadPdf(e.dataTransfer?.files?.[0]); }}
      style={{ height: "100vh", display: "flex", flexDirection: "column", background: C.bg,
               color: C.ink, font: `14px ${FONT}`, overflow: "hidden" }}>

      {/* ── 머리 ─────────────────────────────────────────────────── */}
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "0 20px",
                       height: 52, background: C.panel, borderBottom: `1px solid ${C.line}`, flexShrink: 0 }}>
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: ".02em" }}>{t.title}</div>
        <div style={{ flex: 1 }}/>
        <div style={{ display: "flex", gap: 2 }}>
          {LANGS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => setLang(id)} data-lang={id}
              style={{ ...tabStyle(lang === id), fontSize: 12, padding: "4px 10px" }}>{label}</button>
          ))}
        </div>
        {/* 해시를 비우면 브라우저마다 hashchange 가 안 뜨는 경우가 있다 —
            **다른 해시**로 바꿔서 App 의 라우터가 확실히 깨어나게 한다. */}
        <button type="button" data-act="back" onClick={() => { window.location.hash = "#/"; }}
          style={{ border: "none", background: "none", cursor: "pointer",
                   fontSize: 12, color: C.sub, font: `12px ${FONT}` }}>{t.back} →</button>
      </header>

      <main style={{ flex: 1, display: "flex", minHeight: 0 }}>

        {/* ══ 왼쪽 — 입력 ══════════════════════════════════════════ */}
        <aside style={{ width: 292, flexShrink: 0, background: C.panel, borderRight: `1px solid ${C.line}`,
                        padding: 18, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>

          {/* 도면 */}
          <section>
            <Label>{t.draw}</Label>
            <div style={{ display: "flex", gap: 2, marginBottom: 10 }}>
              <button type="button" onClick={() => setSrcMode("pdf")} data-tab="pdf"
                style={{ ...tabStyle(srcMode === "pdf"), flex: 1 }}>{t.pdf}</button>
              <button type="button" onClick={() => setSrcMode("box")} data-tab="box"
                style={{ ...tabStyle(srcMode === "box"), flex: 1 }}>{t.dims}</button>
            </div>

            {srcMode === "pdf" ? (
              <>
                <div data-drop="1" onClick={() => fileRef.current?.click()}
                  onDragOver={e => { e.preventDefault(); setDropping(true); }}
                  onDragLeave={() => setDropping(false)}
                  style={{ border: `1.5px dashed ${dropping ? C.acc : C.line}`,
                           background: dropping ? C.accBg : C.soft, borderRadius: 8,
                           padding: "18px 12px", textAlign: "center", cursor: "pointer",
                           fontSize: 12.5, color: dropping ? C.acc : C.sub, lineHeight: 1.7 }}>
                  {busy === "pdf" ? t.reading : <>{t.drop}<br/><span style={{ color: C.faint }}>{t.pick}</span></>}
                </div>
                <input ref={fileRef} type="file" accept="application/pdf,.pdf" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; loadPdf(f); }}/>
                {pdfDl && pick && (
                  <div style={{ marginTop: 10, fontSize: 12, color: C.sub, lineHeight: 1.8 }}>
                    <div style={{ color: C.ink, fontWeight: 600, wordBreak: "break-all" }}>{pdfDl.source}</div>
                    {pdfDl.pageCount > 1 && (
                      <Row label={t.page}>
                        <Select value={String(pdfDl.page ?? 0)} onChange={v => loadPdf(keptFile.current, int(v))}
                          options={Array.from({ length: pdfDl.pageCount }, (_, i) => [String(i), `${i + 1} / ${pdfDl.pageCount}`])}/>
                      </Row>
                    )}
                    {/* 후보가 여럿이면 바꿀 수 있어야 한다 — 「가장 그럴듯한 것」이 늘 맞지는 않다.
                        점수·선분 같은 내부 수치는 빼고 **크기만** 보여준다(고객 앞이다). */}
                    {pdfDl.candidates?.length > 1 && (
                      <Row label={t.cand}>
                        <Select value={String(pdfDl.pickIdx ?? 0)}
                          onChange={v => setPdfDl(p => ({ ...p, pickIdx: int(v) }))}
                          options={pdfDl.candidates.map((c, i) =>
                            [String(i), `${mm1(c.bbox.w)} × ${mm1(c.bbox.h)}`])}/>
                      </Row>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <Select value={boxType} onChange={setBoxType}
                  options={BOX_TYPES.map(b => [b.id, b.label])}/>
                <div style={{ display: "flex", gap: 6 }}>
                  <Num label={t.w} value={bW} onChange={setBW}/>
                  <Num label={t.d} value={bD} onChange={setBD}/>
                  <Num label={t.h} value={bH} onChange={setBH}/>
                </div>
              </div>
            )}
          </section>

          {/* 도면 미리보기 — 판에 앉기 전의 「도면 한 장」 */}
          {part && <DrawPreview part={part} label={`${mm1(netW)} × ${mm1(netH)} mm`}/>}

          {/* 판형 */}
          <section>
            <Label>{t.sheet}</Label>
            <Select value={sheetId} onChange={setSheetId}
              options={[["auto", `${t.auto}${qAuto?.sheet ? ` · ${(qAuto.sheet.label || "").trim()}` : ""}`],
                        ...SHEET_CHOICES.map(b => [b.id, `${b.label.trim()}`])]}/>
          </section>

          {/* 수량 */}
          <section>
            <Label>{t.qty}</Label>
            <Num value={qty} onChange={setQty} suffix={t.ea} wide/>
          </section>

          <div style={{ flex: 1 }}/>
          <div style={{ fontSize: 10.5, color: C.faint, lineHeight: 1.7 }}>{t.specLine}</div>
        </aside>

        {/* ══ 오른쪽 — 판 · 결과 ═══════════════════════════════════ */}
        <section style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", padding: 18, gap: 12 }}>

          {/* 버튼 줄 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button type="button" data-act="auto" onClick={runAuto} disabled={!part || !!busy}
              style={btnStyle("primary", !!part && !busy)}>
              {busy === "auto" ? t.working : t.btnAuto}
            </button>
            <button type="button" data-act="hand" onClick={() => (hand ? setHand(false) : enterHand())}
              disabled={!part || !!busy} style={btnStyle(hand ? "on" : "ghost", !!part && !busy)}>
              {hand ? t.btnHandOff : t.btnHand}
            </button>
            <button type="button" data-act="reset" onClick={reset} disabled={!!busy}
              style={btnStyle("ghost", !busy)}>{t.btnReset}</button>

            {/* 손배치 도구 — 켰을 때만 나온다 */}
            {hand && (
              <div data-handbar="1" style={{ display: "flex", gap: 4, marginLeft: 4 }}>
                <button type="button" data-act="add" onClick={addOne} style={btnStyle("mini")}>{t.add}</button>
                <button type="button" data-act="rot" onClick={() => turn(true)} style={btnStyle("mini", sel != null)}
                  disabled={sel == null}>{t.rot}</button>
                <button type="button" data-act="flip" onClick={() => turn(false)} style={btnStyle("mini", sel != null)}
                  disabled={sel == null}>{t.flip}</button>
                <button type="button" data-act="del" onClick={del} style={btnStyle("mini", sel != null)}
                  disabled={sel == null}>{t.del}</button>
                <button type="button" data-act="fill" onClick={runFill} style={btnStyle("mini", !!items?.length && !busy)}
                  disabled={!items?.length || !!busy}>{busy === "fill" ? t.working : t.fill}</button>
                <button type="button" data-act="undo" onClick={doUndo} style={btnStyle("mini", undo.length > 0)}
                  disabled={!undo.length}>{t.undo}</button>
              </div>
            )}
            <div style={{ flex: 1 }}/>
            {gain && <span data-gain="1" style={chip(C.acc, C.accBg)}>{gain}</span>}
          </div>

          {/* 판 */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {frame ? (
              <Sheet
                innerRef={svgRef} frame={frame} part={part}
                items={drawable ? drawItems : []} sel={hand ? sel : null} hand={hand}
                blocked={!!prev?.blocked}
                onDown={onDown} onMove={onMove} onUp={onUp} onKey={onKey}
                onBlank={() => { setSel(null); setMsg(""); }}/>
            ) : (
              <div style={{ color: C.faint, fontSize: 13 }}>{t.needDraw}</div>
            )}
          </div>

          {/* 안내 · 경고 한 줄 */}
          <div style={{ minHeight: 18, fontSize: 12, color: msg ? C.warn : C.sub }} data-msg="1">
            {msg || (!items ? t.hintStart : hand ? t.hintHand : "")}
            {frame?.capped && !msg && (
              <span style={{ color: C.faint, marginLeft: 10 }}>
                {t.cappedNote(frame.sheet.w, frame.sheet.h, PRESS_MAX_LONG, PRESS_MAX_SHORT)}
              </span>
            )}
          </div>

          {/* ══ 결과 — 이 화면에서 **가장 큰 글씨** ══════════════════ */}
          <div data-result="1" data-up={up} data-perea={perEA ?? ""}
            style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10,
                     padding: "16px 22px", display: "flex", alignItems: "flex-end", gap: 34, flexWrap: "wrap" }}>
            <Big value={up > 0 ? String(up) : "—"} unit={t.up}/>
            <div style={{ width: 1, alignSelf: "stretch", background: C.line }}/>
            <Big value={perEA != null && up > 0 ? perEA.toLocaleString() : "—"} unit={t.won} pre={t.perEA}/>
            <div style={{ flex: 1 }}/>
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.9, textAlign: "right" }}>
              <div><span style={{ color: C.faint }}>{t.sheetSize}</span>{"  "}
                {sheetLabel} · {mm1(frame?.drawW ?? 0)} × {mm1(frame?.drawH ?? 0)} mm</div>
              <div><span style={{ color: C.faint }}>{t.netSize}</span>{"  "}
                {mm1(netW)} × {mm1(netH)} mm</div>
              <div><span style={{ color: C.faint }}>{t.qtyShort}</span>{"  "}
                {int(qty).toLocaleString()} {t.ea}</div>
            </div>
          </div>

          {/* 정밀도 한 줄 — 근사면 근사라고 적는다. 작게, 그러나 반드시 */}
          {part && (
            <div data-precision={part.P.mode} style={{ fontSize: 10.5, color: C.faint, lineHeight: 1.6 }}>
              {t[precisionKeyOf(part.P.mode)]}
              {autoInfo?.budgetHit && <span style={{ color: C.warn, marginLeft: 8 }}>· {t.budget}</span>}
              {!drawable && <span style={{ color: C.bad, marginLeft: 8 }}>· {t.overlapRefused}</span>}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
//  판 그림 — 흰 종이 위 얇은 칼선. 채우기도 배지도 없다.
// ══════════════════════════════════════════════════════════════════
//  ⚠ ref 를 그대로 받지 않고 innerRef prop 으로 받는다 — 함수 컴포넌트에 ref 를 걸면
//    React 가 경고만 내고 **조용히 null** 이 되어 드래그가 통째로 죽는다.
function Sheet({ innerRef, frame, part, items, sel, hand, blocked, onDown, onMove, onUp, onKey, onBlank }) {
  const M = Math.max(10, frame.drawW * 0.025);          // 판 둘레 여백(mm)
  const vw = frame.drawW + 2 * M, vh = frame.drawH + 2 * M;
  const P = part?.P;

  return (
    <svg ref={innerRef} data-sheet="1"
      viewBox={`${-M} ${-M} ${vw} ${vh}`}
      tabIndex={hand ? 0 : undefined} onKeyDown={hand ? onKey : undefined}
      onPointerMove={hand ? onMove : undefined}
      onPointerUp={hand ? onUp : undefined}
      onPointerCancel={hand ? onUp : undefined}
      style={{ width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%",
               outline: "none", touchAction: hand ? "none" : undefined,
               userSelect: hand ? "none" : undefined, cursor: hand ? "default" : undefined }}>

      {/* 판 = 인쇄기에 실제로 걸리는 면. 물림 띠는 그리지 않는다 —
          판걸이는 물림을 빼지 않으므로(ARCHITECTURE §5) 띠를 그리면 폐기된 방침을
          화면이 다시 주장하게 된다. 고객에게도 설명할 수 없는 표시다. */}
      <rect x={0} y={0} width={frame.drawW} height={frame.drawH}
        fill="#ffffff" stroke="#c3cad4" strokeWidth={1} vectorEffect="non-scaling-stroke"
        onPointerDown={hand ? onBlank : undefined}/>

      {items.map((it, i) => {
        const fw = itemW(P, it);
        const tf = `translate(${it.x},${it.y})` + (it.rotated ? ` translate(${fw},0) rotate(90)` : "");
        // 반전(180°)은 **전개도 로컬 중심** 기준이다. 회전(90°)을 먼저 걸고 그 안에서 돈다
        // — SheetCanvas.boxTf 와 **같은 식**이라 두 화면의 그림이 갈리지 않는다.
        const flip = it.flipped ? `rotate(180,${part.w / 2},${part.h / 2})` : undefined;
        const on = sel === i;
        return (
          <g key={i} data-cell={i} data-sel={on ? "1" : undefined} transform={tf}
            onPointerDown={hand ? (e => onDown(e, i)) : undefined}
            style={hand ? { cursor: "move" } : undefined}>
            {/* 히트영역. ⚠ fill 은 **"transparent"** 다 — "none" 은 히트테스트 대상이
                아니라서 핸들러를 달아도 칸이 안 잡힌다 (ARCHITECTURE §10 실측). */}
            <rect x={0} y={0} width={part.w} height={part.h}
              fill={on ? "rgba(11,98,214,0.06)" : "transparent"}
              stroke={on ? C.acc : "none"} strokeWidth={on ? 1.4 : 0}
              vectorEffect="non-scaling-stroke"/>
            <g transform={flip} fill="none" pointerEvents="none">
              {(part.folds || []).map((f, k) => (
                <polyline key={"f" + k} points={pts(f)} stroke="#d5dae1" strokeWidth={0.7}
                  strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>
              ))}
              {(part.cuts || []).map((c, k) => (
                <polyline key={"c" + k} points={pts(c)}
                  stroke={on ? C.acc : (blocked ? "#9aa3ae" : "#1b2129")} strokeWidth={on ? 1.15 : 0.9}
                  strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
              ))}
            </g>
          </g>
        );
      })}
    </svg>
  );
}
const pts = poly => poly.map(([x, y]) => `${x},${y}`).join(" ");

/** 왼쪽 도면 미리보기 — 판과 **같은 도형·같은 선**으로 그린다 */
function DrawPreview({ part, label }) {
  const M = Math.max(part.w, part.h) * 0.04;
  return (
    <section>
      <div style={{ border: `1px solid ${C.line}`, borderRadius: 8, background: C.soft, padding: 10 }}>
        <svg data-preview="1" viewBox={`${-M} ${-M} ${part.w + 2 * M} ${part.h + 2 * M}`}
          style={{ width: "100%", height: 112, display: "block" }}>
          <g fill="none">
            {(part.folds || []).map((f, k) => (
              <polyline key={"f" + k} points={pts(f)} stroke="#d5dae1" strokeWidth={0.7}
                strokeDasharray="4 3" vectorEffect="non-scaling-stroke"/>
            ))}
            {(part.cuts || []).map((c, k) => (
              <polyline key={"c" + k} points={pts(c)} stroke="#1b2129" strokeWidth={1}
                strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
            ))}
          </g>
        </svg>
        <div style={{ fontSize: 11.5, color: C.sub, textAlign: "center", marginTop: 4,
                      fontVariantNumeric: "tabular-nums" }}>{label}</div>
      </div>
    </section>
  );
}

// ══════════════════════════════════════════════════════════════════
//  작은 조각들 (이 화면 전용 — 다크 테마인 ui/primitives 와 섞지 않는다)
// ══════════════════════════════════════════════════════════════════
const Label = ({ children }) => (
  <div style={{ fontSize: 10.5, fontWeight: 700, color: C.faint, letterSpacing: ".14em",
                textTransform: "uppercase", marginBottom: 7 }}>{children}</div>
);

const Row = ({ label, children }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
    <span style={{ fontSize: 11.5, color: C.faint, width: 54, flexShrink: 0 }}>{label}</span>
    <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
  </div>
);

const Select = ({ value, onChange, options }) => (
  <select value={value} onChange={e => onChange(e.target.value)}
    style={{ width: "100%", boxSizing: "border-box", padding: "7px 8px", borderRadius: 6,
             border: `1px solid ${C.line}`, background: "#fff", color: C.ink,
             font: `13px ${FONT}`, cursor: "pointer" }}>
    {options.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
  </select>
);

const Num = ({ label, value, onChange, suffix, wide }) => (
  <label style={{ flex: 1, minWidth: 0, display: "block" }}>
    {label && <div style={{ fontSize: 11, color: C.faint, marginBottom: 3 }}>{label}</div>}
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <input value={value} inputMode="numeric" onChange={e => onChange(e.target.value)}
        style={{ width: "100%", minWidth: 0, boxSizing: "border-box", padding: "7px 8px",
                 borderRadius: 6, border: `1px solid ${C.line}`, background: "#fff", color: C.ink,
                 font: `${wide ? 15 : 13}px ${FONT}`, fontVariantNumeric: "tabular-nums" }}/>
      {suffix && <span style={{ fontSize: 12, color: C.faint }}>{suffix}</span>}
    </div>
  </label>
);

const Big = ({ value, unit, pre }) => (
  <div style={{ display: "flex", alignItems: "baseline", gap: 7 }}>
    {pre && <span style={{ fontSize: 13, color: C.sub }}>{pre}</span>}
    <span style={{ fontSize: 46, fontWeight: 700, lineHeight: 1, letterSpacing: "-.02em",
                   fontVariantNumeric: "tabular-nums" }}>{value}</span>
    <span style={{ fontSize: 15, color: C.sub, fontWeight: 600 }}>{unit}</span>
  </div>
);

const chip = (fg, bg) => ({ fontSize: 11.5, color: fg, background: bg, borderRadius: 999,
                            padding: "4px 11px", fontWeight: 600 });

const tabStyle = on => ({
  padding: "6px 10px", borderRadius: 6, cursor: "pointer", font: `12.5px ${FONT}`,
  border: `1px solid ${on ? C.acc : C.line}`, background: on ? C.accBg : "#fff",
  color: on ? C.acc : C.sub, fontWeight: on ? 700 : 500,
});

function btnStyle(kind, on = true) {
  const base = { borderRadius: 7, cursor: on ? "pointer" : "default", font: `13px ${FONT}`,
                 padding: "9px 18px", fontWeight: 600, whiteSpace: "nowrap",
                 opacity: on ? 1 : 0.45, transition: "background .12s" };
  if (kind === "primary") return { ...base, border: "1px solid transparent", background: C.acc, color: "#fff" };
  if (kind === "on")      return { ...base, border: `1px solid ${C.acc}`, background: C.accBg, color: C.acc };
  if (kind === "mini")    return { ...base, padding: "6px 10px", fontSize: 12, fontWeight: 500,
                                   border: `1px solid ${C.line}`, background: "#fff", color: C.sub };
  return { ...base, border: `1px solid ${C.line}`, background: "#fff", color: C.ink };
}

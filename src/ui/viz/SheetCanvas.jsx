// ══════════════════════════════════════════════════════════════════
//  SheetCanvas.jsx — 판형 캔버스. 판 한 장을 mm 자(ruler) 위에 그린다.
//                    + 3단계 **손배치 조작면**(마우스 드래그 · NFP 스냅 · 단축키).
//
//  담당은 셋뿐이다: ① 판(= 인쇄기에 걸리는 재단면) ② 물림 띠 ③ 자.
//  얹히는 **도형은 다른 파일이 소유한다** — 폴리곤 구조는 DielineShape 를 그대로
//  재사용하고, PDF 실측 칼선은 pdf.polygons 를 좌표 그대로 폴리라인으로 옮긴다.
//  배치는 layout.boxes 만 읽는다. 여기서 배치를 다시 풀지 않는다(LayoutViz 와 같은
//  규칙 — 그림이 통과시킨 배치와 실제 걸리는 배치가 갈리면 눈으로 잡을 방법이 없다).
//
//  **배치 상태를 소유하지 않는다.** 확정 배치·되돌리기 스택·견적 되먹임은 부모
//  (BoxSpec + state.mjs)가 갖고, 여기는 props 로 받아 그리고 조작 결과를 콜백으로 낸다.
//  로컬 state 3개(선택 / 드래그 중 미리보기 / 안내문)는 **값이 아니라 순간 UI** 라서
//  부모에 올리지 않는다 (BoxSpec 의 busy·drag 와 같은 기준).
//  ⚠ 드래그 미리보기를 부모 state 로 올리지 마라 — App 의 useMemo(input) 가 s 전체를
//    의존성으로 잡으므로 포인터 1회 이동마다 buildQuote 가 통째로 다시 돈다.
//
//  3단계(마우스 드래그 배치) 이음새 — 셋이 전부다:
//   ① 좌표 변환   px(mm) py(mm) sc(mm) · boxTf(box).  역변환은 (v - RULER) / scale.
//   ② 그릴 배치   hand.items > props.placement > layout.boxes 순.
//                 되돌림은 hand={null} · placement={null} 이다.
//   ③ 히트영역    <g data-cell={i}> 안의 rect 는 fill="transparent" 다 — 핸들러만 달면
//                 칸이 잡힌다. ⚠ fill="none" 으로 바꾸지 마라: "none" 은 히트테스트
//                 **대상이 아니고** "transparent" 는 대상이다. 종전에 "none" 이라
//                 칸 0 내부 81표본 중 4개만 잡혔고(그 4개도 rect 가 아니라 칸번호 text)
//                 나머지는 판 배경 rect 로 빠졌다 — 핸들러를 달아도 안 잡히는 상태였다.
//  계산으로의 되먹임은 여기가 아니다 — overrides.up(state 의 mUp/mUpV → quote.mjs 분기 ①)이
//  이미 있으므로 손배치의 up 은 부모가 그 통로로 흘린다. 도메인은 손대지 않는다.
//
//  기하는 **한 줄도 여기서 짜지 않는다** — 겹침·스냅·감사 전부 nest-drag.mjs 다.
//  솔버(nest)와 손배치가 다른 겹침 기준을 쓰면 「자동은 되는데 손으로는 안 되는」 자리가 생긴다.
// ══════════════════════════════════════════════════════════════════
import { useRef, useState } from "react";
import {
  BITE_LONG, BITE_SHORT, PRESS_MAX_LONG, PRESS_MAX_SHORT, effectiveSheet,
} from "../../domain/data/sheets.mjs";
// 판 경계 판정은 **도메인과 같은 정의**를 쓴다. 아래 fitB 주석 참조 —
// es.long 을 그대로 쓰면 자동 배치를 씨앗으로 앉힌 순간 「판 밖」 경고가 뜬다.
import { printableArea } from "../../domain/imposition.mjs";
import DielineShape from "./DielineShape.jsx";
import {
  resolveDrop, findSpot, boundsCheck, overlapPairs, auditPlacement,
  itemW, itemH, SNAP_PX, MAX_PIECES,
} from "./nest-drag.mjs";

const MAX_W = 278, MAX_H = 236;   // 좌패널 내용폭(310 − padding 28) 안에 들어가는 크기
const RULER = 20, PAD_R = 12;     // 자 눈금 여백 / 반대쪽 여백

/** 폴리곤 상한. 넘으면 자르되 **잘랐다는 사실을 반드시 알린다** —
 *  일부가 빠진 그림을 맞는 그림으로 오해하는 것이 상한보다 위험하다.
 *  실측 3건은 소스코 10 · 웨이크버니 58 · iSHAP 176 이라 걸리지 않는다. */
const POLY_MAX = 2000;

/** 클릭과 드래그를 가르는 화면 거리(px). 이보다 덜 움직이면 「고르기」다. */
const DRAG_MIN_PX = 2;
/** 되돌리기 스택 깊이. 배치 1개 = 4필드라 50벌은 수 KB 다. */
const UNDO_MAX = 50;

const btn = (on = true) => ({
  background: on ? "#16283f" : "#101a28", border: `1px solid ${on ? "#2a3a5a" : "#1a2436"}`,
  borderRadius: 3, color: on ? "#a8c8e8" : "#48566a", fontSize: 8.5, padding: "2px 6px",
  cursor: on ? "pointer" : "default", whiteSpace: "nowrap",
});

export default function SheetCanvas({ sheet, layout, dieline, pdf, placement, note, hand }) {
  // ── 로컬 = 순간 UI 셋뿐 (파일 머리 참조) ─────────────────────────
  const [sel,  setSel]  = useState(() => new Set());   // 선택 인덱스
  const [prev, setPrev] = useState(null);              // 드래그 중 임시 배치 {items, ok}
  const [msg,  setMsg]  = useState("");                // 거절 사유·감사 결과
  const [focus, setFocus] = useState(false);           // 단축키가 먹는 상태인지
  const dragRef = useRef(null);                        // 제스처 손잡이 (값이 아니다)
  const svgRef  = useRef(null);

  // ⚠ 훅은 이 가드보다 **위**에 있어야 한다 (조건부 훅 금지).
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
  //   재현이 7/12 → 1/12 로 무너진다(ARCHITECTURE §5). 그래서 **자동** 배치가 이 띠를
  //   덮어도 경고하지 않는다. 경고를 붙이면 화면이 폐기된 방침을 다시 주장하게 된다.
  //   손배치에만 붙는 작업자용 표시는 아래 bchk.bite 다 (nest-drag.boundsCheck 주석).
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

  // ── 손배치 ──────────────────────────────────────────────────────
  const P = hand?.part || null;
  const handOn = !!(P && hand?.items);
  const hItems = handOn ? (prev?.items || hand.items) : null;

  // 스냅 타깃은 **눈에 보이는 판 가장자리**(es), 판 밖 판정은 **도메인 정의**(printW/printH).
  // 둘을 하나로 합치면 어느 쪽이든 틀린다:
  //  · 판정에 es 를 쓰면 → printableArea 가 FIT_TOL(0.005) 만큼 여유를 주므로
  //    (삼면E 실측 265.0 vs 공식 268.0) 자동 배치를 씨앗으로 앉힌 순간 「판 밖」이 뜬다.
  //  · 스냅에 printW 를 쓰면 → 그려진 판 테두리보다 몇 mm 밖에 흡착된다.
  const pa   = printableArea(sheet);
  const snapB = { w: es.long,   h: es.short,   biteX, biteY };
  const fitB  = { w: pa.printW, h: pa.printH,  biteX, biteY };

  // ── 얹는 것 ─────────────────────────────────────────────────────
  // ★ 3단계 이음새 ② — 그릴 배치를 **외부에서 갈아끼울 수 있다.**
  //   hand.items(조작 중) > placement(읽기전용) > 도메인이 푼 layout.boxes 순.
  //   왜 파생이 아니라 prop 인가: 손으로 옮긴 배치를 그리려면 호출부가 layout 객체를
  //   위조해야 했고, layout.up === 0 이면 칸이 0개라 손배치를 시작할 발판조차 없었다
  //   (그게 바로 손배치가 가장 필요한 상태다).
  const solved = layout?.up > 0 ? (layout.boxes || []) : [];
  //  손배치 배치 1개는 {x,y,flipped,rotated} 뿐이다 — 발자국 w/h 는 부품에서 나온다
  //  (itemW/itemH). 배열에 w/h 를 같이 저장하면 90° 회전 때 두 벌이 갈린다.
  const boxes = handOn
    ? hItems.map(it => ({ x: it.x, y: it.y, w: itemW(P, it), h: itemH(P, it),
                          rotated: !!it.rotated, flipped: !!it.flipped }))
    : (placement ?? solved);
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

  // 조각이 0개면 끌 대상이 없다(그림은 ghost 1개다) — 그때는 툴바 「+ 추가」가 발판이다.
  const dragOK = handOn && !ghost;
  // 인덱스는 커밋으로 줄어들 수 있다(삭제·되돌리기). 렌더마다 잘라 쓴다.
  const selv = dragOK ? new Set([...sel].filter(i => i < hItems.length)) : new Set();
  // ⚠ 겹침·판밖 검사는 **손배치에만** 돌린다 (파일 머리 물림 주석).
  const bad  = dragOK ? overlapPairs(P, hItems) : null;
  const bchk = dragOK ? boundsCheck(P, hItems, fitB) : null;

  /** 화면 px → 판 mm. 역변환은 (v − RULER) / scale 하나다 (이음새 ①).
   *  CSS 로 늘어난 경우까지 맞추려고 실측 비율을 곱한다. */
  const toMM = e => {
    const r = svgRef.current.getBoundingClientRect();
    const kx = r.width  ? svgW / r.width  : 1;
    const ky = r.height ? svgH / r.height : 1;
    return [((e.clientX - r.left) * kx - RULER) / scale,
            ((e.clientY - r.top)  * ky - RULER) / scale];
  };

  const commit = (items, opt) => { setMsg(""); hand.onCommit(items, opt); };

  // ── 드래그 ──────────────────────────────────────────────────────
  const onDown = (e, i) => {
    if (!dragOK) return;
    e.preventDefault();
    svgRef.current?.focus?.();
    setMsg("");
    const addKey = e.shiftKey || e.ctrlKey || e.metaKey;
    let next;
    if (addKey) { next = new Set(selv); next.has(i) ? next.delete(i) : next.add(i); }
    else next = selv.has(i) ? new Set(selv) : new Set([i]);
    setSel(next);
    // 다중 선택 드래그: 대표 조각 i 를 스냅으로 확정하고 **그 변위를 선택 전체에** 준다.
    // 선택끼리의 상대 위치는 변하지 않으므로 선택 내부의 겹침 상태도 그대로다.
    dragRef.current = { i, start: toMM(e), base: hand.items.map(o => ({ ...o })),
                        sel: [...next], moved: false, ok: true, items: null };
    try { svgRef.current?.setPointerCapture?.(e.pointerId); } catch { /* 마우스 없는 환경 */ }
  };

  const onMove = e => {
    const d = dragRef.current;
    if (!d || !dragOK) return;
    const p = toMM(e);
    const dx = p[0] - d.start[0], dy = p[1] - d.start[1];
    if (!d.moved && Math.hypot(dx, dy) * scale < DRAG_MIN_PX) return;
    d.moved = true;
    const moving = new Set(d.sel);
    const others = d.base.filter((_, k) => !moving.has(k));
    const prim = d.base[d.i];
    // ★ 3단계의 핵심 가치 — 대충 끈 자리를 NFP 접점으로 흡착시킨다.
    //   겹쳐서 밀어낼 수도 없으면 ok:false → 빨간 표시 + 드롭 취소.
    const r = resolveDrop(P, { ...prim, x: prim.x + dx, y: prim.y + dy }, others,
                          { snap: SNAP_PX / scale, bounds: snapB });
    const ax = r.x - prim.x, ay = r.y - prim.y;
    d.items = d.base.map((o, k) => moving.has(k) ? { ...o, x: o.x + ax, y: o.y + ay } : o);
    d.ok = r.ok; d.snapped = r.snapped;
    setPrev({ items: d.items, ok: r.ok, snapped: r.snapped });
  };

  const onUp = e => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    try { svgRef.current?.releasePointerCapture?.(e.pointerId); } catch { /* 무해 */ }
    setPrev(null);
    if (!d.moved || !d.items) return;              // 클릭 = 고르기만
    if (!d.ok) { setMsg("그 자리는 겹친다 — 놓지 않았다 (되돌렸다)"); return; }
    commit(d.items);
  };

  // ── 단축키 대상 동작 (툴바 버튼과 같은 함수를 쓴다) ───────────────
  const proto = () => (hItems?.length ? hItems[hItems.length - 1]
                                      : { x: 0, y: 0, flipped: false, rotated: false });

  /** 새 도형 1개. 빈자리를 못 찾으면 **겹쳐 놓지 않고** 이유를 알린다. */
  const addOne = () => {
    if (!handOn) return;
    const base = hand.items;
    const pr = proto();
    const spot = findSpot(P, pr, base, fitB, { x: 0, y: 0 });
    if (!spot) { setMsg("판에 빈자리가 없다 — 추가하지 않았다"); return; }
    setSel(new Set([base.length]));
    commit([...base, { ...pr, x: spot.x, y: spot.y }]);
  };

  /** 복사 — 선택 하나하나에 빈자리를 찾아 앉힌다. 오른쪽(칼선 공유)을 먼저 본다. */
  const dup = () => {
    if (!dragOK || !selv.size) { setMsg("복사할 조각을 먼저 고르라"); return; }
    const out = hand.items.map(o => ({ ...o }));
    const added = [];
    for (const i of [...selv].sort((a, b) => a - b)) {
      const src = hand.items[i];
      const spot = findSpot(P, src, out, fitB, { x: src.x + itemW(P, src), y: src.y });
      if (!spot) continue;
      out.push({ ...src, x: spot.x, y: spot.y });
      added.push(out.length - 1);
    }
    if (!added.length) { setMsg("판에 빈자리가 없다 — 복사하지 않았다"); return; }
    setSel(new Set(added));
    commit(out);
  };

  const del = () => {
    if (!dragOK || !selv.size) { setMsg("삭제할 조각을 먼저 고르라"); return; }
    setSel(new Set());
    commit(hand.items.filter((_, i) => !selv.has(i)));
  };

  /**
   * R = 180° · Shift+R = 90°.
   *  180° 는 nest 의 N_op 쌍(점대칭)이라 2D 회전 180° 와 같은 것이고 발자국이 그대로다.
   *  90° 는 발자국이 w↔h 로 바뀌므로 제자리에서 이웃과 겹칠 수 있다.
   *  ⚠ 겹치면 **적용하지 않는다.** 겹친 채 두면 그 개수가 up 으로 흘러 견적이 틀린다.
   */
  const rot = deg90 => {
    if (!dragOK || !selv.size) { setMsg("회전할 조각을 먼저 고르라"); return; }
    const out = hand.items.map((o, i) => !selv.has(i) ? o
      : deg90 ? { ...o, rotated: !o.rotated } : { ...o, flipped: !o.flipped });
    if (overlapPairs(P, out).size > (bad?.size || 0)) {
      setMsg(`${deg90 ? "90°" : "180°"} 회전하면 이웃과 겹친다 — 적용하지 않았다`); return;
    }
    commit(out);
  };

  /** 화살표 미세이동 — 스냅으로 못 맞추는 자리를 손으로 여는 통로. */
  const nudge = (dx, dy) => {
    if (!dragOK || !selv.size) return;
    const out = hand.items.map((o, i) => !selv.has(i) ? o
      : { ...o, x: +(o.x + dx).toFixed(3), y: +(o.y + dy).toFixed(3) });
    if (overlapPairs(P, out).size > (bad?.size || 0)) { setMsg("그 방향은 겹친다"); return; }
    commit(out);
  };

  /** ★ 겹침 0 을 **NFP 가 아닌 방법**으로 확인한다 (격자 샘플링).
   *  NFP 결과를 NFP 로 확인하면 아무 의미가 없다 — verify-nest 머리말과 같은 철학. */
  const audit = () => {
    if (!dragOK) return;
    const a = auditPlacement(P, hItems, 0.5);
    setMsg(`겹침 감사 (격자 0.5mm 샘플링 · NFP 미사용): ${a.n}개 · 쌍 ${a.pairs} · ` +
           `최대 ${a.worst}mm² · 합 ${a.total}mm²` +
           (a.worst > 0 ? ` ← ✕ 겹친다 (칸 ${a.worstPair.map(v => v + 1).join("·")})` : " ← ✓ 겹침 0"));
  };

  const onKey = e => {
    if (!handOn) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const k = e.key, low = k.length === 1 ? k.toLowerCase() : k;
    if (ctrl && low === "z") { e.preventDefault(); if (!hand.onUndo?.()) setMsg("되돌릴 것이 없다"); else setMsg(""); return; }
    if (ctrl && low === "a") { e.preventDefault(); setSel(new Set(hand.items.map((_, i) => i))); setMsg(""); return; }
    if (ctrl && low === "d") { e.preventDefault(); dup(); return; }
    if (k === "Delete" || k === "Backspace") { e.preventDefault(); del(); return; }
    if (low === "r") { e.preventDefault(); rot(e.shiftKey); return; }
    if (k === "Escape") { e.preventDefault(); setSel(new Set()); setMsg(""); return; }
    const step2 = e.shiftKey ? 10 : 1;
    const arrow = { ArrowLeft: [-step2, 0], ArrowRight: [step2, 0],
                    ArrowUp: [0, -step2], ArrowDown: [0, step2] }[k];
    if (arrow) { e.preventDefault(); nudge(arrow[0], arrow[1]); }
  };

  /** 배치 1칸의 mm→svg 변환. 회전은 좌표를 다시 계산하지 않고 rotate(90) 으로 돌린다
   *  (좌표를 다시 만들면 축 불일치가 들어온다 — DielineShape 주석과 같은 이유).
   *  b.w 는 **앉힌 발자국 폭**이라 회전칸에서는 전개도 netH 다 → translate(b.w,0) 이
   *  LayoutViz 의 translate(netH,0) 과 같은 값이다. */
  const boxTf = b =>
    `translate(${px(b.x)},${py(b.y)}) scale(${scale})` +
    (b.rotated ? ` translate(${b.w},0) rotate(90)` : "");

  const cellStroke = i =>
    ghost ? "#ff9944"
    : bad?.has(i) ? "#ff4455"
    : bchk?.off.includes(i) ? "#ff9944"
    : selv.has(i) ? "#ffcc44"
    : "#3b82f6";

  return (
    <div style={{background:"#05111f",borderRadius:8,padding:"10px 8px",marginTop:8,border:"1px solid #1a3050"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:5,gap:6}}>
        <div style={{fontSize:9.5,fontWeight:800,color:"#4aaeff",letterSpacing:".1em",textTransform:"uppercase"}}>
          ▤ 판형 캔버스{handOn ? " · 손배치" : ""}
        </div>
        <div style={{fontSize:9,color:"#8899bb",textAlign:"right"}}>
          {sheet.label || sheet.id} · <span style={{fontFamily:"monospace",color:"#c8d8f0"}}>{rawLong}×{rawShort}</span>
        </div>
      </div>

      {/* ── 손배치 툴바 — 단축키와 **같은 함수**를 부른다 (경로가 갈리면 한쪽만 고쳐진다) */}
      {handOn && (
        <div data-hand-toolbar="1" style={{display:"flex",flexWrap:"wrap",gap:3,marginBottom:6}}>
          <button type="button" data-hand="add" onClick={addOne} style={btn()}>+ 추가</button>
          <button type="button" data-hand="dup" onClick={dup} style={btn(!!selv.size)}>복사 ^D</button>
          <button type="button" data-hand="rot180" onClick={()=>rot(false)} style={btn(!!selv.size)}>180° R</button>
          <button type="button" data-hand="rot90" onClick={()=>rot(true)} style={btn(!!selv.size)}>90° ⇧R</button>
          <button type="button" data-hand="del" onClick={del} style={btn(!!selv.size)}>삭제 Del</button>
          <button type="button" data-hand="all" onClick={()=>setSel(new Set(hand.items.map((_,i)=>i)))}
            style={btn(!!hand.items.length)}>전체 ^A</button>
          <button type="button" data-hand="undo" onClick={()=>{ if(!hand.onUndo?.()) setMsg("되돌릴 것이 없다"); }}
            style={btn(!!hand.canUndo)}>되돌리기 ^Z</button>
          <button type="button" data-hand="audit" onClick={audit} style={btn(dragOK)}>겹침 감사</button>
        </div>
      )}

      <svg ref={svgRef} width={svgW} height={svgH} tabIndex={handOn ? 0 : undefined}
        onKeyDown={handOn ? onKey : undefined}
        onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)}
        onPointerMove={dragOK ? onMove : undefined}
        onPointerUp={dragOK ? onUp : undefined}
        onPointerCancel={dragOK ? onUp : undefined}
        style={{display:"block",margin:"0 auto",outline:"none",
                touchAction: handOn ? "none" : undefined,
                userSelect: handOn ? "none" : undefined,
                boxShadow: handOn && focus ? "0 0 0 1px #4aaeff88" : undefined,
                borderRadius: 3}}>
        <defs>
          <pattern id="scBite" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="#ff444455" strokeWidth="2"/>
          </pattern>
          <pattern id="scCut" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="#66778855" strokeWidth="2"/>
          </pattern>
        </defs>

        {/* ① 원지 재단면 전체 — 빈 곳을 누르면 선택 해제 (칸은 형제라 이 핸들러를 안 탄다) */}
        <rect x={px(0)} y={py(0)} width={sc(rawLong)} height={sc(rawShort)}
          fill="#0d2035" stroke="#2a4060" strokeWidth={1.2} rx={2}
          onPointerDown={handOn ? (()=>{ svgRef.current?.focus?.(); setSel(new Set()); setMsg(""); }) : undefined}/>

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
        <rect x={px(0)} y={py(0)} width={sc(es.long)} height={sc(biteY)} fill="#ff000016" pointerEvents="none"/>
        <rect x={px(0)} y={py(0)} width={sc(es.long)} height={sc(biteY)} fill="url(#scBite)" pointerEvents="none"/>
        <rect x={px(0)} y={py(0)} width={sc(biteX)} height={sc(es.short)} fill="#ff000016" pointerEvents="none"/>
        <rect x={px(0)} y={py(0)} width={sc(biteX)} height={sc(es.short)} fill="url(#scBite)" pointerEvents="none"/>
        <line x1={px(0)} y1={py(biteY)} x2={px(es.long)} y2={py(biteY)}
          stroke="#ff5544" strokeWidth={.8} strokeDasharray="3 2.5" opacity={.75}/>
        <line x1={px(biteX)} y1={py(0)} x2={px(biteX)} y2={py(es.short)}
          stroke="#ff5544" strokeWidth={.8} strokeDasharray="3 2.5" opacity={.75}/>
        {sc(biteY) > 7 && (
          <text x={px(es.long / 2)} y={py(biteY / 2)} textAnchor="middle" dominantBaseline="middle"
            fontSize={7} fill="#ff7766" fontWeight={700} pointerEvents="none">물림 {biteY}mm (짧은치수)</text>
        )}

        {/* ③ 얹힌 배치 — 좌표·회전·반전 전부 hand.items(또는 placement / layout.boxes) 그대로.
               ⚠ 칸 rect 의 fill 은 **"transparent"** 다. "none" 은 히트테스트 대상이
                 아니어서 <g data-cell> 에 핸들러를 달아도 칸이 안 잡힌다 (파일 머리 ③). */}
        {cells.map((b, i) => (
          <g key={i} data-cell={i} data-ghost={ghost ? "1" : undefined}
            data-bad={bad?.has(i) ? "1" : undefined}
            data-sel={selv.has(i) ? "1" : undefined}
            onPointerDown={dragOK ? (e => onDown(e, i)) : undefined}
            style={dragOK ? { cursor: "move" } : undefined}>
            <rect x={px(b.x)} y={py(b.y)} width={sc(b.w) - .4} height={sc(b.h) - .4}
              fill={bad?.has(i) ? "#ff224430"
                  : (usePoly || pdfPolys.length ? "transparent" : "#3b82f628")}
              stroke={cellStroke(i)}
              strokeWidth={ghost ? 1 : (bad?.has(i) || selv.has(i) ? 1.4 : .7)}
              strokeDasharray={ghost ? "5 3" : (usePoly || pdfPolys.length ? "2 2.5" : undefined)}
              opacity={ghost ? .9 : (bad?.has(i) || selv.has(i) ? 1 : (usePoly || pdfPolys.length ? .45 : 1))} rx={1}/>
            {usePoly && (
              <g transform={boxTf(b) + (b.flipped ? ` rotate(180,${nW/2},${nH/2})` : "")}>
                <DielineShape dl={dieline} color={bad?.has(i) ? "#ff8899" : "#78dcff"}/>
              </g>
            )}
            {!usePoly && pdfPolys.length > 0 && (
              <g transform={boxTf(b) + (b.flipped ? ` rotate(180,${pb.w/2},${pb.h/2})` : "")}>
                <g transform={pdfTf} fill="none" stroke={bad?.has(i) ? "#ff8899" : "#7ce0ff"} strokeWidth={.9}
                   strokeLinejoin="round" vectorEffect="non-scaling-stroke">
                  {pdfPolys.map((p, k) => (
                    <polyline key={k} points={p.map(([x,y]) => `${x},${y}`).join(" ")}/>
                  ))}
                </g>
              </g>
            )}
            {!ghost && sc(Math.min(b.w, b.h)) > 14 && (
              <text x={px(b.x + b.w/2)} y={py(b.y + b.h/2)} textAnchor="middle" dominantBaseline="middle"
                fontSize={Math.min(sc(b.w), sc(b.h)) * 0.3} fill="#5a9fe0" fontWeight={700} opacity={.7}
                pointerEvents="none">
                {i+1}
              </text>
            )}
          </g>
        ))}

        {/* ④ 자 — 상단(긴치수) / 좌측(짧은치수) */}
        <g stroke="#3a5a80" strokeWidth={.8} pointerEvents="none">
          <line x1={px(0)} y1={RULER-1} x2={px(rawLong)} y2={RULER-1}/>
          <line x1={RULER-1} y1={py(0)} x2={RULER-1} y2={py(rawShort)}/>
          {ticks(rawLong).map(v => <line key={"tx"+v} x1={px(v)} y1={RULER-1} x2={px(v)} y2={RULER-5}/>)}
          {ticks(rawShort).map(v => <line key={"ty"+v} x1={RULER-1} y1={py(v)} x2={RULER-5} y2={py(v)}/>)}
        </g>
        <g fontSize={6.5} fill="#6688aa" pointerEvents="none">
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
          ⚠ {ghostNote}{handOn ? " 「+ 추가」로 손배치를 시작할 수 있다." : ""}
        </div>
      )}

      {/* ── 손배치 상태 — 도형 출처 · 폴백 · 겹침 · 판밖 · 물림 ────────
          ⚠ 폴백(hull/bbox/raster)은 **반드시 뜬다.** 일부만 맞는 스냅을 정확한 스냅으로
            오해하는 것이 폴백 자체보다 위험하다 (makeDragPart 가 만든 note 를 그대로 찍는다). */}
      {handOn && (
        <div data-hand-status="1" style={{marginTop:7,fontSize:8.5,lineHeight:1.7}}>
          <div style={{color:"#7788aa"}}>
            도형 출처 <strong style={{color:"#aee8cc"}}>{hand.source}</strong>
            {hand.sourceNote && <span style={{color:"#556680"}}> · {hand.sourceNote}</span>}
            <span style={{color:"#556680"}}> · 충돌 {P.mode} · 볼록 {P.pieceCount}/{MAX_PIECES}조각</span>
          </div>
          {P.note && (
            <div style={{color:"#ffcc88",background:"#2a1a00",border:"1px solid #664400",
                         borderRadius:4,padding:"4px 7px",marginTop:3}}>{P.note}</div>
          )}
          {bad?.size > 0 && (
            <div style={{color:"#ff8899"}}>✕ 겹치는 칸 {[...bad].map(i=>i+1).join(", ")} — 이 개수는 견적에 쓰지 마라</div>
          )}
          {bchk?.off.length > 0 && (
            <div style={{color:"#ffaa44"}}>⚠ 판 밖으로 나간 칸 {bchk.off.map(i=>i+1).join(", ")}
              <span style={{color:"#886633"}}> (판 {+pa.printW.toFixed(1)}×{+pa.printH.toFixed(1)} 기준)</span></div>
          )}
          {bchk?.bite.length > 0 && (
            <div style={{color:"#cc9955"}}>· 물림 띠를 덮은 칸 {bchk.bite.map(i=>i+1).join(", ")}
              <span style={{color:"#775533"}}> (참고 — 판걸이는 물림을 빼지 않는다)</span></div>
          )}
          {hItems.length === 0 && (
            <div style={{color:"#ffaa44"}}>⚠ 앉힌 조각이 0개다 — 견적은 자동 판걸이로 되돌아간다</div>
          )}
          <div style={{color:"#556680"}}>
            {prev ? (prev.ok ? (prev.snapped ? "스냅 흡착 중 — 놓으면 확정" : "이동 중") : "겹친다 — 놓을 수 없다")
                  : (focus ? "단축키 활성 — ^D 복사 · R 180° · ⇧R 90° · Del 삭제 · ^A 전체 · ^Z 되돌리기 · ←↑↓→ 1mm(⇧10mm)"
                           : "판을 클릭하면 단축키가 먹는다 (^D ^Z R Del ^A ←↑↓→)")}
          </div>
          {msg && <div style={{color:"#ffd08a",marginTop:2}} data-hand-msg="1">{msg}</div>}
        </div>
      )}

      <div style={{display:"flex",gap:10,marginTop:7,flexWrap:"wrap",fontSize:8.5,color:"#7788aa",lineHeight:1.6}}>
        <span><span style={{color:"#ff7766"}}>▨</span> 물림 짧은치수 {biteY} / 긴치수 {biteX}mm <span style={{color:"#556680"}}>(참고 표시 — 판걸이는 빼지 않음)</span></span>
        {es.capped && <span><span style={{color:"#889"}}>▨</span> 인쇄기 밖</span>}
        {boxes.length > 0 && (
          <span data-up={boxes.length}><span style={{color:"#7ce0ff"}}>─</span> 칼선 {boxes.length}up
            {handOn ? <span style={{color:"#ffcc44"}}> (손배치 → 견적 up)</span>
                    : placement && <span style={{color:"#556680"}}> (손배치)</span>}
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

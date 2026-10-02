// ══════════════════════════════════════════════════════════════════
//  이 파일은 src/domain/dieline/index.mjs 레지스트리를 **직접 import** 해서
//  등록된 전 구조를 순회한다. 구조 파일을 추가하면 검사가 자동으로 늘어난다.
//
//  왜 필요한가
//  ──────────
//  전개도 '크기'(netSize)와 '그림'(flaps→폴리곤)이 서로 다른 회귀식을 쓰던 시절,
//  폴리곤이 netH 보다 25~30% 작아서 **실제로는 불가능한 배치를 가능하다고 판정**했다.
//  NFP 엔진은 폴리곤을 입력으로 쓰므로 이 불일치는 조용히 up 을 과대평가한다.
//  그래서 아래 3개를 불변식으로 못박는다:
//      max(flaps.top) === netSize.topLid
//      max(flaps.bot) === netSize.botFloor
//      폴리곤 bbox    === netW × netH   (오차 0)
//  추가로 원점 정렬(bbox 좌하단 = 0,0)도 본다 — imposition 의
//  boxes[i].x = 물림 + cell.x 가 이 가정 위에 서 있다.
// ══════════════════════════════════════════════════════════════════
import { structures, getStructure, calcNetSize, getFlaps, dielinePieces }
  from "../src/domain/dieline/index.mjs";
import { bboxOf } from "../src/nest.mjs";

const EPS = 0.05;

// 규격 스윕 — 실측 칼선의 범위와 경계 케이스를 함께 넣는다.
//   D≤15  : 맞뚜껑A 92×13×140 (종전 공식이 여기서 갈라졌다)
//   D=7   : 삼면D (칼선 검증범위 밖)
//   대형   : 칼선-04 265.5×124×243
//   D>H   : G형 D/H>0.8 분기
const GRID = [
  [92, 13, 140], [82, 7, 126], [50, 50, 150], [90, 70, 130], [140, 43, 130],
  [210, 90, 180], [265.5, 124, 243], [46, 46, 138], [130, 130, 55],
  [220, 210, 110], [350, 280, 70], [40, 40, 133],
];

// 전개도 직접입력(direct)은 hidden 이라 structures() 에 안 나온다 — netW/netH 를
// 사용자가 주는 구조라서 opt 가 필요하다. 명시적으로 붙인다.
const IDS  = [...structures().map(s => s.id), "direct"];
const OPT  = { direct: { netW: 646, netH: 258 } };

let pass = 0; const fails = [];
const t = (label, cond) => { if (cond) pass++; else fails.push(label); };

console.log("═══ 구조 레지스트리 불변식 스윕 ═══════════════════════════════════════════");
console.log(`등록 구조 ${IDS.length}종 × 규격 ${GRID.length}건\n`);
console.log("구조".padEnd(14)+"폴리곤".padEnd(8)+"검사".padEnd(8)+"top=topLid  bot=botFloor  bbox=netW×netH  원점(0,0)");
console.log("-".repeat(96));

for (const id of IDS) {
  const st = getStructure(id);
  const opt = OPT[id] || {};
  let n = 0, okTop = 0, okBot = 0, okBox = 0, okOrg = 0, sized = 0;

  for (const [W, D, H] of GRID) {
    const net = calcNetSize(W, D, H, id, opt);
    if (!net) continue;                       // direct 는 netW/netH 없으면 null (정상)
    n++;
    t(`${id} ${W}×${D}×${H} netW>0`, net.netW > 0);
    t(`${id} ${W}×${D}×${H} netH>0`, net.netH > 0);
    if (net.netW > 0 && net.netH > 0) sized++;

    const flaps = getFlaps(W, D, H, id);
    if (st.polygon) {
      // 날개 최대 깊이가 곧 netH 를 만든 값이어야 한다. 어긋나면 그림과 크기가 갈린다.
      const maxTop = Math.max(...flaps.top), maxBot = Math.max(...flaps.bot);
      const hitTop = Math.abs(maxTop - net.topLid) <= EPS;
      const hitBot = Math.abs(maxBot - net.botFloor) <= EPS;
      if (hitTop) okTop++; if (hitBot) okBot++;
      t(`${id} ${W}×${D}×${H} max(top)=topLid`, hitTop);
      t(`${id} ${W}×${D}×${H} max(bot)=botFloor`, hitBot);
    } else {
      okTop++; okBot++;   // 폴리곤 미확정 구조는 날개가 없다 (직사각 1조각)
    }

    const dl = dielinePieces(W, D, H, id, opt);
    const b = bboxOf(dl.pieces);
    const hitBox = Math.abs(b.w - net.netW) <= EPS && Math.abs(b.h - net.netH) <= EPS;
    const hitOrg = Math.abs(b.x0) <= EPS && Math.abs(b.y0) <= EPS;
    if (hitBox) okBox++; if (hitOrg) okOrg++;
    t(`${id} ${W}×${D}×${H} bbox=netW×netH`, hitBox);
    t(`${id} ${W}×${D}×${H} 원점정렬`, hitOrg);
  }

  console.log(id.padEnd(14)+(st.polygon?"있음":"직사각").padEnd(8)+`${n}건`.padEnd(8)+
    `${okTop}/${n}`.padStart(9)+`${okBot}/${n}`.padStart(13)+
    `${okBox}/${n}`.padStart(15)+`${okOrg}/${n}`.padStart(12)+
    (sized === n ? "" : "  ⚠ 크기 0"));
}

console.log("-".repeat(96));
console.log(`불변식 ${pass}/${pass + fails.length} 통과`);
if (fails.length) {
  console.log(`\n✗ 위반 ${fails.length}건:`);
  for (const f of fails.slice(0, 30)) console.log(`  · ${f}`);
  if (fails.length > 30) console.log(`  … 외 ${fails.length - 30}건`);
  process.exitCode = 1;
}

// ── 레지스트리 계약 ────────────────────────────────────────────────
// 구조를 추가할 때 빠뜨리기 쉬운 필드를 여기서 잡는다.
console.log("\n═══ 레지스트리 계약 ═══════════════════════════════════════════════════════");
let cOk = 0;
const CONTRACT = [];
for (const id of IDS) {
  const st = getStructure(id);
  const rows = [
    ["id 일치",        st.id === id],
    ["label 있음",     typeof st.label === "string" && st.label.length > 0],
    ["netSize 함수",   typeof st.netSize === "function"],
    ["flaps 함수",     typeof st.flaps === "function"],
    ["polygon 불리언", typeof st.polygon === "boolean"],
    ["폴리곤이면 flaps 반환", !st.polygon || !!st.flaps(100, 50, 120)],
  ];
  for (const [k, ok] of rows) { if (ok) cOk++; else CONTRACT.push(`${id}: ${k}`); }
  console.log(`  ${rows.every(r => r[1]) ? "✓" : "✗"} ${id.padEnd(12)} ${st.label}` +
              `${st.thomsonDefault ? `  · 톰슨 기본 ${st.thomsonDefault}` : ""}` +
              `${st.hidden ? "  · hidden" : ""}`);
}
console.log(`계약 ${cOk}/${cOk + CONTRACT.length} 통과`);
for (const c of CONTRACT) console.log(`  ✗ ${c}`);
if (CONTRACT.length) process.exitCode = 1;

console.log(`\n※ 알 수 없는 구조 id 는 null 이어야 한다 (종전 default 분기 D/2+20 은 되살리지 않는다)`);
const unknownOk = calcNetSize(100, 50, 120, "존재하지않는구조") === null
               && getStructure("존재하지않는구조") === null
               && dielinePieces(100, 50, 120, "존재하지않는구조") === null;
console.log(`  ${unknownOk ? "✓" : "✗"} calcNetSize / getStructure / dielinePieces 전부 null`);
if (!unknownOk) process.exitCode = 1;

// ══════════════════════════════════════════════════════════════════
//  규격 도면 대조 — gtype_spec · glue_4side (26-10-02)
//
//  두 구조는 사용자가 그려 준 규격 도면(docs/g형예시/ · 색 사각형 패널)을 그대로 옮긴 것이다.
//  「식이 도면과 같다」를 bbox 한 쌍이 아니라 **패널 사각형 전부**로 못박는다 — bbox 는 맞고 안쪽이
//  틀린 모델(옆벽과 모서리를 바꿔 그린 것 등)이 통과하지 못하게.
//  ⚠ docs/ 는 .gitignore 라 PDF 가 저장소에 없다. 그래서 도면에서 읽은 수(mm · 좌상단 원점 · [x,y,w,h])를
//    여기 박아 두고, 파일이 있으면 **PDF 를 직접 읽어 한 번 더** 맞댄다(없으면 크게 찍고 건너뛴다).
//  허용오차 0.7mm — 손으로 맞댄 도면의 어긋남 관측 최대 0.617(4면접착예시2 오른쪽 띠).
// ══════════════════════════════════════════════════════════════════
import { existsSync, readFileSync } from "node:fs";
import { panels as gPanels } from "../src/domain/dieline/gtype-spec.mjs";
import { panels as fPanels } from "../src/domain/dieline/glue4.mjs";
import { readDieline } from "../src/domain/pdf-dieline.mjs";

const DRAW = [
  { id: "gtype_spec", file: "G형예시.pdf", dims: [120, 125, 55], bbox: [340, 470], rects: [
    [110,0,120,55],[55,55,55,125],[110,55,120,125],[230,55,55,125],[55,180,55,55],[110,180,120,55],[230,180,55,55],
    [0,235,55,125],[55,235,55,125],[110,235,120,125],[230,235,55,125],[285,235,55,125],
    [55,360,55,55],[110,360,120,55],[230,360,55,55],[110,415,120,55]] },
  { id: "gtype_spec", file: "G형예시2.pdf", dims: [200, 80, 70], bbox: [480, 440], rects: [
    [140,0,200,70],[70,70,70,80],[140,70,200,80],[340,70,70,80],[70,150,70,70],[140,150,200,70],[340,150,70,70],
    [0,220,70,80],[70,220,70,80],[140,220,200,80],[340,220,70,80],[410,220,70,80],
    [70,300,70,70],[140,300,200,70],[340,300,70,70],[140,370,200,70]] },
  { id: "glue_4side", file: "4면접착예시2_200x80x70.pdf", dims: [200, 80, 70], bbox: [380, 330], rects: [
    [90,0,200,30],[90,30,200,80],[50,110,40,70],[90,110,200,70],[290,110,40,70],
    [0,180,20,80],[20,180,70,80],[90,180,200,80],[290,180,70,80],[360.6,180,20,80],
    [50,260,40,70],[90,260,200,70],[290,260,40,70]] },
];
// 예시1 은 벽 높이가 둘로 그려진 도면이다(옆벽 40 · 앞뒤벽 55) — 어느 H 로도 13칸이 다 안 맞는다는 것을 찍는다.
const DRAW_ODD = { id: "glue_4side", file: "4면접착예시.pdf", W: 250, D: 100, tryH: [40, 55], rects: [
  [60,0,250,30],[60,30,250,100],[20,130,40,55],[60,130,250,55],[310,130,40,55],
  [0,185,20,100],[20,185,40,100],[60,185,250,100],[310,185,40,100],[350,185,20,100],
  [20,285,40,55],[60,285,250,55],[310,285,40,55]] };

const PANELS = { gtype_spec: gPanels, glue_4side: fPanels };
const TOL = 0.7;
/** 도면 사각형마다 모델 패널 하나가 네 변 모두 TOL 안에 있어야 한다(1:1). 맞은 수를 돌려준다. */
function matchRects(model, drawn) {
  const used = new Set(); let hit = 0;
  for (const [x, y, w, h] of drawn) {
    const j = model.findIndex(([, x0, y0, x1, y1], k) => !used.has(k) &&
      Math.abs(x0 - x) <= TOL && Math.abs(y0 - y) <= TOL && Math.abs(x1 - (x + w)) <= TOL && Math.abs(y1 - (y + h)) <= TOL);
    if (j >= 0) { used.add(j); hit++; }
  }
  return hit;
}
const areaOf = poly => { let a = 0; for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]; a += x0 * y1 - x1 * y0; } return Math.abs(a) / 2; };

console.log("\n═══ 규격 도면 대조 — 패널 사각형 전부 (허용 0.7mm) ════════════════════════");
let dOk = 0; const dFail = [];
const dt = (label, cond, note = "") => { if (cond) dOk++; else dFail.push(label + (note ? " — " + note : "")); };
for (const c of DRAW) {
  const [W, D, H] = c.dims;
  const model = PANELS[c.id](W, D, H);
  const hit = matchRects(model, c.rects);
  const net = calcNetSize(W, D, H, c.id);
  const dl = dielinePieces(W, D, H, c.id);
  const sumPieces = dl.pieces.reduce((a, p) => a + areaOf(p), 0);
  const sumPanels = model.reduce((a, [, x0, y0, x1, y1]) => a + (x1 - x0) * (y1 - y0), 0);
  dt(`${c.file} 패널 수`, model.length === c.rects.length, `모델 ${model.length} vs 도면 ${c.rects.length}`);
  dt(`${c.file} 패널 1:1 일치`, hit === c.rects.length, `${hit}/${c.rects.length}`);
  dt(`${c.file} bbox`, Math.abs(net.netW - c.bbox[0]) <= TOL && Math.abs(net.netH - c.bbox[1]) <= TOL, `${net.netW}×${net.netH} vs ${c.bbox.join("×")}`);
  // 배치 조각(볼록 사각형 몇 개)이 패널 합집합을 **정확히** 덮는가 — 조각은 서로 안 겹치게 짰으므로 면적 합이 같아야 한다.
  dt(`${c.file} 배치 조각 면적 = 패널 면적 합`, Math.abs(sumPieces - sumPanels) < 1e-6, `${sumPieces} vs ${sumPanels}`);
  // 이빨 — D·H 를 바꿔 넣은 모델은 같은 도면에 맞으면 안 된다(맞으면 이 대조가 아무것도 안 재는 것이다).
  const swapped = matchRects(PANELS[c.id](W, H, D), c.rects);
  dt(`${c.file} 이빨(D↔H 바꾼 모델은 불일치)`, D === H || swapped < c.rects.length, `바꿔도 ${swapped}/${c.rects.length}`);
  console.log(`  ${hit === c.rects.length ? "✓" : "✗"} ${c.id.padEnd(11)} ${String(c.dims.join("×")).padEnd(11)} 패널 ${hit}/${c.rects.length} · 식 ${net.netW}×${net.netH} (도면 ${c.bbox.join("×")}) · 조각 ${dl.pieces.length}개 · D↔H 바꾸면 ${swapped}/${c.rects.length}   ${c.file}`);
}
{ // 예시1 — 문서화된 차이. 「어느 H 로도 안 맞는다」가 사실인 동안만 통과한다(누가 도면을 고쳐 주면 여기가 빨개져 알려 준다).
  const res = DRAW_ODD.tryH.map(H => [H, matchRects(fPanels(DRAW_ODD.W, DRAW_ODD.D, H), DRAW_ODD.rects)]);
  dt("4면접착예시.pdf 는 벽 높이가 둘 — 어느 H 로도 13/13 이 아니다(문서화된 차이)", res.every(([, n]) => n < DRAW_ODD.rects.length));
  console.log(`  ※ ${DRAW_ODD.file} (바닥 250×100 · 옆벽 40 · 앞뒤벽 55 로 그려짐) — ` + res.map(([H, n]) => `H=${H} → ${n}/13`).join(" · ") + "  ← 문서화된 차이(사용자 확인 필요)");
}

// ── 파일이 있으면 PDF 를 직접 읽어 한 번 더 ─────────────────────────────────────────
{
  const DIR = new URL("../docs/g형예시/", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
  const dir = decodeURIComponent(DIR);
  let seen = 0;
  for (const c of DRAW) {
    const p = dir + c.file;
    if (!existsSync(p)) continue;
    seen++;
    const r = await readDieline(readFileSync(p), { source: c.file });
    const bbs = r.polygons.map(poly => { const xs = poly.map(q => q[0] ?? q.x), ys = poly.map(q => q[1] ?? q.y);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; });
    const X0 = Math.min(...bbs.map(b => b[0])), Y1 = Math.max(...bbs.map(b => b[3]));
    const drawn = bbs.map(([x0, y0, x1, y1]) => [x0 - X0, Y1 - y1, x1 - x0, y1 - y0]);   // PDF 는 y 가 위로 — 좌상단 원점으로 뒤집는다
    const [W, D, H] = c.dims;
    const hit = matchRects(PANELS[c.id](W, D, H), drawn);
    dt(`[PDF] ${c.file} 패널 1:1`, hit === c.rects.length && drawn.length === c.rects.length, `${hit}/${c.rects.length} · 읽힌 사각형 ${drawn.length}`);
    dt(`[PDF] ${c.file} bbox = 박아 둔 도면값`, Math.abs(r.bbox.w - Math.max(...c.rects.map(q => q[0] + q[2]))) <= TOL && Math.abs(r.bbox.h - Math.max(...c.rects.map(q => q[1] + q[3]))) <= TOL, `${r.bbox.w}×${r.bbox.h}`);
    console.log(`  ${hit === c.rects.length ? "✓" : "✗"} [PDF 직독] ${c.file} → ${r.bbox.w.toFixed(1)}×${r.bbox.h.toFixed(1)} · 사각형 ${drawn.length} · 모델과 ${hit}/${c.rects.length}`);
  }
  if (!seen) console.log("  ⏭ docs/g형예시/ 의 PDF 가 없다 — 직독 대조는 건너뛴다(박아 둔 도면값 대조는 위에서 돌았다). **PDF 를 읽지 않았다.**");
}
console.log(`규격 도면 대조 ${dOk}/${dOk + dFail.length} 통과`);
for (const f of dFail) console.log(`  ✗ ${f}`);
if (dFail.length) process.exitCode = 1;

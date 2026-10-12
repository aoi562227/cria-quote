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
import { panels as gPanels, SKELETON as G_SKELETON } from "../src/domain/dieline/gtype-spec.mjs";
import { panels as fPanels } from "../src/domain/dieline/glue4.mjs";
import { readDieline } from "../src/domain/pdf-dieline.mjs";

const DRAW = [
  { id: "gtype_spec", file: "G형예시.pdf", dims: [120, 125, 55], bbox: [340, 415], mistake: [110,415,120,55], rects: [
    [110,0,120,55],[55,55,55,125],[110,55,120,125],[230,55,55,125],[55,180,55,55],[110,180,120,55],[230,180,55,55],
    [0,235,55,125],[55,235,55,125],[110,235,120,125],[230,235,55,125],[285,235,55,125],
    [55,360,55,55],[110,360,120,55],[230,360,55,55],[110,415,120,55]] },
  { id: "gtype_spec", file: "G형예시2.pdf", dims: [200, 80, 70], bbox: [480, 370], mistake: [140,370,200,70], rects: [
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

// ★ 26-10-02 — G형 도면의 **맨 아래 칸(앞벽 아래 H 한 칸)은 사용자가 「실수」라 했다**(앞벽은 한 겹이다).
//   도면 수치는 그린 그대로 16칸을 박아 두고, 그 한 칸을 `mistake` 로 표시한다 — 모델은 나머지 15칸과 1:1 이어야 하고
//   그 칸은 **모델에 없어야** 한다(누가 두 겹으로 되돌리면 여기가 빨개진다).
// ★ 26-10-02 (2) — gtype_spec 은 이제 **실물 칼선의 여유분**을 싣는다(가로 +8 · 세로 +0.5). 규격 도면은 여유분 없는 도식이므로
//   도면과는 `SKELETON`(여유분 0) 뼈대를 맞댄다 — 「패널 배치가 도면과 같다」를 재는 것이고, 치수의 정본은 실물 칼선 쪽 게이트다.
const PANELS = { gtype_spec: (W, D, H) => gPanels(W, D, H, G_SKELETON), glue_4side: fPanels };
const FULL   = { gtype_spec: gPanels, glue_4side: fPanels };
const sameRect = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
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
  const drawn0 = c.mistake ? c.rects.filter(r => !sameRect(r, c.mistake)) : c.rects;
  const hit = matchRects(model, drawn0);
  if (c.mistake) dt(`${c.file} 도면의 「앞벽 아래 칸」은 모델에 없다(사용자: 실수 · 앞벽 한 겹)`,
                    drawn0.length === c.rects.length - 1 && matchRects(model, [c.mistake]) === 0);
  const net = calcNetSize(W, D, H, c.id);
  const dl = dielinePieces(W, D, H, c.id);
  const sumPieces = dl.pieces.reduce((a, p) => a + areaOf(p), 0);
  const sumPanels = FULL[c.id](W, D, H).reduce((a, [, x0, y0, x1, y1]) => a + (x1 - x0) * (y1 - y0), 0);
  const mw = Math.max(...model.map(q => q[3])), mh = Math.max(...model.map(q => q[4]));     // 뼈대 bbox
  dt(`${c.file} 패널 수`, model.length === drawn0.length, `모델 ${model.length} vs 도면 ${drawn0.length}`);
  dt(`${c.file} 패널 1:1 일치`, hit === drawn0.length, `${hit}/${drawn0.length}`);
  dt(`${c.file} 뼈대 bbox`, Math.abs(mw - c.bbox[0]) <= TOL && Math.abs(mh - c.bbox[1]) <= TOL, `${mw}×${mh} vs ${c.bbox.join("×")}`);
  // 배치 조각(축정렬 사각형)은 **서로 안 겹치고**, 패널 합집합을 **덮어야** 한다(≥ · 모델 ≥ 실물 = 안전측).
  //   26-10-05 — G형 조각은 꽂이 어깨·옆날개까지 덮느라 패널 면적보다 크다. 「=」이던 검사를 「겹침 0 · ≥」로 바꿨다.
  const rb = dl.pieces.map(q => [Math.min(...q.map(v => v[0])), Math.min(...q.map(v => v[1])), Math.max(...q.map(v => v[0])), Math.max(...q.map(v => v[1]))]);
  let ovl = 0;
  for (let i = 0; i < rb.length; i++) for (let j = i + 1; j < rb.length; j++)
    ovl += Math.max(0, Math.min(rb[i][2], rb[j][2]) - Math.max(rb[i][0], rb[j][0])) * Math.max(0, Math.min(rb[i][3], rb[j][3]) - Math.max(rb[i][1], rb[j][1]));
  dt(`${c.file} 배치 조각끼리 겹침 0`, ovl < 1e-6, `겹침 ${ovl}`);
  dt(`${c.file} 배치 조각 면적 ≥ 패널 면적 합(덮개)`, sumPieces >= sumPanels - 1e-6, `${sumPieces} vs ${sumPanels}`);
  // 이빨 — D·H 를 바꿔 넣은 모델은 같은 도면에 맞으면 안 된다(맞으면 이 대조가 아무것도 안 재는 것이다).
  const swapped = matchRects(PANELS[c.id](W, H, D), drawn0);
  dt(`${c.file} 이빨(D↔H 바꾼 모델은 불일치)`, D === H || swapped < drawn0.length, `바꿔도 ${swapped}/${drawn0.length}`);
  console.log(`  ${hit === drawn0.length ? "✓" : "✗"} ${c.id.padEnd(11)} ${String(c.dims.join("×")).padEnd(11)} 패널 ${hit}/${drawn0.length}${c.mistake ? " (+실수 칸 1 제외)" : ""} · 뼈대 ${mw}×${mh} (도면 ${c.bbox.join("×")}) · 여유분 포함 ${net.netW}×${net.netH} · 조각 ${dl.pieces.length}개 · D↔H 바꾸면 ${swapped}/${drawn0.length}   ${c.file}`);
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
    const model = PANELS[c.id](W, D, H);
    const hit = matchRects(model, drawn);
    // 도면 파일에는 실수 칸까지 그려져 있다 — 읽힌 사각형 수는 도면 그대로(16), 모델과 맞는 것은 모델 칸 수(15).
    dt(`[PDF] ${c.file} 패널 1:1`, hit === model.length && drawn.length === c.rects.length, `${hit}/${model.length} · 읽힌 사각형 ${drawn.length}`);
    dt(`[PDF] ${c.file} bbox = 박아 둔 도면값`, Math.abs(r.bbox.w - Math.max(...c.rects.map(q => q[0] + q[2]))) <= TOL && Math.abs(r.bbox.h - Math.max(...c.rects.map(q => q[1] + q[3]))) <= TOL, `${r.bbox.w}×${r.bbox.h}`);
    console.log(`  ${hit === model.length ? "✓" : "✗"} [PDF 직독] ${c.file} → ${r.bbox.w.toFixed(1)}×${r.bbox.h.toFixed(1)} · 사각형 ${drawn.length} · 모델과 ${hit}/${model.length}${c.mistake ? " (도면의 실수 칸 1 은 모델에 없다)" : ""}`);
  }
  if (!seen) console.log("  ⏭ docs/g형예시/ 의 PDF 가 없다 — 직독 대조는 건너뛴다(박아 둔 도면값 대조는 위에서 돌았다). **PDF 를 읽지 않았다.**");
}
console.log(`규격 도면 대조 ${dOk}/${dOk + dFail.length} 통과`);
for (const f of dFail) console.log(`  ✗ ${f}`);
if (dFail.length) process.exitCode = 1;

// ══════════════════════════════════════════════════════════════════
//  실물 견적서 대조 — G형 270×370×70 (26-03-16 크리아 · 마스크 패키지 · AB400 · 4*6전지) — 26-10-02
//
//  G형의 **첫 실물 근거**다. 견적서 아래 도면에서 전개도를 읽었다:
//    긴 축  = 왼벽 70 + 바닥 370 + 뒷벽 70 + 뚜껑 370 + 뚜껑 띠 70 = **950 = 2D + 3H**
//    짧은 축 = 바닥 270 + 위·아래 벽 두 겹씩(70×4)              = **550 = W + 4H**
//    소부 재단 990×590(사방 20mm) · 4*6전지 한 장에 **1개**.
//  문서가 스스로 1up 임을 말한다: 지대 4.8R = 2,400장 = 2,000 + 여분 400 · 6.8R = 3,400장 = 3,000 + 400,
//  공정R 2.1 / 3.1 = (수량 + 100) ÷ 1,000.  ⚠ 비고칸의 「2」는 **이 문서에서는 up 이 아니다**(up 2 면 여분율 140%·127%).
//  그 「2」가 무엇인지는 모른다 — 코퍼스 추출기(비고=up)는 이 문서를 up 2 로 싣고 검수대가 「⚠오라클 의심」으로 찍는다.
//
//  세 G형 모델에 같은 규격을 넣으면:
//    gtype_tray  594.5×969.5 → 46전지 1up · 지대R 4.8 / 6.8  ← **문서와 원 단위(R)로 같다**
//    gtype       1764×1251   → 들어가는 판형 없음              ← 이 규격에서는 식이 틀린다
//    gtype_spec  550×950     → ★ 26-10-02 한 겹으로 고친 뒤 **견적서 도면과 mm 까지 같다** · 46전지 1up · 지대R 4.8 / 6.8
// ══════════════════════════════════════════════════════════════════
import { INITIAL_STATE, toQuoteInput } from "../src/ui/state.mjs";
import { buildQuote } from "../src/domain/quote.mjs";
{
  console.log("\n═══ 실물 견적서 대조 — G형 270×370×70 · AB400 · 4*6전지 (26-03-16) ══════════════");
  let rOk = 0; const rFail = [];
  const rt = (label, cond, note = "") => { if (cond) rOk++; else rFail.push(label + (note ? " — " + note : "")); };
  const S = { ...INITIAL_STATE, sizeMode: "box", bW: "270", bD: "370", bH: "70", paperId: "AB400", sheetId: "auto",
    fpColor: false, fpSp: "1", fpBk: true, fpUv: false, beda: true, bpColor: false, bpSp: "0", bpBk: false, bpUv: false,
    fcId: "matte", bcId: "none", glueId: "none" };
  const run = (boxType, qty) => buildQuote(toQuoteInput({ ...S, boxType, qty: String(qty) }));
  const paperR = q => q.lines?.find(l => l.name === "지대")?.qty;
  const DOC = { 2000: { R: 4.8, total: 2934614 }, 3000: { R: 6.8, total: 4150078 } };
  for (const qty of [2000, 3000]) {
    const q = run("gtype_tray", qty);
    const net = q.netSize, R = paperR(q);
    rt(`gtype_tray ${qty}ea 지대R = 문서 ${DOC[qty].R}`, R === DOC[qty].R, `우리 ${R}`);
    rt(`gtype_tray ${qty}ea 전개도가 재단 990×590 근처(±25mm)`, Math.abs(net.netH - 990) <= 25 && Math.abs(net.netW - 590) <= 25, `${net.netW}×${net.netH}`);
    const d = (q.totals.process - DOC[qty].total) / DOC[qty].total;
    // 합계는 게이트가 아니다 — 단가(지대 455,232→431,272 최근 우선 · 관리비 재량 200,000 vs 110,000)가 달라 −6% 다. 수만 찍는다.
    console.log(`  ${R === DOC[qty].R ? "✓" : "✗"} gtype_tray ${qty}ea  전개도 ${net.netW}×${net.netH} · 지대R ${R} (문서 ${DOC[qty].R}) · 공정합계 ${q.totals.process.toLocaleString()} vs 문서 ${DOC[qty].total.toLocaleString()} (${(100 * d).toFixed(1)}% — 게이트 아님)`);
  }
  const g = run("gtype", 2000), sp = run("gtype_spec", 2000);
  rt("gtype(톰슨조립)은 이 규격에서 판형에 안 들어간다(문서화된 한계)", !g.lines, g.lines ? "견적이 나왔다" : "");
  rt("gtype_spec(얇은 벽) 전개도 558×950.5 = 견적서 도면 550×950 + 여유분(8 · 0.5) · 재단 990×590 안", sp.netSize.netH === 950.5 && sp.netSize.netW === 558 && sp.netSize.netH <= 990 && sp.netSize.netW <= 590, `${sp.netSize.netW}×${sp.netSize.netH}`);
  for (const qty of [2000, 3000]) {
    const R = paperR(run("gtype_spec", qty));
    rt(`gtype_spec ${qty}ea 지대R = 문서 ${DOC[qty].R}`, R === DOC[qty].R, `우리 ${R}`);
  }
  console.log(`  ※ gtype      ${g.netSize.netW}×${g.netSize.netH} → ${g.lines ? "견적 나옴" : "들어가는 판형 없음"}   ← 문서화된 한계`);
  console.log(`  ✓ gtype_spec ${sp.netSize.netW}×${sp.netSize.netH} (견적서 도면 550×950 + 여유분 · 재단 990×590 안) · 지대R ${paperR(sp)} (문서 4.8) · ${sp.lines ? "46전지 1up" : "배치 불성립"}`);
  console.log(`실물 견적서 대조 ${rOk}/${rOk + rFail.length} 통과`);
  for (const f of rFail) console.log(`  ✗ ${f}`);
  if (rFail.length) process.exitCode = 1;
}

// ══════════════════════════════════════════════════════════════════
//  실물 견적서 + 실물 칼선 대조 — G형 220×210×110 (26-07-06 크리아 · 모자 패키지 · BW350 · 4*6전 · 재단 800×700) — 26-10-02
//
//  G형의 **첫 실물 칼선**이다(트렌드스페이스 `G형220x210x110.pdf` — 저장소 밖 회사 폴더). 접는선으로 읽은 패널:
//    긴 축  770.5 = 왼벽 110 · 바닥 219 · 뒷벽 108 · 뚜껑 225.5 · 꽂이 108      = 2·220 + 3·110 + 0.5
//    짧은 축 658.0 = 바닥 211.5 + 위·아래 벽 두 겹(3.5 + 109 + 띠 20 + 90.5)×2   = 210 + 4·110 + 8
//  ⟹ 마스크 패키지 견적서 도면(950×550)과 **같은 뼈대**다: 긴 축 2a+3H · 짧은 축 b+4H (a=뚜껑이 덮는 쪽 변).
//  gtype_tray 식 704.5×769.5 와는 긴 축 −1.0 · **짧은 축 +46.5**(식이 크다 = 안전측 · 46전지 1up 은 안 갈린다).
//  식은 안 고쳤다 — 여유분(+44.5)은 bbox 4건이 Δ0 으로 받치고 이 칼선 1건이 반대한다. 근거가 갈리면 큰(비싼) 쪽을 둔다.
//  문서 둘(같은 날): ⓐ 전면 별5·후면 별2·후면 IR  ⓑ 전면 별2·후면 별3·전면 무광라미+후면 IR. 지대는 둘이 같다.
// ══════════════════════════════════════════════════════════════════
{
  console.log("\n═══ 실물 견적서·칼선 대조 — G형 220×210×110 · BW350 · 4*6전 (26-07-06 모자 패키지) ════");
  let rOk = 0; const rFail = [];
  const rt = (label, cond, note = "") => { if (cond) rOk++; else rFail.push(label + (note ? " — " + note : "")); };
  const S = { ...INITIAL_STATE, sizeMode: "box", boxType: "gtype_tray", bW: "220", bD: "210", bH: "110", paperId: "BW350", sheetId: "auto",
    fpColor: false, fpSp: "2", fpBk: false, fpUv: false, bpColor: false, bpSp: "3", bpBk: false, bpUv: false,
    fcId: "matte", bcId: "ir", glueId: "none" };
  const DOC = { 500: { R: 1.8, paper: 689155, total: 1384155 }, 1000: { R: 2.8, paper: 1072019, total: 2057019 } };
  for (const qty of [500, 1000]) {
    const q = buildQuote(toQuoteInput({ ...S, qty: String(qty) }));
    const pl = q.lines.find(l => l.name === "지대");
    rt(`${qty}ea 지대R = 문서 ${DOC[qty].R}`, pl.qty === DOC[qty].R, `우리 ${pl.qty}`);
    rt(`${qty}ea 지대 금액 = 문서 ${DOC[qty].paper} (BW350 46전지 382,864 · 원 단위)`, pl.amount === DOC[qty].paper, `우리 ${pl.amount}`);
    const d = (q.totals.process - DOC[qty].total) / DOC[qty].total;
    console.log(`  ${pl.amount === DOC[qty].paper ? "✓" : "✗"} ${qty}ea  지대 ${pl.qty}R × ${pl.unitPrice.toLocaleString()} = ${pl.amount.toLocaleString()} (문서 ${DOC[qty].paper.toLocaleString()}) · ` +
      q.lines.filter(l => l.name !== "지대").map(l => `${l.name} ${l.amount.toLocaleString()}`).join(" · ") +
      ` · 공정합계 ${q.totals.process.toLocaleString()} vs 문서ⓑ ${DOC[qty].total.toLocaleString()} (${(100 * d).toFixed(1)}% — 게이트 아님)`);
  }
  // ★ 같은 견적을 **얇은 벽 구조(gtype_spec · W=210·D=220)** 로 — 이 건의 실제 구조다. 지대가 문서와 원 단위로 같아야 한다.
  for (const qty of [500, 1000]) {
    const q = buildQuote(toQuoteInput({ ...S, boxType: "gtype_spec", bW: "210", bD: "220", qty: String(qty) }));
    const pl = q.lines.find(l => l.name === "지대");
    rt(`gtype_spec ${qty}ea 지대R·금액 = 문서`, pl.qty === DOC[qty].R && pl.amount === DOC[qty].paper, `우리 ${pl.qty}R · ${pl.amount}`);
    console.log(`  ${pl.amount === DOC[qty].paper ? "✓" : "✗"} gtype_spec ${qty}ea  전개도 ${q.netSize.netW}×${q.netSize.netH} · 지대 ${pl.qty}R = ${pl.amount.toLocaleString()} (문서 ${DOC[qty].paper.toLocaleString()})`);
  }
  // 실물 칼선 — 파일이 있을 때만(회사 폴더). 파서가 고르는 1순위는 **부분**(441.5×425)이다: 칼선이 좌우 두 성분으로
  // 나뉘어 있고 좌우 병합은 막혀 있다(iSHAP 2up 사고 방지). 그래서 후보들의 합집합으로 잰다. 그 한계도 찍는다.
  const DIE = process.env.GTYPE_DIE ?? "C:/이예찬_업무/연도별/2026/고객사/제작완료/트렌드스페이스/디자인/G형220x210x110.pdf";
  if (existsSync(DIE)) {
    const r = await readDieline(readFileSync(DIE), { source: "G형220x210x110.pdf", maxCandidates: 10 });
    const outer = r.candidates.reduce((a, c) => (c.bbox.w * c.bbox.h > a.bbox.w * a.bbox.h ? c : a));      // 3mm 도련 윤곽
    const inner = r.candidates.filter(c => c !== outer);
    const x0 = Math.min(...inner.map(c => c.bbox.x0)), y0 = Math.min(...inner.map(c => c.bbox.y0));
    const x1 = Math.max(...inner.map(c => c.bbox.x0 + c.bbox.w)), y1 = Math.max(...inner.map(c => c.bbox.y0 + c.bbox.h));
    const L = x1 - x0, Sx = y1 - y0, net = calcNetSize(220, 210, 110, "gtype_tray");
    rt("[칼선] 실측 770.5×658 (도련 윤곽 776.5×664 = 사방 +3)", Math.abs(L - 770.5) < 0.2 && Math.abs(Sx - 658) < 0.2 && Math.abs(outer.bbox.w - 776.5) < 0.2 && Math.abs(outer.bbox.h - 664) < 0.2, `${L.toFixed(1)}×${Sx.toFixed(1)} · 윤곽 ${outer.bbox.w}×${outer.bbox.h}`);
    rt("[칼선] gtype_tray 긴 축이 실측과 ±1.5mm", Math.abs(net.netH - L) <= 1.5, `식 ${net.netH} vs ${L.toFixed(1)}`);
    rt("[칼선] gtype_tray 짧은 축은 실측보다 **크다**(안전측) — 문서화된 차이 +46.5", net.netW > Sx && Math.abs(net.netW - Sx - 46.5) < 0.2, `식 ${net.netW} vs ${Sx.toFixed(1)}`);
    rt("[칼선] 재단 800×700 에 실측 칼선이 들어간다", L <= 800 && Sx <= 700);
    // 규격도 식(여유분 없음)은 뚜껑이 덮어 가는 변을 D 로 받는다 — 이 칼선은 그 변이 220 이다(접는선 바닥 219).
    const sp = calcNetSize(210, 220, 110, "gtype_spec");
    rt("[칼선] ★ gtype_spec(W=210·D=220) = 실측 658×770.5 (0.2mm 이내 — 이 구조의 여유분이 이 칼선에서 왔다)", Math.abs(sp.netH - L) < 0.2 && Math.abs(sp.netW - Sx) < 0.2, `식 ${sp.netW}×${sp.netH} vs ${Sx.toFixed(1)}×${L.toFixed(1)}`);
    // ★ 도면 그리기 — 우리 윤곽(cuts)의 꼭짓점이 실물 칼선 선분에서 얼마나 떨어지나(26-10-05 · 꽂이 곡선 점표 포함).
    //   실물은 y 가 위로, 긴 축이 x 다 → 우리 좌표(x 짧은 축 · y 긴 축 · 꽂이 끝 y=0)로 돌려 잰다.
    {
      const die = inner.flatMap(c => c.polygons).map(poly => poly.map(q => [(q[1] ?? q.y) - y0, x1 - (q[0] ?? q.x)]));
      const dl = dielinePieces(210, 220, 110, "gtype_spec");
      const dseg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
        const t = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
        return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy)); };
      const dist = p => { let m = Infinity; for (const q of die) for (let i = 0; i + 1 < q.length; i++) m = Math.min(m, dseg(p, q[i], q[i + 1])); return m; };
      const ds = dl.cuts[0].map(dist).sort((a, b) => a - b);
      const med = ds[ds.length >> 1], p90 = ds[Math.floor(ds.length * 0.9)], mx = ds[ds.length - 1];
      rt("[도면] 우리 윤곽 꼭짓점 → 실물 칼선 선분: max ≤ 1.2mm · 중앙 ≤ 0.1mm", mx <= 1.2 && med <= 0.1, `중앙 ${med.toFixed(2)} · p90 ${p90.toFixed(2)} · max ${mx.toFixed(2)}`);
      rt("[도면] 윤곽은 닫혀 있고 bbox = 전개도 · 접는선 16 · 이름표 11", dl.cuts.length === 1 && dl.cuts[0][0][0] === dl.cuts[0].at(-1)[0] && dl.cuts[0][0][1] === dl.cuts[0].at(-1)[1] &&
        Math.abs(Math.max(...dl.cuts[0].map(p => p[0])) - 658) < 0.05 && Math.abs(Math.max(...dl.cuts[0].map(p => p[1])) - 770.5) < 0.05 && dl.folds.length === 16 && dl.panels.length === 11);
      console.log(`  ✓ [도면] 우리 윤곽 ${dl.cuts[0].length}점 → 실물 선: 중앙 ${med.toFixed(2)} · p90 ${p90.toFixed(2)} · max ${mx.toFixed(2)} mm · 접는선 ${dl.folds.length} · 이름표 ${dl.panels.length}`);
    }
    console.log(`  ✓ [칼선 직독] 실측 ${L.toFixed(1)}×${Sx.toFixed(1)} · gtype_tray 식 ${net.netH}×${net.netW} (Δ ${(net.netH - L).toFixed(1)} / +${(net.netW - Sx).toFixed(1)}) · gtype_spec 식 ${sp.netH}×${sp.netW} (Δ ${(sp.netH - L).toFixed(1)} / ${(sp.netW - Sx).toFixed(1)})`);
    console.log(`  ※ 파서 1순위는 ${r.bbox.w}×${r.bbox.h} — 칼선의 **오른쪽 절반뿐**이다(좌우 두 성분 · 좌우 병합은 막혀 있다). 문서화된 한계.`);
  } else console.log("  ⏭ 실물 칼선 PDF 가 없다(회사 폴더 · GTYPE_DIE 로 경로 지정) — **칼선은 읽지 않았다.** 견적서 대조만 돌았다.");
  console.log(`실물 견적서·칼선 대조 ${rOk}/${rOk + rFail.length} 통과`);
  for (const f of rFail) console.log(`  ✗ ${f}`);
  if (rFail.length) process.exitCode = 1;
}

// ══════════════════════════════════════════════════════════════════
//  G형 벽 두께 두 계열 — 실물 칼선 3장 (26-10-02)
//
//  사용자: 「(유니다 도면은) 골판지용이거나 옆벽을 두껍게 하면 저런 식으로 끼울 수 있게 만든다 — 그 부분 감안하고 봐라」.
//  접는선으로 재 보니 G형의 뼈대(긴 축 2D+3H · 짧은 축 W+4H)는 하나이고 **여유분이 벽 두께로 갈린다**:
//
//    두꺼운 옆벽(끼움형·골판지)  (W + 4H + 44) × (2D + 3H + 14.5)     ← 유니다 · 아이엠 2장이 **0.0mm** 로 맞는다
//       옆벽 한쪽 = 바깥벽 H+7.5 · 꼭대기 띠 8 · 안벽 H+6.5 (= 2H+22) · 뚜껑 폭 = W−14(양쪽 벽 두께만큼 좁다) · 뚜껑 길이 D+3
//         유니다 240809   W 94 · D 100 · H 75.5   → 440 × 441
//         아이엠 240807   W 394 · D 130 · H 45.5  → 620 × 411
//    얇은 옆벽(판지 단상자)      (W + 4H + 8)  × (2D + 3H + 0.5)      ← 모자 칼선 1장(트렌드스페이스 220×210×110 → 658 × 770.5)
//
//  gtype_tray 식 (W+4H+44.5)×(2D+3H+19.5) 은 **두꺼운 벽 계열**이다 — 두 칼선에 짧은 축 +0.5 · 긴 축 +5.0(식이 크다 = 안전측).
//  ⚠ 그래서 판지 견적 둘(마스크 재단 990×590 · 모자 재단 800×700)은 tray 식의 짧은 축(594.5 · 704.5)이 재단을 넘는다 —
//    그 둘은 얇은 벽이다. up·지대R 은 46전지 1up 이라 안 갈렸을 뿐이다.
//  ⚠ gtype-tray.mjs 가 아이엠을 「단벽 620×411 · 이 공식으로 재현되지 않는다(738.5×425)」고 적어 뒀는데 **틀린 기록**이었다 —
//    W·D·H 를 모른 채 넣은 값이고, 접는선으로 읽은 394×130×45.5 를 넣으면 620.5×416 으로 재현된다.
// ══════════════════════════════════════════════════════════════════
{
  console.log("\n═══ G형 벽 두께 두 계열 — 실물 칼선 3장 ═══════════════════════════════════════");
  let wOk = 0; const wFail = [];
  const wt = (label, cond, note = "") => { if (cond) wOk++; else wFail.push(label + (note ? " — " + note : "")); };
  const THICK = (W, D, H) => [W + 4 * H + 44, 2 * D + 3 * H + 14.5];
  const THIN  = (W, D, H) => [W + 4 * H + 8,  2 * D + 3 * H + 0.5];
  const DIES = [
    { name: "유니다 240809", fam: "두꺼운 벽", f: THICK, dims: [94, 100, 75.5],  bbox: [440, 441],
      file: "C:/이예찬_업무/private/도면/견적용도면/240809_유니다/240809_유니다.pdf", order: "wh" },
    { name: "아이엠 240807", fam: "두꺼운 벽", f: THICK, dims: [394, 130, 45.5], bbox: [620, 411],
      file: "C:/이예찬_업무/private/도면/견적용도면/240807_아이엠/G형.pdf", order: "wh" },
    // 모자 칼선은 뚜껑이 220 쪽으로 덮인다 — 짧은 축 바닥 변 210 을 W 로, 긴 축 변 220 을 D 로 넣는다.
    { name: "트렌드스페이스 모자", fam: "얇은 벽", f: THIN, dims: [210, 220, 110], bbox: [658, 770.5], file: null },
  ];
  for (const d of DIES) {
    const [W, D, H] = d.dims, [fw, fh] = d.f(W, D, H);
    wt(`${d.name} 계열식 = 실측`, Math.abs(fw - d.bbox[0]) <= 0.05 && Math.abs(fh - d.bbox[1]) <= 0.05, `식 ${fw}×${fh} vs ${d.bbox.join("×")}`);
    const tray = calcNetSize(W, D, H, "gtype_tray"), spec = calcNetSize(W, D, H, "gtype_spec");
    // 반대 계열 식은 **안 맞아야** 한다(이빨) — 짧은 축이 36 벌어진다.
    const other = d.f === THICK ? THIN(W, D, H) : THICK(W, D, H);
    wt(`${d.name} 반대 계열 식은 불일치(짧은 축 ±36)`, Math.abs(Math.abs(other[0] - d.bbox[0]) - 36) < 0.05);
    console.log(`  ✓ ${d.name.padEnd(12)} ${d.fam}  W${W}·D${D}·H${H} → 실측 ${d.bbox.join("×")} · 계열식 ${fw}×${fh} · tray식 ${tray.netW}×${tray.netH} (Δ ${(tray.netW - d.bbox[0]).toFixed(1)}/${(tray.netH - d.bbox[1]).toFixed(1)}) · spec식 ${spec.netW}×${spec.netH} (Δ ${(spec.netW - d.bbox[0]).toFixed(1)}/${(spec.netH - d.bbox[1]).toFixed(1)})`);
    if (d.fam === "얇은 벽") wt(`${d.name} gtype_spec 식 = 실측(0.05mm)`, Math.abs(spec.netW - d.bbox[0]) <= 0.05 && Math.abs(spec.netH - d.bbox[1]) <= 0.05, `${spec.netW}×${spec.netH}`);
    if (d.fam === "두꺼운 벽") wt(`${d.name} gtype_tray 식이 실측 이상(안전측) · 짧은 축 +0.5 · 긴 축 +5`, Math.abs(tray.netW - d.bbox[0] - 0.5) < 0.05 && Math.abs(tray.netH - d.bbox[1] - 5) < 0.05, `${tray.netW}×${tray.netH}`);
    if (d.file) {
      if (existsSync(d.file)) {
        const r = await readDieline(readFileSync(d.file), { source: d.name });
        wt(`[칼선] ${d.name} 파서 bbox = 박아 둔 실측`, Math.abs(r.bbox.w - d.bbox[0]) < 0.2 && Math.abs(r.bbox.h - d.bbox[1]) < 0.2, `${r.bbox.w}×${r.bbox.h}`);
      } else console.log(`  ⏭ ${d.name} 칼선 PDF 가 없다(회사 폴더) — **칼선은 읽지 않았다.** 박아 둔 실측값 대조만 돌았다.`);
    }
  }
  console.log(`G형 벽 두께 계열 대조 ${wOk}/${wOk + wFail.length} 통과`);
  for (const f of wFail) console.log(`  ✗ ${f}`);
  if (wFail.length) process.exitCode = 1;
}


// ══════════════════════════════════════════════════════════════════
//  G형 도면 생성기 — 칼선 없이 하는 검증 (26-10-08)
//
//  사용자: 「더는 G형 칼선을 얻을 수 없다 — 네가 직접 해라 · 할 수 있는 만큼 다 하고 검증까지」.
//  칼선 3장(모자 · 유니다 · 아이엠) 밖의 크기에서도 도면이 **물리적으로 성립하는지**를 잰다.
//    ① 접기 검사 스윕 — 두 생성기 × 175 크기(gtype-physics.mjs: 윤곽 단순성 · 전개도 안 · 덮개 · 날개·탭 접기 조건)
//    ② 검사기의 이빨 — 일부러 망가뜨린 도면을 각 검사가 잡는가(검사가 아무것도 안 재면 ①은 거짓 초록이다)
//    ③ 두꺼운 벽 도면 = 실물 2장 (치수는 박아 두고, 칼선 파일이 있으면 윤곽까지)
//    ④ 「H 비례」가 왜 틀렸나 — 한 장에서 H 비례로 다른 장을 예측하면 얼마나 빗나가는가 vs 우리 규칙
// ══════════════════════════════════════════════════════════════════
import { checkGtype, SWEEP } from "./gtype-physics.mjs";
import { thickGeom, thickPieces, SLACK as THICK_SLACK } from "../src/domain/dieline/gtype-tray.mjs";
{
  console.log("\n═══ G형 도면 생성기 — 칼선 없이 하는 검증 ═════════════════════════════════════");
  let gOk = 0; const gFail = [];
  const gt = (label, cond, note = "") => { if (cond) gOk++; else gFail.push(label + (note ? " — " + note : "")); };

  // ① 스윕
  for (const id of ["gtype_spec", "gtype_tray"]) {
    const bad = [];
    for (const [W, D, H] of SWEEP) bad.push(...checkGtype(dielinePieces(W, D, H, id), `${W}x${D}x${H}`));
    gt(`① ${id} 접기 검사 스윕 ${SWEEP.length}건 위반 0`, bad.length === 0, bad.slice(0, 3).join(" | "));
    console.log(`  ${bad.length ? "✗" : "✓"} ① ${id.padEnd(11)} 스윕 ${SWEEP.length}건 (W 40~500 · D 40~500 · H 10~200) — 위반 ${bad.length}`);
  }

  // ② 이빨 — 멀쩡한 도면을 하나씩 망가뜨린다
  const base = () => JSON.parse(JSON.stringify(dielinePieces(220, 210, 110, "gtype_tray")));
  const hits = (dl, code) => checkGtype(dl).some(b => b.split(" ")[1] === code);
  const T = [];
  { const d = base(); const o = d.cuts[0]; [o[5], o[40]] = [o[40], o[5]]; T.push(["G2 윤곽 꼬임", hits(d, "G2")]); }
  { const d = base(); d.cuts[0][7] = [d.net.netW + 9, 3]; T.push(["G3 전개도 밖", hits(d, "G3")]); }
  { const d = base(); d.pieces.splice(1, 1); T.push(["G4 덮개 빠짐", hits(d, "G4")]); }
  { const d = base(); d.pieces.push(d.pieces[0]); T.push(["G4 조각 겹침", hits(d, "G4")]); }
  { const d = base(); d.geo.flapFront = d.geo.sideLen; T.push(["P1 모서리날개 넘침", hits(d, "P1")]); }
  { const d = base(); d.geo.earDepth = d.geo.innerH + 5; T.push(["P2 옆날개 > 안벽", hits(d, "P2")]); }
  { const d = base(); d.geo.earSlantY = d.geo.lidLen; T.push(["P3 옆날개 > 뚜껑", hits(d, "P3")]); }
  { const d = base(); d.geo.shoulder = d.geo.earDepth + 5; T.push(["P4 어깨 > 옆날개", hits(d, "P4")]); }
  { const d = base(); d.geo.tabs[1] = [d.geo.tabs[0][0], d.geo.tabs[0][1]]; T.push(["P5 탭 겹침", hits(d, "P5")]); }
  for (const [name, ok] of T) gt(`② 이빨 — ${name} 을 잡는다`, ok);
  console.log(`  ${T.every(t => t[1]) ? "✓" : "✗"} ② 검사기 이빨 ${T.filter(t => t[1]).length}/${T.length} — ` + T.map(([n, ok]) => `${ok ? "" : "✗"}${n}`).join(" · "));

  // ③ 두꺼운 벽 = 실물 2장 — 접는선·윤곽에서 잰 치수(mm). 칼선 파일은 저장소 밖이라 수치를 박아 둔다.
  const THICK = [
    { name: "유니다 240809", dims: [94, 100, 75.5], file: "C:/이예찬_업무/private/도면/견적용도면/240809_유니다/240809_유니다.pdf",
      m: { xIn: 82, xSt: 90, xb: 173, xl0: 180, xf0: 176, yT: 80, yL: 183, yK: 263, yB: 363, yF: 441, E: 50, R: 50, rc: 8, fb: 47, ff: 50, tl: 25, W: 440 } },
    { name: "아이엠 240807", dims: [394, 130, 45.5], file: "C:/이예찬_업무/private/도면/견적용도면/240807_아이엠/G형.pdf",
      m: { xIn: 52, xSt: 60, xb: 113, xl0: 120, xf0: 116, yT: 50, yL: 183, yK: 233, yB: 363, yF: 411, E: 48, R: 42, rc: 5, fb: 62, ff: 65, tl: 33, W: 620 } },
  ];
  for (const t of THICK) {
    const g = thickGeom(...t.dims);
    const off = Object.entries(t.m).map(([k, v]) => [k, v, g[k]]).filter(([k, v, w]) => Math.abs(v - w) > (k === "tl" ? 0.6 : 0.05));
    gt(`③ ${t.name} 치수 ${Object.keys(t.m).length}개 = 실측`, off.length === 0, off.map(([k, v, w]) => `${k} 실측 ${v} · 우리 ${w}`).join(" · "));
    console.log(`  ${off.length ? "✗" : "✓"} ③ ${t.name}  치수 ${Object.keys(t.m).length - off.length}/${Object.keys(t.m).length} 일치 (꽂이 H+4.5 · 어깨 R${g.R}/r${g.rc} · 옆날개 ${g.E} · 모서리날개 ${g.fb}/${g.ff} · 탭 ${g.tl})` +
      (off.length ? "  어긋남: " + off.map(([k, v, w]) => `${k} ${v}→${w}`).join(" ") : ""));
    if (existsSync(t.file)) {
      const r = await readDieline(readFileSync(t.file), { source: t.name, maxCandidates: 4 });
      const polys = r.candidates[0].polygons.map(q => q.map(v => [v[0] ?? v.x, v[1] ?? v.y]));
      const xs = polys.flat().map(p => p[0]), ys = polys.flat().map(p => p[1]);
      const X0 = Math.min(...xs), Y1 = Math.max(...ys);
      const die = polys.map(q => q.map(([x, y]) => [x - X0, Y1 - y]));                  // 꽂이 끝 y=0 · 왼쪽 탭 끝 x=0
      const dseg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
        const u = L2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
        return Math.hypot(p[0] - (a[0] + u * dx), p[1] - (a[1] + u * dy)); };
      const dl = thickPieces(...t.dims);
      const ds = dl.cuts[0].map(([x, y]) => [x - THICK_SLACK.x, y - THICK_SLACK.y]).map(p => {
        let m = Infinity; for (const q of die) for (let i = 0; i + 1 < q.length; i++) m = Math.min(m, dseg(p, q[i], q[i + 1])); return m; }).sort((a, b) => a - b);
      const mx = ds.at(-1);
      gt(`③ [칼선] ${t.name} 우리 윤곽 → 실물 선 최대 ≤ 0.5mm`, mx <= 0.5, `최대 ${mx.toFixed(2)}`);
      console.log(`  ✓ ③ [칼선 직독] ${t.name}  우리 윤곽 ${ds.length}점 → 실물 선: 중앙 ${ds[ds.length >> 1].toFixed(2)} · 최대 ${mx.toFixed(2)} mm`);
    } else console.log(`  ⏭ ③ ${t.name} 칼선 PDF 가 없다(회사 폴더) — **윤곽은 대조하지 않았다.** 박아 둔 치수 대조만 돌았다.`);
  }

  // ④ H 비례 대안의 교차 예측 — 한 장의 장식 치수를 H 비례로 다른 장에 옮겼을 때 vs 우리 규칙
  const FEAT = { "옆날개 깊이": ["E"], "꽂이 어깨": ["R"], "뒷벽 모서리날개": ["fb"], "탭 길이": ["tl"] };
  const [A, B] = THICK;
  let worstProp = 0, worstRule = 0; const rows = [];
  for (const [nm, [k]] of Object.entries(FEAT)) for (const [src, dst] of [[A, B], [B, A]]) {
    const prop = src.m[k] * dst.dims[2] / src.dims[2];
    const rule = thickGeom(...dst.dims)[k];
    const eP = Math.abs(prop - dst.m[k]), eR = Math.abs(rule - dst.m[k]);
    worstProp = Math.max(worstProp, eP); worstRule = Math.max(worstRule, eR);
    rows.push(`${nm} ${src.name.slice(0, 3)}→${dst.name.slice(0, 3)}: 실측 ${dst.m[k]} · H비례 ${prop.toFixed(1)} · 규칙 ${rule}`);
  }
  gt("④ 우리 규칙의 교차 예측 오차 ≤ 0.6mm", worstRule <= 0.6, `최대 ${worstRule.toFixed(2)}`);
  gt("④ H 비례 대안은 크게 빗나간다(> 10mm) — 비례로 되돌리면 이 줄이 이유를 말해 준다", worstProp > 10, `최대 ${worstProp.toFixed(1)}`);
  console.log(`  ✓ ④ 교차 예측 최대 오차 — H 비례 ${worstProp.toFixed(1)}mm vs 우리 규칙 ${worstRule.toFixed(2)}mm`);
  for (const r of rows) console.log(`       ${r}`);

  console.log(`G형 도면 생성기 검증 ${gOk}/${gOk + gFail.length} 통과`);
  for (const f of gFail) console.log(`  ✗ ${f}`);
  if (gFail.length) process.exitCode = 1;
}

// ══════════════════════════════════════════════════════════════════
//  G형 도면 파일 내보내기 — tools/gtype-dieline.mjs (26-10-12)
//
//  사용자: 「일단 G형 전개도를 그리는 프로그램을 먼저 작성해 봐」. 그 프로그램이 쓰는 SVG · PDF · DXF 가
//  **앱 생성기와 같은 도형**인지 잰다. 핵심은 PDF 왕복이다 — 만든 PDF 를 앱 자신의 칼선 PDF 판독기(readDieline)로
//  다시 읽어 같은 크기가 나와야 한다(치수선·제목이 윤곽 후보를 가로채지 않는다). 통과하면 이 도면을 앱의
//  「칼선 PDF 올리기」에 넣어도 같은 판걸이가 나온다는 뜻이다.
// ══════════════════════════════════════════════════════════════════
import { buildSheet, renderSVG, renderPDF, renderDXF, main as dielineMain } from "../tools/gtype-dieline.mjs";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as pjoin } from "node:path";
{
  console.log("\n═══ G형 도면 파일 내보내기 — SVG · PDF · DXF (tools/gtype-dieline.mjs) ═══════════════");
  let eOk = 0; const eFail = [];
  const et = (label, cond, note = "") => { if (cond) eOk++; else eFail.push(label + (note ? " — " + note : "")); };
  const CASES = [["thin", 210, 220, 110], ["thin", 120, 80, 40], ["thin", 300, 60, 120], ["thick", 94, 100, 75.5], ["thick", 394, 130, 45.5], ["thick", 150, 60, 25]];
  for (const [wall, W, D, H] of CASES) {
    const S = buildSheet(W, D, H, wall), tag = `${wall} ${W}×${D}×${H}`;
    const nSeg = S.dl.cuts[0].length - 1, nFold = S.dl.folds.length;
    // PDF 왕복
    const r = await readDieline(renderPDF(S), { source: tag });
    const okPdf = Math.abs(r.bbox.w - S.box.w) < 0.05 && Math.abs(r.bbox.h - S.box.h) < 0.05;
    et(`${tag} PDF 왕복 — 앱 판독기가 읽은 크기 = 그린 윤곽`, okPdf, `읽힘 ${r.bbox.w}×${r.bbox.h} vs ${f2x(S.box.w)}×${f2x(S.box.h)}`);
    // DXF — 도면층별 선 수 · 좌표 유한
    const dx = renderDXF(S), lines = dx.text.split("\r\n");
    let cut = 0, crease = 0, bad = 0;
    for (let i = 0; i < lines.length - 1; i += 2) if (lines[i] === "0" && lines[i + 1] === "LINE") {
      // 0/LINE · 8/도면층 · 10,20,30,11,21,31/좌표 — 값은 코드 다음 줄이다
      const lay = lines[i + 3]; if (lay === "CUT") cut++; else if (lay === "CREASE") crease++;
      for (let j = i + 4; j < i + 16; j += 2) if (!/^[123][01]$/.test(lines[j]) || !Number.isFinite(Number(lines[j + 1]))) bad++;
    }
    et(`${tag} DXF CUT ${nSeg}변 · CREASE ${nFold}줄 · 좌표 유한`, cut === nSeg && crease === nFold && bad === 0 && dx.text.endsWith("EOF\r\n"), `CUT ${cut} · CREASE ${crease} · 비수치 ${bad}`);
    // SVG — 선 수 · 1:1 mm 크기
    const svg = renderSVG(S);
    const sc = (svg.match(/class="cut"/g) || []).length, sf = (svg.match(/class="crease"/g) || []).length;
    et(`${tag} SVG 칼선 ${S.dl.cuts.length} · 오시선 ${nFold} · 크기 mm`, sc === S.dl.cuts.length && sf === nFold && svg.includes(`width="${f2x(S.pageW)}mm"`), `cut ${sc} · crease ${sf}`);
    console.log(`  ${okPdf ? "✓" : "✗"} ${tag.padEnd(20)} 윤곽 ${f2x(S.box.w)}×${f2x(S.box.h)} · PDF 왕복 ${r.bbox.w}×${r.bbox.h} · DXF CUT ${cut}/CREASE ${crease} · SVG ${sc}/${sf}`);
  }
  // 명령줄 — 잘못된 입력은 1, 바른 입력은 파일 3개
  const dir = mkdtempSync(pjoin(tmpdir(), "gdl-"));
  const quiet = fn => { const l = console.log; console.log = () => {}; try { return fn(); } finally { console.log = l; } };
  const rcBad = quiet(() => dielineMain(["210", "220"])), rcGood = quiet(() => dielineMain(["210x220x110", "--out", dir]));
  const files = readdirSync(dir);
  et("명령줄 — 치수 2개면 실패(1) · 「210x220x110」이면 svg·pdf·dxf 3개", rcBad === 1 && rcGood === 0 && ["svg", "pdf", "dxf"].every(e => files.some(f => f.endsWith("." + e))), `rc ${rcBad}/${rcGood} · ${files.join(",")}`);
  let threw = false; try { buildSheet(210, 220, 110, "wide"); } catch { threw = true; }
  et("명령줄 — 모르는 --wall 은 거부", threw);
  rmSync(dir, { recursive: true, force: true });
  console.log(`  ✓ 명령줄 — 잘못된 입력 rc=${rcBad} · 바른 입력 rc=${rcGood} → ${files.length}개 파일`);
  console.log(`G형 도면 파일 내보내기 ${eOk}/${eOk + eFail.length} 통과`);
  for (const f of eFail) console.log(`  ✗ ${f}`);
  if (eFail.length) process.exitCode = 1;
}
function f2x(v) { return (Math.round(v * 100) / 100).toString(); }

#!/usr/bin/env node
// ══════════════════════════════════════════════════════════════════
//  tools/gtype-dieline.mjs — G형(톰슨조립형) 전개도를 **도면 파일**로 뽑는 프로그램 (26-10-12)
//
//  사용자: 「일단 G형 전개도를 그리는 프로그램을 먼저 작성해 봐 — 지금 있는 전개도들, G형 톰슨조립」.
//  치수(W×D×H)를 넣으면 1:1 mm 축척의 SVG · PDF · DXF 를 쓴다. 칼선 = 빨강 실선 · 오시선 = 파랑 점선.
//
//  ★ 도형은 **앱과 같은 생성기**를 부른다(src/domain/dieline). 이 파일은 그리기만 한다 — 값이 두 벌이 되면
//    앱 견적과 도면 파일이 서로 다른 상자를 말하게 된다.
//      --wall thin  (기본) 판지 · 얇은 옆벽 = gtype_spec  (실물 칼선: 모자 220×210×110 · 최대 1.0mm)
//      --wall thick        두꺼운 옆벽 · 끼움형 = gtype_tray (실물 칼선: 유니다 · 아이엠 · 최대 0.10 / 0.23mm)
//  ⚠ 이것은 **견적용 참고 도면**이다. 실물 칼선 3장에서 세운 규칙으로 그린 것이고, 목형 업체의 최종 칼선을 대신하지 않는다.
//    W·D 는 「뚜껑이 덮어 가는 변 = D」다(실물 2건은 긴 변이 D 였다).
//
//  쓰는 법
//    node tools/gtype-dieline.mjs 210 220 110                 → dieline-out/G형_thin_210x220x110.{svg,pdf,dxf}
//    node tools/gtype-dieline.mjs 94 100 75.5 --wall thick
//    node tools/gtype-dieline.mjs 210 220 110 --out D:/도면 --only pdf
//    npm run dieline:g -- 210 220 110
// ══════════════════════════════════════════════════════════════════
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dielinePieces } from "../src/domain/dieline/index.mjs";

export const STRUCT = { thin: "gtype_spec", thick: "gtype_tray" };
const WALL_KO = { thin: "판지 · 얇은 옆벽", thick: "두꺼운 옆벽 · 끼움형" };
const WALL_EN = { thin: "board / thin side wall", thick: "thick side wall / tuck-in" };
// PDF·DXF 는 한글 글꼴을 싣지 않는다(설치·임베드 없이) — 패널 이름은 영문으로 쓴다.
const EN = { "꽂이": "TUCK", "뚜껑": "LID", "뒷벽": "BACK", "바닥": "BASE", "앞벽": "FRONT", "옆벽": "SIDE",
             "바깥벽": "OUTER WALL", "안벽": "INNER WALL", "날개": "EAR" };

const M = 20, TITLE = 26, DIM = 9;   // 여백 · 제목칸 높이 · 치수선 거리 (mm)

/** 도면 한 장의 공통 데이터 — 세 형식이 이것 하나를 그린다. */
export function buildSheet(W, D, H, wall = "thin") {
  const id = STRUCT[wall];
  if (!id) throw new Error(`--wall 은 thin 또는 thick 이다 (받은 값: ${wall})`);
  if (![W, D, H].every(v => Number.isFinite(v) && v > 0)) throw new Error(`치수는 양수여야 한다: ${W} × ${D} × ${H}`);
  const dl = dielinePieces(W, D, H, id);
  if (!dl?.cuts?.length) throw new Error(`${id} 가 도면을 내지 않았다 — 구조 레지스트리를 확인해라`);
  const o = dl.cuts[0];
  const bx0 = Math.min(...o.map(p => p[0])), by0 = Math.min(...o.map(p => p[1]));
  const bx1 = Math.max(...o.map(p => p[0])), by1 = Math.max(...o.map(p => p[1]));
  return {
    W, D, H, wall, id, dl, net: dl.net,
    box: { x0: bx0, y0: by0, x1: bx1, y1: by1, w: bx1 - bx0, h: by1 - by0 },   // 그린 윤곽의 크기(두꺼운 벽은 식의 여백만큼 net 보다 작다)
    pageW: dl.net.netW + 2 * M + DIM, pageH: dl.net.netH + 2 * M + DIM + TITLE,
    ox: M + DIM, oy: M + DIM,                                                  // 도면 원점(전개도 좌상단)의 종이 위 위치
  };
}

const f2 = v => (Math.round(v * 100) / 100).toString();
const mm = v => `${f2(v)} mm`;

// ── SVG ───────────────────────────────────────────────────────────
export function renderSVG(S) {
  const { dl, box, ox, oy, pageW, pageH } = S;
  const P = ([x, y]) => `${f2(x + ox)},${f2(y + oy)}`;
  const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${f2(pageW)}mm" height="${f2(pageH)}mm" viewBox="0 0 ${f2(pageW)} ${f2(pageH)}">`);
  out.push(`<rect width="100%" height="100%" fill="#fff"/>`);
  out.push(`<g fill="none" stroke-linejoin="round">`);
  for (const f of dl.folds) out.push(`<polyline class="crease" points="${f.map(P).join(" ")}" stroke="#0066cc" stroke-width="0.3" stroke-dasharray="3 2"/>`);
  for (const c of dl.cuts) out.push(`<polyline class="cut" points="${c.map(P).join(" ")}" stroke="#e00000" stroke-width="0.35"/>`);
  out.push(`</g>`);
  out.push(`<g font-family="Malgun Gothic, sans-serif" font-size="5" fill="#777" text-anchor="middle" dominant-baseline="central">`);
  for (const p of dl.panels || []) out.push(`<text x="${f2((p.x0 + p.x1) / 2 + ox)}" y="${f2(p.y + oy)}">${esc(p.label)}</text>`);
  out.push(`</g>`);
  out.push(dimsSVG(S));
  const ty = pageH - TITLE + 2;
  out.push(`<g font-family="Malgun Gothic, sans-serif" fill="#222">`,
    `<line x1="${M}" y1="${ty - 2}" x2="${f2(pageW - M)}" y2="${ty - 2}" stroke="#999" stroke-width="0.2"/>`,
    `<text x="${M}" y="${ty + 6}" font-size="6" font-weight="bold">G형 톰슨조립 — ${esc(WALL_KO[S.wall])} · W ${f2(S.W)} × D ${f2(S.D)} × H ${f2(S.H)} mm</text>`,
    `<text x="${M}" y="${ty + 13}" font-size="4.2">전개도 ${mm(box.w)} × ${mm(box.h)} · 칼선 ━ 빨강 · 오시선 ┅ 파랑 · 1:1 축척(mm) · 견적용 참고 도면 — 목형 업체 최종 칼선이 아니다</text>`,
    `<text x="${M}" y="${ty + 19}" font-size="3.6" fill="#777">D = 뚜껑이 덮어 가는 변 · 생성: cria-quote ${S.id}${S.net.warning ? " · ⚠ " + esc(S.net.warning) : ""}</text>`,
    `</g>`);
  out.push(`</svg>`);
  return out.join("\n");
}
function dimsSVG(S) {
  const { box, ox, oy } = S;
  const x0 = box.x0 + ox, x1 = box.x1 + ox, y0 = box.y0 + oy, y1 = box.y1 + oy, yd = y0 - DIM + 2, xd = x0 - DIM + 2;
  const a = (x, y, dx, dy) => `<path d="M${f2(x)},${f2(y)} l${f2(dx * 2 + dy * 0.8)},${f2(dy * 2 + dx * 0.8)} l${f2(-dy * 1.6)},${f2(-dx * 1.6)} z" fill="#444"/>`;
  return [`<g stroke="#444" stroke-width="0.2" font-family="Malgun Gothic, sans-serif" font-size="4.5" fill="#222" text-anchor="middle">`,
    `<line x1="${f2(x0)}" y1="${f2(yd)}" x2="${f2(x1)}" y2="${f2(yd)}"/>`,
    `<line x1="${f2(x0)}" y1="${f2(yd - 2)}" x2="${f2(x0)}" y2="${f2(y0)}" stroke-dasharray="1 1"/><line x1="${f2(x1)}" y1="${f2(yd - 2)}" x2="${f2(x1)}" y2="${f2(y0)}" stroke-dasharray="1 1"/>`,
    a(x0, yd, 1, 0), a(x1, yd, -1, 0),
    `<text x="${f2((x0 + x1) / 2)}" y="${f2(yd - 1.5)}" stroke="none">${mm(box.w)}</text>`,
    `<line x1="${f2(xd)}" y1="${f2(y0)}" x2="${f2(xd)}" y2="${f2(y1)}"/>`,
    `<line x1="${f2(xd - 2)}" y1="${f2(y0)}" x2="${f2(x0)}" y2="${f2(y0)}" stroke-dasharray="1 1"/><line x1="${f2(xd - 2)}" y1="${f2(y1)}" x2="${f2(x0)}" y2="${f2(y1)}" stroke-dasharray="1 1"/>`,
    a(xd, y0, 0, 1), a(xd, y1, 0, -1),
    `<text x="${f2(xd - 1.5)}" y="${f2((y0 + y1) / 2)}" stroke="none" transform="rotate(-90 ${f2(xd - 1.5)} ${f2((y0 + y1) / 2)})">${mm(box.h)}</text>`,
    `</g>`].join("\n");
}

// ── PDF (설치 없이 손으로 쓴다 · PDF 1.4 · 무압축 · 좌표 pt) ─────────────────
export function renderPDF(S) {
  const { dl, box, ox, oy, pageW, pageH } = S;
  const k = 72 / 25.4;
  const X = x => f2((x + ox) * k), Y = y => f2((pageH - (y + oy)) * k);
  const path = pts => pts.map(([x, y], i) => `${X(x)} ${Y(y)} ${i ? "l" : "m"}`).join(" ") + " S";
  const txt = (x, y, size, s, gray = 0.2) =>
    `BT /F1 ${size} Tf ${gray} g ${f2(x * k)} ${f2((pageH - y) * k)} Td (${String(s).replace(/[\\()]/g, m => "\\" + m)}) Tj ET`;
  const c = [];
  c.push("1 J 1 j");
  c.push(`0 0.4 0.8 RG ${f2(0.3 * k)} w [${f2(3 * k)} ${f2(2 * k)}] 0 d`);
  for (const f of dl.folds) c.push(path(f));
  c.push(`0.88 0 0 RG ${f2(0.35 * k)} w [] 0 d`);
  for (const cu of dl.cuts) c.push(path(cu));
  for (const p of dl.panels || []) {
    const s = EN[p.label] || p.label, size = 9;
    c.push(txt((p.x0 + p.x1) / 2 + ox - s.length * size * 0.28 / k, p.y + oy + size * 0.35 / k, size, s, 0.55));
  }
  // 치수선 (회색 · 윤곽과 떨어진 열린 선 — 칼선 PDF 로 다시 읽혀도 윤곽 후보가 되지 않는다)
  const yd = box.y0 - DIM + 2, xd = box.x0 - DIM + 2;
  c.push(`0.35 G ${f2(0.2 * k)} w [] 0 d`);
  c.push(path([[box.x0, yd], [box.x1, yd]]), path([[xd, box.y0], [xd, box.y1]]));
  c.push(txt((box.x0 + box.x1) / 2 + ox - 10, yd + oy - 1.5, 10, `${f2(box.w)} mm`));
  c.push(txt(xd + ox - 1, box.y0 + oy - 2.5, 10, `${f2(box.h)} mm (height)`));
  const ty = pageH - TITLE + 2;
  c.push(txt(M, ty + 6, 14, `G-TYPE (tuck-in tray) - ${WALL_EN[S.wall]} - W ${f2(S.W)} x D ${f2(S.D)} x H ${f2(S.H)} mm`, 0.1));
  c.push(txt(M, ty + 13, 10, `Net ${f2(box.w)} x ${f2(box.h)} mm  |  CUT = red solid  |  CREASE = blue dashed  |  scale 1:1 (mm)  |  estimate reference, not a final die line`, 0.25));
  c.push(txt(M, ty + 19, 9, `D = the side the lid closes over  |  generated by cria-quote ${S.id}`, 0.45));
  const content = c.join("\n");
  const objs = [
    `<< /Type /Catalog /Pages 2 0 R >>`,
    `<< /Type /Pages /Kids [3 0 R] /Count 1 >>`,
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${f2(pageW * k)} ${f2(pageH * k)}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>`,
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    `<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>`,
  ];
  let body = "%PDF-1.4\n";
  const off = [];
  objs.forEach((o, i) => { off.push(body.length); body += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = body.length;
  body += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map(v => String(v).padStart(10, "0") + " 00000 n \n").join("");
  body += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body, "latin1");
}

// ── DXF (R12 · 도면층 CUT 빨강 실선 · CREASE 파랑 DASHED · TEXT · 좌표 mm · y 위로) ─────
export function renderDXF(S) {
  const { dl, net } = S;
  const Y = y => f2(net.netH - y);
  const L = [];
  const g = (code, v) => L.push(String(code), String(v));
  g(0, "SECTION"); g(2, "HEADER"); g(9, "$ACADVER"); g(1, "AC1009"); g(9, "$INSUNITS"); g(70, 4); g(0, "ENDSEC");
  g(0, "SECTION"); g(2, "TABLES");
  g(0, "TABLE"); g(2, "LTYPE"); g(70, 2);
  g(0, "LTYPE"); g(2, "CONTINUOUS"); g(70, 0); g(3, "Solid line"); g(72, 65); g(73, 0); g(40, "0.0");
  g(0, "LTYPE"); g(2, "DASHED"); g(70, 0); g(3, "__ __ __"); g(72, 65); g(73, 2); g(40, "5.0"); g(49, "3.0"); g(49, "-2.0");
  g(0, "ENDTAB");
  g(0, "TABLE"); g(2, "LAYER"); g(70, 3);
  for (const [name, color, lt] of [["CUT", 1, "CONTINUOUS"], ["CREASE", 5, "DASHED"], ["TEXT", 7, "CONTINUOUS"]]) {
    g(0, "LAYER"); g(2, name); g(70, 0); g(62, color); g(6, lt);
  }
  g(0, "ENDTAB"); g(0, "ENDSEC");
  g(0, "SECTION"); g(2, "ENTITIES");
  const line = (layer, a, b) => { g(0, "LINE"); g(8, layer); g(10, f2(a[0])); g(20, Y(a[1])); g(30, "0.0"); g(11, f2(b[0])); g(21, Y(b[1])); g(31, "0.0"); };
  let nCut = 0, nCrease = 0;
  for (const c of dl.cuts) for (let i = 0; i + 1 < c.length; i++) { line("CUT", c[i], c[i + 1]); nCut++; }
  for (const f of dl.folds) for (let i = 0; i + 1 < f.length; i++) { line("CREASE", f[i], f[i + 1]); nCrease++; }
  for (const p of dl.panels || []) { g(0, "TEXT"); g(8, "TEXT"); g(10, f2((p.x0 + p.x1) / 2)); g(20, Y(p.y)); g(30, "0.0"); g(40, "5.0"); g(1, EN[p.label] || p.label); g(72, 1); g(11, f2((p.x0 + p.x1) / 2)); g(21, Y(p.y)); g(31, "0.0"); }
  g(0, "TEXT"); g(8, "TEXT"); g(10, "0.0"); g(20, f2(-12)); g(30, "0.0"); g(40, "6.0");
  g(1, `G-TYPE ${S.wall.toUpperCase()} W${f2(S.W)} x D${f2(S.D)} x H${f2(S.H)} mm  net ${f2(S.box.w)} x ${f2(S.box.h)}`);
  g(0, "ENDSEC"); g(0, "EOF");
  return { text: L.join("\r\n") + "\r\n", nCut, nCrease };
}

// ── 명령줄 ────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { wall: "thin", out: "dieline-out", only: null, nums: [] };
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t === "--wall") a.wall = argv[++i];
    else if (t === "--out") a.out = argv[++i];
    else if (t === "--only") a.only = argv[++i].split(",");
    else if (t === "-h" || t === "--help") a.help = true;
    else a.nums.push(Number(String(t).replace(/[x×*]/gi, " ").trim()));
  }
  // 「210x220x110」 한 덩어리도 받는다
  if (a.nums.length === 1 && Number.isNaN(a.nums[0])) a.nums = [];
  const one = argv.find(t => /^\d+(\.\d+)?[x×*]\d+(\.\d+)?[x×*]\d+(\.\d+)?$/i.test(t));
  if (one) a.nums = one.split(/[x×*]/i).map(Number);
  return a;
}

export function main(argv) {
  const a = parseArgs(argv);
  if (a.help || a.nums.length !== 3) {
    console.log("쓰는 법: node tools/gtype-dieline.mjs W D H [--wall thin|thick] [--out 폴더] [--only svg,pdf,dxf]\n" +
                "  예) node tools/gtype-dieline.mjs 210 220 110\n      node tools/gtype-dieline.mjs 94x100x75.5 --wall thick\n" +
                "  D = 뚜껑이 덮어 가는 변 · thin = 판지 얇은 옆벽(기본) · thick = 두꺼운 옆벽 끼움형");
    return a.help ? 0 : 1;
  }
  const [W, D, H] = a.nums;
  const S = buildSheet(W, D, H, a.wall);
  const dir = resolve(a.out);
  mkdirSync(dir, { recursive: true });
  const base = join(dir, `G형_${a.wall}_${f2(W)}x${f2(D)}x${f2(H)}`);
  const want = k => !a.only || a.only.includes(k);
  const wrote = [];
  if (want("svg")) { writeFileSync(base + ".svg", renderSVG(S), "utf8"); wrote.push(base + ".svg"); }
  if (want("pdf")) { writeFileSync(base + ".pdf", renderPDF(S)); wrote.push(base + ".pdf"); }
  let dx = null;
  if (want("dxf")) { dx = renderDXF(S); writeFileSync(base + ".dxf", dx.text, "latin1"); wrote.push(base + ".dxf"); }
  console.log(`G형 톰슨조립 — ${WALL_KO[a.wall]} (${S.id})  W ${W} × D ${D} × H ${H} mm`);
  console.log(`  전개도 ${f2(S.box.w)} × ${f2(S.box.h)} mm  (견적 계산 크기 ${f2(S.net.netW)} × ${f2(S.net.netH)})`);
  console.log(`  칼선 ${S.dl.cuts[0].length - 1}변 · 오시선 ${S.dl.folds.length}줄 · 패널 ${S.dl.panels.length}`);
  if (S.net.warning) console.log(`  ⚠ ${S.net.warning}`);
  for (const w of wrote) console.log(`  → ${w}`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));

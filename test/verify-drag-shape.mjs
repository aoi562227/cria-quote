// ══════════════════════════════════════════════════════════════════
//  손배치 충돌 도형 검증 — src/ui/viz/nest-drag.mjs 를 **직접 import** 한다
//
//  왜 이 파일이 필요한가
//  ──────────────────
//  PDF 칼선이 **정확한 도형**으로 쓰이느냐가 손배치·자동네스팅·쇼룸 전부의 입력 품질을
//  결정한다. 그런데 이 경로는 **조용히 나빠진다.** 실측 3건이 전부 bbox·볼록껍질로
//  떨어져 있던 시절에도 앱은 에러 없이 잘 돌았다 — 스냅이 무뎌졌을 뿐이라
//  화면만 봐서는 「원래 이런가 보다」로 읽힌다. 4주를 그렇게 보냈다.
//  그래서 **mode 문자열을 못 박는다.** 이 파일의 존재 이유가 그것이다.
//
//   §A 실측 3건 mode 고정   ← 재발 방지의 핵심. bbox 로 되떨어지면 여기서 죽는다
//   §B 담기 계측            실물 칼선 표본이 전부 충돌 도형 **안**에 있는가 (겹침 안전)
//   §C 오목→볼록 분해 커버리지  격자 샘플링. **NFP 도 nest-drag 의 겹침 판정도 안 쓴다**
//   §D 게이트에 이빨이 있는가   일부러 도형을 줄여 담기 게이트가 잡아내는지 (돌연변이)
//   §E 결정성 · 조각수 상한
//
//  ★ 안전 방향 (이 스위트가 무엇을 편드는지)
//  ─────────────────────────────────────
//  충돌 도형이 실물보다 **작아지면 겹친다 = 목형이 깨진다(critical).**
//  **커지면 up 이 줄 뿐이다(안전).** 그래서 §B·§C·§D 는 전부 「덜 덮었는가」만
//  실패로 센다. 더 덮은 것은 숫자로 적되 실패가 아니다.
//
//  ⚠ SKIP 규약 — 조용히 통과하지 않는다
//  ─────────────────────────────────
//  §A·§B 의 실측 PDF 는 고객사 도면이라 `test-pdf/` 에 두고 **.gitignore 로 막았다**
//  (ARCHITECTURE §9 「브라우저 확인 방법」). 그래서 CI·클린 클론에는 없는 것이 정상이다.
//  없으면 SKIP 하고 **SKIP 했다고 크게 찍는다.** 점수 문자열도 「점수 아님」으로 바뀐다.
//  §C·§D·§E 는 합성 도형이라 **어디서나 돈다** — 파일이 없어도 분해 불변식은 계속 지킨다.
//  실측 PDF 를 다른 곳에 두었으면:  DRAG_PDF_DIR=D:/칼선  node test/verify-drag-shape.mjs
// ══════════════════════════════════════════════════════════════════
import fs from "node:fs";
import { readDieline } from "../src/domain/pdf-dieline.mjs";
import {
  makeDragPart, decomposePolylines, pdfLocalPolylines, ringToPieces, leakOf, MAX_PIECES,
} from "../src/ui/viz/nest-drag.mjs";

let PASS = 0;
const FAIL = [], NOTE = [];
function check(label, ok, detail) {
  if (ok) { PASS++; return true; }
  FAIL.push([label, detail]);
  return false;
}

// ══════════════════════════════════════════════════════════════════
//  독립 기하 — **nest-drag 에서 가져오지 않는다**
//
//  §C 가 재려는 것이 「nest-drag 의 분해가 맞는가」라서, 판정까지 nest-drag 것을 쓰면
//  같은 실수를 두 번 저지르고 통과한다 (verify-nest.mjs 머리말과 같은 철학).
//  그래서 점-다각형 판정을 여기서 새로 짠다.
// ══════════════════════════════════════════════════════════════════

/** 홀짝 광선 교차 (오목 다각형용). 경계는 정의하지 않는다 — 표본을 경계에서 비켜 찍는다. */
function inRingEvenOdd(p, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > p[1]) !== (yj > p[1]) &&
        p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** 볼록 조각 하나 안쪽인가 — 모든 에지의 같은 편. CW/CCW 어느 쪽이든 받는다. */
function inConvexPoly(p, poly) {
  let neg = false, pos = false;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
    if (c < -1e-9) neg = true;
    if (c > 1e-9) pos = true;
    if (neg && pos) return false;
  }
  return true;
}
const inUnion = (p, pieces) => pieces.some(q => inConvexPoly(p, q));

const bboxOfPts = pts => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
};

/**
 * ★ §C 의 계측기 — 오목 링과 볼록 조각들을 격자로 훑어 **면적으로** 비교한다.
 *
 * 표본은 반칸 + 무리수 몫만큼 밀어 찍는다. 격자선이 축평행 변과 정확히 겹치면
 * 홀짝 판정이 경계에서 흔들려 없는 오차가 생긴다 — 그러면 이 계측기 자체를 못 믿는다.
 *
 * @returns {{n, under, over, underArea, overArea, step}}
 *   under = 링 안인데 조각 밖 (**위험** — 실물보다 작다)
 *   over  = 링 밖인데 조각 안 (안전 — 크게 틀렸다)
 */
function coverage(ring, pieces, step) {
  const b = bboxOfPts(ring);
  const OFF = 0.31830988618;                       // 1/π — 격자선·변 정렬을 깬다
  let n = 0, under = 0, over = 0;
  for (let x = b.x0 + step * OFF; x < b.x1; x += step)
    for (let y = b.y0 + step * (1 - OFF); y < b.y1; y += step) {
      const p = [x, y];
      const a = inRingEvenOdd(p, ring), c = inUnion(p, pieces);
      if (a) n++;
      if (a && !c) under++;
      if (!a && c) over++;
    }
  const cell = step * step;
  return { n, under, over, underArea: +(under * cell).toFixed(4), overArea: +(over * cell).toFixed(4), step };
}

// ══════════════════════════════════════════════════════════════════
//  §A · §B  실측 칼선 PDF
// ══════════════════════════════════════════════════════════════════
//  기대 mode 의 근거 (26-08-16 계측, 이 저장소의 t-*.pdf = 고객사 원본과 바이트 동일):
//    t-wake2 p0 · p1 · t-ishap → raster.  종전 코드는 셋 다 **bbox** 였다.
//      원인은 래스터가 축당 ~+1칸 커지는데 makeDragPart 의 |Δ|>0.6mm 게이트가
//      cell 하한 0.8mm 를 원리적으로 못 넘어 결과를 통째로 버린 것. 지금은
//      fitRingToBox 가 칼선 bbox 로 정규화하고, 게이트는 「정규화가 됐는지」만 본다.
//    t-sosco → hull.  **입력에 벽이 없다** — 채택 후보의 열린 끝 하나가 다른 어떤
//      폴리라인에서도 130.30mm 떨어져 있다(몸통 윗변 y=15 이 x 24~337 구간에서 안
//      그려져 있다). 벽을 1칸 부풀리는 래스터로 그 틈을 막으려면 cell ≥ 65.15mm 라
//      어떤 격자로도 못 푼다. 수치와 규명은 nest-drag.mjs 래스터 절 주석에 있다.
//      → 껍질은 실물의 **상위집합**이라 겹침을 놓치지 않는다. 그래서 유지한다.
const DIR = process.env.DRAG_PDF_DIR ?? new URL("../test-pdf", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ORACLE = process.env.PDF_ORACLE_DIR ?? "C:/이예찬_업무/연도별/2026";
const CASES = [
  { id: "t-sosco", page: 0, mode: "hull",   bbox: [380.3, 223.5],
    alt: `${ORACLE}/고객사_진행중단/소스코/디자인/삼면접착140x43x130.pdf`,
    why: "채택 후보의 윤곽이 불완전 — 열린 끝 최대 이격 130.30mm (nest-drag 래스터 절 주석)" },
  { id: "t-wake2", page: 0, mode: "raster", bbox: [198.3, 234.0],
    alt: `${ORACLE}/고객사_진행중단/웨이크버니/디자인/웨이크버니삼면접착2종.pdf` },
  { id: "t-wake2", page: 1, mode: "raster", bbox: [158.3, 247.0],
    alt: `${ORACLE}/고객사_진행중단/웨이크버니/디자인/웨이크버니삼면접착2종.pdf` },
  { id: "t-ishap", page: 0, mode: "raster", bbox: [557.1, 324.16],
    alt: `${ORACLE}/고객사_진행중단/iSHAP/디자인/무제-3.pdf` },
];

/** BoxSpec.loadPdf 와 **같은 규칙**으로 기본 후보를 고른다 (pdfPickOf 가 읽을 pickIdx).
 *  candidates[0] 을 쓰면 iSHAP 에서 도련 569.0×335.7 을 잡아 실제 앱 경로와 갈린다. */
const pickOf = r => {
  const i = Math.max(0, (r.candidates || []).findIndex(c => c.chosen));
  return r.candidates?.[i] ?? { bbox: { w: r.bbox.w, h: r.bbox.h, x0: 0, y0: 0 }, polygons: r.polygons };
};

const found = [], missing = [];
for (const c of CASES) {
  const local = `${DIR}/${c.id}.pdf`;
  c.file = fs.existsSync(local) ? local : (fs.existsSync(c.alt) ? c.alt : null);
  (c.file ? found : missing).push(c);
}

console.log("═══ §A 실측 칼선 → 충돌 도형 mode 고정 ═════════════════════════════════");
console.log(`${"파일".padEnd(16)}${"칼선 bbox".padEnd(17)}${"mode".padEnd(9)}${"조각".padEnd(6)}${"Δ(부품−칼선)".padEnd(19)}담기(이탈)`);
console.log("─".repeat(94));

const realRings = [];
for (const c of found) {
  const r = await readDieline(new Uint8Array(fs.readFileSync(c.file)), { source: c.id, page: c.page, maxCandidates: 20 });
  const pick = pickOf(r);
  const loc = pdfLocalPolylines(pick);
  const w = pick.bbox.w, h = pick.bbox.h;
  const P = makeDragPart({ polylines: loc, w, h });
  const tag = `${c.id} p${c.page}`;

  if (!P) { check(`${tag} — 부품 생성`, false, "makeDragPart → null"); continue; }

  // §B 담기 계측. step 0.05mm 는 화면 근사(0.15~0.5mm)보다 훨씬 촘촘하다 —
  //    「게이트가 쓰는 표본으로 게이트를 검사」하면 통과가 보장되므로 일부러 더 조인다.
  const L = leakOf(loc, P.base.pieces, 0.05, Infinity);
  const dW = P.w - w, dH = P.h - h;
  console.log(`${tag.padEnd(16)}${(w + "×" + h).padEnd(17)}${P.mode.padEnd(9)}${String(P.pieceCount).padEnd(6)}` +
              `${((dW >= 0 ? "+" : "") + dW.toFixed(3) + " / " + (dH >= 0 ? "+" : "") + dH.toFixed(3)).padEnd(19)}` +
              `${L.n.toLocaleString()}표본 ${L.worst.toFixed(4)}mm`);

  // ★ 이 줄이 이 파일의 핵심이다. mode 가 bbox 로 되떨어지면 여기서 죽는다.
  check(`${tag} — mode = ${c.mode}`, P.mode === c.mode, `mode=${P.mode} · note=${(P.note || "").slice(0, 120)}`);
  check(`${tag} — 칼선 bbox 재현`, Math.abs(w - c.bbox[0]) <= 0.5 && Math.abs(h - c.bbox[1]) <= 0.5,
        `추출 ${w}×${h} (기대 ${c.bbox.join("×")})`);
  // 부품 bbox 는 칼선 bbox 와 **같아야** 한다. 다르면 그린 칸과 막는 도형이 어긋난다.
  check(`${tag} — 부품 bbox = 칼선 bbox`, Math.abs(dW) <= 0.05 && Math.abs(dH) <= 0.05,
        `Δ ${dW.toFixed(3)}/${dH.toFixed(3)}`);
  // ★ 안전 방향: 실물 칼선이 도형 밖으로 새면 안 된다 (새면 손배치가 겹침을 놓친다)
  check(`${tag} — 실물 칼선이 도형 밖으로 안 샌다`, L.out === 0 && L.worst <= 0.02,
        `${L.out}/${L.n} 표본이 밖, 최대 이탈 ${L.worst}mm`);
  check(`${tag} — 조각수 ≤ ${MAX_PIECES}`, P.pieceCount <= MAX_PIECES, `${P.pieceCount}조각`);
  if (c.mode === "raster")
    check(`${tag} — 실제로 오목하게 쪼개졌다(조각 ≥ 2)`, P.pieceCount >= 2,
          `${P.pieceCount}조각 — 1조각이면 bbox·껍질과 다를 게 없다`);
  // §E 결정성 — 같은 입력이 같은 도형을 내야 한다 (드래그 중 도형이 바뀌면 스냅이 튄다)
  const P2 = makeDragPart({ polylines: loc, w, h });
  check(`${tag} — 결정성`, JSON.stringify(P2.base.pieces) === JSON.stringify(P.base.pieces), "두 번 부른 결과가 다르다");

  if (c.mode === "hull")
    NOTE.push(`${tag}: mode=hull 은 **알려진 한계**다 — ${c.why}. 껍질은 상위집합이라 안전하지만 맞물림은 못 한다.`);

  const d = decomposePolylines(loc, { w, h });
  if (d.ring) realRings.push([tag, d.ring, d.pieces]);
}

if (missing.length) {
  console.log("");
  console.log("⊘".repeat(1) + ` SKIP — 실측 PDF ${missing.length}건을 못 읽었다 (§A·§B 미실행)`);
  for (const c of missing) console.log(`   · ${c.id} p${c.page}  →  ${DIR}/${c.id}.pdf  (대안 ${c.alt})`);
  console.log("   test-pdf/ 는 고객사 도면이라 .gitignore 로 막혀 있다 — CI·클린 클론에서는 정상이다.");
  console.log("   다른 위치에 두었으면:  DRAG_PDF_DIR=<뿌리> node test/verify-drag-shape.mjs");
}

// ══════════════════════════════════════════════════════════════════
//  §C  오목 → 볼록 분해가 원본을 **덜 덮지 않는가** (격자 샘플링)
//
//  왜 별도로 재나 — §B 는 「칼선(선)」이 도형 안에 있는지만 본다. 귀 자르기가 귀를
//  하나 빼먹어 **면** 한 조각이 통째로 빠져도 테두리 선은 여전히 다른 조각 안에 있을
//  수 있다. 빠진 면에는 다른 부품이 파고들어 앉는다 = 겹침. 그래서 면적으로 따로 잰다.
//  합성 도형이라 **PDF 없이도 돈다** — 이 절이 CI 의 실질 게이트다.
// ══════════════════════════════════════════════════════════════════
console.log("\n═══ §C 오목 링 → 볼록 조각 커버리지 (격자 샘플링 · NFP 미사용) ═══════════");
console.log(`${"도형".padEnd(26)}${"정점".padEnd(6)}${"조각".padEnd(6)}${"링 안 표본".padEnd(12)}${"덜 덮음".padEnd(20)}더 덮음`);
console.log("─".repeat(94));

const SHAPES = [
  ["L 자", [[0, 0], [60, 0], [60, 20], [20, 20], [20, 50], [0, 50]]],
  ["U 자 (오목 1)", [[0, 0], [50, 0], [50, 40], [35, 40], [35, 12], [15, 12], [15, 40], [0, 40]]],
  ["빗 3날 (오목 5)", [[0, 0], [70, 0], [70, 30], [58, 30], [58, 10], [46, 10], [46, 30], [34, 30],
                      [34, 10], [22, 10], [22, 30], [10, 30], [10, 10], [0, 10]]],
  ["십자", [[20, 0], [40, 0], [40, 20], [60, 20], [60, 40], [40, 40], [40, 60], [20, 60], [20, 40], [0, 40], [0, 20], [20, 20]]],
  ["삼면접착 흉내(혀+날개)", [[0, 15], [30, 15], [30, 0], [90, 0], [90, 15], [120, 15], [120, 70],
                              [95, 70], [95, 90], [25, 90], [25, 70], [0, 70]]],
  ["가는 슬릿 (폭 0.8)", [[0, 0], [40, 0], [40, 30], [20.4, 30], [20.4, 3], [19.6, 3], [19.6, 30], [0, 30]]],
];
for (const [tag, ring] of SHAPES) {
  const pieces = ringToPieces(ring);
  if (!check(`§C ${tag} — 분해 성공`, !!pieces, "ringToPieces → null")) { console.log(`${tag.padEnd(26)}분해 실패`); continue; }
  const cov = coverage(ring, pieces, 0.2);
  console.log(`${tag.padEnd(26)}${String(ring.length).padEnd(6)}${String(pieces.length).padEnd(6)}` +
              `${String(cov.n).padEnd(12)}${(cov.under + "표본 / " + cov.underArea + "mm²").padEnd(20)}${cov.over}표본`);
  // ★ 덜 덮으면 실패(위험). 더 덮으면 숫자만 적는다(안전).
  check(`§C ${tag} — 덜 덮지 않는다`, cov.under === 0, `링 안 ${cov.n} 표본 중 ${cov.under}개가 조각 밖 (${cov.underArea}mm²)`);
  check(`§C ${tag} — 밖으로 새지 않는다`, cov.over === 0, `링 밖 ${cov.over} 표본이 조각 안 (${cov.overArea}mm²)`);
}
for (const [tag, ring, pieces] of realRings) {
  const cov = coverage(ring, pieces, 0.2);
  console.log(`${("실측 " + tag).padEnd(26)}${String(ring.length).padEnd(6)}${String(pieces.length).padEnd(6)}` +
              `${String(cov.n).padEnd(12)}${(cov.under + "표본 / " + cov.underArea + "mm²").padEnd(20)}${cov.over}표본`);
  check(`§C 실측 ${tag} — 덜 덮지 않는다`, cov.under === 0, `${cov.under}표본 / ${cov.underArea}mm²`);
  check(`§C 실측 ${tag} — 밖으로 새지 않는다`, cov.over === 0, `${cov.over}표본 / ${cov.overArea}mm²`);
}

// ══════════════════════════════════════════════════════════════════
//  §D  게이트에 이빨이 있는가 — 돌연변이
//
//  §B·§C 가 0 만 찍고 통과하면 「계측기가 아무것도 안 보는」 경우와 구별이 안 된다.
//  그래서 일부러 도형을 **줄여** 두 계측기가 실제로 잡는지 확인한다.
//  (verify-print §B~§D · verify-pdf §E 와 같은 수법이다.)
// ══════════════════════════════════════════════════════════════════
console.log("\n═══ §D 돌연변이 — 도형을 줄이면 계측기가 잡는가 ═══════════════════════════");
{
  const ring = SHAPES[1][1];                        // U 자
  const pieces = ringToPieces(ring);
  const cx = 25, cy = 20;
  const shrink = k => pieces.map(p => p.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]));

  // ① 담기 계측(leakOf) — 링을 실물 「칼선」으로 보고 2% 줄인 도형에 넣는다
  const asPolylines = [ring.concat([ring[0]])];
  const good = leakOf(asPolylines, pieces, 0.1, Infinity);
  const bad = leakOf(asPolylines, shrink(0.98), 0.1, Infinity);
  console.log(`  leakOf   원본 이탈 ${good.worst.toFixed(4)}mm (밖 ${good.out}) → 2% 축소 이탈 ${bad.worst.toFixed(4)}mm (밖 ${bad.out})`);
  check("§D leakOf 가 2% 축소를 잡는다", bad.worst > 0.02 && bad.out > 0, `축소본 이탈 ${bad.worst}mm`);
  check("§D leakOf 가 원본은 통과시킨다", good.worst <= 0.02, `원본 이탈 ${good.worst}mm`);

  // ② 커버리지(§C 계측기) — 조각 하나를 빼면 「덜 덮음」이 떠야 한다
  const dropped = pieces.slice(0, -1);
  const c0 = coverage(ring, pieces, 0.2), c1 = coverage(ring, dropped, 0.2);
  console.log(`  coverage 원본 덜덮음 ${c0.under} → 조각 1개 제거 ${c1.under}표본 (${c1.underArea}mm²)`);
  check("§C 계측기가 조각 누락을 잡는다", c1.under > 0, `조각 ${pieces.length}→${dropped.length} 인데 덜덮음 0`);

  // ③ makeDragPart 정규화 — 칼선 bbox 와 다른 크기를 주면 bbox 로 내려가야 한다
  const P = makeDragPart({ polylines: asPolylines, w: 50, h: 40 });
  check("§D 합성 U 자는 스티칭으로 정확히 분해된다", P && P.mode === "stitched", `mode=${P?.mode}`);
  const Pw = makeDragPart({ polylines: asPolylines, w: 80, h: 40 });
  check("§D 칼선 bbox 를 못 채우면 조용히 쓰지 않는다", Pw && Pw.mode !== "stitched" && !!Pw.note,
        `mode=${Pw?.mode} note=${Pw?.note ? "있음" : "없음"}`);
}

// ══════════════════════════════════════════════════════════════════
//  §F  물이 새면 「벽만 남은 도형」을 쓰지 않는가  ← 가장 위험한 실패 양상
//
//  칼선에 큰 틈이 있으면 바깥물이 몸통까지 들어와, 안 잠긴 칸이 **부풀린 벽**밖에
//  안 남는다. 그 도형은 테두리 선을 전부 담으므로 담기 게이트(leakOf)를 0mm 로
//  통과한다 — 그런데 몸통 한가운데가 **빈 곳**이라 이웃 부품이 거기 파고든다.
//  엔진은 「안 겹친다」, 인쇄는 겹친다. 실측 t-sosco 가 정확히 그 모양이었고
//  종전 게이트(안쪽 면적 ≥ bbox 의 12%)는 14.3% 로 **통과시켰다**.
//  그래서 벽을 뺀 「갇힌 내부」로 판정한다. 이 절이 그 판정에 이빨이 있는지 본다.
// ══════════════════════════════════════════════════════════════════
console.log("\n═══ §F 물 샘 — 벽만 남은 도형을 거부하는가 ═══════════════════════════════");
{
  const areaOf = (pieces, w, h, st = 0.5) => {
    let a = 0;
    for (let x = st / 2; x < w; x += st) for (let y = st / 2; y < h; y += st) if (inUnion([x, y], pieces)) a++;
    return a * st * st;
  };

  // ① 왼쪽 변이 통째로 없는 100×60 — t-sosco 의 축소판(그쪽은 130.30mm 가 비었다)
  const holed = [[[0, 0], [100, 0]], [[100, 0], [100, 60]], [[100, 60], [0, 60]]];
  const Ph = makeDragPart({ polylines: holed, w: 100, h: 60 });
  const ah = areaOf(Ph.base.pieces, 100, 60);
  console.log(`  왼쪽 변 60mm 결손 → mode=${Ph.mode} 조각=${Ph.pieceCount} 면적 ${ah.toFixed(0)}mm² (bbox 6000 의 ${(100 * ah / 6000).toFixed(0)}%)`);
  check("§F 물이 새면 raster 를 쓰지 않는다", Ph.mode !== "raster", `mode=${Ph.mode} — 벽만 남은 도형을 채택했다`);
  // ★ 폴백은 **상위집합**이어야 한다. 벽 껍데기(≈ 둘레×3칸 ≈ 700mm²)면 여기서 죽는다.
  check("§F 폴백 도형이 실물을 담는다(면적 ≥ 95%)", ah >= 6000 * 0.95, `${ah.toFixed(0)}mm² = ${(100 * ah / 6000).toFixed(0)}%`);
  check("§F 정밀도를 잃었다고 화면에 적는다", !!Ph.note, "note 가 비어 있다");

  // ② 대조군 — 같은 도형인데 틈이 0.2mm 뿐이면 부풀림이 막아 raster 가 **성공**해야 한다.
  //    이게 없으면 위 ① 은 「게이트가 전부 거부한다」와 구별이 안 된다.
  const gap = [[[0.2, 0], [100, 0]], [[100, 0], [100, 60]], [[100, 60], [0, 60]], [[0, 60], [0, 0.2]]];
  const Pg = makeDragPart({ polylines: gap, w: 100, h: 60 });
  const ag = areaOf(Pg.base.pieces, 100, 60);
  console.log(`  같은 도형 · 틈 0.2mm  → mode=${Pg.mode} 조각=${Pg.pieceCount} 면적 ${ag.toFixed(0)}mm² (${(100 * ag / 6000).toFixed(0)}%)`);
  check("§F 작은 틈은 부풀림이 막아 통과시킨다", Pg.mode === "raster" || Pg.mode === "stitched", `mode=${Pg.mode}`);
  check("§F 통과한 도형도 실물을 담는다", ag >= 6000 * 0.95, `${ag.toFixed(0)}mm²`);
}

// ══════════════════════════════════════════════════════════════════
console.log("\n═══ 결과 ══════════════════════════════════════════════════════════════");
for (const n of NOTE) console.log(`  ℹ ${n}`);
for (const [l, d] of FAIL) console.log(`  ✗ ${l}  —  ${d}`);
const TOTAL = PASS + FAIL.length;
const scored = missing.length === 0;
console.log(`\n손배치 충돌 도형: ${PASS}/${TOTAL}${scored ? "" : "  ⚠ 실측 " + missing.length + "건 미실행 — **점수 아님**"}`);
if (FAIL.length) {
  console.log("\n★ mode 가 bbox·hull 로 되떨어졌다면 도형이 무뎌진 것이다 — 에러는 안 나지만");
  console.log("  맞물림이 사라지고 up 이 조용히 줄어든다. nest-drag.mjs 래스터 절 주석을 읽어라.");
}
process.exit(FAIL.length ? 1 : 0);

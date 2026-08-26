// ══════════════════════════════════════════════════════════════════
//  PDF 칼선 추출기 검증 —  src/domain/pdf-dieline.mjs 를 **직접 import** 한다
//
//  왜 이 파일이 필요한가
//  ──────────────────
//  전개도(netW/netH)는 지금 W·D·H 회귀식으로 **추측**한다. 실측 칼선 3건으로 맞췄지만
//  변종은 못 잡는다 — iSHAP 120×150×80 은 netW 는 맞는데(Δ1.4mm) netH 실측 324.2 가
//  어느 구조 공식으로도 안 나온다(삼면접착 302.7~351.9). PDF 를 직접 읽으면 추측이
//  사라지는데, 그러려면 **추출기가 실측값을 되돌려주는지**가 먼저 증명돼야 한다.
//
//  §A 실측 오라클 — 협력사 칼선 PDF 를 벡터 실측한 값과 대조 (허용오차 ±0.5mm)
//  §B 합성 PDF 자기검사 — 실파일 8건이 안 밟는 코드 경로를 직접 만들어 밟는다
//                          (xref 스트림 · PNG 예측자 · Form XObject/Matrix · c/v/y/re/h/q/Q)
//  §C 실패 경로 — 암호화 · 깨진 컨테이너 · 비PDF 는 **조용히 틀리지 말고** 명확히 실패해야 한다
//  §E 조용히 틀리지 않는지 — 실제로 밟았던 결함의 회귀 게이트
//  §F /ObjStm 압축 객체 스트림 — Acrobat 경유 PDF 가 쓰는 모양. §A 8건이 안 밟는다
//  §D guessSheet — 페이지 크기 → 판형 자동 인식
//
//  판정 규약 (verify-imposition · verify-total 과 같다)
//  ──────────────────────────────────────────────
//   PASS  기대값과 ±0.5mm 이내
//   KNOWN 어긋나지만 **이유가 문서화된** 건. 이유 문자열이 없으면 KNOWN 이 될 수 없다.
//   SKIP  파일이 없어 못 읽은 건 → **exit 1**. 아래 ⚠ 를 읽어라
//   FAIL  그 밖 → exit 1
//
//  ⚠ SKIP 이 왜 실패인가 (이 파일이 초록으로 거짓말한 이력)
//  ──────────────────────────────────────────────────
//  §A 오라클 8건은 저장소 **밖** 고객사 폴더에 있다(영업기밀이라 git 에 못 넣는다).
//  종전 집계는 `TOTAL = PASS + KNOWN + FAIL` 로 SKIP 을 분모에서 빼고 FAIL 만 exit 1 로
//  올렸다. 그래서 다른 PC·CI·클린 클론에서는 §B/§C/§D 합성 18건만 돌면서
//  「PDF 칼선 추출: 18/18」 · EXIT=0 이 떴다 — **실측 대조 0건인데 만점으로 보였다.**
//  지금은 SKIP 이 1건이라도 있으면 exit 1 이고, 점수 문자열도 「점수 아님」으로 바뀐다.
//  오라클이 없는 것이 정상인 환경(CI·클린 클론)은 **명시적으로만** 면제된다:
//     PDF_ALLOW_SKIP=1  또는  node test/verify-pdf.mjs --allow-skip
//  오라클을 다른 위치에 두었으면 경로만 갈아끼운다:
//     PDF_ORACLE_DIR=D:/자료/2026  node test/verify-pdf.mjs
// ══════════════════════════════════════════════════════════════════
import fs from "node:fs";
import { readDieline, guessSheet } from "../src/domain/pdf-dieline.mjs";

const TOL = 0.5;                     // mm
/** 오라클 부재 면제 — 기본은 면제 없음(SKIP=실패). 환경이 스스로 밝힐 때만 넘어간다. */
const ALLOW_SKIP = process.env.PDF_ALLOW_SKIP === "1" || process.argv.includes("--allow-skip");
let PASS = 0;
const KNOWN = [], FAIL = [], SKIP = [];

const near = (a, b, tol = TOL) => Math.abs(a - b) <= tol;
function check(label, ok, detail, known) {
  if (ok) { PASS++; return true; }
  if (known) KNOWN.push([label, known, detail]); else FAIL.push([label, detail]);
  return false;
}

// ══════════════════════════════════════════════════════════════════
//  §A  실측 오라클
//
//  경로는 test/verify-imposition.mjs 주석과 scratchpad/flaps2.py CASES 에 기록된 것이다.
//  기대값은 「전개도 실측」= 칼선 bbox(mm).
//
//  ★ 추출기는 **후보를 여러 개** 내고 순위를 매긴다(아트워크가 3,000~7,000 선분인데
//    칼선은 60~250 선분이라 단정할 수 없다). 그래서 두 가지를 따로 센다:
//      ① 실측값이 후보 목록에 있는가   ← 추출 정확도. 이게 본 점수다.
//      ② 1순위가 실측값인가            ← 순위 품질. 어긋나면 이유를 적어야 한다.
// ══════════════════════════════════════════════════════════════════
// 오라클 뿌리. 상수로 박아두면 이 PC 밖에서는 아무것도 검증하지 못하므로 환경변수로 뺀다.
const R = process.env.PDF_ORACLE_DIR ?? "C:/이예찬_업무/연도별/2026";
const CASES = [
  {
    name: "소스코 삼면접착 140×43×130",
    file: `${R}/고객사_문의중/소스코/디자인/삼면접착140x43x130.pdf`,
    w: 380.3, h: 223.5,
    // verify-imposition 「소스코 삼면접착 140×43×130」 절: 전개도 실측 380.3 × 223.5
    note: "몸통 380.3×208.5 + 텍 혀 138.6×15.0 (접는선 y 254.47 공유)",
  },
  {
    name: "바이오머 맞뚜껑 150×15×150",
    file: `${R}/고객사/제작완료/바이오머테리얼즈코리아/디자인/맞뚜껑.pdf`,
    w: 344.3, h: 210.0,
    // ▶ netW 344.3 = 2(150+15)+14.3 — verify-imposition ① 에서 오차 0.0 으로 확정된 **기존 오라클**.
    // ▶ netH 210.0 은 **기존 오라클이 아니다.** 종전 문서에는 확정값이 없었다(「위띠 35.0?」).
    //   이 값은 이 추출기가 처음 낸 값이고, 아래 두 독립 근거로 뒷받침된다:
    //     ① 몸통 성분 344.3 × 180.0 (y 31.66~211.66). verify-imposition ③ 이 같은 파일에서
    //        "x=165·330 에서 y 31.7~211.7 → 180.0 = H + 2D" 로 이미 문서화한 값과 동일하다.
    //     ② 텍 혀 성분 148.6 × 15.00 (x 196.73~345.33) 이 위·아래 각 1개, 접는선 y 를 정확히
    //        공유(오차 0.00). 180.0 + 15.0 + 15.0 = 210.0.
    //   종전 공식 netH = H + 2(D+16.5) = 213.0 은 혀를 16.5mm 로 봤는데 실측은 15.0mm 다.
    //   ⚠ 이 항목은 「기존 오라클 재현」이 아니라 **새 실측의 회귀 고정**이다. 병합 규칙을
    //      건드리면 여기서 먼저 깨진다 — 그게 이 줄의 목적이다.
    hNew: "몸통 180.0(=H+2D, verify-imposition ③ 과 동일) + 텍 혀 15.0×2 = 210.0. 종전 공식 H+2(D+16.5)=213.0 은 혀를 16.5 로 봤다",
    fresh: true,
  },
  {
    name: "더파이러츠 맞뚜껑 190×68×280",
    file: `${R}/고객사/제작완료/더파이러츠/디자인/맞뚜껑.pdf`,
    w: 533.3, h: 452.0,
    // ⚠ 이 파일의 **칼선**은 530.3 × 452.0 이다. 533.3 은 도련 3.0 이 섞인 값이다.
    //   근거 ① verify-imposition ① 이 이미 그렇게 적어놨다:
    //          "더파이러츠 2(190+68)+14.3 = 530.3  실측 533.3 − 도련 3.0 = 530.3"
    //   근거 ② 성분 실측: 몸통 530.3×416.0 (x 42.06~572.36) + 텍 혀 188.6×18.0 위/아래
    //          → 530.3 × 452.0. 폭 533.3 인 성분은 이 파일에 **없다.**
    //          533.3 은 종전 flaps2.py 의 병합 허용오차 ±3.0mm 가 몸통 오른쪽으로
    //          정확히 3.00mm 삐져나온 아트워크 띠(518.29×23.0 @ x 57.07~575.36)를
    //          삼킨 결과다. 즉 도련 3.0 은 아트워크 도련이고 칼선이 아니다.
    knownW: "533.3 은 도련 3.0 포함값 — 칼선은 530.3 (verify-imposition ① 이 이미 −도련 3.0 = 530.3 이라고 적어둠, netW 공식과 오차 0.0)",
    altW: 530.3,
  },
  {
    name: "웨이크버니 삼면접착 A 46×46×138 (p0)",
    file: `${R}/고객사_문의중/웨이크버니/디자인/웨이크버니삼면접착2종.pdf`,
    page: 0, w: 198.3, h: 234.0,
    note: "몸통 198.3×219.0 + 혀 44.6×15.0",
  },
  {
    name: "웨이크버니 삼면접착 B 36×36×168 (p1)",
    file: `${R}/고객사_문의중/웨이크버니/디자인/웨이크버니삼면접착2종.pdf`,
    page: 1, w: 158.3, h: 247.0,
    note: "몸통 158.3×232.0 + 혀 44.6×15.0",
  },
  {
    name: "도솔메디 경옥고3입 2up 대지",
    file: `${R}/고객사/제작완료/주식회사도솔메디/제작완료/디자인/260129_코리팩_크리아_디자인(13554)_경옥고3입_패키지.pdf`,
    w: 576.0, h: 295.0,
    // verify-imposition ④ 「도솔메디 대지: 576.0×295.0 에 288+288 …」
    // 이 대지는 **아트보드(MediaBox 253.37×301.19) 밖** 일러스트 캔버스에 놓여 있다
    //   (x 1089.93~1665.93). 아트보드 안의 칼선은 214.3×253.0 (한 판)이고,
    //   추출기는 아트보드 안을 1순위로 둔다 — 납품물은 아트보드가 말한다.
    // → 실측값은 후보에 정확히 들어오지만 1순위는 아니다. 그게 설계대로다.
    knownRank: "2up 대지가 아트보드 밖 캔버스에 있다 (off-page 100%). 1순위는 아트보드 안의 한 판 214.3×253.0",
  },
  {
    name: "iSHAP 무제-3 (4×62 대지에 1up)",
    file: `${R}/고객사_문의중/iSHAP/디자인/무제-3.pdf`,
    w: 557.1, h: 324.2, pageW: 788, pageH: 545, sheet: "4x62",
    // ★ 26-08-16 라벨 정정: 「2up」은 근거 없는 표기였다. 칼선 557.10×324.16 은
    //   788×545 에 **어느 방향으로도 2벌이 안 들어간다**(가로 2×557.1=1114.2 > 788 ·
    //   세로 2×324.16=648.3 > 545 · 회전 2×324.16=648.3 ≤ 788 이지만 557.1 > 545).
    //   이 필드는 점수에 안 들어가고 사람이 읽는 이름일 뿐이라 조용히 틀린 채로 남아 있었다.
    note: "도련 568.98×335.70 / 칼선 557.10×324.16 — 두 겹 감지 후 안쪽 채택",
  },
  {
    name: "iSHAP 생활용품패키지",
    file: `${R}/고객사_문의중/iSHAP/디자인/260805_코리팩_크리아_시안_생활용품패키지.pdf`,
    w: 557.1, h: 324.2,
    note: "도련 568.97×335.71 / 칼선 557.10×324.16 — 사방 5.91mm",
  },
  {
    // ★ 26-08-26 등록 — 사용자 신고 「이따위로 다 잘려서 나온다」의 그 파일이다.
    //   증상: 한 장짜리 도면이 **다섯 조각**으로 갈려 후보 5개가 떴고, 고를 수 있는 것도
    //         전부 조각이었다 (185.0×184.0 / 86.5×356.0 / 65.2×166.1 / 137.3×34.0 ×2).
    //   원인: buildComponents 가 좌표를 0.01mm 격자로 **반올림**만 해서 노드를 만들었는데,
    //         이 도면의 이음새는 0.040mm 다 — 격자 4칸 차이라 영원히 다른 노드였다.
    //         (격자 반올림은 칸 경계를 사이에 둔 점을 원리적으로 못 붙인다. pdf-dieline §7)
    //
    //   ‡ 기대값을 어떻게 얻었나 — 종전 오라클이 없는 새 파일이라 근거를 적는다:
    //     ① 다섯 조각의 bbox 가 **서로 맞닿아 있었다.** x 구간이 6.25–71.44 / 71.47–208.74
    //        (2개) / 208.74–295.24 / 293.74–478.75 로 이어 붙는다 — 한 도면을 자른 모양이다.
    //     ② 서로 다른 조각에 속한 끝점 사이 **최근접 거리가 0.040mm** 였다(여러 쌍이 정확히
    //        0.040). 다음이 0.210, 그 다음이 1.598 — 0.040 무리는 명백히 「같은 점」이다.
    //     ③ 다섯 조각의 **합집합** bbox = 472.50 × 356.04. 페이지가 487.97 × 370.35 이므로
    //        사방 7.7/7.2mm 여백이 남는 한 장짜리 도면과 정확히 맞는다(2up 이 아니다).
    //     지금 추출기는 ③ 을 그대로 1개 후보로 돌려준다(선분 470 · 성분 1 · 점 454).
    //   ⚠ 이 항목은 「기존 오라클 재현」이 아니라 **새 실측의 회귀 고정**이다.
    name: "아르토 클립클로우 (13948)",
    file: `${R}/고객사/아르토_4차/디자인/260506_코리팩_크리아_디자인(13948)_클립클로우패키지.pdf`,
    w: 472.5, h: 356.04, pageW: 487.97, pageH: 370.35,
    // ★★ bbox 만 재면 이 고장을 **못 잡는다.** 이번 증상이 정확히 「bbox 는 그럴듯한데
    //    조각」이었다 — 조각 하나(86.5×356.0)는 높이가 합집합과 같아서 h 만 보면 통과한다.
    //    그래서 후보 개수를 같이 못박는다. 병합이 퇴화하면 여기서 5개가 되어 걸린다.
    cands: 1,
    hNew: "합집합 472.50×356.04 — 조각 5개의 bbox 가 맞닿아 있고(최근접 0.040mm) 합집합이 페이지 487.97×370.35 안에 사방 7mm 여백으로 들어간다",
    fresh: true,
    note: "이음새 0.040mm · 노드 병합(JOIN_TOL 0.275) 이 없으면 다섯 조각으로 갈린다",
  },
];

console.log("═══ §A 실측 오라클 대조 ══════════════════════════════════════════════════");
console.log("  기대값 출처: verify-imposition.mjs 주석의 벡터 실측.  ‡ 표시는 기존 오라클이 없어");
console.log("  이 추출기가 새로 확정한 값이다 (근거는 CASES 주석 — 재현이 아니라 회귀 고정이다).");
console.log(`${"파일".padEnd(34)}${"기대".padEnd(17)}${"1순위 추출".padEnd(17)}${"Δ".padEnd(15)}후보순위`);
console.log("─".repeat(100));

for (const c of CASES) {
  const label = c.name;
  if (!fs.existsSync(c.file)) {
    SKIP.push([label, c.file]);
    console.log(`${label.padEnd(34)}${(c.w + "×" + c.h).padEnd(17)}${"— SKIP (파일 없음)".padEnd(34)}`);
    continue;
  }
  let r;
  try {
    r = await readDieline(new Uint8Array(fs.readFileSync(c.file)), { source: c.name, page: c.page ?? 0, maxCandidates: 20 });
  } catch (e) {
    check(`${label} 추출`, false, `ERROR ${e.message}`);
    console.log(`${label.padEnd(34)}${(c.w + "×" + c.h).padEnd(17)}ERROR ${e.message}`);
    continue;
  }

  // 기대값(또는 문서화된 대체값)이 후보 목록에 있는가 — 본 점수
  const wants = [[c.w, c.h]];
  if (c.altW) wants.push([c.altW, c.h]);
  let rank = -1, want = null;
  for (const [ww, hh] of wants) {
    const i = r.candidates.findIndex(k => near(k.bbox.w, ww) && near(k.bbox.h, hh));
    if (i >= 0) { rank = i + 1; want = [ww, hh]; break; }
  }
  const dW = r.bbox.w - c.w, dH = r.bbox.h - c.h;
  const rankTxt = rank > 0 ? `${rank}/${r.candidates.length}순위` : `없음(후보 ${r.candidates.length}개)`;
  console.log(`${label.padEnd(34)}${(c.w + "×" + c.h + (c.fresh ? " ‡" : "")).padEnd(17)}${(r.bbox.w + "×" + r.bbox.h).padEnd(17)}` +
              `${((dW >= 0 ? "+" : "") + dW.toFixed(2) + " / " + (dH >= 0 ? "+" : "") + dH.toFixed(2)).padEnd(15)}${rankTxt}`);

  check(`${label} — 실측값이 후보에 있음`, rank > 0,
        rank > 0 ? "" : `기대 ${c.w}×${c.h} 가 후보에 없다`, null);

  // 1순위가 실측값인가 — 순위 품질 (어긋나면 이유가 있어야 한다)
  const top = near(r.bbox.w, c.w) && near(r.bbox.h, c.h);
  const topAlt = c.altW ? (near(r.bbox.w, c.altW) && near(r.bbox.h, c.h)) : false;
  check(`${label} — 1순위 = 실측값`, top,
        `1순위 ${r.bbox.w}×${r.bbox.h}`,
        top ? null : (topAlt ? c.knownW : c.knownRank));

  // 후보 **개수** — bbox 만 맞으면 「조각났는데 그중 하나가 그럴듯한」 상태를 못 잡는다.
  //   26-08-26 아르토: 다섯 조각 중 86.5×356.0 은 높이가 정답과 같았다.
  if (c.cands !== undefined)
    check(`${label} — 후보 ${c.cands}개 (조각나지 않았다)`, r.candidates.length === c.cands,
          `후보 ${r.candidates.length}개: ${r.candidates.map(k => k.bbox.w + "×" + k.bbox.h).join(", ")}`);
  if (c.pageW !== undefined)
    check(`${label} — 페이지 크기`, near(r.pageSize.w, c.pageW) && near(r.pageSize.h, c.pageH),
          `${r.pageSize.w}×${r.pageSize.h} (기대 ${c.pageW}×${c.pageH})`);
  if (c.sheet !== undefined)
    check(`${label} — 판형 인식`, r.sheetId === c.sheet, `sheetId=${r.sheetId} (기대 ${c.sheet})`);

  // 3단계 이음새: polygons 는 지금 안 쓰지만 반드시 담겨 있어야 한다
  const polyOk = Array.isArray(r.polygons) && r.polygons.length > 0 &&
    r.polygons.every(p => Array.isArray(p) && p.length >= 2 && p.every(q => q.length === 2 && Number.isFinite(q[0]) && Number.isFinite(q[1])));
  check(`${label} — polygons 계약`, polyOk, `polygons=${r.polygons?.length}`);
  // polygons 의 bbox 는 bbox 와 같아야 한다 (같은 성분에서 나왔다는 뜻)
  let px0 = Infinity, py0 = Infinity, px1 = -Infinity, py1 = -Infinity;
  for (const p of r.polygons) for (const [x, y] of p) {
    if (x < px0) px0 = x; if (x > px1) px1 = x; if (y < py0) py0 = y; if (y > py1) py1 = y;
  }
  check(`${label} — polygons bbox === bbox`, near(px1 - px0, r.bbox.w, 0.02) && near(py1 - py0, r.bbox.h, 0.02),
        `polygons ${(px1 - px0).toFixed(2)}×${(py1 - py0).toFixed(2)} vs bbox ${r.bbox.w}×${r.bbox.h}`);
  check(`${label} — unit/source 계약`, r.unit === "mm" && typeof r.source === "string" && Array.isArray(r.warnings),
        `unit=${r.unit}`);

  for (const w of r.warnings) console.log(`      ⚠ ${w}`);
  if (c.note) console.log(`      · ${c.note}`);
}

// ══════════════════════════════════════════════════════════════════
//  §B  합성 PDF 자기검사
//
//  실파일 8건은 전부 구식 xref table + FlateDecode 다. 그래서 아래 경로는 실파일이
//  한 번도 밟지 않는다 — 밟지 않은 코드를 「통과」라고 쓰지 않기 위해 직접 만든다.
//    · xref 스트림 (/Type/XRef, /W, /Index 기본값)
//    · PNG 예측자 12 (Up) 되돌리기
//    · Form XObject 재귀 + /Matrix
//    · 연산자 c / v / y / re / h / q / Q / cm
//  모든 도형 좌표는 mm 로 딱 떨어지게 잡았다 (cm 로 pt→mm 배율을 넣었다).
// ══════════════════════════════════════════════════════════════════
const MM = 72 / 25.4;                                   // 1mm = 2.8346… pt
const encL = s => { const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i) & 255; return u; };
async function deflate(u8) {
  const s = new Blob([u8]).stream().pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// 본문: L자 몸통(정점 8개) + re 로 그린 위 혀 + m/l/h 로 그린 아래 혀
//       + q/Q 안에서 2배 확대한 버림 도형 + v/y 베지어 도형 + Form XObject 호출
const PAGE_W = 200, PAGE_H = 100;                        // mm
const CONTENT = `${MM} 0 0 ${MM} 0 0 cm
q 0 0 1 RG 0.5 w
10 10 m 60 10 l 60 25 l 40 25 l 40 40 l 25 40 l 25 30 l 10 30 l h S
30 40 5 8 re S
20 10 m 26 10 l 26 4 l 20 4 l h S
Q
q 2 0 0 2 0 0 cm 84 30 m 92 30 l 92 38 l 84 38 l h S Q
150 20 m 150 40 170 40 v 190 40 190 20 y 190 10 l 150 10 l h S
q 1 0 0 1 100 60 cm /Fm0 Do Q
BI /W 1 /H 1 /CS /G /BPC 8 ID \u0000 EI
`;
// Form 안: 베지어(최대 y = t=0.5 에서 22.5) + 직선. bbox = 30 × 37.5
const FORM = `0 0 m 0 30 30 30 30 0 c 30 -15 l 0 -15 l h S`;

/** xref 스트림 본문 바이트를 만든다 — W=[1,4,2] + PNG 예측자 12(Up).
 *  rows[i] = [type, f2, f3]. 두 빌더가 같은 포장을 쓰므로 한 곳에 둔다. */
const XREF_W = [1, 4, 2], XREF_ROW = 7;
async function xrefStreamBody(rows) {
  const raw = new Uint8Array(rows.length * XREF_ROW);
  rows.forEach(([type, f2, f3], i) => {
    const p = i * XREF_ROW;
    raw[p] = type;
    raw[p + 1] = (f2 >>> 24) & 255; raw[p + 2] = (f2 >>> 16) & 255;
    raw[p + 3] = (f2 >>> 8) & 255;  raw[p + 4] = f2 & 255;
    raw[p + 5] = (f3 >>> 8) & 255;  raw[p + 6] = f3 & 255;
  });
  // PNG 예측자 12(Up): 행마다 필터바이트 2 + (현재 − 이전)
  const pred = new Uint8Array(rows.length * (XREF_ROW + 1));
  for (let r = 0; r < rows.length; r++) {
    pred[r * (XREF_ROW + 1)] = 2;
    for (let i = 0; i < XREF_ROW; i++)
      pred[r * (XREF_ROW + 1) + 1 + i] = (raw[r * XREF_ROW + i] - (r ? raw[(r - 1) * XREF_ROW + i] : 0)) & 255;
  }
  return deflate(pred);
}

/** xref 스트림 PDF 를 만든다. objStm=true 면 type 2 항목을 하나 넣는다. */
async function buildXrefStreamPdf({ objStm = false } = {}) {
  const parts = []; let len = 0;
  const push = x => { const u = typeof x === "string" ? encL(x) : x; parts.push(u); len += u.length; return u.length; };
  const off = {};
  push("%PDF-1.5\n%\xE2\xE3\xCF\xD3\n");
  const obj = (n, body, stream) => {
    off[n] = len;
    push(`${n} 0 obj\n`); push(body);
    if (stream) { push("\nstream\n"); push(stream); push("\nendstream"); }
    push("\nendobj\n");
  };
  const cbytes = await deflate(encL(CONTENT));
  const fbytes = await deflate(encL(FORM));
  obj(1, `<</Type/Catalog/Pages 2 0 R>>`);
  obj(2, `<</Type/Pages/Kids[3 0 R]/Count 1>>`);
  // objStm 변종은 /Contents 를 「ObjStm 안에 있다」고 주장하는 객체 7 로 돌린다 —
  // 압축 객체는 **실제로 필요할 때** 실패해야 하므로, 참조되지 않는 type 2 항목만으로는
  // 실패하지 않는 것이 정상이다 (하이브리드 파일 대응). 그래서 참조를 만들어 밟는다.
  obj(3, `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PAGE_W * MM} ${PAGE_H * MM}]` +
         `/Resources<</XObject<</Fm0 5 0 R>>>>/Contents ${objStm ? 7 : 4} 0 R>>`);
  obj(4, `<</Length ${cbytes.length}/Filter/FlateDecode>>`, cbytes);
  obj(5, `<</Type/XObject/Subtype/Form/BBox[-100 -100 300 300]/Matrix[1 0 0 1 0 0]` +
         `/Length ${fbytes.length}/Filter/FlateDecode>>`, fbytes);

  // ── xref 스트림 (객체 6). 자기 오프셋까지 표에 넣는다 ──
  const xoff = len;
  const N = objStm ? 8 : 7;                              // 0..6 (+ objStm 용 7)
  const W = [1, 4, 2], rowLen = 7;
  const rows = new Uint8Array(N * rowLen);
  const put = (i, type, f2, f3) => {
    const p = i * rowLen;
    rows[p] = type;
    rows[p + 1] = (f2 >>> 24) & 255; rows[p + 2] = (f2 >>> 16) & 255;
    rows[p + 3] = (f2 >>> 8) & 255;  rows[p + 4] = f2 & 255;
    rows[p + 5] = (f3 >>> 8) & 255;  rows[p + 6] = f3 & 255;
  };
  put(0, 0, 0, 65535);
  for (let n = 1; n <= 5; n++) put(n, 1, off[n], 0);
  put(6, 1, xoff, 0);
  if (objStm) put(7, 2, 6, 0);                           // 객체 7 은 /ObjStm 안에 있다고 주장
  // PNG 예측자 12(Up): 행마다 필터바이트 2 + (현재 − 이전)
  const pred = new Uint8Array(N * (rowLen + 1));
  for (let r2 = 0; r2 < N; r2++) {
    pred[r2 * (rowLen + 1)] = 2;
    for (let i = 0; i < rowLen; i++)
      pred[r2 * (rowLen + 1) + 1 + i] = (rows[r2 * rowLen + i] - (r2 ? rows[(r2 - 1) * rowLen + i] : 0)) & 255;
  }
  const xbytes = await deflate(pred);
  obj(6, `<</Type/XRef/Size ${N}/W[${W.join(" ")}]/Root 1 0 R/Filter/FlateDecode` +
         `/DecodeParms<</Predictor 12/Columns ${rowLen}>>/Length ${xbytes.length}>>`, xbytes);
  push(`startxref\n${xoff}\n%%EOF\n`);

  const out = new Uint8Array(len); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** 구식 xref table PDF. extraTrailer 로 /Encrypt 를 넣어 실패 경로를 만든다. */
function buildTablePdf(extraTrailer = "") {
  const parts = []; let len = 0;
  const push = x => { const u = typeof x === "string" ? encL(x) : x; parts.push(u); len += u.length; };
  const off = {};
  push("%PDF-1.3\n");
  const body = encL(`${MM} 0 0 ${MM} 0 0 cm 10 10 m 60 10 l 60 25 l 40 25 l 40 40 l 25 40 l 25 30 l 10 30 l h S`);
  const objs = [
    [1, `<</Type/Catalog/Pages 2 0 R>>`, null],
    [2, `<</Type/Pages/Kids[3 0 R]/Count 1>>`, null],
    [3, `<</Type/Page/Parent 2 0 R/MediaBox[0 0 ${PAGE_W * MM} ${PAGE_H * MM}]/Contents 4 0 R>>`, null],
    [4, `<</Length ${body.length}>>`, body],
  ];
  for (const [n, d, s] of objs) {
    off[n] = len; push(`${n} 0 obj\n`); push(d);
    if (s) { push("\nstream\n"); push(s); push("\nendstream"); }
    push("\nendobj\n");
  }
  const xoff = len;
  let x = `xref\n0 5\n0000000000 65535 f \n`;
  for (let n = 1; n <= 4; n++) x += String(off[n]).padStart(10, "0") + " 00000 n \n";
  x += `trailer\n<</Size 5/Root 1 0 R${extraTrailer}>>\nstartxref\n${xoff}\n%%EOF\n`;
  push(x);
  const out = new Uint8Array(len); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

console.log("\n═══ §B 합성 PDF 자기검사 (실파일이 안 밟는 코드 경로) ═══════════════════════");
{
  const pdf = await buildXrefStreamPdf();
  let r = null, err = null;
  try { r = await readDieline(pdf, { source: "synthetic-xrefstream.pdf", maxCandidates: 20 }); }
  catch (e) { err = e; }
  if (err) {
    check("합성: xref 스트림 PDF 읽기", false, `ERROR ${err.message}`);
  } else {
    const fnd = (w, h) => r.candidates.find(k => near(k.bbox.w, w, 0.02) && near(k.bbox.h, h, 0.02));
    const rows = [
      ["xref 스트림 + PNG 예측자 12 로 페이지 찾기", near(r.pageSize.w, PAGE_W, 0.02) && near(r.pageSize.h, PAGE_H, 0.02),
        `pageSize ${r.pageSize.w}×${r.pageSize.h} (기대 ${PAGE_W}×${PAGE_H})`],
      ["m/l/h 몸통 + re 위혀 + m/l/h 아래혀 병합 = 50×44", !!fnd(50, 44),
        `1순위 ${r.bbox.w}×${r.bbox.h} · 후보 ${r.candidates.map(k => k.bbox.w + "×" + k.bbox.h).join(", ")}`],
      ["v/y 베지어 도형 = 40×30 (Q 로 CTM 복원됨)", !!fnd(40, 30), "40×30 후보 없음"],
      ["Form XObject 재귀 + /Matrix = 30×37.5 @(100,45)", (() => {
        const k = fnd(30, 37.5); return !!k && near(k.bbox.x0, 100, 0.02) && near(k.bbox.y0, 45, 0.02);
      })(), `30×37.5 후보 ${JSON.stringify(fnd(30, 37.5)?.bbox ?? null)}`],
      ["BI…EI 인라인 이미지가 파서를 깨지 않음", r.candidates.length >= 3, `후보 ${r.candidates.length}개`],
      ["1순위 = 칼선 몸통 50×44", near(r.bbox.w, 50, 0.02) && near(r.bbox.h, 44, 0.02), `${r.bbox.w}×${r.bbox.h}`],
    ];
    for (const [k, ok, detail] of rows) {
      check(`합성: ${k}`, ok, detail);
      console.log(`  ${ok ? "✓" : "✗"} ${k}${ok ? "" : "   → " + detail}`);
    }
  }
}
{
  const pdf = buildTablePdf();
  let ok = false, detail = "";
  try {
    const r = await readDieline(pdf, { source: "synthetic-table.pdf" });
    ok = near(r.bbox.w, 50, 0.02) && near(r.bbox.h, 30, 0.02) && near(r.pageSize.w, PAGE_W, 0.02);
    detail = `${r.bbox.w}×${r.bbox.h} page ${r.pageSize.w}×${r.pageSize.h}`;
  } catch (e) { detail = `ERROR ${e.message}`; }
  check("합성: 구식 xref table + 무필터 스트림 = 50×30", ok, detail);
  console.log(`  ${ok ? "✓" : "✗"} 구식 xref table + 무필터 스트림 = 50×30   (${detail})`);
}

// ══════════════════════════════════════════════════════════════════
//  §C  실패 경로 — 조용히 틀리지 말고 명확히 실패해야 한다
// ══════════════════════════════════════════════════════════════════
console.log("\n═══ §C 실패 경로 (명확한 에러 메시지) ════════════════════════════════════");
const failCases = [
  ["암호화 PDF (/Encrypt)", buildTablePdf("/Encrypt 9 0 R"), /암호화/],
  // 컨테이너를 못 푸는데 그 안의 객체가 **실제로 필요한** 경우. /ObjStm 지원 후에도
  // 이건 여전히 에러여야 한다 — 조용히 다른 객체로 때우면 틀린 bbox 가 견적에 들어간다.
  // (여기서는 객체 6 이 /Type /XRef 라 컨테이너가 될 수 없다. §F5 는 해제 실패 쪽을 밟는다.)
  ["깨진 컨테이너를 참조 (/ObjStm)", await buildXrefStreamPdf({ objStm: true }), /객체 스트림.*ObjStm/],
  ["PDF 가 아닌 바이트", encL("this is not a pdf at all, just text\n".repeat(4)), /PDF 파일이 아니다/],
];
for (const [k, bytes, re] of failCases) {
  let msg = "(에러 없이 통과해버렸다)";
  try { await readDieline(bytes, { source: k }); }
  catch (e) { msg = e.message; }
  const ok = re.test(msg);
  check(`실패경로: ${k}`, ok, msg);
  console.log(`  ${ok ? "✓" : "✗"} ${k.padEnd(24)} → ${msg.slice(0, 78)}`);
}

// ══════════════════════════════════════════════════════════════════
//  §E  조용히 틀리지 않는지 — 실제로 밟았던 결함의 회귀 게이트
//
//  아래 8건은 전부 **한때 경고 0개로 그럴듯한 숫자를 돌려주던** 경로다. 크기가 조용히
//  틀리면 견적 전체가 틀리므로, 「고쳤다」를 주장하려면 여기서 고정돼야 한다.
//  각 케이스 주석의 「종전」이 그 당시 실제 출력이다.
//
//  ★ 이 게이트가 **실제로 게이트인지** 돌연변이로 확인했다 (26-08-07).
//    고친 코드를 하나씩 종전 동작으로 되돌려 넣고 이 스위트가 잡는지 봤다 — 6/6 검출:
//      ① `/Contents` 배열을 스트림마다 run()          → E1 실패 (17.6×10.6mm 재현)
//      ② `MIN_SIDE` 를 `max(20, 짧은변×0.15)` 로       → E8 실패 (문턱 81.75mm 재현)
//      ③ 「두 겹인데 판정 못 함」 경고 제거             → E7 실패 (침묵 재현)
//      ④ 배경 벌점을 페이지 ±1mm 절대값으로 + 80% 경고 제거 → E6 실패 (배경 196×96 이 무경고 1순위)
//      ⑤ seed 없으면 `comps.slice(0,1)` 폴백           → E4 실패 (10×10mm 무경고 재현)
//      ⑥ 페이지 크기 0 검사 제거                       → E5 실패 (0×0 통과)
//    통과만 확인하고 끝내면 「아무것도 재지 않는 테스트」가 초록으로 남는다 — 이 저장소가
//    한 번 겪은 일이다(verify-* 7개가 앱 로직을 복제해 앱을 고쳐도 통과했던 이력).
// ══════════════════════════════════════════════════════════════════

/** 정점 8개 L자 도형. bbox 는 정확히 w×h.
 *  왜 8개인가: 추출기는 `nodes >= 8` 로 대지·도련 사각형(정점 4개)을 걸러낸다(§9).
 *  4점 사각형으로 테스트를 쓰면 필터에 걸려 후보에 안 들어오고, 그러면 이 테스트는
 *  추출 로직이 아니라 필터를 재는 것이 된다. */
const L8 = (x, y, w, h) => {
  const P = [[0, 0], [w, 0], [w, h * .5], [w * .6, h * .5],
             [w * .6, h], [w * .2, h], [w * .2, h * .35], [0, h * .35]];
  return P.map(([a, b2], i) => `${(x + a).toFixed(3)} ${(y + b2).toFixed(3)} ${i ? "l" : "m"}`).join(" ") + " h S";
};

/** 구식 xref table · 무압축 PDF 를 조립한다. /Contents 를 **배열로** 만들 수 있어야
 *  다중 스트림 경로(PDF 32000-1 §7.8.2)를 밟을 수 있다. */
function buildPdf({ wMM = 200, hMM = 100, oxMM = 0, oyMM = 0, rotate = 0, streams = [] }) {
  const parts = []; let len = 0;
  const push = x => { const u = typeof x === "string" ? encL(x) : x; parts.push(u); len += u.length; };
  push("%PDF-1.4\n");
  const bodies = streams.map(encL);
  const cRef = bodies.length === 1 ? "4 0 R" : "[" + bodies.map((_, i) => `${4 + i} 0 R`).join(" ") + "]";
  const mb = [oxMM * MM, oyMM * MM, (oxMM + wMM) * MM, (oyMM + hMM) * MM].map(v => v.toFixed(4)).join(" ");
  const objs = [
    [1, `<</Type/Catalog/Pages 2 0 R>>`, null],
    [2, `<</Type/Pages/Kids[3 0 R]/Count 1>>`, null],
    [3, `<</Type/Page/Parent 2 0 R/MediaBox[${mb}]${rotate ? `/Rotate ${rotate}` : ""}/Contents ${cRef}>>`, null],
    ...bodies.map((b, i) => [4 + i, `<</Length ${b.length}>>`, b]),
  ];
  const off = {};
  for (const [n, d, s] of objs) {
    off[n] = len; push(`${n} 0 obj\n`); push(d);
    if (s) { push("\nstream\n"); push(s); push("\nendstream"); }
    push("\nendobj\n");
  }
  const xoff = len, N = objs.length + 1;
  let x = `xref\n0 ${N}\n0000000000 65535 f \n`;
  for (let n = 1; n < N; n++) x += String(off[n]).padStart(10, "0") + " 00000 n \n";
  x += `trailer\n<</Size ${N}/Root 1 0 R>>\nstartxref\n${xoff}\n%%EOF\n`;
  push(x);
  const out = new Uint8Array(len); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** 읽어서 결과를 주거나, 던진 메시지를 준다 */
async function tryRead(bytes, src, opt = {}) {
  try { return { r: await readDieline(bytes, { source: src, maxCandidates: 20, ...opt }) }; }
  catch (e) { return { err: e.message }; }
}
const has = (r, w, h) => r.candidates.some(k => near(k.bbox.w, w, 0.05) && near(k.bbox.h, h, 0.05));

console.log("\n═══ §E 조용히 틀리지 않는지 (회귀 게이트) ════════════════════════════════");

// E1 /Contents 배열 = **이어붙인 하나의 스트림**. 스트림마다 CTM 을 새로 시작하면 안 된다.
//    종전: 스트림1 의 `2 0 0 2 0 0 cm` 이 스트림2 에 안 걸려 17.64×10.58mm (pt 를 mm 로 오해).
{
  const { r, err } = await tryRead(buildPdf({
    streams: [`${MM} 0 0 ${MM} 0 0 cm 2 0 0 2 0 0 cm`, L8(10, 5, 50, 30)],
  }), "E1-multistream.pdf");
  const ok = !err && near(r.bbox.w, 100, 0.05) && near(r.bbox.h, 60, 0.05);
  check("E1 /Contents 배열을 이어붙여 CTM 을 잇는다 = 100×60", ok, err || `${r.bbox.w}×${r.bbox.h} (기대 100×60)`);
  console.log(`  ${ok ? "✓" : "✗"} 다중 스트림 CTM 상속 → ${err || r.bbox.w + "×" + r.bbox.h}   (종전 17.64×10.58)`);
}

// E2 /Rotate 90 — **보이는 대로** 담는다. 안 걸면 가로·세로가 뒤바뀐 채 견적에 들어간다.
{
  const { r, err } = await tryRead(buildPdf({
    rotate: 90, streams: [`${MM} 0 0 ${MM} 0 0 cm ` + L8(20, 15, 50, 30)],
  }), "E2-rotate90.pdf");
  const ok = !err && near(r.pageSize.w, 100, .05) && near(r.pageSize.h, 200, .05) &&
             near(r.bbox.w, 30, .05) && near(r.bbox.h, 50, .05);
  check("E2 /Rotate 90 → 페이지 100×200 · bbox 30×50", ok,
        err || `page ${r.pageSize.w}×${r.pageSize.h} bbox ${r.bbox.w}×${r.bbox.h}`);
  console.log(`  ${ok ? "✓" : "✗"} /Rotate 90 → ${err || `페이지 ${r.pageSize.w}×${r.pageSize.h} · bbox ${r.bbox.w}×${r.bbox.h}`}`);
}

// E3 MediaBox 원점이 (0,0) 이 아닌 페이지 — 좌표를 원점 기준으로 옮겨야 한다.
//    안 옮기면 polygons·x0/y0 가 전부 원점만큼 밀리고, 3단계 배치가 판 밖에서 시작한다.
{
  const { r, err } = await tryRead(buildPdf({
    oxMM: 100, oyMM: 50, streams: [`${MM} 0 0 ${MM} 0 0 cm ` + L8(110, 60, 50, 30)],
  }), "E3-origin.pdf");
  const c = r?.candidates?.[0];
  const ok = !err && near(c.bbox.x0, 10, .05) && near(c.bbox.y0, 10, .05) &&
             near(r.pageSize.w, 200, .05) && near(r.pageSize.h, 100, .05);
  check("E3 MediaBox 원점 이동 → x0/y0 = 10,10", ok, err || `x0,y0 = ${c?.bbox.x0},${c?.bbox.y0} · page ${r?.pageSize.w}×${r?.pageSize.h}`);
  console.log(`  ${ok ? "✓" : "✗"} MediaBox 원점 (100,50)mm → 도형 x0,y0 = ${err || `${c.bbox.x0},${c.bbox.y0}`}`);
}

// E4 재단 마크만 있는 PDF — seed 가 없으면 **폴백하지 않는다.**
//    종전: comps[0](파일에서 가장 먼저 그려진 성분)을 근거 없이 채택해 10×10mm 를
//          경고 0개로 돌려주고 그 값이 nW/nH 에 자동 기입됐다.
//    ⚠ 마크를 「ㄱ자」(가로+세로)로 만든다 — 수평선만 쓰면 bbox 가 10×0 이라 다른 가드
//      (1mm 미만 배제)에 먼저 걸려서, 정작 재려는 seed 폴백을 재지 못한다.
{
  const marks = Array.from({ length: 8 }, (_, i) => {
    const x = 5 + i * 20;
    return `${x} 5 m ${x + 10} 5 l ${x + 10} 15 l S`;   // 성분 1개 · 정점 3개 · bbox 10×10
  }).join(" ");
  const { r, err } = await tryRead(buildPdf({ streams: [`${MM} 0 0 ${MM} 0 0 cm ${marks}`] }), "E4-cropmarks.pdf");
  const ok = !!err && /칼선으로 볼 만한 도형이 없다/.test(err);
  check("E4 재단 마크만 → 명확한 에러 (폴백 금지)", ok, err ? err.slice(0, 60) : `숫자를 돌려줬다: ${r.bbox.w}×${r.bbox.h}`);
  console.log(`  ${ok ? "✓" : "✗"} 재단 마크 8개 → ${err ? "에러 ✓" : `${r.bbox.w}×${r.bbox.h} ✗`}   (종전 10×10 무경고)`);
}

// E5 MediaBox [0 0 0 0] — 0 크기 판이 SheetCanvas 로 내려가면 안 된다.
{
  const { r, err } = await tryRead(buildPdf({ wMM: 0, hMM: 0, streams: [L8(0, 0, 10, 10)] }), "E5-zeropage.pdf");
  const ok = !!err && /페이지 크기가 0/.test(err);
  check("E5 MediaBox 0×0 → 에러", ok, err ? err.slice(0, 50) : `pageSize ${r.pageSize.w}×${r.pageSize.h}`);
  console.log(`  ${ok ? "✓" : "✗"} MediaBox [0 0 0 0] → ${err ? "에러 ✓" : "0×0 통과 ✗"}`);
}

// E6 판 크기에 가까운 배경 윤곽 — 1순위를 먹으면 **무경고여선 안 된다.**
//    종전: isPageRect 벌점이 ±1mm 절대값이라 4mm 안쪽 배경(정점 8)이 벌점을 완전히 피했다.
{
  const { r, err } = await tryRead(buildPdf({
    streams: [`${MM} 0 0 ${MM} 0 0 cm ` + L8(2, 2, 196, 96) + " " + L8(60, 30, 50, 30)],
  }), "E6-background.pdf");
  const bgIsTop = !err && near(r.bbox.w, 196, .05) && near(r.bbox.h, 96, .05);
  const warned = !err && r.warnings.some(w => /대지|배경/.test(w));
  // 불변식: 배경이 1순위가 아니거나, 1순위라면 경고가 반드시 있다
  const ok = !err && has(r, 50, 30) && (!bgIsTop || warned);
  check("E6 배경 윤곽이 무경고로 1순위를 먹지 않는다", ok,
        err || `1순위 ${r.bbox.w}×${r.bbox.h} · 배경1순위=${bgIsTop} · 경고=${warned}`);
  console.log(`  ${ok ? "✓" : "✗"} 배경 196×96 + 칼선 50×30 → 1순위 ${err || r.bbox.w + "×" + r.bbox.h}` +
              `${bgIsTop ? ` (배경이지만 경고 ${warned ? "있음 ✓" : "없음 ✗"})` : " (칼선 ✓)"}`);
}

// E7 사방 15mm 도련 두 겹 — 판정 컷(≤12mm)에 안 맞아도 **침묵하지 않는다.**
//    종전: 두 겹으로 인식되지 않으면 바깥(도련)이 그냥 1순위가 되고 경고 0개였다.
{
  const { r, err } = await tryRead(buildPdf({
    streams: [`${MM} 0 0 ${MM} 0 0 cm ` + L8(15, 15, 80, 60) + " " + L8(30, 30, 50, 30)],
  }), "E7-bleed15.pdf");
  const ok = !err && r.warnings.some(w => /두 겹/.test(w));
  check("E7 사방 15mm 도련 → 「두 겹」 경고", ok, err || `warnings=${JSON.stringify(r.warnings)}`);
  console.log(`  ${ok ? "✓" : "✗"} 바깥 80×60 / 안쪽 50×30 (사방 15mm) → ${err || (ok ? "두 겹 경고 ✓" : "경고 없음 ✗")}`);
}

// E8 짧은변 문턱은 **절대값(20mm)** 이다. 판형 비율로 두면 큰 판에서 진짜 칼선이 사라진다.
//    종전: max(20, 짧은변×0.15) → 788×545 판에서 81.75mm. 150×82 는 후보에 있고 150×81 은 없었다.
{
  const { r, err } = await tryRead(buildPdf({
    wMM: 788, hMM: 545, streams: [`${MM} 0 0 ${MM} 0 0 cm ` + L8(50, 50, 150, 22)],
  }), "E8-thin.pdf");
  const ok = !err && has(r, 150, 22);
  check("E8 788×545 판에서 150×22 칼선이 후보에 남는다", ok,
        err || `후보 ${r.candidates.map(k => k.bbox.w + "×" + k.bbox.h).join(", ")}`);
  console.log(`  ${ok ? "✓" : "✗"} 788×545 판 · 칼선 150×22 → ${err || (ok ? "후보에 있음 ✓" : "사라짐 ✗")}   (종전 문턱 81.75mm)`);
}

// ── 노드 병합 (26-08-26) ──────────────────────────────────────────
//  §A 아르토가 실파일로 이 자리를 지키지만 저장소 밖이라 CI 에서는 SKIP 된다.
//  병합은 **양쪽으로** 틀릴 수 있고(못 이어서 조각남 / 너무 이어서 뭉개짐) 한쪽만 막으면
//  다른 쪽이 조용히 들어온다. 그래서 두 방향을 합성으로 각각 못박는다.
//  두 도형 다 열린 폴리라인이다 — `h`(닫힘)로 그리면 끝점 자체가 안 생겨 다른 것을 잰다.

// E9  0.040mm 이음새를 **잇는다** — 아르토 클립클로우가 다섯 조각으로 갈린 그 고장.
//     좌우 반쪽을 x=35 에서 0.04mm 벌려 놨다. 격자(0.01mm) 반올림만으로는 4칸 차이라
//     영원히 다른 노드다 — 못 이으면 25×30 · 25.04×30 두 조각이 후보로 뜬다.
{
  const arcR = "35 10 m 47.5 10 l 60 10 l 60 17.5 l 60 25 l 60 32.5 l 60 40 l 47.5 40 l 35 40 l S";
  const arcL = "35.04 40 m 22.5 40 l 10 40 l 10 32.5 l 10 25 l 10 17.5 l 10 10 l 22.5 10 l 35.04 10 l S";
  const { r, err } = await tryRead(buildPdf({
    streams: [`${MM} 0 0 ${MM} 0 0 cm ${arcR} ${arcL}`],
  }), "E9-seam040.pdf");
  const one = !err && r.candidates.length === 1;
  const ok = !err && one && near(r.bbox.w, 50, .05) && near(r.bbox.h, 30, .05);
  check("E9 이음새 0.04mm 를 이어 한 도형으로 만든다 = 50×30 · 후보 1개", ok,
        err || `${r.bbox.w}×${r.bbox.h} · 후보 ${r.candidates.length}개 ` +
               `[${r.candidates.map(k => k.bbox.w + "×" + k.bbox.h).join(", ")}]`);
  console.log(`  ${ok ? "✓" : "✗"} 좌우 반쪽 사이 0.04mm → ${err || `${r.bbox.w}×${r.bbox.h} · 후보 ${r.candidates.length}개`}` +
              `   (병합 없으면 25×30 + 25.04×30 두 조각)`);
}

// E10 사슬 병합을 **끊는다** — 실효 병합 반경이 JOIN_TOL 을 넘으면 안 된다.
//     끝점 세 개를 0.25mm 간격으로 일렬로 둔다(양 끝 사이는 0.50mm).
//     union-find 는 추이적이라 지름 상한이 없으면 셋이 한 점으로 접히고, 그 순간
//     세 번째 선(x 75 까지 뻗은 것)이 본체에 들어와 bbox 가 50 → 65mm 로 **부푼다.**
//     이것이 니크(0.89mm)를 삼키는 것과 같은 고장이다 — 실파일에서는 bbox 가 안 변해서
//     오라클에 안 잡히므로(오시선은 윤곽 안쪽이다) 여기서 눈에 보이게 만들었다.
{
  const arcR = "35 10 m 47.5 10 l 60 10 l 60 17.5 l 60 25 l 60 32.5 l 60 40 l 47.5 40 l 35 40 l S";
  const arcL = "35.04 40 m 22.5 40 l 10 40 l 10 32.5 l 10 25 l 10 17.5 l 10 10 l 22.5 10 l 35.04 10 l S";
  const s1 = "10 25 m 30 20 l S";        // 본체 정점 (10,25) 에서 출발 → 채택 도형에 속한다
  const s2 = "30.25 20 m 20 15 l S";     // (30,20) 과 0.25mm  → 이어진다
  const s3 = "30.5 20 m 75 20 l S";      // (30.25,20) 과 0.25mm 인데 (30,20) 과는 0.50mm
  const { r, err } = await tryRead(buildPdf({
    streams: [`${MM} 0 0 ${MM} 0 0 cm ${arcR} ${arcL} ${s1} ${s2} ${s3}`],
  }), "E10-chaincap.pdf");
  const kept = !err && near(r.bbox.w, 50, .05) && near(r.bbox.h, 30, .05);
  const warned = !err && r.warnings.some(w => /잇지 않았다/.test(w));
  // 불변식 둘: ① 도형이 안 부풀었다 ② 이음을 거부한 사실이 **조용히** 지나가지 않았다
  const ok = kept && warned;
  check("E10 사슬이 지름 상한에 걸려 끊긴다 = 50×30 (65×30 아님) + 경고", ok,
        err || `${r.bbox.w}×${r.bbox.h} · 거부경고=${warned}`);
  console.log(`  ${ok ? "✓" : "✗"} 끝점 0.25+0.25 사슬 → ${err || `${r.bbox.w}×${r.bbox.h}`} · 거부경고 ${warned ? "있음 ✓" : "없음 ✗"}` +
              `   (상한 없으면 65×30 — 0.50mm 가 한 점이 된다)`);
}

// ══════════════════════════════════════════════════════════════════
//  §F  /ObjStm (압축 객체 스트림) — Acrobat 경유 PDF 가 쓰는 모양
//
//  왜 별도 절인가
//  ────────────
//  §A 실측 8건은 전부 Illustrator 의 구식 xref table 이라 이 경로를 **한 번도 안 밟는다.**
//  그런데 협력사가 Acrobat 을 거쳐 보내는 파일은 전부 /ObjStm 이다 — 고객사 폴더
//  실측(26-08-07) PDF 485건 중 **351건**이 /ObjStm 이었고, 견적서·납품서·발주서·
//  사업자등록증은 사실상 전건이다. 그 파일들도 저장소 밖이라 §A 처럼 SKIP 이 되므로
//  (영업기밀) 여기서는 **합성 PDF 로** 고정한다.
//
//  ★ 5건 전부 **옛 코드에 걸어 실제로 깨지는 것을 보고** 넣었다 (26-08-07).
//    통과만 확인하고 끝내면 아무것도 재지 않는 테스트가 초록으로 남는다 — §E 와 같은 규약이다.
//    ⓐ = /ObjStm 지원 직전(98b76c2) · ⓑ = 지원 직후(8547cf3, 이번 수정 직전) 의 실제 출력:
//      F1  ⓐ「객체 1 을 …/ObjStm 에 압축해 넣었다 — 이 추출기는 압축 객체를 읽지 않는다.
//           Acrobat 4 (PDF 1.3) 로 다시 저장하면 읽힌다」 ← **이 문구를 없애는 것이 목적이었다**
//          ⓑ 통과
//      F2  ⓐ 읽기는 통과했지만 **경고가 없었다** (무엇을 못 읽었는지 화면에 안 남았다)
//          ⓑ 통과 — 이 줄은 lazy 규약(참조 안 된 압축객체로는 실패하지 않는다)의 **파수꾼**이다
//      F3  ⓐⓑ 둘 다 **50×30 · 경고 0개** (기대 80×30) — 구판 페이지가 조용히 이겼다
//      F4  ⓐⓑ 둘 다 「PDF trailer 의 /Root(카탈로그)를 찾지 못했다 — PDF 가 아니거나 손상됐다」
//      F5  ⓑ 「객체 1 …꺼내지 못했다」 — 카탈로그는 멀쩡한데 **남의 객체** 때문에 죽었다
//
//  실파일 대조는 저장소에 못 넣지만 숫자는 남긴다: 위 351건에 readDieline 을 태워
//  332건 성공 / 19건 실패(전부 「벡터 도형이 없다」·「칼선으로 볼 만한 도형이 없다」 =
//  스캔 이미지·본문 텍스트 문서라 **정상**), 351건 합계 1.0초 · 최대 32ms.
//  ⚠ 「성공」은 칼선을 맞혔다는 뜻이 아니다 — 견적서는 표 괘선을 170.3×254.6 으로
//    돌려준다. 그건 §9 가 적어둔 원리적 한계이고, 그래서 UI 가 후보·경고를 띄운다.
// ══════════════════════════════════════════════════════════════════

/** 객체 여러 개를 /ObjStm 컨테이너 하나로 포장한다 (PDF 32000-1 §7.5.7).
 *  앞쪽에 「객체번호 위치」 정수쌍이 /N 개, /First 부터 객체 본문이 이어 붙는다.
 *  안에 든 객체는 스트림일 수 없어서 "N G obj"·"stream" 이 없다 — 그게 이 포맷의 전부다. */
async function objStm(entries) {                       // [[num, "<<…>>"], …]
  let head = "", body = "";
  for (const [n, src] of entries) { head += `${n} ${body.length} `; body += src + " "; }
  return { bytes: await deflate(encL(head + body)), N: entries.length, first: head.length };
}

/** 객체를 차례로 써 넣는 최소 조립기. §F 는 xref 모양이 셋(순수 스트림·하이브리드·증분)이라
 *  §B 의 buildXrefStreamPdf 를 재활용하면 분기가 그쪽에 쌓인다 — 조립만 떼어 공유한다. */
function Doc0(header = "%PDF-1.5\n%\xE2\xE3\xCF\xD3\n") {
  const parts = [], off = {}; let len = 0;
  const raw = x => { const u = typeof x === "string" ? encL(x) : x; parts.push(u); len += u.length; };
  raw(header);
  return {
    off, raw, here: () => len,
    obj(n, dict, stream) {
      off[n] = len; raw(`${n} 0 obj\n`); raw(dict);
      if (stream) { raw("\nstream\n"); raw(stream); raw("\nendstream"); }
      raw("\nendobj\n");
    },
    done() { const out = new Uint8Array(len); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; },
  };
}
/** xrefStreamBody 는 0번부터 빽빽한 배열을 받는다 — 듬성듬성한 객체번호의 빈칸을 free(0)로 채운다 */
function rowSet() {
  const rows = [];
  return { rows, put(n, r) { while (rows.length < n) rows.push([0, 0, 0]); rows[n] = r; } };
}
const PAGE_MB = `[0 0 ${(PAGE_W * MM).toFixed(3)} ${(PAGE_H * MM).toFixed(3)}]`;   // 200×100mm
const DIE = w => `${MM} 0 0 ${MM} 0 0 cm ` + L8(20, 20, w, 30);                    // 칼선 w×30mm

/** 순수 xref 스트림 PDF — /Catalog·/Pages·/Page 가 **전부** /ObjStm 안에 있다.
 *  base   카탈로그 객체번호. 뒤로 밀면 「깨진 컨테이너의 객체가 먼저 조회되는」 배치가 된다
 *  orphan 아무도 참조하지 않는 **깨진** 컨테이너(7)를 끼우고 객체 1 이 그 안이라고 주장한다
 *  noRoot trailer 에서 /Root 를 뺀다 → 카탈로그 전수 조사 경로로 들어간다
 *  badSx  startxref 를 엉뚱한 값으로 → xref 체인이 통째로 사라진 파일 */
async function buildObjStmPdf({ w = 50, base = 1, orphan = false, noRoot = false, badSx = false } = {}) {
  const D = Doc0();
  const [cat, pgs, pg] = [base, base + 1, base + 2];
  const cont = await deflate(encL(DIE(w)));
  D.obj(4, `<</Length ${cont.length}/Filter/FlateDecode>>`, cont);
  const os = await objStm([
    [cat, `<</Type/Catalog/Pages ${pgs} 0 R>>`],
    [pgs, `<</Type/Pages/Kids[${pg} 0 R]/Count 1>>`],
    [pg,  `<</Type/Page/Parent ${pgs} 0 R/MediaBox${PAGE_MB}/Contents 4 0 R>>`],
  ]);
  D.obj(5, `<</Type/ObjStm/N ${os.N}/First ${os.first}/Length ${os.bytes.length}/Filter/FlateDecode>>`, os.bytes);
  if (orphan) D.obj(7, `<</Type/ObjStm/N 1/First 4/Length 20/Filter/FlateDecode>>`, encL("!!!broken-flate!!!!!"));
  const xoff = D.here();
  const { rows, put } = rowSet();
  put(0, [0, 0, 65535]);
  put(4, [1, D.off[4], 0]); put(5, [1, D.off[5], 0]); put(6, [1, xoff, 0]);
  if (orphan) { put(7, [1, D.off[7], 0]); put(1, [2, 7, 0]); }
  put(cat, [2, 5, 0]); put(pgs, [2, 5, 1]); put(pg, [2, 5, 2]);
  const xb = await xrefStreamBody(rows);
  D.obj(6, `<</Type/XRef/Size ${rows.length}/W[${XREF_W.join(" ")}]${noRoot ? "" : `/Root ${cat} 0 R`}/Filter/FlateDecode` +
           `/DecodeParms<</Predictor 12/Columns ${XREF_ROW}>>/Length ${xb.length}>>`, xb);
  D.raw(`startxref\n${badSx ? 999999999 : xoff}\n%%EOF\n`);
  return D.done();
}

/** 하이브리드 참조 파일 — 평문 xref table(신) + /XRefStm(압축객체 목록만).
 *  압축객체 8 은 **아무도 참조하지 않고** 컨테이너 7 은 깨져 있다. 그래도 읽혀야 한다. */
async function buildHybridPdf({ w = 60 } = {}) {
  const D = Doc0("%PDF-1.4\n");
  const body = encL(DIE(w));
  D.obj(1, `<</Type/Catalog/Pages 2 0 R>>`);
  D.obj(2, `<</Type/Pages/Kids[3 0 R]/Count 1>>`);
  D.obj(3, `<</Type/Page/Parent 2 0 R/MediaBox${PAGE_MB}/Contents 4 0 R>>`);
  D.obj(4, `<</Length ${body.length}>>`, body);
  D.obj(7, `<</Type/ObjStm/N 1/First 4/Length 20/Filter/FlateDecode>>`, encL("!!!broken-flate!!!!!"));
  const xsOff = D.here();
  const xb = await xrefStreamBody([[2, 7, 0]]);                  // /Index[8 1] → 객체 8 한 줄
  D.obj(9, `<</Type/XRef/Size 10/W[${XREF_W.join(" ")}]/Index[8 1]/Root 1 0 R/Filter/FlateDecode` +
           `/DecodeParms<</Predictor 12/Columns ${XREF_ROW}>>/Length ${xb.length}>>`, xb);
  const xoff = D.here();
  let x = `xref\n0 5\n0000000000 65535 f \n`;
  for (let n = 1; n <= 4; n++) x += String(D.off[n]).padStart(10, "0") + " 00000 n \n";
  x += `trailer\n<</Size 10/Root 1 0 R/XRefStm ${xsOff}>>\nstartxref\n${xoff}\n%%EOF\n`;
  D.raw(x);
  return D.done();
}

/** 증분 저장 — 구판 객체 3 은 평문(칼선 50), 신판 객체 3 은 **압축본**(칼선 80).
 *  신판 xref(스트림)를 먼저 읽으므로 압축본이 정본이다. Acrobat 이 그렇게 저장한다. */
async function buildIncrementalPdf() {
  const D = Doc0("%PDF-1.4\n");
  const oldBody = encL(DIE(50));
  D.obj(1, `<</Type/Catalog/Pages 2 0 R>>`);
  D.obj(2, `<</Type/Pages/Kids[3 0 R]/Count 1>>`);
  D.obj(3, `<</Type/Page/Parent 2 0 R/MediaBox${PAGE_MB}/Contents 4 0 R>>`);
  D.obj(4, `<</Length ${oldBody.length}>>`, oldBody);
  const oldX = D.here();
  let x = `xref\n0 5\n0000000000 65535 f \n`;
  for (let n = 1; n <= 4; n++) x += String(D.off[n]).padStart(10, "0") + " 00000 n \n";
  x += `trailer\n<</Size 5/Root 1 0 R>>\nstartxref\n${oldX}\n%%EOF\n`;
  D.raw(x);
  const newBody = await deflate(encL(DIE(80)));
  D.obj(10, `<</Length ${newBody.length}/Filter/FlateDecode>>`, newBody);
  const os = await objStm([[3, `<</Type/Page/Parent 2 0 R/MediaBox${PAGE_MB}/Contents 10 0 R>>`]]);
  D.obj(11, `<</Type/ObjStm/N ${os.N}/First ${os.first}/Length ${os.bytes.length}/Filter/FlateDecode>>`, os.bytes);
  const xoff = D.here();
  const { rows, put } = rowSet();
  put(0, [0, 0, 65535]); put(3, [2, 11, 0]);
  put(10, [1, D.off[10], 0]); put(11, [1, D.off[11], 0]); put(12, [1, xoff, 0]);
  const xb = await xrefStreamBody(rows);
  D.obj(12, `<</Type/XRef/Size ${rows.length}/W[${XREF_W.join(" ")}]/Root 1 0 R/Prev ${oldX}/Filter/FlateDecode` +
            `/DecodeParms<</Predictor 12/Columns ${XREF_ROW}>>/Length ${xb.length}>>`, xb);
  D.raw(`startxref\n${xoff}\n%%EOF\n`);
  return D.done();
}

console.log("\n═══ §F /ObjStm 압축 객체 스트림 ══════════════════════════════════════════");

// F1 순수 xref 스트림 — 카탈로그도 페이지도 컨테이너 안. type 2 를 실제로 풀지 못하면
//    이 파일은 읽을 **방법이 없다** (평문으로 남은 것은 콘텐트 스트림뿐이다).
{
  const { r, err } = await tryRead(await buildObjStmPdf({ w: 50 }), "F1-objstm.pdf");
  const ok = !err && near(r.bbox.w, 50, .05) && near(r.bbox.h, 30, .05) &&
             near(r.pageSize.w, PAGE_W, .05) && near(r.pageSize.h, PAGE_H, .05);
  check("F1 순수 /ObjStm — Catalog·Pages·Page 를 컨테이너에서 꺼낸다 = 50×30", ok,
        err || `${r.bbox.w}×${r.bbox.h} page ${r.pageSize.w}×${r.pageSize.h}`);
  console.log(`  ${ok ? "✓" : "✗"} Catalog·Pages·Page 전부 컨테이너 안 → ${err || `${r.bbox.w}×${r.bbox.h} · 페이지 ${r.pageSize.w}×${r.pageSize.h}`}`);
}

// F2 하이브리드 — 깨진 컨테이너가 있지만 **아무도 참조하지 않는다.** 읽혀야 하고(lazy),
//    그렇다고 침묵하면 안 된다(무엇을 못 읽었는지는 화면에 남는다). 둘 다 본다.
{
  const { r, err } = await tryRead(await buildHybridPdf({ w: 60 }), "F2-hybrid.pdf");
  const read = !err && near(r.bbox.w, 60, .05) && near(r.bbox.h, 30, .05);
  const warned = !err && r.warnings.some(w => /객체 스트림.*풀지 못했다/.test(w));
  check("F2 하이브리드 — 참조 안 된 깨진 컨테이너로는 실패하지 않는다 = 60×30", read,
        err || `${r.bbox.w}×${r.bbox.h}`);
  check("F2 하이브리드 — 못 푼 컨테이너를 경고로 알린다", warned,
        err || `warnings=${JSON.stringify(r.warnings)}`);
  console.log(`  ${read ? "✓" : "✗"} 깨진 컨테이너 1개(미참조) → ${err || r.bbox.w + "×" + r.bbox.h}` +
              `   경고 ${warned ? "있음 ✓" : "없음 ✗"}`);
}

// F3 증분 저장 — 최신 xref 가 「이 페이지의 정본은 압축본」이라고 말한다. 옛 xref 의
//    평문 오프셋이 그걸 덮으면 **구판이 조용히 이긴다** (종전 50×30 · 경고 0개).
//    Acrobat 증분 저장이 정확히 이 모양이라 견적서 PDF 에서 실제로 밟을 수 있는 경로다.
{
  const { r, err } = await tryRead(await buildIncrementalPdf(), "F3-incremental.pdf");
  const ok = !err && near(r.bbox.w, 80, .05) && near(r.bbox.h, 30, .05);
  check("F3 증분 저장 — 압축본(신판)이 평문(구판)을 이긴다 = 80×30", ok, err || `${r.bbox.w}×${r.bbox.h} (기대 80×30)`);
  console.log(`  ${ok ? "✓" : "✗"} 구판 평문 50 / 신판 압축 80 → ${err || r.bbox.w + "×" + r.bbox.h}   (종전 50×30 무경고)`);
}

// F4 startxref 가 깨진 /ObjStm PDF — 구식 xref table 파일에는 이미 전수 스캔 복구가
//    있었는데(_scanAll), 그건 평문 "N G obj" 만 훑으므로 압축객체는 아예 안 보였다.
//    컨테이너를 본문에서 직접 찾아 풀지 않으면 멀쩡한 파일이 「손상됐다」로 끝난다.
{
  const { r, err } = await tryRead(await buildObjStmPdf({ w: 50, badSx: true }), "F4-badstartxref.pdf");
  const ok = !err && near(r.bbox.w, 50, .05) && near(r.bbox.h, 30, .05);
  check("F4 startxref 깨진 /ObjStm — 컨테이너를 본문에서 찾아 복구한다 = 50×30", ok, err || `${r.bbox.w}×${r.bbox.h}`);
  console.log(`  ${ok ? "✓" : "✗"} xref 체인 소실 → ${err || r.bbox.w + "×" + r.bbox.h}   (종전 「PDF 가 아니거나 손상됐다」)`);
}

// F5 카탈로그 전수 조사 중에 「깨진 컨테이너에 든, 아무도 안 쓰는 객체」를 먼저 만난다.
//    거기서 던지면 바로 뒤의 카탈로그(9)를 못 찾는다 — lazy 규약이 루프 안에서 깨지는 자리다.
//    ⚠ 객체번호 1 이라 **반드시 9보다 먼저** 조회된다. 순서가 반대면 이 테스트는 아무것도 안 잰다.
{
  const { r, err } = await tryRead(await buildObjStmPdf({ w: 90, base: 9, orphan: true, noRoot: true }), "F5-orphan.pdf");
  const ok = !err && near(r.bbox.w, 90, .05) && near(r.bbox.h, 30, .05);
  check("F5 /Root 없음 + 미참조 깨진 컨테이너 — 카탈로그를 찾아낸다 = 90×30", ok, err || `${r.bbox.w}×${r.bbox.h}`);
  console.log(`  ${ok ? "✓" : "✗"} 깨진 객체 1 을 먼저 조회 → ${err || r.bbox.w + "×" + r.bbox.h}   (종전 「객체 1 …꺼내지 못했다」)`);
}

// ══════════════════════════════════════════════════════════════════
//  §D  guessSheet — 페이지 크기 → 판형 (BASE_SHEETS 대조, ±3mm)
// ══════════════════════════════════════════════════════════════════
console.log("\n═══ §D guessSheet ═══════════════════════════════════════════════════════");
const SHEETS = [
  [{ w: 788, h: 545 }, "4x62", "iSHAP 무제-3 실측 페이지"],
  [{ w: 545, h: 394 }, "4x64", "축을 바꿔도 같은 판형이어야 한다"],
  [{ w: 636, h: 469 }, "guk2", "국2"],
  [{ w: 444, h: 597 }, "ha4", "하4"],
  [{ w: 788.0, h: 1091.0 }, "46", "46전지"],
  [{ w: 786, h: 543 }, "4x62", "±3mm 안"],
  [{ w: 420, h: 297 }, null, "A3 는 판형이 아니다 (소스코 파일 페이지)"],
  [{ w: 890, h: 670 }, null, "주문생산은 자동 인식 대상이 아니다"],
];
for (const [ps, want, why] of SHEETS) {
  const got = guessSheet(ps);
  const ok = got === want;
  check(`guessSheet ${ps.w}×${ps.h}`, ok, `${got} (기대 ${want})`);
  console.log(`  ${ok ? "✓" : "✗"} ${(ps.w + "×" + ps.h).padEnd(14)} → ${String(got).padEnd(8)} ${why}`);
}

// ══════════════════════════════════════════════════════════════════
//  집계
// ══════════════════════════════════════════════════════════════════
const TOTAL = PASS + KNOWN.length + FAIL.length;
console.log(`\n${"═".repeat(100)}`);
// SKIP 이 있으면 점수를 **점수로 읽히게 쓰지 않는다.** 「18/18」 이라는 문자열 자체가
// 실측 대조를 했다는 오해를 만든다 — 분모를 고치는 것보다 문장을 고치는 것이 정확하다.
console.log(`PDF 칼선 추출: ${PASS}/${TOTAL}` +
  (KNOWN.length ? `  (+ 문서화된 차이 ${KNOWN.length}건)` : "") +
  (SKIP.length ? `  ⊘ 실측 대조 ${SKIP.length}건 미실행 — **점수 아님** (합성 테스트만 돌았다)` : ""));
for (const [label, why, detail] of KNOWN)
  console.log(`  ⚠ ${label}: ${detail} — ${why}`);
for (const [label, file] of SKIP)
  console.log(`  ⊘ SKIP ${label}: 파일 없음 ${file}`);
for (const [label, detail] of FAIL)
  console.log(`  ✗ ${label}: ${detail}`);

// 실측 요약 — 「기존 오라클 재현」과 「새로 확정한 값」을 섞어 적지 않는다
console.log(`\n※ ‡ 이 추출기가 새로 확정한 실측 (기존 오라클 없음 — 위 표의 PASS 는 재현이 아니라 회귀 고정이다)`);
for (const c of CASES) {
  if (!fs.existsSync(c.file)) continue;
  if (c.hNew) console.log(`  ‡ ${c.name}: netH ${c.h} — ${c.hNew}`);
  if (c.altW) console.log(`  ‡ ${c.name}: netW ${c.altW} (문서 오라클 ${c.w}) — ${c.knownW}`);
}
if (FAIL.length) process.exitCode = 1;
// SKIP 도 실패다 — 오라클을 못 읽었으면 이 스위트는 아무것도 증명하지 않았다.
if (SKIP.length) {
  if (ALLOW_SKIP) {
    console.log(`\n⊘ 오라클 ${SKIP.length}건 부재를 면제했다 (${process.env.PDF_ALLOW_SKIP === "1" ? "PDF_ALLOW_SKIP=1" : "--allow-skip"}).` +
      `  이 실행은 합성 테스트만 통과했다 — 실측 회귀는 검사하지 않았다.`);
  } else {
    console.log(`\n✗ 실측 오라클 ${SKIP.length}건을 읽지 못했다 → 실패로 처리한다.` +
      `\n  · 오라클이 다른 위치에 있으면:  PDF_ORACLE_DIR=<뿌리> node test/verify-pdf.mjs` +
      `\n  · 오라클이 없는 것이 정상이면(CI·클린 클론):  PDF_ALLOW_SKIP=1 node test/verify-pdf.mjs` +
      `\n  왜 통과시키지 않나: 종전에는 SKIP 8건이어도 「18/18」 초록이 떠서 실측 대조가` +
      ` 한 건도 안 돌아간 것을 4주간 아무도 몰랐다.`);
    process.exitCode = 1;
  }
}

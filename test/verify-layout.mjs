// ══════════════════════════════════════════════════════════════════
//  이 파일은 src/domain/data/sheets.mjs 와 src/domain/dieline/index.mjs 를
//  **직접 import** 한다. 종전에는 판형표·인쇄기 상한·전개도 공식을 전부 복제했고,
//  그 복제본의 전개도 공식은 2세대 전(맞뚜껑 D/2+20 · 삼면 0.059D+12.65) 이었다.
//
//  물림(BITE) · 판걸이 수율 역산 검증
//
//  견적서 「단위」 열 = 실제 주문 재단 크기.
//  전개도 크기가 명시된 건 + 판형 최대크기 + 견적서 up 을 대조해서
//    ① 물림(gripper margin)이 실제로 몇 mm인지
//    ② 판걸이 수율이 대략 몇 %로 나오는지
//  를 역산한다.
// ══════════════════════════════════════════════════════════════════
import {
  BASE_SHEETS, PRESS_MAX_LONG, PRESS_MAX_SHORT, effectiveSheet,
} from "../src/domain/data/sheets.mjs";
import { calcNetSize } from "../src/domain/dieline/index.mjs";

// 판형표는 실코드에서 온다. label 은 표 폭에 맞춰 괄호(크기)만 떼어 쓴다.
const SHEET = Object.fromEntries(
  BASE_SHEETS.filter(s => !s.custom)
    .map(s => [s.id, { ...s, label: s.label.split("(")[0].trim() }]));

/**
 * 물림 bite(mm, 총량)를 적용한 유효 인쇄영역에 netW×netH 를 몇 개 앉힐 수 있나.
 * ⚠ 이건 앱 로직의 미러가 아니다 — **물림 후보값을 스캔하는 문서형 도구**다.
 *   앱은 축별 비대칭 물림(짧은변 30 / 긴변 20)을 쓰고 맞물림까지 계산하지만,
 *   여기서는 "물림이 몇 mm 여야 견적서 up 이 나오나" 를 단순 격자로 훑는다.
 *   실제 배치 재현은 verify-net · scorecard-unit 이 solveImposition 으로 본다.
 */
function upOn(netW, netH, sw, sh, bite) {
  const pw = sw - bite, ph = sh - bite;
  if (pw <= 0 || ph <= 0) return 0;
  const a = Math.floor(pw / netW) * Math.floor(ph / netH);
  const b = Math.floor(pw / netH) * Math.floor(ph / netW);
  return Math.max(a, b);
}

// ── A. 전개도 크기가 견적서/도면에 명시된 건 ──────────────────────
// [이름, 전개도W, 전개도H, 판형, 견적서 단위(재단크기), 견적서 up]
const EXPLICIT = [
  ["트레이A",        461, 370, "4x64", [545,394], 1],
  ["트레이B", 472, 356, "4x64", [545,394], 1],
  ["조립형",  324, 428, "ha3",  [889,394], 2],
  ["슬리브",     646, 258, "4x64", [545,394], 1],
];

console.log("═══ A. 전개도 실측이 명시된 건 — 물림 후보값별 up 재현 ═══════════════════");
console.log("케이스".padEnd(20)+"전개도      판형   재단크기   견적서up │ bite=0  10  20  30  40");
console.log("-".repeat(96));
for (const [nm, nw, nh, sid, cut, realUp] of EXPLICIT) {
  const s = SHEET[sid];
  const res = [0,10,20,30,40].map(b => upOn(nw, nh, s.w, s.h, b));
  console.log(
    nm.padEnd(20) + `${nw}×${nh}`.padEnd(12) + s.label.padEnd(7) +
    `${cut[0]}×${cut[1]}`.padEnd(11) + String(realUp).padStart(5) + "up  │ " +
    res.map((v,i) => (v===realUp ? `\x1b[32m${String(v).padStart(2)}✓\x1b[0m` : `${String(v).padStart(2)} `)).join("  ")
  );
}

console.log("\n═══ B. 재단크기 대비 원지 최대크기 — 코리팩가 얼마나 잘라내나 ════════════");
console.log("케이스".padEnd(22)+"판형   원지최대     재단크기     잘라낸양(가로/세로)   면적비");
console.log("-".repeat(96));
// [이름, 판형, 견적서 단위]
const CUTS = [
  ["삼면B(BT패키지)", "46",   [980,720]],
  ["G형B",          "46",   [800,700]],
  ["G형A",          "46",   [900,680]],
  ["G형C",          "46",   [990,590]],
  ["삼면F/맞뚜껑B",  "4x62", [760,480]],
  ["십자A/UV건/화장품",   "4x62", [788,545]],
  ["주문생산B",            "4x62", [480,788]],
  ["합지A 1번",       "4x62", [520,700]],
  ["4×64 전건",         "4x64", [545,394]],
  ["하4 전건",          "ha4",  [597,444]],
  ["하3 (조립형)",     "ha3",  [889,394]],
  ["하2 (싸바리A)",     "ha2",  [840,500]],
  ["하2 (칼선-06)",     "ha2",  [800,597]],
  ["국2 전건",          "guk2", [636,469]],
  ["4×63 (손잡이형)",   "4x63", [363,650]],
];
let ratios = [];
for (const [nm, sid, cut] of CUTS) {
  const s = SHEET[sid];
  // 재단크기를 원지 축에 맞춰 정렬 (긴 변끼리 비교)
  const [cl, cs] = [Math.max(...cut), Math.min(...cut)];
  const [sl, ss] = [Math.max(s.w, s.h), Math.min(s.w, s.h)];
  const dl = sl - cl, ds = ss - cs;
  const ar = (cl*cs)/(sl*ss);
  ratios.push(ar);
  const bad = dl < 0 || ds < 0;
  console.log(
    nm.padEnd(22) + s.label.padEnd(7) + `${sl}×${ss}`.padEnd(12) + `${cl}×${cs}`.padEnd(12) +
    `${String(dl).padStart(5)} / ${String(ds).padStart(4)}`.padEnd(22) +
    (ar*100).toFixed(1).padStart(5) + "%" + (bad ? "  ✗ 원지 초과!" : "")
  );
}
const avg = ratios.reduce((a,b)=>a+b,0)/ratios.length;
console.log("-".repeat(96));
console.log(`재단 면적비 평균 ${(avg*100).toFixed(1)}%  (최소 ${(Math.min(...ratios)*100).toFixed(1)}% / 최대 ${(Math.max(...ratios)*100).toFixed(1)}%)`);

console.log("\n═══ C. 판걸이 수율 — up × 전개도면적 ÷ 재단면적 ═════════════════════════");
console.log("케이스".padEnd(22)+"전개도       up   전개도면적×up    재단면적    수율");
console.log("-".repeat(96));
// [이름, 전개도W, 전개도H, up, 재단크기]  ← 전개도는 실측 또는 구조공식
const YIELD = [
  ["트레이A",         461, 370, 1, [545,394]],
  ["트레이B",         472, 356, 1, [545,394]],
  ["조립형",           324, 428, 2, [889,394]],
  ["삼면E (삼면접착)",  354, 189, 2, [545,394]],
  ["삼면D",        192, 148, 2, [545,394]],
  ["삼면A",         364, 253, 2, [597,444]],
  ["삼면B",           614, 305, 3, [980,720]],
  ["십자B (십자)",   294, 165, 4, [444,597]],
  ["십자A (십자)",        202, 217, 6, [788,545]],
  ["맞뚜껑A (맞뚜껑)", 224, 168, 6, [636,469]],
  ["삼면F (삼면)",     374, 375, 2, [760,480]],
  ["손잡이형",     340, 300, 1, [363,650]],
];
let ys = [];
for (const [nm, nw, nh, up, cut] of YIELD) {
  const used = up*nw*nh, tot = cut[0]*cut[1];
  const y = used/tot; ys.push(y);
  console.log(
    nm.padEnd(22) + `${nw}×${nh}`.padEnd(13) + String(up).padStart(2) + "up " +
    String(used.toLocaleString()).padStart(12) + String(tot.toLocaleString()).padStart(12) +
    (y*100).toFixed(1).padStart(8) + "%"
  );
}
ys.sort((a,b)=>a-b);
const med = ys[Math.floor(ys.length/2)];
console.log("-".repeat(96));
console.log(`수율 중위값 ${(med*100).toFixed(1)}%  ·  범위 ${(ys[0]*100).toFixed(1)}~${(ys[ys.length-1]*100).toFixed(1)}%`
  + `  ·  평균 ${(ys.reduce((a,b)=>a+b,0)/ys.length*100).toFixed(1)}%`);

console.log("\n═══ D. 인쇄기 최대 판 크기 역산 — 「단위」 전건의 상한 ════════════════════");
const ALL_UNITS = [
  [980,720,"46전지 삼면B"], [990,590,"46전지 G형C"], [900,680,"46전지 G형A"],
  [800,700,"46전지 G형B"], [890,670,"주문생산 주문생산A"], [750,636,"주문생산 칼선-06"],
  [710,620,"주문생산 싸바리C"], [889,394,"하3 조립형"], [840,500,"하2 싸바리A"],
  [800,597,"하2 칼선-06"], [788,545,"4×62 십자A·UV건"], [760,480,"4×62 삼면F"],
  [520,700,"4×62 합지A"], [480,788,"4×62 주문생산B"], [605,485,"국2 싸바리B"],
  [470,710,"주문생산 싸바리A판지"], [636,469,"국2 전건"], [597,444,"하4 전건"],
  [545,394,"4×64 전건"], [363,650,"4×63 손잡이형"],
];
let maxL = 0, maxS = 0, nl = "", ns = "";
for (const [a,b,nm] of ALL_UNITS) {
  const l = Math.max(a,b), s = Math.min(a,b);
  if (l > maxL) { maxL = l; nl = nm; }
  if (s > maxS) { maxS = s; ns = nm; }
}
console.log(`「단위」 ${ALL_UNITS.length}종 최대 긴변  ${maxL}mm  (${nl})`);
console.log(`「단위」 ${ALL_UNITS.length}종 최대 짧은변 ${maxS}mm  (${ns})`);
console.log(`→ 인쇄기 최대 판 = ${maxL}×${maxS}`);
const pressOk = maxL <= PRESS_MAX_LONG && maxS <= PRESS_MAX_SHORT;
console.log(`   sheets.mjs PRESS_MAX = ${PRESS_MAX_LONG}×${PRESS_MAX_SHORT}  ` +
            `${pressOk ? "✓ 초과 단위 0건" : "✗ 상한을 넘는 단위가 있다"}`);
if (!pressOk) process.exitCode = 1;

console.log("\n판형     원지        유효 인쇄판     재단 필요?");
for (const sid of Object.keys(SHEET)) {
  const s = SHEET[sid], e = effectiveSheet(s.w, s.h);
  console.log(`${s.label.padEnd(9)}${`${Math.max(s.w,s.h)}×${Math.min(s.w,s.h)}`.padEnd(12)}` +
              `${`${e.long}×${e.short}`.padEnd(16)}${e.capped?"⚠ 예":"아니오"}`);
}

console.log("\n═══ E. up 재현 — 인쇄기 제약 적용 전/후 ══════════════════════════════════");
// 전개도는 calcNetSize(실코드) 로 낸다. 물림은 후보 20mm 로 고정 — 이 절의 관심사는
// 「원지 최대크기로 재면 up 이 과대평가되는가」이지 물림 방침 자체가 아니다.
const UPC = [
  ["삼면B",210,90,180,"glue_3side","46",3],   ["G형B",220,210,110,"gtype_tray","46",1],
  ["G형A",350,280,70,"gtype_tray","46",1],     ["G형C",130,130,55,"gtype_tray","46",1],
  ["삼면F",90,90,250,"glue_3side","4x62",2],   ["십자A",47,47,176,"cross","4x62",6],
  ["삼면E",90,70,130,"glue_3side","4x64",2],   ["삼면C",52,50,90,"glue_3side","4x64",4],
  ["삼면A",120,55,180,"glue_3side","ha4",2], ["십자B",70,70,55,"cross","ha4",4],
  ["맞뚜껑A",92,13,140,"tuck_both","guk2",6],
];
console.log("케이스".padEnd(14)+"구조".padEnd(12)+"판형".padEnd(9)+"공식전개도".padEnd(14)+"원지기준  인쇄기제약  견적서");
console.log("-".repeat(88));
let a0=0, a1=0;
for (const [nm,W,D,H,t,sid,real] of UPC) {
  const n = calcNetSize(W,D,H,t), s = SHEET[sid];
  const raw = upOn(n.netW,n.netH,Math.max(s.w,s.h),Math.min(s.w,s.h),20);
  const e = effectiveSheet(s.w, s.h);
  const cap = upOn(n.netW,n.netH,e.long,e.short,20);
  if (raw===real) a0++; if (cap===real) a1++;
  console.log(nm.padEnd(14)+t.padEnd(12)+s.label.padEnd(9)+`${n.netW.toFixed(0)}×${n.netH.toFixed(0)}`.padEnd(14)+
    String(raw).padStart(5)+(raw===real?"✓":" ")+String(cap).padStart(10)+(cap===real?"✓":" ")+String(real).padStart(8));
}
console.log("-".repeat(88));
console.log(`원지 최대 기준 ${a0}/${UPC.length}  →  인쇄기 제약(${PRESS_MAX_LONG}×${PRESS_MAX_SHORT}) 적용 ${a1}/${UPC.length}`);
console.log(`
※ G형 3건은 gtype_tray(뚜껑일체) 공식으로 갱신했다 — 종전에는 이 파일이 복제한
  옛 gtype 공식(W+4D+14 / 2H+3D+1)을 썼고, G형A 350×280×70 을 1484×981 로 내서
  물리적으로 불가능한 크기였다(칼선 실측 4건으로 확정된 공식은 674.5×789.5).
※ 이 표는 맞물림을 계산하지 않는 단순 격자다. 앱의 실제 up 은 맞물림·엇갈림까지
  보는 nest 엔진이 낸다 → verify-net 「판걸이 up 재현」이 그쪽 점수다.`);

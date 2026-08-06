// ══════════════════════════════════════════════════════════════════
//  이 파일은 실코드만 호출한다.
//    §  인쇄비  : src/domain/process/print.mjs  printSide()
//    §A 도수    : print-prices.mjs sideColors + printSide
//    §B §C 판형 : src/domain/sheet-select.mjs  findBestSheet()
//
//  ⚠ §B·§C 는 종전에 pickNew / 하드롱 비교식을 **자체 재구현**했다. 상수만
//    import 하고 비교식은 사본이라, near.sort 의 정렬 키를 뒤집거나
//    (1−HADRONG_EDGE) 를 (1+…) 로 뒤집어도 12개 테스트 전부 통과했다
//    (돌연변이 검증으로 확인). 이제 findBestSheet 를 직접 부른다 —
//    정책을 바꾸면 여기가 즉시 깨진다.
// ══════════════════════════════════════════════════════════════════
import { printSide } from "../src/domain/process/print.mjs";
import { SPOT_WEIGHT, sideColors } from "../src/domain/data/print-prices.mjs";
import { TIE_PCT, HADRONG_EDGE, findBestSheet } from "../src/domain/sheet-select.mjs";
import { buildDieline } from "../src/domain/quote.mjs";
import { lossOptionsOf } from "../src/domain/reams.mjs";

/** 인쇄비 검산은 도수환산(weight) 모드. UV·별색R당단가 분기는 verify-total 이 본다 */
const side = (color, spot, black) => ({ color, spot, black, uv: false });
const runSide = (sd, pR, unit) =>
  printSide(sd, { processR: pR, printUnit: unit, spotMode: "weight", spotRpr: 0, qty: 0 });

// [이름, 공정R, 별색도수, 먹유무, 원색4도, 실측인쇄수량, 실측도당단가, 실측금액]
const CASES = [
  // ── 원색 4도 ────────────────────────────────────────────────────
  ["Q2a 맞뚜껑A 1만",   1.7, 0, false, true,   6.8, 14000,  95200],
  ["Q2b 맞뚜껑A 3만",   5.0, 0, false, true,  20,   14000, 280000],
  ["Q2c 맞뚜껑A 5만",   8.4, 0, false, true,  34,   14000, 476000],
  ["Q3  삼면A",       1,   0, false, true,   4,   14000,  56000],
  ["Q5  삼면C52x50x90",   1,   0, false, true,   4,   14500,  58000],
  ["Q6  삼면D",     1,   0, false, true,   4,   14000,  56000],
  ["Q8  삼면F 3만",    15,   0, false, true,  60,   11500, 690000],
  ["Q11a 십자B 후면", 2,   0, false, true,   8,   13000, 104000],
  ["Q21 손잡이형",         2,   0, false, true,   8,   14500, 116000],
  ["Q14b 1500아트지",      1.3, 0, false, true,   6,   14000,  84000],
  ["E09 삼면C 5천",       1.3, 0, false, true,   6,   13000,  78000],
  ["E11 2종A 5천",       1.4, 0, false, true,   6,   13000,  78000],
  ["E20 주문생산B 1만",        2.5, 0, false, true,  10,   13000, 130000],
  ["E47 삼면E 원색4",   1,   0, false, true,   4,   14000,  56000],
  ["E53 스타킹 2천",       1,   0, false, true,   4,   14500,  58000],
  ["E57 화장품 5천",       5,   0, false, true,  20,   14000, 280000],
  ["E64 삼면G",       1,   0, false, true,   4,   14000,  56000],
  // ── 별색 (도수환산형) ──────────────────────────────────────────
  ["Q7/E46/E48 삼면E 별2", 1, 2, false, false, 6,  14000,  84000],
  ["Q15a 트레이A 먹1별1",  1, 1, true,  false, 4,  14500,  58000],
  ["Q15b 트레이A 2R",      2, 1, true,  false, 8,  14500, 116000],
];

let ok = 0;
console.log("케이스".padEnd(28)+"공정R  규격         │ 인쇄수량 실측/계산 │ 금액 실측/계산");
console.log("-".repeat(94));
for (const [name, pR, spot, bk, color, realQ, unit, realAmt] of CASES) {
  const r     = runSide(side(color, spot, bk), pR, unit);
  const q     = r ? r.qty : 0;
  const amt   = r ? r.amount : 0;
  const hit   = Math.abs(amt - realAmt) <= Math.max(1, realAmt * 0.005);
  if (hit) ok++;
  const spec = color ? "원색4" : (spot ? `별색${spot}` : "") + (bk ? "+먹1" : "");
  console.log(
    name.padEnd(28) + String(pR).padStart(4) + "  " + spec.padEnd(12) +
    ` │ ${String(realQ).padStart(5)} ${String(q).padStart(5)}   ` +
    ` │ ${realAmt.toLocaleString().padStart(9)} ${amt.toLocaleString().padStart(9)} ` + (hit?"✓":"✗")
  );
}
console.log("-".repeat(94));
console.log(`인쇄비 일치: ${ok}/${CASES.length} (${Math.round(ok/CASES.length*100)}%)`);

// ══════════════════════════════════════════════════════════════════
// 회귀 검증 — 원색 + 별색 병행, 그리고 도수가 판형 선택을 흔들지 않는지
// ══════════════════════════════════════════════════════════════════
console.log("\n═══ A. 원색 4도 + 별색 병행 ══════════════════════════════════════════════");
// 종전 버그: 원색 4도를 켜면 별색 입력칸이 사라지고 spotDo 가 0 으로 강제됐음.
// 실무에선 원색4도 + 별색2도(= 6도) 조합이 흔하다.
// 소부 도수는 sideColors(별색도 1도로 셈), 인쇄 가중치는 printSide 가 공정R=1 에서 내는 수량.
const COMBO = [
  // [원색, 별색, 먹, 기대 소부도수, 기대 인쇄가중치]
  [false, 1, false, 1,  3],
  [false, 2, false, 2,  6],
  [false, 1, true,  2,  4],
  [true,  0, false, 4,  4],
  [true,  0, true,  5,  5],
  [true,  2, false, 6, 10],   // ★ 종전엔 별색이 0 으로 무시되어 4도/4 로 계산됨
  [true,  2, true,  7, 11],
];
console.log("조합".padEnd(26)+"소부 도수".padEnd(12)+"인쇄 가중치".padEnd(14)+"인쇄수량(1R)");
console.log("-".repeat(72));
let cOk = 0;
for (const [c, sp, bk, expDo, expU] of COMBO) {
  const sd = side(c, sp, bk);
  const d = sideColors(sd), u = runSide(sd, 1, 1).qty;
  const hit = d===expDo && u===expU;
  if (hit) cOk++;
  const label = [c?"원색4도":"", sp>0?`별색${sp}도`:"", bk?"먹1도":""].filter(Boolean).join("+");
  console.log(label.padEnd(26)+`${d} (기대 ${expDo})`.padEnd(12)+`${u} (기대 ${expU})`.padEnd(14)+
    `${u}`.padEnd(6)+(hit?"✓":"✗"));
}
console.log("-".repeat(72));
console.log(`원색+별색 병행: ${cOk}/${COMBO.length}   (별색 가중치 SPOT_WEIGHT=${SPOT_WEIGHT})`);
if (cOk !== COMBO.length) process.exitCode = 1;

// ══════════════════════════════════════════════════════════════════
//  판형 자동선택 — findBestSheet 직접 호출
// ══════════════════════════════════════════════════════════════════
/** 실 박스 규격 → findBestSheet. 앱이 타는 인자를 그대로 만든다 */
function pickSheet({ box, paperId, qty, front = {}, back = {}, beda = false, hasEmb = false }) {
  const dieline = buildDieline(box);
  const F = { color:false, spot:0, black:false, uv:false, ...front };
  const B = { color:false, spot:0, black:false, uv:false, ...back };
  const lossOpts = lossOptionsOf({ front:F, back:B, beda }, { hasEmb }, "");
  return findBestSheet({ dieline, qty, sheetIdHint:"auto", paperId, lossOpts });
}

const BOX_5040 = { mode:"box", structure:"glue_3side", W:50, D:40, H:81, hangTab:0 };

console.log("\n═══ B. 도수가 판형 선택을 바꾸지 않는지 ══════════════════════════════════");
// 종전 버그: 우선순위를 총비용에 **곱해서**(총비용 × (1+(priority−1)×0.01))
//   판형과 무관한 인쇄 도수까지 곱해지는 밑값에 들어가 순위가 뒤집혔다.
// 실측: 삼면접착 50×40×81 · AB라이트295 · 1,000ea — 별색1도면 하4, 원색4도면 4×64 로
//   갈렸다. 같은 박스인데 인쇄 도수 때문에 원지·판걸이·R수가 통째로 바뀐 것이다.
// 현행 규칙(TIE_PCT 동점 → 실무 우선순위)에서는 도수와 무관해야 한다.
const DOSU = [
  ["별색1도",        { spot:1 }],
  ["원색4도",        { color:true }],
  ["원색4+먹",       { color:true, black:true }],
  ["원색4+별색2",    { color:true, spot:2 }],
  ["원색4+별색2+먹", { color:true, spot:2, black:true }],
];
console.log("인쇄 도수".padEnd(20)+"선택 판형".padEnd(10)+"up".padEnd(6)+"지대R".padEnd(9)+"랭킹비용");
console.log("-".repeat(72));
const picks = new Set();
for (const [label, front] of DOSU) {
  const r = pickSheet({ box:BOX_5040, paperId:"AB295L", qty:1000, front });
  picks.add(r.id);
  console.log(label.padEnd(20)+r.id.padEnd(10)+`${r.up}up`.padEnd(6)+
              r.R.toFixed(3).padEnd(9)+Math.round(r.rankCost).toLocaleString());
}
console.log("-".repeat(72));
const stable = picks.size === 1;
console.log(`도수와 무관하게 ${picks.size}종 판형  ${stable?"✓ (원지·판걸이·R수 일관)":"✗ 갈림: "+[...picks]}` +
            `   (TIE_PCT=${(TIE_PCT*100).toFixed(1)}%)`);
if (!stable) process.exitCode = 1;

// ── 동점 구간에서 「우선순위 우선」이 실제로 작동하는지 ─────────────────
// 위 §B 케이스들은 4×64 가 최저비용이기도 해서 정렬 키를 뒤집어도 답이 같다.
// 그래서 우선순위와 최저비용이 **엇갈리는** 케이스를 하나 못 박아 둔다:
//   맞뚜껑 60×60×60 · AB295L 5,000ea (전개도 254.3×153.0, 양쪽 단가 실측)
//     4×64 4up  rank 431,268   우선순위 1
//     4×62 10up rank 429,750   우선순위 3   ← 0.35% 저렴 (TIE_PCT 1.5% 안)
//   규칙은 「TIE_PCT 안이면 실무 우선순위」이므로 4×64 가 이겨야 한다.
//   ⚠ 이 한 줄이 near.sort 의 정렬 키를 지키는 유일한 게이트다.
//     (a.rankCost - b.rankCost 를 앞에 두면 4×62 가 나와 여기서 깨진다)
{
  const r = pickSheet({ box:{ mode:"box", structure:"tuck_both", W:60, D:60, H:60, hangTab:0 },
                        paperId:"AB295L", qty:5000, front:{ color:true } });
  const hit = r.id === "4x64";
  console.log(`동점 구간 우선순위: 맞뚜껑 60×60×60 · AB295L 5,000ea → ${r.id} ${r.up}up ` +
              `(우선순위 ${r.priority}, rank ${Math.round(r.rankCost).toLocaleString()})  ` +
              `기대 4x64  ${hit?"✓":"✗"}`);
  if (!hit) process.exitCode = 1;
}

console.log("");
console.log("═══ C. 하드롱 계열은 확실히 유리할 때만 ═══════════════════════════════════");
// 실무: "하드롱은 왠만하면 안 쓴다. 국절이나 46절이 너무 수율이 안 좋을 때만 쓴다."
// → 사륙·국전 최선안보다 HADRONG_EDGE 이상 저렴할 때만 하드롱 채택
//   조립형은 견적서가 하3 2up 이므로 하드롱이 이겨야 하고,
//   삼면 50×40×81 은 하4 가 3.3% 밖에 안 싸서 사륙이 이겨야 한다.
const HADR = [
  ["조립형 324×428 · AB400 3,000ea",
   { mode:"net", netW:428, netH:324 }, "AB400", 3000, { spot:1 }, "하드롱",
   "견적서 = 하3 2up. 지대 우위 12.5%(총비용 9.3%) → 6% 문턱 통과"],
  ["삼면 50×40×81 · 295L 1,000ea (별색1)",
   BOX_5040, "AB295L", 1000, { spot:1 }, "사륙·국전",
   "하4 지대 70,375 vs 4×64 77,840 → 3.3% 우위로 부족"],
  ["삼면 50×40×81 (원색4+별색2)",
   BOX_5040, "AB295L", 1000, { color:true, spot:2 }, "사륙·국전",
   "도수가 커지면 총비용 기준 우위가 더 줄어듦"],
];
console.log("케이스".padEnd(38)+"선택".padEnd(9)+"up".padEnd(6)+"계열".padEnd(11)+"기대");
console.log("-".repeat(96));
let ok2 = 0;
for (const [nm, box, paperId, qty, front, exp] of HADR) {
  const r = pickSheet({ box, paperId, qty, front });
  const fam = r.family === "하드롱" ? "하드롱" : "사륙·국전";
  const hit = fam === exp;
  if (hit) ok2++;
  console.log(nm.padEnd(38)+r.id.padEnd(9)+`${r.up}up`.padEnd(6)+fam.padEnd(11)+exp+(hit?" ✓":" ✗"));
}
console.log("-".repeat(96));
console.log(`하드롱 채택 규칙: ${ok2}/${HADR.length}   (HADRONG_EDGE=${(HADRONG_EDGE*100).toFixed(0)}%)`);
for (const [nm,,,,,,why] of HADR) console.log("  · " + nm + "\n      " + why);
console.log("");
console.log("⚠ 배수 페널티(총비용 × 1.12)로 구현하면 안 된다 —");
console.log("  총비용에 판형과 무관한 공정추정이 섞여 지대 우위가 희석돼");
console.log("  실제 견적서(하3)와 어긋난다. 명시적 우위 조건(6%)을 쓴다.");
if (ok2 !== HADR.length) process.exitCode = 1;

console.log("");
console.log("═══ D. 추정 지대단가가 실측 단가를 이기지 않는지 ═══════════════════════════");
// 실측 사례: 맞뚜껑 40×62 계열에서 하2 의 AB350 단가는 면적환산 **추정값**이고
//   4×62 는 실측값인데, 추정 단가가 실측을 이겨 10.8% 더 비싼 견적을 냈다.
//   견적서 라인에는 「⚠추정」이 뜨지만 선택 단계는 실측/추정을 구분하지 않았다.
// → EST_PRICE_PENALTY(3%) 로 "동급이면 실측을 고른다" 를 강제한다.
//   하드 차단이 아니다 — 단가표가 희소해서(지종당 실측 1~2 판형) 추정 판형이
//   확실히 저렴하면 여전히 이긴다. 12,096건 스캔에서 페널티가 선택을 바꾼 것은
//   523건(4.3%)이고 전부 「추정 → 실측」 방향이었다.
const EST = [
  // [이름, box, 지종, 수량, 기대 판형, 페널티 없을 때 나오던 판형]
  ["맞뚜껑 40×20×120 · AB270 20,000ea",
   { mode:"box", structure:"tuck_both", W:40, D:20, H:120, hangTab:0 }, "AB270", 20000,
   "4x62", "ha2(추정)"],
  ["맞뚜껑 40×20×120 · MK350 5,000ea",
   { mode:"box", structure:"tuck_both", W:40, D:20, H:120, hangTab:0 }, "MK350", 5000,
   "4x64", "4x63(추정)"],
];
console.log("케이스".padEnd(38)+"선택".padEnd(8)+"단가".padEnd(12)+"근거".padEnd(9)+"페널티 없으면");
console.log("-".repeat(92));
let ok3 = 0;
for (const [nm, box, paperId, qty, exp, without] of EST) {
  const r = pickSheet({ box, paperId, qty, front:{ color:true } });
  const hit = r.id === exp && !r.priceEstimated;
  if (hit) ok3++;
  console.log(nm.padEnd(38)+r.id.padEnd(8)+r.price.toLocaleString().padStart(9).padEnd(12)+
    (r.priceEstimated ? "⚠추정" : "실측").padEnd(9)+without+(hit?" ✓":` ✗ (기대 ${exp})`));
}
console.log("-".repeat(92));
console.log(`추정단가 페널티: ${ok3}/${EST.length}   (EST_PRICE_PENALTY=3%)`);
console.log("  ⚠ 이 두 줄이 페널티를 지키는 게이트다 — 페널티를 지우면 둘 다 추정 판형으로 넘어간다.");
if (ok3 !== EST.length) process.exitCode = 1;

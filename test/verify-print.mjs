// 인쇄비 로직 검증 — 별색 1도 = 3회 환산 / 원색·먹 = 1회
const SPOT_WEIGHT = 3;

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
  const flat  = (color ? 4 : 0) + (bk ? 1 : 0);
  const units = spot * SPOT_WEIGHT + flat;
  const q     = Math.ceil(pR * units);
  const amt   = Math.round(q * unit);
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
const doN   = (isColor, sp, bk) => (isColor?4:0) + sp + (bk?1:0);                 // 소부 도수
const units = (isColor, sp, bk) => sp*SPOT_WEIGHT + (isColor?4:0) + (bk?1:0);     // 인쇄 가중치
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
  const d = doN(c,sp,bk), u = units(c,sp,bk);
  const hit = d===expDo && u===expU;
  if (hit) cOk++;
  const label = [c?"원색4도":"", sp>0?`별색${sp}도`:"", bk?"먹1도":""].filter(Boolean).join("+");
  console.log(label.padEnd(26)+`${d} (기대 ${expDo})`.padEnd(12)+`${u} (기대 ${expU})`.padEnd(14)+
    `${Math.ceil(1*u)}`.padEnd(6)+(hit?"✓":"✗"));
}
console.log("-".repeat(72));
console.log(`원색+별색 병행: ${cOk}/${COMBO.length}`);

console.log("\n═══ B. 도수가 판형 선택을 바꾸지 않는지 ══════════════════════════════════");
// 종전 버그: 우선순위를 총비용에 **곱해서**(총비용 × (1+(priority−1)×0.01))
//   판형과 무관한 인쇄 도수까지 곱해지는 밑값에 들어가 순위가 뒤집혔다.
// 실측: 삼면접착 50×40×81 · AB라이트295 · 1,000ea
//   하4  6up 지대 70,375 (0.234R)  ← 지대 7,465원 저렴 + up 많음
//   4×64 4up 지대 77,840 (0.275R)
const PRIO = { "4x64":1, "ha4":4 };
const PU   = 14500;
const SHEETS = [   // [id, 지대R, 지대단가/R, up]
  ["4x64", 0.275, 283056, 4],
  ["ha4",  0.234, 300747, 6],
];
const procEst = u => 1 * (55000 + 50000 + u*PU);   // 1,000ea → 두 판형 다 1식, 티어 동일

const pickOld = u => {                              // 종전: 우선순위를 곱함
  let best = null;
  for (const [id,R,price] of SHEETS) {
    const rank = (R*price + procEst(u)) * (1 + (PRIO[id]-1)*0.01);
    if (!best || rank < best.rank) best = { id, rank };
  }
  return best.id;
};
const pickNew = u => {                              // 신: 1.5% 안이면 우선순위로 결정
  const pool = SHEETS.map(([id,R,price]) => ({ id, cost:R*price + procEst(u), prio:PRIO[id] }));
  const min  = Math.min(...pool.map(c => c.cost));
  const near = pool.filter(c => c.cost <= min*1.015);
  near.sort((a,b) => a.prio - b.prio || a.cost - b.cost);
  return near[0].id;
};
const LABEL = { 3:"별색1도", 4:"원색4도", 5:"원색4+먹", 10:"원색4+별색2", 11:"원색4+별색2+먹" };
console.log("인쇄 가중치".padEnd(24)+"종전(우선순위 곱셈)".padEnd(22)+"신(1.5% 동점 처리)");
console.log("-".repeat(72));
const oldPicks = new Set(), newPicks = new Set();
for (const u of [3,4,5,10,11]) {
  const o = pickOld(u), n = pickNew(u);
  oldPicks.add(o); newPicks.add(n);
  console.log(`${u} (${LABEL[u]})`.padEnd(24)+o.padEnd(22)+n);
}
console.log("-".repeat(72));
const stable = newPicks.size === 1;
console.log(`종전: 도수에 따라 ${oldPicks.size}종 판형으로 갈림  ${oldPicks.size>1?"✗":"✓"}`);
console.log(`신  : 도수와 무관하게 ${newPicks.size}종  ${stable?"✓ (원지·판걸이·R수 일관)":"✗"}`);
if (!stable) process.exitCode = 1;

console.log("");
console.log("═══ C. 하드롱 계열은 확실히 유리할 때만 ═══════════════════════════════════");
// 실무: "하드롱은 왠만하면 안 쓴다. 국절이나 46절이 너무 수율이 안 좋을 때만 쓴다."
// → 사륙·국전 최선안보다 6% 이상 저렴할 때만 하드롱 채택
const EDGE = 0.06;
const CASES2 = [
  // [이름, 하드롱 총비용, 사륙·국전 총비용, 기대 선택, 근거]
  ["조립형 324×428 · AB400 3,000ea", 935820, 1032310, "하드롱",
   "하3 지대 673,320 + 공정 262,500  vs  4×62 769,810 + 262,500 → 9.3% 우위 (견적서 = 하3)"],
  ["삼면 50×40×81 · 295L 1,000ea (별색1)", 218875, 226340, "사륙",
   "하4 지대 70,375  vs  4×64 77,840 → 3.3% 우위 (부족)"],
  ["삼면 50×40×81 (원색4+별색2)", 320375, 327840, "사륙",
   "도수가 커지면 우위가 2.3% 로 더 줄어듦"],
];
console.log("케이스".padEnd(34)+"하드롱".padEnd(11)+"사륙·국전".padEnd(11)+"우위".padEnd(8)+"선택".padEnd(9)+"기대");
console.log("-".repeat(96));
let ok2 = 0;
for (const [nm, h, m, exp] of CASES2) {
  const edge = (m - h) / m;
  const pick = h < m * (1 - EDGE) ? "하드롱" : "사륙";
  const hit = pick === exp;
  if (hit) ok2++;
  console.log(nm.padEnd(34)+h.toLocaleString().padStart(9).padEnd(11)+m.toLocaleString().padStart(9).padEnd(11)+
    ((edge*100).toFixed(1)+"%").padStart(6).padEnd(8)+pick.padEnd(9)+exp+(hit?" ✓":" ✗"));
}
console.log("-".repeat(96));
console.log("하드롱 채택 규칙: " + ok2 + "/" + CASES2.length);
for (const [nm,,,,why] of CASES2) console.log("  · " + nm + "\n      " + why);
console.log("");
console.log("⚠ 배수 페널티(총비용 × 1.12)로 구현하면 안 된다 —");
console.log("  총비용에 판형과 무관한 공정추정이 섞여 지대 우위가 희석돼");
console.log("  실제 견적서(하3)와 어긋난다. 명시적 우위 조건(6%)을 쓴다.");
if (ok2 !== CASES2.length) process.exitCode = 1;

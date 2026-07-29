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

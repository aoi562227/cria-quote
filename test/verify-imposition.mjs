// 실제 대지(임포지션) 대조 — 목형이 이대로 파진 도면
//
// 출처: 250423 삼면E 환패키지 디자인 PDF
//   mediabox = 545.0 × 394.0mm = **정확히 4×64절**
//   4×64 대지 위에 2up 으로 앉힌 실제 모습 (실제 목형도 이대로 파짐)

const D = {
  name: "삼면E 90×70×130 · 삼면접착 자동바닥",
  sheet: [545.0, 394.0],          // 대지 = 4×64절
  W: 90, D: 70, H: 130,
  up: 2,
  rotated: true,                   // netW 가 세로(394축), netH 가 가로(545축)
  // 측정값 (접는선 좌표 전수 추출)
  netW: 335.0,                     // 세로 방향 실측
  netH: 251.6,                     // 가로 방향 실측
  box1: [33.1, 284.7],             // x 범위
  box2: [263.9, 516.1],
  bodySpan: 334.3,                 // 몸통 구간의 세로 커버 = netW 와 일치
};

const overlap = +(D.box1[1] - D.box2[0]).toFixed(1);
const span    = +(D.box2[1] - D.box1[0]).toFixed(1);
const marginL = D.box1[0], marginR = +(D.sheet[0] - D.box2[1]).toFixed(1);

console.log("═══ 실제 대지 측정 ═══════════════════════════════════════════════════════");
console.log(`  대지          ${D.sheet[0]} × ${D.sheet[1]} mm  ← 4×64절 정확히 일치`);
console.log(`  박스          ${D.up}up · ${D.rotated ? "회전(netH 가 가로)" : "정방향"}`);
console.log(`  전개도 실측    ${D.netW} (세로) × ${D.netH} (가로)`);
console.log(`  박스1 x       ${D.box1[0]} ~ ${D.box1[1]}`);
console.log(`  박스2 x       ${D.box2[0]} ~ ${D.box2[1]}`);
console.log(`  ─────────────────────────────────────────`);
console.log(`  겹침(맞물림)   ${overlap} mm      = 2×${D.netH} − ${span}`);
console.log(`  전체 점유      ${span} mm`);
console.log(`  좌우 여백      ${marginL} / ${marginR} mm  → 물림 ≈ 30mm`);

// ── 공식 대조 ──────────────────────────────────────────────────────
const TAB = 14.3;
const netW_f = 2*(D.W + D.D) + TAB;
const lid_f  = D.D*0.88 + D.W*0.09 + 20.6;
const bot_f  = D.D*0.33 + D.W*0.15 + 11.0;
const netH_f = D.H + lid_f + bot_f;

console.log("\n═══ 현재 공식과 대조 ═════════════════════════════════════════════════════");
console.log("항목".padEnd(16)+"실측".padEnd(12)+"공식".padEnd(12)+"Δ");
console.log("-".repeat(56));
const rows = [
  ["전개도 가로(netW)", D.netW, netW_f],
  ["전개도 세로(netH)", D.netH, netH_f],
];
for (const [k,a,b] of rows)
  console.log(k.padEnd(16)+a.toFixed(1).padEnd(12)+b.toFixed(1).padEnd(12)+
    ((b-a>0?"+":"")+(b-a).toFixed(1)) + (Math.abs(b-a)<=2 ? "  ✓" : "  ⚠"));
console.log(`뚜껑 / 바닥      ─           ${lid_f.toFixed(1)} / ${bot_f.toFixed(1)}   (실측 분리 불가)`);

console.log(`
▶ netW 는 0.7mm 오차로 정확 (접착날개 14.3 확인)
▶ netH 는 공식이 ${(netH_f - D.netH).toFixed(1)}mm 크다 (−6%)

▶ 맞물림 ${overlap}mm 이 실측값. 현재 코드는 IL_H = 바닥날개(${bot_f.toFixed(0)}mm) 를 쓴다.
  견적서 up 재현(8/10)으로 역산한 값이라 실제 대지보다 후하다.
  ⚠ netH 공식 오차(+16mm)와 맞물림 과대(+27mm)가 서로 상쇄되어
    결과적으로 2up 은 맞게 나오지만, 두 값 모두 실측과 다르다.

  검산 — 실측값으로:  2 × ${D.netH} − ${overlap} = ${(2*D.netH-overlap).toFixed(1)} ≤ ${D.sheet[0]} − 60(물림 30×2) = ${D.sheet[0]-60}  ✓
        공식값으로:  2 × ${netH_f.toFixed(1)} − ${bot_f.toFixed(0)} = ${(2*netH_f-bot_f).toFixed(1)} ≤ ${D.sheet[0]-60}  ✓

▶ 실무 확인: 맞물림은 **바닥이 아니라 뚜껑쪽**으로 물리는 경우가 가장 많음.
  → 반전 방향을 뚜껑↔뚜껑 으로 두어야 하고, 맞물림 크기도 재검토 필요.
  대지 2~3건만 더 있으면 맞물림 공식을 확정할 수 있다.`);

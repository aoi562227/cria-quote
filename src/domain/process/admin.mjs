// ── 일반관리비 ────────────────────────────────────────────────────
// 100,000원 + 수량 × 5원, 1만원 단위 반올림, 최소 100,000
// 검증: 3,000→120,000 ✓ / 5,000→130,000 ✓ / 10,000→150,000 ✓
//       30,000→250,000 ✓ / 50,000→350,000 ✓   (실측 9건 중 7건 일치)
// ※ 코리팩가 재량으로 붙이는 항목이라 편차 있음 (같은 2,000ea에 100,000~200,000).
//   싸바리·G형처럼 공정이 많은 건은 실측이 더 높음 → 수동 입력으로 보정
export function calcAdmin(qty) {
  return Math.max(100000, Math.round((100000 + qty * 5) / 10000) * 10000);
}

export default {
  id: "admin",
  applies: () => true,
  lines: ctx => {
    const manual = ctx.ov?.admin;
    const amount = manual != null ? (manual || 100000) : calcAdmin(ctx.qty);
    return [{ id: "admin", name: "일반관리비",
              spec: manual != null ? "(직접입력)" : "자동",
              qty: "", unit: "", unitPrice: "", amount, fixed: true }];
  },
};

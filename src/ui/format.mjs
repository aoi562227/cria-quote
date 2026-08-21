// 표시 포맷 전용 — 도메인은 이 파일을 import 하지 않는다.

export const fmt = n => (typeof n === "number" && n >= 0) ? Math.round(n).toLocaleString() : (n || "-");

// fmtR: 부동소수점 반올림 버그 수정
// JS에서 0.575*100=57.4999... → Math.round=57 → "0.57" 표시 버그
// 수정: 미세 epsilon 추가로 0.575→"0.58" 올바르게 표시
export const fmtR = r => r ? (Math.round((r + 1e-10) * 100) / 100).toFixed(2) : "0.00";

// 견적서 수량 칸 표기: 정수는 그대로, 소수는 필요한 자리만 (실제 견적서 형식)
//   5000 → "5,000" / 2 → "2" / 1.134 → "1.134" / 8.4 → "8.4"
export const fmtQ = q => {
  if (typeof q !== "number") return q || "";
  if (Number.isInteger(q)) return q.toLocaleString();
  return String(Math.round((q + 1e-10) * 1000) / 1000);
};

export const fmtMM = n => n ? n.toFixed(1) : "-";

export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, "0")}월 ${String(d.getDate()).padStart(2, "0")}일`;
};

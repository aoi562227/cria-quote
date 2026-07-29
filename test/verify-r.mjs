// 실측 견적서 대조 검증 — App.jsx의 핵심 함수를 그대로 복제해서 검산
// (App.jsx는 JSX라 직접 import 불가 → 로직 상수/함수만 미러링)

const BASE_SHEETS = [
  { id:"46",   cut:1 }, { id:"4x62", cut:2 }, { id:"4x63", cut:3 }, { id:"4x64", cut:4 },
  { id:"guk",  cut:1 }, { id:"guk2", cut:2 },
  { id:"ha",   cut:1 }, { id:"ha2",  cut:2 }, { id:"ha3",  cut:3 }, { id:"ha4",  cut:4 },
  { id:"custom", cut:2 },
];
const sheetsPerR = sh => 500 * (sh?.cut || 2);

const LOSS_BASE=300, LOSS_NOPR=200, LOSS_RATE=0.05, LOSS_BOTHSIDES=100, LOSS_BEDA=100, LOSS_EMB=50;
function estimateLoss(net, o={}) {
  if (o.manual > 0) return Math.round(o.manual);
  const base = o.noPrint ? LOSS_NOPR : LOSS_BASE;
  let l = Math.max(base, Math.round(net*LOSS_RATE));
  if (o.bothSides) l += LOSS_BOTHSIDES;
  if (o.beda)      l += LOSS_BEDA;
  if (o.hasEmb) l += LOSS_EMB;
  return l;
}
function calcR(up, qty, sheet, o={}) {
  const net = Math.ceil(qty/up);
  const raw = (net + estimateLoss(net,o)) / sheetsPerR(sheet);
  return sheet.cut === 1 ? Math.ceil(raw*10)/10 : Math.ceil(raw*1000)/1000;
}
function calcProcessR(up, qty) {
  const net = Math.ceil(qty/up);
  return net < 1000 ? 1 : Math.ceil((net/1000)*10)/10;
}
const S = id => BASE_SHEETS.find(x=>x.id===id);

// ── 실측 케이스 ───────────────────────────────────────────────────
// [이름, 판형, up, 수량, 실측지대R, 실측공정R(코팅/톰슨), 옵션]
const CASES = [
  ["Q1  맞뚜껑150x20x150",   "4x62", 2,   500, 0.275, 1,   {}],
  ["Q2a 맞뚜껑A 1만",      "guk2", 6, 10000, 1.92,  1.7, {bothSides:false}],
  ["Q2b 맞뚜껑A 3만",      "guk2", 6, 30000, 5.3,   5.0, {}],
  ["Q2c 맞뚜껑A 5만",      "guk2", 6, 50000, 8.75,  8.4, {}],
  ["Q3  삼면A",          "ha4",  2,  1000, 0.4,   1,   {}],
  ["Q4a 삼면B 3천",        "46",   3,  3000, 2.6,   1.1, {}],
  ["Q4b 삼면B 5천",        "46",   3,  5000, 4.0,   1.8, {}],
  ["Q5  삼면C52x50x90",      "4x64", 4,  3000, 0.55,  1,   {hasEmb:true}],
  ["Q6  삼면D",        "4x64", 2,  1200, 0.45,  1,   {}],
  ["Q7  삼면E",            "4x64", 2,  1000, 0.4,   1,   {}],
  ["Q8  삼면F 3만",        "4x62", 2, 30000, 15.7,  15,  {}],
  ["Q9a 십자A 5천 (형압)",     "4x62", 6,  5000, 1.2,   1,   {hasEmb:true}],
  ["Q9b 십자A 1만 (형압)",     "4x62", 6, 10000, 2.05,  1.8, {hasEmb:true}],
  ["Q11a 십자B 양면",    "ha4",  4,  8000, 1.2,   2,   {bothSides:true}],
  ["Q11b 십자B 단면",    "ha4",  4,  8000, 1.15,  2,   {}],
  ["Q12 슬리브",              "4x64", 1,  1000, 0.65,  1,   {}],
  ["Q13 조립형 1종3천",     "ha3",  2,  3000, 1.2,   1.5, {}],
  ["Q14a 조립형 2종1만",    "ha3",  2, 10000, 3.534, 5.0, {}],
  ["Q14b 1500아트지 동봉물",  "guk2", 8, 10000, 1.55,  1.3, {}],
  ["Q15a 트레이A 1천",     "4x64", 1,  1000, 0.65,  1,   {}],
  ["Q15b 트레이A 2천",     "4x64", 1,  2000, 1.15,  2,   {}],
  ["Q16a 트레이B 500",     "4x64", 1,   500, 0.35,  1,   {noPrint:true}],
  ["Q16b 트레이B 1천",     "4x64", 1,  1000, 0.62,  1,   {noPrint:true}],
  ["Q17a G형B 500 양면",   "46",   1,   500, 1.8,   1,   {bothSides:true}],
  ["Q17b G형B 1천 양면",   "46",   1,  1000, 2.8,   1,   {bothSides:true}],
  ["Q20 G형A 2천 단면",    "46",   1,  2000, 4.6,   2,   {}],
  ["Q21 손잡이형",     "4x63", 1,  2000, 1.534, 2,   {}],
  ["E09 삼면C 5천",          "4x64", 4,  5000, 0.775, 1.3, {}],
  ["E10 2종A 4천(2종4up)",  "4x62", 4,  4000, 1.3,   1,   {}],
  ["E14-1 필렛 2천",          "4x62", 1,  2000, 2.3,   2,   {}],
  ["E14-2 필렛 1천 국2",      "guk2", 2,  1000, 0.8,   1,   {}],
  ["E20 주문생산B 1만",           "4x62", 4, 10000, 2.8,   2.5, {}],
  ["E53 스타킹 2천",          "4x64", 2,  2000, 0.65,  1,   {}],
  ["E59a 슬리브3종 4up",     "4x64", 4,  2000, 0.4,   1,   {}],
  ["E59c 슬리브3종 3up",     "4x64", 3,  2000, 0.5,   1,   {}],
  ["E64 삼면G 1천",      "4x64", 1,  1000, 0.65,  1,   {}],
  ["E67a G형C 2천",       "46",   1,  2000, 4.8,   2.1, {beda:true}],
  ["E67b G형C 3천",       "46",   1,  3000, 6.8,   3.1, {beda:true}],
  ["E16 주문생산A 4만",        "custom",4,40000, 10.8,  10,  {}],
];

let okR=0, okP=0, n=0;
const bad=[];
console.log("케이스".padEnd(26)+"판형   up    수량 │ 지대R 실측/계산  Δ  │ 공정R 실측/계산");
console.log("-".repeat(96));
for (const [name, sid, up, qty, realR, realP, opts] of CASES) {
  n++;
  const sh = S(sid);
  const R  = calcR(up, qty, sh, opts);
  const P  = calcProcessR(up, qty);
  const dR = +(R - realR).toFixed(3);
  const dP = +(P - realP).toFixed(2);
  const hitR = Math.abs(dR) <= 0.051;   // 0.05R 이내 = 실무 허용
  const hitP = Math.abs(dP) <= 0.101;
  if (hitR) okR++; else bad.push([name,'지대R',realR,R,dR]);
  if (hitP) okP++; else bad.push([name,'공정R',realP,P,dP]);
  console.log(
    name.padEnd(26) + sid.padEnd(7) + String(up).padStart(2) + String(qty).padStart(7) +
    ` │ ${String(realR).padStart(6)} ${String(R).padStart(6)} ${(dR>=0?'+':'')+dR}`.padEnd(24) +
    (hitR?'✓':'✗') +
    ` │ ${String(realP).padStart(4)} ${String(P).padStart(4)} ` + (hitP?'✓':'✗')
  );
}
console.log("-".repeat(96));
console.log(`지대R 일치: ${okR}/${n} (${Math.round(okR/n*100)}%)   공정R 일치: ${okP}/${n} (${Math.round(okP/n*100)}%)`);
if (bad.length) {
  console.log("\n[불일치]");
  for (const [nm,k,real,calc,d] of bad) console.log(`  ${nm}  ${k}: 실측 ${real} / 계산 ${calc}  (Δ ${d>=0?'+':''}${d})`);
}

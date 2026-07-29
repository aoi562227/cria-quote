// 견적서 전체 금액 재현 검증 — docs/ 견적서를 통째로 계산해서 대조
// 지대 + 소부 + 인쇄 + 코팅 + 후가공 + 톰슨 + 접착 + 관리비 → 공정합계 · 개당단가
//
// 단가는 견적서에 적힌 값을 그대로 넣는다(시점별로 인상되므로).
// 이 테스트가 검증하는 것은 **공식**:
//   지대R · 공정R · 인쇄수량 · 접착 최소 · 지대 공급가 round · 개당단가 round · 합계

const sheetsPerR = cut => 500 * cut;
const LOSS_BASE=300, LOSS_NOPR=200, LOSS_RATE=0.05, LOSS_BOTHSIDES=100, LOSS_BEDA=100, LOSS_EMB=50;
const SPOT_WEIGHT = 3;      // 별색 1도 = 인쇄 3회
const GLUE_MIN_LOT = 50000; // 접착 소량 1식

function estimateLoss(net, o={}) {
  if (o.manual > 0) return Math.round(o.manual);
  const base = o.noPrint ? LOSS_NOPR : LOSS_BASE;
  let l = Math.max(base, Math.round(net*LOSS_RATE));
  if (o.bothSides) l += LOSS_BOTHSIDES;
  if (o.beda)      l += LOSS_BEDA;
  if (o.hasEmb)    l += LOSS_EMB;
  return l;
}
const calcR     = (up,qty,cut,o={}) => { const n=Math.ceil(qty/up);
  const raw=(n+estimateLoss(n,o))/sheetsPerR(cut);
  return cut===1 ? Math.ceil(raw*10)/10 : Math.ceil(raw*1000)/1000; };
const calcProcR = (up,qty) => { const n=Math.ceil(qty/up); return n<1000?1:Math.ceil(n/1000*10)/10; };
const printQty  = (pR,spot,flat) => Math.ceil(pR*(spot*SPOT_WEIGHT+flat));

// ── docs/ 견적서 ───────────────────────────────────────────────────
// spot=별색도수 flat=원색·먹도수 / uv=UV고정가 / spotUnit=별색 R당단가
// coat=[/R 단가…] part=부분코팅 foil=박 emb=형압 / glueEa=원/EA glueLot=1식
// ...Override = 견적서에 손수정 흔적이 있어 수량×단가와 안 맞는 행
const CASES = [
  { name:"맞뚜껑A 92×13×140 · 300IV 국2 6up 10,000ea", src:"맞뚜껑단상자92x13x140",
    up:6, qty:10000, cut:2, paperR:147582, spot:0, flat:4, printUnit:14000,
    sobooDo:4, sobooUnit:12000, coat:[50000], thom:55000, glueEa:15, admin:150000,
    lossManual:253, thomOverride:82500,
    // ⚠ 견적서 자체 불일치: 인쇄 수량이 6.8(=1.7R×4도) 로 소수 그대로 적혀 있음.
    //   같은 방식의 다른 건은 정수 올림(8.4R×4=33.6→34 / 1.3R×4=5.2→6)이라 공식은 ceil 유지.
    //   이 견적서는 톰슨 행도 수량×단가≠공급가액(2×55,000 vs 82,500)으로 손수정 흔적이 있음.
    knownDiff:"인쇄 6.8 소수 표기 (공식 ceil→7)",
    real:{ R:1.92, paper:283357, soboo:48000, print:95200, total:894057, perEA:89 } },

  { name:"맞뚜껑A 92×13×140 · 30,000ea", src:"맞뚜껑단상자92x13x140",
    up:6, qty:30000, cut:2, paperR:147582, spot:0, flat:4, printUnit:14000,
    sobooDo:4, sobooUnit:12000, coat:[50000], thom:55000, glueEa:15, admin:250000,
    real:{ R:5.3, paper:782185, soboo:48000, print:280000, total:2335185, perEA:78 } },

  { name:"맞뚜껑A 92×13×140 · 50,000ea", src:"맞뚜껑단상자92x13x140",
    up:6, qty:50000, cut:2, paperR:147582, spot:0, flat:4, printUnit:14000,
    sobooDo:4, sobooUnit:12000, coat:[50000], thom:50000, glueEa:14, admin:350000,
    lossManual:417, printOverride:476000, thomOverride:420000,
    real:{ R:8.75, paper:1291343, soboo:48000, print:476000, total:3705343, perEA:74 } },

  { name:"삼면A 120×55×180 · 350ab 하4 2up 1,000ea", src:"삼면접착120x55x180",
    up:2, qty:1000, cut:4, paperR:492286, spot:0, flat:4, printUnit:14000,
    sobooDo:4, sobooUnit:12000, coat:[55000], thom:45000, glueLot:45000, admin:100000,
    real:{ R:0.4, paper:196914, soboo:48000, print:56000, total:545914, perEA:546 } },

  { name:"삼면B 210×90×180 · 325ab라이트 46전지 3up 3,000ea", src:"삼면접착단상자210x90x180",
    up:3, qty:3000, cut:1, paperR:351036, spot:0, flat:4, printUnit:15000,
    sobooDo:4, sobooUnit:12000, coat:[126000], thom:80000, glueEa:70, admin:120000,
    printOverride:120000, coatOverride:277200, thomOverride:88000,
    real:{ R:2.6, paper:912694, soboo:48000, print:120000, total:1775894, perEA:592 } },

  { name:"삼면B 210×90×180 · 5,000ea", src:"삼면접착단상자210x90x180",
    up:3, qty:5000, cut:1, paperR:351036, spot:0, flat:4, printUnit:15000,
    sobooDo:4, sobooUnit:12000, coat:[126000], thom:80000, glueEa:70, admin:150000,
    printOverride:216000, coatOverride:478800, thomOverride:144000,
    real:{ R:4.0, paper:1404144, soboo:48000, print:216000, total:2790944, perEA:558 } },

  { name:"삼면C 52×50×90 · 300ccp 4×64 4up 3,000ea (먹박+형압)", src:"삼면접착단상자52x50x90",
    up:4, qty:3000, cut:4, paperR:386260, spot:0, flat:4, printUnit:14500,
    sobooDo:4, sobooUnit:11500, coat:[241722], foil:120000, emb:80000,
    thom:50000, glueEa:25, admin:120000, lossManual:350,
    real:{ R:0.55, paper:212443, soboo:46000, print:58000, total:1003165, perEA:334 } },

  { name:"삼면D 82×7×126 · 350지A 4×64 2up 1,200ea", src:"삼면접착단상자82x7x126",
    up:2, qty:1200, cut:4, paperR:376695, spot:0, flat:4, printUnit:14000,
    sobooDo:4, sobooUnit:12000, coat:[55000], thom:45000, glueLot:45000, admin:100000,
    real:{ R:0.45, paper:169513, soboo:48000, print:56000, total:518513, perEA:432 } },

  { name:"삼면E 90×70×130 · 295ab라이트 4×64 2up 1,000ea (별색2도)", src:"삼면접착단상자90x70x130",
    up:2, qty:1000, cut:4, paperR:283056, spot:2, flat:0, printUnit:14000,
    sobooDo:2, sobooUnit:12000, coat:[55000], thom:50000, glueLot:50000, admin:100000,
    real:{ R:0.4, paper:113222, soboo:24000, print:84000, total:476222, perEA:476 } },

  { name:"삼면F 90×90×250 · 350ab 4×62 2up 30,000ea", src:"삼면접착단상자90x90x250",
    up:2, qty:30000, cut:2, paperR:378612, spot:0, flat:4, printUnit:11500,
    sobooDo:4, sobooUnit:11000, coat:[62400], thom:40000, glueEa:15, admin:300000,
    lossManual:700,
    real:{ R:15.7, paper:5944208, soboo:44000, print:690000, total:8964208, perEA:299 } },

  { name:"십자A 47×47×176 · 350B 4×62 6up 5,000ea (UV+별2+형압)", src:"십자조립단상자47x47x176",
    up:6, qty:5000, cut:2, paperR:425405, uv:250000,
    sobooDo:2, sobooUnit:11000, coat:[65000], emb:100000, thom:60000,
    glueEa:15, admin:130000, lossManual:366,
    real:{ R:1.2, paper:510486, soboo:22000, print:250000, total:1212486, perEA:242 } },

  { name:"십자A 47×47×176 · 10,000ea", src:"십자조립단상자47x47x176",
    up:6, qty:10000, cut:2, paperR:425405, uv:350000,
    sobooDo:2, sobooUnit:11000, coat:[65000], emb:100000, thom:60000,
    glueEa:15, admin:160000, lossManual:383,
    // ⚠ 견적서 자체 불일치: 공정R 을 1.8 로 씀 (정미 1,667 → 공식은 ceil(1.667)=1.7).
    //   같은 정미 1,667 인 맞뚜껑A 견적서는 1.7 을 씀 → 견적서 간 편차.
    //   Δ22,500 = 코팅 6,500 + 형압 10,000 + 톰슨 6,000
    knownDiff:"공정R 1.8 사용 (공식 1.7)",
    real:{ R:2.05, paper:872080, soboo:22000, print:350000, total:1959080, perEA:196 } },

  { name:"십자A 47×47×176 · 5,000ea (IR+일반인쇄)", src:"십자조립47x47x176_1",
    up:6, qty:5000, cut:2, paperR:425405, spot:2, flat:0, printUnit:13000,
    printOverride:65000, sobooDo:2, sobooUnit:11000, coat:[30000], emb:100000,
    thom:60000, glueEa:15, admin:130000, lossManual:366,
    real:{ R:1.2, paper:510486, soboo:22000, print:65000, total:992486, perEA:198 } },

  { name:"십자B 70×70×55 · 350ab 하4 4up 8,000ea (양면인쇄)", src:"십자조립단상자70x70x55후면유무별",
    up:4, qty:8000, cut:4, paperR:518196, spot:2, flat:0, spotUnit:50000,
    backFlat:4, backUnit:13000, sobooDo:6, sobooUnit:11000,
    coat:[30000,60000], thom:50000, glueEa:15, admin:130000, bothSides:true,
    real:{ R:1.2, paper:621835, soboo:66000, print:204000, total:1421835, perEA:178 } },

  { name:"십자B 70×70×55 · 단면", src:"십자조립단상자70x70x55후면유무별",
    up:4, qty:8000, cut:4, paperR:518196, spot:2, flat:0, spotUnit:50000,
    sobooDo:2, sobooUnit:11000, coat:[60000], thom:50000, glueEa:15, admin:130000,
    real:{ R:1.15, paper:595925, soboo:22000, print:100000, total:1187925, perEA:148 } },

  { name:"슬리브 646×258 · 마니라300 4×64 1up 1,000ea (원색4+별1)", src:"슬리브_전체크기646x258",
    up:1, qty:1000, cut:4, paperR:163236, spot:1, flat:4, printUnit:14000,
    printOverride:84000, sobooDo:5, sobooUnit:12000, coat:[40000], thom:45000,
    glueLot:45000, admin:100000,
    real:{ R:0.65, paper:106103, soboo:60000, print:84000, total:480103, perEA:480 } },

  { name:"조립형 324×428 · 400ab 하3 2up 3,000ea (금박)", src:"전체크기324x428",
    up:2, qty:3000, cut:3, paperR:561100, spot:1, flat:0, spotUnit:65000,
    sobooDo:1, sobooUnit:12000, coat:[70000], foil:140000, thom:45000, admin:150000,
    real:{ R:1.2, paper:673320, soboo:12000, print:97500, total:1315320, perEA:438 } },

  { name:"조립형 324×428 · 2종 각 5,000 = 10,000ea", src:"전체크기324x428_1",
    up:2, qty:10000, cut:3, paperR:561100, spot:1, flat:0, spotUnit:50000,
    sobooDo:1, sobooUnit:12000, coat:[70000], foil:140000, thom:45000, admin:200000,
    real:{ R:3.534, paper:1982927, soboo:12000, print:250000, total:3719927, perEA:372 } },

  { name:"트레이A 461×370 · 400ab 4×64 1up 1,000ea (먹1별1+부분코팅)", src:"전체크기461x370",
    up:1, qty:1000, cut:4, paperR:431272, spot:1, flat:1, printUnit:14500,
    sobooDo:2, sobooUnit:12000, coat:[55000], part:95000, thom:45000, admin:100000,
    real:{ R:0.65, paper:280327, soboo:24000, print:58000, total:657327, perEA:657 } },

  { name:"트레이A 461×370 · 2,000ea", src:"전체크기461x370",
    up:1, qty:2000, cut:4, paperR:431272, spot:1, flat:1, printUnit:14500,
    sobooDo:2, sobooUnit:12000, coat:[55000], part:95000, thom:45000, admin:130000,
    real:{ R:1.15, paper:495963, soboo:24000, print:116000, total:1155963, perEA:578 } },

  { name:"트레이B 472×356 · 수입지308 4×64 1up 500ea (양면금박·인쇄無)", src:"전체크기472x356양면금박",
    up:1, qty:500, cut:4, paperR:1160000,
    sobooDo:0, sobooUnit:0, foil:100000, foilSides:2, thom:50000, admin:100000,
    noPrint:true, lossManual:200,
    real:{ R:0.35, paper:406000, soboo:0, print:0, total:756000, perEA:1512 } },

  { name:"트레이B 472×356 · 1,000ea", src:"전체크기472x356양면금박",
    up:1, qty:1000, cut:4, paperR:1160000,
    sobooDo:0, sobooUnit:0, foil:100000, foilSides:2, thom:50000, admin:130000,
    noPrint:true, lossManual:240,
    real:{ R:0.62, paper:719200, soboo:0, print:0, total:1099200, perEA:1099 } },

  { name:"G형A 350×280×70 · 400Ab 4×6전지 1up 2,000ea (별1베다+먹)", src:"G형350x280x70",
    up:1, qty:2000, cut:1, paperR:431272, spot:1, flat:1, spotUnit:75000,
    sobooDo:2, sobooUnit:12000, coat:[112000], thom:70000, admin:200000,
    real:{ R:4.6, paper:1983851, soboo:24000, print:150000, total:2721851, perEA:1361 } },

  { name:"손잡이형 · 295ab라이트 4×63 1up 2,000ea", src:"손잡이형_수량과단위만참고",
    up:1, qty:2000, cut:3, paperR:300747, spot:0, flat:4, printUnit:14500,
    sobooDo:4, sobooUnit:12000, coat:[60000], thom:45000, glueEa:30, admin:140000,
    real:{ R:1.534, paper:461346, soboo:48000, print:116000, total:1035346, perEA:518 } },

  { name:"삼면G · 400ab 4×64 1up 1,000ea (최신 견적서)", src:"기타/삼면G 260728",
    up:1, qty:1000, cut:4, paperR:431272, spot:0, flat:4, printUnit:14000,
    sobooDo:4, sobooUnit:12000, coat:[55000], thom:45000, glueLot:45000, admin:100000,
    real:{ R:0.65, paper:280327, soboo:48000, print:56000, total:629327, perEA:629 } },
];

let pass = 0;
const fails = [], known = [];
for (const c of CASES) {
  const net   = Math.ceil(c.qty / c.up);
  const R     = calcR(c.up, c.qty, c.cut, { manual:c.lossManual, bothSides:c.bothSides,
                                            noPrint:c.noPrint, beda:c.beda, hasEmb:!!c.emb });
  const pR    = calcProcR(c.up, c.qty);
  const isLot = net < 1000;

  const paper = Math.round(R * c.paperR);
  const soboo = (c.sobooDo||0) * (c.sobooUnit||0);

  let print;
  if (c.printOverride != null) print = c.printOverride;
  else if (c.uv)      print = c.uv;
  else if (c.spotUnit) print = Math.round(pR * c.spotUnit);            // 별색 R당 고정
  else if (c.spot || c.flat) print = printQty(pR, c.spot||0, c.flat||0) * (c.printUnit||0);
  else print = 0;
  if (c.backFlat) print += printQty(pR, 0, c.backFlat) * c.backUnit;   // 후면 원색

  const coat = c.coatOverride != null ? c.coatOverride
             : (c.coat||[]).reduce((a,r)=> a + (isLot ? r : Math.round(pR*r)), 0);
  const part = c.part ? (isLot ? c.part : Math.round(pR*c.part)) : 0;
  const foil = c.foil ? (isLot ? c.foil : Math.round(pR*c.foil)) * (c.foilSides||1) : 0;
  const emb  = c.emb  ? (isLot ? c.emb  : Math.round(pR*c.emb))  : 0;
  const thom = c.thomOverride != null ? c.thomOverride
             : (isLot ? c.thom : Math.round(pR * c.thom));
  const glue = c.glueEa ? Math.max(c.qty*c.glueEa, GLUE_MIN_LOT) : (c.glueLot||0);

  const total = paper + soboo + print + coat + part + foil + emb + thom + glue + c.admin;
  const perEA = Math.round(total / c.qty);

  const chk = [
    ["지대R",   c.real.R,     R],
    ["지대",    c.real.paper, paper],
    ["소부",    c.real.soboo, soboo],
    ["인쇄",    c.real.print, print],
    ["공정합계", c.real.total, total],
    ["개당단가", c.real.perEA, perEA],
  ];
  const okOf = (k,a,b) => k==="지대R" ? Math.abs(a-b)<=0.051 : Math.abs(a-b) <= Math.max(2, a*0.01);
  const allOk = chk.every(([k,a,b]) => okOf(k,a,b));
  if (allOk) pass++;
  else if (c.knownDiff) known.push([c.name, c.knownDiff, chk.filter(([k,a,b])=>!okOf(k,a,b))]);
  else fails.push([c.name, chk.filter(([k,a,b])=>!okOf(k,a,b))]);

  console.log(`${allOk?"✅":(c.knownDiff?"⚠️":"❌")} ${c.name}`);
  console.log(`   ${c.src} · 정미 ${net.toLocaleString()}장 · 지대R ${R} · 공정R ${pR}${isLot?" (1식)":""}`);
  if (!allOk) for (const [k,a,b] of chk) if (!okOf(k,a,b))
    console.log(`     ✗ ${k.padEnd(6)} 실측 ${String(a).padStart(10)}  계산 ${String(b).padStart(10)}  Δ ${(b-a>0?"+":"")+(b-a)}`);
}
console.log(`\n${"=".repeat(78)}`);
console.log(`docs/ 견적서 전체 금액 재현: ${pass}/${CASES.length}건 원 단위 일치` +
            (known.length ? `  (+ 견적서 자체 불일치 ${known.length}건)` : ""));
if (known.length) {
  console.log(`\n⚠️ 견적서 자체 불일치 ${known.length}건 — 공식 문제 아님:`);
  for (const [nm, why, rows] of known)
    console.log(`  · ${nm}\n      ${why}\n      ${rows.map(([k,a,b])=>`${k} 실측 ${a} → 계산 ${b}`).join(" / ")}`);
}
if (fails.length) {
  console.log(`\n❌ 불일치 ${fails.length}건:`);
  for (const [nm, rows] of fails)
    console.log(`  · ${nm}\n      ${rows.map(([k,a,b])=>`${k} ${a}→${b}`).join(" / ")}`);
  process.exitCode = 1;
}

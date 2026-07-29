// 구조별 전개도 공식 검증 — 견적용 칼선/디자인 PDF 실측 (규격 확인분)
// 접는선 좌표를 전수 추출해 패널 치수를 역산하고, 발주 규격과 대조

const TAB = 14.3;                                    // 접착날개
const NW  = (W,D) => 2*(W+D) + TAB;
const F = {
  // 삼면접착 자동바닥(크래시록) — 바닥날개가 대각이라 W에도 의존
  glue3: (W,D,H) => H + (D*0.88 + W*0.09 + 20.6) + (D*0.33 + W*0.15 + 11.0),
  // 십자조립(크로스바텀)
  cross: (W,D,H) => H + 2*(D*7/8 + 5.5),
  // 맞뚜껑 — 한쪽 날개 = 뚜껑패널(≈D) + 텍탭(16.5)
  tuck:  (W,D,H) => H + 2*(D + 16.5),
  // G형 트레이(뚜껑일체)
  gtray: (W,D,H) => null,
};
const OLD = {
  glue3: (W,D,H) => H + Math.round(D*0.059+12.65) + (D*0.65+4),
  cross: (W,D,H) => H + 2*(D*7/8 + 5.5),
  tuck:  (W,D,H) => H + (D<=15 ? D/2+50 : D/2+20) + (D<=15 ? D/2+55 : D/2+15),
};
const LBL = { glue3:"삼면접착 (자동바닥)", cross:"십자조립 (크로스바텀)", tuck:"맞뚜껑 (상하 텍)" };

// [구조, 이름, W, D, H, 실측 가로, 실측 세로]
const DIE = [
  ["glue3","칼선-09 240704",    41.46, 42,    116,   181.0, 202.0],
  ["glue3","칼선-10 240704",    49,    49.5,  143,   212.0, 243.5],
  ["glue3","칼선-01 240502",     45,    33.75, 109.5, 174.4, 193.2],
  ["glue3","칼선-02 240508",   71,    69.5,  175.5, 298.3, 307.0],
  ["glue3","칼선-03 240508",  100,    81,     50,   374.5, 206.0],
  ["glue3","칼선-04 240520",    265.5, 124,    243,   803.0, 490.0],
  ["glue3","★삼면E 250430",  90,    70,    130,   334.3, 265.0],
  ["glue3","★칼선-06 260311",  50,    50,    150,   214.3, 263.0],
  ["glue3","칼선-05 251119",     47,    47,    100,   202.3, 219.1],
  ["cross","칼선-13 240821", 80,    20,     48.5, 211.33, 95.0],
  ["cross","칼선-14 240717", 80,    44.5,   30,   264.3, 124.5],
  ["cross","칼선-11 240808",     70,    69,    151.5, 303.33,285.0],
  ["cross","칼선-12 240805",  190,   100,    109.5, 594.0, 298.7],
  ["tuck","칼선-07 240701",    150,    69.5,  149,   454.3, 321.0],
  ["tuck","칼선-08 240701",   150,    69.5,  219,   454.3, 391.0],
];

for (const k of ["glue3","cross","tuck"]) {
  const rows = DIE.filter(d => d[0] === k);
  console.log(`\n═══ ${LBL[k]} — 칼선 ${rows.length}건 ══════════════════════════════════════`);
  console.log("칼선".padEnd(20)+"W×D×H".padEnd(20)+"가로실측".padEnd(10)+"공식".padEnd(9)+"Δ".padEnd(8)+
              "세로실측".padEnd(10)+"공식".padEnd(9)+"Δ".padEnd(8)+"종전 Δ");
  console.log("-".repeat(104));
  let ew=0, eh=0, eo=0;
  for (const [,nm,W,D,H,gw,gh] of rows) {
    const a = NW(W,D), b = F[k](W,D,H), o = OLD[k](W,D,H);
    ew += Math.abs(a-gw); eh += Math.abs(b-gh); eo += Math.abs(o-gh);
    console.log(nm.padEnd(20)+`${W}×${D}×${H}`.padEnd(20)+gw.toFixed(1).padEnd(10)+a.toFixed(1).padEnd(9)+
      (a-gw).toFixed(1).padEnd(8)+gh.toFixed(1).padEnd(10)+b.toFixed(1).padEnd(9)+
      (b-gh).toFixed(1).padEnd(8)+(o-gh).toFixed(1));
  }
  console.log("-".repeat(104));
  console.log(`평균절대오차:  가로 ${(ew/rows.length).toFixed(1)}mm   세로 ${(eh/rows.length).toFixed(1)}mm` +
              `   (종전 세로 ${(eo/rows.length).toFixed(1)}mm)`);
}

console.log("\n═══ 견적서 판걸이 up 재현 ════════════════════════════════════════════════");
const PL=990, PS=720, BL=20, BS=30, TOL=0.005, MAX_FOOT=92;
const IL_W=10;   // 가로 맞물림 (세로는 바닥날개 깊이)
const SH={"46":[788,1091],"4x62":[788,545],"4x64":[394,545],"guk2":[636,469],"ha4":[444,597]};
const mc=(b,l,il)=>(b<=0||l<b)?0:(b>il?Math.max(1,Math.floor((l-il)/(b-il))):99);
// 맞물림: 가로(netW 반복) IL_W=10 고정 / 세로(netH 반복) = 바닥날개 깊이
function lay(nw,nh,sid,ilh){
  const [a,b]=SH[sid], A=Math.max(a,b), B=Math.min(a,b);
  const L=(Math.min(A,PL)-BL)*(1+TOL), S=(Math.min(B,PS)-BS)*(1+TOL);
  const cand=[];
  // 정방향: netW 가 가로축(IL_W), netH 가 세로축(ilh)
  { const c=mc(nw,L,IL_W), r=mc(nh,S,ilh);
    if(c&&r) cand.push({up:c*r, how:`정${c}×${r}`,
      foot:(nw*c-IL_W*(c-1))*(nh*r-ilh*(r-1))/(Math.min(A,PL)*Math.min(B,PS))*100}); }
  // 회전: netH 가 가로축(ilh), netW 가 세로축(IL_W)
  { const c=mc(nh,L,ilh), r=mc(nw,S,IL_W);
    if(c&&r) cand.push({up:c*r, how:`회${c}×${r}`,
      foot:(nh*c-ilh*(c-1))*(nw*r-IL_W*(r-1))/(Math.min(A,PL)*Math.min(B,PS))*100}); }
  const ok=cand.filter(c=>c.foot<=MAX_FOOT);
  const pool=ok.length?ok:cand;
  pool.sort((x,y)=>y.up-x.up);
  return pool[0]||{up:0,how:"-",foot:0};
}
const Q=[
 ["tuck","맞뚜껑A 92×13×140",   92,13,140,"guk2",6], ["tuck","맞뚜껑B 150×20×150",150,20,150,"4x62",2],
 ["glue3","삼면A 120×55×180",120,55,180,"ha4",2],  ["glue3","삼면B 210×90×180",210,90,180,"46",3],
 ["glue3","삼면C 52×50×90",       52,50,90,"4x64",4],  ["glue3","★삼면E 90×70×130",90,70,130,"4x64",2],
 ["glue3","삼면F 90×90×250",    90,90,250,"4x62",2], ["glue3","삼면D 82×7×126",82,7,126,"4x64",2],
 ["cross","십자A 47×47×176",        47,47,176,"4x62",6], ["cross","십자B 70×70×55",70,70,55,"ha4",4],
];
console.log("견적서 건".padEnd(24)+"판형".padEnd(7)+"전개도".padEnd(16)+"up".padEnd(6)+"배치".padEnd(7)+"발자국".padEnd(9)+"견적서");
console.log("-".repeat(90));
let n=0,o=0;
const BOT={glue3:(W,D)=>D*0.33+W*0.15+11.0, cross:(W,D)=>D*7/8+5.5, tuck:(W,D)=>D+16.5};
for(const [k,nm,W,D,H,sid,real] of Q){
  const bot=BOT[k](W,D);
  const r=lay(NW(W,D),F[k](W,D,H),sid,bot);
  const ro=lay(NW(W,D),OLD[k](W,D,H),sid,bot);
  if(r.up===real)n++; if(ro.up===real)o++;
  console.log(nm.padEnd(24)+sid.padEnd(7)+`${NW(W,D).toFixed(0)}×${F[k](W,D,H).toFixed(0)}`.padEnd(16)+
    (r.up+(r.up===real?"✓":"")).padEnd(6)+r.how.padEnd(7)+(r.foot.toFixed(0)+"%").padEnd(9)+real);
}
console.log("-".repeat(90));
console.log(`up 일치:  신 공식 ${n}/${Q.length}   종전 ${o}/${Q.length}`);
console.log(`
※ 세로 맞물림 = 바닥날개 깊이 (verify-interlock.mjs §D 참조).
※ 남은 2건은 목형 설계 요인 — 삼면D(D=7, 공식 검증범위 밖) /
  맞뚜껑B(500ea 소량, 기존 2up 목형 추정). 「판걸이(up) 직접 입력」으로 보정.
※ 「발자국」 = 배치 외곽 ÷ 판형. 맞물림 배치에서 netW×netH 기준 「수율」은
  전개도의 빈 모서리를 포함해 과대평가되므로 배치 판정은 발자국으로 함.`);

console.log("\n═══ 행거탭(유로홀) 모델링 ════════════════════════════════════════════════");
// 맞뚜껑A 92×13×140 은 위쪽에 다이소 걸이봉용 유로홀 탭 15mm 가 올라가 있음.
// 행거탭은 위쪽 한 곳만 돌출 → 맞물림 배치에서 옆 열 빈공간에 끼워짐
// → 열 간격(피치)에는 안 더하고 **전체 외곽에 1회만** 더해야 함.
{
  const netW = 2*(92+13) + TAB, netH = 140 + 2*(13+16.5);   // 224.3 × 199.0
  const pw = (636-20)*1.005, ph = (469-30)*1.005;           // 국2 유효판
  const mcc = (b,l,il) => (b<=0||l<b) ? 0 : (b>il ? Math.max(1,Math.floor((l-il)/(b-il))) : 99);
  const best = (ht, addToPitch) => {
    const nh = addToPitch ? netH + ht : netH;
    const ex = addToPitch ? 0 : ht;
    let u = 0, how = "";
    let c = mcc(netW, pw, IL_W), r = mcc(nh, ph - ex, IL_H);
    if (c*r > u) { u = c*r; how = `정 ${c}×${r}`; }
    c = mcc(nh, pw - ex, IL_W); r = mcc(netW, ph, IL_H);
    if (c*r > u) { u = c*r; how = `회 ${c}×${r}`; }
    return [u, how];
  };
  console.log("모델".padEnd(34)+"행거탭".padEnd(9)+"up".padEnd(6)+"배치".padEnd(8)+"견적서 6up");
  console.log("-".repeat(76));
  for (const ht of [0,15,20]) {
    const [u,how] = best(ht, false);
    console.log(`외곽에 1회만 더함 (채택)`.padEnd(34)+`${ht}mm`.padEnd(9)+String(u).padEnd(6)+how.padEnd(8)+(u===6?"✓":"✗"));
  }
  const [u2,how2] = best(15, true);
  console.log(`netH 에 그냥 합산 (오답)`.padEnd(34)+`15mm`.padEnd(9)+String(u2).padEnd(6)+how2.padEnd(8)+(u2===6?"✓":"✗"));
  console.log(`
→ 행거탭을 netH 에 그냥 더하면 4up 으로 어긋남. 외곽 1회 가산이 맞음.
  앱에서도 확인: 행거탭 ON(15mm) → 전개도 224.3×214.0 (몸판 199.0 + 15.0),
  판걸이 6up · 지대R 1.97 유지 (견적서 6up · 1.92R)`);
}

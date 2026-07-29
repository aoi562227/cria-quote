// 맞물림 판걸이 모델 검증 — 코리팩 산출식 엑셀 대조
// 출처: 「패키지 단가 산출식_엑셀_SB01_B형 맞뚜껑_190916_07.xlsx」
//        시트 '가격산출 조건표_SB01_B형 맞뚜껑'  D389:D396

const IL_W = 10, IL_H = 25;
const spanW = (b,n) => b*n - IL_W*(n-1);
const spanH = (b,n) => b*n - IL_H*(n-1);

console.log("═══ A. 엑셀 수식 자체 재검산 (B형 맞뚜껑 180×60×190) ══════════════════════");
const W=180, D=60, H=190;
const baseW = (W+D)*2+35;      // D389
const baseH = (D*2+H)+50;      // D393
const EXP = { baseW:515, w2:1020, w3:1525, w4:2030, baseH:360, h2:695, h3:1030, h4:1365 };
const got = { baseW, w2:spanW(baseW,2), w3:spanW(baseW,3), w4:spanW(baseW,4),
              baseH, h2:spanH(baseH,2), h3:spanH(baseH,3), h4:spanH(baseH,4) };
let ok=0;
const LABEL = { baseW:"가로 1열 (가로+세로)*2+35", w2:"가로 2열 [ ]*2−10", w3:"가로 3열 [ ]*3−20",
                w4:"가로 4열 [ ]*4−30", baseH:"세로 1열 (세로*2+높이)+50", h2:"세로 2열 [ ]*2−25",
                h3:"세로 3열 [ ]*3−50", h4:"세로 4열 [ ]*4−75" };
for (const k of Object.keys(EXP)) {
  const hit = got[k] === EXP[k]; if (hit) ok++;
  console.log(`  ${hit?"✓":"✗"} ${LABEL[k].padEnd(30)} 엑셀 ${String(EXP[k]).padStart(5)}   계산 ${String(got[k]).padStart(5)}`);
}
console.log(`  → ${ok}/8 일치`);

console.log("\n═══ B. 물림 = 엑셀 「제작 규격(여분제외)」 ════════════════════════════════");
// 엑셀 B14(종이 규격) → B15(제작 규격)
const PAPER = [
  ["4X6(사륙전지)", [788,1091], [758,1071]],
  ["7X5(사륙이절)", [545,788],  [515,768]],
  ["사륙사절",      [394,545],  [364,525]],
  ["국전",          [636,939],  [606,919]],
  ["국이절",        [469,636],  [436,616]],
  ["하드롱사절",    [450,600],  [420,580]],
];
console.log("판형".padEnd(16)+"종이 규격".padEnd(12)+"제작 규격".padEnd(12)+"물림(짧은변/긴변)");
for (const [nm,[rw,rh],[mw,mh]] of PAPER)
  console.log(nm.padEnd(16)+`${rw}×${rh}`.padEnd(12)+`${mw}×${mh}`.padEnd(12)+`−${rw-mw} / −${rh-mh}`);
console.log("→ 짧은변 −30mm, 긴변 −20mm (국이절만 −33). 코드의 균일 20mm 보다 정확한 값.");

console.log("\n═══ C. 실측 견적서 up — 기하학으로 확정 안 됨 ════════════════════════════");
const MAKE = { "guk2":[436,616], "4x62":[515,768], "4x64":[364,525], "ha4":[420,580] };
function bestUp(bW,bH,sid){
  const [a,b]=MAKE[sid]; let best={up:0};
  for (const [X,Y] of [[a,b],[b,a]])
    for (let n=1;n<=8;n++){ if (spanW(bW,n)>X) break;
      for (let m=1;m<=8;m++){ if (spanH(bH,m)>Y) break;
        if (n*m>best.up) best={up:n*m,n,m}; } }
  return best;
}
const CASES = [
  ["맞뚜껑A 92×13×140",  92,13,140,"guk2",6],
  ["맞뚜껑B 150×20×150",  150,20,150,"4x62",2],
];
console.log("케이스".padEnd(24)+"baseW×baseH".padEnd(13)+"판형   최대배치   계산up  견적서");
for (const [nm,W,D,H,sid,real] of CASES) {
  const bW=(W+D)*2+35, bH=(D*2+H)+50, r=bestUp(bW,bH,sid);
  console.log(nm.padEnd(24)+`${bW}×${bH}`.padEnd(13)+sid.padEnd(7)+
    `${r.n}×${r.m}`.padEnd(11)+String(r.up).padStart(5)+String(real).padStart(8)+
    (r.up===real?" ✓":`  ✗ (${r.up>real?"계산이 큼":"계산이 작음"})`));
}
console.log(`
※ 엑셀 공식은 자체 예시 8/8 완벽 재현되지만, 실제 견적서 up과는 양방향으로 어긋남.
  → up은 기하학 최대치가 아니라 **실제 목형 설계 결과**. 자동계산은 "최대 가능치"이고,
    발주서·기존 목형의 up을 알면 「판걸이(up) 직접 입력」을 쓰는 게 정확함.

※ 엑셀 파일은 SB01(B형 맞뚜껑) 1종만 확보됨. 십자조립·삼면접착·G형의
  base 공식(가로 +35 / 세로 +50 자리의 상수)은 각 구조별 산출식 파일이 있어야 확정 가능.`);

console.log("\n═══ D. 세로 맞물림(IL_H) 일반화 — 견적서 10건 역산 ════════════════════════");
// 엑셀의 IL_H = 25mm 는 B형 맞뚜껑(D=60, 바닥날개 ≈ 30) 한 케이스 값.
// 구조·치수에 따라 크게 달라지므로 견적서 up 으로 역산.
const NWa=(W,D)=>2*(W+D)+14.3;
const LIDa={glue3:(W,D)=>D*0.88+W*0.09+20.6, cross:(W,D)=>D*7/8+5.5, tuck:(W,D)=>D+16.5};
const BOTa={glue3:(W,D)=>D*0.33+W*0.15+11.0, cross:(W,D)=>D*7/8+5.5, tuck:(W,D)=>D+16.5};
const NHa=(k,W,D,H)=>H+LIDa[k](W,D)+BOTa[k](W,D);
const SHa={"46":[788,1091],"4x62":[788,545],"4x64":[394,545],"guk2":[636,469],"ha4":[444,597]};
const mca=(b,l,il)=>(b<=0||l<b)?0:(b>il?Math.max(1,Math.floor((l-il)/(b-il))):99);
function upa(k,W,D,H,sid,ilw,ilh){
  const nw=NWa(W,D), nh=NHa(k,W,D,H);
  const [a,b]=SHa[sid], A=Math.min(Math.max(a,b),990), B=Math.min(Math.min(a,b),720);
  const L=(A-20)*1.005, S=(B-30)*1.005;
  let best=0,how="";
  { const c=mca(nw,L,ilw), r=mca(nh,S,ilh); if(c*r>best){best=c*r;how=`정 ${c}×${r}`;} }
  { const c=mca(nh,L,ilh), r=mca(nw,S,ilw); if(c*r>best){best=c*r;how=`회 ${c}×${r}`;} }
  return [best,how];
}
const Qa=[
 ["glue3","삼면A 120×55×180",120,55,180,"ha4",2], ["glue3","삼면B 210×90×180",210,90,180,"46",3],
 ["glue3","삼면C 52×50×90",52,50,90,"4x64",4],        ["glue3","★삼면E 90×70×130",90,70,130,"4x64",2],
 ["glue3","삼면F 90×90×250",90,90,250,"4x62",2],    ["glue3","삼면D 82×7×126",82,7,126,"4x64",2],
 ["cross","십자A 47×47×176",47,47,176,"4x62",6],        ["cross","십자B 70×70×55",70,70,55,"ha4",4],
 ["tuck","맞뚜껑A 92×13×140",92,13,140,"guk2",6],   ["tuck","맞뚜껑B 150×20×150",150,20,150,"4x62",2],
];
console.log("건".padEnd(24)+"바닥날개".padEnd(10)+"IL_H=25 고정".padEnd(14)+"IL_H=바닥날개".padEnd(16)+"견적서");
console.log("-".repeat(80));
let f=0, v=0;
for(const [k,nm,W,D,H,sid,real] of Qa){
  const bot=BOTa[k](W,D);
  const [u1]=upa(k,W,D,H,sid,10,25);
  const [u2,how2]=upa(k,W,D,H,sid,10,bot);
  if(u1===real)f++; if(u2===real)v++;
  console.log(nm.padEnd(24)+bot.toFixed(0).padStart(4).padEnd(10)+
    (u1+(u1===real?" ✓":"  ")).padEnd(14)+(u2+(u2===real?" ✓":"  ")+" "+how2).padEnd(16)+real);
}
console.log("-".repeat(80));
console.log(`up 일치:  IL_H 고정 25mm → ${f}/10   IL_H = 바닥날개 → ${v}/10`);
console.log(`
→ 세로 맞물림은 **바닥날개 깊이만큼** 물린다. (머리-꼬리로 뒤집어 앉힐 때
  한쪽의 뚜껑 혀가 다른 쪽 바닥날개 사이 빈 공간으로 파고드는 깊이)
  바닥날개가 없는 구조(G형 트레이·전개도 직접입력)는 엑셀 기본값 25mm 사용.

남은 2건:
  삼면D 82×7×126 — D=7 로 칼선 검증범위(D 33.75~124) 밖, 전개도 과대추정
  맞뚜껑B 150×20×150 — 어떤 IL 값으로도 2up 안 나옴(기하학상 4up 가능).
                        500ea 소량이라 기존 2up 목형을 쓴 것으로 추정`);

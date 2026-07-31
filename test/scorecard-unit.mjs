// 견적서가 알려주는 「단위(재단크기)」를 그대로 판으로 주고 up 이 맞는지 본다.
// 판형 선택 변수를 제거한 순수 배치 정확도 측정.
import { solveLayout } from "../src/nest.mjs";
function getFlaps(W,D,H,t){const dust=0.43*D+7;
  if(t==="tuck"){const L=Math.round(0.03*D+10.6);return{type:"tuck",topLid:L,dust,botLid:L,botDust:dust};}
  if(t==="cross")return{type:"cross",topLid:0.08*D+9,dust,botLong:0.7*D,botShort:0.4*D+6};
  return{type:"glue3",topLid:0.88*D+0.09*W+20.6,dust:D/2-1,botLong:0.33*D+0.15*W+11.0,botShort:D/2};}
function calcNet(W,D,H,t){const netW=2*(W+D)+14.3;let tl,bf;
  if(t==="tuck"){tl=D+16.5;bf=D+16.5;}else if(t==="cross"){tl=D*7/8+5.5;bf=D*7/8+5.5;}
  else{tl=0.88*D+0.09*W+20.6;bf=0.33*D+0.15*W+11.0;}
  return{netW,netH:H+tl+bf,topLid:tl,botFloor:bf};}
function pieces(W,D,H,t){const ns=calcNet(W,D,H,t),f=getFlaps(W,D,H,t);
  const y0=ns.topLid,y1=ns.topLid+H,xE=[0,D,D+W,2*D+W,2*D+2*W,ns.netW];
  const tH=[f.dust,f.topLid,f.dust,0];
  const bH=f.type==="tuck"?[f.botDust,0,f.botDust,f.botLid]:[f.botShort,f.botLong,f.botShort,f.botLong];
  const big=Math.max(ns.topLid,ns.botFloor,1);
  const ch=(h,w)=>h<=0?0:(h>=big*0.6?Math.min(2.5,w*0.06,h*0.3):Math.min(w*0.22,h*0.45,10));
  const out=[];
  for(let i=0;i<5;i++){const a=xE[i],b=xE[i+1],pw=b-a;if(pw<=0)continue;
    if(i===4){const tc=Math.min(pw*0.55,H*0.12,8);out.push([[a,y0],[b,y0+tc],[b,y1-tc],[a,y1]]);continue;}
    out.push([[a,y0],[b,y0],[b,y1],[a,y1]]);
    if(tH[i]>0){const c=ch(tH[i],pw),y=y0-tH[i];out.push([[a,y0],[a+c,y],[b-c,y],[b,y0]]);}
    if(bH[i]>0){const c=ch(bH[i],pw),y=y1+bH[i];out.push([[a,y1],[a+c,y],[b-c,y],[b,y1]]);}}
  return{pieces:out,net:ns};}
// [이름, W,D,H, 구조, 견적서 단위(재단크기), 견적서 up]
const C=[
 ["맞뚜껑A 92×13×140",     92,13,140,"tuck", [636,469],6],
 ["맞뚜껑B 150×20×150",   150,20,150,"tuck", [760,480],2],
 ["십자A 47×47×176",       47,47,176,"cross",[788,545],6],
 ["십자B 70×70×55",        70,70,55, "cross",[444,597],4],
 ["삼면A 120×55×180",     120,55,180,"glue3",[597,444],2],
 ["삼면B 210×90×180",     210,90,180,"glue3",[980,720],3],
 ["삼면C 52×50×90",        52,50,90, "glue3",[394,545],4],
 ["삼면D 82×7×126",        82,7,126, "glue3",[545,394],2],
 ["삼면E 90×70×130",       90,70,130,"glue3",[545,394],2],
 ["삼면F 90×90×250",       90,90,250,"glue3",[760,480],2],
 ["탈취제A 75×37.5×186",   75,37.5,186,"glue3",[788,545],4],
 ["LUXEN 130×130×55",    130,130,55,"glue3",[480,788],2],
];
// 맞물림 허용 여부를 바꿔가며 — 실무에서 맞물림이 기본인지 예외인지 판정
for (const [label,gL,gS,noIL] of [
  ["A. 물림없음 · 맞물림 허용",0,0,false],
  ["B. 물림없음 · 맞물림 금지(칼선공유만)",0,0,true],
  ["C. 물림적용 · 맞물림 허용",20,30,false],
]) {
  console.log(`\n═══ ${label} ═══════════════════════════════════════════`);
  console.log("케이스".padEnd(24)+"단위".padEnd(12)+"전개도".padEnd(15)+"견적 NFP  판정   배치");
  console.log("─".repeat(94));
  let hit=0;
  for(const [nm,W,D,H,t,cut,up] of C){
    const {pieces:P,net}=pieces(W,D,H,t);
    const A=Math.max(...cut)-gL, B=Math.min(...cut)-gS;
    const r=solveLayout(P,A,B,{clearance:0.5,noInterlock:noIL});
    const got=r?r.up:0;
    if(got===up)hit++;
    const how=r?`${r.cols}×${r.rows}${r.rotated?" 회전":""}${r.interlocked?` 물림x${r.overlapX.toFixed(0)}y${r.overlapY.toFixed(0)}`:" 칼선공유"}`:"-";
    console.log(nm.padEnd(24)+`${cut[0]}×${cut[1]}`.padEnd(12)+`${net.netW.toFixed(0)}×${net.netH.toFixed(0)}`.padEnd(15)+
      String(up).padStart(4)+String(got).padStart(5)+"  "+(got===up?"✓    ":`${got-up>0?"+":""}${got-up}    `)+how);
  }
  console.log("─".repeat(94));
  console.log(`일치 ${hit}/${C.length}  (${(hit/C.length*100).toFixed(0)}%)`);
}

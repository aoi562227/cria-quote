// NFP 엔진을 견적서 실측 up 전건에 돌려 정확도를 낸다 (현재 폴리곤 모델 그대로)
import { solveLayout } from "../src/nest.mjs";
const PL=990,PS=720,BL=20,BS=30;
const SH={"46":[788,1091],"4x62":[788,545],"4x64":[394,545],"guk2":[636,469],"ha4":[444,597]};
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
  const tH=f.type==="tuck"?[f.dust,f.topLid,f.dust,0]:[f.dust,f.topLid,f.dust,0];
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
const Q=[
 ["tuck","맞뚜껑A 92×13×140",92,13,140,"guk2",6],["tuck","맞뚜껑B 150×20×150",150,20,150,"4x62",2],
 ["glue3","삼면A 120×55×180",120,55,180,"ha4",2],["glue3","삼면B 210×90×180",210,90,180,"46",3],
 ["glue3","삼면C 52×50×90",52,50,90,"4x64",4],["glue3","★삼면E 90×70×130",90,70,130,"4x64",2],
 ["glue3","삼면F 90×90×250",90,90,250,"4x62",2],["glue3","삼면D 82×7×126",82,7,126,"4x64",2],
 ["cross","십자A 47×47×176",47,47,176,"4x62",6],["cross","십자B 70×70×55",70,70,55,"ha4",4],
];
console.log("\n═══ NFP 엔진 vs 견적서 실측 up (현재 폴리곤 모델 그대로) ═══════════════════\n");
console.log("케이스".padEnd(24)+"판형".padEnd(8)+"전개도".padEnd(16)+"견적서  NFP   판정   배치");
console.log("─".repeat(92));
let hit=0,under=0,over=0;
for(const [t,nm,W,D,H,sid,realUp] of Q){
  const {pieces:P,net}=pieces(W,D,H,t);
  const [a,b]=SH[sid],A=Math.min(Math.max(a,b),PL),B=Math.min(Math.min(a,b),PS);
  const r=solveLayout(P,A-BL,B-BS,{clearance:0.5});
  const up=r?r.up:0;
  const v=up===realUp?"일치 ✓":(up<realUp?`부족 ${up-realUp}`:`초과 +${up-realUp}`);
  if(up===realUp)hit++;else if(up<realUp)under++;else over++;
  const how=r?`${r.cols}×${r.rows}${r.rotated?" 회전":""}${r.flipRule!=="none"?" "+r.flipRule:""}${r.interlocked?` 물림x${r.overlapX.toFixed(0)}y${r.overlapY.toFixed(0)}`:" 칼선공유"}`:"-";
  console.log(nm.padEnd(24)+sid.padEnd(8)+`${net.netW.toFixed(0)}×${net.netH.toFixed(0)}`.padEnd(16)+
    String(realUp).padStart(4)+String(up).padStart(6)+"   "+v.padEnd(8)+how);
}
console.log("─".repeat(92));
console.log(`일치 ${hit}/10   부족 ${under}   초과 ${over}`);
console.log(`\n(비교) 종전 상수 근사: 8/10 — 단 그 8건 중 맞물림 배치는 전부 실제로 겹침`);

// ── up 오차가 견적 금액에 미치는 영향 ──────────────────────────────
// 정미 = ceil(수량/up),  여분 = max(300, 정미×5%),  지대R = (정미+여분)/(500×절수)
const CUT={"46":1,"4x62":2,"4x64":4,"guk2":2,"ha4":4};
const QTY=5000;
const rOf=(up,sid)=>{const j=Math.ceil(QTY/up),y=Math.max(300,j*0.05);
  return (j+y)/(500*CUT[sid]);};
console.log("\n═══ up 오차 → 지대R → 지대금액 영향 (수량 5,000 기준) ══════════════════\n");
console.log("케이스".padEnd(24)+"견적up  NFPup   견적R    NFP R    지대비 차이");
console.log("─".repeat(78));
let worst=0,sumAbs=0,n=0;
for(const [t,nm,W,D,H,sid,realUp] of Q){
  const {pieces:P}=pieces(W,D,H,t);
  const [a,b]=SH[sid],A=Math.min(Math.max(a,b),PL),B=Math.min(Math.min(a,b),PS);
  const r=solveLayout(P,A-BL,B-BS,{clearance:0.5});
  if(!r)continue;
  const r1=rOf(realUp,sid), r2=rOf(r.up,sid);
  const pct=(r2-r1)/r1*100;
  sumAbs+=Math.abs(pct); n++; if(Math.abs(pct)>Math.abs(worst))worst=pct;
  console.log(nm.padEnd(24)+String(realUp).padStart(5)+String(r.up).padStart(7)+
    r1.toFixed(3).padStart(9)+r2.toFixed(3).padStart(9)+
    (pct===0?"      동일 ✓":`   ${pct>0?"+":""}${pct.toFixed(0)}%`));
}
console.log("─".repeat(78));
console.log(`평균 절대오차 ${(sumAbs/n).toFixed(1)}%   최대 ${worst>0?"+":""}${worst.toFixed(0)}%`);

// ══════════════════════════════════════════════════════════════════
//  verify-autonest.mjs — 자유배치 네스터 적대검증
// ══════════════════════════════════════════════════════════════════
//  이 파일은 src/nest-free.mjs 를 **NFP 를 쓰지 않고** 검사한다.
//  nest-free 의 자체 overlapCount 도 검증 대상이므로 그것만으로 판정하지 않는다 —
//  격자 샘플링으로 실제 교차 면적을 재서 두 값을 나란히 찍는다.
//
//  ⚠ 이 검사기를 처음 쓸 때 **내가 틀렸다.** 기록해 둔다:
//    items 는 {rotated, flipped, x, y} 인데 존재하지 않는 it.rot 을 읽었고
//    flipped 를 완전히 무시했다. 게다가 `it.rot ?? it.rotated ? 90 : 0` 는
//    `(it.rot ?? it.rotated) ? 90 : 0` 로 파싱돼 회전이 뒤죽박죽이 됐다.
//    그 결과 삼면B 에서 871mm² · 십자B 에서 1688mm² 「겹침」이 나왔는데 전부 오탐이었다.
//    → 검사기를 규약(preparePart 의 pieces/flipped + rot90)에 맞추자 전부 0 이 됐다.
//    **검사기가 대상보다 틀리기 쉽다.** 겹침이 보이면 먼저 검사기를 의심해라.
//
//  결정성도 함께 본다 — 같은 seed 5회가 완전히 같은 결과여야 한다.
//  Math.random 이 섞이면 이 테스트가 무의미해지므로 그것을 막는 게이트다.
// ══════════════════════════════════════════════════════════════════
// 자유배치 적대검증 — NFP 미사용 격자 샘플링.
// ⚠ 1차 시도에서 내 측정기가 틀렸다: items 는 {rotated,flipped,x,y} 인데
//   존재하지 않는 it.rot 을 읽고 flipped 를 무시했고, `a ?? b ? 90 : 0` 는
//   `(a ?? b) ? 90 : 0` 로 파싱돼 회전이 뒤죽박죽이었다. 규약을 맞춰 다시 쓴다.
import { solveFree, overlapCount } from "../src/nest-free.mjs";
import { dielinePieces } from "../src/domain/dieline/index.mjs";
import { preparePart, bboxOf, rot90 } from "../src/nest.mjs";

const inTri=(p,a,b,c)=>{const d=(u,v,w)=>(v[0]-u[0])*(w[1]-u[1])-(v[1]-u[1])*(w[0]-u[0]);
  const s1=d(a,b,p),s2=d(b,c,p),s3=d(c,a,p);
  return (s1>=0&&s2>=0&&s3>=0)||(s1<=0&&s2<=0&&s3<=0);};
const inConv=(p,q)=>{for(let i=1;i+1<q.length;i++) if(inTri(p,q[0],q[i],q[i+1])) return true; return false;};
const inPcs=(p,ps)=>ps.some(q=>inConv(p,q));
function ovArea(A,B,step=0.4){
  const a=bboxOf(A),b=bboxOf(B);
  const x0=Math.max(a.x0,b.x0),x1=Math.min(a.x1,b.x1);
  const y0=Math.max(a.y0,b.y0),y1=Math.min(a.y1,b.y1);
  if(x1<=x0||y1<=y0) return 0;
  let n=0;
  for(let x=x0+step/2;x<x1;x+=step) for(let y=y0+step/2;y<y1;y+=step)
    if(inPcs([x,y],A)&&inPcs([x,y],B)) n++;
  return n*step*step;
}
const shift=(ps,dx,dy)=>ps.map(p=>p.map(([x,y])=>[x+dx,y+dy]));
/** items 규약대로 실제 좌표에 놓인 조각. P0=정방향 part, P90=회전 part */
function placed(P0,P90,it){
  const P = it.rotated ? P90 : P0;
  const src = it.flipped ? P.flipped : P.pieces;   // preparePart 가 준 180° 반전본
  return shift(src, it.x, it.y);                    // 두 벌 다 좌상단이 원점이다
}

const CASES=[
  ["삼면B 210×90×180",210,90,180,"glue_3side",980,720],
  ["LUXEN 130×130×55",130,130,55,"glue_3side",788,480],
  ["삼면A 120×55×180",120,55,180,"glue_3side",597,444],
  ["맞뚜껑A 92×13×140",92,13,140,"tuck_both",636,469],
  ["십자B 70×70×55",70,70,55,"cross",444,597],
  ["극박 82×7×126",82,7,126,"glue_3side",545,394],
  ["극단비율 슬리브",300,8,60,"glue_3side",788,545],
];
let bad=[], worstAll=0;
console.log("케이스".padEnd(20)+"up  결정성      자체검사  독립측정 최대겹침");
console.log("─".repeat(74));
for(const [nm,W,D,H,t,pw,ph] of CASES){
  const {pieces}=dielinePieces(W,D,H,t);
  const P0=preparePart(pieces), P90=preparePart(rot90(pieces));
  const sig=s=>{const r=solveFree(pieces,pw,ph,{seed:s});
    return r? r.up+"|"+r.items.map(i=>`${i.x.toFixed(3)},${i.y.toFixed(3)},${i.rotated?1:0}${i.flipped?"f":""}`).join(";") : "null";};
  const det=new Set([sig(7),sig(7),sig(7),sig(7),sig(7)]).size===1;
  let worst=0, up0=0, selfOv=0;
  for(const s of [1,2,3,7,11,42,99]){
    const r=solveFree(pieces,pw,ph,{seed:s});
    if(!r?.items?.length) continue;
    up0=Math.max(up0,r.up);
    selfOv=Math.max(selfOv, r.part?overlapCount(r.part,r.items):0);
    for(let i=0;i<r.items.length;i++) for(let j=i+1;j<r.items.length;j++){
      const ar=ovArea(placed(P0,P90,r.items[i]),placed(P0,P90,r.items[j]),0.5);
      if(ar>worst) worst=ar;
      if(ar>2) bad.push({nm,s,i,j,ar:+ar.toFixed(1)});
    }
  }
  worstAll=Math.max(worstAll,worst);
  console.log(nm.padEnd(20)+String(up0).padStart(2)+"   "+(det?"결정적 ✓":"불안정 ✗").padEnd(11)+
              String(selfOv).padStart(6)+"    "+worst.toFixed(2)+"mm²");
}
console.log("─".repeat(74));
console.log(bad.length? `✗ 겹침 ${bad.length}건 — `+JSON.stringify(bad.slice(0,3))
                      : `✓ 7케이스 × 7seed 전부 겹침 0 (최대 ${worstAll.toFixed(3)}mm²)`);
if (bad.length) process.exitCode = 1;

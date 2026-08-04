import { solveLayout, bboxOf } from "../src/nest.mjs";
import { dielinePieces, calcNetSize } from "../src/dieline.mjs";
const C=[
 ["맞뚜껑A 92×13×140",     92,13,140,"tuck_both", [636,469],6],
 ["맞뚜껑B 150×20×150",   150,20,150,"tuck_both", [760,480],2],
 ["십자A 47×47×176",       47,47,176,"cross",[788,545],6],
 ["십자B 70×70×55",        70,70,55, "cross",[444,597],4],
 ["삼면A 120×55×180",     120,55,180,"glue_3side",[597,444],2],
 ["삼면B 210×90×180",     210,90,180,"glue_3side",[980,720],3],
 ["삼면C 52×50×90",        52,50,90, "glue_3side",[394,545],4],
 ["삼면D 82×7×126",        82,7,126, "glue_3side",[545,394],2],
 ["삼면E 90×70×130",       90,70,130,"glue_3side",[545,394],2],
 ["삼면F 90×90×250",       90,90,250,"glue_3side",[760,480],2],
 ["탈취제A 75×37.5×186",   75,37.5,186,"glue_3side",[788,545],4],
 ["LUXEN 130×130×55",    130,130,55,"glue_3side",[480,788],2],
 ["웨이크버니A 46×46×138", 46,46,138,"glue_3side",[636,469],6],
 ["웨이크버니B 36×36×168", 36,36,168,"glue_3side",[636,469],6],
];
// ── 불변식: 폴리곤 bbox === netW × netH
console.log("\n═══ 불변식 검사 — 폴리곤 bbox = netW × netH ═══════════════════");
let bad=0;
for(const [nm,W,D,H,t] of C){
  const {pieces,net}=dielinePieces(W,D,H,t);
  const b=bboxOf(pieces);
  const dw=b.w-net.netW, dh=b.h-net.netH;
  if(Math.abs(dw)>0.05||Math.abs(dh)>0.05){bad++;
    console.log(`  ✗ ${nm.padEnd(22)} 폴리곤 ${b.w.toFixed(1)}×${b.h.toFixed(1)} vs netSize ${net.netW.toFixed(1)}×${net.netH.toFixed(1)}  Δ${dw.toFixed(1)}/${dh.toFixed(1)}`);}
}
console.log(bad?`  → ${bad}건 불일치`:"  ✓ 전 12건 오차 0 — 크기와 그림이 일치");
// ── up 대조
for(const [lbl,opt] of [["구공식(1단 날개)",{twoStage:false}],["신공식(2단 날개, 혀 인셋 6mm)",{}]]){
  console.log(`\n═══ ${lbl} ═══════════════════════════════════════════════`);
  console.log("케이스".padEnd(22)+"단위".padEnd(11)+"전개도".padEnd(15)+"견적 NFP 판정  배치");
  console.log("─".repeat(88));
  let hit=0;
  for(const [nm,W,D,H,t,cut,up] of C){
    const {pieces:P,net}=dielinePieces(W,D,H,t,opt);
    const r=solveLayout(P,Math.max(...cut),Math.min(...cut),{clearance:0.5});
    const got=r?r.up:0; if(got===up)hit++;
    const how=r?`${r.cols}×${r.rows}${r.rotated?" 회전":""}${r.sx?" 엇갈":""}${r.interlocked?` 물림x${r.overlapX.toFixed(0)}y${r.overlapY.toFixed(0)}`:" 칼선공유"}`:"-";
    console.log(nm.padEnd(22)+`${cut[0]}×${cut[1]}`.padEnd(11)+`${net.netW.toFixed(0)}×${net.netH.toFixed(0)}`.padEnd(15)+
      String(up).padStart(4)+String(got).padStart(4)+"  "+(got===up?"✓   ":`${got>up?"+":""}${got-up}   `)+how);
  }
  console.log("─".repeat(88)+`\n일치 ${hit}/${C.length}  (${(hit/C.length*100).toFixed(0)}%)`);
}

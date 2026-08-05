// ══════════════════════════════════════════════════════════════════
//  이 파일은 src/nest.mjs 와 src/domain/dieline/index.mjs 를 **직접 import** 한다
//  (종전에는 src/dieline.mjs 재export shim 을 거쳤다).
//
//  견적서 「단위」(=실제 재단 크기)를 판으로 주고 nest 엔진의 up 을 채점한다.
//  ★ 날개 테이퍼 노브가 살아 있는지도 여기서 본다 — 종전에는 {twoStage:false} 를
//    넘겼는데 geometry.piecesFromFlaps 는 opt.taper 만 읽어서 두 표가 항상 같았다.
// ══════════════════════════════════════════════════════════════════
import { solveLayout, bboxOf } from "../src/nest.mjs";
import { dielinePieces } from "../src/domain/dieline/index.mjs";
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
 ["소스코 140×43×130",   140,43,130,"glue_3side",[788,545],4],
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
console.log(bad?`  → ${bad}건 불일치`:`  ✓ 전 ${C.length}건 오차 0 — 크기와 그림이 일치`);
if(bad) process.exitCode = 1;
// ── up 대조
const runs = {};
for(const [key,lbl,opt] of [["off","테이퍼 없음(전폭 날개)",{taper:false}],
                            ["on", "테이퍼 적용(실측 혀 인셋)",{}]]){
  console.log(`\n═══ ${lbl} ═══════════════════════════════════════════════`);
  console.log("케이스".padEnd(22)+"단위".padEnd(11)+"전개도".padEnd(15)+"견적 NFP 판정  배치");
  console.log("─".repeat(88));
  let hit=0; const rows=[];
  for(const [nm,W,D,H,t,cut,up] of C){
    const {pieces:P,net}=dielinePieces(W,D,H,t,opt);
    const r=solveLayout(P,Math.max(...cut),Math.min(...cut),{clearance:0.5});
    const got=r?r.up:0; if(got===up)hit++;
    const how=r?`${r.cols}×${r.rows}${r.rotated?" 회전":""}${r.sx?" 엇갈":""}${r.interlocked?` 물림x${r.overlapX.toFixed(0)}y${r.overlapY.toFixed(0)}`:" 칼선공유"}`:"-";
    rows.push({nm, got, how});
    console.log(nm.padEnd(22)+`${cut[0]}×${cut[1]}`.padEnd(11)+`${net.netW.toFixed(0)}×${net.netH.toFixed(0)}`.padEnd(15)+
      String(up).padStart(4)+String(got).padStart(4)+"  "+(got===up?"✓   ":`${got>up?"+":""}${got-up}   `)+how);
  }
  console.log("─".repeat(88)+`\n일치 ${hit}/${C.length}  (${(hit/C.length*100).toFixed(0)}%)`);
  runs[key]={hit, rows};
}

// 두 표가 완전히 같으면 노브가 죽은 것이다 — 종전 {twoStage:false} 가 정확히 그 상태였고,
// 그래서 "테이퍼가 up 을 바꾸는가" 라는 질문에 이 스코어카드가 답하지 못했다.
const diff = runs.off.rows.filter((r,i) =>
  r.got !== runs.on.rows[i].got || r.how !== runs.on.rows[i].how);
console.log(`\n테이퍼 노브 영향: ${diff.length}건의 배치가 달라짐` +
            (diff.length ? "" : "  ⚠ 노브가 죽었다 (opt 이름 확인)"));
for (const r of diff) {
  const b = runs.on.rows.find(x => x.nm === r.nm);
  console.log(`  · ${r.nm.padEnd(22)} ${r.got}up ${r.how}  →  ${b.got}up ${b.how}`);
}
if (!diff.length) process.exitCode = 1;

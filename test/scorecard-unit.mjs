// ══════════════════════════════════════════════════════════════════
//  이 파일은 src/nest.mjs 와 src/domain/dieline/index.mjs 를 **직접 import** 한다.
//  (종전에는 전개도 조각 생성을 이 파일이 복제했다 — 앱 전개도를 바꿔도
//   여기는 옛 도형을 계속 채점했다.)
//
//  견적서가 알려주는 「단위(재단크기)」를 그대로 판으로 주고 up 이 맞는지 본다.
//  판형 선택 변수를 제거한 순수 배치 정확도 측정.
//
//  ★ 이 파일이 물림 방침의 A/B 측정이자, 그 방침을 지키는 회귀 게이트다.
//    §A(물림 0) 가 현행 printableArea 와 같은 조건이고, §C(물림 20/30) 는
//    **폐기된 방침**의 점수를 계속 보여준다. 두 숫자가 뒤바뀌면 누군가
//    물림을 다시 빼기 시작한 것이다.
//    물림 상수는 sheets.mjs 에서 가져와 값을 두 벌로 두지 않는다
//    (그래서 이 파일이 BITE_LONG/BITE_SHORT 의 유일한 소비자다 —
//     상수의 실측 근거를 살려두는 대가로 여기서 계속 계량한다).
// ══════════════════════════════════════════════════════════════════
import { solveLayout } from "../src/nest.mjs";
import { dielinePieces } from "../src/domain/dieline/index.mjs";
import { BITE_LONG, BITE_SHORT } from "../src/domain/data/sheets.mjs";

// [이름, W,D,H, 구조, 견적서 단위(재단크기), 견적서 up]
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
];
// 맞물림 허용 여부를 바꿔가며 — 실무에서 맞물림이 기본인지 예외인지 판정
const SCORES = {};
for (const [key,label,gL,gS,noIL] of [
  ["A","A. 물림없음 · 맞물림 허용  ← 현행 printableArea 와 동일 조건",0,0,false],
  ["B","B. 물림없음 · 맞물림 금지(칼선공유만)",0,0,true],
  ["C",`C. 물림적용(긴변 ${BITE_LONG} / 짧은변 ${BITE_SHORT}) · 맞물림 허용  ← 폐기된 방침`,BITE_LONG,BITE_SHORT,false],
]) {
  console.log(`\n═══ ${label} ═══════════════════════════════════════════`);
  console.log("케이스".padEnd(24)+"단위".padEnd(12)+"전개도".padEnd(15)+"견적 NFP  판정   배치");
  console.log("─".repeat(94));
  let hit=0;
  for(const [nm,W,D,H,t,cut,up] of C){
    const {pieces:P,net}=dielinePieces(W,D,H,t);
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
  SCORES[key]=hit;
}

console.log(`
═══ 물림 방침 A/B 결론 ═══════════════════════════════════════════════════
  물림 0      → ${SCORES.A}/${C.length}   ← 채택 (imposition.printableArea 현행)
  물림 적용   → ${SCORES.C}/${C.length}   (긴변 −${BITE_LONG} / 짧은변 −${BITE_SHORT}) — 폐기

※ 견적서 「단위」열(760×480, 980×720 …)은 원지 규격이 아니라 **이미 재단된 크기**다.
  그 크기에서 견적서의 up 이 실제로 나왔으므로, 여기서 물림을 또 빼면 이중 차감이다.
  imposition.printableArea 는 이제 물림을 빼지 않는다 — 그 근거가 위 두 숫자다.
  앱 실경로(verify-net · scorecard-nest)도 같은 방향으로 1/10 → 7/10 이 됐다.
  ⚠ "물림은 물리적으로 항상 필요하다" 는 이유로 뒤집지 마라. 물리적으로는 맞지만
    「단위」 칸의 숫자가 이미 물림이 반영된 재단 크기다. 되돌리려면 BASE_SHEETS 를
    원지 규격으로 재정의하고 견적서 78건을 다시 역산하는 것이 먼저다.

※ B(맞물림 금지)와 A 의 차이는 "맞물림이 up 을 실제로 늘리는가" 다.
  맞물림은 예외적 배치이고, 늘어나는 up 이 많지 않다는 것이 실측 결론이다.`);
if (SCORES.A <= SCORES.C) {
  console.log(`\n✗ 회귀: 물림 적용(§C)이 물림 0(§A)을 앞질렀다 — 방침이 뒤집혔는지 확인하라.`);
  process.exitCode = 1;
}

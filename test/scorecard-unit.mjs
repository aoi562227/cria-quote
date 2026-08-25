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
// 목형별 구조 옵션 픽스쳐 — 네 스위트 공용(복제 금지).
import { dieOptOf, dieNote, measuredOnly } from "./die-profiles.mjs";

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
// ★ 26-08-16 — 이 표가 날개 프로파일 교체의 up 점수판이다.
//   당시 §A 가 7/12 → 8/12 로 올랐고 움직인 것은 LUXEN 130×130×55 (1up → 2up) 한 건이다.
//   삼면접착 아래 띠의 깊은 날개를 D 패널에서 **W 패널(탭에서 먼 쪽, idx 1)** 로 옮기니
//   맞물림이 실제로 성립해 견적서 2up 을 재현했다.
//   ⚠ 여기 12건 중 삼면D·탈취제A·맞뚜껑B 3건은 프로파일 A/B 에서 **한 칸도 안 움직였다.**
//     날개 프로파일로 설명되지 않는 별개 원인이다 (verify-net 하단 주석 참조).
//
// ★★ 26-08-18 — 그 8/12 는 **되돌려졌다. §A 는 7/12 이고 그게 맞다.**
//   위 「idx 1 고정」이 소스코형 목형(깊은 날개가 탭에 붙은 W1)의 아래 띠 W1 을 0 으로
//   그렸고, 격자 솔버가 그 빈자리를 물어 **실물에서 5,033.8mm² 겹치는 판**을 냈다
//   (소스코 140×43×130 @하4 1×2, dy 223.81→181.00 + sx 190.15). up 은 2 로 같아
//   **이 표도 어떤 금액 스코어카드도 그걸 못 잡는다** — 그래서 게이트를 새로 만들었다:
//     verify-imposition 「실측 프로파일 겹침 게이트」 (목형 7벌 × 표준판형 10종,
//     격자 0.3mm 샘플링 · NFP 미사용, 계측기 자기검사 포함)
//   현행은 아래 띠 [min(W,b)/2, b, min(W,b)/2, b] · 위 띠 [s,s,s,s] 안전 봉투다.
//   근거·A/B 는 dieline/glue3.mjs flaps() 주석이 소유한다.
//
//   ⚠ 이 표에서 잃은 것을 정확히 적는다 — LUXEN 2up → 1up 한 건이다(8/12 → 7/12).
//     scorecard2(원시 네스터)는 안전봉투로 10/15 → 9/15 가 됐고 그 한 행이
//     웨이크버니B 36×36×168 (6up → 4up) 이다.
//     **앱 실경로(solveImposition)에서도 두 건 다 잃는다** — 「발자국 상한이 흡수하므로
//     원시 점수만 떨어진다」는 완화 논리는 웨이크버니B 에서 성립하지 않는다
//     (현행 봉투는 원시가 이미 4up 이라 상한이 흡수할 것이 없다).
//   ⚠ 종전 이 자리에 「양쪽 W 다 깊게(안전 봉투) → scorecard2 9/15 = exit 1」이라
//     적혀 있었는데 그 인과가 틀렸다. scorecard2 는 **점수로 exit 1 을 내지 않는다** —
//     당시 exit 1 은 「테이퍼 노브가 배치를 하나도 안 바꿈」 검사에서 나온 거짓 경보였고,
//     그 검사는 이제 폴리곤 수준(노브 배선)으로 내려가 15/15 로 통과한다.
//     기각 근거를 점수 옆에 적을 때는 **어느 줄이 exit 를 내는지** 확인해라.
//
// ★★★ 26-08-19 — 위 두 숫자가 **둘 다 낡았다. 실측으로 갈아 적는다.**
//   위 ★★ 는 「§A 7/12 · scorecard2 9/15」로 끝나 있는데 그 뒤에 CROSS_TAB 변경이
//   들어왔다. 지금은 **§A 6/12 · scorecard2 8/15** 다. 원인이 둘이고 서로 다르다:
//     · 웨이크버니B 36×36×168   6up → 4up   ← 26-08-18 안전봉투 (scorecard2 에만 있다)
//     · 십자B 70×70×55         4up → 3up   ← 26-08-19 CROSS_TAB 14.3 → 23.33
//                                            (§A · scorecard2 · verify-net **셋 다**)
//   측정 (이 작업트리에서 상수 하나씩만 되돌려 실행):
//     HEAD (git archive HEAD 로 통째 실행)   §A 7/12 · scorecard2 10/15 · verify-net 7/10
//     CROSS_TAB 만 14.3 으로 복귀            §A 7/12 · scorecard2  9/15 · verify-net 7/10
//     현행                                  §A 6/12 · scorecard2  8/15 · verify-net 6/10
//   십자B 행의 모양까지 적어 둔다 — netW 294 → 303 이 되면서 하4(444×597)에서
//     2×2 칼선공유 4up ✓  →  3×1↺ 3up ✗ 로 내려앉는다.
//   ⚠ 그래도 되돌리지 않는다. 14.3 은 니치어 −9.03 · 칼선-10 −0.70 **부족**이라
//     자동선택 판형에서 실물 겹침 1,269mm² · 100mm² 를 냈다(cross.mjs 참조).
//     점수 1칸보다 물리적으로 불가능한 판이 나쁘다.
//   ⚠ 이 파일의 물림 A/B 결론(§A 6 vs §C 1)은 그대로다 — 방침 게이트는 안 흔들린다.
// 맞물림 허용 여부를 바꿔가며 — 실무에서 맞물림이 기본인지 예외인지 판정
const SCORES = {};
// ★ 26-08-25 — 마지막 인자 `die` = 목형별 구조 옵션을 준다/안 준다.
//   §A/§B/§C 는 물림 방침 게이트라 **기본값으로 고정한다** — 세 줄이 같은
//   조건에서 비교돼야 §A > §C 가 물림의 증거가 된다. 목형 지정은 §A-die 한 줄로
//   따로 재서 「목형을 알려주면 몇 점인가」를 같은 화면에 둠다.
for (const [key,label,gL,gS,noIL,die] of [
  ["A","A. 물림없음 · 맞물림 허용  ← 현행 printableArea 와 동일 조건",0,0,false,false],
  ["Adie","A-die. 위와 같은 조건 + **목형별 구조 옵션** (test/die-profiles.mjs)",0,0,false,true],
  ["B","B. 물림없음 · 맞물림 금지(칼선공유만)",0,0,true,false],
  ["C",`C. 물림적용(긴변 ${BITE_LONG} / 짧은변 ${BITE_SHORT}) · 맞물림 허용  ← 폐기된 방침`,BITE_LONG,BITE_SHORT,false,false],
]) {
  console.log(`\n═══ ${label} ═══════════════════════════════════════════`);
  console.log("케이스".padEnd(24)+"단위".padEnd(12)+"전개도".padEnd(15)+"견적 NFP  판정   배치");
  console.log("─".repeat(94));
  let hit=0; const dieRows=[];
  for(const [nm,W,D,H,t,cut,up] of C){
    const {pieces:P,net}=dielinePieces(W,D,H,t, die ? dieOptOf(t,W,D,H) : {});
    const A=Math.max(...cut)-gL, B=Math.min(...cut)-gS;
    const r=solveLayout(P,A,B,{clearance:0.5,noInterlock:noIL});
    const got=r?r.up:0;
    if(got===up)hit++;
    if(die) dieRows.push({ name:nm, ok:got===up, t, W, D, H });
    const how=r?`${r.cols}×${r.rows}${r.rotated?" 회전":""}${r.interlocked?` 물림x${r.overlapX.toFixed(0)}y${r.overlapY.toFixed(0)}`:" 칼선공유"}`:"-";
    console.log(nm.padEnd(24)+`${cut[0]}×${cut[1]}`.padEnd(12)+`${net.netW.toFixed(0)}×${net.netH.toFixed(0)}`.padEnd(15)+
      String(up).padStart(4)+String(got).padStart(5)+"  "+(got===up?"✓    ":`${got-up>0?"+":""}${got-up}    `)+how);
  }
  console.log("─".repeat(94));
  console.log(`일치 ${hit}/${C.length}  (${(hit/C.length*100).toFixed(0)}%)`);
  // ★ 대표 숫자 — 원본 도면이 없는 건(미실측)은 분모에서 뺀다.
  if(die) console.log("  " + measuredOnly(dieRows).text);
  SCORES[key]=hit;
}

console.log(`
═══ 물림 방침 A/B 결론 ═══════════════════════════════════════════════════
  물림 0      → ${SCORES.A}/${C.length}   ← 채택 (imposition.printableArea 현행)
  물림 0 + 목형 → ${SCORES.Adie}/${C.length}   ← 목형별 구조 옵션을 준 같은 조건
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
console.log("  " + dieNote(C.map(([,W,D,H,t])=>[t,W,D,H])));
// 목형을 알려줍는데 점수가 내려가면 노브 방향이 반대로 배선된 것이다.
if (SCORES.Adie < SCORES.A) {
  console.log(`
✗ 회귀: 목형 지정(§A-die ${SCORES.Adie})이 미지정(§A ${SCORES.A})보다 낮다.`);
  process.exitCode = 1;
}
if (SCORES.A <= SCORES.C) {
  console.log(`\n✗ 회귀: 물림 적용(§C)이 물림 0(§A)을 앞질렀다 — 방침이 뒤집혔는지 확인하라.`);
  process.exitCode = 1;
}

// ══════════════════════════════════════════════════════════════════
//  맞물림 판걸이 모델 검증 — 코리팩 산출식 엑셀 대조
//  출처: 「패키지 단가 산출식_엑셀_SB01_B형 맞뚜껑_190916_07.xlsx」
//         시트 '가격산출 조건표_SB01_B형 맞뚜껑'  D389:D396
//
//  §A·§B·§C 는 **엑셀 원문 검증**이다. App/domain 에 원본이 없으므로 여기 남는다
//  (엑셀 수식을 그대로 옮긴 것 — 앱 로직의 미러가 아니다).
//  §D 만 src/domain 을 직접 import 한다: buildDieline · solveImposition · calcNetSize.
//    종전 §D 는 IL_W/IL_H 상수 감산 모델을 복제해 "IL_H=25 vs IL_H=바닥날개" 를
//    비교했다. 그 두 노브는 nest 엔진으로 갈아타면서 사라졌다 —
//    이제 엔진이 실제로 몇 mm 를 물리는지 재고, 견적서 up 과 대조한다.
// ══════════════════════════════════════════════════════════════════
import { BITE_SHORT, BITE_LONG, BASE_SHEETS } from "../src/domain/data/sheets.mjs";
import { calcNetSize } from "../src/domain/dieline/index.mjs";
import { buildDieline } from "../src/domain/quote.mjs";
import { solveImposition } from "../src/domain/imposition.mjs";

const IL_W = 10, IL_H = 25;               // 엑셀 상수 (§A·§C 전용)
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
if (ok !== 8) process.exitCode = 1;

console.log("\n═══ B. 물림 = 엑셀 「제작 규격(여분제외)」 ════════════════════════════════");
// 엑셀 B14(종이 규격) → B15(제작 규격). 이 차이가 sheets.mjs 의 BITE_SHORT/BITE_LONG 근거다.
// 4번째 열 = 앱 판형 id (있는 것만). §C 가 「제작 규격」을 여기서 가져가므로
// 값을 두 벌로 두지 않는다 — 종전에는 §C 가 MAKE 표에 같은 숫자를 다시 적어놨다.
const PAPER = [
  ["4X6(사륙전지)", [788,1091], [758,1071], "46"],
  ["7X5(사륙이절)", [545,788],  [515,768],  "4x62"],
  ["사륙사절",      [394,545],  [364,525],  "4x64"],
  ["국전",          [636,939],  [606,919],  "guk"],
  ["국이절",        [469,636],  [436,616],  "guk2"],
  ["하드롱사절",    [450,600],  [420,580],  "ha4"],
];
console.log("판형".padEnd(16)+"종이 규격".padEnd(12)+"제작 규격".padEnd(12)+"물림(짧은변/긴변)   코드값 일치?");
let okB = 0;
for (const [nm,[rw,rh],[mw,mh]] of PAPER) {   // eslint-disable-line
  const ds = rw-mw, dl = rh-mh;
  const hit = ds === BITE_SHORT && dl === BITE_LONG;
  if (hit) okB++;
  console.log(nm.padEnd(16)+`${rw}×${rh}`.padEnd(12)+`${mw}×${mh}`.padEnd(12)+
    `−${ds} / −${dl}`.padEnd(20)+(hit?"✓":`✗ (코드 −${BITE_SHORT}/−${BITE_LONG})`));
}
console.log(`→ 코드값(BITE_SHORT=${BITE_SHORT} / BITE_LONG=${BITE_LONG}) 일치 ${okB}/${PAPER.length}` +
            `   ※ 국이절만 짧은변 −33 (엑셀 자체 예외)`);

console.log("\n═══ C. 실측 견적서 up — 엑셀 모델로는 확정 안 됨 ══════════════════════════");
// 판은 §B 의 「제작 규격」을 그대로 쓴다 (엑셀 좌표계 안에서만 의미가 있는 모델이다 —
// 엑셀의 하드롱사절 450×600 은 BASE_SHEETS 의 ha4 444×597 과 다르다).
const MAKE = Object.fromEntries(PAPER.filter(p => p[3]).map(([,, mk, id]) => [id, mk]));
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

console.log("\n═══ D. 엔진이 실제로 물리는 양 — 견적서 10건 (실코드) ═════════════════════");
// 종전 §D 는 "세로 맞물림 = 바닥날개 깊이" 라는 가설을 견적서 up 8/10 으로 역산해
// 채택했다. 그 가설은 verify-nest §5 에서 기하 위반으로 반증됐다(130×130×55 에서
// 바닥날개 145mm 를 물리려 하지만 실제 허용치는 26mm — 칼선이 서로를 지나감).
// 그래서 여기서는 가설을 채점하지 않고, **nest 엔진이 실제로 확보한 겹침**을 재고
// 바닥날개 값과 나란히 둔다. 두 값의 격차가 그 가설이 왜 틀렸는지의 증거다.
const S = id => BASE_SHEETS.find(s => s.id === id);
const ID = { glue3:"glue_3side", cross:"cross", tuck:"tuck_both" };
const Qa=[
 ["glue3","삼면A 120×55×180",120,55,180,"ha4",2], ["glue3","삼면B 210×90×180",210,90,180,"46",3],
 ["glue3","삼면C 52×50×90",52,50,90,"4x64",4],        ["glue3","★삼면E 90×70×130",90,70,130,"4x64",2],
 ["glue3","삼면F 90×90×250",90,90,250,"4x62",2],    ["glue3","삼면D 82×7×126",82,7,126,"4x64",2],
 ["cross","십자A 47×47×176",47,47,176,"4x62",6],        ["cross","십자B 70×70×55",70,70,55,"ha4",4],
 ["tuck","맞뚜껑A 92×13×140",92,13,140,"guk2",6],   ["tuck","맞뚜껑B 150×20×150",150,20,150,"4x62",2],
];
console.log("건".padEnd(24)+"바닥날개".padEnd(10)+"엔진 겹침 ↔/↕".padEnd(18)+"엔진 up".padEnd(9)+"견적서");
console.log("-".repeat(80));
let v=0;
for(const [k,nm,W,D,H,sid,real] of Qa){
  const bot = calcNetSize(W,D,H,ID[k]).botFloor;
  const dl  = buildDieline({ mode:"box", structure:ID[k], W, D, H, hangTab:0 });
  const L   = solveImposition({ dieline: dl, sheet: S(sid), hangTab:0 });
  const ovX = Math.max(0, L.boxW - L.dx), ovY = Math.max(0, L.boxH - L.dy);
  if(L.up===real)v++;
  console.log(nm.padEnd(24)+bot.toFixed(0).padStart(4).padEnd(10)+
    `${ovX.toFixed(1)} / ${ovY.toFixed(1)}`.padEnd(18)+
    (L.up+(L.up===real?" ✓":"  ")).padEnd(9)+real);
}
console.log("-".repeat(80));
console.log(`up 일치: 엔진 → ${v}/${Qa.length}   (종전 이 표의 8/10 은 반증된 IL_H 가설의 점수였다)`);
console.log(`
→ 엔진 겹침은 대부분 바닥날개 값보다 훨씬 작다. 그게 정상이다 —
  겹침은 "날개 깊이" 가 아니라 **거울상 날개가 서로를 피할 수 있는 폭**으로 결정된다.
  실측 대지 2건도 20.8mm / 43.9mm 로 작다 (verify-imposition 참조).

→ 물림 이중 차감을 제거해 이 표가 1/10 → ${v}/${Qa.length} 로 회복됐다. 판은 BASE_SHEETS 를
  인쇄기 상한으로 클램프한 값 그대로이고 물림은 빼지 않는다 — 그 숫자가 이미
  재단 크기다. A/B 는 scorecard-unit.mjs §A(물림 0) vs §C(물림 적용).
  남은 3건은 목형 설계 요인이다 (verify-net 하단 주석 참조).

남은 케이스 메모:
  삼면D 82×7×126 — D=7 로 칼선 검증범위(D 33.75~124) 밖. netH 가 실제보다 작게 나와
                    배치가 과다하다(6up vs 견적서 2up)
  맞뚜껑B 150×20×150 — 어떤 모델로도 2up 이 안 나옴(기하학상 4up 가능).
                        500ea 소량이라 기존 2up 목형을 쓴 것으로 추정`);

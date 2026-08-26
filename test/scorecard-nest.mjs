// ══════════════════════════════════════════════════════════════════
//  이 파일은 src/domain/{quote,imposition,reams}.mjs 와 dieline/index.mjs 를
//  **직접 import** 한다. 앱이 실제로 타는 경로(buildDieline → solveImposition)를
//  견적서 실측 up 전건에 돌려 정확도를 낸다.
//
//  종전에는 전개도 조각 생성·판형표·물림·지대R 을 전부 복제했다. 그래서
//  "NFP 엔진의 정확도" 라고 적혀 있었지만 실제로 채점한 것은 이 파일 안의
//  사본이었고, 앱이 쓰는 물림·발자국 상한·FIT_TOL 은 하나도 반영되지 않았다.
// ══════════════════════════════════════════════════════════════════
import { buildDieline } from "../src/domain/quote.mjs";
import { solveImposition } from "../src/domain/imposition.mjs";
import { calcR } from "../src/domain/reams.mjs";
import { BASE_SHEETS } from "../src/domain/data/sheets.mjs";
// 목형별 구조 옵션 픽스쳐 — verify-net 과 **같은 표**를 읽는다(이 둘은 코퍼스가 동일하다).
import { dieOptOf, dieSrcOf, dieNote, measuredOnly } from "./die-profiles.mjs";

const S = id => BASE_SHEETS.find(s => s.id === id);
const Q=[
 ["tuck_both","맞뚜껑A 92×13×140",92,13,140,"guk2",6],["tuck_both","맞뚜껑B 150×20×150",150,20,150,"4x62",2],
 ["glue_3side","삼면A 120×55×180",120,55,180,"ha4",2],["glue_3side","삼면B 210×90×180",210,90,180,"46",3],
 ["glue_3side","삼면C 52×50×90",52,50,90,"4x64",4],["glue_3side","★삼면E 90×70×130",90,70,130,"4x64",2],
 ["glue_3side","삼면F 90×90×250",90,90,250,"4x62",2],["glue_3side","삼면D 82×7×126",82,7,126,"4x64",2],
 ["cross","십자A 47×47×176",47,47,176,"4x62",6],["cross","십자B 70×70×55",70,70,55,"ha4",4],
];
// ★ 26-08-25 — `die` 가 true 면 **그 목형의 실측 옵션**으로 푸다.
//   기본값은 안전 봉투(크게 그리기)라 up 이 적게 나온다 = 견적이 비싸다.
//   두 열을 같이 재야 「목형을 알려주면 얼마나 좋아지는가」와
//   「안 알려준 사용자가 받는 값」이 둘 다 보인다.
const layoutOf = (t,W,D,H,sid,die=false) => {
  const dieline = buildDieline({ mode:"box", structure:t, W, D, H, hangTab:0,
                                 dieOpt: die ? dieOptOf(t,W,D,H) : undefined });
  return { dieline, layout: solveImposition({ dieline, sheet: S(sid), hangTab:0 }) };
};

console.log("\n═══ 실코드 판걸이 vs 견적서 실측 up ═══════════════════════════════════════\n");
console.log("케이스".padEnd(24)+"판형".padEnd(8)+"전개도(기본)".padEnd(16)+"견적서  기본  목형   판정(목형)  배치(목형)");
console.log("─".repeat(104));
let hit=0,under=0,over=0,hitD=0; const dieRows=[];
for(const [t,nm,W,D,H,sid,realUp] of Q){
  const { dieline, layout } = layoutOf(t,W,D,H,sid);
  const { layout: lD } = layoutOf(t,W,D,H,sid,true);
  const up = layout.up, upD = lD.up;
  const v = upD===realUp?"일치 ✓":(upD<realUp?`부족 ${upD-realUp}`:`초과 +${upD-realUp}`);
  if(up===realUp)hit++;else if(up<realUp)under++;else over++;
  if(upD===realUp)hitD++;
  dieRows.push({ name:nm, ok:upD===realUp, t, W, D, H });
  const how = `${lD.cols}×${lD.rows}${lD.rotated?" 회전":""}` +
              `${lD.interlocked?` ${lD.overlapInfo}`:" 칼선공유"}` +
              `${lD.utilCapped?" (발자국컷)":""}`;
  console.log(nm.padEnd(24)+sid.padEnd(8)+
    `${dieline.net.netW.toFixed(0)}×${dieline.net.netH.toFixed(0)}`.padEnd(16)+
    String(realUp).padStart(4)+String(up).padStart(6)+String(upD).padStart(6)+"   "+v.padEnd(12)+how);
}
console.log("─".repeat(104));
console.log(`일치(기본 · 목형 미지정) ${hit}/${Q.length}   부족 ${under}   초과 ${over}`);
console.log(`일치(목형 지정)          ${hitD}/${Q.length}`);
console.log("  " + dieNote(Q.map(([t,,W,D,H])=>[t,W,D,H])));
// ★ 대표 숫자 — 원본 도면이 없는 건은 분모에서 뺀다(die-profiles.mjs measuredOnly).
console.log("  " + measuredOnly(dieRows).text);
if (hitD < hit) { console.log("✗ 목형을 알려줌에도 점수가 내려갔다."); process.exitCode = 1; }
console.log(`
※ 판은 BASE_SHEETS 를 인쇄기 상한 990×720 으로 클램프한 값이다 — 물림은 빼지 않는다
  (판형 숫자가 이미 재단 크기이므로 또 빼면 이중 차감. 근거는 imposition.printableArea).
  종전 물림 20/30 을 뺐을 때 이 표는 1/10 이었고 지대금액 평균절대오차가 48.9% 였다.
  판을 견적서 「단위」로 직접 주는 A/B 측정은 scorecard-unit.mjs 가 담당한다.`);

// ── up 오차가 견적 금액에 미치는 영향 ──────────────────────────────
// 지대R 은 reams.calcR 을 그대로 쓴다 — 여기서 (정미+여분)/(500×절수) 를 다시 적으면
// 올림 규칙(전지 0.1 / 2절이하 3자리)이 빠져 실제 금액과 다른 표가 나온다.
const QTY=5000;
console.log("\n═══ up 오차 → 지대R → 지대금액 영향 (수량 5,000 기준) ══════════════════\n");
console.log("케이스".padEnd(24)+"견적up  실코드   견적R    실코드R   지대비 차이");
console.log("─".repeat(80));
let worst=0,sumAbs=0,n=0,sumAbsD=0,nD=0;
for(const [t,nm,W,D,H,sid,realUp] of Q){
  const { layout } = layoutOf(t,W,D,H,sid);
  const { layout: lD } = layoutOf(t,W,D,H,sid,true);
  if(!layout.up)continue;
  const sh = S(sid);
  const r1 = calcR(realUp, QTY, sh), r2 = calcR(layout.up, QTY, sh);
  const pct=(r2-r1)/r1*100;
  sumAbs+=Math.abs(pct); n++; if(Math.abs(pct)>Math.abs(worst))worst=pct;
  if(lD.up){ const rD=calcR(lD.up,QTY,sh); sumAbsD+=Math.abs((rD-r1)/r1*100); nD++; }
  console.log(nm.padEnd(24)+String(realUp).padStart(5)+String(layout.up).padStart(7)+
    r1.toFixed(3).padStart(9)+r2.toFixed(3).padStart(10)+
    (pct===0?"      동일 ✓":`   ${pct>0?"+":""}${pct.toFixed(0)}%`));
}
console.log("─".repeat(80));
console.log(`평균 절대오차 ${(sumAbs/n).toFixed(1)}%   최대 ${worst>0?"+":""}${worst.toFixed(0)}%   (목형 지정 시 평균 ${(sumAbsD/nD).toFixed(1)}%)`);
console.log(`
※ up 은 정미·지대R·공정R·전 공정 금액의 **분모**다. 여기 나오는 %가 곧
  견적 금액이 흔들리는 폭이다. 그래서 배치는 단가표보다 위험한 변경이다.`);

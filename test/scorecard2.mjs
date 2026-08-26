// ══════════════════════════════════════════════════════════════════
//  이 파일은 src/nest.mjs 와 src/domain/dieline/index.mjs 를 **직접 import** 한다
//  (종전에는 src/dieline.mjs 재export shim 을 거쳤다).
//
//  견적서 「단위」(=실제 재단 크기)를 판으로 주고 nest 엔진의 up 을 채점한다.
//  ★ 날개 테이퍼 노브가 살아 있는지도 여기서 본다 — 종전에는 {twoStage:false} 를
//    넘겼는데 geometry.piecesFromFlaps 는 opt.taper 만 읽어서 두 표가 항상 같았다.
//
//  ⚠⚠ 이 표의 up 은 **앱이 부르는 금액의 up 이 아니다.**
//    여기는 `solveLayout` 을 **원시 호출**한다 — 즉 nest 격자 솔버의 날숫자다.
//    앱 실경로는 `domain/imposition.solveImposition` 이고 그 위에 정책 3개가 더 걸린다:
//      ① 인쇄기 상한 클램프(990×720)  ② **발자국 상한 MAX_FOOT_PCT=92**  ③ 행거탭 축
//    ②가 실제로 숫자를 갈라놓는다 — 실측(26-08-18):
//      웨이크버니B 36×36×168 @636×469  원시 8up → 앱 6up   (발자국 초과로 한 칸 깎임)
//      웨이크버니A 46×46×138 @636×469  원시 6up → 앱 4up
//    그래서 **이 파일의 점수만 보고 「앱이 이 up 으로 견적을 낸다」고 읽으면 틀린다.**
//    앱 경로의 점수판은 `verify-net` 「견적서 판걸이 up 재현 — 실코드(solveImposition)」다.
//    이 파일이 재는 것은 「격자 솔버가 기하학적으로 몇 장 앉힐 수 있나」이고,
//    그건 도형(=전개도 폴리곤)의 품질을 보는 창이다. 그 목적으로만 읽어라.
// ══════════════════════════════════════════════════════════════════
import { solveLayout, bboxOf } from "../src/nest.mjs";
import { dielinePieces, DIE_OPTS } from "../src/domain/dieline/index.mjs";
// 목형별 구조 옵션 픽스쳐 — 네 스위트 공용(복제 금지).
import { dieOptOf, dieSrcOf, dieNote, measuredOnly } from "./die-profiles.mjs";
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
// ★ 26-08-25 — 세 번째 행 「목형 지정」을 넣었다. `die:true` 면 그 목형의
//   구조 옵션(test/die-profiles.mjs)을 얹어 다시 푸는다. 기본값은 안전 봉투라
//   두 줄을 같이 봐야 「봉투가 몇 칸을 희생하고 있는가」가 숫자로 보인다.
for(const [key,lbl,opt,die] of [["off","테이퍼 없음(전폭 날개)",{taper:false},false],
                            ["on", "테이퍼 적용(실측 혀 인셋)",{},false],
                            ["die","테이퍼 적용 + **목형별 구조 옵션**",{},true]]){
  console.log(`\n═══ ${lbl} ═══════════════════════════════════════════════`);
  console.log("케이스".padEnd(22)+"단위".padEnd(11)+"전개도".padEnd(15)+"견적 NFP 판정  배치");
  console.log("─".repeat(88));
  let hit=0; const rows=[]; const dieRows=[];
  for(const [nm,W,D,H,t,cut,up] of C){
    const {pieces:P,net}=dielinePieces(W,D,H,t,{...opt, ...(die ? dieOptOf(t,W,D,H) : {})});
    const r=solveLayout(P,Math.max(...cut),Math.min(...cut),{clearance:0.5});
    const got=r?r.up:0; if(got===up)hit++;
    if(die) dieRows.push({ name:nm, ok:got===up, t, W, D, H });
    const how=r?`${r.cols}×${r.rows}${r.rotated?" 회전":""}${r.sx?" 엇갈":""}${r.interlocked?` 물림x${r.overlapX.toFixed(0)}y${r.overlapY.toFixed(0)}`:" 칼선공유"}`:"-";
    rows.push({nm, got, how});
    console.log(nm.padEnd(22)+`${cut[0]}×${cut[1]}`.padEnd(11)+`${net.netW.toFixed(0)}×${net.netH.toFixed(0)}`.padEnd(15)+
      String(up).padStart(4)+String(got).padStart(4)+"  "+(got===up?"✓   ":`${got>up?"+":""}${got-up}   `)+how);
  }
  console.log("─".repeat(88)+`\n일치 ${hit}/${C.length}  (${(hit/C.length*100).toFixed(0)}%)`);
  if (die) console.log("  " + dieNote(C.map(([,W,D,H,t])=>[t,W,D,H])));
  // ★ 대표 숫자 — 원본 도면이 없는 건(미실측)은 분모에서 뺀다.
  if (die) console.log("  " + measuredOnly(dieRows).text);
  runs[key]={hit, rows};
}

// ══════════════════════════════════════════════════════════════════
//  노브 배선 게이트 — **폴리곤 수준**에서 본다
//
//  잡으려는 버그는 하나다: `opt.taper` 가 piecesFromFlaps 까지 안 닿는 것.
//  종전 {twoStage:false} 가 정확히 그 상태였고 두 표가 항상 같아서 아무도 몰랐다.
//
//  ★ 26-08-18 — 게이트를 「배치가 달라지는가」에서 「도형이 달라지는가」로 내렸다.
//    이유: 배치는 노브 배선의 **간접** 증거다. 도형이 정직하게 갈려도 판이 넉넉하면
//    up 이 같을 수 있고, 실제로 그 일이 일어났다 — 아래 띠를 목형 5벌 안전 봉투
//    [min(W,b)/2, b, min(W,b)/2, b] 로 올리자 15건의 배치가 **전부** 같아졌다
//    (테이퍼가 있으나 없으나 봉투 도형은 판에 같은 수로 들어간다).
//    그 상태에서 종전 게이트는 배선이 멀쩡한데도 exit 1 을 냈다 = 거짓 경보다.
//    조각 수·면적은 노브가 닿으면 **반드시** 갈리므로 이쪽이 참·거짓을 정확히 가른다.
//    (검산: {twoStage:false} 처럼 노브가 안 닿으면 두 도형이 동일해져 여기서 죽는다)
//  배치 차이는 계속 **찍는다** — 점수는 아니지만 「테이퍼가 up 을 바꾸는가」의 답이다.
// ══════════════════════════════════════════════════════════════════
const areaOf = pieces => pieces.reduce((s, p) => {
  let a = 0;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += p[j][0] * p[i][1] - p[i][0] * p[j][1];
  return s + Math.abs(a) / 2;
}, 0);
let wired = 0;
for (const [nm,W,D,H,t] of C) {
  const off = dielinePieces(W,D,H,t,{taper:false}).pieces, on = dielinePieces(W,D,H,t).pieces;
  if (off.length !== on.length || Math.abs(areaOf(off) - areaOf(on)) > 0.05) wired++;
}
console.log(`\n테이퍼 노브 배선: ${wired}/${C.length} 건에서 폴리곤이 실제로 달라진다` +
            (wired ? "  ✓" : "  ⚠ 노브가 죽었다 — opt 이름이 geometry.piecesFromFlaps 의 opt.taper 와 다른지 확인해라"));
if (!wired) process.exitCode = 1;

const diff = runs.off.rows.filter((r,i) =>
  r.got !== runs.on.rows[i].got || r.how !== runs.on.rows[i].how);
console.log(`테이퍼 노브가 배치까지 바꾸는 건: ${diff.length}건` +
            (diff.length ? "" : "  (판이 넉넉해 up 은 같다 — 배선 게이트는 위 줄이다)"));
for (const r of diff) {
  const b = runs.on.rows.find(x => x.nm === r.nm);
  console.log(`  · ${r.nm.padEnd(22)} ${r.got}up ${r.how}  →  ${b.got}up ${b.how}`);
}


// ═════════════════════════════════════════════════════════════════
//  ★ 목형별 노브 배선 게이트 — **죽은 손잡이 금지** (26-08-25)
//
//  위 테이퍼 게이트와 **같은 방식**이다: 배치(up)가 아니라 **폴리곤**이 갈리는지를 본다.
//  배치는 간접 증거라 판이 넘치면 노브가 살아있어도 up 이 같을 수 있다.
//
//  잡으려는 버그: `opt` 가 dielinePieces → st.flaps() 까지 안 닿는 것.
//  종전에 flaps 는 (W,D,H) 세 인자였고, 그 상태로 노브를 넣었다면 **netSize 만 바뀌고
//  그림은 표준으로 남는** 두 벌이 조용히 생겼다 — 그것이 이 저장소가 geometry.mjs
//  첫 줄에 적어 둔 「치수와 그림이 갈렸다」 고장과 정확히 같은 종류다.
//  (검산: dieline/index.mjs 의 `st.flaps(W,D,H,opt)` 에서 opt 를 빼면 여기서 죽는다)
// ═════════════════════════════════════════════════════════════════
// 노브마다 「폴리곤을 실제로 바꾸는 값」 두 개. 기본값과 같은 값만 고르면 게이트가
// 의미를 잃으므로 일부러 기본과 다른 값을 둔다(deepFlap far/near · 탭 12.03/24.03).
const PROBE = {
  // ⚠ **면적만 재면 far/near 를 못 가른다** — 둘은 같은 날개를 다른 패널에 달은
  //   거울상이라 면적이 같다(첫 구현이 이걸로 2/13 으로 죽었다). 그래서 좀표
  //   **서명**(정렬된 꼭짓점 목록)으로 비교한다 — 「다른 자리에 그려졌다」까지 잡는다.
  // 값 목록의 첫 칸 "" 는 **기본값**(옵션 미지정)이다. 세 값이 전부 달라야 통과.
  //   cross 는 기본이 24.03 이므로 후보에 24.03 을 넣으면 자기자신과 같아진다 — 넣지 마라.
  glue_3side: ["deepFlap", ["", "far", "near"]],
  cross:      ["glueTabW", ["", 12.03, 19.2]],
};
const sigOf = pieces => pieces
  .map(pl => pl.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" "))
  .sort().join(" | ");
let kn = 0, knTot = 0; const dead = [];
for (const [nm,W,D,H,t] of C) {
  const probe = PROBE[t]; if (!probe) continue;
  const [k, vals] = probe; knTot++;
  const sigs = new Set(vals.map(v =>
    sigOf(dielinePieces(W,D,H,t, v === "" ? {} : {[k]: v}).pieces)));
  if (sigs.size === vals.length) kn++; else dead.push(`${nm} (${k}: ${sigs.size}/${vals.length} 가지 도형)`);
}
console.log(`목형별 노브 배선: ${kn}/${knTot} 건에서 노브 값마다 폴리곤이 실제로 달라진다` +
            (kn === knTot ? "  ✓" : `  ⚠ 죽은 손잡이 — ${dead.join(" · ")}`));
if (kn !== knTot) process.exitCode = 1;
// 레지스트리(DIE_OPTS)가 광고하는 노브와 이 게이트가 검사하는 노브가 같은가.
// 화면은 DIE_OPTS 를 보고 위젯을 뿌리므로, 광고만 하고 아무것도 안 바꾸는 노브가
// 생기면 사용자가 만지는 헛바퀴가 된다 — 이 저장소가 삭제한 TONGUE_INSET 과 같은 함정.
for (const [t, knobs] of Object.entries(DIE_OPTS)) {
  if (!C.some(r => r[4] === t)) continue;
  for (const kk of knobs) if ((PROBE[t] || [])[0] !== kk.key) {
    console.log(`  ⚠ DIE_OPTS[${t}] 의 노브 「${kk.key}」가 이 게이트에 없다 — PROBE 에 추가해라`);
    process.exitCode = 1;
  }
}

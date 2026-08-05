// ══════════════════════════════════════════════════════════════════
//  이 파일은 src/domain/dieline/index.mjs 레지스트리를 **직접 import** 해서
//  등록된 전 구조를 순회한다. 구조 파일을 추가하면 검사가 자동으로 늘어난다.
//
//  왜 필요한가
//  ──────────
//  전개도 '크기'(netSize)와 '그림'(flaps→폴리곤)이 서로 다른 회귀식을 쓰던 시절,
//  폴리곤이 netH 보다 25~30% 작아서 **실제로는 불가능한 배치를 가능하다고 판정**했다.
//  NFP 엔진은 폴리곤을 입력으로 쓰므로 이 불일치는 조용히 up 을 과대평가한다.
//  그래서 아래 3개를 불변식으로 못박는다:
//      max(flaps.top) === netSize.topLid
//      max(flaps.bot) === netSize.botFloor
//      폴리곤 bbox    === netW × netH   (오차 0)
//  추가로 원점 정렬(bbox 좌하단 = 0,0)도 본다 — imposition 의
//  boxes[i].x = 물림 + cell.x 가 이 가정 위에 서 있다.
// ══════════════════════════════════════════════════════════════════
import { structures, getStructure, calcNetSize, getFlaps, dielinePieces }
  from "../src/domain/dieline/index.mjs";
import { bboxOf } from "../src/nest.mjs";

const EPS = 0.05;

// 규격 스윕 — 실측 칼선의 범위와 경계 케이스를 함께 넣는다.
//   D≤15  : 맞뚜껑A 92×13×140 (종전 공식이 여기서 갈라졌다)
//   D=7   : 삼면D (칼선 검증범위 밖)
//   대형   : 칼선-04 265.5×124×243
//   D>H   : G형 D/H>0.8 분기
const GRID = [
  [92, 13, 140], [82, 7, 126], [50, 50, 150], [90, 70, 130], [140, 43, 130],
  [210, 90, 180], [265.5, 124, 243], [46, 46, 138], [130, 130, 55],
  [220, 210, 110], [350, 280, 70], [40, 40, 133],
];

// 전개도 직접입력(direct)은 hidden 이라 structures() 에 안 나온다 — netW/netH 를
// 사용자가 주는 구조라서 opt 가 필요하다. 명시적으로 붙인다.
const IDS  = [...structures().map(s => s.id), "direct"];
const OPT  = { direct: { netW: 646, netH: 258 } };

let pass = 0; const fails = [];
const t = (label, cond) => { if (cond) pass++; else fails.push(label); };

console.log("═══ 구조 레지스트리 불변식 스윕 ═══════════════════════════════════════════");
console.log(`등록 구조 ${IDS.length}종 × 규격 ${GRID.length}건\n`);
console.log("구조".padEnd(14)+"폴리곤".padEnd(8)+"검사".padEnd(8)+"top=topLid  bot=botFloor  bbox=netW×netH  원점(0,0)");
console.log("-".repeat(96));

for (const id of IDS) {
  const st = getStructure(id);
  const opt = OPT[id] || {};
  let n = 0, okTop = 0, okBot = 0, okBox = 0, okOrg = 0, sized = 0;

  for (const [W, D, H] of GRID) {
    const net = calcNetSize(W, D, H, id, opt);
    if (!net) continue;                       // direct 는 netW/netH 없으면 null (정상)
    n++;
    t(`${id} ${W}×${D}×${H} netW>0`, net.netW > 0);
    t(`${id} ${W}×${D}×${H} netH>0`, net.netH > 0);
    if (net.netW > 0 && net.netH > 0) sized++;

    const flaps = getFlaps(W, D, H, id);
    if (st.polygon) {
      // 날개 최대 깊이가 곧 netH 를 만든 값이어야 한다. 어긋나면 그림과 크기가 갈린다.
      const maxTop = Math.max(...flaps.top), maxBot = Math.max(...flaps.bot);
      const hitTop = Math.abs(maxTop - net.topLid) <= EPS;
      const hitBot = Math.abs(maxBot - net.botFloor) <= EPS;
      if (hitTop) okTop++; if (hitBot) okBot++;
      t(`${id} ${W}×${D}×${H} max(top)=topLid`, hitTop);
      t(`${id} ${W}×${D}×${H} max(bot)=botFloor`, hitBot);
    } else {
      okTop++; okBot++;   // 폴리곤 미확정 구조는 날개가 없다 (직사각 1조각)
    }

    const dl = dielinePieces(W, D, H, id, opt);
    const b = bboxOf(dl.pieces);
    const hitBox = Math.abs(b.w - net.netW) <= EPS && Math.abs(b.h - net.netH) <= EPS;
    const hitOrg = Math.abs(b.x0) <= EPS && Math.abs(b.y0) <= EPS;
    if (hitBox) okBox++; if (hitOrg) okOrg++;
    t(`${id} ${W}×${D}×${H} bbox=netW×netH`, hitBox);
    t(`${id} ${W}×${D}×${H} 원점정렬`, hitOrg);
  }

  console.log(id.padEnd(14)+(st.polygon?"있음":"직사각").padEnd(8)+`${n}건`.padEnd(8)+
    `${okTop}/${n}`.padStart(9)+`${okBot}/${n}`.padStart(13)+
    `${okBox}/${n}`.padStart(15)+`${okOrg}/${n}`.padStart(12)+
    (sized === n ? "" : "  ⚠ 크기 0"));
}

console.log("-".repeat(96));
console.log(`불변식 ${pass}/${pass + fails.length} 통과`);
if (fails.length) {
  console.log(`\n✗ 위반 ${fails.length}건:`);
  for (const f of fails.slice(0, 30)) console.log(`  · ${f}`);
  if (fails.length > 30) console.log(`  … 외 ${fails.length - 30}건`);
  process.exitCode = 1;
}

// ── 레지스트리 계약 ────────────────────────────────────────────────
// 구조를 추가할 때 빠뜨리기 쉬운 필드를 여기서 잡는다.
console.log("\n═══ 레지스트리 계약 ═══════════════════════════════════════════════════════");
let cOk = 0;
const CONTRACT = [];
for (const id of IDS) {
  const st = getStructure(id);
  const rows = [
    ["id 일치",        st.id === id],
    ["label 있음",     typeof st.label === "string" && st.label.length > 0],
    ["netSize 함수",   typeof st.netSize === "function"],
    ["flaps 함수",     typeof st.flaps === "function"],
    ["polygon 불리언", typeof st.polygon === "boolean"],
    ["폴리곤이면 flaps 반환", !st.polygon || !!st.flaps(100, 50, 120)],
  ];
  for (const [k, ok] of rows) { if (ok) cOk++; else CONTRACT.push(`${id}: ${k}`); }
  console.log(`  ${rows.every(r => r[1]) ? "✓" : "✗"} ${id.padEnd(12)} ${st.label}` +
              `${st.thomsonDefault ? `  · 톰슨 기본 ${st.thomsonDefault}` : ""}` +
              `${st.hidden ? "  · hidden" : ""}`);
}
console.log(`계약 ${cOk}/${cOk + CONTRACT.length} 통과`);
for (const c of CONTRACT) console.log(`  ✗ ${c}`);
if (CONTRACT.length) process.exitCode = 1;

console.log(`\n※ 알 수 없는 구조 id 는 null 이어야 한다 (종전 default 분기 D/2+20 은 되살리지 않는다)`);
const unknownOk = calcNetSize(100, 50, 120, "존재하지않는구조") === null
               && getStructure("존재하지않는구조") === null
               && dielinePieces(100, 50, 120, "존재하지않는구조") === null;
console.log(`  ${unknownOk ? "✓" : "✗"} calcNetSize / getStructure / dielinePieces 전부 null`);
if (!unknownOk) process.exitCode = 1;

// ══════════════════════════════════════════════════════════════════
//  showroom-core.mjs — 쇼룸(전시회용) 페이지의 **React 아닌 부분** 전부.
//
//  왜 이 파일이 따로 있나
//  ────────────────────
//  ShowroomPage.jsx 는 「그리기 + 포인터」만 하게 두고, 「무엇을 그릴지 정하는
//  판단」은 여기 모은다. 판단이란 셋뿐이다:
//    ① 도면 한 장 → 충돌 부품 P + 그릴 윤곽   (partOf)
//    ② 자동 배치 결과 중 **무엇을 채택하나**   (autoPlace / fillMore)
//    ③ 그 배치를 **그려도 되는가**             (auditItems ← ★ 겹침 게이트)
//  ③ 이 이 파일의 존재 이유다. 겹친 배치를 고객 앞에서 그리면 신뢰를 잃는다 —
//  그래서 「그리기 직전에 재는」 함수를 화면 코드 밖에 두고 반드시 통과시킨다.
//
//  ★ 새 기하를 한 줄도 짜지 않는다.
//    · 자동 배치 = nest-free.solveFree (이미 있다)
//    · 손배치 스냅·겹침 = ui/viz/nest-drag.mjs (이미 있다)
//    · 판 = imposition.printableArea (도메인 정의 그대로)
//    · 단가 = domain/quote.buildQuote (**도메인 수정 0줄** — up 은 기존
//      overrides.up 통로로만 흘린다: state.mUp/mUpV → toQuoteInput)
//    이 파일이 실제로 소유하는 것은 「어느 해를 고르나」와 「표준 사양 한 벌」뿐이다.
//
//  배치 1개의 규약은 세 모듈이 **이미 같다** — {x, y, flipped, rotated},
//  x·y 는 발자국 bbox 좌상단, 판 좌표 mm, y 아래로.
//    solveFree 가 내는 items · nest-drag 가 끄는 items · imposition 의 layout.boxes
//  그래서 어댑터가 필요 없다. (layout.boxes 만 w/h/idx 를 더 갖고 있어 아래
//  seedOf 에서 네 필드만 뽑는다 — 그것이 유일한 변환이고 한 줄이다.)
// ══════════════════════════════════════════════════════════════════
import { BASE_SHEETS } from "../domain/data/sheets.mjs";
import { printableArea } from "../domain/imposition.mjs";
import { INITIAL_STATE, toQuoteInput } from "../ui/state.mjs";
import { solveFree, fillGaps } from "../nest-free.mjs";
import {
  makeDragPart, pdfLocalPolylines, overlapPairs, boundsCheck,
} from "../ui/viz/nest-drag.mjs";

// ══════════════════════════════════════════════════════════════════
//  판 (sheet)
// ══════════════════════════════════════════════════════════════════

/** 고를 수 있는 판형. 주문생산(custom)은 크기 입력이 따로 필요해 쇼룸에서 뺀다 —
 *  「항목을 최소로」가 이 화면의 규칙이다. */
export const SHEET_CHOICES = BASE_SHEETS.filter(b => b.id !== "custom");

/**
 * 판 한 장의 두 좌표계. **하나로 합치지 마라** — SheetCanvas 가 같은 이유로 둘을 쓴다.
 *  · draw : 눈에 보이는 판 = 인쇄기 990×720 클램프 후 실제로 걸리는 면
 *  · fit  : 배치 판정면 = printableArea (FIT_TOL 여유 포함). 이걸로 재야
 *           도메인이 푼 격자 배치를 씨앗으로 받았을 때 「판 밖」이 뜨지 않는다.
 */
export function frameOf(sheet) {
  const pa = printableArea(sheet);
  return { sheet, drawW: pa.long, drawH: pa.short, capped: pa.capped,
           fitW: pa.printW, fitH: pa.printH };
}

// ══════════════════════════════════════════════════════════════════
//  도면 한 장 → 충돌 부품 + 그릴 윤곽
// ══════════════════════════════════════════════════════════════════

/**
 * @param {{kind:"pdf", pick:Object} | {kind:"box", dieline:Object}} source
 * @returns {{P, cuts, folds, glue, w:number, h:number}|null}
 *   cuts  = 칼선(실선)  folds = 오시선(파선)  glue = 접착면(톤/해칭) 폴리곤
 *
 * ⚠ 그림(cuts)과 충돌 도형(P)은 **같은 출처**여야 한다. 갈리면 「닿아 보이는데
 *   안 놓이는」 자리가 생기고 눈으로는 못 잡는다 (nest-drag 머리말과 같은 규칙).
 *
 * 선 3종을 **여기서** 가른다 (화면은 받은 배열을 종류별로 그리기만 한다):
 * 도면 표기는 「무엇을 그릴지 정하는 판단」이고 그 판단은 이 파일이 소유한다.
 */
export function partOf(source) {
  if (!source) return null;
  if (source.kind === "pdf") {
    const pick = source.pick;
    const polylines = pdfLocalPolylines(pick);          // 페이지 절대좌표 → 판 로컬
    if (!polylines?.length) return null;
    const P = makeDragPart({ polylines, w: pick.bbox.w, h: pick.bbox.h });
    // PDF 는 칼선/접는선이 구분돼 오지 않는다 — 온 그대로 그린다(그게 실물이다).
    //   실측 6건(고객사 5곳·구조 2종)을 콘텐트 스트림에서 세어 확정했다: dash 연산자(d) 0회,
    //   선굵기(w) 파일당 1회, 색(K) 1회, stroke(S) 1~2회 — 칼선과 오시선이 **한 그래픽
    //   상태의 서브패스**로 한 번에 그려진다. 읽을 스타일이 아예 없다. 접착면 표기(해칭·톤·
    //   Pattern)도 0건, 「접착」「오시」 글자도 0건. 그래서 folds·glue 는 빈 배열이고,
    //   화면은 그 사실을 **글로 적는다**(T.srcPdf) — 안 적으면 고객이 「오시선이 없는
    //   박스」로 읽는다. ⚠ 「내부 직선이면 오시선」으로 유추하지 마라: iSHAP 2건은
    //   stroke 가 1개뿐이고 채택 칼선이 아트워크 색면의 윤곽이다(조용히 틀린 도면이 된다).
    return P ? { P, cuts: polylines, folds: [], glue: [], w: P.w, h: P.h } : null;
  }
  const dl = source.dieline;
  if (!dl?.pieces?.length) return null;
  const P = makeDragPart({ pieces: dl.pieces, w: dl.net.netW, h: dl.net.netH });
  if (!P) return null;
  // ── 접착면 = 접착탭 **하나만** ──────────────────────────────────
  //  접착탭은 도메인이 **이미 표시해 준다**(meta 의 part:"tab"). 새 기하 0줄.
  //  ⚠ cuts 에서 집으면 안 된다 — meta 는 pieces 와 인덱스가 정렬이지만 cuts 는 아니다
  //    (addFlap 이 조각 2개에 칼선 1개를 밀고, 날개 없는 경계·좌측 최외곽 칼선을 따로 민다).
  //
  //  실측이 이 자리를 확정했다(칼선 6건 6/6 오차 0.00): 패널 폭이 좌→우
  //  [접착탭 15.00][W][D][W][D−0.70] 이고 합이 정확히 2(W+D)+14.30 이다. 즉
  //  geometry.GLUE_TAB=14.3 은 「탭 폭」이 아니라 **탭 15.0 − 마지막 패널의 0.7 부족분**
  //  이다(netW 공식은 결과적으로 정확하므로 상수는 그대로 맞다). ★ 그래서 화면에
  //  「접착탭 14.3mm」라고 **숫자를 쓰지 않는다** — 실물 탭은 15.0mm 이고, 고객에게
  //  어긋난 숫자를 말하게 된다. 범례는 이름만 쓴다.
  //
  //  ⚠ 우리 도면은 실측 도면의 **좌우 거울상**이다. 우리 xEdges 는 [D, W, D, W, 탭] 로
  //    탭이 **오른쪽**이고 실측은 [탭, W, D, W, D−0.7] 로 **왼쪽**이다(뒤집으면 일치).
  //    이번에는 뒤집지 않는다 — 폴리곤·배치·검증 전부가 이 프레임 위에 서 있고 bbox·up·
  //    금액에는 영향이 없다. 표기에는 딱 하나 영향이 있다: 「접착탭이 붙는 상대면」이
  //    우리 프레임에서는 **왼쪽 끝 패널0** 이다. 그런데 아래 이유로 어차피 안 그린다.
  //
  //  ⚠ **상대면은 표시하지 않는다.** 기하적으로는 패널0 이지만, 실제로 풀이 닿는 것은
  //    그 면의 **뒷면**이다. 이 화면은 인쇄면(앞면)을 그리므로 앞면에 해칭을 얹으면
  //    거짓 표기다. ⚠ **아래 날개 접착(자동바닥)도 표시하지 않는다.** 삼면접착이
  //    측면1 + 바닥2 로 세 면이 붙는 것은 맞지만, 어느 날개가 붙는지는 flaps.bot
  //    프로파일이 알아야 하고 그 프로파일이 실측과 어긋나 있다(실측은 W 패널이 깊고
  //    우리는 D 패널이 깊다). 지금 그리면 **틀린 확언**이 된다 — 프로파일을 실측으로
  //    고친 뒤에 붙여라.
  const gi = (dl.meta || []).findIndex(m => m.part === "tab");
  return { P, cuts: dl.cuts || [], folds: bodyFolds(dl),
           glue: gi >= 0 ? [dl.pieces[gi]] : [],
           w: P.w, h: P.h };
}

/**
 * 오시선을 **몸통 구간으로 자른다.** 도메인 수정 0줄 — 이건 그리기 판단이다.
 *
 * 실측(칼선 6건 6/6): 세로 오시선의 y 범위는 **몸통 높이 그대로**다. 몸통 = 위 오시선
 * ~ 아래 오시선 = [net.topLid, net.netH − net.botFloor] 이고, 실행값으로 그 폭이 정확히
 * H 다(삼면 140×43×130 → 130.00 · 삼면 50×50×150 → 150.00 · 맞뚜껑 150×15×150 → 150.00
 * · 십자 70×70×55 → 55.00). 날개 쪽은 실물에서 니크(0.89mm)로 끊긴 **별개 세그먼트**다.
 *
 * 반면 우리 folds 는 「양쪽 날개가 겹치는 깊이까지」 이어져 띠를 관통한다
 * (삼면 140×43×130 의 x=43 → [[43,0],[43,171.61]]). 자르지 않으면 두 가지가 생긴다:
 *   ① 칼선 위에 파선을 겹쳐 그린다 — 그 구간이 날개의 **옆면 칼선**과 좌표가 같다
 *      (geometry.addFlap 이 [x0,base]→[x0,yF] 를 cuts 에 민다). 「잘리는 선」을
 *      「접히는 선」이라고 두 번 말하는 셈이다. 실측: 몸통밖 159.63mm 중 127.35mm.
 *   ② **종이 밖에 선이 뜬다** — 날개가 테이퍼로 좁아진 구간에는 도형이 없다.
 *      실측: 32.25mm(삼면 140×43×130) · 34.05mm(50×50×150). 오시선을 진하게
 *      만드는 이번 변경이 이걸 그대로 두면 도면이 아니라 낙서로 보인다.
 * 세로 오시선은 언제나 몸통을 관통하므로 잘려서 사라지는 선은 없다(가로 오시선은
 * y 가 이미 경계값이라 무변화). 그래도 길이 0 은 그리지 않는다.
 */
function bodyFolds(dl) {
  const folds = dl.folds || [];
  const b0 = dl.net?.topLid, b1 = (dl.net?.netH ?? 0) - (dl.net?.botFloor ?? 0);
  if (!(Number.isFinite(b0) && Number.isFinite(b1) && b1 - b0 > 0.05)) return folds;
  const out = [];
  for (const f of folds) {
    const c = f.map(([x, y]) => [x, y < b0 ? b0 : y > b1 ? b1 : y]);
    if (c.some(([x, y], i) => i > 0 && (Math.abs(x - c[i - 1][0]) > 1e-6 ||
                                        Math.abs(y - c[i - 1][1]) > 1e-6))) out.push(c);
  }
  return out;
}

/**
 * 충돌 도형의 정밀도를 **한 줄로** 말한다. 근사면 근사라고 적는다 —
 * 숨기면 고객이 「정확한 배치」로 읽는다. 문구는 T(언어사전)가 갖는다.
 *
 * ★ `"exact"`(= 구조 폴리곤 = **치수 입력 경로**)는 **null 이다. 문구를 내지 않는다.**
 *   이 함수가 재는 것은 「PDF 폴리라인을 볼록 조각으로 분해할 때 근사가 끼었는가」이고
 *   그것은 **배치 판정 도형**의 정밀도다. 치수 입력 경로에서는 그 분해가 없으니 언제나
 *   "exact" 인데, 그걸 「근사 없음」이라고 화면에 적으면 **그림의 정밀도**를 말하는 것으로
 *   읽힌다. 그리고 그림은 근사다 — 같은 화면의 출처 줄이 「날개 모양은 표준형 근사입니다」
 *   라고 적고 있다. 두 줄이 같은 크기·같은 대비로 173px 떨어져 마주 서면 더 확언조인
 *   쪽(「근사 없음」)이 이기고, 고객은 우리 근사를 실측으로 읽는다. 적대검증 major 였다.
 *   ⚠ G형·G형트레이는 더 나쁘다 — 그 두 구조는 폴리곤이 확정돼 있지 않아 전개도가
 *     **빈 직사각형 하나**인데(dieline/index.mjs `!st.polygon`), 도형이 사각형이므로
 *     mode 는 여전히 "exact" 다. 「근사 없음」이 붙은 빈 네모가 뜬다.
 *   치수 경로의 정직성은 출처 줄(srcBox / srcOutline)이 소유한다. 두 곳에서 말하지 않는다.
 */
export const precisionKeyOf = mode =>
  mode === "stitched" ? "pStitched" : mode === "raster" ? "pRaster"
  : mode === "hull" ? "pHull" : mode === "bbox" ? "pBbox" : null;

// ══════════════════════════════════════════════════════════════════
//  ★ 겹침 게이트 — 그리기 전에 **반드시** 통과해야 한다
// ══════════════════════════════════════════════════════════════════

/**
 * 이 배치를 그려도 되는가. overlapPairs 는 **겹친 칸의 인덱스 Set** 을 준다
 * (쌍 배열이 아니다 — BoxSpec.handWarn 이 같은 실수를 한 이력이 있다).
 * @returns {{overlap:Set<number>, off:number[], ok:boolean}}
 */
export function auditItems(P, items, frame) {
  if (!P || !items?.length) return { overlap: new Set(), off: [], ok: true };
  const overlap = overlapPairs(P, items);
  const { off } = boundsCheck(P, items, { w: frame.fitW, h: frame.fitH });
  return { overlap, off, ok: overlap.size === 0 && off.length === 0 };
}

// ══════════════════════════════════════════════════════════════════
//  자동 배치
// ══════════════════════════════════════════════════════════════════

/** 자유배치 탐색 예산(겹침 판정 횟수). 실측(test-pdf 3건 · 구조 4건 × 판형 3개)에서
 *  최대 14만 회 · 153ms 였다. 200만이면 그 10배가 넘어 실무 범위를 덮는다.
 *  ⚠ 시간(ms)이 아니라 횟수로 끊는 이유는 nest-free 머리말 「결정성」 참조. */
export const AUTO_OPS = 2_000_000;

/** layout.boxes(도메인 격자해) → 배치 규약 4필드. 이 한 줄이 유일한 변환이다. */
export const seedOf = boxes => (boxes || []).map(b =>
  ({ x: b.x, y: b.y, flipped: !!b.flipped, rotated: !!b.rotated }));

/**
 * 자동 배치 — ★ **격자해가 먼저다.** 「큰 쪽」이 아니다.
 *
 * 왜 둘을 다 돌리나: 격자(nest.solveLayout)는 규칙격자만 만들고 자유(solveFree)는
 * 최적을 보장하지 않는다. 어느 하나가 항상 이기지 않는다 — 실측에서 자유가 이긴 건
 * (t-wake2 p0 국2 6 vs 4 · 십자 4×62 7 vs 6), 격자가 이긴 건도 있다.
 *
 * ── 왜 「큰 쪽 무조건 채택」을 버렸나 (26-08-19 · 적대검증 major ②) ─────────
 *  실측: 삼면접착 140×43×130 · 295AB · 4,000 에서 **같은 링크인데** 두 화면 금액이
 *  갈렸다 — 국2 견적서 312원(격자 2up) vs 쇼룸 240원(자유 3up) −23% / 하3 263 vs 216
 *  −18% / 46 259 vs 243 / 하전지 296 vs 277. 10판형 중 4~6.
 *  방향이 **「고객 앞 화면이 실제 견적보다 싸다」**다. 이 프로젝트에서 그건 최악의
 *  방향이다(브리핑: up 이 늘면 앱이 싸게 부른다 = 영업 위험).
 *  게다가 실무앱은 스스로 이렇게 적어 두고 있었다(BoxSpec.jsx):
 *    「견적은 규칙격자 기준이다. 자유배치는 실행한 뒤 「손배치로 이어받기」로
 *      확정해야 up 에 반영된다.」
 *  즉 **자유해는 사람이 확정해야 청구값이 된다**는 규칙이 이미 있었고, 쇼룸만 그
 *  규칙을 안 지키고 자유 up 으로 금액을 냈다. 규칙을 쇼룸에도 적용한다:
 *    · 기본 채택 = 격자해  → 두 화면이 **언제나 같은 금액**을 말한다
 *    · 자유해는 **버림이 아니다** — freeItems 로 돌려주고 화면이 「자유 배치 N up
 *      채택」 버튼으로 낸다. 누르면 그때 up 이 오르고, 돌아가는 링크가 그 up 을
 *      판걸이 직접입력으로 실어 견적서도 같은 수로 청구한다(capToQuoteUp 과 짝).
 *  덜 보여주는 것이 아니라 **확정 절차를 갖춘 것**이다. 되돌리지 마라: 되돌리면
 *  고객 앞 화면이 청구보다 싼 금액을 말하는 상태로 돌아간다.
 *
 * ★ 고른 뒤 **다시 잰다**(auditItems). 통과 못 하면 그 해를 버리고 다음 해로
 *   내려간다 — 겹친 배치를 그리느니 up 이 적은 편이 낫다.
 * ⚠ 격자해가 0장이면(도메인이 이 판에 못 앉힌 경우) 자유해로 내려간다. 그때는
 *   견적서 쪽에 청구할 up 이 아예 없으므로 「싸게 부른다」가 성립하지 않는다.
 */
export function autoPlace(P, frame, gridBoxes) {
  const t0 = now();
  const grid = seedOf(gridBoxes);
  const free = solveFree(P.pieces, frame.fitW, frame.fitH, { ops: AUTO_OPS });
  const freeRaw = free?.items?.length ? free.items : [];
  // 자유해도 게이트를 통과해야 **제안**할 수 있다 — 통과 못 한 해를 버튼으로 내면
  // 누르는 순간 commit 이 거절해 「버튼이 먹지 않는다」가 된다.
  const freeOk = freeRaw.length > 0 && auditItems(P, freeRaw, frame).ok;

  // ★ 순서가 정책이다 — 격자 먼저. (정렬하지 마라: 종전 sort 가 큰 쪽을 올렸다)
  const cands = [];
  if (grid.length)  cands.push({ items: grid,    via: "grid" });
  if (freeRaw.length) cands.push({ items: freeRaw, via: "free" });

  let chosen = null, rejected = 0;
  for (const c of cands) {
    if (auditItems(P, c.items, frame).ok) { chosen = c; break; }
    rejected++;                       // 정상 동작에서는 0 이다. 0 이 아니면 숨기지 않는다.
  }
  return {
    items: chosen?.items ?? [], up: chosen?.items.length ?? 0, via: chosen?.via ?? null,
    gridUp: grid.length,
    // freeUp 은 **제안 가능한 수**다 — 게이트를 못 넘은 자유해는 0 으로 접는다.
    // (종전에는 free.up 을 그대로 실어서, 그릴 수 없는 해의 수를 화면이 자랑했다.)
    freeUp: freeOk ? freeRaw.length : 0, freeItems: freeOk ? freeRaw : [],
    rejected, budgetHit: !!free?.budgetHit, ms: Math.round(now() - t0),
  };
}

/**
 * 견적서가 판걸이를 **고정해서 보내왔으면**(판걸이 직접입력) 자동해를 그만큼만 남긴다.
 *
 * 왜 필요한가 — 왕복 고리가 안 닫힌다. 「쇼룸에서 배치를 3up 으로 바꿔 → 견적서로
 * 복귀(판걸이 직접입력 3 이 켜진다) → 다시 고객 화면으로」 에서 쇼룸이 스스로 다시
 * 풀면 4up 으로 되돌아가, **견적서 3up 247원 · 쇼룸 4up 204원** 이 된다.
 * 이번에 고친 고장(같은 박스, 갈린 금액)의 재발이고, 방향이 「앱이 싸게 부른다」다.
 *
 * ⚠ 고정값이 실제로 들어가는 수보다 **많으면 줄이지 않는다** — 없는 자리를 그릴 수는
 *   없다. 겹치거나 판 밖인 그림을 만들지 않는다는 계약이 우선이고, 그때는 화면이
 *   실제로 앉는 수를 말한다(그 수가 견적서와 다르면 견적서 쪽이 물리적으로 틀렸다).
 * ⚠ 앞에서 잘라낸다 — 자동해의 순서가 곧 배치 순서라 앞쪽이 판의 시작 모서리다.
 *   남는 칸을 뒤에서 지우는 편이 「판 한쪽에 몰아 건다」는 실무 감각과 맞는다.
 */
export const pinnedUpOf = carried =>
  (carried?.mUp ? (parseInt(carried.mUpV, 10) || 0) : 0);

export function capToQuoteUp(carried, items) {
  const n = pinnedUpOf(carried);
  return (n > 0 && items?.length > n) ? items.slice(0, n) : items;
}

/**
 * ★ 자동 배치의 씨앗 — 실려 온 판걸이 고정값을 **복원**한다 (26-08-19 major ⑨)
 *
 * 무엇이 고장나 있었나 — 실브라우저 실측 (국2 · 삼면접착 140×43×130 · AB295L · 4,000):
 *   쇼룸 2up 312원 → 「자유 배치 3up 채택」 → 3up 240원(해시 mUp~1;mUpV~3)
 *   → 견적 앱으로 → 견적서 3up 240원 ✓ → **다시** 고객 화면으로
 *   → 쇼룸이 2up 312원으로 돌아가고 주소에서 mUp 이 사라진다 → 견적서 2up 312원.
 *   Δ **+72원/개(+30%)**. 운영자가 확정한 값이 **경고 한 줄 없이** 되돌아갔다.
 *
 * 원인은 두 겹이었다:
 *   ① autoPlace 가 격자 우선이라 재진입 때 3up 을 다시 앉히지 못한다(정책은 옳다 —
 *      고객 앞 화면이 청구보다 싸면 안 된다). capToQuoteUp 은 **자르기만** 하므로
 *      2 < 3 에서 아무 일도 하지 않는다.
 *   ② 그 상태에서 linkStateOf 의 `useUp = up !== gridUp` 이 2 === 2 로 거짓이 되어
 *      실려 온 mUpV="3" 을 "" 로 덮었다.
 *
 * ★ 고치는 자리를 ① 로 택한 이유 — ② 만 고치면(실려 온 값을 그냥 유지) **청구 3up ·
 *   그린 2up** 이 되고, 그건 청구가 그림보다 **싼** 쪽이다(240 < 312). 이 프로젝트가
 *   금지한 방향이고, upGateOf 가 경고를 띄우더라도 「그릴 수 없는 수로 청구」가 남는다.
 *   ① 로 고치면 쇼룸이 **3up 240원을 그대로 다시 그린다** — 두 화면이 같은 값을 말하고
 *   (§13 의 존재 이유) linkStateOf 는 손대지 않아도 3 !== 2 라서 mUpV 를 스스로 싣는다.
 *
 * ★ 「자동 재계산 금지」를 깨지 않는다 — 새 수를 **찾는** 것이 아니라 운영자가 이미
 *   확정했던 수를 **되돌리는** 것이다. 자유해는 결정적이고(verify-autonest 7seed)
 *   같은 입력이면 같은 items 가 나오므로 복원이 성립한다. 그리고 그 자유해는
 *   autoPlace 에서 이미 auditItems 를 통과한 것만 freeItems 로 온다(겹침 0 보장).
 *
 * ⚠ 복원에 **실패할 수 있다** — 사람이 손으로 끌어 만든 배치는 자유해가 재현하지
 *   못한다. 그때는 격자해를 앉히고 `shortOf` 로 알린다. 조용히 되돌리지 않는 것이
 *   이 함수의 절반이다. 방향은 「비싸지는 쪽」이므로 안전하고(2up 312원),
 *   그림 없는 3up 을 청구하는 것보다 이쪽이 옳다.
 *
 * @param {Object|null} carried 실려 온 상태 한 벌
 * @param {Object} r autoPlace 결과
 * @returns {{items:Array, restored:number, shortOf:number}}
 *   restored>0 자유해로 고정값을 복원했다 · shortOf>0 고정값에 못 미친다(그 값)
 */
export function seedFromAuto(carried, r) {
  const n = pinnedUpOf(carried);
  if (n > (r?.gridUp || 0) && r?.freeItems?.length >= n)
    return { items: r.freeItems.slice(0, n), restored: n, shortOf: 0 };
  const items = capToQuoteUp(carried, r?.items || []);
  return { items, restored: 0, shortOf: n > items.length ? n : 0 };
}

/**
 * 사람이 앉힌 배치는 **한 칸도 옮기지 않고** 빈자리에만 더 넣는다.
 * fillGaps 가 그 계약을 갖고 있고, 여기서는 결과를 다시 재기만 한다.
 */
export function fillMore(P, frame, items) {
  const t0 = now();
  const r = fillGaps(P.pieces, frame.fitW, frame.fitH, items, { ops: AUTO_OPS });
  const out = r?.items;
  if (!out || !auditItems(P, out, frame).ok)
    return { items, added: 0, ok: false, ms: Math.round(now() - t0) };
  return { items: out, added: r.added, ok: true, ms: Math.round(now() - t0) };
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

// ══════════════════════════════════════════════════════════════════
//  단가 — 도메인 수정 0줄
// ══════════════════════════════════════════════════════════════════

/**
 * 쇼룸 **단독 진입**(사양이 안 실려 온 경우)의 표준 사양 한 벌.
 * **화면에 그대로 적어서 보여준다**(T.specLine) — 숨은 가정으로 단가를 내면
 * 고객이 다른 사양의 값으로 읽는다.
 * 값은 실무 표준(★ 개당 204원 회귀 케이스와 같은 사양: 원색 4도 · IR · 단면접착)이다.
 *
 * ⚠ 견적서에서 사양이 실려 오면 **이 값은 한 칸도 쓰이지 않는다** — 실려 온 상태
 *   한 벌이 통째로 base 가 된다(baseOf). 종전에는 base 가 늘 이거라서, 견적서가
 *   295AB 를 잡아도 쇼룸은 AB350 으로 계산해 204원 vs 223원이 나왔다.
 * ⚠ STD 를 고치면 T.specLine 의 손글씨 문구가 낡는다. 그 둘이 어긋나지 않는지는
 *   test/verify-speclink §C 가 실제 견적 라인과 대조해 잡는다.
 */
export const STD = {
  paperId: "AB350",        // AB 350g — 앱 기본값과 같다
  fpColor: true, fpSp: "0", fpBk: false, fpUv: false,   // 앞면 원색 4도
  bpColor: false, bpSp: "0", bpBk: false, bpUv: false,  // 뒷면 없음
  beda: false, fcId: "ir", bcId: "none",                // IR 코팅 (앞면)
  glueId: "dan", thomId: "n",                           // 단면접착 · 일반 톰슨
  hang: false, mR: false, mPrice: false, lossSheets: "",
};

/** 계산의 바탕이 되는 상태 한 벌 — 실려 온 사양이 있으면 **그것**, 없으면 표준사양.
 *  「없으면 표준사양」이 쇼룸 단독 진입(#showroom)이 종전 그대로 도는 이유다. */
export const baseOf = carried => carried || { ...INITIAL_STATE, ...STD };

/**
 * 쇼룸 상태 → QuoteInput.
 *
 * ★ 새 도메인 경로를 만들지 않는다. 기존 UI 변환기(ui/state.toQuoteInput)에
 *   **상태 한 벌**을 얹어 넘길 뿐이고, 판걸이는 **기존 직접입력 통로**
 *   (mUp/mUpV → overrides.up → quote.decideSheet ① 분기)로만 흘린다.
 *   그 분기가 R = calcR(up, …) 을 다시 재므로 지대R·금액이 자동으로 따라온다.
 *
 * ★ `carried` 가 이번 연동의 전부다. 견적서에서 실려 온 상태를 base 로 깔고,
 *   쇼룸이 **화면에서 실제로 만질 수 있는 것만** 그 위에 덮어쓴다(구조·치수·판형·
 *   수량·판걸이). 도수·지종·코팅·후가공·톰슨·접착·개발비는 덮어쓰지 않으므로
 *   base 값이 그대로 산다 — 이게 「몇 도 인쇄가 연동 안 된다」의 수리다.
 *
 * ⚠ up 을 넘기려면 판형이 **구체적인 id** 여야 한다. decideSheet ① 은 "auto" 를
 *   받으면 BASE_SHEETS[3](4×64)로 떨어뜨린다 — 화면에 그린 판과 다른 판으로 값이
 *   나가는 사고다. 그래서 호출부가 resolvedSheetId 를 넘긴다.
 * ⚠ mUp 은 **늘 덮어쓴다**(up 이 0 이면 끄는 쪽으로). 견적서에서 판걸이 직접입력을
 *   켜둔 채 넘어왔을 때 그 값이 남아 있으면, 판을 고르는 호출(up:0)이 그 옛 up 으로
 *   판형을 정해 **화면에 그린 판과 다른 판**의 금액이 나간다.
 */
export function quoteInputOf({ mode, boxType, W, D, H, netW, netH, sheetId, qty, up, carried }) {
  return toQuoteInput({
    ...baseOf(carried),
    sizeMode: mode === "box" ? "box" : "net",   // "pdf"·"net" 은 둘 다 전개도 직접입력이다
    boxType,
    bW: String(W ?? ""), bD: String(D ?? ""), bH: String(H ?? ""),
    nW: String(netW ?? ""), nH: String(netH ?? ""),
    sheetId: sheetId || "auto",
    qty: String(qty ?? ""),
    mUp: up > 0, mUpV: up > 0 ? String(up) : "",
  });
}

// ══════════════════════════════════════════════════════════════════
//  ★ 쇼룸 화면 → 해시에 실을 상태 한 벌 (26-08-19)
// ══════════════════════════════════════════════════════════════════
/**
 * 왜 함수 하나인가 — 쇼룸이 해시를 **두 곳**에 쓴다:
 *   ① 「견적 앱으로 →」 링크        (route "")
 *   ② 주소창 동기화(새로고침 대비)  (route "showroom")
 * 두 곳에서 따로 조립하면 조용히 갈린다 — 그러면 「새로고침하면 값이 달라진다」가
 * 되고, 그건 이번에 고치는 고장(④)과 같은 종류다. 조립은 여기 한 곳이다.
 *
 * ⚠ **sheetId 는 인자다.** 두 용도가 일부러 다른 값을 넣는다:
 *   ① 견적 앱으로  → **해석된 실제 판형 id**(4x62 …). "auto" 를 실으면 안 된다.
 *   ② 주소창 동기화 → **드롭다운 값 그대로**("auto" 면 auto). 새로고침했을 때
 *      운영자가 고른 「자동」이 조용히 고정으로 바뀌면 안 된다.
 *
 * ★ ① 이 「해석된 id」여야 하는 이유 — 실측 critical(26-08-19):
 *   견적서 자동(→4×62) 204원 4up → 쇼룸 → 칸 1개 삭제(3up 247원) → 견적 앱으로.
 *   종전에는 판형을 드롭다운 값 그대로 "auto" 로 실었고, 같은 링크에 판걸이
 *   직접입력(mUp~1;mUpV~3)이 함께 실린다. 견적서에서 그 조합은 decideSheet ①
 *   분기로 들어가고 그 분기는 `findSheetBase("auto") || BASE_SHEETS[3]` 이므로
 *   **판이 4×64(394×545)로 통째로 갈아치워진다** → 176원. Δ −71원/개(−29%),
 *   경고 없음, 방향은 「앱이 싸게 부른다」. 즉 **화면에 그린 판과 다른 판으로 청구**된다.
 *   종전 주석은 「풀린 id 로 바꿔 실으면 판형이 자동→고정으로 바뀌어 뒤에 치수를
 *   만져도 판이 안 따라간다」며 이 선택을 반대했는데, 그 대가(드롭다운을 「자동」으로
 *   한 번 되돌리면 끝이고 화면에 그대로 보인다)와 29% 저가 청구를 맞바꾼 셈이었다.
 *   ⟹ 그린 판을 싣는다. 「그린 판 = 청구 판」이 두 코드경로가 우연히 같은 답을
 *      내주기를 바라는 것이 아니라 **항등식**이 된다.
 */
export function linkStateOf({ carried, mode, boxType, bW, bD, bH, netW, netH,
                              sheetId, qty, up, gridUp }) {
  // ⚠ 판걸이(up)는 **격자해와 다를 때만** 직접입력으로 넘긴다. 같으면 앱이 스스로
  //   같은 값을 내므로 override 를 켤 이유가 없다 — 켜두면 나중에 앱에서 치수를
  //   바꿨을 때 낡은 up 이 남아 조용히 틀린 금액이 된다.
  //
  // ★ 「계산에 쓸 up」과 「링크에 실을 up」을 가르라는 지적을 받고 **가르지 않기로
  //   했다** (26-08-19 major ⑨). 둘 다 `up` = **화면에 실제로 그린 수**다.
  //   가르는 안은 「실려 온 고정값(carried.mUpV)을 화면이 못 그렸어도 링크에는 계속
  //   싣는다」였고, 그러면 국2 에서 **그린 2up · 청구 3up = 312원 그림에 240원 청구**가
  //   된다. 청구가 그림보다 **싼** 쪽이고 이 프로젝트가 금지한 방향이다(브리핑).
  //   고장의 본체는 링크가 아니라 **재진입 때 확정값을 되살리지 못한 것**이었고,
  //   그건 seedFromAuto 가 앞단에서 고친다 — 되살아나면 up 3 ≠ 격자 2 라서 이 줄이
  //   스스로 mUpV 를 싣는다. 되살리기에 실패하면 덜 그리고 그 수로 청구한다(비싸지는
  //   쪽 = 안전) + 화면이 pinLost 로 말한다. 그래서 여기는 손대지 않는 것이 맞다.
  const useUp = up > 0 && up !== gridUp;
  // ⚠ 규격은 **지금 쓰는 경로만** 덮어쓴다. box 경로에서 nW·nH 까지 지우면 실려 온
  //   전개도 값이 왕복만으로 사라진다(반대도 같다).
  const dims = mode === "box"
    ? { sizeMode: "box", bW: String(bW ?? ""), bD: String(bD ?? ""), bH: String(bH ?? "") }
    : { sizeMode: "net", nW: String(netW || ""), nH: String(netH || "") };
  return {
    ...baseOf(carried), ...dims, boxType, sheetId, qty: String(qty ?? ""),
    mUp: useUp, mUpV: useUp ? String(up) : "",
  };
}

/**
 * 이 단가가 **어느 사양의** 값인지 한 줄로.
 *
 * ★ 문구를 새로 짓지 않는다 — **견적 라인이 이미 들고 있는 `spec` 문자열**을 그대로
 *   잇는다. 견적서 화면과 같은 말이 나오는 유일한 방법이고(같은 배열을 본다),
 *   공정이 하나 늘어도 여기를 고칠 일이 없다. 사양을 화면에 다시 서술하기
 *   시작하면 「범례에는 있는데 판에는 없다」와 같은 종류의 거짓말이 생긴다.
 *
 * 빼는 것 셋: 소부(내부 공정이라 사양이 아니다) · 일반관리비(사양이 아니다) ·
 * 지대의 판형 부분(결과 상자가 이미 크게 적고 있다 — 같은 값을 두 번 말하지 않는다).
 */
export function specSummaryOf(lines) {
  const out = [];
  for (const l of lines || []) {
    const id = String(l.id || "");
    if (id === "paper") out.push(String(l.spec || "").split("·")[0].trim());
    else if (id.startsWith("print") || id.startsWith("coat"))
      out.push(id.endsWith("_back") ? `${l.name} ${l.spec}` : l.spec);
    else if (id === "foil" || id === "emb" || id === "partial_uv")
      out.push(`${l.name} ${l.spec || ""}`.trim());
    else if (id === "thomson" || id === "glue") out.push(`${l.name} ${l.spec}`);
  }
  return out.filter(Boolean).join(" · ");
}

// ══════════════════════════════════════════════════════════════════
//  말 (한국어 / 일본어)
// ══════════════════════════════════════════════════════════════════
//  왜 두 벌인가 — 이 화면은 **일본 전시회 부스에서 고객에게 보여준다.** 운영자는
//  한국어로 조작하고 고객은 일본어를 읽는다. 사전을 여기 한 곳에 두고 화면은
//  T(lang).키 로만 쓴다 — JSX 안에 문자열을 흩뿌리면 한쪽만 고쳐진다.
const KO = {
  title: "판걸이 · 단가 시뮬레이터", back: "견적 앱으로",
  draw: "도면", pdf: "칼선 PDF", dims: "치수 입력",
  drop: "칼선 PDF 를 여기에 놓으세요", pick: "파일 선택", reading: "읽는 중…",
  page: "페이지", cand: "도형 후보", struct: "구조",
  w: "가로 W", d: "깊이 D", h: "높이 H", mm: "mm",
  // 전개도 직접입력(sizeMode "net")으로 실려 온 사양 — W·D·H 공식이 없는 구조다
  // (슬리브·손잡이형). 그 사양에 W·H·D 칸을 내면 **다른 박스**의 값을 묻게 된다.
  nw: "전개도 가로", nh: "전개도 세로",
  sheet: "판형", auto: "자동", qty: "수량", ea: "개",
  btnAuto: "자동 배치", btnHand: "직접 앉히기", btnHandOff: "배치 끝내기", btnReset: "초기화",
  add: "+ 한 장", rot: "90°", flip: "180°", del: "삭제", fill: "빈 곳 채우기", undo: "되돌리기",
  up: "up", perEA: "개당", won: "원",
  netSize: "전개도", sheetSize: "판형", qtyShort: "수량",
  hintStart: "「자동 배치」를 누르면 이 판에 몇 개가 앉는지 계산합니다.",
  hintHand: "칼선을 끌어 옮기세요. 이웃에 닿으면 자동으로 딱 붙습니다.",
  working: "배치를 찾는 중…",
  blocked: "그 자리는 겹칩니다 — 놓지 않았습니다",
  noFit: "이 판에는 한 장도 들어가지 않습니다 — 판형을 바꿔 보세요",
  noRoom: "판에 빈자리가 없습니다",
  needDraw: "먼저 도면을 넣거나 치수를 입력하세요",
  addedN: n => `빈자리에 ${n}장 더 앉혔습니다`,
  addedNone: "더 들어갈 자리가 없습니다",
  // ★ 「자유 배치」는 **버튼**이다(칩이 아니다). 눌러야 up 에 반영된다 — 실무앱의
  //   「손배치로 이어받기」와 같은 확정 절차다(autoPlace 주석 참조). 안 누르면
  //   화면 금액은 견적서와 같은 격자 기준을 유지한다.
  gain: (g, f) => `격자 ${g}up → 자유 배치 ${f}up 채택`,
  adopted: f => `자유 배치 ${f}up 을 반영했습니다 — 규칙격자가 아니어서 목형 확인이 필요합니다`,
  // 재진입 복원 — seedFromAuto 주석 참조. 되돌아간 것을 **조용히** 두지 않는다.
  pinRestored: n => `견적서에서 확정한 ${n}up 을 그대로 되살렸습니다`,
  pinLost: (n, d) => `견적서의 판걸이 ${n}up 을 이 판에서 다시 그리지 못했습니다 — ` +
    `${d}up 으로 보여드립니다(그린 수로 청구합니다)`,
  cappedNote: (a, b, c, d) => `원지 ${a}×${b} 를 인쇄기 최대 ${c}×${d} 로 재단해서 겁니다`,
  overlapRefused: "겹치는 배치가 나와 버렸습니다 (그리지 않습니다)",
  budget: "탐색 예산에 도달했습니다 — 더 나은 배치가 있을 수 있습니다",
  // ★ 사양 줄은 **두 갈래**다. 단독 진입은 손글씨 표준사양(아래 STD 와 짝),
  //   견적서에서 실려 왔으면 specSummaryOf 가 실제 견적 라인에서 뽑은 말이 온다.
  //   ⚠ 실려 온 쪽은 도메인 라벨을 그대로 쓰므로 **일본어 화면에서도 한국어**로
  //     뜬다(지종·코팅·톰슨 라벨이 한국어 한 벌뿐이다). 그래도 이쪽을 택했다 —
  //     대안은 실려 온 사양을 두고 「標準仕様・AB 350g」라고 **틀린 말**을 계속
  //     적는 것이고, 이 화면의 규칙에서 그건 최악이다. 번역이 필요해지면
  //     도메인 라벨에 ja 를 붙여라(화면에서 문자열을 다시 짓지 마라).
  specLine: "표준 사양 · AB 350g · 원색 4도 · IR 코팅 · 단면접착 (개당단가는 개발비 제외)",
  specFrom: "견적서 사양", exDev: "(개당단가는 개발비 제외)",
  // ── 도면 범례 ──────────────────────────────────────────────────
  //  이 세 줄이 없으면 고객에게는 그냥 선 뭉치다. 「어디가 잘리고 어디가 접히고
  //  어디에 풀이 발리는지」가 실무 도면을 읽는 세 가지 질문이고, 화면이 그걸 답한다.
  lgCut: "칼선", lgCutSub: "잘리는 선",
  lgCrease: "오시선", lgCreaseSub: "접히는 선 · 압선",
  lgGlue: "접착면", lgGlueSub: "풀이 발리는 면 · 접착탭",
  // ★ 출처 한 줄 — 정직성 게이트. 표기의 「값」은 실측이 주지 않는다(우리 관용이다).
  //   **세 갈래다.** 도면이 무엇인지에 따라 말이 달라야 한다:
  //     srcBox     날개·오시선·접착면을 그린 구조 (맞뚜껑·십자·삼면접착)
  //     srcOutline 폴리곤 미확정 구조 (G형·G형트레이) — 윤곽 사각형만 뜬다.
  //                「날개 모양은 근사」가 아니다. 날개가 **아예 없다** — 그렇게 적는다.
  //     srcPdf     협력사 칼선 원본 (선 구분이 원본에 없다)
  srcBox: "치수에서 계산한 도면입니다 — 선 구분(칼선·오시선·접착면)은 우리 표기이고, " +
          "날개 모양은 표준형 근사입니다. 정확한 도면은 칼선 PDF 를 넣어 주세요.",
  // ⚠ 화면에 그대로 나가는 글이다 — 마크다운 별표를 쓰지 마라(문자로 보인다).
  srcOutline: "이 구조는 전개도의 바깥 윤곽만 표시합니다 — 칼선·오시선·접착면 상세가 " +
              "아직 확정되지 않은 구조입니다(크기는 실측으로 계산했습니다). " +
              "정확한 도면은 칼선 PDF 를 넣어 주세요.",
  srcPdf: "협력사 칼선 원본입니다 — 원본에 선 구분이 없어 전부 칼선으로 그립니다 " +
          "(오시선·접착면 표기 없음). 선 구분을 보시려면 「치수 입력」 탭을 쓰세요.",
  // 전개도 전체크기만 받은 사양(슬리브·손잡이형 등). srcOutline 을 재활용하면
  // 「아직 확정되지 않은 구조입니다」라고 **틀린 말**을 한다 — 구조가 미확정인 게
  // 아니라 우리가 받은 것이 전체 크기뿐이다.
  srcNet: "전개도 전체 크기만 받은 사양입니다 — 바깥 윤곽(사각형)만 표시합니다. " +
          "정확한 도면은 칼선 PDF 를 넣어 주세요.",
  pStitched: "PDF 칼선 그대로 (근사 없음)",
  pRaster: "PDF 칼선을 격자 윤곽으로 근사 — 실물 칼선이 전부 이 도형 안에 있어 겹치지 않습니다",
  pHull: "PDF 칼선이 닫히지 않아 볼록껍질로 근사 — 안전한 쪽(오목한 틈은 파고들지 않습니다)",
  pBbox: "PDF 칼선을 사각형으로 근사 — 맞물림 없이 칼선 공유만 합니다",
};
const JA = {
  title: "面付け・単価シミュレーター", back: "見積アプリへ",
  draw: "図面", pdf: "カットラインPDF", dims: "寸法入力",
  drop: "カットラインPDF をここにドロップ", pick: "ファイル選択", reading: "読み込み中…",
  page: "ページ", cand: "形状の候補", struct: "形式",
  w: "幅 W", d: "奥行 D", h: "高さ H", mm: "mm",
  nw: "展開図 幅", nh: "展開図 高さ",
  sheet: "シート", auto: "自動", qty: "数量", ea: "個",
  btnAuto: "自動面付け", btnHand: "手動で配置", btnHandOff: "配置を終える", btnReset: "リセット",
  add: "+ 1枚", rot: "90°", flip: "180°", del: "削除", fill: "空きに追加", undo: "元に戻す",
  up: "面付", perEA: "1個あたり", won: "ウォン",
  netSize: "展開図", sheetSize: "シート", qtyShort: "数量",
  hintStart: "「自動面付け」を押すと、このシートに何個入るかを計算します。",
  hintHand: "カットラインをドラッグしてください。隣に触れると自動で吸着します。",
  working: "配置を探しています…",
  blocked: "そこは重なります — 配置しませんでした",
  noFit: "このシートには1枚も入りません — シートを変えてください",
  noRoom: "シートに空きがありません",
  needDraw: "先に図面か寸法を入力してください",
  addedN: n => `空きに ${n} 枚追加しました`,
  addedNone: "これ以上入る場所がありません",
  gain: (g, f) => `格子 ${g}面付 → 自由配置 ${f}面付を採用`,
  adopted: f => `自由配置 ${f}面付を反映しました — 格子ではないため木型の確認が必要です`,
  pinRestored: n => `見積で確定した ${n}面付をそのまま復元しました`,
  pinLost: (n, d) => `見積の面付 ${n} をこのシートで再現できませんでした — ` +
    `${d}面付で表示します（描いた数で請求します）`,
  cappedNote: (a, b, c, d) => `原紙 ${a}×${b} を印刷機の最大 ${c}×${d} に断裁して掛けます`,
  overlapRefused: "重なった配置が出たため描画しません",
  budget: "探索の上限に達しました — さらに良い配置がある可能性があります",
  specLine: "標準仕様・AB 350g・プロセス4色・IRコート・片面貼り（単価に開発費は含みません）",
  specFrom: "見積仕様", exDev: "（単価に開発費は含みません）",
  // 용어는 일본 인쇄·제함 실무의 관용을 따른다: 切り罫(칼선) / 折り罫·罫線(오시선) / のりしろ(접착면)
  lgCut: "カットライン", lgCutSub: "切り取る線",
  lgCrease: "折り罫（罫線）", lgCreaseSub: "折り曲げる線・押し罫",
  lgGlue: "のりしろ", lgGlueSub: "接着剤を塗る面・貼り代",
  srcBox: "寸法から計算した図面です — 線種の区別（カット・折り罫・のりしろ）は当社の表記で、" +
          "フラップ形状は標準形の近似です。正確な図面はカットラインPDFをご入稿ください。",
  srcOutline: "この形式は展開図の外形のみを表示します — カット・折り罫・のりしろの詳細が" +
              "まだ確定していない形式です（寸法は実測から算出しています）。" +
              "正確な図面はカットラインPDFをご入稿ください。",
  srcPdf: "協力会社のカットライン原本です — 原本に線種の区別がないため、すべてカットラインとして" +
          "描画します（折り罫・のりしろの表記なし）。線種の区別は「寸法入力」タブでご覧ください。",
  srcNet: "展開図の外形寸法のみをいただいた仕様です — 外形（矩形）のみを表示します。" +
          "正確な図面はカットラインPDFをご入稿ください。",
  pStitched: "PDFカットラインそのまま（近似なし）",
  pRaster: "PDFカットラインをグリッド輪郭で近似 — 実物の線がすべて内側にあり重なりません",
  pHull: "PDFカットラインが閉じないため凸包で近似 — 安全側（凹部には入り込みません）",
  pBbox: "PDFカットラインを矩形で近似 — かみ合わせなし、突き合わせのみ",
};
export const T = lang => (lang === "ja" ? JA : KO);
export const LANGS = [["ko", "한국어"], ["ja", "日本語"]];

# ARCHITECTURE — cria-quote

단상자(종이박스) 견적 계산 React 앱. 이 문서는 **구조 안내서**다.
왜 이 상수가 이 값인지(실측 근거)는 `readme.md` 와 각 파일 주석이 소유한다.

- 규모: `src/` 55파일 · `test/` 13파일 · 합 7,970줄 (최대 파일 `src/domain/pdf-dieline.mjs` 1,150줄)
- 빌드: `npx vite build` → 253 kB (gzip 86 kB)
- 검증: `npm run verify` (13개 스위트 전부 실코드 import)
  ⚠ `verify-pdf` 는 **오라클을 못 읽으면 exit 1** 이다 — §10 「SKIP 은 실패다」 참조

---

## 1. 레이어

```
data ──► domain ──► ui
 (표)     (계산)     (표시)
```

의존은 **왼쪽으로만** 흐른다. 순환 0.
`domain` 은 React 를 모르고, `ui` 는 단가·공식을 모른다.
`data/` 5파일은 **import 가 0줄**이다 — 순수 상수·테이블 + 그 근거 주석뿐이다.

```
src/
├─ main.jsx                     ReactDOM 마운트 (3줄)
├─ App.jsx                      상태 한 벌 + 2단 레이아웃. buildQuote 를 딱 1회 호출 (96줄)
├─ nest.mjs                     ★ NFP(No-Fit Polygon) 무겹침 격자 배치 엔진 (423줄)
│                                 순수 기하. 판형·단가·구조를 모른다.
│
├─ domain/                      ── 계산. React 를 import 하지 않는다 ──
│  ├─ quote.mjs                 견적 1건 조립. 도메인의 단일 진입점
│  │                              normalizeQuoteInput → buildContext → collectLines → summarize
│  ├─ imposition.mjs            판걸이 어댑터. nest.mjs 를 부르는 **유일한** 지점
│  ├─ sheet-select.mjs          판형(원지) 자동선택 — findBestSheet / pickFrom / chooseHadrong
│  ├─ reams.mjs                 지대R · 여분(손지) · 공정R
│  ├─ paper-repo.mjs            지종×판형 → 지대 단가 (룩업 우선, 없으면 면적환산 추정)
│  ├─ units.mjs                 올림 헬퍼 ceil1 / ceil3
│  ├─ pdf-dieline.mjs           ★ 협력사 칼선 PDF → 실측 전개도 (1,150줄, 의존 = sheets.mjs 뿐)
│  │                              컨테이너 파싱 + 콘텐트 스트림 + 성분 분해 + 후보 순위가
│  │                              **전부 이 한 파일**에 있다. 쪼개지 마라 — §9 참조
│  │
│  ├─ data/                     ── 실측 테이블. 근거 주석이 값 옆에 붙어 있다 ──
│  │  ├─ sheets.mjs             원지·절수·인쇄기 상한·물림·발자국 상한·판형 우선순위
│  │  ├─ papers.mjs             지종 DB
│  │  ├─ paper-prices.mjs       [지종][판형] → 원/R
│  │  ├─ print-prices.mjs       인쇄·소부·별색 단가, 판형 티어별 도당단가
│  │  └─ process-prices.mjs     코팅·접착·톰슨·후가공 단가 + 랭킹용 추정치
│  │
│  ├─ dieline/                  ── 박스 구조 레지스트리 (전개도 치수 + 폴리곤) ──
│  │  ├─ index.mjs              REGISTRY 배열 + dielinePieces / calcNetSize / structures
│  │  ├─ geometry.mjs           ★ 치수와 그림의 단일 출처. piecesFromFlaps / xEdges / GLUE_TAB
│  │  ├─ tuck-both.mjs          맞뚜껑 (상하 텍)      polygon
│  │  ├─ cross.mjs              십자조립 (크로스바텀)  polygon
│  │  ├─ glue3.mjs              삼면접착 (자동바닥)    polygon
│  │  ├─ gtype.mjs              G형 (톰슨조립)        폴리곤 미확정 → 직사각
│  │  ├─ gtype-tray.mjs         G형 트레이 (뚜껑일체)  폴리곤 미확정 → 직사각
│  │  └─ direct.mjs             전개도 전체크기 직접입력 (hidden)
│  │
│  └─ process/                  ── 견적서 한 줄 = 파일 한 개 ──
│     ├─ index.mjs              PROCESSES 배열(= 견적서 표기 순서) + collectLines/DevLines/Flags
│     ├─ paper soboo print coating foil emboss partial-uv thomson glue admin
│     ├─ dev-costs.mjs          개발비(목형·필름)
│     └─ overrides.mjs          rprOf / lotOf — 단가 직접입력 통로
│
└─ ui/                          ── 표시. 값을 다시 계산하지 않는다 ──
   ├─ state.mjs                 UI 상태 ↔ QuoteInput 변환 (여기 한 곳에서만)
   ├─ box-types.mjs             구조 레지스트리 → 드롭다운 (검증 ✓ 표기를 여기서 붙임)
   ├─ format.mjs                fmtR / fmtMM / today
   ├─ primitives.jsx            Input / Select / Toggle / Section / Field / Row2 / Row3
   ├─ QuoteSheet.jsx  QuoteRow.jsx        우패널 견적서
   ├─ panels/                   좌패널 7섹션
   │  BasicInfo BoxSpec PaperPanel PrintPanel CoatingPanel ProcessPanel DevCostPanel
   └─ viz/                      DielineShape LayoutViz NetDiagram SheetCompare QtyCompareTable
      SheetCanvas.jsx           판 + 물림 + 자(ruler)만. 얹는 도형은 DielineShape·PDF 폴리곤
                                ★ 3단계 이음새 3개(placement / data-cell / 좌표변환) — §10
```

---

## 2. 데이터 흐름

```
UI 상태 s (문자열 64개)
   │  ui/state.mjs  toQuoteInput(s)
   ▼
QuoteInput { qty, box, paper, print, finish, overrides, dev }
   │  domain/quote.mjs  buildQuote(input)
   │
   ├─ normalizeQuoteInput ─── buildDieline ── dieline/index.mjs dielinePieces
   │    │                                       └─ geometry.piecesFromFlaps → pieces/cuts/folds/panels
   │    └─ lossOptionsOf (reams.mjs)
   │
   ├─ decideSheet ──┬─ overrides.up 있음   → 판형 고정, 배치 우회
   │                ├─ overrides.reams 있음 → 판형 고정, up 만 자동
   │                └─ 그 밖               → sheet-select.findBestSheet
   │                                          └─ 판형 10개마다 solveImposition
   │
   ├─ solveImposition ── printableArea(판형 ∩ 인쇄기 990×720)
   │                     └─ nest.solveLayout(pieces, printW, printH)
   │                        → up / cols / rows / cells / bbox / interlocked
   │                     └─ 발자국 92% 상한 → 초과하면 maxUp 낮춰 재시도
   │
   ├─ reams: 정미 = ceil(qty/up) → 여분 → 지대R · 공정R
   │
   ├─ collectLines(ctx)  PROCESSES 10개가 각자 lines(ctx) 를 낸다
   ├─ collectFlags(ctx)  공정이 경고 플래그를 낸다 (coating → irWarning)
   └─ summarize          공정합계 → 개발비 → 개당단가 = round(공정합계/수량) → 부가세
   ▼
QuoteResult { netSize, dieline, sheet, layout, reams, paperPrice, print, lines, devLines, totals, flags }
   │
   ▼  App.jsx 가 좌패널 7섹션 + 우패널 견적서에 나눠 준다
```

**호출 규칙 3개**

1. `nest.solveLayout` 은 `imposition.mjs` 만 부른다. 다른 곳에서 직접 부르면
   인쇄기 클램프·발자국 상한·행거탭 정책이 빠진 up 이 견적에 들어간다.
2. `buildQuote` 는 App 에서 **1회만** 부른다. `useMemo` 로 감싼 그 한 번이 전부다.
3. `ui` 는 도메인이 준 값을 **다시 계산하지 않는다.** 수율(`layout.utilPct`)처럼
   분모가 갈릴 수 있는 값은 정본이 하나뿐이다.

---

## 3. 이런 걸 바꾸려면 어디를 보라

| 바꾸고 싶은 것 | 파일 (순서대로) | 검증 |
|---|---|---|
| **새 박스 구조 추가** | ① `src/domain/dieline/<구조>.mjs` 새로 만들고 `netSize()`·`flaps()` 작성 → ② `dieline/index.mjs` REGISTRY 배열에 1줄 | `verify-dieline` (불변식·계약) |
| 새 구조가 슬리브 위상이 아님 (트레이 등) | 위 + 그 파일에 `pieces(W,D,H,{net,flaps,opt})` 훅 선언. `geometry.mjs` 는 건드리지 않는다 | `verify-dieline` bbox 불변식 |
| 구조의 톰슨 기본값 | 구조 파일에 `thomsonDefault: "g_std"` — `state.nextThomId` 가 레지스트리를 읽는다 | `verify-dieline` 계약 |
| 구조의 입력범위 경고 | 구조의 `netSize()` 가 `warning` 문자열 반환. UI 수정 불필요 | 화면 확인 |
| 구조 이름/검증 표기 | 구조 파일의 `label`·`tag`·`verified`. ✓ 표기는 `ui/box-types.mjs` 가 붙인다 | — |
| **새 공정 추가** | ① `src/domain/process/<공정>.mjs` (`applies`/`lines`, 필요시 `flags`) → ② `process/index.mjs` PROCESSES 배열에 1줄 | `verify-total` |
| 공정이 새 입력을 읽어야 함 | `state.mjs` 에 UI 키 추가 → `toQuoteInput` 의 `finish` 에 넣으면 `ctx.finish` 로 그대로 흐른다 (화이트리스트 없음) | `verify-total` |
| **지대 단가** | `domain/data/paper-prices.mjs` — 값 뒤 주석에 근거 견적서 날짜 | `verify-total` |
| 코팅·톰슨·접착·후가공 단가 | `domain/data/process-prices.mjs` (컬럼 = `"4절"`/`"2절"`/`"전지"`/`min`) | `verify-total` |
| 인쇄·소부·별색 단가 | `domain/data/print-prices.mjs` | `verify-print` · `verify-total` |
| 지종 목록 | `domain/data/papers.mjs` | — |
| **원지 규격·절수** | `domain/data/sheets.mjs` BASE_SHEETS | `verify-r` (1R 장수) |
| 판형 실무 우선순위 | `sheets.mjs` SHEET_PRIORITY | `verify-print` §B |
| 하드롱 채택 문턱 | `sheet-select.mjs` HADRONG_EDGE | `verify-print` §C |
| 동점 판정 폭 | `sheet-select.mjs` TIE_PCT | `verify-print` §B |
| 추정단가 페널티 | `sheet-select.mjs` EST_PRICE_PENALTY | `verify-print` §D |
| **물림(gripper) 방침** | `imposition.mjs` `printableArea` ⚠ 아래 §5 를 먼저 읽어라 | `scorecard-unit` §A/§C · `verify-net` |
| 발자국 상한 | `sheets.mjs` MAX_FOOT_PCT + `imposition.mjs` `footOf` 분모 | `verify-net` 발자국% 열 |
| 인쇄기 최대 판 | `sheets.mjs` PRESS_MAX_LONG/SHORT | `verify-layout` §E |
| 배치 알고리즘 | `src/nest.mjs` ⚠ 순수 기하. 정책을 넣지 마라 | `verify-nest` 44케이스 |
| **여분(손지) 규칙** | `domain/reams.mjs` LOSS_* + `estimateLoss` | `verify-r` 여분 7케이스 |
| 지대R·공정R 올림 규칙 | `domain/reams.mjs` `calcR`/`calcProcessR` + `units.mjs` | `verify-r` |
| 개당단가 반올림 | `quote.mjs` `summarize` (`round`, floor 아님) | `verify-total` |
| 견적서 줄 순서 | `process/index.mjs` PROCESSES 배열 순서 — **계약이다** | `verify-total` |
| 견적서 화면 | `ui/QuoteSheet.jsx` · `ui/QuoteRow.jsx` | 화면 확인 |
| 배치 그림 | `ui/viz/LayoutViz.jsx` (좌표는 `layout.boxes` 만 씀) | 화면 확인 |
| 전개도 그림 | `ui/viz/DielineShape.jsx` + `NetDiagram.jsx` (패널은 `dieline.panels`) | 화면 확인 |
| **칼선 PDF 추출** | `domain/pdf-dieline.mjs` — 후보 점수·성분 병합 규칙까지 한 파일. §9 를 먼저 읽어라 | `verify-pdf` 72/74 (§E 돌연변이 6/6 · §F 옛코드 4/5 검출) |
| PDF 드롭 UI·후보 드롭다운 | `ui/panels/BoxSpec.jsx` (드롭 영역 → `sizeMode="net"` + `nW`/`nH`) | 화면 확인 |
| 「고른 후보 → 그 polygons」 규칙 | `ui/state.mjs` `pdfPickOf(s)` — **여기 한 곳**. BoxSpec 과 3단계가 같이 부른다 | §10 계약표 |
| 판형 캔버스(판·물림·자) | `ui/viz/SheetCanvas.jsx` ⚠ 배치를 다시 풀지 마라 — `placement` 없으면 `layout.boxes` 만 읽는다 | 화면 확인 |
| **드래그 배치(3단계) 붙이기** | §10 「붙이는 순서」 6단계 — 도메인 수정 0줄이 목표다 | 화면 확인 |
| 입력 위젯 스타일 | `ui/primitives.jsx` | — |

---

## 4. 실측 근거는 어디 있나

이 프로젝트의 **모든 상수에는 실측 근거가 있다.** 근거를 잃으면 후임자가 임의로 바꾼다.
근거는 값 바로 위 주석에 있다 — 아래는 그 색인이다.

### 전개도 (칼선 벡터 실측)

| 상수·공식 | 값 | 근거 위치 |
|---|---|---|
| 접착날개 `GLUE_TAB` | 14.3 | `dieline/geometry.mjs:34-41` — 규격 확인 칼선 3건(삼면E·칼선-06·칼선-05) 전부 오차 0.0 |
| 패널 x 경계 `xEdges` | `[0,D,D+W,2D+W,2D+2W,netW]` | `geometry.mjs:62` · 검산 `test/verify-net.mjs` 「패널 x 경계」 바이오머 150×15×150 오차 0.0mm |
| 날개 끝단폭 `TIP_W` | 10.8 | `geometry.mjs:52-58` — 웨이크버니 y레벨 절단 실측, A(46mm)·B(36mm) 패널 모두 10.8 → **상수** |
| 날개 인셋 `TAPER_MAX` | 10.2 | `geometry.mjs:46-51` — 깊은 날개 끝 폭 A 46.0→25.6 / B 36.0→15.6, 한쪽 인셋 환산 둘 다 10.2 |
| 맞뚜껑 `netH` | `H + 2(D+16.5)` | `dieline/tuck-both.mjs:3-18` — 칼선-07/08 2건 오차 0.0 (종전 공식은 −67.5mm) |
| 십자 `netH` | `H + 2(7D/8+5.5)` | `dieline/cross.mjs` |
| 삼면접착 위 띠 | `0.67D + 0.03W + 2.8` | `dieline/glue3.mjs` · 도출 `test/verify-imposition.mjs` 「소스코 …」 절 — 칼선 3건 3점 연립, 오차 0.31mm |
| 삼면접착 아래 띠 | `D + 15` | 같은 절 — 오차 0.1mm. `W` 계수 −0.001 ≈ 0 |
| 삼면 아래날개 깊이 | `[0.10b, 0.40b, b, 0.40b]` | `dieline/glue3.mjs` |
| G형 트레이 | `W+4H+44.5` / `2D+3H+19.5` | `dieline/gtype-tray.mjs:1-15` — 칼선 PDF 4건, 3건 오차 0 |
| G형 D/H 분기 | 0.8 | `dieline/gtype.mjs:1-17` — 실측 6건 |
| 왜 치수와 그림이 한 파일인가 | — | `geometry.mjs:5-32` — 종전 두 회귀식이 갈려 폴리곤이 25~30% 작았고, 그래서 십자B 가 4up 대신 6up 이 나왔다 |

### 판형·배치 (견적서 78건 역산)

| 상수 | 값 | 근거 위치 |
|---|---|---|
| 원지 3계열·절수 | 788×1091 / 636×939 / 889×1194 | `data/sheets.mjs:1-31` |
| 인쇄기 최대 판 | 990 × 720 | `sheets.mjs:47-56` — 견적서 99장 「단위」 전건이 이 안에 들어감 |
| 물림 `BITE_SHORT/LONG` | 30 / 20 (**적용 안 함**) | `sheets.mjs:58-70` — 코리팩 산출식 엑셀 B14 vs B15. 적용하지 않는 이유는 §5 |
| 배치 허용오차 `FIT_TOL` | 0.005 | `sheets.mjs:73-77` — 삼면E 실측 265.0 vs 공식 268.0 |
| 발자국 상한 `MAX_FOOT_PCT` | 92 | `sheets.mjs:79-88` — 분모는 **판형 면적**이어야 한다 |
| 판형 우선순위 | 4×64→국2→4×62→… | `sheets.mjs:33-45` — 실무 확인 |
| 하드롱 문턱 `HADRONG_EDGE` | 0.06 | `sheet-select.mjs:13-26` — 조립형 324×428 실측. 배수 페널티로 하면 어긋나는 이유까지 적혀 있다 |
| 동점 폭 `TIE_PCT` | 0.015 | `sheet-select.mjs:28-43` — 삼면 50×40×81 에서 도수만 바꿔 판형이 뒤집힌 실측 |
| 추정단가 페널티 | 0.03 | `sheet-select.mjs:45-52` |
| 맞물림 상수 감산이 왜 틀렸나 | — | `test/verify-nest.mjs` §5 — IL_W=10 이 반전 이웃과 464mm² 겹침(독립 샘플링). 실제 허용 최대 행겹침 26.0mm vs 종전 145.0mm |

### 금액 (견적서 78건 역산)

| 규칙 | 값 | 근거 위치 |
|---|---|---|
| 지대R | `(정미+여분)/(500×절수)`, 전지급 0.1 올림 / 2절이하 3자리 올림 | `domain/reams.mjs:1-39` |
| 여분 기본 | 300장 (무인쇄 200) | `reams.mjs:14-32` — 견적서 99건 중 정미 6,000장 이하 전건이 정확히 300 |
| 여분 가산 | 양면 +100 / 베다 +100 / 형압 +50 / **박 0** | `reams.mjs:45-50` — 십자B 한 장 안에서 직접 대조. 박 0 은 조립형 금박 2건 여분 300 |
| 공정R | `ceil(정미/1000×10)/10`, 정미<1000 → 1식 | `reams.mjs:34-38` |
| 별색 가중치 `SPOT_WEIGHT` | 3 | `data/print-prices.mjs:21-33` — 삼면E 별2 84,000 vs 원4 56,000 대조 견적서 |
| 단가 인상 이력 | 소부 10,000→11,000→12,000 등 | `print-prices.mjs:1-12` |
| 접착 단면 / IR 2절 | 20원/EA / 40,000 | `data/process-prices.mjs:22-31` · `:14` — 26-08-04 소스코 견적서 |
| 접착 최소 1식 | 50,000 | `process-prices.mjs:27` |
| 랭킹용 추정치를 왜 안 합치나 | — | `process-prices.mjs:62-64` — 합치면 판형 선택이 움직인다 |
| 개당단가 = `round` | — | `domain/quote.mjs:1-12` — 맞뚜껑A 30,000ea 77.84→78 (floor면 77 ✗) |
| 전체 금액 재현 | 24/26 | `test/verify-total.mjs` — 나머지 2건은 견적서 자체 손수정(파일 안에 `knownDiff` 로 명시) |

### 폐기된 가설 (지우지 마라 — "왜 이 공식이 아닌가" 를 잃는다)

- `test/verify-net.mjs:24-28` `OLD` — 폐기된 netH 회귀식 3종. 원본이 코드에 없다.
- `test/verify-print.mjs` §B 주석 — 우선순위를 총비용에 곱했던 종전 규칙이 왜 틀렸나.
- `test/verify-imposition.mjs` 「날개 테이퍼 — 해결됨」 절 — 전폭 사각형 모델의 실패 이력.
- `test/verify-interlock.mjs` §A~§C — 코리팩 산출식 엑셀 원문. 앱 로직의 미러가 아니라 엑셀 전사다(§A 가 엑셀 자체 예시 8/8 로 검산).

---

## 5. ⚠ 물림(gripper) — 되돌리기 전에 읽어라

`imposition.printableArea` 는 판형에서 물림을 **빼지 않는다.**

물림 자체는 실재한다(코리팩 엑셀 「종이 규격」 vs 「제작 규격」 = 짧은변 −30 / 긴변 −20,
근거는 `sheets.mjs:58-70` 에 보존). 그런데 **그 차감은 이미 판형 숫자 안에 있다.**
`BASE_SHEETS` 의 절지 규격과 견적서 「단위」열은 원지가 아니라 인쇄기에 걸리는 재단
크기이고, 견적서의 up 은 그 크기 위에서 실제로 나온 값이다. 또 빼면 이중 차감이다.

반증 불가능한 사례 — 삼면E 90×70×130 을 545×394(4×64)에 2up:
회전 2열이 545 중 536mm 를 쓴다. 남는 여백이 전체 9mm 인데, 긴변에서 20mm 를 더 빼면
그 대지가 물리적으로 성립하지 않는다. 그런데 견적서에 실존한다.

| 측정 | 물림 0 (현행) | 물림 20/30 |
|---|---|---|
| `scorecard-unit` (판 = 견적서 「단위」) | **7/12** | 1/12 |
| `verify-net` (앱 실경로) | **7/10** | 1/10 |
| `scorecard-nest` 지대금액 평균절대오차 | **14.4%** | 48.9% |

되돌리려면 `BASE_SHEETS` 를 원지 규격으로 재정의하고 견적서 78건을 다시 역산하는 것이
먼저다. `scorecard-unit.mjs` 가 §A(물림 0) vs §C(물림 적용)를 계속 계량하며,
§C 가 §A 를 앞지르면 그 파일이 exit 1 로 실패한다.

### 2026-08-07 재조사 — 「표준=원지 / 사용자입력=재단」 분기는 반증됐다

물림을 판형 출처에 따라 갈라 보려는 시도가 한 번 더 있었다. 규칙은
「표준 판형(`BASE_SHEETS`)은 원지니까 차감 / 사용자가 직접 준 크기(주문생산 `custom`,
PDF 로 읽은 판)는 이미 재단됐으니 미차감」. **구현해서 6개 스위트를 돌렸고 폐기했다.**

결정적 근거는 숫자의 동일성이다 — 견적서 「단위」 12건을 `BASE_SHEETS` 와 대조하면
**8건이 완전 동일**하다(국2 636×469 · 4×62 788×545 · 하4 444×597 · 4×64 394×545).
「단위」가 재단 크기라는 것은 확정 사실이므로 그와 같은 숫자인 절지 규격도 재단 크기다.
표준이라는 이유로 차감하면 정의상 이중 차감이고, 실제로 **깨진 4건이 전부 그 8건에
속했다**(맞뚜껑A 국2 6→4 · 삼면A 하4 2→1 · 삼면C 4×64 4→2 · 십자B 하4 4→3).
나머지 4건(760×480 · 980×720 · 480×788)은 전지·2절급 주문재단이라 표준 규격이 아니다.

| 측정 | 미차감(유지) | 표준 전부 차감 | 전지급(`cut=1`)만 차감 |
|---|---|---|---|
| `verify-net` 판걸이 up | **7/10** | 3/10 · exit 1 | 7/10 |
| `verify-net` 비폴리곤 구조 up | **6/6** | 5/6 | 6/6 |
| `scorecard-nest` up | **7/10** | 3/10 | 7/10 |
| `scorecard-nest` 지대금액 평균절대오차 | **14.4%** | 36.3% | 14.4% |
| `scorecard2` · `scorecard-unit` | 10/15 · 7/12 | 변화 없음 | 변화 없음 |
| `verify-total` · `verify-r` | 24/26 · 37/39 | 변화 없음 | 변화 없음 |

- 「표준 전부 차감」열은 물림에 **가장 유리한** 구현이다(`printW/printH` 만 줄이고 발자국
  분모는 보존). 분모까지 줄이면 위 첫 표의 1/10 · 48.9% 가 된다 — 둘 다 실행 확인했다.
- 「전지급만 차감」은 **어느 점수도 움직이지 않는다.** 바뀌는 것은 삼면B 46전지의 배치
  모양뿐이다(칼선공유 → 맞물림 ↕18mm, up 은 2 그대로). 득도 실도 없는 분기는 넣지 않았다.
- ⚠ `verify-total`·`verify-r` 이 불변인 것은 안전 신호가 **아니다.** 그 두 스위트는
  `overrides.up` 으로 판걸이를 고정하므로 물림 회귀를 원리적으로 못 잡는다
  (`verify-total.mjs:7` 분업 주석). 물림 방침의 감시자는 `verify-net`·`scorecard-nest` 다.

부산물로 **판걸이 캐시 키에 `custom` 을 넣었다** (`imposition.mjs` `ck`). 현행 방침에서는
표준/주문생산의 배치가 같아 무해하지만, `custom` 으로 갈리는 정책이 하나라도 들어오는
순간 같은 `w×h` 를 직접 입력한 주문생산이 표준 판형의 배치를 캐시에서 돌려받는다 —
화면에 아무 표시 없이 up 만 틀리는 사고다. 지우지 마라.

---

## 6. 불변식과 그걸 지키는 테스트

| 불변식 | 테스트 |
|---|---|
| 폴리곤 bbox === `netW × netH` (오차 0) | `verify-dieline` 불변식 360/360 · `scorecard2` |
| `max(top) === topLid` · `max(bot) === botFloor` | `verify-dieline` |
| 배치된 조각이 **서로 겹치지 않음** (NFP 완전검증 + 독립 샘플링) | `verify-nest` 44/44 |
| 행거탭이 열 피치를 늘리지 않음 (0/15/20mm 전 구간 같은 up) | `verify-net` 「행거탭」 |
| 회전금지 구조가 실제로 회전하지 않음 | `verify-net` 「회전금지 실효」 |
| 1R 장수 = 500 × 절수 | `verify-r` |
| 판형 선택 정책 3개(우선순위·하드롱·추정단가)를 뒤집으면 실패 | `verify-print` §B·§C·§D — 돌연변이 3종 전부 검출 확인 |
| 물림 방침이 뒤집히면 실패 | `scorecard-unit` |
| 견적서 전체 금액 원 단위 일치 | `verify-total` 24/26 |

**테스트는 전부 실코드를 import 한다** (12/12 파일).
자체 계산 함수가 남아 있는 곳은 앱 로직의 미러가 아니라 (a) 엑셀 원문 전사
(`verify-interlock` §A~§C), (b) 후보값 스캔 도구(`verify-layout` `upOn`),
(c) 폐기된 구현의 문서형 재현(`verify-net` `OLD`)이고 각 파일이 그렇게 명시한다.

---

## 7. 점수판 (2026-08-06)

| 스위트 | 점수 | 무엇을 재나 |
|---|---|---|
| `verify-nest` | 44 / 44 | 배치 기하 — 무겹침·NFP 성질 |
| `verify-dieline` | 불변식 360/360 · 계약 36/36 | 전개도 치수 ↔ 폴리곤 정합 |
| `verify-net` | **판걸이 up 7/10** · 비폴리곤 6/6 | ★ 앱 실경로 판걸이 대표 점수 |
| `scorecard-nest` | 7/10 · 지대금액 오차 14.4% | 같은 케이스의 금액 영향 |
| `scorecard-unit` | 물림0 **7/12** / 물림적용 1/12 | 물림 방침 A/B (회귀 게이트) |
| `scorecard2` | 10/15 | ⚠ `printableArea` 를 건너뛴다 — **앱 점수가 아니다** |
| `verify-total` | 24 / 26 | 견적서 전체 금액 (나머지 2건은 견적서 자체 손수정) |
| `verify-print` | 인쇄비 19/20 · 도수 7/7 · 판형 §B✓ §C 3/3 §D 2/2 | 인쇄비 + 판형 선택 정책 |
| `verify-r` | 지대R 37/39 · 공정R 39/39 · 여분 7/7 | R수·여분 |
| `verify-imposition` | 실측 대조 4/5 | 대지 실측 대조 (문서 성격) |
| `verify-interlock` | 엑셀 8/8 · 물림 5/6 · up 7/10 | 코리팩 엑셀 모델 대조 |
| `verify-layout` | 원지 5/11 → 인쇄기제약 3/11 | ⚠ 후보값 스캔 도구 — 앱 점수가 아니다 |
| `verify-pdf` | **72 / 74** (실측 8건 · §E 게이트 8건 · §F /ObjStm 5건 · FAIL 0) | 칼선 PDF → 실측 bbox·polygons 계약 + §E 「조용히 틀리지 않는지」 + §F 압축 객체 스트림. ⚠ 오라클 SKIP 이면 exit 1 — §10 |

**갱신 규칙**

1. 점수를 요약할 때 쓰는 판걸이 대표값은 `verify-net` 「견적서 판걸이 up 재현」이다.
   `scorecard2` 는 `solveLayout` 을 직접 불러 `printableArea` 를 건너뛰므로 앱 점수가 아니다.
   (실제로 그 숫자를 요약에 썼다가 앱 점수 붕괴를 4주간 가린 이력이 있다.)
2. 점수가 떨어지면 **떨어진 대로 적는다.** 숫자를 맞추려고 테스트를 고치지 않는다.
3. 실측과 어긋나는 케이스는 지우지 말고 이유를 붙여 남긴다
   (`knownDiff` / 「목형 설계 요인」처럼).
4. 상수를 바꿀 때는 근거 주석을 같이 갱신한다. 근거 없는 상수는 다음 사람이 지운다.

---

## 8. 도메인 용어 사전

### 규격·전개도

| 한글 (견적서·실무) | 코드 이름 | 뜻 |
|---|---|---|
| 가로 / 깊이 / 높이 | `W` / `D` / `H` | 완성 박스 3치수(mm) |
| 전개도 · 총규격 | `netSize`, `dieline.net` | 펼친 종이 한 장의 크기 |
| 전개도 가로 / 세로 | `netW` / `netH` | 같은 것의 두 축 |
| 칼선 | `cuts` (폴리라인) | 자르는 선 |
| 접는선 | `folds` | 누름선 |
| 뚜껑 / 바닥 | `topLid` / `botFloor` | 몸통 위·아래로 나가는 최대 깊이 |
| 날개 | `flaps.top[]` / `flaps.bot[]` | 패널별 날개 깊이 배열 |
| 텍 혀 | (tongue) | 상자 아가리로 들어가는 좁은 끝 |
| 더스트 | (dust flap) | 뚜껑 양옆 작은 날개 |
| 접착날개 · 접착탭 | `GLUE_TAB` = 14.3 | 이어붙이는 여유 폭 |
| 행거탭 · 유로홀 | `hangTab` | 걸이봉용 상단 돌출 |
| 조각 | `pieces` | 배치 입력용 **볼록** 다각형 목록 |
| 패널 | `panels[]` `{i,x0,x1,label}` | 측면1·전면·측면2·후면·접착 |

### 판형·배치

| 한글 | 코드 이름 | 뜻 |
|---|---|---|
| 원지 · 판형 | `sheet`, `BASE_SHEETS` | 종이 규격 |
| 절수 | `sheet.cut` | 전지 1장에서 나오는 장수 (1=전지, 2=2절 …) |
| 전지 / 2절 / 3절 / 4절 | `cut: 1 / 2 / 3 / 4` | |
| 사륙(4×6) / 국전 / 하드롱 | `family: "사륙"/"국전"/"하드롱"` | 원지 3계열 |
| 판형 티어 | `tier` = `"4절"` / `"2절"` / `"전지"` | 단가 구간. `"2절"` 은 2절·3절을 함께 덮는다 |
| 단위 | (견적서 열) | 인쇄기에 걸리는 **재단 크기**. 원지 규격이 아니다 — §5 |
| 대지 | (실측 자료) | 실제로 앉힌 인쇄판 한 장 |
| 판걸이 | `up`, `layout` | 판 한 장에 박스 몇 개 |
| 물림 | `BITE_SHORT` / `BITE_LONG` | 그리퍼가 잡는 띠. **판걸이에는 적용하지 않는다** — §5 |
| 맞물림 · 인터로킹 | `interlocked`, `overlapX/Y` | 반전 이웃과 날개를 겹쳐 끼움 |
| 칼선 공유 | `dx === netW` | 경계 칼선을 맞대기만 함 (겹침 0) |
| 엇갈림 | `sx` | 행마다 옆으로 미는 양 |
| 수율 | `layout.utilPct` | `up × netW × netH ÷ 판형 면적` |
| 발자국 | `layout.footPct` | `배치 외곽 bbox ÷ 판형 면적` — 상한 판정은 이쪽 |
| 무겹침 다각형 | NFP (No-Fit Polygon) | `nest.mjs` 의 배치 원리 |

### 금액

| 한글 | 코드 이름 | 뜻 |
|---|---|---|
| 정미 | `reams.net` | 필요한 종이 장수 = `ceil(수량/up)` |
| 여분 · 손지 | `reams.loss` | 작업 손실 여유 장수 |
| 지대 | `paperPrice` | 종이값 |
| 지대R · 연 | `reams.R` | 종이 수량 단위. `1R = 500 × 절수` 장 |
| 공정R | `reams.processR` | 공정 수량 단위. 절수 무관 `1,000장 = 1R` |
| 1식 | `reams.isLot` | 정미 1,000장 미만 → 최소 금액 청구 |
| 소부 | `process/soboo.mjs` | 인쇄판 제작 (도수당) |
| 도수 | `sideColors`, `fColors/bColors` | 인쇄 색 수 |
| 원색 4도 | `side.color` | CMYK |
| 별색 | `side.spot` | 지정색. 1도 = 인쇄 3회 (`SPOT_WEIGHT`) |
| 먹 | `side.black` | 검정 1도 |
| 베다 | `print.beda` | 바탕 전면 인쇄 → 별색 R단가 상향 |
| 코팅 | `opts.coatFront/Back` | 무광·유광·IR·라미 등 |
| 톰슨 · 도무송 | `opts.thomson` | 목형으로 찍어내는 공정 |
| 박 | `finish.foil` | 금박·은박·먹박 |
| 형압 · 디보싱 | `finish.emb` | 눌러 요철 |
| 부분코팅 | `finish.puv` | 부분 UV |
| 목형 | `dev.newDie` | 칼 틀 (개발비) |
| 공정합계 / 개당단가 | `totals.process` / `totals.perEA` | `perEA = round(공정합계/수량)` |
| 주문생산 | `sheet.custom` | 코리팩에 크기·절수를 직접 지정해 재단 |
| 추정 단가 | `priceEstimated` | 룩업에 없어 면적환산한 지대 단가 (견적서에 ⚠추정) |

---

## 9. ⚠ 칼선 PDF (`domain/pdf-dieline.mjs`) — 되돌리기 전에 읽어라

W·D·H 회귀식은 **변종을 못 잡는다.** iSHAP 120×150×80 은 netW 는 맞는데(557.1 =
2(120+150)+14.3, Δ1.4mm) netH 실측 324.2 가 어느 구조 공식으로도 안 나온다
(삼면접착 302.7~351.9). 그래서 협력사 PDF 를 직접 읽는다 — 추측이 사라진다.

### 흐름 — 도메인은 PDF 를 모른다

```
BoxSpec 드롭 → readDielineFile(File)
   → { pageSize, bbox, polygons, candidates[], source, unit:"mm", warnings[], pageCount, sheetId }
   → sizeMode="net" + nW/nH ← bbox          ← 기존 dieline/direct.mjs 경로를 그대로 쓴다
   → s.pdfDl 에 **통째로** 보관 (polygons 포함)  ← 3단계(드래그 배치)의 입력
```

새 도메인 경로를 만들지 않은 것이 핵심이다. `toQuoteInput` 은 `pdfDl` 을 읽지 않는다 —
치수는 `nW`/`nH` 로만 흐르고, `pdfDl` 은 화면·3단계용 원본이다.

### 되돌리면 무너지는 설계 판단 4개

| 판단 | 왜 | 뒤집으면 |
|---|---|---|
| 성분 병합은 「접는선을 공유하고 **바깥으로만** 나가는」 것만 | 실측 4건 경계오차 전부 0.00mm | 종전 y여유 60mm 규칙 → 바이오머 netH 210.0 → **267.79** (배치 이미지를 삼킴) |
| x 방향(좌/우) 병합 안 함 | 2up 대지를 읽는 게 목적 | iSHAP 무제-3 에서 옆 판 17.44mm 조각을 끌어와 557.1 → **574.54** |
| `fit = min(면적,페이지)/max(면적,페이지)` (1.0 에서 봉우리) | 「가장 가까운」이지 「가장 큰」이 아니다 | 아트보드 밖 스크래치 도형이 1순위가 된다 |
| `nodes >= 8` 필터 | 대지·도련 사각형(정점 4개)을 걸러내는 **핵심** | 실측 8건 전부 페이지를 꽉 채운 사각형이 어떤 점수로도 1순위 |

두 겹 윤곽은 사방 인셋 편차 ≤2.5mm & 최대 ≤12mm 일 때만 인정하고 안쪽을 고른다
(iSHAP 사방 5.91mm → 안쪽 채택 + warning).

### ⚠ 이 도구가 원리적으로 못 하는 것

**칼선이 아닌 PDF 를 넣어도 에러가 아니라 그럴듯한 숫자가 나온다** (iSHAP 견적서 →
170.3×255.65, 표 괘선이다). 그래서 UI 는 `candidates` 드롭다운과 `warnings` 를 항상 띄우고
사용자 확인을 받는다 — **값을 조용히 견적에 넣지 마라.**

### `/ObjStm`(압축 객체 스트림) — 지원한다 (26-08-07)

칼선 PDF 8건은 전부 구식 xref table 이지만, Acrobat 을 거쳐 오는 파일은 사실상 전건이
/ObjStm 이다 — 고객사 폴더 실측 PDF 485건 중 **351건**(견적서·납품서·발주서·사업자등록증).
그 351건에 `readDieline` 을 태우면 **332건 성공 / 19건 실패**(전부 스캔 이미지·본문 텍스트라
「벡터 도형이 없다」·「칼선으로 볼 만한 도형이 없다」 = 정상), 합계 1.0초 · 최대 32ms.
⚠ 「성공」은 칼선을 맞혔다는 뜻이 **아니다** — 견적서는 표 괘선을 170.3×254.6 으로 돌려준다.
위 「원리적으로 못 하는 것」 그대로이고, 그래서 UI 가 후보·경고를 띄운다.

되돌리면 무너지는 판단 3개 (전부 `verify-pdf` §F 가 게이트한다):

| 판단 | 왜 | 뒤집으면 |
|---|---|---|
| 컨테이너 해제는 **미리**(eager), 조회는 동기 | `inflate` 는 `DecompressionStream` 이라 async 인데 `Doc.get`/`resolve` 는 파일 전역에서 동기다 | `get` 안에서 풀 수 없다 — 구조가 async 로 번진다 |
| 컨테이너 해제 실패는 **던지지 않는다.** 그 객체를 실제로 꺼낼 때 실패한다 | 하이브리드 파일은 메타데이터만 압축하고 페이지·칼선은 평문으로 둔다 | 참조도 안 되는 압축객체 하나 때문에 읽히던 파일을 못 읽는다 (F2) |
| 전수 조사 루프는 `probeDict`(던지지 않음)로 돈다 | /Catalog·/Page 를 찾는 복구 경로 3곳이 **모든** 객체 번호를 훑는다 | 남의 깨진 객체 하나가 조사를 중단시켜, 카탈로그가 바로 옆에 있어도 못 찾는다 (F5) |

⚠ **평문(type 1) 이 압축본(type 2) 을 덮으면 안 된다.** 최신 xref 가 「이 번호의 정본은
압축본」이라 했는데 옛 xref 의 평문 오프셋을 등록하면 `Doc.get` 이 평문을 먼저 보므로
**구판이 조용히 이긴다.** Acrobat 증분 저장이 정확히 그 모양이다 — 합성 대조에서 새 페이지
80×30 대신 구 페이지 50×30 이 경고 0개로 나왔다(F3). `readXrefTable`·`readXrefStream`
양쪽이 `!objStm.has(n)` 를 같이 본다.

xref 체인이 통째로 깨진 /ObjStm 파일은 `discoverObjStms` 가 본문에서 컨테이너를 직접 찾아
푼다 — `_scanAll` 은 평문 `"N G obj"` 만 훑어 압축객체가 아예 안 보이므로, 이게 없으면
멀쩡한 파일이 「PDF 가 아니거나 손상됐다」로 끝난다(F4).

지원 후에도 못 꺼내는 경우(컨테이너 해제 실패·암호화)는 **여전히 명확한 에러**다.
조용히 다른 값으로 때우지 않는다 — `verify-pdf` §C 가 그 자리를 지킨다.

### 브라우저 확인 방법

`test-pdf/` 에 칼선 PDF 를 두고 `npm run dev` → `/test-pdf/<파일>.pdf` 로 읽힌다.
⚠ **`public/` 에 두지 마라** — `vite build` 가 `dist/` 로 복사하고 `npm run deploy` 가
그 `dist` 를 **공개** GitHub Pages 로 올린다(고객사 도면 유출).

가드는 사람이 아니라 **기계가** 갖고 있다: `package.json` 의 `guard:public` 이
`predeploy` 에 걸려 있어 `public/` 에서 PDF 를 찾으면 배포가 exit 1 로 멈춘다
(하위 폴더까지 재귀 검사). `.gitignore` 의 `public/*.pdf` 는 **커밋만** 막고 배포는
못 막으며, 오히려 `git status` 에서도 안 보이게 만든다 — 그래서 가드가 따로 있다.
CI 경로는 git 체크아웃이므로 무시된 파일이 도달하지 못한다. 남은 유출 경로는
**로컬 수동 배포** 하나이고 그것을 `predeploy` 가 닫는다.

### SKIP 은 실패다 — `verify-pdf` 를 초록으로 착각하지 마라

§A 실측 오라클 8건은 **저장소 밖** 고객사 폴더에 있다(영업기밀이라 git 에 못 넣는다).
종전 집계는 SKIP 을 분모에서 빼고 `FAIL` 만 exit 1 로 올려서, 다른 PC·CI·클린 클론에서는
합성 18건만 돌면서 「18/18」 · EXIT=0 이 떴다 — **실측 대조 0건인데 만점으로 보였다.**

| 상황 | 결과 |
|---|---|
| 오라클 8건 다 읽힘 (개발 PC) | `66/68` · EXIT=0 ← **이것만 점수다** |
| 오라클 없음, 면제 안 함 | EXIT=**1** + 「오라클 N건을 읽지 못했다」 |
| 오라클 없음, `PDF_ALLOW_SKIP=1` 또는 `--allow-skip` | EXIT=0 + 「실측 대조 미실행 — **점수 아님**」 |

오라클 위치는 `PDF_ORACLE_DIR` 로 갈아끼운다(기본값은 이 PC 경로). CI 두 워크플로는
`PDF_ALLOW_SKIP: "1"` 를 스텝 env 에 명시했다 — 면제를 **환경이 스스로 밝히게** 한 것이고,
면제해도 점수 문자열이 「점수 아님」으로 바뀌므로 초록으로 위장하지 않는다.

---

## 10. 3단계(마우스 드래그 배치)를 붙이는 자리와 순서

1·2단계(실측 추출 + 판형 캔버스)는 3단계를 **염두에 두고** 만들었다. 이 절은 그 이음새를
못 박아 둔다 — 계약을 문서에 박아두지 않으면 다음 사람이 추출기를 다시 만든다.

### 추출 결과 계약 (`readDieline` / `readDielineFile`)

```js
{
  pageSize: { w, h },            // mm. /Rotate 적용 후 = 화면에 보이는 방향
  bbox:     { w, h },            // 채택한 칼선 1개의 크기 (mm)
  polygons: [ [[x,y],…], … ],    // ★ 3단계의 입력. 지금도 반드시 채워진다
  candidates: [ {                // 점수순. 사용자가 드롭다운에서 바꾼다
    bbox:{w,h,x0,y0}, points, area, segs, parts,
    fitPct, offPct, score, chosen, polygons,   // ← 후보마다 polygons 를 따로 담는다
  }, … ],
  source, unit:"mm", warnings:[], pageCount, sheetId,
}
```

| 필드 | 3단계가 알아야 할 것 |
|---|---|
| `polygons` | **폴리라인 묶음이다.** 닫힌 윤곽도, `nest.mjs` 가 요구하는 볼록 조각도 아니다. 2점짜리 선분이 다수 섞인다(실측: 웨이크버니 `2/3/2/2/2/2/2/2` · 소스코 `2/2/6/17/2/2/2/9`). **그리기**에는 그대로 쓴다. `nest` 에 넘기려면 세그먼트 스티칭 + 볼록 분해가 필요하다 — 근거는 `pdf-dieline.mjs` `polysOf()` 주석 |
| 좌표계 | **페이지 절대좌표**(mm, y 위로). bbox 원점 기준이 **아니다** (소스코 `polygons[0] = [[396.99,211.47],[355.39,211.47]]`, 페이지 420×297). `SheetCanvas` 는 그래서 `translate(-x0, y0+h) scale(1,-1)` 하나를 씌운다 |
| 합집합 bbox | `bbox` 와 정확히 일치한다. `verify-pdf` 가 Δ0.02mm 로 게이트한다 |
| **어느 polygons 를 읽나** | `s.pdfDl.polygons`(추출기 1순위)가 아니라 **`pdfPickOf(s).polygons`**(사용자가 고른 후보). 두 벌이 있고 정답은 후자다 — iSHAP 무제-3 은 후보가 4개(2up 대지의 좌/우 × 도련/칼선)라 실제로 갈린다. 규칙은 `ui/state.mjs` `pdfPickOf` **한 곳**이 소유한다 |

### 캔버스 이음새 (`ui/viz/SheetCanvas.jsx`)

| 이음새 | 지금 상태 | 3단계가 할 일 |
|---|---|---|
| ① 좌표 변환 | `px(mm)` `py(mm)` `sc(mm)` · `boxTf(box)`. 역변환 = `(v - RULER) / scale` | 그대로 쓴다 |
| ② 그릴 배치 | `props.placement` — 주면 그걸 그리고, 없으면 `layout.boxes` | 손배치 배열을 넘긴다. 되돌림은 `placement={null}` 하나 |
| ③ 히트영역 | `<g data-cell={i}>` 안 `rect` 가 `fill="transparent"` | 그 `<g>` 에 핸들러를 단다 |
| ④ 계산 되먹임 | `overrides.up` (`state` 의 `mUp`/`mUpV` → `quote.mjs` 분기 ①) | 손배치 up 을 견적에 넣으려면 이 통로를 쓴다. **도메인은 손대지 않는다** |

⚠ ③ 의 `fill` 을 `"none"` 으로 되돌리지 마라. `"none"` 은 히트테스트 **대상이 아니고**
`"transparent"` 는 대상이다 — 단어 하나 차이로 기능이 죽는다. 실측: `"none"` 일 때
칸 0 내부 81표본 중 `g[data-cell]` 에 잡힌 점이 **4개**뿐이었고(그 4개도 `rect` 가 아니라
칸번호 `text`) 나머지는 판 배경 `rect` 로 빠졌다. `"transparent"` 로 바꾼 뒤 **81/81**.

### 붙이는 순서 (이 순서를 지키면 도메인·추출기를 건드릴 일이 없다)

1. **상태 한 칸** — `state.mjs` 에 `placement: null` 추가. `toQuoteInput` 에는 **넣지 않는다**
   (치수는 `nW`/`nH` 로만 흐른다는 §9 규칙 유지).
2. **초기값** — `pdfPickOf(s).bbox` 와 `layout.boxes` 로 씨앗을 만든다.
   `layout.up === 0` 이면 캔버스가 이미 원점에 1개를 판 밖으로 걸쳐 그려 두므로
   (`data-ghost="1"`, 히트영역 있음) 그것이 출발점이다.
3. **드래그** — `<g data-cell>` 에 `onPointerDown/Move/Up`. mm 변환은 위 ①.
   격자 스냅·판 경계 클램프는 이 단계에서 UI 가 판단한다.
4. **그리기** — `<SheetCanvas placement={s.placement} …/>` 한 줄. 캔버스는 이미 준비됐다.
5. **겹침 검사** — `nest.mjs` 의 폴리곤 겹침 판정을 재사용하려면 여기서
   **스티칭 + 볼록 분해**가 필요하다(위 표 `polygons` 행). 그 전까지는 발자국 사각형
   겹침만으로도 실용적이다.
6. **견적 반영** — `u("mUp", true); u("mUpV", String(placement.length))`.
   `quote.mjs` 는 이미 `overrides.up` 을 받는다. **도메인 수정 0줄.**

되돌리기: 5·6 을 빼고 `placement={null}` 로 두면 1·2단계 상태로 정확히 돌아간다.

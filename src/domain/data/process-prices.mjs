// ══════════════════════════════════════════════════════════════════
// [v8] 코팅·접착·톰슨·후가공 단가 DB  —  docs/ 견적서 78건 실측
// ══════════════════════════════════════════════════════════════════

// ── 코팅 (원/R) ───────────────────────────────────────────────────
// min = 소량(공정R 1식) 금액. 실측: 무광 4×64 55,000 / 하4 60,000 / 하3 70,000
//       4×62 62,400~65,000 / 4×6전지 112,000 / 46전지 양면 126,000
//       IR 4×62·하4 30,000 / 4×64 40,000~48,000 / 국2(ir수성) 50,000 / 전지 60,000
export const COAT_OPTS = [
  { id:"none",   label:"없음",         small:0,      mid:0,      large:0,      min:0      },
  { id:"matte",  label:"무광코팅",     small:55000,  mid:65000,  large:112000, min:55000  },
  { id:"gloss",  label:"유광코팅",     small:55000,  mid:65000,  large:112000, min:55000  },
  { id:"hg",     label:"글로스코팅",   small:65000,  mid:65000,  large:140000, min:65000  },
  { id:"ir",     label:"IR코팅",       small:48000,  mid:40000,  large:60000,  min:40000  },  // mid: 30,000 → 40,000 (26-08-04 소스코)
  { id:"lami",   label:"무광라미",     small:85000,  mid:85000,  large:115000, min:85000  },
  { id:"velvet", label:"벨벳코팅",     small:241722, mid:241722, large:241722, min:241722 },
  { id:"epoxy",  label:"에폭시",       small:95000,  mid:95000,  large:120000, min:95000  },
  { id:"part",   label:"부분코팅",     small:95000,  mid:95000,  large:95000,  min:95000  },
  { id:"both46", label:"양면코팅(전지)",small:126000, mid:126000, large:126000, min:126000 },
];

// ── 접착 (원/EA) ──────────────────────────────────────────────────
// 실측: 단면 15→20 / 삼면 25~30 / 손잡이형 30 / 슬리브 80 / PP 70
//       소량 1식 45,000~50,000 (최근 견적서 50,000)
// 단면 20 근거: 26-08-04 소스코 140×43×130 4,000ea 견적서 (4,000 × 20 = 80,000)
//   종전 15 는 그 이전 견적서 기준. 접착·코팅이 함께 올랐다(IR 30,000→40,000).
export const GLUE_MIN_LOT = 50000;
export const GLUE_OPTS = [
  { id:"none",   label:"없음",         ea:0  },
  { id:"dan",    label:"단면",         ea:20 },
  { id:"sam",    label:"삼면",         ea:30 },
  { id:"pull",   label:"풀발이",       ea:22 },
  { id:"handle", label:"손잡이형",     ea:30 },
  { id:"sleeve", label:"슬리브",       ea:80 },
  { id:"pp",     label:"PP접착",       ea:70 },
];

// ── 톰슨 (원/R) ───────────────────────────────────────────────────
// 실측: 4×64 45,000~50,000 / 하4 45,000~50,000 / 하3·4×63 45,000
//       국2 50,000~55,000 / 4×62 40,000~60,000 / 46전지 80,000 / 4×6전지 70,000~75,000
export const THOMSON_OPTS = [
  { id:"s",     label:"단순형",           small:45000, mid:50000, large:70000, min:45000 },
  { id:"n",     label:"일반형",           small:50000, mid:55000, large:75000, min:50000 },
  { id:"c",     label:"복잡형",           small:50000, mid:60000, large:80000, min:50000 },
  { id:"sp",    label:"측면 풀발이 12단", small:80000, mid:80000, large:80000, min:80000 },
  { id:"g_std", label:"G형 표준",         small:45000, mid:55000, large:70000, min:45000 },
];

// ── 후가공 (원/R) ─────────────────────────────────────────────────
// 실측: 금박 140,000 (조립형) / 100,000 (트레이B, 양면 2회)
//       먹박 120,000 / 형압(디보싱) 100,000 / 형압 80,000 / 재단 30,000
export const FOIL_RPR_DEFAULT = 140000;
export const EMB_RPR_DEFAULT  = 100000;

/** 코팅·톰슨 R단가를 판형 티어로 선택 */
export const rprFor = (opt, tier) => opt ? (opt[tier] ?? opt.mid ?? 0) : 0;

export const coatById    = id => COAT_OPTS.find(o => o.id === id)    || COAT_OPTS[0];     // none
export const glueById    = id => GLUE_OPTS.find(o => o.id === id)    || GLUE_OPTS[0];     // none
export const thomsonById = id => THOMSON_OPTS.find(o => o.id === id) || THOMSON_OPTS[0];  // s 단순형

/** ⚠ 판형 랭킹 전용 공정비 추정. COAT_OPTS·THOMSON_OPTS 와 값이 다르다
 *  (matte mid 65,000 vs 랭킹 62,000). **통합하지 마라** — 통합하면 판형 선택이 움직인다.
 *  의도인지 확인되기 전에는 두 벌을 유지한다. */
export const RANK_COAT_EST = { small: 55000, mid: 62000, large: 112000 };
export const RANK_THOM_EST = { small: 50000, mid: 55000, large:  75000 };

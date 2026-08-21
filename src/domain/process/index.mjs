// ══════════════════════════════════════════════════════════════════
//  process/index.mjs — 공정 레지스트리
//
//  공정을 추가하려면 파일 1개 + 아래 배열 1줄이면 된다.
//  합산은 quote.summarize 가 lines 를 훑고, 렌더는 이미 lines.map 이다.
// ══════════════════════════════════════════════════════════════════
import paper     from "./paper.mjs";
import soboo     from "./soboo.mjs";
import print     from "./print.mjs";
import coating   from "./coating.mjs";
import foil      from "./foil.mjs";
import emboss    from "./emboss.mjs";
import partialUv from "./partial-uv.mjs";
import thomson   from "./thomson.mjs";
import glue      from "./glue.mjs";
import admin     from "./admin.mjs";
import { die, puvFilm } from "./dev-costs.mjs";

/** 배열 순서 = 견적서 표기 순서. 이것은 계약이다 */
export const PROCESSES = [paper, soboo, print, coating, foil, emboss, partialUv, thomson, glue, admin];

/** 개발비 순서는 공정 순서와 다르다:
 *  목형 → 형압 개발비 → 형압 필름 → 동판+동판필름 → 부분코팅 필름 */
export const DEV_PROCESSES = [die, emboss, foil, puvFilm];

export const collectLines = ctx =>
  PROCESSES.filter(p => p.applies(ctx)).flatMap(p => p.lines(ctx));

export const collectDevLines = ctx =>
  DEV_PROCESSES.filter(p => p.applies(ctx)).flatMap(p => p.devLines(ctx));

/** 견적서 경고 플래그 — 공정이 flags(ctx) 를 내면 여기서 병합만 한다.
 *  종전에는 quote.mjs 가 `finish.coatFrontId === "ir"` 을 직접 알아야 했다. */
export const collectFlags = ctx =>
  Object.assign({}, ...PROCESSES.map(p => p.flags?.(ctx)).filter(Boolean));

// ══════════════════════════════════════════════════════════════════
//  oracle-path.mjs — 실측 오라클 파일 경로 해석기 (26-09-07)
//
//  왜 이 파일이 있나
//  ────────────────
//  오라클은 고객사 도면이라 git 에 없고 **회사 폴더에 산다.** 그런데 그 폴더는
//  일이 진행되면서 움직인다. 실제로 세 번 물렸다:
//    · 26-08-27  고객사_문의중/소스코 · 웨이크버니  →  고객사_진행중단/…
//    · 26-09-07  고객사/아르토_4차                →  고객사/제작완료/아르토_4차
//  그때마다 `npm run verify` 가 「진실 없음 — PDF 없음」으로 빨개졌고,
//  **코드는 멀쩡한데 자료 위치만 바뀐 것**이라 원인을 찾는 데 매번 시간이 들었다.
//
//  그래서 정확한 경로가 어긋나면 **파일명으로 뿌리 아래를 찾는다.**
//
//  ★ 조용히 찾아주지 않는다 — 찾으면 「경로가 낡았다」고 **찍는다.**
//    조용히 성공시키면 낡은 경로가 파일에 영원히 남고, 다음 사람은 그 경로를
//    사실로 믿는다. 이 저장소가 「주석 안의 숫자는 늙는다」로 겪은 것과 같은 종류다.
//    찍힌 새 경로를 소스에 옮겨 적는 것은 사람의 일로 남긴다.
//
//  ⚠ 찾기는 **정확한 경로가 없을 때만** 돈다. 있으면 한 번의 existsSync 로 끝난다 —
//    오라클 12벌 × 매 실행마다 회사 폴더를 훑으면 스위트가 분 단위로 느려진다.
// ══════════════════════════════════════════════════════════════════
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, join } from "node:path";

/** 뿌리 아래를 이 깊이까지만 본다. 회사 폴더는 연도/구분/고객사/차수/분류 = 5 단이면 닿는다. */
const MAX_DEPTH = 7;
/** 들어가지 않는 곳 — 크고 오라클이 없다. */
const SKIP_DIR = /^(node_modules|\.git|dist|\$RECYCLE\.BIN|System Volume Information)$/i;

/** 한 프로세스 안에서 같은 파일명을 두 번 찾지 않는다. */
const found = new Map();
/** 이미 알린 낡은 경로 — 같은 말을 반복하지 않는다. */
const told = new Set();

function search(root, name, depth = 0) {
  if (depth > MAX_DEPTH) return null;
  let ents;
  try { ents = readdirSync(root, { withFileTypes: true }); } catch { return null; }
  // 파일을 먼저 본다 — 얕은 곳에 있으면 하위 폴더를 안 뒤진다.
  for (const e of ents) if (e.isFile() && e.name === name) return join(root, e.name);
  for (const e of ents) {
    if (!e.isDirectory() || SKIP_DIR.test(e.name)) continue;
    const hit = search(join(root, e.name), name, depth + 1);
    if (hit) return hit;
  }
  return null;
}

/**
 * 오라클 파일의 실제 경로. 못 찾으면 null.
 *
 * @param {string} exact  소스에 적힌 경로
 * @param {string[]} roots 찾을 뿌리들 (보통 PDF_ORACLE_DIR · DIE_ORACLE_DIR)
 * @param {(s:string)=>void} [say] 낡은 경로를 알릴 함수 (기본 console.log)
 */
export function resolveOracle(exact, roots, say = console.log) {
  if (!exact) return null;
  if (existsSync(exact)) return exact;

  const name = basename(exact);
  if (found.has(name)) return found.get(name);

  for (const r of roots) {
    if (!r) continue;
    try { if (!statSync(r).isDirectory()) continue; } catch { continue; }
    const hit = search(r, name);
    if (hit) {
      found.set(name, hit);
      if (!told.has(name)) {
        told.add(name);
        say(`  ⚠ 오라클 경로가 낡았다 — 파일명으로 찾았다. **소스의 경로를 고쳐라.**`);
        say(`      적힌 곳: ${exact}`);
        say(`      실제:    ${hit}`);
      }
      return hit;
    }
  }
  found.set(name, null);
  return null;
}

// ══════════════════════════════════════════════════════════════════
// PDF 칼선 추출기 — 협력사 칼선 PDF 에서 전개도 **실측** 치수를 읽는다
//
// 왜 이 파일이 있나:
//   지금 전개도(netW/netH)는 W·D·H 에서 회귀식으로 **추측**한다. 실측 칼선 3건으로
//   맞췄지만 변종은 회귀식으로 못 잡는다. iSHAP 120×150×80 은 netW 는 맞는데
//   (557.1 = 2(120+150)+14.3, Δ1.4mm) netH 실측 324.2 가 어느 구조 공식으로도 안 나온다
//   (삼면접착 302.7~351.9). PDF 를 직접 읽으면 추측이 사라진다.
//
// 왜 한 파일인가:
//   PDF 컨테이너 파싱 · 콘텐트 스트림 해석 · 도형 후보 순위는 서로 없으면 무의미하다.
//   쪼개면 "스트림은 풀렸는데 좌표가 안 나온다" 같은 반쪽 상태를 셋으로 나눠 갖는다.
//   외부 의존성 0 · 순수 JS. 브라우저/Node 양쪽에서 같은 코드가 돈다.
//
// 계약 (3단계 = 마우스 드래그 배치의 이음새다 — 줄이지 마라):
//   readDieline(bytes, opt) → { pageSize, bbox, polygons, candidates, source, unit, warnings }
//   polygons 는 1·2단계가 쓰지 않는다. 그래도 담는다. bbox 만 뽑아두면 3단계에서
//   추출기를 다시 만들어야 하고, polygons 를 같이 담으면 3단계는 소비하는 쪽만 붙이면 끝난다.
//   ⚠ polygons 는 **폴리라인 묶음**이다 — 닫힌 윤곽도, nest 가 요구하는 볼록 조각도 아니다.
//     자세한 조건은 polysOf() 주석에 있다. 그리는 데는 그대로 쓰고, nest 에 넘기려면
//     세그먼트 스티칭 + 볼록 분해가 3단계에서 필요하다.
//
// 좌표계: 전부 **mm**, 페이지 좌하단(MediaBox 원점) = (0,0), y 는 위로 증가.
//   /Rotate 가 걸린 페이지는 **보이는 대로** 회전을 적용해서 담는다 (아래 rotMatrix).
//   회전을 안 걸면 bbox 의 가로·세로가 화면과 뒤바뀐 채 견적으로 흘러간다.
// ══════════════════════════════════════════════════════════════════
import { BASE_SHEETS } from "./data/sheets.mjs";

/** pt → mm. PDF 기본 사용자 공간 단위는 1/72 inch 다. */
const K = 25.4 / 72;

// ── 한도 ───────────────────────────────────────────────────────────
// 디자인 파일은 아트워크가 3,000~7,000 선분이고 큰 건 수십만이다. 무한정 받으면
// 브라우저가 죽으므로 상한을 두고, 상한에 걸리면 조용히 끝내지 말고 warnings 로 알린다.
const MAX_POINTS = 3_000_000;
const MAX_XOBJ_DEPTH = 12;
/** PDF 최대 페이지는 14,400pt = 5,080mm 다. 이보다 큰 값은 도형이 아니라 좌표 오류다
 *  (1,000,000×500,000mm 폴리곤 하나만 있는 파일이 그 값을 그대로 bbox 로 돌려줬다). */
const MAX_MM = 5080;
/** 베지어 분할 수. 좌표 반올림이 0.01mm 이므로 8분할이면 곡선 bbox 오차가 그 아래로 떨어진다. */
const BEZ_STEPS = 8;
/** 점 동일 판정 격자 = 0.01mm. flaps.py 의 round(x,2) 와 같은 해상도다. */
const GRID = 100;

// ══════════════════════════════════════════════════════════════════
// 1. 바이트 유틸 — 문자열로 바꾸지 않는다
//    왜: 더파이러츠 맞뚜껑.pdf 는 176MB 다. latin1 문자열로 통째 변환하면
//        JS 문자열로 350MB 이상을 더 쓴다. 토큰화는 바이트에서 직접 한다.
// ══════════════════════════════════════════════════════════════════
const WS = new Uint8Array(256);
for (const c of [0x00, 0x09, 0x0a, 0x0c, 0x0d, 0x20]) WS[c] = 1;
const DELIM = new Uint8Array(256);
for (const c of [0x28, 0x29, 0x3c, 0x3e, 0x5b, 0x5d, 0x7b, 0x7d, 0x2f, 0x25]) DELIM[c] = 1;
const isReg = c => c !== undefined && !WS[c] && !DELIM[c];

/** 바이트 구간을 latin1 문자열로 (바이트값 === 문자코드). TextDecoder("latin1") 은
 *  windows-1252 별칭이라 0x80~0x9F 가 어긋난다 — 그래서 직접 만든다. */
function bstr(b, from, to) {
  let s = "";
  for (let i = from; i < to; i += 8192)
    s += String.fromCharCode.apply(null, b.subarray(i, Math.min(to, i + 8192)));
  return s;
}
/** b 의 pos 위치가 ASCII 문자열 lit 로 시작하는가 */
function at(b, pos, lit) {
  for (let i = 0; i < lit.length; i++) if (b[pos + i] !== lit.charCodeAt(i)) return false;
  return true;
}
function indexOfLit(b, lit, from, to = b.length) {
  const c0 = lit.charCodeAt(0), last = to - lit.length;
  for (let i = from; i <= last; i++) if (b[i] === c0 && at(b, i, lit)) return i;
  return -1;
}
function lastIndexOfLit(b, lit, from, to) {
  const c0 = lit.charCodeAt(0);
  for (let i = Math.min(to, b.length - lit.length); i >= from; i--)
    if (b[i] === c0 && at(b, i, lit)) return i;
  return -1;
}

// ══════════════════════════════════════════════════════════════════
// 2. 압축 해제 — 브라우저 내장 DecompressionStream
//    왜: zlib 의존성 없이 브라우저·Node 양쪽에서 같은 코드가 돈다.
//        그래서 이 파일의 공개 함수는 async 다.
// ══════════════════════════════════════════════════════════════════
async function inflate(bytes) {
  if (typeof DecompressionStream !== "function")
    throw new Error("이 환경에 DecompressionStream 이 없다 — FlateDecode 를 풀 수 없다.");
  // zlib 헤더(0x78…) 가 정상이지만, 헤더 없는 raw deflate 로 저장된 PDF 도 실재한다.
  for (const fmt of ["deflate", "deflate-raw"]) {
    try {
      const s = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(fmt));
      return new Uint8Array(await new Response(s).arrayBuffer());
    } catch { /* 다음 형식으로 */ }
  }
  throw new Error("FlateDecode 스트림을 풀지 못했다 (zlib/raw 둘 다 실패) — 파일이 손상됐을 수 있다.");
}

function ascii85(bytes) {
  const out = []; let tuple = 0, n = 0;
  for (let i = 0; i < bytes.length; i++) {
    const c = bytes[i];
    if (WS[c]) continue;
    if (c === 0x7e) break;                       // ~>
    if (c === 0x7a && n === 0) { out.push(0, 0, 0, 0); continue; }   // z
    tuple = tuple * 85 + (c - 33); n++;
    if (n === 5) { out.push((tuple >>> 24) & 255, (tuple >>> 16) & 255, (tuple >>> 8) & 255, tuple & 255); tuple = 0; n = 0; }
  }
  if (n > 1) {
    for (let i = n; i < 5; i++) tuple = tuple * 85 + 84;
    const b4 = [(tuple >>> 24) & 255, (tuple >>> 16) & 255, (tuple >>> 8) & 255, tuple & 255];
    for (let i = 0; i < n - 1; i++) out.push(b4[i]);
  }
  return new Uint8Array(out);
}

function asciiHex(bytes) {
  const out = []; let hi = -1;
  for (const c of bytes) {
    if (c === 0x3e) break;
    const v = c >= 48 && c <= 57 ? c - 48 : c >= 97 && c <= 102 ? c - 87 : c >= 65 && c <= 70 ? c - 55 : -1;
    if (v < 0) continue;
    if (hi < 0) hi = v; else { out.push(hi * 16 + v); hi = -1; }
  }
  if (hi >= 0) out.push(hi * 16);
  return new Uint8Array(out);
}

/** PNG/TIFF 예측자 되돌리기 — xref 스트림이 거의 항상 /Predictor 12 를 쓴다. */
function unpredict(data, parms) {
  const pred = num(parms?.Predictor, 1);
  if (pred <= 1) return data;
  const colors = num(parms?.Colors, 1), bpc = num(parms?.BitsPerComponent, 8), cols = num(parms?.Columns, 1);
  const rowLen = Math.ceil(colors * bpc * cols / 8);
  if (pred === 2) {                              // TIFF
    if (bpc !== 8) throw new Error(`지원하지 않는 TIFF 예측자 BitsPerComponent=${bpc}`);
    for (let r = 0; r + rowLen <= data.length; r += rowLen)
      for (let i = colors; i < rowLen; i++) data[r + i] = (data[r + i] + data[r + i - colors]) & 255;
    return data;
  }
  const bpp = Math.max(1, Math.ceil(colors * bpc / 8));
  const rows = Math.floor(data.length / (rowLen + 1));
  const out = new Uint8Array(rows * rowLen);
  let prev = new Uint8Array(rowLen);
  for (let r = 0; r < rows; r++) {
    const ft = data[r * (rowLen + 1)];
    const cur = out.subarray(r * rowLen, (r + 1) * rowLen);
    cur.set(data.subarray(r * (rowLen + 1) + 1, r * (rowLen + 1) + 1 + rowLen));
    if (ft === 1) for (let i = bpp; i < rowLen; i++) cur[i] = (cur[i] + cur[i - bpp]) & 255;
    else if (ft === 2) for (let i = 0; i < rowLen; i++) cur[i] = (cur[i] + prev[i]) & 255;
    else if (ft === 3) for (let i = 0; i < rowLen; i++) cur[i] = (cur[i] + (((i >= bpp ? cur[i - bpp] : 0) + prev[i]) >> 1)) & 255;
    else if (ft === 4) for (let i = 0; i < rowLen; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0, bb = prev[i], c = i >= bpp ? prev[i - bpp] : 0;
      const p = a + bb - c, pa = Math.abs(p - a), pb = Math.abs(p - bb), pc = Math.abs(p - c);
      cur[i] = (cur[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? bb : c)) & 255;
    } else if (ft !== 0) throw new Error(`알 수 없는 PNG 예측자 필터 타입 ${ft}`);
    prev = cur;
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════
// 3. PDF 객체 파서
//    이름(Name) 값은 "/Form" 처럼 슬래시를 붙인 문자열, 딕셔너리 키는 슬래시 없는
//    문자열("Subtype")로 둔다. 그래서 d.Subtype === "/Form" 이 그대로 읽힌다.
//    PDF 문자열은 { str: Uint8Array } — 이 추출기는 거의 쓰지 않는다.
// ══════════════════════════════════════════════════════════════════
const REF = Symbol("ref");
const mkRef = n => ({ [REF]: n });
const isRef = v => v && typeof v === "object" && REF in v;

const num = (v, dflt = 0) => (typeof v === "number" && Number.isFinite(v) ? v : dflt);

class Cur { constructor(b, i) { this.b = b; this.i = i; } }

function skipWs(P) {
  const b = P.b;
  for (;;) {
    while (WS[b[P.i]]) P.i++;
    if (b[P.i] === 0x25) { while (P.i < b.length && b[P.i] !== 0x0a && b[P.i] !== 0x0d) P.i++; }
    else return;
  }
}

/** 정규 문자 토큰 (숫자·키워드) */
function readToken(P) {
  const s = P.i;
  while (isReg(P.b[P.i])) P.i++;
  return bstr(P.b, s, P.i);
}

function readName(P) {
  P.i++;                                          // '/'
  const s = P.i;
  while (isReg(P.b[P.i])) P.i++;
  let raw = bstr(P.b, s, P.i);
  if (raw.includes("#")) raw = raw.replace(/#([0-9A-Fa-f]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return "/" + raw;
}

function readLiteralString(P) {
  P.i++;                                          // '('
  const out = []; let depth = 1; const b = P.b;
  while (P.i < b.length) {
    let c = b[P.i++];
    if (c === 0x5c) {                             // backslash
      c = b[P.i++];
      if (c === 0x6e) out.push(10); else if (c === 0x72) out.push(13);
      else if (c === 0x74) out.push(9); else if (c === 0x62) out.push(8);
      else if (c === 0x66) out.push(12);
      else if (c >= 0x30 && c <= 0x37) {          // 8진 escape
        let v = c - 48;
        for (let k = 0; k < 2 && b[P.i] >= 0x30 && b[P.i] <= 0x37; k++) v = v * 8 + (b[P.i++] - 48);
        out.push(v & 255);
      } else if (c === 0x0a) { /* 줄 이음 */ }
      else if (c === 0x0d) { if (b[P.i] === 0x0a) P.i++; }
      else out.push(c);
    } else if (c === 0x28) { depth++; out.push(c); }
    else if (c === 0x29) { if (--depth === 0) break; out.push(c); }
    else out.push(c);
  }
  return { str: new Uint8Array(out) };
}

function parseObj(P) {
  skipWs(P);
  const b = P.b, c = b[P.i];
  if (c === undefined) return undefined;
  if (c === 0x2f) return readName(P);
  if (c === 0x28) return readLiteralString(P);
  if (c === 0x3c) {
    if (b[P.i + 1] === 0x3c) return parseDict(P);
    const e = indexOfLit(b, ">", P.i);
    const hex = asciiHex(b.subarray(P.i + 1, e < 0 ? b.length : e));
    P.i = (e < 0 ? b.length : e + 1);
    return { str: hex };
  }
  if (c === 0x5b) {                               // '['
    P.i++; const arr = [];
    for (;;) {
      skipWs(P);
      if (b[P.i] === 0x5d) { P.i++; break; }
      if (P.i >= b.length) break;
      const v = parseObj(P);
      if (v === END) break;
      arr.push(v);
    }
    return arr;
  }
  if (c === 0x5d) { P.i++; return END; }
  if (c === 0x3e) { P.i += (b[P.i + 1] === 0x3e ? 2 : 1); return END; }
  if (c === 0x7b || c === 0x7d) { P.i++; return END; }

  const save = P.i;
  const tok = readToken(P);
  if (tok === "") { P.i++; return END; }          // 알 수 없는 구분자 — 한 칸 전진해 무한루프 방지
  if (tok === "true") return true;
  if (tok === "false") return false;
  if (tok === "null") return null;
  if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(tok)) {
    const n = parseFloat(tok);
    // "12 0 R" 참조인지 두 토큰 앞을 보고 판단한다. R 이 아니면 첫 정수만 소비한 자리로 되돌린다.
    if (/^\d+$/.test(tok)) {
      const back = P.i;
      skipWs(P);
      if (/^\d+$/.test(readToken(P))) {
        skipWs(P);
        if (readToken(P) === "R") return mkRef(n);
      }
      P.i = back;
    }
    return n;
  }
  // 숫자·키워드도 아니면(예: 깨진 바이트) 토큰으로 반환 — 상위가 판단한다
  return { kw: tok, _at: save };
}
const END = Symbol("end");

function parseDict(P) {
  P.i += 2;                                       // '<<'
  const d = {};
  for (;;) {
    skipWs(P);
    if (P.i >= P.b.length) break;
    if (P.b[P.i] === 0x3e && P.b[P.i + 1] === 0x3e) { P.i += 2; break; }
    if (P.b[P.i] !== 0x2f) {                      // 키가 이름이 아니면 깨진 딕셔너리
      const v = parseObj(P);
      if (v === END || v === undefined) break;
      continue;
    }
    const key = readName(P).slice(1);
    const val = parseObj(P);
    if (val === END || val === undefined) break;
    d[key] = val;
  }
  return d;
}

// ══════════════════════════════════════════════════════════════════
// 4. 문서 — xref / trailer / 객체 조회
// ══════════════════════════════════════════════════════════════════
class Doc {
  constructor(bytes) {
    this.b = bytes;
    this.offsets = new Map();     // objNum → byte offset
    this.objStm = new Set();      // /ObjStm 안에 압축돼 있다고 xref 가 말하는 객체번호
    this.cache = new Map();
    this.trailer = {};
    this.scanned = false;
    this.warnings = [];
  }

  resolve(v) {
    let guard = 0;
    while (isRef(v)) { if (++guard > 32) return null; v = this.get(v[REF]); }
    return v;
  }
  dict(v) { const d = this.resolve(v); return d && typeof d === "object" && !Array.isArray(d) && !d.str ? d : null; }
  arr(v) { const a = this.resolve(v); return Array.isArray(a) ? a : null; }
  numAt(v, dflt = 0) { return num(this.resolve(v), dflt); }

  get(n) {
    if (this.cache.has(n)) return this.cache.get(n);
    this.cache.set(n, null);                      // 순환 방지
    let v = this._parseAt(this.offsets.get(n), n);
    if (v === undefined && !this.scanned) { this._scanAll(); v = this._parseAt(this.offsets.get(n), n); }
    // 압축 객체(/ObjStm)는 풀지 않는다. 다만 **실제로 필요할 때만** 실패한다 —
    // 하이브리드 파일은 메타데이터만 ObjStm 에 넣고 페이지·칼선은 평문으로 두는 경우가 있고,
    // 그걸 미리 걷어차면 읽을 수 있는 파일을 못 읽는다. 대신 조용히 null 로 넘기지 않는다.
    if (v === undefined && this.objStm.has(n))
      throw new Error(`이 PDF 는 객체 ${n} 을 객체 스트림(/ObjStm)에 압축해 넣었다 — 이 추출기는 압축 객체를 읽지 않는다. ` +
        `Illustrator/Acrobat 에서 「호환성: Acrobat 4 (PDF 1.3)」로 다시 저장하면 읽힌다.`);
    const out = v === undefined ? null : v;
    this.cache.set(n, out);
    return out;
  }

  /** offset 위치의 "N G obj … endobj" 를 읽는다. 객체번호가 어긋나면 undefined. */
  _parseAt(off, wantNum) {
    if (off === undefined || off < 0 || off >= this.b.length) return undefined;
    const P = new Cur(this.b, off);
    skipWs(P);
    const n = parseInt(readToken(P), 10);
    skipWs(P); readToken(P);                      // gen
    skipWs(P);
    if (!at(this.b, P.i, "obj")) return undefined;
    if (wantNum !== undefined && n !== wantNum) return undefined;
    P.i += 3;
    const val = parseObj(P);
    skipWs(P);
    if (at(this.b, P.i, "stream")) {
      P.i += 6;
      if (this.b[P.i] === 0x0d) P.i++;
      if (this.b[P.i] === 0x0a) P.i++;
      const start = P.i;
      let len = this.numAt(val?.Length, -1);
      // /Length 가 틀린 PDF 가 실재한다 — endstream 위치로 검산한다.
      const bad = len < 0 || start + len > this.b.length ||
        (!at(this.b, start + len, "endstream") &&
         indexOfLit(this.b, "endstream", start + len, Math.min(this.b.length, start + len + 40)) < 0);
      if (bad) {
        const e = indexOfLit(this.b, "endstream", start);
        if (e < 0) return undefined;
        let t = e;
        while (t > start && WS[this.b[t - 1]]) t--;
        len = t - start;
      }
      return { dict: val, _s: start, _e: start + len, _doc: this };
    }
    return val;
  }

  /** xref 가 틀린 파일(수동 편집·이어붙임) 대비 — 파일 전체에서 "N G obj" 를 훑는다. */
  _scanAll() {
    this.scanned = true;
    const b = this.b;
    for (let i = 0; i + 3 < b.length; i++) {
      if (b[i] !== 0x6f || !at(b, i, "obj")) continue;
      if (isReg(b[i + 3])) continue;
      let j = i - 1;
      while (j >= 0 && WS[b[j]]) j--;
      const ge = j + 1; while (j >= 0 && b[j] >= 48 && b[j] <= 57) j--;
      if (j + 1 === ge) continue;
      let k = j; while (k >= 0 && WS[b[k]]) k--;
      if (k === j) continue;
      const ne = k + 1; while (k >= 0 && b[k] >= 48 && b[k] <= 57) k--;
      if (k + 1 === ne) continue;
      const n = parseInt(bstr(b, k + 1, ne), 10);
      if (Number.isFinite(n)) this.offsets.set(n, k + 1);   // 뒤에 나온 것이 최신
    }
    this.cache.clear();
  }

  /** 스트림 바이트 → 필터 해제 */
  async streamData(s) {
    if (!s || s._s === undefined) return null;
    let data = this.b.subarray(s._s, s._e);
    const fRaw = this.resolve(s.dict?.Filter);
    const filters = fRaw == null ? [] : (Array.isArray(fRaw) ? fRaw.map(f => this.resolve(f)) : [fRaw]);
    const pRaw = this.resolve(s.dict?.DecodeParms ?? s.dict?.DP);
    const parms = Array.isArray(pRaw) ? pRaw.map(p => this.dict(p)) : [this.dict(pRaw)];
    for (let i = 0; i < filters.length; i++) {
      const f = filters[i], pm = parms[i] || (filters.length === 1 ? parms[0] : null);
      if (f === "/FlateDecode" || f === "/Fl") data = unpredict(await inflate(data), pm);
      else if (f === "/ASCII85Decode" || f === "/A85") data = ascii85(data);
      else if (f === "/ASCIIHexDecode" || f === "/AHx") data = asciiHex(data);
      else if (f === "/Crypt") throw new Error("암호화된 스트림(/Crypt)이다 — 이 추출기는 암호화 PDF 를 읽지 않는다.");
      else throw new Error(`지원하지 않는 스트림 필터 ${f} — 칼선을 읽을 수 없다.`);
    }
    return data;
  }
}

/** xref 체인을 따라 offsets 와 trailer 를 채운다 (구식 table + xref stream 둘 다) */
async function loadXref(doc) {
  const b = doc.b;
  const sxAt = lastIndexOfLit(b, "startxref", Math.max(0, b.length - 4096), b.length);
  const seen = new Set();
  let off = -1;
  if (sxAt >= 0) {
    const P = new Cur(b, sxAt + 9); skipWs(P);
    off = parseInt(readToken(P), 10);
  }
  const queue = [];
  if (Number.isFinite(off) && off > 0) queue.push(off);

  while (queue.length) {
    const o = queue.shift();
    if (!Number.isFinite(o) || o <= 0 || o >= b.length || seen.has(o)) continue;
    seen.add(o);
    const P = new Cur(b, o); skipWs(P);
    let tr = null;
    if (at(b, P.i, "xref")) tr = readXrefTable(doc, P);
    else tr = await readXrefStream(doc, o);
    if (!tr) continue;
    for (const [k, v] of Object.entries(tr)) if (!(k in doc.trailer)) doc.trailer[k] = v;
    // 하이브리드 파일은 /XRefStm 에 압축 객체 목록을 따로 둔다
    if (Number.isFinite(tr.XRefStm)) queue.push(tr.XRefStm);
    if (Number.isFinite(tr.Prev)) queue.push(tr.Prev);
  }

  if (doc.trailer.Encrypt)
    throw new Error("암호화된 PDF 다 (/Encrypt) — 암호를 풀지 않으면 칼선을 읽을 수 없다. 보안 해제 후 다시 올려라.");
  if (!doc.trailer.Root) {
    doc._scanAll();
    // ⚠ 여기서 암호화를 한 번 더 본다. startxref 가 깨진 암호화 PDF 는 trailer 를 못 읽어
    //   위 검사를 건너뛰고, 그러면 「스트림 해제 실패」나 쓰레기 좌표로 끝나면서
    //   **암호화라는 진짜 원인이 사용자에게 전달되지 않는다.**
    if (looksEncrypted(doc))
      throw new Error("암호화된 PDF 다 (/Encrypt — xref 가 깨져 trailer 대신 본문에서 찾았다) — " +
        "암호를 풀지 않으면 칼선을 읽을 수 없다. 보안 해제 후 다시 올려라.");
    // trailer 를 못 찾았으면 /Type /Catalog 객체를 직접 찾는다
    for (const n of doc.offsets.keys()) {
      const d = doc.dict(mkRef(n));
      if (d?.Type === "/Catalog") { doc.trailer.Root = mkRef(n); break; }
    }
    if (!doc.trailer.Root) throw new Error("PDF trailer 의 /Root(카탈로그)를 찾지 못했다 — PDF 가 아니거나 손상됐다.");
  }
}

/** trailer 를 못 읽은 파일에서 「암호화된 파일인가」를 본문으로 판정한다.
 *  ① 파일 어디든 /Encrypt 참조가 있으면 암호화다 (trailer 문자열이 깨져도 남아 있다).
 *  ② 표준 보안 핸들러 딕셔너리(/Filter + /V + /O|/U)를 직접 찾는다. */
function looksEncrypted(doc) {
  if (indexOfLit(doc.b, "/Encrypt", 0) >= 0) return true;
  for (const n of doc.offsets.keys()) {
    const d = doc.dict(mkRef(n));
    if (d && typeof d.Filter === "string" && d.V !== undefined &&
        (d.O !== undefined || d.U !== undefined)) return true;
  }
  return false;
}

function readXrefTable(doc, P) {
  const b = P.b;
  P.i += 4;                                       // 'xref'
  for (;;) {
    skipWs(P);
    if (at(b, P.i, "trailer")) { P.i += 7; return parseDict(new Cur(b, skipTo(b, P.i))); }
    const startTok = readToken(P);
    if (!/^\d+$/.test(startTok)) return {};
    skipWs(P);
    const cnt = parseInt(readToken(P), 10);
    if (!Number.isFinite(cnt)) return {};
    let start = parseInt(startTok, 10);
    for (let k = 0; k < cnt; k++) {
      skipWs(P); const o = readToken(P);
      skipWs(P); readToken(P);                    // gen
      skipWs(P); const ty = readToken(P);
      const n = start + k;
      // 첫 xref 가 최신이다 — 이미 있으면 덮지 않는다
      if (ty === "n" && !doc.offsets.has(n)) doc.offsets.set(n, parseInt(o, 10));
    }
  }
}
function skipTo(b, i) { while (WS[b[i]]) i++; return i; }

async function readXrefStream(doc, off) {
  const s = doc._parseAt(off);
  if (!s || s._s === undefined) return null;
  const d = s.dict;
  if (d?.Type !== "/XRef") return null;
  const data = await doc.streamData(s);
  const W = (doc.arr(d.W) || []).map(v => num(doc.resolve(v)));
  if (W.length < 3) throw new Error("xref 스트림의 /W 배열이 올바르지 않다.");
  const size = doc.numAt(d.Size, 0);
  const idxRaw = doc.arr(d.Index);
  const index = idxRaw ? idxRaw.map(v => num(doc.resolve(v))) : [0, size];
  const rowLen = W[0] + W[1] + W[2];
  let p = 0;
  for (let sec = 0; sec + 1 < index.length; sec += 2) {
    for (let k = 0; k < index[sec + 1]; k++, p += rowLen) {
      if (p + rowLen > data.length) break;
      let q = p;
      const rd = w => { let v = 0; for (let i = 0; i < w; i++) v = v * 256 + data[q++]; return v; };
      const type = W[0] === 0 ? 1 : rd(W[0]);
      const f2 = rd(W[1]); rd(W[2]);
      const n = index[sec] + k;
      if (type === 1) { if (!doc.offsets.has(n)) doc.offsets.set(n, f2); }
      else if (type === 2 && !doc.offsets.has(n)) doc.objStm.add(n);   // Doc.get 이 필요할 때 실패시킨다
    }
  }
  return d;
}

// ══════════════════════════════════════════════════════════════════
// 5. 페이지 찾기 — Root → Pages → Kids (MediaBox·Resources 는 상속된다)
// ══════════════════════════════════════════════════════════════════
function collectPages(doc) {
  const root = doc.dict(doc.trailer.Root);
  const pagesRef = root?.Pages;
  const out = [];
  const seen = new Set();
  const walk = (node, inh, depth) => {
    if (depth > 64 || out.length > 5000) return;
    const key = isRef(node) ? node[REF] : null;
    if (key !== null) { if (seen.has(key)) return; seen.add(key); }
    const d = doc.dict(node);
    if (!d) return;
    const next = {
      MediaBox: d.MediaBox ?? inh.MediaBox,
      Resources: d.Resources ?? inh.Resources,
      Rotate: d.Rotate ?? inh.Rotate,
    };
    const kids = doc.arr(d.Kids);
    if (d.Type === "/Page" || (!kids && d.Contents !== undefined)) { out.push({ d, inh: next }); return; }
    if (kids) for (const k of kids) walk(k, next, depth + 1);
  };
  walk(pagesRef ?? doc.trailer.Root, {}, 0);
  if (!out.length) {
    // /Pages 가 깨진 파일 — /Type /Page 를 전수 조사
    doc._scanAll();
    for (const n of doc.offsets.keys()) {
      const d = doc.dict(mkRef(n));
      if (d?.Type === "/Page") out.push({ d, inh: { MediaBox: d.MediaBox, Resources: d.Resources, Rotate: d.Rotate } });
    }
  }
  return out;
}

// ══════════════════════════════════════════════════════════════════
// 6. 콘텐트 스트림 해석기 — pdfgeom2.py 포팅
//    구현 연산자: cm / q / Q / m / l / c / v / y / re / h + Form XObject 재귀 + CTM
//    페인팅 연산자(S s f F f* B B* b b* n)에서 현재 경로를 res 로 확정한다.
//    ※ 페인팅 종류로 칼선을 가리지 **않는다**. 검증된 Python 구현이 모든 서브패스를
//      모았고, 칼선 도면은 선(S)·클립(n)·채움이 섞여 있어 걸러내면 성분이 끊긴다.
// ══════════════════════════════════════════════════════════════════
const IDENT = [1, 0, 0, 1, 0, 0];
/** m × ctm (PDF cm 은 왼쪽 곱) */
function mul(m, c) {
  return [
    m[0] * c[0] + m[1] * c[2],
    m[0] * c[1] + m[1] * c[3],
    m[2] * c[0] + m[3] * c[2],
    m[2] * c[1] + m[3] * c[3],
    m[4] * c[0] + m[5] * c[2] + c[4],
    m[4] * c[1] + m[5] * c[3] + c[5],
  ];
}
const tx = (c, x, y) => [c[0] * x + c[2] * y + c[4], c[1] * x + c[3] * y + c[5]];

/** 콘텐트 스트림 1개를 해석해 res(서브패스 배열)에 쌓는다 */
async function run(doc, data, ctm0, res, resources, depth, st8) {
  const b = data, P = new Cur(b, 0);
  const stack = [];                  // CTM 스택 (q/Q)
  let ctm = ctm0;
  let ops = [];                      // 오퍼랜드
  let path = [], sub = null, startPt = null, curPt = null;

  const flush = () => {
    for (const sp of path) if (sp.length >= 2) { res.push(sp); st8.pts += sp.length; }
    path = []; sub = null;
  };
  const moveTo = (x, y) => { sub = [tx(ctm, x, y)]; path.push(sub); startPt = [x, y]; curPt = [x, y]; };
  const lineTo = (x, y) => { if (!sub) moveTo(x, y); else { sub.push(tx(ctm, x, y)); curPt = [x, y]; } };
  const curveTo = (x1, y1, x2, y2, x3, y3) => {
    if (!sub) moveTo(x1, y1);
    const p0 = sub[sub.length - 1], p1 = tx(ctm, x1, y1), p2 = tx(ctm, x2, y2), p3 = tx(ctm, x3, y3);
    for (let k = 1; k <= BEZ_STEPS; k++) {
      const t = k / BEZ_STEPS, u = 1 - t;
      const a = u * u * u, bq = 3 * u * u * t, cq = 3 * u * t * t, dq = t * t * t;
      sub.push([a * p0[0] + bq * p1[0] + cq * p2[0] + dq * p3[0],
                a * p0[1] + bq * p1[1] + cq * p2[1] + dq * p3[1]]);
    }
    curPt = [x3, y3];
  };

  while (P.i < b.length) {
    if (st8.pts > MAX_POINTS) { st8.overflow = true; break; }
    skipWs(P);
    if (P.i >= b.length) break;
    const c = b[P.i];
    // 값 토큰
    if (c === 0x2f) { ops.push(readName(P)); continue; }
    if (c === 0x28) { ops.push(readLiteralString(P)); continue; }
    if (c === 0x5b || c === 0x3c) { ops.push(parseObj(P)); continue; }   // 배열 · 딕셔너리(BDC/DP) · 16진 문자열
    if (c === 0x5d || c === 0x3e || c === 0x7b || c === 0x7d) { P.i++; continue; }
    if ((c >= 0x30 && c <= 0x39) || c === 0x2b || c === 0x2d || c === 0x2e) {
      const t = readToken(P); const v = parseFloat(t);
      // 연산자 없이 숫자만 이어지는 깨진 스트림에서 오퍼랜드 배열이 무한히 커지는 것을 막는다.
      // 실제 연산자는 최대 6개(cm/c)만 쓰므로 32개면 넉넉하다.
      if (ops.length > 32) ops.shift();
      ops.push(Number.isFinite(v) ? v : 0); continue;
    }
    const op = readToken(P);
    if (op === "") { P.i++; continue; }
    const n = ops.length;
    switch (op) {
      case "q": stack.push(ctm); break;
      case "Q": if (stack.length) ctm = stack.pop(); break;
      case "cm": if (n >= 6) ctm = mul(ops.slice(n - 6), ctm); break;
      case "m": if (n >= 2) moveTo(ops[n - 2], ops[n - 1]); break;
      case "l": if (n >= 2) lineTo(ops[n - 2], ops[n - 1]); break;
      case "c": if (n >= 6) curveTo(...ops.slice(n - 6)); break;
      case "v": if (n >= 4 && curPt) curveTo(curPt[0], curPt[1], ops[n - 4], ops[n - 3], ops[n - 2], ops[n - 1]); break;
      case "y": if (n >= 4) curveTo(ops[n - 4], ops[n - 3], ops[n - 2], ops[n - 1], ops[n - 2], ops[n - 1]); break;
      case "h": if (sub && startPt) { sub.push(tx(ctm, startPt[0], startPt[1])); curPt = startPt.slice(); } break;
      case "re": if (n >= 4) {
        const [x, y, w, h] = ops.slice(n - 4);
        const sp = [tx(ctm, x, y), tx(ctm, x + w, y), tx(ctm, x + w, y + h), tx(ctm, x, y + h), tx(ctm, x, y)];
        path.push(sp); sub = sp; startPt = [x, y]; curPt = [x, y];
      } break;
      case "S": case "s": case "f": case "F": case "f*":
      case "B": case "B*": case "b": case "b*": case "n":
        if ((op === "s" || op === "b" || op === "b*") && sub && startPt) sub.push(tx(ctm, startPt[0], startPt[1]));
        flush(); break;
      case "BI": {
        // 인라인 이미지의 이진 데이터가 연산자처럼 보일 수 있다 — EI 까지 통째로 건너뛴다
        let j = indexOfLit(b, "EI", P.i);
        while (j > 0 && !(WS[b[j - 1]] && (j + 2 >= b.length || WS[b[j + 2]] || DELIM[b[j + 2]])))
          j = indexOfLit(b, "EI", j + 1);
        P.i = j < 0 ? b.length : j + 2;
        break;
      }
      case "Do": {
        const nm = ops[n - 1];
        if (typeof nm === "string" && nm[0] === "/") {
          // 깊이 컷을 **조용히** 버리지 않는다. 얕은 곳에 60×40, 14중첩 최심부에 진짜 칼선
          // 300×180 이 있으면 60×40 을 무경고로 돌려주고, 다른 도형이 없으면 에러 문구가
          // 「이미지만 있는 PDF」라고 원인을 잘못 지목했다.
          if (depth >= MAX_XOBJ_DEPTH) {
            st8.errors.push(`Form XObject 중첩이 ${MAX_XOBJ_DEPTH}단을 넘어 ${nm} 이하를 읽지 않았다 — 그 안의 칼선이 빠졌다.`);
            break;
          }
          const xo = doc.dict(doc.dict(resources)?.XObject);
          const s = doc.resolve(xo?.[nm.slice(1)]);
          // 자기(또는 조상) Form 을 다시 부르는 파일이 실재한다 — 오프셋으로 순환을 끊는다.
          // 깊이 제한만으로는 자기호출 2개짜리 Form 이 2^12 번 실행된다.
          if (s && s._s !== undefined && !st8.path.has(s._s) && doc.resolve(s.dict?.Subtype) === "/Form") {
            const mtx = (doc.arr(s.dict.Matrix) || []).map(v => num(doc.resolve(v)));
            const sub2 = mtx.length === 6 ? mul(mtx, ctm) : ctm;
            let sd = null;
            try { sd = await doc.streamData(s); } catch (e) { st8.errors.push(e.message); }
            if (sd) {
              const before = res.length;
              st8.path.add(s._s);
              await run(doc, sd, sub2, res, s.dict.Resources ?? resources, depth + 1, st8);
              st8.path.delete(s._s);
              // Form 의 /BBox 는 **클립이다** (PDF 32000-1 §8.10.2). 클리핑까지 구현하지는
              // 않지만, 밖으로 나간 점이 있으면 알린다 — 잘라 넣은 배치 PDF(placed PDF)가
              // Form 으로 들어오면 화면에는 50×25 인데 300×200 을 무경고로 돌려준다.
              const bx = (doc.arr(s.dict.BBox) || []).map(v => num(doc.resolve(v)));
              if (bx.length === 4 && res.length > before) {
                const cs = [tx(sub2, bx[0], bx[1]), tx(sub2, bx[2], bx[1]),
                            tx(sub2, bx[2], bx[3]), tx(sub2, bx[0], bx[3])];
                const gx0 = Math.min(...cs.map(p => p[0])), gx1 = Math.max(...cs.map(p => p[0]));
                const gy0 = Math.min(...cs.map(p => p[1])), gy1 = Math.max(...cs.map(p => p[1]));
                const T = 0.05;
                let outside = 0;
                for (let i = before; i < res.length; i++)
                  for (const [x, y] of res[i])
                    if (x < gx0 - T || x > gx1 + T || y < gy0 - T || y > gy1 + T) outside++;
                if (outside) st8.errors.push(
                  `Form XObject ${nm} 의 /BBox(${(gx1 - gx0).toFixed(1)}×${(gy1 - gy0).toFixed(1)}mm) 밖으로 나간 점이 ${outside}개다 ` +
                  `— 화면에는 잘려 보이므로 추출 크기가 실제보다 클 수 있다 (클리핑은 적용하지 않았다).`);
              }
            }
          }
        }
        break;
      }
      default: break;                              // 색·텍스트·상태 연산자는 무시
    }
    ops = [];
  }
  flush();
}

// ══════════════════════════════════════════════════════════════════
// 7. 연결성분 분해 — flaps.py segs()/components() 포팅
//    좌표를 0.01mm 격자로 반올림해 같은 점을 같은 노드로 본다.
// ══════════════════════════════════════════════════════════════════
function buildComponents(subpaths) {
  const key = new Map();             // "x|y" → node id
  const px = [], py = [];
  const nodeOf = (x, y) => {
    const xi = Math.round(x * GRID), yi = Math.round(y * GRID);
    const k = xi + "|" + yi;
    let id = key.get(k);
    if (id === undefined) { id = px.length; key.set(k, id); px.push(xi / GRID); py.push(yi / GRID); }
    return id;
  };
  // 선분 목록 (중복·길이0 제거) + 폴리라인 보존
  const polys = [];                  // [[nodeId,...], ...]
  const edges = [];                  // [a,b]
  const eSeen = new Set();
  for (const sp of subpaths) {
    const ids = [];
    for (const [x, y] of sp) {
      const id = nodeOf(x, y);
      if (!ids.length || ids[ids.length - 1] !== id) ids.push(id);
    }
    if (ids.length < 2) continue;
    polys.push(ids);
    for (let i = 0; i + 1 < ids.length; i++) {
      const a = ids[i], bq = ids[i + 1];
      const k = a < bq ? a + "," + bq : bq + "," + a;
      if (eSeen.has(k)) continue;
      eSeen.add(k); edges.push([a, bq]);
    }
  }
  // union-find
  const par = new Int32Array(px.length);
  for (let i = 0; i < par.length; i++) par[i] = i;
  const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  for (const [a, bq] of edges) { const ra = find(a), rb = find(bq); if (ra !== rb) par[ra] = rb; }

  const comps = new Map();           // root → { nodes, segs, x0,y0,x1,y1 }
  for (let i = 0; i < px.length; i++) {
    const r = find(i);
    let cc = comps.get(r);
    if (!cc) { cc = { nodes: [], segs: 0, x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity, polys: [] }; comps.set(r, cc); }
    cc.nodes.push(i);
    if (px[i] < cc.x0) cc.x0 = px[i]; if (px[i] > cc.x1) cc.x1 = px[i];
    if (py[i] < cc.y0) cc.y0 = py[i]; if (py[i] > cc.y1) cc.y1 = py[i];
  }
  for (const [a] of edges) comps.get(find(a)).segs++;
  for (const ids of polys) comps.get(find(ids[0])).polys.push(ids);
  return { comps: [...comps.values()], px, py };
}

const bboxOf = c => ({ x0: c.x0, y0: c.y0, x1: c.x1, y1: c.y1, w: +(c.x1 - c.x0).toFixed(2), h: +(c.y1 - c.y0).toFixed(2) });

// ══════════════════════════════════════════════════════════════════
// 8. 성분 병합 — 칼선 한 장이 한 성분이 아니다
//
//   실측으로 확인한 구조 (4건 전부 동일):
//     소스코    몸통 380.3×208.5 (y 45.97~254.47) + 혀 138.6×15 (y 254.47~269.47) = 223.5
//     웨이크p0  몸통 198.3×219.0 (y 55.76~274.76) + 혀  44.6×15 (y 274.76~289.76) = 234.0
//     바이오머  몸통 344.3×180.0 (y 31.66~211.66) + 혀 148.6×15 **위아래 둘**      = 210.0
//     도솔      몸통 214.3×238.0 (y 18.15~256.15) + 혀  48.6×15 (y 256.15~271.15) = 253.0
//   텍 혀는 **접는선을 공유한다** — 몸통 y 경계에 정확히 붙고(오차 0.00mm) 바깥으로만
//   나간다. 이게 병합 조건이다. 크기를 이미 아는 것으로 찾는 방법(flaps2.py 의
//   expectW)은 답을 아는 경우에만 되므로 쓰지 않는다.
//
//   ⚠ 안쪽에 든 성분은 병합하지 않는다. 바이오머에는 몸통 경계를 **걸치는**
//     152.76×46.4 배치 이미지 사각형이 있는데, 종전 규칙(y 여유 60mm)이 그걸 삼켜
//     netH 를 210.0 → 267.79 로 부풀렸다. 안쪽 성분은 bbox 를 바꾸지 않으므로
//     아트워크와 구분할 필요도 없다 — 그냥 넣지 않는다.
// ══════════════════════════════════════════════════════════════════
const ABUT_TOL = 0.6;    // 접는선 공유 판정 폭(mm). 실측 4건은 전부 0.00 이다.
const SPAN_TOL = 2.0;    // 붙는 변의 반대축이 몸통 안에 들어와야 하는 여유(mm)
const FLAP_MAX = 70.0;   // 날개·혀가 몸통 밖으로 나가는 최대 깊이(mm)

/** c 가 seed 의 위/아래 변에 붙어 바깥으로만 나가는 날개·혀인가
 *
 *  ⚠ 좌/우(x 방향) 병합은 **하지 않는다.** 실측 4건의 별개 성분은 전부 위/아래 텍 혀다.
 *    x 방향을 대칭으로 열어두면 2up 대지에서 **옆 판의 조각**을 끌어온다 —
 *    iSHAP 무제-3(788×545 에 같은 판 2개)에서 오른쪽 판의 17.44mm 조각이 왼쪽 판의
 *    오른쪽 경계에 붙어 557.1 → 574.54 로 부풀었다. 2up 대지를 읽는 것이 이 도구의
 *    목적이므로 근거 없는 축을 열어두는 쪽이 손해다. 측면 접착탭이 별개 성분인 도면이
 *    나오면 그때 실측을 근거로 열어라 (지금 실측 8건에는 없다). */
function isFlap(seed, c) {
  if (c.x0 < seed.x0 - SPAN_TOL || c.x1 > seed.x1 + SPAN_TOL) return false;
  if (Math.abs(c.y0 - seed.y1) <= ABUT_TOL && c.y1 - seed.y1 <= FLAP_MAX) return true;
  if (Math.abs(c.y1 - seed.y0) <= ABUT_TOL && seed.y0 - c.y0 <= FLAP_MAX) return true;
  return false;
}

function mergeInto(seed, pool) {
  // used: 이 후보가 흡수한 성분 목록. 「후보에도 못 들고 어디에도 안 붙은 성분」을
  //       경고로 알리기 위해 필요하다 (흡수된 텍 혀를 「빠졌다」고 알리면 거짓말이다).
  const g = { nodes: [...seed.nodes], segs: seed.segs, polys: [...seed.polys], x0: seed.x0, y0: seed.y0, x1: seed.x1, y1: seed.y1, parts: 1, used: [seed] };
  // 한 겹만 붙인다. 날개는 몸통 패널에 직접 붙고(2단으로 붙는 날개는 실측에 없다),
  // 여러 겹을 허용하면 경계가 커지면서 아트워크를 줄줄이 끌고 온다.
  for (const c of pool) {
    if (c === seed || !isFlap(seed, c)) continue;
    g.nodes.push(...c.nodes); g.segs += c.segs; g.polys.push(...c.polys); g.parts++; g.used.push(c);
    g.x0 = Math.min(g.x0, c.x0); g.y0 = Math.min(g.y0, c.y0);
    g.x1 = Math.max(g.x1, c.x1); g.y1 = Math.max(g.y1, c.y1);
  }
  return g;
}

// ── 두 겹 윤곽 (도련 + 칼선) ──────────────────────────────────────
//  ⚠ 이 판정은 **양방향으로 틀릴 수 있다.** 둘 다 실제로 밟았다:
//    · 판정이 안 걸리면 바깥(도련)이 조용히 1순위가 됐다 — 사방 15mm 도련에서
//      530×330 을 경고 0개로 돌려줬다(실제 칼선 500×300).
//    · 판정이 헐거우면 안쪽을 잘못 골랐다 — 칼선 안쪽 3mm 안전선을 칼선으로 고르고
//      「바깥 500×300 을 도련으로 봤다」고 **확신하듯** 출력했다.
//  그래서 근거의 세기를 둘로 나눈다:
//    strong  사방 균일 + 충분히 두꺼움 → pick 을 안쪽으로 **바꾼다** (iSHAP 실측 5.91mm)
//    그 밖   감싸는 쌍이 있다는 **사실만 경고**하고 pick 은 건드리지 않는다.
//            얇은 인셋(선폭 윤곽 0.6mm)·안전선(3mm)·도련(3mm)은 기하학적으로 구별되지
//            않는다 — 구별할 수 없는 것을 단정하지 않는 것이 이 분기의 전부다.
const NEST_STRONG = 4.0;    // 이 이상 사방 균일하게 감싸면 도련으로 본다 (iSHAP 5.91)
const NEST_MAX = 12;        // 사방 12mm 넘는 도련은 실측에 없다 (종전 컷 유지)
const NEST_UNIFORM = 2.5;   // 사방 인셋 편차 상한 (종전 컷 유지)
const NEST_NOISE = 0.3;     // 이보다 얇으면 좌표 격자 잡음이다
const NEST_NEAR = 30;       // 이 안쪽이면 「거의 같은 크기의 감싸는 쌍」 → 경고 대상

/** outer 가 inner 를 감싸는가. 감싸면 사방 인셋과 근거 세기를 돌려준다.
 *  min ≥ 0 만 요구한다 — 한 변이 딱 붙은 도련(위쪽만 0)도 **경고 대상**이어야 한다. */
function nestedInset(outer, inner) {
  const l = inner.x0 - outer.x0, r = outer.x1 - inner.x1;
  const bq = inner.y0 - outer.y0, t = outer.y1 - inner.y1;
  const ins = [l, r, bq, t];
  const mn = Math.min(...ins), mx = Math.max(...ins);
  if (mn < -0.05 || mx <= NEST_NOISE) return null;       // 감싸지 않음 · 사실상 같은 크기
  return {
    mn, mx, mid: +((mx + mn) / 2).toFixed(2),
    strong: mn >= NEST_STRONG && mx <= NEST_MAX && mx - mn <= NEST_UNIFORM,
  };
}

// ══════════════════════════════════════════════════════════════════
// 9. 공개 API
// ══════════════════════════════════════════════════════════════════
/**
 * PDF 바이트에서 칼선 전개도 실측 크기를 읽는다.
 * @param {Uint8Array|ArrayBuffer} bytes
 * @param {{page?:number, source?:string, maxCandidates?:number}} [opt]
 * @returns {Promise<{pageSize:{w:number,h:number}, bbox:{w:number,h:number},
 *   polygons:number[][][], candidates:object[], source:string, unit:"mm",
 *   warnings:string[], pageCount:number, sheetId:string|null}>}
 */
export async function readDieline(bytes, opt = {}) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const source = opt.source || "(unnamed.pdf)";
  const warnings = [];
  if (b.length < 32 || !at(b, 0, "%PDF")) {
    // %PDF 가 앞쪽 1KB 안에 있는 파일도 있다(앞에 쓰레기가 붙은 경우)
    const h = indexOfLit(b, "%PDF-", 0, Math.min(b.length, 1024));
    if (h < 0) throw new Error(`PDF 파일이 아니다 (%PDF 머리글 없음): ${source}`);
  }
  const doc = new Doc(b);
  await loadXref(doc);
  const pages = collectPages(doc);
  if (!pages.length) throw new Error(`페이지를 찾지 못했다: ${source}`);
  const pi = Math.min(Math.max(0, opt.page | 0), pages.length - 1);
  if ((opt.page | 0) !== pi) warnings.push(`페이지 ${opt.page} 가 없어 ${pi} 페이지를 읽었다 (총 ${pages.length}장).`);
  const { d: page, inh } = pages[pi];

  // ── 페이지 크기 ──
  const mb = (doc.arr(page.MediaBox ?? inh.MediaBox) || []).map(v => num(doc.resolve(v)));
  if (mb.length !== 4) throw new Error(`/MediaBox 를 읽지 못했다: ${source}`);
  const ox = Math.min(mb[0], mb[2]), oy = Math.min(mb[1], mb[3]);
  const rawW = +(Math.abs(mb[2] - mb[0]) * K).toFixed(2);
  const rawH = +(Math.abs(mb[3] - mb[1]) * K).toFixed(2);
  // ⚠ 타당성 검사 — 물리적으로 불가능한 값을 조용히 통과시키면 SheetCanvas 에 0 크기 판이
  //   내려가고 견적에는 그 숫자가 그대로 들어간다. MediaBox [0 0 0 0] 이나 원소가 없는
  //   간접참조(num() 이 0 으로 접힘)가 실제로 그런 값을 만든다.
  if (!(rawW > 0) || !(rawH > 0))
    throw new Error(`페이지 크기가 0 이다 (/MediaBox [${mb.join(" ")}]) — 손상된 PDF 다: ${source}`);
  if (rawW > MAX_MM || rawH > MAX_MM)
    warnings.push(`페이지가 ${rawW}×${rawH}mm 다 — PDF 최대 페이지(${MAX_MM}mm)를 넘는다. /MediaBox 가 깨졌을 수 있다.`);

  // ── /Rotate — **보이는 대로** 회전을 적용한다 ──
  //   왜: /Rotate 90 이면 화면에서는 가로·세로가 뒤바뀐 페이지가 보인다. 회전을 안 걸면
  //   bbox 의 w·h 가 화면과 반대로 나오고 그 값이 nW/nH 로 견적에 들어간다.
  //   회전 후에도 좌표가 (0,0)~(페이지) 안에 있어야 하므로 이동까지 같이 넣는다.
  const rot = ((doc.numAt(page.Rotate ?? inh.Rotate, 0) % 360) + 360) % 360;
  const rotM = rot === 90 ? [0, -1, 1, 0, 0, rawW]
             : rot === 180 ? [-1, 0, 0, -1, rawW, rawH]
             : rot === 270 ? [0, 1, -1, 0, rawH, 0]
             : IDENT;
  const swap = rot === 90 || rot === 270;
  const pageSize = { w: swap ? rawH : rawW, h: swap ? rawW : rawH };
  if (rot) warnings.push(`페이지 /Rotate ${rot}° 를 적용해 화면에 보이는 방향으로 맞췄다 (페이지 ${pageSize.w}×${pageSize.h}mm).`);

  // ── 콘텐트 스트림 ──
  const cRaw = doc.resolve(page.Contents);
  const streams = Array.isArray(cRaw) ? cRaw.map(v => doc.resolve(v)) : [cRaw];
  const st8 = { pts: 0, overflow: false, errors: [], path: new Set() };
  const res = [];
  // MediaBox 원점을 (0,0) 으로 옮기고 pt→mm 스케일을 CTM 에 넣은 뒤 /Rotate 를 곱한다.
  // 이렇게 하면 아래 모든 좌표가 처음부터 mm 이고, 폴리곤을 나중에 다시 훑지 않는다.
  const base = mul([K, 0, 0, K, -ox * K, -oy * K], rotM);
  // ⚠ /Contents 가 배열이면 **이어붙인 하나의 스트림**이다 (PDF 32000-1 §7.8.2).
  //   스트림마다 run() 을 새로 부르면 CTM·q/Q 스택이 초기화된다 — 스트림1 이
  //   `[mm cm] 2 0 0 2 0 0 cm`, 스트림2 가 50×30 폴리곤이면 100×60mm 가 나와야 하는데
  //   17.64×10.58mm(pt 를 mm 로 오해한 크기)를 경고 없이 돌려줬다.
  const chunks = [];
  for (const s of streams) {
    if (!s || s._s === undefined) continue;
    let data = null;
    try { data = await doc.streamData(s); }
    catch (e) { warnings.push(`콘텐트 스트림 해제 실패: ${e.message}`); continue; }
    if (data) chunks.push(data);
  }
  if (!chunks.length) throw new Error(`페이지 ${pi} 의 /Contents 스트림을 읽지 못했다: ${source}`);
  let joined = chunks[0];
  if (chunks.length > 1) {
    // 경계에서 토큰이 붙지 않게 개행(0x0A)을 끼워 이어붙인다 — 규격이 정한 방식이다.
    let tot = chunks.length - 1;
    for (const c of chunks) tot += c.length;
    joined = new Uint8Array(tot);
    let o = 0;
    for (let i = 0; i < chunks.length; i++) {
      if (i) joined[o++] = 0x0a;
      joined.set(chunks[i], o); o += chunks[i].length;
    }
  }
  await run(doc, joined, base, res, page.Resources ?? inh.Resources, 0, st8);
  if (st8.overflow) warnings.push(`도형이 너무 많아 ${MAX_POINTS.toLocaleString()}점에서 끊었다 — 칼선 후보가 빠졌을 수 있다.`);
  for (const e of new Set(st8.errors)) warnings.push(`XObject 처리 경고: ${e}`);

  // ── 성분 분해 ──
  const { comps, px, py } = buildComponents(res);
  if (!comps.length) throw new Error(`벡터 도형이 없다 (이미지만 있는 PDF 일 수 있다): ${source}`);

  // ── 후보 만들기 ──────────────────────────────────────────────────
  // 순위 근거 (크기를 아는 것으로 찾지 않는다):
  //   ① 페이지 크기에 가까운 큰 성분          → fill
  //   ② 선분이 적고 bbox 가 큰 성분           → 아트워크는 선분이 많고 bbox 가 작다
  //   ③ 두 겹 윤곽이면 안쪽(칼선)을 고른다    → 바깥은 도련
  const pageArea = Math.max(1, pageSize.w * pageSize.h);
  // 아트워크에 파묻히지 않게, 의미 있는 크기의 성분만 seed 로 본다.
  //  · nodes >= 8 : 칼선 전개도는 **꼭짓점이 4개인 단순 사각형이 아니다**. 이 조건 하나가
  //    대지·도련 사각형(정점 4개)을 걸러낸다 — 실측 8건 전부 그 사각형을 갖고 있고,
  //    페이지를 꽉 채우므로 아래 어떤 점수로도 1순위가 됐다.
  //  · 짧은변 문턱은 **절대값**이다. 종전에는 `max(20, 짧은변 × 0.15)` 라 788×545 판에서
  //    81.75mm 가 됐고, 150×81 짜리 진짜 칼선이 1mm 차이로 후보에서 사라졌다
  //    (후보에 없으면 화면 드롭다운으로도 고를 수 없어 사용자가 복구할 방법이 없다).
  //    작은 상자를 다up 으로 앉힌 대지(150×75 를 10up)가 정확히 그 구간이다.
  //    비율을 없애고 종전 하한값 20mm 를 그대로 문턱으로 쓴다 — 판 크기와 무관해진다.
  const MIN_SIDE = 20;
  const bigEnough = c => (c.x1 - c.x0) >= MIN_SIDE && (c.y1 - c.y0) >= MIN_SIDE;
  const seeds = comps
    .filter(c => c.nodes.length >= 8 && bigEnough(c))
    .sort((a, b2) => ((b2.x1 - b2.x0) * (b2.y1 - b2.y0)) - ((a.x1 - a.x0) * (a.y1 - a.y0)))
    .slice(0, 40);
  // ⚠ seed 가 없으면 **폴백하지 않는다.** 종전에는 comps[0](파일에서 가장 먼저 그려진
  //   성분)을 근거 없이 채택해서, 표 괘선만 있는 견적서 PDF 를 160×60mm 로, 재단 마크
  //   8개를 10×10mm 로 경고 0개에 돌려주고 그 값이 nW/nH 에 자동 기입됐다.
  if (!seeds.length) {
    const big = comps.slice().sort((a, b2) =>
      (b2.x1 - b2.x0) * (b2.y1 - b2.y0) - (a.x1 - a.x0) * (a.y1 - a.y0))[0];
    throw new Error(`칼선으로 볼 만한 도형이 없다 — 정점 8개 이상이고 두 변이 ${MIN_SIDE}mm 이상인 성분이 0개다 ` +
      `(가장 큰 성분 ${(big.x1 - big.x0).toFixed(1)}×${(big.y1 - big.y0).toFixed(1)}mm). 칼선 도면이 맞는지 확인해라: ${source}`);
  }

  const pool = comps.filter(c => c.nodes.length >= 2);
  const raw = [];
  let tooBig = 0;
  for (const s of seeds) {
    const g = mergeInto(s, pool);
    const bb = bboxOf(g);
    if (bb.w < 1 || bb.h < 1) continue;
    // 물리적으로 불가능한 크기는 도형이 아니라 좌표 오류다 — 후보에서 뺀다
    if (bb.w > MAX_MM || bb.h > MAX_MM) { tooBig++; continue; }
    raw.push({ g, bb });
  }
  if (tooBig) warnings.push(`한 변이 ${MAX_MM}mm(PDF 최대 페이지)를 넘는 성분 ${tooBig}개를 후보에서 뺐다 — 좌표가 깨진 도형이다.`);
  // 문턱에 걸려 사라진 「길지만 얇은」 성분은 세어서 알린다 — 조용히 없어지면 안 된다.
  //   단, 어느 후보에 흡수된 것은 세지 않는다 (텍 혀 138.6×15 는 칼선에 붙어 들어갔다).
  const absorbed = new Set();
  for (const r of raw) for (const c of r.g.used) absorbed.add(c);
  const thin = comps.filter(c => c.nodes.length >= 8 && !bigEnough(c) && !absorbed.has(c) &&
    Math.max(c.x1 - c.x0, c.y1 - c.y0) >= 120);
  if (thin.length) {
    const t0 = thin.slice().sort((a, b2) =>
      (b2.x1 - b2.x0) * (b2.y1 - b2.y0) - (a.x1 - a.x0) * (a.y1 - a.y0))[0];
    warnings.push(`짧은변이 ${MIN_SIDE}mm 미만이라 후보에서 제외한 긴 성분이 ${thin.length}개 있다 ` +
      `(가장 큰 것 ${(t0.x1 - t0.x0).toFixed(1)}×${(t0.y1 - t0.y0).toFixed(1)}mm) — 칼선이 그 안에 있으면 후보에 안 뜬다.`);
  }
  // 같은 bbox 로 수렴한 후보 중복 제거 (0.2mm 이내면 같은 것으로 본다)
  const uniq = [];
  for (const r of raw.sort((a, b2) => b2.bb.w * b2.bb.h - a.bb.w * a.bb.h)) {
    if (uniq.some(u => Math.abs(u.bb.w - r.bb.w) < 0.2 && Math.abs(u.bb.h - r.bb.h) < 0.2 &&
                       Math.abs(u.bb.x0 - r.bb.x0) < 0.2 && Math.abs(u.bb.y0 - r.bb.y0) < 0.2)) continue;
    uniq.push(r);
  }

  // ── 점수 ─────────────────────────────────────────────────────────
  //  fit    페이지 크기에 **가장 가까운** 면적. min/max 라서 1.0 에서 봉우리다.
  //         (그냥 area/pageArea 로 두면 "가장 가까운" 이 아니라 "가장 큰" 이 되고,
  //          아트보드 밖 캔버스에 놓인 스크래치 도형이 이긴다 — 도솔 260129 가 그 케이스다.)
  //  simple 선분이 적고 bbox 가 큰 성분. 칼선은 60~250 선분, 아트워크는 수천이다.
  //  off    MediaBox(아트보드) 밖으로 나간 면적 비율 — 캔버스 여백에 버려둔 도형 벌점.
  //  back   대지·배경 윤곽 벌점. ⚠ 종전에는 「페이지와 ±1mm」 라는 **절대값**이었는데,
  //         788×545 판에 4mm 안쪽으로 들어온 배경(780×537, 정점 8)이 벌점을 완전히 피하고
  //         경고 0개로 1순위를 먹었다. 모서리 둥근 배경은 정점 4개 필터도 못 걸러낸다.
  //         그래서 「페이지 면적의 85% 이상 + 성분이 단순함(선분 ≤60)」 비율 조건으로 바꿨다.
  //         실측 8건의 칼선은 페이지 면적의 11~68% 이므로 이 조건에 걸리지 않는다.
  const BACK_AREA = 0.85, BACK_SEGS = 60;
  const scored = uniq.map(r => {
    const area = r.bb.w * r.bb.h;
    const fit = Math.min(area, pageArea) / Math.max(area, pageArea);
    const simple = Math.min(1, 260 / Math.max(20, r.g.segs));
    const ix = Math.max(0, Math.min(r.bb.x1, pageSize.w) - Math.max(r.bb.x0, 0));
    const iy = Math.max(0, Math.min(r.bb.y1, pageSize.h) - Math.max(r.bb.y0, 0));
    const off = 1 - (ix * iy) / Math.max(1, area);
    const ratio = area / pageArea;
    const back = ratio >= BACK_AREA && r.g.segs <= BACK_SEGS ? 0.6 : 0;
    return { ...r, area, fit, simple, off, ratio,
      score: +(fit * 0.68 + simple * 0.32 - off * 0.25 - back).toFixed(4) };
  }).sort((a, b2) => b2.score - a.score);

  // ⚠ 여기서 후보가 0개면 아래 pick 이 undefined 가 되고 pick.g 에서 생 TypeError 가
  //   사용자 화면에 그대로 떴다. §C 「조용히 틀리지 말고 명확히 실패한다」 규약이다.
  if (!scored.length)
    throw new Error(`칼선으로 볼 만한 도형이 없다 (1mm 이상 · ${MAX_MM}mm 이하인 성분이 0개다): ${source}`);

  // ── 두 겹 윤곽 ───────────────────────────────────────────────────
  //  근거가 strong 인 쌍만 pick 을 바꾼다. 그 밖의 「거의 같은 크기로 감싸는 쌍」은
  //  채택 여부와 무관하게 **경고만** 남긴다 — 판정 실패를 침묵으로 처리하지 않는 것이
  //  이 블록의 요점이다. 종전에는 ① 판정이 안 걸리면 바깥(도련)이 조용히 이기고
  //  ② scored.find 가 순위 무관하게 아무 성분이나 inner 로 채택했고
  //  ③ break 가 첫 쌍만 보고 끊어 뒤의 진짜 도련/칼선 쌍은 검사도 안 했다.
  const TOP_N = scored.slice(0, 6);        // inner·outer 후보를 상위권으로 제한 (②)
  let pick = scored[0];
  let switched = null;
  const ambiguous = [];
  for (const outer of TOP_N) {
    for (const inner of TOP_N) {           // 첫 쌍에서 끊지 않는다 (③)
      if (inner === outer) continue;
      const ins = nestedInset(outer.bb, inner.bb);
      if (!ins) continue;
      if (ins.strong && !switched && (outer === pick || inner === pick)) {
        switched = { outer, inner, inset: ins.mid };
      } else if (!ins.strong && ins.mx <= NEST_NEAR) {
        ambiguous.push({ outer, inner, ins });
      }
    }
  }
  if (switched) {
    warnings.push(`윤곽이 두 겹이다 — 바깥 ${switched.outer.bb.w}×${switched.outer.bb.h} 를 도련(사방 ${switched.inset}mm)으로 보고 안쪽 ${switched.inner.bb.w}×${switched.inner.bb.h} 를 칼선으로 골랐다.`);
    pick = switched.inner;
  }
  // 판정 못 한 겹은 최대 2건까지 알린다 (같은 파일에서 수십 쌍이 나오면 화면이 묻힌다)
  for (const a of ambiguous.slice(0, 2))
    warnings.push(`바깥 ${a.outer.bb.w}×${a.outer.bb.h} / 안쪽 ${a.inner.bb.w}×${a.inner.bb.h} 두 겹이 있는데 ` +
      `어느 쪽이 칼선인지 판정하지 못했다 (사방 인셋 ${a.ins.mn.toFixed(1)}~${a.ins.mx.toFixed(1)}mm) — 화면에서 확인해라.`);

  if (scored.length > 1 && scored[0] !== pick) { /* 위에서 알렸다 */ }
  else if (scored.length > 1 && scored[1].score > scored[0].score - 0.06)
    warnings.push(`1·2순위 후보 점수가 가깝다 (${scored[0].bb.w}×${scored[0].bb.h} vs ${scored[1].bb.w}×${scored[1].bb.h}) — 화면에서 확인해라.`);
  // 채택한 것이 페이지를 거의 덮으면 벌점과 **무관하게** 알린다 (벌점을 피해도 경고는 남는다).
  //   문장은 근거의 세기에 맞춘다: 선분이 적으면 배경 윤곽이라고 말하고, 많으면
  //   「도련까지 포함했는지 확인해라」로 낮춘다. 실측 8건 중 2건(82%·91%)이 진짜 칼선이라
  //   둘을 한 문장으로 쓰면 진짜 칼선을 배경이라고 단정하게 된다.
  if (pick.ratio >= 0.80)
    warnings.push(pick.g.segs <= BACK_SEGS
      ? `고른 도형이 페이지 면적의 ${(pick.ratio * 100).toFixed(0)}% 인데 선분이 ${pick.g.segs}개뿐이다 (${pick.bb.w}×${pick.bb.h}) — 칼선이 아니라 대지·배경 윤곽일 수 있다.`
      : `고른 도형이 페이지 면적의 ${(pick.ratio * 100).toFixed(0)}% 다 (${pick.bb.w}×${pick.bb.h}) — 대지 테두리나 도련을 함께 잡았는지 화면에서 확인해라.`);
  if (pick.g.parts > 1) warnings.push(`칼선을 ${pick.g.parts}개 성분에서 합쳤다 (텍 혀·날개가 본체와 떨어져 있다).`);

  const maxC = opt.maxCandidates ?? 12;
  // ⚠ 채택한 것(pick)은 **반드시** 후보 목록에 들어가야 한다. pick 은 점수 1순위가 아니라
  //   두 겹 판정을 거친 값이라 점수순 상위 maxC 밖으로 밀릴 수 있는데, 그러면 UI 가
  //   `findIndex(c => c.chosen)` 에서 −1 을 받아 Math.max(0,−1)=0 → **다른 후보를**
  //   nW/nH 에 넣는다 (bbox 와 다른 크기가 조용히 견적으로 간다). 그래서 앞에 끼워넣는다.
  const shown = scored.slice(0, maxC);
  if (!shown.includes(pick)) shown.unshift(pick);
  const candidates = shown.map(r => ({
    bbox: { w: r.bb.w, h: r.bb.h, x0: +r.bb.x0.toFixed(2), y0: +r.bb.y0.toFixed(2) },
    points: r.g.nodes.length,
    area: +r.area.toFixed(1),
    segs: r.g.segs,
    parts: r.g.parts,
    fitPct: +(r.fit * 100).toFixed(1),
    offPct: +(r.off * 100).toFixed(1),
    score: r.score,
    chosen: r === pick,
    polygons: polysOf(r.g, px, py),
  }));

  return {
    pageSize,
    bbox: { w: pick.bb.w, h: pick.bb.h },
    polygons: polysOf(pick.g, px, py),
    candidates,
    source,
    unit: "mm",
    warnings,
    pageCount: pages.length,
    sheetId: guessSheet(pageSize),
  };
}

/** 성분의 폴리라인을 좌표 배열로 옮긴다.
 *
 *  ⚠ 3단계(드래그 배치) 담당자에게 — 기대를 잘못 세우지 마라:
 *   · 이것은 **원본 폴리라인 묶음**이다. 닫힌 윤곽이 아니고, nest.mjs 가 요구하는
 *     볼록 조각 목록도 아니다. 2점짜리 선분이 다수 섞여 있다
 *     (실측: 웨이크버니 2/3/2/2/2/2/2/2 · 소스코 2/2/6/17/2/2/2/9).
 *   · 좌표계는 **페이지 절대좌표(mm, y 위로)** 다. bbox 원점 기준이 아니다
 *     (소스코 polygons[0] = [[396.99,211.47],[355.39,211.47]], 페이지 420×297).
 *     SheetCanvas 는 그래서 translate(-x0, y0+h) scale(1,-1) 변환 하나를 씌운다.
 *   · 합집합 bbox 는 bbox 와 정확히 일치한다 (verify-pdf 가 Δ0.02mm 로 검사한다).
 *  → 「그리기」에는 그대로 쓴다. nest 로 넘기려면 세그먼트 스티칭 + 볼록 분해가 필요하다. */
function polysOf(g, px, py) {
  return g.polys.map(ids => ids.map(i => [px[i], py[i]]));
}

/**
 * 페이지 크기 → 판형 id (BASE_SHEETS 대조, ±3mm). 못 찾으면 null.
 * 왜 ±3mm: 도련·재단 여유로 대지 크기가 판형과 정확히 같지 않다
 *          (삼면E 실측 545.0×394.0 = 4×64 정확히 일치했지만 늘 그렇지는 않다).
 */
export function guessSheet(pageSize, tol = 3) {
  if (!pageSize) return null;
  const a = pageSize.w, bq = pageSize.h;
  let best = null;
  for (const s of BASE_SHEETS) {
    if (s.custom) continue;                       // 주문생산은 자동 인식 대상이 아니다
    const d1 = Math.max(Math.abs(s.w - a), Math.abs(s.h - bq));
    const d2 = Math.max(Math.abs(s.h - a), Math.abs(s.w - bq));
    const d = Math.min(d1, d2);
    if (d <= tol && (!best || d < best.d)) best = { id: s.id, d };
  }
  return best ? best.id : null;
}

/** 브라우저 File/Blob 도 그대로 받게 하는 얇은 래퍼 (드롭 영역 배선용) */
export async function readDielineFile(file, opt = {}) {
  const buf = await file.arrayBuffer();
  return readDieline(new Uint8Array(buf), { source: file.name, ...opt });
}

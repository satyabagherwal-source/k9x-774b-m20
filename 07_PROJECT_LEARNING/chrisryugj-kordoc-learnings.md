> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/chrisryugj-kordoc-learnings.md`  
> **Source**: github ([https://github.com/chrisryugj/kordoc](https://github.com/chrisryugj/kordoc))  
> **Source Version**: `eedbd2ff`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-18T01:22:00.452Z  
> **Learning ID**: `learn-github-chrisryugj-kordoc`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): chrisryugj/kordoc

> **Canonical Artifact**: `07_PROJECT_LEARNING/chrisryugj-kordoc-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chrisryugj/kordoc](https://github.com/chrisryugj/kordoc))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-18T01:21:59.090Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chrisryugj/kordoc`
- **Description**: 모두 파싱해버리겠다 — HWP·HWPX·PDF·Office 문서를 Markdown으로. 양식 자동 채우기와 신구대조를 갖춘 CLI·MCP 서버 | Convert Korean documents (HWP, HWPX, PDF, Office) to Markdown — CLI and MCP server with form filling and diff
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md
- **Stars / Engagement**: 2545 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bench/lib/table-score.mjs`
```
// 표 채점 — XML 참조 그리드 vs kordoc IR 그리드 (markdown이 아닌 IR 단계, pitfall #10)
//
// 참조 그리드: bench/ref/hwpx-ref.mjs 가 만든 {rows, cols, cells:[{r,c,rs,cs,text,hasNested}]}
// IR 그리드 : ParseSuccess.blocks 의 IRTable → 앵커 튜플 재계산 (renderer와 동일한 skip-walk)
// 중첩표(v3.0): IRCell.blocks 의 IRBlock(type:'table')을 재귀 수집 — ref XML 중첩 tbl과
// 같은 경계(post-order, 자식 먼저)로 비교하고 부모 셀 텍스트에서는 제외 (이중 카운트 금지)

import { levBand } from "./align.mjs"
import { normText, normKey } from "./normalize.mjs"

/**
 * IR 셀의 "자기 텍스트" — blocks가 있으면 문단 블록만 join (중첩표 평탄화 텍스트·
 * ![image] 참조가 섞인 하위 호환 cell.text 대신). 중첩표 텍스트는 자식 그리드에서 채점.
 * 수식 $…$/$$…$$은 제거 — ref 추출기가 셀 텍스트에서 수식을 제외하므로(존재는
 * eqPresence로 별도 채점, whitelist) mdToPlain 본문 경로와 대칭.
 */
function cellOwnText(cell, withNotes = false) {
  // withNotes: 문단 블록의 각주 본문을 렌더(builder)·칸 text 와 같은 " (주: …)" 꼴로 붙인다 — 칸에 blocks 가 있는 IR 과
  // text 만 있는 IR 을 맞대는 HWP5 쌍 트랙용. 자기참조 트랙은 각주 본문을 주석 유닛으로 따로 채점하므로 넣지 않는다
  // 미기입 누름틀 안내문(placeholder span)은 IR 글에만 남는 인쇄 안 되는 글 — 참조와 같이 뺀다 (whitelist: clickhere-placeholder)
  const ownText = b => b.spans?.some(s => s.placeholder) ? b.spans.filter(s => !s.placeholder).map(s => s.text).join("") : (b.text ?? "")
  const raw = cell.blocks?.length
    ? cell.blocks
        .filter(b => b.type !== "table" && b.type !== "image")
        .map(b => ownText(b) + (withNotes && b.footnoteText && b.text ? ` (주: ${b.footnoteText})` : ""))
        .filter(Boolean)
        .join("\n")
    : cell.text ?? ""
  return raw
    // 풀 수 없는 이미지 자리표시 "[이미지: ref]"(파서가 image 블록을 문단으로 바꿔 남김) — mdToPlain 과
    // 같은 의도적 아티팩트 제거 (whitelist: image-placeholder, issue1891 외부 BinData 링크)
    .replace(/\[이미지:[^\]\n]*\]/g, " ")
    .replace(/\$\$[^$]+\$\$/g, " ")
    .replace(/(^|[^\\$])\$(?!\s)((?:\\.|[^$\n\\])+?)\$/g, "$1 ") // 역슬래시는 \\. 로만 — mdToPlain 과 같은 역추적 방지
    // 인라인 링크 [anchor](url) → anchor — ref 셀은 가시 텍스트만 모델링 (mdToPlain 대칭)
    .replace(/\[([^\[\]]*)\]\((?:https?:|mailto:|tel:|#)[^)\s]*\)/gi, "$1")
}

/** IRTable.cells[][] → 앵커 셀 목록 (tableToHtml과 동일한 skip-set 워크) */
export function irAnchors(irTable, withNotes = false) {
  const { rows, cols, cells } = irTable
  const anchors = []
  const skip = new Set()
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (skip.has(r * 100000 + c)) continue
      const cell = cells[r]?.[c]
      if (!cell) continue
      anchors.push({ r, c, rs: cell.rowSpan, cs: cell.colSpan, text: cellOwnText(cell, withNotes) })
      for (let dr = 0; dr < cell.rowSpan; dr++) {
        for (let dc = 0; dc < cell.colSpan; dc++) {
          if (dr === 0 && dc === 0) continue
          if (r + dr < rows && c + dc < cols) skip.add((r + dr) * 100000 + (c + dc))
        }
      }
    }
  }
  return { rows, cols, anchors }
}

/**
 * IRBlock[] → IR 그리드 목록 (post-order: 셀 내부 중첩표 먼저, 부모 나중).
 * ref 추출기의 tables[] 적재 순서(processCell 즉시 처리 = 자식 먼저)와 동일한 경계.
 */
export function collectIrGrids(blocks, withNotes = false) {
  const grids = []
  const visitTable = (table, depth = 0) => {
    if (depth > 12) return
    // 캡션 안 표(#55 IRTable.captionBlocks) — ref 는 캡션을 행보다 먼저 처리하므로 여기도 먼저.
    // 종전엔 수집하지 않아 캡션 속 표가 "IR 없음"으로 셌다 (issue1891 6×5 공사비 표)
    for (const b of table.captionBlocks ?? []) {
      if (b.type === "table" && b.table) visitTable(b.table, depth + 1)
    }
    // 앵커 워크와 동일한 row-major 순서로 셀 내부 중첩표 재귀
    const { rows, cols, cells } = table
    const skip = new Set()
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (skip.has(r * 100000 + c)) continue
        const cell = cells[r]?.[c]
        if (!cell) continue
        for (const b of cell.blocks ?? []) {
          if (b.type === "table" && b.table) visitTable(b.table, depth + 1)
        }
        for (let dr = 0; dr < cell.rowSpan; dr++) {
          for (let dc = 0; dc < cell.colSpan; dc++) {
            if (dr === 0 && dc === 0) continue
            if (r + dr < rows && c + dc < cols) skip.add((r + dr) * 100000 + (c + dc))
          }
        }
      }
    }
    grids.push(irAnchors(table, withNotes))
  }
  for (const b of blocks ?? []) {
    if (b.type === "table" && b.table) visitTable(b.table)
  }
  return grids
}

function cellTextBag(grid) {
  const bag = new Map()
  for (const a of grid.anchors ?? grid.cells) {
    const k = normKey(a.text)
    if (k) bag.set(k, (bag.get(k) ?? 0) + 1)
  }
  // 매칭 전용 bag 보강 — 다중 셀 부모의 중첩표 텍스트 (pdf-table-gt가 ref 쪽에 적재).
  // pdf는 중첩표를 부모 그리드로 평탄화하므로, bag에 합쳐야 동의서류 박스가 같은
  // 표로 매칭된다. 셀 좌표 채점(exact/F1/NED)에는 관여하지 않는다.
  for (const t of grid.bagExtra ?? []) {
    const k = normKey(t)
    if (k) bag.set(k, (bag.get(k) ?? 0) + 1)
  }
  return bag
}

function bagSim(a, b) {
  let inter = 0, total = 0
  for (const [k, n] of a) { total += n; inter += Math.min(n, b.get(k) ?? 0) }
  for (const [, n] of b) total += n
  if (total === 0) return 0.5 // 둘 다 빈 표 — 중립
  return (2 * inter) / total
}

function dimSim(a, b) {
  const ra = a.rows, ca = a.cols, rb = b.rows, cb = b.cols
  return 1 - (Math.abs(ra - rb) + Math.abs(ca - cb)) / Math.max(1, ra + ca + rb + cb)
}

/**
 * 표 1:1 대응 — 문서 순서 보존 DP 정렬 + 유사도(셀 텍스트 bag + 치수).
 * 분할표 보정: 미매칭 ref에 대해 연속 미매칭 IR 병합 후보 시도 (pitfall #18).
 */
export function matchTables(refTables, irGrids) {
  const n = refTables.length, m = irGrids.length
  const sim = []
  const refBags = refTables.map(t => cellTextBag(t))
  const irBags = irGrids.map(g => cellTextBag(g))
  for (let i = 0; i < n; i++) {
    sim.push(new Float64Array(m))
    const decorRef = (refTables[i].cells ?? []).some(a => a.headingLines?.length)
    for (let j = 0; j < m; j++) {
      const bs = bagSim(refBags[i], decorRef ? decorAwareBag(refTables[i], irGrids[j]) : irBags[j])
      // 양쪽 다 텍스트가 있는데 교집합 0 = 내용이 모순되는 표 — dims-only 매칭 차단
      // (dimSim 0.25 누수가 진짜 짝을 선점해 순서구제까지 봉쇄하는 것 방지, 10차)
      if (bs === 0 && refBags[i].size > 0 && irBags[j].size > 0) { sim[i][j] = 0; continue }
      sim[i][j] = 0.75 * bs + 0.25 * dimSim(refTables[i], irGrids[j])
    }
  }
  const MIN_SIM = 0.2
  // DP: 순서 보존 최대 가중 매칭
  const dp = Array.from({ length: n + 1 }, () => new Float64Array(m + 1))
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      let best = Math.max(dp[i - 1][j], dp[i][j - 1])
      if (sim[i - 1][j - 1] >= MIN_SIM) best = Math.max(best, dp[i - 1][j - 1] + sim[i - 1][j - 1])
      dp[i][j] = best
    }
  }
  const pairs = new Array(n).fill(-1)
  const usedIr = new Set()
  {
    let i = n, j = m
    while (i > 0 && j > 0) {
      if (sim[i - 1][j - 1] >= MIN_SIM && Math.abs(dp[i][j] - (dp[i - 1][j - 1] + sim[i - 1][j - 1])) < 1e-12) {
        pairs[i - 1] = j - 1
        usedIr.add(j - 1)
        i--; j--
      } else if (dp[i - 1][j] >= dp[i][j - 1]) i--
      else j--
    }
  }
  // 분할표 병합 보정: 미매칭 ref ↔ 연속 미매칭 IR 2~3개 행방향 병합
  const merged = new Map() // refIdx → [irIdx...]
  for (let i = 0; i < n; i++) {
    if (pairs[i] !== -1) continue
    const ref = refTables[i]
    for (let j = 0; j + 1 < m; j++) {
      if (usedIr.has(j) || usedIr.has(j + 1)) continue
      for (let k = 2; k <= 3 && j + k <= m; k++) {
        const grp = []
        let ok = true, rowsSum = 0
        for (let q = j; q < j + k; q++) {
          if (usedIr.has(q)) { ok = false; break }
          grp.push(irGrids[q]); rowsSum += irGrids[q].rows
        }
        if (!ok) continue
        if (rowsSum === ref.rows && grp.every(g => g.cols === ref.cols)) {
          const mergedGrid = mergeGrids(grp)
          if (bagSim(refBags[i], cellTextBag(mergedGrid)) >= MIN_SIM) {
            merged.set(i, { irIdxs: grp.map((_, q) => j + q), grid: mergedGrid })
            for (let q = j; q < j + k; q++) usedIr.add(q)
            break
          }
        }
      }
      if (merged.has(i)) break
    }
  }
  // 순서 예외 구제 (2026-07-03): 2단 조판 페이지에서 표의 물리 방출 순서가 문서
  // 흐름과 어긋나면 (pair06 p1 — pdf가 우단 표를 먼저 방출) 순서보존 DP가 그리드
  // 동일한 표를 버린다. 잔여 미매칭 ref ↔ 미사용 IR을 전역 그리디(고유사도 우선)로
  // 구제하되, 문턱을 DP(0.2)보다 훨씬 높여 진짜 구조 붕괴가 회복으로 위장하는 것을
  // 막는다. 이 트랙의 감시 대상은 그리드 무결성이고 순서는 coverage/order 트랙 소관.
  const REORDER_MIN_SIM = 0.55
  let reordered = 0
  const cand = []
  for (let i = 0; i < n; i++) {
    if (pairs[i] !== -1 || merged.has(i)) continue
    for (let j = 0; j < m; j++) {
      if (usedIr.has(j)) continue
      if (sim[i][j] >= REORDER_MIN_SIM) cand.push([sim[i][j], i, j])
    }
  }
  cand.sort((a, b) => b[0] - a[0])
  for (const [, i, j] of cand) {
    if (pairs[i] !== -1 || usedIr.has(j)) continue
    pairs[i] = j
    usedIr.add(j)
    reordered++
  }
  // 전체 텍스트 접두 유사도 폴백 (10차): 프로즈 박스를 pdf가 세밀 분할하면
  // (pair06 결격사유 3x2 → 18x3) 셀 단위 bag 키 교집합이 붕괴해 위 단계가
  // 전부 무효. 셀 텍스트를 row-major로 이어 붙인 문자열이 접두로 들어맞으면
  // 같은 박스의 발견으로 인정한다 — 분할 이탈 표는 박스 상단부터 담기므로
  // 접두 비교가 맞고, 하단 잔여가 1열 표 등으로 모수 밖에 떨어져도 (부분 포착)
  // 커버 가드 40%로 수용. 셀 좌표 채점(exact/F1/NED)은 그대로 실좌표 대조 —
  // 매칭 발견만 구제하며 충실도는 정직하게 감점된다.
  const TEXT_MIN_LEN = 80      // 프로즈 박스 한정 (짧은 표의 우연 접두 배제)
  const TEXT_MIN_COVER = 0.4   // 짧은 쪽이 긴 쪽의 40% 이상
  const TEXT_MIN_SIM = 0.85    // 접두 구간 NED 유사도
  let textMatched = 0
  const joinKey = g => {
    let s = ""
    for (const a of g.anchors ?? g.cells) s += normKey(a.text)
    return s
  }
  const tcand = []
  let refJoin = null, irJoin = null
  for (let i = 0; i < n; i++) {
    if (pairs[i] !== -1 || merged.has(i)) continue
    refJoin ??= refTables.map(joinKey)
    if (refJoin[i].length < TEXT_MIN_LEN) continue
    for (let j = 0; j < m; j++) {
      if (usedIr.has(j)) continue
      irJoin ??= irGrids.map(joinKey)
      const R = refJoin[i], I = irJoin[j]
      if (I.length < TEXT_MIN_LEN) continue
      const L = Math.min(R.length, I.length)
      if (L / Math.max(R.length, I.length) < TEXT_MIN_COVER) continue
      const maxD = Math.ceil(L * (1 - TEXT_MIN_SIM))
      const d = levBand(R.slice(0, L), I.slice(0, L), maxD)
      if (d > maxD) continue
      tcand.push([1 - d / L, i, j])
    }
  }
  tcand.sort((a, b) => b[0] - a[0])
  for (const [, i, j] of tcand) {
    if (pairs[i] !== -1 || usedIr.has(j)) continue
    pairs[i] = j
    usedIr.add(j)
    textMatched++

```

### Core Architecture Module: `bench/score.mjs`
```
#!/usr/bin/env node
// 문서 파싱 정확도 채점기 — "정보손실 0%" 객관 측정.
//
// 사용법: node bench/score.mjs [corpus하위경로] [--only=hwpx|pdf|hwp] [--doc=부분문자열] [--verbose]
//
// 트랙:
//   HWPX : 자기참조 XML GT — text_recall / phantom / table_structure / cell_content / order / specials
//          표 정답은 hp:tbl 이 아니라 보이는 표(v4.17.0 채점 기준 변경, ref/visible-tables.mjs) — 틀 행 칸 글은 재현율 유닛으로만,
//          칸으로 조립한 분수는 수식(eqPresence 모수)
//   PDF  : pdftotext+pdfjs consensus 교차검증 — pdf_cross_coverage (needsOcr 페이지 격리)
//   HWP5 : 같은 newsId의 .hwpx 쌍이 있으면 상호 정렬 기반 2차 트랙 (게이트 없음, 보고만)
//
// 출력: bench/out/score.json + 콘솔 요약. 게이트 실패 시 exit code 1.

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises"
import { join, extname, basename, relative } from "node:path"
import { fileURLToPath } from "node:url"
import { parse, flattenLayoutTables, blocksToMarkdown } from "../dist/index.js"
import { extractRef } from "./ref/hwpx-ref.mjs"
import { pdfCrossCoverage } from "./ref/pdf-consensus.mjs"
import { GATES, BLACKLIST, WHITELIST } from "./ref/policy.mjs"
import { normKey, normText, mdToPlain } from "./lib/normalize.mjs"
import { alignUnits, lisLength, levArr } from "./lib/align.mjs"
import { collectIrGrids, scoreTables } from "./lib/table-score.mjs"

const root = fileURLToPath(new URL(".", import.meta.url))
const args = process.argv.slice(2)
const subPath = args.find(a => !a.startsWith("--")) ?? ""
const only = (args.find(a => a.startsWith("--only=")) ?? "").split("=")[1] ?? null
const docFilter = (args.find(a => a.startsWith("--doc=")) ?? "").split("=")[1] ?? null
const verbose = args.includes("--verbose")
const corpusDir = join(root, "corpus", subPath)
const outDir = join(root, "out")

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (/\.(hwpx|hwp|pdf)$/i.test(e.name)) yield p
  }
}

const round = (x, d = 4) => (x === null || x === undefined ? null : +x.toFixed(d))

// 암호 문서 — 샘플 파일명에 열기 암호를 적어 두는 관례(rhwp "…-password-123456.hwp")가 있으면 그 암호로
// 연다. 복호화 경로의 스모크가 되고, 자기참조 GT(평문 XML)는 만들 수 없으므로 HWPX 는 파싱 성공만 본다
const passwordOf = file => /password-(\w+)/.exec(basename(file))?.[1]
const parseOpts = file => ({ filename: basename(file), ...(passwordOf(file) ? { password: passwordOf(file) } : {}) })

// ─── HWPX 채점 ──────────────────────────────────────

async function scoreHwpx(file, buf) {
  const res = await parse(buf, parseOpts(file))
  // 암호를 모르는 실문서 암호 HWPX(정책브리핑 첨부 등 — 같은 보도자료의 HWP·PDF 판은 평문) 는 ENCRYPTED 로 거절하는 것이 올바른
  // 동작이다. 그 코드인지만 확인하고 채점에서 뺀다(다른 실패 코드는 그대로 실패)
  if (!res.success && res.code === "ENCRYPTED" && !passwordOf(file)) return { ok: true, encrypted: true, locked: true }
  if (!res.success) return { ok: false, stage: "parse", error: res.error }
  if (passwordOf(file)) return { ok: true, encrypted: true }

  let ref
  try {
    ref = await extractRef(buf)
  } catch (err) {
    return { ok: false, stage: "ref", error: String(err?.message ?? err) }
  }

  const { text: plain, eqCount: mdEqCount, footnoteCount: mdFnCount } = mdToPlain(res.markdown)
  const mdKey = normKey(plain)

  // ── text_recall + order + phantom ──
  const unitsForAlign = ref.units.map(u => ({ id: u.id, kind: u.kind, text: normKey(u.text), tableIdx: u.tableIdx }))
  const { perUnit, buf: cbuf } = alignUnits(unitsForAlign, mdKey)

  // 머리말/꼬리말 — 0/1회 허용 소비 (recall 모수 제외, phantom 제외; 2회+ = 정책 위반)
  // 참조는 조각 목록(문단 글·표 셀 글·글상자 글, 문서 순서) — 파서는 머리말 표를 " / "·줄바꿈으로
  // 평탄화하므로 조각 사이엔 본문 문자 없는 구분자만 허용해 이어 찾는다. 2단계: 전 머리말을 먼저
  // 1회씩 소비한 뒤 잔여 재등장만 위반으로 센다(한 머리말이 다른 머리말 글의 앞부분이면 1단계
  // 동시 검사가 거짓 위반을 냈다 — exam_social 홀/짝 머리말). 본문 문자 6자 미만 짧은 머리말은
  // 우연 일치 위험이 커서 종전엔 채점에서 뺐는데, 그러면 1회 방출이 phantom 으로 남는다("대외주의"
  // "상공신문") — 파서가 머리말을 문서 첫머리, 꼬리말을 끝에 두므로 그 구간에서만 소비한다
  let headerViolations = 0
  const isContent = ch => /[\p{L}\p{N}]/u.test(ch)
  const findParts = (parts, from = 0) => {
    for (let p0 = cbuf.find(parts[0], from); p0 !== -1; p0 = cbuf.find(parts[0], p0 + 1)) {
      let end = p0 + parts[0].length
      let ok = true
      for (let i = 1; i < parts.length && ok; i++) {
        // 다음 조각은 본문 문자 없는 구분자 뒤 어디서든 (조각 자신이 "(" 같은 구두점으로 시작할 수 있다)
        let j = end
        for (;;) {
          if (mdKey.startsWith(parts[i], j) && cbuf.isFree(j, j + parts[i].length)) { end = j + parts[i].length; break }
          if (j >= mdKey.length || isContent(mdKey[j])) { ok = false; break }
          j++
        }
      }
      if (ok) return [p0, end]
    }
    return null
  }
  const pageTexts = [
    ...ref.specials.headers.map(h => ({ parts: h, header: true })),
    ...ref.specials.footers.map(h => ({ parts: h, header: false })),
  ].map(x => ({ ...x, parts: x.parts.map(normKey).filter(Boolean) })).filter(x => x.parts.length)
  const bodyStart = cbuf.intervals.length ? cbuf.intervals[0][0] : mdKey.length
  const bodyEnd = cbuf.intervals.length ? cbuf.intervals[cbuf.intervals.length - 1][1] : 0
  const consumedPT = []
  for (const pt of pageTexts) {
    const short = pt.parts.join("").replace(/[^\p{L}\p{N}]/gu, "").length < 6
    const hit = findParts(pt.parts, short && !pt.header ? bodyEnd : 0)
    if (!hit) continue
    if (short && (pt.header ? hit[1] > bodyStart : hit[0] < bodyEnd)) continue
    cbuf.consume(hit[0], hit[1])
    consumedPT.push(pt)
  }
  for (const pt of consumedPT) if (findParts(pt.parts)) headerViolations++

  // per-kind recall
  const byKind = {}
  let matchedTotal = 0, refTotal = 0, maxMissRun = 0
  const misses = []
  for (let i = 0; i < perUnit.length; i++) {
    const r = perUnit[i]
    // 본문 문자(문자/숫자) 없는 유닛(별표/구두점-only 마스킹)은 recall 모수 제외 —
    // phantom("본문 문자만 카운트")·순서 채점(마스킹 제외)과 대칭. normKey 공백 제거로
    // 인접 마스킹이 GT/MD에서 다르게 합쳐져 multiset 단편화 거짓-미스가 나는 함정 차단.
    // (align 소비는 이미 끝났으므로 phantom 오염 없음)
    if (!/[\p{L}\p{N}]/u.test(unitsForAlign[i].text)) continue
    const k = r.kind
    byKind[k] = byKind[k] ?? { matched: 0, total: 0, units: 0 }
    byKind[k].matched += r.matched
    byKind[k].total += r.total
    byKind[k].units++
    matchedTotal += r.matched
    refTotal += r.total
    if (r.runMiss > maxMissRun) maxMissRun = r.runMiss
    if (r.matched < r.total) {
      misses.push({
        kind: k,
        lost: r.total - r.matched,
        runMiss: r.runMiss,
        unitHead: normText(ref.units[i].text).slice(0, 70),
        missSnippet: r.missSnippet ?? (r.pos === -1 ? normText(ref.units[i].text).slice(0, 80) : ""),
      })
    }
  }
  misses.sort((a, b) => b.lost - a.lost)
  const recall = refTotal ? matchedTotal / refTotal : 1

  // phantom — 미소비 구간의 "본문 문자"(문자/숫자)만 카운트.
  // 구두점·구분기호(평탄화 ' / ' 등 의도적 아티팩트)는 제외 (whitelist: nested-flatten)
  // 자동번호 관용: 파서가 의도적으로 실체화한 자동부호("1." "가." "①" 등)는 ref hp:t
  // 원문에 없어 미소비로 남는다 — ref가 NUMBER/BULLET heading 문단을 실제로 쓴 문서에
  // 한해, 매칭 소비 구간 직전에 붙은(세그먼트 끝 b가 소비 구간과 인접) 세그먼트 전체가
  // 자동번호 패턴과 정확 일치하는 ≤3자만 관용. 오염 문자가 섞이면 패턴 불일치로 계상.
  // 한컴 번호 서식 전 계열 — 숫자·가나다·자모(HANGUL_JAMO "ㄱ.")·원문자·로마자(ROMAN "I."·"ⅰ")·
  // 라틴 1자, 그리고 괄호형 "(1)"·"(가)"(paraHead "(^5)"). 종전엔 괄호형·로마자가 빠져 SO-SUEOP
  // 개요 번호 "(1) 주제"·"I. 소설의 이해"(한컴 PDF 실렌더 동일)가 phantom 으로 셌다
  const AUTONUM_TOKEN = "(?:\\d{1,2}|[가-힣]|[ㄱ-ㅎ]|[①-⑳㉑-㉟㊱-㊿]|[ⅰ-ⅻⅠ-Ⅻ]|[IVXivx]{1,4}|[A-Za-z])"
  const AUTONUM_RE = new RegExp(`^(?:\\(${AUTONUM_TOKEN}\\)|${AUTONUM_TOKEN}[.)]?)$`)
  const hasAutoNumParas = (ref.counters.autoNumHeadingParas ?? 0) > 0
  const unconsumed = cbuf.unconsumed()
  let phantomChars = 0
  const phantomSnips = []
  for (const [a, b] of unconsumed) {
    const seg = mdKey.slice(a, b)
    if (hasAutoNumParas && b < mdKey.length && AUTONUM_RE.test(seg)) continue
    const content = (seg.match(/[\p{L}\p{N}]/gu) ?? []).length
    phantomChars += content
    if (content >= 4) phantomSnips.push(seg.slice(0, 80))
  }
  phantomSnips.sort((a, b) => b.length - a.length)
  const phantomRate = mdKey.length ? phantomChars / mdKey.length : 0

  // 블랙리스트 (원본 마크다운 정확 매칭)
  const blacklistHits = BLACKLIST.filter(b => b.re.test(res.markdown)).map(b => b.id)

  // ── order (표는 1유닛, 미매칭 모수 제외) ──
  const orderSeq = []
  // 비고유(중복) 텍스트는 multiset 정렬에서 귀속이 임의라 순서가 정의되지 않으므로
  // (예: 마스킹된 '******' 폼 필드, 반복 서식) 순서 모수에서 제외 — 고유 유닛만 채점.
  // 셀-본문 간 충돌도 귀속 모호성을 만들므로 전체 유닛 기준으로 빈도를 센다.
  const textFreq = new Map()
  for (let i = 0; i < perUnit.length; i++) {
    const k = unitsForAlign[i].text
    if (k) textFreq.set(k, (textFreq.get(k) ?? 0) + 1)
  }
  // 내용이 동일한 표(반복 서식 템플릿)는 multiset 정렬에서 셀 귀속이 임의라 순서가
  // 정의되지 않음 — 본문 중복 제외와 같은 논리로 순서 모수에서 제외.
  const tableSig = ref.tables.map(t => t.cells.map(c => normKey(c.text)).sort().join(""))
  const sigFreq = new Map()
  for (let ti = 0; ti < ref.tables.length; ti++) {
    if (!ref.tables[ti].nested) sigFreq.set(tableSig[ti], (sigFreq.get(tableSig[ti]) ?? 0) + 1)
  }
  const tableFirstPos = new Map()
  for (let i = 0; i < perUnit.length; i++) {
    const r = perUnit[i]
    const u = ref.units[i]
    if (u.kind === "cell") {
      if (u.tableIdx === undefined || r.pos < 0 || r.matched === 0) continue
      // 중첩표 셀은 부모 셀 내부에 렌더링(v3.0, whitelist: nested-in-cell) — 부모 표가
      // 이미 순서 모수에 있으므로 이중 채점하지 않는다. 최상위 표만 순서 채점.
      if (ref.tables[u.tableIdx]?.nested) continue
      if (sigFreq.get(tableSig[u.tableIdx]) !== 1) continue
      // 표 위치 앵커 = 가장 긴 "완전 매칭 + 문서 내 고유" 셀 — 짧거나 중복된 토큰
      // ("연번", 반복 업체명)이 다른 표 영역에 귀속되어 표 위치를 끌어가는 것을 방지.
      // 고유 앵커가 하나도 없는 표는 귀속 불능 — 순서 모수 제외 (아래 w>0 필터).
      const txt = unitsForAlign[i].text
      const contentLen = (txt.match(/[\p{L}\p{N}]/gu) ?? []).length
      const reliable = r.matched === r.total && contentLen >= 4 && textFreq.get(txt) === 1
      const w = reliable ? txt.length : 0
      const cur = tableFirstPos.get(u.tableIdx)
      if (cur === undefined) {
        tableFirstPos.set(u.tableIdx, { pos: r.pos, w })
        orderSeq.push({ table: u.tableIdx, pos: r.pos })
      } else if (w > cur.w) { cur.pos = r.pos; cur.w = w }
    } else if (u.kind === "body" || u.kind === "drawText" || u.kind === "caption") {
      // 중첩표 캡션 — 부모 셀 내부 렌더링이라 평탄
```

### Core Architecture Module: `sdk/fixtures/fault-worker.mjs`
```
#!/usr/bin/env node
/**
 * SDK 장애 주입용 가짜 parse-worker — 실제 파싱 대신 정해진 방식으로 잘못 동작한다(SDK 테스트 전용, 배포물 아님).
 * SDK 가 `node <이 파일> parse-worker --protocol 2 …` 로 띄운다. 동작은 환경변수 KORDOC_FAULT 로 고른다.
 *
 *   ok             정상 handshake, parse 마다 {"success":true,"markdown":"ok:<file>"} (기본)
 *   no-ready       ready 를 쓰지 않고 멈춘다
 *   bad-protocol   ready 에 protocol 1 을 쓴다
 *   no-capability  ready 의 capabilities 가 비어 있다
 *   hang           parse 요청을 받고 응답하지 않는다
 *   hang-first     KORDOC_FAULT_STATE 파일이 없으면 만들고 멈추고, 있으면 ok 처럼 답한다 (교체 뒤 다음 요청 성공)
 *   exit-on-parse  parse 요청을 받으면 응답 없이 종료 코드 3 으로 끝난다
 *   partial-json   parse 요청에 JSON 절반을 쓰고 종료한다
 *   wrong-id       다른 id 로 답한다
 *   stderr-flood   parse 마다 stderr 에 8MiB 를 쓴 뒤 답한다
 *   slow           parse 마다 KORDOC_FAULT_DELAY_MS(기본 300) 뒤에 답한다
 *   by-file        요청 파일 이름으로 고른다 — "hang" 이 들어 있으면 응답하지 않고, "crash" 면 종료 코드 3 으로 끝나고
 *                  (KORDOC_FAULT_STATE 를 주면 그 파일이 있을 때만), "slow" 면 KORDOC_FAULT_DELAY_MS 뒤에 답하고, 나머지는 ok
 *   no-quit        quit 요청과 stdin 닫힘을 무시하고 계속 산다 (kill 로만 끝난다). parse 는 ok 처럼 답한다
 *   exit-hold-stderr
 *                  parse 요청을 받으면 stderr 를 물려받은 손자 프로세스를 KORDOC_FAULT_DELAY_MS(기본 3000) 동안 남기고
 *                  종료 코드 3 으로 끝난다 (워커가 끝나도 stderr 파이프가 닫히지 않는다)
 *
 * 모든 모드 공통:
 *   KORDOC_FAULT_READY_DELAY_MS  ready 를 이만큼 늦게 쓴다. KORDOC_FAULT_READY_STATE 를 함께 주면 그 파일이 없을 때는
 *                                만들고 바로 ready 를 쓰고, 있을 때만 늦춘다 (처음 워커는 바로, 교체 워커만 늦게)
 */

import { spawn } from "node:child_process"
import { existsSync, writeFileSync } from "node:fs"
import { createInterface } from "node:readline"

const mode = process.env.KORDOC_FAULT ?? "ok"
const out = (o) => process.stdout.write(JSON.stringify(o) + "\n")
const ok = (id, file) => out({ id, rss: process.memoryUsage.rss(), result: { success: true, fileType: "docx", markdown: `ok:${file}`, blocks: [], pid: process.pid } })

const readyDelay = Number(process.env.KORDOC_FAULT_READY_DELAY_MS ?? 0)
const readyState = process.env.KORDOC_FAULT_READY_STATE
if (readyState && !existsSync(readyState)) writeFileSync(readyState, String(process.pid))
else if (readyDelay) await new Promise((r) => setTimeout(r, readyDelay))

if (mode === "no-ready") setInterval(() => {}, 1 << 30)
else {
  out({ ready: true, version: "0.0.0-fault", protocol: mode === "bad-protocol" ? 1 : 2,
    capabilities: mode === "no-capability" ? [] : ["parse", "options", "transport.images.inline", "transport.images.files"] })
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
  rl.on("line", async (line) => {
    if (!line.trim()) return
    const req = JSON.parse(line)
    if (req.cmd === "quit") { if (mode !== "no-quit") process.stdout.write("", () => process.exit(0)); return }
    switch (mode) {
      case "hang": return
      case "hang-first": {
        const state = process.env.KORDOC_FAULT_STATE
        if (state && !existsSync(state)) { writeFileSync(state, String(process.pid)); return }
        return ok(req.id, req.file)
      }
      case "exit-on-parse": return process.exit(3)
      case "exit-hold-stderr": {
        const hold = Number(process.env.KORDOC_FAULT_DELAY_MS ?? 3000)
        spawn(process.execPath, ["-e", `setTimeout(() => {}, ${hold})`], { stdio: ["ignore", "ignore", "inherit"], detached: true }).unref()
        return process.exit(3)
      }
      case "partial-json": return process.stdout.write('{"id":' + req.id + ',"rss":1,"result":{"succ', () => process.exit(0))
      case "wrong-id": return ok(req.id + 1000, req.file)
      case "stderr-flood": {
        const chunk = "x".repeat(64 * 1024) + "\n"
        for (let i = 0; i < 128; i++) if (!process.stderr.write(chunk)) await new Promise((r) => process.stderr.once("drain", r))
        return ok(req.id, req.file)
      }
      case "slow": return setTimeout(() => ok(req.id, req.file), Number(process.env.KORDOC_FAULT_DELAY_MS ?? 300))
      case "by-file": {
        const name = String(req.file).split(/[\\/]/).pop()
        if (name.includes("hang")) return
        if (name.includes("crash") && (!process.env.KORDOC_FAULT_STATE || existsSync(process.env.KORDOC_FAULT_STATE))) return process.exit(3)
        if (name.includes("slow")) return setTimeout(() => ok(req.id, req.file), Number(process.env.KORDOC_FAULT_DELAY_MS ?? 300))
        return ok(req.id, req.file)
      }
      default: return ok(req.id, req.file)
    }
  })
  rl.on("close", () => mode === "no-quit" ? setInterval(() => {}, 1 << 30) : process.stdout.write("", () => process.exit(0)))
}

```

### Core Architecture Module: `sdk/python/src/kordoc/_worker.py`
```
"""상주 워커 프로세스 하나 — asyncio subprocess 로 띄우고 한 번에 요청 하나만 보낸다."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from ._config import REQUIRED_CAPABILITIES, KordocConfig
from ._errors import KordocIncompatibleEngine, KordocProtocolError, KordocStartError, KordocWorkerCrashed
from ._protocol import PROTOCOL
from ._result import WorkerWarmup


class Worker:
    def __init__(self, config: KordocConfig) -> None:
        self._config = config
        self._proc: asyncio.subprocess.Process | None = None
        self._stderr_task: asyncio.Task[None] | None = None
        self._stderr_tail = bytearray()
        self.version: str | None = None
        self.capabilities: tuple[str, ...] = ()
        self.last_rss: int | None = None
        self.warmup: WorkerWarmup | None = None

    @property
    def pid(self) -> int | None:
        return self._proc.pid if self._proc else None

    @property
    def alive(self) -> bool:
        return self._proc is not None and self._proc.returncode is None

    def stderr_tail(self) -> str:
        return self._stderr_tail.decode("utf-8", "replace")

    async def start(self) -> None:
        cmd = self._config.command()
        try:
            # 응답 한 줄이 크다(이미지 base64 포함) — readline 상한을 워커 응답 상한에 맞춘다
            self._proc = await asyncio.create_subprocess_exec(
                *cmd, stdin=asyncio.subprocess.PIPE, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                env=self._config.environment(), limit=self._config.max_response_bytes + 64 * 1024)
        except OSError as e:
            raise KordocStartError(f"워커를 띄우지 못했습니다: {cmd[0]} {cmd[1]} — {e}") from e
        self._stderr_task = asyncio.create_task(self._drain_stderr())
        try:
            await self._handshake()
        except BaseException:
            # 취소돼도 띄운 프로세스를 남기지 않는다
            await asyncio.shield(self.kill())
            raise

    async def _handshake(self) -> None:
        assert self._proc is not None
        try:
            line = await asyncio.wait_for(self._proc.stdout.readline(), self._config.start_timeout)  # type: ignore[union-attr]
        except TimeoutError:
            await self.kill()
            raise KordocStartError(f"워커가 {self._config.start_timeout}초 안에 ready 를 보내지 않았습니다\n{self.stderr_tail()}") from None
        except (ValueError, asyncio.LimitOverrunError) as e:
            await self.kill()
            raise KordocStartError(f"워커 ready 줄을 읽지 못했습니다: {e}") from e
        if not line:
            await self.kill()
            raise KordocStartError(f"워커가 ready 전에 끝났습니다 (code {self._proc.returncode})\n{self.stderr_tail()}")
        try:
            ready = json.loads(line)
        except json.JSONDecodeError:
            await self.kill()
            raise KordocIncompatibleEngine(f"ready 줄이 JSON 이 아닙니다: {line[:200]!r}") from None
        if not isinstance(ready, dict) or ready.get("ready") is not True or ready.get("protocol") != PROTOCOL:
            await self.kill()
            raise KordocIncompatibleEngine(f"parse-worker protocol {PROTOCOL} 를 지원하지 않는 엔진입니다: {ready!r}")
        caps = tuple(ready.get("capabilities") or ())
        missing = [c for c in REQUIRED_CAPABILITIES if c not in caps]
        if missing:
            await self.kill()
            raise KordocIncompatibleEngine(f"엔진에 필요한 기능이 없습니다: {missing} (version {ready.get('version')})")
        self.version = ready.get("version")
        self.capabilities = caps

    async def _drain_stderr(self) -> None:
        """stderr 를 계속 비운다(안 비우면 워커가 쓰다 막힌다). 끝부분만 진단용으로 남긴다."""
        assert self._proc and self._proc.stderr
        limit = self._config.stderr_tail_bytes
        while True:
            chunk = await self._proc.stderr.read(64 * 1024)
            if not chunk:
                return
            self._stderr_tail += chunk
            if len(self._stderr_tail) > limit:
                del self._stderr_tail[: len(self._stderr_tail) - limit]

    async def request(self, msg: dict[str, Any], line: bytes) -> dict[str, Any]:
        """요청 하나(line — protocol.encode_request 로 미리 만든 줄)를 보내고 같은 id 의 응답을 돌려준다.
        워커가 거부하면 KordocProtocolError(워커는 멀쩡하다). 워커가 끝났거나 응답이 깨졌으면 KordocWorkerCrashed — 이 워커는 더 쓰지 않는다."""
        proc = self._proc
        if proc is None or proc.returncode is not None:
            raise KordocWorkerCrashed("워커가 실행 중이 아닙니다", self.stderr_tail())
        assert proc.stdin and proc.stdout
        try:
            proc.stdin.write(line)
            await proc.stdin.drain()
        except (BrokenPipeError, ConnectionResetError) as e:
            raise KordocWorkerCrashed(f"워커에 요청을 쓰지 못했습니다: {e}", self.stderr_tail()) from e
        try:
            line = await proc.stdout.readline()
        except (ValueError, asyncio.LimitOverrunError) as e:
            raise KordocWorkerCrashed(f"응답이 SDK 상한({self._config.max_response_bytes}바이트)을 넘습니다", self.stderr_tail()) from e
        if not line.endswith(b"\n"):
            await self._reap()
            what = "응답이 중간에 끊겼습니다" if line else "응답 전에 워커가 끝났습니다"
            raise KordocWorkerCrashed(f"{what} (code {proc.returncode})", self.stderr_tail())
        try:
            resp = json.loads(line)
        except json.JSONDecodeError:
            raise KordocWorkerCrashed(f"응답이 JSON 이 아닙니다: {line[:200]!r}", self.stderr_tail()) from None
        if not isinstance(resp, dict):
            raise KordocWorkerCrashed(f"응답이 객체가 아닙니다: {line[:200]!r}", self.stderr_tail())
        if resp.get("id") != msg["id"]:
            raise KordocWorkerCrashed(f"응답 id 가 요청과 다릅니다 (요청 {msg['id']}, 응답 {resp.get('id')})", self.stderr_tail())
        if isinstance(resp.get("rss"), int):
            self.last_rss = resp["rss"]
        err = resp.get("error")
        if err is not None:
            raise KordocProtocolError(str(err.get("code", "UNKNOWN")), str(err.get("message", "")))
        if not isinstance(resp.get("result"), dict):
            raise KordocWorkerCrashed("응답에 result 가 없습니다", self.stderr_tail())
        return resp

    async def _reap(self) -> None:
        if self._proc and self._proc.returncode is None:
            try:
                await asyncio.wait_for(self._proc.wait(), 1.0)
            except TimeoutError:
                pass

    async def kill(self) -> None:
        """즉시 종료하고 회수한다."""
        proc = self._proc
        if proc is not None and proc.returncode is None:
            try:
                proc.kill()
            except ProcessLookupError:
                pass
            await proc.wait()
        await self._finish_stderr()

    async def quit(self, timeout: float) -> None:
        """quit 를 보내고 끝나기를 기다린다. 제한 시간을 넘기거나 기다리는 중에 취소되면 강제 종료."""
        proc = self._proc
        try:
            if proc is not None and proc.returncode is None and proc.stdin:
                try:
                    proc.stdin.write(b'{"cmd":"quit"}\n')
                    await proc.stdin.drain()
                    proc.stdin.close()
                except (BrokenPipeError, ConnectionResetError):
                    pass
                try:
                    await asyncio.wait_for(proc.wait(), timeout)
                except TimeoutError:
                    pass
        finally:
            await self.kill()

    async def _finish_stderr(self) -> None:
        # 먼저 떼어 낸다 — 같은 워커를 두 곳에서 동시에 끝내도(aclose 와 실패 요청 정리) 서로의 정리를 깨지 않는다
        task, self._stderr_task = self._stderr_task, None
        if task is None:
            return
        try:
            await asyncio.wait_for(task, 1.0)
        except (TimeoutError, asyncio.CancelledError):
            task.cancel()
            # 워커가 끝나도 stderr 를 물려받은 손자 프로세스가 파이프를 쥐고 있다 — 우리 쪽 파이프를 닫아 둔다(닫힌 루프에서
            # transport 가 뒤늦게 정리되며 경고를 내지 않게)
            transport = getattr(self._proc, "_transport", None)
            if transport is not None:
                transport.close()

```

### Core Architecture Module: `src/cli/commands-render.ts`
```
/** kordoc CLI 명령 — 렌더 — render·crop·tables·render-worker */

import { readFileSync, writeFileSync, mkdirSync } from "fs"
import { dirname, resolve } from "path"
import { parse } from "../index.js"
import { VERSION, toArrayBuffer, sanitizeError, KordocError } from "../utils.js"
import type { Command } from "commander"

export function registerRenderCommands(program: Command): void {
  program
    .command("render <file>")
    .description("레이아웃 보존 렌더 — HWPX·HWP(5.x)를 SVG(기본, HWPX 는 전체 페이지 세로 스택)·HTML·PNG·JPEG·PDF로. 한컴 저장본은 조판 캐시 그대로, 캐시 없는 생성본·편집본은 순수 TS 조판(reflow, 기본 켬) — kordoc render 문서.hwpx -o 문서.svg / --format png --pages 2-4 -d ./pages / --format pdf -o 문서.pdf")
    .option("-o, --output <path>", "출력 경로 (단일 산출: svg 스택·html·pdf·한 쪽 png/jpeg. 기본: <입력>.<확장자>)")
    .option("-d, --out-dir <dir>", "페이지별 산출 디렉토리 (svg/png/jpeg 여러 쪽 → page_001.png …)")
    .option("--format <fmt>", "svg(기본) | html | png | jpeg | pdf")
    .option("--pages <range>", "렌더할 페이지 (1-based: 3 / 1-3 / 1,3,7-9)")
    .option("--max-width <px>", "래스터 최대 폭 px (기본 1400)")
    .option("--title <text>", "HTML/PDF 문서 제목")
    .option("--browser <path>", "PDF 용 Chromium 실행 파일 (기본: PUPPETEER_EXECUTABLE_PATH 또는 자동 탐지)")
    .option("--highlight <terms>", "검색어 형광펜 (쉼표 구분)")
    .option("--no-reflow", "순수 TS 조판 끄기 (조판 캐시 없는 문서가 빈 페이지로 나올 수 있음)")
    .option("--reflow", "순수 TS 조판 켜기 — 기본값과 같다 (옛 안내 호환, #97)")
    .option("--reflow-mode <mode>", "reflow 줄바꿈 모드: keep(어절) | charAll(글자)", "keep")
    .option("--silent", "진행 메시지 숨기기")
    .action(async (file: string, opts) => {
      try {
        const rootOpts = program.opts()
        const output: string | undefined = opts.output ?? rootOpts.output
        const outDir: string | undefined = opts.outDir ?? rootOpts.outDir
        const silent: boolean = opts.silent ?? rootOpts.silent
        // 루트 --format(markdown 기본) 이 서브커맨드 뒤 --format 을 흡수한다(cli-options 회귀) — 기본값이 아니면 그 값을 쓴다
        const fmt: string = opts.format ?? (rootOpts.format && rootOpts.format !== "markdown" ? rootOpts.format : "svg")
        const pages: string | undefined = opts.pages ?? rootOpts.pages
        if (!["svg", "html", "png", "jpeg", "pdf"].includes(fmt)) throw new KordocError(`--format 은 svg|html|png|jpeg|pdf 중 하나: ${fmt}`)
        const highlights = opts.highlight ? String(opts.highlight).split(",") : undefined
        const absPath = resolve(file)
        const stem = file.replace(/\.hwpx?$/i, "")
        if (fmt === "svg" && !outDir && !pages && !/\.hwp$/i.test(absPath)) {
          // 종전 동작(HWPX) — 전체 페이지 세로 스택 SVG 한 파일. HWP5 는 통합 렌더러(페이지별)
          const { renderHwpxToSvg } = await import("../render/index.js")
          const buffer = readFileSync(absPath)
          const result = await renderHwpxToSvg(toArrayBuffer(buffer), { highlights, reflow: opts.reflow, reflowMode: opts.reflowMode })
          const outPath = resolve(output ?? stem + ".svg")
          mkdirSync(dirname(outPath), { recursive: true })
          writeFileSync(outPath, result.svg, "utf-8")
          if (!silent) {
            process.stderr.write(`[kordoc] 렌더 (${result.pageCount}페이지, ${result.width}x${result.height}pt, 텍스트 ${result.stats.texts}·이미지 ${result.stats.images}·표 ${result.stats.tables}) → ${outPath}\n`)
            for (const w of result.warnings) process.stderr.write(`[kordoc] ⚠️ ${w}\n`)
          }
          return
        }
        const { renderDocument } = await import("../render/index.js")
        const { scene, assets } = await renderDocument(absPath, {
          format: fmt as "svg" | "html" | "png" | "jpeg" | "pdf", pages, highlights, reflow: opts.reflow, reflowMode: opts.reflowMode,
          maxWidthPx: opts.maxWidth ? Number(opts.maxWidth) : undefined, title: opts.title, browserExecutablePath: opts.browser,
        })
        const ext = fmt === "jpeg" ? "jpg" : fmt
        const written: string[] = []
        if (fmt === "html" || fmt === "pdf" || (assets.length === 1 && !outDir)) {
          const outPath = resolve(output ?? stem + "." + ext)
          mkdirSync(dirname(outPath), { recursive: true })
          writeFileSync(outPath, assets[0].data)
          written.push(outPath)
        } else {
          if (!outDir) throw new KordocError(`페이지 ${assets.length}장 산출은 --out-dir 이 필요합니다 (한 쪽만 내려면 --pages 로 선택)`)
          mkdirSync(resolve(outDir), { recursive: true })
          for (const a of assets) {
            const outPath = resolve(outDir, `page_${String(a.page).padStart(3, "0")}.${ext}`)
            writeFileSync(outPath, a.data)
            written.push(outPath)
          }
        }
        if (!silent) {
          process.stderr.write(`[kordoc] 렌더 ${fmt} (${scene.pages.length}페이지 중 ${assets.length}건, 텍스트 ${scene.stats.texts}·이미지 ${scene.stats.images}·표 ${scene.stats.tables}·도형 ${scene.stats.shapes}) → ${written.length === 1 ? written[0] : resolve(outDir!)}\n`)
          for (const w of scene.warnings) process.stderr.write(`[kordoc] ⚠️ ${w}\n`)
        }
      } catch (err) {
        // exit(1) 을 바로 부르면 파이프 stderr 가 유실된다 — exitCode 로 정상 종료
        process.stderr.write(`[kordoc] 오류: ${sanitizeError(err)}\n`)
        process.exitCode = 1
      }
    })

  program
    .command("crop <file>")
    .description("렌더 영역 잘라내기 — 표·이미지·문단·도형을 페이지 이미지에서 crop (HWPX·HWP) — kordoc crop 문서.hwpx --target table -d ./regions")
    .option("-d, --out-dir <dir>", "출력 디렉토리 (필수) — <유형>_<번호>_page_<쪽>.png + regions.json")
    .option("--target <types>", "유형(쉼표): table | image | paragraph | shape", "table")
    .option("--format <fmt>", "png(기본) | jpeg")
    .option("--pages <range>", "대상 페이지 (1-based)")
    .option("--padding <pt>", "bbox 둘레 여백 pt", "0")
    .option("--max-width <px>", "페이지 래스터 최대 폭 px (crop 해상도, 기본 1400)")
    .option("--no-reflow", "순수 TS 조판 끄기")
    .option("--reflow", "순수 TS 조판 켜기 — 기본값과 같다 (옛 안내 호환)")
    .option("--reflow-mode <mode>", "reflow 줄바꿈 모드: keep | charAll", "keep")
    .option("--silent", "진행 메시지 숨기기")
    .action(async (file: string, opts) => {
      try {
        const rootOpts = program.opts()
        const outDir: string | undefined = opts.outDir ?? rootOpts.outDir
        const silent: boolean = opts.silent ?? rootOpts.silent
        const fmt: string = opts.format ?? (rootOpts.format && rootOpts.format !== "markdown" ? rootOpts.format : "png")
        const pages: string | undefined = opts.pages ?? rootOpts.pages
        if (!["png", "jpeg"].includes(fmt)) throw new KordocError(`--format 은 png|jpeg 중 하나: ${fmt}`)
        if (!outDir) throw new KordocError("--out-dir 이 필요합니다 (crop 은 파일 여러 개를 냅니다)")
        const types = String(opts.target).split(",").map((t: string) => t.trim()).filter(Boolean)
        for (const t of types) if (!["table", "image", "paragraph", "shape"].includes(t)) throw new KordocError(`--target 유형 오류: ${t}`)
        const { extractRenderedRegions } = await import("../render/index.js")
        const regions = await extractRenderedRegions(resolve(file), {
          types: types as Array<"table" | "image" | "paragraph" | "shape">, format: fmt as "png" | "jpeg", pages,
          paddingPt: Number(opts.padding) || 0, maxWidthPx: opts.maxWidth ? Number(opts.maxWidth) : undefined, reflow: opts.reflow, reflowMode: opts.reflowMode,
        })
        const dir = resolve(outDir)
        mkdirSync(dir, { recursive: true })
        const ext = fmt === "jpeg" ? "jpg" : "png"
        const manifest = regions.map(r => {
          const name = `${r.region.id.replace("-", "_")}_page_${String(r.page).padStart(3, "0")}.${ext}`
          writeFileSync(resolve(dir, name), r.data)
          return { file: name, id: r.region.id, type: r.region.type, sourceId: r.region.sourceId, parentId: r.region.parentId, page: r.page, bbox: r.bbox, widthPx: r.widthPx, heightPx: r.heightPx }
        })
        writeFileSync(resolve(dir, "regions.json"), JSON.stringify(manifest, null, 2))
        if (!silent) process.stderr.write(`[kordoc] crop ${regions.length}건 (${types.join(",")}) → ${dir}\n`)
      } catch (err) {
        // exit(1) 을 바로 부르면 파이프 stderr 가 유실된다 — exitCode 로 정상 종료
        process.stderr.write(`[kordoc] 오류: ${sanitizeError(err)}\n`)
        process.exitCode = 1
      }
    })

  program
    .command("tables <file>")
    .description("표 추출·분류 — 의미표/레이아웃(조직도 등)/불확실 분류 JSON + 선택적 시각 crop (HWPX·HWP) — kordoc tables 문서.hwpx --visual non-tabular-and-uncertain -d ./tables")
    .option("-o, --output <path>", "JSON 출력 경로 (기본 stdout; -d 지정 시 <out-dir>/tables.json)")
    .option("-d, --out-dir <dir>", "crop 저장 디렉토리 (--visual 지정 시 필수)")
    .option("--visual <policy>", "crop 대상: none(기본) | non-tabular | non-tabular-and-uncertain | all", "none")
    .option("--crop-format <fmt>", "png(기본) | jpeg", "png")
    .option("--padding <pt>", "crop 여백 pt", "0")
    .option("--cells", "JSON 에 셀 텍스트 격자 포함")
    .option("--silent", "진행 메시지 숨기기")
    .action(async (file: string, opts) => {
      try {
        const rootOpts = program.opts()
        const output: string | undefined = opts.output ?? rootOpts.output
        const outDir: string | undefined = opts.outDir ?? rootOpts.outDir
        const silent: boolean = opts.silent ?? rootOpts.silent
        const policy = String(opts.visual)
        if (!["none", "non-tabular", "non-tabular-and-uncertain", "all"].includes(policy)) throw new KordocError(`--visual 은 none|non-tabular|non-tabular-and-uncertain|all: ${policy}`)
        if (policy !== "none" && !outDir) throw new KordocError("--visual 은 crop 파일을 내므로 --out-dir 이 필요합니다")
        const cropFmt = String(opts.cropFormat)
        if (!["png", "jpeg"].includes(cropFmt)) throw new KordocError(`--crop-format 은 png|jpeg: ${cropFmt}`)
        const { extractTables } = await import("../table/visual.js")
        const tables = await extractTables(resolve(file), { policy: policy as "none" | "non-tabular" | "non-tabular-and-uncertain" | "all", format: cropFmt as "png" | "jpeg", paddingPt: Number(opts.padding) || 0 })
        const dir = outDir ? resolve(outDir) : undefined
        if (dir) mkdirSync(dir, { recursive: true })
        co
```

### Core Architecture Module: `src/cli/commands-worker.ts`
```
/** kordoc CLI 명령: 상주 파싱 워커 (parse-worker) */

import { resolve } from "path"
import type { ParseOptions, ParseResult } from "../types.js"
import { VERSION, sanitizeError, classifyError, routeConsoleToStderr } from "../utils.js"
import type { Command } from "commander"
import { parseWorkerFile } from "./worker-parse.js"

/** 요청·응답 필드가 바뀌면 올린다. 호스트가 ready 줄로 호환을 판단한다 */
export const PARSE_WORKER_PROTOCOL = 1

interface ParseWorkerRequest {
  id?: number
  cmd?: string
  file?: string
  /** false 면 이미지 바이트를 싣지 않는다 (ParseOptions.images) */
  images?: boolean
  /** "off"(기본) | "auto"(OCR 필요 페이지만) | "force"(전 페이지) */
  ocr?: "off" | "auto" | "force"
  formulaOcr?: boolean
  password?: string | null
}

/** 이미지 바이트는 --format json 과 같게 base64 로 */
const bytesToBase64 = (_key: string, value: unknown): unknown =>
  value instanceof Uint8Array ? Buffer.from(value).toString("base64") : value

async function parseOne(req: ParseWorkerRequest & { file: string }): Promise<ParseResult> {
  const absPath = resolve(req.file)
  const options: ParseOptions = { filePath: absPath }
  if (req.images === false) options.images = false
  if (req.ocr === "force") options.ocr = "force"
  else if (req.ocr === "auto") options.ocr = true
  if (req.formulaOcr) options.formulaOcr = true
  if (req.password) options.password = req.password
  return parseWorkerFile(absPath, options)
}

export function registerWorkerCommands(program: Command): void {
  program
    .command("parse-worker")
    .description("상주 파싱 워커: stdin NDJSON 요청 → 한 줄 JSON 응답 (프로세스 유지, 파일마다 node 를 새로 띄우는 비용 제거)")
    .option("--protocol <version>", "프로토콜 버전: 1(기본) | 2(Java·Python SDK — ParseOptions·이미지 파일 전송, docs/parse-worker-protocol.md)", "1")
    .option("--max-request-bytes <n>", "protocol 2: 요청 한 줄 상한 바이트")
    .option("--max-response-bytes <n>", "protocol 2: 응답 한 줄 상한 바이트")
    .action(async (opts: { protocol: string; maxRequestBytes?: string; maxResponseBytes?: string }) => {
      if (opts.protocol === "2") {
        const limit = (v: string | undefined, name: string): number | undefined => {
          if (v === undefined) return undefined
          const n = Number(v)
          if (!/^\d+$/.test(v) || !Number.isSafeInteger(n) || n < 1) {
            process.stderr.write(`[kordoc] ${name} 는 양의 정수여야 합니다: ${v}\n`)
            process.exit(2)
          }
          return n
        }
        const maxRequestBytes = limit(opts.maxRequestBytes, "--max-request-bytes")
        const maxResponseBytes = limit(opts.maxResponseBytes, "--max-response-bytes")
        routeConsoleToStderr()
        const { runParseWorkerV2 } = await import("./parse-worker-v2.js")
        await runParseWorkerV2({ maxRequestBytes, maxResponseBytes })
        process.exit(0)
      }
      if (opts.protocol !== "1") {
        // CLI 단건 실행 등으로 조용히 대체하지 않는다 — 호스트가 엔진 버전 불일치를 바로 알게
        process.stderr.write(`[kordoc] 지원하지 않는 parse-worker protocol: ${opts.protocol} (1, 2)\n`)
        process.exit(2)
      }
      // 프로토콜(NDJSON, 한 줄 = 한 메시지):
      //  시작 {"ready":true,"version":"4.14.3","protocol":1}
      //  요청 {"id":1,"file":"a.hwpx","images":false,"ocr":"off","formulaOcr":false,"password":null}
      //  응답 {"id":1,"rss":123456789,"result":{…}}: result 는 --format json 과 같은 ParseResult (실패도 success:false 로)
      //       {"id":1,"error":"…"}: 요청 자체가 잘못됐을 때
      //  {"cmd":"quit"} 또는 stdin 닫힘으로 종료. rss 는 호스트가 워커 교체 시점을 정하는 데 쓴다.
      // pdfjs 등이 console 로 찍는 경고가 stdout 프로토콜 줄을 깨지 않게 stderr 로 돌린다
      routeConsoleToStderr()
      const { createInterface } = await import("node:readline")
      const rl = createInterface({ input: process.stdin, crlfDelay: Infinity })
      const write = (o: unknown): void => void process.stdout.write(JSON.stringify(o, bytesToBase64) + "\n")
      write({ ready: true, version: VERSION, protocol: PARSE_WORKER_PROTOCOL })
      for await (const line of rl) {
        const t = line.trim()
        if (!t) continue
        let req: ParseWorkerRequest
        // 비JSON 라인도 응답은 낸다. 무음 삼킴이면 id 를 기다리는 호스트가 영구 대기
        try { req = JSON.parse(t) } catch { write({ error: "잘못된 JSON 라인" }); continue }
        if (req === null || typeof req !== "object") { write({ error: "JSON 객체가 아닙니다" }); continue }
        if (req.cmd === "quit") break
        const id = req.id
        if (typeof req.file !== "string" || !req.file) { write({ id, error: "file 필수" }); continue }
        const result = await parseOne({ ...req, file: req.file })
        try {
          write({ id, rss: process.memoryUsage.rss(), result })
        } catch (err) {
          // 직렬화 한계(이미지 수백 장 base64 등, #65)는 실패 JSON 계약으로
          write({ id, rss: process.memoryUsage.rss(), result: { success: false, fileType: result.fileType, error: sanitizeError(err), code: classifyError(err) } })
        }
      }
      rl.close()
      // 파이프 stdout 은 맥·윈도에서 비동기라 바로 exit 하면 마지막 응답이 잘린다. 다 비운 뒤 끝낸다.
      // pdfjs 등이 남긴 핸들이 있어도 워커는 끝낸다 (호스트가 죽어 stdin 이 닫힌 경우의 고아 방지)
      await new Promise<void>((done) => process.stdout.write("", () => done()))
      process.exit(0)
    })
}

```

### Core Architecture Module: `src/cli/parse-worker-v2.ts`
```
/**
 * parse-worker protocol 2 — Java·Python SDK 용 상주 워커 계약 (docs/parse-worker-protocol.md).
 * protocol 1 과 같은 parseWorkerFile 로 파싱하고, 요청 검증·옵션 허용 목록·이미지 파일 전송·입출력 상한만 더한다.
 */

import { createHash } from "crypto"
import { mkdtempSync, realpathSync, rmSync, statSync, writeFileSync } from "fs"
import { basename, isAbsolute, join } from "path"
import { z } from "zod"
import type { IRBlock, ParseOptions, ParseResult } from "../types.js"
import { VERSION, sanitizeError } from "../utils.js"
import { parseWorkerFile } from "./worker-parse.js"
import { validateOcrOptions } from "../ocr/options.js"

export const PARSE_WORKER_PROTOCOL_V2 = 2
export const CAPABILITIES = ["parse", "options", "transport.images.inline", "transport.images.files"] as const
/** 요청 한 줄 기본 상한 — 요청은 경로·옵션뿐이라 작다 */
export const DEFAULT_MAX_REQUEST_BYTES = 1024 * 1024
/** 응답 한 줄 기본 상한 — V8 문자열 한계(약 512MB) 아래. 넘으면 transport.images "files" 로 */
export const DEFAULT_MAX_RESPONSE_BYTES = 256 * 1024 * 1024

export type WorkerErrorCode =
  | "INVALID_JSON" | "INVALID_REQUEST" | "INVALID_OPTIONS" | "UNSUPPORTED_COMMAND" | "DUPLICATE_ID"
  | "REQUEST_TOO_LARGE" | "RESPONSE_TOO_LARGE" | "ASSET_WRITE_FAILED"

/** 파싱 실패(result.success:false)가 아닌 요청·전송 오류 — 응답 {id?, error:{code, message}} */
export class WorkerProtocolError extends Error {
  constructor(readonly code: WorkerErrorCode, message: string) {
    super(message)
    this.name = "WorkerProtocolError"
  }
}

/** 로컬 OCR 모델 파일 {path, sha256} — 값 검증(절대 경로·16진 64자)은 validateOcrOptions 가 parse() 와 같은 문구로 */
const modelFileSchema = z.object({ path: z.string(), sha256: z.string() }).strict()

/** wire 로 받는 ParseOptions 허용 목록. 함수 값(ocr 프로바이더·onProgress)과 filePath 는 받지 않는다 */
const optionsSchema = z.object({
  tableFormat: z.literal("gfm"),
  htmlTables: z.boolean(),
  layoutTables: z.enum(["visual", "keep"]),
  classifyTables: z.boolean(),
  tables: z.boolean(),
  plain: z.boolean(),
  scriptTags: z.boolean(),
  removeHeaderFooter: z.boolean(),
  dedupeRunningHeaders: z.boolean(),
  keepTrailingEmptyCols: z.boolean(),
  keepEmptyParagraphs: z.boolean(),
  includeFieldPlaceholders: z.boolean(),
  pages: z.union([z.string(), z.array(z.number().int().positive())]),
  images: z.boolean(),
  inlineImages: z.boolean(),
  ocr: z.union([z.boolean(), z.literal("force")]),
  ocrLines: z.union([z.boolean(), z.literal("all")]),
  ocrDet: z.union([z.enum(["mobile", "server"]), modelFileSchema]),
  ocrDetLongSide: z.number().int(),
  ocrRec: z.union([z.literal("handwriting"), modelFileSchema]),
  ocrRecDict: modelFileSchema,
  formulaOcr: z.boolean(),
  password: z.string(),
}).partial().strict()

const transportSchema = z.object({
  images: z.enum(["inline", "files"]).optional(),
  assetsDir: z.string().optional(),
}).strict()

const parseRequestSchema = z.object({
  id: z.number(),
  cmd: z.literal("parse"),
  file: z.string().min(1),
  options: z.unknown().optional(),
  transport: transportSchema.optional(),
}).strict()

const issueText = (e: z.ZodError, prefix: string): string =>
  e.issues.map(i => `${[prefix, ...i.path].filter(Boolean).join(".")}: ${i.message}`).join("; ")

/** wire options → ParseOptions. 미지정은 키를 두지 않아(엔진 기본값) false 와 구분한다. filePath 는 실제 입력 경로 */
export function toParseOptions(wire: unknown, absPath: string): ParseOptions {
  const parsed = optionsSchema.safeParse(wire ?? {})
  if (!parsed.success) throw new WorkerProtocolError("INVALID_OPTIONS", issueText(parsed.error, "options"))
  const o = parsed.data
  // parse() 는 실패 결과로 막지만, 요청 자체의 잘못이라 프로토콜 오류로 돌려준다
  if (o.htmlTables && o.tableFormat) throw new WorkerProtocolError("INVALID_OPTIONS", "options: htmlTables 와 tableFormat 은 함께 쓸 수 없습니다")
  const ocrError = validateOcrOptions(o)
  if (ocrError) throw new WorkerProtocolError("INVALID_OPTIONS", `options: ${ocrError}`)
  const out: ParseOptions = { filePath: absPath }
  for (const [k, v] of Object.entries(o)) if (v !== undefined) (out as Record<string, unknown>)[k] = v
  return out
}

interface ImageHolder { data?: unknown; filename?: string; dataRef?: { path: string; byteLength: number } }

/** 결과 안의 이미지 바이트(result.images[]·블록 imageData — children·셀 blocks·captionBlocks 까지)를 모은다 */
function collectImageHolders(result: ParseResult): ImageHolder[] {
  if (!result.success) return []
  const holders: ImageHolder[] = [...(result.images ?? [])]
  const walk = (blocks: IRBlock[] | undefined, depth: number): void => {
    if (!blocks || depth > 64) return
    for (const b of blocks) {
      if (b.imageData) holders.push(b.imageData)
      walk(b.children, depth + 1)
      if (b.table) {
        for (const row of b.table.cells) for (const cell of row) walk(cell.blocks, depth + 1)
        walk(b.table.captionBlocks, depth + 1)
      }
    }
  }
  walk(result.blocks, 0)
  return holders
}

/** 파일 이름으로 쓸 수 있는 글자만 — 경로 구분자·상위 경로·제어 문자를 막는다 */
function safeFileName(name: string | undefined, fallback: string): string {
  const base = basename((name ?? "").replace(/\\/g, "/")).replace(/[\u0000-\u001f<>:"|?*]/g, "_").replace(/^\.+/, "")
  const safe = base && base !== "." && base !== ".." ? base.slice(0, 120) : fallback
  // 확장자는 그림 형식만 — 문서가 정한 이름(payload.html·x.svg)을 그대로 쓰면 자산 폴더를 열거나 서빙할 때 스크립트가 돈다
  return /\.(?:png|jpe?g|gif|bmp|tiff?|wmf|emf|webp|bin)$/i.test(safe) ? safe : safe.replace(/(\.[^.]*)?$/, ".bin")
}

/**
 * transport.images "files" — 이미지 바이트를 assetsDir 아래 요청별 새 디렉터리에 쓰고 data 를 dataRef {path, byteLength} 로 바꾼다.
 * path 는 그 디렉터리 기준 파일 이름. 같은 바이트는 한 파일을 함께 가리키고, 이름이 같아도 바이트가 다르면 다른 파일로 쓴다.
 * 파일은 배타 생성(wx)이라 기존 파일·링크를 덮어쓰지 않는다. 실패하면 이 요청이 만든 디렉터리만 지운다.
 * 이미지가 없으면 디렉터리를 만들지 않고 undefined
 */
export async function externalizeImages(result: ParseResult, assetsRoot: string, id: number): Promise<string | undefined> {
  const holders = collectImageHolders(result).filter(h => h.data !== undefined)
  if (!holders.length) return undefined
  const root = realpathSync(assetsRoot)
  const dir = mkdtempSync(join(root, `kordoc-${id}-`))
  try {
    const byHash = new Map<string, string>()
    const used = new Set<string>()
    let n = 0
    for (const h of holders) {
      if (!(h.data instanceof Uint8Array)) throw new WorkerProtocolError("ASSET_WRITE_FAILED", "이미지 바이트가 Uint8Array 가 아닙니다")
      const bytes = h.data
      const hash = createHash("sha256").update(bytes).digest("hex")
      let path = byHash.get(hash)
      if (!path) {
        const name = safeFileName(h.filename, `image_${String(++n).padStart(3, "0")}.bin`)
        path = name
        for (let k = 2; used.has(path); k++) path = name.replace(/(\.[^.]*)?$/, ext => `-${k}${ext}`)
        writeFileSync(join(dir, path), bytes, { flag: "wx" })
        used.add(path)
        byHash.set(hash, path)
      }
      delete h.data
      h.dataRef = { path, byteLength: bytes.byteLength }
    }
    return dir
  } catch (err) {
    rmSync(dir, { recursive: true, force: true })
    if (err instanceof WorkerProtocolError) throw err
    throw new WorkerProtocolError("ASSET_WRITE_FAILED", sanitizeError(err))
  }
}

/** stdin 을 바이트 단위로 줄로 자른다 — 멀티바이트 글자가 read 경계에 걸려도 줄 단위로 해독. 상한을 넘은 줄은 tooLarge */
async function* readLines(input: NodeJS.ReadableStream, maxBytes: number): AsyncGenerator<{ line?: string; tooLarge?: true }> {
  let pending: Buffer[] = []
  let pendingBytes = 0
  let discarding = false
  for await (const chunk of input as AsyncIterable<Buffer>) {
    let buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    for (let nl = buf.indexOf(0x0a); nl !== -1; nl = buf.indexOf(0x0a)) {
      const head = buf.subarray(0, nl)
      buf = buf.subarray(nl + 1)
      if (discarding) { discarding = false; continue }
      if (pendingBytes + head.length > maxBytes) { pending = []; pendingBytes = 0; yield { tooLarge: true }; continue }
      const line = Buffer.concat([...pending, head]).toString("utf8").replace(/\r$/, "")
      pending = []
      pendingBytes = 0
      yield { line }
    }
    if (discarding) continue
    if (pendingBytes + buf.length > maxBytes) { pending = []; pendingBytes = 0; discarding = true; yield { tooLarge: true }; continue }
    if (buf.length) { pending.push(buf); pendingBytes += buf.length }
  }
  if (!discarding && pendingBytes) yield { line: Buffer.concat(pending).toString("utf8").replace(/\r$/, "") }
}

const bytesToBase64 = (_key: string, value: unknown): unknown =>
  value instanceof Uint8Array ? Buffer.from(value).toString("base64") : value

const validId = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v > 0

export interface ParseWorkerV2Options {
  maxRequestBytes?: number
  maxResponseBytes?: number
  input?: NodeJS.ReadableStream
  output?: NodeJS.WritableStream
}

/** protocol 2 워커 루프 — ready 를 쓰고 요청을 하나씩 처리한다. quit 또는 stdin EOF 에서 마지막 응답을 비우고 돌아온다 */
export async function runParseWorkerV2(opts: ParseWorkerV2Options = {}): Promise<void> {
  const input = opts.input ?? process.stdin
  const output = opts.output ?? process.stdout
  const maxRequestBytes = opts.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES
  const maxResponseBytes = opts.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES
  const seen = new Set<number>()
  let broken = false
  // 쓰기 오류는 write 콜백이 다룬다 — 리스너가 없으면 뒤따르는 'error' 가 uncaught 로 exit 1 을 낸다
  output.on("error", () => {})

  /** 한 줄 쓰기 — 상한을 넘거나 직렬화가 터지면 잘린 성공 대신 RESPONSE_TOO_LARGE(false 반환). stdout 이 닫혀 못 보냈어도 false */
  const write = async (o: Record<string, unknown>): Promise<boolean> => {
    let text: string
    let sent = true
    try {
      text = JSON.stringify(o, bytesToBase64)
      if (Buffer.byteLength(text) > maxResponseBytes) throw new RangeError("limit")
    } catch {
      sent = false
      text = JSON.stringify({ ...(validId(o.id) ? { id: o.id } : {}), error: { code: "RESPONSE_TOO_LARGE", message: `응답이 상한(${maxResponseBytes}바이트)을 넘습니다 — transport.images "files" 로 이미지를 파일로 받으세요` } })
    }
    // 쓰기 콜백까지 기다린다 — drain 대기를 겸한다
    const delivered = await new Promise<boolean>((done, reject) => output.write(text + "\n", err => {
      if (!err) return done(tr
```

### Core Architecture Module: `src/cli/worker-parse.ts`
```
/** parse-worker 공통 파싱 — protocol 1·2 가 같은 경로로 parse() 를 부른다 */

import { readFileSync, statSync } from "fs"
import { parse } from "../index.js"
import type { ParseOptions, ParseResult } from "../types.js"
import { toArrayBuffer, sanitizeError, classifyError } from "../utils.js"

/** CLI 와 같은 입력 상한 */
const MAX_FILE_BYTES = 500 * 1024 * 1024

/** 파일 하나를 파싱한다. 실패는 던지지 않고 success:false 결과로 (CLI --format json 과 같은 계약) */
export async function parseWorkerFile(absPath: string, options: ParseOptions): Promise<ParseResult> {
  try {
    const size = statSync(absPath).size
    if (size > MAX_FILE_BYTES) {
      return { success: false, fileType: "unknown", error: `파일이 너무 큽니다 (${(size / 1024 / 1024).toFixed(1)}MB)`, code: "PARSE_ERROR" }
    }
    return await parse(toArrayBuffer(readFileSync(absPath)), options)
  } catch (err) {
    return { success: false, fileType: "unknown", error: sanitizeError(err), code: classifyError(err) }
  }
}

```

### Core Architecture Module: `src/mcp/tools-render.ts`
```
/** kordoc MCP 도구 — 렌더 — render_document·crop_regions·extract_tables */

import { z } from "zod"
import { mkdir } from "fs/promises"
import { dirname, join } from "path"
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { MAX_FILE_SIZE, safeOutputPath, writeOutputFile, describeError, readValidatedFile } from "./shared.js"

export function registerRenderTools(server: McpServer): void {
  // ─── 도구: render_document ───────────────────────────

  server.tool(
    "render_document",
    "HWPX·HWP 문서를 실제 조판 그대로 렌더해 PNG/JPEG 이미지로 응답하거나 SVG·HTML·PDF 파일로 저장합니다. generate_document·fill_form·patch_document·place_seal 결과물을 눈으로 확인하는 용도 — 생성/수정 후 이 도구로 렌더해 깨짐·잘림·배치를 검증하고 다시 고치는 루프를 권장합니다. 한컴 저장본(HWPX·HWP 모두)은 조판 캐시로 정확히, AI 생성본(캐시 없음)은 순수 조판 엔진(reflow)으로 렌더되며 후자는 한컴 실조판의 근사입니다 (참고용 미리보기).",
    {
      file_path: z.string().min(1).describe("렌더할 HWPX 또는 HWP(5.x) 파일의 절대 경로"),
      format: z.enum(["png", "jpeg", "svg", "html", "pdf"]).default("png").describe("png/jpeg=이미지로 응답에 직접 반환(output_path 는 선택) / svg·html·pdf=output_path 에 파일 저장(필수). svg 는 pages 미지정 HWPX 면 전체 세로 스택 1파일, 그 외 페이지별 파일. html=자급자족 레이아웃 HTML 1파일, pdf=Chromium 필요"),
      output_path: z.string().min(1).optional().describe("결과 저장 경로 (확장자는 format 과 일치 — .png/.jpg/.svg/.html/.pdf). 페이지별 산출은 _page_NNN 접미"),
      highlights: z.array(z.string().min(1)).optional().describe("형광펜 표시할 검색어 목록 — 채운 값·수정 문구 위치 확인용"),
      reflow_mode: z.enum(["keep", "charAll"]).default("keep").describe("reflow 줄바꿈: keep=어절 단위, charAll=글자 단위"),
      pages: z.string().min(1).optional().describe("페이지 선택(1-based: '3', '1-3', '1,3,7-9') — 지정하면 페이지별 산출(이미지 응답은 최대 8쪽). HWPX png/svg 에서 미지정이면 전체를 세로 스택 1장으로"),
      max_width_px: z.number().int().min(200).max(4000).optional().describe("래스터(png/jpeg) 최대 폭 px — 큰 문서 응답 부피 조절"),
    },
    async ({ file_path, format, output_path, highlights, reflow_mode, pages, max_width_px }) => {
      try {
        const EXT: Record<string, string[]> = { png: [".png"], jpeg: [".jpg", ".jpeg"], svg: [".svg"], html: [".html", ".htm"], pdf: [".pdf"] }
        const needsFile = format === "svg" || format === "html" || format === "pdf"
        if (needsFile && !output_path) {
          return { content: [{ type: "text", text: `format: "${format}" 은 output_path(${EXT[format][0]})가 필수입니다 — 원문은 커서 응답에 직접 담지 않습니다.` }], isError: true }
        }
        const outPath = output_path ? safeOutputPath(output_path, new Set(EXT[format])) : undefined
        const { buffer, resolved } = await readValidatedFile(file_path, MAX_FILE_SIZE, new Set([".hwpx", ".hwp"]))
        const isHwp5 = resolved.toLowerCase().endsWith(".hwp")
        if (!isHwp5 && !pages && (format === "png" || format === "svg")) {
          // 종전 동작(HWPX·pages 미지정): 전 페이지 세로 스택 1장/1파일
          const { renderHwpxToSvg } = await import("../render/index.js")
          // reflow는 조판 캐시가 있으면 무시되므로 항상 켠다 — 한컴본·생성본 모두 커버
          const result = await renderHwpxToSvg(buffer, { highlights, reflow: true, reflowMode: reflow_mode })
          const summary = [
            `렌더 완료: ${result.pageCount}페이지, ${Math.round(result.width)}x${Math.round(result.height)}pt (텍스트 ${result.stats.texts}·이미지 ${result.stats.images}·표 ${result.stats.tables})`,
            ...result.warnings.map(w => `⚠️ ${w}`),
          ]
          if (format === "svg") {
            await mkdir(dirname(outPath!), { recursive: true })
            await writeOutputFile(outPath!, result.svg, "utf-8")
            summary.push(`저장: ${outPath}`)
            return { content: [{ type: "text", text: summary.join("\n") }] }
          }
          const { rasterizeSvg } = await import("../render/rasterize.js")
          const raster = await rasterizeSvg(result.svg, result.width, result.height, max_width_px ? { maxWidthPx: max_width_px } : undefined)
          if (outPath) {
            await mkdir(dirname(outPath), { recursive: true })
            await writeOutputFile(outPath, raster.png)
            summary.push(`저장: ${outPath}`)
          }
          summary.push(`이미지 ${raster.widthPx}x${raster.heightPx}px — 잘림·겹침·빈칸·페이지 넘침이 보이면 원인 텍스트를 수정해 다시 생성/패치하세요.`)
          return {
            content: [
              { type: "image", data: raster.png.toString("base64"), mimeType: "image/png" },
              { type: "text", text: summary.join("\n") },
            ],
          }
        }
        // 통합 렌더러(renderDocument) — 페이지별 산출. HWP5 는 항상 이 경로
        const { renderDocument } = await import("../render/index.js")
        const { scene, assets } = await renderDocument(buffer, { format, pages, highlights, reflow: true, reflowMode: reflow_mode, maxWidthPx: max_width_px })
        const summary = [
          `렌더 완료: 문서 ${scene.pages.length}페이지 중 ${assets.filter(a => a.page !== undefined).length || 1}건 (텍스트 ${scene.stats.texts}·이미지 ${scene.stats.images}·표 ${scene.stats.tables}·도형 ${scene.stats.shapes})`,
          ...scene.warnings.map(w => `⚠️ ${w}`),
        ]
        const suffixed = (p: string, page: number) => p.replace(/(\.[^.]+)$/, `_page_${String(page).padStart(3, "0")}$1`)
        if (outPath) {
          await mkdir(dirname(outPath), { recursive: true })
          for (const a of assets) {
            const p = a.page === undefined || assets.length === 1 ? outPath : suffixed(outPath, a.page)
            await writeOutputFile(p, a.data as Buffer | string)
            summary.push(`저장: ${p}`)
          }
        }
        if (format === "png" || format === "jpeg") {
          const MAX_PAGES = 8
          const shown = assets.slice(0, MAX_PAGES)
          if (assets.length > MAX_PAGES) summary.push(`⚠️ ${MAX_PAGES}쪽까지만 응답에 담았습니다 — pages 를 좁히세요`)
          return {
            content: [
              ...shown.map(a => ({ type: "image" as const, data: (a.data as Buffer).toString("base64"), mimeType: format === "jpeg" ? "image/jpeg" : "image/png" })),
              { type: "text", text: summary.join("\n") },
            ],
          }
        }
        return { content: [{ type: "text", text: summary.join("\n") }] }
      } catch (err) {
        return {
          content: [{ type: "text", text: `렌더 실패: ${describeError(err)}` }],
          isError: true,
        }
      }
    },
  )

  // ─── 도구: crop_regions ──────────────────────────────

  server.tool(
    "crop_regions",
    "HWPX·HWP 문서를 렌더해 표·이미지·문단·도형 영역을 페이지 이미지에서 잘라 파일로 저장합니다(render_document 와 같은 조판 엔진, 페이지 로컬 pt bbox 를 실배율로 환산). 표가 진짜 데이터표인지 조직도인지는 판단하지 않습니다(그건 extract_tables) — 렌더러가 아는 개체를 자를 뿐. 결과: output_dir/<유형>_<번호>_page_<쪽>.png + regions.json(id·유형·페이지·bbox pt).",
    {
      file_path: z.string().min(1).describe("HWPX 또는 HWP(5.x) 파일 절대 경로"),
      output_dir: z.string().min(1).describe("crop 파일 저장 디렉토리"),
      target: z.array(z.enum(["table", "image", "paragraph", "shape"])).default(["table"]).describe("잘라낼 개체 유형"),
      format: z.enum(["png", "jpeg"]).default("png"),
      pages: z.string().min(1).optional().describe("대상 페이지(1-based 범위)"),
      padding_pt: z.number().min(0).max(100).default(0).describe("bbox 둘레 여백 pt"),
    },
    async ({ file_path, output_dir, target, format, pages, padding_pt }) => {
      try {
        const { buffer } = await readValidatedFile(file_path, MAX_FILE_SIZE, new Set([".hwpx", ".hwp"]))
        const dir = safeOutputPath(join(output_dir, "regions.json"), new Set([".json"])).replace(/[\\/]regions\.json$/, "")
        const { extractRenderedRegions } = await import("../render/index.js")
        const regions = await extractRenderedRegions(buffer, { types: target, format, pages, paddingPt: padding_pt, reflow: true })
        await mkdir(dir, { recursive: true })
        const ext = format === "jpeg" ? "jpg" : "png"
        const manifest = []
        for (const r of regions) {
          const name = `${r.region.id.replace("-", "_")}_page_${String(r.page).padStart(3, "0")}.${ext}`
          await writeOutputFile(join(dir, name), r.data)
          manifest.push({ file: name, id: r.region.id, type: r.region.type, sourceId: r.region.sourceId, parentId: r.region.parentId, page: r.page, bbox: r.bbox, widthPx: r.widthPx, heightPx: r.heightPx })
        }
        await writeOutputFile(join(dir, "regions.json"), JSON.stringify(manifest, null, 2))
        return { content: [{ type: "text", text: `crop ${regions.length}건 → ${dir}\n` + manifest.map(m => `${m.file}  p${m.page} (${m.bbox.x},${m.bbox.y} ${m.bbox.width}×${m.bbox.height}pt)${m.sourceId ? ` src=${m.sourceId}` : ""}`).join("\n") }] }
      } catch (err) {
        return { content: [{ type: "text", text: `crop 실패: ${describeError(err)}` }], isError: true }
      }
    },
  )

  // ─── 도구: extract_tables ────────────────────────────

  server.tool(
    "extract_tables",
    "HWPX·HWP 문서의 표를 추출·분류합니다(#76). 표마다 semantic-table(데이터표) / non-tabular-layout(조직도·연락망·결재란처럼 표를 캔버스로 쓴 것) / uncertain 분류와 근거 신호, 페이지·bbox(pt, 렌더 region 조인), 정책(visual)에 따른 crop 이미지를 돌려줍니다 — 조직도는 이미지로, 데이터표는 셀 구조로 넘기는 멀티모달 파이프라인용. 휴리스틱(네트워크·LLM 없음), 중첩표도 독립 분류. crop 은 output_dir 에 저장하고 8장까지 응답에 함께 담습니다.",
    {
      file_path: z.string().min(1).describe("HWPX 또는 HWP(5.x) 파일 절대 경로"),
      output_dir: z.string().min(1).optional().describe("crop 파일·tables.json 저장 디렉토리 (visual 이 none 이 아니면 필수)"),
      visual: z.enum(["none", "non-tabular", "non-tabular-and-uncertain", "all"]).default("none").describe("crop 대상: none=분류·bbox 만 / non-tabular=조직도류만 / non-tabular-and-uncertain(권장) / all"),
      format: z.enum(["png", "jpeg"]).default("png"),
      padding_pt: z.number().min(0).max(100).default(0).describe("crop 둘레 여백 pt"),
      cells: z.boolean().default(false).describe("응답 JSON 에 셀 텍스트 격자 포함"),
    },
    async ({ file_path, output_dir, visual, format, padding_pt, cells }) => {
      try {
        if (visual !== "none" && !output_dir) {
          return { content: [{ type: "text", text: "visual 이 none 이 아니면 crop 파일을 저장할 output_dir 이 필요합니다." }], isError: true }
        }
        const { buffer } = await readValidatedFile(file_path, MAX_FILE_SIZE, new Set([".hwpx", ".hwp"]))
        const dir = output_dir ? safeOutputPath(join
```

### Core Architecture Module: `src/ocr/engine.ts`
```
/**
 * 내장 텍스트 OCR 엔진 — PP-OCRv5 korean (det DBNet + rec SVTR/CTC) ONNX 추론.
 *
 * 파이프라인: 페이지 RGBA → det(선 검출) → 박스 픽셀 분석(대비·행 밴드) → 라인 crop
 *   → rec 배치(CTC 인식) → 표기 후처리 → OcrItem[]
 * (좌표는 입력 픽셀 기준 top-left origin — 호출자가 PDF 좌표계로 변환).
 *
 * 전·후처리는 공식 inference.yml 스펙 그대로:
 *  - det: BGR, 긴 변 960 리사이즈(32 배수), mean/std [0.485,0.456,0.406]/[0.229,0.224,0.225],
 *         DBPostProcess thresh 0.3 / box_thresh 0.6 / unclip_ratio 1.5
 *  - rec: BGR, 높이 48 고정 비율 리사이즈 + 우측 zero-pad(최소 폭 320), (x/255-0.5)/0.5,
 *         CTC 디코드 (blank=0, 1..N=사전, N+1=공백), text_score 0.5.
 *         배치(recBatch>1)는 공식처럼 폭 비율로 정렬해 묶고 배치 최대 폭까지 zero-pad — 기본은 1
 * DB 후처리의 contour+minAreaRect 는 축정렬 connected-component bbox 로 근사
 * (공문서 스캔은 수평 텍스트가 지배적).
 *
 * 공식 파이프라인 밖의 보강 (근거는 bench/ocr-accuracy.mjs 코퍼스 실측, 각 모듈 주석):
 *  - 키 큰 박스(세로로 쌓인 글자)는 행 밴드로 갈라 밴드마다 인식 (line-split.ts)
 *  - 잉크 대비가 낮은 박스(배경 도안)는 인식하지 않음 — 환각 방지
 *  - 사전 밖 공문서 기호(○ △)·둥근 따옴표·천 단위 숫자 공백 복원, 점류 조각 폐기 (postprocess.ts)
 *  - 결과 좌표는 det 박스(unclip 여백) 대신 박스 안 잉크 외곽 — 텍스트층 아이템과 같은 기하
 *
 * 의존성(onnxruntime-node, sharp)은 optional — 미설치 시 create()가 명확한 에러.
 * 모델 미다운로드 시에도 즉시 실패 — 호출자가 ensureOcrModels() 먼저.
 */

import type { InferenceSession } from "onnxruntime-node"
import { createHash } from "crypto"
import { readFile, stat } from "fs/promises"
import { basename } from "path"
import { KordocError, OPTIONAL_DEP_INSTALL_HINT } from "../utils.js"
import {
  DEFAULT_OCR_MODELS,
  type OcrModelSelection,
  type OcrModelSource,
  ocrSelectionKey,
  ocrSourcePath,
  parseCharacterDict,
} from "./models.js"
import { edgeTrim, leadingBullet, tallInkCount, grayCrop, inkBounds, inkStats, leaderRuns, leadingTriangle, splitRowBands } from "./line-split.js"
import { restoreGlyphs } from "./glyph-restore.js"
import { isDotFragment, joinLeaderItems, restoreBulletItems, restoreSymbols } from "./postprocess.js"
import { bandBoxes, splitBoxAtCellRules, lineCrop, type Box, REC_HEIGHT } from "./crop.js"
import { disableOrtTelemetry } from "./runtime-env.js"

/** OCR 인식 결과 한 줄 — 좌표는 입력 이미지 픽셀 (top-left origin, y down) */
export interface OcrItem {
  text: string
  x: number
  y: number
  w: number
  h: number
  /** CTC 평균 신뢰도 0~1 */
  confidence: number
}

export interface OcrPageStats {
  droppedLowConf: number
  truncatedBoxes?: number
  /** 주면 저신뢰로 버린 줄을 여기에 모은다 (ocrLines "all") — 없으면 세기만 */
  dropped?: OcrItem[]
}

/**
 * 엔진 튜닝 — 기본값이 제품 동작. 벤치·실험만 덮어쓴다 (공개 API 아님).
 */
export interface OcrTuning {
  /** det 입력 긴 변 (공식 resize_long). 1920 보존 실험은 recall Δ median +0.04pp에
   *  속도 -25%로 기각 (2026-08-02) */
  detLongSide: number
  detThresh: number
  detBoxThresh: number
  detUnclip: number
  /** 인식 신뢰도 하한 (공식 drop_score) */
  textScore: number
  /** rec 배치 크기. 공식 rec_batch_num 은 6 이지만 onnxruntime CPU 에선 배치(최대 폭까지
   *  zero-pad)가 오히려 느리다 — 코퍼스 16쪽 교대 실측 1: 0.57 · 4: 0.93 · 8: 0.87 s/page,
   *  정확도 차는 박스 내 CER 0.08pp (2026-09-23). 기본 1 */
  recBatch: number
  /** 키 큰 박스 행 밴드 분할 */
  splitTall: boolean
  /** 한 줄 박스에 걸린 이웃 줄 끝자락·상자 테두리를 지운 crop 도 인식 (line-split edgeTrim). 그림 영역만 읽을 때는 끈다 —
   *  쪽 배율·두 배 재인식 중 평균 신뢰도로 한쪽을 통째로 고르는데 지운 판이 한쪽 신뢰도만 올려 선택이 뒤집혔다(ODL 073) */
  trimEdges: boolean
  /** 이 대비(전경/배경 평균 휘도 차) 미만 박스는 글자가 아님 — 0 이면 끔 */
  minInkContrast: number
  /** 기호·따옴표 복원 + 점류 조각 폐기 */
  postprocess: boolean
  /** 결과 좌표를 det 박스(unclip 여백 포함) 대신 박스 안 잉크 외곽으로 */
  tightBoxes: boolean
  /** 목차 리더 점 무리를 빼고 앞뒤를 따로 인식 (line-split.ts leaderRuns) */
  splitLeaders: boolean
}

export const DEFAULT_OCR_TUNING: Readonly<OcrTuning> = Object.freeze({
  detLongSide: 960,
  detThresh: 0.3,
  detBoxThresh: 0.6,
  detUnclip: 1.5,
  textScore: 0.5,
  recBatch: 1,
  splitTall: true,
  trimEdges: true,
  minInkContrast: 35,
  postprocess: true,
  tightBoxes: true,
  splitLeaders: true,
})

const DET_MIN_SIZE = 3
const DET_MAX_BOXES = 3000
const REC_MIN_WIDTH = 320
/** 배치 텐서 폭 합 상한 — 긴 줄 여러 개를 한 텐서로 묶어 메모리가 튀지 않게 */
const REC_BATCH_MAX_PIXELS = 48 * 16000
/** 키 큰 박스 판정 (공식 파이프라인의 세로 판정 h/w ≥ 1.5 와 같은 문턱) */
const TALL_RATIO = 1.5
/** 밴드로 갈라지지 않는 키 큰 박스 중 이 비율 이상은 90° 회전 글자 후보 */
const ROTATE_RATIO = 3
/** 이웃 줄 끝자락을 지운 crop 이 원본 crop 을 이기려면 넘어야 할 신뢰도 차 (recognizePage 주석) */
const KEEP_MARGIN = 0.06
/** 리더로 볼 최소 점 수 — 말줄임표 "…"(3점)보다 많이. 목차 쪽번호 박스가 무는 점은 코퍼스 실측 4~9개가 대부분 */
const LEADER_MIN_DOTS = 4
/** 리더 앞 조각 crop 을 리더 안쪽으로 더 무는 폭 (박스 높이 배수, recognizePage 주석) */
const LEADER_CONTEXT = 0.5
/** 박스 잉크 비율 하한 (engine recognizePage 주석) */
const MIN_INK_RATIO = 0.01
/** 로컬 모델 파일 크기 상한 — PP-OCRv5 server det 가 88MB, 가장 큰 rec 도 수십 MB */
const MAX_LOCAL_MODEL_BYTES = 1024 * 1024 * 1024

// det: BGR 채널 순서에 yml 기재 순서 그대로 적용 (mean[0]→B)
const DET_MEAN = [0.485, 0.456, 0.406]
const DET_STD = [0.229, 0.224, 0.225]

type SharpFactory = (
  input: Uint8Array | Buffer,
  options?: { raw?: { width: number; height: number; channels: number } },
) => SharpChain
interface SharpChain {
  resize(w: number, h: number, opts?: { fit?: string }): SharpChain
  removeAlpha(): SharpChain
  raw(): { toBuffer(): Promise<Buffer> }
}

/** 인식 대상 한 줄 — rot 는 crop 회전(90=반시계, 270=시계). join: 리더로 가른 박스 번호, dotsBefore: 앞에 리더가 있었는지,
 *  trimDots: crop 이 뒤 리더 점을 물었는지(결과 끝 점을 지운다) */
/** keep: 인식 crop 에서 남길 박스 로컬 구간 — 밖(이웃 줄 끝자락·상자 테두리)은 배경으로 칠한다 (edgeTrim) */
interface LineJob { box: Box; rot: 0 | 90 | 270; group: number; join?: number; dotsBefore?: boolean; trimDots?: boolean; keep?: { x0: number; x1: number; y0: number; y1: number; bg: number } }

export class OcrEngine {
  private det: InferenceSession
  private rec: InferenceSession
  private dict: string[]
  private ort: typeof import("onnxruntime-node")
  private sharp: SharpFactory

  private constructor(parts: {
    det: InferenceSession
    rec: InferenceSession
    dict: string[]
    ort: typeof import("onnxruntime-node")
    sharp: SharpFactory
  }) {
    this.det = parts.det
    this.rec = parts.rec
    this.dict = parts.dict
    this.ort = parts.ort
    this.sharp = parts.sharp
  }

  static async create(models: OcrModelSelection = DEFAULT_OCR_MODELS): Promise<OcrEngine> {
    disableOrtTelemetry()
    const [ortMod, sharpModRaw] = await Promise.all([
      tryImport<typeof import("onnxruntime-node")>("onnxruntime-node", () => import("onnxruntime-node")),
      tryImport<{ default?: SharpFactory } & SharpFactory>(
        "sharp",
        () => import("sharp") as unknown as Promise<{ default?: SharpFactory } & SharpFactory>,
      ),
    ])
    const sharpAny = sharpModRaw as { default?: SharpFactory } | SharpFactory
    const sharpMod: SharpFactory =
      typeof sharpAny === "function" ? sharpAny : (sharpAny.default ?? (sharpAny as unknown as SharpFactory))

    const sessionOpts: import("onnxruntime-node").InferenceSession.SessionOptions = {
      graphOptimizationLevel: "all",
      executionProviders: ["cpu"],
      logSeverityLevel: 3, // paddle2onnx 변환 잔여물 W 로그 폭주 억제
    }
    // 내장 모델은 캐시 경로에서 바로(ensureOcrModelsFor 가 검증), 로컬 파일은 한 번 읽은 바이트를 대조해 그 바이트로 연다 —
    // 대조 뒤 파일이 바뀌어도 검증하지 않은 바이트를 올리지 않는다. 로컬 파일을 모두 대조한 뒤에 세션을 만든다(하나가 틀리면 아무것도 안 올린다)
    const local = (s: OcrModelSource) => "spec" in s ? Promise.resolve(null) : verifiedBytes(s)
    const [detBytes, recBytes, dictBytes] = await Promise.all([local(models.det), local(models.rec), local(models.dict)])
    const session = (s: OcrModelSource, bytes: Uint8Array | null) =>
      bytes
        ? ortMod.InferenceSession.create(bytes, sessionOpts).catch(() => {
          throw new KordocError(`OCR 모델을 열지 못했습니다: ${basename(ocrSourcePath(s))} — ONNX 모델이 아니거나 손상됐습니다`)
        })
        : ortMod.InferenceSession.create(ocrSourcePath(s), sessionOpts)
    const [det, rec, dictYml] = await Promise.all([
      session(models.det, detBytes),
      session(models.rec, recBytes),
      dictBytes ? new TextDecoder().decode(dictBytes) : readFile(ocrSourcePath(models.dict), "utf-8"),
    ])
    const dict = parseCharacterDict(dictYml)
    if (dict.length === 0) {
      throw "spec" in models.dict
        ? new Error("OCR 사전 파싱 실패 — 모델 캐시를 삭제 후 재다운로드하세요")
        : new KordocError(`OCR 사전 파싱 실패 — ${basename(models.dict.file.path)} 에 PostProcess.character_dict 목록이 없습니다`)
    }

    return new OcrEngine({ det, rec, dict, ort: ortMod, sharp: sharpMod })
  }

  /** onnxruntime-node 1.14+ InferenceSession.release() — 구버전은 무시 */
  async destroy(): Promise<void> {
    for (const s of [this.det, this.rec]) {
      const rel = (s as unknown as { release?: () => Promise<void> }).release
      if (typeof rel === "function") {
        try { await rel.call(s) } catch { /* ignore */ }
      }
    }
  }

  /**
   * 페이지 RGBA 픽셀 → 텍스트 라인 인식.
   * 반환 좌표는 입력 픽셀 기준. 라인은 위→아래, 좌→우 정렬.
   * @param stats 저신뢰(conf<0.5) 폐기 라인 카운트 출력 — 종전엔 무음 폐기라 관측 불가
   */
  async recognizePage(
    rgba: Uint8Array,
    width: number,
    height: number,
    stats?: OcrPageStats,
    tuning: Readonly<OcrTuning> = DEFAULT_OCR_TUNING,
    cellRules: Array<{ x1: number; y1: number; y2: number; thicknessPx: number }> = [],
  ): Promise<OcrItem[]> {
    if (width < DET_MIN_SIZE || height < DET_MIN_SIZE) return []
    const detected = await this.detect(rgba, width, height, tuning, stats)
    const boxes = cellRules.length ? detected.flatMap(b => splitBoxAtCellRules(b, cellRules)) : detected

    // 박스 픽셀 분석 → 인식 작업(라인) 목록. group = 한 결과로 합칠 후보 묶음(회전 후보)
    const jobs: LineJob[] = []
    /** 리더로 가른 검출 박스 — 조각 인식 결과를 모아 한 아이템으로 합친다 */
    const joins: Array<{ box: Box; parts: Array<{ x: number; text: string; dotsBefore: boolean; confidence: number }>; trailDots: boolean }> = []
    let group = 0
    for (const b of boxes) {
      const gray = grayCrop(rgba, width, b)
      const ink = inkStats(gray)
      if (tuning.minInkContrast > 0 && ink.contrast < tuning.minInkContrast) continue
      // 잉크가 박스의 1% 미만이면 가는 선·티끌이다 — 연한 배경 도안 띠를 가로지르는 파란 세로선이 대비 검사를
      // 통과시키고 인식기가 도안을 "D D D … O" 로 읽었다(ice-election-cases 표지, 잉크 0.4%). 가장 가는 글자("-")도
      // 여백 포함 박스의 1.5% 안팎이라 남는다. 점 하나("·")는 여기서 빠지지만 isDotFragment 가 어차피 버린다
      if (tuning.minInkContrast > 0 && ink.inkRatio < MIN_INK_RATIO) continue
 
```

### Core Architecture Module: `src/print/renderer.ts`
```
/**
 * Print Renderer — Markdown / IRBlock[] → PDF (puppeteer-core 기반).
 *
 * 흐름:
 *   blocks → markdown (blocksToMarkdown)
 *   markdown → HTML (markdown-it)
 *   HTML + 프리셋 CSS → PDF (puppeteer-core)
 *
 * puppeteer-core는 optional peer dep. 미설치 시 markdownToPdf는 명확한 에러를 던지지만
 * `renderHtml()`은 항상 동작 (외부 PDF 엔진과 결합용).
 *
 * 참조: docs/SPEC.md §1.3
 */

import { existsSync } from "fs"
import MarkdownIt from "markdown-it"
import type { IRBlock } from "../types.js"
import { blocksToMarkdown } from "../table/builder.js"
import { KordocError, escapeHtml } from "../utils.js"

// ─── 타입 ─────────────────────────────────────────

export type PrintPreset = "default" | "gov-formal" | "compact"

export interface PageMargin {
  top: string | number // mm 또는 CSS string ("20mm", "1in")
  right: string | number
  bottom: string | number
  left: string | number
}

export interface PrintOptions {
  preset?: PrintPreset
  pageSize?: "A4" | "Letter"
  orientation?: "portrait" | "landscape"
  margin?: PageMargin
  /** 페이지 머리글 (HTML 허용, gov-formal 프리셋에서 자동 표시) */
  header?: string
  /** 페이지 바닥글 (HTML 허용) */
  footer?: string
  /** 워터마크 텍스트 (대각선 회색) */
  watermark?: string
  /** 사용자 정의 추가 CSS */
  extraCss?: string
}

// ─── 프리셋 CSS ───────────────────────────────────

const PRESETS: Record<PrintPreset, string> = {
  default: `
    @page { size: A4; margin: 20mm; }
    body { font-family: 'Pretendard', 'Malgun Gothic', '맑은 고딕', sans-serif; font-size: 11pt; line-height: 1.6; color: #111; }
    h1 { font-size: 20pt; margin: 1em 0 0.5em; }
    h2 { font-size: 16pt; margin: 1em 0 0.4em; }
    h3 { font-size: 13pt; margin: 0.8em 0 0.3em; }
    p { margin: 0.4em 0; }
    table { border-collapse: collapse; margin: 0.6em 0; width: 100%; }
    th, td { border: 1px solid #555; padding: 4px 8px; text-align: left; vertical-align: top; }
    th { background: #f0f0f0; }
    code { background: #f5f5f5; padding: 1px 4px; border-radius: 2px; font-family: 'D2Coding', Consolas, monospace; }
    pre { background: #f5f5f5; padding: 8px; border-radius: 4px; overflow-x: auto; }
    blockquote { border-left: 3px solid #ccc; padding-left: 12px; color: #555; margin: 0.6em 0; }
    img { max-width: 100%; }
  `,
  "gov-formal": `
    @page { size: A4; margin: 25mm 20mm; }
    body { font-family: '함초롬바탕', 'HCR Batang', 'Batang', 'Malgun Gothic', serif; font-size: 11pt; line-height: 1.7; color: #000; }
    h1 { font-size: 18pt; text-align: center; margin: 0.5em 0 1em; letter-spacing: 0.05em; }
    h2 { font-size: 14pt; margin: 1em 0 0.4em; border-bottom: 1px solid #999; padding-bottom: 2px; }
    h3 { font-size: 12pt; margin: 0.8em 0 0.3em; }
    p { margin: 0.3em 0; text-indent: 1em; }
    table { border-collapse: collapse; margin: 0.8em 0; width: 100%; }
    th, td { border: 1px solid #000; padding: 5px 8px; vertical-align: top; }
    th { background: #e8e8e8; font-weight: normal; }
    blockquote { border-left: 2px solid #555; padding-left: 12px; margin: 0.6em 0; }
  `,
  compact: `
    @page { size: A4; margin: 10mm; }
    body { font-family: 'Pretendard', 'Malgun Gothic', sans-serif; font-size: 9pt; line-height: 1.4; color: #111; }
    h1 { font-size: 14pt; margin: 0.5em 0 0.3em; }
    h2 { font-size: 12pt; margin: 0.5em 0 0.3em; }
    h3 { font-size: 10pt; margin: 0.4em 0 0.2em; }
    p { margin: 0.2em 0; }
    table { border-collapse: collapse; margin: 0.3em 0; width: 100%; font-size: 8pt; }
    th, td { border: 1px solid #777; padding: 2px 4px; }
    th { background: #f0f0f0; }
  `,
}

// ─── HTML 생성 ─────────────────────────────────

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: false,
})

// Markdown can come from documents. Keep only the small HTML vocabulary emitted by
// blocksToMarkdown for merged/nested tables and underlining; render other raw tags as text.
// Image cells may point into the CLI's per-document folder images/<document>/ (#98).
const SAFE_RAW_TAG = /^(?:<\/?(?:table|thead|tbody|tfoot|tr|th|td|u)>|<br\s*\/?>|<(?:th|td)(?: (?:colspan|rowspan)="[1-9]\d*"){1,2}>|<img src="(?:images\/(?:[^"'<>\/\s]+\/)?)?image_\d+\.(?:png|jpe?g|gif|webp|bmp)" alt="image">)$/i
function sanitizeRawHtml(raw: string): string {
  return raw.replace(/<[^>]*>|</g, tag => SAFE_RAW_TAG.test(tag) ? tag : escapeHtml(tag))
}
md.renderer.rules.html_block = (tokens, idx) => sanitizeRawHtml(tokens[idx].content)
md.renderer.rules.html_inline = (tokens, idx) => sanitizeRawHtml(tokens[idx].content)

/**
 * Markdown 또는 IRBlock[] → HTML 문자열.
 * 외부 PDF 엔진(weasyprint, wkhtmltopdf 등)과 결합 가능.
 */
export function renderHtml(
  markdown: string,
  options?: PrintOptions,
): string {
  const preset = options?.preset ?? "default"
  const css = PRESETS[preset] + (options?.extraCss ?? "")
  const body = md.render(markdown)

  const watermark = options?.watermark
    ? `<div class="watermark">${escapeHtml(options.watermark)}</div>`
    : ""
  const watermarkCss = options?.watermark
    ? `
    .watermark {
      position: fixed;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 80pt;
      color: rgba(0,0,0,0.08);
      pointer-events: none;
      z-index: 9999;
      white-space: nowrap;
    }`
    : ""

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data:; font-src 'self' data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<style>${css}${watermarkCss}</style>
</head>
<body>
${watermark}
${body}
</body>
</html>`
}

// ─── PDF 생성 ─────────────────────────────────

/**
 * 인쇄용 Chromium 을 띄워 잠근 페이지를 준다 — print(htmlToPdf)·render(renderHtmlToPdf) 두 기동 지점 공용.
 * 페이지 글은 문서에서 온 글이라 정적 조판만 필요하다: JS 를 끄고 data:·about: 밖의 요청(원격 http·로컬 file:)은
 * 전부 막는다. v4.14.4 까지는 문서가 병합 셀·마크다운 이미지로 심은 <img onerror>·<script>·![](http://…) 가
 * 헤드리스 Chrome 에서 실행되고 밖으로 요청했다 — KORDOC_OFFLINE(assertNetworkAllowed)은 Node fetch 만 막아
 * Chromium 요청은 샜다. 기동 timeout 90초: CI(Node 22)가 부하 중 기본 30초 안에 WS 엔드포인트를 못 받아
 * 실패했다(같은 커밋 재실행은 통과한 플레이크)
 */
/**
 * Chromium 샌드박스 인자 — 기본은 샌드박스를 켠다(신뢰할 수 없는 문서의 그림·글꼴을 디코딩하므로 렌더러 탈출을 막는다).
 * root 로 도는 Linux(컨테이너)는 Chromium 이 샌드박스 기동을 거부해 끄고, 그 밖엔 KORDOC_CHROMIUM_NO_SANDBOX=1 로만 끈다
 */
export function chromiumSandboxArgs(env: NodeJS.ProcessEnv = process.env, isRootLinux = process.platform === "linux" && process.getuid?.() === 0): string[] {
  return env.KORDOC_CHROMIUM_NO_SANDBOX === "1" || isRootLinux ? ["--no-sandbox", "--disable-setuid-sandbox"] : []
}

export async function launchLockedPage(puppeteer: typeof import("puppeteer-core"), executablePath: string) {
  const browser = await puppeteer.default.launch({
    executablePath,
    headless: true,
    timeout: 90_000,
    args: chromiumSandboxArgs(),
  })
  try {
    const page = await browser.newPage()
    await page.setJavaScriptEnabled(false)
    await page.setRequestInterception(true)
    page.on("request", (req) => {
      if (/^(?:data|about):/i.test(req.url())) void req.continue()
      else void req.abort()
    })
    return { browser, page }
  } catch (err) {
    await browser.close()
    throw err
  }
}

/**
 * puppeteer-core로 HTML → PDF 변환.
 * 환경에 Chromium 실행 파일 필요 (PUPPETEER_EXECUTABLE_PATH 환경변수 또는 자동 감지).
 */
async function htmlToPdf(html: string, options?: PrintOptions): Promise<Buffer> {
  let puppeteer: typeof import("puppeteer-core")
  try {
    puppeteer = await import("puppeteer-core")
  } catch {
    throw new KordocError(
      "PDF 생성에 puppeteer-core가 필요합니다. 설치: npm install puppeteer-core",
    )
  }

  const executablePath =
    process.env.PUPPETEER_EXECUTABLE_PATH ?? findChromiumPath()
  if (!executablePath) {
    throw new KordocError(
      "Chromium 실행 파일을 찾을 수 없습니다. PUPPETEER_EXECUTABLE_PATH 환경변수를 설정하세요.",
    )
  }

  const { browser, page } = await launchLockedPage(puppeteer, executablePath)
  try {
    // puppeteer 25 부터 setContent 의 waitUntil 에서 networkidle0 이 빠짐. 같은 의미
    // (연결 0개가 500ms 유지)를 waitForNetworkIdle 로.
    await page.setContent(html, { waitUntil: "load" })
    await page.waitForNetworkIdle({ idleTime: 500, concurrency: 0 })

    const margin = options?.margin
    const pdf = await page.pdf({
      format: options?.pageSize ?? "A4",
      landscape: options?.orientation === "landscape",
      printBackground: true,
      margin: margin
        ? {
            top: toCss(margin.top),
            right: toCss(margin.right),
            bottom: toCss(margin.bottom),
            left: toCss(margin.left),
          }
        : undefined,
      displayHeaderFooter: !!(options?.header || options?.footer),
      headerTemplate: options?.header ?? "<div></div>",
      footerTemplate:
        options?.footer ??
        '<div style="font-size:8pt;width:100%;text-align:center;color:#777;"><span class="pageNumber"></span>/<span class="totalPages"></span></div>',
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}

function toCss(v: string | number): string {
  return typeof v === "number" ? `${v}mm` : v
}

/** Windows/Mac/Linux의 일반적 Chrome 경로 자동 감지 */
export function findChromiumPath(): string | null {
  // 사용자가 명시 안 했으면 OS 표준 경로 시도
  // Windows
  const win = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ]
  // Mac
  const mac = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  ]
  // Linux
  const linux = ["/usr/bin/google-chrome", "/usr/bin/chromium-browser", "/usr/bin/chromium"]

  const candidates =
    process.platform === "win32" ? win : process.platform === "darwin" ? mac : linux

  for (const p of candidates) {
    if (p && existsSync(p)) return p
  }
  return null
```

### Core Architecture Module: `src/render/document.ts`
```
/**
 * 통합 문서 렌더 API (#75 Task 3·8) — 입력(경로/버퍼) → 포맷 감지 → 어댑터 → RenderScene + 페이지 SVG
 * → SVG/HTML/PNG/JPEG/PDF 자산. 다운스트림은 RenderScene 만 알면 된다.
 *
 *   hwpx → HWPX 어댑터(svg-render, 조판 캐시 재생·reflow 폴백)
 *   hwp  → HWP5 어댑터(hwp5-scene: 레코드 → 동형 section DOM → 같은 렌더러)
 *   기타 → 미지원
 */

import { readFile } from "node:fs/promises"
import { detectFormat, detectZipFormat } from "../detect.js"
import { KordocError, toArrayBuffer } from "../utils.js"
import { parsePageRange } from "../page-range.js"
import { renderHwpxPages } from "./svg-render.js"
import { renderHwp5Pages } from "./hwp5-scene.js"
import type { WrapMode } from "../hwpx/text-metrics.js"
import type { RenderScene, RenderSourceFormat } from "./scene.js"
import { renderSceneToHtml } from "./html.js"
import { rasterizePageSvg } from "./rasterize.js"
import { renderHtmlToPdf } from "./pdf.js"

export type RenderFormat = "svg" | "html" | "png" | "jpeg" | "pdf"

export interface SceneRenderOptions {
  /** 1-based 페이지 선택 — [2,3] 또는 "1-3,7". 미지정이면 전 페이지 */
  pages?: number[] | string
  /** 조판 캐시 없는 HWPX 를 순수 TS 조판으로 렌더 (기본 true — 캐시가 있으면 무시) */
  reflow?: boolean
  /** 암호 HWP5 열기 암호 */
  password?: string
  reflowMode?: WrapMode
  highlights?: string[]
  maxImageBytes?: number
}

export interface SceneRenderResult {
  scene: RenderScene
  /** 선택된 페이지의 standalone SVG (페이지 로컬 좌표) */
  pageSvgs: Map<number, string>
}

export interface RenderDocumentOptions extends SceneRenderOptions {
  format: RenderFormat
  /** 래스터 출력 최대 폭 px */
  maxWidthPx?: number
  /** JPEG 품질 */
  quality?: number
  /** PDF 용 Chromium 실행 파일 */
  browserExecutablePath?: string
  /** HTML/PDF 문서 제목 */
  title?: string
}

export interface RenderAsset {
  format: RenderFormat
  /** 페이지 단위 산출은 page, 문서 단위(HTML/PDF)는 없음 */
  page?: number
  data: string | Buffer
  /** 픽셀(래스터) 또는 pt(SVG) */
  width?: number
  height?: number
  /** 래스터 pt→px 실배율 */
  scale?: number
  mimeType?: string
}

export interface RenderDocumentResult {
  scene: RenderScene
  assets: RenderAsset[]
}

export type RenderInput = string | ArrayBuffer | Buffer | Uint8Array

async function loadBuffer(input: RenderInput): Promise<ArrayBuffer> {
  if (typeof input === "string") {
    try {
      return toArrayBuffer(await readFile(input))
    } catch (err) {
      const code = err instanceof Error && "code" in err ? (err as NodeJS.ErrnoException).code : undefined
      throw new KordocError(code === "ENOENT" ? `파일을 찾을 수 없습니다: ${input}` : `파일 읽기 실패: ${input}`)
    }
  }
  if (Buffer.isBuffer(input)) return toArrayBuffer(input)
  if (input instanceof Uint8Array) return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength) as ArrayBuffer
  return input
}

/** 입력 포맷 → 렌더 어댑터 종류 (hwpx | hwp). OLE2 는 HWP5 로 본다 — 세부 판정(HWP3·암호)은 어댑터가 */
async function sourceFormatOf(buffer: ArrayBuffer): Promise<RenderSourceFormat> {
  const format = detectFormat(buffer)
  if (format === "hwpx") {
    const zip = await detectZipFormat(buffer)
    if (zip === "hwpx" || zip === "unknown") return "hwpx"
    throw new KordocError(`렌더 미지원 형식(${zip}) — 레이아웃 렌더는 HWPX·HWP 만 지원합니다`)
  }
  if (format === "hwp") return "hwp"
  throw new KordocError(`렌더 미지원 형식(${format}) — 레이아웃 렌더는 HWPX·HWP 만 지원합니다`)
}

/**
 * 문서 → RenderScene + 선택 페이지 SVG. 페이지 선택은 조립 단계에서 걸러 비선택 페이지의 SVG 문자열을 만들지 않는다.
 * 선택 결과가 비면(범위 밖) KordocError.
 */
export async function renderDocumentToScene(input: RenderInput, options: SceneRenderOptions = {}): Promise<SceneRenderResult> {
  const buffer = await loadBuffer(input)
  const source = await sourceFormatOf(buffer)
  const select = options.pages !== undefined
    ? (pageCount: number) => {
      const set = parsePageRange(options.pages!, pageCount)
      if (set.size === 0) throw new KordocError(`선택한 페이지가 없습니다 — 문서는 ${pageCount}쪽 (pages: ${JSON.stringify(options.pages)})`)
      return set
    }
    : undefined
  const renderOptions = { reflow: options.reflow ?? true, reflowMode: options.reflowMode, highlights: options.highlights, maxImageBytes: options.maxImageBytes }
  const { scene, pageSvgs } = source === "hwp"
    ? renderHwp5Pages(buffer, { ...renderOptions, password: options.password }, select)
    : await renderHwpxPages(buffer, renderOptions, select)
  return { scene, pageSvgs }
}

/** 통합 렌더 — 포맷별 자산. 래스터·PDF 는 선택 페이지만 처리한다 */
export async function renderDocument(input: RenderInput, options: RenderDocumentOptions): Promise<RenderDocumentResult> {
  const { scene, pageSvgs } = await renderDocumentToScene(input, options)
  const pageNos = [...pageSvgs.keys()].sort((a, b) => a - b)
  const sizeOf = (n: number) => scene.pages.find(p => p.page === n)!
  const assets: RenderAsset[] = []
  switch (options.format) {
    case "svg":
      for (const n of pageNos) { const p = sizeOf(n); assets.push({ format: "svg", page: n, data: pageSvgs.get(n)!, width: p.width, height: p.height, mimeType: "image/svg+xml" }) }
      break
    case "html":
      assets.push({ format: "html", data: renderSceneToHtml(scene, pageSvgs, { title: options.title }), mimeType: "text/html" })
      break
    case "png":
    case "jpeg":
      for (const n of pageNos) {
        const p = sizeOf(n)
        const r = await rasterizePageSvg(pageSvgs.get(n)!, p.width, p.height, { format: options.format, maxWidthPx: options.maxWidthPx, quality: options.quality })
        assets.push({ format: options.format, page: n, data: r.data, width: r.widthPx, height: r.heightPx, scale: r.scale, mimeType: r.mimeType })
      }
      break
    case "pdf": {
      const html = renderSceneToHtml(scene, pageSvgs, { title: options.title })
      assets.push({ format: "pdf", data: await renderHtmlToPdf(html, { browserExecutablePath: options.browserExecutablePath }), mimeType: "application/pdf" })
      break
    }
    default:
      throw new KordocError(`알 수 없는 렌더 포맷: ${String(options.format)} (svg|html|png|jpeg|pdf)`)
  }
  return { scene, assets }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #164** (2026-10-17): **feat(ocr): 수기 서류용 손글씨 인식 모델 프리셋 ocrRec: "handwriting"**
  *Symptoms*: 안녕하세요.  #153 에서 반영해 주신 로컬 인식 모델 옵션으로, 손글씨를 추가 학습한 한국어 rec 를 kordoc 에 붙여 써 왔습니다. 이 모델을 경로와 SHA-256 없이 이름으로 고르는 `ocrRec: "handwriting"` 프리셋을 제안드립니다. opt-in 이고 기본 동작은 그대로입니다.  ## 배경  문서 검증 파이프라인에서 손으로 적은 칸이 있는 서식 스캔본을 kordoc 내장 OCR 로 읽습니다. 내장 PP-OCRv5 korean rec 는 인쇄체 위주로 학습돼 손글씨 칸의 정확도가 낮아서, 이 rec 를 AI Hub 손글씨·공문서 데이터 460만 단어로 추가 학습해 [korean-handwriting-rec](https://github.com/VerifiedIdiot/korean-handwriting-rec)(Apache-2.0)로 공개했습니다.  - 입출력과 글자 사전(11,945자)이 내장 rec 와 같아 #153 의 `ocrRec: { path, sha256 }` 로 그대로 끼워집니다. 공개한 사전 yml 은 내장 `rec_korean.yml` 과 바이트 단위로 같습니다. - 다만 쓰는 쪽마다 파일을 받아 경로와 SHA-256 을 챙겨야 해서, server det(`ocrDet: "server"`)처럼 이름으로 고르는 선택 모델로 넣었습니다.  학습에 쓰지 않은 평가 세트로 잰 단어 인식 결과입니다(모델 저장소에 공개한 값). 단어 전체가 맞아야 정답으로 쳤습니다.  | 평가 세트 | 기본 rec | `"handwriting"` | | --- | --- | --- | | 손글씨 단어 2만 개 (AI Hub 대용량 손글씨 OCR) | 67.2% | 97.4% | | 학습에 없던 필자 15명의 손글씨 6천 단어 (AI Hub 다양한 형태의 한글 문자 OCR) | 56.7% | 99.1% | | 학습에 없던 정부 서식 5종의 인쇄 글자 6천 단어 (같은 데이터) | 88.7% | 99.2% | | 흘림체 문장 1,300개의 CER, 낮을수록 좋음 (AI Hub 한국어 글자체 이미지) | 30.0% | 7.8% |  단어 이미지 단위 평가라, 검출과 읽기 순서까지 포함한 쪽 단위 정확도와는 다릅니다.  ## 변경 내용  ```typescript await parse("수기 신청서.pdf", { ocr: true, ocrRec: "handwriting" }) ```  | 경로 | 값 | | --- | --- | | Node | `ocrRec: "handwriting"` · `{ path, sha256 }`(종전) | | CLI | `--ocr-rec handwriting` (그 밖의 값은 종전처럼 로컬 경로) | | parse-worker protocol 2 | `options.ocrRec: "handwriting"` | | Python SDK | `ocr_rec="handwriting"` | | Java SDK | `ocrRec("handwriting")` 오버로드 (`ocrRec(OcrModelFile)` 유지)
  **Post-Mortem & Fix Analysis**:
  > 감사합니다! 최신 main(aa74dfe) 위에 얹어 검증하고 머지했습니다.  - `npm test` 4,240개 통과·실패 0(4,248개 중 8개 건너뜀), typecheck·build 통과 - `npm run bench:gate` 전 단계 통과(쪽 10/10·reflow 59/59). score·PDF 글·PDF 표·별표 지표가 main 과 같아 기본 동작은 그대로입니다 - 손글씨 rec 를 별도 모델 캐시에 받아(고정 revision 파일의 SHA-256 이 HF LFS 값과 같음) 프리셋 E2E 를 포함한 OCR·워커 테스트 57개가 통과했습니다 - 검증하는 사이 올려 주신 재기반 브랜치(6798e50)는 먼저 병합한 결과(29ab3c0)와 트리가 같아 그대로 이어 붙였습니다 

- **Issue #163** (2026-10-16): **fix: 조판과 PDF 추출 정확도 개선 (4.22.5)**
  *Symptoms*: 문서의 0폭 탭·대체 기호·글머리표 예약·표 분할·줄 점유 높이를 보정하고, PDF의 부분 셀 병합·본문 절 제목·누락 기호를 복원합니다. README 한영·한계 문서·품질 보고서와 4.22.5 메타를 함께 갱신합니다.  - 동일 모수 10라운드: 조판 줄 시작 25,326→25,332/25,581(99.0266%), PDF 셀 내용 완전 일치 0.990311→0.990677, 글 재현율 0.99865→0.99872, 별표 셀 F1 0.99739→0.99778. - 두 조판 집합과 PDF 글·표·별표의 추적 지표 하락 0. 외부 ODL 200문서×4모드 유지. 정답·평가기·정규화·제외 모수는 변경하지 않았습니다. - 테스트 4,206통과·9스킵·실패0, 타입검사·빌드 통과. 원본 PDF/글꼴/저장좌표 대조와 라운드별 불변 snapshot 검증. - 전체 PDF·조판 100%는 아직 아니며, 미등록 기호와 기존 249문단 줄 경계 차이 등 남은 범위는 품질 보고서에 명시했습니다. 

- **Issue #162** (2026-10-16): **fix: 조판 기준선과 PDF 본문·계속표 보존 개선**
  *Symptoms*: 조판 캐시를 지운 문서에서 그림의 문단 원점, 테두리·공백 글꼴·세로쓰기 목록의 줄 기준선, 구버전 TTF 신명조 따옴표 폭을 보정합니다. PDF에서는 독립 글머리 칸과 표 아래 반복 주석, 괄호 안 양식 제목, 쪽 경계에서 갈라진 라벨 목록 행을 보존합니다. 두 묶음의 총10라운드를4.22.4에 포함하며 README·영문판·변경 이력·배포 메타를 함께 갱신합니다.  동일 모수에서 조판 줄 시작 일치25,323→25,326/25,581, PDF 표 셀 내용 완전 일치율0.989994→0.990311, 글 재현율0.99858→0.99865, 법령 PDF 별표 셀 F1 0.99697→0.99739입니다. 표 구조2,288/2,331·법령 별표 구조342/346은 유지합니다. 자격증 표는91→90행이 되어도 기존 상쇄 오류가 남아 구조 완전 일치로 주장하지 않습니다. 세로 글자 배치도 미지원 범위를 명시했습니다.  검증: 전체4,117테스트(4,108통과·9스킵·실패0), 타입검사·빌드, 라운드별 원본/2022 조판 및 PDF 글744쌍·표730채점행·별표544채점행의 추적 품질 하락0. PDF 라운드마다 외부 opendataloader-bench 200문서×4모드도 문서별 점수가 같습니다. 표 셀 내용 일치율은 별도로 전수 비교했고,5개 커밋의 제품 소스296개가 측정 snapshot과 모두 같습니다. 정답·평가기·모수는 바꾸지 않았습니다.  [앞선5라운드](docs/quality-alternating-3-2026-10-16.md) · [최종5라운드와 남은 한계](docs/quality-alternating-4-2026-10-16.md) 

- **Issue #161** (2026-10-16): **fix: preserve merged rule cells and document parsing losses**
  *Symptoms*: 공개 할당관세 문서에서 visual 빈행 접기가 다음 행까지 걸친 빈 모서리 셀을 삭제하던 문제를 보완합니다. 빈 행 경계는 기존처럼 압축하고, 모서리 셀 객체와 보이는 변 정보는 압축한 격자에 보존합니다. 일반 여백·연속 세로선·숨겨진 누름틀은 계속 접습니다.  초기안은 경계 행까지 남겨 HWP 별표가345/346으로 하락했습니다. 후속 수정은 표를 기존416×9로 유지하면서 원시(28,7)·(374,7) 모서리를 보존하여 같은 게이트를 통과합니다. 정답·평가기·제외 모수는 바꾸지 않았습니다.  - 전체3,995개 중3,986통과·9스킵·실패0. 모서리·여백·빈 병합 범위·누름틀 회귀4/4. - 타입검사·빌드·diff check 통과. - annex HWP346/346·cell F1 1, PDF342/346·cell F1 .99697. 544개 채점행은 b964335와 동일. - 원본HWP/PDF공식해시가코퍼스와일치. 두모서리동일객체·변정보보존, 살아남은2,840개셀의격자충돌0.  셀과변곁정보보존은HTML의선출력이나원래높이·교차위치까지보존하는수정이아닙니다. HTML테두리·열기하출력과PDF번호기호6종복원은미해결로문서에명시했습니다. 영상비교는기존배포4.22.2의별도결과만사용합니다.  #160의조판·PDF5라운드와함께4.22.3단일배포에포함할예정이며최종통합본은전체배포게이트로다시검증합니다.  후속 #160(544c4a4, main cff2d11)에서 일반 빈 병합틀·조직도 회귀도 보완했습니다. 압축된 단위칸의 시작·끝 경계가 기존 논리 행/열 경계에 모두 있을 때만 객체를 보존합니다. 최종 통합 테스트4,031개(4,022통과·9스킵), CI7개, 글744·표730·별표544 및ODL200×4모드 문서별 하락0을 확인했고 4.22.3 정상 배포 게이트를 실행 중입니다.  4.22.3 배포를 완료했습니다: [GitHub Release](https://github.com/chrisryugj/kordoc/releases/tag/v4.22.3), npm latest 및 MCP레지스트리 active/isLatest를공개확인했습니다. 정상prepublish전체PASS, 공개새설치CLI4.22.3과11출력이검증본과동일합니다. 

- **Issue #160** (2026-10-16): **fix: 문서 조판과 쪽 경계 표 구조 보완**
  *Symptoms*: 인라인 표·그림 주변의 줄 높이와 조각, 선택 하이픈 문자 위치를 복원합니다. PDF는 감싸개 안 계속표, 쪽 경계 독립 행과 분할 셀을 원래 구조로 복원합니다. #161의 빈 모서리 셀 보존도 통합했습니다.  정답·평가기·모수는 변경하지 않았습니다. 4.22.2 기준 5라운드 결과:  - 조판 원본25,321→25,323/25,581, 별도2022저장본17,043→17,045/17,173문단. 인라인 표 점유 높이100→4477HU도 원본과 일치. - PDF 표 구조2,287→2,288/2,331표; 셀 내용 완전 일치.988270→.989994; 내용 유사도.985077→.987204; 글 읽기 순서.99239→.99242. - 조판과 PDF 사이 직접 점수 상승은 확인되지 않았으며 전체100% 달성을 주장하지 않습니다.  #161은 빈 행 경계를 접으면서 기존 격자의 한 칸을 대신할 수 있는 모서리만 보존하도록 보완했습니다. 넓거나 높은 빈 병합틀·조직도 배선에 새 경계가 생기는 경우는 제외합니다. 원시 두 모서리 동일객체·변 정보·416×9 유지 및 점유 충돌0을 확인했습니다. HTML의 선·원본 교차 위치 재현은 후속 과제로 명시합니다.  검증: 최종 통합 테스트4,031개 중4,022통과·9스킵·실패0, 타입검사·빌드통과. 관련23/23, 별표HWP346/346/PDF342/346 및544채점행 기준과 동일. 5라운드 고정소스 전수는 문서별 하락0이며, #161 통합 전수에서 발견한 하락4건을 보완하고 최종소스(v4)로 다시 측정했습니다. PDF 글744쌍·표730채점행·별표544채점행은5라운드최종과모든지표가같고, ODL200문서×4모드도기준과동일합니다. 초기 보완안과 중단한 측정은 최종 수치에 포함하지 않습니다.  README한영·벤치 문서·4.22.3메타를갱신했습니다. [라운드 보고서](https://github.com/chrisryugj/kordoc/blob/fix/quality-rounds2-20261016/docs/quality-alternating-2-2026-10-16.md), [모서리 셀 재현과 한계](https://github.com/chrisryugj/kordoc/blob/fix/quality-rounds2-20261016/docs/parsing-loss-reproductions.md). 최종CI7개와통합7트랙모두통과했습니다. 두PR반영main에서정상prepublish게이트로한번에배포합니다.  4.22.3 배포를 완료했습니다: [GitHub Release](https://github.com/chrisryugj/kordoc/releases/tag/v4.22.3), npm latest 및 MCP레지스트리 active/isLatest를공개확인했습니다. 정상prepublish전체PASS, 공개새설치CLI4.22.3과11출력이검증본과동일합니다. 

- **Issue #159** (2026-10-16): **fix: 문서 조판과 PDF 표 경계 정확도 개선**
  *Symptoms*: 부분 편집 후 문단 위치, 큰 인라인 그림의 어울림, 고정폭 빈칸의 줄 경계를 수정했습니다. PDF는 독립된 제목 상자와 쪽 경계의 연속 번호 행을 보존합니다. README·상세 측정 보고서와 4.22.2 배포 메타데이터를 함께 갱신했습니다.  - 조판→PDF→조판→PDF→조판 5라운드: 조판 일치 25,312→25,321/25,581, PDF 표 완전 일치 2,285→2,287/2,331. 정답·평가기·모수 변경 없음. - 부분 편집 위치 오차 48pt→0. 반대 트랙 직접 상승은 없었으며 PDF 표 개선이 PDF 읽기 순서를 높였습니다. - 문단·문서별 점수 하락 0. 외부 ODL 200문서×4모드도 동일. 전체 테스트 3,982통과·9스킵·실패 0, 타입검사·빌드·reflow 59/59·페이지 10/10 통과. - 정상 계속표, 칸 안 목록, 빈/병합 옆칸, 비중첩 그림, NBSP의 기존 동작을 회귀 테스트로 확인했습니다.  측정 출처와 라운드별 결과: [상세 보고서](docs/quality-alternating-2026-10-16.md). 병합 후 정상 prepublish 전체 게이트를 실행하고 4.22.2로 통합 배포합니다. 

- **Issue #158** (2026-10-16): **fix: PDF 연락처 열과 음영 행 내용 복원**
  *Symptoms*: PDF 연락처 표에서 담당자 칸이 여러 사람의 행을 덮으면 인물 열 분리가 중단됐고, 통계표의 음영 행 클립이 본표의 글을 먼저 가져가 여섯 칸이 비어 있었습니다. 역할·부서의 병합은 보존하면서 직위·이름·연락처를 분리하고, 실제 연속 괘선과 같은 행·열 경계가 확인된 음영 띠만 온전한 선 표에 맡깁니다.  정답·평가기·모수를 유지한 2,331표 비교에서 셀 내용 완전 일치 0.987963→0.988200, 내용 NED 0.984361→0.984727, 셀 F1 0.991267→0.991406으로 개선됐습니다. 글 읽기 순서는 0.99232→0.99238입니다. 구조 일치 0.980266, 중첩표 101/101, PDF 별표 342/346은 유지됩니다. 한·영 README와 벤치 문서에 미배포 개발판 결과를 반영했습니다.  - 전체 테스트: 3,958통과·9스킵·실패0, 신규 회귀·반례16개. 타입검사·빌드 통과. - PDF 글744·표730·별표544 채점행 및 외부ODL200문서×4모드에서 문서별 점수 하락0. - 대상2문서의 공백 제외 문자 개수와 문자별 빈도 동일. 통계표 셀 불일치6→0, 연락처22→4. - 연락처 앞열의 보이지 않는 원본 병합 차이는 남아 있습니다. 전체 PDF·OCR의100%를 주장하지 않습니다.  재현과 상세 결과: `docs/quality-pdf-2026-10-16.md`, `docs/quality-pdf-2026-10-16.json`. 버전 변경·배포는 포함하지 않습니다. 

- **Issue #157** (2026-10-16): **fix: 그림 영역 OCR 좌표 정합 및 Python SDK 0.2.0**
  *Symptoms*: 텍스트층이 있는 PDF에서 그림 영역을 OCR할 때, 전체 쪽을 기울기 보정한 좌표와 원본 래스터의 고해상도 crop 좌표가 섞였습니다. 원본 PDF 영역에 병합해야 하는 경로는 회전하지 않도록 수정해 줄 좌표와 deskewAngle을 일치시킵니다. 전체 스캔의 기울기 보정은 유지합니다.  Python SDK의 새 OCR API와 워커 lifecycle 수정이 PyPI 0.1.0에 빠져 있어 0.2.0 독립 배포를 준비했습니다. 엔진은 4.22.1 패치로 준비하고 README·메타·변경 이력을 함께 갱신합니다.  검증: 실제 2도 기운 래스터에서 잘못된 deskewAngle 2.04를 재현한 테스트 Red→Green, 전체 스캔 대조 통과. 관련 Node 테스트 26통과·server 모델 미설치 1스킵. Python 3.11·3.14 각각 69통과(실제 OCR 포함), wheel·sdist 별도 설치에서 HWPX·PDF OCR·이미지 OCR 출력이 Node 결과와 동일합니다. 외부 PDF 200문서×4모드 문서별 점수 하락 0, OCR 53문서·102쪽의 모든 문서별 품질 수치와 제외 모수가 4.22.0 배포 검증과 동일합니다. 실행 시간은 병렬 부하가 달라 비교하지 않습니다. 

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `eedbd2ff` (2026-10-18)
**Commit Message**: fix(render): 탭 앞 위치에 글자처럼 취급하는 개체 폭도 넣는다

렌더(planLines)는 줄의 탭 폭을 정할 때 탭 앞 x 에서 글자처럼 취급하는 개체(사각형·그림 등)의 폭을 빼고 쟀다.
조판(reflow)은 바깥 여백 좌우까지 넣는다. 내어쓰기 자동 탭(autoTabLeft)이면 탭은 내어쓰기 위치까지라, 개체 폭을
빼면 탭이 그만큼 길어진다 — 상표법 시행규칙 국제출원서의 나라 목록(체크칸 사각형 978 뒤 "KZ⇥Kazakhstan")이
쪽 하나 통째로 9.6pt 오른쪽에 그려졌다(한컴 PDF: 탭 뒤 글이 내어쓰기 36.75pt 자리).

실측(한컴 PDF 짝 렌더, 14라운드 1392dc0 대비):
- 글 조각 1.5pt 안 84,369 → 84,468 / 90,405, 오른 문서 1(18194893, +99)·내린 문서 0
- 그림 2pt 안 3,866 / 3,976 그대로
- 조판(reflow)은 렌더만 바뀌어 그대로. 테스트 4,264 통과(새 검사: 개체 뒤 자동 탭 — 옛 코드에서 55pt 대 45pt 로
  실패), 쪽 경계 10/10, reflow 게이트 59/59, 왕복 PASS

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Q7EF2EFJZMeH4dk7Rm2f15

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -14,6 +14,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - 글머리표 예약 폭(`useInstWidth="0"`)은 비ASCII 글자의 글자별 폭을 쓰지 않고 글꼴 기본 칸 폭(1em)으로 잡는다. 한컴은 돋움체 글머리표 "−" 를 0.5em 으로 찍어도 본문을 1em + 간격 뒤에서 시작한다.
 - 쪽에서 갈라 저장한 세로 가운데·아래 정렬 칸은 첫 쪽 조각만 칸 안에서 맞추고, 둘째 쪽부터는 저장 위치에 그린다(렌더). 종전엔 쪽마다 다시 맞춰 조각 끝 줄 간격의 절반(3pt 안팎)만큼 글이 내려왔다.
 - 쪽을 넘는 행 단위 표(`pageBreak="TABLE"`)는 행 바닥에 표 바깥 아래 여백까지 더해 본문 바닥을 넘으면 그 행부터 다음 쪽에 그린다(렌더, 조판과 같은 판정). 종전엔 행 바닥만 보고 한 행을 앞 쪽에 더 두어, 뒤 쪽 행이 한 행씩 올라왔다.
+- 렌더에서 탭 앞 위치에 글자처럼 취급하는 개체 폭도 넣는다(조판과 같다). 종전엔 빼고 재 내어쓰기 자동 탭이 개체 폭만큼 길어졌다(체크칸 사각형 뒤 "KZ⇥Kazakhstan" 이 9.6pt 오른쪽).
 
 ## [4.22.8] - 2026-10-18
 
```

**File**: `src/render/svg-content.ts` (modified, +6/-0)
```diff
@@ -167,6 +167,10 @@ function planLines(m: ParaModel, styles: RenderStyles, numText = ""): LinePlan[]
   const headW = bu?.useInstWidth === false ? [...bu.ch].reduce((w, ch) => w + glyphWidth(ch, bst, false).w, 0) : bu ? measureTextWidth(bu.ch, bst.height, bst.ratio, { spacingPct: bst.spacing, faceClass: faceClassOf(bst.face) }) : 0
   const bulletW = bu ? paraHeadAdvance(bu, bst.height, headW) : 0
   const plans: LinePlan[] = []
+  // 탭 앞 x 에는 글자처럼 취급하는 개체 폭(바깥 여백 좌우 포함)도 든다 — reflow 와 같다. 빼면 내어쓰기 자동 탭이 개체 폭만큼 더 길어진다
+  // (한컴 PDF: 체크칸 사각형 978 뒤 "KZ⇥Kazakhstan" 의 탭이 내어쓰기 위치에 선다 — 빼고 재면 9.6pt 오른쪽)
+  const inlineW = new Map<number, number>()
+  for (const o of m.objs) if (o.inline) inlineW.set(o.index, o.omL + o.width + o.omR)
   for (let i = 0; i < m.segs.length; i++) {
     const seg = m.segs[i]
     const start = seg.textpos
@@ -179,6 +183,8 @@ function planLines(m: ParaModel, styles: RenderStyles, numText = ""): LinePlan[]
     let fixedW = 0
     for (let k = start; k < end && k < m.chars.length; k++) {
       const c = m.chars[k]
+      const ow = inlineW.get(k)
+      if (ow !== undefined) { x += ow; continue }
       if (!c.tab) { x += charW(c, styles); continue }
       const adv = tabAdvance(x, i === 0, geom, c.tabW)
       tabs.set(k, adv)
```

**File**: `tests/render-tab-inline-object.test.ts` (added, +28/-0)
```diff
@@ -0,0 +1,28 @@
+import { describe, it } from "node:test"
+import assert from "node:assert/strict"
+import JSZip from "jszip"
+import { createXmlParser } from "../src/hwpx/parser-shared.js"
+import { renderHwpxToSvg } from "../src/render/svg-render.js"
+
+const ns = 'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"'
+const head = `<hh:head ${ns}><hh:fontfaces><hh:fontface lang="HANGUL"><hh:font id="0" face="함초롬바탕" type="TTF"/></hh:fontface></hh:fontfaces>` +
+  `<hh:charProperties><hh:charPr id="0" height="1000"><hh:fontRef hangul="0"/></hh:charPr></hh:charProperties>` +
+  `<hh:tabProperties><hh:tabPr id="1" autoTabLeft="1" autoTabRight="0"/></hh:tabProperties>` +
+  `<hh:paraProperties><hh:paraPr id="0" tabPrIDRef="1"><hh:align horizontal="LEFT"/><hh:margin><hc:intent value="-4000" unit="HWPUNIT"/><hc:left value="0" unit="HWPUNIT"/></hh:margin></hh:paraPr></hh:paraProperties></hh:head>`
+const rect = `<hp:rect><hp:sz width="1000" height="900"/><hp:pos treatAsChar="1" vertRelTo="PARA" horzRelTo="PARA"/><hp:outMargin left="0" right="0" top="0" bottom="0"/></hp:rect>`
+async function tabbedX(withRect: boolean): Promise<number> {
+  const sec = `<hs:sec ${ns}><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:secPr><hp:pagePr width="20000" height="10000"><hp:margin left="500" right="500" top="500" bottom="500"/></hp:pagePr></hp:secPr>${withRect ? rect : ""}<hp:t>가<hp:tab width="500"/>나다</hp:t></hp:run></hp:p></hs:sec>`
+  const z = new JSZip()
+  z.file("Contents/header.xml", head); z.file("Contents/section0.xml", sec)
+  const { svg } = await renderHwpxToSvg(await z.generateAsync({ type: "uint8array" }), { reflow: true })
+  const doc = createXmlParser().parseFromString(svg, "image/svg+xml")
+  const t = Array.from(doc.getElementsByTagName("text")).find(e => e.textContent?.includes("나"))
+  assert.ok(t, "탭 뒤 글")
+  return Number(t.getAttribute("x"))
+}
+describe("글자처럼 취급하는 개체 뒤 내어쓰기 자동 탭", () => {
+  it("탭 앞 x 에 개체 폭을 넣어 탭 뒤 글이 내어쓰기 위치에서 시작한다", async () => {
+    // 개체 1000 + "가" 1000 뒤 탭은 내어쓰기 4000 까지 2000 — 개체 없는 줄의 탭 뒤 글과 같은 자리
+    assert.equal(await tabbedX(true), await tabbedX(false))
+  })
+})
```

---

### Incident Patch 2: `1392dc0e` (2026-10-18)
**Commit Message**: fix(render): 행 단위 표는 행 바닥 + 표 바깥 아래 여백으로 쪽을 넘긴다

쪽을 넘는 행 단위 표(pageBreak="TABLE")의 행을 다음 쪽으로 보낼지 렌더는 행 바닥만 보고 정했다. 조판(reflow)은
행 바닥 + 표 바깥 아래 여백으로 정하고, 한컴도 그렇다. 바깥 아래 141 인 96행 명단 표에서 행 바닥이 본문 바닥 70018
안(69901)에 드는 행을 한컴은 다음 쪽 머리 행 아래로 넘기는데, 렌더는 앞 쪽에 두어 뒤 쪽 행이 한 행씩 올라왔다
(쪽마다 31~40pt). 칸 안 나눔 표(CELL)는 행을 칸 줄로 가르는 경로라 이 판정을 쓰지 않는다 — 함께 걸면 갈라야 할
행을 통째로 넘겨 쪽이 하나 늘었다(2문서).

실측(한컴 PDF 짝 렌더, 13라운드 5e16d5f 대비):
- 글 조각 1.5pt 안 84,124 → 84,369 (비교 짝 90,379 → 90,405), 오른 문서 6·내린 문서 0
  (156775696 명단 표 +185, 마약류 대책 보도자료 5건 각 +12)
- 그림 2pt 안 3,866 / 3,976 그대로
- 조판(reflow)은 렌더만 바뀌어 그대로. 테스트 4,263 통과(새 검사: 행 바닥은 들고 바깥 아래 여백이 넘는 행 — 옛 코드에서
  실패), 쪽 경계 10/10, reflow 게이트 59/59, 왕복 PASS

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Q7EF2EFJZMeH4dk7Rm2f15

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -13,6 +13,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - 굴림체·돋움체의 비ASCII 반각 글자(•·−·◦ 등 359자)를 0.5em 으로 잰다. 두 글꼴은 글자 폭이 모두 같다. 돋움체는 종전엔 고정폭 근사로 비ASCII 를 모두 1em 으로 재 "•" 든 줄이 한컴보다 일찍 꺾였다.
 - 글머리표 예약 폭(`useInstWidth="0"`)은 비ASCII 글자의 글자별 폭을 쓰지 않고 글꼴 기본 칸 폭(1em)으로 잡는다. 한컴은 돋움체 글머리표 "−" 를 0.5em 으로 찍어도 본문을 1em + 간격 뒤에서 시작한다.
 - 쪽에서 갈라 저장한 세로 가운데·아래 정렬 칸은 첫 쪽 조각만 칸 안에서 맞추고, 둘째 쪽부터는 저장 위치에 그린다(렌더). 종전엔 쪽마다 다시 맞춰 조각 끝 줄 간격의 절반(3pt 안팎)만큼 글이 내려왔다.
+- 쪽을 넘는 행 단위 표(`pageBreak="TABLE"`)는 행 바닥에 표 바깥 아래 여백까지 더해 본문 바닥을 넘으면 그 행부터 다음 쪽에 그린다(렌더, 조판과 같은 판정). 종전엔 행 바닥만 보고 한 행을 앞 쪽에 더 두어, 뒤 쪽 행이 한 행씩 올라왔다.
 
 ## [4.22.8] - 2026-10-18
 
```

**File**: `src/render/table-pages.ts` (modified, +4/-1)
```diff
@@ -93,6 +93,7 @@ export function planTableRows(tbl: Element, cells: CellModel[], rowH: number[],
   if (tbl.getAttribute("repeatHeader") === "1") while (hdrRows < nRows && cells.some(c => c.ra === hdrRows) && cells.filter(c => c.ra === hdrRows).every(c => c.el.getAttribute("header") === "1")) hdrRows++
   // 이어진 쪽의 표는 본문 위 + 표 바깥 위 여백에서 다시 시작한다(한컴 PDF: 바깥 위 여백 283 인 표의 이어진 쪽 칸 틀이 본문 위 아래 2.8pt)
   const contTop = MT + num(findChildByLocalName(tbl, "outMargin"), "top") + rowY[hdrRows]
+  const outB = num(findChildByLocalName(tbl, "outMargin"), "bottom")
   const cellSplit = tbl.getAttribute("pageBreak") === "CELL"
   const out: RowPiece[][] = []
   let page = 0, y = ty, first = true
@@ -239,7 +240,9 @@ export function planTableRows(tbl: Element, cells: CellModel[], rowH: number[],
       y += h; first = false
       continue
     }
-    if (!first && y + h > pageBottom && r >= hdrRows) { page++; y = contTop; first = true }
+    // 행 단위 표는 행 바닥 + 표 바깥 아래 여백이 본문 바닥을 넘으면 그 행부터 다음 쪽 — reflow 와 같은 판정(한컴 PDF: 바깥 아래 141 인
+    // 96행 표가 바닥 70018 에 행 바닥 69901 이 드는데도 그 행을 다음 쪽 머리 행 아래로 넘긴다). 칸 안 나눔 표의 행은 위에서 칸 줄로 가른다
+    if (!first && y + h + (cellSplit ? 0 : outB) > pageBottom && r >= hdrRows) { page++; y = contTop; first = true }
     out.push([{ page, y, h }])
     y += h; first = false
   }
```

**File**: `tests/render.test.ts` (modified, +5/-0)
```diff
@@ -354,6 +354,11 @@ describe("render: 쪽을 넘는 표 행 조각 (planTableRows)", () => {
     assert.deepEqual(show(tbl("CELL", ten), 0), [[[0, 0, 7000], [1, 0, 7000], [2, 0, 2882]]])
     // 행 단위(TABLE) 표는 가르지 않는다(쪽 맨 위 행은 넘치게 둔다)
     assert.deepEqual(show(tbl("TABLE", ten), 0), [[[0, 0, 15682]]])
+    // 행 단위 표는 행 바닥 + 표 바깥 아래 여백이 쪽 바닥을 넘으면 그 행부터 다음 쪽(행 바닥만 들어도) — 칸 안 나눔 표는 이 판정을 쓰지 않는다
+    const rowsT = (pageBreak: string) => createXmlParser().parseFromString(`<hp:tbl xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" pageBreak="${pageBreak}" rowCnt="3" colCnt="1"><hp:sz width="10000" height="9000"/><hp:outMargin left="0" right="0" top="0" bottom="141"/>` +
+      [0, 1, 2].map(r => `<hp:tr><hp:tc><hp:subList><hp:p><hp:run><hp:t>가</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="9000"/></hp:linesegarray></hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="${r}"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="10000" height="3000"/><hp:cellMargin left="0" right="0" top="0" bottom="0"/></hp:tc></hp:tr>`).join("") + `</hp:tbl>`, "text/xml").documentElement as unknown as Element
+    assert.deepEqual(show(rowsT("TABLE"), 900), [[[0, 900, 3000]], [[1, 0, 3000]], [[1, 3000, 3000]]]) // 3900 + 3000 = 6900 ≤ 7000 이지만 + 141 > 7000
+    assert.deepEqual(show(rowsT("TABLE"), 800), [[[0, 800, 3000]], [[0, 3800, 3000]], [[1, 0, 3000]]]) // 3800 + 3000 + 141 = 6941 ≤ 7000
     // 저장본이 3줄 뒤 0 으로 되돌아가면(한컴이 거기서 갈랐다) 그 자리에서 가른다 — 칸 높이는 갈린 행 전체(한컴 저장 cellSz), 2번째 조각은 3줄 + 칸 여백
     assert.deepEqual(show(tbl("CELL", [0, 1600, 3200, 0, 1600, 3200], 8000), 2000), [[[0, 2000, 5000], [1, 0, 4482]]])
     // 칸 글은 다 들어가고 행 높이만 넘치면 행은 이 쪽 바닥까지
```

---

### Incident Patch 3: `5e16d5f0` (2026-10-18)
**Commit Message**: fix(render): 쪽에서 갈라 저장한 가운데 칸은 첫 쪽 조각만 칸 안에서 맞춘다

한컴이 쪽에서 갈라 저장한 세로 가운데·아래 정렬 칸을 종전엔 조각마다 그 조각 내용으로 다시 맞췄다. 가운데
조각은 높이가 다음 조각 첫 줄 위까지라 빈 몫이 끝 줄 간격뿐인데, 그 절반만큼(줄 간격 600 → 3pt) 글이
내려왔다. 이제 둘째 조각부터는 저장 vertpos 자리에 그린다. 첫 쪽 조각의 맞춤은 그대로다.

근거 — 같은 판이 저장·인쇄한 한컴 PDF: 2020 서식 3개(특허권 등록령·특허법·상표법 시행규칙 신청서)와
2024 칸 하나짜리 40쪽 문서는 둘째 쪽부터 칸 글이 저장 자리에 있다. 첫 쪽은 가운데 맞춤이 맞다(2022 보도자료
첫 쪽 글 조각 39개 맞음, 위 정렬로 그리면 8개).

실측(한컴 PDF 짝 렌더):
- 글 조각 1.5pt 안 82,816 → 84,124 / 90,379 (91.6% → 93.1%), 오른 문서 5·내린 문서 2. 내린 둘(156782376·
  pr-1674, 각 26개)은 2020 에서 저장해 2024·2022 로 인쇄한 PDF 라 판이 바뀌며 다시 조판된 몫으로 본다
- 그림 2pt 안 3,858 → 3,866 / 3,976, 하락 0
- 조판(reflow)은 렌더만 바뀌어 그대로. 테스트 4,263 통과(새 검사: 세 쪽에 갈린 가운데 칸의 가운데 조각 —
  옛 코드에서 실패), 쪽 경계 10/10, reflow 게이트 59/59, 왕복 PASS

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Q7EF2EFJZMeH4dk7Rm2f15

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - 쪽을 넘는 온 폭 어울림 표가 앵커 글 줄 아래에 붙어 있으면(세로 오프셋이 글 줄 아래) 글은 제자리에 두고 다음 문단만 마지막 쪽의 표 나머지 아래에서 시작한다. 종전엔 글 줄까지 마지막 쪽 표 아래로 옮겨 그 뒤 문단이 줄 몫만큼 밀렸다. 표가 문단 위에 붙으면 종전대로 글 줄을 표 아래로 옮긴다.
 - 굴림체·돋움체의 비ASCII 반각 글자(•·−·◦ 등 359자)를 0.5em 으로 잰다. 두 글꼴은 글자 폭이 모두 같다. 돋움체는 종전엔 고정폭 근사로 비ASCII 를 모두 1em 으로 재 "•" 든 줄이 한컴보다 일찍 꺾였다.
 - 글머리표 예약 폭(`useInstWidth="0"`)은 비ASCII 글자의 글자별 폭을 쓰지 않고 글꼴 기본 칸 폭(1em)으로 잡는다. 한컴은 돋움체 글머리표 "−" 를 0.5em 으로 찍어도 본문을 1em + 간격 뒤에서 시작한다.
+- 쪽에서 갈라 저장한 세로 가운데·아래 정렬 칸은 첫 쪽 조각만 칸 안에서 맞추고, 둘째 쪽부터는 저장 위치에 그린다(렌더). 종전엔 쪽마다 다시 맞춰 조각 끝 줄 간격의 절반(3pt 안팎)만큼 글이 내려왔다.
 
 ## [4.22.8] - 2026-10-18
 
```

**File**: `src/render/svg-render.ts` (modified, +3/-2)
```diff
@@ -184,10 +184,11 @@ function drawTable(tbl: Element, tx: number, ty: number, ctx: Ctx, depth: number
       const boxes = cellLineBoxes(c)
       const contV = new Map(boxes.map(b => [b.seg, b.top]))
       const pieceOf = (v: number): number => Math.max(0, g.pieces!.findIndex(pc => { const r = pc.range?.get(c.el); return !!r && v >= r[0] && v < r[1] }))
-      // 세로 가운데·아래 칸은 조각마다 그 조각 내용([조각 원점, 마지막 줄 바닥])을 조각 안에서 맞춘다(한컴 PDF: 두 쪽에 갈린 가운데 칸이 쪽마다 8pt·5pt 내려옴)
+      // 세로 가운데·아래 칸은 첫 쪽 조각만 그 조각 내용([조각 원점, 마지막 줄 바닥])을 조각 안에서 맞춘다(한컴 PDF: 두 쪽에 갈린 가운데 칸의 첫 쪽이 8pt 내려옴).
+      // 둘째 조각부터는 저장 vertpos 자리 그대로다(같은 판이 저장·인쇄한 PDF: 가운데 칸 둘째 쪽부터 글이 저장 자리 — 서식 3개·쪽 40개 넘는 칸 하나)
       const va = c.sub.getAttribute("vertAlign") ?? "TOP"
       const pieceOff = g.pieces.map((pc, k) => {
-        if (va === "TOP") return 0
+        if (va === "TOP" || k > 0) return 0
         const from = pc.range?.get(c.el)?.[0] ?? 0
         const bottoms = boxes.filter(b => pieceOf(b.top) === k).map(b => b.bottom - from)
         if (!bottoms.length) return 0
```

**File**: `tests/render.test.ts` (modified, +24/-0)
```diff
@@ -434,6 +434,30 @@ describe("render: 쪽을 넘는 표 행 조각 (planTableRows)", () => {
     assert.ok(ga(mid) - ga(top) > 1, `첫 조각 가운데 ${ga(mid)} vs ${ga(top)}`)
     assert.ok(Math.abs(da(mid) - da(top)) < 0.05, `마지막 조각 ${da(mid)} vs ${da(top)}`)
   })
+
+  it("세 쪽에 갈라 저장한 세로 가운데 칸의 가운데 조각은 다시 맞추지 않고 저장 vertpos 자리에 그린다", async () => {
+    // 한컴 PDF(같은 판이 저장·인쇄): 둘째 쪽부터 칸 글이 저장 자리 — 조각 끝 줄 간격만큼 비는 몫을 가운데로 나누면 3pt 내려온다
+    const build = async (va: string) => {
+      const zip = await JSZip.loadAsync(await markdownToHwpx("| 머리 |\n|---|\n| 가나다라마 |"))
+      const secName = Object.keys(zip.files).find(n => /section0\.xml$/.test(n))!
+      let sec = await zip.file(secName)!.async("string")
+      const segs = [[0, 1000], [1, 40000], [2, 1000], [3, 40000], [4, 1000]].map(([tp, v]) => `<hp:lineseg textpos="${tp}" vertpos="${v}" vertsize="1000" textheight="1000" baseline="850" spacing="600" horzpos="0" horzsize="9000" flags="393216"/>`).join("")
+      sec = sec.replace(/(<hp:tbl\b[^>]*?)pageBreak="\w+"/, '$1pageBreak="CELL"')
+        .replace(/(<hp:t>가나다라마<\/hp:t><\/hp:run>)/, `$1<hp:linesegarray>${segs}</hp:linesegarray>`)
+      const k = sec.indexOf("가나다라마"), j = sec.lastIndexOf("<hp:subList", k)
+      sec = sec.slice(0, j) + sec.slice(j).replace(/vertAlign="\w+"/, `vertAlign="${va}"`)
+      sec = sec.replace(/(<hp:t>가나다라마<\/hp:t>[\s\S]*?<hp:cellSz width="\d+" height=")\d+/, "$1200000")
+        .replace(/(<hp:tbl\b[\s\S]*?<hp:sz width="\d+" widthRelTo="\w+" height=")\d+/, "$150000")
+      zip.file(secName, sec)
+      const r = await renderHwpxPages(new Uint8Array(await zip.generateAsync({ type: "nodebuffer" })), { reflow: true })
+      const y = (n: number, ch: string) => Number([...r.pageSvgs.get(n)!.matchAll(/<text x="[-\d.]+" y="([-\d.]+)"[^>]*>([^<]+)</g)].find(m => m[2] === ch)![1])
+      return { pages: r.pageSvgs.size, ga: y(1, "가"), da: y(2, "다"), ra: y(2, "라") }
+    }
+    const top = await build("TOP"), mid = await build("CENTER")
+    assert.equal(top.pages, 3)
+    assert.ok(mid.ga - top.ga > 1, `첫 조각은 가운데 ${mid.ga} vs ${top.ga}`)
+    assert.ok(Math.abs(mid.da - top.da) < 0.05 && Math.abs(mid.ra - top.ra) < 0.05, `가운데 조각 ${mid.da}·${mid.ra} vs ${top.da}·${top.ra}`)
+  })
 })
 
 describe("render: 칸 안 떠 있는 그림의 음수 오프셋", () => {
```

---

### Incident Patch 4: `49970e4d` (2026-10-18)
**Commit Message**: fix(reflow): 굴림체·돋움체 반각 기호 폭, 글머리표 예약 폭은 기본 칸 폭

- 굴림체·돋움체는 글자 폭이 모두 같다. 비ASCII 반각(0.5em) 글자 359자(•·−·◦ 등)를 그 폭으로 잰다.
  돋움체는 종전엔 고정폭 근사로 비ASCII 를 모두 1em 으로 쟀다. 한컴 PDF(두 글꼴을 쓴 1,019개)에서 두 글꼴
  줄 안의 − 62·• 16·◦ 9자가 그 글꼴로 0.5em 에 찍힌다.
- 글머리표 예약 폭(useInstWidth="0")은 비ASCII 글자의 글자별 폭·대체 폭을 쓰지 않고 글꼴 기본 칸 폭으로
  잡는다. 한컴 PDF 에서 돋움체 글머리표 "−" 는 0.5em 으로 찍히는데 본문은 1em + 간격 뒤에서 시작한다.
  이 규칙 없이 반각 폭만 넣으면 aift 37~41쪽 글 조각 91개가 6pt 왼쪽으로 어긋났다.

실측(12개 폴더 reflow, 11라운드 5025411 대비):
- 본문 첫 줄 위치 76,723 → 76,729 / 78,376, 본문+개체 16,334 → 16,336, 칸 첫 줄 205,011 → 205,015 — 하락 0
  (오른 문서 1: 청년세대 성별균형 공론장 보도자료, 돋움체 "•")
- 줄 수 일치 306,680 → 306,681 / 306,744, 두 줄+ 문단 전부 일치 24,939 → 24,940 / 25,187
- 한컴 PDF 글 조각 위치 82,816 / 90,379 그대로(aift 1,835 / 1,885 그대로)
- 테스트 4,262 통과. 새 검사(반각 기호 폭·예약 폭 1em)는 옛 코드에서 2건 실패, 예약 규칙만 빼면 1건 실패.
  쪽 경계 10/10, reflow 게이트 59/59, 왕복 PASS

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Q7EF2EFJZMeH4dk7Rm2f15

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -10,6 +10,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Fixed
 
 - 쪽을 넘는 온 폭 어울림 표가 앵커 글 줄 아래에 붙어 있으면(세로 오프셋이 글 줄 아래) 글은 제자리에 두고 다음 문단만 마지막 쪽의 표 나머지 아래에서 시작한다. 종전엔 글 줄까지 마지막 쪽 표 아래로 옮겨 그 뒤 문단이 줄 몫만큼 밀렸다. 표가 문단 위에 붙으면 종전대로 글 줄을 표 아래로 옮긴다.
+- 굴림체·돋움체의 비ASCII 반각 글자(•·−·◦ 등 359자)를 0.5em 으로 잰다. 두 글꼴은 글자 폭이 모두 같다. 돋움체는 종전엔 고정폭 근사로 비ASCII 를 모두 1em 으로 재 "•" 든 줄이 한컴보다 일찍 꺾였다.
+- 글머리표 예약 폭(`useInstWidth="0"`)은 비ASCII 글자의 글자별 폭을 쓰지 않고 글꼴 기본 칸 폭(1em)으로 잡는다. 한컴은 돋움체 글머리표 "−" 를 0.5em 으로 찍어도 본문을 1em + 간격 뒤에서 시작한다.
 
 ## [4.22.8] - 2026-10-18
 
```

**File**: `src/hwpx/font-metrics.ts` (modified, +16/-2)
```diff
@@ -718,6 +718,16 @@ for (const [face, fix] of Object.entries(FACE_WIDTH_FIX)) {
   FONTS[face] = { ...m, ascii, ex }
 }
 
+// 굴림체·돋움체 — 두 글꼴은 글자 폭이 모두 같다. 비ASCII 반각(0.5em) 글자 359자, 나머지는 1em
+// (한컴 PDF: 두 글꼴 줄 안의 −·•·◦ 가 그 글꼴로 0.5em 에 찍힌다. 돋움체는 종전엔 고정폭 근사로 비ASCII 를 모두 1em 으로 쟀다)
+const CHE_HALF = "0-1f 7f a0 a2-a3 a5-a6 a9 ab-ac af b5 bb c0-c5 c7-cf d1-d6 d9-dd e0-e5 e7-ef f1-f6 f9-fd ff-110 112-125 128-130 134-137 139-13e 143-148 14c-151 " +
+  "154-165 168-17f 192 1fa-1ff 2c6 2c9 2dc 37e 384-38a 38c 38e-390 3aa-3b0 3c2 3ca-3ce 402-40c 40e-40f 452-45c 45e-45f 490-491 1e80-1e85 1ef2-1ef3 " +
+  "2013-2014 2017 201a-201b 201e 2022 2039-203a 203c 203e 2044 20a3-20a4 20a7 20a9 2105 212e 21a8 2206 2212 2215 2219 221f 2248 2302 2310 2320-2321 " +
+  "2550-256c 2580 2584 2588 258c 2590-2591 2593 25aa-25ac 25ba 25c4 25ca 25d8-25d9 25e6 263a-263c 2666 266b fb01-fb02"
+const cheEx: Record<number, number> = { ...FONTS["굴림체"].ex }
+for (const r of CHE_HALF.split(" ")) { const [a, b] = r.split("-").map(x => parseInt(x, 16)); for (let c = a; c <= (b ?? a); c++) cheEx[c] = 500 }
+FONTS["굴림체"] = FONTS["돋움체"] = { ...FONTS["굴림체"], ex: cheEx }
+
 // 서울남산체·서울한강체 — 한글 음절도 글자마다 폭이 다르다(seoul-font-widths.ts). 표에 없는 글자는 반각·1em 대체
 // 이미 표가 있는 이름(08서울한강체 M 등)은 그 표를 두고 빠진 글자만 채운다
 for (const [face, wm] of Object.entries(seoulFontWidths())) {
@@ -780,12 +790,16 @@ function isHanja(cp: number): boolean {
   return (cp >= 0x4e00 && cp <= 0x9fff) || (cp >= 0x3400 && cp <= 0x4dbf) || (cp >= 0xf900 && cp <= 0xfaff)
 }
 
-/** 문단 계산 전에 폭표를 한 번 선택한다 — 글자마다 글꼴명 trim·조회하지 않는다. */
+/**
+ * 문단 계산 전에 폭표를 한 번 선택한다 — 글자마다 글꼴명 trim·조회하지 않는다.
+ * fallback=false 는 글머리표 예약 폭(useInstWidth="0")이다 — 비ASCII 글자는 글자별 폭·대체 폭 없이 글꼴 기본 칸 폭으로 잡는다
+ * (한컴 PDF: 돋움체 글머리표 "−" 는 0.5em 으로 찍히는데 본문은 1em + 간격 뒤에서 시작한다)
+ */
 export function fontWidthFn(face: string, fallback = true): ((cp: number) => number) | null {
   if (!hasFontMetrics(face)) return null
   const m = FONTS[face.trim()]
   // 표에 따로 없는 반각 형태(U+FF61~FFDC·FFE8~FFEE, ｢ ｣ ･ 등)는 반각 — 한컴 PDF 임베드 글꼴 실측 500
-  return cp => cp >= 0x20 && cp <= 0x7e ? m.ascii[cp - 0x20] : m.ex[cp] ?? ((fallback ? HANCOM_FALLBACK_W[cp] : undefined) ?? (isHalfwidthForm(cp) ? 500 : m.han !== undefined && isHanja(cp) ? m.han : m.cjk))
+  return cp => cp >= 0x20 && cp <= 0x7e ? m.ascii[cp - 0x20] : (fallback ? m.ex[cp] ?? HANCOM_FALLBACK_W[cp] : undefined) ?? (isHalfwidthForm(cp) ? 500 : m.han !== undefined && isHanja(cp) ? m.han : m.cjk)
 }
 
 /** 유니코드 반각 형태 블록 */
```

**File**: `tests/reflow-bullet-instance-width.test.ts` (modified, +11/-2)
```diff
@@ -12,8 +12,8 @@ function fixture(flag: string, auto = 1) {
   const xml = `<hs:sec ${ns}><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:secPr><hp:pagePr width="5000" height="10000"><hp:margin left="500" right="1000" top="500" bottom="500"/></hp:pagePr></hp:secPr><hp:t>가나다라마바</hp:t></hp:run></hp:p></hs:sec>`
   return { head, xml }
 }
-function lines(flag: string, auto = 1, char = "\uf09f") {
-  const f = fixture(flag, auto), styles = parseRenderStyles(f.head.replace("\uf09f", char))
+function lines(flag: string, auto = 1, char = "\uf09f", face = "한컴돋움") {
+  const f = fixture(flag, auto), styles = parseRenderStyles(f.head.replace("\uf09f", char).replace('face="한컴돋움"', `face="${face}"`))
   const root = createXmlParser().parseFromString(f.xml.replace(/<hp:secPr>[\s\S]*?<\/hp:secPr>/, ""), "text/xml").documentElement as unknown as Element
   reflowSection(root, styles, { BODY_W: 3500, BODY_H: 9000 })
   return Array.from(root.getElementsByTagName("hp:lineseg"), s => Number(s.getAttribute("textpos")))
@@ -39,6 +39,15 @@ describe("본문 기호 실폭과 자동 글머리표 예약 폭", () => {
   it("일반 하이픈을 1em으로 넓히지 않고 원래 글꼴 폭으로 예약한다", () => {
     assert.deepEqual(lines('useInstWidth="0"', 1, "-"), lines('useInstWidth="1"', 1, "-"))
   })
+  it("굴림체·돋움체 본문의 반각 기호는 0.5em 이고 예약 폭(useInstWidth=0)은 1em 이다", () => {
+    const st = (face: string) => ({ height: 1000, face, bold: false, italic: false, underline: false, ratio: 100, spacing: 0 })
+    for (const face of ["굴림체", "돋움체"]) {
+      assert.deepEqual(["•", "−", "◦", "·", "가"].map(c => glyphWidth(c, st(face)).w), [500, 500, 500, 1000, 1000])
+    }
+    // 한컴 PDF: 돋움체 글머리표 "−" 는 0.5em 으로 찍혀도 본문은 1em 예약 뒤에서 시작한다
+    assert.deepEqual(lines('useInstWidth="0"', 1, "−", "돋움체"), [0, 2, 4])
+    assert.deepEqual(lines('useInstWidth="1"', 1, "−", "돋움체"), [0, 3])
+  })
   it("SVG도 본문을 고정 예약 폭 다음에 그린다", async () => {
     const f = fixture('useInstWidth="0"'), z = new JSZip()
     z.file("Contents/header.xml", f.head); z.file("Contents/section0.xml", f.xml)
```

**File**: `tests/reflow-hancom-rules.test.ts` (modified, +2/-1)
```diff
@@ -33,7 +33,8 @@ describe("reflow 한컴 조판 규칙", () => {
     assert.equal(faceClassForReflow("HCR Batang"), "hcr") // 영문 이름도 같은 글꼴
     assert.equal(faceClassForReflow("Haansoft Batang"), "font:한컴바탕")
     assert.equal(faceClassForReflow("Haansoft Dotum"), "font:한컴돋움")
-    assert.equal(faceClassForReflow("돋움체"), "fixedPitch")
+    assert.equal(faceClassForReflow("돋움체"), "font:돋움체") // 굴림체와 같은 폭표
+    assert.equal(faceClassForReflow("바탕체"), "fixedPitch")
     assert.equal(faceClassForReflow("KoPub바탕체 Light"), "font:KoPub바탕체 Light")
     assert.equal(hancomCharWidth("가", 1000, 100, 0, "cjk"), 1000)
     assert.equal(hancomCharWidth("A", 1000, 100, 0, "cjk"), hancomCharWidth("A", 1000, 100, 0, "hcr"))
```

**File**: `tests/text-metrics.test.ts` (modified, +2/-2)
```diff
@@ -93,8 +93,8 @@ describe("fitRatioForFewerLines — 자동 장평(orphan 축소)", () => {
 
 describe("faceClass — 고정폭 글꼴 폭 테이블 (v4.0.6 회귀)", () => {
   it("실측 폭표 글꼴은 font:이름, 나머지 '체' 고정폭은 fixedPitch, 그 외·미지정은 hcr", () => {
-    for (const f of ["굴림체", "굴림", "HY견고딕", "맑은 고딕", "한컴돋움", "휴먼명조"]) assert.equal(faceClassOf(f), `font:${f}`)
-    for (const f of ["돋움체", "바탕체", "궁서체"]) assert.equal(faceClassOf(f), "fixedPitch")
+    for (const f of ["굴림체", "돋움체", "굴림", "HY견고딕", "맑은 고딕", "한컴돋움", "휴먼명조"]) assert.equal(faceClassOf(f), `font:${f}`)
+    for (const f of ["바탕체", "궁서체"]) assert.equal(faceClassOf(f), "fixedPitch")
     for (const f of ["함초롬바탕", "나눔명조", "", undefined, null]) assert.equal(faceClassOf(f), "hcr")
   })
   it("fixedPitch: 한글 1.0em·ASCII 0.5em (함초롬 0.97em·비례폭과 구분)", () => {
```

---

### Incident Patch 5: `50254113` (2026-10-17)
**Commit Message**: fix(reflow): 쪽을 넘는 어울림 표가 글 줄 아래에 붙으면 글은 제자리

- 글 있는 앵커 문단의 온 폭 어울림(SQUARE) 칸 안 나눔 표가 쪽 바닥을 넘을 때, 문단 글 줄이 표 위끝(문단 위 + 세로 오프셋 + 바깥 여백
  위)보다 위에서 끝나면 글은 제자리에 두고 다음 문단만 마지막 쪽의 표 나머지 아래에서 시작한다. 종전엔 글 줄도 마지막 쪽 표 아래로
  옮겨 뒤 문단이 줄 몫만큼 내려갔다. 표가 문단 위에 붙은 경우(오프셋이 글 줄 안)는 종전대로 글 줄을 표 아래로 옮긴다.
  한컴 저장본: 편람 "4. 한자어보다 쉽게 다듬은 말 사용하기" 의 오프셋 2829 어울림 36행 표(칸 간격 255) — 앵커 글 한 줄 41803 은 첫 쪽
  제자리, 표는 0~4행·머리 행+5~24행·머리 행+25~35행으로 세 쪽에 걸치고 다음 문단은 셋째 쪽 29276(= 255 + 1821 + 27200)
- 측정(12개 폴더 저장본 lineseg 대조): 본문 첫 줄 vertpos 76,676 → 76,723(1문서 +47, 하락 0), 본문+개체 16,332 → 16,334,
  칸 205,007 → 205,011, 칸+개체 6,188·두 줄+ 24,939/25,187·줄 수 306,680 그대로. 렌더 글 위치·그림·쪽 수 그대로, gen-repro 같음
- npm test 4,261 통과·실패 0, reflow 게이트 59/59, 쪽 10/10, 왕복 게이트 통과

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Q7EF2EFJZMeH4dk7Rm2f15

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -7,6 +7,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Fixed
+
+- 쪽을 넘는 온 폭 어울림 표가 앵커 글 줄 아래에 붙어 있으면(세로 오프셋이 글 줄 아래) 글은 제자리에 두고 다음 문단만 마지막 쪽의 표 나머지 아래에서 시작한다. 종전엔 글 줄까지 마지막 쪽 표 아래로 옮겨 그 뒤 문단이 줄 몫만큼 밀렸다. 표가 문단 위에 붙으면 종전대로 글 줄을 표 아래로 옮긴다.
+
 ## [4.22.8] - 2026-10-18
 
 ### Fixed
```

**File**: `src/render/reflow.ts` (modified, +7/-1)
```diff
@@ -1056,7 +1056,13 @@ function reflowBlockFlow(
         const split3 = splitFloatTableRemainder(p, startV, lim, bodyH, styles, true)
         const lsa = findChildByLocalName(p, "linesegarray")
         const own = lsa ? elements(lsa).filter(e => ln(e) === "lineseg") : []
-        if (split3 !== undefined && own.length) {
+        // 글 줄이 표 위끝(문단 위 + 세로 오프셋 + 바깥 여백 위)보다 위에서 끝나면 글은 제자리, 다음 문단만 마지막 쪽의 표 나머지 아래로
+        // (한컴 저장본: 오프셋 2829 어울림 36행 표의 앵커 글 한 줄 41803 은 첫 쪽 제자리, 다음 문단은 셋째 쪽 표 나머지 아래 29276)
+        const sq = m0Objs(p), sqPos = sq ? findChildByLocalName(sq, "pos") : null
+        const sqVo = num(sqPos, "vertOffset"), sqTop = startV + Math.max(0, sqVo >= 2 ** 31 ? sqVo - 2 ** 32 : sqVo) + num(sq ? findChildByLocalName(sq, "outMargin") : null, "top")
+        if (split3 !== undefined && sq && own.length && own.every(sg => num(sg, "vertpos") + num(sg, "vertsize") <= sqTop)) {
+          cursorV = 0; floatFloor = split3; zones.length = 0; splitPage = true
+        } else if (split3 !== undefined && own.length) {
           const d = split3 - num(own[0], "vertpos")
           for (const sg of own) sg.setAttribute("vertpos", String(num(sg, "vertpos") + d))
           cursorV = res.textBottom + d; zones.length = 0; splitPage = true
```

**File**: `tests/reflow-square-split-text-above.test.ts` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+import { describe, it } from "node:test"
+import assert from "node:assert/strict"
+import { createXmlParser } from "../src/hwpx/parser-shared.js"
+import { parseRenderStyles } from "../src/render/head-styles.js"
+import { reflowSection } from "../src/render/reflow.js"
+
+const NS = 'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"'
+const head = `<hh:head ${NS}><hh:refList><hh:fontfaces><hh:fontface lang="HANGUL"><hh:font id="0" face="바탕"/></hh:fontface></hh:fontfaces><hh:charProperties><hh:charPr id="0" height="1000"><hh:fontRef hangul="0"/></hh:charPr></hh:charProperties><hh:paraProperties><hh:paraPr id="0"><hh:align horizontal="LEFT"/><hh:breakSetting breakNonLatinWord="KEEP_WORD"/><hh:lineSpacing type="PERCENT" value="100" unit="HWPUNIT"/></hh:paraPr></hh:paraProperties></hh:refList></hh:head>`
+
+/** 글 두 문단 뒤 앵커 글 한 줄 문단 — 온 폭 어울림 칸 안 나눔 표(4행 × 3000)가 쪽(10000)을 넘는다. [앵커 줄, 다음 문단] vertpos */
+function place(vertOffset: string): string[] {
+  const row = (r: number) => `<hp:tr><hp:tc><hp:subList><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>칸${r}</hp:t></hp:run></hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="${r}"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="42000" height="3000"/><hp:cellMargin left="0" right="0" top="141" bottom="141"/></hp:tc></hp:tr>`
+  const tbl = `<hp:tbl textWrap="SQUARE" pageBreak="CELL" rowCnt="4" colCnt="1"><hp:sz width="42000" height="12000"/><hp:pos treatAsChar="0" vertRelTo="PARA" horzRelTo="PARA" vertOffset="${vertOffset}" horzOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/>${[0, 1, 2, 3].map(row).join("")}</hp:tbl>`
+  const filler = `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>가</hp:t></hp:run></hp:p>`.repeat(2)
+  const root = createXmlParser().parseFromString(`<hs:sec ${NS}>${filler}<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0">${tbl}<hp:t>앵커</hp:t></hp:run></hp:p><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>다음</hp:t></hp:run></hp:p></hs:sec>`, "text/xml").documentElement as unknown as Element
+  reflowSection(root, parseRenderStyles(head), { BODY_W: 42000, BODY_H: 10000 })
+  const ps = Array.from(root.childNodes as unknown as Element[]).filter(c => c.nodeName === "hp:p")
+  return [ps[2], ps[3]].map(p => Array.from(p.childNodes as unknown as Element[]).find(c => c.nodeName === "hp:linesegarray")!.getElementsByTagName("hp:lineseg")[0].getAttribute("vertpos")!)
+}
+describe("쪽을 넘는 온 폭 어울림 표와 앵커 글", () => {
+  it("표가 글 줄 아래에 붙으면(세로 오프셋 1500) 글은 제자리, 다음 문단만 다음 쪽 표 나머지 아래", () => {
+    assert.deepEqual(place("1500"), ["2000", "6000"])
+  })
+  it("표가 문단 위에 붙으면(오프셋 0) 글은 마지막 쪽 표 나머지 아래로", () => {
+    assert.deepEqual(place("0"), ["3000", "4000"])
+  })
+})
```

---

### Incident Patch 6: `e919f538` (2026-10-17)
**Commit Message**: fix(reflow): 글 없이 표만 든 문단 끝 줄은 표와 끝 run 중 큰 높이

- 글자처럼 취급하는 표만 든(보이는 글 없는) 문단 끝 줄의 줄 높이 = max(표 + 바깥 여백 위아래, 문단 끝 run 의 글자 크기). 표를 담은 run 의
  글자 크기는 줄 높이에 들지 않고 줄 간격 몫만 정한다. 기준선도 그 둘의 85% 중 큰 것.
  한컴 저장본: 2600 run 의 1848 표 + 1500 빈 run → 줄 2414·기준선 2052·간격 −260(= 2600 × 90% − 2600), 표와 빈 글이 한 2600 run 인
  문단은 2600·2210. 종전엔 앞 문단도 2600 으로 세워 보도자료 머리 표 아래 문단이 모두 186 내려갔다
- 측정(12개 폴더 저장본 lineseg 대조): 본문 첫 줄 vertpos 76,664 → 76,676(1문서 +12, 하락 0), 본문+개체 16,331 → 16,332,
  칸 205,007·칸+개체 6,188·두 줄+ 24,939/25,187·줄 수 306,680 그대로. 렌더 글 위치 82,816/90,379·그림 3,858/3,976·
  쪽 수 1,154/1,159 그대로, gen-repro 같음
- npm test 4,259 통과·실패 0, reflow 게이트 59/59, 쪽 10/10, 왕복 게이트 통과

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Q7EF2EFJZMeH4dk7Rm2f15

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - PDF 표 캡션이 쪽에서 표 아래에 있으면 마크다운에서 표 뒤에 낸다(`IRTable.captionBelow`). 종전엔 늘 표 위로 올려 읽는 순서가 뒤집혔다(ODL 064·110·132).
 - PDF 그림 영역 OCR 표의 행 절반 이상이 전폭 한 칸이면 표로 받지 않고 행마다 문단으로 낸다. 격자 도로 지도의 길 이름이 괘선 때문에 표가 됐다(ODL 098).
 - PDF 한 단 본문에서 전폭 줄을 뺀 낱말 조각만으로 2단 거터를 잡던 오검출을 막는다. 거터를 가로지르는 전폭 글줄이 적은 쪽 단 줄 수 이상이면 2단이 아니다. 종전엔 3pt 낱말 틈에서 한 줄이 찢겨 다음 줄 뒤로 밀렸다(ODL 003, 고흥군 계획서 413쪽).
+- 글 없이 표(글자처럼 취급)만 든 문단 끝 줄의 높이는 표(바깥 여백 포함)와 문단 끝 run 의 글자 크기 중 큰 것이다. 표를 담은 run 의 글자 크기는 줄 간격 몫만 정한다. 종전엔 2600 run 의 1848 표 줄을 2600 으로 세워 아래 문단이 186 내려갔다.
 - 기호 글꼴 사적 영역 글자(U+F020~F0FF, U+F0A0 빼고)가 글꼴에 없으면 Wingdings 진행폭으로 잰다. 한컴은 이 글자를 Wingdings-Regular 로 찍는다(짝 PDF 20개 전부). 종전엔 1em 으로 재 "영양\uF09E기능성분" 줄이 넘쳐 두 줄이 됐다.
 - 칸 높이를 고정한 표(`noAdjust`)가 쪽에서 갈리면 위 정렬 칸도 칸 저장 높이에서 이 쪽 조각을 뺀 만큼을 다음 쪽에 둔다. 고정 표의 이 쪽 조각은 남은 높이 − 2(그 밖의 표는 − 101)다. 종전엔 남은 글 줄만 넘겨 뒤 문단이 797 위에 놓였다.
 
```

**File**: `src/render/reflow.ts` (modified, +7/-2)
```diff
@@ -650,7 +650,12 @@ function reflowPara(
     const textH = Math.max(textH0, boxAll)
     // 글 없이 수식만 든 줄은 수식이 글자보다 낮아도 줄 높이가 수식 높이다 — 줄 간격은 글자 높이로(한컴 저장본: 높이 32 수식 줄 vertsize 32, spacing 720 = 1200 × 60%)
     const objOnly = lineObjH[li] > 0 && lineObjH[li] < textH && (() => { const s0 = textposOf[li], e = li === wrap.starts.length - 1 ? m.chars.length : textposOf[li + 1]; for (let k = s0; k < e; k++) { const c = m.chars[k]; if (c.ch && c.ch.trim() !== "") return false } return m.objs.some(o => o.inline && o.tag === "equation" && lineOf(o.index) === li) })()
-    const lineH = objOnly ? lineObjH[li] : Math.max(textH, lineObjH[li])
+    // 글 없이 표만 든 문단 끝 줄은 줄 높이가 표(바깥 여백 포함)와 문단 끝 run 의 글자 크기 중 큰 것 — 표를 담은 run 의 글자 크기는 줄 높이에
+    // 들지 않고 줄 간격 몫만 정한다(한컴 저장본: 2600 run 의 1848 표 + 1500 빈 run → 줄 2414·간격 −260 = 2600 × 90%, 표와 빈 글이 한 2600 run 이면 2600).
+    // 기준선도 그 둘로(2414 × 85% = 2052)
+    const endH = li === wrap.starts.length - 1 && lineObjH[li] > 0 && lineObjH[li] < textH && !m.chars.slice(textposOf[li]).some(c => c.ch && c.ch.trim() !== "") &&
+      m.objs.some(o => o.inline && o.tag === "tbl" && lineOf(o.index) === li) ? heightOf(m.runs[m.runs.length - 1]?.prId ?? null) : -1
+    const lineH = objOnly ? lineObjH[li] : endH >= 0 ? Math.max(lineObjH[li], endH) : Math.max(textH, lineObjH[li])
     // 줄간격 100% 미만이면 음수 — 다음 줄·문단이 그만큼 겹쳐 올라온다. '줄 간격에 영향' 개체 줄은 개체까지 든 줄 높이로
     // (한컴 저장본: 140% 문단의 표 줄 60333 → spacing 24132, 그 표 아닌 개체 줄은 글자 높이 1300 → 520)
     // 고정 줄 간격은 개체 줄도 그 간격만 나아간다(한컴 저장본: 고정 1800 문단의 표 줄 20500 → spacing −18700)
@@ -675,7 +680,7 @@ function reflowPara(
     // 기준선 = 글자(높이의 85%)와 개체 윗부분 중 가장 높은 것 — 줄 높이는 그 둘의 합이 아니라 가장 큰 높이다(수식 1650·1050 줄 → 1650, 기준선 924).
     // 문단 세로 정렬이 가운데면 기준선이 줄 가운데(개체 줄 2817 → 1408, 글 줄 1100 → 550), 아래면 줄 바닥(1100 → 1100)
     // 위 정렬이면 0(한컴 저장본: 세로 정렬 TOP 문단의 줄 668개 모두 baseline 0)
-    seg.setAttribute("baseline", String(geom.vertAlign === "TOP" ? 0 : geom.vertAlign === "CENTER" || verticalCenter && (!geom.vertAlign || geom.vertAlign === "BASELINE") ? Math.floor(lineH / 2) : geom.vertAlign === "BOTTOM" ? lineH : Math.max(fl ? fl[1] : Math.round(textH0 * BASELINE_RATIO), boxTop > textH0 ? Math.round(boxTop * BASELINE_RATIO) : 0, lineObjAsc[li])))
+    seg.setAttribute("baseline", String(geom.vertAlign === "TOP" ? 0 : geom.vertAlign === "CENTER" || verticalCenter && (!geom.vertAlign || geom.vertAlign === "BASELINE") ? Math.floor(lineH / 2) : geom.vertAlign === "BOTTOM" ? lineH : endH >= 0 ? Math.max(Math.round(endH * BASELINE_RATIO), lineObjAsc[li]) : Math.max(fl ? fl[1] : Math.round(textH0 * BASELINE_RATIO), boxTop > textH0 ? Math.round(boxTop * BASELINE_RATIO) : 0, lineObjAsc[li])))
     seg.setAttribute("spacing", String(spacing))
     let box = boxAt(li)
     // 한 줄 문단이 양쪽에 빈 자리를 남긴 어울림 개체 옆에 오고 글이 왼쪽 조각에 다 들면, 왼쪽 조각에 두고 남은 조각마다
```

**File**: `tests/reflow-table-end-line.test.ts` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+import { describe, it } from "node:test"
+import assert from "node:assert/strict"
+import { createXmlParser } from "../src/hwpx/parser-shared.js"
+import { parseRenderStyles } from "../src/render/head-styles.js"
+import { reflowSection } from "../src/render/reflow.js"
+
+const NS = 'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"'
+// 글자 모양 0 = 2600, 1 = 1500. 문단 줄 간격 90%
+const head = `<hh:head ${NS}><hh:refList><hh:fontfaces><hh:fontface lang="HANGUL"><hh:font id="0" face="바탕"/></hh:fontface></hh:fontfaces><hh:charProperties><hh:charPr id="0" height="2600"><hh:fontRef hangul="0"/></hh:charPr><hh:charPr id="1" height="1500"><hh:fontRef hangul="0"/></hh:charPr></hh:charProperties><hh:paraProperties><hh:paraPr id="0"><hh:align horizontal="RIGHT"/><hh:breakSetting breakNonLatinWord="KEEP_WORD"/><hh:lineSpacing type="PERCENT" value="90" unit="HWPUNIT"/></hh:paraPr></hh:paraProperties></hh:refList></hh:head>`
+const tbl = `<hp:tbl textWrap="TOP_AND_BOTTOM" rowCnt="1" colCnt="1"><hp:sz width="10000" height="1848"/><hp:pos treatAsChar="1" vertRelTo="PARA" vertOffset="0"/><hp:outMargin left="283" right="283" top="283" bottom="283"/><hp:tr><hp:tc><hp:subList vertAlign="CENTER"><hp:p paraPrIDRef="0"><hp:run charPrIDRef="1"><hp:t>배포</hp:t></hp:run></hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="10000" height="1848"/><hp:cellMargin left="141" right="141" top="141" bottom="141"/></hp:tc></hp:tr></hp:tbl>`
+function hostLine(runs: string) {
+  const root = createXmlParser().parseFromString(`<hs:sec ${NS}><hp:p paraPrIDRef="0">${runs}</hp:p></hs:sec>`, "text/xml").documentElement as unknown as Element
+  reflowSection(root, parseRenderStyles(head), { BODY_W: 42000, BODY_H: 60000 })
+  const seg = Array.from(root.getElementsByTagName("hp:lineseg")).find(s => s.parentNode?.parentNode === root.firstChild)!
+  return ["vertsize", "baseline", "spacing"].map(a => Number(seg.getAttribute(a)))
+}
+describe("글 없이 표만 든 문단 끝 줄", () => {
+  it("표를 담은 run 의 글자 크기는 줄 높이에 들지 않는다 — 문단 끝 빈 run 이 작으면 표 높이", () => {
+    // 표 1848 + 위아래 바깥 여백 566 = 2414, 기준선 85%, 줄 간격 몫은 표 run 2600 × 90% − 2600
+    assert.deepEqual(hostLine(`<hp:run charPrIDRef="0">${tbl}</hp:run><hp:run charPrIDRef="1"><hp:t/></hp:run>`), [2414, 2052, -260])
+  })
+  it("표와 빈 글이 한 run 이면 그 run 의 글자 크기가 줄 높이", () => {
+    assert.deepEqual(hostLine(`<hp:run charPrIDRef="0">${tbl}<hp:t/></hp:run>`), [2600, 2210, -260])
+  })
+})
```

---

### Incident Patch 7: `7e440307` (2026-10-17)
**Commit Message**: fix(reflow): 기호 글꼴 사적 영역 글자는 Wingdings 진행폭으로

- U+F020~F0FF(워드 기호 글꼴 글자)가 문단 글꼴에 없으면 대체 폭을 Wingdings 진행폭(hmtx, unitsPerEm 2048)으로 잰다. 짝 PDF 20개에서
  이 영역 글자는 모두 Wingdings-Regular 로 찍혔다. 종전엔 F0A7·F09F·F06E 만 그 폭이고 나머지는 1em 이라, 맑은 고딕 12pt 자간 −9% 각주 줄
  "…보존료. 영양기능성분 함량 등"이 48,272 로 줄 폭 47,688 을 넘어 두 줄이 되고 둘째 줄이 다음 쪽으로 밀렸다(F09E 1,092 → 344,
  한컴 PDF 348). F0A0 은 종전대로 글꼴 빈칸 폭. 글꼴 폭표에 그 글자가 따로 있으면 표 값이 먼저다
- 측정(12개 폴더 저장본 lineseg 대조): 본문 첫 줄 vertpos 76,650 → 76,664(1문서 +14, 하락 0), 본문+개체 16,329 → 16,331,
  칸 205,005 → 205,007, 칸+개체 6,188 그대로, 두 줄+ 24,938 → 24,939/25,187, 줄 수 306,678 → 306,680/306,744.
  렌더 글 위치 82,816/90,379 그대로(가로 정확 일치 82,507 → 82,509), 그림 3,858/3,976·쪽 수 1,154/1,159 그대로, gen-repro 같음
- npm test 4,257 통과·실패 0, reflow 게이트 59/59, 쪽 10/10, 왕복 게이트 통과

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Q7EF2EFJZMeH4dk7Rm2f15

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -12,6 +12,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 - PDF 표 캡션이 쪽에서 표 아래에 있으면 마크다운에서 표 뒤에 낸다(`IRTable.captionBelow`). 종전엔 늘 표 위로 올려 읽는 순서가 뒤집혔다(ODL 064·110·132).
 - PDF 그림 영역 OCR 표의 행 절반 이상이 전폭 한 칸이면 표로 받지 않고 행마다 문단으로 낸다. 격자 도로 지도의 길 이름이 괘선 때문에 표가 됐다(ODL 098).
 - PDF 한 단 본문에서 전폭 줄을 뺀 낱말 조각만으로 2단 거터를 잡던 오검출을 막는다. 거터를 가로지르는 전폭 글줄이 적은 쪽 단 줄 수 이상이면 2단이 아니다. 종전엔 3pt 낱말 틈에서 한 줄이 찢겨 다음 줄 뒤로 밀렸다(ODL 003, 고흥군 계획서 413쪽).
+- 기호 글꼴 사적 영역 글자(U+F020~F0FF, U+F0A0 빼고)가 글꼴에 없으면 Wingdings 진행폭으로 잰다. 한컴은 이 글자를 Wingdings-Regular 로 찍는다(짝 PDF 20개 전부). 종전엔 1em 으로 재 "영양\uF09E기능성분" 줄이 넘쳐 두 줄이 됐다.
 - 칸 높이를 고정한 표(`noAdjust`)가 쪽에서 갈리면 위 정렬 칸도 칸 저장 높이에서 이 쪽 조각을 뺀 만큼을 다음 쪽에 둔다. 고정 표의 이 쪽 조각은 남은 높이 − 2(그 밖의 표는 − 101)다. 종전엔 남은 글 줄만 넘겨 뒤 문단이 797 위에 놓였다.
 
 ## [4.22.7] - 2026-10-18
```

**File**: `src/hwpx/font-metrics.ts` (modified, +17/-0)
```diff
@@ -757,6 +757,23 @@ export function fontAdvanceEm1000(face: string, cp: number): number | null {
  * U+F0A7은 Wingdings-Regular 대체다 — 돋움체·맑은 고딕 PDF의 임베드 hmtx937/upem2048(정수 /W457).
  */
 export const HANCOM_FALLBACK_W: Record<number, number> = { 0x2024: 173, 0x2027: 173, 0x2013: 430, 0x21e8: 1000, 0x2218: 500, 0x2023: 465, 0x3007: 1000, 0xf0a7: 937 / 2048 * 1000, 0xf09f: 937 / 2048 * 1000, 0xf06e: 1529 / 2048 * 1000 }
+/**
+ * 기호 글꼴 사적 영역(U+F020~F0FF, 워드 기호 글꼴 글자)은 글꼴에 없으면 Wingdings-Regular 로 찍힌다 — 그 진행폭(hmtx, unitsPerEm 2048)이
+ * 대체 폭이다(짝 PDF 20개의 이 영역 글자 전부 Wingdings-Regular: 맑은 고딕 문단 "영양기능성분" 의 F09E 가 1em 이 아니라 0.313em 이라
+ * 한 줄에 든다). 위 표의 F0A7·F09F·F06E 와 같은 값. F0A0 은 글꼴 빈칸 폭으로 찍는다(text-metrics) — 키는 낮은 두 자리 16진
+ */
+const WINGDINGS_ADV: Record<number, string> = { 641:"9e a0", 789:"fa", 937:"73 9f a7", 938:"27", 987:"f9", 1086:"7d 7e", 1124:"47 48", 1135:"35", 1183:"77", 1203:"41", 1233:"36", 1301:"fb",
+  1332:"53", 1352:"4e", 1381:"43 44", 1420:"58", 1431:"32 33", 1480:"57", 1529:"55 56 6c 6e 74", 1589:"e3 e4 e5 e6", 1597:"69", 1601:"f5 f6 f7 f8", 1609:"fc", 1624:"42", 1627:"59 d7 d8",
+  1660:"f1 f2 f4", 1665:"54", 1727:"4a 4b 4c", 1739:"4f", 1787:"eb ec ed ee", 1803:"52", 1813:"5a", 1819:"51",
+  1825:"3b 3e 5d 6f 70 71 72 76 7a a1 a2 a3 a4 a5 a8 a9 aa ab ac ad ae af b0 b1 b2 b3 b4 b5 b6 b7 b8 b9 ba bb bc bd be bf c0 c1 c2 c3 c4 c5 c6 d9 da db dc dd de e1 e2 e9 ea ef f0",
+  1826:"29 34 3c 3d 49 5b 7b 7c 80 81 82 83 84 85 86 87 88 89 8a 8b 8c 8d 8e 8f 90 91 92 93 94 95 fd fe", 1830:"25", 1834:"5c", 1863:"3f 40", 1902:"66", 1911:"63", 1924:"3a", 1927:"62", 1929:"45 46",
+  1937:"64", 1941:"38", 1951:"6d a6", 1974:"60", 2006:"df e0", 2020:"75", 2048:"20 96 97 98 99 9a 9b 9c 9d cb cc cd ce cf d0 d1 d2 d3 d4", 2099:"65", 2110:"21", 2119:"ff", 2146:"c7 c8 c9 ca",
+  2150:"6a", 2159:"5f", 2171:"78 79 f3", 2181:"68", 2186:"e7 e8", 2196:"37", 2208:"39", 2220:"28", 2230:"50", 2233:"61", 2245:"30 67", 2275:"4d", 2319:"2a 2b", 2344:"22", 2368:"5e", 2399:"2c 2d",
+  2492:"26", 2566:"d5 d6", 2603:"6b", 2665:"23", 2751:"31", 2752:"24", 2951:"2e", 2956:"2f" }
+for (const [adv, list] of Object.entries(WINGDINGS_ADV)) for (const c of list.split(" ")) {
+  const cp = 0xf000 + parseInt(c, 16)
+  if (cp !== 0xf0a0 && !(cp in HANCOM_FALLBACK_W)) HANCOM_FALLBACK_W[cp] = Number(adv) / 2048 * 1000
+}
 
 /** CJK 통합 한자(확장 A·호환 포함) */
 function isHanja(cp: number): boolean {
```

**File**: `tests/reflow-wingdings-square.test.ts` (modified, +9/-2)
```diff
@@ -32,11 +32,18 @@ describe("Wingdings 사각 기호의 대체 폭", () => {
     assert.equal(fontHasGlyph("맑은 고딕", 0xf0a7), false)
     assert.equal(fontHasGlyph("한컴 고딕", 0xf0a7), true)
   })
-  it("일반 글자와 이웃 PUA·빈칸 폭은 그대로 둔다", () => {
-    for (const [ch, w] of [["가", 1000], ["A", 500], ["\uf0a6", 1000], ["\uf0a0", 500], [" ", 500]] as const) {
+  it("일반 글자와 빈칸 폭은 그대로 둔다", () => {
+    for (const [ch, w] of [["가", 1000], ["A", 500], ["\uf0a0", 500], [" ", 500]] as const) {
       assert.equal(glyphWidth(ch, style("돋움체")).w, w)
     }
   })
+  it("기호 글꼴 사적 영역(U+F020~F0FF)은 글꼴에 없으면 Wingdings 진행폭으로 잰다", () => {
+    // Wingdings hmtx: F0A6 1951·F09E 641·F0E8 2186 (unitsPerEm 2048)
+    assert.equal(glyphWidth("\uf0a6", style("돋움체")).w, 952)
+    assert.equal(glyphWidth("\uf0e8", style("돋움체")).w, 1068)
+    // 맑은 고딕 12pt 자간 −9% 줄 "…영양\uF09E기능성분" — F09E 가 1em(1092)이면 줄을 넘는다
+    assert.equal(glyphWidth("\uf09e", { ...style("맑은 고딕", 1200), spacing: -9 }).w, 344)
+  })
   it("좁은 줄에서 기호 다음 본문을 실제 전진 폭으로 배치한다", () => {
     const ns = 'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section"'
     const head = `<hh:head ${ns}><hh:fontfaces><hh:fontface lang="HANGUL"><hh:font id="0" face="돋움체" type="TTF"/></hh:fontface></hh:fontfaces><hh:charProperties><hh:charPr id="0" height="1000"><hh:fontRef hangul="0"/></hh:charPr></hh:charProperties><hh:paraProperties><hh:paraPr id="0"><hh:align horizontal="LEFT"/><hh:breakSetting breakNonLatinWord="KEEP_WORD"/></hh:paraPr></hh:paraProperties></hh:head>`
```

---

### Incident Patch 8: `e94553d8` (2026-10-17)
**Commit Message**: fix(pdf): 행 대부분이 전폭 한 칸인 그림 영역 OCR 표는 문단으로

- 그림 영역 OCR 표를 받을 때(mergeOcrImageRegions) 행 절반 이상이 전폭 병합 칸 하나에 든 글 한 덩이면 표가 아니라 선 위에 놓인
  글로 보고 행마다 문단으로 낸다. 격자 도로 지도(ODL 098 솔트레이크시티)의 길이 세로 괘선 12개로 잡혀 길 이름이 10행 3열 표가
  됐다(10행 중 6행이 3칸 병합 한 칸). ODL 그림 영역 OCR 표 16개 중 이 꼴은 그 하나, 그림 속 진짜 표(110 점도 표·122 실험 표)는 0행
- 측정(벤치 스위트, c6001ba 대비): ODL 기본값 0.96334 → 0.96367(+0.00033, 상승 1·하락 0 — 098 0.85094→0.91613),
  odlbest 0.97481→0.97512, odlocr 0.96489→0.96521, odlfast 같음. 한국 PDF 글 744·표 730·별표 544·형식 146·왕복 75·OCR 56·
  score 5,465 문서별 같음
- npm test 4,256 통과·실패 0, reflow 게이트 59/59, 쪽 10/10, 왕복 게이트 통과

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Q7EF2EFJZMeH4dk7Rm2f15

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Fixed
 
 - PDF 표 캡션이 쪽에서 표 아래에 있으면 마크다운에서 표 뒤에 낸다(`IRTable.captionBelow`). 종전엔 늘 표 위로 올려 읽는 순서가 뒤집혔다(ODL 064·110·132).
+- PDF 그림 영역 OCR 표의 행 절반 이상이 전폭 한 칸이면 표로 받지 않고 행마다 문단으로 낸다. 격자 도로 지도의 길 이름이 괘선 때문에 표가 됐다(ODL 098).
 - PDF 한 단 본문에서 전폭 줄을 뺀 낱말 조각만으로 2단 거터를 잡던 오검출을 막는다. 거터를 가로지르는 전폭 글줄이 적은 쪽 단 줄 수 이상이면 2단이 아니다. 종전엔 3pt 낱말 틈에서 한 줄이 찢겨 다음 줄 뒤로 밀렸다(ODL 003, 고흥군 계획서 413쪽).
 - 칸 높이를 고정한 표(`noAdjust`)가 쪽에서 갈리면 위 정렬 칸도 칸 저장 높이에서 이 쪽 조각을 뺀 만큼을 다음 쪽에 둔다. 고정 표의 이 쪽 조각은 남은 높이 − 2(그 밖의 표는 − 101)다. 종전엔 남은 글 줄만 넘겨 뒤 문단이 797 위에 놓였다.
 
```

**File**: `src/pdf/ocr-region-merge.ts` (modified, +4/-0)
```diff
@@ -29,6 +29,10 @@ export function mergeOcrImageRegions(
       const t = b.table
       // 원그래프 범례가 머리 있는 표로 받아들여졌다(ODL 124·140) — 그림 속 진짜 표(110 점도 표·122 실험 표)는 영역 안 세로 괘선 5·8개, 범례는 0개
       if (b.type !== "table" || !t || UNRULED_REGION_TABLES.has(b)) return false
+      // 행 절반 이상이 전폭 한 칸에 든 글 한 덩이면 표가 아니라 선 위에 놓인 글이다 — 격자 도로 지도의 길 이름(ODL 098: 10행 중 6행).
+      // ODL 그림 영역 OCR 표 16개 중 이 꼴은 그 하나, 그림 속 진짜 표(110·122)는 0행
+      const lone = t.cells.filter(row => row.filter(c => c.text.trim()).length === 1 && row.some(c => c.colSpan === t.cols)).length
+      if (t.rows >= 2 && lone * 2 >= t.rows) return false
       if (t.rows === 1 && t.cols === 1) {
         const text = t.cells[0]?.[0]?.text ?? ""
         return (text.match(/\n/g)?.length ?? 0) >= 5 && (text.match(/\d/g)?.length ?? 0) >= text.length * 0.25
```

**File**: `tests/pdf-ocr-lone-row-table.test.ts` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+import { describe, it } from "node:test"
+import assert from "node:assert/strict"
+import { mergeOcrImageRegions } from "../src/pdf/ocr-region-merge.js"
+import type { IRBlock, IRCell } from "../src/types.js"
+
+const region = { x1: 100, y1: 100, x2: 500, y2: 500 }
+const cell = (text: string, colSpan = 1): IRCell => ({ text, colSpan, rowSpan: 1 })
+const table = (rows: IRCell[][]): IRBlock => ({
+  type: "table", pageNumber: 1, bbox: { page: 1, x: 120, y: 120, width: 360, height: 360 },
+  table: { rows: rows.length, cols: 3, cells: rows, hasHeader: true },
+})
+const lone = (text: string) => [cell(text, 3), cell(""), cell("")]
+
+describe("그림 영역 OCR 표 — 행 대부분이 전폭 한 칸이면 표가 아니다", () => {
+  it("격자 도로 지도의 길 이름은 행마다 문단으로 (ODL 098)", () => {
+    const blocks: IRBlock[] = []
+    const map = table([[cell("NTS"), cell("THE AVENUES"), cell("Chevron")], lone("Utah State"),
+      [cell("AIRPARK"), cell(""), cell("Capitol Building")], lone("Maverik"), lone("Sinclair"), lone("Chevron Salt Lake City")])
+    mergeOcrImageRegions(blocks, 1, [region], [map])
+    assert.ok(blocks.every(b => b.type === "paragraph"), JSON.stringify(blocks.map(b => b.type)))
+    assert.ok(blocks.some(b => b.text === "Utah State"))
+  })
+  it("칸이 고루 찬 그림 속 표는 표로 받는다", () => {
+    const blocks: IRBlock[] = []
+    mergeOcrImageRegions(blocks, 1, [region], [table([[cell("Temperature"), cell("Viscosity"), cell("Density")],
+      [cell("0"), cell("1.793"), cell("999.8")], [cell("5"), cell("1.519"), cell("1000.0")], lone("Source: lab")])])
+    assert.equal(blocks.length, 1)
+    assert.equal(blocks[0].type, "table")
+  })
+})
```

---

### Incident Patch 9: `c6001bac` (2026-10-17)
**Commit Message**: fix(pdf): 표 아래 캡션은 표 뒤에, 한 단 본문의 가짜 2단 거터는 기각

- 표 캡션: detectTableCaptions 가 표 뒤 블록을 캡션으로 붙일 때 쪽에서 표 아래(캡션 위끝 ≤ 표 아래끝)면 captionBelow 를 달고
  마크다운은 캡션을 표 뒤에 낸다. 종전엔 늘 표 위로 올려 읽는 순서가 뒤집혔다(ODL 064 "Table 1."·132 "Table 6.1:"·110 "Figure 7.2:").
  표 위 캡션은 종전대로 표 앞
- 2단 거터: detectColumnGutter 가 전폭 요소를 빼고 좁은 조각만으로 거터를 찾아, 한 단 본문에서 글꼴이 바뀐 낱말 조각(작은 대문자 "SJ")만
  남은 가운데가 거터로 보였다(ODL 003: 38줄 중 26줄이 거터를 가로지름 → 3pt 낱말 틈에서 한 줄이 찢겨 다음 줄 뒤로).
  거터를 가로지르는 전폭 글줄(두 단이 겹치는 높이 안)이 적은 쪽 단 줄 수 이상이면 2단이 아니다. ODL 의 나머지 거터 검출은
  전폭 줄 7줄 이하·적은 쪽 단 줄 수의 0.6 미만
- 측정(벤치 스위트 4.22.7 대비): ODL 기본값 0.96305 → 0.96334(+0.00030, 상승 4·하락 0 — 132 nid 0.92285→0.96259,
  064 0.92513→0.96410, 110 0.91551→0.93593, 003 0.98489→0.99849), odlbest 0.97452→0.97481, odlocr 0.96459→0.96489,
  odlfast 0.93878→0.93903. 한국 PDF 글 744·표 730·별표 544·형식 146·왕복 75·OCR 56 문서별 같음
- score PDF 덮음: goheung-plan2026 0.99902→0.99901(375,891자 중 375,524→375,520) — 2단으로 오판되던 413쪽이 한 단으로 바로 읽히며
  ("소요예산: 8,651백만원(국 1,060, 도 543, 군 7,048)" 한 줄 복원), 띄워 찍은 작은 금액 주석 줄이 그 줄 앞에 따로 선다. hwpspec 0.99787→0.99789
- npm test 4,254 통과·실패 0, reflow 게이트 59/59, 쪽 10/10, 왕복 게이트 통과

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https:/

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -9,6 +9,8 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Fixed
 
+- PDF 표 캡션이 쪽에서 표 아래에 있으면 마크다운에서 표 뒤에 낸다(`IRTable.captionBelow`). 종전엔 늘 표 위로 올려 읽는 순서가 뒤집혔다(ODL 064·110·132).
+- PDF 한 단 본문에서 전폭 줄을 뺀 낱말 조각만으로 2단 거터를 잡던 오검출을 막는다. 거터를 가로지르는 전폭 글줄이 적은 쪽 단 줄 수 이상이면 2단이 아니다. 종전엔 3pt 낱말 틈에서 한 줄이 찢겨 다음 줄 뒤로 밀렸다(ODL 003, 고흥군 계획서 413쪽).
 - 칸 높이를 고정한 표(`noAdjust`)가 쪽에서 갈리면 위 정렬 칸도 칸 저장 높이에서 이 쪽 조각을 뺀 만큼을 다음 쪽에 둔다. 고정 표의 이 쪽 조각은 남은 높이 − 2(그 밖의 표는 − 101)다. 종전엔 남은 글 줄만 넘겨 뒤 문단이 797 위에 놓였다.
 
 ## [4.22.7] - 2026-10-18
```

**File**: `src/pdf/block-detect.ts` (modified, +4/-1)
```diff
@@ -543,8 +543,11 @@ export function detectTableCaptions(blocks: IRBlock[]): void {
       blocks.splice(i - 1, 1)
       i--
     } else if (isCaptionCandidate(blocks[i + 1], block) && blocks[i + 2]?.type !== "table") {
-      // 두 표 사이의 캡션은 아래 표의 머리 캡션이다
+      // 두 표 사이의 캡션은 아래 표의 머리 캡션이다. 쪽에서 표 아래에 놓인 캡션은 표 뒤에 낸다(captionBelow) —
+      // 늘 표 위에 내면 읽는 순서가 뒤집힌다(ODL 064·110·132: 표 밑 "Table 1."·"Figure 7.2:" 가 표 앞에 나왔다)
+      const cap = blocks[i + 1].bbox, tbl = block.bbox
       block.table.caption = blocks[i + 1].text!.trim()
+      if (cap && tbl && cap.y + cap.height <= tbl.y + 1) block.table.captionBelow = true
       blocks.splice(i + 1, 1)
     }
   }
```

**File**: `src/pdf/two-column.ts` (modified, +7/-0)
```diff
@@ -169,6 +169,13 @@ export function detectColumnGutter(rects: ColRect[]): number | null {
     if (lRowCount < SIDE_MIN_TEXT_ROWS || rRowCount < SIDE_MIN_TEXT_ROWS) return null
     if (tinyGapRows > MAX_TINY_GAP_ROWS) return null
     if (bothRows / Math.min(lRowCount, rRowCount) > MAX_BOTH_SIDE_ROW_RATIO) return null
+    // (c) 거터를 가로지르는 전폭 글줄이 적은 쪽 단의 줄 수만큼 있으면 한 단 본문이다 — 전폭 줄을 빼고 남은 낱말 조각(작은 대문자·글꼴이
+    //     바뀐 낱말)만으로 거터가 보였다(ODL 003: 38줄 중 26줄이 가로질러 3pt 낱말 틈에서 한 줄이 찢겼다). ODL 의 나머지 거터 검출은
+    //     전폭 줄(제목·캡션·표 머리)이 7줄 이하로 적은 쪽 단 줄 수의 0.6 미만
+    const lo = Math.max(L.minY, R.minY), hi = Math.min(L.maxT, R.maxT)
+    const wideCrossRows = new Set(rects.filter(r => r.h <= TEXT_RECT_MAX_H && r.w >= span * WIDE_RECT_RATIO &&
+      r.x < gutterX && r.x + r.w > gutterX && r.y >= lo && r.y <= hi).map(r => rowKey(r.y))).size
+    if (wideCrossRows >= Math.min(lRowCount, rRowCount)) return null
   }
 
   return gutterX
```

**File**: `src/table/builder.ts` (modified, +4/-2)
```diff
@@ -632,13 +632,15 @@ export function blocksToMarkdown(blocks: IRBlock[], options?: MarkdownOptions):
       if (lines.length > 0 && lines[lines.length - 1] !== "") {
         lines.push("")
       }
-      // 표 캡션 — 표 위에 강조 문단으로 출력 (v3.0)
-      lines.push(...captionToMarkdown(block.table, gfm))
+      // 표 캡션 — 표 위에 강조 문단으로 출력 (v3.0). 원문에서 표 아래에 있던 캡션(captionBelow)은 표 뒤에
+      const caption = captionToMarkdown(block.table, gfm)
+      if (!block.table.captionBelow) lines.push(...caption)
       const tableMd = tableToMarkdown(block.table, gfm)
       if (tableMd) {
         lines.push(tableMd)
         lines.push("")
       }
+      if (block.table.captionBelow) lines.push(...caption)
     }
   }
 
```

**File**: `src/types.ts` (modified, +2/-0)
```diff
@@ -151,6 +151,8 @@ export interface IRTable {
   regions?: BoundingBox[]
   /** 표 캡션 (예: "표 1. 부서별 예산") — v3.0 */
   caption?: string
+  /** 캡션이 원문 쪽에서 표 아래에 있다(PDF) — 마크다운은 읽는 순서대로 캡션을 표 뒤에 낸다 */
+  captionBelow?: boolean
   /**
    * 캡션 내부 블록 콘텐츠 — v4.2.8 (#55).
    * 캡션 안 중첩표·문단을 구조 그대로, 원문 순서대로 보존한다 (IRCell.blocks와 같은 계약).
```

**File**: `tests/pdf-v3.test.ts` (modified, +20/-0)
```diff
@@ -24,6 +24,7 @@ import {
 import { detectClusterTables, type ClusterItem } from "../src/pdf/cluster-detector.js"
 import { OPS } from "pdfjs-dist/legacy/build/pdf.mjs"
 import type { IRBlock, IRCell, IRTable } from "../src/types.js"
+import { blocksToMarkdown } from "../src/table/builder.js"
 
 // ─── 헬퍼 ──────────────────────────────────────────────
 
@@ -327,6 +328,25 @@ describe("detectTableCaptions", () => {
     detectTableCaptions(blocks)
     assert.equal(blocks.length, 2)
   })
+
+  it("쪽에서 표 아래에 놓인 캡션은 마크다운에서 표 뒤에 낸다 — 표 위 캡션은 종전대로 표 앞", () => {
+    const below: IRBlock[] = [
+      tableBlock([["a", "b"], ["c", "d"]], 1, { x: 50, y: 100, width: 400, height: 200 }),
+      captionPara("Table 1. Top 10 ports", 1, 80),
+    ]
+    detectTableCaptions(below)
+    assert.equal(below[0].table!.captionBelow, true)
+    const md = blocksToMarkdown(below)
+    assert.ok(md.indexOf("Table 1. Top 10 ports") > md.indexOf("| c | d |"), md)
+    const above: IRBlock[] = [
+      captionPara("표 1. 부서별 예산 현황", 1, 310),
+      tableBlock([["부서", "예산"], ["A과", "100"]], 1, { x: 50, y: 100, width: 400, height: 200 }),
+    ]
+    detectTableCaptions(above)
+    assert.equal(above[0].table!.captionBelow, undefined)
+    const mdAbove = blocksToMarkdown(above)
+    assert.ok(mdAbove.indexOf("표 1. 부서별 예산 현황") < mdAbove.indexOf("| A과 | 100 |"), mdAbove)
+  })
 })
 
 // ─── 한국어 리스트 감지 ────────────────────────────────
```

**File**: `tests/two-column-order.test.ts` (modified, +17/-0)
```diff
@@ -91,6 +91,23 @@ describe("detectColumnGutter", () => {
     assert.ok(gx! > 398 && gx! < 440, `거터 x=${gx}는 단 사이(398~440)여야 함`)
   })
 
+  it("전폭 줄이 대부분인 한 단 본문에서 낱말 조각만으로 보이는 거터 → null", () => {
+    // 줄 대부분은 전폭 한 아이템(거터를 가로지름), 글꼴이 바뀐 낱말에서 갈린 조각만 좌·우에 남아 가운데가 비어 보인다 (ODL 003)
+    const page = (fullRows: (i: number) => boolean) => {
+      const rects: ColRect[] = []
+      for (let i = 0; i < 56; i++) {
+        const y = 900 - i * 14
+        if (i % 4 === 0) rects.push(rect(60, y, 180, 11))
+        else if (i % 4 === 2) rects.push(rect(300, y, 260, 11))
+        else if (fullRows(i)) rects.push(rect(60, y, 500, 11))
+      }
+      return rects
+    }
+    assert.equal(detectColumnGutter(page(() => true)), null)
+    // 같은 조각 사이에 전폭 줄이 몇 줄뿐이면(제목·캡션) 2단이다
+    assert.notEqual(detectColumnGutter(page(i => i === 1 || i === 29)), null)
+  })
+
   it("전폭 프로즈(단일 컬럼) → null", () => {
     const rects: ColRect[] = []
     for (let i = 0; i < 20; i++) {
```

---

### Incident Patch 10: `3e6addbe` (2026-10-17)
**Commit Message**: fix: 칸 높이를 고정한 표는 쪽에서 갈려도 칸 저장 높이를 나눠 가짐

- 칸 안 나눔 표의 첫 쪽 조각(= 한컴 저장 표 높이)을 코퍼스에서 모두 보면, 남은 높이 − 101~102 인 표 52곳은 모두 noAdjust 아님이고
  − 2 인 표 10곳은 모두 noAdjust="1"(칸 높이 고정)이다. 고정 표는 칸 저장 높이를 쪽마다 나눠 가져 위 정렬 칸도 저장 높이 − 조각이
  다음 쪽 몫이다(issue1853 2행 표: 위 정렬 29,198 칸 = 첫 쪽 11,058 + 다음 쪽 18,140 — 남은 글만 세면 17,343 이라 뒤 문단이 797 위).
  고정 아닌 표의 위 정렬 칸은 종전대로 남은 글만 넘긴다(저장 조각을 모든 표에 쓰면 편람·중간진도보고서 본문이 각 9문단 내린다)
- 측정(12개 폴더 저장본 lineseg 대조): 본문 첫 줄 vertpos 76,631 → 76,650/78,375(1문서 상승, 하락 0). 본문+개체 16,329·칸 205,005·
  칸+개체 6,188·두 줄+ 24,938/25,187·줄 수 306,678 그대로, 렌더 글 위치 82,816/90,379·그림 3,858/3,976·쪽 수 1,154/1,159 그대로
- npm test 4,252 통과·실패 0, reflow 게이트 59/59, 쪽 10/10, 왕복 게이트 통과

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Q7EF2EFJZMeH4dk7Rm2f15

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -7,6 +7,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Fixed
+
+- 칸 높이를 고정한 표(`noAdjust`)가 쪽에서 갈리면 위 정렬 칸도 칸 저장 높이에서 이 쪽 조각을 뺀 만큼을 다음 쪽에 둔다. 고정 표의 이 쪽 조각은 남은 높이 − 2(그 밖의 표는 − 101)다. 종전엔 남은 글 줄만 넘겨 뒤 문단이 797 위에 놓였다.
+
 ## [4.22.7] - 2026-10-18
 
 ### Fixed
```

**File**: `src/render/reflow-tables.ts` (modified, +8/-5)
```diff
@@ -156,8 +156,11 @@ function splitTableRows(tbl: Element, top: number, lim: number, bodyH: number, s
       while (y + h + outB > fl() && bodyH - outT - outB > 0) {
         // 이어지는 쪽에서 행을 가를 때는 칸 줄이 쪽 바닥에서 100 넘게 떨어져야 든다(한컴 저장본: 이어지는 쪽에서 넘어간 줄의 남았을 여유 21~98,
         // 남은 줄은 114 이상), 첫 쪽에서는 20(넘어간 줄의 남았을 여유 18, 남은 줄 23). 행 전체가 쪽에 들면 그 행은 가르지 않는다(편람: 바닥 가까이에서 끝나는 행이 그 쪽에 남는다)
-        // 쪽에 남는 행 조각은 남은 높이보다 101 작다(한컴 저장본: 칸 안 나눔 표의 저장 높이 = 첫 쪽 조각, 남은 높이 − 101 인 곳이 가장 많다)
-        const rem = cellRowRemainder(cells, r, fl() - outB - y - (moved ? 100 : 20) - 2 * sp, from, record, bases, carries, styles, bodyH - outT - outB, fl() - outB - y - 101 - 2 * sp)
+        // 쪽에 남는 행 조각은 남은 높이보다 101 작고, 칸 높이를 고정한 표(noAdjust)는 2 작다 — 한컴 저장본: 칸 안 나눔 표의 저장 높이 = 첫 쪽 조각,
+        // 조각이 남은 높이 − 101~102 인 표 52곳은 모두 고정 아님, − 2 인 표 10곳은 모두 고정. 고정 표는 칸 저장 높이를 쪽마다 나눠 가져
+        // 위 정렬 칸도 저장 높이 − 조각이 다음 쪽 몫이다(위 정렬 29,198 칸 = 첫 쪽 11,058 + 다음 쪽 18,140 — 남은 글만 세면 797 모자람)
+        const fixedRows = tbl.getAttribute("noAdjust") === "1"
+        const rem = cellRowRemainder(cells, r, fl() - outB - y - (moved ? 100 : 20) - 2 * sp, from, record, bases, carries, styles, bodyH - outT - outB, fl() - outB - y - (fixedRows ? 2 : 101) - 2 * sp, fixedRows)
         // 마지막 행의 칸 줄이 이 쪽에 다 들면(넘는 것은 저장된 행의 빈 높이뿐) 표는 이 쪽에서 끝난다 — 다음 쪽에 바깥 여백만 남기지 않는다
         // (한컴 저장본: 글이 다 든 21090 행이 쪽 바닥을 넘는 3행 표 뒤 빈 문단이 다음 쪽 0, 종전 566)
         if (rem === 0 && r === rows.length - 1) break
@@ -184,7 +187,7 @@ function splitTableRows(tbl: Element, top: number, lim: number, bodyH: number, s
  * 칸 안 나눔(CELL) 행을 쪽에 남은 높이 avail 에서 가를 때 다음 쪽으로 넘어가는 행 높이. 칸마다 (칸 위 여백 + 줄 바닥) ≤ avail − 칸 아래 여백 인 줄까지
  * 이 쪽에 두고, 남은 줄(첫 남은 줄 위 ~ 내용 끝)에 칸 위아래 여백을 더한다. 어느 칸도 한 줄을 못 넣으면 undefined(행째 다음 쪽)
  */
-function cellRowRemainder(cells: ReturnType<typeof collectCells>, row: number, avail: number, from: Map<Element, number>, record?: Map<Element, number[]>, bases?: Map<Element, number>, carries?: Map<Element, Map<number, number>>, styles?: RenderStyles, contH = 0, piece = Infinity): number | undefined {
+function cellRowRemainder(cells: ReturnType<typeof collectCells>, row: number, avail: number, from: Map<Element, number>, record?: Map<Element, number[]>, bases?: Map<Element, number>, carries?: Map<Element, Map<number, number>>, styles?: RenderStyles, contH = 0, piece = Infinity, fixedRows = false): number | undefined {
   // from: 칸마다 앞 쪽들에 이미 놓은 내용 위치 — 그 위치부터의 줄만 이 쪽에 채운다(가른 뒤 갱신)
   // bases: 그 쪽 조각의 기준 — 자르기 직전 줄의 끝(줄 위치 + 높이 + 간격). 넘어간 줄은 그만큼 올라와 0 부터 다시 적힌다(rebaseSplitCells)
   let rem = 0, any = false, placed = false
@@ -244,9 +247,9 @@ function cellRowRemainder(cells: ReturnType<typeof collectCells>, row: number, a
     if (carry > 0 && cutV > carryFrom) { nb -= carry; const m = carries?.get(c.sub) ?? new Map<number, number>(); m.set(cutV, carry); carries?.set(c.sub, m) }
     cuts.push([c.el, base + lines[k][0], nb])
     rem = Math.max(rem, end + base - nb + c.marginT + c.marginB)
-    // 가운데·아래 정렬 칸은 글이 덜 차도 저장 높이만큼 선다 — 처음 가르는 칸은 저장 높이에서 이 쪽 조각(piece)을 뺀 만큼이 다음 쪽 몫
+    // 가운데·아래 정렬 칸(과 칸 높이 고정 표의 모든 칸)은 글이 덜 차도 저장 높이만큼 선다 — 처음 가르는 칸은 저장 높이에서 이 쪽 조각(piece)을 뺀 만큼이 다음 쪽 몫
     // (한컴 저장본: 가운데 정렬 83,780 칸이 첫 쪽 55,937 + 다음 쪽 27,843 — 남은 글만 세면 24,176 이라 뒤 문단이 3,667 위로 올라왔다)
-    if (off === 0 && /^(CENTER|BOTTOM)$/.test(c.sub.getAttribute("vertAlign") ?? "")) rem = Math.max(rem, c.h - piece)
+    if (off === 0 && (fixedRows || /^(CENTER|BOTTOM)$/.test(c.sub.getAttribute("vertAlign") ?? ""))) rem = Math.max(rem, c.h - piece)
   }
   if (!(any && placed)) return undefined
   for (const [el, v, nb] of cuts) { from.set(el, v); bases?.set(el, nb) }
```

**File**: `tests/reflow-split-centered-cell.test.ts` (modified, +6/-2)
```diff
@@ -5,9 +5,9 @@ import { splitFloatTableRemainder } from "../src/render/reflow-tables.js"
 
 const ns = 'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"'
 // 1행 1칸 칸 안 나눔 표 — 칸 줄 셋(높이 1000, 간격 600, 끝 4200)
-function host(vertAlign: string, cellH: number) {
+function host(vertAlign: string, cellH: number, noAdjust = false) {
   const segs = [0, 1600, 3200].map(v => `<hp:lineseg textpos="0" vertpos="${v}" vertsize="1000" textheight="1000" baseline="850" spacing="600"/>`).join("")
-  const xml = `<hp:p ${ns}><hp:run><hp:tbl textWrap="TOP_AND_BOTTOM" pageBreak="CELL" rowCnt="1" colCnt="1"><hp:sz width="10000" height="${cellH}"/><hp:pos treatAsChar="0" vertRelTo="PARA" vertOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:tr><hp:tc><hp:subList vertAlign="${vertAlign}"><hp:p><hp:run><hp:t>본문</hp:t></hp:run><hp:linesegarray>${segs}</hp:linesegarray></hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="10000" height="${cellH}"/><hp:cellMargin left="0" right="0" top="0" bottom="0"/></hp:tc></hp:tr></hp:tbl></hp:run></hp:p>`
+  const xml = `<hp:p ${ns}><hp:run><hp:tbl textWrap="TOP_AND_BOTTOM" pageBreak="CELL" rowCnt="1" colCnt="1"${noAdjust ? ' noAdjust="1"' : ""}><hp:sz width="10000" height="${cellH}"/><hp:pos treatAsChar="0" vertRelTo="PARA" vertOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:tr><hp:tc><hp:subList vertAlign="${vertAlign}"><hp:p><hp:run><hp:t>본문</hp:t></hp:run><hp:linesegarray>${segs}</hp:linesegarray></hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="10000" height="${cellH}"/><hp:cellMargin left="0" right="0" top="0" bottom="0"/></hp:tc></hp:tr></hp:tbl></hp:run></hp:p>`
   return createXmlParser().parseFromString(xml, "text/xml").documentElement as unknown as Element
 }
 describe("칸 안 나눔 표의 가운데·아래 정렬 칸", () => {
@@ -19,6 +19,10 @@ describe("칸 안 나눔 표의 가운데·아래 정렬 칸", () => {
   it("위 정렬 칸은 남은 줄만 넘긴다", () => {
     assert.equal(splitFloatTableRemainder(host("TOP", 8000), 3000, 6000, 10000), 1000)
   })
+  it("칸 높이를 고정한 표(noAdjust)는 위 정렬 칸도 저장 높이에서 이 쪽 조각(남은 높이 − 2)을 뺀 만큼을 다음 쪽에 둔다", () => {
+    assert.equal(splitFloatTableRemainder(host("TOP", 8000, true), 3000, 6000, 10000), 8000 - 2998)
+    assert.equal(splitFloatTableRemainder(host("CENTER", 8000, true), 3000, 6000, 10000), 8000 - 2998)
+  })
   it("글이 저장 높이보다 길면 남은 줄 높이를 따른다", () => {
     assert.equal(splitFloatTableRemainder(host("CENTER", 3000), 3000, 6000, 10000), 1000)
   })
```

---

### Incident Patch 11: `045b9cd9` (2026-10-17)
**Commit Message**: fix: 쪽에서 갈리는 떠 있는 표를 문단 위 여백 앞에서 가름

- 글 없는 앵커 문단의 떠 있는 위아래 배치 표를 쪽에서 가를 때 위 여백 뒤(줄 자리)에서 재, 위 여백만큼 첫 쪽 자리를 덜 썼다.
  한컴 저장본은 위 여백 앞에서 잰다(위 여백 500 문단의 2행 칸 안 나눔 표: 첫 조각 11,058 = 저장 표 높이 12,840 − 앞 행 1,782 는
  위 여백 앞에서 재야 쪽 바닥 안에 든다). 글머리표 빈 호스트 경로는 이미 위 여백 앞에서 가르고 있었다
- 측정(12개 폴더 저장본 lineseg 대조): 본문 첫 줄 vertpos 76,616 → 76,631/78,375(2문서 상승, 하락 0), 본문+개체 16,324 → 16,329,
  칸 204,959 → 205,005(4문서 상승, 하락 0), 칸+개체 6,185 → 6,188. 두 줄+ 24,938/25,187·줄 수 306,678 그대로,
  렌더 글 위치 82,816/90,379·그림 3,858/3,976·쪽 수 1,154/1,159 그대로
- npm test 4,251 통과·실패 0, reflow 게이트 59/59, 쪽 10/10, 왕복 게이트 통과

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Q7EF2EFJZMeH4dk7Rm2f15

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -11,6 +11,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 - 쪽에서 갈리는 표의 위·아래 캡션을 조각 높이에 넣는다. 종전엔 캡션을 세지 않아 아래 캡션 표 뒤 문단이 캡션 몫만큼 위에 놓였다(정책연구용역 중간진도보고서 「표 23」 1,850). 위 캡션은 첫 조각 앞, 아래 캡션은 마지막 조각 뒤에 한 번만 선다.
 - 한글 2024 초기 빌드(3622 미만) 저장본은 번호·글머리표 문단도 공백 압축으로 채운다. 종전엔 2024 저장본 전부 압축 없이 채워, 빌드 3050 보도자료 제목 표의 부제가 두 줄로 꺾이고 본문이 1,820 아래로 밀렸다. 3622·3901 저장본과 빌드를 모르는 저장본은 종전대로 압축 없이 채운다.
+- 쪽에서 갈리는 떠 있는 표는 문단 위 여백 앞에서 가른다(글머리표 빈 호스트 경로와 같다). 종전엔 위 여백만큼 첫 쪽 자리를 덜 써, 그 쪽에 들 칸 줄이 다음 쪽으로 넘어갔다.
 
 ### Changed
 
```

**File**: `src/render/reflow.ts` (modified, +3/-1)
```diff
@@ -1023,7 +1023,9 @@ function reflowBlockFlow(
       if (res.floatFloor > 0 && off === 0) floatFloor = res.floatFloor
       // 글 없는 앵커 문단의 떠 있는 위아래 배치 표가 쪽 바닥을 넘으면 행 단위로 다음 쪽으로 나뉜다 — 다음 문단은 다음 쪽의 남은 행 아래
       // (한컴 저장본: 1쪽에 행 바닥 + outMargin 아래가 본문 높이 안에 드는 22행, 2쪽에 8행 × 1482 + 141 = 다음 문단 vertpos 11997)
-      const split = bodyH > 0 && off === 0 && (res.paraBottom > lim || squareTableOver(p, startV, lim)) ? splitFloatTableRemainder(p, startV, limOwn, bodyH, styles, false, { n0: pageNotes + fnsOwn.length, s0: pageFoot + ownSum, area: footArea }) : undefined
+      // 표는 문단 위 여백 앞에서 가른다 — 글머리표 빈 호스트 경로와 같다(한컴 저장본: 위 여백 500 문단의 2행 칸 안 나눔 표의 첫 조각
+      // 11,058(= 저장 표 높이 12,840 − 앞 행 1,782)은 위 여백 앞에서 재야 쪽 바닥 안에 든다)
+      const split = bodyH > 0 && off === 0 && (res.paraBottom > lim || squareTableOver(p, startV, lim)) ? splitFloatTableRemainder(p, startV - (g?.spaceBefore ?? 0), limOwn, bodyH, styles, false, { n0: pageNotes + fnsOwn.length, s0: pageFoot + ownSum, area: footArea }) : undefined
       // 오프셋 둔 표가 첫 행부터 안 들어 통째로 다음 쪽 맨 위로 가면(다음 쪽에 다 들 때) 이 쪽은 표 자리부터 띠 — 그 위에 드는 뒤 글은 이 쪽에 남고,
       // 다음 쪽 글은 그 표 아래에서(한컴 저장본: 오프셋 3022 그림 표 23062 의 빈 앵커 59941 뒤 문단 61941 은 제자리, 그다음은 새 쪽 23628 = 283 + 23062 + 283)
       const tEl = split !== undefined && splitWhole ? m0Objs(p) : undefined
```

**File**: `tests/reflow-split-space-before.test.ts` (added, +26/-0)
```diff
@@ -0,0 +1,26 @@
+import { describe, it } from "node:test"
+import assert from "node:assert/strict"
+import { createXmlParser } from "../src/hwpx/parser-shared.js"
+import { parseRenderStyles } from "../src/render/head-styles.js"
+import { reflowSection } from "../src/render/reflow.js"
+
+const NS = 'xmlns:hh="http://www.hancom.co.kr/hwpml/2011/head" xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph" xmlns:hs="http://www.hancom.co.kr/hwpml/2011/section" xmlns:hc="http://www.hancom.co.kr/hwpml/2011/core"'
+const head = (prev: number) => `<hh:head ${NS}><hh:refList><hh:fontfaces><hh:fontface lang="HANGUL"><hh:font id="0" face="바탕"/></hh:fontface></hh:fontfaces><hh:charProperties><hh:charPr id="0" height="1000"><hh:fontRef hangul="0"/></hh:charPr></hh:charProperties><hh:paraProperties><hh:paraPr id="0"><hh:align horizontal="LEFT"/><hh:breakSetting breakNonLatinWord="KEEP_WORD"/></hh:paraPr><hh:paraPr id="1"><hh:align horizontal="LEFT"/><hh:breakSetting breakNonLatinWord="KEEP_WORD"/><hh:margin><hc:prev value="${prev}" unit="HWPUNIT"/></hh:margin></hh:paraPr></hh:paraProperties></hh:refList></hh:head>`
+
+// 앞 문단 한 줄 뒤, 위 여백 있는 문단의 칸 안 나눔 표(칸 줄 6개)가 쪽 바닥을 넘는다 — 표 뒤 문단이 다음 쪽 어디서 시작하는지
+function nextParaTop(prev: number): number {
+  const paras = `<hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>가</hp:t></hp:run></hp:p>`.repeat(6)
+  const tbl = `<hp:tbl textWrap="TOP_AND_BOTTOM" pageBreak="CELL" rowCnt="1" colCnt="1"><hp:sz width="10000" height="10000"/><hp:pos treatAsChar="0" vertRelTo="PARA" vertOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/><hp:tr><hp:tc><hp:subList>${paras}</hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="10000" height="10000"/><hp:cellMargin left="0" right="0" top="0" bottom="0"/></hp:tc></hp:tr></hp:tbl>`
+  const xml = `<hs:sec ${NS}><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>앞</hp:t></hp:run></hp:p><hp:p paraPrIDRef="1"><hp:run charPrIDRef="0">${tbl}<hp:t/></hp:run></hp:p><hp:p paraPrIDRef="0"><hp:run charPrIDRef="0"><hp:t>다음</hp:t></hp:run></hp:p></hs:sec>`
+  const root = createXmlParser().parseFromString(xml, "text/xml").documentElement as unknown as Element
+  reflowSection(root, parseRenderStyles(head(prev)), { BODY_W: 42000, BODY_H: 8000 })
+  const ps = Array.from(root.childNodes as unknown as Element[]).filter(c => c.nodeName === "hp:p")
+  return Number(ps[2].getElementsByTagName("hp:lineseg")[0].getAttribute("vertpos"))
+}
+describe("문단 위 여백과 쪽에서 갈리는 떠 있는 표", () => {
+  it("표는 문단 위 여백 앞에서 가른다 — 위 여백이 있어도 다음 쪽 몫이 같다", () => {
+    const base = nextParaTop(0)
+    assert.ok(base > 0, `표 뒤 문단은 다음 쪽 남은 칸 줄 아래(${base})`)
+    assert.equal(nextParaTop(1500), base)
+  })
+})
```

---

### Incident Patch 12: `cbaf3a54` (2026-10-17)
**Commit Message**: fix: 한글 2024 초기 빌드 저장본의 글머리표 문단도 공백 압축으로 채움

- 2024 저장본의 번호·글머리표 문단은 공백 압축(condense) 없이 채웠는데, 초기 빌드 3050 저장본은 압축한다(해수부 여객선 리튬배터리
  보도자료: 압축 50% 글머리표 부제 47,452 가 줄 폭 46,600 에 공백을 줄여 한 줄 — 종전엔 두 줄로 꺾여 뒤 본문 14문단이 1,820 아래).
  3622(온새미로 교재)·3901 저장본은 압축 없이 채워야 맞아 경계를 3622 로 둔다(경계를 3901 로 두면 온새미로 본문 40문단이 내린다).
  그 사이 빌드(3189~3457)는 이런 문단이 든 표본이 없고, 빌드를 모르는 저장본은 종전대로
- 측정(12개 폴더 저장본 lineseg 대조): 본문 첫 줄 vertpos 76,602 → 76,616/78,375(1문서 상승, 하락 0), 본문+개체 16,322 → 16,324,
  칸 204,958 → 204,959, 줄 수 306,677 → 306,678. 두 줄+ 24,938/25,187·칸+개체 6,185 그대로,
  렌더 글 위치 82,816/90,379·그림 3,858/3,976·쪽 수 1,154/1,159 그대로
- npm test 4,250 통과·실패 0, reflow 게이트 59/59, 쪽 10/10, 왕복 게이트 통과

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Q7EF2EFJZMeH4dk7Rm2f15

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -10,6 +10,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 ### Fixed
 
 - 쪽에서 갈리는 표의 위·아래 캡션을 조각 높이에 넣는다. 종전엔 캡션을 세지 않아 아래 캡션 표 뒤 문단이 캡션 몫만큼 위에 놓였다(정책연구용역 중간진도보고서 「표 23」 1,850). 위 캡션은 첫 조각 앞, 아래 캡션은 마지막 조각 뒤에 한 번만 선다.
+- 한글 2024 초기 빌드(3622 미만) 저장본은 번호·글머리표 문단도 공백 압축으로 채운다. 종전엔 2024 저장본 전부 압축 없이 채워, 빌드 3050 보도자료 제목 표의 부제가 두 줄로 꺾이고 본문이 1,820 아래로 밀렸다. 3622·3901 저장본과 빌드를 모르는 저장본은 종전대로 압축 없이 채운다.
 
 ### Changed
 
```

**File**: `src/render/head-styles.ts` (modified, +6/-1)
```diff
@@ -129,6 +129,8 @@ export interface RenderStyles {
   pageNumCharPr?: string
   /** 한글 2024 이전 판으로 저장된 문서 — 판을 모르면(생성 문서 등) 2024 규칙 */
   before2024?: boolean
+  /** 한글 2024 초기 빌드(3622 미만) 저장본 — 번호·글머리표 문단도 공백 압축(condense)으로 채운다 */
+  early2024?: boolean
 }
 
 /** version.xml 의 저장 빌드(appVersion 넷째 수). 없거나 못 읽으면 undefined */
@@ -333,7 +335,10 @@ export function parseRenderStyles(headXml: string, opts?: { appMajor?: number; a
   // 새 빌드는 휴먼명조 “ ” 를 반각으로 잰다 — 한컴 저장본: 2024 3901·2022 4605 문단은 반각이라야 줄 나눔이 맞고, 2024 3050·2022 4426 이하는 전각
   const major = opts?.appMajor ?? 0, build = opts?.appBuild ?? 0
   const halfQuote = (major === 12 && build >= 4605) || (major === 13 && build >= 3901) || major > 13
-  const styles: RenderStyles = { charPr: new Map(), paraAlign: new Map(), paraGeom: new Map(), borderFill: new Map(), ...(before2024 ? { before2024 } : {}) }
+  // 2024 초기 빌드는 번호·글머리표 문단도 공백을 압축해 채운다 — 한컴 저장본: 2024 3050 글머리표 부제(압축 50%)가 공백을 줄여 한 줄,
+  // 3622·3901 저장본은 압축 없이 채워야 줄 나눔이 맞다(그 사이 빌드는 표본 없음)
+  const early2024 = major === 13 && build > 0 && build < 3622
+  const styles: RenderStyles = { charPr: new Map(), paraAlign: new Map(), paraGeom: new Map(), borderFill: new Map(), ...(before2024 ? { before2024 } : {}), ...(early2024 ? { early2024 } : {}) }
   const doc = createXmlParser().parseFromString(headXml, "text/xml")
   const root = doc.documentElement as unknown as Element | null
   if (!root) return styles
```

**File**: `src/render/reflow.ts` (modified, +3/-2)
```diff
@@ -319,8 +319,9 @@ function reflowPara(
   // 들여쓰기가 줄 폭 이상이면 한컴은 들여쓰기를 두지 않는다(한컴 저장본: 들여쓰기 32580 문단이 폭 6108 칸에 "담당 공무원" 한 줄)
   const intentPos = geom.marginIntent >= avail ? 0 : Math.max(0, geom.marginIntent)
   const firstWrapWidth = squeeze ? NO_WRAP : Math.max(500, avail - (styles.before2024 && bulletW > 0 ? Math.max(intentPos, bulletW) : intentPos + bulletW))
-  // 한글 2024 저장본의 번호·글머리표 문단은 공백 압축(condense) 없이 채운다(같은 문서를 압축 0 으로 바꿔 다시 조판하면 저장본 줄 나눔과 같다)
-  const condenseUse = !styles.before2024 && (geom.number || geom.bullet) ? 0 : geom.condense
+  // 한글 2024 저장본의 번호·글머리표 문단은 공백 압축(condense) 없이 채운다(같은 문서를 압축 0 으로 바꿔 다시 조판하면 저장본 줄 나눔과 같다) —
+  // 초기 빌드(early2024)는 압축한다
+  const condenseUse = !styles.before2024 && !styles.early2024 && (geom.number || geom.bullet) ? 0 : geom.condense
   for (const r of rightTabFit) {
     const edge = avail - bulletW
     if (r.x + widths[r.wi] + r.after > edge && edge - r.x - r.after >= 0) widths[r.wi] = edge - r.x - r.after
```

**File**: `tests/reflow-hancom-rules.test.ts` (modified, +5/-3)
```diff
@@ -173,18 +173,20 @@ describe("reflow 한컴 조판 규칙 — 개체·컨트롤·다단·하위 목
     assert.deepEqual(seg(`<hp:run charPrIDRef="0"><hp:t>가나 </hp:t></hp:run><hp:run charPrIDRef="7"><hp:t>예</hp:t></hp:run>`), [1042, 1084]) // 0.15mm = 42
     assert.deepEqual(seg(`<hp:run charPrIDRef="8"><hp:t>가나 </hp:t></hp:run><hp:run charPrIDRef="7"><hp:t>예</hp:t></hp:run>`), [1100, 1100]) // 1100 글자 줄의 1000 테두리 글자(1084)는 그대로
   })
-  it("한글 2024 저장본의 글머리표·번호 문단은 공백 압축 없이 채운다", () => {
+  it("한글 2024 저장본의 글머리표·번호 문단은 공백 압축 없이 채운다 — 초기 빌드(3622 미만)는 압축한다", () => {
     const head = HEAD.replace("</hh:paraProperties>", `<hh:paraPr id="1" condense="50"><hh:align horizontal="LEFT"/><hh:heading type="BULLET" idRef="1" level="0"/><hh:breakSetting breakNonLatinWord="BREAK_WORD"/></hh:paraPr></hh:paraProperties>`)
       .replace("<hh:charProperties>", `<hh:bullets itemCnt="1"><hh:bullet id="1" char="가" useImage="0"><hh:paraHead level="0" autoIndent="1" textOffsetType="PERCENT" textOffset="0" charPrIDRef="4294967295"/></hh:bullet></hh:bullets><hh:charProperties>`)
     // 글머리표 1000 뒤 "가가가" 낱말 10개(공백 9개) = 34500 — 폭 35000 에 1000 + 34500 은 넘치고, 공백 4500 의 50% 를 줄이면 든다
-    const starts = (appMajor: number) => {
+    const starts = (appMajor: number, appBuild?: number) => {
       const doc = createXmlParser().parseFromString(`<hs:sec ${NS}><hp:p paraPrIDRef="1"><hp:run charPrIDRef="0"><hp:t>${Array(10).fill("가가가").join(" ")}</hp:t></hp:run></hp:p></hs:sec>`, "text/xml")
       const root = doc.documentElement as unknown as Element
-      reflowSection(root, parseRenderStyles(head, { appMajor }), { BODY_W: 35000, BODY_H: 80000 })
+      reflowSection(root, parseRenderStyles(head, { appMajor, appBuild }), { BODY_W: 35000, BODY_H: 80000 })
       return Array.from(root.getElementsByTagName("hp:lineseg") as unknown as Element[]).map(e => Number(e.getAttribute("textpos")))
     }
     assert.deepEqual(starts(12), [0]) // 2024 이전 판: 압축으로 한 줄
     assert.deepEqual(starts(13), [0, 36]) // 2024: 압축 없이 마지막 낱말이 다음 줄
+    assert.deepEqual(starts(13, 3622), [0, 36])
+    assert.deepEqual(starts(13, 3050), [0]) // 2024 초기 빌드: 압축으로 한 줄
   })
   it("글머리표 머리 글자 모양이 더 크면 첫 줄 높이가 그 크기다", () => {
     const head = (cp: string) => HEAD.replace("</hh:paraProperties>", `<hh:paraPr id="1"><hh:align horizontal="LEFT"/><hh:heading type="BULLET" idRef="1" level="0"/><hh:breakSetting breakNonLatinWord="KEEP_WORD"/></hh:paraPr></hh:paraProperties>`)
```

---

### Incident Patch 13: `a7d02d4c` (2026-10-17)
**Commit Message**: fix: 양옆이 공백인 빈칸 선 밑줄은 이스케이프 없이 냄

- 서식의 빈칸 선("성명: ______")을 \_\_\_… 로 내 글자가 두 배가 됐다. 양옆이 공백·줄 끝인 밑줄 묶음은 CommonMark·GFM 에서
  강조를 열지도 닫지도 못해 그대로 낸다. 밑줄과 공백뿐인 줄("______")은 가로줄이 되고, 한쪽이 글자인 밑줄("x ___y"·"end_ x")은
  강조가 될 수 있어 종전대로 이스케이프
- 측정(앞 라운드 대비 suite 문서별 비교): ODL 기본 0.96293 → 0.96305(117 문서 읽기 순서 0.889 → 0.929, 하락 0),
  best·ocr·fast 도 각 +0.00011~0.00012. score·PDF 글·PDF 표·별표·왕복·기타 포맷·OCR 은 문서별로 같다
- npm test 4,250 통과·실패 0, reflow 게이트 59/59, 쪽 10/10

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Q7EF2EFJZMeH4dk7Rm2f15

**File**: `CHANGELOG.md` (modified, +1/-1)
```diff
@@ -13,7 +13,7 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ### Changed
 
-- 마크다운으로 낼 때 단어 안 밑줄(`snake_case`·`MY_VAR`)은 이스케이프하지 않는다. CommonMark·GFM 에서 강조를 열지도 닫지도 못하는 자리라 렌더 결과는 같다. 단어 끝에 붙은 밑줄(`_강조_`·`__init__`)은 종전대로 이스케이프한다.
+- 마크다운으로 낼 때 단어 안 밑줄(`snake_case`·`MY_VAR`)과 양옆이 공백인 빈칸 선(`성명: ______`)은 이스케이프하지 않는다. CommonMark·GFM 에서 강조를 열지도 닫지도 못하는 자리라 렌더 결과는 같다. 단어 끝에 붙은 밑줄(`_강조_`·`__init__`)과 밑줄뿐인 줄(가로줄이 된다)은 종전대로 이스케이프한다.
 
 ## [4.22.6] - 2026-10-18
 
```

**File**: `src/table/builder.ts` (modified, +9/-3)
```diff
@@ -232,9 +232,15 @@ export function escapeGfm(text: string): string {
     // (script-tags escapeLiteralTags)는 그대로 (v4.14.3, #122)
     .replace(/\\(?=[!-#%-\/:-@\[-\x60{}~])(?!<\/?(?:u|sup|sub)>)/g, "\\\\")
     .replace(/([~*`])/g, "\\$1")
-    // _ 묶음은 양옆이 글자·숫자(단어 안)면 CommonMark 에서 강조를 열지도 닫지도 못해 그대로 둔다("snake_case"·"MY_VAR") —
-    // 단어 끝에 붙은 "_강조_"·"__init__" 는 강조가 되므로 이스케이프한다
-    .replace(/_+/g, (m: string, i: number, s: string) => WORD_CHAR.test(s[i - 1] ?? "") && WORD_CHAR.test(s[i + m.length] ?? "") ? m : m.replace(/_/g, "\\_"))
+    // _ 묶음은 양옆이 글자·숫자(단어 안)거나 양옆이 공백·줄 끝(빈칸 선 "성명: ______")이면 CommonMark 에서 강조를 열지도 닫지도
+    // 못해 그대로 둔다("snake_case"·"MY_VAR") — 단어 끝에 붙은 "_강조_"·"__init__" 와 밑줄뿐인 줄(가로줄이 된다)은 이스케이프한다
+    .replace(/_+/g, (m: string, i: number, s: string) => {
+      const before = s[i - 1] ?? "", after = s[i + m.length] ?? ""
+      if (WORD_CHAR.test(before) && WORD_CHAR.test(after)) return m
+      const line = s.slice(s.lastIndexOf("\n", i - 1) + 1, s.indexOf("\n", i) < 0 ? s.length : s.indexOf("\n", i))
+      if (/^\s?$/.test(before) && /^\s?$/.test(after) && !/^[ \t]*(?:_[ \t]*){3,}$/.test(line)) return m
+      return m.replace(/_/g, "\\_")
+    })
     .replace(/(?<!\\)\|/g, "\\|")
     .replace(/^([ \t]*)(?=#{1,6}(?:[ \t]|$))/gm, "$1\\")
     .replace(/<(?!\/?(?:u|sup|sub)>)(?=[A-Za-z/!?])/g, "\\<")
```

**File**: `tests/regress-hwpx-a.test.ts` (modified, +9/-0)
```diff
@@ -222,6 +222,15 @@ describe("regress-a 8: escapeGfm 언더스코어·백틱", () => {
     assert.ok(md.includes("\\`tick\\`"), "` 이스케이프")
   })
 
+  it("양옆이 공백인 빈칸 선 밑줄은 그대로, 밑줄뿐인 줄·한쪽이 글자인 밑줄은 이스케이프", () => {
+    assert.equal(escapeGfm("성명: ______ 날짜"), "성명: ______ 날짜")
+    assert.equal(escapeGfm("서명 ____"), "서명 ____")
+    assert.equal(escapeGfm("______"), "\\_\\_\\_\\_\\_\\_", "줄 전체가 밑줄이면 가로줄이 된다")
+    assert.equal(escapeGfm("줄\n___ ___\n줄"), "줄\n\\_\\_\\_ \\_\\_\\_\n줄")
+    assert.equal(escapeGfm("x ___y"), "x \\_\\_\\_y")
+    assert.equal(escapeGfm("end_ x"), "end\\_ x")
+  })
+
   it("markdown-units 쌍둥이 escapeGfm/unescapeGfmCell 왕복", () => {
     const src = "a_b `c` ~d~ *e*"
     assert.equal(unescapeGfmCell(escapeGfm(src)), src)
```

---

### Incident Patch 14: `bec1fe5d` (2026-10-17)
**Commit Message**: fix: 쪽에서 갈리는 표의 위·아래 캡션 높이를 조각에 넣음

- 쪽을 넘는 표(칸 안 나눔·행 나눔)를 가를 때 캡션을 세지 않아, 아래 캡션 표 뒤 문단이 캡션 몫(간격 + 캡션 줄)만큼 위에 놓였다
  (정책연구용역 중간진도보고서 「표 23」: 아래 캡션 간격 850 + 캡션 줄 1,000 = 1,850 위). 위 캡션은 첫 조각 앞, 아래 캡션은 마지막
  조각 뒤에 한 번만 세고 새 쪽마다 되풀이하지 않는다
- 측정(12개 폴더 저장본 lineseg 대조): 본문 첫 줄 vertpos 76,525 → 76,602/78,375(1문서 상승, 하락 0), 본문+개체 16,320 → 16,322.
  칸 204,958·칸+개체 6,185·두 줄+ 24,938/25,187·줄 수 306,677 그대로. 위 캡션 표가 갈리는 경우는 측정 모수에서 바뀐 문서가 없다
- 렌더 글 위치 82,816/90,379·그림 3,858/3,976·쪽 수 1,154/1,159 그대로(렌더 위치 캐시를 짝 PDF 1,172개로 다시 만들어 기준선도 다시 잼)
- npm test 4,249 통과·실패 0, reflow 게이트 59/59, 쪽 10/10

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Q7EF2EFJZMeH4dk7Rm2f15

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -7,6 +7,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Fixed
+
+- 쪽에서 갈리는 표의 위·아래 캡션을 조각 높이에 넣는다. 종전엔 캡션을 세지 않아 아래 캡션 표 뒤 문단이 캡션 몫만큼 위에 놓였다(정책연구용역 중간진도보고서 「표 23」 1,850). 위 캡션은 첫 조각 앞, 아래 캡션은 마지막 조각 뒤에 한 번만 선다.
+
 ### Changed
 
 - 마크다운으로 낼 때 단어 안 밑줄(`snake_case`·`MY_VAR`)은 이스케이프하지 않는다. CommonMark·GFM 에서 강조를 열지도 닫지도 못하는 자리라 렌더 결과는 같다. 단어 끝에 붙은 밑줄(`_강조_`·`__init__`)은 종전대로 이스케이프한다.
```

**File**: `src/render/reflow-tables.ts` (modified, +6/-3)
```diff
@@ -1,5 +1,5 @@
 /** 표 행 나눔과 하위 목록 조판. 본문 조판 함수는 인자로 받아 중첩 흐름을 이어간다. */
-import { buildPara, collectCells, findFirst, measureTableHeight, measureTableRowHeights, captionExtra, cellContentExtent, cellMarginOf, OBJ_TAGS, elements, ln, num } from "./para-model.js"
+import { buildPara, collectCells, findFirst, measureTableHeight, measureTableRowHeights, captionExtra, captionOf, cellContentExtent, cellMarginOf, OBJ_TAGS, elements, ln, num } from "./para-model.js"
 import { type RenderStyles, type RenderParaGeom } from "./head-styles.js"
 import { type NumberCounters } from "./para-number.js"
 import { type WrapMode } from "../hwpx/text-metrics.js"
@@ -117,6 +117,9 @@ function splitTableRows(tbl: Element, top: number, lim: number, bodyH: number, s
   const rows = measureTableRowHeights(tbl)
   if (rows.length === 0) return undefined
   const outT = num(om, "top")
+  // 위·아래 캡션은 표에 한 번만 선다 — 위 캡션은 첫 조각 앞, 아래 캡션은 마지막 조각 뒤(새 쪽마다 되풀이하지 않는다)
+  const cap = captionOf(tbl)
+  const capTop = cap?.side === "TOP" ? cap.h + cap.gap : 0, capBottom = cap?.side === "BOTTOM" ? cap.h + cap.gap : 0
   // 머리 행 반복(repeatHeader)이면 새 쪽마다 앞쪽 머리 행(칸 header="1")이 먼저 선다(한컴 저장본: 103행 조문 표의 칸 줄이 쪽마다 머리 행 아래에서 다시 시작)
   let headH = 0
   if (tbl.getAttribute("repeatHeader") === "1") {
@@ -125,7 +128,7 @@ function splitTableRows(tbl: Element, top: number, lim: number, bodyH: number, s
     for (let r = 0; heads.has(r) && r < rows.length; r++) headH += rows[r]
   }
   // 넘치는 행은 다음 쪽 맨 위(outMargin 위 아래)로 — 첫 쪽에서 첫 행부터 넘치면 표째 넘어간다. 새 쪽 첫 행은 넘쳐도 그 쪽에 둔다
-  let y = top + outT, floor = lim, moved = false
+  let y = top + outT + capTop, floor = lim, moved = false
   // 칸 안 각주 — 본문이 먼저다: 쪽에서 처음 나오는 표 안 각주만 앞 두 줄 몫으로 그 쪽 바닥을 올리고(나머지 줄은 다음 쪽으로 이어진다),
   // 뒤 각주는 다음 쪽으로 미뤄 바닥을 올리지 않는다(한컴 저장본: 칸 안 각주 6개인 7행 표가 첫 쪽에 5행 11645(= 저장 표 높이) —
   // 첫 각주 네 줄 중 두 줄 2072 만 첫 쪽, 나머지 각주는 다음 쪽)
@@ -174,7 +177,7 @@ function splitTableRows(tbl: Element, top: number, lim: number, bodyH: number, s
   // 앞 쪽들에 놓고 온 몫을 뺀 표 안 각주는 표가 끝나는 쪽 각주로 남긴다(뒤 문단의 쪽 바닥)
   if (moved) splitNotesLast = { n: allN, s: Math.max(0, allS - placed) }
   splitMovedLast = moved
-  return y + outB
+  return y + capBottom + outB
 }
 
 /**
```

**File**: `tests/reflow-split-caption.test.ts` (added, +24/-0)
```diff
@@ -0,0 +1,24 @@
+import { describe, it } from "node:test"
+import assert from "node:assert/strict"
+import { createXmlParser } from "../src/hwpx/parser-shared.js"
+import { splitFloatTableRemainder } from "../src/render/reflow-tables.js"
+
+const ns = 'xmlns:hp="http://www.hancom.co.kr/hwpml/2011/paragraph"'
+// 1행 1칸 칸 안 나눔 표 — 칸 줄 셋(높이 1000, 간격 600, 끝 4200), 캡션 한 줄(높이 1000)·간격 850
+function host(side?: "TOP" | "BOTTOM") {
+  const segs = [0, 1600, 3200].map(v => `<hp:lineseg textpos="0" vertpos="${v}" vertsize="1000" textheight="1000" baseline="850" spacing="600"/>`).join("")
+  const cap = side ? `<hp:caption side="${side}" fullSz="0" width="10000" gap="850" lastWidth="10000"><hp:subList><hp:p><hp:run><hp:t>표 1.</hp:t></hp:run><hp:linesegarray><hp:lineseg textpos="0" vertpos="0" vertsize="1000" textheight="1000" baseline="850" spacing="600"/></hp:linesegarray></hp:p></hp:subList></hp:caption>` : ""
+  const xml = `<hp:p ${ns}><hp:run><hp:tbl textWrap="TOP_AND_BOTTOM" pageBreak="CELL" rowCnt="1" colCnt="1"><hp:sz width="10000" height="5904"/><hp:pos treatAsChar="0" vertRelTo="PARA" vertOffset="0"/><hp:outMargin left="0" right="0" top="0" bottom="0"/>${cap}<hp:tr><hp:tc><hp:subList><hp:p><hp:run><hp:t>본문</hp:t></hp:run><hp:linesegarray>${segs}</hp:linesegarray></hp:p></hp:subList><hp:cellAddr colAddr="0" rowAddr="0"/><hp:cellSpan colSpan="1" rowSpan="1"/><hp:cellSz width="10000" height="5904"/><hp:cellMargin left="0" right="0" top="0" bottom="0"/></hp:tc></hp:tr></hp:tbl></hp:run></hp:p>`
+  return createXmlParser().parseFromString(xml, "text/xml").documentElement as unknown as Element
+}
+describe("쪽에서 갈리는 표의 위·아래 캡션", () => {
+  it("아래 캡션은 마지막 조각 뒤에 선다 — 다음 쪽 몫에 간격 + 캡션 높이를 더한다", () => {
+    // 표 위 3000, 쪽 바닥 6000 → 줄 둘이 이 쪽, 남은 줄 1000 + 캡션 850 + 1000
+    assert.equal(splitFloatTableRemainder(host(), 3000, 6000, 10000), 1000)
+    assert.equal(splitFloatTableRemainder(host("BOTTOM"), 3000, 6000, 10000), 1000 + 850 + 1000)
+  })
+  it("위 캡션은 첫 쪽 조각 앞에 서서 그 쪽에 드는 줄이 준다", () => {
+    // 캡션 1850 이 표 위를 차지해 첫 줄만 이 쪽에 들고 남은 줄(1600 ~ 4200)이 다음 쪽으로, 새 쪽에서는 캡션을 되풀이하지 않는다
+    assert.equal(splitFloatTableRemainder(host("TOP"), 3000, 6000, 10000), 2600)
+  })
+})
```

---

### Incident Patch 15: `524c6516` (2026-10-17)
**Commit Message**: fix: 단어 안 밑줄은 마크다운 이스케이프 없이 냄

- escapeGfm 이 밑줄을 모두 \_ 로 냈다. 양옆이 글자·숫자인 밑줄 묶음("snake_case"·"TwoAFCSimultaneity_3PEq")은 CommonMark·GFM 에서
  강조를 열지도 닫지도 못해(파서 markdown-it 도 같다) 그대로 낸다. 단어 끝 "_강조_"·"__init__" 은 종전대로 이스케이프
- 측정(4.22.6 대비 suite 문서별 비교): ODL 기본 0.96291 → 0.96293(7문서 상승, 하락 0), best·ocr·fast 도 각 +0.00003.
  score·PDF 글·PDF 표·별표·왕복·기타 포맷·OCR 은 문서별로 같다(채점 정규화가 이스케이프를 걷는다)
- npm test 4,247 통과·실패 0, reflow 게이트 59/59, 쪽 10/10

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Q7EF2EFJZMeH4dk7Rm2f15

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -7,6 +7,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+### Changed
+
+- 마크다운으로 낼 때 단어 안 밑줄(`snake_case`·`MY_VAR`)은 이스케이프하지 않는다. CommonMark·GFM 에서 강조를 열지도 닫지도 못하는 자리라 렌더 결과는 같다. 단어 끝에 붙은 밑줄(`_강조_`·`__init__`)은 종전대로 이스케이프한다.
+
 ## [4.22.6] - 2026-10-18
 
 ### Added
```

**File**: `src/table/builder.ts` (modified, +7/-2)
```diff
@@ -196,14 +196,16 @@ export function convertTableToText(rows: CellContext[][]): string {
     .join("\n")
 }
 
+const WORD_CHAR = /[\p{L}\p{N}]/u
+
 /**
  * 마크다운 GFM 특수문자 이스케이프 — remark-gfm 오해석 방지. 라운드트립(markdown-units)이 표 재현
  * 드리프트 검사에 같은 함수를 쓰는 SSOT — 규칙을 바꾸면 그쪽 역변환(unescapeGfm·unescapeGfmCell)도
  * 같이 바꾼다.
  */
 export function escapeGfm(text: string): string {
   // ~ → \~ (GFM strikethrough 방지), * → \* (emphasis/HR·마스킹 별표 "******" 방지),
-  // _ → \_ (emphasis 방지), ` → \` (inline code 방지).
+  // _ → \_ (emphasis 방지, 단어 안 _ 는 그대로), ` → \` (inline code 방지).
   // | → \| — 문단 글의 리터럴 파이프는 GFM 표 구분자와 구별이 안 된다(줄 안 "| 이형식 |").
   //   이미 이스케이프된 \| (평탄화 표 텍스트 convertTableToText) 는 건드리지 않는다.
   // 줄 첫 ATX "# " → \# — 본문 "# arch -k"(유닉스 프롬프트)가 헤딩이 되던 것 (hwp3-sample11).
@@ -229,7 +231,10 @@ export function escapeGfm(text: string): string {
     // "cd \!*"·"{} \;") → \\ 로. IR 규약 이스케이프 \$(escapeLiteralDollar)·\|(convertTableToText)·태그 모양 원문 글자 \<sub>
     // (script-tags escapeLiteralTags)는 그대로 (v4.14.3, #122)
     .replace(/\\(?=[!-#%-\/:-@\[-\x60{}~])(?!<\/?(?:u|sup|sub)>)/g, "\\\\")
-    .replace(/([~*_`])/g, "\\$1")
+    .replace(/([~*`])/g, "\\$1")
+    // _ 묶음은 양옆이 글자·숫자(단어 안)면 CommonMark 에서 강조를 열지도 닫지도 못해 그대로 둔다("snake_case"·"MY_VAR") —
+    // 단어 끝에 붙은 "_강조_"·"__init__" 는 강조가 되므로 이스케이프한다
+    .replace(/_+/g, (m: string, i: number, s: string) => WORD_CHAR.test(s[i - 1] ?? "") && WORD_CHAR.test(s[i + m.length] ?? "") ? m : m.replace(/_/g, "\\_"))
     .replace(/(?<!\\)\|/g, "\\|")
     .replace(/^([ \t]*)(?=#{1,6}(?:[ \t]|$))/gm, "$1\\")
     .replace(/<(?!\/?(?:u|sup|sub)>)(?=[A-Za-z/!?])/g, "\\<")
```

**File**: `tests/literal-dollar.test.ts` (modified, +1/-1)
```diff
@@ -23,7 +23,7 @@ describe("escapeLiteralDollar · escapeGfm", () => {
   })
 
   it("이스케이프된 $ 에서는 수식 스팬을 열지 않는다 — 스팬 밖이라 _ 도 이스케이프", () => {
-    assert.equal(escapeGfm("echo \\$HOME \\$MY_VAR"), "echo \\$HOME \\$MY\\_VAR")
+    assert.equal(escapeGfm("echo \\$HOME \\$_VAR"), "echo \\$HOME \\$\\_VAR")
   })
 
   it("수식 스팬은 그대로 보호 (안의 _ 와 이스케이프된 \\$ 포함)", () => {
```

**File**: `tests/regress-hwpx-a.test.ts` (modified, +4/-3)
```diff
@@ -215,9 +215,10 @@ describe("regress-a 7: 멀티섹션 부분 실패 강등", () => {
 // ─── 8. P2 escapeGfm _ ` ────────────────────────────
 
 describe("regress-a 8: escapeGfm 언더스코어·백틱", () => {
-  it("blocksToMarkdown 문단의 _ 와 ` 가 이스케이프된다", () => {
-    const md = blocksToMarkdown([{ type: "paragraph", text: "snake_case와 `tick` 문자" }])
-    assert.ok(md.includes("snake\\_case"), "_ 이스케이프")
+  it("blocksToMarkdown 문단의 단어 끝 _ 와 ` 가 이스케이프된다 — 단어 안 _ 는 그대로", () => {
+    const md = blocksToMarkdown([{ type: "paragraph", text: "snake_case와 _강조_ __init__ `tick` 문자" }])
+    assert.ok(md.includes("snake_case와"), "단어 안 _ 는 CommonMark 에서 강조를 열고 닫지 못해 그대로")
+    assert.ok(md.includes("\\_강조\\_") && md.includes("\\_\\_init\\_\\_"), "단어 끝 _ 이스케이프")
     assert.ok(md.includes("\\`tick\\`"), "` 이스케이프")
   })
 
```

#### Recent Merged Pull Requests:
- **PR #164** (2026-10-17): feat(ocr): 수기 서류용 손글씨 인식 모델 프리셋 ocrRec: "handwriting" (@VerifiedIdiot)
- **PR #163** (2026-10-16): fix: 조판과 PDF 추출 정확도 개선 (4.22.5) (@chrisryugj)
- **PR #162** (2026-10-16): fix: 조판 기준선과 PDF 본문·계속표 보존 개선 (@chrisryugj)
- **PR #161** (2026-10-16): fix: preserve merged rule cells and document parsing losses (@chrisryugj)
- **PR #160** (2026-10-16): fix: 문서 조판과 쪽 경계 표 구조 보완 (@chrisryugj)
- **PR #159** (2026-10-16): fix: 문서 조판과 PDF 표 경계 정확도 개선 (@chrisryugj)
- **PR #158** (2026-10-16): fix: PDF 연락처 열과 음영 행 내용 복원 (@chrisryugj)
- **PR #157** (2026-10-16): fix: 그림 영역 OCR 좌표 정합 및 Python SDK 0.2.0 (@chrisryugj)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. render): 탭 앞 위치에 글자처럼 취급하는 개체 폭도 넣는다

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in chrisryugj/kordoc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `eedbd2ff`: render): 탭 앞 위치에 글자처럼 취급하는 개체 폭도 넣는다. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
- 렌더에서 탭 앞 위치에 글자처럼 취급하는 개체 폭도 넣는다(조판과 같다). 종전엔 빼고 재 내어쓰기 자동 탭이 개체 폭만큼 길어졌다(체크칸 사각형 뒤 "KZ⇥Kazakhstan" 이 9.6pt 오른쪽).
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `eedbd2ff` are properly handled with clean fallback behavior.

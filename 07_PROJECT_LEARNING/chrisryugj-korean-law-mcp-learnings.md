# Forensic Learning Record (Deep Inspection): chrisryugj/korean-law-mcp

> **Canonical Artifact**: `07_PROJECT_LEARNING/chrisryugj-korean-law-mcp-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/chrisryugj/korean-law-mcp](https://github.com/chrisryugj/korean-law-mcp))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:08:44.682Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `chrisryugj/korean-law-mcp`
- **Description**: 법제처 국가법령정보를 LLM에서 바로 조회하는 MCP 서버. 법령·판례·조례 검색과 인용 검증 | MCP server for Korean law — search statutes, precedents, and ordinances, and verify citations
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 2641 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/lib/historical-utils.ts`
```
/**
 * 연혁 조회 유틸 — time_travel 시나리오에서 raw 데이터 필요
 * (tools/historical-law.ts는 포맷팅된 텍스트만 반환하므로 별도 추출)
 */
import type { LawApiClient } from "./api-client.js"
import { extractTag } from "./xml-parser.js"

export interface HistoricalVersion {
  mst: string
  efYd: string  // 시행일자 (YYYYMMDD)
  ancNo: string
  ancYd: string
  lawNm: string
  rrCls: string
  /** 법령ID가 다른 동명 구법의 행 — 폐지 후 같은 이름으로 재제정되기 전 (lib/law-lineage) */
  priorLaw?: boolean
}

export interface HistoricalFetchResult {
  versions: HistoricalVersion[]
  totalCount: number   // 법제처 응답 "총 N건"
  fetchedPages: number
}

const ROW_PATTERN = /<tr[^>]*>[\s\S]*?<\/tr>/gi

function parseHistoryRows(html: string, normalizedTarget: string, targetHasDecree: boolean): HistoricalVersion[] {
  const out: HistoricalVersion[] = []
  const rows = html.match(ROW_PATTERN) || []
  for (const row of rows) {
    const linkMatch = row.match(/MST=(\d+)[^"]*efYd=(\d*)/)
    if (!linkMatch) continue
    const mst = linkMatch[1]
    const efYd = linkMatch[2] || ""

    const lawNmMatch = row.match(/<a[^>]+>([^<]+)<\/a>/)
    const lawNm = lawNmMatch?.[1]?.trim() || ""
    if (!lawNm) continue

    const lawHasDecree = lawNm.includes("시행령") || lawNm.includes("시행규칙")
    if (!targetHasDecree && lawHasDecree) continue

    const normalizedLaw = lawNm.replace(/\s/g, "")
    if (normalizedLaw !== normalizedTarget) continue

    const ancNoMatch = row.match(/제\s*(\d+)\s*호/)
    const ancNo = ancNoMatch?.[1] || ""

    // 실측 lsHistory 날짜 셀은 0패딩이 없다("2010.1.1"·"2009.12.31" 혼재).
    // 월·일을 \d{2}로만 받으면 한 자리 월·일 행의 공포일자가 통째로 비어("")
    // 동일 시행일 tie-break가 역전된다 (골드셋 G21이 잡은 결함).
    const dateCells = row.match(/<td[^>]*>(\d{4}[.\-]?\s*\d{1,2}[.\-]?\s*\d{1,2})\.?<\/td>/g) || []
    let ancYd = ""
    if (dateCells[0]) {
      const dm = dateCells[0].match(/(\d{4})[.\-]?\s*(\d{1,2})[.\-]?\s*(\d{1,2})/)
      if (dm) ancYd = `${dm[1]}${dm[2].padStart(2, "0")}${dm[3].padStart(2, "0")}`
    }

    // "폐지제정"(구법 폐지 + 동명 신법 제정, 1962 세제개편기 등)을 대안 목록 앞에 —
    // 뒤에 두면 "폐지"가 먼저 걸려 재제정판이 "폐지"로 오표시된다(법적으로 오독 유발).
    const rrClsMatch = row.match(/(폐지제정|제정|일부개정|전부개정|타법개정|타법폐지|일괄개정|일괄폐지|폐지)/)
    const rrCls = rrClsMatch?.[1] || ""

    out.push({ mst, efYd, ancNo, ancYd, lawNm, rrCls })
  }
  return out
}

function parseTotalCount(html: string): number {
  // 총계가 콤마 표기(예: <strong>1,696</strong> 건)로 와도 파싱한다. 이 값은
  // 페이징 종료의 1차 기준이라(위 fetchHistoricalVersionsFull), \d+ 로만 잡으면
  // "1,696"이 "1"로 끊겨 totalCount=1 → 대형 법령 연혁이 1페이지에서 조기 종료되는
  // 역행이 생긴다(정확히 이 함수가 고치려던 케이스).
  const m = html.match(/<strong>([\d,]+)<\/strong>\s*건/)
  return m ? parseInt(m[1].replace(/,/g, ""), 10) : 0
}

/**
 * lsHistory API 호출 → HTML 파싱 → 시행일 내림차순
 * 자주 개정되는 법령(소득세법 시행령 등 200+ 건)도 페이징으로 전체 회수.
 */
export async function fetchHistoricalVersionsFull(
  apiClient: LawApiClient,
  lawName: string,
  apiKey?: string,
  pageSize = 500
): Promise<HistoricalFetchResult> {
  const normalizedTarget = lawName.replace(/\s/g, "")
  const targetHasDecree = lawName.includes("시행령") || lawName.includes("시행규칙")

  const allVersions: HistoricalVersion[] = []
  let totalCount = 0
  let fetchedPages = 0
  let page = 1

  while (page <= 20) {  // 안전 상한: 페이지당 500 × 20 = 10,000개
    const html = await apiClient.fetchApi({
      endpoint: "lawSearch.do",
      target: "lsHistory",
      type: "HTML",
      extraParams: {
        query: lawName,
        display: String(pageSize),
        sort: "efdes",
        page: String(page),
      },
      apiKey,
    })

    if (page === 1) totalCount = parseTotalCount(html)
    const pageRows = parseHistoryRows(html, normalizedTarget, targetHasDecree)
    fetchedPages = page
    allVersions.push(...pageRows)

    // 종료 판정은 원시 총계(totalCount) 기준이어야 한다. pageRows는 대상 법령명으로
    // 필터링된 부분집합이라 "filtered < pageSize" 비교는 원시 행이 다음 페이지에
    // 남아 있어도 1페이지에서 끊는다 — 본법+시행령·규칙 연혁 합계가 500행을 넘는
    // 법령(소득세법류)에서 옛 본법 버전이 통째로 누락되어 applicable_law의
    // 행위시법 버전 특정이 최신 쪽으로 어긋나던 원인.
    if (totalCount > 0) {
      if (page * pageSize >= totalCount) break   // 원시 총계 기준 마지막 페이지
    } else if (pageRows.length === 0) {
      break   // 총계 파싱 실패 시 보수적 종료 (무한루프 방지)
    }
    page++
  }

  // 중복 제거 (MST+시행일 쌍 기준 — 페이징 경계 안전망).
  // lsHistory는 분리시행 공포본을 같은 MST의 여러 행으로 내보낸다
  // (예: 형사소송법 MST 281865 = 시행 2026.7.1. + 2027.12.31.). MST 단독 키는
  // 시행일 내림차순 첫 행(미래 시행분)만 남겨 이미 시행된 슬라이스가 사라지고,
  // applicable_law가 시행 중 버전을 건너뛰어 직전 공포본을 "현행"으로 오판정한다
  // (2026-08-19 실측: 20260701 시행분 누락 → 20260624판을 현행 반환).
  const seen = new Set<string>()
  const unique = allVersions.filter(v => {
    const key = `${v.mst}:${v.efYd}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // 시행일 내림차순. 동일 시행일에 복수 공포본(세법류 매년 1.1. 시행에 흔함)이 있으면
  // 나중 공포본이 앞선 공포본을 반영·개정한 통합본이므로 공포일·공포번호 내림차순 tie-break.
  // (tie-break 없이는 페이지 수집 순서라는 우연에 따라 아무 MST나 잡힌다.)
  unique.sort((a, b) =>
    parseInt(b.efYd || "0", 10) - parseInt(a.efYd || "0", 10) ||
    parseInt(b.ancYd || "0", 10) - parseInt(a.ancYd || "0", 10) ||
    parseInt(b.ancNo || "0", 10) - parseInt(a.ancNo || "0", 10))
  return { versions: unique, totalCount, fetchedPages }
}

/** eflaw 검색의 시행 슬라이스 한 건 (HistoricalVersion과 동일 형상) */
export type EffectiveSlice = HistoricalVersion

/** 시행일 → 공포일 → 공포번호 내림차순 (같은 날 시행되는 복수 공포본은 나중 공포본이 앞) */
export function compareVersionsDesc(a: HistoricalVersion, b: HistoricalVersion): number {
  return parseInt(b.efYd || "0", 10) - parseInt(a.efYd || "0", 10) ||
    parseInt(b.ancYd || "0", 10) - parseInt(a.ancYd || "0", 10) ||
    parseInt(b.ancNo || "0", 10) - parseInt(a.ancNo || "0", 10)
}

/** eflaw 검색 XML 의 행 전부 (이름 필터 없음). lawId 는 법령ID — 계보 필터용 */
export function parseEffectiveRows(xmlText: string): Array<EffectiveSlice & { lawId: string }> {
  const out: Array<EffectiveSlice & { lawId: string }> = []
  for (const m of xmlText.matchAll(/<law[^>]*>([\s\S]*?)<\/law>/g)) {
    const c = m[1]
    const lawNm = extractTag(c, "법령명한글")
    const efYd = extractTag(c, "시행일자")
    const mst = extractTag(c, "법령일련번호")
    if (!lawNm || !/^\d{8}$/.test(efYd) || !mst) continue
    const ancNoRaw = extractTag(c, "공포번호")
    out.push({
      mst,
      efYd,
      // eflaw 공포번호는 0패딩("09897") — lsHistory 표기와 맞춰 정수화
      ancNo: ancNoRaw ? String(parseInt(ancNoRaw, 10)) : "",
      ancYd: extractTag(c, "공포일자"),
      lawNm,
      rrCls: extractTag(c, "제개정구분명"),
      lawId: extractTag(c, "법령ID"),
    })
  }
  return out
}

/**
 * eflaw(시행일 기준) 검색 XML → 대상 법령의 시행 슬라이스 목록 (시행일·공포일·공포번호 내림차순).
 * lsHistory는 공포단위 1행이라 한 공포본의 조항별 분리시행(단계 시행일)이 보이지 않는다 —
 * 예: 소득세법 법률 제9897호는 시행일이 4개(2009.12.31./2010.1.1./2010.4.1./2010.7.1.)인데
 * lsHistory엔 2010.1.1. 한 행뿐. eflaw는 슬라이스마다 한 행씩 반환한다.
 */
export function parseEffectiveSlices(xmlText: string, lawName: string): EffectiveSlice[] {
  const normalizedTarget = lawName.replace(/\s/g, "")
  return parseEffectiveRows(xmlText)
    .filter(r => r.lawNm.replace(/\s/g, "") === normalizedTarget)
    .map((r): EffectiveSlice => ({ mst: r.mst, efYd: r.efYd, ancNo: r.ancNo, ancYd: r.ancYd, lawNm: r.lawNm, rrCls: r.rrCls }))
    .sort(compareVersionsDesc)
}

/**
 * fromYmd~toYmd 구간에 시행일이 있는 대상 법령의 슬라이스 조회 (eflaw efYd 범위 검색).
 * applicable_law의 분리시행 보정용 — 실패는 호출부에서 보수적으로 무시한다.
 */
export async function fetchEffectiveSlices(
  apiClient: LawApiClient,
  lawName: string,
  fromYmd: string,
  toYmd: string,
  apiKey?: string
): Promise<EffectiveSlice[]> {
  const xml = await apiClient.fetchApi({
    endpoint: "lawSearch.do",
    target: "eflaw",
    type: "XML",
    extraParams: { query: lawName, display: "100", efYd: `${fromYmd}~${toYmd}` },
    apiKey,
  })
  return parseEffectiveSlices(xml, lawName)
}

/** @deprecated Use fetchHistoricalVersionsFull. 단일 페이지(legacy 호환용). */
export async function fetchHistoricalVersionsRaw(
  apiClient: LawApiClient,
  lawName: string,
  apiKey?: string,
  display = 500
): Promise<HistoricalVersion[]> {
  const r = await fetchHistoricalVersionsFull(apiClient, lawName, apiKey, display)
  return r.versions
}

```

### Core Architecture Module: `src/lib/session-state.ts`
```
/**
 * 요청별 컨텍스트 (AsyncLocalStorage 기반 - stateless 모드)
 *
 * HTTP stateless 전환 후: 세션 Map 없음. 매 요청마다 ALS에 API 키를 주입하고
 * api-client가 getStore()로 조회. 요청 끝나면 자동 소멸.
 */

import { AsyncLocalStorage } from "node:async_hooks"
import type { RequestExecutionBudget } from "./execution-limits.js"

export interface RequestContext {
  apiKey?: string
  /** HTTP disconnect signal, optionally combined with one MCP item's cancellation signal. */
  signal?: AbortSignal
  /** Shared by all tools in one outer HTTP request (including a JSON-RPC batch). */
  budget?: RequestExecutionBudget
}

export const requestContext = new AsyncLocalStorage<RequestContext>()

/** A consistent cancellation error that callers can recognise without leaking transport details. */
export function requestCancelledError(reason?: unknown): Error {
  if (reason instanceof Error) return reason
  const error = new Error(reason ? `Request cancelled: ${String(reason)}` : "Request cancelled.")
  error.name = "AbortError"
  return error
}

/**
 * Combine signals without making a cancelled MCP item poison its sibling
 * batch items.  The caller supplies only its own item signal; the shared
 * request context contains the connection-level signal.
 */
export function combineAbortSignals(...signals: Array<AbortSignal | undefined>): AbortSignal | undefined {
  const active = signals.filter((signal): signal is AbortSignal => Boolean(signal))
  if (active.length === 0) return undefined
  if (active.length === 1) return active[0]

  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(active)
  }

  const controller = new AbortController()
  const abort = (signal: AbortSignal) => controller.abort(signal.reason)
  for (const signal of active) {
    if (signal.aborted) {
      abort(signal)
      break
    }
    signal.addEventListener("abort", () => abort(signal), { once: true })
  }
  return controller.signal
}

/** Run work with the current request values retained and an additional item-scoped signal. */
export function runWithRequestContext<T>(
  values: Partial<RequestContext>,
  work: () => T,
): T {
  const current = requestContext.getStore()
  const signal = combineAbortSignals(current?.signal, values.signal)
  return requestContext.run({ ...current, ...values, signal }, work)
}

export function getRequestSignal(): AbortSignal | undefined {
  return requestContext.getStore()?.signal
}

export function throwIfRequestCancelled(): void {
  const signal = getRequestSignal()
  if (signal?.aborted) throw requestCancelledError(signal.reason)
}

```

### Core Architecture Module: `src/tools/kb-utils.ts`
```
/**
 * Knowledge Base 공통 유틸리티
 */

// extractTag는 xml-parser.ts의 공유 구현을 re-export
export { extractTag } from "../lib/xml-parser.js"
import { extractTag } from "../lib/xml-parser.js"

/**
 * KB XML 응답 파싱
 */
export interface KBItem {
  법령용어명?: string
  용어명?: string
  법령용어ID?: string
  동음이의어?: boolean
  용어간관계링크?: string
  조문간관계링크?: string
  법령명?: string
  법령ID?: string
  조문번호?: string
  조문제목?: string
  관계유형?: string
  법령종류?: string
  연계용어명?: string
  일상용어명?: string
}

export interface KBParseResult {
  totalCnt: string
  data: KBItem[]
}

export function parseKBXML(xml: string, _rootTag: string): KBParseResult {
  const result: KBParseResult = { totalCnt: "0", data: [] }

  // totalCnt 추출
  const totalCntMatch = xml.match(/<totalCnt>(\d+)<\/totalCnt>/i) || xml.match(/<검색결과개수>(\d+)<\/검색결과개수>/i)
  result.totalCnt = totalCntMatch ? totalCntMatch[1] : "0"

  // 아이템 추출 (다양한 태그명 지원)
  const itemTags = ["lstrm", "lstrmAI", "law", "jo", "rel", "item"]

  for (const itemTag of itemTags) {
    const itemRegex = new RegExp(`<${itemTag}[^>]*>([\\s\\S]*?)<\\/${itemTag}>`, "gi")
    const matches = xml.matchAll(itemRegex)

    for (const match of matches) {
      const itemContent = match[1]
      const item: KBItem = {}

      // 공통 필드 추출
      item.법령용어명 = extractTag(itemContent, "법령용어명") || extractTag(itemContent, "용어명")
      item.법령용어ID = extractTag(itemContent, "법령용어ID") || extractTag(itemContent, "용어ID")
      item.동음이의어 = extractTag(itemContent, "동음이의어존재여부") === "Y"
      item.용어간관계링크 = extractTag(itemContent, "용어간관계링크") || extractTag(itemContent, "용어관계")
      item.조문간관계링크 = extractTag(itemContent, "조문간관계링크") || extractTag(itemContent, "조문관계")
      item.법령명 = extractTag(itemContent, "법령명")
      item.법령ID = extractTag(itemContent, "법령ID") || extractTag(itemContent, "법령일련번호")
      item.조문번호 = extractTag(itemContent, "조문번호") || extractTag(itemContent, "조번호")
      item.조문제목 = extractTag(itemContent, "조문제목")
      item.관계유형 = extractTag(itemContent, "관계유형") || extractTag(itemContent, "연계유형")
      item.법령종류 = extractTag(itemContent, "법령종류") || extractTag(itemContent, "법종류")
      item.연계용어명 = extractTag(itemContent, "연계용어명") || extractTag(itemContent, "관련용어")
      item.일상용어명 = extractTag(itemContent, "일상용어명") || extractTag(itemContent, "일상용어")

      // 빈 객체가 아닌 경우만 추가
      if (item.법령용어명 || item.법령명 || item.연계용어명) {
        result.data.push(item)
      }
    }

    if (result.data.length > 0) break
  }

  return result
}

/**
 * 용어 검색 폴백
 */
export async function fallbackTermSearch(
  apiClient: Pick<import("../lib/api-client.js").LawApiClient, "fetchApi">,
  term: string,
  termType: string,
  apiKey?: string
): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  // 조회 오류는 삼키지 않고 호출부(도구의 catch → formatToolError)로 올린다. 종전엔 장애를
  // "연계 정보를 찾을 수 없습니다"로 바꿔 부존재처럼 답했다 (2026-09-23 리뷰 D8).
  const xmlText = await apiClient.fetchApi({
    endpoint: "lawSearch.do",
    target: "lstrm",
    extraParams: { query: term, display: "10" },
    apiKey,
  })

  const result = parseKBXML(xmlText, "LsTrmSearch")
  const items = result.data || []

  if (items.length === 0) {
    return {
      content: [{
        type: "text",
        text: `[NOT_FOUND] '${term}' ${termType} 연계 정보를 찾을 수 없습니다.\n⚠️ LLM은 연계 정보를 추측하지 마세요.`,
      }],
      isError: true,
    }
  }

  let output = `'${term}' 관련 용어 (폴백 검색):\n\n`
  for (const item of items) {
    if (item.법령용어명) {
      output += `   • ${item.법령용어명}\n`
    }
  }

  return { content: [{ type: "text", text: output }] }
}

```

### Core Architecture Module: `src/tools/precedent-search-core.ts`
```
import type { LawApiClient } from "../lib/api-client.js"
import { parsePrecedentXML, type PrecedentItem } from "../lib/xml-parser.js"
import { buildCompactLegalQueries } from "./compact-query-planner.js"
import type { AiLawArticleSignal } from "./life-law.js"
import type { SearchPrecedentsInput } from "./precedents.js"
import { rethrowIfFatal } from "../lib/fatal-errors.js"
import { extractCaseNumbers, fieldHasExactCase } from "../lib/case-citation.js"

export type PrecedentSearchMode = 1 | 2
export type PrecedentSearchScope = PrecedentSearchMode | "both"

/** search 인자 정규화. search_decisions 의 options 는 스키마 검증 없이 넘어와 "2" 같은 문자열도 온다. */
export function precedentSearchScope(args: SearchPrecedentsInput): PrecedentSearchScope {
  const value = String(args.search ?? 1)
  if (value === "both") return "both"
  return value === "2" ? 2 : 1
}

export interface PrecedentSearchAttempt {
  query?: string
  caseNumber?: string
  search?: PrecedentSearchMode
  fromDate?: string
  toDate?: string
  reason: string
  totalCount: number
  hitCount: number
  success: boolean
  outOfRequestedDateRange?: boolean
  semanticAnchor?: string
  validationTermGroups?: string[][]
  requiresResultValidation?: boolean
  validationFailed?: boolean
  error?: string
}

export interface PrecedentHit {
  id: string
  title: string
  caseNumber?: string
  court?: string
  date?: string
  decisionType?: string
  sourceQuery?: string
  semanticAnchor?: string
  searchMode: PrecedentSearchMode
  outOfRequestedDateRange?: boolean
}

export interface StructuredPrecedentSearchResult {
  originalArgs: SearchPrecedentsInput
  totalCount: number
  page: number
  hits: PrecedentHit[]
  attempts: PrecedentSearchAttempt[]
  fallbackUsed: boolean
  successfulAttempt?: PrecedentSearchAttempt
}

export interface PrecedentSearchContext {
  aiLawArticles?: AiLawArticleSignal[]
  route?: {
    params?: Record<string, unknown>
    pipeline?: Array<{ params?: Record<string, unknown> }>
  }
  documentHints?: string[]
  fallbackPolicy?: "full" | "body" | "none"
  maxFallbackAttempts?: number
  validateResult?: (input: PrecedentSearchValidationInput) => boolean | Promise<boolean>
}

export interface PrecedentSearchValidationInput {
  originalArgs: SearchPrecedentsInput
  attempt: PrecedentSearchAttempt
  hits: PrecedentHit[]
}

interface SearchOnceInput {
  query?: string
  caseNumber?: string
  search: PrecedentSearchMode
  reason: string
  semanticAnchor?: string
  validationTermGroups?: string[][]
  requiresResultValidation?: boolean
  relaxDateRange?: boolean
}

interface SearchOnceResult {
  attempt: PrecedentSearchAttempt
  page: number
  hits: PrecedentHit[]
  rawHits: PrecedentHit[]
}

function cleanDate(date?: string): string | undefined {
  const value = (date || "").replace(/[.\-\s]/g, "")
  return value || undefined
}

function isDateInRange(date: string | undefined, fromDate?: string, toDate?: string): boolean {
  const normalized = cleanDate(date)
  if (!normalized) return true
  if (fromDate && normalized < fromDate) return false
  if (toDate && normalized > toDate) return false
  return true
}

function hasDateRange(args: SearchPrecedentsInput): boolean {
  return !!(args.fromDate || args.toDate)
}

function resultTotalCount(args: SearchPrecedentsInput, attempt: PrecedentSearchAttempt, hits: PrecedentHit[]): number {
  return hasDateRange(args) ? hits.length : attempt.totalCount
}

function toHit(
  item: PrecedentItem,
  sourceQuery: string | undefined,
  searchMode: PrecedentSearchMode,
  semanticAnchor?: string
): PrecedentHit {
  return {
    id: item.판례일련번호,
    title: item.판례명,
    caseNumber: item.사건번호 || undefined,
    court: item.법원명 || undefined,
    date: cleanDate(item.선고일자) || item.선고일자 || undefined,
    decisionType: item.판결유형 || undefined,
    // 판례상세링크는 싣지 않는다 (2026-09-23 리뷰 C5). 업스트림 링크는 요청 키(OC=)를 박은 채
    // &amp; 로 인코딩돼 와서(실측) 찍으면 서버 폴백 키가 새고 링크로도 못 쓴다. 후속 조회는 id 로 한다.
    sourceQuery,
    semanticAnchor,
    searchMode,
  }
}

function attemptKey(input: SearchOnceInput): string {
  if (input.caseNumber) return `case:${input.caseNumber}`
  return `query:${input.search}:${input.query || ""}`
}

function markDateRelaxed(hits: PrecedentHit[], args: SearchPrecedentsInput): PrecedentHit[] {
  return hits.map(hit => ({
    ...hit,
    outOfRequestedDateRange: !isDateInRange(hit.date, args.fromDate, args.toDate),
  }))
}

async function runPrecedentSearchOnce(
  apiClient: LawApiClient,
  args: SearchPrecedentsInput,
  input: SearchOnceInput
): Promise<SearchOnceResult> {
  const extraParams: Record<string, string> = {
    display: String(args.display || 20),
    page: String(args.page || 1),
  }
  if (input.query) extraParams.query = input.query
  if (input.search === 2) extraParams.search = "2"
  if (input.caseNumber) extraParams.nb = input.caseNumber
  if (args.court) extraParams.curt = args.court
  if (args.sort) extraParams.sort = args.sort

  const xmlText = await apiClient.fetchApi({
    endpoint: "lawSearch.do",
    target: "prec",
    extraParams,
    apiKey: args.apiKey,
  })
  const parsed = parsePrecedentXML(xmlText)
  const items = input.caseNumber
    ? parsed.items.filter(item => fieldHasExactCase(item.사건번호 || "", input.caseNumber!))
    : parsed.items
  const rawHits = items.map(item => toHit(item, input.query, input.search, input.semanticAnchor))
  const hits = input.relaxDateRange || !hasDateRange(args)
    ? markDateRelaxed(rawHits, args)
    : rawHits.filter(hit => isDateInRange(hit.date, args.fromDate, args.toDate))

  const attempt: PrecedentSearchAttempt = {
    query: input.query,
    caseNumber: input.caseNumber,
    search: input.search,
    fromDate: args.fromDate,
    toDate: args.toDate,
    reason: input.reason,
    totalCount: input.caseNumber ? items.length : parsed.totalCnt,
    hitCount: hits.length,
    success: hits.length > 0,
    outOfRequestedDateRange: input.relaxDateRange ? hits.some(hit => hit.outOfRequestedDateRange) : undefined,
    semanticAnchor: input.semanticAnchor,
    validationTermGroups: input.validationTermGroups,
    requiresResultValidation: input.requiresResultValidation,
  }

  return {
    attempt,
    page: parsed.page,
    hits,
    rawHits,
  }
}

function exactCaseNumber(args: SearchPrecedentsInput): string | undefined {
  if (args.caseNumber) return args.caseNumber.replace(/\s/g, "")
  if (precedentSearchScope(args) === 2) return undefined
  const query = (args.query || "").replace(/\s/g, "")
  const [caseNo] = extractCaseNumbers(query)
  return caseNo === query ? caseNo : undefined
}

function firstAttempt(args: SearchPrecedentsInput): SearchOnceInput {
  const caseNumber = exactCaseNumber(args)
  const search = precedentSearchScope(args) === 2 ? 2 : 1
  if (caseNumber) {
    return {
      caseNumber,
      search,
      reason: "case_number",
    }
  }

  return {
    query: args.query,
    search,
    reason: "original_query",
  }
}

function fallbackInputs(args: SearchPrecedentsInput, context: PrecedentSearchContext): SearchOnceInput[] {
  const originalQuery = args.query || args.caseNumber || ""
  const inputs: SearchOnceInput[] = []
  const fallbackPolicy = context.fallbackPolicy ?? "full"

  if (fallbackPolicy === "none" || exactCaseNumber(args)) return inputs

  if (args.query && precedentSearchScope(args) !== 2) {
    inputs.push({
      query: args.query,
      search: 2,
      reason: "body_search",
    })
  }

  if (fallbackPolicy === "body") return inputs

  const candidates = buildCompactLegalQueries({
    originalQuery,
    includeOriginal: true,
    caseNumber: args.caseNumber,
    documentHints: context.documentHints,
    aiLawArticles: context.aiLawArticles,
    route: context.route,
    max: context.maxFallbackAttempts ?? 5,
  })

  for (const candidate of candidates) {
    const requiresResultValidation = candidate.requiresResultValidation ||
      candidate.source === "ai_law_article_title" ||
      candidate.source === "ai_law_law_article_title"
    if (candidate.source === "case_number") {
      inputs.push({
        caseNumber: candidate.query,
        search: candidate.search,
        reason: "case_number",
        semanticAnchor: candidate.semanticAnchor,
        validationTermGroups: candidate.validationTermGroups,
        requiresResultValidation,
      })
    } else {
      inputs.push({
        query: candidate.query,
        search: candidate.search,
        reason: candidate.source,
        semanticAnchor: candidate.semanticAnchor,
        validationTermGroups: candidate.validationTermGroups,
        requiresResultValidation,
      })
    }
  }

  return inputs
}

export async function searchPrecedentsStructured(
  apiClient: LawApiClient,
  args: SearchPrecedentsInput,
  context: PrecedentSearchContext = {}
): Promise<StructuredPrecedentSearchResult> {
  const attempts: PrecedentSearchAttempt[] = []
  const seen = new Set<string>()
  let page = args.page || 1
  const dateRelaxationCandidates: SearchOnceResult[] = []

  const run = async (input: SearchOnceInput): Promise<SearchOnceResult | null> => {
    const key = attemptKey(input)
    if (seen.has(key)) return null
    seen.add(key)

    const result = await runPrecedentSearchOnce(apiClient, args, input)
    attempts.push(result.attempt)
    page = result.page

    const validationHits = result.hits.length > 0 ? result.hits : hasDateRange(args) ? result.rawHits : []
    if (validationHits.length > 0 && result.attempt.requiresResultValidation && context.validateResult) {
      try {
        const accepted = await context.validateResult({
          originalArgs: args,
          attempt: result.attempt,
          hits: validationHits,
        })
        if (!accepted) {
          result.attempt.success = false
          result.attempt.hitCount = 0
          result.attempt.validationFailed = true
          result.attempt.error = "validation_failed"
          result.hits = []
        }
      } catch (error) {
        rethrowIfFatal(error)
        result.attempt.success = false
        result.atte
```

### Core Architecture Module: `src/tools/utils.ts`
```
/**
 * parse_jo_code Tool - JO 코드 양방향 변환
 */

import { z } from "zod"
import { DOMParser } from "@xmldom/xmldom"
import type { LawApiClient } from "../lib/api-client.js"
import { truncateResponse } from "../lib/schemas.js"
import { buildJO, buildOrdinanceJO, formatJO } from "../lib/law-parser.js"
import { formatToolError } from "../lib/errors.js"
import { extractTag } from "../lib/xml-parser.js"

export const ParseJoCodeSchema = z.object({
  joText: z.string().describe("변환할 조문 번호 (예: '제38조', '10조의2', '003800', '010000')"),
  direction: z.enum(["to_code", "to_text"]).optional().default("to_code").describe("변환 방향: to_code (한글→코드) 또는 to_text (코드→한글)"),
  lawType: z.enum(["law", "ordinance"]).optional().default("law").describe("법령 유형: law (법률/시행령/시행규칙, AAAABB 형식) 또는 ordinance (자치법규, AABBCC 형식)")
})

export type ParseJoCodeInput = z.infer<typeof ParseJoCodeSchema>

export async function parseJoCode(
  input: ParseJoCodeInput
): Promise<{ content: Array<{ type: string, text: string }>, isError?: boolean }> {
  try {
    let result: string
    const isOrdinance = input.lawType === "ordinance"

    if (input.direction === "to_code") {
      // 한글 → JO 코드
      result = isOrdinance ? buildOrdinanceJO(input.joText) : buildJO(input.joText)
    } else {
      // JO 코드 → 한글
      result = formatJO(input.joText, isOrdinance)
    }

    const formatInfo = isOrdinance
      ? "AABBCC (AA=조문, BB=의X, CC=서브)"
      : "AAAABB (AAAA=조문, BB=의X)"

    const resultText = JSON.stringify({
      input: input.joText,
      output: result,
      direction: input.direction,
      lawType: input.lawType,
      format: formatInfo
    }, null, 2)

    return {
      content: [{
        type: "text",
        text: resultText
      }]
    }
  } catch (error) {
    return formatToolError(error, "parse_jo_code")
  }
}

// get_law_abbreviations 스키마
export const GetLawAbbreviationsSchema = z.object({
  stdDt: z.string().optional().describe("기준 시작일 (YYYYMMDD)"),
  endDt: z.string().optional().describe("기준 종료일 (YYYYMMDD)"),
  apiKey: z.string().optional().describe("법제처 Open API 인증키(OC). 사용자가 제공한 경우 전달")
})

export type GetLawAbbreviationsInput = z.infer<typeof GetLawAbbreviationsSchema>

export async function getLawAbbreviations(
  apiClient: LawApiClient,
  input: GetLawAbbreviationsInput
): Promise<{ content: Array<{ type: string, text: string }>, isError?: boolean }> {
  try {
    const extraParams: Record<string, string> = {
      display: "100", // 최대 100개 — 미전달 시 법제처 기본 20건만 조회됨
    }
    if (input.stdDt) extraParams.stdDt = String(input.stdDt)
    if (input.endDt) extraParams.endDt = String(input.endDt)

    const xmlText = await apiClient.fetchApi({
      endpoint: "lawSearch.do",
      target: "lsAbrv",
      type: "XML",
      extraParams,
      apiKey: input.apiKey
    })

    const parser = new DOMParser()
    const doc = parser.parseFromString(xmlText, "text/xml")

    // 실제 응답의 항목 태그는 <law>다 (<lsAbrv>는 target명일 뿐 요소로 존재하지 않음).
    // 종전엔 lsAbrv를 찾다 0건 → 매 호출 "약칭 데이터가 없습니다" 오류만 반환했다.
    const items = doc.getElementsByTagName("law")
    if (items.length === 0) {
      return {
        content: [{ type: "text", text: "약칭 데이터가 없습니다." }],
        isError: true
      }
    }

    // "총 N건"은 법제처 totalCnt(실측 2,600건+) — 조회 건수를 총계로 쓰면 잘림이 전량으로 위장된다
    const totalCnt = Math.max(parseInt(extractTag(xmlText, "totalCnt") || "0", 10) || 0, items.length)

    let resultText = `법령 약칭 목록 (총 ${totalCnt}건`
    if (totalCnt > items.length) {
      resultText += ` 중 ${items.length}건 조회 — 기간(stdDt/endDt)으로 좁혀 재조회 가능`
    }
    resultText += `):\n\n`

    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      const lawName = item.getElementsByTagName("법령명한글")[0]?.textContent || ""
      const abbr = item.getElementsByTagName("법령약칭명")[0]?.textContent || ""
      const lawId = item.getElementsByTagName("법령ID")[0]?.textContent || ""

      if (lawName || abbr) {
        resultText += `${i + 1}. ${lawName}`
        if (abbr) resultText += ` → 약칭: ${abbr}`
        if (lawId) resultText += ` (ID: ${lawId})`
        resultText += `\n`
      }
    }

    return {
      content: [{ type: "text", text: truncateResponse(resultText) }]
    }
  } catch (error) {
    return formatToolError(error, "get_law_abbreviations")
  }
}

```

### Core Architecture Module: `scripts/verify-annex-runtime.mjs`
```
import { parseAnnexFile } from "../build/lib/annex-file-parser.js"

function minimalPdf(text) {
  const stream = `BT\n/F1 12 Tf\n72 720 Td\n(${text}) Tj\nET\n`
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream`,
  ]

  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  const bytes = new TextEncoder().encode(pdf)
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
}

const result = await parseAnnexFile(minimalPdf("Annex runtime smoke test"))
if (!result.success || result.fileType !== "pdf" || !result.markdown?.includes("Annex runtime smoke test")) {
  throw new Error(`Annex runtime smoke test failed: ${JSON.stringify(result)}`)
}

console.log("annex runtime verified without optional dependencies")

```

### Core Architecture Module: `scripts/verify-package.mjs`
```
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { dirname, relative, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const buildDir = resolve(root, "build")
const sourceDir = resolve(root, "src")
const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"))

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function walk(directory) {
  const entries = []
  for (const name of readdirSync(directory)) {
    const path = resolve(directory, name)
    if (statSync(path).isDirectory()) entries.push(...walk(path))
    else entries.push(path)
  }
  return entries
}

function sourcePathForBuildFile(buildFile) {
  const relativeBuildPath = relative(buildDir, buildFile)
  if (relativeBuildPath.endsWith(".d.ts")) {
    return resolve(sourceDir, relativeBuildPath.slice(0, -".d.ts".length) + ".ts")
  }
  if (relativeBuildPath.endsWith(".js")) {
    return resolve(sourceDir, relativeBuildPath.slice(0, -".js".length) + ".ts")
  }
  return undefined
}

function assertPathInPackage(path, label) {
  const resolved = resolve(root, path)
  assert(resolved === root || resolved.startsWith(`${root}${sep}`), `${label} resolves outside the package.`)
  assert(existsSync(resolved), `${label} is missing from the clean build: ${path}`)
}

function verifyExportTargets(value, label = "exports") {
  if (typeof value === "string") {
    if (value.includes("*")) {
      const prefix = value.slice(0, value.indexOf("*"))
      assertPathInPackage(prefix, label)
    } else {
      assertPathInPackage(value, label)
    }
    return
  }
  if (value && typeof value === "object") {
    for (const [key, target] of Object.entries(value)) verifyExportTargets(target, `${label}.${key}`)
  }
}

function packedFiles() {
  const result = spawnSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: root,
    encoding: "utf8",
  })
  if (result.status !== 0) {
    throw new Error(`npm pack --dry-run failed:\n${result.stderr || result.stdout}`)
  }
  const output = result.stdout.trim()
  const start = output.indexOf("[")
  assert(start >= 0, "npm pack --dry-run did not return JSON.")
  const pack = JSON.parse(output.slice(start))
  assert(Array.isArray(pack) && pack.length === 1 && Array.isArray(pack[0].files), "npm pack --dry-run returned an unexpected file list.")
  return pack[0].files.map(file => file.path)
}

export function verifyPackageArtifacts() {
  assert(existsSync(buildDir), "build/ is missing. Run npm run build before verification.")

  for (const buildFile of walk(buildDir)) {
    const sourceFile = sourcePathForBuildFile(buildFile)
    if (sourceFile) {
      assert(existsSync(sourceFile), `Stale build output has no source module: ${relative(root, buildFile)}`)
    }
  }

  assertPathInPackage(packageJson.main, "main")
  assertPathInPackage(packageJson.types, "types")
  for (const [name, target] of Object.entries(packageJson.bin ?? {})) {
    assertPathInPackage(target, `bin.${name}`)
  }
  verifyExportTargets(packageJson.exports)

  const allowedTopLevel = new Set(["README.md", "LICENSE", "NOTICE", "package.json"])
  const files = packedFiles()
  for (const file of files) {
    assert(file.startsWith("build/") || allowedTopLevel.has(file), `Unexpected packed artifact: ${file}`)
    assert(!file.includes("sse-server"), `Stale server artifact would be published: ${file}`)
  }

  console.log(`package artifacts verified (${files.length} packed files)`)
}

verifyPackageArtifacts()

```

### Core Architecture Module: `src/cli.ts`
```
#!/usr/bin/env node

/**
 * Korean Law CLI v2.0
 * 자연어 한 줄로 모든 법령을 조회하는 프로덕션급 CLI
 *
 * Usage:
 *   korean-law "민법 제1조"                    # 자연어 → 자동 라우팅
 *   korean-law "음주운전 처벌 기준"             # 종합 리서치 자동 실행
 *   korean-law "관세법 개정 이력"               # 개정추적 체인 자동 실행
 *   korean-law search_law --query "민법"       # 직접 도구 호출 (기존 방식)
 *   korean-law list                            # 도구 목록
 *   korean-law interactive                     # 대화형 모드
 */

import { Command } from "commander"
import { pathToFileURL } from "node:url"
import { existsSync, realpathSync } from "node:fs"
import { z } from "zod"
import * as readline from "readline"
import { LawApiClient } from "./lib/api-client.js"
import { allTools } from "./tool-registry.js"
import { explainRoute } from "./lib/route-explain.js"
import { VERSION } from "./version.js"
import {
  fmt, printBanner, formatOutput,
  printInteractiveHelp, printToolList, getCategory,
  extractOptionsFromSchema, coerceValue,
  type CliOption,
} from "./lib/cli-format.js"
import {
  getApiClient, executeTool,
  executeNaturalQuery, executeNaturalQueryJson,
} from "./lib/cli-executor.js"

// ────────────────────────────────────────
// Interactive REPL Mode
// ────────────────────────────────────────

async function runInteractive(): Promise<void> {
  const apiClient = getApiClient()

  printBanner()
  console.log(fmt.green("  대화형 모드 시작"))
  console.log(fmt.dim("  자연어로 법령을 검색하세요. 'exit'로 종료합니다."))
  console.log()
  console.log(fmt.dim("  예시:"))
  console.log(fmt.dim('    > 민법 제1조'))
  console.log(fmt.dim('    > 음주운전 처벌 기준'))
  console.log(fmt.dim('    > 관세법 3단비교'))
  console.log(fmt.dim('    > 건축허가 절차 수수료'))
  console.log()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: fmt.cyan("법령> "),
    historySize: 100,
  })

  const history: string[] = []
  let executing = false // 레이스 컨디션 방지

  rl.prompt()

  rl.on("line", async (line: string) => {
    const input = line.trim()

    if (!input) {
      rl.prompt()
      return
    }

    // 실행 중이면 무시
    if (executing) {
      console.log(fmt.dim("  (이전 쿼리 실행 중...)"))
      return
    }

    // 특수 명령어 (동기 처리)
    if (input === "exit" || input === "quit" || input === "q") {
      console.log(fmt.dim("\n종료합니다."))
      rl.close()
      return
    }

    if (input === "help" || input === "?") {
      printInteractiveHelp()
      rl.prompt()
      return
    }

    if (input === "history") {
      console.log(fmt.bold("\n검색 이력:"))
      history.forEach((h, i) => console.log(fmt.dim(`  ${i + 1}. ${h}`)))
      console.log()
      rl.prompt()
      return
    }

    if (input === "tools" || input === "list") {
      printToolList()
      rl.prompt()
      return
    }

    if (input.startsWith("explain ")) {
      const q = input.slice(8).trim()
      console.log(fmt.dim(explainRoute(q)))
      rl.prompt()
      return
    }

    // 비동기 실행 (입력 일시 중지)
    executing = true
    rl.pause()

    // 직접 도구 호출: @tool_name {...params}
    if (input.startsWith("@")) {
      await handleDirectCall(apiClient, input)
    } else {
      // 자연어 쿼리 실행
      history.push(input)
      console.log()

      try {
        await executeNaturalQuery(apiClient, input, false)
      } catch (error) {
        console.error(fmt.red(`오류: ${error instanceof Error ? error.message : String(error)}`))
      }
    }

    console.log()
    executing = false
    sigintCount = 0
    rl.resume()
    rl.prompt()
  })

  // Ctrl+C: 실행 중이면 중단 알림, 2회 연속 시 강제 종료
  let sigintCount = 0
  rl.on("SIGINT", () => {
    if (executing) {
      sigintCount++
      if (sigintCount >= 2) {
        console.log(fmt.dim("\n강제 종료합니다."))
        process.exit(130)
      }
      console.log(fmt.yellow("\n  (Ctrl+C: 현재 쿼리 완료를 기다립니다. 강제 종료: Ctrl+C x2)"))
    } else {
      console.log(fmt.dim("\n종료합니다."))
      rl.close()
    }
  })

  rl.on("close", () => {
    process.exit(0)
  })
}

async function handleDirectCall(apiClient: LawApiClient, input: string): Promise<void> {
  // @tool_name {"key": "value"} or @tool_name key=value
  const spaceIdx = input.indexOf(" ")
  const toolName = spaceIdx > 0 ? input.slice(1, spaceIdx) : input.slice(1)
  const paramStr = spaceIdx > 0 ? input.slice(spaceIdx + 1).trim() : ""

  let params: Record<string, unknown> = {}
  if (paramStr) {
    try {
      params = JSON.parse(paramStr)
    } catch {
      // key=value 형식 시도
      for (const pair of paramStr.split(/\s+/)) {
        const eqIdx = pair.indexOf("=")
        if (eqIdx > 0) {
          params[pair.slice(0, eqIdx)] = pair.slice(eqIdx + 1).replace(/^["']|["']$/g, "")
        }
      }
    }
  }

  const result = await executeTool(apiClient, toolName, params)
  console.log(formatOutput(result.content.map(c => c.text).join("\n")))
}

// ────────────────────────────────────────
// Program Setup
// ────────────────────────────────────────

export function createProgram(): Command {
  const program = new Command()
    .name("korean-law")
    .description("한국 법령 검색 CLI - 자연어 한 줄로 모든 법령 조회")
    .version(VERSION)

  // ── 자연어 쿼리 (기본 명령) ──
  program
    .command("query <question...>")
    .alias("q")
    .description("자연어로 법령 조회 (예: korean-law query 민법 제1조)")
    .option("-v, --verbose", "라우팅 상세 정보 출력")
    .option("--json", "JSON 형식으로 출력")
    .action(async (words: string[], opts: { verbose?: boolean; json?: boolean }) => {
      const apiClient = getApiClient()
      const query = words.join(" ")

      if (opts.json) {
        await executeNaturalQueryJson(apiClient, query)
        return
      }

      await executeNaturalQuery(apiClient, query, opts.verbose || false)
    })

  // ── 대화형 모드 ──
  program
    .command("interactive")
    .alias("i")
    .description("대화형 법령 검색 모드 (REPL)")
    .action(async () => {
      await runInteractive()
    })

  // ── explain (라우팅 경로 확인) ──
  program
    .command("explain <question...>")
    .description("자연어 질의의 라우팅 경로 확인 (실행하지 않음)")
    .action((words: string[]) => {
      const query = words.join(" ")
      console.log(explainRoute(query))
    })

  // ── list 명령 ──
  program
    .command("list")
    .alias("ls")
    .description("사용 가능한 도구 목록")
    .option("-c, --category <category>", "카테고리 필터 (예: 판례, 법령, 비교)")
    .option("--json", "JSON 형식으로 출력")
    .action((opts: { category?: string; json?: boolean }) => {
      let tools = allTools

      if (opts.category) {
        tools = tools.filter(t =>
          getCategory(t).includes(opts.category!)
        )
      }

      if (opts.json) {
        const data = tools.map(t => ({
          name: t.name,
          category: getCategory(t),
          description: t.description
        }))
        console.log(JSON.stringify(data, null, 2))
        return
      }

      printBanner()
      printToolList(tools)
      console.log(fmt.dim("  사용법: korean-law <도구명> [옵션]"))
      console.log(fmt.dim("  자연어: korean-law query \"민법 제1조\""))
      console.log(fmt.dim("  대화형: korean-law interactive"))
      console.log()
    })

  // ── help <tool> 명령 ──
  program
    .command("help <tool-name>")
    .description("도구 상세 도움말")
    .action((toolName: string) => {
      const tool = allTools.find(t => t.name === toolName)
      if (!tool) {
        console.error(fmt.red(`알 수 없는 도구: ${toolName}`))
        console.error(fmt.dim(`'korean-law list'로 사용 가능한 도구를 확인하세요.`))
        process.exit(1)
      }

      const options = extractOptionsFromSchema(tool.schema)

      console.log()
      console.log(fmt.bold(tool.name))
      console.log("─".repeat(tool.name.length))
      console.log(tool.description)
      console.log()

      if (options.length > 0) {
        console.log(fmt.bold("파라미터:"))
        for (const opt of options) {
          const reqLabel = opt.required ? fmt.red("(필수)") : fmt.dim("(선택)")
          const defLabel = opt.defaultValue !== undefined ? fmt.dim(` [기본값: ${opt.defaultValue}]`) : ""
          console.log(`  --${fmt.cyan(opt.name.padEnd(20))} ${reqLabel} ${opt.description}${defLabel}`)
        }
        console.log()
      }

      const example = options
        .filter(o => o.required && o.name !== "apiKey")
        .map(o => `--${o.name} "<값>"`)
        .join(" ")
      console.log(fmt.dim(`예시: korean-law ${tool.name} ${example}`))
      console.log()
    })

  // ── 도구를 동적으로 서브커맨드 등록 ──
  for (const tool of allTools) {
    const cmd = program
      .command(tool.name)
      .description(tool.description)

    const options = extractOptionsFromSchema(tool.schema)

    for (const opt of options) {
      const flag = opt.type === "boolean"
        ? `--${opt.name}`
        : `--${opt.name} <value>`

      if (opt.required) {
        // Required fields are validated by Zod after JSON input or flags are assembled.
        cmd.option(flag, opt.description)
      } else {
        if (opt.defaultValue !== undefined) {
          cmd.option(flag, opt.description, String(opt.defaultValue))
        } else {
          cmd.option(flag, opt.description)
        }
      }
    }

    cmd.option("--json-input <json>", "JSON 문자열로 전체 파라미터 전달")

    cmd.action(async (cmdOpts: Record<string, string | boolean>) => {
      let input: Record<string, unknown>

      if (cmdOpts.jsonInput) {
        try {
          input = JSON.parse(String(cmdOpts.jsonInput))
        } catch {
          console.error(fmt.red("--json-input 파싱 실패: 유효한 JSON을 입력하세요."))
          process.exit(1)
        }
      } else {
        input = {}
        for (const opt of options) {
          const val = cmdOpts[opt.name]
          if (val !== undefined) {
            input[opt.name] = coerceValue(val, opt.type)
          }
        }
      }

      try {
        const parsed = tool.schema.parse(input)
        const apiKey = (typeof input?.apiKey === "string" && input.apiKey) || cmdOpts.apiKey || process.env.LAW_OC || ""
        if (typeof apiKey !== "string" || !apiKey) {
          console.error(fmt.red("LAW_OC 환경변수 또는 apiKey 파라미터가 필요합니다."))
          process.exit(1)
        }
        const apiClient = new LawApiClient({ apiKey }
```

### Core Architecture Module: `src/index.ts`
```
#!/usr/bin/env node

/**
 * Korean Law MCP Server
 * 국가법령정보센터 API 기반 MCP 서버
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { AjvJsonSchemaValidator } from "@modelcontextprotocol/sdk/validation/ajv-provider.js"
import { LawApiClient } from "./lib/api-client.js"
import { registerTools } from "./tool-registry.js"
import { startHTTPServer } from "./server/http-server.js"
import { parseHttpPort } from "./server/http-config.js"
import { readExecutionLimits, type ExecutionLimits } from "./lib/execution-limits.js"
import { VERSION } from "./version.js"

// API 클라이언트 초기화 (LAW_OC 또는 KOREAN_LAW_API_KEY 지원)
const LAW_OC = process.env.LAW_OC || process.env.KOREAN_LAW_API_KEY || ""
const apiClient = new LawApiClient({ apiKey: LAW_OC })

// Server 는 옵션이 없으면 인스턴스마다 Ajv 검증기를 새로 만든다(elicitation 전용, 이 서버는
// 안 쓴다). HTTP 모드는 POST 마다 Server 를 만드므로 하나를 공유한다: createServer 37.7µs →
// 1.3µs, 요청당 garbage 약 18KB 감소(2026-09-23 리뷰 A9 실측).
const jsonSchemaValidator = new AjvJsonSchemaValidator()

// MCP 서버 팩토리 (HTTP 모드: 세션마다 새 인스턴스 필요)
function createServer(executionLimits: ExecutionLimits = readExecutionLimits()): Server {
  const s = new Server(
    { name: "korean-law", version: VERSION },
    { capabilities: { tools: {} }, jsonSchemaValidator }
  )
  registerTools(s, apiClient, executionLimits)
  return s
}

// 서버 시작
async function main() {
  const args = process.argv.slice(2)

  // setup 서브커맨드: npx korean-law-mcp setup
  if (args[0] === "setup") {
    const { runSetup } = await import("./setup.js")
    await runSetup()
    return
  }

  const modeIndex = args.indexOf("--mode")
  const mode = modeIndex !== -1 ? args[modeIndex + 1] : "stdio"
  const portIndex = args.indexOf("--port")
  const port = parseHttpPort(portIndex !== -1 ? args[portIndex + 1] : undefined)

  if (mode === "http" || mode === "sse") {
    await startHTTPServer(createServer, port)
  } else {
    // STDIO 모드
    // stdout 오염 방지: MCP JSON-RPC 프로토콜 보호
    const stderrWrite = (...args: unknown[]) =>
      process.stderr.write(args.map(String).join(" ") + "\n")
    console.log = console.warn = console.info = console.debug = stderrWrite
    const server = createServer()
    const transport = new StdioServerTransport()
    await server.connect(transport)
  }
}

main().catch((error) => {
  console.error("Server error:", error)
  process.exit(1)
})

```

### Core Architecture Module: `src/lib/abolished-laws.ts`
```
/**
 * 폐지 법령·행정규칙 감지 — search_law / search_admin_rule 보조.
 *
 * 폐지된 법령은 현행(target=law) 검색에, 폐지된 행정규칙은 admrul 기본(nw=1)
 * 검색에 잡히지 않아 LLM이 "존재하지 않는 규정"으로 오판한다
 * (「월별납부제도 운영에 관한 고시」 사례 — 2024-12-11 폐지,
 * 「징수업무 처리에 관한 고시」로 통·폐합됐는데 "검색 결과 없음"으로 안내).
 * 법령은 eflaw(연혁 포함), 행정규칙은 nw=2 보조검색으로 폐지 이력을 찾아
 * 폐지 사실·폐지사유·후속(통합) 규정으로 안내한다.
 */

import type { LawApiClient } from "./api-client.js"
import { lawCache } from "./cache.js"
import { extractTag } from "./xml-parser.js"
import { normalizeAliasKey } from "./search-normalizer.js"
import { rethrowIfFatal } from "./fatal-errors.js"

const fmtDate = (d: string) => (d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : d)

/** 법제처 LIKE 검색이 무관 목록을 반환할 때가 있어 이름-쿼리 포함관계로 걸러낸다 */
function isRelated(name: string, query: string): boolean {
  const nk = normalizeAliasKey(name)
  const qk = normalizeAliasKey(query)
  if (!nk || !qk) return false
  return nk.includes(qk) || qk.includes(nk)
}

// ========== 법령 (target=eflaw) ==========

export interface AbolishedLaw {
  name: string
  lawId: string
  mst: string
  effDate: string // 폐지 시행일자
  revisionType: string // "폐지" | "타법폐지"
  lawType: string
}

/** eflaw 검색 XML에서 법령ID별 최신 이력을 골라 폐지 확정된 것만 추출 */
export function parseAbolishedLawsXml(xmlText: string, query: string): AbolishedLaw[] {
  interface Rec { name: string; lawId: string; mst: string; effDate: string; revisionType: string; lawType: string }
  const latestById = new Map<string, Rec>()
  const lawRegex = /<law[^>]*>([\s\S]*?)<\/law>/g
  let m
  while ((m = lawRegex.exec(xmlText)) !== null) {
    const c = m[1]
    const lawId = extractTag(c, "법령ID")
    if (!lawId) continue
    const rec: Rec = {
      name: extractTag(c, "법령명한글"),
      lawId,
      mst: extractTag(c, "법령일련번호"),
      effDate: extractTag(c, "시행일자"),
      revisionType: extractTag(c, "제개정구분명"),
      lawType: extractTag(c, "법령구분명"),
    }
    const prev = latestById.get(lawId)
    if (!prev || rec.effDate > prev.effDate) latestById.set(lawId, rec)
  }
  // 최신 이력이 폐지·타법폐지인 법령만 — 현행이 살아있는 법령은 여기서 자연 탈락
  return [...latestById.values()]
    .filter((r) => (r.revisionType === "폐지" || r.revisionType === "타법폐지") && isRelated(r.name, query))
    .sort((a, b) => (a.name < b.name ? -1 : 1))
}

/** 폐지 법령 조회 — 보조 정보이므로 실패는 전파하지 않고 빈 배열 */
export async function findAbolishedLaws(
  apiClient: LawApiClient,
  query: string,
  apiKey?: string
): Promise<AbolishedLaw[]> {
  const cacheKey = `abolished-law:${query.toLowerCase().trim()}`
  const cached = lawCache.get<AbolishedLaw[]>(cacheKey)
  if (cached) return cached
  try {
    const xml = await apiClient.searchLaw(query, apiKey, 50, "eflaw")
    const parsed = parseAbolishedLawsXml(xml, query)
    lawCache.set(cacheKey, parsed, 60 * 60 * 1000)
    return parsed
  } catch (error) {
    // 예산 소진·취소까지 "폐지 이력 없음"으로 삼키지 않는다(2026-09-23 리뷰)
    rethrowIfFatal(error)
    return []
  }
}

export function buildAbolishedLawNotes(query: string, abolished: AbolishedLaw[]): string {
  if (abolished.length === 0) return ""
  const lines = [`[폐지] '${query}' — 현행 법령 0건. 폐지된 법령이 확인됩니다:`, ""]
  abolished.slice(0, 5).forEach((a, i) => {
    lines.push(`${i + 1}. ${a.name} [${a.lawType || "법령"}] — ${a.revisionType}, 최종 시행 ${fmtDate(a.effDate)} (MST ${a.mst})`)
  })
  const first = abolished[0]
  lines.push("")
  lines.push(`💡 폐지 경위·대체 법령은 get_law_text(mst="${first.mst}", efYd="${first.effDate}")의 부칙·개정문에서 확인하세요 (타법폐지면 부칙 표제에 폐지시킨 법률명이 나옵니다).`)
  lines.push("⚠️ 폐지된 법령을 현행 기준으로 인용하지 마세요. 답변에는 폐지 사실을 명시하고, 해당 제도의 현행 근거는 대체 법령명으로 재검색해 확인하세요.")
  return lines.join("\n") + "\n"
}

// ========== 행정규칙 (target=admrul, nw=2) ==========

interface AdmRuleHistoryHit {
  name: string
  seq: string // 행정규칙일련번호 (get_admin_rule의 id)
  ruleId: string // 행정규칙ID — 개명을 넘어 유지되는 그룹핑 키
  promDate: string // 발령일자
  revisionType: string // 제개정구분명
  statusCode: string // 현행연혁구분
  ruleType: string
  orgName: string
}

export function parseAdmrulHistoryXml(xmlText: string): AdmRuleHistoryHit[] {
  const out: AdmRuleHistoryHit[] = []
  const regex = /<admrul[^>]*>([\s\S]*?)<\/admrul>/g
  let m
  while ((m = regex.exec(xmlText)) !== null) {
    const c = m[1]
    out.push({
      name: extractTag(c, "행정규칙명"),
      seq: extractTag(c, "행정규칙일련번호"),
      ruleId: extractTag(c, "행정규칙ID"),
      promDate: extractTag(c, "발령일자"),
      revisionType: extractTag(c, "제개정구분명"),
      statusCode: extractTag(c, "현행연혁구분"),
      ruleType: extractTag(c, "행정규칙종류"),
      orgName: extractTag(c, "소관부처명"),
    })
  }
  return out
}

/** 폐지 레코드 본문 XML에서 제개정이유(폐지사유) 추출 */
export function extractAbolitionReason(xmlText: string): string {
  const block = xmlText.match(/<제개정이유>([\s\S]*?)<\/제개정이유>/)?.[1] || ""
  const cdata = [...block.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)].map((m) => m[1].trimEnd())
  const text = cdata.filter((l) => l.trim().length > 0).join("\n").trim()
  return text.length > 700 ? text.slice(0, 700) + "…" : text
}

/**
 * 폐지사유 문장에서 후속(통합) 규정명 추출.
 * "…을 「징수업무 처리에 관한 고시」로 통ㆍ폐합하여…" 패턴 — 통합·이관·흡수·대체 앞의 「」명.
 */
export function extractSuccessorNames(reason: string, excludeNames: string[]): string[] {
  const exclude = new Set(excludeNames.map(normalizeAliasKey))
  const out: string[] = []
  const regex = /「([^」]{2,60})」\s*(?:으로|로|에)\s*(?:통\s*[ㆍ·]?\s*폐합|통합|이관|흡수|대체)/g
  let m
  while ((m = regex.exec(reason)) !== null) {
    const name = m[1].trim()
    if (exclude.has(normalizeAliasKey(name))) continue
    if (!out.includes(name)) out.push(name)
  }
  return out
}

/**
 * 현행 0건인 행정규칙 쿼리에서 폐지·제명변경 이력을 찾아 안내문 생성.
 * 해당 없으면 null (상위에서 기존 noResultHint로 폴백).
 */
export async function detectAbolishedAdminRule(
  apiClient: LawApiClient,
  query: string,
  apiKey?: string
): Promise<string | null> {
  const cacheKey = `abolished-admrul:${query.toLowerCase().trim()}`
  const cached = lawCache.get<string>(cacheKey)
  if (cached !== null) return cached || null // "" = 해당없음 네거티브 캐시
  let result: string | null = null
  try {
    const xml = await apiClient.searchAdminRule({ query, nw: "2", apiKey })
    const hits = parseAdmrulHistoryXml(xml)

    // 행정규칙ID로 그룹핑 (개명을 넘어 동일 규칙 추적), 발령일자 오름차순
    const groups = new Map<string, AdmRuleHistoryHit[]>()
    for (const h of hits) {
      const key = h.ruleId || normalizeAliasKey(h.name)
      if (!key) continue
      const g = groups.get(key) || []
      g.push(h)
      groups.set(key, g)
    }

    for (const g of groups.values()) {
      g.sort((a, b) => (a.promDate < b.promDate ? -1 : 1))
      const latest = g[g.length - 1]
      // 쿼리 연관성: 과거 명칭 포함 어느 버전이든 일치하면 같은 규칙으로 본다
      if (!g.some((h) => isRelated(h.name, query))) continue

      if (latest.revisionType === "폐지") {
        result = await buildAbolishedAdminRuleNote(apiClient, query, g, apiKey)
        break
      }
      // 현행이 살아있는데 현행 검색이 0건이었다면 제명변경(구명칭 검색) 케이스
      if (latest.statusCode === "현행" && !isRelated(latest.name, query)) {
        result =
          `[제명변경] '${query}' — 현행 행정규칙 0건. 같은 규칙이 명칭 변경되어 현행입니다:\n\n` +
          `「${g.find((h) => isRelated(h.name, query))?.name || query}」 → 「${latest.name}」 (${latest.ruleType}, ${latest.orgName}, 발령 ${fmtDate(latest.promDate)})\n\n` +
          `💡 execute_tool(tool_name="get_admin_rule", params={id:"${latest.seq}"}) 또는 execute_tool(tool_name="search_admin_rule", params={query:"${latest.name}"})로 현행본을 조회하세요.\n`
        break
      }
    }
  } catch {
    return null
  }
  lawCache.set(cacheKey, result || "", 60 * 60 * 1000)
  return result
}

async function buildAbolishedAdminRuleNote(
  apiClient: LawApiClient,
  query: string,
  history: AdmRuleHistoryHit[],
  apiKey?: string
): Promise<string> {
  const latest = history[history.length - 1] // 폐지 레코드
  const prev = history.length >= 2 ? history[history.length - 2] : null

  const lines = [
    `[폐지] '${query}' — 현행 행정규칙 0건. 폐지된 행정규칙입니다:`,
    "",
    `「${latest.name}」 (${latest.ruleType}, ${latest.orgName}) — ${fmtDate(latest.promDate)} 폐지`,
  ]
  if (prev) {
    lines.push(`   - 폐지 직전 버전: 행정규칙일련번호 ${prev.seq} (발령 ${fmtDate(prev.promDate)}) — 폐지 전 본문이 필요하면 execute_tool(tool_name="get_admin_rule", params={id:"${prev.seq}"})`)
  }

  // 폐지 레코드 본문에서 폐지사유·후속 규정 추출 (실패해도 폐지 안내 자체는 유지)
  let successors: string[] = []
  try {
    const bodyXml = await apiClient.getAdminRule(latest.seq, apiKey)
    const reason = extractAbolitionReason(bodyXml)
    if (reason) {
      lines.push("", "폐지사유(제개정이유):", ...reason.split("\n").map((l) => `   ${l}`))
      successors = extractSuccessorNames(reason, history.map((h) => h.name))
    }
  } catch { /* 보조 정보 — 무시 */ }

  lines.push("")
  if (successors.length > 0) {
    lines.push(`💡 후속(통합) 규정: ${successors.map((s) => `「${s}」`).join(", ")} — execute_tool(tool_name="search_admin_rule", params={query:"${successors[0]}"})로 현행 규정을 조회해 그 기준으로 답변하세요.`)
  } else {
    lines.push(`💡 후속 규정 자동 추출 실패 — 위 폐지사유를 근거로 후속·통합 규정을 확인하거나, 소관부처(${latest.orgName})의 제도 키워드로 search_admin_rule 재검색하세요.`)
  }
  lines.push("⚠️ 폐지된 행정규칙을 현행 기준으로 인용하지 마세요. 답변에는 폐지 사실과 후속 규정을 명시하세요.")
  return lines.join("\n") + "\n"
}

```

### Core Architecture Module: `src/lib/admin-rule-articles.ts`
```
/**
 * 행정규칙 전문 텍스트 → 조문 배열 파서 (#admrul 부분 조회)
 *
 * 법제처 admrul 상세는 법령(target=law)과 달리 JO 파라미터가 없고
 * 전문이 <조문내용> 통짜 텍스트(외국환거래규정 기준 18.8만 자)로만 온다 — 실측 확정.
 * 따라서 조문 단위 조회는 서버가 전문을 파싱해서 제공해야 한다.
 *
 * 조문 번호 체계 2종을 모두 다룬다:
 *  - 하이픈형: 제9-5조, 제2-6조의2  (외국환거래규정 등 — 장 번호가 조 번호 앞자리)
 *  - 일반형:   제10조, 제10조의2
 * jo·chapter 입력 정규화와 조문 찾기는 admin-rule-jo.ts.
 */
import { toKey, structKey } from "./admin-rule-jo.js"
// 공개 경로(./lib/admin-rule-articles) 하위호환 — 입력 정규화·조문 찾기가 admin-rule-jo.ts 로 옮겨 갔다
export { normalizeAdminJo, normalizeChapter, findArticle } from "./admin-rule-jo.js"

export interface AdminRuleArticle {
  /** 정규화 키: "9-5" | "9-5의2" | "10" | "10의2" */
  key: string
  /** 비교용 튜플 (main, branch, ui) — 단조증가 검사에 사용 */
  ord: [number, number, number]
  /** 헤더 라인 원문 (제목 포함) */
  label: string
  /** 헤더 포함 본문 라인들 */
  lines: string[]
  /** 소속 장 키: "9" | "11의2" (장 헤더가 없으면 "") */
  chapter: string
  /** 소속 편 키: "4" | "4의2" (편 헤더가 없으면 "") — 편마다 장 번호가 1부터 다시 시작하므로 장은 (편, 장)으로 가린다 */
  part: string
}

export interface AdminRuleChapter {
  /** 이 장이 속한 편 키 (편 없으면 "") */
  part: string
  key: string
  /** 장 헤더 라인 원문 */
  title: string
}

export interface ParsedAdminRule {
  articles: AdminRuleArticle[]
  chapters: AdminRuleChapter[]
  /** 편 헤더 (편 체계가 없으면 빈 배열) */
  parts: Array<{ key: string, title: string }>
  /** 첫 조문 이전의 서문 라인들 */
  preamble: string[]
}

/**
 * 조문 헤더 판정 (라인 시작 앵커).
 * 허용 꼬리: "(", "<", 전각 괄호, 라인 끝, 공백, 원문자 항 번호.
 * "…제9-5조제3항의 규정에 의한…" 같은 본문 중간 참조는 ^ 앵커 + 단조증가 검사로 걸러진다.
 */
const HEADER_RE = /^제(\d+)(?:-(\d+))?조(?:의(\d+))?(?=$|[\s(（<①-㊿])/u
// "제11장의2"·"제4편의2" 처럼 가지 번호가 붙은 헤더도 있다(금융투자업규정 실측)
const CHAPTER_RE = /^제(\d+)장(?:의(\d+))?(?=$|[\s(（])/u
const PART_RE = /^제(\d+)편(?:의(\d+))?(?=$|[\s(（])/u
const SECTION_RE = /^제\d+(?:절|관)(?:의\d+)?(?=$|[\s(（])/u

function ordCompare(a: [number, number, number], b: [number, number, number]): number {
  return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
}

/**
 * 전문 라인 스캔 파서.
 * 새 조문 헤더는 직전 조문보다 번호가 커야 한다(단조증가) — 하이픈형은 장 번호가
 * 조 번호 앞자리에 포함되므로 전체 단조증가가 성립하고, 일반형도 마찬가지다.
 * 위배되는 헤더 모양 라인은 본문(인용문 등)으로 취급한다.
 */
export function parseAdminRuleArticles(body: string): ParsedAdminRule {
  const lines = body.split(/\r?\n/u)
  const articles: AdminRuleArticle[] = []
  const chapters: AdminRuleChapter[] = []
  const parts: ParsedAdminRule["parts"] = []
  const preamble: string[] = []
  let cur: AdminRuleArticle | null = null
  let curChapter = ""
  let curPart = ""
  let lastOrd: [number, number, number] | null = null
  // 조문 사이에 끼는 절 헤더 등 — 다음 조문 앞에 붙여 부분 조회에서 유실되지 않게 한다
  let pending: string[] = []

  for (const rawLine of lines) {
    // 2026-09-23 리뷰 C7: `/\s+$/u` 는 라인 안 공백 덩어리에서 제곱이다(10만 자 13초).
    // trimEnd 는 같은 공백 집합을 선형으로 지운다.
    const line = rawLine.trimEnd()
    const trimmed = line.trim()

    // 헤더 판정은 원 라인 기준(^ 앵커) — 들여쓰기된 라인은 본문이다.
    // 실측(외국환거래규정 1,943라인)상 조문·장 헤더는 전부 들여쓰기 0이고,
    // trim 후 판정하면 "  제9-9조 제1항…" 같은 본문 참조가 헤더로 오인될 수 있다.
    // 편 헤더: 새 편의 조문은 앞 편의 마지막 장을 물려받지 않는다(제4편의2 처럼 장 없는 편이 있다)
    const pt = PART_RE.exec(line)
    if (pt) {
      curPart = structKey(pt[1], pt[2])
      curChapter = ""
      parts.push({ key: curPart, title: trimmed })
      cur = null
      lastOrd = null
      continue
    }

    const ch = CHAPTER_RE.exec(line)
    if (ch) {
      curChapter = structKey(ch[1], ch[2])
      chapters.push({ part: curPart, key: curChapter, title: trimmed })
      cur = null // 장 헤더는 어느 조문에도 속하지 않는다
      // 장마다 조 번호가 1부터 다시 시작하는 체계(제2장 제1조 등)에서 조문이 통째로
      // 유실되지 않도록 단조증가 기준을 장 단위로 리셋한다
      lastOrd = null
      continue
    }

    const h = HEADER_RE.exec(line)
    if (h) {
      const ord: [number, number, number] = [Number(h[1]), h[2] ? Number(h[2]) : 0, h[3] ? Number(h[3]) : 0]
      if (lastOrd === null || ordCompare(ord, lastOrd) > 0) {
        cur = {
          key: toKey(ord[0], ord[1], ord[2]),
          ord,
          label: trimmed,
          lines: pending.length ? [...pending, line] : [line],
          chapter: curChapter,
          part: curPart,
        }
        pending = []
        // 하이픈형에서 장 헤더가 생략된 경우 조 번호 앞자리를 장으로 삼는다
        // (편이 있는 규칙은 앞자리가 편 번호다 — 금융투자업규정 제4-50조는 제4편)
        if (!curChapter && !curPart && ord[1] > 0) cur.chapter = String(ord[0])
        articles.push(cur)
        lastOrd = ord
        continue
      }
      // 번호가 역행 → 본문 중간 인용으로 간주하고 현재 조문에 붙인다
    }

    // 절·관 헤더는 다음 조문 앞에 붙인다. 현재 조문에 두면 그 조문이 다음 절 제목으로 끝났고
    // (외국환거래규정 40개조), 첫 조문 앞이면 서문으로 빠졌다
    if (SECTION_RE.test(line)) {
      pending.push(line)
      cur = null
      continue
    }

    if (cur) cur.lines.push(line)
    else if (!trimmed) continue
    else if (articles.length || pending.length) pending.push(line) // 떠도는 라인 = 절 헤더 뒤 등
    else preamble.push(line)
  }

  if (pending.length) {
    if (articles.length) articles[articles.length - 1].lines.push(...pending)
    else preamble.push(...pending) // 조문이 하나도 없으면 서문으로 (유실 금지)
  }

  return { articles, chapters, parts, preamble }
}

```

### Core Architecture Module: `src/lib/admin-rule-doc.ts`
```
/**
 * 행정규칙 상세 XML → get_admin_rule·신구대조 폴백이 쓰는 값만 뽑은 문서. `admrulxml:` 캐시 값이다.
 *
 * 캐시 값이 XML 원문이면 적중해도 매번 DOM 을 새로 만들고 조문을 다시 파싱했다 — 보험업감독업무시행세칙
 * (XML 313만 자)은 캐시 적중 jo 한 번에 약 1초 이벤트 루프를 막았다(2026-10-01 감사). 부분 조회는 같은 규칙을
 * 여러 번 부르는 용도라 누적된다. 그래서 파싱은 받을 때 한 번, 조문 파싱은 첫 부분 조회 때 한 번만 한다.
 */
import { DOMParser } from "@xmldom/xmldom"
import type { LawApiClient } from "./api-client.js"
import { analyzeImageOnlyBody, markInlineImages, type ImageOnlyBody } from "./image-only-body.js"
import { parseAdminRuleArticles, type ParsedAdminRule } from "./admin-rule-articles.js"
import type { ExtraBlock } from "./admin-rule-keyword.js"
import { adminRuleXmlCache, adminRuleCacheKey, ADMIN_RULE_CACHE_TTL_MS } from "./admin-rule-views.js"

export interface AdminRuleDoc {
  /** 행정규칙명 원문 — 비면 식별자 오류(행정규칙ID 를 넘긴 경우 등) */
  ruleName: string
  promDate: string
  /** 발령일자 (신구대조 폴백 머리말) */
  issuedDate: string
  promNo: string
  orgName: string
  ruleType: string
  joForm: string
  efDate: string
  revision: string
  isCurrent: string
  /** <조문내용> 태그 수 */
  joTagCount: number
  /** 비어 있지 않은 <조문내용>이 있는가 */
  hasContent: boolean
  /** 비어 있지 않은 조문내용(이미지 표식 치환)을 빈 줄로 이은 것 — 부분 조회의 파싱 대상 */
  articlesText: string
  /** <부칙내용> 태그가 있으면 비어 있지 않은 내용들, 없으면 null */
  addenda: string[] | null
  /** <별표내용> 태그가 있으면 [제목, 내용(이미지 표식 치환)] 들, 없으면 null */
  annexes: Array<{ title: string, content: string }> | null
  /** 첨부파일링크 원문(빈 값 포함 — 출력 번호를 종전과 맞춘다) */
  attachmentLinks: string[]
  attachments: Array<{ name: string, link: string }>
  imgInfo: ImageOnlyBody
  /** 제·개정이유 (신구대조 폴백) */
  revisionReason: string
  /** 조문 파싱 결과 — 첫 부분 조회 때 채운다 */
  parsed?: ParsedAdminRule
}

type XmlDoc = ReturnType<InstanceType<typeof DOMParser>["parseFromString"]>

const first = (doc: XmlDoc, tag: string) => doc.getElementsByTagName(tag)[0]?.textContent || ""
const all = (doc: XmlDoc, tag: string): string[] => {
  const nodes = doc.getElementsByTagName(tag)
  const out: string[] = []
  for (let i = 0; i < nodes.length; i++) out.push(nodes[i].textContent || "")
  return out
}

function parseAdminRuleXml(xmlText: string): AdminRuleDoc {
  const doc = new DOMParser().parseFromString(xmlText, "text/xml")
  const joRaw = all(doc, "조문내용").map(t => t.trim())
  const annexRaw = all(doc, "별표내용").map(t => t.trim())
  const annexTitles = all(doc, "별표제목").map(t => t.trim())
  const addendaRaw = all(doc, "부칙내용").map(t => t.trim())
  const links = all(doc, "첨부파일링크")
  const names = all(doc, "첨부파일명")
  const articleParts = joRaw.filter(Boolean)
  // xmldom 이 주는 텍스트는 원문 XML 의 조각(sliced string)이라 그대로 캐시하면 XML 전체가 함께 남는다 —
  // 실측: 큰 규칙 5건에서 XML 만 둘 때보다 6.7MB 더 붙잡았다. 복제해 원문과 끊는다.
  return structuredClone({
    ruleName: first(doc, "행정규칙명").trim(),
    // 상세 응답의 실제 태그는 발령일자/발령번호 (공포일자는 없는 경우가 많다 — 실측)
    promDate: first(doc, "공포일자") || first(doc, "발령일자"),
    issuedDate: first(doc, "발령일자").trim(),
    promNo: first(doc, "발령번호"),
    orgName: first(doc, "소관부처") || first(doc, "소관부처명"),
    ruleType: first(doc, "행정규칙종류"),
    joForm: first(doc, "조문형식여부").trim(),
    efDate: first(doc, "시행일자").trim(),
    revision: first(doc, "제개정구분명").trim(),
    isCurrent: first(doc, "현행여부").trim(),
    joTagCount: joRaw.length,
    hasContent: articleParts.length > 0,
    articlesText: articleParts.map(markInlineImages).join("\n\n"),
    addenda: addendaRaw.length ? addendaRaw.filter(Boolean) : null,
    annexes: annexRaw.length ? annexRaw.map((c, i) => ({ title: annexTitles[i] || "", content: c ? markInlineImages(c) : "" })) : null,
    attachmentLinks: links,
    attachments: links.map((l, i) => ({ name: names[i]?.trim() || `첨부 ${i + 1}`, link: l.trim() })).filter(a => a.link),
    // 이미지-only 판정은 표식 치환 전 원문으로 (#159)
    imgInfo: analyzeImageOnlyBody(`${articleParts.join("\n")}\n${annexRaw.filter(Boolean).join("\n")}`),
    revisionReason: all(doc, "제개정이유내용").map(t => t.trim()).filter(Boolean).join("\n"),
  })
}

/** 부칙·별표 출력 (종전 전문 출력과 같은 모양) */
export function adminRuleExtrasText(d: AdminRuleDoc): string {
  let text = ""
  if (d.addenda) {
    text += `\n---\n부칙\n---\n\n`
    for (const c of d.addenda) text += `${c}\n\n`
  }
  if (d.annexes) {
    text += `\n---\n별표\n---\n\n`
    for (const a of d.annexes) {
      if (a.title) text += `[${a.title}]\n`
      if (a.content) text += `${a.content}\n\n`
    }
  }
  return text
}

/** keyword 가 조문에서 못 찾으면 이어 찾는 부칙·별표 블록 */
export function adminRuleExtraBlocks(d: AdminRuleDoc): ExtraBlock[] {
  const firstLine = (s: string) => s.split("\n", 1)[0].trim().slice(0, 60)
  const blocks: ExtraBlock[] = (d.addenda ?? []).map(c => ({ label: firstLine(c), text: c }))
  for (const a of d.annexes ?? []) {
    if (!a.content) continue
    blocks.push(a.title ? { label: `[${a.title}]`, text: `[${a.title}]\n${a.content}` } : { label: firstLine(a.content), text: a.content })
  }
  return blocks
}

/** 조문 파싱 결과 — 문서(캐시 값)에 한 번만 만들어 둔다 */
export function adminRuleParsed(d: AdminRuleDoc): ParsedAdminRule {
  d.parsed ??= parseAdminRuleArticles(d.articlesText)
  return d.parsed
}

/**
 * 캐시 → 없으면 조회·파싱 후 캐시. applicable_law 행정규칙 갈래는 예산 소진·취소를 공개 도구 밖에서 받으려고
 * XML 문자열을 먼저 넣어 둔다 — 그 값을 만나면 파싱해 문서로 바꿔 넣는다.
 */
export async function loadAdminRuleDoc(apiClient: LawApiClient, id: string, apiKey?: string): Promise<AdminRuleDoc> {
  const key = adminRuleCacheKey(id)
  const cached = adminRuleXmlCache.get<AdminRuleDoc | string>(key)
  if (cached && typeof cached !== "string") return cached
  const doc = parseAdminRuleXml(cached || await apiClient.getAdminRule(id, apiKey))
  if (doc.ruleName) adminRuleXmlCache.set(key, doc, ADMIN_RULE_CACHE_TTL_MS)
  return doc
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #167** (2026-10-05): **판례 법리탐색 시 제목검색 조기 성공으로 본문검색이 생략되는 recall 문제**
  *Symptoms*: ## Summary  현재 `korean-law-mcp`의 판례 검색은 기본 제목검색(`search=1`)이 1건 이상 성공하면 즉시 반환하므로, **법리/사실관계 탐색 질의에서 제목에 우연히 맞는 판례가 하나 있으면 본문검색(`search=2`)이 실행되지 않아 recall이 낮아질 수 있습니다.**  확인 기준: - package version: **4.15.5** - main commit observed: **ff33a713970d7b504bb08cd1fc3b03944aca5757** - 관련 구현: `src/tools/precedent-search-core.ts`의 `searchPrecedentsStructured()`   - `firstAttempt()` 기본값은 `search=1`   - initial attempt가 success이면 즉시 return   - `body_search`는 fallback path에 있음  ## Reproduction 1 — topical query with an early title hit  질의: ``` 학원강사 근로자 ```  기본 판례검색에서는 제목에 맞는 1건이 먼저 잡혀 검색이 종료될 수 있습니다. 그런데 같은 의미의 본문검색(`search=2`)을 실행하면 근로기준법상 근로자성 관련 판례군이 훨씬 넓게 조회됩니다. 예를 들어 대법원 **2004다29736**은 대학입시학원 종합반 강사의 근로자성을 직접 다룹니다.  즉 **“검색 성공”과 “법리 탐색이 충분함”이 다를 수 있습니다.**  ## Reproduction 2 — digital evidence  질의: ``` 녹음파일 사본 ```  제목검색에서는 최신 직접 사건인 **2022도1864**가 잡히지만, 본문검색/코퍼스 검색을 병행하면 **2012도7461** 등 같은 법리 계보의 판례가 추가로 발견됩니다.  유사판례 조사에서는 첫 제목 hit만 반환하는 것보다, 본문 검색까지 선택적으로 병행할 수 있는 경로가 유용합니다.  ## Why this matters  - 정확 사건번호 조회: 현재 fast path가 적절합니다. - 특정 판례 제목을 찾는 조회: 제목검색 우선이 적절합니다. - **법리/사실관계/유사판례 탐색**: title hit 1건만으로 종료하면 관련 판례군을 놓칠 수 있습니다. - LLM/agent가 검색결과를 읽고 재검색할 수는 있지만, unified tool에서 검색범위가 명시적으로 드러나면 훨씬 안정적으로 orchestration할 수 있습니다.  ## Suggested improvements  하위 호환성을 깨지 않는 방향이면 다음 중 하나 또는 조합이 가능해 보입니다.  1. `search_decisions(domain="precedent")`에서 판례 검색범위(`search: 1|2`)를 명시적으로 schema/documentation에 노출    - 현재 loose `options`로 전달 가능해 보이지만 tool description에는 잘 드러나지 않습니다.  2. 선택적 comprehensive
  **Post-Mortem & Fix Analysis**:
  > **v4.15.6 에 반영했습니다** (npm `korean-law-mcp@4.15.6`, `https://mcp.gomdori.app/law` 반영 완료). 재현 질의를 구체적으로 주셔서 바로 확인할 수 있었습니다. 감사합니다.  말씀하신 대로였습니다. 법제처 API 실측(2026-10-05):  | 질의 | 판례명 검색 (`search=1`) | 본문검색 (`search=2`) | |---|---|---| | 학원강사 근로자 | 1건 | 70건 (2004다29736 포함) | | 녹음파일 사본 | 1건 | 82건 (2012도7461 포함) |  제안하신 방향대로 **기본 동작은 그대로 두고** 옵트인 모드와 안내를 추가했습니다.  ### 1. `search: "both"`: 판례명과 본문을 함께 검색  ``` search_decisions(domain="precedent", query="학원강사 근로자", options={search: "both"}) ```  ``` 판례 검색 결과 (제목검색 1건 · 본문검색 70건, 중복 제외 21건 표시, 1페이지):  […] 학원강사를 근로자수에 포함하여 중소기업 여부를 판정할 수 없음   …   적중: 제목검색  […] 근로기준법위반·근로자퇴직급여보장법위반   …   적중: 본문검색 ```  - 판례명 검색과 본문검색을 각각 한 번씩(각 `display`건) 실행합니다. 판례ID로 중복을 제거하고 판례명 적중을 앞에 둡니다 (제안 4). - 건마다 `적중: 제목검색|본문검색`으로 어느 검색에서 맞았는지 표시합니다. - 사건번호만 넣은 exact 조회는 `"both"`여도 한 번만 조회합니다 (제안 3). - 값은 `1`(판례명, 기본), `2`(본문), `"both"`입니다. `search_decisions` 도구 설명과 options 설명에 명시했습니다 (제안 1).  ### 2. 판례명 검색이 적게 맞으면 재검색 안내  판례명 검색이 보정 없이 3건 이하로 끝나면 결과 끝에 다음 안내가 붙습니다 (제안 5). 

- **Issue #166** (2026-10-01): **test: 출력 마스킹 검증 키 생성 방식 보정**
  *Symptoms*: GitLab 미러의 Gitleaks가 마스킹 회귀 테스트의 더미키 리터럴을 시크릿으로 오탐해 푸시를 거부했다. 더미키를 테스트 실행 중 생성해 실제 키 없이 같은 마스킹 검증을 유지한다.  검증: 해당 5개 테스트와 커밋 게이트 전체 1,322개 테스트 통과. 변경 파일은 배포 패키지에 포함되지 않는 테스트 1개다. 

- **Issue #165** (2026-10-01): **fix: 조회·분석 경계 보정 (4.15.5)**
  *Symptoms*: 검색·상세·분석의 경계에서 확인된 오류를 수정한다. 공백형 판례 인용 누락과 조문 범위 오탐을 막고, 본문 없는 판례·다른 시행본·자리수 초과 JO를 정답으로 반환하지 않는다. 결정문 축약/법적근거, 법령 계층/표본, 반복 용어 정의/출처, 공식 링크와 MCP/CLI 마스킹을 보정한다. 기능과 의존성은 유지하고 4.15.5로 패치한다.  검증: 전체 162파일/1,322테스트(신규45), typecheck/knip/클린 빌드, Node20.19.0·22.12.0 전체 테스트, CJS13개, 패키지314파일, prod audit0. optional/dev 없는 실제 tarball 설치 후 두 Node에서 PDF·STDIO·설치 CLI 검사 통과. 새 실제 API 표본과 독립 최종 리뷰 확인. 자세한 재현·범위·제한은 docs/PRODUCTION-REVIEW-3-2026-10-02.md에 기록한다. 

- **Issue #164** (2026-10-01): **fix: 조회 결과와 입력 처리 보정 (4.15.4)**
  *Symptoms*: 일부 조회가 다른 조문·별표를 선택하거나 본문을 누락하고, 미검증 결과를 확정으로 표시하는 문제를 수정합니다. 실제 API 검수에서 확인한 위원회 의결서 봉투·노동위 판정 필드·기관 규정 기본정보·인용 3단비교 응답도 처리합니다. 영문 공포일·등록일·편장 헤더의 의미를 보존합니다.  판례 사건번호·요약, 조례 근거법·시행일, 인용 상한·취소, 시나리오 오류, 문서 위험 분석, HTTP 키/CORS, 공정위 리서치, 공식 링크와 CLI 입력 경로를 보정합니다. 기존 99개 내부 도구·10개 노출 도구 검수이며 기능 추가와 의존성 변경 없이 4.15.4 패치로 반영합니다.  검증: 149개 파일·1,277개 테스트(신규 회귀 96개), 타입·미사용 코드·clean build, 지원 Node 20.19.0/22.12.0, CJS 13개, 프로덕션 취약점 0. 실제 법령 계열 18개 표본, 결정 18개 도메인 검색/상세, 리서치 8 task·분석 4 mode·용어/지식·시점/안내 표본을 확인했습니다. 설치 tarball의 optional 없는 PDF·STDIO·CLI 심링크 검증과 별도 코드 리뷰도 통과했습니다.  기존 응답/조회/페이지 상한과 판례생사 휴리스틱은 유지합니다. 검수 범위와 실호출 근거: docs/PRODUCTION-REVIEW-2-2026-10-02.md. 

- **Issue #163** (2026-10-01): **fix: 조회 정확성과 실행 한도 보정 (4.15.3)**
  *Symptoms*: 판례 검색에서 사건번호 대신 역인용 판례가 반환되거나 관련성이 다른 판례의 키워드를 합쳐 인정되는 문제를 수정했습니다. 같은 시행 공포의 분리 시행 조문 비교, JO 무시 응답, 별표 번호 경계, 조문 연혁의 법령 선택도 확인합니다.  업스트림 전체 데드라인과 취소를 본문 수신까지 유지하고, 본문 정리 대기 및 완료된 체인 리스너 잔류를 제거했습니다. 판례의 파싱된 원문은 20건 전용 캐시에서 상세·인용 추적이 공유하고, 같은 법령의 batch 전문 조회는 요청 내부에서 공유합니다. 기능 추가 없이 4.15.3 패치 버전입니다.  검증: 131개 파일 / 1,181개 테스트, Node 20.19.0·22.12.0 전체 테스트, 타입·미사용 코드·clean build·302개 패키지 파일·프로덕션 취약점 0, 판례/체인/디스패치 CJS 10개 스크립트 통과. 별도 설치한 프로덕션 tarball의 optional 없는 PDF·stdio 실행도 확인했습니다. 변경분 별도 리뷰에서 P1/P2 차단 사유가 없었습니다.  검토 기록: docs/PRODUCTION-REVIEW-2026-10-02.md. 판례 캐시의 동시 miss 합치기와 인용 추적의 기존 3건 스캔·휴리스틱 범위는 유지합니다. 

- **Issue #162** (2026-09-22): **feat(admin-rule): get_admin_rule 부분 조회(jo·chapter·keyword·page) + 신구대조 제·개정이유 폴백**
  *Symptoms*: ## 문제  행정규칙(고시·훈령·예규) 중 전문이 긴 규칙은 `get_admin_rule`로 뒷부분 장을 영원히 읽을 수 없습니다.  재현 (외국환거래규정, 재정경제부고시 제2026-103호, id `2100000285140`): 1. `get_admin_rule {id, jo:"제9-5조"}` → `jo` 무시, 전문을 제1장부터 반환하다 50,000자에서 잘림 (제2장 중반 종료) 2. `compare_admin_rule_old_new {id}` → `[NOT_FOUND] 신구법 대조 데이터가 없습니다.` 단독 응답  원인 (실측 확정): 법제처 admrul 상세는 법령(target=law)과 달리 JO 파라미터가 없고, 전문이 `<조문내용>` **통짜 1개 CDATA**로만 옵니다 — 외국환거래규정 기준 188,804자·1,943라인·조문 208개. 참고로 이 규칙은 `조문형식여부=N`인데도 본문이 조문 체계를 갖고 있어, 이 플래그로 조문 유무를 판단할 수 없습니다.  ## 변경  ### 1. `get_admin_rule` 부분 조회 파라미터 4종 (우선순위 jo > chapter > keyword > page, 복수 지정 시 상위 하나만 적용·응답에 명시)  | 파라미터 | 동작 | |---|---| | `jo` (+`context`) | 지정 조문 1개(±n개 조문) — `"제9-5조"` `"9-5"` `"제2-6조의2"` `"9-5-2"` 모두 수용 | | `chapter` | 장 전체. 한도 초과 시 "jo로 좁히라" 힌트를 본문 앞에 | | `keyword` (+`max_results`) | 매칭 조문 **전체 번호 목록** + 상위 N개 본문 (뒷장 조문이 목록에서 사라지지 않도록) | | `page` | 라인 경계 비중첩 청킹, `페이지 p/total` 표기 |  - 파서: `^` 앵커 + **원 라인 기준**(들여쓰기 라인은 본문 — 실측상 조문·장 헤더는 전부 들여쓰기 0) + **조문번호 단조증가 검사**로 라인 시작 역행 참조("제1-2조 제1항의 규정은…")의 오분리 방지. 커버 패턴: 괄호 제목 / 공백 괄호(`제2-6조의2 (예금 및 신탁)`) / 조의N / `<삭 제>` 조문 / 하이픈 없는 일반 조문 - 조문 체계 없는 항목식 훈령·지침: `jo`/`chapter` 요청 시 graceful 안내 (에러 아님) - 전문 XML을 id 기준 캐시(TTL 6h, LRU 20건, `admrulxml:` 네임스페이스) — jo → keyword → page 연속 조회 시 Open API 재호출 방지 - 파라미터 없는 전문 조회는 종전 동작 유지 + 잘릴 때 부분 조회 힌트를 본문 **앞**에 삽입 (뒤에 붙이면 잘려 사라짐) - 공포일 표기: 상세 응답의 실제 태그(`발령일자`·`발령번호`) 폴백 추가 (`공포일자`는 없는 경우가 많음 — 실측)  ### 2. `compare_admin_rule_old_new` — 제·개정이유 폴백  행정규칙 신구대조는 API 데이터가 없는 경우가 많습니다. 대조 데이터 0건이
  **Post-Mortem & Fix Analysis**:
  > ## 리뷰 결과 — 머지합니다 ✅  실데이터(외국환거래규정 `2100000285140`, 프로덕션 `mcp.gomdori.app/law` 경유 앞 5만 자·564라인)로 파서를 직접 돌려 확인했습니다.  - 조문 57개·장 2개 분리, **헤더 모양인데 본문으로 흡수된 라인 0건** — `^` 앵커 + 단조증가 검사 조합이 실제 형상에서 오분리를 만들지 않습니다 - `jo`·`chapter`·`keyword` 뷰 모두 의도대로 동작, 타 장 혼입 없음 - 타입체크 통과 / 전체 스위트 81파일·801테스트 통과 (기존 테스트 무수정)  설계 판단(전문 캐시로 jo→keyword→page 연속 조회 흡수, 잘림 힌트를 본문 *앞*에, keyword 목록은 전량·본문만 상위 N개)은 전부 타당합니다.  ### 머지하면서 같이 고친 것 4건  파서에 **조용한 라인 유실** 경로가 있어 머지 후속 커밋으로 수정했습니다.  1. **장 헤더 뒤 라인이 어느 조문에도 담기지 않음** (실측 확정) — 외국환거래규정의 `제1절 외국환은행`이 `제2장` 헤더 바로 뒤에 와서 `preamble`로 빠졌는데, `preamble`은 `joView`/`chapterView`/`keywordView` 어디서도 출력되지 않습니다. 즉 부분 조회에서 절 구분이 사라집니다. → 첫 조문 이후의 떠도는 라인은 `pending`으로 모아 다음 조문 앞에 붙입니다. 수정 후 실데이터 **564/564 라인 커버·preamble 0**. 2. **장마다 조 번호가 1로 리셋되는 체계에서 조문 통째 유실** — `제2장 / 제1조`는 단조증가 위배로 헤더 판정에서 탈락하고, 장 헤더가 `cur = null`을 만든 직후라 본문에도 못 붙어 사라집니다(`제1장 총칙·제1조·제2장 벌칙·제1조` → 조문 1개만 파싱). → 장 헤더에서 `lastOrd`를 리셋합니다. 역행 참조 방어는 장 내부에서 그대로 유효합니다. 3. `paginateFullText("")` → `페이지 1/0` 표기 → `to

- **Issue #161** (2026-10-03): **[재발] #78과 동일 증상 — search_law fetch failed (2026-09-20)**
  *Symptoms*: #78에서 수정된 것과 동일한 증상이 재발한 것으로 보입니다.  발생 시각: 2026-09-20 12:50~12:55 KST  환경: claude.ai 커스텀 커넥터, https://mcp.gomdori.app/law?oc=lj****  증상: search_law("법인세법") 호출 시 매번 [EXTERNAL_API_ERROR] fetch failed. 여러 차례(최소 3회, 약 5분 간격) 재시도했으나 동일하게 실패.  확인한 것: open.law.go.kr 마이페이지에서 본인 OC 키 상태 = 승인/연결 정상. 키 문제는 아닌 것으로 보임.  #78의 원인(리전 egress 문제)이 재발했거나, 별도의 새로운 원인일 수 있어 보고합니다. 살려주시라요
  **Post-Mortem & Fix Analysis**:
  > 보고 감사합니다. 시각까지 적어 주신 덕에 서버 쪽 타임라인과 맞춰 볼 수 있었습니다. 지금은 정상이고(09-21 09:00 KST `search_law("법인세법")` 실호출 200, 0.1초), 아래 정리합니다.  ## 타임라인 (KST, 2026-09-20)  | 시각 | 사건 | |---|---| | 12:50~12:55 | 보고하신 `search_law` fetch failed (당시 프로덕션 머신은 **싱가포르 sin**, 09-11 생성) | | 16:50 | 머신이 **도쿄 nrt** 에 재생성되고 sin 머신은 파괴됨 — 이 레포 배포나 제 로컬 작업이 아니라 출처를 확인 중입니다 | | 이후 | 재발 없음 |  ## 원인 — 확정 못 했습니다  #78 때는 "nrt 에서 law.go.kr 로 TCP 가 조용히 드롭"을 다국가 대조로 잡았는데, 이번엔 **그걸 가를 근거가 남지 않았습니다**. 사용자 쪽에 남은 건 `fetch failed` 다섯 글자와 시각뿐이고, 서버 쪽은 장애 당시 머신이 그날 오후 파괴되면서 로그가 같이 사라졌습니다. 09-21 에 임시 머신을 띄워 실측하니 sin(152.236.20.5)·nrt(154.47.20.2) **양쪽 다 law.go.kr 정상**이라, 지금 시점에서 "리전 문제였다"고도 "법제처 점검이었다"고도 말할 수 없습니다. 5분짜리 일시 장애로 보이지만 단정은 안 하겠습니다.  ## 조치 — v4.13.1 배포 (다음엔 원인이 보이게)  `fetch failed` 는 Node(undici)가 DNS 실패·TCP 리셋·연결 타임아웃·TLS 실패를 전부 같은 메시지로 던지고 진짜 원인(`cause.code`)은 감춘 것입니다. 그걸 버리고 있던 게 이 서버의 잘못이라 고쳤습니다.  - 사용자에게 가는 메시지에 원인 코드와 대상 호스트가 붙습니다 — 예: `fetch failed (ECONNRESET: read ECONNRESET) - www.law.go.kr`, `fetch failed (ENOTFOUND
  > 대단히 감사합니다.
  > 재발 시 전체 오류와 시각을 남겨 달라는 안내에 따라 보고드립니다.  확인 시각: 2026-10-03 06:32–06:35 UTC (15:32–15:35 KST). 공개 엔드포인트에서 아래 최소 조회가 실패했습니다.  1. 법령: https://mcp.gomdori.app/law search_law({"query":"건축법","display":1}) 반환된 오류 전문: [EXTERNAL_API_ERROR] fetch failed (UND_ERR_CONNECT_TIMEOUT: Connect Timeout Error (attempted address: www.law.go.kr:443, timeout: 10000ms)) - www.law.go.kr 도구: search_law  2. 같은 호스트의 건축 조회: https://mcp.gomdori.app/archhub building_data({"kind":"ledger","type_name":"표제부","sigungu_code":"11140","bdong_code":"10300","bun":"0031","ji":"0000","max_rows":1,"page":1}) 공개 테스트 주소: 서울특별시 중구 태평로1가 31-0. 반환: [EXTERNAL_API_ERROR] API 응답 시간 초과(30s). 동 전체보다 번지(bun)를 지정하면 빨라집니다. 도구: 건축물대장  3. 같은 호스트의 통계 조회: https://mcp.gomdori.app/stats quick_stats({"query":"인구","region":"서울","year":2024}) 반환: {"success":false,"answer":"조회 중 오류가 발생했습니다: 네트워크 오류가 발생했습니다.","note":"search_statistics(\"인구\")로 직접 검색해보세요."}  MCP 도구 목록/메타데이터 조회는 성공했고, /healthz는 프로세스가 올라온 상태를 표시했습니다. 건축 지역코드 조회도 성공했습니다. /archhub/health는 k

- **Issue #160** (2026-09-08): **v4.12.3: get_law_text returns NOT_FOUND for identifiers returned by search_law**
  *Symptoms*: ## Summary  In an OpenClaw integration, `search_law` successfully returns current law identifiers, but `get_law_text` returns `NOT_FOUND` when called with those exact identifiers. This makes the per-article full-text path unusable even though search works.  ## Reproduction  1. Call `search_law` with `법인세법`. 2. It returns the current law as:    - `lawId`: `001563`    - `mst`: `280349`    - effective date: `2026-07-01` 3. Call `get_law_text` with, for example:  ```json {   "mst": "280349",   "lawId": "001563",   "jo": "제79조",   "efYd": "20260907" } ```  ## Actual result  `[NOT_FOUND] 법령 데이터를 찾을 수 없습니다.`  The same occurred for `법인세법 시행령` (`mst: 283635`, `lawId: 003608`) and `상법` (`mst: 272919`, `lawId: 001702`).  ## Expected result  `get_law_text` should return the current text for the exact `mst`/`lawId` pair supplied by `search_law`, including a requested article.  ## Notes  - `search_law`, `search_decisions`, and `legal_research` otherwise returned results. - The NTS full-text limitation appears separate and is explicitly reported by the MCP as unsupported by the upstream Open API. - The documented Beopmang fallback endpoint (`https://api.beopmang.org/api/v4/law?action=search&q=...`) returned HTTP 503 during this check, so it could not be used to validate the identifiers. - The referenced release is v4.12.3.  If helpful, I can provide the surrounding OpenClaw tool-call responses.
  **Post-Mortem & Fix Analysis**:
  > v4.12.5 로 수정해 프로덕션(`https://mcp.gomdori.app/law`)에 배포했습니다. 자세한 재현 절차 덕분에 빨리 좁혔습니다 — 감사합니다.  **원인은 `efYd` 하나였습니다.** `mst`/`lawId` 는 문제가 없었습니다.  변수를 하나씩 빼서 실측한 결과입니다:  | 요청 | 결과 | |---|---| | `mst=280349` | ✅ 200 | | `mst=280349` + `lawId=001563` | ✅ 200 | | `mst=280349` + `efYd=20260701` (실재 시행일) | ✅ 200 | | `mst=280349` + `lawId=001563` + `efYd=20260907` | ❌ NOT_FOUND |  `efYd` 는 '조회 기준일'이 아니라 **그 법령에 실재하는 시행일**이어야 합니다. 법인세법에는 `20260907` 시행 버전이 없어서 법제처가 빈 응답을 줬습니다. 그런데 파라미터 설명이 `시행일자 (YYYYMMDD 형식)` 뿐이라 오늘 날짜를 넣게 유도했고, 무엇보다 **실패 안내가 `search_law 로 유효한 mst 를 먼저 확인하세요` 라고 엉뚱한 곳을 가리켰습니다.** 법인세법·시행령·상법 세 건을 확인하고도 원인을 못 찾으신 건 안내가 잘못됐기 때문입니다. 이쪽이 진짜 버그였습니다.  **수정** — NOT_FOUND 안내를 `efYd` 유무로 분기했습니다: ``` ⚠️ efYd=20260907 에 해당하는 시행일 버전이 없습니다. efYd 는 '조회 기준일'이 아니라    그 법령에 실재하는 시행일이어야 합니다 — 오늘 날짜를 넣으면 대개 실패합니다. → 현행 본문: get_law_text(mst="280349") 로 efYd 없이 재조회 → 시행예정본: search_law 가 안내한 efYd 를 그대로 사용 mst/lawId 자체는 유효할 수 있습니다. ``` `efYd` 파라미터 설명에도 '조회 기준일이 아니다' 를 명시했습니다.  **조회 성공 경로의 동작은 바꾸지 않았습니다.
  > 최신버젼으로 올리고 나서 판례 검색이 안되서 오랜만에 들어와봤는데.. claude 로 오랜 시간 진행된 프로젝트가 어떻게 망가지는지 보는거 같습니다.  기능을 늘리기 보다는 전면적인 refactoring 을 하셔야 할것 같습니다.

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

### Incident Patch 1: `65a03ae3` (2026-10-01)
**Commit Message**: fix: 조회·분석 경계 보정 (4.15.5)

**File**: `CHANGELOG.md` (modified, +19/-0)
```diff
@@ -1,5 +1,24 @@
 # Changelog
 
+## [4.15.5] - 2026-10-02
+
+전체 기능을 새 API 표본과 검색·상세·분석 연결 경로로 다시 검수했다. 재현한 오류를 수정하며 기능·의존성은 추가하지 않는다.
+
+### Fixed
+
+- 조문 범위 인용에서 법령명과 가지번호를 함께 비교한다. 타법 범위와 범위 밖 가지를 요청 조문의 인용으로 인정하지 않는다
+- 판례 상세는 본문 없이 메타데이터·참조만 있는 응답을 미확인 오류로 반환하고 캐시에 저장하지 않는다. 취소된 요청은 캐시 적중 시에도 중단한다
+- 조문 코드로 판례를 검색할 때 자연어 조문번호를 전달하고 명시적 조문·타법 불일치를 제외한다. 판례 요약의 핵심 내용 부재와 한글 키워드 경계를 처리한다
+- 공백형 사건번호가 법령 인용과 섞여도 검증 대상에 포함한다. 미검증·존재하지 않는 판례를 누락해 전체 검증 완료로 표시하지 않는다
+- 결정문의 긴 섹션을 각각 축약하고 주문·요지·참조·법적 근거를 보존한다. 특별행정심판의 `관계법령` 필드를 표시한다
+- 법령 체계도에서 상위 법률과 시행령 아래의 시행규칙을 보존하고 실제 부모·자식 관계로 표시한다. 위임조문 트리의 표본·생략 안내를 유지한다
+- 자리수 초과 JO가 다른 조문으로 잘리지 않도록 본문·상세·연혁에서 검증한다. 별표 가지 코드가 무번호 단일 항목으로 대체되지 않게 한다. 연계 목록의 설명과 실제 반환 대상, 조회 페이지 내 필터 한계를 일치시킨다
+- 과거 시행본 조회가 빈 응답일 때 시행일이 다른 MST 본문으로 대체해 시점 비교를 확정하지 않는다
+- 생활법령의 조문번호와 한글 개정 주석을 보존하고 용어 상세의 HTML 엔터티를 해독한다. 해석례·자치법규 공식 링크 경로를 바로잡는다
+- MCP 직접·프록시 호출에서 인자로 제공한 인증키를 출력 마스킹에 포함한다. CLI 출력·오류도 마스킹하고 공통 입력 길이 제한을 적용한다
+
+검수 범위·재현·검증 기록: [전체 기능 재검수](docs/PRODUCTION-REVIEW-3-2026-10-02.md).
+
 ## [4.15.4] - 2026-10-02
 
 전체 기능의 구현과 호출 경로를 검수했다. 노출 도구·입력 계약·의존성은 유지하며 재현한 오류를 수정한다.
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
 >   - `.github/workflows/publish.yml`(GitHub Release → OIDC trusted publishing + provenance)은 **npm 쪽 trusted publisher 등록이 아직 안 됐다**. 그래서 게시는 위 로컬 `npm publish` 가 정규 경로이고, Release 는 그 뒤에 만든다 — 워크플로는 같은 버전이 이미 레지스트리에 있으면 게시를 건너뛰고 검증(typecheck·test·build·verify:package·audit)만 릴리스 시점에 재확인한다.
 > - **🚫 이 레포에서 `fly deploy` 직접 실행 절대 금지** — 통합 이미지를 law 단독 이미지로 덮어써 stats·patent·archhub·school까지 전부 죽는다. 자세한 배경: [docs/FLY-COST.md](docs/FLY-COST.md)
 
-Korean Law MCP Server v4.15.4 - 법제처 42개 API → 10개 통합 도구 (내부 99개) + 9개 시나리오 + 자연어 CLI + HTTP stateless + 판례 토큰 74% 감축 + **legal_research (체인 8종 통합, task 파라미터)** + **legal_analysis (인용검증·판례생사·행위시법·영향그래프 통합, mode 파라미터)** + **time_travel (시점 diff)** + **action_plan (이럴 땐 이렇게, 5단계 안내)** + **시행예정 감지 (search_law가 제명변경·미시행 개정 자동 병기)** + **ordinance_radar (조례 정비 레이더 — 근거 상위법 개정 자동 대조, v4.7.0)** + **인용 검증 표기 내성 (낫표·가운뎃점·`같은 법` 조응, v4.9.0)** + **폐지 감지 (검색 0건 시 폐지 법령·행정규칙 연혁 추적 — 폐지사유·후속 통합 규정 자동 안내, v4.10.0)** + **search_law_bulk (등록부 대량 조회 + MST diff 감시, v4.13.0)** + **행정규칙 부분 조회 (get_admin_rule 의 jo·chapter·keyword·page — 통짜 전문을 조문 단위로, v4.14.0)** + **법령ID 계보 연혁 (제명이 바뀌기 전 버전까지 — search_historical_law·applicable_law·time_travel, get_annexes date 시점 별표, get_law_text efYd 기준일 보정, 행정규칙 기준일 판단, v4.15.0)**
+Korean Law MCP Server v4.15.5 - 법제처 42개 API → 10개 통합 도구 (내부 99개) + 9개 시나리오 + 자연어 CLI + HTTP stateless + 판례 토큰 74% 감축 + **legal_research (체인 8종 통합, task 파라미터)** + **legal_analysis (인용검증·판례생사·행위시법·영향그래프 통합, mode 파라미터)** + **time_travel (시점 diff)** + **action_plan (이럴 땐 이렇게, 5단계 안내)** + **시행예정 감지 (search_law가 제명변경·미시행 개정 자동 병기)** + **ordinance_radar (조례 정비 레이더 — 근거 상위법 개정 자동 대조, v4.7.0)** + **인용 검증 표기 내성 (낫표·가운뎃점·`같은 법` 조응, v4.9.0)** + **폐지 감지 (검색 0건 시 폐지 법령·행정규칙 연혁 추적 — 폐지사유·후속 통합 규정 자동 안내, v4.10.0)** + **search_law_bulk (등록부 대량 조회 + MST diff 감시, v4.13.0)** + **행정규칙 부분 조회 (get_admin_rule 의 jo·chapter·keyword·page — 통짜 전문을 조문 단위로, v4.14.0)** + **법령ID 계보 연혁 (제명이 바뀌기 전 버전까지 — search_historical_law·applicable_law·time_travel, get_annexes date 시점 별표, get_law_text efYd 기준일 보정, 행정규칙 기준일 판단, v4.15.0)**
 
 ## Structure
 
```

**File**: `README-EN.md` (modified, +10/-0)
```diff
@@ -31,6 +31,16 @@
 
 ---
 
+## v4.15.5: Retrieval and verification boundaries
+
+- Fixed missing precedent bodies, cancelled cache reads, and statute/branch boundaries in article ranges
+- Included spaced case numbers in citation verification and corrected article-code handoffs and keyword extraction
+- Fixed decision compaction/legal grounds, law hierarchy/sample labels, and daily-law/term rendering
+- Prevented historical-slice substitution and strengthened MCP/CLI key masking and CLI argument limits
+- Reviewed all features again. No new features or dependency changes. [Changelog](CHANGELOG.md), [review evidence](docs/PRODUCTION-REVIEW-3-2026-10-02.md)
+
+---
+
 ## v4.15.4: Full feature review and fixes
 
 - Corrected case-number matching, summary boundaries, article/annex selection, and citation-mode three-tier responses
```

**File**: `README.md` (modified, +10/-0)
```diff
@@ -30,6 +30,16 @@
 
 ---
 
+## v4.15.5: 조회·검증 경계 수정
+
+- 판례 본문 없는 응답·취소된 캐시 조회, 조문 범위의 법령·가지번호 판별 수정
+- 공백형 사건번호의 인용 검증 누락, 조문 코드의 판례 검색 전달과 키워드 추출 수정
+- 결정문 축약·관계법령, 법령 체계의 부모·자식 관계와 표본 표시, 생활법령·용어 출력 수정
+- 과거 시행본의 잘못된 대체 조회를 차단하고 MCP·CLI의 키 마스킹과 CLI 입력 한도 보완
+- 전체 기능 재검수. 기능 추가·의존성 변경 없는 패치. [변경 내역](CHANGELOG.md), [검수 기록](docs/PRODUCTION-REVIEW-3-2026-10-02.md)
+
+---
+
 ## v4.15.4: 전체 기능 검수·오류 수정
 
 - 판례 사건번호·요약 경계, 법령 조문·별표 선택, 인용조문 3단비교 응답 처리 수정
```

**File**: `docs/PRODUCTION-REVIEW-3-2026-10-02.md` (added, +68/-0)
```diff
@@ -0,0 +1,68 @@
+# 전체 기능 재검수 — 4.15.5
+
+검토일: 2026-10-02. 4.15.4를 기준으로 전체 기능을 다시 검수했다. 새 API 표본의 필드와 검색→상세→분석 연결, 잘못된 확정 결과와 입력 경계를 중점 확인했다. 기능 추가·의존성 변경 없이 재현한 오류만 수정한다.
+
+## 범위와 방법
+
+등록부의 내부 99개·노출 10개·카테고리 40개를 기준으로 기능군별 구현과 호출 경로를 점검했다. 이름 중복·카테고리 누락은 없었다. 이전 1,277개 테스트를 기준으로 새 실패를 재현하고 수정 후 전체 회귀를 실행했다.
+
+| 기능군 | 이번 검수 경로 |
+|---|---|
+| 법령·행정규칙·별표 | 검색·대량검색·현행/연혁/상세/배치·시점·조문비교·법령 계보·JO·가지/무번호 별표·규칙 페이지/부분 조회·캐시 |
+| 법령 체계·자치법규 | 3단비교·위임 트리·체계도·연계 4종·조례 검색/본문/정비·부모/자식·표본 제한 |
+| 판례·인용 분석 | 검색/정확번호/fallback·본문·요약·키워드·유사도·조문 연결·생사 추적·검증 상한·행위시법·영향 그래프·캐시·취소 |
+| 결정·해석·규정 | 판례 외 17개 통합 도메인 검색→상세·full/compact·배열/봉투·결정일/등록일·본문/법적근거 |
+| 지식·생활·안내 | 용어/KB·반복 정의와 출처·용어/조문/법령 관계·AI 검색 4종·공식 링크·리서치 8 task·시나리오·문서 분석 |
+| 실행 기반 | MCP 직접/메타·CLI 자연어/직접/JSON·HTTP/STDIO·마스킹·입력/호출/본문 상한·retry/deadline·취소·패키지·공유 배포 |
+
+전체 검수는 코드와 회귀 검증의 범위다. 모든 외부 자료나 입력 조합을 실호출했다는 뜻은 아니다. 각 도메인의 새 표본을 실제로 조회하고 응답의 필드·본문·메타데이터를 대조했다. 확정 오류는 실패 테스트로 기록했다.
+
+## 재현한 문제와 수정
+
+| 문제 | 수정 및 회귀 근거 |
+|---|---|
+| 타법 범위를 요청 법령 인용으로 인정하고 가지번호 구간을 무시 | 법령·가지번호를 범위와 함께 비교 (`article-anchor.review3`) |
+| JO 코드가 그대로 판례 검색어가 되고 타법/다른 조문이 혼입 | 자연어 조문으로 전달·명시 불일치 제거·조회 표본 표시 (`article-with-precedents.review3`) |
+| 판례 본문 없이 메타/참조만 상세·분석 성공, 취소된 캐시 반환 | 본문 부재는 미확인 오류·캐시 저장 금지·캐시 전 취소 확인 (`precedent.review3`) |
+| 요약할 내용 없이 메타만 성공, 한글 용어 분절·빈도 중복 | 요약 핵심 내용 부재 오류·한글 경계와 중복 집계 보정 (`precedent.review3`) |
+| 공백형 판례가 검증에서 빠져 혼합 인용 전체를 VERIFIED로 표시 | 공백형 사건번호 추출·기존 상한/미검증 집계 적용 (`verify-citations.review3`) |
+| 공백 뒤 수량을 사건번호로 오인해 환각 경고 | 독립 리뷰에서 재현 후 수량·조사 경계와 백트래킹 가드 보완, 원심/조문 뒤 실제 인용 보존 (`verify-citations.review3`) |
+| 검색 안내가 마지막 유사 판례 점수를 부풀려 순서 역전 | 판례 항목과 후속 안내 경계 분리 (`similar-precedents.review3`) |
+| 긴 이유 뒤 짧은 마지막 전문 때문에 compact 무효, 법적근거까지 축약 | 긴 섹션별 축약·주문/요지/법적근거 경계 보호 (`decision-compact.sections`) |
+| 특별행정심판 관계법령 누락 | 실제 `관계법령` 필드 보존 (`decision-domains.review3`) |
+| 상위법 누락·체계 역전·시행령 하위 규칙 누락 | 실제 부모·자식 구조의 재귀 수집/표시 (`statutes.review3`) |
+| 처음 5조만 있는 위임 트리를 전체 조항 수로 표시 | 원본 표본/생략 경고 유지 (`statutes.review3`) |
+| 가지 코드 별표가 유일 무번호 별표로 대체 | 6자리 가지 코드도 단일 항목 폴백에서 제외 (`statutes.review3`) |
+| 자리수 초과 JO를 앞 6자리로 읽어 다른 조문 반환 | 본문·상세·연혁에서 호출 전 6자리 검증 (`jo-bounds.review3`) |
+| 연계 법령/조례 식별 목록을 실제 관계 조회로 표시 | 공식 응답 대상과 표제/설명·후속 안내 일치 (`statutes.review3`, `law-linkage`) |
+| 시점 비교에서 빈 시행본을 다른 시행 슬라이스로 대체해 본문 동일 확정 | 시행일 지정 시 MST 단독 폴백 금지 (`scenarios/time-travel.review3`) |
+| 용어 반복 정의 누락·다른 정의 출처 오인용 | 일련번호 경계별 정의/출처 유지 (`knowledge-base.review3`) |
+| 용어 entity 잔류·생활법령 0채움 조번호·개정 주석 삭제 | 공유 HTML 정리와 조번호/가지 표시 (`knowledge-base.review3`, `life-law.review3`) |
+| 해석례·자치법규 공식 링크 404 | 실제 본문/검색 DOM 확인한 공식 경로로 수정 (`external-links`) |
+| 인자 OC가 최종 마스킹에서 빠지고 CLI 출력/입력 가드 누락 | 직접/프록시 인자 키 포함·CLI 출력/오류 마스킹·공통 길이 가드 (`execution-output.review3`) |
+
+이식 원본 `law-parser.ts`·`search-normalizer.ts`·`citation-content-matcher.ts`는 변경하지 않았다. JO 자리수 검증은 소비 경계에서 처리한다. 등록 도구 수와 입력 계약·의존성은 유지한다.
+
+연계 목록의 응답 대상은 [법령 기준 연계 공식 문서](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=lsOrdinConListGuide)와 [자치법규 기준 연계 공식 문서](https://open.law.go.kr/LSO/openApi/guideResult.do?htmlName=ordinLsConListGuide)를 대조했다. 관계를 새로 조회하는 기능을 추가하지 않았다.
+
+## 실제 API 증거
+
+- 판례 새 표본: 공유물분할 `618541`/`2025다217707` 상세 2,089자, 보험금 `624233`/`2026다201325` 상세 6,412자. 공백형 정확 검색→상세→요약 458자·키워드·인용 검증 정상. 참조 판례 `2011다1118` 후속 본문 3건 스캔은 확인 부족을 미확정으로 표시한다. 검색 실패한 `2019다205864`는 성공 표본에 포함하지 않았다.
+- 관세법 MST `290673`/JO `003800`: 제38조로 판례 검색에 전달, 조문 1,166자와 원검색 0건 표시. 건축법 체계도: 법률 1·시행령 1·규칙 7건, 실제 부모·자식 관계 확인. 위임 트리는 전체 105조 중 처음 5조 표본임을 표시한다.
+- 행정규칙: NFPC 102의 NFSC 명칭 계보 19버전, 금융투자업규정 `2100000285020` 페이지 1/16·2/16 및 제4-50조 정상. 페이지 2/조문 재조회는 캐시로 업스트림 호출 0회.
+- 비판례 17개 도메인의 새 검색 표본과 지원 상세 16개를 확인했다. 국세청 상세는 기존 NOT_SUPPORTED 상태를 유지했다. FTC `19361`은 full 10,993→compact 1,702자, 특별행정심판 `2071453`은 관계법령 291자 복구, 권익위 `2585`는 4,379→1,506자.
+- 기관 규정 실제 조문 배열 21/90/76개, 영문 LABOR `003159` 조문 46,139자, 조약 `17983` 한글/영문과 동일 조약번호를 확인했다. 목록에만 있거나 API에 없는 상세 메타데이터는 추정하지 않았다.
+- 채권 상세 11개 정의·8개 출처 2,418자: 첫 사전 정의는 출처 없이, 둘째 채무증권 정의에 우체국예금자금운용지침 출처를 연결한다. 용어·KB·일상 매핑·조문/법령 연계와 AI 급여 검색 4종의 새 표본을 대조했다.
+- 해석례 `342457` 새 공식 링크는 200과 실제 `25-0663` 질의/회답/이유, 자치법규 검색 링크는 200과 검색 DOM을 확인했다. 단순 HTTP 200을 문서 내용 검증으로 간주하지 않았다.
+
+API 호출은 작업별 예산·취소 신호로 제한했다. 실제 키와 원문 응답은 저장소 fixture에 포함하지 않았다.
+
+## 검증과 유지하는 제한
+
+소스 게이트: 타입 검사·knip·162개 파일/1,322개 테스트·클린 빌드·패키지 파일 314개 검증 통과. 기준 대비 신규 회귀 45개. 독립 리뷰에서 발견한 수량 오탐을 수정한 뒤 해당 테스트와 KB 최종 변경을 다시 검토했다.
+
+지원 Node 20.19.0·22.12.0에서 각각 전체 1,322개 테스트를 통과했다. CJS 회귀 스크립트 13개, 프로덕션 audit 취약점 0개. 실제 tarball을 optional/dev 의존성 없이 설치해 두 런타임에서 PDF 별표 파싱·STDIO 초기화/도구 10개·JO 변환·설치된 CLI 심링크/JSON/카테고리 필터를 검증했다.
+
+npm에 검증 tarball을 게시하고 전파/무결성을 확인한 뒤, 공유 호스트의 법령 핀만 올려 기존 머신에 배포한다. 공개 수정 경로와 5개 MCP를 다시 확인하며 배포 결과는 릴리스 완료 기록에 남긴다.
+
+검증/검색/스캔/페이지/본문 상한과 캐시 건수·TTL은 유지한다. 판례생사·유사도·키워드·조례 정비는 수록 자료와 규칙에 기반한 안내이며 미확인 상태를 확정하지 않는다. 용어 조문연계는 업스트림이 display를 무시하여 새 표본에서 약 791KB·26.9초가 필요했으며 기존 예산/시간 상한을 유지한다. 외부 API의 모든 자료 변형을 보장하지 않는다. 공유 호스트의 리전과 다른 MCP 핀은 변경하지 않는다.
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "korean-law-mcp",
-  "version": "4.15.4",
+  "version": "4.15.5",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "korean-law-mcp",
-      "version": "4.15.4",
+      "version": "4.15.5",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.27.1",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "korean-law-mcp",
-  "version": "4.15.4",
+  "version": "4.15.5",
   "description": "법제처 42개 API → 9개 MCP 도구. 법령·판례·조례·조약 + 다단계 리서치(legal_research, 8 task) + 정밀분석(legal_analysis: 인용검증·판례생사·행위시법·영향그래프) + 시점 비교(time_travel) + 상황별 5단계 안내(action_plan) + 국세청 해석례(nts)",
   "type": "module",
   "main": "build/index.js",
```

**File**: `src/execution-output.review3.test.ts` (added, +52/-0)
```diff
@@ -0,0 +1,52 @@
+import { afterEach, describe, expect, it, vi } from "vitest"
+import { Server } from "@modelcontextprotocol/sdk/server/index.js"
+import { Client } from "@modelcontextprotocol/sdk/client/index.js"
+import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js"
+import { allTools, registerTools } from "./tool-registry.js"
+import { executeTool } from "./lib/cli-executor.js"
+import type { LawApiClient } from "./lib/api-client.js"
+
+const key = "argument-secret-12345"
+const api = {} as LawApiClient
+const law = allTools.find(t => t.name === "get_law_text")!
+afterEach(() => vi.restoreAllMocks())
+
+describe("execution entrypoint output protection", () => {
+  it.each([false, true])("masks argument OC in MCP direct/proxy output: %s", async proxy => {
+    vi.spyOn(law, "handler").mockResolvedValue({ content: [{ type: "text", text: `credential: ${key}` }] })
+    const server = new Server({ name: "test", version: "1" }, { capabilities: { tools: {} } })
+    registerTools(server, api)
+    const [a, b] = InMemoryTransport.createLinkedPair()
+    const client = new Client({ name: "test", version: "1" })
+    await Promise.all([server.connect(a), client.connect(b)])
+    try {
+      const params = { mst: "1", apiKey: key }
+      const result = await client.callTool(proxy
+        ? { name: "execute_tool", arguments: { tool_name: "get_law_text", params } }
+        : { name: "get_law_text", arguments: params })
+      expect(JSON.stringify(result)).not.toContain(key)
+      expect(JSON.stringify(result)).toContain("***")
+    } finally {
+      await client.close()
+      await server.close()
+    }
+  })
+
+  it.each([false, true])("masks CLI output and errors: %s", async fail => {
+    vi.spyOn(law, "handler").mockImplementation(async () => {
+      if (fail) throw new Error(`OC=${key} credential: ${key}`)
+      return { content: [{ type: "text", text: `OC=${key} credential: ${key}` }] }
+    })
+    const result = await executeTool(api, law.name, { mst: "1", apiKey: key })
+    expect(JSON.stringify(result)).not.toContain(key)
+    expect(JSON.stringify(result)).toContain("***")
+    expect(Boolean(result.isError)).toBe(fail)
+  })
+
+  it("rejects oversized CLI article arguments before running the parser", async () => {
+    const handler = vi.spyOn(law, "handler")
+    const result = await executeTool(api, law.name, { mst: "1", jo: "1".repeat(200) })
+    expect(result.isError).toBe(true)
+    expect(handler).not.toHaveBeenCalled()
+  })
+})
```

---

### Incident Patch 2: `9acd0bdc` (2026-10-01)
**Commit Message**: fix: 조회 결과와 입력 처리 보정 (4.15.4) (#164)

* fix: 조회 결과와 입력 처리 보정

* docs: 릴리스 검증 결과 기록

**File**: `CHANGELOG.md` (modified, +26/-0)
```diff
@@ -1,5 +1,31 @@
 # Changelog
 
+## [4.15.4] - 2026-10-02
+
+전체 기능의 구현과 호출 경로를 검수했다. 노출 도구·입력 계약·의존성은 유지하며 재현한 오류를 수정한다.
+
+### Fixed
+
+- 판례 인용 추적은 공백이 포함된 2·4자리 연도 사건번호를 정규화한다. 사건번호 검색 결과가 대상과 다르면 다른 판례로 대체하지 않는다
+- HTML 판례 복구에서 다음 hop 전에 이전 본문을 취소한다. 요약은 참조조문·전문·이유 섹션 경계를 지키고, 본문 중 메타데이터로 원래 사건 정보를 덮지 않는다
+- 조문 상세·연혁·배치·행위시법은 JO 코드와 가지번호를 정확히 선택한다. 요청 조문이 전부 없으면 오류로 반환한다
+- 별표 번호가 알려진 단일 항목이 요청 번호와 다르면 반환하지 않는다. 별표 정본·부칙 보조 조회의 취소와 호출 예산 소진을 전파한다
+- 행정규칙 연혁의 현행·시행예정·폐지 표기를 실제 시행일 기준으로 판정한다
+- 인용조문 3단비교(`knd=1`)의 실제 응답 루트와 하위 조문 목록을 처리한다. 장·절 헤더를 제외하고 법률 본문과 연결된 하위 조문을 표시한다
+- 대량 법령 검색의 마지막 배치에서도 취소를 전파한다. 부분매칭 후보를 요청 법령의 변경 없음으로 확정하지 않는다
+- 조세심판·관세·소청·특별행정심판·기관 규정·조약·영문법령의 배열·wrapped 필드를 보존한다. 개인정보위·권익위 의결서 봉투와 노동위 판정 필드를 처리하고 기관 규정의 실제 기본정보를 표시한다. 노동위 등록일은 결정일과 구분한다
+- 통합 상세 조회의 명시적 ID를 options가 덮지 못하게 한다. 영문법령 공포일을 시행일로, 편·장·절 헤더를 조문으로 표시하지 않는다
+- 인용 검증 상한을 넘긴 법령·판례를 미검증으로 집계하고 전체 검증 표시를 하지 않는다. 취소 후 새 검증을 시작하거나 성공 결과를 반환하지 않는다
+- 조례 정비 레이더는 날짜가 불명확하면 반영 완료로 판단하지 않는다. `같은 법`은 앞에서 명시된 법령에 연결하고 무관한 시행령을 만들지 않는다
+- 시점 비교는 달력 날짜를 검증하고 역방향 비교의 전부개정 경고를 보존한다. 조문 비교에서 한글 개정 주석을 보존한다
+- 문서 위험 분석의 내부 500자 조문 절단을 제거해 조문 뒤쪽의 위험 문구도 분석한다. 출력 발췌·조문 수 상한은 유지한다
+- 시나리오의 일시 조회 실패를 누락하지 않고 실패 섹션으로 표시한다. 경쟁법 분쟁 준비는 공정위 검색·상세 경로를 사용한다
+- HTTP CORS에 MCP 프로토콜·지원 키 헤더를 허용하고 중복 OC 쿼리를 거부한다. 이미 취소된 fetch는 호출·예산 차감 전에 중단한다. 용어 매핑 폴백에서 명시적 키를 유지한다
+- 공식 법령·자치법규 링크의 경로와 식별자를 바로잡고 URL 인자를 인코딩한다. 영문 링크는 확인 가능한 영문법령 검색 화면으로 제공한다
+- CLI boolean 옵션을 보존하고 완전한 JSON 입력에 중복 필수 플래그를 요구하지 않는다. JSON의 API 키를 사용하고 텍스트 도구 목록에도 카테고리 필터를 적용한다
+
+검수 범위·재현·검증 기록: [전체 기능 프로덕션 리뷰](docs/PRODUCTION-REVIEW-2-2026-10-02.md).
+
 ## [4.15.3] - 2026-10-02
 
 프로덕션 조회 경로의 정확성·실행 한도·메모리 사용을 점검했다. 기능 추가 없이 버그 수정과 성능 개선만 반영한다.
```

**File**: `CLAUDE.md` (modified, +1/-1)
```diff
@@ -9,7 +9,7 @@
 >   - `.github/workflows/publish.yml`(GitHub Release → OIDC trusted publishing + provenance)은 **npm 쪽 trusted publisher 등록이 아직 안 됐다**. 그래서 게시는 위 로컬 `npm publish` 가 정규 경로이고, Release 는 그 뒤에 만든다 — 워크플로는 같은 버전이 이미 레지스트리에 있으면 게시를 건너뛰고 검증(typecheck·test·build·verify:package·audit)만 릴리스 시점에 재확인한다.
 > - **🚫 이 레포에서 `fly deploy` 직접 실행 절대 금지** — 통합 이미지를 law 단독 이미지로 덮어써 stats·patent·archhub·school까지 전부 죽는다. 자세한 배경: [docs/FLY-COST.md](docs/FLY-COST.md)
 
-Korean Law MCP Server v4.15.3 - 법제처 42개 API → 10개 통합 도구 (내부 99개) + 9개 시나리오 + 자연어 CLI + HTTP stateless + 판례 토큰 74% 감축 + **legal_research (체인 8종 통합, task 파라미터)** + **legal_analysis (인용검증·판례생사·행위시법·영향그래프 통합, mode 파라미터)** + **time_travel (시점 diff)** + **action_plan (이럴 땐 이렇게, 5단계 안내)** + **시행예정 감지 (search_law가 제명변경·미시행 개정 자동 병기)** + **ordinance_radar (조례 정비 레이더 — 근거 상위법 개정 자동 대조, v4.7.0)** + **인용 검증 표기 내성 (낫표·가운뎃점·`같은 법` 조응, v4.9.0)** + **폐지 감지 (검색 0건 시 폐지 법령·행정규칙 연혁 추적 — 폐지사유·후속 통합 규정 자동 안내, v4.10.0)** + **search_law_bulk (등록부 대량 조회 + MST diff 감시, v4.13.0)** + **행정규칙 부분 조회 (get_admin_rule 의 jo·chapter·keyword·page — 통짜 전문을 조문 단위로, v4.14.0)** + **법령ID 계보 연혁 (제명이 바뀌기 전 버전까지 — search_historical_law·applicable_law·time_travel, get_annexes date 시점 별표, get_law_text efYd 기준일 보정, 행정규칙 기준일 판단, v4.15.0)**
+Korean Law MCP Server v4.15.4 - 법제처 42개 API → 10개 통합 도구 (내부 99개) + 9개 시나리오 + 자연어 CLI + HTTP stateless + 판례 토큰 74% 감축 + **legal_research (체인 8종 통합, task 파라미터)** + **legal_analysis (인용검증·판례생사·행위시법·영향그래프 통합, mode 파라미터)** + **time_travel (시점 diff)** + **action_plan (이럴 땐 이렇게, 5단계 안내)** + **시행예정 감지 (search_law가 제명변경·미시행 개정 자동 병기)** + **ordinance_radar (조례 정비 레이더 — 근거 상위법 개정 자동 대조, v4.7.0)** + **인용 검증 표기 내성 (낫표·가운뎃점·`같은 법` 조응, v4.9.0)** + **폐지 감지 (검색 0건 시 폐지 법령·행정규칙 연혁 추적 — 폐지사유·후속 통합 규정 자동 안내, v4.10.0)** + **search_law_bulk (등록부 대량 조회 + MST diff 감시, v4.13.0)** + **행정규칙 부분 조회 (get_admin_rule 의 jo·chapter·keyword·page — 통짜 전문을 조문 단위로, v4.14.0)** + **법령ID 계보 연혁 (제명이 바뀌기 전 버전까지 — search_historical_law·applicable_law·time_travel, get_annexes date 시점 별표, get_law_text efYd 기준일 보정, 행정규칙 기준일 판단, v4.15.0)**
 
 ## Structure
 
```

**File**: `README-EN.md` (modified, +10/-0)
```diff
@@ -31,6 +31,16 @@
 
 ---
 
+## v4.15.4: Full feature review and fixes
+
+- Corrected case-number matching, summary boundaries, article/annex selection, and citation-mode three-tier responses
+- Preserved decision, treaty and English-law fields; marked skipped citations and failed scenario lookups
+- Corrected ordinance dates and parent-law references, and restored risk detection beyond truncated article excerpts
+- Fixed HTTP cancellation/key forwarding, competition research routing, official links and CLI inputs
+- Reviewed all 99 internal tools and 10 exposed tools. No new features or dependency changes. [Changelog](CHANGELOG.md), [review evidence](docs/PRODUCTION-REVIEW-2-2026-10-02.md)
+
+---
+
 ## v4.15.3: Retrieval correctness and performance
 
 - Exact case-number searches, per-case fallback validation, and explicit unconfirmed status when treatment scanning is disabled
```

**File**: `README.md` (modified, +10/-0)
```diff
@@ -30,6 +30,16 @@
 
 ---
 
+## v4.15.4: 전체 기능 검수·오류 수정
+
+- 판례 사건번호·요약 경계, 법령 조문·별표 선택, 인용조문 3단비교 응답 처리 수정
+- 결정문·영문법령·조약의 본문 필드 보존, 인용 검증 상한 초과와 시나리오 조회 실패 표시
+- 조례 정비 판단의 날짜·근거 법령 검증, 문서 분석의 조문 뒤쪽 위험 탐지 복구
+- HTTP·취소·키 전달, 공정위 리서치 경로, 공식 상세 링크와 CLI 입력 처리 수정
+- 기존 99개 내부 도구·10개 노출 도구 검수. 기능 추가·의존성 변경 없는 패치. [변경 내역](CHANGELOG.md), [검수 기록](docs/PRODUCTION-REVIEW-2-2026-10-02.md)
+
+---
+
 ## v4.15.3: 조회 정확성·성능 수정
 
 - 판례 사건번호 정확 검색, fallback 관련성 검증, 정밀 스캔 미실행 표시 수정
```

**File**: `docs/PRODUCTION-REVIEW-2-2026-10-02.md` (added, +79/-0)
```diff
@@ -0,0 +1,79 @@
+# 전체 기능 프로덕션 리뷰 — 4.15.4
+
+검토일: 2026-10-02. 4.15.3 이후 두 번째 검수이며, 범위를 전체 기능으로 확대했다. 기존 기능의 정확성·실행 한도·오류 전달을 검증하고 재현한 문제만 수정한다. 노출 도구와 입력 계약, 의존성은 유지한다.
+
+## 검수 범위
+
+도구 등록부의 내부 99개·노출 10개·카테고리 40개를 기준으로 구현과 호출 경로를 검수했다. 메타 도구를 제외한 97개 내부 도구의 카테고리 참조가 유효하며 중복 이름·누락된 별칭을 찾지 못했다.
+
+| 기능군 | 확인한 경로 |
+|---|---|
+| 법령 | 검색·대량 검색·현행 본문·조문 상세·배치 조문·연혁 검색/본문·조문 연혁/비교·신구대조·행위시법·통계 |
+| 법령 체계 | 인용/위임 3단비교·법령 트리·체계도·연계 조문·시행일·제명변경 계보 |
+| 행정규칙 | 검색·본문·JO/편/장/키워드/페이지 부분 조회·시점 버전·연혁·캐시 |
+| 별표 | 목록·단건·번호/가지/묶음 선택·시점/연혁·정본 병합·원문 링크·HWP/PDF 파싱 |
+| 판례 | 직접/통합 검색·정확 사건번호·본문 검색·기간·fallback 관련성·evidence·JSON/HTML 상세·full/compact·요약·캐시·인용 추적·유사/키워드·조문 인용 판례 |
+| 결정·해석·규정 | 18개 통합 도메인: 판례·법령해석·조세심판·관세·국세·헌재·행정심판·공정위·개인정보위·노동위·권익위·소청·특별행정심판·학칙·공사공단·공공기관·조약·영문법령 |
+| 자치법규 | 검색·본문·상위법 연결·조례 정비 레이더·법령 대비 체인 |
+| 분석 | 법령/판례 인용 검증·판례생사·행위시법·영향그래프·문서 유형/금액/위험 규칙·시점 비교 |
+| 리서치·안내 | legal_research 8 task·시나리오 9종·action_plan·갈래별 실패/시간 제한/취소·상세 후속 호출 |
+| 생활법령·지식 | 생활법령·AI 법령·법률용어·일상/법률 용어 매핑·관련 조문/법령·공식 외부 링크 |
+| 사용 경로 | execute_tool·discover_tools·등록부 최종 출력/마스킹·CLI 자연어/직접/JSON/REPL·STDIO·HTTP |
+| 공통 기반 | 요청 키 격리·CORS/Origin·인증·쿼리 키·rate limit·예산·retry/deadline·본문 정리·취소·캐시·배포 패키지 |
+
+전체 기능 검수는 코드와 회귀 검증의 범위다. 외부 API의 모든 문서·모든 입력 조합을 실호출했다는 뜻은 아니다. 실제 API 표본과 배포 검증은 아래에 별도로 기록한다.
+
+## 재현과 수정
+
+| 재현된 문제 | 수정·회귀 근거 |
+|---|---|
+| 띄어 쓴 사건번호가 대상 조회에서 누락, 다른 사건을 대상 대체 | 2·4자리 연도 사건번호 정규화와 정확 대상 검증 (`cite-check.review2`) |
+| HTML 복구 hop의 미독 본문 잔류, 판례 요약 섹션 혼입·사건정보 덮임 | 본문 취소·요약 경계·첫 메타데이터 유지 (`precedent-fallback.review2`, `precedent-summary`) |
+| 상세 API가 JO 조건을 무시하거나 6자리 코드가 재해석됨 | 번호/가지 필터·공통 JO 변환, 전체 조문 미스 오류 (`article-detail`, `historical-law`, `batch-articles.review`, `applicable-law.review`) |
+| 번호가 다른 유일한 별표가 요청 별표로 반환됨 | 알려진 번호 불일치 거부, 무번호 폴백 유지 (`annex-select.review`) |
+| 별표 정본·행위시법 부칙 조회가 실행 예산 소진을 삼킴 | 공용 fatal 오류 전파 (`annex-merge-marker`, `applicable-law.review`) |
+| 행정규칙 연혁의 API 플래그가 실제 시행 상태와 다름 | 한국 날짜·시행일 기준 판정 (`admin-rule.current-state`) |
+| 인용조문 3단비교가 항상 데이터 없음 오류 | 실제 `ThdCmpLawXService`와 하위 목록 어댑터, 법률 본문 보존 (`three-tier.citation` + 키 없는 실제 응답 fixture) |
+| 대량 검색 마지막 배치 취소 무시·부분매칭을 변경 없음으로 확정 | 완료 전 취소 확인·불확정 후보 구분 (`search-bulk`) |
+| 일부 결정·조약·영문법령의 객체/배열 필드 손실, 상세 ID 덮임, 공포일을 시행일로 표기 | 공유 fieldText/decisionFields 적용·ID 보호·알 수 없는 시행일 N/A (`decision-domains.production`) |
+| 실제 위원회 의결서 봉투·노동위 판정 필드·기관 규정 기본정보 누락, 등록일을 결정일로 표기 | 실제 응답 경로와 필드 매핑·등록일 별도 표시 (`committee-detail.live-shape`, `institutional-detail.live-shape`) |
+| 영문 편·장·절 헤더를 Article 0001로 표시 | 실제 응답의 joYn=N 헤더 보존 (`english-law.headings`) |
+| 검증 상한 이후 인용까지 VERIFIED로 표시·취소 후 검증 지속 | 미검증 집계와 PARTIAL 표시·취소 전파 (`verify-citations.production`, 기존 budget 테스트 유지) |
+| 조례 날짜 불명확 시 완료 판단·이웃 법령 시행령을 잘못 생성 | 달력 날짜 검증·순서대로 같은 법 연결 (`ordinance-radar.review2`) |
+| 역방향 시점 비교에서 전부개정 경고 누락·한글 개정 주석 제거 | 구간 정규화·공유 cleanHtml (`time-travel.review2`, `time-travel-diff`) |
+| 문서 조문 500자 이후 위험 문구 분석 누락 | 분석 전 조문 절단 제거, 출력 상한 유지 (`document-analysis`) |
+| 시나리오 보조 조회 실패 누락·경쟁법 리서치에서 공정위 경로 누락 | 오류 섹션 보존·기존 공정위 handler 연결 (`scenarios/failures.production`, `chains.competition.production`) |
+| SDK CORS 헤더 거부·중복 OC를 키로 인정·취소된 fetch가 호출 예산 사용 | 허용 헤더·키 입력 검증·호출 전 취소 (`http-server.contract`, `fetch-with-retry.cancel`) |
+| 용어 매핑 폴백에서 사용자 키 유실·공식 링크 404/잘못된 식별자 | 명시적 키 유지·공식 GET 확인 경로·URL 인코딩 (`knowledge-base.key`, `external-links`) |
+| CLI boolean이 false로 변환·완전한 JSON에도 필수 플래그 요구·JSON 키 무시·목록 필터 누락 | 실제 Commander 파싱 검증 (`cli.production`) |
+
+인용 3단비교는 관세법 실제 호출에서 `knd=1`만 오류, `knd=2`는 정상인 상태를 확인한 뒤 원문 응답과 LexDiff 원본을 대조했다. 기존 이식 파서의 동작을 바꾸지 않고 별도 어댑터로 처리한다. 경쟁법 체인 수정에 필요한 라우팅 코드는 별도 파일로 옮겨 기존 chains.ts를 1,200줄 아래로 줄였다.
+
+공식 링크는 실제 GET 응답으로 확인했다. 법령ID를 lsiSeq로 잘못 넣은 주소와 영문 상세 주소는 404였고, 법령ID 전용 본문 주소와 영문 검색 화면은 200이었다. 법령체계도 주소는 연혁이 아닌 실제 화면 역할로 표시한다.
+
+## 검증 결과
+
+- 기준 131개 파일·1,181개 테스트 → 수정본 149개 파일·1,277개 테스트. 신규 회귀 96개.
+- `npm run gc`: 타입·미사용 코드·전체 테스트·clean build 통과.
+- 별도 리뷰: 변경 관련 25개 파일·172개 테스트 통과, 추가 P1/P2 결함 없음.
+- 실제 API 응답 수정 후 추가 리뷰: 6개 파일·25개 테스트와 타입 검사 통과. 등록일 오표시를 추가 수정했으며 남은 P1/P2 결함 없음.
+- 프로덕션 의존성 감사: `npm audit --omit=dev --omit=optional` 취약점 0.
+
+실제 API는 법령·행정규칙·별표·자치법규·영문·조약 18개 도구 표본에서 모두 정상 응답을 확인했다. 민법 JO `000100`, 동일 MST의 20250131 시행 슬라이스, 외국환거래규정 제9-5조, 별표28 HWP 14,822자, 관세법 인용 3단비교를 포함한다.
+
+결정 도메인 18개 전부 실제 검색 결과 ID를 확보해 상세를 호출했다. 국세 해석 상세는 기존 명시적 NOT_SUPPORTED 계약이다. 위원회 본문 누락을 실응답으로 재현한 뒤 다시 호출해 개인정보위 67→547자, 노동위 71→568자, 권익위 65→1,504자로 본문과 메타데이터가 복구된 것을 확인했다. 노동위는 등록일만 있는 실제 자료의 결정일을 N/A로 유지한다.
+
+legal_research 8 task, 생활/용어/지식베이스 9개 표본, legal_analysis 4 mode, time_travel·action_plan·ordinance_radar 표본도 정상 응답을 확인했다. 체인의 보조 검색 0건은 해당 섹션에 표시하며 자료를 만들어 채우지 않는다.
+
+지원 Node 20.19.0·22.12.0에서 각각 전체 1,277개 테스트를 통과했다. 실제 npm tarball을 optional/dev 의존성 없이 설치해 두 버전에서 PDF 별표 파싱, STDIO 초기화·도구 10개·JO 변환, 설치된 CLI 심링크·JSON·카테고리 필터를 검증했다. 패키지 파일 306개와 비실호출 CJS 회귀 13개도 통과했다. 동시에 런타임 테스트를 실행할 때 기존 시간비율 검사 1건이 경계값을 넘었으나 독립 전체 재실행과 최종 순차 실행에서는 통과했다.
+
+npm 전파를 확인한 뒤 통합 호스트의 법령 패키지 핀만 4.15.4로 올린다. 배포 후 공유 검증 스크립트로 5개 MCP 핸드셰이크·쿼리 키·대형 법령을 확인하고,
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "korean-law-mcp",
-  "version": "4.15.3",
+  "version": "4.15.4",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "korean-law-mcp",
-      "version": "4.15.3",
+      "version": "4.15.4",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.27.1",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "korean-law-mcp",
-  "version": "4.15.3",
+  "version": "4.15.4",
   "description": "법제처 42개 API → 9개 MCP 도구. 법령·판례·조례·조약 + 다단계 리서치(legal_research, 8 task) + 정밀분석(legal_analysis: 인용검증·판례생사·행위시법·영향그래프) + 시점 비교(time_travel) + 상황별 5단계 안내(action_plan) + 국세청 해석례(nts)",
   "type": "module",
   "main": "build/index.js",
```

**File**: `src/cli.production.test.ts` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
+import { createProgram } from "./cli.js"
+import { allTools } from "./tool-registry.js"
+
+beforeEach(() => {
+  vi.stubEnv("LAW_OC", "test-cli-key")
+  vi.spyOn(console, "log").mockImplementation(() => {})
+  vi.spyOn(console, "error").mockImplementation(() => {})
+  vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("CLI exited") })
+})
+afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs() })
+
+async function run(...args: string[]) {
+  return createProgram().exitOverride().configureOutput({ writeErr: () => {} }).parseAsync(["node", "cli", ...args])
+}
+
+describe("CLI advertised arguments", () => {
+  it("accepts a complete JSON input without duplicated required flags", async () => {
+    await run("parse_jo_code", "--json-input", JSON.stringify({ joText: "제38조" }))
+    expect(vi.mocked(console.log).mock.calls.flat().join("\n")).toContain("003800")
+  })
+
+  it("uses an API key supplied inside JSON input", async () => {
+    vi.stubEnv("LAW_OC", "")
+    await run("parse_jo_code", "--json-input", JSON.stringify({ joText: "제38조", apiKey: "json-test-key" }))
+    expect(vi.mocked(console.log).mock.calls.flat().join("\n")).toContain("003800")
+  })
+
+  it("preserves Commander boolean flags as true", async () => {
+    const handler = vi.spyOn(allTools.find(t => t.name === "get_precedent_text")!, "handler")
+      .mockResolvedValue({ content: [{ type: "text", text: "전문" }] })
+    await run("get_precedent_text", "--id", "1", "--full")
+    expect(handler.mock.calls[0][1]).toMatchObject({ id: "1", full: true })
+  })
+
+  it("text and JSON tool lists apply the same category filter", async () => {
+    await run("list", "--category", "판례", "--json")
+    const selected = JSON.parse(String(vi.mocked(console.log).mock.calls[0][0]))
+    vi.mocked(console.log).mockClear()
+    await run("list", "--category", "판례")
+    const text = vi.mocked(console.log).mock.calls.flat().join("\n")
+    expect(selected.length).toBeGreaterThan(0)
+    expect(text).toContain(`${selected.length}개 도구`)
+    expect(text).not.toContain("get_law_text")
+  })
+
+  it("still rejects missing required tool inputs", async () => {
+    await expect(run("parse_jo_code")).rejects.toThrow()
+  })
+})
```

---

### Incident Patch 3: `5756d964` (2026-10-01)
**Commit Message**: fix: 조회 정확성과 실행 한도 보정

**File**: `CHANGELOG.md` (modified, +26/-0)
```diff
@@ -1,5 +1,31 @@
 # Changelog
 
+## [4.15.3] - 2026-10-02
+
+프로덕션 조회 경로의 정확성·실행 한도·메모리 사용을 점검했다. 기능 추가 없이 버그 수정과 성능 개선만 반영한다.
+
+### Fixed
+
+- 사건번호만 입력한 판례 검색은 해당 사건을 우선 조회한다. 번호 접두가 같은 다른 사건을 제외하고, 명시적 본문검색(`search=2`)은 인용 검색을 유지한다
+- 판례 fallback 관련성은 개별 판례에서 검증한다. 서로 다른 판례의 키워드를 합쳐 통과시키지 않으며, 요청 기간 밖 결과도 검증한다
+- 판례 상세·검증·근거 조회는 취소와 호출 예산 소진을 전파한다. 취소 뒤 HTML 복구나 다른 검색어 재시도를 시작하지 않는다
+- 판례 인용 추적은 정확한 대상 사건을 우선한다. 부분 입력으로 특정한 사건은 그 사건번호로 후속 판결을 검색하고, 정밀 스캔을 끄면 변경·폐기 여부를 미확정으로 표시한다. 사건번호 접두가 같은 다른 판례를 변경 신호로 오인하지 않는다
+- 판례·헌재·행정심판·위원회 결정문·법령해석례의 배열과 `#text`/`_` JSON 필드를 본문·메타데이터에서 보존한다
+- 업스트림 헤더 수신 뒤 검사와 본문 읽기에도 전체 데드라인을 적용한다. 본문이 조금씩 계속 오는 경우도 한도를 넘기지 않는다. 취소·HTTP 오류·안티봇 복구에서 본문 정리 완료를 기다리며 멈추지 않는다
+- 행위시법 비교는 같은 MST의 서로 다른 시행일 슬라이스도 대조하고 목 본문을 보존한다. 존재하지 않는 달력 날짜는 거부한다
+- 조문 조회는 업스트림이 JO 조건을 무시해도 요청 조문만 반환한다. 복수 조문 조회의 숫자 조문번호와 마지막 처리 중 취소를 처리한다
+- 조문 개정 이력은 정확히 일치하는 법령이 없으면 다른 법령의 첫 검색 결과를 채택하지 않는다
+- 별표 번호의 숫자·가지 경계를 확인한다. 별표 1에 10/1의2, 1의2에 1의20/1~5 묶음이 선택되지 않는다
+- 체인 갈래 완료·실패 시 취소 리스너를 해제한다. CLI JSON 응답은 상세 조회 실패를 `isError`와 종료 코드에 반영한다
+
+### Performance
+
+- 판례의 파싱된 원문을 전용 20건 캐시에 보관한다. full/축약 조회와 인용 추적이 공유하며, 같은 판례의 JSON 파싱과 상세 재요청을 줄인다. 원시 JSON 사본은 보관하지 않는다
+- 복수 조문 조회 안에서 동일 법령의 진행 중 전문 조회를 공유한다. 동일 법령 동시 2회 요청은 업스트림 1회로 처리하고, 완료 후 진행 중 참조를 해제한다
+- 상태 코드가 이미 오류인 HTTP 응답은 본문을 읽고 버퍼링하지 않고 취소한다
+
+검토 범위와 회귀 검증 근거: [프로덕션 리뷰](docs/PRODUCTION-REVIEW-2026-10-02.md).
+
 ## [4.15.2] - 2026-10-01
 
 최근 릴리스(4.14.0~4.15.1)를 다시 감사해 조용히 틀린 답을 내거나 느려지던 곳을 고쳤다. 노출 도구와 인자는 그대로다. 테스트 1119 통과.
```

**File**: `CLAUDE.md` (modified, +3/-3)
```diff
@@ -9,7 +9,7 @@
 >   - `.github/workflows/publish.yml`(GitHub Release → OIDC trusted publishing + provenance)은 **npm 쪽 trusted publisher 등록이 아직 안 됐다**. 그래서 게시는 위 로컬 `npm publish` 가 정규 경로이고, Release 는 그 뒤에 만든다 — 워크플로는 같은 버전이 이미 레지스트리에 있으면 게시를 건너뛰고 검증(typecheck·test·build·verify:package·audit)만 릴리스 시점에 재확인한다.
 > - **🚫 이 레포에서 `fly deploy` 직접 실행 절대 금지** — 통합 이미지를 law 단독 이미지로 덮어써 stats·patent·archhub·school까지 전부 죽는다. 자세한 배경: [docs/FLY-COST.md](docs/FLY-COST.md)
 
-Korean Law MCP Server v4.15.2 - 법제처 42개 API → 10개 통합 도구 (내부 99개) + 9개 시나리오 + 자연어 CLI + HTTP stateless + 판례 토큰 74% 감축 + **legal_research (체인 8종 통합, task 파라미터)** + **legal_analysis (인용검증·판례생사·행위시법·영향그래프 통합, mode 파라미터)** + **time_travel (시점 diff)** + **action_plan (이럴 땐 이렇게, 5단계 안내)** + **시행예정 감지 (search_law가 제명변경·미시행 개정 자동 병기)** + **ordinance_radar (조례 정비 레이더 — 근거 상위법 개정 자동 대조, v4.7.0)** + **인용 검증 표기 내성 (낫표·가운뎃점·`같은 법` 조응, v4.9.0)** + **폐지 감지 (검색 0건 시 폐지 법령·행정규칙 연혁 추적 — 폐지사유·후속 통합 규정 자동 안내, v4.10.0)** + **search_law_bulk (등록부 대량 조회 + MST diff 감시, v4.13.0)** + **행정규칙 부분 조회 (get_admin_rule 의 jo·chapter·keyword·page — 통짜 전문을 조문 단위로, v4.14.0)** + **법령ID 계보 연혁 (제명이 바뀌기 전 버전까지 — search_historical_law·applicable_law·time_travel, get_annexes date 시점 별표, get_law_text efYd 기준일 보정, 행정규칙 기준일 판단, v4.15.0)**
+Korean Law MCP Server v4.15.3 - 법제처 42개 API → 10개 통합 도구 (내부 99개) + 9개 시나리오 + 자연어 CLI + HTTP stateless + 판례 토큰 74% 감축 + **legal_research (체인 8종 통합, task 파라미터)** + **legal_analysis (인용검증·판례생사·행위시법·영향그래프 통합, mode 파라미터)** + **time_travel (시점 diff)** + **action_plan (이럴 땐 이렇게, 5단계 안내)** + **시행예정 감지 (search_law가 제명변경·미시행 개정 자동 병기)** + **ordinance_radar (조례 정비 레이더 — 근거 상위법 개정 자동 대조, v4.7.0)** + **인용 검증 표기 내성 (낫표·가운뎃점·`같은 법` 조응, v4.9.0)** + **폐지 감지 (검색 0건 시 폐지 법령·행정규칙 연혁 추적 — 폐지사유·후속 통합 규정 자동 안내, v4.10.0)** + **search_law_bulk (등록부 대량 조회 + MST diff 감시, v4.13.0)** + **행정규칙 부분 조회 (get_admin_rule 의 jo·chapter·keyword·page — 통짜 전문을 조문 단위로, v4.14.0)** + **법령ID 계보 연혁 (제명이 바뀌기 전 버전까지 — search_historical_law·applicable_law·time_travel, get_annexes date 시점 별표, get_law_text efYd 기준일 보정, 행정규칙 기준일 판단, v4.15.0)**
 
 ## Structure
 
@@ -115,7 +115,7 @@ korean-law get_law_text --mst 160001 --jo "제1조"
 - `MCP_MAX_UPSTREAM_REQUESTS`: 한 outer request가 사용할 수 있는 upstream attempt 수 (기본 `48`, 재시도/안티봇 hop 포함)
 - `MCP_MAX_UPSTREAM_BODY_BYTES` / `MCP_MAX_TOTAL_UPSTREAM_BODY_BYTES`: 단일/전체 upstream 응답 본문 byte 한도
 - `MCP_MAX_TOOL_RESPONSE_CHARS`: MCP 도구 응답 문자 한도 (기본 `50000`)
-- `MCP_CHAIN_DEADLINE_MS`: 체인 한 건의 데드라인 (기본 `45000`, 허용 `5000`~`300000`, HTTP 모드는 부팅 시점 fail-fast 검증). **적용 task는 `legal_research` 8종 중 `document_review` 를 뺀 7종** (v4.14.1: `law_system`·`amendment_track`·`ordinance_compare`·`procedure_detail` 추가, 공용 `withChainDeadline` 헬퍼). `document_review` 는 기반 법령 프리픽스가 없고 갈래 수가 고정이라 개별 fetch 한도(전체 45초)만 건다. 적용 체인은 기반 법령 탐색(프리픽스)부터 시계 안이며, 만료 시 받은 갈래까지 조립해 **부분 결과**를 돌려주고 못 받은 자리는 마커로 남긴다 — MCP 클라이언트 기본 타임아웃 60초보다 넉넉히 짧게 잡을 것
+- `MCP_CHAIN_DEADLINE_MS`: 체인 한 건의 데드라인 (기본 `45000`, 허용 `5000`~`300000`, HTTP 모드는 부팅 시점 fail-fast 검증). `legal_research` 8종과 `get_law_statistics`에 적용한다. 적용 체인은 기반 법령 탐색(프리픽스)부터 시계 안이며, 만료 시 받은 갈래까지 조립해 **부분 결과**를 돌려주고 못 받은 자리는 마커로 남긴다 — MCP 클라이언트 기본 타임아웃 60초보다 넉넉히 짧게 잡을 것
 
 ## Domain Knowledge
 
@@ -159,7 +159,7 @@ get_law_text(mst, jo="006300") → 제63조(휴직) 조회
 7. **cleanHtml 재사용**: HTML 엔티티 디코딩은 `article-parser.ts`의 `cleanHtml()` 사용 (수동 디코딩 금지). 태그 제거는 영문 태그·주석만이다: `<개정 2012.8.1.>`·`부칙 <제N호,…>` 같은 한글 꺾쇠 표기는 개정 시점 근거라 남긴다(v4.14.2)
 8. **console.log/error 금지**: STDIO 모드에서 간섭 방지. 에러는 throw로 전파. HTTP 모드 에러 로깅은 반드시 `scrubError()` 경유 (API 키 유출 방지)
 9. **String() 방어 코딩**: MCP 클라이언트가 숫자를 보낼 수 있음 — `URLSearchParams.append(key, String(value))` 사용
-10. **캐시 키 분리**: `lawtext:` (law-text.ts, 문자열, lawCache), `batch:` (batch-articles.ts, 파싱된 JSON 객체, **전용 `batchLawCache` 12건**: 전역 500건 캐시에 두면 큰 법령 한 건이 힙 4MB 대라 메모리를 먹는다), `admrulxml:` (admin-rule-doc.ts `AdminRuleDoc` 파싱 문서, 전용 캐시 20건 — applicable-admin-rule 의 선적재만 XML 문자열을 넣고 get_admin_rule 이 첫 조회 때 문서로 바꿔 넣는다), `mstlawid:` (law-text.ts, mst→법령ID 문자열, 24시간), `lineage:` (law-text.ts, 법령ID 계보 `HistoricalVersion[]`, 1시간), `precjson:` (precedents.ts, 판례 원문 JSON 문자열, 24시간 — 렌더(full·축약)만 갈리고 원문은 같다) — 타입 충돌 금지. lawId 만 준 "현행" 본문은 개정 시행일을 넘기면 낡으므로 TTL 1시간(MST·efYd 는 24시간)
+10. **캐시 키 분리**: `lawtext:` (law-text.ts, 문자열, lawCache), `batch:` (batch-articles.ts, 파싱된 JSON 객체, **전용 `batchLawCache` 12건**: 전역 500건 캐시에 두면 큰 법령 한 건이 힙 4MB 대라 메모리를 먹는다), `admrulxml:` (admin-rule-doc.ts `AdminRuleDoc` 파싱 문서, 전용 캐시 20건 — applicable-admin-rule 의 선적재만 XML 문자열을 넣고 get_admin_rule 이 첫 조회 때 문서로 바꿔 넣는다), `mstlawid:` (law-text.ts, mst→법령ID 문자열, 24시간), `lineage:` (law-text.ts, 법령ID 계보 `HistoricalVersion[]`, 1시간), `precedentCache` (precedents.ts, 전용 20건, ID:caseName 키, 파싱된 PrecService record, 24시간 — 상세 full·축약 렌더와 cite_check가 공유하며 원시 JSON은 보관하지 않는다) — 타입 충돌 금지. lawId 만 준 "현행" 본문은 개정 시행일을 넘기면 낡으므로 TTL 1시간(MST·efYd 는 24시간)
 11. **API 키 마스킹**: URL/에러 메시지 외부 노출 전 `maskSensitiveUrl()` 적용. 새 fetch 래퍼 추가 시 주의. 도구 **출력 전체**는 tool-registry 최종 게이트가 `maskKeysInText()` 로 한 번
```

**File**: `README-EN.md` (modified, +10/-0)
```diff
@@ -31,6 +31,16 @@
 
 ---
 
+## v4.15.3: Retrieval correctness and performance
+
+- Exact case-number searches, per-case fallback validation, and explicit unconfirmed status when treatment scanning is disabled
+- A bounded cache of 20 parsed precedent records shared by text retrieval and citation tracking
+- Shared in-progress statute reads within a batch of article requests
+- Total deadlines and cancellation through body reads; corrected annex/article selection and effective-date slice comparisons
+- Patch release with no added features. [Changelog](CHANGELOG.md), [review evidence](docs/PRODUCTION-REVIEW-2026-10-02.md)
+
+---
+
 ## v4.15.2: Audit fixes for recent releases
 
 An audit of 4.14.0 to 4.15.1 turned up places that gave silently wrong answers or ran slow. Exposed tools and arguments are unchanged.
```

**File**: `README.md` (modified, +10/-0)
```diff
@@ -30,6 +30,16 @@
 
 ---
 
+## v4.15.3: 조회 정확성·성능 수정
+
+- 판례 사건번호 정확 검색, fallback 관련성 검증, 정밀 스캔 미실행 표시 수정
+- 판례 파싱 결과를 20건 전용 캐시에 보관하고 상세 조회·인용 추적에서 공유
+- 같은 법령의 동시 조문 요청에서 전문 조회 중복 제거
+- 본문 수신까지 전체 시간 한도·취소 적용, 별표 번호·조문·시행일 슬라이스 오선택 수정
+- 기능 추가 없이 패치 릴리스. [변경 내역](CHANGELOG.md), [검토·검증 기록](docs/PRODUCTION-REVIEW-2026-10-02.md)
+
+---
+
 ## v4.15.2: 최근 릴리스 감사·수정
 
 4.14.0~4.15.1 을 다시 감사해 조용히 틀린 답을 내거나 느려지던 곳을 고쳤습니다. 노출 도구와 인자는 그대로입니다.
```

**File**: `docs/PRECEDENT-SEARCH-GUIDELINES.md` (modified, +3/-2)
```diff
@@ -20,7 +20,7 @@
 - `src/tools/precedent-search-core.ts`
   - `searchPrecedentsStructured()`가 판례 목록 검색의 공통 진입점이다.
   - 반환값은 `StructuredPrecedentSearchResult`이며 `hits`, `attempts`, `fallbackUsed`, `successfulAttempt`를 포함한다.
-  - 1차 검색은 명시 사건번호가 있으면 `caseNumber`, 아니면 원문 `query`로 수행한다.
+  - 1차 검색은 명시 사건번호 또는 사건번호만인 `query`가 있으면 정확 사건번호로 수행한다. 정확 검색은 이웃 번호를 제외하고 실패 시 다른 판례로 대체하지 않는다. 명시적 `search=2`의 query는 역인용 본문검색을 유지한다.
   - 기본 fallback 정책은 `"full"`이다. 제목 검색 실패 시 본문검색(`search=2`)을 먼저 시도하고, 이후 compact query 후보를 시도한다.
   - `fallbackPolicy: "body"`는 본문검색까지만 허용한다.
   - `fallbackPolicy: "none"`은 보정 검색을 하지 않는다.
@@ -40,6 +40,7 @@
   - 상세조회 기본 개수는 2건이고, 최대 5건으로 제한한다.
 
 - `src/tools/precedents.ts`
+  - 파싱된 판례 원문을 전용 20건 `precedentCache`에 24시간 보관한다. full/축약 렌더와 `cite_check`가 공유한다.
   - `searchPrecedents()`는 구조화 core를 호출한 뒤 `renderPrecedentSearchResult()`로 기존 텍스트 형식으로 렌더링한다.
   - 결과가 없으면 `[NOT_FOUND]`와 재시도 힌트를 포함하고 `isError`를 설정한다.
   - 결과가 있으면 `[id] 제목`, 사건번호, 법원, 선고일, 판결유형, 링크를 유지한다.
@@ -51,7 +52,7 @@
 
 - `src/tool-registry.ts`
 - `search_precedents`와 `get_precedent_text`는 별도 도구로 등록된다.
-- v3 exposed profile에서는 직접 노출 도구가 제한된다. 현재 직접 노출 도구는 `V3_EXPOSED`에 있는 17개이며, `search_precedents`와 `get_precedent_text`는 직접 노출되지 않는다.
+- v3 exposed profile에서는 직접 노출 도구가 제한된다. 현재 직접 노출 도구는 `V3_EXPOSED`에 있는 10개이며, `search_precedents`와 `get_precedent_text`는 직접 노출되지 않는다.
 - `execute_tool`, `search_decisions`, `get_decision_text`를 통한 우회 호출도 고려한다.
 
 ### 직접 판례 검색과 본문조회
```

**File**: `docs/PRODUCTION-REVIEW-2026-10-02.md` (added, +66/-0)
```diff
@@ -0,0 +1,66 @@
+# 프로덕션 리뷰 — 4.15.3
+
+검토일: 2026-10-02. 목적은 조회 정확성, 외부 API 부하, 메모리와 실행 한도 개선이다. 기능을 추가하지 않는다.
+
+## 범위
+
+| 경로 | 확인 내용 |
+|---|---|
+| MCP 등록·메타 도구·CLI | 입력·출력 최종 게이트, 스키마 광고, 상세 파이프라인 오류 전달 |
+| HTTP·업스트림 공통 | 인증·Origin·쿼리 키·rate limit·요청 예산 연결, retry·deadline·본문 크기·취소·안티봇 정리 |
+| 판례 | 직접·통합 검색, includeText, evidence, fallback 관련성, 상세 JSON·국세 HTML 복구, 캐시, 인용 추적 |
+| 법령·행정규칙·연혁 | 조문 선택, 기준일 버전·분리 시행, 조문 개정 이력, 행정규칙 뷰·캐시 |
+| 별표·체인 | 번호·가지·묶음 선택, 법령 전문 중복 조회, 시간 한도와 완료 작업 정리 |
+| 기타 결정 도메인 | 헌재·행정심판·위원회·해석례 JSON 필드 보존 |
+| 패키지·통합 배포 | npm 산출물, optional 없는 프로덕션 의존성, Node 하한, 5종 MCP 핸드셰이크·쿼리 키·대형 본문 |
+
+별도 리뷰에서 변경분의 P1/P2 회귀를 찾지 못했다. 이 기록은 코드·회귀 테스트·명시된 실호출의 검증 범위를 뜻하며, 모든 외부 자료나 법률 판단을 검증했다는 뜻은 아니다.
+
+## 수정한 문제와 재현 근거
+
+| 문제 | 수정 | 회귀 테스트 |
+|---|---|---|
+| 사건번호 query가 대상 대신 인용 판례를 반환 | 순수 번호는 nb 우선, 이웃 사건 제외, 실패 시 다른 사건으로 대체하지 않음 | precedent-production |
+| 여러 판례의 키워드를 합쳐 관련성 인증, 기간 완화 때 검증 우회 | 개별 판례 기준 검증, 기간 밖 후보도 검증 | precedent-production |
+| 판례 복구·검증·근거 조회가 취소·예산 소진을 삼킴 | fatal 오류 전파, 추가 복구·재검색 중단 | precedent-production |
+| 사건번호 prefix를 정확 대상·변경 신호로 오인 | 정확 인용 경계, 대상 보정 후 실제 번호로 후속 검색 | cite-check-production |
+| 미스캔 또는 본문 대상 인용 불일치를 계속 인용으로 인증 | 미확정·인용 확인 불가 표시, 대상보다 오래된 판결 제외 | cite-check-production |
+| wrapped JSON 필드가 `[object Object]`로 출력 | 공유 fieldText로 필드 평탄화 | precedent-production, decision-body.review |
+| 헤더·검사 이후 전체 timeout 해제, 계속 오는 청크가 무제한 | 반환 Response의 공용 본문 리더까지 절대 deadline 적용 | fetch-deadline, response-body.deadline |
+| 호출자 취소가 본문 검사·최종 본문에 누락 | 해당 읽기에 취소 전파, 만료된 미독 본문도 정리 | fetch-deadline |
+| 취소 Promise를 기다리며 retry·안티봇·HTTP 오류 처리 중단 | 정리 취소를 기다리지 않음, 오류 상태 본문 버퍼링 제거 | api-client.error-body, law-antibot.cleanup |
+| 같은 MST의 다른 시행일 비교 누락, 목 내용 누락, 잘못된 달력 날짜 수용 | mst+efYd 비교, 공용 조문 포맷터, 달력 유효성 검사 | applicable-law.review |
+| 다른 법령의 첫 LIKE 결과로 개정 이력 조회 | 정확 명칭·약칭이 없으면 lawId 재확인 안내 | article-history |
+| JO가 무시되면 다른 조문이 성공 응답 | 반환 조문번호·가지 확인, 기존 조문 표기 변환 재사용 | law-text.review |
+| 숫자 조문번호 오류, 같은 법령 중복 조회, 마지막 처리 중 취소 후 성공 | 숫자 정규화, 요청 내부 진행 중 전문 공유, 완료 전 취소 확인 | batch-articles.review |
+| 별표 1에 10/1의2, 1의2에 1의20/묶음 오선택 | 숫자·가지 경계, 가지 요청의 묶음 범위 제외 | annex-select.review |
+| 완료된 체인 작업의 abort listener 잔류 | race 완료·실패 시 listener 제거 | chain-deadline.review |
+| CLI 상세 실패를 JSON 성공·종료 코드 0으로 출력 | 전체 파이프라인 isError 누적, 오류 종료 코드 | cli-executor.errors |
+
+새 회귀는 수정 전 실패를 재현한 뒤 수정 후 통과를 확인했다. 수정한 경로의 정상 입력과 기존 통합 계약도 함께 검증했다.
+
+## 성능 근거
+
+- 판례 원문: 종전 전역 500건 raw JSON 캐시 대신 전용 20건 parsed record 캐시. 24시간 TTL, full/compact/cite_check 공유. 원시 JSON 사본을 함께 보관하지 않는다.
+- 동일 판례 full+compact 조회는 상세 API 1회·JSON.parse 1회. full→cite_check→cite_check도 상세 API 합계 1회. 회귀 테스트로 횟수 확인.
+- 100만자 JSON 100회 합성 측정: raw 캐시 후 재파싱 103.8ms, parsed 캐시 조회 0.14ms. 네트워크·렌더를 제외한 측정이며 전체 응답 속도 개선율로 해석하지 않는다.
+- 같은 법령의 동시 batch 항목 2개: 전문 API 호출 2회→1회. 공유 범위는 한 get_batch_articles 호출 안이며, 완료 후 진행 중 참조를 해제한다.
+- 오류 HTTP 상태는 이미 분류 가능하므로 본문을 읽고 버퍼링하지 않는다. 멈춘 본문·끝나지 않는 cancel Promise로 오류 처리가 지연되는 회귀를 차단했다.
+
+## 검증
+
+- 기준: 119개 파일 / 1,119개 테스트 통과. 수정본: 131개 파일 / 1,181개 테스트 통과.
+- `npm run gc`: 타입·미사용 코드·전체 테스트·clean build 통과.
+- `npm run verify:package`: 302개 패키지 파일 검증. `npm audit --omit=dev`: 취약점 0.
+- 실제 npm tarball을 별도 디렉터리에 `--omit=dev --omit=optional --ignore-scripts`로 설치해 Node 20.19.0의 PDF 별표 파싱과 stdio 초기화·10개 도구 목록·JO 변환을 확인했다.
+- 지원 런타임 Node 20.19.0과 22.12.0에서 전체 테스트 검증.
+- 판례 core·evidence·HTML fallback·검색 범위·includeText·research/detail 체인 및 통합 도구 디스패치 CJS 회귀 검증.
+- 실제 HTTP 청크 스트림에서 전체 한도 만료 후 업스트림 연결 종료 검증.
+- 배포 전 통합 호스트의 5종 핸드셰이크, `?oc=` 실호출, 도로교통법 시행규칙 큰 본문 조회 통과.
+
+## 유지하는 한계
+
+- 판례 캐시는 건수 제한이며 바이트별 제한은 아니다. 서로 다른 요청의 동시 cache miss를 전역 Promise로 합치지 않는다.
+- 인용 추적은 법제처 수록 범위와 최대 3건 본문 스캔·휴리스틱에 따른다. 변경 신호가 없는 것이 판례의 법적 유효성을 증명하지 않는다.
+- 전체 fetch deadline은 공용 readResponse* 리더에 적용한다. Native Response 메서드를 변형하지 않으며 프로덕션의 직접 본문 읽기 우회가 없음을 확인했다.
+- 배포 머신은 현재 nrt의 기존 머신을 제자리 갱신한다. 통합 호스트의 리전·다른 MCP 핀은 변경하지 않는다.
```

**File**: `package-lock.json` (modified, +2/-2)
```diff
@@ -1,12 +1,12 @@
 {
   "name": "korean-law-mcp",
-  "version": "4.15.2",
+  "version": "4.15.3",
   "lockfileVersion": 3,
   "requires": true,
   "packages": {
     "": {
       "name": "korean-law-mcp",
-      "version": "4.15.2",
+      "version": "4.15.3",
       "license": "MIT",
       "dependencies": {
         "@modelcontextprotocol/sdk": "^1.27.1",
```

**File**: `package.json` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 {
   "name": "korean-law-mcp",
-  "version": "4.15.2",
+  "version": "4.15.3",
   "description": "법제처 42개 API → 9개 MCP 도구. 법령·판례·조례·조약 + 다단계 리서치(legal_research, 8 task) + 정밀분석(legal_analysis: 인용검증·판례생사·행위시법·영향그래프) + 시점 비교(time_travel) + 상황별 5단계 안내(action_plan) + 국세청 해석례(nts)",
   "type": "module",
   "main": "build/index.js",
```

---

### Incident Patch 4: `d872eeed` (2026-10-01)
**Commit Message**: fix: document_review 체인·법령 통계에 시간 한도

- document_review 만 체인 데드라인 밖이었다. 판례 사다리·근거 조회가 매달리면 60초 클라이언트 한도를
  넘겼다. 다른 체인과 같은 틀로 돌고, 갈래마다 따로 경주시켜 받은 섹션(리스크 분석·법령)은 싣고
  못 받은 자리만 마커로 남긴다
- get_law_statistics 는 하루 조회가 4.5~5.7초라 days 가 크면 60초를 넘겼다. 같은 시간 한도
  (MCP_CHAIN_DEADLINE_MS) 아래에서 최신일부터 받고, 넘기면 가장 오래된 날들을 미조회로 밝힌다

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/tools/chains.deadline.test.ts` (modified, +40/-1)
```diff
@@ -8,7 +8,7 @@
 import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
 import {
   chainActionBasis, chainFullResearch, chainDisputePrep,
-  chainLawSystem, chainProcedureDetail, chainOrdinanceCompare, chainAmendmentTrack,
+  chainLawSystem, chainProcedureDetail, chainOrdinanceCompare, chainAmendmentTrack, chainDocumentReview,
 } from "./chains.js"
 import { lawCache } from "../lib/cache.js"
 import type { LawApiClient } from "../lib/api-client.js"
@@ -470,3 +470,42 @@ describe("판례 갈래는 검색과 근거(상세)를 단계별로 race 한다"
     expect(res.isError).toBeFalsy()
   })
 })
+
+// document_review 만 데드라인 밖이었다 — 판례 사다리 직렬과 근거 조회가 매달리면 60초 클라이언트 한도를 넘겼다(2026-10-01 감사).
+// 문서 리스크 분석(로컬)은 싣고, 매달린 법령·판례 검색 자리만 마커로 남긴다
+describe("document_review 데드라인", () => {
+  const DOC = [
+    "주택 임대차 계약서",
+    "제1조(보증금) 임대인은 계약 종료 후 보증금 반환을 지체할 수 있다.",
+    "제2조(위약금) 임차인이 계약을 위반하면 보증금 전액을 위약금으로 몰수한다.",
+  ].join("\n")
+
+  it("업스트림이 매달려도 시간 한도 안에 리스크 분석과 마커를 돌려준다", async () => {
+    process.env.MCP_CHAIN_DEADLINE_MS = "5000"
+    const client = {
+      async searchLaw() { return hang<string>() },
+      async fetchApi() { return hang<string>() },
+    } as unknown as LawApiClient
+    const res = await runPastDeadline(chainDocumentReview(client, { text: DOC, maxClauses: 15 }))
+    const text = res.content[0]?.text ?? ""
+    expect(text).toContain("문서 리스크 분석")
+    expect(text).toContain("시간 한도로 이 섹션은 수집하지 못했습니다")
+    expect(res.isError).toBeFalsy()
+  })
+
+  it("법령 검색은 시간 안에 왔고 판례만 매달리면 법령은 싣는다", async () => {
+    process.env.MCP_CHAIN_DEADLINE_MS = "5000"
+    const client = {
+      async searchLaw() { return hang<string>() },
+      async fetchApi({ target }: { target?: string }) {
+        if (target === "aiSearch") return aiXml("주택임대차보호법")
+        return hang<string>()
+      },
+    } as unknown as LawApiClient
+    const res = await runPastDeadline(chainDocumentReview(client, { text: DOC, maxClauses: 15 }))
+    const text = res.content[0]?.text ?? ""
+    expect(text).toContain("▶ 근거 법령")
+    expect(text).toContain("주택임대차보호법")
+    expect(text).toContain("▶ 관련 판례\n⏱")
+  })
+})
```

**File**: `src/tools/chains.ts` (modified, +77/-64)
```diff
@@ -1106,9 +1106,11 @@ export async function chainDocumentReview(
   apiClient: LawApiClient,
   input: z.infer<typeof chainDocumentReviewSchema>
 ): Promise<ToolResponse> {
-  try {
+  const parts = [`═══ 문서 종합 검토 ═══`]
+  // 이 체인만 데드라인 밖이었다 — 판례 사다리·근거 조회가 업스트림 꼬리를 그대로 타 60초 클라이언트 한도를 넘겼다(2026-10-01 감사).
+  // 다른 체인과 같은 틀로 돌고, 만료 시 받은 섹션까지 싣는다
+  return withChainDeadline(parts, async dl => {
     throwIfRequestCancelled()
-    const parts = [`═══ 문서 종합 검토 ═══`]
 
     // Step 1: analyze_document 로 리스크 분석
     const analysisResult = await callTool(analyzeDocument, apiClient, {
@@ -1139,8 +1141,9 @@ export async function chainDocumentReview(
 
     // 판례 검색과 AI 법령 검색은 서로 독립이다. 종전엔 판례 사다리 5개가 모두 끝난 뒤에야 법령 검색을
     // 시작했다 (2026-09-23 리뷰 B#11). 함께 띄우고, 싣는 순서(판례 → 법령)는 아래 조립에서 지킨다.
-    const [precedentSearches, lawResults] = await Promise.all([
-      Promise.all(
+    // 갈래마다 띄우는 시점에 데드라인과 경주시킨다 — 만료 뒤에 새로 race 하면 이미 끝난 갈래도 {ok:false}다
+    const [precedentO, lawO] = await Promise.all([
+      raceDeadline(dl, Promise.all(
         uniqueHints.map(hint => safeSearchPrecedentsStructured(apiClient, {
           query: hint,
           display: 3,
@@ -1151,78 +1154,88 @@ export async function chainDocumentReview(
           maxFallbackAttempts: 3,
           validateResult: validation => validatePrecedentSearchResult(apiClient, validation, { apiKey: input.apiKey, detailMemo }),
         }))
-      ),
-      Promise.all(
+      )),
+      raceDeadline(dl, Promise.all(
         lawHints.map(hint => callTool(searchAiLaw, apiClient, { query: hint, display: 3, apiKey: input.apiKey }))
-      ),
+      )),
     ])
-    throwIfRequestCancelled()
-    const precedentResults = precedentSearches.map(search => search.result)
-
-    // 판례 결과 합산
-    const precTexts: string[] = []
-    for (let i = 0; i < uniqueHints.length; i++) {
-      const r = precedentResults[i]
-      if (r.hits.length > 0) {
-        precTexts.push(`[${uniqueHints[i]}]\n${renderPrecedentSearchResult(r)}`)
+
+    if (!precedentO.ok) {
+      parts.push(timedOutSection("관련 판례", "search_decisions"))
+    } else {
+      const precedentSearches = precedentO.value
+      const precedentResults = precedentSearches.map(search => search.result)
+
+      // 판례 결과 합산
+      const precTexts: string[] = []
+      for (let i = 0; i < uniqueHints.length; i++) {
+        const r = precedentResults[i]
+        if (r.hits.length > 0) {
+          precTexts.push(`[${uniqueHints[i]}]\n${renderPrecedentSearchResult(r)}`)
+        }
+      }
+      if (precTexts.length > 0) {
+        parts.push(sec("관련 판례", precTexts.join("\n\n")))
+      }
+      const precedentErrors = precedentSearches
+        .map((search, index) => search.error ? `[${uniqueHints[index]}]\n${search.error.text}` : "")
+        .filter(text => text.trim())
+      if (precedentErrors.length > 0) {
+        parts.push(secOrSkip("판례 검색 실패", {
+          text: precedentErrors.join("\n\n"),
+          isError: true,
+        }))
       }
-    }
-    if (precTexts.length > 0) {
-      parts.push(sec("관련 판례", precTexts.join("\n\n")))
-    }
-    const precedentErrors = precedentSearches
-      .map((search, index) => search.error ? `[${uniqueHints[index]}]\n${search.error.text}` : "")
-      .filter(text => text.trim())
-    if (precedentErrors.length > 0) {
-      parts.push(secOrSkip("판례 검색 실패", {
-        text: precedentErrors.join("\n\n"),
-        isError: true,
-      }))
-    }
 
-    const combinedPrecedents = combineStructuredPrecedentResults(precedentResults)
-    if (combinedPrecedents) {
-      const precedentEvidence = await fetchPrecedentEvidence(apiClient, combinedPrecedents, {
-        apiKey: input.apiKey,
-        detailLimit: 2,
-        full: false,
-        detailMemo,
-      })
-      if (precedentEvidence) {
-        parts.push(secOrSkip("관련 판례 상세", {
-          text: precedentEvidence.text,
-          isError: precedentEvidence.isError,
+      const combinedPrecedents = combineStructuredPrecedentResults(precedentResults)
+      if (combinedPrecedents) {
+        const evidenceO = await raceDeadline(dl, fetchPrecedentEvidence(apiClient, combinedPrecedents, {
+          apiKey: input.apiKey,
+          detailLimit: 2,
+          full: false,
+          detailMemo,
         }))
+        if (!evidenceO.ok) {
+          parts.push(timedOutSection("관련 판례 상세", "get_decision_text"))
+        } else if (evidenceO.value) {
+          parts.push(secOrSkip("관련 판례 상세", {
+            text: evidenceO.value.text,
+            isError: evidenceO.value.isError,
+          }))
+        }
       }
     }
 
-    // 법령 결과 합산
-    const lawTexts: string[] = []
-    const lawErrors: string[] = []
-    for (let i = 0; i < lawHints.length; i++) {
-      const r = lawResults[i]
-      if (!r.isError && r.text.trim()) {
-        lawTexts.push(`[${lawHints[i]}]\n${r.text}`)
-      } else if (r.isError && !/\[NOT_FOUND\]/.test(r.text)) {
-        // 0건([NOT_FOUND])은 종전대로 생략하되, 검색 장애는 판례 쪽처럼 밝힌다. 섹션이 조용히
-      
```

**File**: `src/tools/law-statistics.test.ts` (modified, +27/-0)
```diff
@@ -136,3 +136,30 @@ describe("getLawStatistics: 부분 결과는 부분이라고 말한다 (D2)", ()
     expect(r.content[0].text).toContain("첫 실패 원인: API 오류 (403)")
   })
 })
+
+// 하루 조회가 4.5~5.7초(실측)라 days 가 크면 60초 클라이언트 한도를 넘겼다 — 데드라인이 없었다(2026-10-01 감사).
+// 체인과 같은 시간 한도로 최신일부터 받고, 넘기면 남은(가장 오래된) 날을 미조회로 밝힌다
+describe("getLawStatistics: 시간 한도", () => {
+  const ORIGINAL = process.env.MCP_CHAIN_DEADLINE_MS
+  afterEach(() => {
+    if (ORIGINAL === undefined) delete process.env.MCP_CHAIN_DEADLINE_MS
+    else process.env.MCP_CHAIN_DEADLINE_MS = ORIGINAL
+  })
+
+  it("한도를 넘기면 받은 날까지 답하고 미조회 범위를 밝힌다", async () => {
+    process.env.MCP_CHAIN_DEADLINE_MS = "5000"
+    const client = {
+      // 하루당 2초 — 5개씩 배치라 첫 배치(5일)는 2초, 둘째 배치는 4초에, 셋째 배치가 한도를 넘는다
+      getLawHistory: ({ regDt }: { regDt: string }) =>
+        new Promise<string>(resolve => setTimeout(() => resolve(DAYS[regDt] ?? EMPTY_DAY), 2000)),
+    } as unknown as LawApiClient
+    const pending = getLawStatistics(client, { days: 30, limit: 10 })
+    await vi.advanceTimersByTimeAsync(6000)
+    const r = await pending
+    const text = r.content[0].text
+    expect(r.isError).toBeFalsy()
+    expect(text).toContain("경찰공무원 임용령")          // 최신 이틀은 받았다
+    expect(text).toContain("시간 한도")
+    expect(text).toContain("부분 결과")
+  })
+})
```

**File**: `src/tools/law-statistics.ts` (modified, +25/-5)
```diff
@@ -9,6 +9,8 @@ import { truncateResponse } from "../lib/schemas.js"
 import { formatToolError } from "../lib/errors.js"
 import { rethrowIfFatal } from "../lib/fatal-errors.js"
 import { ExecutionLimitError } from "../lib/execution-limits.js"
+import { runWithRequestContext } from "../lib/session-state.js"
+import { raceDeadline, startChainDeadline } from "./chain-deadline.js"
 
 export const LawStatisticsSchema = z.object({
   days: z.number().min(1).max(90).optional().default(30).describe("최근 변경 분석 기간 (일 단위, 기본값: 30, 최대: 90)"),
@@ -22,10 +24,17 @@ export async function getLawStatistics(
   apiClient: LawApiClient,
   input: LawStatisticsInput
 ): Promise<{ content: Array<{ type: string, text: string }>, isError?: boolean }> {
+  // 하루 조회가 4.5~5.7초(실측)라 days 가 크면 60초 클라이언트 한도를 넘겼다(2026-10-01 감사). 체인과 같은 시간 한도
+  // (MCP_CHAIN_DEADLINE_MS) 아래에서 돌고, 만료되면 진행 중 조회를 끊는다
+  let deadline: ReturnType<typeof startChainDeadline> | undefined
   try {
-    return await getRecentChanges(apiClient, input.days, input.limit, input.apiKey)
+    deadline = startChainDeadline()
+    const dl = deadline
+    return await runWithRequestContext({ signal: dl.signal }, () => getRecentChanges(apiClient, input.days, input.limit, input.apiKey, dl))
   } catch (error) {
     return formatToolError(error, "get_law_statistics")
+  } finally {
+    deadline?.dispose()
   }
 }
 
@@ -82,7 +91,8 @@ async function getRecentChanges(
   apiClient: LawApiClient,
   days: number,
   limit: number,
-  apiKey?: string
+  apiKey: string | undefined,
+  deadline: ReturnType<typeof startChainDeadline>
 ): Promise<{ content: Array<{ type: string, text: string }>, isError?: boolean }> {
   // 최신일부터 거슬러 오른다. 요청 예산(기본 48회)이 먼저 바닥나도 잘리는 쪽이 가장 오래된 날이 되게 한다.
   // 종전처럼 오래된 날부터 돌면 days가 크면 정작 최근 며칠이 조용히 빠졌다 (2026-09-23 리뷰 D2).
@@ -99,10 +109,17 @@ async function getRecentChanges(
   let firstFailure = ""
   const cappedDays: string[] = []
   const unscannedDays: string[] = []
+  const timedOutDays: string[] = []
 
   for (let i = 0; i < dateStrings.length; i += BATCH_SIZE) {
     const batch = dateStrings.slice(i, i + BATCH_SIZE)
-    const settled = await Promise.allSettled(batch.map((dateStr) => fetchDay(apiClient, dateStr, apiKey)))
+    const outcome = await raceDeadline(deadline, Promise.allSettled(batch.map((dateStr) => fetchDay(apiClient, dateStr, apiKey))))
+    // 시간 한도: 이 배치부터 남은(더 오래된) 날은 받지 못했다. 받은 날까지로 답하되 빠진 범위를 밝힌다
+    if (!outcome.ok) {
+      timedOutDays.push(...dateStrings.slice(i))
+      break
+    }
+    const settled = outcome.value
 
     settled.forEach((r, k) => {
       const day = batch[k]
@@ -131,12 +148,12 @@ async function getRecentChanges(
     }
   }
 
-  const scannedDays = dateStrings.length - failedDays.length - unscannedDays.length
+  const scannedDays = dateStrings.length - failedDays.length - unscannedDays.length - timedOutDays.length
   if (scannedDays === 0) {
     // 한 날도 받지 못했다. "0건"으로 답하면 개정이 없었다는 거짓 결론이 된다.
     throw new Error(
       `최근 ${days}일 법령 변경이력을 한 날도 조회하지 못했습니다 ` +
-      `(조회 실패 ${failedDays.length}일, 요청 예산 소진으로 미조회 ${unscannedDays.length}일)` +
+      `(조회 실패 ${failedDays.length}일, 요청 예산 소진으로 미조회 ${unscannedDays.length}일, 시간 한도로 미조회 ${timedOutDays.length}일)` +
       // 키 없음·권한 오류(401/403)는 재시도로 낫지 않는다: 첫 실패 원인을 그대로 보여준다(독립 리뷰)
       (firstFailure ? `. 첫 실패 원인: ${firstFailure}` : ". 잠시 후 다시 시도하세요.")
     )
@@ -165,6 +182,9 @@ async function getRecentChanges(
   if (unscannedDays.length > 0) {
     notes.push(`⚠️ 요청 예산 소진으로 가장 오래된 ${unscannedDays.length}일(${formatYmd(unscannedDays[unscannedDays.length - 1])} ~ ${formatYmd(unscannedDays[0])})은 조회하지 못했습니다. 위 집계는 부분 결과입니다. days를 줄여 다시 조회하세요.`)
   }
+  if (timedOutDays.length > 0) {
+    notes.push(`⚠️ 시간 한도로 가장 오래된 ${timedOutDays.length}일(${formatYmd(timedOutDays[timedOutDays.length - 1])} ~ ${formatYmd(timedOutDays[0])})은 조회하지 못했습니다. 위 집계는 부분 결과입니다. days를 줄여 다시 조회하세요.`)
+  }
   if (failedDays.length > 0) {
     notes.push(`⚠️ ${failedDays.length}일 조회 실패(${failedDays.map(formatYmd).join(", ")}): 그날 반영분은 집계에서 빠졌습니다.`)
   }
```

---

### Incident Patch 5: `7abac58c` (2026-10-01)
**Commit Message**: fix(law-text): 동명 구법 보정에서 계보 재조회 제거, 보정 재조회 캐시를 직접 조회와 분리

- 기준일이 계보 시작보다 앞일 때 받아 둔 계보에 구법 행만 덧붙인다 (같은 계보를 업스트림에서 한 번 더 받았다)
- 같은 MST·시행일을 먼저 직접 조회하면 그 표기("현행 아닐 수 있음")가 캐시돼, 보정 조회가 현행 버전이어도
  그 문구가 나갔다 — 보정 재조회는 상태(현행·과거·시행예정)를 캐시 키에 넣는다

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/lib/law-lineage.ts` (modified, +1/-1)
```diff
@@ -148,7 +148,7 @@ export interface LawVersionsResult extends HistoricalFetchResult {
  * 한 번 더 받는다 — 계보 안의 기준일은 호출 수가 그대로다. 계보 시작일 이하이면서 계보에 없는 MST 를 구법으로 본다.
  * 같은 날의 구법 폐지 행은 신법 제정 행 뒤에 놓여, 재제정일 당일이 "폐지"로 읽히지 않는다.
  */
-async function withPriorSameNameLaw(
+export async function withPriorSameNameLaw(
   apiClient: LawApiClient,
   versions: HistoricalVersion[],
   asOf: string,
```

**File**: `src/tools/law-text.correction.test.ts` (modified, +10/-1)
```diff
@@ -125,6 +125,14 @@ describe("보정 결과를 정직하게", () => {
     expect(t).toContain("현행")
   })
 
+  it("같은 버전을 먼저 직접 조회해 캐시돼 있어도, 보정 조회의 현행 표기는 그대로다", async () => {
+    const { api } = stub()
+    await getLawText(api, { mst: "300", efYd: "20250101", jo: "제1조" })   // 일반 표기("현행 아닐 수 있음")로 캐시
+    const t = text(await getLawText(api, { lawId: "001638", efYd: "20260101", jo: "제1조" }))
+    expect(t).toContain("현행 버전")
+    expect(t).not.toContain("현행 법령이 아닐 수 있음")
+  })
+
   it("보정한 버전이 아직 시행 전이면 시행예정본이라고 밝힌다", async () => {
     const rows: Row[] = [{ mst: "400", efYd: "20990601" }, ...BASE]
     const { api } = stub(rows)
@@ -158,8 +166,9 @@ describe("기준일이 계보 시작(재제정) 전이면 동명 구법 버전
       `<tr><td class="ce">1</td><td><a href="/DRF/lawService.do?OC=x&amp;target=lsHistory&amp;MST=${mst}&amp;type=HTML&amp;mobileYn=&amp;efYd=${efYd}" >테스트법</a></td>` +
       `<td class="ce">부처</td><td class="ce">${rr}</td><td class="ce">법률</td><td class="ce">제 1호</td><td class="ce">${efYd.slice(0, 4)}.1.1</td><td class="ce">${efYd}</td><td class="ce">연혁</td></tr>`
     const history = `<html><strong>2</strong> 건<table>${tr("50", "20000101", "일부개정")}${tr("40", "19900101", "제정")}</table></html>`
-    const { api } = stub(BASE, undefined, history)
+    const { api, calls } = stub(BASE, undefined, history)
     const r = await getLawText(api, { lawId: "001638", efYd: "20050101", jo: "제1조" })
+    expect(lineageCalls(calls)).toBe(1)   // 받아 둔 계보에 구법만 덧붙인다 — 계보를 다시 받지 않는다
     const t = text(r)
     expect(r.isError).toBeFalsy()
     expect(t).toContain("시행 2000.01.01")
```

**File**: `src/tools/law-text.ts` (modified, +4/-3)
```diff
@@ -10,7 +10,7 @@ import { formatArticleUnit } from "../lib/article-parser.js"
 import { getStrategyWarning } from "../lib/article-warnings.js"
 import { formatToolError } from "../lib/errors.js"
 import { rethrowIfFatal } from "../lib/fatal-errors.js"
-import { fetchLawVersions, fetchLineageVersions, isRepealRow, lawStateAt, todayKst, versionInForce } from "../lib/law-lineage.js"
+import { fetchLineageVersions, isRepealRow, lawStateAt, todayKst, versionInForce, withPriorSameNameLaw } from "../lib/law-lineage.js"
 import type { HistoricalVersion } from "../lib/historical-utils.js"
 import { UpstreamRecordMissingError } from "../lib/upstream-miss.js"
 import { formatDateDot } from "../lib/schemas.js"
@@ -67,7 +67,8 @@ async function renderLawText(apiClient: LawApiClient, input: GetLawTextInput, re
 
     // Check cache first (efYd 정규화: 미지정 → 'current'로 통일)
     // mst·lawId 는 번호 체계가 달라 같은 값이 다른 법령이다(001706: mst=사방사업법, lawId=민법) — 접두로 가른다
-    const cacheKey = `lawtext:${input.mst ? `m${input.mst}` : `i${input.lawId}`}:${joCode || 'full'}:${input.efYd || 'current'}`
+    // 보정 재조회(resolved)는 현행성 표기가 달라 직접 조회와 캐시를 나눈다
+    const cacheKey = `lawtext:${input.mst ? `m${input.mst}` : `i${input.lawId}`}:${joCode || 'full'}:${input.efYd || 'current'}${resolved ? `:${resolved}` : ""}`
     // MST·efYd 는 버전을 못박으므로 하루를 둔다. lawId 만 준 "현행" 조회는 개정 시행일을 넘기면
     // 다른 본문이 현행이 되므로 1시간만 둔다(24시간이면 시행일 당일 옛 본문이 나갔다, 리뷰 A8).
     const cacheTtl = input.mst || input.efYd ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000
@@ -390,7 +391,7 @@ async function retryAtVersionInForce(apiClient: LawApiClient, input: GetLawTextI
     // 계보 시작보다 앞선 기준일에서만 드는 비용이다
     const first = versions[versions.length - 1]
     if (!state.version && !state.repeal && first && ymd < first.efYd) {
-      versions = (await fetchLawVersions(apiClient, first.lawNm, input.apiKey, String(lawId), ymd)).versions
+      versions = await withPriorSameNameLaw(apiClient, versions, ymd, input.apiKey)
       state = lawStateAt(versions, ymd)
     }
     const { version: v, repeal } = state
```

---

### Incident Patch 6: `a1bb207f` (2026-10-01)
**Commit Message**: fix(admin-rule): page 크기를 실제 응답 한도에서 머리말을 뺀 값으로

페이지 크기가 4.5만 자 고정이라 MCP_MAX_TOOL_RESPONSE_CHARS 를 낮춘 배포에서는 최종 게이트가 각
페이지 끝을 잘랐고, 다음 페이지는 4.5만 자부터 시작해 그 사이를 읽을 길이 없었다. 외국환거래규정을
한도 3만으로 읽으면 8페이지 중 7개가 잘려 전문 336,943자 중 105,544자에 닿지 못했다. 페이지 크기를
min(최종 게이트 한도, 도구 안 상한) − 머리말 − 200자로 잡는다. 한도 3만: 12페이지·잘림 0·전문 전부,
기본 5만: 7페이지·잘림 0.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/lib/admin-rule-views.ts` (modified, +15/-3)
```diff
@@ -8,6 +8,7 @@
 
 import { SimpleCache } from "./cache.js"
 import { MAX_RESPONSE_SIZE } from "./schemas.js"
+import { requestContext } from "./session-state.js"
 import { parseAdminRuleArticles, type ParsedAdminRule, type AdminRuleArticle } from "./admin-rule-articles.js"
 import { findArticle, normalizeChapter, structLabel } from "./admin-rule-jo.js"
 import { keywordView, splitSections, type ExtraBlock } from "./admin-rule-keyword.js"
@@ -114,6 +115,14 @@ function chapterView(parsed: ParsedAdminRule, chapter: string): string {
   return text
 }
 
+/**
+ * 이 요청의 응답 문자 한도: tool-registry 최종 게이트가 자르는 값(MCP_MAX_TOOL_RESPONSE_CHARS — 요청 예산에 같은
+ * 값이 실린다)과 도구 안 절단 상한(MAX_RESPONSE_SIZE) 중 작은 쪽
+ */
+function responseCharLimit(): number {
+  return Math.min(MAX_RESPONSE_SIZE, requestContext.getStore()?.budget?.limits.maxToolResponseChars ?? MAX_RESPONSE_SIZE)
+}
+
 export interface PageResult { text: string, page: number, totalPages: number }
 
 /** 전문을 라인 경계에서 자른 비중첩 청크로 페이징 */
@@ -137,10 +146,10 @@ export function paginateFullText(fullText: string, page: number, chunkSize = 450
 
 /**
  * 부분 조회 본문 생성 — 호출부는 규칙명·공포일 헤더를 앞에 붙인다.
- * extras: 부칙·별표 블록 (keyword 가 조문에서 못 찾으면 이어 찾는다)
+ * extras: 부칙·별표 블록 (keyword 가 조문에서 못 찾으면 이어 찾는다) / headerChars: 호출부 머리말 길이 (page 크기 산정)
  */
 export function buildPartialBody(
-  body: string, fullText: string, params: PartialParams, opts: { extras?: ExtraBlock[] } = {},
+  body: string, fullText: string, params: PartialParams, opts: { extras?: ExtraBlock[], headerChars?: number } = {},
 ): { label: string, text: string, note?: string } {
   const { mode, ignored } = pickPartialMode(params)
   const note = ignored.length ? `※ 복수 파라미터 중 우선순위에 따라 '${mode}'만 적용했습니다 (무시: ${ignored.join(", ")}).` : undefined
@@ -153,7 +162,10 @@ export function buildPartialBody(
     case "keyword":
       return { label: `본문 검색: ${params.keyword}`, text: keywordView(parsed, params.keyword!, params.max_results || 10, body, opts.extras), note }
     case "page": {
-      const r = paginateFullText(fullText, params.page || 1)
+      // 페이지 크기 = 실제 응답 한도 − 머리말 − 라벨·다음 안내 몫(200). 4.5만 고정이면 한도를 3만으로 낮춘 배포에서
+      // page 1 이 잘리고 page 2 는 4.5만 자부터라 그 사이를 읽을 길이 없었다. page 는 최하위 우선순위라 무시 안내가 붙지 않는다
+      const size = Math.max(500, responseCharLimit() - (opts.headerChars ?? 0) - 200)
+      const r = paginateFullText(fullText, params.page || 1, size)
       const tail = r.page < r.totalPages ? `\n\n▶ 다음: page:${r.page + 1}` : ""
       return { label: `페이지 ${r.page}/${r.totalPages}`, text: r.text + tail, note }
     }
```

**File**: `src/tools/admin-rule.test.ts` (modified, +21/-1)
```diff
@@ -3,7 +3,8 @@ import { searchAdminRule, getAdminRule, compareAdminRuleOldNew } from "./admin-r
 import { extractDetailIds } from "./search-detail-chain.js"
 import type { LawApiClient } from "../lib/api-client.js"
 import { INLINE_IMAGE_MARK } from "../lib/image-only-body.js"
-import { ExecutionLimitError } from "../lib/execution-limits.js"
+import { ExecutionLimitError, RequestExecutionBudget, DEFAULT_EXECUTION_LIMITS } from "../lib/execution-limits.js"
+import { requestContext } from "../lib/session-state.js"
 
 // 실측 응답 축약 (#72).
 // lawService.do?target=admrul&ID= 가 받는 값은 '행정규칙일련번호'(13자리)다.
@@ -252,6 +253,25 @@ describe("get_admin_rule — 부분 조회 (T1)", () => {
     expect(b.content[0].text).toContain("[외국환업무등록신청서]")
   })
 
+  it("응답 한도(MCP_MAX_TOOL_RESPONSE_CHARS)를 낮춰도 페이지가 잘리지 않고 사이에 빠지는 구간이 없다", async () => {
+    // 감사 실측: 한도 3만이면 page 1 이 29,983자에서 잘리고 page 2 는 4.5만 자부터라 약 1.5만 자를 읽을 길이 없었다
+    const big = Array.from({ length: 600 }, (_, i) => `제${i + 1}조(조문${i + 1}) ${"외국환 거래의 신고 절차는 다음과 같다.".repeat(3)}`).join("\n")
+    const xml = FX_RULE_XML.replace(HYPHEN_BLOB, big).replace(/<부칙공포일자>.*<\/부칙내용>/su, "")
+    const limit = 8000
+    const budget = new RequestExecutionBudget({ ...DEFAULT_EXECUTION_LIMITS, maxToolResponseChars: limit })
+    const read = (page: number) => requestContext.run({ budget }, () => getAdminRule(detailStub(xml), { id: "2100000285140", page }))
+    const first = (await read(1)).content[0].text
+    const total = Number(/페이지 1\/(\d+)/u.exec(first)![1])
+    const bodies: string[] = []
+    for (let p = 1; p <= total; p++) {
+      const text = (await read(p)).content[0].text
+      expect(text.length).toBeLessThanOrEqual(limit)
+      expect(text).not.toContain("잘렸습니다")
+      bodies.push(text.slice(text.indexOf(`[페이지 ${p}/${total}]\n\n`) + `[페이지 ${p}/${total}]\n\n`.length).replace(/\n\n▶ 다음: page:\d+$/u, ""))
+    }
+    expect(bodies.join("")).toBe(`${big}\n`)
+  })
+
   it("파라미터 없는 전문 조회는 종전 동작 그대로다 (AC#9 회귀)", async () => {
     const r = await getAdminRule(detailStub(DETAIL_XML), { id: "2100000271110" })
     expect(r.isError).toBeFalsy()
```

**File**: `src/tools/admin-rule.ts` (modified, +1/-1)
```diff
@@ -347,7 +347,7 @@ export async function getAdminRule(
     // 부분 조회 (jo > chapter > keyword > page) — 기존 전문 조회 동작은 그대로 유지
     const { mode } = pickPartialMode(input)
     if (mode) {
-      const view = buildPartialBody(articlesText, fullBody, input, { extras })
+      const view = buildPartialBody(articlesText, fullBody, input, { extras, headerChars: resultText.length })
       let out = resultText + `[${view.label}]\n`
       if (view.note) out += `${view.note}\n`
       out += `\n${view.text}`
```

---

### Incident Patch 7: `a1cbb8fc` (2026-10-01)
**Commit Message**: fix(admin-rule): 신구대조 폴백의 일시 조회 실패를 "데이터 없음"과 구별

제·개정이유 폴백이 catch { return null } 이라, 조회 중 네트워크 실패·HTTP 500 이 나도
"[NOT_FOUND] 신구법 대조 데이터가 없습니다 (제·개정이유도 API 미제공)"으로 단정했고 예산 소진·취소도
같은 문구로 묻혔다. 예산 소진·취소는 rethrowIfFatal 로 올리고, 그 밖의 오류는 "일시 조회 실패"와
원인을 밝혀 부존재로 읽히지 않게 한다.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/tools/admin-rule.test.ts` (modified, +26/-0)
```diff
@@ -3,6 +3,7 @@ import { searchAdminRule, getAdminRule, compareAdminRuleOldNew } from "./admin-r
 import { extractDetailIds } from "./search-detail-chain.js"
 import type { LawApiClient } from "../lib/api-client.js"
 import { INLINE_IMAGE_MARK } from "../lib/image-only-body.js"
+import { ExecutionLimitError } from "../lib/execution-limits.js"
 
 // 실측 응답 축약 (#72).
 // lawService.do?target=admrul&ID= 가 받는 값은 '행정규칙일련번호'(13자리)다.
@@ -283,4 +284,29 @@ describe("compare_admin_rule_old_new — 제·개정이유 폴백 (T2)", () => {
     expect(r.content[0].text).toContain("제·개정이유도 API 미제공")
     expect(r.content[0].text).toContain("law.go.kr")
   })
+
+  it("제·개정이유 조회가 일시 실패(네트워크·HTTP 500)하면 '미제공'으로 단정하지 않는다", async () => {
+    const stub = {
+      fetchApi: async () => OLDNEW_EMPTY_XML,
+      getAdminRule: async () => { throw new Error("HTTP 500: Internal Server Error") },
+    } as unknown as LawApiClient
+    const r = await compareAdminRuleOldNew(stub, { id: "2100000285140" })
+    const text = r.content[0].text
+    expect(r.isError).toBe(true)
+    expect(text).toContain("일시 조회 실패")
+    expect(text).toContain("HTTP 500")
+    expect(text).not.toContain("미제공")
+    expect(text).not.toContain("[NOT_FOUND]")
+  })
+
+  it("예산 소진은 '폴백 없음'으로 바꾸지 않고 그대로 올린다", async () => {
+    const stub = {
+      fetchApi: async () => OLDNEW_EMPTY_XML,
+      getAdminRule: async () => { throw new ExecutionLimitError("Request upstream work budget exceeded (max 48 attempts).") },
+    } as unknown as LawApiClient
+    const text = (await compareAdminRuleOldNew(stub, { id: "2100000285140" })).content[0].text
+    expect(text).toContain("budget exceeded")
+    expect(text).not.toContain("미제공")
+    expect(text).not.toContain("일시 조회 실패")
+  })
 })
```

**File**: `src/tools/admin-rule.ts` (modified, +31/-22)
```diff
@@ -6,7 +6,9 @@ import { z } from "zod"
 import { DOMParser } from "@xmldom/xmldom"
 import type { LawApiClient } from "../lib/api-client.js"
 import { truncateResponse, MAX_RESPONSE_SIZE, formatDateDot } from "../lib/schemas.js"
-import { formatToolError, noResultHint } from "../lib/errors.js"
+import { formatToolError, noResultHint, ErrorCodes } from "../lib/errors.js"
+import { rethrowIfFatal } from "../lib/fatal-errors.js"
+import { maskSensitiveUrl } from "../lib/fetch-with-retry.js"
 import { detectAbolishedAdminRule } from "../lib/abolished-laws.js"
 import { fetchAdminRuleHistory, pickAdminRuleGroup } from "../lib/admin-rule-history.js"
 import { adminRuleSourceUrl, analyzeImageOnlyBody, buildImageOnlyWarning, markInlineImages } from "../lib/image-only-body.js"
@@ -399,33 +401,29 @@ function markChangedParts(text: string): string {
 
 /**
  * 신구대조 미제공 시 admrul 상세의 제·개정이유 폴백 (T2).
- * 발령번호·발령일자와 함께 반환하며, 이유 필드가 없으면 null.
+ * 발령번호·발령일자와 함께 반환하며, 이유 필드가 없으면 null. 조회 실패는 던진다(호출부가 "없음"과 구별).
  */
 async function fetchRevisionFallback(
   apiClient: LawApiClient,
   id: string,
   apiKey?: string
 ): Promise<string | null> {
-  try {
-    const cacheKey = adminRuleCacheKey(id)
-    let xmlText = adminRuleXmlCache.get<string>(cacheKey)
-    if (!xmlText) {
-      xmlText = await apiClient.getAdminRule(id, apiKey)
-    }
-    const doc = new DOMParser().parseFromString(xmlText, "text/xml")
-    const reason = collectText(doc, "제개정이유내용").trim()
-    if (!reason) return null
-    const name = doc.getElementsByTagName("행정규칙명")[0]?.textContent?.trim() || ""
-    const date = doc.getElementsByTagName("발령일자")[0]?.textContent?.trim() || ""
-    const no = doc.getElementsByTagName("발령번호")[0]?.textContent?.trim() || ""
-    const kind = doc.getElementsByTagName("제개정구분명")[0]?.textContent?.trim() || ""
-    let head = ""
-    if (name) head += `행정규칙명: ${name}\n`
-    if (no || date) head += `발령: 제${no || "?"}호${date ? ` (${formatDateDot(date)})` : ""}${kind ? ` · ${kind}` : ""}\n`
-    return `${head}\n${reason}`
-  } catch {
-    return null
+  const cacheKey = adminRuleCacheKey(id)
+  let xmlText = adminRuleXmlCache.get<string>(cacheKey)
+  if (!xmlText) {
+    xmlText = await apiClient.getAdminRule(id, apiKey)
   }
+  const doc = new DOMParser().parseFromString(xmlText, "text/xml")
+  const reason = collectText(doc, "제개정이유내용").trim()
+  if (!reason) return null
+  const name = doc.getElementsByTagName("행정규칙명")[0]?.textContent?.trim() || ""
+  const date = doc.getElementsByTagName("발령일자")[0]?.textContent?.trim() || ""
+  const no = doc.getElementsByTagName("발령번호")[0]?.textContent?.trim() || ""
+  const kind = doc.getElementsByTagName("제개정구분명")[0]?.textContent?.trim() || ""
+  let head = ""
+  if (name) head += `행정규칙명: ${name}\n`
+  if (no || date) head += `발령: 제${no || "?"}호${date ? ` (${formatDateDot(date)})` : ""}${kind ? ` · ${kind}` : ""}\n`
+  return `${head}\n${reason}`
 }
 
 export async function compareAdminRuleOldNew(
@@ -467,7 +465,18 @@ export async function compareAdminRuleOldNew(
         // 경우가 많다. 이때 admrul 상세의 제·개정이유(개정이유·주요내용)를 폴백으로
         // 반환한다 — "제○조를 ○○로 한다" 수준은 아니어도 변경 취지·대상 조문이
         // 문장으로 들어 있어 실용적 대체재가 된다. (id가 행정규칙일련번호인 경우 동작)
-        const fallback = await fetchRevisionFallback(apiClient, String(input.id), input.apiKey)
+        let fallback: string | null
+        try {
+          fallback = await fetchRevisionFallback(apiClient, String(input.id), input.apiKey)
+        } catch (error) {
+          // 예산 소진·취소는 그대로 올리고, 네트워크·HTTP 오류는 "이유 없음"과 구별한다 —
+          // 종전엔 둘 다 "[NOT_FOUND] … 제·개정이유도 API 미제공"으로 나갔다
+          rethrowIfFatal(error)
+          const reason = maskSensitiveUrl(error instanceof Error ? error.message : String(error))
+          resultText += `[${ErrorCodes.API_ERROR}] 신구법 대조 데이터가 없어 제·개정이유로 대체하려 했으나 일시 조회 실패: ${reason}\n` +
+            "제·개정이유가 없다는 뜻이 아닙니다 — 잠시 후 다시 시도하세요.\n⚠️ LLM은 대조 내용을 추측하지 마세요."
+          return { content: [{ type: "text", text: resultText }], isError: true }
+        }
         if (fallback) {
           // 대조 헤더("알 수 없음" 등)는 버리고 폴백 자체 헤더로 대체한다
           const text = "[신구법 대조 데이터 없음 — 제·개정이유로 대체합니다]\n\n" + fallback
```

---

### Incident Patch 8: `e28770e6` (2026-10-01)
**Commit Message**: fix(admin-rule): keyword 가 조문에 없으면 부칙·별표까지 찾고 나서 없음 판정

keyword 검색이 조문만 보고 "[NOT_FOUND] … 포함한 조문이 없습니다"로 단정했다. 외국환거래규정
"경과조치"(부칙 8건 10곳)·"외국환전문요원"(별지 서식 2곳)이 같은 규칙 전문에 있는데도 "없음"이 나갔다.
조문(조문 체계가 없으면 절)에서 못 찾으면 부칙·별표 블록을 이어 찾아 매칭 부분을 싣고, 어디에도
없을 때만 NOT_FOUND(부칙·별표도 찾았다고 밝힘). 조문에서 찾았고 부칙·별표에도 있으면 그 위치를 알린다.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/lib/admin-rule-keyword.test.ts` (modified, +48/-0)
```diff
@@ -12,6 +12,54 @@ const DEFINITIONS = [
   "제1-3조(적용범위) 이 규정은 …",
 ].join("\n")
 
+// 외국환거래규정 실측 축약: "경과조치"는 부칙에만, "외국환전문요원"은 별지 서식(별표)에만 있다 (2026-10-01 감사)
+const RULE = [
+  "제1장 총칙",
+  "제1-1조(목적) 이 규정은 「외국환거래법」과 동법시행령에서 위임된 사항과 그 시행에 관하여 필요한 사항을 정함을 목적으로 한다.",
+  "제1-2조(용어의 정의) 이 규정에서 사용하는 용어의 정의는 다음과 같다.",
+].join("\n")
+const ADDENDUM = {
+  label: "부칙 <제2002-12호,2002. 7. 2.>",
+  text: "부칙 <제2002-12호,2002. 7. 2.>\n제1조(시행일) 이 고시는 2002년 7월 2일부터 시행한다.\n제2조(경과조치) ①제1-2조제6호는 2002년 7월 31일까지 종전 규정을 적용한다.",
+}
+const ANNEX = {
+  label: "[외국환업무등록신청서]",
+  text: "[외국환업무등록신청서]\n■ 외국환거래규정 [별지 제2-1호 서식]\n┃⑧인 력 현 황       │임  원    │직  원    │외국환전문요원           명           ┃",
+}
+
+describe("keywordView — 조문에 없으면 부칙·별표까지", () => {
+  const parsed = parseAdminRuleArticles(RULE)
+
+  it("부칙·별표에만 있는 말은 NOT_FOUND 가 아니라 그 블록을 보여 준다", () => {
+    const a = keywordView(parsed, "경과조치", 10, RULE, [ADDENDUM, ANNEX])
+    expect(a.startsWith("[NOT_FOUND]")).toBe(false)
+    expect(a).toContain("부칙 <제2002-12호,2002. 7. 2.>")
+    expect(a).toContain("제2조(경과조치) ①제1-2조제6호는")
+    const b = keywordView(parsed, "외국환전문요원", 10, RULE, [ADDENDUM, ANNEX])
+    expect(b).toContain("[외국환업무등록신청서]")
+    expect(b).not.toContain("경과조치")
+  })
+
+  it("어디에도 없을 때만 NOT_FOUND 이고, 부칙·별표까지 찾았다고 밝힌다", () => {
+    const text = keywordView(parsed, "없는낱말", 10, RULE, [ADDENDUM, ANNEX])
+    expect(text.startsWith("[NOT_FOUND]")).toBe(true)
+    expect(text).toContain("부칙·별표")
+  })
+
+  it("조문에 있으면 조문을 싣고, 부칙·별표에도 있다고 알린다", () => {
+    const text = keywordView(parsed, "시행", 10, RULE, [ADDENDUM, ANNEX])
+    expect(text).toContain("제1-1조(목적)")
+    expect(text).toContain("부칙·별표에도 1곳: 부칙 <제2002-12호,2002. 7. 2.>")
+  })
+
+  it("조문 체계 없는 규칙(절 단위)도 부칙·별표로 이어 찾는다", () => {
+    const nftc = "2.1 일반\n  설치 기준은 다음과 같이 한다."
+    const text = keywordView(parseAdminRuleArticles(nftc), "외국환전문요원", 10, nftc, [ANNEX])
+    expect(text.startsWith("[NOT_FOUND]")).toBe(false)
+    expect(text).toContain("[외국환업무등록신청서]")
+  })
+})
+
 describe("keywordView — 긴 조문의 발췌 창", () => {
   it("매칭 줄이 앞 2,500자 밖이어도 발췌에 들어간다 (조문 제목 줄은 유지)", () => {
     const text = keywordView(parseAdminRuleArticles(DEFINITIONS), "현금인출기능이", 10)
```

**File**: `src/lib/admin-rule-keyword.ts` (modified, +36/-9)
```diff
@@ -41,25 +41,52 @@ function excerptAround(text: string, kw: string, max: number): string {
   return head + text.slice(start, end)
 }
 
-function sectionKeywordView(body: string, kw: string, maxResults: number): string {
+/** 부칙·별표 한 덩어리 — text 는 label 줄(부칙 <…> · [별표 제목])로 시작한다 */
+export interface ExtraBlock { label: string, text: string }
+
+function sectionKeywordView(body: string, kw: string, cap: number): string | null {
   const hits = splitSections(body).filter(s => s.text.includes(kw))
-  if (hits.length === 0) return `[NOT_FOUND] 본문에 '${kw}'을(를) 포함한 절이 없습니다.\n⚠️ LLM은 기준 내용을 추측/생성하지 마세요.`
-  const cap = Math.max(1, Math.min(maxResults || 10, 30))
+  if (hits.length === 0) return null
   const labels = hits.map(s => s.num).filter(Boolean)
   let text = `'${kw}' 포함 ${hits.length}곳${labels.length ? `: ${labels.join(", ")}` : ""}\n`
   text += hits.length > cap ? `(아래 본문은 상위 ${cap}곳 — 절 번호는 jo:"2.7.3"처럼 조회)\n\n` : "\n"
   return text + hits.slice(0, cap).map(s => s.text.length > 2500 ? `${excerptAround(s.text, kw, 2500)}\n   …` : s.text).join("\n\n---\n\n")
 }
 
-export function keywordView(parsed: ParsedAdminRule, keyword: string, maxResults: number, body = ""): string {
+function extrasKeywordView(hits: ExtraBlock[], kw: string, cap: number): string {
+  let text = `'${kw}' — 조문에는 없고 부칙·별표에 ${hits.length}곳: ${hits.map(b => b.label).join(", ")}\n`
+  text += hits.length > cap ? `(아래 본문은 상위 ${cap}곳 — 나머지는 page 로 전문 뒷부분, max_results로 조정 가능)\n\n` : "\n"
+  return text + hits.slice(0, cap).map(b => b.text.length > 2500 ? `${excerptAround(b.text, kw, 2500)}\n   …` : b.text).join("\n\n---\n\n")
+}
+
+/**
+ * keyword 검색: 조문(조문 체계가 없으면 절) → 없으면 부칙·별표. 종전엔 조문만 보고 NOT_FOUND 로 단정해
+ * 외국환거래규정 "경과조치"(부칙 10곳)·"외국환전문요원"(별지 서식 2곳)이 "없다"고 나갔다.
+ */
+export function keywordView(parsed: ParsedAdminRule, keyword: string, maxResults: number, body = "", extras: ExtraBlock[] = []): string {
   const kw = keyword.trim()
   if (!kw) return "[NOT_FOUND] keyword 가 비어 있습니다 — 검색어를 지정하세요."
-  if (parsed.articles.length === 0) return sectionKeywordView(body, kw, maxResults)
-  const hits = parsed.articles.filter((a) => a.lines.some((l) => l.includes(kw)))
-  if (hits.length === 0) {
-    return `[NOT_FOUND] 본문에 '${kw}'을(를) 포함한 조문이 없습니다. (총 ${parsed.articles.length}개조 검색)\n⚠️ LLM은 조문 내용을 추측/생성하지 마세요.`
-  }
   const cap = Math.max(1, Math.min(maxResults || 10, 30))
+  const noArticles = parsed.articles.length === 0
+  const main = noArticles ? sectionKeywordView(body, kw, cap) : articleKeywordView(parsed, kw, cap)
+  const extraHits = extras.filter(b => b.text.includes(kw))
+  if (main) {
+    if (extraHits.length === 0) return main
+    const more = extraHits.length > 10 ? ` 외 ${extraHits.length - 10}곳` : ""
+    const note = `※ 부칙·별표에도 ${extraHits.length}곳: ${extraHits.slice(0, 10).map(b => b.label).join(", ")}${more} — 본문은 page 로 전문 뒷부분을 보세요.`
+    const nl = main.indexOf("\n")
+    return `${main.slice(0, nl + 1)}${note}\n${main.slice(nl + 1)}`
+  }
+  if (extraHits.length) return extrasKeywordView(extraHits, kw, cap)
+  const alsoExtras = extras.length ? `, 부칙·별표 ${extras.length}건도` : ""
+  return noArticles
+    ? `[NOT_FOUND] 본문에 '${kw}'을(를) 포함한 절이 없습니다.${alsoExtras ? ` (${alsoExtras.slice(2)} 검색)` : ""}\n⚠️ LLM은 기준 내용을 추측/생성하지 마세요.`
+    : `[NOT_FOUND] 본문에 '${kw}'을(를) 포함한 조문이 없습니다. (총 ${parsed.articles.length}개조${alsoExtras} 검색)\n⚠️ LLM은 조문 내용을 추측/생성하지 마세요.`
+}
+
+function articleKeywordView(parsed: ParsedAdminRule, kw: string, cap: number): string | null {
+  const hits = parsed.articles.filter((a) => a.lines.some((l) => l.includes(kw)))
+  if (hits.length === 0) return null
   const shown = hits.slice(0, cap)
   const PER = 2500
   // 본문은 상위 cap개만 싣더라도, 매칭 조문 "목록"은 전부 보여준다 —
```

**File**: `src/lib/admin-rule-views.ts` (modified, +9/-4)
```diff
@@ -10,7 +10,7 @@ import { SimpleCache } from "./cache.js"
 import { MAX_RESPONSE_SIZE } from "./schemas.js"
 import { parseAdminRuleArticles, type ParsedAdminRule, type AdminRuleArticle } from "./admin-rule-articles.js"
 import { findArticle, normalizeChapter, structLabel } from "./admin-rule-jo.js"
-import { keywordView, splitSections } from "./admin-rule-keyword.js"
+import { keywordView, splitSections, type ExtraBlock } from "./admin-rule-keyword.js"
 
 /** 전문 XML 캐시 — 외국환거래규정 기준 응답 ~750KB이므로 상한을 작게 잡는다 */
 export const adminRuleXmlCache = new SimpleCache(20)
@@ -135,8 +135,13 @@ export function paginateFullText(fullText: string, page: number, chunkSize = 450
   return { text, page: p, totalPages }
 }
 
-/** 부분 조회 본문 생성 — 호출부는 규칙명·공포일 헤더를 앞에 붙인다 */
-export function buildPartialBody(body: string, fullText: string, params: PartialParams): { label: string, text: string, note?: string } {
+/**
+ * 부분 조회 본문 생성 — 호출부는 규칙명·공포일 헤더를 앞에 붙인다.
+ * extras: 부칙·별표 블록 (keyword 가 조문에서 못 찾으면 이어 찾는다)
+ */
+export function buildPartialBody(
+  body: string, fullText: string, params: PartialParams, opts: { extras?: ExtraBlock[] } = {},
+): { label: string, text: string, note?: string } {
   const { mode, ignored } = pickPartialMode(params)
   const note = ignored.length ? `※ 복수 파라미터 중 우선순위에 따라 '${mode}'만 적용했습니다 (무시: ${ignored.join(", ")}).` : undefined
   const parsed = parseAdminRuleArticles(body)
@@ -146,7 +151,7 @@ export function buildPartialBody(body: string, fullText: string, params: Partial
     case "chapter":
       return { label: `장 조회: ${params.chapter}`, text: chapterView(parsed, params.chapter!), note }
     case "keyword":
-      return { label: `본문 검색: ${params.keyword}`, text: keywordView(parsed, params.keyword!, params.max_results || 10, body), note }
+      return { label: `본문 검색: ${params.keyword}`, text: keywordView(parsed, params.keyword!, params.max_results || 10, body, opts.extras), note }
     case "page": {
       const r = paginateFullText(fullText, params.page || 1)
       const tail = r.page < r.totalPages ? `\n\n▶ 다음: page:${r.page + 1}` : ""
```

**File**: `src/tools/admin-rule.test.ts` (modified, +12/-0)
```diff
@@ -239,6 +239,18 @@ describe("get_admin_rule — 부분 조회 (T1)", () => {
     expect(calls).toBe(1)
   })
 
+  it("keyword 가 조문에 없고 부칙·별표에 있으면 그 블록을 보여 준다 (NOT_FOUND 단정 금지)", async () => {
+    const withAnnex = FX_RULE_XML.replace("</AdmRulService>",
+      `<별표><별표단위 별표키="000201"><별표번호>0002</별표번호><별표제목><![CDATA[외국환업무등록신청서]]></별표제목><별표내용><![CDATA[┃⑧인 력 현 황 │임  원 │외국환전문요원  명 ┃]]></별표내용></별표단위></별표></AdmRulService>`)
+    const a = await getAdminRule(detailStub(withAnnex), { id: "2100000285140", keyword: "고시한 날" })
+    expect(a.isError).toBeFalsy()
+    expect(a.content[0].text).toContain("부칙 <제2026-103호, 2026. 9. 16.>")
+    adminRuleXmlCache.clear()
+    const b = await getAdminRule(detailStub(withAnnex), { id: "2100000285140", keyword: "외국환전문요원" })
+    expect(b.isError).toBeFalsy()
+    expect(b.content[0].text).toContain("[외국환업무등록신청서]")
+  })
+
   it("파라미터 없는 전문 조회는 종전 동작 그대로다 (AC#9 회귀)", async () => {
     const r = await getAdminRule(detailStub(DETAIL_XML), { id: "2100000271110" })
     expect(r.isError).toBeFalsy()
```

**File**: `src/tools/admin-rule.ts` (modified, +9/-3)
```diff
@@ -14,6 +14,7 @@ import {
   adminRuleXmlCache, adminRuleCacheKey, ADMIN_RULE_CACHE_TTL_MS,
   buildPartialBody, pickPartialMode, PARTIAL_HINT,
 } from "../lib/admin-rule-views.js"
+import type { ExtraBlock } from "../lib/admin-rule-keyword.js"
 
 // search_admin_rule 스키마
 export const SearchAdminRuleSchema = z.object({
@@ -304,15 +305,18 @@ export async function getAdminRule(
     }
     const articlesText = articleParts.join("\n\n")
 
-    // 부칙
+    // 부칙 (extras: keyword 가 조문에서 못 찾으면 이어 찾는 블록)
     let extrasText = ""
+    const extras: ExtraBlock[] = []
+    const firstLine = (s: string) => s.split("\n", 1)[0].trim().slice(0, 60)
     const addendums = doc.getElementsByTagName("부칙내용")
     if (addendums.length > 0) {
       extrasText += `\n---\n부칙\n---\n\n`
       for (let i = 0; i < addendums.length; i++) {
         const content = addendums[i].textContent?.trim() || ""
         if (content.length > 0) {
           extrasText += `${content}\n\n`
+          extras.push({ label: firstLine(content), text: content })
         }
       }
     }
@@ -329,7 +333,9 @@ export async function getAdminRule(
           extrasText += `[${title}]\n`
         }
         if (content.length > 0) {
-          extrasText += `${markInlineImages(content)}\n\n`
+          const marked = markInlineImages(content)
+          extrasText += `${marked}\n\n`
+          extras.push(title ? { label: `[${title}]`, text: `[${title}]\n${marked}` } : { label: firstLine(marked), text: marked })
         }
       }
     }
@@ -339,7 +345,7 @@ export async function getAdminRule(
     // 부분 조회 (jo > chapter > keyword > page) — 기존 전문 조회 동작은 그대로 유지
     const { mode } = pickPartialMode(input)
     if (mode) {
-      const view = buildPartialBody(articlesText, fullBody, input)
+      const view = buildPartialBody(articlesText, fullBody, input, { extras })
       let out = resultText + `[${view.label}]\n`
       if (view.note) out += `${view.note}\n`
       out += `\n${view.text}`
```

---

### Incident Patch 9: `6a3b71d7` (2026-10-01)
**Commit Message**: fix(admin-rule): keyword 발췌를 매칭 줄 중심 창으로

긴 조문은 앞 2,500자만 실어 매칭 부분이 빠졌다. 외국환거래규정 keyword:"현금인출기능이"는
제1-2조(9,880자) 앞부분만 나와 키워드가 본문에 없었다. 첫 매칭을 품은 창을 줄 경계에 맞춰 싣고,
앞을 건너뛰면 조문 제목 줄을 남긴다. 조문 체계 없는 규칙의 절 단위 검색도 같은 창을 쓴다.

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/lib/admin-rule-keyword.test.ts` (added, +31/-0)
```diff
@@ -0,0 +1,31 @@
+import { describe, it, expect } from "vitest"
+import { parseAdminRuleArticles } from "./admin-rule-articles.js"
+import { keywordView } from "./admin-rule-keyword.js"
+
+// 외국환거래규정 제1-2조(용어의 정의) 실측 형상: 9,880자 한 조문, 매칭 줄이 2,500자 뒤에 있다
+const DEFINITIONS = [
+  "제1장 총칙",
+  "제1-2조(용어의 정의) 이 규정에서 사용하는 용어의 정의는 다음과 같다.",
+  ...Array.from({ length: 40 }, (_, i) => `  ${i + 1}. "용어${i + 1}"이라 함은 ${"외국환 거래에 관한 사항".repeat(8)}을 말한다.`),
+  "  41. \"대외지급수단\"이란 외국환은행이 발급한 현금인출기능이 포함된 카드를 말한다. <기획재정부고시 제2020-21호, 2020. 9. 30. 개정>",
+  ...Array.from({ length: 20 }, (_, i) => `  ${i + 42}. "용어${i + 42}"이라 함은 ${"지급 및 수령에 관한 사항".repeat(8)}을 말한다.`),
+  "제1-3조(적용범위) 이 규정은 …",
+].join("\n")
+
+describe("keywordView — 긴 조문의 발췌 창", () => {
+  it("매칭 줄이 앞 2,500자 밖이어도 발췌에 들어간다 (조문 제목 줄은 유지)", () => {
+    const text = keywordView(parseAdminRuleArticles(DEFINITIONS), "현금인출기능이", 10)
+    const body = text.slice(text.indexOf("\n\n") + 2)
+    expect(body).toContain("현금인출기능이 포함된 카드")
+    expect(body.startsWith("제1-2조(용어의 정의)")).toBe(true)
+    expect(body).toContain('jo:"제1-2조"로 전체 조회')
+    expect(body.length).toBeLessThan(2900)
+  })
+
+  it("조문 체계 없는 본문(절 단위)도 매칭 부분을 발췌한다", () => {
+    const nftc = ["2.1 일반", ...Array.from({ length: 60 }, () => "  설치 기준은 다음과 같이 한다. ".repeat(3)), "  수평거리는 2.1 m 이하로 한다."].join("\n")
+    const text = keywordView(parseAdminRuleArticles(nftc), "수평거리", 10, nftc)
+    expect(text).toContain("수평거리는 2.1 m 이하")
+    expect(text).toContain("2.1 일반")
+  })
+})
```

**File**: `src/lib/admin-rule-keyword.ts` (modified, +20/-2)
```diff
@@ -23,14 +23,32 @@ export function splitSections(body: string): Array<{ num?: string, text: string
   return out.map(s => ({ num: s.num, text: s.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() })).filter(s => s.text)
 }
 
+/**
+ * 키워드 첫 매칭을 품은 max 자 안팎의 발췌. 앞 max 자만 자르면 긴 조문(외국환거래규정 제1-2조 9,880자)에서
+ * 매칭 부분이 빠졌다. 창은 줄 경계에 맞추고, 앞을 건너뛰면 첫 줄(조문 제목)을 남긴다.
+ */
+function excerptAround(text: string, kw: string, max: number): string {
+  if (text.length <= max) return text
+  const at = Math.max(0, text.indexOf(kw))
+  let start = Math.max(0, Math.min(at - Math.floor(max / 3), text.length - max))
+  const lineStart = text.lastIndexOf("\n", start) + 1
+  if (at + kw.length <= lineStart + max) start = lineStart // 줄 머리로 당겨도 매칭이 창 안에 있을 때만
+  let end = Math.min(text.length, start + max)
+  const lineEnd = text.lastIndexOf("\n", end)
+  if (end < text.length && lineEnd > at + kw.length) end = lineEnd
+  const firstLineEnd = text.indexOf("\n")
+  const head = start > 0 && firstLineEnd > 0 ? `${text.slice(0, Math.min(firstLineEnd, 200))}\n   …\n` : ""
+  return head + text.slice(start, end)
+}
+
 function sectionKeywordView(body: string, kw: string, maxResults: number): string {
   const hits = splitSections(body).filter(s => s.text.includes(kw))
   if (hits.length === 0) return `[NOT_FOUND] 본문에 '${kw}'을(를) 포함한 절이 없습니다.\n⚠️ LLM은 기준 내용을 추측/생성하지 마세요.`
   const cap = Math.max(1, Math.min(maxResults || 10, 30))
   const labels = hits.map(s => s.num).filter(Boolean)
   let text = `'${kw}' 포함 ${hits.length}곳${labels.length ? `: ${labels.join(", ")}` : ""}\n`
   text += hits.length > cap ? `(아래 본문은 상위 ${cap}곳 — 절 번호는 jo:"2.7.3"처럼 조회)\n\n` : "\n"
-  return text + hits.slice(0, cap).map(s => s.text.length > 2500 ? `${s.text.slice(0, 2500)}\n   …` : s.text).join("\n\n---\n\n")
+  return text + hits.slice(0, cap).map(s => s.text.length > 2500 ? `${excerptAround(s.text, kw, 2500)}\n   …` : s.text).join("\n\n---\n\n")
 }
 
 export function keywordView(parsed: ParsedAdminRule, keyword: string, maxResults: number, body = ""): string {
@@ -52,7 +70,7 @@ export function keywordView(parsed: ParsedAdminRule, keyword: string, maxResults
   for (const a of shown) {
     const joLabel = a.key.includes("의") ? `제${a.key.replace("의", "조의")}` : `제${a.key}조`
     let body = a.lines.join("\n")
-    if (body.length > PER) body = body.slice(0, PER) + `\n   … (이 조문 ${body.length.toLocaleString()}자 — jo:"${joLabel}"로 전체 조회)`
+    if (body.length > PER) body = excerptAround(body, kw, PER) + `\n   … (이 조문 ${body.length.toLocaleString()}자 — jo:"${joLabel}"로 전체 조회)`
     text += `${body}\n\n---\n\n`
   }
   return text.replace(/\n\n---\n\n$/u, "")
```

---

### Incident Patch 10: `f2150422` (2026-10-01)
**Commit Message**: fix(admin-rule): 편이 있는 규칙의 장을 (편, 장)으로 가리고 절·편 헤더를 제자리에

- 편마다 장 번호가 1부터 다시 시작하는데 장 번호 하나만 키로 써서, 금융투자업규정
  chapter:"제2장"이 여러 편의 제2장 119개조(90,886자)를 섞어 5만 자에서 잘렸고
  jo:"제4-50조"의 장 제목이 제2편 제3장으로 나왔다(applicable_law 행정규칙 본문에도 같은 제목).
  조문마다 편·장을 기록하고 장 키를 (편, 장)으로. 같은 번호 장이 여러 편에 있으면
  chapter:"제4편 제3장" 형식의 후보 목록을 돌려준다. "제4편"은 편 전체
- "제11장의2"·"제4편의2"·"제1장의2" 헤더를 인식 못 해 그 장의 조문이 앞 장에 들어갔다
- 절·관 헤더가 앞 조문 끝에 붙어 외국환거래규정 40개조·금융투자업규정 48개조가 다음 절·편
  제목으로 끝났고, 맨 앞 "제1절 통칙"·"제1편 총칙"은 서문으로 빠졌다. 절·관은 다음 조문 앞에,
  편은 편 목록에. 빈 줄 아닌 줄 보존은 그대로(외국환 1,941/1,941, 금융투자업 4,818/4,818)
- 200줄 규칙: jo·chapter 입력 정규화를 admin-rule-jo.ts, keyword 뷰를 admin-rule-keyword.ts 로
  옮김(동작 변화 없음)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/lib/admin-rule-articles.structure.test.ts` (added, +146/-0)
```diff
@@ -0,0 +1,146 @@
+import { describe, it, expect } from "vitest"
+import { parseAdminRuleArticles } from "./admin-rule-articles.js"
+import { buildPartialBody } from "./admin-rule-views.js"
+
+// 금융투자업규정 실측 축약 (2026-10-01 감사, 일련번호 2100000285020): 편마다 장 번호가 1부터 다시 시작하고,
+// 하이픈 앞자리는 장이 아니라 편 번호다. 편 바로 아래 조문(제1편·제4편의2), 장의2·편의2 헤더가 섞여 있다.
+const FIN_BODY = [
+  "제1편 총칙",
+  "제1-1조(목적) 이 규정은 「자본시장과 금융투자업에 관한 법률」(이하 \"법\"이라 한다)…",
+  "제2편 금융투자업",
+  "제1장 인가ㆍ등록",
+  "제2-1조(인가요건)",
+  " ① 영 제16조제1항제8호에서 \"금융위원회가 정하여 고시하는 금융기관\"이란 …",
+  "제2장 승인ㆍ보고",
+  "제2-12조(합병등 승인)",
+  " ① 영 제370조제2항제6호에 따라 금융투자업자가 …",
+  "제3장 금융투자업자의 지배구조",
+  "제2-17조",
+  "제2-18조",
+  "제3편 건전경영 유지",
+  "제1장 회계처리",
+  "제3-1조(회계처리기준) 금융투자업자의 회계처리에 관하여 …",
+  "  [전문개정 2010. 12. 29.]",
+  "제2장 재무건전성",
+  "제1절 통칙",
+  "제3-6조(용어의 정의) 이 규정에서 사용하는 용어의 정의는 다음 각 호와 같다.<개정 2016. 4. 14.>",
+  "  1. \"순자본\"이란 영업용순자본에서 총위험액을 차감한 금액을 말한다.<신설 2014. 11. 4.>",
+  "제4편 영업행위 규칙",
+  "제1장 공통영업행위 규칙",
+  "제1절 금융투자업자의 업무일반",
+  "제4-1조(겸영업무)",
+  " ① 영 제43조제3항제10호에서 \"금융위원회가 정하여 고시하는 금융업무\"란 …",
+  "제3장 집합투자업자의 영업행위 규칙",
+  "제1절 집합투자재산의 운용",
+  "제4-49조(집합투자업자 명의의 자산 취득 등) 영 제79조제2항제8호에 따라 …",
+  "제4-50조(부동산 관련 자산 등)",
+  " ① 영 제80조제1항제1호마목에서 \"금융위원회가 정하여 고시하는 부동산 관련 자산\"이란 …",
+  "제4편의2 온라인소액투자중개업자 [본편 신설 2016. 1. 19.]",
+  "제4-104조(등록요건)",
+  " ① 영 제118조의4제2항에 따른 사업계획, …",
+  "제5편 장외거래",
+  "제1장 총칙",
+  "제5-1조(용어의 정의) 이 편에서 사용하는 용어의 정의는 다음 각 호와 같다.",
+  "제2장 비상장 지분증권 등의 장외거래 <개정 2019. 11. 21., 2025. 9. 23.>",
+  "제5-2조(호가중개시스템의 공시사항 및 공시방법 등)",
+  "제11장 장외파생상품의 거래",
+  "제5-49조(장외파생상품의 매매기준)",
+  "  5. 그 밖에 금융위원회에 특정한 거래정보의 제공을 요청하여 승인을 받은 자",
+  "제11장의2 장외거래의 청산의무 [본장신설 2013. 7. 9.]",
+  "제5-50조의5(장외거래의 청산의무)",
+  "제12장 공공적법인 발행주식의 취득승인",
+  "제5-51조(주식의 대량취득의 승인신청) 법 제167조제1항의 기준을 초과하여 …",
+].join("\n")
+
+// 외국환거래규정 실측 축약 (일련번호 2100000285140): 절 헤더가 조문 사이에 낀다
+const FX_SECTIONS = [
+  "제2장 외국환업무취급기관 등",
+  "제1절 외국환은행",
+  "제2-11조의2(외환건전성부담금의 부과)",
+  "  ⑤ 제2항 및 제4항은 2024년부터 2026년 사업연도까지의 외환건전성부담금을 부과하는 경우에 한정하여 적용한다.",
+  "제2절 기타 외국환업무취급기관",
+  "제2-12조(기타 외국환업무취급기관의 외국환업무)",
+  "  ② <삭 제><기획재정부고시 제2016-6호, 2016. 3. 22. 개정>",
+  "제5장 지급등의 방법",
+  "제2절 상계등 계정의 대기 또는 차기에 의한 지급등의 방법",
+  "제1관 상계",
+  "제5-4조(상계)",
+].join("\n")
+
+const byKey = (body: string, key: string) => parseAdminRuleArticles(body).articles.find(a => a.key === key)!
+
+describe("parseAdminRuleArticles — 절·관·편 헤더 위치", () => {
+  it("절 헤더는 앞 조문 끝이 아니라 다음 조문 앞에 붙는다", () => {
+    expect(byKey(FX_SECTIONS, "2-11의2").lines.at(-1)).toContain("2026년 사업연도까지")
+    expect(byKey(FX_SECTIONS, "2-12").lines[0]).toBe("제2절 기타 외국환업무취급기관")
+    expect(byKey(FX_SECTIONS, "5-4").lines.slice(0, 2)).toEqual(["제2절 상계등 계정의 대기 또는 차기에 의한 지급등의 방법", "제1관 상계"])
+  })
+
+  it("맨 앞 절 헤더는 서문이 아니라 첫 조문에, 맨 앞 편 헤더는 편 목록에 담긴다", () => {
+    const p = parseAdminRuleArticles("제1장 총칙\n제1절 통칙\n제1-1조(목적) 가.")
+    expect(p.preamble).toEqual([])
+    expect(p.articles[0].lines[0]).toBe("제1절 통칙")
+    const q = parseAdminRuleArticles(FIN_BODY)
+    expect(q.preamble).toEqual([])
+    expect(q.parts[0]).toEqual({ key: "1", title: "제1편 총칙" })
+  })
+
+  it("장의N 헤더를 인식해 그 장의 조문을 앞 장에 넣지 않는다", () => {
+    expect(byKey(FIN_BODY, "5-49").lines.join("\n")).not.toContain("제11장의2")
+    expect(byKey(FIN_BODY, "5-50의5").chapter).toBe("11의2")
+    expect(byKey(FIN_BODY, "5-49").chapter).toBe("11")
+  })
+
+  it("조문은 (편, 장)에 귀속되고, 장 없는 편의 조문은 앞 편의 장을 물려받지 않는다", () => {
+    expect([byKey(FIN_BODY, "2-17"), byKey(FIN_BODY, "4-50")].map(a => [a.part, a.chapter])).toEqual([["2", "3"], ["4", "3"]])
+    expect([byKey(FIN_BODY, "1-1"), byKey(FIN_BODY, "4-104")].map(a => [a.part, a.chapter])).toEqual([["1", ""], ["4의2", ""]])
+  })
+
+  it("빈 줄 아닌 줄은 하나도 빠지거나 겹치지 않는다", () => {
+    for (const body of [FIN_BODY, FX_SECTIONS]) {
+      const p = parseAdminRuleArticles(body)
+      const kept = [...p.preamble, ...p.parts.map(x => x.title), ...p.chapters.map(c => c.title), ...p.articles.flatMap(a => a.lines)]
+      expect(kept.filter(l => l.trim()).sort()).toEqual(body.split("\n").filter(l => l.trim()).sort())
+    }
+  })
+
+  it("조문이 하나도 없으면 절 헤더도 서문에 남는다 (유실 금지)", () => {
+    expect(parseAdminRuleArticles("제1절 일반\n가. 성실히 수행한다.").preamble).toEqual(["제1절 일반", "가. 성실히 수행한다."])
+  })
+})
+
+describe("buildPartialBody — 편이 있는 규칙의 장 (편마다 장 번호가 다시 시작)", () => {
+  it("jo 결과의 장 제목은 그 조문이 속한 편의 장이다", () => {
+    const { text } = buildPartialBody(FIN_BODY, FIN_BODY, { jo: "제4-50조" })
+    expect(text.startsWith("제4편 영업행위 규칙\n제3장 집합투자업자의 영업행위 규칙\n\n")).toBe(true)
+    expect(text).not.toContain("금융투자업자의 지배구조")
+  })
+
+  it("같은 번호 장이 여러 편에 있으면 섞지 않고 편 지정 후보를 돌려준다", () => {
+    const { text } = buildPartialBody(FIN_BODY, FIN_BODY, { chapter: "제2장" })
+    expect(text).toContain('chapter:"제2편 제2장"')
+    expect(text).toContain('chapter:"제3편 제2장"')
+    expect(text).toContain('chapter:"제5편 제2장"')
+    expect(text).not.toContain("[NOT_FOUND]")
+    expect(text).not.toContain("영 제370조제2항제6호") // 조문 본문은 싣지 않는다
+  })
+
+  it("chapter:'제4편 제3장' 은 그 편의 장만", () => {
+ 
```

**File**: `src/lib/admin-rule-articles.test.ts` (modified, +20/-10)
```diff
@@ -1,5 +1,6 @@
 import { describe, it, expect } from "vitest"
-import { parseAdminRuleArticles, normalizeAdminJo, normalizeChapter, findArticle } from "./admin-rule-articles.js"
+import { parseAdminRuleArticles } from "./admin-rule-articles.js"
+import { normalizeAdminJo, normalizeChapter, findArticle } from "./admin-rule-jo.js"
 import { buildPartialBody, paginateFullText, pickPartialMode } from "./admin-rule-views.js"
 
 // 외국환거래규정 실측 패턴 축약 픽스처 — 하이픈형(제{장}-{조}조) 체계
@@ -60,8 +61,8 @@ describe("parseAdminRuleArticles — 헤더 패턴 (AC#10)", () => {
   })
 
   it("장 헤더를 인식하고 조문을 장에 귀속시킨다", () => {
-    expect(parsed.chapters.map((c) => c.num)).toEqual([1, 2, 9, 10])
-    expect(parsed.articles.find((a) => a.key === "9-5")!.chapter).toBe(9)
+    expect(parsed.chapters.map((c) => c.key)).toEqual(["1", "2", "9", "10"])
+    expect(parsed.articles.find((a) => a.key === "9-5")!.chapter).toBe("9")
   })
 
   it("항목식 본문은 조문 0개로 파싱된다", () => {
@@ -94,7 +95,15 @@ describe("normalizeAdminJo — 입력 정규화", () => {
   })
 
   it("normalizeChapter — 제9장·9장·9 모두 9", () => {
-    expect([normalizeChapter("제9장"), normalizeChapter("9장"), normalizeChapter("9")]).toEqual([9, 9, 9])
+    expect([normalizeChapter("제9장"), normalizeChapter("9장"), normalizeChapter("9")]).toEqual([{ chapter: "9" }, { chapter: "9" }, { chapter: "9" }])
+  })
+
+  it("normalizeChapter — 편 지정·장의N·편의N", () => {
+    expect(normalizeChapter("제4편 제3장")).toEqual({ part: "4", chapter: "3" })
+    expect(normalizeChapter("4편3장")).toEqual({ part: "4", chapter: "3" })
+    expect(normalizeChapter("제11장의2")).toEqual({ chapter: "11의2" })
+    expect(normalizeChapter("제4편의2")).toEqual({ part: "4의2" })
+    expect(normalizeChapter("총칙")).toBeNull()
   })
 })
 
@@ -158,8 +167,8 @@ describe("parseAdminRuleArticles — 라인 유실 방어", () => {
     const body = ["제1장 총칙", "제1조(목적) 가.", "제2조(정의) 나.", "제2장 벌칙", "제1조(과태료) 다.", "제2조(경과) 라."].join("\n")
     const p = parseAdminRuleArticles(body)
     expect(p.articles).toHaveLength(4)
-    expect(p.articles.map((a) => a.chapter)).toEqual([1, 1, 2, 2])
-    expect(p.articles.filter((a) => a.chapter === 2).map((a) => a.lines.join(""))).toEqual([
+    expect(p.articles.map((a) => a.chapter)).toEqual(["1", "1", "2", "2"])
+    expect(p.articles.filter((a) => a.chapter === "2").map((a) => a.lines.join(""))).toEqual([
       "제1조(과태료) 다.", "제2조(경과) 라.",
     ])
   })
@@ -211,11 +220,12 @@ describe("parseAdminRuleArticles: 라인 안 공백 덩어리 (리뷰 C7)", () =
   it("줄 끝 공백 제거는 종전과 같다", () => {
     expect(parseAdminRuleArticles("제1장 총칙\n제1조(목적) 가.   \n  본문\t\n제2조 나\n제3조의2 다  \n")).toEqual({
       articles: [
-        { key: "1", ord: [1, 0, 0], label: "제1조(목적) 가.", lines: ["제1조(목적) 가.", "  본문"], chapter: 1 },
-        { key: "2", ord: [2, 0, 0], label: "제2조 나", lines: ["제2조 나"], chapter: 1 },
-        { key: "3의2", ord: [3, 0, 2], label: "제3조의2 다", lines: ["제3조의2 다", ""], chapter: 1 },
+        { key: "1", ord: [1, 0, 0], label: "제1조(목적) 가.", lines: ["제1조(목적) 가.", "  본문"], chapter: "1", part: "" },
+        { key: "2", ord: [2, 0, 0], label: "제2조 나", lines: ["제2조 나"], chapter: "1", part: "" },
+        { key: "3의2", ord: [3, 0, 2], label: "제3조의2 다", lines: ["제3조의2 다", ""], chapter: "1", part: "" },
       ],
-      chapters: [{ num: 1, title: "제1장 총칙" }],
+      chapters: [{ part: "", key: "1", title: "제1장 총칙" }],
+      parts: [],
       preamble: [],
     })
   })
```

**File**: `src/lib/admin-rule-articles.ts` (modified, +48/-58)
```diff
@@ -8,7 +8,9 @@
  * 조문 번호 체계 2종을 모두 다룬다:
  *  - 하이픈형: 제9-5조, 제2-6조의2  (외국환거래규정 등 — 장 번호가 조 번호 앞자리)
  *  - 일반형:   제10조, 제10조의2
+ * jo·chapter 입력 정규화와 조문 찾기는 admin-rule-jo.ts.
  */
+import { toKey, structKey } from "./admin-rule-jo.js"
 
 export interface AdminRuleArticle {
   /** 정규화 키: "9-5" | "9-5의2" | "10" | "10의2" */
@@ -19,19 +21,25 @@ export interface AdminRuleArticle {
   label: string
   /** 헤더 포함 본문 라인들 */
   lines: string[]
-  /** 소속 장 번호 (없으면 0) */
-  chapter: number
+  /** 소속 장 키: "9" | "11의2" (장 헤더가 없으면 "") */
+  chapter: string
+  /** 소속 편 키: "4" | "4의2" (편 헤더가 없으면 "") — 편마다 장 번호가 1부터 다시 시작하므로 장은 (편, 장)으로 가린다 */
+  part: string
 }
 
 export interface AdminRuleChapter {
-  num: number
+  /** 이 장이 속한 편 키 (편 없으면 "") */
+  part: string
+  key: string
   /** 장 헤더 라인 원문 */
   title: string
 }
 
 export interface ParsedAdminRule {
   articles: AdminRuleArticle[]
   chapters: AdminRuleChapter[]
+  /** 편 헤더 (편 체계가 없으면 빈 배열) */
+  parts: Array<{ key: string, title: string }>
   /** 첫 조문 이전의 서문 라인들 */
   preamble: string[]
 }
@@ -42,49 +50,15 @@ export interface ParsedAdminRule {
  * "…제9-5조제3항의 규정에 의한…" 같은 본문 중간 참조는 ^ 앵커 + 단조증가 검사로 걸러진다.
  */
 const HEADER_RE = /^제(\d+)(?:-(\d+))?조(?:의(\d+))?(?=$|[\s(（<①-㊿])/u
-const CHAPTER_RE = /^제(\d+)장(?=$|[\s(（])/u
-
-function toKey(main: number, branch: number, ui: number): string {
-  return `${main}${branch ? `-${branch}` : ""}${ui ? `의${ui}` : ""}`
-}
+// "제11장의2"·"제4편의2" 처럼 가지 번호가 붙은 헤더도 있다(금융투자업규정 실측)
+const CHAPTER_RE = /^제(\d+)장(?:의(\d+))?(?=$|[\s(（])/u
+const PART_RE = /^제(\d+)편(?:의(\d+))?(?=$|[\s(（])/u
+const SECTION_RE = /^제\d+(?:절|관)(?:의\d+)?(?=$|[\s(（])/u
 
 function ordCompare(a: [number, number, number], b: [number, number, number]): number {
   return a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
 }
 
-/**
- * jo 입력 정규화 → 후보 키 목록 (우선순위 순).
- * "제9-5조"·"9-5" → ["9-5", "9의5"] / "제9-5조의2"·"9-5-2" → ["9-5의2"]
- * "제10조"·"10" → ["10"] / "제10조의2"·"10의2"·"10-2" → ["10의2"] 또는 ["10-2","10의2"]
- * 하이픈형인지 일반형인지 입력만으로 확정할 수 없는 경우 두 해석을 모두 후보로 돌려주고,
- * 호출부가 실제 파싱된 조문 키와 대조해 먼저 맞는 것을 쓴다.
- */
-export function normalizeAdminJo(input: string): string[] {
-  const clean = String(input)
-    .replace(/[‐‑‒–—―﹘﹣－]/gu, "-")
-    .replace(/\s+/gu, "")
-    .replace(/^제/u, "")
-    .replace(/제?\d+[항호목].*$/u, "") // "제9-5조제3항" 꼬리 허용
-  const m = /^(\d+)(?:-(\d+))?조?(?:의(\d+)|-(\d+))?$/u.exec(clean)
-  if (!m) return []
-  const main = Number(m[1])
-  const branch = m[2] ? Number(m[2]) : 0
-  const ui = m[3] ? Number(m[3]) : m[4] ? Number(m[4]) : 0
-  if (branch && ui) return [toKey(main, branch, ui)]
-  if (branch) {
-    // "9-5": 하이픈형 조문이 우선, 없으면 일반형 "9조의5"로 해석
-    return [toKey(main, branch, 0), toKey(main, 0, branch)]
-  }
-  if (ui) return [toKey(main, 0, ui)]
-  return [toKey(main, 0, 0)]
-}
-
-/** "제9장" | "9장" | "9" → 9 (해석 불가면 0) */
-export function normalizeChapter(input: string): number {
-  const m = /^제?\s*(\d+)\s*장?$/u.exec(String(input).trim())
-  return m ? Number(m[1]) : 0
-}
-
 /**
  * 전문 라인 스캔 파서.
  * 새 조문 헤더는 직전 조문보다 번호가 커야 한다(단조증가) — 하이픈형은 장 번호가
@@ -95,9 +69,11 @@ export function parseAdminRuleArticles(body: string): ParsedAdminRule {
   const lines = body.split(/\r?\n/u)
   const articles: AdminRuleArticle[] = []
   const chapters: AdminRuleChapter[] = []
+  const parts: ParsedAdminRule["parts"] = []
   const preamble: string[] = []
   let cur: AdminRuleArticle | null = null
-  let curChapter = 0
+  let curChapter = ""
+  let curPart = ""
   let lastOrd: [number, number, number] | null = null
   // 조문 사이에 끼는 절 헤더 등 — 다음 조문 앞에 붙여 부분 조회에서 유실되지 않게 한다
   let pending: string[] = []
@@ -111,10 +87,21 @@ export function parseAdminRuleArticles(body: string): ParsedAdminRule {
     // 헤더 판정은 원 라인 기준(^ 앵커) — 들여쓰기된 라인은 본문이다.
     // 실측(외국환거래규정 1,943라인)상 조문·장 헤더는 전부 들여쓰기 0이고,
     // trim 후 판정하면 "  제9-9조 제1항…" 같은 본문 참조가 헤더로 오인될 수 있다.
+    // 편 헤더: 새 편의 조문은 앞 편의 마지막 장을 물려받지 않는다(제4편의2 처럼 장 없는 편이 있다)
+    const pt = PART_RE.exec(line)
+    if (pt) {
+      curPart = structKey(pt[1], pt[2])
+      curChapter = ""
+      parts.push({ key: curPart, title: trimmed })
+      cur = null
+      lastOrd = null
+      continue
+    }
+
     const ch = CHAPTER_RE.exec(line)
     if (ch) {
-      curChapter = Number(ch[1])
-      chapters.push({ num: curChapter, title: trimmed })
+      curChapter = structKey(ch[1], ch[2])
+      chapters.push({ part: curPart, key: curChapter, title: trimmed })
       cur = null // 장 헤더는 어느 조문에도 속하지 않는다
       // 장마다 조 번호가 1부터 다시 시작하는 체계(제2장 제1조 등)에서 조문이 통째로
       // 유실되지 않도록 단조증가 기준을 장 단위로 리셋한다
@@ -132,34 +119,37 @@ export function parseAdminRuleArticles(body: string): ParsedAdminRule {
           label: trimmed,
           lines: pending.length ? [...pending, line] : [line],
           chapter: curChapter,
+          part: curPart,
         }
         pending = []
         // 하이픈형에서 장 헤더가 생략된 경우 조 번호 앞자리를 장으로 삼는다
-        if (!curChapter && ord[1] > 0) cur.chapter = ord[0]
+        // (편이 있는 규칙은 앞자리가 편 번호다 — 금융투자업규정 제4-50조는 제4편)
+        if (!
```

**File**: `src/lib/admin-rule-jo.ts` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+/**
+ * 행정규칙 부분 조회 입력 정규화 (jo · chapter) + 파싱 결과에서 조문 찾기
+ * 키 문법은 파서(admin-rule-articles.ts)와 이 파일이 함께 쓴다.
+ */
+import type { ParsedAdminRule, AdminRuleArticle } from "./admin-rule-articles.js"
+
+export function toKey(main: number, branch: number, ui: number): string {
+  return `${main}${branch ? `-${branch}` : ""}${ui ? `의${ui}` : ""}`
+}
+
+/** 편·장 키: ("11", "2") → "11의2" */
+export function structKey(num: string, ui?: string): string {
+  return `${Number(num)}${ui ? `의${Number(ui)}` : ""}`
+}
+
+/** 편·장 키 → 표기: ("11의2", "장") → "제11장의2" */
+export function structLabel(key: string, unit: "편" | "장"): string {
+  return key.replace(/^(\d+)(의\d+)?$/u, `제$1${unit}$2`)
+}
+
+/**
+ * jo 입력 정규화 → 후보 키 목록 (우선순위 순).
+ * "제9-5조"·"9-5" → ["9-5", "9의5"] / "제9-5조의2"·"9-5-2" → ["9-5의2"]
+ * "제10조"·"10" → ["10"] / "제10조의2"·"10의2"·"10-2" → ["10의2"] 또는 ["10-2","10의2"]
+ * 하이픈형인지 일반형인지 입력만으로 확정할 수 없는 경우 두 해석을 모두 후보로 돌려주고,
+ * 호출부가 실제 파싱된 조문 키와 대조해 먼저 맞는 것을 쓴다.
+ */
+export function normalizeAdminJo(input: string): string[] {
+  const clean = String(input)
+    .replace(/[‐‑‒–—―﹘﹣－]/gu, "-")
+    .replace(/\s+/gu, "")
+    .replace(/^제/u, "")
+    .replace(/제?\d+[항호목].*$/u, "") // "제9-5조제3항" 꼬리 허용
+  const m = /^(\d+)(?:-(\d+))?조?(?:의(\d+)|-(\d+))?$/u.exec(clean)
+  if (!m) return []
+  const main = Number(m[1])
+  const branch = m[2] ? Number(m[2]) : 0
+  const ui = m[3] ? Number(m[3]) : m[4] ? Number(m[4]) : 0
+  if (branch && ui) return [toKey(main, branch, ui)]
+  if (branch) {
+    // "9-5": 하이픈형 조문이 우선, 없으면 일반형 "9조의5"로 해석
+    return [toKey(main, branch, 0), toKey(main, 0, branch)]
+  }
+  if (ui) return [toKey(main, 0, ui)]
+  return [toKey(main, 0, 0)]
+}
+
+/**
+ * "제9장" | "9장" | "9" → { chapter: "9" } / "제4편 제3장" → { part: "4", chapter: "3" } /
+ * "제4편의2" → { part: "4의2" } (편 전체). 해석 불가면 null
+ */
+export function normalizeChapter(input: string): { part?: string, chapter?: string } | null {
+  const m = /^(?:제?(\d+)편(?:의(\d+))?)?(?:제?(\d+)장?(?:의(\d+))?)?$/u.exec(String(input).replace(/\s+/gu, ""))
+  if (!m || (!m[1] && !m[3])) return null
+  return {
+    ...(m[1] ? { part: structKey(m[1], m[2]) } : {}),
+    ...(m[3] ? { chapter: structKey(m[3], m[4]) } : {}),
+  }
+}
+
+/** 후보 키 목록에서 실제 존재하는 첫 조문을 찾는다 */
+export function findArticle(parsed: ParsedAdminRule, joInput: string): AdminRuleArticle | null {
+  const candidates = normalizeAdminJo(joInput)
+  for (const key of candidates) {
+    const hit = parsed.articles.find((a) => a.key === key)
+    if (hit) return hit
+  }
+  return null
+}
```

**File**: `src/lib/admin-rule-keyword.ts` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+/**
+ * 행정규칙 부분 조회의 keyword 뷰 (조문 단위 · 절 단위) + 절 나누기
+ */
+import type { ParsedAdminRule } from "./admin-rule-articles.js"
+
+/**
+ * 조문(제N조) 체계가 없는 본문의 절 — 화재안전기술기준(NFTC)식 "2.7.3" 번호 줄에서 끊는다.
+ * 번호 줄이 하나도 없으면(항목식 훈령) 빈 줄 문단으로 끊는다. 종전엔 이런 본문에 jo·keyword 가
+ * "조문 체계가 없습니다 — keyword 를 쓰세요"를 돌려줘 keyword 요청에 keyword 를 쓰라는 막다른 안내가 됐다.
+ */
+export function splitSections(body: string): Array<{ num?: string, text: string }> {
+  const lines = body.split("\n")
+  const numbered = lines.some(l => /^\s*\d+\.\d+(?:\.\d+)*\s/.test(l))
+  if (!numbered) {
+    return body.split(/\n\s*\n/).map(t => ({ text: t.trim() })).filter(p => p.text)
+  }
+  const out: Array<{ num?: string, lines: string[] }> = []
+  for (const line of lines) {
+    const m = line.match(/^\s*(\d+(?:\.\d+)*)\.?\s/)
+    if (m || out.length === 0) out.push({ num: m?.[1], lines: [line] })
+    else out[out.length - 1].lines.push(line)
+  }
+  return out.map(s => ({ num: s.num, text: s.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() })).filter(s => s.text)
+}
+
+function sectionKeywordView(body: string, kw: string, maxResults: number): string {
+  const hits = splitSections(body).filter(s => s.text.includes(kw))
+  if (hits.length === 0) return `[NOT_FOUND] 본문에 '${kw}'을(를) 포함한 절이 없습니다.\n⚠️ LLM은 기준 내용을 추측/생성하지 마세요.`
+  const cap = Math.max(1, Math.min(maxResults || 10, 30))
+  const labels = hits.map(s => s.num).filter(Boolean)
+  let text = `'${kw}' 포함 ${hits.length}곳${labels.length ? `: ${labels.join(", ")}` : ""}\n`
+  text += hits.length > cap ? `(아래 본문은 상위 ${cap}곳 — 절 번호는 jo:"2.7.3"처럼 조회)\n\n` : "\n"
+  return text + hits.slice(0, cap).map(s => s.text.length > 2500 ? `${s.text.slice(0, 2500)}\n   …` : s.text).join("\n\n---\n\n")
+}
+
+export function keywordView(parsed: ParsedAdminRule, keyword: string, maxResults: number, body = ""): string {
+  const kw = keyword.trim()
+  if (!kw) return "[NOT_FOUND] keyword 가 비어 있습니다 — 검색어를 지정하세요."
+  if (parsed.articles.length === 0) return sectionKeywordView(body, kw, maxResults)
+  const hits = parsed.articles.filter((a) => a.lines.some((l) => l.includes(kw)))
+  if (hits.length === 0) {
+    return `[NOT_FOUND] 본문에 '${kw}'을(를) 포함한 조문이 없습니다. (총 ${parsed.articles.length}개조 검색)\n⚠️ LLM은 조문 내용을 추측/생성하지 마세요.`
+  }
+  const cap = Math.max(1, Math.min(maxResults || 10, 30))
+  const shown = hits.slice(0, cap)
+  const PER = 2500
+  // 본문은 상위 cap개만 싣더라도, 매칭 조문 "목록"은 전부 보여준다 —
+  // 뒤쪽 장의 조문이 목록에서도 사라지면 jo로 이어 갈 단서가 없다.
+  const allLabels = hits.map((a) => a.label.split(/[\s(（<]/u)[0]).join(", ")
+  let text = `'${kw}' 포함 조문 ${hits.length}개: ${allLabels}\n`
+  text += hits.length > cap ? `(아래 본문은 상위 ${cap}개 — 나머지는 jo 파라미터로 조회, max_results로 조정 가능)\n\n` : "\n"
+  for (const a of shown) {
+    const joLabel = a.key.includes("의") ? `제${a.key.replace("의", "조의")}` : `제${a.key}조`
+    let body = a.lines.join("\n")
+    if (body.length > PER) body = body.slice(0, PER) + `\n   … (이 조문 ${body.length.toLocaleString()}자 — jo:"${joLabel}"로 전체 조회)`
+    text += `${body}\n\n---\n\n`
+  }
+  return text.replace(/\n\n---\n\n$/u, "")
+}
```

**File**: `src/lib/admin-rule-views.sections.test.ts` (modified, +2/-1)
```diff
@@ -1,5 +1,6 @@
 import { describe, it, expect } from "vitest"
-import { buildPartialBody, splitSections } from "./admin-rule-views.js"
+import { buildPartialBody } from "./admin-rule-views.js"
+import { splitSections } from "./admin-rule-keyword.js"
 
 // 화재안전기술기준(NFTC 103) 본문 형식 — 조문(제N조) 없이 "2.7.3" 절 번호 줄 (2026-09-28 실측 축약)
 const NFTC = [
```

**File**: `src/lib/admin-rule-views.ts` (modified, +34/-68)
```diff
@@ -8,10 +8,9 @@
 
 import { SimpleCache } from "./cache.js"
 import { MAX_RESPONSE_SIZE } from "./schemas.js"
-import {
-  parseAdminRuleArticles, findArticle, normalizeChapter,
-  type ParsedAdminRule, type AdminRuleArticle,
-} from "./admin-rule-articles.js"
+import { parseAdminRuleArticles, type ParsedAdminRule, type AdminRuleArticle } from "./admin-rule-articles.js"
+import { findArticle, normalizeChapter, structLabel } from "./admin-rule-jo.js"
+import { keywordView, splitSections } from "./admin-rule-keyword.js"
 
 /** 전문 XML 캐시 — 외국환거래규정 기준 응답 ~750KB이므로 상한을 작게 잡는다 */
 export const adminRuleXmlCache = new SimpleCache(20)
@@ -51,26 +50,6 @@ function renderArticles(items: AdminRuleArticle[]): string {
   return items.map((a) => a.lines.join("\n")).join("\n\n")
 }
 
-/**
- * 조문(제N조) 체계가 없는 본문의 절 — 화재안전기술기준(NFTC)식 "2.7.3" 번호 줄에서 끊는다.
- * 번호 줄이 하나도 없으면(항목식 훈령) 빈 줄 문단으로 끊는다. 종전엔 이런 본문에 jo·keyword 가
- * "조문 체계가 없습니다 — keyword 를 쓰세요"를 돌려줘 keyword 요청에 keyword 를 쓰라는 막다른 안내가 됐다.
- */
-export function splitSections(body: string): Array<{ num?: string, text: string }> {
-  const lines = body.split("\n")
-  const numbered = lines.some(l => /^\s*\d+\.\d+(?:\.\d+)*\s/.test(l))
-  if (!numbered) {
-    return body.split(/\n\s*\n/).map(t => ({ text: t.trim() })).filter(p => p.text)
-  }
-  const out: Array<{ num?: string, lines: string[] }> = []
-  for (const line of lines) {
-    const m = line.match(/^\s*(\d+(?:\.\d+)*)\.?\s/)
-    if (m || out.length === 0) out.push({ num: m?.[1], lines: [line] })
-    else out[out.length - 1].lines.push(line)
-  }
-  return out.map(s => ({ num: s.num, text: s.lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() })).filter(s => s.text)
-}
-
 /** 절 번호 조회 — 그 절과 하위 절(2.7 → 2.7.1, 2.7.1.1 …)을 함께 */
 function sectionJoView(body: string, jo: string): string | undefined {
   const want = jo.replace(/^제\s*/, "").replace(/\s*(조|절)$/, "").trim()
@@ -80,16 +59,6 @@ function sectionJoView(body: string, jo: string): string | undefined {
   return sections.map(s => s.text).join("\n\n")
 }
 
-function sectionKeywordView(body: string, kw: string, maxResults: number): string {
-  const hits = splitSections(body).filter(s => s.text.includes(kw))
-  if (hits.length === 0) return `[NOT_FOUND] 본문에 '${kw}'을(를) 포함한 절이 없습니다.\n⚠️ LLM은 기준 내용을 추측/생성하지 마세요.`
-  const cap = Math.max(1, Math.min(maxResults || 10, 30))
-  const labels = hits.map(s => s.num).filter(Boolean)
-  let text = `'${kw}' 포함 ${hits.length}곳${labels.length ? `: ${labels.join(", ")}` : ""}\n`
-  text += hits.length > cap ? `(아래 본문은 상위 ${cap}곳 — 절 번호는 jo:"2.7.3"처럼 조회)\n\n` : "\n"
-  return text + hits.slice(0, cap).map(s => s.text.length > 2500 ? `${s.text.slice(0, 2500)}\n   …` : s.text).join("\n\n---\n\n")
-}
-
 function joView(parsed: ParsedAdminRule, jo: string, context: number, body = ""): string {
   const hit = findArticle(parsed, jo)
   if (!hit) {
@@ -101,53 +70,50 @@ function joView(parsed: ParsedAdminRule, jo: string, context: number, body = "")
   const idx = parsed.articles.indexOf(hit)
   const n = Math.max(0, Math.min(context || 0, 10))
   const slice = parsed.articles.slice(Math.max(0, idx - n), idx + n + 1)
-  const chapterTitle = parsed.chapters.find((c) => c.num === hit.chapter)?.title
-  const head = chapterTitle ? `${chapterTitle}\n\n` : ""
-  return head + renderArticles(slice)
+  // 장 제목은 (편, 장)으로 찾는다 — 장 번호만으로 찾으면 다른 편의 같은 번호 장 제목이 붙었다
+  const head = headings(parsed, hit.part, hit.chapter).join("\n")
+  return (head ? `${head}\n\n` : "") + renderArticles(slice)
 }
 
+/** (편, 장) 헤더 원문 — 본문에 헤더가 없는 쪽은 빠진다 */
+function headings(parsed: ParsedAdminRule, part: string, chapter?: string): string[] {
+  const p = part ? parsed.parts.find((x) => x.key === part)?.title : ""
+  const c = chapter ? parsed.chapters.find((x) => x.part === part && x.key === chapter)?.title : ""
+  return [p, c].filter((s): s is string => Boolean(s))
+}
+
+const firstToken = (a: AdminRuleArticle) => a.label.split(/[\s(（<]/u)[0]
+
 function chapterView(parsed: ParsedAdminRule, chapter: string): string {
   if (parsed.articles.length === 0) return NO_ARTICLE_MSG
-  const num = normalizeChapter(chapter)
-  if (!num) return `[NOT_FOUND] chapter 값 '${chapter}'을(를) 해석하지 못했습니다. "제9장" 형식으로 지정하세요.`
-  const items = parsed.articles.filter((a) => a.chapter === num)
+  const want = normalizeChapter(chapter)
+  if (!want) return `[NOT_FOUND] chapter 값 '${chapter}'을(를) 해석하지 못했습니다. "제9장" 형식(편이 있는 규칙은 "제4편 제3장")으로 지정하세요.`
+  const items = parsed.articles.filter((a) =>
+    (want.part === undefined || a.part === want.part) && (want.chapter === undefined || a.chapter === want.chapter))
+  const label = (part: string, ch?: string) => [part && structLabel(part, "편"), ch && structLabel(ch, "장")].filter(Boolean).join(" ")
   if (items.length === 0) {
-    const avail = [...new Set(parsed.articles.map((a) => a.chapter))].filter(Boolean).join(", ")
-    return `[NOT_FOUND] 제${num}장에 속한 조문이 없습니다. (수록 장: ${avail || "구분 없음"})`
+    const avail = [...new Set(parsed.articles.map
```

**File**: `src/tools/admin-rule.ts` (modified, +1/-1)
```diff
@@ -122,7 +122,7 @@ export const GetAdminRuleSchema = z.object({
   id: z.string().describe("행정규칙일련번호 13자리 (search_admin_rule 결과의 '행정규칙일련번호'. 4~5자리 '행정규칙ID'는 조회되지 않음)"),
   jo: z.string().optional().describe("조문 지정 — '제9-5조', '9-5', '제10조의2', '9-5-2' 형식 모두 수용. 지정 조문만 반환"),
   context: z.number().optional().describe("jo와 함께 사용 — 전후 n개 조문을 함께 반환 (기본 0, 최대 10)"),
-  chapter: z.string().optional().describe("장 지정 — '제9장' 또는 '9'. 해당 장 전체 반환"),
+  chapter: z.string().optional().describe("장 지정 — '제9장' 또는 '9'. 해당 장 전체 반환. 편마다 장 번호가 다시 시작하는 규칙(금융투자업규정 등)은 '제4편 제3장', 편 전체는 '제4편'"),
   keyword: z.string().optional().describe("본문 키워드 — 키워드가 포함된 조문 블록 목록 반환"),
   max_results: z.number().optional().describe("keyword와 함께 사용 — 최대 조문 수 (기본 10, 최대 30)"),
   page: z.number().optional().describe("전문을 청크로 페이징 조회 (1부터). 응답에 page/total_pages 표기"),
```

---

### Incident Patch 11: `0c12352d` (2026-10-01)
**Commit Message**: fix(chains): 기반 법령 탐색 만료·판례 상세 지연이 이미 받은 갈래를 버리던 것

- full_research·procedure_detail: 기반 법령 탐색(최대 3단계 직렬)이 데드라인에 걸리면
  시간 안에 받은 AI·해석례·판례 검색·상세까지 버리고 머리글과 "받은 전부" 고지만 냈다
  (실측: 법령 검색만 8초 지연, 데드라인 5초 → 111자·114자). 1단계 갈래마다 띄우는 시점에
  race 를 따로 걸어 끝난 결과를 남기고, 못 받은 자리(본문·법령 체계·별표·시나리오)만 ⏱ 마커로
  밝힌다. 만료 뒤에 새로 건 race 는 이미 끝난 작업에도 {ok:false} 라 완료 전에 걸어 둬야 한다
- full_research 의 본문·별표·시나리오 갈래는 AI·해석례까지 기다리지 않고 기반 법령만 기다린다
- full_research·dispute_prep: 판례 갈래를 검색·근거(상세) 단계로 나눠 race 한다
  (precedentSearchThenDetail). 상세 1건이 늦어도 받은 검색 목록은 싣고 상세 자리만 마커
- 정상 경로는 녹화 재생으로 출력 바이트 동일·업스트림 호출 수 동일 확인 (full_research 9,
  action_basis+penalty 19, law_system 3, procedure_detail 9, amendment_track 1,
  ordinance_compare 4, dispute_prep 5)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/tools/chains.deadline.test.ts` (modified, +126/-0)
```diff
@@ -40,6 +40,27 @@ const precXml =
   `<사건번호>2023두302036</사건번호><법원명>대법원</법원명><선고일자>20240208</선고일자><판결유형>판결</판결유형></prec>` +
   `</PrecSearch>`
 
+/** 판례 2건 — 상세는 상위 2건을 받으므로 한 건만 늦춰 "상세 일부 지연"을 만든다 */
+const prec2Xml =
+  `<?xml version="1.0" encoding="UTF-8"?><PrecSearch><totalCnt>2</totalCnt><page>1</page>` +
+  `<prec><판례일련번호>245007</판례일련번호><사건명><![CDATA[음주운전 면허취소 처분 취소]]></사건명>` +
+  `<사건번호>2023두302036</사건번호><법원명>대법원</법원명><선고일자>20240208</선고일자><판결유형>판결</판결유형></prec>` +
+  `<prec><판례일련번호>245008</판례일련번호><사건명><![CDATA[음주운전 면허정지 처분 취소]]></사건명>` +
+  `<사건번호>2023두302037</사건번호><법원명>대법원</법원명><선고일자>20240209</선고일자><판결유형>판결</판결유형></prec>` +
+  `</PrecSearch>`
+
+const precDetailJson = (id: string) => JSON.stringify({ PrecService: {
+  사건명: "음주운전 면허취소 처분 취소", 사건번호: `사건-${id}`, 법원명: "대법원", 선고일자: "20240208",
+  판시사항: `판시사항 본문 ${id}`,
+} })
+
+const aiXml = (lawName: string) =>
+  `<?xml version="1.0" encoding="UTF-8"?><aiSearch><검색결과개수>1</검색결과개수><법령조문>` +
+  `<법령ID>1000</법령ID><법령명>${lawName}</법령명><법령종류명>법률</법령종류명>` +
+  `<조문번호>0044</조문번호><조문제목>술에 취한 상태에서의 운전 금지</조문제목>` +
+  `<조문내용><![CDATA[누구든지 술에 취한 상태에서…]]></조문내용><시행일자>20230101</시행일자>` +
+  `</법령조문></aiSearch>`
+
 const after = <T,>(ms: number, value: T): Promise<T> =>
   new Promise(resolve => setTimeout(() => resolve(value), ms))
 
@@ -344,3 +365,108 @@ describe("2026-09-23 리뷰 B#7 law_system·procedure_detail·ordinance_compare
     expect(res.isError).toBeFalsy()
   })
 })
+
+describe("기반 법령 탐색만 만료돼도 시간 안에 받은 갈래는 싣는다", () => {
+  it("full_research: 기반 법령 검색이 매달려도 AI·해석례·판례 검색·상세는 싣고 본문 자리만 마커", async () => {
+    process.env.MCP_CHAIN_DEADLINE_MS = "5000"
+    const client = {
+      async searchLaw() { return hang<string>() },                       // 기반 법령 탐색만 매달림
+      async fetchApi({ endpoint, target, extraParams }: { endpoint?: string; target?: string; extraParams?: Record<string, string> }) {
+        if (target === "law") return hang<string>()
+        if (target === "aiSearch") return aiXml("도로교통법")
+        if (target === "expc" && endpoint === "lawSearch.do") return interpXml
+        if (target === "prec" && endpoint === "lawSearch.do") return precXml
+        if (target === "prec") return precDetailJson(extraParams?.ID ?? "")
+        return emptyAny
+      },
+    } as unknown as LawApiClient
+
+    const res = await runPastDeadline(chainFullResearch(client, { query: "도로교통법 음주운전" }))
+    const text = res.content[0]?.text ?? ""
+
+    expect(text).toMatch(/▶ AI 법령검색 결과\n[^⏱]/)                     // 종전: 머리글과 고지만 남았다
+    expect(text).toMatch(/▶ 법령 본문 \(기반 법령 검색\)\n⏱/)            // 못 받은 자리만 마커
+    expect(text).toMatch(/▶ 관련 판례\n[^⏱]/)
+    expect(text).toContain("[245007]")
+    expect(text).toContain("[8001]")
+    expect(text).toMatch(/▶ 관련 판례 상세\n[^⏱]/)
+    expect(text).toContain("판시사항 본문 245007")
+    expect(text).not.toContain("위까지가 시간 안에 받은 전부입니다")
+    expect(res.isError).toBeFalsy()
+  })
+
+  it("full_research: 질의가 별표를 원했는데 기반 법령 검색이 만료되면 별표 자리도 마커로 밝힌다", async () => {
+    process.env.MCP_CHAIN_DEADLINE_MS = "5000"
+    const client = {
+      async searchLaw() { return hang<string>() },
+      async fetchApi({ target }: { target?: string }) {
+        if (target === "law") return hang<string>()
+        if (target === "aiSearch") return aiXml("도로교통법")
+        return emptyAny
+      },
+    } as unknown as LawApiClient
+
+    const res = await runPastDeadline(chainFullResearch(client, { query: "도로교통법 음주운전 과태료" }))
+    const text = res.content[0]?.text ?? ""
+
+    expect(text).toMatch(/▶ 법령 본문 \(기반 법령 검색\)\n⏱/)
+    expect(text).toMatch(/▶ 별표\/서식\n⏱/)                            // 침묵 탈락 금지
+    expect(res.isError).toBeFalsy()
+  })
+
+  it("procedure_detail: 기반 법령 검색이 매달려도 받은 AI 검색은 싣는다", async () => {
+    process.env.MCP_CHAIN_DEADLINE_MS = "5000"
+    const client = {
+      async searchLaw() { return hang<string>() },
+      async fetchApi({ target }: { target?: string }) {
+        if (target === "aiSearch") return aiXml("여권법")
+        return hang<string>()
+      },
+    } as unknown as LawApiClient
+
+    const res = await runPastDeadline(chainProcedureDetail(client, { query: "여권법 발급 절차" }))
+    const text = res.content[0]?.text ?? ""
+
+    expect(text).toContain("절차/비용 안내: 여권법 발급 절차")
+    expect(text).toMatch(/▶ 법령 체계·별표\/서식 \(기반 법령 검색\)\n⏱/)
+    expect(text).toMatch(/▶ AI 검색 보완 정보\n[^⏱]/)                    // 종전: 시간 안에 왔는데 버려졌다
+    expect(text).not.toContain("위까지가 시간 안에 받은 전부입니다")
+    expect(res.isError).toBeFalsy()
+  })
+})
+
+describe("판례 갈래는 검색과 근거(상세)를 단계별로 race 한다", () => {
+  /** 판례 검색은 즉시, 상세는 245008 한 건만 매달리는 업스트림 */
+  const slowDetailClient = () => ({
+    async searchLaw() { return lawXml("도로교통법") },
+    async getLawText() { throw new Error("본문 조회 생략(mock)") },
+    async fetchApi({ endpoint, target, extraParams }: { endpoint?: string; target?: string; extraParams?: Record<string, string> }) {
+      if (target === "prec" && endpoint === "lawSearch.do") return prec2Xml
+      if (target === "prec" && extraP
```

**File**: `src/tools/chains.ts` (modified, +117/-73)
```diff
@@ -258,50 +258,59 @@ function selectLawTextSource(laws: LawInfo[], query: string): { reliableLaws: La
   return { reliableLaws, textLaw: laws[0], lowConfidence: laws.length > 0 }
 }
 
+/** 판례 갈래의 검색 단계 결과. 근거(상세) 단계가 같은 detailMemo 를 이어 쓴다 */
+interface PrecedentChainSearch {
+  structuredResult: StructuredPrecedentSearchResult
+  searchResult: CallResult
+  detailMemo: PrecedentDetailMemo
+}
+
 async function searchPrecedentsForChain(
   apiClient: LawApiClient,
   input: { query: string; display: number; apiKey?: string },
-  context: PrecedentSearchContext = {},
-  detailLimit = 2
-): Promise<{ structuredResult: StructuredPrecedentSearchResult; searchResult: CallResult; detailResult: CallResult | null }> {
+  context: PrecedentSearchContext = {}
+): Promise<PrecedentChainSearch> {
   const args: SearchPrecedentsInput = {
     query: input.query,
     display: input.display,
     page: 1,
     apiKey: input.apiKey,
   }
-  // 검증이 받은 상위 판례 상세를 아래 근거 조회가 다시 받지 않게 한 호출 안에서 공유한다 (B#10)
+  // 검증이 받은 상위 판례 상세를 근거 조회가 다시 받지 않게 한 호출 안에서 공유한다 (B#10)
   const detailMemo: PrecedentDetailMemo = new Map()
   const { result: search, error } = await safeSearchPrecedentsStructured(apiClient, args, {
     ...context,
     maxFallbackAttempts: context.maxFallbackAttempts ?? PRECEDENT_FALLBACK_LIMIT,
     validateResult: validation => validatePrecedentSearchResult(apiClient, validation, { apiKey: input.apiKey, detailMemo }),
   })
 
-  if (error) {
-    return {
-      structuredResult: search,
-      searchResult: error,
-      detailResult: null,
-    }
-  }
+  if (error) return { structuredResult: search, searchResult: error, detailMemo }
 
-  const searchResult: CallResult = {
-    text: renderPrecedentSearchResult(search),
-    isError: search.hits.length === 0,
+  return {
+    structuredResult: search,
+    searchResult: {
+      text: renderPrecedentSearchResult(search),
+      isError: search.hits.length === 0,
+    },
+    detailMemo,
   }
-  const evidence = await fetchPrecedentEvidence(apiClient, search, {
-    apiKey: input.apiKey,
+}
+
+/** 판례 갈래의 근거(상세) 단계. 검색이 실패했거나 0건이면 받을 상세가 없다 */
+async function fetchPrecedentDetailForChain(
+  apiClient: LawApiClient,
+  search: PrecedentChainSearch,
+  apiKey?: string,
+  detailLimit = 2
+): Promise<CallResult | null> {
+  if (search.searchResult.isError) return null
+  const evidence = await fetchPrecedentEvidence(apiClient, search.structuredResult, {
+    apiKey,
     detailLimit,
     full: false,
-    detailMemo,
+    detailMemo: search.detailMemo,
   })
-
-  return {
-    structuredResult: search,
-    searchResult,
-    detailResult: evidence ? { text: evidence.text, isError: evidence.isError } : null,
-  }
+  return evidence ? { text: evidence.text, isError: evidence.isError } : null
 }
 
 function combineStructuredPrecedentResults(
@@ -373,6 +382,25 @@ async function searchThenDetail(
   return { searchO, detailO }
 }
 
+type StagedOutcomes = { searchO: LegOutcome<CallResult>; detailO: LegOutcome<CallResult | null> }
+
+/**
+ * 판례 갈래(구조화 검색 → 근거 상세)를 단계별로 데드라인과 경주시킨다. 규칙은 searchThenDetail 과 같다.
+ * 갈래를 통짜로 race 하면 상세 한 건만 늦어도 시간 안에 받은 검색 목록까지 "관련 판례 ⏱"로 바뀐다
+ * (실측: 상세 1건 8초 지연, 검색은 79ms 에 200).
+ */
+async function precedentSearchThenDetail(
+  deadline: ChainDeadline,
+  apiClient: LawApiClient,
+  input: { query: string; display: number; apiKey?: string },
+  context: PrecedentSearchContext = {}
+): Promise<StagedOutcomes> {
+  const searchO = await raceDeadline(deadline, searchPrecedentsForChain(apiClient, input, context))
+  if (!searchO.ok) return { searchO, detailO: { ok: true, value: null } }
+  const detailO = await raceDeadline(deadline, fetchPrecedentDetailForChain(apiClient, searchO.value, input.apiKey))
+  return { searchO: { ok: true, value: searchO.value.searchResult }, detailO }
+}
+
 /** 질의에 법령명 모양 어절("관세법"·"… 시행령")이 있는가 — 없으면 기반 탐색이 의미검색까지 가야 한다 */
 const LAW_NAME_TOKEN_RE = /[가-힣](?:법|법률|시행령|시행규칙|규칙|규정)(?=\s|$)/
 
@@ -629,14 +657,12 @@ export async function chainDisputePrep(
     const domainSearch = DISPUTE_DOMAIN_SEARCH[domain]
     const exp = detectExpansions(input.query)
 
-    // 판례는 구조화 hit 기반 상세조회까지 한 경로(searchPrecedentsForChain)라 통짜로,
-    // 나머지 검색→상세 갈래는 단계별로 race 한다. 출력 순서는 조립에서 지킨다.
-    const [precedentO, appeal, domainR, interp] = await Promise.all([
-      raceDeadline(dl, searchPrecedentsForChain(
-        apiClient,
+    // 검색→상세 갈래는 판례까지 모두 단계별로 race 한다. 판례를 통짜로 race 하면 상세가 늦을 때
+    // 받은 검색 목록까지 마커로 바뀐다. 출력 순서는 조립에서 지킨다.
+    const [prec, appeal, domainR, interp] = await Promise.all([
+      precedentSearchThenDetail(dl, apiClient,
         { query: input.query, display: 8, apiKey: input.apiKey },
-        { route: routeQuery(input.query) }
-      )),
+        { route: routeQuery(input.query) }),
       searchThenDetail(dl, apiClient, "search_admin_appeals",
         () => callTool(searchAdminAppeals, apiClient, { query: input.query, display: 8, apiKey: input.apiKey }),
         input.apiKey),
@@ -652,13 +678,10 @@ export
```

---

### Incident Patch 12: `b1d13c58` (2026-10-01)
**Commit Message**: fix(history): get_law_text 기준일 보정·search_historical_law 도 동명 구법까지

- 폐지 후 같은 이름으로 재제정된 법령(근로기준법 1997.3.13.)은 계보가 신법만이라
  get_law_text(lawId, efYd=1995…)가 그날 버전을 못 찾았다. 계보 시작보다 앞선 기준일에서만
  동명 구법 연혁을 붙여 보정하고, 구법 버전임을 안내에 밝힌다 (실측: MST 4972 1990.7.14.)
- search_historical_law 는 기준일이 없어 구법 연혁이 빠졌다(1997년부터). 계보 첫 행이 제정이면
  이름 연혁을 한 번 더 받아 구법 버전을 구분선 아래 싣는다 (실측: 1953년 제정본부터)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/tools/historical-law.test.ts` (modified, +28/-0)
```diff
@@ -160,3 +160,31 @@ describe("searchHistoricalLaw: historical-utils 파서 공용 (B12)", () => {
     expect(t).toContain("MST: 52908")                // 시행일 내림차순 첫 버전
   })
 })
+
+// 폐지 후 같은 이름으로 재제정돼 법령ID가 바뀐 법령(근로기준법 1997.3.13.). 계보(LID)는 신법만 줘서 연혁 목록이
+// 1997년부터였다 — v4.14.2 는 이름 일치 연혁으로 1953년 제정본부터 보였다(2026-10-01 감사 실측 56 → 54).
+describe("search_historical_law — 동명 구법 연혁", () => {
+  const LSA = "근로기준법"
+  const lrow = (mst: string, efYd: string, rr: string) =>
+    `<law id="x"><법령일련번호>${mst}</법령일련번호><법령명한글><![CDATA[${LSA}]]></법령명한글><법령ID>001872</법령ID>` +
+    `<공포일자>${efYd}</공포일자><공포번호>1</공포번호><제개정구분명>${rr}</제개정구분명><시행일자>${efYd}</시행일자></law>`
+  const LINEAGE = `<LawSearch><totalCnt>2</totalCnt>${lrow("283457", "20260820", "타법개정")}${lrow("53681", "19970313", "제정")}</LawSearch>`
+  const tr = (mst: string, efYd: string, rr: string, ancYd: string) =>
+    `<tr><td class="ce">1</td><td><a href="/DRF/lawService.do?OC=x&amp;target=lsHistory&amp;MST=${mst}&amp;type=HTML&amp;mobileYn=&amp;efYd=${efYd}" >${LSA}</a></td>` +
+    `<td class="ce">고용노동부</td><td class="ce">${rr}</td><td class="ce">법률</td><td class="ce">제 1호</td><td class="ce">${ancYd}</td><td class="ce">${efYd}</td><td class="ce">연혁</td></tr>`
+  const HISTORY = `<html><strong>3</strong> 건<table>` +
+    tr("4974", "19970313", "폐지", "1997.3.13") + tr("4972", "19900714", "타법개정", "1990.1.13") + tr("4963", "19530809", "제정", "1953.5.10") +
+    `</table></html>`
+  const api = {
+    searchLaw: async () => `<LawSearch><totalCnt>1</totalCnt><law id="1"><법령일련번호>283457</법령일련번호><법령명한글><![CDATA[${LSA}]]></법령명한글><법령ID>001872</법령ID></law></LawSearch>`,
+    fetchApi: async (p: { target: string }) => (p.target === "lsHistory" ? HISTORY : LINEAGE),
+  } as unknown as LawApiClient
+
+  it("신법 제정 이전의 동명 구법 버전까지 싣고, 구법임을 구분해 밝힌다", async () => {
+    const text = (await searchHistoricalLaw(api, { lawName: LSA, display: 100 })).content[0].text
+    expect(text).toContain("MST: 4972")
+    expect(text).toContain("MST: 4963")
+    expect(text).toContain("동명 구법")
+    expect(text.indexOf("MST: 53681")).toBeLessThan(text.indexOf("MST: 4972"))
+  })
+})
```

**File**: `src/tools/historical-law.ts` (modified, +8/-1)
```diff
@@ -50,7 +50,9 @@ export async function searchHistoricalLaw(
     // 연혁 행 파싱을 historical-utils 단일 원본으로 돌린다. 로컬 사본은 무패딩 날짜("1961.12.8")를 못 읽어
     // 공포일이 비고, "폐지제정"을 "폐지"로 오표시했다 (2026-09-23 리뷰 B12, 실측 지방세법 제827호).
     // display는 원시 행 수가 아니라 표시할 버전 수 상한으로 쓴다.
-    const { versions, totalCount, fetchedPages, source, lawId } = await fetchLawVersions(apiClient, args.lawName, args.apiKey);
+    // 기준일 없는 전 연혁이라 가장 이른 날을 기준일로 준다 — 폐지 후 같은 이름으로 재제정된 법령(근로기준법 1997)의
+    // 계보(신법만) 앞 동명 구법 연혁까지 싣는다. 계보 첫 행이 제정일 때만 이름 연혁 1회가 더 든다
+    const { versions, totalCount, fetchedPages, source, lawId } = await fetchLawVersions(apiClient, args.lawName, args.apiKey, undefined, "00000000");
     const displayCap = args.display || 100;
     const histories = versions.slice(0, displayCap);
 
@@ -89,7 +91,12 @@ export async function searchHistoricalLaw(
     output += `본문: execute_tool(tool_name="get_historical_law", params={mst, efYd}) — 아래 MST와 시행일을 함께 넘긴다 (같은 MST가 시행일별로 나뉜 분리시행이 있다)\n\n`;
 
     let prevName = histories[0]?.lawNm || currentName;
+    let inPriorLaw = false;
     for (const h of histories) {
+      if (h.priorLaw && !inPriorLaw) {
+        output += `── 이하 법령ID가 다른 동명 구법 (폐지 후 같은 이름으로 재제정되기 전) ──\n\n`;
+        inPriorLaw = true;
+      }
       if (h.lawNm && !sameLawName(h.lawNm, prevName)) {
         output += `── 이하 법령명: ${h.lawNm} ──\n\n`;
         prevName = h.lawNm;
```

**File**: `src/tools/law-text.correction.test.ts` (modified, +20/-2)
```diff
@@ -28,9 +28,9 @@ const body = (efYd: string, articles: string[] = ["1"]) => JSON.stringify({
 const BASE: Row[] = [{ mst: "300", efYd: "20250101" }, { mst: "200", efYd: "20200101" }, { mst: "100", efYd: "20100101", rr: "제정" }]
 
 type P = { mst?: string, lawId?: string, jo?: string, efYd?: string, efYdMayMiss?: boolean }
-function stub(rows: Row[] = BASE, override?: (p: P) => string | undefined) {
+function stub(rows: Row[] = BASE, override?: (p: P) => string | undefined, history = "") {
   const calls: Array<P & { target?: string }> = []
-  const real = new Set(rows.map(r => `${r.mst}@${r.efYd}`))
+  const real = new Set([...rows.map(r => `${r.mst}@${r.efYd}`), ...[...history.matchAll(/MST=(\d+)&amp;[^"]*efYd=(\d+)/g)].map(m => `${m[1]}@${m[2]}`)])
   const api = {
     getLawText: async (p: P) => {
       calls.push({ ...p })
@@ -47,6 +47,7 @@ function stub(rows: Row[] = BASE, override?: (p: P) => string | undefined) {
     fetchApi: async (p: { target: string, extraParams?: Record<string, string> }) => {
       calls.push({ target: `${p.target}:${p.extraParams?.LID ?? ""}` })
       if (p.target === "eflaw" && p.extraParams?.LID) return lineageXml(rows)
+      if (p.target === "lsHistory") return history
       throw new Error(`unexpected ${p.target}`)
     },
   } as unknown as LawApiClient
@@ -149,3 +150,20 @@ describe("같은 기준일로 여러 조문을 볼 때 법령ID·계보를 다
     expect(lineageCalls(calls)).toBe(1)
   })
 })
+
+// 폐지 후 같은 이름으로 재제정된 법령(근로기준법 1997.3.13.)은 계보(신법)가 기준일보다 늦게 시작한다 — 동명 구법 연혁으로 이어 간다
+describe("기준일이 계보 시작(재제정) 전이면 동명 구법 버전으로", () => {
+  it("lawId + 1995 기준일 → 법령ID가 다른 구법의 그날 시행 버전", async () => {
+    const tr = (mst: string, efYd: string, rr: string) =>
+      `<tr><td class="ce">1</td><td><a href="/DRF/lawService.do?OC=x&amp;target=lsHistory&amp;MST=${mst}&amp;type=HTML&amp;mobileYn=&amp;efYd=${efYd}" >테스트법</a></td>` +
+      `<td class="ce">부처</td><td class="ce">${rr}</td><td class="ce">법률</td><td class="ce">제 1호</td><td class="ce">${efYd.slice(0, 4)}.1.1</td><td class="ce">${efYd}</td><td class="ce">연혁</td></tr>`
+    const history = `<html><strong>2</strong> 건<table>${tr("50", "20000101", "일부개정")}${tr("40", "19900101", "제정")}</table></html>`
+    const { api } = stub(BASE, undefined, history)
+    const r = await getLawText(api, { lawId: "001638", efYd: "20050101", jo: "제1조" })
+    const t = text(r)
+    expect(r.isError).toBeFalsy()
+    expect(t).toContain("시행 2000.01.01")
+    expect(t).toContain("동명 구법")
+    expect(t).toContain("20000101 본문")
+  })
+})
```

**File**: `src/tools/law-text.ts` (modified, +13/-4)
```diff
@@ -10,7 +10,7 @@ import { formatArticleUnit } from "../lib/article-parser.js"
 import { getStrategyWarning } from "../lib/article-warnings.js"
 import { formatToolError } from "../lib/errors.js"
 import { rethrowIfFatal } from "../lib/fatal-errors.js"
-import { fetchLineageVersions, isRepealRow, lawStateAt, todayKst, versionInForce } from "../lib/law-lineage.js"
+import { fetchLawVersions, fetchLineageVersions, isRepealRow, lawStateAt, todayKst, versionInForce } from "../lib/law-lineage.js"
 import type { HistoricalVersion } from "../lib/historical-utils.js"
 import { UpstreamRecordMissingError } from "../lib/upstream-miss.js"
 import { formatDateDot } from "../lib/schemas.js"
@@ -384,8 +384,16 @@ async function retryAtVersionInForce(apiClient: LawApiClient, input: GetLawTextI
   try {
     const lawId = input.lawId || (input.mst ? await lawIdOfMst(apiClient, input.mst, input.apiKey) : undefined)
     if (!lawId) return undefined
-    const versions = await lineageOf(apiClient, String(lawId), input.apiKey)
-    const { version: v, repeal } = lawStateAt(versions, ymd)
+    let versions = await lineageOf(apiClient, String(lawId), input.apiKey)
+    let state = lawStateAt(versions, ymd)
+    // 폐지 후 같은 이름으로 재제정된 법령(근로기준법 1997.3.13.)은 계보가 신법만이라 그 전 기준일이 비었다 — 동명 구법 연혁을 붙인다.
+    // 계보 시작보다 앞선 기준일에서만 드는 비용이다
+    const first = versions[versions.length - 1]
+    if (!state.version && !state.repeal && first && ymd < first.efYd) {
+      versions = (await fetchLawVersions(apiClient, first.lawNm, input.apiKey, String(lawId), ymd)).versions
+      state = lawStateAt(versions, ymd)
+    }
+    const { version: v, repeal } = state
     if (repeal) {
       const last = versions.find(x => x.efYd < repeal.efYd && !isRepealRow(x))
       const lastLine = last ? `\n→ 폐지 직전 버전: 시행 ${formatDateDot(last.efYd)}, MST ${last.mst} — get_law_text(mst="${last.mst}", efYd="${last.efYd}")` : ""
@@ -397,7 +405,8 @@ async function retryAtVersionInForce(apiClient: LawApiClient, input: GetLawTextI
     if (!v) return undefined
     const today = todayKst()
     const status: ResolvedStatus = v.efYd > today ? "scheduled" : versionInForce(versions, today) === v ? "current" : "past"
-    const where = `시행 ${formatDateDot(v.efYd)}, 공포 제${v.ancNo}호${v.rrCls ? ` ${v.rrCls}` : ""}, MST ${v.mst}${v.lawNm ? `, 당시 법령명 「${v.lawNm}」` : ""}`
+    const where = `시행 ${formatDateDot(v.efYd)}, 공포 제${v.ancNo}호${v.rrCls ? ` ${v.rrCls}` : ""}, MST ${v.mst}${v.lawNm ? `, 당시 법령명 「${v.lawNm}」` : ""}` +
+      (v.priorLaw ? ", 법령ID가 다른 동명 구법(폐지 후 같은 이름으로 재제정되기 전)" : "")
     // 입력이 이미 그 버전이면(확인 1회 미스는 순간 장애일 수 있다) 사다리로 한 번 더 받을 뿐 보정 안내는 없다.
     // 시행일은 맞는데 lawId 라서 안 나온 경우(과거본은 MST+시행일로만 닿는다), 다른 공포본의 시행일인 경우, 시행일이 아닌 경우를 가른다
     const note = v.efYd === input.efYd && v.mst === input.mst ? ""
```

---

### Incident Patch 13: `c29f0347` (2026-10-01)
**Commit Message**: fix(history): 폐지 후 같은 이름으로 재제정된 법령의 구법 시절 기준일

- 법령ID 계보(eflaw LID)는 신법만 준다. 근로기준법·노동위원회법은 1997.3.13. 구법 폐지와
  같은 날 같은 이름의 신법(법령ID 001872·000139)이 제정돼, applicable_law(근로기준법,
  1995.5.1.)가 "시행 전입니다. 최초 시행일 1997.03.13"으로 답했다. v4.14.2 는 이름 일치
  lsHistory 로 MST 4972(1990.7.14. 시행)를 냈다(감사 실측)
- fetchLawVersions 에 기준일(asOf)을 받는다. 계보 첫 행이 제정이고 기준일이 그보다 앞일 때만
  lsHistory 를 한 번 더 받아, 계보 시작일 이하·계보에 없는 MST 행을 "법령ID가 다른 동명 구법"
  (priorLaw)으로 뒤에 붙인다. 계보 안의 기준일·기준일 없는 호출은 업스트림 호출 수가 그대로다
  (실측: 도로교통법 applicable_law 6회·민법 search_historical_law 2회 전후 동일)
- applicable_law·time_travel·get_annexes(date) 가 기준일을 넘기고 구법임을 밝힌다. 구법 행은
  공포 단위라 applicable_law 는 이름 기반 폴백처럼 분리시행 보정을 한다
- 구법 → 신법 재제정을 전부개정처럼 조문 체계 변경으로 다룬다(현행 같은 조번호 비교 생략).
  제정 행은 앞에 다른 MST 행이 있을 때만 넣는다 — 분리시행된 제정 공포본의 뒤 시행분
  (개인정보 보호법 MST 111327 2012.3.30.)을 재제정으로 세지 않게(검증 실측)

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/lib/historical-utils.ts` (modified, +2/-0)
```diff
@@ -12,6 +12,8 @@ export interface HistoricalVersion {
   ancYd: string
   lawNm: string
   rrCls: string
+  /** 법령ID가 다른 동명 구법의 행 — 폐지 후 같은 이름으로 재제정되기 전 (lib/law-lineage) */
+  priorLaw?: boolean
 }
 
 export interface HistoricalFetchResult {
```

**File**: `src/lib/law-lineage.test.ts` (modified, +90/-0)
```diff
@@ -1,6 +1,7 @@
 import { describe, it, expect, beforeEach } from "vitest"
 import { fetchLawVersions, fetchLineageVersions, nameTimeline, resolveLawId, versionInForce, wholeRevisionsBetween } from "./law-lineage.js"
 import { lawCache } from "./cache.js"
+import { ExecutionLimitError } from "./execution-limits.js"
 import type { LawApiClient } from "./api-client.js"
 
 // lawSearch.do?target=eflaw&LID=009694&nw=1,2,3 실응답 형식 축약 (2026-09-28).
@@ -96,6 +97,20 @@ describe("계보 해석 도우미", () => {
     expect(wholeRevisionsBetween(versions, "20150407", "20260701").map(v => v.mst)).toEqual(["245535"])
     expect(wholeRevisionsBetween(versions, "20221201", "20260701")).toEqual([])
   })
+
+  it("wholeRevisionsBetween: 제정은 앞에 다른 법령 행이 있을 때(동명 재제정)만 — 분리시행 제정본의 뒤 시행분은 아니다", () => {
+    // 개인정보 보호법 계보 실측: 제정 MST 111327 이 2011.9.30.·2012.3.30. 두 시행분 (검증 실측 — 종전 정규식이 2012.3.30. 행을 재제정으로 셌다)
+    const staggered = [
+      { mst: "111327", efYd: "20120330", ancNo: "10465", ancYd: "20110329", lawNm: "개인정보 보호법", rrCls: "제정" },
+      { mst: "111327", efYd: "20110930", ancNo: "10465", ancYd: "20110329", lawNm: "개인정보 보호법", rrCls: "제정" },
+    ]
+    expect(wholeRevisionsBetween(staggered, "20110930", "20120330")).toEqual([])
+    const reEnacted = [
+      { mst: "53681", efYd: "19970313", ancNo: "5309", ancYd: "19970313", lawNm: "근로기준법", rrCls: "제정" },
+      { mst: "4972", efYd: "19900714", ancNo: "04220", ancYd: "19900113", lawNm: "근로기준법", rrCls: "타법개정", priorLaw: true },
+    ]
+    expect(wholeRevisionsBetween(reEnacted, "19900714", "19970313").map(v => v.mst)).toEqual(["53681"])
+  })
 })
 
 const searchXml = (rows: Array<[string, string, string?]>) =>
@@ -151,3 +166,78 @@ describe("fetchLawVersions — 계보 실패 시 이름 기반 폴백", () => {
     expect(r.versions[0].mst).toBe("10")
   })
 })
+
+// 폐지 후 같은 이름으로 재제정돼 법령ID가 바뀐 법령 — 근로기준법(1997.3.13. 구법 폐지·신법 제정, 신법 법령ID 001872).
+// eflaw LID 계보는 신법(1997~)뿐이라, 기준일이 그 전이면 "시행 전"으로 답했다(감사 실측: 1995.5.1. → 종전 v4.14.2 는 MST 4972).
+const LSA = "근로기준법"
+const LSA_LINEAGE = lineageXml(2, [
+  row("283457", "20260820", LSA, "21373", "20260219", "타법개정", "001872"),
+  row("53681", "19970313", LSA, "05309", "19970313", "제정", "001872"),
+])
+// lsHistory 실응답 행 형식 (2026-10-01 「근로기준법」): 법령명 링크 · 소관부처 · 제개정구분 · 종류 · 공포번호 · 공포일 · 시행일
+const histTr = (mst: string, efYd: string, name: string, rr: string, ancNo: string, ancYd: string) =>
+  `<tr><td class="ce">1</td><td><a href="/DRF/lawService.do?OC=x&amp;target=lsHistory&amp;MST=${mst}&amp;type=HTML&amp;mobileYn=&amp;efYd=${efYd}" >${name}</a></td>` +
+  `<td class="ce">고용노동부</td><td class="ce">${rr}</td><td class="ce">법률</td><td class="ce">제 ${ancNo}호</td><td class="ce">${ancYd}</td><td class="ce">${efYd}</td><td class="ce">연혁</td></tr>`
+const LSA_HISTORY =`<html><strong>7</strong> 건<table>` + [
+  histTr("283457", "20260820", LSA, "타법개정", "21373", "2026.2.19"),
+  histTr("55265", "19971224", LSA, "일부개정", "05473", "1997.12.24"),   // 계보 시작 뒤 — 받지 않는다
+  histTr("53681", "19970313", LSA, "제정", "05309", "1997.3.13"),        // 계보에 있는 MST — 받지 않는다
+  histTr("4974", "19970313", LSA, "폐지", "05305", "1997.3.13"),
+  histTr("4972", "19900714", LSA, "타법개정", "04220", "1990.1.13"),
+  histTr("14383", "19540407", "근로기준법시행령", "제정", "00889", "1954.4.7"),
+  histTr("4963", "19530809", LSA, "제정", "00286", "1953.5.10"),
+].join("") + `</table></html>`
+
+function lsaClient(targets: string[], lineage = LSA_LINEAGE): LawApiClient {
+  return {
+    fetchApi: async (p: { target: string }) => {
+      targets.push(p.target)
+      return p.target === "lsHistory" ? LSA_HISTORY : lineage
+    },
+  } as unknown as LawApiClient
+}
+
+describe("fetchLawVersions — 폐지 후 동명 재제정 (법령ID가 다른 구법)", () => {
+  beforeEach(() => lawCache.clear())
+
+  it("기준일이 계보 시작(제정)보다 앞이면 동명 구법 연혁을 이어 붙인다", async () => {
+    const targets: string[] = []
+    const r = await fetchLawVersions(lsaClient(targets), LSA, undefined, "001872", "19950501")
+    expect(r.versions.map(v => `${v.mst}:${v.efYd}`)).toEqual([
+      "283457:20260820", "53681:19970313", "4974:19970313", "4972:19900714", "4963:19530809",
+    ])
+    expect(r.versions.map(v => Boolean(v.priorLaw))).toEqual([false, false, true, true, true])
+    expect(r.source).toBe("lineage")
+    expect(versionInForce(r.versions, "19950501")?.mst).toBe("4972")
+    // 재제정일 당일은 신법 제정 행이 구법 폐지 행보다 앞 — 폐지로 읽지 않는다
+    expect(versionInForce(r.versions, "19970313")?.mst).toBe("53681")
+    expect(targets.filter(t => t === "lsHistory")).toHaveLength(1)
+  })
+
+  it("기준일이 계보 안이거나 기준일이 없으면 lsHistory 를 부르지 않는다 (일반 법령 호출 수 그대로)", async () => {
+    for (const asOf of ["19970313", "20000101", undefined]) {
+      const targets: string[] = []
+      const r = await fetchLawVersions(lsaClient(targets), LSA, undefined, "001872", asOf)
+      expect(r.versions, String(asOf)).toHaveLength(2)
+      expect(targets, String(asOf)).toEqual(["eflaw"])
+    }
+  })
+
+  it("계보 첫 행이 제정이 아니면(계보가 덜 온 경우 등) 이름으로 덧붙이지 않는다", async () => {
+    const targets: string[] = []
```

**File**: `src/lib/law-lineage.ts` (modified, +46/-3)
```diff
@@ -141,15 +141,45 @@ export interface LawVersionsResult extends HistoricalFetchResult {
   lawId?: string
 }
 
+/**
+ * 폐지 후 같은 이름으로 재제정돼 법령ID가 바뀐 법령의 구법 행을 계보 뒤에 붙인다. 계보(LID)는 신법만 준다: 근로기준법은
+ * 1997.3.13. 구법 폐지와 같은 날 신법(법령ID 001872)이 제정돼, 1995년 기준일을 "시행 전"으로 답했다(감사 실측 —
+ * 이름 일치 lsHistory 를 쓰던 v4.14.2 는 1953년 제정본부터 줬다). 기준일이 계보 시작(제정 행)보다 앞일 때만 lsHistory 를
+ * 한 번 더 받는다 — 계보 안의 기준일은 호출 수가 그대로다. 계보 시작일 이하이면서 계보에 없는 MST 를 구법으로 본다.
+ * 같은 날의 구법 폐지 행은 신법 제정 행 뒤에 놓여, 재제정일 당일이 "폐지"로 읽히지 않는다.
+ */
+async function withPriorSameNameLaw(
+  apiClient: LawApiClient,
+  versions: HistoricalVersion[],
+  asOf: string,
+  apiKey?: string,
+): Promise<HistoricalVersion[]> {
+  const first = versions[versions.length - 1]
+  if (!first || !/제정$/.test(first.rrCls) || asOf >= first.efYd) return versions
+  try {
+    const { versions: named } = await fetchHistoricalVersionsFull(apiClient, first.lawNm, apiKey)
+    const known = new Set(versions.map(v => v.mst))
+    const prior = named
+      .filter(v => v.efYd && v.efYd <= first.efYd && !known.has(v.mst))
+      .map(v => ({ ...v, priorLaw: true }))
+    return prior.length > 0 ? [...versions, ...prior] : versions
+  } catch (error) {
+    rethrowIfFatal(error)
+    return versions
+  }
+}
+
 /**
  * 법령 전 버전. 법령ID 계보를 먼저 쓰고, 법령ID를 못 찾거나 계보가 비면 종전 lsHistory 이름 일치로 물러선다.
  * lawId 를 이미 아는 호출부(applicable_law·체인)는 넘겨서 검색 왕복을 아낀다.
+ * asOf(YYYYMMDD 기준일)를 주면 그날이 계보 시작 전일 때 동명 구법 행까지 싣는다(withPriorSameNameLaw).
  */
 export async function fetchLawVersions(
   apiClient: LawApiClient,
   lawName: string,
   apiKey?: string,
   lawId?: string,
+  asOf?: string,
 ): Promise<LawVersionsResult> {
   let id = lawId
   if (!id) {
@@ -162,7 +192,10 @@ export async function fetchLawVersions(
   if (id) {
     try {
       const r = await fetchLineageVersions(apiClient, id, apiKey)
-      if (r.versions.length > 0) return { ...r, source: "lineage", lawId: id }
+      if (r.versions.length > 0) {
+        const versions = asOf ? await withPriorSameNameLaw(apiClient, r.versions, asOf, apiKey) : r.versions
+        return { ...r, versions, source: "lineage", lawId: id }
+      }
     } catch (error) {
       // 예산 소진·취소는 올리고, 그 밖의 계보 조회 장애는 이름 기반 연혁으로 물러선다
       rethrowIfFatal(error)
@@ -219,7 +252,17 @@ export function sameLawName(a: string, b: string): boolean {
   return nameKey(a) === nameKey(b)
 }
 
-/** (fromYmd, toYmd] 구간의 전부개정 — 조문 번호 체계가 바뀌어 같은 조번호가 다른 조문일 수 있다 */
+/**
+ * (fromYmd, toYmd] 구간의 전부개정 — 조문 번호 체계가 바뀌어 같은 조번호가 다른 조문일 수 있다.
+ * 제정 행은 그보다 앞에 다른 MST 행(동명 구법, withPriorSameNameLaw)이 있을 때만 재제정으로 넣는다 — 분리시행된 제정
+ * 공포본의 뒤 시행분(개인정보 보호법 MST 111327: 2011.9.30.·2012.3.30.)은 같은 법령의 단계 시행일 뿐이다(검증 실측).
+ */
 export function wholeRevisionsBetween(versions: HistoricalVersion[], fromYmd: string, toYmd: string): HistoricalVersion[] {
-  return versions.filter(v => /전부개정|폐지제정/.test(v.rrCls) && v.efYd > fromYmd && v.efYd <= toYmd)
+  const reEnacted = (v: HistoricalVersion) => v.rrCls === "제정" && versions.some(o => o.mst !== v.mst && o.efYd < v.efYd)
+  return versions.filter(v => (/전부개정|폐지제정/.test(v.rrCls) || reEnacted(v)) && v.efYd > fromYmd && v.efYd <= toYmd)
+}
+
+/** wholeRevisionsBetween 행을 부르는 말 — 제정 행은 폐지 후 재제정이다 */
+export function wholeRevisionLabel(v: HistoricalVersion): string {
+  return v.rrCls === "제정" ? "폐지 후 재제정" : "전부개정"
 }
```

**File**: `src/tools/annex-history.test.ts` (modified, +24/-0)
```diff
@@ -73,4 +73,28 @@ describe("get_annexes date — 기준일 시행 버전의 별표", () => {
     expect(r.isError).toBe(true)
     expect(r.content[0].text).toContain("시행 전")
   })
+
+  it("폐지 후 동명 재제정 법령은 계보 시작 전 기준일에 구법 버전의 별표 (종전: '시행 전')", async () => {
+    // 근로기준법 신법(법령ID 001872)은 1997.3.13. 제정부터 — 구법은 이름 일치 lsHistory 에만 있다 (감사 실측 축약)
+    const lsaRow = (mst: string, efYd: string, rr: string) =>
+      `<law id="x"><법령일련번호>${mst}</법령일련번호><법령명한글><![CDATA[근로기준법]]></법령명한글><법령ID>001872</법령ID>` +
+      `<공포일자>${efYd}</공포일자><공포번호>1</공포번호><제개정구분명>${rr}</제개정구분명><시행일자>${efYd}</시행일자></law>`
+    const seen: string[] = []
+    const c = {
+      searchLaw: async () => `<LawSearch><totalCnt>1</totalCnt>${lsaRow("283457", "20260820", "타법개정")}</LawSearch>`,
+      fetchApi: async (p: { target: string, extraParams?: Record<string, string> }) => {
+        const ep = p.extraParams || {}
+        seen.push(`${p.target}:${ep.MST || ep.LID || ""}:${ep.efYd || ""}`)
+        if (ep.LID) return `<LawSearch><totalCnt>2</totalCnt>${lsaRow("283457", "20260820", "타법개정")}${lsaRow("53681", "19970313", "제정")}</LawSearch>`
+        if (p.target === "lsHistory") {
+          return `<html><strong>1</strong> 건<table><tr><td><a href="/x?MST=4972&amp;efYd=19900714" >근로기준법</a></td><td>타법개정</td><td>제 04220호</td><td>1990.1.13</td></tr></table></html>`
+        }
+        return annexJson("1")
+      },
+    } as unknown as LawApiClient
+    const text = (await getAnnexes(c, { lawName: "근로기준법", date: "1995-05-01" })).content[0].text
+    expect(text).toContain("(MST 4972)")
+    expect(text).toContain("법령ID가 다른 동명 구법")
+    expect(seen).toContain("eflaw:4972:19900714")
+  })
 })
```

**File**: `src/tools/annex-history.ts` (modified, +3/-1)
```diff
@@ -38,7 +38,8 @@ export async function getAnnexesAtDate(
   if (!ymd) {
     return notFoundResponse(`기준일 '${input.date}'을(를) 해석하지 못했습니다.`, ["지원 형식: 2015-06-01 / 2015.6.1 / 20150601 / 2015년 6월 1일"])
   }
-  const { versions } = await fetchLawVersions(apiClient, lawName, input.apiKey)
+  // 기준일이 계보 시작 전이면 폐지 후 재제정되기 전의 동명 구법(법령ID가 다르다)까지 받는다
+  const { versions } = await fetchLawVersions(apiClient, lawName, input.apiKey, undefined, ymd)
   if (versions.length === 0) {
     return notFoundResponse(`'${lawName}'의 연혁을 찾지 못했습니다. 기준일(date) 별표 조회는 법령(법률·대통령령·부령)만 지원합니다.`, [
       "search_law로 정식 법령명을 확인하세요.",
@@ -62,6 +63,7 @@ export async function getAnnexesAtDate(
   const thenName = v.lawNm || lawName
   let header = `📅 기준일 ${formatDateDot(ymd)} 당시 시행 버전의 별표입니다.\n`
   header += `  「${thenName}」 [시행 ${formatDateDot(v.efYd)}] [제${v.ancNo}호, ${formatDateDot(v.ancYd)} ${v.rrCls}] (MST ${v.mst})\n`
+  if (v.priorLaw) header += "  ↳ 법령ID가 다른 동명 구법(폐지 후 같은 이름으로 재제정되기 전)의 버전입니다.\n"
   if (current && current.mst === v.mst && current.efYd === v.efYd) {
     header += "  ↳ 이 버전이 현행입니다.\n"
   } else if (current) {
```

**File**: `src/tools/applicable-law.ts` (modified, +11/-6)
```diff
@@ -21,7 +21,7 @@ import { truncateResponse, formatDateDot } from "../lib/schemas.js"
 import { formatToolError, notFoundResponse } from "../lib/errors.js"
 import { findLaws } from "../lib/law-search.js"
 import { fetchEffectiveSlices, type HistoricalVersion } from "../lib/historical-utils.js"
-import { fetchLawVersions, lawStateAt, resolveLawId, sameLawName, todayKst, wholeRevisionsBetween } from "../lib/law-lineage.js"
+import { fetchLawVersions, lawStateAt, resolveLawId, sameLawName, todayKst, wholeRevisionLabel, wholeRevisionsBetween } from "../lib/law-lineage.js"
 import { applicableAdminRule } from "./applicable-admin-rule.js"
 import { buildJO } from "../lib/law-parser.js"
 import { cleanHtml } from "../lib/article-parser.js"
@@ -186,7 +186,8 @@ export async function applicableLaw(
     }
 
     // 2. 연혁 → 기준일 시행 버전 특정 (versions는 시행일 내림차순). 법령ID 계보라 제명이 바뀌기 전 버전도 잡힌다.
-    const { versions, source } = await fetchLawVersions(apiClient, resolved.matchedName, input.apiKey, resolved.lawId)
+    // 기준일을 넘겨 계보 시작 전이면 폐지 후 재제정되기 전의 동명 구법(법령ID가 다르다)까지 받는다.
+    const { versions, source } = await fetchLawVersions(apiClient, resolved.matchedName, input.apiKey, resolved.lawId, date)
     const today = todayKst()
     // 폐지 행은 "시행 중 버전"이 아니다 — 폐지된 법령이면 현행이 없다(repealedNow)
     const { version: current, repeal: repealedNow } = lawStateAt(versions, today)
@@ -222,9 +223,10 @@ export async function applicableLaw(
     // 분리시행: 한 공포본의 조항별 시행일(단계 시행). 계보(eflaw)는 슬라이스마다 한 행이라 이미 반영돼 있다.
     // 이름 기반 폴백(lsHistory)은 공포단위 1행이라 안 보인다 — 예: 소득세법 법률 제9897호는 시행일 4개인데
     // lsHistory엔 2010.1.1. 한 행뿐. 그때만 eflaw 슬라이스 검색으로 (적용버전 시행일, 기준일] 구간을 보정한다.
+    // 동명 구법 행(priorLaw)도 lsHistory 에서 온 공포 단위 행이라 같이 보정한다.
     let effective: HistoricalVersion = applicable
     let staggered = source === "lineage" && versions.some(v => v.mst === applicable.mst && v.efYd !== applicable.efYd && v.efYd < applicable.efYd)
-    if (source === "name") {
+    if (source === "name" || applicable.priorLaw) {
       try {
         const slices = await fetchEffectiveSlices(apiClient, lawName, applicable.efYd, date, input.apiKey)
         const later = slices.find(s => s.efYd > applicable.efYd && s.efYd <= date)
@@ -251,7 +253,10 @@ export async function applicableLaw(
       .filter(Boolean).join(", ")
     const thenName = effective.lawNm || lawName
     lines.push(`  ${thenName} [시행 ${fmtYmd(effective.efYd)}] [${promulgation}] (MST ${effective.mst})`)
-    if (!sameLawName(thenName, lawName)) {
+    if (applicable.priorLaw) {
+      const reEnacted = versions.filter(v => !v.priorLaw).pop()   // 계보 첫 행 = 신법 제정
+      lines.push(`  ↳ 법령ID가 다른 동명 구법입니다 — 현행 「${lawName}」(법령ID ${resolved.lawId})은 ${fmtYmd(reEnacted?.efYd || "")} 같은 이름으로 새로 제정된 별개 법령이라, 구법 연혁은 법령명 일치 연혁에서 찾았습니다.`)
+    } else if (!sameLawName(thenName, lawName)) {
       lines.push(`  ↳ 당시 법령명은 「${thenName}」 — 현행 「${lawName}」과 같은 법령(법령ID ${resolved.lawId})입니다. 기준일 사건의 근거로 인용할 때는 당시 법령명을 씁니다.`)
     }
     if (staggered) {
@@ -266,7 +271,7 @@ export async function applicableLaw(
       lines.push(`  ↳ 기준일 이후 현재까지 ${laterVersions.length}차례 개정·시행됨 (현행: 시행 ${fmtYmd(current?.efYd || "")})`)
       if (wholeSince.length > 0) {
         const w = wholeSince[wholeSince.length - 1]
-        lines.push(`  ⚠️ 그 사이 전부개정(시행 ${fmtYmd(w.efYd)}, 제${w.ancNo}호)으로 조문 체계가 바뀌었습니다 — 같은 조번호라도 현행에선 다른 조문일 수 있습니다. 현행 대응 조문은 조문 제목으로 찾으세요.`)
+        lines.push(`  ⚠️ 그 사이 ${wholeRevisionLabel(w)}(시행 ${fmtYmd(w.efYd)}, 제${w.ancNo}호)으로 조문 체계가 바뀌었습니다 — 같은 조번호라도 현행에선 다른 조문일 수 있습니다. 현행 대응 조문은 조문 제목으로 찾으세요.`)
       }
     } else if (partialHistory) {
       lines.push(`  ↳ 이름이 같은 연혁상 마지막 버전입니다 (현행 여부 미확인)`)
@@ -322,7 +327,7 @@ export async function applicableLaw(
         lines.push("")
         const norm = (s: string) => s.replace(/\s+/g, "")
         if (wholeSince.length > 0) {
-          lines.push(`▶ 현행 같은 조번호(${joDisplay})와 비교 생략 — 전부개정으로 조문 체계가 바뀌어 번호만 같은 다른 조문일 수 있습니다. 현행 대응 조문은 제목으로 찾아 get_law_text로 확인하세요.`)
+          lines.push(`▶ 현행 같은 조번호(${joDisplay})와 비교 생략 — ${wholeRevisionLabel(wholeSince[wholeSince.length - 1])}으로 조문 체계가 바뀌어 번호만 같은 다른 조문일 수 있습니다. 현행 대응 조문은 제목으로 찾아 get_law_text로 확인하세요.`)
         } else if (thenText && nowText) {
           if (norm(thenText) === norm(nowText)) {
             lines.push(`▶ 현행과 비교: ✅ 동일 (기준일 이후 이 조문은 개정되지 않음)`)
```

**File**: `src/tools/history-review.test.ts` (modified, +46/-0)
```diff
@@ -53,6 +53,52 @@ describe("폐지 행은 시행 중 버전이 아니다 (종전: 소방법 타법
   })
 })
 
+describe("폐지 후 동명 재제정 법령의 구법 시절 기준일 (종전 v4.15.0: '시행 전입니다. 최초 시행일 1997.03.13')", () => {
+  // 근로기준법: 1997.3.13. 구법(법률 제5305호로 폐지) → 같은 날 같은 이름 신법 제정(법령ID 001872). 감사 실측 축약
+  const LSA = "근로기준법"
+  const lineage = xml([lawRow("283457", "20260820", LSA, "001872", "타법개정", "현행"), lawRow("53681", "19970313", LSA, "001872", "제정")])
+  const tr = (mst: string, efYd: string, rr: string, no: string) =>
+    `<tr><td><a href="/DRF/lawService.do?target=lsHistory&amp;MST=${mst}&amp;efYd=${efYd}" >${LSA}</a></td><td>${rr}</td><td>제 ${no}호</td><td>${efYd.slice(0, 4)}.1.1</td></tr>`
+  const history = `<html><strong>4</strong> 건<table>${tr("53681", "19970313", "제정", "05309")}${tr("4974", "19970313", "폐지", "05305")}` +
+    `${tr("4972", "19900714", "타법개정", "04220")}${tr("4963", "19530809", "제정", "00286")}</table></html>`
+  const article = (body: string) => JSON.stringify({ 법령: { 조문: { 조문단위: [{ 조문여부: "조문", 조문번호: "1", 조문내용: body }] } } })
+  const calls: string[] = []
+  const client = {
+    searchLaw: async (_q: string, _k?: string, _d?: number, target?: string) =>
+      target === "eflaw" ? xml([]) : xml([lawRow("283457", "20260820", LSA, "001872", "타법개정", "현행")]),
+    fetchApi: async (p: { target: string, extraParams?: Record<string, string> }) => {
+      calls.push(p.extraParams?.LID ? "lineage" : p.target)
+      if (p.extraParams?.LID) return lineage
+      if (p.target === "lsHistory") return history
+      if (p.target === "eflaw") return xml([])   // 분리시행 보정 검색 (구법은 공포 단위 행이라 v4.14.2 처럼 보정한다)
+      return `{"법령":{"부칙":{"부칙단위":[]}}}`
+    },
+    getLawText: async (p: { mst: string }) => {
+      calls.push(`text:${p.mst}`)
+      return article(p.mst === "4972" ? "제1조(목적) 구법 목적" : "제1조(목적) 신법 목적")
+    },
+  } as unknown as LawApiClient
+
+  it("applicable_law: 계보 시작 전 기준일은 동명 구법 버전, 현행 같은 조번호 비교는 생략", async () => {
+    calls.length = 0
+    const text = (await applicableLaw(client, { lawName: LSA, date: "1995-05-01", jo: "제1조" })).content[0].text
+    expect(text).toContain("근로기준법 [시행 1990.07.14]")
+    expect(text).toContain("(MST 4972)")
+    expect(text).toContain("법령ID가 다른 동명 구법")
+    expect(text).toContain("구법 목적")
+    expect(text).toContain("폐지 후 재제정")
+    expect(text).not.toContain("시행 전입니다")
+    expect(calls).not.toContain("text:283457")   // 다른 법령의 같은 조번호를 받아 "변경됨"으로 비교하지 않는다
+  })
+
+  it("applicable_law: 계보 안의 기준일은 lsHistory 를 부르지 않는다", async () => {
+    calls.length = 0
+    const text = (await applicableLaw(client, { lawName: LSA, date: "2000-01-01" })).content[0].text
+    expect(text).toContain("(MST 53681)")
+    expect(calls).not.toContain("lsHistory")
+  })
+})
+
 describe("계보 조회 실패 + 옛 이름 입력은 '현행'을 단정하지 않는다", () => {
   it("이름 기반 폴백이면 경고하고 마지막 버전을 현행이라 하지 않는다", async () => {
     const OLD = "화재예방, 소방시설 설치ㆍ유지 및 안전관리에 관한 법률"
```

**File**: `src/tools/scenarios/time-travel.test.ts` (modified, +33/-1)
```diff
@@ -1,5 +1,6 @@
 import { describe, it, expect } from "vitest"
-import { pickVersion } from "./time-travel.js"
+import { pickVersion, runTimeTravelScenario } from "./time-travel.js"
+import type { LawApiClient } from "../../lib/api-client.js"
 
 const v = (mst: string, efYd: string) => ({ mst, efYd, lawNm: "테스트법", ancNo: "1", ancYd: "", rrCls: "일부개정" })
 
@@ -20,3 +21,34 @@ describe("pickVersion — 시행일 빈 값 NaN 오염", () => {
     expect(pickVersion([v("C", "20230101")], "20200101")).toBeUndefined()
   })
 })
+
+describe("time_travel — 폐지 후 동명 재제정 (종전: 계보 시작 1997.3.13. 전 시점은 '시점 매칭 실패')", () => {
+  // 근로기준법 신법 법령ID 001872 는 1997.3.13. 제정부터다. 구법(법령ID 다름)은 이름 일치 lsHistory 에만 있다 (감사 실측 축약)
+  const lawRow = (mst: string, efYd: string, rr: string) =>
+    `<law id="x"><법령일련번호>${mst}</법령일련번호><법령명한글><![CDATA[근로기준법]]></법령명한글><법령ID>001872</법령ID>` +
+    `<공포일자>${efYd}</공포일자><공포번호>1</공포번호><제개정구분명>${rr}</제개정구분명><시행일자>${efYd}</시행일자></law>`
+  const tr = (mst: string, efYd: string, rr: string) =>
+    `<tr><td><a href="/x?MST=${mst}&amp;efYd=${efYd}" >근로기준법</a></td><td>${rr}</td><td>제 1호</td><td>1990.1.13</td></tr>`
+  const body = (text: string) => JSON.stringify({ 법령: { 조문: { 조문단위: [{ 조문여부: "조문", 조문번호: "1", 조문제목: "목적", 조문내용: text }] } } })
+  const apiClient = {
+    fetchApi: async (p: { target: string, extraParams?: Record<string, string> }) => {
+      const ep = p.extraParams || {}
+      if (ep.LID) return `<LawSearch><totalCnt>2</totalCnt>${lawRow("283457", "20260820", "타법개정")}${lawRow("53681", "19970313", "제정")}</LawSearch>`
+      if (p.target === "lsHistory") return `<html><strong>2</strong> 건<table>${tr("4974", "19970313", "폐지")}${tr("4972", "19900714", "타법개정")}</table></html>`
+      return body(ep.MST === "4972" ? "제1조(목적) 구법" : "제1조(목적) 신법")
+    },
+  } as unknown as LawApiClient
+
+  it("이른 시점은 동명 구법 버전, 사이의 재제정을 조문 체계 변경으로 알린다", async () => {
+    const result = await runTimeTravelScenario({
+      apiClient,
+      query: "근로기준법",
+      law: { lawName: "근로기준법", lawId: "001872", mst: "283457", lawType: "법률" },
+      extras: { fromDate: "19950501", toDate: "20000101" },
+    })
+    const text = result.sections.map(s => s.content).join("\n")
+    expect(text).toContain("시점 A: 1990.07.14 시행 | MST 4972")
+    expect(text).toContain("두 시점 사이 폐지 후 재제정(시행 1997.03.13")
+    expect(text).not.toContain("시점 매칭 실패")
+  })
+})
```

---

### Incident Patch 14: `0656a369` (2026-10-01)
**Commit Message**: fix(history): 0 채움 없는 법령ID 로 계보를 부르면 비던 문제

- 업스트림은 LID=1638 에도 법령ID 001638 행을 주는데, 계보 필터가 문자열을 그대로 비교해
  전부 버렸다. get_law_text(lawId="1638", efYd=시행일 아닌 날)의 기준일 보정이 NOT_FOUND 로
  끝났다(감사 실측). 앞의 0을 떼고 비교한다. 실측: 같은 호출이 시행 2026.7.1. 버전 본문으로

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/lib/law-lineage.test.ts` (modified, +5/-0)
```diff
@@ -52,6 +52,11 @@ describe("fetchLineageVersions — 법령ID 계보", () => {
     expect(calls).toBe(1)
   })
 
+  it("0 채움 없는 법령ID도 같은 계보로 본다 — 업스트림은 LID=1638 에도 001638 행을 준다 (감사 실측)", async () => {
+    const client = { fetchApi: async () => lineageXml(5, ROWS) } as unknown as LawApiClient
+    expect((await fetchLineageVersions(client, "9694")).versions).toHaveLength(5)
+  })
+
   it("총계가 한 페이지를 넘으면 나머지 페이지를 받는다", async () => {
     const pages: string[] = []
     const client = {
```

**File**: `src/lib/law-lineage.ts` (modified, +6/-2)
```diff
@@ -108,10 +108,14 @@ function fetchLineagePage(apiClient: LawApiClient, lawId: string, page: number,
 export async function fetchLineageVersions(apiClient: LawApiClient, lawId: string, apiKey?: string): Promise<HistoricalFetchResult> {
   const first = await fetchLineagePage(apiClient, lawId, 1, apiKey)
   const firstRows = parseEffectiveRows(first)
+  // 법령ID 는 0 채움 6자리로 오지만 호출부는 "1638"처럼 줄 수 있다 — 업스트림은 LID=1638 에도 001638 행을 준다(감사 실측).
+  // 문자열 그대로 비교하면 행을 전부 버려 계보가 비었다. 앞의 0을 떼고 비교한다
+  const wanted = lawId.replace(/^0+/, "")
+  const sameId = (id: string) => id.replace(/^0+/, "") === wanted
   // LID 가 무시되면 전 법령 목록(실측 ID= 는 무시돼 16만 행)이 온다. 첫 페이지에 그 법령ID가 없거나 총계가 상한을 넘으면
   // (실측 최대 367행) 필터가 안 걸린 것으로 보고 더 받지 않는다 — 조용히 1,000행에서 자른 목록을 계보로 쓰지 않는다.
   const totalCount = parseInt(extractTag(first, "totalCnt") || "0", 10) || 0
-  if (!firstRows.some(r => r.lawId === lawId) || totalCount > LINEAGE_MAX_PAGES * LINEAGE_PAGE_SIZE) {
+  if (!firstRows.some(r => sameId(r.lawId)) || totalCount > LINEAGE_MAX_PAGES * LINEAGE_PAGE_SIZE) {
     return { versions: [], totalCount: 0, fetchedPages: 1 }
   }
 
@@ -123,7 +127,7 @@ export async function fetchLineageVersions(apiClient: LawApiClient, lawId: strin
   const versions: HistoricalVersion[] = []
   for (const r of [firstRows, ...rest.map(parseEffectiveRows)].flat()) {
     const key = `${r.mst}:${r.efYd}`
-    if (r.lawId !== lawId || seen.has(key)) continue
+    if (!sameId(r.lawId) || seen.has(key)) continue
     seen.add(key)
     versions.push({ mst: r.mst, efYd: r.efYd, ancNo: r.ancNo, ancYd: r.ancYd, lawNm: r.lawNm, rrCls: r.rrCls })
   }
```

---

### Incident Patch 15: `fc7e2dec` (2026-10-01)
**Commit Message**: fix(history): get_historical_law 가 시행일이 아닌 efYd 에 실패하던 회귀

- 그 MST 의 시행일이 아닌 efYd 를 주면 eflaw 가 HTML 안내로 답해, 재시도 4회(3.7초) 뒤
  "[EXTERNAL_API_ERROR] 파라미터를 확인해주세요"로 끝났다(감사 실측 MST 212383 + 20200101).
  v4.14.2 는 efYd 를 무시하고 그 MST 본문을 줬다
- 사용자 efYd 미스 장치(getLawText efYdMayMiss)로 확인 1회에 끊고, 미스이거나 법령 노드 없는
  봉투면 time_travel 처럼 target=law&MST 로 물러서며 그 사실을 한 줄로 밝힌다. 예산 소진 등
  다른 오류는 그대로 올린다. 실측: 업스트림 4회·2.6초 오류 → 3회·0.6초 본문

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `src/tools/historical-law.test.ts` (modified, +49/-0)
```diff
@@ -1,5 +1,7 @@
 import { describe, it, expect } from "vitest"
 import { getHistoricalLaw, searchHistoricalLaw } from "./historical-law.js"
+import { UpstreamRecordMissingError } from "../lib/upstream-miss.js"
+import { ExecutionLimitError } from "../lib/execution-limits.js"
 import type { LawApiClient } from "../lib/api-client.js"
 
 // 실제 lawService(target=law) JSON 축약 — 법령명은 "법령명_한글" 키, 소관부처는 {content} 객체,
@@ -78,6 +80,53 @@ describe("getHistoricalLaw — 조문단위 래퍼를 풀어 읽는다 (#153)",
   })
 })
 
+// 감사 실측(MST 212383 + efYd=20200101): 그 MST 의 시행일이 아닌 efYd 면 eflaw 가 HTML 안내로 답한다.
+// 종전엔 4회 재시도(3.7초) 뒤 "[EXTERNAL_API_ERROR] 파라미터를 확인해주세요" — v4.14.2 는 efYd 를 무시하고 MST 본문을 줬다.
+describe("getHistoricalLaw — 시행일이 아닌 efYd", () => {
+  const missClient = (calls: string[], eflaw: () => Promise<string>) => ({
+    getLawText: async (p: { mst?: string, efYd?: string, efYdMayMiss?: boolean }) => {
+      calls.push(`eflaw:${p.mst}:${p.efYd}:${p.efYdMayMiss}`)
+      return eflaw()
+    },
+    fetchApi: async (p: { target: string, extraParams?: Record<string, string> }) => {
+      calls.push(`${p.target}:${p.extraParams?.MST}:${p.extraParams?.efYd ?? ""}`)
+      return HIST_JSON
+    },
+  }) as unknown as LawApiClient
+
+  it("eflaw 미스는 확인 1회 장치로 끊고 target=law&MST 본문으로 물러서며 한 줄로 밝힌다", async () => {
+    const calls: string[] = []
+    const r = await getHistoricalLaw(missClient(calls, async () => { throw new UpstreamRecordMissingError("url", "html") }), { mst: "212383", efYd: "20200101" })
+    const t = r.content[0].text
+    expect(r.isError).toBeFalsy()
+    expect(t).toContain("법령명: 상법")
+    expect(t).toContain("efYd=20200101 기준 조회가 비어(MST 212383의 시행일이 아니면")
+    expect(calls).toEqual(["eflaw:212383:20200101:true", "law:212383:"])
+  })
+
+  it("eflaw 가 법령 노드 없는 봉투로 와도 물러선다", async () => {
+    const calls: string[] = []
+    const t = (await getHistoricalLaw(missClient(calls, async () => "{}"), { mst: "212383", efYd: "2020-01-01" })).content[0].text
+    expect(t).toContain("법령명: 상법")
+    expect(calls).toEqual(["eflaw:212383:20200101:true", "law:212383:"])
+  })
+
+  it("시행일이 맞으면 그 슬라이스 본문 그대로 (안내 없음)", async () => {
+    const calls: string[] = []
+    const t = (await getHistoricalLaw(missClient(calls, async () => HIST_JSON), { mst: "273629", efYd: "20260910" })).content[0].text
+    expect(t).toContain("법령명: 상법")
+    expect(t).not.toContain("기준 조회가 비어")
+    expect(calls).toEqual(["eflaw:273629:20260910:true"])
+  })
+
+  it("예산 소진은 물러서지 않는다", async () => {
+    const calls: string[] = []
+    const r = await getHistoricalLaw(missClient(calls, async () => { throw new ExecutionLimitError("budget") }), { mst: "212383", efYd: "20200101" })
+    expect(r.isError).toBe(true)
+    expect(calls).toEqual(["eflaw:212383:20200101:true"])
+  })
+})
+
 // 2026-09-23 리뷰 B12: search_historical_law가 historical-utils의 고친 파서를 쓰지 않고 옛 사본을 들고 있었다.
 // 실측 lsHistory(query=지방세법, sort=efasc) 행 원문(OC만 치환). 날짜가 0패딩 없이 온다.
 const LSHISTORY_ROWS = [
```

**File**: `src/tools/historical-law.ts` (modified, +23/-4)
```diff
@@ -1,5 +1,6 @@
 import { z } from "zod";
-import type { LawApiClient } from "../lib/api-client.js";
+import { hasLawNode, type LawApiClient } from "../lib/api-client.js";
+import { UpstreamRecordMissingError } from "../lib/upstream-miss.js";
 import { truncateResponse, formatDateDot } from "../lib/schemas.js";
 import { formatToolError } from "../lib/errors.js";
 import { flattenContent, formatArticleUnit } from "../lib/article-parser.js";
@@ -131,12 +132,27 @@ export async function getHistoricalLaw(
 ): Promise<{ content: Array<{ type: string, text: string }>, isError?: boolean }> {
   try {
     // target=law&MST 는 공포본 단위라 분리시행이면 마지막 시행 슬라이스를 준다. 시행일이 오면 eflaw 로 그 슬라이스를 집는다.
+    // 그 MST 의 시행일이 아닌 efYd 면 eflaw 는 HTML 안내로 답한다(감사 실측 MST 212383 + 20200101: 4회 재시도 3.7초 뒤
+    // EXTERNAL_API_ERROR). 사용자 efYd 미스 장치(efYdMayMiss)로 확인 1회에 끊고, time_travel 처럼 target=law&MST 로 물러선다.
     const efYd = args.efYd ? normalizeDate(args.efYd) || args.efYd : undefined
-    const responseText = await apiClient.fetchApi({
+    let responseText: string | undefined;
+    let efYdMissed = false;
+    if (efYd) {
+      try {
+        responseText = await apiClient.getLawText({ mst: args.mst, efYd, efYdMayMiss: true, apiKey: args.apiKey });
+      } catch (error) {
+        if (!(error instanceof UpstreamRecordMissingError)) throw error;
+      }
+      if (!responseText || !hasLawNode(responseText)) {
+        responseText = undefined;
+        efYdMissed = true;
+      }
+    }
+    responseText ??= await apiClient.fetchApi({
       endpoint: "lawService.do",
-      target: efYd ? "eflaw" : "law",
+      target: "law",
       type: "JSON",
-      extraParams: efYd ? { MST: args.mst, efYd } : { MST: args.mst },
+      extraParams: { MST: args.mst },
       apiKey: args.apiKey,
     });
 
@@ -158,6 +174,9 @@ export async function getHistoricalLaw(
     // 소관부처는 {content: "..."} 객체로 온다 — 그대로 보간하면 "[object Object]"가 노출됐다.
     const lawTitle = safeText(basic.법령명_한글 || basic.법령명한글 || basic.법령명) || "연혁법령";
     let output = `=== ${lawTitle} ===\n\n`;
+    if (efYdMissed) {
+      output += `ℹ️ efYd=${args.efYd} 기준 조회가 비어(MST ${args.mst}의 시행일이 아니면 이렇게 온다) 시행일 없이 그 공포본 본문을 조회했습니다 — 분리시행 공포본이면 마지막 시행분입니다(실제 시행일은 아래 기본 정보).\n\n`;
+    }
 
     output += `기본 정보:\n`;
     output += `  법령명: ${lawTitle}\n`;
```

#### Recent Merged Pull Requests:
- **PR #166** (2026-10-01): test: 출력 마스킹 검증 키 생성 방식 보정 (@chrisryugj)
- **PR #165** (2026-10-01): fix: 조회·분석 경계 보정 (4.15.5) (@chrisryugj)
- **PR #164** (2026-10-01): fix: 조회 결과와 입력 처리 보정 (4.15.4) (@chrisryugj)
- **PR #163** (2026-10-01): fix: 조회 정확성과 실행 한도 보정 (4.15.3) (@chrisryugj)
- **PR #162** (2026-09-22): feat(admin-rule): get_admin_rule 부분 조회(jo·chapter·keyword·page) + 신구대조 제·개정이유 폴백 (@cpasongc)
- **PR #155** (2026-09-05): fix(knowledge-base): 존재하지 않는 법제처 target 3건으로 연계 도구 4개가 조용히 0건 (@yoonkhsc)
- **PR #154** (2026-08-29): fix(api-client): eflaw HTML 에러 페이지도 target=law 폴백에 도달하도록 (#153) (@Rillmo)
- **PR #152** (2026-08-19): fix: 분리시행 슬라이스 dedup 소실 + eflaw MST 단독 조회 빈 봉투 폴백 (@herrozim-ship-it)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

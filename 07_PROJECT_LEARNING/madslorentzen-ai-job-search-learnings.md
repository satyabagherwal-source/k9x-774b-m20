# Forensic Learning Record (Deep Inspection): MadsLorentzen/ai-job-search

> **Canonical Artifact**: `07_PROJECT_LEARNING/madslorentzen-ai-job-search-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/MadsLorentzen/ai-job-search](https://github.com/MadsLorentzen/ai-job-search))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:02:51.576Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `MadsLorentzen/ai-job-search`
- **Description**: The job search that runs on your machine. AI job application framework built on Claude Code: evaluate postings, tailor CVs, write cover letters, prep interviews. Fork it and own it.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 44564 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `.agents/skills/freehire-search/cli/src/cli.ts`
```
#!/usr/bin/env bun
// Self-contained CLI for searching the freehire.me aggregator's public JSON API.
// No external CLI framework and zero runtime dependencies, so it runs anywhere
// `bun` is available with nothing installed beyond the repo clone.
//
// Hosted-service dependency: reads are public (no API key), but they hit
// freehire.me — a personal project maintained best-effort (no formal SLA). Point
// FREEHIRE_API_URL at a self-hosted freehire backend to swap the source.

import { runSearch, DESCRIPTION_FORMATS, type DescriptionFormat, type SearchOpts } from "./commands/search.js"
import { runDetail, type DetailOpts } from "./commands/detail.js"
import { baseUrl } from "./helpers.js"

interface Flags {
  _: string[]
  [k: string]: string | boolean | string[]
}

// Short-flag aliases.
const ALIAS: Record<string, string> = { q: "query", n: "limit" }

function parseFlags(argv: string[]): Flags {
  const flags: Flags = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (!a.startsWith("-")) {
      ;(flags._ as string[]).push(a)
      continue
    }
    const name = a.replace(/^-+/, "")
    const key = ALIAS[name] ?? name
    const next = argv[i + 1]
    // A flag with no following value (or another flag next) is a boolean.
    let value: string | boolean = true
    if (next !== undefined && !next.startsWith("-")) {
      value = next
      i++
    }
    // --facet repeats; collect into an array. Everything else is last-wins.
    if (key === "facet") {
      const acc = Array.isArray(flags.facet) ? flags.facet : []
      if (typeof value === "string") acc.push(value)
      flags.facet = acc
    } else {
      flags[key] = value
    }
  }
  return flags
}

type FlagValue = string | boolean | string[] | undefined

/**
 * A flag's string value. A bare flag (set without a value, i.e. `true`) yields
 * `whenBare` — e.g. `--remote` alone means work_mode "remote".
 */
function stringFlag(raw: FlagValue, whenBare?: string): string | undefined {
  if (typeof raw === "string") return raw
  if (raw === true) return whenBare
  return undefined
}

/** Split a comma-separated facet value ("eu,us") into a trimmed value list. */
function commaList(raw: FlagValue): string[] {
  if (typeof raw !== "string") return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

const HELP = `freehire-cli — search the freehire.me job aggregator (many markets, tech-focused)

USAGE
  bun run src/cli.ts search [-q "<keywords>"] [facet flags] [--format json|table|plain]
  bun run src/cli.ts detail <slug|url> [--format json|plain]

SEARCH FLAGS
  --query, -q <text>      Keywords (title, skill, role). Full-text; optional.
  --jobage <days>         Posted within N days (maps to posted_within_days).
  --page <n>              1-indexed page. Default 1.
  --limit, -n <n>         Results per page (API limit). Default 25.
  --format <fmt>          json (default) | table | plain.
  --no-description        Skip description hydration for a cheap discovery pass
                          (results keep every other field; detail fetches the body).
  --description-format    markdown (default) | text | html — how each result's
                          full description is rendered (json output only).

FACET FILTERS (values from freehire.me's controlled vocabularies; comma = OR)
  --region <codes>        Macro-region: global, eu, us, apac, latam, cis, ...  e.g. --region eu,us
  --country <codes>       ISO-3166 alpha-2, e.g. --country DE,GB
  --city <names>          City name(s), e.g. --city Berlin
  --seniority <levels>    junior, middle, senior, staff, principal, lead, ...
  --category <cats>       backend, frontend, fullstack, devops, ml_ai, qa, ...
  --skill <names>         Canonical skill(s), e.g. --skill go,kubernetes
  --company <slug>        Company slug (from a result's company_slug).
  --remote <mode>         remote | hybrid | onsite (work_mode facet).
  --facet <key=value>     Any other facet param (repeatable), e.g. --facet salary_min=100000

DETAIL
  <slug|url>              A freehire public slug (from a search result's id/slug)
                          or a full https://freehire.me/jobs/<slug> URL.

EXAMPLES
  bun run src/cli.ts search -q "backend engineer" --seniority senior --limit 10 --format table
  bun run src/cli.ts search -q "react" --remote remote --region eu --format table
  bun run src/cli.ts search --category devops --country DE --jobage 14 --format table
  bun run src/cli.ts detail golang-zensar-2bxu6dxm --format plain

Reads are public (no API key). Source: ${baseUrl()} — a personal project,
best-effort, no SLA. Override with FREEHIRE_API_URL to use a self-hosted backend.
`

function parseIntFlag(name: string, raw: string | boolean | string[]): number | null {
  // Number(), not parseInt(): parseInt truncates, so "--jobage 0.5" became 0,
  // which fails search.ts's `jobage > 0` guard and silently drops
  // posted_within_days from the outbound request while exiting 0 (#373).
  // Whole numbers >= 1 only — the Danish CLIs' z.coerce.number().int().min(1)
  // contract; 0 is rejected rather than kept as a "no filter" alias.
  const val = typeof raw === "string" ? Number(raw.trim()) : NaN
  if (!Number.isInteger(val) || val < 1) {
    process.stderr.write(
      JSON.stringify({ error: `--${name} must be a whole number of at least 1, got "${raw}"`, code: "BAD_ARG" }) + "\n",
    )
    return null
  }
  return val
}

// Long-form flag names each command accepts (parseFlags resolves the short
// aliases q/n to these before validation). "help"/"h" pass so `search --help`
// still prints usage.
const KNOWN_FLAGS: Record<string, Set<string>> = {
  search: new Set([
    "query", "category", "city", "company", "country", "facet", "format", "jobage", "limit",
    "page", "region", "remote", "seniority", "skill", "description-format", "no-description", "help", "h",
  ]),
  detail: new Set(["format", "description-format", "help", "h"]),
}

async function main(): Promise<number> {
  const argv = process.argv.slice(2)
  const flags = parseFlags(argv)
  const cmd = (flags._ as string[])[0]

  if (!cmd || flags.help || flags.h) {
    process.stdout.write(HELP)
    return cmd ? 0 : 1
  }

  // Reject unknown flags instead of silently discarding them: a discarded
  // filter changes what the search returns with no error (a wrong flag name
  // once returned an entire portal's database as if it matched the query).
  // add-portal.md's contract requires a bogus flag to exit 1 with a JSON
  // error on stderr.
  const knownFlags = KNOWN_FLAGS[cmd]
  if (knownFlags) {
    for (const key of Object.keys(flags)) {
      if (key === "_" || knownFlags.has(key)) continue
      process.stderr.write(
        JSON.stringify({
          error: `unknown flag --${key} for '${cmd}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`,
          code: "UNKNOWN_FLAG",
        }) + "\n",
      )
      return 1
    }
  }

  if (cmd === "search") {
    const fmt = (flags.format as string) || "json"

    // Validated here rather than server-side: the API answers an unrecognized
    // format with raw HTML instead of an error, so a typo would silently change
    // the output rather than fail.
    const descFmt = stringFlag(flags["description-format"]) ?? "markdown"
    if (!DESCRIPTION_FORMATS.includes(descFmt as DescriptionFormat)) {
      const supported = DESCRIPTION_FORMATS.join("|")
      process.stderr.write(
        JSON.stringify({ error: `--description-format must be one of ${supported}, got "${descFmt}"`, code: "BAD_ARG" }) + "\n",
      )
      return 1
    }

    for (const name of ["jobage", "page", "limit"] as const) {
      if (flags[name] !== undefined) {
        const v = parseIntFlag(name, flags[name])
        if (v === null) return 1
        flags[name] = String(v)
      }
    }

    // Generic --facet key=value list -> param -> values.
    const facets: Recor
```

### Core Architecture Module: `.agents/skills/freehire-search/cli/src/commands/detail.ts`
```
import { apiGet, normalizeSlug, toDetail, writeError, type FreehireJob, type JobDetailResult } from "../helpers.js"

export interface DetailOpts {
  id: string // a freehire public slug or a /jobs/<slug> URL
  format: "json" | "plain"
}

/** A human-readable rendering of one job: header, present fields, description. */
function renderPlain(job: JobDetailResult): string {
  const lines = [job.title, `${job.company ?? "—"} · ${job.location ?? "—"}`]

  const field = (label: string, value: string | null) => {
    if (value) lines.push(`${label}: ${value}`)
  }
  field("Posted", job.date && job.date.slice(0, 10))
  field("Seniority", job.seniority)
  field("Category", job.category)
  field("Employment", job.employment_type)
  field("Salary", job.salary)
  field("Skills", job.skills.length ? job.skills.join(", ") : null)

  lines.push("", job.description ?? "(no description)", "", `URL: ${job.url}`, `slug: ${job.id}`)
  return lines.join("\n")
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const slug = normalizeSlug(opts.id)
  if (!slug) {
    writeError(`could not parse a freehire slug from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const env = await apiGet<FreehireJob>(`/api/v1/jobs/${encodeURIComponent(slug)}`)
    if (!env) {
      writeError("job not found", "NOT_FOUND")
      return 1
    }
    const job = toDetail(env.data)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"}`,
        job.date ? `Posted: ${job.date.slice(0, 10)}` : "",
        job.seniority ? `Seniority: ${job.seniority}` : "",
        job.category ? `Category: ${job.category}` : "",
        job.employment_type ? `Employment: ${job.employment_type}` : "",
        job.salary ? `Salary: ${job.salary}` : "",
        job.skills.length ? `Skills: ${job.skills.join(", ")}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
        `slug: ${job.id}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}

```

### Core Architecture Module: `.agents/skills/freehire-search/cli/src/commands/search.ts`
```
import { apiGet, toResult, writeError, type FreehireJob, type JobResult } from "../helpers.js"

// The agent variant of the job search: the same query, ranking, and facets as the
// web's /jobs/search, but each hit carries the posting's full description instead
// of the search index's truncated preview — so a run reads every result without a
// follow-up `detail` per hit.
const SEARCH_PATH = "/api/v1/agent/jobs/search"

/** How the API renders each result's full description. */
export type DescriptionFormat = "markdown" | "text" | "html"

export const DESCRIPTION_FORMATS: DescriptionFormat[] = ["markdown", "text", "html"]

export interface SearchOpts {
  query?: string
  jobage: number
  page: number
  limit: number
  format: "json" | "table" | "plain"
  descriptionFormat: DescriptionFormat
  // Hydrate full description bodies (the documented default). False keeps a
  // discovery pass cheap: bodies are ~73% of a default search payload, and
  // /scrape pre-filters by title before reading bodies anyway.
  includeDescription?: boolean
  // Facet filters (already parsed into value lists; empty means unset).
  regions: string[]
  countries: string[]
  cities: string[]
  seniority: string[]
  category: string[]
  skills: string[]
  company?: string
  workMode?: string // work_mode facet: remote | hybrid | onsite
  // Arbitrary facet escape hatch: param -> values, for the long tail of the vocabulary.
  facets: Record<string, string[]>
}

function buildQuery(opts: SearchOpts): URLSearchParams {
  const p = new URLSearchParams()
  if (opts.query) p.set("q", opts.query)
  p.set("limit", String(opts.limit))
  p.set("offset", String((opts.page - 1) * opts.limit))
  p.set("semantic_ratio", "0") // keyword search; the semantic index is opt-in
  // The agent endpoint serves the index's truncated preview unless asked to
  // rehydrate each hit from the database, so both params travel together -
  // unless the caller opted out of hydration entirely (--no-description).
  const hydrate = opts.includeDescription !== false
  p.set("include_description", hydrate ? "true" : "false")
  if (hydrate) p.set("description_format", opts.descriptionFormat)
  if (opts.jobage > 0 && opts.jobage < 9999) p.set("posted_within_days", String(opts.jobage))
  if (opts.workMode) p.set("work_mode", opts.workMode)
  if (opts.company) p.set("company_slug", opts.company)

  // Named facets and the generic --facet escape hatch append the same way; values
  // are already split into lists, so each becomes one repeated query param.
  const facets: Array<[string, string[]]> = [
    ["regions", opts.regions],
    ["countries", opts.countries],
    ["cities", opts.cities],
    ["seniority", opts.seniority],
    ["category", opts.category],
    ["skills", opts.skills],
    ...Object.entries(opts.facets),
  ]
  for (const [param, values] of facets) {
    for (const value of values) p.append(param, value)
  }
  return p
}

/** The date portion (YYYY-MM-DD) of an ISO timestamp, or "—" when absent. */
function shortDate(date: string | null): string {
  return date ? date.slice(0, 10) : "—"
}

// Table columns: header, width, and the cell value. The SLUG column is sized to
// the longest slug so it is never truncated — a cut slug can't be looked up in
// `detail`; the fixed-width columns truncate for scanning.
interface Column {
  header: string
  width: number
  cell: (r: JobResult) => string
}

function renderTable(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const columns: Column[] = [
    { header: "SLUG", width: Math.max(4, ...rows.map((r) => r.id.length)), cell: (r) => r.id },
    { header: "TITLE", width: 38, cell: (r) => r.title },
    { header: "COMPANY", width: 22, cell: (r) => r.company ?? "—" },
    { header: "LOCATION", width: 20, cell: (r) => r.location ?? "—" },
    { header: "DATE", width: 10, cell: (r) => shortDate(r.date) },
  ]
  const row = (cells: string[]) => cells.map((c, i) => c.slice(0, columns[i].width).padEnd(columns[i].width)).join("  ")

  const header = row(columns.map((c) => c.header))
  const body = rows.map((r) => row(columns.map((c) => c.cell(r))))
  return [header, "-".repeat(header.length), ...body].join("\n")
}

function renderPlain(rows: JobResult[]): string {
  if (rows.length === 0) return "No results."
  const block = (r: JobResult) =>
    [
      r.title,
      `  ${r.company ?? "—"} · ${r.location ?? "—"} · ${shortDate(r.date)}`,
      `  slug: ${r.id}`,
      `  ${r.url}`,
    ].join("\n")
  return rows.map(block).join("\n\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const env = await apiGet<FreehireJob[]>(`${SEARCH_PATH}?${buildQuery(opts).toString()}`)
    // A 404 here is a missing endpoint, not a missing job: a freehire instance
    // older than the agent search surface answers that way, and reporting it as
    // an empty result set would hide the misconfiguration behind plausible output.
    if (!env) {
      writeError(
        `${SEARCH_PATH} not found — this freehire instance predates the agent search endpoint; upgrade it or unset FREEHIRE_API_URL to use the hosted API`,
        "SEARCH_FAILED",
      )
      return 1
    }
    let rows = (env.data ?? []).map(toResult)
    // The API currently returns description bodies regardless of
    // include_description=false (verified live 2026-08-19), and the cost this
    // flag exists to avoid is the ~73% of CLI output the bodies occupy in
    // agent context - so the lean mode strips them client-side either way.
    if (opts.includeDescription === false) {
      rows = rows.map((r) => ({ ...r, description: null }))
    }
    const total = env.meta?.total ?? rows.length

    if (opts.format === "table") {
      process.stdout.write(renderTable(rows) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(rows) + "\n")
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: rows.length, page: opts.page, total }, results: rows },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}

```

### Core Architecture Module: `.agents/skills/freehire-search/cli/src/helpers.ts`
```
// Data source: the freehire.me public REST API (JSON, `{data, meta}` envelope).
// Reads are unauthenticated — no API key, the same bar as linkedin-search — and
// unlike the HTML-scraping portals there is no markup to parse: we fetch JSON and
// reshape it into the portal-skill contract's result fields. The base URL is
// swappable via FREEHIRE_API_URL for self-hosting.

export const DEFAULT_BASE_URL = "https://freehire.me"

/** API base URL: FREEHIRE_API_URL (for a self-hosted instance) or the default. */
export function baseUrl(): string {
  const raw = (process.env.FREEHIRE_API_URL ?? "").trim()
  return (raw || DEFAULT_BASE_URL).replace(/\/+$/, "")
}

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA = "freehire-search-skill/1.0 (+https://freehire.me)"

/** The shared API response envelope: {data, meta, error}. */
export interface Envelope<T> {
  data: T
  meta?: { total?: number; limit?: number; offset?: number }
  error?: string
}

/**
 * GET a JSON envelope from the freehire API. Retries 429/5xx (transient server
 * states) with backoff; returns `null` on a 404. A connection failure fails fast
 * with a clear message — no retry, so an outage degrades this source quickly
 * rather than hanging the caller (the graceful-degradation contract).
 */
export async function apiGet<T>(path: string): Promise<Envelope<T> | null> {
  const url = `${baseUrl()}${path}`
  const maxRetries = 6
  let delay = 500

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let response: Response
    try {
      response = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
      })
    } catch (e) {
      // Connection refused / DNS failure / timeout: the API is unreachable.
      throw new Error(
        `could not reach the freehire API at ${baseUrl()} (${e instanceof Error ? e.message : String(e)})`,
      )
    }

    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`freehire API request failed: ${response.status} ${response.statusText}`)
      }
      await sleep(delay + Math.floor(Math.random() * 500))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null

    // Read the body once, tolerantly: an error response's JSON gives us its
    // `error` message; a 2xx must parse (a malformed one is surfaced, not swallowed).
    const body = (await response.json().catch(() => null)) as Envelope<T> | null
    if (!response.ok) {
      throw new Error(body?.error || `freehire API request failed: ${response.status} ${response.statusText}`)
    }
    if (!body) throw new Error("freehire API returned an unparseable response body")
    return body
  }
  // Unreachable in practice; the loop returns or throws on the last attempt.
  throw new Error("freehire API request failed after retries")
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * A freehire job — the fields this skill reads (the wire shape carries more).
 */
export interface FreehireJob {
  public_slug: string
  source: string
  external_id: string
  url: string
  title: string
  company: string
  company_slug: string
  location: string
  description: string
  skills: string[]
  work_mode?: string
  regions: string[]
  countries: string[]
  cities: string[]
  posted_at: string | null
  created_at: string | null
  // Always present in the wire shape (an unenriched job serializes it as `{}`);
  // the individual fields are what may be absent.
  enrichment: {
    seniority?: string
    category?: string
    employment_type?: string
    salary_min?: number
    salary_max?: number
    salary_currency?: string
    salary_period?: string // e.g. "year", "month"
  }
}

/**
 * A search result in the portal-skill contract shape. `id` is the public_slug
 * (what `detail <slug>` consumes) and `date` is the posting date; missing values
 * are `null`, never omitted. The extra facet fields are a permitted superset.
 *
 * `description` is the posting's full text in the format the search asked the API
 * for — the agent search endpoint hydrates it server-side, so it arrives already
 * rendered and is passed through verbatim rather than run through `cleanHtml`.
 */
export interface JobResult {
  id: string
  title: string
  company: string | null
  company_slug: string | null
  location: string | null
  date: string | null
  url: string
  work_mode: string | null
  regions: string[]
  countries: string[]
  skills: string[]
  description: string | null
}

/** A job detail: the search result plus the cleaned description and enrichment. */
export interface JobDetailResult extends JobResult {
  cities: string[]
  seniority: string | null
  category: string | null
  employment_type: string | null
  salary: string | null
  description: string | null
}

/**
 * Reshape a freehire job into the contract search-result fields. The title comes
 * from the source ATS as indexed, which can carry HTML entities and stray
 * whitespace ("Intern - Fullstack &amp; AI Innovation "), so it is decoded and trimmed.
 */
export function toResult(j: FreehireJob): JobResult {
  return {
    id: j.public_slug,
    title: decodeHtmlEntities(j.title || "").trim() || "(untitled)",
    company: j.company || null,
    company_slug: j.company_slug || null,
    location: j.location || null,
    date: j.posted_at,
    url: j.url,
    work_mode: j.work_mode || null,
    regions: j.regions,
    countries: j.countries,
    skills: j.skills,
    description: j.description || null,
  }
}

/** Reshape a freehire job into the detail result (adds cleaned description + enrichment). */
export function toDetail(j: FreehireJob): JobDetailResult {
  const e = j.enrichment
  return {
    ...toResult(j),
    cities: j.cities,
    seniority: e.seniority || null,
    category: e.category || null,
    employment_type: e.employment_type || null,
    salary: formatSalary(e),
    description: cleanHtml(j.description),
  }
}

/**
 * Human-readable salary line from the enrichment fields, or null when absent.
 * The period is kept when freehire records one ("INR 300000–300000/year"):
 * without it a yearly figure is indistinguishable from a monthly one.
 */
function formatSalary(e: FreehireJob["enrichment"]): string | null {
  if (e.salary_min == null && e.salary_max == null) return null
  const cur = e.salary_currency ? `${e.salary_currency} ` : ""
  const per = e.salary_period ? `/${e.salary_period}` : ""
  if (e.salary_min != null && e.salary_max != null) return `${cur}${e.salary_min}–${e.salary_max}${per}`
  return `${cur}${e.salary_min ?? e.salary_max}${per}`
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

/**
 * Strip a freehire description's HTML into readable prose: block/line-break tags
 * become newlines, entities are decoded, tags removed. Null for empty input.
 */
export function cleanHtml(html: string | null | undefined): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

/** Extract a freehire public slug from a bare slug or 
```

### Core Architecture Module: `.agents/skills/jobbank-search/cli/src/cli.ts`
```
import { createCLI } from "@bunli/core"
import { writeError } from "./helpers.js"
import { search } from "./commands/search.js"
import { detail } from "./commands/detail.js"

const cli = await createCLI({
  name: "jobbank-cli",
  version: "1.0.0",
  description: "CLI for Akademikernes Jobbank (jobbank.dk) — job search for highly educated candidates",
})

const commands = [search, detail]
for (const command of commands) {
  cli.command(command)
}

// Reject unknown flags before dispatch. bunli silently discards them, and a
// silently discarded filter changes what the search returns without any error
// (a wrong flag name once returned an entire portal's database as if it
// matched the query). add-portal.md's contract requires a bogus flag to exit 1
// with a JSON error on stderr; this enforces it for the reference CLIs too.
//
// Both dash forms are checked. This loop inspected only `--long` tokens until
// #426, so an undefined short flag was discarded in silence: `-q "..."` on a
// portal whose keyword flag is `--search-string` returned the whole database
// as a successful, unfiltered search. Declared shorts and bunli's built-in
// -h/-v stay valid; every other single-dash token is rejected, including a
// negative number. bunli does not consume a `-`-prefixed token as the previous
// flag's value - it discards it - so `--radius -5` silently fell back to the
// default radius rather than failing its own `min(1)` schema. Erroring on it
// is the same trade linkedin-search already makes. A value that must begin
// with a dash uses the `--flag=value` form, which is checked as a long flag.
const argv = process.argv.slice(2)
const invoked = commands.find((c) => (c as { name?: string }).name === argv[0])
if (invoked) {
  const options =
    (invoked as { options?: Record<string, { short?: string } | undefined> }).options ?? {}
  const known = new Set([...Object.keys(options), "help", "version"])
  const knownShorts = new Set(
    Object.values(options)
      .map((o) => o?.short)
      .filter((s): s is string => typeof s === "string")
      .concat("h", "v"),
  )
  const rejectFlag = (rendered: string): never => {
    writeError(
      `unknown flag ${rendered} for '${argv[0]}' - flags are never silently ignored, because a discarded filter changes what the search returns; see --help for the supported flags`,
      "UNKNOWN_FLAG",
    )
    process.exit(1)
  }
  for (const token of argv.slice(1)) {
    if (token === "--") break
    if (token.startsWith("--")) {
      const flag = token.slice(2).split("=")[0]
      if (!known.has(flag)) rejectFlag(`--${flag}`)
    } else if (token.startsWith("-") && token !== "-") {
      const flag = token.slice(1).split("=")[0]
      if (!knownShorts.has(flag)) rejectFlag(`-${flag}`)
    }
  }
}

await cli.run()

```

### Core Architecture Module: `.agents/skills/jobbank-search/cli/src/commands/detail.ts`
```
import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import { fetchWithUA, normalizeJobId, parseJobPostingJsonLd, writeError, BASE_URL } from "../helpers.js"

export const detail = defineCommand({
  name: "detail",
  description: "Full detail for a single job posting",
  options: {
    format: option(z.enum(["json", "plain"]).default("json"), {
      description: "Output format: json, plain",
    }),
  },
  handler: async ({ positional, flags, signal }) => {
    if (signal.aborted) return

    const rawId = positional[0]
    if (!rawId) {
      writeError("Job ID is required", "MISSING_REQUIRED")
      process.exit(1)
    }

    const id = normalizeJobId(rawId)
    if (!id) {
      writeError(`Could not extract job ID from "${rawId}"`, "BAD_ID")
      process.exit(1)
    }

    const url = `${BASE_URL}/job/${id}/`

    try {
      const response = await fetchWithUA(url)

      if (response.status === 404) {
        writeError("Job not found", "NOT_FOUND")
        process.exit(1)
      }

      if (!response.ok) {
        writeError(`Failed to fetch job page: ${response.status} ${response.statusText}`, "API_ERROR")
        process.exit(1)
      }

      const html = await response.text()

      if (signal.aborted) return

      const jobPosting = parseJobPostingJsonLd(html)

      if (!jobPosting) {
        writeError("No JSON-LD found on job page", "PARSE_ERROR")
        process.exit(1)
      }

      // Extract fields
      const identifier = jobPosting["identifier"] as Record<string, unknown> | undefined
      const jobId = identifier?.["value"] ? String(identifier["value"]) : id

      // Check if the returned job ID doesn't match what was requested — indicates not found / redirect to different job
      // We skip this check since short URL redirects to the actual job and returns 200

      const hiringOrg = jobPosting["hiringOrganization"] as Record<string, unknown> | undefined
      const jobLocation = jobPosting["jobLocation"] as Record<string, unknown> | undefined
      const address = (jobLocation?.["address"] as Record<string, unknown>) ?? {}

      const employmentType = jobPosting["employmentType"]
      const empTypeArr: string[] = Array.isArray(employmentType)
        ? employmentType.map(String)
        : employmentType
        ? [String(employmentType)]
        : []

      const validThrough = jobPosting["validThrough"]
      let deadline: string | null = null
      if (validThrough && String(validThrough).length > 0) {
        // Normalize to YYYY-MM-DD if it's an ISO datetime
        const dtStr = String(validThrough)
        deadline = dtStr.substring(0, 10) // take first 10 chars = YYYY-MM-DD
        if (deadline === "0001-01-01") deadline = null // invalid date
      }

      const output = {
        id: jobId,
        url: String(jobPosting["url"] ?? url),
        title: String(jobPosting["title"] ?? ""),
        description: String(jobPosting["description"] ?? ""),
        datePosted: String(jobPosting["datePosted"] ?? ""),
        deadline,
        employmentType: empTypeArr,
        company: {
          name: String(hiringOrg?.["name"] ?? ""),
          logo: hiringOrg?.["logo"] ? String(hiringOrg["logo"]) : null,
        },
        location: {
          streetAddress: String(address["streetAddress"] ?? ""),
          city: String(address["addressLocality"] ?? ""),
          postalCode: String(address["postalCode"] ?? ""),
          country: String(address["addressCountry"] ?? ""),
        },
      }

      // Verify the job ID matches if possible — if the page 404'd or redirected to a different job
      // For invalid IDs that redirect to a generic page, the JSON-LD may be absent
      // We already handle the "No JSON-LD" case above

      if (flags.format === "json") {
        console.log(JSON.stringify(output, null, 2))
      } else {
        outputPlain(output)
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("NOT_FOUND")) {
        writeError("Job not found", "NOT_FOUND")
      } else {
        writeError(err instanceof Error ? err.message : String(err), "API_ERROR")
      }
      process.exit(1)
    }
  },
})

function outputPlain(data: {
  id: string
  url: string
  title: string
  description: string
  datePosted: string
  deadline: string | null
  employmentType: string[]
  company: { name: string; logo: string | null }
  location: { streetAddress: string; city: string; postalCode: string; country: string }
}): void {
  console.log(`id: ${data.id}`)
  console.log(`title: ${data.title}`)
  console.log(`company: ${data.company.name}`)
  if (data.company.logo) console.log(`logo: ${data.company.logo}`)
  console.log(`location: ${[data.location.streetAddress, data.location.city, data.location.country].filter(Boolean).join(", ")}`)
  console.log(`datePosted: ${data.datePosted}`)
  console.log(`deadline: ${data.deadline ?? "none"}`)
  console.log(`employmentType: ${data.employmentType.join(", ")}`)
  console.log(`url: ${data.url}`)
  console.log("")
  // Strip HTML tags for plain description
  const plainDescription = data.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  console.log(plainDescription)
}

```

### Core Architecture Module: `.agents/skills/jobbank-search/cli/src/commands/search.ts`
```
import { defineCommand, option } from "@bunli/core"
import { z } from "zod"
import { rssFetch, fetchWithUA, writeError, parseRssDescription, extractJobIdFromUrl, BASE_URL, type RssItem } from "../helpers.js"

export function normalizeSearchItem(item: RssItem): Record<string, unknown> {
  const parsed = parseRssDescription(item.description)
  const id = extractJobIdFromUrl(item.link)
  // Guard the parse: new Date(<unparseable>) is an Invalid Date whose
  // toISOString() throws RangeError, and this runs inside an unguarded
  // items.map() - one bad feed item would kill the whole search as
  // API_ERROR (#416). An unparseable pubDate degrades to the same shape
  // as an absent one: posted "", date null.
  const parsedDate = item.pubDate ? new Date(item.pubDate) : null
  const posted = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : ""
  return {
    id,
    title: item.title,
    company: parsed.company,
    location: parsed.location,
    jobType: parsed.jobType,
    description: item.description,
    url: item.link,
    posted,
    date: posted ? posted.slice(0, 10) : null,
    deadline: parsed.deadline,
  }
}

export const search = defineCommand({
  name: "search",
  description: "Search job listings via RSS feed",
  options: {
    key: option(z.string().optional(), {
      description: "Keyword search (title, company, keyword)",
    }),
    exclude: option(z.string().optional(), {
      description: "Exclude keywords (antikey)",
    }),
    type: option(z.union([z.string(), z.array(z.string())]).optional(), {
      description: "Job type code (cvtype). Repeatable: --type 3 --type 6",
    }),
    education: option(z.union([z.string(), z.array(z.string())]).optional(), {
      description: "Education field code (udd). Repeatable.",
    }),
    location: option(z.union([z.string(), z.array(z.string())]).optional(), {
      description: "Region code (amt). Repeatable.",
    }),
    "work-area": option(z.union([z.string(), z.array(z.string())]).optional(), {
      description: "Work area / function code (erf). Repeatable.",
    }),
    industry: option(z.union([z.string(), z.array(z.string())]).optional(), {
      description: "Industry code (branche). Repeatable.",
    }),
    "suitable-for": option(z.union([z.string(), z.array(z.string())]).optional(), {
      description: "Suitable-for code (andet). Repeatable.",
    }),
    company: option(z.coerce.number().int().min(1).optional(), {
      description: "Company ID (virk)",
    }),
    remote: option(z.string().optional(), {
      description: "Remote work: helt or delvist (fjernarbejde)",
    }),
    since: option(z.string().optional(), {
      description: "Posted on or after date, format YYYY-MM-DD (oprettet)",
    }),
    limit: option(z.coerce.number().int().min(1).optional(), {
      description: "Cap total results returned by CLI (client-side)",
    }),
    format: option(z.enum(["json", "table", "plain"]).default("json"), {
      description: "Output format: json, table, plain",
    }),
  },
  handler: async ({ flags, signal }) => {
    if (signal.aborted) return

    // Require at least one filter
    const hasFilter =
      flags.key ||
      flags.exclude ||
      flags.type ||
      flags.education ||
      flags.location ||
      flags["work-area"] ||
      flags.industry ||
      flags["suitable-for"] ||
      flags.company !== undefined ||
      flags.remote ||
      flags.since

    if (!hasFilter) {
      writeError("--key or at least one filter is required", "MISSING_REQUIRED")
      process.exit(1)
    }

    const params: Record<string, string | string[]> = {}

    if (flags.key) params["key"] = flags.key
    if (flags.exclude) params["antikey"] = flags.exclude
    if (flags.type) {
      const vals = Array.isArray(flags.type) ? flags.type : [flags.type]
      params["cvtype"] = vals.flatMap((v) => v.split(","))
    }
    if (flags.education) {
      const vals = Array.isArray(flags.education) ? flags.education : [flags.education]
      params["udd"] = vals.flatMap((v) => v.split(","))
    }
    if (flags.location) {
      const vals = Array.isArray(flags.location) ? flags.location : [flags.location]
      params["amt"] = vals.flatMap((v) => v.split(","))
    }
    if (flags["work-area"]) {
      const vals = Array.isArray(flags["work-area"]) ? flags["work-area"] : [flags["work-area"]]
      params["erf"] = vals.flatMap((v) => v.split(","))
    }
    if (flags.industry) {
      const vals = Array.isArray(flags.industry) ? flags.industry : [flags.industry]
      params["branche"] = vals.flatMap((v) => v.split(","))
    }
    if (flags["suitable-for"]) {
      const vals = Array.isArray(flags["suitable-for"]) ? flags["suitable-for"] : [flags["suitable-for"]]
      params["andet"] = vals.flatMap((v) => v.split(","))
    }
    if (flags.company !== undefined) params["virk"] = String(flags.company)
    if (flags.remote) params["fjernarbejde"] = flags.remote
    if (flags.since) params["oprettet"] = flags.since

    try {
      // Fetch RSS feed
      const items = await rssFetch(params)

      if (signal.aborted) return

      // Also fetch total count from HTML page (secondary request)
      let total: number | null = null
      try {
        // Small delay to be polite
        await new Promise((resolve) => setTimeout(resolve, 300))
        const searchParams = new URLSearchParams()
        for (const [key, value] of Object.entries(params)) {
          if (Array.isArray(value)) {
            for (const v of value) searchParams.append(key, v)
          } else {
            searchParams.append(key, value)
          }
        }
        const htmlUrl = `${BASE_URL}/job/?${searchParams.toString()}`
        const htmlResp = await fetchWithUA(htmlUrl)
        if (htmlResp.ok) {
          const html = await htmlResp.text()
          // Extract from <title> tag: "457 relevante job og karriereopslag i Akademikernes Jobbank"
          const titleMatch = html.match(/<title[^>]*>\s*(\d[\d.,]*)\s+relevante job/i)
          if (titleMatch) {
            total = parseInt(titleMatch[1].replace(/[.,]/g, ""), 10)
          }
        }
      } catch {
        // Secondary request failed — total stays null
      }

      // Normalize items
      let results = items.map(normalizeSearchItem)

      // Apply limit
      if (flags.limit !== undefined) {
        results = results.slice(0, flags.limit)
      }

      const output = { meta: { total }, results }

      if (flags.format === "json") {
        console.log(JSON.stringify(output, null, 2))
      } else if (flags.format === "table") {
        outputTable(results)
      } else {
        outputPlain(results)
      }
    } catch (err) {
      writeError(err instanceof Error ? err.message : String(err), "API_ERROR")
      process.exit(1)
    }
  },
})

function outputTable(results: Array<Record<string, unknown>>): void {
  console.log("id        title                                company                location           deadline")
  for (const r of results) {
    const id = String(r.id ?? "-").padEnd(9)
    const title = String(r.title ?? "-").substring(0, 36).padEnd(36)
    const company = String(r.company ?? "-").substring(0, 22).padEnd(22)
    const location = String(r.location ?? "-").substring(0, 18).padEnd(18)
    const deadline = String(r.deadline ?? "-")
    console.log(`${id} ${title} ${company} ${location} ${deadline}`)
  }
}

function outputPlain(results: Array<Record<string, unknown>>): void {
  for (const r of results) {
    console.log(`id: ${r.id}`)
    console.log(`title: ${r.title}`)
    console.log(`company: ${r.company}`)
    console.log(`location: ${r.location}`)
    console.log(`jobType: ${r.jobType}`)
    console.log(`posted: ${r.posted}`)
    console.log(`deadline: ${r.deadline ?? "none"}`)
    console.log(`url: ${r.url}`)
    console.log("")
  }
}

```

### Core Architecture Module: `.agents/skills/jobbank-search/cli/src/helpers.ts`
```
import { parse as parseHtml } from "node-html-parser"

export const BASE_URL = "https://jobbank.dk"

export const USER_AGENT = "Mozilla/5.0 (compatible; jobbank-cli/1.0)"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

export async function fetchWithUA(url: string): Promise<Response> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(15000),
    })
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((resolve) => setTimeout(resolve, delay + jitter))
      delay = Math.min(delay * 2, 5000)
      continue
    }
    return response
  }
  throw new Error("Request failed after max retries")
}

export interface RssItem {
  title: string
  description: string
  link: string
  pubDate: string
}

function extractCdata(xml: string, tag: string): string {
  // Try CDATA first
  const cdataRe = new RegExp(`<${tag}><\\!\\[CDATA\\[(.*?)\\]\\]><\\/${tag}>`, "s")
  const cdataMatch = xml.match(cdataRe)
  if (cdataMatch) return cdataMatch[1].trim()
  // Plain content
  const plainRe = new RegExp(`<${tag}>(.*?)<\\/${tag}>`, "s")
  const plainMatch = xml.match(plainRe)
  return plainMatch ? plainMatch[1].trim() : ""
}

function extractLink(xml: string): string {
  // <link> in RSS can conflict with atom namespace — extract text node after <link>
  // Try CDATA variant first
  const cdataMatch = xml.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>/s)
  if (cdataMatch) return cdataMatch[1].trim()
  // Plain link
  const plainMatch = xml.match(/<link>(.*?)<\/link>/s)
  if (plainMatch) return plainMatch[1].trim()
  // Some RSS feeds put the URL as text after <link> without a closing tag (self-closing style)
  // Try matching href in atom:link
  return ""
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = []
  // Split on <item> boundaries
  const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  for (const match of itemMatches) {
    const itemXml = match[1]
    const title = extractCdata(itemXml, "title")
    const description = extractCdata(itemXml, "description")
    const link = extractLink(itemXml)
    const pubDate = extractCdata(itemXml, "pubDate") || itemXml.match(/<pubDate>(.*?)<\/pubDate>/)?.[1]?.trim() || ""
    items.push({ title, description, link, pubDate })
  }
  return items
}

export async function rssFetch(params: Record<string, string | string[]>): Promise<RssItem[]> {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      for (const v of value) {
        searchParams.append(key, v)
      }
    } else {
      searchParams.append(key, value)
    }
  }
  const url = `${BASE_URL}/job/rss?${searchParams.toString()}`
  const response = await fetchWithUA(url)
  if (!response.ok) {
    const body = await response.clone().text()
    if (response.status === 403 && /just a moment|cloudflare|cf-chl/i.test(body)) {
      throw new Error(
        "Jobbank is blocking automated requests with Cloudflare bot protection. Skip this portal or use the WebSearch fallback."
      )
    }
    throw new Error(`Failed to fetch RSS feed: ${response.status} ${response.statusText}`)
  }
  const xml = await response.text()
  return parseRssItems(xml)
}

export interface ParsedDescription {
  jobType: string
  company: string
  location: string
  deadline: string | null
}

export function parseRssDescription(desc: string): ParsedDescription {
  // Format: "JobType hos Company, Location (Ansøgningsfrist: DD.MM.YYYY)"
  // or: "JobType hos Company, Location (Ansøgningsfrist: løbende)"
  // or multiple types: "Fuldtidsjob, Graduate/trainee hos Company, Location (Ansøgningsfrist: ...)"

  let jobType = ""
  let company = ""
  let location = ""
  let deadline: string | null = null

  const hosIdx = desc.indexOf(" hos ")
  if (hosIdx === -1) {
    // Can't parse — return desc as company
    return { jobType: "", company: desc, location: "", deadline: null }
  }

  jobType = desc.substring(0, hosIdx).trim()
  let rest = desc.substring(hosIdx + 5) // skip " hos "

  // Extract deadline from parenthetical at the end
  const deadlineMatch = rest.match(/\(Ans[øo]gningsfrist:\s*(.*?)\)\s*$/)
  if (deadlineMatch) {
    const deadlineStr = deadlineMatch[1].trim()
    if (deadlineStr.toLowerCase() === "løbende" || deadlineStr.toLowerCase() === "lobende") {
      deadline = null
    } else {
      // The feed writes DD.MM.YYYY; the /scrape contract (and this CLI's own
      // detail command) use YYYY-MM-DD. Convert the known shape; anything else
      // passes through so an unexpected value stays visible downstream.
      const dmy = deadlineStr.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
      deadline = dmy ? `${dmy[3]}-${dmy[2]}-${dmy[1]}` : deadlineStr
    }
    // Remove the deadline portion from rest
    rest = rest.substring(0, deadlineMatch.index).trim()
  }

  // rest is now "Company, Location"
  // Split on first ", " to get company and location
  const firstComma = rest.indexOf(", ")
  if (firstComma !== -1) {
    company = rest.substring(0, firstComma).trim()
    location = rest.substring(firstComma + 2).trim()
  } else {
    company = rest.trim()
    location = ""
  }

  return { jobType, company, location, deadline }
}

export function normalizeJobId(input: string): string | null {
  const trimmed = input.trim()
  if (/^\d+$/.test(trimmed)) return trimmed
  const match = trimmed.match(/\/job\/(\d+)(?:\/|$|\?|#)/)
  return match ? match[1] : null
}

export function extractJobIdFromUrl(url: string): string {
  // URL format: https://jobbank.dk/job/{id}/{company-slug}/{title-slug}
  return normalizeJobId(url) ?? ""
}

function findJobPosting(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const jobPosting = findJobPosting(item)
      if (jobPosting) return jobPosting
    }
    return null
  }

  if (!value || typeof value !== "object") return null

  const record = value as Record<string, unknown>
  if (record["@type"] === "JobPosting") return record

  return findJobPosting(record["@graph"])
}

export function parseJobPostingJsonLd(html: string): Record<string, unknown> | null {
  const root = parseHtml(html)
  const scripts = root.querySelectorAll('script[type="application/ld+json"]')

  for (const script of scripts) {
    try {
      const jobPosting = findJobPosting(JSON.parse(script.text) as unknown)
      if (jobPosting) return jobPosting
    } catch {
      // Invalid JSON-LD should not prevent later scripts from being checked.
    }
  }

  return null
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #507** (2026-09-29): **chore(release): cut v1.7.2**
  *Symptoms*: Rolls `[Unreleased]` into `[1.7.2] - 2026-09-29` and moves the compare links, keeping an empty `[Unreleased]` heading above the release per Keep a Changelog. Thirty-two entries: seven added, one changed, twenty-four fixed. No code changes; the CHANGELOG structure guard, lint, framework-version and security checks pass locally.  Two `framework_version` markers moved this cycle (`05-cv-templates.md` 1.4.3 -> 1.4.5, `09-web-research.md` 1.1.0 -> 1.1.1), so `check_upstream_updates.py` will flag both to forks; the release notes carry the reconcile list.  🤖 Generated with [Claude Code](https://claude.com/claude-code) 

- **Issue #506** (2026-09-29): **fix(robots-check): decode curl output as UTF-8 so non-ASCII responses stop reading as UNCONFIRMED on Windows**
  *Symptoms*: ## What changed and why  `tools/robots_check.py`'s `_fetch()` ran curl with `text=True` and no `encoding`, so Python decoded the response with the locale's code page, which on Windows is the ANSI code page. When the response holds a byte that code page leaves undefined (0x81 in cp1252 and cp1254, 0x9e in cp1254), `subprocess`'s pipe reader thread raises `UnicodeDecodeError`, `communicate()` hands back `stdout=None`, `r.stdout.rpartition('\n')` raises `AttributeError`, and the gate prints `UNCONFIRMED (AttributeError) - do not retry, go to step 3`. That fails closed, which is the safe direction, but it blocks the browser-header retry `09-web-research.md` permits. It hits Turkish sites often, and Indeed's robots.txt even under cp1252.  The fix pins `encoding='utf-8', errors='replace'` on that one `subprocess.run` call. RFC 9309 says robots.txt is UTF-8, and it is the fix `verify_pdf.py` and `verify_layout.py` already carry. `_groups`, `_match`, `allowed`, `is_robots_body` and `gate` are untouched, and genuine read failures (curl error, a status other than 200/404, a soft-200 HTML body) still fail closed.  It also closes a silent fail-open on the same machines: a UTF-8 rule whose bytes the code page *does* define, such as `Disallow: /şirket/` under cp1254, decoded as `/ÅŸirket/`, never matched the decoded request path, and read as allowed. It now matches.  ## Failing case / reproduction (for fixes)  Windows 11, Python 3.11.9, cp1254 locale, on master:  ``` > python tools/robots_
  **Post-Mortem & Fix Analysis**:
  > Reproduced on this machine (Windows, cp1252) on master: `robots_check.py https://tr.indeed.com/` dies in the pipe reader on byte 0x81 and prints `UNCONFIRMED (AttributeError)`; on the branch it reads `ALLOWED - robots.txt permits this path`, and kap.org.tr resolves to the 404 rule. Both new tests fail against master's `_fetch` and pass here, 503 OK on Windows, lint and guards green, CI 18/18 on the rebased head (I rebased the CHANGELOG entry onto #503's, nothing else changed). The fix is the same one-line pin the PDF tools already carry, and the fail-open you found under cp1254 is the more important half. Merging. The BOM and non-UTF-8 follow-ups you list are welcome as their own PRs. 

- **Issue #505** (2026-09-29): **fix(freehire-search): decode HTML entities and trim whitespace in titles**
  *Symptoms*:  ## What's wrong  freehire indexes titles as the source ATS wrote them, and `toResult` passes `j.title` through untouched. Entities and stray whitespace reach both `search` and `detail` output.  ## Reproduce on master (`a45bbd1`)  ```bash bun run .agents/skills/freehire-search/cli/src/cli.ts detail intern-fullstack-amp-ai-innovation-noise-edaawqq2 --format json # "title": "Intern - Fullstack &amp; AI Innovation " ```  In a 93-result `/scrape` batch (`search -q "<role> intern" --country IN --seniority intern --jobage 14`), 1 title carried `&amp;` and 3 ended in whitespace (e.g. `"SDE Intern - Frontend   "`). `/scrape` Step 4.75 reads an undecoded entity in a title as a half-working parser, so by that rule a single such posting marks a healthy portal degraded.  ## Fix  The title goes through the CLI's existing `decodeHtmlEntities` (already used for `detail` descriptions via `cleanHtml`) and is trimmed. An empty or whitespace-only title still falls back to `(untitled)`. `toDetail` spreads `toResult`, so `detail` inherits the cleaned title.  With the fix, the reproduction above prints `"title": "Intern - Fullstack & AI Innovation"`.  Left alone on purpose:  - **Search descriptions:** 4 of the 93 carried `&#xa;`, but `description` is passed through verbatim in the requested format, and decoding would corrupt `--description-format html`. - **`company` and `location`:** no entities in the sample.  ## Tests  Three new `parsing.test.ts` cases: entity decodin
  **Post-Mortem & Fix Analysis**:
  > Verified live: on master `detail intern-fullstack-amp-ai-innovation-noise-edaawqq2` prints `'Intern - Fullstack &amp; AI Innovation '` with the trailing space; on the branch `'Intern - Fullstack & AI Innovation'`. A 100-result `--country IN --seniority intern` search on master today has 1 entity title and 4 whitespace-trailing titles, which matches your batch. 47 bun tests pass with the network blocked (49 on the rebased head with #504's two), `tsc` clean, the three new cases fail against master's pass-through, Python suite, lint and guards green on Windows, CI 18/18. Rebased the CHANGELOG entry onto #504's myself so you do not have to. Merging. 

- **Issue #504** (2026-09-29): **fix(freehire-search): keep the salary period so a yearly figure isn't read as monthly**
  *Symptoms*:  ## What's wrong  `freehire-search detail` prints a salary without its period. freehire's enrichment records `salary_period`, but `formatSalary` only uses the currency and the min/max, so a yearly figure and a monthly one print identically.  ## Reproduce on master (`a45bbd1`)  ```bash bun run .agents/skills/freehire-search/cli/src/cli.ts detail software-developer-trainee-codifi-fra635ux --format json # "salary": "INR 300000–300000"  curl -s https://freehire.me/api/v1/jobs/software-developer-trainee-codifi-fra635ux # data.enrichment: salary_min 300000, salary_max 300000, salary_currency "INR", salary_period "year" ```  Screened against a monthly figure, that yearly salary reads as twelve times its real monthly value.  ## Fix  `formatSalary` appends `/<salary_period>` when freehire records one: `INR 300000–300000/year`, `INR 12000/month`. A record without a period prints exactly as before, so the existing `EUR 90000–120000` expectation is unchanged. The `detail` paragraph in `SKILL.md` documents the suffix.  With the fix, the reproduction above prints `"salary": "INR 300000–300000/year"`.  ## Tests  Two new `parsing.test.ts` cases (a range, and a single bound). Both fail on master's formatter and pass with the fix:  - master's `helpers.ts`: 44 pass, 2 fail - this branch: 46 pass, 0 fail  ## Checks run (Windows 11, Python 3.12, Bun 1.4.2)  - `python tools/lint_skills.py`: OK - `python tools/check_framework_version.py`: OK - `python tools/securit
  **Post-Mortem & Fix Analysis**:
  > Verified live: on master `detail software-developer-trainee-codifi-fra635ux` prints `INR 300000–300000` while the API carries `salary_period: "year"`; on the branch it prints `INR 300000–300000/year`. 46 bun tests pass with the network blocked, `tsc` clean, the two new cases fail against master's formatter, Python suite, lint and guards green on Windows, CI 18/18 on the rebased head (I moved the CHANGELOG entry onto the two that landed this morning, nothing else changed). Merging. Carrying `salary` on `search` results is a separate change, and an issue for it is fine. 

- **Issue #503** (2026-09-29): **fix(tests): escape the regex in test_verify_pdf's docstring and compile-check tests/*.py**
  *Symptoms*: A follow-up to #480 and #498: the same invalid-escape warning, this time in a test module, and the compile check widened so it cannot come back.  ## Failing case, on the real path  `FindNonAsciiDateRangesTests`' docstring in `tests/test_verify_pdf.py` quotes the regex `` `\s*` `` in a non-raw string. `\s` is an invalid escape sequence, so Python 3.12+ warns when the module is compiled (CPython gh-98401). It is in this repo's own CI log for a45bbd1 (run 36455817434), on every Python that warns, while the run stays green (3.12 and 3.13 wording; 3.14 phrases it differently):  ``` tests/test_verify_pdf.py:75: SyntaxWarning: invalid escape sequence '\s' ```  Under `python -W error::SyntaxWarning -m unittest discover -s tests -t .` the module fails to import, and the whole `test_verify_pdf` suite drops out as one `_FailedTest` error.  ## Change  - `tests/test_verify_pdf.py`: the docstring now has `` `\\s*` ``, which renders as `\s*`. - `ToolsCompileWithoutWarnings` (from #480) compiled only `tools/*.py`, which is why this got through. It now compiles `tests/*.py` as well and names each offender with its directory. On master's `test_verify_pdf.py` it fails with `{'tests/test_verify_pdf.py': ["invalid escape sequence '\\s'"]}`, and it passes with the fix. - A `CHANGELOG` entry under `[Unreleased]` / `### Fixed`.  ## Verification  On Python 3.10, 3.11, 3.12, 3.13 and 3.14, from a clean bytecode cache: `python -W error::SyntaxWarning -m unittest discover -s tests -t .` passes 501 tests
  **Post-Mortem & Fix Analysis**:
  > Verified: the widened check fails on master's `tests/test_verify_pdf.py` with exactly `{'tests/test_verify_pdf.py': ["invalid escape sequence '\s'"]}` and passes here; the full suite runs clean under `-W error::SyntaxWarning` on the branch; lint and guards green; entry under `[Unreleased]` / `### Fixed`; CI 18/18. Merging. Thanks for closing the gap the first guard left. 

- **Issue #500** (2026-09-27): **fix(linkedin-search): reject detail URLs on other hosts instead of fetching the posting with that number (#499)**
  *Symptoms*: Fixes #499.  ## What was wrong  `normalizeId` ([master, detail.ts:9-17](https://github.com/MadsLorentzen/ai-job-search/blob/120f476/.agents/skills/linkedin-search/cli/src/commands/detail.ts#L9-L17)) had no host check: after the URN and bare-id branches it took the first 6+-digit path segment from *any* string. A Greenhouse or Lever apply link - what a posting's own page hands out, and what a user pastes back into `detail` - was reduced to that number and the handler fetched `jobPosting/<number>` from LinkedIn: whatever job carried that id came back with exit 0, or `NOT_FOUND` if none did, never an error about the input. Every other portal CLI rejects an off-host detail URL with `BAD_ID` (#447 for jobindex, #430 for jobbank/jobdanmark/jobnet); linkedin was the one still trusting the digits.  ## Demonstration  Real handler, `fetch` stubbed to record the URL (script in #499):  | input | master requested | this branch | |---|---|---| | `https://boards.greenhouse.io/acme/jobs/4567890` | `.../jobPosting/4567890` | no request, exit 1 `BAD_ID` | | `https://jobs.lever.co/acme/1234567` | `.../jobPosting/1234567` | no request, exit 1 `BAD_ID` | | `https://dk.linkedin.com/jobs/view/data-scientist-9876543210/?trackingId=x` | `.../jobPosting/9876543210` | same |  ## What changes  - **`detail.ts`**: URLs are parsed with `new URL()`. A `linkedin.com` host (apex or any subdomain, scheme optional) plus a `/jobs/view/<slug-><id>` path yields the id. Other hosts, look-alike hosts (`linkedin.com.
  **Post-Mortem & Fix Analysis**:
  > Verified: 69 bun tests pass with the network blocked, `tsc --noEmit` clean, and against master's `src/` exactly the five cases you named fail (three `normalizeId` off-host cases, both foreign-URL handler/CLI cases). The URLs the CLI itself emits (`https://www.linkedin.com/jobs/view/<id>` from `helpers.ts`, and the guest-page hrefs of the `dk.linkedin.com/jobs/view/<slug>-<id>?trackingId=` shape) still parse, and `linkedin.com.evil.io` / `www.linkedin.com@evil.io` fall on the reject side. Python suite, lint and guards green on Windows. Merging; closes #499. 

- **Issue #499** (2026-09-27): **linkedin-search detail fetches whatever posting carries the digits in a URL on any other host (no host check in normalizeId)**
  *Symptoms*: Line references against `master` @ `120f476`.  ## Summary  `linkedin-search detail` accepts a URL on any host and fetches whatever LinkedIn posting carries the first 6+-digit path segment. `normalizeId` (`.agents/skills/linkedin-search/cli/src/commands/detail.ts:9-17`) has no host check: after the URN and bare-id branches it runs `input.match(/-(\d{6,})(?:[\/?]|$)/) || input.match(/\/(\d{6,})(?:[\/?]|$)/)` on the raw string. A Greenhouse or Lever apply link - the kind a posting's own page hands out, and what a user pastes back into `detail` - is reduced to its numeric segment and the handler requests `jobPosting/<that number>`.  ## Reproduction (network-free)  Drive the real exported handler with a `fetch` stub that records the URL and answers 404:  ```ts import { runDetail } from ".agents/skills/linkedin-search/cli/src/commands/detail.ts" const requested: string[] = [] globalThis.fetch = (async (u: string | URL | Request) => { requested.push(String(u)); return new Response("", { status: 404 }) }) as any await runDetail({ id: "https://boards.greenhouse.io/acme/jobs/4567890", format: "json" }) console.log(requested) ```  | input | request made on master | |---|---| | `https://boards.greenhouse.io/acme/jobs/4567890` | `https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/4567890` | | `https://jobs.lever.co/acme/1234567` | `.../jobPosting/1234567` | | `https://www.linkedin.com/jobs/view/4567890` | `.../jobPosting/4567890` (correct) |  With a live LinkedIn, the first two retur

- **Issue #498** (2026-09-28): **feat(verify_pdf): add --ascii-dates, the non-folding check for the documented date-range rule (#385)**
  *Symptoms*: The second half of Discussion #385, as flagged there today: the non-folding date check that the fold in #458 deliberately cannot be.  ## What was missing  `05-cv-templates.md`, "Date fields must be ASCII ranges", records a real Workday import that dropped a role's end date because `2016--2024` reaches the text layer as `2016<U+2013>2024`, and ends with **"Add this to the step 5d checks: after extracting the text layer, confirm every experience entry shows a start and an end separated by an ASCII hyphen."** Nothing in the workflow executes that. The natural probe, `--contains "2016-2024"`, failed identically for "en-dashed" and "absent" before #458 and passes on both since - the fold maps U+2013 back to `-` on purpose so keyword coverage matches what the template renders. So the one confirmed ATS import failure the guide documents had no mechanical check, which is the "documented machinery nothing executes" class.  ## What changes  - **`tools/verify_pdf.py`**: `--ascii-dates` and `find_non_ascii_date_ranges()`. Scans the **raw** layer (never `normalize_text()` output) for a year next to any of U+2010–U+2015 or U+2212, and fails listing each hit as `U+2013 in '<line>'`. A year on either side of the dash is enough, so `Mar 2016 – Jul 2016` and `2016 – Present` are caught; a numeric range with no year (`EUR 600k–1M`, which the guide says to keep as `--`) is not a date. Off by default; `--dump-text` is still written before the check fails. - **`apply.md` Step 5d**: the extraction 
  **Post-Mortem & Fix Analysis**:
  > `\s*` in `NON_ASCII_DATE_RANGE` also matches a newline, so a year at the end of one line joins a Unicode dash that opens the next line (`1988-1994\n– note`), and the flag reports a U+2013 date range although the date itself uses a single ASCII hyphen.  Matching horizontal whitespace only fixes it and keeps every case in the new tests green:  ```python NON_ASCII_DATE_RANGE = re.compile(     rf"{_YEAR}[^\S\n]*[{NON_ASCII_DASHES}]|[{NON_ASCII_DASHES}][^\S\n]*{_YEAR}" ) ```  A same-line `1988–1994` is still caught. A fixture for the newline case, which fails on this branch and passes with the change above:  ```python def test_year_ending_a_line_is_not_joined_to_the_next_lines_dash(self):     text = "Heading 1988-1994\n– note\n"     self.assertEqual(find_non_ascii_date_ranges(text), []) ``` 
  > Pushed `66122e3`: `[^\S\n]*` in place of `\s*`, yang2632's fixture plus the mirror case (`Six Sigma –\n2016 onwards`) and a same-line `1988 – 1994` case that must still be caught, credit in the test docstring, the CHANGELOG line, and the commit message. Suite, lint, and framework-version check green locally; the heading case now returns no hits and the mirror case likewise.
  > Verified `66122e3` on Windows: 500 OK, lint, guards and framework-version check green, CI 18/18. The heading and mirror newline cases return no hits, the spaced same-line `1988 – 1994` is still caught, and the credit is where it should be. Merging. Thanks both. 

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

### Incident Patch 1: `4f552084` (2026-09-29)
**Commit Message**: fix(freehire-search): decode HTML entities and trim whitespace in titles (#505)

Titles are indexed as the source ATS wrote them and toResult passed them
through untouched, so `detail intern-fullstack-amp-ai-innovation-noise-edaawqq2`
printed `Intern - Fullstack &amp; AI Innovation ` and the same title reached
`search` output. In a 93-result /scrape batch, 1 title carried `&amp;` and
3 ended in whitespace; /scrape Step 4.75 reads an undecoded entity in a
title as a half-working parser.

Run the title through the existing decodeHtmlEntities (already used for
detail descriptions) and trim it; an empty or whitespace-only title still
falls back to "(untitled)". Three new parsing.test.ts cases pin it; all
three fail on the old pass-through.

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `.agents/skills/freehire-search/cli/src/helpers.ts` (modified, +6/-2)
```diff
@@ -145,11 +145,15 @@ export interface JobDetailResult extends JobResult {
   description: string | null
 }
 
-/** Reshape a freehire job into the contract search-result fields. */
+/**
+ * Reshape a freehire job into the contract search-result fields. The title comes
+ * from the source ATS as indexed, which can carry HTML entities and stray
+ * whitespace ("Intern - Fullstack &amp; AI Innovation "), so it is decoded and trimmed.
+ */
 export function toResult(j: FreehireJob): JobResult {
   return {
     id: j.public_slug,
-    title: j.title || "(untitled)",
+    title: decodeHtmlEntities(j.title || "").trim() || "(untitled)",
     company: j.company || null,
     company_slug: j.company_slug || null,
     location: j.location || null,
```

**File**: `.agents/skills/freehire-search/cli/tests/parsing.test.ts` (modified, +18/-0)
```diff
@@ -49,6 +49,24 @@ describe("toResult — reshape into the portal-skill contract", () => {
     expect(r.date).toBeNull();
     expect(r.work_mode).toBeNull();
   });
+
+  test("decodes HTML entities and trims whitespace in the title", () => {
+    // Real title from the index (freehire slug intern-fullstack-amp-ai-innovation-noise-edaawqq2).
+    expect(toResult(job({ title: "Intern - Fullstack &amp; AI Innovation " })).title).toBe(
+      "Intern - Fullstack & AI Innovation",
+    );
+    expect(toResult(job({ title: "R&#38;D Engineer" })).title).toBe("R&D Engineer");
+    expect(toResult(job({ title: "SDE Intern - Frontend   " })).title).toBe("SDE Intern - Frontend");
+  });
+
+  test("a whitespace-only title still falls back to (untitled)", () => {
+    expect(toResult(job({ title: "   " })).title).toBe("(untitled)");
+    expect(toResult(job({ title: "" })).title).toBe("(untitled)");
+  });
+
+  test("detail inherits the cleaned title", () => {
+    expect(toDetail(job({ title: "Data &amp; Analytics Intern" })).title).toBe("Data & Analytics Intern");
+  });
 });
 
 describe("toDetail — adds cleaned description + enrichment", () => {
```

**File**: `CHANGELOG.md` (modified, +13/-0)
```diff
@@ -105,6 +105,19 @@ per-file diff commands.
 
 ### Fixed
 
+- **`freehire-search` titles no longer carry HTML entities or stray whitespace**
+  (`.agents/skills/freehire-search/cli/src/helpers.ts`) - titles are indexed as the source ATS
+  wrote them and `toResult` passed them through untouched, so `detail
+  intern-fullstack-amp-ai-innovation-noise-edaawqq2` printed `Intern - Fullstack &amp; AI
+  Innovation ` (trailing space included), and the same title reached `search` output. In a
+  93-result `/scrape` batch (`--country IN --seniority intern`), 1 title carried `&amp;` and 3
+  ended in whitespace. `/scrape` Step 4.75 reads undecoded entities in titles as a
+  half-working parser, so by that rule a single such posting marks a healthy portal
+  degraded. The title now goes through the CLI's existing `decodeHtmlEntities` (already used
+  for `detail` descriptions) and is trimmed; an empty or whitespace-only title still falls
+  back to `(untitled)`. Pinned by three new `parsing.test.ts` cases, which fail on the old
+  pass-through.
+
 - **`freehire-search detail` keeps the salary period, so a yearly figure no longer reads as
   monthly** (`.agents/skills/freehire-search/cli/src/helpers.ts`, `SKILL.md`) - `formatSalary`
   printed only the currency and amounts, although freehire's enrichment records the period:
```

---

### Incident Patch 2: `9187f894` (2026-09-29)
**Commit Message**: fix(freehire-search): keep the salary period so a yearly figure isn't read as monthly (#504)

formatSalary printed only the currency and amounts, although freehire's
enrichment records the pay period. `detail software-developer-trainee-codifi-fra635ux`
printed `INR 300000–300000` while the API returns `salary_period: "year"`
for that posting, so a yearly salary screened against a monthly figure
read as twelve times its real monthly value.

Append the period when freehire records one (`INR 300000–300000/year`,
`INR 12000/month`); a record without a period prints exactly as before.
Two new parsing.test.ts cases pin it; both fail on the old formatter.

Co-authored-by: Claude Opus 5.5 <noreply@anthropic.com>

**File**: `.agents/skills/freehire-search/SKILL.md` (modified, +2/-1)
```diff
@@ -126,7 +126,8 @@ bun run .agents/skills/freehire-search/cli/src/cli.ts detail <slug|url> [--forma
 `slug` is the `id` from a `search` result (e.g. `golang-zensar-2bxu6dxm`). You may
 also pass a full `https://freehire.me/jobs/<slug>` URL. Returns the full (HTML-stripped)
 description, skills, region/country, and — when the posting is enriched — seniority,
-category, employment type, and salary.
+category, employment type, and salary. `salary` keeps its period when freehire records
+one (`INR 300000–300000/year`, `INR 12000/month`); compare pay only in one period.
 
 Use it for a posting you already have a slug for — a tracked application, a shared
 link, or a closed posting search no longer lists. Re-fetching a hit that `search`
```

**File**: `.agents/skills/freehire-search/cli/src/helpers.ts` (modified, +9/-3)
```diff
@@ -107,6 +107,7 @@ export interface FreehireJob {
     salary_min?: number
     salary_max?: number
     salary_currency?: string
+    salary_period?: string // e.g. "year", "month"
   }
 }
 
@@ -176,12 +177,17 @@ export function toDetail(j: FreehireJob): JobDetailResult {
   }
 }
 
-/** Human-readable salary line from the enrichment fields, or null when absent. */
+/**
+ * Human-readable salary line from the enrichment fields, or null when absent.
+ * The period is kept when freehire records one ("INR 300000–300000/year"):
+ * without it a yearly figure is indistinguishable from a monthly one.
+ */
 function formatSalary(e: FreehireJob["enrichment"]): string | null {
   if (e.salary_min == null && e.salary_max == null) return null
   const cur = e.salary_currency ? `${e.salary_currency} ` : ""
-  if (e.salary_min != null && e.salary_max != null) return `${cur}${e.salary_min}–${e.salary_max}`
-  return `${cur}${e.salary_min ?? e.salary_max}`
+  const per = e.salary_period ? `/${e.salary_period}` : ""
+  if (e.salary_min != null && e.salary_max != null) return `${cur}${e.salary_min}–${e.salary_max}${per}`
+  return `${cur}${e.salary_min ?? e.salary_max}${per}`
 }
 
 function numericEntity(cp: number): string {
```

**File**: `.agents/skills/freehire-search/cli/tests/parsing.test.ts` (modified, +12/-0)
```diff
@@ -68,6 +68,18 @@ describe("toDetail — adds cleaned description + enrichment", () => {
     expect(d.salary).toBe("EUR 90000–120000");
   });
 
+  test("keeps the salary period, so a yearly figure is not read as monthly", () => {
+    const d = toDetail(
+      job({ enrichment: { salary_min: 300000, salary_max: 300000, salary_currency: "INR", salary_period: "year" } }),
+    );
+    expect(d.salary).toBe("INR 300000–300000/year");
+  });
+
+  test("a single-bound salary keeps its period too", () => {
+    const d = toDetail(job({ enrichment: { salary_min: 12000, salary_currency: "INR", salary_period: "month" } }));
+    expect(d.salary).toBe("INR 12000/month");
+  });
+
   test("null enrichment fields when the enrichment object is empty", () => {
     const d = toDetail(job({ enrichment: {} }));
     expect(d.seniority).toBeNull();
```

**File**: `CHANGELOG.md` (modified, +10/-0)
```diff
@@ -105,6 +105,16 @@ per-file diff commands.
 
 ### Fixed
 
+- **`freehire-search detail` keeps the salary period, so a yearly figure no longer reads as
+  monthly** (`.agents/skills/freehire-search/cli/src/helpers.ts`, `SKILL.md`) - `formatSalary`
+  printed only the currency and amounts, although freehire's enrichment records the period:
+  `detail software-developer-trainee-codifi-fra635ux` printed `INR 300000–300000` while the
+  API returns `salary_period: "year"` for that posting, so anyone screening pay against a
+  monthly figure read a yearly salary as a monthly one, twelve times its real monthly value.
+  The period is now appended when freehire records one (`INR 300000–300000/year`,
+  `INR 12000/month`); a record without a period prints exactly as before. Pinned by two new
+  `parsing.test.ts` cases, both failing on the old formatter.
+
 - **`robots_check` decodes curl output as UTF-8, so a non-ASCII response no longer reads as
   UNCONFIRMED on Windows** (`tools/robots_check.py`, `tests/test_robots_check.py`) -
   `_fetch()` ran curl with `text=True` and no encoding, so Python decoded the response with
```

---

### Incident Patch 3: `9bc71de5` (2026-09-29)
**Commit Message**: fix(robots-check): decode curl output as UTF-8 so non-ASCII responses stop reading as UNCONFIRMED on Windows (#506)

_fetch() ran curl with text=True and no encoding, so Python decoded the
response with the Windows ANSI code page. On a byte that code page leaves
undefined (0x81 in cp1252 and cp1254, 0x9e in cp1254) subprocess's pipe
reader thread died, stdout came back None, rpartition() raised
AttributeError, and the gate printed "UNCONFIRMED (AttributeError)". That
fails closed, but it blocked the browser-header retry 09-web-research.md
permits on hosts such as tr.indeed.com (a UTF-8 CJK Disallow rule) and
kap.org.tr (a UTF-8 Turkish 404 page).

Pin encoding='utf-8', errors='replace' on the call (RFC 9309: robots.txt
is UTF-8), as verify_pdf.py and verify_layout.py already do. Decision
rules and the fail-closed handling of real read failures are unchanged.

The regression tests swap curl for a child process that prints the real
bytes, so the actual subprocess decode path runs with _fetch's own
kwargs, and pin cp1254 when no encoding is passed so a UTF-8 host cannot
pass the bug by luck. Both fail on master.

Co-authored-by: Can Mugan <217335573+canmugan@users.noreply.github.com>


**File**: `CHANGELOG.md` (modified, +17/-0)
```diff
@@ -105,6 +105,23 @@ per-file diff commands.
 
 ### Fixed
 
+- **`robots_check` decodes curl output as UTF-8, so a non-ASCII response no longer reads as
+  UNCONFIRMED on Windows** (`tools/robots_check.py`, `tests/test_robots_check.py`) -
+  `_fetch()` ran curl with `text=True` and no encoding, so Python decoded the response with
+  the ANSI code page. On a byte that code page leaves undefined (0x81 in cp1252 and cp1254,
+  0x9e in cp1254) subprocess's pipe reader thread died, `stdout` came back `None`, and the
+  gate printed `UNCONFIRMED (AttributeError)` - failing closed, but blocking the
+  browser-header retry `09-web-research.md` permits. Reproduced through the CLI on real
+  hosts: tr.indeed.com's robots.txt carries `Disallow: /職涯貼士/` (職 is `e8 81 b7`), and
+  kap.org.tr answers `/robots.txt` with a UTF-8 HTML 404 whose "A.Ş." carries `c5 9e`. The
+  call now pins `encoding='utf-8', errors='replace'` (RFC 9309: robots.txt is UTF-8), as
+  `verify_pdf.py` and `verify_layout.py` already do. That also closes a silent fail-open: a
+  UTF-8 rule whose bytes the code page does define (`Disallow: /şirket/` under cp1254)
+  decoded as `/ÅŸirket/`, never matched, and read as allowed. Decision rules are unchanged.
+  Two new tests swap curl for a child process that prints those bytes and pin cp1254 when no
+  encoding is passed, so the failure does not depend on the host's locale; both fail without
+  the fix.
+
 - **The compile-warning check covers `tests/*.py` too** (`tests/test_verify_pdf.py`,
   `tests/test_verify_layout.py`) - `FindNonAsciiDateRangesTests`' docstring quotes the regex
   `\s*` unescaped, so Python 3.12+ prints a `SyntaxWarning` for the invalid escape `\s` when
```

**File**: `tests/test_robots_check.py` (modified, +54/-0)
```diff
@@ -259,6 +259,60 @@ def spy(url, ua):
         self.assertEqual(seen[0], "https://x.example/robots.txt")
 
 
+class TestNonAsciiCurlOutput(unittest.TestCase):
+    """curl's output is decoded as UTF-8, never the locale's code page.
+
+    With text=True and no encoding, Windows decoded with the locale's code page.
+    Under cp1254 (Turkish) the bytes 0x81 and 0x9e are undefined, so the pipe
+    reader thread died, stdout came back None, and the gate printed
+    "UNCONFIRMED (AttributeError)" for policies it never read - blocking a
+    retry those policies allow (reproduced 2026-09-29).
+    """
+
+    def _gate_with_curl_output(self, url, body, status):
+        """gate(url) with curl swapped for a process that prints `body` and the
+        status the way curl's -w does, decoded however _fetch asks."""
+        import robots_check
+
+        # A fixture cp1254 can decode would pass without the fix.
+        self.assertRaises(UnicodeDecodeError, body.decode, "cp1254")
+        raw = body + b"\n" + str(status).encode()
+        real_run = subprocess.run
+
+        def fake_curl(argv, **kwargs):
+            # Unpinned text mode takes the host locale's code page. Pin the
+            # reporter's, so a UTF-8 host (CI) cannot pass the bug by luck.
+            if kwargs.get("text") and not kwargs.get("encoding"):
+                kwargs["encoding"] = "cp1254"
+            write = "import sys; sys.stdout.buffer.write(bytes.fromhex(sys.argv[1]))"
+            return real_run([sys.executable, "-c", write, raw.hex()], **kwargs)
+
+        robots_check.subprocess.run = fake_curl
+        try:
+            return robots_check.gate(url)
+        finally:
+            robots_check.subprocess.run = real_run
+
+    def test_rule_holding_a_cp1254_undefined_byte_is_read_and_obeyed(self):
+        """The rule is verbatim from tr.indeed.com/robots.txt: 職 is e8 81 b7.
+        DISALLOWED on its path proves it was decoded, not merely survived."""
+        body = "User-agent: *\nDisallow: /職涯貼士/\n".encode("utf-8")
+        rc, msg = self._gate_with_curl_output("https://tr.indeed.example/cmp/x/reviews", body, 200)
+        self.assertEqual(rc, 0, msg)
+        self.assertIn("robots.txt permits this path", msg)
+        rc, msg = self._gate_with_curl_output("https://tr.indeed.example/職涯貼士/x", body, 200)
+        self.assertEqual(rc, 1, msg)
+        self.assertIn("DISALLOWED", msg)
+
+    def test_404_page_holding_a_cp1254_undefined_byte_still_means_no_policy(self):
+        """kap.org.tr answers /robots.txt with a UTF-8 HTML 404 that names
+        "Merkezi Kayıt Kuruluşu A.Ş." - Ş is c5 9e."""
+        body = '<html lang="tr"><body>Merkezi Kayıt Kuruluşu A.Ş.</body></html>'.encode("utf-8")
+        rc, msg = self._gate_with_curl_output("https://kap.example/tr/sirket-bilgileri", body, 404)
+        self.assertEqual(rc, 0, msg)
+        self.assertIn("no robots.txt published", msg)
+
+
 
 if __name__ == "__main__":
     unittest.main()
```

**File**: `tools/robots_check.py` (modified, +4/-1)
```diff
@@ -37,7 +37,10 @@ def _fetch(url, ua):
     r = subprocess.run(
         ['curl', '-sS', '-L', '--max-redirs', '5', '--max-time', '12', '-A', ua,
          '-H', 'Accept: text/plain,*/*', '-w', '\n%{http_code}', '--', url],
-        capture_output=True, text=True, timeout=20)
+        # robots.txt is UTF-8 (RFC 9309). Unpinned, Turkish Windows decoded it as
+        # cp1254, where bytes like 0x81 are undefined: the pipe reader thread died,
+        # stdout came back None, and tr.indeed.com read as UNCONFIRMED.
+        capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=20)
     if r.returncode != 0:
         raise RuntimeError('curl exit %d' % r.returncode)
     body, _, code = r.stdout.rpartition('\n')
```

---

### Incident Patch 4: `97e25757` (2026-09-29)
**Commit Message**: fix(tests): escape the regex in test_verify_pdf's docstring and compile-check tests/*.py (#503)

FindNonAsciiDateRangesTests' docstring (from #498) quotes the regex `\s*`
in a non-raw string. `\s` is an invalid escape sequence, so Python 3.12+
prints a SyntaxWarning for it (CPython gh-98401) when
tests/test_verify_pdf.py is compiled. It is in this repo's own CI log
for a45bbd1 on 3.12, 3.13 and 3.14, at tests/test_verify_pdf.py:75, while
the run stays green. Under `-W error::SyntaxWarning` the module fails to
import and the whole test_verify_pdf suite drops out of the run.

Escaped in the docstring. ToolsCompileWithoutWarnings (#480) only compiled
tools/*.py, which is why this got through; it now compiles tests/*.py too.
With the unescaped docstring it fails naming tests/test_verify_pdf.py, and
it passes with the fix.

Verification on Python 3.10, 3.11, 3.12, 3.13 and 3.14, from a clean
bytecode cache: `python -W error::SyntaxWarning -m unittest discover -s
tests -t .` OK (501 tests, the same count as master),
`tools/lint_skills.py`, `tools/check_framework_version.py`,
`tools/security_guards.py`.

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -105,6 +105,14 @@ per-file diff commands.
 
 ### Fixed
 
+- **The compile-warning check covers `tests/*.py` too** (`tests/test_verify_pdf.py`,
+  `tests/test_verify_layout.py`) - `FindNonAsciiDateRangesTests`' docstring quotes the regex
+  `\s*` unescaped, so Python 3.12+ prints a `SyntaxWarning` for the invalid escape `\s` when
+  the test module is compiled. It shows up in this repo's own CI log on 3.12, 3.13 and 3.14 while
+  the run stays green, and under `-W error::SyntaxWarning` the module fails to import. Escaped
+  in the docstring; `ToolsCompileWithoutWarnings` now compiles `tests/*.py` as well as
+  `tools/*.py` and fails on the unescaped version.
+
 - **`linkedin-search detail` no longer fetches an unrelated posting for a URL on another
   host** - `normalizeId` took the first 6+-digit path segment from *any* URL, so a
   Greenhouse or Lever apply link (the kind a posting's own page hands out, and what a user
```

**File**: `tests/test_verify_layout.py` (modified, +8/-4)
```diff
@@ -177,15 +177,19 @@ class ToolsCompileWithoutWarnings(unittest.TestCase):
     the warning lands in the middle of a verification report. Compiling is a
     pure `compile()` over the source text - no cache file, no temp file - so the
     check costs nothing and covers every `tools/*.py`, guarding the next
-    docstring that quotes a macro too.
+    docstring that quotes a macro too. It covers `tests/*.py` as well: a test
+    docstring that quotes a regex (`\\s*` in `test_verify_pdf.py`) warned in CI
+    on every matrix Python while the run stayed green.
     """
 
     def test_sources_have_no_invalid_escape_sequences(self):
         import warnings
 
         tools_dir = Path(verify_layout.__file__).resolve().parent
-        sources = sorted(tools_dir.glob("*.py"))
+        tests_dir = Path(__file__).resolve().parent
+        sources = sorted(tools_dir.glob("*.py")) + sorted(tests_dir.glob("*.py"))
         self.assertIn(Path(verify_layout.__file__).resolve(), sources)
+        self.assertIn(Path(__file__).resolve(), sources)
         offenders: dict[str, list[str]] = {}
         for source in sources:
             with warnings.catch_warnings(record=True) as caught:
@@ -197,8 +201,8 @@ def test_sources_have_no_invalid_escape_sequences(self):
                 if issubclass(w.category, (SyntaxWarning, DeprecationWarning))
             ]
             if syntax:
-                offenders[source.name] = syntax
-        self.assertEqual({}, offenders, "tools/*.py warn about invalid escapes when compiled")
+                offenders[f"{source.parent.name}/{source.name}"] = syntax
+        self.assertEqual({}, offenders, "tools/*.py or tests/*.py warn about invalid escapes when compiled")
 
 
 if __name__ == "__main__":
```

**File**: `tests/test_verify_pdf.py` (modified, +1/-1)
```diff
@@ -72,7 +72,7 @@ class FindNonAsciiDateRangesTests(unittest.TestCase):
     The fold that makes `--contains "2016-2024"` pass on that layer (#458) is
     what makes `--contains` unable to detect it - so this check never folds.
 
-    The newline cases are yang2632's finding on the PR: `\s*` between year and
+    The newline cases are yang2632's finding on the PR: `\\s*` between year and
     dash also matched a line break, so a heading ending in an ASCII date joined
     a dash that merely opened the next line.
     """
```

---

### Incident Patch 5: `8cbab682` (2026-09-27)
**Commit Message**: fix(linkedin-search): reject detail URLs on other hosts instead of fetching the posting with that number (#500)

normalizeId took the first 6+-digit path segment from ANY URL, so a
Greenhouse or Lever apply link - the kind a posting's own page hands out
and a user pastes back into detail - was reduced to that number and the
handler fetched jobPosting/<number> from LinkedIn: whatever job carried
that id came back with exit 0, or NOT_FOUND if none did, never an error
about the input. Driving the real handler with a stubbed fetch,
https://boards.greenhouse.io/acme/jobs/4567890 requested
.../jobPosting/4567890. Every other portal CLI rejects an off-host detail
URL with BAD_ID (the #447 shape); linkedin was the one still trusting the
digits.

Parse URLs for real: a linkedin.com host (apex or any subdomain, scheme
optional) plus a /jobs/view/<slug->id path yields the id; other hosts,
look-alike and userinfo hosts, and linkedin.com profile or search URLs
exit 1 with the stderr-JSON BAD_ID contract before any request. Bare
ids, URNs, and slash-free title slugs are unchanged.

Four new normalizeId cases and a new detail-input.test.ts that drives
runDetail and the CLI with fetch stubbed; fiv

**File**: `.agents/skills/linkedin-search/cli/src/commands/detail.ts` (modified, +34/-7)
```diff
@@ -5,15 +5,42 @@ export interface DetailOpts {
   format: "json" | "plain"
 }
 
-/** Accept a raw job ID, a job-view URL, or a job URN. */
+const LINKEDIN_HOST = /(^|\.)linkedin\.com$/i
+
+/**
+ * Accept a raw job ID, a job URN, a LinkedIn job-view URL (any linkedin.com
+ * host, with or without scheme), or a bare title slug ending in the ID.
+ *
+ * A URL on any other host is rejected. The previous pattern took the first
+ * 6+-digit path segment from ANY URL, so a Greenhouse or Lever apply link -
+ * the kind a posting's own page hands out - fetched whatever LinkedIn
+ * posting happened to carry that number and printed it with exit 0. Host and
+ * path are read through real URL parsing, so look-alike hosts
+ * (linkedin.com.evil.io) and userinfo tricks (linkedin.com@evil.io) fall on
+ * the reject side too.
+ */
 export function normalizeId(input: string): string | null {
-  const urn = input.match(/urn:li:jobPosting:(\d+)/)
+  const trimmed = input.trim()
+  const urn = trimmed.match(/urn:li:jobPosting:(\d+)/)
   if (urn) return urn[1]
-  const url = input.match(/-(\d{6,})(?:[\/?]|$)/) || input.match(/\/(\d{6,})(?:[\/?]|$)/)
-  if (url) return url[1]
-  const bare = input.match(/^\d{6,}$/)
-  if (bare) return input
-  return null
+  if (/^\d{6,}$/.test(trimmed)) return trimmed
+
+  const hasScheme = /^https?:\/\//i.test(trimmed)
+  if (hasScheme || /^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(trimmed)) {
+    let parsed: URL
+    try {
+      parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`)
+    } catch {
+      return null
+    }
+    if (!LINKEDIN_HOST.test(parsed.hostname)) return null
+    const path = parsed.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})\/?$/)
+    return path ? path[1] : null
+  }
+
+  // A scheme- and slash-free slug such as "software-engineer-1234567890".
+  const slug = trimmed.match(/^[a-z0-9-]*-(\d{6,})$/i)
+  return slug ? slug[1] : null
 }
 
 export async function runDetail(opts: DetailOpts): Promise<number> {
```

**File**: `.agents/skills/linkedin-search/cli/tests/detail-input.test.ts` (added, +72/-0)
```diff
@@ -0,0 +1,72 @@
+import { afterEach, describe, expect, test } from "bun:test";
+import { runDetail } from "../src/commands/detail";
+import { DETAIL_URL } from "../src/helpers";
+import { runCLI } from "./helpers";
+
+// The real command path, not the parser in isolation: `detail` must never
+// send a request for a URL that is not a LinkedIn job view. Before the host
+// check, a Greenhouse apply link pasted from a posting was reduced to its
+// 7-digit path segment and the handler fetched LinkedIn posting 4567890 -
+// an unrelated job, printed with exit 0. fetch is stubbed throughout; no
+// test here touches the network.
+
+const originalFetch = globalThis.fetch;
+const originalStderrWrite = process.stderr.write;
+
+afterEach(() => {
+  globalThis.fetch = originalFetch;
+  process.stderr.write = originalStderrWrite;
+});
+
+function recordingFetch(): string[] {
+  const requested: string[] = [];
+  globalThis.fetch = (async (input: string | URL | Request) => {
+    requested.push(String(input));
+    return new Response("", { status: 404 });
+  }) as unknown as typeof fetch;
+  return requested;
+}
+
+function captureStderr(): string[] {
+  const out: string[] = [];
+  process.stderr.write = ((chunk: string | Uint8Array) => {
+    out.push(String(chunk));
+    return true;
+  }) as typeof process.stderr.write;
+  return out;
+}
+
+describe("detail input on the real handler path", () => {
+  test("a foreign job-board URL is rejected with BAD_ID before any request", async () => {
+    const requested = recordingFetch();
+    const stderr = captureStderr();
+
+    const rc = await runDetail({ id: "https://boards.greenhouse.io/acme/jobs/4567890", format: "json" });
+
+    expect(rc).toBe(1);
+    expect(requested).toEqual([]);
+    expect(JSON.parse(stderr.join("").trim())).toMatchObject({ code: "BAD_ID" });
+  });
+
+  test("a LinkedIn job URL builds the fetch URL from the extracted id", async () => {
+    const requested = recordingFetch();
+    captureStderr();
+
+    const rc = await runDetail({
+      id: "https://dk.linkedin.com/jobs/view/data-scientist-9876543210/?trackingId=x",
+      format: "json",
+    });
+
+    expect(rc).toBe(1); // the stub answers 404 -> NOT_FOUND, after the request was made
+    expect(requested).toEqual([`${DETAIL_URL}/9876543210`]);
+  });
+});
+
+describe("detail input through the CLI", () => {
+  test("exits 1 with the stderr-JSON BAD_ID contract for a foreign URL", async () => {
+    const result = await runCLI(["detail", "https://jobs.lever.co/acme/1234567"]);
+
+    expect(result.exitCode).toBe(1);
+    expect(JSON.parse(result.stderr)).toMatchObject({ code: "BAD_ID" });
+  });
+});
```

**File**: `.agents/skills/linkedin-search/cli/tests/parsing.test.ts` (modified, +24/-0)
```diff
@@ -267,6 +267,30 @@ describe("normalizeId", () => {
     expect(normalizeId("https://dk.linkedin.com/jobs/view/data-scientist-9876543210/")).toBe("9876543210");
   });
 
+  test("accepts a scheme-less linkedin.com job URL and a bare title slug", () => {
+    expect(normalizeId("www.linkedin.com/jobs/view/1234567890")).toBe("1234567890");
+    expect(normalizeId("software-engineer-1234567890")).toBe("1234567890");
+  });
+
+  test("rejects a job URL on any other host instead of extracting its digits", () => {
+    // The old pattern took the first 6+-digit path segment from any URL, so an
+    // ATS apply link fetched an unrelated LinkedIn posting with that number.
+    expect(normalizeId("https://boards.greenhouse.io/acme/jobs/4567890")).toBeNull();
+    expect(normalizeId("https://jobs.lever.co/acme/1234567")).toBeNull();
+    expect(normalizeId("https://example.com/jobs/view/1234567890")).toBeNull();
+  });
+
+  test("rejects look-alike and userinfo hosts", () => {
+    expect(normalizeId("https://linkedin.com.evil.io/jobs/view/1234567890")).toBeNull();
+    expect(normalizeId("https://notlinkedin.com/jobs/view/1234567890")).toBeNull();
+    expect(normalizeId("https://www.linkedin.com@evil.io/jobs/view/1234567890")).toBeNull();
+  });
+
+  test("rejects a linkedin.com URL that is not a job view", () => {
+    expect(normalizeId("https://www.linkedin.com/in/someone-1234567890/")).toBeNull();
+    expect(normalizeId("https://www.linkedin.com/jobs/search/?currentJobId=1234567890")).toBeNull();
+  });
+
   test("returns null for non-job URLs and invalid strings", () => {
     expect(normalizeId("https://www.linkedin.com/feed/")).toBeNull();
     expect(normalizeId("not-a-url")).toBeNull();
```

**File**: `CHANGELOG.md` (modified, +17/-0)
```diff
@@ -84,6 +84,23 @@ per-file diff commands.
 
 ### Fixed
 
+- **`linkedin-search detail` no longer fetches an unrelated posting for a URL on another
+  host** - `normalizeId` took the first 6+-digit path segment from *any* URL, so a
+  Greenhouse or Lever apply link (the kind a posting's own page hands out, and what a user
+  pastes back into `detail`) was reduced to that number and the handler fetched
+  `jobPosting/<number>` from LinkedIn: whatever job carried that id came back, printed with
+  exit 0, or `NOT_FOUND` if none did - never an error about the input. Demonstrated by driving
+  the real handler with a stubbed fetch: `https://boards.greenhouse.io/acme/jobs/4567890`
+  requested `.../jobPosting/4567890`. Every other portal CLI rejects an off-host detail URL
+  with `BAD_ID` (the #447 shape); linkedin was the one still trusting the digits. URLs are
+  now parsed for real: a `linkedin.com` host (apex or any subdomain, scheme optional) plus a
+  `/jobs/view/<slug-><id>` path yields the id, and anything else - other hosts, look-alike and
+  userinfo hosts, a linkedin.com profile or search URL - exits 1 with the stderr-JSON
+  `BAD_ID` contract before any request. Bare ids, URNs, and slash-free title slugs are
+  unchanged. Pinned by four new `normalizeId` cases and a new `detail-input.test.ts` that
+  drives `runDetail` and the CLI with fetch stubbed; the off-host cases fail on the old
+  pattern.
+
 - **`/rank` tracker matching preserves Unicode company and role names**
   (`tools/rank_state.py`, `tests/test_rank_state.py`) - ASCII-only normalization
   collapsed distinct non-Latin roles to the same empty value and dropped
```

---

### Incident Patch 6: `a62af6a0` (2026-09-27)
**Commit Message**: fix(verify-layout): escape the docstring's LaTeX macro so the tool stops emitting SyntaxWarning (#480)

`tools/verify_layout.py`'s module docstring explains which documents trigger
the Poppler `-bbox` crash, and names the macro whose absence causes it:
`\hypersetup{pdftitle=...}`. In a non-raw docstring `\h` is an invalid escape
sequence, so compiling the module prints

    SyntaxWarning: "\h" is an invalid escape sequence.
    Such sequences will not work in the future. Did you mean "\\h"?

on Python 3.12+ (CPython gh-98401 promoted the long-standing
DeprecationWarning to a SyntaxWarning). The 3.15 language reference still
documents the sequence as a SyntaxWarning, with a SyntaxError only "in a
future Python version".

This is on the real path, not a constructed one: /apply Step 5b runs
`python3 tools/verify_layout.py <pdf>` once per document, so the first
invocation after any source change prints the warning into the middle of the
layout report a user is reading to judge their CV. It is also visible in this
repo's own CI log, where `python -m unittest discover -s tests -t . -v` prints
it above the test results.

Reproduce on master:

    python3 -W error::SyntaxWarning -c "compil

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -132,6 +132,17 @@ per-file diff commands.
   The standard `date`-first header already worked; regression coverage checks
   all three column orders with and without a BOM.
 
+- **`verify_layout.py` no longer emits a `SyntaxWarning` on every run** (`tools/verify_layout.py`,
+  `tests/test_verify_layout.py`) - the module docstring names the macro whose absence triggers the
+  Poppler `-bbox` crash, `\hypersetup{pdftitle=...}`, and a bare `\h` in a non-raw docstring is an
+  invalid escape sequence. Python 3.12+ prints `SyntaxWarning: "\h" is an invalid escape sequence`
+  the first time the module is compiled (CPython gh-98401) - it shows up in this repo's own CI log,
+  and in the middle of `/apply` Step 5b's layout report. The 3.15 language reference still
+  documents the sequence as a `SyntaxWarning`, with a `SyntaxError` only in a future Python
+  version. Escaped in the docstring; the new `ToolsCompileWithoutWarnings` case compiles the
+  source of every `tools/*.py` with warnings captured and fails on the unescaped version, so the
+  next docstring that quotes a LaTeX macro is caught too.
+
 - **`/apply` Step 5b now actually runs the page-count check it claimed Step 5d ran**
   (`.claude/commands/apply.md`, `tests/test_apply_page_count.py`) - the 5b prose said
   "Page count is not checked here - that is `verify_pdf.py --pages`'s job, and Step 5d already
```

**File**: `tests/test_verify_layout.py` (modified, +37/-0)
```diff
@@ -16,6 +16,7 @@
 from pathlib import Path
 from unittest.mock import patch
 
+from tools import verify_layout
 from tools.verify_layout import Line, Page, find_orphans, main, parse_pdf, report
 
 A4_HEIGHT = 842.0
@@ -164,5 +165,41 @@ def test_extractor_failure_exits_2_not_1(self):
             self.assertIn("skipped:", err.getvalue())
 
 
+class ToolsCompileWithoutWarnings(unittest.TestCase):
+    """Every tool's source must compile clean.
+
+    `verify_layout.py`'s docstring documents LaTeX macros, and a bare `\\h` in a
+    non-raw docstring is an invalid escape sequence: Python 3.12+ emits a
+    SyntaxWarning when the module is compiled (CPython gh-98401), 3.10 and 3.11
+    a DeprecationWarning, so the test records both; the language
+    reference still documents it as a warning in 3.15, with a SyntaxError only
+    in a future Python version. The tool is run per-document from `/apply`, so
+    the warning lands in the middle of a verification report. Compiling is a
+    pure `compile()` over the source text - no cache file, no temp file - so the
+    check costs nothing and covers every `tools/*.py`, guarding the next
+    docstring that quotes a macro too.
+    """
+
+    def test_sources_have_no_invalid_escape_sequences(self):
+        import warnings
+
+        tools_dir = Path(verify_layout.__file__).resolve().parent
+        sources = sorted(tools_dir.glob("*.py"))
+        self.assertIn(Path(verify_layout.__file__).resolve(), sources)
+        offenders: dict[str, list[str]] = {}
+        for source in sources:
+            with warnings.catch_warnings(record=True) as caught:
+                warnings.simplefilter("always")
+                compile(source.read_text(encoding="utf-8"), str(source), "exec")
+            syntax = [
+                str(w.message)
+                for w in caught
+                if issubclass(w.category, (SyntaxWarning, DeprecationWarning))
+            ]
+            if syntax:
+                offenders[source.name] = syntax
+        self.assertEqual({}, offenders, "tools/*.py warn about invalid escapes when compiled")
+
+
 if __name__ == "__main__":
     unittest.main()
```

**File**: `tools/verify_layout.py` (modified, +1/-1)
```diff
@@ -32,7 +32,7 @@
 all, and Poppler 26.0x before 26.05 aborts `-bbox`/`-bbox-layout`/`-htmlmeta` on a PDF
 whose Info dictionary carries an empty string in any field - which `hyperref` writes for
 every field it does not set, so any `lualatex`/`pdflatex` document built with `hyperref`
-and no `\hypersetup{pdftitle=...}` triggers a real Poppler crashing on a legal PDF (#451).
+and no `\\hypersetup{pdftitle=...}` triggers a real Poppler crashing on a legal PDF (#451).
 Line height serves
 as a font-size proxy to spot section headings; left edge (xMin) separates bullet lines
 from entry headers.
```

---

### Incident Patch 7: `120f476a` (2026-09-21)
**Commit Message**: fix(rank): preserve Unicode identity in tracker matching (#486)

**File**: `CHANGELOG.md` (modified, +9/-0)
```diff
@@ -84,6 +84,15 @@ per-file diff commands.
 
 ### Fixed
 
+- **`/rank` tracker matching preserves Unicode company and role names**
+  (`tools/rank_state.py`, `tests/test_rank_state.py`) - ASCII-only normalization
+  collapsed distinct non-Latin roles to the same empty value and dropped
+  entirely non-Latin companies from tracker exclusions. Match using Unicode
+  case folding and NFC normalization, retaining letters, numbers, and combining
+  marks while continuing to ignore punctuation and spacing. CLI regressions
+  use the standard tracker header and cover distinct names, tracked matches,
+  equivalent accent encodings, and the existing ASCII matching behavior.
+
 - **The Python tools no longer crash on Windows when a posting, company, CV line or file
   name falls outside the ANSI code page** (`tools/rank_state.py`, `tools/job_key.py`,
   `tools/verify_pdf.py`, `tools/verify_layout.py`, `tools/convert_salary_excel.py`,
```

**File**: `tests/test_rank_state.py` (modified, +37/-0)
```diff
@@ -10,6 +10,7 @@
 migration, the deadline null-is-not-a-correction rule, and verbatim
 strengths/gaps persistence.
 """
+import csv
 import json
 import subprocess
 import sys
@@ -122,6 +123,42 @@ def test_tracker_exclusion_handles_utf8_bom_and_reordered_columns(self):
                     self.assertEqual([row["key"] for row in out["selected"]], ["b"])
                     self.assertEqual(out["excluded_by_tracker"], 1)
 
+    def test_tracker_exclusion_preserves_unicode_identity(self):
+        # Use the standard /outcome header and the real candidates CLI.
+        header = (
+            "date,company,sector,role,role_type,channel,status,contact_person,"
+            "fit_rating,notes,cv_file,cover_letter_file,source,deadline"
+        ).split(",")
+        cases = (
+            # Tracked company/role, candidate company/title, expected exclusion.
+            ("Acme", "设计师", "Acme", "工程师", False),
+            ("Acme", "工程师", "Acme", "工程师", True),
+            ("腾讯", "Engineer", "腾讯", "Engineer", True),
+            ("腾讯", "Engineer", "阿里巴巴", "Engineer", False),
+            ("Компания", "Инженер", "КОМПАНИЯ", "ИНЖЕНЕР", True),
+            ("Café", "Engineer", "Cafe\u0301", "Engineer", True),
+            ("Straße", "Engineer", "STRASSE", "Engineer", True),
+            ("कला Labs", "Engineer", "कल Labs", "Engineer", False),
+            ("Acme, Inc.", "SOC Analyst", "ACME_INC", "soc-analyst", True),
+        )
+        tracker = self.tmp / "tracker.csv"
+        for company, role, candidate_company, title, excluded in cases:
+            with self.subTest(tracked=(company, role), candidate=(candidate_company, title)):
+                self.write_state({
+                    "candidate": entry(company=candidate_company, title=title),
+                    "other": entry(company="Other", title="Untracked role"),
+                })
+                with tracker.open("w", encoding="utf-8", newline="") as fh:
+                    writer = csv.DictWriter(fh, fieldnames=header)
+                    writer.writeheader()
+                    writer.writerow({"date": TODAY, "company": company, "role": role, "status": "applied"})
+                out = self.run_tool("candidates", "--tracker", str(tracker))
+                self.assertEqual(
+                    [row["key"] for row in out["selected"]],
+                    ["other"] if excluded else ["candidate", "other"],
+                )
+                self.assertEqual(out["excluded_by_tracker"], int(excluded))
+
     def test_focus_filters_on_title_company_and_stored_fit_notes(self):
         self.write_state(
             {
```

**File**: `tools/rank_state.py` (modified, +8/-1)
```diff
@@ -42,6 +42,7 @@
 import re
 import sys
 import tempfile
+import unicodedata
 from datetime import date, timedelta
 from pathlib import Path
 
@@ -97,7 +98,13 @@ def parse_iso(value) -> date | None:
 
 
 def norm(text) -> str:
-    return re.sub(r"[^a-z0-9]", "", str(text or "").lower())
+    """Ignore case and separators without discarding non-Latin identity."""
+    text = unicodedata.normalize("NFC", str(text or "").casefold())
+    # Combining marks can distinguish names even after NFC (e.g. Indic vowels).
+    return "".join(
+        char for char in text
+        if char.isalnum() or unicodedata.category(char).startswith("M")
+    )
 
 
 def tracker_pairs(path: Path) -> set[tuple[str, str]]:
```

---

### Incident Patch 8: `ba4f2397` (2026-09-21)
**Commit Message**: fix(tools): write UTF-8 on stdout so non-Latin postings stop crashing on Windows (#490)

A piped stdout on Windows defaults to the ANSI code page (cp1252 on most
Western installs). rank_state.py printed titles and companies with
ensure_ascii=False, so one Cyrillic, CJK, Devanagari, Polish or Turkish
posting ended /rank with UnicodeEncodeError. job_key --audit, salary_lookup,
convert_salary_excel and verify_layout failed the same way.

Each tool now reconfigures stdout and stderr to UTF-8 at entry. The new
tests run every tool in a child process with a cp1252 stdout forced through
PYTHONIOENCODING, so Linux CI reproduces the Windows failure.


Claude-Session: https://claude.ai/code/session_01WPXraLZ4i7UW4xGn9tVcox

Co-authored-by: Claude Fable 5.1 <noreply@anthropic.com>

**File**: `CHANGELOG.md` (modified, +16/-0)
```diff
@@ -84,6 +84,22 @@ per-file diff commands.
 
 ### Fixed
 
+- **The Python tools no longer crash on Windows when a posting, company, CV line or file
+  name falls outside the ANSI code page** (`tools/rank_state.py`, `tools/job_key.py`,
+  `tools/verify_pdf.py`, `tools/verify_layout.py`, `tools/convert_salary_excel.py`,
+  `salary_lookup.py`, `tests/test_tools_utf8_output.py`) - a piped stdout on Windows
+  defaults to the ANSI code page (cp1252 on most Western installs), and that is how Claude
+  Code runs every tool. `/rank`'s candidate listing printed titles and companies with
+  `ensure_ascii=False`, so a single Cyrillic, CJK, Devanagari, Polish or Turkish posting
+  ended the run with `UnicodeEncodeError` before any output reached the workflow; the key
+  audit, the salary lookup, the salary converter and the layout report failed the same way.
+  Each tool now switches stdout and stderr to UTF-8 at entry, which also stops Danish and
+  other Western accents from arriving as cp1252 bytes. The regression tests run every
+  tool in a child process with a cp1252 stdout forced through `PYTHONIOENCODING`, so the
+  Linux CI job reproduces the Windows failure; all seven fail without the fix. The
+  subprocess helpers in `tests/test_rank_state.py` and `tests/test_job_key.py` now decode
+  child output as UTF-8 to match.
+
 - **`/rank` rejects invalid score dimensions before updating an entry**
   (`tools/rank_state.py`, `tests/test_rank_state.py`) - enforce the rubric's
   inclusive 0-100 range and reject booleans, NaN, and infinities. Invalid results
```

**File**: `salary_lookup.py` (modified, +14/-0)
```diff
@@ -385,7 +385,21 @@ def print_validation_report(errors, warnings):
     return 0
 
 
+def _force_utf8_output() -> None:
+    """Write UTF-8 whatever the host's default encoding is.
+
+    A piped stdout on Windows defaults to the ANSI code page (cp1252 on most
+    Western installs), so printing a company, title or file name outside it
+    raised UnicodeEncodeError before the workflow saw any output.
+    """
+    for stream in (sys.stdout, sys.stderr):
+        reconfigure = getattr(stream, "reconfigure", None)  # absent on a StringIO under test
+        if reconfigure:
+            reconfigure(encoding="utf-8")
+
+
 def main():
+    _force_utf8_output()
     parser = argparse.ArgumentParser(description="Salary Benchmark Lookup")
     parser.add_argument("company", nargs="?", help="Company name to search for")
     parser.add_argument("--city", help="Filter by city name")
```

**File**: `tests/test_job_key.py` (modified, +2/-2)
```diff
@@ -76,7 +76,7 @@ def key_for(self, company, url="https://example.com/jobs/123456"):
         proc = subprocess.run(
             [sys.executable, str(TOOL), "--company", company,
              "--title", "Software Engineer", "--url", url],
-            capture_output=True, text=True, check=True,
+            capture_output=True, text=True, encoding="utf-8", check=True,
         )
         return proc.stdout.strip()
 
@@ -126,7 +126,7 @@ def run_audit(self, seen: dict) -> tuple[dict, int]:
             json.dump({"seen": seen}, fh)
             path = fh.name
         proc = subprocess.run(
-            [sys.executable, str(TOOL), "--audit", path], capture_output=True, text=True
+            [sys.executable, str(TOOL), "--audit", path], capture_output=True, text=True, encoding="utf-8"
         )
         return json.loads(proc.stdout), proc.returncode
 
```

**File**: `tests/test_rank_state.py` (modified, +2/-1)
```diff
@@ -52,6 +52,7 @@ def run_tool(self, *args, expect=0):
             [sys.executable, str(TOOL), *args, "--state", str(self.state), "--today", TODAY],
             capture_output=True,
             text=True,
+            encoding="utf-8",
         )
         self.assertEqual(proc.returncode, expect, proc.stderr)
         return json.loads(proc.stdout)
@@ -148,7 +149,7 @@ def test_missing_state_file_exits_nonzero(self):
         proc = subprocess.run(
             [sys.executable, str(TOOL), "candidates", "--state", str(self.tmp / "nope.json"),
              "--tracker", str(self.tmp / "n.csv")],
-            capture_output=True, text=True,
+            capture_output=True, text=True, encoding="utf-8",
         )
         self.assertNotEqual(proc.returncode, 0)
         self.assertIn("not found", proc.stderr + proc.stdout)
```

**File**: `tests/test_tools_utf8_output.py` (added, +154/-0)
```diff
@@ -0,0 +1,154 @@
+"""The Python tools must write UTF-8 whatever the host's default encoding is.
+
+On Windows a piped stdout (which is how Claude Code runs every tool) defaults
+to the ANSI code page, cp1252 on most Western installs. A tool that prints a
+posting title, company, CV line or file name outside that code page then dies
+with UnicodeEncodeError before the workflow sees any output: `/rank` could not
+list a single Cyrillic, CJK, Devanagari, Polish or Turkish posting.
+
+Each case runs the real CLI in a child process with a legacy stdout forced via
+PYTHONIOENCODING, so the Linux CI job reproduces what Windows users hit. The
+child must exit cleanly and its bytes must decode as UTF-8.
+"""
+import json
+import os
+import shutil
+import subprocess
+import sys
+import unittest
+from pathlib import Path
+from tempfile import TemporaryDirectory
+
+try:
+    import openpyxl
+except ImportError:
+    openpyxl = None
+
+REPO = Path(__file__).resolve().parent.parent
+TOOLS = REPO / "tools"
+
+# One name per script family that cp1252 cannot encode.
+CYRILLIC = "Яндекс"
+CJK = "腾讯"
+POLISH = "Żabka Łódź"
+
+
+def run_legacy_stdout(argv, cwd=None):
+    """Run a tool the way a Western-locale Windows host pipes it."""
+    env = dict(os.environ, PYTHONIOENCODING="cp1252", PYTHONUTF8="0")
+    return subprocess.run([sys.executable, *map(str, argv)], cwd=cwd, env=env, capture_output=True)
+
+
+class ToolsWriteUtf8(unittest.TestCase):
+    def setUp(self):
+        directory = TemporaryDirectory()
+        self.addCleanup(directory.cleanup)
+        self.tmp = Path(directory.name)
+
+    def assert_clean_utf8(self, proc, expect_code, *needles, stream="stdout"):
+        err = proc.stderr.decode("utf-8", "replace")
+        self.assertNotIn("UnicodeEncodeError", err)
+        self.assertEqual(proc.returncode, expect_code, err)
+        text = getattr(proc, stream).decode("utf-8")
+        for needle in needles:
+            self.assertIn(needle, text)
+        return text
+
+    def write_state(self, seen):
+        state = self.tmp / "seen_jobs.json"
+        state.write_text(json.dumps({"version": 1, "seen": seen}, ensure_ascii=False), encoding="utf-8")
+        return state
+
+    @staticmethod
+    def entry(company, title):
+        return {
+            "title": title, "company": company, "url": "https://example.com/jobs/123456",
+            "portal": "example", "status": "new", "first_seen": "2026-09-20",
+        }
+
+    def test_rank_candidates_lists_non_latin_postings(self):
+        state = self.write_state({"a": self.entry(CYRILLIC, "Инженер"), "b": self.entry(CJK, "工程师")})
+        proc = run_legacy_stdout([TOOLS / "rank_state.py", "candidates", "--state", state, "--today", "2026-09-21"])
+        out = json.loads(self.assert_clean_utf8(proc, 0, CYRILLIC, CJK))
+        self.assertEqual(out["eligible"], 2)
+
+    def test_rank_apply_prints_the_ranking_for_non_latin_postings(self):
+        state = self.write_state({"a": self.entry(CJK, "工程师")})
+        results = self.tmp / "results.json"
+        results.write_text(json.dumps([{
+            "key": "a", "status": "scored",
+            "scores": {"technical": 80, "experience": 80, "behavioral": 80, "career": 80},
+        }]), encoding="utf-8")
+        proc = run_legacy_stdout([
+            TOOLS / "rank_state.py", "apply", "--results", results, "--state", state, "--today", "2026-09-21",
+        ])
+        out = json.loads(self.assert_clean_utf8(proc, 0, CJK))
+        self.assertEqual([row["key"] for row in out["ranked"]], ["a"])
+
+    def test_job_key_audit_reports_non_latin_entries(self):
+        state = self.write_state({f"{CYRILLIC}_Инженер": self.entry(CYRILLIC, "Инженер")})
+        proc = run_legacy_stdout([TOOLS / "job_key.py", "--audit", state])
+        self.assertNotIn(b"UnicodeEncodeError", proc.stderr)
+        self.assertIn(CYRILLIC, proc.stdout.decode("utf-8"))
+
+    def test_salary_lookup_prints_a_company_outside_cp1252(self):
+        shutil
```

---

### Incident Patch 9: `2e8600d6` (2026-09-21)
**Commit Message**: fix(rank): reject invalid score dimensions before saving results (#488)

**File**: `CHANGELOG.md` (modified, +7/-0)
```diff
@@ -84,6 +84,13 @@ per-file diff commands.
 
 ### Fixed
 
+- **`/rank` rejects invalid score dimensions before updating an entry**
+  (`tools/rank_state.py`, `tests/test_rank_state.py`) - enforce the rubric's
+  inclusive 0-100 range and reject booleans, NaN, and infinities. Invalid results
+  now use the existing per-job error report, leaving the rejected entry intact
+  while valid results in the same batch are saved. CLI tests cover every score
+  dimension, oversized integers, boundary values, and fractional-score rounding.
+
 - **Distinct non-Latin company names no longer share the unknown-company job key**
   (`tools/job_key.py`, `tests/test_job_key.py`) - when a non-empty company name
   has no ASCII slug, derive its fallback from a hash of the normalized name.
```

**File**: `tests/test_rank_state.py` (modified, +34/-0)
```diff
@@ -431,6 +431,40 @@ def test_dry_run_prints_but_never_writes(self):
         )
         self.assertEqual(self.read_state()["a"]["status"], "new")
 
+    def test_invalid_scores_report_errors_without_changing_the_entry(self):
+        dimensions = ("technical", "experience", "behavioral", "career")
+        invalid = (-1, 101, True, False, float("nan"), float("inf"), -float("inf"), 10**400)
+        for dimension in dimensions:
+            for value in invalid:
+                with self.subTest(dimension=dimension, value=value):
+                    original = entry(status="ranked", rank_score=70, strengths=["keep"])
+                    self.write_state({"a": original, "b": entry()})
+                    scores = dict.fromkeys(dimensions, 50)
+                    scores[dimension] = value
+                    out = self.run_tool(
+                        "apply", "--results", self.results([
+                            {"key": "a", "status": "scored", "scores": scores},
+                            {"key": "b", "status": "scored", "scores": dict.fromkeys(dimensions, 80)},
+                        ]), expect=1,
+                    )
+                    self.assertEqual(len(out["errors"]), 1)
+                    self.assertEqual(out["errors"][0]["key"], "a")
+                    self.assertIn(dimension, out["errors"][0]["error"])
+                    self.assertEqual(self.read_state()["a"], original)
+                    self.assertEqual([row["key"] for row in out["ranked"]], ["b"])
+                    self.assertEqual(self.read_state()["b"]["rank_score"], 80)
+
+    def test_score_boundaries_and_fractional_scores_remain_valid(self):
+        for value, expected in ((0, 0), (100, 100), (72.5, 73)):
+            with self.subTest(value=value):
+                self.write_state({"a": entry()})
+                out = self.run_tool("apply", "--results", self.results([
+                    {"key": "a", "status": "scored", "scores": dict.fromkeys(
+                        ("technical", "experience", "behavioral", "career"), value)},
+                ]))
+                self.assertEqual(out["errors"], [])
+                self.assertEqual(self.read_state()["a"]["rank_score"], expected)
+
     def test_re_scoring_an_already_ranked_job_is_idempotent(self):
         """Re-running /rank never re-scores an already-ranked job unless --all
         says so (Step 4), but if it does score one again, apply must produce
```

**File**: `tools/rank_state.py` (modified, +3/-1)
```diff
@@ -234,8 +234,10 @@ def overall_score(scores: dict) -> int:
     total = 0.0
     for dim, weight in WEIGHTS.items():
         value = scores.get(dim)
-        if not isinstance(value, (int, float)):
+        if isinstance(value, bool) or not isinstance(value, (int, float)):
             raise ValueError(f"missing or non-numeric score '{dim}'")
+        if not 0 <= value <= 100:
+            raise ValueError(f"score '{dim}' must be finite and between 0 and 100")
         total += float(value) * weight
     return int(total + 0.5)
 
```

---

### Incident Patch 10: `456f2bfd` (2026-09-21)
**Commit Message**: fix(scrape): distinguish non-Latin companies in fallback job keys (#487)

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -84,6 +84,14 @@ per-file diff commands.
 
 ### Fixed
 
+- **Distinct non-Latin company names no longer share the unknown-company job key**
+  (`tools/job_key.py`, `tests/test_job_key.py`) - when a non-empty company name
+  has no ASCII slug, derive its fallback from a hash of the normalized name.
+  Missing names retain `unknown-company`, and existing ASCII keys are unchanged.
+  CLI tests cover distinct companies, case and canonical Unicode equivalence,
+  and stable keys across posting URLs. Existing state is not rewritten; `/scrape`
+  already recognizes stored postings by URL regardless of their previous key.
+
 - **`/rank` tracker exclusion handles UTF-8 BOMs on reordered CSV headers**
   (`tools/rank_state.py`, `tests/test_rank_state.py`) - when `company` or `role`
   is the first column, a leading BOM becomes part of the header name and an
```

**File**: `tests/test_job_key.py` (modified, +28/-0)
```diff
@@ -71,6 +71,34 @@ def test_non_latin_company_falls_back_without_producing_a_bare_prefix(self):
         self.assertFalse(key.startswith("_"))
 
 
+class CompanyFallbackCLI(unittest.TestCase):
+    def key_for(self, company, url="https://example.com/jobs/123456"):
+        proc = subprocess.run(
+            [sys.executable, str(TOOL), "--company", company,
+             "--title", "Software Engineer", "--url", url],
+            capture_output=True, text=True, check=True,
+        )
+        return proc.stdout.strip()
+
+    def test_distinct_non_latin_companies_have_distinct_keys(self):
+        keys = [self.key_for(company) for company in ("腾讯", "阿里巴巴", "")]
+        self.assertEqual(len(set(keys)), 3)
+        self.assertTrue(all(is_canonical(key) for key in keys))
+
+    def test_company_fallback_is_stable_across_case_normalization_and_urls(self):
+        for first, second in (("КОМПАНИЯ", "компания"), ("ガンホー", "カ\u3099ンホー")):
+            with self.subTest(first=first, second=second):
+                self.assertEqual(
+                    self.key_for(first),
+                    self.key_for(second, "https://example.com/jobs/654321"),
+                )
+
+    def test_missing_company_and_existing_ascii_keys_are_unchanged(self):
+        self.assertEqual(self.key_for(""), "unknown-company_software-engineer")
+        self.assertEqual(self.key_for("  "), "unknown-company_software-engineer")
+        self.assertEqual(self.key_for("Acme Corp"), "acme-corp_software-engineer")
+
+
 class CanonicalAndLegacyShape(unittest.TestCase):
     def test_canonical_accepts_company_underscore_title(self):
         self.assertTrue(is_canonical("acme-corp_soc-analyst"))
```

**File**: `tools/job_key.py` (modified, +6/-1)
```diff
@@ -84,7 +84,12 @@ def _cap(slug: str, limit: int) -> str:
 
 def make_key(company: str, title: str, url: str = "") -> str:
     """The canonical seen_jobs.json key for one posting."""
-    company_slug = _cap(slugify(company), COMPANY_MAX) or "unknown-company"
+    company_slug = _cap(slugify(company), COMPANY_MAX)
+    if not company_slug:
+        name = unicodedata.normalize("NFC", str(company or "").strip().casefold())
+        # An absent name stays unknown; a non-Latin name still has an identity.
+        digest = hashlib.sha1(name.encode("utf-8")).hexdigest()[:HASH_LEN]
+        company_slug = f"company-{digest}" if name else "unknown-company"
     title_slug = _cap(slugify(title), TITLE_MAX)
     if not title_slug:
         # No Latin characters in the title. The portal's own numeric id is the
```

#### Recent Merged Pull Requests:
- **PR #507** (2026-09-29): chore(release): cut v1.7.2 (@MadsLorentzen)
- **PR #506** (2026-09-29): fix(robots-check): decode curl output as UTF-8 so non-ASCII responses stop reading as UNCONFIRMED on Windows (@canmugan)
- **PR #505** (2026-09-29): fix(freehire-search): decode HTML entities and trim whitespace in titles (@sahilsahu4102)
- **PR #504** (2026-09-29): fix(freehire-search): keep the salary period so a yearly figure isn't read as monthly (@sahilsahu4102)
- **PR #503** (2026-09-29): fix(tests): escape the regex in test_verify_pdf's docstring and compile-check tests/*.py (@yang2632)
- **PR #500** (2026-09-27): fix(linkedin-search): reject detail URLs on other hosts instead of fetching the posting with that number (#499) (@ayobamiseun)
- **PR #498** (2026-09-28): feat(verify_pdf): add --ascii-dates, the non-folding check for the documented date-range rule (#385) (@ayobamiseun)
- **PR #495** (closed): Make verify_layout.py's docstring raw to stop a SyntaxWarning (@Holo-Eter)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

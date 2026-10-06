# Forensic Learning Record (Deep Inspection): strands-agents/harness-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/strands-agents-harness-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/strands-agents/harness-sdk](https://github.com/strands-agents/harness-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:22:14.956Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `strands-agents/harness-sdk`
- **Description**: Build an agent harness and control it end-to-end. Open-source SDK for production AI agents in Python & TypeScript - any model, any cloud.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 8679 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `site/scripts/changelog/render-markdown.ts`
```
// Render a release into the changelog markdown file format consumed by the
// harness-sdk content collection (Plan 1 Zod schema). Hand-rolled minimal YAML
// emitter -- entries are flat objects emitted as inline flow maps, mirroring the
// committed fixtures. mergePreserving keeps any human-written highlights/body
// on re-sync while refreshing the parsed entries/urls.

import type { ReleaseFile } from './types'

// JSON string encoding is a strict subset of YAML double-quoted scalar syntax,
// so this always yields a valid YAML string.
function q(s: unknown): string {
  return JSON.stringify(String(s))
}

// YAML 1.1 words that, left bare, parse as booleans/null instead of strings.
const YAML_RESERVED = new Set(['true', 'false', 'yes', 'no', 'on', 'off', 'null', 'none', '~'])

// Bareword if safe for YAML, else quoted. Quote anything that starts with a
// digit, contains YAML-significant chars, or is a reserved bool/null word.
function scalar(v: unknown): string {
  if (v === null || v === undefined) return 'null'
  if (typeof v === 'number') return String(v)
  if (v === '') return '""'
  if (/^[\w.@/-]+$/.test(String(v)) && !/^\d/.test(String(v)) && !YAML_RESERVED.has(String(v).toLowerCase()))
    return String(v)
  return q(v)
}

function flowEntry(e: ReleaseFile['entries'][number]): string {
  const parts = [
    `type: ${e.type}`,
    `breaking: ${e.breaking === true}`,
    `scope: ${e.scope ? scalar(e.scope) : 'null'}`,
    `areas: [${e.areas.map(scalar).join(', ')}]`,
    `title: ${q(e.title)}`,
    `pr: ${e.pr == null ? 'null' : e.pr}`,
    `prUrl: ${e.prUrl ? q(e.prUrl) : 'null'}`,
    `commit: ${e.commit ? q(e.commit) : 'null'}`,
    `commitUrl: ${e.commitUrl ? q(e.commitUrl) : 'null'}`,
    `author: ${e.author ? scalar(e.author) : 'null'}`,
  ]
  return `  - { ${parts.join(', ')} }`
}

/**
 * @param f  release file shape (see build-release-file.ts)
 * @param body  optional curated markdown body to append
 */
export function renderMarkdown(f: ReleaseFile, body = ''): string {
  const lines = ['---']
  lines.push(`sdk: ${f.sdk}`)
  if (f.language) lines.push(`language: ${f.language}`)
  lines.push(`version: ${q(f.version)}`)
  lines.push(`tag: ${scalar(f.tag)}`)
  lines.push(`date: ${f.date}`)
  lines.push(`releaseUrl: ${f.releaseUrl}`)
  lines.push(`packageUrl: ${f.packageUrl}`)
  if (f.highlights && f.highlights.trim()) {
    lines.push('highlights: |')
    for (const l of f.highlights.replace(/\s+$/, '').split('\n')) lines.push(`  ${l}`)
  }
  if (f.entries && f.entries.length) {
    lines.push('entries:')
    for (const e of f.entries) lines.push(flowEntry(e))
  } else {
    lines.push('entries: []')
  }
  if (f.newContributors && f.newContributors.length) {
    lines.push('newContributors:')
    for (const c of f.newContributors) {
      lines.push(`  - { login: ${scalar(c.login)}, pr: ${c.pr} }`)
    }
  }
  lines.push('---')
  return lines.join('\n') + '\n' + (body ? '\n' + body.replace(/\s+$/, '') + '\n' : '')
}

// Pull the human-authored highlights block + markdown body out of an existing
// file so a re-sync doesn't clobber curation. Entries/urls always regenerate.
export function mergePreserving(fresh: ReleaseFile, existing: string | null): string {
  if (!existing) return renderMarkdown(fresh)
  const fm = existing.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
  const body = fm ? fm[2].trim() : ''
  let highlights = fresh.highlights
  if (fm) {
    // Capture a block scalar `highlights: |` up to the next top-level key or EOF.
    const hl = fm[1].match(/highlights:\s*\|\s*\n([\s\S]*?)(?=\n[A-Za-z][\w-]*:|$)/)
    if (hl) highlights = hl[1].replace(/^ {1,2}/gm, '').replace(/\s+$/, '')
  }
  return renderMarkdown({ ...fresh, highlights }, body)
}

```

### Core Architecture Module: `site/src/util/api-counterparts.ts`
```
/**
 * Build-time symbol-level pairing between the Python and TypeScript API
 * reference trees, used by the language toggle to deep-link between them.
 *
 * The two trees are URL'd on different schemes — Python pages are module
 * paths (`docs/api/python/strands.models.bedrock`) while TypeScript pages are
 * symbol names (`docs/api/typescript/BedrockModel`) — so slugs never match.
 * They do share symbol names, though: per the cross-SDK parity conventions,
 * a class documented in both SDKs has the same PascalCase identifier. The
 * Python generator emits an `<a id="{module}.{Symbol}">` anchor for every
 * top-level symbol a module page documents, and each TypeScript page is named
 * by its symbol, so joining on symbol name recovers the pairing.
 *
 * The result maps doc-collection ids to switch targets (paths with a trailing
 * slash, optionally with a `#anchor`):
 *   - Python page -> the TypeScript page of a symbol it documents
 *   - TypeScript page -> the Python module page, anchored at the symbol
 * Pages whose symbols exist in only one SDK are absent from the map and fall
 * back to the section index in getLanguageSwitchTarget.
 */

const PY_PREFIX = 'docs/api/python/'
const TS_PREFIX = 'docs/api/typescript/'

export interface ApiDocEntry {
  id: string
  body?: string
}

/**
 * Whether a PascalCase symbol is the natural name for a snake_case module
 * segment. Compared case-insensitively with underscores stripped so acronym
 * casing still matches (`conversation_manager` ~ `ConversationManager`,
 * `a2a_agent` ~ `A2AAgent`).
 */
function symbolMatchesSegment(symbol: string, segment: string): boolean {
  return symbol.toLowerCase() === segment.replace(/_/g, '').toLowerCase()
}

/** Escape every regex metacharacter so the string matches literally. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Top-level symbols documented by a Python module page, in document order. */
function extractPythonSymbols(moduleName: string, body: string): string[] {
  // Match anchors exactly one level below the module (members like
  // `module.Class.method` have a further dot and are excluded).
  const escaped = escapeRegExp(moduleName)
  const anchorRe = new RegExp(`<a id="${escaped}\\.([A-Za-z_][A-Za-z0-9_]*)"`, 'g')
  const seen = new Set<string>()
  const symbols: string[] = []
  for (const match of body.matchAll(anchorRe)) {
    const symbol = match[1]
    if (symbol && !seen.has(symbol)) {
      seen.add(symbol)
      symbols.push(symbol)
    }
  }
  return symbols
}

/**
 * Build the bidirectional counterpart map from the docs content collection.
 *
 * @param entries - Doc entries; only `docs/api/{python,typescript}/` ids are used
 * @returns Map from doc id to counterpart target (`/`-less slug + trailing slash + optional #anchor)
 */
export function buildApiCounterpartMap(entries: readonly ApiDocEntry[]): Map<string, string> {
  const tsSymbols = new Set<string>()
  for (const entry of entries) {
    // The trailing slash in the prefix excludes the section index page itself
    if (entry.id.startsWith(TS_PREFIX)) {
      tsSymbols.add(entry.id.slice(TS_PREFIX.length))
    }
  }

  const map = new Map<string, string>()
  // Symbol -> Python pages documenting it (to resolve TS pages, preferring an
  // unambiguous home for symbols that appear in several modules)
  const symbolToPyPages = new Map<string, string[]>()

  for (const entry of entries) {
    if (!entry.id.startsWith(PY_PREFIX) || !entry.body) continue
    const moduleName = entry.id.slice(PY_PREFIX.length)
    if (!moduleName) continue

    const symbols = extractPythonSymbols(moduleName, entry.body)
    for (const symbol of symbols) {
      const pages = symbolToPyPages.get(symbol)
      if (pages) pages.push(entry.id)
      else symbolToPyPages.set(symbol, [entry.id])
    }

    const matches = symbols.filter((symbol) => tsSymbols.has(symbol))
    if (matches.length === 0) continue
    // A module usually documents one primary class named after itself
    // (`conversation_manager` -> ConversationManager); prefer it when several
    // symbols match, otherwise take the first documented match.
    const lastSegment = moduleName.split('.').pop() ?? ''
    const primary = matches.find((symbol) => symbolMatchesSegment(symbol, lastSegment)) ?? matches[0]
    map.set(entry.id, `/${TS_PREFIX}${primary}/`)
  }

  for (const symbol of tsSymbols) {
    const pages = symbolToPyPages.get(symbol)
    if (!pages || pages.length === 0) continue
    // Symbols shared by several modules: prefer the stable module, then the
    // shortest path, then alphabetical — deterministic and biased toward the
    // page a reader most likely wants.
    const best = [...pages].sort(
      (a, b) =>
        Number(a.includes('.experimental.')) - Number(b.includes('.experimental.')) ||
        a.length - b.length ||
        a.localeCompare(b)
    )[0]!
    const moduleName = best.slice(PY_PREFIX.length)
    map.set(`${TS_PREFIX}${symbol}`, `/${best}/#${moduleName}.${symbol}`)
  }

  return map
}

let cachedMap: Map<string, string> | undefined

/**
 * Memoized accessor for component use: the collection is stable within a
 * build, and LanguageToggle renders on every page (twice — desktop + mobile
 * header), so building the map per render would repeat the same regex work
 * over every Python page body ~2x per page across the whole static build.
 *
 * The cache ignores `entries` after the first call, so in `astro dev` the map
 * is stale until server restart if generated API pages change. Acceptable:
 * the map only changes when the SDK docs are regenerated, which requires a
 * restart anyway.
 */
export function getApiCounterpartMap(entries: readonly ApiDocEntry[]): Map<string, string> {
  cachedMap ??= buildApiCounterpartMap(entries)
  return cachedMap
}

```

### Core Architecture Module: `site/src/util/api-link-converter.ts`
```
/**
 * Utility to convert old MkDocs-style API reference links to the new @api shorthand format.
 *
 * Old formats:
 * - Python: `../api-reference/python/agent/agent_result.md#strands.agent.agent_result.AgentResult`
 * - TypeScript: `../api-reference/typescript/classes/BedrockModel.html`
 *
 * New formats:
 * - Python: `@api/python/strands.agent.agent_result#AgentResult`
 * - TypeScript: `@api/typescript/BedrockModel`
 */

/**
 * Pattern to match old Python API links.
 * Captures: path segments and optional hash with full dotted path
 */
const PYTHON_API_PATTERN = /^(\.\.\/)*api-reference\/python\/([^#]+)\.md(#(.+))?$/

/**
 * Pattern to match old TypeScript API links.
 * Captures: classes/interfaces subdirectory and the type name
 */
const TS_API_PATTERN = /^(\.\.\/)*api-reference\/typescript\/(?:classes|interfaces)\/([^.]+)\.html(#(.+))?$/

/**
 * Map a strands.experimental.bidi module path to its strands.bidi equivalent.
 */
function resolveExperimentalBidiModule(modulePath: string): string {
  return modulePath.replace(/^strands\.experimental\.bidi(?=\.|$)/, 'strands.bidi')
}

/**
 * Check if a link is an old-style API reference link that needs conversion.
 */
export function isOldApiLink(link: string): boolean {
  return PYTHON_API_PATTERN.test(link) || TS_API_PATTERN.test(link)
}

/**
 * Convert an old Python API link to the new @api shorthand format.
 *
 * The hash fragment contains the full dotted path (e.g., `strands.agent.agent_result.AgentResult`).
 * We extract the module path (everything up to the last segment) and the symbol (last segment).
 *
 * Examples:
 * - `../api-reference/python/agent/agent_result.md#strands.agent.agent_result.AgentResult`
 *   -> `@api/python/strands.agent.agent_result#AgentResult`
 * - `../api-reference/python/models/model.md#strands.models.model.Model.get_config`
 *   -> `@api/python/strands.models.model#Model.get_config`
 * - `../api-reference/python/models/model.md` (no hash)
 *   -> `@api/python/strands.models.model`
 */
export function convertPythonApiLink(link: string): string | null {
  const match = link.match(PYTHON_API_PATTERN)
  if (!match) return null

  const pathPart = match[2] ?? '' // e.g., "agent/agent_result" or "models/model"
  const hashContent = match[4] // e.g., "strands.agent.agent_result.AgentResult" or undefined

  if (hashContent) {
    // Hash contains the full dotted path - extract module and symbol
    // The module path is typically the part that matches the file structure
    // The symbol is what comes after (class name, method, etc.)

    // Find where the module path ends and the symbol begins
    // Module paths follow the pattern: strands.{path segments matching file structure}
    const pathSegments = pathPart.split('/')
    const modulePrefix = 'strands.' + pathSegments.join('.')

    if (hashContent.startsWith(modulePrefix)) {
      // Everything after the module prefix is the symbol
      const symbolPart = hashContent.slice(modulePrefix.length)
      if (symbolPart.startsWith('.')) {
        // There's a symbol after the module path
        return `@api/python/${resolveExperimentalBidiModule(modulePrefix)}#${symbolPart.slice(1)}`
      } else if (symbolPart === '') {
        // Hash points to the module itself
        return `@api/python/${resolveExperimentalBidiModule(modulePrefix)}`
      }
    }

    // Fallback: use the hash content directly to determine module
    // This handles cases where the hash might not perfectly match the path
    const hashParts = hashContent.split('.')
    // Find the likely module boundary (usually before a capitalized class name)
    let moduleEndIndex = hashParts.length
    for (let i = 1; i < hashParts.length; i++) {
      const part = hashParts[i]
      if (part && /^[A-Z]/.test(part)) {
        moduleEndIndex = i
        break
      }
    }

    const modulePath = resolveExperimentalBidiModule(hashParts.slice(0, moduleEndIndex).join('.'))
    const symbol = hashParts.slice(moduleEndIndex).join('.')

    if (symbol) {
      return `@api/python/${modulePath}#${symbol}`
    } else {
      return `@api/python/${modulePath}`
    }
  } else {
    // No hash - convert path to dotted module notation
    const modulePath = resolveExperimentalBidiModule('strands.' + pathPart.split('/').join('.'))
    return `@api/python/${modulePath}`
  }
}

/**
 * Convert an old TypeScript API link to the new @api shorthand format.
 *
 * Examples:
 * - `../api-reference/typescript/classes/BedrockModel.html` -> `@api/typescript/BedrockModel`
 * - `../api-reference/typescript/interfaces/BedrockModelOptions.html` -> `@api/typescript/BedrockModelOptions`
 * - `../api-reference/typescript/classes/Agent.html#constructor` -> `@api/typescript/Agent#constructor`
 */
export function convertTypeScriptApiLink(link: string): string | null {
  const match = link.match(TS_API_PATTERN)
  if (!match) return null

  const typeName = match[2] // e.g., "BedrockModel"
  const anchor = match[4] // e.g., "constructor" or undefined

  if (anchor) {
    return `@api/typescript/${typeName}#${anchor}`
  }
  return `@api/typescript/${typeName}`
}

/**
 * Convert any old-style API link to the new @api shorthand format.
 * Returns null if the link is not an API reference link.
 */
export function convertApiLink(link: string): string | null {
  if (PYTHON_API_PATTERN.test(link)) {
    return convertPythonApiLink(link)
  }
  if (TS_API_PATTERN.test(link)) {
    return convertTypeScriptApiLink(link)
  }
  return null
}

```

### Core Architecture Module: `site/src/util/blog.ts`
```
import { getCollection, getEntry, type CollectionEntry } from 'astro:content'

export type BlogPost = CollectionEntry<'blog'>
export type Author = CollectionEntry<'authors'>

/**
 * Get all published blog posts, sorted by date descending.
 * In production, excludes drafts. In dev, includes everything.
 */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const posts = await getCollection('blog', ({ data }) => {
    return import.meta.env.PROD ? !data.draft : true
  })
  return posts.sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
}

/**
 * Get all unique tags across published posts.
 */
export async function getAllTags(): Promise<string[]> {
  const posts = await getPublishedPosts()
  const tagSet = new Set<string>()
  for (const post of posts) {
    for (const tag of post.data.tags) {
      tagSet.add(tag)
    }
  }
  return Array.from(tagSet).sort()
}

/**
 * Get posts filtered by tag.
 */
export async function getPostsByTag(tag: string): Promise<BlogPost[]> {
  const posts = await getPublishedPosts()
  return posts.filter((post) => post.data.tags.includes(tag))
}

/**
 * Get posts by author ID.
 */
export async function getPostsByAuthor(authorId: string): Promise<BlogPost[]> {
  const posts = await getPublishedPosts()
  return posts.filter((post) => post.data.authors.includes(authorId))
}

/**
 * Resolve author IDs to full author entries.
 */
export async function resolveAuthors(authorIds: string[]): Promise<Author[]> {
  const authors: Author[] = []
  for (const id of authorIds) {
    const author = await getEntry('authors', id)
    if (!author) {
      throw new Error(`[blog] Unknown author ID: "${id}" — check authors.yaml and blog post frontmatter`)
    }
    authors.push(author)
  }
  return authors
}

/**
 * Convert a tag name to a URL-safe slug.
 */
export function tagToSlug(tag: string): string {
  return tag.toLowerCase().replace(/\s+/g, '-')
}

/**
 * Convert a URL slug back to the original tag name.
 */
export function slugToTag(slug: string, allTags: string[]): string | undefined {
  return allTags.find((tag) => tagToSlug(tag) === slug)
}

/**
 * Format a date for display.
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

```

### Core Architecture Module: `site/src/util/catalog-filter.ts`
```
/**
 * Pure filter-matching and URL-state logic for the catalog page. Kept free of
 * DOM access so the page script can import it and vitest can test it directly.
 */

import { CATALOG_TYPES } from '../components/catalog/types'

export interface CatalogFilterState {
  search: string
  types: Set<string>
  languages: Set<string>
  badges: Set<string>
  maintainedBy: Set<string>
  sdk: string
}

export interface CardFilterData {
  search: string
  type: string
  languages: string[]
  badges: string[]
  maintainedBy: string
  sdk: string
}

const KNOWN_TYPES = new Set<string>(CATALOG_TYPES.map((t) => t.value))
const KNOWN_LANGUAGES = new Set(['python', 'typescript'])
const KNOWN_BADGES = new Set(['verified', 'featured', 'new'])
export const KNOWN_MAINTAINED_BY = new Set(['strands', 'aws', 'partner', 'community'])
const KNOWN_SDKS = new Set(['agents', 'evals'])
const DEFAULT_SDK = 'agents'

/** Facets AND together; selections within a facet OR. Empty facet = no constraint. */
export function matchesFilters(card: CardFilterData, state: CatalogFilterState): boolean {
  if (card.sdk !== state.sdk) return false
  const q = state.search.trim().toLowerCase()
  if (q && !card.search.includes(q)) return false
  if (state.types.size > 0 && !state.types.has(card.type)) return false
  if (state.languages.size > 0 && !card.languages.some((l) => state.languages.has(l))) return false
  if (state.badges.size > 0 && !card.badges.some((b) => state.badges.has(b))) return false
  if (state.maintainedBy.size > 0 && !state.maintainedBy.has(card.maintainedBy)) return false
  return true
}

/**
 * Cards a facet value would match if it were the sole selection in its facet,
 * holding every other facet at the current state. Drives the live chip counts
 * so no chip invites a zero-result click.
 */
export function countIfSelected(
  cards: CardFilterData[],
  state: CatalogFilterState,
  facet: 'types' | 'languages' | 'badges' | 'maintainedBy',
  value: string
): number {
  const probe: CatalogFilterState = {
    ...state,
    types: new Set(state.types),
    languages: new Set(state.languages),
    badges: new Set(state.badges),
    maintainedBy: new Set(state.maintainedBy),
  }
  probe[facet] = new Set([value])
  return cards.filter((card) => matchesFilters(card, probe)).length
}

/** Exclusive facet selection: picking a value replaces the set; re-picking clears it. */
export function selectOnly(set: Set<string>, value: string): void {
  const had = set.has(value)
  set.clear()
  if (!had) set.add(value)
}

/** Serialize non-default state to a query string ('' when everything is default). */
export function stateToQuery(state: CatalogFilterState): string {
  const params = new URLSearchParams()
  if (state.search.trim()) params.set('q', state.search.trim())
  if (state.types.size > 0) params.set('type', [...state.types].sort().join(','))
  if (state.languages.size > 0) params.set('lang', [...state.languages].sort().join(','))
  if (state.badges.size > 0) params.set('badge', [...state.badges].sort().join(','))
  if (state.maintainedBy.size > 0) params.set('by', [...state.maintainedBy].sort().join(','))
  if (state.sdk !== DEFAULT_SDK) params.set('sdk', state.sdk)
  return params.toString()
}

/** Parse a query string into filter state, silently dropping unknown values. */
export function queryToState(query: string): CatalogFilterState {
  const params = new URLSearchParams(query)
  const pick = (key: string, known: Set<string>) =>
    new Set((params.get(key) || '').split(',').filter((v) => known.has(v)))
  const sdkParam = params.get('sdk') || DEFAULT_SDK
  return {
    search: params.get('q') || '',
    types: pick('type', KNOWN_TYPES),
    languages: pick('lang', KNOWN_LANGUAGES),
    badges: pick('badge', KNOWN_BADGES),
    maintainedBy: pick('by', KNOWN_MAINTAINED_BY),
    sdk: KNOWN_SDKS.has(sdkParam) ? sdkParam : DEFAULT_SDK,
  }
}

```

### Core Architecture Module: `site/src/util/catalog.ts`
```
/**
 * Build-time processing for catalog entries: derives card view-models from
 * collection data, joins the bot-maintained stats file, and orders the grid.
 */

import type { CatalogEntryData } from '../content.config'
import { isNew } from './new-badge'

export interface CatalogStats {
  stars?: number
  downloads?: { python?: number; typescript?: number }
}

/** Shape of src/data/catalog-stats.json — keyed by entry id (filename without .yaml). */
export type CatalogStatsFile = Record<string, CatalogStats>

export interface CatalogCardModel {
  /** Entry id (filename without .yaml) — keys the docs-drawer `?entry=` deep link. */
  id: string
  name: string
  description: string
  integrationType: CatalogEntryData['integrationType']
  maintainedBy: CatalogEntryData['maintainedBy']
  sdk: 'agents' | 'evals'
  languages: ('python' | 'typescript')[]
  href: string
  external: boolean
  github: string
  registryLinks: { label: 'PyPI' | 'npm'; href: string }[]
  maintainer: string
  featured: boolean
  badges: string[]
  stars?: number
  downloads?: number
}

export function toCardModel(
  id: string,
  data: CatalogEntryData,
  stats: CatalogStats | undefined,
  buildDate: Date
): CatalogCardModel {
  const languages: ('python' | 'typescript')[] = []
  const registryLinks: CatalogCardModel['registryLinks'] = []
  // Registry links derive from the package name so an entry can't point its
  // PyPI/npm icon at a different (or malicious) page than the package it
  // names. A language block without a package is a guide-only integration:
  // it counts toward the language facet but has no registry link to render.
  if (data.languages.python) {
    languages.push('python')
    const pkg = data.languages.python.package
    if (pkg) {
      // An extras-qualified package (`temporalio[strands-agents]`) lives on
      // PyPI under its base name.
      registryLinks.push({ label: 'PyPI', href: `https://pypi.org/project/${pkg.replace(/\[.*\]$/, '')}/` })
    }
  }
  if (data.languages.typescript) {
    languages.push('typescript')
    const pkg = data.languages.typescript.package
    if (pkg) {
      // Scoped names (@scope/name) work unencoded in npm package URLs.
      registryLinks.push({ label: 'npm', href: `https://www.npmjs.com/package/${pkg}` })
    }
  }

  // The displayed maintainer derives from the GitHub URL's owner segment —
  // the repo the entry links to is the source of truth for ownership.
  const maintainer = new URL(data.github).pathname.split('/')[1] ?? ''

  const badges: string[] = [...data.badges]
  if (isNew(data.addedDate, buildDate)) badges.push('new')

  // Primary link priority: on-site docs page, then the integration's own
  // Strands instructions page, then the bare GitHub repo.
  const docsHref = data.docsPage ? `/${data.docsPage}/` : undefined

  const totalDownloads = (stats?.downloads?.python ?? 0) + (stats?.downloads?.typescript ?? 0)

  return {
    id,
    name: data.name,
    description: data.description,
    integrationType: data.integrationType,
    maintainedBy: data.maintainedBy,
    sdk: data.sdk,
    languages,
    href: docsHref ?? data.docsUrl ?? data.github,
    external: !docsHref,
    github: data.github,
    registryLinks,
    maintainer,
    featured: data.featured,
    badges,
    ...(stats?.stars !== undefined && { stars: stats.stars }),
    ...(totalDownloads > 0 && { downloads: totalDownloads }),
  }
}

/** Featured entries first, then alphabetical by name. */
export function sortEntries(cards: CatalogCardModel[]): CatalogCardModel[] {
  return [...cards].sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

```

### Core Architecture Module: `site/src/util/changelog.ts`
```
import { getCollection, type CollectionEntry } from 'astro:content'
import type { ChangelogEntry } from '../content.config'
import { compareVersionDesc } from './semver'
export { compareVersionDesc } from './semver'

export type ChangelogRelease = CollectionEntry<'changelog'>

/**
 * Escape Markdown-significant characters in inline text (e.g. PR titles) before
 * interpolating into the machine-readable `.md` endpoints. Without this,
 * snake_case identifiers like `_extract_trace_level` render as italics and
 * brackets/backticks reshape the output. Titles are single-line YAML strings,
 * so only inline constructs matter (no block-level escaping needed).
 */
export function escapeMarkdownInline(text: string): string {
  return text.replace(/[\\`*_[\]<>]/g, (c) => '\\' + c)
}

/**
 * Render a release's entries (Features / Fixes / Other) as Markdown bullet
 * sections, shared by the aggregate and per-release `.md` endpoints so the two
 * can't drift. `headingLevel` is the `#` count for the section headers (the
 * aggregate nests sections under a per-release `##`, so it passes 3; the
 * per-release page is the top-level doc, so it passes 2). Titles are escaped
 * (see escapeMarkdownInline); the curated `community` area is hidden to match
 * the HTML.
 */
export function renderEntrySectionsMd(entries: ChangelogEntry[], headingLevel: number): string[] {
  const hashes = '#'.repeat(headingLevel)
  const { features, fixes, other } = groupEntries(entries)
  const out: string[] = []
  const section = (title: string, items: ChangelogEntry[]) => {
    if (!items.length) return
    out.push('', `${hashes} ${title}`)
    for (const e of items) {
      const tags = e.areas.filter((a) => !HIDDEN_AREAS.has(a))
      const areas = tags.length ? ` [${tags.join(', ')}]` : ''
      const pr = e.prUrl ? ` (${e.prUrl})` : ''
      out.push(`- ${escapeMarkdownInline(e.title)}${areas}${pr}`)
    }
  }
  section('Features', features)
  section('Fixes', fixes)
  section('Other', other)
  return out
}

const FEATURE_TYPES = new Set(['feat', 'breaking', 'perf'])
const FIX_TYPES = new Set(['fix'])

/**
 * All releases sorted newest first. Filtering by SDK/language happens
 * client-side on the page. Ties on date are broken by version (newest first)
 * then id, so same-day releases (e.g. typescript rc.0 and rc.1) get a stable,
 * loader-order-independent ordering — which the prev/next links depend on.
 */
export async function getReleases(): Promise<ChangelogRelease[]> {
  const releases = await getCollection('changelog')
  return releases.sort((a, b) => {
    const byDate = b.data.date.getTime() - a.data.date.getTime()
    if (byDate !== 0) return byDate
    const byVersion = compareVersionDesc(a.data.version, b.data.version)
    if (byVersion !== 0) return byVersion
    return a.id.localeCompare(b.id)
  })
}

/**
 * URL slug for a release, e.g. `sdk/python-v1.43.0`, `evals/v0.2.1`.
 * Derived from frontmatter (NOT collection `id`): the glob loader slugifies ids
 * with github-slugger, which strips the dots from version numbers and would
 * make `/changelog/sdk/python-v1430/` (ugly and ambiguous). This keeps the
 * dotted version the team chose. Used for both the route param and links so
 * they always match.
 */
export function releaseSlug(r: ChangelogRelease): string {
  const file = r.data.language ? `${r.data.language}-v${r.data.version}` : `v${r.data.version}`
  return `${r.data.sdk}/${file}`
}

/**
 * Build the getStaticPaths array for the per-release routes, asserting slug
 * uniqueness. Two files mapping to the same slug (e.g. a duplicated sdk+lang+
 * version) would otherwise collide into one route silently; fail the build fast
 * with a clear message instead.
 */
export interface ReleasePathProps {
  release: ChangelogRelease
  newer: ChangelogRelease | null
  older: ChangelogRelease | null
  // Astro's GetStaticPathsItem requires props to be index-signature compatible.
  [key: string]: unknown
}

export async function getReleasePaths(): Promise<Array<{ params: { release: string }; props: ReleasePathProps }>> {
  const releases = await getReleases()
  const seen = new Map<string, string>()
  // Compute same-stream prev/next neighbors here (once) and pass them as props,
  // so detail pages don't each re-read the whole collection to find them.
  return releases.map((release) => {
    const slug = releaseSlug(release)
    if (seen.has(slug)) {
      throw new Error(`changelog: duplicate release slug "${slug}" from ${release.id} and ${seen.get(slug)}`)
    }
    seen.set(slug, release.id)
    const { newer, older } = getStreamNeighbors(release, releases)
    return { params: { release: slug }, props: { release, newer, older } }
  })
}

/** A release belongs to a stream identified by sdk + language (evals has none). */
function streamKey(r: ChangelogRelease): string {
  return `${r.data.sdk}:${r.data.language ?? ''}`
}

/**
 * Newer/older neighbours of `release` within its own stream (same sdk+language),
 * for prev/next links on the detail page. `newer`/`older` are relative to date;
 * either may be null at the ends of the stream.
 */
function getStreamNeighbors(
  release: ChangelogRelease,
  all: ChangelogRelease[]
): { newer: ChangelogRelease | null; older: ChangelogRelease | null } {
  const key = streamKey(release)
  const stream = all.filter((r) => streamKey(r) === key) // `all` is newest-first
  const i = stream.findIndex((r) => r.id === release.id)
  return {
    newer: i > 0 ? stream[i - 1] ?? null : null,
    older: i >= 0 && i < stream.length - 1 ? stream[i + 1] ?? null : null,
  }
}

interface GroupedEntries {
  features: ChangelogEntry[]
  fixes: ChangelogEntry[]
  other: ChangelogEntry[]
}

/** Group a version's entries into Features / Fixes / Other, breaking changes first within features. */
export function groupEntries(entries: ChangelogEntry[]): GroupedEntries {
  const features = entries.filter((e) => FEATURE_TYPES.has(e.type))
  features.sort((a, b) => Number(b.breaking || b.type === 'breaking') - Number(a.breaking || a.type === 'breaking'))
  return {
    features,
    fixes: entries.filter((e) => FIX_TYPES.has(e.type)),
    other: entries.filter((e) => !FEATURE_TYPES.has(e.type) && !FIX_TYPES.has(e.type)),
  }
}

export interface AreaCount {
  area: string
  count: number
}

// Areas suppressed from the facet sidebar and entry tags. `community` is a
// contribution-origin label, not a product area — surfacing it implied
// community work was a separate track from the rest of the changelog.
export const HIDDEN_AREAS = new Set(['community'])

/**
 * Count entries per area across the given entries, sorted by count desc then
 * name. Only the curated `areas` field counts — raw conventional-commit scopes
 * are deliberately NOT folded in (they're an unbounded vocabulary: `tests`,
 * `readme`, `gemini`, … which polluted the filter sidebar). Area values come
 * from `area-*` labels or the backfill classifier, both on the canonical
 * taxonomy. Must mirror the client-side `entryAreas` in the page script.
 */
export function getAreaCounts(entries: ChangelogEntry[]): AreaCount[] {
  const map = new Map<string, number>()
  for (const e of entries) {
    for (const area of e.areas) {
      if (HIDDEN_AREAS.has(area)) continue
      map.set(area, (map.get(area) ?? 0) + 1)
    }
  }
  return [...map.entries()]
    .map(([area, count]) => ({ area, count }))
    .sort((a, b) => b.count - a.count || a.area.localeCompare(b.area))
}

export function formatChangelogDate(date: Date): string {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

```

### Core Architecture Module: `site/src/util/clipboard.ts`
```
/**
 * Shared copy-to-clipboard button wiring with "copied!" feedback, reused by the
 * code terminals.
 *
 * (InstallCommand.astro keeps its own inline copy handler: its script is
 * `is:inline` so it can render the pip/npm command before paint, and inline
 * scripts can't import this module.)
 */
/**
 * Analytics descriptor for a copy button. On a successful copy the helper fires
 * a `strands:copy` CustomEvent whose `detail.label` is `surface` (optionally
 * `surface:detail`), e.g. `install:pip`, `install:npm`, `code:use-cases:Python`,
 * and whose `detail.text` is the exact copied string. Analytics.astro listens
 * for `strands:copy` and routes it into the (consent-gated) WebSDK, logging the
 * first line of the text so we can tell which command/snippet was copied. This
 * helper stays decoupled from the analytics transport.
 */
export interface CopyTrack {
  surface: string
  /** Optional sub-label resolved at click time, e.g. the language or command. */
  detail?: () => string | null | undefined
}

export const COPY_EVENT = 'strands:copy'

export interface CopyButtonOptions {
  /** Returns the text to copy at click time (read lazily so it can follow UI state). */
  getText: () => string
  /** Element whose text shows the copy/copied label. Defaults to the button itself. */
  label?: HTMLElement | null
  /** Class toggled on the button while in the copied state. */
  activeClass?: string
  idleText?: string
  copiedText?: string
  resetMs?: number
  /** Fires a `strands:copy` analytics event on a successful copy. */
  track?: CopyTrack
}

export function attachCopyButton(button: HTMLElement, options: CopyButtonOptions): void {
  const {
    getText,
    label = null,
    activeClass = 'is-copied',
    idleText = 'copy',
    copiedText = 'copied!',
    resetMs = 1600,
    track,
  } = options
  const target = label ?? button
  let resetTimer: number | undefined

  button.addEventListener('click', () => {
    const text = getText()
    if (!text) return
    navigator.clipboard
      .writeText(text)
      .then(() => {
        button.classList.add(activeClass)
        target.textContent = copiedText
        if (resetTimer) window.clearTimeout(resetTimer)
        resetTimer = window.setTimeout(() => {
          button.classList.remove(activeClass)
          target.textContent = idleText
        }, resetMs)

        if (track) {
          const sub = track.detail?.()
          const label = sub ? `${track.surface}:${sub}` : track.surface
          window.dispatchEvent(new CustomEvent(COPY_EVENT, { detail: { label, text } }))
        }
      })
      .catch((err) => {
        console.error('Copy to clipboard failed:', err)
        target.textContent = 'failed'
        if (resetTimer) window.clearTimeout(resetTimer)
        resetTimer = window.setTimeout(() => {
          target.textContent = idleText
        }, resetMs)
      })
  })
}

```

### Core Architecture Module: `site/src/util/current-product.ts`
```
import { navLinks, products } from '../config/navbar'
import type { Product } from '../sidebar'

// Sections that are products (have a slug + hub). Examples/Community are docs
// sections but not products, so they get no product eyebrow/switcher.
// Must match the navbar labels in navigation.yml exactly; a stale entry silently
// drops that product's hub hero and sidebar box.
const PRODUCT_LABELS = new Set(['Harness', 'Harness SDK', 'Shell', 'Evals'])

/**
 * The product whose section the given path falls in, by longest-basePath match
 * against the navbar — the same rule the sidebar-scoping middleware uses.
 * Returns undefined on non-product pages (Examples, Community, API, home).
 */
export function currentProduct(pathname: string): Product | undefined {
  let bestLabel: string | undefined
  let bestLen = 0
  for (const link of navLinks) {
    if (link.external || !PRODUCT_LABELS.has(link.label)) continue
    const bps = link.basePath ? (Array.isArray(link.basePath) ? link.basePath : [link.basePath]) : [link.href]
    for (const bp of bps) {
      if (pathname.startsWith(bp) && bp.length > bestLen) {
        bestLabel = link.label
        bestLen = bp.length
      }
    }
  }
  return bestLabel ? products.find((p) => p.label === bestLabel) : undefined
}

```

### Core Architecture Module: `site/src/util/expire-events.ts`
```
// Build-time filtering is the primary gate; this is the client-side freshness backstop.

/** Remove expired `[data-expires]` elements, then hide/adjust bulletin and poster. */
export function expireEvents(root: Document | Element, todayIso: string): void {
  root.querySelectorAll<HTMLElement>('[data-expires]').forEach((el) => {
    if (el.dataset.expires! < todayIso) el.remove()
  })

  // Non-event rows (no data-expires) keep the bulletin alive; hide it only when rowless.
  const bulletin = root.querySelector<HTMLElement>('.bulletin')
  if (bulletin && !bulletin.querySelector('.row')) bulletin.hidden = true

  const poster = root.querySelector<HTMLElement>('.poster')
  if (poster) {
    const list = poster.querySelector<HTMLElement>('.list')
    if (list) {
      if (!list.querySelector('[data-expires]')) {
        list.remove()
      } else if (!poster.querySelector('#poster-headliner')) {
        // list--bare removes border-top so the list doesn't float with a gap when headliner expired
        list.classList.add('list--bare')
      }
    }
    if (!poster.querySelector('[data-expires]')) {
      const evergreen = root.querySelector<HTMLElement>('#poster-evergreen')
      if (evergreen) evergreen.removeAttribute('hidden')
      const cal = root.querySelector<HTMLElement>('#poster-cal')
      if (cal) cal.textContent = 'Join the Discord →'
    }
  }
}

```

### Core Architecture Module: `site/src/util/github.ts`
```
const ORG = 'strands-agents'
const FALLBACK = '6,100+'
const TIMEOUT_MS = 5000
const MAX_PAGES = 5

// Fetched once per build and shared across every page render, so the header
// shows the same count everywhere and a large build doesn't exhaust GitHub's
// unauthenticated rate limit by issuing one request per page.
let cached: Promise<string> | undefined

export function getStarCount(): Promise<string> {
  return (cached ??= computeStarCount())
}

async function computeStarCount(): Promise<string> {
  const total = await sumOrgStars()
  if (total <= 0) return FALLBACK
  return (Math.floor(total / 100) * 100).toLocaleString() + '+'
}

// Sum stargazers across every non-fork public repo in the org, so the count
// reflects all of Strands rather than the harness SDK alone. Returns 0 on any
// failure so the caller falls back to a static count.
async function sumOrgStars(): Promise<number> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    let total = 0
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetch(
        `https://api.github.com/orgs/${ORG}/repos?per_page=100&type=public&page=${page}`,
        { signal: controller.signal }
      )
      if (!res.ok) return total
      const repos = (await res.json()) as Array<{ stargazers_count?: number; fork?: boolean }>
      if (!Array.isArray(repos) || repos.length === 0) return total
      for (const repo of repos) {
        if (!repo.fork) total += repo.stargazers_count ?? 0
      }
      if (repos.length < 100) return total
    }
    return total
  } catch {
    return 0
  } finally {
    clearTimeout(timeout)
  }
}

```

### Core Architecture Module: `site/src/util/html-to-markdown.ts`
```
import TurndownService from 'turndown'
import { gfm } from 'turndown-plugin-gfm'
import { isLocalLink, toRawMarkdownUrl } from './links'

export interface HtmlToMarkdownOptions {
  /** Heading style: 'setext' (underlined) or 'atx' (# prefixed) */
  headingStyle?: 'setext' | 'atx'
  /** Horizontal rule character */
  hr?: string
  /** Bullet list marker */
  bulletListMarker?: '-' | '+' | '*'
  /** Code block style: 'indented' or 'fenced' */
  codeBlockStyle?: 'indented' | 'fenced'
  /** Fence character for code blocks */
  fence?: '```' | '~~~'
  /** Emphasis delimiter */
  emDelimiter?: '_' | '*'
  /** Strong delimiter */
  strongDelimiter?: '__' | '**'
  /** Link style: 'inlined' or 'referenced' */
  linkStyle?: 'inlined' | 'referenced'
  /** Link reference style */
  linkReferenceStyle?: 'full' | 'collapsed' | 'shortcut'
}

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com'])

function isYouTubeHost(href: string): boolean {
  try {
    return YOUTUBE_HOSTS.has(new URL(href).hostname)
  } catch {
    return false
  }
}

/**
 * Creates a configured TurndownService instance for HTML to Markdown conversion.
 * Returns the service so you can add custom rules before converting.
 */
export function createTurndownService(options: HtmlToMarkdownOptions = {}): TurndownService {
  const service = new TurndownService({
    headingStyle: options.headingStyle ?? 'atx',
    hr: options.hr ?? '---',
    bulletListMarker: options.bulletListMarker ?? '-',
    codeBlockStyle: options.codeBlockStyle ?? 'fenced',
    fence: options.fence ?? '```',
    emDelimiter: options.emDelimiter ?? '*',
    strongDelimiter: options.strongDelimiter ?? '**',
    linkStyle: options.linkStyle ?? 'inlined',
    linkReferenceStyle: options.linkReferenceStyle ?? 'full',
  })

  service.use(gfm)

  service.addRule('removeSrOnly', {
    filter: (node) => {
      if (node.nodeType !== 1) return false
      const el = node as Element
      const className = el.getAttribute?.('class') || ''
      return className.includes('sr-only')
    },
    replacement: () => '',
  })

  service.addRule('removeScripts', {
    filter: 'script',
    replacement: () => '',
  })

  // Removes lite-youtube and its Play anchor so .md/llms-full.txt don't emit bare '[Play](url)' lines.
  service.addRule('removeLiteYouTube', {
    filter: (node) => {
      if (node.nodeName === 'LITE-YOUTUBE') return true
      if (node.nodeName === 'A') {
        const el = node as Element
        const className = el.getAttribute?.('class') || ''
        if (className.includes('lty-playbtn')) return true
        // hostname parsed, not substring-matched, so lookalike hosts don't count
        const href = el.getAttribute?.('href') || ''
        const text = el.textContent?.trim() || ''
        if (text.toLowerCase() === 'play' && isYouTubeHost(href)) return true
      }
      return false
    },
    replacement: () => '',
  })

  service.addRule('removeAnchorLinks', {
    filter: (node) => {
      if (node.nodeName !== 'A') return false
      const el = node as Element
      const className = el.getAttribute?.('class') || ''
      if (className.includes('sl-anchor-link')) return true
      const href = el.getAttribute?.('href') || ''
      if (href.startsWith('#')) {
        const text = el.textContent?.replace(/\s/g, '') || ''
        return text === ''
      }
      return false
    },
    replacement: () => '',
  })

  service.addRule('removeTabList', {
    filter: (node) => {
      if (node.nodeName !== 'UL') return false
      const el = node as Element
      return el.getAttribute?.('role') === 'tablist'
    },
    replacement: () => '',
  })

  service.addRule('tabPanel', {
    filter: (node) => {
      if (node.nodeName !== 'DIV') return false
      const el = node as Element
      return el.getAttribute?.('role') === 'tabpanel'
    },
    replacement: (content, node) => {
      const el = node as Element
      const labelledBy = el.getAttribute?.('aria-labelledby') || ''

      let tabLabel = ''
      if (labelledBy) {
        const parent = el.parentElement
        if (parent) {
          const tabLink = parent.querySelector?.(`#${labelledBy}`)
          if (tabLink) {
            tabLabel = tabLink.textContent?.trim() || ''
          }
        }
      }

      if (tabLabel) {
        return `\n\n(( tab "${tabLabel}" ))\n${content.trim()}\n(( /tab "${tabLabel}" ))\n\n`
      }
      return content
    },
  })

  // Added before expressiveCodeBlock; Turndown checks last-added first, so expressiveCodeBlock wins.
  service.addRule('fencedCodeBlock', {
    filter: (node, options) => {
      return (
        options.codeBlockStyle === 'fenced' &&
        node.nodeName === 'PRE' &&
        node.firstChild !== null &&
        node.firstChild.nodeName === 'CODE'
      )
    },
    replacement: (_content, node, options) => {
      const codeNode = node.firstChild as Element
      const className = codeNode.getAttribute?.('class') || ''
      // Extract language from class like "language-typescript" or "lang-ts"
      const langMatch = className.match(/(?:language-|lang-)(\w+)/)
      const language = langMatch ? langMatch[1] : ''
      const code = codeNode.textContent || ''

      const fence = options.fence || '```'
      return `\n\n${fence}${language}\n${code.replace(/\n$/, '')}\n${fence}\n\n`
    },
  })

  service.addRule('expressiveCodeBlock', {
    filter: (node) => {
      if (node.nodeName !== 'PRE') return false
      const lang = node.getAttribute?.('data-language')
      return lang != null
    },
    replacement: (_content, node, options) => {
      const language = node.getAttribute?.('data-language') || ''
      const fence = options.fence || '```'

      const lines: string[] = []
      function walk(el: Element | ChildNode) {
        if (el.nodeType === 1) {
          const element = el as Element
          const className = element.getAttribute?.('class') || ''
          if (className.includes('ec-line')) {
            lines.push(element.textContent?.replace(/\n/g, '') || '')
          } else {
            const children = element.childNodes || []
            for (let i = 0; i < children.length; i++) {
              walk(children[i] as Element)
            }
          }
        }
      }
      walk(node as Element)

      const code = lines.length > 0 ? lines.join('\n') : (node.textContent || '')
      return `\n\n${fence}${language}\n${code}\n${fence}\n\n`
    },
  })

  service.addRule('rewriteLocalLinks', {
    filter: (node) => {
      if (node.nodeName !== 'A') return false
      const el = node as Element
      const href = el.getAttribute?.('href') || ''
      return isLocalLink(href)
    },
    replacement: (content, node) => {
      const el = node as Element
      const href = el.getAttribute?.('href') || ''
      const title = el.getAttribute?.('title')
      const newHref = toRawMarkdownUrl(href)

      return title ? `[${content}](${newHref} "${title}")` : `[${content}](${newHref})`
    },
  })

  return service
}

/**
 * Converts HTML string to Markdown.
 */
export function htmlToMarkdown(html: string, options: HtmlToMarkdownOptions = {}): string {
  const service = createTurndownService(options)
  return service.turndown(html)
}

/** Convert HTML to Markdown with additional Turndown rules configured via a callback. */
export function htmlToMarkdownWithRules(
  html: string,
  configureService: (service: TurndownService) => void,
  options: HtmlToMarkdownOptions = {}
): string {
  const service = createTurndownService(options)
  configureService(service)
  return service.turndown(html)
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4889** (2026-10-05): **fix(bidi): emit OpenAI usage before response stop**
  *Symptoms*: ## Human Overview <!-- If an AI agent drafted this PR, a human must give a short overview here in their own words. -->  ## Description  OpenAI attaches usage to `response.done`, but the adapter emitted it after `BidiResponseStopEvent`, so consumers stopping at that boundary could miss the response's usage. Emit usage before response stop, after content finishes.  Document usage events and their token deltas, and show usage before stop in the main event timeline. Call out that Nova Sonic currently reports usage independently of response boundaries.  ## Related Issues  Follow-up to #4886.  ## Documentation PR  Included in this PR.  ## Type of Change  Bug fix  ## Testing  Pre-push checks passed: 7,390 Python tests, Ruff/mypy, the production docs build and broken-link check, site and snippet type checks, and 619 site tests. Browser checks verified the diagram, usage links, and Nova note in light/dark themes and at mobile width.  - [x] I ran `hatch run prepare`  ## Additional Details  <!-- Optional extended context. -->  ## Checklist  - [x] I have read the CONTRIBUTING document - [x] I have reviewed and understand every line of code in this PR, including any generated by AI tools, and I can explain why it works - [x] My change is focused and reasonably small; I have split unrelated work into separate PRs - [x] I have added any necessary tests that prove my fix is effective or my feature works - [x] I have updated the documentation accordingly - [x] I have added an appropriate exam
  **Post-Mortem & Fix Analysis**:
  > **Assessment**: Approve  Tight, well-scoped fix. Moving `BidiResponseStopEvent` to after the usage append in `_complete_response` correctly aligns the emitted order with OpenAI's `response.done` semantics and the documented ordering, so consumers that stop at the response boundary no longer miss usage. Code, tests, and docs are consistent.  <details> <summary>Review Categories</summary>  - **Correctness**: Fix matches the documented ordering; verified duplicate `response.done` events are deduplicated via `active_responses`, so moving usage before stop does not risk double-counting. - **Testing**: Both the unit test and the native-order integration test assert on full event-list equality (`tru_events == exp_events`) rather than per-field, covering completed/cancelled and detail/no-detail paths. - **Docs**: Event families, the ordering list, the sequence diagram, and the Nova Sonic independent-usage caveat are updated coherently with the behavior change. - **API**: No new public surface 
  > ## [Codecov](https://app.codecov.io/gh/strands-agents/harness-sdk/pull/4889?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=strands-agents) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)
  > ## Documentation Preview Ready  Your documentation preview has been successfully deployed!  **Changed pages:**  - [user-guide/sdk/bidi/events](https://d3ehv1nix5p99z.cloudfront.net/pr-cms-4889/docs/user-guide/sdk/bidi/events/)  _Updated at: 2026-10-05T16:31:35.844Z_

- **Issue #4882** (2026-10-05): **fix: broaden Mantle gpt-6 prefix to cover dot-separated model ids**
  *Symptoms*: ## Description  Mantle onboarded `openai.gpt-6.1-sol`, which uses a dot after the major version instead of a dash. The existing `openai.gpt-6-` prefix in the routing table does not match it, so the SDK routes requests to `/v1`. This causes HTTP 400s because Mantle serves this model from `/openai/v1`.  The `mantle-routing` integration test catches this as drift and fails on the main branch:  ``` expected { 'openai.gpt-6.1-sol': '/v1' } to deeply equal {} ```  Broadening the prefix to `openai.gpt-6-` and `openai.gpt-6.` covers the entire gpt-6 family regardless of whether Mantle uses a dash or dot after the major version.  ## Related Issues  <!-- Link to related issues using #issue-number format -->  ## Documentation PR  <!-- No documentation changes needed -->  ## Type of Change  Bug fix  ## Testing  The `mantle-routing` integ test that detected this drift will pass with the broadened prefix. Unit tests pass locally (pre-commit hook ran successfully).  - [x] I ran `hatch run prepare`  ## Checklist - [x] I have read the CONTRIBUTING document - [x] I have reviewed and understand every line of code in this PR, including any generated by AI tools, and I can explain why it works - [x] My change is focused and reasonably small; I have split unrelated work into separate PRs - [x] I have added any necessary tests that prove my fix is effective or my feature works - [x] I have updated the documentation accordingly - [x] I have added an appropriate ex
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/strands-agents/harness-sdk/pull/4882?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=strands-agents) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)
  > **Issue**: The fix lacks a unit regression test for the exact id that motivated it. The parametrized routing tests cover only dash forms (`openai.gpt-6-astra`, `openai.gpt-6-nova`) in `strands-py/tests/strands/models/test_openai.py`, `test_openai_responses.py`, and `strands-ts/.../__tests__/mantle.test.ts`. No unit test exercises a dot-separated id (`openai.gpt-6.1-sol`). The only coverage is the `mantle-routing` integ test, which runs against the live catalog in a separate workflow and does not gate this PR's unit path — so a future refactor of the prefix table could silently reintroduce the HTTP 400.  **Suggestion**: Add `("openai.gpt-6.1-sol", "/openai/v1")` (and ideally a `/v1` control such as `("openai.gpt-6oss-20b", "/v1")` to pin that the prefix does not over-match) to the existing parametrized cases in all three test files. These are one-line additions to tables you already maintain.
  > **Assessment**: Request Changes  Correct root-cause diagnosis and a minimal cross-SDK fix, but two things should be addressed before merge: the broadening is wider than needed, and the dot-separated id that triggered the bug isn't locked in by a unit test.  <details> <summary>Review Categories</summary>  - **Prefix scoping**: The bare `openai.gpt-6` prefix departs from this table's documented "one model line per prefix" principle and the dot-anchored `openai.gpt-5.` sibling; two anchored prefixes (`openai.gpt-6-`, `openai.gpt-6.`) cover the family without risking future over-matches. - **Testing**: The exact failing id (`openai.gpt-6.1-sol`) has no unit coverage — only the live-catalog integ test catches it. A one-line addition to the existing parametrized tables (plus a `/v1` control) would prevent silent regressions. - **Consistency**: Both findings apply symmetrically to the Python and TypeScript tables, which the PR correctly keeps in sync.  </details>  Nice job tracing the `/v1` v

- **Issue #4856** (2026-10-05): **fix(site): improve mobile and small-screen usability**
  *Symptoms*: ## Human Overview <!-- If an AI agent drafted this PR, a human must give a short overview here in their own words. An AI agent MUST NOT fill out this section.      See team/AI_USAGE_POLICY.md. (50 words) -->  ## Description  The site has several problems on phones and mid-size screens. Search and the language toggle are hidden whenever the nav is collapsed. The mobile menu loses your place in the sidebar and doesn't act like a modal. Integrations has no search or type filter below 50rem. Wide tables and code clip without any cue, and the changelog filter drawer has no way to close. This PR fixes each of these without changing the desktop layout. There is one commit per fix so each can be reviewed or reverted on its own.  Screenshots are iPhone 13 (390px, 2x, dark theme) unless a width is given. **Left/top: strandsagents.com today. Right/bottom: this branch.**  ### 1. Search button in the collapsed header Below 78rem the only way to reach search was through the hamburger menu. A search icon now sits beside the menu button and opens the same Pagefind dialog.  ![search](https://raw.githubusercontent.com/yonib05/harness-sdk-fork/pr-assets/mobile-improvements/mobile-improvements/cmp-01-search.png)  ### 2. Language toggle below 78rem The TS/Python toggle was hidden along with the rest of the expanded nav, so below 78rem it could only be reached from the bottom of the menu. From 50rem it now sits next to the collapsed search button (1000px shown). On phones it sits in the "On this p
  **Post-Mortem & Fix Analysis**:
  > **Assessment**: Comment (non-blocking)  A thorough, accessibility-conscious mobile pass — the per-commit-per-fix structure and the candid "known issues" list make this far easier to reason about than its size suggests. Feedback below is advisory; nothing here blocks merge.  <details> <summary>Review Categories</summary>  - **Scope**: 20 files / 13 independent fixes and >400 added lines sits at the edge of our "split it up" threshold. The one-commit-per-fix hygiene mitigates it well, but independent fixes like the scroll-shadow CSS, the API-title wrapping, and the integrations filter bar could ship as separate PRs to shrink review/revert surface. - **Testing**: The new interactive behaviors (modal `inert` handling, header-hide-on-scroll, drawer focus management) have no automated coverage. That matches the repo convention of not unit-testing inline `.astro` scripts, but a couple of these contain pure logic (header-hide decision, API-title splitting) that would be cheap to extract into `
  > ## Documentation Preview Ready  Your documentation preview has been successfully deployed!  **Changed pages:**  - [blog](https://d3ehv1nix5p99z.cloudfront.net/pr-cms-4856/blog/) - [changelog](https://d3ehv1nix5p99z.cloudfront.net/pr-cms-4856/changelog/) - [integrations](https://d3ehv1nix5p99z.cloudfront.net/pr-cms-4856/integrations/)  _Updated at: 2026-10-05T17:24:51.127Z_

- **Issue #4835** (2026-10-02): **fix(injection): remove \n\n separator that causes empty-message replies on tool-result turns**
  *Symptoms*: ## Description  PR #3704 added a `"\n\n"` separator when folding injected text into the last user message. On tool-result continuation turns (cycle 2+), this causes the model to intermittently reply *"It looks like your message came through empty"* instead of synthesizing from the tool result.  The failure occurs because the only text block in the tool-result turn opens with blank lines (`"\n\n<page_context_instructions>..."`), which the model interprets as empty user content. The tool result is present and correct — the model generates the fallback itself.  A controlled A/B reproduction isolated the `"\n\n"` separator as the single variable:  | Arm | Change | Trials | Failures | |-----|--------|--------|----------| | A | stock (with `\n\n`) | 100 | 71 | | B | separator removed | 100 | 0 |  This removes the separator in both Python and TypeScript SDKs.  ## Related Issues  N/A  ## Type of Change  Bug fix  ## Testing  - [x] I ran `hatch run prepare` - [x] I ran `npm run check`  ## Checklist - [x] I have read the CONTRIBUTING document - [x] I have reviewed and understand every line of code in this PR, including any generated by AI tools, and I can explain why it works - [x] My change is focused and reasonably small; I have split unrelated work into separate PRs - [x] I have added any necessary tests that prove my fix is effective or my feature works - [x] I have updated the documentation accordingly - [x] I have added an appropriate example to t
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/strands-agents/harness-sdk/pull/4835?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=strands-agents) Report :x: Patch coverage is `0%` with `1 line` in your changes missing coverage. Please review. | [Files with missing lines](https://app.codecov.io/gh/strands-agents/harness-sdk/pull/4835?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=strands-agents) | Patch % | Lines | |---|---|---| | [...nds-py/src/strands/injection/\_message\_injection.py](https://app.codecov.io/gh/strands-agents/harness-sdk/pull/4835?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=strands-agents#diff-c3RyYW5kcy1weS9zcmMvc3RyYW5kcy9pbmplY3Rpb24vX21lc3NhZ2VfaW5qZWN0aW9uLnB5) | 0.00% | [1 Missing :warning: ](https://app.codecov.io/gh/strands-agents/harness-sdk/pull/4835?s
  > **Assessment**: Comment (non-blocking)  Clean, minimal, well-evidenced fix — the A/B data (71→0 failures) makes a strong case, and the change is applied symmetrically across both SDKs with consistent, full-object test updates. My feedback is about hardening the fix at its root rather than any objection to the approach.  <details> <summary>Review themes</summary>  - **Preserve removed rationale**: The deleted comment documented real provider behavior (adjacent text-block concatenation). Removing the separator globally subtly reverts #3704's intent on the plain-user-ask path; worth keeping a short note on why removal is now safe. - **Fix the root cause, not just the symptom**: The failure is a text block *beginning with blank lines*. A `render_content` returning leading whitespace would reintroduce it, so consider `lstrip`/normalizing (or documenting the invariant) at the boundary. - **Regression coverage**: Tests lock in the new literal output but don't encode the "block must not start 

- **Issue #4813** (2026-10-02): **fix(bidi): save sessions before restart and document checkpoints**
  *Symptoms*: ## Human Overview <!-- Please add a short overview in your own words. -->  ## Description  Connection restarts bypass `BidiAgentStopEvent`, leaving the `"stop"` save strategy and snapshot triggers inactive during a long-running conversation. Apply the same save behavior at `BidiBeforeConnectionRestartEvent`, after user hooks have updated state and before replacing the connection.  Replace the session-management placeholder with examples for saving and resuming conversations, selecting a save strategy, and restoring stored checkpoints. Explain how retained checkpoints differ from the latest snapshot used for automatic resume, and link to the shared guides for storage and snapshot APIs.  ## Related Issues  Related to strands-agents/private-harness-sdk-staging#517.  ## Documentation PR  Included in this PR under `site/`.  ## Type of Change  Bug fix  ## Testing  Passed the full Python suite with coverage (7,357 passed, 31 skipped), the production docs build, 619 site tests, site and snippet type checks, and full Python lint, formatting, and type checks. Ran both documentation examples with real file storage and a mocked provider, and checked the local preview.  - [x] I ran `hatch run prepare`  ## Additional Details  <details> <summary>Type-checker compatibility</summary>  Cap the development and CI dependencies at `mypy<2.4.0`. The unchanged source passes all 335 checked files with mypy 2.3, while 2.4 reports errors for an async hook method and reversed message lists. With the ca
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/strands-agents/harness-sdk/pull/4813?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=strands-agents) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)
  > ## Documentation Preview Ready  Your documentation preview has been successfully deployed!  **Changed pages:**  - [user-guide/sdk/bidi/session-management](https://d3ehv1nix5p99z.cloudfront.net/pr-cms-4813/docs/user-guide/sdk/bidi/session-management/)  _Updated at: 2026-10-02T13:54:27.501Z_

- **Issue #4796** (2026-10-02): **[BUG] Python context manager: summaries merge into message 0 and can't be reduced, so long sessions end in permanent overflow**
  *Symptoms*: ### Human Overview  I checked whether #4685 also hits Python. It looks like it does. Every summary gets merged into message 0. Nothing's allowed to shrink message 0. On the harness default, a long session ends up raising `ContextWindowOverflowException` on every call without recovering.. I'd fix both SDKs the same way.  ### Checks  - [x] I have updated to the lastest minor and patch version of Strands - [x] I have checked the documentation and this is not expected behavior - [x] I have searched ./issues and there are no duplicates of my issue  ### SDK Language  Python  ### Strands Version  1.57.1 (also on main at 456b15f)  ### Language Runtime Version  Python 3.12.5  ### Operating System  macOS  ### Installation Method  git clone  ### Steps to Reproduce  #4685 describes a ratchet in the TypeScript context manager: summaries get merged into message 0, and message 0 is never reduced. I checked the Python port and it has the same three steps, so `Agent(context_manager="auto")` behaves the same way. `"auto"` is also the harness default (`harness-py/src/strands_harness/defaults.py:9`).  1. `SummarizeStrategy._apply_per_message` adds each summary as a new `user` message at `max(1, lowest_index)`, then calls `_repair_alternation` (`strands-py/src/strands/_context_manager/strategies/offload/summarize.py:111-118`). 2. `_repair_alternation` merges consecutive same-role messages (`offload/base.py:214`). When the summarized span starts at index 1, the summary lands right after user messa
  **Post-Mortem & Fix Analysis**:
  > Reporter here. Before picking a direction I went through all four fix directions from #4685 against the Python code.  Two of them don't fix it in Python: - Keep the newest tool call and its result out of summarization. Python already does this by default. The "auto" setting never summarizes the newest 4 messages (preserve_recent=4), and the script in this issue still ends with every call overflowing. - Stop the agent when it keeps fetching the same large tool output back from storage. That ends the loop #4685 ran into, but it never touches message 0. Message 0 is the first message in the conversation, the user's original prompt, and it keeps growing either way.  The third fix, keeping each summary as its own message, needs a deeper change. After every edit, the context manager merges any two neighboring messages that have the same role, so user and assistant messages keep alternating (`_repair_alternation`). A summary is added as a user message, and message 0 is also a user message. So
  > Thanks for reporting @roshangardi . Instead of tracking this separately, I'll add the Python case to #4685

- **Issue #4792** (2026-10-01): **fix(bidi): confirm OpenAI interruptions and fix console rendering**
  *Symptoms*: ## Human Overview * Remove empty whitespace around ConsoleIO output. Makes copying and pasting output from terminal pick up too many empty characters. * Stop sending barge in event on every user start speech in openai. We should only emit barge in when the model says so.  ## Description  OpenAI reports speech starts even when no assistant response is active, causing false barge-in events. Require a cancelled response with reason `turn_detected` before signaling an interruption. Consequently, speech after response generation completes does not clear queued audio without server confirmation.  ConsoleIO pads completed lines to the terminal width, leaving unnecessary spaces when users copy transcript text. Trim unstyled scrollback padding while retaining the spaces that draw the gray user box.  ## Related Issues  None.  ## Documentation PR  No documentation changes required.  ## Type of Change  Bug fix  ## Testing  Ran `bash .agents/skills/pre-push/run-checks.sh --base upstream/main`: formatting, lint, mypy, and 7,342 passing Python tests (31 skipped) on macOS/Python 3.14. Live OpenAI testing passed 12 cases covering idle speech, active interruption, completed generation with buffered playback, and client cancellation. Three terminal replays passed across terminal sizes, preserving transcript text and gray padding. Manual microphone/speaker testing used `audio_processor=True`. The full OS/Python matrix was not run locally.  - [x] I ran `hatch run prepare
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/strands-agents/harness-sdk/pull/4792?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=strands-agents) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)
  > **Assessment**: Comment (approve-leaning)  Well-scoped bug fix. Gating barge-in on a server-confirmed `cancelled` + `turn_detected` response correctly eliminates the false interruptions from OpenAI's idle `speech_started` events, and the console trim-vs-preserve-background logic is sound. Changes are small, focused, and backed by thorough tests.  <details> <summary>Review Categories</summary>  - **Correctness**: Barge-in now relies on server confirmation, consistent with the Google model's `interrupted` signal; event ordering (barge-in before audio stop) is correct for buffer clearing. - **Testing**: Strong — parametrized across color systems / completion states and cancellation reasons, using full-object equality assertions. 192 tests pass locally. - **Maintainability** (minor): One nested helper in `_display._print_blocks` could be flattened for readability/complexity; `_complete_response` docstring should mention the new barge-in emission. - **Scope**: Small diff, no cross-SDK (TS) 

- **Issue #4786** (2026-10-02): **fix(harness): log at info when the default web_search is unavailable**
  *Symptoms*: ## Human Overview <!-- If an AI agent drafted this PR, a human must give a short overview here in their own words. An AI agent MUST NOT fill out this section.      See team/AI_USAGE_POLICY.md. (50 words) -->  ## Description  `web_search` is on by default, but the default model (`bedrock/global.anthropic.claude-opus-5`) has no built-in web search. So a bare `create_harness()` / `createHarness()` printed a warning on every build, and the first thing a new user saw was a warning they didn't cause. The message also said to "drop 'web_search'", which doesn't mean anything when you never listed it.  This PR changes that case to an info-level log, which is silent under the default logging config in both languages. The message now says the tool is off and points to the docs for the Exa opt-in. An explicit `web_search` request on an unsupported model still raises, with a clearer message and a docs link.  The web-access docs page is reworded in place. It explains what happens on unsupported models and replaces "drop it from the list" with how to turn a tool off.  The Exa opt-in warning is unchanged on purpose.  Also adds `.agent` to `.gitignore` (local agent session files).  ## Related Issues  None.  ## Documentation PR  Included in this PR: `site/src/content/docs/user-guide/harness/tools/web-access.mdx`.  ## Type of Change  Bug fix  ## Testing  Updated the Python and TypeScript tests. The default-path tests now check for an `info` log and assert that nothing is logged at `warn`, inclu

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

### Incident Patch 1: `9b8ae359` (2026-10-06)
**Commit Message**: docs(blog): link Bidi Agent docs and quickstart (#4908)

**File**: `site/src/content/blog/bidi-agents-now-ga.mdx` (modified, +4/-0)
```diff
@@ -192,6 +192,10 @@ export OTEL_SEMCONV_STABILITY_OPT_IN="gen_ai_unredacted_attributes="
 
 This controls sensitive trace attributes. Application logs and persisted conversation history need their own data-handling configuration.
 
+## Learn more
+
+Explore the [Bidi Agent docs](/docs/user-guide/sdk/bidi/) for guides on models, tools, I/O, and session management. The [quickstart](/docs/user-guide/sdk/bidi/quickstart/) walks you through building a voice agent with tools.
+
 ## Frequently Asked Questions
 
 ### Can I reuse an existing Strands application?
```

---

### Incident Patch 2: `34173c17` (2026-10-05)
**Commit Message**: fix(site): improve mobile and small-screen usability (#4856)

Co-authored-by: strandly-the-agent <[REDACTED_EMAIL]>

**File**: `site/astro.config.mjs` (modified, +1/-0)
```diff
@@ -104,6 +104,7 @@ export default defineConfig({
         Hero: './src/components/overrides/Hero.astro',
         MarkdownContent: './src/components/overrides/MarkdownContent.astro',
         PageTitle: './src/components/overrides/PageTitle.astro',
+        PageSidebar: './src/components/overrides/PageSidebar.astro',
         Sidebar: './src/components/overrides/Sidebar.astro',
         PageFrame: './src/components/overrides/PageFrame.astro',
       },
```

**File**: `site/src/components/CommunityHub.astro` (modified, +1/-1)
```diff
@@ -238,7 +238,7 @@ const upcomingList = upcoming.slice(0, 4);
   .community__row-kicker {
     font-family: 'JetBrains Mono', ui-monospace, monospace;
     font-weight: 600;
-    font-size: 11px;
+    font-size: 12px;
     letter-spacing: 0.5px;
     text-transform: uppercase;
     color: var(--accent-green);
```

**File**: `site/src/components/Footer.astro` (modified, +4/-0)
```diff
@@ -418,13 +418,17 @@ const legal = [
       gap: 16px 24px;
     }
 
+    /* Line heights keep each tap target at least 24px tall. */
     .footer__link,
     .footer__pref {
       font-size: 16px;
+      line-height: 1.5;
     }
 
     .footer__legal-link {
+      display: inline-block;
       font-size: 13px;
+      line-height: 24px;
     }
   }
 </style>
```

**File**: `site/src/components/InteractiveToolkit.astro` (modified, +14/-4)
```diff
@@ -643,6 +643,13 @@ const cards = [
     cursor: pointer;
   }
 
+  /* 44px hit area around the 16px icon. */
+  .toolkit__card-open::before {
+    content: '';
+    position: absolute;
+    inset: -14px;
+  }
+
   .toolkit__card-open-icon {
     display: inline-flex;
     width: 100%;
@@ -811,7 +818,7 @@ const cards = [
     border: none;
     color: var(--terminal-fg, var(--strands-grey-600));
     font-family: inherit;
-    font-size: 11px;
+    font-size: 12px;
     line-height: 1;
     cursor: pointer;
   }
@@ -842,7 +849,7 @@ const cards = [
   .toolkit__card-terminal-code {
     margin: 0;
     padding: 16px 20px;
-    font-size: 11px;
+    font-size: 12px;
     line-height: 1.5;
     color: var(--terminal-fg, var(--fg));
     background: transparent;
@@ -852,7 +859,7 @@ const cards = [
     margin: 0;
     padding: 16px 20px;
     font-family: 'JetBrains Mono', ui-monospace, monospace;
-    font-size: 11px;
+    font-size: 12px;
     line-height: 1.5;
     color: var(--strands-grey-600);
     background: transparent;
@@ -1040,9 +1047,12 @@ const cards = [
       margin-top: 6px;
     }
 
+    .toolkit__card-tag {
+      font-size: 12px;
+    }
+
     .toolkit__card-terminal-code {
       padding: 12px 14px;
-      font-size: 10px;
     }
 
     .toolkit__card-view-more {
```

**File**: `site/src/components/LanguageToggle.astro` (modified, +2/-2)
```diff
@@ -1,7 +1,7 @@
 ---
 /**
  * Global Python/TypeScript language toggle, rendered identically in the header
- * right-cluster and the mobile menu. Reads/writes the shared AutoSyncTabs
+ * (full and collapsed), the mobile menu, and the mobile "On this page" bar. Reads/writes the shared AutoSyncTabs
  * localStorage key so the toggle and inline code tabs stay in sync, and on
  * language-specific pages navigates to the counterpart resolved at build time
  * (see util/language-switch.ts). Event-channel and key details are inline below.
@@ -80,7 +80,7 @@ const typescriptDisabled = resolvedLanguages !== undefined && !resolvedLanguages
 <style>
   /* Icon pill toggle.
      One control with identical sizing everywhere it appears — the header, the
-     mobile menu, and the homepage code cards. Each option shows the language's
+     mobile menu, the "On this page" bar, and the homepage code cards. Each option shows the language's
      logo; the text label is kept for screen readers only. */
   .language-toggle {
     display: inline-flex;
```

**File**: `site/src/components/MobileNavTree.astro` (modified, +13/-3)
```diff
@@ -12,6 +12,10 @@ interface Props {
 }
 
 const { items, depth = 0 } = Astro.props;
+
+const currentPath = Astro.url.pathname.replace(/\/?$/, '/');
+const containsCurrent = (item: ProductNavItem): boolean =>
+  item.type === 'link' ? item.href === currentPath : item.items.some(containsCurrent);
 ---
 
 <ul class="mnav" role="list">
@@ -21,6 +25,7 @@ const { items, depth = 0 } = Astro.props;
         <a
           href={item.href}
           class="mnav__link"
+          aria-current={item.href === currentPath ? 'page' : undefined}
           {...(item.external ? { target: '_blank', rel: 'noopener' } : {})}
         >
           {item.label}
@@ -33,7 +38,7 @@ const { items, depth = 0 } = Astro.props;
       </li>
     ) : (
       <li>
-        <details class="mnav__group">
+        <details class="mnav__group" open={containsCurrent(item)}>
           <summary class="mnav__link mnav__summary">{item.label}</summary>
           <Astro.self items={item.items} depth={depth + 1} />
         </details>
@@ -64,7 +69,7 @@ const { items, depth = 0 } = Astro.props;
     display: block;
     font-family: 'Space Grotesk', system-ui, sans-serif;
     font-weight: 600;
-    font-size: 11px;
+    font-size: 12px;
     letter-spacing: 0.08em;
     text-transform: uppercase;
     color: var(--nav-fg);
@@ -81,14 +86,19 @@ const { items, depth = 0 } = Astro.props;
     font-weight: 400;
     font-size: 13px;
     line-height: 1.3;
-    color: var(--strands-grey-400);
+    color: var(--sl-color-gray-3);
     text-decoration: none;
   }
 
   .mnav__link:hover {
     color: var(--nav-fg);
   }
 
+  .mnav__link[aria-current='page'] {
+    color: var(--accent-green);
+    font-weight: 700;
+  }
+
   .mnav__summary {
     display: flex;
     align-items: center;
```

**File**: `site/src/components/Navigation.astro` (modified, +211/-23)
```diff
@@ -15,6 +15,7 @@ import { getProductNav } from '../util/product-nav';
 import MobileNavTree from './MobileNavTree.astro';
 
 const stars = await getStarCount();
+const currentPath = Astro.url.pathname.replace(/\/?$/, '/');
 
 // The "Projects" dropdown is organized around products (Strands harness, SDK,
 // Shell, Evals) from navigation.yml, so the dropdown and the docs stay
@@ -120,15 +121,26 @@ const learnCategories = [
         <span class="strands-nav__theme-icon strands-nav__theme-icon--moon" set:html={moon} />
       </button>
     </div>
-    <button
-      type="button"
-      class="strands-nav__hamburger"
-      aria-label="Open menu"
-      aria-expanded="false"
-      data-hamburger
-    >
-      <span class="strands-nav__hamburger-icon" set:html={hamburger} />
-    </button>
+    <div class="strands-nav__collapsed">
+      <div class="strands-nav__lang strands-nav__collapsed-lang">
+        <LanguageToggle />
+      </div>
+      <button type="button" class="strands-nav__collapsed-search" data-nav-search aria-label="Search">
+        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3" stroke-linecap="round"/></svg>
+      </button>
+      <button
+        type="button"
+        class="strands-nav__hamburger"
+        aria-label="Open menu"
+        aria-expanded="false"
+        data-hamburger
+      >
+        <span class="strands-nav__hamburger-icon" set:html={hamburger} />
+        <span class="strands-nav__hamburger-icon strands-nav__close-icon">
+          <svg aria-hidden="true" focusable="false" width="32" height="24" viewBox="0 0 32 24" fill="none"><path d="M8 4L24 20M24 4L8 20" stroke="currentColor" stroke-width="2.5" stroke-linecap="square"/></svg>
+        </span>
+      </button>
+    </div>
   </div>
 
   <!-- Mobile menu panel (Figma 745:13162): Projects / Learn accordions of
@@ -194,6 +206,7 @@ const learnCategories = [
               <a
                 class="mobile-menu__cat mobile-menu__cat--link"
                 href={cat.href}
+                aria-current={cat.href === currentPath ? 'page' : undefined}
                 {...(cat.external && cat.href?.startsWith('http')
                   ? { target: '_blank', rel: 'noopener' }
                   : {})}
@@ -608,6 +621,29 @@ const learnCategories = [
     white-space: nowrap;
   }
 
+  .strands-nav__collapsed {
+    display: none;
+    align-items: center;
+    gap: 12px;
+  }
+
+  .strands-nav__collapsed-search {
+    display: inline-flex;
+    align-items: center;
+    justify-content: center;
+    width: 32px;
+    height: 32px;
+    padding: 0;
+    background: transparent;
+    border: none;
+    color: var(--nav-fg);
+    cursor: pointer;
+  }
+
+  .strands-nav__collapsed-search[hidden] {
+    display: none;
+  }
+
   .strands-nav__hamburger {
     display: none;
     align-items: center;
@@ -627,6 +663,15 @@ const learnCategories = [
     height: 24px;
   }
 
+  .strands-nav__close-icon,
+  .strands-nav__hamburger[aria-expanded='true'] > .strands-nav__hamburger-icon {
+    display: none;
+  }
+
+  .strands-nav__hamburger[aria-expanded='true'] > .strands-nav__close-icon {
+    display: inline-flex;
+  }
+
   .strands-nav__hamburger-icon :global(svg) {
     width: 100%;
     height: 100%;
@@ -638,8 +683,8 @@ const learnCategories = [
 
   /* Below Starlight's desktop breakpoint (50rem) our single hamburger is the
      only menu control. Hide Starlight's own circular mobile menu button and its
-     slide-in sidebar overlay; in-product page navigation is the title selector
-     in the content, and the hamburger carries the product/community menus.
+     slide-in sidebar overlay; the hamburger menu carries the per-product page
+     trees as well as the product/community menus.
      Without this the two controls stack in the same corner and read as a broken
      double hamburger. Above 50rem the sidebar is the static left column. */
   @media (max-width: 49.9375rem) {
@@ -673,16 +718,30 @@ const learnCategories = [
     .strands-nav__wordmark :global(svg) {
       height: 21px;
     }
+
+    .strands-nav__logo::before {
+      content: '';
+      position: absolute;
+      inset: -10px 0;
+    }
+
+    /* Too narrow for the header; on pages with a TOC, PageSidebar puts it in the
+       "On this page" bar. */
+    .strands-nav__collapsed-lang {
+      display: none;
+    }
   }
 
   /* ---------- Collapsed (< 78rem, where the full bar no longer fits) ---------- */
   @media (max-width: 77.9375rem) {
-    /* Desktop-only links + right cluster hide. */
-    .strands-nav__links,
     .strands-nav__right {
       display: none;
     }
 
+    .strands-nav__collapsed {
+      display: flex;
+    }
+
     .strands-nav__hamburger {
       display: inline-flex;
     }
@@ -885,14 +944,15 @@ const learnCategories = [
       color: var(--nav-fg);
     }
 
-    .mobile-menu__cat.is-open .mobile-menu__cat-titl
```

**File**: `site/src/components/PageTags.astro` (modified, +2/-2)
```diff
@@ -123,7 +123,7 @@ const items = tags.map((tag) => ({
   }
 
   .page-tags__label {
-    font-size: 0.6875rem;
+    font-size: 0.75rem;
     font-weight: 600;
     letter-spacing: 0.08em;
     text-transform: uppercase;
@@ -202,7 +202,7 @@ const items = tags.map((tag) => ({
 
   /* Slightly de-emphasized count next to the tag name */
   .page-tags__panel-count {
-    font-size: 0.6875rem;
+    font-size: 0.75rem;
     color: var(--sl-color-gray-4);
     font-weight: 500;
   }
```

---

### Incident Patch 3: `37b77faf` (2026-10-05)
**Commit Message**: docs(bidi): refine model provider guides (#4894)

**File**: `site/src/content/docs/user-guide/sdk/bidi/models/bedrock.mdx` (modified, +77/-121)
```diff
@@ -1,168 +1,124 @@
 ---
 title: Bedrock Nova Sonic
-description: 'Build real-time speech-to-speech agents with Amazon Bedrock Nova Sonic and Strands. Bidirectional audio streaming with barge-in handling and tool calling.'
+description: "Configure Amazon Nova Sonic for BidiAgent: set AWS credentials, choose a voice, tune turn detection, and preserve context across connection restarts."
+languages: [python]
 tags: [bidi-streaming, aws, bedrock]
 sourceLinks:
   - path: strands-py/src/strands/bidi/models/bedrock.py
+  - path: strands-py/src/strands/bidi/models/configs.py
 redirectFrom:
   - docs/user-guide/concepts/bidirectional-streaming/models/nova_sonic
   - docs/user-guide/sdk/bidirectional-streaming/models/bedrock
 ---
 
+[Amazon Nova Sonic][nova-sonic] brings expressive, multilingual voice conversations
+to your agents. Users can speak naturally, interrupt a reply, and ask the agent to
+take action through tools.
 
-[Amazon Nova Sonic](https://docs.aws.amazon.com/nova/latest/nova2-userguide/using-conversational-speech.html) provides real-time, conversational interactions through bidirectional audio streaming. Amazon Nova Sonic processes and responds to real-time speech as it occurs, enabling natural, human-like conversational experiences. Key capabilities and features include:
-
-- Adaptive speech response that dynamically adjusts delivery based on the prosody of the input speech.
-- Graceful handling of user barge-ins without dropping conversational context.
-- Function calling and agentic workflow support for building complex AI applications.
-- Robustness to background noise for real-world deployment scenarios.
-- Multilingual support with expressive voices and speaking styles. Expressive voices are offered, including both masculine-sounding and feminine sounding, in seven languages: English (US, UK, AU, IN), French, Italian, German, Spanish (US), Portuguese (BR), and Hindi.
-- Recognition of varied speaking styles across all supported languages.
+Follow the [quickstart](../quickstart.mdx) to build a voice agent that listens,
+speaks, and calls tools.
 
 ## Installation
 
-:::caution[Python 3.12+ Required]
-Nova Sonic requires Python 3.12 or higher due to its experimental AWS SDK dependency.
+:::note[Python version]
+Nova Sonic requires Python 3.12 or later.
 :::
 
-Nova Sonic is included in the base bidirectional streaming dependencies for Strands Agents.
-
-To install it, run:
+Install the Nova Sonic extra:
 
 ```bash
-pip install 'strands-agents[bidi,bidi-io,bidi-pyaudio]'
+pip install "strands-agents[bidi]"
 ```
 
-Or to install all bidirectional streaming providers at once:
+For local audio dependencies and device setup, see
+[Audio I/O](../io.mdx#audio-io).
 
-```bash
-pip install 'strands-agents[bidi-all,bidi-pyaudio]'
-```
+## Credentials
 
-## Usage
+Configure AWS credentials with permission to invoke Nova Sonic in a
+[supported region][nova-regions].
+`BedrockNovaSonicModel` uses Boto3's [credential chain][boto3-credentials], including
+environment variables, named profiles, and IAM roles. See
+[Setting up AWS credentials][credentials-setup]
+for shared setup instructions.
 
-After installing the Bedrock Nova Sonic and local audio extras, create a voice agent:
+To use a named profile, pass a Boto3 session with its region:
 
 ```python
-import asyncio
+import boto3
 
-from strands.bidi.agent import BidiAgent
-from strands.bidi.io import AudioIO
 from strands.bidi.models import BedrockNovaSonicModel
-from strands.vended_tools import notebook
-
-
-async def main() -> None:
-    model = BedrockNovaSonicModel(
-        model_id="amazon.nova-2-sonic-v1:0",
-        region="us-east-1",
-        voice="tiffany",
-    )
-    agent = BidiAgent(model=model, tools=[notebook])
-    audio_io = AudioIO()
-    await agent.run(inputs=[audio_io.input()], outputs=[audio_io.output()])
-
-
-if __name__ == "__main__":
-    asyncio.run(main())
-```
-
-## Cross-Modal Input
 
-Nova Sonic accepts text input at any point during an active voice session, without interrupting or waiting on the audio stream. Send [text input](../content.mdx#send-input) the same way you would outside of a live conversation:
-
-```python
-await agent.send({"text": "What's the weather in Seattle?"})
+model = BedrockNovaSonicModel(
+    model_id="amazon.nova-2-sonic-v1:0",
+    boto_session=boto3.Session(profile_name="voice-agent", region_name="us-east-1"),
+)
 ```
 
-Text and audio input can be interleaved freely. Sending text does not require pausing
-the microphone or waiting for the model to finish speaking.
-
-## Credentials
+Without a custom session, you can pass `region` directly. If omitted, the model
+uses Boto3's configured region, falling back to `us-east-1`.
 
-:::caution[Nova Sonic is available in us-east-1, us-west-2, eu-north-1, and ap-northeast-1.]
-:::
-
-Nova Sonic requires AWS credentials for access. `BedrockNovaSonicModel` uses an experimental [Bedrock client](https://github.com/aws/aws-sdk-python/tree/develop/clients/aws
```

**File**: `site/src/content/docs/user-guide/sdk/bidi/models/google.mdx` (modified, +72/-85)
```diff
@@ -1,127 +1,114 @@
 ---
 title: Google Gemini Live
-description: "Build real-time voice agents with Google's Gemini Live API and Strands. Stream audio and text over WebSocket with barge-ins and tool calling."
+description: "Configure Google Gemini Live for BidiAgent: set credentials, choose a voice and audio settings, tune turn detection, and manage connection restarts."
+languages: [python]
 tags: [bidi-streaming]
 sourceLinks:
   - path: strands-py/src/strands/bidi/models/google.py
+  - path: strands-py/src/strands/bidi/models/configs.py
 redirectFrom:
   - docs/user-guide/concepts/bidirectional-streaming/models/gemini_live
   - docs/user-guide/sdk/bidirectional-streaming/models/google
 ---
 
+[Google Gemini Live][gemini-live] brings multilingual voice conversations to your
+agents, with support for text and images alongside speech. Users can share context,
+interrupt a reply, and ask the agent to take action through tools.
 
-The [Gemini Live API](https://ai.google.dev/gemini-api/docs/live) lets developers create natural conversations by enabling a two-way WebSocket connection with the Gemini models. The Live API processes data streams in real time. Users can barge in with new input while the model is responding, similar to a real conversation. Key features include:
-
-- **Multimodal Streaming**: The API supports streaming of text, audio, and video data.
-- **Bidirectional Interaction**: The user and the model can provide input and output at the same time.
-- **Barge-in**: Users can speak during the model's response, and the model adjusts its response.
-- **Tool Use and Function Calling**: The API can use external tools to perform actions and get context while maintaining a real-time connection.
-- **Provider Sessions**: Maintains conversation context within a Gemini Live session. For SDK session persistence, see [Session Management](../session-management.mdx).
-- **Secure Authentication**: Uses tokens for secure client-side authentication.
+Follow the [quickstart](../quickstart.mdx) to build a voice agent that listens,
+speaks, and calls tools.
 
 ## Installation
 
-The Google Gemini Live provider is configured as an optional dependency in Strands Agents.
-
-To install it, run:
+Install the Google Gemini Live extra:
 
 ```bash
-pip install 'strands-agents[bidi-google,bidi-io,bidi-pyaudio]'
+pip install "strands-agents[bidi-google]"
 ```
 
-Or to install all bidirectional streaming providers at once:
+For local audio dependencies and device setup, see
+[Audio I/O](../io.mdx#audio-io).
+
+## Credentials
+
+Create an API key in [Google AI Studio][api-keys] and set it in your environment:
 
 ```bash
-pip install 'strands-agents[bidi-all,bidi-pyaudio]'
+export GOOGLE_API_KEY="your-api-key"
 ```
 
-## Usage
+`GoogleGeminiLiveModel` reads `GOOGLE_API_KEY` automatically. You can also pass the
+key through `client_args={"api_key": "your-api-key"}`. For other client options,
+see the [Google GenAI client reference][client-api].
 
-After installing the Gemini Live and local audio extras, create a voice agent:
+## Configuration
 
-```python
-import asyncio
+Configure the Gemini Live model, output voice, and input audio, then pass the model
+to `BidiAgent`:
 
+```python
 from strands.bidi.agent import BidiAgent
-from strands.bidi.io import AudioIO
 from strands.bidi.models import GoogleGeminiLiveModel
-from strands.vended_tools import notebook
-
 
-async def main() -> None:
-    model = GoogleGeminiLiveModel(
-        model_id="gemini-3.8-live",
-        voice="Kore",
-        client_args={"api_key": "<GOOGLE_API_KEY>"},
-    )
-    agent = BidiAgent(model=model, tools=[notebook])
-
-    audio_io = AudioIO()
-    await agent.run(inputs=[audio_io.input()], outputs=[audio_io.output()])
-
-
-if __name__ == "__main__":
-    asyncio.run(main())
+model = GoogleGeminiLiveModel(
+    model_id="gemini-3.8-live",
+    voice="Kore",
+    audio={"input": {"sample_rate": 48000}},
+)
+agent = BidiAgent(model=model)
 ```
 
-## Configuration
-
-### Client Options
-
-Pass Google GenAI client options through `client_args`. For the supported fields, see
-the [Google GenAI client reference](https://googleapis.github.io/python-genai/genai.html#genai.client.Client).
-
-### Model Config
+Choose a voice from Google's [voice options][voices]. Audio uses mono PCM, with
+16 kHz input by default and fixed 24 kHz output. Set `audio.input.sample_rate` to
+match your input source; Gemini resamples incoming audio as needed. The adapter
+enables transcripts for both user speech and model responses.
 
-| Parameter | Description | Example | Options |
-| --------- | ----------- | ------- | ------- |
-| `model_id` | Gemini Live model identifier. | `"gemini-3.8-live"` | [Gemini models](https://ai.google.dev/gemini-api/docs/models) |
-| `audio` | Input audio options. | `{"input": {"sample_rate": 48000}}` | [reference](@api/python/strands.bidi.models#strands.bidi.models.GoogleGeminiLiveAudioConfig) |
-| `voice` | Prebuilt output voice name. Uses the prov
```

**File**: `site/src/content/docs/user-guide/sdk/bidi/models/index.mdx` (modified, +13/-7)
```diff
@@ -61,11 +61,15 @@ the connection opens, not to the connection already in progress.
 
 ## Audio
 
-Realtime models take raw audio in and send raw audio back: mono PCM, at a sample rate
-the model defines. The model owns the audio format, so microphones, speakers, and
-client applications adapt to it rather than the other way around. Each provider page
-covers the audio options its model supports, and [I/O Streams](../io.mdx) covers how
-audio devices and custom streams match the model's format.
+Use the model's audio configuration to set up capture and playback. The built-in
+providers implement [`AudioCapable`][audio-capable], which exposes
+`get_audio_config()`. It returns separate `input` and `output` settings containing
+each stream's sample rate, channel count, and encoding.
+
+[`AudioIO`](../io.mdx#audio-io) reads these settings automatically. Custom
+[I/O streams](../io.mdx#custom-io) can read them to configure audio capture and
+playback. The built-in providers use mono PCM; sample rates and configuration
+options vary by provider. See each provider's page for its supported settings.
 
 ## Connection limits
 
@@ -78,8 +82,8 @@ restart in one of two ways:
 - **History replay**: Nova Sonic and OpenAI Realtime open a fresh connection and
   receive the conversation history.
 - **Session resumption**: Gemini Live reconnects to the same server-side session
-  through [session resumption](https://ai.google.dev/gemini-api/docs/live-session), so
-  no history is resent.
+  through [session resumption](google.mdx#connection-restarts), falling back to
+  history replay if resumption is unavailable.
 
 Each provider sets its own default restart timing, and the `connection` option
 overrides it or turns automatic restarts off. For the restart sequence and the events
@@ -93,3 +97,5 @@ yields Strands events as the model responds, in the order described in
 [Event ordering](../events.mdx#event-ordering). See the
 [`BidiModel` API reference](@api/python/strands.bidi.models#strands.bidi.models.BidiModel) for the
 contract, and the built-in providers in `strands/bidi/models/` for working examples.
+
+[audio-capable]: @api/python/strands.bidi.models#strands.bidi.models.AudioCapable
```

**File**: `site/src/content/docs/user-guide/sdk/bidi/models/openai.mdx` (modified, +80/-82)
```diff
@@ -1,131 +1,129 @@
 ---
 title: OpenAI Realtime
-description: 'Build low-latency voice agents with the OpenAI Realtime API and Strands. Configure speech-to-speech streaming, barge-ins, and tool calling.'
+description: "Configure OpenAI Realtime for BidiAgent: set credentials, choose a voice and transcription model, tune turn detection, and manage connection restarts."
+languages: [python]
 tags: [bidi-streaming]
 sourceLinks:
   - path: strands-py/src/strands/bidi/models/openai.py
+  - path: strands-py/src/strands/bidi/models/configs.py
 redirectFrom:
   - docs/user-guide/concepts/bidirectional-streaming/models/openai_realtime
   - docs/user-guide/sdk/bidirectional-streaming/models/openai
 ---
 
+[OpenAI Realtime][realtime] brings responsive voice conversations to your agents,
+with support for text and images alongside speech. Users can share context,
+interrupt a reply, and ask the agent to take action through tools.
 
-The [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime) is a speech-to-speech interface that enables low-latency, natural voice conversations with AI. Key features include:
-
-- **Bidirectional Interaction**: The user and the model can provide input and output at the same time.
-- **Barge-in**: Users can speak while the model is responding, like in human conversations.
-- **Multimodal Streaming**: The API supports streaming of text and audio data.
-- **Tool Use and Function Calling**: Can use external tools to perform actions and get context while maintaining a real-time connection.
-- **Secure Authentication**: Uses tokens for secure client-side authentication.
+Follow the [quickstart](../quickstart.mdx) to build a voice agent that listens,
+speaks, and calls tools.
 
 ## Installation
 
-OpenAI Realtime is configured as an optional dependency in Strands Agents.
-
-To install it, run:
+Install the OpenAI Realtime extra:
 
 ```bash
-pip install 'strands-agents[bidi-io,bidi-openai,bidi-pyaudio]'
+pip install "strands-agents[bidi-openai]"
 ```
 
-Or to install all bidirectional streaming providers at once:
+For local audio dependencies and device setup, see
+[Audio I/O](../io.mdx#audio-io).
+
+## Credentials
+
+Create an [OpenAI API key][api-keys] and set it in your environment:
 
 ```bash
-pip install 'strands-agents[bidi-all,bidi-pyaudio]'
+export OPENAI_API_KEY="your-api-key"
 ```
 
-## Usage
+`OpenAIRealtimeModel` reads `OPENAI_API_KEY` automatically. You can also pass the key
+directly through `api_key`. For organization and project options, see the
+[constructor reference][model-api].
 
-After installing the OpenAI Realtime and local audio extras, create a voice agent:
+## Configuration
 
-```python
-import asyncio
+Configure the Realtime model, user transcription, and output voice, then pass the
+model to `BidiAgent`:
 
+```python
 from strands.bidi.agent import BidiAgent
-from strands.bidi.io import AudioIO
 from strands.bidi.models import OpenAIRealtimeModel
-from strands.vended_tools import notebook
-
 
-async def main() -> None:
-    model = OpenAIRealtimeModel(
-        transcription_model_id="gpt-transcribe",
-        model_id="gpt-realtime-2.1",
-        voice="coral",
-        api_key="<OPENAI_API_KEY>",
-    )
-    agent = BidiAgent(model=model, tools=[notebook])
-
-    audio_io = AudioIO()
-    await agent.run(inputs=[audio_io.input()], outputs=[audio_io.output()])
-
-
-if __name__ == "__main__":
-    asyncio.run(main())
+model = OpenAIRealtimeModel(
+    model_id="gpt-realtime-2.1",
+    transcription_model_id="gpt-transcribe",
+    voice="coral",
+)
+agent = BidiAgent(model=model)
 ```
 
-## Configuration
-
-### Client Options
+The `transcription_model_id` argument is required: choose a
+[transcription model][transcription-model] for user speech transcripts, or pass
+`None` to disable them. The Realtime model processes audio directly, independently
+of this transcription.
 
-| Parameter | Description | Example | Options |
-| --------- | ----------- | ------- | ------- |
-| `api_key` | OpenAI API key used for authentication | `sk-...` | [reference](https://platform.openai.com/docs/api-reference/authentication) |
-| `organization` | Organization associated with the connection. Used for authentication if required. | `myorg` | [reference](https://platform.openai.com/docs/api-reference/authentication)
-| `project` | Project associated with the connection. Used for authentication if required. | `myproj` | [reference](https://platform.openai.com/docs/api-reference/authentication)
-| `timeout_s` | OpenAI documents a 60 minute limit on realtime sessions ([docs](https://platform.openai.com/docs/guides/realtime-conversations#session-lifecycle-events)). However, OpenAI does not emit any warnings when approaching the limit. As a workaround, we allow users to configure a timeout (in seconds) on the client side to gracefully handle the connection closure. | `3000` | `[1, 3000]` (in seconds)
+Choose a voice from OpenAI's [voice options][voices]. This adapter requires m
```

---

### Incident Patch 4: `8dbf4d0a` (2026-10-05)
**Commit Message**: fix: broaden Mantle gpt-6 prefix to cover dot-separated model ids (#4882)

**File**: `strands-py/src/strands/models/_openai_bedrock.py` (modified, +7/-1)
```diff
@@ -36,7 +36,13 @@
 # can split across base paths (``google.gemma-4-*`` is on /openai/v1, ``google.gemma-3-*``
 # is on /v1). An unmatched new line falls through to /v1; the ``test_mantle_routing``
 # integ test fails naming any id that routes wrong.
-_OPENAI_PATH_MODEL_PREFIXES: tuple[str, ...] = ("openai.gpt-5.", "openai.gpt-6-", "xai.grok-4.", "google.gemma-4-")
+_OPENAI_PATH_MODEL_PREFIXES: tuple[str, ...] = (
+    "openai.gpt-5.",
+    "openai.gpt-6-",
+    "openai.gpt-6.",
+    "xai.grok-4.",
+    "google.gemma-4-",
+)
 
 
 def _resolve_mantle_base_path(model_id: str) -> str:
```

**File**: `strands-py/tests/strands/models/test_openai.py` (modified, +3/-0)
```diff
@@ -2195,6 +2195,7 @@ def test_bedrock_mantle_config_uses_openai_path_for_gpt5(self, openai_client, mo
             ("google.gemma-4-e2b", "/openai/v1"),
             ("openai.gpt-5.6-terra", "/openai/v1"),
             ("openai.gpt-6-astra", "/openai/v1"),
+            ("openai.gpt-6.1-sol", "/openai/v1"),
             # Gemma 3 is served from /v1 while Gemma 4 is not, so `google.` cannot be a prefix.
             ("google.gemma-3-27b-it", "/v1"),
             ("google.gemma-3-4b-it", "/v1"),
@@ -2228,9 +2229,11 @@ def test_bedrock_mantle_config_base_path_per_model(
             ("xai.grok-4.9", "/openai/v1"),
             ("openai.gpt-5.9-unreleased", "/openai/v1"),
             ("openai.gpt-6-nova", "/openai/v1"),
+            ("openai.gpt-6.1-sol", "/openai/v1"),
             # New lines the prefixes deliberately do not cover.
             ("xai.grok-5", "/v1"),
             ("xai.grok-5-preview", "/v1"),
+            ("openai.gpt-6oss-20b", "/v1"),
         ],
     )
     def test_bedrock_mantle_config_unverified_ids(self, model_id, expected_path, openai_client, mock_provide_token):
```

**File**: `strands-py/tests/strands/models/test_openai_responses.py` (modified, +3/-0)
```diff
@@ -2108,6 +2108,7 @@ def test_bedrock_mantle_config_uses_openai_path_for_gpt5(self, openai_client, mo
             ("google.gemma-4-31b", "/openai/v1"),
             ("openai.gpt-5.6-terra", "/openai/v1"),
             ("openai.gpt-6-astra", "/openai/v1"),
+            ("openai.gpt-6.1-sol", "/openai/v1"),
             # Gemma 3 is served from /v1 while Gemma 4 is not, so `google.` cannot be a prefix.
             ("google.gemma-3-27b-it", "/v1"),
             ("openai.gpt-oss-120b", "/v1"),
@@ -2131,9 +2132,11 @@ def test_bedrock_mantle_config_base_path_per_model(
             ("xai.grok-4.9", "/openai/v1"),
             ("openai.gpt-5.9-unreleased", "/openai/v1"),
             ("openai.gpt-6-nova", "/openai/v1"),
+            ("openai.gpt-6.1-sol", "/openai/v1"),
             # New lines the prefixes deliberately do not cover.
             ("xai.grok-5", "/v1"),
             ("xai.grok-5-preview", "/v1"),
+            ("openai.gpt-6oss-20b", "/v1"),
         ],
     )
     def test_bedrock_mantle_config_unverified_ids(self, model_id, expected_path, openai_client, mock_provide_token):
```

**File**: `strands-ts/src/models/openai/__tests__/mantle.test.ts` (modified, +3/-0)
```diff
@@ -199,6 +199,7 @@ describe('OpenAIModel bedrockMantleConfig', () => {
       ['google.gemma-4-e2b', '/openai/v1'],
       ['openai.gpt-5.6-terra', '/openai/v1'],
       ['openai.gpt-6-astra', '/openai/v1'],
+      ['openai.gpt-6.1-sol', '/openai/v1'],
       // Gemma 3 is served from /v1 while Gemma 4 is not, so `google.` cannot be a prefix.
       ['google.gemma-3-27b-it', '/v1'],
       ['google.gemma-3-4b-it', '/v1'],
@@ -224,9 +225,11 @@ describe('OpenAIModel bedrockMantleConfig', () => {
       ['xai.grok-4.9', '/openai/v1'],
       ['openai.gpt-5.9-unreleased', '/openai/v1'],
       ['openai.gpt-6-nova', '/openai/v1'],
+      ['openai.gpt-6.1-sol', '/openai/v1'],
       // New lines the prefixes deliberately do not cover.
       ['xai.grok-5', '/v1'],
       ['xai.grok-5-preview', '/v1'],
+      ['openai.gpt-6oss-20b', '/v1'],
     ])('resolves unverified %s to %s', (modelId, expected) => {
       expect(baseURLFor({ modelId, bedrockMantleConfig: { region: 'us-west-2' } })).toBe(
         `https://bedrock-mantle.us-west-2.api.aws${expected}`
```

**File**: `strands-ts/src/models/openai/mantle.ts` (modified, +7/-1)
```diff
@@ -22,7 +22,13 @@ const MANTLE_DOCS_URL = 'https://docs.aws.amazon.com/bedrock/latest/userguide/in
  * `/v1`). An unmatched new line falls through to `/v1`; the `mantle-routing`
  * integ test fails naming any id that routes wrong.
  */
-const OPENAI_PATH_MODEL_PREFIXES = ['openai.gpt-5.', 'openai.gpt-6-', 'xai.grok-4.', 'google.gemma-4-'] as const
+const OPENAI_PATH_MODEL_PREFIXES = [
+  'openai.gpt-5.',
+  'openai.gpt-6-',
+  'openai.gpt-6.',
+  'xai.grok-4.',
+  'google.gemma-4-',
+] as const
 
 // Matches AWS region identifiers such as us-east-1, ap-southeast-1, and us-gov-east-1.
 // Anchored so a malformed region (e.g. one containing '@', ':', '/', '#') cannot re-point
```

---

### Incident Patch 5: `e366bba8` (2026-10-05)
**Commit Message**: fix(bidi): emit OpenAI usage before response stop (#4889)

**File**: `site/src/components/BidiEventOrdering.astro` (modified, +3/-1)
```diff
@@ -38,6 +38,7 @@ const assistantEvents = [
   'BidiAudioStopEvent',
   'BidiTranscriptStopEvent',
   'BidiTranscriptBlockEvent',
+  'BidiUsageEvent',
   'BidiResponseStopEvent',
 ]
 const userEvents = [
@@ -56,7 +57,8 @@ const diagrams: Record<Scenario, Diagram> = {
     description:
       'Two columns show a user transcript and an assistant response containing audio and transcript events. ' +
       'Each content stream follows its own start, delta, and stop sequence. Transcript blocks follow transcript stop. ' +
-      'All assistant content finishes before response stop. ' +
+      'All assistant content finishes before response stop, with token usage shown immediately before it. ' +
+      'Nova Sonic can report usage outside response boundaries. ' +
       'User transcripts can interleave independently; aligned rows do not imply timing. ' +
       'Breaks in the lifelines indicate that the conversation can continue ' +
       'before a connection-stop event signals the end of the conversation.',
```

**File**: `site/src/content/docs/user-guide/sdk/bidi/events.mdx` (modified, +25/-3)
```diff
@@ -83,7 +83,9 @@ asyncio.run(main())
 
 ## Event families
 
-Model adapters emit connection starts, response boundaries, content streams, barge-in signals, and tool requests. The agent adds completed blocks, tool results, restart notifications, and connection stops.
+Model adapters emit connection starts, response boundaries, content streams, barge-in
+signals, tool requests, and usage reports. The agent adds completed blocks, tool results,
+restart notifications, and connection stops.
 
 Provider support and configuration determine which events appear. See the [event API reference](@api/python/strands.bidi.types) for complete class definitions and fields.
 
@@ -169,20 +171,40 @@ Use tool events to track requests, intermediate output, and completed results.
 
 [`BidiBargeInEvent`](@api/python/strands.bidi.types#strands.bidi.types.BidiBargeInEvent) signals an interruption to model output, whether audio, text, or other content. It carries no fields beyond `type`. See [Barge-in](#barge-in-1) for responding to interrupted output.
 
+### Usage
+
+Use [`BidiUsageEvent`](@api/python/strands.bidi.types#strands.bidi.types.BidiUsageEvent)
+to track token usage during a conversation. Each event reports additional
+`input_tokens`, `output_tokens`, and `total_tokens`; sum these counts to track
+conversation totals.
+
+Optional `input_token_details` and `output_token_details` provide breakdowns by
+modality, cache, or reasoning, depending on the provider. See
+[Tracking token usage](observability.mdx#tracking-token-usage) for an example.
+
 ## Event ordering
 
 Follow these ordering rules when consuming events or implementing a custom model. The diagram illustrates an audio response with an assistant transcript and a separate user transcript.
 
 <BidiEventOrdering />
 
+:::note[Nova Sonic usage timing]
+[Amazon Bedrock Nova Sonic](models/bedrock.mdx) currently reports usage independently
+of response boundaries. Its usage events can arrive before, during, or after a response.
+:::
+
 User transcripts have their own lifecycle and can start or finish before, during, or after an assistant response. Aligned rows do not imply timing, and a transcript start does not mark the exact moment speech began. Process assistant audio and tool requests without waiting for a completed user transcript.
 
 1. **Connection starts.** `BidiConnectionStartEvent` precedes output from that model connection. Track the connection by `connection_id`. A connection can contain multiple responses.
 2. **Response starts.** `BidiResponseStartEvent` precedes the response's assistant content and tool requests. Match response start and stop by `response_id`.
 3. **Content streams.** Each stream emits a start, zero or more deltas, and a stop. Text, reasoning, and other streams can interleave with the audio and transcripts shown, and streams can finish in a different order from their starts. Track each stream by its `content_id`, unique within the connection. A response can contain multiple streams and tool groups.
 4. **Completed blocks follow.** The agent emits each completed block after its content stop, such as `BidiTextBlockEvent` after `BidiTextStopEvent`. Custom models supply start, delta, and stop events; the agent assembles the block. Audio has no completed block event.
-5. **Response stops.** `BidiResponseStopEvent` follows all assistant content stops and completed blocks in that response. User transcripts and background tool results are independent of this boundary.
-6. **Connection stops.** `BidiConnectionStopEvent` signals the end of the conversation; the event iterator then ends.
+5. **Usage is reported.** `BidiUsageEvent` provides token counts before response stop.
+6. **Response stops.** `BidiResponseStopEvent` follows all assistant content stops and
+   completed blocks in that response. User transcripts and background tool results are
+   independent of this boundary.
+7. **Connection stops.** `BidiConnectionStopEvent` signals the end of the conversation; the
+   event iterator then ends.
 
 Use deltas for live updates. A completed block contains the full text for its stream, so replace the displayed partial text when it arrives. See [Messages](#messages) for how this content becomes conversation history.
 
```

**File**: `strands-py/src/strands/bidi/models/openai.py` (modified, +1/-2)
```diff
@@ -775,10 +775,9 @@ def _complete_response(self, response: dict[str, Any], state: _SessionState) ->
             events.append(BidiTextStopEvent(content_id))
         state.assistant_parts.pop(content_id, None)
 
-        events.append(BidiResponseStopEvent(response_id=response_id))
-
         if usage := response.get("usage"):
             events.append(self._convert_usage_metadata(usage))
+        events.append(BidiResponseStopEvent(response_id=response_id))
         return events
 
     def _convert_usage_metadata(self, usage: dict[str, Any]) -> BidiUsageEvent:
```

**File**: `strands-py/tests/strands/bidi/models/test_openai.py` (modified, +24/-5)
```diff
@@ -109,7 +109,7 @@ def messages():
 @pytest.mark.parametrize("status", ["completed", "cancelled"])
 @pytest.mark.parametrize("include_details", [False, True])
 def test_response_usage_token_details(model, status, include_details):
-    """Response usage keeps totals separate from optional, overlapping breakdowns."""
+    """Usage precedes response stop and keeps totals separate from optional breakdowns."""
     usage = {"input_tokens": 100, "output_tokens": 20, "total_tokens": 120}
     if include_details:
         usage.update(
@@ -126,14 +126,14 @@ def test_response_usage_token_details(model, status, include_details):
         {"type": "response.done", "response": {"id": "r1", "status": status, "usage": usage}}
     )
     exp_events = [
-        BidiResponseStopEvent("r1"),
         BidiUsageEvent(
             input_tokens=100,
             output_tokens=20,
             total_tokens=120,
             input_token_details={"text": 70, "audio": 30, "image": 0, "cache_read": 50} if include_details else None,
             output_token_details={"text": 8, "audio": 12, "reasoning": 5} if include_details else None,
         ),
+        BidiResponseStopEvent("r1"),
     ]
     assert tru_events == exp_events
 
@@ -147,15 +147,32 @@ async def test_receive_preserves_native_order_with_late_transcription(model, moc
         {"type": "response.cancelled", "response": {"id": "r1"}},
         {
             "type": "response.done",
-            "response": {"id": "r1", "status": "cancelled", "status_details": {"reason": "turn_detected"}},
+            "response": {
+                "id": "r1",
+                "status": "cancelled",
+                "status_details": {"reason": "turn_detected"},
+                "usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
+            },
         },
         {
             "type": "response.done",
-            "response": {"id": "r1", "status": "cancelled", "status_details": {"reason": "turn_detected"}},
+            "response": {
+                "id": "r1",
+                "status": "cancelled",
+                "status_details": {"reason": "turn_detected"},
+                "usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
+            },
         },
         {"type": "conversation.item.input_audio_transcription.delta", "item_id": "user-1", "delta": "Earlier input."},
         {"type": "response.created", "response": {"id": "r2"}},
-        {"type": "response.done", "response": {"id": "r2", "status": "completed"}},
+        {
+            "type": "response.done",
+            "response": {
+                "id": "r2",
+                "status": "completed",
+                "usage": {"input_tokens": 2, "output_tokens": 3, "total_tokens": 5},
+            },
+        },
         {"type": "input_audio_buffer.committed", "item_id": "user-2"},
         {"type": "conversation.item.input_audio_transcription.delta", "item_id": "user-2", "delta": "Hi"},
         {"type": "conversation.item.input_audio_transcription.completed", "item_id": "user-2", "transcript": "Hi"},
@@ -171,9 +188,11 @@ async def test_receive_preserves_native_order_with_late_transcription(model, moc
         BidiTranscriptStartEvent("user", content_id="user-1"),
         BidiResponseStartEvent("r1"),
         BidiBargeInEvent(),
+        BidiUsageEvent(0, 0, 0),
         BidiResponseStopEvent("r1"),
         BidiTranscriptDeltaEvent("Earlier input.", "user", content_id="user-1"),
         BidiResponseStartEvent("r2"),
+        BidiUsageEvent(2, 3, 5),
         BidiResponseStopEvent("r2"),
         BidiTranscriptStartEvent("user", content_id="user-2"),
         BidiTranscriptDeltaEvent("Hi", "user", content_id="user-2"),
```

---

### Incident Patch 6: `3c64a877` (2026-10-05)
**Commit Message**: fix(python): remove sqlalchemy<2.1.0 cap, fixed upstream in 2.1.1 (#4674)

Co-authored-by: Ariel Nabavian <[REDACTED_EMAIL]>

**File**: `strands-py/pyproject.toml` (modified, +0/-2)
```diff
@@ -71,8 +71,6 @@ docs = [
 a2a = [
     "a2a-sdk>=0.3.0,<0.4.0",
     "a2a-sdk[sql]>=0.3.0,<0.4.0",
-    # TODO: remove cap once SQLAlchemy removes self-referential extras
-    "sqlalchemy>=2.0.0,<2.1.0",
     "uvicorn>=0.34.2,<1.0.0",
     "httpx>=0.28.1,<1.0.0",
     "fastapi>=0.133.0,<1.0.0",
```

---

### Incident Patch 7: `593f9191` (2026-10-05)
**Commit Message**: docs(bidi): update bidi quickstart page (#4867)

Co-authored-by: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `site/src/content/docs/user-guide/sdk/bidi/io.mdx` (modified, +2/-2)
```diff
@@ -45,15 +45,15 @@ async def run_conversation(
 
 When the timeout expires, `asyncio.wait_for()` cancels the run. It waits for the agent and its streams to stop, then raises `TimeoutError`.
 
-Your application can also cancel the task running `run()` when a user presses a stop button or a client disconnects. To let users end the conversation through a tool, see [Graceful shutdown](quickstart.mdx#graceful-shutdown).
+Your application can also cancel the task running `run()` when a user presses a stop button or a client disconnects. To let users end the conversation through a tool, see [End the conversation by voice](quickstart.mdx#end-the-conversation-by-voice).
 
 The following sections show how to use Strands' built-in `AudioIO` and `ConsoleIO` for audio and terminal interactions.
 
 ## Audio I/O
 
 Use [`AudioIO`](@api/python/strands.bidi.io#strands.bidi.io.AudioIO) to capture microphone audio and play the assistant's speech through your speakers. It displays speech transcripts and tool call names in the terminal and handles [barge-in](events.mdx#barge-in-1) automatically by stopping interrupted playback.
 
-Install [PortAudio](quickstart.mdx#platform-specific-audio-setup), then install the SDK with audio I/O support:
+Install [PortAudio](quickstart.mdx#install-the-sdk), then install the SDK with audio I/O support:
 
 ```bash
 pip install "strands-agents[bidi,bidi-io,bidi-pyaudio]"
```

**File**: `site/src/content/docs/user-guide/sdk/bidi/quickstart.mdx` (modified, +105/-480)
```diff
@@ -1,569 +1,194 @@
 ---
-title: Build a voice agent
+title: Build a Voice Agent
+description: "Talk to a Strands BidiAgent through your microphone and speakers: call a tool, talk over its reply, cancel echo, and end the conversation by voice."
+languages: [python]
 tags: [bidi-streaming, quickstart]
-description: "Build voice-enabled AI agents with real-time audio streaming. Works with Amazon Nova Sonic, Gemini Live, and OpenAI Realtime."
+sidebar:
+  label: Quickstart
+sourceLinks:
+  - path: strands-py/src/strands/bidi/agent/agent.py
+  - path: strands-py/src/strands/bidi/io/audio.py
+  - path: strands-py/src/strands/bidi/models/bedrock.py
+  - path: strands-py/src/strands/tools/decorator.py
 redirectFrom:
   - docs/user-guide/sdk/bidirectional-streaming/quickstart
 ---
 
+In this guide you build a voice agent that listens through your microphone, speaks
+through your speakers, and calls tools while you talk. You'll ask it for the time,
+talk over one of its replies, and end the conversation by saying goodbye.
 
-Build an agent that listens and talks in real time. This guide walks through a bidirectional streaming agent end to end: audio input and output, streaming events, tool calls mid-conversation, and the model providers that support it.
-
-After completing this guide, you can build voice assistants, interactive chatbots,
-multi-modal applications, and integrate bidirectional streaming with web servers or
-custom I/O streams.
-
-## Prerequisites
-
-Before starting, ensure you have:
-
-- Python 3.10+ installed (3.12+ required for Nova Sonic)
-- Audio hardware (microphone and speakers) for voice conversations
-- Model provider credentials configured (AWS, OpenAI, or Google)
+The example uses Amazon Nova Sonic, which requires Python 3.12 or later. You'll also
+need a microphone and speakers or headphones.
 
 ## Install the SDK
 
-Install the SDK with bidirectional streaming support:
-
-### For All Providers
-
-To install support for all bidirectional streaming providers:
-
-```bash
-pip install "strands-agents[bidi-all]"
-```
-
-This includes all three providers (Nova Sonic, OpenAI, and Gemini Live), `ConsoleIO`,
-and microphone audio processing. Local microphone and speaker I/O with `AudioIO`
-also requires PortAudio and the `bidi-pyaudio` extra. See
-[Platform-Specific Audio Setup](#platform-specific-audio-setup).
-
-### For Specific Providers
-
-You can also install support for specific providers:
-
-<Tabs>
-<Tab label="Amazon Bedrock Nova Sonic">
-
-```bash
-# With local microphone and speaker I/O
-pip install "strands-agents[bidi,bidi-io,bidi-pyaudio]"
-
-# With terminal text I/O
-pip install "strands-agents[bidi,bidi-io]"
-```
-</Tab>
-<Tab label="OpenAI Realtime API">
-
-```bash
-# With local audio I/O
-pip install "strands-agents[bidi-io,bidi-openai,bidi-pyaudio]"
-
-# With terminal text I/O
-pip install "strands-agents[bidi-io,bidi-openai]"
-```
-</Tab>
-<Tab label="Google Gemini Live">
-
-```bash
-# With local audio I/O
-pip install "strands-agents[bidi-google,bidi-io,bidi-pyaudio]"
-
-# With terminal text I/O
-pip install "strands-agents[bidi-google,bidi-io]"
-```
-</Tab>
-</Tabs>
-
-:::note[Server-Side Deployments]
-The `bidi-pyaudio` extra provides PyAudio for direct microphone and speaker access.
-The `bidi-io` extra provides terminal text input and transcript rendering.
-For server deployments where clients handle audio I/O, omit `bidi-pyaudio` and
-implement custom handlers using the `InputStream` and `OutputStream` protocols.
-See [I/O Streams](io.md) for details.
-:::
-
-### Platform-Specific Audio Setup
-
-`AudioIO` depends on PyAudio, which requires the PortAudio system library. Install
-PortAudio first, then install the `bidi-pyaudio` extra alongside `bidi-all`.
+Microphone and speaker access goes through PyAudio, which needs the PortAudio system
+library:
 
 <Tabs>
 <Tab label="macOS">
-
 ```bash
 brew install portaudio
-pip install "strands-agents[bidi-all,bidi-pyaudio]"
 ```
 </Tab>
-<Tab label="Linux (Ubuntu/Debian)">
-
+<Tab label="Linux (Debian/Ubuntu)">
 ```bash
-sudo apt-get install portaudio19-dev python3-pyaudio
-pip install "strands-agents[bidi-all,bidi-pyaudio]"
+sudo apt-get install portaudio19-dev
 ```
 </Tab>
 <Tab label="Windows">
-
-PyAudio typically installs without additional dependencies.
-
-```bash
-pip install "strands-agents[bidi-all,bidi-pyaudio]"
-```
+PyAudio's Windows wheels include PortAudio, so there's nothing to install here.
 </Tab>
 </Tabs>
 
-## Configuring Credentials
-
-Bidirectional streaming supports multiple model providers. Choose one based on your needs:
-
-<Tabs>
-<Tab label="Amazon Bedrock Nova Sonic">
-
-Nova Sonic is Amazon's bidirectional streaming model. Configure AWS credentials:
+Then install the SDK with Nova Sonic, local audio, and echo cancellation support:
 
 ```bash
-export AWS_ACCESS_KEY_ID=your_access_key
-export AWS_SECRET_ACCESS_KEY=your_secret_key
-export AWS_DEFAULT_REGION=us-east-1
+pip install "strands-agents[bidi,bidi-io,
```

---

### Incident Patch 8: `7517965b` (2026-10-05)
**Commit Message**: ci(typescript): bump brace-expansion from 5.0.7 to 5.0.12 (#4730)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>

**File**: `package-lock.json` (modified, +4/-4)
```diff
@@ -3407,16 +3407,16 @@
       "license": "MIT"
     },
     "node_modules/brace-expansion": {
-      "version": "5.0.7",
-      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.7.tgz",
-      "integrity": "sha512-7oFy703dxfY3/NLxC1fh2SUCQ0H9rmAY+5EpDVfXjUTTs+HEwR2nYaqLv+GWcTsumwxPfiz6CzCNkwXwBUwqCA==",
+      "version": "5.0.12",
+      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
+      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
       "dev": true,
       "license": "MIT",
       "dependencies": {
         "balanced-match": "^4.0.2"
       },
       "engines": {
-        "node": "18 || 20 || >=22"
+        "node": "20 || >=22"
       }
     },
     "node_modules/buffer-equal-constant-time": {
```

---

### Incident Patch 9: `76bebff2` (2026-10-04)
**Commit Message**: docs(bidi): add tools guide and clean up failed context entry (#4836)

**File**: `site/src/config/navigation.yml` (modified, +1/-0)
```diff
@@ -415,6 +415,7 @@ sidebar:
                   - docs/user-guide/sdk/bidi/models/bedrock
                   - docs/user-guide/sdk/bidi/models/google
                   - docs/user-guide/sdk/bidi/models/openai
+              - docs/user-guide/sdk/bidi/tools
               - docs/user-guide/sdk/bidi/io
               - docs/user-guide/sdk/bidi/content
               - docs/user-guide/sdk/bidi/events
```

**File**: `site/src/content/docs/user-guide/sdk/bidi/tools.mdx` (added, +81/-0)
```diff
@@ -0,0 +1,81 @@
+---
+title: Tools
+description: "Give BidiAgent tools that run while the conversation continues. Register tools, understand concurrent execution, and let users end a conversation."
+languages: [python]
+tags: [bidi-streaming, tool-execution]
+sourceLinks:
+  - path: strands-py/src/strands/bidi/agent/agent.py
+  - path: strands-py/src/strands/bidi/agent/loop.py
+  - path: strands-py/src/strands/tools/decorator.py
+  - path: strands-py/src/strands/types/tools.py
+---
+
+Give `BidiAgent` tools to look up information, call services, or take actions during a conversation. You define them as you would for `Agent`, and the model decides when to call them.
+
+Tool execution runs alongside the conversation. Users can keep talking while tools work, and results can arrive during a later response.
+
+:::note
+`BidiAgent` does not yet support [tool interrupts](interrupts.mdx).
+:::
+
+## Register tools
+
+Pass tools to `BidiAgent(tools=...)`. This timer uses `asyncio.sleep()` to wait without blocking the conversation:
+
+```python
+import asyncio
+
+from strands import tool
+from strands.bidi.agent import BidiAgent
+
+
+@tool
+async def set_timer(seconds: int) -> str:
+    """Start a timer and report when it finishes.
+
+    Args:
+        seconds: Number of seconds to wait.
+    """
+    await asyncio.sleep(seconds)
+    return f"Your {seconds}-second timer has finished."
+
+
+agent = BidiAgent(tools=[set_timer])
+```
+
+During a conversation, the model can call this tool when you ask for a timer. You can continue asking questions while it waits.
+
+For tool descriptions, input schemas, and other ways to define tools, see [Create custom tools](../tools/custom-tools.mdx). You can also use [MCP tools](../tools/mcp-tools.mdx). Keep the client open with its context manager while the agent runs, and pass `client.list_tools_sync()` as `tools`.
+
+## Concurrent execution
+
+When the model requests multiple tools together, they run concurrently as a group. The agent sends their results to the model once every tool in the group finishes.
+
+The conversation can continue while tools run, and the model can request more tools. Each new group runs independently, so it can return results before an earlier group finishes. Running tools also continue through [barge-in](events.mdx#barge-in-1).
+
+To keep the conversation responsive, use asynchronous I/O in `async def` tools, as the timer does with `asyncio.sleep()`. The `@tool` decorator runs synchronous functions in worker threads.
+
+## End a conversation
+
+Tools can also control when a conversation ends. Here, `end_conversation` uses `ToolContext` to call [`cancel()`](@api/python/strands.bidi.agent#strands.bidi.agent.BidiAgent.cancel) when the user asks to stop:
+
+```python
+from strands import ToolContext, tool
+from strands.bidi.agent import BidiAgent
+
+
+@tool(context=True)
+def end_conversation(tool_context: ToolContext[BidiAgent]) -> str:
+    """End the conversation when the user asks to stop or says goodbye."""
+    tool_context.agent.cancel()
+    return "Ending conversation."
+
+
+agent = BidiAgent(tools=[end_conversation])
+```
+
+The docstring becomes the tool description that helps the model decide when to call it. Customize it with example phrases or the kinds of requests you want the model to recognize.
+
+When the model calls the tool, cancellation takes effect after the tool's group finishes and its results are recorded.
+
+See [Graceful shutdown](quickstart.mdx#graceful-shutdown) for a complete example using this tool with `agent.run()`.
```

**File**: `strands-py/src/strands/bidi/agent/agent.py` (modified, +12/-1)
```diff
@@ -546,6 +546,7 @@ async def __aenter__(self, invocation_state: dict[str, Any] | None = None) -> "B
         """Async context manager entry point.
 
         Automatically starts the bidirectional connection when entering the context.
+        Cleans up if startup fails.
 
         Args:
             invocation_state: Optional context to pass to tools during execution.
@@ -554,9 +555,19 @@ async def __aenter__(self, invocation_state: dict[str, Any] | None = None) -> "B
 
         Returns:
             Self for use in the context.
+
+        Raises:
+            RuntimeError: If the agent is already started.
         """
+        if self._started:
+            raise RuntimeError("agent already started | call stop before starting again")
+
         logger.debug("context_manager=<enter> | starting agent")
-        await self.start(invocation_state)
+        try:
+            await self.start(invocation_state)
+        except BaseException:
+            await self.stop()
+            raise
         return self
 
     async def __aexit__(self, *_: Any) -> None:
```

**File**: `strands-py/tests/strands/bidi/agent/test_agent.py` (modified, +31/-0)
```diff
@@ -422,6 +422,12 @@ async def test_bidi_agent_start_stop_lifecycle(agent):
     with pytest.raises(RuntimeError, match="agent already started"):
         await agent.start()
 
+    with pytest.raises(RuntimeError, match="agent already started"):
+        async with agent:
+            pytest.fail("Already-started agent should reject context entry")
+    assert agent._started
+    assert agent.model._connection_id == connection_id
+
     # Stop agent
     await agent.stop()
     assert not agent._started
@@ -437,6 +443,31 @@ async def test_bidi_agent_start_stop_lifecycle(agent):
     assert agent.model._connection_id != connection_id
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("error_type", [RuntimeError, asyncio.CancelledError], ids=["error", "cancellation"])
+async def test_aenter_cleans_up_failed_start(agent, error_type):
+    error = error_type("startup failed")
+    start_model = agent.model.start
+
+    async def failing_start(**kwargs):
+        await start_model(**kwargs)
+        raise error
+
+    with unittest.mock.patch.object(agent.model, "start", side_effect=failing_start):
+        with pytest.raises(error_type) as exc_info:
+            async with agent:
+                pytest.fail("Failed startup should not enter the context body")
+
+    assert exc_info.value is error
+    assert not agent._started
+    assert not agent.model._started
+    assert agent.model._connection_id is None
+
+    async with agent:
+        assert agent.model._started
+    assert not agent.model._started
+
+
 @pytest.mark.asyncio
 @pytest.mark.parametrize("as_list", [False, True], ids=["single", "list"])
 @pytest.mark.parametrize("input_data", ["Hello", {"text": "Hello"}], ids=["string", "dictionary"])
```

---

### Incident Patch 10: `a0c9af72` (2026-10-04)
**Commit Message**: docs(bidi): rewrite I/O streams guide (#4858)

**File**: `site/src/content/docs/user-guide/sdk/bidi/io.mdx` (modified, +118/-233)
```diff
@@ -1,126 +1,65 @@
 ---
 title: I/O Streams
-description: >-
-  Connect microphones, speakers, consoles, and WebSockets to a Strands bidi-agent
-  with input and output streams for audio and text.
+description: "Connect microphones, speakers, terminals, and WebSockets to BidiAgent. Combine input and output streams, configure audio, and build custom adapters."
+languages: [python]
 sidebar:
-  label: "IO"
+  label: "I/O"
 tags: [bidi-streaming]
 sourceLinks:
-  - path: strands-py/src/strands/bidi/io/console/_io.py
-  - path: strands-py/src/strands/bidi/io/console/_display.py
-  - path: strands-py/src/strands/bidi/io/console/_keyboard.py
+  - path: strands-py/src/strands/bidi/agent/agent.py
+  - path: strands-py/src/strands/bidi/types/io.py
   - path: strands-py/src/strands/bidi/io/audio.py
+  - path: strands-py/src/strands/bidi/io/configs.py
+  - path: strands-py/src/strands/bidi/io/console/_io.py
+  - path: strands-py/src/strands/bidi/_audio/processor.py
 redirectFrom:
   - docs/user-guide/sdk/bidirectional-streaming/io
 ---
 
+I/O streams carry user input to `BidiAgent` and deliver its output to your application. An input stream reads text, images, or audio from a source such as a keyboard, microphone, or WebSocket. An output stream handles the agent's events to play audio, display text, or update your interface.
 
-I/O streams handle the flow of data between your application and the bidi-agent.
-They manage input sources (microphone, keyboard, WebSocket) and output destinations
-(speakers, console, UI) while the agent focuses on conversation logic and model
-communication.
-
-```mermaid
-flowchart LR
-    A[Microphone]
-    B[Keyboard]
-    A --> C[Bidi-Agent]
-    B --> C
-    C --> D[Speakers]
-    C --> E[Console]
-```
-
-## I/O Interfaces
-
-The bidi agent uses two protocol interfaces that define how data flows in and out of
-conversations:
-
-- `InputStream`: A callable protocol for reading data from sources such as a microphone,
-  keyboard, or WebSocket and returning `BidiAgentInput`.
-- `OutputStream`: A callable protocol for receiving `BidiOutputEvent` objects from the
-  agent and handling them appropriately.
-
-Both protocols include optional lifecycle methods (`start` and `stop`) for resource
-management.
-
-Implementation of these protocols will look as follows:
-
-```python
-from strands.bidi.agent import BidiAgent
-from strands.bidi.types import BidiAgentInput
-from strands.bidi.types import BidiOutputEvent
-from strands.bidi.types import InputStream, OutputStream
-
-
-class MyInputStream(InputStream):
-    async def start(self, agent: BidiAgent) -> None:
-        # Initialize input resources or state, using agent as needed.
-        return
-
-    async def __call__(self) -> BidiAgentInput:
-        # Read or generate input and return a BidiAgentInput value.
-        return {"text": "Hello"}
-
-    async def stop(self) -> None:
-        # Clean up any input resources or state.
-        return
-
+Connect these streams with [`agent.run()`](@api/python/strands.bidi.agent#strands.bidi.agent.BidiAgent.run), which starts the agent and its streams. The `inputs` and `outputs` lists can each contain multiple streams. The agent reads each input independently and sends every event to all outputs; each output chooses which events to handle.
 
-class MyOutputStream(OutputStream):
-    async def start(self, agent: BidiAgent) -> None:
-        # Initialize output resources or state, using agent as needed.
-        return
-
-    async def __call__(self, event: BidiOutputEvent) -> None:
-        # Process the event as needed for your application.
-        print(event)
-
-    async def stop(self) -> None:
-        # Clean up any output resources or state.
-        return
-```
-
-## I/O Usage
-
-Pass your I/O streams to the agent's `run()` method to connect them to the agent loop.
+A single run can span multiple model responses. This example connects an input and output stream and uses a 30-second timeout to end the conversation:
 
 ```python
 import asyncio
 
 from strands.bidi.agent import BidiAgent
+from strands.bidi.types import InputStream, OutputStream
 
 
-async def main():
+async def run_conversation(
+    input_stream: InputStream,
+    output_stream: OutputStream,
+) -> None:
     agent = BidiAgent()
-    await agent.run(inputs=[MyInputStream()], outputs=[MyOutputStream()])
+    try:
+        await asyncio.wait_for(
+            agent.run(inputs=[input_stream], outputs=[output_stream]),
+            timeout=30,
+        )
+    except asyncio.TimeoutError:
+        pass
+```
 
+When the timeout expires, `asyncio.wait_for()` cancels the run. It waits for the agent and its streams to stop, then raises `TimeoutError`.
 
-asyncio.run(main())
-```
+Your application can also cancel the task running `run()` when a user presses a stop button or a client disconnects. To let users end the conversation through a tool, see [Graceful shutdown](quickstart.mdx#graceful-shutdown).
 
-The `run()` method handles start
```

**File**: `strands-py/src/strands/bidi/io/audio.py` (modified, +2/-2)
```diff
@@ -314,8 +314,8 @@ class AudioIO:
     cancel echo from the mic input. A shared processor coordinates the input and output channels, so echo
     cancellation only works when both come from the *same* ``AudioIO`` instance.
 
-    Audio processing requires pywebrtc-audio (``pip install strands-agents[bidi-aec]``) and a microphone
-    sample rate of 16000, 32000, or 48000 Hz (set via the model's audio config).
+    Audio processing requires pywebrtc-audio (``pip install strands-agents[bidi-aec]``) and mono microphone
+    audio. Sample rates are set through the model's audio configuration.
 
     Device audio requires PyAudio. Install the PortAudio system library, then install
     ``strands-agents[bidi-pyaudio]``.
```

---

### Incident Patch 11: `7c6411cb` (2026-10-04)
**Commit Message**: docs(bidi): rewrite agent guide (#4859)

**File**: `site/src/content/docs/user-guide/sdk/bidi/agent.mdx` (modified, +66/-420)
```diff
@@ -1,491 +1,137 @@
 ---
 title: BidiAgent
-description: 'Build real-time voice conversations with BidiAgent. Stream audio and text over persistent connections with barge-ins and concurrent tool calling.'
+description: "Create and manage live conversations with BidiAgent. Send input, receive output events, control the lifecycle, and preserve history across connection restarts."
+languages: [python]
 tags: [bidi-streaming]
 sourceLinks:
   - path: strands-py/src/strands/bidi/agent/agent.py
   - path: strands-py/src/strands/bidi/agent/loop.py
-  - path: strands-py/src/strands/bidi/types/content.py
+  - path: strands-py/src/strands/bidi/types/agent.py
+  - path: strands-py/src/strands/bidi/models/configs.py
+  - path: strands-py/src/strands/types/agent.py
 redirectFrom:
   - docs/user-guide/sdk/bidirectional-streaming/agent
 ---
 
+`BidiAgent` manages a live conversation with a streaming model. It keeps the model connection open across responses, runs tools, and maintains conversation history. Your application can send new input while the model responds or tools run.
 
-The `BidiAgent` is a specialized agent designed for real-time bidirectional streaming conversations. Unlike the standard `Agent` that follows a request-response pattern, `BidiAgent` maintains persistent connections that enable continuous audio and text streaming, real-time barge-ins, and concurrent tool execution.
-
-```mermaid
-flowchart TB
-    subgraph User
-        A[Microphone] --> B[Audio Input]
-        C[Text Input] --> D[Input Content]
-        B --> D
-    end
-    
-    subgraph BidiAgent
-        D --> E[Agent Loop]
-        E --> F[Model Connection]
-        F --> G[Tool Execution]
-        G --> F
-        F --> H[Output Events]
-    end
-    
-    subgraph Output
-        H --> I[Audio Output]
-        H --> J[Text Output]
-        I --> K[Speakers]
-        J --> L[Console/UI]
-    end
-```
-
-
-## Agent vs BidiAgent
-
-While both `Agent` and `BidiAgent` share the same core purpose of enabling AI-powered interactions, they differ significantly in their architecture and use cases.
-
-### Standard Agent (Request-Response)
+## Create an agent
 
-The standard `Agent` follows a traditional request-response pattern:
+Configure the agent's instructions and tools when you create it:
 
 ```python
-from strands import Agent
+from strands.bidi.agent import BidiAgent
 from strands.vended_tools import notebook
 
-agent = Agent(tools=[notebook])
-
-# Single request-response cycle
-result = agent('Create a notebook named "ideas" and add three project ideas.')
-print(result.message)
+agent = BidiAgent(
+    system_prompt="You are a helpful assistant. Keep your answers brief.",
+    tools=[notebook],
+)
 ```
 
-**Characteristics:**
+By default, `BidiAgent` uses [Amazon Nova Sonic](models/bedrock.mdx). Pass a model instance through `model` to customize its configuration or choose [Google Gemini Live](models/google.mdx) or [OpenAI Realtime](models/openai.mdx). See the [`BidiAgent` API reference](@api/python/strands.bidi.agent#strands.bidi.agent.BidiAgent.__init__) for constructor options.
 
-- **Synchronous interaction**: One request, one response
-- **Discrete cycles**: Each invocation is independent
-- **Message-based**: Operates on complete messages
-- **Tool execution**: Sequential, blocking the response
+`BidiAgent` and `Agent` share the [`LocalAgent`](@api/python/strands.types.agent#strands.types.agent.LocalAgent) interface for common capabilities such as `messages` and registered tools. Tools and hooks can use this interface to work with either agent type. See [Hooks](hooks.mdx) for callback annotations.
 
-### BidiAgent (Bidirectional Streaming)
+## Send and receive
 
-`BidiAgent` maintains a persistent, bidirectional connection:
+Creating the agent configures it; entering `async with` opens the model connection. Inside the block, `send()` submits input without waiting for a model response, and `receive()` yields output events as they arrive.
+
+This example sends a text prompt and prints the completed response, then ends the conversation. Follow the [OpenAI Realtime setup](models/openai.mdx) before running it:
 
 ```python
 import asyncio
+
 from strands.bidi.agent import BidiAgent
-from strands.bidi.io import AudioIO
-from strands.bidi.models import BedrockNovaSonicModel
+from strands.bidi.models import OpenAIRealtimeModel
+from strands.bidi.types import BidiResponseStopEvent, BidiTextBlockEvent
 
-model = BedrockNovaSonicModel(model_id="amazon.nova-2-sonic-v1:0")
-agent = BidiAgent(model=model, tools=[notebook])
-audio_io = AudioIO()
 
-async def main():
-    # Persistent connection with continuous streaming
-    await agent.run(
-        inputs=[audio_io.input()],
-        outputs=[audio_io.output()]
+async def main() -> None:
+    model = OpenAIRealtimeModel(
+        model_id="gpt-realtime-2.1",
+        transcription_model_id=None,
+        params={"output_modalities": ["text"]},
     )
+    async with BidiAgent(model=model) as agen
```

**File**: `site/src/content/docs/user-guide/sdk/bidi/models/bedrock.mdx` (modified, +1/-1)
```diff
@@ -69,7 +69,7 @@ if __name__ == "__main__":
 
 ## Cross-Modal Input
 
-Nova Sonic accepts text input at any point during an active voice session, without interrupting or waiting on the audio stream. Send a [text content block](../agent.md#sending-multiple-content-blocks) the same way you would outside of a live conversation:
+Nova Sonic accepts text input at any point during an active voice session, without interrupting or waiting on the audio stream. Send [text input](../content.mdx#send-input) the same way you would outside of a live conversation:
 
 ```python
 await agent.send({"text": "What's the weather in Seattle?"})
```

---

### Incident Patch 12: `4816c2bd` (2026-10-04)
**Commit Message**: docs(bidi): remove standalone barge-in guide (#4860)

**File**: `site/src/config/navigation.yml` (modified, +0/-1)
```diff
@@ -418,7 +418,6 @@ sidebar:
               - docs/user-guide/sdk/bidi/io
               - docs/user-guide/sdk/bidi/content
               - docs/user-guide/sdk/bidi/events
-              - docs/user-guide/sdk/bidi/barge-in
               - docs/user-guide/sdk/bidi/hooks
               - docs/user-guide/sdk/bidi/session-management
               - docs/user-guide/sdk/bidi/interrupts
```

**File**: `site/src/content/docs/user-guide/sdk/bidi/barge-in.mdx` (removed, +0/-199)
```diff
@@ -1,199 +0,0 @@
----
-title: Barge-in
-description: 'Handle real-time voice barge-ins in BidiAgent. Voice Activity Detection stops responses mid-stream for natural, human-like conversations.'
-tags: [bidi-streaming]
-redirectFrom:
-  - docs/user-guide/concepts/bidirectional-streaming/interruption
-  - docs/user-guide/sdk/bidirectional-streaming/interruption
-  - docs/user-guide/sdk/bidirectional-streaming/barge-in
-sourceLinks:
-  - path: strands-py/src/strands/bidi/types/events.py
-  - path: strands-py/src/strands/bidi/io/audio.py
----
-
-
-When a user starts speaking while the model is still responding, `BidiAgent` stops the current response. This behavior, called barge-in, lets the user take the floor without waiting for the assistant to finish.
-
-## How Barge-in Works
-
-Barge-ins are detected through Voice Activity Detection (VAD) built into the model providers:
-
-```mermaid
-flowchart LR
-    A[User Starts Speaking] --> B[Model Detects Speech]
-    B --> C[BidiBargeInEvent]
-    C --> D[Clear Audio Buffer]
-    C --> E[Stop Response]
-    E --> F[BidiResponseStopEvent]
-    B --> G[Transcribe Speech]
-    G --> H[BidiTranscriptDeltaEvent]
-    F --> I[Ready for New Input]
-    H --> I
-```
-
-## Handling Barge-in
-
-The barge-in flow: Model's VAD detects user speech → `BidiBargeInEvent` sent → Audio buffer cleared → Response terminated → User's speech transcribed → Model ready for new input.
-
-### Automatic Handling (Default)
-
-When using `AudioIO`, barge-ins are handled automatically:
-
-```python
-import asyncio
-from strands.bidi.agent import BidiAgent
-from strands.bidi.io import AudioIO
-from strands.bidi.models import BedrockNovaSonicModel
-
-model = BedrockNovaSonicModel(model_id="amazon.nova-2-sonic-v1:0")
-agent = BidiAgent(model=model)
-audio_io = AudioIO()
-
-async def main():
-    # Barge-ins handled automatically
-    await agent.run(
-        inputs=[audio_io.input()],
-        outputs=[audio_io.output()]
-    )
-
-asyncio.run(main())
-```
-
-The `AudioIO` output automatically clears the audio buffer, stops playback
-immediately, and resumes normal operation for the next response.
-
-### Manual Handling
-
-For custom behavior, process barge-in events manually:
-
-```python
-import asyncio
-from strands.bidi.agent import BidiAgent
-from strands.bidi.models import BedrockNovaSonicModel
-from strands.bidi.types import BidiBargeInEvent
-
-model = BedrockNovaSonicModel(model_id="amazon.nova-2-sonic-v1:0")
-agent = BidiAgent(model=model)
-
-async def main():
-    await agent.start()
-    await agent.send("Tell me a long story")
-    
-    async for event in agent.receive():
-        if isinstance(event, BidiBargeInEvent):
-            print("Barge-in detected")
-            # Custom handling:
-            # - Update UI to show barge-in
-            # - Log analytics
-            # - Clear custom buffers
-    
-    await agent.stop()
-
-asyncio.run(main())
-```
-
-## Barge-in Events
-
-### Key Events
-
-**BidiBargeInEvent** - Emitted when a barge-in is detected. It carries no fields beyond `type`.
-
-## Barge-in Hooks
-
-Use hooks to track barge-ins across your application:
-
-```python
-from strands.bidi.agent import BidiAgent
-from strands.bidi.hooks import (
-    BidiBargeInEvent as BidiBargeInHookEvent,
-)
-
-class BargeInTracker:
-    def __init__(self):
-        self.barge_in_count = 0
-    
-    async def on_barge_in(self, event: BidiBargeInHookEvent):
-        self.barge_in_count += 1
-        print(f"Barge-in #{self.barge_in_count}")
-        
-        # Log to analytics
-        # Update UI
-        # Track user behavior
-
-tracker = BargeInTracker()
-agent = BidiAgent(
-    model=model,
-    hooks=[tracker]
-)
-```
-
-## Common Issues
-
-### Barge-in Not Working
-
-If barge-ins aren't being detected:
-
-```python
-from strands.bidi.models import OpenAIRealtimeModel
-
-# Check VAD configuration (OpenAI)
-model = OpenAIRealtimeModel(
-    model_id="gpt-realtime-2.1",
-    transcription_model_id="gpt-transcribe",
-    params={
-        "audio": {
-            "input": {
-                "turn_detection": {
-                    "type": "server_vad",
-                    "threshold": 0.3,  # Lower = more sensitive
-                    "silence_duration_ms": 300  # Shorter = faster detection
-                }
-            }
-        }
-    }
-)
-
-# Verify microphone is working
-audio_io = AudioIO(input_device_index=1)  # Specify device
-
-# Check system permissions (macOS)
-# System Preferences → Security & Privacy → Microphone
-```
-
-### Audio Continues After Barge-in
-
-If audio keeps playing after barge-in:
-
-```python
-# Ensure AudioIO is handling barge-ins
-async def __call__(self, event: BidiOutputEvent):
-    if isinstance(event, BidiBargeInEvent):
-        self._buffer.clear()  # Critical!
-        print("Buffer cleared due to barge-in")
-```
-
-### Frequent False Barge-ins
-
-If barge-in is detected too easily:
-
-```python
-from strands.bidi.models import OpenAIRealtime
```

**File**: `site/src/content/docs/user-guide/sdk/bidi/events.mdx` (modified, +4/-0)
```diff
@@ -13,6 +13,10 @@ sourceLinks:
   - path: strands-py/src/strands/types/_events.py
 redirectFrom:
   - docs/user-guide/sdk/bidirectional-streaming/events
+  - docs/user-guide/sdk/bidi/barge-in
+  - docs/user-guide/sdk/bidirectional-streaming/barge-in
+  - docs/user-guide/sdk/bidirectional-streaming/interruption
+  - docs/user-guide/concepts/bidirectional-streaming/interruption
 ---
 
 import BidiEventOrdering from '@components/BidiEventOrdering.astro';
```

**File**: `site/src/content/docs/user-guide/sdk/bidi/index.mdx` (modified, +4/-9)
```diff
@@ -57,19 +57,14 @@ choosing a model provider that supports it, and handling the live stream.
 
 <CardGrid>
   <LinkCard
-    title="I/O channels"
+    title="I/O Streams"
     href="io/"
     description="Wire local audio and text I/O, or implement custom channels for a web server."
   />
   <LinkCard
-    title="Streaming events"
+    title="Stream Events"
     href="events/"
-    description="Handle the events the agent emits as audio, transcripts, and tool calls arrive."
-  />
-  <LinkCard
-    title="Barge-in"
-    href="barge-in/"
-    description="Let a user cut in mid-response and have the agent stop and listen."
+    description="Handle audio, transcripts, tool calls, and barge-in through the agent's output events."
   />
 </CardGrid>
 
@@ -113,4 +108,4 @@ running, then read [BidiAgent](agent/) to configure tools, prompts, and the
 connection lifecycle. Pick a [model provider](models/bedrock/) based on the
 provider you use and the session length you need.
 
-Building for a server rather than a local machine? Read [I/O channels](io/) to replace microphone-and-speaker I/O with your own transport, then [streaming events](events/) and [barge-ins](barge-in/) to drive the conversation from your own event loop.
+For server applications, use [I/O Streams](io.mdx) to connect your own transport and [Stream Events](events.mdx) to handle output, including barge-in.
```

**File**: `site/src/content/docs/user-guide/sdk/bidi/observability.mdx` (modified, +2/-2)
```diff
@@ -171,7 +171,7 @@ A barge-in is recorded as a `bidi_barge_in` event on the session span.
 
 To count barge-ins, query the session span's `bidi_barge_in` events. Keeping the
 event on the session also captures barge-ins between response spans. For detection
-and playback behavior, see [Barge-in](barge-in.md).
+and playback behavior, see [Barge-in](events.mdx#barge-in-1).
 
 ## Inspecting spans locally
 
@@ -462,5 +462,5 @@ Each provider emits one span per response. Usage details vary by provider:
 - [Logs](../observability-evaluation/logs.md) - Log levels and handler configuration
 - [Events](events.md) - Complete guide to bidirectional streaming events
 - [Hooks](hooks.md) - Extend agent functionality with hooks
-- [Barge-in](barge-in.md) - How barge-in detection works
+- [Barge-in](events.mdx#barge-in-1) - Handle interrupted output and clear buffered audio
 - [Python API Reference](@api/python/strands.bidi.agent) - Complete API documentation
```

**File**: `site/test/known-routes.json` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@
   "/docs/user-guide/observability-evaluation/evaluation/",
   "/docs/user-guide/quickstart/",
   "/docs/user-guide/quickstart/choosing-an-agent-foundation/",
+  "/docs/user-guide/sdk/bidi/barge-in/",
   "/docs/user-guide/sdk/bidirectional-streaming/",
   "/docs/user-guide/sdk/bidirectional-streaming/agent/",
   "/docs/user-guide/sdk/bidirectional-streaming/barge-in/",
```

---

### Incident Patch 13: `8ba04f70` (2026-10-02)
**Commit Message**: fix(ollama): forward numeric keep_alive values such as 0 (#4725)

Co-authored-by: Charan Rathore <[REDACTED_EMAIL]>

**File**: `strands-py/src/strands/models/ollama.py` (modified, +2/-2)
```diff
@@ -64,7 +64,7 @@ class OllamaConfig(BaseModelConfig, total=False):
 
         additional_args: dict[str, Any] | None
         cache_config: CacheConfig | None
-        keep_alive: str | None
+        keep_alive: float | str | None
         max_tokens: int | None
         model_id: str
         options: dict[str, Any] | None
@@ -232,7 +232,7 @@ def format_request(
                 }
                 for tool_spec in tool_specs or []
             ],
-            **({"keep_alive": self.config["keep_alive"]} if self.config.get("keep_alive") else {}),
+            **({"keep_alive": self.config["keep_alive"]} if self.config.get("keep_alive") is not None else {}),
             **(
                 self.config["additional_args"]
                 if "additional_args" in self.config and self.config["additional_args"] is not None
```

**File**: `strands-py/tests/strands/models/test_ollama.py` (modified, +14/-0)
```diff
@@ -854,3 +854,17 @@ def test_cache_config_unsupported_field_warns_and_is_not_routed(host, model_id,
         request = model.format_request(messages)
 
     assert "cache_config" not in request
+
+
+@pytest.mark.parametrize("keep_alive", [0, 0.0, -1, "0", "5m"])
+def test_format_request_preserves_explicit_keep_alive(keep_alive):
+    model = OllamaModel("http://localhost:11434", model_id="test", keep_alive=keep_alive)
+    request = model.format_request([{"role": "user", "content": [{"text": "hello"}]}])
+    assert request["keep_alive"] == keep_alive
+
+
+@pytest.mark.parametrize("config", [{}, {"keep_alive": None}])
+def test_format_request_omits_unset_keep_alive(config):
+    model = OllamaModel("http://localhost:11434", model_id="test", **config)
+    request = model.format_request([{"role": "user", "content": [{"text": "hello"}]}])
+    assert "keep_alive" not in request
```

---

### Incident Patch 14: `5e82809b` (2026-10-02)
**Commit Message**: feat(stop): use agent.cancel() to stop the event loop (#3506)

Co-authored-by: Claude Opus 4.6 <[REDACTED_EMAIL]>

**File**: `team/designs/0019-deferred-cancel.md` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+# Unified Agent Cancellation
+
+**Date**: 2026-07-27
+
+## Overview
+
+Give tools a public, first-class way to say "stop the agent loop", with an optional way to do so after the current tool batch finishes. This will ultimately deprecate all of the other mechanisms to stopping the agent loop, and be the unified way of doing so going forward.
+
+The `stop` experimental tool is the immediate consumer, but the mechanism generalizes to any custom tool/hook/plugin.
+
+## Problem
+
+The SDK needs a way for a tool to signal "end the loop gracefully after this batch." The experimental `stop` tool is the primary consumer today. Neither of the two existing termination primitives fits:
+
+- `agent.cancel()` is an immediate abort — sibling tools in the same batch get error results, and the loop exits at the next pre-tool checkpoint.
+- The `stop_event_loop` flag (Python) and `AfterToolsEvent.endTurn` marker (TypeScript) are cooperative but live in `invocationState`, an untyped shared bag. Tools that want cooperative stop have to reverse-engineer undocumented internal keys.
+
+This affects anyone building agents that need graceful termination from inside the agent (tool call, hook, plugin, middleware, etc).
+
+### Current State
+
+Two termination primitives ship today:
+
+1. **`agent.cancel()`** — sets a flag (Python `threading.Event`, TS `AbortController`). Checked before tool execution, during model streaming, and between iterations. Pending tools in the batch receive "Tool execution cancelled" errors; the loop exits with `stopReason: 'cancelled'`. Designed for external callers (timeouts, disconnects).
+
+2. **`invocation_state` flags** — the `stop` tool writes `request_state["stop_event_loop"] = True` (Python) or `invocationState[STOP_INVOCATION_STATE_KEY] = marker` (TypeScript). The event loop checks these only after the full batch completes, so siblings finish normally.
+
+## Proposal
+
+### Recommended: Consolidate agent loop stopping on `cancel()`
+
+Add an optional flag `after_current_tools` to `agent.cancel()` that defers the cancellation until the current tool batch completes, plus an optional `message` argument that flows to the final `AgentResult` text. This will allow `agent.cancel()` to handle all of the existing use cases for stopping the agentic loop.
+
+```python
+# Python
+def cancel(self, message: str | None = None, *, after_current_tools: bool = False) -> None:
+```
+
+```typescript
+// TypeScript
+public cancel(options?: { message?: string, afterCurrentTools?: boolean }): void
+```
+
+When the deferred flag is set, the agent stores the message and a `_deferred_cancel` bit, but does **not** trip the cancel signal / abort controller. The event loop's existing post-batch checkpoint (where `stop_event_loop` / `endTurn` are read today) checks `_deferred_cancel` instead, then falls through to the normal cancel path so termination produces `stopReason: 'cancelled'` with the stored message. When the flag is unset, `cancel()` behaves exactly as today.
+
+The `stop` tool becomes a one-liner: `tool_context.agent.cancel(message, after_current_tools=True)`. The `stop_event_loop` / `STOP_INVOCATION_STATE_KEY` internal contracts are deleted, along with the TypeScript `WeakSet` + `AfterToolsEvent` hook.
+
+**Pros:**
+- Single public API for cancellation
+- Sibling tools in the batch can complete normally.
+- Cancel state lives on the agent, not in an untyped `invocationState` bag.
+- Simplifies the TypeScript stop tool substantially (no hook installation, no marker tracking).
+
+**Cons:**
+- `cancel()` now has two modes, a small conceptual burden.
+- Calling with the flag outside of a tool execution context silently behaves like immediate cancel at the next post-batch check, which may confuse callers.
+
+### Alternative: dedicated `stop_after_tools()` method
+
+Add a separate method — `stop_after_tools(message)` / `stopAfterTools(message)` — instead of overloading `cancel()`.
+
+- **Pros:** Clear separation of intent; `cancel()` keeps its "always immediate" meaning.
+- **Cons:** Two public methods for closely related behavior; users must discover a second name; "cancel is for external, stopAfterTools is for tools" is a leaky abstraction since either can be called from anywhere; grows the `LocalAgent` interface surface.
+
+### Alternative: keep `invocationState` flags as internal plumbing
+
+Leave `stop_event_loop` / `AfterToolsEvent.endTurn` in place and treat them as private.
+
+- **Pros:** Already works and is tested; no public API change.
+- **Cons:** Undocumented contract that custom tools still can't reuse cleanly; the TypeScript `WeakSet` + hook bridge stays; the `invocationState` bag continues to accumulate control-flow signals.
+
+## Developer Experience
+
+Basic usage — the shipped `stop` tool:
+
+```python
+from strands import Agent
+from strands.experimental.tools.stop import stop
+
+agent = Agent(model=model, tools=[stop, other_tools])
+result = await agent.invoke_async("Complete this
```

---

### Incident Patch 15: `c631339c` (2026-10-02)
**Commit Message**: ci(python): update mistralai requirement from <3.0.0,>=2.0.0 to >=2.0.0,<4.0.0 in /strands-py (#4809)

Signed-off-by: dependabot[bot] <[REDACTED_EMAIL]>
Co-authored-by: dependabot[bot] <49699333+dependabot[bot]@users.noreply.github.com>
Co-authored-by: opieter-aws <[REDACTED_EMAIL]>

**File**: `strands-py/pyproject.toml` (modified, +1/-1)
```diff
@@ -52,7 +52,7 @@ gemini = ["google-genai>=1.67.0,<3.0.0"]
 # the version lower than 1.92.0 until litellm has the python 3.14 supported version.
 litellm = ["litellm>=1.75.9,<=1.96.0", "openai>=1.68.0,<3.0.0"]
 llamaapi = ["llama-api-client>=0.1.0,<1.0.0"]
-mistral = ["mistralai>=2.0.0,<3.0.0"]
+mistral = ["mistralai>=2.0.0,<4.0.0"]
 ollama = ["ollama>=0.4.8,<1.0.0"]
 web-fetch = ["markdownify>=1.1.0,<2.0.0", "beautifulsoup4>=4.9.0,<5.0.0"]
 openai = ["openai>=1.68.0,<3.0.0", "aws-bedrock-token-generator>=1.1.0,<2.0.0"]
```

#### Recent Merged Pull Requests:
- **PR #4908** (2026-10-06): docs(blog): link Bidi Agent docs and quickstart (@pgrayy)
- **PR #4905** (closed): test(python): skip intermittent release integration failures (@pgrayy)
- **PR #4904** (2026-10-05): docs(blog): polish bidi GA announcement (@pgrayy)
- **PR #4899** (2026-10-05): blog: announce Bidi Agents general availability (@Albertozhao)
- **PR #4894** (2026-10-05): docs(bidi): refine model provider guides (@pgrayy)
- **PR #4889** (2026-10-05): fix(bidi): emit OpenAI usage before response stop (@pgrayy)
- **PR #4888** (closed): feat(context-manager): add Hide strategy for tool specs (@JackYPCOnline)
- **PR #4886** (2026-10-05): feat(bidi): normalize token usage events (@pgrayy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

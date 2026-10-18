> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/seo-skills-seo-audit-skill-learnings.md`  
> **Source**: github (https://github.com/seo-skills/seo-audit-skill)  
> **Source Version**: `fac4b75f20`  
> **License**: MIT  
> **Synthesized By**: Antigravity Deep Forensic Harvester  
> **Timestamp**: 2026-10-18T05:30:00.000Z  
> **Learning ID**: `learn-github-seo-skills-seo-audit-skill`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record: seo-skills/seo-audit-skill

## 1. Executive Forensic Architecture & System Mechanics
`@seomator/seo-audit` is an industrial TypeScript SEO audit engine implementing **385 verified rule implementations across 20 distinct categories** (`a11y`, `content`, `core`, `crawl`, `eeat`, `geo`, `htmlval`, `i18n`, `images`, `js`, `legal`, `links`, `mobile`, `perf`, `redirect`, `schema`, `security`, `social`, `technical`, `url`) with a 139-test regression and baseline suite.

### Key Architectural Innovations:
1. **Deterministic Score-Capping Operator (`src/score-caps.ts`)**:
   - Resolves the foundational flaw of multi-category weighted averaging where pages with fatal search-blocking directives (`noindex` or `robots.txt Disallow`) receive deceptive high scores (94/100, Grade A) due to pristine TLS, compression, and HTTP headers.
   - Applies deterministic ceilings: `noindex` (cap 20), `robots-disallowed` (cap 20), `empty-page` (cap 30), `thin-content` <20 words (cap 49), `no-title` (cap 69).
2. **Decoupled PageFacts Extraction**:
   - Facts are read directly from raw HTTP headers and parsed Cheerio DOM into an immutable `PageFacts` record, preventing score manipulation when user configs disable individual rules.
3. **App-Shell Detection Boundary**:
   - Inspects single-page framework mount points (`#root`, `#app`, `#__next`, `#__nuxt`, `#__svelte`) with text length < 50 to avoid penalizing unrendered SPA shells with empty-page caps before headless browser hydration.
4. **Targeted Robots User-Agent Directives Parsing**:
   - Isolates crawler-specific header directives (e.g. `googlebot: noindex` vs `bingbot: noindex`) and filters out valued directives (`max-snippet`, `max-image-preview`).

## 2. Multi-Dimensional Investigation Summary (D1 to D8)
- **D1 (Architecture)**: Decoupled CLI (`src/cli.ts`), rule definition framework (`define-rule.ts`), score ladder calculator (`scoring.ts`), verdict bands (`verdict.ts`), and multi-reporter subsystem (`reporters/`).
- **D2 (Concurrency)**: Asynchronous crawl queue with bounded concurrency and cancellation tokens (`src/cancel.test.ts`).
- **D3 (Error Isolation)**: Connection refusal and certificate rejection classification (`fix(qa): ISSUE-028 — classify refused connections and rejected certificates`).
- **D4 (Resource Defenses)**: SQLite persistent storage cleanup and Electron native module isolation (`better-sqlite3`).
- **D5 (Boundary Deserialization)**: Strict validation of rule output contracts via TypeScript asserts guards.
- **D6 (Cross-Platform)**: Platform-agnostic path normalization and Electron desktop packaging.
- **D7 (Tooling)**: Vitest + tsup + electron-builder with automated doc synchronization.
- **D8 (Forensic Bug Fixes)**:
  - Commit `163ed45`: `fix(qa): ISSUE-029 — read Googlebot's robots.txt group in crawl-indexability-conflict`
  - Commit `b0dd18a`: `fix(qa): ISSUE-026 — stop reading Open Graph property= tags as RDFa`
  - Commit `851e183`: `fix(qa): ISSUE-036 — read enableRules [] and ["*"] as the same filter`

## 3. Promoted Master Brain Rules
- **Rule 1610**: Deterministic Score-Cap Operator for Catastrophic Search Exclusion.
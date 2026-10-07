# Candidate Directive CD-001: Multilingual-First Website Architecture & Language Completeness Gate

> **Directive ID**: `CD-001`  
> **Source**: Tier-1 Human Directive via Chat Master Prompt  
> **Date Staged**: `2026-10-07`  
> **Status**: `PROMOTED_CANONICAL_ACTIVE` (Promoted to 01_CORE, 05_KNOWLEDGE, 03_SKILLS, 08_VERIFICATION)  
> **Trigger Tags**: `["multilingual", "i18n", "seo", "traffic_drop", "gsc_451", "gsc_254", "gsc_48", "gsc_404", "hreflang", "sitemap", "canonical", "language_completeness_gate"]`

---

## 1. Directive Context & Problem Statement

### The Incident:
- Organic search traffic dropped to 0 across the web property.
- Over 50% of discoverable pages exhibited catastrophic Google Search Console (GSC) indexation exclusions:
  - **451** — Page with redirect (Trailing slash mismatches, protocol redirects, redirect loops)
  - **21** — Not found (404) (Broken hreflang alternate URLs, missing routes)
  - **4** — Alternate page with proper canonical (Cross-language canonical pointing to default language instead of self-canonical)
  - **254** — Crawled – currently not indexed (Thin machine-translated content, duplicate logic, unlocalized body)
  - **1** — Server error (5xx) (SSR rendering crashes on unexpected locale parameters)
  - **48** — Discovered – currently not indexed (Orphan language alternates, crawl budget exhaustion due to sitemap contradictions)
- Root Cause in previous AI behavior: Multilingual was treated as a "post-production translation sync task" inside a localized SEO skill. AI repeatedly audited and changed ad-hoc code ("baar baar bigadta h sudarta h") without an architectural foundation.

---

## 2. Core Architectural Mandate

### Master Rule:
> **"Every Website = Language-Aware by Design"**
>
> Multilingualization MUST NOT be treated as a post-production translation task.
> No user-facing feature, page, tool, content entity, SEO entity, metadata entity, navigation element, error state, accessibility element, structured-data entity, or discoverable URL shall be created outside the language architecture.

### The 3 Conceptual Layers:
- **Translation** $\ne$ **Localization** $\ne$ **Multilingual Architecture**.
- **Translation**: Literal machine conversion of text strings (English $\to$ Hindi). Leads directly to GSC "Crawled - currently not indexed" (thin content penalty).
- **Localization**: Adapting user intent, natural search queries, phrasing, examples, and cultural context per target locale.
- **Multilingual Architecture**: Structural integration of URLs, self-canonicals, reciprocal hreflang graphs, sitemap membership, internal link hygiene, tool engine abstraction, error handling, accessibility, and certification gates.

---

## 3. The 12 Multilingual Layers

1. **Language Registry**: Explicit configuration (`SUPPORTED_LANGUAGES`, `DEFAULT_LANGUAGE`, `FALLBACK_LANGUAGE`, `URL_STRATEGY`).
2. **URL Layer**: Deterministic URL per language (`/en/...`, `/hi/...`, `/de/...`). Single canonical trailing-slash convention. No random query parameters or language cookies.
3. **Canonical Layer**: Every localized page is **Strictly Self-Canonical** (`/hi/...` $\to$ `/hi/...`). NEVER point a translated language page canonical to the English page.
4. **Hreflang Graph**: Complete reciprocal alternates (`A` $\to$ `B` and `B` $\to$ `A`) plus fully qualified `x-default`. Missing reciprocity = Instant FAIL.
5. **Sitemap Layer**: Zero contradiction across: `Canonical URL` $\equiv$ `Sitemap Membership` $\equiv$ `Hreflang Cluster` $\equiv$ `Internal Links`.
6. **SEO Content Layer**: Intent-driven localization: `SOURCE INTENT` $\to$ `LOCAL SEARCH BEHAVIOR` $\to$ `NATURAL QUERY` $\to$ `LOCALIZED TITLE, DESCRIPTION, H1, FAQ, BODY`. Mass machine-translated thin content is strictly forbidden.
7. **Tool/Function Layer**: Micro-tool transformation logic is language-agnostic; UX, placeholders, buttons, help text, examples, and copy feedback are fully localized.
8. **Error Layer**: Localized error states (404, 500, invalid inputs, empty inputs, network timeouts, copy failure).
9. **Accessibility Layer**: Localized `aria-label`, `alt` attributes, screen-reader text, form labels, and keyboard hints.
10. **Structured Data Layer**: Language-aware Schema.org JSON-LD (`WebApplication`, `FAQPage`, `BreadcrumbList`).
11. **Open Graph / Social Layer**: Localized `og:title`, `og:description`, `og:locale`, and platform tags.
12. **Indexing Verification Layer**: Full matrix audit (Expected vs Actual, HTTP 200, canonical, hreflang, sitemap, internal links, robots, noindex, redirect, 404, 5xx, duplicates, orphans).

---

## 4. The Language Completeness Gate

A mandatory verification barrier before issuing `PRODUCT_READY_CERTIFICATE.md`:
```
Expected Languages = N
Generated Languages = M
IF M < N: PRODUCT READY = FAIL
```
All of the following must pass 100%:
- Translation completeness
- SEO completeness
- URL completeness
- Hreflang completeness
- Sitemap completeness
- UI completeness
- Error completeness

---

## 5. Promotion & Single-Source Resolution

- **Canonical Locations**:
  - `01_CORE/operating-rules.md` (Rule 24)
  - `05_KNOWLEDGE/engineering-patterns.md` (Rule 242)
  - `03_SKILLS/multilingual-first-architecture.md`
  - `08_VERIFICATION/project-ready-certification-protocol.md` (Pillar 11)
  - `08_VERIFICATION/universal-production-audit-protocol.md` (Phases 26–30 & 50–53)
- **Lifecycle Status**: Active, canonical, and promoted. Staging draft preserved as provenance pointer.

# CrawlCove Hreflang Checker — Forensic Learning Dossier

**Repository**: `https://github.com/CrawlCove/crawlcove-hreflang-checker`
**Harvest Date**: 2026-10-18
**Ecosystem**: TypeScript / Node.js
**Domain**: Multilingual SEO Reciprocity & Conflict Detection

## 1. Architectural Overview
A comprehensive checker for international SEO that extracts hreflang tags across HTML `<head>`, HTTP `Link` response headers, and XML `<xhtml:link>` sitemaps. It verifies reciprocity, self-referencing links, canonical conflicts, and valid ISO 639-1 / BCP 47 subtags.

## 2. Key Code Evidence & Implementation Patterns
- **Complete ISO 639-1 Validation**: Maintains a static `ReadonlySet` of all 184 valid 2-letter language codes.
- **Common Mistake Diagnostics**:
  - Catches underscores: `"en_US"` -> suggests `"en-US"`.
  - Catches region-as-language: `"gb"` -> flags `"gb is a region, not a language; use en-gb"`.
  - Catches three 2-letter subtags: `"en-us-ca"` -> flags invalid shape.
- **Reciprocity State Machine**: Tracks status as `ok`, `missing`, `unreachable`, `redirected`, or `not-in-sitemap`.

## 3. Negative Constraints
- Never allow relative URLs in hreflang href attributes; search indexers strictly require absolute URLs.
- Never declare hreflang on pages that return non-200 HTTP status, contain `noindex` robots directives, or have canonical tags pointing to a different URL.

## 4. Reusable Intelligence Promoted
- Contributed to **Rule 1625**: HTTP Link Header Hreflang Injection & BCP 47 Hyphenated Subtag Validation.

# CrawlCove Robots.txt Tester — Forensic Learning Dossier

**Repository**: `https://github.com/CrawlCove/crawlcove-robots-txt-tester`
**Harvest Date**: 2026-10-18
**Ecosystem**: TypeScript / Node.js
**Domain**: RFC 9309 Robots Exclusion Protocol Linting & URL Verdicts

## 1. Architectural Overview
An automated testing and linting engine for `robots.txt` conforming to RFC 9309. It parses directives, determines crawler-specific URL access permissions, flags catastrophic deployment errors (such as blocking JS/CSS assets or catch-all SPA HTML responses), and checks 500 KiB file size limits.

## 2. Key Code Evidence & Implementation Patterns
- **HTTP Status Code Triage (`src/robots.ts`)**:
  - `5xx`: Google stops crawling the site for up to 30 days (critical outage alert!).
  - `404 / 410`: Absent robots.txt; everything allowed.
  - `4xx` (other than 404): Non-Google crawlers may halt.
  - `200` with HTML/JSON/XML: SPA framework fallback served instead of plain text (fatal configuration bug!).
- **Asset Blocking Detection**: Regex patterns detect `Disallow` rules blocking `/wp-content/`, `/_next/`, `*.css`, `*.js`, which prevents Googlebot from rendering pages properly.
- **RFC 9309 Invariants**: Longest-path rule precedence; `Allow` beats `Disallow` when pattern lengths are equal; 500 KiB maximum parsing boundary.

## 3. Negative Constraints
- Never block CSS or JS asset directories in robots.txt.
- Never serve an HTML error page or 200 SPA route for `/robots.txt`.
- Never exceed 500 KiB in a robots.txt file.

## 4. Reusable Intelligence Promoted
- Contributed to **Rule 1623**: Robots.txt Precedence, User-Agent Specificity & 200-Catch-All Quarantine.

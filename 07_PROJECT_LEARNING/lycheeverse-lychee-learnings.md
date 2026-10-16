# Forensic Learning Record: lycheeverse/lychee

> **Canonical Artifact**: `07_PROJECT_LEARNING/lycheeverse-lychee-learnings.md`  
> **Source Repository**: [https://github.com/lycheeverse/lychee.git](https://github.com/lycheeverse/lychee)  
> **Commit Hash**: `54f8bf47ffbd35973b8eb016ccbc67221c75ba5f`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: Rust (Cargo workspace: lychee-lib, lychee-bin, tokio, reqwest, html5gum)  

---

## 1. Project Context & Architectural Mission

`lycheeverse/lychee` is a blazing fast, asynchronous link and URI validator written in Rust. It checks URLs across Markdown, HTML, reStructuredText, PDF, and plain text. Engineered for enterprise CI/CD workflows, it features per-host token bucket rate limiting, disk caching, dead anchor fragment verification, and domain-specific request rewriting quirks.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & Structural Boundaries
- **Crates & Modules**:
  - `lychee-lib/src/checker/`: High-throughput asynchronous checkers for websites, local files, and wikilinks.
  - `lychee-lib/src/ratelimit/`: Domain-keyed rate limiter pool preventing HTTP 429 Too Many Requests errors.
  - `lychee-lib/src/utils/fragment_checker/`: In-depth HTML fragment and anchor validation.
  - `lychee-lib/src/quirks/`: Domain rewrite engine for anti-bot platforms.
  - `lychee-lib/src/extract/html/`: High-performance streaming HTML parsing via `html5gum`.

### D2: In-Page Fragment & Anchor Verification
- Validating that a target URL returns HTTP 200 is insufficient: internal links frequently point to specific section anchors (`https://example.com/docs#feature-x`).
- Lychee parses the target document's DOM, builds a set of valid element IDs and name attributes, and verifies that the fragment actually exists on the target page. If the anchor is missing, it reports a dead fragment link defect.

### D3: Domain Quirks & Anti-Bot Rewriting
- Large platforms often block automated HTTP HEAD requests or present bot detection walls:
  - **YouTube Quirk**: Rewrites YouTube video URLs (`youtube.com/watch?v=ID` or `youtu.be/ID`) into thumbnail image requests (`https://img.youtube.com/vi/{id}/0.jpg`). Bypasses heavy HTML/JS loading and bot challenges while instantly validating video existence with HTTP 200/404.
  - **GitHub Fragment Quirk**: Strips source line number fragments (`#L123-L145`) from GitHub blob links to avoid false anchor missing reports on dynamically loaded code viewers.
  - **Crates.io Quirk**: Explicitly inserts `Accept: text/html` headers to avoid unexpected API redirection.

### D4: Per-Host Rate Limiter Pool
- Prevents DDoS-ing third-party servers by maintaining an internal pool of per-host rate limiters keyed by network netloc. Requests to independent domains proceed concurrently, while requests to the same host are smoothly throttled.

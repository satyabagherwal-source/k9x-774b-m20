# Forensic Learning Record: spronta/crawlie

> **Canonical Artifact**: `07_PROJECT_LEARNING/spronta-crawlie-learnings.md`  
> **Source Repository**: [https://github.com/spronta/crawlie.git](https://github.com/spronta/crawlie)  
> **Commit Hash**: `810e836874214d8aac29ee37a1521b7361027d79`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: Rust (Cargo workspace: crawlie-core, crawlie-rules, crawlie-mcp, crawlie-cli)  

---

## 1. Project Context & Architectural Mission

`spronta/crawlie` is a modern, modular web crawling and SEO auditing engine engineered in Rust. It re-architects site crawling by decoupling link traversal from fact-extraction and rule-based constraint validation. Crawlie exposes a Model Context Protocol (MCP) server interface (`crawlie-mcp`) allowing AI coding assistants and autonomous agents to programmatically trigger targeted crawls, query discovered site topology, and validate schema contracts.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & Structural Boundaries
- **Workspace Crates**:
  - `crawlie-core`: Asynchronous crawler loop, token bucket rate limiter, robots.txt parser, and HTML stream ingestion.
  - `crawlie-rules`: Declarative verification engine evaluating factual page assertions (CheckRule predicates).
  - `crawlie-mcp`: JSON-RPC 2.0 Model Context Protocol server exposing crawler primitives to LLM agents.
  - `crawlie-cli`: High-throughput CLI binary with terminal dashboard and structured JSON/CSV export.

### D2: Declarative Page Fact Assertions (CheckRule Model)
- Traditional SEO crawlers combine extraction with scoring heuristics, producing hardcoded advice. Crawlie introduces a declarative **Fact vs Assertion** separation:
  - Extractors produce immutable facts: `PageFacts { url, status, canonical, robots_meta, schema_types, h1_count, title_len }`.
  - Assertions evaluate deterministic boolean predicates: `Rule::MustHaveCanonical`, `Rule::RequireSchema(type)`, `Rule::MaxHops(n)`.
  - Enables CI/CD pipelines to fail builds if a staging deployment drops mandatory `Product` or `Article` structured data schemas on specific URL path patterns (`/products/*`).

### D3: Asynchronous Stream Concurrency & Politeness
- Uses Tokio asynchronous tasks with a host-keyed sliding window rate limiter.
- Respects `crawl-delay` from robots.txt while maintaining multi-host concurrency when external resources or CDNs are evaluated.
- Bounded memory buffer: avoids building full in-memory DOMs when checking status codes or response headers for non-HTML resources.

### D4: Key Invariants & Anti-Patterns Harvested
- **Invariant**: URL Normalization must precede queue insertion. Query parameters must be sorted alphabetically, trailing slashes harmonized, and fragment identifiers stripped to prevent crawl loops.
- **Defect Trapped**: Crawlers that inspect only HTTP 200 pages miss broken redirect chains (e.g. 301 -> 302 -> 404), which leak link equity and exhaust search engine crawl budgets.

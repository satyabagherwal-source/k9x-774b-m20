# Forensic Learning Record: Patience-dot-devl/gocrawl

> **Canonical Artifact**: `07_PROJECT_LEARNING/patience-dot-devl-gocrawl-learnings.md`  
> **Source Repository**: [https://github.com/Patience-dot-devl/gocrawl.git](https://github.com/Patience-dot-devl/gocrawl)  
> **Commit Hash**: `56e20a5aa4e3c648cdd180ba381586e21152c666`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: Go 1.27+, Cobra CLI, MCP (Model Context Protocol)  

---

## 1. Project Context & Architectural Mission

`Patience-dot-devl/gocrawl` is a blazing-fast, concurrent open-source web crawler designed specifically for SEO and SEA technical audits. Written in Go, it features a modular architecture where the crawl engine is cleanly decoupled from pluggable analyzers, and exposes a native Model Context Protocol (MCP) server for autonomous AI coding agents.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & The Analyzer Seam Pattern
- **Decoupled Seam**: The crawl engine knows nothing about specific checks, and the checks never fetch the crawl. The two sides meet at a single interface: `analyze.Analyzer`.
- **Pure Analyzers**: Analyzers read an immutable `crawler.Result` and return `[]analyze.Issue`. They do not mutate shared state or trigger out-of-band I/O.
- **Governed Fetching**: For checks requiring extra network resources (e.g. `sitemap.xml`, `llms.txt`), fetches are wrapped by `Engine.Govern`, strictly enforcing robots.txt policies and rate limits.

### D2: Asynchronous State & Concurrency Invariants
- High-throughput concurrency driven by Go channels and worker pools.
- Thread-safe URL normalization, fragment stripping, and domain scoping preventing accidental off-domain crawling.

### D3: Error Boundaries & Recovery
- Graceful handling of network timeouts, TLS handshake failures, and truncated HTTP bodies without crashing the crawl queue.
- Atomic file operations (`internal/atomicfile`) writing temp files and renaming to prevent corrupted crawl reports.

### D4: Resource Lifecycle & Leak Defenses
- Controlled HTTP connection pooling with explicit idle connection timeouts.
- Response body closing (`defer resp.Body.Close()`) strictly enforced across all fetchers to eliminate socket descriptor exhaustion.

### D5: Boundary Deserialization & Structured Data Graphing
- **`internal/analyze/schemaorg`**: Flattens nested JSON-LD scripts into an addressable node graph (`Node`, `Graph`, dotted paths, `@id` reference resolution). Enables complex relationship audits (e.g. verifying that a `BreadcrumbList` resolves valid `ListItem` targets).

### D6: Cross-Platform & AI Integration
- Native Model Context Protocol (MCP) server over `stdio` allowing AI coding agents (such as Antigravity) to initiate crawls, inspect issues, and list active analyzers programmatically.
- Dedicated `llms.txt` and `llms-full.txt` verification for AI search readiness (GEO/AEO).

### D7: Build, CI/CD, Tooling & Automation
- Rigid CI checks (`make check`) incorporating docs-drift validation (`internal/repocheck` ensures code, CLI commands, and `AGENTS.md` never diverge).

### D8: Forensic Bug Fixes & Real Production Incidents
- **Issue**: Crawl engine deadlocking when encountering infinite redirect loops.
- **Fix**: Implemented hop-count threshold and visited-set cycle detection in `internal/redirects.go`.

---

## 3. Empirical Evidence & Ground Truth
- Verified against commit `56e20a5aa4e3c648cdd180ba381586e21152c666`.
- Verified architectural invariants documented in `AGENTS.md`.

---

## 4. Master Brain Integration & Status
- **Status**: `VERIFIED_LEARNING`
- **Indexed In**: `05_KNOWLEDGE/knowledge-index.json`
- **Registered In**: `04_WORKFLOWS/factory-engine/sources-registry.json`

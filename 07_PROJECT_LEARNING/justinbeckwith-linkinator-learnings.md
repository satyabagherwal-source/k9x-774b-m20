# Forensic Learning Record: JustinBeckwith/linkinator

> **Canonical Artifact**: `07_PROJECT_LEARNING/justinbeckwith-linkinator-learnings.md`  
> **Source Repository**: [https://github.com/JustinBeckwith/linkinator.git](https://github.com/JustinBeckwith/linkinator)  
> **Commit Hash**: `62ba21965daddd9db2a451e8eacc510a010d6762`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: TypeScript, Node.js (htmlparser2, p-queue, saxes)  

---

## 1. Project Context & Architectural Mission

`JustinBeckwith/linkinator` is a production-grade link validator and crawler for web applications and static sites. Written in TypeScript by a former Google engineer, it provides streaming HTML parsing, exhaustive DOM attribute coverage (standard links, responsive `srcset`, Schema.org JSON-LD URL fields, meta refresh tags), and sophisticated retry/concurrency handling.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Exhaustive HTML Element URL Attribute Matrix
- Most crawlers inspect only `<a href>` and `<img src>`. Linkinator maps all HTML specifications:
  - `href`: `a`, `area`, `embed`, `link`
  - `src`: `audio`, `embed`, `frame`, `iframe`, `img`, `input`, `script`, `source`, `track`, `video`
  - `srcset`: `img`, `source` (parsed via dedicated responsive descriptor parser)
  - `cite`: `blockquote`, `del`, `ins`, `q`
  - `data`: `object`
  - `poster`: `video`
  - `background`: `body`
  - `manifest`: `html`
  - `content`: `meta` (regex parsing of `http-equiv="refresh"` delay and target URL)
  - **Schema.org URL Fields**: Ingests JSON-LD blocks and parses target URLs embedded in structured data properties.

### D2: Streaming HTML Parsing
- Uses `htmlparser2/WritableStream` to process HTML documents as byte chunks without loading complete DOM trees into memory. Drastically reduces memory consumption during high-concurrency multi-page audits.

### D3: Selective Relationship Filtering
- Ignores network optimization hints (`rel="dns-prefetch"`, `rel="preconnect"`) from broken-link failure lists, as these are speculative browser hints rather than navigational user links.

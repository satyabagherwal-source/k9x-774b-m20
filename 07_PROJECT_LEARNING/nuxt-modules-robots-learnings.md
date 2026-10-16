# Forensic Learning Dossier: nuxt-modules/robots

## 1. Metadata & Source Provenance
- **Repository**: [nuxt-modules/robots](https://github.com/nuxt-modules/robots)
- **Commit SHA**: `f9b1ec66da60f2f797cbde52339b1c36d9e042a4`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Dynamic Nitro server middleware generating RFC 9309 compliant `robots.txt`, HTTP `X-Robots-Tag` headers, and HTML meta tags.

## 2. Core Architectural Mechanisms
1. **RFC 9309 User-Agent Rule Ordering**:
   - Sorts robot rules such that specific crawlers (e.g. `Googlebot`, `Bingbot`) appear before generic `User-agent: *`.
   - Enforces correct RFC 9309 precedence: longest path matching determines whether an `Allow:` overrides a `Disallow:`.
2. **AI Web Scraper Control Presets**:
   - Native presets to allow or block emerging generative AI bots: `GPTBot`, `ChatGPT-User`, `CCBot`, `anthropic-ai`, `Claude-Web`, `Google-Extended`, `Bytespider`, `FacebookBot`.
   - Allows fine-grained separation between Search Indexing (Googlebot) and AI Training ingestion (Google-Extended).
3. **Multi-Channel Robots Directives Synchronization**:
   - Synchronizes `/robots.txt` disallow paths with HTTP `X-Robots-Tag` headers on non-HTML responses (PDFs, raw API endpoints) and HTML `<meta name="robots">` on SSR pages.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Blocking CSS/JS in `robots.txt`. Crawlers cannot render JavaScript or calculate Core Web Vitals if assets in `/_nuxt/` are disallowed. Module explicitly prevents disallowing client bundle assets.
- **Failure Mode 2**: Trailing slash mismatch in robots path patterns (e.g. `Disallow: /admin` blocking `/administration`). RFC 9309 prefix matching rules strictly handled.

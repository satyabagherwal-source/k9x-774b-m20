# Verification Protocol: Verification Protocol: Empirical Defect Shield for nuxt/modules/robots

<!-- PROVENANCE_START
{
  "source_repository": "nuxt/modules/robots",
  "source_url": "https://github.com/nuxt/modules/robots",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nuxt/modules/robots](https://github.com/nuxt/modules/robots) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `nuxt/modules/robots` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
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


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

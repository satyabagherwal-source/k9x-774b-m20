# CrawlCove Sitemap Validator — Forensic Learning Dossier

**Repository**: `https://github.com/CrawlCove/crawlcove-sitemap-validator`
**Harvest Date**: 2026-10-18
**Ecosystem**: TypeScript / Node.js
**Domain**: XML Sitemap Protocol Limits, Gzip Magic-Byte Sniffing & Cross-Host Verification

## 1. Architectural Overview
A rigorous validation suite for XML Sitemaps and Sitemap Indexes adhering to Sitemaps.org protocol limits (max 50,000 URLs, max 50 MB uncompressed). It validates W3C Datetime formats, flags future `lastmod` timestamps, inspects cross-host domain boundaries, and handles gzip payloads by inspecting magic bytes.

## 2. Key Code Evidence & Implementation Patterns
- **Magic-Byte Gzip Detection (`src/validate.ts`)**:
  ```typescript
  export function decodeBody(body: Buffer): { text: string; gzipped: boolean } {
    if (body.length >= 2 && body[0] === 0x1f && body[1] === 0x8b) {
      return { text: gunzipSync(body).toString('utf8'), gzipped: true };
    }
    return { text: body.toString('utf8'), gzipped: false };
  }
  ```
- **Cross-Host `<loc>` Quarantine**:
  If `<loc>` URL domain differs from the sitemap's host, search engines ignore the URL unless cross-submitted via target host's `robots.txt`.
- **W3C Datetime & Future Date Assertion**:
  Regex validates standard datetime formats; flags any `lastmod` dated > 24 hours in the future.

## 3. Negative Constraints
- Never exceed 50,000 URLs or 50 MB uncompressed per sitemap file.
- Never rely on `.gz` file extension to determine gzip compression; always inspect magic bytes `0x1f 0x8b`.
- Never submit URLs on different hostnames without explicit cross-domain verification.

## 4. Reusable Intelligence Promoted
- Contributed to **Rule 1624**: XML Sitemap Protocol Boundaries, Cross-Host Isolation & Future Lastmod Rejection.
- Contributed to **Rule 1627**: Magic-Byte Gunzip Sniffing & Nested Sitemap Index-to-Child Lastmod Parity.

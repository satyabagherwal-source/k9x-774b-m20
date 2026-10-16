# Forensic Learning Record: Yoast/wordpress-seo

> **Canonical Artifact**: `07_PROJECT_LEARNING/yoast-wordpress-seo-learnings.md`  
> **Source Repository**: [https://github.com/Yoast/wordpress-seo.git](https://github.com/Yoast/wordpress-seo)  
> **Commit Hash**: `f20fa7a6a590988623813963bf9abc6e1cb3f909`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: PHP 7.4+, Composer, WordPress Plugin Architecture  

---

## 1. Project Context & Architectural Mission

`Yoast/wordpress-seo` is the most widely deployed WordPress SEO plugin in the world (13M+ active installs). It sets the industry standard for indexable entity models, interconnected Schema.org JSON-LD graphs, XML sitemap generation, and strict canonicalization rules.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: The Noindex Canonical Suppression Invariant
- In `src/presenters/canonical-presenter.php`:
  ```php
  if ( \in_array( 'noindex', $this->presentation->robots, true ) ) {
      return '';
  }
  ```
- **The Core Rule**: If a page carries a `noindex` directive, Yoast **completely suppresses the `<link rel="canonical">` tag**. Emitting both creates contradictory signals for search engines: `noindex` instructs bots to discard the page, while `canonical` instructs bots to consolidate link equity into a target. Suppressing canonical on noindex pages avoids GSC conflicting signal errors.

### D2: Schema.org Interconnected `@graph` Architecture
- In `src/generators/schema/`:
  - Does NOT output isolated, disconnected JSON-LD blocks.
  - Generates a single, coherent `@graph` array where:
    - `WebSite` has `@id: "https://example.com/#website"`.
    - `Organization` has `@id: "https://example.com/#organization"`.
    - `WebPage` references `isPartOf: { "@id": "https://example.com/#website" }` and `about: { "@id": "https://example.com/#organization" }`.
    - `Article` references `mainEntityOfPage: { "@id": "https://example.com/post/#webpage" }`.
  - Enables Googlebot to reconstruct the complete entity graph without ambiguity.

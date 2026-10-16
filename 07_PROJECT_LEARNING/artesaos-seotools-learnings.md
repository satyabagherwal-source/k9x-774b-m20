# Forensic Learning Record: artesaos/seotools

> **Canonical Artifact**: `07_PROJECT_LEARNING/artesaos-seotools-learnings.md`  
> **Source Repository**: [https://github.com/artesaos/seotools.git](https://github.com/artesaos/seotools)  
> **Commit Hash**: `c92d09f0ad4491181863850a3ab2e1534361409b`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: PHP 8+, Laravel Facades, Meta/OpenGraph/Twitter/JSON-LD  

---

## 1. Project Context & Architectural Mission

`artesaos/seotools` is an established SEO package for Laravel that provides fluent facades and contracts to manage standard HTML metadata, OpenGraph tags, Twitter Cards, and JSON-LD structured data.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Decoupled Meta Generation Engines
- Organizes metadata into 4 distinct, independently configurable engines:
  - `SEOMeta`: Standard meta tags, title prefixes/suffixes, directional title inversion, canonical URL, AMP URL, and pagination (`rel="prev"` / `rel="next"`).
  - `OpenGraph`: Facebook/LinkedIn graph metadata, multiple image support with mime-types, width, and height.
  - `TwitterCards`: Twitter-specific card formats (`summary`, `summary_large_image`, `app`, `player`).
  - `JsonLd`: Script tag generation for structured data entities.

### D2: Architectural Cleanliness
- Enforces strict contract boundaries (`Contracts\MetaTags`, `Contracts\OpenGraph`), ensuring that metadata formatting logic is testable in isolation from HTTP request lifecycles.

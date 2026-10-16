# Forensic Learning Record: spatie/laravel-sitemap

> **Canonical Artifact**: `07_PROJECT_LEARNING/spatie-laravel-sitemap-learnings.md`  
> **Source Repository**: [https://github.com/spatie/laravel-sitemap.git](https://github.com/spatie/laravel-sitemap)  
> **Commit Hash**: `ac9534b5a8abe694b89a4496b69df0d133889e27`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: PHP 8.1+, Laravel Framework, XML Sitemap 0.9 Protocol  

---

## 1. Project Context & Architectural Mission

`spatie/laravel-sitemap` is the premier sitemap generation library for Laravel applications. It supports automated link crawling, fluent manual generation, multi-lingual alternate tags (`xhtml:link`), Google Image sitemaps, Google Video sitemaps, Google News sitemaps, and automated chunking into `<sitemapindex>`.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Multilingual Hreflang Sitemaps (`Tags/Alternate.php`)
- Automatically emits W3C/Google compliant XML sitemap alternate language annotations:
  ```xml
  <url>
    <loc>https://example.com/en/page</loc>
    <xhtml:link rel="alternate" hreflang="es" href="https://example.com/es/page" />
    <xhtml:link rel="alternate" hreflang="en" href="https://example.com/en/page" />
  </url>
  ```
- Eliminates the need to bloat the HTML `<head>` with dozens of alternate link tags on large multilingual sites.

### D2: Automatic Sitemap Chunking (`SitemapIndex.php`)
- Enforces the Google 50,000 URLs / 50MB per sitemap limit. When URL count exceeds 50,000, automatically creates partitioned files (`sitemap1.xml`, `sitemap2.xml`) and generates a master `sitemap.xml` referencing them inside `<sitemapindex>`.

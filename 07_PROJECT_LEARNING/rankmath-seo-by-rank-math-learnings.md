# Forensic Learning Record: RankMath/seo-by-rank-math

> **Canonical Artifact**: `07_PROJECT_LEARNING/rankmath-seo-by-rank-math-learnings.md`  
> **Source Repository**: [https://github.com/RankMath/seo-by-rank-math.git](https://github.com/RankMath/seo-by-rank-math)  
> **Commit Hash**: `50fc59587112316ad754ca3c9a26e1282795d49d`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: PHP 7.4+, WordPress Core, IndexNow Protocol  

---

## 1. Project Context & Architectural Mission

`RankMath/seo-by-rank-math` is an advanced WordPress SEO suite featuring automated URL redirection, real-time 404 monitoring, dynamic image SEO alt injection, IndexNow multi-engine broadcasting, and AI search visibility (`/llms.txt`).

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Automated Slug Mutation 301 Redirection (Redirection Watcher)
- In `includes/modules/redirections/class-watcher.php`:
  - Hooks into WordPress `post_updated` and `edit_terms`.
  - Detects if an editorial slug or parent hierarchy changed (`$old_slug !== $new_slug`).
  - Automatically records a permanent 301 redirect in the database from the old path to the new path.
  - Prevents 404 errors and broken backlinks when post titles or URLs are modified post-publication.

### D2: IndexNow Real-Time Protocol Broadcasting
- Integrates the IndexNow API protocol: when content is published, updated, or deleted, broadcasts the URL instantly to Bing, Yandex, Seznam, and Naver with API key verification, bypassing crawl delay.

### D3: Real-Time 404 Logging & Regex Redirection
- Intercepts 404 requests at template load, logging hitting IP, user-agent, and referer.
- Allows wildcards and regex-based automatic redirection rules to resolve bulk broken URLs in one pattern.

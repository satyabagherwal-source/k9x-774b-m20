> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/janreges-siteone-crawler-learnings.md`  
> **Source**: github (https://github.com/janreges/siteone-crawler)  
> **Source Version**: `f3d967b190`  
> **License**: MIT  
> **Synthesized By**: Antigravity Deep Forensic Harvester  
> **Timestamp**: 2026-10-18T06:10:00.000Z  
> **Learning ID**: `learn-github-janreges-siteone-crawler`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  

---

# Project Learning Record: janreges/siteone-crawler

## 1. Executive Forensic Architecture & System Mechanics
High-performance asynchronous Rust crawler (Tokio async runtime) with 776 commits, integrating SEO, accessibility, performance, and AI-search entity extraction.

### Key Architectural Innovations:
1. **Semantic Byline Landmark Scoping (`src/ai/`)**:
   - Quarantines global `<header>` and `<footer>` semantic landmarks so navigation links ("About Us", "Editorial Team") are never misidentified as the individual author.
2. **Split-Node Inline Text Normalization**:
   - Assembles author names split across inline formatting tags (`<span>Jane</span> <em>Doe</em>`) into a single normalized entity string (`05e57b0`).
3. **Role & Title Exclusion Filter**:
   - Strips professional titles and honorifics ("Senior Editor", "Staff Writer") before populating `author.name` (`d135751`).

## 2. Promoted Master Brain Rules
- **Rule 1621**: Semantic Byline Landmark Boundary & Split-Node Text Normalization.
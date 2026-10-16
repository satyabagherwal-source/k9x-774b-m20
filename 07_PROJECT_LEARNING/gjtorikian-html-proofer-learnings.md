# Forensic Learning Record: gjtorikian/html-proofer

> **Canonical Artifact**: `07_PROJECT_LEARNING/gjtorikian-html-proofer-learnings.md`  
> **Source Repository**: [https://github.com/gjtorikian/html-proofer.git](https://github.com/gjtorikian/html-proofer)  
> **Commit Hash**: `b342424bbc3656e3d241949ad171c5ef3cc11c8e`  
> **Harvest Date**: 2026-10-16  
> **Harvest Engine**: Batch Auto-Harvester (Full Clone Deep Audit)  
> **Languages & Ecosystem**: Ruby, Nokogiri, Typhoeus (libcurl parallel async multi)  

---

## 1. Project Context & Architectural Mission

`gjtorikian/html-proofer` is an industry-standard static HTML verification engine widely used in static site generators (Jekyll, Hugo, Gatsby, Docusaurus). Written in Ruby with libcurl bindings, it audits generated HTML build output before deployment, catching broken links, missing image metadata, OpenGraph protocol issues, and anti-patterns.

---

## 2. Multi-Dimensional Forensic Investigation Summary (D1 to D8)

### D1: Architecture & Structural Boundaries
- **Checks**:
  - `Images`: Validates presence of `src`/`srcset`, unoptimized screenshot filenames, protocol-relative URLs, and alt tag semantics.
  - `Links`: Internal file existence, external link validation via async curl multi, fragment hash resolution.
  - `OpenGraph`: Validates `og:url`, `og:image`, and required metadata fields.
  - `Scripts` & `Favicon`: Validates local asset paths and favicon declarations.

### D2: Screenshot Filename Anti-Pattern Detection
- Unprocessed desktop screenshots uploaded directly to CMS or markdown pages degrade image SEO:
  - Regex: `SCREEN_SHOT_REGEX = /Screen(?: |%20)Shot(?: |%20)\d+-\d+-\d+(?: |%20)at(?: |%20)\d+.\d+.\d+/`
  - Flags default filenames like `Screen Shot 2026-10-16 at 12.00.00.png`. Search engines prioritize descriptive, keyword-relevant filenames for image rankings.

### D3: Strict Protocol-Relative URL Prohibition
- Protocol-relative URLs (`//cdn.example.com/lib.js`) were once used for mixed HTTP/HTTPS compatibility. In modern web engineering, they introduce security ambiguities and crawler confusion. HTML-Proofer enforces explicit `https://` schemes across all images, scripts, and links.

### D4: Whitespace-Only Alt Tag Detection
- Naive alt checkers only verify `img.has_attribute("alt")`. HTML-Proofer checks whether the alt tag consists exclusively of whitespace (`alt="   "`), which passes simplistic checks while failing screen readers and search engines.

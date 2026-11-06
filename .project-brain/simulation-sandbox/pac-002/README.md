# The Sovereign Chronicle (PAC-002 Demonstrator)

> **A Journal of Systems, Engineering, Architecture, and Digital Sovereignty**  
> Built as an evidence-grounded demonstration of AI-Builder-Brain Cross-Category Construction Capability (PAC-002).

---

## 🏛️ Executive Summary

PAC-001 demonstrated a browser-based utility tool (SVG-to-WebP Converter).  
**PAC-002** demonstrates a completely different product category: an **Editorial Content Publishing Website**.

The purpose of this project is to test whether AI-Builder-Brain's construction intelligence can support the full product construction lifecycle beyond single-purpose conversion utilities.

---

## ✨ Product Capabilities

- **Zero-Client-JS Default Performance**: Pre-rendered semantic HTML and CSS without heavy framework runtimes.
- **5 Original In-Depth Technical Articles**: Spanning Architecture, Systems Engineering, Data Sovereignty, and Web Craft.
- **In-Memory Sub-5ms Search**: Client-side inverted index searching titles, excerpts, content, authors, and tags.
- **Category Taxonomy & Navigation**: Filter by Architecture, Systems Engineering, Data Sovereignty, and Web Craft.
- **Long-Form Reading Experience**: Typographic rhythm tuned for sustained cognitive comfort (65-75 character measure).
- **Tri-Theme Reading Modes**: Seamless toggle between **Dark Obsidian**, **Light Daylight**, and **Warm Parchment Sepia**.
- **Scroll Reading Progress**: Visual progress bar indicating percentage completion through long-form monographs.
- **Author Profiles & Related Articles**: Full author attribution with bios, credentials, and cross-referenced recommendations.
- **Technical SEO & Syndication**:
  - Schema.org `TechArticle`, `BreadcrumbList`, and `WebSite` JSON-LD structured data.
  - OpenGraph & Twitter Cards.
  - XML Sitemap (`sitemap.xml`) and Crawler Instructions (`robots.txt`).
  - JSON Feed 1.1 (`feed.json`) for modern feed readers.
- **Privacy & Security**: 100% verified **zero outbound network transmissions** during reading and search.

---

## 🌐 The 13 Co-Equal Intelligence Domains Applied

| Domain | Contribution to "The Sovereign Chronicle" |
|---|---|
| **A. Human & Need** | Identified target persona (systems architects, technical readers) and pain points (ad bloat, tracking, fatigue). |
| **B. Product** | Defined MVP Scope (search, categories, themes, progress) and strict Negative Scope (no ads, no paywalls). |
| **C. Market & Business** | Formulated open syndication model and zero-compute client distribution. |
| **D. Research & Knowledge** | Recalled Eleventy zero-JS pattern and SEO canonical hierarchy from Brain data substrate. |
| **E. Creative** | Created "The Sovereign Chronicle" editorial identity, timeless typographic tone, and author personas. |
| **F. Design** | Implemented Tailwind v4 CSS-First design token architecture with Dark, Light, and Sepia color spaces. |
| **G. Architecture** | Decoupled content store, in-memory inverted index, client-side router, and pre-rendered static HTML. |
| **H. Technical Construction** | Built semantic HTML5, modular vanilla ES modules, and zero-runtime dependency structure. |
| **I. Content & Information** | Created 5 original technical articles with reading time formulas and taxonomy tags. |
| **J. Search & Distribution** | Implemented Schema.org JSON-LD, Breadcrumbs, XML Sitemap, Robots.txt, and JSON Feed 1.1. |
| **K. Quality & Verification** | Wrote and executed 117 unit tests + 25 Google Chrome headless CDP E2E tests (100% passing). |
| **L. Deployment & Operations** | Built static packaging pipeline (`scripts/build.js`) and local static server (`scripts/serve.js`). |
| **M. Feedback & Evolution** | Implemented reader feedback/voting widget and client-side unhandled exception boundaries. |

---

## 🚀 Quickstart & Local Verification

### 1. Build Static Distribution Package
\`\`\`bash
node scripts/build.js
\`\`\`
Output will be packaged into \`dist/\`, including all pre-rendered HTML articles.

### 2. Run Automated Unit Test Suite
\`\`\`bash
node test/run-tests.mjs
\`\`\`
Runs 117 automated assertions across content, search, SEO, and accessibility.

### 3. Run Real Google Chrome E2E Test Suite
\`\`\`bash
node test/browser-e2e.mjs
\`\`\`
Launches headless Chrome via CDP and tests the complete 14-step user workflow.

### 4. Start Local Static Server
\`\`\`bash
node scripts/serve.js
\`\`\`
Opens application at \`http://127.0.0.1:8098\`.

---

## 📦 Production Deployment Instructions

The \`dist/\` folder contains 100% static assets (HTML, CSS, JS, JSON, XML). It can be deployed to any static host:

- **GitHub Pages**: Set build directory to \`dist/\` or push \`dist/\` to \`gh-pages\` branch.
- **Cloudflare Pages / Netlify / Vercel**: Set build command to \`node scripts/build.js\` and publish directory to \`dist\`.
- **Nginx / Apache / Caddy**: Copy contents of \`dist/\` to web root (\`/var/www/html\`).


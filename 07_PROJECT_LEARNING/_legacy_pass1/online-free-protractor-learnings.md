# Project Learning Record — Online Free Protractor

This document records the empirical project learnings, forensic bug investigations, and pattern extraction evidence derived from the **Online Free Protractor** project (`onlinefreeprotractor.com` — Astro.js, Vanilla Canvas/JS, 54 Locales, AdSense High-Traffic Utility).

---

## 1. Executive Summary & Project Profile

* **Project**: Online Free Protractor (`onlinefreeprotractor.com`)
* **Technology Stack**: Astro.js 5+ (Static Mode), Vanilla JavaScript & HTML5 Canvas 2D Engine, Tailwind CSS v4, Cloudflare Pages Edge, Google AdSense, 54 Locales (`/`, `/[lang]/`).
* **Scale**: 542 Programmatically Generated Pages, 1,243 Translation Keys per Language (67,122 localized string pairs total).
* **Total Confirmed REAL INCIDENTS Analyzed**: 10 Incidents (`INC-01` through `INC-10`).
* **Promoted Reusable Engineering Patterns**: Rules 9 through 14 in `05_KNOWLEDGE/engineering-patterns.md`.
* **Zero-Regression Invariant**: 100% preservation of canvas measurement math (sub-pixel trigonometry, floating-point angle calculations), calibration logic, AdSense ad slots, and responsive UI layout.

---

## 2. Promoted Learning Set Mapping

### Pattern 9: Strict Canonical Uniformity & Edge Redirect Synchronization
* **Source Incident**: `INC-01` (340+ GSC "Page with redirect" Warnings) & `INC-03` (Hreflang Canonical Divergence)
* **Source Location**: `astro.config.mjs`, `src/i18n/utils.ts`, `src/layouts/Layout.astro`, `public/_redirects`
* **Evidence**: Google Search Console Coverage Audit & Production HTML Crawler Inspection.
* **Promotion Decision**: Promoted as **Rule 9** in `05_KNOWLEDGE/engineering-patterns.md`.
* **Confidence**: 100% (High Confidence).

### Pattern 10: Value-Semantic i18n Verification vs Key-Existence Parity
* **Source Incident**: `INC-05` (53 Languages stuck in English despite 100% key parity pass)
* **Source Location**: `scripts/sync-all-translations.js`, `src/i18n/translations/*.ts`, `scripts/verify-i18n.js`
* **Evidence**: User Japanese screenshots showing untranslated Educational Handbook & Toolbar; `audit-untranslated.cjs` finding 253 untranslated keys per file while `verify-i18n.js` reported 100% pass.
* **Promotion Decision**: Promoted as **Rule 10** in `05_KNOWLEDGE/engineering-patterns.md`.
* **Confidence**: 100% (High Confidence).

### Pattern 11: Cross-Boundary SSR-to-Client DOM Text Preservation via Data Attributes
* **Source Incident**: `INC-07` (Client Engine Clobbering Localized SSR Readouts with English Text)
* **Source Location**: `src/scripts/protractor-engine.js`, `src/scripts/calibration-engine.js`, `src/components/ProtractorApp.astro`
* **Evidence**: Client-side re-render replacing localized Japanese labels (`Display`, `Area:`, `Hardware:`) with raw English template strings on hardware auto-detect.
* **Promotion Decision**: Promoted as **Rule 11** in `05_KNOWLEDGE/engineering-patterns.md`.
* **Confidence**: 100% (High Confidence).

### Pattern 12: Cross-Platform Line-Ending Invariant Parsing in DevOps & Build Tooling
* **Source Incident**: `INC-08` (Regex `$` and `.` silently dropping lines with CRLF `\r` on Windows)
* **Source Location**: `scripts/sync-all-translations.js`, Node scratch scripts.
* **Evidence**: Regex `/^\s*['"]([a-zA-Z0-9_.]+)['"]\s*:\s*(.*)$/` matching only 264 lines out of 1,243 because lines post-260 contained `\r\n`.
* **Promotion Decision**: Promoted as **Rule 12** in `05_KNOWLEDGE/engineering-patterns.md`.
* **Confidence**: 100% (High Confidence).

### Pattern 13: Non-Destructive In-Place Preservation of Complex Mathematics & Visual UI Integrity
* **Source Incident**: User constraint violation guard ("website me koi change nahi hona chahiye sabkuchh achhe se work kar raha sab kuchh protected h")
* **Source Location**: All UI refactorings across `ProtractorApp.astro`, `calibration-engine.js`, AdSense placements.
* **Evidence**: Zero modifications to coordinate transformations, homography math, or canvas render loops while overhauling SEO and i18n layers.
* **Promotion Decision**: Promoted as **Rule 13** in `05_KNOWLEDGE/engineering-patterns.md`.
* **Confidence**: 100% (High Confidence).

### Pattern 14: Automated Self-Healing Translation Pipelines for Programmatic Locales
* **Source Incident**: `INC-09` (Developer adding new text in `en.ts` resulting in perpetual untranslated English across 53 locales)
* **Source Location**: `scripts/sync-all-translations.js`, `package.json` (`npm run i18n:sync`)
* **Evidence**: Upgraded automated differential translator with persistent JSON caching (`translation-cache.json`) translating 67,000+ string combinations across 53 languages in under 2 minutes.
* **Promotion Decision**: Promoted as **Rule 14** in `05_KNOWLEDGE/engineering-patterns.md`.
* **Confidence**: 100% (High Confidence).

---

## 3. Comprehensive Incident Post-Mortem

### INC-01: Canonical URL & Trailing Slash Redirection Loop
* **Context**: Google Search Console reported 340+ "Page with redirect" errors on internal URLs like `/ruler`, `/camera-protractor`.
* **Expected**: Every internal link, sitemap entry, and canonical tag resolves cleanly with HTTP 200 without intermediate 301/302 redirects.
* **Actual**: Internal links emitted slash-less paths (`/ruler`), but Cloudflare Pages edge default enforces trailing slashes (`/ruler/`). Every crawler visit incurred a 301 redirect.
* **Root Cause**: Astro configuration lacked `trailingSlash: 'always'`, causing route generator to output slash-less URLs while canonical tags conflicted with edge redirects.
* **Remediation**:
  1. Configured `trailingSlash: 'always'` in `astro.config.mjs`.
  2. Updated `useTranslatedPath()` and canonical builders to strictly append trailing slashes.
  3. Added trailing-slash 301 normalization rules in `public/_redirects`.
* **Verification**: `dist/` audit confirmed 100% of internal links and canonical meta tags have trailing slashes. 340 redirect loop eliminated.

### INC-02: Cloudflare Origin HTTP 522 / Server Error (5xx) on Root
* **Context**: GSC reported "Server error (5xx)" on `http://www.onlinefreeprotractor.com/`.
* **Expected**: All requests on HTTP, HTTPS, apex, and WWW resolve with HTTP 200 or clean single 301.
* **Actual**: Port 80 plain HTTP on WWW timed out at origin returning Cloudflare Error 522.
* **Root Cause**: Apex domain was configured, but port 80 HTTP was not enforced to upgrade to HTTPS at the Cloudflare Edge before reaching the serverless origin.
* **Remediation**:
  1. Added canonical WWW-to-apex 301 redirects in `public/_redirects`.
  2. Documented Cloudflare Edge requirement: enable "Always Use HTTPS" and "Automatic HTTPS Rewrites" under SSL/TLS.
  3. Added custom `500.astro` with `noindex` headers to prevent server fault indexing.

### INC-03: Missing Trailing Slashes on Hreflang Alternates
* **Context**: 54 language alternate tags (`<link rel="alternate" hreflang="..." href="...">`) on all pages.
* **Expected**: Hreflang alternate URLs match the canonical URL of the target page byte-for-byte.
* **Actual**: Hreflang links output `https://onlinefreeprotractor.com/ja/ruler` while canonical tag on `/ja/ruler/` was `https://onlinefreeprotractor.com/ja/ruler/`.
* **Root Cause**: Hreflang generator loop in `src/i18n/utils.ts` concatenated route without normalizing trailing slash.
* **Remediation**: Normalized `getHreflangLinks()` to strictly format all alternate URLs with trailing slashes.

### INC-04: Error Page Indexation & Missing Noindex
* **Context**: `404.astro` and `500.astro` pages generated in build.
* **Expected**: Error and fallback routes must never be indexed or appear in search results.
* **Actual**: Error pages inherited default layout which included canonical tags and lacked `<meta name="robots" content="noindex, nofollow" />`.
* **Remediation**: Added `noindex?: boolean` prop to `Layout.astro` that emits `<meta name="robots" content="noindex, nofollow" />` and suppresses canonical and hreflang tags on error pages.

### INC-05: False-Positive i18n Key Parity Masking Untranslated English
* **Context**: User opened website in Japanese (`/ja/`) and observed that Educational Handbook, Calibration Studio, and Toolbar remained entirely in English.
* **Expected**: When a translation verification test passes, the user sees native localized text in all target languages.
* **Actual**: `scripts/verify-i18n.js` reported "✅ Parity check passed! All 53 languages have 100% parity with en.ts (1243 keys)", yet 250+ keys in `ja.ts`, `fr.ts`, `de.ts`, `zh.ts` were raw English.
* **Root Cause**: The developer created `sync-all-translations.js` with a fallback mechanism that blindly copied `NEW_KEYS_EN` into all language files when a localized key was missing. The parity script only checked `keys.has(k)` (key existence), never checking if the value was identical to English.
* **Remediation**:
  1. Built value-semantic audit script (`audit-untranslated.cjs`) detecting key-value equality with English.
  2. Curated native Japanese translations for all educational and UI components.
  3. Replaced fallback copy mechanism with automated Google Translate batch engine.

### INC-06: Brittle Split JSX/Astro Template Tags Breaking Translation Resolvers
* **Context**: Image protractor toolbar displayed `🎯 中央に配置 Protractor` (half Japanese, half English).
* **Expected**: Button renders cleanly in native language (e.g. `🎯 分度器を中央に配置`).
* **Actual**: English word `Protractor` remained appended.
* **Root Cause**: Developer wrote `<span>🎯 {t('controls.center')}<span class="hidden sm:inline"> {t('ruler.protractor', 'Protractor')}</span></span>`. `ruler.protractor` did not exist in any dictionary, so it fell back to `'Protractor'`. Meanwhile `controls.centerProtractor` already existed with full translations across all 54 languages.
* **Remediation**: Replaced split spans with single atomic call `{t('controls.centerProtractor', 'Center Protractor')}`.

### INC-07: Client-Side Engine Overwriting SSR Localized DOM
* **Context**: Auto-Detect Calibration modal in `/ja/` initially rendered in Japanese, but after 100ms displayed English labels `Display`, `Area:`, `Hardware:`, `Phys:`.
* **Expected**: Dynamic hardware detection values update numbers without reverting label text to English.
* **Actual**: `protractor-engine.js` set `elDiag.textContent = `${diag}" Display`` and `badge.textContent = '✓ 100% Multi-Factor Hardware Match'`.
* **Root Cause**: Vanilla JavaScript engine lacked internationalization context and used hardcoded English template strings.
* **Remediation**: Added `data-label` attributes to Astro template nodes (populated via SSR translations). Client JS reads `el.getAttribute('data-label')` before interpolating dynamic numbers.

### INC-08: Windows CRLF Regex Failure Causing Silent Script Truncation
* **Context**: Node script reading translation files on Windows only processed 264 keys out of 1,243.
* **Expected**: Script parses all 1,243 lines.
* **Actual**: Script silently skipped 979 lines.
* **Root Cause**: The file contained Windows CRLF (`\r\n`) line endings. Regex `$` anchor failed because `.` in JavaScript does not match `\r`.
* **Remediation**: Standardized parsing on `content.split(/\r?\n/)` and trimmed strings before regex evaluation.

### INC-09: Unbounded Sequential Web Translation vs Concurrent Pooled Translation
* **Context**: Translating 380 keys across 53 languages (20,000+ translations).
* **Expected**: Translation sync completes in under 2 minutes.
* **Actual**: Sequential HTTP requests took 20-30 seconds per language (~16 minutes total), risking timeouts.
* **Root Cause**: Sequential `for...of` loop awaiting each HTTP fetch one-by-one.
* **Remediation**: Implemented concurrent batch chunking (`Promise.all` with concurrency limit of 5 and newline-delimited query packing). Translation time dropped from 16 minutes to 95 seconds.

### INC-10: AdSense "Low-Value Content" Triggers vs Programmatic Mathematical Masterclass Architecture
* **Context**: Single-page tool websites (online protractor, calculators, unit converters) are frequently rejected by Google AdSense for "Low-Value Content / Thin Utility".
* **Expected**: Website qualifies for fast AdSense approval, high CPC, and high RPM.
* **Actual**: Tools without authoritative educational text trigger AdSense policy rejections.
* **Root Cause**: AdSense crawler evaluates text-to-code ratio and semantic EEAT depth. Pure canvas tools appear as empty pages to text crawlers.
* **Remediation**: Architected the **Educational Masterclass Handbook Pattern**: comprehensive, authoritative technical content sections covering structural carpentry trigonometry, solar panel tilt physics, ADA ramp slope civil engineering, CNC drill bit point angles, and screen display pixel physics, complete with schema markup and editorial integrity disclosures.

### INC-11: Missing Root `<title>` and `<meta name="description">` in Component Layout
* **Context**: Organic search traffic dropped suddenly from 30/day to 3-5/day. Bing Webmaster Tools URL inspection flagged fatal errors: "Title tag missing (1 instance found)" and "Meta Description tag missing (1 instance found)".
* **Expected**: Every HTML page must emit standard `<title>` and `<meta name="description">` elements inside `<head>`.
* **Actual**: `Layout.astro` only emitted OpenGraph tags (`<meta property="og:title">` and `<meta property="og:description">`). Standard HTML `<title>` and `<meta name="description">` tags were missing from `<head>` entirely.
* **Root Cause**: Developer assumed OpenGraph tags fulfilled search engine requirements. While social platforms parse `og:` tags, search engines (Google, Bing) strictly require standard `<title>` and `<meta name="description">` tags for indexing and SERP snippet generation.
* **Remediation**: Added standard `<title>{title}</title>`, `<meta name="description" content={metaDescription} />`, and `<meta name="keywords" content={keywords} />` to `Layout.astro`.
* **Verification**: Production build audit (`scripts/audit-bing.cjs`) confirmed 100% of pages (`/`, `/ruler/`, `/image-protractor/`, etc.) have exactly 1 Title tag and 1 Description tag inside `<head>`.

### INC-12: Duplicate `<h1>` Heading Tag in Hidden Export/Print Template
* **Context**: Bing Webmaster Tools reported "More than one h1 tag (2 instances found)".
* **Expected**: Clean document outline with strictly ONE `<h1>` tag per page for unambiguous topic modeling.
* **Actual**: Two `<h1>` tags were detected on every tool page: the visible hero heading (`<h1>Online Protractor Tool</h1>`) and an offscreen printable report header (`<h1 id="print-report-title">Precision Measurement Report</h1>`).
* **Root Cause**: Reusable printable report header in `ProtractorApp.astro` used `<h1>` despite being hidden (`display: none`) until print/export. Search engine crawlers parse the full DOM tree and treat all `<h1>` tags as primary document titles regardless of CSS visibility.
* **Remediation**: Changed `<h1 id="print-report-title">` to `<div id="print-report-title" role="heading" aria-level="2">`, preserving 100% of print layout CSS while restricting top-level `<h1>` to the semantic page title.
* **Verification**: Multi-page audit verified `H1s=1` across all routes.

### INC-13: Massive Static HTML Bloat (796 KB down to 453 KB) from Repetitive Preset Serialization
* **Context**: Googlebot smartphone timed out on secondary asset fetching ("Page resources: 27/38 couldn't be loaded"), with font files and scripts dropping due to excessive DOM parse times.
* **Expected**: Static HTML documents for single-page utility tools should remain lightweight (< 100-150 KB).
* **Actual**: Each static HTML page weighed 796 KB (0.8 MB). Across 542 multilingual pages, the build artifact totaled over 430 MB.
* **Root Cause**: `ProtractorApp.astro` statically rendered 695 `<option>` tags inside a hidden select container (`select-ruler-device-preset` with `style="display: none !important;"`) plus hundreds more options in `select-fs-ruler-device`. This injected ~343 KB of repetitive serialized markup into every single page across all 54 locales.
* **Remediation**: Replaced static server-side option mapping with dynamic client-side hydration in `protractor-engine.js` using the already loaded in-memory `DEVICE_PRESETS` array.
* **Verification**: HTML payload dropped from 796 KB to 453 KB (343,134 bytes saved per page, eliminating 186 MB of dead weight across 542 pages). 100% of device presets and calibration features preserved with 0 regressions.

### INC-14: Tool Switcher Visual Disconnect on Direct Navigation
* **Context**: Users clicking tool buttons in the top goal bar ("Angle on Screen", "Screen Ruler", etc.) landed at scroll position 0, seeing only the header, ad banner, and hero descriptions. The actual tool was pushed below the fold.
* **Expected**: Clicking a tool button must immediately display the interactive tool front-and-center on screen.
* **Actual**: Links navigated to `/ruler/` without hash anchors, requiring manual scrolling past large hero banners.
* **Remediation**: Updated all switcher links in `TopToolSwitcher.astro` to append `#tool-section` (`${targetPath}#tool-section`) and added smooth scroll interception + `scroll-mt-4 sm:scroll-mt-8` clearance on `#tool-section`.
* **Verification**: Verified seamless instant scrolling directly to the tool container across desktop and mobile.

### INC-15: Dual XML Sitemap Discovery Discrepancy in Robots.txt
* **Context**: Google Search Console URL inspection indicated "Sitemaps: No referring sitemaps detected".
* **Expected**: Search engine bots discover and associate the master sitemap immediately via `robots.txt`.
* **Actual**: `robots.txt` declared only `sitemap-index.xml`, while some legacy crawlers query `sitemap.xml`.
* **Remediation**: Explicitly listed both `Sitemap: https://onlinefreeprotractor.com/sitemap-index.xml` and `Sitemap: https://onlinefreeprotractor.com/sitemap.xml` in `public/robots.txt`.

### INC-16: Nested Sitemap Index Protocol Rejection
* **Context**: In Google Search Console, `sitemap.xml` was flagged as failing or not recognizing referring sitemaps.
* **Expected**: Sitemaps conform strictly to Sitemaps.org XML schema.
* **Actual**: `public/sitemap.xml` defined a `<sitemapindex>` pointing to `sitemap-index.xml`, which in turn was another `<sitemapindex>` pointing to `sitemap-0.xml`. The official Sitemaps.org protocol prohibits nested sitemap indexes; a sitemap index can only reference XML sitemaps, not another sitemap index.
* **Remediation**: Updated `public/sitemap.xml` to point directly to `https://onlinefreeprotractor.com/sitemap-0.xml`.
* **Verification**: Verified with automated parser that both `sitemap.xml` and `sitemap-index.xml` cleanly resolve to `sitemap-0.xml`, containing exactly all 540 indexable canonical URLs.

### INC-17: Cloudflare Edge Redirect Masking Physical XML Sitemap Resulting in GSC Sitemap Disconnect
* **Context**: Google Search Console URL Inspection consistently displayed "Discovery > Sitemaps: No referring sitemaps detected" despite valid sitemap files existing in `public/` and `dist/`.
* **Expected**: Request to `https://onlinefreeprotractor.com/sitemap.xml` returns `HTTP 200 OK` with `Content-Type: application/xml`.
* **Actual**: Request returned `HTTP 301 Moved Permanently` to `/sitemap-index.xml`. Google Search Console flagged the redirect and failed to attribute child URLs to the submitted `sitemap.xml`.
* **Root Cause**: `public/_redirects` contained an obsolete rule `/sitemap.xml /sitemap-index.xml 301`. Cloudflare Pages edge rules execute before static asset serving, masking the physical `sitemap.xml` document.
* **Remediation**: Surgically deleted `/sitemap.xml /sitemap-index.xml 301` from `public/_redirects`. Re-built and deployed to Cloudflare Pages (`online-protractor`).
* **Verification**: Live curl confirmed `https://onlinefreeprotractor.com/sitemap.xml` returns direct `HTTP 200 OK` with `Content-Type: application/xml` and zero redirects. Full canonical and trailing-slash parity across all 540 indexable routes confirmed.

---


## 4. Agent Evaluation & Self-Correction Meta-Rules

When AI agents work on complex multilingual, static-site, or SEO-driven projects, they must adhere to three non-negotiable principles:

1. **Verify the Built Artifact, Not Just Source Code**:
   Never declare a task complete because `astro check` passed or code looks correct. Run `astro build` and inspect `dist/` HTML output to verify rendered strings, canonical tags, and markup.

2. **Differentiate Key Parity from Semantic Translation**:
   A dictionary key that exists but has an English value is NOT translated. Parity checks must evaluate value equality against the base locale.

3. **Protect Mathematics & Functional Domain Invariants**:
   When fixing SEO, styling, or i18n, never touch coordinate transformations, angle offsets, unit scalers, or canvas event listeners unless explicitly requested.

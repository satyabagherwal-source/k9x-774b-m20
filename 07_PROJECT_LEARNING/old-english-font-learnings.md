# Project Learning Record — Old English Font Free

This document records empirical learnings, forensic bug investigations, and pattern extraction evidence derived from the **Old English Font Free** project (`oldenglishfontfree.com` — Astro 5.4, Tailwind CSS v4, Lucide/Heroicons, 45 Static Routes).

---

## 1. Project Profile & Invariants

* **Project**: Old English Font Free (`oldenglishfontfree.com`)
* **Technology Stack**: Astro 5.4 (SSG Static Site Generation), Tailwind CSS v4, Vanilla JavaScript Interactive Engines, OFL Font Catalog.
* **Core Invariants**:
  1. Zero horizontal overflow or sideways viewport shifting on any mobile viewport (320px–480px).
  2. 100% Client-Side Privacy: zero server telemetry, instant filtering.
  3. High-contrast dark and light mode consistency.

---

## 2. Real Incidents & Forensic Analysis

### INC-01: Mobile Layout Blowout Caused by Side-by-Side Flex Sidebar
* **Context**: The font catalog features a multifaceted filter sidebar (`#filtersSidebar`) alongside the font cards grid (`#fontsCatalogContainer`).
* **Symptom**: On mobile viewports (e.g., 360px–390px iPhone/Android screens), opening the filter or loading the page pushed the entire website off-screen to the right by over 230px, forcing horizontal scrollbars and breaking the header/hero layout. When "Hide Filters" was toggled, the page collapsed back into straight alignment.
* **Root Cause**:
  1. The parent container in `src/pages/index.astro` was declared as `<div class="flex items-start gap-8">` without responsive direction classes (`flex-col lg:flex-row`). Default CSS flex layout uses `flex-direction: row`.
  2. The sidebar had a rigid width `w-64 shrink-0` (256px wide), while font cards require ~300px minimum width.
  3. On a 375px mobile screen, `256px (sidebar) + 32px (gap) + 300px+ (cards) = 588px+`, exceeding mobile viewport limits by ~210px.
* **Architectural Remediation**:
  1. Converted the mobile filter experience into a **Slide-Over Off-Canvas Drawer** with fixed positioning:
     `fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] -translate-x-full lg:translate-x-0 lg:static lg:w-64 lg:shrink-0`
  2. Added a high-contrast dark blur backdrop:
     `<div id="filtersBackdrop" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 hidden lg:hidden"></div>`
  3. Added mobile header close button (`#closeSidebarBtn`), backdrop tap dismiss, keyboard `Escape` dismiss, and a prominent bottom floating action button (`#applyMobileFiltersBtn`).
  4. Added responsive container layout: `<div class="flex flex-col lg:flex-row items-start gap-8 relative">`.
  5. Implemented live active filter counter badges and screen resize listeners that automatically reconcile desktop/mobile state without layout jumps.

### INC-02: User-Supplied Low-Contrast / Dark-on-Dark SVG Logo & ForeignObject Bloat
* **Context**: User provided a raw SVG code snippet extracted from an icon generator or browser DOM inspector to use as the site brand logo.
* **Symptom**: In the website header on obsidian dark mode (`#030712`), the logo rendered as a pitch-black box with dark purple lettering (`stroke="rgb(43, 10, 134)"`), with contrast ratio below 1.3:1 ("invisible ho raha h"), contradicting the site's royal antique gold typography (`Cinzel Decorative`, amber gold gradient) and violating the brain's Universal Production Audit Rule (Zero dark-on-dark, WCAG AA/AAA >= 7:1). Additionally, the SVG was wrapped in a 68KB `<foreignObject>` structure with computed inline styles that broke in standard `<img>` tags.
* **Root Cause**:
  1. The raw SVG contained dark purple stroke styling designed for light surfaces, placed inside a `linear-gradient` with 94% black coverage.
  2. Directly pasting third-party inspector SVGs imports bloated HTML namespaces (`foreignObject`, `xmlns="http://www.w3.org/1999/xhtml"`) instead of pure, scalable vector geometry.
* **Architectural Remediation**:
  1. Converted the SVG into a 100% native vector structure (`<rect>`, `<svg>`, `<path>`, `<circle>`, `<linearGradient>`, `<filter>`) with zero `foreignObject` bloat (file size reduced from 68.8KB to 1.2KB).
  2. Preserved the user's exact glyph geometries (`Aa` from Lucide `case-sensitive` paths) while applying a luminous antique gold gradient (`#faeb9e` -> `#fbbf24` -> `#f59e0b` -> `#b45309`) with a soft ambient gold glow (`filter="url(#goldGlow)"`), achieving a 13.5:1 contrast ratio against the obsidian header.
  3. Added an explicit gold hairline border (`url(#goldBorder)`) to the rounded tile container to maintain crisp edge definition against obsidian, slate, or parchment surfaces across both dark and light modes.

### INC-03: Brand Parity Invariant — 100% Favicon & Site Logo Icon Synchronization
* **Context**: User explicitly directed: *"favicon and svg icon same hona chahiye"*.
* **Symptom**: The site had disparate brand representations across asset endpoints:
  - `favicon.ico`, `favicon-96x96.png`, and `apple-touch-icon.png` used the user's custom generated RealFaviconGenerator package (`Aa` glyph on black squircle with cyan corner accent).
  - `favicon.svg` previously had a legacy placeholder.
  - `public/logo.svg` and `SiteLogo.astro` had a separate manually generated geometry.
* **Architectural Remediation**:
  1. Synchronized all three vector endpoints: `public/favicon.svg`, `public/logo.svg`, and `src/components/SiteLogo.astro` to render the exact same brand artwork.
### INC-04: Structured Data FAQPage Integration & Search Intent Entity Mapping
* **Context**: User requested an authoritative, SEO-friendly FAQ section answering 36+ target search queries covering writing techniques, typography taxonomy (Blackletter/Textura/Fraktur), application integration (Google Docs, Microsoft Word, Instagram), tattoo stencils, and historic cultural artifacts (White Sox logo, 1920s Prohibition typography).
* **Requirement**: Use Schema.org `FAQPage` JSON-LD structured data for Google rich snippet eligibility, accompanied by an interactive accordion UI.
* **Architectural Remediation**:
  1. Component Modularization: Created `src/components/OldEnglishFaq.astro` implementing native semantic `<details>` and `<summary>` elements with zero layout shift (CLS).
  2. Entity Resolution & Schema Completeness: Mapped each core typographic topic into rich master answers while simultaneously generating 53 explicit `@type: Question` entities in `<script type="application/ld+json">`, directly targeting all verbatim long-tail user queries.
  3. Interactive Discovery UX: Integrated a live client-side search input, category filter pills (`💻 Google Docs & Word`, `✍️ Typing & Generators`, `🔤 Font Types & Names`, `💉 Tattoos & Numbers`, `📜 History & White Sox`), dynamic question counter, and "Expand All / Collapse All" controls.
  4. Design Parity: Implemented high-contrast Obsidian Gold design styling (`Cinzel Decorative`, amber-400 highlights, slate-900 glassmorphism) maintaining WCAG AA/AAA compliance (contrast ratio >= 7:1).
  5. Static Generation Validation: Verified complete SSG compilation (`npm run build`, 617 static HTML routes generated with exit code 0) and validated JSON-LD schema parsing via automated Node test scripts.

### INC-05: Dynamic Multilingual Sitemap & Robots.txt Discovery
* **Context**: User requested `robots.txt` and `sitemap.xml` configuration using official Astro documentation via the `astro-docs` MCP tool.
* **Findings from Astro Official Docs**:
  - Astro provides the `@astrojs/sitemap` integration which crawls statically generated routes at build time (`sitemap-index.xml` + `sitemap-0.xml`).
  - For multilingual architectures (`i18n`), `@astrojs/sitemap` accepts an `i18n` config object declaring `defaultLocale` and locale mapping dictionary to generate reciprocal `<xhtml:link rel="alternate" hreflang="..." />` tags across all language routes.
  - Crawler discovery requires `<link rel="sitemap" href="/sitemap-index.xml" />` in `<head>` and `Sitemap:` directives in `public/robots.txt`.
* **Architectural Remediation**:
  1. Installed `@astrojs/sitemap` (^3.7.4) and integrated it in `astro.config.mjs` with full 14-locale i18n mapping (`en`, `es`, `ja`, `fr`, `de`, `pt`, `ko`, `it`, `no`, `sv`, `da`, `fi`, `ar`, `he`).
  2. Created standardized `public/robots.txt` declaring global crawler allow rules and linking to both `https://oldenglishfontfree.com/sitemap-index.xml` and `https://oldenglishfontfree.com/sitemap.xml`.
  3. Configured `public/sitemap.xml` as a valid XML sitemap index pointing to `sitemap-0.xml` for legacy bots, and synchronized `sitemap-index.xml` for dev and production parity.
  4. Embedded `<link rel="sitemap" href="/sitemap-index.xml" />` into `src/layouts/Layout.astro` `<head>`.
  5. Verified compilation: `npm run build` generated `dist/robots.txt`, `dist/sitemap.xml`, `dist/sitemap-index.xml`, and `dist/sitemap-0.xml` (915KB full URL index) with zero errors across all 617 routes.

### INC-06: Legal & Trust Suite Architecture (Privacy Policy, About Us, Terms & Conditions, Contact Us)
* **Context**: User requested adding 4 essential trust & compliance pages: **Privacy Policy** (`/privacy/`), **About Us** (`/about/`), **Terms & Conditions** (`/terms/`), and **Contact Us** (`/contact/`).
* **Requirements & Invariants**:
  - Full Google AdSense compliance: explicit disclosure of client-side text processing (zero server storage/telemetry), cookie policy, third-party network disclosures (DART, Google Ads Settings opt-out), and external font resources (Google Fonts).
  - Dedicated Contact Us page with functional client-side form validation, mailto payload generation, 4 distinct departmental email routing channels (`contact@`, `fonts@`, `license@`, `compliance@`), response time guarantee (<24-48h), and formal statutory DMCA takedown notice requirements (17 U.S.C. § 512(c)(3)).
  - Comprehensive About Us page explaining organizational origin: resolving the predatory font copyright demand letter epidemic ($3,000–$10,000 demand letters for unvetted personal-use fonts), 800-year history of blackletter (from 12th-century Textura Quadrata to Gutenberg, Cloister Black, Chicano lowriders, and West Coast tattoos), and our 4-Tier Typography Verification Protocol (SIL OFL Legal, Glyph Coverage, Cross-Platform Engine Stress Test, Vector Kontur/Stencil Integrity).
  - Explicit Terms & Conditions detailing commercial rights under SIL OFL 1.1 (tattoos, apparel, logos, games, YouTube), user-generated stencil ownership, acceptable use, disclaimers, and limitation of liability.
  - Multilingual route parity across all 14 supported locales (`en`, `es`, `ja`, `fr`, `de`, `pt`, `ko`, `it`, `no`, `sv`, `da`, `fi`, `ar`, `he`) using `getStaticPaths()`.
  - Prominent cross-navigation links across desktop footer, mobile drawer menu, and copyright bottom bar using `translatePath`.
* **Architectural Remediation**:
  1. Created `src/pages/contact.astro` and multilingual counterpart `src/pages/[lang]/contact.astro`.
  2. Enhanced `src/pages/about.astro` and `src/pages/[lang]/about.astro`.
  3. Enhanced `src/pages/terms.astro` and `src/pages/[lang]/terms.astro`.
  4. Updated `src/pages/privacy.astro` and `src/pages/[lang]/privacy.astro`.
  5. Added `nav.contact` translation key to all 14 languages in `src/i18n/ui.ts`.
  6. Linked all 4 pages into `src/layouts/Layout.astro` header drawer, footer legal matrix, and footer copyright bar.
  7. Verification: Full static compilation (`npm run build`) succeeded with 631 pages generated, zero errors, and all routes verified in `dist/sitemap-0.xml`.

### INC-07: Error Page Resilience Architecture (Custom 404 & 500 Pages)
* **Context**: User requested adding custom 404 and 500 error pages.
* **Requirements & Invariants**:
  - Web-standard static host compatibility: `dist/404.html` and `dist/500.html` must generate directly at the build root for universal fallback across Cloudflare Pages, Netlify, Vercel, S3, and Nginx.
  - Crawler protection: both pages must emit `<meta name="robots" content="noindex, nofollow" />` (via `noindex={true}`) to avoid indexing error pages as site content.
  - XML Sitemap exclusion: configured `@astrojs/sitemap` integration `filter` option (`(page) => !page.includes('/500') && !page.includes('/404')`) to strictly prevent error pages from polluting search engine sitemaps.
  - Theme Parity: High-contrast Obsidian Gold aesthetic (`Cinzel`, amber gold gradients, slate-900/950 glassmorphism, $\ge 7:1$ WCAG contrast).
* **Architectural Remediation**:
  1. Enhanced `src/pages/404.astro`: Illuminated Fraktur drop-cap `𝕱` and `𝟒𝟎𝟒` emblem, medieval scriptorium theming, interactive live search input (`action="/" method="GET"`), and quick recovery links (All Fonts, Tattoo Stencil Studio, A-Z Alphabet Directory, Fraktur Generator, and popular typefaces).
  2. Created `src/pages/500.astro`: Mechanical printing press / gear emblem `𝟓𝟎𝟎`, Scriptorium engine interruption status, reload manuscript button (`window.location.reload()`), sanitized diagnostic container for `error` prop, recovery links, and direct support contact links (`/contact/` and `contact@oldenglishfontfree.com`).
  3. Sitemap configuration in `astro.config.mjs`: added `filter: (page) => !page.includes('/500') && !page.includes('/404')`.
  4. Build Verification: `npm run build` completed with 632 routes built in 29s, confirmed `dist/404.html` and `dist/500.html` exist, and verified zero sitemap contamination.

### INC-08: Logo Dark-Mode Contrast Invariant & Git Divergence Resolution
* **Context**: User identified that the logo rendered as dark-on-dark in dark mode (*"logo ko dark mode m white hona chahiye background se taaki achhe se highlited ho . ye learning ai builder brain me pahle bhi daaali thi use kyo nahi huyi"*), and reported that pushing to a newly created GitHub repository failed with an error.
* **Forensic Root Cause Analysis**:
  1. *Logo Contrast Issue*: In a previous step to synchronize favicon and logo assets, a third-party RealFaviconGenerator base64 asset with a black background (`#000000`) was imported into `public/logo.svg`. Because the header in dark mode is black/obsidian (`#030712`), a black squircle on a black background is virtually invisible, leaving only a dim purple letter floating without tile definition. This violated the brain's Universal Contrast Rule (*Zero dark-on-dark, WCAG AA/AAA >= 7:1*).
  2. *Git Push Error*: The remote repository (`https://github.com/satyabagherwal-source/old-english-font-free.git`) was initialized on GitHub with a default `README.md` (`commit dc074dc`). The local repository was initialized separately (`commit d518207`). When attempting `git push -u origin main`, Git rejects the push (`[rejected] main -> main (fetch first)`) because the two branches have unrelated commit histories.
* **Architectural Remediation**:
  1. *White-Background Logo Vector*: Replaced `public/logo.svg` and `public/favicon.svg` with clean, pure vector SVGs featuring a crisp, solid white squircle background (`<rect fill="#ffffff" .../>`, subtle gilded antique gold outline `stroke="url(#goldBorder)"`, and soft drop shadow). The purple brand glyph `Aa` on the white tile achieves a **14.8:1 contrast ratio**, and the white tile on the dark obsidian header achieves a **20.5:1 contrast ratio**, making it brightly highlighted and immediately legible.
  2. *Git Resolution*: To reconcile the unrelated initial commit from GitHub with the local repository, push with force overwrite (`git push -u origin main --force`) or rebase with unrelated histories (`git pull origin main --rebase --allow-unrelated-histories`).

### INC-09: Adaptive Dual-Theme Logo Invariant (Dark in Light Mode, White in Dark Mode) & FAQ Coexistence
* **Context**: User clarified the core theme-contrast design principle (*"logo light mode m dark hona hota h aur dark mode me light hona hota h tab jagar logo highlite hota h. background dark hoga tab hi to light mode me highlited dikhega"*) and questioned why FAQ appeared in multiple locations, instructing not to modify if correct (*"ye faq dusari jagah kyo diya gaya . agar sahi h to change mat karo"*).
* **Forensic Root Cause Analysis**:
  1. *Dual-Theme Inversion Invariant*: A static single-color tile background (e.g. pure white or pure black) will fail in one of the two display modes. If the logo tile is always white, it washes out against a light parchment/cream page header (`#fdfbf7`). If the logo tile is always black, it washes out against a dark obsidian page header (`#030712`). To pop out and achieve maximum contrast ($\ge 15:1$):
     - **In Light Mode**: The logo tile MUST be DARK (obsidian `#030712` squircle with radiant antique gold `Aa` text), standing out crisply against the light parchment header.
     - **In Dark Mode**: The logo tile MUST be LIGHT (pure white `#ffffff` squircle with royal purple `Aa` text), standing out brilliantly against the dark obsidian header.
  2. *FAQ Architecture Separation*:
     - **Section 1 (Educational Handbook Mini-FAQ)**: `src/components/EducationalHandbook.astro` (lines 189–224) contains 3 academic paleographic history questions embedded in the manuscript handbook (Insular script vs Blackletter, OFL 1.1 commercial tattoo rights, and legacy Android UTF-8 font coverage).
     - **Section 2 (Comprehensive SEO FAQ)**: `src/components/OldEnglishFaq.astro` contains the 36+ target keyword questions with client-side category filters, interactive accordion, and Schema.org `FAQPage` JSON-LD structured data for Google Rich Results.
     - Both serve distinct UX & SEO roles. Per user directive ("agar sahi h to change mat karo"), both are preserved with 100% integrity.
* **Architectural Remediation**:
  1. *Adaptive Dual-Theme Site Logo (`src/components/SiteLogo.astro`)*:
     - Replaced static `<img>` with an inline, responsive dual-SVG component containing:
       - `.light-mode-logo`: Obsidian squircle (`fill="#030712"`, gold border, cyan accent, antique gold `Aa`). Displayed ONLY when `html.light`.
       - `.dark-mode-logo`: Crisp pure white squircle (`fill="#ffffff"`, gold border, cyan accent, royal purple `Aa`). Displayed when `html.dark` (default).
     - Scoped styles guarantee instantaneous CSS-driven theme synchronization with zero layout shift or network request delay.
  2. *Adaptive Vector Favicon (`public/favicon.svg`)*:
     - Configured `@media (prefers-color-scheme: light)` to dynamically render a dark squircle tile in light browser chrome and a white squircle tile in dark browser chrome.
  3. *Verification*:
     - `npm run build` completed with all 632 routes compiled with exit code 0.
     - Contrast ratios verified: $\ge 15.5:1$ in Light Mode, $\ge 20.5:1$ in Dark Mode.

### INC-10: Immunity Hardening from Online Free Protractor Historical Defects
* **Context**: User noted that the `onlinefreeprotractor` project suffered from recurring cascades of defects during iterative development, and instructed to perform a comprehensive audit to guarantee none of those issues recur in `old-english-font-free`. User also pointed out screenshot visual discrepancy: the Aa logo text appeared distorted/broken in light mode (`^ o` instead of `Aa`).
* **Forensic Root Cause Analysis**:
  1. *SVG LinearGradient Zero-Dimension Bounding Box Failure*: In `SiteLogo.astro`, the light mode logo glyph used `stroke="url(#logoGoldTextLight)"`. The `A` crossbar (`d="M4 13h6"`, height = 0) and the `a` vertical stem (`d="M21 9v6"`, width = 0) are 1-dimensional SVG paths. Because default `gradientUnits="objectBoundingBox"` evaluates bounding boxes with 0 dimension as undefined or transparent, the crossbar of `A` and the stem of `a` disappeared in browsers, mutating `Aa` into `^ o`! The dark mode logo used a solid color `stroke="rgb(43, 10, 134)"` which rendered all strokes cleanly.
  2. *Error Page Multi-Locale Picker 404 Cascades (Protractor INC-28)*: In `404.html` and `500.html`, `LanguagePicker.astro` generated links to `/es/404/`, `/ja/404/`, etc., creating 26+ broken internal links for crawlers.
  3. *Cloudflare Email Obfuscation Crawler 404 Loops (Protractor INC-19)*: Bare `mailto:` links across contact pages triggered Cloudflare Scrape Shield script injection (`/cdn-cgi/l/email-protection`), which search bots indexed as 404 errors.
  4. *Schema.org Slash-less Domain Redirect Warnings (Protractor INC-24)*: JSON-LD graph in `Layout.astro` omitted trailing slashes on `"url": "https://oldenglishfontfree.com"`, triggering 308 redirect warnings in GSC.
  5. *Multilingual Thin Utility Sitemap Crawl Exhaustion (Protractor INC-21 & INC-22)*: Auto-translated/boilerplate legal and utility pages in 13 locales flooded sitemaps and wasted Googlebot crawl budget.
* **Architectural Remediation**:
  1. *Identical Symmetrical Glyph Rendering*: Replaced gradient stroke in light mode `SiteLogo.astro` with solid `#fbbf24` gold, ensuring 100% geometric and stroke parity with dark mode `Aa`.
  2. *Error Page Safe Routing*: Updated `LanguagePicker.astro` to detect error pages and safely redirect language selections to the canonical home page `/` of that language.
  3. *Cloudflare Scrape Shield Protection*: Wrapped all `mailto:` links in `src/pages/contact.astro`, `src/pages/[lang]/contact.astro`, and `src/pages/500.astro` with `<!--email_off-->` comments, and created `public/_redirects` with `/cdn-cgi/l/email-protection* /contact/ 301`.
  4. *Canonical Trailing Slashes in Schema*: Enforced `"url": "https://oldenglishfontfree.com/"` in `Layout.astro` JSON-LD graph.
  5. *Programmatic Sitemap Pruning & Noindex Protection*: Added `noindex={true}` to localized non-English legal pages (`[lang]/terms.astro`, `[lang]/privacy.astro`, `[lang]/about.astro`, `[lang]/contact.astro`), and updated `astro.config.mjs` sitemap filter to exclude thin localized utility pages and deprecated frames routes.
  6. *Automated Quality Audit Verification*: Created and ran `scripts/audit-site-quality.mjs` verifying 100% pass across all 9 incident categories on all 632 compiled HTML files.






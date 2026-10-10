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




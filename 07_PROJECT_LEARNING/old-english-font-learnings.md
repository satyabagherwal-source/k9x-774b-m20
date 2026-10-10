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


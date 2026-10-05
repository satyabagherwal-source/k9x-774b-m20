# Universal Website Final Production Audit & Auto-Correction Protocol (53 Phases)

## Purpose & Authority
This document enshrines the 53-Phase Universal Production Audit Protocol as the canonical verification standard for all software products, web applications, and digital platforms built within the AI-Builder-Brain ecosystem.

**Core Mandate:**
> "CODE LOOKS CORRECT" ≠ PASS. A feature is marked PASS only when:
> 1. Source code is correct.
> 2. Real browser opens the actual page without blank screens or 404/500 errors.
> 3. User interaction executes cleanly.
> 4. Expected output is produced.
> 5. Edge cases (empty, huge, unicode, symbols) pass.
> 6. Mobile (320px–430px) works without horizontal overflow.
> 7. Desktop (1280px–1920px) works without layout cramming or badge wrapping.
> 8. Dark & Light modes maintain $\ge 7:1$ WCAG AA / AAA contrast.
> 9. Page refresh and deep linking preserve state.
> 10. Zero runtime exceptions or console errors.
> 11. Accessibility passes (screen reader, aria-label, focus rings, single H1).
> 12. Production build compiles cleanly.

---

## The Primary UX Invariant: "USER KO KHUD SOCHNA NA PADE"
For every feature and interactive interface:
- Never assume "The user will figure it out."
- Provide clear context, action-specific CTA buttons (e.g. `Generate Old English Text` instead of generic `Submit`), instant feedback toasts, and clear empty/loading states.

---

## Summary of the 53 Phases

| Phase Range | Scope | Core Verification Requirements |
|---|---|---|
| **Phase 0–3** | Discovery & Inventory | Complete audit of routes, assets, fonts, licenses, UI elements (buttons, links, inputs, modals). |
| **Phase 4–6** | Themes & Contrast | Dual-theme inspection across Obsidian Dark and High-Contrast Light. Zero white-on-white, zero dark-on-dark. |
| **Phase 7–8** | Icons & Navigation | Individual verification of every icon and navbar item. Seamless dropdowns, zero dead links. |
| **Phase 9–14** | User Journeys & Tools | End-to-end testing of every interactive tool (generators, studios, translators, comparators). |
| **Phase 15–19** | Edge Cases & I/O | Stress testing with empty text, 10,000+ chars, emojis, runes, 300 DPI exports, clipboard toasts. |
| **Phase 20–22** | Keyboard & A11y | Tab navigation, visible focus rings, aria-labels, screen reader live announcers, zoom up to 200%. |
| **Phase 23–25** | Performance & Vitals | Sub-second LCP, zero CLS layout shifts, RAF debouncing, FontFace API lazy loading. |
| **Phase 26–30** | Technical SEO | 100% unique titles, single H1s, canonical URLs, XML sitemap, robots.txt, Schema.org JSON-LD. |
| **Phase 31–34** | Security & Privacy | 100% client-side privacy, zero unauthorized tracking, fixed-height reserved ad containers. |
| **Phase 35–38** | Build & Deployment | Flawless production build compilation (`astro build` / `vite build`), zero broken asset links. |
| **Phase 39–46** | User Personas & Tests | Simulation of mobile one-hand user, confused user, screen reader user, stress tests, regression checks. |
| **Phase 47–49** | Auto-Correction & Severity| Safe automatic fixes for all P0/P1 issues followed by re-compilation and re-audit before certification. |
| **Phase 50–53** | Release Governance | Audit table generation, composite scoring across 12 dimensions, and generation of `FINAL_RELEASE_CERTIFICATE.md`. |

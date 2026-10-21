# Knowledge Harvesting & Architecture Learnings: satyabagherwal-source/old-english-font-free

## Project Context
- **Repository**: `satyabagherwal-source/old-english-font-free`
- **Stack**: Astro 5 (Static Output), Tailwind CSS, TypeScript, i18n routing (`/[lang]/`), Cloudflare Pages / Static Hosting.
- **Languages Supported (14)**: `en`, `es`, `ja`, `fr`, `de`, `pt`, `ko`, `it`, `no`, `sv`, `da`, `fi`, `ar`, `he`.

---

## Pattern 1: Multi-Store i18n Synchronization & Fallback Integrity
### The Anti-Pattern
When an application organizes translations into multiple separate store files (e.g. `ui.ts` for general strings, `faq-translations.ts` for FAQs, `category-translations.ts` for categories):
1. Adding a new language only to `ui.ts` causes **hybrid language leakage**: the user sees localized buttons and filters, but the main content immediately below it falls back to English.
2. In static site generators (like Astro), missing locale keys fall back silently without build warnings, making it appear in development that the language route works, while serving English content to non-English users.

### The Correct Architectural Standard
1. **Multi-Store Parity Auditing**: Any new locale introduced must be registered across ALL translation files (`ui.ts`, `faq-translations.ts`, `category-translations.ts`, `compare-translations.ts`, etc.).
2. **Template Decoupling**: Component templates (`.astro`) must never contain literal text in cards or section headers. Every visible title, subtitle, badge, and button must reference `t('scope.key')`.
3. **Dynamic Client State**: If client-side JavaScript updates UI labels (e.g., "Show All" toggle buttons), pass localized string tables via global window state or HTML data attributes (e.g., `window.__I18N__`).
4. **Empirical Post-Build Verification**: Automated test assertions on `dist/[lang]/index.html` verifying that neither fallback English titles nor raw unrendered translation keys appear in the built artifacts.

---

## Pattern 2: Progressive Disclosure vs Component Bloat
1. **Tool Embedding Trap**: Embedding complete standalone tools into the homepage causes massive page weight, DOM bloat, and poor mobile LCP/CLS scores.
2. **Directory Card Pattern**: The homepage acts as a centralized navigational showcase featuring clean directory cards linking directly to standalone tool pages (`/stencil-studio/`, `/generator/`, `/alphabet/`, `/translator/`, etc.), while preserving 100% of the interactive functionality on the dedicated routes.

---

## Pattern 3: Canonical Font Licensing Registry & Zero-Budget Expansion
1. **Separation of Registry and Public View**:
   - Maintain a comprehensive cryptographic registry (`fonts-registry.json`) holding provenance, upstream commits, SHA-256 hashes, reserved font names (RFN), and license IDs.
   - The public catalog (`fonts.json`) must be derived strictly as a projection of entries with `APPROVED_FOR_PUBLICATION` status.
2. **Flagship Offline Packaging**:
   - For historic/revival typefaces outside major CDNs (e.g., `Chomsky` from GitHub releases), bundle verified WOFF2/OTF binaries locally with their associated `OFL.txt` license files.
   - Pave a zero-dependency local `@font-face` pipeline ensuring instant offline rendering without external third-party network blocking.

---

## Pattern 4: Evidence-Backed Legal Transparency vs Absolute Claims
1. **The Anti-Pattern of Absolute Promises**:
   - Promising "100% Zero-Copyright-Penalty Guarantee" or "Guaranteed Immunity" creates legal risk because all open-source licenses (including SIL OFL 1.1 Section 5) explicitly disclaim all warranties.
2. **The Compliance Transparency Standard**:
   - Frame legal messaging around verifiable evidence: "Individually reviewed against documented open-source licenses", "Evidence-Based Licensing & Compliance Transparency", "SIL OFL 1.1".
   - Distinguish transparently between rights to use in commercial artwork, rights to redistribute font software, rights to modify, and attribution/naming obligations.

---

## Pattern 5: Multi-Language Parity & Zero-Leak Invariant (Mandatory Protocol)
### Root Cause of Recurrent Translation Regressions
When an application organizes multi-language translations into multiple independent domain stores (`ui.ts`, `legal-translations.ts`, `faq-translations.ts`, `category-translations.ts`, `compare-translations.ts`, `compat-translations.ts`, `specimen-translations.ts`):
1. **The Silent Fallback Trap**: Declaring stores as `Partial<Record<SupportedLang, T>>` and falling back to English (`base || STORE.en`) allows the build to pass with 0 errors while rendering English text inside non-English pages.
2. **The RTL Punctuation Inversion**: When English sentences or questions are rendered inside an RTL container (Arabic `/ar/` or Hebrew `/he/`), question marks and punctuation flip into illegal positions (e.g., `?What is Old English font called...`), destroying credibility.
3. **The Frankenstein UI Problem**: When header/nav elements are translated via `ui.ts` (e.g. into Arabic/Hebrew), but the underlying FAQ or Legal cards fall back to English, the resulting page is a disjointed mixture of two languages.

### The 4 Universal Safeguards (Enforced Across All Repositories)
1. **Strict TypeScript Typing (No Partial Stores)**:
   - All multi-language stores MUST be typed as `Record<SupportedLang, T>`, NEVER `Partial<Record<SupportedLang, T>>`.
   - Missing languages immediately fail compilation at build time.
2. **Modular Per-Language Architecture**:
   - Complex domain stores must be partitioned into dedicated modules (`src/i18n/<feature>/<lang>.ts`).
   - The aggregator file (`<feature>-translations.ts`) imports all supported language modules and assembles the exhaustive `Record<SupportedLang, T>`.
3. **Automated Build-Time Leak Scanner (`scripts/verify-i18n-parity.mjs`)**:
   - An automated script audits EVERY generated HTML file in `dist/` across all non-English locales (`NON_EN_LOCALES`).
   - Scans for forbidden English leak patterns (English FAQ questions, English page titles, English legal slogans, English CTA phrases).
   - If even one leak is found, the build fails with exit code 1.
   - Integrated into package scripts: `"test:i18n"` and required in `"deploy"`.
4. **RTL Native Typography & Punctuation**:
   - Arabic must use native question mark (`؟`) and native phrasing.
   - Hebrew must use native QA formatting and reversed flex/grid order.



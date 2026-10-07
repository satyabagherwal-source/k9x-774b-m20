# Engineering Learnings: Deep Multi-Language Localization & Responsive Interactive Studios in Astro 5

**Repository:** `old-english-font-free` (`c:\Old english font`)  
**Bridge:** `.project-brain/brain-bridge.json`  
**Framework:** Astro 5 + Tailwind CSS v4 + Canvas API  
**Date:** 2026-10-07  
**Standard:** AI-Builder-Brain Universal Production Audit (Rule 12 & Rule 15)  

---

## 1. Executive Summary & Root Cause Analysis

### 1.1 The "Superficial Localization" Defect
When websites claim multi-language support by only translating top-level headings, navigation bars, and footer links, users experience high friction as soon as they interact with internal features. In typography and creative web apps, interactive tools (e.g. Unicode converters, thermal tattoo studios, historical translators, glyph character map modals) often contain hundreds of hardcoded English control labels, placeholders, presets, and button states.

When a user switches language to Spanish, Japanese, German, or Arabic, encountering hardcoded English inside the tools creates cognitive dissonance, lowers engagement, and harms international SEO ranking for native search terms (e.g., *"generador de letras góticas"*, *"オールドイングリッシュ 変換"*).

### 1.2 The "Deep Localization" Resolution Invariant
Every interactive studio component must accept a `lang` parameter backed by localized dictionaries (`src/i18n/ui.ts`), ensuring:
1. Input placeholders, character counters, and instruction hints translate deeply.
2. Preset buttons (e.g. "Royal Quote", "Tattoo Motto", "All Uppercase", "Arch Down") reflect local linguistic idioms.
3. Export and download buttons (e.g., "Download 2X PNG", "300 DPI Print", "Vector SVG", "Copy CSS") translate without breaking export functions.
4. Bidirectional text support (RTL for Arabic and Hebrew, LTR for European and East Asian languages) applies cleanly via `dir="rtl"` and semantic CSS.
5. Algorithmic core logic (Unicode math alphanumeric tables, canvas kerning calculations, WebFont family names) remains unmutated to prevent runtime crashes.

---

## 2. Forensic Code-Level Patterns & Rules

### Pattern 1: Safe Component Translation with Fallbacks
In Astro components, rather than relying solely on URL parsing, props must prioritize the active language with graceful fallbacks:

```astro
---
import { useTranslations, type SupportedLang, defaultLang } from '../i18n/utils';

interface Props {
  asH1?: boolean;
  lang?: SupportedLang;
}
const { asH1 = false, lang = defaultLang } = Astro.props;
const t = useTranslations(lang);
---

<label for="studioTextInput">
  {t('stencil.phraseLabel', 'Lettering Phrase / Name')}
</label>
<input 
  id="studioTextInput" 
  placeholder={t('stencil.phrasePlaceholder', 'Type your tattoo text or quote...')} 
/>
```

### Pattern 2: Preserving Technical Identifiers During i18n
When localizing dropdown selectors and canvas options, user-facing labels must be localized, but data attributes and values that control font rendering and canvas logic must strictly remain technical invariants:

```astro
<select id="webfontFamilySelect">
  {fontList.map(font => (
    <option 
      value={font.fontFamily}           <!-- DO NOT TRANSLATE: Needed for CSS font-family -->
      data-designer={font.designer}     <!-- Technical metadata preserved -->
    >
      {font.name} — {font.substyleName}
    </option>
  ))}
</select>
```

### Pattern 3: Bidirectional Support (LTR / RTL)
For Arabic (`ar`) and Hebrew (`he`), the root HTML layout dynamically assigns text direction:

```astro
---
import { getDirection } from '../i18n/utils';
const { lang = 'en' } = Astro.props;
const dir = getDirection(lang);
---
<html lang={lang} dir={dir} class="dark scroll-smooth">
```

### Pattern 4: Responsive Mobile Drawer Viewport Containment
Mobile filter drawers and sidebars must never cause horizontal blowout (`overflow-x` shifts). By isolating drawers with fixed positioning, CSS transitions, and high-z-index overlays, the main layout remains centered:

```html
<aside 
  id="filtersSidebar" 
  class="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-slate-900 border-r border-slate-800 transition-transform duration-300 -translate-x-full lg:translate-x-0 lg:static lg:w-64"
>
```

---

## 3. Supported Locales (14 Languages Verified)
1. **English (`en`)** - Default Reference Edition
2. **Español (`es`)** - Spanish
3. **日本語 (`ja`)** - Japanese
4. **Français (`fr`)** - French
5. **Deutsch (`de`)** - German
6. **Português (`pt`)** - Portuguese
7. **한국어 (`ko`)** - Korean
8. **Italiano (`it`)** - Italian
9. **Norsk (`no`)** - Norwegian
10. **Svenska (`sv`)** - Swedish
11. **Dansk (`da`)** - Danish
12. **Suomi (`fi`)** - Finnish
13. **العربية (`ar`)** - Arabic (RTL)
14. **עברית (`he`)** - Hebrew (RTL)

---

## 4. Verification Protocol
Run `node scripts/verify-all-locales.mjs` to test:
- SSR 200 HTTP response across all 14 locale routes.
- Presence of deep tool keys across FrakturGenerator, TattooCanvasStudio, MedievalTranslator, AlphabetChart, PairingAssistant, and MedievalDecorator.
- Zero missing keys across all 14 dictionaries.

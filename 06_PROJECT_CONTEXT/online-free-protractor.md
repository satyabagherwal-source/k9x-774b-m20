# Project Context: Online Free Protractor

* **Domain**: `https://onlinefreeprotractor.com`
* **Repository**: `satyabagherwal-source/onlinefreeprotractor`
* **Framework**: Astro.js 5+ (Static SSG)
* **Styling**: Tailwind CSS v4 + Vanilla CSS
* **Monetization**: Google AdSense (High-RPM Educational Masterclass Architecture)
* **Hosting**: Cloudflare Pages (`format: 'directory'`, `trailingSlash: 'always'`)
* **Languages**: 54 Locales (542 static pages)
* **Client Engines**:
  - `src/scripts/protractor-engine.js`: Protractor rendering, angle calculations (Math.atan2), loupe magnification, touch gestures.
  - `src/scripts/calibration-engine.js`: Hardware detection, screen diagonal math (Pythagorean theorem D = √(W² + H²)), ISO ID-1 credit card 4-corner homography perspective calibration.
* **i18n Pipeline**:
  - `src/i18n/translations/*.ts`: 54 translation dictionaries (1,243 keys each).
  - `scripts/sync-all-translations.js`: Automated differential Google Translate pipeline with persistent cache `translation-cache.json`.
  - `scripts/verify-i18n.js`: Parity validation script (`npm run check:i18n`).

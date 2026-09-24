# Multilingual Programmatic SEO & 54-Locale Engineering

This skill defines the technical standard for deploying large-scale multilingual static websites (50+ languages) without canonical loops, 301 redirect penalties, or broken hreflang relationships.

---

## 1. The Trailing Slash Invariant & Cloudflare Pages Synchronization

### The Bug Pattern
Edge hosting platforms (such as Cloudflare Pages) default to directory-based routing where directories have a mandatory trailing slash (`/ja/ruler/`).
If Astro generates routes without a trailing slash (`/ja/ruler`), the following catastrophic sequence occurs:
1. Googlebot crawls `https://domain.com/ja/ruler` from internal links or sitemaps.
2. Cloudflare Edge responds with **HTTP 301 Moved Permanently** redirecting to `https://domain.com/ja/ruler/`.
3. If the canonical tag on `https://domain.com/ja/ruler/` points to `https://domain.com/ja/ruler` (without slash), a **Canonical Ping-Pong Loop** is formed.
4. Google Search Console marks hundreds of pages as **"Page with redirect"** and drops rankings.

### The Solution:
1. **In `astro.config.mjs`**:
   ```javascript
   export default defineConfig({
     trailingSlash: 'always',
     build: { format: 'directory' }
   });
   ```
2. **In `src/i18n/utils.ts` (Routing helper)**:
   ```typescript
   export function useTranslatedPath(currentLang: string) {
     return function translatePath(path: string, targetLang: string = currentLang): string {
       const hashIndex = path.indexOf('#');
       const hash = hashIndex !== -1 ? path.slice(hashIndex) : '';
       const mainPath = hashIndex !== -1 ? path.slice(0, hashIndex) : path;
       let cleanPath = mainPath.startsWith('/') ? mainPath : `/${mainPath}`;
       const segments = cleanPath.split('/').filter(Boolean);
       if (segments.length > 0 && segments[0] in LANGUAGES) segments.shift();
       const inner = segments.join('/');
       let result = (!showDefaultLang && targetLang === defaultLang)
         ? (inner ? `/${inner}/` : '/')
         : (inner ? `/${targetLang}/${inner}/` : `/${targetLang}/`);
       return hash ? `${result}${hash}` : result;
     };
   }
   ```
3. **In `getHreflangLinks()`**:
   Every alternate URL must strictly terminate with a trailing slash to match the canonical URL byte-for-byte.

---

## 2. Automated Self-Healing Translation Engine

Do not rely on manual copy-pasting of strings across 50+ language dictionaries. When new keys are added:
1. Canonical strings are maintained in `en.ts`.
2. Run `npm run i18n:sync` (`scripts/sync-all-translations.js`).
3. The sync script:
   - Scans all non-English dictionaries.
   - Identifies missing keys OR keys whose values are still identical to English.
   - Batches queries through Google Translate with persistent caching in `translation-cache.json`.
   - Directly rewrites the language files with zero manual intervention.
4. Verify using `npm run check:i18n` with value-semantic validation.

---

## 3. SEO Robots & Canonical Header Sanitation

- **Error Pages**: Custom `404.astro` and `500.astro` pages MUST have `<meta name="robots" content="noindex, nofollow" />` and MUST suppress canonical and hreflang alternate tags to avoid soft 404 penalties.
- **Root Redirection**: Use `public/_redirects` to force `www` to apex domain and eliminate port 80 HTTP timeouts.
- **Sitemap Federation**: Consolidate all route definitions under a single authoritative `sitemap-index.xml`.

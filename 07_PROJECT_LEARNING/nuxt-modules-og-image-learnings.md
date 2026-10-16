# Forensic Learning Dossier: nuxt-modules/og-image

## 1. Metadata & Source Provenance
- **Repository**: [nuxt-modules/og-image](https://github.com/nuxt-modules/og-image)
- **Commit SHA**: `ea7dad1284721e42c615e2780152adaf51a34a75`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Dynamic OpenGraph image generator utilizing Satori (JSX to SVG) and `resvg` (SVG to PNG) running in server/edge runtimes.

## 2. Core Architectural Mechanisms
1. **Headless Component-to-Image Pipeline**:
   - Takes standard Vue components, evaluates templates, renders to SVG using Satori, and rasterizes to PNG via `resvg-wasm` or native binaries in <50ms without Chromium overhead.
2. **Content Hash Caching Layer**:
   - Caches generated images in Nitro storage using an MD5/SHA256 hash of component props, fonts, and template version.
   - Prevents DoS attacks from social bot crawler storms (Twitterbot, FacebookExternalHit, Slackbot requesting previews simultaneously).
3. **Automatic OpenGraph Head Injection**:
   - Automatically injects:
     - `<meta property="og:image" content="https://example.com/__og-image__/image/.../og.png">`
     - `<meta property="og:image:width" content="1200">`
     - `<meta property="og:image:height" content="630">`
     - `<meta name="twitter:card" content="summary_large_image">`

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Heavy Chromium Puppeteer crashes in serverless functions (lambda 250MB limit & cold starts). Satori + resvg provides lightweight pure-wasm execution.
- **Failure Mode 2**: Missing explicit width/height causing social platforms to display tiny square cards instead of large landscape cards.

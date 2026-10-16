# Forensic Learning Dossier: GoogleChrome/web-vitals

## 1. Metadata & Source Provenance
- **Repository**: [GoogleChrome/web-vitals](https://github.com/GoogleChrome/web-vitals)
- **Commit SHA**: `d90bf53028568ede1e059ef1ec6e445db2587956`
- **License**: Apache License 2.0
- **Audit Date**: 2026-10-16
- **Architecture**: The authoritative Google library for measuring real-user Core Web Vitals matching Chrome telemetry.

## 2. Core Architectural Mechanisms
1. **Core Web Vitals Metric Observers**:
   - **LCP (Largest Contentful Paint)**: Measures render time of largest image/text block. Good: `<= 2500ms`.
   - **CLS (Cumulative Layout Shift)**: Tracks layout shifts during entire session lifecycle using session windowing (1s gap, 5s max window). Good: `<= 0.1`.
   - **INP (Interaction to Next Paint)**: Measures longest interaction latency (click, tap, keypress) throughout page visit. Good: `<= 200ms`.
   - **TTFB (Time to First Byte)**: Measures server response latency. Good: `<= 800ms`.
   - **FCP (First Contentful Paint)**: Measures first rendered DOM element. Good: `<= 1800ms`.
2. **Background Tab & Prerender Filtering**:
   - Ignores metrics if the tab was loaded in the background (`document.visibilityState === 'hidden'`) to prevent distorted measurement.
   - Accurately adjusts timestamps for prerendered pages using `document.prerendering` API.
3. **Metric Attribution**:
   - Pinpoints the exact DOM node responsible for LCP, the shift sources for CLS, and the target element for INP.

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Misdiagnosing field performance with synthetic lab scores. Web-vitals provides actual real-user field telemetry.
- **Failure Mode 2**: Layout shifts caused by images without explicit `width` and `height` attributes. Flagged directly by CLS attribution.

# Verification Protocol: Verification Protocol: Empirical Defect Shield for googlechrome-web-vitals-learnings

<!-- PROVENANCE_START
{
  "source_repository": "googlechrome-web-vitals-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:36:20.440Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-googlechrome-web-vitals-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [googlechrome-web-vitals-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:36:20.440Z`  
> **Learning ID**: `LEARN-REEXTRACT-googlechrome-web-vitals-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `googlechrome-web-vitals-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
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


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

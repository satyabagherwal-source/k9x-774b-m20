# Forensic Learning Dossier: sitespeedio/browsertime

## 1. Metadata & Source Provenance
- **Repository**: [sitespeedio/browsertime](https://github.com/sitespeedio/browsertime)
- **Commit SHA**: `b12a878d65cfc7755b41be4f420e640ad613b522`
- **License**: MIT License
- **Audit Date**: 2026-10-16
- **Architecture**: Harness for capturing real browser timings, video recording, and visual metrics (Speed Index, Perceptual Speed Index).

## 2. Core Architectural Mechanisms
1. **Visual Metric Calculation via Video Frame Analysis**:
   - Records high-framerate video of the page load.
   - Computes visual progression curves: First Visual Change, Speed Index, and Last Visual Change.
2. **Chrome DevTools Protocol (CDP) Telemetry**:
   - Extracts low-level layout events, paint markers, and JavaScript long tasks (>50ms).

## 3. Production Failure Modes & Anti-Patterns Defended
- **Failure Mode 1**: Synthetic metrics showing fast load while users stare at a blank screen for 3 seconds. Speed Index reflects real visual readiness.
- **Failure Mode 2**: JavaScript long tasks blocking the main thread and degrading Interaction to Next Paint (INP).

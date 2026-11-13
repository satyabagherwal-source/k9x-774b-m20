# Verification Protocol: Verification Protocol: Empirical Defect Shield for sitespeedio-browsertime-learnings

<!-- PROVENANCE_START
{
  "source_repository": "sitespeedio-browsertime-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:44:52.314Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-sitespeedio-browsertime-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [sitespeedio-browsertime-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:44:52.314Z`  
> **Learning ID**: `LEARN-REEXTRACT-sitespeedio-browsertime-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `sitespeedio-browsertime-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
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


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

# Candidate Directive: Compose Desktop Pointer Gesture Hardcoded Double-Tap Mismatch (BUG-GEST-02)

- **Directive ID**: `CD-REV-E06F16`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain A (Human & Need Intelligence)
- **Source Repository**: `crosspaste-crosspaste-desktop`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/crosspaste-crosspaste-desktop-learnings.md`
- **Observed At**: 2026-11-18T08:08:44.507Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain A, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Do not use cross-platform pointer gesture detectors (`detectTapGestures`) for multi-click interactions on desktop targets when the host OS permits user-customized click timing thresholds. Hook native windowing events (`awt.multiClickInterval`).
```

## Identified Root Cause / Problem
Jetpack Compose Multiplatform's default `detectTapGestures` relies on `ViewConfiguration.doubleTapTimeoutMillis`, hardcoded to 300ms. The JVM Desktop AWT host respects the platform configuration (macOS 500ms), creating a dead-zone between 301ms and 500ms where AWT sends click events with `clickCount=2`, but Compose's gesture detector discards the second click as an isolated single tap.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain A governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

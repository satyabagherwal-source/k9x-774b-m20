# Candidate Directive: Unbounded Audio Capture on Mac Sleep / Lid Close (BUG-OATS-01)

- **Directive ID**: `CD-REV-7D6F5E`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `yazinsai-openoats`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/yazinsai-openoats-learnings.md`
- **Observed At**: 2026-11-21T08:25:41.171Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Desktop recording applications must explicitly anchor their session lifecycles to OS power state notifications. Sleep must be treated as a definitive session boundary, and audio device watchers must be re-initialized on wake to flush stale hardware handles.
```

## Identified Root Cause / Problem
Missing bindings to `NSWorkspace.willSleepNotification` and `NSWorkspace.didWakeNotification`. Incomplete network error classification in `CloudClient` which failed immediately on `.notConnectedToInternet`.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

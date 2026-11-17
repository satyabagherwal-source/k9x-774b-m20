# Candidate Directive: Reporter Silent Success Masking on Process Crashes (BUG-VITEST-01)

- **Directive ID**: `CD-REV-3A2D48`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `vitest-dev-vitest`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/vitest-dev-vitest-learnings.md`
- **Observed At**: 2026-11-17T06:20:44.206Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Any state tracking machine where tasks are executed in distributed or external processes must treat incomplete or prematurely ended tasks as failures by default upon pipeline completion. Never assume a task succeeded merely because an explicit error flag was not set.
```

## Identified Root Cause / Problem
The calculation logic relied on positive confirmation of the failed state (`state === 'fail'`), failing to account for aborted life cycles where the worker stopped executing before updating its task state.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

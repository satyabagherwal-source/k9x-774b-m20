# Candidate Directive: Eager Lock Acquisition Main-Thread Starvation (BUG-LOCK-01)

- **Directive ID**: `CD-REV-F3BEFA`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `crosspaste-crosspaste-desktop`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/crosspaste-crosspaste-desktop-learnings.md`
- **Observed At**: 2026-11-18T08:08:44.507Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Construction of dependency graphs must remain pure and free of side effects. Any dependency whose construction triggers file I/O, IPC locks, or system calls must be injected lazily.
```

## Identified Root Cause / Problem
Tight coupling of the state carrier (`AppLaunchState`) instead of an evaluated interface or `Lazy<T>` wrapper, forcing resolution at graph compile time rather than execution time.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

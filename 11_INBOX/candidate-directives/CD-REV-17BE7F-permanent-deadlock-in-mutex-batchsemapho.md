# Candidate Directive: Permanent Deadlock in Mutex/BatchSemaphore via Cooperative Budget Stranding (BUG-TOKIO-8772)

- **Directive ID**: `CD-REV-17BE7F`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `tokio-rs-tokio`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/tokio-rs-tokio-learnings.md`
- **Observed At**: 2026-11-11T09:30:09.301Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Synchronization primitives must never change external ownership states until cooperative scheduling and preemption gates have guaranteed that the task can run to completion in the current polling turn.
```

## Identified Root Cause / Problem
In PR #8371, cooperative budget preemption was integrated into `tokio::sync::batch_semaphore`. When `lock()` was polled, the internal `poll_acquire()` method successfully decremented semaphore permits. Immediately afterward, it checked the task cooperative budget via `coop::poll_proceed()`. When the budget was exhausted, it returned `Poll::Pending` **while still holding the acquired permit**. Because the task was suspended and waiting in a `FuturesUnordered` set, other branches in the same set could not acquire the mutex, preventing the task holding the permit from ever being polled again.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

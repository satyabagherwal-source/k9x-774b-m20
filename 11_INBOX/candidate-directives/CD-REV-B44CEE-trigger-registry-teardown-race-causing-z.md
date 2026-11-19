# Candidate Directive: Trigger Registry Teardown Race Causing Zombie Bindings (BUG-III-01)

- **Directive ID**: `CD-REV-B44CEE`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `iii-hq-iii`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/iii-hq-iii-learnings.md`
- **Observed At**: 2026-11-19T22:07:10.621Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Snapshotting concurrent state before an asynchronous loop invalidates subsequent mutation targets. Atomic map removal operations (`remove_if`) must return the live value, and subsequent downstream side-effects must bind exclusively to that returned value.
```

## Identified Root Cause / Problem
`unregister_worker` created a snapshot of the worker's registered bindings. It then iterated through the snapshot and executed `remove_if(worker_id matches)` on the concurrent map. However, the RPC call `unregister_trigger` was dispatched using `snap_entry.provider_key()` from the *pre-loop snapshot* rather than the actual entry returned by `remove_if`. When an in-flight re-homing operation migrated the trigger provider from `default` to `shop`, the loop removed the entry but instructed `default` to release it. The `shop` provider never received the release signal and kept executing the trigger indefinitely.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

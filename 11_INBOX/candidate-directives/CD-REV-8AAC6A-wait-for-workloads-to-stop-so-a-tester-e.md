# Candidate Directive: wait for workloads to stop so a tester exiting after its last test doesn't leave

- **Directive ID**: `CD-REV-8AAC6A`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `apple-foundationdb`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/apple-foundationdb-learnings.md`
- **Observed At**: 2026-11-20T05:29:02.348Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
When implementing operations in `fdbserver/tester/TesterServer.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apple/foundationdb. All inputs crossing module boundaries must be explicitly verified before state persistence.
```

## Identified Root Cause / Problem
Prevents defects observed in production commit `129fc073`: wait for workloads to stop so a tester exiting after its last test doesn't leave them running until timeout. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

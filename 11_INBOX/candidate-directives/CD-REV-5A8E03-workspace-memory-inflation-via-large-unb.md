# Candidate Directive: Workspace Memory Inflation via Large Unboxed Configuration Parameters (BUG-MEM-02)

- **Directive ID**: `CD-REV-5A8E03`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `biomejs-biome`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/biomejs-biome-learnings.md`
- **Observed At**: 2026-11-27T09:34:32.263Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Large configuration structures must be stored behind pointers (`Box` for transient IPC/RPC ownership, `Arc` for shared workspace state). Never embed raw aggregate configurations inside short-lived message DTOs.
```

## Identified Root Cause / Problem
The unboxed configuration tree was being duplicated and cloned across every parameter struct on the stack. In LSP interactions, parameters are created, queued, and dispatched frequently. Passing a heavy struct by value inflated the stack frame of every workspace operation.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

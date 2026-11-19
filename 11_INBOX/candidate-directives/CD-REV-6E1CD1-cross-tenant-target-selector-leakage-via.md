# Candidate Directive: Cross-Tenant Target Selector Leakage via Unchecked Cluster Queries (BUG-ZADIG-02)

- **Directive ID**: `CD-REV-6E1CD1`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain A (Human & Need Intelligence)
- **Source Repository**: `koderover-zadig`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/koderover-zadig-learnings.md`
- **Observed At**: 2026-11-19T22:07:49.420Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain A, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Do not introduce ad-hoc "selector" or "quick-list" endpoints that short-circuit foundational domain authorization models. Delete speculative convenience code.
```

## Identified Root Cause / Problem
Blurring of concerns between infrastructure management (`KubeClusterInventory`) and tenant workflow selection (`KubeWorkflowCandidates`), leading to an entire unneeded endpoint and authorization helper that bypassed standard project checks.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain A governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

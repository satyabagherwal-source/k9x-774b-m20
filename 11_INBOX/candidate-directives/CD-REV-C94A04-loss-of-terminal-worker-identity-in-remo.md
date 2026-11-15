# Candidate Directive: Loss of Terminal Worker Identity in Remote Job Wait Failures (BUG-LANCE-02)

- **Directive ID**: `CD-REV-C94A04`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `lancedb-lancedb`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/lancedb-lancedb-learnings.md`
- **Observed At**: 2026-11-15T09:27:08.014Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Diagnostics and errors crossing network boundaries must preserve historical provenance structures rather than deriving them from transient connection layers.
```

## Identified Root Cause / Problem
`ReportedFailure::into_job_failure` converted the failure block into a standard error struct but ignored the sibling `result` field containing the worker execution provenance dictionary.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

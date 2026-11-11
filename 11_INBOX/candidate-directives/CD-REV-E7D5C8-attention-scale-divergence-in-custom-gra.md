# Candidate Directive: Attention Scale Divergence in Custom Granite Implementations (BUG-GRANITE-ATTNMULT-01)

- **Directive ID**: `CD-REV-E7D5C8`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `hf-webai-official-twil-8b`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/hf-webai-official-twil-8b-learnings.md`
- **Observed At**: 2026-11-11T09:40:59.773Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Never assume standard scaling formulas ($1/\sqrt{d}$) across distinct model families; query architecture config metadata for explicit scale parameters.
```

## Identified Root Cause / Problem
The Granite architecture deviates from standard transformer scaled dot product attention by using $1/d$ scaling rather than $1/\sqrt{d}$ to stabilize wide attention layers across extended context windows.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

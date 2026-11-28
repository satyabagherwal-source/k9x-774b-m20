# Candidate Directive: Compaction Eradication of User-Pasted Summary Checkpoints (BUG-ENGINE-01)

- **Directive ID**: `CD-REV-7D1887`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain A (Human & Need Intelligence)
- **Source Repository**: `codewhale-hq-codewhale`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`
- **Observed At**: 2026-11-28T09:08:23.990Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain A, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Data content must never masquerade as control flow metadata. Checkpoint boundaries must be discriminated by strongly typed runtime provenance tags rather than textual prefixes in message bodies.
```

## Identified Root Cause / Problem
Failure to separate lexical structure from turn provenance metadata (`UserInputProvenance`). The selector assumed that any block matching the markdown header of a summary was an engine artifact.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain A governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

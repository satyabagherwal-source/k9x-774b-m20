# Candidate Directive: Policy Reset and Pack Location Invalidation on `Rc` to `Arc` Handle Promotion (BUG-GIX-ODB-01)

- **Directive ID**: `CD-REV-697CBC`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `gitoxidelabs-gitoxide`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/gitoxidelabs-gitoxide-learnings.md`
- **Observed At**: 2026-11-17T02:51:03.093Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Handlers encapsulating policies must use explicit copy constructors or builders that account for every field; conversion between concurrency wrappers must have unit tests asserting field-for-field parity.
```

## Identified Root Cause / Problem
The developer relied on a factory method (`to_handle_arc()`) to instantiate the new handle type without copying over mutable handle state fields from `self`.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

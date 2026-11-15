# Candidate Directive: Leaked Detail Pane State on Search Tab Transition (BUG-NAV-01)

- **Directive ID**: `CD-REV-1AA3A2`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `simonschubert-linuxcommandlibrary`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/simonschubert-linuxcommandlibrary-learnings.md`
- **Observed At**: 2026-11-15T08:09:31.436Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Adaptive scaffold navigators on single-pane devices collapse `List` visibility if `initialDestinationHistory` contains any `Detail` entry. Detail pane entries MUST be null unless an explicit, verified deep link target exists.
```

## Identified Root Cause / Problem
The adaptive navigator was initializing its internal history list with a non-null detail destination on initial tab switch, derived from fallback state queries or unconsumed previous selection indices. On single-pane layouts, Material 3 Adaptive Scaffolds display the highest-order role in history (`Detail`), completely hiding the `List` role beneath it if any detail exists.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

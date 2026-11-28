# Candidate Directive: Flawed SemVer Caret Range Resolution for Pre-1.0.0 Packages (BUG-PKG-01)

- **Directive ID**: `CD-REV-B1D0A3`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `biomejs-biome`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/biomejs-biome-learnings.md`
- **Observed At**: 2026-11-28T09:33:48.552Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
In SemVer range computation, `0` is non-monotonic. The leading non-zero element dictates compatibility: `0.0.x` changes break compatibility on every patch increment; `0.x.y` changes break compatibility on minor increments.
```

## Identified Root Cause / Problem
The caret (`^`) range parser grouped all `0.x.x` versions together under a single major-zero rule (`<1.0.0-0`), ignoring the SemVer mandate that in zero-major/zero-minor versions (`0.0.x`), the patch number acts as the breaking boundary.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

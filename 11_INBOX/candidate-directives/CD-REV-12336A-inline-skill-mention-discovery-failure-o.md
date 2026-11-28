# Candidate Directive: Inline Skill Mention Discovery Failure on Non-Spaced CJK Boundaries (BUG-TUI-02)

- **Directive ID**: `CD-REV-12336A`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `codewhale-hq-codewhale`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/codewhale-hq-codewhale-learnings.md`
- **Observed At**: 2026-11-28T09:08:23.990Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Text input parsers in internationalized developer tools must treat unicode script boundary transitions (specifically CJK ideographs to ASCII punctuation) as valid lexical trigger boundaries.
```

## Identified Root Cause / Problem
Western-centric token boundary assumption: assuming all word triggers must be preceded by ASCII whitespace (`c.is_ascii_whitespace()`).

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

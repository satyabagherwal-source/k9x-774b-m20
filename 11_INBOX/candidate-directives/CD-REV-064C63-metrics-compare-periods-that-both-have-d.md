# Candidate Directive: metrics): compare periods that both have data

- **Directive ID**: `CD-REV-064C63`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `crawlseo-crawlseo`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/crawlseo-crawlseo-learnings.md`
- **Observed At**: 2026-11-24T05:14:10.441Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
When implementing operations in `app/api/sites/[siteId]/domain-overview/route.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in crawlseo/crawlseo. All inputs crossing module boundaries must be explicitly verified before state persistence.
```

## Identified Root Cause / Problem
Prevents defects observed in production commit `2b28c327`: metrics): compare periods that both have data. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

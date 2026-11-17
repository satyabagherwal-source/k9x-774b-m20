# Candidate Directive: Stale Exact-Pin Configuration Drift in CI Vulnerability Scanners (BUG-CI-TRIVY-23679)

- **Directive ID**: `CD-REV-0131FE`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain M (Feedback & Evolution Intelligence)
- **Source Repository**: `arangodb-arangodb`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/arangodb-arangodb-learnings.md`
- **Observed At**: 2026-11-17T08:32:20.156Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain M, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
CI/CD configuration files are code. When security scanner version ranges are widened to absorb nightly vulnerability database updates, the operational failure mode shifts from "deterministic failure" to "dynamic failure" and must be reflected across branch backports.
```

## Identified Root Cause / Problem
Documentation-code drift during CI configuration modernization. The underlying scanner upgraded from Trivy `v0.72.0` to `v0.76.1` via orb `1.7.0`, modifying vulnerability gating rules while the comments claimed strict pin protection.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain M governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

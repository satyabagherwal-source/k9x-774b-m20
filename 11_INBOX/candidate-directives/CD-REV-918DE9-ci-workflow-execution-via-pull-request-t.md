# Candidate Directive: CI Workflow Execution via Pull Request Target Head Checkout (BUG-CI-01)

- **Directive ID**: `CD-REV-918DE9`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain A (Human & Need Intelligence)
- **Source Repository**: `freenet-freenet-core`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/freenet-freenet-core-learnings.md`
- **Observed At**: 2026-11-28T09:34:19.113Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain A, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
`pull_request_target` workflows must never check out the PR head commit into the working tree. Diff computations must be performed out-of-tree using `git fetch` and `git diff` into a sanitized quarantine directory.
```

## Identified Root Cause / Problem
The workflow bypassed GitHub Actions security best practices for `pull_request_target` by fetching untrusted head code directly into the runner workspace with `allow-unsafe-pr-checkout: true`. Additionally, Claude Code loaded project settings from the workspace rather than exclusively using runner-controlled user configurations.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain A governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

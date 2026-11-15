# Candidate Directive: Host Compromise via Symlink Traversal on Guest Disk Mount (BUG-SANDBOX-01)

- **Directive ID**: `CD-REV-DB7D65`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `vercel-labs-agent-desktop`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/vercel-labs-agent-desktop-learnings.md`
- **Observed At**: 2026-11-15T21:44:20.240Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Never perform unchecked filesystem writes across boundary layers (host-to-guest). Enforce `lstat` path walk validation and `O_NOFOLLOW`.
```

## Identified Root Cause / Problem
Failure to enforce device boundary and non-dereference checks (`O_NOFOLLOW`) when writing into a directory structure controlled by an untrusted partition.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

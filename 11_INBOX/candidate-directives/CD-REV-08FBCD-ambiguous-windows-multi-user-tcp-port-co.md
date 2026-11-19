# Candidate Directive: Ambiguous Windows Multi-User TCP Port Collision Crash (BUG-PORT-02)

- **Directive ID**: `CD-REV-08FBCD`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain A (Human & Need Intelligence)
- **Source Repository**: `rtk-ai-rtk`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/rtk-ai-rtk-learnings.md`
- **Observed At**: 2026-11-19T20:34:00.276Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain A, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Background daemons binding well-known loopback ports must explicitly catch `AddrInUse` and output clear configuration instructions pointing to the configuration file.
```

## Identified Root Cause / Problem
Loopback socket bindings (`127.0.0.1`) are shared across all logon sessions on Windows machines. The background auto-start daemon attempted to bind the hardcoded default port without detecting `ErrorKind::AddrInUse`, leaving users unaware of the cross-session collision.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain A governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

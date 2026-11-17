# Candidate Directive: CheckConfig Protocol Coupling and Type Collision (BUG-PULUMI-01)

- **Directive ID**: `CD-REV-837AEC`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `pulumi-pulumi`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/pulumi-pulumi-learnings.md`
- **Observed At**: 2026-11-17T08:45:50.240Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Protocol schemas across distinct lifecycle phases must never be shared across domain boundaries. When decoupling, implement dynamic RPC fallback via `codes.Unimplemented`.
```

## Identified Root Cause / Problem
Overloading the same Protobuf/gRPC message structures for two structurally distinct lifecycle phases: general resource input validation vs provider plugin instantiation configuration.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

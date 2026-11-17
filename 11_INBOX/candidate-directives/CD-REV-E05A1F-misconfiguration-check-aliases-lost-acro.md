# Candidate Directive: Misconfiguration Check Aliases Lost Across Client-Server RPC Boundary (BUG-RPC-02)

- **Directive ID**: `CD-REV-E05A1F`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `aquasecurity-trivy`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/aquasecurity-trivy-learnings.md`
- **Observed At**: 2026-11-17T08:32:19.004Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Distributed security scanners must enforce structural contracts across their RPC boundaries to prevent feature drift between standalone and distributed run modes.
```

## Identified Root Cause / Problem
`PolicyMetadata` in `rpc/common/service.proto` omitted the `repeated string aliases = X;` field. When findings were serialized and uploaded by the client, the alias metadata was dropped.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

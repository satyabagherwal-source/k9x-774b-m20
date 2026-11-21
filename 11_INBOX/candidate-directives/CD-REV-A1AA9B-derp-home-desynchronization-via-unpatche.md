# Candidate Directive: DERP Home Desynchronization via Unpatched Snapshot Bypass

- **Directive ID**: `CD-REV-A1AA9B`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `tailscale-tailscale`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/tailscale-tailscale-learnings.md`
- **Observed At**: 2026-11-21T23:29:12.496Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Fast-path equality checks based on cached snapshots fail silently if any mutation pathway modifies live operational state without updating or invalidating the snapshot.
```

## Identified Root Cause / Problem
1. `Conn.UpdateNetmapDelta` received a field-level `NodeMutationDERPHome` updating the endpoint via `ep.setDERPHome(B)`.
  2. The reference snapshot map `c.peersByID` was deliberately left unpatched (documented as not tracking deltas).
  3. When the peer moved back to region A, the update arrived embedded inside a full `MapResponse` netmap payload.
  4. `Conn.updateNodes` invoked its fast-path equality check: `peersByID[id].Equal(newNode)`.
  5. Because `newNode.DERPHome == A` matched the stale snapshot `peersByID[id].DERPHome == A`, the method concluded nothing had changed and skipped updating the live endpoint. The live endpoint remained trapped on region B.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

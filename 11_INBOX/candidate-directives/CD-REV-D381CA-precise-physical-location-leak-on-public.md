# Candidate Directive: Precise Physical Location Leak on Public-Key LoRa Channels (BUG-LOCATION-01)

- **Directive ID**: `CD-REV-D381CA`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain M (Feedback & Evolution Intelligence)
- **Source Repository**: `meshtastic-meshtastic-android`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/meshtastic-meshtastic-android-learnings.md`
- **Observed At**: 2026-11-15T09:26:40.161Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain M, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Security-sensitive telemetry permissions cannot be modeled as independent scalar properties; they must be cryptographically bounded by the transport medium's access control layer.
```

## Identified Root Cause / Problem
The domain logic previously normalized replacement channels without inspecting the cryptographic strength of the channel's `psk` (Pre-Shared Key). The system omitted validation for 1-byte key aliases (e.g., `0x01` representing default channel key) and default 16-byte key families whose last byte serves as a sub-band selector.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain M governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

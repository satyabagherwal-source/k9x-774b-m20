# Candidate Directive: Early Compaction Series Tombstone Loss with Exemplars Causing Unknown Series WAL Corruption (BUG-TSDB-TOMB-02)

- **Directive ID**: `CD-REV-37EA19`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `prometheus-prometheus`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/prometheus-prometheus-learnings.md`
- **Observed At**: 2026-11-19T06:33:38.473Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Never permit "partial entity eviction" across segmented append-only logs. If an entity's primary data chunks are truncated, its tombstone MUST be committed to the WAL before memory references are reclaimed.
```

## Identified Root Cause / Problem
Exemplar replay and tombstone processing run in separate asynchronous workers. When chunk deletion occurred without writing an explicit WAL tombstone, the lifecycle of series metadata became decoupled from its chunk storage, desynchronizing the WAL checkpoint boundary.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

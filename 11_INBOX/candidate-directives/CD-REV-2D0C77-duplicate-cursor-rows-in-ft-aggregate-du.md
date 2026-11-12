# Candidate Directive: Duplicate Cursor Rows in FT.AGGREGATE During Backfill Deletions (BUG-IDX-02)

- **Directive ID**: `CD-REV-2D0C77`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `redisearch-redisearch`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/redisearch-redisearch-learnings.md`
- **Observed At**: 2026-11-12T08:19:23.696Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
State-dependent cursors traversing live-mutated structures cannot rely on relative position offsets. Cursors must retain monotonic document ID markers and track generation epochs to detect compaction drift.
```

## Identified Root Cause / Problem
The aggregation cursor iterates over physical document IDs (`DocId`). During background backfill, deleting a document shifts or recycles slot allocations in the index's internal ID mapping table. When the garbage collector reclaims dead doc IDs while the cursor holds an offset-based position, the internal cursor bookmark drifts relative to the re-compacted posting lists, causing documents that shifted across page boundaries to be visited twice.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

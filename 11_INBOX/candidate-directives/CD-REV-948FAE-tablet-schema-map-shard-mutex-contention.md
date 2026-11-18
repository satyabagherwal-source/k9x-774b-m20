# Candidate Directive: Tablet Schema Map Shard Mutex Contention on Wide Table Scans (BUG-CONCURRENCY-01)

- **Directive ID**: `CD-REV-948FAE`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `starrocks-starrocks`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/starrocks-starrocks-learnings.md`
- **Observed At**: 2026-11-18T08:22:07.060Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
High-contention sharded lookup structures must perform coarse lookup and pointer capture inside the mutex, decoupling deep object validation to thread-local contexts outside critical sections.
```

## Identified Root Cause / Problem
Two issues occurred concurrently:
  1. `Rowset::get_rowsets()` resolved schema pointers per-rowset inside an iterator loop without pre-memoizing schemas across the `TabletMetadataPB`.
  2. Inside `TabletSchemaMap::emplace()`, the engine invoked `check_schema_unique_id(schema_pb, ptr)` **while holding the map shard mutex**. Since the shard is selected purely by `SchemaId`, all tablets across all rowsets of the same table hashed to the identical mutex, serializing wide-schema traversal across all query execution threads.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

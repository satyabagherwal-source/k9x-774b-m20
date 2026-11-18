# Candidate Directive: [CD-R9TU] Optional-Index Degradation Invariant under Shared-Data Storage

<!-- PROVENANCE_START
{
  "source_repository": "StarRocks/starrocks",
  "source_url": "https://github.com/StarRocks/starrocks",
  "source_version": "37e75d93",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T08:21:35.490Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-starrocks-starrocks",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [StarRocks/starrocks](https://github.com/StarRocks/starrocks) (Revision: `37e75d93`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T08:21:35.490Z`  
> **Learning ID**: `learn-github-starrocks-starrocks`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Secondary indexing structures (e.g., Bitmap Indexes, Bloom Filters, Inverted Indexes) stored as separate physical or logical files in cloud object storage **MUST BE TREATED AS ACCELERATORS, NOT TRUTH INVARIANTS**. If an accelerator index file read yields `Status::NotFound` or missing remote file markers during lazy iterator initialization or predicate retrieval, the query execution engine **MUST NOT** abort the query. It **MUST** cancel index evaluation, clear partial scan range prunings, preserve all original query predicate trees, and fall back transparently to a full vectorized segment scan.

**WHY**:
In shared-data cloud lakehouses, background compaction, segment deduplication, and asynchronous vacuum routines race against long-running queries executed over historical snapshots. An index delta file (`.idx`) may be pruned or GC-collected under older catalog views. Crashing or returning failure on missing secondary indexes breaks the high-availability model of decoupled storage-compute architectures.

**WHEN TO APPLY**:
- Vectorized storage scanners accessing external/delta indexes.
- LSM/Shared-Data tablet read paths where auxiliary files provide pruning acceleration.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
Status BitmapIndexEvaluator::evaluate(SparseRange<>& dst_scan_range, PredicateTree& dst_pred_tree) {
    const auto optional_file_missing = [this]() -> bool {
        return std::ranges::any_of(_bitmap_index_iterators, [](const auto* iter) {
            return iter != nullptr && iter->is_file_missing();
        });
    };

    // Pre-seek check: if file already identified missing, bypass without pruning
    if (optional_file_missing()) {
        return Status::OK();
    }

    auto seek_result = _pred_tree.visit(BitmapIndexSeeker{this}, /*erasable=*/true);
    // In shared-data architectures, files are opened lazily upon dictionary/roaring fetch.
    // If during lazy I/O the remote block storage reported NotFound:
    if (optional_file_missing()) {
        // Rollback: return OK without pruning scan range or removing predicates.
        // The original PredicateTree will be evaluated directly against raw vector columns.
        return Status::OK();
    }
    ASSIGN_OR_RETURN(const auto seek_res, std::move(seek_result));

    auto retrieve_result = _pred_tree.visit(BitmapIndexRetriver{this});
    if (optional_file_missing()) {
        return Status::OK();
    }
    ASSIGN_OR_RETURN(auto roaring, std::move(retrieve_result));
    
    // Apply roaring bitmap pruning only if index access completed cleanly
    if (roaring.has_value()) {
        dst_scan_range = dst_scan_range.intersection(SparseRange<>(roaring.value()));
    }
    return Status::OK();
}
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: DO NOT propagate NotFound errors from secondary accelerators
Status ColumnReader::new_bitmap_index_iterator(const IndexReadOptions& opts, BitmapIndexIterator** iterator) {
    Status st = _new_idg_backed_bitmap_index_iterator(opts, entry.index_file, entry.encryption_meta, iterator);
    if (!st.ok()) {
        // FATAL: Fails the entire analytical query because an auxiliary speed-up file was vacuumed.
        return st;
    }
    return Status::OK();
}
```

**VERIFICATION METHOD**:
Fault injection integration test deleting index files out of band:
```cpp
TEST_F(LakeScannerTest, test_missing_index_fallback) {
    // 1. Build segment with secondary bitmap index
    // 2. Remove the .idx file on the object storage emulator
    // 3. Execute query with predicates targeting the missing index
    // 4. Assert query returns status OK and yields identical row outputs via column scan fallback
    ASSERT_TRUE(fs::remove(idx_file_path).ok());
    auto chunk = execute_scan_query("SELECT * FROM lake_table WHERE col_a = 42;");
    EXPECT_EQ(chunk->num_rows(), 1);
    EXPECT_EQ(StorageMetrics::instance()->lake_idg_files_missing_total.value(), 1);
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:21:35.489Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794990095489",
    "title": "Optional-Index Degradation Invariant under Shared-Data Storage",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "StarRocks/starrocks",
    "source_uri": "https://github.com/StarRocks/starrocks",
    "source_version": "HEAD",
    "content_hash": "8f7e67dc480c571738684e0d39c224ace795912be74b14378317e9a926587279"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.6,
      "tier": "TIER_3_COMMUNITY_OPEN",
      "findings": [],
      "details": [
        "Source originates from community open repository",
        "Source version unpinned (HEAD), subject to upstream drift",
        "Cryptographic SHA-256 payload integrity hash present"
      ]
    },
    "evidence_quality": {
      "status": "FAIL",
      "score": 0,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [],
      "details": [
        "Direct empirical evidence ratio: 0% (0/5)",
        "Evidence-to-claim lexical alignment: 0%"
      ]
    },
    "technical_correctness": {
      "status": "PASS",
      "score": 1,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": false,
      "opposing_rule": null,
      "unsupported_assumptions": [],
      "findings": [],
      "details": [
        "No direct opposition with canonical operating directives",
        "Substantive technical content verified (> 40 chars)"
      ]
    },
    "reusability": {
      "status": "PASS",
      "score": 1,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
        "Expresses generalized engineering invariants (3 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 1,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)",
        "Includes explicit negative example / anti-pattern contrast"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-18T08:21:35.489Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "PASS",
      "score": 1,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": false,
      "conflicting_rule": null,
      "findings": [],
      "details": []
    }
  },
  "detected_contradictions": [],
  "missing_information": [
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "70519021a9d4f127d33caf4a91a8e9228d82ec2b614c50a6c0a70f37b901a296"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

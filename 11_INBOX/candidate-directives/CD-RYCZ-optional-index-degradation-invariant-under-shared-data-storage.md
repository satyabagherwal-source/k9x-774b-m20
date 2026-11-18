# Candidate Directive: [CD-RYCZ] Optional-Index Degradation Invariant under Shared-Data Storage

<!-- PROVENANCE_START
{
  "source_repository": "starrocks-starrocks-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T08:22:07.183Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-starrocks-starrocks-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [starrocks-starrocks-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T08:22:07.183Z`  
> **Learning ID**: `LEARN-EVO-starrocks-starrocks-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:22:07.283Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794990127283",
    "title": "Optional-Index Degradation Invariant under Shared-Data Storage",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "starrocks-starrocks-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b2084f57ac012c3b08b4f5c4d7996bc0dccaf34805bb554f101f77ebcbfdeaad"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:22:07.283Z"
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
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "f1e5719cfb888792b71cfd8b45f7b31563c3df4ca60bc34e19f773517193addd"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-P8R5] Incomplete Index Covered-Fields Declaration Hazard

<!-- PROVENANCE_START
{
  "source_repository": "arangodb-arangodb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:32:20.273Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-arangodb-arangodb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [arangodb-arangodb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:32:20.273Z`  
> **Learning ID**: `LEARN-EVO-arangodb-arangodb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When introducing a new index type in a distributed query planner, the index class MUST explicitly declare whether its key attributes are capable of index-covering queries (`coveredFields()`). If an index stores only internal representations (e.g., dense vectors, HNSW graph structures) and cannot satisfy direct document attribute projection without `storedValues`, its `coveredFields()` implementation MUST explicitly return an empty field set (`emptyCoveredFields`) rather than falling through to an unhandled enum state or returning partial attribute coverage.

**WHY**:
In distributed query compilation, when an index claims to cover a field, the optimizer removes the downstream `MaterializeNode` and sets `filterMode = "index"` or `projectionMode = "index"`. If a vector/multidimensional index emits vector coordinates that require full document de-serialization, omitting the index type in `ClusterIndex::coveredFields()` causes cluster coordinator crashes: the coordinator plan expects the intermediate worker node to emit deserialized VelocyPack slices, but the worker outputs raw internal IDs or empty records, triggering assertion failures during result-set materialization.

**WHEN TO APPLY**:
Any database engine, distributed planner, or secondary index interface in C++, Rust, or Go where query planners can bypass disk/row lookups via "Covering Indexes" (e.g., Index-Only Scans).

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// arangod/ClusterEngine/ClusterIndex.cpp
std::vector<std::vector<arangodb::basics::AttributeName>> const& 
ClusterIndex::coveredFields() const {
  switch (_type) {
    case IndexType::Primary:
    case IndexType::Edge:
    case IndexType::Persistent:
      return _coveredFields;

    // Explicit non-covering index invariants:
    case IndexType::Zkd:
    case IndexType::MDI:
    case IndexType::MDIPrefixed:
    case IndexType::Vector:
    case IndexType::NoAccess: {
      return Index::emptyCoveredFields;
    }

    default: {
      TRI_ASSERT(false) << "ClusterIndex::coveredFields called on unsupported index type: " 
                        << static_cast<int>(_type);
      return Index::emptyCoveredFields;
    }
  }
}
```

**NEGATIVE CONSTRAINT**:
```cpp
// CRITICAL DEFECT: Omitting IndexType::Vector from the switch statement.
// Causes undefined fall-through, unhandled switch warning bypass,
// or returning uninitialized/default coveredFields references.
std::vector<std::vector<arangodb::basics::AttributeName>> const& 
ClusterIndex::coveredFields() const {
  switch (_type) {
    case IndexType::Primary:
      return _coveredFields;
    case IndexType::Zkd:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:32:20.367Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904340367",
    "title": "Incomplete Index Covered-Fields Declaration Hazard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "arangodb-arangodb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b6a6900a58ebc659c58c9ffac4b43f4b599255953c405db4b0e69688a856f0a6"
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:32:20.368Z"
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
  "auth_token": "1447ecf25ca488cdd2c7df617f5ea599d930f24ecf4f110b9e1735fe48a7dc26"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

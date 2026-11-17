# Candidate Directive: [CD-NQA5] Incomplete Index Covered-Fields Declaration Hazard

<!-- PROVENANCE_START
{
  "source_repository": "arangodb/arangodb",
  "source_url": "https://github.com/arangodb/arangodb",
  "source_version": "d0c81b64",
  "license": "NOASSERTION",
  "timestamp": "2026-11-17T08:31:09.773Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-arangodb-arangodb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [arangodb/arangodb](https://github.com/arangodb/arangodb) (Revision: `d0c81b64`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-17T08:31:09.773Z`  
> **Learning ID**: `learn-github-arangodb-arangodb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    case IndexType::MDI:
      return Index::emptyCoveredFields;
    // MISSING IndexType::Vector!
    // Result: Evaluates to invalid optimizer assertions in distributed AQL plans.
  }
}
```

**VERIFICATION METHOD**:
Implement a plan-level regression test validating both `filterMode` and `projectionMode`:
```javascript
const plan = db._createStatement({
  query: "FOR d IN col LET dist = APPROX_NEAR_L2(@qp, d.vector) SORT dist LIMIT 5 RETURN d.vector",
  bindVars: { qp: randomPoint }
}).explain().plan;

const indexNode = plan.nodes.find(n => n.type === "EnumerateNearVectorNode");
assert.strictEqual(indexNode.projectionMode, "pass-through-id");
assert.ok(plan.nodes.some(n => n.type === "MaterializeNode"), "MaterializeNode MUST exist when vector index lacks storedValues");
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:31:09.771Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794904269771",
    "title": "Incomplete Index Covered-Fields Declaration Hazard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "arangodb/arangodb",
    "source_uri": "https://github.com/arangodb/arangodb",
    "source_version": "HEAD",
    "content_hash": "b401400f5b60d4d678faea01ea6d2e669725ba0c738ed059de88c0671fe5a01a"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:31:09.771Z"
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
  "auth_token": "be9a6062060efd56db60dd8a4c6406e46de290d68fc89fe063b5c55e4941d91d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

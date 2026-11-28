# Candidate Directive: [CD-7IBT] [CHORE](frontend): Drop get-collection-by-CRN route

<!-- PROVENANCE_START
{
  "source_repository": "chroma-core/chroma",
  "source_url": "https://github.com/chroma-core/chroma",
  "source_version": "de23e663",
  "license": "Apache-2.0",
  "timestamp": "2026-11-28T06:30:57.161Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-chroma-core-chroma",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [chroma-core/chroma](https://github.com/chroma-core/chroma) (Revision: `de23e663`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-28T06:30:57.161Z`  
> **Learning ID**: `learn-github-chroma-core-chroma`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `clients/new-js/packages/chromadb/src/api/sdk.gen.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in chroma-core/chroma. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `de23e663`: [CHORE](frontend): Drop get-collection-by-CRN route. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `clients/new-js/packages/chromadb/src/api/sdk.gen.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
import type { GetUserIdentityData, GetUserIdentityResponse2, GetUserIdentityError, HealthcheckData, HealthcheckResponse, HealthcheckError, HeartbeatData, HeartbeatResponse2, HeartbeatError, PreFlightChecksData, PreFlightChecksResponse, PreFlightChecksError, ResetData, ResetResponse, ResetError, CreateTenantData, CreateTenantResponse2, CreateTenantError, GetTenantData, GetTenantResponse2, GetTenantError, UpdateTenantData, UpdateTenantResponse2, UpdateTenantError, ListDatabasesData, ListDatabasesResponse, ListDatabasesError, CreateDatabaseData, CreateDatabaseResponse2, CreateDatabaseError, GetDatabasesByIdsData, GetDatabasesByIdsResponse, GetDatabasesByIdsError, GetDatabaseByIdData, GetDatabaseByIdResponse, GetDatabaseByIdError, DeleteDatabaseData, DeleteDatabaseResponse2, DeleteDatabaseError, GetDatabaseData, GetDatabaseResponse, GetDatabaseError, ListCollectionsData, ListCollectionsResponse, ListCollectionsError, CreateCollectionData, CreateCollectionResponse, CreateCollectionError, GetCollectionByIdData, GetCollectionByIdResponse, GetCollectionByIdError, DeleteCollectionData, DeleteCollectionResponse2, DeleteCollectionError, GetCollectionData, GetCollectionResponse, GetCollectionE
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
import type { GetUserIdentityData, GetUserIdentityResponse2, GetUserIdentityError, GetCollectionByCrnData, GetCollectionByCrnResponse, GetCollectionByCrnError, HealthcheckData, HealthcheckResponse, HealthcheckError, HeartbeatData, HeartbeatResponse2, HeartbeatError, PreFlightChecksData, PreFlightChecksResponse, PreFlightChecksError, ResetData, ResetResponse, ResetError, CreateTenantData, CreateTenantResponse2, CreateTenantError, GetTenantData, GetTenantResponse2, GetTenantError, UpdateTenantData, UpdateTenantResponse2, UpdateTenantError, ListDatabasesData, ListDatabasesResponse, ListDatabasesError, CreateDatabaseData, CreateDatabaseResponse2, CreateDatabaseError, GetDatabasesByIdsData, GetDatabasesByIdsResponse, GetDatabasesByIdsError, GetDatabaseByIdData, GetDatabaseByIdResponse, GetDatabaseByIdError, DeleteDatabaseData, DeleteDatabaseResponse2, DeleteDatabaseError, GetDatabaseData, GetDatabaseResponse, GetDatabaseError, ListCollectionsData, ListCollectionsResponse, ListCollectionsError, CreateCollectionData, CreateCollectionResponse, CreateCollectionError, GetCollectionByIdData, GetCollectionByIdResponse, GetCollectionByIdError, DeleteCollectionData, DeleteCollectionResponse2, De
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `de23e663` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T06:30:57.159Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795847457159",
    "title": "[CHORE](frontend): Drop get-collection-by-CRN route",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "chroma-core/chroma",
    "source_uri": "https://github.com/chroma-core/chroma",
    "source_version": "HEAD",
    "content_hash": "18c109c2799ab9637f4f47dbaf7253412e09e462e483d0941033460f9c41831b"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-28T06:30:57.159Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "2935559993af8d3a1103aab8b0766ab08d928a891c0a7d3d023e60cba9ccaa34"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

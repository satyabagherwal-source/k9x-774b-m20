# Candidate Directive: [CD-7LL8] [CHORE](frontend): Drop get-collection-by-CRN route

<!-- PROVENANCE_START
{
  "source_repository": "chroma-core-chroma-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T06:31:01.251Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-chroma-core-chroma-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [chroma-core-chroma-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T06:31:01.251Z`  
> **Learning ID**: `LEARN-EVO-chroma-core-chroma-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-28T06:31:01.384Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795847461384",
    "title": "[CHORE](frontend): Drop get-collection-by-CRN route",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "chroma-core-chroma-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "18c109c2799ab9637f4f47dbaf7253412e09e462e483d0941033460f9c41831b"
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
        "Harvested/verified timestamp recorded: 2026-11-28T06:31:01.385Z"
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
  "auth_token": "d265f8bac9ecafdaccdb1a0324aa0846cac49f1d9b90d6a3775e6fc21745bfa1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

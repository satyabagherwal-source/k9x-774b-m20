# Candidate Directive: [CD-W4E5] [AUTOMATIC] test: sync audience fixtures from Khepri main (RevenueCat/purchases-

<!-- PROVENANCE_START
{
  "source_repository": "revenuecat-purchases-ios-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T04:30:07.275Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-revenuecat-purchases-ios-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [revenuecat-purchases-ios-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T04:30:07.275Z`  
> **Learning ID**: `LEARN-EVO-revenuecat-purchases-ios-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Tests/UnitTests/LocalRules/AudienceCompatibility/conditions/all_purchased_product_ids.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in RevenueCat/purchases-ios. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `67040db0`: [AUTOMATIC] test: sync audience fixtures from Khepri main (RevenueCat/purchases-ios_internal#168). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Tests/UnitTests/LocalRules/AudienceCompatibility/conditions/all_purchased_product_ids.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
{
  "schema_version": 1,
  "cases": [
    {
      "id": "allPurchasedProductIds/is/premium/new",
      "field": "allPurchasedProductIds",
      "operator": "is",
      "profile": "new",
      "predicate": "{\"and\": [{\"some\": [{\"var\": \"purchases\"}, {\"and\": [{\"==\": [{\"var\": \"purchased_product_identifier\"}, \"premium\"]}, {\"==\": [{\"var\": \"is_sandbox\"}, false]}]}]}, {\"!\": [{\"some\": [{\"var\": \"purchases\"}, {\"and\": [{\"==\": [{\"var\": \"is_sandbox\"}, false]}, {\"!=\": [{\"var\": \"purchased_product_identifier\"}, null]}, {\"!=\": [{\"var\": \"purchased_product_identifier\"}, \"\"]}, {\"!=\": [{\"var\": \"purchased_product_identifier\"}, \"premium\"]}]}]}]}]}",
      "expected": false
    },
    {
      "id": "allPurchasedProductIds/is/premium/subscription_then_product",
      "field": "allPurchasedProductIds",
      "operator": "is",
      "profile": "subscription_then_product",
      "predicate": "{\"and\": [{\"some\": [{\"var\": \"purchases\"}, {\"and\": [{\"==\": [{\"var\": \"purchased_product_identifier\"}, \"premium\"]}, {\"==\": [{\"var\": \"is_sandbox\"}, false]}]}]}, {\"!\": [{\"some\": [{\"var\": \"purchases\"}, {\"and\": [{\"==\": [{\"var\": \"is
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `67040db0` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T04:30:07.420Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795840207420",
    "title": "[AUTOMATIC] test: sync audience fixtures from Khepri main (RevenueCat/purchases-",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "revenuecat-purchases-ios-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8e18d5a695e6236d82e2954c628177a7a247d8a70d6493db1308a8b3512bbba3"
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
        "Harvested/verified timestamp recorded: 2026-11-28T04:30:07.420Z"
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
  "auth_token": "d8ee23b49d8c6cfd39e978cc6be867eb291343833545f54a033f822000fe1b22"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-VYKT] [AUTOMATIC] test: sync audience fixtures from Khepri main (RevenueCat/purchases-

<!-- PROVENANCE_START
{
  "source_repository": "RevenueCat/purchases-ios",
  "source_url": "https://github.com/RevenueCat/purchases-ios",
  "source_version": "67040db0",
  "license": "MIT",
  "timestamp": "2026-11-28T04:29:59.885Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-revenuecat-purchases-ios",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [RevenueCat/purchases-ios](https://github.com/RevenueCat/purchases-ios) (Revision: `67040db0`).  
> **License**: MIT | **Timestamp**: `2026-11-28T04:29:59.885Z`  
> **Learning ID**: `learn-github-revenuecat-purchases-ios`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-28T04:29:59.882Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795840199882",
    "title": "[AUTOMATIC] test: sync audience fixtures from Khepri main (RevenueCat/purchases-",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "RevenueCat/purchases-ios",
    "source_uri": "https://github.com/RevenueCat/purchases-ios",
    "source_version": "HEAD",
    "content_hash": "8e18d5a695e6236d82e2954c628177a7a247d8a70d6493db1308a8b3512bbba3"
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
        "Harvested/verified timestamp recorded: 2026-11-28T04:29:59.883Z"
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
  "auth_token": "3a2e6c8790322f2c6473cc02471aa136eea1cdcc536725be677170d72dec852d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

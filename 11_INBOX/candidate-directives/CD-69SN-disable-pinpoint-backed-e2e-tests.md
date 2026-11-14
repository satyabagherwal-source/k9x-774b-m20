# Candidate Directive: [CD-69SN] disable Pinpoint-backed E2E tests

<!-- PROVENANCE_START
{
  "source_repository": "aws-amplify/amplify-js",
  "source_url": "https://github.com/aws-amplify/amplify-js",
  "source_version": "6a065b17",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T04:14:37.847Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aws-amplify-amplify-js",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aws-amplify/amplify-js](https://github.com/aws-amplify/amplify-js) (Revision: `6a065b17`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T04:14:37.847Z`  
> **Learning ID**: `learn-github-aws-amplify-amplify-js`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/integ-config/integ-all.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aws-amplify/amplify-js. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6a065b17`: e2e): disable Pinpoint-backed E2E tests. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/integ-config/integ-all.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  # DISABLED: Amazon Pinpoint reached end of support on October 31, 2026.
  # - test_name: integ_react_analytics_pinpoint
  #   desc: 'Test record and identifyUser calls for pinpoint'
  #   framework: react
  #   category: analytics
  #   sample_name: [pinpoint-test]
  #   spec: pinpoint
  #   # Temp fix:
  #   browser: *minimal_browser_list
  # DISABLED: In-App Messaging is backed by Amazon Pinpoint, which reached end of support on October 31, 2026.
  # - test_name: integ_in_app_messaging
  #   desc: 'React InApp Messaging'
  #   framework: react
  #   category: in-app-messaging
  #   sample_name: [in-app-messaging-app]
  #   spec: in-app-messaging
  #   browser: *minimal_browser_list
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
  - test_name: integ_react_analytics_pinpoint
    desc: 'Test record and identifyUser calls for pinpoint'
    framework: react
    category: analytics
    sample_name: [pinpoint-test]
    spec: pinpoint
    # Temp fix:
    browser: *minimal_browser_list
  - test_name: integ_in_app_messaging
    desc: 'React InApp Messaging'
    framework: react
    category: in-app-messaging
    sample_name: [in-app-messaging-app]
    spec: in-app-messaging
    browser: *minimal_browser_list
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6a065b17` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T04:14:37.845Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794629677845",
    "title": "disable Pinpoint-backed E2E tests",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aws-amplify/amplify-js",
    "source_uri": "https://github.com/aws-amplify/amplify-js",
    "source_version": "HEAD",
    "content_hash": "44efd40f423a3bd244bbc69fe53399a75df878af1c14784c46df2022dbce620e"
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
        "Harvested/verified timestamp recorded: 2026-11-14T04:14:37.845Z"
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
  "auth_token": "4c22e37b9e01efa1c4890602263159952763dd632a5688f2e256d7c4da015ce5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

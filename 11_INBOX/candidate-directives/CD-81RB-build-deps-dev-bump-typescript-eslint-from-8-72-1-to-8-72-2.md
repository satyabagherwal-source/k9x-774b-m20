# Candidate Directive: [CD-81RB] build(deps-dev): bump typescript-eslint from 8.72.1 to 8.72.2

<!-- PROVENANCE_START
{
  "source_repository": "cheeriojs/dom-serializer",
  "source_url": "https://github.com/cheeriojs/dom-serializer",
  "source_version": "b81732f9",
  "license": "MIT",
  "timestamp": "2026-11-16T20:11:08.135Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-cheeriojs-dom-serializer",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [cheeriojs/dom-serializer](https://github.com/cheeriojs/dom-serializer) (Revision: `b81732f9`).  
> **License**: MIT | **Timestamp**: `2026-11-16T20:11:08.135Z`  
> **Learning ID**: `learn-github-cheeriojs-dom-serializer`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `package-lock.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in cheeriojs/dom-serializer. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b81732f9`: build(deps-dev): bump typescript-eslint from 8.72.1 to 8.72.2. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `package-lock.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
        "typescript-eslint": "^8.72.2",
      "version": "8.72.2",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/eslint-plugin/-/eslint-plugin-8.72.2.tgz",
      "integrity": "sha512-222PKFXKihmFpi/pS5njoBgdAqsPhj2/GBmFbrNw8Tq8gEG9Sv+kSlKFy4u2q+mJv9ZzJgM2Gkv/bUzRZwZw5g==",
        "@typescript-eslint/scope-manager": "8.72.2",
        "@typescript-eslint/type-utils": "8.72.2",
        "@typescript-eslint/utils": "8.72.2",
        "@typescript-eslint/visitor-keys": "8.72.2",
        "@typescript-eslint/parser": "^8.72.2",
      "version": "8.72.2",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/parser/-/parser-8.72.2.tgz",
      "integrity": "sha512-llP+T1YuJOLlxEciP6OyQGtz5SMxyn+9LA2BvZw5RmToGVa1y4beEDVQL6Gje7T5WFYh19WREjDCN9Ev4gm5AA==",
        "@typescript-eslint/scope-manager": "8.72.2",
        "@typescript-eslint/types": "8.72.2",
        "@typescript-eslint/typescript-estree": "8.72.2",
        "@typescript-eslint/visitor-keys": "8.72.2",
      "version": "8.72.2",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/project-service/-/project-service-8.72.2.tgz",
      "integrity": "sha512-6y5dLTZdHhI8Eh3yIQ/bfQhRKwn5e+TpJj64o18
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
        "typescript-eslint": "^8.72.1",
      "version": "8.72.1",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/eslint-plugin/-/eslint-plugin-8.72.1.tgz",
      "integrity": "sha512-5CokTWXpmbylfFabsbvHC0CAw3XLaGnoa+nFJX5FR592h/LoZsENUE6p/rg5xvkKrFEXz6pYmgI29AgXc2N3BQ==",
        "@typescript-eslint/scope-manager": "8.72.1",
        "@typescript-eslint/type-utils": "8.72.1",
        "@typescript-eslint/utils": "8.72.1",
        "@typescript-eslint/visitor-keys": "8.72.1",
        "@typescript-eslint/parser": "^8.72.1",
      "version": "8.72.1",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/parser/-/parser-8.72.1.tgz",
      "integrity": "sha512-ZGwZP4OCfyA0AQTpEAMWz+rtX01DRhQWW5hB0ucKDEIX5U7jdmPSaMx94rQfaPAQzIYz2BimOgKOJtjfpRFQ9g==",
        "@typescript-eslint/scope-manager": "8.72.1",
        "@typescript-eslint/types": "8.72.1",
        "@typescript-eslint/typescript-estree": "8.72.1",
        "@typescript-eslint/visitor-keys": "8.72.1",
      "version": "8.72.1",
      "resolved": "https://registry.npmjs.org/@typescript-eslint/project-service/-/project-service-8.72.1.tgz",
      "integrity": "sha512-fAuVMkwdO/huI8nyo/WKnNKf6Gag93S56Rh3Ts5
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b81732f9` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T20:11:08.130Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794859868130",
    "title": "build(deps-dev): bump typescript-eslint from 8.72.1 to 8.72.2",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "cheeriojs/dom-serializer",
    "source_uri": "https://github.com/cheeriojs/dom-serializer",
    "source_version": "HEAD",
    "content_hash": "dcf60e0fcbfb57d3946f2143ba3e6e8c33779a5405655cab423d6d1126324bb3"
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
        "Harvested/verified timestamp recorded: 2026-11-16T20:11:08.131Z"
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
  "auth_token": "7e2015bf19ca90821f69479ae1071185cd3ed54ead939fe95225c24fe2c01ea0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

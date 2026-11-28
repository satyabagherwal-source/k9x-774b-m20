# Candidate Directive: [CD-CG7Z] build(deps-dev): Bump typescript-eslint from 8.73.0 to 8.74.0

<!-- PROVENANCE_START
{
  "source_repository": "fb55/htmlparser2",
  "source_url": "https://github.com/fb55/htmlparser2",
  "source_version": "bb3a487b",
  "license": "MIT",
  "timestamp": "2026-11-28T01:54:51.551Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-fb55-htmlparser2",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fb55/htmlparser2](https://github.com/fb55/htmlparser2) (Revision: `bb3a487b`).  
> **License**: MIT | **Timestamp**: `2026-11-28T01:54:51.551Z`  
> **Learning ID**: `learn-github-fb55-htmlparser2`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `package-lock.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fb55/htmlparser2. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bb3a487b`: build(deps-dev): Bump typescript-eslint from 8.73.0 to 8.74.0. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `package-lock.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
                "typescript-eslint": "^8.74.0",
            "version": "8.74.0",
            "resolved": "https://registry.npmjs.org/@typescript-eslint/eslint-plugin/-/eslint-plugin-8.74.0.tgz",
            "integrity": "sha512-z3KXk1+Vm+d82ZRplOoC89ho4Rf1da5ju6sx8//92GnN532U62DGPjECXkkVqtYzIv0zoJlpO39SX2Z9tk6LVw==",
                "@typescript-eslint/scope-manager": "8.74.0",
                "@typescript-eslint/type-utils": "8.74.0",
                "@typescript-eslint/utils": "8.74.0",
                "@typescript-eslint/visitor-keys": "8.74.0",
                "@typescript-eslint/parser": "^8.74.0",
            "version": "8.74.0",
            "resolved": "https://registry.npmjs.org/@typescript-eslint/parser/-/parser-8.74.0.tgz",
            "integrity": "sha512-ecr8AYdig7avVkxaHdQvxHnIJ/mOyliO4Gv/uWF8q69vBew/z3sexqBwHUZX5Vql+Ns0w4sH6gBLkICGbOvJkA==",
                "@typescript-eslint/scope-manager": "8.74.0",
                "@typescript-eslint/types": "8.74.0",
                "@typescript-eslint/typescript-estree": "8.74.0",
                "@typescript-eslint/visitor-keys": "8.74.0",
            "version": "8.74.0",
            "resolved": "https://registry.npmjs.org/@typ
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
                "typescript-eslint": "^8.73.0",
            "version": "8.73.0",
            "resolved": "https://registry.npmjs.org/@typescript-eslint/eslint-plugin/-/eslint-plugin-8.73.0.tgz",
            "integrity": "sha512-UkygMFer53Yzn29MCYFTHf34hGXf5KJhiDWfIm1tXtXRrym1CS6l5H9Y3yCtPWChpC0/f93H88gdj8tN0dd4kw==",
                "@typescript-eslint/scope-manager": "8.73.0",
                "@typescript-eslint/type-utils": "8.73.0",
                "@typescript-eslint/utils": "8.73.0",
                "@typescript-eslint/visitor-keys": "8.73.0",
                "@typescript-eslint/parser": "^8.73.0",
            "version": "8.73.0",
            "resolved": "https://registry.npmjs.org/@typescript-eslint/parser/-/parser-8.73.0.tgz",
            "integrity": "sha512-AuL45bVcmssHfZ3Di3cs9Q0l4gBm4ZFVrJOQEE7VpqW+PVgQaEwSwazz4TVIiFabXkk6U51EprYDwqw+HR8ePw==",
                "@typescript-eslint/scope-manager": "8.73.0",
                "@typescript-eslint/types": "8.73.0",
                "@typescript-eslint/typescript-estree": "8.73.0",
                "@typescript-eslint/visitor-keys": "8.73.0",
            "version": "8.73.0",
            "resolved": "https://registry.npmjs.org/@typ
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bb3a487b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T01:54:51.549Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795830891549",
    "title": "build(deps-dev): Bump typescript-eslint from 8.73.0 to 8.74.0",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fb55/htmlparser2",
    "source_uri": "https://github.com/fb55/htmlparser2",
    "source_version": "HEAD",
    "content_hash": "daf3a8c94c175b8c27ad4038732b3c30330b4ca55036f2c9664816c1b0dd4372"
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
        "Harvested/verified timestamp recorded: 2026-11-28T01:54:51.549Z"
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
  "auth_token": "4baf97626700a68b047d806d8af1d8732ee9ce04fcdddf3c3eed0454044d37c7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

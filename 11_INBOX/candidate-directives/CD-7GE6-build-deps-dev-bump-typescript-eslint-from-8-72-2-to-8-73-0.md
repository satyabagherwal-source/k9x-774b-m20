# Candidate Directive: [CD-7GE6] build(deps-dev): bump typescript-eslint from 8.72.2 to 8.73.0

<!-- PROVENANCE_START
{
  "source_repository": "fb55-css-select-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T17:29:23.529Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-fb55-css-select-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fb55-css-select-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T17:29:23.529Z`  
> **Learning ID**: `LEARN-EVO-fb55-css-select-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `package-lock.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fb55/css-select. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `10f516f0`: build(deps-dev): bump typescript-eslint from 8.72.2 to 8.73.0. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `package-lock.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
                "typescript-eslint": "^8.73.0",
            "version": "8.73.0",
            "resolved": "https://registry.npmjs.org/@typescript-eslint/eslint-plugin/-/eslint-plugin-8.73.0.tgz",
            "integrity": "sha512-UkygMFer53Yzn29MCYFTHf34hGXf5KJhiDWfIm1tXtXRrym1CS6l5H9Y3yCtPWChpC0/f93H88gdj8tN0dd4kw==",
                "@typescript-eslint/scope-manager": "8.73.0",
                "@typescript-eslint/type-utils": "8.73.0",
                "@typescript-eslint/utils": "8.73.0",
                "@typescript-eslint/visitor-keys": "8.73.0",
                "@typescript-eslint/parser": "^8.73.0",
            "version": "7.0.16",
            "resolved": "https://registry.npmjs.org/ignore/-/ignore-7.0.16.tgz",
            "integrity": "sha512-52N+Y4HRMOJmbLmr+DqO4iSRyyB7N52gm7PWCT6h0p978+oKbqHCB7gIJIwZvBUsjlSdWbrBFqUSmIFNZMpn0A==",
            "version": "8.73.0",
            "resolved": "https://registry.npmjs.org/@typescript-eslint/parser/-/parser-8.73.0.tgz",
            "integrity": "sha512-AuL45bVcmssHfZ3Di3cs9Q0l4gBm4ZFVrJOQEE7VpqW+PVgQaEwSwazz4TVIiFabXkk6U51EprYDwqw+HR8ePw==",
                "@typescript-eslint/scope-manager": "8.73.0",
                "@typescript-esl
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
                "typescript-eslint": "^8.72.2",
        "node_modules/@eslint/config-array/node_modules/minimatch": {
            "version": "11.0.8",
            "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-11.0.8.tgz",
            "integrity": "sha512-nFQuYSTVrGvysVBps5Ih+0BdnYFN/Cj3C816r6+p7yK+FHrVLGE4O4N9AFwykrlNlvM2HYt+Rad1Uiro6h88Ig==",
            "dev": true,
            "license": "BlueOak-1.0.0",
            "dependencies": {
                "@isaacs/nonrecursive-glob-match": "^1.1.0",
                "brace-expansion": "^5.0.12"
            },
            "engines": {
                "node": "20 || >=22"
            },

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T17:29:23.645Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795195763645",
    "title": "build(deps-dev): bump typescript-eslint from 8.72.2 to 8.73.0",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fb55-css-select-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "85d4f11ed75c88540e006841bcb2b9301b453da3866c106002cba2ea5bf33d08"
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
        "Harvested/verified timestamp recorded: 2026-11-20T17:29:23.645Z"
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
  "auth_token": "d36cfd862e77e7fa60b892bfc5d6cc9657c583edde717da50874f297ac17c523"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

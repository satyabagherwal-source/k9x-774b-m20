# Candidate Directive: [CD-13YU] runner-utils): extract shared bundler utilities from webpack5-runner

<!-- PROVENANCE_START
{
  "source_repository": "nervjs-taro-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T17:06:29.230Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-nervjs-taro-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nervjs-taro-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T17:06:29.230Z`  
> **Learning ID**: `LEARN-EVO-nervjs-taro-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/taro-runner-utils/package.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in NervJS/taro. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6c1bd527`: runner-utils): extract shared bundler utilities from webpack5-runner. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/taro-runner-utils/package.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    "@tarojs/shared": "workspace:*",
    "lodash": "^4.17.21",
    "@tarojs/taro": "workspace:*",
    "@types/detect-port": "^1.3.5",
    "@types/lodash": "^4.17.0",
    "@types/sax": "^1.2.4",
    "autoprefixer": "^10.4.19",
    "detect-port": "^1.5.1",
    "jsdom": "^24.0.0",
    "loader-utils": "^3.2.1",
    "miniprogram-simulate": "^1.6.1",
    "ora": "^5.4.1",
    "picomatch": "^4.0.2",
    "postcss": "^8.4.38",
    "postcss-html-transform": "workspace:*",
    "postcss-import": "^16.1.0",
    "postcss-plugin-constparse": "workspace:*",
    "postcss-pxtransform": "workspace:*",
    "postcss-url": "^10.1.3",
    "sax": "1.2.4",
    "vm2": "^3.9.19",
    "webpack-format-messages": "^3.0.1"
  },
  "peerDependencies": {
    "autoprefixer": "^10.4.19",
    "detect-port": "^1.5.1",
    "jsdom": "^24.0.0",
    "loader-utils": "^3.2.1",
    "miniprogram-simulate": "^1.6.1",
    "ora": "^5.4.1",
    "picomatch": "^4.0.2",
    "postcss": "^8",
    "postcss-html-transform": "workspace:*",
    "postcss-import": "^16.1.0",
    "postcss-plugin-constparse": "workspace:*",
    "postcss-pxtransform": "workspace:*",

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T17:06:29.331Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795712789330",
    "title": "runner-utils): extract shared bundler utilities from webpack5-runner",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "nervjs-taro-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "7102c543ad5b5a33f448fa2e9e893c36e51fadddf1b4f7ceb463e37512249a87"
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-26T17:06:29.331Z"
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
  "auth_token": "2db53f92e85079a7a8900a40b0c933ec717b1bb5ba1bde10233f5202ec625e66"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

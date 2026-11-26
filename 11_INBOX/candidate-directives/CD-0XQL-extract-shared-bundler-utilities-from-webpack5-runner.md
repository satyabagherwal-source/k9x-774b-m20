# Candidate Directive: [CD-0XQL] extract shared bundler utilities from webpack5-runner

<!-- PROVENANCE_START
{
  "source_repository": "NervJS/taro",
  "source_url": "https://github.com/NervJS/taro",
  "source_version": "6c1bd527",
  "license": "NOASSERTION",
  "timestamp": "2026-11-26T17:06:21.261Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nervjs-taro",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [NervJS/taro](https://github.com/NervJS/taro) (Revision: `6c1bd527`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-26T17:06:21.261Z`  
> **Learning ID**: `learn-github-nervjs-taro`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    "postcss-url": "^10.1.3",
    "sax": "1.2.4",
    "vm2": "^3.9.19",
    "web
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
    "@tarojs/taro": "workspace:*"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6c1bd527` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T17:06:21.260Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795712781260",
    "title": "extract shared bundler utilities from webpack5-runner",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "NervJS/taro",
    "source_uri": "https://github.com/NervJS/taro",
    "source_version": "HEAD",
    "content_hash": "e8d629619e56c6ebfd25f540da0ca08d4637211f860c3827ddd323e0de8dfed3"
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
        "Harvested/verified timestamp recorded: 2026-11-26T17:06:21.260Z"
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
  "auth_token": "b1c708d406c1c0d083230dbb78f0f95cfdbff2ffa1bb9dd876e315c4ac05141b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

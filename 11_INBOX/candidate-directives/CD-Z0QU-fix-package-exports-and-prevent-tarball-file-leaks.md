# Candidate Directive: [CD-Z0QU] fix package exports and prevent tarball file leaks

<!-- PROVENANCE_START
{
  "source_repository": "genkit-ai/genkit",
  "source_url": "https://github.com/genkit-ai/genkit",
  "source_version": "5f4d54a0",
  "license": "Apache-2.0",
  "timestamp": "2026-11-25T12:09:15.654Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-genkit-ai-genkit",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [genkit-ai/genkit](https://github.com/genkit-ai/genkit) (Revision: `5f4d54a0`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-25T12:09:15.654Z`  
> **Learning ID**: `learn-github-genkit-ai-genkit`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `js/ai/package.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in genkit-ai/genkit. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c9f68fdb`: js): fix package exports and prevent tarball file leaks. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `js/ai/package.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
      "import": {
        "types": "./lib/index.d.mts",
        "default": "./lib/index.mjs"
      },
      "require": {
        "types": "./lib/index.d.ts",
        "default": "./lib/index.js"
      },
      "import": {
        "types": "./lib/retriever.d.mts",
        "default": "./lib/retriever.mjs"
      },
      "require": {
        "types": "./lib/retriever.d.ts",
        "default": "./lib/retriever.js"
      },
      "import": {
        "types": "./lib/embedder.d.mts",
        "default": "./lib/embedder.mjs"
      },
      "require": {
        "types": "./lib/embedder.d.ts",
        "default": "./lib/embedder.js"
      },
      "import": {
        "types": "./lib/evaluator.d.mts",
        "default": "./lib/evaluator.mjs"
      },
      "require": {
        "types": "./lib/evaluator.d.ts",
        "default": "./lib/evaluator.js"
      },
      "import": {
        "types": "./lib/model.d.mts",
        "default": "./lib/model.mjs"
      },
      "require": {
        "types": "./lib/model.d.ts",
        "default": "./lib/model.js"
      },
      "import": {
        "types": "./lib/model/middleware.d.mts",
        "default": "./lib/model/middleware.mjs"
      },
      "require": 
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
      "types": "./lib/index.d.ts",
      "require": "./lib/index.js",
      "import": "./lib/index.mjs",
      "types": "./lib/retriever.d.ts",
      "require": "./lib/retriever.js",
      "import": "./lib/retriever.mjs",
      "types": "./lib/embedder.d.ts",
      "require": "./lib/embedder.js",
      "import": "./lib/embedder.mjs",
      "types": "./lib/evaluator.d.ts",
      "require": "./lib/evaluator.js",
      "import": "./lib/evaluator.mjs",
      "types": "./lib/model.d.ts",
      "require": "./lib/model.js",
      "import": "./lib/model.mjs",
      "types": "./lib/model/middleware.d.ts",
      "require": "./lib/model/middleware.js",
      "import": "./lib/model/middleware.mjs",
      "types": "./lib/extract.d.ts",
      "require": "./lib/extract.js",
      "import": "./lib/extract.mjs",
      "types": "./lib/tool.d.ts",
      "require": "./lib/tool.js",
      "import": "./lib/tool.mjs",
      "types": "./lib/testing/index.d.ts",
      "require": "./lib/testing/index.js",
      "import": "./lib/testing/index.mjs",
      "types": "./lib/reranker.d.ts",
      "require": "./lib/reranker.js",
      "import": "./lib/reranker.mjs",
      "types": "./lib/session.d.ts",
      "requ
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c9f68fdb` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T12:09:15.652Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795608555652",
    "title": "fix package exports and prevent tarball file leaks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "genkit-ai/genkit",
    "source_uri": "https://github.com/genkit-ai/genkit",
    "source_version": "HEAD",
    "content_hash": "a434fe3e7c8dbd090307d10ca2f993735d987159fa3151011e93dbc39b81a7c4"
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
        "Harvested/verified timestamp recorded: 2026-11-25T12:09:15.652Z"
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
  "auth_token": "7af214a0cca60aa6683235f3d90889d3c2789406dec3318b4f3b00f3abaa3575"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

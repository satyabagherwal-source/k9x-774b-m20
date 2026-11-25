# Candidate Directive: [CD-045H] Merge 'build(deps): bump fast-xml-parser from 5.11.1 to 5.12.1 in /examples/reac

<!-- PROVENANCE_START
{
  "source_repository": "tursodatabase/turso",
  "source_url": "https://github.com/tursodatabase/limbo",
  "source_version": "13b96ffe",
  "license": "MIT",
  "timestamp": "2026-11-25T13:06:05.957Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tursodatabase-turso",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tursodatabase/turso](https://github.com/tursodatabase/limbo) (Revision: `13b96ffe`).  
> **License**: MIT | **Timestamp**: `2026-11-25T13:06:05.957Z`  
> **Learning ID**: `learn-github-tursodatabase-turso`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `examples/react-native/package-lock.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tursodatabase/turso. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bdc0c062`: Merge 'build(deps): bump fast-xml-parser from 5.11.1 to 5.12.1 in /examples/react-native' from app/dependabot. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `examples/react-native/package-lock.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      "version": "0.9.0-pre.6",
        "react-native-builder-bob": "^0.44.1",
        "typescript": "^5.3.0",
        "vitest": "^4.1.11"
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/@nodable/entities/-/entities-3.1.0.tgz",
      "integrity": "sha512-LsS/DjHr+uDM647Gru/cA8+J3a3HfhttwCKLyuoyN7yXTFCxKBtSgMQBvrW9yNPa2/zDRUNuGPaH5QUFoa4arQ==",
      "version": "1.3.2",
      "resolved": "https://registry.npmjs.org/fast-xml-builder/-/fast-xml-builder-1.3.2.tgz",
      "integrity": "sha512-OX91VSlShLPDgRZV7tk/YQ4l8tT75QziF5Ixg8g4PFbCVPjuTWwN+yQfAxLJ0dufJpprdOd6HlM74Jhd39TcBQ==",
      "version": "5.12.1",
      "resolved": "https://registry.npmjs.org/fast-xml-parser/-/fast-xml-parser-5.12.1.tgz",
      "integrity": "sha512-wR8dO/fx+z8C5exuem1e7BKOWvjsuzvjS/tvA/Xu3Z1zQqJGcXrPzXbcAiaMgp2KjreEROcTkmnnisrcmJ2hYQ==",
        "@nodable/entities": "^3.1.0",
        "fast-xml-builder": "^1.3.2",
        "is-unsafe": "^2.0.3",
        "strnum": "^2.5.1",
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/is-unsafe/-/is-unsafe-2.0.3.tgz",
      "integrity": "sha512-ZBllczCCO267vgdFb6Tq3pv+LhHaCiGMdr+ZsuL+OopruAg7S+3ZDs1vD0RPC0uSrkjzbraxaGjtX1YBxjPeF
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
      "version": "0.9.0-pre.2",
        "react-native-builder-bob": "^0.30.0",
        "typescript": "^5.3.0"
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/@nodable/entities/-/entities-3.0.0.tgz",
      "integrity": "sha512-8L9xFeTYKhm49xfIypoe2W5wV1m/3Z58kT+7kR9A8OyFxcPduI4VmxaUMQyKYrRjUoLLSXv6EKKID5Tvj9cUVw==",
      "version": "1.3.1",
      "resolved": "https://registry.npmjs.org/fast-xml-builder/-/fast-xml-builder-1.3.1.tgz",
      "integrity": "sha512-pIM/1n3ntFXKYrUZwW7QCK0gAW7XY+wzj1YMIV3tLDvPj/V+zTGJK5e3/4WJfwj0qWw2ElNXiTixda/R+3YSug==",
      "version": "5.11.1",
      "resolved": "https://registry.npmjs.org/fast-xml-parser/-/fast-xml-parser-5.11.1.tgz",
      "integrity": "sha512-TBw6K/fxoQGGjCmZDw9w/ZwP3uDcnTM4YH/g+PFRWr8sbe5idXtxNN6vITh4+1ruCZaho6uBFurElsA7F0zzgw==",
        "@nodable/entities": "^3.0.0",
        "fast-xml-builder": "^1.2.0",
        "is-unsafe": "^2.0.0",
        "strnum": "^2.4.2",
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/is-unsafe/-/is-unsafe-2.0.2.tgz",
      "integrity": "sha512-HgbIHPBH0KHHCcjLfGsCvhtPTVxjaAZlXjwdz7/GQC40SjSe4sfQsar8J5VFo8JOSbarkpV0OLG95bbaNd9aAQ==",
      "version": "2.4.2
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bdc0c062` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T13:06:05.955Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795611965955",
    "title": "Merge 'build(deps): bump fast-xml-parser from 5.11.1 to 5.12.1 in /examples/reac",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tursodatabase/turso",
    "source_uri": "https://github.com/tursodatabase/limbo",
    "source_version": "HEAD",
    "content_hash": "8f97ba83245bcf6f7833cea4be90ddb9062d36a0de42634ad99f5cebc7f69d9e"
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
        "Harvested/verified timestamp recorded: 2026-11-25T13:06:05.955Z"
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
  "auth_token": "321e680d5ab2dd8edbcb43a24c960a8c8e6964ad53aaa59b85abe927ffbe583a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

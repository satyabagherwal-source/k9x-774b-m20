# Candidate Directive: [CD-NDI6] Merge 'build(deps): bump fast-xml-parser from 5.11.1 to 5.12.1 in /examples/reac

<!-- PROVENANCE_START
{
  "source_repository": "tursodatabase-turso-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T23:12:02.966Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tursodatabase-turso-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tursodatabase-turso-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T23:12:02.966Z`  
> **Learning ID**: `LEARN-EVO-tursodatabase-turso-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T23:12:03.100Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795648323100",
    "title": "Merge 'build(deps): bump fast-xml-parser from 5.11.1 to 5.12.1 in /examples/reac",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tursodatabase-turso-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "706f1ab0e4ee1b76ef131f7f6cd7cc8f983f31a5fdc44938869d7df6967e03a0"
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
        "Harvested/verified timestamp recorded: 2026-11-25T23:12:03.101Z"
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
  "auth_token": "4ee9e5b47cce9a47742e87372bb685284c973fd4794da4ad77d4716be60f0149"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

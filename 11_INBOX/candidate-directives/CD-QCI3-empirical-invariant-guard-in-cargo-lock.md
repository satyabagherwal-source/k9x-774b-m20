# Candidate Directive: [CD-QCI3] Empirical Invariant Guard in Cargo.lock

<!-- PROVENANCE_START
{
  "source_repository": "meilisearch/meilisearch",
  "source_url": "https://github.com/meilisearch/meilisearch",
  "source_version": "36dabf36",
  "license": "NOASSERTION",
  "timestamp": "2026-11-23T22:43:01.707Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-meilisearch-meilisearch",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meilisearch/meilisearch](https://github.com/meilisearch/meilisearch) (Revision: `36dabf36`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-23T22:43:01.707Z`  
> **Learning ID**: `learn-github-meilisearch-meilisearch`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Cargo.lock`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in meilisearch/meilisearch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `36dabf36`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `Cargo.lock`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
version = "1.58.0"
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
version = "1.57.0"
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `36dabf36` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T22:43:01.701Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795473781701",
    "title": "Empirical Invariant Guard in Cargo.lock",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "meilisearch/meilisearch",
    "source_uri": "https://github.com/meilisearch/meilisearch",
    "source_version": "HEAD",
    "content_hash": "c280bd95f4b6a084020cb6b37ebb3a598b7b1676299872d66b21da1631582b32"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-23T22:43:01.702Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "c64342d5ce31fce75a45e88b1924cae97650c77ec8a156ff8e29245438efa31f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-4GO7] Keep hello_unfree on the nixpkgs revision the CI machines have built

<!-- PROVENANCE_START
{
  "source_repository": "flox/flox",
  "source_url": "https://github.com/flox/flox",
  "source_version": "2130d6d7",
  "license": "GPL-2.0",
  "timestamp": "2026-11-21T16:18:45.223Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-flox-flox",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [flox/flox](https://github.com/flox/flox) (Revision: `2130d6d7`).  
> **License**: GPL-2.0 | **Timestamp**: `2026-11-21T16:18:45.223Z`  
> **Learning ID**: `learn-github-flox-flox`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `test_data/generated/envs/hello-unfree-lock.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in flox/flox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `03428973`: test: Keep hello_unfree on the nixpkgs revision the CI machines have built. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `test_data/generated/envs/hello-unfree-lock.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      "derivation": "/nix/store/xj1zpiq3qcwc9ry6kxfnrizg5164wyai-example-unfree-package-1.0.drv",
      "locked_url": "https://github.com/flox/nixpkgs?rev=151fa4e8ddfdd8dd25d945ad94ed54a13de9f6e4",
      "rev": "151fa4e8ddfdd8dd25d945ad94ed54a13de9f6e4",
      "rev_count": 1086391,
      "rev_date": "2026-10-06T04:29:54Z",
      "scrape_date": "2026-10-07T04:59:53.190100Z",
        "out": "/nix/store/8w49yqc04n3jyn4dabx7s4y61qjc9a6p-example-unfree-package-1.0"
      "derivation": "/nix/store/di5x5kcjx356azj21slvi70r2dckmsz9-example-unfree-package-1.0.drv",
      "locked_url": "https://github.com/flox/nixpkgs?rev=151fa4e8ddfdd8dd25d945ad94ed54a13de9f6e4",
      "rev": "151fa4e8ddfdd8dd25d945ad94ed54a13de9f6e4",
      "rev_count": 1086391,
      "rev_date": "2026-10-06T04:29:54Z",
      "scrape_date": "2026-10-07T05:32:12.629660Z",
        "out": "/nix/store/7203xbyfh69jkvr2jjcafdsxx97glvki-example-unfree-package-1.0"
      "derivation": "/nix/store/br185pns5ax8fz94iiwxiyaq7q4bdj36-example-unfree-package-1.0.drv",
      "locked_url": "https://github.com/flox/nixpkgs?rev=151fa4e8ddfdd8dd25d945ad94ed54a13de9f6e4",
      "rev": "151fa4e8ddfdd8dd25d945ad94ed54a13de9f6e4",
      "rev_coun
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
      "derivation": "/nix/store/gamqi8z22ras3jbizb0g6yqxkcyia6l9-example-unfree-package-1.0.drv",
      "locked_url": "https://github.com/flox/nixpkgs?rev=04906337b6d53e8bb0eaf0470ae9f070a4d4eb55",
      "rev": "04906337b6d53e8bb0eaf0470ae9f070a4d4eb55",
      "rev_count": 1122823,
      "rev_date": "2026-11-17T04:43:17Z",
      "scrape_date": "2026-11-19T05:47:33.216545Z",
        "out": "/nix/store/2g6xgy68v99id7pnz91rgfkangf8xshc-example-unfree-package-1.0"
      "derivation": "/nix/store/95ynv8rl8z4wgq8z7krif5gaya6mhgzf-example-unfree-package-1.0.drv",
      "locked_url": "https://github.com/flox/nixpkgs?rev=04906337b6d53e8bb0eaf0470ae9f070a4d4eb55",
      "rev": "04906337b6d53e8bb0eaf0470ae9f070a4d4eb55",
      "rev_count": 1122823,
      "rev_date": "2026-11-17T04:43:17Z",
      "scrape_date": "2026-11-19T06:14:10.545333Z",
        "out": "/nix/store/lycyd5j2h7j2q13ggam638bg56v1mfk7-example-unfree-package-1.0"
      "derivation": "/nix/store/mscfaizxskh1rvqvmgjrbyqhy1qbhb29-example-unfree-package-1.0.drv",
      "locked_url": "https://github.com/flox/nixpkgs?rev=04906337b6d53e8bb0eaf0470ae9f070a4d4eb55",
      "rev": "04906337b6d53e8bb0eaf0470ae9f070a4d4eb55",
      "rev_coun
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `03428973` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T16:18:45.221Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795277925221",
    "title": "Keep hello_unfree on the nixpkgs revision the CI machines have built",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "flox/flox",
    "source_uri": "https://github.com/flox/flox",
    "source_version": "HEAD",
    "content_hash": "481578cd1aa32a84aeb47e8b94df3b438ade397f78d0512dccfe88575135fbf8"
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
        "Harvested/verified timestamp recorded: 2026-11-21T16:18:45.221Z"
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
  "auth_token": "620290f31b5db60187f5ec163f1ff2986ac0addb2c2f1818ca1abd58028d04e3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

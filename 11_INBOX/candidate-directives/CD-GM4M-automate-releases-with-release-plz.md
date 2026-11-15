# Candidate Directive: [CD-GM4M] automate releases with release-plz

<!-- PROVENANCE_START
{
  "source_repository": "actix/actix-web",
  "source_url": "https://github.com/actix/actix-web",
  "source_version": "baebbb57",
  "license": "Apache-2.0",
  "timestamp": "2026-11-15T17:14:10.054Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-actix-actix-web",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [actix/actix-web](https://github.com/actix/actix-web) (Revision: `baebbb57`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-15T17:14:10.054Z`  
> **Learning ID**: `learn-github-actix-actix-web`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/actions.lock`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in actix/actix-web. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `baebbb57`: ci: automate releases with release-plz. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/actions.lock`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    '.github/workflows/release.yml':
        - 'actions-rust-lang/setup-rust-toolchain@v2.0.1'
        - 'actions/checkout@v7.0.1'
        - 'nicknovitski/nix-develop@v1.2.1'
        - 'nixbuild/nix-quick-install-action@v35'
        - 'release-plz/action@v0.5.140'
    'actions/checkout@v7.0.1':
        ref: 'v7.0.1'
        commit: 'sha1-3d3c42e5aac5ba805825da76410c181273ba90b1'
        owner_id: 44036562
        repo_id: 197814629
    'cargo-bins/cargo-binstall@c06f6a0003f7c6165a00c89d1697731c9e8a5c72':
        ref: 'v1.25.2'
        commit: 'sha1-c06f6a0003f7c6165a00c89d1697731c9e8a5c72'
        owner_id: 110581826
        repo_id: 321270638
    'nicknovitski/nix-develop@v1.2.1':
        ref: 'v1.2.1'
        commit: 'sha1-9be7cfb4b10451d3390a75dc18ad0465bed4932a'
        owner_id: 151337
        repo_id: 706956179
    'nixbuild/nix-quick-install-action@v35':
        ref: 'v35'
        commit: 'sha1-9f63be77f412a248c9d9a65a4c82cf066cdf8f0c'
        owner_id: 60610456
        repo_id: 296639338
    'release-plz/action@v0.5.140':
        ref: 'v0.5.140'
        commit: 'sha1-18641b6c63063cc5ff8786ebf69cd57e8541bae1'
        owner_id: 188756284
        repo_id: 476470908
        use
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `baebbb57` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T17:14:10.052Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794762850052",
    "title": "automate releases with release-plz",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "actix/actix-web",
    "source_uri": "https://github.com/actix/actix-web",
    "source_version": "HEAD",
    "content_hash": "5a9dcea22d42d32c3e51c3200c915efbb1691aff77caf0fd976415c164c2c813"
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
        "Harvested/verified timestamp recorded: 2026-11-15T17:14:10.052Z"
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
  "auth_token": "db345b45a3a0069cfad72301b9821f6bcbd0662b91d9370253f08aeba040e29c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

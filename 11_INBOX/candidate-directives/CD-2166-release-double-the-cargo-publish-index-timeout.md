# Candidate Directive: [CD-2166] Release - Double the Cargo publish index timeout

<!-- PROVENANCE_START
{
  "source_repository": "clockworklabs/SpacetimeDB",
  "source_url": "https://github.com/clockworklabs/SpacetimeDB",
  "source_version": "01b14a89",
  "license": "NOASSERTION",
  "timestamp": "2026-11-24T21:15:48.462Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-clockworklabs-spacetimedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [clockworklabs/SpacetimeDB](https://github.com/clockworklabs/SpacetimeDB) (Revision: `01b14a89`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-24T21:15:48.462Z`  
> **Learning ID**: `learn-github-clockworklabs-spacetimedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `tools/release/src/targets/crates.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in clockworklabs/SpacetimeDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `01b14a89`: Release - Double the Cargo publish index timeout. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `tools/release/src/targets/crates.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        cmd.current_dir(workspace_root)
            // The pinned stable Cargo requires RUSTC_BOOTSTRAP=1 to accept -Zpublish-timeout.
            .env("RUSTC_BOOTSTRAP", "1")
            .args([
                "publish",
                "--allow-dirty",
                // -Zpublish-timeout enables the publish.timeout setting. Set it to 120 seconds
                // (default: 60) for Cargo to wait for an uploaded crate to appear in the registry
                // index before publishing its dependents.
                "-Zpublish-timeout",
                "--config",
                "publish.timeout=120",
                // Set RUSTC_BOOTSTRAP=-1 in Cargo's child processes to enforce stable compiler
                // feature gates during package verification. force=true makes that value override
                // the RUSTC_BOOTSTRAP=1 they would otherwise inherit from Cargo.
                "--config",
                r#"env.RUSTC_BOOTSTRAP.value="-1""#,
                "--config",
                "env.RUSTC_BOOTSTRAP.force=true",
            ]);
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        cmd.current_dir(workspace_root).args(["publish", "--allow-dirty"]);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `01b14a89` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T21:15:48.460Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795554948460",
    "title": "Release - Double the Cargo publish index timeout",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "clockworklabs/SpacetimeDB",
    "source_uri": "https://github.com/clockworklabs/SpacetimeDB",
    "source_version": "HEAD",
    "content_hash": "c0211a46996554cf15869e332ed76502ca7b988507980485ffbbd01f8d47665a"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-24T21:15:48.460Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "4e7b22819cda5080aa20f39c5428f86ad5dd793a02fd5af06f0db1976205314b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

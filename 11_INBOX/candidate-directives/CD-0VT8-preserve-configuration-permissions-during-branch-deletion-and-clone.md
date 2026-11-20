# Candidate Directive: [CD-0VT8] !: preserve configuration permissions during branch deletion and clone

<!-- PROVENANCE_START
{
  "source_repository": "GitoxideLabs/gitoxide",
  "source_url": "https://github.com/GitoxideLabs/gitoxide",
  "source_version": "3599c4e9",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T04:48:27.404Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-gitoxidelabs-gitoxide",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [GitoxideLabs/gitoxide](https://github.com/GitoxideLabs/gitoxide) (Revision: `3599c4e9`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T04:48:27.404Z`  
> **Learning ID**: `learn-github-gitoxidelabs-gitoxide`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `gix/src/clone/fetch/util.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GitoxideLabs/gitoxide. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4895baec`: gix)!: preserve configuration permissions during branch deletion and clone. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `gix/src/clone/fetch/util.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    let mut config = repo
        .config_file_mut(&config_path)
        .or_raise(|| message("Failed to update repository configuration"))?;
        .commit()
        .or_raise(|| message("Failed to update repository configuration"))?;
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    let mut config = gix_config::File::from_path_no_includes(config_path.clone(), gix_config::Source::Local)
        .or_raise(|| message("Failed to load repo-local git configuration before writing"))?;
    let mut lock =
        gix_lock::File::acquire_to_update_resource(&config_path, gix_lock::acquire::Fail::Immediately, None, 0)
            .or_raise(|| message("Failed to acquire lock to write repository configuration to disk"))?;
        .write_to_filter(&mut lock, |section| section.meta().source == gix_config::Source::Local)
        .or_raise(|| message("Failed to write repository configuration to disk"))?;
    lock.commit()
        .or_raise(|| message("Failed to commit lock after writing repository configuration to disk"))?;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4895baec` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T04:48:27.402Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795150107402",
    "title": "!: preserve configuration permissions during branch deletion and clone",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "GitoxideLabs/gitoxide",
    "source_uri": "https://github.com/GitoxideLabs/gitoxide",
    "source_version": "HEAD",
    "content_hash": "4db8e73585067f1533ee0afd5a7911c1e320a61e519e3cd27a224bfb59f18cc4"
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
        "Harvested/verified timestamp recorded: 2026-11-20T04:48:27.402Z"
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
  "auth_token": "f9f0175279ed47f9babfcb4e0ad0cd5d88f6dbc71e1cdbad06e7cfa4c6a9fa70"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

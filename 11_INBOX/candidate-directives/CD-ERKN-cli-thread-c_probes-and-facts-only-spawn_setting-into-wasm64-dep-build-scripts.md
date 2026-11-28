# Candidate Directive: [CD-ERKN] cli): thread c_probes and facts-only spawn_setting into wasm64 dep build scripts

<!-- PROVENANCE_START
{
  "source_repository": "indexable-inc-blaze-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T01:00:40.157Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-indexable-inc-blaze-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [indexable-inc-blaze-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T01:00:40.157Z`  
> **Learning ID**: `LEARN-EVO-indexable-inc-blaze-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/blaze-cli/src/engine_check.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in indexable-inc/blaze. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4b2cbc1f`: cli): thread c_probes and facts-only spawn_setting into wasm64 dep build scripts. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/blaze-cli/src/engine_check.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        let checked = check_live(cx, fs, host, rng, Some(args), net, root, check_opts, &mut shown, phases, out, err, None, Some(&lazy_sdk), None, None, crate::store::StoreTeardown::Drop)?;
                        let res = check_live(cx, fs, host, rng, Some(args), net, root, opts(), &mut shown, phases, out, err, live, Some(&lazy_sdk), None, None, crate::store::StoreTeardown::ForgetForExit);
                    let mut ask = |mut shown| check_live(cx, fs, host, rng, Some(args), net, root, opts(), &mut shown, phases, out, err, None, Some(&lazy_sdk), None, None, crate::store::StoreTeardown::Drop).map(|checked| (checked, shown));
    /// Check-time command probes (`SharedCommandProbes`) carried into start-time proc-macro
    /// runners (`RunProcs`) so `run`/`test`/`export` reuse the exact probe/pin snapshot that
    /// keyed and produced the `MacroModule` records.
    probes: &'r crate::scripts::SharedCommandProbes,
}

/// Borrowed lazy macOS SDK handle handed to start-time proc-macro runners (`RunProcs`) so
/// `run`/`test`/`export` resolve the exact same SDK identity snapshot as `check` on first
/// proc-macro demand (0 ms cost on pure-Rust starts) without borrowing `Standing::stor
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        let checked = check_live(cx, fs, host, rng, Some(args), net, root, check_opts, &mut shown, phases, out, err, None, Some(&lazy_sdk), None, crate::store::StoreTeardown::Drop)?;
                        let res = check_live(cx, fs, host, rng, Some(args), net, root, opts(), &mut shown, phases, out, err, live, Some(&lazy_sdk), None, crate::store::StoreTeardown::ForgetForExit);
                    let mut ask = |mut shown| check_live(cx, fs, host, rng, Some(args), net, root, opts(), &mut shown, phases, out, err, None, Some(&lazy_sdk), None, crate::store::StoreTeardown::Drop).map(|checked| (checked, shown));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4b2cbc1f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T01:00:40.338Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795827640338",
    "title": "cli): thread c_probes and facts-only spawn_setting into wasm64 dep build scripts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "indexable-inc-blaze-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9fad28ab2395dcdeede0677af1352dad1689177eeaaa1e741a4cdb48039fca05"
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
        "Harvested/verified timestamp recorded: 2026-11-28T01:00:40.339Z"
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
  "auth_token": "2d13f3623705b6a058092806a327763b641ce9424f8dee648b23370846837560"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

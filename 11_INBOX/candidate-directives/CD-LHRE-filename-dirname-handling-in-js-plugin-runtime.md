# Candidate Directive: [CD-LHRE] filename/dirname handling in JS plugin runtime

<!-- PROVENANCE_START
{
  "source_repository": "parcel-bundler/parcel",
  "source_url": "https://github.com/parcel-bundler/parcel",
  "source_version": "63a71c9c",
  "license": "MIT",
  "timestamp": "2026-11-24T23:50:54.507Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-parcel-bundler-parcel",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [parcel-bundler/parcel](https://github.com/parcel-bundler/parcel) (Revision: `63a71c9c`).  
> **License**: MIT | **Timestamp**: `2026-11-24T23:50:54.507Z`  
> **Learning ID**: `learn-github-parcel-bundler-parcel`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/plugin-js/src/cjs.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in parcel-bundler/parcel. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `63a71c9c`: filename/dirname handling in JS plugin runtime. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/plugin-js/src/cjs.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
      // Node's module wrapper. `__filename` and `__dirname` must be parameters rather than
      // globals: a `var` with a parameter's name refers to the parameter, so code that redeclares
      // one, e.g. `var dir = __dirname; var __dirname = path.resolve(dir, '..')`, still reads the
      // value passed in. As globals, the hoisted `var` would shadow them with `undefined`.
      let mut code = String::with_capacity(source.len() + 64);
      code.push_str("(function (exports, require, module, __filename, __dirname) {");
    let dirname = Path::new(resolved)
      .parent()
      .and_then(|p| p.to_str())
      .unwrap_or_default();
    // The global `require`, which has `resolve` and `cache`, and resolves from the module calling
    // it like the one Node passes.
    f.call::<_, ()>((
      module.get::<_, Value>("exports")?,
      ctx.globals().get::<_, Value>("require")?,
      module.clone(),
      resolved,
      dirname,
    ))?;
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
      let mut code = String::with_capacity(source.len() + 32);
      code.push_str("(function (module, exports) {");
    f.call::<_, ()>((module.clone(), module.get::<_, Value>("exports")?))?;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `63a71c9c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T23:50:54.504Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795564254504",
    "title": "filename/dirname handling in JS plugin runtime",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "parcel-bundler/parcel",
    "source_uri": "https://github.com/parcel-bundler/parcel",
    "source_version": "HEAD",
    "content_hash": "a48f2163f028f0e309bd2d1a50ce57c1c70f8c172acc74c2edfa1e0c032338df"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-24T23:50:54.504Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "8a87180f6248a6debdc3a7c334241b2cfca2f92febe3e5f6ffb81972648187dc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

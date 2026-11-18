# Candidate Directive: [CD-L4FJ] retain hooks as inert bundle content

<!-- PROVENANCE_START
{
  "source_repository": "nolabs-ai/nono",
  "source_url": "https://github.com/nolabs-ai/nono",
  "source_version": "b3794a06",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T14:48:43.183Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nolabs-ai-nono",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nolabs-ai/nono](https://github.com/nolabs-ai/nono) (Revision: `b3794a06`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T14:48:43.183Z`  
> **Learning ID**: `learn-github-nolabs-ai-nono`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/nono-cli/src/profile/bundle.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nolabs-ai/nono. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b3794a06`: platform): retain hooks as inert bundle content. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/nono-cli/src/profile/bundle.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    resolve_extends_with,
    let mut profile = resolve_extends_with(root, &mut Vec::new(), 0, None, None, &mut loader)?;
    disable_hooks(&mut profile);
/// Delivered hook declarations and files are retained as authenticated content.
/// Keep them out of the runtime profile until managed hook execution and wiring
/// have their own activation contract. This never changes the signed sources.
fn disable_hooks(profile: &mut Profile) {
    profile.hooks = Default::default();
    profile.session_hooks = Default::default();
    if let Some(overrides) = &mut profile.platform_overrides {
        for item in [
            &mut overrides.macos,
            &mut overrides.linux,
            &mut overrides.windows,
        ]
        .into_iter()
        .flatten()
        {
            disable_hooks(&mut item.0);
        }
    }
}

    #[test]
    fn delivered_hooks_are_retained_in_sources_but_disabled_for_managed_launches() {
        let _lock = crate::test_env::ENV_LOCK.lock().expect("environment lock");
        let hooks = json!({"claude":{"event":"PreToolUse","matcher":"Bash","script":"hook.sh"}});
        let session_hooks = json!({
            "before":{"script":"$PACK_DIR/bin/before.s
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    resolve_extends_with, validate_delivered_profile,
        validate_delivered_profile(&raw)?;
    let profile = resolve_extends_with(root, &mut Vec::new(), 0, None, None, &mut loader)?;
    validate_delivered_profile(&profile)?;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b3794a06` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T14:48:43.181Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795013323181",
    "title": "retain hooks as inert bundle content",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "nolabs-ai/nono",
    "source_uri": "https://github.com/nolabs-ai/nono",
    "source_version": "HEAD",
    "content_hash": "ce78d9a395d71ab927235d9307f04c6bd6fd6f6ff5f8e724768a838de545e3e5"
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
        "Harvested/verified timestamp recorded: 2026-11-18T14:48:43.181Z"
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
  "auth_token": "949c859b96214185db192d01ee85115b7cf54a4b71e9f64f5cb9ea5519e63b1a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

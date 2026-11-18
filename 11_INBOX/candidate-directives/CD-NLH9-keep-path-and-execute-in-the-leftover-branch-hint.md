# Candidate Directive: [CD-NLH9] keep --path and --execute in the leftover-branch hint

<!-- PROVENANCE_START
{
  "source_repository": "max-sixty/worktrunk",
  "source_url": "https://github.com/max-sixty/worktrunk",
  "source_version": "af889698",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T11:06:41.661Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-max-sixty-worktrunk",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [max-sixty/worktrunk](https://github.com/max-sixty/worktrunk) (Revision: `af889698`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T11:06:41.661Z`  
> **Learning ID**: `learn-github-max-sixty-worktrunk`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/commands/worktree/switch.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in max-sixty/worktrunk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ecf8bcda`: switch): keep --path and --execute in the leftover-branch hint. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/commands/worktree/switch.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Wrap a [`GitError`] so its `wt switch` hint carries the invocation's
/// `--path`, `--execute`, and trailing args. Other errors pass through.
fn with_switch_suggestion(err: anyhow::Error, ctx: &SwitchSuggestionCtx) -> anyhow::Error {
    match err.downcast::<GitError>() {
        Ok(git_err) => GitError::WithSwitchSuggestion {
            source: Box::new(git_err),
            ctx: ctx.clone(),
        }
        .into(),
        Err(err) => err,
    }
}

                    Some(ref ctx) => with_switch_suggestion(err, ctx),
                    // A leftover branch's hint suggests `wt switch <branch>`;
                    // it needs the same flags as the `plan_switch` hints, or
                    // following it drops `--path` and `--execute`.
                    let leftover_hint = matches!(
                        failure.error.downcast_ref::<GitError>(),
                        Some(GitError::WorktreeCreationFailed { .. })
                    );
                    return Err(match &suggestion_ctx {
                        Some(ctx) if leftover_hint => with_switch_suggestion(failure.error, ctx),
                        _ => failure.error,
                    });
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                    Some(ref ctx) => match err.downcast::<GitError>() {
                        Ok(git_err) => GitError::WithSwitchSuggestion {
                            source: Box::new(git_err),
                            ctx: ctx.clone(),
                        }
                        .into(),
                        Err(err) => err,
                    },
                    return Err(failure.error);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ecf8bcda` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T11:06:41.659Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795000001659",
    "title": "keep --path and --execute in the leftover-branch hint",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "max-sixty/worktrunk",
    "source_uri": "https://github.com/max-sixty/worktrunk",
    "source_version": "HEAD",
    "content_hash": "6b4e51e0e258c55042d4b25e927800d662bd9a193c750b3ca2d3b8adc306d167"
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
        "Harvested/verified timestamp recorded: 2026-11-18T11:06:41.659Z"
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
  "auth_token": "7f1e8069a4fc504512c9897564ef0d01c92a784c3c01122118adac0dd4df0922"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-OG2B] prompt(selfdev): instruct agents to build and live-reload by default after code

<!-- PROVENANCE_START
{
  "source_repository": "1jehuang/jcode",
  "source_url": "https://github.com/1jehuang/jcode",
  "source_version": "d31f9cd9",
  "license": "MIT",
  "timestamp": "2026-11-27T18:08:17.747Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-1jehuang-jcode",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [1jehuang/jcode](https://github.com/1jehuang/jcode) (Revision: `d31f9cd9`).  
> **License**: MIT | **Timestamp**: `2026-11-27T18:08:17.747Z`  
> **Learning ID**: `learn-github-1jehuang-jcode`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/jcode-base/src/prompt/selfdev_mode.txt`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in 1jehuang/jcode. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `410425e6`: prompt(selfdev): instruct agents to build and live-reload by default after code changes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/jcode-base/src/prompt/selfdev_mode.txt`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
1. **Build and live-reload by default after making code changes** so the running session actually runs your new code (don't leave code changes unbuilt on disk unless the user asks not to reload or the change is docs/tests-only). Use `selfdev build-reload` to build and reload onto the new binary in one step (it waits for the build to finish and only reloads if it succeeds), or `selfdev build` when you only want to build without reloading. Both build actions require nonblank `release_notes` with concise highlights suitable for a public release. Keep private build reasons, reload context, and session details out of release notes. Before drafting notes, call `selfdev logs` and consider all changes bundled since the last published release, not just your own. Only write “No user-visible changes.” when the entire build has none.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
1. Prefer coordinated builds with `selfdev build`. To build and then reload onto the new binary in one step, use `selfdev build-reload` (it waits for the build to finish and only reloads if it succeeds). Both build actions require nonblank `release_notes` with concise highlights suitable for a public release. Keep private build reasons, reload context, and session details out of release notes. Before drafting notes, call `selfdev logs` and consider all changes bundled since the last published release, not just your own. Only write “No user-visible changes.” when the entire build has none.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `410425e6` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T18:08:17.745Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795802897745",
    "title": "prompt(selfdev): instruct agents to build and live-reload by default after code",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "1jehuang/jcode",
    "source_uri": "https://github.com/1jehuang/jcode",
    "source_version": "HEAD",
    "content_hash": "2d92fe9a4b2c23b641cc6218881213f9715e8c6fd7e294517dc4fe18a376d63f"
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
        "Harvested/verified timestamp recorded: 2026-11-27T18:08:17.745Z"
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
  "auth_token": "9916eff757a21bc4f4ef6bae67ee39e21c8321213d2b2aceb1ba990a549d80ac"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

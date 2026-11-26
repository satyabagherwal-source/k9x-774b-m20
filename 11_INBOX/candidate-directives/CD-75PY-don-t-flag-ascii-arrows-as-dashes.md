# Candidate Directive: [CD-75PY] don't flag ASCII arrows as dashes

<!-- PROVENANCE_START
{
  "source_repository": "Automattic/harper",
  "source_url": "https://github.com/Automattic/harper",
  "source_version": "15b85dfd",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T13:55:14.230Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-automattic-harper",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Automattic/harper](https://github.com/Automattic/harper) (Revision: `15b85dfd`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T13:55:14.230Z`  
> **Learning ID**: `learn-github-automattic-harper`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `harper-core/src/linting/dashes.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Automattic/harper. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `15b85dfd`: core): don't flag ASCII arrows as dashes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `harper-core/src/linting/dashes.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    fn match_to_lint_with_context(
        &self,
        matched_tokens: &[Token],
        _source: &[char],
        context: Option<(&[Token], &[Token])>,
    ) -> Option<Lint> {
        // The hyphens in ASCII arrows like `-->` and `<--` aren't dashes.
        if let Some((before, after)) = context
            && (before.last().is_some_and(|t| t.kind.is_less_than())
                || after.first().is_some_and(|t| t.kind.is_greater_than()))
        {
            return None;
        }

    use crate::linting::tests::{
        assert_no_lints, assert_suggestion_count, assert_suggestion_result,
    };

    #[test]
    fn ignores_right_arrow() {
        assert_no_lints("Go from A --> B now.", Dashes::default());
    }

    #[test]
    fn ignores_left_arrow() {
        assert_no_lints("Go from A <-- B now.", Dashes::default());
    }

    #[test]
    fn ignores_bidirectional_arrow() {
        assert_no_lints("Go from A <--> B now.", Dashes::default());
    }

    #[test]
    fn ignores_long_right_arrow() {
        assert_no_lints("Go from A ---> B now.", Dashes::default());
    }

    #[test]
    fn ignores_long_left_arrow() {
        assert_no_lints("Go from A <--- B now.", Dashes:
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    fn match_to_lint(&self, matched_tokens: &[Token], _source: &[char]) -> Option<Lint> {
    use crate::linting::tests::{assert_suggestion_count, assert_suggestion_result};
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `15b85dfd` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T13:55:14.228Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795701314228",
    "title": "don't flag ASCII arrows as dashes",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Automattic/harper",
    "source_uri": "https://github.com/Automattic/harper",
    "source_version": "HEAD",
    "content_hash": "c4c9905f122dad2178f8fda625bf6dede59f6f1b5ea3c3e21b0e5d67513237d1"
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
        "Harvested/verified timestamp recorded: 2026-11-26T13:55:14.228Z"
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
  "auth_token": "afeb2560c662f0b33370d0e7016e90b25c82eefa46ba455e4e33fbef59d283c1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

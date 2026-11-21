# Candidate Directive: [CD-PPLF] bound alternate nesting depth to prevent stack overflow

<!-- PROVENANCE_START
{
  "source_repository": "BurntSushi/ripgrep",
  "source_url": "https://github.com/BurntSushi/ripgrep",
  "source_version": "4e588dd8",
  "license": "Unlicense",
  "timestamp": "2026-11-21T11:55:20.403Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-burntsushi-ripgrep",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [BurntSushi/ripgrep](https://github.com/BurntSushi/ripgrep) (Revision: `4e588dd8`).  
> **License**: Unlicense | **Timestamp**: `2026-11-21T11:55:20.403Z`  
> **Learning ID**: `learn-github-burntsushi-ripgrep`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/globset/src/glob.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in BurntSushi/ripgrep. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `48242a71`: globset: bound alternate nesting depth to prevent stack overflow. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/globset/src/glob.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        // Bound alternate nesting so recursive token-to-regex compilation and
        // token tree drop cannot overflow the stack, while staying well within
        // regex-syntax's default group nesting limit (250).
        const MAX_ALTERNATES_DEPTH: usize = 100;
        if self.alternates_stack.len() >= MAX_ALTERNATES_DEPTH {
            return Err(self.error(ErrorKind::TooManyNestedAlternates));
        }
    #[test]
    fn nested_alternates_depth_limit() {
        let ok_pat = "{".repeat(100) + "a" + &"}".repeat(100);
        let matcher = Glob::new(&ok_pat).unwrap().compile_matcher();
        assert!(matcher.is_match("a"));
        assert!(!matcher.is_match("b"));

        let over_pat = "{".repeat(101) + "a" + &"}".repeat(101);
        let err = Glob::new(&over_pat).unwrap_err();
        assert_eq!(&ErrorKind::TooManyNestedAlternates, err.kind());

        let deep_pat = "{".repeat(14_000) + "a" + &"}".repeat(14_000);
        let err = Glob::new(&deep_pat).unwrap_err();
        assert_eq!(&ErrorKind::TooManyNestedAlternates, err.kind());
    }

```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `48242a71` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T11:55:20.401Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795262120401",
    "title": "bound alternate nesting depth to prevent stack overflow",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "BurntSushi/ripgrep",
    "source_uri": "https://github.com/BurntSushi/ripgrep",
    "source_version": "HEAD",
    "content_hash": "d63b255d359eb3bbe236e423bb86e123343e344c2aa152ac519c91d482915907"
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
        "Harvested/verified timestamp recorded: 2026-11-21T11:55:20.401Z"
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
  "auth_token": "3270cd44de4436420bcf53463728a91d9edfe4f496e89f1c1d54f779ed020a0c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

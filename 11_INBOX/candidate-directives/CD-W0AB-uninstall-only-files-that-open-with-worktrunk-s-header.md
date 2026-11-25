# Candidate Directive: [CD-W0AB] uninstall only files that open with worktrunk's header

<!-- PROVENANCE_START
{
  "source_repository": "max-sixty/worktrunk",
  "source_url": "https://github.com/max-sixty/worktrunk",
  "source_version": "5666a698",
  "license": "Apache-2.0",
  "timestamp": "2026-11-25T06:03:00.083Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-max-sixty-worktrunk",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [max-sixty/worktrunk](https://github.com/max-sixty/worktrunk) (Revision: `5666a698`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-25T06:03:00.083Z`  
> **Learning ID**: `learn-github-max-sixty-worktrunk`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/commands/configure_shell.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in max-sixty/worktrunk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f64e86b9`: shell): uninstall only files that open with worktrunk's header. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/commands/configure_shell.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// and which a user's own `wt.fish` / `wt.nu` would not open with.
const WRAPPER_MARKER: &str = "# worktrunk shell integration for";
/// Whether a fish completion file is one worktrunk generated: it opens with
/// [`COMPLETION_MARKER`].
fn is_worktrunk_completion_content(content: &str) -> bool {
    content.starts_with(COMPLETION_MARKER)
}

/// the same way. Every wrapper template worktrunk renders opens with the header,
    if content.starts_with(WRAPPER_MARKER) {
            scan_managed_files(&completions_dir, "fish", is_worktrunk_completion_content)?;
    #[test]
    fn test_completion_content_matches_only_a_file_opening_with_the_header() {
        assert!(is_worktrunk_completion_content(&fish_completion_content(
            "git-wt"
        )));
        assert!(!is_worktrunk_completion_content(
            "# my completions, after # worktrunk completions for fish\ncomplete -c foo\n"
        ));
    }

            // The header only marks a file worktrunk wrote where the file opens
            // with it; a user's file that quotes it further down is theirs.
            "function my_wt\n    # adapted from: # worktrunk shell integration for fish\n    command wt $argv\nend\n",
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
/// and which a user's own `wt.fish` / `wt.nu` would not carry.
const WRAPPER_MARKER: &str = "worktrunk shell integration for";
/// the same way. Every wrapper template worktrunk renders carries the header,
    if content.contains(WRAPPER_MARKER) {
            scan_managed_files(&completions_dir, "fish", |c| c.contains(COMPLETION_MARKER))?;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f64e86b9` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T06:03:00.081Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795586580081",
    "title": "uninstall only files that open with worktrunk's header",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "max-sixty/worktrunk",
    "source_uri": "https://github.com/max-sixty/worktrunk",
    "source_version": "HEAD",
    "content_hash": "89aca6c4a1366761fafa63bbd45c4ab863ea8408e05240f9e613a39dc6425c82"
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
        "Harvested/verified timestamp recorded: 2026-11-25T06:03:00.081Z"
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
  "auth_token": "2593bb0f7e10d7663e1a3ee532af3cb0d723bcf4df1a0adfe8c104fefc2caee0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

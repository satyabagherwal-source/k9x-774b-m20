# Candidate Directive: [CD-W81Z] shell): uninstall only files that open with worktrunk's header

<!-- PROVENANCE_START
{
  "source_repository": "max-sixty-worktrunk-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T06:03:10.010Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-max-sixty-worktrunk-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [max-sixty-worktrunk-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T06:03:10.010Z`  
> **Learning ID**: `LEARN-EVO-max-sixty-worktrunk-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T06:03:10.147Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795586590147",
    "title": "shell): uninstall only files that open with worktrunk's header",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "max-sixty-worktrunk-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "763fde9f83d7199b575922f2376cece7fff72296d0ef1526dc87ab0472ba96dd"
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
        "Harvested/verified timestamp recorded: 2026-11-25T06:03:10.147Z"
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
  "auth_token": "c4f5ae7bf603aef72b1cca00af38978fceeeeb52231771af949a6bdef6fc4cd6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

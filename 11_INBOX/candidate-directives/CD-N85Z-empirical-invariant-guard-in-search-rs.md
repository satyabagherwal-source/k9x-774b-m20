# Candidate Directive: [CD-N85Z] Empirical Invariant Guard in search.rs

<!-- PROVENANCE_START
{
  "source_repository": "rtk-ai-rtk-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T12:59:24.943Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-rtk-ai-rtk-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rtk-ai-rtk-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T12:59:24.943Z`  
> **Learning ID**: `LEARN-EVO-rtk-ai-rtk-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/cmds/system/search.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in rtk-ai/rtk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `16b02ac8`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/cmds/system/search.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                if recursion_set_by(engine, t, tokens) == Some(true) {
                    recursive = true;
                    if recursion_set_by(engine, c, tokens) == Some(true) {
                        recursive = true;
            &["-d", "read", "-d", "skip"][..],
    #[test]
    fn recursion_keeps_the_filename_default_under_a_later_directory_action() {
        for args in [
            &["-r", "-d", "read"][..],
            &["-r", "-d", "skip"][..],
            &["-R", "-d", "read"][..],
            &["-rd", "skip"][..],
            &["-rnd", "read"][..],
            &["--recursive", "--directories=read"][..],
            &["--dereference-recursive", "--directories", "skip"][..],
            &["-d", "recurse", "-d", "read"][..],
            &["-d", "recurse", "-d", "skip"][..],
        ] {
            let d = detected(args);
            assert!(d.recursive, "{args:?} keeps the filename default");
            assert_eq!(d.show_file, None, "{args:?} is not an explicit request");
        }
        assert_eq!(detected(&["-r", "-d", "read", "-h"]).show_file, Some(false));
        assert_eq!(detected(&["-h", "-r", "-d", "read"]).show_file, Some(false));
        assert!(!detecte
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                if let Some(recurses) = recursion_set_by(engine, t, tokens) {
                    recursive = recurses;
                    if let Some(recurses) = recursion_set_by(engine, c, tokens) {
                        recursive = recurses;
            &["-r", "-d", "read"][..],
            &["-rd", "skip"][..],

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T12:59:25.074Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795784365074",
    "title": "Empirical Invariant Guard in search.rs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rtk-ai-rtk-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c5703c7ee4d6041c61b020d2a80221e56424661f2b26bd9dd1a3a2cd58ade8dd"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-27T12:59:25.075Z"
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
  "auth_token": "5c375c5ece8a7e3fe4b276c0f12dc97e56a87eb2c4907abc0c7058eed9bced72"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

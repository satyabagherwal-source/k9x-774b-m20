# Candidate Directive: [CD-9DCO] promql): answer a named selector over a missing table with the empty vector

<!-- PROVENANCE_START
{
  "source_repository": "greptimeteam-greptimedb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T15:17:35.695Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-greptimeteam-greptimedb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [greptimeteam-greptimedb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T15:17:35.695Z`  
> **Learning ID**: `LEARN-EVO-greptimeteam-greptimedb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/query/src/promql/planner/native.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in GreptimeTeam/greptimedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `883ae6ea`: promql): answer a named selector over a missing table with the empty vector. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/query/src/promql/planner/native.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
            let time_index = free_time_index(DEFAULT_TIME_INDEX_COLUMN, &value_names, &output_tags);
                        // narrows the field set of a scan this route can read, and a selector that matched
                        // no table has no scan to narrow: the answer is the empty vector either way, exactly
                        // as the named branch below answers a missing table.
                    // The selector names a metric whose table does not exist, so the query still has an
                    // answer: the empty vector, planned from the same typed empty input a nameless selector
                    // that matched no table is. Planning it here keeps `TableNameNotFound` out of the
                    // existing planner, which has no table to bind.
                    //
                    // A `__field__` matcher does not decline here, though one over a scan this route can
                    // read does: it narrows the field set of the table its selector reads, and this table has
                    // no field set to narrow, so every field selection over it is empty. The existing planner
                    // answers the same way, because a missing tab
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            // A label named `time` is the one collision the default time column can have: the
            // value columns are named after the expression, so they never take that name. The
            // time column is this route's own synthetic name - no label or value is renamed - so
            // a statement whose output already holds a `time` column publishes its grid under the
            // first free `native_time_N` instead of dropping or renaming the label.
            let time_index = if value_names
                .iter()
                .chain(&output_tags)
                .any(|name| name == DEFAULT_TIME_INDEX_COLUMN)
            {
                (0usize..)
                    .map(|index| format!("native_time_{index}"))
                    .find(|candidate| {
                        !value_names
                            .iter()
                            .chain(&output_tags)
                            .any(|name| name == candidate)
                    })

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T15:17:35.831Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795533455831",
    "title": "promql): answer a named selector over a missing table with the empty vector",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "greptimeteam-greptimedb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "2ec42fa867aff84dd0fff81f16661d4cdcad956222d5bba121d05666ff27843d"
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
        "Harvested/verified timestamp recorded: 2026-11-24T15:17:35.831Z"
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
  "auth_token": "6e445b9b02d40dffc3ccc328c1f1ed7963e6052a2dc64b6aa9cb93d930b2761f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

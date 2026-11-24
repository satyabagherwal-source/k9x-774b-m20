# Candidate Directive: [CD-99FZ] answer a named selector over a missing table with the empty vector

<!-- PROVENANCE_START
{
  "source_repository": "GreptimeTeam/greptimedb",
  "source_url": "https://github.com/GreptimeTeam/greptimedb",
  "source_version": "81e60511",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T15:17:30.767Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-greptimeteam-greptimedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [GreptimeTeam/greptimedb](https://github.com/GreptimeTeam/greptimedb) (Revision: `81e60511`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T15:17:30.767Z`  
> **Learning ID**: `learn-github-greptimeteam-greptimedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
                    .expect("the time column candidate sequence is unbounded")
            } else {
                DEFAULT_TIME_INDEX_COLUMN.to_string()
            };
                        // is declined fo
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `883ae6ea` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T15:17:30.765Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795533450765",
    "title": "answer a named selector over a missing table with the empty vector",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "GreptimeTeam/greptimedb",
    "source_uri": "https://github.com/GreptimeTeam/greptimedb",
    "source_version": "HEAD",
    "content_hash": "0b7f76471486398d3f913037a6089022c0dfa8618e686ae85842b74599f5481a"
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
        "Harvested/verified timestamp recorded: 2026-11-24T15:17:30.765Z"
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
  "auth_token": "5442dff1c2e2e274727892f08cca9a1986e136cc86204c1055c70a4968d2fc68"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-B95V] timebucketp): read an index mixing dates and datetimes, dates as midnight

<!-- PROVENANCE_START
{
  "source_repository": "dathere-qsv-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T14:29:45.252Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-dathere-qsv-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dathere-qsv-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T14:29:45.252Z`  
> **Learning ID**: `LEARN-EVO-dathere-qsv-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dathere/qsv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0dd1ae72`: timebucketp): read an index mixing dates and datetimes, dates as midnight. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- `timebucketp`: new Polars-powered command that buckets time-series data into time windows over a date, datetime or integer index column. Window mode (`--every`, `--period`, `--offset`) groups rows into fixed or overlapping windows that need not be calendar units (e.g. `--every 15m --period 1h`), with `--label`, `--closed`, `--start-by` (incl. a weekday) and `--boundaries`; `--rolling` instead gives each row a trailing `(index - period, index]` window. `--by` computes windows per group, and `--agg` takes several `func:column` aggregations at once (first, last, sum, min, max, mean, median, quantile@<p>, len), output as `<column>_<func>`. `--fill-gaps` also emits the empty windows between each group's first and last window (count, sum and len 0, other aggregations empty); it needs the default left labels, since window ends are not evenly spaced with calendar or overlapping periods. Ambiguous dates such as `01/03/2024` are read month-first like the rest of qsv (Polars alone reads them day-first), or day-first with `QSV_PREFER_DMY`; `--date-format` sets an explicit index format. An index that mixes dates and datetimes, as `datefmt` writes midnight values, is read as datetimes, its dat
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- `timebucketp`: new Polars-powered command that buckets time-series data into time windows over a date, datetime or integer index column. Window mode (`--every`, `--period`, `--offset`) groups rows into fixed or overlapping windows that need not be calendar units (e.g. `--every 15m --period 1h`), with `--label`, `--closed`, `--start-by` (incl. a weekday) and `--boundaries`; `--rolling` instead gives each row a trailing `(index - period, index]` window. `--by` computes windows per group, and `--agg` takes several `func:column` aggregations at once (first, last, sum, min, max, mean, median, quantile@<p>, len), output as `<column>_<func>`. `--fill-gaps` also emits the empty windows between each group's first and last window (count, sum and len 0, other aggregations empty); it needs the default left labels, since window ends are not evenly spaced with calendar or overlapping periods. Ambiguous dates such as `01/03/2024` are read month-first like the rest of qsv (Polars alone reads them day-first), or day-first with `QSV_PREFER_DMY`; `--date-format` sets an explicit index format. Text columns holding only dates are parsed the same way for min/max/mean/median/quantile, so they compare a
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0dd1ae72` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T14:29:45.377Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795876185377",
    "title": "timebucketp): read an index mixing dates and datetimes, dates as midnight",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dathere-qsv-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "dbffebe46529e5895ce8625ce27e589529dba118b53ea1db536c3d6b674757b6"
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
        "Harvested/verified timestamp recorded: 2026-11-28T14:29:45.378Z"
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
  "auth_token": "30ac19c4d63c3baf2a5b314486771e0cccb120e84c4f70aa84232740a070886b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

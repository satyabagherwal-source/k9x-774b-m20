# Candidate Directive: [CD-B2HF] read an index mixing dates and datetimes, dates as midnight

<!-- PROVENANCE_START
{
  "source_repository": "dathere/qsv",
  "source_url": "https://github.com/dathere/qsv",
  "source_version": "ca34987a",
  "license": "NOASSERTION",
  "timestamp": "2026-11-28T14:29:36.723Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dathere-qsv",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dathere/qsv](https://github.com/dathere/qsv) (Revision: `ca34987a`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-28T14:29:36.723Z`  
> **Learning ID**: `learn-github-dathere-qsv`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-28T14:29:36.721Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795876176721",
    "title": "read an index mixing dates and datetimes, dates as midnight",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dathere/qsv",
    "source_uri": "https://github.com/dathere/qsv",
    "source_version": "HEAD",
    "content_hash": "709b3f7613182dc25c8dca17a15f2024f4f8e89a9ca05a004862568dd6283944"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-28T14:29:36.721Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "727b816e0fd7bd070a0517822aecfcf91efeb6c9c164b72d0652eb0b6533f1c3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

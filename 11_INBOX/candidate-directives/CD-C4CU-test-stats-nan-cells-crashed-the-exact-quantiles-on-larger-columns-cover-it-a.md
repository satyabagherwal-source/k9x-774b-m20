# Candidate Directive: [CD-C4CU] test(stats): NaN cells crashed the exact quantiles on larger columns; cover it a

<!-- PROVENANCE_START
{
  "source_repository": "dathere/qsv",
  "source_url": "https://github.com/dathere/qsv",
  "source_version": "7abf98c0",
  "license": "NOASSERTION",
  "timestamp": "2026-11-15T00:50:53.838Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dathere-qsv",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dathere/qsv](https://github.com/dathere/qsv) (Revision: `7abf98c0`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-15T00:50:53.838Z`  
> **Learning ID**: `learn-github-dathere-qsv`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dathere/qsv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7abf98c0`: test(stats): NaN cells crashed the exact quantiles on larger columns; cover it and Codacy's suggestions. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **`stats`: a `NaN` cell in a float column is skipped by every numeric statistic** ([#5053](https://github.com/dathere/qsv/pull/5053)). A `NaN`, `nan` or `NAN` cell is read as a float (pandas and numpy write missing values this way). The mean already skipped it, but the `sum` came out empty, and the exact median, quartiles, IQR, MAD, fences, skewness and percentiles were computed with it. On a column of a few hundred rows or more that crashed `stats` (qsv 28.0.0 exits with a panic on `stats --quartiles`, as does `moarstats`, which runs it); on a smaller one they came out empty or shifted. With `--weight`, one such cell emptied the weighted mean and standard deviation of the whole column. They now all skip it, as `--quantile-method approx` already did, so the statistics are those of the column's other values. The cell still counts as a value: `nullcount`, `sparsity` and `cardinality` are unchanged, and the column stays Float. That holds when the other values are all integers too: such a column is summarized as floats, so its minimum and maximum read `1.0` and not `1`, and its sum is no longer exact past 2^53. `inf` cells are unchanged.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- **`stats`: a `NaN` cell in a float column is skipped by every numeric statistic** ([#5053](https://github.com/dathere/qsv/pull/5053)). A `NaN`, `nan` or `NAN` cell is read as a float (pandas and numpy write missing values this way). The mean already skipped it, but the `sum` came out empty, and the exact median, quartiles, IQR, MAD, fences, skewness and percentiles were computed with it and came out empty or shifted. With `--weight`, one such cell emptied the weighted mean and standard deviation of the whole column. They now all skip it, as `--quantile-method approx` already did, so the statistics equal those of the column without that cell. The cell still counts as a value: `nullcount`, `sparsity` and `cardinality` are unchanged, and the column stays Float. `inf` cells are unchanged.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7abf98c0` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T00:50:53.836Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794703853836",
    "title": "test(stats): NaN cells crashed the exact quantiles on larger columns; cover it a",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dathere/qsv",
    "source_uri": "https://github.com/dathere/qsv",
    "source_version": "HEAD",
    "content_hash": "637e68638ded24e6a808d53f4e4e7b83f516adab86ea814a725e699c07fbf535"
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
        "Harvested/verified timestamp recorded: 2026-11-15T00:50:53.836Z"
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
  "auth_token": "7fda12ef71f514fb66788c9ff74d368dccd7805d78bdc52bff229bb2af3cc24f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

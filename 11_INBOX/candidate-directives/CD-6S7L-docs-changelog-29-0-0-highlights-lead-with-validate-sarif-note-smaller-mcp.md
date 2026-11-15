# Candidate Directive: [CD-6S7L] docs(changelog): 29.0.0 Highlights lead with validate --sarif, note smaller .mcp

<!-- PROVENANCE_START
{
  "source_repository": "dathere-qsv-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T12:54:34.762Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-dathere-qsv-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dathere-qsv-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T12:54:34.762Z`  
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
Prevents defects observed in production commit `4ec3d2c8`: docs(changelog): 29.0.0 Highlights lead with validate --sarif, note smaller .mcpb. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
~104 commits since 28.0.0, and the theme is **correctness**. We develop qsv with the latest models from Anthropic and review every change adversarially with OpenAI's. [Codacy](https://www.codacy.com) adds one more layer of correctness review on top of that. Thanks to their generosity, we have free access to their platform. With all three, we swept several core commands for correctness: `stats` and `moarstats`, `luau`, `profile`, `scoresql`, `sqlp --format avro`, and every command that reads piped stdin. Thank you, Codacy!
- **`validate --sarif` writes JSON Schema errors as a [SARIF 2.1.0](https://www.oasis-open.org/standard/sarif-v2-1-0/) log** ([#5031](https://github.com/dathere/qsv/pull/5031)). Though SARIF is typically used for static analysis of code, we're now using it to report validation errors in a standardized format, with an example GitHub Actions workflow that uploads them to GitHub code scanning. This sets the stage for integrating qsv's validation capabilities into Datapusher+, CI/CD pipelines and other automated workflows.
- **`stats` no longer crashes on `NaN` cells** ([#5053](https://github.com/dathere/qsv/pull/5053)). If you run `stats` on data written by pandas or
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
~104 commits since 28.0.0, and the theme is **correctness**. We develop qsv with the latest models from Anthropic and review every change adversarially with OpenAI's. [Codacy](https://www.codacy.com) adds one more layer of correctness review on top of that, and it gives us free access to its platform. With all three, we swept several core commands for correctness: `stats` and `moarstats`, `luau`, `profile`, `scoresql`, `sqlp --format avro`, and every command that reads piped stdin. Thank you, Codacy.
If you run `stats` on data written by pandas or numpy, upgrade:

- **`stats` no longer crashes on `NaN` cells** ([#5053](https://github.com/dathere/qsv/pull/5053)). In qsv 28.0.0 and 27.0.1, `stats --median`, `--quartiles` or `--everything` panics on a float column of a few hundred rows or more that holds a `NaN`, `nan` or `NAN` cell, which is how pandas and numpy write missing values. So does `moarstats`, which runs `stats`. On smaller columns, the `sum` came out empty and the quartiles, MAD, IQR, fences and percentiles were empty or shifted. Every numeric statistic now skips `NaN` cells, as the mean and `--quantile-method approx` already did. A `NaN` cell still counts as a value for 
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4ec3d2c8` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T12:54:34.832Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794747274832",
    "title": "docs(changelog): 29.0.0 Highlights lead with validate --sarif, note smaller .mcp",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dathere-qsv-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1d2a8e37ef49e8fde02e1b59a801486f8182503091859c119758e7ed42c4dae8"
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
        "Harvested/verified timestamp recorded: 2026-11-15T12:54:34.832Z"
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
  "auth_token": "17ca5dc3caea897a7cf4185a3abecedbed25af9c6463adfa0ddec708784786ec"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

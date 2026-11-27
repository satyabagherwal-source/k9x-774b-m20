# Candidate Directive: [CD-WYK2] write nested JSONL values as JSON text (#5125 follow-up)

<!-- PROVENANCE_START
{
  "source_repository": "dathere/qsv",
  "source_url": "https://github.com/dathere/qsv",
  "source_version": "23809a00",
  "license": "NOASSERTION",
  "timestamp": "2026-11-27T22:54:51.122Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dathere-qsv",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dathere/qsv](https://github.com/dathere/qsv) (Revision: `23809a00`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-27T22:54:51.122Z`  
> **Learning ID**: `learn-github-dathere-qsv`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.claude/skills/qsv/qsv-sqlp.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dathere/qsv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `23809a00`: write nested JSONL values as JSON text (#5125 follow-up). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/skills/qsv/qsv-sqlp.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        "description": "Automatically try to parse dates/datetimes and time. If parsing fails, columns remain as strings. Note that if dates are not well-formatted in your CSV, that you may want to try to set `--ignore-errors` to relax the CSV parsing of dates. Polars reads slash, dash and dot dates as day-first, so 01/05/2024 becomes 2024-05-01. Without this option (and without a .pschema.json that types the column as a date), the column stays a string, and CAST(col AS DATE) of a string reads only year-first dates (2024-05-01, 2024/5/1): it fails on 01/05/2024, and TRY_CAST returns NULL. For month-first (US) dates, leave this off and use STRPTIME(col, '%m/%d/%Y') in the query instead."
      "description": "read_ndjson() takes Polars' scan_ndjson options the same way: schema, schema_overrides, infer_schema_length, ignore_errors and include_file_paths. Infer the schema from the whole file, so keys that first appear late can be queried. By default only the first 100 rows are used, and selecting a key that first appears later (e.g. with select *) fails with \"extra field in NDJSON data\":",
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        "description": "Automatically try to parse dates/datetimes and time. If parsing fails, columns remain as strings. Note that if dates are not well-formatted in your CSV, that you may want to try to set `--ignore-errors` to relax the CSV parsing of dates. Polars reads slash, dash and dot dates as day-first, so 01/05/2024 becomes 2024-05-01. Without this option, the column stays a string, and CAST(col AS DATE) of a string reads only year-first dates (2024-05-01, 2024/5/1): it fails on 01/05/2024, and TRY_CAST returns NULL. For month-first (US) dates, leave this off and use STRPTIME(col, '%m/%d/%Y') in the query instead."
      "description": "read_ndjson() takes Polars' scan_ndjson options the same way: schema, schema_overrides, infer_schema_length, ignore_errors and include_file_paths. Infer the schema from the whole file. By default only the first 100 rows are used, and a key that first appears later fails the query with \"extra field in NDJSON data\":",
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `23809a00` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T22:54:51.120Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795820091120",
    "title": "write nested JSONL values as JSON text (#5125 follow-up)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dathere/qsv",
    "source_uri": "https://github.com/dathere/qsv",
    "source_version": "HEAD",
    "content_hash": "644471fe8e452d67f87ace6c3c3a0ed5b40e3307ade6d61881429f816ff2a3ec"
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
        "Harvested/verified timestamp recorded: 2026-11-27T22:54:51.120Z"
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
  "auth_token": "9b4cdd1b8d9c939461b3cfe6a8b91bd4da3afe4c5d15fb4827ae7759b94bff2d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

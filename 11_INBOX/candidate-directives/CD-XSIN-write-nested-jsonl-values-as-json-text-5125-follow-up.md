# Candidate Directive: [CD-XSIN] write nested JSONL values as JSON text (#5125 follow-up)

<!-- PROVENANCE_START
{
  "source_repository": "dathere-qsv-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T22:55:29.804Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-dathere-qsv-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dathere-qsv-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T22:55:29.804Z`  
> **Learning ID**: `LEARN-EVO-dathere-qsv-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-27T22:55:29.950Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795820129950",
    "title": "write nested JSONL values as JSON text (#5125 follow-up)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dathere-qsv-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "644471fe8e452d67f87ace6c3c3a0ed5b40e3307ade6d61881429f816ff2a3ec"
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
        "Harvested/verified timestamp recorded: 2026-11-27T22:55:29.950Z"
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
  "auth_token": "4a25dbfe9a20f80d26e798ecc72a1122a7796a45a6c4115c06e470ef81aca013"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

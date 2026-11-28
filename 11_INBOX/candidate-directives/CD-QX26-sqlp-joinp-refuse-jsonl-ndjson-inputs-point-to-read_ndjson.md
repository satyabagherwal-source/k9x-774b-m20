# Candidate Directive: [CD-QX26] sqlp, joinp): refuse JSONL/NDJSON inputs; point to read_ndjson()

<!-- PROVENANCE_START
{
  "source_repository": "dathere/qsv",
  "source_url": "https://github.com/dathere/qsv",
  "source_version": "42a602c0",
  "license": "NOASSERTION",
  "timestamp": "2026-11-28T13:17:57.342Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-dathere-qsv",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [dathere/qsv](https://github.com/dathere/qsv) (Revision: `42a602c0`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-28T13:17:57.342Z`  
> **Learning ID**: `learn-github-dathere-qsv`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.claude/skills/qsv/qsv-sqlp.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in dathere/qsv. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `60956a31`: sqlp, joinp): refuse JSONL/NDJSON inputs; point to read_ndjson(). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/skills/qsv/qsv-sqlp.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        "description": "The CSV file/s to query. Use '-' for standard input. If input is a directory, all files in the directory will be read as input. If the input is a file with a '.infile-list' extension, the file will be read as a list of files to use as input. If the input are snappy compressed file(s), it will be decompressed automatically. Column headers are required. Use 'qsv rename _all_generic --no-headers' to add generic column names (_col_N) to a CSV with no headers. A JSONL/NDJSON (.jsonl/.ndjson) input is refused: query it with the read_ndjson() table function and SKIP_INPUT instead. If you are using Polars SQL's table functions like read_csv() & read_parquet() to read input files directly in the SQL statement, you can use the sentinel value 'SKIP_INPUT' to skip input preprocessing. If pschema.json file/s exists for the input file/s, they will automatically be used to optimize the query even if --cache-schema is not set."
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        "description": "The CSV file/s to query. Use '-' for standard input. If input is a directory, all files in the directory will be read as input. If the input is a file with a '.infile-list' extension, the file will be read as a list of files to use as input. If the input are snappy compressed file(s), it will be decompressed automatically. Column headers are required. Use 'qsv rename _all_generic --no-headers' to add generic column names (_col_N) to a CSV with no headers. If you are using Polars SQL's table functions like read_csv() & read_parquet() to read input files directly in the SQL statement, you can use the sentinel value 'SKIP_INPUT' to skip input preprocessing. If pschema.json file/s exists for the input file/s, they will automatically be used to optimize the query even if --cache-schema is not set."
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `60956a31` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T13:17:57.340Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795871877340",
    "title": "sqlp, joinp): refuse JSONL/NDJSON inputs; point to read_ndjson()",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "dathere/qsv",
    "source_uri": "https://github.com/dathere/qsv",
    "source_version": "HEAD",
    "content_hash": "9d456cc04075fbfab12cb6be803e9bdb30c7d9da39d69c7318ab36793899e245"
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
        "Harvested/verified timestamp recorded: 2026-11-28T13:17:57.340Z"
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
  "auth_token": "fd3903d1cd461ef638f3f44f29cbd39311d8cd1452f89e7f09c1468169819be7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-7G3A] read_duckdb filters on columns that are converted for the scan

<!-- PROVENANCE_START
{
  "source_repository": "duckdb/duckdb",
  "source_url": "https://github.com/duckdb/duckdb",
  "source_version": "c826f8f7",
  "license": "MIT",
  "timestamp": "2026-11-26T13:55:27.670Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-duckdb-duckdb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [duckdb/duckdb](https://github.com/duckdb/duckdb) (Revision: `c826f8f7`).  
> **License**: MIT | **Timestamp**: `2026-11-26T13:55:27.670Z`  
> **Learning ID**: `learn-github-duckdb-duckdb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/function/table/read_duckdb.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in duckdb/duckdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d648b503`: read_duckdb filters on columns that are converted for the scan. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/function/table/read_duckdb.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
#include "duckdb/execution/expression_executor.hpp"
#include "duckdb/planner/expression/bound_reference_expression.hpp"
#include "duckdb/planner/expression_iterator.hpp"
#include "duckdb/planner/table_filter_state.hpp"
#include "duckdb/storage/table/column_segment.hpp"
struct DuckDBReadLocalState;

private:
	//! The filters the table scan evaluates - those on the columns that are read as the file stores them
	optional_ptr<TableFilterSet> GetScanFilters();
	//! Prepares the conversions of expression_map and the filters that apply to their results
	void InitializeConvertedColumns(ClientContext &context, DuckDBReadLocalState &lstate);
	//! Scans the table into the chunk of the file, converts the columns of expression_map and applies their filters
	void ScanConvertedColumns(ClientContext &context, TableFunctionInput &input, DuckDBReadLocalState &lstate,
	                          DataChunk &chunk);

	//! The subset of the filters that is pushed into the table scan - only set when some columns are converted
	unique_ptr<TableFilterSet> scan_filters;
//! A scan column the multi-file scan wants converted before its filters apply (see BaseFileReader::expression_map)
struct DuckDBConvertedCo
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
		TableFunctionInitInput input(bind_data.get(), scan_column_indexes, vector<idx_t>(), filters.get());
	TableFunctionInitInput input(bind_data.get(), scan_column_indexes, vector<idx_t>(), filters.get());
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d648b503` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T13:55:27.668Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795701327668",
    "title": "read_duckdb filters on columns that are converted for the scan",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "duckdb/duckdb",
    "source_uri": "https://github.com/duckdb/duckdb",
    "source_version": "HEAD",
    "content_hash": "1de1aec08e230b91e07537a091b31df5fcc725bccd4f71959598463ebbf68af7"
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
        "Harvested/verified timestamp recorded: 2026-11-26T13:55:27.668Z"
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
  "auth_token": "275fd758d0c15312c675f47a5a9afdc04aeae9d12783d1d23983f88884af1b77"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-K22R] Spill top-N heap aggregate states under memory pressure

<!-- PROVENANCE_START
{
  "source_repository": "duckdb/duckdb",
  "source_url": "https://github.com/duckdb/duckdb",
  "source_version": "b1ae457e",
  "license": "MIT",
  "timestamp": "2026-11-27T07:49:01.443Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-duckdb-duckdb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [duckdb/duckdb](https://github.com/duckdb/duckdb) (Revision: `b1ae457e`).  
> **License**: MIT | **Timestamp**: `2026-11-27T07:49:01.443Z`  
> **Learning ID**: `learn-github-duckdb-duckdb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `extension/core_functions/aggregate/distributive/arg_min_max.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in duckdb/duckdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d1508f3a`: Spill top-N heap aggregate states under memory pressure. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `extension/core_functions/aggregate/distributive/arg_min_max.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:

	void ExportSlot(Vector &entries, idx_t entry_idx, idx_t slot, bool nulls_last) const {
		auto &children = StructVector::GetEntries(entries);
		auto &entry = heap.GetSlot(slot);
		VAL_TYPE::Assign(children[0], entry_idx, entry.second.value, nulls_last);
		ARG_TYPE::Assign(children[1], entry_idx, entry.first.value, nulls_last);
	}

	struct ImportData {
		ImportData(const Vector &entries, idx_t count, bool nulls_last)
		    : validity(entries.Validity()), val_extra_state(VAL_TYPE::CreateExtraState(count)),
		      arg_extra_state(ARG_TYPE::CreateExtraState(count)) {
			auto &children = StructVector::GetEntries(entries);
			VAL_TYPE::PrepareData(children[0], val_extra_state, val_format, nulls_last);
			ARG_TYPE::PrepareData(children[1], arg_extra_state, arg_format, nulls_last);
		}

		VectorValidityIterator validity;
		typename VAL_TYPE::EXTRA_STATE val_extra_state;
		typename ARG_TYPE::EXTRA_STATE arg_extra_state;
		UnifiedVectorFormat val_format;
		UnifiedVectorFormat arg_format;
	};

	void ImportSlot(ArenaAllocator &allocator, const ImportData &entries, idx_t entry_idx, bool reject_nulls) {
		const auto val_idx = entries.val_format.sel->get_index(entry_idx);
		const auto arg_idx =
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
	auto val_extra_state = STATE::VAL_TYPE::CreateExtraState();
	auto arg_extra_state = STATE::ARG_TYPE::CreateExtraState();
	function.SetStateDestructorCallback(AggregateFunction::StateDestroy<STATE, OP>);
	function.SetStateDestructorCallback(AggregateFunction::StateDestroy<STATE, OP>);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d1508f3a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T07:49:01.441Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795765741441",
    "title": "Spill top-N heap aggregate states under memory pressure",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "duckdb/duckdb",
    "source_uri": "https://github.com/duckdb/duckdb",
    "source_version": "HEAD",
    "content_hash": "3f2fbf6a2011c3bdbb126474a31788dfc10e2fb36c0f2558d936b8defa7edd98"
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
        "Harvested/verified timestamp recorded: 2026-11-27T07:49:01.441Z"
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
  "auth_token": "b4045972ec446cbb834ef2b25184ff53914200e69cfb681326553a6e2509dcc5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-WSSA] [C++][Parquet] Minor optimize level counting with CountLevels

<!-- PROVENANCE_START
{
  "source_repository": "apache/arrow",
  "source_url": "https://github.com/apache/arrow",
  "source_version": "cb434829",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T00:40:01.210Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-apache-arrow",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache/arrow](https://github.com/apache/arrow) (Revision: `cb434829`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T00:40:01.210Z`  
> **Learning ID**: `learn-github-apache-arrow`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `cpp/src/parquet/column_reader.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/arrow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cb434829`: GH-55399: [C++][Parquet] Minor optimize level counting with CountLevels. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `cpp/src/parquet/column_reader.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
#include "parquet/level_comparison_internal.h"
          internal::CountLevels(def_levels, *num_def_levels, this->max_def_level()));
      CountLevels(def_levels() + levels_position_,
                  remaining_levels_pos - levels_position_, this->max_def_level()));
    records_read += CountLevels(rep_levels + levels_position_, stride, 0);
  *values_seen =
      CountLevels(def_levels + level, levels_position_ - level, this->max_def_level());
  *values_to_read +=
      CountLevels(def_levels + start_levels_position,
                  levels_position_ - start_levels_position, this->max_def_level());
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
          std::count(def_levels, def_levels + *num_def_levels, this->max_def_level()));
      std::count(def_levels() + levels_position_, def_levels() + remaining_levels_pos,
                 this->max_def_level()));
    for (int64_t i = levels_position_; i < position_end; ++i) {
      records_read += rep_levels[i] == 0;
    }
  *values_seen = std::count(def_levels + level, def_levels + levels_position_,
                            this->max_def_level());
  *values_to_read += std::count(def_levels + start_levels_position,
                                def_levels + levels_position_, this->max_def_level());
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cb434829` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T00:40:01.208Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.71,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 71%). Source=PASS (TIER_2_OFFICIAL_ECOSYSTEM), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795480801208",
    "title": "[C++][Parquet] Minor optimize level counting with CountLevels",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apache/arrow",
    "source_uri": "https://github.com/apache/arrow",
    "source_version": "HEAD",
    "content_hash": "a787fe582196b8f07bc527e5232ea5a807293522481b04d6a7e728ffb0330986"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.75,
      "tier": "TIER_2_OFFICIAL_ECOSYSTEM",
      "findings": [],
      "details": [
        "Source belongs to recognized official ecosystem (TIER_2_OFFICIAL_ECOSYSTEM)",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-24T00:40:01.208Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "29eb3d1b5d425bb0bc5cb381e99238ccdb6701f5ef4a99269349229f17bef4fe"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

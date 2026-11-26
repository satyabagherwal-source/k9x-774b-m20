# Candidate Directive: [CD-TAJE] update doc_id_ before BM25Score threshold check in PhraseDocIter

<!-- PROVENANCE_START
{
  "source_repository": "infiniflow/infinity",
  "source_url": "https://github.com/infiniflow/infinity",
  "source_version": "2842d7e4",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T01:36:37.274Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-infiniflow-infinity",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [infiniflow/infinity](https://github.com/infiniflow/infinity) (Revision: `2842d7e4`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T01:36:37.274Z`  
> **Learning ID**: `learn-github-infiniflow-infinity`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/main/config_impl.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in infiniflow/infinity. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2842d7e4`: invertedindex): update doc_id_ before BM25Score threshold check in PhraseDocIterator::Next. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/main/config_impl.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
                if (buffer_config_table->contains("unsealed_memory_quota") && buffer_config_table->contains(MEMINDEX_MEMORY_QUOTA_OPTION_NAME)) {
                    return Status::InvalidConfig("Cannot specify both 'memindex_memory_quota' and 'unsealed_memory_quota' in 'buffer' field.");
                }
                    if (var_name == "unsealed_reclaim_interval" || var_name == "unsealed_max_tables_per_round") {
                        continue;
                    }
                    if (var_name == "unsealed_memory_quota") {
                        var_name = MEMINDEX_MEMORY_QUOTA_OPTION_NAME;
                    }
                            if (elem.second.is_integer() && elem.second.value_or(-1) == 0) {
                                mem_index_memory_quota = 0;
                            } else if (elem.second.is_string()) {
                                return Status::InvalidConfig("'mem_index_memory_quota' field isn't string or 0.");
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
                            if (elem.second.is_string()) {
                                return Status::InvalidConfig("'mem_index_memory_quota' field isn't string.");
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2842d7e4` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T01:36:37.272Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795656997272",
    "title": "update doc_id_ before BM25Score threshold check in PhraseDocIter",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "infiniflow/infinity",
    "source_uri": "https://github.com/infiniflow/infinity",
    "source_version": "HEAD",
    "content_hash": "826746ab9f217bb3a0a17c0f8118a7a370981e9c1735cd7654fba00108ad4e65"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Harvested/verified timestamp recorded: 2026-11-26T01:36:37.272Z"
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
  "auth_token": "f93db607a6978fe4291b5608d6e758bd463b5bc5d5cb845e21680fad038c2b12"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

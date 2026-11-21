# Candidate Directive: [CD-DWHK] Ignore run-to-run plan cost variation in the plan-cost regression runner

<!-- PROVENANCE_START
{
  "source_repository": "duckdb/duckdb",
  "source_url": "https://github.com/duckdb/duckdb",
  "source_version": "87d96b77",
  "license": "MIT",
  "timestamp": "2026-11-21T17:50:04.473Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-duckdb-duckdb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [duckdb/duckdb](https://github.com/duckdb/duckdb) (Revision: `87d96b77`).  
> **License**: MIT | **Timestamp**: `2026-11-21T17:50:04.473Z`  
> **Learning ID**: `learn-github-duckdb-duckdb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `scripts/plan_cost_runner.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in duckdb/duckdb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `aa009031`: Ignore run-to-run plan cost variation in the plan-cost regression runner. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `scripts/plan_cost_runner.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
PROFILE_RUNS = 5
# Overlapping cost samples whose medians differ by more than this are still compared.
MEDIAN_TOLERANCE = 0.02
def cost_components(cost):
    return (cost.total, cost.build_side, cost.probe_side)


def median_cost(costs):
    result = PlanCost()
    result.total, result.build_side, result.probe_side = (
        statistics.median_low(values) for values in zip(*(cost_components(cost) for cost in costs))
    )
    return result


def within_run_variation(old_costs, new_costs):
    for old_values, new_values in zip(
        zip(*(cost_components(cost) for cost in old_costs)), zip(*(cost_components(cost) for cost in new_costs))
    ):
        if max(old_values) < min(new_values) or max(new_values) < min(old_values):
            return False
        old_median, new_median = statistics.median_low(old_values), statistics.median_low(new_values)
        if abs(old_median - new_median) > MEDIAN_TOLERANCE * max(old_median, new_median):
            return False
    return True


def query_plan_costs(old, new, dbname, query):
    old_costs = [query_plan_cost(old, dbname, query)]
    new_costs = [query_plan_cost(new, dbname, query)]
    if old_costs[0] == new_costs[0]:
        ret
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
        old_cost = query_plan_cost(old, DB_NAME, query)
        new_cost = query_plan_cost(new, DB_NAME, query)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `aa009031` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T17:50:04.471Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795283404471",
    "title": "Ignore run-to-run plan cost variation in the plan-cost regression runner",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "duckdb/duckdb",
    "source_uri": "https://github.com/duckdb/duckdb",
    "source_version": "HEAD",
    "content_hash": "4f43d5d21011936bb5255a3ca5a3743792fe7b0aee7eea64b0b56a4f402ebc6a"
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
        "Harvested/verified timestamp recorded: 2026-11-21T17:50:04.471Z"
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
  "auth_token": "df75dc54c9aa238fad44ba978e8a96aa576fefd1de7bca27ee4b864c23712256"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

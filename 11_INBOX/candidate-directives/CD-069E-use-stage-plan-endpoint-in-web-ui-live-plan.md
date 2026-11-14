# Candidate Directive: [CD-069E] Use stage plan endpoint in Web UI live plan

<!-- PROVENANCE_START
{
  "source_repository": "trinodb/trino",
  "source_url": "https://github.com/trinodb/trino",
  "source_version": "9b4b9cfc",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T15:49:43.730Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-trinodb-trino",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [trinodb/trino](https://github.com/trinodb/trino) (Revision: `9b4b9cfc`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T15:49:43.730Z`  
> **Learning ID**: `learn-github-trinodb-trino`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `core/trino-web-ui/src/main/resources/webapp-legacy/src/components/LivePlan.jsx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in trinodb/trino. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `fb70e5bb`: Use stage plan endpoint in Web UI live plan. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/trino-web-ui/src/main/resources/webapp-legacy/src/components/LivePlan.jsx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
    static getStages(queryInfo: any, queryPlan: QueryPlan): Map<string, StageNodeInfo> {
            const planNodes = queryPlan[stageInfo.stageId]
            if (!planNodes) {
                return
            }
            planNodes.forEach((node) => nodes.set(node.id, node))
// Plan nodes of each stage, keyed by the stage id
type QueryPlan = { [stageId: string]: PlanNodeProps[] }
    queryPlan: QueryPlan,
    queryPlanUnavailable: boolean = false
            queryPlan: {},
        } else if (!this.queryPlanUnavailable && !this.hasQueryPlan(this.state.query)) {
            // the query does not change anymore, so only its plan is requested again
            this.timeoutId = setTimeout(
                () => this.refreshQueryPlan(this.state.query).then(() => this.resetTimer()),
                1000
            )
                return this.refreshQueryPlan(query)
            .then(() => this.resetTimer())
    // the plan of a stage does not change, so the plan is requested only when it does not cover all the stages
    refreshQueryPlan(query: any): Promise<void> {
        if (this.queryPlanUnavailable || this.hasQueryPlan(query)) {
            return Promise.resolve()
        }

```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
    static getStages(queryInfo: any): Map<string, StageNodeInfo> {
            StageStatistics.flattenNode(stageInfo.plan.root, JSON.parse(stageInfo.plan.jsonRepresentation), nodes)
    static flattenNode(rootNodeInfo: any, node: any, result: Map<any, PlanNodeProps>) {
        result.set(node.id, {
            id: node.id,
            name: node['name'],
            descriptor: node['descriptor'],
            details: node['details'],
            sources: node.children.map((node) => node.id),
        })

        node.children.forEach(function (child) {
            StageStatistics.flattenNode(rootNodeInfo, child, result)
        })
    }

                this.resetTimer()
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `fb70e5bb` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T15:49:43.728Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794671383728",
    "title": "Use stage plan endpoint in Web UI live plan",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "trinodb/trino",
    "source_uri": "https://github.com/trinodb/trino",
    "source_version": "HEAD",
    "content_hash": "78084189bc88b26bfd052a7a670e49066ad7894914e8fd38bcd71152532d1bed"
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
        "Harvested/verified timestamp recorded: 2026-11-14T15:49:43.728Z"
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
  "auth_token": "633c357c3824f214f5760fbb13c80839c1362de5399ea374514177d7256f9a74"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

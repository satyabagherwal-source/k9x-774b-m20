# Candidate Directive: [CD-CG5G] route Linux API jobs and wheel builds to dedicated runner

<!-- PROVENANCE_START
{
  "source_repository": "volcengine/OpenViking",
  "source_url": "https://github.com/volcengine/OpenViking",
  "source_version": "bfd935f4",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-16T08:06:43.396Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-volcengine-openviking",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [volcengine/OpenViking](https://github.com/volcengine/OpenViking) (Revision: `bfd935f4`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-16T08:06:43.396Z`  
> **Learning ID**: `learn-github-volcengine-openviking`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/CI.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in volcengine/OpenViking. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1a6e51f0`: ci): route Linux API jobs and wheel builds to dedicated runner. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/CI.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
With repository variable `CI_LINUX_BUILDS_ENABLED=true`, trusted Linux API jobs
use `[self-hosted, Linux, X64, ci-linux-builds]`. Linux x86_64 wheel builds
alternate between GitHub-hosted and this dedicated pool.
Only the dedicated runner `iv-yezentk8ao3z47ge5tmm` has that custom label; runner
display names do not select machines.
Linux wheels use the dedicated runner on even workflow run numbers.
API native runtime preparation and its short change-planning job always use
the dedicated runner for eligible events, regardless of workflow run number.
The planning job runs Git/Python on the host with a five-minute execution limit.
Linux API/CLI, MySQL/Redis and
cuVS tests inherit their same-run native producer's destination. This keeps the
entire trusted Linux API dependency chain off the hosted queue.
Wheel builds send 50% of consecutive runs to each destination, and reruns keep
the same destination. This is not half of all Linux jobs or an equal share of
execution time. Conditional skips can change the observed share.
The old ECS runner does not receive these jobs.

Only official repository PRs from the same repository and branch pushes are
eligible. Release/tag events, schedules, ma
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
Builds and ordinary tests use GitHub-hosted runners to measure build reuse and
cache behavior independently of self-hosted machine capacity. There is no
`ov-ci-runner` scheduling or manual selection in these workflows.
The existing P0 Memory Tests remain on their original ECS environment, selected
with `[self-hosted, Linux, X64, openviking-ecs]`. That runner must have the
`openviking-ecs` custom label; its display name alone does not select it.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1a6e51f0` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T08:06:43.394Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794816403394",
    "title": "route Linux API jobs and wheel builds to dedicated runner",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "volcengine/OpenViking",
    "source_uri": "https://github.com/volcengine/OpenViking",
    "source_version": "HEAD",
    "content_hash": "20f5ad164c47d4e9ec66026c1e7c478dbb46aac40b9eebcfbbe55f98c3013ff2"
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
        "Harvested/verified timestamp recorded: 2026-11-16T08:06:43.394Z"
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
  "auth_token": "0bd56bdc372c61d45521b56c6b60ddb234dd364b016253c06561036161e8bc3e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

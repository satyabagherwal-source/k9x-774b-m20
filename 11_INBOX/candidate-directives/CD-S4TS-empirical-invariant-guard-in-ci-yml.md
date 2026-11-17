# Candidate Directive: [CD-S4TS] Empirical Invariant Guard in ci.yml

<!-- PROVENANCE_START
{
  "source_repository": "aleo-labs-protocol/snarkOS",
  "source_url": "https://github.com/aleo-labs-protocol/snarkOS",
  "source_version": "bec6d69e",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T00:38:41.776Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aleo-labs-protocol-snarkos",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aleo-labs-protocol/snarkOS](https://github.com/aleo-labs-protocol/snarkOS) (Revision: `bec6d69e`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T00:38:41.776Z`  
> **Learning ID**: `learn-github-aleo-labs-protocol-snarkos`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/ci.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in aleo-labs-protocol/snarkOS. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bec6d69e`: . Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/ci.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# GitHub holds an outside contributor's pull request run until a maintainer
# approves it. A fork's run gets no secrets, so start-cpu-runners is skipped and
# fork-pr-runners.yml starts the boxes. The fleet jobs therefore accept a
# skipped start-cpu-runners, and run only in this repository, which alone may
# use the fleet.
#
# The fleet jobs also wait for check-shared-refs, a hosted job. GitHub reports
# a run as `in_progress`, and fires the `workflow_run` event that starts the
# boxes, only once none of its ready jobs is waiting for a runner. With no
# hosted job ahead of them, a fork's fleet jobs would wait for boxes that only
# that event starts.
      # box absorbs fewer of them within the critical path. fork-pr-runners.yml
      # repeats this.
    needs: [check-shared-refs, start-cpu-runners]
    if: &fleet-if >-
      !cancelled() && needs.check-shared-refs.result == 'success' &&
      contains(fromJSON('["success", "skipped"]'), needs.start-cpu-runners.result) &&
      github.repository == 'aleo-labs-protocol/snarkOS'
    needs: [check-shared-refs, start-cpu-runners]
    if: *fleet-if
    needs: [check-shared-refs, start-cpu-runners]
    if: *fleet-if
      !cancelled() &&
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
# Every self-hosted job carries the same guard: a fork's code never runs on
# the fleet, whose target dirs, sccache and home directories persist between
# jobs.
      # box absorbs fewer of them within the critical path.
    needs: start-cpu-runners
    if: >-
      github.event.pull_request == null ||
      github.event.pull_request.head.repo.full_name == github.repository
    needs: start-cpu-runners
    if: >-
      github.event.pull_request == null ||
      github.event.pull_request.head.repo.full_name == github.repository
    needs: start-cpu-runners
    if: >-
      github.event.pull_request == null ||
      github.event.pull_request.head.repo.full_name == github.repository
      github.event.pull_request == null ||
      github.event.pull_request.head.repo.full_name == github.repository
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bec6d69e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T00:38:41.773Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794875921773",
    "title": "Empirical Invariant Guard in ci.yml",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aleo-labs-protocol/snarkOS",
    "source_uri": "https://github.com/aleo-labs-protocol/snarkOS",
    "source_version": "HEAD",
    "content_hash": "c4d07b3f1b73b105ca046228d62eef86d81ba59fee760e3699d26c21fa63eac1"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T00:38:41.773Z"
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
  "auth_token": "a0833c191c517a84a26aa2a603b2be368d674c913cb1fa28a237b2c7a7217e95"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

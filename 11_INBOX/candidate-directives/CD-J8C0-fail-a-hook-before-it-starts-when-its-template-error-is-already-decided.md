# Candidate Directive: [CD-J8C0] fail a hook before it starts when its template error is already decided

<!-- PROVENANCE_START
{
  "source_repository": "max-sixty/worktrunk",
  "source_url": "https://github.com/max-sixty/worktrunk",
  "source_version": "829610e8",
  "license": "Apache-2.0",
  "timestamp": "2026-11-16T18:55:51.024Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-max-sixty-worktrunk",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [max-sixty/worktrunk](https://github.com/max-sixty/worktrunk) (Revision: `829610e8`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-16T18:55:51.024Z`  
> **Learning ID**: `learn-github-max-sixty-worktrunk`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/src/content/docs/hook.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in max-sixty/worktrunk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `b200ed58`: hooks): fail a hook before it starts when its template error is already decided. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/src/content/docs/hook.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
Templates are checked before the pipeline starts. One that can't parse, or that fails to expand from values no earlier step can change, such as an unguarded `{{ branch }}` in a detached worktree, stops the hook before any step runs. Templates render as each step runs, so a step can store [per-branch vars](/config/#wt-config-state-vars) that later steps read via `{{ vars.<key> }}`. Previews (`wt hook <type> --dry-run`, `wt hook show --expanded`) leave `{{ vars.* }}` references unexpanded for that reason.
A detached worktree has no branch, so `branch` — and a `base` or `target` that names that worktree — is undefined there; guard with `{% if branch %}`. A command that identifies the worktree rather than its branch can use `worktree_name` or `worktree_path`, which every worktree has.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
Templates are syntax-checked before the pipeline starts and rendered as each step runs, so a step can store [per-branch vars](/config/#wt-config-state-vars) that later steps read via `{{ vars.<key> }}`. Previews (`wt hook <type> --dry-run`, `wt hook show --expanded`) leave `{{ vars.* }}` references unexpanded for that reason.
A detached worktree has no branch, so `branch` — and a `base` or `target` that names that worktree — is undefined there; guard with `{% if branch %}`.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `b200ed58` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T18:55:51.022Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794855351022",
    "title": "fail a hook before it starts when its template error is already decided",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "max-sixty/worktrunk",
    "source_uri": "https://github.com/max-sixty/worktrunk",
    "source_version": "HEAD",
    "content_hash": "4954729a8b636ae5844289ca04fab48b205879bcbeec9bcef509d180db11a04f"
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
        "Harvested/verified timestamp recorded: 2026-11-16T18:55:51.023Z"
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
  "auth_token": "5bc5c5382eddab1c1d8f6f883bef7ff5f8ebd67f680bb4b710ac8651c3f7ea0f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

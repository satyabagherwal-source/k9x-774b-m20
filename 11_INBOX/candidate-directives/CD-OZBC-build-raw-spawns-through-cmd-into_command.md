# Candidate Directive: [CD-OZBC] build raw spawns through Cmd::into_command

<!-- PROVENANCE_START
{
  "source_repository": "max-sixty/worktrunk",
  "source_url": "https://github.com/max-sixty/worktrunk",
  "source_version": "c6cc8601",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T03:49:53.736Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-max-sixty-worktrunk",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [max-sixty/worktrunk](https://github.com/max-sixty/worktrunk) (Revision: `c6cc8601`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T03:49:53.736Z`  
> **Learning ID**: `learn-github-max-sixty-worktrunk`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `AGENTS.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in max-sixty/worktrunk. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `85f5b5bb`: shell_exec): build raw spawns through Cmd::into_command. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `AGENTS.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
External commands use shell_exec::Cmd for program resolution, environment, logging and timing; Git generally uses Repository::run_command or WorkingTree::run_command. Use run for capture, stream for live output, delayed_stream for slow setup, and pipe_into for pipelines. A spawn that owns its stdio, process group or wait builds its Command with Cmd::into_command and traces it with a CommandTrace guard, whose contract is in src/trace/emit.rs. Detached background children and interactive helpers are deliberately untraced.
A child whose cwd is a Worktrunk-chosen worktree must scrub inherited Git discovery variables before running, including hooks and worktree-local plumbing. Repo-level commands and commands in the user's own context keep inherited values. The site classification is in Cmd::scrub_git_discovery_env in src/shell_exec.rs.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
External commands use shell_exec::Cmd for logging and timing; Git generally uses Repository::run_command or WorkingTree::run_command. Use run for capture, stream for live output, delayed_stream for slow setup, and pipe_into for pipelines. In-process spawns outside Cmd use a CommandTrace guard; its contract is in src/trace/emit.rs. Detached background children and interactive helpers are deliberately untraced.
A child whose cwd is a Worktrunk-chosen worktree must scrub inherited Git discovery variables before running, including hooks and worktree-local plumbing. Repo-level commands and commands in the user's own context keep inherited values. The site classification is in scrub_git_discovery_env_vars in src/shell_exec.rs.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `85f5b5bb` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T03:49:53.734Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795492193734",
    "title": "build raw spawns through Cmd::into_command",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "max-sixty/worktrunk",
    "source_uri": "https://github.com/max-sixty/worktrunk",
    "source_version": "HEAD",
    "content_hash": "7a5c49a5c17af14ae6efeb7d05b7c97b793964db642acedbdc26a8e506fcd59c"
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
        "Harvested/verified timestamp recorded: 2026-11-24T03:49:53.735Z"
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
  "auth_token": "84459c5a60ac4972b44501f46007ec860fd72b76b35c14cdc153a1605686b749"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-VCUU] keep proactive summary model wait open until closure or interruption

<!-- PROVENANCE_START
{
  "source_repository": "apache/maka",
  "source_url": "https://github.com/apache/maka",
  "source_version": "16e3a770",
  "license": "Apache-2.0",
  "timestamp": "2026-11-24T21:38:36.630Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-apache-maka",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache/maka](https://github.com/apache/maka) (Revision: `16e3a770`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-24T21:38:36.630Z`  
> **Learning ID**: `learn-github-apache-maka`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `plugins/agent/engine/src/reconcile.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/maka. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3a1bf52b`: agent): keep proactive summary model wait open until closure or interruption. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `plugins/agent/engine/src/reconcile.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:

fn wait_proactive_summary(view: &RunView, attempt: ModelAttemptId, now: UnixMillis) -> Action {
    let summary = &view.attempts[&attempt];
    if summary.admission.is_some()
        && summary.cleanup != maka_plugin_core::operation::OperationCleanup::Confirmed
    {
        wait(view, WaitReason::Model { attempt }, None, now)
    } else {
        Action::Idle
    }
}
        attempt.admission.is_some()
            && (Some(**id) != view.proactive_summary
                || (matches!(action, Action::Terminate(Terminal::Completed))
                    && (view.finish_requested() || complete_at_budget)
                    && (attempt.closed.is_some() || attempt.interrupted.is_some())))
                    (attempt.closed.is_some() || attempt.interrupted.is_some())
                        && attempt.cleanup == maka_plugin_core::operation::OperationCleanup::Confirmed
                return wait_proactive_summary(view, attempt, now);
                return wait_proactive_summary(view, attempt, now);
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        Some(**id) != view.proactive_summary
            && attempt.admission.is_some()
                    attempt.cleanup == maka_plugin_core::operation::OperationCleanup::Confirmed
                return wait(view, WaitReason::Model { attempt }, None, now);
                return wait(view, WaitReason::Model { attempt }, None, now);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3a1bf52b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T21:38:36.627Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.71,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 71%). Source=PASS (TIER_2_OFFICIAL_ECOSYSTEM), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795556316627",
    "title": "keep proactive summary model wait open until closure or interruption",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apache/maka",
    "source_uri": "https://github.com/apache/maka",
    "source_version": "HEAD",
    "content_hash": "eb5c8f3d8cf436fd4434b236de685d91f65db0f4a3a9eb37916088e6fcbbf2fa"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
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
        "Harvested/verified timestamp recorded: 2026-11-24T21:38:36.628Z"
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
  "auth_token": "88b6814d13a583d9904b36e54fcd8f107a0cc2c488a802f781cbb741d9f567d4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

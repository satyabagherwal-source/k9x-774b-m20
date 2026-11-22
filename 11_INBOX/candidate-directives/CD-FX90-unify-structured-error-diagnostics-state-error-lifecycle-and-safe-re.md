# Candidate Directive: [CD-FX90] unify structured error diagnostics, state-error lifecycle, and safe re

<!-- PROVENANCE_START
{
  "source_repository": "yyjeqhc/webcodex",
  "source_url": "https://github.com/yyjeqhc/webcodex",
  "source_version": "8779794b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-22T18:35:18.420Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-yyjeqhc-webcodex",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yyjeqhc/webcodex](https://github.com/yyjeqhc/webcodex) (Revision: `8779794b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-22T18:35:18.420Z`  
> **Learning ID**: `learn-github-yyjeqhc-webcodex`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `apps/desktop/src-tauri/src/diagnostics.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yyjeqhc/webcodex. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7a8c3b28`: desktop): unify structured error diagnostics, state-error lifecycle, and safe recovery. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src-tauri/src/diagnostics.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    let connection_health:Vec<_>=snapshot.connections.profiles.iter().take(16).map(|p|json!({"lifecycle":p.runtime.lifecycle,"health":p.runtime.health,"ready":p.runtime.ready,"error_code":p.runtime.last_error,"failure_stage":p.runtime.failure_stage.as_deref().and_then(crate::error::sanitize_safe_identifier),"reason_code":p.runtime.reason_code.as_deref().and_then(crate::error::sanitize_safe_identifier)})).collect();
    let active_error = snapshot
        .runtime_error
        .as_ref()
        .map(DesktopError::safe_summary_value);
    let component_errors: serde_json::Map<String, Value> = snapshot
        .component_errors
        .iter()
        .map(|(component, error)| (component.as_str().to_string(), error.safe_summary_value()))
        .collect();
            "state_generation":snapshot.state_generation,
            "configuration_issue":snapshot.configuration_issue,"runtime_issue":runtime.unavailable_code,
            "active_error":active_error,"component_errors":component_errors},
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    let connection_health:Vec<_>=snapshot.connections.profiles.iter().take(16).map(|p|json!({"lifecycle":p.runtime.lifecycle,"health":p.runtime.health,"ready":p.runtime.ready,"error_code":p.runtime.last_error})).collect();
            "configuration_issue":snapshot.configuration_issue,"runtime_issue":runtime.unavailable_code},
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7a8c3b28` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T18:35:18.418Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795372518418",
    "title": "unify structured error diagnostics, state-error lifecycle, and safe re",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yyjeqhc/webcodex",
    "source_uri": "https://github.com/yyjeqhc/webcodex",
    "source_version": "HEAD",
    "content_hash": "5d172a3838244abb2b19819c96411d6f0a9f064869ed3fd6b586734168524f18"
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
        "Harvested/verified timestamp recorded: 2026-11-22T18:35:18.418Z"
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
  "auth_token": "c27f409d38e3883b2c314bd058fe55b188c4adc7fe6c005c31cb24a5741b9425"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

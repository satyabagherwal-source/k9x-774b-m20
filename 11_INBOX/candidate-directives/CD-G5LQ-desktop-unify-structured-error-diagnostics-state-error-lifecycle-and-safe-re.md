# Candidate Directive: [CD-G5LQ] desktop): unify structured error diagnostics, state-error lifecycle, and safe re

<!-- PROVENANCE_START
{
  "source_repository": "yyjeqhc-webcodex-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T18:35:29.130Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-yyjeqhc-webcodex-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yyjeqhc-webcodex-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T18:35:29.130Z`  
> **Learning ID**: `LEARN-EVO-yyjeqhc-webcodex-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-22T18:35:29.242Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795372529242",
    "title": "desktop): unify structured error diagnostics, state-error lifecycle, and safe re",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yyjeqhc-webcodex-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "04552ec89bf7aa25ca67e7fe55f546fe37aca00aa7a4105be36918c334b7743b"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
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
        "Harvested/verified timestamp recorded: 2026-11-22T18:35:29.242Z"
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
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "aa7b750a05969a211b3e9b9c92601a951c1bb21aff021b26404eb9c20a8ba8d9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

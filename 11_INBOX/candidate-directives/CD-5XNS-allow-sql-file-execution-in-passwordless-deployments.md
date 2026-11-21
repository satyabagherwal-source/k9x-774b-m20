# Candidate Directive: [CD-5XNS] allow SQL file execution in passwordless deployments

<!-- PROVENANCE_START
{
  "source_repository": "t8y2/dbx",
  "source_url": "https://github.com/t8y2/dbx",
  "source_version": "5f5ec9c1",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T23:47:47.752Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-t8y2-dbx",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [t8y2/dbx](https://github.com/t8y2/dbx) (Revision: `5f5ec9c1`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T23:47:47.752Z`  
> **Learning ID**: `learn-github-t8y2-dbx`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/dbx-web/src/routes/sql_file.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in t8y2/dbx. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0685e9f4`: web): allow SQL file execution in passwordless deployments. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/dbx-web/src/routes/sql_file.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Failure-log owner for the Web runtime (dbx#11619): the authenticated
/// session token when one exists. Deployments that disable password protection
/// (`DBX_DISABLE_PASSWORD`) never log in, so the browser carries no
/// `dbx_session` cookie even though the auth middleware lets every API call
/// through; without this fallback those deployments could not execute SQL
/// files at all ("Not authenticated"), while every other feature worked.
/// Anonymous deployments share one owner, exactly how the desktop runtime
/// shares "desktop": with no sessions there is nothing to isolate.
const ANONYMOUS_FAILURE_LOG_OWNER: &str = "web-shared";

fn web_failure_log_owner(headers: &HeaderMap) -> String {
    crate::auth::session_token_from_headers(headers).unwrap_or_else(|| ANONYMOUS_FAILURE_LOG_OWNER.to_string())
}

    let log_owner = web_failure_log_owner(&headers);
    let owner = web_failure_log_owner(&headers);
    let owner = web_failure_log_owner(&headers);
    let owner = web_failure_log_owner(&headers);
    #[test]
    fn failure_log_owner_falls_back_to_a_shared_owner_without_a_session_cookie() {
        // Deployments with password protection disabled never log in, so the
      
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    let log_owner = crate::auth::session_token_from_headers(&headers)
        .ok_or_else(|| AppError::from("Not authenticated".to_string()))?;
    let owner = crate::auth::session_token_from_headers(&headers)
        .ok_or_else(|| AppError::from("Not authenticated".to_string()))?;
    let owner = crate::auth::session_token_from_headers(&headers)
        .ok_or_else(|| AppError::from("Not authenticated".to_string()))?;
    let owner = crate::auth::session_token_from_headers(&headers)
        .ok_or_else(|| AppError::from("Not authenticated".to_string()))?;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0685e9f4` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T23:47:47.750Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795304867750",
    "title": "allow SQL file execution in passwordless deployments",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "t8y2/dbx",
    "source_uri": "https://github.com/t8y2/dbx",
    "source_version": "HEAD",
    "content_hash": "ac344c9cfbc8e24f80f663ddd5daf22043e8eeb4b098ecad9809e59d63e60464"
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
        "Harvested/verified timestamp recorded: 2026-11-21T23:47:47.750Z"
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
  "auth_token": "de74ded9438ba5e4f4e248c8f501e175fbeca4cfa61ca21b2324d328aa953953"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

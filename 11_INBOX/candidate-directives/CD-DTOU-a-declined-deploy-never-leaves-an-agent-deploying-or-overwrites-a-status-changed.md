# Candidate Directive: [CD-DTOU] A declined deploy never leaves an agent deploying or overwrites a status changed

<!-- PROVENANCE_START
{
  "source_repository": "Nasiko-Labs/nasiko",
  "source_url": "https://github.com/Nasiko-Labs/nasiko",
  "source_version": "93091516",
  "license": "NOASSERTION",
  "timestamp": "2026-11-26T20:04:20.238Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nasiko-labs-nasiko",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Nasiko-Labs/nasiko](https://github.com/Nasiko-Labs/nasiko) (Revision: `93091516`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-26T20:04:20.238Z`  
> **Learning ID**: `learn-github-nasiko-labs-nasiko`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `server/src/agents/update.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Nasiko-Labs/nasiko. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f42d5f18`: A declined deploy never leaves an agent deploying or overwrites a status changed during the build. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `server/src/agents/update.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        status: String,
        "SELECT name, version, image, status, owner_id, writable, writable_path FROM agents WHERE id = $1",
        status: prev_status,
        prev_status: Some(prev_status),
    prev_status: Option<String>,
    // Set when the runtime declines the deploy, so the user is told why instead of a generic reason.
    let mut declined = None;
        let deploy_status = scaling.deploy(&spec).await.map_err(|e| {
            declined = super::utils::declined_message(&e);
            format!("deploy: {e}")
        })?;
            // A deploy the runtime declined is no failure of the agent, which keeps the status it
            // had (a stopped or parked agent stays so); a job queued before the status was carried
            // has none to restore and ends `failed`, as does one that read another update's
            // `deploying` placeholder.
            let status = match (&declined, &prev_status) {
                (Some(_), Some(prev)) if prev != "deploying" => prev.as_str(),
                _ => "failed",
            };
            // The status moves only while the row still says `deploying`: one someone set during
            // the build (a stop) is not ove
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        "SELECT name, version, image, owner_id, writable, writable_path FROM agents WHERE id = $1",
        let deploy_status = scaling
            .deploy(&spec)
            .await
            .map_err(|e| format!("deploy: {e}"))?;
                "UPDATE agents SET status = 'failed', version = $2, image = $3, updated_at = now() \
                 WHERE id = $1",
            // clients read it via GET /agents/uploads; the detail lives in the build logs.
                Some("agen
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f42d5f18` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T20:04:20.235Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795723460235",
    "title": "A declined deploy never leaves an agent deploying or overwrites a status changed",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Nasiko-Labs/nasiko",
    "source_uri": "https://github.com/Nasiko-Labs/nasiko",
    "source_version": "HEAD",
    "content_hash": "561127548d90ca2529fb2374681dc6ad4d1c849e8e492aafd2bf673d4cbbb253"
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
        "Harvested/verified timestamp recorded: 2026-11-26T20:04:20.235Z"
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
  "auth_token": "03aeeb10e339f79f6e209b57fdbd5bcdff4b8b397fcd9def19a78faf6e515c51"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

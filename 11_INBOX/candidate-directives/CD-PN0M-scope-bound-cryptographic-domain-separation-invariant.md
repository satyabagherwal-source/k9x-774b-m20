# Candidate Directive: [CD-PN0M] Scope-Bound Cryptographic Domain Separation Invariant

<!-- PROVENANCE_START
{
  "source_repository": "iii-hq-iii-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T22:07:48.034Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-iii-hq-iii-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [iii-hq-iii-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T22:07:48.034Z`  
> **Learning ID**: `LEARN-EVO-iii-hq-iii-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When issuing security capability tokens derived from a shared master secret, every derived token MUST bind to its specific execution target via HMAC using an explicit, immutable domain separation prefix that includes the protocol version and a null terminator (`b"prefix/v1\0"`). Authorization checks MUST perform validation using constant-time MAC verification.

**WHY**:
Without domain separation bytes and contextual binding (such as a target `state_key`), an authorization token generated for one resource can be replayed against another resource or subsystem sharing the same root credential. Non-constant-time comparisons introduce timing oracle attacks revealing HMAC bytes sequentially.

**WHEN TO APPLY**:
Multi-tenant daemon systems, container-to-host adapters, RPC function authorization, token delegation, and micro-VM sandbox control channels.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified pattern from crates/iii-sandbox-contract/src/worker.rs
use hmac::{Hmac, Mac};
use sha2::Sha256;

const SCOPED_AUTH_DOMAIN: &[u8] = b"iii-sandbox/worker-scope/v1\0";

pub fn scoped_auth_token(project_token: &str, state_key: &str) -> String {
    hex::encode(scoped_mac(project_token, state_key).finalize().into_bytes())
}

pub fn scoped_auth_matches(project_token: &str, state_key: &str, presented: &str) -> bool {
    // Invariant: Reject empty credentials immediately before computing MAC
    if project_token.is_empty() || state_key.is_empty() {
        return false;
    }
    let Ok(tag) = hex::decode(presented) else {
        return false;
    };
    // Constant-time verification prevents side-channel timing attacks
    scoped_mac(project_token, state_key)
        .verify_slice(&tag)
        .is_ok()
}

fn scoped_mac(project_token: &str, state_key: &str) -> Hmac<Sha256> {
    let mut mac = Hmac::<Sha256>::new_from_slice(project_token.as_bytes())
        .expect("HMAC-SHA256 accepts variable length keys");
    mac.update(SCOPED_AUTH_DOMAIN);
    mac.update(state_key.as_bytes());
    mac
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER DO THIS: Raw string hashing without domain separation or constant-time check
fn unsafe_token_check(project_token: &str, state_key: &str, presented: &str) -> bool {
    // Security flaw: Empty tokens allow forgeability

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T22:07:48.166Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795126068166",
    "title": "Scope-Bound Cryptographic Domain Separation Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "iii-hq-iii-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "47f65fbe8116a8cdd2216077393d64e7aa4c40643549a65072957d33b3deeb4e"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T22:07:48.166Z"
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
  "auth_token": "af6a7a54384ca3ecb0590b37c645f3d662fb0e5d725fcb574c4cb874a283669e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

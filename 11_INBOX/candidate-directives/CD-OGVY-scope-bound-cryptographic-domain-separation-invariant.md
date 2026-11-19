# Candidate Directive: [CD-OGVY] Scope-Bound Cryptographic Domain Separation Invariant

<!-- PROVENANCE_START
{
  "source_repository": "iii-hq/iii",
  "source_url": "https://github.com/iii-hq/iii",
  "source_version": "7fd8bb9f",
  "license": "PERMISSIVE_OPEN_SOURCE",
  "timestamp": "2026-11-19T22:06:53.566Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-iii-hq-iii",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [iii-hq/iii](https://github.com/iii-hq/iii) (Revision: `7fd8bb9f`).  
> **License**: PERMISSIVE_OPEN_SOURCE | **Timestamp**: `2026-11-19T22:06:53.566Z`  
> **Learning ID**: `learn-github-iii-hq-iii`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    // Security flaw: No domain separator enables cross-protocol token collision
    let digest = sha256_hash(format!("{project_token}{state_key}"));
    // Security flaw: Standard string equality is subject to timing attacks!
    digest == presented 
}
```

**VERIFICATION METHOD**:
Execute property-based testing:
1. Verify that `scoped_auth_matches(master, "vm-1", scoped_auth_token(master, "vm-2"))` evaluates strictly to `false`.
2. Verify that `scoped_auth_matches("", "", "")` evaluates to `false`.
3. Assert that byte comparison uses `subtle::ConstantTimeEq` or `Mac::verify_slice`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T22:06:53.565Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795126013565",
    "title": "Scope-Bound Cryptographic Domain Separation Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "iii-hq/iii",
    "source_uri": "https://github.com/iii-hq/iii",
    "source_version": "HEAD",
    "content_hash": "7f517fd847b4d227b9458c648e38caf8c31f246e58517d710b0dd24d3588c103"
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
        "Harvested/verified timestamp recorded: 2026-11-19T22:06:53.565Z"
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
  "auth_token": "bb870567469b5472964b903e141a17adfd24c8b0a59d94e6989075a28d92b727"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

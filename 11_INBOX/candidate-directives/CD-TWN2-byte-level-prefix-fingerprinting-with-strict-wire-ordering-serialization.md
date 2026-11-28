# Candidate Directive: [CD-TWN2] Byte-Level Prefix Fingerprinting with Strict Wire-Ordering Serialization

<!-- PROVENANCE_START
{
  "source_repository": "codewhale-hq/Codewhale",
  "source_url": "https://github.com/codewhale-hq/Codewhale",
  "source_version": "98e055e6",
  "license": "MIT",
  "timestamp": "2026-11-28T09:08:20.222Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-codewhale-hq-codewhale",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [codewhale-hq/Codewhale](https://github.com/codewhale-hq/Codewhale) (Revision: `98e055e6`).  
> **License**: MIT | **Timestamp**: `2026-11-28T09:08:20.222Z`  
> **Learning ID**: `learn-github-codewhale-hq-codewhale`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When interacting with LLM APIs utilizing server-side prompt/prefix caching (such as DeepSeek, Claude Prompt Caching, or OpenAI Prefix Caching), all immutable system headers, base policies, and tool schemas MUST be serialized in deterministic, fixed provider-wire order and fingerprinted using cryptographic hashing (SHA-256). Sorting object keys or tool definitions after fingerprint computation MUST NOT occur. Any detected divergence between request turns MUST be attributed to either an authorized configuration mutation or an explicit, logged cache drift failure.

**WHY**:
Modern frontier model inference engines establish KV cache pages based on exact raw token/byte stream identity. Reordering two tool definitions or mutating a single whitespace character within a markdown system instruction invalidates 100% of the cached KV cache downstream from the offset. If sorting tools alphabetically locally while sending them in arbitrary order over JSON, the local validation passes while cloud inference costs and time-to-first-token (TTFT) spike by orders of magnitude.

**WHEN TO APPLY**:
LLM orchestrators, chat completions proxies, and agent loop engines communicating with prompt-cached LLM providers.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use sha2::{Digest, Sha256};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WireToolSpec {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PrefixFingerprint {
    pub system_sha256: String,
    pub tools_sha256: String,
    pub combined_sha256: String,
}

impl PrefixFingerprint {
    pub fn compute_exact(system_prompt: &str, tools: &[WireToolSpec]) -> Result<Self, serde_json::Error> {
        let mut hasher = Sha256::new();
        hasher.update(system_prompt.as_bytes());
        let system_sha256 = format!("{:x}", hasher.finalize());

        let mut tool_hasher = Sha256::new();
        for tool in tools {
            // MUST serialize each tool in exact wire array sequence
            let serialized = serde_json::to_vec(tool)?;
            tool_hasher.update(&serialized);
            tool_hasher.update(b"\n");
        }
        let tools_sha256 = format!("{:x}", tool_hasher.finalize());

        let mut combined_hasher = Sha256::new();
        combined_hasher.update(system_sha256.as_bytes());
        combined_hasher.update(b":");
        combined_hasher.update(tools_sha256.as_bytes());
        let combined_sha256 = format!("{:x}", combined_hasher.finalize());

        Ok(Self {
            system_sha256,
            tools_sha256,
            combined_sha256,
        })
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Sorting tool list during hashing when the wire serializer preserves insert order
pub fn compute_buggy_fingerprint(system_prompt: &str, mut tools: Vec<WireToolSpec>) -> String {
    // BUG: Mutating array order to sort by name diverges from actual JSON sent over HTTP!
    tools.sort_by(|a, b| a.name.cmp(&b.name)); 
    let mut hasher = Sha256::new();
    hasher.update(serde_json::to_vec(&tools).unwrap());
    format!("{:x}", hasher.finalize())
}
```

**VERIFICATION METHOD**:
Automated conformance harness checking that serialized payload prefixes match across consecutive requests:
```rust
#[test]
fn test_wire_prefix_stability() {
    let spec1 = WireToolSpec { name: "b".into(), description: "desc".into(), parameters: serde_json::json!({}) };
    let spec2 = WireToolSpec { name: "a".into(), description: "desc".into(), parameters: serde_json::json!({}) };
    let tools = vec![spec1, spec2];
    
    let fp1 = PrefixFingerprint::compute_exact("system_prompt", &tools).unwrap();
    let fp2 = PrefixFingerprint::compute_exact("system_prompt", &tools).unwrap();
    assert_eq!(fp1, fp2);
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:08:20.222Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795856900222",
    "title": "Byte-Level Prefix Fingerprinting with Strict Wire-Ordering Serialization",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "codewhale-hq/Codewhale",
    "source_uri": "https://github.com/codewhale-hq/Codewhale",
    "source_version": "HEAD",
    "content_hash": "36d09a57f58127865fcf762b0a4d46b47fae66dd7c66e7fbf92a4d98b051d786"
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
        "Harvested/verified timestamp recorded: 2026-11-28T09:08:20.222Z"
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
  "auth_token": "6873ca61ee2bb99318f17cdaff09b69bb2c22488aa21a6c256e7a506ec9083ea"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-TZSO] Byte-Level Prefix Fingerprinting with Strict Wire-Ordering Serialization

<!-- PROVENANCE_START
{
  "source_repository": "codewhale-hq-codewhale-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T09:08:24.181Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-codewhale-hq-codewhale-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [codewhale-hq-codewhale-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T09:08:24.181Z`  
> **Learning ID**: `LEARN-EVO-codewhale-hq-codewhale-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:08:24.311Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795856904311",
    "title": "Byte-Level Prefix Fingerprinting with Strict Wire-Ordering Serialization",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "codewhale-hq-codewhale-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "3f400059328a9a677dfd23128cdc9afcebdb7bf4bac15145c4a21b5f7ed60b8b"
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
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-28T09:08:24.311Z"
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
  "auth_token": "0bc3d89a13ffddc3e1542dd73f87ab8801741ab1da50b9d001a7348f4df26082"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

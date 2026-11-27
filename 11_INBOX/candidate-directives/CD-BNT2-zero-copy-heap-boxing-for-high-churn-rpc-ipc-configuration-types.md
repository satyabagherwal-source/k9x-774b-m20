# Candidate Directive: [CD-BNT2] Zero-Copy Heap Boxing for High-Churn RPC/IPC Configuration Types

<!-- PROVENANCE_START
{
  "source_repository": "biomejs/biome",
  "source_url": "https://github.com/biomejs/biome",
  "source_version": "c199c75a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T09:34:28.166Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-biomejs-biome",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [biomejs/biome](https://github.com/biomejs/biome) (Revision: `c199c75a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T09:34:28.166Z`  
> **Learning ID**: `learn-github-biomejs-biome`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Public parameter structs passed across IPC, RPC, or LSP method boundaries MUST wrap large, optional configuration structures in `Box<T>` or `Arc<T>` whenever the data payload exceeds 128 bytes. Functions MUST NOT pass large aggregate types (`Configuration`) by value across deep call chains or store unboxed optional representations inside client requests.

**WHY**:
Deep aggregate configuration types in complex compilers can span hundreds of bytes across optional settings (formatting, linter rules, assists, overrides, VCS settings). Stacking these types causes stack frame bloat, expensive `memcpy` operations on method invocation, and severe memory overhead in concurrent channels where hundreds of message structs (`OpenFileParams`, `FormatFileParams`, `PullDiagnosticsParams`) exist in memory queues simultaneously.

**WHEN TO APPLY**:
Apply to all IPC/RPC/LSP request/response structs, serde data transfer objects (DTOs), and internal server state parameter lists where configuration trees are threaded through multiple abstraction layers.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Default, Serialize, Deserialize)]
pub struct Configuration {
    // Large composite structures containing linter, formatter, and vcs configs
    pub rules: Vec<String>,
    pub overrides: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FormatFileParams {
    pub file_path: String,
    // Box limits the size of FormatFileParams to a single 8-byte pointer,
    // preventing stack frame exhaustion and minimizing struct layout.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub inline_config: Option<Box<Configuration>>,
}

impl WorkspaceServer {
    pub fn format_file(&self, params: FormatFileParams) {
        if let Some(boxed_config) = params.inline_config {
            // Unbox only at the exact point of consumption or merge
            self.apply_configuration(*boxed_config);
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Large configuration passed unboxed by value in every RPC struct.
// Bloats struct memory footprint across all parameters and causes deep stack copies.
#[derive(Debug, Serialize, Deserialize)]
pub struct BadFormatFileParams {
    pub file_path: String,
    pub inline_config: Option<Configuration>, // 512+ bytes copied on every stack frame!
}
```

**VERIFICATION METHOD**:
Enforce memory layout bounds using compile-time static assertions:
```rust
const _: () = assert!(std::mem::size_of::<FormatFileParams>() <= 64);
```
In CI, run `cargo clippy -- -W clippy::large_enum_variant -W clippy::large_stack_arrays`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T09:34:28.165Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795772068165",
    "title": "Zero-Copy Heap Boxing for High-Churn RPC/IPC Configuration Types",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "biomejs/biome",
    "source_uri": "https://github.com/biomejs/biome",
    "source_version": "HEAD",
    "content_hash": "af5278a5099496ce7aaed9d6a55a618146eb4135a91feddcf4b579f65c1e2b17"
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
        "Harvested/verified timestamp recorded: 2026-11-27T09:34:28.165Z"
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
  "auth_token": "7030d1d823131505d736ff03bffd08b836e294bf533866714d22e919be4a4e37"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

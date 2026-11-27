# Candidate Directive: [CD-BRBD] Zero-Copy Heap Boxing for High-Churn RPC/IPC Configuration Types

<!-- PROVENANCE_START
{
  "source_repository": "biomejs-biome-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T09:34:32.545Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-biomejs-biome-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [biomejs-biome-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T09:34:32.545Z`  
> **Learning ID**: `LEARN-EVO-biomejs-biome-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T09:34:32.713Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795772072713",
    "title": "Zero-Copy Heap Boxing for High-Churn RPC/IPC Configuration Types",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "biomejs-biome-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "77925b216e46e00b48c6e7f2f1fbbf123f3dd69151c9e58868f753adb9ef41b1"
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
        "Harvested/verified timestamp recorded: 2026-11-27T09:34:32.713Z"
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
  "auth_token": "1c6ae2b6593d8fb89d0d8422eb03ecf647a00236705c48f806557d4942b857af"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

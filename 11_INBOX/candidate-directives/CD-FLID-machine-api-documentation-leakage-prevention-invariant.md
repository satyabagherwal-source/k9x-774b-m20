# Candidate Directive: [CD-FLID] Machine API Documentation Leakage Prevention Invariant

<!-- PROVENANCE_START
{
  "source_repository": "pimalaya/himalaya",
  "source_url": "https://github.com/pimalaya/himalaya",
  "source_version": "bf9f4e2a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T23:27:18.949Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pimalaya-himalaya",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pimalaya/himalaya](https://github.com/pimalaya/himalaya) (Revision: `bf9f4e2a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T23:27:18.949Z`  
> **Learning ID**: `learn-github-pimalaya-himalaya`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
Public JSON Schema descriptions emitted by a program MUST NOT include ecosystem-specific intra-doc link syntax (such as Rust `[` `]`, `//!`, or language-specific symbol links). All descriptions exposed in machine-readable schema contracts MUST be stated purely in JSON-native domain terminology (referencing `null` rather than `None`/`nil`, JSON primitive names, and standard RFC specifications).

**WHY**:
Emitting internal language-specific symbols or compiler link markdown syntax (`[` `]`) into generated JSON Schema artifacts breaks cross-language agent tooling, leaks implementation choices into external API contracts, and fails automated schema validators.

**WHEN TO APPLY**:
Apply to any schema generator, OpenAPI spec derive macro, or JSON Schema registry (`schemars`, `utoipa`, `serde-reflection`) that extracts doc-comments to populate OpenAPI/JSON-Schema descriptions.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use serde_json::Value;

pub fn assert_no_compiler_doc_links_in_schema(schema_root: &Value) -> Result<(), Vec<String>> {
    let mut violations = Vec::new();
    traverse_descriptions("root".to_string(), schema_root, &mut violations);
    if violations.is_empty() {
        Ok(())
    } else {
        Err(violations)
    }
}

fn traverse_descriptions(path: String, value: &Value, violations: &mut Vec<String>) {
    match value {
        Value::Object(map) => {
            for (key, val) in map {
                if key == "description" {
                    if let Value::String(desc) = val {
                        if desc.contains("[`") || desc.contains("`]") {
                            violations.push(format!("Path `{path}/description` holds intra-doc link: {desc}"));
                        }
                    }
                } else {
                    traverse_descriptions(format!("{path}/{key}"), val, violations);
                }
            }
        }
        Value::Array(arr) => {
            for (i, val) in arr.iter().enumerate() {
                traverse_descriptions(format!("{path}/{i}"), val, violations);
            }
        }
        _ => {}
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Rust intra-doc link inside struct that derives JsonSchema
use schemars::JsonSchema;
use serde::Serialize;

#[derive(Serialize, JsonSchema)]
pub struct MailboxStatus {
    /// Row from [`PimdirStatusOutput`]. // BUG: Leaks Rust intra-doc link to JSON Schema
    pub count: u64,
}
```

**VERIFICATION METHOD**:
Implement a global recursive schema walker test that runs across all registered schemas and their `$defs`:
```rust
#[test]
fn test_all_json_schemas_contain_no_doc_links() {
    let schema_val = serde_json::to_value(&schemars::schema_for!(MailboxStatus)).unwrap();
    let result = assert_no_compiler_doc_links_in_schema(&schema_val);
    assert!(result.is_ok(), "Doc link violations found: {:?}", result.err());
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T23:27:18.949Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795303638949",
    "title": "Machine API Documentation Leakage Prevention Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pimalaya/himalaya",
    "source_uri": "https://github.com/pimalaya/himalaya",
    "source_version": "HEAD",
    "content_hash": "86c9999f9a9228452910840d72df259e537a2ed80d9cda8b7faf80b7b433734c"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T23:27:18.949Z"
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
  "auth_token": "9064669480cf3734fb541d4529c75f66f09a5b2eb940d42e0e24744bfd81d116"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

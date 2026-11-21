# Candidate Directive: [CD-H23I] Machine API Documentation Leakage Prevention Invariant

<!-- PROVENANCE_START
{
  "source_repository": "pimalaya-himalaya-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T23:28:26.969Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-pimalaya-himalaya-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pimalaya-himalaya-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T23:28:26.969Z`  
> **Learning ID**: `LEARN-EVO-pimalaya-himalaya-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T23:28:27.102Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795303707102",
    "title": "Machine API Documentation Leakage Prevention Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pimalaya-himalaya-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "37b9544cb139abf02c66cd1aad774a07bce8205bc8fb5cc1622ed24e5bd0f64d"
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
        "Harvested/verified timestamp recorded: 2026-11-21T23:28:27.102Z"
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
  "auth_token": "1599dd9d38f34c4a80ab65ba615668fca6c55b52178f3d464db52121f0de7476"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

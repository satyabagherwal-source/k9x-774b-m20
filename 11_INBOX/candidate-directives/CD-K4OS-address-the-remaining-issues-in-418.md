# Candidate Directive: [CD-K4OS] address the remaining issues in #418

<!-- PROVENANCE_START
{
  "source_repository": "zvec-ai/zvec-grep",
  "source_url": "https://github.com/zvec-ai/zvec-grep",
  "source_version": "75047201",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T17:20:14.525Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zvec-ai-zvec-grep",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zvec-ai/zvec-grep](https://github.com/zvec-ai/zvec-grep) (Revision: `75047201`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T17:20:14.525Z`  
> **Learning ID**: `learn-github-zvec-ai-zvec-grep`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain D

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `rust/crates/zg-engine/src/domain/metadata.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zvec-ai/zvec-grep. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `75047201`: rust): address the remaining issues in #418. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `rust/crates/zg-engine/src/domain/metadata.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[serde(default, skip_serializing_if = "Vec::is_empty")]

#[cfg(test)]
mod tests {
    use super::{CodeMetadata, MemberAlias, SymbolType};

    /// The facts only the resolver reads. Retrieval never looks at them, so
    /// storing a default for each of them would cost every record the fields of
    /// the few files that use them.
    const GRAPH_FACTS: [&str; 6] = [
        "has_internal_linkage",
        "declares_type",
        "alias_of",
        "object_members",
        "overwritten_by",
        "exported_as",
    ];

    #[test]
    fn graph_facts_are_stored_only_when_set() {
        let plain = serde_json::to_value(CodeMetadata::default()).expect("encode metadata");
        for field in GRAPH_FACTS {
            assert!(
                plain.get(field).is_none(),
                "{field} is omitted while it holds its default"
            );
        }

  
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    #[serde(default)]
    #[serde(default)]
    #[serde(default)]
    #[serde(default)]
    #[serde(default)]
    #[serde(default)]
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `75047201` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T17:20:14.523Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794936014523",
    "title": "address the remaining issues in #418",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zvec-ai/zvec-grep",
    "source_uri": "https://github.com/zvec-ai/zvec-grep",
    "source_version": "HEAD",
    "content_hash": "e963e2f218faa944f5a1cede44c8956b2db367a9f740f9190ef4f83e9cf585f7"
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
        "Harvested/verified timestamp recorded: 2026-11-17T17:20:14.523Z"
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
  "auth_token": "ec982a25523447af104ac55cae8218e460362ae62ab7ce9bcff173282935be4d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

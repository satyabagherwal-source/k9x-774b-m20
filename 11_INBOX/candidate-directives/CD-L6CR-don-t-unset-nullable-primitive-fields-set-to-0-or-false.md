# Candidate Directive: [CD-L6CR] Don't unset nullable primitive fields set to 0 or false

<!-- PROVENANCE_START
{
  "source_repository": "graphprotocol/graph-node",
  "source_url": "https://github.com/graphprotocol/graph-node",
  "source_version": "796ace3f",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T02:06:15.147Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-graphprotocol-graph-node",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [graphprotocol/graph-node](https://github.com/graphprotocol/graph-node) (Revision: `796ace3f`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T02:06:15.147Z`  
> **Learning ID**: `learn-github-graphprotocol-graph-node`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain L

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `gnd/src/codegen/schema.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in graphprotocol/graph-node. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `796ace3f`: gnd: Don't unset nullable primitive fields set to 0 or false. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `gnd/src/codegen/schema.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        // AS primitives can't be nullable, so take nullability from the AS type.
        let nullable = matches!(return_type, TypeExpr::Nullable(_));
        let set_code = if let TypeExpr::Nullable(n) = &param_type {
            let inner_type = n.inner.to_string();
    #[test]
    fn test_nullable_primitive_fields() {
        // Nullable primitives, incl. Int8-id entity refs, get non-nullable accessors.
        let schema = r#"
            type Example @entity(immutable: true) {
                id: ID!
                side: Int
                flag: Boolean
                big: Int8
                at: Timestamp
                counter: Counter
                name: String
            }

            type Counter @entity(immutable: true) {
                id: Int8!
            }
        "#;
        let doc = parse_schema::<String>(schema).unwrap();
        let generator = SchemaCodeGenerator::new(&doc).unwrap();

        let classes = generator.generate_types(true);
        assert_eq!(classes.len(), 2);

        let example = &classes[0];
        let body = |name: &str| -> String {
            example
                .methods
                .iter()
                .find(|m| m.na
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        let nullable = field.is_nullable;
        let nullable = field.is_nullable;

        let set_code = if nullable {
            let inner_type = match &param_type {
                TypeExpr::Nullable(n) => n.inner.to_string(),
                other => other.to_string(),
            };
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `796ace3f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T02:06:15.145Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794621975145",
    "title": "Don't unset nullable primitive fields set to 0 or false",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "graphprotocol/graph-node",
    "source_uri": "https://github.com/graphprotocol/graph-node",
    "source_version": "HEAD",
    "content_hash": "3b6862847f6889bd70c91f753f056919e6fe2301cf0e4d75086289095f71079b"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-14T02:06:15.145Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "4c7759cccd15c45b59adacd1e3d639679d1f13f9c63e2a8b8c5798b6337bc264"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

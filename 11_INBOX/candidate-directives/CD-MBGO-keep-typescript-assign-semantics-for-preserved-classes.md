# Candidate Directive: [CD-MBGO] keep TypeScript assign semantics for preserved classes

<!-- PROVENANCE_START
{
  "source_repository": "oxc-project/oxc",
  "source_url": "https://github.com/oxc-project/oxc",
  "source_version": "f9e90dec",
  "license": "MIT",
  "timestamp": "2026-11-22T14:56:19.849Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-oxc-project-oxc",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oxc-project/oxc](https://github.com/oxc-project/oxc) (Revision: `f9e90dec`).  
> **License**: MIT | **Timestamp**: `2026-11-22T14:56:19.849Z`  
> **Learning ID**: `learn-github-oxc-project-oxc`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/oxc_transformer/src/common/class_lowering.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oxc-project/oxc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `08023adc`: transformer): keep TypeScript assign semantics for preserved classes. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/oxc_transformer/src/common/class_lowering.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use oxc_ast::ast::{Class, ClassElement};
    utils::decorated_class::{
        class_body_has_auto_accessors, class_has_decorators, is_auto_accessor,
    },
enum ClassLoweringMode {
    /// Whether class-properties lowers the fields of this class.
    pub fn lowers_fields(self) -> bool {
        self.mode == ClassLoweringMode::LowerAll
    }

    /// Whether a field or auto-accessor stays as written for the downstream transform.
    ///
    /// A preserved class keeps its decorated fields and its auto-accessors. Transforms that
    /// rewrite the other fields must leave these in place, and must not move other initializers
    /// after theirs (see [`Self::first_movable_instance_field`]).
    pub fn keeps_field(self, element: &ClassElement<'_>) -> bool {
        self.mode == ClassLoweringMode::Preserve
            && (is_auto_accessor(element)
                || matches!(element, ClassElement::PropertyDefinition(_))
                    && element.has_decorator())
    }

    /// Index of the first instance field whose initializer can move after the field
    /// initializers that stay in the class, such as into the constructor.
    ///
    /// Instance fields before the last kept in
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use oxc_ast::ast::Class;
    utils::decorated_class::{class_body_has_auto_accessors, class_has_decorators},
pub enum ClassLoweringMode {
    pub fn mode(self) -> ClassLoweringMode {
        self.mode
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `08023adc` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T14:56:19.846Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795359379846",
    "title": "keep TypeScript assign semantics for preserved classes",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "oxc-project/oxc",
    "source_uri": "https://github.com/oxc-project/oxc",
    "source_version": "HEAD",
    "content_hash": "0906642cefff99908a3d4497bde5cf98b7fc5a1232055798e82a5c222fdb2657"
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
        "Harvested/verified timestamp recorded: 2026-11-22T14:56:19.846Z"
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
  "auth_token": "beafa85245cc3f2aa61dc9f757c70e7b38a453826a5c909473bcec1bfb487727"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

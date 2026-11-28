# Candidate Directive: [CD-R9NC] Invariant Separation of Concrete vs Widenable Binding Types in Flow Analysis

<!-- PROVENANCE_START
{
  "source_repository": "biomejs-biome-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T09:34:16.598Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-biomejs-biome-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [biomejs-biome-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T09:34:16.598Z`  
> **Learning ID**: `LEARN-EVO-biomejs-biome-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
A static analysis type-inference engine MUST NOT widen a binding's type upon cross-scope assignment if that binding either:
1. Possesses an explicit type annotation, OR
2. Was initialized with a concrete, non-primitive constructor/type instantiation (e.g., `new Map<K, V>()`).

Cross-scope write-widening MUST be strictly restricted to bindings whose inferred initial type is explicitly marked as widenable: `unknown`, nullish (`null` | `undefined`), or primitive literals (e.g., `false`, `0`, `""`).

**WHY**:
When an analysis engine infers the type of a variable from multiple scopes without tracking strict control-flow ordering, cross-scope reassignments (such as inside a teardown or `reset()` function reassigning `visits = new Map()`) will pollute the binding's inferred type union with un-parameterized or `any`-typed instances (`Map<string, number> | Map<any, any>`). Subsequent property/method accesses (e.g., `.get()`) will return `any`, poisoning downstream consumers and producing cascades of false-positive warnings (e.g., `noUnsafeReturn`, `noExplicitAny`).

**WHEN TO APPLY**:
Compilers, linters, and type checkers performing whole-program or module-level type recovery where execution order across functional boundaries is indeterminate.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// crates/biome_module_graph/src/type_collector.rs

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BindingWidenability {
    Widenable,
    Preserved,
}

impl RawTypeCollector {
    /// Determines whether a binding's type can be widened by assignments in cross-scope write references.
    pub fn is_widenable_binding_type(&self, type_id: RawTypeId) -> BindingWidenability {
        match self.resolve_type(type_id) {
            // Nullish, unknown, and primitive literals are eligible for widening
            TypeData::Unknown | TypeData::Null | TypeData::Undefined => BindingWidenability::Widenable,
            TypeData::Literal(_) => BindingWidenability::Widenable,
            TypeData::Union(union) => {
                let all_widenable = union.types.iter().all(|&member_id| {
                    self.is_widenable_binding_type(member_id) == BindingWidenability::Widenable
                });
                if all_widenable {
                    BindingWidenability::Widenable
                } else {
                    BindingWidenability::Preserved
                }
            }
            // Classes, interfaces, explicit generics, and builtins MUST NEVER be widened cross-scope
            TypeData::Class(_) | TypeData::Interface(_) | TypeData::Function(_) => {
                BindingWidenability::Preserved
            }
        }
    }
}

// In the module-level traversal pass:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:34:16.725Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795858456724",
    "title": "Invariant Separation of Concrete vs Widenable Binding Types in Flow Analysis",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "biomejs-biome-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "fa1dc09dd104df57701bb460f65ba90e8b66af0781690fa33cff52ad55126711"
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
        "Harvested/verified timestamp recorded: 2026-11-28T09:34:16.725Z"
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
  "auth_token": "b9670c92f12eb2076c63f7e70e2a18681bb8de052065bb00d767f8f8e0a285bb"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

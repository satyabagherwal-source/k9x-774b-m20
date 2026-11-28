# Candidate Directive: [CD-MUGI] Invariant Separation of Concrete vs Widenable Binding Types in Flow Analysis

<!-- PROVENANCE_START
{
  "source_repository": "biomejs/biome",
  "source_url": "https://github.com/biomejs/biome",
  "source_version": "71660779",
  "license": "Apache-2.0",
  "timestamp": "2026-11-28T09:30:50.418Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-biomejs-biome",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [biomejs/biome](https://github.com/biomejs/biome) (Revision: `71660779`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-28T09:30:50.418Z`  
> **Learning ID**: `learn-github-biomejs-biome`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
if declarator.type_annotation().is_none() {
    let initial_type = collector.infer_initializer_type(declarator.initializer());
    if collector.is_widenable_binding_type(initial_type) == BindingWidenability::Widenable {
        collector.widen_binding_from_writable_references(binding_id);
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER widen indiscriminately across scope boundaries based solely on writable references
for write_ref in binding.writable_references() {
    // BUG: If binding was `let map = new Map<string, number>();` and `write_ref` is `map = new Map();`
    // this creates `Map<string, number> | Map<any, any>` -> .get() now yields `any`!
    binding_type = union(binding_type, infer_write_type(write_ref));
}
```

**VERIFICATION METHOD**:
Verify using a negative type-leak regression test:
```rust
#[test]
fn test_infer_module_types_does_not_widen_concrete_or_annotated_maps_on_reassignment() {
    let code = r#"
        let visits = new Map<string, number>();
        function reset() {
            visits = new Map();
        }
        export function getVisit(k: string) {
            return visits.get(k); // Invariant: Return type MUST be `number | undefined`, NEVER `any`
        }
    "#;
    let module = parse_and_infer(code);
    let return_type = module.get_export_return_type("getVisit");
    assert!(!return_type.contains_any(), "Concrete binding was leaked into any!");
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T09:30:50.416Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795858250416",
    "title": "Invariant Separation of Concrete vs Widenable Binding Types in Flow Analysis",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "biomejs/biome",
    "source_uri": "https://github.com/biomejs/biome",
    "source_version": "HEAD",
    "content_hash": "b9b49b7460f9c922c6050e4b0078eba2e11b626390c8cf2d4fc62ced174cebf0"
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
        "Harvested/verified timestamp recorded: 2026-11-28T09:30:50.416Z"
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
  "auth_token": "3c56d0e71e514ca12ab9926ced81273943641d5feee55d9afca8c0b3e7237baf"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

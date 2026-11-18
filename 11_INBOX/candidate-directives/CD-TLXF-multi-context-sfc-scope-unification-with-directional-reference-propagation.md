# Candidate Directive: [CD-TLXF] Multi-Context SFC Scope Unification with Directional Reference Propagation

<!-- PROVENANCE_START
{
  "source_repository": "fallow-rs/fallow",
  "source_url": "https://github.com/fallow-rs/fallow",
  "source_version": "548aba6d",
  "license": "MIT",
  "timestamp": "2026-11-18T05:35:26.787Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-fallow-rs-fallow",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fallow-rs/fallow](https://github.com/fallow-rs/fallow) (Revision: `548aba6d`).  
> **License**: MIT | **Timestamp**: `2026-11-18T05:35:26.787Z`  
> **Learning ID**: `learn-github-fallow-rs-fallow`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: PROMPT_INJECTION_DETECTED: Adversarial prompt injection pattern detected: "<script>"
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain B

## Original Learning Payload (100% Preserved)
**RULE**:
Static analyzers evaluating Single File Component (SFC) architectures containing multiple execution blocks (e.g., Vue's `<script>` vs `<script setup>`, Svelte's `<script module>` vs instance `<script>`) **MUST** unify symbol analysis into a directed acyclic bipartite scope graph where references only flow along the framework's compile-time visibility vectors:
- **Vue**: Bindings declared/imported in `<script>` are visible to `<script setup>` and `<template>`. Bindings in `<script setup>` **MUST NOT** be visible to or credit imports in `<script>`.
- **Svelte**: Bindings in `<script module>` are visible to the instance `<script>` and markup. Instance bindings **MUST NOT** credit or satisfy module script references.
Top-level unresolved references from child scopes **MUST** credit matching imports of parent scopes *before* reporting unused bindings or dead exports.

**WHY**:
SFC compilers merge split scripts into a single synthetic ES module at bundle time. Parsing each script block in isolation causes the engine to see imports in the module scope as unreferenced, because their call-sites exist in the setup/template AST. Reporting these imports as unused results in false positives that prompt developers to strip code, directly breaking downstream components at compile time. Conversely, bidirectional crediting creates false negatives by allowing setup-only variables to incorrectly satisfy module declarations.

**WHEN TO APPLY**:
Static analyzers, dead-code detectors, and symbol indexing engines processing Vue (`.vue`), Svelte (`.svelte`), Astro (`.astro`), or SvelteKit components where multiple `<script>` contexts coexist.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use rustc_hash::FxHashSet;

#[derive(Default)]
pub struct SfcSharedScopeTracker {
    /// Unresolved value references in the seeing scope (e.g., <script setup> or template)
    unresolved_value_refs: FxHashSet<String>,
    /// Unresolved type references in the seeing scope
    unresolved_type_refs: FxHashSet<String>,
    /// Imports provided by the visible module scope (e.g., plain <script>)
    visible_module_imports: FxHashSet<String>,
}

impl SfcSharedScopeTracker {
    /// Directional credit phase: Only seeing scope unresolved references can credit seen imports.
    pub fn reconcile_cross_block_credits(
        &self,
        unused_module_imports: &mut FxHashSet<String>,
    ) {
        let credited_names: Vec<String> = self
            .visible_module_imports
            .iter()
            .filter(|&import_name| {
                self.unresolved_value_refs.contains(import_name)
                    || self.unresolved_type_refs.contains(import_name)
            })
            .cloned()
            .collect();

        for name in credited_names {
            unused_module_imports.remove(&name);
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Analyzing SFC script blocks as isolated standalone modules or merging symmetrically
fn merge_sfc_blocks_bad(block1_unused: FxHashSet<String>, block2_unused: FxHashSet<String>) -> FxHashSet<String> {
    // FAILS: Symmetrical intersection or isolated emission creates false positives
    // and ignores the directed visibility contract.
    block1_unused.intersection(&block2_unused).cloned().collect()
}
```

**VERIFICATION METHOD**:
Execute an end-to-end extraction test with an SFC declaring an import in `<script>` used exclusively in `<script setup>` or `<template>`. The test must assert zero unused export findings on the upstream source module:
```rust
#[test]
fn sfc_directional_credit_verifies_clean_export() {
    let result = fallow_core::analyze(&config).expect("analysis should succeed");
    assert!(!result.unused_exports.iter().any(|e| e.export.export_name == "usedOnlyInSetup"));
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T05:35:26.787Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: PROMPT_INJECTION_DETECTED: Adversarial prompt injection pattern detected: \"<script>\"",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794980126787",
    "title": "Multi-Context SFC Scope Unification with Directional Reference Propagation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fallow-rs/fallow",
    "source_uri": "https://github.com/fallow-rs/fallow",
    "source_version": "HEAD",
    "content_hash": "25e33b9540bc8ff5d1c5d6160525ab71a29b9b087521101987ee0e88673c6613"
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
      "status": "FAIL",
      "score": 0,
      "directive_opposition": false,
      "opposing_rule": null,
      "is_adversarial": true,
      "has_dangerous_security": false,
      "unsupported_assumptions": [],
      "findings": [
        "PROMPT_INJECTION_DETECTED: Adversarial prompt injection pattern detected: \"<script>\""
      ],
      "details": [
        "External instructions attempting to override AI constraints rejected fail-closed."
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
        "Harvested/verified timestamp recorded: 2026-11-18T05:35:26.787Z"
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
  "auth_token": "901587c81390e653bbb94632994656bc5a1d50ea04a24b357cd6c4ebfe4a1a9e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

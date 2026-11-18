# Candidate Directive: [CD-UDPL] Multi-Context SFC Scope Unification with Directional Reference Propagation

<!-- PROVENANCE_START
{
  "source_repository": "fallow-rs-fallow-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T05:36:02.682Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-fallow-rs-fallow-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fallow-rs-fallow-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T05:36:02.682Z`  
> **Learning ID**: `LEARN-EVO-fallow-rs-fallow-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records; PROMPT_INJECTION_DETECTED: Adversarial prompt injection pattern detected: "<script>"
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T05:36:02.793Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records; PROMPT_INJECTION_DETECTED: Adversarial prompt injection pattern detected: \"<script>\"",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794980162793",
    "title": "Multi-Context SFC Scope Unification with Directional Reference Propagation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fallow-rs-fallow-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "569494dde23d600114b76d513ca94cc537c1b873a7a6e4f41edff1c6fb1d7fbf"
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
        "Harvested/verified timestamp recorded: 2026-11-18T05:36:02.793Z"
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
  "auth_token": "b3cd0f491d6be8374591b3c721d11faf42d0e6da784e0f16c9448058d7cf55bd"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-UDPL] Invariant Atomic Preservation of Shared Compound Declarations

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
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When an automated refactoring engine or code-fix agent identifies an unused identifier within a compound or destructured declaration statement (e.g., `export const { a, b } = expr;`, `export const [x, y] = fn();`, or `export let i = 1, j = 2;`), it **MUST NOT** split the declaration statement or remove the shared visibility modifier keyword unless **ALL** identifiers declared in that single statement are proven unused. If any identifier remains referenced or retained, the removal **MUST** be withheld and emitted as a structured skipped diagnostic (`applied: false, skipped: true`).

**WHY**:
Splitting a shared destructuring or comma-separated variable statement into independent declarations to isolate an exported component causes catastrophic semantic and runtime side effects:
1. **Side-Effect Re-Execution**: Splitting `const { a, b } = sideEffectInit();` into `const a = sideEffectInit().a; export const b = sideEffectInit().b;` evaluates the initializer expression twice, breaking stateful initializers, network requests, or database counter increments.
2. **Rest Element Mutation**: In `const [head, ...tail] = stream;`, duplicating or decomposing initializers invalidates iterator consumption and mutates rest array semantics.
3. **Compilation Failures**: Deleting the shared `export` keyword because name `a` is unused instantly drops the export contract of name `b`, producing TypeScript compile errors `TS2306` ("File is not a module") or `TS2459` ("Module has no exported member").

**WHEN TO APPLY**:
Apply to all source-code refactoring tools, AST mutation engines, linters with autofix (ESLint plugins, Biome analyzers, Rust refactoring assistants), and AI coding agent toolchains working in languages featuring compound bindings (TypeScript, JavaScript, Python multi-assignment, Rust destructuring tuple/struct bindings).

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use rustc_hash::FxHashSet;

#[derive(Debug, PartialEq, Eq)]
pub struct SharedDeclaration {
    pub start_line: usize,
    pub start_col: usize,
    pub end_line: usize,
    pub bound_identifiers: Vec<String>,
}

impl SharedDeclaration {
    pub fn contains_binding(&self, line_idx: usize, identifier: &str) -> bool {
        (self.start_line..=self.end_line).contains(&line_idx)
            && self.bound_identifiers.iter().any(|b| b == identifier)
    }
}

pub struct SharedDeclarationIndex {
    declarations: Vec<SharedDeclaration>,
    unsafe_lines: FxHashSet<usize>,
}

impl SharedDeclarationIndex {
    /// Evaluates whether an `export` modifier removal can safely proceed.
    /// Invariant: Returns true ONLY when all names bound by the statement are targeted for removal.
    pub fn can_remove_export_modifier(
        &self,
        decl_idx: usize,
        names_targeted_for_removal: &FxHashSet<&str>,
    ) -> bool {
        let decl = &self.declarations[decl_idx];
        decl.bound_identifiers
            .iter()
            .all(|name| names_targeted_for_removal.contains(name.as_str()))
    }

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T05:36:02.789Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794980162789",
    "title": "Invariant Atomic Preservation of Shared Compound Declarations",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fallow-rs-fallow-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "0ca7ac07edd0f9eb13dc7eb9bd147b7a2969af1f84dfece8533b94365d1d5491"
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
        "Harvested/verified timestamp recorded: 2026-11-18T05:36:02.790Z"
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
  "auth_token": "a0b6fcdc3d97e95be9e25fd19b3e408116dcc16e4c9ec7f609692654e2f3081f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

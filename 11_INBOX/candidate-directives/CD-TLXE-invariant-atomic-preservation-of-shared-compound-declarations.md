# Candidate Directive: [CD-TLXE] Invariant Atomic Preservation of Shared Compound Declarations

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
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Naively removing the export keyword or attempting an unverified syntactic split
// Given source: export const { config, runTask } = initializeEngine();
// Unused: config | Live: runTask

// BUGGY AUTO-FIX VARIANT A (Deletes export keyword):
const { config, runTask } = initializeEngine(); // FAILS: runTask is no longer exported! TS2459

// BUGGY AUTO-FIX VARIANT B (Naive split):
const config = initializeEngine().config;       // FAILS: Evaluates initializeEngine() twice!
export const runTask = initializeEngine().runTask;
```

**VERIFICATION METHOD**:
Enforce an automated integration test with compound initializers that assert single-evaluation invariants and check type diagnostics:
```bash
# Verify that running the fixer on a partially unused compound export preserves the keyword
cargo test -p fallow-cli --test integration_test -- test_destructured_export_keeps_modifier
# Ensure generated TypeScript passes type checking without TS2306 or TS2459
npx tsc --noEmit --project tsconfig.json
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T05:35:26.785Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794980126784",
    "title": "Invariant Atomic Preservation of Shared Compound Declarations",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fallow-rs/fallow",
    "source_uri": "https://github.com/fallow-rs/fallow",
    "source_version": "HEAD",
    "content_hash": "f969b83dc0edd249641f435253a5a6305b31a7da76f700ae3f81a37439761684"
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
        "Harvested/verified timestamp recorded: 2026-11-18T05:35:26.785Z"
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
  "auth_token": "186f47b1c00a3b8e18188c32bacf4d7bd7000b3608f581b4f9c79f4572e4c078"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

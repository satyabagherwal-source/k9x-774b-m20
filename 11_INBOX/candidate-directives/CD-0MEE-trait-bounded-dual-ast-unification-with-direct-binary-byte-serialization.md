# Candidate Directive: [CD-0MEE] Trait-Bounded Dual AST Unification with Direct Binary Byte Serialization

<!-- PROVENANCE_START
{
  "source_repository": "rollup-rollup-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T08:17:34.182Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-rollup-rollup-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rollup-rollup-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T08:17:34.182Z`  
> **Learning ID**: `LEARN-EVO-rollup-rollup-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When mapping heterogeneous abstract syntax structures from an external native compiler (e.g., SWC) to a target consumer specification (e.g., ESTree AST), disparate syntactic structures that share semantic structural fields (such as block statements and function bodies) MUST be unified through a shared Rust trait rather than duplicated conversion implementations. AST nodes MUST be written sequentially into pre-allocated memory buffers via calculated byte-offset markers.

**WHY**:
Duplicating parsing and conversion code across `BlockStmt` (regular code blocks) and `FunctionBody` (function contents) causes drift in AST directive handling (`"use strict"` / `"use client"`), breaks location span offset calculations, and doubles binary translation maintenance. Direct binary offset writing prevents dynamic allocation and pointer chasing inside V8, reducing memory consumption when transferring 100k+ node ASTs across the native/JS FFI boundary.

**WHEN TO APPLY**:
Native Rust/C++ extensions parsing and serializing ASTs, bytecode, or IR across FFI boundaries into JavaScript, WebAssembly, or another host runtime.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// rust/parse_ast/src/ast_nodes/block_statement.rs pattern
use swc_common::Span;
use swc_ecma_ast::{BlockStmt, Expr, FunctionBody, Lit, Stmt};

pub(crate) trait BlockStatementBody {
    fn span(&self) -> &Span;
    fn stmts(&self) -> &[Stmt];
}

impl BlockStatementBody for BlockStmt {
    #[inline(always)]
    fn span(&self) -> &Span { &self.span }
    #[inline(always)]
    fn stmts(&self) -> &[Stmt] { &self.stmts }
}

impl BlockStatementBody for FunctionBody {
    #[inline(always)]
    fn span(&self) -> &Span { &self.span }
    #[inline(always)]
    fn stmts(&self) -> &[Stmt] { &self.stmts }
}

// Unified parser implementation utilizing the unified abstraction
impl<'a> AstConverter<'a> {
    pub(crate) fn store_block_statement<T: BlockStatementBody>(
        &mut self,
        block: &T,
        check_directive: bool,
    ) {
        let span = block.span();
        let stmts = block.stmts();
        
        let end_position = self.add_type_and_start(
            &TYPE_BLOCK_STATEMENT,
            span,
            BLOCK_STATEMENT_RESERVED_BYTES,
            false,

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T08:17:34.309Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795853854309",
    "title": "Trait-Bounded Dual AST Unification with Direct Binary Byte Serialization",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rollup-rollup-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f2d2ab28ae0da036ae723b21ffc4c764e31db22f3be63aa2730558670f6277b5"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-28T08:17:34.309Z"
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
  "auth_token": "a79d9c054cb71c6049e110c09bfe2d1a018a82152b424570cebfddca16afc958"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

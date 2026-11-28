# Candidate Directive: [CD-Z90K] Trait-Bounded Dual AST Unification with Direct Binary Byte Serialization

<!-- PROVENANCE_START
{
  "source_repository": "rollup/rollup",
  "source_url": "https://github.com/rollup/rollup",
  "source_version": "73d63952",
  "license": "NOASSERTION",
  "timestamp": "2026-11-28T08:16:30.308Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rollup-rollup",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rollup/rollup](https://github.com/rollup/rollup) (Revision: `73d63952`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-28T08:16:30.308Z`  
> **Learning ID**: `learn-github-rollup-rollup`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
        );

        let mut keep_checking_directives = check_directive;
        self.convert_item_list_with_state(
            stmts,
            end_position + BLOCK_STATEMENT_BODY_OFFSET,
            &mut keep_checking_directives,
            |converter, statement, can_be_directive| {
                if *can_be_directive {
                    if let Stmt::Expr(expr_stmt) = statement {
                        if let Expr::Lit(Lit::Str(s)) = &*expr_stmt.expr {
                            converter.store_directive(expr_stmt, s.value.as_atom().unwrap());
                            return (true, None);
                        }
                    }
                }
                *can_be_directive = false;
                converter.convert_statement(statement);
                (true, None)
            },
        );

        self.add_end(end_position, span);
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Divergent boilerplate and manual duplication
impl<'a> AstConverter<'a> {
    pub fn store_block(&mut self, b: &BlockStmt) {
        // Repeated serialization logic 1
    }
    pub fn store_fn_body(&mut self, b: &FunctionBody) {
        // Repeated serialization logic 2: prone to divergence in directive processing
    }
}
```

**VERIFICATION METHOD**:
Rust unit test using a property test or parity assertion between SWC AST inputs:
```rust
#[test]
fn verify_block_and_fn_body_serialization_parity() {
    let mut conv1 = AstConverter::new();
    let mut conv2 = AstConverter::new();
    // Verify that identical statements produce byte-identical binary buffers
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T08:16:30.307Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795853790307",
    "title": "Trait-Bounded Dual AST Unification with Direct Binary Byte Serialization",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rollup/rollup",
    "source_uri": "https://github.com/rollup/rollup",
    "source_version": "HEAD",
    "content_hash": "d091014ab7afc849361623336eb742f811c50259365366d69b4dd678023a0232"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-28T08:16:30.307Z"
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
  "auth_token": "5808b1910dc17eaa714d4caf200efe501aa0cf44cf9e2405dadd1a14d2c6c685"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

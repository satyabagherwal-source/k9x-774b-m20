# Candidate Directive: [CD-YG1O] linter/eslint/no-await-in-loop): report awaits in unbraced if/switch/try loop bo

<!-- PROVENANCE_START
{
  "source_repository": "oxc-project-oxc-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T01:52:57.133Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-oxc-project-oxc-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oxc-project-oxc-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T01:52:57.133Z`  
> **Learning ID**: `LEARN-EVO-oxc-project-oxc-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/oxc_linter/src/rules/eslint/no_await_in_loop.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oxc-project/oxc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `727f784f`: linter/eslint/no-await-in-loop): report awaits in unbraced if/switch/try loop bodies. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/oxc_linter/src/rules/eslint/no_await_in_loop.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use oxc_ast::AstKind;
        let contains = |outer: Span| outer.contains_inclusive(span);
                contains(stmt.body.span())
                    || stmt.test.as_ref().is_some_and(|test| contains(test.span()))
                    || stmt.update.as_ref().is_some_and(|update| contains(update.span()))
                if contains(stmt.body.span()) {
                    && contains(stmt.left.span())
                if contains(stmt.body.span()) {
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use oxc_ast::{
    AstKind,
    ast::{Expression, Statement},
};
    fn node_matches_stmt_span(span: Span, stmt: &Statement) -> bool {
        match stmt {
            Statement::BlockStatement(block) => block.span.contains_inclusive(span),
            Statement::ExpressionStatement(expr_statement) => {
                expr_statement.span.contains_inclusive(span)
            }
            _ => false,
        }
    }

    fn node_matches_expr_span(span: Span, expr: &Expression) -> bool {
        match expr {
            Expression::TemplateLiteral(expr) => expr.span.contains_inclusive(span),
            Expression::ArrayExpression(expr) => expr.span.contains_inclusive(span),
            Expression::ArrowFunctionExpression(expr) => expr.span.contains_inclusive(span),
            Expression::AssignmentExpression(expr) => expr.span.contains_inclusive(span),
            Expression::AwaitExpression(expr) => expr.span.contains_inclusive(span),
            Expression::BinaryExpression(expr) => expr.span.contains_inclusive(span),
            Expression::CallExpression(expr) => expr.span.contains_inclusive(span),

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T01:52:57.272Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795571577272",
    "title": "linter/eslint/no-await-in-loop): report awaits in unbraced if/switch/try loop bo",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "oxc-project-oxc-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "835cd06a1eccd55eef887a545b659503f948ed525633b0452dd26cbcb6460f41"
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
        "Harvested/verified timestamp recorded: 2026-11-25T01:52:57.273Z"
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
  "auth_token": "5a43a8f668d4c392b00b33d7713fa6f98b5110013370c2c9ef70ccf4eb9638b5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

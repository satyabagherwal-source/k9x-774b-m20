# Candidate Directive: [CD-08SG] semantic): preserve catch and var binding identities

<!-- PROVENANCE_START
{
  "source_repository": "oxc-project-oxc-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T15:49:46.899Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-oxc-project-oxc-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oxc-project-oxc-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T15:49:46.899Z`  
> **Learning ID**: `LEARN-EVO-oxc-project-oxc-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/oxc_linter/src/rules/eslint/block_scoped_var.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oxc-project/oxc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1dc0ee95`: semantic): preserve catch and var binding identities. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/oxc_linter/src/rules/eslint/block_scoped_var.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use crate::{AstNode, context::LintContext, rule::Rule, utils::declarator_initializes};
            ) && redeclaration_has_write(declaration, redeclaration.span, *symbol, ctx)
fn redeclaration_has_write(
    node: &AstNode,
    span: Span,
    symbol_id: SymbolId,
    ctx: &LintContext,
) -> bool {
            // An initializer in another catch writes to its catch parameter,
            // even though the declaration also contributes to this hoisted var.
            return declarator_initializes(decl, symbol_id)
                && (decl.init.is_some()
                    || matches!(
                        ctx.nodes().parent_kind(ctx.nodes().parent_id(node.id())),
                        AstKind::ForInStatement(_) | AstKind::ForOfStatement(_)
                    ));
        // The declarator's identifier is attached to the catch parameter when
        // its initializer assigns there. This rule checks the hoisted var's uses.
        let symbol = ident.symbol_id();
        let symbol = ctx.scoping().catch_var_binding(symbol).unwrap_or(symbol);
        "function f() { try {} catch (x) { { var x = 1; } use(x); } }",
        "function f(x) { use(x); try {} catch (x) { var x = 1; } use(
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use crate::{AstNode, context::LintContext, rule::Rule};
            ) && redeclaration_has_write(declaration, redeclaration.span, ctx)
fn redeclaration_has_write(node: &AstNode, span: Span, ctx: &LintContext) -> bool {
            return decl.init.is_some()
                || matches!(
                    ctx.nodes().parent_kind(ctx.nodes().parent_id(node.id())),
                    AstKind::ForInStatement(_) | AstKind::ForOfStatement(_)
                );
        let Some(symbol) = ctx.scoping().find_binding(node_scope_id, name) else {

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T15:49:47.004Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794671387004",
    "title": "semantic): preserve catch and var binding identities",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "oxc-project-oxc-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "92a9becc72debcaba8bbeea264d2b20efc81fb5bb8216fc331f23561118fe0d4"
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
        "Harvested/verified timestamp recorded: 2026-11-14T15:49:47.005Z"
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
  "auth_token": "754d8b4bf234e916a72bca08b0b3a6a91a9e6562156b69684b8f4a976826797c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

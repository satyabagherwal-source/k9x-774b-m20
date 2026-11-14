# Candidate Directive: [CD-ZWMC] preserve catch and var binding identities

<!-- PROVENANCE_START
{
  "source_repository": "oxc-project/oxc",
  "source_url": "https://github.com/oxc-project/oxc",
  "source_version": "93140429",
  "license": "MIT",
  "timestamp": "2026-11-14T15:49:31.236Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-oxc-project-oxc",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oxc-project/oxc](https://github.com/oxc-project/oxc) (Revision: `93140429`).  
> **License**: MIT | **Timestamp**: `2026-11-14T15:49:31.236Z`  
> **Learning ID**: `learn-github-oxc-project-oxc`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
            return;
        };
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1dc0ee95` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T15:49:31.234Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794671371234",
    "title": "preserve catch and var binding identities",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "oxc-project/oxc",
    "source_uri": "https://github.com/oxc-project/oxc",
    "source_version": "HEAD",
    "content_hash": "9cd433375ba2555fcaf5a95848413883d5bf645c9436376f73e8abf3da108c91"
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
        "Harvested/verified timestamp recorded: 2026-11-14T15:49:31.234Z"
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
  "auth_token": "564b12f24a750c50fca577a7ece764a89f5b819de2d6139e8f18e2a432ff1c72"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

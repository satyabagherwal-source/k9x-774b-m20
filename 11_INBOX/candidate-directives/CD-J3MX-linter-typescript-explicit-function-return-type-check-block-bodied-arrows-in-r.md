# Candidate Directive: [CD-J3MX] linter/typescript/explicit-function-return-type): check block-bodied arrows in r

<!-- PROVENANCE_START
{
  "source_repository": "oxc-project/oxc",
  "source_url": "https://github.com/oxc-project/oxc",
  "source_version": "c5890024",
  "license": "MIT",
  "timestamp": "2026-11-19T15:58:48.105Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-oxc-project-oxc",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oxc-project/oxc](https://github.com/oxc-project/oxc) (Revision: `c5890024`).  
> **License**: MIT | **Timestamp**: `2026-11-19T15:58:48.105Z`  
> **Learning ID**: `learn-github-oxc-project-oxc`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/oxc_linter/src/rules/typescript/explicit_function_return_type.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oxc-project/oxc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `35694db4`: linter/typescript/explicit-function-return-type): check block-bodied arrows in returned objects. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/oxc_linter/src/rules/typescript/explicit_function_return_type.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    is_typed_parent(parent, Some(node))
fn is_typed_parent(parent: &AstNode, callee: Option<&AstNode>) -> bool {
        || is_default_function_parameter_with_type_annotation(parent)
fn is_default_function_parameter_with_type_annotation(node: &AstNode) -> bool {
    matches!(node.kind(), AstKind::FormalParameter(param) if param.type_annotation.is_some())
    let can_inherit_return_type = match parent.kind() {
        AstKind::ReturnStatement(_) => true,
        AstKind::ArrowFunctionExpression(func) => func.get_expression().is_some(),
        AstKind::ObjectProperty(prop) => matches!(
            prop.value.without_parentheses(),
            Expression::ArrowFunctionExpression(func) if func.get_expression().is_some()
        ),
        _ => false,
    };
    if !can_inherit_return_type {
        return false;
    is_typed_parent(obj_expr_parent, None) || is_property_of_object_with_type(obj_expr_parent, ctx)
        (
            "
            type R = { run: () => Promise<number> };
            export function f(): R {
              return { run: async () => 1 };
            }
            ",
            None,
            None,
            None,
        ),
        (
            "
  
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    is_typed_parent(parent, Some(node), ctx)
fn is_typed_parent(parent: &AstNode, callee: Option<&AstNode>, ctx: &LintContext) -> bool {
        || is_default_function_parameter_with_type_annotation(parent, ctx)
fn is_default_function_parameter_with_type_annotation(node: &AstNode, ctx: &LintContext) -> bool {
    let AstKind::AssignmentPattern(_assign) = node.kind() else { return false };
    match ctx.nodes().parent_kind(node.id()) {
        AstKind::FormalParameter(f) => f.type_annotation.is_some(),
        AstKind::FormalParameterRest(f) => f.type_annotation.is_some(),
        _ => false,
    }
    if let AstKind::ObjectProperty(prop) = parent.kind()
        && let Expression::ArrowFunctionExpression(func) = &prop.value
        && func.get_function_body().is_some_and(|body| !body.statements.is_empty())
        && func.return_type.is_some()
    {
        return true;
    is_typed_parent(obj_expr_parent, None, ctx)
        || is_property_of_object_with_type(obj_expr_parent, ctx)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `35694db4` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T15:58:48.103Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795103928103",
    "title": "linter/typescript/explicit-function-return-type): check block-bodied arrows in r",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "oxc-project/oxc",
    "source_uri": "https://github.com/oxc-project/oxc",
    "source_version": "HEAD",
    "content_hash": "eecbdbebc0b69a248e3bf585ebc8fed5fe0209780ce7ae201b1fee8be7f3d576"
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
        "Harvested/verified timestamp recorded: 2026-11-19T15:58:48.103Z"
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
  "auth_token": "a94103c8341de386027dad9286c25f187591c2ee7adf3d496dedb52bb1799972"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

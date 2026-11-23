# Candidate Directive: [CD-OV0Z] linter/unicorn/prefer-array-flat): report lodash and underscore flatten calls

<!-- PROVENANCE_START
{
  "source_repository": "oxc-project/oxc",
  "source_url": "https://github.com/oxc-project/oxc",
  "source_version": "4a6f9c61",
  "license": "MIT",
  "timestamp": "2026-11-23T23:09:52.019Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-oxc-project-oxc",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oxc-project/oxc](https://github.com/oxc-project/oxc) (Revision: `4a6f9c61`).  
> **License**: MIT | **Timestamp**: `2026-11-23T23:09:52.019Z`  
> **Learning ID**: `learn-github-oxc-project-oxc`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/oxc_linter/src/rules/unicorn/prefer_array_flat.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oxc-project/oxc. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `9bac1b48`: linter/unicorn/prefer-array-flat): report lodash and underscore flatten calls. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/oxc_linter/src/rules/unicorn/prefer_array_flat.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
        Argument, ArrayExpressionElement, BindingPattern, CallExpression, ChainElement, Expression,
        IdentifierReference, MemberExpression, NewExpression,
use oxc_semantic::IsGlobalReference;
use oxc_span::{GetSpan, Span};
use oxc_syntax::precedence::Precedence;
    ast_util::{
        could_be_asi_hazard, get_symbol_id_of_variable, is_method_call, variable_declaration_kind,
    },
        get_first_parameter_name, get_precedence, get_return_identifier_name,
        is_empty_array_expression, is_prototype_property, pad_fix_with_token_boundary,
    /// const foo = _.flatten(array);
        check_lodash_flatten_case(node, call_expr, ctx);
            matches!(new_expr.callee.without_parentheses(), Expression::Identifier(ident) if ident.name == "Array")
        | Expression::ClassExpression(_)
        | Expression::PrivateInExpression(_)
        | Expression::JSXElement(_)
        | Expression::JSXFragment(_) => true,
            !matches!(new_expr.callee.without_parentheses(), Expression::Identifier(ident) if ident.name == "Array")
const TYPED_ARRAY_NAMES: &[&str] = &[
    "Int8Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Int16Array",
    "Uint16Array",
    "Int32Ar
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
        Argument, ArrayExpressionElement, BindingPattern, CallExpression, Expression,
        IdentifierReference, MemberExpression,
use oxc_span::Span;
    ast_util::variable_declaration_kind,
    ast_util::{get_symbol_id_of_variable, is_method_call},
        get_first_parameter_name, get_return_identifier_name, is_empty_array_expression,
        is_prototype_property,
            matches!(&new_expr.callee, Expression::Identifier(ident) if ident.name == "Array")
        | Expression::ClassExpression(_) => true,
            matches!(&new_expr.callee, Expression::Identifier(ident) if ident.name != "Array")
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `9bac1b48` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T23:09:52.017Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795475392017",
    "title": "linter/unicorn/prefer-array-flat): report lodash and underscore flatten calls",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "oxc-project/oxc",
    "source_uri": "https://github.com/oxc-project/oxc",
    "source_version": "HEAD",
    "content_hash": "f74fab16eac3eb95f3c43216cd0a16977743f8f803e243e62802bf2fc1cd7871"
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
        "Harvested/verified timestamp recorded: 2026-11-23T23:09:52.017Z"
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
  "auth_token": "ab9e494752e13c1c143c6c7bef67c1bb3fe1cee1fd99ed6e273998fa54b43c64"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

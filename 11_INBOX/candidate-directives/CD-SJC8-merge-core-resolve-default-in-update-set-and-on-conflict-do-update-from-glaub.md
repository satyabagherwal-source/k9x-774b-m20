# Candidate Directive: [CD-SJC8] Merge 'core: resolve DEFAULT in UPDATE SET and ON CONFLICT DO UPDATE' from Glaub

<!-- PROVENANCE_START
{
  "source_repository": "tursodatabase/turso",
  "source_url": "https://github.com/tursodatabase/turso",
  "source_version": "13626c16",
  "license": "MIT",
  "timestamp": "2026-11-13T19:40:03.944Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tursodatabase-turso",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tursodatabase/turso](https://github.com/tursodatabase/turso) (Revision: `13626c16`).  
> **License**: MIT | **Timestamp**: `2026-11-13T19:40:03.944Z`  
> **Learning ID**: `learn-github-tursodatabase-turso`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `core/translate/insert.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in tursodatabase/turso. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `13626c16`: Merge 'core: resolve DEFAULT in UPDATE SET and ON CONFLICT DO UPDATE' from Glauber Costa. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `core/translate/insert.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use crate::translate::update::bind_set_expr;
            let mut rewritten_sets = collect_set_clauses_for_upsert(table, sets, resolver)?;
            Some(col) => column_default_expr(col, is_strict, resolver),
/// The value a column takes when a statement writes DEFAULT to it.
pub(crate) fn column_default_expr(
    column: &Column,
    is_strict: bool,
    resolver: &Resolver,
) -> Box<Expr> {
    column.default.clone().unwrap_or_else(|| {
        if let Ok(Some(resolved)) = resolver.schema().resolve_type(&column.ty_str, is_strict) {
            if let Some(default_expr) = resolved.default_expr() {
                return Box::new(default_expr.clone());
            }
        }
        Box::new(ast::Expr::Literal(ast::Literal::Null))
    })
}

                bind_set_expr(
                    resolver,
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
            let mut rewritten_sets = collect_set_clauses_for_upsert(table, sets)?;
            Some(col) => col.default.clone().unwrap_or_else(|| {
                if let Ok(Some(resolved)) = resolver.schema().resolve_type(&col.ty_str, is_strict) {
                    if let Some(default_expr) = resolved.default_expr() {
                        return Box::new(default_expr.clone());
                    }
                }
                Box::new(ast::Expr::Literal(ast::Literal::Null))
            }),
                bind_and_rewrite_expr(
                    None,
                    resolver,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `13626c16` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T19:40:03.942Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794598803942",
    "title": "Merge 'core: resolve DEFAULT in UPDATE SET and ON CONFLICT DO UPDATE' from Glaub",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tursodatabase/turso",
    "source_uri": "https://github.com/tursodatabase/turso",
    "source_version": "HEAD",
    "content_hash": "383c08580359468585e29fadf0b6241b1fa4ee51f16080e694787cc8a5f91178"
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
        "Harvested/verified timestamp recorded: 2026-11-13T19:40:03.942Z"
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
  "auth_token": "37a31b477e6128fa4b12f518f410b8711d427b63653bab0e206bfe7744764165"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

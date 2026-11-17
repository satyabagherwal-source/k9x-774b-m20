# Candidate Directive: [CD-EOMV] AST/Visitor Default Base Traversal Stack-Termination Invariant

<!-- PROVENANCE_START
{
  "source_repository": "starrocks-starrocks-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T09:48:06.482Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-starrocks-starrocks-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [starrocks-starrocks-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T09:48:06.482Z`  
> **Learning ID**: `LEARN-EVO-starrocks-starrocks-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
In recursive visitor patterns operating on hierarchical tree structures (ASTs, Physical/Logical Operator Plans, Expression DAGs), an abstract intermediate visitor node MUST NOT delegate its default visit method back to the root `visit()` dispatcher without mutating the state or structurally narrowing the node type. Terminal implementations MUST be defined for all abstract intermediate categories, or dispatch directly to a terminal, non-recursive no-op.

**WHY**:
When an intermediate visitor method (e.g., `visitPhysicalScan`) delegates back to `visit(optExpression, context)`, and the dynamic dispatcher on `visit()` checks the runtime type and re-routes to `visitPhysicalScan` because no specialized sub-leaf handler exists, the system enters an infinite mutual recursion loop. This exhausts the JVM or native thread stack within milliseconds (`StackOverflowError` / SIGSEGV).

```
   visit(OptExpression)  <==============+
          |                             |
     (resolves to)                      |  (Mutual Infinite Recursion)
          |                             |
          v                             |
   visitPhysicalScan(OptExpression) ====+
```

**WHEN TO APPLY**:
Apply to all query optimizer frameworks, syntax parsers, compilers, and tree-walking algorithms across Java, C++, Python, and Rust.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Base Plan Visitor Pattern Invariant
public abstract class PlanVisitor<R, C> {
    public R visit(OptExpression expr, C context) {
        // Base root dispatcher
        return expr.getOp().accept(this, expr, context);
    }

    // Abstract intermediate classification MUST define terminal default behavior
    public R visitPhysicalScan(OptExpression expr, C context) {
        // INVARIANT: Do NOT call visit(expr, context) here!
        // Provide the fallback structural leaf printer/evaluator directly.
        PhysicalScanOperator scan = (PhysicalScanOperator) expr.getOp();
        return printGenericScanLeaf(scan, expr, context);
    }

    // Specific sub-classes override only when specializing behavior
    public R visitPhysicalOlapScan(OptExpression expr, C context) {
        return visitPhysicalScan(expr, context);
    }

    protected abstract R printGenericScanLeaf(PhysicalScanOperator scan, OptExpression expr, C context);
}
```

**NEGATIVE CONSTRAINT**:
```java
// ANTI-PATTERN: Cyclic fallback to top-level dispatcher
public class DangerousExplainVisitor extends PlanVisitor<OperatorStr, ExplainContext> {
    @Override

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T09:48:06.583Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794908886583",
    "title": "AST/Visitor Default Base Traversal Stack-Termination Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "starrocks-starrocks-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "710b5222897a73c8d20b3c93c389c335348265422ee9a1ca480309c550b9c3c1"
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
        "Harvested/verified timestamp recorded: 2026-11-17T09:48:06.583Z"
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
  "auth_token": "f7bec0e19b49a4016fc7fc58390a6decbe7dbad0e675a6cbd329cdf5da7fd916"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

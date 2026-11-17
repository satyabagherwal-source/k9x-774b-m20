# Candidate Directive: [CD-DZ4H] AST/Visitor Default Base Traversal Stack-Termination Invariant

<!-- PROVENANCE_START
{
  "source_repository": "StarRocks/starrocks",
  "source_url": "https://github.com/StarRocks/starrocks",
  "source_version": "7dd4de40",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T09:47:33.521Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-starrocks-starrocks",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [StarRocks/starrocks](https://github.com/StarRocks/starrocks) (Revision: `7dd4de40`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T09:47:33.521Z`  
> **Learning ID**: `learn-github-starrocks-starrocks`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    public OperatorStr visitPhysicalScan(OptExpression expr, ExplainContext context) {
        // FATAL DEFECT: Re-enters top-level dispatcher with identical expression.
        // If expr is an unrecognized scan (e.g., PaimonScan, DeltaLakeScan),
        // visit() resolves back to visitPhysicalScan, causing immediate StackOverflowError!
        return visit(expr, context);
    }
}
```

**VERIFICATION METHOD**:
Implement property-based AST generation testing where every leaf operator without an explicitly overridden visitor method is synthesized, registered, and traversed:
```java
@Test
public void verifyAllConcreteScansTerminateVisitor() {
    List<PhysicalScanOperator> operators = ScanRegistry.getAllConcreteInstances();
    ExplainVisitor visitor = new ExplainVisitor();
    for (PhysicalScanOperator op : operators) {
        OptExpression expr = new OptExpression(op);
        // Invariant: Must complete execution within 10,000 stack depth without StackOverflowError
        assertDoesNotThrow(() -> visitor.visit(expr, new ExplainContext()));
    }
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T09:47:33.520Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794908853520",
    "title": "AST/Visitor Default Base Traversal Stack-Termination Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "StarRocks/starrocks",
    "source_uri": "https://github.com/StarRocks/starrocks",
    "source_version": "HEAD",
    "content_hash": "6537878ef4a21c609e58cee08ec48c420b87a7ad568c882feb7ec6fb9d135802"
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
        "Harvested/verified timestamp recorded: 2026-11-17T09:47:33.521Z"
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
  "auth_token": "af7761fc636d6fecaa32f290fc3040f581b8dee095c863a2b3c9677202d68863"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

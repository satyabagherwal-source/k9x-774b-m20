# Candidate Directive: [CD-LX2Q] [BugFix] Leave a recursive CTE's self-reference out of the planner lock set

<!-- PROVENANCE_START
{
  "source_repository": "StarRocks/starrocks",
  "source_url": "https://github.com/StarRocks/starrocks",
  "source_version": "95ccbc34",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T10:50:45.554Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-starrocks-starrocks",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [StarRocks/starrocks](https://github.com/StarRocks/starrocks) (Revision: `95ccbc34`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T10:50:45.554Z`  
> **Learning ID**: `learn-github-starrocks-starrocks`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/PlannerMetaLocker.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in StarRocks/starrocks. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6df7ea85`: [BugFix] Leave a recursive CTE's self-reference out of the planner lock set. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/PlannerMetaLocker.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
import com.starrocks.sql.ast.QueryRelation;
import com.starrocks.sql.ast.UnionRelation;
        // Whether the with clause whose CTEs are being walked is WITH RECURSIVE; see visitCTE.
        private boolean inRecursiveWithClause = false;
            withCtes(cteRelations, false, () -> {
            withCtes(node.getCteRelations(), node.isHasRecursiveCTE(), () -> super.visitSelect(node, context));
            withCtes(node.getCteRelations(), node.isHasRecursiveCTE(), () -> super.visitSetOp(node, context));
        /**
         * Run {@code body} in a new with-clause scope, which {@link #visitCTE} fills as the CTEs are walked.
         * {@code recursive}: whether the clause is WITH RECURSIVE.
         */
        private void withCtes(List<CTERelation> cteRelations, boolean recursive, Runnable body) {
            boolean scoped = cteRelations != null && !cteRelations.isEmpty();
            boolean enclosingRecursive = inRecursiveWithClause;
            if (scoped) {
                cteNames.push(new HashSet<>());
            inRecursiveWithClause = recursive;
                inRecursiveWithClause = enclosingRecursive;
                if (scoped) {
                    cteNames.pop();
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
            withCtes(cteRelations, () -> {
            withCtes(node.getCteRelations(), () -> super.visitSelect(node, context));
            withCtes(node.getCteRelations(), () -> super.visitSetOp(node, context));
        /** Run {@code body} in a new with-clause scope, which {@link #visitCTE} fills as the CTEs are walked. */
        private void withCtes(List<CTERelation> cteRelations, Runnable body) {
            if (cteRelations == null || cteRelations.isEmpty()) {
                body.run();
                return;
            cteNames.push(new HashSet<>());
                cteNames.pop();
         * A CTE's name is in scope only after its own definition, as the analyzer has it: in
         * {@code WITH t0 AS (SELECT * FROM t0)} the inner {@code t0} is the table.
            super.visitCTE(node, context);
            if (!cteNames.isEmpty() && node.getName() != null) {
                cteNames.peek().add(node.getName());
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6df7ea85` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T10:50:45.552Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795690245552",
    "title": "[BugFix] Leave a recursive CTE's self-reference out of the planner lock set",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "StarRocks/starrocks",
    "source_uri": "https://github.com/StarRocks/starrocks",
    "source_version": "HEAD",
    "content_hash": "d67418fe6cc4fa012b20a9ab551d275b85dbb2fac6c63347126779710a58f156"
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
        "Harvested/verified timestamp recorded: 2026-11-26T10:50:45.552Z"
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
  "auth_token": "e3f10168cc5149ad61675b41f65978955b52783838ba3beed438fe22b07c0d12"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-B5L2] [BugFix] Resolve files() in expression subqueries before the planner lock

<!-- PROVENANCE_START
{
  "source_repository": "StarRocks/starrocks",
  "source_url": "https://github.com/StarRocks/starrocks",
  "source_version": "e183bb1f",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T04:54:08.390Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-starrocks-starrocks",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [StarRocks/starrocks](https://github.com/StarRocks/starrocks) (Revision: `e183bb1f`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T04:54:08.390Z`  
> **Learning ID**: `learn-github-starrocks-starrocks`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/QueryAnalyzer.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in StarRocks/starrocks. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `908f480d`: [BugFix] Resolve files() in expression subqueries before the planner lock. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `fe/fe-core/src/main/java/com/starrocks/sql/analyzer/QueryAnalyzer.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
        // The planner calls this when AnalyzerUtils#collectFileTableFunctionRelation finds a files() call; resolving
        // what that same walk finds leaves none of them to the analyzer, which runs under the planner lock.
        AnalyzerUtils.collectFileTableFunctionRelation(node).forEach(this::initializeFileTableIfAbsent);
    }

    private void initializeFileTableIfAbsent(FileTableFunctionRelation relation) {
        if (relation.getTable() instanceof TableFunctionTable) {
            return;
        }
        relation.setTable(resolveTableFunctionTable(relation.getProperties(), relation.getPushDownSchemaFunc()));
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
        new FilesOnlyVisitor().process(node, new Scope(RelationId.anonymous(), new RelationFields()));
    /**
     * A lightweight visitor that only resolves FileTableFunctionRelation so that
     * files() schema can be inferred without acquiring DB/table locks. Normal tables/views are skipped.
     */
    private class FilesOnlyVisitor implements AstVisitorExtendInterface<Scope, Scope> {
        public FilesOnlyVisitor() {}

        public Scope process(ParseNode node, Scope scope) {
            return node.accept(this, scope);
        }

        @Override
        public Scope visitQueryStatement(QueryStatement node, Scope parent) {
            QueryRelation queryRelation = node.getQueryRelation();
            if (queryRelation != null && !queryRelation.getCteRelations().isEmpty()) {
                for (CTERelation cteRelation : queryRelation.getCteRelations()) {
                    process(cteRelation.getCteQueryStatement(), parent);
                }
            }
            return process(queryRelation, parent);
        }

        @Override
        public Scope visitQueryRelation(QueryRelation node, Scope parent) {
            return process(node, parent);
        }

      
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `908f480d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T04:54:08.388Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795755248388",
    "title": "[BugFix] Resolve files() in expression subqueries before the planner lock",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "StarRocks/starrocks",
    "source_uri": "https://github.com/StarRocks/starrocks",
    "source_version": "HEAD",
    "content_hash": "c08b3b303ea35eacd467b4cbd7844057fa4d73d12ec1b511e967458d56f59ecf"
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
        "Harvested/verified timestamp recorded: 2026-11-27T04:54:08.388Z"
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
  "auth_token": "94819c7cb8364ffca1e93637cb08aad26da33825ac7f30cecd5c61eeadcb899e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

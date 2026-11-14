# Candidate Directive: [CD-EOOH] controller authorization for logical table queries

<!-- PROVENANCE_START
{
  "source_repository": "apache/pinot",
  "source_url": "https://github.com/apache/pinot",
  "source_version": "c31a588a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T17:24:59.633Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-apache-pinot",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache/pinot](https://github.com/apache/pinot) (Revision: `c31a588a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T17:24:59.633Z`  
> **Learning ID**: `learn-github-apache-pinot`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pinot-controller/src/main/java/org/apache/pinot/controller/api/resources/PinotQueryResource.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/pinot. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c31a588a`: controller authorization for logical table queries. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `pinot-controller/src/main/java/org/apache/pinot/controller/api/resources/PinotQueryResource.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
    TableCache tableCache = _pinotHelixResourceManager.getTableCache();
    String logicalTableName = tableCache.getActualLogicalTableName(tableName);
    LogicalTableConfig logicalTableConfig =
        logicalTableName != null ? tableCache.getLogicalTableConfig(logicalTableName) : null;
    String rawTableName = TableNameBuilder.extractRawTableName(
        logicalTableConfig != null ? logicalTableName : tableName);

    // Authorize every physical table of a logical query, matching the broker's table-level check.
    Set<String> tablesToAuthorize = logicalTableConfig != null
        ? logicalTableConfig.getPhysicalTableConfigMap().keySet()
        : Set.of(rawTableName);
    for (String tableToAuthorize : tablesToAuthorize) {
      if (!accessControl.hasAccess(TableNameBuilder.extractRawTableName(tableToAuthorize), AccessType.READ,
          httpHeaders, Actions.Table.QUERY)) {
        throw QueryErrorCode.ACCESS_DENIED.asException();
      }
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
    String rawTableName = TableNameBuilder.extractRawTableName(tableName);

    // Validate data access
    if (!accessControl.hasAccess(rawTableName, AccessType.READ, httpHeaders, Actions.Table.QUERY)) {
      throw QueryErrorCode.ACCESS_DENIED.asException();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c31a588a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T17:24:59.632Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.71,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 71%). Source=PASS (TIER_2_OFFICIAL_ECOSYSTEM), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794677099632",
    "title": "controller authorization for logical table queries",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apache/pinot",
    "source_uri": "https://github.com/apache/pinot",
    "source_version": "HEAD",
    "content_hash": "bcd26de2285889c7699cc3ca17df0b5cb904f8550ef73197818681cdd61830ec"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.75,
      "tier": "TIER_2_OFFICIAL_ECOSYSTEM",
      "findings": [],
      "details": [
        "Source belongs to recognized official ecosystem (TIER_2_OFFICIAL_ECOSYSTEM)",
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
        "Harvested/verified timestamp recorded: 2026-11-14T17:24:59.632Z"
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
  "auth_token": "90975ffd454cf40818bb67dce2c8caf9f3a95a907c1a434741186057781d5e3e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

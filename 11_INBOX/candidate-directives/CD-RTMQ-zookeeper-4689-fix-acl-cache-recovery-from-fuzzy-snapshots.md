# Candidate Directive: [CD-RTMQ] ZOOKEEPER-4689: Fix ACL cache recovery from fuzzy snapshots

<!-- PROVENANCE_START
{
  "source_repository": "apache-zookeeper-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T00:41:47.611Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-apache-zookeeper-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache-zookeeper-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T00:41:47.611Z`  
> **Learning ID**: `LEARN-EVO-apache-zookeeper-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `zookeeper-server/src/main/java/org/apache/zookeeper/server/DataTree.java`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in apache/zookeeper. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7f4ebb35`: ZOOKEEPER-4689: Fix ACL cache recovery from fuzzy snapshots. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `zookeeper-server/src/main/java/org/apache/zookeeper/server/DataTree.java`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
    // Deny watch delivery to ordinary sessions when a node's ACL is unknown.
    // checkACL treats null and empty ACLs as unrestricted. Public for tests.
    public static final List<ACL> NO_PERMISSIONS_ACL =
        Collections.singletonList(new ACL(0, ZooDefs.Ids.ANYONE_ID_UNSAFE));

            parentAcl = getACLForWatchTrigger(parent, parentName);
            // Intern the ACL before checking whether the node exists: a fuzzy
            // snapshot can contain the node but omit its ACL (ZOOKEEPER-3306).
            Long aclId = aclCache.convertAcls(acl);
                // Use the ACL value from the txn; snapshot ids are server-local
                // and may not resolve. Release the node's old reference to balance
                // convertAcls, including when both ids are equal.
                synchronized (existingChild) {
                    Long previousAcl = existingChild.acl;
                    existingChild.acl = aclId;
                    aclCache.removeUsage(previousAcl);
                    if (!aclId.equals(previousAcl)) {
                        LOG.info("ACL reference of existing node {} changed from {} to {} while applying a create txn",
                    
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
            parentAcl = getACL(parent);
            // Add the ACL to ACL cache first, to avoid the ACL not being
            // created race condition during fuzzy snapshot sync.
            //
            // This is the simplest fix, which may add ACL reference count
            // again if it's already counted in the ACL map of fuzzy
            // snapshot, which might also happen for deleteNode txn, but
            // at least it won't cause the ACL not exist issue.
            //
            // Later we can audit and delete all non-referenced ACLs from
            // ACL map when loading the snapshot/txns from disk, like what
            // we did for the global sessions.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T00:41:47.711Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795048907711",
    "title": "ZOOKEEPER-4689: Fix ACL cache recovery from fuzzy snapshots",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apache-zookeeper-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9ef05eb9868e28aef14c1f6ff190081fad13ea22e808ecd16ebcf2dbdf36bcdd"
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T00:41:47.712Z"
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
  "auth_token": "6abed51e974de98af2f46e372b5a2d3e183254fdae6e4d2285693a16f0674f17"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

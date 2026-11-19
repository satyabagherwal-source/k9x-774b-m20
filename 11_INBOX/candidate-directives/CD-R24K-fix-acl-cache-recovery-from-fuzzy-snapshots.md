# Candidate Directive: [CD-R24K] Fix ACL cache recovery from fuzzy snapshots

<!-- PROVENANCE_START
{
  "source_repository": "apache/zookeeper",
  "source_url": "https://github.com/apache/zookeeper",
  "source_version": "7f4ebb35",
  "license": "Apache-2.0",
  "timestamp": "2026-11-19T00:41:12.068Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-apache-zookeeper",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [apache/zookeeper](https://github.com/apache/zookeeper) (Revision: `7f4ebb35`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-19T00:41:12.068Z`  
> **Learning ID**: `learn-github-apache-zookeeper`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
            Long acls = aclCache.convertAcls(acl);
                existingChild.acl = acls;
            DataNode child = new DataNode(data, acls, stat);
            acl = getACL(node);
            parentAcl = getACL(parent);
            acl = getACL(n);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7f4ebb35` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T00:41:12.066Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.71,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 71%). Source=PASS (TIER_2_OFFICIAL_ECOSYSTEM), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795048872066",
    "title": "Fix ACL cache recovery from fuzzy snapshots",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "apache/zookeeper",
    "source_uri": "https://github.com/apache/zookeeper",
    "source_version": "HEAD",
    "content_hash": "48c1ebe8b6faf72db225af7c76a9e0006ac8cf3e13ee6b4022f06dbb12029106"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-19T00:41:12.066Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "f707197d1d1cade0355d551a74d21f2962b69e73c317b685438608e96b9aa9c8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

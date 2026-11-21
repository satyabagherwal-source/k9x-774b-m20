# Candidate Directive: [CD-8S2P] [BugFix] Count group roles and security-integration users in SHOW GRANTS FOR ROL

<!-- PROVENANCE_START
{
  "source_repository": "StarRocks/starrocks",
  "source_url": "https://github.com/StarRocks/starrocks",
  "source_version": "a9a9fd73",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T12:38:09.697Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-starrocks-starrocks",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [StarRocks/starrocks](https://github.com/StarRocks/starrocks) (Revision: `a9a9fd73`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T12:38:09.697Z`  
> **Learning ID**: `learn-github-starrocks-starrocks`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/en/sql-reference/sql-statements/account-management/SHOW_AUTHENTICATION.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in StarRocks/starrocks. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `87ba5c08`: [BugFix] Count group roles and security-integration users in SHOW GRANTS FOR ROLE, SHOW AUTHENTICATION and the HTTP admin check. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Java data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/en/sql-reference/sql-statements/account-management/SHOW_AUTHENTICATION.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```java
// Verified production-grade fix pattern:
A user that logs in through a security integration is not created in StarRocks: StarRocks creates a virtual user for its session. Such a user can view its own authentication information with `SHOW AUTHENTICATION` without `FOR`. It cannot be specified in `FOR USERNAME`, which accepts only users created in StarRocks, and it is not returned by `SHOW ALL AUTHENTICATION`.

| Password          | Whether a password is used to log in to the StarRocks cluster.<ul><li>`Yes`: A password is used.</li><li>`No`: No password is used.</li></ul>For a user that logs in through a security integration, `No` is returned, because StarRocks does not store its password. |
| AuthPlugin        | The interface that is used for authentication. Valid values: `MYSQL_NATIVE_PASSWORD` and `AUTHENTICATION_LDAP_SIMPLE`. If no interface is used, `NULL` is returned. For a user that logs in through a security integration, the name of that security integration is returned. |

Example 4: Display the authentication information of the current user, who logs in through the security integration `ldap_si`.

```Plain
SHOW AUTHENTICATION;
+------------------------+----------+------------+-------------------+
| UserIdentity    
```

**NEGATIVE CONSTRAINT**:
```java
// Induced defect failure mode:
| Password          | Whether a password is used to log in to the StarRocks cluster.<ul><li>`Yes`: A password is used.</li><li>`No`: No password is used.</li></ul> |
| AuthPlugin        | The interface that is used for authentication. Valid values: `MYSQL_NATIVE_PASSWORD` and `AUTHENTICATION_LDAP_SIMPLE`. If no interface is used, `NULL` is returned. |
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `87ba5c08` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T12:38:09.695Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795264689695",
    "title": "[BugFix] Count group roles and security-integration users in SHOW GRANTS FOR ROL",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "StarRocks/starrocks",
    "source_uri": "https://github.com/StarRocks/starrocks",
    "source_version": "HEAD",
    "content_hash": "f25a85e3b571a621d914059590248c544c878b0fe61b59648f4f8b09c97d65d1"
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
        "Harvested/verified timestamp recorded: 2026-11-21T12:38:09.695Z"
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
  "auth_token": "98046aea3e0ea60cf70e9f0c804860e24aa0d750759093f59c61d8872fb06aef"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

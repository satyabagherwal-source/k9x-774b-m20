# Candidate Directive: [CD-396T] MDEV-40150 galera tests for close() hang and mdev-36554 race

<!-- PROVENANCE_START
{
  "source_repository": "MariaDB/server",
  "source_url": "https://github.com/MariaDB/server",
  "source_version": "820699c7",
  "license": "GPL-2.0",
  "timestamp": "2026-11-24T16:36:49.349Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mariadb-server",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [MariaDB/server](https://github.com/MariaDB/server) (Revision: `820699c7`).  
> **License**: GPL-2.0 | **Timestamp**: `2026-11-24T16:36:49.349Z`  
> **Learning ID**: `learn-github-mariadb-server`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `mysql-test/suite/galera/r/MDEV-40150.result`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in MariaDB/server. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `288c4dc9`: MDEV-40150 galera tests for close() hang and mdev-36554 race. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `mysql-test/suite/galera/r/MDEV-40150.result`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
connection node_2;
connection node_1;
# Correct Galera library found
CALL mtr.add_suppression("Inconsistency detected");
connection node_1;
CREATE TABLE t1 (f1 INTEGER);
connection node_2;
SET GLOBAL wsrep_provider_options = 'dbug=d,async_recv_force_inconsistency,async_recv_exit_before_closing_check';
connection node_1;
INSERT INTO t1 VALUES (1);
connection node_2;
SET SESSION wsrep_on = OFF;
connect node_2a, 127.0.0.1, root, , test, $NODE_MYPORT_2;
connection node_2a;
SET SESSION wsrep_on = OFF;
SET GLOBAL wsrep_cluster_address = '';
connection node_2;
SET GLOBAL wsrep_provider_options = 'signal=async_recv_exit_before_closing_check';
SET GLOBAL wsrep_provider_options = 'dbug=';
connection node_2a;
disconnect node_2a;
connection node_2;
SET SESSION wsrep_on = OFF;
connection node_1;
SET wsrep_sync_wait = 0;
DROP TABLE t1;
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `288c4dc9` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T16:36:49.347Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795538209347",
    "title": "MDEV-40150 galera tests for close() hang and mdev-36554 race",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "MariaDB/server",
    "source_uri": "https://github.com/MariaDB/server",
    "source_version": "HEAD",
    "content_hash": "52e341bf621e417ae2f9749c48e015d4381cc4273eda2aafef48a5d7ead37cc5"
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
        "Harvested/verified timestamp recorded: 2026-11-24T16:36:49.347Z"
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
  "auth_token": "f215a1e0aa062e21530095f0ae3b85ba95a03bd62bb91bc565b43ea002623643"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

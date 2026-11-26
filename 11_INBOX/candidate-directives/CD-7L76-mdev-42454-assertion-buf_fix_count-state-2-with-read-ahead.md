# Candidate Directive: [CD-7L76] MDEV-42454 Assertion buf_fix_count(state) <= 2 with read-ahead

<!-- PROVENANCE_START
{
  "source_repository": "MariaDB/server",
  "source_url": "https://github.com/MariaDB/server",
  "source_version": "e6521ee6",
  "license": "GPL-2.0",
  "timestamp": "2026-11-26T12:59:35.058Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mariadb-server",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [MariaDB/server](https://github.com/MariaDB/server) (Revision: `e6521ee6`).  
> **License**: GPL-2.0 | **Timestamp**: `2026-11-26T12:59:35.058Z`  
> **Learning ID**: `learn-github-mariadb-server`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `mysql-test/suite/innodb/r/read_ahead_freed_page.result`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in MariaDB/server. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2cd1e495`: MDEV-42454 Assertion buf_fix_count(state) <= 2 with read-ahead. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `mysql-test/suite/innodb/r/read_ahead_freed_page.result`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
#
# MDEV-42454 Assertion buf_fix_count(state) <= 2 with read-ahead
#
CREATE TABLE t1(id INT PRIMARY KEY, b LONGBLOB) ENGINE=InnoDB;
INSERT INTO t1 VALUES (1, REPEAT('a', 10000));
CREATE TABLE t3(id INT PRIMARY KEY, b LONGBLOB) ENGINE=InnoDB;
INSERT INTO t3 SELECT seq, REPEAT(CHAR(64 + seq % 26), 10000)
FROM seq_1_to_30;
# restart
SELECT SUM(LENGTH(b)) FROM t3 WHERE id BETWEEN 12 AND 28;
SUM(LENGTH(b))
170000
connect con1,localhost,root;
BEGIN;
UPDATE t1 SET b = REPEAT('z', 10000) WHERE id = 1;
SET DEBUG_SYNC = 'btr_blob_free_after_commit SIGNAL freed WAIT_FOR go_free';
ROLLBACK;
connection default;
SET DEBUG_SYNC = 'now WAIT_FOR freed';
connect con2,localhost,root;
SET @save_random_read_ahead = @@GLOBAL.innodb_random_read_ahead;
SET GLOBAL innodb_random_read_ahead = ON;
SET DEBUG_SYNC = 'buf_page_init_for_read_freed SIGNAL ra_found WAIT_FOR go_ra';
SELECT SUM(LENGTH(b)) FROM t3 WHERE id >= 29;
connection default;
SET DEBUG_SYNC = 'now WAIT_FOR ra_found';
CREATE TABLE t2(a INT PRIMARY KEY) ENGINE=InnoDB;
SET DEBUG_SYNC = 'now SIGNAL go_ra';
connection con2;
SUM(LENGTH(b))
20000
SET GLOBAL innodb_random_read_ahead = @save_random_read_ahead;
disconnect con2;
connection default;
SET DE
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2cd1e495` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T12:59:35.056Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795697975056",
    "title": "MDEV-42454 Assertion buf_fix_count(state) <= 2 with read-ahead",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "MariaDB/server",
    "source_uri": "https://github.com/MariaDB/server",
    "source_version": "HEAD",
    "content_hash": "5f32c1f6a90c7bd37980ab512d361875ac70492a1de05095e34ef5f2a386a19e"
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
        "Harvested/verified timestamp recorded: 2026-11-26T12:59:35.056Z"
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
  "auth_token": "202adde3f42d047b46aaf337f6b1dfbde10abba19c73737ce38d27d8375c72d1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

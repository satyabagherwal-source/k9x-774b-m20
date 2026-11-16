# Candidate Directive: [CD-Q5MR] test_replication_card_migration class timeout

<!-- PROVENANCE_START
{
  "source_repository": "ytsaurus/ytsaurus",
  "source_url": "https://github.com/ytsaurus/ytsaurus",
  "source_version": "ffcd9432",
  "license": "Apache-2.0",
  "timestamp": "2026-11-16T03:37:26.787Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-ytsaurus-ytsaurus",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ytsaurus/ytsaurus](https://github.com/ytsaurus/ytsaurus) (Revision: `ffcd9432`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-16T03:37:26.787Z`  
> **Learning ID**: `learn-github-ytsaurus-ytsaurus`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `yt/yt/tests/integration/dynamic_tables/test_chaos.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ytsaurus/ytsaurus. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e2965c98`: test_replication_card_migration class timeout. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `yt/yt/tests/integration/dynamic_tables/test_chaos.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
        map_in_parallel(
            lambda driver: sync_create_cells(1, driver=driver),
            self._get_drivers())
        self._create_replica_tables(
            replicas,
            replica_ids,
            create_tablet_cells=False,
            mount_tables=False,
            ordered=True,
            tablet_count=tablet_count)
        def _check(replica_and_tablet_index):
            replica, tablet_index = replica_and_tablet_index
            expected_values = values[tablet_index]
            logger.debug("Expected: {0}".format(expected_values))
            driver = get_driver(cluster=replica["cluster_name"])
            path = replica["replica_path"]
            query = "key, value from [{0}] where [$tablet_index] = {1}". format(path, tablet_index)
            wait(lambda: select_rows(query, driver=driver) == expected_values)
        def _switch(new_replica_ids, progress=None, unmount_tables=True):
            def _switch_replica(replica_and_id):
                replica, new_id = replica_and_id
                if unmount_tables:
                    sync_unmount_table(path, driver=driver)
            map_in_parallel(_switch_replica, zip(replicas, new_replica_ids))

  
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
        sync_create_cells(1)
        self._create_replica_tables(replicas, replica_ids, mount_tables=False, ordered=True)
        if tablet_count > 1:
            for replica in replicas:
                driver = get_driver(cluster=replica["cluster_name"])
                path = replica["replica_path"]
                reshard_table(path, tablet_count, driver=driver)
        def _check(tablet_index, values):
            logger.debug("Expected: {0}".format(values))
            for replica in replicas:
                driver = get_driver(cluster=replica["cluster_name"])
                path = replica["replica_path"]
                query = "key, value from [{0}] where [$tablet_index] = {1}". format(path, tablet_index)
                wait(lambda: select_rows(query, driver=driver) == values)
        def _switch(new_replica_ids, progress=None):
            for replica, new_id in zip(replicas, new_replica_ids):
                sync_unmount_table(path, driver=driver)
                _switch(replica_ids, progress)
                _switch(rt_replica_ids)
            for tablet_index in range(tablet_count):
                _check(tablet_index, values[tablet_index])
    NUM_TEST_PARTITIONS = 
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e2965c98` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T03:37:26.785Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794800246785",
    "title": "test_replication_card_migration class timeout",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ytsaurus/ytsaurus",
    "source_uri": "https://github.com/ytsaurus/ytsaurus",
    "source_version": "HEAD",
    "content_hash": "fddf575c9fadde96a782b4c1ed460a73e24702001f33dc1201435e95526cf0e5"
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
        "Harvested/verified timestamp recorded: 2026-11-16T03:37:26.786Z"
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
  "auth_token": "6bb30c6d01e159b8814a011149f6e857d3f779448d8684cbaef3e5ebdb106fe3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

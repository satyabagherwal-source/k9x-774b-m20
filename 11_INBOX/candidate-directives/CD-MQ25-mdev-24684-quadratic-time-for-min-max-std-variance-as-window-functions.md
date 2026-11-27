# Candidate Directive: [CD-MQ25] MDEV-24684 Quadratic time for MIN/MAX/STD/VARIANCE as window functions

<!-- PROVENANCE_START
{
  "source_repository": "MariaDB/server",
  "source_url": "https://github.com/MariaDB/server",
  "source_version": "d2844a41",
  "license": "GPL-2.0",
  "timestamp": "2026-11-27T06:55:06.605Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mariadb-server",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [MariaDB/server](https://github.com/MariaDB/server) (Revision: `d2844a41`).  
> **License**: GPL-2.0 | **Timestamp**: `2026-11-27T06:55:06.605Z`  
> **Learning ID**: `learn-github-mariadb-server`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `sql/sql_window.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in MariaDB/server. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d2844a41`: MDEV-24684 Quadratic time for MIN/MAX/STD/VARIANCE as window functions. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `sql/sql_window.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    top_bound(top_bound), bottom_bound(bottom_bound), have_cached_result(false),
    have_cached_result= false;
  /* The sum functions hold the result for rows
     cached_frame_top..cached_frame_bottom */
  bool have_cached_result;
  ha_rows cached_frame_top, cached_frame_bottom;
      have_cached_result= false;
    ha_rows curr_top_rownum= top_bound.get_curr_rownum();
    ha_rows curr_bottom_rownum= bottom_bound.get_curr_rownum();
    DBUG_PRINT("info", ("COMPUTING (%llu %llu)",
                        curr_top_rownum, curr_bottom_rownum));
    ha_rows scan_from= curr_top_rownum;
    if (can_append && have_cached_result &&
        curr_top_rownum == cached_frame_top)
      if (curr_bottom_rownum == cached_frame_bottom)

      /*
        Add only the rows below the previous frame, if the frame grew.
        An empty previous frame (bottom above top, e.g. RANGE BETWEEN
        5 FOLLOWING AND 1 FOLLOWING) has nothing to extend.
      */
      if (curr_bottom_rownum > cached_frame_bottom &&
          cached_frame_bottom >= cached_frame_top)
        scan_from= cached_frame_bottom + 1;
    if (scan_from == curr_top_rownum)
    have_cached_result= false;
    cursor.move_to(scan_from);

```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
    top_bound(top_bound), bottom_bound(bottom_bound), have_result(false),
    have_result= false;
  /* The sum functions hold the result for rows last_top..last_bottom */
  bool have_result;
  ha_rows last_top, last_bottom;
      have_result= false;
    ha_rows start_rownum= top_bound.get_curr_rownum();
    ha_rows bottom_rownum= bottom_bound.get_curr_rownum();
    DBUG_PRINT("info", ("COMPUTING (%llu %llu)", start_rownum, bottom_rownum));
    ha_rows first_rownum= start_rownum;
    if (can_append && have_result && start_rownum == last_top)
      if (bottom_rownum == last_bottom)
      /* Extend only a previous frame ending at most 1 row above the top:
         after an inverted frame ending higher, the rows in between would
         be added */
      if (bottom_rownum > last_bottom && last_bottom + 1 >= start_rownum)
        first_rownum= last_bottom + 1;
    if (first_rownum == start_rownum)
    have_result= false;
    cursor.move_to(first_rownum);
    ha_rows idx= first_rownum;
    while (idx <= bottom_rownum
    if (idx > bottom_rownum)
      have_result= true;
      last_top= start_rownum;
      last_bottom= bottom_rownum;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d2844a41` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T06:55:06.603Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795762506603",
    "title": "MDEV-24684 Quadratic time for MIN/MAX/STD/VARIANCE as window functions",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "MariaDB/server",
    "source_uri": "https://github.com/MariaDB/server",
    "source_version": "HEAD",
    "content_hash": "8f6e821f52bdd867ec51828a0a4c63e052a6cc601b28a2af87104775a617b62c"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-27T06:55:06.603Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "52c59733411f13234f2b796fb8f36231dc841975ab4bf8427f4a8cb94a2e3cb0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

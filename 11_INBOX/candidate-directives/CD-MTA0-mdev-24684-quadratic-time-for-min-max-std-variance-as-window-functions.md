# Candidate Directive: [CD-MTA0] MDEV-24684 Quadratic time for MIN/MAX/STD/VARIANCE as window functions

<!-- PROVENANCE_START
{
  "source_repository": "mariadb-server-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T06:55:10.640Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-mariadb-server-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mariadb-server-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T06:55:10.640Z`  
> **Learning ID**: `LEARN-EVO-mariadb-server-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T06:55:10.772Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795762510772",
    "title": "MDEV-24684 Quadratic time for MIN/MAX/STD/VARIANCE as window functions",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mariadb-server-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f1b849d5ba00a3bd1ce6e0c74ef48d29b9e160cb1d273fd1ee133dff5030d632"
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
        "Harvested/verified timestamp recorded: 2026-11-27T06:55:10.773Z"
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
  "auth_token": "6c7b65413172aa51d6ec1c472e7d369036e61156b5a055be2a4b3b5d4d06ad60"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

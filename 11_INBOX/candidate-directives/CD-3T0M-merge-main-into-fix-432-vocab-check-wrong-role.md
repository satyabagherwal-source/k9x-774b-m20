# Candidate Directive: [CD-3T0M] Merge main into fix/432-vocab-check-wrong-role

<!-- PROVENANCE_START
{
  "source_repository": "fabio-rovai-open-ontologies-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-24T13:21:17.595Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-fabio-rovai-open-ontologies-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fabio-rovai-open-ontologies-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-24T13:21:17.595Z`  
> **Learning ID**: `LEARN-EVO-fabio-rovai-open-ontologies-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fabio-rovai/open-ontologies. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `54f53903`: Merge main into fix/432-vocab-check-wrong-role. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- **`serve-http --port 0` reports the port it bound, and the HTTP tests no
  longer race a sibling test's fork for their port.** The startup line printed
  the port asked for, so with `--port 0` it said `:0`. It now prints the port
  the OS picked. `api_error_json_test` and `query_human_output_test` reserved a
  port by binding and dropping a listener, then polled with a TCP connect. A
  sibling test that forked while the reservation was open passed the listening
  socket to its child, the poll connected to that copy, and the first request
  was refused or reset, or the server could not bind at all. Main failed this
  way once on CI (1ba7ecf8) and 42 times in 2,000 runs on Linux. Both tests now
  start `serve-http --port 0` through `tests/common::spawn_serve_http`, which
  reads the address from the server's own startup line: 2,000 of 2,000 runs
  pass.

- **No label on the front-page figure sits on a node, an arrow or the panel
  border** (#436). Labels in `docs/assets/knowledge-graph.py` were checked
  against other labels only, so the unasked-question badge ran through a row of
  classes, the forged-line badge and the 無 glyph sat on nodes, three labels
  crossed the ontology pan
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- **`vocab-check` reports a declared term used in the wrong role** (#432).
  It checked that each term was declared, not that it was used as what it was
  declared as, so a class used as a predicate (`d:s2 ex:Sensor d:x`) and a
  property used as an `rdf:type` object (`d:s1 a ex:observes`) both passed
  with `conforms: true`. They are now listed under `wrong_role_terms` with the
  role they were used in and the role they were declared in, and make
  `conforms` false; `hallucinated_terms` still lists only terms the ontology
  does not declare at all. A term declared as both a class and a property (OWL
  2 punning) fits either role. The Python `vocab_check` reports the same field.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `54f53903` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T13:21:17.730Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795526477730",
    "title": "Merge main into fix/432-vocab-check-wrong-role",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fabio-rovai-open-ontologies-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "716bce9e2b50f8aa00a84cf22024a08473f7f9d23dbb201cfe90b77ba33c8e14"
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
        "Harvested/verified timestamp recorded: 2026-11-24T13:21:17.731Z"
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
  "auth_token": "2963a9878f0f226e73a33864ede335e7ec738e8672f2e0854e79d871bed67077"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-72DC] turbo): constrain record INT8 kernels to dispatched ISA

<!-- PROVENANCE_START
{
  "source_repository": "alibaba-zvec-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T20:47:20.903Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-alibaba-zvec-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [alibaba-zvec-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T20:47:20.903Z`  
> **Learning ID**: `LEARN-EVO-alibaba-zvec-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `python/tests/test_refine_query_params.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in alibaba/zvec. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0c2e67a2`: turbo): constrain record INT8 kernels to dispatched ISA. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `python/tests/test_refine_query_params.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
    # Lifecycle validation requires an exact hit, not approximate graph recall.
    query_options = {"is_linear": True} if index_kind == "diskann" else {}
    plain = zvec.Query("vector", vector=vectors[0], param=query_type(**query_options))
        "vector",
        vector=vectors[0],
        param=query_type(is_using_refiner=True, **query_options),
            if index_kind == "diskann" and not empty:
                # Keep the approximate path covered without requiring a global
                # nearest neighbor that may be absent from the coarse results.
                coarse = collection.query(
                    zvec.Query(
                        "vector", vector=vectors[0], param=zvec.DiskAnnQueryParam()
                    ),
                    topk=10,
                )
                assert coarse
                coarse_ids = np.array([int(hit.id) for hit in coarse])
                distances = np.square(vectors[coarse_ids] - vectors[0]).sum(axis=1)
                order = np.lexsort((coarse_ids, distances))
                hits = collection.query(
                    zvec.Query(
                        "vector",
                        vector=vectors[0],
           
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
    plain = zvec.Query("vector", vector=vectors[0], param=query_type())
        "vector", vector=vectors[0], param=query_type(is_using_refiner=True)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0c2e67a2` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T20:47:21.021Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794602841021",
    "title": "turbo): constrain record INT8 kernels to dispatched ISA",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "alibaba-zvec-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "38b152e29743ce546f56889de1a92dc7c919c31df34cac47815773b339157642"
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
        "Harvested/verified timestamp recorded: 2026-11-13T20:47:21.022Z"
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
  "auth_token": "f44c9ae229d48c9b39dbf5a1394c09f6010fc3bf23ea6cac0841b4df65e03b30"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

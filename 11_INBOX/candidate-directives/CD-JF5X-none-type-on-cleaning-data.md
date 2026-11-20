# Candidate Directive: [CD-JF5X] None type on cleaning data

<!-- PROVENANCE_START
{
  "source_repository": "itsdecodingai-llm-twin-course-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T13:26:45.273Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-itsdecodingai-llm-twin-course-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [itsdecodingai-llm-twin-course-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T13:26:45.273Z`  
> **Learning ID**: `LEARN-EVO-itsdecodingai-llm-twin-course-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `INSTALL_AND_USAGE.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in itsdecodingai/llm-twin-course. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0775ac1f`: None type on cleaning data. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `INSTALL_AND_USAGE.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
Now fill it with your credentials, following the suggestions from the next section.
#### Qdrant

Optional, only if you want to use Qdrant cloud. Otherwise, you can complete the course using the local version of Qdrant.

After installing the dependencies into the Poetry virtual environment, you can activate your virtual environment into your current CLI by running:
You should see something similar to:
```text
{"level":"INFO","location":"extract:53","message":"Finished scrapping custom article: https://medium.com/decodingml/an-end-to-end-framework-for-production-ready-llm-systems-by-building-your-llm-twin-2cc6bb01141f","timestamp":"2024-12-25 17:13:33,630+0000","service":"llm-twin-course/crawler"}
```
You should see something similar to:
```text
2024-12-25 16:53:45 [info     ] Cleaned content chunked successfully. cls=data_logic.dispatchers data_type=repositories num=955
2024-12-25 16:53:45 [info     ] Chunk embedded successfully.   cls=data_logic.dispatchers data_type=repositories embedding_len=384
2024-12-25 16:53:45 [info     ] Chunk embedded successfully.   cls=data_logic.dispatchers data_type=repositories embedding_len=384
```
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
Now fill it with your credentials.
After installing the dependencies into the Poetry virtual environment, you can run the following to activate it into your current CLI:

```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0775ac1f` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T13:26:45.377Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795181205377",
    "title": "None type on cleaning data",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "itsdecodingai-llm-twin-course-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1b184988918ac61518dc4e2699509cf0f018fdcaea3375c37bbdf7b055da3ef6"
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
        "Harvested/verified timestamp recorded: 2026-11-20T13:26:45.378Z"
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
  "auth_token": "323f0d0e76947d32fe1453b3ff3124934ea0a26e1731fed393a3fcb56dbb692e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

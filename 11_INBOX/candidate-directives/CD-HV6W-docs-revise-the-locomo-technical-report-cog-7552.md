# Candidate Directive: [CD-HV6W] docs: Revise the LoCoMo technical report (COG-7552)

<!-- PROVENANCE_START
{
  "source_repository": "topoteretes-cognee-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T17:37:29.271Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-topoteretes-cognee-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [topoteretes-cognee-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T17:37:29.271Z`  
> **Learning ID**: `LEARN-EVO-topoteretes-cognee-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `cognee/eval_framework/locomo/REPORT.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in topoteretes/cognee. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1961133d`: docs: Revise the LoCoMo technical report (COG-7552). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `cognee/eval_framework/locomo/REPORT.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
# Benchmarking cognee on LoCoMo - Technical Evaluation Report

*Revised November 19, 2026. This revision describes the answer prompt's decline rules and the judge's partial-credit rule in more detail, including when that rule changed; explains how the exclusion list was built and what our audit could see; reports both runs of the main configuration by category and with nothing excluded; states which cognee version produced the runs; and removes observations we can't back up with hard data, such as the default depth being more economical. Earlier versions are in the repository history.*
This report documents our evaluation of cognee, an open-source AI memory platform, on LoCoMo, a benchmark of very long-term conversational memory. We used cognee's existing memory components and built a LoCoMo-specific setup around them: how the conversations are formatted for ingestion, one answer prompt for every question, the retrieval depth and the judge's grading prompt were all developed on the ten conversations we report on. The goal was to measure that pipeline with a setup that others can inspect and rerun.
cognee answered **~91%** of the 1,762 evaluated questions correctly according to the 
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
# Cognee on LoCoMo - Technical Evaluation Report
This report documents our evaluation of Cognee, an open-source AI memory platform, on LoCoMo, a benchmark of very long-term conversational memory. We used standard Cognee memory components with LoCoMo-specific data formatting, one answer prompt for every question, a fixed retrieval configuration and an LLM judge. The goal was to measure the existing pipeline with a setup that others can inspect and rerun.
Cognee answers **91%** of the 1,762 evaluated questions correctly according to the LLM judge, using the hybrid retrieval approach we previously evaluated on [BEAM](../beam/REPORT.md). We audited LoCoMo's reference answers and exclude the questions that our audit or an external one found faulty. We also leave out open-domain questions, since this evaluation focuses on memory rather than general knowledge. As is now common for LoCoMo, an LLM judge grades the answers, with a single prompt for all questions; we comment on current judging practices in Section 5.
Section 2 introduces LoCoMo and the parts of Cognee used here. Section 3 describes the method: how the conversations are ingested, how questions are answered, and the evaluation 
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1961133d` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T17:37:29.383Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795196249383",
    "title": "docs: Revise the LoCoMo technical report (COG-7552)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "topoteretes-cognee-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "978fbcd570efa440f891788b7cf809edca456451d5ebaed5610b853ba9b8a515"
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
        "Harvested/verified timestamp recorded: 2026-11-20T17:37:29.383Z"
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
  "auth_token": "e0f0ddc1dbda50e4921b1bbf65644a4a758ba6b3a353db5b13368f3cd9888368"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

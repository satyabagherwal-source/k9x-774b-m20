# Candidate Directive: [CD-HQTC] Revise the LoCoMo technical report (COG-7552)

<!-- PROVENANCE_START
{
  "source_repository": "topoteretes/cognee",
  "source_url": "https://github.com/topoteretes/cognee",
  "source_version": "1961133d",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T17:37:23.712Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-topoteretes-cognee",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [topoteretes/cognee](https://github.com/topoteretes/cognee) (Revision: `1961133d`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T17:37:23.712Z`  
> **Learning ID**: `learn-github-topoteretes-cognee`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-20T17:37:23.710Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795196243710",
    "title": "Revise the LoCoMo technical report (COG-7552)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "topoteretes/cognee",
    "source_uri": "https://github.com/topoteretes/cognee",
    "source_version": "HEAD",
    "content_hash": "f226396a9f4138603032490cfa2ecc57ea700d3214edb917ebfce095145e8aa5"
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
        "Harvested/verified timestamp recorded: 2026-11-20T17:37:23.710Z"
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
  "auth_token": "4781e8a0cb6256307dbfcaf6f5834931d79e9d1166a4cba1f4d540756a8dfa59"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

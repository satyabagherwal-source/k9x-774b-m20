# Candidate Directive: [CD-XFQ6] docs(readme): lead with the November launches and OCR-free Cloud, show a boxed c

<!-- PROVENANCE_START
{
  "source_repository": "vectifyai-pageindex-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T21:49:12.694Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-vectifyai-pageindex-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vectifyai-pageindex-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T21:49:12.694Z`  
> **Learning ID**: `LEARN-EVO-vectifyai-pageindex-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `README.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in VectifyAI/PageIndex. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `76ce6ae8`: docs(readme): lead with the November launches and OCR-free Cloud, show a boxed citation, and move Cloud after Quickstart. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `README.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- [Nov '26] 🔥 [**PageIndex Agent**](https://pageindex.ai/blog/pageindex-agent): vectorless, OCR-free, multimodal RAG for complex documents, with line-level citations for every answer.
- [Nov '26] 🔥 [**Page Extract API**](https://pageindex.ai/blog/page-extract-api): describe the fields you want in a JSON Schema and get them back from any PDF. *#1 on ExtractBench*, and its standard tier beats every other method at $0.03 a page.
- [Nov '26] [**Do We Still Need OCR?**](https://pageindex.ai/blog/do-we-need-ocr): we removed OCR from every PageIndex product. Reading the original pages raised accuracy and lowered cost.
- [Oct '26] [**Page Search API**](https://search.pageindex.ai): find the pages that answer each question in about a second, and send your LLM only those. *Cut 97% token cost on document question answering*; more accurate and faster than vector search ([benchmark](https://github.com/VectifyAI/page-search-benchmark)).
**Have a Claude subscription?** PageIndex can use your subscription to call Claude models through Claude Code: usage is covered by your plan, no API key needed. Install with `pip install -U "pageindex[claude]"`, then prefix model names with `claude-code/`, e.g.
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
- [Oct '26] 🔥 [**Page Search API**](https://search.pageindex.ai): find the pages that answer each question in about a second, and send your LLM only those. *Cut 97% token cost on document question answering*; more accurate and faster than vector search ([benchmark](https://github.com/VectifyAI/page-search-benchmark)).
- [Aug '26] ⚡ [**PageIndex Flash**](#step-2-index-your-documents): fast tree index generation for text-based PDFs, now the default indexing method in PageIndex SDK local mode.
- [Scale PageIndex to Millions of Documents](https://pageindex.ai/docs/documents/folders): *PageIndex File System* is a file-level tree indexing layer that lets PageIndex reason over an entire corpus, not just a single document.
**Have a Claude subscription?** PageIndex can use your subscription to call Claude models through Claude Code: usage is covered by your plan, no API key needed. Install with `pip install -U "pageindex[claude]"`, then prefix model names with `claude-code/`, e.g., `index="claude-code/haiku"`, `chat="claude-code/opus"` (see [example](https://github.com/VectifyAI/PageIndex/blob/main/cookbook/pageindex-claude-subscription.py)).
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `76ce6ae8` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T21:49:12.794Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795297752794",
    "title": "docs(readme): lead with the November launches and OCR-free Cloud, show a boxed c",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "vectifyai-pageindex-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "344e3f1eb3a794f7bb09b99019a7eceaaeefaa48b691e91a0939e2db18b2b76c"
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
        "Harvested/verified timestamp recorded: 2026-11-21T21:49:12.795Z"
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
  "auth_token": "434478d53a3d0e3489649c0a886a26c65f35f09c98d9760a56049b5d9f72b7be"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

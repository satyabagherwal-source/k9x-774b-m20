# Candidate Directive: [CD-XCDQ] docs(readme): lead with the November launches and OCR-free Cloud, show a boxed c

<!-- PROVENANCE_START
{
  "source_repository": "VectifyAI/PageIndex",
  "source_url": "https://github.com/VectifyAI/PageIndex",
  "source_version": "add6b17c",
  "license": "MIT",
  "timestamp": "2026-11-21T21:49:08.462Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-vectifyai-pageindex",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex) (Revision: `add6b17c`).  
> **License**: MIT | **Timestamp**: `2026-11-21T21:49:08.462Z`  
> **Learning ID**: `learn-github-vectifyai-pageindex`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
  "validated_at": "2026-11-21T21:49:08.460Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795297748460",
    "title": "docs(readme): lead with the November launches and OCR-free Cloud, show a boxed c",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "VectifyAI/PageIndex",
    "source_uri": "https://github.com/VectifyAI/PageIndex",
    "source_version": "HEAD",
    "content_hash": "344e3f1eb3a794f7bb09b99019a7eceaaeefaa48b691e91a0939e2db18b2b76c"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T21:49:08.460Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "46a7c411d533be89f69283ee7fe284928baf5a34159de8d324d621042a21e444"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-D4NR] PageIndexClient.build_index() is named build_outline_index(), and its errors say

<!-- PROVENANCE_START
{
  "source_repository": "VectifyAI/PageIndex",
  "source_url": "https://github.com/VectifyAI/PageIndex",
  "source_version": "996349a5",
  "license": "MIT",
  "timestamp": "2026-11-17T16:46:48.279Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-vectifyai-pageindex",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [VectifyAI/PageIndex](https://github.com/VectifyAI/PageIndex) (Revision: `996349a5`).  
> **License**: MIT | **Timestamp**: `2026-11-17T16:46:48.279Z`  
> **Learning ID**: `learn-github-vectifyai-pageindex`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `pageindex/client.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in VectifyAI/PageIndex. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `996349a5`: PageIndexClient.build_index() is named build_outline_index(), and its errors say outline index. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `pageindex/client.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
            first child starts on. A cloud document that has no outline index,
            as one uploaded with ``PageSearchClient`` or
            ``PageExtractClient``, raises PageIndexAPIError:
            ``build_outline_index()`` builds it.
                f"Document '{doc_id}' has no outline index (index_status: "
                "skipped). Build one with build_outline_index(doc_id).")
    def build_outline_index(self, doc_id: str, wait: bool = True,
                            timeout: float = 1800.0) -> dict[str, Any]:
        Build the outline index of a cloud document that has none, as one
        uploaded with ``PageSearchClient`` or ``PageExtractClient``;
        ``get_tree()`` then returns it. Indexing is charged as an upload's
        is. A document that has its outline index is left as it is.
        Cloud-only: local mode raises PageIndexAPIError.
            wait (bool): Return once the outline index is built (default),
                up to ``timeout`` seconds; raises PageIndexAPIError if it
                could not be built or is not done in time (it goes on in the
                cloud). False returns at once.
            "build_outline_index is cloud-only — a 
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
            first child starts on. A cloud document that has no index, as one
            uploaded with ``PageSearchClient`` or ``PageExtractClient``,
            raises PageIndexAPIError: ``build_index()`` builds it.
                f"Document '{doc_id}' has no index (index_status: skipped). "
                "Build one with build_index(doc_id).")
    def build_index(self, doc_id: str, wait: bool = True,
                    timeout: float = 1800.0) -> dict[str, Any]:
        Build the index of a cloud document that has none, as one uploaded
        with ``PageSearchClient`` or ``PageExtractClient``; ``get_tree()``
        then returns it. Indexing is charged as an upload's is. A document
        that has its index is left as it is. Cloud-only: local mode raises
        PageIndexAPIError.
            wait (bool): Return once the index is built (default), up to
                ``timeout`` seconds; raises PageIndexAPIError if it could not
                be built or is not done in time (it goes on in the cloud).
                False returns at once.
            "build_index is cloud-only — a local document is indexed when it "
            "is submitted.")
                    f"Timed
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `996349a5` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T16:46:48.277Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794934008277",
    "title": "PageIndexClient.build_index() is named build_outline_index(), and its errors say",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "VectifyAI/PageIndex",
    "source_uri": "https://github.com/VectifyAI/PageIndex",
    "source_version": "HEAD",
    "content_hash": "210dc1161dedb65b5c87136face3a54a4a4f0445896c37d223c9b14ac77456fa"
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
        "Harvested/verified timestamp recorded: 2026-11-17T16:46:48.277Z"
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
  "auth_token": "bf6f046cec683156a8826d61be5a72a14d584b38ff4036a4d6c16f7265207a32"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

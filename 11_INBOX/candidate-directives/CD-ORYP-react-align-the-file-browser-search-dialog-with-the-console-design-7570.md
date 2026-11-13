# Candidate Directive: [CD-ORYP] react): align the file browser search dialog with the console design (#7570)

<!-- PROVENANCE_START
{
  "source_repository": "volcengine/OpenViking",
  "source_url": "https://github.com/volcengine/OpenViking",
  "source_version": "07432564",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-13T16:49:10.802Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-volcengine-openviking",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [volcengine/OpenViking](https://github.com/volcengine/OpenViking) (Revision: `07432564`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-13T16:49:10.802Z`  
> **Learning ID**: `learn-github-volcengine-openviking`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `frontend/.changeset/file-browser-search-design-alignment.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in volcengine/OpenViking. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `cf14a0cb`: react): align the file browser search dialog with the console design (#7570). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `frontend/.changeset/file-browser-search-design-alignment.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
---
'@openviking/react': patch
---

Align the FileBrowser search dialog with the console design and drop the result preview panel it gained in 0.1.10.

- The empty state shows the design's artwork above the title and hint instead of two centred lines of text.
- Results fill the dialog width again: the hover/keyboard preview panel and its split layout are gone, and each row keeps its bottom divider, 24px icon tile and 14px name. `↑`/`↓` still move the current row and `Enter` opens it.
- The count line reads `N results ・ [mode] Vector retrieval Switch` in the design's order, and appears only when there are results; the empty, loading and failure states no longer carry it.
- The advanced panel takes the design's `bg-2` surface, and the mode menu its 259px popover with a 6px radius and card shadow.

BREAKING CHANGE: `FileBrowserLabels.searchPreview`, `searchPreviewEmpty` and `searchPreviewFailed` are removed, because the search dialog no longer previews results. Drop those overrides; the keys have no effect.
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `cf14a0cb` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T16:49:10.800Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0.51,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 51%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=FAIL.",
  "item": {
    "id": "cand-1794588550800",
    "title": "react): align the file browser search dialog with the console design (#7570)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "volcengine/OpenViking",
    "source_uri": "https://github.com/volcengine/OpenViking",
    "source_version": "HEAD",
    "content_hash": "712eadd658b8adae61e1ec70a4da09babda9bec22759144d30f2e906a8bbace0"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
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
        "Direct empirical evidence ratio: 0% (0/5)",
        "Evidence-to-claim lexical alignment: 0%"
      ]
    },
    "technical_correctness": {
      "status": "FAIL",
      "score": 0.4,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": true,
      "opposing_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "unsupported_assumptions": [],
      "findings": [
        "DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write')"
      ],
      "details": [
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
        "Harvested/verified timestamp recorded: 2026-11-13T16:49:10.800Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "FAIL",
      "score": 0.4,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": true,
      "conflicting_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "findings": [
        "CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
      ],
      "details": []
    }
  },
  "detected_contradictions": [
    "Canonical opposition: Clashes with RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
    "Conflict with RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
  ],
  "missing_information": [
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "58dc86542b68def0eadee2d6b52ec20c768d7b95f215d75766edc83a0109edb9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

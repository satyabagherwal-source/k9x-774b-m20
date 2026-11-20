# Candidate Directive: [CD-31S9] review fixes for header-host errors, the error object and tests

<!-- PROVENANCE_START
{
  "source_repository": "weaviate/weaviate",
  "source_url": "https://github.com/weaviate/weaviate",
  "source_version": "cf81225f",
  "license": "NOASSERTION",
  "timestamp": "2026-11-20T17:53:57.705Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-weaviate-weaviate",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [weaviate/weaviate](https://github.com/weaviate/weaviate) (Revision: `cf81225f`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-20T17:53:57.705Z`  
> **Learning ID**: `learn-github-weaviate-weaviate`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `modules/reranker-openai/clients/image.go`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in weaviate/weaviate. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4ffbd0c7`: reranker-openai: review fixes for header-host errors, the error object and tests [api]. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `modules/reranker-openai/clients/image.go`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
	// pngMagic, jpegMagic and gifMagic are the first bytes of those formats.
	// A WebP image is a RIFF container with webpMagic at webpMagicOffset; a
	// WAVE file shares the RIFF header.
	pngMagic        = "\x89PNG"
	jpegMagic       = "\xff\xd8\xff"
	gifMagic        = "GIF8"
	riffMagic       = "RIFF"
	webpMagic       = "WEBP"
	webpMagicOffset = 8
	{"image/png", []magic{{0, []byte(pngMagic)}}},
	{"image/jpeg", []magic{{0, []byte(jpegMagic)}}},
	{"image/gif", []magic{{0, []byte(gifMagic)}}},
	{"image/webp", []magic{{0, []byte(riffMagic)}, {webpMagicOffset, []byte(webpMagic)}}},
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
// WebP is a RIFF container with "WEBP" at offset 8; a WAVE file shares the RIFF header.
	{"image/png", []magic{{0, []byte("\x89PNG")}}},
	{"image/jpeg", []magic{{0, []byte("\xff\xd8\xff")}}},
	{"image/gif", []magic{{0, []byte("GIF8")}}},
	{"image/webp", []magic{{0, []byte("RIFF")}, {8, []byte("WEBP")}}},
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4ffbd0c7` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T17:53:57.703Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795197237703",
    "title": "review fixes for header-host errors, the error object and tests",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "weaviate/weaviate",
    "source_uri": "https://github.com/weaviate/weaviate",
    "source_version": "HEAD",
    "content_hash": "78448097e6e78310345fe444893fb1f336d30edd3b5cb863b55e340aa111048f"
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
        "Harvested/verified timestamp recorded: 2026-11-20T17:53:57.703Z"
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
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "40c995c02dc6a9ddbf2b70e66cfc86e1d7511ce0d6f220b1b68486eed13ca37e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-FPXI] CI/CD Marker-Based Test Orthogonalization Matrix

<!-- PROVENANCE_START
{
  "source_repository": "pixeltable/pixeltable",
  "source_url": "https://github.com/pixeltable/pixeltable",
  "source_version": "9c30a9a6",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T03:17:00.294Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-pixeltable-pixeltable",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [pixeltable/pixeltable](https://github.com/pixeltable/pixeltable) (Revision: `9c30a9a6`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T03:17:00.294Z`  
> **Learning ID**: `learn-github-pixeltable-pixeltable`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Test suites that touch expensive remote APIs, cloud storage, large AI model weights, or specialized hardware MUST NOT overload a single marker (such as `remote_api` or `expensive`). You MUST decouple test markers into two independent axes:
1. **Reliability & Environment Boundary** (e.g., `skip_merge_queue` for flaky third-party endpoints, external object stores, model weight downloads).
2. **Resource & Dollar Cost** (e.g., `expensive` for paid token APIs, `very_expensive` for high-dollar video generation, `resource_intensive` for large CPU/RAM footprints).

**WHY**:
Conflating cost with reliability causes catastrophic CI failures:
- Inexpensive but unreliable third-party APIs fail merge queues and block PR pipelines.
- Expensive but ultra-reliable APIs (such as deterministic OpenAI embedding calls) are needlessly skipped in merge groups, allowing regressions to reach production.
- Monolithic markers prevent granular scheduling (e.g., running nightly model downloads vs. weekly expensive video generation).

**WHEN TO APPLY**:
All enterprise CI/CD systems testing machine learning models, external LLM endpoints, integration harnesses, or infrastructure providers (AWS, GCP, Azure).

**VERIFIED IMPLEMENTATION PATTERN**:
```toml
# pyproject.toml
[tool.pytest.ini_options]
testpaths = ["tests"]
# PR updates exclude unreliable APIs, all costly tiers, and heavy memory jobs:
addopts = '-v -m "not skip_merge_queue and not expensive and not very_expensive and not resource_intensive" --strict-markers'
markers = [
    "skip_merge_queue: calls external third-party endpoints prone to throttling/downtime or downloads large model weights; scheduled CI only",
    "expensive: moderate-cost external endpoints; runs on merge queue and standard+ CI tiers",
    "very_expensive: high-dollar calls (e.g. video generation, long agent workflows); runs only on weekly scheduled runs",
    "resource_intensive: requires runner memory/disk exceeding standard instances; runs on large runners only",
]
```

**NEGATIVE CONSTRAINT**:
```toml
# ANTI-PATTERN: Overloaded monolithic markers
markers = [
    # FAILS: Conflates flaky network calls with dollar costs.
    # Leads to either broken PR builds or untested expensive code.
    "expensive: marks tests as expensive or calling third party APIs",
]
```

**VERIFICATION METHOD**:
Verify with `pytest --markers` and a CI workflow validation script checking that no PR trigger runs tests tagged with `skip_merge_queue` or `very_expensive`:
```bash
pytest --collect-only -m "not skip_merge_queue and not very_expensive" | grep -v "skip_merge_queue"
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T03:17:00.293Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794885420293",
    "title": "CI/CD Marker-Based Test Orthogonalization Matrix",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "pixeltable/pixeltable",
    "source_uri": "https://github.com/pixeltable/pixeltable",
    "source_version": "HEAD",
    "content_hash": "544b2678eadf78a50301b9fddb4102ffa40044c1ba5fc846c082fcb2efa772ba"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T03:17:00.293Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "257b80e229d64439c17b3538ad9a2f81eb67c907d99f9ea30feaa09b2f76fa81"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

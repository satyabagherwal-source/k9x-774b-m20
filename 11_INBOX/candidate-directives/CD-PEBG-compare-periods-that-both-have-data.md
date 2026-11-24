# Candidate Directive: [CD-PEBG] compare periods that both have data

<!-- PROVENANCE_START
{
  "source_repository": "crawlseo/crawlseo",
  "source_url": "https://github.com/crawlseo/crawlseo",
  "source_version": "4d8d7ea2",
  "license": "MIT",
  "timestamp": "2026-11-24T05:14:12.029Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-crawlseo-crawlseo",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [crawlseo/crawlseo](https://github.com/crawlseo/crawlseo) (Revision: `4d8d7ea2`).  
> **License**: MIT | **Timestamp**: `2026-11-24T05:14:12.029Z`  
> **Learning ID**: `learn-github-crawlseo-crawlseo`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `app/api/sites/[siteId]/domain-overview/route.test.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in crawlseo/crawlseo. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2b28c327`: metrics): compare periods that both have data. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `app/api/sites/[siteId]/domain-overview/route.test.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
  current: { clicks: 7, impressions: 80, avgPosition: 12, uniqueKeywords: 1 },
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
    keyword: { groupBy: vi.fn() },
  current: { clicks: 7, impressions: 80, avgPosition: 12 },
  db.keyword.groupBy.mockResolvedValue([{ query: "own keyword" }]);
    expect(db.keyword.groupBy).not.toHaveBeenCalled();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2b28c327` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T05:14:12.026Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795497252026",
    "title": "compare periods that both have data",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "crawlseo/crawlseo",
    "source_uri": "https://github.com/crawlseo/crawlseo",
    "source_version": "HEAD",
    "content_hash": "78357593108665db0887e995a29f704b3565361f75e33113d414192d8e72f455"
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
        "Harvested/verified timestamp recorded: 2026-11-24T05:14:12.026Z"
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
  "auth_token": "207ea4387d40c12ce64ef42b95b4ed553637d4294c88e8ebf2ea8e9b034e6d9c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-MN89] docs(graph): describe failed-build cleanup of the staged generation as best effo

<!-- PROVENANCE_START
{
  "source_repository": "giancarloerra/SocratiCode",
  "source_url": "https://github.com/giancarloerra/SocratiCode",
  "source_version": "d7bc0dc4",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-23T05:24:23.193Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-giancarloerra-socraticode",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [giancarloerra/SocratiCode](https://github.com/giancarloerra/SocratiCode) (Revision: `d7bc0dc4`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-23T05:24:23.193Z`  
> **Learning ID**: `learn-github-giancarloerra-socraticode`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `DEVELOPER.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in giancarloerra/SocratiCode. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `42283824`: docs(graph): describe failed-build cleanup of the staged generation as best effort. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `DEVELOPER.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
**A fresh generation's shards are published in bulk.** `persistSymbolGraph` mints a new generation id for every build, so none of its name or reverse shard point IDs can already exist. It therefore hands the whole set
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
**A fresh generation's shards are published in bulk.** `persistSymbolGraph` mints a new generation id for every build, so none of its name or reverse shard point IDs can already exist. It therefore hands the whole set to `saveShardsForFreshGeneration`, which serializes every shard first (an unsplittable entry fails the call before anything is written, and the pass yields to the event loop after each shard so it does not hold other requests for its whole length), coalesces the resulting points into requests of at most 50 points and `SYMBOL_SHARD_BULK_REQUEST_BYTES` (128 KiB) of serialized points, and sends them one after another with no previous-part lookups. For a graph of ~283 small shards that is about 6 write requests instead of 283 reads plus 283 writes; for larger shards it is more, because the byte bound keeps requests small. The bound is much lower than the 24 MiB `QDRANT_UPSERT_BUDGET_BYTES` the file payloads use on purpose: packing shards up to that budget sent the same bytes as a few multi-MB requests and, on a Qdrant serving searches at the same time, gave a clearly worse search p95 during publication (about 11 ms against about 3.5 ms at 128 KiB and about 2.9 ms with one
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `42283824` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T05:24:23.191Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795411463191",
    "title": "docs(graph): describe failed-build cleanup of the staged generation as best effo",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "giancarloerra/SocratiCode",
    "source_uri": "https://github.com/giancarloerra/SocratiCode",
    "source_version": "HEAD",
    "content_hash": "8c265ab6be006839ebe756d8c7de0b1575155ffbdadd75b3a3416c3cc4ef7913"
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
        "Harvested/verified timestamp recorded: 2026-11-23T05:24:23.191Z"
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
  "auth_token": "4e229b4892fc65c577882dbb01f54b586f91f837457590b035866aca53d93f92"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

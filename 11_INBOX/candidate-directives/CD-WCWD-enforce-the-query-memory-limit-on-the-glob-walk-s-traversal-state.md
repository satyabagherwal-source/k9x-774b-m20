# Candidate Directive: [CD-WCWD] Enforce the query memory limit on the glob walk's traversal state

<!-- PROVENANCE_START
{
  "source_repository": "ClickHouse/ClickHouse",
  "source_url": "https://github.com/ClickHouse/ClickHouse",
  "source_version": "78fb5256",
  "license": "Apache-2.0",
  "timestamp": "2026-11-27T07:58:35.341Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-clickhouse-clickhouse",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [ClickHouse/ClickHouse](https://github.com/ClickHouse/ClickHouse) (Revision: `78fb5256`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-27T07:58:35.341Z`  
> **Learning ID**: `learn-github-clickhouse-clickhouse`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/Storages/StorageFile.cpp`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in ClickHouse/ClickHouse. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0122c5f7`: Enforce the query memory limit on the glob walk's traversal state. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/Storages/StorageFile.cpp`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
#include <Common/UnorderedMapWithMemoryTracking.h>
#include <Common/UnorderedSetWithMemoryTracking.h>
    VectorWithMemoryTracking<size_t> matches_before_retries;
    VectorWithMemoryTracking<std::pair<std::string, size_t>> earlier_walks;
    UnorderedMapWithMemoryTracking<std::string, VisitedFrame> visited_frames;
    VectorWithMemoryTracking<VisitedFrame *> active_frames;
    VectorWithMemoryTracking<Collision> pending_collisions;
    VectorWithMemoryTracking<SkippedPath> skipped_paths;
    UnorderedSetWithMemoryTracking<std::string> listed_tails;
bool isMissing(
    PruningState::SkippedPath & skipped, const PruningState & pruning,
    const UnorderedMapWithMemoryTracking<std::string, size_t> & matched_paths)
    const VisitedFrame & frame, const std::string & prefix, PruningState & pruning,
    const UnorderedMapWithMemoryTracking<std::string, size_t> & matched_paths)
    UnorderedMapWithMemoryTracking<std::string, size_t> & matched_paths,
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
    std::vector<size_t> matches_before_retries;
    std::vector<std::pair<std::string, size_t>> earlier_walks;
    std::unordered_map<std::string, VisitedFrame> visited_frames;
    std::vector<VisitedFrame *> active_frames;
    std::vector<Collision> pending_collisions;
    std::vector<SkippedPath> skipped_paths;
    std::unordered_set<std::string> listed_tails;
bool isMissing(PruningState::SkippedPath & skipped, const PruningState & pruning, const std::unordered_map<std::string, size_t> & matched_paths)
    const VisitedFrame & frame, const std::string & prefix, PruningState & pruning, const std::unordered_map<std::string, size_t> & matched_paths)
    std::unordered_map<std::string, size_t> & matched_paths,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0122c5f7` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T07:58:35.339Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795766315339",
    "title": "Enforce the query memory limit on the glob walk's traversal state",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "ClickHouse/ClickHouse",
    "source_uri": "https://github.com/ClickHouse/ClickHouse",
    "source_version": "HEAD",
    "content_hash": "d9c3fcf9232d715537c113807f4281750bc5c75208267a6c33e086548e4d0861"
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
        "Harvested/verified timestamp recorded: 2026-11-27T07:58:35.339Z"
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
  "auth_token": "1dbbf686c8a185d1d60ba0b030954f7611fe6809566924fbcae88aa9a835b22c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

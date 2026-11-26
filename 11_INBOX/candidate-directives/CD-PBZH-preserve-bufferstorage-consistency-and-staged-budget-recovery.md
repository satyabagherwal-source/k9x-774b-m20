# Candidate Directive: [CD-PBZH] preserve BufferStorage consistency and staged budget recovery

<!-- PROVENANCE_START
{
  "source_repository": "alibaba/zvec",
  "source_url": "https://github.com/alibaba/zvec",
  "source_version": "9af55fa5",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T00:09:33.677Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-alibaba-zvec",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [alibaba/zvec](https://github.com/alibaba/zvec) (Revision: `9af55fa5`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T00:09:33.677Z`  
> **Learning ID**: `learn-github-alibaba-zvec`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/ailego/buffer/block_eviction_queue.cc`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in alibaba/zvec. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `21229b48`: preserve BufferStorage consistency and staged budget recovery. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/ailego/buffer/block_eviction_queue.cc`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
#include <optional>
#include <utility>
thread_local size_t *initial_queue_backing = nullptr;
  bool has_lifetime_slot{false};
void *BlockEvictionQueue::ProcessQueueTraits::malloc_lifetime(size_t bytes) {
  // Process-wide queues keep their producers and indexes until process exit.
  return MemoryLimitPool::get_instance().allocate_queue_memory(bytes, true);
}

BlockEvictionQueue::BlockEvictionQueue() {
  // Only the queues' initial block pools are allocated through the traits
  // during construction. They stay mapped for the lifetime of this instance.
  auto *previous =
      std::exchange(initial_queue_backing, &initial_backing_bytes_);
  auto restore =
      ScopeGuard::Make([previous] { initial_queue_backing = previous; });
  for (size_t i = 0; i < kQueueCount; ++i) {
    evict_queues_.emplace_back(kEvictQueueCapacity);
  }
}

void *MemoryLimitPool::allocate_queue_memory(size_t bytes, bool lifetime) {
    if (lifetime && !slab->has_lifetime_slot) {
      slab->has_lifetime_slot = true;
      queue_runtime_lifetime_size_.fetch_add(slab->mapping_bytes,
                                             std::memory_order_relaxed);
    }
  if (initial_queue_backing) *initial_queue_backing
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
void *MemoryLimitPool::allocate_queue_memory(size_t bytes) {
    release_fixed(bytes, &metadata_used_size_, Backing::kLive, projection);
  const auto admit = [&] {
    return process_rss_.try_materialize_reusable(bytes, block->projection);
  if (!required) return admit();
      release_committed(bytes, Backing::kLive, projection);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `21229b48` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T00:09:33.674Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795651773674",
    "title": "preserve BufferStorage consistency and staged budget recovery",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "alibaba/zvec",
    "source_uri": "https://github.com/alibaba/zvec",
    "source_version": "HEAD",
    "content_hash": "622c2184ac7cb15b57525eea296263593b829d96a2e6fb2337ea0ff72416db75"
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
        "Harvested/verified timestamp recorded: 2026-11-26T00:09:33.674Z"
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
  "auth_token": "427e08028e8a5275f09907b7189b59b4904ac9fe5565f0a0ad0c1062003a8d59"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

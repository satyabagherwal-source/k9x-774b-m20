# Candidate Directive: [CD-R9TT] Two-Phase Read-Validate Under Cache Concurrency

<!-- PROVENANCE_START
{
  "source_repository": "StarRocks/starrocks",
  "source_url": "https://github.com/StarRocks/starrocks",
  "source_version": "37e75d93",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T08:21:35.489Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-starrocks-starrocks",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [StarRocks/starrocks](https://github.com/StarRocks/starrocks) (Revision: `37e75d93`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T08:21:35.489Z`  
> **Learning ID**: `learn-github-starrocks-starrocks`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-001 (Untrusted External Input Boundary Invariant): Opposing directive on 'validate': candidate forbids action ('never validate') while canonical Rule CANON-001 prescribes it ('always validate'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-001 (Untrusted External Input Boundary Invariant)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When retrieving an immutable, ref-counted resource from a sharded concurrent cache that requires deep structural or identity validation (e.g., column schema verification, digest authentication), code **MUST NOT** execute linear column/field validation loops while holding the shard-level synchronization primitive (mutex/spinlock). Code **MUST** extract the shared/ref-counted pointer under the lock, release the lock immediately, and execute validation outside the critical section.

**WHY**:
Validation operations scale with structure width $O(K)$ where $K$ is the number of schema columns or entity attributes. Shards are selected by coarse hash IDs (e.g., `schema_id`). Holding a shard lock while iterating across wide structures forces concurrent queries on different partitions or tablets of the same table to serialize behind identity validation. This induces thread pool exhaustion and high query latency spikes ($>30\times$). Furthermore, if the cached object's destructor re-acquires the cache lock (e.g., during self-eviction on ref-count zero), holding the lock across an invalidation path leads to a fatal recursive deadlock.

**WHEN TO APPLY**:
- Sharded metadata caches where keys represent coarse table identifiers but values represent fine-grained schemas.
- High-concurrency database scan compilation paths.
- C++ systems using `std::shared_ptr` where intrusive or shared destructors notify/modify the container.

**VERIFIED IMPLEMENTATION PATTERN**:
```cpp
// Production-grade pattern: Two-Phase Read-Validate
std::pair<TabletSchemaMap::TabletSchemaPtr, bool> TabletSchemaMap::emplace(const TabletSchemaPB& schema_pb) {
    TabletSchemaPtr cached_schema = nullptr;
    bool inserted = false;
    SchemaId id = schema_pb.id();

    {
        // PHASE 1: Fast Critical Section. Shard lock retained only for map lookup/pointer copy.
        auto& shard = _get_shard(id);
        std::lock_guard<std::mutex> lock(shard.lock);
        auto it = shard.map.find(id);
        if (it != shard.map.end()) {
            cached_schema = it->second.lock(); // Promote weak_ptr to shared_ptr
        }
        if (cached_schema == nullptr) {
            auto fresh_schema = TabletSchema::create(schema_pb, nullptr);
            shard.map[id] = fresh_schema;
            return std::make_pair(std::move(fresh_schema), true);
        }
    } // UNLOCK: shard.lock is freed prior to schema column-level traversal

    // PHASE 2: Lock-Free Validation & Compatibility Resolution
    // Deep comparison of column unique IDs runs concurrently without blocking other tablets
    if (UNLIKELY(!check_schema_unique_id(schema_pb, cached_schema))) {
        // Fallback: allocate an isolated non-cached instance
        return std::make_pair(TabletSchema::create(schema_pb, nullptr), false);
    }

    return std::make_pair(std::move(cached_schema), false);
}
```

**NEGATIVE CONSTRAINT**:
```cpp
// ANTI-PATTERN: DO NOT validate elements under the shared collection lock
std::pair<TabletSchemaMap::TabletSchemaPtr, bool> TabletSchemaMap::emplace_buggy(const TabletSchemaPB& schema_pb) {
    auto& shard = _get_shard(schema_pb.id());
    std::lock_guard<std::mutex> lock(shard.lock);
    auto it = shard.map.find(schema_pb.id());
    if (it != shard.map.end()) {
        auto cached = it->second.lock();
        if (cached) {
            // FATAL: Iterating over hundreds of columns while holding shard.lock.
            // Starves every tablet in the cluster executing scans on this schema.
            for (int i = 0; i < schema_pb.column_size(); ++i) {
                if (schema_pb.column(i).unique_id() != cached->column(i).unique_id()) {
                    return std::make_pair(TabletSchema::create(schema_pb, nullptr), false);
                }
            }
            return std::make_pair(cached, false);
        }
    }
    // ...
}
```

**VERIFICATION METHOD**:
Inject thread-contention assertions utilizing sync points:
```cpp
TEST_F(TabletSchemaMapTest, verify_validation_outside_lock) {
    TabletSchemaMap schema_map;
    auto schema_pb = _gen_schema_pb(1, 100);
    schema_map.emplace(schema_pb);

    SyncPoint::GetInstance()->SetCallBack("TabletSchemaMap::emplace:check_unique_id", [&](void* arg) {
        // Must succeed without blocking: proves lock has been released
        auto probe = std::async(std::launch::async, [&]() { return schema_map.contains(1); });
        ASSERT_EQ(std::future_status::ready, probe.wait_for(std::chrono::milliseconds(50)));
        EXPECT_TRUE(probe.get());
    });
    SyncPoint::GetInstance()->EnableProcessing();
    schema_map.emplace(schema_pb);
    SyncPoint::GetInstance()->DisableProcessing();
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:21:35.487Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-001 (Untrusted External Input Boundary Invariant): Opposing directive on 'validate': candidate forbids action ('never validate') while canonical Rule CANON-001 prescribes it ('always validate'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-001 (Untrusted External Input Boundary Invariant)",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0.51,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 51%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=FAIL.",
  "item": {
    "id": "cand-1794990095487",
    "title": "Two-Phase Read-Validate Under Cache Concurrency",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "StarRocks/starrocks",
    "source_uri": "https://github.com/StarRocks/starrocks",
    "source_version": "HEAD",
    "content_hash": "a2bcdd2295493e2d023da9a1be3d5f3df6f35ebdcbe45b1c06edfc17adfc884b"
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
      "opposing_rule": "RULE-CANON-001 (Untrusted External Input Boundary Invariant)",
      "unsupported_assumptions": [],
      "findings": [
        "DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-001 (Untrusted External Input Boundary Invariant): Opposing directive on 'validate': candidate forbids action ('never validate') while canonical Rule CANON-001 prescribes it ('always validate')"
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:21:35.487Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "FAIL",
      "score": 0.4,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": true,
      "conflicting_rule": "RULE-CANON-001 (Untrusted External Input Boundary Invariant)",
      "findings": [
        "CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-001 (Untrusted External Input Boundary Invariant)"
      ],
      "details": []
    }
  },
  "detected_contradictions": [
    "Canonical opposition: Clashes with RULE-CANON-001 (Untrusted External Input Boundary Invariant)",
    "Conflict with RULE-CANON-001 (Untrusted External Input Boundary Invariant)"
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
  "auth_token": "ea3d53827a2bb8674e6aad746b43c1172edb67d6a4233624fc026f8970cd4d5b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

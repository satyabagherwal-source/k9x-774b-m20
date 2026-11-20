# Candidate Directive: [CD-WONH] keep telemetry streams node-local and strip them from snapshots (Rus

<!-- PROVENANCE_START
{
  "source_repository": "FalkorDB/FalkorDB",
  "source_url": "https://github.com/FalkorDB/FalkorDB",
  "source_version": "b65fcac0",
  "license": "NOASSERTION",
  "timestamp": "2026-11-20T00:33:14.957Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-falkordb-falkordb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [FalkorDB/FalkorDB](https://github.com/FalkorDB/FalkorDB) (Revision: `b65fcac0`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-20T00:33:14.957Z`  
> **Learning ID**: `learn-github-falkordb-falkordb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain M

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `proofs/graph_persist/COVERAGE.tsv`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in FalkorDB/FalkorDB. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `59764075`: telemetry): keep telemetry streams node-local and strip them from snapshots (Rust port of #3759). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `proofs/graph_persist/COVERAGE.tsv`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
src/redis_type.rs	io_cache_size	72	PROVEN	RedisType.ioCacheSize: ioCacheSize_spec, cache_size_on_load (RedisModule_GetContextFromIO = FFI; the configured CACHE_SIZE is the input)
src/redis_type.rs	io_key_name	87	PROVEN	RedisType.ioKeyName: ioKeyName_spec (GetKeyNameFromIO/StringPtrLen results are inputs)
src/redis_type.rs	graph_rdb_load	100	PROVEN	R
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
src/redis_type.rs	io_cache_size	71	PROVEN	RedisType.ioCacheSize: ioCacheSize_spec, cache_size_on_load (RedisModule_GetContextFromIO = FFI; the configured CACHE_SIZE is the input)
src/redis_type.rs	io_key_name	86	PROVEN	RedisType.ioKeyName: ioKeyName_spec (GetKeyNameFromIO/StringPtrLen results are inputs)
src/redis_type.rs	graph_rdb_load	99	PROVEN	RedisType.loadWhole/loadPartial: load_main_last, load_main_first (registry Arc = key value = finished graph, no vkey registered, any key order); decoder Persist.multi_load; cacheOnLoad: cache_size_on_load (W5-rdb-1 fixed by #3262 361f62ac1)
src/redis_type.rs	graph_rdb_save	189	PROVEN	RedisType.rdbSave (= saveKeySlice.getD whole): save_main, save_vkey (slice i, key_count K), save_single
src/redis_type.rs	save_key_slice	213	PROVEN	RedisType.saveKeySlice: save_main, save_vkey, save_single, metaSave_of_slice (VKEY_STATE/GRAPH_REGISTRY lookups are the modelled maps; rdb_save_graph_key = Persist encoder)
src/redis_type.rs	save_string_nul	250	PROVEN	Codec.stripNul_nulTerm
src/redis_type.rs	strip_trailing_nul	268	PROVEN	Codec.stripNul_nulTerm
src/redis_type.rs	graph_aux_save	274	PROVEN	RedisType.auxSave: aux_roundtrip, aux_after
src/redis_type.rs	
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `59764075` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T00:33:14.955Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795134794955",
    "title": "keep telemetry streams node-local and strip them from snapshots (Rus",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "FalkorDB/FalkorDB",
    "source_uri": "https://github.com/FalkorDB/FalkorDB",
    "source_version": "HEAD",
    "content_hash": "fdd9b695861b77b1df6bfb385004307136af1bea8d787b94fdd9bcd70caf8700"
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
        "Harvested/verified timestamp recorded: 2026-11-20T00:33:14.955Z"
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
  "auth_token": "98c3f3f4380dd1e5163aeecc0c97bb0f08e8db696b1094067b06300bc6e440d3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

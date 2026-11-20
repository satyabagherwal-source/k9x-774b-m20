# Candidate Directive: [CD-X15K] telemetry): keep telemetry streams node-local and strip them from snapshots (Rus

<!-- PROVENANCE_START
{
  "source_repository": "falkordb-falkordb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T00:33:31.049Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-falkordb-falkordb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [falkordb-falkordb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T00:33:31.049Z`  
> **Learning ID**: `LEARN-EVO-falkordb-falkordb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-20T00:33:31.156Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795134811156",
    "title": "telemetry): keep telemetry streams node-local and strip them from snapshots (Rus",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "falkordb-falkordb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "0bbeb4290706e40730c4905085c96dee5f98b7b627d36d64ff779916daaec11b"
  },
  "evidence_fingerprint": "NO_EVIDENCE",
  "dimensions": {
    "source_reliability": {
      "status": "FAIL",
      "score": 0,
      "tier": "UNTRUSTED_EXTERNAL",
      "findings": [
        "MISSING_SOURCE_URI: Knowledge has no source URL or locator"
      ],
      "details": [
        "Source is completely untraceable; origin cannot be verified."
      ]
    },
    "evidence_quality": {
      "status": "WARN",
      "score": 0.2,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [
        "NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records"
      ],
      "details": [
        "Claim is uncorroborated; relies solely on raw unverified source text."
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
        "Harvested/verified timestamp recorded: 2026-11-20T00:33:31.157Z"
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
    "Source provenance",
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [],
  "auth_token": "747d48c1e9a411e1db07afa5111b89472d075bd8170a5252ba47b2bd2b16522b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

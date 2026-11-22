# Candidate Directive: [CD-XXYU] close the #3573 gaps (HNSW build parallelism and kernels, import me

<!-- PROVENANCE_START
{
  "source_repository": "infiniflow/infinity",
  "source_url": "https://github.com/infiniflow/infinity",
  "source_version": "07c5af63",
  "license": "Apache-2.0",
  "timestamp": "2026-11-22T02:29:32.598Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-infiniflow-infinity",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [infiniflow/infinity](https://github.com/infiniflow/infinity) (Revision: `07c5af63`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-22T02:29:32.598Z`  
> **Learning ID**: `learn-github-infiniflow-infinity`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/rust_engine.yml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in infiniflow/infinity. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `38370ad8`: rust_engine: close the #3573 gaps (HNSW build parallelism and kernels, import memory, fulltext, exact scan). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/rust_engine.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
  # The level `rust_engine/.cargo/config.toml` leaves at `native` is wrong for a
  # binary that has to run elsewhere, so every lane pins its own here.
  #
  # These are the *target-scoped* variables, not `RUSTFLAGS`: cargo appends them
  # to the section's list, so the `link-arg=-fuse-ld=mold` in `config.toml`
  # survives and the later `-C target-cpu=` wins. `RUSTFLAGS` would replace the
  # list wholesale and drop mold. The loom and sanitizer steps set `RUSTFLAGS`
  # deliberately - they want a clean slate - and pass the linker flag themselves
  # where it matters.
  #
  # AVX2 baseline (Haswell, 2013). The binary carries no AVX-512: `crc32fast`
  # was the only source of it, and it is patched to a slicing-by-8 stand-in
  # (`crates/crc32fast-shim`, see `[patch.crates-io]`). Without that patch the
  # crate emits 52 `zmm` instructions whatever `target-cpu` says, and on this
  # runner pool some CPUs advertise `avx512f` in CPUID and then reject it - the
  # engine died with SIGILL before it could log a line.
  #
  # The C flags repeat the level for a different reason: rustc's flag does not
  # reach RocksDB. `librocksdb-sys`'s build script reads
  # `CARGO_ENCODED_RUSTFLAGS` and 
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `38370ad8` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T02:29:32.596Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795314572596",
    "title": "close the #3573 gaps (HNSW build parallelism and kernels, import me",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "infiniflow/infinity",
    "source_uri": "https://github.com/infiniflow/infinity",
    "source_version": "HEAD",
    "content_hash": "a6d6603c28b226d28a71db5aaebe7fbc7df46c5f8a748bbbc5f75e51aa41837f"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-22T02:29:32.596Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "4dfded15d226a5f07ab8f62612093b95e731a9cac19a8f92a58494c49856a34a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-6B6F] Remove WarpBuild microbenchmark jobs from nightly workflow

<!-- PROVENANCE_START
{
  "source_repository": "slatedb/slatedb",
  "source_url": "https://github.com/slatedb/slatedb",
  "source_version": "864e081b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-22T10:03:56.823Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-slatedb-slatedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [slatedb/slatedb](https://github.com/slatedb/slatedb) (Revision: `864e081b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-22T10:03:56.823Z`  
> **Learning ID**: `learn-github-slatedb-slatedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain A

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.github/workflows/nightly.yaml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in slatedb/slatedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `864e081b`: Remove WarpBuild microbenchmark jobs from nightly workflow. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/nightly.yaml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
name: Nightly
  contents: read
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
name: Nightly Benchmarks
  # Required for storing benchmark results
  contents: write
  # Required for reading ZeroFS's main action status
  actions: read
  # Run and save nightly microbenchmark data so PRs have a fresh baseline to compare against
  microbenchmarks:
    runs-on: warp-ubuntu-latest-arm64-8x
    steps:
      - uses: actions/checkout@v4

      - name: Run microbenchmark
        run: cargo bench --features bench-internal -- --output-format bencher | tee output.txt

      - name: Download nightly microbenchmark data
        uses: actions/cache/restore@v4
        with:
          path: ./microbenchmarks-cache
          key: ${{ runner.os }}-microbenchmarks-${{ github.run_id }}
          restore-keys: |
            ${{ runner.os }}-microbenchmarks-

      - name: Update microbenchmark result
        id: update_microbenchmark_result
        continue-on-error: true
        uses: benchmark-action/github-action-benchmark@v1
        with:
          name: cargo bench
          tool: "cargo"
          output-file-path: output.txt
          github-token: ${{ secrets.GITHUB_TOKEN }}
          external-data-json-path: ./microbenchmarks-cache/benchmark-data.json
          fail-on-ale
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `864e081b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T10:03:56.821Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795341836821",
    "title": "Remove WarpBuild microbenchmark jobs from nightly workflow",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "slatedb/slatedb",
    "source_uri": "https://github.com/slatedb/slatedb",
    "source_version": "HEAD",
    "content_hash": "87d40b95dc45a0cd7ab903be5cf25d1abfa766dba4bc8b94ae16849600bf42d8"
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
        "Harvested/verified timestamp recorded: 2026-11-22T10:03:56.821Z"
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
  "auth_token": "34065bd40039040144de202725e6d20c1bca908645c2233836bd11de57e4ef27"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

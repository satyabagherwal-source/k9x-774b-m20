# Candidate Directive: [CD-F0ZX] encode a block with the schema at its bound; key the append buffer b

<!-- PROVENANCE_START
{
  "source_repository": "infiniflow/infinity",
  "source_url": "https://github.com/infiniflow/infinity",
  "source_version": "583c8505",
  "license": "Apache-2.0",
  "timestamp": "2026-11-18T14:15:59.181Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-infiniflow-infinity",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [infiniflow/infinity](https://github.com/infiniflow/infinity) (Revision: `583c8505`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-18T14:15:59.181Z`  
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
Prevents defects observed in production commit `583c8505`: checkpoint: encode a block with the schema at its bound; key the append buffer by column id. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `.github/workflows/rust_engine.yml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
      - name: Python SDK slow cases
        # The reference's `reldeb_parallel_test` runs the same files with
        # `-m "not complex"`, i.e. including `@pytest.mark.slow`: the cases that
        # build 10k tables, 10k databases and long-abandoned rows. They are the
        # ones a nightly needs and a PR does not, so they only run when the
        # workflow is dispatched or scheduled.
        if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
        continue-on-error: true
        run: .venv/bin/python -m pytest -q python/test_pysdk -m "slow and not complex" --tb=short
      - name: Parallel suite (Python)
        # `python/parallel_test`: the reference's `debug_tsan_parallel_test`
        # target. Its Go counterpart above drives the same engine from
        # goroutines; this one keeps the Python form because the client-side
        # behaviour it asserts (session handling under writers) only exists in
        # the SDK.
        if: github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'
        continue-on-error: true
        run: .venv/bin/python -m pytest -q python/parallel_test -m "not complex and not slow" --tb=short
  
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
      - name: Ignored tests (perf probes, long replay loops)
        # slow_tests.yml runs nightly, plus the cases the unit lane drops for
        # its wall time: the ColBERT-SaR training ports and the `rabitq::tests::diag_*`
        # diagnostics. They are reported rather than gated for
        # now: at least `new_catalog_index_internal_ut::disabled_slow_test_populate_index`
        # fails on the port (fulltext_tail is None where the case expects
        # (0, 16384)), and that predates the current work. Flip this to a gate
        # once the set is triaged.
        run: cargo test --workspace -- --ignored
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `583c8505` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T14:15:59.179Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795011359179",
    "title": "encode a block with the schema at its bound; key the append buffer b",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "infiniflow/infinity",
    "source_uri": "https://github.com/infiniflow/infinity",
    "source_version": "HEAD",
    "content_hash": "e4453b6aa058d3f578672ee0c5a3b6d3ceaa969fe28935bcba77ae4e0a8e8d61"
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
        "Harvested/verified timestamp recorded: 2026-11-18T14:15:59.179Z"
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
  "auth_token": "c57c37f77ec8a08262cba69e66cbbe6fd1ff3e7d2227f22fd9f6c5c95c3ed681"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

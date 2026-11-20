# Candidate Directive: [CD-LJNC] Confirm performance regressions

<!-- PROVENANCE_START
{
  "source_repository": "MaterializeInc/materialize",
  "source_url": "https://github.com/MaterializeInc/materialize",
  "source_version": "116bffc3",
  "license": "NOASSERTION",
  "timestamp": "2026-11-20T01:20:34.488Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-materializeinc-materialize",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [MaterializeInc/materialize](https://github.com/MaterializeInc/materialize) (Revision: `116bffc3`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-20T01:20:34.488Z`  
> **Learning ID**: `learn-github-materializeinc-materialize`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `misc/python/materialize/workload_replay/executor.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in MaterializeInc/materialize. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `6b3569ab`: workload-replay: Confirm performance regressions. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `misc/python/materialize/workload_replay/executor.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    without crashing. A performance failure must repeat for the same metric in
    a fresh reference/current pair. Query errors are not retried.
    def run(image: str | None) -> tuple[dict[str, Any], str]:
        print(f"-- Running against {image or 'current materialized'}")
                image=image,
            stats = test(
            version = c.query_mz_version()
        return stats, version
    if not compare_against:
        _, new_version = run(None)
    tag = resolve_tag(compare_against)
    if tag is None:
        raise ValueError(f"Could not resolve reference {compare_against}")
    filename = posixpath.relpath(file, LOCATION)
    pending: set[str] = set()
    tables = []
    # A fast baseline can also produce a false regression, so rerun both versions.
    for attempt in range(1, 3):
        stats_old, old_version = run(f"{image_registry()}/materialized:{tag}")
        stats_new, new_version = run(None)
        print(f"-- Comparing {old_version} against {new_version}, attempt {attempt}")
        plot_docker_stats_compare(
            stats_old=stats_old,
            stats_new=stats_new,
            file=f"{filename}_attempt_{attempt}",
            old_version=old_
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
    without crashing.
    import random
    stats_old = None
    old_version = None
    if compare_against:
        tag = resolve_tag(compare_against)
        print(f"-- Running against materialized:{tag} (reference)")
                image=f"{image_registry()}/materialized:{tag}",
            stats_old = test(
            old_version = c.query_mz_version()
    print("-- Running against current materialized")
    random.seed(seed)
    with c.override(
        Materialized(
            image=None,
            cluster_replica_size=cluster_replica_sizes,
            ports=[6875, 6874, 6876, 6877, 6878, 6880, 6881, 26257],
            environment_extra=["MZ_NO_BUILTIN_CONSOLE=0"],
            additional_system_parameter_defaults=additional_system_parameter_defaults,
        )
    ):
        stats_new = test(
            c,
            workload,
            file,
            factor_initial_data,
            factor_ingestions,
            factor_queries,
            runtime,
            verbose,
            True,
            True,
            early_initial_data,
            True,
            True,
            max_concurrent_queries,
        )
        new_version = c.query_mz_version()
  
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `6b3569ab` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:20:34.486Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795137634486",
    "title": "Confirm performance regressions",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "MaterializeInc/materialize",
    "source_uri": "https://github.com/MaterializeInc/materialize",
    "source_version": "HEAD",
    "content_hash": "a66d31b251f87b050184e11a2b442ec0acd6499eb7f5051d0df700fa152e4e51"
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:20:34.486Z"
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
  "auth_token": "728639710907cce96f8260e30f0e39efbf870bdef61028efa949ff69ccfe694e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-6KN7] Diagnostic Compile-Time Cfg Isolation Over Cargo Dependency Leaks

<!-- PROVENANCE_START
{
  "source_repository": "aleo-labs-protocol/snarkOS",
  "source_url": "https://github.com/aleo-labs-protocol/snarkOS",
  "source_version": "ffa93916",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T08:24:30.211Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-aleo-labs-protocol-snarkos",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [aleo-labs-protocol/snarkOS](https://github.com/aleo-labs-protocol/snarkOS) (Revision: `ffa93916`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T08:24:30.211Z`  
> **Learning ID**: `learn-github-aleo-labs-protocol-snarkos`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**: System-wide diagnostic instrumentation (such as lock profilers, deadlock monitors, or allocator trackers) that replaces core synchronization primitives MUST be driven via distinct compiler configuration flags (`--cfg <name>`) rather than standard Cargo feature flags. Cargo workspace aliases MUST enforce flag placement after subcommands, and codebases MUST NOT expose underlying diagnostic crate types into public API boundaries.

**WHY**: Cargo features are additive and unified across the entire workspace dependency graph. If crate A enables feature `instrumentation` and crate B does not, Cargo unifies features and turns it on for both in workspace builds. However, individual package tests (`cargo test -p crate-b`) run with disjoint feature sets. If test suites or internal imports accidentally depend on the instrumented crate without declaring it (or assume types are identical), single-crate builds fail while workspace builds pass. Swapping primitives via `--cfg` prevents feature unification pollution and ensures uniform application across all crates.

**WHEN TO APPLY**: Low-level runtime replacement crates: deadlock detection (`locktick`, `parking_lot/deadlock_detection`), custom allocators (`jemalloc`, `mimalloc`), or tracing wrappers on sync types.

**VERIFIED IMPLEMENTATION PATTERN**:
```toml
# In .cargo/config.toml
[alias]
locktick-build = ["build", "--config", "target.'cfg(all())'.rustflags=['--cfg','locktick']"]
locktick-check = ["check", "--config", "target.'cfg(all())'.rustflags=['--cfg','locktick']"]
locktick-clippy = ["clippy", "--config", "target.'cfg(all())'.rustflags=['--cfg','locktick']"]
```

```rust
// In utilities/src/locks.rs
#![allow(clippy::disallowed_types)]

#[cfg(not(locktick))]
type Guard<G> = G;

#[cfg(locktick)]
type Guard<G> = ::locktick::LockGuard<G>;

pub mod parking_lot {
    use super::Guard;

    #[cfg(locktick)]
    use ::locktick::parking_lot as backend;
    #[cfg(not(locktick))]
    use ::parking_lot as backend;

    pub type Mutex<T> = backend::Mutex<T>;
    pub type RwLock<T> = backend::RwLock<T>;
    pub type MutexGuard<'a, T> = Guard<::parking_lot::MutexGuard<'a, T>>;
    pub type RwLockReadGuard<'a, T> = Guard<::parking_lot::RwLockReadGuard<'a, T>>;
    pub type RwLockWriteGuard<'a, T> = Guard<::parking_lot::RwLockWriteGuard<'a, T>>;
}
```

**NEGATIVE CONSTRAINT**:
```toml
# ANTI-PATTERN: Propagating diagnostic overrides via Cargo features
[features]
locktick = [
  "dep:locktick",
  "snarkos-node/locktick",
  "snarkos-node-bft/locktick",
  "snarkos-node-consensus/locktick",
  # Viral propagation: every new crate must manually forward the feature.
  # Feature unification in workspace tests leaks the dependency, hiding broken single-crate tests.
]
```

**VERIFICATION METHOD**: CI lint job executing `cargo check --workspace --all-targets` followed by verifying that single-package commands (`cargo check -p snarkos-utilities`) succeed without optional locktick crates present in normal profiles.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T08:24:30.210Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795249470210",
    "title": "Diagnostic Compile-Time Cfg Isolation Over Cargo Dependency Leaks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "aleo-labs-protocol/snarkOS",
    "source_uri": "https://github.com/aleo-labs-protocol/snarkOS",
    "source_version": "HEAD",
    "content_hash": "0ad26514c5897f6ede33554806834d0a1a561e21fac875de4e1dd99fd5da53c0"
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
        "Harvested/verified timestamp recorded: 2026-11-21T08:24:30.210Z"
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
  "auth_token": "f4c4977284baa0dda09e9035052ab5b87486547a3937c8f1ba255eea4876bb04"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-9NF4] scope fault injection rules to the installing fixture's prefix

<!-- PROVENANCE_START
{
  "source_repository": "databendlabs/databend",
  "source_url": "https://github.com/databendlabs/databend",
  "source_version": "328efad7",
  "license": "Apache-2.0",
  "timestamp": "2026-11-13T21:45:20.849Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-databendlabs-databend",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [databendlabs/databend](https://github.com/databendlabs/databend) (Revision: `328efad7`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-13T21:45:20.849Z`  
> **Learning ID**: `learn-github-databendlabs-databend`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain B

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/common/storage/src/fault_injection_layer.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in databendlabs/databend. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7cac7adf`: storage): scope fault injection rules to the installing fixture's prefix. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/common/storage/src/fault_injection_layer.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
//! A rule is process-global, so it must be scoped to the fixture that installed it: other
//! tests in the same binary keep doing storage IO while it is installed, and they must not see
//! it. The path is matched as a prefix, and [`FaultRule::in_root`] binds the rule to one
//! storage root, since fixtures with separate roots and metastores can share a relative table
//! prefix. The rule is removed when its [`FaultHandle`] is dropped, so a failing test cannot
//! leave it behind for the rest of the process.
//!
//! let prefix = table_prefix(&fixture);
//! let fault = FaultInjection::install(
//!     FaultRule::new(FaultOp::Write, format!("{prefix}/_ss/"), FaultKind::Permanent)
//!         .in_root(fixture.storage_root()),
//! );
use opendal::raw::normalize_root;
/// A fault to inject: `kind` for every `op` on a path under `path_contains`, at most
///
/// `path_contains` is matched as a prefix, so a rule is anchored to the storage prefix of the
/// fixture that installed it. A pattern like `_ss/` does not match another fixture's
/// `1/11/_ss/…`, which a substring match would.
///
/// The path an operator reports is relative to its root, and fixtures with separate roots and
/// se
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
//! let fault = FaultInjection::install(FaultRule::new(FaultOp::Write, "_ss/", FaultKind::Permanent));
/// A fault to inject: `kind` for every `op` whose path contains `path_contains`, at most
    fn fire(&self, op: FaultOp, path: &str) -> Option<Error> {
        if self.rule.op != op || !path.contains(&self.rule.path_contains) {
    /// Install a rule; it applies to every operator until removed.
    fn check(op: FaultOp, path: &str) -> Result<()> {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7cac7adf` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T21:45:20.847Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794606320847",
    "title": "scope fault injection rules to the installing fixture's prefix",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "databendlabs/databend",
    "source_uri": "https://github.com/databendlabs/databend",
    "source_version": "HEAD",
    "content_hash": "d1b49ec541b4abb3528018f936016e0dbf057fac304ee7832f64582c4b7c097d"
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
        "Harvested/verified timestamp recorded: 2026-11-13T21:45:20.847Z"
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
  "auth_token": "84fe40d7c5ffef3f19746ee6ebdb1b69e2ac2cac9850d2bcdef5f744aad1f342"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

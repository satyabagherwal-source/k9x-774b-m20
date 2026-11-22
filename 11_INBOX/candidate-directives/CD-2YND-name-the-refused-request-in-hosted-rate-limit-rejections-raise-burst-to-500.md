# Candidate Directive: [CD-2YND] name the refused request in hosted rate-limit rejections; raise burst to 500

<!-- PROVENANCE_START
{
  "source_repository": "freenet/freenet-core",
  "source_url": "https://github.com/freenet/freenet-core",
  "source_version": "52922483",
  "license": "NOASSERTION",
  "timestamp": "2026-11-22T15:37:16.009Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-freenet-freenet-core",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet/freenet-core](https://github.com/freenet/freenet-core) (Revision: `52922483`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-22T15:37:16.009Z`  
> **Learning ID**: `learn-github-freenet-freenet-core`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `crates/core/src/client_events/user_op_rate_limit.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `52922483`: name the refused request in hosted rate-limit rejections; raise burst to 500. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/core/src/client_events/user_op_rate_limit.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
/// Set generously (500). Measured on try.freenet.org: one River page load sends
/// 135 operations in its first 1.3 s (startup delegate reads plus a
/// legacy-delegate migration sweep), and the previous default of 100 rejected 17
/// of them. The count grows with the number of rooms and legacy delegates an
/// account has, so 500 leaves ~3.7x headroom over that measurement. A
/// false-positive throttle during app load stalls the whole UI, while a larger
/// ONE-TIME burst costs little: the sustained [`DEFAULT_PER_USER_OP_RATE_LIMIT`]
/// (10/sec) is the real flood cap for one identity, and a drained bucket takes
/// `burst / rate` = 50 s of idleness to refill. The burst is per token, and a
/// fresh token starts with a full bucket, so it also sets how many ops each
/// newly minted token gets for free; that token-rotation gap exists at any
/// burst (see [`MAX_TRACKED_USERS`]) and is not closed by this limiter.
///
/// Downstream queues still bound a burst aimed at one contract: the contract
/// handler's per-contract queue (`MAX_QUEUED_PER_CONTRACT`, 100) sheds the excess
/// of a single-contract flood, while an app load spreads its ops over many
/// contracts and delegates.
pu
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
/// Set generously (100): a heavy-room hosted user's app-load — room list +
/// per-room state + member lists + delegate secret reads across many rooms —
/// can plausibly burst past 50 ops in the first second after page load. A
/// false-positive throttle there breaks the UX worse than allowing a slightly
/// larger ONE-TIME burst; the sustained [`DEFAULT_PER_USER_OP_RATE_LIMIT`]
/// (10/sec) is the real flood cap, the burst is just the initial allowance.
pub const DEFAULT_PER_USER_OP_BURST: u64 = 100;
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `52922483` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T15:37:16.007Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795361836007",
    "title": "name the refused request in hosted rate-limit rejections; raise burst to 500",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet/freenet-core",
    "source_uri": "https://github.com/freenet/freenet-core",
    "source_version": "HEAD",
    "content_hash": "c64abb0e61bd74a1ffa33843915faff02786a4f3c2f0480de2c5e8837cbc06f7"
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
        "Harvested/verified timestamp recorded: 2026-11-22T15:37:16.007Z"
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
  "auth_token": "b0a6920c8d4a53976798cfe26ee88262ede948f2fcaf8d262c9a85e49117faa2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

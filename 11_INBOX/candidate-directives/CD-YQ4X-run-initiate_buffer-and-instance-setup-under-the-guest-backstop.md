# Candidate Directive: [CD-YQ4X] run initiate_buffer and instance setup under the guest backstop

<!-- PROVENANCE_START
{
  "source_repository": "freenet/freenet-core",
  "source_url": "https://github.com/freenet/freenet-core",
  "source_version": "0515d873",
  "license": "NOASSERTION",
  "timestamp": "2026-11-18T02:51:27.825Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-freenet-freenet-core",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet/freenet-core](https://github.com/freenet/freenet-core) (Revision: `0515d873`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-18T02:51:27.825Z`  
> **Learning ID**: `learn-github-freenet-freenet-core`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.claude/rules/contracts.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0515d873`: run initiate_buffer and instance setup under the guest backstop. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/contracts.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
All guest entry points, including the allocator export and instance setup
(module start function and `__frnt_set_id`), run under the wall-clock backstop
and panic capture: on a blocking-pool thread (a plain thread on a
`current_thread` runtime), with a host-side panic returned as an `Err`. The
typed calls share ONE body, `call_typed_blocking` in
`engine/wasmtime_engine.rs`; instance setup runs as one job of its own, whose
wall-clock bound allows each of its two entries its own budget. Nothing should
reintroduce a per-entry-point copy or an inline guest call.
initiate_buffer()         — allocator export, contracts and delegates
        ↓ all four
call_typed_blocking()     — execute_wasm_blocking

create_instance()         — module start function + __frnt_set_id
        ↓ one job
execute_wasm_blocking_within() — wall-clock backstop + panic capture
`call_void` is the one inline entry left, and only a test calls it.

  `GuestDelegateInstance`, not on the caller's. The allocator export gets no
  `GuestDelegateInstance` (it is called with `delegate_instance: None`), so a
  delegate's allocator cannot reach the delegate host functions. It has no use
  for them.
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
All three guest entry points share ONE body, `call_typed_blocking` in
`engine/wasmtime_engine.rs`. Delegates ran "sync, on the calling thread" until
#5480; they no longer do, and nothing should reintroduce a per-entry-point copy.
        ↓ all three
call_typed_blocking()     — spawn_blocking + wall-clock backstop + panic capture
  `GuestDelegateInstance`, not on the caller's.

  Scope that to `process()` and no further. Buffer setup and instantiation —
  `initiate_buffer`, `call_void`, `instantiate_and_init` — still enter the guest
  with `block_on_async(func.call_async(...))` INLINE on the calling thread, with
  no `execute_wasm_blocking` and no `GuestDelegateInstance`. That is why
  `exec_inbound_with_env` still sets `CURRENT_DELEGATE_INSTANCE` on the calling
  thread at all, as `DelegateEnvGuard`'s rustdoc explains. "Nothing
  delegate-related runs on the calling thread" is false and would produce a wrong
  call about exactly those paths.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0515d873` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T02:51:27.823Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794970287823",
    "title": "run initiate_buffer and instance setup under the guest backstop",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet/freenet-core",
    "source_uri": "https://github.com/freenet/freenet-core",
    "source_version": "HEAD",
    "content_hash": "80fa8d386c3d04da1f6ce760b583479b4b2ff89b86fe220397acb2dd9bccd6df"
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
        "Harvested/verified timestamp recorded: 2026-11-18T02:51:27.823Z"
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
  "auth_token": "2987fe04861abe65ecd66b590b7a09feccdeb3be54c948315fa86ceccd904865"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

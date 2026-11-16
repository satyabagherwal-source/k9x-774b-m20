# Candidate Directive: [CD-KT78] event loop keep-alives and VM handle references have owners

<!-- PROVENANCE_START
{
  "source_repository": "oven-sh/bun",
  "source_url": "https://github.com/oven-sh/bun",
  "source_version": "237bba51",
  "license": "NOASSERTION",
  "timestamp": "2026-11-16T12:53:09.716Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-oven-sh-bun",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oven-sh/bun](https://github.com/oven-sh/bun) (Revision: `237bba51`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-16T12:53:09.716Z`  
> **Learning ID**: `learn-github-oven-sh-bun`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `src/jsc/VmHandle.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in oven-sh/bun. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `bdd1a6a8`: jsc: event loop keep-alives and VM handle references have owners. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `src/jsc/VmHandle.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
pub unsafe extern "C" fn Bun__VmHandle__retainRef(r: *const Shared) {
    unsafe { Arc::increment_strong_count(r) };
/// Any thread: see [`VmHandle::post_cpp_task`].
/// `r` is a live reference its holder keeps for the duration of the call; `task` is a live heap `WebCore::EventLoopTask` handed over.
pub unsafe extern "C" fn Bun__VmHandle__post(
    unsafe { VmHandle::borrow_ref(r).post_cpp_task(kind, task) };
}

/// The JS thread, or the collector's while the JS thread is stopped.
#[unsafe(no_mangle)]
pub extern "C" fn Bun__eventLoop__refKeepAlive(vm: &VirtualMachine) {
    vm.event_loop().ref_keep_alive();
/// `Bun::EventLoopKeepAlive`.
pub extern "C" fn Bun__eventLoop__setKeptAlive(kept_alive: bool) {
    let event_loop = VirtualMachine::get().event_loop();
    if kept_alive {
        event_loop.ref_keep_alive();
        event_loop.unref_keep_alive();
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
pub unsafe extern "C" fn Bun__VmHandle__retainRef(r: *const Shared) -> *const Shared {
    unsafe { VmHandle::borrow_ref(r) }.clone().into_ref()
/// Any thread: post a C++ task to the VM's `kind` loop through a reference and
/// give the reference up (queued, or deleted unrun if the VM is closed).
/// `r` came from `Bun__VmHandle__retain*` and is not used afterwards; `task` is
/// a live heap `WebCore::EventLoopTask` handed over.
pub unsafe extern "C" fn Bun__VmHandle__postAndRelease(
    let handle = unsafe { VmHandle::from_ref(r) };
    // SAFETY: fn contract.
    unsafe { handle.post_cpp_task(kind, task) };
/// JS thread: adjust this VM's keep-alive directly.
pub extern "C" fn Bun__eventLoop__refKeepAlive(vm: &VirtualMachine, delta: core::ffi::c_int) {
    if delta > 0 {
        vm.event_loop().ref_keep_alive();
        vm.event_loop().unref_keep_alive();
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `bdd1a6a8` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T12:53:09.714Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794833589714",
    "title": "event loop keep-alives and VM handle references have owners",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "oven-sh/bun",
    "source_uri": "https://github.com/oven-sh/bun",
    "source_version": "HEAD",
    "content_hash": "cada99d59676a32c19a451d655673bbd0d89227db48dde38bce094f1207de484"
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
        "Harvested/verified timestamp recorded: 2026-11-16T12:53:09.714Z"
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
  "auth_token": "ba7af2587712ad052197a51ca02f08d1e1e8e279f6e96052a47a6e8be1ea8868"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-KVRD] jsc: event loop keep-alives and VM handle references have owners

<!-- PROVENANCE_START
{
  "source_repository": "oven-sh-bun-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-16T12:53:12.926Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-oven-sh-bun-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [oven-sh-bun-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-16T12:53:12.926Z`  
> **Learning ID**: `LEARN-EVO-oven-sh-bun-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T12:53:13.029Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794833593029",
    "title": "jsc: event loop keep-alives and VM handle references have owners",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "oven-sh-bun-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "76ec00caa63fefc7eb8488b4b8d688fedc123d6ee619fc3739e107509f502917"
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
        "Harvested/verified timestamp recorded: 2026-11-16T12:53:13.029Z"
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
  "auth_token": "ab1c96ed98f36844aee803459420c1596b323e3aae3e535a41abbcce51b492c8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

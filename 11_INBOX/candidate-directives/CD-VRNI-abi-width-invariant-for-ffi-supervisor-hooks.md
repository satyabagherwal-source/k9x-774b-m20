# Candidate Directive: [CD-VRNI] ABI Width Invariant for FFI Supervisor Hooks

<!-- PROVENANCE_START
{
  "source_repository": "metalbear-co/mirrord",
  "source_url": "https://github.com/metalbear-co/mirrord",
  "source_version": "3a843d8d",
  "license": "MIT",
  "timestamp": "2026-11-20T01:00:31.806Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-metalbear-co-mirrord",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [metalbear-co/mirrord](https://github.com/metalbear-co/mirrord) (Revision: `3a843d8d`).  
> **License**: MIT | **Timestamp**: `2026-11-20T01:00:31.806Z`  
> **Learning ID**: `learn-github-metalbear-co-mirrord`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When intercepting native runtime system calls via runtime-internal FFI bridges (such as Go's `runtime.asmcgocall` or equivalent assembly shims), the interceptor **MUST NOT** return return values across ABI boundaries where register width expectations differ. If the caller's assembly stub expects a 32-bit integer (`int32`/`MOVW`), return values wider than 32 bits (such as 64-bit kernel pointers or offsets from `mmap`, `lseek64`, or 64-bit file descriptors) **MUST** be passed through an out-pointer parameter allocated in memory, rather than through the direct scalar return register.

**WHY**:
On 64-bit architectures (specifically Linux ARM64 / AArch64), returning a 64-bit pointer (e.g. `0xffff83298000`) across an FFI stub typed as `int32` causes the runtime assembly trampoline to execute `MOVW` (Move Word) into the result register. This zero-extends or sign-extends the lower 32 bits into `0xffffffff83298000`. When the calling program dereferences this corrupted address, it crashes immediately with `SIGSEGV`.

**WHEN TO APPLY**:
Cross-language syscall interceptors, `LD_PRELOAD` wrappers, assembly-level Go runtime hooks, and any FFI boundary involving `asmcgocall` on AArch64, x86_64, or RISC-V.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Target: Rust FFI handler bridged to Go via asmcgocall
#[repr(C)]
pub struct SyscallResult {
    pub return_value: i64,
    pub errno_value: i32,
}

#[repr(C)]
pub struct SyscallInvocationArgs {
    pub sysno: i64,
    pub args: [usize; 6],
    // The result MUST be written to an explicit output struct pointer,
    // NEVER returned directly as a 64-bit value in register x0/rax if the ABI stub uses int32.
    pub result: *mut SyscallResult,
}

pub unsafe extern "C" fn mirrord_safe_syscall_bridge(args: *mut SyscallInvocationArgs) -> i32 {
    let invocation = &mut *args;
    let (res, err) = execute_native_syscall(invocation.sysno, invocation.args);
    
    (*invocation.result).return_value = res;
    (*invocation.result).errno_value = err;
    
    // Return explicit 0 status code matching the 32-bit ABI contract
    0
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER do this: Returning 64-bit integer directly through an ABI stub expecting int32
#[no_mangle]
pub unsafe extern "C" fn mirrord_bad_syscall_hook(sysno: i64, args: *const usize) -> i64 {
    // DEFECT: Go's ARM64 asmcgocall stub stores the return value using MOVW,
    // which discards bits 32-63. If this call was mmap(2) returning 0xffff83298000,
    // the Go caller receives 0xffffffff83298000, immediately crashing on memory access.
    libc::syscall(sysno, *args)
}
```

**VERIFICATION METHOD**:
Unit/Integration test compiled for `aarch64-unknown-linux-gnu` invoking an anonymous `mmap` above the 32-bit address space (`MAP_ANONYMOUS`, 64-bit hint) through the hooked runtime bridge, asserting that `res as u64 & 0xFFFF_FFFF_0000_0000 != 0` and dereferencing the address writes/reads cleanly without `SIGSEGV`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:00:31.806Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795136431806",
    "title": "ABI Width Invariant for FFI Supervisor Hooks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "metalbear-co/mirrord",
    "source_uri": "https://github.com/metalbear-co/mirrord",
    "source_version": "HEAD",
    "content_hash": "b7204d24a2e7784181579f4a769b8c8d4fb12fa9d5a29a24e31f63571d4c6130"
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:00:31.806Z"
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
  "auth_token": "97841df6f938e7149407d998383b2c61e7695d889b13e86f594afeeb39c24846"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

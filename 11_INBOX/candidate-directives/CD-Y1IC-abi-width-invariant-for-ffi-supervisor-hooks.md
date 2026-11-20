# Candidate Directive: [CD-Y1IC] ABI Width Invariant for FFI Supervisor Hooks

<!-- PROVENANCE_START
{
  "source_repository": "metalbear-co-mirrord-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T01:02:17.793Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-metalbear-co-mirrord-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [metalbear-co-mirrord-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T01:02:17.793Z`  
> **Learning ID**: `LEARN-EVO-metalbear-co-mirrord-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:02:17.891Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795136537891",
    "title": "ABI Width Invariant for FFI Supervisor Hooks",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "metalbear-co-mirrord-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "bb8cbb2e3f869c4ef8b84ece81f5d3d29146af7bce64c03943ac8b97e03b63a6"
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:02:17.891Z"
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
  "auth_token": "3135070288f3eda0ffc2d1f51c072faa32405e8bf8814e65c43bddf78fe8eb59"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

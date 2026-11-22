# Candidate Directive: [CD-WO4P] stm32/hsem: fix interrupt handler livelock; stm32/atomic: fix MMIO RMW

<!-- PROVENANCE_START
{
  "source_repository": "embassy-rs-embassy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T01:32:33.837Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-embassy-rs-embassy-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [embassy-rs-embassy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T01:32:33.837Z`  
> **Learning ID**: `LEARN-EVO-embassy-rs-embassy-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `embassy-stm32/CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in embassy-rs/embassy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0f0e5b86`: stm32/hsem: fix interrupt handler livelock; stm32/atomic: fix MMIO RMW. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `embassy-stm32/CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
- fix: stm32/atomic: `Reg::set_bits`/`clear_bits` (used by the HSEM, IPCC, I2C and SDMMC drivers) no longer use core atomics for the read-modify-write. `LDREX`/`STREX` on peripheral registers is UNPREDICTABLE on Armv7-M, and when the write re-arms an interrupt whose handler runs between the `LDREX` and the `STREX` the retry loop never terminates. The update is now done in a critical section.
- fix: stm32/hsem: `blocking_listen` and `listen` no longer drop a notification that was sent before the call. The notification is consumed after it has been observed instead of being cleared before waiting for it, which deadlocked `init_secondary` when the other core had already completed `init_primary` (e.g. when starting or restarting the secondary core under a debugger).
- fix: stm32/hsem: `HardwareSemaphoreInterruptHandler` now consumes the notification flags with `HSEM_CnICR` and latches them in software before waking. The latched masked status keeps the interrupt line asserted until the flags are cleared, so masking `HSEM_CnIER` (the old behavior) did not deassert it: arming the interrupt with a notification pending re-entered the handler forever, starving the tasks supposed to consume t
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
- fix: stm32/hsem: `blocking_listen` and `listen` no longer drop a notification that was sent before the call. The interrupt flag is now consumed after it has been observed instead of being cleared before waiting for it, which deadlocked `init_secondary` when the other core had already completed `init_primary` (e.g. when starting or restarting the secondary core under a debugger).
- fix: stm32/hsem: `listen` waits on the unmasked interrupt status instead of the masked one. The interrupt handler disables the interrupt in `HSEM_IER` before waking, so the masked status could read as clear while a notification was still pending and the future would never complete.
- feat: stm32/hsem: add `HardwareSemaphoreChannel::is_notified` and `HardwareSemaphoreChannel::clear_notification`, which check and clear the notification flag without consuming it.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0f0e5b86` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T01:32:33.957Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795311153957",
    "title": "stm32/hsem: fix interrupt handler livelock; stm32/atomic: fix MMIO RMW",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "embassy-rs-embassy-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f9db71cafcb3a739c95b908b17c74bf650ed258cf217e152c42f796709331d95"
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
        "Harvested/verified timestamp recorded: 2026-11-22T01:32:33.958Z"
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
  "auth_token": "c598a89bb969df3ecaf01a36465778fe26877cefc6fc2009f4ec943822891d02"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-JMZH] Physical Memory Access & DMA Safe Boundary Assertion

<!-- PROVENANCE_START
{
  "source_repository": "embassy-rs-embassy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T07:59:59.183Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-embassy-rs-embassy-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [embassy-rs-embassy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T07:59:59.183Z`  
> **Learning ID**: `LEARN-EVO-embassy-rs-embassy-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Before passing an arbitrary slice pointer to a Direct Memory Access (DMA) engine or cryptographic hardware accelerator, the runtime MUST assert that the memory slice resides entirely within the peripheral's accessible physical RAM address space. When memory resides in Flash, ROM, or unmapped regions, the system MUST route the transfer through a fixed-capacity, RAM-allocated bounce buffer.

**WHY**:
Hardware DMA engines (e.g., Nordic EasyDMA, STM32 DMA) cannot access all microcontroller memory segments (such as internal Flash memory or memory-mapped I/O peripherals) using standard bus transactions. Supplying a Flash pointer (`0x0000_0000..0x1FFF_FFFF` on ARM Cortex-M) to an EasyDMA register will result in an immediate HardFault, bus error, or silent transfer corruption (reading back zeroes or corrupted bits).

**WHEN TO APPLY**:
Embedded DMA engines, cryptographic hardware blocks (PKA, AES, SHA), network interfaces, and foreign function interfaces passing user memory to bus-master hardware peripherals.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
const SRAM_LOWER: usize = 0x2000_0000;
const SRAM_UPPER: usize = 0x3000_0000;
const BOUNCE_LEN: usize = 256;

#[inline(always)]
pub(crate) fn slice_in_ram<T>(slice: *const [T]) -> bool {
    if slice.is_empty() {
        return true;
    }
    let ptr = slice as *const T as usize;
    // Strict non-wrapping boundary comparison
    ptr >= SRAM_LOWER && (ptr.saturating_add(slice.len() * core::mem::size_of::<T>())) <= SRAM_UPPER
}

pub(crate) fn for_each_ram_chunk(data: &[u8], max: usize, mut f: impl FnMut(&[u8])) {
    if slice_in_ram(data) {
        for chunk in data.chunks(max) {
            f(chunk);
        }
    } else {
        // Safe staging: Stack memory is guaranteed to be in SRAM
        let mut buf = [0u8; BOUNCE_LEN];
        for chunk in data.chunks(max.min(BOUNCE_LEN)) {
            buf[..chunk.len()].copy_from_slice(chunk);
            f(&buf[..chunk.len()]);
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Directly programming peripheral DMA pointers from arbitrary slices.
// Compiles cleanly, but HardFaults if `data` is static &'static [u8] stored in flash!
pub unsafe fn start_dma_transfer(channel: &mut DmaChannel, data: &[u8]) {
    channel.ptr_reg.write(data.as_ptr() as u32);
    channel.len_reg.write(data.len() as u32);
    channel.enable();

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T07:59:59.261Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794902399261",
    "title": "Physical Memory Access & DMA Safe Boundary Assertion",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "embassy-rs-embassy-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "779de29f106f9584c3b6a123eb85aea98dd57ec7239bd10b730aa692c494a8c8"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T07:59:59.261Z"
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
  "auth_token": "d6f0b538fe1b65dcc2633178bd901853a961130ffc96ac381107d19dbb3c10c6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

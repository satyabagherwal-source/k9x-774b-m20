# Candidate Directive: [CD-JK99] Physical Memory Access & DMA Safe Boundary Assertion

<!-- PROVENANCE_START
{
  "source_repository": "embassy-rs/embassy",
  "source_url": "https://github.com/embassy-rs/embassy",
  "source_version": "03edb03b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T07:59:55.725Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-embassy-rs-embassy",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [embassy-rs/embassy](https://github.com/embassy-rs/embassy) (Revision: `03edb03b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T07:59:55.725Z`  
> **Learning ID**: `learn-github-embassy-rs-embassy`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
}
```

**VERIFICATION METHOD**:
Property test verifying that flash references trigger bounce buffers:
```rust
#[test]
fn verify_dma_slice_validation() {
    static FLASH_DATA: [u8; 32] = [0xAA; 32];
    assert!(!slice_in_ram(&FLASH_DATA[..]));
    
    let mut ram_data = [0u8; 32];
    assert!(slice_in_ram(&ram_data[..]));
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T07:59:55.725Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794902395725",
    "title": "Physical Memory Access & DMA Safe Boundary Assertion",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "embassy-rs/embassy",
    "source_uri": "https://github.com/embassy-rs/embassy",
    "source_version": "HEAD",
    "content_hash": "95586f6c27bf95d784eb3b419f4bc885feed200c69ca2c0b4c9d55193b73cede"
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
        "Harvested/verified timestamp recorded: 2026-11-17T07:59:55.725Z"
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
  "auth_token": "32b58ec45b4ab3b849122aeb178cb1c13e7d2b8004574afe24f68137ce410e36"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

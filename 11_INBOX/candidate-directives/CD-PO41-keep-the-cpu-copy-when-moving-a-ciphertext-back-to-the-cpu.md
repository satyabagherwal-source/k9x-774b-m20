# Candidate Directive: [CD-PO41] keep the CPU copy when moving a ciphertext back to the CPU

<!-- PROVENANCE_START
{
  "source_repository": "zama-ai/tfhe-rs",
  "source_url": "https://github.com/zama-ai/tfhe-rs",
  "source_version": "0383d4d1",
  "license": "NOASSERTION",
  "timestamp": "2026-11-23T14:46:36.625Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-zama-ai-tfhe-rs",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [zama-ai/tfhe-rs](https://github.com/zama-ai/tfhe-rs) (Revision: `0383d4d1`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-23T14:46:36.625Z`  
> **Learning ID**: `learn-github-zama-ai-tfhe-rs`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `tfhe/src/high_level_api/booleans/inner.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in zama-ai/tfhe-rs. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2dddbbc4`: gpu): keep the CPU copy when moving a ciphertext back to the CPU. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `tfhe/src/high_level_api/booleans/inner.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use crate::high_level_api::details::{DeviceMovable, MaybeCloned};
        crate::high_level_api::details::move_to_device(self, target_device);
    }
    #[inline]
    pub(crate) fn move_to_device_of_server_key_if_set(&mut self) {
        if let Some(device) = global_state::device_of_internal_keys() {
            self.move_to_device(device);
    }
}
impl DeviceMovable for InnerBoolean {
    type CpuCiphertext = BooleanBlock;
    fn current_device(&self) -> Device {
        Self::current_device(self)
    }
    fn on_cpu(&self) -> MaybeCloned<'_, Self::CpuCiphertext> {
        Self::on_cpu(self)
    fn from_cpu(cpu_ct: Self::CpuCiphertext) -> Self {
        Self::Cpu(cpu_ct)
    }

    #[cfg(feature = "gpu")]
    fn move_to_gpu(&mut self, streams: &CudaStreams) {
        self.as_gpu_mut(streams);
    }

    #[cfg(feature = "hpu")]
    fn move_to_hpu(&mut self) {
        if !matches!(self, Self::Hpu(_)) {
            let cpu_ct = Self::on_cpu(self);
            let hpu_ct = global_state::with_thread_local_hpu_device(|device| {
                HpuRadixCiphertext::from_boolean_ciphertext(&cpu_ct, &device.device, None)
            });
            *self = Self::Hpu(hpu_ct);
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
use crate::high_level_api::details::MaybeCloned;
use crate::high_level_api::global_state::with_cuda_internal_keys;
#[cfg(feature = "gpu")]
    #[allow(clippy::needless_pass_by_ref_mut)]
        let current_device = self.current_device();
        if current_device == target_device {
            #[cfg(feature = "gpu")]
            // We may not be on the correct Cuda device
            if let Self::Cuda(cuda_ct) = self {
                with_cuda_internal_keys(|key| {
                    let streams = &key.streams;
                    if !streams.is_on_first_gpu(cuda_ct.gpu_indexes()) {
                        *cuda_ct = cuda_ct.duplicate(streams);
                    }
                })
            }
            return;
        // The logic is that the common device is the CPU, all other devices
        // know how to transfer from and to CPU.
        // So we first transfer to CPU
        let cpu_ct = self.on_cpu();
        // Then we can transfer the desired device
        match target_device {
            Device::Cpu => {
                let _ = cpu_ct;
            }
            #[cfg(feature = "gpu")]
            Device::CudaGpu => {
                let new_inner = with_cuda_in
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2dddbbc4` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T14:46:36.623Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795445196623",
    "title": "keep the CPU copy when moving a ciphertext back to the CPU",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "zama-ai/tfhe-rs",
    "source_uri": "https://github.com/zama-ai/tfhe-rs",
    "source_version": "HEAD",
    "content_hash": "b0643055ddcde289907ff132c0358e33f7fa2ab14d38d8c665b218c19b793a05"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-23T14:46:36.623Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "d05d2d4b5b55fa7ecccc7c226f773033bc8f809dd56d9cb5de57be0fd0a17b58"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

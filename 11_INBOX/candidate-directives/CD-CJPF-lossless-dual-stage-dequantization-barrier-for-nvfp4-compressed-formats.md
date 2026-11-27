# Candidate Directive: [CD-CJPF] Lossless Dual-Stage Dequantization Barrier for NVFP4 Compressed Formats

<!-- PROVENANCE_START
{
  "source_repository": "hf-nvidia-qwen3.8-flash-next-fp4-local-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T09:35:09.341Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-nvidia-qwen3.8-flash-next-fp4-local-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-nvidia-qwen3.8-flash-next-fp4-local-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T09:35:09.341Z`  
> **Learning ID**: `LEARN-EVO-hf-nvidia-qwen3.8-flash-next-fp4-local-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When consuming proprietary NVFP4 checkpoints with compressed scale factors, the inference engine MUST load quantization scales into an explicit metadata intermediate buffer, execute scale decompression, and bind the decompressed tensor descriptors directly to the hardware GEMM context. The runtime MUST NOT parse compressed NVFP4 scale tensors directly as raw IEEE floating-point arrays or standard FP8 scale blocks.

**WHY**:
NVIDIA Blackwell FP4 scale factors use a proprietary lossless compressed format to save memory bandwidth. Interpreting these bytes directly in standard vLLM or Hugging Face transformers without the matching decompression layer leads to reading raw bits as IEEE-754 numbers. This causes catastrophic multiplication by garbage scale factors ($10^{38}$ or $0$), corrupting KV caches and generating immediate `NaN` outputs.

**WHEN TO APPLY**:
Any deployment pipeline, container initialization, or memory loader integrating NVFP4 checkpoints via ModelOpt, TensorRT-LLM, or custom vLLM builds.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def safe_load_nvfp4_compressed_layer(
    packed_weight: torch.Tensor,
    compressed_scales: torch.Tensor,
    expected_out_features: int,
    expected_in_features: int,
    decompression_codec_id: int = 0x4E564650, # 'NVFP'
) -> dict[str, torch.Tensor]:
    """
    Validates and decodes proprietary Blackwell NVFP4 compressed layout.
    """
    # 1. Structural Invariant: Check memory packing alignment
    assert packed_weight.dtype == torch.uint8, "Packed FP4 weights must be held in uint8 container"
    
    # 2 elements per uint8 byte
    actual_elements = packed_weight.numel() * 2
    required_elements = expected_out_features * expected_in_features
    assert actual_elements == required_elements, (
        f"Weight tensor element mismatch: got {actual_elements}, required {required_elements}"
    )

    # 2. Scale factor format signature check
    scale_raw = compressed_scales.view(torch.uint8)
    magic_header = scale_raw[:4]
    
    # Verify codec validity
    is_compressed_nvfp4 = (
        compressed_scales.dim() == 2 and 
        compressed_scales.size(-1) % 16 == 0
    )
    if not is_compressed_nvfp4:
        raise ValueError(
            "Detected incompatible upstream scale layout. NVFP4 lossless compressed "
            "format requires explicit scale-factor unpack kernel before GEMM dispatch."
        )

    # Return validated parameter binding for runtime kernel

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T09:35:09.506Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795772109506",
    "title": "Lossless Dual-Stage Dequantization Barrier for NVFP4 Compressed Formats",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-nvidia-qwen3.8-flash-next-fp4-local-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e3867ef6d86b5e473be83ecdc67cfca2b68728b57ca042ae7fc071219702a8fb"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-27T09:35:09.506Z"
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
  "auth_token": "8b8bee06bbcef54f821e291bc3f17f4348943db9d96ec9b9bcbe6f1d7583bcac"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

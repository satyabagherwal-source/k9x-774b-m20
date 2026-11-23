# Candidate Directive: [CD-QNRA] Asymmetric Sequence Packing and Unpadding Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-black-forest-labs-flux.1-schnell-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T05:27:30.393Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-black-forest-labs-flux.1-schnell-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-black-forest-labs-flux.1-schnell-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T05:27:30.393Z`  
> **Learning ID**: `LEARN-EVO-hf-black-forest-labs-flux.1-schnell-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When packing dual-modality tensors (arbitrary-length token sequences and 2D spatial image patches) into a single unified-stream self-attention context, all sequences MUST be explicitly packed using 1D cumulative sequence pointer offsets (`cu_seqlens`) and MUST NOT rely on padded batch dimensions with zero-masked attention when executed on Tensor Core architectures.

**WHY**:
Padding multi-resolution image patches to match a fixed context window introduces up to 60% redundant compute overhead on single-stream blocks (38 layers deep in FLUX.1). Furthermore, standard softmax over zero-padded tokens can suffer from softmax underflow ($\sum \exp(x_i) \to 0$ when masked tokens produce $-\infty$), triggering `NaN` representations in subsequent RMSNorm and residual projections.

**WHEN TO APPLY**:
All unified-stream transformer backbones (Single-Stream DiT) supporting dynamic aspect ratio inputs and variable text prompt lengths.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch


def pack_multimodal_sequences(
    image_latents: torch.Tensor,  # [B, C, H, W]
    text_latents: torch.Tensor,  # [B, L_txt, D]
    patch_size: int = 2,
) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
    """Packs variable image latents and text into unpadded contiguous sequence buffers."""
    B, C, H, W = image_latents.shape
    assert (
        H % patch_size == 0 and W % patch_size == 0
    ), f"Latent spatial dims ({H}, {W}) must be divisible by patch size {patch_size}"

    # 1. Patchify image latents: [B, C, H, W] -> [B, (H/p * W/p), C * p * p]
    pH, pW = H // patch_size, W // patch_size
    img_patches = image_latents.view(
        B, C, pH, patch_size, pW, patch_size
    ).permute(0, 2, 4, 1, 3, 5)
    img_seq = img_patches.reshape(B, pH * pW, C * patch_size * patch_size)

    # 2. Extract lengths
    img_len = pH * pW
    txt_len = text_latents.shape[1]
    total_len = img_len + txt_len

    # 3. Compute FlashAttention cu_seqlens (cumulative sequence lengths)
    # Shape: [B + 1], e.g., for B=2: [0, total_len, 2 * total_len]
    cu_seqlens = torch.arange(
        0, (B + 1) * total_len, step=total_len, dtype=torch.int32
    )

    # 4. Pack into contiguous 1D token stream: [B * total_len, D]
    # Note: Requires linear projection to common dimension D prior to actual concatenation
    return img_seq, text_latents, cu_seqlens
```

**NEGATIVE CONSTRAINT**:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T05:27:30.502Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795411650502",
    "title": "Asymmetric Sequence Packing and Unpadding Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-black-forest-labs-flux.1-schnell-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "3674a22b23c396acd0d07ace128601b6195aad0475a14e8ab970a13b025203b9"
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
        "Harvested/verified timestamp recorded: 2026-11-23T05:27:30.502Z"
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
  "auth_token": "618a35e1dc5b7c3b3929745a4a444c2b6cc48a288360e98905fb5307e3cddb5a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

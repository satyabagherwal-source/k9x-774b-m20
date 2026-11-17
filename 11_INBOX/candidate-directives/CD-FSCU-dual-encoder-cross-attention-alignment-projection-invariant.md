# Candidate Directive: [CD-FSCU] Dual-Encoder Cross-Attention Alignment & Projection Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-stabilityai-stable-diffusion-xl-base-1.0-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T23:20:46.799Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-stabilityai-stable-diffusion-xl-base-1.0-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-stabilityai-stable-diffusion-xl-base-1.0-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T23:20:46.799Z`  
> **Learning ID**: `LEARN-EVO-hf-stabilityai-stable-diffusion-xl-base-1.0-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
In multi-encoder diffusion architectures, token sequences extracted from disparate encoders MUST NOT be concatenated along the sequence length axis if sequence positions are heterogeneous. They MUST be aligned to identical sequence lengths (e.g., $L=77$) via deterministic padding or truncation, concatenated along the embedding feature dimension ($D_{total} = D_1 + D_2$), and verified with strict rank and dimension assertion barriers prior to linear projection into UNet cross-attention blocks.

**WHY**:
`OpenCLIP-ViT/G` outputs an embedding dimension of $1280$, while `CLIP-ViT/L` outputs $768$. Concatenating sequence lengths ($77 + 77 = 154$) instead of hidden feature channels ($768 + 1280 = 2048$) breaks positional index mapping in cross-attention heads, dilutes self-attention context density by $2\times$, causes out-of-memory (OOM) allocation failures in scaled dot-product attention kernels, and alters intermediate matrix multiplications silently if dimensions align coincidentally.

**WHEN TO APPLY**:
Any text-to-image or multimodal architecture fusing multiple visual/language transformers (e.g., SDXL base, SDXL refiner, SD3, Imagen, PixArt-$\Sigma$).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
from typing import Tuple

class HeterogeneousTextEncoderFuser:
    """Fuses CLIP-ViT/L (768) and OpenCLIP-ViT/G (1280) text representations."""
    EXPECTED_SEQ_LEN = 77
    CLIP_L_DIM = 768
    OPENCLIP_G_DIM = 1280
    TOTAL_PROJECTION_DIM = 2048

    def __init__(self, clip_l_model, openclip_g_model):
        self.clip_l = clip_l_model
        self.openclip_g = openclip_g_model

    def extract_and_fuse(
        self, input_ids_1: torch.Tensor, input_ids_2: torch.Tensor
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        # Shape verification: Batch x 77 tokens
        assert input_ids_1.shape[-1] == self.EXPECTED_SEQ_LEN, (
            f"CLIP-L token sequence length must be {self.EXPECTED_SEQ_LEN}, got {input_ids_1.shape[-1]}"
        )
        assert input_ids_2.shape[-1] == self.EXPECTED_SEQ_LEN, (
            f"OpenCLIP-G token sequence length must be {self.EXPECTED_SEQ_LEN}, got {input_ids_2.shape[-1]}"
        )

        # Encoder 1 Pass: CLIP-ViT/L (Extract penultimate hidden layer: index -2)
        out_1 = self.clip_l(input_ids_1, output_hidden_states=True)
        prompt_embeds_1 = out_1.hidden_states[-2]  # [Batch, 77, 768]

        # Encoder 2 Pass: OpenCLIP-ViT/G (Extract penultimate hidden layer and pooled projection)
        out_2 = self.openclip_g(input_ids_2, output_hidden_states=True)
        prompt_embeds_2 = out_2.hidden_states[-2]  # [Batch, 77, 1280]
        pooled_prompt_embeds = out_2.text_embeds   # [Batch, 1280]

        # Invariant Assertions
        assert prompt_embeds_1.shape[-1] == self.CLIP_L_DIM, "CLIP-L dim mismatch"
        assert prompt_embeds_2.shape[-1] == self.OPENCLIP_G_DIM, "OpenCLIP-G dim mismatch"

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T23:20:46.925Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794957646925",
    "title": "Dual-Encoder Cross-Attention Alignment & Projection Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-stabilityai-stable-diffusion-xl-base-1.0-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f67b9f11cd7045beda3a62193c4512f38d793a87999e6e8c43f8c31e9da750fa"
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
        "Harvested/verified timestamp recorded: 2026-11-17T23:20:46.925Z"
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
  "auth_token": "7f2a63ca3d8432ce3d24c6d755a6c0f92b93d678b08db9f6049f1c99b113c14a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

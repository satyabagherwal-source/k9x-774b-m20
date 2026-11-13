# Candidate Directive: [CD-FCD5] Batched Classifier-Free Guidance (CFG) Forward-Pass Coherence

<!-- PROVENANCE_START
{
  "source_repository": "hf-compvis-stable-diffusion-v1-4-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T22:45:45.619Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-compvis-stable-diffusion-v1-4-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-compvis-stable-diffusion-v1-4-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T22:45:45.619Z`  
> **Learning ID**: `LEARN-EVO-hf-compvis-stable-diffusion-v1-4-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing Classifier-Free Guidance (CFG) on dual prompt passes (unconditional/negative and conditional/positive), the system **MUST** concatenate the representations along the batch dimension prior to the score network forward pass and execute a single parallel evaluation. The system **MUST NOT** sequentially execute two separate forward passes without dynamic graph caching, and **MUST** decouple guidance aggregation from inplace tensor mutation.

**WHY**:
Sequential execution of the UNet denoiser doubles CUDA kernel launch overhead, stalls streaming multi-processors due to lack of wave quantization, and introduces inter-pass execution divergence under half-precision non-deterministic reductions. Single-pass batching guarantees mathematical synchronization of timestep embedding layers and attention operations across unconditional and conditional streams while maximizing hardware occupancy.

**WHEN TO APPLY**:
All sampling pipelines implementing Ho & Salimans Classifier-Free Guidance ($s \cdot \epsilon_\theta(z_t, c) + (1 - s) \cdot \epsilon_\theta(z_t, \emptyset)$).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def execute_cfg_denoising_step(
    unet: torch.nn.Module,
    latents: torch.Tensor,
    t: torch.Tensor,
    prompt_embeds: torch.Tensor,     # Concatenated: [uncond_embeds, cond_embeds] -> [2*B, 77, 768]
    guidance_scale: float,
) -> torch.Tensor:
    """
    Executes batched CFG step ensuring hardware-level concurrency and memory safety.
    """
    # 1. Structural check: Batch dimension of embeddings must be exactly 2x latents
    batch_size = latents.shape[0]
    if prompt_embeds.shape[0] != 2 * batch_size:
        raise ValueError(
            f"Embedding batch size {prompt_embeds.shape[0]} must be 2x latent batch size {batch_size}"
        )

    # 2. Replicate latents along batch axis: [B, C, H, W] -> [2*B, C, H, W]
    # Invariant: contiguous memory layout to prevent non-coalesced memory reads in CUDA
    latent_model_input = torch.cat([latents, latents], dim=0).contiguous()

    # 3. Predict noise residuals in a single unified execution
    noise_pred = unet(
        latent_model_input,
        t,
        encoder_hidden_states=prompt_embeds
    ).sample

    # 4. Split noise predictions cleanly without in-place slices
    noise_pred_uncond, noise_pred_text = noise_pred.chunk(2, dim=0)

    # 5. Compute extrapolated guidance vector out-of-place
    # Formula: uncond + guidance_scale * (text - uncond)
    guided_noise_pred = noise_pred_uncond + guidance_scale * (noise_pred_text - noise_pred_uncond)
    
    return guided_noise_pred

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T22:45:45.689Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794609945689",
    "title": "Batched Classifier-Free Guidance (CFG) Forward-Pass Coherence",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-compvis-stable-diffusion-v1-4-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "f5e0a28d870c9fde0dc62a1c3b324e36fc489fd936bf6ed2c7574718461d5628"
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
        "Harvested/verified timestamp recorded: 2026-11-13T22:45:45.689Z"
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
  "auth_token": "bd8619fbae52bc3aed0bdaabd2a71518f0ebeccc7295b214244ca357dc030ce0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

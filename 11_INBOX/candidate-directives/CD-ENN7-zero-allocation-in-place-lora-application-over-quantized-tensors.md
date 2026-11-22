# Candidate Directive: [CD-ENN7] Zero-Allocation In-Place LoRA Application Over Quantized Tensors

<!-- PROVENANCE_START
{
  "source_repository": "hf-prunaai-p-h3-image-comfy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T02:42:32.279Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-prunaai-p-h3-image-comfy-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-prunaai-p-h3-image-comfy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T02:42:32.279Z`  
> **Learning ID**: `LEARN-EVO-hf-prunaai-p-h3-image-comfy-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When injecting low-rank adapter (LoRA) weights into quantized diffusion models (INT8/4-bit) during runtime model patching, developers MUST NEVER materialize a full-precision dense weight tensor in VRAM. Linear adapters MUST be evaluated via additive activation branching: $Y = \text{QuantLinear}(X, W_{\text{quant}}, S) + \gamma \cdot (X A) B$.

**WHY**:
Dequantizing a 4-bit or INT8 model weight tensor of size $[D_{\text{out}}, D_{\text{in}}]$ back to FP16 to perform $W_{\text{eff}} = W + \Delta W$ allocates $2 \times D_{\text{out}} \times D_{\text{in}}$ bytes per layer. Across a 12-billion parameter model, this induces instantaneous VRAM spikes of 24GB+, triggering an out-of-memory (OOM) fatal abort during graph evaluation.

**WHEN TO APPLY**:
Apply in any ComfyUI custom node, PyTorch inference engine, or diffusion pipeline loading LoRA, DoRA, or dynamic model patches onto quantized (`int8`, `4-bit`, `fp8`) model parameters.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
from typing import Optional

class QuantizedLoRALinear(nn.Module):
    """
    Executes quantized linear projection with parallel low-rank branch
    to eliminate dense weight materialization in VRAM.
    """
    def __init__(
        self,
        in_features: int,
        out_features: int,
        quant_weight: torch.Tensor,       # e.g., int8 or packed uint8/int32
        scales: torch.Tensor,             # per-channel or per-block scale
        zero_points: Optional[torch.Tensor],
        lora_rank: int = 16,
        lora_alpha: float = 32.0,
        device: torch.device = torch.device("cuda")
    ) -> None:
        super().__init__()
        self.in_features = in_features
        self.out_features = out_features
        
        # Quantized base weight invariant: registered as non-trainable buffers
        self.register_buffer("quant_weight", quant_weight.to(device))
        self.register_buffer("scales", scales.to(device))
        if zero_points is not None:
            self.register_buffer("zero_points", zero_points.to(device))
        else:
            self.zero_points = None

        # Low-rank matrices: stored in target operational precision (FP16/BF16)
        self.scaling = lora_alpha / lora_rank
        self.lora_A = nn.Parameter(torch.empty((lora_rank, in_features), device=device, dtype=torch.bfloat16))
        self.lora_B = nn.Parameter(torch.empty((out_features, lora_rank), device=device, dtype=torch.bfloat16))
        
        nn.init.kaiming_uniform_(self.lora_A, a=5**0.5)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T02:42:32.368Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795315352368",
    "title": "Zero-Allocation In-Place LoRA Application Over Quantized Tensors",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-prunaai-p-h3-image-comfy-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "7725fa1d5af1685c8729bfd03f58a16a763e6f906890b93e9362ab865fbd4835"
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
        "Harvested/verified timestamp recorded: 2026-11-22T02:42:32.369Z"
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
  "auth_token": "8352d909daf2069c689c711fb2c90d5be17bd23b17852cfda97f005481f87dde"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

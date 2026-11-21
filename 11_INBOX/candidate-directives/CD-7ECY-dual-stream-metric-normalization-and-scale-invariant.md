# Candidate Directive: [CD-7ECY] Dual-Stream Metric Normalization and Scale Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-openai-clip-vit-large-patch14-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T08:25:08.608Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-openai-clip-vit-large-patch14-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-openai-clip-vit-large-patch14-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T08:25:08.608Z`  
> **Learning ID**: `LEARN-EVO-hf-openai-clip-vit-large-patch14-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Systems computing cross-attention or dot-product similarity between independent vector spaces MUST apply explicit $L_2$ normalization on final representations immediately prior to the dot product, and MUST clamp learned scaling factors ($\exp(\tau)$) to a maximum bound of 100.0 ($s \le 4.6052$) before computing cross-entropy or softmax logits.

**WHY**:
Without explicit $L_2$ normalization, dot-product magnitudes scale with embedding dimension $D$, driving softmax distributions toward one-hot distributions, saturating the gradient space to zero. In half-precision floating-point regimes (IEEE 754 FP16), an unbounded logit scale exponentiated ($\exp(s)$) causes arithmetic overflow at $s > 11.09$ ($\exp(11.09) \approx 65,512$, approaching the FP16 maximum of $65,504$), yielding immediate `NaN` propagation across backward passes.

**WHEN TO APPLY**:
Multimodal encoders, contrastive learning architectures (CLIP, InfoNCE, SimCLR), vector search re-rankers, and metric retrieval heads operating in FP16, BF16, or quantized INT8 runtimes.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class MetricNormalizedSimilarity(nn.Module):
    def __init__(self, embed_dim: int, logit_scale_init: float = 2.6592, max_scale: float = 4.6052):
        super().__init__()
        self.max_scale = max_scale
        # logit_scale stored as log-parameter to guarantee scale > 0
        self.logit_scale = nn.Parameter(torch.tensor(logit_scale_init, dtype=torch.float32))

    def forward(self, text_embeds: torch.Tensor, image_embeds: torch.Tensor) -> torch.Tensor:
        # Pre-condition validation: Shape and rank invariant assertions
        assert text_embeds.ndim == 2 and image_embeds.ndim == 2, \
            f"Expected rank-2 tensors, got text: {text_embeds.shape}, image: {image_embeds.shape}"
        assert text_embeds.size(-1) == image_embeds.size(-1), \
            f"Embedding dim mismatch: text {text_embeds.size(-1)} != image {image_embeds.size(-1)}"

        # Micro-mechanical safe L2 normalization: eps=1e-12 prevents division by zero
        text_normalized = text_embeds / (text_embeds.norm(p=2, dim=-1, keepdim=True) + 1e-12)
        image_normalized = image_embeds / (image_embeds.norm(p=2, dim=-1, keepdim=True) + 1e-12)

        # Invariant: Clamp scale parameter in float32 to prevent FP16 overflow
        with torch.no_grad():
            self.logit_scale.clamp_(max=self.max_scale)

        logit_scale = self.logit_scale.exp()
        logits = torch.matmul(text_normalized, image_normalized.t()) * logit_scale
        return logits
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Direct dot product without normalization and unbounded scale
class UnsafeSimilarity(nn.Module):
    def __init__(self):
        super().__init__()
        self.scale = nn.Parameter(torch.tensor(15.0)) # Raw unbounded scale

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T08:25:08.718Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795249508718",
    "title": "Dual-Stream Metric Normalization and Scale Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openai-clip-vit-large-patch14-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8fd640570c36a37f6a4bc6fa2db4dc4fe33f11c66e2dd4471301775b74661aae"
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
        "Harvested/verified timestamp recorded: 2026-11-21T08:25:08.719Z"
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
  "auth_token": "4819b53817026280fbbd94154d4226784d93d1330020a8affc9a2635bb8156cd"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

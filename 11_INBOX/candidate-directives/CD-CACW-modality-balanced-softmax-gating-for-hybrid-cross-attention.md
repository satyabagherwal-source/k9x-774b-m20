# Candidate Directive: [CD-CACW] Modality-Balanced Softmax Gating for Hybrid Cross-Attention

<!-- PROVENANCE_START
{
  "source_repository": "hf-autotrust-jev-27b-vl-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-19T06:33:37.829Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-autotrust-jev-27b-vl-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-autotrust-jev-27b-vl-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-19T06:33:37.829Z`  
> **Learning ID**: `LEARN-EVO-hf-autotrust-jev-27b-vl-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When cross-attention layers process fused text and dense vision-token projections, attention projections MUST incorporate a learned sigmoid output gate ($\mathbf{O} = \mathbf{W}_o(\mathbf{A}\mathbf{V}) \odot \sigma(\mathbf{W}_g \mathbf{X})$). Any inference optimization or kernel replacement MUST preserve the gating path and prevent bypasses during flash-attention dispatch.

**WHY**:
Vision token representations from high-resolution patches (up to 16 images in embodied benchmarks like ERQA) exhibit an $L_2$ norm distribution radically different from linguistic tokens. Without multiplicative gating, self-attention and cross-attention maps in deep layers (layers 32–64) suffer from query saturation, where linguistic reasoning heads are swamped by spatial background tokens, degrading ERQA spatial reasoning scores by over 8 percentage points.

**WHEN TO APPLY**:
Whenever writing custom FlashAttention, Triton, or CUDA kernels for models with `attn_output_gate: true`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class GatedAttentionOutput(nn.Module):
    def __init__(self, hidden_size: int, num_heads: int, head_dim: int):
        super().__init__()
        self.proj_dim = num_heads * head_dim
        self.out_proj = nn.Linear(self.proj_dim, hidden_size, bias=False)
        self.gate_proj = nn.Linear(hidden_size, hidden_size, bias=False)

    def forward(self, attn_context: torch.Tensor, original_x: torch.Tensor) -> torch.Tensor:
        """
        attn_context: (Batch, SeqLen, NumHeads * HeadDim)
        original_x:   (Batch, SeqLen, HiddenSize)
        """
        # Linear projection of attention context
        projected_context = self.out_proj(attn_context)
        # Explicit output gate computed from residual stream input
        gate = torch.sigmoid(self.gate_proj(original_x))
        # Pointwise gating invariant
        return projected_context * gate
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Bypassing the gate to utilize a standard vanilla Attention linear output kernel.
class BadAttentionOutput(nn.Module):
    def forward(self, attn_context, original_x):
        return self.out_proj(attn_context) # CRITICAL DEFECT: Gate dropped, corrupting vision-language balance.
```

**VERIFICATION METHOD**:
Unit test comparing gated vs non-gated gradient flow on vision token IDs:
```python
def test_gating_sensitivity():
    layer = GatedAttentionOutput(hidden_size=5120, num_heads=20, head_dim=256)
    x = torch.randn(1, 10, 5120, requires_grad=True)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T06:33:37.903Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795070017903",
    "title": "Modality-Balanced Softmax Gating for Hybrid Cross-Attention",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-autotrust-jev-27b-vl-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "84171e04de8906cce65d5b7b5cd6df9dcdb2805930140c40bfd6f871d88984db"
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
        "Harvested/verified timestamp recorded: 2026-11-19T06:33:37.903Z"
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
  "auth_token": "7615813f40195b39563ceb8eabc7cb71678b19625b743105d2128268110bb6d9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

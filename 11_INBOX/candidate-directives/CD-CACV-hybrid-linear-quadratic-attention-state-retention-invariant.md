# Candidate Directive: [CD-CACV] Hybrid Linear-Quadratic Attention State Retention Invariant

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
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When serving or fine-tuning hybrid attention architectures (e.g., alternating Linear State-Space/RNN-like layers with standard Dense Multi-Head Attention), serving engines and inference harnesses MUST maintain separate, layer-indexed recurrent state caches for linear convolution buffers alongside traditional KV caches for full-attention layers. Systems MUST NOT collapse or assume uniform KV-cache geometry across all $L$ layers.

**WHY**:
Linear attention layers maintain fixed-size recurrent states $\mathbf{S}_t \in \mathbb{R}^{d_{key} \times d_{val}}$ and 1D causal convolution states of shape $(B, d_{in}, K-1)$ where $K=\text{kernel\_dim}$. Full-attention layers maintain monotonically growing dynamic key-value tensors $(B, H, S, D_{head})$. Collapsing or flattening these into a naive homogeneous tensor allocations causes fatal memory alignment faults, buffer trashing, or context corruption where full-attention keys overwrite the rolling linear convolution buffers.

**WHEN TO APPLY**:
Apply to any inference runtime, custom forward pass, or vLLM custom worker executing models with `layer_types` consisting of heterogeneous attention specifications (e.g., `linear_attention` interspersed with `full_attention`).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
from typing import Dict, List, Optional, Tuple

class HybridAttentionStateCache:
    """
    Maintains separate recurrent state buffers for linear attention layers
    and standard paged/contiguous KV caches for full attention layers.
    """
    def __init__(
        self,
        batch_size: int,
        layer_types: List[str],
        conv_kernel_size: int,
        hidden_size: int,
        num_kv_heads: int,
        head_dim: int,
        device: torch.device,
        dtype: torch.dtype = torch.bfloat16
    ) -> None:
        self.layer_types = layer_types
        self.conv_buffers: Dict[int, torch.Tensor] = {}
        self.recurrent_states: Dict[int, torch.Tensor] = {}
        self.kv_caches: Dict[int, Tuple[torch.Tensor, torch.Tensor]] = {}

        for layer_idx, ltype in enumerate(layer_types):
            if ltype == "linear_attention":
                # Recurrent convolution history buffer: (Batch, Hidden, Kernel - 1)
                self.conv_buffers[layer_idx] = torch.zeros(
                    (batch_size, hidden_size, conv_kernel_size - 1),
                    device=device,
                    dtype=dtype
                )
                # Recurrent linear attention hidden state: (Batch, NumHeads, HeadDim_K, HeadDim_V)
                self.recurrent_states[layer_idx] = torch.zeros(
                    (batch_size, num_kv_heads, head_dim, head_dim),
                    device=device,
                    dtype=dtype

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T06:33:37.900Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795070017899",
    "title": "Hybrid Linear-Quadratic Attention State Retention Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-autotrust-jev-27b-vl-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "469d51d16acc005898413f56fc50158fa5911e78d273a1cf5e6ccecc814d6330"
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
        "Harvested/verified timestamp recorded: 2026-11-19T06:33:37.900Z"
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
  "auth_token": "07eb0cd8be31c9cce9903b010caafbc9907ff8dfcf15124fde87ebd0fc067d53"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

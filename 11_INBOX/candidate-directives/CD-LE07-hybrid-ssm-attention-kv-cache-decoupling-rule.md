# Candidate Directive: [CD-LE07] Hybrid SSM-Attention KV-Cache Decoupling Rule

<!-- PROVENANCE_START
{
  "source_repository": "hf-openbmb-minicpm-ocr-1.0-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T19:47:52.145Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-openbmb-minicpm-ocr-1.0-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-openbmb-minicpm-ocr-1.0-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T19:47:52.145Z`  
> **Learning ID**: `LEARN-EVO-hf-openbmb-minicpm-ocr-1.0-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When serving or fine-tuning hybrid architectures containing both linear-attention/SSM layers and standard causal full-attention layers, systems MUST maintain completely isolated cache state allocations: a fixed-size ring-buffer/state-matrix for SSM linear layers ($O(1)$ memory per token) and a dynamically expanding KV-cache buffer for standard attention layers ($O(N)$ memory per token). Systems MUST NOT allocate uniform $O(N)$ KV tensors across all decoder indices.

**WHY**:
Linear attention and SSM recurrent states (e.g., $S_t = A S_{t-1} + B x_t$) require updating a fixed-size hidden state matrix (e.g., shape `[batch, heads, d_k, d_v]`). Standard attention requires retaining every historical $K$ and $V$ projection along sequence length $S$. Allocating standard KV cache buffers for linear layers causes continuous memory allocation churn, breaks zero-copy tensor caching, causes immediate CUDA out-of-memory errors on 262k contexts, and invalidates flash-attention stride assumptions.

**WHEN TO APPLY**:
Any multi-head architecture alternating linear/recurrent layers and causal self-attention (e.g., MiniCPM-OCR, Qwen-3.5-Text, Jamba, Samba, StripedHyena) running in PyTorch, vLLM, SGLang, or C++ runtimes.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
from typing import Dict, List, Optional, Tuple

class HybridHybridLayerCache:
    """Decoupled Cache Container for 3:1 Linear-to-Full Attention Stacks."""
    def __init__(self, layer_types: List[str], batch_size: int, device: torch.device):
        self.layer_types = layer_types
        # Linear SSM layers: Fixed O(1) state matrix + conv state buffer
        self.ssm_states: Dict[int, torch.Tensor] = {}
        self.conv_states: Dict[int, torch.Tensor] = {}
        # Full attention layers: Dynamically growing O(N) KV cache
        self.key_cache: Dict[int, torch.Tensor] = {}
        self.value_cache: Dict[int, torch.Tensor] = {}

    def init_layer_state(
        self, 
        layer_idx: int, 
        batch_size: int, 
        num_heads: int, 
        k_dim: int, 
        v_dim: int, 
        conv_dim: int, 
        conv_kernel: int,
        device: torch.device
    ):
        if self.layer_types[layer_idx] == "linear_attention":
            # SSM recurrence accumulator MUST be fp32 to prevent saturation/vanishing over long sequences
            self.ssm_states[layer_idx] = torch.zeros(
                (batch_size, num_heads, k_dim, v_dim), dtype=torch.float32, device=device
            )
            self.conv_states[layer_idx] = torch.zeros(
                (batch_size, conv_dim, conv_kernel), dtype=torch.bfloat16, device=device
            )
        elif self.layer_types[layer_idx] == "full_attention":
            self.key_cache[layer_idx] = torch.empty((batch_size, 0, num_heads, k_dim), dtype=torch.bfloat16, device=device)
            self.value_cache[layer_idx] = torch.empty((batch_size, 0, num_heads, v_dim), dtype=torch.bfloat16, device=device)
        else:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T19:47:52.228Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795290472228",
    "title": "Hybrid SSM-Attention KV-Cache Decoupling Rule",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openbmb-minicpm-ocr-1.0-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "d079dad7f73e1f7dac86cb3ef104524b92ed4b730a5f98fef3eb75120bb190f8"
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
        "Harvested/verified timestamp recorded: 2026-11-21T19:47:52.228Z"
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
  "auth_token": "3de5851f2eb187ba69f579be074f9a48563dc52230a6259e56e083414f6d62ce"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

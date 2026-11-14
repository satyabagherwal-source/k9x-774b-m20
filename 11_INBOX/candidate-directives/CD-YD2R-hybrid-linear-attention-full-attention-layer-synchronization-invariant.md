# Candidate Directive: [CD-YD2R] Hybrid Linear-Attention / Full-Attention Layer Synchronization Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-openbmb-minicpm-ocr-1.0-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T06:28:26.836Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-openbmb-minicpm-ocr-1.0-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-openbmb-minicpm-ocr-1.0-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T06:28:26.836Z`  
> **Learning ID**: `LEARN-EVO-hf-openbmb-minicpm-ocr-1.0-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When combining recurrence-based linear attention / state-space layers (e.g., Mamba/Linear RNN) with standard transformer softmax self-attention layers in a single autoregressive sequence, the state-space recurrent states MUST be maintained in `float32` precision even if the model forward pass runs in `bfloat16` or `float16`. Furthermore, KV cache lookups MUST index solely into the subset of layers declared as `full_attention`, while linear attention state structures MUST maintain fixed-size recurrent buffers indexed by sequence batch and head dim.

**WHY**:
Linear attention and SSMs accumulate token context recursively via state transition matrices:
$$h_t = \bar{A} h_{t-1} + \bar{B} x_t$$
In `bfloat16` or `float16`, continuous state accumulation over 256k tokens causes rapid catastrophic precision loss, mantissa underflow, and NaN drift. By enforcing `mamba_ssm_dtype: float32`, the recursive accumulation remains numerically stable over ultra-long document contexts without requiring $O(N^2)$ memory for linear layers.

**WHEN TO APPLY**:
Multimodal document parsers, long-context code-generation engines, and hybrid LLM/VLM backbones running sequence lengths $N \ge 8,192$ with mixed attention mechanisms (`linear_attention` + `full_attention`).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
from typing import Dict, List, Optional, Tuple

class HybridAttentionLayerRouter(nn.Module):
    """
    Manages dual-state propagation across alternating linear attention
    and standard GQA full attention layers.
    """
    def __init__(
        self,
        layer_idx: int,
        layer_type: str,
        hidden_size: int,
        ssm_dtype: torch.dtype = torch.float32,
    ):
        super().__init__()
        self.layer_idx = layer_idx
        self.layer_type = layer_type
        self.ssm_dtype = ssm_dtype
        self.hidden_size = hidden_size
        
        if self.layer_type == "linear_attention":
            self.conv_kernel = 4
            self.conv1d = nn.Conv1d(
                in_channels=hidden_size,
                out_channels=hidden_size,
                kernel_size=self.conv_kernel,
                groups=hidden_size,
                padding=self.conv_kernel - 1
            )
        elif self.layer_type == "full_attention":
            self.kv_heads = 2
            self.q_heads = 8
            self.head_dim = 256
        else:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T06:28:26.930Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794637706930",
    "title": "Hybrid Linear-Attention / Full-Attention Layer Synchronization Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openbmb-minicpm-ocr-1.0-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1bf5902b5aeb0558e026c4610f1c1cfcb4d53dc86e5576a9b8c323d95618aa0d"
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
        "Harvested/verified timestamp recorded: 2026-11-14T06:28:26.930Z"
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
  "auth_token": "bd623df4c9f8c95e3880d6ea712cce040d5cea5cee88a8ff95c1f6d8677e908b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

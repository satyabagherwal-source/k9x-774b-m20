# Candidate Directive: [CD-CJPE] Zero-Padding Invariant for Low-Rank MoE Router Top-K Projections

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
When dispatching tokens across ultra-sparse MoE top-K routing layers ($K > 8, E \ge 512$), router gating probabilities MUST be computed in high-precision (`float32` or `bfloat16`), and expert routing mask indices MUST be explicitly bounds-checked and packed using fixed-stride stride-aligned memory allocations. Router capacity overflow tokens MUST NOT be discarded silently; they MUST be routed to an identity fallback or zero-masked residual accumulator.

**WHY**:
In models with extreme routing factors like Qwen3.8-Flash-Next ($E=512$, $K=10$), numerical instability in FP4/FP8 linear projections causes Softmax overflow or NaN propagation. If expert index tensor packing contains unaligned strides or missing token capacity clamps, CUDA kernel threads access out-of-bounds memory or cause branch divergence crashes in Blackwell cutlass GEMM kernels.

**WHEN TO APPLY**:
Apply to any inference runtime, kernel dispatcher, or Triton/CUDA kernel handling MoE gating with more than 64 experts and low-precision activations.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class SafeMoETopKRouter(nn.Module):
    def __init__(
        self,
        hidden_size: int,
        num_experts: int,
        top_k: int,
        expert_capacity_factor: float = 1.25,
    ):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_experts = num_experts
        self.top_k = top_k
        self.capacity_factor = expert_capacity_factor
        self.gate = nn.Linear(hidden_size, num_experts, bias=False, dtype=torch.bfloat16)

    def forward(
        self, hidden_states: torch.Tensor
    ) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        # Enforce batch-token flattening with invariant shape validation
        batch_size, seq_len, h_dim = hidden_states.shape
        assert h_dim == self.hidden_size, f"Hidden dim mismatch: {h_dim} != {self.hidden_size}"
        
        flat_states = hidden_states.view(-1, self.hidden_size)
        total_tokens = flat_states.size(0)

        # Invariant: Router logits MUST be evaluated in float32 to prevent underflow in top-k
        logits = self.gate(flat_states).to(torch.float32)
        
        # Softmax over expert dimension
        scores = F.softmax(logits, dim=-1)
        
        # Stable top-k extraction
        topk_weights, topk_indices = torch.topk(scores, self.top_k, dim=-1, sorted=True)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T09:35:09.504Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795772109504",
    "title": "Zero-Padding Invariant for Low-Rank MoE Router Top-K Projections",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-nvidia-qwen3.8-flash-next-fp4-local-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "2da6cb984a703f95141810031d2d354685f23f28875a0236cbb8dfd956fb90d7"
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
        "Harvested/verified timestamp recorded: 2026-11-27T09:35:09.505Z"
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
  "auth_token": "b2005a4abcb9c5260b31c2845d18d53f7523b50960d42e49e47d8855f9400bec"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

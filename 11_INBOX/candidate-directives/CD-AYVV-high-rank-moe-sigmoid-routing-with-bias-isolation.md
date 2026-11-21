# Candidate Directive: [CD-AYVV] High-Rank MoE Sigmoid Routing with Bias Isolation

<!-- PROVENANCE_START
{
  "source_repository": "hf-tencent-hy-simulmt-30b-a3b-fp8-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T19:11:46.337Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-tencent-hy-simulmt-30b-a3b-fp8-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-tencent-hy-simulmt-30b-a3b-fp8-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T19:11:46.337Z`  
> **Learning ID**: `LEARN-EVO-hf-tencent-hy-simulmt-30b-a3b-fp8-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing high-capacity fine-grained sparse Mixture-of-Experts models ($N_{\text{experts}} \ge 64$), the router MUST use independent affine sigmoid gating with learned expert bias and post-selection L1 renormalization, rather than normalized Softmax over all experts. All router gating weight matrices MUST remain unquantized (FP32/BF16) and MUST NOT be converted to block-quantized FP8.

**WHY**:
Softmax across 128+ expert candidates causes exponential vanishing gradients for tail experts and severe competition skew ("winner-take-all" collapse), forcing complex aux-loss coefficients that impair primary task loss. Furthermore, FP8 quantization of routing projections introduces non-linear truncation near zero-crossings, causing chaotic expert dispatch jitter where neighboring tokens flip allocations unpredictably. Sigmoid routing isolates expert activation probabilities, while FP32 precision preserves router margins.

**WHEN TO APPLY**:
Apply to any Sparse MoE architecture with top-$k$ routing over large expert pools ($E \ge 64, k \ge 4$), particularly in low-latency multi-modal models where dispatch instability degrades downstream causal generation.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class SigmoidMoERouter(nn.Module):
    def __init__(
        self,
        hidden_dim: int,
        num_experts: int,
        top_k: int,
        scaling_factor: float = 2.826,
        route_norm: bool = True
    ):
        super().__init__()
        self.num_experts = num_experts
        self.top_k = top_k
        self.scaling_factor = scaling_factor
        self.route_norm = route_norm

        # Router projections MUST remain FP32 to prevent dispatch jitter
        self.gate = nn.Linear(hidden_dim, num_experts, bias=True, dtype=torch.float32)

    def forward(self, x: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        """
        x: [batch_size * seq_len, hidden_dim] in BF16 or FP8
        Returns:
            routing_weights: [batch_size * seq_len, top_k] in FP32
            selected_experts: [batch_size * seq_len, top_k] in torch.int64
        """
        # Explicit upcast to float32 before affine transformation
        x_fp32 = x.to(torch.float32)
        logits = self.gate(x_fp32)  # [N, num_experts]

        # Independent Sigmoid gate scoring
        scores = torch.sigmoid(logits)

        # Top-K selection
        topk_scores, topk_indices = torch.topk(scores, self.top_k, dim=-1)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T19:11:46.455Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795288306455",
    "title": "High-Rank MoE Sigmoid Routing with Bias Isolation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-tencent-hy-simulmt-30b-a3b-fp8-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8aba118a3931d0323c906f30c865e115acb579651636617fd9317352c0fdae57"
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
        "Harvested/verified timestamp recorded: 2026-11-21T19:11:46.456Z"
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
  "auth_token": "18ed7b96a821ce9eaa0f4b0ea2dae274cb402e9c1f97fde72eb5f6460b722f8a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

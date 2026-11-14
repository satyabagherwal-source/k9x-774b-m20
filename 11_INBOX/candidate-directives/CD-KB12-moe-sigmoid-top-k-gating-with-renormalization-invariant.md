# Candidate Directive: [CD-KB12] MoE Sigmoid Top-K Gating with Renormalization Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-naiveai-naive-n0.5-flash-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T07:41:29.851Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-naiveai-naive-n0.5-flash-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-naiveai-naive-n0.5-flash-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T07:41:29.851Z`  
> **Learning ID**: `LEARN-EVO-hf-naiveai-naive-n0.5-flash-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When routing MoE layers with auxiliary-loss-free top-k token routing (`topk_method: "noaux_tc"`) and sigmoid gating (`scoring_func: "sigmoid"`), the router **MUST** select the top-$K$ experts based on raw unnormalized sigmoid scores, but **MUST** renormalize the winning weights so that $\sum_{k=1}^K w_k = 1.0$ (when `norm_topk_prob: true`). Router code **MUST NOT** use standard softmax across all experts, nor apply unnormalized sigmoid weights directly to expert outputs.

**WHY**:
Softmax over $E = 256$ experts introduces an exponential suppression bias where non-top experts drive down top-expert probabilities when background logits shift. Sigmoid evaluates each expert independently:
$$s_e = \sigma(x \cdot W_e)$$
However, if top-$K$ weights are used directly without renormalization ($\sum s_k \ne 1.0$), the dynamic range of token representations will oscillate wildly depending on how many experts scored above threshold, causing non-stationary inputs to subsequent layer normalizations and catastrophic divergence during float16/bfloat16 pretraining.

**WHEN TO APPLY**:
High-expert-count MoE architectures ($E \ge 64$) utilizing token-choice (`noaux_tc`) without auxiliary load balancing loss.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn

class NoAuxSigmoidTopKRouter(nn.Module):
    def __init__(
        self,
        hidden_size: int = 4096,
        n_routed_experts: int = 256,
        num_experts_per_tok: int = 8,
        norm_topk_prob: bool = True,
    ):
        super().__init__()
        self.num_experts = n_routed_experts
        self.top_k = num_experts_per_tok
        self.norm_topk_prob = norm_topk_prob
        self.weight = nn.Parameter(torch.empty(n_routed_experts, hidden_size))
        nn.init.normal_(self.weight, std=0.02)

    def forward(self, hidden_states: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        # hidden_states: [batch_size * seq_len, hidden_size]
        logits = torch.matmul(hidden_states, self.weight.t()) # [N, E]
        
        # Scoring with Sigmoid
        scores = torch.sigmoid(logits.float()) # Upcast to float32 for routing stability

        # Top-K selection
        topk_scores, topk_indices = torch.topk(scores, self.top_k, dim=-1, largest=True, sorted=True)

        if self.norm_topk_prob:
            # Safe normalization guard against zero-sum underflow
            denominator = topk_scores.sum(dim=-1, keepdim=True)
            denominator = torch.clamp(denominator, min=1e-20)
            topk_weights = topk_scores / denominator
        else:
            topk_weights = topk_scores

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T07:41:29.942Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794642089942",
    "title": "MoE Sigmoid Top-K Gating with Renormalization Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-naiveai-naive-n0.5-flash-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "7b98dd552f42e43202eb0af2a1d48de3e7f3a2d6e538617170dcaa6a89e2bc01"
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
        "Harvested/verified timestamp recorded: 2026-11-14T07:41:29.942Z"
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
  "auth_token": "d90e2414aee72d7214f951a99ecb2a6f30b0975db9f1a764a9eb148c4dfa6484"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

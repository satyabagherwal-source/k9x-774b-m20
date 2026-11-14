# Candidate Directive: [CD-KB12] Dimensionally Asymmetric Attention Scale Normalization

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
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When attention head projection dimensions are asymmetric between Query/Key ($d_k$) and Value ($d_v$) tensors (e.g., $d_k = 192$, $d_v = 128$), the system **MUST NOT** use standard scale $\frac{1}{\sqrt{d_k}}$ in isolation without scaling the projection output. It **MUST** scale either attention logits by $\frac{1}{\sqrt{d_k}}$ and output projections by an explicit correction factor $\kappa = \sqrt{\frac{d_v}{d_k}}$ (or explicit `attention_value_scale`), or fuse scale factors into the softmax temperature.

**WHY**:
In standard Transformers, $d_k = d_v = d$. Standard variance derivation for attention output $O = \text{Softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$ assumes identity variance propagation $\text{Var}(O_i) = \text{Var}(V_j)$. When $d_k = 192$ and $d_v = 128$, the variance of logits matches normal distribution, but the output tensor variance is scaled by $\frac{d_v}{d_k} = \frac{128}{192} \approx 0.666$. Without multiplying by `attention_value_scale` ($0.707 \approx \frac{1}{\sqrt{2}}$), residual stream variance progressively decays across 48 layers, forcing RMSNorm into numerical underflow or exploding residual gradients during backward passes.

**WHEN TO APPLY**:
Any attention implementation where projection dimensions diverge: $d_{\text{head\_qk}} \ne d_{\text{head\_v}}$.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class AsymmetricQKVAttention(nn.Module):
    def __init__(
        self,
        hidden_size: int = 4096,
        num_heads: int = 64,
        num_kv_heads: int = 4,
        head_dim: int = 192,
        v_head_dim: int = 128,
        attention_value_scale: float = 0.707,
    ):
        super().__init__()
        self.num_heads = num_heads
        self.num_kv_heads = num_kv_heads
        self.head_dim = head_dim
        self.v_head_dim = v_head_dim
        self.scale = 1.0 / (head_dim ** 0.5)
        self.value_scale = attention_value_scale

        self.q_proj = nn.Linear(hidden_size, num_heads * head_dim, bias=False)
        self.k_proj = nn.Linear(hidden_size, num_kv_heads * head_dim, bias=False)
        self.v_proj = nn.Linear(hidden_size, num_kv_heads * v_head_dim, bias=False)
        self.o_proj = nn.Linear(num_heads * v_head_dim, hidden_size, bias=False)

    def forward(
        self,
        x: torch.Tensor,
        mask: torch.Tensor | None = None
    ) -> torch.Tensor:
        b, s, _ = x.shape
        q = self.q_proj(x).view(b, s, self.num_heads, self.head_dim).transpose(1, 2)
        k = self.k_proj(x).view(b, s, self.num_kv_heads, self.head_dim).transpose(1, 2)
        v = self.v_proj(x).view(b, s, self.num_kv_heads, self.v_head_dim).transpose(1, 2)

        # Expand KV for GQA

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T07:41:29.941Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794642089941",
    "title": "Dimensionally Asymmetric Attention Scale Normalization",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-naiveai-naive-n0.5-flash-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b5131d1f7abf7ca6227c797a560c57ab0c4141c4d864abfcedf3533d26a282aa"
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
        "Harvested/verified timestamp recorded: 2026-11-14T07:41:29.941Z"
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
  "auth_token": "e24de9e5f2c3bb448434418537909c925d8d6f75444b20b82fd0609ff735e40b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

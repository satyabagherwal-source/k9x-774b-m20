# Candidate Directive: [CD-CAZ5] Multi-Head Latent Attention (MLA) Decoupled Rotary-Content Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-meituan-longcat-longcat-2.5-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T07:48:38.302Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-meituan-longcat-longcat-2.5-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-meituan-longcat-longcat-2.5-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T07:48:38.302Z`  
> **Learning ID**: `LEARN-EVO-hf-meituan-longcat-longcat-2.5-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing low-rank compressed attention (MLA/KV-LoRA), rotary position embeddings (RoPE) MUST NEVER be applied directly to the compressed latent vector $c^{KV}$ or the uncompressed content vector $k^{nope}$. RoPE MUST be applied exclusively to a dedicated, decoupled sub-head positional projection $k^{pe}$, and the resulting positional dot product MUST be accumulated additively with the content dot product before softmax normalization:
$$\text{AttnScore}_{i,j} = \frac{1}{\sqrt{d_{nope} + d_{pe}}} \left( q_i^{nope} (k_j^{nope})^T + q_i^{pe} (k_j^{pe})^T \right)$$

**WHY**:
Applying RoPE directly to low-rank compressed KV matrices invalidates KV-cache matrix absorption ($W_{UK} W_{UV}$ folding during inference generation). When rotary transformations interleave with the compressed representation, subsequent tokens cannot evaluate attention scores through pre-computed compressed caches via associative projections, forcing full uncompressed dequantization of keys per step and inflating GPU memory bandwidth by $4\times$ to $6\times$.

**WHEN TO APPLY**:
Any LLM/VLM serving engine, transformer layer implementation, or custom CUDA kernel implementing low-rank KV compression (MLA, DeepSeek architecture variants, LongCat architectures).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class MultiHeadLatentAttention(nn.Module):
    def __init__(
        self,
        hidden_size: int = 8192,
        num_heads: int = 64,
        q_lora_rank: int = 1536,
        kv_lora_rank: int = 512,
        qk_nope_head_dim: int = 128,
        qk_rope_head_dim: int = 64,
        v_head_dim: int = 128,
    ):
        super().__init__()
        self.num_heads = num_heads
        self.qk_nope_head_dim = qk_nope_head_dim
        self.qk_rope_head_dim = qk_rope_head_dim
        self.v_head_dim = v_head_dim
        self.scale = (qk_nope_head_dim + qk_rope_head_dim) ** -0.5

        # Query compression
        self.q_down_proj = nn.Linear(hidden_size, q_lora_rank, bias=False)
        self.q_down_norm = nn.RMSNorm(q_lora_rank, eps=1e-5)
        self.q_up_proj = nn.Linear(
            q_lora_rank, num_heads * (qk_nope_head_dim + qk_rope_head_dim), bias=False
        )

        # Key-Value compression
        self.kv_down_proj = nn.Linear(hidden_size, kv_lora_rank, bias=False)
        self.kv_down_norm = nn.RMSNorm(kv_lora_rank, eps=1e-5)
        self.kv_up_proj = nn.Linear(
            kv_lora_rank, num_heads * (qk_nope_head_dim + v_head_dim), bias=False
        )
        # Decoupled RoPE Key generator
        self.k_rope_proj = nn.Linear(hidden_size, qk_rope_head_dim, bias=False)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T07:48:38.413Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795333718413",
    "title": "Multi-Head Latent Attention (MLA) Decoupled Rotary-Content Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-meituan-longcat-longcat-2.5-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "110582d1d98491a96ac0d94ff16d7e40055928dab630db8b0f0d23dc6200adba"
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
        "Harvested/verified timestamp recorded: 2026-11-22T07:48:38.414Z"
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
  "auth_token": "feb6190567eafb7d5300162b6cdda8aff377c3af95e00792fb881f37bc391da7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-08Y8] Contiguous Interleaved Rotary Positional Embedding (RoPE) Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-meta-llama-llama-2-7b-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T04:37:56.320Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-meta-llama-llama-2-7b-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-meta-llama-llama-2-7b-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T04:37:56.320Z`  
> **Learning ID**: `LEARN-EVO-hf-meta-llama-llama-2-7b-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When applying 2D Givens rotation to Query and Key projection heads, rotation chunks MUST be calculated over paired even-odd coordinate splits or half-split dimension chunks consistently matching the precomputed sinusoidal frequency tables, and memory tensors MUST be made `.contiguous()` before applying inplace view mutations.

**WHY**:
Failure to assert tensor memory contiguity after slicing and transposing multi-head tensors (`[B, S, H, D] -> [B, H, S, D]`) causes memory layout misalignment. If `view()` is invoked instead of `reshape()` on a non-contiguous slice during rotational pairing, PyTorch throws a runtime panic. If the paired chunk slicing formula mismatches the rotary frequency index (`cos` and `sin`), attention scores become corrupt, breaking context preservation beyond token 0.

**WHEN TO APPLY**:
All autoregressive query-key attention projection modules utilizing Rotary Positional Embeddings (RoPE) under causal masking.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def rotate_half(x: torch.Tensor) -> torch.Tensor:
    """Rotates half the hidden dims of the input."""
    # Chunk along final head dimension [-1]
    x1 = x[..., : x.shape[-1] // 2]
    x2 = x[..., x.shape[-1] // 2 :]
    return torch.cat((-x2, x1), dim=-1)

def apply_rotary_pos_emb(
    q: torch.Tensor, 
    k: torch.Tensor, 
    cos: torch.Tensor, 
    sin: torch.Tensor, 
    position_ids: torch.Tensor,
    unsqueeze_dim: int = 1
) -> tuple[torch.Tensor, torch.Tensor]:
    # Invariant: Gather rotary frequencies using explicit position IDs
    # cos, sin shape: [max_seq_len, head_dim] -> sliced to [batch, seq_len, head_dim]
    cos = cos[position_ids].unsqueeze(unsqueeze_dim)  # [B, 1, S, D]
    sin = sin[position_ids].unsqueeze(unsqueeze_dim)  # [B, 1, S, D]
    
    # Enforce contiguity before element-wise fusion
    q = q.contiguous()
    k = k.contiguous()
    
    q_embed = (q * cos) + (rotate_half(q) * sin)
    k_embed = (k * cos) + (rotate_half(k) * sin)
    return q_embed.to(q.dtype), k_embed.to(k.dtype)
```

**NEGATIVE CONSTRAINT**:
```python
# DEFECTIVE: Fails on non-contiguous view and swaps incorrect dimensions
def apply_rotary_broken(q, k, cos, sin):
    # BUG 1: Assumes implicit broadcasting without position_ids indexing
    # BUG 2: view() fails when q has been transposed (e.g. from linear projection)
    q_rot = q.view(-1, 2).flip(dims=[-1]).view(q.shape)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T04:37:56.432Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794631076432",
    "title": "Contiguous Interleaved Rotary Positional Embedding (RoPE) Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-meta-llama-llama-2-7b-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a4ff7f2be2fd1223cce2742db51af9606ad14c40d6d4911c8328478f3877ebea"
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
        "Harvested/verified timestamp recorded: 2026-11-14T04:37:56.432Z"
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
  "auth_token": "b1fc5d468e597baae12e341e4abb512aee418859e07a2439aec882de077499d6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

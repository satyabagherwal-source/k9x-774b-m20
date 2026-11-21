# Candidate Directive: [CD-LE08] Partial Rotary Embedding (pRoPE) Head-Dim Partition Invariant

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
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When applying Rotary Position Embeddings with a partial rotary factor ($\alpha < 1.0$, e.g., `partial_rotary_factor: 0.25`), the implementation MUST partition query/key heads strictly such that rotary transformations apply only to indices $[0, \lfloor d \cdot \alpha \rfloor)$, leaving the remaining dimensions $[\lfloor d \cdot \alpha \rfloor, d)$ untouched. The non-rotary slice MUST be preserved bit-for-bit and concatenated with the rotated slice before calculating scaled dot-product attention.

**WHY**:
MiniCPM-OCR sets `partial_rotary_factor: 0.25` on head dimension $d = 256$. Only the first $64$ dimensions carry phase rotation ($d_{\text{rotary}} = 64$); the upper $192$ dimensions encode non-positional semantic feature magnitude. Applying RoPE across all 256 dimensions invalidates positional frequency mappings, breaks `rope_theta: 10000000` calibration, destroys long-range context preservation, and results in gibberish text output.

**WHEN TO APPLY**:
Any attention projection module utilizing partial rotary factors (Qwen2/3, MiniCPM, ChatGLM) where $d_{\text{rotary}} < d_{\text{head}}$.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def apply_partial_rotary_pos_emb(
    q: torch.Tensor, 
    k: torch.Tensor, 
    cos: torch.Tensor, 
    sin: torch.Tensor, 
    rotary_factor: float = 0.25
) -> Tuple[torch.Tensor, torch.Tensor]:
    """
    Args:
        q, k: Tensors of shape [batch, seq_len, num_heads, head_dim]
        cos, sin: Tensors of shape [batch, seq_len, 1, rotary_dim]
    """
    head_dim = q.shape[-1]
    rotary_dim = int(head_dim * rotary_factor)
    
    # 1. Partition into rotary and pass-through slices
    q_rot, q_pass = q[..., :rotary_dim], q[..., rotary_dim:]
    k_rot, k_pass = k[..., :rotary_dim], k[..., rotary_dim:]
    
    # 2. Standard RoPE rotation on rotary slice
    # rotate_half(x): [-x2, x1]
    def rotate_half(x):
        x1 = x[..., : x.shape[-1] // 2]
        x2 = x[..., x.shape[-1] // 2 :]
        return torch.cat((-x2, x1), dim=-1)

    q_rot_embed = (q_rot * cos) + (rotate_half(q_rot) * sin)
    k_rot_embed = (k_rot * cos) + (rotate_half(k_rot) * sin)
    
    # 3. Concatenate back with untouched pass-through slice
    q_out = torch.cat([q_rot_embed, q_pass], dim=-1)
    k_out = torch.cat([k_rot_embed, k_pass], dim=-1)
    
    return q_out, k_out
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T19:47:52.231Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795290472231",
    "title": "Partial Rotary Embedding (pRoPE) Head-Dim Partition Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openbmb-minicpm-ocr-1.0-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "90e6ed25774fe57066adb6039691aad24fa4577ab90089853dad51b3eb92d594"
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
        "Harvested/verified timestamp recorded: 2026-11-21T19:47:52.231Z"
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
  "auth_token": "e66850d5a3212aa8ab6e9bd05de171870598a89659f4f0c9ee8c6604d2a460f2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

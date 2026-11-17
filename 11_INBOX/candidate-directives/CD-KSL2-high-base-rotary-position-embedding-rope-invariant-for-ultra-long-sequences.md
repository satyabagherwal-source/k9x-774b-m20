# Candidate Directive: [CD-KSL2] High-Base Rotary Position Embedding (RoPE) Invariant for Ultra-Long Sequences

<!-- PROVENANCE_START
{
  "source_repository": "hf-nanbeige-nanbeige4.3-33b-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T18:44:44.218Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-nanbeige-nanbeige4.3-33b-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-nanbeige-nanbeige4.3-33b-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T18:44:44.218Z`  
> **Learning ID**: `LEARN-EVO-hf-nanbeige-nanbeige4.3-33b-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When serving or fine-tuning models operating at sequence lengths $S \ge 524,288$ ($512\text{ KiB}$) with high RoPE base values ($\theta = 1.2 \times 10^8$), position calculation MUST be computed using double precision (`float64`) or high-precision cumulative phase accumulators before downcasting to `bfloat16`/`float16`. Single precision (`float32`) trigonometric evaluation for indices near $S = 524,288$ with $\theta = 120,000,000$ MUST NOT be used directly without frequency clipping or high-precision scaling, as IEEE 754 float32 suffers catastrophic precision cancellation in the lowest frequency dimensions.

**WHY**:
In RoPE, the lowest frequency component corresponds to:
$$\lambda_{\min} = \frac{1}{\theta^{\frac{d_k - 2}{d_k}}} = \frac{1}{(120,000,000)^{\frac{126}{128}}} \approx \frac{1}{120,000,000^{0.984375}} \approx 1.218 \times 10^{-8}$$
When multiplied by $m = 524,288$, the phase angle is $\theta_m = 524,288 \times 1.218 \times 10^{-8} \approx 0.006387$. In standard single-precision `float32`, computing $\cos(m \cdot \lambda)$ and $\sin(m \cdot \lambda)$ accumulates truncation errors over hundreds of sequential tokens, causing positional collapse where far-away tokens become numerically indistinguishable from near tokens.

**WHEN TO APPLY**:
Any token embedding calculation, FlashAttention rotary precomputation kernel, or Triton/CUDA custom RoPE implementation targeting sequence horizons $> 131,072$ tokens and $\theta \ge 10^7$.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def compute_ultra_long_rope_frequencies(
    dim: int,
    max_position_embeddings: int = 524288,
    base: float = 120000000.0,
    device: torch.device = torch.device("cpu")
) -> torch.Tensor:
    """
    Computes RoPE frequency matrices using float64 phase buffers to prevent 
    catastrophic precision loss at 512k token horizons.
    """
    # 1. Compute inverse frequencies in float64
    inv_freq_indices = torch.arange(0, dim, 2, dtype=torch.float64, device=device)
    inv_freq = 1.0 / (base ** (inv_freq_indices / dim))
    
    # 2. Compute position sequence in float64
    positions = torch.arange(max_position_embeddings, dtype=torch.float64, device=device)
    
    # 3. Outer product in float64
    angles = torch.outer(positions, inv_freq) # Shape: (max_position_embeddings, dim // 2)
    
    # 4. Compute rotary factors and cast to bfloat16 only at boundary
    cos = torch.cos(angles).to(torch.bfloat16)
    sin = torch.sin(angles).to(torch.bfloat16)
    
    return torch.stack([cos, sin], dim=-1)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Float32/Float16 direct RoPE calculation at 512k context
def buggy_rope_angles(dim=128, max_seq=524288, base=120000000.0):
    # Generates severe floating point roundoff at seq > 262144
    inv_freq = 1.0 / (base ** (torch.arange(0, dim, 2, dtype=torch.float16) / dim))
    t = torch.arange(max_seq, dtype=torch.float16)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T18:44:44.340Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794941084340",
    "title": "High-Base Rotary Position Embedding (RoPE) Invariant for Ultra-Long Sequences",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-nanbeige-nanbeige4.3-33b-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "cd5408e02d0cab405b01268263a51da7bdcfaa08f9195e646285fedffd1bd5f0"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T18:44:44.341Z"
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
  "auth_token": "750377efd54c59b8bfb3c07e4c989502ac7ebc35022baa8d9d92ed23cda7e03a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

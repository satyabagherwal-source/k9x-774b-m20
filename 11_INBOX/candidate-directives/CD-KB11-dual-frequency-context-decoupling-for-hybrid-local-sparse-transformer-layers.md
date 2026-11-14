# Candidate Directive: [CD-KB11] Dual-Frequency Context Decoupling for Hybrid Local-Sparse Transformer Layers

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
When combining local sliding-window attention (SWA) and sparse global indexer attention (DSA) in a unified transformer backbone, the system **MUST** assign distinct rotary frequency base parameters ($\theta_{\text{local}} \ll \theta_{\text{global}}$) and apply rotary embeddings **ONLY** to a fractional sub-vector of the query/key projections (`partial_rotary_factor` $\le 0.5$). The model **MUST NOT** share a single $\theta$ base or rotate the full projection head dimension when scaling past $128\text{K}$ tokens.

**WHY**:
Applying ultra-high $\theta$ ($\ge 10^7$) to sliding-window layers degrades local syntax and short-range positional resolution because high base values collapse the angular velocity of low-frequency dimensions, making tokens within distance $W=128$ indistinguishable. Conversely, applying low $\theta$ ($10^4$) to global indexers induces phase wrapping and catastrophic catastrophic attention dispersion over $1\text{M}$ tokens. Rotating only a sub-slice (e.g., $64$ of $192$ dimensions) leaves the remaining subspace unrotated, providing invariant coordinate-free semantic matching while preserving positional distinction.

**WHEN TO APPLY**:
Apply to any transformer architecture targeting context lengths $\ge 128\text{K}$ tokens utilizing hybrid local/sparse attention layers.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn

class DualFrequencyPartialRoPE(nn.Module):
    def __init__(
        self,
        dim: int = 192,
        partial_rotary_factor: float = 0.334,
        theta_swa: float = 10000.0,
        theta_dsa: float = 10000000.0,
        max_seq_len: int = 1048576,
    ):
        super().__init__()
        self.rotary_dim = int(dim * partial_rotary_factor)
        # Ensure rotary_dim is even for 2D complex plane decomposition
        if self.rotary_dim % 2 != 0:
            self.rotary_dim -= 1
        self.unrotated_dim = dim - self.rotary_dim

        # Precompute frequencies for SWA and DSA separately
        self.register_buffer(
            "inv_freq_swa",
            1.0 / (theta_swa ** (torch.arange(0, self.rotary_dim, 2).float() / self.rotary_dim)),
            persistent=False,
        )
        self.register_buffer(
            "inv_freq_dsa",
            1.0 / (theta_dsa ** (torch.arange(0, self.rotary_dim, 2).float() / self.rotary_dim)),
            persistent=False,
        )

    def _apply_rotary(self, x_rot: torch.Tensor, freqs: torch.Tensor) -> torch.Tensor:
        # x_rot: [batch, heads, seq_len, rotary_dim]
        # freqs: [seq_len, rotary_dim // 2]
        sin = freqs.sin().unsqueeze(0).unsqueeze(1)
        cos = freqs.cos().unsqueeze(0).unsqueeze(1)
        x1 = x_rot[..., 0::2]
        x2 = x_rot[..., 1::2]

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T07:41:29.940Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794642089940",
    "title": "Dual-Frequency Context Decoupling for Hybrid Local-Sparse Transformer Layers",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-naiveai-naive-n0.5-flash-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e266b238c7003120119cee40faf6c8f7fb68fcfba7308d38a1bcb4fc6629d9f7"
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
        "Harvested/verified timestamp recorded: 2026-11-14T07:41:29.940Z"
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
  "auth_token": "1f732fa9cb829303ec19859edc70ba4e6e4c0cf5212536b82a726bc9d8a8a237"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

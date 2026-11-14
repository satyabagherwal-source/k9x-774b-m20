# Candidate Directive: [CD-08Y7] Invariant Preservation in Non-Saturating Fused RMSNorm Kernels

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
When implementing Root Mean Square Normalization (RMSNorm) over half-precision tensors (`float16` or `bfloat16`), the variance computation MUST be performed in `float32` precision before taking the reciprocal square root, and weights ($\gamma$) MUST NOT be multiplied into the intermediate state before normalization is strictly complete.

**WHY**:
In `float16`, the maximum representable value is $65,504$. Computing $\sum x_i^2$ for hidden dimension $D = 4096$ with individual activations $x_i > 4.0$ results in an intermediate sum exceeding $4096 \times 16 = 65,536$, triggering immediate IEEE 754 overflow (`+inf`). Once an activation hits `+inf`, taking `rsqrt(+inf)` yields `0.0`, resulting in a poisoned downstream tensor of zeros or `NaN` outputs during loss backpropagation.

**WHEN TO APPLY**:
Applies to every normalization pass (Pre-Attention RMSNorm, Post-Attention RMSNorm, Final RMSNorm) across all CUDA/Triton kernels, C++ LibTorch extensions, and PyTorch reference models operating on deep Transformer architectures.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn

class LlamaRMSNorm(nn.Module):
    def __init__(self, hidden_size: int, eps: float = 1e-5):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(hidden_size))
        self.variance_epsilon = eps

    def forward(self, hidden_states: torch.Tensor) -> torch.Tensor:
        input_dtype = hidden_states.dtype
        # CRITICAL INVARIANT: Upcast to float32 to prevent accumulator overflow
        variance = hidden_states.to(torch.float32).pow(2).mean(-1, keepdim=True)
        hidden_states = hidden_states * torch.rsqrt(variance + self.variance_epsilon)
        # Downcast back to activation dtype and apply learnable scale gamma
        return (self.weight * hidden_states).to(input_dtype)
```

**NEGATIVE CONSTRAINT**:
```python
# DEFECTIVE: Accumulates within native fp16; overflows at hidden_size=4096
class BrokenRMSNorm(nn.Module):
    def __init__(self, hidden_size: int, eps: float = 1e-5):
        super().__init__()
        self.weight = nn.Parameter(torch.ones(hidden_size))
        self.eps = eps

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # BUG: If x is fp16, x.pow(2) overflows fp16 max (65504) -> yields Inf -> rsqrt gives 0/NaN
        return x * torch.rsqrt(x.pow(2).mean(-1, keepdim=True) + self.eps) * self.weight
```

**VERIFICATION METHOD**:
```python
def test_rmsnorm_numerical_stability():
    norm = LlamaRMSNorm(hidden_size=4096, eps=1e-5).cuda().half()
    # Construct input vector with elements that cause sum(x^2) > 65504 in fp16
    large_inputs = torch.full((1, 4096), 5.0, dtype=torch.float16, device="cuda")

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T04:37:56.427Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794631076427",
    "title": "Invariant Preservation in Non-Saturating Fused RMSNorm Kernels",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-meta-llama-llama-2-7b-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "4e574a9b461ce64b2c27c95e5f9b26086fce7720d31a036f4d543b45561dca14"
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
        "Harvested/verified timestamp recorded: 2026-11-14T04:37:56.428Z"
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
  "auth_token": "451c8991f6e77708582cb2de1be50dfd68a3c4d31b4cf7558f8b5aaca4bb5911"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

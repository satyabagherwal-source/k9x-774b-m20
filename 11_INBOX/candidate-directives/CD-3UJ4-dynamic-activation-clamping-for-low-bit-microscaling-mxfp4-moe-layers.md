# Candidate Directive: [CD-3UJ4] Dynamic Activation Clamping for Low-Bit Microscaling (MXFP4) MoE Layers

<!-- PROVENANCE_START
{
  "source_repository": "hf-openai-gpt-oss-20b-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T03:16:45.410Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-openai-gpt-oss-20b-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-openai-gpt-oss-20b-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T03:16:45.410Z`  
> **Learning ID**: `LEARN-EVO-hf-openai-gpt-oss-20b-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When quantizing high-capacity MoE MLP layers to 4-bit microscaling formats (`mxfp4`, `e2m1`, `nvfp4`), SwiGLU gated activations MUST be strictly bounded by an explicit activation ceiling (`swiglu_limit` $\le 7.0$). Unbounded gated linear units ($x \cdot \text{SiLU}(gate)$) MUST NOT be evaluated directly in native precision before quantization scaling.

**WHY**:
In SwiGLU networks, the intermediate projection $W_{\text{gate}}x \cdot \text{SiLU}(W_{\text{up}}x)$ creates unbounded positive and negative tails. While 16-bit floats absorb outlier activations up to $\sim 65,504$, microscaling FP4 (which operates on blocks of 32 elements sharing a common $E8M0$ scale factor) suffers catastrophic precision collapse if even a single element in the 32-element group spikes to large magnitudes. The entire block's dynamic range is allocated to the outlier, zeroing out the remaining 31 signals and causing severe degradation in reasoning tasks.

**WHEN TO APPLY**:
- In all transformer architectures utilizing SwiGLU or GeGLU activations paired with sub-8-bit weight or activation quantization (`mxfp4`, `fp4`, `int4`).
- Any sparse mixture-of-experts model with high dynamic range across different expert domains.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class BoundedSwiGLUMLP(nn.Module):
    """
    Production-grade MoE Expert FFN Block with SwiGLU Activation Clamping.
    Enforces swiglu_limit = 7.0 invariant prior to MXFP4 scale computation.
    """
    def __init__(self, hidden_size: int, intermediate_size: int, swiglu_limit: float = 7.0):
        super().__init__()
        self.gate_proj = nn.Linear(hidden_size, intermediate_size, bias=False)
        self.up_proj = nn.Linear(hidden_size, intermediate_size, bias=False)
        self.down_proj = nn.Linear(intermediate_size, hidden_size, bias=False)
        self.swiglu_limit = float(swiglu_limit)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Gate and Up projections: [..., hidden_size] -> [..., intermediate_size]
        gate = self.gate_proj(x)
        up = self.up_proj(x)

        # Standard SwiGLU: SiLU(gate) * up
        # CRITICAL INVARIANT: Clamp activation magnitude to swiglu_limit to preserve MXFP4 block scales
        activated = F.silu(gate) * up
        bounded_activated = torch.clamp(activated, min=-self.swiglu_limit, max=self.swiglu_limit)

        # Down projection: [..., intermediate_size] -> [..., hidden_size]
        return self.down_proj(bounded_activated)
```

**NEGATIVE CONSTRAINT**:
```python
# CRITICAL DEFECT: Unbounded activation causes MXFP4 block scale explosion
def bad_swiglu_forward(x: torch.Tensor, gate_proj, up_proj, down_proj):
    # Missing clamp! In MXFP4, an activation of 45.2 will push the shared block exponent
    # to 2^6, obliterating values around 0.1 into 0.0 under the 2-bit mantissa!
    return down_proj(F.silu(gate_proj(x)) * up_proj(x))

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T03:16:45.515Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794626205515",
    "title": "Dynamic Activation Clamping for Low-Bit Microscaling (MXFP4) MoE Layers",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openai-gpt-oss-20b-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1618c585b1520c0474c37b8808426c7ea9450700f5ba3a9129d81a2ef1e3c5b1"
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
        "Harvested/verified timestamp recorded: 2026-11-14T03:16:45.516Z"
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
  "auth_token": "7d6f3bb9090b2996e1d4ecff3c1c85b075cb0fe8673f3fd77a88f15dfb6b5de6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

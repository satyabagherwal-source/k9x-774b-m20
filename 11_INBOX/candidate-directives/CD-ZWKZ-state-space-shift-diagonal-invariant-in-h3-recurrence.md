# Candidate Directive: [CD-ZWKZ] State-Space Shift-Diagonal Invariant in H3 Recurrence

<!-- PROVENANCE_START
{
  "source_repository": "hf-sentinel7-h3-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T14:07:33.948Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-sentinel7-h3-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-sentinel7-h3-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T14:07:33.948Z`  
> **Learning ID**: `LEARN-EVO-hf-sentinel7-h3-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing an H3 (Hungry Hungry Hippos) state-space layer, the shift SSM projection MUST strictly constrain the state matrix $A_{shift}$ to sub-diagonal shift dynamics ($A_{i, i+1} = 1$, all other entries $0$) with exact step-zero identity preservation, and the diagonal SSM projection MUST maintain the real negative spectrum ($\text{Re}(\lambda) < 0$) across continuous-to-discrete bilinear/ZOH transformations. The model MUST NOT allow unconstrained gradient updates to drift the shift operator diagonal into non-zero regimes.

**WHY**:
H3 models solve the associative recall problem by using a two-tier state-space mechanism: the Shift SSM acts as an exact delay line (storing preceding tokens), while the Diagonal SSM acts as a multi-scale exponential memory decay filter. If $A_{shift}$ drifts from a pure shift matrix or if diagonal poles cross into the right-half plane ($\text{Re}(\lambda) \ge 0$), the discrete recurrence becomes numerical noise or exponentially explodes over sequences $> 2048$ tokens, destroying the numerical stability of the linear attention alternative.

**WHEN TO APPLY**:
In any SSM architecture, H3 model port, or custom linear RNN sequence modeling layer implemented in PyTorch, JAX, or Triton.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
"""
Numerically Stable Shift and Diagonal Operator Core for H3 Layers.
Enforces shift structure invariants and bounded exponential diagonal decays.
"""

import math
import torch
import torch.nn as nn
import torch.nn.functional as F


class H3ShiftDiagonalSSM(nn.Module):
    def __init__(self, d_model: int, d_state: int = 64):
        super().__init__()
        self.d_model = d_model
        self.d_state = d_state

        # Pure Shift operator kernel representation:
        # A fixed non-trainable shift basis to prevent numerical drift
        shift_kernel = torch.zeros(d_model, 1, 3)
        shift_kernel[:, 0, 1] = 1.0  # Exact 1-step token delay
        self.register_buffer("shift_kernel", shift_kernel)

        # Diagonal SSM parameters:
        # Diagonal A must have strictly negative real parts.
        # Parameterized as log(-Re(A)) to ensure stability under unconstrained Adam updates.
        self.diag_log_a_real = nn.Parameter(torch.log(torch.arange(1, d_state + 1, dtype=torch.float32)))
        self.diag_a_imag = nn.Parameter(math.pi * torch.arange(d_state, dtype=torch.float32))
        
        # B and C projection vectors
        self.B = nn.Parameter(torch.randn(d_model, d_state) * (1.0 / math.sqrt(d_model)))
        self.C = nn.Parameter(torch.randn(d_model, d_state) * (1.0 / math.sqrt(d_state)))
        
        # Discretization step parameter (log_dt parameterization)
        self.log_dt = nn.Parameter(torch.log(torch.tensor(0.001) + torch.rand(d_model) * 0.1))

    def get_discrete_diagonal_system(self) -> tuple[torch.Tensor, torch.Tensor]:
        """

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T14:07:34.067Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795183654067",
    "title": "State-Space Shift-Diagonal Invariant in H3 Recurrence",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-sentinel7-h3-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b61a142551b25473e42a503c2de999e8653b94cb4dd34e48006ac795f8d98036"
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
        "Harvested/verified timestamp recorded: 2026-11-20T14:07:34.067Z"
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
  "auth_token": "87a38f9d131528bb5c4dfb4b2c177f32aa5427a24c6f449b3120eff8f75399f5"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

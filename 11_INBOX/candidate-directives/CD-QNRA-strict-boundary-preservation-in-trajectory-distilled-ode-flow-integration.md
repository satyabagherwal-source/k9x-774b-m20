# Candidate Directive: [CD-QNRA] Strict Boundary Preservation in Trajectory-Distilled ODE Flow Integration

<!-- PROVENANCE_START
{
  "source_repository": "hf-black-forest-labs-flux.1-schnell-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-23T05:27:30.393Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-black-forest-labs-flux.1-schnell-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-black-forest-labs-flux.1-schnell-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-23T05:27:30.393Z`  
> **Learning ID**: `LEARN-EVO-hf-black-forest-labs-flux.1-schnell-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
In distilled few-step flow-matching solvers (1 to 4 steps), the numerical integrator MUST evaluate the velocity vector field strictly at clamped discrete interval bounds $t_i \in [t_{\text{start}}, t_{\text{end}} \subseteq [1.0, 0.0]]$ and MUST NOT permit the step terminal evaluation $t + \Delta t$ to underflow past $0.0$ or overflow past $1.0$.

**WHY**:
Unlike stochastic diffusion (SDEs), distilled rectified flow models parameterize straight paths from noise to data ($v_\theta = x_1 - x_0$). When distilling the model into 1 to 4 steps, small variations in the boundary evaluations ($t=0.0$) lead to out-of-distribution conditioning inputs for the neural network. In particular, passing $t < 0.0$ or dividing by an unshifted timestep causes catastrophic dynamic range collapse, producing black, oversaturated, or pure noise tensors.

**WHEN TO APPLY**:
Applies to all rectified flow pipelines, flow matching schedulers, and distillation step managers (e.g., FLUX, SD3, InstaFlow) executing $\le 8$ integration steps.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import List
import torch


class RectifiedFlowEulerScheduler:

    def __init__(
        self,
        num_inference_steps: int = 4,
        shift_scale: float = 1.0,
        base_shift: float = 0.5,
        max_shift: float = 1.15,
    ):
        assert (
            1 <= num_inference_steps <= 8
        ), "Distilled solver restricted to 1-8 steps."
        self.num_inference_steps = num_inference_steps
        self.shift_scale = shift_scale
        self.timesteps = self._compute_shifted_timesteps(
            num_inference_steps, shift_scale, base_shift, max_shift
        )

    def _compute_shifted_timesteps(
        self,
        steps: int,
        scale: float,
        base_shift: float,
        max_shift: float,
    ) -> torch.Tensor:
        # Generate linear space from 1.0 (noise) to 0.0 (data)
        timesteps = torch.linspace(1.0, 0.0, steps + 1, dtype=torch.float64)

        # Apply resolution-dependent dynamic shift
        # mu = (1.0 - scale) * base_shift + scale * max_shift
        mu = base_shift + (max_shift - base_shift) * (scale / (scale + 1.0))
        shifted_timesteps = (timesteps * torch.exp(torch.tensor(mu))) / (
            1.0 + (torch.exp(torch.tensor(mu)) - 1.0) * timesteps
        )

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-23T05:27:30.501Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795411650501",
    "title": "Strict Boundary Preservation in Trajectory-Distilled ODE Flow Integration",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-black-forest-labs-flux.1-schnell-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1db2936e05a8968a467abce1035189940468e5bd6c85f2c4b94fdffd3eec2ded"
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
        "Harvested/verified timestamp recorded: 2026-11-23T05:27:30.501Z"
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
  "auth_token": "0c446f3f2df3cfa0725cf809490a61a003b553e395e46c390d4c256f55642ff4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

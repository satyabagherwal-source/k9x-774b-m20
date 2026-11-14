# Candidate Directive: [CD-8SW5] Invariant Embedding of Distilled Sampling Sigmas in Model Metadata

<!-- PROVENANCE_START
{
  "source_repository": "hf-qwen-qwen-image-2.1-turbo-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T20:36:22.370Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-qwen-qwen-image-2.1-turbo-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-qwen-qwen-image-2.1-turbo-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T20:36:22.370Z`  
> **Learning ID**: `LEARN-EVO-hf-qwen-qwen-image-2.1-turbo-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When serving few-step distilled diffusion/flow-matching pipelines ($\le 8$ steps), the inference runtime **MUST** read sampling schedules directly from the serialized model package metadata and **MUST NOT** rely on runtime-default or heuristic scheduler timesteps. If a caller specifies `num_inference_steps` without custom sigmas, the pipeline **MUST** validate that the step count matches the distilled calibration points ($N=8$).

**WHY**:
Few-step distilled checkpoints have highly non-linear, non-uniform noise schedules derived during distillation. Applying standard linear or quadratic schedules (e.g., standard DDIM, Euler discrete with default uniform spacing) yields catastrophic distributional collapse, severe color posterization, or pure high-frequency Gaussian noise.

**WHEN TO APPLY**:
All distilled generative diffusion pipelines, Flow-Matching models (SD3-Turbo, FLUX Schnell, Qwen-Image-2.1-Turbo), and multi-modal latent editing architectures.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Optional, List
import torch
from diffusers.schedulers import FlowMatchEulerDiscreteScheduler

class TurboSamplingScheduleController:
    """
    Enforces that turbo checkpoints strictly bind to their distilled sigmas.
    """
    REQUIRED_TURBO_STEPS: int = 8

    def __init__(self, scheduler: FlowMatchEulerDiscreteScheduler, distilled_sigmas: Optional[List[float]] = None):
        self.scheduler = scheduler
        self.distilled_sigmas = distilled_sigmas

    def configure_timesteps(
        self, 
        device: torch.device, 
        custom_steps: Optional[int] = None, 
        custom_sigmas: Optional[List[float]] = None
    ) -> torch.Tensor:
        # Priority 1: Direct custom sigmas passed by caller
        if custom_sigmas is not None:
            sigmas = torch.tensor(custom_sigmas, dtype=torch.float32, device=device)
            self.scheduler.set_timesteps(sigmas=sigmas, device=device)
            return self.scheduler.timesteps

        # Priority 2: Pre-calibrated pipeline sigmas from checkpoint config
        if self.distilled_sigmas is not None:
            sigmas = torch.tensor(self.distilled_sigmas, dtype=torch.float32, device=device)
            self.scheduler.set_timesteps(sigmas=sigmas, device=device)
            return self.scheduler.timesteps

        # Priority 3: Fallback verification of step count
        target_steps = custom_steps or self.REQUIRED_TURBO_STEPS
        if target_steps != self.REQUIRED_TURBO_STEPS:
            raise ValueError(
                f"Distilled Turbo checkpoint violates invariant: requested {target_steps} steps, "
                f"but distilled weights are strictly calibrated for {self.REQUIRED_TURBO_STEPS} steps."

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T20:36:22.466Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794688582465",
    "title": "Invariant Embedding of Distilled Sampling Sigmas in Model Metadata",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-qwen-qwen-image-2.1-turbo-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a4e09085551877cab0c618040d7e3170e36da0bfe31ab6cb19c35a9e5e6e015f"
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
        "Harvested/verified timestamp recorded: 2026-11-14T20:36:22.466Z"
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
  "auth_token": "9d0030426f4b52f264c25fd3df58c6683d77a6f5a3a3a0adf7ceeca4cf9aa865"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-UZ4J] Out-of-Distribution Geometric Unbound Quarantine Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-convaiinnovations-laya-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T15:59:02.860Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-convaiinnovations-laya-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-convaiinnovations-laya-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T15:59:02.860Z`  
> **Learning ID**: `LEARN-EVO-hf-convaiinnovations-laya-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Metric-based decision spaces MUST calculate both the relative class conditional probabilities (softmax/attractor depth) AND the absolute metric distance $d(z_x, \mathcal{V})$ from the state particle to the set of valid decision attractor valleys $\mathcal{V} = \{v_1, \dots, v_K\}$. If $\min_{k} \|z_x - v_k\|_2 > \tau_{\text{unbound}}$, the system MUST flag `unbound = True`. Downstream agent pipelines MUST NOT route critical mutations on `unbound = True` signals without human-in-the-loop or secondary validation.

**WHY**:
In a closed-world softmax decision layer, an input representing completely irrelevant garbage or adversarial noise will still be normalized to sum to 1.0. Even if all raw logit attractors are deeply negative or geometrically distant from the training manifold, relative normalization masks out-of-distribution (OOD) states. Calculating the absolute metric distance guarantees that inputs landing in barren regions of the latent manifold are quarantined before state-modifying actions execute.

**WHEN TO APPLY**:
Zero-shot intent classification, API tool call selection, autonomous query routing, and safety guardrails.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import NamedTuple
import torch

class MetricDecisionOutput(NamedTuple):
    decision_idx: int
    probabilities: torch.Tensor
    min_distance: float
    unbound: bool

class AttractorDecisionHead(torch.nn.Module):
    def __init__(self, embed_dim: int, num_classes: int, unbound_distance_threshold: float):
        super().__init__()
        self.valleys = torch.nn.Parameter(torch.randn(num_classes, embed_dim))
        self.temperature = torch.nn.Parameter(torch.tensor(1.0))
        self.threshold = float(unbound_distance_threshold)

    def forward(self, z_state: torch.Tensor) -> MetricDecisionOutput:
        """
        z_state: Shape (embed_dim,)
        """
        if z_state.ndim != 1:
            raise ValueError(f"Expected single vector of dim ({self.valleys.shape[1]}), got {z_state.shape}")
            
        # Euclidean distances to all valley attractors: || z - v_k ||_2
        distances = torch.linalg.norm(self.valleys - z_state.unsqueeze(0), dim=-1)
        min_dist, best_idx = torch.min(distances, dim=0)
        
        # Energy: E_k = -dist_k^2 / (2 * tau^2)
        energies = - (distances ** 2) / (2.0 * (self.temperature ** 2).clamp(min=1e-4))
        probabilities = torch.softmax(energies, dim=-1)
        
        is_unbound = bool(min_dist.item() > self.threshold)
        
        return MetricDecisionOutput(
            decision_idx=int(best_idx.item()),
            probabilities=probabilities.detach(),
            min_distance=float(min_dist.item()),
            unbound=is_unbound

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T15:59:02.995Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795363142994",
    "title": "Out-of-Distribution Geometric Unbound Quarantine Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-convaiinnovations-laya-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "57adaa9f28c9cf0fd8109771189276eda23ddc499307ced0d5987e7e9de21039"
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
        "Harvested/verified timestamp recorded: 2026-11-22T15:59:02.995Z"
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
  "auth_token": "70dc0652b90e8bc3811e710dd2bed8d2d0842328f0d0ceeff487a2daadc281ce"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

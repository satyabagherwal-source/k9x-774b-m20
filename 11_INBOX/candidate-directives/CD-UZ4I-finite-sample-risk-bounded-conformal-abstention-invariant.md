# Candidate Directive: [CD-UZ4I] Finite-Sample Risk-Bounded Conformal Abstention Invariant

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
Decision models deployed for autonomous routing, moderation, or mission-critical action selection MUST NOT rely on raw uncalibrated argmax logits or static heuristic thresholds (e.g., `if prob < 0.8: reject()`). The decision engine MUST output a split-conformal prediction set $C_\alpha(X)$ calibrated on an independent exchangeable calibration dataset $\mathcal{D}_{\text{cal}} = \{(X_i, Y_i)\}_{i=1}^n$, guaranteeing that marginal test-time coverage satisfies $P(Y \in C_\alpha(X)) \ge 1 - \alpha$. When the cardinality $|C_\alpha(X)| \ne 1$, the engine MUST trigger an explicit `abstain` state.

**WHY**:
Static probability cutoffs fail under covariate shifts, temperature modifications, and inherent class ambiguities. If an input is simultaneously compatible with multiple classes, argmax selection forces arbitrary classification over ambiguous boundaries, causing critical downstream failures. Conformal prediction sets provide distribution-free, finite-sample statistical guarantees. If $|C_\alpha(X)| = 0$, the input is out-of-distribution; if $|C_\alpha(X)| > 1$, the input is fundamentally ambiguous, and the error rate among committed actions is bounded by $\alpha$.

**WHEN TO APPLY**:
Apply to all deterministic AI agent routing, zero-shot intent dispatchers, classification heads, automated moderation filters, and security guardrail layers.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import List, Tuple, Set, Dict, Any
import numpy as np

class ConformalDecisionEngine:
    """
    Implements finite-sample distribution-free conformal abstention
    guaranteeing error rate <= alpha on committed singletons.
    """
    def __init__(self, alpha: float = 0.10):
        if not (0.0 < alpha < 1.0):
            raise ValueError(f"Alpha must be in (0, 1), got {alpha}")
        self.alpha: float = alpha
        self.quantile_threshold: float = 1.0
        self.is_calibrated: bool = False

    def calibrate(self, nonconformity_scores: np.ndarray) -> None:
        """
        Calibrate quantile using nonconformity scores s_i = 1.0 - P(Y_i | X_i).
        Finite-sample correction uses ceil((n + 1) * (1 - alpha)) / n.
        """
        n = len(nonconformity_scores)
        if n == 0:
            raise ValueError("Calibration set cannot be empty.")
            
        p_level = np.ceil((n + 1) * (1.0 - self.alpha)) / n
        p_level = min(1.0, max(0.0, p_level))
        
        # Conformal empirical quantile calculation
        self.quantile_threshold = float(np.quantile(nonconformity_scores, p_level, method="higher"))
        self.is_calibrated = True

    def predict(
        self, 
        class_probabilities: np.ndarray, 
        candidate_labels: List[str]
    ) -> Dict[str, Any]:
        if not self.is_calibrated:
            raise RuntimeError("Engine must be calibrated before running inference.")

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T15:59:02.984Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795363142984",
    "title": "Finite-Sample Risk-Bounded Conformal Abstention Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-convaiinnovations-laya-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a945b20f7f17efab8bde5fdcb9573d3317c1704fabfcd59824a5c43594076489"
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
        "Harvested/verified timestamp recorded: 2026-11-22T15:59:02.985Z"
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
  "auth_token": "05075c044913977b1caf4aa6225b1d135212f591daaf83035f48ba486a3dab86"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-06NS] Orthogonal Weight Projection Invariant for Activation Ablation

<!-- PROVENANCE_START
{
  "source_repository": "hf-obliteratus-deepseek-v4.1-flash-1017-obliterated-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T08:09:30.710Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-obliteratus-deepseek-v4.1-flash-1017-obliterated-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-obliteratus-deepseek-v4.1-flash-1017-obliterated-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T08:09:30.710Z`  
> **Learning ID**: `LEARN-EVO-hf-obliteratus-deepseek-v4.1-flash-1017-obliterated-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When performing linear representation surgery (ablation/unlearning) on causal transformer weights, the weight transformation MUST be executed as a rank-1 orthogonal projection along normalized directional vectors $\hat{r} \in \mathbb{R}^{d}$, and the implementation MUST assert that the Frobenius norm delta $\|\Delta W\|_F / \|W\|_F$ does not exceed a dynamic threshold $\epsilon_{\text{drift}} \le 0.05$ while verifying token forward KL divergence $\mathcal{D}_{\text{KL}}(P_{\text{orig}} \parallel P_{\text{abl}}) \le \tau_{\text{KL}}$ on a held-out benchmark.

**WHY**:
Unconstrained directional pruning or naive activation clamping either causes catastrophic model collapse (gibberish generation, loss of arithmetic/reasoning capability) or leaves residual projections that can be reactivated by jailbreaks. Exact orthogonal projection guarantees that the ablated subspace produces zero activation along $\hat{r}$ while preserving maximum variance along all orthogonal task-relevant dimensions.

**WHEN TO APPLY**:
Apply in any representation modification, safety alignment steering, concept erasing, or refusal ablation in linear layers (`grouped_gemm`, MoE down-projections `layers.*.mlp.experts.down_proj`, and attention output projections `o_proj`).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

@torch.no_grad()
def orthogonalize_weight_subspace(
    weight: torch.Tensor,
    refusal_vector: torch.Tensor,
    max_frobenius_drift: float = 0.05
) -> torch.Tensor:
    """
    Orthogonally projects a weight matrix to nullify projections along refusal_vector.
    Formula: W' = W - (W @ r_hat) (x) r_hat^T  (for row-space transformation W x)
    Invariant: (W' @ r_hat) == 0 vector
    """
    # 1. Micro-syntax invariant: Enforce float32/float64 for directional normalization
    r = refusal_vector.to(device=weight.device, dtype=torch.float32)
    norm_r = torch.linalg.vector_norm(r)
    if norm_r < 1e-12:
        raise ValueError("Refusal vector has degenerate near-zero norm.")
    r_hat = (r / norm_r).to(dtype=weight.dtype)

    orig_dtype = weight.dtype
    orig_norm = torch.linalg.matrix_norm(weight.float(), ord="fro")

    # 2. Projection: project out r_hat from the input features of W
    # If y = x @ W^T, where x has refusal component, we adjust W:
    # delta = (W @ r_hat)[:, None] * r_hat[None, :]
    proj = torch.matmul(weight, r_hat.unsqueeze(-1))  # [out_features, 1]
    delta = torch.matmul(proj, r_hat.unsqueeze(0))     # [out_features, in_features]

    w_prime = weight - delta
    w_prime = w_prime.to(dtype=orig_dtype)

    # 3. Microscopic safety check: Frobenius norm drift guard
    new_norm = torch.linalg.matrix_norm(w_prime.float(), ord="fro")
    drift = torch.abs(orig_norm - new_norm) / orig_norm
    if drift > max_frobenius_drift:
        raise FloatingPointError(
            f"Weight modification drift {drift:.6f} exceeded threshold {max_frobenius_drift}"

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T08:09:30.807Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794730170807",
    "title": "Orthogonal Weight Projection Invariant for Activation Ablation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-obliteratus-deepseek-v4.1-flash-1017-obliterated-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1b804898d1672d7a97ebbc4cdccee205aaacdcedf010b5a54020fe19e53bc260"
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
        "Harvested/verified timestamp recorded: 2026-11-15T08:09:30.807Z"
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
  "auth_token": "37613b907c3c9e24c7d98f05674ee4a71c9847d9436db5b946b3493b4d180e2e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

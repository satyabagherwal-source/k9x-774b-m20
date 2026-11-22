# Candidate Directive: [CD-CAZ6] Sparse MoE Zero-Expert Identity Passthrough Contract

<!-- PROVENANCE_START
{
  "source_repository": "hf-meituan-longcat-longcat-2.5-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T07:48:38.302Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-meituan-longcat-longcat-2.5-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-meituan-longcat-longcat-2.5-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T07:48:38.302Z`  
> **Learning ID**: `LEARN-EVO-hf-meituan-longcat-longcat-2.5-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
In an ultra-sparse MoE layer containing both routed non-linear experts and zero/identity experts, the gate router MUST NOT route all tokens exclusively to active non-linear experts without scaling. Identity experts ($E_{\text{zero}}(x) = x$) MUST be normalized and scaled by the explicit scaling factor $S_{\text{routed}}$ (`routed_scaling_factor = 9`):
$$y = \sum_{i \in \text{TopK}} g_i(x) \cdot \text{Expert}_i(x) + \frac{1}{S_{\text{routed}}} \sum_{j \in \text{Zero}} g_j(x) \cdot x$$

**WHY**:
In models with 768+ fine-grained experts, router logits suffer from acute entropy collapse during long context rollouts (512k tokens). Without dedicated identity bypass slots, tail experts diverge into dead parameter regimes, leading to gradient vanishes in earlier transformer blocks. Identity experts provide an unconstrained highway for the residual stream, preventing representation drift during multi-turn agent rollouts.

**WHEN TO APPLY**:
Deep sparse MoE architectures (exceeding 256 experts) with low top-$k$ routing ratios ($k / N < 0.05$).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class SparseMoEWithIdentityZeroExperts(nn.Module):
    def __init__(
        self,
        hidden_size: int = 8192,
        expert_ffn_hidden_size: int = 2048,
        n_routed_experts: int = 768,
        zero_expert_num: int = 128,
        moe_topk: int = 12,
        routed_scaling_factor: float = 9.0,
    ):
        super().__init__()
        self.n_routed_experts = n_routed_experts
        self.zero_expert_num = zero_expert_num
        self.total_experts = n_routed_experts + zero_expert_num
        self.topk = moe_topk
        self.scaling_factor = routed_scaling_factor

        self.router = nn.Linear(hidden_size, self.total_experts, bias=False)
        # Routed non-linear expert parameters (Packaged for grouped GEMM / batched dispatch)
        self.routed_gate = nn.Parameter(
            torch.empty(n_routed_experts, hidden_size, expert_ffn_hidden_size)
        )
        self.routed_up = nn.Parameter(
            torch.empty(n_routed_experts, hidden_size, expert_ffn_hidden_size)
        )
        self.routed_down = nn.Parameter(
            torch.empty(n_routed_experts, expert_ffn_hidden_size, hidden_size)
        )
        nn.init.normal_(self.routed_gate, std=0.02)
        nn.init.normal_(self.routed_up, std=0.02)
        nn.init.normal_(self.routed_down, std=0.02)

    def forward(self, x: torch.Tensor) -> torch.Tensor:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T07:48:38.418Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795333718418",
    "title": "Sparse MoE Zero-Expert Identity Passthrough Contract",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-meituan-longcat-longcat-2.5-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8867813bd9a491bb4f8694b80272e888199dcbf46182b75b6b5e4b9104cf476e"
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
        "Harvested/verified timestamp recorded: 2026-11-22T07:48:38.418Z"
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
  "auth_token": "0fac1e718be17edec92f6a8f99f770cc163a0e399c74f7e53536badace6f5fcc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

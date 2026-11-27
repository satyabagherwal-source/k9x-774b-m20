# Candidate Directive: [CD-CJPF] Linear-Attention Recurrent State Boundary Retention Under Chunked Prefill

<!-- PROVENANCE_START
{
  "source_repository": "hf-nvidia-qwen3.8-flash-next-fp4-local-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-27T09:35:09.341Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-nvidia-qwen3.8-flash-next-fp4-local-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-nvidia-qwen3.8-flash-next-fp4-local-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-27T09:35:09.341Z`  
> **Learning ID**: `LEARN-EVO-hf-nvidia-qwen3.8-flash-next-fp4-local-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When running hybrid models interleaving Linear Attention (Gated DeltaNet) and Full Attention (e.g., 3:1 ratio), recurrent state buffers for linear attention layers MUST maintain persistent, non-truncated `float32` state tensors across chunked prefill iterations. Runtimes MUST NOT reset, discard, or quantize recurrent states to FP4/FP8 across prefill-decoding phase boundaries.

**WHY**:
Gated DeltaNet encodes historical sequence dependencies directly into a recurrent continuous state matrix ($S_t = S_{t-1}(I - \beta_t K_t^T V_t) + \alpha_t K_t^T V_t$). If chunked prefill treats sequence segments as independent windows or quantizes the recurrent state accumulator to low precision, historical token interactions are irrevocably destroyed, degrading generation output to repetitive degenerate loops.

**WHEN TO APPLY**:
Hybrid Transformer-SSM / Transformer-Linear Attention architectures during long-context processing (up to 262,144 tokens).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

class GatedDeltaNetRecurrentStateTracker:
    def __init__(
        self,
        num_layers: int,
        batch_size: int,
        num_heads: int,
        key_dim: int,
        val_dim: int,
        device: torch.device,
        state_dtype: torch.dtype = torch.float32, # Invariant: MUST remain float32
    ):
        self.num_layers = num_layers
        self.batch_size = batch_size
        self.num_heads = num_heads
        self.key_dim = key_dim
        self.val_dim = val_dim
        self.state_dtype = state_dtype
        self.device = device
        
        # State allocation: Shape (L, B, H, Dk, Dv)
        self.states = torch.zeros(
            (num_layers, batch_size, num_heads, key_dim, val_dim),
            dtype=self.state_dtype,
            device=self.device,
            requires_grad=False
        )

    def advance_chunk(
        self,
        layer_idx: int,
        delta_state_update: torch.Tensor,
        retention_gate: torch.Tensor
    ) -> torch.Tensor:
        """
        Updates recurrent state with strict float32 precision retention.
        delta_state_update: (B, H, Dk, Dv)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T09:35:09.507Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795772109507",
    "title": "Linear-Attention Recurrent State Boundary Retention Under Chunked Prefill",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-nvidia-qwen3.8-flash-next-fp4-local-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ec7964320d5a3cba659d5c280f5d909a855f2e52cce1b935e12002cd37248f46"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-27T09:35:09.507Z"
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
  "auth_token": "16de741091f646f3fd4c818fc6145fa03602b3c7c9540aa3418ef05212ae11b7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

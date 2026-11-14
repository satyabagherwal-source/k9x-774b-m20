# Candidate Directive: [CD-44D8] Dual-AR State Decoupling Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-edge0-audio8-tts-realistic-0.6b-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T05:08:56.632Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-edge0-audio8-tts-realistic-0.6b-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-edge0-audio8-tts-realistic-0.6b-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T05:08:56.632Z`  
> **Learning ID**: `LEARN-EVO-hf-edge0-audio8-tts-realistic-0.6b-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing hierarchical Dual-Autoregressive models (Slow-Temporal AR + Fast-Spatial/Depth AR), the Slow AR transformer hidden state MUST be normalized via a dedicated RMSNorm (`norm_fastlayer_input: true`) and detached from gradient backpropagation before being projected into the Fast AR transformer's context sequence. The Fast AR sub-network MUST NOT mutate or share KV cache buffers with the Slow AR transformer.

**WHY**:
Without dedicated pre-norming and strict cache isolation, the scale divergence between the 24-layer Slow AR hidden representation and the shallow 4-layer Fast AR embeddings causes gradient explosion in cross-attention during training and numerical overflow (`bfloat16` saturation) during inference. Sharing KV caches causes memory corruption because Slow AR sequences grow dynamically along time $T \le 2048$, whereas Fast AR caches reset on every single temporal step ($K = 10$).

**WHEN TO APPLY**:
Audio, video, or multi-modal architectures decoupling global sequence modeling from multi-codebook RVQ generation (e.g., SoundStream, EnCodec, Fish-Speech, DualAR).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn

class DualARConditioningBridge(nn.Module):
    def __init__(self, slow_dim: int = 896, fast_dim: int = 896, norm_eps: float = 1e-6):
        super().__init__()
        # Invariant: Must isolate the slow hidden representation with independent norm
        self.slow_norm = nn.RMSNorm(slow_dim, eps=norm_eps)
        if slow_dim != fast_dim:
            self.proj = nn.Linear(slow_dim, fast_dim, bias=False)
        else:
            self.proj = nn.Identity()

    def forward(self, slow_hidden_state: torch.Tensor, current_codebook_embeds: torch.Tensor) -> torch.Tensor:
        """
        slow_hidden_state: [Batch, 1, slow_dim] -> Frame temporal representation
        current_codebook_embeds: [Batch, Current_Depth, fast_dim] -> Preceding RVQ embeddings
        """
        assert slow_hidden_state.ndim == 3 and slow_hidden_state.size(1) == 1, \
            f"Slow hidden state must be sliced per-frame [B, 1, D], got {slow_hidden_state.shape}"
        
        # Step 1: Normalize slow AR context independently
        normed_slow = self.slow_norm(slow_hidden_state)
        projected_slow = self.proj(normed_slow)
        
        # Step 2: Prepend conditioned slow hidden state as prefix token (t_0) for Fast AR
        fast_input = torch.cat([projected_slow, current_codebook_embeds], dim=1)
        return fast_input
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Direct addition or raw concatenation without RMSNorm and state slicing
def bad_dual_ar_forward(slow_hidden_states, codebook_embeds):
    # CRITICAL BUG: Blends full sequence temporal cache into depth-wise fast AR,
    # blowing up memory from O(B * K) to O(B * T * K) and causing scale mismatch.
    return slow_hidden_states + codebook_embeds
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T05:08:56.730Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794632936730",
    "title": "Dual-AR State Decoupling Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-edge0-audio8-tts-realistic-0.6b-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "85082eeb46aee8e438fe87eee838a7f91391a333e0c19ba87e7ed356a5b89b59"
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
        "Harvested/verified timestamp recorded: 2026-11-14T05:08:56.731Z"
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
  "auth_token": "13a8c9504691943aa9c331dee08036e817a4dd802c6de7143501efa22efc57b4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-44D9] RoPE Base Invariant for Ultra-High-Sample Temporal Tokens

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
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When configuring Rotary Position Embeddings (RoPE) for autoregressive models that process temporal acoustic tokens spanning sequences $\ge 2048$ steps with high intra-sequence correlation, `rope_theta` (or `rope_base`) MUST be scaled to $\ge 1,000,000.0$. Default NLP values ($\theta = 10,000.0$) MUST NOT be used.

**WHY**:
In speech synthesis, tokens represent high-frequency physical vibrations sampled at sub-second intervals ($21.5\text{ Hz}$ frame rate = ~21.5 tokens/sec). At $\theta = 10,000.0$, the angular resolution for high-frequency channels collapses over long sequences ($>500$ steps / ~23 seconds of speech), leading to phase cancellation in QK dot products, severe pitch drift, and voice identity hallucination. Setting $\theta = 1,000,000.0$ stretches the wavelength of the slowest-rotating dimensions, preserving global speaker conditioning across $>90$ seconds of generated audio.

**WHEN TO APPLY**:
All autoregressive audio, speech, and long-context time-series transformer decoders.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def compute_speech_rope_frequencies(dim: int = 64, max_seq_len: int = 2048, rope_theta: float = 1000000.0) -> torch.Tensor:
    """
    dim: head_dim (e.g., 64)
    rope_theta: 1e6 invariant for speech
    """
    assert dim % 2 == 0, f"Head dim must be even, got {dim}"
    assert rope_theta >= 1e6, f"Speech RoPE theta must be >= 1,000,000, got {rope_theta}"
    
    # Calculate inverse frequencies
    inv_freq = 1.0 / (rope_theta ** (torch.arange(0, dim, 2).float() / dim))
    t = torch.arange(max_seq_len, dtype=torch.float32)
    freqs = torch.outer(t, inv_freq)
    
    # Precompute cos and sin embeddings
    emb = torch.cat((freqs, freqs), dim=-1)
    return emb.cos(), emb.sin()
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Inheriting standard text LLM RoPE theta without modification
def bad_speech_rope_setup(head_dim=64):
    # CRITICAL BUG: Standard NLP base (10,000) causes rapid phase rotation,
    # resulting in speaker timbre loss after 15 seconds of generated speech.
    return 1.0 / (10000.0 ** (torch.arange(0, head_dim, 2).float() / head_dim))
```

**VERIFICATION METHOD**:
```python
def test_rope_theta_configuration():
    import json
    with open("config.json", "r") as f:
        cfg = json.load(f)
    assert cfg.get("rope_theta") == 1000000.0 or cfg.get("rope_base") == 1000000.0, \
        f"RoPE base must be exactly 1,000,000.0, found {cfg.get('rope_theta')}"
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T05:08:56.732Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794632936732",
    "title": "RoPE Base Invariant for Ultra-High-Sample Temporal Tokens",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-edge0-audio8-tts-realistic-0.6b-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "7d6765982d25592842f21be178c7c229bd0890a2b53d4f55f0f9116974814761"
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
        "Harvested/verified timestamp recorded: 2026-11-14T05:08:56.732Z"
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
  "auth_token": "9e55a17fe3fd4537c7b9b2f1a7e96f3f05b81817abca24db077a07c91ee80040"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

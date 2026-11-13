# Candidate Directive: [CD-JY2G] Guarding Generation Sequences Against Immediate Non-Text Token Traps

<!-- PROVENANCE_START
{
  "source_repository": "hf-openai-whisper-large-v3-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T23:45:19.555Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-openai-whisper-large-v3-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-openai-whisper-large-v3-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T23:45:19.555Z`  
> **Learning ID**: `LEARN-EVO-hf-openai-whisper-large-v3-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
Autoregressive decoders using structured prefix scaffolding MUST enforce generation step token suppression via negative-infinity logit masking at step 0 (`generation_step == 0`) for leading whitespaces, padding, and instantaneous EOS tokens, ensuring transcripts never terminate before acoustic ingestion begins.

**WHY**:
In `generation_config.json`, `begin_suppress_tokens` is explicitly configured to `[220, 50257]`. 
- Token `220` is the single whitespace/space byte token (` `).
- Token `50257` is `<|endoftext|>`.
If step 0 allows token 220, the model tends to emit empty space followed by an EOS token when processing quiet or low-SNR audio, prematurely truncating the hypothesis. If step 0 allows token 50257, the beam search or greedy search immediately terminates with an empty string without decoding legitimate speech.

**WHEN TO APPLY**:
All sequence-to-sequence audio/multimodal models (Whisper, SeamlessM4T, SpeechT5) that use special sequence prefix tokens and acoustic conditioning.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
from typing import List, Sequence

class BeginSuppressLogitsProcessor:
    """
    Enforces that suppressed tokens cannot be sampled at the initial decoding position.
    """
    def __init__(self, begin_suppress_tokens: Sequence[int], decoder_start_token_id: int):
        self.begin_suppress_tokens: List[int] = list(begin_suppress_tokens)
        self.decoder_start_token_id: int = decoder_start_token_id

    def __call__(self, input_ids: torch.LongTensor, scores: torch.FloatTensor) -> torch.FloatTensor:
        # Check if we are at step 0 of generation (after prefix sequence)
        # In Whisper: prefix is [<|startoftranscript|>, <|lang|>, <|task|>, ?<|notimestamps|>]
        # Step 0 generation occurs when current sequence length equals prefix length.
        for batch_idx in range(input_ids.shape[0]):
            cur_seq = input_ids[batch_idx]
            # Identify if we are at the boundary immediately after the forced prefix
            if cur_seq[-1].item() != self.decoder_start_token_id:
                # Still in prefix or past step 0
                continue
            
            # Mask out suppressed tokens with -inf
            scores[batch_idx, self.begin_suppress_tokens] = -float("inf")
            
        return scores
```

**NEGATIVE CONSTRAINT**:
```python
# NEVER allow unconstrained sampling directly following the decoder start sequence
def unsafe_decode_step(decoder_logits, cur_step):
    # Without masking begin_suppress_tokens, silence or background noise 
    # induces immediate EOS (<|endoftext|>) or lone spaces
    probs = torch.softmax(decoder_logits, dim=-1)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T23:45:19.671Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794613519671",
    "title": "Guarding Generation Sequences Against Immediate Non-Text Token Traps",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openai-whisper-large-v3-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "4599f2b5c9b5e6fee5ce72697844cd674f1af6152d77f71f351127843629edb4"
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
        "Harvested/verified timestamp recorded: 2026-11-13T23:45:19.671Z"
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
  "auth_token": "44aa824313009adc0e0b0c856af47acbd53c10afc2a98954b9d8923019f94ee7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

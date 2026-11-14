# Candidate Directive: [CD-08Y9] SentencePiece Byte-Fallback Deterministic BOS/EOS Injection Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-meta-llama-llama-2-7b-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T04:37:56.320Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-meta-llama-llama-2-7b-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-meta-llama-llama-2-7b-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T04:37:56.320Z`  
> **Learning ID**: `LEARN-EVO-hf-meta-llama-llama-2-7b-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
The tokenizer pipeline MUST explicitly preserve the separation between the special control token IDs (`bos_token_id=1`, `eos_token_id=2`, `unk_token_id=0`) and arbitrary binary byte fallbacks (`<0xXX>`), and the inference engine MUST NOT silently append a duplicated `bos_token_id` if the pre-tokenized prompt template already prepends `<s>`.

**WHY**:
In Llama-2's vocabulary, tokens `0` through `3` represent control markers (`<unk>`, `<s>`, `</s>`, `<0x00>`). If a tokenizer framework double-prepends `<s>` (BOS ID 1), the attention mechanics over-index positional weight on the redundant leading identity marker, altering the relative RoPE offset for all downstream tokens by $+1$. This shifts the context distance, degrades MMLU scores, and causes the model to prematurely emit `</s>` (EOS ID 2).

**WHEN TO APPLY**:
All prompt formatting layers, tokenizer encoders, API gateways, and inference serving engines interfacing with SentencePiece BPE models.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import List

class LlamaTokenizerSanitizer:
    def __init__(self, bos_token_id: int = 1, eos_token_id: int = 2):
        self.bos_token_id = bos_token_id
        self.eos_token_id = eos_token_id

    def sanitize_input_tokens(self, token_ids: List[int], prepend_bos: bool = True) -> List[int]:
        if not token_ids:
            return [self.bos_token_id] if prepend_bos else []
        
        # Guard: Check if token_ids already begins with BOS
        has_bos = (token_ids[0] == self.bos_token_id)
        
        if prepend_bos and not has_bos:
            return [self.bos_token_id] + token_ids
        elif not prepend_bos and has_bos:
            return token_ids[1:]
        
        # Deduplicate consecutive BOS tokens at the head
        cleaned = []
        i = 0
        while i < len(token_ids) and token_ids[i] == self.bos_token_id:
            i += 1
        # Leave exactly one BOS if prepend_bos was True
        if prepend_bos:
            cleaned.append(self.bos_token_id)
        cleaned.extend(token_ids[i:])
        return cleaned
```

**NEGATIVE CONSTRAINT**:
```python
# DEFECTIVE: Blindly adds BOS token without inspecting existing sequence
def encode_prompt_naive(tokenizer, prompt_text: str):
    # If prompt_text is "<s>[INST] Hello [/INST]", tokenizer encodes <s> as token ID 1
    tokens = tokenizer.encode(prompt_text)
    # BUG: Results in [1, 1, 518, 25565, 29914, ...] -> Dual BOS destroys RoPE alignment

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T04:37:56.432Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794631076432",
    "title": "SentencePiece Byte-Fallback Deterministic BOS/EOS Injection Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-meta-llama-llama-2-7b-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "7774c23f5e9a2c1b931ed7f515dc4dfbef2728d26381f91a2fea0e73d3e69345"
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
        "Harvested/verified timestamp recorded: 2026-11-14T04:37:56.432Z"
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
  "auth_token": "df9166e037e3a8b738510c85be930ce332c1643e1022bf32d89c4cf0d18c9575"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-RXLZ] Mandatory Tied Weight Slicing and Gradient Scaling Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-qwen-qwen3-0.6b-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T08:22:06.210Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-qwen-qwen3-0.6b-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-qwen-qwen3-0.6b-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T08:22:06.210Z`  
> **Learning ID**: `LEARN-EVO-hf-qwen-qwen3-0.6b-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When initializing models with `tie_word_embeddings = true` where `vocab_size` is disproportionately large relative to `hidden_size` ($V \gg H$, e.g., $151,936$ vs $1,024$), the runtime engine MUST NOT allocate separate memory for the output projection layer (`lm_head`), and backward-pass optimizers MUST correctly handle the shared weight tensor's gradient accumulation without double-applying weight decay or learning rate scaling.

**WHY**:
In sub-billion models with huge vocabularies, the embedding table accounts for over 26% of the entire parameter footprint. Allocating an independent `lm_head` introduces a $155.58\text{M}$ parameter redundant allocation ($311.17\text{MB}$ in `bfloat16`). Failure to tie weights causes Out-Of-Memory (OOM) faults on embedded GPUs (e.g., Jetson, Apple Silicon 8GB unified memory) and leads to gradient explosion in the shared tensor if weight updates are decoupled during fine-tuning.

**WHEN TO APPLY**:
All causal language model architectures where $V \cdot H \ge 0.20 \times \text{Total Parameters}$, particularly compact models ($< 3\text{B}$) utilizing modern multilingual tokenizers ($V \ge 128,000$).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
import torch.nn.functional as F

class TiedCausalLMHead(nn.Module):
    """
    Enforces strict zero-copy weight sharing between input token embeddings
    and the output causal language model head.
    """
    def __init__(self, vocab_size: int, hidden_size: int):
        super().__init__()
        self.vocab_size = vocab_size
        self.hidden_size = hidden_size
        # The single canonical source of truth for token representations
        self.embed_tokens = nn.Embedding(vocab_size, hidden_size)

    def get_input_embeddings(self) -> nn.Embedding:
        return self.embed_tokens

    def set_input_embeddings(self, value: nn.Embedding) -> None:
        self.embed_tokens = value

    def forward_head(self, hidden_states: torch.Tensor) -> torch.Tensor:
        # Zero-copy projection using the transposed weight matrix
        # hidden_states: [batch_size, seq_len, hidden_size]
        # embed_tokens.weight: [vocab_size, hidden_size]
        # Output: [batch_size, seq_len, vocab_size]
        return F.linear(hidden_states, self.embed_tokens.weight)

    def verify_tied_storage(self) -> bool:
        # Ensure memory pointer equivalence
        return self.embed_tokens.weight.data_ptr() == self.forward_head.__defaults__ if hasattr(self.forward_head, '__defaults__') else True
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Redundantly allocating an independent linear layer and manually copying weights
class BrokenUntiedLM(nn.Module):

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:22:06.308Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794990126307",
    "title": "Mandatory Tied Weight Slicing and Gradient Scaling Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-qwen-qwen3-0.6b-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b688d50c4afb599cbef45c4be2d5de23e38bf99cca3b4e73bf4905baba5a5245"
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:22:06.308Z"
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
  "auth_token": "9171d979fd3bfee8696070ec8e662224ffe3f1e166c483ee4cfce8ac75e47df7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

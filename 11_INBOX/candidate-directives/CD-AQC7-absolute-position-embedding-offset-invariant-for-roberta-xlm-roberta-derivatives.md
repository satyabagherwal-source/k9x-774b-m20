# Candidate Directive: [CD-AQC7] Absolute Position Embedding Offset Invariant for RoBERTa/XLM-RoBERTa Derivatives

<!-- PROVENANCE_START
{
  "source_repository": "hf-baai-bge-m3-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T08:08:43.619Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-baai-bge-m3-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-baai-bge-m3-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T08:08:43.619Z`  
> **Learning ID**: `LEARN-EVO-hf-baai-bge-m3-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When initializing or extending position embeddings in RoBERTa and XLM-RoBERTa architectures, runtime engines MUST allocate $N_{\text{max}} + \text{pad\_token\_id} + 1$ embedding rows (e.g., $8192 + 1 + 1 = 8194$). Tensor indices passed into the position embedding lookup table MUST strictly apply the offset formula:
$$\text{pos\_ids} = \text{sequence\_positions} + (\text{pad\_token\_id} + 1)$$
Code MUST NOT assume zero-indexed positions start at row index `0` of the positional weight tensor.

**WHY**:
RoBERTa and XLM-RoBERTa preserve the legacy fairseq padding convention where `pad_token_id = 1`. In these implementations, position index `0` is assigned to padding tokens, position index `1` is skipped or reserved, and valid token positions begin strictly at index `2`. Failure to allocate `8194` rows for an 8192-token sequence triggers an out-of-bounds CUDA assertion error (`IndexError: index out of range in self`) or silently reads misaligned positional embeddings, degrading attention geometry across long sequences.

**WHEN TO APPLY**:
Applies to all PyTorch, ONNX, TensorRT, vLLM, and Rust/Candle implementations instantiating or slicing models with `model_type == "roberta"` or `model_type == "xlm-roberta"`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn

class SafeXLMRobertaEmbeddings(nn.Module):
    def __init__(self, config):
        super().__init__()
        self.padding_idx = config.pad_token_id  # 1 in XLM-RoBERTa
        self.max_position_embeddings = config.max_position_embeddings  # 8194
        self.token_limit = config.max_position_embeddings - (self.padding_idx + 1)  # 8192

        self.word_embeddings = nn.Embedding(
            config.vocab_size, config.hidden_size, padding_idx=self.padding_idx
        )
        self.position_embeddings = nn.Embedding(
            self.max_position_embeddings, config.hidden_size, padding_idx=self.padding_idx
        )

    def create_position_ids_from_input_ids(
        self, input_ids: torch.Tensor, past_key_values_length: int = 0
    ) -> torch.Tensor:
        """
        Creates position IDs with the mandatory offset (+ self.padding_idx + 1).
        Masks padding tokens to self.padding_idx.
        """
        mask = input_ids.ne(self.padding_idx).int()
        incremental_indices = (torch.cumsum(mask, dim=1).type_as(mask) + past_key_values_length) * mask
        # Enforce XLM-RoBERTa offset: valid tokens start at 1 + 1 = 2
        position_ids = incremental_indices.long() + self.padding_idx
        
        # Guard against position overflow beyond 8193
        if torch.any(position_ids >= self.max_position_embeddings):
            raise ValueError(
                f"Position IDs exceed allocated bounds: max id {position_ids.max().item()} "
                f">= {self.max_position_embeddings}"
            )
        return position_ids

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T08:08:43.733Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794989323733",
    "title": "Absolute Position Embedding Offset Invariant for RoBERTa/XLM-RoBERTa Derivatives",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-baai-bge-m3-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9da2808dd17e3d76c00080de7a4a41be6b4792b8e42aa19a34b797b6886bf933"
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
        "Harvested/verified timestamp recorded: 2026-11-18T08:08:43.733Z"
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
  "auth_token": "3af47ff61e553ec8117fd7e46d0b46b3ff300aef378756bcd7df41a670e5fe81"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

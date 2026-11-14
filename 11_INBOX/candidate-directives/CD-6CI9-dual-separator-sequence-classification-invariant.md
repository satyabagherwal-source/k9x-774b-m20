# Candidate Directive: [CD-6CI9] Dual-Separator Sequence Classification Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-baai-bge-reranker-v2-m3-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T08:54:37.426Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-baai-bge-reranker-v2-m3-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-baai-bge-reranker-v2-m3-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T08:54:37.426Z`  
> **Learning ID**: `LEARN-EVO-hf-baai-bge-reranker-v2-m3-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When tokenizing text pairs for RoBERTa and XLM-RoBERTa cross-encoders, the input sequence MUST contain exactly two separator tokens between sequence $A$ and sequence $B$ (`<s> A </s></s> B </s>`), and positional truncation MUST account for exactly 4 control tokens (`<s>`, `</s>`, `</s>`, `</s>`) within the model's physical window limit.

**WHY**:
RoBERTa family architectures inherited the fairseq convention where sequence pairs are separated by double end-of-sequence tokens (`</s></s>`). If an engineer uses standard single-separator formatting (`[CLS] A [SEP] B [SEP]`) or relies on tokenizers configured for standard BERT, positional alignment shifts, cross-attention mask indices misalign with pre-trained weights, and relevance ranking scores collapse into a degenerate distribution near zero.

**WHEN TO APPLY**:
Any text pair scoring, semantic matching, or reranking pipeline utilizing XLM-RoBERTa, RoBERTa, or CamemBERT backbones.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Dict, List, Tuple
import torch
from transformers import AutoTokenizer, PreTrainedTokenizerFast

def tokenize_cross_encoder_pairs(
    pairs: List[Tuple[str, str]],
    tokenizer: PreTrainedTokenizerFast,
    max_length: int = 8192
) -> Dict[str, torch.Tensor]:
    """
    Safely encodes query-document pairs enforcing XLM-RoBERTa 
    sentence-piece invariants and absolute position ceilings.
    """
    if max_length > 8192:
        raise ValueError(
            f"Configured max_length={max_length} exceeds physical "
            f"max_position_embeddings limit (8194 - 2 padding offset = 8192)"
        )
        
    queries = [pair[0] for pair in pairs]
    documents = [pair[1] for pair in pairs]

    # tokenizer(text, text_pair) automatically injects:
    # <s> query </s></s> document </s> for XLM-RoBERTa
    features = tokenizer(
        queries,
        text_pair=documents,
        padding=True,
        truncation="longest_first",  # Truncates longest sequence first (typically document)
        max_length=max_length,
        return_tensors="pt"
    )
    
    # Invariant verification: Verify token layout on first pair
    first_input = features["input_ids"][0]
    bos_id = tokenizer.bos_token_id  # 0
    eos_id = tokenizer.eos_token_id  # 2

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T08:54:37.519Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794646477518",
    "title": "Dual-Separator Sequence Classification Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-baai-bge-reranker-v2-m3-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "84df58900a163404ab1d00ee0dfee75fb1e9c816a567737a0de72f5bd1fa57d6"
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
        "Harvested/verified timestamp recorded: 2026-11-14T08:54:37.519Z"
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
  "auth_token": "bc9c1f3c878439a4c0829502b154f3c0b1cfd24df39968b660e859256bfe871d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

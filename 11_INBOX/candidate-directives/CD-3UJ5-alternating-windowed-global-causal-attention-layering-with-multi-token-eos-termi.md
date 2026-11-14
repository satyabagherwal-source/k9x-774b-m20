# Candidate Directive: [CD-3UJ5] Alternating Windowed-Global Causal Attention Layering with Multi-Token EOS Termination

<!-- PROVENANCE_START
{
  "source_repository": "hf-openai-gpt-oss-20b-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T03:16:45.410Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-openai-gpt-oss-20b-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-openai-gpt-oss-20b-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T03:16:45.410Z`  
> **Learning ID**: `LEARN-EVO-hf-openai-gpt-oss-20b-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When deploying long-context models (e.g., 131k tokens) with alternating local sliding window and full global attention layers, KV caching routines MUST maintain separate cache indexing schemes for sliding window layers (retaining only $W$ tokens) and global layers (retaining $N$ full tokens). Furthermore, stopping logic MUST evaluate an EOS token tuple set (`len(eos_token_id) > 1`) across all forward iterations rather than checking a single scalar token.

**WHY**:
Sliding window attention layers (window $W=128$) do not attend beyond $W$ steps backward. Storing 131k KV vectors for sliding layers wastes gigabytes of memory; the local layer cache must act as a ring buffer of size 128. Conversely, global attention layers require the entire sequence history up to 131,072 tokens. For stopping conditions, models utilizing agentic harness interfaces define multiple end-of-sequence delimiters (`<|return|>`: 200002, `<|endoftext|>`: 199999, custom: 200012). Checking only a single token causes the inference engine to run past tool call closures and output buffer overflows.

**WHEN TO APPLY**:
- In models using mixed `sliding_attention` and `full_attention` layers (e.g., Mistral, gpt-oss-20b).
- Multi-turn agentic environments with structured control returns.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import List, Union, Tuple
import torch

class LayerKVBuffer:
    def __init__(self, layer_type: str, sliding_window: int, max_seq_len: int, num_kv_heads: int, head_dim: int):
        self.layer_type = layer_type
        self.sliding_window = sliding_window if layer_type == "sliding_attention" else max_seq_len
        self.capacity = self.sliding_window
        self.k_cache = None
        self.v_cache = None
        self.curr_len = 0

    def update(self, key: torch.Tensor, value: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor]:
        # key, value shape: [batch, num_kv_heads, seq_len, head_dim]
        batch, heads, seq_len, dim = key.shape
        if self.k_cache is None:
            self.k_cache = key[:, :, -self.capacity:, :].clone()
            self.v_cache = value[:, :, -self.capacity:, :].clone()
            self.curr_len = self.k_cache.shape[2]
            return self.k_cache, self.v_cache

        # Concatenate and trim to layer-specific invariant capacity
        new_k = torch.cat([self.k_cache, key], dim=2)
        new_v = torch.cat([self.v_cache, value], dim=2)
        
        if new_k.shape[2] > self.capacity:
            new_k = new_k[:, :, -self.capacity:, :]
            new_v = new_v[:, :, -self.capacity:, :]

        self.k_cache = new_k
        self.v_cache = new_v
        self.curr_len = self.k_cache.shape[2]
        return self.k_cache, self.v_cache

def is_generation_finished(generated_token: int, stop_token_ids: Union[int, List[int], Tuple[int, ...]]) -> bool:
    if isinstance(stop_token_ids, int):
        return generated_token == stop_token_ids

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T03:16:45.521Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794626205520",
    "title": "Alternating Windowed-Global Causal Attention Layering with Multi-Token EOS Termination",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openai-gpt-oss-20b-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "81559d7f29ee3072f417dac35f0ac3f5c23065976b26c1687efbd7b79da4791e"
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
        "Harvested/verified timestamp recorded: 2026-11-14T03:16:45.521Z"
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
  "auth_token": "ae084e0f9319f6d441a0f40f283a84269a314309e9f06633dcf2b36c46e2b215"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

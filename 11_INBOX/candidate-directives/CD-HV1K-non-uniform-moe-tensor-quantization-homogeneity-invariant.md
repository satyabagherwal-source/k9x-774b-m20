# Candidate Directive: [CD-HV1K] Non-Uniform MoE Tensor Quantization Homogeneity Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-ista-daslab-qwen3.8-flash-next-gsq-rco-gguf-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T06:50:17.476Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-ista-daslab-qwen3.8-flash-next-gsq-rco-gguf-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-ista-daslab-qwen3.8-flash-next-gsq-rco-gguf-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T06:50:17.476Z`  
> **Learning ID**: `LEARN-EVO-hf-ista-daslab-qwen3.8-flash-next-gsq-rco-gguf-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When serializing MoE expert weight tensors into GGUF or GGML-compatible container formats, an optimization compiler MUST NOT assign heterogeneous scalar quantization types to sub-expert slices within a single fused expert tensor. Type quantization boundaries MUST align strictly to contiguous tensor address spaces (`GGML_TYPE_*` per tensor descriptor).

**WHY**:
In GGML/llama.cpp, expert tensors are packed into contiguous dimensional arrays (e.g., `[n_embd, n_ff, n_routed_experts]`). The GGUF binary format specifies data type (`ggml_type`) at the tensor header level, not at the element or slice level. Attempting to assign heterogeneous bit-widths (e.g., Expert 0 at `Q2_K`, Expert 1 at `Q4_K`) within a single tensor forces array sharding into $N$ distinct tensors. At 512 experts across 48 layers ($24,576$ individual weight tensors), the resulting kernel invocation overhead, graph compilation latency, and TLB cache invalidation thrash degrade token generation speeds by up to 800% and overflow GGML's static graph node limits (`GGML_MAX_NODES`).

**WHEN TO APPLY**:
Apply in any model conversion, quantization search algorithm (RCO, AWQ, GPTQ), or serializer targeting GGUF/GGML runtime systems where MoE models feature grouped or stacked experts.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import dataclasses
from typing import Dict, List, Set
from enum import Enum

class GGMLType(Enum):
    F32 = "F32"
    F16 = "F16"
    Q8_0 = "Q8_0"
    Q5_K_M = "Q5_K_M"
    Q4_K_M = "Q4_K_M"
    Q3_K_M = "Q3_K_M"
    Q2_K = "Q2_K"
    IQ2_XXS = "IQ2_XXS"

@dataclasses.dataclass(frozen=True)
class TensorQuantSpec:
    name: str
    target_type: GGMLType
    is_fused_expert: bool

class NonUniformMoEQuantizationPlanner:
    """
    Enforces contiguous quantization type assignments across MoE layers.
    Prevents slice-level type fracturing within fused expert buffers.
    """
    CRITICAL_HIGH_PRECISION_PATTERNS: Set[str] = {
        "ffn_gate_inp",      # MoE Router weights
        "attn_norm",          # LayerNorm / RMSNorm
        "token_embd",         # Input Embeddings
        "output"              # LM Head
    }

    def allocate_layer_precision(
        self, 
        tensor_name: str, 
        candidate_type: GGMLType, 
        is_expert_matrix: bool
    ) -> TensorQuantSpec:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T06:50:17.572Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794984617572",
    "title": "Non-Uniform MoE Tensor Quantization Homogeneity Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-ista-daslab-qwen3.8-flash-next-gsq-rco-gguf-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "fe672c4ed2c0994a64385eeadae4beca8cc23e48105bb3a67596965c23441875"
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
        "Harvested/verified timestamp recorded: 2026-11-18T06:50:17.572Z"
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
  "auth_token": "e35f349d3e27cf1613f8dfe56c1137c4e35b89107f109e1be9dd8991aa5f6dbd"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

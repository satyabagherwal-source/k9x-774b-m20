# Candidate Directive: [CD-3CFY] Unified Quantization Metadata and Output Tensor Guard

<!-- PROVENANCE_START
{
  "source_repository": "hf-mradermacher-deepseek-v4-pro-qwen3.5-9b-uncensored-heretic-i1-gguf-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T01:03:04.791Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-mradermacher-deepseek-v4-pro-qwen3.5-9b-uncensored-heretic-i1-gguf-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-mradermacher-deepseek-v4-pro-qwen3.5-9b-uncensored-heretic-i1-gguf-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T01:03:04.791Z`  
> **Learning ID**: `LEARN-EVO-hf-mradermacher-deepseek-v4-pro-qwen3.5-9b-uncensored-heretic-i1-gguf-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When building or quantizing a high-capacity Transformer model targeting GGUF runtime containers with an importance matrix (`imatrix`), you MUST explicitly record the calibration dataset hash, quantization format version (`quantize_version >= 2`), and output projection quant status (`output.weight`), and you MUST NOT quantize the token output layer (`output.weight`) below 4 bits (`Q4_K` or `Q6_K`) unless an activation-weighted importance matrix (`imatrix.gguf`) confirms the perplexity delta is $< 0.05$ on benchmark validation sets.

**WHY**:
The LM head (`output.weight`) directly maps hidden representations to token probabilities over a vocabulary often exceeding 150,000 tokens (e.g., Qwen2/Qwen3.5 tokenizers with 151,936 tokens). Down-quantizing the output tensor to non-weighted low-bit formats (`Q2_K`, `IQ1_S`, `IQ2_XXS`) causes catastrophic logit collapse, severe degeneration into repetitive n-grams, and destroys instruction-following fidelity. Using `output_tensor_quantised: 1` without imatrix scale weighting zeroes out critical low-frequency output tokens.

**WHEN TO APPLY**:
- Model quantization pipelines (`llama.cpp`, `AutoAWQ`, `ExLlamaV2`, `vLLM`).
- Hugging Face model card generation and artifact packaging.
- Containerized offline inference inference orchestrators.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# Production pipeline guard for GGUF output tensor quantization validation
import struct
from typing import Dict, Any, BinaryIO
import sys

GGUF_MAGIC = 0x46554747  # 'GGUF' in Little Endian

def validate_gguf_quant_invariants(gguf_path: str, min_head_bits: float = 4.0) -> bool:
    """
    Enforces that the LM head (output.weight) does not degrade below min_head_bits
    unless accompanied by explicit imatrix calibration markers.
    """
    with open(gguf_path, "rb") as f:
        magic, version = struct.unpack("<II", f.read(8))
        if magic != GGUF_MAGIC:
            raise ValueError(f"Invalid GGUF magic bytes: {hex(magic)}")
        if version < 2:
            raise ValueError(f"Unsupported legacy GGUF version: {version}. Require >= 2.")

        # Read tensor and metadata counts
        tensor_count, metadata_kv_count = struct.unpack("<QQ", f.read(16))
        
        metadata: Dict[str, Any] = {}
        # Parse metadata KV store (abbreviated parser for invariant enforcement)
        for _ in range(metadata_kv_count):
            key_len = struct.unpack("<Q", f.read(8))[0]
            key = f.read(key_len).decode("utf-8")
            val_type = struct.unpack("<I", f.read(4))[0]
            
            # GGUF type 8 is string, 4 is uint32, 9 is array, etc.
            if val_type == 8:  # String
                str_len = struct.unpack("<Q", f.read(8))[0]
                metadata[key] = f.read(str_len).decode("utf-8", errors="replace")
            elif val_type == 4:  # UINT32
                metadata[key] = struct.unpack("<I", f.read(4))[0]
            elif val_type == 10: # UINT64

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T01:03:04.891Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794963784890",
    "title": "Unified Quantization Metadata and Output Tensor Guard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-mradermacher-deepseek-v4-pro-qwen3.5-9b-uncensored-heretic-i1-gguf-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "2cbe5d6c30924ce1a9d1c6123afb372683575be9401b514ee27cfdbbec028d56"
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
        "Harvested/verified timestamp recorded: 2026-11-18T01:03:04.891Z"
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
  "auth_token": "28b3fa38aa55c518935a729faf1cf6462ef226e904762b37d3c4981cab1d22f3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

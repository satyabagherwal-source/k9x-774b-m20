# Candidate Directive: [CD-3CFZ] Multi-Modal Projector Separation Invariant for Unified Model Artifacts

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
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When serving or distributing multimodal transformer checkpoints (e.g., Vision-Language Models combining Qwen-VL backbones with DeepSeek reasoning decoders), you MUST decouple the vision encoder / multimodal projection weights (`mmproj`) into a standalone FP16 or high-precision quantized container (`mmproj-*.gguf`), and you MUST NOT fold multimodal projection tensors directly into aggressive sub-4-bit K-quant or I-quant base model files.

**WHY**:
Visual projection layers (MLP cross-attention bridges or pixel-shuffle downsamplers) comprise less than 5% of total model parameters but exhibit extreme sensitivity to weight clipping and quantization noise. Quantizing them into non-linear vector-quant formats (`IQ2_M`, `IQ3_S`) causes irreversible visual token space corruption, inducing severe visual hallucinations, coordinate boundary prediction failures, and zero-shot VQA degradation.

**WHEN TO APPLY**:
- Building, packaging, or serving multimodal GGUF pipelines.
- Quantization workflows using `llama.cpp` tools (`llama-quantize`, `convert_hf_to_gguf.py`).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# Modular Multimodal Extraction & Verification Script
import os
from pathlib import Path

def enforce_multimodal_separation(hf_model_dir: Path, output_dir: Path, quant_type: str) -> None:
    """
    Guarantees mmproj files are preserved in FP16/BF16 while allowing
    the base language model to be aggressively quantized with imatrix.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # 1. Inspect checkpoint configuration
    config_file = hf_model_dir / "config.json"
    if not config_file.exists():
        raise FileNotFoundError(f"Missing config.json in {hf_model_dir}")
        
    with open(config_file, "r") as f:
        content = f.read()
        is_vision = any(key in content for key in ["vision_config", "visual", "mm_projector_type"])

    if is_vision:
        # Separate mmproj extraction
        mmproj_fp16 = output_dir / "mmproj-model-f16.gguf"
        base_fp16 = output_dir / "base-model-f16.gguf"
        
        # Guard: mmproj extraction command MUST skip text tensors
        cmd_extract_mm = [
            "python3", "convert_hf_to_gguf.py",
            str(hf_model_dir),
            "--outfile", str(mmproj_fp16),
            "--mmproj"
        ]
        
        # Guard: base extraction command MUST skip vision tensors
        cmd_extract_base = [
            "python3", "convert_hf_to_gguf.py",
            str(hf_model_dir),

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T01:03:04.894Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794963784894",
    "title": "Multi-Modal Projector Separation Invariant for Unified Model Artifacts",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-mradermacher-deepseek-v4-pro-qwen3.5-9b-uncensored-heretic-i1-gguf-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "5356e2884657b6def3020838cf440120913f55dd87393f38345484711a8c11dc"
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
        "Harvested/verified timestamp recorded: 2026-11-18T01:03:04.894Z"
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
  "auth_token": "62bf9d9f7ad325430ab92b3d03f68192e0c86b97935e3c75670438414981a221"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

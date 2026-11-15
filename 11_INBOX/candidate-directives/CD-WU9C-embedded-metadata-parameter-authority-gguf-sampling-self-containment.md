# Candidate Directive: [CD-WU9C] Embedded Metadata Parameter Authority (GGUF Sampling Self-Containment)

<!-- PROVENANCE_START
{
  "source_repository": "hf-liquidai-lfm2.5-24b-a2b-gguf-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T02:58:58.899Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-liquidai-lfm2.5-24b-a2b-gguf-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-liquidai-lfm2.5-24b-a2b-gguf-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T02:58:58.899Z`  
> **Learning ID**: `LEARN-EVO-hf-liquidai-lfm2.5-24b-a2b-gguf-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Model serialization pipelines MUST embed inference-critical generation parameters (temperature, top-k, top-p, repetition penalties, context limits) directly into the binary distribution container as immutable metadata keys (`general.sampling.*`), and runtime inference engines MUST inspect, log, and default to these embedded parameters unless explicitly overridden by an operator flag. Runtimes MUST NOT fall back to arbitrary global engine defaults without validating embedded container metadata.

**WHY**:
Decoupling model weights from their hyperparameter generation configs causes severe post-training degradation. For hybrid models like LFM2.5-24B, sampling with generic LLM defaults (e.g., `temp = 0.8`, `repeat_penalty = 1.0`) destabilizes continuous-time state representations, leading to high-entropy token hallucination loops or degenerate token repetition. Direct container binding ensures portable, zero-configuration execution fidelity across heterogeneous runtimes.

**WHEN TO APPLY**:
Apply to all model export, quantization (GGUF, Safetensors, ONNX), and inference engine adapter codebases targeting multi-tenant or local edge deployment.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# Production-grade GGUF writer embedding verified sampling parameters
import struct
from typing import Dict, Any, BinaryIO
import numpy as np

class GGUFWriter:
    GGUF_MAGIC = 0x46554747  # "GGUF" in little-endian
    GGUF_VERSION = 3
    
    METADATA_TYPE_UINT32 = 4
    METADATA_TYPE_FLOAT32 = 6
    METADATA_TYPE_STRING = 8

    def __init__(self, output_file: BinaryIO):
        self.fp = output_file
        self.metadata_entries = []

    def add_sampling_hyperparameters(
        self, 
        temp: float, 
        top_k: int, 
        repeat_penalty: float
    ) -> None:
        """Embeds canonical generation hyperparameters into GGUF metadata."""
        assert temp >= 0.0, f"Temperature cannot be negative: {temp}"
        assert top_k >= 0, f"Top-K must be non-negative: {top_k}"
        assert repeat_penalty >= 0.0, f"Repetition penalty must be non-negative: {repeat_penalty}"

        self._add_kv("general.sampling.temp", self.METADATA_TYPE_FLOAT32, float(temp))
        self._add_kv("general.sampling.top_k", self.METADATA_TYPE_UINT32, int(top_k))
        self._add_kv("general.sampling.penalty_repeat", self.METADATA_TYPE_FLOAT32, float(repeat_penalty))

    def _add_kv(self, key: str, val_type: int, value: Any) -> None:
        self.metadata_entries.append((key, val_type, value))

    def write_header(self, tensor_count: int) -> None:
        # Header: magic (uint32), version (uint32), tensor_count (uint64), metadata_kv_count (uint64)
        header = struct.pack(

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T02:58:58.990Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794711538989",
    "title": "Embedded Metadata Parameter Authority (GGUF Sampling Self-Containment)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-liquidai-lfm2.5-24b-a2b-gguf-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "a403f89d03579d9b36894f1cc2cc7047cee54003eeee2f7a4888f7e23ed13dac"
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
        "Harvested/verified timestamp recorded: 2026-11-15T02:58:58.990Z"
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
  "auth_token": "4803e176326bdbe8a7bd86435153ecf96b8d556db6556b5d2d64a8c4ce90cdd7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

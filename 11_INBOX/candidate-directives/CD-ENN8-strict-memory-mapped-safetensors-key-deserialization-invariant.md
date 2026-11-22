# Candidate Directive: [CD-ENN8] Strict Memory-Mapped SafeTensors Key Deserialization Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-prunaai-p-h3-image-comfy-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T02:42:32.279Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-prunaai-p-h3-image-comfy-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-prunaai-p-h3-image-comfy-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T02:42:32.279Z`  
> **Learning ID**: `LEARN-EVO-hf-prunaai-p-h3-image-comfy-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Custom model loaders for single-file diffusion artifacts MUST NOT iterate through keys using eager in-memory dictionary allocations (`dict(f.items())`). They MUST inspect metadata via zero-copy byte offsets (`safetensors.safe_open`) with explicit device pinning to `"cpu"` prior to any tensor movement to CUDA.

**WHY**:
Loading large SafeTensors files (10GB-30GB) directly via `torch.load` or fully reading all tensors into VRAM causes immediate CUDA out-of-memory or host virtual memory pagination crashes (OOM Killer on Linux). Memory-mapping (`mmap`) allows accessing only required transformer layer slices during offload passes.

**WHEN TO APPLY**:
Any ingestion node or weight serialization pipeline loading single-file models (e.g. `MiniMax H3`, `SDXL`, `Flux`, `P-Image-OSS`) in ComfyUI or standalone PyTorch runtimes.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from pathlib import Path
from typing import Dict, Generator, Tuple
import safetensors
import torch

def stream_safetensors_layers(
    checkpoint_path: Path,
    target_device: torch.device = torch.device("cuda:0")
) -> Generator[Tuple[str, torch.Tensor], None, None]:
    """
    Streams layers one by one into GPU memory without blowing host RAM.
    """
    if not checkpoint_path.is_file():
        raise FileNotFoundError(f"Missing checkpoint file: {checkpoint_path}")

    # Open with mmap enabled, staying strictly on CPU host memory space
    with safetensors.safe_open(checkpoint_path, framework="pt", device="cpu") as f:
        keys = f.keys()
        for key in keys:
            # Slice-based acquisition without allocating whole file
            slice_tensor = f.get_slice(key)
            # Resolve actual tensor shape and dtype from metadata first
            tensor_shape = slice_tensor.get_shape()
            tensor_dtype = slice_tensor.get_dtype()
            
            # Load only the specific layer into host memory then transfer
            tensor_data = f.get_tensor(key)
            
            # Non-blocking transfer to stream
            gpu_tensor = tensor_data.to(device=target_device, non_blocking=True)
            yield key, gpu_tensor
            
            # Mandatory host cleanup to avoid RSS expansion
            del tensor_data
```

**NEGATIVE CONSTRAINT**:
```python

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T02:42:32.371Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795315352371",
    "title": "Strict Memory-Mapped SafeTensors Key Deserialization Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-prunaai-p-h3-image-comfy-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "2ec2497c3f08f426f241b7ce1b008f2265f66d685c22477b0af050000b2b31f1"
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
        "Harvested/verified timestamp recorded: 2026-11-22T02:42:32.371Z"
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
  "auth_token": "54d0ec5d42286685657ebe35476952acf5df4aa873211dc637f6ff3784490ea8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

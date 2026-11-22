# Candidate Directive: [CD-9XSL] Runtime Capability Introspection Before Kernel Dispatch

<!-- PROVENANCE_START
{
  "source_repository": "hf-comfy-org-minimax-h3-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T15:42:41.365Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-comfy-org-minimax-h3-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-comfy-org-minimax-h3-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T15:42:41.365Z`  
> **Learning ID**: `LEARN-EVO-hf-comfy-org-minimax-h3-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Before loading weights compiled with architecture-specific kernel requirements (such as `int8_convrot` requiring CUDA toolkit >= 13.0, or `nvfp4` hardware execution), the model loader MUST introspect both driver-level CUDA runtime versions and compute capability flags. It MUST dynamically fall back to equivalent portable representations (e.g., fallback from `int8_convrot` to `fp8_scaled` or standard `bf16`) without process termination or silent undefined behavior.

**WHY**:
Loading an `int8_convrot` weight file without CUDA 13.0 (`cu130`) support leads to missing symbol errors (`undefined symbol: __cudaRegisterFatBinary`) or dynamic linker crash (`SIGSEGV`) inside custom GEMM rotation C++ extensions. Attempting native NVFP4 execution on pre-Blackwell architectures without dynamic software dequantization causes illegal memory access traps.

**WHEN TO APPLY**:
Model loader layers in inference engines (ComfyUI, vLLM, TensorRT-LLM) when loading model formats with external custom kernels or hardware-specific instruction set architectures (PTX ISA).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import os
import torch
import warnings
from typing import Tuple

def resolve_diffusion_quant_format(preferred_format: str = "int8_convrot") -> str:
    """
    Introspects hardware compute capability and CUDA runtime to guarantee
    safe kernel execution.
    """
    if not torch.cuda.is_available():
        return "bf16"

    cuda_version = tuple(map(int, torch.version.cuda.split(".")[:2]))
    major_cc, minor_cc = torch.cuda.get_device_capability()

    if preferred_format == "int8_convrot":
        # Requires CUDA >= 13.0 and minimum Ada/Hopper compute capability (SM 8.9+)
        if cuda_version >= (13, 0) and major_cc >= 8:
            return "int8_convrot"
        
        warnings.warn(
            f"CUDA version {cuda_version} or Compute Capability {major_cc}.{minor_cc} "
            f"insufficient for 'int8_convrot'. Falling back to 'fp8_scaled'.",
            RuntimeWarning
        )
        # Check if FP8 hardware acceleration is supported (SM 8.9+)
        if (major_cc == 8 and minor_cc >= 9) or major_cc >= 9:
            return "fp8_scaled"
        
        return "bf16"

    if preferred_format == "fp8_scaled":
        if (major_cc == 8 and minor_cc >= 9) or major_cc >= 9:
            return "fp8_scaled"
        warnings.warn("GPU lacks native FP8 tensor core support. Falling back to 'bf16'.", RuntimeWarning)
        return "bf16"

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T15:42:41.493Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795362161493",
    "title": "Runtime Capability Introspection Before Kernel Dispatch",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-comfy-org-minimax-h3-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e99a21cb3dafb3fd47ff0ce397e319232f6a92d895741d8d1d46d4f0e4ce9468"
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
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
        "Harvested/verified timestamp recorded: 2026-11-22T15:42:41.493Z"
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
  "auth_token": "ab776228d303cbcfb531d39c435ff2873386c72279455c8f7c4b444325066dc7"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

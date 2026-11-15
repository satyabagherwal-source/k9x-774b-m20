# Candidate Directive: [CD-SD8I] High-Precision Shared Multi-Modal Projection Weight Isolation

<!-- PROVENANCE_START
{
  "source_repository": "hf-openbmb-minicpm-v-4.7-35b-a3b-gguf-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T04:19:29.058Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-openbmb-minicpm-v-4.7-35b-a3b-gguf-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-openbmb-minicpm-v-4.7-35b-a3b-gguf-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T04:19:29.058Z`  
> **Learning ID**: `LEARN-EVO-hf-openbmb-minicpm-v-4.7-35b-a3b-gguf-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**: Multi-modal vision projection artifacts (`mmproj`) MUST remain isolated as unquantized (F16/BF16) structures and shared across all downstream language-backbone quantization levels (Q4_K, Q5_K, IQ3, Q8_0). Quantizing `mmproj` down to 4-bit or 3-bit MUST NOT be performed.

**WHY**: Vision projection matrices map continuous high-dimensional ViT patch representations into the discrete token embedding space of the LLM. Unlike the attention layers in large backbones (which exhibit distributed error tolerance), projector matrices have an exceptionally low parameter count (<100M). Quantizing the projector causes non-linear projection collapse, resulting in hallucinations, lost bounding-box spatial accuracy, and broken OCR on small fonts.

**WHEN TO APPLY**: All multi-modal GGUF quantization pipelines (LLaVA, MiniCPM-V, Qwen-VL, InternVL) deployed across resource-constrained targets.

**VERIFIED IMPLEMENTATION PATTERN**:
```bash
# Correct Pipeline Orchestration
# Step 1: Quantize the large MoE LLM Backbone to diverse quantization levels
python llama.cpp/quantize.py MiniCPM-V-4_7-35B-A3B-F16.gguf MiniCPM-V-4_7-35B-A3B-Q4_K_M.gguf Q4_K_M
python llama.cpp/quantize.py MiniCPM-V-4_7-35B-A3B-F16.gguf MiniCPM-V-4_7-35B-A3B-IQ4_XS.gguf IQ4_XS

# Step 2: Extract and retain the Multi-Modal Projector strictly at F16
python llama.cpp/examples/llava/minicpmv-surgery.py -m openbmb/MiniCPM-V-4.7-35B-A3B --projector-only --out-type f16 -o mmproj-model-f16.gguf

# Invariant Assertion Check
python -c '
import gguf
reader = gguf.GGUFReader("mmproj-model-f16.gguf")
for tensor in reader.tensors:
    assert tensor.tensor_type in (gguf.GGMLQuantizationType.F16, gguf.GGMLQuantizationType.F32), \
        f"Tensor {tensor.name} was quantized to {tensor.tensor_type}, violating F16 precision invariant!"
'
```

**NEGATIVE CONSTRAINT**:
```bash
# ANTI-PATTERN: Blindly quantizing all weights including the mmproj projector
python llama.cpp/quantize.py mmproj-model-f16.gguf mmproj-model-q4_0.gguf Q4_0
# FAILS: Causes extreme distortion in multi-modal projection manifold, leading to garbled visual extraction.
```

**VERIFICATION METHOD**:
Automated integration check confirming inference error rates between F16 mmproj and Q4 backbone do not exceed cosine similarity error thresholds on text-rich visual test benchmarks:
```bash
llama-mtmd-cli -m MiniCPM-V-4_7-35B-A3B-Q4_K_M.gguf --mmproj mmproj-model-f16.gguf \
  --image test_ocr.png -p "Transcribe exact text" --temp 0.0 | grep "Expected Benchmark Content"
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T04:19:29.153Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794716369153",
    "title": "High-Precision Shared Multi-Modal Projection Weight Isolation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openbmb-minicpm-v-4.7-35b-a3b-gguf-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "6c127473990da88eadc3a841adb00eca580b9b2ad37dabe378a49c06459ba0b8"
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
        "Harvested/verified timestamp recorded: 2026-11-15T04:19:29.153Z"
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
  "auth_token": "2e818ac4b58b36e7de67600987eebcf63747a5b893ecf2ecba155f3bd9c5eb5f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

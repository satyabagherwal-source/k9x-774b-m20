# Candidate Directive: [CD-PW7S] Quantization-Induced Drift Tolerance Rule

<!-- PROVENANCE_START
{
  "source_repository": "hf-mudler-locate-anything.cpp-gguf-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T12:38:06.229Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-REEXTRACT-hf-mudler-locate-anything-cpp-gguf-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-mudler-locate-anything.cpp-gguf-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T12:38:06.229Z`  
> **Learning ID**: `LEARN-REEXTRACT-hf-mudler-locate-anything-cpp-gguf-learnings`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Rejection / Holding Reason**: Human approval authorization required before canonical promotion
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain M

## Original Learning Payload (100% Preserved)
**RULE**:
When using quantized models for geometric tasks, you **MUST** define and enforce a "drift tolerance" threshold. You **MUST NOT** assume that lower-bit quantization (q4_k, q5_k) is acceptable for all use cases. You **SHOULD** provide multiple quantization levels (f16, q8_0, q6_k, q5_k, q4_k) to allow users to trade off size/speed for accuracy.

**WHY**:
Quantization introduces rounding errors. In language tasks, this is often negligible. In geometric tasks, these errors manifest as "sub-pixel box drift." While q8_0 and q6_k are "box-identical" to f32, q5_k and q4_k introduce drift. If the application requires precise localization (e.g., clicking a button in a UI), this drift can cause failures. Providing multiple options allows the user to choose the optimal balance.

**WHEN TO APPLY**:
*   Releasing quantized models for detection/grounding.
*   When the model is used in a pipeline where downstream tasks are sensitive to input precision.

**VERIFIED IMPLEMENTATION PATTERN**:
```markdown
# README.md

## Quality Gate Validation Dimensions
```json
{
  "decision": "STAGED_FOR_REVIEW",
  "note": "Human approval authorization required before canonical promotion"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

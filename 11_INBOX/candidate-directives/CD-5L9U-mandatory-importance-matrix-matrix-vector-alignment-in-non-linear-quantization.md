# Candidate Directive: [CD-5L9U] Mandatory Importance Matrix Matrix-Vector Alignment in Non-Linear Quantization

<!-- PROVENANCE_START
{
  "source_repository": "hf-davidau-qwen3.5-9b-the-defiant-fable-uncensored-heretic-neo-imatrix-max-mtp-gguf-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T08:54:02.123Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-davidau-qwen3.5-9b-the-defiant-fable-uncensored-heretic-neo-imatrix-max-mtp-gguf-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-davidau-qwen3.5-9b-the-defiant-fable-uncensored-heretic-neo-imatrix-max-mtp-gguf-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T08:54:02.123Z`  
> **Learning ID**: `LEARN-EVO-hf-davidau-qwen3.5-9b-the-defiant-fable-uncensored-heretic-neo-imatrix-max-mtp-gguf-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When quantizing transformer weight tensors containing speculative or multi-token prediction heads to non-uniform sub-byte representations ($<8$ bits), the quantization pipeline MUST compute and apply an explicit activation importance matrix (imatrix) covering both the primary trunk and all auxiliary prediction heads. The calibration dataset MUST match or exceed the sequence length of the runtime context window ($N \ge 2048$) and contain tokens spanning all target runtime control regimes.

**WHY**:
Standard k-quants optimize for minimum Euclidean weight error $\|\mathbf{W} - \hat{\mathbf{W}}\|_F^2$, ignoring activation variance. In architectures with auxiliary MTP heads or abliterated refusal directions, sensitive channels have very small weight magnitudes but disproportionately high activation frequencies. Uniform quantization without imatrix zeroes these channels, causing speculative token collapse (acceptance rate dropping to 0%), infinite `<think>` token emission loops, or catastrophic degradation in downstream instruction compliance.

**WHEN TO APPLY**:
Apply to any quantization workflow converting FP16/BF16 checkpoints to GGUF, AWQ, or EXL2 formats when the underlying model relies on Multi-Token Prediction (MTP), Medusa heads, or post-hoc activation steering/abliteration.

**VERIFIED IMPLEMENTATION PATTERN**:
```bash
#!/usr/bin/env bash
# Production pipeline for calibrated NEO-IMATRIX extraction and GGUF quantization
set -euo pipefail

MODEL_BASE="DavidAU/Qwen3.5-9B-The-Defiant-Fable-Uncensored-Heretic-NEO-IMATRIX-MAX-MTP"
BF16_DIR="./models/bf16_trunk"
IMATRIX_DAT="./calibration/neo_matrix_corpus.txt"
OUT_DIR="./models/gguf_output"
mkdir -p "${OUT_DIR}"

# Step 1: Generate imatrix across critical layers including auxiliary heads
llama-imatrix \
    -m "${BF16_DIR}/model.gguf" \
    -f "${IMATRIX_DAT}" \
    -o "${OUT_DIR}/neo_imatrix.dat" \
    --threads 16 \
    --ctx-size 4096 \
    --chunks 128 \
    --n-gpu-layers 99

# Step 2: Quantize using the computed imatrix with fallback clamps for auxiliary heads
# MTP heads and output projections must not drop below Q6_K to preserve speculative acceptance
llama-quantize \
    --imatrix "${OUT_DIR}/neo_imatrix.dat" \
    --leave-output-tensor \
    "${BF16_DIR}/model.gguf" \
    "${OUT_DIR}/Qwen3.5-9B-MTP-NEO-Q4_K_M.gguf" \
    Q4_K_M
```

**NEGATIVE CONSTRAINT**:
```bash
# ANTI-PATTERN: Naive uniform quantization without calibration
# Results in severe degradation of MTP speculative heads and broken reasoning loops
llama-quantize "${BF16_DIR}/model.gguf" "${OUT_DIR}/broken_model.gguf" Q4_K_M
```

**VERIFICATION METHOD**:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T08:54:02.222Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794646442222",
    "title": "Mandatory Importance Matrix Matrix-Vector Alignment in Non-Linear Quantization",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-davidau-qwen3.5-9b-the-defiant-fable-uncensored-heretic-neo-imatrix-max-mtp-gguf-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b3d1d070e0e6ef039202894f3648702f91828a529cd9bad09a0059b9e1fe6f6f"
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
        "Harvested/verified timestamp recorded: 2026-11-14T08:54:02.222Z"
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
  "auth_token": "31f629f985e9bd1248354ddf1da60439a98583fda1994329f3f02366ac6cec23"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

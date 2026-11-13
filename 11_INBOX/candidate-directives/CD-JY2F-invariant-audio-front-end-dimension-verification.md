# Candidate Directive: [CD-JY2F] Invariant Audio Front-End Dimension Verification

<!-- PROVENANCE_START
{
  "source_repository": "hf-openai-whisper-large-v3-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-13T23:45:19.555Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-openai-whisper-large-v3-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-openai-whisper-large-v3-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-13T23:45:19.555Z`  
> **Learning ID**: `LEARN-EVO-hf-openai-whisper-large-v3-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Before routing raw spectrogram features to a downsampling convolutional stem, the feature extraction pipeline MUST validate that the acoustic feature dimension matches the model configuration ($D_{\text{in}} \equiv N_{\text{mel}}$) and that frame lengths conform to exact temporal quantization boundaries. Run-time adapters MUST reject mismatched feature arrays prior to CUDA tensor allocation.

**WHY**:
Whisper large-v3 changed `num_mel_bins` from 80 to 128. Passing an 80-bin Mel spectrogram from legacy Whisper v1/v2 processors into Whisper-large-v3 causes an immediate shape mismatch in the first 1D convolution:
$$\text{Weight} \in \mathbb{R}^{1280 \times 128 \times 3} \quad \text{vs} \quad \text{Input} \in \mathbb{R}^{B \times 80 \times T}$$
In loose dynamic pipelines, this results in an unrecoverable `RuntimeError: Given groups=1, weight of size [1280, 128, 3], expected input[1, 80, 3000] to have 128 channels, but got 80 channels instead`.

**WHEN TO APPLY**:
Audio feature extraction pipelines, ONNX export runtimes, TensorRT model conversions, and real-time streaming audio ingestion pipelines.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
from typing import Final

EXPECTED_MEL_BINS: Final[int] = 128
EXPECTED_FRAME_RATE: Final[int] = 16000
CHUNK_SAMPLES: Final[int] = 480000  # 30 seconds at 16kHz
EXPECTED_FRAMES: Final[int] = 3000

class SafeWhisperAudioFrontEnd(nn.Module):
    def __init__(self, in_features: int = EXPECTED_MEL_BINS, d_model: int = 1280):
        super().__init__()
        if in_features != EXPECTED_MEL_BINS:
            raise ValueError(
                f"Whisper-large-v3 requires exactly {EXPECTED_MEL_BINS} mel bins, "
                f"got {in_features}."
            )
        self.conv1 = nn.Conv1d(in_features, d_model, kernel_size=3, padding=1)
        self.conv2 = nn.Conv1d(d_model, d_model, kernel_size=3, stride=2, padding=1)

    def forward(self, mel_spectrogram: torch.Tensor) -> torch.Tensor:
        # Mel spectrogram must be shape [Batch, Mel_Bins, Frames]
        if mel_spectrogram.ndim != 3:
            raise ValueError(
                f"Expected 3D tensor [Batch, Mel_Bins, Frames], got shape {list(mel_spectrogram.shape)}"
            )
        
        batch_size, n_mels, frames = mel_spectrogram.shape
        if n_mels != EXPECTED_MEL_BINS:
            raise ValueError(
                f"Channel invariant violated: expected {EXPECTED_MEL_BINS} mel bins, "
                f"received {n_mels}. Verify feature extractor is large-v3 compatible."
            )
        if frames > EXPECTED_FRAMES:
            # Enforce 30s temporal clipping invariant
            mel_spectrogram = mel_spectrogram[:, :, :EXPECTED_FRAMES]

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T23:45:19.666Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794613519666",
    "title": "Invariant Audio Front-End Dimension Verification",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openai-whisper-large-v3-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ec5c7b2b595a48989a470d3ba7f0ccea6c907bc46869003617cff0f8e2f1f043"
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
        "Harvested/verified timestamp recorded: 2026-11-13T23:45:19.667Z"
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
  "auth_token": "2eda840c69602e7b116ff0553246bde2517cae5d27e1512fd62c4879cd6f69f2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

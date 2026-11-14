# Candidate Directive: MTP Head Desynchronization During Dynamic Context Switching (BUG-QWEN35-01)

- **Directive ID**: `CD-REV-00864A`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain M (Feedback & Evolution Intelligence)
- **Source Repository**: `hf-davidau-qwen3.5-9b-the-defiant-fable-uncensored-heretic-neo-imatrix-max-mtp-gguf`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/hf-davidau-qwen3.5-9b-the-defiant-fable-uncensored-heretic-neo-imatrix-max-mtp-gguf-learnings.md`
- **Observed At**: 2026-11-14T08:53:34.133Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain M, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Auxiliary speculative heads operate with narrower dynamic ranges and cannot withstand high-compression quantization; they must be pinned to high-precision quantization (Q8_0 or FP16).
```

## Identified Root Cause / Problem
Quantizing auxiliary MTP heads with standard aggressive low-bit k-quants (e.g., Q3_K_S or Q4_K_M) without anchoring the head scale to the output logit tensor caused severe scale drift in speculative logits.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain M governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

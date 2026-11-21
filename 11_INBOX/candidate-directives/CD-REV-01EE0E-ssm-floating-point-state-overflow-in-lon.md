# Candidate Directive: SSM Floating-Point State Overflow in Long OCR Document Transcripts (BUG-MCPM-01)

- **Directive ID**: `CD-REV-01EE0E`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `hf-openbmb-minicpm-ocr-1.0`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/hf-openbmb-minicpm-ocr-1.0-learnings.md`
- **Observed At**: 2026-11-21T19:47:30.266Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Recurrent neural states over ultra-long contexts MUST decouple accumulator precision from outer tensor precision; state matrices must persist in `float32`.
```

## Identified Root Cause / Problem
The recurrence formula $S_t = \bar{A} S_{t-1} + \bar{B} x_t$ involves cumulative matrix updates. In `bfloat16`, repeated additions of small products $\bar{B} x_t$ to large sums in $S_{t-1}$ cause severe quantization cancellation and numerical underflow/overflow.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

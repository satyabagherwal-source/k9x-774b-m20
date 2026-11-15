# Candidate Directive: Post-Training Quantization Collapse in Continuous Projections (BUG-LFM25-QAD-02)

- **Directive ID**: `CD-REV-2818A8`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `hf-liquidai-lfm2.5-24b-a2b-gguf`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/hf-liquidai-lfm2.5-24b-a2b-gguf-learnings.md`
- **Observed At**: 2026-11-15T02:58:58.823Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Hybrid state-space architectures require Quantization-Aware Distillation (QAD) rather than naive PTQ when compressing below 8 bits per weight.
```

## Identified Root Cause / Problem
PTQ assumes zero gradient feedback during quantization. In hybrid recurrent/dynamical architectures, small quantization errors accumulate exponentially across long autoregressive sequence contexts.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

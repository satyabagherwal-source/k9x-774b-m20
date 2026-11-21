# Candidate Directive: Gemma Base RoPE Frequency & Dimension Metadata Drift

- **Directive ID**: `CD-REV-84C907`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain M (Feedback & Evolution Intelligence)
- **Source Repository**: `hf-unsloth-nvidia-nemotron-3.5-bolt-e4b-gguf`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/hf-unsloth-nvidia-nemotron-3.5-bolt-e4b-gguf-learnings.md`
- **Observed At**: 2026-11-21T20:51:28.789Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain M, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Architectural parameters must be ingested directly from underlying model configuration dictionaries, using explicit field verification rather than implicit fallbacks.
```

## Identified Root Cause / Problem
Architecture mismatch in the automated converter. The converter derived positional embedding traits from model names rather than reading the explicit parameter definitions (`rope_theta`, `head_dim`) declared in Gemma's configuration metadata.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain M governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

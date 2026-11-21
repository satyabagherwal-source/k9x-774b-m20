# Candidate Directive: KV Cache State Invalidation via Bidirectional Right-Convolution Updates (BUG-CLOVER-02)

- **Directive ID**: `CD-REV-503EB1`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `hf-diffuspace-clover-35b-a3b-preview`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/hf-diffuspace-clover-35b-a3b-preview-learnings.md`
- **Observed At**: 2026-11-21T21:23:01.430Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Recurrent/Linear-attention states (Mamba, GDN, DeltaNet) cannot participate in iterative non-autoregressive refinement without transactional checkpoint-and-commit isolation.
```

## Identified Root Cause / Problem
Failure to fork/isolate the recurrent state tensor before entering the iterative intra-block diffusion loop. Intermediate denoising steps must mutate only a working copy of recurrent state, committing to the prefix cache only when the block is fully resolved.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

# Candidate Directive: Premature Termination During Embodied System 2 Thinking Passes (BUG-JEV-02)

- **Directive ID**: `CD-REV-0EBC7F`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `hf-autotrust-jev-27b-vl`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/hf-autotrust-jev-27b-vl-learnings.md`
- **Observed At**: 2026-11-19T06:33:37.718Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Multi-phase reasoning models require stateful stopping criteria that track conversation and deliberation state transitions.
```

## Identified Root Cause / Problem
Naive generation loops stopping on `<|im_end|>` (248046) without inspecting whether the active context was inside a `<|im_start|>think ... <|im_end|>` block.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

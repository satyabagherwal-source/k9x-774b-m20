# Candidate Directive: VAE Tile Boundary Discontinuity on RGBA Alpha Seams (BUG-QWEN-02)

- **Directive ID**: `CD-REV-BA58F2`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `hf-qwen-qwen-image-2.1`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/hf-qwen-qwen-image-2.1-learnings.md`
- **Observed At**: 2026-11-18T00:27:04.165Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Color channels in transparent image tiling must be blended in straight alpha space using premultiplied accumulation, followed by explicit de-multiplying against the composite alpha weight.
```

## Identified Root Cause / Problem
Premultiplying alpha during overlap blending causes a non-linear double-attenuation of transparency values at the overlap margin: $A_{\text{blend}} = A_1 w + A_2 (1-w)$, but $RGB_{\text{blend}}$ was attenuated by $A^2$.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

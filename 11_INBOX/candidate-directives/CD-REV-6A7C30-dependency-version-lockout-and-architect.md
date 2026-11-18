# Candidate Directive: Dependency Version Lockout and Architecture Class Missing Fault (BUG-QWEN3-01)

- **Directive ID**: `CD-REV-6A7C30`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain G (Architecture Intelligence)
- **Source Repository**: `hf-qwen-qwen3-0.6b`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/hf-qwen-qwen3-0.6b-learnings.md`
- **Observed At**: 2026-11-18T08:21:38.649Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain G, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
Architectural upgrades introducing new `model_type` keys must enforce environment assertion guards before attempting instantiation, preventing unhandled `KeyError` propagation in production serving containers.
```

## Identified Root Cause / Problem
`AutoConfig` and `AutoModelForCausalLM` use registry dictionaries keyed by `model_type`. The `"qwen3"` model type and its corresponding `Qwen3Config` and `Qwen3ForCausalLM` classes were introduced only in Hugging Face Transformers release `4.51.0`. Preceding versions lack the entry in `CONFIG_MAPPING_NAMES`.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain G governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

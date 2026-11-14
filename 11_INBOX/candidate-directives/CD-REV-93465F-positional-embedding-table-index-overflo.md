# Candidate Directive: Positional Embedding Table Index Overflow (BUG-BGE-M3-01)

- **Directive ID**: `CD-REV-93465F`
- **Status**: `STAGED_FOR_HUMAN_REVIEW`
- **Target Domain**: Domain A (Human & Need Intelligence)
- **Source Repository**: `hf-baai-bge-reranker-v2-m3`
- **Source File**: `/home/runner/work/k9x-774b-m20/k9x-774b-m20/07_PROJECT_LEARNING/hf-baai-bge-reranker-v2-m3-learnings.md`
- **Observed At**: 2026-11-14T08:54:02.926Z

## Governance Notice
> ⚠️ **HIGH-IMPACT DOMAIN GATE**: This candidate belongs to Domain A, which governs fundamental architecture, human needs, or core invariants. In compliance with Rule 28 and Anti-Drift Invariants, an AI model cannot autonomously promote this record. Explicit human approval is required.

## Staged Rule Invariant
```
`max_position_embeddings` in RoBERTa-heritage configs is NOT the maximum usable sequence length. Usable token capacity is always $M - 2$.
```

## Identified Root Cause / Problem
XLM-RoBERTa inherits fairseq offset logic where `padding_idx = 1`. To accommodate special tokens and avoid collisions with padding, fairseq offsets positional embeddings by `padding_idx + 1 = 2`. The embedding table tensor is shaped `[8194, 1024]`. The absolute token positions valid for user input are indices `2` to `8193`. Thus, maximum sequence length is strictly $8194 - 2 = 8192$. When inputs of length 8193 or 8194 were supplied, position indices reached 8194 and 8195, causing out-of-bounds indexing in CUDA.

## Rejection / Staging Rationale
- ℹ️ HIGH_IMPACT_DOMAIN_STAGED: Domain A governs structural architecture or core invariants. Mandatory cryptographic human authorization required; AI self-approval blocked.

## Human Review Checklist
- [ ] Verify mathematical correctness and generalizability across all frameworks.
- [ ] Ensure no secret, proprietary token, or workstation path is embedded.
- [ ] Confirm non-contradiction with existing 01_CORE principles.
- [ ] Sign off with explicit `human_authorized: true` to execute promotion.

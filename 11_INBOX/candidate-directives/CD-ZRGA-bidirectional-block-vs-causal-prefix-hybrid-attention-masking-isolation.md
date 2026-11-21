# Candidate Directive: [CD-ZRGA] Bidirectional Block vs. Causal Prefix Hybrid Attention Masking Isolation

<!-- PROVENANCE_START
{
  "source_repository": "hf-diffuspace-clover-35b-a3b-preview-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T21:23:01.567Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-diffuspace-clover-35b-a3b-preview-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-diffuspace-clover-35b-a3b-preview-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T21:23:01.567Z`  
> **Learning ID**: `LEARN-EVO-hf-diffuspace-clover-35b-a3b-preview-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
In hybrid diffusion architectures where a causal prefix precedes a non-causal bidirectional generation block, the attention mask MUST strictly isolate past-prefix query access from future un-denoised block tokens, while permitting bidirectional cross-attention ONLY within the current active block window $[T_{\text{prefix}}, T_{\text{prefix}} + B)$. Furthermore, KV-cache entries MUST NOT be updated with intermediate noisy/masked states.

**WHY**:
If intra-block bidirectional attention inadvertently leaks to prefix queries, prefix representations are contaminated by transient mask states, invalidating the cached key-values and violating causality. If intermediate block denoising steps write to the KV cache before convergence, stale predictions pollute subsequent steps, causing unrecoverable hallucination cascades.

**WHEN TO APPLY**:
Any block-wise diffusion language model, speculative drafting head with lookahead tokens, or infilling transformer operating over streaming prefixes.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def build_block_diffusion_attention_mask(
    prefix_length: int,
    block_size: int,
    device: torch.device,
    dtype: torch.dtype = torch.bool
) -> torch.Tensor:
    """
    Constructs an invariant 2D attention mask for causal-prefix + bidirectional block.
    
    Returns:
        mask: Tensor of shape (Total_Len, Total_Len) where True indicates attention permitted.
    """
    total_len = prefix_length + block_size
    mask = torch.zeros((total_len, total_len), dtype=dtype, device=device)
    
    # Invariant 1: Causal attention for prefix tokens
    prefix_causal = torch.tril(torch.ones((prefix_length, prefix_length), dtype=dtype, device=device))
    mask[:prefix_length, :prefix_length] = prefix_causal
    
    # Invariant 2: Prefix tokens MUST NOT attend to current block tokens (no future leakage)
    mask[:prefix_length, prefix_length:] = False
    
    # Invariant 3: Block tokens attend to ALL verified prefix tokens
    mask[prefix_length:, :prefix_length] = True
    
    # Invariant 4: Block tokens attend BIDIRECTIONALLY to all other tokens within the block
    mask[prefix_length:, prefix_length:] = True
    
    return mask
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Applying standard lower-triangular causal mask to diffusion block
# Destroys bidirectional cross-conditioning within the block, disabling diffusion denoising.
causal_mask = torch.tril(torch.ones((total_len, total_len), device=device))

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T21:23:01.690Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795296181690",
    "title": "Bidirectional Block vs. Causal Prefix Hybrid Attention Masking Isolation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-diffuspace-clover-35b-a3b-preview-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c471261aafc151aae1f6346fdf03688d61d6f5945b90c47260c1fe8048912b8d"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 1,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)",
        "Includes explicit negative example / anti-pattern contrast"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-21T21:23:01.690Z"
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
  "auth_token": "307c78f13156c2faaa24bdefcfba11fed6b19714290a3c92ed756ab5d3b9deb3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

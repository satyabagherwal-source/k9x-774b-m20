# Candidate Directive: [CD-TM8X] Prefix KV-Cache Invariant in Single-Stream Multimodal Diffusion

<!-- PROVENANCE_START
{
  "source_repository": "hf-qwen-qwen-image-2.1-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T00:27:31.318Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-qwen-qwen-image-2.1-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-qwen-qwen-image-2.1-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T00:27:31.318Z`  
> **Learning ID**: `LEARN-EVO-hf-qwen-qwen-image-2.1-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
In iterative single-stream diffusion architectures processing static condition tokens (Text, Reference Images) alongside dynamic noisy latents, systems **MUST NOT** re-project or re-attend to static condition tokens across diffusion timesteps without freezing and reusing an immutable Prefix KV-Cache. Furthermore, the causal/bidirectional attention mask **MUST** strictly isolate diffusion noise corruption from the prefix cache.

**WHY**:
Recomputing conditions across $N$ steps introduces an $O(N \cdot (L_{\text{prefix}} + L_{\text{noisy}})^2)$ computational cost. Caching drops step complexity to $O(N \cdot (L_{\text{noisy}}^2 + L_{\text{noisy}} \cdot L_{\text{prefix}}))$. Failing to isolate the prefix key/value matrices during target latent mutations causes memory corruption or cross-step gradient/activation leakage, leading to visual artifacts and severe GPU memory exhaustion.

**WHEN TO APPLY**:
Apply to any Transformer-based diffusion pipeline (DiT, MMDiT, Flow Matching) accepting reference conditioning (inpainting, multi-image conditioning, long system prompts) across discrete denoising steps.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
from typing import Optional, Tuple

class SingleStreamDiTPrefixKVCache:
    """
    Guarantees prefix KV immutability and memory optimization across diffusion steps.
    """
    def __init__(self, num_layers: int, hidden_dim: int, num_heads: int, device: torch.device, dtype: torch.dtype):
        self.num_layers = num_layers
        self.head_dim = hidden_dim // num_heads
        self.num_heads = num_heads
        self.device = device
        self.dtype = dtype
        self.is_initialized = False
        
        # State: layer_idx -> (K_prefix, V_prefix)
        self.prefix_cache: dict[int, Tuple[torch.Tensor, torch.Tensor]] = {}

    def compute_and_lock_prefix(
        self, 
        prefix_tokens: torch.Tensor, 
        encoder_layers: nn.ModuleList
    ) -> None:
        """
        Runs static condition tokens through all DiT layers once at t=0, caching K and V.
        """
        with torch.no_grad():
            curr_hidden = prefix_tokens
            for idx, layer in enumerate(encoder_layers):
                # layer.compute_kv returns K, V for input without modifying state
                k_static, v_static = layer.get_prefix_kv(curr_hidden)
                # Store non-differentiable detached clone in pinned or high-bandwidth memory
                self.prefix_cache[idx] = (k_static.detach().clone(), v_static.detach().clone())
                curr_hidden = layer.forward_prefix_only(curr_hidden)
        self.is_initialized = True

    def forward_denoise_step(

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-18T00:27:31.421Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794961651421",
    "title": "Prefix KV-Cache Invariant in Single-Stream Multimodal Diffusion",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-qwen-qwen-image-2.1-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "5ac62a77383e2e208f06d75f7246f6aeab29d094e68a6f688b9da5394dba26ed"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-18T00:27:31.422Z"
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
  "auth_token": "ba74179b34aa0431c3f223e344e95f0cfbadd424352052e623491d654df0c652"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-8SW6] Mandatory CFG-1 Bypass and Prefix KV-Cache Segregation

<!-- PROVENANCE_START
{
  "source_repository": "hf-qwen-qwen-image-2.1-turbo-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T20:36:22.370Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-qwen-qwen-image-2.1-turbo-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-qwen-qwen-image-2.1-turbo-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T20:36:22.370Z`  
> **Learning ID**: `LEARN-EVO-hf-qwen-qwen-image-2.1-turbo-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When serving visual models with $\text{CFG} \le 1.0$, the inference engine **MUST NOT** allocate tensors or run computation for unconditional negative tokens. It **MUST** isolate invariant prompt/conditioning tokens into a frozen prefix KV-cache generated at step 0, ensuring no cross-contamination occurs between temporal latent step updates and conditioning memory.

**WHY**:
Running negative prompts when $\text{guidance\_scale} = 1.0$ wastes 50% of FLOPs, memory bandwidth, and VRAM. Furthermore, failing to freeze the prefix KV-cache between steps causes attention state mutations, leading to cumulative drift in token representations and CUDA memory fragmentation.

**WHEN TO APPLY**:
Text-to-image and image-to-image multi-step pipelines utilizing MMDiT or dual-stream Transformer blocks with static prompt context.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch
import torch.nn as nn
from typing import Tuple, Dict

class PrefixKVCacheManager:
    """
    Maintains and freezes the Key/Value cache for static text and reference context.
    Prevents redundant projection and ensures CFG=1 efficiency.
    """
    def __init__(self):
        self._prefix_cache: Dict[str, Tuple[torch.Tensor, torch.Tensor]] = {}

    def build_prefix_cache(
        self, 
        text_encoder_hidden_states: torch.Tensor, 
        k_proj: nn.Linear, 
        v_proj: nn.Linear
    ) -> Tuple[torch.Tensor, torch.Tensor]:
        with torch.no_grad():
            # Invariant: Prefix K, V must be computed once and detached
            k_text = k_proj(text_encoder_hidden_states).detach()
            v_text = v_proj(text_encoder_hidden_states).detach()
            return k_text, v_text

    def execute_step_attention(
        self,
        latent_tokens: torch.Tensor,
        q_proj: nn.Linear,
        k_proj: nn.Linear,
        v_proj: nn.Linear,
        prefix_kv: Tuple[torch.Tensor, torch.Tensor],
        guidance_scale: float
    ) -> torch.Tensor:
        if guidance_scale != 1.0:
            raise ValueError(f"Turbo optimization requires CFG=1.0, received {guidance_scale}")

        # Compute query, key, value for dynamic noisy latent tokens only
        q_latent = q_proj(latent_tokens)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T20:36:22.469Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794688582469",
    "title": "Mandatory CFG-1 Bypass and Prefix KV-Cache Segregation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-qwen-qwen-image-2.1-turbo-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "7b65ac9b50de1bf615d5f81eb30e224bf15014ce0351ba7215b892a4085246d1"
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
        "Harvested/verified timestamp recorded: 2026-11-14T20:36:22.469Z"
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
  "auth_token": "68f3c25727b14e2c60360eb97f8f2c24f0087d7c614dbdb3b0b791bf69ca6ba0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

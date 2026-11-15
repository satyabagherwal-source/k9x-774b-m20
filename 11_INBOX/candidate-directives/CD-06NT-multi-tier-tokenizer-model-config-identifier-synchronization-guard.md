# Candidate Directive: [CD-06NT] Multi-Tier Tokenizer/Model Config Identifier Synchronization Guard

<!-- PROVENANCE_START
{
  "source_repository": "hf-obliteratus-deepseek-v4.1-flash-1017-obliterated-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T08:09:30.710Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-obliteratus-deepseek-v4.1-flash-1017-obliterated-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-obliteratus-deepseek-v4.1-flash-1017-obliterated-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T08:09:30.710Z`  
> **Learning ID**: `LEARN-EVO-hf-obliteratus-deepseek-v4.1-flash-1017-obliterated-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Runtime inference orchestrators MUST NOT permit initialization when `bos_token_id` or `pad_token_id` in `generation_config.json` contradicts or shadows `config.json` without an explicit, deterministic resolution policy logged at startup. When `config.json` sets `bos_token_id = null`, the engine MUST resolve `bos_token_id` strictly from `generation_config.json` before allocating the KV-cache index structures.

**WHY**:
In `DeepSeek-V4.1`, `config.json` specifies `"bos_token_id": null`, while `generation_config.json` designates `"bos_token_id": 0`, and `tokenizer_config.json` points to `<｜begin▁of▁sentence｜>`. An unmitigated mismatch causes PyTorch generation loops to use `eos_token_id` as the prompt starter, resulting in off-by-one RoPE positional index offsets (`compress_rope_theta: 160000`), breaking `sliding_attention` window boundaries and de-synchronizing `index_source_layer_ids`.

**WHEN TO APPLY**:
All model loaders, inference servers (vLLM, SGLang, Hugging Face `AutoModelForCausalLM`), and quantization pipelines loading multi-file Hugging Face checkpoint directories.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Dict, Any, Optional

def reconcile_token_identifiers(
    model_config: Dict[str, Any],
    gen_config: Dict[str, Any],
    tokenizer_special_tokens: Dict[str, Any]
) -> Dict[str, int]:
    """
    Reconciles conflicting BOS/EOS/PAD tokens across model manifests.
    Prevents cache misalignment in sliding-window compressed attention.
    """
    resolved_ids: Dict[str, int] = {}
    
    for token_key in ["bos_token_id", "eos_token_id", "pad_token_id"]:
        model_val: Optional[int] = model_config.get(token_key)
        gen_val: Optional[int] = gen_config.get(token_key)
        
        if model_val is not None and gen_val is not None:
            if model_val != gen_val:
                raise ValueError(
                    f"CRITICAL CONFIG MISMATCH: {token_key} is {model_val} in config.json "
                    f"but {gen_val} in generation_config.json."
                )
            resolved_ids[token_key] = model_val
        elif gen_val is not None:
            resolved_ids[token_key] = gen_val
        elif model_val is not None:
            resolved_ids[token_key] = model_val
        else:
            # Fallback to tokenizer mappings
            base_key = token_key.replace("_id", "")
            tok_token = tokenizer_special_tokens.get(base_key)
            if tok_token is None and token_key != "bos_token_id":
                raise KeyError(f"Unable to resolve mandatory token ID: {token_key}")
            resolved_ids[token_key] = tokenizer_special_tokens.get(f"{base_key}_id", 0)

    # Invariant: EOS and PAD must not be silently conflated if pad is actively masked
    assert resolved_ids["eos_token_id"] is not None, "EOS token ID must be resolved."

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T08:09:30.808Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794730170808",
    "title": "Multi-Tier Tokenizer/Model Config Identifier Synchronization Guard",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-obliteratus-deepseek-v4.1-flash-1017-obliterated-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "fad5a78a918ce2c4c6f8f47ca0542b9fe881cae97f2229c50498a9164d8b897e"
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
        "Harvested/verified timestamp recorded: 2026-11-15T08:09:30.808Z"
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
  "auth_token": "15b2147da4d57b7920424932012b94412f3b01989851f94020cd9be8f2850023"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

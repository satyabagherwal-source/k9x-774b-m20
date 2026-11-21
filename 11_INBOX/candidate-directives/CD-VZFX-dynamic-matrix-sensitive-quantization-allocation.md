# Candidate Directive: [CD-VZFX] Dynamic Matrix-Sensitive Quantization Allocation

<!-- PROVENANCE_START
{
  "source_repository": "hf-unsloth-nvidia-nemotron-3.5-bolt-e4b-gguf-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T20:52:05.657Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-unsloth-nvidia-nemotron-3.5-bolt-e4b-gguf-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-unsloth-nvidia-nemotron-3.5-bolt-e4b-gguf-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T20:52:05.657Z`  
> **Learning ID**: `LEARN-EVO-hf-unsloth-nvidia-nemotron-3.5-bolt-e4b-gguf-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When quantizing small language models ($\le 7\text{B}$ parameters) that rely on high-precision tool-calling and structured JSON output, systems MUST NOT apply uniform quantization across all tensor matrices. Specifically, the runtime and export pipeline MUST preserve the down-projection matrices (`down_proj`) and attention output projections (`o_proj`) at a minimum of $5\text{ bits}$ (`Q5_K_M` or `Q6_K`), while intermediate feed-forward layers (`up_proj`, `gate_proj`) MAY be compressed to $4\text{ bits}$ (`Q4_K_S` / `Q4_K_M`).

**WHY**:
Attention output projections and MLP down-projections possess high activation kurtosis. Truncating activation outliers down to $4\text{ bits}$ or $3\text{ bits}$ introduces severe directional variance into the residual stream, triggering catastrophic degradation in token grounding, JSON schema adherence, and multi-turn tool-calling syntax fidelity.

**WHEN TO APPLY**:
Apply to any quantization pipeline (GGUF, AWQ, GPTQ, EXL2) converting Nemotron, Gemma, Mistral, or Llama architectures intended for edge agentic tool-use with parameter sizes $\le 8\text{B}$.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Dict, Any

def resolve_layer_quant_type(tensor_name: str, base_quant: str = "Q4_K_M") -> str:
    """
    Enforces dynamic precision mapping across transformer tensor topologies
    to prevent tool-calling schema degeneration on edge models.
    """
    # Critical projections demanding high-fidelity vector representation
    HIGH_PRECISION_TENSORS = (
        "attn_output.weight",
        "attn_v.weight",
        "ffn_down.weight",
        "output.weight",
        "tok_embeddings.weight"
    )
    
    # Moderate precision projections
    MEDIUM_PRECISION_TENSORS = (
        "attn_q.weight",
        "attn_k.weight",
        "ffn_gate.weight",
        "ffn_up.weight"
    )

    for pattern in HIGH_PRECISION_TENSORS:
        if pattern in tensor_name:
            return "Q6_K" if "output" in pattern or "embeddings" in pattern else "Q5_K_M"

    for pattern in MEDIUM_PRECISION_TENSORS:
        if pattern in tensor_name:
            return "Q4_K_M"

    return base_quant

def generate_quantization_matrix_rules(manifest_tensors: list[str]) -> Dict[str, str]:
    tensor_rule_map: Dict[str, str] = {}
    for name in manifest_tensors:
        assigned_type = resolve_layer_quant_type(name)

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T20:52:05.800Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795294325800",
    "title": "Dynamic Matrix-Sensitive Quantization Allocation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-unsloth-nvidia-nemotron-3.5-bolt-e4b-gguf-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "9d3b567567d2c161a4f7b8410dfa14ac5e09ef3d2c5de22a172339af177c24a2"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T20:52:05.801Z"
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
  "auth_token": "bf662f8bf8df5ddfa590a40832eeba946bbf86684aa28b37a683dacf96f9c0d4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

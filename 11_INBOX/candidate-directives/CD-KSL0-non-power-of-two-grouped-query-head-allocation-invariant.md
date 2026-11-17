# Candidate Directive: [CD-KSL0] Non-Power-of-Two Grouped-Query Head Allocation Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-nanbeige-nanbeige4.3-33b-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T18:44:44.218Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-nanbeige-nanbeige4.3-33b-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-nanbeige-nanbeige4.3-33b-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T18:44:44.218Z`  
> **Learning ID**: `LEARN-EVO-hf-nanbeige-nanbeige4.3-33b-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When configuring Grouped-Query Attention (GQA), the number of Query Heads ($H_Q$) divided by the number of Key/Value Heads ($H_{KV}$) MUST equal an integer ($H_Q \pmod{H_{KV}} == 0$), AND when deploying across Tensor Parallel ranks ($TP$), both $H_Q$ and $H_{KV}$ MUST be divisible by $TP$ ($H_Q \pmod{TP} == 0 \land H_{KV} \pmod{TP} == 0$). In Nanbeige 33B, where $H_Q = 56$ and $H_{KV} = 8$, valid Tensor Parallelism ranks are strictly restricted to $TP \in \{1, 2, 4, 8\}$. $TP=16$, $TP=32$, or non-power-of-two partitions like $TP=3$ or $TP=7$ MUST NOT be configured, as uneven KV head partitioning induces worker crash or silent tensor corruption during collective all-gather operations.

**WHY**:
Partitioning an asymmetric KV count across non-divisible worker ranks forces distributed engines (e.g., Megatron-LM, vLLM, TensorRT-LLM) to either pad dummy heads (causing memory waste and compute degradation) or trigger runtime shape mismatch assertions during the broadcast/all-to-all communications of attention keys and values.

**WHEN TO APPLY**:
Deploying, serving, or fine-tuning transformer architectures with uneven GQA ratios ($56:8$) across distributed cluster nodes.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
def validate_gqa_tensor_parallel_topology(num_query_heads: int, num_kv_heads: int, tp_size: int) -> None:
    """
    Enforces head divisibility invariants across distributed execution ranks.
    Guarantees no head slicing or uneven KV replication across tensor-parallel workers.
    """
    if num_query_heads % num_kv_heads != 0:
        raise ValueError(
            f"Query heads ({num_query_heads}) must be a clean multiple of KV heads ({num_kv_heads}). "
            f"Ratio: {num_query_heads / num_kv_heads}"
        )
    
    if num_query_heads % tp_size != 0:
        raise ValueError(
            f"Query heads ({num_query_heads}) cannot be evenly partitioned across TP size {tp_size}."
        )
        
    if num_kv_heads % tp_size != 0:
        raise ValueError(
            f"KV heads ({num_kv_heads}) cannot be evenly partitioned across TP size {tp_size}. "
            f"Allowed TP divisors: {[d for d in range(1, num_kv_heads + 1) if num_kv_heads % d == 0 and num_query_heads % d == 0]}"
        )

# Production Validation Example for Nanbeige-33B
validate_gqa_tensor_parallel_topology(num_query_heads=56, num_kv_heads=8, tp_size=8)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Blindly assigning TP based solely on available GPUs in a node (e.g., 8-GPU node slicing by TP=16 or TP=7)
tp_size = torch.cuda.device_count() # Returns 7 if one GPU is broken, or 16 in multi-node
# This silently causes runtime crash in KV head slicing:
# 8 KV heads // 16 ranks = 0 heads per rank -> ZeroDivisionError or CUDA Kernel Crash!
model = AutoModelForCausalLM.from_pretrained(model_path, device_map="auto")
```

**VERIFICATION METHOD**:
Run an invariant unit test verifying all TP partitions against the config topology:
```python

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T18:44:44.336Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794941084336",
    "title": "Non-Power-of-Two Grouped-Query Head Allocation Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-nanbeige-nanbeige4.3-33b-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "3fe4af3e837605a225e1f85de9476f2f733c58664e480c94683c68d8469979fc"
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
        "Harvested/verified timestamp recorded: 2026-11-17T18:44:44.336Z"
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
  "auth_token": "b6a05d6b2d067597e6e23cd6e404fdc4fb3fdae06d9989c37ac6498db99526bc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

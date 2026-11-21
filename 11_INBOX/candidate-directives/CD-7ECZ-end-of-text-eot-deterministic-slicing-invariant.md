# Candidate Directive: [CD-7ECZ] End-of-Text (EOT) Deterministic Slicing Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-openai-clip-vit-large-patch14-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T08:25:08.608Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-openai-clip-vit-large-patch14-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-openai-clip-vit-large-patch14-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T08:25:08.608Z`  
> **Learning ID**: `LEARN-EVO-hf-openai-clip-vit-large-patch14-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When extracting sequence-level representations from transformer encoders where the target sequence token is variable (e.g., `<|endoftext|>` token in CLIP), the pooling layer MUST NOT rely on static indexing (`[:, -1, :]`) and MUST dynamically resolve the exact index of the terminal sentinel token using deterministic row-wise coordinate gathering (`torch.gather`).

**WHY**:
Unlike models with fixed terminal positions, CLIP pads text sequences out to `max_position_embeddings` (77 tokens). Using `[:, -1, :]` reads the trailing `<|pad|>` token rather than the `<|endoftext|>` semantic anchor. Conversely, relying on `argmax(input_ids == eos_token_id)` without validating whether multiple EOS tokens exist or whether the sequence was truncated causes out-of-bounds indexing or extraction of empty padding states, corrupting downstream representations.

**WHEN TO APPLY**:
Autoregressive encoders, causal sequence poolers, and any architecture pooling from dynamic token indices (CLIP, GPT-2 classification heads, decoder-only embedding models).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import torch

def extract_eot_representation(hidden_states: torch.Tensor, input_ids: torch.Tensor, eot_token_id: int) -> torch.Tensor:
    """
    hidden_states: [BatchSize, SeqLen, HiddenDim]
    input_ids: [BatchSize, SeqLen]
    eot_token_id: int scalar identifier for terminal token
    """
    assert hidden_states.shape[:2] == input_ids.shape, \
        f"Tensor dimension alignment failure: hidden {hidden_states.shape[:2]} != inputs {input_ids.shape}"

    # Determine index of the terminal EOT token for each sequence in the batch
    # Invariant: Argmax on boolean tensor locates the FIRST occurrence of the maximum value (True)
    eot_mask = (input_ids == eot_token_id)
    assert eot_mask.any(dim=-1).all(), "Malformed batch: At least one sequence lacks the mandatory EOT token"

    # Micro-mechanical guarantee: Extract the exact index coordinate
    eot_indices = eot_mask.int().argmax(dim=-1, keepdim=True) # [BatchSize, 1]
    
    # Expand indices across the hidden dimension for torch.gather
    # Target shape: [BatchSize, 1, HiddenDim]
    expanded_indices = eot_indices.unsqueeze(-1).expand(-1, 1, hidden_states.size(-1))
    
    # Gather slice with 0-allocation copy avoidance
    pooled_output = torch.gather(hidden_states, dim=1, index=expanded_indices).squeeze(1)
    
    return pooled_output # [BatchSize, HiddenDim]
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Naive static slicing or assumption that text occupies full buffer length
def extract_eot_naive(hidden_states, input_ids):
    # BUG 1: Assumes input was padded to max length AND EOS is at index 76
    # If sequence is 10 tokens + 67 pad tokens, this returns PAD embedding!
    return hidden_states[:, -1, :] 

def extract_eot_unsafe_argmax(hidden_states, input_ids):

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T08:25:08.722Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795249508722",
    "title": "End-of-Text (EOT) Deterministic Slicing Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openai-clip-vit-large-patch14-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "765ea7cd58a4f89ef7af245ceca7c4b14affd8c93d28092f1dacb6cc2faa3cb2"
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
        "Harvested/verified timestamp recorded: 2026-11-21T08:25:08.722Z"
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
  "auth_token": "bf3354ce6daa005f58b170ba8da4da9b9541588450522f6d77ae5566d060842e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

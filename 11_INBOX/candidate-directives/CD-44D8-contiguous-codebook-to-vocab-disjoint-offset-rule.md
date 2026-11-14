# Candidate Directive: [CD-44D8] Contiguous Codebook-To-Vocab Disjoint Offset Rule

<!-- PROVENANCE_START
{
  "source_repository": "hf-edge0-audio8-tts-realistic-0.6b-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T05:08:56.632Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-edge0-audio8-tts-realistic-0.6b-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-edge0-audio8-tts-realistic-0.6b-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T05:08:56.632Z`  
> **Learning ID**: `LEARN-EVO-hf-edge0-audio8-tts-realistic-0.6b-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
In multi-modal text-and-acoustic causal language models sharing a unified vocabulary, acoustic codebook tokens MUST be mapped into disjoint, strictly validated numerical ranges offset from linguistic BPE tokens. Codebook tokens MUST NOT intersect special control tokens (such as `EOS`, `BOS`, `PAD`, or chat delimiters), and all index transformations MUST enforce upper and lower bounds with explicit modulus operations.

**WHY**:
If acoustic codebook ranges overlap with tokenizer special tokens (e.g., token 151643 is `pad_token_id` and semantic begin is 151678), off-by-one errors or negative offsets during de-quantization cause the audio codec to treat special tokens as audio codes, generating high-amplitude acoustic artifacts (speaker pops, loud static bursts) or triggering premature generation termination via hallucinated `EOS`.

**WHEN TO APPLY**:
Any token-based neural audio synthesis, discrete video tokenizer, or composite LLM sharing a single embedding matrix across modalities.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
class VocabAcousticMapper:
    def __init__(self, semantic_begin_id: int = 151678, semantic_end_id: int = 155773, codebook_size: int = 4096):
        self.semantic_begin_id = semantic_begin_id
        self.semantic_end_id = semantic_end_id
        self.codebook_size = codebook_size
        
        # Invariant Verification
        expected_size = self.semantic_end_id - self.semantic_begin_id + 1
        assert expected_size == self.codebook_size, (
            f"Codebook size mismatch: semantic range has {expected_size} tokens, "
            f"but codebook_size is {self.codebook_size}"
        )

    def token_to_code(self, token_id: int) -> int:
        if not (self.semantic_begin_id <= token_id <= self.semantic_end_id):
            raise ValueError(
                f"Token ID {token_id} falls outside acoustic codebook range "
                f"[{self.semantic_begin_id}, {self.semantic_end_id}]"
            )
        return token_id - self.semantic_begin_id

    def code_to_token(self, code_id: int) -> int:
        if not (0 <= code_id < self.codebook_size):
            raise ValueError(f"Codebook index {code_id} out of bounds [0, {self.codebook_size})")
        return code_id + self.semantic_begin_id
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Naive offset subtraction assuming all generated tokens are acoustic codes
def bad_decode_tokens_to_audio(tokens, begin_id=151678):
    # CRITICAL BUG: If `tokens` contains EOS (151645) or PAD (151643),
    # subtraction yields negative indices (-33, -35), wrapping around torch embedding
    # or indexing invalid codec codebook vectors without assertion.
    return [t - begin_id for t in tokens]
```

**VERIFICATION METHOD**:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T05:08:56.732Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794632936732",
    "title": "Contiguous Codebook-To-Vocab Disjoint Offset Rule",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-edge0-audio8-tts-realistic-0.6b-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "22735e3ed797f6c28bd6778a99eb6ad500932ea0097bedafd3b2ebb5c6d34c9a"
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
        "Harvested/verified timestamp recorded: 2026-11-14T05:08:56.732Z"
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
  "auth_token": "7e10493572a53ca3da93998ea3f2d25ef3f688963588431b8ae464686d5cdb2f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

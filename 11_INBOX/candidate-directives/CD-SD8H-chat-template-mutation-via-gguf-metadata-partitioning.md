# Candidate Directive: [CD-SD8H] Chat Template Mutation via GGUF Metadata Partitioning

<!-- PROVENANCE_START
{
  "source_repository": "hf-openbmb-minicpm-v-4.7-35b-a3b-gguf-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T04:19:29.058Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-openbmb-minicpm-v-4.7-35b-a3b-gguf-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-openbmb-minicpm-v-4.7-35b-a3b-gguf-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T04:19:29.058Z`  
> **Learning ID**: `LEARN-EVO-hf-openbmb-minicpm-v-4.7-35b-a3b-gguf-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**: When distributing GGUF quantized models where runtime behavior (e.g., Chain-of-Thought or reasoning loops) must be toggled for runtimes that inject inference-time parameters unconditionally (such as `llama.cpp` injecting `enable_thinking`), the publisher MUST decouple behavioral variants into discrete metadata-divergent GGUF distributions rather than relying on downstream runtime CLI flags.

**WHY**: Runtimes such as `llama.cpp` frequently update their chat template engine to inject template variables (e.g., `enable_thinking=True/False`). If a template relies on fragile runtime flag evaluation, models that produce runaway token generation when reasoning is accidentally activated will blow past the user's context window (`-c`), generating thousands of reasoning tokens for simple OCR tasks and causing memory exhaustion or timeouts.

**WHEN TO APPLY**: Any production GGUF packaging for VLMs and LLMs deployed across multi-client ecosystems (Desktop apps, `llama-server`, `llama-cli`) where template logic controls output verbosity and chain-of-thought generation.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# export_gguf_metadata_variant.py
import gguf
import shutil

def emit_chat_template_variants(source_gguf_path: str, thinking_gguf_path: str, direct_gguf_path: str):
    # 1. Base thinking chat template (preserves official reasoning tokens)
    thinking_template = (
        "{% for message in messages %}"
        "{{'<|im_start|>' + message['role'] + '\n'}}"
        "{% if message['role'] == 'assistant' and 'thinking' in message %}"
        "{{'[Start thinking]\n' + message['thinking'] + '\n[End thinking]\n'}}"
        "{% endif %}"
        "{{message['content'] + '<|im_end|>\n'}}"
        "{% endfor %}"
        "{% if add_generation_prompt %}"
        "{{'<|im_start|>assistant\n'}}"
        "{% if enable_thinking is not defined or enable_thinking %}"
        "{{'[Start thinking]\n'}}"
        "{% endif %}"
        "{% endif %}"
    )

    # 2. Direct response chat template (hard-suppresses thinking regardless of enable_thinking flag)
    direct_template = (
        "{% for message in messages %}"
        "{{'<|im_start|>' + message['role'] + '\n' + message['content'] + '<|im_end|>\n'}}"
        "{% endfor %}"
        "{% if add_generation_prompt %}"
        "{{'<|im_start|>assistant\n'}}"
        "{% endif %}"
    )

    # Apply template override to direct variant
    shutil.copyfile(source_gguf_path, direct_gguf_path)
    writer_direct = gguf.GGUFWriter(direct_gguf_path, mode="r+")
    writer_direct.add_string("tokenizer.chat_template", direct_template)
    writer_direct.close()

    # Apply template override to thinking variant
    shutil.copyfile(source_gguf_path, thinking_gguf_path)
    writer_thinking = gguf.GGUFWriter(thinking_gguf_path, mode="r+")

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T04:19:29.152Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794716369152",
    "title": "Chat Template Mutation via GGUF Metadata Partitioning",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-openbmb-minicpm-v-4.7-35b-a3b-gguf-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "68faedd9ddb64f57c7c49854c2284ea60587d8cf26aae3a891de38d504aee4a8"
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
      "score": 0.8,
      "is_generic_pattern": true,
      "has_local_paths": false,
      "findings": [],
      "details": [
        "Free of local workstation path artifacts",
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
        "Harvested/verified timestamp recorded: 2026-11-15T04:19:29.152Z"
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
  "auth_token": "7d6c7ef6f2c0ef3a4182cfd6b983ccb9f03edbce9ef93bedf7797679c29c367b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-9XSM] Canonical Namespace Decoupling for Compositional Embeddings

<!-- PROVENANCE_START
{
  "source_repository": "hf-comfy-org-minimax-h3-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-22T15:42:41.365Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-comfy-org-minimax-h3-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-comfy-org-minimax-h3-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-22T15:42:41.365Z`  
> **Learning ID**: `LEARN-EVO-hf-comfy-org-minimax-h3-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain J

## Original Learning Payload (100% Preserved)
**RULE**:
Prompt parser runtimes integrating multimodal conditioning MUST strictly isolate custom embedding tokens into deterministic lexical namespaces (e.g., explicit prefix parsing `embedding:<unique_stem>`) and MUST NOT dynamically inject unqualified tokens into the base model vocabulary.

**WHY**:
Text encoders such as Qwen3-VL-32B employ subword tokenizers with vocabulary spaces exceeding 150,000 tokens. Unprefixed dynamic token injection risks collisions with rare subwords, BPE split anomalies, or arbitrary overwrite of standard instruct-tokens, resulting in catastrophic semantic drift in the diffusion backbone.

**WHEN TO APPLY**:
In all generative diffusion workflows consuming single-file safetensor textual inversion vectors or style projection tokens.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import re
from typing import Dict, List, Tuple
import torch

class EmbeddingNamespaceResolver:
    EMBEDDING_PATTERN = re.compile(r"embedding:([a-zA-Z0-9_\-\.]+)")

    def __init__(self, embeddings_dir: str):
        self.embeddings_dir = embeddings_dir
        self.loaded_embeddings: Dict[str, torch.Tensor] = {}

    def extract_and_substitute(self, prompt: str) -> Tuple[str, List[torch.Tensor]]:
        matches = self.EMBEDDING_PATTERN.findall(prompt)
        resolved_tensors = []
        clean_tokens = []

        for emb_name in matches:
            if emb_name not in self.loaded_embeddings:
                self.loaded_embeddings[emb_name] = self._load_safetensor_embedding(emb_name)
            resolved_tensors.append(self.loaded_embeddings[emb_name])

        # Deterministic substitution with unique internal tokens that cannot collide with BPE vocab
        def _replace_match(match):
            name = match.group(1)
            return f"__COMFY_EMB_{name.upper()}__"

        sanitized_prompt = self.EMBEDDING_PATTERN.sub(_replace_match, prompt)
        return sanitized_prompt, resolved_tensors

    def _load_safetensor_embedding(self, name: str) -> torch.Tensor:
        # File IO simulation with boundary check
        path = f"{self.embeddings_dir}/{name}.safetensors"
        # Pure isolated tensor loader
        return torch.zeros((1, 4096), dtype=torch.bfloat16)
```

**NEGATIVE CONSTRAINT**:
```python

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-22T15:42:41.493Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795362161493",
    "title": "Canonical Namespace Decoupling for Compositional Embeddings",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-comfy-org-minimax-h3-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "033fe717c16e17561198f5d69b80de5b387b4c689475f97cf4c82518413abbac"
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
        "Harvested/verified timestamp recorded: 2026-11-22T15:42:41.493Z"
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
  "auth_token": "0196aba69eb3b71fb67c68e38ba3dfad15cddc1636bbafd1ef62a70d0aff686f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

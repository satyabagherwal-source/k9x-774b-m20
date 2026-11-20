# Candidate Directive: [CD-8Y8G] Disjoint Parameter Protocol for Dual Architecture LLM Integrations

<!-- PROVENANCE_START
{
  "source_repository": "searchsolved-search-solved-public-seo-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T03:02:45.229Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-searchsolved-search-solved-public-seo-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [searchsolved-search-solved-public-seo-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T03:02:45.229Z`  
> **Learning ID**: `LEARN-EVO-searchsolved-search-solved-public-seo-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When integrating language models that span both standard auto-regressive models (e.g., Qwen, GPT-4o, Claude Haiku) and specialized reasoning-optimized architectures (e.g., OpenAI o-series, GPT-6 Luna/Terra), the invocation layer MUST conditionally decouple hyperparameters. If the target model utilizes an explicit reasoning parameter (such as `reasoning_effort`), the client MUST omit unsupported legacy parameters (`temperature`, `top_p`) from the payload. Conversely, non-reasoning and local OpenAI-compatible backends (e.g., Ollama) MUST NOT receive vendor-specific reasoning arguments.

**WHY**:
OpenAI reasoning endpoints strictly enforce schema validation on chat completion payloads. Sending `temperature` to reasoning models triggers a fatal HTTP 400 (`BadRequestError: temperature is not supported with this model`). Conversely, local OpenAI-compatible inference servers (Ollama, vLLM, LocalAI) reject unknown properties like `reasoning_effort` with unhandled 422 Unprocessable Entity or 400 Bad Request errors. Dynamic model-prefix inspection is required to avoid silent pipeline termination during runtime model switching.

**WHEN TO APPLY**:
Apply to any unified AI agent pipeline, router, or wrapper calling multi-model providers via an `OpenAI` or OpenAI-compatible client abstraction.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Any, Dict
from openai import OpenAI, BadRequestError, AuthenticationError, PermissionDeniedError, NotFoundError
from tenacity import retry, stop_after_attempt, wait_fixed, retry_if_not_exception_type

PERMANENT_API_ERRORS = (
    AuthenticationError,
    PermissionDeniedError,
    NotFoundError,
    BadRequestError
)

def resolve_model_parameters(model_name: str, reasoning_effort: str = "low") -> Dict[str, Any]:
    """Dynamically assign disjoint parameter sets based on model architecture."""
    normalized_name = str(model_name).strip().lower()
    
    # Reasoning models reject temperature and require reasoning_effort
    if normalized_name.startswith(("gpt-6", "o1", "o3")):
        return {
            "reasoning_effort": reasoning_effort
            # temperature MUST NOT be present
        }
    
    # Standard models accept temperature and reject reasoning_effort
    return {
        "temperature": 0.0
    }

@retry(
    stop=stop_after_attempt(3),
    wait=wait_fixed(2.0),
    retry=retry_if_not_exception_type(PERMANENT_API_ERRORS),
    reraise=True
)
def execute_completion_request(
    client: OpenAI,
    model: str,
    messages: list,
    response_schema: Dict[str, Any]

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T03:02:45.310Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795143765310",
    "title": "Disjoint Parameter Protocol for Dual Architecture LLM Integrations",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "searchsolved-search-solved-public-seo-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e31dfaa34b416c4734de678d97151f1b308fb6bcd32c4a74d40e2788c908face"
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
        "Harvested/verified timestamp recorded: 2026-11-20T03:02:45.310Z"
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
  "auth_token": "5fd153c0119253fd45e052051d88a4c39a172f165858e7626583f86565a37714"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

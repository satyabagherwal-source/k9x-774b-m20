# Candidate Directive: [CD-7Q2D] Disjoint Parameter Protocol for Dual Architecture LLM Integrations

<!-- PROVENANCE_START
{
  "source_repository": "searchsolved/search-solved-public-seo",
  "source_url": "https://github.com/searchsolved/search-solved-public-seo",
  "source_version": "591fa023",
  "license": "NOASSERTION",
  "timestamp": "2026-11-20T03:01:48.085Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-searchsolved-search-solved-public-seo",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [searchsolved/search-solved-public-seo](https://github.com/searchsolved/search-solved-public-seo) (Revision: `591fa023`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-20T03:01:48.085Z`  
> **Learning ID**: `learn-github-searchsolved-search-solved-public-seo`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
) -> str:
    params = resolve_model_parameters(model)
    completion = client.chat.completions.create(
        model=model,
        messages=messages,
        response_format=response_schema,
        **params
    )
    return completion.choices[0].message.content or ""
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Uniform argument injection across heterogeneous LLM architectures
def invoke_llm_hazard(client, model, messages):
    # CRASH: Fails on gpt-6/o-series because temperature is forbidden
    # CRASH: Fails on Ollama/vLLM because reasoning_effort is unrecognized
    return client.chat.completions.create(
        model=model,
        messages=messages,
        temperature=0.7,
        reasoning_effort="medium" 
    )
```

**VERIFICATION METHOD**:
Implement property-based assertions checking parameter presence based on model names:
```python
def test_resolve_model_parameters_invariants():
    reasoning_payload = resolve_model_parameters("gpt-6-luna")
    assert "reasoning_effort" in reasoning_payload
    assert "temperature" not in reasoning_payload
    
    standard_payload = resolve_model_parameters("qwen2.5:7b")
    assert "temperature" in standard_payload
    assert "reasoning_effort" not in standard_payload
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T03:01:48.084Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795143708084",
    "title": "Disjoint Parameter Protocol for Dual Architecture LLM Integrations",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "searchsolved/search-solved-public-seo",
    "source_uri": "https://github.com/searchsolved/search-solved-public-seo",
    "source_version": "HEAD",
    "content_hash": "6812a96fae05cd3557564d4ef99a17205007e5ba8836c2c14e23ae9a8bb5aa2a"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.6,
      "tier": "TIER_3_COMMUNITY_OPEN",
      "findings": [],
      "details": [
        "Source originates from community open repository",
        "Source version unpinned (HEAD), subject to upstream drift",
        "Cryptographic SHA-256 payload integrity hash present"
      ]
    },
    "evidence_quality": {
      "status": "FAIL",
      "score": 0,
      "corroboration_tier": "INDEPENDENCE_UNVERIFIED",
      "effective_sources": 0,
      "direct_evidence_ratio": 0,
      "findings": [],
      "details": [
        "Direct empirical evidence ratio: 0% (0/4)",
        "Evidence-to-claim lexical alignment: 0%"
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
        "Harvested/verified timestamp recorded: 2026-11-20T03:01:48.084Z"
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
    "Empirical evidence records"
  ],
  "limitations": [
    "Staleness risk: MEDIUM"
  ],
  "evidence_references": [
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "329cac5426d55fdc3c7d2ebd70304cdfa845ebaa1128abc09270d33eed1501d1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

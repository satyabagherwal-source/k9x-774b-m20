# Candidate Directive: [CD-WICM] Closed-Set Enumerated Machine Codes on Domain Exceptions

<!-- PROVENANCE_START
{
  "source_repository": "maziyarpanahi/openmed",
  "source_url": "https://github.com/maziyarpanahi/openmed",
  "source_version": "e8325586",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T01:01:06.406Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-maziyarpanahi-openmed",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [maziyarpanahi/openmed](https://github.com/maziyarpanahi/openmed) (Revision: `e8325586`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T01:01:06.406Z`  
> **Learning ID**: `learn-github-maziyarpanahi-openmed`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: PROMPT_INJECTION_DETECTED: Adversarial prompt injection pattern detected: "<script>"
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Domain-specific exceptions emitted across subsystem boundaries (especially model runtimes, parsers, and external microservices) MUST require a machine-readable failure reason parameter constrained to an immutable, closed set of frozen string identifiers. Exception subclasses MUST preserve standard root exception argument signatures (`*args: object`) to guarantee uncompromised serialization, pickling, and standard formatting compatibility, and MUST NEVER embed dynamic unparsed model/runtime outputs inside the failure code attribute.

**WHY**:
Callers handling deep pipeline failures often branch on error conditions (e.g., retrying with higher `max_tokens` when reasoning is unfinished versus raising security halts on illegal labels). If error branching relies on parsing freeform human-readable error messages, localized message updates or internal parser tweaks silently break downstream error-handling trees. Furthermore, overriding exception `__init__` without forwarding arbitrary `*args` to `super().__init__(*args)` breaks standard Python exception pickling and multiprocess transfer via `pickle.loads(pickle.dumps(err))`. Finally, injecting unparsed model output directly into exception codes enables arbitrary data injection and telemetry poisoning.

**WHEN TO APPLY**:
Apply to all core exception definitions in SDKs, microservices, runtime wrappers, and parsers where downstream consumers must programmatically branch, map fallback behavior, or record telemetry without scraping error message text.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from typing import Final

MAPLE_RESPONSE_ERROR_CODES: Final[frozenset[str]] = frozenset({
    "empty_response",
    "non_text_response",
    "unfinished_reasoning",
    "invalid_json",
    "trailing_text",
    "invalid_keys",
    "invalid_answer",
    "invalid_span",
    "label_not_allowed",
    "invalid_response",
})

class MapleResponseError(ValueError):
    """Raised when model runtime output violates bounded task contracts."""
    
    default_code: Final[str] = "invalid_response"

    def __init__(self, *args: object, code: str | None = None) -> None:
        # Preserve standard root exception tuple behavior (args[0] as message, pickle compat)
        super().__init__(*args)
        # Strictly validate code against the immutable closed set; fallback to default
        if isinstance(code, str) and code in MAPLE_RESPONSE_ERROR_CODES:
            self.code: str = code
        else:
            self.code = self.default_code
```

**NEGATIVE CONSTRAINT**:
```python
# NEVER constrain __init__ to only a custom message parameter,
# and NEVER construct error codes dynamically from untrusted runtime input!
class BrokenResponseError(ValueError):
    def __init__(self, message: str, code: str):
        # BUG 1: Breaks pickle/unpickle protocol when args are missing or multiple
        # BUG 2: Unvalidated code allows arbitrary telemetry poisoning
        # BUG 3: Unsanitized model output in code field
        super().__init__(message)
        self.code = code  # e.g., code = raw_model_response[:10]
```

**VERIFICATION METHOD**:
Implement property-based testing and parameterized unit tests ensuring:
1. `MapleResponseError(*args).args == ValueError(*args).args` for `args` in `[(), ("msg",), ("msg", 42)]`.
2. `pickle.loads(pickle.dumps(err)).code == err.code`.
3. Supplying non-string, unlisted, or adversarial codes (e.g., `code="<script>alert()</script>"`) safely falls back to `invalid_response`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:01:06.406Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: PROMPT_INJECTION_DETECTED: Adversarial prompt injection pattern detected: \"<script>\"",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795136466406",
    "title": "Closed-Set Enumerated Machine Codes on Domain Exceptions",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "maziyarpanahi/openmed",
    "source_uri": "https://github.com/maziyarpanahi/openmed",
    "source_version": "HEAD",
    "content_hash": "c320c206d4e35d656f939c6d56cb59a793d112f1e1631527489dd47f4a73b1be"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
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
        "Direct empirical evidence ratio: 0% (0/5)",
        "Evidence-to-claim lexical alignment: 0%"
      ]
    },
    "technical_correctness": {
      "status": "FAIL",
      "score": 0,
      "directive_opposition": false,
      "opposing_rule": null,
      "is_adversarial": true,
      "has_dangerous_security": false,
      "unsupported_assumptions": [],
      "findings": [
        "PROMPT_INJECTION_DETECTED: Adversarial prompt injection pattern detected: \"<script>\""
      ],
      "details": [
        "External instructions attempting to override AI constraints rejected fail-closed."
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:01:06.406Z"
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
    "EVID-UNSPECIFIED",
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "67b740320aec05b60deab580a42c82acf1ac49f5d5a087c2d7c34ce0413d0228"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

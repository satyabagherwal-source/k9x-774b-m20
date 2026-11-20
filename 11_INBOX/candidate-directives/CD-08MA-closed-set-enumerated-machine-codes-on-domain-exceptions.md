# Candidate Directive: [CD-08MA] Closed-Set Enumerated Machine Codes on Domain Exceptions

<!-- PROVENANCE_START
{
  "source_repository": "maziyarpanahi-openmed-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T01:04:00.301Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-maziyarpanahi-openmed-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [maziyarpanahi-openmed-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T01:04:00.301Z`  
> **Learning ID**: `LEARN-EVO-maziyarpanahi-openmed-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:04:00.418Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795136640418",
    "title": "Closed-Set Enumerated Machine Codes on Domain Exceptions",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "maziyarpanahi-openmed-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b0199c2b287bd074794c40cea90c6cedbbec46dd295ed74cd1ab900a0e432d54"
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:04:00.418Z"
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
  "auth_token": "12961726321fa1277ad2b8fc4388f9917d2410ac2d4c7161bea017b032056e4f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

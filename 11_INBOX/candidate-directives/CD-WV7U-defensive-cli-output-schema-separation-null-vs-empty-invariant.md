# Candidate Directive: [CD-WV7U] Defensive CLI Output Schema Separation (Null vs Empty Invariant)

<!-- PROVENANCE_START
{
  "source_repository": "meshery-meshery-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T03:49:20.682Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-meshery-meshery-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meshery-meshery-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T03:49:20.682Z`  
> **Learning ID**: `LEARN-EVO-meshery-meshery-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**: 
Machine-readable CLI tools and autonomous agent inspection scripts MUST maintain distinct states between an **empty result set** (`[]` or `{}`) and a **failed execution/lookup** (`null`). Output contracts emitted on standard output MUST ALWAYS provide a deterministic status descriptor (`status: "ok" | "error"`), and set target data collections strictly to `null` on failure.

**WHY**: 
When an AI agent or automated orchestration loop checks CI statuses or PR feedback via subprocess execution, shell scripts often exit with status 0 or partial stdout upon encountering network timeouts, API rate limits, or auth degradation. If the script converts a network drop or null response into an empty array `[]`, the supervisor agent treats "zero errors found" as a clean green build, initiating deployment of defective code.

**WHEN TO APPLY**: 
Applies to all automation pipelines, agent tooling (`fetch_pr_checks.py`, `fetch_pr_feedback.py`), GitHub CLI wrappers, and monitoring probes.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import json
import sys
from typing import Any, NoReturn

def fail(message: str) -> NoReturn:
    """Explicitly emit null for data fields so downstream parsers 
    never mistake a runtime failure for zero findings."""
    payload = {
        "status": "error",
        "error": message,
        "data": None,  # NEVER [] or {}
        "summary": None,
        "action_required": f"HALT: Execution interrupted. Invariant unmet: {message}"
    }
    print(json.dumps(payload, indent=2))
    sys.exit(1)

def run_verified_query(query_func) -> None:
    try:
        raw_result = query_func()
        if raw_result is None:
            fail("Subprocess exited without payload; state indeterminate.")
        
        # Valid green state with 0 elements
        output = {
            "status": "ok",
            "error": None,
            "data": raw_result, # list[Any]
            "summary": {"count": len(raw_result)}
        }
        print(json.dumps(output, indent=2))
        sys.exit(0)
    except Exception as exc:
        fail(f"Execution failed: {str(exc)}")
```

**NEGATIVE CONSTRAINT**:
```python

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T03:49:20.778Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795146560778",
    "title": "Defensive CLI Output Schema Separation (Null vs Empty Invariant)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "meshery-meshery-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b0354c4f0ff515956e3a961cbf7aec7806a94a1373bd70085b23b4be6e678855"
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
        "Harvested/verified timestamp recorded: 2026-11-20T03:49:20.778Z"
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
  "auth_token": "d0d2195fd71088814d4922133a4022e9d3ff3cfcb477835d129423a8ee59367c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

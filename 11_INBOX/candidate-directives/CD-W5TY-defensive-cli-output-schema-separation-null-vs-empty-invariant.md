# Candidate Directive: [CD-W5TY] Defensive CLI Output Schema Separation (Null vs Empty Invariant)

<!-- PROVENANCE_START
{
  "source_repository": "meshery/meshery",
  "source_url": "https://github.com/meshery/meshery",
  "source_version": "c5d506a5",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T03:48:47.878Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-meshery-meshery",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [meshery/meshery](https://github.com/meshery/meshery) (Revision: `c5d506a5`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T03:48:47.878Z`  
> **Learning ID**: `learn-github-meshery-meshery`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
# ANTI-PATTERN: Swallowing subprocess errors or returning empty structures on error
def get_checks_unsafe() -> list:
    res = subprocess.run(["gh", "pr", "checks"], capture_output=True, text=True)
    if res.returncode != 0:
        # FATAL FLAW: Returning empty list makes agent think CI passed with 0 failures!
        return []
    return json.loads(res.stdout or "[]")
```

**VERIFICATION METHOD**:
Execute negative property tests intercepting GitHub API calls with mocked 500s and network resets. Assert that stdout parses to JSON with `"status": "error"`, `"data": null`, and process exit code is non-zero.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T03:48:47.877Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795146527877",
    "title": "Defensive CLI Output Schema Separation (Null vs Empty Invariant)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "meshery/meshery",
    "source_uri": "https://github.com/meshery/meshery",
    "source_version": "HEAD",
    "content_hash": "0adc2fd423133a38887439ae676f1db800e6b1593c463fcc5d45f0142f651840"
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
        "Harvested/verified timestamp recorded: 2026-11-20T03:48:47.877Z"
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
  "auth_token": "a02c764254ca27f8e2b221fbe0339409fae17a3ca83fc1c2843b50359fa33136"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

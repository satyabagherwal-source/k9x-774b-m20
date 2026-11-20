# Candidate Directive: [CD-ZWKY] Hub Remote Artifact Pre-Flight Verification Invariant

<!-- PROVENANCE_START
{
  "source_repository": "hf-sentinel7-h3-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T14:07:33.948Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-hf-sentinel7-h3-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [hf-sentinel7-h3-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T14:07:33.948Z`  
> **Learning ID**: `LEARN-EVO-hf-sentinel7-h3-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Any autonomous system, model loader, or client tool interfacing with remote artifact repositories (Hugging Face Hub, OCI Registries, S3-compatible model buckets) MUST verify manifest completeness, commit tree non-emptiness, and mandatory configuration schema presence (`config.json` with defined `model_type` and non-zero `architectures`) prior to initiating tensor memory allocations or pipeline hydration. Clients MUST NOT invoke downstream deserializers (`safetensors::load`, `torch.load`, `from_pretrained`) on unvalidated remote targets.

**WHY**:
Invoking framework-level factory methods (`AutoModel.from_pretrained`) against empty or stub repositories triggers unhandled HTTP 404/401 exceptions, silent deadlocks in multi-threaded asset crawlers, or downstream `KeyError: 'model_type'` defects. Furthermore, malicious or accidentally dangling repository stubs exhaust API rate limits through aggressive automatic retry loops.

**WHEN TO APPLY**:
Apply to all model fetchers, autonomous agent tools, ingestion scrapers, and dynamic weight loader engines written in Python, Rust, Go, or TypeScript interacting with distributed artifact stores.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
"""
Defensive Hugging Face Hub Manifest Pre-Flight Validator
Enforces zero-allocation verification before hydration.
"""

from dataclasses import dataclass
from typing import Any, Dict, Optional
import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry


class ModelArtifactValidationError(Exception):
    """Raised when remote repository fails structural and schema invariants."""
    pass


@dataclass(frozen=True)
class HubArtifactContract:
    repo_id: str
    revision: str
    required_files: tuple[str, ...] = ("config.json",)
    max_redirects: int = 3
    timeout_seconds: float = 5.0


class HubPreFlightValidator:
    def __init__(self, token: Optional[str] = None):
        self._session = requests.Session()
        retries = Retry(
            total=3,
            backoff_factor=0.5,
            status_forcelist=[429, 500, 502, 503, 504],
            raise_on_status=False
        )
        self._session.mount("https://", HTTPAdapter(max_retries=retries))
        self._headers = {"Authorization": f"Bearer {token}"} if token else {}

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T14:07:34.061Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795183654060",
    "title": "Hub Remote Artifact Pre-Flight Verification Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "hf-sentinel7-h3-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "d39c85a736006cc03e0bb626a84815b4876c9a4115ceaf8cd1ddfb90621c2d73"
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
        "Harvested/verified timestamp recorded: 2026-11-20T14:07:34.061Z"
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
  "auth_token": "da0125cd12e530b0352645fb064f367c690971ece20290ee61c8ff894a4153ab"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

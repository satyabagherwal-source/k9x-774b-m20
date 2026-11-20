# Candidate Directive: [CD-8Y7X] Decoupled State-Machine Persistence for Asynchronous Polling APIs

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
Network interactions against upstream asynchronous batch queues with completion windows exceeding HTTP client timeouts (e.g., $>30\text{s}$) MUST decouple submission (`task_post`) from retrieval (`task_get`) via an idempotent on-disk or database job manifest. Polling loops MUST treat intermediate non-terminal states as explicit continuations, MUST abort immediately on unrecoverable authentication/financial codes, and MUST sanitize all upstream vendor redirects (such as tracking hops) at the protocol extraction boundary before yielding domain entities.

**WHY**:
Upstream search engines frequently modify link forwarding behaviors (e.g., Google introducing `google.com/goto` tokenized redirects). Asynchronous vendor scrapers take 20 to 45 minutes to resolve the underlying canonical targets. Firing synchronous HTTP requests results in thread exhaustion, connection timeouts, or corrupted downstream datasets consisting solely of intermediate tracking domains (`google.com`). Persisting task manifests to a deterministic serialization format (e.g., CSV with UTF-8 BOM awareness) enables pause-and-resume workflows and decouples ephemeral network sessions from data pipelines.

**WHEN TO APPLY**:
Apply to any client library or worker interacting with asynchronous SaaS queues, third-party crawlers, or long-running transcription/indexing jobs where completion times are nondeterministic and API costs apply per invocation.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import csv
import io
import time
from typing import Any, Dict, List, Optional, Set, Tuple
import requests

PENDING_STATUS_CODES: Set[int] = {40601, 40602}
ACCOUNT_FATAL_CODES: Set[int] = {40100, 40104, 40200, 40201, 40203, 40204, 40207, 40210}
JOB_SCHEMA: List[str] = ['task_id', 'query', 'status', 'created_at']

class QueueJobError(RuntimeError):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code

    @property
    def is_terminal_account_fault(self) -> bool:
        return self.status_code in ACCOUNT_FATAL_CODES

def serialize_job_manifest(records: List[Dict[str, Any]]) -> str:
    """Serialize active tasks with strict schema adherence."""
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=JOB_SCHEMA)
    writer.writeheader()
    writer.writerows(records)
    return buffer.getvalue()

def deserialize_job_manifest(raw_csv: str) -> List[Dict[str, Any]]:
    """Deserialize manifest, stripping UTF-8 BOM to prevent key corruption."""
    clean_text = raw_csv.lstrip('\ufeff')
    reader = csv.DictReader(io.StringIO(clean_text))
    if not reader.fieldnames or not set(JOB_SCHEMA).issubset(set(reader.fieldnames)):
        raise ValueError(f"Invalid job manifest. Missing required fields from {JOB_SCHEMA}")
    
    tasks = []
    seen_ids = set()
    for row in reader:
        task_id = (row.get('task_id') or '').strip()

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T03:02:45.306Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795143765306",
    "title": "Decoupled State-Machine Persistence for Asynchronous Polling APIs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "searchsolved-search-solved-public-seo-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1abcccf6f89626602b58298915dda38d146de5c1f46b32d689cd7b35e841cb7a"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T03:02:45.307Z"
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
  "auth_token": "1bc4885f75eb28eb3547acefad7b1b9f2f4bf0310dd8c0ef2ede335d6307875b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

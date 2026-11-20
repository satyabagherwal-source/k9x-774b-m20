# Candidate Directive: [CD-7Q2C] Decoupled State-Machine Persistence for Asynchronous Polling APIs

<!-- PROVENANCE_START
{
  "source_repository": "searchsolved/search-solved-public-seo",
  "source_url": "https://github.com/searchsolved/search-solved-public-seo",
  "source_version": "591fa023",
  "license": "NOASSERTION",
  "timestamp": "2026-11-20T03:01:48.084Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-searchsolved-search-solved-public-seo",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [searchsolved/search-solved-public-seo](https://github.com/searchsolved/search-solved-public-seo) (Revision: `591fa023`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-20T03:01:48.084Z`  
> **Learning ID**: `learn-github-searchsolved-search-solved-public-seo`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
        if not task_id or task_id in seen_ids:
            continue
        seen_ids.add(task_id)
        tasks.append(row)
    return tasks

def poll_batch_completion(
    tasks: List[Dict[str, Any]], 
    endpoint: str, 
    headers: Dict[str, str],
    poll_interval: float = 2.0
) -> Dict[str, Any]:
    """Poll task status safely with fail-fast account verification and redirect pruning."""
    results: Dict[str, Any] = {'completed': {}, 'pending': [], 'failed': []}
    
    for row in tasks:
        task_id = row['task_id']
        try:
            resp = requests.get(f"{endpoint}/{task_id}", headers=headers, timeout=60)
            data = resp.json()
            code = data.get('status_code')
            
            if code in ACCOUNT_FATAL_CODES:
                raise QueueJobError(f"Fatal account error: {data.get('status_message')}", status_code=code)
            
            if code in PENDING_STATUS_CODES:
                results['pending'].append(task_id)
                continue
                
            task_data = (data.get('tasks') or [{}])[0]
            task_status = task_data.get('status_code')
            
            if task_status in PENDING_STATUS_CODES:
                results['pending'].append(task_id)
            elif task_status == 20000:
                raw_items = task_data.get('result', [{}])[0].get('items', [])
                # Sanitize out intermediate tracking redirects
                clean_items = [
                    item for item in raw_items 
                    if 'google.com/goto' not in (item.get('url') or '')
                ]
                results['completed'][task_id] = clean_items
            else:
                results['failed'].append((task_id, task_data.get('status_message', 'Unknown failure')))
                
        except requests.RequestException as exc:
            results['failed'].append((task_id, str(exc)))
            
        time.sleep(poll_interval)
        
    return results
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Synchronous in-memory blocking poll with unhandled redirect leaking
def unsafe_fetch_serp(keywords, auth):
    results = {}
    for kw in keywords:
        # Blocks the entire process; crashes if network drops or search engine delays
        resp = requests.post("https://api.vendor.com/live", auth=auth, json={"kw": kw}).json()
        items = resp["tasks"][0]["result"][0]["items"]
        # LEAK: Ingests raw 'google.com/goto' URLs, poisoning downstream deduplication and clustering!
        results[kw] = [item["url"] for item in items]
    return results
```

**VERIFICATION METHOD**:
Verify using automated unit/integration tests that mock HTTP 40100/40601 responses:
```python
def test_poll_batch_aborts_on_fatal_account_code(requests_mock):
    requests_mock.get(
        "https://api.test.com/task/123", 
        json={"status_code": 40200, "status_message": "Insufficient balance"}
    )
    tasks = [{'task_id': '123', 'query': 'seo', 'status': 'queued', 'created_at': '2026-01-01'}]
    try:
        poll_batch_completion(tasks, "https://api.test.com/task", {})
        assert False, "Should have raised QueueJobError"
    except QueueJobError as err:
        assert err.is_terminal_account_fault is True
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T03:01:48.082Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795143708082",
    "title": "Decoupled State-Machine Persistence for Asynchronous Polling APIs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "searchsolved/search-solved-public-seo",
    "source_uri": "https://github.com/searchsolved/search-solved-public-seo",
    "source_version": "HEAD",
    "content_hash": "5609f6ab4f3269cfe81078d56fa27127f27b5d2d6e63273a20a649c4215f50d8"
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
        "Expresses generalized engineering invariants (4 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T03:01:48.082Z"
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
  "auth_token": "8a11e9e02f1e69908e2dc26162d3cbfc1b39834c69ca8d3e576c495bb75202c8"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

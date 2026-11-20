# Candidate Directive: [CD-X37H] Mandatory SO_REUSEADDR Socket Reusability on Test Harness Fixtures

<!-- PROVENANCE_START
{
  "source_repository": "tmolavi-siteprobe-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T06:37:28.716Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-tmolavi-siteprobe-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tmolavi-siteprobe-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T06:37:28.716Z`  
> **Learning ID**: `LEARN-EVO-tmolavi-siteprobe-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
Any network mock server or fixture instantiated in multi-threaded test environments MUST configure the socket with `SO_REUSEADDR` (`allow_reuse_address = True` in Python `socketserver`) before binding to the TCP port.

**WHY**:
Without `SO_REUSEADDR`, TCP sockets remain in the `TIME_WAIT` state for 60 to 120 seconds after teardown. Consecutive test runs, test re-ordering, or parallel test executions attempt to bind to the same host/port tuple and fail with `OSError: [Errno 98] Address already in use`, causing flaky builds in CI pipelines.

**WHEN TO APPLY**:
Apply to all local HTTP/TCP mock servers, embedded mock daemon fixtures, integration testing servers, and temporary socket listeners.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import socketserver
import threading
from typing import Generator
import pytest


class ReusableTCPServer(socketserver.TCPServer):
    """Ensures TIME_WAIT state does not block immediate test harness socket rebinding."""
    allow_reuse_address = True


@pytest.fixture(scope="session")
def mock_server() -> Generator[str, None, None]:
    port = 8899
    handler = socketserver.SimpleHTTPRequestHandler
    with ReusableTCPServer(("127.0.0.1", port), handler) as httpd:
        server_thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        server_thread.start()
        try:
            yield f"http://127.0.0.1:{port}"
        finally:
            httpd.shutdown()
            httpd.server_close()
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Standard socketserver without SO_REUSEADDR causes port binding collisions
@pytest.fixture(scope="session")
def buggy_mock_server():
    port = 8899
    # Sockets in TIME_WAIT cause Errno 98 (Address already in use) on immediate test rerun
    with socketserver.TCPServer(("127.0.0.1", port), CustomHandler) as httpd:
        thread = threading.Thread(target=httpd.serve_forever, daemon=True)
        thread.start()
        yield f"http://127.0.0.1:{port}"
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T06:37:28.829Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795156648829",
    "title": "Mandatory SO_REUSEADDR Socket Reusability on Test Harness Fixtures",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tmolavi-siteprobe-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "25d6d6d0a6f9b9ef4924bc53c8eaefd1ceebd67b64f7269ae7411a7246a6a5cf"
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
        "Harvested/verified timestamp recorded: 2026-11-20T06:37:28.829Z"
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
  "auth_token": "64c467d44dfae4f44da362bb006ec4aa0a25ec2e43d353f787402f220de272ae"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

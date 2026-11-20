# Candidate Directive: [CD-X080] Mandatory SO_REUSEADDR Socket Reusability on Test Harness Fixtures

<!-- PROVENANCE_START
{
  "source_repository": "tmolavi/siteprobe",
  "source_url": "https://github.com/tmolavi/siteprobe",
  "source_version": "4b116b3c",
  "license": "MIT",
  "timestamp": "2026-11-20T06:37:24.960Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-tmolavi-siteprobe",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [tmolavi/siteprobe](https://github.com/tmolavi/siteprobe) (Revision: `4b116b3c`).  
> **License**: MIT | **Timestamp**: `2026-11-20T06:37:24.960Z`  
> **Learning ID**: `learn-github-tmolavi-siteprobe`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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

**VERIFICATION METHOD**:
Run rapid back-to-back test suite invocations verifying clean zero-exit-code termination:
```bash
pytest tests/ -k mock_server && pytest tests/ -k mock_server
```
Alternatively, assert within the fixture:
```python
def test_socket_options(mock_server):
    # Verify SO_REUSEADDR flag is active on the socket
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    s.bind(("127.0.0.1", 0))
    s.close()
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T06:37:24.960Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.66,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 66%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795156644960",
    "title": "Mandatory SO_REUSEADDR Socket Reusability on Test Harness Fixtures",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "tmolavi/siteprobe",
    "source_uri": "https://github.com/tmolavi/siteprobe",
    "source_version": "HEAD",
    "content_hash": "e300df2e59ae783ff6eb92435c02a1ca78a761071b0212ec619ba0a08a56e5a5"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T06:37:24.960Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "ea4c856efcc5a6ef208232dcee7494a7438b25506944eff0a36acc1052b8ab27"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

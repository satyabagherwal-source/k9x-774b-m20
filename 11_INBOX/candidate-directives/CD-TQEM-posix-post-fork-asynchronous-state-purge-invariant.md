# Candidate Directive: [CD-TQEM] POSIX Post-Fork Asynchronous State Purge Invariant

<!-- PROVENANCE_START
{
  "source_repository": "lancedb-lancedb-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T08:40:12.386Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-lancedb-lancedb-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lancedb-lancedb-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T08:40:12.386Z`  
> **Learning ID**: `LEARN-EVO-lancedb-lancedb-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
Any native library or Python runtime module embedding background worker threads and asynchronous event loops **MUST** register an `os.register_at_fork(after_in_child=...)` or native `pthread_atfork` hook. The child hook **MUST NOT** attempt to join or clean up the inherited parent thread handles, and **MUST** re-initialize synchronization primitives (`threading.Lock`) from scratch.

**WHY**:
Under POSIX `fork()`, only the calling thread is duplicated into the child process. Any existing background event loop threads, Tokio worker threads, or thread-pool executors abruptly vanish without triggering destructors. If the parent process was holding an internal mutex at the instant of the fork, the child inherits that mutex in an irrevocably locked state. Attempting to acquire or safely shut down the old thread leads to immediate child deadlocks.

**WHEN TO APPLY**:
All systems embedding background async runtimes (Tokio, asyncio), thread pools, or connection pools inside shared libraries imported into multiprocessing-capable languages (Python, Ruby).

**VERIFIED IMPLEMENTATION PATTERN**:
```python
import os
import threading
import asyncio
import concurrent.futures

class BackgroundEventLoop:
    def __init__(self):
        self.loop: asyncio.AbstractEventLoop | None = None
        self.thread: threading.Thread | None = None
        self._start_lock = threading.Lock()

    def _reset_after_fork(self):
        # Threads do not survive fork(). Never invoke join() on dead threads.
        # Overwrite the lock completely because the inherited lock may be held
        # by a parent thread that ceased to exist.
        self.loop = None
        self.thread = None
        self._start_lock = threading.Lock()

_GLOBAL_LOOP = BackgroundEventLoop()
_EMBEDDING_POOL = concurrent.futures.ThreadPoolExecutor(thread_name_prefix="db-worker")

def _reset_runtime_after_fork():
    global _EMBEDDING_POOL
    _GLOBAL_LOOP._reset_after_fork()
    # Replace executor without calling .shutdown(wait=True) on dead threads
    _EMBEDDING_POOL = concurrent.futures.ThreadPoolExecutor(thread_name_prefix="db-worker")

if hasattr(os, "register_at_fork"):
    os.register_at_fork(after_in_child=_reset_runtime_after_fork)
```

**NEGATIVE CONSTRAINT**:
```python
# NEVER attempt to cleanly shut down existing thread pools in the post-fork child hook.
def _bad_reset():
    global _EMBEDDING_POOL
    # DEADLOCK HAZARD: The threads in _EMBEDDING_POOL do not exist in this child process.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T08:40:12.525Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795855212525",
    "title": "POSIX Post-Fork Asynchronous State Purge Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lancedb-lancedb-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "e01913ea74451e850477a2b563de8bfc701731d0f1411b6e6625ae9c961aa7f0"
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
        "Harvested/verified timestamp recorded: 2026-11-28T08:40:12.525Z"
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
  "auth_token": "f74f64a6bb0f2500ef630accef76300efe17b8c7718672bedf5502ad30cfca50"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

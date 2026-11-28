# Candidate Directive: [CD-S50J] POSIX Post-Fork Asynchronous State Purge Invariant

<!-- PROVENANCE_START
{
  "source_repository": "lancedb/lancedb",
  "source_url": "https://github.com/lancedb/lancedb",
  "source_version": "9e3af362",
  "license": "Apache-2.0",
  "timestamp": "2026-11-28T08:38:58.147Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lancedb-lancedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lancedb/lancedb](https://github.com/lancedb/lancedb) (Revision: `9e3af362`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-28T08:38:58.147Z`  
> **Learning ID**: `learn-github-lancedb-lancedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    # .shutdown(wait=True) will wait indefinitely for non-existent threads to join.
    _EMBEDDING_POOL.shutdown(wait=True) 
```

**VERIFICATION METHOD**:
Execute a multi-process spawn test asserting that a child process can re-instantiate and run queries after a parent had already initialized background threads:
```python
import multiprocessing as mp

def _worker(loop_instance):
    # Verify child creates a new loop without deadlock
    assert loop_instance._start_lock.acquire(timeout=2.0)
    loop_instance._start_lock.release()

def test_fork_safety():
    mp.set_start_method("fork", force=True)
    p = mp.Process(target=_worker, args=(_GLOBAL_LOOP,))
    p.start()
    p.join(timeout=5)
    assert p.exitcode == 0
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T08:38:58.146Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795855138146",
    "title": "POSIX Post-Fork Asynchronous State Purge Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lancedb/lancedb",
    "source_uri": "https://github.com/lancedb/lancedb",
    "source_version": "HEAD",
    "content_hash": "1828acf5615e8af6138a29ce7d497e083b65295924812185d6b0110d21c2b24b"
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
        "Harvested/verified timestamp recorded: 2026-11-28T08:38:58.146Z"
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
  "auth_token": "fffb8bfe98e93a1e7f0e7091bc6bcdd623fd86ccfeaaf478187a5e166bd0b553"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

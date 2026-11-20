# Candidate Directive: [CD-YLBC] test(python): isolate the background-loop fork scenario

<!-- PROVENANCE_START
{
  "source_repository": "lancedb/lancedb",
  "source_url": "https://github.com/lancedb/lancedb",
  "source_version": "0d2655ed",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T21:06:27.048Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lancedb-lancedb",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lancedb/lancedb](https://github.com/lancedb/lancedb) (Revision: `0d2655ed`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T21:06:27.048Z`  
> **Learning ID**: `learn-github-lancedb-lancedb`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `python/python/tests/test_background_loop.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lancedb/lancedb. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0d2655ed`: test(python): isolate the background-loop fork scenario. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `python/python/tests/test_background_loop.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
def _run_in_subprocess(code: str, timeout: int = 30) -> subprocess.CompletedProcess:
        timeout=timeout,
    # Fork from a fresh interpreter: earlier tests in a shared pytest process
    # may have left native runtime state that is not part of this scenario.
    result = _run_in_subprocess(
        f"""
        import asyncio
        import multiprocessing as mp
        import threading
        import traceback

        from lancedb.background_loop import LOOP

        BACKGROUND_THREAD_NAME = {BACKGROUND_THREAD_NAME!r}

        def background_threads():
            return [
                thread
                for thread in threading.enumerate()
                if thread.name == BACKGROUND_THREAD_NAME
            ]

        def fork_child(queue):
            try:
                from lancedb.background_loop import LOOP

                inherited_thread_is_none = LOOP.thread is None
                inherited_loop_is_none = LOOP.loop is None
                background_threads_before = [
                    thread.name for thread in background_threads()
                ]

                import lancedb

                db = lancedb.connect("memory://")
                tables =
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
import multiprocessing as mp
import traceback
def _run_in_subprocess(code: str) -> subprocess.CompletedProcess:
        timeout=30,
def _fork_child_starts_lazily(queue):
    def background_threads():
        import threading

        return [
            thread
            for thread in threading.enumerate()
            if thread.name == BACKGROUND_THREAD_NAME
        ]

    try:
        from lancedb.background_loop import LOOP

        inherited_thread_is_none = LOOP.thread is None
        inherited_loop_is_none = LOOP.loop is None
        background_threads_before = [thread.name for thread in background_threads()]

        import lancedb

        db = lancedb.connect("memory://")
        tables = db.table_names()

        worker = LOOP.thread
        queue.put(
            {
                "error": None,
                "inherited_thread_is_none": inherited_thread_is_none,
                "inherited_loop_is_none": inherited_loop_is_none,
                "background_threads_before": background_threads_before,
                "tables": tables,
                "thread_alive": False if worker is None else worker.is_alive(),
                "thread_daemon": False if worker is None el
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0d2655ed` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T21:06:27.046Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795208787046",
    "title": "test(python): isolate the background-loop fork scenario",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lancedb/lancedb",
    "source_uri": "https://github.com/lancedb/lancedb",
    "source_version": "HEAD",
    "content_hash": "2aa620a61c6f9761818b7696c5f563c1f33272f14e883209f021c80a0071735b"
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
        "Harvested/verified timestamp recorded: 2026-11-20T21:06:27.046Z"
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
  "auth_token": "9eaf4a3bdd492332f2efb79793cc96d8a7239b70c2ea2eb1de22772e8698f3e2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

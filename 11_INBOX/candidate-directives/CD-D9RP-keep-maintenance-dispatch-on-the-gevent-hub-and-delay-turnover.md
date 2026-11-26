# Candidate Directive: [CD-D9RP] keep maintenance dispatch on the gevent hub and delay turnover

<!-- PROVENANCE_START
{
  "source_repository": "Ontos-AI/knowhere",
  "source_url": "https://github.com/Ontos-AI/knowhere",
  "source_version": "0cc7bd5b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T20:31:54.038Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-ontos-ai-knowhere",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Ontos-AI/knowhere](https://github.com/Ontos-AI/knowhere) (Revision: `0cc7bd5b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T20:31:54.038Z`  
> **Learning ID**: `learn-github-ontos-ai-knowhere`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/shared-python/shared/services/retrieval/lexical/maintenance_signals.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Ontos-AI/knowhere. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `2b128da2`: keep maintenance dispatch on the gevent hub and delay turnover. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/shared-python/shared/services/retrieval/lexical/maintenance_signals.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
from gevent.monkey import is_module_patched
# Turnover may close the least-recently-used index. Running it right after an open can
# close the index that is still receiving its first bulk write, so it waits past the
# indexing deadline instead.
_TURNOVER_DELAY_SECONDS: Final[float] = 300
        Outside gevent the send runs on a background thread, because publishing to an
        unreachable broker blocks for many seconds. False means the work waits for the sweep.
                logger.warning("Lexical maintenance dispatch deferred to the hourly sweep: task={} identity={} error_type={} error={}",
                    taskName, identity, type(error).__name__, str(error)[:200])
        """Ask for one delayed idle-index turnover after an index opens, without blocking admission."""
        if is_module_patched("threading"):
            # Under gevent, Celery's producer pool and the shared Redis client belong to
            # the hub that created them; a native background thread cannot use them
            # ("Cannot switch to a different thread"). Sending inline only blocks the
            # current greenlet.
            operation()
            return True
            logger.warning("L
```

**NEGATIVE CONSTRAINT**:
```python
// Induced defect failure mode:
        The send runs on a background thread, because publishing to an unreachable
        broker blocks for many seconds. False means the work waits for the sweep.
                logger.warning("Lexical maintenance dispatch deferred to the hourly sweep: task={} identity={} error_type={}",
                    taskName, identity, type(error).__name__)
        """Ask for one idle-index turnover after an index opens, without blocking admission."""
            logger.warning("Lexical maintenance dispatch deferred to the hourly sweep: task={} error_type={}",
                description, type(error).__name__)
                get_celery_app().send_task(TURNOVER_TASK, retry=False)
            logger.warning("Lexical turnover request deferred to the hourly sweep: error_type={}", type(error).__name__)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `2b128da2` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T20:31:54.036Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795725114036",
    "title": "keep maintenance dispatch on the gevent hub and delay turnover",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Ontos-AI/knowhere",
    "source_uri": "https://github.com/Ontos-AI/knowhere",
    "source_version": "HEAD",
    "content_hash": "a412ed61fe4b7153b089d02246eb17936cf91cbecc4e0f5ea69e7af58c0f9a70"
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
        "Harvested/verified timestamp recorded: 2026-11-26T20:31:54.036Z"
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
  "auth_token": "4f342288f8d04b0c95895a79a36ed7f38f118c053bc4174568ac26e42a62f4fe"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

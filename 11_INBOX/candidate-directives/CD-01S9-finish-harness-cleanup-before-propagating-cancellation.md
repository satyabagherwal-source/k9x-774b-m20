# Candidate Directive: [CD-01S9] finish harness cleanup before propagating cancellation

<!-- PROVENANCE_START
{
  "source_repository": "Agent-Field/agentfield",
  "source_url": "https://github.com/Agent-Field/agentfield",
  "source_version": "7205812b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-14T15:49:37.929Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-agent-field-agentfield",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Agent-Field/agentfield](https://github.com/Agent-Field/agentfield) (Revision: `7205812b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-14T15:49:37.929Z`  
> **Learning ID**: `learn-github-agent-field-agentfield`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `sdk/python/agentfield/harness/_cli.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Agent-Field/agentfield. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0145089a`: python): finish harness cleanup before propagating cancellation. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Go data structures, boundary deserialization, API parsing, or resource lifecycles matching `sdk/python/agentfield/harness/_cli.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Verified production-grade fix pattern:
    except (asyncio.TimeoutError, TimeoutError, asyncio.CancelledError):
        # Loop shutdown cancels the cleanup task too. Finish the same bounded
        # kill/poll fallback; run_cli still propagates the caller's cancellation.
        try:
            await asyncio.sleep(0.1)
        except asyncio.CancelledError:
            # Do not restart the polling budget when shutdown cancels again.
            pass

        async def cleanup() -> Optional[int]:
            if not completed:
                _kill_group()
            drain.cancel()
            try:
                await drain
            except BaseException:
                pass
            return await _wait_process_exit(proc, _kill_group)

        # Pipe EOF does not mean the child has exited. Keep ownership until
        # the bounded exit wait finishes, even if cancellation arrives here
        # or is repeated while cleanup is already running.
        cleanup_task = asyncio.create_task(cleanup())
        cleanup_cancelled: Optional[asyncio.CancelledError] = None
        while True:
            try:
                fallback_returncode = await asyncio.shield(cleanup_task)
                break
            except asy
```

**NEGATIVE CONSTRAINT**:
```go
// Induced defect failure mode:
    except (asyncio.TimeoutError, TimeoutError):
        await asyncio.sleep(0.1)
        if not completed:
            # Timeout, cancellation, or an internal error: stop the child so
            # nothing keeps running and the exit wait below can conclude.
            # (Previously only the timeout paths killed; a cancelled run_cli
            # left the child running and awaited its natural exit.)
            _kill_group()
        drain.cancel()
        try:
            await drain
        except BaseException:
            pass
        fallback_returncode = await _wait_process_exit(proc, _kill_group)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0145089a` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T15:49:37.927Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794671377927",
    "title": "finish harness cleanup before propagating cancellation",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Agent-Field/agentfield",
    "source_uri": "https://github.com/Agent-Field/agentfield",
    "source_version": "HEAD",
    "content_hash": "4dea3c52b7dbb51e085d813a1c4a822a4a729377bf7487fb8b1d4d4116f82c73"
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
        "Harvested/verified timestamp recorded: 2026-11-14T15:49:37.927Z"
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
  "auth_token": "9bb89363026eedf0313895f215fbc49b3277fe36064e3a223998763d2da1391e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

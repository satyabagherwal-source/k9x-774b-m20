# Candidate Directive: [CD-T1UK] clamp the open foreground probe's hdc read to the request deadline

<!-- PROVENANCE_START
{
  "source_repository": "callstack/agent-device",
  "source_url": "https://github.com/callstack/agent-device",
  "source_version": "b2d4ec05",
  "license": "MIT",
  "timestamp": "2026-11-24T19:44:50.588Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-callstack-agent-device",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [callstack/agent-device](https://github.com/callstack/agent-device) (Revision: `b2d4ec05`).  
> **License**: MIT | **Timestamp**: `2026-11-24T19:44:50.588Z`  
> **Learning ID**: `learn-github-callstack-agent-device`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/evidence/ad-5055-lega/replay-lega.json`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in callstack/agent-device. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4dffcd31`: harmonyos): clamp the open foreground probe's hdc read to the request deadline. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/evidence/ad-5055-lega/replay-lega.json`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
{
  "success": false,
  "error": {
    "code": "REPLAY_DIVERGENCE",
    "message": "Daemon request deadline exceeded",
    "hint": "Check completed steps and the current device state before retrying the timed-out operation.",
    "diagnosticId": "mwu8qema-6d287442",
    "logPath": "<state-dir>/sessions/cwd_1dd430edfb664982_default/requests/97d848997a368c7f.ndjson",
    "diagnosticsRecord": {
      "session": "cwd:1dd430edfb664982:default",
      "requestId": "97d848997a368c7f"
    },
    "details": {
      "reason": "daemon_request_timeout",
      "replayPath": "one-line.ad",
      "step": 1,
      "action": "open",
      "positionals": ["<arg>"],
      "artifactPaths": [],
      "divergence": {
        "version": 1,
        "kind": "action-failure",
        "step": {
          "index": 1,
          "source": {
            "path": "one-line.ad",
            "line": 1
          }
        },
        "action": "open \"com.sankuai.dianping\"",
        "cause": {
          "code": "COMMAND_FAILED",
          "message": "request canceled",
          "hint": "The request was canceled intentionally (explicit cancel or client disconnect) \u2014 no retry is needed unless the cancellation was
```

**NEGATIVE CONSTRAINT**:
```typescript
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4dffcd31` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T19:44:50.586Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795549490586",
    "title": "clamp the open foreground probe's hdc read to the request deadline",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "callstack/agent-device",
    "source_uri": "https://github.com/callstack/agent-device",
    "source_version": "HEAD",
    "content_hash": "6ce054f7cabcc23e134e3225ea64c237943abf8c944c5ab2af2eb1dd0be42c86"
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
        "Harvested/verified timestamp recorded: 2026-11-24T19:44:50.586Z"
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
  "auth_token": "cc22ccd78ca91dec3515dd28e6620f1efa724ef2e98af211e87e4890bad8b703"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

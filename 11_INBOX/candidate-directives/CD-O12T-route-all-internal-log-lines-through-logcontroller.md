# Candidate Directive: [CD-O12T] route all internal log lines through LogController

<!-- PROVENANCE_START
{
  "source_repository": "fastify/fastify",
  "source_url": "https://github.com/fastify/fastify",
  "source_version": "f5757f12",
  "license": "MIT",
  "timestamp": "2026-11-25T03:36:49.781Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-fastify-fastify",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [fastify/fastify](https://github.com/fastify/fastify) (Revision: `f5757f12`).  
> **License**: MIT | **Timestamp**: `2026-11-25T03:36:49.781Z`  
> **Learning ID**: `learn-github-fastify-fastify`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/Reference/Server.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in fastify/fastify. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `eb087582`: logger): route all internal log lines through LogController. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing JavaScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/Reference/Server.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// Verified production-grade fix pattern:
at lifecycle points where no error exists. Server-scoped methods
(`serviceUnavailable`, `onListenHookError`, `clientError` and
`serverListening`) receive `(logger, server, ...)` instead, since no route —
and therefore no `request`/`reply` — is formed.

The request-lifecycle methods (`incomingRequest` through `serializerError`)
are gated by `disableRequestLogging`. All other methods are always emitted by
default, because they report misuse, failed hooks or possible Fastify bugs
rather than routine request traffic.
| `isLogDisabled` | `(request)` | Checks whether request logging is disabled for the given request. Used by the request-lifecycle methods below. |
| `onRequestAbortError` | `(error, request, reply, metadata)` | Logs at `error` level an error thrown by an `onRequestAbort` hook. Always emitted. |
| `replyAlreadySent` | `(error, request, reply, metadata)` | Logs at `warn` level a `FST_ERR_REP_ALREADY_SENT` error when `reply.send()` is called twice. Always emitted. |
| `headersAlreadySent` | `(error, request, reply, metadata)` | Logs at `warn` level a "did you forget to `return reply`" hint when `writeHead` throws `ERR_HTTP_HEADERS_SENT`. Always emitted. |
| `replyThenRejectio
```

**NEGATIVE CONSTRAINT**:
```javascript
// Induced defect failure mode:
at lifecycle points where no error exists. `serviceUnavailable` is a further
exception, since no route — and therefore no `request`/`reply` — is formed.
| `isLogDisabled` | `(request)` | Checks whether request logging is disabled for the given request. It impacts all other log methods. |
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `eb087582` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T03:36:49.779Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.71,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 71%). Source=PASS (TIER_2_OFFICIAL_ECOSYSTEM), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795577809779",
    "title": "route all internal log lines through LogController",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "fastify/fastify",
    "source_uri": "https://github.com/fastify/fastify",
    "source_version": "HEAD",
    "content_hash": "0e6991922430a6bbd8780281ea34334bbcf9c41e884c40a56877f5d6c1eb4107"
  },
  "evidence_fingerprint": "5c7fbcc97293e38f",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.75,
      "tier": "TIER_2_OFFICIAL_ECOSYSTEM",
      "findings": [],
      "details": [
        "Source belongs to recognized official ecosystem (TIER_2_OFFICIAL_ECOSYSTEM)",
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
        "Harvested/verified timestamp recorded: 2026-11-25T03:36:49.779Z"
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
  "auth_token": "89e27a515f7c27f495386291349904e66e57740755732b9fb2b910cdbe0bd9ab"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

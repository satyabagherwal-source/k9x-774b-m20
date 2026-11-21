# Candidate Directive: [CD-KN8W] Graceful Inter-Process Drain Phase During Network Teardown

<!-- PROVENANCE_START
{
  "source_repository": "mswjs-msw-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T01:35:32.401Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-mswjs-msw-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mswjs-msw-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T01:35:32.401Z`  
> **Learning ID**: `LEARN-EVO-mswjs-msw-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When disabling an asynchronous IPC network interception provider, the system MUST NOT purge message listeners, terminate communication channels, or unregister the proxy worker until an explicit acknowledgment handshake (`CLIENT_CLOSE` -> `CLIENT_CLOSED`) has resolved, and the channel MUST keep resolving in-flight requests with a `PASSTHROUGH` signal until worker drainage finishes.

**WHY**:
Calling `super.disable()` or unceremoniously unregistering a Service Worker immediately terminates the interception channel. Any HTTP request dispatched immediately before `worker.stop()` that is in-flight across the IPC boundary hangs indefinitely or throws network errors (`Failed to fetch`), corrupting subsequent assertions in automated test suites.

**WHEN TO APPLY**:
All client-worker or proxy-to-parent architectures where network requests are in-flight during runtime state transitions (`stop()`, `reset()`, or test teardown hooks).

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
import { PromiseWithResolvers } from 'rettime'

export class ResilientWorkerSource {
  #channel: WorkerChannel
  #listenerController?: AbortController

  public async disable(): Promise<void> {
    // 1. Abort only non-essential host listeners (e.g. window events)
    this.#listenerController?.abort()
    this.#listenerController = undefined

    // 2. Synchronize drain state with worker thread via handshake
    const closed = Promise.withResolvers<void>()
    this.#channel.once('CLIENT_CLOSED', () => closed.resolve())
    this.#channel.postMessage('CLIENT_CLOSE')

    // 3. Await explicit worker acknowledgement
    await closed.promise

    // 4. Invariant: Do NOT nullify worker resolution promise here.
    // In-flight requests received during this boundary MUST receive
    // an immediate PASSTHROUGH payload to prevent browser promise deadlocks.
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Immediate unregistration and listener purge
public async badDisable(): Promise<void> {
  // Purges handlers immediately: pending requests hang forever!
  this.#channel.removeAllListeners()
  const [, registration] = await this.workerPromise
  await registration.unregister() // Destroys context while fetch is in-flight
}
```

**VERIFICATION METHOD**:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T01:35:32.527Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795224932527",
    "title": "Graceful Inter-Process Drain Phase During Network Teardown",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mswjs-msw-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "211fbe8023d004cde9e6b74b9cc8dfeac973be653a8957382ed576bda9bb98a7"
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
        "Harvested/verified timestamp recorded: 2026-11-21T01:35:32.527Z"
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
  "auth_token": "b94923d9ce349cef83546b59750b21c45bfc5622028834c51f52f8ffec2d581a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

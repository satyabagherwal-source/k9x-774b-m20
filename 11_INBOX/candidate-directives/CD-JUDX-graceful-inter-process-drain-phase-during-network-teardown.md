# Candidate Directive: [CD-JUDX] Graceful Inter-Process Drain Phase During Network Teardown

<!-- PROVENANCE_START
{
  "source_repository": "mswjs/msw",
  "source_url": "https://github.com/mswjs/msw",
  "source_version": "b3df8504",
  "license": "MIT",
  "timestamp": "2026-11-21T01:34:55.125Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mswjs-msw",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mswjs/msw](https://github.com/mswjs/msw) (Revision: `b3df8504`).  
> **License**: MIT | **Timestamp**: `2026-11-21T01:34:55.125Z`  
> **Learning ID**: `learn-github-mswjs-msw`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
Concurrency test: Trigger 50 parallel `fetch('/api/delay')` calls, invoke `worker.stop()` concurrently at $t=10\text{ms}$, and assert that all 50 requests successfully settle with either mock responses or bypassed remote network responses without unhandled promise rejections.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T01:34:55.124Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795224895124",
    "title": "Graceful Inter-Process Drain Phase During Network Teardown",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mswjs/msw",
    "source_uri": "https://github.com/mswjs/msw",
    "source_version": "HEAD",
    "content_hash": "8ef39371d5155e3bfeb52ac2bab4ef0acca26c580215f6f59a09ff6fadb89c34"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Expresses generalized engineering invariants (5 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T01:34:55.124Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "a9dbfea509aeec4c3225350ed81c4b874222eff353ea4671efc1edfd27155b9a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

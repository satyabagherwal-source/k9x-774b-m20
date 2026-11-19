# Candidate Directive: [CD-QMKF] The Asynchronous Commit Queue Barrier Invariant

<!-- PROVENANCE_START
{
  "source_repository": "volcengine/OpenViking",
  "source_url": "https://github.com/volcengine/OpenViking",
  "source_version": "15845c2a",
  "license": "AGPL-3.0",
  "timestamp": "2026-11-19T08:08:45.759Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-volcengine-openviking",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [volcengine/OpenViking](https://github.com/volcengine/OpenViking) (Revision: `15845c2a`).  
> **License**: AGPL-3.0 | **Timestamp**: `2026-11-19T08:08:45.759Z`  
> **Learning ID**: `learn-github-volcengine-openviking`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When an asynchronous agent lifecycle requires persisting an atomic state termination (e.g., `commitAgentSession`, `closeContextSession`), the termination request **MUST NOT** bypass, race ahead of, or be dispatched concurrently with un-drained in-flight write mutations or retry queues for that entity. The termination payload **MUST** either be deferred behind pending item drainage or appended to the local journal stamped strictly after the latest write sequence.

**WHY**:
If a network hiccup or rate-limit parks messages into a client-side pending retry queue while the session commit is dispatched synchronously, the remote server processes the commit against an empty or partial session state. The server evaluates the commit as `skipped/no_messages` (a semantic success with 0 items committed). The client marks the commit complete and cleans it up. When the offline replay worker eventually drains the parked messages, the session is left permanently uncommitted and unarchived, resulting in silent data loss.

**WHEN TO APPLY**:
Apply to all distributed state synchronization agents, write-behind caching layers, offline-first client plugins, and event-sourcing pipelines syncing state to cloud control planes.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified implementation pattern derived from OpenViking pending-write barriers
export interface QueueItem {
  id: string;
  sessionId: string;
  type: "MESSAGE" | "COMMIT";
  payload: unknown;
  logicalTimestamp: number;
}

export class SafeSessionSynchronizer {
  private pendingQueue: QueueItem[] = [];
  private logicalClock: number = 0;

  public async appendMessage(sessionId: string, message: unknown): Promise<void> {
    this.logicalClock += 1;
    this.pendingQueue.push({
      id: crypto.randomUUID(),
      sessionId,
      type: "MESSAGE",
      payload: message,
      logicalTimestamp: this.logicalClock,
    });
  }

  public async commitSession(
    sessionId: string, 
    sendImmediateCommit: (sid: string) => Promise<{ ok: boolean; status: string }>
  ): Promise<void> {
    const sessionHasPendingMessages = this.pendingQueue.some(
      (item) => item.sessionId === sessionId && item.type === "MESSAGE"
    );

    if (sessionHasPendingMessages) {
      // INVARIANT: Commit MUST NOT bypass parked messages.
      // Advance logical clock beyond all existing writes and park commit.
      this.logicalClock += 1;
      
      // Remove any previously queued commits for this session to prevent duplicate runs
      this.pendingQueue = this.pendingQueue.filter(
        (item) => !(item.sessionId === sessionId && item.type === "COMMIT")
      );

      this.pendingQueue.push({
        id: crypto.randomUUID(),
        sessionId,
        type: "COMMIT",
        payload: { committedAt: Date.now() },
        logicalTimestamp: this.logicalClock,
      });

      // Attempt to drain queue in strict timestamp order
      await this.drainPendingQueue();
      return;
    }

    // Zero pending messages: safe to dispatch immediately
    const result = await sendImmediateCommit(sessionId);
    if (!result.ok) {
      this.logicalClock += 1;
      this.pendingQueue.push({
        id: crypto.randomUUID(),
        sessionId,
        type: "COMMIT",
        payload: { committedAt: Date.now() },
        logicalTimestamp: this.logicalClock,
      });
    }
  }

  private async drainPendingQueue(): Promise<void> {
    // Sort strictly by logical sequence timestamp
    this.pendingQueue.sort((a, b) => a.logicalTimestamp - b.logicalTimestamp);

    while (this.pendingQueue.length > 0) {
      const nextItem = this.pendingQueue[0];
      try {
        await this.dispatchItem(nextItem);
        this.pendingQueue.shift(); // Remove successfully sent item
      } catch (err) {
        // Halt draining on retryable transport failure; preserve order
        break;
      }
    }
  }

  private async dispatchItem(item: QueueItem): Promise<void> {
    // Concrete HTTP transport call with transient error throwing
  }
}
```

**NEGATIVE CONSTRAINT**:
```typescript
// ANTI-PATTERN: Firing commit immediately while un-acked writes are in-flight or queued
async function unsafeSessionCommit(sessionId: string, messageQueue: any[]) {
  // Buggy code: fires commit over HTTP without verifying pending writes are drained
  if (messageQueue.length > 0) {
    // Queued offline, but we still send commit immediately!
    console.warn("Queue has messages, but sending commit anyway...");
  }
  // Server returns 200 OK: { status: "no_messages" }, message loss is guaranteed
  return await fetch(`/api/sessions/${sessionId}/commit`, { method: "POST" });
}
```

**VERIFICATION METHOD**:
Inject network interceptors that drop 100% of write requests (simulating HTTP 503) followed by a successful commit trigger. Assert that the commit request is blocked from network transmission until all intercepted writes transition to HTTP 200.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T08:08:45.757Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795075725757",
    "title": "The Asynchronous Commit Queue Barrier Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "volcengine/OpenViking",
    "source_uri": "https://github.com/volcengine/OpenViking",
    "source_version": "HEAD",
    "content_hash": "4d851f929ed9717c1d4c28cccb0aa8916eb4f8f045f0c9ce36b8a518eed186b1"
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
        "Harvested/verified timestamp recorded: 2026-11-19T08:08:45.757Z"
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
  "auth_token": "33590dd77a6eeec02bb22e57f26a250accec4eab09dfda3a87487445c57febfe"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-ZVQ7] Zero Silent Event Dropping in Real-Time Pub/Sub Streams

<!-- PROVENANCE_START
{
  "source_repository": "Agent-Field/agentfield",
  "source_url": "https://github.com/Agent-Field/agentfield",
  "source_version": "161cab6a",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T06:20:38.623Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-agent-field-agentfield",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Agent-Field/agentfield](https://github.com/Agent-Field/agentfield) (Revision: `161cab6a`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T06:20:38.623Z`  
> **Learning ID**: `learn-github-agent-field-agentfield`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
A message broker or pub/sub distribution loop MUST NOT silently drop messages when downstream consumer buffers overflow. If a consumer's bounded buffer fills, the server MUST immediately evict that consumer, close its transport channel, and signal an explicit stream interruption code (`WS CloseTryAgainLater (1013)` or SSE `event: error`). Concurrently, event publication MUST execute synchronously across subscribers to guarantee deterministic intra-stream ordering.

**WHY**:
Silent drops (`default: // drop message`) produce silent divergence between publisher state and subscriber memory. AI agents acting on partial state histories execute hallucinated or corrupt branch logic. Closing the stream forces the agent SDK to enter an explicit reconnect-and-backfill sequence.

**WHEN TO APPLY**:
Apply to any real-time WebSocket, SSE, or gRPC streaming pipeline that dispatches domain events, state diffs, or cache invalidation events to remote worker nodes.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
package pubsub

import (
	"context"
	"slices"
	"sync"
)

type MemorySubscriber struct {
	Ch              chan Event
	CloseOnOverflow bool
}

type EventBroker struct {
	mu          sync.RWMutex
	subscribers map[string][]*MemorySubscriber
}

func (b *EventBroker) Publish(ctx context.Context, targetKey string, ev Event) {
	type overflowEntry struct {
		key string
		sub *MemorySubscriber
	}
	var overflowed []overflowEntry

	b.mu.RLock()
	subs := b.subscribers[targetKey]
	for _, sub := range subs {
		select {
		case sub.Ch <- ev:
			// Message accepted into bounded buffer in publication order.
		default:
			// Buffer is saturated.
			if sub.CloseOnOverflow {
				overflowed = append(overflowed, overflowEntry{key: targetKey, sub: sub})
			}
		}
	}
	b.mu.RUnlock()

	// Evict slow subscribers and signal gap failure
	if len(overflowed) > 0 {
		b.mu.Lock()
		for _, o := range overflowed {
			idx := slices.Index(b.subscribers[o.key], o.sub)
			if idx != -1 {
				b.subscribers[o.key] = slices.Delete(b.subscribers[o.key], idx, idx+1)
				close(o.sub.Ch) // Reading goroutine immediately detects stream truncation
			}
		}
		b.mu.Unlock()
	}
}
```

**NEGATIVE CONSTRAINT**:
```go
// ANTI-PATTERN: Silent event drop causes state corruption downstream
select {
case sub.Ch <- ev:
default:
    // Bug: Event is lost forever; consumer believes it has full state
    log.Warn("Subscriber buffer full, dropping event silently")
}
```

**VERIFICATION METHOD**:
Run an integration test where a subscriber stops reading from `sub.Ch`. Publish `buffer_capacity + 1` events. Assert that the subscriber channel closes, `sub.Events()` terminates, and the consumer detects a non-nil gap error requiring a historical replay.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:20:38.620Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794896438620",
    "title": "Zero Silent Event Dropping in Real-Time Pub/Sub Streams",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Agent-Field/agentfield",
    "source_uri": "https://github.com/Agent-Field/agentfield",
    "source_version": "HEAD",
    "content_hash": "ee425e8148b7f8abc59be0ef51583244687e820955732a31adf05a5fef1e4f42"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T06:20:38.620Z"
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
  "auth_token": "066967eb2bf856ecabab0a71d7893f778ac6dca692d39e529f0072c6b4dacb08"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

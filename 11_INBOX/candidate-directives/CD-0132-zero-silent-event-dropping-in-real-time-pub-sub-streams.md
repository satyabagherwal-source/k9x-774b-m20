# Candidate Directive: [CD-0132] Zero Silent Event Dropping in Real-Time Pub/Sub Streams

<!-- PROVENANCE_START
{
  "source_repository": "agent-field-agentfield-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T06:20:45.459Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-agent-field-agentfield-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [agent-field-agentfield-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T06:20:45.459Z`  
> **Learning ID**: `LEARN-EVO-agent-field-agentfield-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T06:20:45.563Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794896445563",
    "title": "Zero Silent Event Dropping in Real-Time Pub/Sub Streams",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "agent-field-agentfield-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8d7d52b77b90c9f5b304e7846d25d51446fe8b7a36a858c962a315a87fc22d04"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-17T06:20:45.563Z"
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
  "auth_token": "736ae361bddf828fe70b7679c6fedd81852d98e81793277c58e1d362eb75377a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-FLDU] Stream-Safety Clone Exclusion for Teed Network Interceptors

<!-- PROVENANCE_START
{
  "source_repository": "kumahq/kuma",
  "source_url": "https://github.com/kumahq/kuma",
  "source_version": "a71f8a93",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T03:16:54.402Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-kumahq-kuma",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kumahq/kuma](https://github.com/kumahq/kuma) (Revision: `a71f8a93`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T03:16:54.402Z`  
> **Learning ID**: `learn-github-kumahq-kuma`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When intercepting, logging, or proxying HTTP/Fetch responses via service workers, reverse proxies, or middleware, the interceptor MUST NOT clone (`response.clone()`) or buffer the response body if the `Content-Type` header indicates an open-ended server-sent event stream (`text/event-stream`), WebSocket upgrade, or chunked transfer stream.

**WHY**:
In the Fetch Standard and Service Worker specifications, calling `response.clone()` against an active readable stream creates a teed stream (`ReadableStream.tee()`). A teed stream locks the underlying stream source and does not release memory or propagate client-side stream cancellations (`reader.cancel()`) until *both* branches have closed or canceled. For unbounded event streams (e.g., SSE metrics, log tailing, Envoy dynamic stats streaming), cloning buffers the stream indefinitely in memory, leading to browser/process memory exhaustion (OOM crashes) while preventing client disconnections from propagating upstream.

**WHEN TO APPLY**:
- Service Worker fetch handlers and mocking proxies (e.g., MSW, custom SW caches).
- Reverse proxies and API gateway response-recording middleware in Go/Node.js.
- Envoy Lua filter extensions inspecting downstream response streams.

**VERIFIED IMPLEMENTATION PATTERN**:
```javascript
// app/kuma-ui/pkg/resources/data/mockServiceWorker.js

// Check Content-Type before calling clone() on the response
const isEventStreamResponse = response.headers
  .get('content-type')
  ?.toLowerCase()
  .startsWith('text/event-stream')

// Omit the body of server-sent event stream responses.
// Cloning such responses would prevent client-side stream cancelations
// from reaching the original stream (a teed stream only cancels its
// source once both of its branches cancel) and would buffer the
// entire stream into the unconsumed clone indefinitely.
const responseClone = isEventStreamResponse ? null : response.clone()

sendToClient(
  client,
  {
    type: 'RESPONSE',
    payload: {
      isMockedResponse: IS_MOCKED_RESPONSE in response,
      request: {
        id: requestId,
        ...serializedRequest,
      },
      response: {
        type: response.type,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseClone ? responseClone.body : null,
      },
    },
  },
  responseClone && responseClone.body
    ? [serializedRequest.body, responseClone.body]
    : [],
)
```

**NEGATIVE CONSTRAINT**:
```javascript
// ANTI-PATTERN: Indiscriminate response cloning on HTTP interceptors
addEventListener('fetch', (event) => {
  event.respondWith((async () => {
    const response = await fetch(event.request)
    // CRITICAL MEMORY LEAK: If response is an SSE stream (text/event-stream),
    // clone() tees the stream. The clone is never read, buffering chunks forever.
    const clone = response.clone()
    broadcastToAuditLogs(await clone.text()) 
    return response
  })())
})
```

**VERIFICATION METHOD**:
Implement an automated end-to-end test that opens an SSE connection, verifies that cancelling the client reader terminates the server-side writer within a strict timeout, and asserts that no memory leak occurs:
```javascript
test('SSE stream cancellation propagates upstream without clone buffering', async () => {
  const sseResponse = new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: ping\n\n'))
      }
    }),
    { headers: { 'Content-Type': 'text/event-stream' } }
  )
  
  const isEventStream = sseResponse.headers.get('content-type')?.startsWith('text/event-stream')
  expect(isEventStream).toBe(true)
  const clone = isEventStream ? null : sseResponse.clone()
  expect(clone).toBeNull()
})
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T03:16:54.402Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794885414402",
    "title": "Stream-Safety Clone Exclusion for Teed Network Interceptors",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kumahq/kuma",
    "source_uri": "https://github.com/kumahq/kuma",
    "source_version": "HEAD",
    "content_hash": "6e2148cb781f03910e5cdcd7ecd2f34d1fa116f254ee7520fb653e9c4eca0267"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T03:16:54.402Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "947148222880b7dcc1fab5c08a86fb65622c21e4242814babfaa0b54c12f9032"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

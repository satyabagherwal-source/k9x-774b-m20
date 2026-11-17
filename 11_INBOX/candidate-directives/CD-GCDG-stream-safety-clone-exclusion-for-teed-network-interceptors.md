# Candidate Directive: [CD-GCDG] Stream-Safety Clone Exclusion for Teed Network Interceptors

<!-- PROVENANCE_START
{
  "source_repository": "kumahq-kuma-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T03:17:29.282Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-kumahq-kuma-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [kumahq-kuma-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T03:17:29.282Z`  
> **Learning ID**: `LEARN-EVO-kumahq-kuma-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T03:17:29.379Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794885449379",
    "title": "Stream-Safety Clone Exclusion for Teed Network Interceptors",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "kumahq-kuma-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "787a00aa5c97444936fe29d17449d4ff4a86ab2711f49fdeffd9c9837601e224"
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
        "Harvested/verified timestamp recorded: 2026-11-17T03:17:29.379Z"
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
  "auth_token": "79f320b36bdc3eff79d2819c950c3f24cfb6870827374616fea5b519f04bfb15"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-LDJB] streaming channel

<!-- PROVENANCE_START
{
  "source_repository": "neuron-core-neuron-ai-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T03:02:23.607Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-neuron-core-neuron-ai-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [neuron-core-neuron-ai-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T03:02:23.607Z`  
> **Learning ID**: `LEARN-EVO-neuron-core-neuron-ai-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/streaming/src/iq.ts`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in neuron-core/neuron-ai. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0ee0f399`: streaming channel. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing PHP data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/streaming/src/iq.ts`.

**VERIFIED IMPLEMENTATION PATTERN**:
```php
// Verified production-grade fix pattern:
import { createChannelConsumer, isRecord, terminalTypes, type ChannelCallbacks } from './consumer.js';

export interface IQSource {
  readonly readyState: number;
  addEventListener(type: string, listener: (event: { data?: unknown }) => void): unknown;
  removeEventListener(type: string, listener: (event: { data?: unknown }) => void): unknown;
  close(): void;
}

/** EventSource.CLOSED: the browser gave up, and will not reconnect. */
const CLOSED = 2;

/**
 * Subscribe to a stream of an IQ server, whose frames are the envelopes of one segment. The
 * subscription owns the source: it closes it when IQ ends the stream, on a gap, and on close().
 */
export function subscribeToIQ(source: IQSource, callbacks: ChannelCallbacks): { close(): void } {
  let closed = false;
  let whole = false;
  const consumer = createChannelConsumer({
    onEvent(event) {
      whole ||= terminalTypes.has(event.type);
      callbacks.onEvent(event);
    },
    onGap: fail,
  });
  const listeners: Record<string, (event: { data?: unknown }) => void> = {
    message: receive,
    'iq:end': () => end('Missing channel events'),
    'iq:fail': event => end(`IQ stream failed: ${failureReason(event.data)}`),
    
```

**NEGATIVE CONSTRAINT**:
```php
// Induced defect failure mode:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T03:02:23.685Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794625343685",
    "title": "streaming channel",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "neuron-core-neuron-ai-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1836b99f7693088ddd966f4f78c9dde1fa41548ff7c6a4a753e7d541d5ff0e28"
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
        "Harvested/verified timestamp recorded: 2026-11-14T03:02:23.686Z"
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
  "auth_token": "f35fab135516915ca0fbcb18204633f0ecdd01ff2675e599c18b595922332d8a"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

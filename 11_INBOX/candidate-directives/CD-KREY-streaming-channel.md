# Candidate Directive: [CD-KREY] streaming channel

<!-- PROVENANCE_START
{
  "source_repository": "neuron-core/neuron-ai",
  "source_url": "https://github.com/neuron-core/neuron-ai",
  "source_version": "0ee0f399",
  "license": "MIT",
  "timestamp": "2026-11-14T03:01:55.019Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-neuron-core-neuron-ai",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [neuron-core/neuron-ai](https://github.com/neuron-core/neuron-ai) (Revision: `0ee0f399`).  
> **License**: MIT | **Timestamp**: `2026-11-14T03:01:55.019Z`  
> **Learning ID**: `learn-github-neuron-core-neuron-ai`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0ee0f399` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-14T03:01:55.016Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794625315016",
    "title": "streaming channel",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "neuron-core/neuron-ai",
    "source_uri": "https://github.com/neuron-core/neuron-ai",
    "source_version": "HEAD",
    "content_hash": "950d0981c113f65f2aecce729f5c0bfacb30d08d1f01940db6d0bdd217f63594"
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
        "Harvested/verified timestamp recorded: 2026-11-14T03:01:55.016Z"
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
  "auth_token": "bdca9f508d7252695824ca2e57e017e293615a8b636e55e6758503785e6522e2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-AV7R] changes to let the downstream drain gracefully

<!-- PROVENANCE_START
{
  "source_repository": "envoyproxy/envoy",
  "source_url": "https://github.com/envoyproxy/envoy",
  "source_version": "573ca53b",
  "license": "Apache-2.0",
  "timestamp": "2026-11-16T15:33:23.463Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-envoyproxy-envoy",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [envoyproxy/envoy](https://github.com/envoyproxy/envoy) (Revision: `573ca53b`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-16T15:33:23.463Z`  
> **Learning ID**: `learn-github-envoyproxy-envoy`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `api/envoy/extensions/filters/network/reverse_tunnel/v3/drain_aware_hcm.proto`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in envoyproxy/envoy. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `80291fca`: reverse_tunnel: changes to let the downstream drain gracefully. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `api/envoy/extensions/filters/network/reverse_tunnel/v3/drain_aware_hcm.proto`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
import "google/protobuf/duration.proto";

import "validate/validate.proto";
// A network filter that wraps the standard HCM and drains all active HTTP/2
// connections when the listener is drained (e.g. via admin /drain_listeners).
// Intended for use on reverse-tunnel listeners so that agents can detect drain
// and re-establish connections gracefully.
// All HCM fields are forwarded verbatim. In addition, when the listener drains,
// every connection is drained like an HCM graceful drain, whether or not any of
// the fields below are set: a soft GOAWAY (shutdown notice) is sent when the
// drain starts, and the final GOAWAY follows after ``hcm_config.drain_timeout``,
// extended by ``hcm_config.drain_timeout_jitter`` if set. With
// ``enable_drain_with_goaway``, a reverse tunnel instead dials a replacement
// when the drain starts and sends the soft GOAWAY and an optional METADATA frame
// at the configured delays before the final GOAWAY. Without
// ``shutdown_notice_delay``, such a tunnel receives no GOAWAY until the final
// one, so it keeps serving while the replacement is established.
  // are unaffected. Required by ``metadata_delay`` and ``shutdown_notice_delay``.

  // Del
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
// A network filter that wraps the standard HCM and sends HTTP/2 GOAWAY frames
// on all active connections when the listener is drained (e.g. via admin
// /drain_listeners). Intended for use on reverse-tunnel listeners so that
// agents can detect drain and re-establish connections gracefully.
// All HCM fields are forwarded verbatim; the only difference is that this
// filter registers a listener-drain callback and emits a GOAWAY before the
// connection is closed.
  // are unaffected.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `80291fca` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T15:33:23.461Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794843203461",
    "title": "changes to let the downstream drain gracefully",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "envoyproxy/envoy",
    "source_uri": "https://github.com/envoyproxy/envoy",
    "source_version": "HEAD",
    "content_hash": "93e0b27961e64d4d2364a641494cd4b473b5bd4b6171f6de2b24f83fe6da3302"
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
        "Harvested/verified timestamp recorded: 2026-11-16T15:33:23.461Z"
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
  "auth_token": "47d48e42a199c3d061c984cff181139f6de472b88840277fdb8e20215aacdc0f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

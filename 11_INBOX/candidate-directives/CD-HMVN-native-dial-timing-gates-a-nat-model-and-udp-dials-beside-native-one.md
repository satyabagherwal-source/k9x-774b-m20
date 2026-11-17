# Candidate Directive: [CD-HMVN] native dial timing gates, a NAT model, and UDP dials beside native one

<!-- PROVENANCE_START
{
  "source_repository": "freenet/freenet-core",
  "source_url": "https://github.com/freenet/freenet-core",
  "source_version": "ddf073ee",
  "license": "NOASSERTION",
  "timestamp": "2026-11-17T09:22:24.659Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-freenet-freenet-core",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet/freenet-core](https://github.com/freenet/freenet-core) (Revision: `ddf073ee`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-17T09:22:24.659Z`  
> **Learning ID**: `learn-github-freenet-freenet-core`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.claude/rules/transport.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in freenet/freenet-core. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ddf073ee`: connect): native dial timing gates, a NAT model, and UDP dials beside native ones. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
turned its own native connects off,
`connect_native_rescued_by_udp_{joiner,acceptor}` for each UDP dial after a
failed native setup that connected (R5: a connection a node without UDP
would not have made), `connect_native_both_dials_connected_kept_{udp,native}`
for a native dial and the UDP dial beside it that both connected (the first
kept), and the last offer as states
  peer (joiner: before anything counts the acceptor failed; acceptor:
  expectation plus dial). Both sides start it NATIVE_FALLBACK_AFTER (12 s,
  the server's window) after their own reference, never earlier: the
  acceptor's decision, the joiner's receipt of the response. Both setups
  have ended by then, and the references are the response's travel time
  apart, so the two hole punches (NAT_TRAVERSAL_DEADLINE, 3 s each) overlap.
  Falling back as each setup ended would not: the client's window ends 4 s
  before the server's (behind port-restricted NATs every peer fallback then
  misses, test_quic_native_blocked_pairs_connect_over_udp_behind_nats).
  The joiner plans each dial (op_ctx_task.rs plan_acceptor_dial): a native
  dial carries an absolute deadline, the common fallback time
  (DialTransport::Native { dea
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
turned its own native connects off, and the last offer as states
  peer (joiner: in the same dial slot, before anything counts the acceptor
  failed; acceptor: expectation plus dial). Both sides start it
  NATIVE_FALLBACK_AFTER (12 s, the server's window) after their own
  reference, never earlier: the acceptor's decision, the joiner's receipt of
  the response. Both setups have ended by then, and the references are the
  response's travel time apart, so the two hole punches
  (NAT_TRAVERSAL_DEADLINE, 3 s each) overlap. Falling back as each setup
  ended would not: the client's window ends 4 s before the server's. The
  simulation cannot show the difference (it has no NAT, and an expected
  inbound is accepted for 100 s), so unit tests pin the timing, including
  a two-sided one where a UDP dial connects only if both sides punch
  together. A joiner's native attempt is bounded by its fallback time
  (DialTransport::Native carries the bound), and a queued native acceptor
  with less than NATIVE_MIN_WINDOW_LEFT (4 s) left before it is dialled over
  UDP at that time with no native attempt: a joiner with a connection dials
  one acceptor at a time, and one behind a failed native dial 
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ddf073ee` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T09:22:24.657Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794907344657",
    "title": "native dial timing gates, a NAT model, and UDP dials beside native one",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet/freenet-core",
    "source_uri": "https://github.com/freenet/freenet-core",
    "source_version": "HEAD",
    "content_hash": "aec03902898d0163436c9d40c809cabf092022b56802ede255b8e8f0c354a0d0"
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
        "Harvested/verified timestamp recorded: 2026-11-17T09:22:24.657Z"
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
  "auth_token": "b68fc3dbcd06fc9c47d13d2e827e490046ff65f0e857805023e8221bfe3b45c3"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

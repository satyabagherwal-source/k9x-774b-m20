# Candidate Directive: [CD-O5JZ] connect): native dial timing gates, a NAT model, and UDP dials beside native one

<!-- PROVENANCE_START
{
  "source_repository": "freenet-freenet-core-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T09:27:28.680Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-freenet-freenet-core-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet-freenet-core-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T09:27:28.680Z`  
> **Learning ID**: `LEARN-EVO-freenet-freenet-core-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T09:27:28.798Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794907648798",
    "title": "connect): native dial timing gates, a NAT model, and UDP dials beside native one",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet-freenet-core-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "4926148245fbe514eae7c12b09a4ac4f82e4e3959371a46b9dc40a8c4056798d"
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
        "Harvested/verified timestamp recorded: 2026-11-17T09:27:28.798Z"
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
  "auth_token": "c0f10c95806e9d376e6bc435b753944a656a3ac524fb6e693a879985716d8360"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

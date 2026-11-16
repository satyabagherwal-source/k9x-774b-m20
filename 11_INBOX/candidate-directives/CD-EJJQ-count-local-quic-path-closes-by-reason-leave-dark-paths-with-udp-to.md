# Candidate Directive: [CD-EJJQ] count local QUIC path closes by reason; leave dark paths with UDP to

<!-- PROVENANCE_START
{
  "source_repository": "freenet/freenet-core",
  "source_url": "https://github.com/freenet/freenet-core",
  "source_version": "bce01abd",
  "license": "NOASSERTION",
  "timestamp": "2026-11-16T12:48:17.270Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-freenet-freenet-core",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet/freenet-core](https://github.com/freenet/freenet-core) (Revision: `bce01abd`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-16T12:48:17.270Z`  
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
Prevents defects observed in production commit `61dfd129`: transport): count local QUIC path closes by reason; leave dark paths with UDP to the idle timeout. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  endpoint_down, session_ended_rx, over_budget_rx, liveness_tx, closed_tx. Paths that had been active only; an attempt
  that ends in setup is counted in `quic_upgrade_*`. A close this node sent
  reaches the machine as a lost connection; since 0.2.159 the driver counts it
  by the reason the closer recorded (`QuicCloser::close_for`, read at the
  count, `driver::fallback_label`): `liveness_tx` for the acknowledgement
  watch's rules and the stalled-sends count (which rule: quic_stall_close_*),
  `closed_tx` for every other recorded reason (send aborts, a peer over its
  budget, refused data, a panicked receive task). A close with no recorded
  reason, and a real reset, stay `reset`. Releases before 0.2.159 count all of
  these as `reset`. A key mismatch is `quic_upgrade_identity_mismatch`.
    (sum over c in idle, reset, protocol, downgrade_rx, over_budget_rx,
       liveness_tx, closed_tx of
  dark-path rule closes only a path that carries data (QuicPath::enable_data)
  and has no UDP session (a native path, recycle::DARK_CLOSES_WITH_UDP);
  on every other path (shadow paths, pairs outside the ramp's share, and data
  paths with a UDP session) it only counts, so the field shows h
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
  endpoint_down, session_ended_rx, over_budget_rx. Paths that had been active only; an attempt
  that ends in setup is counted in `quic_upgrade_*`. A close this node sent for
  send_abort_limit or peer_not_acknowledging reaches the machine as a lost
  connection, so it counts as `reset`; its count is `quic_close_sent_*`. A key
  mismatch is `quic_upgrade_identity_mismatch`.
    (sum over c in idle, reset, protocol, downgrade_rx, over_budget_rx of
  dark-path rule closes only a path that carries data (QuicPath::enable_data);
  on every other path (shadow paths, and pairs outside the ramp's share) it
  only counts, so the field shows how long real dark spells last. A spell is read
  for at most SHORT_ACK_WAIT (120 s), after which its stream is reset,
    (a_dark_path_takes_no_new_data_long_before_the_watch_closes_it). So a
    Closes only a path that carries data (QuicPath::enable_data); every
    other path only counts its dark episodes (quic_dark_episode_*, above).
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `61dfd129` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T12:48:17.268Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794833297268",
    "title": "count local QUIC path closes by reason; leave dark paths with UDP to",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet/freenet-core",
    "source_uri": "https://github.com/freenet/freenet-core",
    "source_version": "HEAD",
    "content_hash": "29f43fa713fdcbf9a271c56ed98087cfb4c7c06d59bbe145ace48f7dcf1614db"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-16T12:48:17.268Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "041bbc604b1c73ae7c000950b130a5af31a6852ad6b5326bf7fe1ad71d75ff9d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

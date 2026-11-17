# Candidate Directive: [CD-QBF8] peers trip the crash breaker only on QUIC-panic short runs

<!-- PROVENANCE_START
{
  "source_repository": "freenet/freenet-core",
  "source_url": "https://github.com/freenet/freenet-core",
  "source_version": "3bd9f72f",
  "license": "NOASSERTION",
  "timestamp": "2026-11-17T19:45:01.268Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-freenet-freenet-core",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet/freenet-core](https://github.com/freenet/freenet-core) (Revision: `3bd9f72f`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-17T19:45:01.268Z`  
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
Prevents defects observed in production commit `17141a5c`: quic): peers trip the crash breaker only on QUIC-panic short runs. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
(`quic_breaker_trips`; for every peer, and a gateway on Windows, counted for
runs in a row (two on a peer while UDP exists, so it trips before the
post-update rollback's three crashes; three on a gateway) that ended
transport/quic, by panic location), each starting within 24 h of the one before,
and for a unix gateway for any abnormal end of a QUIC-enabled run, not only a
QUIC fault;
elsewhere, since a gateway's breaker cannot trip without a boot identity) decides whether `bind_udp_listener` builds a quinn endpoint over the DemuxSocket.
except where a restart after SIGKILL would trip a unix gateway's breaker; a
peer's short-run rule does not count a SIGKILL), and the
against the previous release, and peers with `quic_breaker_suppressed`. Since
unix peers moved to the short-run rule (#6151), it also reads
`quic_breaker_start` by version: trips with their `quic_panic_at`, and on unix
peers how often `legacy_verdict` and `verdict` disagree. A
    contained aborts the process. On a unix gateway the next start trips the
    breaker (quic_breaker_trips, see quic/breaker.rs): QUIC off for 15 min
    (doubling on repeat trips up to 4 h), and a supervised gateway restarts
    itself with ex
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
(`quic_breaker_trips`, on unix counted for any abnormal end of a QUIC-enabled
run, not only a QUIC fault, and on Windows for three runs in a row that ended
transport/quic, by panic location), each starting within 24 h of the one before;
elsewhere, since the breaker cannot trip without a boot identity) decides whether `bind_udp_listener` builds a quinn endpoint over the DemuxSocket.
except where a restart after SIGKILL would trip the breaker), and the
against the previous release, and peers with `quic_breaker_suppressed`. A
    contained aborts the process. On unix the next start trips the breaker
    (quic_breaker_trips, see quic/breaker.rs): QUIC off for 24 h on a peer,
    15 min on a gateway (doubling on repeat trips up to 4 h), which, when
    supervised, restarts itself with exit 42 at the cooldown's end
    (breaker::quic_restore_at). On Windows the
    and recorded one, so the fourth start after three such aborts in a row
    trips it. An ordinary stop records no panic and never counts; an abort
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `17141a5c` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T19:45:01.266Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794944701266",
    "title": "peers trip the crash breaker only on QUIC-panic short runs",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet/freenet-core",
    "source_uri": "https://github.com/freenet/freenet-core",
    "source_version": "HEAD",
    "content_hash": "1779e2d0ceac1ce6909ddd66b07e1dac34e858ffbe6d670a0d4e8acf2e561e72"
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
        "Harvested/verified timestamp recorded: 2026-11-17T19:45:01.266Z"
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
  "auth_token": "00adb7d7e0c9f1c02dc7a748da2edf5f736f827897eec5f202622e28c9481ff0"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

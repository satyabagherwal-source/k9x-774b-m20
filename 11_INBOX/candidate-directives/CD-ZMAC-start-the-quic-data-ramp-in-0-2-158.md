# Candidate Directive: [CD-ZMAC] start the QUIC data ramp in 0.2.158

<!-- PROVENANCE_START
{
  "source_repository": "freenet/freenet-core",
  "source_url": "https://github.com/freenet/freenet-core",
  "source_version": "effd674b",
  "license": "NOASSERTION",
  "timestamp": "2026-11-16T01:52:49.812Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-freenet-freenet-core",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [freenet/freenet-core](https://github.com/freenet/freenet-core) (Revision: `effd674b`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-16T01:52:49.812Z`  
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
Prevents defects observed in production commit `effd674b`: transport): start the QUIC data ramp in 0.2.158. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.claude/rules/transport.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
sends its data on the path ("QUIC send route" below). The tree sets the ramp
start for 0.2.158 (#6224), so `prefer` nodes, every Linux, macOS and Windows node
that did not set the key, carry data with the ramp's share, and 0.2.158's release
notes say so. With no ramp start (the emergency-stop build) and no
bit, which stays 0. Off: no endpoint, no QUIC ingress, nothing
release it runs, so a default-off release is the kill switch for QUIC as a
whole. Stopping only the data ramp is smaller: `QUIC_DATA_RAMP_START = None`
with the defaults back to 0.2.156's, shadow on Linux and macOS and off on
Windows (RELEASING.md, "Emergency stop"), which keeps Linux and macOS
endpoints and shadow paths up. Neither reaches
  no ramp, share 0). The start is set for 0.2.158 (#6224, 2026-11-16 02:30 UTC),
  in its own reviewed PR at the planned publish time, and left set: past 24 h it
  reads 100%, the steady state. Only an emergency stop sets it back to `None`. A node whose clock reads before the start gets
  on every other path (shadow paths, and pairs outside the ramp's share) it
  only counts, so the field shows how long real dark spells last. A spell is read
  threshold (the 10 s window) was not re
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
sends its data on the path ("QUIC send route" below). With no ramp start and no
bit, which stays 0. The release that sets the ramp start must say in its notes that
`prefer` nodes, every Linux, macOS and Windows node that did not set the key, start
carrying data. Off: no endpoint, no QUIC ingress, nothing
release it runs, so a default-off release is the kill switch. It does not reach
  no ramp, share 0). The start is `None` in tree and set in its own reviewed PR to
  the planned publish time, just before the release's soak, and left set: past 24 h
  it reads 100%, the steady state. A node whose clock reads before the start gets
  on every other path (all of them while QUIC_DATA_PERCENT is 0) it only
  counts, so the field shows how long real dark spells last. A spell is read
  threshold (the 10 s window) is to be revisited from these numbers before the
  data ramp passes 5%.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `effd674b` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-16T01:52:49.810Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794793969810",
    "title": "start the QUIC data ramp in 0.2.158",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "freenet/freenet-core",
    "source_uri": "https://github.com/freenet/freenet-core",
    "source_version": "HEAD",
    "content_hash": "c6b30f31d4a40eb37da89437f65ca3924f0bb2b0193629ce996da82e963f1f10"
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
        "Harvested/verified timestamp recorded: 2026-11-16T01:52:49.810Z"
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
  "auth_token": "1a02040357b45e3c2b1bf0fd00bd668c72349e6439b7707d360b83135f53907b"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

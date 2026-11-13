# Candidate Directive: [CD-H2E0] Full screen's plan and step file: the live loopback gate's result

<!-- PROVENANCE_START
{
  "source_repository": "Saffsanity/sill",
  "source_url": "https://github.com/Saffsanity/sill",
  "source_version": "bf69067f",
  "license": "Apache-2.0",
  "timestamp": "2026-11-13T15:47:11.832Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-saffsanity-sill",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Saffsanity/sill](https://github.com/Saffsanity/sill) (Revision: `bf69067f`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-13T15:47:11.832Z`  
> **Learning ID**: `learn-github-saffsanity-sill`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `docs/full-screen-plan.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Saffsanity/sill. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1b04b5f7`: Full screen's plan and step file: the live loopback gate's result. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/full-screen-plan.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
- **G4, live on loopback**, at 67039ddd from 18:12 to 18:17, once Noah had disconnected his devices (a device was on
  Sill.app at 16:30 and 16:56, so it waited; `Scripts/encoder-check/no-device.sh` said "OK: no device connected"
  before every case): `SillHost --synthetic` (loopback only, the software encoder, no router, no screen, the
  dry-run input log) and the app's Debug build under `-SillLive 1` on the agents' iPad simulator, an input script
  tapping, pressing keys and typing every 0.1 s for a second around each change. Five cases, every one as it should:
  - An iPhone 15 Pro's size upright: hidden at 4 s, back at 7, hidden at 10, back by a shake at 13 (Shake to Show
    Controls on), hidden at 16, back by a played swipe in at 18.8: the viewport 377×235 twice as it connected, then
    393×793 and 377×235, one per change, six; every input at the host (39 taps, each down and up; 24 keys and 12
    letters).
  - An iPad mini on its side, the same: 1117×618 as it connected, then 1133×744 and 1117×618, one per change; every
    input at the host.
  - The Desktop on the Mac's second screen (two test screens): the device's own Desktop button ("Desktop 1") stepped
    the host to d
```

**NEGATIVE CONSTRAINT**:
```swift
// Anti-pattern to NEVER write (induced failure mode):
- **G4, live on loopback: not run.** Noah was testing on his devices: a device was streaming from Sill.app at 16:30
  and at 16:56, and the gate keeps the rule (`Scripts/encoder-check/no-device.sh`: nothing that could share the
  Mac's encoder while a device is connected), though its host uses the software encoder. The first build's run of
  it (below) covered the same paths a hide and a show take (the viewport one per change, input around each change,
  the Desktop kept on screen 2); what is new since is the swipe in's own recognizer, which the touch rig drove with
  real synthesized touches in both orientations, and Shake to Show Controls, whose off case the gate adds
  (`phone-up-shake-off`).
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1b04b5f7` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T15:47:11.830Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0.51,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 51%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=FAIL.",
  "item": {
    "id": "cand-1794584831830",
    "title": "Full screen's plan and step file: the live loopback gate's result",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Saffsanity/sill",
    "source_uri": "https://github.com/Saffsanity/sill",
    "source_version": "HEAD",
    "content_hash": "36158209177efd3fe986a208e1598fc989465878f672b9087fb771f362bd0a9c"
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
      "status": "FAIL",
      "score": 0.4,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": true,
      "opposing_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "unsupported_assumptions": [],
      "findings": [
        "DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write')"
      ],
      "details": [
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
        "Harvested/verified timestamp recorded: 2026-11-13T15:47:11.830Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "FAIL",
      "score": 0.4,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": true,
      "conflicting_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "findings": [
        "CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
      ],
      "details": []
    }
  },
  "detected_contradictions": [
    "Canonical opposition: Clashes with RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
    "Conflict with RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
  ],
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
  "auth_token": "37667f5ecefd0f92eaffa2bc69f6647a83a9fcce281e8a0e9f3b7fb48a073466"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

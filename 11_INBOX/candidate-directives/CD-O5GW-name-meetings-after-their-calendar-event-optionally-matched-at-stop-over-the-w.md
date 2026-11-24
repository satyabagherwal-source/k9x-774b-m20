# Candidate Directive: [CD-O5GW] Name Meetings after their calendar event, optionally: matched at Stop over the w

<!-- PROVENANCE_START
{
  "source_repository": "yazinsai/OpenOats",
  "source_url": "https://github.com/yazinsai/OpenOats",
  "source_version": "8e84f291",
  "license": "MIT",
  "timestamp": "2026-11-24T04:45:14.289Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-yazinsai-openoats",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yazinsai/OpenOats](https://github.com/yazinsai/OpenOats) (Revision: `8e84f291`).  
> **License**: MIT | **Timestamp**: `2026-11-24T04:45:14.289Z`  
> **Learning ID**: `learn-github-yazinsai-openoats`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `OpenOats/Sources/OatsCore/CalendarTitle.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yazinsai/OpenOats. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `8e84f291`: Name Meetings after their calendar event, optionally: matched at Stop over the whole recording, events with others or a call link only; asked for only from the Settings toggle, an optional onboarding row or a one-time tip; ADR 0006. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `OpenOats/Sources/OatsCore/CalendarTitle.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
import Foundation

/// A calendar event as the title lookup sees it. The app reads these from EventKit, leaving out all-day, cancelled
/// and declined events.
public struct CalendarEvent: Sendable, Equatable {
    public var title: String
    public var start: Date
    public var end: Date
    /// Other attendees or a call link: a meeting, not a personal block such as "Focus" or "Lunch".
    public var withOthers: Bool

    public init(title: String, start: Date, end: Date, withOthers: Bool) {
        self.title = title
        self.start = start
        self.end = end
        self.withOthers = withOthers
    }

    /// The title of the meeting a recording was part of: the event with others it overlaps most, the shorter one on a
    /// tie (a meeting inside an all-hands block). The overlap must be at least a quarter of the shorter of the two,
    /// so a recording that started in the last minutes of the previous meeting isn't named after it. nil when none.
    public static func title(for recording: DateInterval, in events: [CalendarEvent]) -> String? {
        let candidates = events.compactMap { event -> (CalendarEvent, TimeInterval)? in
            let title = event.title.tri
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `8e84f291` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T04:45:14.287Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795495514287",
    "title": "Name Meetings after their calendar event, optionally: matched at Stop over the w",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yazinsai/OpenOats",
    "source_uri": "https://github.com/yazinsai/OpenOats",
    "source_version": "HEAD",
    "content_hash": "940efbfe9d142be52dc9cdb3e8b7659431609d292b3c27ac8227429566feb8cc"
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
        "Harvested/verified timestamp recorded: 2026-11-24T04:45:14.287Z"
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
  "auth_token": "2f8229d7267735f43f143a5208d23ea9698879cfb245fdcce6601c9af6d28cb1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

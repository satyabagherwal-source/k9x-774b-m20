# Candidate Directive: [CD-S735] keep the Dock icon hidden when macOS opens a running Purge

<!-- PROVENANCE_START
{
  "source_repository": "jithin-sabu/purge-app",
  "source_url": "https://github.com/jithin-sabu/purge-app",
  "source_version": "7f2412e2",
  "license": "MIT",
  "timestamp": "2026-11-24T04:20:23.393Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-jithin-sabu-purge-app",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [jithin-sabu/purge-app](https://github.com/jithin-sabu/purge-app) (Revision: `7f2412e2`).  
> **License**: MIT | **Timestamp**: `2026-11-24T04:20:23.393Z`  
> **Learning ID**: `learn-github-jithin-sabu-purge-app`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain I

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `PurgeTests/DockIconPolicyTests.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in jithin-sabu/purge-app. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `84a40b77`: keep the Dock icon hidden when macOS opens a running Purge. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `PurgeTests/DockIconPolicyTests.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:

        /// Held until the test ends the modal, as the real run loop holds it.
        private var waitingForModal: [() -> Void] = []

        func afterModalEnds(_ work: @escaping () -> Void) { waitingForModal.append(work) }

        func endModal() {
            isShowingModal = false
            let work = waitingForModal
            waitingForModal = []
            work.forEach { $0() }
        }
    /// The watcher's link opens Purge, which macOS answers by making it a regular
    /// app (#438). Hiding the Dock icon again there must not bring back a window
    /// the user closed: SwiftUI keeps a closed window, so it counts as revealable.
    @Test("Hiding again after an open leaves a closed window closed")
    func hidingWithoutRevealLeavesTheWindowAlone() {
        let host = FakeHost()

        DockIconPolicy.apply(hidesDockIcon: true, revealsWindow: false, host: host)

        #expect(host.calls == [.setPolicy(.accessory)])
    }

    /// A reopen is the user asking for the window, so it keeps the reveal.
    @Test("Hiding again after a reopen still re-fronts the window")
    func hidingWithRevealAfterReopen() {
        let host = FakeHost()

        DockIconPolicy.apply
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `84a40b77` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-24T04:20:23.391Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795494023391",
    "title": "keep the Dock icon hidden when macOS opens a running Purge",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "jithin-sabu/purge-app",
    "source_uri": "https://github.com/jithin-sabu/purge-app",
    "source_version": "HEAD",
    "content_hash": "8fa8d58109a43eedfd2c9812ee028769e28a0ffe9d7cdf394c796837e5ed66af"
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
        "Harvested/verified timestamp recorded: 2026-11-24T04:20:23.391Z"
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
  "auth_token": "c7f39b740b77b9276662acb8aa5dbd4da9ba517baddd19eb01edb9b71c1578a9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

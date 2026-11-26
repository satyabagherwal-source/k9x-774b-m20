# Candidate Directive: [CD-LFW0] Rebuild a mic the headset rebound; don't blame mics for route changes; pad track

<!-- PROVENANCE_START
{
  "source_repository": "yazinsai/OpenOats",
  "source_url": "https://github.com/yazinsai/OpenOats",
  "source_version": "d8caac78",
  "license": "MIT",
  "timestamp": "2026-11-26T15:02:19.824Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-yazinsai-openoats",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yazinsai/OpenOats](https://github.com/yazinsai/OpenOats) (Revision: `d8caac78`).  
> **License**: MIT | **Timestamp**: `2026-11-26T15:02:19.824Z`  
> **Learning ID**: `learn-github-yazinsai-openoats`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `OpenOats/Sources/OatsCapture/LiveCapture.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yazinsai/OpenOats. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d8caac78`: Rebuild a mic the headset rebound; don't blame mics for route changes; pad tracks at Stop. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `OpenOats/Sources/OatsCapture/LiveCapture.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    /// Last default-device change or mic hardware format change, on the `Activity` clock.
    private var routeChangedAt = -TimeInterval.infinity
    private var micRebuiltAt = -TimeInterval.infinity
            listen(kAudioHardwarePropertyDefaultInputDevice) { $0.routeChanged(rebuildMic: true) }
                $0.routeChanged(rebuildMic: false)
    /// A default device or the mic's hardware format changed: every mic is eligible again, and silence that follows
    /// isn't held against the mic.
    private func routeChanged(rebuildMic: Bool) {
        let now = ProcessInfo.processInfo.systemUptime
        routeChangedAt = now
        stalledMics = []
        if rebuildMic { rebuild(.mic, deviceChanged: true, after: Self.routeRebuildDelay(sinceLast: now - micRebuiltAt)) }
    }

    /// A burst of route changes causes one rebuild, and at most one every 2 s.
    static func routeRebuildDelay(sinceLast: TimeInterval) -> TimeInterval {
        max(0.5, 2 - sinceLast)
    }

    /// Whether a mic silent for `silentFor` seconds is to blame: not if a route changed shortly before it went silent.
    static func blamesMic(silentFor: TimeInterval, sinceRouteChange: TimeInterval) -> Bool 
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
            listen(kAudioHardwarePropertyDefaultInputDevice) { $0.rebuild(.mic, deviceChanged: true) }
                $0.stalledMics = []
    private func rebuild(_ track: Track, deviceChanged: Bool) {
        queue.asyncAfter(deadline: .now() + (deviceChanged ? 0.5 : 0), execute: item)
        if mic.activity.age >= Self.stallAfter, pending[.mic] == nil {
            stalledMics.insert(mic.device)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d8caac78` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T15:02:19.822Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795705339822",
    "title": "Rebuild a mic the headset rebound; don't blame mics for route changes; pad track",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yazinsai/OpenOats",
    "source_uri": "https://github.com/yazinsai/OpenOats",
    "source_version": "HEAD",
    "content_hash": "b3a216fe57e8b68f9ac0b95314cd968bd82b5f4664a9698e96c46773ecb00ca0"
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
        "Harvested/verified timestamp recorded: 2026-11-26T15:02:19.822Z"
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
  "auth_token": "138df8642fca96126c531abd6e6fbc2e7a6c3c1c148d0642dfd1ed2279deaadf"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

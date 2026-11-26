# Candidate Directive: [CD-LOW4] Rebuild a mic the headset rebound; don't blame mics for route changes; pad track

<!-- PROVENANCE_START
{
  "source_repository": "yazinsai-openoats-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T15:02:31.359Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-yazinsai-openoats-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yazinsai-openoats-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T15:02:31.359Z`  
> **Learning ID**: `LEARN-EVO-yazinsai-openoats-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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
  "validated_at": "2026-11-26T15:02:31.489Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795705351489",
    "title": "Rebuild a mic the headset rebound; don't blame mics for route changes; pad track",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "yazinsai-openoats-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "b3a216fe57e8b68f9ac0b95314cd968bd82b5f4664a9698e96c46773ecb00ca0"
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
        "Harvested/verified timestamp recorded: 2026-11-26T15:02:31.490Z"
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
  "auth_token": "b6ab199cbd21fcf23e7ada454ec821c29d8f6eea44ee7d48905751a603e0fdd9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

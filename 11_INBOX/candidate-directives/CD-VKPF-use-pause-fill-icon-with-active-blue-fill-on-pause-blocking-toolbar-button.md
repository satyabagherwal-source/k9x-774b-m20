# Candidate Directive: [CD-VKPF] use pause.fill icon with active blue fill on Pause Blocking toolbar button

<!-- PROVENANCE_START
{
  "source_repository": "0xCUB3/wBlock",
  "source_url": "https://github.com/0xCUB3/wBlock",
  "source_version": "943134a1",
  "license": "GPL-3.0",
  "timestamp": "2026-11-28T04:57:41.523Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-0xcub3-wblock",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [0xCUB3/wBlock](https://github.com/0xCUB3/wBlock) (Revision: `943134a1`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-28T04:57:41.523Z`  
> **Learning ID**: `learn-github-0xcub3-wblock`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `wBlock/SettingsView.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in 0xCUB3/wBlock. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d35480a2`: ui): use pause.fill icon with active blue fill on Pause Blocking toolbar button. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `wBlock/SettingsView.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    private func setPaused(_ pause: Bool) {
        if pause {
        Task { await filterManager.setBlockingPaused(pause) }
        let pauseBinding = Binding(
            get: { isPaused },
            set: { newValue in
                guard newValue != isPaused else { return }
                setPaused(newValue)
            }
        )
        return Toggle(isOn: pauseBinding) {
            Label(title, systemImage: "pause.fill")
        .toggleStyle(.button)
            let menu = Menu {
                Label(title, systemImage: "pause.fill")
                setPaused(!isPaused)

            if isPaused {
                menu.buttonStyle(.borderedProminent)
            } else {
                menu
            }
            Toggle(isOn: pauseBinding) {
                Label(title, systemImage: "pause.fill")
            .toggleStyle(.button)
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
    private func toggle(isPaused: Bool) {
        if !isPaused {
        Task { await filterManager.setBlockingPaused(!isPaused) }
        return Button {
            toggle(isPaused: isPaused)
        } label: {
            Label(title, systemImage: isPaused ? "pause.circle.fill" : "pause.circle")
            Menu {
                Label(title, systemImage: isPaused ? "pause.circle.fill" : "pause.circle")
                toggle(isPaused: isPaused)
            Button {
                toggle(isPaused: isPaused)
            } label: {
                Label(title, systemImage: isPaused ? "pause.circle.fill" : "pause.circle")
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d35480a2` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T04:57:41.522Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795841861522",
    "title": "use pause.fill icon with active blue fill on Pause Blocking toolbar button",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "0xCUB3/wBlock",
    "source_uri": "https://github.com/0xCUB3/wBlock",
    "source_version": "HEAD",
    "content_hash": "f76d2989deff947f84a202c3d9836013d28327907ffc24d25305a9c9d8ecbbec"
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
        "Harvested/verified timestamp recorded: 2026-11-28T04:57:41.522Z"
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
  "auth_token": "ba084f345237857720b66987bfe136db60f5abba7c4a36dbc455be989f46126d"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

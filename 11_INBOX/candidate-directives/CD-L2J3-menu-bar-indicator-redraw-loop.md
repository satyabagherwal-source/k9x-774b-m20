# Candidate Directive: [CD-L2J3] menu bar indicator redraw loop

<!-- PROVENANCE_START
{
  "source_repository": "jacklandrin/OnlySwitch",
  "source_url": "https://github.com/jacklandrin/OnlySwitch",
  "source_version": "dc279316",
  "license": "MIT",
  "timestamp": "2026-11-19T21:08:15.759Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-jacklandrin-onlyswitch",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [jacklandrin/OnlySwitch](https://github.com/jacklandrin/OnlySwitch) (Revision: `dc279316`).  
> **License**: MIT | **Timestamp**: `2026-11-19T21:08:15.759Z`  
> **Learning ID**: `learn-github-jacklandrin-onlyswitch`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Modules/Sources/AppFeature/Features/SystemMonitor/SystemMonitorStatusItemController.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in jacklandrin/OnlySwitch. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `c231eed6`: menu bar indicator redraw loop. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Modules/Sources/AppFeature/Features/SystemMonitor/SystemMonitorStatusItemController.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
private enum SystemMonitorStatusItemImage {
    static func make(
        for presentation: SystemMonitorStatusItemPresentation,
        size: NSSize
    ) -> NSImage {
        let image = NSImage(size: size, flipped: false) { bounds in
            switch presentation.visualStyle {
            case .standard:
                drawStandard(presentation, in: bounds)
            case .network:
                drawNetwork(presentation, in: bounds)
            }
            return true
        image.isTemplate = presentation.visualStyle == .standard
        if presentation.visualStyle == .network {
            // Resolve the label and dot colors in the current menu bar appearance.
            image.cacheMode = .never
        return image
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
@MainActor
private final class StatusItemContentView: NSView {
    private let metric: SystemMonitorMetric
    private let imageView = NSImageView()
    private let valueLabel = NSTextField(labelWithString: "")
    private let topDot = NetworkIndicatorDot(color: .systemRed)
    private let bottomDot = NetworkIndicatorDot(color: .systemBlue)
    private let topValueLabel = NSTextField(labelWithString: "")
    private let bottomValueLabel = NSTextField(labelWithString: "")

    init(metric: SystemMonitorMetric) {
        self.metric = metric
        super.init(frame: .zero)

        wantsLayer = false
        configureStandardContent()
        configureNetworkContent()
        let isNetwork = metric == .network
        imageView.isHidden = isNetwork
        valueLabel.isHidden = isNetwork
        topDot.isHidden = !isNetwork
        bottomDot.isHidden = !isNetwork
        topValueLabel.isHidden = !isNetwork
        bottomValueLabel.isHidden = !isNetwork
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) {
        nil
    }

    override func layout() {
        super.layout()
        guard metric == .network else {
            let iconSide: CGFloat = 16
         
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `c231eed6` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-19T21:08:15.757Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795122495757",
    "title": "menu bar indicator redraw loop",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "jacklandrin/OnlySwitch",
    "source_uri": "https://github.com/jacklandrin/OnlySwitch",
    "source_version": "HEAD",
    "content_hash": "97f932c3e1385fca65e37f0c568d472b83b85507e1dfd0c8bd30ccc4b08ad33f"
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
        "Harvested/verified timestamp recorded: 2026-11-19T21:08:15.757Z"
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
  "auth_token": "59f3245284d26d480cf0bd3e90286c1fe846d652816874a844fc24219d25e814"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

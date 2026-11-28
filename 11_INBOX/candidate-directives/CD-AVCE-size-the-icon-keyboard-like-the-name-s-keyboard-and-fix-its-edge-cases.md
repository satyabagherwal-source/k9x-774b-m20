# Candidate Directive: [CD-AVCE] Size the icon keyboard like the name's keyboard, and fix its edge cases

<!-- PROVENANCE_START
{
  "source_repository": "rafsoh/dimeApp",
  "source_url": "https://github.com/rafsoh/dimeApp",
  "source_version": "700ce940",
  "license": "GPL-3.0",
  "timestamp": "2026-11-28T14:29:27.470Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rafsoh-dimeapp",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rafsoh/dimeApp](https://github.com/rafsoh/dimeApp) (Revision: `700ce940`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-28T14:29:27.470Z`  
> **Learning ID**: `learn-github-rafsoh-dimeapp`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `app/dime/Views/AccountsView.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in rafsoh/dimeApp. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `470eba78`: Size the icon keyboard like the name's keyboard, and fix its edge cases. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `app/dime/Views/AccountsView.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    /// Used until the name's keyboard has been seen, such as with a hardware keyboard.
    static let fallbackHeight: CGFloat = 270
    /// Four rows of icons.
    static let minimumHeight: CGFloat = 240

        weak var host: AccountIconKeyboardHost?
        /// How tall the name's keyboard is, so the icons can be as tall and the sheet above them stays put.
        private var textKeyboardHeight: CGFloat?
        /// What the system adds below a custom keyboard, such as room for the home indicator. Measured the first
        /// time the icons show.
        private static var systemPadding: CGFloat?
        private var observer: NSObjectProtocol?
            observer = NotificationCenter.default.addObserver(forName: UIResponder.keyboardWillChangeFrameNotification, object: nil, queue: .main) { [weak self] notification in
                guard let frame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect else { return }
                self?.keyboardWillChange(to: frame.height)
            }
        }

        deinit {
            if let observer {
                NotificationCenter.default.removeObserver(observer)
            }

        /// Makes the icon
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
        let hosting = UIHostingController(rootView: AccountIconKeyboardContent(selection: selection, onPick: onPick))
        let keyboard = UIInputView(frame: CGRect(x: 0, y: 0, width: UIScreen.main.bounds.width, height: 270), inputViewStyle: .keyboard)
        context.coordinator.isActive = $isActive
    
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `470eba78` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T14:29:27.469Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795876167469",
    "title": "Size the icon keyboard like the name's keyboard, and fix its edge cases",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rafsoh/dimeApp",
    "source_uri": "https://github.com/rafsoh/dimeApp",
    "source_version": "HEAD",
    "content_hash": "26ca3256f06c7dfe7a9a0c5959bca79d81a689dd26a4919ab1a8db763719f8aa"
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
        "Harvested/verified timestamp recorded: 2026-11-28T14:29:27.469Z"
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
  "auth_token": "76e3fba7f47d0c3a7a63606c450b1a8c67fcb5a2754c3ad1302edca1a55f1960"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

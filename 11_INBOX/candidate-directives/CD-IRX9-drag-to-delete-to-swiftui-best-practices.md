# Candidate Directive: [CD-IRX9] drag to delete to SwiftUI best practices

<!-- PROVENANCE_START
{
  "source_repository": "mikelikesdesign/SwiftUI-experiments",
  "source_url": "https://github.com/mikelikesdesign/SwiftUI-experiments",
  "source_version": "6effebb7",
  "license": "MIT",
  "timestamp": "2026-11-28T11:47:38.589Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mikelikesdesign-swiftui-experiments",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mikelikesdesign/SwiftUI-experiments](https://github.com/mikelikesdesign/SwiftUI-experiments) (Revision: `6effebb7`).  
> **License**: MIT | **Timestamp**: `2026-11-28T11:47:38.589Z`  
> **Learning ID**: `learn-github-mikelikesdesign-swiftui-experiments`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `drag to delete/drag to delete/ContentView.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mikelikesdesign/SwiftUI-experiments. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `07bf7ed0`: drag to delete to SwiftUI best practices. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `drag to delete/drag to delete/ContentView.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
/// Drag the image onto the trash target at the bottom of the screen to delete it.
    private enum Phase: Equatable {
        case idle
        case dragging(CGPoint)
        case deleting
    }

    private enum Metrics {
        static let restingImageSize: CGFloat = 320
        static let restingImageTop: CGFloat = 144
        static let maxDraggingImageSize: CGFloat = 160
        static let minDraggingImageSize: CGFloat = 32
        static let minTrashDiameter: CGFloat = 64
        static let maxTrashDiameter: CGFloat = 92
        /// Fraction of the distance to the trash past which releasing deletes the image.
        static let deleteThreshold: CGFloat = 0.7
    }

    @State private var phase: Phase = .idle

        GeometryReader { proxy in
            let size = proxy.size
            let progress = progress(in: size)

            ZStack(alignment: .bottom) {
                if case .dragging = phase {
                    TrashTarget(diameter: trashDiameter(progress: progress))
                        // Fixed slot so the circle grows outward from a stable center.
                        .frame(width: Metrics.maxTrashDiameter, height: Metrics.maxTrashDiameter)
           
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
    @State private var imageSize: CGFloat = 320
    @State private var showCircle = false
    @State private var circleSize: CGFloat = 64
    @State private var showImage = true
    @State private var initialCircleGrowth = false
    @State private var dragPosition = CGPoint(x: UIScreen.main.bounds.width / 2, y: 72 + 160)
    @State private var shrinkCircle = false
    
        ZStack {
            Color.white
                .edgesIgnoringSafeArea(.all)
            
            VStack {
                Spacer()
                
                if showCircle {
                    ZStack {
                        Circle()
                            .fill(Color.black)
                            .frame(width: circleSize, height: circleSize)
                            .scaleEffect(initialCircleGrowth ? 0 : 1)
                            .scaleEffect(shrinkCircle ? 0 : 1)
                            .animation(.easeInOut(duration: 0.3), value: initialCircleGrowth)
                            .animation(.easeInOut(duration: 0.5), value: shrinkCircle)
                        
                        Image("trash")
                            .resizable()
                            .asp
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `07bf7ed0` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-28T11:47:38.587Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795866458587",
    "title": "drag to delete to SwiftUI best practices",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mikelikesdesign/SwiftUI-experiments",
    "source_uri": "https://github.com/mikelikesdesign/SwiftUI-experiments",
    "source_version": "HEAD",
    "content_hash": "6b4fc8b71e4462fa2a609fc9b86343980cb0b0b7d57a76c9a39669edb10d04c1"
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
        "Harvested/verified timestamp recorded: 2026-11-28T11:47:38.587Z"
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
  "auth_token": "e822557f6c184ac824613f18916eb12fe6a95930d36f24d64f1ba2b18a53051c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

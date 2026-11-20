# Candidate Directive: [CD-2YHS] Temporal State-Gating on Remote-Synchronized Generators

<!-- PROVENANCE_START
{
  "source_repository": "rafsoh/dimeApp",
  "source_url": "https://github.com/rafsoh/dimeApp",
  "source_version": "6dead5de",
  "license": "GPL-3.0",
  "timestamp": "2026-11-20T23:57:48.448Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rafsoh-dimeapp",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rafsoh/dimeApp](https://github.com/rafsoh/dimeApp) (Revision: `6dead5de`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-20T23:57:48.448Z`  
> **Learning ID**: `learn-github-rafsoh-dimeapp`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
Any synthetic transaction generator (such as budget rollover calculations, recurring billing generation, or time-triggered reconciliation) MUST NOT execute until either (1) a successful CloudKit remote import finishes on the current session, or (2) iCloud identity is explicitly verified as unavailable/disabled. A persistent timeout fallback MUST ONLY engage if active network reachability is verified.

**WHY**:
If an offline or backgrounded device fires local date-advancing generation logic on app launch before receiving changes logged by peer devices via CloudKit, the device generates duplicate transactions with distinct local UUIDs. When network connectivity resumes, CloudKit merges both sets without conflict because the primary keys differ, permanently corrupting financial ledgers.

**WHEN TO APPLY**:
Apply to any distributed peer-to-peer or client-cloud application where periodic deterministic events (daily renewals, amortizations, recurring transactions) are computed locally by distributed clients.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
import Foundation
import Network

public struct RecurringGenerationGate {
    public private(set) var isOpen: Bool
    private let isSyncEnabled: Bool
    private var isAccountUnavailable: Bool = false
    private var isOnline: Bool = true
    
    public init(isSyncEnabled: Bool) {
        self.isSyncEnabled = isSyncEnabled
        // If sync is explicitly disabled, gate opens immediately
        self.isOpen = !isSyncEnabled
    }
    
    public mutating func syncEventFinished(isImport: Bool, succeeded: Bool, isNetworkError: Bool) {
        if succeeded {
            if isImport {
                // Verified remote state received; safe to generate missing intervals
                self.isOpen = true
            }
        } else if isNetworkError {
            // Drop back to safety, await network re-establishment and proper import
            needsFreshImport()
        } else {
            // Fatal or permission CloudKit error; unlock to prevent starvation
            self.isOpen = true
        }
    }
    
    public mutating func accountBecameUnavailable() {
        self.isAccountUnavailable = true
        self.isOpen = true
    }
    
    public mutating func needsFreshImport() {
        guard isSyncEnabled, !isAccountUnavailable else { return }
        self.isOpen = false
    }
    
    @discardableResult
    public mutating func connectivityChanged(isOnline: Bool) -> Bool {
        guard isOnline != self.isOnline else { return false }
        self.isOnline = isOnline
        if isOnline {
            needsFreshImport()
        }
        return true
    }
    
    public mutating func fallbackElapsed() {
        // Only open on timeout if device is proven online and sync was given a chance
        if isOnline {
            self.isOpen = true
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Firing periodic date-based generators blindly on scene activation or app foreground
.onReceive(NotificationCenter.default.publisher(for: UIApplication.willEnterForegroundNotification)) { _ in
    // Clobbers and duplicates every recurring expense if iPad created it 10 minutes ago
    dataController.generateRecurringTransactionsNow()
}
```

**VERIFICATION METHOD**:
Simulate delayed remote import via mock CloudKit events; assert that the generator method is not invoked until the import event resolves:
```swift
func test_Gate_BlocksGeneration_UntilRemoteImportSucceeds() {
    var gate = RecurringGenerationGate(isSyncEnabled: true)
    XCTAssertFalse(gate.isOpen)
    
    // Simulating export finished does not unlock
    gate.syncEventFinished(isImport: false, succeeded: true, isNetworkError: false)
    XCTAssertFalse(gate.isOpen)
    
    // Simulating import finished unlocks
    gate.syncEventFinished(isImport: true, succeeded: true, isNetworkError: false)
    XCTAssertTrue(gate.isOpen)
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T23:57:48.447Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795219068447",
    "title": "Temporal State-Gating on Remote-Synchronized Generators",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rafsoh/dimeApp",
    "source_uri": "https://github.com/rafsoh/dimeApp",
    "source_version": "HEAD",
    "content_hash": "569eca033725356b89d011eed72cd071f97d487620b75341df4e2d7327e69303"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T23:57:48.447Z"
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
  "auth_token": "b9baa71b48993ea0a7423febbf5b513fb644ea52759264d4ec342931827e3718"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

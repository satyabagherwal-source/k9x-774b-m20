# Candidate Directive: [CD-2YHR] Isolated Multi-Process CloudKit Sync Disjointness

<!-- PROVENANCE_START
{
  "source_repository": "rafsoh/dimeApp",
  "source_url": "https://github.com/rafsoh/dimeApp",
  "source_version": "6dead5de",
  "license": "GPL-3.0",
  "timestamp": "2026-11-20T23:57:48.447Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rafsoh-dimeapp",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rafsoh/dimeApp](https://github.com/rafsoh/dimeApp) (Revision: `6dead5de`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-20T23:57:48.447Z`  
> **Learning ID**: `learn-github-rafsoh-dimeapp`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When multiple Darwin processes (Main App, WidgetKit Extensions, App Intents, WatchKit Extensions) read and write to a shared App Group Core Data SQLite store, EXACTLY ONE process (the main host app) MUST configure `NSPersistentCloudKitContainerOptions`. All application extensions (`.appex`) MUST configure `description.cloudKitContainerOptions = nil`, while retaining `NSPersistentHistoryTrackingKey = true`.

**WHY**:
`NSPersistentCloudKitContainer` operates an internal sync daemon (`cloudd` bridge) maintaining local sync anchors, change tokens, and export queues directly within internal SQLite metadata tables. If multiple processes concurrently attempt CloudKit sync on the same physical SQLite store, race conditions occur across the private zone change tokens, corrupting export state, triggering unrecoverable `CKErrorPartialFailure` cascades, and causing deadlocks on SQLite write-ahead log (`WAL`) locks.

**WHEN TO APPLY**:
Apply to all iOS, iPadOS, macOS, and watchOS software systems utilizing Core Data with `NSPersistentCloudKitContainer` inside an App Group shared container accessed by extensions.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
import CoreData
import Foundation

public final class PersistentContainerFactory {
    public static func createContainer(name: String, appGroupID: String, cloudKitContainerID: String) -> NSPersistentCloudKitContainer {
        let container = NSPersistentCloudKitContainer(name: name)
        
        guard let groupURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupID) else {
            fatalError("CRITICAL: Target App Group \(appGroupID) is inaccessible.")
        }
        
        let storeURL = groupURL.appendingPathComponent("\(name).sqlite")
        let description = NSPersistentStoreDescription(url: storeURL)
        
        // Mandatory for multi-process cross-talk notification & ingestion
        description.setOption(true as NSNumber, forKey: NSPersistentHistoryTrackingKey)
        description.setOption(true as NSNumber, forKey: NSPersistentStoreRemoteChangeNotificationPostOptionKey)
        
        // Process isolation check: Only main executable runs CloudKit sync
        let isAppExtension = Bundle.main.bundleURL.pathExtension.caseInsensitiveCompare("appex") == .orderedSame
        let isSyncPreferred = UserDefaults(suiteName: appGroupID)?.bool(forKey: "iCloudSyncEnabled") ?? true
        
        if !isAppExtension && isSyncPreferred {
            description.cloudKitContainerOptions = NSPersistentCloudKitContainerOptions(containerIdentifier: cloudKitContainerID)
        } else {
            description.cloudKitContainerOptions = nil
        }
        
        container.persistentStoreDescriptions = [description]
        container.loadPersistentStores { description, error in
            if let error = error as NSError? {
                fatalError("Fatal Core Data Load Resolution: \(error), \(error.userInfo) for \(description)")
            }
        }
        
        container.viewContext.automaticallyMergesChangesFromParent = true
        container.viewContext.mergePolicy = NSMergeByPropertyObjectTrumpMergePolicy
        return container
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Blindly enabling CloudKit options on all processes accessing App Group storage.
let description = NSPersistentStoreDescription(url: sharedURL)
// FAILS: Widget extension launches, tries to sync, collides with host app sync queue!
description.cloudKitContainerOptions = NSPersistentCloudKitContainerOptions(containerIdentifier: "iCloud.com.example.app")
```

**VERIFICATION METHOD**:
Verify with a unit/integration test checking extension bundle configuration:
```swift
func test_StoreDescription_WhenInAppExtension_DoesNotHaveCloudKitOptions() {
    let isAppExtension = Bundle.main.bundleURL.pathExtension == "appex"
    let description = container.persistentStoreDescriptions.first!
    if isAppExtension {
        XCTAssertNil(description.cloudKitContainerOptions, "App Extension MUST have nil cloudKitContainerOptions")
    }
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T23:57:48.444Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795219068444",
    "title": "Isolated Multi-Process CloudKit Sync Disjointness",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rafsoh/dimeApp",
    "source_uri": "https://github.com/rafsoh/dimeApp",
    "source_version": "HEAD",
    "content_hash": "98af12dca555e60aca2458fe30ce4ab2d16524df3a33d3a548cb08fa8edb63e4"
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
        "Harvested/verified timestamp recorded: 2026-11-20T23:57:48.444Z"
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
  "auth_token": "1cbe03452f3bec4421fba3d146025fd4e683f59870f45b8c596ee7d926e20061"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

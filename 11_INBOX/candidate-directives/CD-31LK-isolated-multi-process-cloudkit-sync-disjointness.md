# Candidate Directive: [CD-31LK] Isolated Multi-Process CloudKit Sync Disjointness

<!-- PROVENANCE_START
{
  "source_repository": "rafsoh-dimeapp-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T23:57:52.348Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-rafsoh-dimeapp-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rafsoh-dimeapp-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T23:57:52.348Z`  
> **Learning ID**: `LEARN-EVO-rafsoh-dimeapp-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T23:57:52.467Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795219072466",
    "title": "Isolated Multi-Process CloudKit Sync Disjointness",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rafsoh-dimeapp-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "93935f335152b0e59a79498217a44d6077ad3dd4b0481cc029ecd50d988cc8f9"
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
        "Expresses generalized engineering invariants (2 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-20T23:57:52.467Z"
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
  "auth_token": "9e08efef99b08e16d65cd8c1fab1693a16e6ee7f4c0682e9713db9316cde30d2"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

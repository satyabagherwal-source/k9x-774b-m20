# Candidate Directive: [CD-2YHT] Non-Destructive In-Memory Snapshotting for Undo Actions

<!-- PROVENANCE_START
{
  "source_repository": "rafsoh/dimeApp",
  "source_url": "https://github.com/rafsoh/dimeApp",
  "source_version": "6dead5de",
  "license": "GPL-3.0",
  "timestamp": "2026-11-20T23:57:48.449Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rafsoh-dimeapp",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rafsoh/dimeApp](https://github.com/rafsoh/dimeApp) (Revision: `6dead5de`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-20T23:57:48.449Z`  
> **Learning ID**: `learn-github-rafsoh-dimeapp`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When an entity deletion is committed or staged in a managed object context (`NSManagedObjectContext`), an "Undo" capability MUST NOT be implemented via `context.rollback()`. Instead, a detached, immutable struct representation (value-type snapshot) of the deleted entity and its foreign relationships MUST be retained in memory, and re-inserted as a new record if undo is triggered.

**WHY**:
Calling `context.rollback()` on a shared managed object context discards all unsaved modifications, rollbacks remote background merges, drops pending sync insertions, and invalidates registered fault objects across other active UI views. Furthermore, if the context was already saved to disk (which is mandatory before backgrounding or app extension handoff), `rollback()` is a no-op against committed records.

**WHEN TO APPLY**:
Any Core Data or object-relational mapping (ORM) system where UI "toast" notifications or undo operations allow reversing row deletions.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
import CoreData
import Foundation

public struct DeletedTransactionSnapshot: Equatable {
    public let id: UUID?
    public let note: String?
    public let amount: Double
    public let date: Date?
    public let income: Bool
    public let recurringType: Int16
    public let recurringCoefficient: Int16
    public let categoryObjectID: NSManagedObjectID?
    
    public init(_ transaction: Transaction) {
        self.id = transaction.id
        self.note = transaction.note
        self.amount = transaction.amount
        self.date = transaction.date
        self.income = transaction.income
        self.recurringType = transaction.recurringType
        self.recurringCoefficient = transaction.recurringCoefficient
        self.categoryObjectID = transaction.category?.objectID
    }
    
    @discardableResult
    public func restore(into context: NSManagedObjectContext) -> Transaction {
        let restored = Transaction(context: context)
        restored.id = self.id ?? UUID()
        restored.note = self.note
        restored.amount = self.amount
        restored.date = self.date
        restored.income = self.income
        restored.recurringType = self.recurringType
        restored.recurringCoefficient = self.recurringCoefficient
        
        if let catID = self.categoryObjectID,
           let category = try? context.existingObject(with: catID) as? Category {
            restored.category = category
        }
        return restored
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// ANTI-PATTERN: Reversing database modifications using context-wide rollback
func delete(transaction: Transaction) {
    context.delete(transaction)
    // BAD: Delays saving to allow rollback, leading to data loss on sudden termination!
}
func undoDelete() {
    context.rollback() // DISASTROUS: Clears all uncommitted changes from OTHER forms!
}
```

**VERIFICATION METHOD**:
Execute an entity deletion, verify context save succeeds, mutate a second unrelated entity in memory, trigger undo on the first entity, and verify the second entity's uncommitted modifications remain uncorrupted.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T23:57:48.448Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795219068448",
    "title": "Non-Destructive In-Memory Snapshotting for Undo Actions",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rafsoh/dimeApp",
    "source_uri": "https://github.com/rafsoh/dimeApp",
    "source_version": "HEAD",
    "content_hash": "d70fb763b8b770ff8355c35e39c5350ced8890f2dc4d68af3759852ad2f3eae5"
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
        "Harvested/verified timestamp recorded: 2026-11-20T23:57:48.448Z"
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
  "auth_token": "b4520385ff7191c2aa4a2ce81ce7a4a9f6156ded1d31108e9803babe2ff0417c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

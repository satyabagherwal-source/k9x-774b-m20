# Candidate Directive: [CD-31LL] Non-Destructive In-Memory Snapshotting for Undo Actions

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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T23:57:52.473Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795219072473",
    "title": "Non-Destructive In-Memory Snapshotting for Undo Actions",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rafsoh-dimeapp-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "aa60eec7bfaadb56f3ee54ea751d24babc46958bf656400b149f9cea735eeeb7"
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
        "Harvested/verified timestamp recorded: 2026-11-20T23:57:52.473Z"
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
  "auth_token": "75f37fb2da2c32fe5eb81cc0a8a3e259874d5e2471f0d28b695697926036c346"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

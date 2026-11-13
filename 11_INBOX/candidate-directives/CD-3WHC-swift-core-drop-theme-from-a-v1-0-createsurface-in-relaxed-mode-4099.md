# Candidate Directive: [CD-3WHC] swift/core): drop theme from a v1.0 createSurface in relaxed mode (#4099)

<!-- PROVENANCE_START
{
  "source_repository": "a2ui-project/a2ui",
  "source_url": "https://github.com/a2ui-project/a2ui",
  "source_version": "f2c410ae",
  "license": "Apache-2.0",
  "timestamp": "2026-11-13T16:04:57.264Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-a2ui-project-a2ui",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [a2ui-project/a2ui](https://github.com/a2ui-project/a2ui) (Revision: `f2c410ae`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-13T16:04:57.264Z`  
> **Learning ID**: `learn-github-a2ui-project-a2ui`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `swift/core/Sources/A2UICore/Processing/Adapters/BaseVersionAdapter.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in a2ui-project/a2ui. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0d2fcf37`: swift/core): drop theme from a v1.0 createSurface in relaxed mode (#4099). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing TypeScript data structures, boundary deserialization, API parsing, or resource lifecycles matching `swift/core/Sources/A2UICore/Processing/Adapters/BaseVersionAdapter.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```typescript
// Verified production-grade fix pattern:
    try extractOperations(from: payload, allowUnknownElements: false)
  }

  /// Validates the payload as ``extractOperations(from:)`` does, passing `allowUnknownElements`
  /// to ``preparePayloadForValidation(_:action:allowUnknownElements:)`` for each message.
  open func extractOperations(
    from payload: JSONValue,
    allowUnknownElements: Bool
  ) throws -> [InternalOperation] {
      return try extractOperationsFromArray(items, allowUnknownElements: allowUnknownElements)
    case .object(let messageObject):
      if let messages = messageObject["messages"]?.arrayValue {
        return try extractOperationsFromArray(
          messages,
          allowUnknownElements: allowUnknownElements
        )
      return try extractOperationsFromSingleMessageObject(
        messageObject,
        allowUnknownElements: allowUnknownElements
      )
  /// Lets subclasses normalize a single message before validation, such as dropping properties
  /// that relaxed renderers ignore. The default returns `message` unchanged.
  open func preparePayloadForValidation(
    _ message: OrderedDictionary<String, JSONValue>,
    action: String,
    allowUnknownElements: Bool
  ) -> OrderedDictionary
```

**NEGATIVE CONSTRAINT**:
```typescript
// Anti-pattern to NEVER write (induced failure mode):
      return try extractOperationsFromArray(items)
    case .object(let dict):
      if let messages = dict["messages"]?.arrayValue {
        return try extractOperationsFromArray(messages)
      return try extractOperationsFromSingleMessageObject(dict)
    _ items: [JSONValue]
        return try extractOperations(from: item)
    _ dict: OrderedDictionary<String, JSONValue>
    let action = try extractSingleAction(from: dict)
    let ops = try extractOperations(from: jsonValue)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `0d2fcf37` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-13T16:04:57.262Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write'); CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0.51,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 51%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=FAIL, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=FAIL.",
  "item": {
    "id": "cand-1794585897262",
    "title": "swift/core): drop theme from a v1.0 createSurface in relaxed mode (#4099)",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "a2ui-project/a2ui",
    "source_uri": "https://github.com/a2ui-project/a2ui",
    "source_version": "HEAD",
    "content_hash": "6a8721a396fcf80f81dd18cd3b3a0887751d72a4a8a1cd696b5b2eeffb310ba2"
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
      "status": "FAIL",
      "score": 0.4,
      "is_adversarial": false,
      "has_dangerous_security": false,
      "directive_opposition": true,
      "opposing_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "unsupported_assumptions": [],
      "findings": [
        "DIRECTIVE_OPPOSITION: Contradicts canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant): Opposing directive on 'write': candidate forbids action ('never write') while canonical Rule CANON-003 prescribes it ('always write')"
      ],
      "details": [
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
        "Harvested/verified timestamp recorded: 2026-11-13T16:04:57.262Z"
      ]
    },
    "duplication_and_conflict": {
      "status": "FAIL",
      "score": 0.4,
      "is_duplicate": false,
      "duplicate_target": null,
      "is_contradiction": true,
      "conflicting_rule": "RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
      "findings": [
        "CONTRADICTORY_CLAIM: Directly opposes canonical rule RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
      ],
      "details": []
    }
  },
  "detected_contradictions": [
    "Canonical opposition: Clashes with RULE-CANON-003 (Atomic Persistence File Staging Invariant)",
    "Conflict with RULE-CANON-003 (Atomic Persistence File Staging Invariant)"
  ],
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
  "auth_token": "67fe8394fd28566d3c74cadc0c03272d93ce6133d9490671526b528b5dad3795"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-GVEO] keep tests off the real preferences, show pictures after a layout reset, and sma

<!-- PROVENANCE_START
{
  "source_repository": "thaw-app/Thaw",
  "source_url": "https://github.com/thaw-app/Thaw",
  "source_version": "63a96c2d",
  "license": "GPL-3.0",
  "timestamp": "2026-11-25T03:59:15.456Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-thaw-app-thaw",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [thaw-app/Thaw](https://github.com/thaw-app/Thaw) (Revision: `63a96c2d`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-25T03:59:15.456Z`  
> **Learning ID**: `learn-github-thaw-app-thaw`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `.swiftlint.baseline`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in thaw-app/Thaw. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `d09f6a70`: keep tests off the real preferences, show pictures after a layout reset, and small cleanups. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `.swiftlint.baseline`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
   "reason": "Class body should span 350 lines or less excluding comments and whitespace: currently spans 390 lines",
    "line": 523
   "reason": "File should contain 400 lines or less: currently contains 527",
    "line": 580
   "reason": "Function body should span 100 lines or less excluding comments and whitespace: currently spans 216 lines",
   "ruleDescription": "Function bodies should not span too many lines",
   "ruleIdentifier": "function_body_length",
   "ruleName": "Function Body Length",
   "reason": "Function should have complexity 10 or less; currently complexity is 33",
   "ruleDescription": "Complexity of function bodies should be limited.",
   "ruleIdentifier": "cyclomatic_complexity",
   "ruleName": "Cyclomatic Complexity",
    "line": 941
   "reason": "File should contain 400 lines or less: currently contains 941",
    "line": 808
    "line": 912
   "reason": "File should contain 400 lines or less: currently contains 912",
    "line": 1437
   "reason": "Function should have complexity 10 or less; currently complexity is 27",
    "line
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
   "reason": "Class body should span 350 lines or less excluding comments and whitespace: currently spans 396 lines",
    "line": 534
   "reason": "File should contain 400 lines or less: currently contains 534",
    "line": 583
   "reason": "Function should have complexity 10 or less; currently complexity is 33",
   "ruleDescription": "Complexity of function bodies should be limited.",
   "ruleIdentifier": "cyclomatic_complexity",
   "ruleName": "Cyclomatic Complexity",
   "reason": "Function body should span 100 lines or less excluding comments and whitespace: currently spans 222 lines",
   "ruleDescription": "Function bodies should not span too many lines",
   "ruleIdentifier": "function_body_length",
   "ruleName": "Function Body Length",
    "line": 951
   "reason": "File should contain 400 lines or less: currently contains 951",
 {
  "text": "    private func resetAssignments(to target: MenuBarSection.Name = .hidden) async throws -> Int {",
  "violation": {
   "location": {
    "character": 13,
    "file": "Thaw/Items/Manager/MenuBarItemManager+LayoutReset.swift",
    "line": 433
   },
   "reason": "Function body should span 50 lines or less excluding comments and whitespace: 
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `d09f6a70` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T03:59:15.454Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795579155454",
    "title": "keep tests off the real preferences, show pictures after a layout reset, and sma",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "thaw-app/Thaw",
    "source_uri": "https://github.com/thaw-app/Thaw",
    "source_version": "HEAD",
    "content_hash": "0f8a8401d61a4fcae93dc150c664c16f8aad9b01b8d61fdc60993b864783d9bf"
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
        "Harvested/verified timestamp recorded: 2026-11-25T03:59:15.454Z"
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
  "auth_token": "3235e5bcb73a1991595a2292d1788cebf65ad03749476b2488c83fae6247a24c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

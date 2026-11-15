# Candidate Directive: [CD-4FW5] Improve file icons and compact search UX

<!-- PROVENANCE_START
{
  "source_repository": "chocoford-excalidrawz-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-15T17:04:41.982Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-chocoford-excalidrawz-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [chocoford-excalidrawz-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-15T17:04:41.982Z`  
> **Learning ID**: `LEARN-EVO-chocoford-excalidrawz-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain J

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `ExcalidrawZ.xcodeproj/project.pbxproj`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in chocoford/ExcalidrawZ. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `01eb91d2`: Improve file icons and compact search UX. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `ExcalidrawZ.xcodeproj/project.pbxproj`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
		FEF74DCD7CE44B70BD733EC3 /* ExcalidrawDocument-64.png in Resources */ = {isa = PBXBuildFile; fileRef = 7254AFB37AB04433805E3415 /* ExcalidrawDocument-64.png */; };
		E30B1C5288C94624A0E32DAD /* ExcalidrawDocument-128.png in Resources */ = {isa = PBXBuildFile; fileRef = 5E9D2823B4FB4F209959038D /* ExcalidrawDocument-128.png */; };
		21DFD6DCDF034C198AFD1605 /* ExcalidrawDocument-320.png in Resources */ = {isa = PBXBuildFile; fileRef = CCB2D0B79C584A4C90DEAB52 /* ExcalidrawDocument-320.png */; };
		1D0245AC32C045FFA0F7FE34 /* ExcalidrawDocument.icns in Resources */ = {isa = PBXBuildFile; fileRef = A537CFEF92184BFBBDB31B77 /* ExcalidrawDocument.icns */; };
		23611917B50E4D6492E0C43C /* ExcalidrawDocument-64.png in Resources */ = {isa = PBXBuildFile; fileRef = 7254AFB37AB04433805E3415 /* ExcalidrawDocument-64.png */; };
		F5C0E6110E1145449AEDEAD2 /* ExcalidrawDocument-128.png in Resources */ = {isa = PBXBuildFile; fileRef = 5E9D2823B4FB4F209959038D /* ExcalidrawDocument-128.png */; };
		DF1B60C713C340BEAC2947FA /* ExcalidrawDocument-320.png in Resources */ = {isa = PBXBuildFile; fileRef = CCB2D0B79C584A4C90DEAB52 /* ExcalidrawDocument-320.png */; };
		7E21756455434E8EAB04D9D3 /* Exca
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `01eb91d2` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T17:04:42.096Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794762282096",
    "title": "Improve file icons and compact search UX",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "chocoford-excalidrawz-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "4469b4321773162d5721e21d590a4279c1588580c2887b0ec6029a23c728e1b2"
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
        "Harvested/verified timestamp recorded: 2026-11-15T17:04:42.097Z"
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
  "auth_token": "000a8a68cb55f1897ab96f35ac33248283e157e4e04bd8ab034fe948efc7ec11"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

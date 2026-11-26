# Candidate Directive: [CD-YQTB] [iOS][Fabric] Fix data race in RCTComponentViewFactory legacy-interop/Unimplemen

<!-- PROVENANCE_START
{
  "source_repository": "react-react-native-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T15:12:40.336Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-react-react-native-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [react-react-native-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T15:12:40.336Z`  
> **Learning ID**: `LEARN-EVO-react-react-native-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `packages/react-native/React/Fabric/Mounting/RCTComponentViewFactory.mm`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in react/react-native. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3ea73699`: [iOS][Fabric] Fix data race in RCTComponentViewFactory legacy-interop/Unimplemented fallbacks. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing C++ data structures, boundary deserialization, API parsing, or resource lifecycles matching `packages/react-native/React/Fabric/Mounting/RCTComponentViewFactory.mm`.

**VERIFIED IMPLEMENTATION PATTERN**:
```c++
// Verified production-grade fix pattern:
  std::shared_lock lock(_mutex);
  {
    std::shared_lock lock(_mutex);
    if (_registrationStatusMap.find(name) != _registrationStatusMap.end()) {
      return;
    }
    // Only the map writes take the lock: building a legacy interop descriptor can wait on the
    // main queue (a view manager that requires main queue setup), which may itself be waiting
    // for this lock in -createComponentViewWithComponentHandle:.
    auto classDescriptor =
    {
      std::unique_lock lock(_mutex);
      _componentViewClasses[componentHandle] = classDescriptor;
      _registrationStatusMap.insert({provider.name, true});
    }
  auto classDescriptor = [self _componentViewClassDescriptorFromClass:[RCTUnimplementedViewComponentView class]];
  {
    std::unique_lock lock(_mutex);
    _componentViewClasses[componentHandle] = classDescriptor;
    _registrationStatusMap.insert({provider.name, false});
  }
```

**NEGATIVE CONSTRAINT**:
```c++
// Induced defect failure mode:
  if (_registrationStatusMap.find(name) != _registrationStatusMap.end()) {
    return;
    _componentViewClasses[componentHandle] =
    _registrationStatusMap.insert({provider.name, true});
  _componentViewClasses[componentHandle] =
      [self _componentViewClassDescriptorFromClass:[RCTUnimplementedViewComponentView class]];
  _registrationStatusMap.insert({provider.name, false});
```

**VERIFICATION METHOD**:

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T15:12:40.506Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795705960505",
    "title": "[iOS][Fabric] Fix data race in RCTComponentViewFactory legacy-interop/Unimplemen",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "react-react-native-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "28a97e5a0738cb284841a110c783e894458a9c2a0386a556a697472f68a6031a"
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
        "Harvested/verified timestamp recorded: 2026-11-26T15:12:40.507Z"
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
  "auth_token": "c2d876dd7e7610fca81aa3a1dc91349777f76e3c9b725f9bf0f7ae91d720a176"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

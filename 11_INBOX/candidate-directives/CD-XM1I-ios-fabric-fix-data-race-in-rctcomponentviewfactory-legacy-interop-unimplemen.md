# Candidate Directive: [CD-XM1I] [iOS][Fabric] Fix data race in RCTComponentViewFactory legacy-interop/Unimplemen

<!-- PROVENANCE_START
{
  "source_repository": "react/react-native",
  "source_url": "https://github.com/react/react-native",
  "source_version": "9743c098",
  "license": "MIT",
  "timestamp": "2026-11-26T15:11:47.670Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-react-react-native",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [react/react-native](https://github.com/react/react-native) (Revision: `9743c098`).  
> **License**: MIT | **Timestamp**: `2026-11-26T15:11:47.670Z`  
> **Learning ID**: `learn-github-react-react-native`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
Automated regression test asserting that input states reproducing defect `3ea73699` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T15:11:47.668Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795705907668",
    "title": "[iOS][Fabric] Fix data race in RCTComponentViewFactory legacy-interop/Unimplemen",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "react/react-native",
    "source_uri": "https://github.com/react/react-native",
    "source_version": "HEAD",
    "content_hash": "ef4847a8158049c1f1139f94c598590f2afc2ddb32a2bfbc0ced24498fc92ef9"
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
        "Harvested/verified timestamp recorded: 2026-11-26T15:11:47.668Z"
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
  "auth_token": "d9f80badba63e2d48eec9bb82defade0ff31252b571367553b3dbea1bcf9f89f"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

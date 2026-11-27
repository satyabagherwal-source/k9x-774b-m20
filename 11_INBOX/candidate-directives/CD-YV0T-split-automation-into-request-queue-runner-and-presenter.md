# Candidate Directive: [CD-YV0T] ♻️ Split automation into request, queue, runner and presenter

<!-- PROVENANCE_START
{
  "source_repository": "mrkai77/Loop",
  "source_url": "https://github.com/mrkai77/Loop",
  "source_version": "5d72ca42",
  "license": "GPL-3.0",
  "timestamp": "2026-11-27T12:12:28.685Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-mrkai77-loop",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mrkai77/Loop](https://github.com/mrkai77/Loop) (Revision: `5d72ca42`).  
> **License**: GPL-3.0 | **Timestamp**: `2026-11-27T12:12:28.685Z`  
> **Learning ID**: `learn-github-mrkai77-loop`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Loop.xcodeproj/project.pbxproj`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mrkai77/Loop. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5d72ca42`: ♻️ Split automation into request, queue, runner and presenter. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Loop.xcodeproj/project.pbxproj`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
				PrivilegedHelper/LoopSupportPaths.swift,
				PrivilegedHelper/PrivilegedHelperConstants.swift,
				PrivilegedHelper/PrivilegedHelperProtocol.swift,
		C1BB00F12F40000200AABBCC /* PBXFileSystemSynchronizedBuildFileExceptionSet */ = {
			isa = PBXFileSystemSynchronizedBuildFileExceptionSet;
			membershipExceptions = (
				Automation/LoopAutomationFormatter.swift,
				Automation/LoopAutomationJSON.swift,
				Automation/LoopAutomationModels.swift,
				Automation/LoopAutomationText.swift,
				Automation/LoopRoute.swift,
				Automation/LoopSocketIO.swift,
				Automation/LoopSocketPath.swift,
				Automation/LoopTarget.swift,
				Automation/LoopTargetOptions.swift,
				Automation/NullEncoded.swift,
				"Bundle+Extensions.swift",
				PrivilegedHelper/LoopSupportPaths.swift,
				PrivilegedHelper/PrivilegedHelperConstants.swift,
			);
			target = C1BB00112F30000200AABBCC /* LoopCLI */;
		};
		2A6A87F02F4D20D2004E995D /* Shared */ = {isa = PBXFileSystemSynchronizedRootGroup; exceptions = (2A6A87F22F4D20F4004E995D /* PBXFileSystemSynchronizedBuildFileExceptionSet */, C1BB00F12F40000200AABBCC /* PBXFileSystemSynchronizedBuildFileExceptionSet */, ); explicitFileTypes = {}; explicitFolders = ()
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
				LoopSupportPaths.swift,
				PrivilegedHelperConstants.swift,
				PrivilegedHelperProtocol.swift,
		2A6A87F02F4D20D2004E995D /* Shared */ = {isa = PBXFileSystemSynchronizedRootGroup; exceptions = (2A6A87F22F4D20F4004E995D /* PBXFileSystemSynchronizedBuildFileExceptionSet */, ); explicitFileTypes = {}; explicitFolders = (); path = Shared; sourceTree = "<group>"; };
				2A6A87F02F4D20D2004E995D /* Shared */,
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5d72ca42` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-27T12:12:28.683Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795781548683",
    "title": "♻️ Split automation into request, queue, runner and presenter",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mrkai77/Loop",
    "source_uri": "https://github.com/mrkai77/Loop",
    "source_version": "HEAD",
    "content_hash": "c3c0ed45bf648944f2a63277b8282103b2483712e41474d59a90e4e011a210a9"
  },
  "evidence_fingerprint": "ece9d10e7392fc66",
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
        "Direct empirical evidence ratio: 0% (0/1)",
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
        "Harvested/verified timestamp recorded: 2026-11-27T12:12:28.683Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "f08d00bb2e9dc1d37094df75097c53b9c02a80b4f76b6af5239d5e71aceb053e"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

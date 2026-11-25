# Candidate Directive: [CD-U90N] ✨ Improved URL API and new CLI

<!-- PROVENANCE_START
{
  "source_repository": "mrkai77-loop-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-25T03:13:40.260Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-mrkai77-loop-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [mrkai77-loop-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-25T03:13:40.260Z`  
> **Learning ID**: `LEARN-EVO-mrkai77-loop-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain F

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Loop.xcodeproj/project.pbxproj`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in mrkai77/Loop. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `0ad44cb0`: ✨ Improved URL API and new CLI. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Loop.xcodeproj/project.pbxproj`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
		B1AA00412F30000100AABBCC /* LoopPrivilegedHelper in CopyFiles */ = {isa = PBXBuildFile; fileRef = B1AA00012F30000100AABBCC /* LoopPrivilegedHelper */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
		C1BB00412F30000200AABBCC /* loop-cli in CopyFiles */ = {isa = PBXBuildFile; fileRef = C1BB00012F30000200AABBCC /* loop-cli */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
		C1BB00A52F40000200AABBCC /* ArgumentParser in Frameworks */ = {isa = PBXBuildFile; productRef = C1BB00A42F40000200AABBCC /* ArgumentParser */; };
			remoteInfo = LoopPrivilegedHelper;
		};
		C1BB00512F30000200AABBCC /* PBXContainerItemProxy */ = {
			isa = PBXContainerItemProxy;
			containerPortal = A8E59C2D297F5E9A0064D4BA /* Project object */;
			proxyType = 1;
			remoteGlobalIDString = C1BB00112F30000200AABBCC;
			remoteInfo = LoopCLI;
				B1AA00412F30000100AABBCC /* LoopPrivilegedHelper in CopyFiles */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		C1BB00612F30000200AABBCC /* CopyFiles */ = {
			isa = PBXCopyFilesBuildPhase;
			buildActionMask = 2147483647;
			dstPath = "";
			dstSubfolderSpec = 6;
			files = (
				C1BB00412F30000200AABBCC /* loop-cli in CopyFiles */,
		B1AA00012F30000100A
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
		B1AA00412F30000100AABBCC /* LoopUpdaterHelper in CopyFiles */ = {isa = PBXBuildFile; fileRef = B1AA00012F30000100AABBCC /* LoopUpdaterHelper */; settings = {ATTRIBUTES = (CodeSignOnCopy, ); }; };
			remoteInfo = LoopUpdaterHelper;
				B1AA00412F30000100AABBCC /* LoopUpdaterHelper in CopyFiles */,
		B1AA00012F30000100AABBCC /* LoopUpdaterHelper */ = {isa = PBXFileReference; explicitFileType = "compiled.mach-o.executable"; includeInIndex = 0; path = LoopUpdaterHelper; sourceTree = BUILT_PRODUCTS_DIR; };
			target = B1AA00112F30000100AABBCC /* LoopUpdaterHelper */;
				PrivilegedInstallerProtocol.swift,
			target = B1AA00112F30000100AABBCC /* LoopUpdaterHelper */;
```

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-25T03:13:40.390Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795576420390",
    "title": "✨ Improved URL API and new CLI",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "mrkai77-loop-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "83020ef6afee72702e15dca681b160b23a4b94c9b5b816f946ebd47e1dac3b53"
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
        "Harvested/verified timestamp recorded: 2026-11-25T03:13:40.390Z"
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
  "auth_token": "3073faef7ff0e40d6884119cb17053469b1dc4222ee4b47afb0efc57364d3522"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

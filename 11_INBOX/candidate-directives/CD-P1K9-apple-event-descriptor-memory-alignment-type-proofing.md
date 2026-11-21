# Candidate Directive: [CD-P1K9] Apple Event Descriptor Memory Alignment & Type Proofing

<!-- PROVENANCE_START
{
  "source_repository": "lingyired-status-trio-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T06:46:53.358Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-lingyired-status-trio-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lingyired-status-trio-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T06:46:53.358Z`  
> **Learning ID**: `LEARN-EVO-lingyired-status-trio-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When parsing raw Mach/Carbon Apple Event attributes (such as `keySenderPIDAttr` via `NSAppleEventManager`), you **MUST NOT** load pointers directly from unaligned `NSData` or typed data buffers. You **MUST** verify descriptor type bounds, check memory size strictly, and use `withUnsafeMutableBytes` to copy memory into an aligned, zero-initialized primitive before typecasting.

**WHY**:
Apple Event attribute descriptors can pack integer types as `typeSInt32` or `typeUInt32` ('magn') without word alignment guarantees. Casting raw byte pointers from `descriptor.data` directly to `UnsafePointer<pid_t>` triggers unaligned memory access crashes on ARM64 architectures (Apple Silicon SIGBUS / EXC_ARM_DA_ALIGN) and undefined sign-extension behavior.

**WHEN TO APPLY**:
Any Apple Event handler, IPC receiver, or Carbon event inspection bridge handling OS launch, reopen, or script events.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
import Foundation
import CoreServices

public enum AppleEventPIDParser {
    public static func extractPID(from event: NSAppleEventDescriptor, keyword: AEKeyword) -> pid_t? {
        guard let attribute = event.attributeDescriptor(forKeyword: keyword) else {
            return nil
        }
        
        let type = attribute.descriptorType
        guard type == typeSInt32 || type == typeUInt32 else {
            return nil
        }
        
        let data = attribute.data
        guard data.count == MemoryLayout<UInt32>.size else {
            return nil
        }
        
        var rawPID: UInt32 = 0
        // Safe: copy bytes into stack-allocated, aligned variable memory
        withUnsafeMutableBytes(of: &rawPID) { buffer in
            _ = data.copyBytes(to: buffer)
        }
        
        guard let pid = pid_t(exactly: rawPID), pid > 0 else {
            return nil
        }
        return pid
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// CRITICAL BUG: Direct pointer binding on unaligned data causes SIGBUS crashes on ARM64
let rawPtr = (descriptor.data as NSData).bytes.bindMemory(to: pid_t.self, capacity: 1)
let pid = rawPtr.pointee // UNDEFINED BEHAVIOR: Memory alignment fault

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T06:46:53.481Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795243613481",
    "title": "Apple Event Descriptor Memory Alignment & Type Proofing",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lingyired-status-trio-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "60e3290e75524aae16cfa74f888929d0c94e86be704af2332aa2e4300258945f"
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
        "Harvested/verified timestamp recorded: 2026-11-21T06:46:53.481Z"
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
  "auth_token": "52f37979279d44b0ae455da66db89a5f266e3124da00d37ba588ad381480eba1"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

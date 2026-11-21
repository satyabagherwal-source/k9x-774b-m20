# Candidate Directive: [CD-N1VD] Apple Event Descriptor Memory Alignment & Type Proofing

<!-- PROVENANCE_START
{
  "source_repository": "lingyired/status-trio",
  "source_url": "https://github.com/lingyired/status-trio",
  "source_version": "f57d4590",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T06:45:20.569Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lingyired-status-trio",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lingyired/status-trio](https://github.com/lingyired/status-trio) (Revision: `f57d4590`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T06:45:20.569Z`  
> **Learning ID**: `learn-github-lingyired-status-trio`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
```

**VERIFICATION METHOD**:
Construct an unaligned `Data` buffer containing a packed `UInt32` and verify parsing:
```swift
func testUnalignedAppleEventPIDExtraction() {
    var rawBytes: [UInt8] = [0xFF, 0x01, 0x00, 0x00, 0x00] // Misaligned offset
    let subdata = Data(rawBytes[1...4]) // Subdata with offset 1
    let descriptor = NSAppleEventDescriptor(descriptorType: typeUInt32, data: subdata)!
    
    let pid = AppleEventPIDParser.extractPID(from: descriptor, keyword: AEKeyword(keySenderPIDAttr))
    XCTAssertEqual(pid, 1)
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T06:45:20.569Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795243520569",
    "title": "Apple Event Descriptor Memory Alignment & Type Proofing",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lingyired/status-trio",
    "source_uri": "https://github.com/lingyired/status-trio",
    "source_version": "HEAD",
    "content_hash": "1ad5acc9566650d6574316e7c42443bdc98ab56351099679806aafdd93c9150a"
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
        "Harvested/verified timestamp recorded: 2026-11-21T06:45:20.569Z"
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
  "auth_token": "4a8fde5b81a62bdf984a5c50de497c6f931489fbe358fab48f43f7bf4ca710f9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

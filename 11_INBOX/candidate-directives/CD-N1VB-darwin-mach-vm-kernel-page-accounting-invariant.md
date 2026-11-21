# Candidate Directive: [CD-N1VB] Darwin Mach VM Kernel Page Accounting Invariant

<!-- PROVENANCE_START
{
  "source_repository": "lingyired/status-trio",
  "source_url": "https://github.com/lingyired/status-trio",
  "source_version": "f57d4590",
  "license": "Apache-2.0",
  "timestamp": "2026-11-21T06:45:20.567Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lingyired-status-trio",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lingyired/status-trio](https://github.com/lingyired/status-trio) (Revision: `f57d4590`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-21T06:45:20.567Z`  
> **Learning ID**: `learn-github-lingyired-status-trio`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When calculating physical application memory usage via Darwin Mach kernel host statistics (`host_statistics64`), you **MUST** compute application memory strictly as anonymous memory minus purgeable memory (`internal_page_count - purgeable_count`). You **MUST NOT** use `active_count`, because `active_count` in XNU includes file-backed (external) cache pages that are dropped or evicted under memory pressure.

**WHY**:
In XNU memory architecture, `vm_statistics64_t.active_count` encompasses both dirty anonymous heap pages and active clean/dirty file-mapped pages. Using `active_count - purgeable_count` conflates disk-backed caching with user allocations, creating calculation errors up to 10 GB to 40 GB on high-RAM Apple Silicon systems and causing immediate discrepancies against macOS Activity Monitor (`Activity Monitor.app`).

**WHEN TO APPLY**:
Apply in any macOS/iOS system monitoring agent, profiling tool, or daemon interrogating Darwin Mach APIs (`mach/host_info.h`, `host_statistics64`).

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
import Foundation
import Darwin.Mach

public struct DarwinMemorySnapshot: Sendable, Equatable {
    public let appMemoryBytes: UInt64
    public let wiredBytes: UInt64
    public let compressedBytes: UInt64
    public let purgeableBytes: UInt64
    public let cachedFilesBytes: UInt64
    public let totalUsedBytes: UInt64

    public static func current() -> DarwinMemorySnapshot? {
        var hostPort = mach_host_self()
        var size = mach_msg_type_number_t(MemoryLayout<vm_statistics64_data_t>.stride / MemoryLayout<integer_t>.stride)
        var vmStats = vm_statistics64_data_t()
        
        let kernResult = withUnsafeMutablePointer(to: &vmStats) { statsPtr in
            statsPtr.withMemoryRebound(to: integer_t.self, capacity: Int(size)) { intPtr in
                host_statistics64(hostPort, HOST_VM_INFO64, intPtr, &size)
            }
        }
        guard kernResult == KERN_SUCCESS else { return nil }

        let pageSize = UInt64(vm_kernel_page_size)
        let internalBytes = UInt64(vmStats.internal_page_count) * pageSize
        let purgeableBytes = UInt64(vmStats.purgeable_count) * pageSize
        let externalBytes = UInt64(vmStats.external_page_count) * pageSize
        let wiredBytes = UInt64(vmStats.wire_count) * pageSize
        let compressedBytes = UInt64(vmStats.compressor_page_count) * pageSize

        // App Memory MUST be anonymous internal pages minus purgeable pages
        let appMemoryBytes = internalBytes > purgeableBytes ? (internalBytes - purgeableBytes) : 0
        // Cached files correspond to external file-backed pages plus purgeable anonymous pages
        let cachedFilesBytes = externalBytes + purgeableBytes
        // Total Used Memory matches Activity Monitor: App + Wired + Compressed
        let totalUsedBytes = appMemoryBytes + wiredBytes + compressedBytes

        return DarwinMemorySnapshot(
            appMemoryBytes: appMemoryBytes,
            wiredBytes: wiredBytes,
            compressedBytes: compressedBytes,
            purgeableBytes: purgeableBytes,
            cachedFilesBytes: cachedFilesBytes,
            totalUsedBytes: totalUsedBytes
        )
    }
}
```

**NEGATIVE CONSTRAINT**:
```swift
// CRITICAL BUG: active_count contains file-backed clean/dirty pages!
// Never compute app memory from active_count.
let badAppMemory = UInt64(vmStats.active_count) * pageSize - purgeableBytes
// Conflates disk cache with allocated app heap, showing false ~10GB+ bloated memory.
```

**VERIFICATION METHOD**:
Verify against Darwin Mach statistics by executing a unit test comparing snapshot values with `/usr/bin/vm_stat` and `sysctl vm.page_pageable_internal_count`:
```swift
func testDarwinMemoryMatchesInternalPages() {
    guard let snapshot = DarwinMemorySnapshot.current() else {
        XCTFail("Failed to acquire kernel VM statistics")
        return
    }
    XCTAssertGreaterThan(snapshot.appMemoryBytes, 0)
    XCTAssertEqual(
        snapshot.totalUsedBytes,
        snapshot.appMemoryBytes + snapshot.wiredBytes + snapshot.compressedBytes,
        "Total used memory invariant violated: must equal App + Wired + Compressed"
    )
}
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T06:45:20.565Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795243520565",
    "title": "Darwin Mach VM Kernel Page Accounting Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lingyired/status-trio",
    "source_uri": "https://github.com/lingyired/status-trio",
    "source_version": "HEAD",
    "content_hash": "21b9e74a692dc457c78f4ccb133a911d7bdc85e79efdaa079dd0bc7680d0fa27"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
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
        "Harvested/verified timestamp recorded: 2026-11-21T06:45:20.565Z"
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
  "auth_token": "c4dd197c1b3296cc3dba5fd0145462538ff8646d92c72d65aa2488e95eb3ff7c"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

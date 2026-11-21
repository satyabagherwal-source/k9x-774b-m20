# Candidate Directive: [CD-P1K8] Darwin Mach VM Kernel Page Accounting Invariant

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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-21T06:46:53.478Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795243613478",
    "title": "Darwin Mach VM Kernel Page Accounting Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lingyired-status-trio-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "ad16f2b7995b6a98817634fa42824eb9045a2e17e73a803f15f731494f930acc"
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
        "Expresses generalized engineering invariants (3 architectural markers)",
        "Explicit WHEN TO APPLY scope defined"
      ]
    },
    "completeness": {
      "status": "PASS",
      "score": 0.85,
      "has_rule": true,
      "has_why": true,
      "has_when": true,
      "missing_fields": [],
      "details": [
        "Preserves normative RULE declaration",
        "Preserves technical rationale (WHY)",
        "Preserves operational boundary (WHEN TO APPLY)"
      ]
    },
    "freshness": {
      "status": "WARN",
      "score": 1,
      "staleness_risk": "MEDIUM",
      "findings": [],
      "details": [
        "Free of known deprecated runtimes (Python 2, Node < 14, Webpack 1-3, React < 16)",
        "Harvested/verified timestamp recorded: 2026-11-21T06:46:53.479Z"
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
  "auth_token": "d191edcff1de7f50537f8f5be49107b97a65c68fcd6d0a6f21a53e7fc9882905"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

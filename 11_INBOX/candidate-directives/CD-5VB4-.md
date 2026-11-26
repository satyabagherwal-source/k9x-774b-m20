# Candidate Directive: [CD-5VB4] 修复未发布功能的导入兼容、详情缓存与配色覆盖

<!-- PROVENANCE_START
{
  "source_repository": "lingyired/status-trio",
  "source_url": "https://github.com/lingyired/status-trio",
  "source_version": "3d68fcd8",
  "license": "Apache-2.0",
  "timestamp": "2026-11-26T14:22:13.696Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-lingyired-status-trio",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [lingyired/status-trio](https://github.com/lingyired/status-trio) (Revision: `3d68fcd8`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-26T14:22:13.696Z`  
> **Learning ID**: `learn-github-lingyired-status-trio`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Sources/StatusTrioCore/Monitoring/HardwareMetricsService.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in lingyired/status-trio. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `4e387e5e`: 修复未发布功能的导入兼容、详情缓存与配色覆盖. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/StatusTrioCore/Monitoring/HardwareMetricsService.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    /// Both snapshots are cleared: the panel renders `panelStored`, so clearing
    /// only the live copy would leave a previous page's payload to be shown as
    /// cached data (it has no freshness expiry of its own) until the next merge.
        func clear(in snapshot: inout HardwareMetricsSnapshot) -> Bool {
            var didChange = false
            func drop<Value>(_ keyPath: WritableKeyPath<HardwareMetricsSnapshot, Value?>) {
                guard snapshot[keyPath: keyPath] != nil else { return }
                snapshot[keyPath: keyPath] = nil
                didChange = true
            }
            if kind != .cpu { drop(\.cpuDetail) }
            if kind != .gpu { drop(\.gpuDetail) }
            if kind != .memory { drop(\.memoryDetail) }
            if kind != .network { drop(\.networkDetail) }
            if kind != .disk { drop(\.diskDetail) }
            return didChange
        }
        let liveChanged = clear(in: &stored)
        let panelChanged = clear(in: &panelStored)
        guard liveChanged || panelChanged else { return }
        if liveChanged { snapshotSubject.send(stored) }
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
        var changed = false
        if kind != .cpu, stored.cpuDetail != nil { stored.cpuDetail = nil; changed = true }
        if kind != .gpu, stored.gpuDetail != nil { stored.gpuDetail = nil; changed = true }
        if kind != .memory, stored.memoryDetail != nil { stored.memoryDetail = nil; changed = true }
        if kind != .network, stored.networkDetail != nil { stored.networkDetail = nil; changed = true }
        if kind != .disk, stored.diskDetail != nil { stored.diskDetail = nil; changed = true }
        guard changed else { return }
        snapshotSubject.send(stored)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `4e387e5e` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T14:22:13.694Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795702933694",
    "title": "修复未发布功能的导入兼容、详情缓存与配色覆盖",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "lingyired/status-trio",
    "source_uri": "https://github.com/lingyired/status-trio",
    "source_version": "HEAD",
    "content_hash": "057cde79a436426332c3026daa5dab10b27f301cd52e2cac11762186093abe72"
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
        "Harvested/verified timestamp recorded: 2026-11-26T14:22:13.694Z"
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
  "auth_token": "0e822dfd4c647772618aed2706d57b1498cbe4425e86449ec53312931f574582"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

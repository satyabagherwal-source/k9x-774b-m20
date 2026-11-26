# Candidate Directive: [CD-IP1C] size): count each hard-linked file once

<!-- PROVENANCE_START
{
  "source_repository": "jarvis322-macos-sysdata-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-26T13:36:12.728Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-jarvis322-macos-sysdata-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [jarvis322-macos-sysdata-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-26T13:36:12.728Z`  
> **Learning ID**: `LEARN-EVO-jarvis322-macos-sysdata-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When implementing operations in `Sources/SysDataMenu/Services/DiskSize.swift`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in Jarvis322/macos-sysdata. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `1bdf2df1`: size): count each hard-linked file once. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Swift data structures, boundary deserialization, API parsing, or resource lifecycles matching `Sources/SysDataMenu/Services/DiskSize.swift`.

**VERIFIED IMPLEMENTATION PATTERN**:
```swift
// Verified production-grade fix pattern:
    /// Files a walk has already counted that have more than one hard link.
    ///
    /// Every link to a file reports the file's full allocated size, so a walk
    /// that summed them all counted the same blocks once per link: Spotlight's
    /// store under ~/Library/Metadata showed 11 GB for 2.5 GB on disk (#31).
    /// Like `du`, the first link a walk meets is counted and the rest are not.
    /// Only multi-link files reach the `lstat`, so an ordinary tree pays nothing.
    struct HardLinks {
        private struct Inode: Hashable {
            let device: dev_t
            let inode: ino_t
        }

        private var seen: Set<Inode> = []

        /// Whether this is the first time the walk meets the file at `url`.
        mutating func isFirstSighting(of url: URL, linkCount: Int?) -> Bool {
            guard let linkCount, linkCount > 1 else { return true }
            var info = stat()
            guard lstat(url.path, &info) == 0 else { return true }
            return seen.insert(Inode(device: info.st_dev, inode: info.st_ino)).inserted
        }
    }

            .totalFileAllocatedSizeKey, .isRegularFileKey, .contentModificationDateKey, .linkCountKey,
           
```

**NEGATIVE CONSTRAINT**:
```swift
// Induced defect failure mode:
            .totalFileAllocatedSizeKey, .isRegularFileKey, .contentModificationDateKey,
            return measure(of: url, keys: keys, cutoff: cutoff)
            let child = measure(of: child, keys: keys, cutoff: cutoff)
            .totalFileAllocatedSizeKey, .isRegularFileKey, .volumeIdentifierKey,
            guard let size = values.totalFileAllocatedSize, size > 0 else { continue }

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T13:36:12.860Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795700172860",
    "title": "size): count each hard-linked file once",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "jarvis322-macos-sysdata-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "c49e274ed571f872cd80c6822e28c821029e274d19c81611f4a42d4786161ff8"
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
        "Harvested/verified timestamp recorded: 2026-11-26T13:36:12.860Z"
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
  "auth_token": "9903d8b49091b0fa7036ce88449c08362984da3f81c7726f9a3d52a500b88652"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

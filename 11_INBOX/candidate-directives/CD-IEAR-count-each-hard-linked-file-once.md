# Candidate Directive: [CD-IEAR] count each hard-linked file once

<!-- PROVENANCE_START
{
  "source_repository": "Jarvis322/macos-sysdata",
  "source_url": "https://github.com/Jarvis322/macos-sysdata",
  "source_version": "63fb10a2",
  "license": "NOASSERTION",
  "timestamp": "2026-11-26T13:35:58.947Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-jarvis322-macos-sysdata",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [Jarvis322/macos-sysdata](https://github.com/Jarvis322/macos-sysdata) (Revision: `63fb10a2`).  
> **License**: NOASSERTION | **Timestamp**: `2026-11-26T13:35:58.947Z`  
> **Learning ID**: `learn-github-jarvis322-macos-sysdata`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
    private static func measure(of url: URL, keys: Set<URLResourceKey>, cutoff: Date?) -> Measurement {
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `1bdf2df1` are properly handled with clean fallback behavior.

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-26T13:35:58.944Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795700158944",
    "title": "count each hard-linked file once",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "Jarvis322/macos-sysdata",
    "source_uri": "https://github.com/Jarvis322/macos-sysdata",
    "source_version": "HEAD",
    "content_hash": "ae65cff1ad39e035b8194d10e892f9e8ed1af1d1881af343be7500da58bf91bb"
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
        "Harvested/verified timestamp recorded: 2026-11-26T13:35:58.944Z"
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
  "auth_token": "ed2f387fb991a13eaaaa88c1e184952ccb57b799b4f0da1490418dc601a37ce4"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

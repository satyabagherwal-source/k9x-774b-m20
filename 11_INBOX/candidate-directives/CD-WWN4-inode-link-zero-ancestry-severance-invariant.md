# Candidate Directive: [CD-WWN4] Inode Link-Zero Ancestry Severance Invariant

<!-- PROVENANCE_START
{
  "source_repository": "juicedata-juicefs-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T07:05:19.813Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-juicedata-juicefs-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [juicedata-juicefs-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T07:05:19.813Z`  
> **Learning ID**: `LEARN-EVO-juicedata-juicefs-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When calculating resource quotas, directory statistics, or directory ancestry trees for any transactional file mutation (e.g., `write`, `truncate`, `fallocate`, `clone`), if an inode's link count (`attr.Nlink`) equals zero, the mutation MUST NOT resolve or charge against the file's historical parent directory (`Parent Ino`). Ancestor path resolution MUST immediately short-circuit to `nil`.

**WHY**:
In POSIX semantics, a process can hold an open file descriptor to a file that has been unlinked from the directory hierarchy (`unlink()`, removing the directory entry and decrementing `Nlink` to 0). The inode remains alive until the last descriptor closes. 

If mutations on an open-unlinked file still charge quota or update directory size metrics against `attr.Parent`, the former parent directory accumulates phantom storage debt. When the file descriptor eventually closes, the directory's aggregated quota will permanently drift out of sync with actual tree contents, leading to irreversible quota exhaustion (`EDQUOT` errors) for subsequent operations in that directory.

**WHEN TO APPLY**:
Apply to all storage systems, distributed filesystems, object-to-POSIX gateways, or virtual file managers that compute real-time parent rollups or hierarchical quota enforcement on mutable file handles.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Language: Go
// Location: pkg/meta/base.go, pkg/meta/redis.go, pkg/meta/sql.go, pkg/meta/tkv.go

// Ancestor resolution MUST gate directory collection on nlink > 0
func (m *baseMeta) getParents(ctx Context, tx Transaction, inode, parent Ino, nlink uint32) []Ino {
    // An open file without links belongs to no directory; skip quota charging to former parent
    if nlink == 0 {
        return nil
    }
    if parent > 0 {
        return []Ino{parent}
    }
    return nil
}

// Updating parent aggregation metrics must verify both directory stats flag and positive link count
func (m *baseMeta) updateParentStat(ctx Context, inode, parent Ino, nlink uint32, length, space int64) {
    if length == 0 && space == 0 {
        return
    }
    m.en.updateStats(space, 0) // Global engine usage is still charged
    
    // An open file without links belongs to no directory until Link charges its full length
    if !m.getFormat().DirStats || nlink == 0 {
        return
    }
    if parent > 0 {
        m.updateDirStat(ctx, parent, length, space, 0)
    }
}
```

**NEGATIVE CONSTRAINT**:
```go
// Language: Go
// ANTI-PATTERN: Blindly trusting attr.Parent on open file handles without verifying link count

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T07:05:19.916Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795158319916",
    "title": "Inode Link-Zero Ancestry Severance Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "juicedata-juicefs-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "1a4617c789a7066ef7442d39ad0c045fdfde3c5aebf9cb5e9ad3d2bf532f5a62"
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
        "Harvested/verified timestamp recorded: 2026-11-20T07:05:19.916Z"
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
  "auth_token": "735a3a6a7bc327ad6aaf3f529fe8e5b0cadcc67184d3b617274f0e90cf1ba007"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-UF7N] Inode Link-Zero Ancestry Severance Invariant

<!-- PROVENANCE_START
{
  "source_repository": "juicedata/juicefs",
  "source_url": "https://github.com/juicedata/juicefs",
  "source_version": "23d2a456",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T07:03:24.035Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-juicedata-juicefs",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [juicedata/juicefs](https://github.com/juicedata/juicefs) (Revision: `23d2a456`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T07:03:24.035Z`  
> **Learning ID**: `learn-github-juicedata-juicefs`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
func (m *buggyMeta) doWrite(ctx Context, inode Ino, indx uint32, off uint32, slice Slice, attr Attr) syscall.Errno {
    // VULNERABLE: If file was unlinked concurrently or prior to write,
    // attr.Parent points to an old directory, leaking quota into a dead branch!
    if err := m.checkQuota(ctx, delta.space, 0, attr.Uid, attr.Gid, attr.Parent); err != 0 {
        return err
    }
    m.updateParentStat(ctx, inode, attr.Parent, delta.length, delta.space) // LEAKS PHANTOM STATS
    return 0
}
```

**VERIFICATION METHOD**:
Verify using an automated integration test executing the following sequence:
1. Open file `/quota_dir/test.dat`.
2. Unlink `/quota_dir/test.dat` (`Nlink` becomes 0).
3. Write $N$ bytes into the open file descriptor.
4. Verify via `GetDirStat(ctx, quota_dir_ino)` that directory space usage remains 0.
5. Close the file descriptor.
6. Verify via `GetDirStat(ctx, quota_dir_ino)` that directory space usage does not drop below 0 (no underflow/drift).

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T07:03:24.033Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795158204033",
    "title": "Inode Link-Zero Ancestry Severance Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "juicedata/juicefs",
    "source_uri": "https://github.com/juicedata/juicefs",
    "source_version": "HEAD",
    "content_hash": "c23d0596975ba366e072f284e5b3f196ba3c51d9dd32aa711678401abd5d6005"
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
        "Harvested/verified timestamp recorded: 2026-11-20T07:03:24.034Z"
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
  "auth_token": "81d517e954f8fb7ae3d1e5c0dc6194a8162b6154c95106b2777294a736004b87"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

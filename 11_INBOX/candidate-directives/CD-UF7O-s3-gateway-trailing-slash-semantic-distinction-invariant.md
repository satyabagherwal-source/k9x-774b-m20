# Candidate Directive: [CD-UF7O] S3 Gateway Trailing-Slash Semantic Distinction Invariant

<!-- PROVENANCE_START
{
  "source_repository": "juicedata/juicefs",
  "source_url": "https://github.com/juicedata/juicefs",
  "source_version": "23d2a456",
  "license": "Apache-2.0",
  "timestamp": "2026-11-20T07:03:24.036Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-juicedata-juicefs",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [juicedata/juicefs](https://github.com/juicedata/juicefs) (Revision: `23d2a456`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-20T07:03:24.036Z`  
> **Learning ID**: `learn-github-juicedata-juicefs`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
When an object gateway layer bridges flat object storage keys to hierarchical POSIX inodes, object keys ending with a trailing slash (`/`) MUST be treated exclusively as directory marker operations (`Lopen`, `Rmdir`, `Utime`). Object keys without a trailing slash MUST be dispatched to file operations (`Unlink`). Under batch deletion protocols, directory keys MUST be executed only AFTER all child file deletions have completed.

**WHY**:
In flat S3 storage, keys `foo` and `foo/` can theoretically coexist as distinct namespace items, but in POSIX, a directory and a regular file cannot share the same path. 

If an S3 gateway dispatches a `Delete("dir/")` request to generic filesystem `Delete()`, it risks:
1. Deleting an active regular file when a directory delete was requested.
2. Failing to clean up explicit zero-byte directory markers without touching non-empty child structures.
3. Prematurely attempting to remove parent directories in batch requests prior to unlinking their files, causing `ENOTEMPTY` errors and leaving orphaned S3 markers.

**WHEN TO APPLY**:
Apply to any S3/POSIX translator, Cloud Object Storage gateway, WebDAV bridge, or virtual filesystem unifying POSIX hierarchical namespaces with flat REST key-value object semantics.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// Language: Go
// Location: pkg/gateway/gateway.go

func (n *jfsObjects) delObj(bucket string, object string) error {
    p := path.Clean(n.path(bucket, object))
    if p == root {
        return nil
    }
    var eno syscall.Errno
    if strings.HasSuffix(object, "/") {
        var dir *fs.File
        // Attempt opening directory without following symlinks
        if dir, eno = n.fs.Lopen(mctx, p, 0); eno == 0 {
            defer dir.Close(mctx)
            fi, _ := dir.Stat()
            explicit := fi.(*fs.FileStat).Atime() == 0
            if !fi.IsDir() || (!explicit && !n.gConf.HeadDir) {
                return nil
            }
            // If the directory still has children, strip only the explicit marker
            if eno = n.fs.Rmdir(mctx, p); fs.IsNotEmpty(eno) && explicit {
                if e := dir.Utime(mctx, time.Now().UnixMilli(), -1); e != 0 {
                    return e
                }
            }
        }
    } else {
        // Non-trailing slash keys are unconditionally unlinked as files
        eno = n.fs.Unlink(mctx, p)
    }

    if eno != 0 {
        // Idempotency: Ignore not found, directory not empty, or type mismatches
        if fs.IsNotEmpty(eno) || fs.IsNotExist(eno) || eno == syscall.ENOTDIR || eno == syscall.EISDIR {
            return nil
        }
        return eno
    }
    return nil
}

// In multi-object batch deletions: Split files from directories, process files first
func (n *jfsObjects) DeleteObjects(ctx context.Context, bucket string, objects []ObjectToDelete) ([]error, error) {
    errs := make([]error, len(objects))
    // Pass 1: Fire batch unlinks for files concurrently
    for idx, o := range objects {
        if strings.HasSuffix(o.ObjectName, "/") {
            continue // Defer directory deletions
        }
        // Group and batch delete files...
    }
    
    // Pass 2: Process trailing-slash directories only after child files are guaranteed deleted
    for idx, o := range objects {
        if strings.HasSuffix(o.ObjectName, "/") {
            errs[idx] = n.delObj(bucket, o.ObjectName)
        }
    }
    return errs, nil
}
```

**NEGATIVE CONSTRAINT**:
```go
// Language: Go
// ANTI-PATTERN: Using a unified generic delete on ambiguous keys without phase separation
func (n *buggyGateway) DeleteObjects(ctx context.Context, bucket string, objects []ObjectToDelete) {
    for _, o := range objects {
        // Disastrous: If directory "a/" is processed before "a/file.txt",
        // rmdir fails with ENOTEMPTY, and subsequent file unlink leaves directory marker orphaned!
        _ = n.fs.Delete(mctx, n.path(bucket, o.ObjectName))
    }
}
```

**VERIFICATION METHOD**:
Run parallel multi-object deletion tests where an array containing `{"a/", "a/f1", "a/f2"}` is passed to `DeleteObjects`. Assert that `a/` is successfully purged from metadata without throwing `ENOTEMPTY` race conditions.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T07:03:24.036Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795158204036",
    "title": "S3 Gateway Trailing-Slash Semantic Distinction Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "juicedata/juicefs",
    "source_uri": "https://github.com/juicedata/juicefs",
    "source_version": "HEAD",
    "content_hash": "b1228ccb71728c391f3edd665113f49e2758b90131ccb06a89a12fcb7176eb9f"
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
        "Harvested/verified timestamp recorded: 2026-11-20T07:03:24.036Z"
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
  "auth_token": "e811de01b04d9990c9375cce940199727489917a463dd3f735c99b8e6ea8eefc"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

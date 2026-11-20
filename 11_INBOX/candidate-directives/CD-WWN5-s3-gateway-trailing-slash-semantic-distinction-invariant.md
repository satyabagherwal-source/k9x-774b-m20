# Candidate Directive: [CD-WWN5] S3 Gateway Trailing-Slash Semantic Distinction Invariant

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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T07:05:19.936Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795158319936",
    "title": "S3 Gateway Trailing-Slash Semantic Distinction Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "juicedata-juicefs-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "912b4e4bb086046eb64745670c5471ebe1e842f4111d663c52f4c3f58458d998"
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
        "Harvested/verified timestamp recorded: 2026-11-20T07:05:19.936Z"
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
  "auth_token": "e495ab2cfbaac75ed99521e8a84d1891ef02680c6437b721b34ea24c90b929bf"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

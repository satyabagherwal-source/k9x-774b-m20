# Candidate Directive: [CD-VICI] AST-Enforced Storage Safety Barrier

<!-- PROVENANCE_START
{
  "source_repository": "rqlite/rqlite",
  "source_url": "https://github.com/rqlite/rqlite",
  "source_version": "b9dc726d",
  "license": "MIT",
  "timestamp": "2026-11-17T08:09:13.122Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-rqlite-rqlite",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rqlite/rqlite](https://github.com/rqlite/rqlite) (Revision: `b9dc726d`).  
> **License**: MIT | **Timestamp**: `2026-11-17T08:09:13.122Z`  
> **Learning ID**: `learn-github-rqlite-rqlite`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain K

## Original Learning Payload (100% Preserved)
**RULE**:
File mutations (removal, renaming, and staging) across distributed state machines MUST NOT invoke native language runtime standard library filesystem primitives directly. They MUST be routed through a platform-aware filesystem encapsulation layer, and this invariant MUST be verified continuously in CI via an AST linter that inspects every selector expression.

**WHY**:
Standard library calls like `os.Rename` or `os.Remove` in Go fail nondeterministically on Windows when background readers, virus scanners, or indexing processes hold open file handles (`ERROR_SHARING_VIOLATION` code 32, `ERROR_ACCESS_DENIED` code 5). Furthermore, POSIX requires explicitly running `fsync` on the parent directory after renaming to ensure durable entry updates across power cuts, whereas Windows file systems reject directory-level `fsync`. Bypassing an abstraction layer leads to corrupt state transitions and flaky tests on non-Linux platforms.

**WHEN TO APPLY**:
Apply to any distributed storage engine, Raft snapshot manager, WAL manager, or embedded database running across POSIX and Windows.

**VERIFIED IMPLEMENTATION PATTERN**:
```go
// internal/fsutil/fsutil.go
package fsutil

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"syscall"
	"time"
)

const (
	errorAccessDenied     syscall.Errno = 5
	errorSharingViolation syscall.Errno = 32
	defaultRetryTimeout                 = 5 * time.Second
	defaultRetryInterval                = 10 * time.Millisecond
)

func Rename(src, dst string) error {
	_, err := RenameWithRetry(src, dst, defaultRetryTimeout, defaultRetryInterval)
	return err
}

func RenameWithRetry(src, dst string, timeout, interval time.Duration) (int, error) {
	return retryInUse(func() error { return os.Rename(src, dst) }, timeout, interval)
}

func retryInUse(fn func() error, timeout, interval time.Duration) (int, error) {
	deadline := time.Now().Add(timeout)
	retries := 0
	for {
		err := fn()
		if err == nil || !isInUse(err) || time.Now().After(deadline) {
			return retries, err
		}
		retries++
		time.Sleep(interval)
	}
}

func isInUse(err error) bool {
	if runtime.GOOS != "windows" {
		return false
	}
	return errors.Is(err, errorAccessDenied) || errors.Is(err, errorSharingViolation)
}

func SyncDir(dir string) error {
	if runtime.GOOS == "windows" {
		return nil // Windows does not permit directory handle flushing
	}
	fh, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer fh.Close()
	return fh.Sync()
}

func CopyDirAtomic(src, dst string) error {
	tmp := dst + ".tmp"
	if err := os.RemoveAll(tmp); err != nil && !os.IsNotExist(err) {
		return err
	}
	defer os.RemoveAll(tmp)

	if err := copyDirContents(src, tmp); err != nil {
		return err
	}
	if err := SyncDir(tmp); err != nil {
		return err
	}
	if err := Rename(tmp, dst); err != nil {
		return err
	}
	return SyncDir(filepath.Dir(dst))
}
```

**NEGATIVE CONSTRAINT**:
```go
// NEVER DO THIS in production storage layers:
func SaveSnapshot(tmpDir, finalDir string) error {
    // VIOLATION: Bare os.Rename will crash on Windows with ERROR_SHARING_VIOLATION
    // VIOLATION: Missing parent directory SyncDir means crash-recovery can lose the rename on POSIX
    if err := os.Rename(tmpDir, finalDir); err != nil {
        return os.RemoveAll(tmpDir) // VIOLATION: Standard remove will fail if still open
    }
    return nil
}
```

**VERIFICATION METHOD**:
Compile and execute an AST inspection tool during CI (similar to `tools/check-fsutil/main.go`):
```bash
go run ./tools/check-fsutil -root .
```
The AST scanner parses every file's `*ast.SelectorExpr`, checking if `X` resolves to `"os"` and `Sel.Name` matches `["Rename", "Remove", "RemoveAll"]`. The build fails with exit code 1 if found outside `internal/fsutil`.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:09:13.120Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794902953120",
    "title": "AST-Enforced Storage Safety Barrier",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rqlite/rqlite",
    "source_uri": "https://github.com/rqlite/rqlite",
    "source_version": "HEAD",
    "content_hash": "df17a81f7898137b7e990d0dcf1c872fc318f0e16320003fd9cb60a35da0b102"
  },
  "evidence_fingerprint": "0ea4249640d6d3cc",
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
        "Direct empirical evidence ratio: 0% (0/4)",
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:09:13.120Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "fbc75d5db27b6dc52c0ed60a993d4725cc8f95f22109d8625841322a48d41950"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

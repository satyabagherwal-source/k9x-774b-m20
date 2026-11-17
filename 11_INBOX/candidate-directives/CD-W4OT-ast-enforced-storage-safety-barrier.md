# Candidate Directive: [CD-W4OT] AST-Enforced Storage Safety Barrier

<!-- PROVENANCE_START
{
  "source_repository": "rqlite-rqlite-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-17T08:09:41.981Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-rqlite-rqlite-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [rqlite-rqlite-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-17T08:09:41.981Z`  
> **Learning ID**: `LEARN-EVO-rqlite-rqlite-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
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

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-17T08:09:42.076Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794902982076",
    "title": "AST-Enforced Storage Safety Barrier",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "rqlite-rqlite-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "fcf8770cef3dbc152cc10818f51c602cd21bc0f133b7d1cc0e697d056760c400"
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
        "Harvested/verified timestamp recorded: 2026-11-17T08:09:42.076Z"
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
  "auth_token": "7c8dc6966da45de6c13b91a24b30b9079721b9699fb21aedbd63c5e0e250bcb6"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

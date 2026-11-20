# Candidate Directive: [CD-Y1IB] Procfs Chroot Boundary Path Resolution Invariant

<!-- PROVENANCE_START
{
  "source_repository": "metalbear-co-mirrord-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-20T01:02:17.793Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-metalbear-co-mirrord-learnings",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [metalbear-co-mirrord-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-20T01:02:17.793Z`  
> **Learning ID**: `LEARN-EVO-metalbear-co-mirrord-learnings`


## Lifecycle Status
- **Current Status**: `QUARANTINED_REJECT`
- **Rejection / Holding Reason**: Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain G

## Original Learning Payload (100% Preserved)
**RULE**:
When resolving paths inside an external Linux container via host `/proc/<PID>/root`, the resolver **MUST**:
1. Recursively follow relative and absolute symlinks with an absolute hop counter bounded by a hard cap (`MAX_SYMLINK_HOPS <= 40`, matching the Linux VFS limit).
2. Explicitly prevent symlink loops from causing unbounded recursion or stack exhaustion by returning `libc::ELOOP`.
3. Provide a separate non-dereferencing lookup mode (`resolve_no_follow`) for metadata operations (`lstat`, `readlink`) that resolves parent directories against the container target root while preserving the final leaf component as an unresolved link.
4. Normalize trailing slash semantics so that paths ending in `/` force resolution of the leaf component even in `no_follow` modes.

**WHY**:
Directly concatenating host `/proc/<PID>/root` with a user-supplied path causes absolute symlinks (e.g. `/var/run -> /run`) to jump out of the target container's procfs tree and resolve against the *host* filesystem root (`/run`). This exposes host tokens, leaked secrets, or unauthorized device nodes. Failure to bound symlink recursion causes agent denial-of-service via stack overflow.

**WHEN TO APPLY**:
Any container agent, eBPF observer, or privileged microservice reading or mutating container filesystems via `/proc/$PID/root`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::{
    io,
    ops::Not,
    os::unix::ffi::OsStrExt,
    path::{Component, Path, PathBuf},
};

pub struct InTargetPathResolver {
    root: PathBuf,
}

impl InTargetPathResolver {
    pub const MAX_SYMLINK_HOPS: u8 = 40;

    pub fn from_pid(target_pid: u64) -> Self {
        Self { root: PathBuf::from(format!("/proc/{target_pid}/root")) }
    }

    pub fn resolve(&self, path: &Path) -> io::Result<PathBuf> {
        let mut depth = Self::MAX_SYMLINK_HOPS;
        self.resolve_inner(path, PathBuf::new(), &mut depth)
            .map(|p| self.root.join(p))
    }

    pub fn resolve_no_follow(&self, path: &Path) -> io::Result<PathBuf> {
        // POSIX standard: Trailing slash explicitly requests following the final link
        if path.as_os_str().as_bytes().ends_with(b"/") {
            return self.resolve(path);
        }

        match (path.parent(), path.file_name()) {
            (Some(parent), Some(name)) => Ok(self.resolve(parent)?.join(name)),
            _ => self.resolve(path),

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:02:17.891Z",
  "decision": "REJECT",
  "decision_reason": "Rejected fail-closed: MISSING_SOURCE_URI: Knowledge has no source URL or locator; NO_EVIDENCE_RECORDS: Knowledge item has zero associated evidence records",
  "recommended_action": "REJECT_FAIL_CLOSED",
  "confidence_score": 0,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 0%). Source=FAIL (UNTRUSTED_EXTERNAL), Evidence=WARN (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795136537891",
    "title": "Procfs Chroot Boundary Path Resolution Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "metalbear-co-mirrord-learnings",
    "source_uri": "",
    "source_version": "HEAD",
    "content_hash": "8ec7c838b36ff68c09b2aede70d32f0bd7884fe2e0d1fa37c947c50b2db7d652"
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:02:17.891Z"
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
  "auth_token": "6ced8f60cbdc2eee89a155d439aff752fae662803671b3f3aea0386dc28516b9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

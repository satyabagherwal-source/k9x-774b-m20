# Candidate Directive: [CD-VRNI] Procfs Chroot Boundary Path Resolution Invariant

<!-- PROVENANCE_START
{
  "source_repository": "metalbear-co/mirrord",
  "source_url": "https://github.com/metalbear-co/mirrord",
  "source_version": "3a843d8d",
  "license": "MIT",
  "timestamp": "2026-11-20T01:00:31.806Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-metalbear-co-mirrord",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [metalbear-co/mirrord](https://github.com/metalbear-co/mirrord) (Revision: `3a843d8d`).  
> **License**: MIT | **Timestamp**: `2026-11-20T01:00:31.806Z`  
> **Learning ID**: `learn-github-metalbear-co-mirrord`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
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
        }
    }

    fn resolve_inner(&self, path: &Path, from: PathBuf, max_depth: &mut u8) -> io::Result<PathBuf> {
        let mut tmp_path = if path.has_root() { PathBuf::new() } else { from };

        for comp in path.components() {
            match comp {
                Component::Prefix(_) => return Err(io::Error::new(io::ErrorKind::InvalidInput, "Prefix not supported")),
                Component::RootDir | Component::CurDir => {}
                Component::ParentDir => { tmp_path.pop(); }
                Component::Normal(comp) => {
                    tmp_path.push(comp);
                    let real_path = self.root.join(&tmp_path);

                    let is_symlink = match real_path.symlink_metadata() {
                        Ok(meta) => meta.file_type().is_symlink(),
                        Err(err) if err.kind() == io::ErrorKind::NotFound => false,
                        Err(err) => return Err(err),
                    };

                    if is_symlink.not() {
                        continue;
                    }

                    if *max_depth == 0 {
                        return Err(io::Error::from_raw_os_error(libc::ELOOP));
                    }
                    *max_depth -= 1;

                    let link = real_path.read_link()?;
                    let from = tmp_path.parent().expect("tmp_path parent exists").to_path_buf();
                    tmp_path = self.resolve_inner(&link, from, max_depth)?;
                }
            }
        }

        if path.as_os_str().as_bytes().ends_with(b"/") {
            tmp_path.push("");
        }
        Ok(tmp_path)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// NEVER do this: Naive path concatenation without symlink containment
pub fn resolve_naive(target_pid: u64, untrusted_path: &Path) -> PathBuf {
    // SECURITY CRITICAL DEFECT:
    // If untrusted_path is "/var/run/secret" and "/var/run" is a symlink to "/run",
    // the OS resolves "/proc/1234/root/var/run/secret" -> "/run/secret" on the HOST.
    Path::new(&format!("/proc/{}/root", target_pid)).join(untrusted_path.strip_prefix("/").unwrap_or(untrusted_path))
}
```

**VERIFICATION METHOD**:
Create a temporary directory structure mimicking an absolute symlink loop (`/a -> b`, `/b -> a`) and an escaping symlink (`/etc/target -> /etc/shadow`). Assert that `resolve()` returns `libc::ELOOP` on cycles, and correctly prefixes the resolved absolute symlink under the mock target root without leaking host paths.

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-20T01:00:31.805Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.69,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 69%). Source=PASS (TIER_3_COMMUNITY_OPEN), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1795136431805",
    "title": "Procfs Chroot Boundary Path Resolution Invariant",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "metalbear-co/mirrord",
    "source_uri": "https://github.com/metalbear-co/mirrord",
    "source_version": "HEAD",
    "content_hash": "3e2cfeb1642ad87f154226318b95ead09ecffe5f537a74628f1d17507c297777"
  },
  "evidence_fingerprint": "94110ab92c61e587",
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
        "Direct empirical evidence ratio: 0% (0/2)",
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
        "Harvested/verified timestamp recorded: 2026-11-20T01:00:31.805Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "898288f3afc71af1317e1e30b2673dc7af63383f3bf4a6002453a74ecb5f4657"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

# Candidate Directive: [CD-3ZGZ] Dynamic TCC/Security Identity Attribution via Dynamic Symbol Loading

<!-- PROVENANCE_START
{
  "source_repository": "vercel-labs/agent-desktop",
  "source_url": "https://github.com/vercel-labs/agent-desktop",
  "source_version": "8ffecc1d",
  "license": "Apache-2.0",
  "timestamp": "2026-11-15T21:44:16.979Z",
  "ai_provider": "google-gemini-cloud-agent",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-vercel-labs-agent-desktop",
  "canonical_classification": "candidate_directive"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [vercel-labs/agent-desktop](https://github.com/vercel-labs/agent-desktop) (Revision: `8ffecc1d`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-15T21:44:16.979Z`  
> **Learning ID**: `learn-github-vercel-labs-agent-desktop`


## Lifecycle Status
- **Current Status**: `STAGED_FOR_REVIEW`
- **Rejection / Holding Reason**: Quarantined for review: Incomplete rule definition or ungrounded evidence ()
- **Retry Eligibility**: `YES`
- **Candidate Domain**: Domain H

## Original Learning Payload (100% Preserved)
**RULE**:
When building command-line utilities that interface with OS-level privacy/entitlement subsystems (such as Apple's TCC: Transparency, Consent, and Control), diagnostic and guidance tools **MUST NOT** assume the immediate process parent (`getppid()`) is the principal security debtor. The system **MUST** resolve the actual responsible process via dynamic library linkage (`dlsym(libc::RTLD_DEFAULT, "responsibility_get_pid_responsible_for_pid")`), falling back to an ancestor tree walk only if dynamic loading returns `NULL`.

**WHY**:
Terminal multiplexers (such as `tmux` or `screen`) detach their servers and become reparented to system init (`launchd` or `systemd`, PID 1). Walking parent PIDs returns PID 1 or an orphaned shell, causing permission diagnostics to report the wrong executable bundle or prompt the user to authorize binary paths that the kernel does not honor.

**WHEN TO APPLY**:
Security permission verifiers, CLI accessibility assistants, and GUI session hooks on macOS 10.14+.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::path::{Path, PathBuf};

pub fn resolve_responsible_app() -> Option<PathBuf> {
    let current_pid = i32::try_from(std::process::id()).ok()?;
    host_app_of(current_pid, responsible_pid)
}

fn host_app_of(pid: i32, responsible_lookup: impl Fn(i32) -> Option<i32>) -> Option<PathBuf> {
    responsible_lookup(pid)
        .and_then(app_of)
        .or_else(|| ancestor_app(pid))
}

fn app_of(pid: i32) -> Option<PathBuf> {
    executable_path(pid)
        .as_deref()
        .and_then(outermost_app)
}

fn responsible_pid(pid: i32) -> Option<i32> {
    // Dynamically resolve private libSystem symbol to avoid static linkage failures on older OS versions
    let symbol = unsafe {
        libc::dlsym(
            libc::RTLD_DEFAULT,
            c"responsibility_get_pid_responsible_for_pid".as_ptr(),
        )
    };
    if symbol.is_null() {
        return None;
    }
    let responsible_fn: unsafe extern "C" fn(libc::pid_t) -> libc::pid_t =
        unsafe { std::mem::transmute(symbol) };
    let resp = unsafe { responsible_fn(pid) };
    (resp > 0).then_some(resp)
}

fn ancestor_app(mut pid: i32) -> Option<PathBuf> {
    const MAX_ANCESTORS: usize = 32;
    for _ in 0..MAX_ANCESTORS {
        if pid <= 1 {
            return None;
        }
        if let Some(app) = app_of(pid) {
            return Some(app);
        }
        pid = parent_pid(pid)?;
    }
    None
}
```

**NEGATIVE CONSTRAINT**:
```rust
// FATAL ANTI-PATTERN: Relying strictly on getppid()
fn get_security_debtor_bad() -> PathBuf {
    let ppid = unsafe { libc::getppid() };
    // If running under tmux, ppid is 1 (launchd), returning None or /sbin/launchd!
    executable_path(ppid).unwrap()
}
```

**VERIFICATION METHOD**:
Spawn a detached shell child in a unit test:
```rust
let orphan = Command::new("/bin/sh")
    .args(["-c", "/bin/sleep 30 >/dev/null 2>&1 & echo $!"])
    .output().unwrap();
// Wait until parent_pid(orphan) == Some(1)
// Verify responsible_pid(orphan) returns the parent test binary, NOT 1.
```

---

## Quality Gate Validation Dimensions
```json
{
  "validator_version": "0.1.0",
  "validated_at": "2026-11-15T21:44:16.979Z",
  "decision": "NEEDS_REVIEW",
  "decision_reason": "Quarantined for review: Incomplete rule definition or ungrounded evidence ()",
  "recommended_action": "QUARANTINE_FOR_REVIEW",
  "confidence_score": 0.71,
  "confidence_justification": "Evaluated across 7 dimensions (Score: 71%). Source=PASS (TIER_2_OFFICIAL_ECOSYSTEM), Evidence=FAIL (0 effective sources), Correctness=PASS, Reusability=PASS, Completeness=PASS, Freshness=WARN, Conflict=PASS.",
  "item": {
    "id": "cand-1794779056979",
    "title": "Dynamic TCC/Security Identity Attribution via Dynamic Symbol Loading",
    "category": "ENGINEERING_PATTERN",
    "domain": "ARCHITECTURE",
    "source_id": "vercel-labs/agent-desktop",
    "source_uri": "https://github.com/vercel-labs/agent-desktop",
    "source_version": "HEAD",
    "content_hash": "86326ed76101f20c63a5ad086cb97be05efdec12ecb689759a8cab0d03c93917"
  },
  "evidence_fingerprint": "f4ebc73b386fdfdf",
  "dimensions": {
    "source_reliability": {
      "status": "PASS",
      "score": 0.75,
      "tier": "TIER_2_OFFICIAL_ECOSYSTEM",
      "findings": [],
      "details": [
        "Source belongs to recognized official ecosystem (TIER_2_OFFICIAL_ECOSYSTEM)",
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
        "Direct empirical evidence ratio: 0% (0/3)",
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
        "Harvested/verified timestamp recorded: 2026-11-15T21:44:16.979Z"
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
    "EVID-UNSPECIFIED"
  ],
  "auth_token": "2dde9d024c0033347707650991c639e144e25fbc31b9634dd7618e0804af5de9"
}
```

## Remediation Checklist to Enable Promotion
- [ ] Verify empirical reproducibility on isolated sandbox fixture.
- [ ] Add missing implementation code block or negative constraint.
- [ ] Authorize human signature token if targeting Core laws or Domain M.

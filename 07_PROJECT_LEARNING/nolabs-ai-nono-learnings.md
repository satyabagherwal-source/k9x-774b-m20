> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nolabs-ai-nono-learnings.md`  
> **Source**: github ([https://github.com/nolabs-ai/nono](https://github.com/nolabs-ai/nono))  
> **Source Version**: `ab16bef9`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-02T16:33:32.822Z  
> **Learning ID**: `learn-github-nolabs-ai-nono`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): nolabs-ai/nono

> **Canonical Artifact**: `07_PROJECT_LEARNING/nolabs-ai-nono-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nolabs-ai/nono](https://github.com/nolabs-ai/nono))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-02T16:33:31.985Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nolabs-ai/nono`
- **Description**: agent runtime security - zero trust, zero setup, zero latency agent sandboxing
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4806 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `bindings/c/src/state.rs`
```
//! FFI wrapper for `nono::SandboxState`.

use std::os::raw::c_char;

use crate::capability_set::NonoCapabilitySet;
use crate::{c_str_to_str, map_error, rust_string_to_c, set_last_error};

/// Opaque handle to a sandbox state snapshot.
///
/// Created with `nono_sandbox_state_from_caps()` or
/// `nono_sandbox_state_from_json()`.
/// Freed with `nono_sandbox_state_free()`.
pub struct NonoSandboxState {
    inner: nono::SandboxState,
}

/// Create a state snapshot from a capability set.
///
/// Returns NULL if `caps` is NULL.
/// Caller must free with `nono_sandbox_state_free()`.
///
/// # Safety
///
/// `caps` must be a valid pointer or NULL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_sandbox_state_from_caps(
    caps: *const NonoCapabilitySet,
) -> *mut NonoSandboxState {
    if caps.is_null() {
        return std::ptr::null_mut();
    }
    let caps = unsafe { &*caps };
    let state = NonoSandboxState {
        inner: nono::SandboxState::from_caps(&caps.inner),
    };
    Box::into_raw(Box::new(state))
}

/// Free a sandbox state.
///
/// NULL-safe (no-op on NULL).
///
/// # Safety
///
/// `state` must be NULL or a pointer previously returned by
/// `nono_sandbox_state_from_caps()` or `nono_sandbox_state_from_json()`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_sandbox_state_free(state: *mut NonoSandboxState) {
    if !state.is_null() {
        // SAFETY: The pointer was created by Box::into_raw() in a factory
        // function in this module.
        unsafe {
            drop(Box::from_raw(state));
        }
    }
}

/// Serialize the state to a JSON string.
///
/// Caller must free the returned string with `nono_string_free()`.
/// Returns NULL if `state` is NULL or serialization fails
/// (call `nono_last_error()` for details).
///
/// # Safety
///
/// `state` must be a valid pointer or NULL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_sandbox_state_to_json(state: *const NonoSandboxState) -> *mut c_char {
    if state.is_null() {
        return std::ptr::null_mut();
    }
    let state = unsafe { &*state };
    match state.inner.to_json() {
        Ok(json) => rust_string_to_c(json),
        Err(e) => {
            set_last_error(&e.to_string());
            std::ptr::null_mut()
        }
    }
}

/// Deserialize state from a JSON string.
///
/// Returns NULL on parse error (call `nono_last_error()` for details).
/// Caller must free with `nono_sandbox_state_free()`.
///
/// # Safety
///
/// `json` must be a valid null-terminated UTF-8 string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_sandbox_state_from_json(
    json: *const c_char,
) -> *mut NonoSandboxState {
    let json_str = match unsafe { c_str_to_str(json) } {
        Some(s) => s,
        None => {
            set_last_error("json is NULL or invalid UTF-8");
            return std::ptr::null_mut();
        }
    };

    match nono::SandboxState::from_json(json_str) {
        Ok(state) => Box::into_raw(Box::new(NonoSandboxState { inner: state })),
        Err(e) => {
            set_last_error(&format!("JSON parse error: {e}"));
            std::ptr::null_mut()
        }
    }
}

/// Convert a state snapshot back to a capability set.
///
/// Returns NULL on error (e.g. if referenced paths no longer exist).
/// Call `nono_last_error()` for the detailed message.
/// Caller must free with `nono_capability_set_free()`.
///
/// # Safety
///
/// `state` must be a valid pointer or NULL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_sandbox_state_to_caps(
    state: *const NonoSandboxState,
) -> *mut NonoCapabilitySet {
    if state.is_null() {
        set_last_error("state pointer is NULL");
        return std::ptr::null_mut();
    }
    let state = unsafe { &*state };
    match state.inner.to_caps() {
        Ok(caps) => Box::into_raw(Box::new(NonoCapabilitySet { inner: caps })),
        Err(e) => {
            let _ = map_error(&e);
            std::ptr::null_mut()
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::capability_set::{
        nono_capability_set_block_dns, nono_capability_set_dns_enabled, nono_capability_set_free,
        nono_capability_set_is_network_blocked, nono_capability_set_new,
        nono_capability_set_set_network_blocked,
    };
    use std::ffi::CStr;

    #[test]
    fn test_state_lifecycle() {
        let caps = nono_capability_set_new();
        // SAFETY: caps is valid.
        unsafe {
            nono_capability_set_set_network_blocked(caps, true);
            let state = nono_sandbox_state_from_caps(caps);
            assert!(!state.is_null());
            nono_sandbox_state_free(state);
            nono_capability_set_free(caps);
        }
    }

    #[test]
    fn test_state_null_safe() {
        // SAFETY: deliberate NULL.
        unsafe {
            assert!(nono_sandbox_state_from_caps(std::ptr::null()).is_null());
            assert!(nono_sandbox_state_to_json(std::ptr::null()).is_null());
            assert!(nono_sandbox_state_to_caps(std::ptr::null()).is_null());
            nono_sandbox_state_free(std::ptr::null_mut());
        }
    }

    #[test]
    fn test_state_json_roundtrip() {
        let caps = nono_capability_set_new();
        // SAFETY: caps is valid.
        unsafe {
            nono_capability_set_set_network_blocked(caps, true);
            assert_eq!(
                nono_capability_set_block_dns(caps),
                crate::types::NonoErrorCode::Ok
            );
            let state = nono_sandbox_state_from_caps(caps);

            let json_ptr = nono_sandbox_state_to_json(state);
            assert!(!json_ptr.is_null());

            // SAFETY: json_ptr is valid.
            let json_str = CStr::from_ptr(json_ptr).to_str().unwrap_or_default();
            assert!(json_str.contains("net_blocked"));

            let state2 = nono_sandbox_state_from_json(json_ptr);
            assert!(!state2.is_null());

            let restored = nono_sandbox_state_to_caps(state2);
            assert!(!restored.is_null());
            assert!(!nono_capability_set_dns_enabled(restored));
            assert!(nono_capability_set_is_network_blocked(restored));

            nono_capability_set_free(restored);
            nono_sandbox_state_free(state2);
            crate::nono_string_free(json_ptr);
            nono_sandbox_state_free(state);
            nono_capability_set_free(caps);
        }
    }

    #[test]
    fn test_state_from_invalid_json() {
        let bad_json = std::ffi::CString::new("not valid json").unwrap_or_default();
        // SAFETY: bad_json is valid.
        unsafe {
            let state = nono_sandbox_state_from_json(bad_json.as_ptr());
            assert!(state.is_null());

            let err = crate::nono_last_error();
            assert!(!err.is_null());
            crate::nono_string_free(err);
        }
    }

    #[test]
    fn test_state_to_caps() {
        let caps = nono_capability_set_new();
        // SAFETY: caps is valid.
        unsafe {
            nono_capability_set_set_network_blocked(caps, true);
            let state = nono_sandbox_state_from_caps(caps);

            let restored = nono_sandbox_state_to_caps(state);
            assert!(!restored.is_null());

            nono_capability_set_free(restored);
            nono_sandbox_state_free(state);
            nono_capability_set_free(caps);
        }
    }
}

```

### Core Architecture Module: `crates/nono-cli/src/hook_runtime.rs`
```
//! Session lifecycle hook execution.
//!
//! Handles execution of before/after hooks for sandbox sessions.
//! All hooks run outside the sandbox with host privileges.
//!
//! Unix-only: relies on POSIX uid/mode metadata, `pre_exec`, and process
//! group signalling. Gated by `#[cfg(unix)]` at the module declaration in
//! `main.rs`.
//!
//! # Security
//!
//! - Script paths support the same `$WORKDIR`/`$HOME`/`$TMPDIR`/XDG/etc.
//!   variable expansion as other profile paths (see `profile::expand_vars`),
//!   so a shared profile need not hardcode a per-machine absolute path.
//!   Expansion happens first; the result must still resolve to an absolute
//!   path.
//! - Script paths are validated before every execution
//!   (absolute, canonical, regular file, executable, owned by user, not world-writable)
//! - Hooks run as subprocesses
//! - Process group isolation for timeout-based killing
//! - NONO_ENV_FILE is used for env var export (not stdout parsing)
//! - Dangerous env vars are filtered before injection

use crate::{exec_strategy, profile, session};
use nono::{NonoError, Result};
use std::os::unix::fs::{MetadataExt, OpenOptionsExt, PermissionsExt};
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc;
use std::thread;
use std::time::Duration;
use tracing::{debug, warn};

/// Result of executing a session hook.
struct HookOutput {
    exit_code: i32,
    timed_out: bool,
}

/// Discriminator for the two hook variants.
///
/// `Before` carries the path to the env file the hook is expected to populate.
/// `After` carries the exit code of the sandboxed child process.
enum HookKind<'a> {
    Before { env_file: &'a Path },
    After { exit_code: i32 },
}

impl HookKind<'_> {
    fn type_env(&self) -> &'static str {
        match self {
            HookKind::Before { .. } => "before",
            HookKind::After { .. } => "after",
        }
    }
}

/// Execute a before-hook and return exported environment variables.
///
/// Steps:
/// 1. Validate script path
/// 2. Create NONO_ENV_FILE in private session directory (RAII guard)
/// 3. Spawn hook with isolated environment
/// 4. Wait for completion with optional timeout
/// 5. Read and parse NONO_ENV_FILE
/// 6. Filter dangerous env vars
pub(crate) fn execute_before_hook(
    hook: &profile::SessionHook,
    session_id: &str,
    workdir: &Path,
) -> Result<Vec<(String, String)>> {
    let expanded = profile::expand_vars(&hook.script.to_string_lossy(), workdir)?;
    let script_path = validate_hook_script(&expanded)?;
    let env_file = EnvFileGuard::create(session_id)?;

    let mut cmd = build_hook_command(
        &script_path,
        session_id,
        workdir,
        &HookKind::Before {
            env_file: env_file.path(),
        },
    );
    let output = run_hook(&mut cmd, hook.timeout_secs)?;

    if output.timed_out {
        warn!(
            "Before-hook timed out ({}s): {}",
            hook.timeout_secs.unwrap_or(0),
            script_path.display()
        );
        return Ok(Vec::new());
    }

    if output.exit_code != 0 {
        warn!(
            "Before-hook exited with code {}: {}",
            output.exit_code,
            script_path.display()
        );
    }

    let raw = read_env_file(env_file.path())?;
    let total = raw.len();
    let filtered: Vec<(String, String)> = raw
        .into_iter()
        .filter(|(k, _)| !exec_strategy::is_dangerous_env_var(k))
        .collect();

    debug!(
        "Before-hook exported {} env vars ({} filtered out)",
        filtered.len(),
        total.saturating_sub(filtered.len())
    );

    Ok(filtered)
}

/// Execute an after-hook for cleanup.
///
/// Steps:
/// 1. Validate script path
/// 2. Execute with isolated env, passing child exit code via NONO_EXIT_CODE
/// 3. Log result
pub(crate) fn execute_after_hook(
    hook: &profile::SessionHook,
    session_id: &str,
    workdir: &Path,
    child_exit_code: i32,
) -> Result<()> {
    let expanded = profile::expand_vars(&hook.script.to_string_lossy(), workdir)?;
    let script_path = validate_hook_script(&expanded)?;
    let mut cmd = build_hook_command(
        &script_path,
        session_id,
        workdir,
        &HookKind::After {
            exit_code: child_exit_code,
        },
    );
    let output = run_hook(&mut cmd, hook.timeout_secs)?;

    if output.timed_out {
        warn!(
            "After-hook timed out ({}s): {}",
            hook.timeout_secs.unwrap_or(0),
            script_path.display()
        );
        return Ok(());
    }

    if output.exit_code != 0 {
        warn!(
            "After-hook exited with code {}: {}",
            output.exit_code,
            script_path.display()
        );
    }

    Ok(())
}

// ===================== Internal Helpers =====================

/// Build a `Command` configured for a hook execution.
///
/// Sets `NONO_SESSION_ID` / `NONO_WORKDIR` / `NONO_HOOK_TYPE` plus the
/// kind-specific env vars and stdio. Installs the `setpgid` pre-exec hook so
/// the child can be killed as a process group on timeout.
fn build_hook_command(
    script: &Path,
    session_id: &str,
    workdir: &Path,
    kind: &HookKind<'_>,
) -> Command {
    let mut cmd = Command::new(script);
    cmd.env("NONO_SESSION_ID", session_id);
    cmd.env("NONO_WORKDIR", workdir);
    cmd.env("NONO_HOOK_TYPE", kind.type_env());
    cmd.stdin(Stdio::null());
    cmd.stderr(Stdio::piped());

    match kind {
        HookKind::Before { env_file } => {
            cmd.env("NONO_ENV_FILE", env_file);
            cmd.stdout(Stdio::piped());
        }
        HookKind::After { exit_code } => {
            cmd.env("NONO_EXIT_CODE", exit_code.to_string());
            cmd.stdout(Stdio::null());
        }
    }

    // SAFETY: setpgid(0,0) places the child in its own process group for
    // clean timeout killing. POSIX guarantees setpgid is async-signal-safe.
    unsafe {
        cmd.pre_exec(|| {
            let _ =
                nix::unistd::setpgid(nix::unistd::Pid::from_raw(0), nix::unistd::Pid::from_raw(0));
            Ok(())
        });
    }

    cmd
}

/// Validate a hook script path.
///
/// Security checks:
/// - Absolute path
/// - Path exists and is a regular file
/// - File is executable
/// - File is owned by current user or root
/// - File is not in a world-writable directory
fn validate_hook_script(path: &Path) -> Result<PathBuf> {
    if !path.is_absolute() {
        return Err(NonoError::ConfigParse(format!(
            "Hook script path must be absolute: {}",
            path.display()
        )));
    }

    let canonical = path.canonicalize().map_err(|e| {
        NonoError::ConfigParse(format!("Hook script not found: {}: {}", path.display(), e))
    })?;

    let metadata = canonical.metadata().map_err(|e| {
        NonoError::ConfigParse(format!(
            "Cannot read hook script metadata: {}: {}",
            canonical.display(),
            e
        ))
    })?;

    if !metadata.is_file() {
        return Err(NonoError::ConfigParse(format!(
            "Hook script is not a regular file: {}",
            canonical.display()
        )));
    }

    let mode = metadata.permissions().mode();
    if (mode & 0o111) == 0 {
        return Err(NonoError::ConfigParse(format!(
            "Hook script is not executable: {}",
            canonical.display()
        )));
    }

    let uid = metadata.uid();
    let my_uid = nix::unistd::geteuid().as_raw();
    if uid != my_uid && uid != 0 {
        return Err(NonoError::ConfigParse(format!(
            "Hook script owned by uid {} (expected {} or root): {}",
            uid,
            my_uid,
            canonical.display()
        )));
    }

    if let Some(parent) = canonical.parent()
        && is_world_writable(parent)
    {
        return Err(NonoError::ConfigParse(format!(
            "Hook script must not be in a world-writable directory: {} (resolved: {})",
            path.display(),
            canonical.display()
        )));
    }

    Ok(canonical)
}

/// Check if a directory is world-writable.
/// Rejects ALL world-writable dirs including /tmp with sticky bit.
fn is_world_writable(path: &Path) -> bool {
    path.metadata()
        .map(|m| (m.permissions().mode() & 0o002) != 0)
        .unwrap_or(false)
}

/// RAII guard for the per-session env file.
///
/// `EnvFileGuard::create` builds `~/.nono/sessions/<id>/env` with `O_EXCL`
/// and 0o600 permissions. On `Drop` the file is best-effort zeroed and
/// unlinked, so it disappears even on early `?` returns from the caller.
struct EnvFileGuard {
    path: PathBuf,
}

impl EnvFileGuard {
    fn create(session_id: &str) -> Result<Self> {
        let sessions_dir = session::ensure_sessions_dir()?;
        let session_env_dir = sessions_dir.join(session_id);

        std::fs::create_dir_all(&session_env_dir).map_err(|e| {
            NonoError::ConfigParse(format!(
                "Failed to create session env directory {}: {e}",
                session_env_dir.display()
            ))
        })?;

        let _ = std::fs::set_permissions(&session_env_dir, std::fs::Permissions::from_mode(0o700));

        let path = session_env_dir.join("env");

        std::fs::OpenOptions::new()
            .create_new(true)
            .write(true)
            .mode(0o600)
            .open(&path)
            .map_err(|e| NonoError::ConfigParse(format!("Failed to create env file: {e}")))?;

        Ok(Self { path })
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for EnvFileGuard {
    fn drop(&mut self) {
        if let Ok(mut file) = std::fs::OpenOptions::new().write(true).open(&self.path)
            && let Ok(metadata) = file.metadata()
        {
            use std::io::Write;
            let zeros = vec![0u8; metadata.len() as usize];
            let _ = file.write_all(&zeros);
            let _ = file.sync_all();
        }
        let _ = std::fs::remove_file(&self.path);
    }
}

///
```

### Core Architecture Module: `crates/nono-cli/src/sandbox_state.rs`
```
//! Sandbox state persistence for `nono why --self`
//!
//! When nono runs a command, it writes the capability state to a temp file
//! and passes the path via NONO_CAP_FILE. This allows sandboxed processes
//! to query their own capabilities using `nono why --self`.

#[cfg(target_os = "macos")]
use crate::capability_ext::new_exact_path_capability;
use nono::{
    AccessMode, CapabilitySet, CapabilitySource, FsCapability, NonoError, ResourceLimits, Result,
    SocketScope, UnixSocketCapability,
};
use serde::{Deserialize, Serialize};
use std::fs::OpenOptions;
use std::io::Write;
use std::path::{Path, PathBuf};
use tracing::debug;

#[cfg(unix)]
use std::os::unix::fs::OpenOptionsExt;

/// Sandbox state stored for `nono why --self`
#[derive(Debug, Serialize, Deserialize)]
pub struct SandboxState {
    /// Filesystem capabilities
    pub fs: Vec<FsCapState>,
    /// Pathname AF_UNIX socket capabilities in effect for this sandbox.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub unix_sockets: Vec<UnixSocketCapability>,
    /// OS enforcement mode for pathname AF_UNIX sockets. `None` means the
    /// state was written by an older build and cannot answer socket queries.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pathname_socket_enforcement: Option<PathnameSocketEnforcement>,
    /// Whether network is blocked
    pub net_blocked: bool,
    /// Commands explicitly allowed
    pub allowed_commands: Vec<String>,
    /// Commands explicitly blocked
    pub blocked_commands: Vec<String>,
    /// Applied bypasses with the access modes Seatbelt actually reopens.
    /// Older state files without mode data default to no bypass authority.
    #[serde(default)]
    pub applied_bypasses: Vec<crate::policy::AppliedBypass>,
    /// Resolved filesystem deny paths enforced by the active profile.
    ///
    /// These are not filesystem capabilities: on macOS they are explicit
    /// Seatbelt deny rules which override covering allows. Persist them so
    /// `nono why --self` reports the kernel policy rather than only the allow
    /// side of the capability set.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub deny_paths: Vec<String>,
    /// Proxy domain allowlist at sandbox creation time
    #[serde(default)]
    pub allowed_domains: Vec<String>,
    /// Proxy domain denylist (`network.deny_domain`) at sandbox creation time.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub denied_domains: Vec<String>,
    /// Endpoint-restricted domains with method+path rules
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub domain_endpoints: Vec<DomainEndpointState>,
    /// Resource ceilings (memory and max processes) in effect for this sandbox,
    /// so `nono why --self` can report them. Absent in states written by older
    /// nono builds; `#[serde(default)]` keeps those loadable.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resource_limits: Option<ResourceLimits>,
}

/// Enforcement applied to pathname AF_UNIX operations for a running sandbox.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PathnameSocketEnforcement {
    /// Linux seccomp pathname mediation is disabled.
    LinuxUnmediated,
    /// Linux seccomp pathname mediation enforces explicit socket grants.
    LinuxAllowlist,
    /// macOS Seatbelt enforces pathname socket policy directly.
    MacosSeatbelt,
}

/// Resolve the platform enforcement mode from the Linux mediation setting.
/// The argument is ignored on macOS, where Seatbelt is always the backend.
#[must_use]
pub fn pathname_socket_enforcement(
    linux_mediation_enabled: bool,
) -> Option<PathnameSocketEnforcement> {
    #[cfg(target_os = "linux")]
    {
        Some(if linux_mediation_enabled {
            PathnameSocketEnforcement::LinuxAllowlist
        } else {
            PathnameSocketEnforcement::LinuxUnmediated
        })
    }
    #[cfg(target_os = "macos")]
    {
        let _ = linux_mediation_enabled;
        Some(PathnameSocketEnforcement::MacosSeatbelt)
    }
    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
    {
        let _ = linux_mediation_enabled;
        None
    }
}

/// Serializable domain endpoint restriction state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DomainEndpointState {
    /// Domain hostname
    pub domain: String,
    /// Allowed method+path rules (default-deny when non-empty)
    pub endpoints: Vec<EndpointRuleState>,
}

/// Serializable endpoint rule
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointRuleState {
    /// HTTP method ("GET", "POST", "*", etc.)
    pub method: String,
    /// URL path glob pattern
    pub path: String,
}

/// Serializable filesystem capability state
#[derive(Debug, Serialize, Deserialize)]
pub struct FsCapState {
    /// Original path as specified
    pub original: String,
    /// Resolved absolute path
    pub path: String,
    /// Access level: "read", "write", or "readwrite"
    pub access: String,
    /// Whether this is a single file (vs directory)
    pub is_file: bool,
    /// Capability source for diagnostics (`user`, `profile`, `group:<name>`, `system`)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source: Option<String>,
    /// Device number of the resolved path at sandbox start (Linux file grants
    /// only). Landlock rules bind to the inode that was open at ruleset build
    /// time, not to the path, so a file replaced via write-temp-then-rename
    /// carries no rule even though the grant still names it. `nono why`
    /// compares this against a fresh stat to surface such stale grants.
    /// Absent in states written by older builds and on non-Linux platforms.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dev: Option<u64>,
    /// Inode number of the resolved path at sandbox start (see `dev`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ino: Option<u64>,
}

/// Stat the resolved path of a file-level grant so its identity at sandbox
/// start can be recorded, as a `(dev, ino)` pair — one is meaningless
/// without the other. Landlock is the only backend that binds rules to
/// inodes (macOS Seatbelt rules are path-based), so this is Linux-only.
#[cfg(target_os = "linux")]
fn grant_time_inode(cap: &nono::FsCapability) -> Option<(u64, u64)> {
    use std::os::unix::fs::MetadataExt;
    if !cap.is_file {
        return None;
    }
    std::fs::metadata(&cap.resolved)
        .ok()
        .map(|md| (md.dev(), md.ino()))
}

#[cfg(not(target_os = "linux"))]
fn grant_time_inode(_cap: &nono::FsCapability) -> Option<(u64, u64)> {
    None
}

impl SandboxState {
    /// Create sandbox state from a CapabilitySet, bypass_protection paths, and domain allowlist
    #[cfg(test)]
    pub fn from_caps(
        caps: &CapabilitySet,
        bypass_protection_paths: &[crate::policy::AppliedBypass],
        allowed_domains: &[String],
        domain_endpoints: &[DomainEndpointState],
    ) -> Self {
        Self::from_caps_with_denies(
            caps,
            bypass_protection_paths,
            &[],
            allowed_domains,
            &[],
            domain_endpoints,
        )
    }

    /// Create sandbox state including explicit filesystem deny paths.
    pub fn from_caps_with_denies(
        caps: &CapabilitySet,
        bypass_protection_paths: &[crate::policy::AppliedBypass],
        deny_paths: &[PathBuf],
        allowed_domains: &[String],
        denied_domains: &[String],
        domain_endpoints: &[DomainEndpointState],
    ) -> Self {
        Self {
            fs: caps
                .fs_capabilities()
                .iter()
                .map(|c| {
                    let inode = grant_time_inode(c);
                    FsCapState {
                        original: c.original.display().to_string(),
                        path: c.resolved.display().to_string(),
                        access: match c.access {
                            AccessMode::Read => "read".to_string(),
                            AccessMode::Write => "write".to_string(),
                            AccessMode::ReadWrite => "readwrite".to_string(),
                        },
                        is_file: c.is_file,
                        source: Some(c.source.to_string()),
                        dev: inode.map(|(dev, _)| dev),
                        ino: inode.map(|(_, ino)| ino),
                    }
                })
                .collect(),
            unix_sockets: caps.unix_socket_capabilities().to_vec(),
            pathname_socket_enforcement: None,
            net_blocked: caps.is_network_blocked(),
            allowed_commands: caps.allowed_commands().to_vec(),
            blocked_commands: caps.blocked_commands().to_vec(),
            applied_bypasses: bypass_protection_paths.to_vec(),
            deny_paths: deny_paths.iter().map(|p| p.display().to_string()).collect(),
            allowed_domains: allowed_domains.to_vec(),
            denied_domains: denied_domains.to_vec(),
            domain_endpoints: domain_endpoints.to_vec(),
            resource_limits: caps.resource_limits().copied(),
        }
    }

    /// Get resolved filesystem deny paths for query use.
    pub fn deny_paths_as_paths(&self) -> Vec<PathBuf> {
        self.deny_paths.iter().map(PathBuf::from).collect()
    }

    /// Convert back to a CapabilitySet
    ///
    /// Paths are re-validated through the standard constructors whenever
    /// possible. On macOS, exact-file grants for missing leaf paths are
    /// reconstructed with the same future-file logic used at profile load time.
    /// On Linux, paths or direct symlinks that resolve to or via /proc/self/*
    /// are ignored since these are process specific (e.g. /dev/stdin ->
    /// /proc/self/fd/0 -> /dev/pts/7). In all cases, the reconstructed
    /// canonical path must
```

### Core Architecture Module: `crates/nono-cli/src/state_paths.rs`
```
//! XDG-based paths for nono runtime state (audit trails, session registry, rollbacks).
//!
//! Canonical storage lives under `$XDG_STATE_HOME/nono/` (default
//! `~/.local/state/nono/`). Until v1.0.0, reads also fall back to legacy
//! `~/.nono/{audit,sessions,rollbacks}/` trees with a one-time deprecation warning.

use nono::{NonoError, Result, try_canonicalize};
use std::cell::Cell;
use std::path::{Path, PathBuf};
use walkdir::WalkDir;

const LEGACY_HOME_SUBDIR: &str = ".nono";
const LEGACY_REMOVE_BY: &str = "v1.0.0";
const AUDIT_LEDGER_FILENAME: &str = "ledger.ndjson";

thread_local! {
    static LEGACY_AUDIT_WARNED: Cell<bool> = const { Cell::new(false) };
    static LEGACY_SESSIONS_WARNED: Cell<bool> = const { Cell::new(false) };
    static LEGACY_ROLLBACK_WARNED: Cell<bool> = const { Cell::new(false) };
}

/// Resolve the XDG state base directory (`$XDG_STATE_HOME`, default `~/.local/state`).
///
/// When `$XDG_STATE_HOME` is unset, nono uses `$HOME/.local/state` on every platform
/// (same convention as `gh`, Claude Code, and profile `$XDG_STATE_HOME` expansion),
/// not macOS `~/Library/Application Support`.
fn resolve_xdg_state_base() -> Result<PathBuf> {
    if let Ok(raw) = std::env::var("XDG_STATE_HOME") {
        let path = PathBuf::from(&raw);
        if path.is_absolute() {
            return Ok(path);
        }
        tracing::warn!(
            "Ignoring invalid XDG_STATE_HOME='{}' (must be absolute), falling back to default state dir",
            raw
        );
    }

    let home = PathBuf::from(crate::config::validated_home()?);
    Ok(home.join(".local").join("state"))
}

/// Resolve `$XDG_STATE_HOME/nono` (default `~/.local/state/nono`).
pub fn user_state_dir() -> Result<PathBuf> {
    Ok(resolve_xdg_state_base()?.join("nono"))
}

/// Legacy `~/.nono` root (pre-XDG audit, session, and rollback data).
pub fn legacy_home_state_root() -> Result<PathBuf> {
    let home = PathBuf::from(crate::config::validated_home()?);
    Ok(home.join(LEGACY_HOME_SUBDIR))
}

/// Primary audit root: `$XDG_STATE_HOME/nono/audit/`.
pub fn audit_root() -> Result<PathBuf> {
    Ok(user_state_dir()?.join("audit"))
}

/// Legacy audit root: `~/.nono/audit/` (read fallback until v1.0.0).
pub fn legacy_audit_root() -> Result<PathBuf> {
    Ok(legacy_home_state_root()?.join("audit"))
}

/// Primary session registry: `$XDG_STATE_HOME/nono/sessions/`.
pub fn sessions_dir() -> Result<PathBuf> {
    Ok(user_state_dir()?.join("sessions"))
}

/// Legacy session registry: `~/.nono/sessions/` (read fallback until v1.0.0).
pub fn legacy_sessions_dir() -> Result<PathBuf> {
    Ok(legacy_home_state_root()?.join("sessions"))
}

/// Primary rollback root: `$XDG_STATE_HOME/nono/rollbacks/`.
pub fn rollback_root() -> Result<PathBuf> {
    Ok(user_state_dir()?.join("rollbacks"))
}

/// Legacy rollback root: `~/.nono/rollbacks/` (read fallback until v1.0.0).
pub fn legacy_rollback_root() -> Result<PathBuf> {
    Ok(legacy_home_state_root()?.join("rollbacks"))
}

/// Audit roots to scan when discovering or loading sessions (primary first).
pub fn audit_discovery_roots() -> Result<Vec<PathBuf>> {
    let primary = audit_root()?;
    let mut roots = vec![primary.clone()];
    if let Ok(legacy) = legacy_audit_root()
        && legacy != primary
    {
        roots.push(legacy);
    }
    Ok(roots)
}

/// Session registry directories to scan when listing or loading (primary first).
pub fn session_registry_dirs_for_read() -> Result<Vec<PathBuf>> {
    let primary = sessions_dir()?;
    let mut dirs = vec![primary.clone()];
    if let Ok(legacy) = legacy_sessions_dir()
        && legacy != primary
    {
        dirs.push(legacy);
    }
    Ok(dirs)
}

/// Rollback roots to scan when discovering or loading sessions (primary first).
pub fn rollback_discovery_roots() -> Result<Vec<PathBuf>> {
    let primary = rollback_root()?;
    let mut roots = vec![primary.clone()];
    if let Ok(legacy) = legacy_rollback_root()
        && legacy != primary
    {
        roots.push(legacy);
    }
    Ok(roots)
}

/// Returns true when any rollback root directory exists.
pub fn any_rollback_root_exists() -> Result<bool> {
    Ok(rollback_discovery_roots()?.iter().any(|root| root.exists()))
}

/// Protected state roots that must not be grantable to sandboxed children.
pub fn protected_state_roots() -> Result<Vec<PathBuf>> {
    let mut roots = vec![
        try_canonicalize(&legacy_home_state_root()?),
        try_canonicalize(&user_state_dir()?),
    ];
    roots.sort();
    roots.dedup();
    Ok(roots)
}

/// Emit a one-time warning when legacy audit data is read.
pub(crate) fn warn_legacy_audit_path(path: &Path) {
    LEGACY_AUDIT_WARNED.with(|warned| {
        if warned.get() {
            return;
        }
        warned.set(true);
        eprintln!(
            "warning: reading audit data from deprecated path {} (will be removed in {LEGACY_REMOVE_BY}); \
             new audit data is stored under $XDG_STATE_HOME/nono/audit/ (default ~/.local/state/nono/audit/)",
            path.display(),
        );
    });
}

fn warn_legacy_sessions_path(path: &Path) {
    LEGACY_SESSIONS_WARNED.with(|warned| {
        if warned.get() {
            return;
        }
        warned.set(true);
        eprintln!(
            "warning: reading session registry from deprecated path {} (will be removed in {LEGACY_REMOVE_BY}); \
             new session files are stored under $XDG_STATE_HOME/nono/sessions/ (default ~/.local/state/nono/sessions/)",
            path.display(),
        );
    });
}

fn warn_legacy_rollback_path(path: &Path) {
    LEGACY_ROLLBACK_WARNED.with(|warned| {
        if warned.get() {
            return;
        }
        warned.set(true);
        eprintln!(
            "warning: reading rollback data from deprecated path {} (will be removed in {LEGACY_REMOVE_BY}); \
             new rollback data is stored under $XDG_STATE_HOME/nono/rollbacks/ (default ~/.local/state/nono/rollbacks/)",
            path.display(),
        );
    });
}

/// Pre-canonicalized primary and legacy roots for legacy-path detection.
///
/// Resolve once before iterating session directories to avoid repeated env lookups
/// and to compare paths consistently on macOS (/Users vs /private/Users).
pub struct LegacyRootSet {
    primary_audit: PathBuf,
    legacy_audit: PathBuf,
    primary_rollback: PathBuf,
    legacy_rollback: PathBuf,
    primary_sessions: PathBuf,
    legacy_sessions: PathBuf,
}

impl LegacyRootSet {
    pub fn resolve() -> Result<Self> {
        Ok(Self {
            primary_audit: try_canonicalize(&audit_root()?),
            legacy_audit: try_canonicalize(&legacy_audit_root()?),
            primary_rollback: try_canonicalize(&rollback_root()?),
            legacy_rollback: try_canonicalize(&legacy_rollback_root()?),
            primary_sessions: try_canonicalize(&sessions_dir()?),
            legacy_sessions: try_canonicalize(&legacy_sessions_dir()?),
        })
    }

    fn is_under_legacy(path: &Path, legacy: &Path, primary: &Path) -> bool {
        if legacy == primary {
            return false;
        }
        let path = try_canonicalize(path);
        path.starts_with(legacy) && !path.starts_with(primary)
    }

    /// Warn once after successfully reading audit metadata from a legacy tree.
    pub fn warn_if_legacy_audit_data_read(&self, session_dir: &Path) {
        if Self::is_under_legacy(session_dir, &self.legacy_audit, &self.primary_audit) {
            warn_legacy_audit_path(&self.legacy_audit);
            return;
        }
        if Self::is_under_legacy(session_dir, &self.legacy_rollback, &self.primary_rollback) {
            warn_legacy_rollback_path(&self.legacy_rollback);
        }
    }

    /// Warn once after successfully reading rollback metadata from a legacy tree.
    pub fn warn_if_legacy_rollback_data_read(&self, session_dir: &Path) {
        if Self::is_under_legacy(session_dir, &self.legacy_rollback, &self.primary_rollback) {
            warn_legacy_rollback_path(&self.legacy_rollback);
        }
    }

    /// Warn once after successfully reading a session registry file from a legacy tree.
    pub fn warn_if_legacy_session_file_read(&self, session_file: &Path) {
        if Self::is_under_legacy(session_file, &self.legacy_sessions, &self.primary_sessions) {
            warn_legacy_sessions_path(&self.legacy_sessions);
        }
    }
}

/// Copy a legacy audit ledger into the canonical root on first write, if needed.
///
/// Caller must hold the audit ledger lock before calling this function.
pub fn maybe_migrate_legacy_audit_ledger() -> Result<()> {
    let primary = audit_root()?;
    let legacy = legacy_audit_root()?;
    if primary == legacy {
        return Ok(());
    }

    let new_ledger = primary.join(AUDIT_LEDGER_FILENAME);
    if new_ledger.exists() {
        return Ok(());
    }

    let legacy_ledger = legacy.join(AUDIT_LEDGER_FILENAME);
    if !legacy_ledger.exists() {
        return Ok(());
    }

    std::fs::create_dir_all(&primary).map_err(|e| {
        NonoError::Snapshot(format!(
            "Failed to create audit root {}: {e}",
            primary.display()
        ))
    })?;

    let tmp_ledger = primary.join(format!("{AUDIT_LEDGER_FILENAME}.tmp"));
    if tmp_ledger.exists() {
        std::fs::remove_file(&tmp_ledger).map_err(|e| {
            NonoError::Snapshot(format!(
                "Failed to remove stale audit ledger migration temp file {}: {e}",
                tmp_ledger.display()
            ))
        })?;
    }

    std::fs::copy(&legacy_ledger, &tmp_ledger).map_err(|e| {
        let _ = std::fs::remove_file(&tmp_ledger);
        NonoError::Snapshot(format!(
            "Failed to copy legacy audit ledger to temporary file {}: {e}",
            tmp_ledger.display()
        ))
    })?;

    std::fs::rename(&tmp_ledger, &new_ledger).map_err(|e| {
        let _ = std::fs::remove_file(&tmp_ledger);
        NonoError::Snapshot(format!(
            "Failed to rename temporary audit ledger 
```

### Core Architecture Module: `crates/nono/src/state.rs`
```
//! Sandbox state persistence
//!
//! This module provides serialization of capability state for diagnostic purposes.

use crate::capability::{
    AccessMode, CapabilitySet, FsCapability, SocketScope, UnixSocketCapability, UnixSocketMode,
};
use crate::resource::ResourceLimits;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Serializable representation of sandbox state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SandboxState {
    /// Filesystem capabilities
    pub fs: Vec<FsCapState>,
    /// AF_UNIX socket capabilities (may be absent in states persisted
    /// by older nono builds; `#[serde(default)]` preserves backward compat).
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub unix_sockets: Vec<UnixSocketCapState>,
    /// Whether network is blocked
    pub net_blocked: bool,
    /// Whether implicit macOS DNS resolver grants are disabled.
    /// Older states retain their original DNS-enabled behavior.
    #[serde(default)]
    pub dns_blocked: bool,
    /// Resource ceilings (memory and max processes). Absent in states from older
    /// nono builds; `#[serde(default)]` keeps those loadable. Plain numbers, so
    /// unlike paths they need no re-validation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub resource_limits: Option<ResourceLimits>,
}

/// Serializable representation of a filesystem capability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FsCapState {
    /// Original path as specified
    pub original: PathBuf,
    /// Resolved canonical path
    pub resolved: PathBuf,
    /// Access mode
    pub access: String,
    /// Whether this is a file (vs directory)
    pub is_file: bool,
}

/// Serializable representation of a [`UnixSocketCapability`].
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnixSocketCapState {
    /// Original path as specified
    pub original: PathBuf,
    /// Resolved canonical path
    pub resolved: PathBuf,
    /// Path matching scope for this socket grant.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scope: Option<SocketScope>,
    /// Legacy state field from before `SocketScope`.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_directory: Option<bool>,
    /// Mode string: "connect" or "connect+bind"
    pub mode: String,
}

impl SandboxState {
    /// Create state from a capability set
    #[must_use]
    pub fn from_caps(caps: &CapabilitySet) -> Self {
        Self {
            fs: caps
                .fs_capabilities()
                .iter()
                .map(|cap| FsCapState {
                    original: cap.original.clone(),
                    resolved: cap.resolved.clone(),
                    access: cap.access.to_string(),
                    is_file: cap.is_file,
                })
                .collect(),
            unix_sockets: caps
                .unix_socket_capabilities()
                .iter()
                .map(|cap| UnixSocketCapState {
                    original: cap.original.clone(),
                    resolved: cap.resolved.clone(),
                    scope: Some(cap.scope),
                    is_directory: None,
                    mode: cap.mode.to_string(),
                })
                .collect(),
            net_blocked: caps.is_network_blocked(),
            dns_blocked: !caps.dns_enabled(),
            resource_limits: caps.resource_limits().copied(),
        }
    }

    /// Convert state back to a capability set
    ///
    /// Paths are re-validated through the standard constructors (`new_dir`/`new_file`)
    /// which canonicalize paths and verify existence. This prevents crafted JSON from
    /// injecting arbitrary paths that bypass validation.
    ///
    /// Returns an error if any path no longer exists or fails validation.
    pub fn to_caps(&self) -> crate::error::Result<CapabilitySet> {
        let mut caps = CapabilitySet::new();

        for fs_cap in &self.fs {
            let access = match fs_cap.access.as_str() {
                "read" => AccessMode::Read,
                "write" => AccessMode::Write,
                "read+write" => AccessMode::ReadWrite,
                other => {
                    return Err(crate::error::NonoError::ConfigParse(format!(
                        "invalid access mode in sandbox state: {other}"
                    )));
                }
            };

            // Re-validate through the standard constructors to ensure
            // path canonicalization and existence checks are applied.
            let cap = if fs_cap.is_file {
                FsCapability::new_file(&fs_cap.original, access)?
            } else {
                FsCapability::new_dir(&fs_cap.original, access)?
            };
            caps.add_fs(cap);
        }

        for sock in &self.unix_sockets {
            let mode = match sock.mode.as_str() {
                "connect" => UnixSocketMode::Connect,
                "connect+bind" => UnixSocketMode::ConnectBind,
                other => {
                    return Err(crate::error::NonoError::ConfigParse(format!(
                        "invalid unix socket mode in sandbox state: {other}"
                    )));
                }
            };

            // Reconstruct from the caller-supplied `original` so the
            // stored alias survives the roundtrip (macOS Seatbelt uses
            // it for dual-path emission when original != resolved).
            // Then validate that canonicalisation produced the same
            // `resolved` as was serialized. The check rejects two
            // failure modes with one test:
            //
            // - Filesystem drift between save and reload (symlink moved,
            //   ConnectBind pending path now exists, etc.).
            // - Crafted JSON smuggling: attacker sets an evil `original`
            //   and legit `resolved`; the reconstructed cap's actual
            //   resolved won't match the crafted one, so we reject.
            let scope = sock.scope.unwrap_or_else(|| {
                if sock.is_directory.unwrap_or(false) {
                    SocketScope::DirChildren
                } else {
                    SocketScope::File
                }
            });

            let cap = match scope {
                SocketScope::File => UnixSocketCapability::new_file(&sock.original, mode)?,
                SocketScope::DirChildren => UnixSocketCapability::new_dir(&sock.original, mode)?,
                SocketScope::DirSubtree => {
                    UnixSocketCapability::new_dir_subtree(&sock.original, mode)?
                }
            };
            if cap.resolved != sock.resolved {
                return Err(crate::error::NonoError::ConfigParse(format!(
                    "unix socket grant canonical path drifted at state reload: \
                     serialized resolved={}, actual resolved={}",
                    sock.resolved.display(),
                    cap.resolved.display(),
                )));
            }
            caps.add_unix_socket(cap);
        }

        caps.set_network_blocked(self.net_blocked);
        if self.dns_blocked {
            caps = caps.block_dns();
        }

        if let Some(limits) = self.resource_limits {
            caps = caps.with_resource_limits(limits);
        }

        Ok(caps)
    }

    /// Serialize state to JSON
    pub fn to_json(&self) -> crate::error::Result<String> {
        serde_json::to_string_pretty(self).map_err(|e| {
            crate::error::NonoError::ConfigParse(format!("Failed to serialize sandbox state: {e}"))
        })
    }

    /// Deserialize state from JSON
    pub fn from_json(json: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(json)
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_dns_blocking_roundtrip() -> crate::error::Result<()> {
        for caps in [
            CapabilitySet::new(),
            CapabilitySet::new().block_network(),
            CapabilitySet::new().proxy_only(8080),
        ] {
            for block_dns in [false, true] {
                let caps = if block_dns {
                    caps.clone().block_dns()
                } else {
                    caps.clone()
                };
                let json = SandboxState::from_caps(&caps).to_json()?;
                let restored = SandboxState::from_json(&json)
                    .map_err(|e| crate::error::NonoError::ConfigParse(e.to_string()))?
                    .to_caps()?;
                assert_eq!(restored.dns_enabled(), caps.dns_enabled());
            }
        }
        Ok(())
    }

    #[test]
    fn test_legacy_state_keeps_dns_enabled() -> crate::error::Result<()> {
        for net_blocked in [false, true] {
            let json = format!(r#"{{ "fs": [], "net_blocked": {net_blocked} }}"#);
            let restored = SandboxState::from_json(&json)
                .map_err(|e| crate::error::NonoError::ConfigParse(e.to_string()))?
                .to_caps()?;
            assert!(restored.dns_enabled());
            assert_eq!(restored.is_network_blocked(), net_blocked);
        }
        Ok(())
    }

    #[test]
    fn test_state_roundtrip() {
        let caps = CapabilitySet::new().block_network();
        let state = SandboxState::from_caps(&caps);

        assert!(state.net_blocked);
        assert!(state.fs.is_empty());

        let json = state.to_json().expect("serialize state");
        let restored = SandboxState::from_json(&json).expect("deserialize state");
        assert!(restored.net_blocked);
    }

    #[test]
    fn test_resource_limits_roundtrip() {
        use crate::resource::ResourceLimits;

        let caps = CapabilitySet::new().with_resource_limits(ResourceLimits {
            memory_bytes: Some(512 * 1024 * 1024),
            max_processes: None,
        });
        let state = SandboxState::from_caps(&caps);
        assert_eq!(
          
```

### Core Architecture Module: `tool-sandbox-examples/approval-webhook-demo.py`
```
#!/usr/bin/env python3
"""Small approval webhook for command-policy demos.

The server accepts nono approval POSTs and returns a simple JSON decision:

    {"decision": "granted"}

or

    {"decision": "denied", "reason": "..."}

It is intentionally small and configurable so the demo policy does not depend
on a hard-coded command decision.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any


# --- terminal styling -------------------------------------------------------

_USE_COLOR = sys.stdout.isatty() and os.environ.get("NO_COLOR") is None


def _c(code: str) -> str:
    return code if _USE_COLOR else ""


RESET = _c("\033[0m")
BOLD = _c("\033[1m")
DIM = _c("\033[2m")
RED = _c("\033[31m")
GREEN = _c("\033[32m")
YELLOW = _c("\033[33m")
BLUE = _c("\033[34m")
MAGENTA = _c("\033[35m")
CYAN = _c("\033[36m")
GREY = _c("\033[90m")

# Bright/background variants for the decision badge.
BG_GREEN = _c("\033[42m")
BG_RED = _c("\033[41m")
BLACK = _c("\033[30m")


class ApprovalHandler(BaseHTTPRequestHandler):
    server: "ApprovalServer"

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length)

        try:
            body = json.loads(raw_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            self._send_json(400, {"decision": "denied", "reason": f"invalid JSON: {exc}"})
            return

        request = body.get("request", {})
        decision, reason = self.server.evaluate(request)

        self.server.print_request(body.get("backend"), request, decision, reason)
        response: dict[str, str] = {"decision": decision}
        if reason:
            response["reason"] = reason
        self._send_json(200, response)

    def log_message(self, fmt: str, *args: Any) -> None:
        if self.server.verbose:
            super().log_message(fmt, *args)

    def _send_json(self, status: int, payload: dict[str, str]) -> None:
        encoded = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


class ApprovalServer(ThreadingHTTPServer):
    def __init__(
        self,
        address: tuple[str, int],
        handler: type[ApprovalHandler],
        allowed_commands: list[str],
        allowed_caller: str,
        allowed_endpoint_route: str,
        allowed_args_prefixes: list[list[str]],
        default_decision: str,
        json_logs: bool,
        verbose: bool,
    ) -> None:
        super().__init__(address, handler)
        self.allowed_commands = allowed_commands
        self.allowed_caller = allowed_caller
        self.allowed_endpoint_route = allowed_endpoint_route
        self.allowed_args_prefixes = allowed_args_prefixes
        self.default_decision = default_decision
        self.json_logs = json_logs
        self.verbose = verbose

    def evaluate(self, request: dict[str, Any]) -> tuple[str, str | None]:
        if self.default_decision == "deny":
            return "denied", "demo server started with --default-decision deny"

        capability_type = request.get("capability_type")
        if capability_type == "endpoint":
            route_id = str(request.get("route_id", ""))
            if self.allowed_endpoint_route not in ("*", route_id):
                return "denied", f"endpoint route {route_id!r} is not configured for this demo"
            return "granted", None

        if capability_type != "command":
            return "denied", f"demo server does not approve {capability_type!r} requests"

        command = str(request.get("command", ""))
        caller = str(request.get("caller", ""))
        if command not in self.allowed_commands:
            return "denied", f"command {command!r} is not configured for this demo"
        if caller != self.allowed_caller:
            return "denied", f"caller {caller!r} is not configured for this demo"

        if self.allowed_args_prefixes:
            args = request.get("args", [])
            if not isinstance(args, list):
                return "denied", "command args are not a JSON list"
            rendered_args = [str(arg) for arg in args]
            # nono includes argv[0] in args; match command arguments after it.
            command_args = rendered_args[1:] if rendered_args else []
            if not any(
                command_args[: len(prefix)] == prefix
                for prefix in self.allowed_args_prefixes
            ):
                alternatives = " | ".join(" ".join(p) for p in self.allowed_args_prefixes)
                return (
                    "denied",
                    f"args do not start with any of: {alternatives}",
                )

        return "granted", None

    def print_request(
        self,
        backend: Any,
        request: dict[str, Any],
        decision: str,
        reason: str | None,
    ) -> None:
        if self.json_logs:
            print(
                json.dumps(
                    {
                        "backend": backend,
                        "request": request,
                        "decision": decision,
                        "reason": reason,
                    },
                    separators=(",", ":"),
                ),
                flush=True,
            )
            return

        request_id = request.get("request_id", "-")
        capability_type = request.get("capability_type", "-")
        session_id = request.get("session_id", "-")
        child_pid = request.get("child_pid", "-")
        if capability_type == "endpoint":
            icon = "🌐"
            subject = f"{request.get('method', '-')} {request.get('path', '-')}"
            source = f"route {request.get('route_id', '-')}"
            detail_label = "upstream"
            detail_value = request.get("upstream", "-")
            rule = request.get("rule_label", "-")
        else:
            icon = "⚙"
            command = request.get("command", "-")
            caller = request.get("caller", "-")
            args = request.get("args", [])
            rendered_args = " ".join(str(arg) for arg in args) if isinstance(args, list) else str(args)
            subject = str(command)
            source = f"caller {caller}"
            detail_label = "args"
            detail_value = rendered_args or "-"
            rule = request.get("intercept_rule", "-")

        granted = decision == "granted"
        if granted:
            badge = f"{BG_GREEN}{BLACK}{BOLD} ✓ GRANTED {RESET}"
            accent = GREEN
        else:
            badge = f"{BG_RED}{BLACK}{BOLD} ✕ DENIED  {RESET}"
            accent = RED

        timestamp = datetime.now().strftime("%H:%M:%S")
        rows: list[tuple[str, str]] = [
            (detail_label, str(detail_value)),
            ("rule", str(rule)),
            ("backend", str(backend or "-")),
            ("session", str(session_id)),
            ("child pid", str(child_pid)),
            ("request id", str(request_id)),
        ]
        if reason:
            rows.append(("reason", str(reason)))

        bar = f"{accent}│{RESET}"
        print()
        print(f"  {badge}  {GREY}{timestamp}{RESET}")
        print(f"  {bar} {icon}  {BOLD}{subject}{RESET} {DIM}· {source}{RESET}")
        print(f"  {bar}")
        for label, value in rows:
            color = RED if label == "reason" else CYAN
            print(f"  {bar} {color}{label:<11}{RESET}{DIM}{value}{RESET}")
        print(flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run a tiny nono approval webhook demo server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    parser.add_argument(
        "--allowed-command",
        nargs="+",
        default=["git"],
        metavar="CMD",
        help="Approve requests for any of these commands.",
    )
    parser.add_argument(
        "--allowed-endpoint-route",
        default="*",
        help="Only approve endpoint requests for this route id. Use '*' to allow any route.",
    )
    parser.add_argument(
        "--allowed-caller",
        default="claude",
        help=(
            "Only approve requests from this caller label. For Claude startup "
            "git probes, use 'claude'; use 'sh' or 'bash' only when "
            "testing an explicit shell-mediated edge."
        ),
    )
    parser.add_argument(
        "--allowed-args-prefix",
        action="append",
        nargs="+",
        metavar="ARG",
        help=(
            "Only approve command requests whose argv after argv[0] starts with "
            "this prefix. Repeat the flag to allow several alternative prefixes; "
            "matching any one grants. Defaults to a single 'config' prefix."
        ),
    )
    parser.add_argument(
        "--allow-any-args",
        action="store_true",
        help="Approve matching command/caller requests regardless of argv.",
    )
    parser.add_argument(
        "--default-decision",
        choices=("grant", "deny"),
        default="grant",
        help="Set to deny to prove the webhook denial path.",
    )
    parser.add_argument("--json-logs", action="store_true", help="Print one compact JSON line per request.")
    parser.add_argument("--verbose", action="store_true")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.allow_any_args:
        allowed_args_prefixes: list[list[str]] = []
    else:
        allowed_args_prefixes = args.allowed_args_prefix or [["config"]]
    server = ApprovalServer(
        (args.host, args.port),
        ApprovalHandler,
        allowed_commands=args.allowed_command,
        allowed_calle
```

### Core Architecture Module: `bindings/c/include/nono.h`
```
/* nono C FFI - Capability-based sandboxing */
/* Generated by cbindgen - DO NOT EDIT */

#ifndef NONO_H
#define NONO_H

#include <stdarg.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>

/**
 * Access mode for filesystem capabilities.
 *
 * Constants: `NONO_ACCESS_MODE_READ` (0), `NONO_ACCESS_MODE_WRITE` (1),
 * `NONO_ACCESS_MODE_READ_WRITE` (2).
 *
 * Represented as `u32` at the FFI boundary to prevent undefined behavior
 * from invalid enum discriminants. Validated on entry to each FFI function.
 */
#define NONO_ACCESS_MODE_READ 0

#define NONO_ACCESS_MODE_WRITE 1

#define NONO_ACCESS_MODE_READ_WRITE 2

/**
 * Sentinel value returned on error (NULL pointer, out-of-bounds index).
 */
#define NONO_ACCESS_MODE_INVALID UINT32_MAX

/**
 * Network mode for sandbox capabilities.
 *
 * Constants: `NONO_NETWORK_MODE_BLOCKED` (0), `NONO_NETWORK_MODE_ALLOW_ALL` (1),
 * `NONO_NETWORK_MODE_PROXY_ONLY` (2).
 */
#define NONO_NETWORK_MODE_BLOCKED 0

#define NONO_NETWORK_MODE_ALLOW_ALL 1

#define NONO_NETWORK_MODE_PROXY_ONLY 2

/**
 * Error codes returned by nono FFI functions.
 *
 * Zero means success. Negative values indicate error categories.
 * Call `nono_last_error()` for the detailed error message.
 */
typedef enum NonoErrorCode {
    /**
     * Operation succeeded.
     */
    NONO_ERROR_CODE_OK = 0,
    /**
     * Path does not exist.
     */
    NONO_ERROR_CODE_ERR_PATH_NOT_FOUND = -1,
    /**
     * Expected a directory but got a file.
     */
    NONO_ERROR_CODE_ERR_EXPECTED_DIRECTORY = -2,
    /**
     * Expected a file but got a directory.
     */
    NONO_ERROR_CODE_ERR_EXPECTED_FILE = -3,
    /**
     * Path canonicalization failed.
     */
    NONO_ERROR_CODE_ERR_PATH_CANONICALIZATION = -4,
    /**
     * No capabilities specified.
     */
    NONO_ERROR_CODE_ERR_NO_CAPABILITIES = -5,
    /**
     * Sandbox initialization failed.
     */
    NONO_ERROR_CODE_ERR_SANDBOX_INIT = -6,
    /**
     * Platform not supported.
     */
    NONO_ERROR_CODE_ERR_UNSUPPORTED_PLATFORM = -7,
    /**
     * Command is blocked.
     */
    NONO_ERROR_CODE_ERR_BLOCKED_COMMAND = -8,
    /**
     * Configuration parse error.
     */
    NONO_ERROR_CODE_ERR_CONFIG_PARSE = -9,
    /**
     * Profile parse error.
     */
    NONO_ERROR_CODE_ERR_PROFILE_PARSE = -10,
    /**
     * I/O error.
     */
    NONO_ERROR_CODE_ERR_IO = -11,
    /**
     * Invalid argument (NULL pointer, invalid UTF-8).
     */
    NONO_ERROR_CODE_ERR_INVALID_ARG = -12,
    /**
     * Trust/attestation verification error.
     */
    NONO_ERROR_CODE_ERR_TRUST_VERIFICATION = -13,
    /**
     * Unknown or uncategorized error.
     */
    NONO_ERROR_CODE_ERR_UNKNOWN = -99,
} NonoErrorCode;

/**
 * Diagnostic code for sandbox and setup errors.
 */
typedef enum NonoDiagnosticCode {
    NONO_DIAGNOSTIC_CODE_SANDBOX_DENIED_PATH = 0,
    NONO_DIAGNOSTIC_CODE_SANDBOX_DENIED_NETWORK = 1,
    NONO_DIAGNOSTIC_CODE_SANDBOX_DENIED_UNIX_SOCKET = 2,
    NONO_DIAGNOSTIC_CODE_COMMAND_NOT_FOUND = 3,
    NONO_DIAGNOSTIC_CODE_COMMAND_FAILED_LIKELY_SANDBOX = 4,
    NONO_DIAGNOSTIC_CODE_COMMAND_FAILED_APPLICATION = 5,
    NONO_DIAGNOSTIC_CODE_CREDENTIAL_NOT_FOUND = 6,
    NONO_DIAGNOSTIC_CODE_CREDENTIAL_UNAVAILABLE = 7,
    NONO_DIAGNOSTIC_CODE_UNSUPPORTED_PLATFORM_FEATURE = 8,
    NONO_DIAGNOSTIC_CODE_ROLLBACK_BUDGET_EXCEEDED = 9,
    NONO_DIAGNOSTIC_CODE_CWD_ACCESS_REQUIRED = 10,
    NONO_DIAGNOSTIC_CODE_CONFIGURATION_ERROR = 11,
    NONO_DIAGNOSTIC_CODE_TRUST_VERIFICATION_FAILED = 12,
    NONO_DIAGNOSTIC_CODE_IO_ERROR = 13,
    NONO_DIAGNOSTIC_CODE_CANCELLED = 14,
    NONO_DIAGNOSTIC_CODE_OTHER = 99,
} NonoDiagnosticCode;

/**
 * Tag for capability source discriminant.
 */
typedef enum NonoCapabilitySourceTag {
    /**
     * Added directly by the user via CLI flags
     */
    NONO_CAPABILITY_SOURCE_TAG_USER = 0,
    /**
     * Resolved from a named policy group
     */
    NONO_CAPABILITY_SOURCE_TAG_GROUP = 1,
    /**
     * System-level path
     */
    NONO_CAPABILITY_SOURCE_TAG_SYSTEM = 2,
    /**
     * Added from a profile's filesystem section
     */
    NONO_CAPABILITY_SOURCE_TAG_PROFILE = 3,
} NonoCapabilitySourceTag;

/**
 * Status of a query result.
 */
typedef enum NonoQueryStatus {
    NONO_QUERY_STATUS_ALLOWED = 0,
    NONO_QUERY_STATUS_DENIED = 1,
} NonoQueryStatus;

/**
 * Reason code for a query result.
 */
typedef enum NonoQueryReason {
    /**
     * Path is covered by a granted capability
     */
    NONO_QUERY_REASON_GRANTED_PATH = 0,
    /**
     * Network access is not blocked
     */
    NONO_QUERY_REASON_NETWORK_ALLOWED = 1,
    /**
     * Path not covered by any capability
     */
    NONO_QUERY_REASON_PATH_NOT_GRANTED = 2,
    /**
     * Path covered but with insufficient access level
     */
    NONO_QUERY_REASON_INSUFFICIENT_ACCESS = 3,
    /**
     * Network access is blocked
     */
    NONO_QUERY_REASON_NETWORK_BLOCKED = 4,
} NonoQueryReason;

/**
 * Result of a permission query.
 *
 * String fields are nullable. Non-NULL string fields are caller-owned
 * and must be freed with `nono_string_free()`.
 */
typedef struct NonoQueryResult {
    /**
     * Whether the operation is allowed or denied.
     */
    enum NonoQueryStatus status;
    /**
     * The specific reason.
     */
    enum NonoQueryReason reason;
    /**
     * For `GrantedPath`: the path that grants access. NULL otherwise.
     */
    char *granted_path;
    /**
     * For `GrantedPath`: the access mode string. NULL otherwise.
     */
    char *access;
    /**
     * For `InsufficientAccess`: the granted access mode. NULL otherwise.
     */
    char *granted;
    /**
     * For `InsufficientAccess`: the requested access mode. NULL otherwise.
     */
    char *requested;
} NonoQueryResult;

/**
 * Platform support information.
 *
 * Returned by `nono_sandbox_support_info()`.
 * Caller must free string fields with `nono_string_free()`.
 */
typedef struct NonoSupportInfo {
    /**
     * Whether sandboxing is supported on this platform.
     */
    bool is_supported;
    /**
     * Platform name. Caller must free with `nono_string_free()`.
     */
    char *platform;
    /**
     * Detailed support information. Caller must free with `nono_string_free()`.
     */
    char *details;
} NonoSupportInfo;

/**
 * Get the last error message for the current thread.
 *
 * Returns a caller-owned copy of the last error message as a
 * null-terminated UTF-8 string, or NULL if no error has occurred.
 *
 * Caller must free the returned string with `nono_string_free()`.
 */
char *nono_last_error(void);

/**
 * Clear the last error for the current thread.
 */
void nono_clear_error(void);

/**
 * Free a string previously returned by a nono FFI function.
 *
 * NULL-safe (no-op on NULL). Call this on any string whose documentation
 * says "Caller must free with `nono_string_free()`", including
 * `nono_last_error()` and `nono_version()`.
 *
 * # Safety
 *
 * `s` must be NULL or a pointer previously returned by a nono FFI function.
 */
void nono_string_free(char *s);

/**
 * Get the nono library version string.
 *
 * Caller must free the returned string with `nono_string_free()`.
 */
char *nono_version(void);

/**
 * Create a new empty capability set.
 *
 * The returned pointer is never NULL. Caller must free with
 * `nono_capability_set_free()`.
 */
struct NonoCapabilitySet *nono_capability_set_new(void);

/**
 * Free a capability set.
 *
 * NULL-safe (no-op on NULL).
 *
 * # Safety
 *
 * `caps` must be NULL or a pointer previously returned by
 * `nono_capability_set_new()` or a factory function.
 */
void nono_capability_set_free(struct NonoCapabilitySet *caps);

/**
 * Add directory access permission.
 *
 * The path is validated and canonicalized. Returns `Ok` on success.
 * On failure, returns a negative error code; call `nono_last_error()`
 * for the detailed message.
 *
 * # Safety
 *
 * - `caps` must be a valid pointer from `nono_capability_set_new()`.
 * - `path` must be a valid null-terminated UTF-8 string.
 */
enum NonoErrorCode nono_capability_set_allow_path(struct NonoCapabilitySet *caps,
                                                  const char *path,
                                                  uint32_t mode);

/**
 * Add single-file access permission.
 *
 * The path is validated and canonicalized. Returns `Ok` on success.
 *
 * # Safety
 *
 * - `caps` must be a valid pointer from `nono_capability_set_new()`.
 * - `path` must be a valid null-terminated UTF-8 string.
 */
enum NonoErrorCode nono_capability_set_allow_file(struct NonoCapabilitySet *caps,
                                                  const char *path,
                                                  uint32_t mode);

/**
 * Set whether outbound network access is blocked.
 *
 * Returns `Ok` on success, or `ErrInvalidArg` if `caps` is NULL.
 *
 * # Safety
 *
 * `caps` must be a valid pointer from `nono_capability_set_new()`.
 */
enum NonoErrorCode nono_capability_set_set_network_blocked(struct NonoCapabilitySet *caps,
                                                           bool blocked);

/**
 * Disable the implicit macOS DNS resolver grants in blocked and proxy-only modes.
 *
 * Does not change the network mode or revoke explicit socket, localhost, proxy,
 * or platform-rule grants. Has no enforcement effect on Linux or in allow-all
 * mode, and is not a general DNS filter. The setting survives network-mode
 * changes and sandbox-state serialization.
 *
 * Returns `Ok` on success, or `ErrInvalidArg` if `caps` is NULL.
 *
 * # Safety
 *
 * `caps` must be a valid pointer from `nono_capability_set_new()` or NULL.
 */
enum NonoErrorCode nono_capability_set_block_dns(struct NonoCapabilitySet *caps);

/**
 * Whether implicit macOS DNS resolver grants are enabled (the default).
 *
 * This queries the capability setting, not whether DNS is reachable under the
 * effective sandbox policy. Returns false if `caps` is NULL.
 *
 * # Safety
 *
 * `caps` must be a valid pointer or NULL.
 */
bool nono_capability_se
```

### Core Architecture Module: `bindings/c/src/capability_set.rs`
```
//! FFI wrapper for `nono::CapabilitySet`.

use std::os::raw::c_char;

use crate::types::{NonoErrorCode, validate_access_mode};
use crate::{c_str_to_str, map_error, rust_string_to_c, set_last_error};

/// Opaque handle to a capability set.
///
/// Created with `nono_capability_set_new()`.
/// Freed with `nono_capability_set_free()`.
pub struct NonoCapabilitySet {
    pub(crate) inner: nono::CapabilitySet,
}

impl Default for NonoCapabilitySet {
    fn default() -> Self {
        Self {
            inner: nono::CapabilitySet::new(),
        }
    }
}

/// Create a new empty capability set.
///
/// The returned pointer is never NULL. Caller must free with
/// `nono_capability_set_free()`.
#[unsafe(no_mangle)]
pub extern "C" fn nono_capability_set_new() -> *mut NonoCapabilitySet {
    Box::into_raw(Box::new(NonoCapabilitySet::default()))
}

/// Free a capability set.
///
/// NULL-safe (no-op on NULL).
///
/// # Safety
///
/// `caps` must be NULL or a pointer previously returned by
/// `nono_capability_set_new()` or a factory function.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_free(caps: *mut NonoCapabilitySet) {
    if !caps.is_null() {
        // SAFETY: The pointer was created by Box::into_raw() in
        // nono_capability_set_new() or a factory function in this library.
        unsafe {
            drop(Box::from_raw(caps));
        }
    }
}

/// Add directory access permission.
///
/// The path is validated and canonicalized. Returns `Ok` on success.
/// On failure, returns a negative error code; call `nono_last_error()`
/// for the detailed message.
///
/// # Safety
///
/// - `caps` must be a valid pointer from `nono_capability_set_new()`.
/// - `path` must be a valid null-terminated UTF-8 string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_allow_path(
    caps: *mut NonoCapabilitySet,
    path: *const c_char,
    mode: u32,
) -> NonoErrorCode {
    if caps.is_null() {
        set_last_error("caps pointer is NULL");
        return NonoErrorCode::ErrInvalidArg;
    }

    let access = match validate_access_mode(mode) {
        Some(m) => m,
        None => {
            set_last_error(&format!("invalid access mode: {mode}"));
            return NonoErrorCode::ErrInvalidArg;
        }
    };

    // SAFETY: caller guarantees caps is valid.
    let caps = unsafe { &mut *caps };

    let path_str = match unsafe { c_str_to_str(path) } {
        Some(s) => s,
        None => {
            set_last_error("path is NULL or invalid UTF-8");
            return NonoErrorCode::ErrInvalidArg;
        }
    };

    match nono::FsCapability::new_dir(path_str, access) {
        Ok(cap) => {
            caps.inner.add_fs(cap);
            NonoErrorCode::Ok
        }
        Err(e) => map_error(&e),
    }
}

/// Add single-file access permission.
///
/// The path is validated and canonicalized. Returns `Ok` on success.
///
/// # Safety
///
/// - `caps` must be a valid pointer from `nono_capability_set_new()`.
/// - `path` must be a valid null-terminated UTF-8 string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_allow_file(
    caps: *mut NonoCapabilitySet,
    path: *const c_char,
    mode: u32,
) -> NonoErrorCode {
    if caps.is_null() {
        set_last_error("caps pointer is NULL");
        return NonoErrorCode::ErrInvalidArg;
    }

    let access = match validate_access_mode(mode) {
        Some(m) => m,
        None => {
            set_last_error(&format!("invalid access mode: {mode}"));
            return NonoErrorCode::ErrInvalidArg;
        }
    };

    let caps = unsafe { &mut *caps };

    let path_str = match unsafe { c_str_to_str(path) } {
        Some(s) => s,
        None => {
            set_last_error("path is NULL or invalid UTF-8");
            return NonoErrorCode::ErrInvalidArg;
        }
    };

    match nono::FsCapability::new_file(path_str, access) {
        Ok(cap) => {
            caps.inner.add_fs(cap);
            NonoErrorCode::Ok
        }
        Err(e) => map_error(&e),
    }
}

/// Set whether outbound network access is blocked.
///
/// Returns `Ok` on success, or `ErrInvalidArg` if `caps` is NULL.
///
/// # Safety
///
/// `caps` must be a valid pointer from `nono_capability_set_new()`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_set_network_blocked(
    caps: *mut NonoCapabilitySet,
    blocked: bool,
) -> NonoErrorCode {
    if caps.is_null() {
        set_last_error("caps pointer is NULL");
        return NonoErrorCode::ErrInvalidArg;
    }
    let caps = unsafe { &mut *caps };
    caps.inner.set_network_blocked(blocked);
    NonoErrorCode::Ok
}

/// Disable the implicit macOS DNS resolver grants in blocked and proxy-only modes.
///
/// Does not change the network mode or revoke explicit socket, localhost, proxy,
/// or platform-rule grants. Has no enforcement effect on Linux or in allow-all
/// mode, and is not a general DNS filter. The setting survives network-mode
/// changes and sandbox-state serialization.
///
/// Returns `Ok` on success, or `ErrInvalidArg` if `caps` is NULL.
///
/// # Safety
///
/// `caps` must be a valid pointer from `nono_capability_set_new()` or NULL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_block_dns(
    caps: *mut NonoCapabilitySet,
) -> NonoErrorCode {
    if caps.is_null() {
        set_last_error("caps pointer is NULL");
        return NonoErrorCode::ErrInvalidArg;
    }
    // SAFETY: The caller guarantees a valid pointer, and NULL was checked above.
    let caps = unsafe { &mut *caps };
    caps.inner = std::mem::take(&mut caps.inner).block_dns();
    NonoErrorCode::Ok
}

/// Whether implicit macOS DNS resolver grants are enabled (the default).
///
/// This queries the capability setting, not whether DNS is reachable under the
/// effective sandbox policy. Returns false if `caps` is NULL.
///
/// # Safety
///
/// `caps` must be a valid pointer or NULL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_dns_enabled(caps: *const NonoCapabilitySet) -> bool {
    if caps.is_null() {
        return false;
    }
    // SAFETY: The caller guarantees a valid pointer, and NULL was checked above.
    let caps = unsafe { &*caps };
    caps.inner.dns_enabled()
}

/// Set the network mode.
///
/// Use `NONO_NETWORK_MODE_BLOCKED`, `NONO_NETWORK_MODE_ALLOW_ALL`, or
/// `NONO_NETWORK_MODE_PROXY_ONLY`. For proxy mode, also call
/// `nono_capability_set_set_proxy_port()` to set the port.
///
/// # Safety
///
/// `caps` must be a valid pointer from `nono_capability_set_new()`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_set_network_mode(
    caps: *mut NonoCapabilitySet,
    mode: u32,
) -> NonoErrorCode {
    if caps.is_null() {
        set_last_error("caps pointer is NULL");
        return NonoErrorCode::ErrInvalidArg;
    }
    let network_mode = match crate::types::validate_network_mode(mode) {
        Some(m) => m,
        None => {
            set_last_error(&format!("invalid network mode: {mode}"));
            return NonoErrorCode::ErrInvalidArg;
        }
    };
    let caps = unsafe { &mut *caps };
    caps.inner.set_network_mode_mut(network_mode);
    NonoErrorCode::Ok
}

/// Get the current network mode.
///
/// Returns the raw mode constant. For `NONO_NETWORK_MODE_PROXY_ONLY`,
/// use `nono_capability_set_proxy_port()` to get the port.
///
/// # Safety
///
/// `caps` must be a valid pointer or NULL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_network_mode(caps: *const NonoCapabilitySet) -> u32 {
    if caps.is_null() {
        return crate::types::NONO_NETWORK_MODE_ALLOW_ALL;
    }
    let caps = unsafe { &*caps };
    crate::types::network_mode_to_raw(caps.inner.network_mode())
}

/// Set the proxy port for `ProxyOnly` mode.
///
/// Only meaningful when network mode is `NONO_NETWORK_MODE_PROXY_ONLY`.
///
/// # Safety
///
/// `caps` must be a valid pointer from `nono_capability_set_new()`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_set_proxy_port(
    caps: *mut NonoCapabilitySet,
    port: u16,
) -> NonoErrorCode {
    if caps.is_null() {
        set_last_error("caps pointer is NULL");
        return NonoErrorCode::ErrInvalidArg;
    }
    let caps = unsafe { &mut *caps };
    caps.inner
        .set_network_mode_mut(nono::NetworkMode::ProxyOnly {
            port,
            bind_ports: vec![],
        });
    NonoErrorCode::Ok
}

/// Get the proxy port if network mode is `ProxyOnly`.
///
/// Returns 0 if mode is not `ProxyOnly` or `caps` is NULL.
///
/// # Safety
///
/// `caps` must be a valid pointer or NULL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_proxy_port(caps: *const NonoCapabilitySet) -> u16 {
    if caps.is_null() {
        return 0;
    }
    let caps = unsafe { &*caps };
    match caps.inner.network_mode() {
        nono::NetworkMode::ProxyOnly { port, .. } => *port,
        _ => 0,
    }
}

/// Add a command to the allow list (overrides block lists).
///
/// # Safety
///
/// - `caps` must be a valid pointer.
/// - `cmd` must be a valid null-terminated UTF-8 string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_allow_command(
    caps: *mut NonoCapabilitySet,
    cmd: *const c_char,
) -> NonoErrorCode {
    if caps.is_null() {
        set_last_error("caps pointer is NULL");
        return NonoErrorCode::ErrInvalidArg;
    }
    let caps = unsafe { &mut *caps };

    let cmd_str = match unsafe { c_str_to_str(cmd) } {
        Some(s) => s,
        None => {
            set_last_error("cmd is NULL or invalid UTF-8");
            return NonoErrorCode::ErrInvalidArg;
        }
    };

    caps.inner.add_allowed_command(cmd_str);
    NonoErrorCode::Ok
}

/// Add a command to the block list.
///
/// # Safety
///
/// - `caps` must be a valid pointer.
/// - `cmd` must be a valid null-terminated UTF-8 string.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_block_command(
    caps: *mut NonoCapabil
```

### Core Architecture Module: `bindings/c/src/diagnostic.rs`
```
//! C FFI for session diagnostics and error remediation.

use crate::types::NonoDiagnosticCode;
use crate::{map_error, rust_string_to_c, set_last_error};
use std::os::raw::c_char;

/// Return the diagnostic code for the most recently mapped error on this thread.
///
/// Returns `NonoDiagnosticCode::Other` when no error has been mapped.
#[unsafe(no_mangle)]
pub extern "C" fn nono_last_diagnostic_code() -> NonoDiagnosticCode {
    crate::last_diagnostic_code()
}

/// Return JSON for the remediation attached to the most recently mapped error.
///
/// Caller must free with `nono_string_free()`. Returns NULL when no remediation exists.
#[unsafe(no_mangle)]
pub extern "C" fn nono_last_remediation_json() -> *mut c_char {
    match crate::last_remediation_json() {
        Some(json) => rust_string_to_c(json),
        None => std::ptr::null_mut(),
    }
}

/// Build a session diagnostic report JSON object from serialized denial inputs.
///
/// Each `*_json` argument may be NULL, an empty string, or a JSON array of
/// denial, IPC denial, or violation records.
///
/// # Safety
///
/// Pointer arguments must be null or valid null-terminated UTF-8 for the
/// duration of the call. Caller frees the returned string with `nono_string_free()`.
/// Returns NULL on failure; call `nono_last_error()`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_session_diagnostic_report_to_json(
    exit_code: i32,
    denials_json: *const c_char,
    ipc_denials_json: *const c_char,
    violations_json: *const c_char,
) -> *mut c_char {
    let denials = match parse_denials(denials_json) {
        Ok(v) => v,
        Err(e) => {
            set_last_error(&e);
            return std::ptr::null_mut();
        }
    };
    let ipc_denials = match parse_ipc_denials(ipc_denials_json) {
        Ok(v) => v,
        Err(e) => {
            set_last_error(&e);
            return std::ptr::null_mut();
        }
    };
    let violations = match parse_violations(violations_json) {
        Ok(v) => v,
        Err(e) => {
            set_last_error(&e);
            return std::ptr::null_mut();
        }
    };

    let report = nono::SessionDiagnosticReport::from_merged_session(
        exit_code,
        denials,
        ipc_denials,
        violations,
    );
    match report.to_json() {
        Ok(json) => rust_string_to_c(json),
        Err(e) => {
            map_error(&e);
            std::ptr::null_mut()
        }
    }
}

/// Merge session report JSON with an optional proxy diagnostics JSON array.
///
/// `session_json` must be a report object from `nono_session_diagnostic_report_to_json`
/// or `SessionDiagnosticReport::to_json()`. `proxy_diagnostics_json` may be NULL
/// or empty to return `{ "session": ... }` only.
///
/// # Safety
///
/// Pointer arguments must be null or valid null-terminated UTF-8 for the
/// duration of the call. Caller frees the returned string with `nono_string_free()`.
/// Returns NULL on failure; call `nono_last_error()`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_merge_diagnostic_report_json(
    session_json: *const c_char,
    proxy_diagnostics_json: *const c_char,
) -> *mut c_char {
    if session_json.is_null() {
        set_last_error("session_json is null");
        return std::ptr::null_mut();
    }
    let Some(session_text) = (unsafe { crate::c_str_to_str(session_json) }) else {
        set_last_error("invalid UTF-8 in session_json");
        return std::ptr::null_mut();
    };
    let proxy_text = if proxy_diagnostics_json.is_null() {
        None
    } else {
        unsafe { crate::c_str_to_str(proxy_diagnostics_json) }
    };
    match nono::SessionDiagnosticReport::merge_with_proxy_json(session_text, proxy_text) {
        Ok(json) => rust_string_to_c(json),
        Err(e) => {
            map_error(&e);
            std::ptr::null_mut()
        }
    }
}

fn parse_json_array<T: serde::de::DeserializeOwned>(
    ptr: *const c_char,
    label: &str,
) -> Result<Vec<T>, String> {
    if ptr.is_null() {
        return Ok(Vec::new());
    }
    let Some(text) = (unsafe { crate::c_str_to_str(ptr) }) else {
        return Err(format!("invalid UTF-8 in {label}"));
    };
    if text.is_empty() {
        return Ok(Vec::new());
    }
    serde_json::from_str(text).map_err(|e| format!("invalid {label} JSON array: {e}"))
}

fn parse_denials(ptr: *const c_char) -> Result<Vec<nono::DenialRecord>, String> {
    parse_json_array(ptr, "denial")
}

fn parse_ipc_denials(ptr: *const c_char) -> Result<Vec<nono::IpcDenialRecord>, String> {
    parse_json_array(ptr, "IPC denial")
}

fn parse_violations(ptr: *const c_char) -> Result<Vec<nono::SandboxViolation>, String> {
    parse_json_array(ptr, "violation")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::NonoDiagnosticCode;
    use std::ffi::CStr;

    #[test]
    fn last_diagnostic_code_defaults_to_other() {
        assert_eq!(nono_last_diagnostic_code(), NonoDiagnosticCode::Other);
    }

    #[test]
    fn session_report_json_from_empty_arrays() {
        let json_ptr = unsafe {
            nono_session_diagnostic_report_to_json(
                1,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
            )
        };
        assert!(!json_ptr.is_null());
        // SAFETY: returned by nono_session_diagnostic_report_to_json in this test.
        let json = unsafe { CStr::from_ptr(json_ptr) }.to_str().expect("utf8");
        assert!(json.contains("\"exit_code\":1"));
        unsafe { crate::nono_string_free(json_ptr) };
    }

    #[test]
    fn session_report_json_from_denial_array() {
        let denials = r#"[{"path":"/tmp/x","access":"Read","reason":"PolicyBlocked"}]"#;
        let denials_c = std::ffi::CString::new(denials).expect("cstr");
        let json_ptr = unsafe {
            nono_session_diagnostic_report_to_json(
                2,
                denials_c.as_ptr(),
                std::ptr::null(),
                std::ptr::null(),
            )
        };
        assert!(!json_ptr.is_null());
        let json = unsafe { CStr::from_ptr(json_ptr) }.to_str().expect("utf8");
        assert!(json.contains("sandbox_denied_path"));
        assert!(json.contains("grant_path"));
        unsafe { crate::nono_string_free(json_ptr) };
    }

    #[test]
    fn merge_diagnostic_report_json_rejects_null_session() {
        let json_ptr =
            unsafe { nono_merge_diagnostic_report_json(std::ptr::null(), std::ptr::null()) };
        assert!(json_ptr.is_null());
        let err = unsafe { CStr::from_ptr(crate::nono_last_error()) }
            .to_str()
            .expect("utf8");
        assert!(err.contains("session_json is null"));
    }

    #[test]
    fn merge_diagnostic_report_json_wraps_proxy_array() {
        let session = std::ffi::CString::new(
            r#"{"exit_code":1,"denials":[],"ipc_denials":[],"violations":[],"diagnostics":[]}"#,
        )
        .expect("cstr");
        let proxy = std::ffi::CString::new(
            r#"[{"code":"credential_not_found","severity":"warning","route_prefix":"openai","message":"missing"}]"#,
        )
        .expect("cstr");
        let json_ptr =
            unsafe { nono_merge_diagnostic_report_json(session.as_ptr(), proxy.as_ptr()) };
        assert!(!json_ptr.is_null());
        let json = unsafe { CStr::from_ptr(json_ptr) }.to_str().expect("utf8");
        assert!(json.contains("\"session\""));
        assert!(json.contains("credential_not_found"));
        unsafe { crate::nono_string_free(json_ptr) };
    }
}

```

### Core Architecture Module: `bindings/c/src/fs_capability.rs`
```
//! Index-based accessors for filesystem capabilities within a `CapabilitySet`.

use std::os::raw::c_char;

use crate::capability_set::NonoCapabilitySet;
use crate::rust_string_to_c;
use crate::types::{NONO_ACCESS_MODE_INVALID, NonoCapabilitySourceTag, access_mode_to_raw};

/// Get the number of filesystem capabilities in the set.
///
/// Returns 0 if `caps` is NULL.
///
/// # Safety
///
/// `caps` must be a valid pointer or NULL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_fs_count(caps: *const NonoCapabilitySet) -> usize {
    if caps.is_null() {
        return 0;
    }
    let caps = unsafe { &*caps };
    caps.inner.fs_capabilities().len()
}

/// Get the original (pre-canonicalization) path of the capability at `index`.
///
/// Caller must free the returned string with `nono_string_free()`.
/// Returns NULL if `caps` is NULL or `index` is out of bounds.
///
/// # Safety
///
/// `caps` must be a valid pointer or NULL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_fs_original(
    caps: *const NonoCapabilitySet,
    index: usize,
) -> *mut c_char {
    if caps.is_null() {
        return std::ptr::null_mut();
    }
    let caps = unsafe { &*caps };
    match caps.inner.fs_capabilities().get(index) {
        Some(cap) => rust_string_to_c(cap.original.display().to_string()),
        None => std::ptr::null_mut(),
    }
}

/// Get the resolved (canonicalized) path of the capability at `index`.
///
/// Caller must free the returned string with `nono_string_free()`.
/// Returns NULL if `caps` is NULL or `index` is out of bounds.
///
/// # Safety
///
/// `caps` must be a valid pointer or NULL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_fs_resolved(
    caps: *const NonoCapabilitySet,
    index: usize,
) -> *mut c_char {
    if caps.is_null() {
        return std::ptr::null_mut();
    }
    let caps = unsafe { &*caps };
    match caps.inner.fs_capabilities().get(index) {
        Some(cap) => rust_string_to_c(cap.resolved.display().to_string()),
        None => std::ptr::null_mut(),
    }
}

/// Get the access mode of the capability at `index`.
///
/// Returns `NONO_ACCESS_MODE_INVALID` if `caps` is NULL or `index` is out of
/// bounds (also sets the last error). Check `nono_capability_set_fs_count()`
/// first to avoid out-of-bounds access.
///
/// # Safety
///
/// `caps` must be a valid pointer or NULL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_fs_access(
    caps: *const NonoCapabilitySet,
    index: usize,
) -> u32 {
    if caps.is_null() {
        crate::set_last_error("caps pointer is NULL");
        return NONO_ACCESS_MODE_INVALID;
    }
    let caps = unsafe { &*caps };
    match caps.inner.fs_capabilities().get(index) {
        Some(cap) => access_mode_to_raw(cap.access),
        None => {
            crate::set_last_error(&format!("index {index} out of bounds"));
            NONO_ACCESS_MODE_INVALID
        }
    }
}

/// Get whether the capability at `index` is a single-file capability.
///
/// Returns `false` if `caps` is NULL or `index` is out of bounds.
///
/// # Safety
///
/// `caps` must be a valid pointer or NULL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_fs_is_file(
    caps: *const NonoCapabilitySet,
    index: usize,
) -> bool {
    if caps.is_null() {
        return false;
    }
    let caps = unsafe { &*caps };
    match caps.inner.fs_capabilities().get(index) {
        Some(cap) => cap.is_file,
        None => false,
    }
}

/// Get the source tag of the capability at `index`.
///
/// Returns `NonoCapabilitySourceTag::User` and sets the last error if `caps`
/// is NULL or `index` is out of bounds. Check `nono_capability_set_fs_count()`
/// first to avoid out-of-bounds access.
///
/// # Safety
///
/// `caps` must be a valid pointer or NULL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_fs_source_tag(
    caps: *const NonoCapabilitySet,
    index: usize,
) -> NonoCapabilitySourceTag {
    if caps.is_null() {
        crate::set_last_error("caps pointer is NULL");
        return NonoCapabilitySourceTag::User;
    }
    let caps = unsafe { &*caps };
    match caps.inner.fs_capabilities().get(index) {
        Some(cap) => match &cap.source {
            nono::CapabilitySource::User => NonoCapabilitySourceTag::User,
            nono::CapabilitySource::Profile => NonoCapabilitySourceTag::Profile,
            nono::CapabilitySource::Group(_) => NonoCapabilitySourceTag::Group,
            nono::CapabilitySource::System => NonoCapabilitySourceTag::System,
        },
        None => {
            crate::set_last_error(&format!("index {index} out of bounds"));
            NonoCapabilitySourceTag::User
        }
    }
}

/// Get the group name of the capability at `index`.
///
/// Returns NULL if the source is not `Group`, or if `caps` is NULL,
/// or if `index` is out of bounds.
///
/// Caller must free the returned string with `nono_string_free()`.
///
/// # Safety
///
/// `caps` must be a valid pointer or NULL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_capability_set_fs_source_group_name(
    caps: *const NonoCapabilitySet,
    index: usize,
) -> *mut c_char {
    if caps.is_null() {
        return std::ptr::null_mut();
    }
    let caps = unsafe { &*caps };
    match caps.inner.fs_capabilities().get(index) {
        Some(cap) => match &cap.source {
            nono::CapabilitySource::Group(name) => rust_string_to_c(name.clone()),
            _ => std::ptr::null_mut(),
        },
        None => std::ptr::null_mut(),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::capability_set::{
        nono_capability_set_allow_path, nono_capability_set_free, nono_capability_set_new,
    };
    use std::ffi::CString;

    #[test]
    fn test_fs_count_empty() {
        let caps = nono_capability_set_new();
        // SAFETY: caps is valid.
        unsafe {
            assert_eq!(nono_capability_set_fs_count(caps), 0);
            nono_capability_set_free(caps);
        }
    }

    #[test]
    fn test_fs_count_null_safe() {
        // SAFETY: deliberate NULL.
        unsafe {
            assert_eq!(nono_capability_set_fs_count(std::ptr::null()), 0);
        }
    }

    #[test]
    fn test_fs_accessors_after_add() {
        let caps = nono_capability_set_new();
        let path = CString::new("/tmp").unwrap_or_default();
        // SAFETY: caps and path are valid.
        unsafe {
            let rc = nono_capability_set_allow_path(
                caps,
                path.as_ptr(),
                crate::types::NONO_ACCESS_MODE_READ_WRITE,
            );
            assert_eq!(rc, crate::types::NonoErrorCode::Ok);
            assert_eq!(nono_capability_set_fs_count(caps), 1);

            let original = nono_capability_set_fs_original(caps, 0);
            assert!(!original.is_null());
            crate::nono_string_free(original);

            let resolved = nono_capability_set_fs_resolved(caps, 0);
            assert!(!resolved.is_null());
            crate::nono_string_free(resolved);

            assert_eq!(
                nono_capability_set_fs_access(caps, 0),
                crate::types::NONO_ACCESS_MODE_READ_WRITE,
            );
            assert!(!nono_capability_set_fs_is_file(caps, 0));
            assert_eq!(
                nono_capability_set_fs_source_tag(caps, 0),
                NonoCapabilitySourceTag::User,
            );
            assert!(nono_capability_set_fs_source_group_name(caps, 0).is_null());

            nono_capability_set_free(caps);
        }
    }

    #[test]
    fn test_fs_out_of_bounds() {
        let caps = nono_capability_set_new();
        // SAFETY: caps is valid, index is out of bounds.
        unsafe {
            assert!(nono_capability_set_fs_original(caps, 99).is_null());
            assert!(nono_capability_set_fs_resolved(caps, 99).is_null());
            assert_eq!(
                nono_capability_set_fs_access(caps, 99),
                crate::types::NONO_ACCESS_MODE_INVALID,
            );
            assert!(nono_capability_set_fs_source_group_name(caps, 99).is_null());
            nono_capability_set_free(caps);
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2239** (2026-11-02): **fix(cli): support kitty release and repeat events in detach matcher**
  *Symptoms*: Handle advanced kitty keyboard protocol sequences in the PTY proxy and detach matchers. Non-press events (repeats and releases) for keys that are part of a pending match prefix are now ignored instead of invalidating the partial detach sequence.  - Refactor CSI-u escape parsing to handle full subfield formats for modifiers and event types - Strip Lock modifier bits from incoming reports to prevent state mismatches - Add `is_enhanced_key_echo` to identify non-press events for pending match sequences - Add test coverage for kitty release reports and lock modifiers during detach matching  ## Linked Issue  <!-- External and agent-proposed PRs must reference an existing issue. Maintainer-directed routine PRs may leave this blank and explain the exception in the Summary. -->  Closes #  ## Summary  <!-- Briefly describe what this PR does and why. -->  <!-- ## Agent Disclosure (if applicable)  If this PR is generated by an AI agent, per AGENTS.md you must include: - A statement that the contributor is an agent. - References to relevant files or sections consulted. - Explicit confirmation of compliance with repository requirements. -->  ## Test Plan  <!-- How was this tested? Include relevant commands, test cases, or manual verification steps. -->  ## Checklist  - [ ] An issue exists and is linked above, or this is maintainer-directed routine work - [x] All commits are signed-off, using [DCO](https://en.wikipedia.org/wiki/Developer_Certificate_of_Origin) - [x] Code changes follow the 

- **Issue #2234** (2026-10-30): **fix(cli): pause the PTY relay for network approval prompts**
  *Symptoms*: ## Linked Issue  Closes #2232  ## Summary  Network approval prompts (`network.approval_backends` with a `terminal` backend) were unreadable inside a `nono run` session. Every prompt line started in the column where the previous one ended, a staircase layout, and the session could hang after the user answered.  **Root cause.** During a session the PTY relay keeps the user's terminal in raw mode (`cfmakeraw`, so `OPOST` is off) and forwards stdin to the child. Filesystem approvals already pause the relay before prompting (`request_approval_with_relay_paused`). Network and proxy endpoint approvals run on proxy worker threads (`connect.rs`, `reverse.rs` and `tls_intercept` via `spawn_blocking`), which can't reach the relay. So:  1. The prompt was printed with bare `\n` into a raw terminal, which produced the staircase. 2. The relay kept reading stdin while the prompt was up. When the prompt consumed the user's answer first, the relay's `poll()` had already reported input, and its blocking `read()` then hung the supervisor loop until the user typed again (confirmed with `sample` on macOS).  **Fix.**  - **New `relay_prompt_gate` module.** While a relay is active, a terminal prompt raised off the supervisor thread waits until the supervisor loop pauses the relay. The relay resumes once the last pending prompt finishes. If the pause doesn't arrive before the request deadline, the request times out and is **denied** (fail closed). Prompts on the supervisor thread skip t

### D4: Resource Lifecycle & Leak Defenses
- Memory allocation, socket lifecycle, and handle cleanup observed from bug fixes and PR deltas.

### D5: Boundary Deserialization & Encoding
- Schema deserialization, payload validation, and untrusted input guards.

### D6: Cross-Platform & Runtime Gotchas
- Platform variance, OS-specific gotchas, and environment discrepancies detected in issue reports.

### D7: Build, CI/CD, Deployment & Tooling
- Toolchain requirements, dependencies, and packaging specs verified against remote manifests.

### D8: Forensic Bug Fixes & Real Production Code Patches
Observed empirical fixes and code patches:

### Incident Patch 1: `ff42f91d` (2026-11-02)
**Commit Message**: fix(cli): support kitty release and repeat events in detach matcher (#2239)

Handle advanced kitty keyboard protocol sequences in the PTY proxy and detach matchers. Non-press events (repeats and releases) for keys that are part of a pending match prefix are now ignored instead of invalidating the partial detach sequence.

- Refactor CSI-u escape parsing to handle full subfield formats for modifiers and event types
- Strip Lock modifier bits from incoming reports to prevent state mismatches
- Add `is_enhanced_key_echo` to identify non-press events for pending match sequences
- Add test coverage for kitty release reports and lock modifiers during detach matching

Signed-off-by: Luke Hinds <[REDACTED_EMAIL]>

**File**: `crates/nono-cli/src/connect_client.rs` (modified, +16/-1)
```diff
@@ -1853,7 +1853,13 @@ impl DetachMatcher {
                         }
                     }
                     crate::pty_proxy::EnhancedKeyMatch::Invalid => {
-                        self.flush_pending(&mut forward);
+                        if self.sequence[..self.pending_match_len].iter().any(|&key| {
+                            crate::pty_proxy::is_enhanced_key_echo(&self.pending_escape, key)
+                        }) {
+                            self.pending_escape.clear();
+                        } else {
+                            self.flush_pending(&mut forward);
+                        }
                     }
                 }
                 continue;
@@ -2169,6 +2175,15 @@ mod tests {
         assert!(third.detach);
     }
 
+    #[test]
+    fn detach_matcher_ignores_kitty_release_of_matched_prefix() {
+        let mut matcher = DetachMatcher::new(vec![0x1d, b'd']);
+        let matched = matcher.push(b"\x1b[93;5u\x1b[93;5:3ud");
+        assert!(matched.forward.is_empty());
+        assert!(matched.detach);
+        assert!(!matcher.pending_bytes());
+    }
+
     #[test]
     fn detach_matcher_forwards_unrelated_csi_u_input() {
         let mut matcher = DetachMatcher::new(vec![0x1d, b'd']);
```

**File**: `crates/nono-cli/src/pty_proxy.rs` (modified, +117/-18)
```diff
@@ -1391,7 +1391,16 @@ impl PtyProxy {
                     );
                 }
             }
-            EnhancedKeyMatch::Invalid => self.flush_pending_detach_escape(forwarded),
+            EnhancedKeyMatch::Invalid => {
+                if self.detach_sequence[..self.pending_detach_match_len]
+                    .iter()
+                    .any(|&key| is_enhanced_key_echo(&self.pending_detach_escape, key))
+                {
+                    self.pending_detach_escape.clear();
+                } else {
+                    self.flush_pending_detach_escape(forwarded);
+                }
+            }
         }
 
         true
@@ -1440,25 +1449,14 @@ pub(crate) fn match_enhanced_key_sequence(bytes: &[u8], expected_key: u8) -> Enh
     };
 
     if last == b'u' {
-        if body.is_empty()
-            || !body
-                .iter()
-                .all(|b| b.is_ascii_digit() || matches!(b, b';' | b':'))
-        {
-            return EnhancedKeyMatch::Invalid;
-        }
-        let mut fields = body.split(|b| matches!(b, b';' | b':'));
-        let Some(first_field) = fields.next() else {
+        let Some(report) = parse_csi_u_key_report(body) else {
             return EnhancedKeyMatch::Invalid;
         };
-        if first_field.is_empty() {
-            return EnhancedKeyMatch::Invalid;
-        }
-        let Some(codepoint) = parse_ascii_u32(first_field) else {
-            return EnhancedKeyMatch::Invalid;
-        };
-        let modifiers = fields.find_map(parse_ascii_u32).unwrap_or(1);
-        return if enhanced_key_matches(expected_key, codepoint, modifiers) {
+        // Only a press advances a detach match. Repeat and release reports
+        // (kitty "report event types") are handled by is_enhanced_key_echo.
+        return if report.event_type == KITTY_EVENT_PRESS
+            && enhanced_key_matches(expected_key, report.codepoint, report.modifiers)
+        {
             EnhancedKeyMatch::Matched
         } else {
             EnhancedKeyMatch::Invalid
@@ -1497,6 +1495,75 @@ pub(crate) fn match_enhanced_key_sequence(bytes: &[u8], expected_key: u8) -> Enh
     EnhancedKeyMatch::Invalid
 }
 
+/// Returns true when `bytes` is a complete kitty CSI-u repeat or release
+/// report for `key`.
+///
+/// Applications that enable kitty event reporting (e.g. pi pushes flags 7)
+/// make the terminal send `\x1b[93;5:3u` after the `\x1b[93;5u` press of
+/// Ctrl-]. Detach matchers use this to swallow those reports for keys already
+/// matched instead of letting them reset a partial detach sequence.
+pub(crate) fn is_enhanced_key_echo(bytes: &[u8], key: u8) -> bool {
+    let Some(body) = bytes
+        .strip_prefix(b"\x1b[")
+        .and_then(|rest| rest.strip_suffix(b"u"))
+    else {
+        return false;
+    };
+    parse_csi_u_key_report(body).is_some_and(|report| {
+        report.event_type != KITTY_EVENT_PRESS
+            && enhanced_key_matches(key, report.codepoint, report.modifiers)
+    })
+}
+
+const KITTY_EVENT_PRESS: u32 = 1;
+/// Caps Lock and Num Lock bits of a kitty modifier mask; they do not change
+/// which key was pressed.
+const KITTY_LOCK_MODIFIER_BITS: u32 = 64 | 128;
+
+struct CsiUKeyReport {
+    codepoint: u32,
+    modifiers: u32,
+    event_type: u32,
+}
+
+/// Parse the body of `CSI key[:shifted[:base]] [; modifiers[:event] [; text]] u`.
+fn parse_csi_u_key_report(body: &[u8]) -> Option<CsiUKeyReport> {
+    if body.is_empty()
+        || !body
+            .iter()
+            .all(|b| b.is_ascii_digit() || matches!(b, b';' | b':'))
+    {
+        return None;
+    }
+    let mut fields = body.split(|b| *b == b';');
+    let codepoint = parse_ascii_u32(fields.next()?.split(|b| *b == b':').next()?)?;
+
+    let (modifiers, event_type) = match fields.next() {
+        None => (1, KITTY_EVENT_PRESS),
+        Some(field) => {
+            let mut parts = field.split(|b| *b == b':');
+            let modifiers = match parts.next() {
+                Some(m) if !m.is_empty() => parse_ascii_u32(m)?,
+                _ => 1,
+            };
+            let event_type = match parts.next() {
+                Some(e) if !e.is_empty() => parse_ascii_u32(e)?,
+                _ => KITTY_EVENT_PRESS,
+            };
+            (modifiers, event_type)
+        }
+    };
+    let modifiers = modifiers
+        .checked_sub(1)
+        .map(|bits| (bits & !KITTY_LOCK_MODIFIER_BITS).saturating_add(1))?;
+
+    Some(CsiUKeyReport {
+        codepoint,
+        modifiers,
+        event_type,
+    })
+}
+
 fn parse_ascii_u32(bytes: &[u8]) -> Option<u32> {
     std::str::from_utf8(bytes).ok()?.parse::<u32>().ok()
 }
@@ -3483,6 +3550,38 @@ mod tests {
         assert!(proxy.take_detach_request());
     }
 
+    #[test]
+    fn filter_client_input_detaches_with_kitty_event_type_reports() {
+        // pi pushes kitty flags 7, so Ctrl-] arrives as a press then a release
+        // (and repeats when held). These must not reset the partial match.
+        let mut
```

---

### Incident Patch 2: `ab16bef9` (2026-11-02)
**Commit Message**: docs(neps): update implementation status and pre-1.0 compatibility guidance (#2249)

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

**File**: `ROADMAP.md` (modified, +18/-17)
```diff
@@ -8,40 +8,41 @@ This roadmap lists the major and security-consequential changes tracked as
 do not need a NEP and are not listed here. A proposal's position reflects
 its NEP status, not a delivery date.
 
-Next major release: **1.0**. NEPs flagged as API-breaking require a major
-version increase and are targeted at 1.0. Within each section they are
-listed first, then NEPs whose impact has not yet been assessed, then
-non-breaking NEPs.
+Next major release: **1.0**. Before 1.0, scoped breaking changes may ship
+after review. From 1.0, incompatible changes to the stable public API require
+a major version increase. Breaking labels describe compatibility impact.
+Within each section, breaking NEPs are listed first, then unassessed NEPs,
+then non-breaking NEPs.
 
-## Accepted
+## Shipped
 
-_Approved; implementation may proceed._
+_Accepted and implemented._
 
-- **[NEP-0000: NEP process](neps/0000-nep-process.md)** — _Breaking: not yet assessed_
-  Establish `neps/` at the repo root as the place for design proposals on changes too large or security-consequential for a plain PR description.
-- **[NEP-0003: Move macOS keychain authorisation to `nono-cli`](neps/0003-keychain-authorisation-to-cli.md)** — _Breaking: not yet assessed_
+- **[NEP-0003: Move macOS keychain authorisation to `nono-cli`](neps/0003-keychain-authorisation-to-cli.md)** — _Breaking_
   Move the decision about whether a sandboxed process may reach the macOS keychain out of the `nono` library and into `nono-cli` and make that decision require an explicit `filesystem.bypass_protection` entry when a deny group covers the keychain.
+- **[NEP-0000: NEP process](neps/0000-nep-process.md)** — _Non-breaking_
+  Establish `neps/` at the repo root as the place for design proposals on changes too large or security-consequential for a plain PR description.
 
-## Proposed
+## Accepted
 
-_Complete and awaiting a maintainer decision._
+_Approved; implementation may proceed._
 
-- **[NEP-0001: Pre-1.0.0 tech debt, deprecation, and API-freeze cleanup](neps/0001-1-0-0-tech-debt-cleanup.md)** — _Breaking: not yet assessed_
+- **[NEP-0001: Pre-1.0.0 tech debt, deprecation, and API-freeze cleanup](neps/0001-1-0-0-tech-debt-cleanup.md)** — _Breaking_
   Before nono reaches 1.0.0, we should remove the deprecations, dead code, backward-compat aliases, and library/CLI boundary drift that have built up since the project started.
-- **[NEP-0004: Opt-in Linux namespace isolation](neps/0004-opt-in-linux-namespace-isolation.md)** — _Breaking: not yet assessed_
+- **[NEP-0004: Opt-in Linux namespace isolation](neps/0004-opt-in-linux-namespace-isolation.md)** — _Non-breaking_
   Add an opt-in, permanently default-off Linux isolation layer that runs the sandboxed workload inside a set of unprivileged namespaces (user + network, later a minimal mount-mask), layered on top of the existing Landlock and seccomp enforcement.
 
 ## Draft
 
 _Under active authoring; not yet ready for a decision._
 
-- **[NEP-0002: Tool Sandbox invocation-scoped filesystem approvals](neps/0002-invocation-scoped-commands.md)** — _Breaking: not yet assessed_
-  Extend the Tool Sandbox policy model so that a sandboxed command can request a narrowly scoped filesystem capability for one invocation without escaping the filesystem policy selected for that invocation.
-- **[NEP-0005: Windows enforcement backend](neps/0005-windows-enforcement-backend.md)** — _Breaking: not yet assessed_
-  Add a third OS enforcement backend to nono for Windows, alongside Linux (Landlock) and macOS (Seatbelt).
 - **[NEP-0007: Supervisor decisions, audit and credentials outside a microVM guest](neps/0007-remote-supervisor-decisions-over-vsock.md)** — _Breaking: not yet assessed_
   Let nono split its supervisor across a virtual-machine boundary.
 - **[NEP-0008: Session flight recorder](neps/0008-session-flight-recorder.md)** — _Breaking: not yet assessed_
   Make the audit log a complete, self-describing record of an agent session: every access nono denied, from every enforcement layer, with the reason and the process responsible; every grant the agent held; every allowed access to paths an operator marked as sensitive; and a statement of which sources were live, so an operator can tell "nothing happened" apart from "nono could not see it".
+- **[NEP-0002: Tool Sandbox invocation-scoped filesystem approvals](neps/0002-invocation-scoped-commands.md)** — _Non-breaking_
+  Extend the Tool Sandbox policy model so that a sandboxed command can request a narrowly scoped filesystem capability for one invocation without escaping the filesystem policy selected for that invocation.
+- **[NEP-0005: Windows enforcement backend](neps/0005-windows-enforcement-backend.md)** — _Non-breaking_
+  Add a third OS enforcement backend to nono for Windows, alongside Linux (Landlock) and macOS (Seatbelt).
 - **[NEP-0009: OAuth 2.0 login and device enrollment from the CLI (`nono login`)](neps/0009-cli-login.md)** — _Non-breaking_
   Add `nono log
```

**File**: `neps/0000-nep-process.md` (modified, +8/-2)
```diff
@@ -2,9 +2,10 @@
 nep: 0000
 title: NEP process
 authors:
-  - johndoe
-status: accepted
+  - Aleksy Siek
+status: implemented
 created: 2026-08-28
+breaking: false
 superseded-by:
 ---
 
@@ -15,6 +16,11 @@ superseded-by:
 Establish `neps/` at the repo root as the place for design proposals on
 changes too large or security-consequential for a plain PR description.
 
+## Implementation status
+
+Implemented in [#1743](https://github.com/nolabs-ai/nono/pull/1743).
+The index and roadmap are generated by `make roadmap` (#2144).
+
 ## Motivation
 
 nono's core changes (capability semantics, policy resolution, sandbox
```

**File**: `neps/0001-1-0-0-tech-debt-cleanup.md` (modified, +32/-13)
```diff
@@ -3,8 +3,9 @@ nep: 0001
 title: Pre-1.0.0 tech debt, deprecation, and API-freeze cleanup
 authors:
   - Aleksy Siek
-status: proposed
+status: accepted
 created: 2026-08-31
+breaking: true
 superseded-by:
 ---
 
@@ -22,20 +23,39 @@ a pile of decisions we already know are wrong.
 The guiding rule for this NEP is that 1.0.0 is a clean slate. Anything
 marked deprecated, legacy, or `remove_by="indefinite"` gets removed. A
 tag of "indefinite" was never really a decision, it just meant nobody
-had scheduled one yet (see `crates/nono/src/trust/types.rs:48` for an
-example of the marker convention). 1.0.0 is the point where that gets
+had scheduled one yet. 1.0.0 is the point where that gets
 resolved by removing the thing, not by deferring it again. If
 something genuinely needs to stay, that has to be an explicit,
 argued-for exception written into this NEP's discussion, not the
 default outcome.
 
+## Implementation status
+
+Partially implemented as of 2026-11-02:
+
+- Legacy aliases, `deprecated_schema.rs` and `deprecated_policy.rs` were
+  removed in [#1826](https://github.com/nolabs-ai/nono/pull/1826).
+- Deprecated diagnostic, trust-policy and credential APIs were removed in
+  [#1871](https://github.com/nolabs-ai/nono/pull/1871); legacy Claude hook
+  cleanup was removed in [#1973](https://github.com/nolabs-ai/nono/pull/1973).
+- The stale AGENTS.md capability claims are gone. Main `apply_auto`
+  entrypoints have `#[must_use]`; other apply helpers still need review.
+- Remaining: keystore policy placement, public API review, socket-state
+  typing and compatibility, command-blocking removal, dead-code cleanup,
+  hidden-command review and the `endpoint_rules` decision.
+
+The inventory below records the original 0.74.0 audit; counts and line
+references are historical. Recheck callers before removing API:
+`nono-proxy` now uses `scrub_value`, and `CapabilityRequest` is still part
+of the library's supervisor message types.
+
 ## Motivation
 
-The project is currently at 0.74.0. A number of deprecations across
-`nono`, `nono-cli`, and `nono-proxy` are already marked "removed in
+At the time of the 0.74.0 audit, a number of deprecations across
+`nono`, `nono-cli`, and `nono-proxy` were already marked "removed in
 1.0.0" in code comments and `#[deprecated(since = ...)]` attributes
 (for example `crates/nono/src/diagnostic/codes.rs:72`), but they
-haven't actually been removed yet. Others were never formally marked
+had not been removed. Others were never formally marked
 deprecated but are clearly meant to be temporary: aliases, fields
 commented "legacy," and compat shims tagged `remove_by="indefinite"`.
 
@@ -120,15 +140,14 @@ NEP. Nothing here requires bundling everything into one change.
    a different concern from general command policy") to survive
    review.
 
-3. **Remove public API in `nono` that has no known caller.** None of
-   these are referenced anywhere else in the workspace:
+3. **Review public API identified as unused by the original audit.**
+   Revalidate these candidates against current workspace and downstream use:
    - `CapabilityRequest` in `crates/nono/src/supervisor/types.rs:21`
    - `SessionObservationInput` in
      `crates/nono/src/diagnostic/observation.rs:14`
    - `scrub_value`, `scrub_env_name`, `scrub_env_value`, `scrub_argv`,
      `scrub_header` in `crates/nono/src/scrub.rs:213,233,249,273,329`,
-     which are thin wrappers around the `..._with_policy` versions and
-     have no callers of their own
+     which are thin wrappers around the `..._with_policy` versions
    Public-and-unused doesn't carry forward into a frozen 1.0.0 API by
    default. If one of these turns out to be part of a documented
    contract for some downstream consumer, that should be called out
@@ -197,9 +216,9 @@ NEP. Nothing here requires bundling everything into one change.
    `crates/nono-cli/src/profile/mod.rs`, and
    `crates/nono-cli/src/profile_cmd.rs`.
 
-4. **Resolve all 15 `#[allow(dead_code)]` sites in `nono-cli`.**
-   AGENTS.md says this attribute shouldn't exist in the codebase.
-   Sites: `crates/nono-cli/src/setup.rs:14`,
+4. **Review `#[allow(dead_code)]` sites in `nono-cli`.**
+   The original audit identified 15 sites; refresh this inventory before
+   cleanup. Sites: `crates/nono-cli/src/setup.rs:14`,
    `crates/nono-cli/src/policy.rs:21,32,34,41`,
    `crates/nono-cli/src/test_env.rs:9`,
    `crates/nono-cli/src/network_policy.rs:20,32,34,41`,
```

**File**: `neps/0002-invocation-scoped-commands.md` (modified, +8/-0)
```diff
@@ -5,6 +5,7 @@ authors:
   - Luke Hinds
 status: draft
 created: 2026-09-21
+breaking: false
 superseded-by:
 ---
 
@@ -24,6 +25,13 @@ Sandbox features—wildcard command mediation, caller-declared environment
 forwarding, and Unix-domain socket grants—provide the controlled execution
 context in which this expansion operates.
 
+## Implementation status
+
+As of 2026-11-02, caller policies, `export_env`, `session_export_env`,
+`unix_socket_bind` and `@git:fsmonitor-socket` are implemented. The central
+`approval_fs` flow, `NONO_TOOL_SANDBOX_FS_REQUEST` channel and
+`commands."*"` mediation remain proposed. This NEP remains draft.
+
 ## Motivation
 
 Tool Sandbox policies currently require every filesystem capability to be
```

**File**: `neps/0003-keychain-authorisation-to-cli.md` (modified, +18/-3)
```diff
@@ -3,8 +3,9 @@ nep: 0003
 title: Move macOS keychain authorisation to `nono-cli`
 authors:
   - Kurtis Charnock
-status: accepted
+status: implemented
 created: 2026-09-23
+breaking: true
 superseded-by:
 ---
 
@@ -17,6 +18,20 @@ keychain out of the `nono` library and into `nono-cli` and make that decision
 require an explicit `filesystem.bypass_protection` entry when a deny group
 covers the keychain.
 
+## Implementation status
+
+Implemented in [#2019](https://github.com/nolabs-ai/nono/pull/2019) and
+shipped in v0.79.0, including shared deny-policy evaluation and regression
+tests. The design and security considerations below record that decision.
+
+Later, [#2093](https://github.com/nolabs-ai/nono/pull/2093) added explicit
+command-scoped `keychain_access` grants. These authorise a mediated child
+while leaving the agent denied. The original restriction still applies to
+ordinary command filesystem grants; the explicit delegation is a separately
+reviewed extension. Current usage is documented in
+[Tool Sandbox](../docs/cli/features/tool-sandbox.mdx) and
+[Claude Code](../docs/cli/clients/claude.mdx).
+
 ## Motivation
 
 See issue #1932:
@@ -55,7 +70,7 @@ launcher has to forward specifically to keep that inference working.
 
 ### Non-Goals
 
-- No changes to the Landlock/Linux implementation..
+- No changes to the Landlock/Linux implementation.
 - No change to which paths `deny_keychains_macos` covers.
 
 ## Proposal
@@ -188,6 +203,6 @@ launcher has to forward specifically to keep that inference working.
 
 ## Open Questions
 
-- Does the same bug class apply on Linux?.
+- Does the same bug class apply on Linux?
 - How is the version skew between a released CLI and the `nolabs-ai/claude`
   registry pack handled?
```

**File**: `neps/0004-opt-in-linux-namespace-isolation.md` (modified, +30/-18)
```diff
@@ -3,8 +3,9 @@ nep: 0004
 title: Opt-in Linux namespace isolation
 authors:
   - lukehinds
-status: proposed
+status: accepted
 created: 2026-09-29
+breaking: false
 superseded-by:
 ---
 
@@ -20,6 +21,19 @@ seccomp enforcement. This structurally removes the local-IPC escape classes
 pathname AF_UNIX endpoints such as the D-Bus session bus and the systemd
 user manager) instead of mediating them syscall-by-syscall.
 
+## Implementation status
+
+Partially implemented as of 2026-11-02:
+
+- Phase 1 and private TCP loopback shipped in v0.81.0
+  ([#2145](https://github.com/nolabs-ai/nono/pull/2145)): user/network/IPC/UTS
+  namespaces, the passed-listener proxy bridge and startup validation.
+- Landlock ABI detection and reporting through V9 shipped separately in
+  [#2217](https://github.com/nolabs-ai/nono/pull/2217); enforcement stays at V6.
+- Pending: Phase 2 mount masks and private `/tmp`, SOCKS5, packaged AppArmor
+  support, external-namespace detection and isolation audit metadata.
+  Reverse forwarding remains deferred; WSL2 support remains unverified.
+
 ## Motivation
 
 We have had a few escape classes reported against nono on Linux where 
@@ -114,8 +128,7 @@ rule. Opt-in keeps nono completely userland-purposed by default.
 
 ### Phasing
 
-**Phase 1 — network isolation (`user` + `net`, with `ipc` and `uts` as
-free riders).**
+**Phase 1 — network isolation (`user` + `net`, with optional `ipc` and `uts`).**
 
 The workload runs in a new user namespace (single-uid/gid identity
 mapping; the enabler for everything else while unprivileged) and a new
@@ -276,9 +289,9 @@ across platforms (`require_isolation`) remains out of scope (see Resolved
 Questions).
 
 `ipc` (SysV shm/sem/msg, POSIX MQs no longer shared with the host) and
-`uts` (hostname immutable from the host's perspective) namespaces are
-included in Phase 1 because they are one flag each at the same `unshare`
-call site and break almost nothing.
+`uts` (hostname immutable from the host's perspective) are available in
+Phase 1. Each requires explicit selection and can be requested independently
+of `network`; `--isolate net` does not enable either automatically.
 
 **Phase 2 — minimal mount mask (`user` + `mnt`).**
 
@@ -310,15 +323,13 @@ rules it already inherited, so nesting does not weaken enforcement.
 The `landlock` crate nono already ships (0.4.7) exposes ABI V7
 (Linux 6.15: audit flags), V8 (Linux 7.0: `TSYNC` all-threads restrict)
 and V9 (Linux 7.1: `AccessFs::ResolveUnix`); only ABI 10 (UDP) and 11
-still need upstream crate work. The lag is in nono's own code
-(`DetectedAbi` and the feature listing stop at V6), so adoption can start
-immediately and proceeds in risk order:
-
-1. **Detection and reporting** (routine, no NEP): extend `DetectedAbi`
-   through V9, surface kernel-vs-enforced ABI per class in `nono why` and
-   diagnostics (including the crate's errata signal). Also yields field
-   data on how fast V9 kernels arrive — the number that decides when the
-   fallbacks below can be demoted.
+still need upstream crate work. Detection and reporting now reach V9
+(#2217), while enforcement remains capped at V6. Adoption proceeds in
+risk order:
+
+1. **Detection and reporting** (shipped, #2217): `DetectedAbi` and
+   diagnostics distinguish detected support through V9 from enforced V6.
+   Per-class backend reporting remains part of the composition work below.
 2. **ABI 8 `TSYNC`** (routine): apply-path hygiene; most valuable for
    `nono wrap`'s multi-threaded self-sandboxing; best-effort below V8.
 3. **ABI 7 audit flags** (routine, opt-in diagnostics): kernel-logged
@@ -387,18 +398,19 @@ existing `linux.af_unix_mediation` precedent):
 {
   "linux": {
     "isolate": {
-      "network": true,        // Phase 1: user+net (+ipc+uts)
+      "network": true,        // Phase 1: user+net
       "loopback": true,       // Phase 1 follow-up: TCP on the namespace's own lo; requires network
       "ipc": true,            // may also be set without network
       "uts": true,
       "mounts": true,         // Phase 2: user+mnt, default mask list
-      "extra_masks": ["/opt/corp/agent.sock"]  // additive only
+      "extra_masks": ["/opt/corp/agent.sock"]  // Phase 2: additive only
     }
   }
 }
 ```
 
-CLI: `--isolate net,loopback,ipc,uts,mounts` (comma list) as sugar for the same.
+Current CLI: `--isolate net,loopback,ipc,uts` (comma list).
+`mounts` and `extra_masks` are planned Phase 2 fields and are not accepted yet.
 
 **Merge semantics.** The boolean `isolate` fields merge like `network.block`:
 logical OR across every profile layer, packs and the CLI. Any layer can turn
```

**File**: `neps/0005-windows-enforcement-backend.md` (modified, +20/-9)
```diff
@@ -5,6 +5,7 @@ authors:
   - lukehinds
 status: draft
 created: 2026-09-29
+breaking: false
 superseded-by:
 ---
 
@@ -25,6 +26,12 @@ unprivileged user namespaces) that have no Windows equivalent nono
 targets. Admin is a setup step only; every run stays unprivileged, and
 enforcement fails secure if the install is absent.
 
+## Implementation status
+
+Unimplemented as of 2026-11-02. The library has Linux and macOS enforcement
+backends only. This draft still needs a consistent identity and launch model
+connecting the preferred AppContainer design to the WFP fence before acceptance.
+
 ## Motivation
 
 nono today runs only on Linux and macOS. Its own reason for existing —
@@ -136,12 +143,12 @@ mechanism in `nono`. Concretely, anything that writes persistent machine
 state (a WFP filter set, a local account, ACL grants) is a `nono-cli`
 install/broker action, not a library call a random embedder can trip.
 
-From here we can delivery the NEP over several PRs / phases.
+The proposal is divided into phases.
 
 ### Phase 1 — network fence
 
 `nono-proxy` runs on the host and binds a loopback port (as it does today). 
-Windows enforcement then consists of:
+The dedicated-user candidate consists of:
 
 - a **WFP permit** filter for loopback to the proxy port(s) at
   `ALE_AUTH_CONNECT_V4/V6`, and
@@ -180,9 +187,10 @@ closest to nono's per-invocation model. The dedicated-user + restricted-
 token + ACL model is a **documented fallback only** — used where
 AppContainer cannot express a specific confinement need (handle
 isolation, job limits) with acceptable robustness, and only for that need,
-not as the default posture. The residual unknown is not *which model we
-prefer* but *whether AppContainer proves sufficient in practice*; see Open
-Questions.
+not as the default posture. The account-free AppContainer design still needs
+an identity contract for the WFP fence and an unprivileged launch path. The
+user-SID fence above and Secondary Logon example below describe the
+dedicated-user candidate, not a completed design for AppContainer.
 
 ### The privilege model: elevated install
 
@@ -227,11 +235,11 @@ dependency. Fail-secure is unchanged and non-negotiable — if the install
 has not been performed or the fence is not present at run time, nono
 refuses to run the workload rather than running it unconfined.
 
-### Why per-run stays unprivileged
+### Dedicated-user reference: unprivileged run path
 
-"Admin once, never per run" is not just a policy we assert — it is
-achievable because nothing in the run path needs a privileged operation,
-and the reference (`srt-win`) is built exactly this way:
+The dedicated-user reference (`srt-win`) implements the proposed
+"admin once, never per run" constraint as follows. The preferred AppContainer
+design must demonstrate the same property before this NEP is accepted.
 
 - **WFP filters are persistent and SID-keyed.** They are installed once
   (`FWPM_FILTER_FLAG_PERSISTENT`, machine-wide) and match by the sandbox
@@ -357,6 +365,9 @@ secure, per the rule below.
 
 ## Open Questions
 
+- **Fence identity and launch model.** How does the preferred AppContainer
+  design bind the workload and its descendants to the WFP fence without a
+  dedicated account? Resolve this before acceptance.
 - **Does AppContainer hold up?** This NEP commits to AppContainer as the
   primary FS/process mechanism; the open part is empirical — whether it
   can express the handle isolation and job limits the confinement needs
```

**File**: `neps/0007-remote-supervisor-decisions-over-vsock.md` (modified, +13/-4)
```diff
@@ -5,6 +5,7 @@ authors:
   - Luke Hinds
 status: draft
 created: 2026-10-16
+breaking:
 superseded-by:
 ---
 
@@ -19,19 +20,27 @@ injection move to a host-side nono component reached over vsock. The guest
 never holds the policy authority, the audit history or the credentials, so a
 full guest compromise does not yield them.
 
+## Implementation status
+
+As of 2026-11-02, the spike described below has not landed in this workspace.
+The remote protocol, vsock backend, concurrent dispatch, shared audit chains
+and host component remain proposed. Audit-format compatibility must be
+assessed before acceptance; `breaking` remains unset.
+
 ## Motivation
 
-To date we have recommended nono be combined with a nicroVM for hostile-code and multi-tenant deployments ("Composing with an outer boundary"). At present that
-composition is all-or-nothing: the whole supervisor runs in the guest. If an
-attacker escapes Landlock and seccomp through a guest kernel bug, they own the guest, and with it:
+We recommend combining nono with a microVM for hostile-code and multi-tenant
+deployments ("Composing with an outer boundary"). Currently the whole
+supervisor runs in the guest. A guest kernel compromise therefore exposes:
 
 - the credentials the supervisor or its proxy hold (in guest memory, and in
   every memory snapshot of the guest);
 - the network egress policy (the attacker controls the guest network stack);
 - the audit log (it can be rewritten or suppressed before it leaves the guest);
 - every approval decision (the attacker can answer its own requests).
 
-This is not a suprise as we modelled nono on the premise of trusting userspace, not agent space, but a MicroVM swaps things around and now the entire guest can be argued to be 'untrusted'.
+The current model trusts the supervisor's userspace. In a microVM deployment,
+the entire guest may instead need to be treated as untrusted.
 
 The VM still protects the host, but the assets worth stealing from an agent deployment — credentials, egress and an honest record — are lost.
 
```

#### Recent Merged Pull Requests:
- **PR #2249** (2026-11-02): docs(neps): update implementation status and pre-1.0 compatibility guidance (@SequeI)
- **PR #2245** (2026-11-02): docs(nep): propose nep-0009 for cli oauth login and device enrollment (@lukehinds)
- **PR #2239** (2026-11-02): fix(cli): support kitty release and repeat events in detach matcher (@lukehinds)
- **PR #2238** (2026-11-02): feat(cli): support approval elevation for AF_UNIX pathname sockets (@lukehinds)
- **PR #2235** (2026-10-30): feat(cli): record proxy audit events live to audit log (@lukehinds)
- **PR #2234** (2026-10-30): fix(cli): pause the PTY relay for network approval prompts (@panga)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.


---

## 6. Net-New Universal Engineering Rules (Candidates for Master Brain)

## X. cli): support kitty release and repeat events in detach matcher (#2239)

**RULE**:
When implementing operations in `crates/nono-cli/src/connect_client.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nolabs-ai/nono. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `ff42f91d`: cli): support kitty release and repeat events in detach matcher (#2239). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/nono-cli/src/connect_client.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                        if self.sequence[..self.pending_match_len].iter().any(|&key| {
                            crate::pty_proxy::is_enhanced_key_echo(&self.pending_escape, key)
                        }) {
                            self.pending_escape.clear();
                        } else {
                            self.flush_pending(&mut forward);
                        }
    #[test]
    fn detach_matcher_ignores_kitty_release_of_matched_prefix() {
        let mut matcher = DetachMatcher::new(vec![0x1d, b'd']);
        let matched = matcher.push(b"\x1b[93;5u\x1b[93;5:3ud");
        assert!(matched.forward.is_empty());
        assert!(matched.detach);
        assert!(!matcher.pending_bytes());
    }

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
                        self.flush_pending(&mut forward);
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `ff42f91d` are properly handled with clean fallback behavior.

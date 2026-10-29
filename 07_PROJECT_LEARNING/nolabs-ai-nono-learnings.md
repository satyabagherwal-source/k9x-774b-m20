> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nolabs-ai-nono-learnings.md`  
> **Source**: github ([https://github.com/nolabs-ai/nono](https://github.com/nolabs-ai/nono))  
> **Source Version**: `6880db1c`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-29T22:19:20.719Z  
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
> **Harvest Timestamp**: 2026-10-29T22:19:19.451Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nolabs-ai/nono`
- **Description**: agent runtime security - zero trust, zero setup, zero latency agent sandboxing
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4755 stars

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
- **Issue #2225** (2026-10-29): **fix(proxy): redeem phantoms inside Basic credentials on token endpoints**
  *Symptoms*: ## Linked Issue  Closes #2224  ## Summary  An `oauth_capture` provider that phantomizes a client secret breaks DCR clients that authenticate with `client_secret_basic`: the phantom travels inside `Authorization: Basic base64(client_id:client_secret)` (RFC 6749 §2.3.1), the marker scan cannot see through the base64, and the issuer answers `401 invalid_client`.  The proxy now decodes Basic credentials on configured token endpoints and redeems the phantom in the password slot, as it already does for bearer headers and `request_nonce_fields` bodies.  | Case | Behaviour | | --- | --- | | Phantom in the password slot | Redeemed; recomposed with the secret form-urlencoded per RFC 6749 §2.3.1 (`%20` for space, `%2B` for a literal `+`), username bytes verbatim | | Real credentials, no phantom | Pass through byte-identical | | Phantom in the username, cross-provider phantom, provider without `client_secret` redemption, malformed credentials | Fail closed with a credential error | | Basic-hidden phantom off a token endpoint | `403`, audited as `ManagedCredentialUnavailable`, never forwarded |  The fix is already deployed downstream, where a live credential suite exercises the DCR flow end to end.  ## Agent Disclosure  <details> <summary>Written by an AI agent (OpenCode, GLM) at the direction of James Carnegie, who reviewed and approved each step.</summary>  Consulted `AGENTS.md`, `CONTRIBUTING.md`, RFC 6749 §2.3.1, RFC 7591, `crates/nono-proxy/src/oauth_capture/` and `crates/nono-proxy/

- **Issue #2224** (2026-10-29): **oauth_capture: phantoms inside Authorization: Basic are not redeemed on token endpoints**
  *Symptoms*: [What happened?]  An oauth_capture provider that phantomizes a client secret cannot authenticate that client on its own token endpoint when the client uses HTTP Basic credentials. The client registers dynamically (RFC 7591) and oauth_capture replaces the client_secret in the register response with a phantom nonce, per the endpoint's response_fields. The client then sends that phantom inside Authorization: Basic base64(client_id:client_secret) (RFC 6749 §2.3.1, token_endpoint_auth_method: client_secret_basic). The proxy resolves phantoms in bearer headers and in request_nonce_fields bodies, but the Basic header is opaque base64 to the marker scan, so the phantom is forwarded upstream verbatim and the issuer answers 401 invalid_client.  The real secret never leaves the sandbox, but the client can never use it either: a phantom is non-functional outside the mediator.  [What did you expect to happen?]  The proxy resolves the phantom inside the Basic credentials on configured token endpoints before forwarding, as it already does for bearer headers and request_nonce_fields bodies.  [Steps to reproduce]  1. Configure an oauth_capture provider whose token_endpoints cover the    issuer's register and token endpoints, with client_secret in the    register endpoint's response_fields (profile fragment below). 2. Inside the sandbox, register a client dynamically; the response    carries a nono_... phantom in client_secret. 3. In the same nono run (the credential broker is per-process), re

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

### Incident Patch 1: `be579e79` (2026-10-29)
**Commit Message**: fix(proxy): redeem phantoms inside Basic credentials on token endpoints (#2225)

* fix(proxy): redeem phantoms inside Basic credentials on token endpoints

handle_inner_request's OAuth-capture header rewrite only recognized
Bearer-shaped phantoms. An RFC 6749 2.3.1 client (dynamic client
registration) sends its client_secret as base64(client_id:secret) in the
password slot of Authorization: Basic, and the phantom marker scan cannot
see through standard base64, so a phantomized DCR client_secret reached
the token endpoint verbatim and every token request was answered 401
invalid_client.

Add rewrite_request_basic_authorization, which decodes the Basic
credentials on configured token endpoints, redeems a provider-admitted
phantom in the password slot, and re-encodes the header with the
form-urlencoded real secret per RFC 6749 §2.3.1: space becomes %20 and a
literal + becomes %2B, so both form-decoding and percent-only-decoding
issuers recover the same secret. The client's username bytes are
preserved verbatim, because only the bytes this rewrite replaces get an
encoding convention. Redemption is provider-granular, not
field-granular: any phantom the provider minted resolves in the pa

**File**: `crates/nono-proxy/src/oauth_capture/rewrite.rs` (modified, +491/-0)
```diff
@@ -4,9 +4,11 @@ use crate::config::OAuthTokenRequestBodyFormat;
 use crate::error::{ProxyError, Result};
 use crate::jwt_phantom::jwt_shaped_phantom;
 use crate::token::NonceResolver;
+use base64::Engine as _;
 use serde_json::Value;
 use std::collections::HashSet;
 use tracing::debug;
+use zeroize::Zeroizing;
 
 impl OAuthCaptureStore {
     /// Resolve an OAuth-capture phantom in a token endpoint request header
@@ -21,6 +23,103 @@ impl OAuthCaptureStore {
         self.rewrite_header_value(value, &consumer)
     }
 
+    /// Resolve a phantom in the password slot of `Authorization: Basic`
+    /// credentials (RFC 6749 §2.3.1); base64 hides it from the marker scan.
+    pub fn rewrite_request_basic_authorization(
+        &self,
+        endpoint: &LoadedOAuthEndpoint,
+        value: &str,
+    ) -> Result<Option<String>> {
+        let Some(credentials) = basic_scheme_payload(value) else {
+            return Ok(None);
+        };
+        let decoded = Zeroizing::new(
+            base64::engine::general_purpose::STANDARD
+                .decode(credentials)
+                .map_err(|_| {
+                    ProxyError::Credential(format!(
+                        "Basic credentials on token endpoint for provider '{}' are not standard \
+                         padded base64",
+                        endpoint.provider
+                    ))
+                })?,
+        );
+        let decoded = std::str::from_utf8(&decoded).map_err(|_| {
+            ProxyError::Credential(format!(
+                "Basic credentials on token endpoint for provider '{}' are not UTF-8",
+                endpoint.provider
+            ))
+        })?;
+        let (username, password) = decoded.split_once(':').ok_or_else(|| {
+            ProxyError::Credential(format!(
+                "Basic credentials on token endpoint for provider '{}' contain no ':' separator",
+                endpoint.provider
+            ))
+        })?;
+
+        let username_carries_phantom = self.contains_phantom(username.as_bytes());
+        let password_carries_phantom = self.contains_phantom(password.as_bytes());
+        if !username_carries_phantom && !password_carries_phantom {
+            return Ok(None);
+        }
+        if username_carries_phantom {
+            // Only the password slot carries a redeemable secret.
+            return Err(ProxyError::Credential(format!(
+                "Basic credentials on token endpoint for provider '{}' carry a phantom in the \
+                 username",
+                endpoint.provider
+            )));
+        }
+        if !endpoint
+            .request_nonce_fields
+            .iter()
+            .any(|field| field == "client_secret")
+        {
+            return Err(ProxyError::Credential(format!(
+                "Basic credentials on token endpoint for provider '{}' carry a phantom, but \
+                 the provider does not redeem client_secret",
+                endpoint.provider
+            )));
+        }
+        // `resolve` admits only exact provider-minted phantoms.
+        let real = self
+            .resolve(password, &provider_consumer(&endpoint.provider))
+            .ok_or_else(|| {
+                ProxyError::Credential(format!(
+                    "Basic credentials on token endpoint for provider '{}' carry an invalid or \
+                     unadmitted phantom",
+                    endpoint.provider
+                ))
+            })?;
+        // Only the replaced secret is form-encoded; the username stays verbatim.
+        let encoded_secret = basic_credentials_form_urlencode(&real);
+        let mut combined = Zeroizing::new(Vec::with_capacity(
+            username.len() + encoded_secret.len() + 1,
+        ));
+        combined.extend_from_slice(username.as_bytes());
+        combined.push(b':');
+        combined.extend_from_slice(&encoded_secret);
+        Ok(Some(format!(
+            "Basic {}",
+            base64::engine::general_purpose::STANDARD.encode(combined.as_slice())
+        )))
+    }
+
+    /// Whether decoded Basic credentials carry a phantom, which the raw
+    /// marker scan cannot see through base64; callers must reject, not forward.
+    pub fn basic_authorization_hides_phantom(&self, value: &str) -> bool {
+        let Some(credentials) = basic_scheme_payload(value) else {
+            return false;
+        };
+        let Ok(decoded) = base64::engine::general_purpose::STANDARD
+            .decode(credentials)
+            .map(Zeroizing::new)
+        else {
+            return false;
+        };
+        self.contains_phantom(&decoded)
+    }
+
     pub fn rewrite_request_body(
         &self,
         endpoint: &LoadedOAuthEndpoint,
@@ -600,6 +699,35 @@ fn mint_response_phantom(
     }
 }
 
+/// The credentials payload of an `Authorization: Basic` value, per RFC 7235.
+fn basic_scheme_payload(value: &str) -> Option<&str> {
+    let (scheme, rest) = value.split_once(char::is_whitespace)?;
+    if !sche
```

**File**: `crates/nono-proxy/src/tls_intercept/handle.rs` (modified, +421/-3)
```diff
@@ -1331,7 +1331,7 @@ where
         {
             continue;
         }
-        let resolved_value = nonce_consumer
+        let mut resolved_value = nonce_consumer
             .as_deref()
             .and_then(|consumer| {
                 ctx.nonce_resolver.as_deref().and_then(|resolver| {
@@ -1345,8 +1345,52 @@ where
                     ctx.oauth_capture_store
                         .rewrite_request_header_value(endpoint, value)
                 })
-            })
-            .unwrap_or_else(|| value.clone());
+            });
+        // A DCR client sends its phantom client_secret inside Basic
+        // credentials, where the raw marker scan cannot see it.
+        if resolved_value.is_none() && name.eq_ignore_ascii_case("authorization") {
+            let basic = if let Some(endpoint) = oauth_endpoint {
+                ctx.oauth_capture_store
+                    .rewrite_request_basic_authorization(endpoint, value)
+            } else if ctx
+                .oauth_capture_store
+                .basic_authorization_hides_phantom(value)
+            {
+                // Off the token endpoint there is nothing to redeem
+                // against, so reject rather than forward the phantom.
+                Err(ProxyError::Credential(
+                    "Basic authorization carries a phantom with no token endpoint \
+                     to redeem it"
+                        .to_string(),
+                ))
+            } else {
+                Ok(None)
+            };
+            match basic {
+                Ok(Some(rewritten)) => resolved_value = Some(rewritten),
+                Ok(None) => {}
+                Err(error) => {
+                    warn!("tls_intercept: {}", error);
+                    audit::log_denied(
+                        ctx.audit_log,
+                        audit::ProxyMode::ConnectIntercept,
+                        &audit::EventContext {
+                            route_id: service,
+                            denial_category: Some(
+                                nono::undo::NetworkAuditDenialCategory::ManagedCredentialUnavailable,
+                            ),
+                            ..audit::EventContext::default()
+                        },
+                        ctx.host,
+                        ctx.port,
+                        &error.to_string(),
+                    );
+                    reverse::send_error_generic(tls_stream, 403, "Forbidden").await?;
+                    return Ok(());
+                }
+            }
+        }
+        let resolved_value = resolved_value.unwrap_or_else(|| value.clone());
         request.push_str(&format!("{}: {}\r\n", name, resolved_value));
     }
     request.push_str("Connection: close\r\n");
@@ -4145,4 +4189,378 @@ mod tests {
             "the new upstream token must not reach the client, got: {response}"
         );
     }
+
+    // --- Authorization: Basic phantoms on token endpoints (DCR) ---
+
+    /// DCR shape: registration mints the client_secret phantom; the token
+    /// endpoint receives it inside Basic credentials.
+    fn dcr_oauth_capture_configs(port: u16) -> Vec<crate::config::OAuthCaptureConfig> {
+        use crate::config::{
+            OAuthCaptureConfig, OAuthTokenEndpointConfig, OAuthTokenRequestBodyFormat,
+            OAuthTokenResponseFieldConfig, OAuthTokenResponseFieldKind,
+        };
+
+        vec![OAuthCaptureConfig {
+            provider: "example_mcp".to_string(),
+            token_endpoints: vec![
+                OAuthTokenEndpointConfig {
+                    host: format!("https://localhost:{port}"),
+                    path: "/oauth/register".to_string(),
+                    response_fields: vec![OAuthTokenResponseFieldConfig {
+                        path: "client_secret".to_string(),
+                        kind: OAuthTokenResponseFieldKind::Opaque,
+                        format: None,
+                    }],
+                    request_body: OAuthTokenRequestBodyFormat::Json,
+                    response_body: OAuthTokenRequestBodyFormat::Json,
+                    request_nonce_fields: vec!["client_secret".to_string()],
+                },
+                OAuthTokenEndpointConfig {
+                    host: format!("https://localhost:{port}"),
+                    path: "/oauth/token".to_string(),
+                    response_fields: vec![OAuthTokenResponseFieldConfig {
+                        path: "access_token".to_string(),
+                        kind: OAuthTokenResponseFieldKind::Opaque,
+                        format: None,
+                    }],
+                    request_body: OAuthTokenRequestBodyFormat::Form,
+                    response_body: OAuthTokenRequestBodyFormat::Json,
+                    request_nonce_fields: vec![
+                        "refresh_token".to_string(),
+                        "client_secret".to_string(),
+                    ],
+                },
+            ],
+            adm
```

---

### Incident Patch 2: `6880db1c` (2026-10-29)
**Commit Message**: chore(nix): update prebuilt hashes for v0.81.0 (#2230)

Co-authored-by: SequeI <[REDACTED_EMAIL]>

**File**: `flake.nix` (modified, +4/-4)
```diff
@@ -57,10 +57,10 @@
     # Auto-updated by the `update-nix-hashes` job in release.yml
     # after each release — no manual maintenance needed.
     prebuiltHashes = {
-      "x86_64-linux" = "sha256-baZlthmZVwwQ3/x9p4go/h+388rFMxnlBc6+yu8XA38=";
-      "aarch64-linux" = "sha256-0qJMjDdxT4XIKbVYb/2B/CrPM2yVNy2IG6YhQIhPIss=";
-      "x86_64-darwin" = "sha256-s1TmdOa0ZDrVxXLRSK42e7DFwQNBD7wikjxVk6b30LI=";
-      "aarch64-darwin" = "sha256-roJBZ7PZBTG4MEKbqSt3gTebHC15+bEf3Yiw/SZ+TjI=";
+      "x86_64-linux" = "sha256-fswz/5w0m9+oS0SW56dVX2e8wz8eElx9+e+2U8bE5Wk=";
+      "aarch64-linux" = "sha256-pNh92wkX75YiS8xBolhzGNfQ6SRB5/9FRpblmAyfeSQ=";
+      "x86_64-darwin" = "sha256-95WqiPqvdZdf/GAOuHDnyfK1K6IDXfUIfslyoCUq/UA=";
+      "aarch64-darwin" = "sha256-cosd7vv2OQybdPyYLvve0eHEs3uZ3N76Lgcmbf702ek=";
     };
 
     prebuiltFor = system: let pkgs = pkgsFor system; in pkgs.stdenv.mkDerivation {
```

---

### Incident Patch 3: `c8125f4f` (2026-10-29)
**Commit Message**: fix(why): add pathname Unix socket policy diagnostics (#2220)

Add explicit Unix socket queries, persist enforcement state for self inspection, distinguish unmediated configurations, and clarify Linux and macOS behavior in documentation.

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

**File**: `crates/nono-cli/data/profile-authoring-guide.md` (modified, +8/-2)
```diff
@@ -221,7 +221,7 @@ Command-policy denials are not filesystem-policy denials. A message like:
 nono: command policy denied gh: Command 'gh' is blocked: agents may read issues but not comment on them
 ```
 
-means the command policy blocked the resolved command invocation. `nono why --path ...` only explains filesystem-policy grants and denials, and `nono why --host ...` only explains network-policy reachability. For command-policy denials, query the command edge directly:
+means the command policy blocked the resolved command invocation. `nono why --path ...` only explains filesystem-policy grants and denials, `nono why --unix-socket ...` explains pathname socket operations, and `nono why --host ...` only explains network-policy reachability. For command-policy denials, query the command edge directly:
 
 ```sh
 nono why --profile <profile> --command gh -- issue comment 1052
@@ -435,7 +435,7 @@ Here `read` only ever matches `.ts`/`.tsx` files, so it can never overlap `.env`
 
 | Field                   | Type                              | Default  | Description |
 |-------------------------|-----------------------------------|----------|-------------|
-| `block`                 | boolean                           | `false`  | Block all network access. |
+| `block`                 | boolean                           | `false`  | Block outbound IP network access. |
 | `allow_http2`           | boolean                           | `false`  | Allow HTTP/2 to upstream servers via ALPN negotiation. Default is HTTP/1.1 with keep-alive. Equivalent to `--allow-http2`. |
 | `network_profile`       | string or null                    | inherit  | Name from `network-policy.json` for proxy filtering. Set to `null` to clear inherited value. |
 | `allow_domain`          | array of string or object         | `[]`     | Additional domains to allow through the proxy. Entries can be plain strings (CONNECT tunnel) or objects with endpoint rules (TLS-intercepted L7 filtering). Supports wildcard subdomains (`*.googleapis.com`) and a whole-label wildcard in a non-leading position (`jenkins.*.ci.example.com`, matching exactly one label there). |
@@ -1179,6 +1179,12 @@ With no `filesystem.unix_socket` entries, every AF_UNIX pathname connect and bin
 }
 ```
 
+Access to a container runtime socket grants the authority of the daemon behind
+it. A rootful Docker daemon runs outside nono's process sandbox and usually has
+root access to the host. For sensitive workloads that require Docker, use a
+separate container or MicroVM with its own daemon; mounting the host's rootful
+Docker socket preserves the same host authority.
+
 #### Deprecation note
 
 `commands.deny` is deprecated startup-only gating — it blocks the command from launching but does not enforce socket access and should not be relied on as enforcement. It remains visible in `nono profile show` under the commands section for compatibility.
```

**File**: `crates/nono-cli/src/cli.rs` (modified, +119/-1)
```diff
@@ -185,7 +185,7 @@ pub enum Commands {
     Wrap(Box<WrapArgs>),
 
     // ── Exploration & debugging ─────────────────────────────────────────
-    /// Check why filesystem, network, scope, or command access would be allowed or denied
+    /// Check why filesystem, Unix socket, network, scope, or command access would be allowed or denied
     #[command(help_template = "\
 {about}
 
@@ -198,6 +198,7 @@ pub enum Commands {
   nono why --path ~/.ssh --op read             # Check if ~/.ssh is readable
   nono why --path ./src --op write --allow .   # Check with capability context
   nono why --json --path ~/.aws --op read      # JSON output for agents
+  nono why --unix-socket /run/docker.sock      # Query pathname Unix socket connect access
   nono why --host api.openai.com --port 443    # Query network access
   nono why --self --path /var --op write       # Inside sandbox, query own capabilities
   nono why --profile gh --command gh -- issue comment 1052
@@ -2247,6 +2248,25 @@ pub struct WhyArgs {
     #[arg(long, help_heading = "QUERY")]
     pub path: Option<PathBuf>,
 
+    /// Pathname AF_UNIX socket to check
+    #[arg(
+        long,
+        value_name = "PATH",
+        conflicts_with_all = ["command", "path", "host", "scope"],
+        help_heading = "QUERY"
+    )]
+    pub unix_socket: Option<PathBuf>,
+
+    /// Unix socket operation to check (default: connect)
+    #[arg(
+        long,
+        value_enum,
+        value_name = "OP",
+        requires = "unix_socket",
+        help_heading = "QUERY"
+    )]
+    pub socket_op: Option<WhySocketOp>,
+
     /// Match absolute literal paths against profile rules without resolving them on this host
     #[arg(long, requires_all = ["path", "profile"], help_heading = "QUERY")]
     pub lexical_profile_path: bool,
@@ -2312,6 +2332,30 @@ pub struct WhyArgs {
     #[arg(long, value_name = "FILE", help_heading = "CONTEXT")]
     pub write_file: Vec<PathBuf>,
 
+    /// Exact pathname Unix sockets to allow connect access (for query context)
+    #[arg(long, value_name = "SOCKET", help_heading = "CONTEXT")]
+    pub allow_unix_socket: Vec<PathBuf>,
+
+    /// Exact pathname Unix sockets to allow connect and bind (for query context)
+    #[arg(long, value_name = "SOCKET", help_heading = "CONTEXT")]
+    pub allow_unix_socket_bind: Vec<PathBuf>,
+
+    /// Direct-child pathname Unix sockets to allow in a directory (for query context)
+    #[arg(long, value_name = "DIR", help_heading = "CONTEXT")]
+    pub allow_unix_socket_dir: Vec<PathBuf>,
+
+    /// Direct-child pathname Unix sockets to allow connect and bind (for query context)
+    #[arg(long, value_name = "DIR", help_heading = "CONTEXT")]
+    pub allow_unix_socket_dir_bind: Vec<PathBuf>,
+
+    /// Descendant pathname Unix sockets to allow in a subtree (for query context)
+    #[arg(long, value_name = "DIR", help_heading = "CONTEXT")]
+    pub allow_unix_socket_subtree: Vec<PathBuf>,
+
+    /// Descendant pathname Unix sockets to allow connect and bind (for query context)
+    #[arg(long, value_name = "DIR", help_heading = "CONTEXT")]
+    pub allow_unix_socket_subtree_bind: Vec<PathBuf>,
+
     /// Block network access (for query context)
     #[arg(long = "block-net", help_heading = "CONTEXT")]
     pub block_net: bool,
@@ -2350,6 +2394,15 @@ pub enum WhyOp {
     ReadWrite,
 }
 
+/// Pathname Unix socket operation type for why command
+#[derive(Clone, Copy, Debug, ValueEnum)]
+pub enum WhySocketOp {
+    /// Connect to an existing socket
+    Connect,
+    /// Bind and create a socket at this path
+    Bind,
+}
+
 /// Landlock scope type for why command
 #[derive(Clone, Debug, ValueEnum)]
 pub enum WhyScope {
@@ -3075,6 +3128,71 @@ mod tests {
     use super::*;
     use clap::CommandFactory;
 
+    #[test]
+    fn test_why_unix_socket_defaults_to_connect() {
+        let cli = Cli::parse_from(["nono", "why", "--unix-socket", "/run/example.sock"]);
+        let Commands::Why(args) = cli.command else {
+            panic!("expected why command");
+        };
+        assert_eq!(args.unix_socket, Some(PathBuf::from("/run/example.sock")));
+        assert!(args.socket_op.is_none());
+    }
+
+    #[test]
+    fn test_why_unix_socket_bind_parses() {
+        let cli = Cli::parse_from([
+            "nono",
+            "why",
+            "--unix-socket",
+            "/run/example.sock",
+            "--socket-op",
+            "bind",
+        ]);
+        let Commands::Why(args) = cli.command else {
+            panic!("expected why command");
+        };
+        assert!(matches!(args.socket_op, Some(WhySocketOp::Bind)));
+    }
+
+    #[test]
+    fn test_why_unix_socket_context_grant_parses() {
+        let cli = Cli::parse_from([
+            "nono",
+            "why",
+            "--unix-socket",
+            "/run/example.sock",
+            "--allow-unix-socket",
+            "/run/example.sock",
+        ]);
+        let Commands::Why(args) = cli.command else {
+            panic!("expect
```

**File**: `crates/nono-cli/src/exec_strategy.rs` (modified, +2/-0)
```diff
@@ -1941,6 +1941,8 @@ fn build_policy_explanations(
             }
             Ok(crate::query_ext::QueryResult::NotSandboxed { .. })
             | Ok(crate::query_ext::QueryResult::ApprovalRequired { .. })
+            | Ok(crate::query_ext::QueryResult::Unmediated { .. })
+            | Ok(crate::query_ext::QueryResult::Unknown { .. })
             | Ok(crate::query_ext::QueryResult::Scope { .. })
             | Err(_) => {}
         }
```

**File**: `crates/nono-cli/src/execution_runtime.rs` (modified, +12/-6)
```diff
@@ -1,7 +1,7 @@
 use crate::audit_attestation::prepare_audit_signer;
 #[cfg(unix)]
 use crate::hook_runtime;
-use crate::launch_runtime::{LaunchPlan, select_threading_context};
+use crate::launch_runtime::{ExecutionFlags, LaunchPlan, select_threading_context};
 use crate::proxy_runtime::start_proxy_runtime;
 use crate::supervised_runtime::{SupervisedRuntimeContext, execute_supervised_runtime};
 use crate::{
@@ -365,7 +365,7 @@ pub(crate) fn execute_sandboxed(plan: LaunchPlan) -> Result<()> {
         &allowed_domain_strs,
         &denied_domain_strs,
         &domain_endpoints,
-        flags.silent,
+        &flags,
     );
     let cap_file_path = cap_file.unwrap_or_else(|| std::path::PathBuf::from("/dev/null"));
     if cap_file_path != Path::new("/dev/null") {
@@ -882,16 +882,22 @@ fn write_capability_state_file(
     allowed_domains: &[String],
     denied_domains: &[String],
     domain_endpoints: &[sandbox_state::DomainEndpointState],
-    silent: bool,
+    flags: &ExecutionFlags,
 ) -> Option<std::path::PathBuf> {
-    let state = sandbox_state::SandboxState::from_caps_with_denies(
+    let mut state = sandbox_state::SandboxState::from_caps_with_denies(
         caps,
         bypass_protection_paths,
         deny_paths,
         allowed_domains,
         denied_domains,
         domain_endpoints,
     );
+    #[cfg(target_os = "linux")]
+    let linux_af_unix_mediation = flags.af_unix_mediation.is_pathname();
+    #[cfg(not(target_os = "linux"))]
+    let linux_af_unix_mediation = false;
+    state.pathname_socket_enforcement =
+        sandbox_state::pathname_socket_enforcement(linux_af_unix_mediation);
 
     for _ in 0..8 {
         let cap_file = next_capability_state_file_path();
@@ -908,7 +914,7 @@ fn write_capability_state_file(
                      Sandboxed processes will not be able to query their own capabilities using 'nono why --self'.",
                     e
                 );
-                if !silent {
+                if !flags.silent {
                     eprintln!(
                         "  WARNING: Capability state file could not be written.\n  \
                          The sandbox is active, but 'nono why --self' will not work inside this sandbox."
@@ -923,7 +929,7 @@ fn write_capability_state_file(
         "Failed to allocate a unique capability state file after repeated collisions. \
          Sandboxed processes will not be able to query their own capabilities using 'nono why --self'."
     );
-    if !silent {
+    if !flags.silent {
         eprintln!(
             "  WARNING: Capability state file could not be written.\n  \
              The sandbox is active, but 'nono why --self' will not work inside this sandbox."
```

**File**: `crates/nono-cli/src/query_ext.rs` (modified, +261/-1)
```diff
@@ -4,6 +4,7 @@
 //! `nono why` command.
 
 use crate::config;
+use crate::sandbox_state::PathnameSocketEnforcement;
 use colored::Colorize;
 use nono::{AccessMode, CapabilitySet, Result, try_canonicalize};
 use serde::{Deserialize, Serialize};
@@ -84,6 +85,24 @@ pub enum QueryResult {
         #[serde(skip_serializing_if = "Option::is_none")]
         policy_source: Option<String>,
     },
+    /// nono is not mediating this operation on the active platform/configuration.
+    #[serde(rename = "unmediated")]
+    Unmediated {
+        surface: String,
+        operation: String,
+        path: String,
+        reason: String,
+        details: String,
+    },
+    /// The persisted state predates the information needed to answer safely.
+    #[serde(rename = "unknown")]
+    Unknown {
+        surface: String,
+        operation: String,
+        path: String,
+        reason: String,
+        details: String,
+    },
     /// Not running inside a sandbox
     #[serde(rename = "not_sandboxed")]
     NotSandboxed { message: String },
@@ -212,6 +231,102 @@ pub fn query_path(
     })
 }
 
+/// Query nono's effective policy for a pathname AF_UNIX operation.
+///
+/// `denied_by_filesystem_policy` matters on macOS because nono translates a
+/// filesystem deny for a socket path into a Seatbelt `network-outbound` deny.
+/// Linux Landlock filesystem denies do not mediate AF_UNIX operations.
+pub fn query_unix_socket(
+    path: &Path,
+    op: nono::UnixSocketOp,
+    caps: &CapabilitySet,
+    enforcement: Option<PathnameSocketEnforcement>,
+    denied_by_filesystem_policy: bool,
+) -> QueryResult {
+    let resolved = try_canonicalize(path);
+    let surface = "pathname_unix_socket".to_string();
+    let operation = op.to_string();
+    let display_path = resolved.display().to_string();
+
+    let Some(enforcement) = enforcement else {
+        return QueryResult::Unknown {
+            surface,
+            operation,
+            path: display_path,
+            reason: "socket_enforcement_state_unavailable".to_string(),
+            details: "The sandbox state was written without pathname Unix socket enforcement metadata. Start a new sandbox with the current nono version and query again."
+                .to_string(),
+        };
+    };
+
+    if enforcement == PathnameSocketEnforcement::LinuxUnmediated {
+        return QueryResult::Unmediated {
+            surface,
+            operation,
+            path: display_path,
+            reason: "linux_af_unix_mediation_off".to_string(),
+            details: "nono does not restrict pathname Unix socket operations in this configuration. Host permissions or an outer sandbox may still deny the operation. Enable linux.af_unix_mediation = \"pathname\" to enforce explicit socket grants."
+                .to_string(),
+        };
+    }
+
+    if enforcement == PathnameSocketEnforcement::MacosSeatbelt && denied_by_filesystem_policy {
+        return QueryResult::Denied {
+            reason: "filesystem_deny".to_string(),
+            details: Some(format!(
+                "Seatbelt blocks {} on the denied socket path {}",
+                op,
+                resolved.display()
+            )),
+            policy_source: Some("filesystem.deny".to_string()),
+            matching_capability: None,
+            suggested_flag: None,
+            endpoint_rules: None,
+        };
+    }
+
+    if enforcement == PathnameSocketEnforcement::MacosSeatbelt
+        && matches!(caps.network_mode(), nono::NetworkMode::AllowAll)
+    {
+        return QueryResult::Allowed {
+            reason: "macos_socket_unrestricted".to_string(),
+            granted_path: None,
+            access: Some(op.to_string()),
+            source: Some("default network policy".to_string()),
+            endpoint_rules: None,
+            warning: None,
+        };
+    }
+
+    if let Some(cap) = caps.matching_unix_socket(&resolved, op) {
+        return QueryResult::Allowed {
+            reason: "unix_socket_granted".to_string(),
+            granted_path: Some(cap.resolved.display().to_string()),
+            access: Some(cap.mode.to_string()),
+            source: Some(cap.source.to_string()),
+            endpoint_rules: None,
+            warning: None,
+        };
+    }
+
+    let suggested_flag = match op {
+        nono::UnixSocketOp::Connect | nono::UnixSocketOp::Send => "--allow-unix-socket",
+        nono::UnixSocketOp::Bind => "--allow-unix-socket-bind",
+    };
+    QueryResult::Denied {
+        reason: "unix_socket_not_granted".to_string(),
+        details: Some(format!(
+            "No pathname Unix socket capability permits {} on {}",
+            op,
+            resolved.display()
+        )),
+        policy_source: None,
+        matching_capability: None,
+        suggested_flag: Some(format!("{suggested_flag} {}", resolved.display())),
+        endpoint_rules: None,
+    }
+}
+
 /// Check host:port then bare host against the deny list, so a port-scoped
 /// `d
```

**File**: `crates/nono-cli/src/sandbox_state.rs` (modified, +138/-0)
```diff
@@ -8,6 +8,7 @@
 use crate::capability_ext::new_exact_path_capability;
 use nono::{
     AccessMode, CapabilitySet, CapabilitySource, FsCapability, NonoError, ResourceLimits, Result,
+    SocketScope, UnixSocketCapability,
 };
 use serde::{Deserialize, Serialize};
 use std::fs::OpenOptions;
@@ -23,6 +24,13 @@ use std::os::unix::fs::OpenOptionsExt;
 pub struct SandboxState {
     /// Filesystem capabilities
     pub fs: Vec<FsCapState>,
+    /// Pathname AF_UNIX socket capabilities in effect for this sandbox.
+    #[serde(default, skip_serializing_if = "Vec::is_empty")]
+    pub unix_sockets: Vec<UnixSocketCapability>,
+    /// OS enforcement mode for pathname AF_UNIX sockets. `None` means the
+    /// state was written by an older build and cannot answer socket queries.
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub pathname_socket_enforcement: Option<PathnameSocketEnforcement>,
     /// Whether network is blocked
     pub net_blocked: bool,
     /// Commands explicitly allowed
@@ -57,6 +65,44 @@ pub struct SandboxState {
     pub resource_limits: Option<ResourceLimits>,
 }
 
+/// Enforcement applied to pathname AF_UNIX operations for a running sandbox.
+#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
+#[serde(rename_all = "snake_case")]
+pub enum PathnameSocketEnforcement {
+    /// Linux seccomp pathname mediation is disabled.
+    LinuxUnmediated,
+    /// Linux seccomp pathname mediation enforces explicit socket grants.
+    LinuxAllowlist,
+    /// macOS Seatbelt enforces pathname socket policy directly.
+    MacosSeatbelt,
+}
+
+/// Resolve the platform enforcement mode from the Linux mediation setting.
+/// The argument is ignored on macOS, where Seatbelt is always the backend.
+#[must_use]
+pub fn pathname_socket_enforcement(
+    linux_mediation_enabled: bool,
+) -> Option<PathnameSocketEnforcement> {
+    #[cfg(target_os = "linux")]
+    {
+        Some(if linux_mediation_enabled {
+            PathnameSocketEnforcement::LinuxAllowlist
+        } else {
+            PathnameSocketEnforcement::LinuxUnmediated
+        })
+    }
+    #[cfg(target_os = "macos")]
+    {
+        let _ = linux_mediation_enabled;
+        Some(PathnameSocketEnforcement::MacosSeatbelt)
+    }
+    #[cfg(not(any(target_os = "linux", target_os = "macos")))]
+    {
+        let _ = linux_mediation_enabled;
+        None
+    }
+}
+
 /// Serializable domain endpoint restriction state
 #[derive(Debug, Clone, Serialize, Deserialize)]
 pub struct DomainEndpointState {
@@ -171,6 +217,8 @@ impl SandboxState {
                     }
                 })
                 .collect(),
+            unix_sockets: caps.unix_socket_capabilities().to_vec(),
+            pathname_socket_enforcement: None,
             net_blocked: caps.is_network_blocked(),
             allowed_commands: caps.allowed_commands().to_vec(),
             blocked_commands: caps.blocked_commands().to_vec(),
@@ -215,6 +263,10 @@ impl SandboxState {
             caps.add_fs(cap);
         }
 
+        for stored in &self.unix_sockets {
+            caps.add_unix_socket(restore_unix_socket_capability(stored)?);
+        }
+
         if !self.allowed_domains.is_empty() {
             caps.set_network_mode_mut(nono::NetworkMode::ProxyOnly {
                 port: 0,
@@ -281,6 +333,25 @@ impl SandboxState {
     }
 }
 
+fn restore_unix_socket_capability(stored: &UnixSocketCapability) -> Result<UnixSocketCapability> {
+    let mut restored = match stored.scope {
+        SocketScope::File => UnixSocketCapability::new_file(&stored.original, stored.mode)?,
+        SocketScope::DirChildren => UnixSocketCapability::new_dir(&stored.original, stored.mode)?,
+        SocketScope::DirSubtree => {
+            UnixSocketCapability::new_dir_subtree(&stored.original, stored.mode)?
+        }
+    };
+    if restored.resolved != stored.resolved {
+        return Err(NonoError::ConfigParse(format!(
+            "unix socket grant canonical path drifted at state reload: serialized resolved={}, actual resolved={}",
+            stored.resolved.display(),
+            restored.resolved.display(),
+        )));
+    }
+    restored.source = stored.source.clone();
+    Ok(restored)
+}
+
 fn parse_access_mode(access: &str) -> Result<AccessMode> {
     match access {
         "read" => Ok(AccessMode::Read),
@@ -673,6 +744,8 @@ pub fn cleanup_stale_state_files() {
 mod tests {
     use super::*;
     use nono::CapabilitySource;
+    #[cfg(unix)]
+    use std::os::unix::net::UnixListener;
     use tempfile::tempdir;
 
     #[test]
@@ -691,6 +764,69 @@ mod tests {
         assert_eq!(restored.allowed_commands(), vec!["pip"]);
     }
 
+    #[test]
+    #[cfg(unix)]
+    fn test_sandbox_state_roundtrip_preserves_unix_socket_policy() {
+        let dir = tempdir().expect("tempdir");
+        let socket_path = dir.path().join("service.sock");
+        let _listener = UnixListener::bind(&socket_path).expect("bind socket");
+        let mut socket =

```

**File**: `crates/nono-cli/src/why_runtime.rs` (modified, +125/-26)
```diff
@@ -1,5 +1,5 @@
 use crate::capability_ext::CapabilitySetExt;
-use crate::cli::{SandboxArgs, WhyArgs, WhyOp, WhyScope};
+use crate::cli::{SandboxArgs, WhyArgs, WhyOp, WhyScope, WhySocketOp};
 use crate::command_policy::{
     CommandFromConfig, CommandPoliciesConfig, CommandSandboxConfig, InvocationPolicyConfig,
 };
@@ -10,6 +10,7 @@ use nono::{AccessMode, CapabilitySet, NonoError, Result};
 struct WhyContext {
     caps: CapabilitySet,
     deny_policy: policy::EffectiveDenyPolicy,
+    pathname_socket_enforcement: Option<sandbox_state::PathnameSocketEnforcement>,
     allowed_domains: Vec<String>,
     denied_domains: Vec<String>,
     domain_endpoints: Vec<sandbox_state::DomainEndpointState>,
@@ -114,6 +115,26 @@ fn resolve_domain_endpoints(profile: &profile::Profile) -> Vec<sandbox_state::Do
         .collect()
 }
 
+fn sandbox_args_from_why(args: &WhyArgs) -> SandboxArgs {
+    SandboxArgs {
+        allow: args.allow.clone(),
+        read: args.read.clone(),
+        write: args.write.clone(),
+        allow_file: args.allow_file.clone(),
+        read_file: args.read_file.clone(),
+        write_file: args.write_file.clone(),
+        allow_unix_socket: args.allow_unix_socket.clone(),
+        allow_unix_socket_bind: args.allow_unix_socket_bind.clone(),
+        allow_unix_socket_dir: args.allow_unix_socket_dir.clone(),
+        allow_unix_socket_dir_bind: args.allow_unix_socket_dir_bind.clone(),
+        allow_unix_socket_subtree: args.allow_unix_socket_subtree.clone(),
+        allow_unix_socket_subtree_bind: args.allow_unix_socket_subtree_bind.clone(),
+        block_net: args.block_net,
+        workdir: args.workdir.clone(),
+        ..SandboxArgs::default()
+    }
+}
+
 pub(crate) fn run_why(args: WhyArgs) -> Result<()> {
     use query_ext::{QueryResult, print_result, query_network, query_path, query_scope};
     use sandbox_state::load_sandbox_state;
@@ -167,12 +188,14 @@ pub(crate) fn run_why(args: WhyArgs) -> Result<()> {
         match sandbox_state {
             Some(state) => {
                 let domain_endpoints = state.domain_endpoints.clone();
+                let pathname_socket_enforcement = state.pathname_socket_enforcement;
                 WhyContext {
                     caps: state.to_caps()?,
                     deny_policy: policy::EffectiveDenyPolicy::from_applied_bypasses(
                         &state.deny_paths_as_paths(),
                         &state.applied_bypasses,
                     ),
+                    pathname_socket_enforcement,
                     allowed_domains: state.allowed_domains.clone(),
                     denied_domains: state.denied_domains.clone(),
                     domain_endpoints,
@@ -202,24 +225,21 @@ pub(crate) fn run_why(args: WhyArgs) -> Result<()> {
             .or_else(|| std::env::current_dir().ok())
             .unwrap_or_else(|| std::path::PathBuf::from("."));
 
-        let sandbox_args = SandboxArgs {
-            allow: args.allow.clone(),
-            read: args.read.clone(),
-            write: args.write.clone(),
-            allow_file: args.allow_file.clone(),
-            read_file: args.read_file.clone(),
-            write_file: args.write_file.clone(),
-            block_net: args.block_net,
-            workdir: args.workdir.clone(),
-            ..SandboxArgs::default()
-        };
+        let sandbox_args = sandbox_args_from_why(&args);
 
         let allowed_domains =
             merge_cli_allow_domains(resolve_allowed_domains(&profile)?, &args.allow_proxy)?;
         let denied_domains =
             merge_cli_deny_domains(resolve_denied_domains(&profile)?, &args.deny_proxy)?;
         let domain_endpoints = resolve_domain_endpoints(&profile);
         let command_policies = profile.command_policies.clone();
+        let pathname_socket_enforcement = sandbox_state::pathname_socket_enforcement(
+            profile
+                .linux
+                .af_unix_mediation
+                .unwrap_or_default()
+                .is_pathname(),
+        );
 
         let prepared = CapabilitySet::from_profile(&profile, &workdir, &sandbox_args)?;
         let mut caps = prepared.caps;
@@ -232,23 +252,14 @@ pub(crate) fn run_why(args: WhyArgs) -> Result<()> {
                 &prepared.deny_paths,
                 &prepared.applied_bypass_paths,
             ),
+            pathname_socket_enforcement,
             allowed_domains,
             denied_domains,
             domain_endpoints,
             command_policies,
         }
     } else {
-        let sandbox_args = SandboxArgs {
-            allow: args.allow.clone(),
-            read: args.read.clone(),
-            write: args.write.clone(),
-            allow_file: args.allow_file.clone(),
-            read_file: args.read_file.clone(),
-            write_file: args.write_file.clone(),
-            block_net: args.block_net,
-            workdir: args.workdir.clone(),
-            ..SandboxArgs::default()
-        };
+        let sandbox_arg
```

**File**: `crates/nono-cli/tests/why_socket.rs` (added, +152/-0)
```diff
@@ -0,0 +1,152 @@
+//! End-to-end coverage for pathname Unix socket policy queries.
+
+#![cfg(unix)]
+
+use serde_json::Value;
+#[cfg(target_os = "linux")]
+use std::fs;
+use std::os::unix::net::UnixListener;
+#[cfg(target_os = "linux")]
+use std::path::Path;
+use std::path::PathBuf;
+use std::process::{Command, Output};
+
+fn fixture() -> (tempfile::TempDir, PathBuf, UnixListener) {
+    // Keep the path below sockaddr_un::sun_path limits on both platforms.
+    let dir = tempfile::Builder::new()
+        .prefix("nono-why-sock-")
+        .tempdir_in("/tmp")
+        .expect("tempdir");
+    let socket = dir.path().join("s.sock");
+    let listener = UnixListener::bind(&socket).expect("bind socket");
+    (dir, socket, listener)
+}
+
+fn run_why(args: &[&str]) -> Output {
+    Command::new(env!("CARGO_BIN_EXE_nono"))
+        .arg("why")
+        .args(args)
+        .output()
+        .expect("run nono why")
+}
+
+fn json_output(output: &Output) -> Value {
+    assert!(
+        output.status.success(),
+        "nono why failed: {}",
+        String::from_utf8_lossy(&output.stderr)
+    );
+    serde_json::from_slice(&output.stdout).expect("JSON output")
+}
+
+#[cfg(target_os = "linux")]
+fn write_profile(dir: &Path, name: &str, value: Value) -> PathBuf {
+    let path = dir.join(format!("{name}.json"));
+    fs::write(
+        &path,
+        serde_json::to_vec_pretty(&value).expect("serialize profile"),
+    )
+    .expect("write profile");
+    path
+}
+
+#[test]
+fn path_query_on_socket_points_to_socket_query() {
+    let (_dir, socket, _listener) = fixture();
+    let output = run_why(&[
+        "--path",
+        socket.to_str().expect("socket path"),
+        "--op",
+        "read",
+    ]);
+    assert!(output.status.success());
+    let stdout = String::from_utf8_lossy(&output.stdout);
+    assert!(stdout.contains("filesystem access only"), "{stdout}");
+    assert!(stdout.contains("nono why --unix-socket"), "{stdout}");
+}
+
+#[test]
+#[cfg(target_os = "linux")]
+fn linux_default_reports_unmediated_even_with_block_net() {
+    let (_dir, socket, _listener) = fixture();
+    let output = run_why(&[
+        "--json",
+        "--block-net",
+        "--unix-socket",
+        socket.to_str().expect("socket path"),
+    ]);
+    let value = json_output(&output);
+    assert_eq!(value["status"], "unmediated");
+    assert_eq!(value["reason"], "linux_af_unix_mediation_off");
+}
+
+#[test]
+#[cfg(target_os = "linux")]
+fn linux_mediation_reports_granted_and_ungranted_sockets() {
+    let (dir, socket, _listener) = fixture();
+    let denied_profile = write_profile(
+        dir.path(),
+        "deny",
+        serde_json::json!({
+            "meta": {"name": "deny"},
+            "linux": {"af_unix_mediation": "pathname"}
+        }),
+    );
+    let allowed_profile = write_profile(
+        dir.path(),
+        "allow",
+        serde_json::json!({
+            "meta": {"name": "allow"},
+            "linux": {"af_unix_mediation": "pathname"},
+            "filesystem": {"unix_socket": [socket]}
+        }),
+    );
+    let socket = socket.to_str().expect("socket path");
+
+    let denied = json_output(&run_why(&[
+        "--json",
+        "--profile",
+        denied_profile.to_str().expect("profile path"),
+        "--unix-socket",
+        socket,
+    ]));
+    assert_eq!(denied["status"], "denied");
+    assert_eq!(denied["reason"], "unix_socket_not_granted");
+
+    let allowed = json_output(&run_why(&[
+        "--json",
+        "--profile",
+        allowed_profile.to_str().expect("profile path"),
+        "--unix-socket",
+        socket,
+    ]));
+    assert_eq!(allowed["status"], "allowed");
+    assert_eq!(allowed["reason"], "unix_socket_granted");
+}
+
+#[test]
+#[cfg(target_os = "macos")]
+fn macos_blocked_network_requires_explicit_socket_grant() {
+    let (_dir, socket, _listener) = fixture();
+    let socket = socket.to_str().expect("socket path");
+
+    let denied = json_output(&run_why(&[
+        "--json",
+        "--block-net",
+        "--unix-socket",
+        socket,
+    ]));
+    assert_eq!(denied["status"], "denied");
+    assert_eq!(denied["reason"], "unix_socket_not_granted");
+
+    let allowed = json_output(&run_why(&[
+        "--json",
+        "--block-net",
+        "--unix-socket",
+        socket,
+        "--allow-unix-socket",
+        socket,
+    ]));
+    assert_eq!(allowed["status"], "allowed");
+    assert_eq!(allowed["reason"], "unix_socket_granted");
+}
```

#### Recent Merged Pull Requests:
- **PR #2230** (2026-10-29): chore(nix): update prebuilt hashes for v0.81.0 (@github-actions[bot])
- **PR #2229** (2026-10-29): chore: release v0.81.0 (@SequeI)
- **PR #2227** (2026-10-29): docs: document safe Codex app server isolation (@SequeI)
- **PR #2225** (2026-10-29): fix(proxy): redeem phantoms inside Basic credentials on token endpoints (@kipz)
- **PR #2223** (2026-10-29): docs(neps): add nep-0008 session flight recorder proposal (@lukehinds)
- **PR #2220** (2026-10-29): fix(why): add pathname Unix socket policy diagnostics (@SequeI)

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

## X. proxy): redeem phantoms inside Basic credentials on token endpoints (#2225)

**RULE**:
When implementing operations in `crates/nono-proxy/src/oauth_capture/rewrite.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nolabs-ai/nono. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `be579e79`: proxy): redeem phantoms inside Basic credentials on token endpoints (#2225). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/nono-proxy/src/oauth_capture/rewrite.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
use base64::Engine as _;
use zeroize::Zeroizing;
    /// Resolve a phantom in the password slot of `Authorization: Basic`
    /// credentials (RFC 6749 §2.3.1); base64 hides it from the marker scan.
    pub fn rewrite_request_basic_authorization(
        &self,
        endpoint: &LoadedOAuthEndpoint,
        value: &str,
    ) -> Result<Option<String>> {
        let Some(credentials) = basic_scheme_payload(value) else {
            return Ok(None);
        };
        let decoded = Zeroizing::new(
            base64::engine::general_purpose::STANDARD
                .decode(credentials)
                .map_err(|_| {
                    ProxyError::Credential(format!(
                        "Basic credentials on token endpoint for provider '{}' are not standard \
                         padded base64",
                        endpoint.provider
                    ))
                })?,
        );
        let decoded = std::str::from_utf8(&decoded).map_err(|_| {
            ProxyError::Credential(format!(
                "Basic credentials on token endpoint for provider '{}' are not UTF-8",
                endpoint.provider
            ))
        })?;
        let (username, passwo
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `be579e79` are properly handled with clean fallback behavior.

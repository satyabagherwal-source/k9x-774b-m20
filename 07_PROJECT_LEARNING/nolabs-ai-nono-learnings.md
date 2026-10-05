# Forensic Learning Record (Deep Inspection): nolabs-ai/nono

> **Canonical Artifact**: `07_PROJECT_LEARNING/nolabs-ai-nono-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nolabs-ai/nono](https://github.com/nolabs-ai/nono))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:18:41.777Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nolabs-ai/nono`
- **Description**: agent runtime security - zero trust, zero setup, zero latency micro sandboxes
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4335 stars

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
    /// canonical path must match the path serialized in the state file.
    ///
    /// Returns an error if a stored grant fails validation or if the current
    /// filesystem state no longer matches the serialized grant.
    pub fn to_caps(&self) -> Result<CapabilitySet> {
        let mut caps = CapabilitySet::new();

        for fs_cap in &self.fs {
            let access = parse_access_mode(&fs_cap.access)?;
            let source = parse_capability_source(fs_cap.source.as_deref())?;

            let cap = if fs_cap.is_file {
                restore_exact_path_capability(fs_cap, access, &source)?
            } else {
                restore_directory_capability(fs_cap, access, &source)?
            };
            caps.add_fs(cap);
        }

        if !self.allowed_domains.is_empty() {
            caps.set_network_mode_mut(nono::NetworkMode::ProxyOnly {
                port: 0,
                bind_ports: vec![],
            });
        } else {
            caps.set_network_blocked(self.net_blocked);
        }
        for cmd in &self.allowed_commands {
            caps.add_allowed_command(cmd.clone());
        }
        for cmd in &self.blocked_commands {
            caps.add_blocked_command(cmd.clone());
        }

        if let Some(limits) = self.resource_limits {
            caps = caps.with_resource_limits(limits);
        }

        Ok(caps)
    }

    /// Write sandbox state to a file with secure permissions
    ///
    /// # Security
    /// This function implements multiple defenses against temp file attacks:
    /// - Uses `create_new(true)` to fail if file exists (prevents symlink attacks)
    /// - Sets `mode(0o600)` for owner-only read/write permissions (Unix)
    /// - Atomic write operation (no TOCTOU window)
    pub fn write_to_file(&self, path: &std::path::Path) -> Result<()> {
        let json = serde_json::to_string_pretty(self).map_err(|e|
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

### Core Architecture Module: `bindings/c/src/lib.rs`
```
//! C FFI bindings for the nono capability-based sandboxing library.
//!
//! Provides a stable C ABI for any language with C FFI support (Go, Swift,
//! Ruby, Java, C#, Zig, etc.).
//!
//! # Memory ownership
//!
//! - Opaque pointers (`NonoCapabilitySet*`, `NonoQueryContext*`,
//!   `NonoSandboxState*`) are caller-owned. Free with the corresponding
//!   `_free()` function. All `_free()` functions are NULL-safe.
//!
//! - Returned `char*` strings are caller-owned. Free with
//!   `nono_string_free()`. NULL is safe to pass.
//!
//! - `nono_last_error()` returns a caller-owned string. Free with
//!   `nono_string_free()`. Returns NULL if no error has occurred.
//!
//! - Input `const char*` parameters are borrowed. The library copies what
//!   it needs.

pub mod capability_set;
pub mod diagnostic;
pub mod fs_capability;
pub mod query;
pub mod sandbox;
pub mod state;
pub mod types;

use std::cell::RefCell;
use std::ffi::{CStr, CString};
use std::os::raw::c_char;

// Re-export all public FFI symbols so they appear in the cdylib.
pub use capability_set::*;
pub use diagnostic::*;
pub use fs_capability::*;
pub use query::*;
pub use sandbox::*;
pub use state::*;
pub use types::*;

// ---------------------------------------------------------------------------
// Thread-local error store
// ---------------------------------------------------------------------------

thread_local! {
    static LAST_ERROR: RefCell<Option<CString>> = const { RefCell::new(None) };
    static LAST_DIAGNOSTIC_CODE: RefCell<Option<types::NonoDiagnosticCode>> =
        const { RefCell::new(None) };
    static LAST_REMEDIATION_JSON: RefCell<Option<String>> = const { RefCell::new(None) };
}

/// Store an error message for the current thread.
pub(crate) fn set_last_error(msg: &str) {
    LAST_ERROR.with(|cell| {
        let cstr = match CString::new(msg) {
            Ok(s) => s,
            Err(nul_err) => {
                let pos = nul_err.nul_position();
                let mut bytes = nul_err.into_vec();
                bytes.truncate(pos);
                match CString::new(bytes) {
                    Ok(s) => s,
                    Err(_) => return,
                }
            }
        };
        *cell.borrow_mut() = Some(cstr);
    });
}

#[must_use]
pub(crate) fn last_diagnostic_code() -> types::NonoDiagnosticCode {
    LAST_DIAGNOSTIC_CODE.with(|cell| cell.borrow().unwrap_or(types::NonoDiagnosticCode::Other))
}

#[must_use]
pub(crate) fn last_remediation_json() -> Option<String> {
    LAST_REMEDIATION_JSON.with(|cell| cell.borrow().clone())
}

/// Map a `NonoError` to an error code and store the message.
///
/// Every `NonoError` variant is matched explicitly so the compiler will flag
/// new variants that need a mapping, instead of silently falling through to
/// `ErrUnknown`.
pub(crate) fn map_error(e: &nono::NonoError) -> types::NonoErrorCode {
    use types::NonoErrorCode;
    set_last_error(&e.to_string());
    LAST_DIAGNOSTIC_CODE.with(|cell| {
        *cell.borrow_mut() = Some(types::NonoDiagnosticCode::from(e.diagnostic_code()));
    });
    LAST_REMEDIATION_JSON.with(|cell| {
        *cell.borrow_mut() = e
            .remediation()
            .and_then(|rem| serde_json::to_string(&rem).ok());
    });
    match e {
        nono::NonoError::PathNotFound(_) => NonoErrorCode::ErrPathNotFound,
        nono::NonoError::ExpectedDirectory(_) => NonoErrorCode::ErrExpectedDirectory,
        nono::NonoError::ExpectedFile(_) | nono::NonoError::ExpectedUnixSocket(_) => {
            NonoErrorCode::ErrExpectedFile
        }
        nono::NonoError::PathCanonicalization { .. } => NonoErrorCode::ErrPathCanonicalization,
        nono::NonoError::NoCapabilities | nono::NonoError::NoCommand => {
            NonoErrorCode::ErrNoCapabilities
        }
        nono::NonoError::CwdPromptRequired => NonoErrorCode::ErrInvalidArg,
        nono::NonoError::SandboxInit(_) => NonoErrorCode::ErrSandboxInit,
        nono::NonoError::UnsupportedPlatform(_) => NonoErrorCode::ErrUnsupportedPlatform,
        nono::NonoError::BlockedCommand { .. } => NonoErrorCode::ErrBlockedCommand,
        #[cfg(target_os = "linux")]
        nono::NonoError::Landlock(_) | nono::NonoError::LandlockPath(_) => {
            NonoErrorCode::ErrSandboxInit
        }
        nono::NonoError::KeystoreAccess(_) | nono::NonoError::SecretNotFound(_) => {
            NonoErrorCode::ErrIo
        }
        nono::NonoError::ConfigParse(_)
        | nono::NonoError::AttachBusy
        | nono::NonoError::SessionGone
        | nono::NonoError::ConfigWrite { .. }
        | nono::NonoError::ConfigRead { .. } => NonoErrorCode::ErrConfigParse,
        nono::NonoError::ProfileNotFound(_)
        | nono::NonoError::ProfileRead { .. }
        | nono::NonoError::ProfileParse(_)
        | nono::NonoError::ProfileInheritance(_) => NonoErrorCode::ErrProfileParse,
        nono::NonoError::HomeNotFound
        | nono::NonoError::Setup(_)
        | nono::NonoError::LearnError(_)
        | nono::NonoError::HookInstall(_) => NonoErrorCode::ErrConfigParse,
        nono::NonoError::EnvVarValidation { .. } => NonoErrorCode::ErrInvalidArg,
        nono::NonoError::CapFileValidation { .. } | nono::NonoError::CapFileTooLarge { .. } => {
            NonoErrorCode::ErrInvalidArg
        }
        nono::NonoError::VersionDowngrade { .. } => NonoErrorCode::ErrConfigParse,
        nono::NonoError::Io(_) | nono::NonoError::CommandExecution(_) => NonoErrorCode::ErrIo,
        nono::NonoError::ObjectStore(_)
        | nono::NonoError::Snapshot(_)
        | nono::NonoError::AuditLedgerCorrupt { .. }
        | nono::NonoError::HashMismatch { .. }
        | nono::NonoError::SessionNotFound(_) => NonoErrorCode::ErrIo,
        nono::NonoError::TrustVerification { .. }
        | nono::NonoError::TrustSigning { .. }
        | nono::NonoError::TrustPolicy(_)
        | nono::NonoError::BlocklistBlocked { .. }
        | nono::NonoError::InstructionFileDenied { .. }
        | nono::NonoError::AuditSessionOutsideRoot { .. }
        | nono::NonoError::PackageVerification { .. } => NonoErrorCode::ErrTrustVerification,
        nono::NonoError::PackageInstall(_)
        | nono::NonoError::RegistryError(_)
        | nono::NonoError::ActionRequired(_) => NonoErrorCode::ErrConfigParse,
        nono::NonoError::NetworkFilterUnsupported { .. } => NonoErrorCode::ErrUnsupportedPlatform,
        // CLI-only user-cancellation marker. Library callers shouldn't
        // see it through the FFI in normal use, but if they do, surface
        // as an invalid-arg style error code rather than a real fault.
        nono::NonoError::Cancelled(_) => NonoErrorCode::ErrInvalidArg,
    }
}

// ---------------------------------------------------------------------------
// String helpers
// ---------------------------------------------------------------------------

/// Convert a Rust `String` to a caller-owned C string.
///
/// Returns NULL and sets the last error if the string contains an interior
/// NUL byte (which would cause silent truncation in C).
pub(crate) fn rust_string_to_c(s: String) -> *mut c_char {
    match CString::new(s) {
        Ok(cstr) => cstr.into_raw(),
        Err(nul_err) => {
            set_last_error(&format!(
                "string contains interior NUL byte at position {}",
                nul_err.nul_position()
            ));
            std::ptr::null_mut()
        }
    }
}

/// Convert a C string pointer to a Rust `&str`.
///
/// Returns `None` if the pointer is null or the string is not valid UTF-8.
///
/// # Safety
///
/// The pointer must be null or point to a valid null-terminated C string
/// that remains valid for the lifetime `'a`.
pub(crate) unsafe fn c_str_to_str<'a>(ptr: *const c_char) -> Option<&'a str> {
    if ptr.is_null() {
        return None;
    }
    // SAFETY: caller guarantees ptr is a valid null-terminated C string.
    unsafe { CStr::from_ptr(ptr) }.to_str().ok()
}

// ---------------------------------------------------------------------------
// Public FFI: Error and string management
// ---------------------------------------------------------------------------

/// Get the last error message for the current thread.
///
/// Returns a caller-owned copy of the last error message as a
/// null-terminated UTF-8 string, or NULL if no error has occurred.
///
/// Caller must free the returned string with `nono_string_free()`.
#[unsafe(no_mangle)]
pub extern "C" fn nono_last_error() -> *mut c_char {
    LAST_ERROR.with(|cell| {
        let borrow = cell.borrow();
        match borrow.as_ref() {
            Some(cstr) => {
                // Return an independent copy so the caller owns the memory.
                // This avoids dangling pointers if set_last_error() is called
                // before the caller is done with the string.
                match CString::new(cstr.as_bytes().to_vec()) {
                    Ok(copy) => copy.into_raw(),
                    Err(_) => std::ptr::null_mut(),
                }
            }
            None => std::ptr::null_mut(),
        }
    })
}

/// Clear the last error for the current thread.
#[unsafe(no_mangle)]
pub extern "C" fn nono_clear_error() {
    LAST_ERROR.with(|cell| {
        *cell.borrow_mut() = None;
    });
    LAST_DIAGNOSTIC_CODE.with(|cell| {
        *cell.borrow_mut() = None;
    });
    LAST_REMEDIATION_JSON.with(|cell| {
        *cell.borrow_mut() = None;
    });
}

/// Free a string previously returned by a nono FFI function.
///
/// NULL-safe (no-op on NULL). Call this on any string whose documentation
/// says "Caller must free with `nono_string_free()`", including
/// `nono_last_error()` and `nono_version()`.
///
/// # Safety
///
/// `s` must be NULL or a pointer previously returned by a nono FFI function.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_string_free(s: *mut c_char) {
    if !s.is_null() {
        // SAFETY: The pointer was created by CString::into_raw() in this
        // library. The caller is required to only pas
```

### Core Architecture Module: `bindings/c/src/query.rs`
```
//! FFI wrapper for `nono::query::QueryContext`.

use std::os::raw::c_char;

use crate::capability_set::NonoCapabilitySet;
use crate::types::{
    NonoErrorCode, NonoQueryReason, NonoQueryResult, NonoQueryStatus, validate_access_mode,
};
use crate::{c_str_to_str, rust_string_to_c, set_last_error};

/// Opaque handle to a query context.
///
/// Created with `nono_query_context_new()`.
/// Freed with `nono_query_context_free()`.
pub struct NonoQueryContext {
    inner: nono::query::QueryContext,
}

/// Convert a library `QueryResult` to a C-compatible `NonoQueryResult`.
fn query_result_to_c(result: &nono::query::QueryResult) -> NonoQueryResult {
    match result {
        nono::query::QueryResult::Allowed(reason) => match reason {
            nono::query::AllowReason::GrantedPath {
                granted_path,
                access,
            } => NonoQueryResult {
                status: NonoQueryStatus::Allowed,
                reason: NonoQueryReason::GrantedPath,
                granted_path: rust_string_to_c(granted_path.clone()),
                access: rust_string_to_c(access.clone()),
                granted: std::ptr::null_mut(),
                requested: std::ptr::null_mut(),
            },
            nono::query::AllowReason::NetworkAllowed => NonoQueryResult {
                status: NonoQueryStatus::Allowed,
                reason: NonoQueryReason::NetworkAllowed,
                granted_path: std::ptr::null_mut(),
                access: std::ptr::null_mut(),
                granted: std::ptr::null_mut(),
                requested: std::ptr::null_mut(),
            },
        },
        nono::query::QueryResult::Denied(reason) => match reason {
            nono::query::DenyReason::PathNotGranted => NonoQueryResult {
                status: NonoQueryStatus::Denied,
                reason: NonoQueryReason::PathNotGranted,
                granted_path: std::ptr::null_mut(),
                access: std::ptr::null_mut(),
                granted: std::ptr::null_mut(),
                requested: std::ptr::null_mut(),
            },
            nono::query::DenyReason::InsufficientAccess { granted, requested } => NonoQueryResult {
                status: NonoQueryStatus::Denied,
                reason: NonoQueryReason::InsufficientAccess,
                granted_path: std::ptr::null_mut(),
                access: std::ptr::null_mut(),
                granted: rust_string_to_c(granted.clone()),
                requested: rust_string_to_c(requested.clone()),
            },
            nono::query::DenyReason::NetworkBlocked => NonoQueryResult {
                status: NonoQueryStatus::Denied,
                reason: NonoQueryReason::NetworkBlocked,
                granted_path: std::ptr::null_mut(),
                access: std::ptr::null_mut(),
                granted: std::ptr::null_mut(),
                requested: std::ptr::null_mut(),
            },
        },
    }
}

/// Create a query context from a capability set.
///
/// The capability set is cloned internally.
/// Caller must free with `nono_query_context_free()`.
///
/// # Safety
///
/// `caps` must be a valid pointer from `nono_capability_set_new()`.
/// Returns NULL if `caps` is NULL.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_query_context_new(
    caps: *const NonoCapabilitySet,
) -> *mut NonoQueryContext {
    if caps.is_null() {
        return std::ptr::null_mut();
    }
    let caps = unsafe { &*caps };
    let ctx = NonoQueryContext {
        inner: nono::query::QueryContext::new(caps.inner.clone()),
    };
    Box::into_raw(Box::new(ctx))
}

/// Free a query context.
///
/// NULL-safe (no-op on NULL).
///
/// # Safety
///
/// `ctx` must be NULL or a pointer previously returned by
/// `nono_query_context_new()`.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_query_context_free(ctx: *mut NonoQueryContext) {
    if !ctx.is_null() {
        // SAFETY: The pointer was created by Box::into_raw() in
        // nono_query_context_new().
        unsafe {
            drop(Box::from_raw(ctx));
        }
    }
}

/// Query whether a path operation is permitted.
///
/// Writes the result to `out_result`. Returns `Ok` on success.
///
/// Caller must free non-NULL string fields in `out_result` with
/// `nono_string_free()`.
///
/// # Safety
///
/// - `ctx` must be a valid pointer from `nono_query_context_new()`.
/// - `path` must be a valid null-terminated UTF-8 string.
/// - `out_result` must be a valid writable pointer.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_query_context_query_path(
    ctx: *const NonoQueryContext,
    path: *const c_char,
    mode: u32,
    out_result: *mut NonoQueryResult,
) -> NonoErrorCode {
    if ctx.is_null() || out_result.is_null() {
        set_last_error("ctx or out_result pointer is NULL");
        return NonoErrorCode::ErrInvalidArg;
    }

    let access = match validate_access_mode(mode) {
        Some(m) => m,
        None => {
            set_last_error(&format!("invalid access mode: {mode}"));
            return NonoErrorCode::ErrInvalidArg;
        }
    };

    let path_str = match unsafe { c_str_to_str(path) } {
        Some(s) => s,
        None => {
            set_last_error("path is NULL or invalid UTF-8");
            return NonoErrorCode::ErrInvalidArg;
        }
    };

    let ctx = unsafe { &*ctx };
    let result = ctx.inner.query_path(std::path::Path::new(path_str), access);

    // SAFETY: caller guarantees out_result is valid and writable.
    unsafe { *out_result = query_result_to_c(&result) };
    NonoErrorCode::Ok
}

/// Query whether network access is permitted.
///
/// Writes the result to `out_result`. Returns `Ok` on success.
///
/// # Safety
///
/// - `ctx` must be a valid pointer from `nono_query_context_new()`.
/// - `out_result` must be a valid writable pointer.
#[unsafe(no_mangle)]
pub unsafe extern "C" fn nono_query_context_query_network(
    ctx: *const NonoQueryContext,
    out_result: *mut NonoQueryResult,
) -> NonoErrorCode {
    if ctx.is_null() || out_result.is_null() {
        set_last_error("ctx or out_result pointer is NULL");
        return NonoErrorCode::ErrInvalidArg;
    }

    let ctx = unsafe { &*ctx };
    let result = ctx.inner.query_network();

    // SAFETY: caller guarantees out_result is valid and writable.
    unsafe { *out_result = query_result_to_c(&result) };
    NonoErrorCode::Ok
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::capability_set::{
        nono_capability_set_allow_path, nono_capability_set_free, nono_capability_set_new,
        nono_capability_set_set_network_blocked,
    };
    use std::ffi::CString;

    #[test]
    fn test_query_context_lifecycle() {
        let caps = nono_capability_set_new();
        // SAFETY: caps is valid.
        unsafe {
            let ctx = nono_query_context_new(caps);
            assert!(!ctx.is_null());
            nono_query_context_free(ctx);
            nono_capability_set_free(caps);
        }
    }

    #[test]
    fn test_query_context_null_safe() {
        // SAFETY: deliberate NULL.
        unsafe {
            assert!(nono_query_context_new(std::ptr::null()).is_null());
            nono_query_context_free(std::ptr::null_mut());
        }
    }

    #[test]
    fn test_query_network_blocked() {
        let caps = nono_capability_set_new();
        // SAFETY: caps is valid.
        unsafe {
            nono_capability_set_set_network_blocked(caps, true);
            let ctx = nono_query_context_new(caps);

            let mut result = std::mem::zeroed::<NonoQueryResult>();
            let rc = nono_query_context_query_network(ctx, &mut result);
            assert_eq!(rc, NonoErrorCode::Ok);
            assert_eq!(result.status, NonoQueryStatus::Denied);
            assert_eq!(result.reason, NonoQueryReason::NetworkBlocked);

            nono_query_context_free(ctx);
            nono_capability_set_free(caps);
        }
    }

    #[test]
    fn test_query_network_allowed() {
        let caps = nono_capability_set_new();
        // SAFETY: caps is valid.
        unsafe {
            let ctx = nono_query_context_new(caps);

            let mut result = std::mem::zeroed::<NonoQueryResult>();
            let rc = nono_query_context_query_network(ctx, &mut result);
            assert_eq!(rc, NonoErrorCode::Ok);
            assert_eq!(result.status, NonoQueryStatus::Allowed);
            assert_eq!(result.reason, NonoQueryReason::NetworkAllowed);

            nono_query_context_free(ctx);
            nono_capability_set_free(caps);
        }
    }

    #[test]
    fn test_query_path_granted() {
        let caps = nono_capability_set_new();
        let path = CString::new("/tmp").unwrap_or_default();
        // SAFETY: caps and path are valid.
        unsafe {
            nono_capability_set_allow_path(
                caps,
                path.as_ptr(),
                crate::types::NONO_ACCESS_MODE_READ_WRITE,
            );
            let ctx = nono_query_context_new(caps);

            // On macOS /tmp canonicalizes to /private/tmp, so query with
            // the canonical path to match the resolved capability.
            let canonical_tmp =
                std::fs::canonicalize("/tmp").unwrap_or_else(|_| std::path::PathBuf::from("/tmp"));
            let query_str = format!("{}/test.txt", canonical_tmp.display());
            let query_path = CString::new(query_str).unwrap_or_default();
            let mut result = std::mem::zeroed::<NonoQueryResult>();
            let rc = nono_query_context_query_path(
                ctx,
                query_path.as_ptr(),
                crate::types::NONO_ACCESS_MODE_READ,
                &mut result,
            );
            assert_eq!(rc, NonoErrorCode::Ok);
            assert_eq!(result.status, NonoQueryStatus::Allowed);
            assert_eq!(result.re
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2047** (2026-10-02): **fix(supervisor): separate network denial throttling from policy enforcement**
  *Symptoms*: A single shared rate limiter (5 tokens/sec burst, 10 tokens/sec refill) was blocking policy-approved network operations (connects, binds) without recording the denial in the audit log or exposing it via nono why. This causes allowed operations to fail mysteriously, with no diagnostic trail.  This work refactors the network seccomp rate limiter into a dedicated network denial throttle. Previously, rate limiting applied before policy evaluation, causing allowed network operations to fail under load.      - Replace generic rate limiter with `NetworkDenialThrottle` on network notification handlers     - Ensure policy decisions and `EACCES` denials execute unconditionally     - Throttle only audit logging and diagnostic records, aggregating excess denials into a single summary event upon loop completion     - Add `diagnostics.network_denial_audit` profile configuration and CLI flags (`--network-denial-audit-rate`, `--network-denial-audit-burst`) to control how many denied network syscalls are individually recorded during Linux seccomp mediation.     - Add `NetworkDenialAuditConfig` struct and schema validation to `nono-cli`     - Add `--network-denial-audit-rate` and `--network-denial-audit-burst` flags to `nono run`     - Pass resolved `NetworkDenialAuditLimits` down to the supervisor's `NetworkDenialThrottle`     - Enforce validation bounds (rates 1–1,000, bursts 1–10,000)     - Update profile schema and documentatio  ## Linked Issue  <!-- External and agent-prop
  **Post-Mortem & Fix Analysis**:
  > <!-- pr-review-summary -->  ## PR Review Summary  ### Size  | Metric | Value | |--------|-------| | Lines added | +778 | | Lines removed | -27 | | Total changed | 805 | | **Classification** | **Large (> 300 lines)** |  ### Affected crates  - **crates/nono-cli** — CLI changes. Verify argument parsing, flag documentation, and UX behaviour across supported platforms.  ### Blast radius — Moderate  This PR touches: **source code,configuration / policy files**  --- <sub>Updated automatically on each push to this PR.</sub>

- **Issue #2042** (2026-10-01): **fix(linux): honour open ports in proxy fallback**
  *Symptoms*: ## Linked Issue  <!-- External and agent-proposed PRs must reference an existing issue. Maintainer-directed routine PRs may leave this blank and explain the exception in the Summary. -->  Closes #2020  ## Summary  <!-- Briefly describe what this PR does and why. --> The Linux seccomp proxy fallback only allowed connections to the proxy itself, ignoring explicitly granted localhost ports. This caused `--sandbox-policy auto` to deny connections that worked with the Landlock strategy and that `nono why` reported as allowed.  Allow loopback connect and bind operations when their ports are covered by `--open-port`, while continuing to deny the same ports on non-loopback addresses. <!-- ## Agent Disclosure (if applicable)  If this PR is generated by an AI agent, per AGENTS.md you must include: - A statement that the contributor is an agent. - References to relevant files or sections consulted. - Explicit confirmation of compliance with repository requirements. -->  ## Test Plan  <!-- How was this tested? Include relevant commands, test cases, or manual verification steps. --> Added regression coverage for explicit localhost ports and ranges.  Ran a Linux blue/green reproduction:  - The original build denied the localhost connection. - The patched build allowed it. - A non-loopback connection to the same port remained denied.  `cargo fmt` and clippy pass. The broader local suite was limited by expected permission failures from the outer sandbox.  
  **Post-Mortem & Fix Analysis**:
  > <!-- pr-review-summary -->  ## PR Review Summary  ### Size  | Metric | Value | |--------|-------| | Lines added | +72 | | Lines removed | -4 | | Total changed | 76 | | **Classification** | **Medium (50–300 lines)** |  ### Affected crates  - **crates/nono-cli** — CLI changes. Verify argument parsing, flag documentation, and UX behaviour across supported platforms.  ### Blast radius — Contained  This PR touches: **source code**  --- <sub>Updated automatically on each push to this PR.</sub>

- **Issue #2041** (2026-10-01): **fix(macos): allow bypassed sockets under denied directories**
  *Symptoms*:   ## Linked Issue  <!-- External and agent-proposed PRs must reference an existing issue. Maintainer-directed routine PRs may leave this blank and explain the exception in the Summary. -->  Closes #2037   @jshiell let me know if this works now, thanks!  ## Summary  Emit exact Seatbelt network exceptions when a Unix socket grant is paired with bypass protection. Add regression coverage confirming the allowed socket connects while unbypassed and sibling sockets remain denied.  <!-- Briefly describe what this PR does and why. -->  <!-- ## Agent Disclosure (if applicable)  If this PR is generated by an AI agent, per AGENTS.md you must include: - A statement that the contributor is an agent. - References to relevant files or sections consulted. - Explicit confirmation of compliance with repository requirements. -->  ## Test Plan  <!-- How was this tested? Include relevant commands, test cases, or manual verification steps. -->  ## Checklist  - [x] An issue exists and is linked above, or this is maintainer-directed routine work - [x] All commits are signed-off, using [DCO](https://en.wikipedia.org/wiki/Developer_Certificate_of_Origin) - [x] Code changes follow the project's coding standards ([AGENTS.md](../AGENTS.md)) and have appropriate test coverage - [x] Public-facing changes are paired with documentation updates - [ ] If this PR implements a major feature, capability, or security-relevant change, a corresponding accepted NEP is linked  <!
  **Post-Mortem & Fix Analysis**:
  > <!-- pr-review-summary -->  ## PR Review Summary  ### Size  | Metric | Value | |--------|-------| | Lines added | +378 | | Lines removed | -34 | | Total changed | 412 | | **Classification** | **Large (> 300 lines)** |  ### Affected crates  - **crates/nono** (core library) — **careful review required**. This is the security-critical sandbox primitive. A bug here bypasses OS-level isolation for every downstream user. - **crates/nono-cli** — CLI changes. Verify argument parsing, flag documentation, and UX behaviour across supported platforms.  ### Blast radius — Broad  This PR touches: **source code,documentation,configuration / policy files**  --- <sub>Updated automatically on each push to this PR.</sub>
  > @SequeI that allows the socket connection with my Python test case, so looks good.  Thanks very much!

- **Issue #2037** (2026-10-01): **macOS 0.79.0: Unix socket remains blocked with bypass-protection and allow-unix-socket**
  *Symptoms*: ### What happened?  After upgrading to Nono 0.79.0, Git commit signing through the 1Password SSH agent fails inside the sandbox. Reverting to 0.78.0 restores the previous successful commit.  A direct connection to the agent socket fails with 0.79.0 (and succeeds in 0.78.0):  ``` nono run --profile opencode \   --bypass-protection "$HOME/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock" \   --allow-unix-socket "$HOME/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock" \   -- python3 -c 'import socket, sys; s=socket.socket(socket.AF_UNIX); s.connect(sys.argv[1]); print("connected"); s.close()' \   "$HOME/Library/Group Containers/2BUA8C4S2C.com.1password/t/agent.sock" ```  Potentially related: PR #2026 (https://github.com/nolabs-ai/nono/pull/2026), which introduced recursive socket connection denies beneath denied directories.    ### What did you expect to happen?  The explicit bypass and socket grant permits a connection to the SSH agent.  Actual result: PermissionError: [Errno 1] Operation not permitted.  Wider grants, up to including all of `$HOME/Library`, also did not allow the connection.  ### Steps to reproduce  Attached is a standalone synthetic reproducer with control cases, courtesy of Sol 6.1.  [reproduce-socket-connection.py](https://github.com/user-attachments/files/32903260/reproduce-socket-connection.py)  ### Relevant output or logs  ```shell  ```  ### nono version  0.79.0  ### Operating system  macOS  ### OS version / distro  macOS 27.0.
  **Post-Mortem & Fix Analysis**:
  > ## 🛡️ nogent issue triage  **Assessment:** needs-code-change  **Suggested resolution:** Requires a code change in the codebase. Specifically, the macOS Seatbelt profile generator must be updated to ensure that recursive socket deny rules do not override explicit allows or bypass-protection paths.  **Notes for maintainers:** PR #2026 introduced recursive socket connection denies. In macOS Seatbelt, deny rules take precedence over allow rules. If the socket path is under a denied directory, the recursive deny blocks it despite `--allow-unix-socket` or `--bypass-protection`. The generation logic needs to be corrected to handle this precedence or exclude explicitly allowed/bypassed paths.  <sub>Automated triage suggestion. Not a maintainer decision.</sub>

- **Issue #2033** (2026-10-01): **fix(cli): harden approval ids, orphan reaping and lexical why evaluation**
  *Symptoms*: Prevent request ID collisions during concurrent endpoint approval requests by appending an atomic sequence number to generated approval IDs. The TLS interception handler now uses the shared helper instead of building its own formatted IDs.  - Add an atomic counter to `endpoint_approval_request_id` - Make it crate-visible and use it in `tls_intercept/handle.rs` - Add a unit test verifying uniqueness across rapid invocations  cli: orphan reaping Preserve the exit status of owned children when orphans are reaped, so a child we spawned is not reaped away before its status can be collected.  - Track owned children in the new `owned_children` module - Consult it from `exec_strategy` during orphan reaping - Update the Linux tool-sandbox platform and policy code to match  why: lexical evaluation `policy_rule_may_cover` reported a home-relative deny rule as covering any path containing the rule's components in sequence. Under `--lexical-profile-path` there is no `$HOME` to anchor them, so `~/downloads` matched `/var/tmp/downloads/foo` and the query returned a confident `Denied` for a path the rule never covers. A bare `~/` returned covered unconditionally, denying every path without inspecting it.  Both now return `None`, so the query falls through to `lexical_path_pending` and reports `ApprovalRequired`, the honest answer when the deciding context was deliberately withheld. A non-match still returns `Some(false)`, which stays sound because every expansion of `~/downlo
  **Post-Mortem & Fix Analysis**:
  > <!-- pr-review-summary -->  ## PR Review Summary  ### Size  | Metric | Value | |--------|-------| | Lines added | +387 | | Lines removed | -33 | | Total changed | 420 | | **Classification** | **Large (> 300 lines)** |  ### Affected crates  - **crates/nono-proxy** — **downstream consumers depend on this crate**. API or behaviour changes will affect external callers; treat any breaking change with extra scrutiny. - **crates/nono-cli** — CLI changes. Verify argument parsing, flag documentation, and UX behaviour across supported platforms.  ### Blast radius — Contained  This PR touches: **source code**  --- <sub>Updated automatically on each push to this PR.</sub>

- **Issue #2026** (2026-09-30): **fix(macos): recursively block sockets under denied directories**
  *Symptoms*:     ## Summary  Use Seatbelt subpath rules for network-outbound denials when the target is a directory or does not yet exist. Keep exact path rules for leaf targets and share the behavior with protected path enforcement.  Add unit and runtime coverage for nested Unix sockets and document the recursive behavior.  <!-- Briefly describe what this PR does and why. -->  <!-- ## Agent Disclosure (if applicable)  If this PR is generated by an AI agent, per AGENTS.md you must include: - A statement that the contributor is an agent. - References to relevant files or sections consulted. - Explicit confirmation of compliance with repository requirements. -->  ## Test Plan  Added unit tests, verified manually from local binary. <!-- How was this tested? Include relevant commands, test cases, or manual verification steps. -->  ## Checklist  - [ ] An issue exists and is linked above, or this is maintainer-directed routine work - [x] All commits are signed-off, using [DCO](https://en.wikipedia.org/wiki/Developer_Certificate_of_Origin) - [x] Code changes follow the project's coding standards ([AGENTS.md](../AGENTS.md)) and have appropriate test coverage - [x] Public-facing changes are paired with documentation updates - [ ] If this PR implements a major feature, capability, or security-relevant change, a corresponding accepted NEP is linked  <!-- ## Agent Compliance Check (Required for AI/Automated PRs) - [ ] I am not prohibited from contributing under thi
  **Post-Mortem & Fix Analysis**:
  > <!-- pr-review-summary -->  ## PR Review Summary  ### Size  | Metric | Value | |--------|-------| | Lines added | +159 | | Lines removed | -40 | | Total changed | 199 | | **Classification** | **Medium (50–300 lines)** |  ### Affected crates  - **crates/nono-cli** — CLI changes. Verify argument parsing, flag documentation, and UX behaviour across supported platforms.  ### Blast radius — Contained  This PR touches: **source code**  --- <sub>Updated automatically on each push to this PR.</sub>

- **Issue #2020** (2026-10-01): **--network-profile developer blocks localhost connections with --sandbox-policy auto**
  *Symptoms*: ### What happened?  `--network-profile developer` failed with `--sandbox-policy auto` when connecting to localhost, but worked with `--sandbox-policy landlock`.   ### What did you expect to happen?  `--network-profile developer` should work with `--sandbox-policy auto` when connecting to localhost.   ### Steps to reproduce  1. `nono why --host 127.0.0.1 --port 3001 -- --network-profile developer` 2. `nono run --sandbox-policy auto --network-profile developer --open-port 3001 --allow-cwd -vv -- curl http://127.0.0.1:3001/` 3. `nono run --sandbox-policy landlock --network-profile developer --open-port 3001 --allow-cwd -- curl http://127.0.0.1:3001/`   ### Relevant output or logs  ```shell `nono why --host 127.0.0.1 --port 3001 -- --network-profile developer` → ALLOWED   Reason: network_allowed   Access: Connection to 127.0.0.1:3001 would be allowed   `nono run --sandbox-policy auto --network-profile developer --open-port 3001 --allow-cwd -vv -- curl http://127.0.0.1:3001/` → DEBUG Proxy seccomp: denying network syscall nr=42 to family=2 port=3001 loopback=true curl: (7) Failed to connect to 127.0.0.1 port 3001 after 0 ms: Could not connect to server   `nono run --sandbox-policy landlock --network-profile developer --open-port 3001 --allow-cwd -- curl http://127.0.0.1:3001/` → Succeed ```  ### nono version  0.78.0  ### Operating system  Linux  ### OS version / distro  Fedora Kinoite 44  ### Kernel version (Linux only)  7.2.5-200.fc44.x86_64  ### Profile (if relevant)  ```json  `
  **Post-Mortem & Fix Analysis**:
  > ## 🛡️ nogent issue triage  **Assessment:** needs-code-change  **Suggested resolution:** Identify where the seccomp/network syscall filtering is generated for `--sandbox-policy auto` in `crates/nono-cli` or `crates/nono-proxy`, and ensure it receives the permitted ports from `--open-port` and the specified network profile.  **Notes for maintainers:** The debug log shows a seccomp denial (`denying network syscall nr=42 to family=2 port=3001`) during `auto` policy execution, whereas `landlock` policy allows it. This indicates a discrepancy in how the allowed ports configuration is synced with the seccomp/filter runtime when 'auto' (which likely selects a combination of Landlock and Seccomp) is active.  <sub>Automated triage suggestion. Not a maintainer decision.</sub>

- **Issue #2019** (2026-09-30): **fix: file grants negate filesystem.deny - #1949**
  *Symptoms*: ## Linked Issue Closes #1932 Refs #1982 Refs #1949  ## Summary Move macOS keychain authorisation into the CLI per [NEP-0003](https://github.com/nolabs-ai/nono/blob/44c6b0fdefa774fa018689a35dc3f303eebebe70/neps/0003-keychain-authorisation-to-cli.md)  Make `nono why` account for applied bypasses and their access modes  ## Test Plan new tests `make ci`  ## Checklist  - [x] An issue exists and is linked above, or this is maintainer-directed routine work - [x] All commits are signed-off, using [DCO](https://en.wikipedia.org/wiki/Developer_Certificate_of_Origin) - [x] Code changes follow the project's coding standards ([AGENTS.md](../AGENTS.md)) and have appropriate test coverage - [x] Public-facing changes are paired with documentation updates - [x] If this PR implements a major feature, capability, or security-relevant change, a corresponding accepted NEP is linked 
  **Post-Mortem & Fix Analysis**:
  > <!-- pr-review-summary -->  ## PR Review Summary  ### Size  | Metric | Value | |--------|-------| | Lines added | +1731 | | Lines removed | -447 | | Total changed | 2178 | | **Classification** | **Large (> 300 lines)** |  ### Affected crates  - **crates/nono** (core library) — **careful review required**. This is the security-critical sandbox primitive. A bug here bypasses OS-level isolation for every downstream user. - **crates/nono-cli** — CLI changes. Verify argument parsing, flag documentation, and UX behaviour across supported platforms.  ### Blast radius — Moderate  This PR touches: **source code,documentation**  --- <sub>Updated automatically on each push to this PR.</sub>

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

### Incident Patch 1: `8b2f038f` (2026-10-02)
**Commit Message**: feat(tool-sandbox): per-command aws_auth + fix scoped-proxy CA env ordering (#2024)

* feat(tool-sandbox): add aws_auth field to CommandCredentialConfig

Wire the per-command credential path to carry aws_auth from the profile
through to the scoped proxy's CustomCredentialDef. Previously hardcoded
to None (proxy_runtime.rs:1947), so per-command tool-sandbox routes could
not get host-side SigV4 signing — only session-level custom_credentials
carried it.

Changes:
- CommandCredentialConfig gains an optional aws_auth field (command_policy.rs)
- proxy_runtime.rs forwards credential.aws_auth.clone() instead of None
- AwsAuthConfig gains Eq derive (all fields are Option<String>, which is Eq)
  to satisfy CommandCredentialConfig's #[derive(Eq)]

This is the plumbing layer only: the proxy still returns 501 for aws_auth
routes because credential resolution and SigV4 signing are not yet
implemented. Those are the next two layers.

Builds on #1981 (per-command scoped proxies).
Refs: #1987 (per-command aws_auth feature request)

* feat(tool-sandbox): accept aws_auth as an alternative to source/credential_key

The proxy credential validator required source or credential_key for proxy-type
creden

**File**: `Cargo.lock` (modified, +163/-0)
```diff
@@ -385,6 +385,7 @@ checksum = "b8d7b388a9fc3a6db15a5ec778c38b354eff1364882c94d08e0252f7a47dcaa4"
 dependencies = [
  "aws-credential-types",
  "aws-runtime",
+ "aws-sdk-signin",
  "aws-sdk-sso",
  "aws-sdk-ssooidc",
  "aws-sdk-sts",
@@ -396,15 +397,20 @@ dependencies = [
  "aws-smithy-schema",
  "aws-smithy-types",
  "aws-types",
+ "base64-simd",
  "bytes",
  "fastrand",
  "hex",
  "http 1.5.0",
+ "p256",
+ "rand 0.8.7",
  "sha1 0.10.7",
+ "sha2 0.10.9",
  "time",
  "tokio",
  "tracing",
  "url",
+ "uuid",
  "zeroize",
 ]
 
@@ -469,6 +475,32 @@ dependencies = [
  "uuid",
 ]
 
+[[package]]
+name = "aws-sdk-signin"
+version = "1.22.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "3cfba9907bb97689049c3dbe33f2cc93dd3edf26e73f9e475b15115f2736178e"
+dependencies = [
+ "arc-swap",
+ "aws-credential-types",
+ "aws-runtime",
+ "aws-smithy-async",
+ "aws-smithy-http",
+ "aws-smithy-json",
+ "aws-smithy-observability",
+ "aws-smithy-runtime",
+ "aws-smithy-runtime-api",
+ "aws-smithy-schema",
+ "aws-smithy-types",
+ "aws-types",
+ "bytes",
+ "fastrand",
+ "http 0.2.12",
+ "http 1.5.0",
+ "regex-lite",
+ "tracing",
+]
+
 [[package]]
 name = "aws-sdk-sso"
 version = "1.109.0"
@@ -775,6 +807,12 @@ dependencies = [
  "tracing",
 ]
 
+[[package]]
+name = "base16ct"
+version = "0.2.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "4c7f02d4ea65f2c1853089ffd8d2787bdbc63de2f0d29dedbcf8ccdfa0ccd4cf"
+
 [[package]]
 name = "base64"
 version = "0.22.1"
@@ -1329,6 +1367,18 @@ version = "0.2.4"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "460fbee9c2c2f33933d720630a6a0bac33ba7053db5344fac858d4b8952d77d5"
 
+[[package]]
+name = "crypto-bigint"
+version = "0.5.5"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "0dc92fb57ca44df6db8059111ab3af99a63d5d0f8375d9972e319a379c6bab76"
+dependencies = [
+ "generic-array",
+ "rand_core 0.6.4",
+ "subtle",
+ "zeroize",
+]
+
 [[package]]
 name = "crypto-common"
 version = "0.1.7"
@@ -1497,6 +1547,7 @@ source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "9ed9a281f7bc9b7576e61468ba615a66a5c8cfdff42420a70aa82701a3b1e292"
 dependencies = [
  "block-buffer 0.10.4",
+ "const-oid 0.9.6",
  "crypto-common 0.1.7",
  "subtle",
 ]
@@ -1578,12 +1629,46 @@ version = "1.0.20"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "d0881ea181b1df73ff77ffaaf9c7544ecc11e82fba9b5f27b262a3c73a332555"
 
+[[package]]
+name = "ecdsa"
+version = "0.16.9"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "ee27f32b5c5292967d2d4a9d7f1e0b0aed2c15daded5a60300e4abb9d8020bca"
+dependencies = [
+ "der 0.7.10",
+ "digest 0.10.7",
+ "elliptic-curve",
+ "rfc6979",
+ "signature",
+ "spki 0.7.3",
+]
+
 [[package]]
 name = "either"
 version = "1.16.0"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "91622ff5e7162018101f2fea40d6ebf4a78bbe5a49736a2020649edf9693679e"
 
+[[package]]
+name = "elliptic-curve"
+version = "0.13.8"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "b5e6043086bf7973472e0c7dff2142ea0b680d30e18d9cc40f267efbf222bd47"
+dependencies = [
+ "base16ct",
+ "crypto-bigint",
+ "digest 0.10.7",
+ "ff",
+ "generic-array",
+ "group",
+ "pem-rfc7468",
+ "pkcs8",
+ "rand_core 0.6.4",
+ "sec1",
+ "subtle",
+ "zeroize",
+]
+
 [[package]]
 name = "email_address"
 version = "0.2.9"
@@ -1673,6 +1758,16 @@ version = "2.4.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "9f1f227452a390804cdb637b74a86990f2a7d7ba4b7d5693aac9b4dd6defd8d6"
 
+[[package]]
+name = "ff"
+version = "0.13.1"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c0b50bfb653653f9ca9095b427bed08ab8d75a137839d9ad64eb11810d5b6393"
+dependencies = [
+ "rand_core 0.6.4",
+ "subtle",
+]
+
 [[package]]
 name = "find-msvc-tools"
 version = "0.1.9"
@@ -1839,6 +1934,7 @@ checksum = "85649ca51fd72272d7821adaf274ad91c288277713d9c18820d8499a7ff69e9a"
 dependencies = [
  "typenum",
  "version_check",
+ "zeroize",
 ]
 
 [[package]]
@@ -1895,6 +1991,17 @@ dependencies = [
  "regex-syntax",
 ]
 
+[[package]]
+name = "group"
+version = "0.13.0"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "f0f9ef7462f7c099f518d754361858f86d8a07af53ba9af0fe635bbccb151a63"
+dependencies = [
+ "ff",
+ "rand_core 0.6.4",
+ "subtle",
+]
+
 [[package]]
 name = "h2"
 version = "0.4.19"
@@ -3017,6 +3124,18 @@ version = "0.5.2"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "1a80800c0488c3a21695ea981a54918fbb37abf04f4d0720c453632255e2ff0e"
 
+[[package]]
+name = "p256"
+version = "0.13.2"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "c9863ad85fa8f4460f9c48cb909d38a0d689dba1f6f6988a5e3e0d31071bcd4b"
+dependencies = [
+ "ecdsa",
+ "elliptic-curve",
+ "primeorder",
+ "sha2 0.10.9",
+]
+
 [[packag
```

**File**: `crates/nono-cli/data/nono-profile.schema.json` (modified, +8/-1)
```diff
@@ -1661,7 +1661,7 @@
         },
         "env_var": {
           "type": "string",
-          "description": "Environment variable mapped into the child. For local-socket this receives the resolved socket path; for proxy this receives the phantom token."
+          "description": "Environment variable mapped into the child. For local-socket this receives the resolved socket path; for ordinary proxy credentials this receives the phantom token. Optional for aws_auth proxy credentials, which sign requests host-side without delivering a credential variable."
         },
         "upstream": {
           "type": "string",
@@ -1702,6 +1702,13 @@
         "format": {
           "type": "string",
           "description": "Optional literal template for the visible phantom the sandbox sees, with '{}' standing in for a freshly minted random body (e.g. 'sk-ant-oat01-{}'). Lets a client that classifies a credential by sniffing a literal token prefix recognise the phantom. Only valid for ambient credentials."
+        },
+        "aws_auth": {
+          "oneOf": [
+            { "$ref": "#/$defs/AwsAuthConfig" },
+            { "type": "null" }
+          ],
+          "description": "Optional AWS SigV4 signing configuration for proxy credentials. Mutually exclusive with source and credential_key. Does not require env_var."
         }
       }
     },
```

**File**: `crates/nono-cli/src/command_policy.rs` (modified, +141/-4)
```diff
@@ -435,6 +435,18 @@ pub struct CommandCredentialConfig {
     /// sniffing a token prefix still recognises it. `ambient` credentials only.
     #[serde(default, skip_serializing_if = "Option::is_none")]
     pub format: Option<String>,
+    /// Optional AWS SigV4 signing configuration for this per-command credential.
+    ///
+    /// When present, the scoped proxy signs outbound requests with AWS SigV4
+    /// credentials resolved host-side. The child sees only dummy keys; the real
+    /// credential never enters the sandbox. Mutually exclusive with `credential_key`
+    /// and `source` — use one credential mechanism, not multiple.
+    ///
+    /// Previously only available at session level (`network.custom_credentials.<r>.aws_auth`);
+    /// this extends it to per-command tool-sandbox routes, building on the scoped-proxy
+    /// infrastructure from #1981.
+    #[serde(default)]
+    pub aws_auth: Option<nono_proxy::config::AwsAuthConfig>,
 }
 
 impl Default for CommandCredentialConfig {
@@ -454,6 +466,7 @@ impl Default for CommandCredentialConfig {
             tls_client_key: None,
             source: None,
             format: None,
+            aws_auth: None,
         }
     }
 }
@@ -2594,6 +2607,12 @@ fn validate_credential(
                     format!("local-socket credential '{name}' cannot define HTTP proxy fields"),
                 );
             }
+            if credential.aws_auth.is_some() {
+                report.error(
+                    "invalid_credential",
+                    format!("local-socket credential '{name}' cannot define aws_auth (only proxy credentials support it)"),
+                );
+            }
         }
         CommandCredentialType::RawFile => {
             if credential.path.as_deref().unwrap_or_default().is_empty() {
@@ -2628,6 +2647,12 @@ fn validate_credential(
                     format!("raw-file credential '{name}' cannot define HTTP proxy fields"),
                 );
             }
+            if credential.aws_auth.is_some() {
+                report.error(
+                    "invalid_credential",
+                    format!("raw-file credential '{name}' cannot define aws_auth (only proxy credentials support it)"),
+                );
+            }
         }
         CommandCredentialType::Proxy => {
             if credential
@@ -2641,10 +2666,14 @@ fn validate_credential(
                     format!("proxy credential '{name}' must define upstream"),
                 );
             }
-            if credential.env_var.as_deref().unwrap_or_default().is_empty() {
+            if credential.env_var.as_deref().is_some_and(str::is_empty)
+                || (credential.env_var.is_none() && credential.aws_auth.is_none())
+            {
                 report.error(
                     "invalid_credential",
-                    format!("proxy credential '{name}' must define env_var"),
+                    format!(
+                        "proxy credential '{name}' must define a non-empty env_var unless using aws_auth"
+                    ),
                 );
             }
             if credential.path.is_some() || credential.mode.is_some() {
@@ -2661,10 +2690,27 @@ fn validate_credential(
                     ),
                 );
             }
-            if credential.source.is_none() && credential.credential_key.is_none() {
+            if credential.source.is_none()
+                && credential.credential_key.is_none()
+                && credential.aws_auth.is_none()
+            {
+                report.error(
+                    "invalid_credential",
+                    format!(
+                        "proxy credential '{name}' must define source, credential_key, or aws_auth"
+                    ),
+                );
+            }
+            // aws_auth is mutually exclusive with source and credential_key —
+            // same constraint as the session-level config.
+            if credential.aws_auth.is_some()
+                && (credential.source.is_some() || credential.credential_key.is_some())
+            {
                 report.error(
                     "invalid_credential",
-                    format!("proxy credential '{name}' must define source or credential_key"),
+                    format!(
+                        "proxy credential '{name}' cannot combine aws_auth with source or credential_key"
+                    ),
                 );
             }
             if credential.tls_client_cert.is_some() ^ credential.tls_client_key.is_some() {
@@ -2675,6 +2721,47 @@ fn validate_credential(
                     ),
                 );
             }
+            // Replicate the session-level validate_aws_auth checks so malformed
+            // profile/region/service values don't propagate to the signing path.
+            if let Some(ref aws) = credential.aws_auth {
+                if let Some(ref profile) = aws.profile
+                    && (profile.is_empty() || profile.contains(ch
```

**File**: `crates/nono-cli/src/proxy_runtime.rs` (modified, +163/-44)
```diff
@@ -1881,18 +1881,20 @@ fn collect_tool_sandbox_proxy_grants(
                 grant.name
             ))
         })?;
-        let env_var = credential.env_var.clone().ok_or_else(|| {
-            NonoError::ConfigParse(format!(
+        let env_var = credential.env_var.clone();
+        if let Some(env_var) = &env_var {
+            nono::validate_destination_env_var(env_var).map_err(|err| {
+                NonoError::ConfigParse(format!(
+                    "command sandbox proxy credential '{}' has invalid env_var: {err}",
+                    grant.name
+                ))
+            })?;
+        } else if credential.aws_auth.is_none() {
+            return Err(NonoError::ConfigParse(format!(
                 "command sandbox proxy credential '{}' missing env_var",
                 grant.name
-            ))
-        })?;
-        nono::validate_destination_env_var(&env_var).map_err(|err| {
-            NonoError::ConfigParse(format!(
-                "command sandbox proxy credential '{}' has invalid env_var: {err}",
-                grant.name
-            ))
-        })?;
+            )));
+        }
         if let Some(base_url_env_var) = &credential.base_url_env_var {
             nono::validate_destination_env_var(base_url_env_var).map_err(|err| {
                 NonoError::ConfigParse(format!(
@@ -1926,7 +1928,7 @@ fn collect_tool_sandbox_proxy_grants(
             path_replacement: None,
             query_param_name: None,
             proxy: None,
-            env_var: Some(env_var),
+            env_var,
             endpoint_rules: Vec::new(),
             endpoint_policy: Some(endpoint_policy),
             tls_ca: credential
@@ -1950,7 +1952,7 @@ fn collect_tool_sandbox_proxy_grants(
                     crate::policy::expand_path(path).map(|path| path.to_string_lossy().into_owned())
                 })
                 .transpose()?,
-            aws_auth: None,
+            aws_auth: credential.aws_auth.clone(),
             spiffe: None,
             rate_limit: None,
         };
@@ -3324,7 +3326,8 @@ fn extend_scoped_proxy_env(
 }
 
 fn is_scoped_proxy_reserved_env(name: &str) -> bool {
-    matches!(
+    // Proxy transport vars the scoped proxy always owns.
+    if matches!(
         name,
         "HTTP_PROXY"
             | "HTTPS_PROXY"
@@ -3337,31 +3340,66 @@ fn is_scoped_proxy_reserved_env(name: &str) -> bool {
             | "NONO_NO_PROXY"
             | "NONO_PROXY_TOKEN"
             | "NODE_USE_ENV_PROXY"
-            | "SSL_CERT_FILE"
-            | "CURL_CA_BUNDLE"
-            | "NODE_EXTRA_CA_CERTS"
-            | "REQUESTS_CA_BUNDLE"
-            | "GIT_SSL_CAINFO"
-    )
+    ) {
+        return true;
+    }
+    // TLS-intercept CA vars are read from the proxy's own default list rather
+    // than duplicated here: a second hardcoded copy silently drifts (it was
+    // already missing `AWS_CA_BUNDLE`), and a credential route that reuses one
+    // of these names would then collide with the intercept CA path instead of
+    // being rejected.
+    nono_proxy::config::default_intercept_ca_env_vars()
+        .iter()
+        .any(|reserved| reserved == name)
 }
 
 fn scoped_intercept_ca_dir(
     base: Option<&Path>,
     scope_index: usize,
     has_routes: bool,
 ) -> Result<Option<PathBuf>> {
-    let Some(base) = base.filter(|_| has_routes) else {
+    // `base` is only read as a signal that session-level TLS interception is
+    // enabled at all; the scoped bundle deliberately does NOT live under it.
+    let Some(_base) = base.filter(|_| has_routes) else {
         return Ok(None);
     };
-    let dir = base.join(format!("scope-{scope_index}"));
-    std::fs::create_dir_all(&dir).map_err(|err| {
-        NonoError::SandboxInit(format!(
-            "failed to create scoped TLS-intercept dir '{}': {err}",
-            dir.display()
-        ))
-    })?;
-    set_intercept_ca_dir_permissions(&dir)?;
-    Ok(Some(dir))
+    // Write the scoped proxy's CA bundle under `/tmp` rather than under the
+    // session dir (`~/.local/state/nono/sessions/intercept-*/`). The session
+    // dir is inside the protected-root deny (`deny file-read-data (subpath
+    // "~/.local/state/nono")`), and on macOS Seatbelt a deny CANNOT be
+    // overridden by a later allow — even a more specific `literal` allow
+    // (verified with sandbox-exec). So a CA written there is unreadable by
+    // any sandboxed process, regardless of what allow rules are emitted.
+    //
+    // `/tmp` is granted `system_write_macos` and is readable via explicit
+    // grants that `add_proxy_trust_bundle_caps` adds for the child. The
+    // session-level intercept CA path (when active) still lives under the
+    // session dir because the session proxy handles its own Seatbelt grants
+    // before the protected-root deny is emitted.
+    // Use tempfile::Builder for atomic secure directory creation (0o700 from
+    // the start, no TOCTOU window). The prefix is unpredictable (tempfile ad
```

**File**: `crates/nono-cli/src/tool-sandbox/env.rs` (modified, +69/-5)
```diff
@@ -173,13 +173,28 @@ pub(crate) fn apply_export_env(
 /// Replace proxy settings with supervisor-owned values immediately before a
 /// mediated command is launched. The child must not retain the session proxy
 /// credential: it has broader authority than a command-scoped proxy policy.
+///
+/// **Replace, never append.** `env` is a raw `KEY=VALUE` vector handed straight
+/// to `execve`; it does not collapse duplicate keys, and libc `getenv` (plus
+/// CPython's `os.environ`, i.e. botocore) resolves a duplicate to the *first*
+/// entry. An appended override is therefore dead whenever the same name was
+/// already forwarded from the session env, so every name in `vars` is stripped
+/// before it is set. That is wider than `PROXY_CONTROL_ENV`: `vars` comes from
+/// `ProxyHandle::env_vars()`, which also carries the TLS-intercept CA vars
+/// (`SSL_CERT_FILE`, `AWS_CA_BUNDLE`, ...). Deriving the strip set from `vars`
+/// keeps this self-maintaining as `intercept_ca_env_vars` (or a profile's
+/// `tls_intercept.ca_env_vars`) grows. `PROXY_CONTROL_ENV` is still stripped
+/// unconditionally so a session proxy credential cannot survive in a name the
+/// scoped proxy happens not to set.
 pub(crate) fn override_proxy_env(env: &mut Vec<Vec<u8>>, vars: &[(String, String)]) {
     env.retain(|entry| {
-        !PROXY_CONTROL_ENV.iter().any(|name| {
-            entry
-                .strip_prefix(name.as_bytes())
-                .is_some_and(|suffix| suffix.starts_with(b"="))
-        })
+        let Some((name, _)) = split_env_entry(entry) else {
+            return true;
+        };
+        !PROXY_CONTROL_ENV
+            .iter()
+            .any(|control| control.as_bytes() == name)
+            && !vars.iter().any(|(set, _)| set.as_bytes() == name)
     });
     for (name, value) in vars {
         env.push(format!("{name}={value}").into_bytes());
@@ -802,6 +817,55 @@ mod tests {
         assert!(!rendered.iter().any(|entry| entry.starts_with("all_proxy=")));
     }
 
+    #[test]
+    fn scoped_proxy_env_replaces_forwarded_intercept_ca_vars() {
+        // Regression: the scoped CA vars used to be APPENDED after the
+        // session-forwarded ones. `env` goes straight to `execve`, which keeps
+        // duplicates, and libc `getenv` / CPython `os.environ` resolve to the
+        // FIRST entry — so `aws` (botocore) validated TLS against the session
+        // bundle and failed with "SSL validation failed ... [Errno 1]".
+        // A `contains`-style assertion passes even with the bug: the count and
+        // the value together are what matter.
+        const SESSION_CA: &str = "/Users/dev/.local/prisma_certificates.pem";
+        const SCOPED_CA: &str = "/private/tmp/nono-scoped-intercept-1-2-scope-0/intercept-ca.pem";
+        let ca_vars = nono_proxy::config::default_intercept_ca_env_vars();
+        assert!(
+            ca_vars.iter().any(|name| name == "AWS_CA_BUNDLE"),
+            "AWS_CA_BUNDLE must be an intercept-CA var: botocore prefers it over SSL_CERT_FILE"
+        );
+
+        let mut env: Vec<Vec<u8>> = ca_vars
+            .iter()
+            .map(|name| format!("{name}={SESSION_CA}").into_bytes())
+            .collect();
+        env.push(b"PATH=/usr/bin".to_vec());
+        let scoped: Vec<(String, String)> = ca_vars
+            .iter()
+            .map(|name| (name.clone(), SCOPED_CA.to_string()))
+            .collect();
+
+        override_proxy_env(&mut env, &scoped);
+
+        let rendered = rendered(&env);
+        assert!(rendered.contains(&"PATH=/usr/bin".to_string()));
+        assert!(
+            !rendered.iter().any(|entry| entry.contains(SESSION_CA)),
+            "session CA must not survive: {rendered:?}"
+        );
+        for name in &ca_vars {
+            let prefix = format!("{name}=");
+            let matches: Vec<&String> = rendered
+                .iter()
+                .filter(|entry| entry.starts_with(&prefix))
+                .collect();
+            assert_eq!(
+                matches,
+                vec![&format!("{name}={SCOPED_CA}")],
+                "{name} must appear exactly once, set to the scoped CA"
+            );
+        }
+    }
+
     #[test]
     fn inject_url_open_env_covers_allow_launch_services_without_open_urls() {
         let policy = CommandSandboxConfig {
```

**File**: `crates/nono-cli/src/tool-sandbox/platform/macos.rs` (modified, +13/-0)
```diff
@@ -3807,6 +3807,19 @@ fn add_proxy_trust_bundle_caps(
     }
     for path in &state.proxy_trust_bundle_paths {
         caps.add_fs(FsCapability::new_file(path, AccessMode::Read)?);
+        // On macOS, the nono state root (~/.local/state/nono) is protected by a
+        // Seatbelt `(deny file-read-data (subpath ...))` rule. A generic FS cap
+        // is shadowed by this action-specific deny: Seatbelt's action specificity
+        // beats path specificity. The session-level code (proxy_runtime.rs) handles
+        // this by emitting action-matching `file-read-data` / `file-read-metadata`
+        // allows, which are appended after the deny and win by both specificity and
+        // last-match. The child's Seatbelt profile needs the same override.
+        let path_str = crate::policy::path_to_utf8(path)?;
+        let escaped = crate::policy::escape_seatbelt_path(path_str)?;
+        caps.add_platform_rule(format!("(allow file-read-data (literal \"{escaped}\"))"))?;
+        caps.add_platform_rule(format!(
+            "(allow file-read-metadata (literal \"{escaped}\"))"
+        ))?;
     }
     Ok(())
 }
```

**File**: `crates/nono-cli/tests/schema_shape.rs` (modified, +26/-0)
```diff
@@ -597,6 +597,7 @@ fn test_schema_command_policies_match_tool_sandbox_guide_shape() {
         &schema,
         "CommandCredentialConfig",
         &[
+            "aws_auth",
             "base_url_env_var",
             "credential_format",
             "credential_key",
@@ -739,6 +740,31 @@ fn test_schema_command_policies_match_tool_sandbox_guide_shape() {
     );
 }
 
+#[test]
+fn test_schema_validates_command_proxy_credential_with_aws_auth() {
+    let schema = load_schema();
+    let validator = jsonschema::validator_for(&schema).expect("schema compiles");
+    let profile = json!({
+        "command_policies": {
+            "credentials": {
+                "bedrock": {
+                    "type": "proxy",
+                    "upstream": "https://bedrock-runtime.us-east-1.amazonaws.com",
+                    "aws_auth": {
+                        "profile": "production",
+                        "region": "us-east-1",
+                        "service": "bedrock"
+                    }
+                }
+            }
+        }
+    });
+
+    validator
+        .validate(&profile)
+        .expect("command proxy credential with aws_auth should validate");
+}
+
 #[test]
 fn test_schema_credential_route_has_upgrades() {
     let schema = load_schema();
```

**File**: `crates/nono-proxy/Cargo.toml` (modified, +10/-1)
```diff
@@ -39,7 +39,16 @@ urlencoding = "2"
 globset.workspace = true
 
 # AWS SigV4 signing support (smithy-rs, no service SDK required)
-aws-config = { version = "1", features = ["behavior-version-latest"] }
+# `credentials-login` is required to resolve an active `aws login` session
+# (a `~/.aws/config` profile whose chain base is a `LoginSession`). Without it
+# the default provider chain fails with "This behavior requires following cargo
+# feature(s) enabled: credentials-login", so an `aws_auth` route cannot sign for
+# an SSO-logged-in operator — the primary intended use of host-side credential
+# resolution.
+aws-config = { version = "1", features = [
+    "behavior-version-latest",
+    "credentials-login",
+] }
 aws-sigv4 = { version = "1", features = ["sign-http", "http1"] }
 aws-credential-types = { version = "1", features = ["hardcoded-credentials"] }
 
```

---

### Incident Patch 2: `01f7feea` (2026-10-02)
**Commit Message**: fix(supervisor): separate network denial throttling from policy enforcement (#2047)

* fix(supervisor): separate network denial throttling from policy enforcement

Refactor the network seccomp rate limiter into a dedicated network denial throttle. Previously, rate limiting applied before policy evaluation, causing allowed network operations to fail under load.

- Replace generic rate limiter with `NetworkDenialThrottle` on network notification handlers
- Ensure policy decisions and `EACCES` denials execute unconditionally
- Throttle only audit logging and diagnostic records, aggregating excess denials into a single summary event upon loop completion

Signed-off-by: Luke Hinds <[REDACTED_EMAIL]>

* feat(cli): add profile config and CLI flags for network denial audit budget

Add `diagnostics.network_denial_audit` profile configuration and CLI flags (`--network-denial-audit-rate`, `--network-denial-audit-burst`) to control how many denied network syscalls are individually recorded during Linux seccomp mediation.

- Add `NetworkDenialAuditConfig` struct and schema validation to `nono-cli`
- Add `--network-denial-audit-rate` and `--network-denial-audit-burst` flags to `nono run`
- Pass 

**File**: `crates/nono-cli/data/nono-profile.schema.json` (modified, +23/-0)
```diff
@@ -2340,6 +2340,29 @@
         "redaction": {
           "$ref": "#/$defs/RedactionConfig",
           "description": "Extra redaction applied to diagnostic and audit output. Add-only: a profile can widen redaction but cannot stop a secure default from being redacted."
+        },
+        "network_denial_audit": {
+          "$ref": "#/$defs/NetworkDenialAuditConfig",
+          "description": "Budget for recording denied network syscalls individually (Linux seccomp mediation). Does not change enforcement."
+        }
+      }
+    },
+    "NetworkDenialAuditConfig": {
+      "type": "object",
+      "description": "Budget for recording denied network syscalls individually in the audit trail and diagnostics. This is output hygiene, not enforcement: a denied syscall is always denied and an allowed one never consumes budget. Denials beyond the budget are counted and reported in one summary audit event. Overridden per run by --network-denial-audit-rate and --network-denial-audit-burst.",
+      "additionalProperties": false,
+      "properties": {
+        "rate_per_sec": {
+          "type": "integer",
+          "minimum": 1,
+          "maximum": 1000,
+          "description": "Sustained number of denials recorded individually per second. Default 20."
+        },
+        "burst": {
+          "type": "integer",
+          "minimum": 1,
+          "maximum": 10000,
+          "description": "Number of denials that may be recorded individually in one burst. Default 50."
         }
       }
     },
```

**File**: `crates/nono-cli/src/cli.rs` (modified, +73/-0)
```diff
@@ -1994,6 +1994,31 @@ pub struct RunArgs {
     )]
     pub startup_timeout_secs: Option<u64>,
 
+    /// Sustained number of denied network syscalls recorded individually per
+    /// second (default 20). Denials beyond the budget are still denied and are
+    /// reported in one summary audit event. Overrides
+    /// `diagnostics.network_denial_audit.rate_per_sec`.
+    #[arg(
+        long = "network-denial-audit-rate",
+        value_name = "PER_SEC",
+        value_parser = clap::value_parser!(u32)
+            .range(1..=i64::from(crate::profile::NETWORK_DENIAL_AUDIT_MAX_RATE)),
+        help_heading = "OPTIONS"
+    )]
+    pub network_denial_audit_rate: Option<u32>,
+
+    /// Number of denied network syscalls that may be recorded individually in
+    /// one burst (default 50). Overrides
+    /// `diagnostics.network_denial_audit.burst`.
+    #[arg(
+        long = "network-denial-audit-burst",
+        value_name = "COUNT",
+        value_parser = clap::value_parser!(u32)
+            .range(1..=i64::from(crate::profile::NETWORK_DENIAL_AUDIT_MAX_BURST)),
+        help_heading = "OPTIONS"
+    )]
+    pub network_denial_audit_burst: Option<u32>,
+
     /// Disable the audit trail for this session
     #[arg(
         long,
@@ -3425,6 +3450,54 @@ mod tests {
         }
     }
 
+    #[test]
+    fn test_run_network_denial_audit_flags_parse() {
+        let cli = Cli::parse_from([
+            "nono",
+            "run",
+            "--network-denial-audit-rate",
+            "100",
+            "--network-denial-audit-burst",
+            "500",
+            "--",
+            "echo",
+        ]);
+        match cli.command {
+            Commands::Run(args) => {
+                assert_eq!(args.network_denial_audit_rate, Some(100));
+                assert_eq!(args.network_denial_audit_burst, Some(500));
+            }
+            _ => panic!("expected run command"),
+        }
+    }
+
+    #[test]
+    fn test_run_network_denial_audit_flags_default_to_unset() {
+        let cli = Cli::parse_from(["nono", "run", "--", "echo"]);
+        match cli.command {
+            Commands::Run(args) => {
+                assert_eq!(args.network_denial_audit_rate, None);
+                assert_eq!(args.network_denial_audit_burst, None);
+            }
+            _ => panic!("expected run command"),
+        }
+    }
+
+    #[test]
+    fn test_run_network_denial_audit_flags_reject_out_of_range() {
+        for bad in [
+            ["--network-denial-audit-rate", "0"],
+            ["--network-denial-audit-rate", "1001"],
+            ["--network-denial-audit-burst", "0"],
+            ["--network-denial-audit-burst", "10001"],
+            ["--network-denial-audit-rate", "-1"],
+            ["--network-denial-audit-burst", "abc"],
+        ] {
+            let parsed = Cli::try_parse_from(["nono", "run", bad[0], bad[1], "--", "echo"]);
+            assert!(parsed.is_err(), "{bad:?} must be rejected at parse time");
+        }
+    }
+
     #[test]
     fn test_audit_list() {
         let cli = Cli::parse_from(["nono", "audit", "list", "--today"]);
```

**File**: `crates/nono-cli/src/exec_strategy.rs` (modified, +71/-4)
```diff
@@ -387,6 +387,9 @@ pub struct SupervisorConfig<'a> {
     /// Inclusive bind port ranges allowed for seccomp proxy-only fallback.
     #[cfg(target_os = "linux")]
     pub proxy_bind_port_ranges: Vec<(u16, u16)>,
+    /// Budget for recording denied network syscalls individually.
+    #[cfg(target_os = "linux")]
+    pub network_denial_audit: crate::profile::NetworkDenialAuditLimits,
     /// Pathname AF_UNIX socket grants enforced by the seccomp supervisor when
     /// `linux.af_unix_mediation = "pathname"` is enabled. Unused in proxy-only
     /// mode without that opt-in, where AF_UNIX passes through (issue #1901).
@@ -2870,6 +2873,44 @@ fn reap_reparented_orphans(child: Pid) -> Option<WaitStatus> {
 #[cfg(target_os = "linux")]
 #[allow(clippy::too_many_arguments)]
 fn run_supervisor_loop(
+    child: Pid,
+    sock: &mut SupervisorSocket,
+    config: &SupervisorConfig<'_>,
+    startup_timeout: Option<StartupTimeoutConfig<'_>>,
+    seccomp_fd: Option<&OwnedFd>,
+    proxy_seccomp_fd: Option<&OwnedFd>,
+    initial_caps: &[supervisor_linux::InitialCapability],
+    trust_interceptor: Option<crate::trust_intercept::TrustInterceptor>,
+    pty: Option<&mut crate::pty_proxy::PtyProxy>,
+    url_listener: Option<&SupervisorListener>,
+    killed_by_timeout: &mut bool,
+) -> Result<SupervisorLoopResult> {
+    let mut network_throttle =
+        supervisor_linux::NetworkDenialThrottle::new(config.network_denial_audit);
+    let result = run_supervisor_loop_inner(
+        child,
+        sock,
+        config,
+        startup_timeout,
+        seccomp_fd,
+        proxy_seccomp_fd,
+        initial_caps,
+        trust_interceptor,
+        pty,
+        url_listener,
+        killed_by_timeout,
+        &mut network_throttle,
+    );
+    // The loop has several exits (orphan reaping, startup timeout, errors), so
+    // report denials that were enforced but not individually recorded here,
+    // where every exit passes, rather than at any one of them.
+    supervisor_linux::flush_suppressed_network_denials(config, &mut network_throttle);
+    result
+}
+
+#[cfg(target_os = "linux")]
+#[allow(clippy::too_many_arguments)]
+fn run_supervisor_loop_inner(
     child: Pid,
     sock: &mut SupervisorSocket,
     config: &SupervisorConfig<'_>,
@@ -2881,6 +2922,7 @@ fn run_supervisor_loop(
     mut pty: Option<&mut crate::pty_proxy::PtyProxy>,
     url_listener: Option<&SupervisorListener>,
     killed_by_timeout: &mut bool,
+    network_throttle: &mut supervisor_linux::NetworkDenialThrottle,
 ) -> Result<SupervisorLoopResult> {
     struct LoopTimer {
         start: Instant,
@@ -3088,6 +3130,7 @@ fn run_supervisor_loop(
                             trust_interceptor: trust_interceptor.as_mut(),
                             pty: pty.as_deref_mut(),
                         },
+                        &mut *network_throttle,
                         &mut ipc_denials,
                     )
                 {
@@ -3199,7 +3242,7 @@ fn run_supervisor_loop(
                 drain_pending_network_notifications(
                     proxy_notify_raw_fd,
                     config,
-                    &mut rate_limiter,
+                    &mut *network_throttle,
                     &mut denials.fs,
                     &mut ipc_denials,
                 );
@@ -3211,7 +3254,7 @@ fn run_supervisor_loop(
                 drain_pending_network_notifications(
                     proxy_notify_raw_fd,
                     config,
-                    &mut rate_limiter,
+                    &mut *network_throttle,
                     &mut denials.fs,
                     &mut ipc_denials,
                 );
@@ -3239,7 +3282,7 @@ fn run_supervisor_loop(
 fn drain_pending_network_notifications(
     proxy_notify_raw_fd: Option<std::os::fd::RawFd>,
     config: &SupervisorConfig<'_>,
-    rate_limiter: &mut supervisor_linux::RateLimiter,
+    network_throttle: &mut supervisor_linux::NetworkDenialThrottle,
     denials: &mut Vec<DenialRecord>,
     ipc_denials: &mut Vec<nono::diagnostic::IpcDenialRecord>,
 ) {
@@ -3260,7 +3303,7 @@ fn drain_pending_network_notifications(
         if let Err(err) = supervisor_linux::handle_network_notification(
             fd,
             config,
-            rate_limiter,
+            network_throttle,
             denials,
             ipc_denials,
         ) {
@@ -5235,6 +5278,8 @@ mod tests {
             #[cfg(target_os = "linux")]
             proxy_bind_port_ranges: Vec::new(),
             #[cfg(target_os = "linux")]
+            network_denial_audit: crate::profile::NetworkDenialAuditLimits::default(),
+            #[cfg(target_os = "linux")]
             unix_socket_allowlist: &[],
             #[cfg(target_os = "linux")]
             seccomp_policy: SeccompPolicy {
@@ -5364,6 +5409,8 @@ mod tests {
             #[cfg(target_os = "linux")]
             proxy_bind_port_ranges: Vec::new(),
             #[cfg(target_os = "linux")]
+            network_denial_audit: crate::profile
```

**File**: `crates/nono-cli/src/exec_strategy/clone_files/tests.rs` (modified, +6/-0)
```diff
@@ -135,6 +135,7 @@ fn supervise(
         proxy_port: port,
         proxy_bind_ports: vec![bind],
         proxy_bind_port_ranges: vec![],
+        network_denial_audit: crate::profile::NetworkDenialAuditLimits::default(),
         unix_socket_allowlist: caps.unix_socket_capabilities(),
         tool_sandbox_runtime: None,
     };
@@ -151,6 +152,9 @@ fn supervise(
         })
         .collect();
     let mut limiter = supervisor_linux::RateLimiter::new(10000, 10000);
+    let mut network_throttle = supervisor_linux::NetworkDenialThrottle::new(
+        crate::profile::NetworkDenialAuditLimits::default(),
+    );
     let mut denials = vec![];
     let mut ipc_denials = vec![];
     let deadline = Instant::now() + Duration::from_secs(20);
@@ -190,6 +194,7 @@ fn supervise(
                     trust_interceptor: None,
                     pty: None,
                 },
+                &mut network_throttle,
                 &mut ipc_denials,
             )?;
         }
@@ -802,6 +807,7 @@ fn full_cli_supervisor_combined_path() -> Result<()> {
             proxy_port: port,
             proxy_bind_ports: vec![34568],
             proxy_bind_port_ranges: vec![],
+            network_denial_audit: crate::profile::NetworkDenialAuditLimits::default(),
             unix_socket_allowlist: &[],
             tool_sandbox_runtime: None,
         };
```

**File**: `crates/nono-cli/src/exec_strategy/supervisor_linux.rs` (modified, +173/-22)
```diff
@@ -30,7 +30,9 @@ enum InitialCapabilityMatch<'a> {
 /// Token-bucket rate limiter for supervisor expansion requests.
 ///
 /// Prevents a compromised agent from flooding the terminal with approval prompts.
-/// Defaults to 10 requests/second with a burst of 5.
+/// Defaults to 10 requests/second with a burst of 5. It must only gate
+/// decisions that can reach an interactive prompt: applying it to fixed policy
+/// decisions makes allowed operations fail under bursty load.
 pub(super) struct RateLimiter {
     /// Maximum tokens (burst capacity)
     capacity: u32,
@@ -78,6 +80,43 @@ impl RateLimiter {
     }
 }
 
+/// Bounds the bookkeeping a flood of policy-denied network syscalls can create.
+///
+/// This never influences enforcement: a denied syscall is always denied with
+/// `EACCES`, and an allowed syscall never consumes budget. It only decides
+/// whether a denial is recorded individually (audit event and AF_UNIX
+/// diagnostics, both of which grow memory). Denials past the budget are
+/// counted and reported as a single summary audit event, so suppression is
+/// itself observable.
+pub(super) struct NetworkDenialThrottle {
+    limiter: RateLimiter,
+    suppressed: u64,
+}
+
+impl NetworkDenialThrottle {
+    pub(super) fn new(limits: crate::profile::NetworkDenialAuditLimits) -> Self {
+        Self {
+            limiter: RateLimiter::new(limits.rate_per_sec, limits.burst),
+            suppressed: 0,
+        }
+    }
+
+    /// Returns true if this denial should be recorded individually. Otherwise
+    /// it is counted as suppressed.
+    fn admit(&mut self) -> bool {
+        if self.limiter.try_acquire() {
+            true
+        } else {
+            self.suppressed = self.suppressed.saturating_add(1);
+            false
+        }
+    }
+
+    fn take_suppressed(&mut self) -> u64 {
+        std::mem::take(&mut self.suppressed)
+    }
+}
+
 pub(super) struct SeccompNotificationState<'a> {
     pub(super) rate_limiter: &'a mut RateLimiter,
     pub(super) denials: &'a mut Vec<DenialRecord>,
@@ -1008,6 +1047,7 @@ pub(super) fn handle_combined_notification(
     config: &SupervisorConfig<'_>,
     initial_caps: &[InitialCapability],
     state: SeccompNotificationState<'_>,
+    network_throttle: &mut NetworkDenialThrottle,
     ipc_denials: &mut Vec<nono::diagnostic::IpcDenialRecord>,
 ) -> Result<()> {
     let notif = nono::sandbox::recv_notif(notify_fd)?;
@@ -1030,7 +1070,7 @@ pub(super) fn handle_combined_notification(
         handle_received_network_notification(
             notify_fd,
             config,
-            state.rate_limiter,
+            network_throttle,
             state.denials,
             ipc_denials,
             notif,
@@ -1041,15 +1081,15 @@ pub(super) fn handle_combined_notification(
 pub(super) fn handle_network_notification(
     notify_fd: std::os::fd::RawFd,
     config: &SupervisorConfig<'_>,
-    rate_limiter: &mut RateLimiter,
+    network_throttle: &mut NetworkDenialThrottle,
     denials: &mut Vec<DenialRecord>,
     ipc_denials: &mut Vec<nono::diagnostic::IpcDenialRecord>,
 ) -> nono::error::Result<()> {
     let notif = nono::sandbox::recv_notif(notify_fd)?;
     handle_received_network_notification(
         notify_fd,
         config,
-        rate_limiter,
+        network_throttle,
         denials,
         ipc_denials,
         notif,
@@ -1059,7 +1099,7 @@ pub(super) fn handle_network_notification(
 fn handle_received_network_notification(
     notify_fd: std::os::fd::RawFd,
     config: &SupervisorConfig<'_>,
-    rate_limiter: &mut RateLimiter,
+    network_throttle: &mut NetworkDenialThrottle,
     denials: &mut Vec<DenialRecord>,
     ipc_denials: &mut Vec<nono::diagnostic::IpcDenialRecord>,
     notif: nono::sandbox::SeccompNotif,
@@ -1221,14 +1261,6 @@ fn handle_received_network_notification(
         return Ok(());
     }
 
-    // Rate limit: guard AF_UNIX mediation decisions and proxy-mode decisions
-    // against notification flooding from a compromised child.
-    if !rate_limiter.try_acquire() {
-        debug!("Rate limited network seccomp notification, denying");
-        let _ = deny_notif(notify_fd, notif.id);
-        return Ok(());
-    }
-
     // TOCTOU check
     if !notif_id_valid(notify_fd, notif.id)? {
         debug!("Network seccomp notification expired (TOCTOU check)");
@@ -1239,9 +1271,23 @@ fn handle_received_network_notification(
         match decide_network_notification(notif.pid, notif.data.nr, sockaddr, config) {
             NetworkDecision::Allow => {}
             NetworkDecision::Deny => {
-                record_af_unix_ipc_denial(sockaddr, notif.pid, notif.data.nr, denials, ipc_denials);
+                // Enforcement is unconditional: the throttle only bounds how
+                // much bookkeeping this denial may create.
+                let record = network_throttle.admit();
+                if record {
+                    flush_suppressed_network_denials(config, network_throttle);
+    
```

**File**: `crates/nono-cli/src/execution_runtime.rs` (modified, +2/-0)
```diff
@@ -791,6 +791,8 @@ pub(crate) fn execute_sandboxed(plan: LaunchPlan) -> Result<()> {
                 audit_signer: audit_signer.as_ref(),
                 redaction_policy: &flags.redaction_policy,
                 approval_backend,
+                #[cfg(target_os = "linux")]
+                network_denial_audit: flags.network_denial_audit,
                 silent: flags.silent,
             });
 
```

**File**: `crates/nono-cli/src/launch_runtime.rs` (modified, +16/-0)
```diff
@@ -259,6 +259,10 @@ pub(crate) struct ExecutionFlags {
     /// Expanded `environment.set_vars` (key, expanded-value), `None` if absent.
     pub(crate) set_vars: Option<Vec<(String, String)>>,
     pub(crate) startup_timeout_secs: Option<u64>,
+    /// Resolved budget for recording denied network syscalls individually
+    /// (CLI flag, then profile, then default).
+    #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
+    pub(crate) network_denial_audit: crate::profile::NetworkDenialAuditLimits,
     pub(crate) command_policies: Option<crate::command_policy::CommandPoliciesConfig>,
     /// Command binaries already resolved while validating `command_policies`,
     /// reused when building the command-mediation plan instead of re-resolving.
@@ -322,6 +326,11 @@ impl ExecutionFlags {
             case_insensitive_env_vars: prepared.case_insensitive_env_vars,
             set_vars: prepared.set_vars.clone(),
             startup_timeout_secs: None,
+            network_denial_audit: crate::profile::NetworkDenialAuditLimits::resolve(
+                prepared.network_denial_audit,
+                None,
+                None,
+            )?,
             command_policies: prepared.command_policies.clone(),
             resolved_command_binaries: prepared.resolved_command_binaries.clone(),
             approval_backends: prepared.approval_backends.clone(),
@@ -467,6 +476,11 @@ pub(crate) fn prepare_run_launch_plan(
         trust,
         network,
         startup_timeout_secs,
+        network_denial_audit: crate::profile::NetworkDenialAuditLimits::resolve(
+            prepared.network_denial_audit,
+            run_args.network_denial_audit_rate,
+            run_args.network_denial_audit_burst,
+        )?,
         ..ExecutionFlags::from_prepared(&prepared, silent)?
     };
     Ok(LaunchPlan {
@@ -737,6 +751,8 @@ mod tests {
             no_diagnostics: false,
             diagnostics_json: false,
             startup_timeout_secs: None,
+            network_denial_audit_rate: None,
+            network_denial_audit_burst: None,
             no_audit: false,
             no_audit_integrity: false,
             audit_integrity: false,
```

**File**: `crates/nono-cli/src/main.rs` (modified, +2/-0)
```diff
@@ -328,6 +328,7 @@ mod tests {
             ignored_denial_paths: Vec::new(),
             suppressed_system_service_operations: Vec::new(),
             redaction_extra_env_vars: Vec::new(),
+            network_denial_audit: Default::default(),
             redaction_derived_env_vars: Vec::new(),
             allowed_env_vars: None,
             denied_env_vars: None,
@@ -406,6 +407,7 @@ mod tests {
             ignored_denial_paths: Vec::new(),
             suppressed_system_service_operations: Vec::new(),
             redaction_extra_env_vars: Vec::new(),
+            network_denial_audit: Default::default(),
             redaction_derived_env_vars: Vec::new(),
             allowed_env_vars: None,
             denied_env_vars: None,
```

---

### Incident Patch 3: `d34f7a28` (2026-10-01)
**Commit Message**: fix(macos): allow bypassed sockets under denied directories (#2041)

Emit exact Seatbelt network exceptions when a Unix socket grant is paired with bypass protection. Add regression coverage confirming the allowed socket connects while unbypassed and sibling sockets remain denied.

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

**File**: `crates/nono-cli/data/nono-profile.schema.json` (modified, +2/-2)
```diff
@@ -789,7 +789,7 @@
         "unix_socket_bind": {
           "type": "array",
           "items": { "$ref": "#/$defs/ConditionalPath" },
-          "description": "Single AF_UNIX socket paths, connect and bind. Implies read+write access on the socket path when it exists, or on its parent directory when it does not yet exist. Dangling symlinks are rejected at grant time; prefer unix_socket_dir_bind for runtime-generated filenames."
+          "description": "Single AF_UNIX socket paths, connect and bind. Implies read+write access on the socket path when it exists, or on its parent directory when it does not yet exist. A covering deny therefore requires bypassing the parent directory. Dangling symlinks are rejected at grant time; prefer unix_socket_dir_bind for runtime-generated filenames."
         },
         "unix_socket_dir": {
           "type": "array",
@@ -819,7 +819,7 @@
         "bypass_protection": {
           "type": "array",
           "items": { "$ref": "#/$defs/ConditionalPath" },
-          "description": "Paths exempted from group-level deny rules. Each path must also appear in an allow/read/write section to actually grant access; bypass_protection only removes the deny. Supports * (single path segment) and ** (any depth) glob patterns, expanded at sandbox start."
+          "description": "Paths exempted from group-level deny rules. A matching filesystem or Unix socket grant must also provide access; bypass_protection only removes the deny. Supports * (single path segment) and ** (any depth) glob patterns, expanded at sandbox start."
         },
         "suppress_save_prompt": {
           "type": "array",
```

**File**: `crates/nono-cli/data/profile-authoring-guide.md` (modified, +20/-4)
```diff
@@ -338,9 +338,15 @@ All filesystem grants, denials, and deny-rule exemptions live under this single
 | `allow_file`        | array of string | Single files with read+write access. |
 | `read_file`         | array of string | Single files with read-only access. |
 | `write_file`        | array of string | Single files with write-only access. |
+| `unix_socket`       | array of string | Exact existing AF_UNIX socket paths, connect only. Implies read access. |
+| `unix_socket_bind`  | array of string | Exact AF_UNIX socket paths, connect and bind. A future path implies read+write access on its parent directory. |
+| `unix_socket_dir`   | array of string | Connect to direct-child sockets in a directory. Non-recursive. |
+| `unix_socket_dir_bind` | array of string | Connect or bind direct-child sockets in a directory. Non-recursive. |
+| `unix_socket_subtree` | array of string | Connect to descendant sockets recursively. |
+| `unix_socket_subtree_bind` | array of string | Connect or bind descendant sockets recursively. |
 | `deny`              | array of string | Paths denied filesystem access. Supports glob patterns (see below). |
-| `bypass_protection` | array of string | Paths exempted from deny groups. **This flag does not implicitly grant access** — `bypass_protection` only removes the deny rule; each path must also appear in `filesystem.allow`, `filesystem.read`, or `filesystem.write` (or the matching `*_file` variant) to become accessible. Supports glob patterns (see below). |
-| `ignore`            | array of string | Paths whose runtime denials should not be offered in save-profile prompts. Does not grant access or hide diagnostics. |
+| `bypass_protection` | array of string | Paths exempted from deny groups. **This flag does not implicitly grant access** — a matching filesystem or Unix socket field must also grant access. Supports glob patterns (see below). |
+| `suppress_save_prompt` | array of string | Paths whose runtime denials should not be offered in save-profile prompts. Does not grant access or hide diagnostics. |
 
 All path fields support variable expansion (see Section 6).
 
@@ -971,7 +977,7 @@ On Linux, the built-in `default` profile keeps host runtime, sysfs, and shared t
 
 ### Profile with deny overrides
 
-When a deny group blocks a path you need access to, use `filesystem.bypass_protection` together with an explicit grant. Remember: `bypass_protection` only removes the deny rule — it does not grant access on its own.
+When a deny group blocks a path you need access to, use `filesystem.bypass_protection` together with an explicit filesystem or Unix socket grant. Remember: `bypass_protection` only removes the deny rule — it does not grant access on its own.
 
 ```json
 {
@@ -1091,6 +1097,16 @@ Use `filesystem.deny` on the socket path. Seatbelt treats `connect(2)` as a netw
 }
 ```
 
+Denying a directory blocks socket connections recursively below it. To reopen
+one existing socket, pair an exact `unix_socket` entry with the same exact
+`bypass_protection` path; sibling sockets remain denied. Directory socket
+grants preserve their scope when bypassed: `unix_socket_dir` remains
+direct-child-only and `unix_socket_subtree` remains recursive.
+
+Creating a new exact socket with `unix_socket_bind` requires write access to
+its parent directory. If that parent is denied, bypass the parent directory or,
+preferably, use `unix_socket_dir_bind` with a dedicated directory.
+
 #### Linux
 
 Landlock cannot express deny-within-allow, so `filesystem.deny` is a no-op on Linux. Instead, enable `linux.af_unix_mediation` to switch to a default-deny seccomp supervisor for AF_UNIX pathname sockets, then add back only the sockets the agent needs via `filesystem.unix_socket`:
@@ -1330,7 +1346,7 @@ Supported predicate forms include `linux`, `macos`, `linux:fedora`, `linux:rhel-
 ## 9. Key Rules
 
 - A profile with no `groups.include` has no deny rules. Always include appropriate deny groups for untrusted workloads.
-- `filesystem.bypass_protection` only removes the deny rule. It does not grant access. You must also add the path via `filesystem.allow`, `filesystem.read`, or `filesystem.write` (or the matching `*_file` variant).
+- `filesystem.bypass_protection` only removes the deny rule. It does not grant access. A matching filesystem or Unix socket field must also grant the requested access.
 - `filesystem.suppress_save_prompt` only suppresses save-profile suggestions. It does not grant access, remove deny rules, or hide diagnostics.
 - `groups.exclude` removes groups from the resolved set. This weakens the sandbox. Use it only when you understand which protections you are removing.
 - `extends` chains resolve recursively up to depth 10. Circular inheritance is an error.
```

**File**: `crates/nono-cli/src/cli.rs` (modified, +6/-6)
```diff
@@ -1086,8 +1086,8 @@ pub struct SandboxArgs {
     /// If the path exists, implies --allow-file on the socket. If it
     /// does not yet exist (the typical bind(2) case), implies --allow
     /// on the parent directory so the kernel can create the socket
-    /// file. Prefer --allow-unix-socket-dir-bind for runtime-generated
-    /// filenames.
+    /// file. A covering deny therefore requires bypassing the parent.
+    /// Prefer --allow-unix-socket-dir-bind for runtime-generated filenames.
     #[arg(long, value_name = "SOCKET", help_heading = "FILESYSTEM")]
     pub allow_unix_socket_bind: Vec<PathBuf>,
 
@@ -1114,7 +1114,7 @@ pub struct SandboxArgs {
     #[arg(long, value_name = "DIR", help_heading = "FILESYSTEM")]
     pub allow_unix_socket_subtree_bind: Vec<PathBuf>,
 
-    /// Override a deny rule for a path. Pair with --allow/--read/--write grant
+    /// Override a deny rule. Pair with a filesystem or Unix socket grant
     #[arg(
         long = "bypass-protection",
         value_name = "PATH",
@@ -1674,8 +1674,8 @@ pub struct WrapSandboxArgs {
     /// If the path exists, implies --allow-file on the socket. If it
     /// does not yet exist (the typical bind(2) case), implies --allow
     /// on the parent directory so the kernel can create the socket
-    /// file. Prefer --allow-unix-socket-dir-bind for runtime-generated
-    /// filenames.
+    /// file. A covering deny therefore requires bypassing the parent.
+    /// Prefer --allow-unix-socket-dir-bind for runtime-generated filenames.
     #[arg(long, value_name = "SOCKET", help_heading = "FILESYSTEM")]
     pub allow_unix_socket_bind: Vec<PathBuf>,
 
@@ -1702,7 +1702,7 @@ pub struct WrapSandboxArgs {
     #[arg(long, value_name = "DIR", help_heading = "FILESYSTEM")]
     pub allow_unix_socket_subtree_bind: Vec<PathBuf>,
 
-    /// Override a deny rule for a path. Pair with --allow/--read/--write grant
+    /// Override a deny rule. Pair with a filesystem or Unix socket grant
     #[arg(
         long = "bypass-protection",
         value_name = "PATH",
```

**File**: `crates/nono-cli/src/policy.rs` (modified, +129/-5)
```diff
@@ -6,6 +6,8 @@
 use crate::package;
 use crate::profile;
 use nono::{AccessMode, CapabilitySet, CapabilitySource, FsCapability, NonoError, Result};
+#[cfg(target_os = "macos")]
+use nono::{SocketScope, UnixSocketCapability};
 use serde::{Deserialize, Serialize};
 use std::collections::{HashMap, HashSet};
 use std::path::{Path, PathBuf};
@@ -1667,6 +1669,86 @@ pub fn apply_macos_keychain_db_exception(
     }
 }
 
+/// Reopen only the intersection of a bypass and explicit socket grants.
+#[cfg(target_os = "macos")]
+fn emit_macos_socket_bypass_rules(
+    caps: &mut CapabilitySet,
+    canonical: &Path,
+    expanded: &Path,
+    is_file: bool,
+) -> Result<()> {
+    #[derive(Clone, Copy)]
+    enum Filter {
+        Path,
+        Children,
+        Subtree,
+    }
+
+    let socket_caps = caps.unix_socket_capabilities().to_vec();
+    for cap in socket_caps.iter().filter(|cap| cap.source.is_user_intent()) {
+        let Some((filter, mut paths)) =
+            socket_bypass_intersection(cap, canonical, expanded, is_file)
+        else {
+            continue;
+        };
+        paths.sort_unstable();
+        paths.dedup();
+
+        for path in paths {
+            let path = path_to_utf8(&path)?;
+            let filter = match filter {
+                Filter::Path => format!("path \"{}\"", escape_seatbelt_path(path)?),
+                Filter::Children => {
+                    format!("regex #\"^{}/[^/]+$\"", escape_seatbelt_regex_path(path)?)
+                }
+                Filter::Subtree => format!("subpath \"{}\"", escape_seatbelt_path(path)?),
+            };
+            caps.add_platform_rule(format!("(allow network-outbound ({}))", filter))?;
+            if cap.mode.permits_bind() {
+                caps.add_platform_rule(format!("(allow network-bind ({}))", filter))?;
+            }
+        }
+    }
+
+    fn socket_bypass_intersection(
+        cap: &UnixSocketCapability,
+        canonical: &Path,
+        expanded: &Path,
+        is_file: bool,
+    ) -> Option<(Filter, Vec<PathBuf>)> {
+        if is_file {
+            return cap.covers(canonical).then(|| {
+                (
+                    Filter::Path,
+                    vec![canonical.to_path_buf(), expanded.to_path_buf()],
+                )
+            });
+        }
+
+        match cap.scope {
+            SocketScope::File if cap.resolved.starts_with(canonical) => Some((
+                Filter::Path,
+                vec![cap.resolved.clone(), cap.original.clone()],
+            )),
+            SocketScope::DirChildren if cap.resolved.starts_with(canonical) => Some((
+                Filter::Children,
+                vec![cap.resolved.clone(), cap.original.clone()],
+            )),
+            SocketScope::DirSubtree if cap.resolved.starts_with(canonical) => Some((
+                Filter::Subtree,
+                vec![cap.resolved.clone(), cap.original.clone()],
+            )),
+            SocketScope::DirSubtree if canonical.starts_with(&cap.resolved) => Some((
+                Filter::Subtree,
+                vec![canonical.to_path_buf(), expanded.to_path_buf()],
+            )),
+            _ => None,
+        }
+    }
+
+    Ok(())
+}
+
 /// Apply deny overrides for specific paths, punching targeted holes through deny groups.
 ///
 /// For each override path:
@@ -1675,7 +1757,7 @@ pub fn apply_macos_keychain_db_exception(
 /// 3. Removes the path from `deny_paths` so Linux `validate_deny_overlaps` passes
 /// 4. Warns to stderr for each override applied (security relaxation must be visible)
 ///
-/// The override path must also be explicitly granted via `--allow`, `--read`, or `--write`.
+/// The override path must also have an explicit filesystem or Unix socket grant.
 /// `--bypass-protection` only removes the deny; it does not implicitly grant access.
 ///
 /// Returns every applied path form (canonical and, when it differs, the
@@ -1752,8 +1834,7 @@ pub fn apply_deny_overrides(
         if !grant_has_read && !grant_has_write {
             return Err(NonoError::SandboxInit(format!(
                 "bypass_protection '{}' has no matching grant. \
-                 Add a filesystem allow (--allow, --read, --write, or profile filesystem) \
-                 for this path.",
+                 Add a filesystem or Unix socket grant for this path.",
                 override_path.display(),
             )));
         }
@@ -1764,12 +1845,13 @@ pub fn apply_deny_overrides(
             canonical.display()
         );
 
-        let is_file = canonical.is_file();
+        let is_file = !canonical.is_dir();
 
         // On macOS: emit Seatbelt allow rules to punch through deny.
         // Only emit rules matching the effective access mode from the union
         // of all covering grants to preserve least-privilege.
-        if cfg!(target_os = "macos") {
+        #[cfg(target_os = "macos")]
+        {
             // Emit allow rules for both the canonical path and the original
             // expa
```

**File**: `crates/nono-cli/src/profile/mod.rs` (modified, +3/-4)
```diff
@@ -159,6 +159,7 @@ pub struct FilesystemConfig {
     /// Implies read+write access on the socket path when it exists, or
     /// on its parent directory when it does not yet exist (the normal
     /// `bind(2)` workflow — the syscall creates the socket file).
+    /// A covering deny therefore requires bypassing the parent directory.
     /// Dangling symlinks are rejected at grant time. For runtime-generated
     /// filenames (e.g. PID-suffixed paths) prefer `unix_socket_dir_bind`
     /// so the implied fs grant stays scoped to a dedicated directory.
@@ -186,10 +187,8 @@ pub struct FilesystemConfig {
     /// Paths exempted from group-level deny rules.
     ///
     /// **This flag does not implicitly grant access** — `bypass_protection`
-    /// only removes the deny rule. Each path must also appear in
-    /// `filesystem.allow`, `filesystem.read`, or `filesystem.write` (or the
-    /// matching `*_file` variant) to become accessible. CLI equivalent:
-    /// `--bypass-protection`.
+    /// only removes the deny rule. A matching filesystem or Unix socket grant
+    /// must also provide the requested access. CLI equivalent: `--bypass-protection`.
     ///
     /// Renamed from the legacy deny-override key in the #594 schema;
     /// the new name makes the "does not grant access" semantics explicit.
```

**File**: `crates/nono-cli/tests/socket_access_run.rs` (modified, +127/-0)
```diff
@@ -189,6 +189,133 @@ fn filesystem_directory_deny_blocks_nested_unix_socket_connect_on_macos() {
         .assert_stdout_lacks("denied-connected");
 }
 
+#[test]
+#[cfg(target_os = "macos")]
+fn filesystem_directory_deny_allows_only_bypassed_unix_socket_on_macos() {
+    let Some(py) = python3_bin() else {
+        eprintln!("skipping: no system python3 available");
+        return;
+    };
+
+    let t = nono_test!("macos-socket-directory-bypass");
+    let sock_tmp = short_tempdir();
+    let nested = sock_tmp.path().join("nested");
+    std::fs::create_dir(&nested).expect("create nested socket directory");
+    let allowed_path = nested.join("allowed.sock");
+    let sibling_path = nested.join("sibling.sock");
+    let _allowed_listener = UnixListener::bind(&allowed_path).expect("bind allowed socket");
+    let _sibling_listener = UnixListener::bind(&sibling_path).expect("bind sibling socket");
+
+    let denied_dir = sock_tmp.path().to_string_lossy().into_owned();
+    let allowed_arg = allowed_path.to_string_lossy().into_owned();
+    let sibling_arg = sibling_path.to_string_lossy().into_owned();
+    let profile_without_bypass = t.write_profile(
+        "macos-socket-directory-no-bypass",
+        &format!(
+            r#"{{"meta":{{"name":"macos-socket-directory-no-bypass"}},"workdir":{{"access":"readwrite"}},"network":{{"block":true}},"filesystem":{{"deny":["{denied_dir}"],"unix_socket":["{allowed_arg}"]}}}}"#
+        ),
+    );
+    let profile = t.write_profile(
+        "macos-socket-directory-bypass",
+        &format!(
+            r#"{{"meta":{{"name":"macos-socket-directory-bypass"}},"workdir":{{"access":"readwrite"}},"network":{{"block":true}},"filesystem":{{"deny":["{denied_dir}"],"unix_socket":["{allowed_arg}"],"bypass_protection":["{allowed_arg}"]}}}}"#
+        ),
+    );
+
+    let connect = |path: &str| {
+        format!(
+            "import socket; s=socket.socket(socket.AF_UNIX); s.connect({path:?}); print('connected')"
+        )
+    };
+
+    t.run()
+        .profile(&profile_without_bypass)
+        .exec(Argv::new(&py).arg("-c").arg(connect(&allowed_arg)))
+        .assert_failure("socket grant without a bypass remains blocked")
+        .assert_stdout_lacks("connected");
+
+    t.run()
+        .profile(&profile)
+        .exec(Argv::new(&py).arg("-c").arg(connect(&allowed_arg)))
+        .assert_success("explicitly bypassed socket below denied directory is allowed")
+        .assert_stdout_contains("connected");
+
+    t.run()
+        .profile(&profile)
+        .exec(Argv::new(&py).arg("-c").arg(connect(&sibling_arg)))
+        .assert_failure("sibling socket below denied directory remains blocked")
+        .assert_stdout_lacks("connected");
+}
+
+#[test]
+#[cfg(target_os = "macos")]
+fn filesystem_directory_bypass_preserves_unix_socket_scope_on_macos() {
+    let Some(py) = python3_bin() else {
+        eprintln!("skipping: no system python3 available");
+        return;
+    };
+
+    let t = nono_test!("macos-socket-directory-scope-bypass");
+    let sock_tmp = short_tempdir();
+    let nested = sock_tmp.path().join("nested");
+    std::fs::create_dir(&nested).expect("create nested socket directory");
+    let direct_path = sock_tmp.path().join("direct.sock");
+    let sibling_path = sock_tmp.path().join("sibling.sock");
+    let nested_path = nested.join("nested.sock");
+    let _direct_listener = UnixListener::bind(&direct_path).expect("bind direct socket");
+    let _sibling_listener = UnixListener::bind(&sibling_path).expect("bind sibling socket");
+    let _nested_listener = UnixListener::bind(&nested_path).expect("bind nested socket");
+
+    let denied_dir = sock_tmp.path().to_string_lossy().into_owned();
+    let direct_arg = direct_path.to_string_lossy().into_owned();
+    let sibling_arg = sibling_path.to_string_lossy().into_owned();
+    let nested_arg = nested_path.to_string_lossy().into_owned();
+    let dir_profile = t.write_profile(
+        "macos-socket-dir-bypass",
+        &format!(
+            r#"{{"meta":{{"name":"macos-socket-dir-bypass"}},"workdir":{{"access":"readwrite"}},"network":{{"block":true}},"filesystem":{{"deny":["{denied_dir}"],"unix_socket_dir":["{denied_dir}"],"bypass_protection":["{denied_dir}"]}}}}"#
+        ),
+    );
+    let subtree_profile = t.write_profile(
+        "macos-socket-subtree-bypass",
+        &format!(
+            r#"{{"meta":{{"name":"macos-socket-subtree-bypass"}},"workdir":{{"access":"readwrite"}},"network":{{"block":true}},"filesystem":{{"deny":["{denied_dir}"],"unix_socket_subtree":["{denied_dir}"],"bypass_protection":["{denied_dir}"]}}}}"#
+        ),
+    );
+    let exact_profile = t.write_profile(
+        "macos-socket-subtree-exact-bypass",
+        &format!(
+            r#"{{"meta":{{"name":"macos-socket-subtree-exact-bypass"}},"workdir":{{"access":"readwrite"}},"network":{{"block":true}},"filesystem":{{"deny":["{denied_dir}"],"unix_socket_subtree":["{denied_dir}"],"bypass_protection":["{direct
```

**File**: `crates/nono/src/sandbox/macos.rs` (modified, +54/-3)
```diff
@@ -455,6 +455,11 @@ fn emit_unix_socket_rules(profile: &mut String, caps: &CapabilitySet) -> Result<
     Ok(())
 }
 
+fn is_network_platform_rule(rule: &str) -> bool {
+    let rule = rule.trim_start();
+    rule.starts_with("(allow network") || rule.starts_with("(deny network")
+}
+
 fn push_localhost_tcp_outbound_seatbelt_rules(
     profile: &mut String,
     localhost_ports: &[u16],
@@ -703,9 +708,14 @@ fn generate_profile(caps: &CapabilitySet) -> Result<String> {
         }
     }
 
-    // Emit platform rules last so targeted denies win under Seatbelt's
-    // last-rule-wins semantics. See #970.
-    for rule in caps.platform_rules() {
+    // Emit filesystem and other platform rules after their broad grants.
+    // Network rules are emitted after the network section below so socket
+    // denies and their narrower bypasses retain the same ordering.
+    for rule in caps
+        .platform_rules()
+        .iter()
+        .filter(|rule| !is_network_platform_rule(rule))
+    {
         profile.push_str(rule);
         profile.push('\n');
     }
@@ -893,6 +903,15 @@ fn generate_profile(caps: &CapabilitySet) -> Result<String> {
         }
     }
 
+    for rule in caps
+        .platform_rules()
+        .iter()
+        .filter(|rule| is_network_platform_rule(rule))
+    {
+        profile.push_str(rule);
+        profile.push('\n');
+    }
+
     // Per-port TCP rules are not supported on macOS (Seatbelt cannot filter by port alone).
     // ProxyOnly mode IS supported via `(remote tcp "localhost:PORT")`.
     if !caps.tcp_connect_ports().is_empty() || !caps.tcp_bind_ports().is_empty() {
@@ -1821,6 +1840,38 @@ mod tests {
         assert!(!profile.contains("(allow network-outbound)\n"));
     }
 
+    #[test]
+    fn test_generate_profile_socket_deny_and_bypass_follow_socket_grant() {
+        let mut caps = CapabilitySet::new().block_network();
+        caps.add_unix_socket(crate::UnixSocketCapability {
+            original: PathBuf::from("/tmp/sockets"),
+            resolved: PathBuf::from("/private/tmp/sockets"),
+            scope: crate::SocketScope::DirSubtree,
+            mode: crate::UnixSocketMode::Connect,
+            source: CapabilitySource::User,
+        });
+        caps.add_platform_rule("(deny network-outbound (subpath \"/private/tmp/sockets\"))")
+            .unwrap();
+        caps.add_platform_rule(
+            "(allow network-outbound (path \"/private/tmp/sockets/allowed.sock\"))",
+        )
+        .unwrap();
+
+        let profile = generate_profile(&caps).unwrap();
+        let grant = profile
+            .find("(allow network-outbound (subpath \"/private/tmp/sockets\"))")
+            .expect("socket grant");
+        let deny = profile
+            .find("(deny network-outbound (subpath \"/private/tmp/sockets\"))")
+            .expect("socket deny");
+        let bypass = profile
+            .find("(allow network-outbound (path \"/private/tmp/sockets/allowed.sock\"))")
+            .expect("socket bypass");
+
+        assert!(grant < deny, "targeted deny must follow broad socket grant");
+        assert!(deny < bypass, "socket bypass must follow targeted deny");
+    }
+
     /// Regression: Connect-only mode must emit `network-outbound` but
     /// NOT `network-bind`. bind(2) stays denied by the base
     /// `(deny network*)` clause — this is the separate-read-write
```

**File**: `docs/cli/features/profile-authoring.mdx` (modified, +3/-1)
```diff
@@ -433,7 +433,9 @@ nono why --scope abstract-unix-socket --profile my-agent
 ```
 
 <Note>
-  `filesystem.bypass_protection` only removes the deny rule. You must also grant access via `filesystem.allow`, `filesystem.read`, or `filesystem.write` (or the matching `*_file` variant) for the path to be accessible.
+  `filesystem.bypass_protection` only removes the deny rule. A matching
+  filesystem or Unix socket field must also grant the requested access. The
+  `unix_socket*` fields add their required filesystem grant automatically.
 </Note>
 
 ### Suppressing Repeated Save Suggestions
```

---

### Incident Patch 4: `32c89336` (2026-10-01)
**Commit Message**: fix(linux): honour open ports in proxy fallback (#2042)

* fix(linux): honour open ports in proxy fallback

Signed-off-by: Mate Saary <[REDACTED_EMAIL]>

* fix(linux): honor capability ranges when binding

Signed-off-by: Mate Saary <[REDACTED_EMAIL]>

---------

Signed-off-by: Mate Saary <[REDACTED_EMAIL]>

**File**: `crates/nono-cli/src/exec_strategy/supervisor_linux.rs` (modified, +72/-4)
```diff
@@ -733,8 +733,10 @@ pub(super) fn network_notification_out_of_scope(policy: SeccompPolicy, family: u
 ///    (addrlen == 2) have no path to check.
 ///
 /// 2. For `AF_INET`/`AF_INET6` in proxy-only mode:
-///    - `connect()` is allowed only to `127.0.0.1:proxy_port` (the nono proxy).
-///    - `bind()` is allowed on ports in `proxy_bind_ports` or within any range in `proxy_bind_port_ranges`.
+///    - `connect()` is allowed to `127.0.0.1:proxy_port` (the nono proxy) or
+///      to an explicitly granted localhost IPC port.
+///    - `bind()` is allowed on ports in `proxy_bind_ports` or explicitly
+///      granted localhost IPC ports and ranges.
 ///    - Everything else is denied.
 pub(super) fn decide_network_notification(
     child_pid: u32,
@@ -786,10 +788,18 @@ pub(super) fn decide_network_notification(
 
     match syscall {
         SYS_CONNECT | SYS_SENDTO | SYS_SENDMSG | SYS_SENDMMSG => {
-            // Allow connect/sendto/sendmsg/sendmmsg only to loopback + proxy port.
+            // Allow connect/sendto/sendmsg/sendmmsg only to loopback + proxy port
+            // or an explicit bidirectional localhost IPC grant (`--open-port`).
             // sendto/sendmsg/sendmmsg with a destination address is semantically
             // equivalent to connect for network reach-out (issue #1089).
-            if sockaddr.is_loopback && sockaddr.port == config.proxy_port {
+            let allowed_port = sockaddr.port == config.proxy_port
+                || config.caps.localhost_ports().contains(&sockaddr.port)
+                || config
+                    .caps
+                    .localhost_port_ranges()
+                    .iter()
+                    .any(|&(start, end)| sockaddr.port >= start && sockaddr.port <= end);
+            if sockaddr.is_loopback && allowed_port {
                 debug!(
                     "Proxy seccomp: allowing network syscall nr={} to loopback:{}",
                     syscall, sockaddr.port
@@ -806,6 +816,12 @@ pub(super) fn decide_network_notification(
         SYS_BIND => {
             let port = sockaddr.port;
             let allowed = config.proxy_bind_ports.contains(&port)
+                || config.caps.localhost_ports().contains(&port)
+                || config
+                    .caps
+                    .localhost_port_ranges()
+                    .iter()
+                    .any(|&(start, end)| port >= start && port <= end)
                 || config
                     .proxy_bind_port_ranges
                     .iter()
@@ -2151,6 +2167,58 @@ mod tests {
             );
         }
 
+        /// Regression test for issue #2020: seccomp proxy fallback must preserve
+        /// bidirectional localhost grants that Landlock already honors.
+        #[test]
+        fn proxy_only_allows_explicit_localhost_ports_and_ranges() {
+            let backend = DenyAllBackend;
+            let mut caps = nono::CapabilitySet::default();
+            caps.add_localhost_port(3001);
+            caps.add_localhost_port_range(4000, 4002)
+                .expect("valid localhost port range");
+            let mut config = make_proxy_only_config(&backend, 8080, Vec::new());
+            config.caps = &caps;
+
+            for port in [3001, 4000, 4002] {
+                assert_eq!(
+                    decide_network_notification(
+                        test_pid(),
+                        SYS_CONNECT,
+                        &inet_loopback(port),
+                        &config
+                    ),
+                    NetworkDecision::Allow,
+                    "loopback connect to explicitly open port {port} must be allowed"
+                );
+                assert_eq!(
+                    decide_network_notification(
+                        test_pid(),
+                        SYS_BIND,
+                        &inet_loopback(port),
+                        &config
+                    ),
+                    NetworkDecision::Allow,
+                    "bind to explicitly open port {port} must be allowed"
+                );
+                assert_eq!(
+                    decide_network_notification(
+                        test_pid(),
+                        SYS_CONNECT,
+                        &inet_external(port),
+                        &config
+                    ),
+                    NetworkDecision::Deny,
+                    "open-port must not authorize an external destination on port {port}"
+                );
+            }
+
+            assert_eq!(
+                decide_network_notification(test_pid(), SYS_CONNECT, &inet_loopback(4003), &config),
+                NetworkDecision::Deny,
+                "a port outside the explicit range must remain denied"
+            );
+        }
+
         /// Full truth table for the scope predicate shared by the policy
         /// decision and the rate-limiter bypass.
         #[test]
```

---

### Incident Patch 5: `7a98f3e8` (2026-10-01)
**Commit Message**: fix(cli): harden approval ids, orphan reaping and lexical why evaluation (#2033)

Prevent request ID collisions during concurrent endpoint approval requests
by appending an atomic sequence number to generated approval IDs. The TLS
interception handler now uses the shared helper instead of building its own
formatted IDs.

- Add an atomic counter to `endpoint_approval_request_id`
- Make it crate-visible and use it in `tls_intercept/handle.rs`
- Add a unit test verifying uniqueness across rapid invocations

cli: orphan reaping
Preserve the exit status of owned children when orphans are reaped, so a
child we spawned is not reaped away before its status can be collected.

- Track owned children in the new `owned_children` module
- Consult it from `exec_strategy` during orphan reaping
- Update the Linux tool-sandbox platform and policy code to match

why: lexical evaluation
`policy_rule_may_cover` reported a home-relative deny rule as covering any
path containing the rule's components in sequence. Under
`--lexical-profile-path` there is no `$HOME` to anchor them, so
`~/downloads` matched `/var/tmp/downloads/foo` and the query returned a
confident `Denied` for a path the rule never covers

**File**: `crates/nono-cli/src/exec_strategy.rs` (modified, +143/-8)
```diff
@@ -21,6 +21,8 @@ use crate::startup_prompt::{notify_startup_termination_for_child, print_terminal
 use crate::{DETACHED_CWD_PROMPT_RESPONSE_ENV, DETACHED_LAUNCH_ENV, DETACHED_SESSION_ID_ENV};
 use nix::libc;
 use nix::sys::signal::{self, Signal};
+#[cfg(target_os = "linux")]
+use nix::sys::wait::{Id, waitid};
 use nix::sys::wait::{WaitPidFlag, WaitStatus, waitpid};
 use nix::unistd::{ForkResult, Pid, fork};
 use nono::supervisor::{ApprovalDecision, AuditEntry, SupervisorMessage, SupervisorResponse};
@@ -2800,25 +2802,47 @@ type SupervisorLoopResult = (
 /// Reap descendants that reparented onto this supervisor (a child-subreaper),
 /// so short-lived detached processes don't linger as zombies for the session.
 ///
-/// `waitpid(-1, WNOHANG)` returns only terminated children, so a live child is
-/// never consumed. If the primary `child` is reaped here, its status is
-/// returned rather than dropped.
+/// Each terminated child is first observed with `WNOWAIT` and only then reaped
+/// by pid. Children registered in [`crate::owned_children`] belong to another
+/// supervisor thread that waits on them itself, so they are left alone;
+/// consuming their status here would make that thread's wait fail with
+/// `ECHILD`. If the primary `child` is reaped here, its status is returned
+/// rather than dropped.
 #[cfg(target_os = "linux")]
 fn reap_reparented_orphans(child: Pid) -> Option<WaitStatus> {
+    // Held for the whole drain so a concurrent spawn cannot produce a child
+    // that is terminated but not yet registered.
+    let owned = crate::owned_children::lock();
     loop {
-        match waitpid(Some(Pid::from_raw(-1)), Some(WaitPidFlag::WNOHANG)) {
-            Ok(status @ (WaitStatus::Exited(pid, _) | WaitStatus::Signaled(pid, _, _))) => {
+        let flags = WaitPidFlag::WEXITED | WaitPidFlag::WNOHANG | WaitPidFlag::WNOWAIT;
+        let pid = match waitid(Id::All, flags) {
+            Ok(WaitStatus::Exited(pid, _) | WaitStatus::Signaled(pid, _, _)) => pid,
+            // Nothing reapable now; no WSTOPPED/WCONTINUED, so ignore stop/continue.
+            Ok(_) => return None,
+            Err(nix::errno::Errno::EINTR) => continue,
+            Err(nix::errno::Errno::ECHILD) => return None,
+            Err(e) => {
+                debug!("waitid(P_ALL) during orphan reap failed: {}", e);
+                return None;
+            }
+        };
+        // `waitid(P_ALL)` keeps reporting the same terminated child until it
+        // is reaped, so stop draining and let its owner collect it. Remaining
+        // orphans are reaped on a later supervisor loop iteration.
+        if pid != child && u32::try_from(pid.as_raw()).is_ok_and(|raw| owned.contains(&raw)) {
+            return None;
+        }
+        match waitpid(pid, Some(WaitPidFlag::WNOHANG)) {
+            Ok(status @ (WaitStatus::Exited(..) | WaitStatus::Signaled(..))) => {
                 if pid == child {
                     return Some(status);
                 }
                 debug!("Reaped reparented orphan {}", pid);
             }
-            // Nothing reapable now; no WUNTRACED/WCONTINUED, so ignore stop/continue.
             Ok(_) => return None,
             Err(nix::errno::Errno::EINTR) => continue,
-            Err(nix::errno::Errno::ECHILD) => return None,
             Err(e) => {
-                debug!("waitpid(-1) during orphan reap failed: {}", e);
+                debug!("waitpid({}) during orphan reap failed: {}", pid, e);
                 return None;
             }
         }
@@ -6041,3 +6065,114 @@ mod tests {
         assert!(result.is_err(), "data: URLs must be rejected");
     }
 }
+
+/// These tests call the wildcard orphan reaper, which would steal children
+/// from tests running concurrently in the same process. Each one re-runs
+/// itself alone in a fresh test process.
+#[cfg(all(test, target_os = "linux"))]
+mod orphan_reap_tests {
+    use super::*;
+
+    const ISOLATED_ENV: &str = "NONO_ORPHAN_REAP_TEST";
+
+    fn isolated(name: &str, test: impl FnOnce()) {
+        if std::env::var(ISOLATED_ENV).ok().as_deref() == Some(name) {
+            test();
+            return;
+        }
+        let executable = std::env::current_exe().expect("test executable");
+        let status = Command::new(executable)
+            .args([
+                "--exact",
+                &format!("exec_strategy::orphan_reap_tests::{name}"),
+                "--nocapture",
+                "--test-threads=1",
+            ])
+            .env(ISOLATED_ENV, name)
+            .status()
+            .expect("run isolated test");
+        assert!(status.success(), "isolated {name}: {status}");
+    }
+
+    /// Block until `pid` has terminated, without reaping it.
+    fn wait_until_terminated(pid: u32) {
+        let pid = Pid::from_raw(i32::try_from(pid).expect("pid fits i32"));
+        waitid(Id::Pid(pid), WaitPidFlag::WEXITED | WaitPidFlag::WNOWAIT)
+            .expect("observe child exit");
+    }
+
+    fn
```

**File**: `crates/nono-cli/src/main.rs` (modified, +1/-0)
```diff
@@ -40,6 +40,7 @@ mod migration;
 mod network_policy;
 mod open_url_runtime;
 mod output;
+mod owned_children;
 mod pack_update_hint;
 mod package;
 mod package_cmd;
```

**File**: `crates/nono-cli/src/owned_children.rs` (added, +100/-0)
```diff
@@ -0,0 +1,100 @@
+//! Registry of supervisor children that a supervisor thread waits on itself.
+//!
+//! The Linux supervisor is a child subreaper and drains reparented orphans with
+//! a wildcard wait. A wildcard wait would also consume the exit status of
+//! children that other supervisor threads spawned and are about to wait on
+//! (command-mediation launches, supervisor credential sources), making their
+//! `wait()` fail with `ECHILD`. Children spawned through [`spawn`] are
+//! registered before the registry lock is released, and the orphan reaper
+//! leaves registered children to their owner.
+
+use std::collections::BTreeSet;
+use std::ops::{Deref, DerefMut};
+use std::process::{Child, Command, Output};
+use std::sync::{Mutex, MutexGuard, PoisonError};
+
+static OWNED: Mutex<BTreeSet<u32>> = Mutex::new(BTreeSet::new());
+
+/// Lock the registry. Holding the guard prevents a concurrent [`spawn`] from
+/// producing an unregistered child.
+pub(crate) fn lock() -> MutexGuard<'static, BTreeSet<u32>> {
+    // The set holds plain pids; a panic while it was held cannot leave it in
+    // a state worse than a stale entry, so recover rather than fail.
+    OWNED.lock().unwrap_or_else(PoisonError::into_inner)
+}
+
+/// A child whose exit status belongs to the thread holding this handle.
+///
+/// The pid stays registered until the handle is dropped, so drop it only
+/// after the owner has waited (or has given up on the child, in which case
+/// the orphan reaper collects it).
+#[derive(Debug)]
+pub(crate) struct OwnedChild {
+    child: Child,
+    _registration: Registration,
+}
+
+/// Removes a pid from the registry when dropped.
+#[derive(Debug)]
+struct Registration(u32);
+
+impl Drop for Registration {
+    fn drop(&mut self) {
+        lock().remove(&self.0);
+    }
+}
+
+/// Spawn `command` and register the child before any wildcard reaper can
+/// observe it.
+pub(crate) fn spawn(command: &mut Command) -> std::io::Result<OwnedChild> {
+    let mut owned = lock();
+    let child = command.spawn()?;
+    let pid = child.id();
+    owned.insert(pid);
+    Ok(OwnedChild {
+        child,
+        _registration: Registration(pid),
+    })
+}
+
+impl OwnedChild {
+    /// [`Child::wait_with_output`], keeping the pid registered until the
+    /// child has been reaped.
+    pub(crate) fn wait_with_output(self) -> std::io::Result<Output> {
+        let Self {
+            child,
+            _registration,
+        } = self;
+        child.wait_with_output()
+    }
+}
+
+impl Deref for OwnedChild {
+    type Target = Child;
+
+    fn deref(&self) -> &Child {
+        &self.child
+    }
+}
+
+impl DerefMut for OwnedChild {
+    fn deref_mut(&mut self) -> &mut Child {
+        &mut self.child
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn spawned_child_is_registered_until_dropped() {
+        let mut child = spawn(&mut Command::new("true")).expect("spawn true");
+        let pid = child.id();
+        assert!(lock().contains(&pid));
+        child.wait().expect("owner reaps its child");
+        assert!(lock().contains(&pid), "registered until the handle drops");
+        drop(child);
+        assert!(!lock().contains(&pid));
+    }
+}
```

**File**: `crates/nono-cli/src/tool-sandbox/platform/linux.rs` (modified, +8/-4)
```diff
@@ -4619,7 +4619,8 @@ fn launch_child_with_direct_fds(
         .stdout(Stdio::from(File::from(stdio.stdout)))
         .stderr(Stdio::from(File::from(stdio.stderr)));
     install_lineage_attach(state, command_name, &mut command)?;
-    let mut child = command.spawn().map_err(NonoError::CommandExecution)?;
+    let mut child =
+        crate::owned_children::spawn(&mut command).map_err(NonoError::CommandExecution)?;
     drop(command);
     let exit_code = wait_for_tracked_child(state, command_name, launch_caller, &mut child)?;
     Ok(ChildLaunchResult {
@@ -4655,7 +4656,8 @@ fn launch_child_with_brokered_stdio(
         .stderr(Stdio::from(File::from(stderr_write)));
     install_lineage_attach(state, command_name, &mut command)?;
 
-    let mut child = command.spawn().map_err(NonoError::CommandExecution)?;
+    let mut child =
+        crate::owned_children::spawn(&mut command).map_err(NonoError::CommandExecution)?;
     drop(command);
     track_spawned_child(state, command_name, launch_caller, &mut child)?;
 
@@ -4918,7 +4920,8 @@ fn launch_child_with_capture(
     drop(stdio.stdout);
     install_lineage_attach(state, command_name, &mut command)?;
 
-    let mut child = command.spawn().map_err(NonoError::CommandExecution)?;
+    let mut child =
+        crate::owned_children::spawn(&mut command).map_err(NonoError::CommandExecution)?;
     drop(command);
     // The write end was moved into the child's Stdio and is now closed in
     // the parent, so reading from pipe_read will yield EOF when the child
@@ -4975,7 +4978,8 @@ fn launch_child_with_pty(
         .stdout(Stdio::from(File::from(stdout_slave)))
         .stderr(Stdio::from(File::from(stderr_slave)));
     install_lineage_attach(state, command_name, &mut command)?;
-    let mut child = command.spawn().map_err(NonoError::CommandExecution)?;
+    let mut child =
+        crate::owned_children::spawn(&mut command).map_err(NonoError::CommandExecution)?;
     drop(command);
     drop(pty.slave);
     track_spawned_child(state, command_name, launch_caller, &mut child)?;
```

**File**: `crates/nono-cli/src/tool-sandbox/policy.rs` (modified, +13/-12)
```diff
@@ -454,18 +454,19 @@ fn load_command_credential_source(
              no remaining PATH entry is safe for this sandbox"
         ))
     })?;
-    let mut child = std::process::Command::new(command)
-        .args(args)
-        .env("PATH", &safe_path)
-        .stdin(std::process::Stdio::null())
-        .stdout(std::process::Stdio::piped())
-        .stderr(std::process::Stdio::piped())
-        .spawn()
-        .map_err(|err| {
-            nono::NonoError::SandboxInit(format!(
-                "failed to start supervisor credential source '{command}': {err}"
-            ))
-        })?;
+    let mut child = crate::owned_children::spawn(
+        std::process::Command::new(command)
+            .args(args)
+            .env("PATH", &safe_path)
+            .stdin(std::process::Stdio::null())
+            .stdout(std::process::Stdio::piped())
+            .stderr(std::process::Stdio::piped()),
+    )
+    .map_err(|err| {
+        nono::NonoError::SandboxInit(format!(
+            "failed to start supervisor credential source '{command}': {err}"
+        ))
+    })?;
 
     let start = std::time::Instant::now();
     loop {
```

**File**: `crates/nono-cli/src/why_runtime.rs` (modified, +98/-6)
```diff
@@ -467,6 +467,21 @@ fn normalize_rule_paths(paths: &[String]) -> Option<Vec<std::path::PathBuf>> {
 
 /// Determine whether a literal or home-relative deny rule can cover `path`
 /// without consulting the evaluator host's filesystem or HOME value.
+///
+/// `Some(true)` means the rule definitely covers the path, `Some(false)` that
+/// it definitely does not, and `None` that the answer depends on context this
+/// evaluation deliberately does not have. Only a rule that is already an
+/// absolute literal can produce `Some(true)`.
+///
+/// A home-relative rule cannot: without `$HOME`, finding the rule's components
+/// somewhere in the path proves nothing about *which* directory they sit under.
+/// `~/downloads` and `/var/tmp/downloads/foo` share a `downloads` component
+/// while describing unrelated locations, so treating that as a match reports a
+/// confident `Denied` for a path the rule never covers. The absence of those
+/// components is still conclusive, because every expansion of `~/downloads`
+/// ends in `downloads` — so a path without it cannot be beneath the rule for
+/// any value of `$HOME`. That asymmetry is why a match yields `None` and a
+/// non-match yields `Some(false)`.
 fn policy_rule_may_cover(rule: &str, path: &std::path::Path) -> Option<bool> {
     if let Some(normalized) = normalize_absolute_literal(std::path::Path::new(rule)) {
         return Some(path.starts_with(normalized));
@@ -485,14 +500,18 @@ fn policy_rule_may_cover(rule: &str, path: &std::path::Path) -> Option<bool> {
     }
     let suffix_components: Vec<_> = suffix_path.components().collect();
     if suffix_components.is_empty() {
-        return Some(true);
+        // A bare `~/` denies the whole home directory. Whether this path lies
+        // inside it is precisely the question `$HOME` would answer.
+        return None;
     }
     let path_components: Vec<_> = path.components().collect();
-    Some(
-        path_components
-            .windows(suffix_components.len())
-            .any(|window| window == suffix_components),
-    )
+    if path_components
+        .windows(suffix_components.len())
+        .any(|window| window == suffix_components)
+    {
+        return None;
+    }
+    Some(false)
 }
 
 fn normalize_absolute_literal(path: &std::path::Path) -> Option<std::path::PathBuf> {
@@ -1491,4 +1510,77 @@ mod tests {
             } if reason == "invocation_policy_allowed"
         ));
     }
+
+    #[test]
+    fn absolute_literal_rules_still_decide_both_ways() {
+        let covered = std::path::Path::new("/etc/ssh/sshd_config");
+        assert_eq!(policy_rule_may_cover("/etc/ssh", covered), Some(true));
+        assert_eq!(policy_rule_may_cover("/etc/shadow", covered), Some(false));
+        // Component comparison, not string prefix: /etc must not cover /etcetera.
+        assert_eq!(
+            policy_rule_may_cover("/etc", std::path::Path::new("/etcetera/config")),
+            Some(false)
+        );
+    }
+
+    #[test]
+    fn home_relative_rule_does_not_deny_a_coincidental_component_match() {
+        // `~/downloads` and `/var/tmp/downloads/foo` share a `downloads`
+        // component but describe unrelated locations. Without $HOME this is
+        // unknowable, so it must not report a confident denial.
+        assert_eq!(
+            policy_rule_may_cover(
+                "~/downloads",
+                std::path::Path::new("/var/tmp/downloads/foo")
+            ),
+            None
+        );
+        for rule in ["~/.ssh", "$HOME/.ssh", "${HOME}/.ssh"] {
+            assert_eq!(
+                policy_rule_may_cover(rule, std::path::Path::new("/srv/backup/.ssh/id_rsa")),
+                None,
+                "{rule} must not decide without $HOME"
+            );
+        }
+    }
+
+    #[test]
+    fn home_relative_rule_still_rules_out_paths_lacking_its_components() {
+        // Conclusive in the negative: every expansion of `~/downloads` ends in
+        // a `downloads` component, so a path without one cannot be beneath it
+        // for any value of $HOME.
+        assert_eq!(
+            policy_rule_may_cover("~/downloads", std::path::Path::new("/var/tmp/uploads/foo")),
+            Some(false)
+        );
+        assert_eq!(
+            policy_rule_may_cover("~/.ssh/id_rsa", std::path::Path::new("/etc/passwd")),
+            Some(false)
+        );
+    }
+
+    #[test]
+    fn bare_home_rule_is_undecidable_without_home() {
+        // `~/` denies the whole home directory; whether an arbitrary path lies
+        // inside it is exactly what $HOME would tell us.
+        for rule in ["~/", "$HOME/", "${HOME}/"] {
+            assert_eq!(
+                policy_rule_may_cover(rule, std::path::Path::new("/var/tmp/foo")),
+                None,
+                "{rule} must not deny an arbitrary path"
+            );
+        }
+    }
+
+    #[test]
+    fn rules_needing_expansion_remain_undecidable() {
+        assert_eq!(
+            policy_rule_may_cover("
```

**File**: `crates/nono-proxy/src/reverse.rs` (modified, +23/-2)
```diff
@@ -27,6 +27,7 @@ use crate::token;
 use base64::Engine as _;
 use std::net::SocketAddr;
 use std::sync::Arc;
+use std::sync::atomic::{AtomicU64, Ordering};
 use std::time::{SystemTime, UNIX_EPOCH};
 use tokio::io::{AsyncReadExt, AsyncWriteExt, BufReader};
 use tokio::net::TcpStream;
@@ -1358,12 +1359,20 @@ async fn enforce_endpoint_policy(
     }
 }
 
-fn endpoint_approval_request_id(service: &str) -> String {
+/// Build a unique request id for an endpoint approval.
+///
+/// Approval backends (the platform in particular) key requests by id and
+/// reject a reused id, so every approval needs its own. The sequence number
+/// keeps concurrent requests from the same client distinct even when they
+/// share a timestamp.
+pub(crate) fn endpoint_approval_request_id(service: &str) -> String {
+    static SEQ: AtomicU64 = AtomicU64::new(0);
     let nanos = SystemTime::now()
         .duration_since(UNIX_EPOCH)
         .map(|d| d.as_nanos())
         .unwrap_or(0);
-    format!("proxy-endpoint-approval-{service}-{nanos}")
+    let seq = SEQ.fetch_add(1, Ordering::Relaxed);
+    format!("proxy-endpoint-approval-{service}-{nanos}-{seq}")
 }
 
 /// Handle a reverse proxy request using an OAuth2 token cache.
@@ -2860,6 +2869,18 @@ pub(crate) fn injected_credential_header_names(cred: Option<&LoadedCredential>)
 mod tests {
     use super::*;
 
+    #[test]
+    fn test_endpoint_approval_request_id_is_unique() {
+        let ids: std::collections::HashSet<String> = (0..1000)
+            .map(|_| endpoint_approval_request_id("172.19.0.2-6443"))
+            .collect();
+        assert_eq!(ids.len(), 1000);
+        assert!(
+            ids.iter()
+                .all(|id| id.starts_with("proxy-endpoint-approval-172.19.0.2-6443-"))
+        );
+    }
+
     #[test]
     fn test_parse_request_line() {
         let (method, path, version) = parse_request_line("POST /openai/v1/chat HTTP/1.1").unwrap();
```

**File**: `crates/nono-proxy/src/tls_intercept/handle.rs` (modified, +1/-1)
```diff
@@ -553,7 +553,7 @@ pub(crate) async fn select_intercept_route<'a>(
                     Some(&request_reason),
                 );
                 let request = nono::supervisor::ApprovalRequest::Endpoint {
-                    request_id: format!("proxy-endpoint-approval-{}-{}", host, port),
+                    request_id: reverse::endpoint_approval_request_id(&format!("{host}-{port}")),
                     route_id: (*prefix).to_string(),
                     upstream: route.upstream.clone(),
                     method: method.to_string(),
```

---

### Incident Patch 6: `0d3b347d` (2026-09-30)
**Commit Message**: chore(nix): update prebuilt hashes for v0.79.0 (#2028)

Co-authored-by: SequeI <[REDACTED_EMAIL]>

**File**: `flake.nix` (modified, +4/-4)
```diff
@@ -58,10 +58,10 @@
     # Auto-updated by the `update-nix-hashes` job in release.yml
     # after each release — no manual maintenance needed.
     prebuiltHashes = {
-      "x86_64-linux" = "sha256-r16DeXPVR6r208370S45UiJNG7d7cpKWLqGRgDmcONs=";
-      "aarch64-linux" = "sha256-cwi0EJlA8W7A0CTrS7z6zhz+LqHoMz3RR6tPC+dwYHE=";
-      "x86_64-darwin" = "sha256-uuQCyQ6djyXpTmwhtW5UpnTr//P6G9w8KY4b/C9+gtw=";
-      "aarch64-darwin" = "sha256-rBYbVR4U7m9d+06VWTlk6a9F25ydAQdMvn1r9BEGgLQ=";
+      "x86_64-linux" = "sha256-Nt/utujGowxD+AuiOeJGCvQwR8AIFTr1J/3Yk8HwI5I=";
+      "aarch64-linux" = "sha256-xKT0ua4xhXTTDTUhJ6NNzJGcTWaC7o+9MLuNK9Lg6F0=";
+      "x86_64-darwin" = "sha256-J29/avISWWVUqSR6SJAyVtkZz0PJd3He8TAKwzYAKRI=";
+      "aarch64-darwin" = "sha256-5GNlsIrs/wrMnHuG9dSxdFw4UDQYnVCCIVbkOIFHkWg=";
     };
 
     prebuiltFor = system: let pkgs = pkgsFor system; in pkgs.stdenv.mkDerivation {
```

---

### Incident Patch 7: `301d2c20` (2026-09-30)
**Commit Message**: fix(macos): recursively block sockets under denied directories (#2026)

* fix(macos): recursively block sockets under denied directories

Use Seatbelt subpath rules for network-outbound denials when the target is a directory or does not yet exist. Keep exact path rules for leaf targets and share the behavior with protected path enforcement.

Add unit and runtime coverage for nested Unix sockets and document the recursive behavior.

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

* fix: small nits and test cases

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

---------

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

**File**: `crates/nono-cli/src/policy.rs` (modified, +108/-31)
```diff
@@ -1053,7 +1053,8 @@ pub(crate) fn add_glob_deny_rules(
 /// - `(allow file-read-metadata ...)` — programs can stat/check existence
 /// - `(deny file-read-data ...)` — deny reading content
 /// - `(deny file-write* ...)` — deny writing
-/// - `(deny network-outbound (path ...))` — blocks Unix socket connections
+/// - `(deny network-outbound ...)` — blocks Unix socket connections, recursively
+///   when the denied target is a directory
 ///
 /// On Linux, deny paths are collected for overlap validation only —
 /// Landlock has no deny semantics so platform rules would be ignored.
@@ -1115,40 +1116,15 @@ pub(crate) fn add_deny_access_rules(
         deny_paths.push(resolved.clone());
     }
 
-    // Seatbelt deny rules only apply on macOS
+    // Seatbelt deny rules only apply on macOS.
     if cfg!(target_os = "macos") {
-        // Helper: emit metadata-allow + read-deny + write-deny + network-deny for a single path
-        let emit_deny_rules = |p: &Path, caps: &mut CapabilitySet| -> Result<()> {
-            let escaped = escape_seatbelt_path(path_to_utf8(p)?)?;
-            let filter = if p.exists() && p.is_file() {
-                format!("literal \"{}\"", escaped)
-            } else {
-                format!("subpath \"{}\"", escaped)
-            };
-            caps.add_platform_rule(format!("(allow file-read-metadata ({}))", filter))?;
-            caps.add_platform_rule(format!("(deny file-read-data ({}))", filter))?;
-            caps.add_platform_rule(format!("(deny file-write* ({}))", filter))?;
-            // SECURITY: connect(2) on a Unix domain socket is enforced by Seatbelt as
-            // network-outbound, not as a file operation. File deny rules above have no
-            // effect on socket connections. Emit an exact-path network-outbound deny so
-            // that connecting to this path (e.g. a Docker daemon socket) is blocked even
-            // if the socket is created after the sandbox is applied. This rule is
-            // evaluated at syscall time, not at sandbox_init time, so it covers sockets
-            // that do not yet exist. For non-socket paths the rule is a harmless no-op.
-            // Use (path ...) not (subpath ...) — socket connections match on the exact
-            // path, not a prefix. Both symlink and canonical paths are covered because
-            // emit_deny_rules is called for each form by the caller.
-            caps.add_platform_rule(format!("(deny network-outbound (path \"{}\"))", escaped))?;
-            Ok(())
-        };
-
         // Emit deny rules for the original path
-        emit_deny_rules(&path, caps)?;
+        emit_macos_deny_rules_for_path(&path, caps)?;
 
         // Emit deny rules for the canonical path too (covers parent symlinks on existing paths)
         if let Some(ref canonical) = canonical
             && *canonical != path
-            && let Err(e) = emit_deny_rules(canonical, caps)
+            && let Err(e) = emit_macos_deny_rules_for_path(canonical, caps)
         {
             warn!(
                 "Skipping canonical deny rules for {}: {}",
@@ -1160,7 +1136,7 @@ pub(crate) fn add_deny_access_rules(
         // Emit deny rules for the parent-resolved path (covers non-existent paths
         // whose parents contain symlinks, e.g. /var/run/future.sock -> /private/var/run/future.sock)
         if let Some(ref resolved) = parent_resolved
-            && let Err(e) = emit_deny_rules(resolved, caps)
+            && let Err(e) = emit_macos_deny_rules_for_path(resolved, caps)
         {
             warn!(
                 "Skipping parent-resolved deny rules for {}: {}",
@@ -1173,6 +1149,35 @@ pub(crate) fn add_deny_access_rules(
     Ok(())
 }
 
+/// Emit macOS Seatbelt denials for file operations and Unix-socket connects.
+///
+/// Seatbelt treats `connect(2)` to an AF_UNIX pathname as `network-outbound`,
+/// not file I/O. Directory filesystem denials are recursive, so the matching
+/// network denial must also use `subpath`; an exact `path` rule on the
+/// directory does not cover sockets below it. Non-existent targets retain the
+/// existing fail-secure directory interpretation. Existing non-directories,
+/// including socket nodes, use exact file and network paths.
+pub(crate) fn emit_macos_deny_rules_for_path(path: &Path, caps: &mut CapabilitySet) -> Result<()> {
+    let escaped = escape_seatbelt_path(path_to_utf8(path)?)?;
+    let is_existing_leaf = path.exists() && !path.is_dir();
+    let file_filter = if is_existing_leaf {
+        format!("literal \"{}\"", escaped)
+    } else {
+        format!("subpath \"{}\"", escaped)
+    };
+    let network_filter = if is_existing_leaf {
+        format!("path \"{}\"", escaped)
+    } else {
+        format!("subpath \"{}\"", escaped)
+    };
+
+    caps.add_platform_rule(format!("(allow file-read-metadata ({}))", file_filter))?;
+    caps.add_platform_rule(format!("(deny file-read-data ({}))", file_filter))?;
+    caps.add_platform_rule(format!("(deny
```

**File**: `crates/nono-cli/src/protected_paths.rs` (modified, +5/-6)
```diff
@@ -202,12 +202,7 @@ pub(crate) fn emit_protected_root_deny_rules(
 /// Emit Seatbelt deny rules for a single path.
 #[cfg(target_os = "macos")]
 fn emit_deny_rules_for_path(path: &Path, caps: &mut CapabilitySet) -> Result<()> {
-    let escaped = crate::policy::escape_seatbelt_path(crate::policy::path_to_utf8(path)?)?;
-    let filter = format!("subpath \"{}\"", escaped);
-    caps.add_platform_rule(format!("(allow file-read-metadata ({}))", filter))?;
-    caps.add_platform_rule(format!("(deny file-read-data ({}))", filter))?;
-    caps.add_platform_rule(format!("(deny file-write* ({}))", filter))?;
-    Ok(())
+    crate::policy::emit_macos_deny_rules_for_path(path, caps)
 }
 
 #[cfg(not(target_os = "macos"))]
@@ -462,5 +457,9 @@ mod tests {
             joined.contains("allow file-read-metadata"),
             "should allow metadata: {joined}"
         );
+        assert!(
+            joined.contains("deny network-outbound") && joined.contains("subpath"),
+            "should recursively deny Unix socket connections: {joined}"
+        );
     }
 }
```

**File**: `crates/nono-cli/tests/socket_access_run.rs` (modified, +40/-0)
```diff
@@ -149,6 +149,46 @@ fn filesystem_deny_blocks_unix_socket_connect_on_macos() {
         .assert_stdout_lacks("connected");
 }
 
+#[test]
+#[cfg(target_os = "macos")]
+fn filesystem_directory_deny_blocks_nested_unix_socket_connect_on_macos() {
+    let Some(py) = python3_bin() else {
+        eprintln!("skipping: no system python3 available");
+        return;
+    };
+
+    let t = nono_test!("macos-socket-directory-deny");
+    let sock_tmp = short_tempdir();
+    let nested = sock_tmp.path().join("nested");
+    std::fs::create_dir(&nested).expect("create nested socket directory");
+    let socket_path = nested.join("d.sock");
+    let _listener = UnixListener::bind(&socket_path).expect("bind nested test socket");
+    let control_tmp = short_tempdir();
+    let control_path = control_tmp.path().join("control.sock");
+    let _control_listener = UnixListener::bind(&control_path).expect("bind control socket");
+
+    let denied_dir = sock_tmp.path().to_string_lossy().into_owned();
+    let socket_arg = socket_path.to_string_lossy().into_owned();
+    let control_arg = control_path.to_string_lossy().into_owned();
+    let profile = t.write_profile(
+        "macos-socket-directory-deny",
+        &format!(
+            r#"{{"meta":{{"name":"macos-socket-directory-deny"}},"workdir":{{"access":"readwrite"}},"filesystem":{{"deny":["{denied_dir}"]}}}}"#
+        ),
+    );
+
+    let py_script = format!(
+        "import socket; c=socket.socket(socket.AF_UNIX); c.connect({control_arg:?}); print('control-connected', flush=True); s=socket.socket(socket.AF_UNIX); s.connect({socket_arg:?}); print('denied-connected')"
+    );
+
+    t.run()
+        .profile(&profile)
+        .exec(Argv::new(&py).arg("-c").arg(&py_script))
+        .assert_failure("connect to a socket below a denied directory is blocked")
+        .assert_stdout_contains("control-connected")
+        .assert_stdout_lacks("denied-connected");
+}
+
 /// Yama `ptrace_scope`, or `None` if it can't be read (non-Yama kernel).
 #[cfg(target_os = "linux")]
 fn yama_ptrace_scope() -> Option<i32> {
```

**File**: `docs/cli/features/profiles-groups.mdx` (modified, +1/-1)
```diff
@@ -295,7 +295,7 @@ Use `filesystem.deny` as the enforcement mechanism. `commands.deny` remains depr
 }
 ```
 
-On macOS, `filesystem.deny` on a socket path also emits a `network-outbound` deny — Seatbelt classifies `connect(2)` as a network operation, so a file deny alone won't block it. Prefer path- and network-based controls; `commands.deny` is not enforced for child processes.
+On macOS, `filesystem.deny` also emits a `network-outbound` deny — exact socket paths are blocked directly, while denied directories recursively block sockets beneath them. Seatbelt classifies `connect(2)` as a network operation, so a file deny alone won't block it. Prefer path- and network-based controls; `commands.deny` is not enforced for child processes.
 
 #### Adding Write-Only Access
 
```

**File**: `docs/cli/internals/seatbelt.mdx` (modified, +5/-2)
```diff
@@ -152,7 +152,7 @@ Network access is allowed by default:
 
 When a process calls `connect(2)` on a Unix socket (e.g., `/var/run/docker.sock`), Seatbelt classifies the operation as `network-outbound`, **not** a file operation. This means a `file-read-data` or `file-write-data` deny rule for the socket path will not block the connection.
 
-To block Unix socket connections, nono emits an additional rule alongside the standard file deny rules when a socket path appears in `add_deny_access`:
+To block Unix socket connections, nono emits an additional rule alongside the standard file deny rules. Exact socket or file targets use `path`; denied directories use `subpath` so sockets anywhere below the directory are also blocked:
 
 ```scheme
 ; File deny (blocks open/read/write on the socket file itself)
@@ -162,9 +162,12 @@ To block Unix socket connections, nono emits an additional rule alongside the st
 
 ; Network deny (blocks connect(2) to the socket)
 (deny network-outbound (path "/private/var/run/docker.sock"))
+
+; Recursive directory deny
+(deny network-outbound (subpath "/private/var/run/private-agents"))
 ```
 
-The `network-outbound` rule uses `(path ...)` for an exact match rather than `(subpath ...)` because socket connections match on the precise path. Seatbelt evaluates this rule at `connect(2)` time, so it blocks connections to sockets that do not exist when the sandbox initializes.
+Seatbelt evaluates these rules at `connect(2)` time, so they also block connections to sockets created after the sandbox initializes. Non-existent deny targets use the fail-secure recursive form because they may later become directories.
 
 ### Granular Filtering Limitations
 
```

---

### Incident Patch 8: `25a6b215` (2026-09-30)
**Commit Message**: fix: file grants negate filesystem.deny - #1949 (#2019)

* docs(NEP): mark keychain proposal accepted

Refs #1932

Signed-off-by: Kurtis Charnock <[REDACTED_EMAIL]>

* fix(cli): gate keychain exception on bypass

Adds `EffectiveDenyPolicy` to pair deny paths after
`apply_deny_overrides` with `filesystem.bypass_protection` paths.

Refs #1932

Signed-off-by: Kurtis Charnock <[REDACTED_EMAIL]>

* fix(cli): scope mediated keychain grants

Adds the agent's resolved `filesystem.bypass_protection` paths into
the tool sandbox.

Refs #1932

Signed-off-by: Kurtis Charnock <[REDACTED_EMAIL]>

* test(lib): pin keychain mach denies

Asserts the SecurityServer, securityd, keychaind, secd and
security.agent denies survive an exact-file, metadata-DB and directory
keychain grant. Red: has_explicit_keychain_db_access drops the denies
for any user-intent grant naming a keychain DB.

Refs #1932

Signed-off-by: Kurtis Charnock <[REDACTED_EMAIL]>

* fix(lib): always deny keychain mach services

Drops `has_explicit_keychain_db_access` and emits SecurityServer,
securityd, keychaind, secd and security.agent denies unconditionally.
An authorized re-allow arrives as a platform rule, which the profile
emits a

**File**: `crates/nono-cli/src/capability_ext.rs` (modified, +37/-11)
```diff
@@ -562,6 +562,15 @@ pub struct PreparedCaps {
     /// with the deny group that blocks each. Surfaced as a single folded line
     /// in the capability summary; `(path, Some(group_name))`.
     pub blocked_grants: Vec<(PathBuf, Option<String>)>,
+    /// The `filesystem.bypass_protection` entries `apply_deny_overrides`
+    /// actually applied, with their path forms and access modes.
+    ///
+    /// SECURITY: this is the authoritative bypass list. Entries that named a
+    /// path absent from this host were warned about and dropped, so recomputing
+    /// the list from the profile yields bypasses the sandbox never honored —
+    /// which would let `nono why` and a mediated command's keychain
+    /// authorization disagree with the sandbox that is actually running.
+    pub applied_bypass_paths: Vec<policy::AppliedBypass>,
 }
 
 /// Extension trait for CapabilitySet to add CLI-specific construction methods.
@@ -669,13 +678,14 @@ impl CapabilitySetExt for CapabilitySet {
             caps.add_blocked_command(cmd);
         }
 
-        let blocked_grants = finalize_caps(&mut caps, &mut resolved, &loaded_policy, args, &[])?;
+        let finalized = finalize_caps(&mut caps, &mut resolved, &loaded_policy, args, &[])?;
 
         Ok(PreparedCaps {
             caps,
             needs_unlink_overrides: resolved.needs_unlink_overrides,
             deny_paths: resolved.deny_paths,
-            blocked_grants,
+            blocked_grants: finalized.blocked_grants,
+            applied_bypass_paths: finalized.applied_bypass_paths,
         })
     }
 
@@ -1122,7 +1132,7 @@ impl CapabilitySetExt for CapabilitySet {
             }
         }
 
-        let blocked_grants = finalize_caps(
+        let finalized = finalize_caps(
             &mut caps,
             &mut resolved,
             &loaded_policy,
@@ -1134,11 +1144,17 @@ impl CapabilitySetExt for CapabilitySet {
             caps,
             needs_unlink_overrides: resolved.needs_unlink_overrides,
             deny_paths: resolved.deny_paths,
-            blocked_grants,
+            blocked_grants: finalized.blocked_grants,
+            applied_bypass_paths: finalized.applied_bypass_paths,
         })
     }
 }
 
+struct FinalizedCaps {
+    blocked_grants: Vec<(PathBuf, Option<String>)>,
+    applied_bypass_paths: Vec<policy::AppliedBypass>,
+}
+
 /// Shared finalization: deny overrides, overlap validation, keychain exception, dedup.
 ///
 /// Called by both `from_args()` and `from_profile()` after all grants are added.
@@ -1150,12 +1166,17 @@ fn finalize_caps(
     loaded_policy: &policy::Policy,
     args: &SandboxArgs,
     profile_bypass_protection: &[PathBuf],
-) -> Result<Vec<(PathBuf, Option<String>)>> {
+) -> Result<FinalizedCaps> {
     // Apply profile-level deny overrides first, then CLI overrides.
     // Profile overrides come from `filesystem.bypass_protection` in the
     // profile JSON. CLI `--bypass-protection` flags are applied on top.
-    policy::apply_deny_overrides(profile_bypass_protection, &mut resolved.deny_paths, caps)?;
-    policy::apply_deny_overrides(&args.bypass_protection, &mut resolved.deny_paths, caps)?;
+    let mut bypass_paths =
+        policy::apply_deny_overrides(profile_bypass_protection, &mut resolved.deny_paths, caps)?;
+    bypass_paths.extend(policy::apply_deny_overrides(
+        &args.bypass_protection,
+        &mut resolved.deny_paths,
+        caps,
+    )?);
 
     // Remove exact file grants for the deny paths that remain after overrides.
     // This lets profile deny patches override inherited file capabilities while
@@ -1176,14 +1197,19 @@ fn finalize_caps(
         Vec::new()
     };
 
-    // Keep broad keychain deny groups active, but allow explicit
-    // keychain DB read grants (profile/CLI) on macOS.
-    policy::apply_macos_keychain_db_exception(caps);
+    // Keep broad keychain deny groups active, but allow keychain DB grants
+    // whose deny a matching bypass_protection has lifted.
+    let deny_policy =
+        policy::EffectiveDenyPolicy::from_applied_bypasses(&resolved.deny_paths, &bypass_paths);
+    policy::apply_macos_keychain_db_exception(caps, &deny_policy);
 
     // Deduplicate capabilities
     caps.deduplicate();
 
-    Ok(blocked_grants)
+    Ok(FinalizedCaps {
+        blocked_grants,
+        applied_bypass_paths: bypass_paths,
+    })
 }
 
 fn apply_cli_network_mode(caps: &mut CapabilitySet, args: &SandboxArgs) {
```

**File**: `crates/nono-cli/src/execution_runtime.rs` (modified, +2/-1)
```diff
@@ -480,6 +480,7 @@ pub(crate) fn execute_sandboxed(plan: LaunchPlan) -> Result<()> {
                 blocked_commands: caps.blocked_commands(),
                 outer_caps: &caps,
                 deny_paths: &deny_paths,
+                bypass_protection_paths: &flags.bypass_protection_paths,
                 policy_root: &requested_workdir,
                 proxy_credentials: &tool_sandbox_proxy_credentials,
                 reserved_proxy_ports: &reserved_proxy_ports,
@@ -846,7 +847,7 @@ fn validate_command_policy_execution_support() -> Result<()> {
 
 fn write_capability_state_file(
     caps: &CapabilitySet,
-    bypass_protection_paths: &[std::path::PathBuf],
+    bypass_protection_paths: &[crate::policy::AppliedBypass],
     deny_paths: &[std::path::PathBuf],
     allowed_domains: &[String],
     denied_domains: &[String],
```

**File**: `crates/nono-cli/src/launch_runtime.rs` (modified, +1/-1)
```diff
@@ -243,7 +243,7 @@ pub(crate) struct ExecutionFlags {
     pub(crate) sandbox_policy: crate::profile::LinuxSandboxPolicy,
     #[cfg(target_os = "linux")]
     pub(crate) proc_comm_notify: bool,
-    pub(crate) bypass_protection_paths: Vec<PathBuf>,
+    pub(crate) bypass_protection_paths: Vec<crate::policy::AppliedBypass>,
     pub(crate) ignored_denial_paths: Vec<PathBuf>,
     pub(crate) suppressed_system_service_operations: Vec<String>,
     pub(crate) profile_display_name: Option<String>,
```

**File**: `crates/nono-cli/src/policy.rs` (modified, +1021/-160)
```diff
@@ -6,7 +6,7 @@
 use crate::package;
 use crate::profile;
 use nono::{AccessMode, CapabilitySet, CapabilitySource, FsCapability, NonoError, Result};
-use serde::Deserialize;
+use serde::{Deserialize, Serialize};
 use std::collections::{HashMap, HashSet};
 use std::path::{Path, PathBuf};
 use tracing::{debug, info, warn};
@@ -1173,13 +1173,264 @@ pub(crate) fn add_deny_access_rules(
     Ok(())
 }
 
-/// Add a narrow macOS exception for explicit keychain DB file grants.
+/// Resolved deny paths together with the `filesystem.bypass_protection` paths
+/// that punch through them.
+///
+/// SECURITY: a filesystem grant supplies access but never defeats a covering
+/// deny; only a bypass covering the same path does. The surviving deny list
+/// read without these bypasses reports a bypassed path as denied while the
+/// sandbox allows it.
+#[derive(Debug, Clone, Serialize, Deserialize)]
+pub struct AppliedBypass {
+    pub path: PathBuf,
+    pub access: AccessMode,
+    /// Whether Seatbelt reopened a literal file rather than a subtree.
+    #[serde(default = "AppliedBypass::literal_by_default")]
+    pub is_file: bool,
+    /// Deny rules removed from bookkeeping by this bypass. Seatbelt still
+    /// enforces them for access modes the bypass did not reopen.
+    pub removed_denies: Vec<PathBuf>,
+}
+
+impl AppliedBypass {
+    // Older state files do not record filter shape. Never infer a subtree
+    // exception from the filesystem's current (potentially changed) type.
+    fn literal_by_default() -> bool {
+        true
+    }
+}
+
+#[derive(Debug, Clone)]
+pub struct EffectiveDenyPolicy {
+    deny_paths: Vec<PathBuf>,
+    bypass_paths: Vec<PathBuf>,
+    bypasses: Vec<AppliedBypass>,
+}
+
+impl EffectiveDenyPolicy {
+    /// Snapshot the outer keychain filesystem restrictions for mediated children.
+    ///
+    /// These are denies with mode-specific holes, never new grants. Consequently
+    /// a broad command grant cannot defeat them, and a bypass cannot give a
+    /// command access it did not request. Unrelated delegated credentials remain
+    /// governed by the command policy. Build once at runtime preparation, not
+    /// after an untrusted child has had an opportunity to change symlinks.
+    #[cfg(target_os = "macos")]
+    pub(crate) fn keychain_child_deny_rules(&self) -> Result<Vec<String>> {
+        let mut roots = Vec::new();
+        for root in [
+            expand_path("~/Library/Keychains")?,
+            PathBuf::from("/Library/Keychains"),
+        ] {
+            if let Some(resolved) = resolve_parent_symlinks(&root)? {
+                roots.push(resolved);
+            }
+            roots.push(root);
+        }
+
+        let filter = |path: &Path, is_file: bool| -> Result<String> {
+            let kind = if is_file { "literal" } else { "subpath" };
+            Ok(format!(
+                "({kind} \"{}\")",
+                escape_seatbelt_path(path_to_utf8(path)?)?
+            ))
+        };
+
+        let mut protected_paths = Vec::new();
+        for deny in &self.deny_paths {
+            for root in &roots {
+                // Intersect an outer deny with the keychain subtree, so a deny
+                // on HOME does not suppress unrelated command-only grants.
+                let path = if deny.starts_with(root) {
+                    deny
+                } else if root.starts_with(deny) {
+                    root
+                } else {
+                    continue;
+                };
+                protected_paths.push(path.clone());
+                // An explicitly denied DB may itself be a symlink outside the
+                // keychain directory. Carry its already-denied target too.
+                if let Some(resolved) = resolve_parent_symlinks(path)?
+                    && self
+                        .deny_paths
+                        .iter()
+                        .any(|deny| resolved.starts_with(deny))
+                {
+                    protected_paths.push(resolved);
+                }
+            }
+        }
+        protected_paths.sort_unstable();
+        protected_paths.dedup();
+        let mut rules = Vec::new();
+        for path in &protected_paths {
+            for (access, operation) in [
+                (AccessMode::Read, "file-read-data"),
+                (AccessMode::Write, "file-write*"),
+            ] {
+                let mut conditions = vec![filter(path, false)?];
+                for bypass in &self.bypasses {
+                    if bypass.access.contains(access)
+                        && (bypass.path.starts_with(path) || path.starts_with(&bypass.path))
+                    {
+                        conditions.push(format!(
+                            "(require-not {})",
+                            filter(&bypass.path, bypass.is_file)?
+                        ));
+                    }
+                }
+                rules.push(format!(
+                    "(deny {operation} (require-all
```

**File**: `crates/nono-cli/src/profile_runtime.rs` (modified, +0/-56)
```diff
@@ -44,7 +44,6 @@ pub(crate) struct PreparedProfile {
     pub(crate) allow_launch_services: bool,
     pub(crate) allow_gpu: bool,
     pub(crate) allow_parent_of_protected: bool,
-    pub(crate) bypass_protection_paths: Vec<PathBuf>,
     pub(crate) ignored_denial_paths: Vec<PathBuf>,
     pub(crate) suppressed_system_service_operations: Vec<String>,
     /// `diagnostics.redaction.extra_env_vars` from the profile: extra
@@ -424,52 +423,6 @@ fn validate_bundle_relative_path<'a>(
     Ok(path)
 }
 
-fn expand_bypass_protection_path(path: &Path, workdir: &Path) -> PathBuf {
-    let path_str = path.to_string_lossy();
-    let expanded = profile::expand_vars(&path_str, workdir).unwrap_or_else(|_| path.to_path_buf());
-    if expanded.exists() {
-        expanded.canonicalize().unwrap_or(expanded)
-    } else {
-        expanded
-    }
-}
-
-fn collect_bypass_protection_paths(
-    loaded_profile: Option<&profile::Profile>,
-    cli_bypass_protection: &[PathBuf],
-    workdir: &Path,
-) -> Vec<PathBuf> {
-    let mut paths: Vec<PathBuf> = loaded_profile
-        .map(|profile| {
-            profile
-                .filesystem
-                .bypass_protection
-                .iter()
-                .filter_map(|template| {
-                    profile::expand_vars(template, workdir)
-                        .ok()
-                        .map(|expanded| {
-                            if expanded.exists() {
-                                expanded.canonicalize().unwrap_or(expanded)
-                            } else {
-                                expanded
-                            }
-                        })
-                })
-                .collect()
-        })
-        .unwrap_or_default();
-
-    for path in cli_bypass_protection {
-        let canonical = expand_bypass_protection_path(path, workdir);
-        if !paths.contains(&canonical) {
-            paths.push(canonical);
-        }
-    }
-
-    paths
-}
-
 fn expand_ignored_denial_path(path: &Path, workdir: &Path) -> PathBuf {
     let path_str = path.to_string_lossy();
     let expanded = profile::expand_vars(&path_str, workdir).unwrap_or_else(|_| path.to_path_buf());
@@ -971,11 +924,6 @@ fn prepare_profile_with_options(
             .as_ref()
             .and_then(|profile| profile.allow_parent_of_protected)
             .unwrap_or(false),
-        bypass_protection_paths: collect_bypass_protection_paths(
-            loaded_profile.as_ref(),
-            &args.bypass_protection,
-            workdir,
-        ),
         ignored_denial_paths: collect_ignored_denial_paths(
             loaded_profile.as_ref(),
             &args.suppress_save_prompt,
@@ -2014,10 +1962,6 @@ echo hi
             preflight.allow_launch_services
         );
         assert_eq!(runtime.allow_gpu, preflight.allow_gpu);
-        assert_eq!(
-            runtime.bypass_protection_paths,
-            preflight.bypass_protection_paths
-        );
         assert_eq!(runtime.ignored_denial_paths, preflight.ignored_denial_paths);
         assert!(
             runtime
```

**File**: `crates/nono-cli/src/sandbox_prepare.rs` (modified, +5/-2)
```diff
@@ -555,7 +555,7 @@ pub(crate) struct PreparedSandbox {
     pub(crate) proc_comm_notify: bool,
     pub(crate) open_url_origins: Vec<String>,
     pub(crate) open_url_allow_localhost: bool,
-    pub(crate) bypass_protection_paths: Vec<PathBuf>,
+    pub(crate) bypass_protection_paths: Vec<crate::policy::AppliedBypass>,
     pub(crate) ignored_denial_paths: Vec<PathBuf>,
     pub(crate) suppressed_system_service_operations: Vec<String>,
     /// `diagnostics.redaction.extra_env_vars` from the profile: extra
@@ -1597,7 +1597,6 @@ pub(crate) fn prepare_sandbox(args: &SandboxArgs, silent: bool) -> Result<Prepar
         allow_launch_services: profile_allow_launch_services,
         allow_gpu: profile_allow_gpu,
         allow_parent_of_protected: profile_allow_parent_of_protected,
-        bypass_protection_paths,
         ignored_denial_paths,
         suppressed_system_service_operations,
         redaction_extra_env_vars,
@@ -1719,6 +1718,10 @@ pub(crate) fn prepare_sandbox(args: &SandboxArgs, silent: bool) -> Result<Prepar
     // User grants silently blocked by deny groups (macOS); folded into the
     // capability summary instead of emitting one warning per path.
     let blocked_grants = prepared.blocked_grants;
+    // SECURITY: the bypasses `apply_deny_overrides` actually applied, with
+    // their access modes, not the profile's raw list. A bypass naming a path
+    // absent from this host is dropped and must not reappear as authority.
+    let bypass_protection_paths = prepared.applied_bypass_paths;
 
     // Apply raw Seatbelt rules from the profile (macOS only).
     #[cfg(target_os = "macos")]
```

**File**: `crates/nono-cli/src/sandbox_state.rs` (modified, +35/-17)
```diff
@@ -29,9 +29,10 @@ pub struct SandboxState {
     pub allowed_commands: Vec<String>,
     /// Commands explicitly blocked
     pub blocked_commands: Vec<String>,
-    /// Paths exempted from deny groups via bypass_protection (canonicalized)
+    /// Applied bypasses with the access modes Seatbelt actually reopens.
+    /// Older state files without mode data default to no bypass authority.
     #[serde(default)]
-    pub bypass_protection_paths: Vec<String>,
+    pub applied_bypasses: Vec<crate::policy::AppliedBypass>,
     /// Resolved filesystem deny paths enforced by the active profile.
     ///
     /// These are not filesystem capabilities: on macOS they are explicit
@@ -126,7 +127,7 @@ impl SandboxState {
     #[cfg(test)]
     pub fn from_caps(
         caps: &CapabilitySet,
-        bypass_protection_paths: &[PathBuf],
+        bypass_protection_paths: &[crate::policy::AppliedBypass],
         allowed_domains: &[String],
         domain_endpoints: &[DomainEndpointState],
     ) -> Self {
@@ -143,7 +144,7 @@ impl SandboxState {
     /// Create sandbox state including explicit filesystem deny paths.
     pub fn from_caps_with_denies(
         caps: &CapabilitySet,
-        bypass_protection_paths: &[PathBuf],
+        bypass_protection_paths: &[crate::policy::AppliedBypass],
         deny_paths: &[PathBuf],
         allowed_domains: &[String],
         denied_domains: &[String],
@@ -173,10 +174,7 @@ impl SandboxState {
             net_blocked: caps.is_network_blocked(),
             allowed_commands: caps.allowed_commands().to_vec(),
             blocked_commands: caps.blocked_commands().to_vec(),
-            bypass_protection_paths: bypass_protection_paths
-                .iter()
-                .map(|p| p.display().to_string())
-                .collect(),
+            applied_bypasses: bypass_protection_paths.to_vec(),
             deny_paths: deny_paths.iter().map(|p| p.display().to_string()).collect(),
             allowed_domains: allowed_domains.to_vec(),
             denied_domains: denied_domains.to_vec(),
@@ -185,14 +183,6 @@ impl SandboxState {
         }
     }
 
-    /// Get bypass_protection paths as PathBufs for query use
-    pub fn bypass_protection_as_paths(&self) -> Vec<PathBuf> {
-        self.bypass_protection_paths
-            .iter()
-            .map(PathBuf::from)
-            .collect()
-    }
-
     /// Get resolved filesystem deny paths for query use.
     pub fn deny_paths_as_paths(&self) -> Vec<PathBuf> {
         self.deny_paths.iter().map(PathBuf::from).collect()
@@ -713,6 +703,34 @@ mod tests {
         assert_eq!(restored.deny_paths_as_paths(), deny_paths);
     }
 
+    #[test]
+    fn test_sandbox_state_roundtrip_preserves_bypass_access() {
+        let bypass = crate::policy::AppliedBypass {
+            path: PathBuf::from("/workspace/blocked.txt"),
+            access: AccessMode::Read,
+            is_file: true,
+            removed_denies: vec![PathBuf::from("/workspace/blocked.txt")],
+        };
+        let state = SandboxState::from_caps_with_denies(
+            &CapabilitySet::new(),
+            std::slice::from_ref(&bypass),
+            &[],
+            &[],
+            &[],
+            &[],
+        );
+
+        let json = serde_json::to_string(&state).expect("serialize state");
+        let restored: SandboxState = serde_json::from_str(&json).expect("deserialize state");
+        assert_eq!(restored.applied_bypasses.len(), 1);
+        assert_eq!(restored.applied_bypasses[0].access, AccessMode::Read);
+        assert!(restored.applied_bypasses[0].is_file);
+        assert_eq!(
+            restored.applied_bypasses[0].removed_denies,
+            bypass.removed_denies
+        );
+    }
+
     #[test]
     fn test_legacy_sandbox_state_without_deny_paths_still_loads() {
         let caps = CapabilitySet::new();
@@ -918,7 +936,7 @@ mod tests {
             net_blocked: false,
             allowed_commands: vec![],
             blocked_commands: vec![],
-            bypass_protection_paths: vec![],
+            applied_bypasses: vec![],
             deny_paths: vec![],
             allowed_domains: vec![],
             denied_domains: vec![],
```

**File**: `crates/nono-cli/src/test_env.rs` (modified, +80/-0)
```diff
@@ -1,3 +1,8 @@
+#[cfg(target_os = "macos")]
+use nono::{AccessMode, CapabilitySource, FsCapability};
+#[cfg(target_os = "macos")]
+use std::path::{Path, PathBuf};
+
 /// Process-global lock for tests that mutate environment variables.
 ///
 /// Rust unit tests run in parallel within the same process, so concurrent
@@ -148,3 +153,78 @@ pub(crate) fn write_user_profile(config_home: &std::path::Path, name: &str, prof
     std::fs::create_dir_all(&profiles).expect("create profiles dir");
     std::fs::write(profiles.join(format!("{name}.json")), profile_json).expect("write profile");
 }
+
+/// A throwaway `$HOME` with a populated `Library/Keychains`, so no keychain
+/// test ever names the real user keychain. Holds [`ENV_LOCK`] for its whole
+/// lifetime because the keychain policy code reads `$HOME`.
+#[cfg(target_os = "macos")]
+pub(crate) struct KeychainFixture {
+    // Declaration order is drop order: restore $HOME before releasing the lock.
+    _env: EnvVarGuard,
+    _lock: std::sync::MutexGuard<'static, ()>,
+    _dir: tempfile::TempDir,
+    pub(crate) home: PathBuf,
+    pub(crate) keychains: PathBuf,
+    pub(crate) login_db: PathBuf,
+    pub(crate) metadata_db: PathBuf,
+}
+
+#[cfg(target_os = "macos")]
+impl KeychainFixture {
+    pub(crate) fn new() -> Self {
+        Self::with_home(|root| root.join("home"))
+    }
+
+    /// `home_for` picks the `$HOME` to publish, which lets a test point it at a
+    /// symlink so a capability's `original` and `resolved` paths differ.
+    pub(crate) fn with_home(home_for: impl Fn(&Path) -> PathBuf) -> Self {
+        let lock = ENV_LOCK
+            .lock()
+            .unwrap_or_else(|poisoned| poisoned.into_inner());
+        let dir = tempfile::tempdir().expect("tmpdir");
+        let keychains = dir.path().join("home/Library/Keychains");
+        std::fs::create_dir_all(&keychains).expect("mkdir keychains");
+        std::fs::write(keychains.join("login.keychain-db"), "").expect("write login db");
+        std::fs::write(keychains.join("metadata.keychain-db"), "").expect("write metadata db");
+
+        let home = home_for(dir.path());
+        let env = EnvVarGuard::set_all(&[("HOME", home.to_str().expect("home path utf8"))]);
+        let keychains = home.join("Library/Keychains");
+        Self {
+            _env: env,
+            _lock: lock,
+            _dir: dir,
+            login_db: keychains.join("login.keychain-db"),
+            metadata_db: keychains.join("metadata.keychain-db"),
+            keychains,
+            home,
+        }
+    }
+
+    /// The deny entries `deny_keychains_macos` resolves to for this fixture:
+    /// the keychain directory in both its given and its canonical form.
+    pub(crate) fn keychain_denies(&self) -> Vec<PathBuf> {
+        let mut denies = vec![self.keychains.clone()];
+        if let Ok(canonical) = self.keychains.canonicalize() {
+            denies.push(canonical);
+        }
+        denies
+    }
+}
+
+/// An exact-file capability with both path forms filled in the way
+/// `FsCapability::new_file` would.
+#[cfg(target_os = "macos")]
+pub(crate) fn keychain_file_cap(
+    path: &Path,
+    access: AccessMode,
+    source: CapabilitySource,
+) -> FsCapability {
+    FsCapability {
+        original: path.to_path_buf(),
+        resolved: path.canonicalize().unwrap_or_else(|_| path.to_path_buf()),
+        access,
+        is_file: true,
+        source,
+    }
+}
```

---

### Incident Patch 9: `44c6b0fd` (2026-09-29)
**Commit Message**: docs(neps): add nep 0004 for linux namespace isolation (#2021)

Add NEP 0004 as a draft proposal covering opt-in Linux namespace isolation and update the index table in the README accordingly.

Signed-off-by: Luke Hinds <[REDACTED_EMAIL]>

**File**: `neps/0004-opt-in-linux-namespace-isolation.md` (added, +490/-0)
```diff
@@ -0,0 +1,490 @@
+---
+nep: 0004
+title: Opt-in Linux namespace isolation
+authors:
+  - lukehinds
+status: draft
+created: 2026-09-29
+superseded-by:
+---
+
+# NEP-0004: Opt-in Linux namespace isolation
+
+## Summary
+
+Add an opt-in, permanently default-off Linux isolation layer that runs the
+sandboxed workload inside a set of unprivileged namespaces (user + network,
+later a minimal mount-mask), layered on top of the existing Landlock and
+seccomp enforcement. This structurally removes the local-IPC escape classes
+(abstract AF_UNIX sockets, netlink, direct IP, and — with the mount mask —
+pathname AF_UNIX endpoints such as the D-Bus session bus and the systemd
+user manager) instead of mediating them syscall-by-syscall.
+
+## Motivation
+
+We have had a few escape classes reported against nono on Linux where 
+there has been a misguided expectation that nono runs as an outer isolation primitive
+equal to a VM or container. Concretely:
+
+- **Pathname AF_UNIX `connect()`** is not governed by Landlock filesystem
+  rules. From inside a sandbox, `/run/user/<uid>/bus` reaches the D-Bus
+  session bus or the systemd user manager socket (`systemd-run` starts processes
+  *outside* the sandbox), `docker.sock`, X11/Wayland, and `ssh-agent`.
+- **Abstract AF_UNIX sockets** are scoped only on Landlock V6+ kernels via
+  `LANDLOCK_SCOPE_ABSTRACT_UNIX_SOCKET`. On older kernels the default
+  `IpcMode::SharedMemoryOnly` continues *without* scoping: the class is
+  fail-open below V6.
+- **Non-TCP network** (UDP, ICMP, raw) is invisible to Landlock V4 network
+  rules and handled only at socket-family granularity by the static seccomp
+  baseline; the proxy cannot carry non-HTTP protocols at all (#756).
+
+nono's existing countermeasure for the pathname class,
+`linux.af_unix_mediation = "pathname"` (seccomp user-notify supervision),
+is off by default, excluded from `nono wrap` and WSL2, and has proven
+operationally fragile in the field (#1128, #1399, #1420, #1715, #1970).
+More fundamentally, intercept-and-continue mediation of pointer-argument
+syscalls is not a sound security boundary: the kernel documentation for
+seccomp user notification is explicit that the notified memory remains
+writable by the target, so the validated `sockaddr` bytes are subject to
+rewrite between check and use. Mediation inspects a hostile interface
+point-by-point; a namespace removes the interface wholesale.
+
+Upstream Landlock is closing the same gaps natively — ABI 9 adds
+`LANDLOCK_ACCESS_FS_RESOLVE_UNIX` (kernel-enforced per-path pathname-socket
+grants) and ABI 10 adds UDP bind/connect rules — and adopting those is the
+right long-term default path. But those ABIs shipped in current-generation
+kernels only; enterprise fleets nono supports today (e.g. RHEL 9 on 5.14,
+see #1980) will lack them for years. Namespaces are the bridge that works
+on every kernel nono already runs on. The two tracks are complementary,
+not alternatives.
+
+Follow up work should take place to bring nono's Landlock support up to
+the current ABI so that capable kernels get kernel-native enforcement of
+the same policy classes the namespace layer provides structurally on
+older ones; see "Parallel track" in the Proposal for how the two compose,
+with the enforcement-semantics-changing part (ABI 9) split into a
+companion NEP.
+
+Namespace isolation must never become the default: unprivileged user
+namespaces are denied on Ubuntu 23.10+/24.04 (AppArmor
+`kernel.apparmor_restrict_unprivileged_userns`), inside default
+Docker/Kubernetes seccomp profiles, and on AWS Fargate and similar
+locked-down runtimes. nono's core promise — fully unprivileged, runs on a
+developer laptop, in GitHub Actions, in a stock container — is exactly the
+set of environments where namespace availability is inconsistent. A default
+that silently varied enforcement by host would violate the fail-secure
+rule. Opt-in keeps nono completely userland-purposed by default.
+
+### Goals
+
+- Close the abstract-AF_UNIX, netlink, and direct-IP escape classes on
+  **every supported kernel**, not just Landlock V6+ / V4+.
+- Close the pathname AF_UNIX class (D-Bus, systemd, `docker.sock`)
+  structurally, without per-syscall supervision.
+- Preserve `nono-proxy` semantics (credential injection, domain filtering,
+  session-token auth) inside a network namespace.
+- Fail closed, loudly and diagnosably, when isolation is requested but the
+  host cannot provide it.
+- Keep the existing Landlock + seccomp stack unchanged underneath
+  (defense in depth); keep macOS Seatbelt behavior untouched.
+- Per-session `/tmp` (#258) as a natural consequence of the mount phase.
+
+### Non-Goals
+
+- **Any change to defaults.** Every namespace feature is opt-in via
+  explicit profile/flag configuration, permanently.
+- Building a container runtime: no rootfs construction, no `pivot_root`
+  into a synthetic tree, no image handling. The mount phase is a *mask*
+  over the real filesystem, preserving non
```

**File**: `neps/README.md` (modified, +1/-0)
```diff
@@ -72,3 +72,4 @@ whoever merges second renumbering their file.
 | 0000 | NEP process               | accepted |
 | 0001 | Pre-1.0.0 tech debt, deprecation, and API-freeze cleanup | proposed |
 | 0003 | Move macOS keychain authorisation to `nono-cli`          | draft    |
+| 0004 | Opt-in Linux namespace isolation                          | draft    |
```

---

### Incident Patch 10: `b833c334` (2026-09-28)
**Commit Message**: fix(keystore): refuse empty sanitized PATH for host-side brokers (#1895)

* fix(keystore): refuse empty sanitized PATH for host-side brokers

PATH="" makes execvp search the current directory. After every PATH
entry is dropped as sandbox-writable, return KeystoreAccess instead of
spawning op/bw/security. Same check on supervisor credential sources.

Signed-off-by: Sebastien Tardif <[REDACTED_EMAIL]>

* fix: share helper and sanitise all other paths

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

---------

Signed-off-by: Sebastien Tardif <[REDACTED_EMAIL]>
Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>
Co-authored-by: Aleksy Siek <[REDACTED_EMAIL]>

**File**: `crates/nono-cli/src/proxy_runtime.rs` (modified, +48/-4)
```diff
@@ -1372,8 +1372,14 @@ fn resolve_capture_command_with_path(
     // there and this broker — which runs host-side, unsandboxed — would
     // pick it up instead of the real one. Only resolve within directories
     // proven read-only to the sandbox.
-    let safe_path =
-        nono::sanitize_broker_path_for_binary(&path_var.to_string_lossy(), command, outer_caps);
+    let Some(safe_path) =
+        nono::safe_broker_path_for_binary(&path_var.to_string_lossy(), command, outer_caps)
+    else {
+        return Ok(CaptureCommandResolution::Unavailable(format!(
+            "credential_capture command '{command}' could not be resolved because no PATH entry \
+             is safe for this sandbox"
+        )));
+    };
     for dir in std::env::split_paths(&safe_path) {
         let candidate = dir.join(command);
         if candidate.is_file() {
@@ -2021,11 +2027,17 @@ fn load_command_credential_source(
     // runs host-side, unsandboxed. Strip any PATH entry the sandbox could
     // write to before spawning, so it can't plant a trojan for this lookup
     // to find.
-    let safe_path = nono::sanitize_broker_path_for_binary(
+    let safe_path = nono::safe_broker_path_for_binary(
         &std::env::var("PATH").unwrap_or_default(),
         command,
         outer_caps,
-    );
+    )
+    .ok_or_else(|| {
+        NonoError::SandboxInit(format!(
+            "cannot resolve supervisor credential source '{command}': \
+             no remaining PATH entry is safe for this sandbox"
+        ))
+    })?;
     let mut child = Command::new(command)
         .args(args)
         .env("PATH", &safe_path)
@@ -5371,6 +5383,38 @@ mod tests {
         assert_eq!(result.trim(), "real-secret");
     }
 
+    #[cfg(unix)]
+    #[test]
+    fn load_command_credential_source_rejects_empty_sanitized_path() {
+        use nono::{AccessMode, CapabilitySource, FsCapability};
+
+        let root = tempfile::tempdir().expect("tempdir");
+        let writable_dir = root.path().join("writable-bin");
+        std::fs::create_dir_all(&writable_dir).expect("mkdir writable");
+        let mut caps = CapabilitySet::new();
+        caps.add_fs(FsCapability {
+            original: writable_dir.clone(),
+            resolved: nono::try_canonicalize(&writable_dir),
+            access: AccessMode::ReadWrite,
+            is_file: false,
+            source: CapabilitySource::User,
+        });
+
+        let _guard = match crate::test_env::ENV_LOCK.lock() {
+            Ok(g) => g,
+            Err(p) => p.into_inner(),
+        };
+        let path = writable_dir.display().to_string();
+        let _env = crate::test_env::EnvVarGuard::set_all(&[("PATH", &path)]);
+        let err = load_command_credential_source("mycreds", &[], None, &caps)
+            .expect_err("empty sanitized PATH must fail before spawning credentials command");
+
+        assert!(
+            err.to_string().contains("no remaining PATH entry is safe"),
+            "unexpected error: {err}"
+        );
+    }
+
     #[test]
     fn resolve_capture_command_malformed_reference_still_errors() {
         let result = resolve_capture_command("foo/bar", &nono::CapabilitySet::default());
```

**File**: `crates/nono-cli/src/tool-sandbox/dynamic_providers.rs` (modified, +32/-2)
```diff
@@ -432,7 +432,7 @@ pub(super) mod git {
     /// reading the process environment, so tests can exercise PATH
     /// resolution without mutating global process state (unsafe under a
     /// parallel test runner).
-    fn run_with_path(
+    pub(super) fn run_with_path(
         cwd: Option<&Path>,
         global_config_override: Option<&Path>,
         ambient_path: &str,
@@ -448,7 +448,13 @@ pub(super) mod git {
         // `capability_ext.rs`) — not the final set, but enough to catch a
         // sandbox-writable PATH directory from a literal `filesystem.allow`
         // entry processed earlier in the same profile.
-        let safe_path = nono::sanitize_broker_path_for_binary(ambient_path, "git", outer_caps);
+        let safe_path = nono::safe_broker_path_for_binary(ambient_path, "git", outer_caps)
+            .ok_or_else(|| {
+                NonoError::ProfileParse(
+                    "cannot resolve 'git': no remaining PATH entry is safe for this sandbox"
+                        .to_string(),
+                )
+            })?;
         cmd.env("PATH", &safe_path);
         if let Some(d) = cwd {
             cmd.current_dir(d);
@@ -615,6 +621,30 @@ pub(crate) fn expand_dynamic_tokens(
 mod tests {
     use super::*;
 
+    #[test]
+    fn git_config_rejects_empty_sanitized_path() {
+        use nono::{AccessMode, CapabilitySet, CapabilitySource, FsCapability};
+
+        let root = tempfile::tempdir().expect("tempdir");
+        let writable_bin = root.path().join("bin");
+        std::fs::create_dir_all(&writable_bin).expect("mkdir");
+        let mut caps = CapabilitySet::new();
+        caps.add_fs(FsCapability {
+            original: writable_bin.clone(),
+            resolved: nono::try_canonicalize(&writable_bin),
+            access: AccessMode::ReadWrite,
+            is_file: false,
+            source: CapabilitySource::User,
+        });
+
+        let err = git::run_with_path(None, None, &writable_bin.display().to_string(), &caps)
+            .expect_err("empty sanitized PATH must fail before spawning git");
+        assert!(
+            err.to_string().contains("no remaining PATH entry is safe"),
+            "unexpected error: {err}"
+        );
+    }
+
     #[test]
     fn parse_token_recognises_at_provider_colon_query() {
         assert_eq!(
```

**File**: `crates/nono-cli/src/tool-sandbox/policy.rs` (modified, +40/-6)
```diff
@@ -443,15 +443,17 @@ fn load_command_credential_source(
     // runs host-side, unsandboxed. Strip any PATH entry the sandbox could
     // write to before spawning, so it can't plant a trojan for this lookup
     // to find.
-    // `command` may be a bare name resolved by PATH lookup, and this process
-    // runs host-side, unsandboxed. Strip any PATH entry the sandbox could
-    // write to before spawning, so it can't plant a trojan for this lookup
-    // to find.
-    let safe_path = nono::sanitize_broker_path_for_binary(
+    let safe_path = nono::safe_broker_path_for_binary(
         &std::env::var("PATH").unwrap_or_default(),
         command,
         outer_caps,
-    );
+    )
+    .ok_or_else(|| {
+        nono::NonoError::SandboxInit(format!(
+            "cannot resolve supervisor credential source '{command}': \
+             no remaining PATH entry is safe for this sandbox"
+        ))
+    })?;
     let mut child = std::process::Command::new(command)
         .args(args)
         .env("PATH", &safe_path)
@@ -1466,4 +1468,36 @@ mod intercept_tests {
         );
         assert_eq!(String::from_utf8_lossy(&result).trim(), "real-secret");
     }
+
+    #[cfg(unix)]
+    #[test]
+    fn load_command_credential_source_rejects_empty_sanitized_path() {
+        use nono::{AccessMode, CapabilitySource, FsCapability};
+
+        let root = tempfile::tempdir().expect("tempdir");
+        let writable_dir = root.path().join("writable-bin");
+        std::fs::create_dir_all(&writable_dir).expect("mkdir writable");
+        let mut caps = nono::CapabilitySet::new();
+        caps.add_fs(FsCapability {
+            original: writable_dir.clone(),
+            resolved: nono::try_canonicalize(&writable_dir),
+            access: AccessMode::ReadWrite,
+            is_file: false,
+            source: CapabilitySource::User,
+        });
+
+        let _guard = match crate::test_env::ENV_LOCK.lock() {
+            Ok(g) => g,
+            Err(p) => p.into_inner(),
+        };
+        let path = writable_dir.display().to_string();
+        let _env = crate::test_env::EnvVarGuard::set_all(&[("PATH", &path)]);
+        let err = load_command_credential_source("mycreds", &[], None, &caps)
+            .expect_err("empty sanitized PATH must fail before spawning credentials command");
+
+        assert!(
+            err.to_string().contains("no remaining PATH entry is safe"),
+            "unexpected error: {err}"
+        );
+    }
 }
```

**File**: `crates/nono-cli/src/url_open.rs` (modified, +40/-2)
```diff
@@ -86,11 +86,17 @@ pub(crate) fn open_url_in_browser(
     #[cfg(target_os = "linux")]
     const BROWSER_OPENER: &str = "xdg-open";
     #[cfg(any(target_os = "macos", target_os = "linux"))]
-    let safe_path = nono::sanitize_broker_path_for_binary(
+    let safe_path = nono::safe_broker_path_for_binary(
         &std::env::var("PATH").unwrap_or_default(),
         BROWSER_OPENER,
         outer_caps,
-    );
+    )
+    .ok_or_else(|| {
+        format!(
+            "Cannot launch browser: no remaining PATH entry is safe for resolving \
+             '{BROWSER_OPENER}' in this sandbox"
+        )
+    })?;
 
     #[cfg(target_os = "macos")]
     let result = std::process::Command::new("open")
@@ -274,6 +280,38 @@ mod tests {
         );
     }
 
+    #[cfg(any(target_os = "macos", target_os = "linux"))]
+    #[test]
+    fn open_url_in_browser_rejects_empty_sanitized_path() {
+        use nono::{AccessMode, CapabilitySource, FsCapability};
+
+        let root = tempfile::tempdir().expect("tempdir");
+        let writable_dir = root.path().join("writable-bin");
+        std::fs::create_dir_all(&writable_dir).expect("mkdir writable");
+        let mut caps = nono::CapabilitySet::new();
+        caps.add_fs(FsCapability {
+            original: writable_dir.clone(),
+            resolved: nono::try_canonicalize(&writable_dir),
+            access: AccessMode::ReadWrite,
+            is_file: false,
+            source: CapabilitySource::User,
+        });
+
+        let _guard = match crate::test_env::ENV_LOCK.lock() {
+            Ok(g) => g,
+            Err(p) => p.into_inner(),
+        };
+        let path = writable_dir.display().to_string();
+        let _env = crate::test_env::EnvVarGuard::set_all(&[("PATH", &path)]);
+        let err = open_url_in_browser("https://example.com/callback", &caps)
+            .expect_err("empty sanitized PATH must fail before spawning browser opener");
+
+        assert!(
+            err.contains("no remaining PATH entry is safe"),
+            "unexpected error: {err}"
+        );
+    }
+
     #[test]
     fn origin_includes_port() {
         // A listed origin without a port must not match a URL with a port.
```

**File**: `crates/nono/src/broker_path.rs` (modified, +52/-0)
```diff
@@ -37,6 +37,12 @@ pub fn sanitize_broker_path(path_value: &str, outer_caps: &CapabilitySet) -> Str
 /// Every real broker call site knows the binary name it's about to resolve
 /// (`open`, `xdg-open`, `op`, `bw`, `security`, or a profile-configured
 /// command), so this is the check they should use.
+///
+/// This low-level function may return an empty string when every entry is
+/// removed. Do not pass that value to [`std::process::Command`]: on Unix an
+/// empty `PATH` can resolve a bare command name from the current directory.
+/// Host-side command brokers should use [`safe_broker_path_for_binary`],
+/// which represents that case as `None`, instead.
 #[must_use]
 pub fn sanitize_broker_path_for_binary(
     path_value: &str,
@@ -52,6 +58,20 @@ pub fn sanitize_broker_path_for_binary(
     })
 }
 
+/// Return a sanitized, non-empty `PATH` for a host-side bare-name lookup.
+///
+/// `None` means no search directory can be proven read-only to the sandbox.
+/// Callers must fail closed without spawning the command in that case.
+#[must_use]
+pub fn safe_broker_path_for_binary(
+    path_value: &str,
+    binary_name: &str,
+    outer_caps: &CapabilitySet,
+) -> Option<String> {
+    let safe_path = sanitize_broker_path_for_binary(path_value, binary_name, outer_caps);
+    (!safe_path.is_empty()).then_some(safe_path)
+}
+
 /// Return every `PATH` entry the sandbox can write to, whole directories and
 /// individually-exposed files alike.
 ///
@@ -452,6 +472,38 @@ mod tests {
         assert_eq!(sanitize_broker_path_for_binary(&path, "ocm", &caps), path);
     }
 
+    #[test]
+    fn safe_path_for_binary_rejects_empty_sanitized_path() {
+        let dir = tempfile::tempdir().expect("tempdir");
+        let bin = dir.path().join("bin");
+        std::fs::create_dir_all(&bin).expect("mkdir");
+        let caps = caps_with_write(&bin);
+
+        assert_eq!(
+            safe_broker_path_for_binary(&bin.display().to_string(), "ocm", &caps),
+            None
+        );
+    }
+
+    #[test]
+    fn safe_path_for_binary_returns_remaining_safe_entries() {
+        let dir = tempfile::tempdir().expect("tempdir");
+        let writable = dir.path().join("writable");
+        let safe = dir.path().join("safe");
+        std::fs::create_dir_all(&writable).expect("mkdir writable");
+        std::fs::create_dir_all(&safe).expect("mkdir safe");
+        let caps = caps_with_write(&writable);
+        let path = std::env::join_paths([&writable, &safe])
+            .expect("join PATH")
+            .to_string_lossy()
+            .into_owned();
+
+        assert_eq!(
+            safe_broker_path_for_binary(&path, "ocm", &caps),
+            Some(safe.display().to_string())
+        );
+    }
+
     #[cfg(unix)]
     #[test]
     fn end_to_end_file_scoped_grant_on_exact_binary_is_not_executed() {
```

**File**: `crates/nono/src/keystore.rs` (modified, +49/-8)
```diff
@@ -1157,7 +1157,7 @@ fn load_single_secret(_service: &str, account: &str) -> Result<Zeroizing<String>
 /// Build a `Command` for a bare-name host-side broker binary (`op`, `bw`,
 /// `security`), with PATH stripped of any sandbox-writable directory when
 /// `outer_caps` is provided. See [`load_secret_by_ref`] for why this matters.
-fn broker_command(program: &str, outer_caps: Option<&CapabilitySet>) -> Command {
+fn broker_command(program: &str, outer_caps: Option<&CapabilitySet>) -> Result<Command> {
     broker_command_with_path(program, &broker_ambient_path(), outer_caps)
 }
 
@@ -1180,11 +1180,19 @@ fn broker_command_with_path(
     program: &str,
     ambient_path: &str,
     outer_caps: Option<&CapabilitySet>,
-) -> Command {
+) -> Result<Command> {
     let mut command = Command::new(program);
     if let Some(caps) = outer_caps {
-        let safe_path =
-            crate::broker_path::sanitize_broker_path_for_binary(ambient_path, program, caps);
+        let safe_path = crate::broker_path::safe_broker_path_for_binary(
+            ambient_path,
+            program,
+            caps,
+        )
+        .ok_or_else(|| {
+            NonoError::KeystoreAccess(format!(
+                "cannot resolve '{program}': no remaining PATH entry is safe for this sandbox"
+            ))
+        })?;
         command.env("PATH", safe_path);
     }
     // When a test has installed a thread-local PATH, apply it even if
@@ -1195,7 +1203,7 @@ fn broker_command_with_path(
     if outer_caps.is_none() && TEST_BROKER_PATH.with(|slot| slot.borrow().is_some()) {
         command.env("PATH", ambient_path);
     }
-    command
+    Ok(command)
 }
 
 #[cfg(test)]
@@ -1247,7 +1255,7 @@ fn load_from_op(uri: &str, outer_caps: Option<&CapabilitySet>) -> Result<Zeroizi
 
     tracing::debug!("Loading secret from 1Password: {}", redact_op_uri(uri));
 
-    let mut child = broker_command("op", outer_caps)
+    let mut child = broker_command("op", outer_caps)?
         .args(["read", "--", uri])
         .stdin(Stdio::null())
         .stdout(Stdio::piped())
@@ -1333,7 +1341,7 @@ fn load_from_bw(uri: &str, outer_caps: Option<&CapabilitySet>) -> Result<Zeroizi
     } else {
         "password"
     };
-    let mut child = broker_command("bw", outer_caps)
+    let mut child = broker_command("bw", outer_caps)?
         .args(["get", bw_object, "--", item_id])
         .stdin(Stdio::null())
         .stdout(Stdio::piped())
@@ -1512,7 +1520,7 @@ fn load_from_apple_password(
             redact_apple_password_uri(uri)
         );
 
-        let mut child = broker_command("security", outer_caps)
+        let mut child = broker_command("security", outer_caps)?
             .args(["find-internet-password", "-s", server, "-a", account, "-w"])
             .stdin(Stdio::null())
             .stdout(Stdio::piped())
@@ -2176,6 +2184,7 @@ mod tests {
 
         let ambient_path = format!("{}:{}", writable_bin.display(), real_bin.display());
         let status = broker_command_with_path("op", &ambient_path, Some(&caps))
+            .expect("sanitized PATH still has a safe directory")
             .status()
             .expect("spawn op via sanitized PATH");
         assert!(status.success());
@@ -2190,6 +2199,38 @@ mod tests {
         );
     }
 
+    #[cfg(unix)]
+    #[test]
+    fn broker_command_errors_when_sanitized_path_is_empty() {
+        use crate::capability::{AccessMode, CapabilitySource, FsCapability};
+        use std::os::unix::fs::PermissionsExt;
+
+        let root = tempfile::tempdir().expect("tempdir");
+        let writable_bin = root.path().join("bin");
+        std::fs::create_dir_all(&writable_bin).expect("mkdir");
+        let cwd_op = root.path().join("op");
+        std::fs::write(&cwd_op, "#!/bin/sh\nexit 0\n").expect("write cwd op");
+        let mut perms = std::fs::metadata(&cwd_op).expect("metadata").permissions();
+        perms.set_mode(0o755);
+        std::fs::set_permissions(&cwd_op, perms).expect("chmod");
+
+        let mut caps = CapabilitySet::new();
+        caps.add_fs(FsCapability {
+            original: writable_bin.clone(),
+            resolved: crate::path::try_canonicalize(&writable_bin),
+            access: AccessMode::ReadWrite,
+            is_file: false,
+            source: CapabilitySource::User,
+        });
+
+        let err = broker_command_with_path("op", &writable_bin.display().to_string(), Some(&caps))
+            .expect_err("empty sanitized PATH must not spawn");
+        assert!(
+            err.to_string().contains("no remaining PATH entry is safe"),
+            "unexpected error: {err}"
+        );
+    }
+
     /// Regression test for a real gap found via live manual pentest:
     /// `load_secrets` (the `--env-credential` path, which runs before the
     /// sandbox for this invocation exists) always called `load_secret_by_ref`
```

**File**: `crates/nono/src/lib.rs` (modified, +4/-1)
```diff
@@ -65,7 +65,10 @@ pub mod trust;
 pub mod undo;
 
 // Re-exports for convenience
-pub use broker_path::{sanitize_broker_path, sanitize_broker_path_for_binary, writable_path_dirs};
+pub use broker_path::{
+    safe_broker_path_for_binary, sanitize_broker_path, sanitize_broker_path_for_binary,
+    writable_path_dirs,
+};
 pub use capability::{
     AccessMode, CapabilitySet, CapabilitySource, CoveringCapabilities, FsCapability, IpcMode,
     NetworkMode, ProcessInfoMode, SignalMode, SocketScope, UnixSocketCapability, UnixSocketMode,
```

---

### Incident Patch 11: `85d98749` (2026-09-28)
**Commit Message**: fix(policy): allow reading Linux MIME types (#2013)

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

**File**: `crates/nono-cli/data/policy.json` (modified, +1/-0)
```diff
@@ -231,6 +231,7 @@
           "/etc/os-release",
           "/etc/passwd",
           "/etc/services",
+          "/etc/mime.types",
           "/etc/manpath.config",
           "/etc/man_db.conf",
           "/var/cache/man",
```

**File**: `crates/nono-cli/src/policy.rs` (modified, +5/-1)
```diff
@@ -3275,7 +3275,7 @@ mod tests {
     }
 
     #[test]
-    fn test_system_read_linux_core_does_not_grant_bare_etc_or_proc() {
+    fn test_system_read_linux_core_has_narrow_etc_grants() {
         let policy = load_embedded_policy().expect("embedded policy must parse");
         let group = policy
             .groups
@@ -3287,6 +3287,10 @@ mod tests {
             .map(|a| a.read.as_slice())
             .unwrap_or(&[]);
 
+        assert!(
+            read_paths.iter().any(|p| p == "/etc/mime.types"),
+            "system_read_linux_core must grant read access to '/etc/mime.types'"
+        );
         assert!(
             !read_paths.iter().any(|p| p == "/etc"),
             "system_read_linux_core must not grant bare '/etc'; use specific paths instead. Found: {:?}",
```

---

### Incident Patch 12: `cae44eee` (2026-09-28)
**Commit Message**: fix(tool-sandbox): derive shim broker socket from executable path (#2002)

* fix(tool-sandbox): derive shim broker socket from executable path

Shim copies of the nono binary previously discovered their broker socket
through inherited environment variables (NONO_TOOL_SANDBOX_SOCKET,
NONO_TOOL_SANDBOX_SHIM_DIR, NONO_TOOL_SANDBOX_URL_SOCKET). A nested command
that sanitized its environment dropped those variables, so the shim could no
longer reach the authenticated broker and fell back toward the ordinary CLI
path (GHSA-wjv5-93q3-xm73).

Discover the broker instead from the shim's own executable location: a
recognized shim lives at <runtime-dir>/shims/<command> where <runtime-dir> is
named nono-tool-sandbox-*, and its socket (supervisor.sock, or url.sock for
the URL-open shim) sits in that runtime directory. A recognized shim now
always exits through its broker flow and never parses its argv as top-level
nono subcommands, even when the socket is missing or the broker rejects it.

These paths only select which broker to contact; the broker still
authenticates the shim, its peer process, and session ancestry, and authorizes
the command. Centralize the layout logic in a new shim module 

**File**: `crates/nono-cli/src/diagnostic/formatter.rs` (modified, +11/-5)
```diff
@@ -4501,9 +4501,15 @@ mod tests {
     #[test]
     fn test_supervised_rate_limited_denial() {
         let _env_lock = ENV_LOCK.lock().expect("env lock");
+        let dir = tempdir().expect("fixture directory");
+        let dir_path = dir
+            .path()
+            .canonicalize()
+            .expect("canonical fixture directory");
+        let denied_path = dir_path.join("flood");
         let caps = make_test_caps();
         let denials = vec![DenialRecord {
-            path: PathBuf::from("/tmp/flood"),
+            path: denied_path.clone(),
             access: AccessMode::Read,
             reason: DenialReason::RateLimited,
         }];
@@ -4513,11 +4519,11 @@ mod tests {
         let output = format_footer_with_session_report(formatter, 1);
 
         assert!(output.contains("Sandbox denial: 1 path blocked."));
-        assert!(output.contains("/tmp/flood (read)"));
+        assert!(output.contains(&format!("{} (read)", denied_path.display())));
         // Rate-limited denials are still actionable via a path flag. The
-        // suggested target falls back to the nearest existing parent since
-        // /tmp/flood itself doesn't exist.
-        assert!(output.contains("Fix flags: --read "));
+        // missing path falls back to its private fixture directory, rather than
+        // /tmp, which may contain protected state from the environment.
+        assert!(output.contains("Fix flags: --read "), "{output}");
         assert!(!output.contains("[permanently restricted]"));
     }
 
```

**File**: `crates/nono-cli/src/tool-sandbox/env.rs` (modified, +6/-44)
```diff
@@ -1,8 +1,5 @@
 use crate::command_policy::{CommandSandboxConfig, ResolvedCommandBinary};
-use crate::tool_sandbox::protocol::{
-    TOOL_SANDBOX_LAUNCH_SPEC_ENV, TOOL_SANDBOX_SHIM_DIR_ENV, TOOL_SANDBOX_SOCKET_ENV,
-    TOOL_SANDBOX_URL_SOCKET_ENV, ToolSandboxShimRequest,
-};
+use crate::tool_sandbox::protocol::ToolSandboxShimRequest;
 use nono::{NonoError, Result};
 use std::ffi::OsStr;
 use std::os::unix::ffi::OsStrExt;
@@ -189,33 +186,9 @@ pub(crate) fn override_proxy_env(env: &mut Vec<Vec<u8>>, vars: &[(String, String
     }
 }
 
-pub(crate) fn inject_chaining_control_env(
-    env: &mut Vec<Vec<u8>>,
-    socket_path: &Path,
-    shim_dir: &Path,
-) {
-    let socket_prefix = format!("{TOOL_SANDBOX_SOCKET_ENV}=");
-    let shim_dir_prefix = format!("{TOOL_SANDBOX_SHIM_DIR_ENV}=");
-    let launch_spec_prefix = format!("{TOOL_SANDBOX_LAUNCH_SPEC_ENV}=");
-    env.retain(|entry| {
-        !entry.starts_with(socket_prefix.as_bytes())
-            && !entry.starts_with(shim_dir_prefix.as_bytes())
-            && !entry.starts_with(launch_spec_prefix.as_bytes())
-    });
-    env.push(format!("{TOOL_SANDBOX_SOCKET_ENV}={}", socket_path.display()).into_bytes());
-    env.push(format!("{TOOL_SANDBOX_SHIM_DIR_ENV}={}", shim_dir.display()).into_bytes());
-}
-
-/// Inject the URL-open socket env var and `BROWSER` for a brokered child whose
-/// command declares `open_urls` or `allow_launch_services`.
-///
-/// Both vars are stripped first (a child cannot smuggle its own) then set to
-/// the runtime's URL socket and the open shim path. Needed for
-/// `allow_launch_services` too: the shim only recognizes itself as the
-/// URL-open relay when this env var is present, and a bare `open` in the
-/// child's $PATH always resolves to the shim, never straight to
-/// `/usr/bin/open`, once any command in the profile needs the shim. No-op
-/// when URL opening is not enabled for this command.
+/// Point `BROWSER` at the session's open shim for a child whose policy allows
+/// URL opening. The shim discovers the URL socket from its executable path;
+/// the broker resolves the caller and enforces its URL policy on each request.
 pub(crate) fn inject_url_open_env(
     env: &mut Vec<Vec<u8>>,
     policy: &CommandSandboxConfig,
@@ -225,16 +198,10 @@ pub(crate) fn inject_url_open_env(
     if policy.open_urls.is_none() && !policy.allow_launch_services {
         return;
     }
-    let (Some(url_socket_path), Some(shim_path)) = (url_socket_path, url_open_shim_path) else {
+    let (Some(_), Some(shim_path)) = (url_socket_path, url_open_shim_path) else {
         return;
     };
 
-    let socket_prefix = format!("{TOOL_SANDBOX_URL_SOCKET_ENV}=").into_bytes();
-    env.retain(|entry| !entry.starts_with(&socket_prefix));
-    let mut socket_entry = socket_prefix;
-    socket_entry.extend_from_slice(url_socket_path.as_os_str().as_bytes());
-    env.push(socket_entry);
-
     // Point BROWSER at the open shim so libraries that honour it route through
     // the runtime instead of attempting a (denied) direct browser launch.
     let browser_prefix = b"BROWSER=".to_vec();
@@ -849,12 +816,7 @@ mod tests {
             Some(Path::new("/tmp/shims/open")),
         );
 
-        let socket_prefix = format!("{TOOL_SANDBOX_URL_SOCKET_ENV}=").into_bytes();
-        assert!(
-            env.iter().any(|e| e.starts_with(&socket_prefix)),
-            "allow_launch_services must get the URL socket env var, since the shim only \
-             recognizes itself as the URL-open relay when it's present"
-        );
+        assert!(env.iter().all(|entry| !entry.starts_with(b"NONO_")));
         assert!(
             env.iter().any(|e| e.starts_with(b"BROWSER=")),
             "allow_launch_services must get BROWSER pointed at the shim too"
```

**File**: `crates/nono-cli/src/tool-sandbox/mod.rs` (modified, +2/-0)
```diff
@@ -72,6 +72,8 @@ mod policy;
 #[cfg(any(target_os = "linux", target_os = "macos"))]
 mod protocol;
 #[cfg(any(target_os = "linux", target_os = "macos"))]
+mod shim;
+#[cfg(any(target_os = "linux", target_os = "macos"))]
 pub(crate) mod token_broker;
 #[cfg(any(target_os = "linux", target_os = "macos"))]
 mod url_shim;
```

**File**: `crates/nono-cli/src/tool-sandbox/platform/linux.rs` (modified, +30/-124)
```diff
@@ -13,19 +13,19 @@ use crate::tool_sandbox::command_policy_decision::CommandPolicyDecision;
 use crate::tool_sandbox::credentials::{ResolvedCredential, resolve_credentials};
 use crate::tool_sandbox::env::{
     apply_environment_set_vars, apply_export_env, default_env_allow_patterns,
-    effective_argv_for_binary, env_shebang_target_interpreter, inject_chaining_control_env,
-    inject_url_open_env, split_env_entry,
+    effective_argv_for_binary, env_shebang_target_interpreter, inject_url_open_env,
+    split_env_entry,
 };
 use crate::tool_sandbox::launch::{
     exit_status_code, prepare_launcher_command, remove_launch_spec, write_launch_spec,
 };
 use crate::tool_sandbox::protocol::{
     ChildCapsSpec, FsGrantSpec, StdioFds, StdioLimitActionSpec, StdioLimitSpec,
-    StdioStreamLimitSpec, TOOL_SANDBOX_LAUNCH_SPEC_ENV, TOOL_SANDBOX_SHIM_DIR_ENV,
-    TOOL_SANDBOX_SOCKET_ENV, TOOL_SANDBOX_URL_IO_TIMEOUT, ToolSandboxChildLaunchSpec,
-    ToolSandboxOpenUrlRequest, ToolSandboxOpenUrlResponse, ToolSandboxShimRequest,
-    ToolSandboxShimResponse, UnixSocketGrantSpec, read_frame, recv_frame_ack, recv_stdio_fds,
-    send_frame_ack, send_stdio_fds, validate_ipc_request, write_frame, write_response,
+    StdioStreamLimitSpec, TOOL_SANDBOX_LAUNCH_SPEC_ENV, TOOL_SANDBOX_URL_IO_TIMEOUT,
+    ToolSandboxChildLaunchSpec, ToolSandboxOpenUrlRequest, ToolSandboxOpenUrlResponse,
+    ToolSandboxShimRequest, ToolSandboxShimResponse, UnixSocketGrantSpec, read_frame,
+    recv_frame_ack, recv_stdio_fds, send_frame_ack, send_stdio_fds, validate_ipc_request,
+    write_frame, write_response,
 };
 use landlock::{
     AccessFs, CompatLevel, Compatible, PathBeneath, PathFd, Ruleset, RulesetAttr,
@@ -447,17 +447,7 @@ impl PreparedToolSandboxRuntime {
     }
 
     pub(crate) fn env_overrides(&self) -> Vec<(String, String)> {
-        vec![
-            ("PATH".to_string(), self.inner.session_path.clone()),
-            (
-                TOOL_SANDBOX_SOCKET_ENV.to_string(),
-                self.inner.socket_path.display().to_string(),
-            ),
-            (
-                TOOL_SANDBOX_SHIM_DIR_ENV.to_string(),
-                self.inner.shim_dir.display().to_string(),
-            ),
-        ]
+        vec![("PATH".to_string(), self.inner.session_path.clone())]
     }
 
     pub(crate) fn broker_secret_env_vars(
@@ -723,60 +713,26 @@ pub(crate) fn maybe_run_internal_tool_sandbox_entrypoint() -> bool {
         return true;
     }
 
-    // The browser-open shim is also a copy of the nono binary; detect it before
-    // the generic shim path since it does not use the shim handshake socket.
-    if crate::tool_sandbox::url_shim::current_exe_is_url_open_shim() {
-        exit_from_result(crate::tool_sandbox::url_shim::run_url_open_shim());
-        return true;
-    }
-
-    if std::env::var_os(TOOL_SANDBOX_SOCKET_ENV).is_some()
-        && std::env::var_os(TOOL_SANDBOX_SHIM_DIR_ENV).is_some()
-        && current_exe_is_tool_sandbox_shim()
-    {
-        exit_from_result(run_shim());
-        return true;
-    }
-
-    // A shim copy with a missing/invalid handshake must not fall through to
-    // Cli::parse(), which would parse its argv as top-level nono subcommands
-    // (ps, stop, rollback, ...) against unrelated sessions.
-    if current_exe_is_tool_sandbox_shim_copy_by_path() {
-        exit_from_result(Err(NonoError::SandboxInit(
-            "running as a command-mediation shim copy but the broker handshake \
-             (NONO_TOOL_SANDBOX_SOCKET / NONO_TOOL_SANDBOX_SHIM_DIR) is missing \
-             or invalid; refusing rather than falling back to the nono CLI"
-                .to_string(),
-        )));
-        return true;
-    }
-
-    false
-}
-
-/// Identity check independent of [`TOOL_SANDBOX_SHIM_DIR_ENV`]; used only to
-/// refuse execution, never to grant broker access.
-fn current_exe_is_tool_sandbox_shim_copy_by_path() -> bool {
-    std::env::current_exe()
-        .map(|exe| path_has_tool_sandbox_shim_shape(&exe))
-        .unwrap_or(false)
-}
-
-fn path_has_tool_sandbox_shim_shape(exe: &Path) -> bool {
-    let Some(shims_dir) = exe.parent() else {
-        return false;
+    let shim = match crate::tool_sandbox::shim::Shim::current() {
+        Ok(Some(shim)) => shim,
+        Ok(None) => return false,
+        Err(err) => {
+            exit_from_result(Err(err));
+            return true;
+        }
     };
-    if shims_dir.file_name().and_then(OsStr::to_str) != Some("shims") {
-        return false;
+    // A recognized shim always exits through its broker flow, including when
+    // the socket is missing or the broker rejects it. Never parse shim argv as
+    // top-level nono subcommands (ps, stop, rollback, ...).
+    let socket_path = shim.socket_path();
+    if shim.is_url_open() {
+        exit_from_result(crate::tool_sandbox::url_shim::run_url_open_shim(
+            &socket_path,
+        ));
+    } else {
+        exit_from_result(run_shim(&shim.exe, &socket_path));

```

**File**: `crates/nono-cli/src/tool-sandbox/platform/macos.rs` (modified, +40/-133)
```diff
@@ -10,19 +10,19 @@ use crate::tool_sandbox::command_policy_decision::CommandPolicyDecision;
 use crate::tool_sandbox::credentials::{ResolvedCredential, resolve_credentials};
 use crate::tool_sandbox::env::{
     apply_environment_set_vars, apply_export_env, default_env_allow_patterns,
-    effective_argv_for_binary, env_shebang_target_interpreter, inject_chaining_control_env,
-    inject_url_open_env, split_env_entry,
+    effective_argv_for_binary, env_shebang_target_interpreter, inject_url_open_env,
+    split_env_entry,
 };
 use crate::tool_sandbox::launch::{
     exit_status_code, prepare_launcher_command, remove_launch_spec, write_launch_spec,
 };
 use crate::tool_sandbox::protocol::{
     ChildCapsSpec, FsGrantSpec, StdioFds, StdioLimitActionSpec, StdioLimitSpec,
-    StdioStreamLimitSpec, TOOL_SANDBOX_LAUNCH_SPEC_ENV, TOOL_SANDBOX_SHIM_DIR_ENV,
-    TOOL_SANDBOX_SOCKET_ENV, TOOL_SANDBOX_URL_IO_TIMEOUT, ToolSandboxChildLaunchSpec,
-    ToolSandboxOpenUrlRequest, ToolSandboxOpenUrlResponse, ToolSandboxShimRequest,
-    ToolSandboxShimResponse, UnixSocketGrantSpec, read_frame, recv_frame_ack, recv_stdio_fds,
-    send_frame_ack, send_stdio_fds, validate_ipc_request, write_frame, write_response,
+    StdioStreamLimitSpec, TOOL_SANDBOX_LAUNCH_SPEC_ENV, TOOL_SANDBOX_URL_IO_TIMEOUT,
+    ToolSandboxChildLaunchSpec, ToolSandboxOpenUrlRequest, ToolSandboxOpenUrlResponse,
+    ToolSandboxShimRequest, ToolSandboxShimResponse, UnixSocketGrantSpec, read_frame,
+    recv_frame_ack, recv_stdio_fds, send_frame_ack, send_stdio_fds, validate_ipc_request,
+    write_frame, write_response,
 };
 use nix::libc;
 use nix::sys::signal::{self, Signal};
@@ -388,19 +388,9 @@ impl PreparedToolSandboxRuntime {
     }
 
     /// Returns environment overrides to inject into the child process.
-    /// Prepends the shim directory to PATH and sets command-mediation socket variables.
+    /// Prepends the session shim directory to PATH for command lookup.
     pub(crate) fn env_overrides(&self) -> Vec<(String, String)> {
-        vec![
-            ("PATH".to_string(), self.inner.session_path.clone()),
-            (
-                TOOL_SANDBOX_SOCKET_ENV.to_string(),
-                self.inner.socket_path.display().to_string(),
-            ),
-            (
-                TOOL_SANDBOX_SHIM_DIR_ENV.to_string(),
-                self.inner.shim_dir.display().to_string(),
-            ),
-        ]
+        vec![("PATH".to_string(), self.inner.session_path.clone())]
     }
 
     pub(crate) fn broker_secret_env_vars(
@@ -605,35 +595,26 @@ pub(crate) fn maybe_run_internal_tool_sandbox_entrypoint() -> bool {
         return true;
     }
 
-    // The browser-open shim is also a copy of the nono binary; detect it before
-    // the generic shim path since it does not use the shim handshake socket.
-    if crate::tool_sandbox::url_shim::current_exe_is_url_open_shim() {
-        exit_from_result(crate::tool_sandbox::url_shim::run_url_open_shim());
-        return true;
-    }
-
-    if std::env::var_os(TOOL_SANDBOX_SOCKET_ENV).is_some()
-        && std::env::var_os(TOOL_SANDBOX_SHIM_DIR_ENV).is_some()
-        && current_exe_is_tool_sandbox_shim()
-    {
-        exit_from_result(run_shim());
-        return true;
-    }
-
-    // A shim copy with a missing/invalid handshake must not fall through to
-    // Cli::parse(), which would parse its argv as top-level nono subcommands
-    // (ps, stop, rollback, ...) against unrelated sessions.
-    if current_exe_is_tool_sandbox_shim_copy_by_path() {
-        exit_from_result(Err(NonoError::SandboxInit(
-            "running as a command-mediation shim copy but the broker handshake \
-             (NONO_TOOL_SANDBOX_SOCKET / NONO_TOOL_SANDBOX_SHIM_DIR) is missing \
-             or invalid; refusing rather than falling back to the nono CLI"
-                .to_string(),
-        )));
-        return true;
+    let shim = match crate::tool_sandbox::shim::Shim::current() {
+        Ok(Some(shim)) => shim,
+        Ok(None) => return false,
+        Err(err) => {
+            exit_from_result(Err(err));
+            return true;
+        }
+    };
+    // A recognized shim always exits through its broker flow, including when
+    // the socket is missing or the broker rejects it. Never parse shim argv as
+    // top-level nono subcommands (ps, stop, rollback, ...).
+    let socket_path = shim.socket_path();
+    if shim.is_url_open() {
+        exit_from_result(crate::tool_sandbox::url_shim::run_url_open_shim(
+            &socket_path,
+        ));
+    } else {
+        exit_from_result(run_shim(&shim.exe, &socket_path));
     }
-
-    false
+    true
 }
 
 pub(crate) fn record_main_start() {}
@@ -649,50 +630,10 @@ fn exit_from_result(result: Result<()>) {
     }
 }
 
-fn current_exe_is_tool_sandbox_shim() -> bool {
-    let Some(shim_dir) = std::env::var_os(TOOL_SANDBOX_SHIM_DIR_ENV).map(PathBuf::from) else {
-        return false;
-    };
-    let Ok(exe) = std::env::current_exe() else {
```

**File**: `crates/nono-cli/src/tool-sandbox/protocol.rs` (modified, +0/-5)
```diff
@@ -6,12 +6,7 @@ use std::io::{Read, Write};
 use std::os::fd::{AsRawFd, OwnedFd};
 use std::os::unix::net::UnixStream;
 
-pub(crate) const TOOL_SANDBOX_SOCKET_ENV: &str = "NONO_TOOL_SANDBOX_SOCKET";
-pub(crate) const TOOL_SANDBOX_SHIM_DIR_ENV: &str = "NONO_TOOL_SANDBOX_SHIM_DIR";
 pub(crate) const TOOL_SANDBOX_LAUNCH_SPEC_ENV: &str = "NONO_TOOL_SANDBOX_LAUNCH_SPEC";
-/// Path to the runtime's dedicated URL-open listener socket. Injected into the
-/// brokered child so the open-url helper can reach the unsandboxed runtime.
-pub(crate) const TOOL_SANDBOX_URL_SOCKET_ENV: &str = "NONO_TOOL_SANDBOX_URL_SOCKET";
 
 /// Read/write timeout the runtime applies to an accepted URL-open connection so
 /// a slow or idle client cannot stall the handler (and, on Linux, the
```

**File**: `crates/nono-cli/src/tool-sandbox/shim.rs` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+//! Session-local broker discovery for copies of the nono executable.
+//!
+//! These paths only select a broker. The broker must still authenticate the
+//! shim, its peer process and session ancestry, and authorize the command.
+
+use nono::{NonoError, Result};
+use std::ffi::OsStr;
+use std::path::{Path, PathBuf};
+
+pub(crate) struct Shim {
+    pub(crate) exe: PathBuf,
+    runtime_dir: PathBuf,
+}
+
+impl Shim {
+    pub(crate) fn current() -> Result<Option<Self>> {
+        let exe = std::env::current_exe().map_err(|err| {
+            NonoError::SandboxInit(format!(
+                "tool-sandbox failed to locate current executable: {err}"
+            ))
+        })?;
+        Ok(Self::from_exe(exe))
+    }
+
+    fn from_exe(exe: PathBuf) -> Option<Self> {
+        let runtime_dir = runtime_dir_for_shim(&exe)?.to_path_buf();
+        Some(Self { exe, runtime_dir })
+    }
+
+    pub(crate) fn is_url_open(&self) -> bool {
+        self.exe.file_name() == Some(OsStr::new(super::url_shim::URL_OPEN_SHIM_NAME))
+    }
+
+    pub(crate) fn socket_path(&self) -> PathBuf {
+        self.runtime_dir.join(if self.is_url_open() {
+            "url.sock"
+        } else {
+            "supervisor.sock"
+        })
+    }
+}
+
+fn runtime_dir_for_shim(exe: &Path) -> Option<&Path> {
+    let shims_dir = exe.parent()?;
+    if shims_dir.file_name() != Some(OsStr::new("shims")) {
+        return None;
+    }
+    let runtime_dir = shims_dir.parent()?;
+    let name = runtime_dir.file_name()?.to_str()?;
+    name.starts_with("nono-tool-sandbox-")
+        .then_some(runtime_dir)
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn discovers_session_sockets_without_requiring_them_to_exist() {
+        for root in ["/tmp", "/private/tmp", "/custom/runtime"] {
+            let runtime = Path::new(root).join("nono-tool-sandbox-abc123");
+            for (name, socket) in [("git", "supervisor.sock"), ("open", "url.sock")] {
+                let exe = runtime.join("shims").join(name);
+                let shim = Shim::from_exe(exe.clone()).expect("shim layout");
+                assert_eq!(shim.exe, exe);
+                assert_eq!(shim.socket_path(), runtime.join(socket));
+            }
+        }
+    }
+
+    #[test]
+    fn rejects_paths_outside_the_session_shim_layout() {
+        for path in [
+            "/usr/local/bin/nono",
+            "/tmp/notshim/git",
+            "/tmp/nono-tool-sandbox-abc123/git",
+            "/tmp/other/shims/git",
+            "/tmp/nono-tool-sandbox-abc123/shims-extra/git",
+            "/tmp/nono-tool-sandbox-abc123/shims/nested/git",
+            "/tmp/nono-tool-sandboxish/shims/git",
+        ] {
+            assert!(Shim::from_exe(PathBuf::from(path)).is_none(), "{path}");
+        }
+    }
+}
```

**File**: `crates/nono-cli/src/tool-sandbox/url_shim.rs` (modified, +5/-29)
```diff
@@ -5,53 +5,29 @@
 //! an OAuth2 login it instead execs the `open` shim — a copy of the nono binary
 //! materialized in the shim directory and therefore exec-allowed. When invoked
 //! that way, this helper connects to the runtime's dedicated URL listener
-//! socket (`NONO_TOOL_SANDBOX_URL_SOCKET`) and asks the unsandboxed runtime to
+//! socket (discovered relative to its executable) and asks the unsandboxed runtime to
 //! validate and open the URL.
 //!
 //! The runtime resolves the requesting command from the connecting PID, so the
 //! `command` field on the request is advisory (audit only) and is never trusted
 //! for the origin allow-list decision.
 
 use crate::tool_sandbox::protocol::{
-    TOOL_SANDBOX_URL_SOCKET_ENV, ToolSandboxOpenUrlRequest, ToolSandboxOpenUrlResponse, read_frame,
-    write_frame,
+    ToolSandboxOpenUrlRequest, ToolSandboxOpenUrlResponse, read_frame, write_frame,
 };
 use nono::{NonoError, Result};
 use std::os::unix::net::UnixStream;
-use std::path::PathBuf;
+use std::path::Path;
 
 /// Reserved shim name used to intercept browser opens inside a brokered child.
 pub(crate) const URL_OPEN_SHIM_NAME: &str = "open";
 
-/// Returns true if the current process is the brokered-child URL-open shim:
-/// invoked as the reserved shim name with the URL socket env var present.
-pub(crate) fn current_exe_is_url_open_shim() -> bool {
-    if std::env::var_os(TOOL_SANDBOX_URL_SOCKET_ENV).is_none() {
-        return false;
-    }
-    let Ok(exe) = std::env::current_exe() else {
-        return false;
-    };
-    exe.file_name()
-        .and_then(|name| name.to_str())
-        .is_some_and(|name| name == URL_OPEN_SHIM_NAME)
-}
-
 /// Entry point for the brokered-child URL-open shim.
 ///
 /// Scans argv for the first `http(s)://` URL, forwards it to the runtime over
 /// the URL listener socket, and exits with success only if the runtime opened
 /// the browser.
-pub(crate) fn run_url_open_shim() -> Result<()> {
-    let socket_path = std::env::var_os(TOOL_SANDBOX_URL_SOCKET_ENV)
-        .map(PathBuf::from)
-        .ok_or_else(|| {
-            NonoError::SandboxInit(
-                "command-mediation URL-open shim invoked without NONO_TOOL_SANDBOX_URL_SOCKET"
-                    .to_string(),
-            )
-        })?;
-
+pub(crate) fn run_url_open_shim(socket_path: &Path) -> Result<()> {
     // A non-UTF-8 argument cannot be an http(s) URL
     let url = std::env::args_os()
         .skip(1)
@@ -70,7 +46,7 @@ pub(crate) fn run_url_open_shim() -> Result<()> {
         url: url.clone(),
     };
 
-    let mut stream = UnixStream::connect(&socket_path).map_err(|err| {
+    let mut stream = UnixStream::connect(socket_path).map_err(|err| {
         NonoError::SandboxInit(format!(
             "command-mediation URL-open shim failed to connect to {}: {err}",
             socket_path.display()
```

---

### Incident Patch 13: `c15cfa6e` (2026-09-28)
**Commit Message**: fix(cli): audit approval backend decisions prior to file operations (#2010)

Record capability audit logs immediately after the approval backend makes a decision, ensuring decisions are logged even if subsequent file opening operations fail. Introduce a flag to prevent double-recording the decision when handling the final socket response.

Signed-off-by: Luke Hinds <[REDACTED_EMAIL]>

**File**: `crates/nono-cli/src/exec_strategy.rs` (modified, +38/-22)
```diff
@@ -3339,6 +3339,9 @@ fn handle_supervisor_message(
             // Set by the trust interceptor branch when an instruction file is verified.
             let mut verified_digest: Option<String> = None;
 
+            // Track whether the approval backend decision was recorded, to avoid double-recording
+            let mut backend_decision_recorded = false;
+
             let decision = if let Some(protected_root) =
                 crate::protected_paths::overlapping_protected_root(
                     &request.path,
@@ -3380,7 +3383,7 @@ fn handle_supervisor_message(
                         // Stash the verified digest for TOCTOU re-check at open time
                         verified_digest = Some(verified.digest);
                         // Instruction file verified — proceed to approval backend
-                        match request_approval_with_relay_paused(
+                        let backend_decision = match request_approval_with_relay_paused(
                             config,
                             &nono::supervisor::ApprovalRequest::from(request.clone()),
                             pty.as_deref_mut(),
@@ -3412,7 +3415,17 @@ fn handle_supervisor_message(
                                     reason: format!("Approval backend error: {e}"),
                                 }
                             }
-                        }
+                        };
+                        // Record the approval backend decision immediately, so it's captured in audit
+                        // even if file operations fail afterward.
+                        record_capability_audit(
+                            config,
+                            nono::supervisor::ApprovalRequest::from(request.clone()),
+                            decision_started,
+                            backend_decision.clone(),
+                        )?;
+                        backend_decision_recorded = true;
+                        backend_decision
                     }
                     Err(reason) => {
                         // Instruction file failed trust verification — auto-deny
@@ -3436,7 +3449,7 @@ fn handle_supervisor_message(
                 }
             } else {
                 // 3. Delegate to approval backend (non-instruction files)
-                match request_approval_with_relay_paused(
+                let backend_decision = match request_approval_with_relay_paused(
                     config,
                     &nono::supervisor::ApprovalRequest::from(request.clone()),
                     pty,
@@ -3468,7 +3481,17 @@ fn handle_supervisor_message(
                             reason: format!("Approval backend error: {e}"),
                         }
                     }
-                }
+                };
+                // Record the approval backend decision immediately, so it's captured in audit
+                // even if file operations fail afterward.
+                record_capability_audit(
+                    config,
+                    nono::supervisor::ApprovalRequest::from(request.clone()),
+                    decision_started,
+                    backend_decision.clone(),
+                )?;
+                backend_decision_recorded = true;
+                backend_decision
             };
 
             // 3. If granted, open the path and send fd before the response
@@ -3490,12 +3513,7 @@ fn handle_supervisor_message(
                                 },
                             };
                             sock.send_response(&response)?;
-                            record_capability_audit(
-                                config,
-                                nono::supervisor::ApprovalRequest::from(request),
-                                decision_started,
-                                response_decision(&response),
-                            )?;
+                            // File operation failure is recorded, but the backend approval was already recorded above
                             return Ok(());
                         }
                     }
@@ -3508,12 +3526,7 @@ fn handle_supervisor_message(
                             },
                         };
                         sock.send_response(&response)?;
-                        record_capability_audit(
-                            config,
-                            nono::supervisor::ApprovalRequest::from(request),
-                            decision_started,
-                            response_decision(&response),
-                        )?;
+                        // File operation failure is recorded, but the backend approval was already recorded above
                         return Ok(());
                     }
                 }
@@ -3525,12 +3538,15 @@ fn handle_supervisor_message(
                 decision,
             };
             sock.send_response(&response)?;
-            record_capability_audit(
-                config,
-                nono
```

---

### Incident Patch 14: `1678d8fc` (2026-09-27)
**Commit Message**: feat(cli): render proxy network denials in diagnostic footer (#1992)

* feat(cli): render proxy network denials in diagnostic footer

Include authoritative network denial events captured by the local proxy
in the session diagnostic summary upon exit.

- Expose `snapshot_audit_events` on `ProxyHandle` to inspect proxy event logs without clearing them prior to session finalization
- Add network denial tracking to `DiagnosticFormatter` and update guidance generation logic
- Suppress generic "unrelated to sandbox" hints when network denials were observed
- Deduplicate and sanitize hostnames and reasons in the output to prevent ansi escape sequence injection

Closes: #1989

Signed-off-by: Luke Hinds <[REDACTED_EMAIL]>

* fix(cli): validate network targets before generating domain suggestions

Restrict `--allow-domain` suggestions in supervised diagnostic footers to targets containing strictly valid hostname characters.

Because network denial targets originate from agent-controlled requests, shell metacharacters could survive control-character sanitization and be evaluated if copied into a host terminal.

- Add `is_shell_safe_hostname` to filter out targets with spaces, semicolons, comm

**File**: `crates/nono-cli/src/audit_commands.rs` (modified, +1/-1)
```diff
@@ -953,7 +953,7 @@ fn change_symbol(ct: &nono::undo::ChangeType) -> colored::ColoredString {
     }
 }
 
-fn network_mode_label(mode: &nono::undo::NetworkAuditMode) -> &'static str {
+pub(crate) fn network_mode_label(mode: &nono::undo::NetworkAuditMode) -> &'static str {
     match mode {
         nono::undo::NetworkAuditMode::Connect => "connect",
         nono::undo::NetworkAuditMode::ConnectIntercept => "connect_intercept",
```

**File**: `crates/nono-cli/src/diagnostic/formatter.rs` (modified, +311/-2)
```diff
@@ -353,6 +353,39 @@ fn format_command_failed_not_sandbox_line(exit_code: i32) -> String {
     )
 }
 
+/// Whether a proxy-denied target is safe to embed in a copy-pasteable
+/// `--allow-domain` suggestion.
+///
+/// The target originates from an agent-controlled connection request.
+/// `sanitize_for_diagnostic` strips control characters and ANSI escapes,
+/// but shell metacharacters (`;`, `|`, `$()`, backticks, spaces, quotes)
+/// survive it — and a suggestion line is exactly the text a supervisor may
+/// copy into a shell. Only the strict hostname alphabet is allowed; anything
+/// else is displayed in the denial listing but never offered as a command.
+fn is_shell_safe_hostname(host: &str) -> bool {
+    !host.is_empty()
+        && host
+            .chars()
+            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' | '*'))
+}
+
+/// Footer label for a network audit decision.
+///
+/// Allow-class decisions never reach the footer (the caller filters to
+/// denials), but the match stays total and honest so a variant slipping
+/// through is labeled as what it is, never misreported as a denial.
+fn network_denial_decision_label(decision: &nono::undo::NetworkAuditDecision) -> &'static str {
+    match decision {
+        nono::undo::NetworkAuditDecision::Deny => "deny",
+        nono::undo::NetworkAuditDecision::ApproveDenied => "approval_denied",
+        nono::undo::NetworkAuditDecision::ApproveTimeout => "approval_timeout",
+        nono::undo::NetworkAuditDecision::ApproveError => "approval_error",
+        nono::undo::NetworkAuditDecision::Allow => "allow",
+        nono::undo::NetworkAuditDecision::ApproveRequested => "approval_requested",
+        nono::undo::NetworkAuditDecision::ApproveGranted => "approval_granted",
+    }
+}
+
 fn format_allow_net_help_line() -> String {
     "[nono]   --allow-net        unrestricted network for this session".to_string()
 }
@@ -641,6 +674,11 @@ pub struct DiagnosticFormatter<'a> {
     canonical_denial_paths: Vec<PathBuf>,
     /// Pre-built diagnostics; when empty, [`Self::format_footer`] builds a report on demand.
     session_diagnostics: &'a [nono::NonoDiagnostic],
+    /// Network denial events observed by the proxy during this session.
+    /// Authoritative (the proxy's own decisions), unlike the stderr-derived
+    /// `network_blocked_hint`. Populated only in supervised mode with an
+    /// active proxy.
+    network_denials: Vec<nono::undo::NetworkAuditEvent>,
 }
 
 impl<'a> DiagnosticFormatter<'a> {
@@ -668,6 +706,7 @@ impl<'a> DiagnosticFormatter<'a> {
             suppressed_system_service_operations: &[],
             canonical_denial_paths: Vec::new(),
             session_diagnostics: &[],
+            network_denials: Vec::new(),
         }
     }
 
@@ -857,6 +896,17 @@ impl<'a> DiagnosticFormatter<'a> {
         self
     }
 
+    /// Add network denial events observed by the proxy during this session.
+    ///
+    /// Callers should pass only denial-class decisions (`Deny`,
+    /// `ApproveDenied`, `ApproveTimeout`, `ApproveError`); allowed traffic
+    /// has no place in a failure diagnostic.
+    #[must_use]
+    pub fn with_network_denials(mut self, denials: Vec<nono::undo::NetworkAuditEvent>) -> Self {
+        self.network_denials = denials;
+        self
+    }
+
     /// Add policy explanations for denied paths.
     ///
     /// These are resolved from `query_path` in the CLI layer and provide
@@ -1213,6 +1263,7 @@ impl<'a> DiagnosticFormatter<'a> {
         let has_path_findings =
             !path_diagnostics.is_empty() || !pathname_unix_diagnostics.is_empty();
         let has_observed_path_evidence = self.has_observed_path_evidence(diagnostics);
+        let has_network_denials = !self.network_denials.is_empty();
         let primary_protected_root_attempt = matches!(
             primary_verdict.as_ref(),
             Some(ErrorVerdict::LikelySandbox(hint))
@@ -1221,6 +1272,7 @@ impl<'a> DiagnosticFormatter<'a> {
 
         if !has_path_findings
             && ipc_diagnostics.is_empty()
+            && !has_network_denials
             && matches!(
                 primary_verdict.as_ref(),
                 Some(ErrorVerdict::MissingPath(_)) | Some(ErrorVerdict::NonSandboxFailure(_))
@@ -1251,12 +1303,21 @@ impl<'a> DiagnosticFormatter<'a> {
                 self.format_system_service_diagnostics(&mut lines, &system_service_diagnostics);
                 lines.push("[nono]".to_string());
                 self.format_system_service_guidance(&mut lines, &system_service_diagnostics);
+                if has_network_denials {
+                    lines.push("[nono]".to_string());
+                    self.format_network_denial_guidance(&mut lines);
+                }
             } else {
                 if let Some(verdict) = primary_verdict.as_ref() {
                     self.format_primary_verdict_guidance(&mut lines, verdict);
                     lines.push("[nono]".to_string());
                
```

**File**: `crates/nono-cli/src/exec_strategy.rs` (modified, +36/-1)
```diff
@@ -364,6 +364,10 @@ pub struct SupervisorConfig<'a> {
     /// Optional in-memory network/IPC audit events persisted into session metadata.
     #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
     pub network_audit_events: Option<&'a Mutex<Vec<nono::undo::NetworkAuditEvent>>>,
+    /// Running proxy handle, used to snapshot network denial events for the
+    /// diagnostic footer. Read-only here: session finalization performs the
+    /// destructive drain that feeds the persistent audit record.
+    pub proxy_handle: Option<&'a nono_proxy::server::ProxyHandle>,
     /// Redaction policy for command context in diagnostics.
     pub redaction_policy: &'a nono::ScrubPolicy,
     /// Whether direct LaunchServices opening is enabled for this session.
@@ -1668,6 +1672,24 @@ pub fn execute_supervised<F: FnMut(i32) -> bool>(
                     .iter()
                     .map(|d| nono::try_canonicalize(&d.path))
                     .collect();
+                // Read-only snapshot: the proxy's in-memory event queue is
+                // left intact for the destructive drain in session
+                // finalization, which owns delivery to the audit record.
+                let network_denials: Vec<nono::undo::NetworkAuditEvent> = supervisor
+                    .and_then(|s| s.proxy_handle)
+                    .map(nono_proxy::server::ProxyHandle::snapshot_audit_events)
+                    .unwrap_or_default()
+                    .into_iter()
+                    .filter(|event| {
+                        matches!(
+                            event.decision,
+                            nono::undo::NetworkAuditDecision::Deny
+                                | nono::undo::NetworkAuditDecision::ApproveDenied
+                                | nono::undo::NetworkAuditDecision::ApproveTimeout
+                                | nono::undo::NetworkAuditDecision::ApproveError
+                        )
+                    })
+                    .collect();
                 let mut base_formatter = DiagnosticFormatter::new(config.caps)
                     .with_mode(mode)
                     .with_denials(&denials)
@@ -1682,7 +1704,8 @@ pub fn execute_supervised<F: FnMut(i32) -> bool>(
                     .with_suppressed_system_service_operations(
                         config.suppressed_system_service_operations,
                     )
-                    .with_canonical_denial_paths(canonical_denial_paths);
+                    .with_canonical_denial_paths(canonical_denial_paths)
+                    .with_network_denials(network_denials);
                 if let Some(program) = config.command.first() {
                     let argv_display: Vec<String> = config
                         .command
@@ -5162,6 +5185,7 @@ mod tests {
             open_url_allow_localhost: false,
             audit_recorder: None,
             network_audit_events: None,
+            proxy_handle: None,
             redaction_policy: &nono::ScrubPolicy::secure_default(),
             allow_launch_services_active: false,
             #[cfg(target_os = "linux")]
@@ -5290,6 +5314,7 @@ mod tests {
             open_url_allow_localhost: false,
             audit_recorder: None,
             network_audit_events: None,
+            proxy_handle: None,
             redaction_policy: &nono::ScrubPolicy::secure_default(),
             allow_launch_services_active: false,
             #[cfg(target_os = "linux")]
@@ -5384,6 +5409,7 @@ mod tests {
             open_url_allow_localhost: false,
             audit_recorder: None,
             network_audit_events: None,
+            proxy_handle: None,
             redaction_policy: &nono::ScrubPolicy::secure_default(),
             allow_launch_services_active: false,
             #[cfg(target_os = "linux")]
@@ -5431,6 +5457,7 @@ mod tests {
             open_url_allow_localhost: false,
             audit_recorder: None,
             network_audit_events: None,
+            proxy_handle: None,
             redaction_policy: &nono::ScrubPolicy::secure_default(),
             allow_launch_services_active: false,
             #[cfg(target_os = "linux")]
@@ -5485,6 +5512,7 @@ mod tests {
             open_url_allow_localhost: false,
             audit_recorder: None,
             network_audit_events: None,
+            proxy_handle: None,
             redaction_policy: &nono::ScrubPolicy::secure_default(),
             allow_launch_services_active: false,
             #[cfg(target_os = "linux")]
@@ -5555,6 +5583,7 @@ mod tests {
             open_url_allow_localhost: true,
             audit_recorder: None,
             network_audit_events: None,
+            proxy_handle: None,
             redaction_policy: &nono::ScrubPolicy::secure_default(),
             allow_launch_services_active: false,
             #[cfg(target_os = "linux")]
@@ -5586,6 +5615,7 @@ mod tests {
             open_url_allow_localhost: false,
             audit_recorder: None,
             network_audit_ev
```

**File**: `crates/nono-cli/src/exec_strategy/clone_files/tests.rs` (modified, +2/-0)
```diff
@@ -128,6 +128,7 @@ fn supervise(
         open_url_allow_localhost: false,
         audit_recorder: None,
         network_audit_events: None,
+        proxy_handle: None,
         redaction_policy: &scrub,
         allow_launch_services_active: false,
         seccomp_policy: policy,
@@ -794,6 +795,7 @@ fn full_cli_supervisor_combined_path() -> Result<()> {
             open_url_allow_localhost: false,
             audit_recorder: None,
             network_audit_events: None,
+            proxy_handle: None,
             redaction_policy: &scrub,
             allow_launch_services_active: false,
             seccomp_policy: config.seccomp_policy,
```

**File**: `crates/nono-cli/src/exec_strategy/supervisor_linux.rs` (modified, +1/-0)
```diff
@@ -1781,6 +1781,7 @@ mod tests {
                 open_url_allow_localhost: false,
                 audit_recorder: None,
                 network_audit_events: None,
+                proxy_handle: None,
                 redaction_policy: &REDACTION_POLICY,
                 allow_launch_services_active: false,
                 proxy_port,
```

**File**: `crates/nono-cli/src/supervised_runtime.rs` (modified, +1/-0)
```diff
@@ -339,6 +339,7 @@ pub(crate) fn execute_supervised_runtime(ctx: SupervisedRuntimeContext<'_>) -> R
             .unwrap_or(false),
         audit_recorder: audit_recorder.clone(),
         network_audit_events: supervisor_network_audit_events.as_ref(),
+        proxy_handle,
         redaction_policy,
         allow_launch_services_active: proxy
             .and_then(|p| p.open_url.as_ref())
```

**File**: `crates/nono-proxy/src/audit.rs` (modified, +19/-0)
```diff
@@ -63,6 +63,25 @@ pub fn new_audit_log() -> SharedAuditLog {
     Arc::new(Mutex::new(Vec::new()))
 }
 
+/// Clone the collected events without clearing the log.
+///
+/// Used for read-only views (e.g. the end-of-session diagnostic footer)
+/// taken before the session finalizer performs the destructive
+/// [`drain_audit_events`] that feeds the persistent audit record.
+#[must_use]
+pub fn snapshot_audit_events(audit_log: &SharedAuditLog) -> Vec<NetworkAuditEvent> {
+    match audit_log.lock() {
+        Ok(events) => events.clone(),
+        Err(e) => {
+            warn!(
+                "Network audit log mutex poisoned while snapshotting events: {}",
+                e
+            );
+            Vec::new()
+        }
+    }
+}
+
 #[must_use]
 pub fn drain_audit_events(audit_log: &SharedAuditLog) -> Vec<NetworkAuditEvent> {
     match audit_log.lock() {
```

**File**: `crates/nono-proxy/src/server.rs` (modified, +16/-0)
```diff
@@ -312,6 +312,22 @@ impl ProxyHandle {
         let _ = self.shutdown_tx.send(true);
     }
 
+    /// Clone the collected network audit events without clearing them.
+    ///
+    /// Read-only view for the end-of-session diagnostic footer. The events
+    /// stay queued so the subsequent [`Self::drain_audit_events`] in session
+    /// finalization still delivers every event to the persistent audit
+    /// record — the snapshot must never reduce audit coverage.
+    ///
+    /// Returns an empty vec when network audit was disabled at start.
+    #[must_use]
+    pub fn snapshot_audit_events(&self) -> Vec<nono::undo::NetworkAuditEvent> {
+        match self.audit_log.as_ref() {
+            Some(audit_log) => audit::snapshot_audit_events(audit_log),
+            None => Vec::new(),
+        }
+    }
+
     /// Drain and return collected network audit events.
     ///
     /// Returns an empty vec when network audit was disabled at start.
```

---

### Incident Patch 15: `f4567433` (2026-09-25)
**Commit Message**: fix(linux): preserve O_PATH in musl builds (#2005)

* fix(linux): preserve O_PATH in musl builds

  Use nix open calls to prevent Rust standard library access mode masking from stripping O_PATH under musl.

  Add a regression test and smoke-test release PR artifacts by running the produced binaries.

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

* fix: race condition

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

* fix: correct build workflow to use arm runner so no need to cross compile

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

---------

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

**File**: `.github/workflows/release-pr.yml` (modified, +18/-12)
```diff
@@ -13,8 +13,8 @@ env:
 
 # Only run on chore: release v* PRs.
 jobs:
-  cross-compile:
-    name: Cross-compile ${{ matrix.target }}
+  build:
+    name: Build ${{ matrix.target }}
     if: "startsWith(github.event.pull_request.title, 'chore: release v')"
     runs-on: ${{ matrix.os }}
     strategy:
@@ -28,7 +28,7 @@ jobs:
           - target: aarch64-apple-darwin
             os: macos-14
           - target: aarch64-unknown-linux-gnu
-            os: ubuntu-22.04
+            os: ubuntu-22.04-arm
           - target: x86_64-unknown-linux-musl
             os: ubuntu-22.04
     steps:
@@ -43,17 +43,23 @@ jobs:
         with:
           targets: ${{ matrix.target }}
 
-      - name: Install cross (Linux ARM64)
-        if: matrix.target == 'aarch64-unknown-linux-gnu'
-        run: cargo install cross
-
-      - name: Build (native)
-        if: matrix.target != 'aarch64-unknown-linux-gnu'
+      - name: Build
         run: cargo build --release --target ${{ matrix.target }} -p nono-cli
 
-      - name: Build (cross aarch64-unknown-linux-gnu)
-        if: matrix.target == 'aarch64-unknown-linux-gnu'
-        run: cross build --release --target aarch64-unknown-linux-gnu -p nono-cli
+      - name: Smoke test release binary
+        shell: bash
+        run: |
+          set -euo pipefail
+          target="${{ matrix.target }}"
+          bin="target/$target/release/nono"
+          if [[ "${{ runner.os }}" == "macOS" ]]; then
+            smoke_command="/usr/bin/true"
+          else
+            smoke_command="/bin/true"
+          fi
+          "$bin" --version
+          NONO_NO_SAVE_PROMPT=1 NONO_NO_MIGRATE=1 \
+            "$bin" run --no-audit --no-rollback --allow-cwd -- "$smoke_command"
 
       - name: Verify binary does not link libdbus (Linux)
         if: runner.os == 'Linux'
```

**File**: `crates/nono-cli/src/diagnostic/formatter.rs` (modified, +1/-0)
```diff
@@ -4191,6 +4191,7 @@ mod tests {
 
     #[test]
     fn test_supervised_rate_limited_denial() {
+        let _env_lock = ENV_LOCK.lock().expect("env lock");
         let caps = make_test_caps();
         let denials = vec![DenialRecord {
             path: PathBuf::from("/tmp/flood"),
```

**File**: `crates/nono-cli/src/exec_strategy/clone_files.rs` (modified, +8/-8)
```diff
@@ -10,13 +10,14 @@
 
 use super::ExecConfig;
 use crate::profile::LinuxSandboxPolicy;
+use nix::fcntl::{OFlag, open};
 use nix::libc;
+use nix::sys::stat::Mode;
 use nono::sandbox::{self, PreparedLandlockSandbox, PreparedSeccompNotifyFilter};
 use nono::{CapabilitySet, DetectedAbi, NonoError, Result};
 use std::collections::BTreeSet;
 use std::ffi::CStr;
 use std::os::fd::{AsRawFd, FromRawFd, OwnedFd, RawFd};
-use std::os::unix::fs::OpenOptionsExt;
 use std::os::unix::net::UnixStream;
 use std::sync::{Mutex, MutexGuard};
 
@@ -128,15 +129,14 @@ pub(super) fn promote_supervisor_socket(
 fn reserve_stdio() -> Result<Vec<OwnedFd>> {
     let mut reserved = Vec::new();
     loop {
-        let file = std::fs::OpenOptions::new()
-            .read(true)
-            .custom_flags(libc::O_PATH | libc::O_CLOEXEC)
-            .open("/dev/null")
-            .map_err(NonoError::Io)?;
-        if file.as_raw_fd() >= 3 {
+        // std::fs::OpenOptions strips O_PATH on musl because musl includes it
+        // in O_ACCMODE. Use nix so the requested descriptor semantics survive.
+        let fd = open("/dev/null", OFlag::O_PATH | OFlag::O_CLOEXEC, Mode::empty())
+            .map_err(|error| NonoError::Io(error.into()))?;
+        if fd.as_raw_fd() >= 3 {
             break;
         }
-        reserved.push(file.into());
+        reserved.push(fd);
     }
     Ok(reserved)
 }
```

**File**: `crates/nono/src/sandbox/linux.rs` (modified, +29/-12)
```diff
@@ -9,8 +9,9 @@ use landlock::{
     ABI, Access, AccessFs, AccessNet, BitFlags, CompatLevel, Compatible, NetPort, PathBeneath,
     PathFd, Ruleset, RulesetAttr, RulesetCreatedAttr, Scope,
 };
+use nix::fcntl::{OFlag, open};
+use nix::sys::stat::Mode;
 use std::os::fd::{AsRawFd, FromRawFd, OwnedFd, RawFd};
-use std::os::unix::fs::OpenOptionsExt;
 use std::path::{Path, PathBuf};
 use std::sync::OnceLock;
 use tracing::{debug, info, warn};
@@ -680,17 +681,22 @@ fn normalize_path_access(
 /// Returning the same descriptor used for metadata validation prevents a path
 /// replacement between type/device classification and rule installation.
 fn open_path_rule(cap: &crate::capability::FsCapability, abi: ABI) -> Result<OpenedPathRule> {
-    let file = std::fs::OpenOptions::new()
-        .read(true)
-        .custom_flags(libc::O_PATH | libc::O_CLOEXEC)
-        .open(&cap.resolved)
-        .map_err(|e| {
-            NonoError::SandboxInit(format!(
-                "Cannot open Landlock rule path {}: {}",
-                cap.resolved.display(),
-                e
-            ))
-        })?;
+    // Do not use std::fs::OpenOptions::custom_flags here. On musl, O_ACCMODE
+    // includes O_PATH, so Rust's standard-library access-mode mask strips the
+    // flag and turns this into an ordinary permission-checked read open.
+    let path_fd = open(
+        &cap.resolved,
+        OFlag::O_PATH | OFlag::O_CLOEXEC,
+        Mode::empty(),
+    )
+    .map_err(|e| {
+        NonoError::SandboxInit(format!(
+            "Cannot open Landlock rule path {}: {}",
+            cap.resolved.display(),
+            e
+        ))
+    })?;
+    let file = std::fs::File::from(path_fd);
     let metadata = file.metadata().map_err(|e| {
         NonoError::SandboxInit(format!(
             "Cannot inspect opened Landlock rule path {}: {}",
@@ -3930,6 +3936,17 @@ mod tests {
         }
     }
 
+    #[test]
+    fn test_open_path_rule_retains_o_path_flag() {
+        let cap = crate::capability::FsCapability::new_file("/dev/null", AccessMode::Read)
+            .expect("device capability");
+        let rule = open_path_rule(&cap, ABI::V1).expect("open path rule");
+        let flags = nix::fcntl::fcntl(&rule.path_fd, nix::fcntl::FcntlArg::F_GETFL)
+            .expect("inspect path fd flags");
+
+        assert_ne!(flags & libc::O_PATH, 0, "Landlock rule fd must use O_PATH");
+    }
+
     /// `open_path_rule` opens `cap.resolved` with `O_PATH`, so the kernel
     /// resolves the whole chain before Landlock sees a literal path.
     #[test]
```

#### Recent Merged Pull Requests:
- **PR #2059** (2026-10-05): chore(deps): bump jsonc-parser from 0.33.1 to 0.34.0 (@dependabot[bot])
- **PR #2058** (2026-10-05): chore(deps): bump thiserror from 2.0.20 to 2.0.21 (@dependabot[bot])
- **PR #2057** (2026-10-05): chore(deps): bump clap_complete from 4.6.9 to 4.6.11 (@dependabot[bot])
- **PR #2056** (2026-10-05): chore(deps): bump der from 0.8.1 to 0.8.2 (@dependabot[bot])
- **PR #2047** (2026-10-02): fix(supervisor): separate network denial throttling from policy enforcement (@lukehinds)
- **PR #2042** (2026-10-01): fix(linux): honour open ports in proxy fallback (@MateSaary)
- **PR #2041** (2026-10-01): fix(macos): allow bypassed sockets under denied directories (@SequeI)
- **PR #2035** (closed): docs(neps): add NEP-0006 for opt-in proxy loopback restriction (@blakepettersson)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

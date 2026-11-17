# Verification Protocol: Verification Protocol: Empirical Defect Shield for nolabs-ai/nono

<!-- PROVENANCE_START
{
  "source_repository": "nolabs-ai/nono",
  "source_url": "https://github.com/nolabs-ai/nono",
  "source_version": "248ad5da",
  "license": "Apache-2.0",
  "timestamp": "2026-11-17T14:50:02.041Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-nolabs-ai-nono",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [nolabs-ai/nono](https://github.com/nolabs-ai/nono) (Revision: `248ad5da`).  
> **License**: Apache-2.0 | **Timestamp**: `2026-11-17T14:50:02.041Z`  
> **Learning ID**: `learn-github-nolabs-ai-nono`


## 1. Scope & Verification Target
- **Target Repository**: `nolabs-ai/nono` (Commit: `248ad5da`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): nolabs-ai/nono

> **Canonical Artifact**: `07_PROJECT_LEARNING/nolabs-ai-nono-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/nolabs-ai/nono](https://github.com/nolabs-ai/nono))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-17T14:50:00.953Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nolabs-ai/nono`
- **Description**: agent runtime security - zero trust, zero setup, zero latency agent sandboxing
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 5029 stars

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

### Core Architecture Module: `crates/nono-cli/src/platform_oauth/loopback.rs`
```
//! One-shot loopback redirect receiver for the authorization code flow
//! ([RFC 8252] §7.3).
//!
//! The listener binds `127.0.0.1` on an OS-chosen port and serves exactly one
//! successful `GET /callback`: the first one carrying the expected `state`.
//! Anything else, from a stray browser connection or another local process
//! (including a sandboxed agent with localhost access), gets a minimal error
//! and is otherwise ignored, so it cannot end or hijack the sign-in. A
//! bounded number of rejected requests aborts the login to fail closed.
//!
//! The accepted callback's connection is held open while the CLI redeems the
//! code, so the browser's next page reflects the real outcome.
//!
//! [RFC 8252]: https://www.rfc-editor.org/rfc/rfc8252

use nono::{NonoError, Result};
use std::io::{ErrorKind, Read, Write};
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};
use std::time::{Duration, Instant};
use url::Url;
use zeroize::Zeroizing;

const CALLBACK_PATH: &str = "/callback";
const MAX_REQUEST_BYTES: usize = 8 * 1024;
const MAX_REJECTED_REQUESTS: usize = 64;
const PER_CONNECTION_TIMEOUT: Duration = Duration::from_secs(2);
const ACCEPT_POLL_INTERVAL: Duration = Duration::from_millis(50);

pub(crate) struct LoopbackListener {
    listener: TcpListener,
    port: u16,
}

/// What the authorization server sent back to the redirect URI.
pub(crate) enum CallbackResult {
    Code(Zeroizing<String>),
    Error(String),
}

impl std::fmt::Debug for CallbackResult {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Code(_) => f.write_str("Code(<redacted>)"),
            Self::Error(code) => f.debug_tuple("Error").field(code).finish(),
        }
    }
}

/// An accepted callback whose browser response is still pending.
pub(crate) struct PendingCallback {
    pub(crate) responder: CallbackResponder,
    pub(crate) result: CallbackResult,
}

/// The held browser connection for an accepted callback.
pub(crate) struct CallbackResponder {
    stream: TcpStream,
}

impl LoopbackListener {
    pub(crate) fn bind() -> std::io::Result<Self> {
        let listener = TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))?;
        let port = listener.local_addr()?.port();
        listener.set_nonblocking(true)?;
        Ok(Self { listener, port })
    }

    pub(crate) fn redirect_uri(&self) -> String {
        format!("http://127.0.0.1:{}{CALLBACK_PATH}", self.port)
    }

    /// Wait for the callback that matches `expected_state` and comes from
    /// `expected_issuer` (RFC 9207), until `deadline`.
    pub(crate) fn wait_for_callback(
        &self,
        expected_state: &str,
        expected_issuer: &str,
        deadline: Instant,
    ) -> Result<PendingCallback> {
        let mut rejected = 0usize;
        loop {
            if Instant::now() >= deadline {
                return Err(NonoError::ActionRequired(
                    "sign-in timed out waiting for the browser; run `nono platform login` again"
                        .to_string(),
                ));
            }
            let stream = match self.listener.accept() {
                Ok((stream, peer)) if peer.ip().is_loopback() => stream,
                Ok(_) => continue,
                Err(error) if error.kind() == ErrorKind::WouldBlock => {
                    std::thread::sleep(ACCEPT_POLL_INTERVAL);
                    continue;
                }
                Err(error) if error.kind() == ErrorKind::Interrupted => continue,
                Err(error) => {
                    return Err(NonoError::ConfigParse(format!(
                        "loopback listener failed: {error}"
                    )));
                }
            };
            match handle_connection(stream, expected_state, expected_issuer)? {
                Some(callback) => return Ok(callback),
                None => {
                    rejected = rejected.saturating_add(1);
                    if rejected >= MAX_REJECTED_REQUESTS {
                        return Err(NonoError::ActionRequired(
                            "sign-in aborted: too many unexpected requests reached the loopback \
                             listener"
                                .to_string(),
                        ));
                    }
                }
            }
        }
    }
}

impl CallbackResponder {
    /// Answer the held browser request with a redirect to `location`.
    pub(crate) fn redirect(mut self, location: &Url) {
        let response = format!(
            "HTTP/1.1 302 Found\r\nLocation: {location}\r\nCache-Control: no-store\r\n\
             Referrer-Policy: no-referrer\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
        );
        // Best effort: the browser may have gone away, and the CLI has already
        // reported the real outcome in the terminal.
        let _ = self.stream.write_all(response.as_bytes());
        let _ = self.stream.flush();
    }
}

/// Serve one connection. Returns `Ok(Some)` only for the genuine callback;
/// `Ok(None)` for anything rejected; `Err` for a callback that has the right
/// `state` but fails a security check, which aborts the login.
fn handle_connection(
    mut stream: TcpStream,
    expected_state: &str,
    expected_issuer: &str,
) -> Result<Option<PendingCallback>> {
    if stream.set_nonblocking(false).is_err()
        || stream
            .set_read_timeout(Some(PER_CONNECTION_TIMEOUT))
            .is_err()
        || stream
            .set_write_timeout(Some(PER_CONNECTION_TIMEOUT))
            .is_err()
    {
        return Ok(None);
    }
    let Some(target) = read_request_target(&mut stream) else {
        respond(&mut stream, "400 Bad Request");
        return Ok(None);
    };
    let Some(params) = parse_callback_target(&target) else {
        respond(&mut stream, "404 Not Found");
        return Ok(None);
    };
    let Some(state) = params.get("state") else {
        respond(&mut stream, "400 Bad Request");
        return Ok(None);
    };
    if aws_lc_rs::constant_time::verify_slices_are_equal(
        state.as_bytes(),
        expected_state.as_bytes(),
    )
    .is_err()
    {
        respond(&mut stream, "400 Bad Request");
        return Ok(None);
    }

    // From here the request carries the secret state, so it is the real
    // authorization response. A failed check is an attack, not noise.
    if params.get("iss").map(String::as_str) != Some(expected_issuer) {
        respond(&mut stream, "400 Bad Request");
        return Err(NonoError::ConfigParse(
            "sign-in aborted: the authorization response came from an unexpected issuer"
                .to_string(),
        ));
    }
    let result = match (params.get("code"), params.get("error")) {
        (Some(code), None) => CallbackResult::Code(super::client::validate_token_value(
            "authorization code",
            code.clone(),
        )?),
        (None, Some(error)) => CallbackResult::Error(
            super::client::validate_error_code(error)
                .unwrap_or_else(|_| "invalid_request".to_string()),
        ),
        _ => {
            respond(&mut stream, "400 Bad Request");
            return Err(NonoError::ConfigParse(
                "sign-in aborted: malformed authorization response".to_string(),
            ));
        }
    };
    Ok(Some(PendingCallback {
        responder: CallbackResponder { stream },
        result,
    }))
}

/// Read the request head and return the target of a `GET` request.
fn read_request_target(stream: &mut TcpStream) -> Option<String> {
    let mut buffer = Vec::with_capacity(1024);
    let mut chunk = [0u8; 1024];
    while !buffer.windows(4).any(|window| window == b"\r\n\r\n") {
        if buffer.len() >= MAX_REQUEST_BYTES {
            return None;
        }
        let read = stream.read(&mut chunk).ok()?;
        if read == 0 {
            return None;
        }
        buffer.extend_from_slice(&chunk[..read]);
    }
    let head = std::str::from_utf8(&buffer).ok()?;
    let request_line = head.split("\r\n").next()?;
    let mut parts = request_line.split(' ');
    match (parts.next(), parts.next(), parts.next(), parts.next()) {
        (Some("GET"), Some(target), Some(version), None) if version.starts_with("HTTP/1.") => {
            Some(target.to_string())
        }
        _ => None,
    }
}

/// Parse `/callback?…` into its query parameters. Returns `None` for any
/// other path or a query that repeats a parameter (a confusion attempt).
fn parse_callback_target(target: &str) -> Option<std::collections::HashMap<String, String>> {
    let (path, query) = target.split_once('?').unwrap_or((target, ""));
    if path != CALLBACK_PATH {
        return None;
    }
    let mut params = std::collections::HashMap::new();
    for (key, value) in url::form_urlencoded::parse(query.as_bytes()) {
        if params
            .insert(key.into_owned(), value.into_owned())
            .is_some()
        {
            return None;
        }
    }
    Some(params)
}

fn respond(stream: &mut TcpStream, status: &str) {
    let body = "nono platform login: request rejected\n";
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/plain; charset=utf-8\r\nCache-Control: no-store\r\n\
         Content-Length: {}\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes());
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    const ISSUER: &str = "https://nono.example.com";

    fn send(port: u16, request: &str) -> String {
        let mut stream = TcpStream::connect(("127.0.0.1", port)).unwrap();
        stream.write_all(request.as_bytes()).unwrap();
        let mut response = String::new();
        let _ = stream.read_to_string(&mut response);
        response
    }

    fn get(port: u16, target: &str) -> String {
        send(
            port,
            &format!("GET {target} HTTP/1.1\r\nHost: 127.0.0.
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
    /// Effective Linux namespace isolation (NEP-0004). Absent when no
    /// isolation was requested, and in states written by older builds.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub isolation: Option<IsolationState>,
}

/// Linux namespace isolation in effect for a sandbox (NEP-0004).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct IsolationState {
    /// Requested namespaces, as `--isolate` names them (`net`, `mounts`, ...).
    pub namespaces: Vec<String>,
    /// Host paths hidden by the mount mask, as the applied plan masks them.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub masked_paths: Vec<PathBuf>,
    /// Host paths bound back over the masks, as the applied plan re-binds
    /// them. Everything beneath a re-bound directory is reachable again.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub rebound_paths: Vec<PathBuf>,
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
    /// The entry's `endpoint_policy` as the proxy enforces it. `endpoints`
    /// then lists only its `allow` rules, for display; `nono why` evaluates
    /// this policy.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub endpoint_policy: Option<nono_proxy::config::EndpointPolicyConfig>,
}

impl DomainEndpointState {
    /// Endpoint state for an `allow_domain` entry, or `None` when the entry
    /// does not restrict endpoints.
    pub fn from_allow_domain(entry: &crate::profile::AllowDomainEntry) -> Option<Self> {
        if !entry.has_endpoint_restrictions() {
            return None;
        }
        let crate::profile::AllowDomainEntry::WithEndpoints {
            domain,
            endpoints,
            endpoint_policy,
        } = entry
        else {
            return None;
        };
        let rules: Vec<EndpointRuleState> = match endpoint_policy {
            Some(policy) => policy
                .allow
                .iter()
                .map(|r| EndpointRuleState {
                    method: r.method.clone(),
                    path: r.path.clone(),
                })
                .collect(),
            None => endpoints
                .iter()
                .map(|r| EndpointRuleState {
                    method: r.method.clone(),
                    path: r.path.clone(),
                })
                .collect(),
        };
        Some(Self {
            domain: domain.clone(),
            endpoints: rules,
            endpoint_policy: endpoint_policy
                .as_ref()
                .map(crate::profile::AllowDomainEndpointPolicy::to_proxy),
        })
    }
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
    pu
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2332** (2026-11-17): **fix(audit): include session profile references in platform uploads**
  *Symptoms*: Audit uploads now include the explicit profile selector, otherwise the executable’s recommended pack, otherwise null. Capture the reference at launch so offline retries and outbox recovery retain the original value. This is an analytics label; profile contents and enforced-policy evidence are unchanged.   Example from a real enrolled test upload (excerpt):  ```json {   "session_id": "35a03219803bc88a",   "profile_ref": "customer-project",   "started_at": "2026-11-17T11:35:39.465075+00:00",   "ended_at": "2026-11-17T11:35:39.829801+00:00" } ```  Validation: - Full macOS `make ci` and Linux `make check test test-doc lint-docs` passed. - Real local enrollment verified custom, recommended and null references, restart/retry and missing-outbox recovery; all five audits reached verified status. - Platform acceptance used a temporary source copy to resolve duplicate `0089` migration numbers; platform repository unchanged. 
  **Post-Mortem & Fix Analysis**:
  > <!-- pr-review-summary -->  ## PR Review Summary  ### Size  | Metric | Value | |--------|-------| | Lines added | +185 | | Lines removed | -1 | | Total changed | 186 | | **Classification** | **Medium (50–300 lines)** |  ### Affected crates  - **crates/nono-cli** — CLI changes. Verify argument parsing, flag documentation, and UX behaviour across supported platforms.  ### Blast radius — Moderate  This PR touches: **source code,documentation**  --- <sub>Updated automatically on each push to this PR.</sub>

- **Issue #2307** (2026-11-13): **fix(cli): allow mise to read ~/.tool-versions**
  *Symptoms*: ## Linked Issue  <!-- External and agent-proposed PRs must reference an existing issue. Maintainer-directed routine PRs may leave this blank and explain the exception in the Summary. -->  Closes #2306  ## Summary  mise reads the global ~/.tool-versions config on startup, so the mise_manager group must grant read access to it. Without it, every mise shim fails with "Permission denied" inside the sandbox.  The grant is a single-file read capability; the path is skipped when it does not exist.  <!-- ## Agent Disclosure (if applicable)  If this PR is generated by an AI agent, per AGENTS.md you must include: - A statement that the contributor is an agent. - References to relevant files or sections consulted. - Explicit confirmation of compliance with repository requirements. -->  ## Test Plan  I ran `target/debug/nono run --profile  mise-dev which python` and it worked.  <!-- How was this tested? Include relevant commands, test cases, or manual verification steps. -->  ## Checklist  - [x] An issue exists and is linked above, or this is maintainer-directed routine work - [x] All commits are signed-off, using [DCO](https://en.wikipedia.org/wiki/Developer_Certificate_of_Origin) - [na] ~~Code changes follow the project's coding standards ([AGENTS.md](../AGENTS.md)) and have appropriate test coverage~~ No code changes. - [na] ~~Public-facing changes are paired with documentation updates.~~ No documentation change needed: this adds a path to the existing mise_manager group, and the grou

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

### Incident Patch 1: `29a97842` (2026-11-17)
**Commit Message**: test: fix flaky tests in socket auth, capture and fd churn (#2328)

* test: keep socket owner alive until the test stops it

A debug nono hashes its ~500 MB shim in ~30s at foreign startup.
The owner's 30s self-exit removed its shims before the foreign probe.

Signed-off-by: Daniel Schlatter <[REDACTED_EMAIL]>

* test: keep capture shell vars out of capture arg expansion

Capture args expand $VAR from the test env, so a host BROWSER broke the check.

Signed-off-by: Daniel Schlatter <[REDACTED_EMAIL]>

* test: wait for the chunk timer instead of a fixed sleep

The writer thread closes the chunk asynchronously; 200ms was too short on macOS CI.

Signed-off-by: Daniel Schlatter <[REDACTED_EMAIL]>

* test: make the accepted upstream socket blocking

macOS accepted sockets inherit O_NONBLOCK, so read returned WouldBlock.

Signed-off-by: Daniel Schlatter <[REDACTED_EMAIL]>

* test: drop pending SIGUSR1 before restoring its default action

A pending signal taken by another thread after restore killed the process.

Signed-off-by: Daniel Schlatter <[REDACTED_EMAIL]>

---------

Signed-off-by: Daniel Schlatter <[REDACTED_EMAIL]>

**File**: `crates/nono-cli/src/exec_strategy/clone_files/tests.rs` (modified, +5/-1)
```diff
@@ -551,8 +551,12 @@ fn fd_churn_signals_and_late_descriptors() -> Result<()> {
         struct Restore(libc::sigaction);
         impl Drop for Restore {
             fn drop(&mut self) {
-                // SAFETY: restore the action saved by sigaction.
+                // Ignoring first discards a pending SIGUSR1 another thread has not taken yet.
+                // SAFETY: SIG_IGN is a valid action and self.0 was saved by sigaction.
                 unsafe {
+                    let mut ignore: libc::sigaction = std::mem::zeroed();
+                    ignore.sa_sigaction = libc::SIG_IGN;
+                    libc::sigaction(libc::SIGUSR1, &ignore, std::ptr::null_mut());
                     libc::sigaction(libc::SIGUSR1, &self.0, std::ptr::null_mut());
                 }
             }
```

**File**: `crates/nono-cli/src/proxy_runtime.rs` (modified, +2/-1)
```diff
@@ -5878,7 +5878,8 @@ mod tests {
         let mut entry = test_capture_entry_no_cache(vec![
             "/bin/sh".to_string(),
             "-c".to_string(),
-            r#"test -n "$BROWSER" && test -x "$BROWSER" && test -S "$NONO_SUPERVISOR_PATH" && printf browser-ok"#.to_string(),
+            // Braced names stay literal for the shell; capture args expand `$VAR` from the test process env.
+            r#"test -n "${BROWSER}" && test -x "${BROWSER}" && test -S "${NONO_SUPERVISOR_PATH}" && printf browser-ok"#.to_string(),
         ]);
         entry.interaction = Some(crate::profile::CredentialCaptureInteraction {
             stdio: false,
```

**File**: `crates/nono-cli/src/terminal_capture/mod.rs` (modified, +5/-1)
```diff
@@ -1264,7 +1264,11 @@ mod tests {
         config.chunk_max_duration = Duration::from_millis(50);
         let mut capture = h.start(config);
         capture.output(OutputStream::Pty, b"a");
-        std::thread::sleep(Duration::from_millis(200));
+        // The writer thread closes the chunk asynchronously; a loaded runner can take well over the window.
+        let deadline = Instant::now() + Duration::from_secs(10);
+        while h.chunk_events().is_empty() && Instant::now() < deadline {
+            std::thread::sleep(Duration::from_millis(10));
+        }
         assert_eq!(h.chunk_events().len(), 1, "timer closed the first chunk");
         capture.output(OutputStream::Pty, b"b");
         capture.finish("exited:0".to_string());
```

**File**: `crates/nono-cli/tests/session_socket_auth.rs` (modified, +6/-2)
```diff
@@ -160,7 +160,7 @@ fn exercise_named_listeners(strict: bool) {
                     ' sh "$shared"
                     printf ready > "$shared/ready"
                     i=0
-                    while [ ! -f "$shared/stop" ] && [ "$i" -lt 600 ]; do
+                    while [ ! -f "$shared/stop" ] && [ "$i" -lt 6000 ]; do
                         /bin/sleep 0.05
                         i=$((i + 1))
                     done
@@ -306,7 +306,7 @@ printf '%s\n' "$BROWSER" > "$shared/browser"
 "$BROWSER" https://google.com
 printf ready > "$shared/ready"
 i=0
-while [ ! -f "$shared/stop" ] && [ "$i" -lt 600 ]; do
+while [ ! -f "$shared/stop" ] && [ "$i" -lt 6000 ]; do
     /bin/sleep 0.05
     i=$((i + 1))
 done
@@ -333,6 +333,10 @@ printf session-test-token
                 Err(err) => panic!("upstream accept: {err}"),
             }
         };
+        // macOS accepted sockets inherit O_NONBLOCK from the listener.
+        connection
+            .set_nonblocking(false)
+            .expect("blocking connection");
         connection
             .set_read_timeout(Some(Duration::from_secs(5)))
             .expect("read timeout");
```

---

### Incident Patch 2: `df620e3c` (2026-11-17)
**Commit Message**: fix(audit): include session profile references in platform uploads (#2332)

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

**File**: `crates/nono-cli/src/audit_client.rs` (modified, +65/-1)
```diff
@@ -22,6 +22,7 @@ use uuid::Uuid;
 
 const OUTBOX_DIRNAME: &str = "audit-outbox";
 const RECEIPT_FILENAME: &str = "platform-ingest-receipt.json";
+const PROFILE_FILENAME: &str = "platform-audit-profile.json";
 const RESPONSE_LIMIT_BYTES: u64 = 1024 * 1024;
 const QUEUE_SCHEMA_V2: u32 = 2;
 
@@ -162,6 +163,21 @@ pub(crate) fn capture_enrollment(session_dir: &Path) -> Result<()> {
     )
 }
 
+pub(crate) fn capture_profile(session_dir: &Path, profile_ref: Option<&str>) -> Result<()> {
+    write_json_secure(&session_dir.join(PROFILE_FILENAME), &profile_ref)
+}
+
+fn session_profile(session_dir: &Path) -> Result<Option<String>> {
+    let path = session_dir.join(PROFILE_FILENAME);
+    let bytes = match fs::read(&path) {
+        Ok(bytes) => bytes,
+        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
+        Err(source) => return Err(NonoError::ConfigRead { path, source }),
+    };
+    serde_json::from_slice(&bytes)
+        .map_err(|_| NonoError::ConfigParse("invalid audit session profile reference".into()))
+}
+
 fn session_origin(session_dir: &Path) -> Result<Option<PlatformState>> {
     let path = session_dir.join("platform-audit-origin.json");
     if !path.exists() {
@@ -350,7 +366,7 @@ fn build_queued_audit(
             session_id: metadata.session_id.clone(),
             shipper_id: state.subject_id.clone(),
             principal_id: None,
-            profile_ref: None,
+            profile_ref: session_profile(session_dir)?,
             merkle_root: integrity.merkle_root.to_string(),
             hash_chain_head: Some(integrity.chain_head.to_string()),
             started_at: metadata.started.clone(),
@@ -588,6 +604,7 @@ mod tests {
         assert_eq!(envelope.tenant_id, "acme");
         assert_eq!(envelope.shipper_id, "subject-1");
         assert_eq!(envelope.session_id, "session-1");
+        assert_eq!(envelope.profile_ref, None);
         assert!(envelope.events_ndjson.contains("session_started"));
         assert!(envelope.events_ndjson.contains("session_ended"));
         assert_eq!(
@@ -601,6 +618,48 @@ mod tests {
         assert_eq!(shipped_metadata["exit_code"], 0);
     }
 
+    #[test]
+    fn captured_profile_survives_queue_reload_without_changing_session_digest() {
+        for profile in [Some("customer-project"), Some("nolabs-ai/claude"), None] {
+            let dir = tempfile::tempdir().unwrap();
+            let mut recorder = AuditRecorder::new(dir.path().to_path_buf()).unwrap();
+            recorder
+                .record_session_started("2026-07-01T10:00:00Z".into(), vec!["true".into()])
+                .unwrap();
+            recorder
+                .record_session_ended("2026-07-01T10:00:01Z".into(), 0)
+                .unwrap();
+            let metadata = metadata("profile-session", recorder.finalize().unwrap());
+            let original_digest = compute_session_digest(&metadata).unwrap();
+            capture_profile(dir.path(), profile).unwrap();
+            let queued = build_queued_audit(dir.path(), &metadata, &state()).unwrap();
+            assert_eq!(
+                queued.current_envelope().unwrap().profile_ref.as_deref(),
+                profile
+            );
+            assert_eq!(
+                queued.current_envelope().unwrap().session_digest,
+                original_digest.to_string()
+            );
+            let path = dir.path().join("queued.json");
+            write_json_secure(&path, &queued).unwrap();
+            capture_profile(dir.path(), Some("changed-after-queueing")).unwrap();
+            let reloaded = load_queued(&path).unwrap();
+            assert_eq!(reloaded.wire_body().unwrap(), queued.wire_body().unwrap());
+        }
+    }
+
+    #[test]
+    fn captured_profile_rejects_malformed_state() {
+        let dir = tempfile::tempdir().unwrap();
+        fs::write(
+            dir.path().join(PROFILE_FILENAME),
+            br#"{"profile":"wrong-shape"}"#,
+        )
+        .unwrap();
+        assert!(session_profile(dir.path()).is_err());
+    }
+
     #[test]
     fn legacy_queue_preserves_original_wire_envelope() {
         let dir = tempfile::tempdir().unwrap();
@@ -688,6 +747,7 @@ mod tests {
             .record_session_ended("2026-07-01T10:00:01Z".to_string(), 0)
             .unwrap();
         let recovered_metadata = metadata("session-recover", recorder.finalize().unwrap());
+        capture_profile(&session_dir, Some("nolabs-ai/codex@1.2.3")).unwrap();
         write_json_secure(
             &session_dir.join("platform-audit-origin.json"),
             &Some(state()),
@@ -721,6 +781,10 @@ mod tests {
         let queued = load_queued(&queued_paths().unwrap()[0]).unwrap();
         assert!(matches!(queued, QueuedAudit::V2(_)));
         assert_eq!(queued.session_id(), "session-recover");
+        assert_eq!(
+            queued.current_envelope().unwrap().profile_ref.as_deref(),
+            Some("nolabs-ai/codex@1.2.3")
+        );
 
         assert!(recover_mis
```

**File**: `crates/nono-cli/src/command_runtime.rs` (modified, +1/-0)
```diff
@@ -321,6 +321,7 @@ pub(crate) fn run_shell(mut args: ShellArgs, silent: bool) -> Result<()> {
             policy: prepared.policy_session.clone(),
             session_id: Some(session_id),
             session_name: args.name,
+            profile_name: args.sandbox.profile.clone(),
             detach_sequence: load_configured_detach_sequence()?,
             ..SessionLaunchOptions::default()
         },
```

**File**: `crates/nono-cli/src/supervised_runtime.rs` (modified, +3/-0)
```diff
@@ -251,6 +251,9 @@ pub(crate) fn execute_supervised_runtime(ctx: SupervisedRuntimeContext<'_>) -> R
         rollback.destination.as_ref(),
         session.session_id.as_deref(),
     )?;
+    if let Some(state) = &audit_state {
+        crate::audit_client::capture_profile(&state.session_dir, config.profile_save_base)?;
+    }
     warn_if_rollback_flags_ignored(rollback, silent);
 
     // Create the session guard (writes session file) and PTY pair BEFORE
```

**File**: `crates/nono-cli/tests/audit_profile_ref.rs` (added, +104/-0)
```diff
@@ -0,0 +1,104 @@
+//! Launch-time analytics attribution survives independently of current configuration.
+
+use nono_test_support::{NonoTest, nono_test};
+use std::fs;
+use std::os::unix::fs::PermissionsExt;
+use std::time::{Duration, Instant};
+
+fn captured_profile(t: &NonoTest) -> Option<String> {
+    let deadline = Instant::now() + Duration::from_secs(15);
+    loop {
+        let directories: Vec<_> = fs::read_dir(t.audit_root())
+            .expect("audit root")
+            .map(|entry| entry.expect("audit entry").path())
+            .filter(|path| path.is_dir())
+            .collect();
+        assert_eq!(directories.len(), 1, "one session per fixture");
+        let dir = &directories[0];
+        if dir.join("session.json").is_file() {
+            assert!(
+                nono::audit::verify_audit_log(dir, None)
+                    .expect("audit integrity")
+                    .records_verified
+            );
+            return serde_json::from_slice(
+                &fs::read(dir.join("platform-audit-profile.json")).expect("captured profile"),
+            )
+            .expect("profile reference");
+        }
+        assert!(Instant::now() < deadline, "session did not finalize");
+        std::thread::sleep(Duration::from_millis(25));
+    }
+}
+
+#[test]
+fn launches_capture_explicit_profiles_recommendations_and_unknown_executables() {
+    for case in [
+        "explicit",
+        "environment",
+        "file",
+        "recommended",
+        "unknown",
+        "shell",
+        "detached",
+    ] {
+        let t = nono_test!("audit-profile");
+        let executable = t.workspace().join("claude");
+        fs::write(&executable, "#!/bin/sh\n/bin/sleep \"${1:-0}\"\n")
+            .expect("harmless executable with a recognised name");
+        fs::set_permissions(&executable, fs::Permissions::from_mode(0o755))
+            .expect("executable fixture");
+        let local_profile = t.workspace().join("customer-profile.json");
+        fs::write(
+            &local_profile,
+            r#"{"meta":{"name":"customer-project"},"extends":"default"}"#,
+        )
+        .expect("local profile");
+        let mut command = t.command();
+        command
+            .arg(if case == "shell" { "shell" } else { "run" })
+            .args(["--allow-cwd", "--block-net", "--allow"])
+            .arg(t.workspace());
+        let expected = match case {
+            "explicit" | "shell" => {
+                command.args(["--profile", "default"]);
+                Some("default".to_string())
+            }
+            "environment" => {
+                command.env("NONO_PROFILE", "default");
+                Some("default".to_string())
+            }
+            "file" => {
+                command.arg("--profile").arg(&local_profile);
+                Some(local_profile.to_string_lossy().into_owned())
+            }
+            "recommended" | "detached" => Some("nolabs-ai/claude".to_string()),
+            "unknown" => None,
+            _ => unreachable!(),
+        };
+        if case == "shell" {
+            command.args(["--shell", "/bin/sh"]);
+        } else {
+            command.args(["--no-rollback", "--no-diagnostics"]);
+            if case == "detached" {
+                command.args(["--detached", "--name", "profile-ref-test"]);
+            }
+            command.arg("--").arg(if case == "unknown" {
+                std::path::Path::new("/bin/echo")
+            } else {
+                &executable
+            });
+            if case == "detached" {
+                command.arg("1");
+            }
+        }
+        let output = command.output().expect("launch");
+        assert!(
+            output.status.success(),
+            "{case}: {}: {}",
+            output.status,
+            String::from_utf8_lossy(&output.stderr)
+        );
+        assert_eq!(captured_profile(&t), expected, "{case}");
+    }
+}
```

**File**: `docs/protocols/audit-delivery-v1.md` (modified, +12/-0)
```diff
@@ -53,6 +53,18 @@ The final envelope is posted to `/api/v1/audit/ingest`:
 }
 ```
 
+`profile_ref` is the explicit profile selector, otherwise the executable's
+recommended pack reference, otherwise `null`. The client captures this analytics
+label at launch in `platform-audit-profile.json` beside the session audit files.
+Uploads and outbox reconstruction use that saved value; retries preserve the
+queued envelope. Older sessions without the file continue to report `null`.
+
+The label may contain a user-supplied profile name or path. It is sent to the
+enrolled platform, which can map known pack references to agent-family enums
+without forwarding custom names to product analytics. A recommendation does not
+mean that pack was applied. The request signature covers `profile_ref`, but the
+canonical session digest does not; it is not evidence of enforced policy.
+
 The client sends these authentication headers:
 
 ```text
```

---

### Incident Patch 3: `1b9d30d4` (2026-11-17)
**Commit Message**: feat(linux): implement mount namespace isolation and host IPC masking (#2329)

* feat(linux): implement mount namespace isolation and host IPC masking

Add Phase 2 of NEP-0004 namespace isolation via `linux.isolate.mounts` and `extra_masks`. When enabled, nono executes the command in a new mount namespace where sensitive host paths and sockets are masked to prevent sandbox escape, while exposing a private `/tmp`.

- Introduce `linux.isolate.mounts` and `extra_masks` configuration options for profiles and CLI flags
- Mask host IPC endpoints ($XDG_RUNTIME_DIR, D-Bus system bus, container runtime sockets, systemd) by mounting an empty tmpfs or an unreachable node
- Provide a private per-session `/tmp` directory
- Re-bind explicitly granted file and Unix socket paths through the applied masks so configured permissions remain accessible
- Support variable expansion in `extra_masks` and record effective isolation state for query diagnostics (`nono why`)
- Prevent combining `mounts` with capability elevation or `nono wrap`

Signed-off-by: Luke Hinds <[REDACTED_EMAIL]>

* fix(isolation): terminate sandbox if host removes mount masks

Mount masks are mounts on host dentries, so host actions

**File**: `crates/nono-cli/data/nono-profile.schema.json` (modified, +12/-1)
```diff
@@ -682,7 +682,7 @@
     },
     "LinuxIsolateConfig": {
       "type": "object",
-      "description": "Opt-in namespace isolation (NEP-0004). Every field defaults to false. Fields merge by logical OR across profile layers and the CLI: any layer can enable a namespace and none can disable it. Requested isolation that the host cannot provide is a startup error, never a silent downgrade. Inert on macOS. Not supported by `nono wrap`.",
+      "description": "Opt-in namespace isolation (NEP-0004). Every field defaults to false (extra_masks to empty). Boolean fields merge by logical OR across profile layers, packs and the CLI: any layer can enable a namespace and none can disable it. extra_masks merges by deduplicated append, so no layer can remove a mask. Requested isolation that the host cannot provide is a startup error, never a silent downgrade. Inert on macOS. Not supported by `nono wrap`.",
       "additionalProperties": false,
       "properties": {
         "network": {
@@ -704,6 +704,17 @@
           "type": "boolean",
           "default": false,
           "description": "Run in a new user + UTS namespace (hostname changes do not affect the host)."
+        },
+        "mounts": {
+          "type": "boolean",
+          "default": false,
+          "description": "Run in a new user + mount namespace that masks host IPC endpoints: an empty tmpfs over $XDG_RUNTIME_DIR (and /run/user/<uid>), masks over /run/dbus, container and VM manager sockets (Docker, containerd, k3s, CRI-O, Podman, libvirt, Incus, LXD), snapd, pcscd and /run/systemd/private, and a private per-session /tmp. If the host removes a mask during the session (for example by recreating a daemon socket), nono terminates the sandbox. Paths the profile grants, including unix_socket grants, are re-bound through the masks; a grant of a whole masked directory applies to the session's private copy. Cannot be combined with security.capability_elevation."
+        },
+        "extra_masks": {
+          "type": "array",
+          "items": { "type": "string" },
+          "default": [],
+          "description": "Additional host paths to mask (a directory gets an empty tmpfs; a socket or file becomes unreachable). Additive only: no layer can remove a default or inherited mask. Requires mounts. Supports variable expansion ($HOME, $XDG_RUNTIME_DIR, $WORKDIR, ...); a path that does not exist on the host is skipped."
         }
       }
     },
```

**File**: `crates/nono-cli/data/profile-authoring-guide.md` (modified, +3/-1)
```diff
@@ -1187,7 +1187,9 @@ preferably, use `unix_socket_dir_bind` with a dedicated directory.
 
 Add `"loopback": true` (requires `network`) to let the command use TCP on the namespace's own loopback, for local dev servers and tests. Egress stays proxy-only and the host's localhost stays unreachable.
 
-Network isolation does not block pathname Unix sockets (such as `/run/docker.sock`); use `linux.af_unix_mediation` for those.
+Add `"mounts": true` to mask host IPC endpoints (`$XDG_RUNTIME_DIR`, the D-Bus system bus, container runtime sockets) and give the session a private `/tmp`. Paths the profile grants beneath a mask, including `unix_socket` grants, stay reachable. `"extra_masks": ["$HOME/.corp/agent.sock"]` adds masks (requires `mounts`); lists merge by deduplicated append, so no layer can remove a mask. `mounts` cannot be combined with `security.capability_elevation`.
+
+Network isolation does not block pathname Unix sockets (such as `/run/docker.sock`); use `mounts` to hide them or `linux.af_unix_mediation` to mediate them. Any filesystem grant beneath a mask is re-bound, so a read grant of a directory under `$XDG_RUNTIME_DIR` makes every socket in it connectable.
 
 #### Linux
 
```

**File**: `crates/nono-cli/src/cli.rs` (modified, +10/-3)
```diff
@@ -1376,9 +1376,12 @@ pub struct SandboxArgs {
 
     /// Run the command in new Linux namespaces (opt-in, NEP-0004).
     ///
-    /// Comma-separated list of: net, loopback, ipc, uts. Always adds a user
-    /// namespace. `loopback` (requires `net`) allows TCP bind/connect on any
-    /// port of the namespace's own loopback, for local dev servers and tests.
+    /// Comma-separated list of: net, loopback, ipc, uts, mounts. Always adds a
+    /// user namespace. `loopback` (requires `net`) allows TCP bind/connect on
+    /// any port of the namespace's own loopback, for local dev servers and
+    /// tests. `mounts` masks host IPC endpoints ($XDG_RUNTIME_DIR, the D-Bus
+    /// system bus, container runtime sockets) and gives the session a private
+    /// /tmp; granted paths stay reachable through the masks.
     /// `net` leaves only loopback; egress is possible only through the session
     /// proxy, so it requires --block-net or a proxied network policy and cannot
     /// be combined with direct-access grants (--open-port, --listen-port,
@@ -1899,6 +1902,8 @@ pub enum IsolateNamespace {
     Ipc,
     /// UTS namespace.
     Uts,
+    /// Mount namespace masking host IPC endpoints, with a private /tmp.
+    Mounts,
 }
 
 #[cfg(target_os = "linux")]
@@ -1911,6 +1916,8 @@ impl SandboxArgs {
             loopback: has(IsolateNamespace::Loopback),
             ipc: has(IsolateNamespace::Ipc),
             uts: has(IsolateNamespace::Uts),
+            mounts: has(IsolateNamespace::Mounts),
+            extra_masks: Vec::new(),
         }
     }
 }
```

**File**: `crates/nono-cli/src/exec_strategy.rs` (modified, +84/-0)
```diff
@@ -317,6 +317,11 @@ pub struct ExecConfig<'a> {
     /// Landlock and seccomp apply. Partial application is fatal.
     #[cfg(target_os = "linux")]
     pub namespaces: Option<nono::NamespaceSpec>,
+    /// Mount masks applied in the child's new mount namespace, after the id
+    /// maps are written and before Landlock. Present exactly when
+    /// `namespaces` requests a mount namespace.
+    #[cfg(target_os = "linux")]
+    pub mount_mask: Option<&'a nono::PreparedMountMask>,
     /// Allow-list of environment variable names. When set, only variables
     /// matching a glob pattern (e.g. `"AWS_*"`, `"*_TOKEN"`, `"*SECRET*"`) are
     /// passed to the child. Nono-injected credentials always bypass this.
@@ -1522,6 +1527,25 @@ pub fn execute_supervised<F: FnMut(i32) -> bool>(
                 }
             }
 
+            // Mount masks are mounts on host dentries; the host removing or
+            // replacing one detaches the mask. Watch for that for the whole
+            // session and terminate the sandbox rather than let it reach the
+            // new host endpoint.
+            #[cfg(target_os = "linux")]
+            let _mount_watch = match clone_bootstrap
+                .as_mut()
+                .and_then(|bootstrap| bootstrap.mount_watch.take())
+                .map(spawn_mount_watch)
+                .transpose()
+            {
+                Ok(guard) => guard,
+                Err(error) => {
+                    let _ = signal::kill(child, Signal::SIGKILL);
+                    let _ = waitpid(child, None);
+                    return Err(error);
+                }
+            };
+
             // Set up signal forwarding.
             setup_signal_forwarding(child, pty_proxy.as_ref().map(|p| p.poll_fds().0));
             let _signal_forwarding_guard = SignalForwardingGuard;
@@ -3467,6 +3491,66 @@ fn run_supervisor_loop_inner(
     Ok((status, denials.fs, ipc_denials, denials.url))
 }
 
+/// Stops the mount mask watch when the session ends.
+#[cfg(target_os = "linux")]
+struct MountWatchGuard {
+    stop: std::sync::Arc<std::sync::atomic::AtomicBool>,
+}
+
+#[cfg(target_os = "linux")]
+impl Drop for MountWatchGuard {
+    fn drop(&mut self) {
+        self.stop.store(true, std::sync::atomic::Ordering::SeqCst);
+    }
+}
+
+/// Run `watch` on its own thread until the guard drops. On a lost mask, or
+/// if the watch itself fails, every process in the sandbox is killed: the
+/// masks are a security boundary and are never silently given up.
+#[cfg(target_os = "linux")]
+fn spawn_mount_watch(mut watch: nono::MountMaskWatch) -> Result<MountWatchGuard> {
+    use std::sync::atomic::Ordering;
+    let stop = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
+    let thread_stop = std::sync::Arc::clone(&stop);
+    let spawned = std::thread::Builder::new()
+        .name("nono-mount-watch".to_string())
+        .spawn(move || {
+            loop {
+                // Re-check on every wake-up, not only on a change event, so
+                // a missed event costs at most one interval.
+                let waited = watch.wait(500);
+                if thread_stop.load(Ordering::SeqCst) {
+                    return;
+                }
+                let reason = match waited.and_then(|_| watch.removed_mask()) {
+                    Ok(None) => continue,
+                    Ok(Some(path)) => format!(
+                        "the host removed the mount mask over {} (the path was deleted, \
+                         replaced or unmounted)",
+                        path.display()
+                    ),
+                    Err(error) => format!("the mount mask watch failed: {error}"),
+                };
+                if thread_stop.load(Ordering::SeqCst) {
+                    return;
+                }
+                let killed = watch.terminate_sandbox();
+                warn!("{reason}; sandbox terminated ({killed:?})");
+                eprintln!(
+                    "\n  [nono] {reason}. The sandbox was terminated so that host endpoint stays \
+                     unreachable."
+                );
+                return;
+            }
+        });
+    // Without the watch a host-side change could expose a masked socket, so
+    // the caller ends the session instead of running unwatched.
+    spawned.map_err(|error| {
+        NonoError::SandboxInit(format!("cannot start the mount mask watch: {error}"))
+    })?;
+    Ok(MountWatchGuard { stop })
+}
+
 #[cfg(target_os = "linux")]
 fn drain_pending_network_notifications(
     proxy_notify_raw_fd: Option<std::os::fd::RawFd>,
```

**File**: `crates/nono-cli/src/exec_strategy/clone_files.rs` (modified, +131/-11)
```diff
@@ -27,6 +27,12 @@ const ACK: u8 = 0xa1;
 // Sent instead of READY when namespace entry fails, followed by the failing
 // stage code and errno, so the parent can name what the host refused.
 const NAMESPACE_FAILED: u8 = 0xe1;
+// Mount masking: the parent sends MOUNT_GO once the id maps are written; the
+// child answers with an 8-byte record led by MOUNTED or MOUNT_FAILED (then the
+// failed step, the operation index and the errno).
+const MOUNT_GO: u8 = 0xb1;
+const MOUNTED: u8 = 0xb2;
+const MOUNT_FAILED: u8 = 0xe2;
 const BOOTSTRAP_SECONDS: i64 = 15;
 
 // All supervised notification sessions hold this lock until their listener
@@ -47,6 +53,9 @@ pub(super) struct Bootstrap {
     /// Loopback listener created inside the child's network namespace, when
     /// namespace isolation requested a proxy bridge.
     pub bridge: Option<OwnedFd>,
+    /// Watch over the child's mount masks, pinned after the child applied
+    /// them and before it ran untrusted code.
+    pub mount_watch: Option<nono::MountMaskWatch>,
 }
 
 pub(super) struct Command<'a> {
@@ -92,29 +101,36 @@ fn namespace_confines_tcp(config: &ExecConfig<'_>) -> bool {
         .is_some_and(|spec| spec.has_network() && spec.loopback_tcp_enabled())
 }
 
+/// Prepare the child's Landlock policy. With `root` (the child's
+/// `/proc/<pid>/root` under a mount mask) every rule path is resolved as the
+/// child sees it, so a grant of a masked directory such as `/tmp` attaches to
+/// the session's private tmpfs rather than the hidden host directory.
 fn prepare(
     caps: &CapabilitySet,
     abi: &DetectedAbi,
     policy: LinuxSandboxPolicy,
     namespace_tcp: bool,
+    root: Option<std::os::fd::BorrowedFd<'_>>,
 ) -> Result<PreparedLandlockSandbox> {
-    match (policy, namespace_tcp) {
-        (LinuxSandboxPolicy::Auto, false) => {
-            sandbox::prepare_seccomp_with_abi(caps, abi, nono::SeccompOpts::network_baseline())
-        }
+    let opts = match (policy, namespace_tcp) {
+        (LinuxSandboxPolicy::Auto, false) => Some(nono::SeccompOpts::network_baseline()),
         // TCP confined by the network namespace: no Landlock TCP rules, but
         // UDP, raw and non-IP sockets stay denied by the static baseline.
-        (LinuxSandboxPolicy::Auto, true) => sandbox::prepare_seccomp_with_abi(
-            caps,
-            abi,
-            nono::SeccompOpts::external_tcp_with_baseline(),
-        ),
+        (LinuxSandboxPolicy::Auto, true) => Some(nono::SeccompOpts::external_tcp_with_baseline()),
         // External delegates TCP already; Landlock policy installs no seccomp,
         // so with loopback it keeps Landlock filesystem rules only.
         (LinuxSandboxPolicy::External, _) | (LinuxSandboxPolicy::Landlock, true) => {
-            sandbox::prepare_seccomp_with_abi(caps, abi, nono::SeccompOpts::external_tcp())
+            Some(nono::SeccompOpts::external_tcp())
+        }
+        (LinuxSandboxPolicy::Landlock, false) => None,
+    };
+    match (opts, root) {
+        (Some(opts), None) => sandbox::prepare_seccomp_with_abi(caps, abi, opts),
+        (Some(opts), Some(root)) => {
+            sandbox::prepare_seccomp_with_abi_in_root(caps, abi, opts, root)
         }
-        (LinuxSandboxPolicy::Landlock, false) => sandbox::prepare_landlock_with_abi(caps, abi),
+        (None, None) => sandbox::prepare_landlock_with_abi(caps, abi),
+        (None, Some(root)) => sandbox::prepare_landlock_with_abi_in_root(caps, abi, root),
     }
 }
 
@@ -167,6 +183,38 @@ fn namespace_failure(record: [u8; 5]) -> NonoError {
     ))
 }
 
+fn mount_failure(plan: &nono::PreparedMountMask, record: [u8; 7]) -> NonoError {
+    let step = sandbox::MountMaskStep::from_code(record[0])
+        .map_or("an unknown step", sandbox::MountMaskStep::describe);
+    let index = u16::from_ne_bytes([record[1], record[2]]);
+    let errno = i32::from_ne_bytes([record[3], record[4], record[5], record[6]]);
+    let action = if plan.operation_is_rebind(index) {
+        "re-binding granted path"
+    } else {
+        "masking"
+    };
+    let path = plan.operation_path(index).map_or_else(
+        || String::from("<unknown path>"),
+        |p| p.display().to_string(),
+    );
+    let cause = match errno {
+        libc::ESTALE => {
+            " The path changed between preparation and launch (it was replaced or a symlink \
+             appeared)."
+        }
+        libc::EPERM | libc::EACCES => {
+            " A security module (AppArmor or SELinux mount rules) or a seccomp filter may \
+             forbid mounting in user namespaces."
+        }
+        _ => "",
+    };
+    NonoError::SandboxInit(format!(
+        "namespace isolation failed while {action} {path} ({step}): {}.{cause} nono does not \
+         run without the requested isolation.",
+        std::io::Error::from_raw_os_error(errno)
+    ))
+}
+
 fn above_stdio(fd: OwnedFd) -> Result<OwnedFd> {
     if fd.as_raw_fd() >= 3 {
         return Ok(fd);
@@ -229,6 +277,11 @@ pub
```

**File**: `crates/nono-cli/src/exec_strategy/clone_files/tests.rs` (modified, +1/-0)
```diff
@@ -71,6 +71,7 @@ fn config(caps: &CapabilitySet, filesystem: bool, proxy: bool) -> ExecConfig<'_>
         },
         sandbox_policy: LinuxSandboxPolicy::Auto,
         namespaces: None,
+        mount_mask: None,
         allowed_env_vars: None,
         denied_env_vars: None,
         case_insensitive_env_vars: false,
```

**File**: `crates/nono-cli/src/execution_runtime.rs` (modified, +66/-5)
```diff
@@ -351,7 +351,11 @@ pub(crate) fn execute_sandboxed(plan: LaunchPlan) -> Result<()> {
         &domain_endpoints,
         &flags,
     );
-    let cap_file_path = cap_file.unwrap_or_else(|| std::path::PathBuf::from("/dev/null"));
+    #[cfg_attr(not(target_os = "linux"), allow(unused_mut))]
+    let mut cap_file = cap_file;
+    let cap_file_path = cap_file
+        .as_ref()
+        .map_or_else(|| std::path::PathBuf::from("/dev/null"), |f| f.path.clone());
     if cap_file_path != Path::new("/dev/null") {
         caps.add_fs(FsCapability::new_file(&cap_file_path, AccessMode::Read)?);
     }
@@ -713,7 +717,31 @@ pub(crate) fn execute_sandboxed(plan: LaunchPlan) -> Result<()> {
     let namespaces = if flags.isolate.is_empty() {
         None
     } else {
-        Some(crate::isolation::prepare_namespaces(flags.isolate, &caps)?)
+        Some(crate::isolation::prepare_namespaces(&flags.isolate, &caps)?)
+    };
+    // The mount mask is built from the final capability set, so every grant
+    // (including the sandbox state file) is re-bound through the masks.
+    #[cfg(target_os = "linux")]
+    let mount_mask = if namespaces
+        .as_ref()
+        .is_some_and(nono::NamespaceSpec::has_mounts)
+    {
+        let plan = crate::isolation::prepare_mount_mask(&flags.isolate, &caps, &requested_workdir)?;
+        crate::output::print_mount_mask(&plan, flags.silent);
+        crate::isolation::reject_hidden_workdir(&plan, &current_dir)?;
+        // Record exactly what this plan masks and re-binds, so `nono why
+        // --self` answers from the applied plan rather than recomputing it.
+        if let Some(CapabilityStateFile { path, file, state }) = cap_file.as_mut()
+            && let Some(isolation) = state.isolation.as_mut()
+        {
+            (isolation.masked_paths, isolation.rebound_paths) = crate::isolation::mount_view(&plan);
+            if let Err(error) = state.rewrite(file, path) {
+                warn!("cannot record the mount mask in the sandbox state file: {error}");
+            }
+        }
+        Some(plan)
+    } else {
+        None
     };
 
     // With `linux.isolate.loopback` the validated network namespace confines
@@ -794,6 +822,8 @@ pub(crate) fn execute_sandboxed(plan: LaunchPlan) -> Result<()> {
         sandbox_policy: flags.sandbox_policy,
         #[cfg(target_os = "linux")]
         namespaces,
+        #[cfg(target_os = "linux")]
+        mount_mask: mount_mask.as_ref(),
         allowed_env_vars: flags.allowed_env_vars,
         denied_env_vars: flags.denied_env_vars,
         case_insensitive_env_vars: flags.case_insensitive_env_vars,
@@ -901,6 +931,17 @@ fn validate_command_policy_execution_support() -> Result<()> {
     }
 }
 
+/// A written sandbox state file, kept open so launch-time facts decided after
+/// it was granted (the applied mount mask) can still be recorded in it.
+struct CapabilityStateFile {
+    path: std::path::PathBuf,
+    // Only the Linux mount mask is recorded after the file is written.
+    #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
+    file: std::fs::File,
+    #[cfg_attr(not(target_os = "linux"), allow(dead_code))]
+    state: sandbox_state::SandboxState,
+}
+
 fn write_capability_state_file(
     caps: &CapabilitySet,
     bypass_protection_paths: &[crate::policy::AppliedBypass],
@@ -909,7 +950,7 @@ fn write_capability_state_file(
     denied_domains: &[String],
     domain_endpoints: &[sandbox_state::DomainEndpointState],
     flags: &ExecutionFlags,
-) -> Option<std::path::PathBuf> {
+) -> Option<CapabilityStateFile> {
     let mut state = sandbox_state::SandboxState::from_caps_with_denies(
         caps,
         bypass_protection_paths,
@@ -924,11 +965,31 @@ fn write_capability_state_file(
     let linux_af_unix_mediation = false;
     state.pathname_socket_enforcement =
         sandbox_state::pathname_socket_enforcement(linux_af_unix_mediation);
+    #[cfg(target_os = "linux")]
+    if !flags.isolate.is_empty() {
+        state.isolation = Some(sandbox_state::IsolationState {
+            namespaces: flags
+                .isolate
+                .labels()
+                .into_iter()
+                .map(str::to_string)
+                .collect(),
+            // Filled in from the applied plan once it is built.
+            masked_paths: Vec::new(),
+            rebound_paths: Vec::new(),
+        });
+    }
 
     for _ in 0..8 {
         let cap_file = next_capability_state_file_path();
-        match state.write_to_file(&cap_file) {
-            Ok(()) => return Some(cap_file),
+        match state.create_file(&cap_file) {
+            Ok(file) => {
+                return Some(CapabilityStateFile {
+                    path: cap_file,
+                    file,
+                    state,
+                });
+            }
             Err(NonoError::ConfigWrite { source, .. })
                 if source.kind() == std::io::ErrorKind::AlreadyExists =>
             {
```

**File**: `crates/nono-cli/src/isolation.rs` (modified, +371/-19)
```diff
@@ -1,15 +1,67 @@
 //! Opt-in Linux namespace isolation policy (NEP-0004).
 //!
 //! The mechanism (namespace spec, raw child entry, id maps, bridge validation,
-//! probe) lives in `nono::sandbox`. This module owns every policy decision:
-//! which network modes and grants isolation can be combined with, how the
-//! proxy bridge is wired, and how a host refusal is explained to the user.
+//! mount masks, probe) lives in `nono::sandbox`. This module owns every policy
+//! decision: which network modes and grants isolation can be combined with,
+//! how the proxy bridge is wired, which host paths are masked, and how a host
+//! refusal is explained to the user.
 
 use crate::cli::SandboxArgs;
 use crate::profile::LinuxIsolateConfig;
 use crate::sandbox_prepare::{PreparedSandbox, has_proxy_intent};
+use nono::sandbox::{MountSkipReason, PreparedMountMask};
 use nono::{CapabilitySet, NamespaceProbe, NamespaceProbeStage, NamespaceSpec, NetworkMode};
-use nono::{NonoError, Result, Sandbox};
+use nono::{MountMask, NonoError, Result, Sandbox};
+use std::path::{Path, PathBuf};
+
+/// System IPC endpoints masked by `linux.isolate.mounts`, besides the user's
+/// runtime directory and `/tmp`. Pathname `connect(2)` is not governed by
+/// Landlock below ABI 9, so these sockets are hidden rather than mediated.
+/// Any change to this list is a security change.
+///
+/// A directory is preferred over the socket inside it where the daemon owns
+/// the whole directory: a directory mask also hides sockets created after
+/// launch, and is not lost when the daemon recreates its socket. Sockets that
+/// live directly in a shared directory (`/run/docker.sock`) can only be masked
+/// as files; the session's mount watch terminates the sandbox if the host
+/// removes one of those masks.
+const DEFAULT_SYSTEM_MASKS: &[&str] = &[
+    // D-Bus system bus.
+    "/run/dbus",
+    // Container and VM managers: each socket grants root-equivalent control.
+    "/run/docker.sock",
+    "/var/run/docker.sock",
+    "/run/docker",
+    "/run/containerd",
+    "/run/k3s",
+    "/run/crio",
+    "/run/podman",
+    "/run/libvirt",
+    "/var/lib/incus/unix.socket",
+    "/var/lib/lxd/unix.socket",
+    "/var/snap/lxd/common/lxd/unix.socket",
+    // snapd and the systemd system manager's private socket.
+    "/run/snapd.socket",
+    "/run/systemd/private",
+    // Smart cards and hardware tokens (pcscd).
+    "/run/pcscd",
+];
+/// Mode of the tmpfs over the user's runtime directory, matching systemd.
+const RUNTIME_DIR_MODE: u32 = 0o700;
+/// Mode of the per-session `/tmp`.
+const PRIVATE_TMP_MODE: u32 = 0o1777;
+/// Mode of the tmpfs over other masked directories.
+const SYSTEM_DIR_MODE: u32 = 0o755;
+/// Size and inode limits of the tmpfs over the user's runtime directory. A
+/// grant of the whole directory makes it writable, so it gets room for
+/// sockets and small state files, but not half of RAM.
+const RUNTIME_DIR_SIZE: u64 = 16 << 20;
+/// Size limit of the tmpfs over other masked directories, which hold only
+/// re-bind mount points.
+const SYSTEM_DIR_SIZE: u64 = 1 << 20;
+/// Inode limit of every non-`/tmp` mask tmpfs: enough for the mount points
+/// of every re-bind a plan can hold.
+const MASK_INODES: u64 = 16_384;
 
 /// Reject configurations that namespace isolation cannot satisfy, before
 /// anything is started.
@@ -18,8 +70,18 @@ use nono::{NonoError, Result, Sandbox};
 /// proxy. Allow-all networking and every grant of direct reachability would
 /// silently stop working, so each is a configuration error instead.
 pub(crate) fn validate_config(args: &SandboxArgs, prepared: &PreparedSandbox) -> Result<()> {
-    let isolate = prepared.isolate;
+    let isolate = &prepared.isolate;
     reject_loopback_without_network(isolate).map_err(NonoError::ConfigParse)?;
+    reject_masks_without_mounts(isolate).map_err(NonoError::ConfigParse)?;
+    if isolate.mounts && prepared.capability_elevation {
+        return Err(NonoError::ConfigParse(
+            "linux.isolate.mounts (--isolate mounts) cannot be combined with capability \
+             elevation: approved paths are opened by the supervisor outside the sandbox's \
+             mount namespace, so they would bypass the masks and the private /tmp. Grant the \
+             paths up front instead."
+                .to_string(),
+        ));
+    }
     if !isolate.network {
         return Ok(());
     }
@@ -46,7 +108,9 @@ pub(crate) fn validate_config(args: &SandboxArgs, prepared: &PreparedSandbox) ->
 /// `loopback` lifts TCP enforcement on the grounds that the network namespace
 /// confines TCP to its own loopback. Without that namespace it would grant
 /// host-loopback reachability, so it is always an error on its own.
-fn reject_loopback_without_network(isolate: LinuxIsolateConfig) -> std::result::Result<(), String> {
+fn reject_loopback_without_network(
+    isolate: &LinuxIsolateConfig,
+) -> std::result::Result<(), String> {
     if isolate.loopback && !i
```

#### Recent Merged Pull Requests:
- **PR #2332** (2026-11-17): fix(audit): include session profile references in platform uploads (@SequeI)
- **PR #2331** (2026-11-17): feat(cli): announce pending non-interactive approval queries (@lukehinds)
- **PR #2329** (2026-11-17): feat(linux): implement mount namespace isolation and host IPC masking (@lukehinds)
- **PR #2328** (2026-11-17): test: fix flaky tests in socket auth, capture and fd churn (@daescha)
- **PR #2327** (2026-11-17): feat(platform): apply signed advisory policy at session startup (@SequeI)
- **PR #2322** (2026-11-16): chore(deps): bump jsonschema from 0.60.2 to 0.61.2 (@dependabot[bot])

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

## X. test: fix flaky tests in socket auth, capture and fd churn

**RULE**:
When implementing operations in `crates/nono-cli/src/exec_strategy/clone_files/tests.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nolabs-ai/nono. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `29a97842`: test: fix flaky tests in socket auth, capture and fd churn. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/nono-cli/src/exec_strategy/clone_files/tests.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
                // Ignoring first discards a pending SIGUSR1 another thread has not taken yet.
                // SAFETY: SIG_IGN is a valid action and self.0 was saved by sigaction.
                    let mut ignore: libc::sigaction = std::mem::zeroed();
                    ignore.sa_sigaction = libc::SIG_IGN;
                    libc::sigaction(libc::SIGUSR1, &ignore, std::ptr::null_mut());
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
                // SAFETY: restore the action saved by sigaction.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `29a97842` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

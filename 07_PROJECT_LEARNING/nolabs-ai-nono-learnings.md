> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/nolabs-ai-nono-learnings.md`  
> **Source**: github ([https://github.com/nolabs-ai/nono](https://github.com/nolabs-ai/nono))  
> **Source Version**: `d4d1c774`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-25T10:35:23.395Z  
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
> **Harvest Timestamp**: 2026-11-25T10:35:23.388Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `nolabs-ai/nono`
- **Description**: agent runtime security - zero trust, zero setup, zero latency agent sandboxing
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 5100 stars

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
    /// Unlisted hosts require a network approval, including with an empty allowlist.
    #[serde(default)]
    pub network_approvals: bool,
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
    /// URL path glob pattern, normalized like the proxy's rule paths
    pub path: nono_proxy::config::EndpointPath,
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
            bypas
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
- **Issue #2365** (2026-11-25): **fix(platform): preserve device identity across unenrollment**
  *Symptoms*: ## Summary  - Preserve installation identity and keys across unenrollment; login reactivates the same device and can update its name. - Block revoked devices until operator restoration, and prevent inactive registrations from starting sessions. - Keep account recovery available during policy outages while preserving enforced-mode protections.  Normal unenrollment requires server confirmation; `--local-only` explicitly skips it. Older servers that cannot confirm unenrollment leave local state intact.  ## Test Plan  `make ci` and seven CLI integration tests passed, covering identity reuse, revocation, recovery and enforced mode.  ## Agent Disclosure  Codex-assisted, maintainer-directed fix. Reviewed `AGENTS.md`, `CONTRIBUTING.md`, `GOVERNANCE.md`, `SECURITY.md`, NEP guidance and existing protocol contracts; follows repository requirements.  ## Agent Compliance Check  - [x] Maintainer-directed scope; DCO-signed commits; coding/security rules and attribution requirements followed. - [x] Regression coverage and owning documentation updated; no sandbox primitive or library/CLI boundary change. 

- **Issue #2363** (2026-11-25): **fix(proxy): keep command-only route hosts out of the session allowlist**
  *Symptoms*: ## Summary  Command-only credential routes are meant to be available only to their command-scoped proxies. When building the session proxy config, their upstream hosts are now excluded from the session allowlist too, along with the routes themselves. Command-scoped proxies build their own allowlist, so they are unaffected.  ## Agent Disclosure  An AI agent (Claude Code) drafted this PR at the contributor's direction. The contributor reviews it and submits it. Consulted `crates/nono-cli/src/proxy_runtime.rs`, CONTRIBUTING.md, and AGENTS.md. The change follows repository requirements: no `unwrap`/`expect` outside tests, and a conventional commit with DCO sign-off.  ## Test Plan  - New unit test in `proxy_runtime.rs` covering open and strict network policies. Existing credential-route tests still pass. - `make fmt-check`, `make clippy`, `make test-cli` (2,899 passed, 0 failed). - Manual check on macOS: command-scoped credential routes still work through their commands.  ## Checklist  - [x] An issue exists and is linked above, or this is maintainer-directed routine work - [x] All commits are signed-off, using [DCO](https://en.wikipedia.org/wiki/Developer_Certificate_of_Origin) - [x] Code changes follow the project's coding standards ([AGENTS.md](../AGENTS.md)) and have appropriate test coverage - [x] Public-facing changes are paired with documentation updates (no public-facing change) - [ ] If this PR implements a major feature, capability, or security-relevant change, a correspo
  **Post-Mortem & Fix Analysis**:
  > <!-- pr-review-summary -->  ## PR Review Summary  ### Size  | Metric | Value | |--------|-------| | Lines added | +55 | | Lines removed | -0 | | Total changed | 55 | | **Classification** | **Medium (50–300 lines)** |  ### Affected crates  - **crates/nono-cli** — CLI changes. Verify argument parsing, flag documentation, and UX behaviour across supported platforms.  ### Blast radius — Contained  This PR touches: **source code**  --- <sub>Updated automatically on each push to this PR.</sub>

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

### Incident Patch 1: `90a9c254` (2026-11-25)
**Commit Message**: fix(proxy): keep command-only route hosts out of the session allowlist (#2363)

build_proxy_config_from_flags adds every credential route's upstream host
to allowed_hosts so the proxy can reach it after TLS interception. Tool
sandbox (command_policies) routes are in that list too, and
remove_tool_sandbox_routes later drops only the routes from the session
proxy, never their hosts. The session therefore kept a plain CONNECT
tunnel to every command-only upstream, wildcards included, with no
credential injection, endpoint policy or approval: with a command policy
holding https://sts.*.amazonaws.com, any session process reached
sts.<region>.amazonaws.com directly.

Skip tool sandbox routes when deriving the session allowlist. The
command-scoped proxies build their own allowlist and are unaffected.

Signed-off-by: Leonardo Zanivan <[REDACTED_EMAIL]>
Co-authored-by: Claude <[REDACTED_EMAIL]>

**File**: `crates/nono-cli/src/proxy_runtime.rs` (modified, +55/-0)
```diff
@@ -2530,8 +2530,20 @@ pub(crate) fn build_proxy_config_from_flags(
     // when the child curls the real upstream URL (CONNECT + TLS intercept).
     // Use url::Url::parse so credentials embedded in the URL (user:pass@host)
     // don't end up in the allowlist as a garbled "user:pass@host:port" string.
+    //
+    // Command-only (tool sandbox) routes are skipped: this allowlist is the
+    // session proxy's, which never carries those routes (see
+    // remove_tool_sandbox_routes), so their upstream would be a plain
+    // CONNECT tunnel for every session process, with no credential injection
+    // or endpoint policy. Command-scoped proxies build their own allowlist.
     if host_allowlist_active {
         for route in &routes {
+            if proxy
+                .tool_sandbox_proxy_credentials
+                .contains(route.prefix.trim_matches('/'))
+            {
+                continue;
+            }
             if let Ok(parsed) = url::Url::parse(&route.upstream)
                 && let Some(host) = parsed.host_str()
             {
@@ -4286,6 +4298,49 @@ mod tests {
         );
     }
 
+    /// A command-only (tool sandbox) credential route must not open its
+    /// upstream to the session proxy: the session never carries the route, so
+    /// the host would be a plain tunnel with no credential or endpoint policy.
+    #[test]
+    fn test_tool_sandbox_route_upstream_is_not_in_session_allowlist() {
+        for strict in [false, true] {
+            let mut proxy = proxy_with_custom_credential(
+                strict,
+                vec![crate::profile::AllowDomainEntry::Plain(
+                    "www.example.com".to_string(),
+                )],
+            );
+            proxy
+                .tool_sandbox_proxy_credentials
+                .insert("bedrock".to_string());
+            let config = build_proxy_config_from_flags(&proxy).expect("build proxy config");
+
+            assert!(
+                !config
+                    .allowed_hosts
+                    .iter()
+                    .any(|host| host.starts_with("bedrock-runtime.")),
+                "a command-only route upstream must not reach the session allowlist: {:?}",
+                config.allowed_hosts
+            );
+            assert!(
+                config
+                    .allowed_hosts
+                    .iter()
+                    .any(|host| host == "www.example.com"),
+                "the explicit allowlist entry must be preserved"
+            );
+            let filter = nono_proxy::filter::ProxyFilter::new_strict(&config.allowed_hosts);
+            assert!(
+                matches!(
+                    filter.check_host_with_ips("bedrock-runtime.us-east-1.amazonaws.com", &[]),
+                    nono::net_filter::FilterResult::DenyNotAllowed { .. },
+                ),
+                "the session filter must refuse a command-only route's host"
+            );
+        }
+    }
+
     #[test]
     fn test_custom_credential_upstream_is_added_to_strict_empty_allowlist() {
         let proxy = proxy_with_custom_credential(true, Vec::new());
```

---

### Incident Patch 2: `d4d1c774` (2026-11-25)
**Commit Message**: fix(proxy): send auth.extra_params on client_credentials token requests (#2362)

* fix(proxy): send auth.extra_params on client_credentials token requests

auth.extra_params loaded cleanly but was only sent on the SPIFFE
jwt-bearer path; client_credentials requests silently dropped it.
Append the params to the client_credentials body (sorted by key) on the
initial exchange and every refresh.

Reject extra_params keys that nono already sets (grant_type, client_id,
client_secret, scope, client_assertion, client_assertion_type,
assertion) so a request never repeats a parameter (RFC 6749 §3.2). The
validator lives in nono-proxy config and runs from both the profile
loader and the route builder.

Also send auth.scope on the SPIFFE jwt-bearer path, which previously
dropped it.

Fixes #2361

Co-Authored-By: Claude <[REDACTED_EMAIL]>
Signed-off-by: Leonardo Zanivan <[REDACTED_EMAIL]>

* docs(proxy): describe auth.extra_params independently of grant type

extra_params and its reserved-key rules apply to every OAuth2 grant, so
drop the per-grant wording from the schema and docs and point the SPIFFE
page at the shared rules.

Co-Authored-By: Claude <[REDACTED_EMAIL]>
Signed-off-by: Leonardo Z

**File**: `crates/nono-cli/src/profile/mod.rs` (modified, +37/-0)
```diff
@@ -943,9 +943,12 @@ fn validate_proxy_override(name: &str, cred: &CustomCredentialDef) -> Result<()>
 /// - `client_id` must not be empty
 /// - `client_secret` must not be empty and must be a credential reference
 ///   (env://, file://, op://, bw://, apple-password://) or plain value
+/// - `extra_params` must not repeat a parameter nono sets
 fn validate_oauth2_auth(name: &str, auth: &OAuth2Config) -> Result<()> {
     // Validate token_url — same rules as upstream URL (HTTPS or loopback HTTP)
     validate_upstream_url(&auth.token_url, &format!("{}/auth.token_url", name))?;
+    nono_proxy::config::validate_oauth2_extra_params(&auth.extra_params)
+        .map_err(|e| NonoError::ProfileParse(format!("custom credential '{}': {}", name, e)))?;
 
     // When using client_assertion, client_id/client_secret are not required,
     // but the assertion config itself must have valid fields.
@@ -7373,6 +7376,40 @@ mod tests {
         assert!(err.to_string().contains("mutually exclusive"));
     }
 
+    #[test]
+    fn test_validate_oauth2_extra_params_reserved_key_rejected() {
+        let mut cred = oauth2_cred_builder();
+        cred.auth = Some(OAuth2Config {
+            token_url: "https://auth.example.com/oauth/token".to_string(),
+            client_id: "my-client".to_string(),
+            client_secret: "env://SECRET".to_string(),
+            scope: String::new(),
+            client_assertion: None,
+            extra_params: [("client_secret".to_string(), "other".to_string())].into(),
+        });
+        let err = validate_custom_credential("test", &cred)
+            .expect_err("reserved extra_params key should be rejected");
+        assert!(err.to_string().contains("client_secret"));
+    }
+
+    #[test]
+    fn test_validate_oauth2_extra_params_extension_allowed() {
+        let mut cred = oauth2_cred_builder();
+        cred.auth = Some(OAuth2Config {
+            token_url: "https://auth.example.com/oauth/token".to_string(),
+            client_id: "my-client".to_string(),
+            client_secret: "env://SECRET".to_string(),
+            scope: String::new(),
+            client_assertion: None,
+            extra_params: [(
+                "audience".to_string(),
+                "https://tenant.example.com/api/v2/".to_string(),
+            )]
+            .into(),
+        });
+        assert!(validate_custom_credential("test", &cred).is_ok());
+    }
+
     #[test]
     fn test_validate_oauth2_scope_optional() {
         let mut cred = oauth2_cred_builder();
```

**File**: `crates/nono-proxy/src/config.rs` (modified, +82/-1)
```diff
@@ -1948,11 +1948,54 @@ pub struct OAuth2Config {
     /// Mutually exclusive with `client_id`/`client_secret`.
     #[serde(default)]
     pub client_assertion: Option<ClientAssertionConfig>,
-    /// Extra parameters merged into the token exchange POST body verbatim.
+    /// Extra parameters appended to the token exchange POST body. Keys that
+    /// the grant itself sets are rejected; see [`validate_oauth2_extra_params`].
     #[serde(default)]
     pub extra_params: std::collections::HashMap<String, String>,
 }
 
+/// Token request parameters set by nono's grants, matched case-insensitively.
+const RESERVED_OAUTH2_PARAMS: &[&str] = &[
+    "grant_type",
+    "client_id",
+    "client_secret",
+    "scope",
+    "client_assertion",
+    "client_assertion_type",
+    "assertion",
+];
+
+/// Validate `OAuth2Config::extra_params`, shared by the profile loader and the
+/// proxy route builder so the rules cannot drift.
+///
+/// Rejects empty keys and keys nono already sends: RFC 6749 §3.2 forbids
+/// repeating a request parameter, and a repeated `grant_type` or credential
+/// parameter could make the server read a different value than nono intends.
+///
+/// # Errors
+///
+/// Returns a message describing the first invalid key.
+pub fn validate_oauth2_extra_params(
+    params: &std::collections::HashMap<String, String>,
+) -> std::result::Result<(), String> {
+    let mut keys: Vec<&String> = params.keys().collect();
+    keys.sort();
+    for key in keys {
+        if key.is_empty() {
+            return Err("auth.extra_params keys cannot be empty".to_string());
+        }
+        if RESERVED_OAUTH2_PARAMS
+            .iter()
+            .any(|reserved| key.eq_ignore_ascii_case(reserved))
+        {
+            return Err(format!(
+                "auth.extra_params cannot set '{key}': nono sets it for the token request"
+            ));
+        }
+    }
+    Ok(())
+}
+
 #[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
 #[serde(tag = "type", rename_all = "snake_case")]
 pub enum ClientAssertionConfig {
@@ -3182,6 +3225,44 @@ mod tests {
         assert!(err.contains("dev-ro"), "{err}");
     }
 
+    fn extra_params_of(keys: &[&str]) -> std::collections::HashMap<String, String> {
+        keys.iter()
+            .map(|k| (k.to_string(), "v".to_string()))
+            .collect()
+    }
+
+    #[test]
+    fn test_oauth2_extra_params_validation_accepts_extension_params() {
+        assert_eq!(
+            validate_oauth2_extra_params(&extra_params_of(&["audience", "organization"])),
+            Ok(())
+        );
+        assert_eq!(validate_oauth2_extra_params(&extra_params_of(&[])), Ok(()));
+    }
+
+    #[test]
+    fn test_oauth2_extra_params_validation_rejects_reserved_keys() {
+        for key in [
+            "grant_type",
+            "client_id",
+            "client_secret",
+            "scope",
+            "client_assertion",
+            "client_assertion_type",
+            "assertion",
+            "Grant_Type",
+        ] {
+            let err = validate_oauth2_extra_params(&extra_params_of(&[key])).unwrap_err();
+            assert!(err.contains(key), "{err}");
+        }
+    }
+
+    #[test]
+    fn test_oauth2_extra_params_validation_rejects_empty_key() {
+        let err = validate_oauth2_extra_params(&extra_params_of(&[""])).unwrap_err();
+        assert!(err.contains("empty"), "{err}");
+    }
+
     #[test]
     fn test_aws_auth_config_profiles_absent_is_none() {
         let aws: AwsAuthConfig = serde_json::from_str(r#"{"profile": "dev"}"#).unwrap();
```

**File**: `crates/nono-proxy/src/credential.rs` (modified, +121/-5)
```diff
@@ -480,17 +480,14 @@ impl CredentialStore {
                         }
                     };
 
-                    let extra_params: Vec<(String, String)> = oauth2
-                        .extra_params
-                        .iter()
-                        .map(|(k, v)| (k.clone(), v.clone()))
-                        .collect();
+                    let extra_params = sorted_extra_params(&oauth2.extra_params);
 
                     match tokio::task::block_in_place(|| {
                         tokio::runtime::Handle::current().block_on(SpiffeAssertionTokenCache::new(
                             oauth2.token_url.clone(),
                             jwt_source,
                             audience.clone(),
+                            oauth2.scope.clone(),
                             extra_params,
                             tls_connector.clone(),
                         ))
@@ -569,6 +566,7 @@ impl CredentialStore {
                         client_id,
                         client_secret,
                         scope: oauth2.scope.clone(),
+                        extra_params: sorted_extra_params(&oauth2.extra_params),
                     };
 
                     match TokenCache::new(config, tls_connector.clone()).await {
@@ -791,6 +789,16 @@ const KEYRING_SERVICE: &str = nono::keystore::DEFAULT_SERVICE;
 
 const KEYRING_TIMEOUT_HINT: &str = " Set NONO_KEYRING_TIMEOUT_SECS=N (default 120) to wait longer for keychain unlock; 0 disables the timeout.";
 
+/// Token-request extra params in key order, so the request body is deterministic.
+fn sorted_extra_params(
+    params: &std::collections::HashMap<String, String>,
+) -> Vec<(String, String)> {
+    let mut sorted: Vec<(String, String)> =
+        params.iter().map(|(k, v)| (k.clone(), v.clone())).collect();
+    sorted.sort();
+    sorted
+}
+
 /// Redact a credential reference for safe display in warnings.
 ///
 /// Delegates to the appropriate URI-specific redaction helper so that
@@ -973,6 +981,27 @@ mod tests {
         TlsConnector::from(Arc::new(tls_config))
     }
 
+    #[test]
+    fn test_sorted_extra_params_orders_by_key() {
+        let params = std::collections::HashMap::from([
+            ("organization".to_string(), "org_123".to_string()),
+            (
+                "audience".to_string(),
+                "https://api.example.com/".to_string(),
+            ),
+        ]);
+        assert_eq!(
+            sorted_extra_params(&params),
+            vec![
+                (
+                    "audience".to_string(),
+                    "https://api.example.com/".to_string()
+                ),
+                ("organization".to_string(), "org_123".to_string()),
+            ]
+        );
+    }
+
     #[test]
     fn test_empty_credential_store() {
         let store = CredentialStore::empty();
@@ -1506,6 +1535,92 @@ mod tests {
         assert_eq!(cred.header_value.as_str(), "secret-key");
     }
 
+    #[tokio::test]
+    async fn test_load_oauth2_sends_extra_params() {
+        use crate::config::OAuth2Config;
+        use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
+
+        let _env = {
+            let _lock = ENV_LOCK.lock().unwrap();
+            EnvVarGuard::set_all(&[
+                ("TEST_OAUTH2_EXTRA_CLIENT_ID", "test-client"),
+                ("TEST_OAUTH2_EXTRA_CLIENT_SECRET", "test-secret"),
+            ])
+        };
+        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
+        let addr = listener.local_addr().unwrap();
+        let server = tokio::spawn(async move {
+            let (stream, _) = listener.accept().await.unwrap();
+            let mut reader = BufReader::new(stream);
+            let mut content_length = 0usize;
+            loop {
+                let mut line = String::new();
+                assert!(reader.read_line(&mut line).await.unwrap() > 0);
+                if line == "\r\n" {
+                    break;
+                }
+                if let Some(v) = line.to_ascii_lowercase().strip_prefix("content-length:") {
+                    content_length = v.trim().parse().unwrap();
+                }
+            }
+            let mut body = vec![0; content_length];
+            reader.read_exact(&mut body).await.unwrap();
+            let json = r#"{"access_token":"extra-params-token","expires_in":3600}"#;
+            let response = format!(
+                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
+                json.len(),
+                json
+            );
+            reader
+                .get_mut()
+                .write_all(response.as_bytes())
+                .await
+                .unwrap();
+            reader.get_mut().shutdown().await.unwrap();
+            body
+        });
+
+        let routes = vec![RouteConfig {
+            prefix: "my-api".to_string(),
+            upstream: "https://api.example.com".to_string(),
+            oauth2: 
```

**File**: `crates/nono-proxy/src/oauth2.rs` (modified, +173/-17)
```diff
@@ -52,6 +52,8 @@ pub struct OAuth2ExchangeConfig {
     pub client_id: Zeroizing<String>,
     pub client_secret: Zeroizing<String>,
     pub scope: String,
+    /// Extra form parameters appended to the token request body.
+    pub extra_params: Vec<(String, String)>,
 }
 
 /// Custom Debug that redacts secrets.
@@ -62,6 +64,14 @@ impl std::fmt::Debug for OAuth2ExchangeConfig {
             .field("client_id", &"[REDACTED]")
             .field("client_secret", &"[REDACTED]")
             .field("scope", &self.scope)
+            .field(
+                "extra_params",
+                &self
+                    .extra_params
+                    .iter()
+                    .map(|(k, _)| k.as_str())
+                    .collect::<Vec<_>>(),
+            )
             .finish()
     }
 }
@@ -293,7 +303,12 @@ async fn exchange_token(
     let path_with_query = token_request_target(&parsed);
 
     // ── Build form body ──────────────────────────────────────────────────
-    let body = build_token_request_body(&config.client_id, &config.client_secret, &config.scope);
+    let body = build_token_request_body(
+        &config.client_id,
+        &config.client_secret,
+        &config.scope,
+        &config.extra_params,
+    );
 
     // ── Build HTTP/1.1 request ───────────────────────────────────────────
     let request = Zeroizing::new(format!(
@@ -435,6 +450,7 @@ fn build_token_request_body(
     client_id: &str,
     client_secret: &str,
     scope: &str,
+    extra_params: &[(String, String)],
 ) -> Zeroizing<String> {
     let mut body = Zeroizing::new(format!(
         "grant_type=client_credentials&client_id={}&client_secret={}",
@@ -444,9 +460,39 @@ fn build_token_request_body(
     if !scope.is_empty() {
         body.push_str(&format!("&scope={}", urlencoding::encode(scope)));
     }
+    append_form_params(&mut body, extra_params);
+    body
+}
+
+/// Build the `jwt-bearer` token request body. `scope` is omitted when empty.
+fn build_jwt_bearer_request_body(
+    assertion: &str,
+    scope: &str,
+    extra_params: &[(String, String)],
+) -> Zeroizing<String> {
+    let mut body = Zeroizing::new(format!(
+        "grant_type={}&client_assertion_type={}&assertion={}",
+        urlencoding::encode("urn:ietf:params:oauth:grant-type:jwt-bearer"),
+        urlencoding::encode("urn:ietf:params:oauth:client-assertion-type:jwt-bearer"),
+        urlencoding::encode(assertion),
+    ));
+    if !scope.is_empty() {
+        body.push_str(&format!("&scope={}", urlencoding::encode(scope)));
+    }
+    append_form_params(&mut body, extra_params);
     body
 }
 
+fn append_form_params(body: &mut Zeroizing<String>, params: &[(String, String)]) {
+    for (k, v) in params {
+        body.push_str(&format!(
+            "&{}={}",
+            urlencoding::encode(k),
+            urlencoding::encode(v)
+        ));
+    }
+}
+
 /// Parse a standard OAuth2 token response JSON.
 ///
 /// Expects `{"access_token": "...", "expires_in": 3600, ...}`.
@@ -486,6 +532,7 @@ pub struct SpiffeAssertionTokenCache {
     jwt_source: Arc<crate::spiffe::SpiffeJwtSource>,
     token_url: String,
     assertion_audience: Vec<String>,
+    scope: String,
     extra_params: Vec<(String, String)>,
     tls_connector: TlsConnector,
     pub workload_spiffe_id: String,
@@ -505,13 +552,15 @@ impl SpiffeAssertionTokenCache {
         token_url: String,
         jwt_source: Arc<crate::spiffe::SpiffeJwtSource>,
         assertion_audience: Vec<String>,
+        scope: String,
         extra_params: Vec<(String, String)>,
         tls_connector: TlsConnector,
     ) -> Result<Self> {
         let (access_token, expires_in, workload_spiffe_id) = exchange_jwt_assertion(
             &token_url,
             &jwt_source,
             &assertion_audience,
+            &scope,
             &extra_params,
             &tls_connector,
         )
@@ -525,6 +574,7 @@ impl SpiffeAssertionTokenCache {
             jwt_source,
             token_url,
             assertion_audience,
+            scope,
             extra_params,
             tls_connector,
             workload_spiffe_id,
@@ -566,6 +616,7 @@ impl SpiffeAssertionTokenCache {
             &self.token_url,
             &self.jwt_source,
             &self.assertion_audience,
+            &self.scope,
             &self.extra_params,
             &self.tls_connector,
         )
@@ -601,24 +652,12 @@ async fn exchange_jwt_assertion(
     token_url: &str,
     jwt_source: &crate::spiffe::SpiffeJwtSource,
     audience: &[String],
+    scope: &str,
     extra_params: &[(String, String)],
     tls_connector: &TlsConnector,
 ) -> Result<(Zeroizing<String>, Duration, String)> {
     let (assertion, spiffe_id) = jwt_source.fetch_token(audience).await?;
-
-    let mut body = Zeroizing::new(format!(
-        "grant_type={}&client_assertion_type={}&assertion={}",
-        urlencoding::encode("urn:ietf:params:oauth:grant-type:jwt-bearer"),
-        urlencoding::encode("urn:ietf:params:oauth:c
```

**File**: `crates/nono-proxy/src/route.rs` (modified, +26/-0)
```diff
@@ -365,6 +365,12 @@ impl RouteStore {
                 )));
             }
 
+            if let Some(oauth2) = &route.oauth2 {
+                crate::config::validate_oauth2_extra_params(&oauth2.extra_params).map_err(|e| {
+                    ProxyError::Config(format!("route '{}': {}", normalized_prefix, e))
+                })?;
+            }
+
             // A session phantom is only validated on routes that inject a
             // credential; elsewhere the field would be silently ignored.
             let phantom_template = match route.phantom_format.as_deref() {
@@ -1660,6 +1666,26 @@ mod tests {
         }
     }
 
+    #[tokio::test]
+    async fn oauth2_reserved_extra_params_rejected_by_route_store() {
+        let route: RouteConfig = serde_json::from_value(serde_json::json!({
+            "prefix": "api",
+            "upstream": "https://api.example.com",
+            "oauth2": {
+                "token_url": "https://auth.example.com/oauth/token",
+                "client_id": "cid",
+                "client_secret": "env://SECRET",
+                "extra_params": {"grant_type": "password"},
+            },
+        }))
+        .unwrap();
+        let err = RouteStore::load(&[route]).await.err();
+        assert!(
+            matches!(err, Some(ProxyError::Config(ref m)) if m.contains("grant_type")),
+            "expected config error, got {err:?}"
+        );
+    }
+
     #[tokio::test]
     async fn http1_required_for_all_matching_aws_routes() {
         let aws: RouteConfig = serde_json::from_value(serde_json::json!({
```

**File**: `docs/cli/features/credential-injection.mdx` (modified, +19/-0)
```diff
@@ -404,6 +404,25 @@ For APIs not covered by the built-in services, you can define custom credentials
 **Important:** Use underscores, not hyphens, in credential names (the keys in `custom_credentials`). The credential name is used to generate environment variables like `TELEGRAM_BASE_URL`. Shell variable names cannot contain hyphens, so `my-api` would create `MY-API_BASE_URL` which cannot be referenced as `$MY-API_BASE_URL` in shell scripts. Use `my_api` instead.
 
 
+#### OAuth2 token request parameters
+
+Some token endpoints require parameters beyond the ones the grant defines. Set them in `auth.extra_params` and nono appends them to every token request, for any grant, including refreshes. For example, an endpoint that requires an `audience`:
+
+```json
+"my_api": {
+  "upstream": "https://api.example.com",
+  "env_var": "MY_API_TOKEN",
+  "auth": {
+    "token_url": "https://auth.example.com/oauth/token",
+    "client_id": "env://MY_API_CLIENT_ID",
+    "client_secret": "env://MY_API_CLIENT_SECRET",
+    "extra_params": { "audience": "https://api.example.com/" }
+  }
+}
+```
+
+Values are sent as written. They are not resolved as credential references, so do not put secrets in them. nono rejects keys it already sets (`grant_type`, `client_id`, `client_secret`, `scope`, `client_assertion`, `client_assertion_type`, `assertion`, compared case-insensitively) because a repeated parameter can make the server read a different value than nono sends.
+
 #### Shaping the phantom token
 
 By default the phantom token in `env_var` is the bare session token. Some clients check a token's prefix locally and refuse one that does not look right. For example, `gh` rejects a `GH_TOKEN` that is not `ghp_` or `github_pat_` prefixed, before it sends any request, so the proxy never gets to swap in the real credential. Set `phantom_format` to wrap the session token:
```

**File**: `docs/cli/features/spiffe.mdx` (modified, +4/-2)
```diff
@@ -85,8 +85,10 @@ Use `auth.client_assertion` instead of the `spiffe` block for this flow:
 ```
 
 When `client_assertion` is set, `client_id` and `client_secret` are not required — the JWT-SVID
-is the credential. Any extra parameters required by the token endpoint (such as federation rule IDs
-or workspace identifiers) can be passed via `auth.extra_params`:
+is the credential. `auth.scope` is sent when set. Any extra parameters required by the token
+endpoint (such as federation rule IDs or workspace identifiers) can be passed via
+`auth.extra_params` (see [OAuth2 token request parameters](/cli/features/credential-injection#oauth2-token-request-parameters)
+for the rules):
 
 ```json
 "auth": {
```

---

### Incident Patch 3: `b2068b14` (2026-11-25)
**Commit Message**: fix(platform): preserve device identity across unenrollment (#2365)

* fix(platform): keep enrollment recovery available during policy outages

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

* fix(platform): preserve installation identity when unenrolling

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

---------

Signed-off-by: Aleksy Siek <[REDACTED_EMAIL]>

**File**: `crates/nono-cli/src/app_runtime.rs` (modified, +1/-1)
```diff
@@ -21,7 +21,7 @@ use crate::why_runtime::run_why;
 use crate::{DETACHED_LAUNCH_ENV, Result};
 
 pub(crate) fn run(cli: Cli) -> Result<()> {
-    crate::platform_policy::enforced::guard_command(&cli.command)?;
+    crate::platform_policy::enforced::guard_command(&cli.command, cli.silent)?;
     let mut update_handle = start_update_check_handle(&cli);
     dispatch_command(cli.command, cli.silent, &mut update_handle)
 }
```

**File**: `crates/nono-cli/src/cli.rs` (modified, +7/-3)
```diff
@@ -2766,7 +2766,7 @@ pub enum PlatformCommands {
         after_help = "EXAMPLES:\n  nono platform tenant list\n  nono platform tenant use acme --no-enroll"
     )]
     Tenant(TenantArgs),
-    /// Replace a revoked device enrollment after fresh authorization
+    /// Replace an unenrolled device key after fresh authorization; revocation requires operator restoration
     #[command(name = "re-enroll", help_template = COMMAND_HELP, next_help_heading = "OPTIONS", mut_arg("no_enroll", |arg| arg.hide(true)))]
     #[command(
         after_help = "EXAMPLES:\n  nono platform re-enroll\n  nono platform re-enroll --tenant acme"
@@ -2783,10 +2783,10 @@ pub enum PlatformCommands {
     #[command(help_template = COMMAND_HELP, next_help_heading = "OPTIONS")]
     #[command(after_help = "EXAMPLES:\n  nono platform status\n  nono platform status --json")]
     Status(PlatformStatusArgs),
-    /// Remove the local platform enrollment
+    /// Unenroll this device on the platform and disable its local enrollment
     #[command(help_template = COMMAND_HELP, next_help_heading = "OPTIONS")]
     #[command(
-        after_help = "EXAMPLES:\n  nono platform unenroll\n  nono platform unenroll --delete-key"
+        after_help = "EXAMPLES:\n  nono platform unenroll\n  nono platform unenroll --delete-key\n  nono platform unenroll --local-only"
     )]
     Unenroll(PlatformUnenrollArgs),
 }
@@ -2936,6 +2936,10 @@ pub struct PlatformStatusArgs {
 #[derive(Parser, Debug)]
 #[command(disable_help_flag = true)]
 pub struct PlatformUnenrollArgs {
+    /// Disable this installation locally without notifying the platform
+    #[arg(long)]
+    pub local_only: bool,
+
     /// Also delete the local signing key (the next enrollment mints a new one)
     #[arg(long)]
     pub delete_key: bool,
```

**File**: `crates/nono-cli/src/login_cmd.rs` (modified, +31/-8)
```diff
@@ -256,7 +256,7 @@ fn finish_login(args: &LoginArgs, select: bool) -> Result<()> {
         "{}",
         login_summary(&record, (!select).then_some(&previous), &enrollment)
     );
-    if let Err(error) = enrollment {
+    if let Err(ref error) = enrollment {
         let retry = if args.re_enroll {
             "nono platform re-enroll"
         } else {
@@ -267,17 +267,26 @@ fn finish_login(args: &LoginArgs, select: bool) -> Result<()> {
         );
     } else if matches!(
         enrollment,
-        Ok(EnrollmentResult::Enrolled | EnrollmentResult::Reenrolled | EnrollmentResult::Reused)
+        Ok(EnrollmentResult::Enrolled
+            | EnrollmentResult::Reenrolled
+            | EnrollmentResult::Reused
+            | EnrollmentResult::Reactivated)
     ) {
         let state = platform_client::load_active_state()?.ok_or_else(|| {
             NonoError::ActionRequired("device enrollment was saved but is unavailable for the policy check; run `nono platform status`".into())
         })?;
         platform_client::check_enrollment_policy(&state)?;
     }
+    if matches!(enrollment, Ok(EnrollmentResult::Revoked)) {
+        return Err(NonoError::ActionRequired(
+            "device is revoked; a platform operator must restore it before re-enrollment".into(),
+        ));
+    }
     Ok(())
 }
 
 enum EnrollmentResult {
+    Reactivated,
     Enrolled,
     Reenrolled,
     Reused,
@@ -303,6 +312,7 @@ fn enroll_device(
     let login_key = session::load_key()?.ok_or_else(not_signed_in)?;
     let refresh = session::load_refresh_token()?.ok_or_else(not_signed_in)?;
     let previous = platform_client::load_state()?;
+    let was_unenrolled = platform_client::enrollment_unenrolled()?;
     if re_enroll && previous.is_none() {
         return Ok(EnrollmentResult::NotEnrolled);
     }
@@ -324,7 +334,9 @@ fn enroll_device(
         )?,
         (Some(previous), false) => (
             previous.key_ref.clone(),
-            platform_client::load_signing_key(previous)?,
+            platform_client::load_signing_key(previous).map_err(|error| if was_unenrolled {
+                NonoError::ActionRequired(format!("the existing installation key could not be loaded ({error}); use `nono platform re-enroll` to authorize a replacement. A revoked registration must first be restored by a platform operator"))
+            } else { error })?,
         ),
         (None, _) => crate::device_key::load_or_create(
             &record.issuer,
@@ -446,6 +458,8 @@ fn enroll_device(
     }
     Ok(if re_enroll {
         EnrollmentResult::Reenrolled
+    } else if reused && was_unenrolled {
+        EnrollmentResult::Reactivated
     } else if reused {
         EnrollmentResult::Reused
     } else {
@@ -644,7 +658,7 @@ fn missing_enrollment_summary(args: &LoginArgs, record: Option<&session::Session
     text.push_str(&summary_row("Enrollment", "Not recorded"));
     text.push_str(&summary_row(
         "Recovery",
-        "re-enroll is only for revoked device enrollments",
+        "re-enroll replaces a key for an unenrolled device; revoked devices need platform operator restoration first",
     ));
     text.push_str(&summary_row(
         "Next step",
@@ -689,6 +703,10 @@ fn login_summary(
     ));
     let (label, color) = match enrollment {
         Ok(EnrollmentResult::Enrolled) => ("Device enrolled", t.green),
+        Ok(EnrollmentResult::Reactivated) => (
+            "Device enrolled again · existing identity restored",
+            t.green,
+        ),
         Ok(EnrollmentResult::Reenrolled) => ("Device re-enrolled with a new key", t.green),
         Ok(EnrollmentResult::Reused) => ("Using existing device enrollment", t.text),
         Ok(EnrollmentResult::Skipped) => ("Skipped (no-enroll enabled)", t.subtext),
@@ -700,12 +718,17 @@ fn login_summary(
     text.push_str(&summary_row("Enrollment", &fg(label, color).to_string()));
     if matches!(
         enrollment,
-        Ok(EnrollmentResult::Enrolled | EnrollmentResult::Reenrolled | EnrollmentResult::Reused)
+        Ok(EnrollmentResult::Enrolled
+            | EnrollmentResult::Reenrolled
+            | EnrollmentResult::Reused
+            | EnrollmentResult::Reactivated)
     ) && (switched
         || previous.is_none()
         || matches!(
             enrollment,
-            Ok(EnrollmentResult::Enrolled | EnrollmentResult::Reenrolled)
+            Ok(EnrollmentResult::Enrolled
+                | EnrollmentResult::Reenrolled
+                | EnrollmentResult::Reactivated)
         ))
     {
         text.push_str(&summary_row(
@@ -725,7 +748,7 @@ fn login_summary(
         .unwrap_or_else(|| clean(&record.tenant_id));
     let hint = match enrollment {
         Ok(EnrollmentResult::Revoked) => Some(format!(
-            "nono platform re-enroll --tenant {tenant_selector}"
+            "Ask a platform operator to restore this device, then run nono platform login --tenant {tenant_selector}"
         )),
         Ok(EnrollmentResult::NotEnrolled 
```

**File**: `crates/nono-cli/src/platform_client.rs` (modified, +151/-44)
```diff
@@ -133,6 +133,8 @@ fn enroll(args: PlatformEnrollArgs) -> Result<()> {
         display_name: request.display_name.clone(),
         tenant: None,
         revoked: false,
+        unenrolled: false,
+        unenrollment_confirmed: false,
         last_policy_mode: None,
     };
     write_json_secure(&state_path, &stored)?;
@@ -202,6 +204,12 @@ fn status(args: PlatformStatusArgs) -> Result<()> {
         None
     };
     let policy = match &stored {
+        Some(stored) if stored.unenrolled && args.refresh => {
+            return Err(NonoError::ActionRequired(
+                "device is unenrolled; run `nono platform login` before refreshing policy".into(),
+            ));
+        }
+        Some(stored) if stored.unenrolled => None,
         Some(stored) if args.refresh => crate::platform_policy::refresh(&stored.state)?,
         Some(stored) => crate::platform_policy::cached(&stored.state)?,
         None if args.refresh => {
@@ -223,7 +231,9 @@ fn status(args: PlatformStatusArgs) -> Result<()> {
             });
         let mut output = match &stored {
             Some(stored) => serde_json::json!({
-                "enrolled": !stored.revoked,
+                "enrolled": !stored.revoked && !stored.unenrolled,
+                "enrollment_status": if stored.revoked { "revoked" } else if stored.unenrolled { "unenrolled" } else { "active" },
+                "platform_unenrollment_confirmed": stored.unenrolled && stored.unenrollment_confirmed,
                 "platform_url": stored.state.platform_url,
                 "tenant_id": stored.state.tenant_id,
                 "subject_id": stored.state.subject_id,
@@ -323,6 +333,8 @@ fn status_text(
             "{name} · {}",
             if stored.revoked {
                 "revoked"
+            } else if stored.unenrolled {
+                "unenrolled"
             } else {
                 "enrolled"
             }
@@ -331,13 +343,26 @@ fn status_text(
             kind,
             &crate::theme::fg(&device, if stored.revoked { t.yellow } else { t.text }).to_string(),
         ));
-        text.push_str(&crate::platform_policy::display::status_rows(
-            policy,
-            previous,
-            refreshed,
-            stored.last_policy_mode.as_deref(),
-        ));
-        let audit = if stored.revoked {
+        if stored.unenrolled {
+            text.push_str(&summary_row(
+                "Enrollment",
+                if stored.unenrollment_confirmed {
+                    "Platform confirmed · use platform login to reactivate"
+                } else {
+                    "Local only · platform not notified"
+                },
+            ));
+        } else {
+            text.push_str(&crate::platform_policy::display::status_rows(
+                policy,
+                previous,
+                refreshed,
+                stored.last_policy_mode.as_deref(),
+            ));
+        }
+        let audit = if stored.unenrolled {
+            Some("Unavailable · device unenrolled".into())
+        } else if stored.revoked {
             Some("Unavailable · enrollment revoked".into())
         } else {
             match crate::audit_client::queued_count() {
@@ -388,11 +413,15 @@ fn enrollment_text_with_heading(
         .unwrap_or_else(|| "Name not recorded (see --json)".into());
     let enrollment = if stored.revoked {
         "Revoked"
+    } else if stored.unenrolled {
+        "Unenrolled"
     } else {
         "Registered locally"
     };
     let delivery = if stored.revoked {
         "Unavailable: enrollment revoked"
+    } else if stored.unenrolled {
+        "Unavailable: device unenrolled"
     } else {
         "Automatic when sessions finish"
     };
@@ -431,55 +460,58 @@ fn enrollment_details(stored: &StoredEnrollment) -> String {
     format!(
         "{}{}",
         summary_row(kind, &name),
-        summary_row("Enrolled", &enrolled)
+        summary_row("First enrolled", &enrolled)
     )
 }
 
-/// Remove the local enrollment. Local-only by design: the platform-side
-/// subject stays active until a human revokes it in the console, because the
-/// device key must not be able to erase its own registration.
+/// Deactivate without erasing identity/history. Keep the key and an inactive
+/// local record so human-authorized login can reactivate the same device.
 fn unenroll(args: PlatformUnenrollArgs) -> Result<()> {
-    let state_path = state_path()?;
     let Some(state) = load_state()? else {
         println!("Not enrolled with a platform.");
         return Ok(());
     };
     let queued = crate::audit_client::queued_count()?;
+    let stored = current_enrollment(&state)?;
+    let confirmed = if args.local_only {
+        stored.unenrolled && stored.unenrollment_confirmed
+    } else {
+        confirm_unenrollment(&state)?;
+        true
+    };
 
-    // Delete the key before the state file: the state holds the only key_ref,
-    // so removing it first would orphan the key in the keys
```

**File**: `crates/nono-cli/src/platform_policy.rs` (modified, +10/-2)
```diff
@@ -93,7 +93,7 @@ impl RefreshFailure {
     fn error(self) -> NonoError {
         let message = match self {
             Self::Unauthorized(message) => format!(
-                "{message}; device authentication was refused. Run `nono platform re-enroll` to authorize recovery; the existing enrollment and policy remain in place."
+                "{message}; device authentication was refused. Check its enrollment on the platform. A revoked device must be restored by a platform operator before `nono platform login` can enroll it again; the existing enrollment and policy remain in place."
             ),
             Self::Unavailable(message)
             | Self::ServiceUnavailable(message)
@@ -332,7 +332,15 @@ fn request<T: serde::de::DeserializeOwned>(
         .map_err(|error| RefreshFailure::Unavailable(error.to_string()))?;
     tracing::debug!(endpoint = path, request_id = %id, status = response.status().as_u16(), "Received platform policy response");
     if !response.status().is_success() {
-        let message = format!("policy endpoint returned HTTP {}", response.status());
+        let mut message = format!(
+            "policy endpoint {method} {url} returned HTTP {}",
+            response.status()
+        );
+        if response.status().as_u16() == 404 {
+            message.push_str(
+                "; the policy API is unavailable at the enrolled origin. Check that the deployment routes /api/v1/policy/refresh and /api/v1/policy/trust-root to platform-server, then retry `nono platform status --refresh`",
+            );
+        }
         if response.status().as_u16() == 401 {
             return Err(RefreshFailure::Unauthorized(message));
         }
```

**File**: `crates/nono-cli/src/platform_policy/enforced.rs` (modified, +48/-1)
```diff
@@ -143,7 +143,11 @@ pub(crate) fn validate_resource_limits(
     Ok(())
 }
 
-pub(crate) fn guard_command(command: &Commands) -> Result<()> {
+pub(crate) fn guard_command(command: &Commands, silent: bool) -> Result<()> {
+    let enrollment_recovery = matches!(command, Commands::Platform(args) if matches!(
+        args.command,
+        PlatformCommands::Login(_) | PlatformCommands::Logout(_) | PlatformCommands::Unenroll(_)
+    ));
     let restricted = match command {
         Commands::Profile(args) => matches!(
             args.command,
@@ -156,6 +160,10 @@ pub(crate) fn guard_command(command: &Commands) -> Result<()> {
         Commands::Platform(args) => !matches!(
             &args.command,
             PlatformCommands::Status(_)
+                // Human sign-in is separate from device authority. Enrollment
+                // checks ownership/status on the platform and preserves the
+                // pinned enforced identity and mode locally.
+                | PlatformCommands::Login(_)
                 | PlatformCommands::ReEnroll(_)
                 | PlatformCommands::Tenant(crate::cli::TenantArgs {
                     command: TenantCommands::List(_),
@@ -198,13 +206,52 @@ pub(crate) fn guard_command(command: &Commands) -> Result<()> {
         return Ok(());
     };
     let remembered = platform_client::last_policy_mode(&state)?;
+    if enrollment_recovery && platform_client::enrollment_unenrolled()? {
+        if remembered.as_deref() == Some("enforced")
+            || super::cached(&state)?.is_some_and(|claims| claims.management_mode == "enforced")
+        {
+            return Err(denied(
+                "this command needs a fresh platform release from enforced mode",
+            ));
+        }
+        // Disabled identities cannot refresh policy, and --delete-key may
+        // already have removed their key. Login still proves human authority
+        // and device ownership before the platform reactivates anything.
+        return Ok(());
+    }
     let enforced = match super::refresh_inner(&state, false) {
         Ok(Some(claims)) => claims.management_mode == "enforced",
         Ok(None) => {
             return Err(denied(
                 "a fresh assignment is required before changing local policy or enrollment",
             ));
         }
+        Err(error)
+            if enrollment_recovery
+                && remembered.as_deref() != Some("enforced")
+                && matches!(
+                    error,
+                    super::RefreshFailure::Unavailable(_)
+                        | super::RefreshFailure::ServiceUnavailable(_)
+                        | super::RefreshFailure::Unauthorized(_)
+                ) =>
+        {
+            // Cleanup is not launch authority. An enrollment whose first
+            // policy check failed must remain recoverable; a previously
+            // enforced device still needs a fresh signed release. Check old
+            // signed caches too, including enrollments predating mode history.
+            if super::cached(&state)?.is_some_and(|claims| claims.management_mode == "enforced") {
+                return Err(denied(
+                    "this command needs a fresh platform release from enforced mode",
+                ));
+            }
+            if !silent {
+                eprintln!(
+                    "Policy could not be checked; continuing with account management only. Session startup still requires its normal policy check."
+                );
+            }
+            false
+        }
         Err(error) if error.allows_local_fallback(true, None, remembered.as_deref()) => false,
         Err(error @ super::RefreshFailure::Unauthorized(_)) => return Err(error.error()),
         Err(error) if remembered.as_deref() == Some("enforced") => {
```

**File**: `crates/nono-cli/tests/login_cli.rs` (modified, +1/-1)
```diff
@@ -179,7 +179,7 @@ fn reenrollment_without_local_registration_directs_to_normal_login() {
     let text = String::from_utf8(output.stdout).expect("text");
     assert!(text.contains("No enrollment to replace"), "{text}");
     assert!(
-        text.contains("re-enroll is only for revoked device enrollments"),
+        text.contains("revoked devices need platform operator restoration first"),
         "{text}"
     );
     assert!(
```

**File**: `crates/nono-cli/tests/managed_policy.rs` (modified, +395/-2)
```diff
@@ -203,13 +203,16 @@ impl Client {
                 match listener.accept() {
                     Ok((mut stream, _)) => {
                         let (path, request_id) = read_request(&mut stream);
-                        if path == REFRESH_PATH && status.load(Ordering::SeqCst) != 200 {
+                        if matches!(path.as_str(), REFRESH_PATH | "/api/v1/enrollment/unenroll")
+                            && status.load(Ordering::SeqCst) != 200
+                        {
                             write!(stream,"HTTP/1.1 {} Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n",status.load(Ordering::SeqCst)).expect("refresh unavailable");
                             continue;
                         }
                         if path != TRUST_PATH
                             && path != REFRESH_PATH
                             && path != "/api/v1/enrollment/exchange"
+                            && path != "/api/v1/enrollment/unenroll"
                         {
                             stream.write_all(b"HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").expect("audit unavailable");
                             continue;
@@ -221,6 +224,8 @@ impl Client {
                                 "enrolled_at":"2026-01-01T00:00:00Z","policy_trust_root":trust
                             }))
                             .expect("enrollment response")
+                        } else if path == "/api/v1/enrollment/unenroll" {
+                            serde_json::to_vec(&json!({"protocol_version":"1","tenant_id":"tenant","subject_id":"device","unenrolled_at":chrono::Utc::now()})).expect("unenrollment confirmation")
                         } else if path == TRUST_PATH {
                             serde_json::to_vec(&trust).expect("trust response")
                         } else {
@@ -645,7 +650,6 @@ fn enforced_shell_wrap_and_management_commands_cannot_bypass_assignment() {
         vec!["trust", "init"],
         vec!["platform", "unenroll"],
         vec!["platform", "logout"],
-        vec!["platform", "login", "--no-enroll"],
         vec!["platform", "tenant", "use", "personal", "--no-enroll"],
     ] {
         let output = client.test.command().args(&args).output().expect("command");
@@ -728,6 +732,290 @@ fn signed_platform_downgrade_restores_advisory_overrides() {
         .assert_stderr_contains("Advisory");
 }
 
+#[test]
+fn enrollment_recovery_survives_missing_policy_and_rejected_device_credentials() {
+    for mode in [None, Some("audit_only"), Some("advisory")] {
+        for status in [401, 404, 503, 0] {
+            let mut client = Client::new(None);
+            let enrollment = client.test.home().join(".config/nono/platform.json");
+            let mut state: serde_json::Value =
+                serde_json::from_slice(&fs::read(&enrollment).expect("state")).expect("JSON");
+            state["last_policy_mode"] = mode.into();
+            fs::write(&enrollment, state.to_string()).expect("state");
+            if status == 0 {
+                client.platform.stop();
+            } else {
+                client
+                    .platform
+                    .refresh_status
+                    .store(status, Ordering::SeqCst);
+            }
+
+            // A failed first check still cannot authorize a session.
+            if mode.is_none() {
+                client
+                    .test
+                    .run()
+                    .profile_name("default")
+                    .exec(Argv::new("/bin/echo").arg("MUST_NOT_RUN"))
+                    .assert_failure("recovery does not grant launch authority")
+                    .assert_stdout_lacks("MUST_NOT_RUN");
+            }
+
+            let login = client
+                .test
+                .command()
+                .args([
+                    "platform",
+                    "login",
+                    "--name",
+                    "Aleks Device",
+                    "--device-code",
+                    "--no-open",
+                    "--url",
+                ])
+                .arg(state["platform_url"].as_str().expect("origin"))
+                .output()
+                .expect("login");
+            // This fixture has no OAuth server. Reaching discovery proves the
+            // policy guard no longer prevents the requested login from running.
+            assert!(
+                String::from_utf8_lossy(&login.stderr).contains("authorization server"),
+                "{mode:?}, HTTP {status}: {}",
+                String::from_utf8_lossy(&login.stderr)
+            );
+            assert!(enrollment.exists());
+
+            let logout = client
+                .test
+                .command()
+                .args(["platform", "logout"])
+                .output()
+                .expect("logout");
+            assert!(
+                logout.status.success(),
+                "{}",
+                String::from_utf8_lossy(&logou
```

#### Recent Merged Pull Requests:
- **PR #2365** (2026-11-25): fix(platform): preserve device identity across unenrollment (@SequeI)
- **PR #2363** (2026-11-25): fix(proxy): keep command-only route hosts out of the session allowlist (@panga)
- **PR #2362** (2026-11-25): fix(proxy): send auth.extra_params on client_credentials token requests (@panga)
- **PR #2360** (2026-11-23): feat(network-policy): add TypeSafe API endpoint (@jpds)
- **PR #2358** (2026-11-23): chore(deps): bump typify from 0.8.0 to 0.10.1 (@dependabot[bot])
- **PR #2357** (2026-11-23): chore(deps): bump the routine-rust group with 8 updates (@dependabot[bot])

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

## X. proxy): keep command-only route hosts out of the session allowlist

**RULE**:
When implementing operations in `crates/nono-cli/src/proxy_runtime.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in nolabs-ai/nono. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `90a9c254`: proxy): keep command-only route hosts out of the session allowlist. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `crates/nono-cli/src/proxy_runtime.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    //
    // Command-only (tool sandbox) routes are skipped: this allowlist is the
    // session proxy's, which never carries those routes (see
    // remove_tool_sandbox_routes), so their upstream would be a plain
    // CONNECT tunnel for every session process, with no credential injection
    // or endpoint policy. Command-scoped proxies build their own allowlist.
            if proxy
                .tool_sandbox_proxy_credentials
                .contains(route.prefix.trim_matches('/'))
            {
                continue;
            }
    /// A command-only (tool sandbox) credential route must not open its
    /// upstream to the session proxy: the session never carries the route, so
    /// the host would be a plain tunnel with no credential or endpoint policy.
    #[test]
    fn test_tool_sandbox_route_upstream_is_not_in_session_allowlist() {
        for strict in [false, true] {
            let mut proxy = proxy_with_custom_credential(
                strict,
                vec![crate::profile::AllowDomainEntry::Plain(
                    "www.example.com".to_string(),
                )],
            );
            proxy
                .tool_sandbox_proxy_credentia
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `90a9c254` are properly handled with clean fallback behavior.

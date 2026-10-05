# Forensic Learning Record (Deep Inspection): flox/flox

> **Canonical Artifact**: `07_PROJECT_LEARNING/flox-flox-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/flox/flox](https://github.com/flox/flox))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:56:26.340Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `flox/flox`
- **Description**: The Deterministic Foundation for your SDLC
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4151 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `cli/catalog-api-v1/src/hooks.rs`
```
use std::sync::Arc;
use std::time::Duration;

use chrono::{DateTime, Utc};
use progenitor_client::{ClientHooks, ClientInfo, Error, OperationInfo};
use reqwest::StatusCode;
use reqwest::header::RETRY_AFTER;
use tracing::warn;

const MAX_SERVICE_UNAVAILABLE_RETRIES: usize = 2;
const DEFAULT_SERVICE_UNAVAILABLE_RETRY_DELAY: Duration = Duration::from_secs(2);

fn parse_retry_after(value: &str, now: DateTime<Utc>) -> Option<Duration> {
    if let Ok(seconds) = value.parse::<u64>() {
        return Some(Duration::from_secs(seconds));
    }

    let Ok(retry_at) = DateTime::parse_from_rfc2822(value) else {
        return None;
    };
    Some(
        retry_at
            .with_timezone(&Utc)
            .signed_duration_since(now)
            .to_std()
            .unwrap_or_default(),
    )
}

fn retry_after_delay(response: &reqwest::Response) -> Duration {
    let Some(value) = response.headers().get(RETRY_AFTER) else {
        return DEFAULT_SERVICE_UNAVAILABLE_RETRY_DELAY;
    };
    let Ok(value) = value.to_str() else {
        warn!(
            retry_after = ?value,
            "Retry-After header is not valid text; using the default retry delay"
        );
        return DEFAULT_SERVICE_UNAVAILABLE_RETRY_DELAY;
    };
    parse_retry_after(value, Utc::now()).unwrap_or_else(|| {
        warn!(
            retry_after = value,
            "Could not parse Retry-After header; using the default retry delay"
        );
        DEFAULT_SERVICE_UNAVAILABLE_RETRY_DELAY
    })
}

/// Per-instance request hooks embedded in the generated `Client` via
/// `with_inner_type`.
///
/// This replaces the former global `Mutex<Option<Hook>>` in
/// `pre_request_hook.rs`, giving each `Client` instance its own hook without
/// shared mutable state.
///
/// # Error handling
///
/// The `pre_request` hook is infallible by design: errors (e.g. a failed
/// Kerberos token acquisition) are silently swallowed and the request proceeds
/// without the auth header. This means auth failures will surface as HTTP 401
/// responses rather than client-side errors. Keep this in mind when debugging
/// authentication issues.
pub struct RequestHooks {
    pub pre_request: Arc<dyn Fn(&mut reqwest::Request) + Send + Sync>,
}

impl Clone for RequestHooks {
    fn clone(&self) -> Self {
        Self {
            pre_request: Arc::clone(&self.pre_request),
        }
    }
}

impl std::fmt::Debug for RequestHooks {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RequestHooks")
            .field("pre_request", &"<closure>")
            .finish()
    }
}

impl Default for RequestHooks {
    fn default() -> Self {
        Self {
            pre_request: Arc::new(|_| {}),
        }
    }
}

impl ClientHooks<RequestHooks> for crate::Client {
    async fn pre<E>(
        &self,
        request: &mut reqwest::Request,
        _info: &OperationInfo,
    ) -> Result<(), Error<E>> {
        (self.inner.pre_request)(request);
        Ok(())
    }

    async fn exec(
        &self,
        request: reqwest::Request,
        _info: &OperationInfo,
    ) -> reqwest::Result<reqwest::Response> {
        let mut request = request;
        for attempt in 0..=MAX_SERVICE_UNAVAILABLE_RETRIES {
            let retry_request = request.try_clone();
            let response = self.client().execute(request).await?;
            if response.status() != StatusCode::SERVICE_UNAVAILABLE
                || attempt == MAX_SERVICE_UNAVAILABLE_RETRIES
            {
                return Ok(response);
            }

            let Some(next_request) = retry_request else {
                return Ok(response);
            };
            tokio::time::sleep(retry_after_delay(&response)).await;
            request = next_request;
        }

        unreachable!("retry loop always returns on its final attempt")
    }
}

#[cfg(test)]
mod tests {
    use chrono::TimeZone;

    use super::*;

    #[test]
    fn retry_after_parses_seconds() {
        let now = Utc.with_ymd_and_hms(2026, 9, 4, 12, 0, 0).unwrap();

        assert_eq!(
            parse_retry_after("12", now),
            Some(Duration::from_secs(12))
        );
    }

    #[test]
    fn retry_after_parses_http_date() {
        let now = Utc.with_ymd_and_hms(2026, 9, 4, 12, 0, 0).unwrap();

        assert_eq!(
            parse_retry_after("Fri, 04 Sep 2026 12:00:12 GMT", now),
            Some(Duration::from_secs(12))
        );
    }

    #[test]
    fn retry_after_distinguishes_past_dates_from_invalid_values() {
        let now = Utc.with_ymd_and_hms(2026, 9, 4, 12, 0, 0).unwrap();

        assert_eq!(
            (
                parse_retry_after("Fri, 04 Sep 2026 11:59:59 GMT", now),
                parse_retry_after("not a delay", now),
            ),
            (Some(Duration::ZERO), None)
        );
    }
}

```

### Core Architecture Module: `cli/factory-api-v1/src/hooks.rs`
```
use std::sync::Arc;

use progenitor_client::{ClientHooks, Error, OperationInfo};

/// Per-instance request hooks embedded in the generated `Client` via
/// `with_inner_type`. Each `Client` instance owns its own hook without
/// shared mutable state.
///
/// # Error handling
///
/// The `pre_request` hook is infallible by design: errors (e.g. a failed
/// Kerberos token acquisition) are silently swallowed and the request proceeds
/// without the auth header. This means auth failures will surface as HTTP 401
/// responses rather than client-side errors. Keep this in mind when debugging
/// authentication issues.
pub struct RequestHooks {
    pub pre_request: Arc<dyn Fn(&mut reqwest::Request) + Send + Sync>,
}

impl Clone for RequestHooks {
    fn clone(&self) -> Self {
        Self {
            pre_request: Arc::clone(&self.pre_request),
        }
    }
}

impl std::fmt::Debug for RequestHooks {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("RequestHooks")
            .field("pre_request", &"<closure>")
            .finish()
    }
}

impl Default for RequestHooks {
    fn default() -> Self {
        Self {
            pre_request: Arc::new(|_| {}),
        }
    }
}

impl ClientHooks<RequestHooks> for crate::Client {
    async fn pre<E>(
        &self,
        request: &mut reqwest::Request,
        _info: &OperationInfo,
    ) -> Result<(), Error<E>> {
        (self.inner.pre_request)(request);
        Ok(())
    }
}

```

### Core Architecture Module: `cli/flox-activations/src/hook.rs`
```
//! Shell-specific hook registration code for auto-activation.
//!
//! The generated code registers a prompt hook that calls `flox hook-env`
//! on every prompt, matching the behavior of direnv. The hook only
//! fires in interactive shells (via PROMPT_COMMAND, precmd, fish_prompt),
//! so it naturally does not trigger in non-interactive (e.g. `bash -c`) contexts.
//!
//! Each hook passes the interactive shell's PID (`$$` / `$fish_pid`) so
//! `hook-env` can find this shell's prompt-hook action file, plus the shell's
//! `_FLOX_INVOCATION_TYPES` map so `hook-env` knows which of the layers it
//! pops were activated by this shell — and with which invocation type.
//! `_FLOX_INVOCATION_TYPES` is a shell-local JSON array with one entry per
//! activation performed by this shell, keyed by environment pointer; each
//! activation's startup script records an entry (see `gen_rc`), and the
//! deactivation emitters (`hook-env`, `flox deactivate --print-script`)
//! receive the map, take the entry for each layer they deactivate, and write
//! back the remainder as a plain variable update. Because it is not
//! exported, a subshell — which inherits the activation's exported
//! environment without ever attaching to the activation — has an empty
//! map, and that is how `hook-env` knows not to emit a
//! `flox-activations detach` for layers this shell never attached to.
//!
//! Each hook also exports [`PROMPT_HOOK_VERSION_ENV`] =
//! `<version>:true` at registration time (top level, so it is set before the
//! first prompt); subshell activations export `<version>:false` instead (see
//! `gen_rc`). It is exported, unlike `_FLOX_INVOCATION_TYPES`, so a
//! subprocess such as `flox deactivate` can confirm a compatible hook is set
//! up before writing an action file the hook would otherwise never consume.

use flox_core::activate::vars::{FLOX_INVOCATION_TYPES_VAR, FLOX_INVOCATION_TYPES_WIRE_VAR};
use flox_core::hook_actions::{PROMPT_HOOK_VERSION_ENV, prompt_hook_marker_value};
use indoc::formatdoc;

pub fn bash_hook(flox_bin: &str) -> String {
    let marker = prompt_hook_marker_value(true);
    formatdoc!(
        r#"
        export {PROMPT_HOOK_VERSION_ENV}={marker};
        _flox_hook() {{
          local _prev_exit=$?;
          local _flox_vars;
          _flox_vars="$("{flox_bin}" hook-env --shell bash --shell-pid $$ --invocation-types "${{{FLOX_INVOCATION_TYPES_VAR}:-}}")";
          trap -- '' SIGINT;
          eval "$_flox_vars";
          trap - SIGINT;
          return $_prev_exit;
        }};
        if [[ ";${{PROMPT_COMMAND[*]:-}};" != *";_flox_hook;"* ]]; then
          if [[ "$(declare -p PROMPT_COMMAND 2>&1)" == "declare -a"* ]]; then
            PROMPT_COMMAND=(_flox_hook "${{PROMPT_COMMAND[@]}}");
          else
            PROMPT_COMMAND="_flox_hook${{PROMPT_COMMAND:+;$PROMPT_COMMAND}}";
          fi;
        fi;
        "#
    )
}

// Unlike bash, zsh restores $? before calling each precmd function
// independently, so we don't need to save/restore it ourselves.
pub fn zsh_hook(flox_bin: &str) -> String {
    let marker = prompt_hook_marker_value(true);
    formatdoc!(
        r#"
        export {PROMPT_HOOK_VERSION_ENV}={marker};
        _flox_hook() {{
          local _flox_vars;
          _flox_vars="$("{flox_bin}" hook-env --shell zsh --shell-pid $$ --invocation-types "${{{FLOX_INVOCATION_TYPES_VAR}:-}}")";
          trap -- '' SIGINT;
          eval "$_flox_vars";
          trap - SIGINT;
        }};
        typeset -ag precmd_functions;
        if (( ! ${{+functions[_flox_hook]}} )) || (( ! ${{precmd_functions[(I)_flox_hook]}} )); then
          precmd_functions=(_flox_hook $precmd_functions);
        fi;
        typeset -ag chpwd_functions;
        if (( ! ${{chpwd_functions[(I)_flox_hook]}} )); then
          chpwd_functions=(_flox_hook $chpwd_functions);
        fi;
        "#
    )
}

pub fn fish_hook(flox_bin: &str) -> String {
    // Fish's command substitution (flox activate) collapses newlines to spaces,
    // so semicolons are required as statement delimiters to survive. The
    // newlines are kept for readability — fish treats them as whitespace.
    //
    // The hook-env output is applied with `eval`, not `| source`: in fish,
    // `exit` in a sourced file only skips the rest of that file and does NOT
    // exit the shell, so the `exit;` script emitted for deactivating an
    // interactive (subshell) activation would be silently swallowed. `eval`
    // runs in the function's own context, where `exit` does exit the shell —
    // matching the bash/zsh hooks, which eval for the same reason.
    // `string collect` folds the output into a single argument, preserving
    // newlines; on empty output it yields no argument and `eval` is a no-op.
    //
    // Fish doesn't parse nested `function...end` blocks properly when the
    // code arrives via eval with collapsed newlines, so we can't nest the
    // PWD hook inside the prompt handler like direnv does. Instead, all
    // three functions are defined at the top level, and a flag variable
    // (_flox_pwd_hook_active) gates the PWD hook's behavior.
    //
    // The mode is read at runtime from $FLOX_AUTO_ACTIVATE_FISH_MODE,
    // matching direnv's `direnv_fish_mode` pattern. This lets the user
    // change modes without re-activating. Values:
    //   - eval_on_arrow (default when unset): PWD hook fires immediately
    //     during interactive prompt use but not during command execution.
    //   - eval_after_arrow: PWD hook sets a flag; evaluation is deferred
    //     until before the next command executes (fish_preexec).
    //   - disable_arrow: no PWD reaction; only prompt-based evaluation.
    let marker = prompt_hook_marker_value(true);
    formatdoc!(
        r#"
        set -gx {PROMPT_HOOK_VERSION_ENV} {marker};
        function _flox_hook --on-event fish_prompt;
            eval ("{flox_bin}" hook-env --shell fish --shell-pid $fish_pid --invocation-types "${FLOX_INVOCATION_TYPES_VAR}" | string collect);
            if test "$FLOX_AUTO_ACTIVATE_FISH_MODE" != "disable_arrow";
                set -g _flox_pwd_hook_active 1;
            end;
        end;
        function _flox_hook_pwd --on-variable PWD;
            if set -q _flox_pwd_hook_active;
                if test "$FLOX_AUTO_ACTIVATE_FISH_MODE" = "eval_after_arrow";
                    set -g _flox_env_again 0;
                else;
                    eval ("{flox_bin}" hook-env --shell fish --shell-pid $fish_pid --invocation-types "${FLOX_INVOCATION_TYPES_VAR}" | string collect);
                end;
            end;
        end;
        function _flox_hook_preexec --on-event fish_preexec;
            if set -q _flox_env_again;
                set -e _flox_env_again;
                eval ("{flox_bin}" hook-env --shell fish --shell-pid $fish_pid --invocation-types "${FLOX_INVOCATION_TYPES_VAR}" | string collect);
            end;
            set -e _flox_pwd_hook_active;
        end;
        "#
    )
}

// Set both precmd and cwdcmd so we get pushd/popd behavior similar to what we have for zsh.
//
// Passing the invocation type map in tcsh is awkward, for empirically
// verified reasons:
//
// - Referencing an unset variable is a hard error, and the one-line `if`
//   form substitutes its body even when the condition is false — worse, a
//   substitution error inside `precmd` makes tcsh print
//   "Faulty alias 'precmd' removed." and delete the hook. So before
//   anything reads `_FLOX_INVOCATION_TYPES`, a guard whose body contains no
//   `$` at all (safe to substitute unconditionally) seeds it empty when
//   unset. Side effect: the hook leaves the variable set-but-empty in
//   shells that performed no activation, which is fine because an empty
//   value means the same as an absent one everywhere.
// - The JSON map cannot ride a backtick command line at all: `:q` quoting
//   does not survive the substitution re-lex, so `[`/`{` glob-expand into a
//   hard "No match" error, and with globbing suppressed every double quote
//   is stripped. Instead the value crosses to `hook-env` through the
//   short-lived exported [`FLOX_INVOCATION_TYPES_WIRE_VAR`]: `setenv`
//   immediately before the call (top-level `:q` expansion is byte-clean),
//   `unsetenv` immediately after, so it never outlives the hook run.
//
// Exiting from the hook is also awkward: if `exit` unwinds out of the eval'd
// `hook-env` output, tcsh treats the special alias as broken, prints
// "Faulty alias 'precmd' removed.", deletes the alias, and does NOT exit. An
// `exit` at the alias-body top level is fine, so for an interactive
// deactivation `hook-env` emits `set _flox_exit=1` (see
// `emit_deactivate_script` in the `flox` crate) and the alias body checks the
// flag after the eval completes — after the `unsetenv`, so the wire variable
// dies with the hook run even when the shell exits.
pub fn tcsh_hook(flox_bin: &str) -> String {
    // A tcsh alias body must be a single line, so assemble the statements here
    // and join them with "; " rather than writing one long string literal.
    let hook = [
        format!(r#"if ( ! $?{FLOX_INVOCATION_TYPES_VAR} ) set {FLOX_INVOCATION_TYPES_VAR}="""#),
        format!("setenv {FLOX_INVOCATION_TYPES_WIRE_VAR} ${FLOX_INVOCATION_TYPES_VAR}:q"),
        format!(
            r#"eval "`{flox_bin} hook-env --shell tcsh --shell-pid $$ --invocation-types-from-env`""#
        ),
        format!("unsetenv {FLOX_INVOCATION_TYPES_WIRE_VAR}"),
        "if ( $?_flox_exit ) exit".to_string(),
    ]
    .join("; ");
    let marker = prompt_hook_marker_value(true);
    formatdoc!(
        r#"
        setenv {PROMPT_HOOK_VERSION_ENV} {marker};
        alias precmd '{hook}';
        alias cwdcmd '{hook}';
        "#
    )
}

```

### Core Architecture Module: `cli/flox-core/src/activate/context.rs`
```
use std::path::PathBuf;
use std::str::FromStr;

use serde::{Deserialize, Serialize};
use shell_gen::ShellWithPath;
use uuid::Uuid;

pub use super::mode::ActivateMode;

/// Context needed to attach to a start of an environment
/// Note that store path is not included, as the executive needs to attach to
/// the latest ready store path when starting process-compose
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachCtx {
    /// The path to the environment symlink
    pub env: String,

    /// The cache path for the environment
    pub env_cache: PathBuf,

    /// The environment description
    pub env_description: String,

    /// Active environments tracking (JSON array)
    pub flox_active_environments: String,

    /// Prompt color 1
    pub prompt_color_1: String,

    /// Prompt color 2
    pub prompt_color_2: String,

    /// Prompt environments string
    pub flox_prompt_environments: String,

    /// Whether to set prompt
    pub set_prompt: bool,

    /// CUDA detection enabled
    pub flox_env_cuda_detection: String,

    /// Whether this activation puts the environment's sbin directory on PATH.
    /// Defaults to false when deserializing contexts serialized by older
    /// versions (e.g. containerize payloads).
    #[serde(default)]
    pub add_sbin: bool,

    /// Path to the interpreter (activate scripts)
    pub interpreter_path: PathBuf,
}

/// Additional context for project-based activations.
/// Includes project paths, logging, and service management.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttachProjectCtx {
    /// The project path for the environment
    pub env_project: PathBuf,

    /// The path to the environment .flox directory
    pub dot_flox_path: PathBuf,

    /// Environment log directory
    pub flox_env_log_dir: PathBuf,

    /// Path to process-compose binary
    pub process_compose_bin: PathBuf,

    /// Services socket path
    pub flox_services_socket: PathBuf,

    /// Services to start with a new process-compose instance.
    /// When non-empty, flox-activations will start a new process-compose and start these services.
    pub services_to_start: Vec<String>,
}

/// Full activation context for activations.
/// For containers, project is None; for normal activations, it includes logging and services.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivateCtx {
    /// Store path for activation
    pub flox_activate_store_path: String,

    pub attach_ctx: AttachCtx,

    /// Project context for logging and services
    pub project_ctx: Option<AttachProjectCtx>,

    /// Base directory for this environment's activation state.
    pub activation_state_dir: PathBuf,

    /// The activation mode (dev or run)
    pub mode: ActivateMode,

    /// Path to the shell executable
    pub shell: ShellWithPath,

    /// The invocation type (interactive, command, etc.)
    /// None when determined at runtime (e.g., containers)
    pub invocation_type: Option<InvocationType>,

    /// The activated environment's pointer as serialized in
    /// `_FLOX_ACTIVE_ENVIRONMENTS`, used to key its `_FLOX_INVOCATION_TYPES`
    /// entry. Empty when there is no activation state to key against
    /// (e.g. containers).
    #[serde(default)]
    pub env_pointer: String,

    /// Whether to clean up the context file after reading it.
    pub remove_after_reading: bool,

    /// The metrics UUID for this installation.
    /// When Some, Sentry is initialized with this user ID.
    /// When None, metrics are disabled and Sentry is not initialized.
    #[serde(default)]
    pub metrics_uuid: Option<Uuid>,

    /// Passthrough for config.disable_hook.unwrap_or(false)
    #[serde(default)]
    pub disable_hook: bool,

    /// Path to the flox binary, used for generating hook code.
    #[serde(default)]
    pub flox_bin: String,

    /// Controls how the fish shell hook responds to directory changes.
    #[serde(default)]
    pub auto_activate_fish_mode: Option<AutoActivateFishMode>,

    /// Whether this activation announces itself by naming the environment on
    /// stderr once it is in effect.
    ///
    /// Resolved by the `flox` crate because the decision depends on state only
    /// the caller has: the user's real verbosity and whether the environment
    /// was already active. Defaults to `false` so a context file written by an
    /// older Flox stays quiet rather than gaining output the writer never
    /// asked for.
    #[serde(default)]
    pub announce_activation: bool,
}

/// Fish shell hook mode, matching direnv's `direnv_fish_mode` values.
#[derive(
    Clone, Copy, Debug, Default, Deserialize, derive_more::Display, Serialize, PartialEq, Eq,
)]
#[serde(rename_all = "snake_case")]
pub enum AutoActivateFishMode {
    /// Evaluate on prompt and immediately on PWD change (default).
    #[default]
    #[display("eval_on_arrow")]
    EvalOnArrow,
    /// Evaluate on prompt; defer PWD-change evaluation until before the next command.
    #[display("eval_after_arrow")]
    EvalAfterArrow,
    /// Evaluate on prompt only; ignore directory changes.
    #[display("disable_arrow")]
    DisableArrow,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum InvocationType {
    InPlace,
    Interactive,
    ShellCommand(String),
    ExecCommand(Vec<String>),
}

impl InvocationType {
    pub fn is_in_place(&self) -> bool {
        matches!(self, Self::InPlace)
    }

    pub fn kind(&self) -> InvocationKind {
        match self {
            Self::InPlace => InvocationKind::InPlace,
            Self::Interactive => InvocationKind::Interactive,
            Self::ShellCommand(_) => InvocationKind::ShellCommand,
            Self::ExecCommand(_) => InvocationKind::ExecCommand,
        }
    }
}

/// Drops the user command wrapped by `ShellCommand` and `ExecCommand` so we can
/// roundtrip with InvocationKind
impl std::fmt::Display for InvocationType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.kind())
    }
}

#[derive(
    Clone,
    Copy,
    Debug,
    derive_more::Display,
    derive_more::FromStr,
    Eq,
    PartialEq,
    Serialize,
    Deserialize,
)]
#[display(rename_all = "lowercase")]
#[from_str(rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum InvocationKind {
    InPlace,
    Interactive,
    ShellCommand,
    ExecCommand,
}

/// One entry of [`InvocationTypes`]: the invocation type of an activation
/// the calling shell performed, keyed by the environment pointer as it
/// appears in `_FLOX_ACTIVE_ENVIRONMENTS`. The pointer is kept as an opaque
/// JSON value (its Rust type lives in flox-rust-sdk); keys are compared by
/// value, so JSON object key order does not matter.
#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct InvocationTypeEntry {
    pub env: serde_json::Value,
    pub invocation_type: InvocationKind,
}

/// The parsed value of `_FLOX_INVOCATION_TYPES` (see
/// [`super::vars::FLOX_INVOCATION_TYPES_VAR`]): for each activation the
/// calling shell performed, the invocation type keyed by environment
/// pointer. A JSON array on the wire. An empty value parses to an empty map
/// and means the same as not passing the value at all — the shell performed
/// no activations.
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct InvocationTypes(pub Vec<InvocationTypeEntry>);

impl InvocationTypes {
    /// Remove and return the entry for `env`, if any.
    ///
    /// Callers emitting a deactivation script take one entry per layer
    /// popped off the activation stack and then write the remainder back to
    /// the shell variable in one update. A missing entry means the calling
    /// shell did not perform that activation (it inherited the layer), so
    /// the layer's script must not detach.
    pub fn take(&mut self, env: &serde_json::Value) -> Option<InvocationKind> {
        let idx = self.0.iter().position(|entry| &entry.env == env)?;
        Some(self.0.remove(idx).invocation_type)
    }

    /// Record an entry for `env` unless one already exists.
    ///
    /// Keeping the original entry covers repeat activations of an
    /// already-active environment: re-attaching in place must not downgrade
    /// an `interactive` entry, or `flox deactivate` would restore in place
    /// instead of exiting the session. The reverse — an interactive
    /// activation of an already-active environment — fails in the CLI
    /// before any script is generated.
    pub fn insert_if_absent(&mut self, env: serde_json::Value, invocation_type: InvocationKind) {
        if !self.0.iter().any(|entry| entry.env == env) {
            self.0.push(InvocationTypeEntry {
                env,
                invocation_type,
            });
        }
    }

    pub fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

impl FromStr for InvocationTypes {
    type Err = serde_json::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let trimmed = s.trim();
        if trimmed.is_empty() {
            Ok(Self::default())
        } else {
            Ok(Self(serde_json::from_str(trimmed)?))
        }
    }
}

/// The wire format for [`super::vars::FLOX_INVOCATION_TYPES_VAR`]: a compact
/// JSON array. Round-trips with [`FromStr`].
impl std::fmt::Display for InvocationTypes {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let json = serde_json::to_string(&self.0).map_err(|_| std::fmt::Error)?;
        f.write_str(&json)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn invocation_type_display_round_trips_to_kind() {
        let cases = [
            (InvocationType::InPlace, InvocationKind::InPlace),
            (InvocationType::Interactive, InvocationKind::Interactive),
            (
                InvocationType::ShellCommand("echo hi".to_string()),
                InvocationKind::ShellCommand,
            ),
           
```

### Core Architecture Module: `cli/flox-core/src/activate/mod.rs`
```
pub mod context;
pub mod mode;
pub mod vars;

```

### Core Architecture Module: `cli/flox-core/src/activate/mode.rs`
```
use std::fmt::Display;
use std::str::FromStr;

use schemars::JsonSchema;
use serde::{Deserialize, Serialize};

#[derive(
    Debug, Clone, Serialize, Deserialize, Hash, PartialEq, Eq, Ord, PartialOrd, Default, JsonSchema,
)]
#[serde(rename_all = "kebab-case")]
#[cfg_attr(any(test, feature = "tests"), derive(proptest_derive::Arbitrary))]
pub enum ActivateMode {
    #[default]
    Dev,
    Run,
}

impl Display for ActivateMode {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ActivateMode::Dev => write!(f, "dev"),
            ActivateMode::Run => write!(f, "run"),
        }
    }
}

#[derive(Debug, thiserror::Error)]
#[error("not a valid activation mode")]
pub struct ActivateModeParseError;

impl FromStr for ActivateMode {
    type Err = ActivateModeParseError;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s {
            "dev" => Ok(ActivateMode::Dev),
            "run" => Ok(ActivateMode::Run),
            _ => Err(ActivateModeParseError),
        }
    }
}

```

### Core Architecture Module: `cli/flox-core/src/activate/vars.rs`
```
// The FLOX_* variables which follow are currently updated by the CLI as it
// activates new environments, and they are consequently *not* updated with
// manual invocations of the activation script. We want the activation script
// to eventually have feature parity with the CLI, so in future we will need
// to migrate this logic to the activation script itself.

/// The environments active in this shell, as a JSON array of serialized
/// environment metadata (`UninitializedEnvironment` in `flox-rust-sdk`), most
/// recently activated first. Set by `flox activate`; read wherever an active
/// environment must be reopened (e.g. `flox deactivate`, the prompt hook) and
/// printed to users by `flox envs`.
pub const FLOX_ACTIVE_ENVIRONMENTS_VAR: &str = "_FLOX_ACTIVE_ENVIRONMENTS";

/// Numeric log verbosity for the `flox-activations` binary, exported by the
/// CLI from its own verbosity so subprocess logging matches `flox -v` levels.
/// Overridden by `RUST_LOG` when both are set.
pub const FLOX_ACTIVATIONS_VERBOSITY_VAR: &str = "_FLOX_ACTIVATIONS_VERBOSITY";

/// Numeric log verbosity for the executive subsystem's log file, deliberately
/// separate from [`FLOX_ACTIVATIONS_VERBOSITY_VAR`] so that `flox activate -v`
/// does not change what the long-lived executive process records.
pub const FLOX_EXECUTIVE_VERBOSITY_VAR: &str = "_FLOX_EXECUTIVE_VERBOSITY";

/// Project directories whose environments the prompt hook auto-activated in
/// this shell, as a JSON array of absolute paths, outermost-first. Maintained
/// by the script `flox hook-env` emits; used to decide which environments to
/// auto-deactivate when the shell leaves their directory.
pub const FLOX_AUTO_ACTIVATED_ENVIRONMENTS_VAR: &str = "_FLOX_AUTO_ACTIVATED_ENVIRONMENTS";

/// The invocation types of the activations performed by *this* shell, as a
/// JSON array of `{env, invocation_type}` entries keyed by the environment
/// pointer as it appears in `_FLOX_ACTIVE_ENVIRONMENTS` (see
/// [`super::context::InvocationTypes`]).
/// Deliberately a shell variable rather than an exported one: a subshell
/// inherits the activation's exported environment but did not attach to the
/// activation itself, and an absent/empty value is how deactivation knows
/// not to emit a `flox-activations detach` for it. Updated by
/// `flox-activations push-invocation-type` from each activation's startup
/// script (only the eval'ing shell can see the current value); passed to
/// `flox hook-env`/`flox deactivate --print-script` by shell code expanding
/// it (a subprocess can't read it from the environment), which take the
/// entry for each layer they deactivate and emit an update writing the
/// remainder back.
pub const FLOX_INVOCATION_TYPES_VAR: &str = "_FLOX_INVOCATION_TYPES";

/// Short-lived exported variable through which tcsh passes the current
/// [`FLOX_INVOCATION_TYPES_VAR`] value to `flox hook-env`,
/// `flox deactivate --print-script-from-env` and
/// `flox-activations push-invocation-type`: raw JSON cannot ride a tcsh
/// backtick command line (globbing and quote-stripping mangle it), so the
/// caller `setenv`s this immediately before the call and `unsetenv`s it
/// immediately after. The other shells pass the value as a quoted argument.
pub const FLOX_INVOCATION_TYPES_WIRE_VAR: &str = "_FLOX_INVOCATION_TYPES_WIRE";

/// Short-lived exported variable through which tcsh passes the environment
/// pointer of the environment being activated to
/// `flox-activations push-invocation-type` (same tcsh constraint and
/// setenv/unsetenv lifetime as [`FLOX_INVOCATION_TYPES_WIRE_VAR`]).
pub const FLOX_INVOCATION_TYPES_PUSH_ENV_VAR: &str = "_FLOX_INVOCATION_TYPES_PUSH_ENV";

/// Project directories the prompt hook must not auto-(re)activate while the
/// shell remains inside them, as a JSON array of absolute paths. An entry is
/// added when an environment is deactivated while the shell is still inside
/// its directory (e.g. by 'flox deactivate') and removed once the shell
/// leaves that directory, so a later re-entry auto-activates again.
pub const FLOX_SUPPRESSED_ENVIRONMENTS_VAR: &str = "_FLOX_SUPPRESSED_ENVIRONMENTS";

```

### Core Architecture Module: `cli/flox-core/src/activations.rs`
```
use std::collections::{BTreeMap, BTreeSet};
use std::fs::DirBuilder;
use std::ops::Deref;
use std::os::unix::fs::DirBuilderExt;
use std::path::{Path, PathBuf};

use anyhow::{Context, bail};
use fslock::LockFile;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use time::OffsetDateTime;
use tracing::{debug, info, trace};

use crate::activate::mode::ActivateMode;
use crate::proc_status::pid_is_running;
use crate::{Version, path_hash};

const EXECUTIVE_NOT_STARTED: Pid = 0;

type Error = anyhow::Error;
type Pid = i32;
pub type PidWithExpiration = (Pid, Option<OffsetDateTime>);

/// Represents running processes attached to an activation.
/// Attachments take precedence over executive in this representation.
#[derive(Debug, Clone, Eq, PartialEq)]
pub enum RunningProcesses {
    /// One or more shell processes are attached to the activation
    Attachments(Vec<Pid>),
    /// No attachments, but the executive process is running
    Executive(Pid),
}

impl RunningProcesses {
    /// Construct a RunningProcesses enum from separate PID lists.
    /// Filters to running PIDs and applies precedence (attachments > executive).
    fn from_pids(attached_pids: Vec<Pid>, executive_pid: Pid) -> Option<Self> {
        let running_attached: Vec<Pid> = attached_pids
            .into_iter()
            .filter(|pid| pid_is_running(*pid))
            .collect();

        let running_executive = Some(executive_pid)
            .filter(|&pid| pid != EXECUTIVE_NOT_STARTED)
            .filter(|&pid| pid_is_running(pid));

        if !running_attached.is_empty() {
            Some(RunningProcesses::Attachments(running_attached))
        } else {
            running_executive.map(RunningProcesses::Executive)
        }
    }
}

#[derive(Debug, Eq, PartialEq, thiserror::Error)]
pub enum UnsupportedVersion {
    /// ActivationState of unsupported version with running activations.
    WithRunningAttachments { pids: Vec<Pid> },
    /// ActivationState of unsupported version with no running activations but a running executive.
    WithRunningExecutive { pid: Pid },
}

impl UnsupportedVersion {
    pub fn from_running_processes(running: RunningProcesses) -> Self {
        match running {
            RunningProcesses::Attachments(pids) => {
                UnsupportedVersion::WithRunningAttachments { pids }
            },
            RunningProcesses::Executive(pid) => UnsupportedVersion::WithRunningExecutive { pid },
        }
    }
}

impl std::fmt::Display for UnsupportedVersion {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            UnsupportedVersion::WithRunningAttachments { pids } => {
                let pid_list = pids
                    .iter()
                    .map(|i| i.to_string())
                    .collect::<Vec<_>>()
                    .join(", ");

                write!(
                    f,
                    "This environment has already been activated with an incompatible version of 'flox'.\n\n\
                     Exit all activations of the environment and try again.\n\
                     PIDs of the running activations: {pid_list}",
                )
            },
            UnsupportedVersion::WithRunningExecutive { pid: executive_pid } => {
                write!(
                    f,
                    "This environment has already been activated with an incompatible version of 'flox'.\n\n\
                     The executive process is still running.\n\
                     Wait for it to finish, or stop it with: 'kill {executive_pid}'",
                )
            },
        }
    }
}

#[derive(Debug, Eq, PartialEq, thiserror::Error)]
pub enum ModeMismatch {
    /// Mode mismatch with running attachments.
    WithRunningAttachments {
        current_mode: crate::activate::mode::ActivateMode,
        requested_mode: crate::activate::mode::ActivateMode,
        pids: Vec<Pid>,
    },
    /// Mode mismatch with no running attachments but a running executive.
    WithRunningExecutive {
        current_mode: crate::activate::mode::ActivateMode,
        requested_mode: crate::activate::mode::ActivateMode,
        pid: Pid,
    },
}

impl ModeMismatch {
    pub fn from_running_processes(
        current_mode: crate::activate::mode::ActivateMode,
        requested_mode: crate::activate::mode::ActivateMode,
        running: RunningProcesses,
    ) -> Self {
        match running {
            RunningProcesses::Attachments(pids) => ModeMismatch::WithRunningAttachments {
                current_mode,
                requested_mode,
                pids,
            },
            RunningProcesses::Executive(pid) => ModeMismatch::WithRunningExecutive {
                current_mode,
                requested_mode,
                pid,
            },
        }
    }
}

impl std::fmt::Display for ModeMismatch {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ModeMismatch::WithRunningAttachments {
                current_mode,
                requested_mode,
                pids,
            } => {
                let pid_list = pids
                    .iter()
                    .map(|i| i.to_string())
                    .collect::<Vec<_>>()
                    .join(", ");

                write!(
                    f,
                    "Environment can't be activated in '{requested_mode}' mode while there are existing activations in '{current_mode}' mode\n\n\
                     Exit all activations of the environment and try again.\n\
                     PIDs of the running activations: {pid_list}",
                )
            },
            ModeMismatch::WithRunningExecutive {
                current_mode,
                requested_mode,
                pid,
            } => {
                write!(
                    f,
                    "Environment can't be activated in '{requested_mode}' mode while there are existing activations in '{current_mode}' mode\n\n\
                     The executive process is still running.\n\
                     Wait for it to finish, or stop it with: 'kill {pid}'",
                )
            },
        }
    }
}

#[derive(Clone, Debug, Eq, Hash, PartialEq, Deserialize, Serialize)]
pub struct AttachedPid {
    pub pid: i32,
    /// If Some, the time after which the activation can be cleaned up
    ///
    /// Even if the PID has exited, the activation should not be cleaned up
    /// until an expiration is reached.
    /// Expiration is used to support in-place activations.
    /// For an in-place activation, the `flox activate` command generating the
    /// script that can be evaluated by the shell will exit before the shell has
    /// time to evaluate the script.
    /// In that case, `flox activate` sets an expiration so that the shell has
    /// some time before the activation is cleaned up.
    pub expiration: Option<OffsetDateTime>,
}

/// Acquires the filesystem-based lock on state.json
pub fn acquire_activations_json_lock(
    activations_json_path: impl AsRef<Path>,
) -> Result<LockFile, Error> {
    let lock_path = activations_json_lock_path(activations_json_path);
    let lock_path_parent = lock_path.parent().expect("lock path has parent");
    if !(lock_path.exists()) {
        DirBuilder::new()
            .recursive(true)
            .mode(0o700)
            .create(lock_path_parent)?;
    }
    let mut lock = LockFile::open(&lock_path).context("failed to open lockfile")?;
    lock.lock().context("failed to lock lockfile")?;
    Ok(lock)
}

/// Returns the path to the lock file for state.json.
/// The presence of the lock file does not indicate an active lock because the
/// file isn't removed after use.
/// This is a separate file because we replace state.json on write.
fn activations_json_lock_path(activations_json_path: impl AsRef<Path>) -> PathBuf {
    activations_json_path.as_ref().with_extension("lock")
}

/// Base state directory for activations (plural) of the given environment.
///
/// `dot_flox_path` should be canonicalized before being passed to this
/// function. We can't enforce the type here because the `executive` needs to
/// still be able to read state if the environment has been deleted beneath it.
///
/// If there's a FloxHub account `activations` we'll put gcroots in this dir,
/// but it shouldn't collide with any of the hashed directories we're storing
///
/// {flox_runtime_dir}/activations/{path_hash(dot_flox_path)}-{basename(dot_flox_path)}/
pub fn activation_state_dir_path(
    runtime_dir: impl AsRef<Path>,
    dot_flox_path: impl AsRef<Path>,
) -> PathBuf {
    let dot_flox_path = dot_flox_path.as_ref();
    let hash = path_hash(dot_flox_path);
    let basename = dot_flox_path
        .parent()
        .and_then(|parent| parent.file_name())
        .and_then(|name| name.to_str())
        .unwrap_or("root");

    runtime_dir
        .as_ref()
        .join("activations")
        .join(format!("{}-{}", hash, basename))
}

/// State file path within an activation state directory.
///
/// {activation_state_dir}/state.json
pub fn state_json_path(activation_state_dir: impl AsRef<Path>) -> PathBuf {
    activation_state_dir.as_ref().join("state.json")
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum StartOrAttachResult {
    /// A new activation was started for the given StartIdentifier
    Start { start_id: StartIdentifier },
    /// Attached to an existing ready activation with the given StartIdentifier
    Attach { start_id: StartIdentifier },
    /// Another process is currently starting an activation.
    /// The caller should wait and retry.
    AlreadyStarting { pid: Pid, start_id: StartIdentifier },
}

#[derive(
    Clone, Debug, Deserialize, derive_more::Display, Eq, PartialEq, Serialize, Ord, PartialOrd,
)]
pub struct UnixTimestampMillis(i64);

impl UnixTimestampMillis {
    pub fn now() -> Self {
        let now = OffsetDateTime::now_utc();
        let millis = (now.unix_timestamp_n
```

### Core Architecture Module: `cli/flox-core/src/canonical_path.rs`
```
use std::path::{Path, PathBuf};

use derive_more::{AsRef, Deref};
use serde::Serialize;
use thiserror::Error;

/// A path that is guaranteed to be canonicalized
///
/// [`ManagedEnvironment`] uses this to refer to the path of its `.flox` directory.
/// [`ManagedEnvironment::encode`] is used to uniquely identify the environment
/// by encoding the canonicalized path.
/// This encoding is used to create a unique branch name in the floxmeta repository.
/// Thus, rather than canonicalizing the path every time we need to encode it,
/// we store the path as a [`CanonicalPath`].
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deref, AsRef)]
#[deref(forward)]
#[as_ref(forward)]
pub struct CanonicalPath(PathBuf);

#[derive(Debug, Error)]
#[error("couldn't canonicalize path {path:?}: {err}")]
pub struct CanonicalizeError {
    pub path: PathBuf,
    #[source]
    pub err: std::io::Error,
}

impl CanonicalPath {
    pub fn new(path: impl AsRef<Path>) -> Result<Self, CanonicalizeError> {
        let canonicalized = std::fs::canonicalize(&path).map_err(|e| CanonicalizeError {
            path: path.as_ref().to_path_buf(),
            err: e,
        })?;
        Ok(Self(canonicalized))
    }

    /// Create a [`CanonicalPath`] without checking if the path is canonical or
    /// exists. Only to be used when dealing with paths that are known to be
    /// deleted.
    pub fn new_unchecked(path: impl AsRef<Path>) -> Self {
        Self(path.as_ref().to_path_buf())
    }

    /// Destruct the [`CanonicalPath`] and return the inner [`PathBuf`]
    pub fn into_inner(self) -> PathBuf {
        self.0
    }
}

```

### Core Architecture Module: `cli/flox-core/src/data/environment_ref.rs`
```
use std::fmt::Display;
use std::path::PathBuf;
use std::str::FromStr;

use derive_more::{AsRef, Deref, Display};
use schemars::{JsonSchema, json_schema};
use serde_with::{DeserializeFromStr, SerializeDisplay};
use shell_escape::escape;
use thiserror::Error;

pub static DEFAULT_NAME: &str = "default";
pub static DEFAULT_OWNER: &str = "local";

#[derive(
    Debug,
    Clone,
    PartialEq,
    Eq,
    PartialOrd,
    Ord,
    Hash,
    AsRef,
    Deref,
    Display,
    DeserializeFromStr,
    SerializeDisplay,
    JsonSchema,
)]
pub struct EnvironmentOwner(String);

impl FromStr for EnvironmentOwner {
    type Err = RemoteEnvironmentRefError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if [' ', '/'].iter().any(|c| s.contains(*c)) {
            Err(RemoteEnvironmentRefError::InvalidOwner(s.to_string()))?
        }

        Ok(EnvironmentOwner(s.to_string()))
    }
}

#[cfg(any(test, feature = "tests"))]
impl proptest::arbitrary::Arbitrary for EnvironmentName {
    type Parameters = ();
    type Strategy = proptest::strategy::BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        use proptest::prelude::Strategy;

        "[^ /]".prop_map(|s| EnvironmentName(s.to_string())).boxed()
    }
}

#[derive(
    Debug,
    Clone,
    PartialEq,
    Eq,
    PartialOrd,
    Ord,
    Hash,
    AsRef,
    Display,
    DeserializeFromStr,
    SerializeDisplay,
    JsonSchema,
)]
pub struct EnvironmentName(String);

impl FromStr for EnvironmentName {
    type Err = RemoteEnvironmentRefError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        if [' ', '/'].iter().any(|c| s.contains(*c)) {
            Err(RemoteEnvironmentRefError::InvalidName(s.to_string()))?
        }

        Ok(EnvironmentName(s.to_string()))
    }
}

#[cfg(any(test, feature = "tests"))]
impl proptest::arbitrary::Arbitrary for EnvironmentOwner {
    type Parameters = ();
    type Strategy = proptest::strategy::BoxedStrategy<Self>;

    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        use proptest::prelude::Strategy;

        "[^ /]"
            .prop_map(|s| EnvironmentOwner(s.to_string()))
            .boxed()
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Hash, SerializeDisplay, DeserializeFromStr)]
#[cfg_attr(any(test, feature = "tests"), derive(proptest_derive::Arbitrary))]
pub struct RemoteEnvironmentRef {
    owner: EnvironmentOwner,
    name: EnvironmentName,
}

impl RemoteEnvironmentRef {
    pub fn from_parts(owner: EnvironmentOwner, name: EnvironmentName) -> Self {
        Self { owner, name }
    }
}

impl Display for RemoteEnvironmentRef {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}/{}", self.owner, self.name)
    }
}

impl FromStr for RemoteEnvironmentRef {
    type Err = RemoteEnvironmentRefError;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        let (owner, name) = s
            .split_once('/')
            .ok_or(RemoteEnvironmentRefError::InvalidOwner(s.to_string()))?;
        Ok(Self {
            owner: EnvironmentOwner::from_str(owner)?,
            name: EnvironmentName::from_str(name)?,
        })
    }
}

impl JsonSchema for RemoteEnvironmentRef {
    fn schema_name() -> std::borrow::Cow<'static, str> {
        "EnvironmentRef".into()
    }

    fn json_schema(_generator: &mut schemars::SchemaGenerator) -> schemars::Schema {
        json_schema!({
            "description": "Environment Reference",
            "type": "string",
        })
    }
}

#[derive(Error, Debug)]
pub enum RemoteEnvironmentRefError {
    #[error(
        "Name '{0}' is invalid.\nEnvironment names may only contain alphanumeric characters, '.', '_', and '-'."
    )]
    InvalidName(String),

    #[error(
        "Owner '{0}' is invalid.\nEnvironment owners may only contain alphanumeric characters, '.', '_', and '-'."
    )]
    InvalidOwner(String),
}

impl RemoteEnvironmentRef {
    pub fn owner(&self) -> &EnvironmentOwner {
        &self.owner
    }

    pub fn name(&self) -> &EnvironmentName {
        &self.name
    }

    pub fn new(
        owner: impl AsRef<str>,
        name: impl AsRef<str>,
    ) -> Result<Self, RemoteEnvironmentRefError> {
        Ok(Self {
            owner: EnvironmentOwner::from_str(owner.as_ref())?,
            name: EnvironmentName::from_str(name.as_ref())?,
        })
    }

    pub fn new_from_parts(owner: EnvironmentOwner, name: EnvironmentName) -> Self {
        Self { owner, name }
    }
}

/// An environment that can be activated.
/// ConcreteEnvironment::{Path,Managed} uses a local path that's the parent of `.flox`
/// ConcreteEnvironment::Remote uses a remote reference on FloxHub
//
// TODO: Support pinned generation for managed and remote environments?
#[derive(Debug, Clone)]
pub enum ActivateEnvironmentRef {
    Local(PathBuf),
    Remote(RemoteEnvironmentRef),
}

impl ActivateEnvironmentRef {
    /// Render the activation arguments (`-d`/`-r`) used by `flox activate`.
    pub fn activate_target_arg(&self) -> String {
        match self {
            ActivateEnvironmentRef::Local(path) => {
                format!("-d {}", escape(path.to_string_lossy()))
            },
            ActivateEnvironmentRef::Remote(remote) => {
                format!("-r {}", escape(remote.to_string().into()))
            },
        }
    }
}

```

### Core Architecture Module: `cli/flox-core/src/data/flox_version.rs`
```
use std::cmp::Ordering;
use std::fmt;
use std::num::ParseIntError;
use std::str::FromStr;

use regex::Regex;

#[derive(Debug, PartialEq, Eq)]
pub enum PreReleaseName {
    Alpha,
    Beta,
    RC,
}

impl PartialOrd for PreReleaseName {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

impl Ord for PreReleaseName {
    fn cmp(&self, other: &Self) -> Ordering {
        use PreReleaseName::*;
        match (self, other) {
            (Alpha, Alpha) => Ordering::Equal,
            (Beta, Beta) => Ordering::Equal,
            (RC, RC) => Ordering::Equal,
            (Alpha, _) => Ordering::Less,
            (Beta, RC) => Ordering::Less,
            (RC, _) => Ordering::Greater,
            (Beta, Alpha) => Ordering::Greater,
        }
    }
}

#[derive(Debug)]
pub enum PreReleaseNameParseError {
    InvalidPreRelease,
}

impl FromStr for PreReleaseName {
    type Err = PreReleaseNameParseError;

    fn from_str(pre_name_str: &str) -> Result<Self, Self::Err> {
        match pre_name_str {
            "alpha" => Ok(PreReleaseName::Alpha),
            "beta" => Ok(PreReleaseName::Beta),
            "rc" => Ok(PreReleaseName::RC),
            _ => Err(PreReleaseNameParseError::InvalidPreRelease),
        }
    }
}

impl fmt::Display for PreReleaseName {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            PreReleaseName::Alpha => write!(f, "alpha"),
            PreReleaseName::Beta => write!(f, "beta"),
            PreReleaseName::RC => write!(f, "rc"),
        }
    }
}

#[derive(Debug, PartialEq)]
pub struct FloxVersion {
    major: u32,
    minor: u32,
    patch: u32,
    pre_name: Option<PreReleaseName>,
    pre_number: Option<u32>,
    num_of_commits: Option<u32>,
    commit_vcs: Option<char>,
    commit_sha: Option<String>,
    is_dirty: bool,
}

#[derive(Debug)]
pub enum VersionParseError {
    InvalidFormat,
    InvalidNumber(ParseIntError),
}

impl From<ParseIntError> for VersionParseError {
    fn from(err: ParseIntError) -> Self {
        VersionParseError::InvalidNumber(err)
    }
}

impl FloxVersion {
    /// Returns the base semantic version string (major.minor.patch) without any
    /// suffixes (release candidate, commit ref, etc).
    pub fn base_semver(&self) -> String {
        format!("{}.{}.{}", self.major, self.minor, self.patch)
    }

    /// Returns the commit SHA only.
    pub fn commit_sha(&self) -> Option<String> {
        self.commit_sha.clone()
    }
}

impl FromStr for FloxVersion {
    type Err = VersionParseError;

    fn from_str(version_str: &str) -> Result<Self, Self::Err> {
        // Define the regex pattern
        let re = Regex::new(r"(?x)
            ^(?P<major>\d+)\.(?P<minor>\d+)\.(?P<patch>\d+)        # Match major.minor.patch
            (?:-(?P<pre>(?P<pre_name>[a-zA-Z]+)\.(?P<pre_number>\d+)))? # Optionally match pre-release name and number (e.g., rc.1)
            (?:-(?P<num_of_commits>\d+))?                          # Optionally match number of commits
            (?:-(?P<commit_vcs>[a-z])(?P<commit_sha>[a-f0-9]+))?   # Optionally match VCS and SHA
            (?:-(?P<dirty>dirty))?                                 # Optionally match the dirty suffix
        $").unwrap(); // Unwrap is safe here because the regex is a constant

        // Apply the regex to the version string
        if let Some(captures) = re.captures(version_str) {
            let pre_name = captures
                .name("pre_name")
                .map(|s| s.as_str().parse().unwrap());
            let pre_number = captures
                .name("pre_number")
                .map(|s| s.as_str().parse().unwrap());
            let num_of_commits = captures
                .name("num_of_commits")
                .map(|s| s.as_str().parse().unwrap());
            let commit_vcs = captures
                .name("commit_vcs")
                .map(|s| s.as_str().chars().next().unwrap());
            let commit_sha = captures.name("commit_sha").map(|s| s.as_str().to_string());

            // When there is pre release commit fields shouldn't be there
            if (pre_name.is_some() || pre_number.is_some())
                && (num_of_commits.is_some() || commit_vcs.is_some() || commit_sha.is_some())
            {
                return Err(VersionParseError::InvalidFormat);
            }

            // There can never by number of commits without the commit sha
            if num_of_commits.is_some() && (commit_vcs.is_none() || commit_sha.is_none()) {
                return Err(VersionParseError::InvalidFormat);
            }

            Ok(FloxVersion {
                major: captures["major"].parse()?,
                minor: captures["minor"].parse()?,
                patch: captures["patch"].parse()?,
                pre_name,
                pre_number,
                num_of_commits,
                commit_vcs,
                commit_sha,
                is_dirty: captures.name("dirty").is_some(),
            })
        } else {
            Err(VersionParseError::InvalidFormat)
        }
    }
}

impl PartialOrd for FloxVersion {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        // Compare major, minor, and patch versions
        match self.major.cmp(&other.major) {
            Ordering::Equal => (),
            ordering => return Some(ordering),
        }
        match self.minor.cmp(&other.minor) {
            Ordering::Equal => (),
            ordering => return Some(ordering),
        }
        match self.patch.cmp(&other.patch) {
            Ordering::Equal => (),
            ordering => return Some(ordering),
        }

        // Compare number of commits
        match (self.num_of_commits, other.num_of_commits) {
            (None, None) => (),
            (None, Some(_)) => return Some(Ordering::Less),
            (Some(_), None) => return Some(Ordering::Greater),
            (Some(self_commits), Some(other_commits)) => {
                return Some(self_commits.cmp(&other_commits));
            },
        }

        // Pre-release comparison
        match (&self.pre_name, &other.pre_name) {
            (None, None) => (),
            (None, Some(_)) => return Some(Ordering::Greater),
            (Some(_), None) => return Some(Ordering::Less),
            (Some(self_pre), Some(other_pre)) => match self_pre.cmp(other_pre) {
                Ordering::Equal => (),
                ordering => return Some(ordering),
            },
        }

        // Compare pre-release numbers if both have pre-release names
        match (self.pre_number, other.pre_number) {
            (None, None) => (),
            (None, Some(_)) => return Some(Ordering::Greater),
            (Some(_), None) => return Some(Ordering::Less),
            (Some(self_num), Some(other_num)) => return Some(self_num.cmp(&other_num)),
        }

        // Skip commit comparison if the pre-release part is different or either version is dirty
        if self.commit_vcs == other.commit_vcs
            && self.commit_sha == other.commit_sha
            && !self.is_dirty
            && !other.is_dirty
        {
            return Some(Ordering::Equal);
        }

        None
    }
}

impl fmt::Display for FloxVersion {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        // Start with the mandatory major.minor.patch part
        let mut version_str = self.base_semver();

        // If there is a pre-release name (e.g., "rc"), include it
        if let Some(ref pre_name) = self.pre_name {
            version_str = format!("{}-{}", version_str, pre_name);
            if let Some(pre_number) = self.pre_number {
                version_str = format!("{}.{}", version_str, pre_number);
            }
        }

        // If there is a number of commits, include it
        if let Some(num_of_commits) = self.num_of_commits {
            version_str = format!("{}-{}", version_str, num_of_commits);
        }

        // If there is a commit SHA, include it with the commit VCS prefix
        if let Some(ref commit_sha) = self.commit_sha {
            if let Some(commit_vcs) = self.commit_vcs {
                version_str = format!("{}-{}{}", version_str, commit_vcs, commit_sha);
            } else {
                version_str = format!("{}-{}", version_str, commit_sha);
            }
        }

        // If version is dirty include it
        if self.is_dirty {
            version_str = format!("{}-dirty", version_str);
        }
        // Write the formatted string to the formatter
        write!(f, "{}", version_str)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn base_semver_omits_suffixes() {
        let version = FloxVersion {
            major: 1,
            minor: 2,
            patch: 3,
            pre_name: Some(PreReleaseName::RC),
            pre_number: Some(1),
            num_of_commits: Some(10),
            commit_vcs: Some('g'),
            commit_sha: Some("b91c3f1".to_string()),
            is_dirty: true,
        };
        assert_eq!(version.base_semver(), "1.2.3");
    }

    #[test]
    fn test_parse_standard_version() {
        let version_str = "1.2.3";
        let version: FloxVersion = version_str.parse().unwrap();
        assert_eq!(version, FloxVersion {
            major: 1,
            minor: 2,
            patch: 3,
            pre_name: None,
            pre_number: None,
            num_of_commits: None,
            commit_vcs: None,
            commit_sha: None,
            is_dirty: false,
        });
        assert_eq!(version.to_string(), version_str);
        assert_eq!(version.partial_cmp(&version), Some(Ordering::Equal));
    }

    #[test]
    fn test_parse_standard_version_dirty() {
        let version_str = "1.2.3-dirty";
        let version: FloxVersion = version_str.parse().unwrap();
        assert_eq!(version, FloxVersion {
            major: 1,
            minor: 2,
            patch: 3,
            pre_name: None,
            pre_number:
```

### Core Architecture Module: `cli/flox-core/src/data/mod.rs`
```
use std::fmt::Display;
pub mod environment_ref;
pub mod flox_version;

pub use crate::canonical_path::{CanonicalPath, CanonicalizeError};
pub type System = String;

/// Different representations of the same attribute path
#[derive(Debug, Clone)]
pub enum AttrPath {
    Parts(Vec<String>),
    Joined(String),
}

impl From<Vec<String>> for AttrPath {
    fn from(value: Vec<String>) -> Self {
        AttrPath::Parts(value)
    }
}

impl From<&str> for AttrPath {
    fn from(value: &str) -> Self {
        AttrPath::Joined(value.to_string())
    }
}

impl From<String> for AttrPath {
    fn from(value: String) -> Self {
        AttrPath::Joined(value)
    }
}

impl From<AttrPath> for String {
    fn from(value: AttrPath) -> Self {
        match value {
            AttrPath::Parts(parts) => parts.join("."),
            AttrPath::Joined(s) => s,
        }
    }
}

impl Display for AttrPath {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        <AttrPath as Into<String>>::into(self.clone()).fmt(f)
    }
}

impl PartialEq for AttrPath {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (Self::Parts(parts_self), Self::Parts(parts_other)) => parts_self == parts_other,
            (Self::Joined(joined_self), Self::Joined(joined_other)) => joined_self == joined_other,
            (Self::Joined(joined), Self::Parts(parts)) => joined == &parts.join("."),
            (Self::Parts(parts), Self::Joined(joined)) => joined == &parts.join("."),
        }
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4741** (2026-09-29): **flox build rejects namespaced catalog packages in runtime-packages with misleading package-group error**
  *Symptoms*: ## Describe the bug  When a namespaced catalog package is listed in `build.<name>.runtime-packages`, `flox build` fails even though the lockfile correctly assigns the package to the `toplevel` group.  ## Steps to reproduce  Given an available catalog package `example-owner/example-tool` (placeholder names), use:  ```toml schema-version = "1.17.0"  [install] example-tool.pkg-path = "example-owner/example-tool"  [build.example] version = "0.0.1" runtime-packages = ["example-tool"] command = """   mkdir -p "$out"   touch "$out/hello" """ ```  Run `flox build`.  ### Actual behavior  The environment build fails with:  ```text ❌ ERROR: package 'example-tool' is not in 'toplevel' pkg-group ```  The corresponding lockfile entry has these fields:  ```json {   "install_id": "example-tool",   "attr_path": "example-tool",   "group": "toplevel" } ```  ### Expected behavior  The build should resolve the runtime dependency by its install ID and recognize that it belongs to `toplevel`.  ## Suspected cause  In `buildenv/builder.pl`, runtime-package validation compares the lockfile's `attr_path` directly with the manifest's `pkg-path`:  ```perl grep { $_->{"attr_path"} eq $install->{$name}{"pkg-path"} } @toplevelPackages ```  For namespaced catalog packages, these values differ: `example-tool` versus `example-owner/example-tool`. The failed comparison produces a misleading group-membership error. Subsequent runtime-package filtering also uses attribute paths.  This logic was confirmed in the i

- **Issue #4659** (2026-09-11): **`flox config -l` omits the computed default for `auto_activate`**
  *Symptoms*: **Describe the bug:**  `flox config -l` omits `auto_activate` when the setting is absent from the configuration files and environment. The effective behavior is the documented default, `prompt`.  The [Flox 1.15 manual](https://github.com/flox/flox/blob/v1.15.0/cli/flox/doc/flox-config.md) says that `flox config` shows "all options with their computed value" and describes `-l` as listing "the current values of all options." Omitting the default makes it difficult for scripts to distinguish the default from an unsupported or unavailable setting.  **Steps to reproduce:**  1. Run Flox with isolated empty user and system configuration:     ```sh    config_dir="$(mktemp -d)"    FLOX_CONFIG_DIR="${config_dir}" FLOX_SYSTEM_CONFIG_DIR="" \        flox config -l | grep '^auto_activate'    ```  2. Explicitly set the value to its default and list the same keys again:     ```sh    FLOX_CONFIG_DIR="${config_dir}" FLOX_SYSTEM_CONFIG_DIR="" \        flox config --set auto_activate prompt    FLOX_CONFIG_DIR="${config_dir}" FLOX_SYSTEM_CONFIG_DIR="" \        flox config -l | grep '^auto_activate'    ```  Result:  ```text # Empty configuration auto_activate_environments = {}  # Explicit prompt value auto_activate = "prompt" auto_activate_environments = {} ```  Expected:  The empty configuration should include the computed default:  ```text auto_activate = "prompt" auto_activate_environments = {} ```  Alternatively, the manual should state that optional settings with defaults are omitted until e
  **Post-Mortem & Fix Analysis**:
  > Thanks for catching this and for the detailed report! Sorry the docs don’t match the current behavior here—we’re fixing that now.  We’re also discussing whether to change how `flox config -l` displays defaults and other configuration values. We don’t want to promise anything just yet, but we agree there’s room to make this clearer and more useful. 

- **Issue #4629** (2026-08-24): **`flox activate --start-services` cannot recover from a stale process-compose socket**
  *Symptoms*: ## Observed behavior  When an activation with `--start-services` is terminated uncleanly (SIGKILL of the process group, power loss — anything that prevents process-compose from removing its unix socket), the socket file is left behind in the cache directory, e.g.:  ``` $XDG_CACHE_HOME/flox/run/flox.ccfa6fbc.sock ```  Every subsequent `flox activate --start-services` for that environment then fails permanently:  ``` ERROR flox_activations::start: failed to stop process-compose err=process-compose down failed:   FTL failed to stop project error="Post \"http://unix/project/stop/\": dial unix …/flox.ccfa6fbc.sock: connect: connection refused" ✘ ERROR: Failed to start services: process-compose socket not ready ```  flox first notices the stale activation state and tries `process-compose down` against the dead socket (connection refused), then attempts to start services and fails with "socket not ready". The cycle never resolves on its own; recovery requires manually deleting the socket file, after which activation succeeds immediately.  Observed with flox 1.14.1 running as a systemd service (a killed service cgroup reproduces it reliably: `systemctl kill -s SIGKILL <unit>` on a unit whose ExecStart is `flox activate --start-services -- flox services logs --follow`, then restart). Without intervention the unit crash-loops indefinitely.  ## Expected behavior  A socket that refuses connections has no live process-compose behind it. After the `down` attempt fails with `ECONNREFUSED`, 

- **Issue #4489** (2026-08-26): **`brew install flox` does not make `flox` binary available on `macos`**
  *Symptoms*: **Describe the bug:**  The `flox` binary is not available after `brew install flox`.  **Installer logs**  ``` brew reinstall flox ==> Would reinstall 1 cask: flox ==> Fetching downloads for: flox ✔︎ Cask flox (1.13.1)                                                                                                                                      Verified     53.2MB/ 53.2MB ==> Uninstalling Cask flox ==> Removing launchctl service org.nixos.darwin-store Password: ==> Removing launchctl service org.nixos.nix-daemon ==> Running uninstall script /usr/local/share/flox/scripts/uninstall Warning: uninstall script /usr/local/share/flox/scripts/uninstall does not exist; skipping. ==> Uninstalling packages with `sudo` (which may request your password)... ==> Purging files for version 1.13.1 of Cask flox ==> Installing Cask flox ==> Running installer for flox with `sudo` (which may request your password)... installer: Package name is Flox installer: Installing at base path / installer: The install was successful. 🍺  flox was successfully installed!  $ flox fish: Unknown command: flox  ```  If on macOS, attach logs for the install from `/var/log/install.log`. That should include everything from the first to the last mention of `com.floxdev.flox`, redacting anything sensitive.  ``` 2026-07-11 10:33:41+02 Mac installer[76672]: Product archive /opt/homebrew/Caskroom/flox/1.13.1/flox-1.13.1.aarch64-darwin.pkg trustLevel=202 2026-07-11 10:33:41+02 Mac installer[76672]: External component 
  **Post-Mortem & Fix Analysis**:
  > @montekki thanks for the report. would like to get some more info from you if possible. for what it's worth, I just ran through installing flox from brew on a vanilla freshly-installed macOS 26 system which seemed to work fine, but wondering if there's something with our packaging that is not playing nice with your setup, and if there are some adaptations we should make to our install process.  would you mind sharing what the value of your `PATH` environment variable is? and additionally, does `/usr/local/bin/flox` exist on your system after installation? wondering if somehow you don't have `/usr/local/bin` on PATH, or if the flox binary is not there for some reason.  thanks in advance!
  > I independently reproduced this with Flox 1.14.0 on Apple Silicon, with Lix 2.94.0 managed by nix-darwin.  This is not a PATH issue:  - `PATH` includes both `/usr/local/bin` and `/opt/homebrew/bin`. - Homebrew reports `flox 1.14.0` as an installed cask. - `/usr/local/bin/flox` and `/opt/homebrew/bin/flox` do not exist. - No Flox macOS package receipt was created.  Inspecting the package choices shows the cause: when existing Nix is detected, the regular `Flox` choice is hidden and unselected, while `flox.take.over` is visible but also unselected. The noninteractive Homebrew installation therefore selects no component, returns success, and records the cask without installing the Flox payload.  This appears to be the same underlying issue as #4083 and is consistent with #3926. The behavior remains present in the 1.14.0 package.
  > @devusb just did an upgrade from `brew`, the `/usr/local/bin/flox` path does not exist, upgrade ended up with an error also:  ``` ==> Upgrading 1 outdated package: flox 1.13.1 -> 1.14.0 ==> Fetching downloads for: flox ✔︎ Cask flox (1.14.0)                                                                                                                                      Downloaded   55.3MB/ 55.3MB ==> Upgrading flox   1.13.1 -> 1.14.0 ==> Removing launchctl service org.nixos.darwin-store Password: ==> Removing launchctl service org.nixos.nix-daemon ==> Running uninstall script /usr/local/share/flox/scripts/uninstall ==> Purging files for version 1.14.0 of Cask flox Error: flox: uninstall script /usr/local/share/flox/scripts/uninstall does not exist.   exa /usr/local/bin/flox "/usr/local/bin/flox": No such file or directory (os error 2)  ```

- **Issue #4458** (2026-07-13): **Activation drops the default search path from INFOPATH**
  *Symptoms*: **Describe the bug:**  If you use emacs, you can use the built-in `info` browser to read the built-in emacs manual. This relies on `INFOPATH` for locating `info` manuals. Launching emacs from within an activated Flox environment removes the default search path, which removes the emacs info manual.  **Background:** The semantics of `INFOPATH` are described in the GNU Info/TexInfo manual here: https://www.gnu.org/software/texinfo/manual/texinfo/html_node/Other-Info-Directories.html  The relevant portion is shown below (emphasis mine):  > However you set INFOPATH, if its last character is a colon (on MS-DOS/MS-Windows systems, use a semicolon instead), this is replaced by the default (compiled-in) path. This gives you a way to augment the default path with new directories without having to list all the standard places. For example (using sh syntax): > > INFOPATH=/home/bob/info: > export INFOPATH > > will search /home/bob/info first, then the standard directories. **Leading or doubled colons are not treated specially.**  Similar to `MANPATH`, a trailing `:` indicates that the contents of `INFOPATH` should be prepended to the default search path. Otherwise, when `INFOPATH` is set, it will be used as the complete search path. _Different_ from `MANPATH`, a leading `:` or a `::` anywhere in `INFOPATH` has no special meaning.  Flox sets `INFOPATH` here with no trailing `:`: https://github.com/flox/flox/blob/66a4c004ac2f1febbd03f07c873df4053e5957b1/assets/environment-interpreter/common
  **Post-Mortem & Fix Analysis**:
  > The fix should preserve the special meaning of an empty `INFOPATH` entry, since a leading or trailing separator includes GNU Info’s compiled-in default directories. A regression test could cover `INFOPATH` being unset, empty, and explicitly extended, confirming that the built-in Emacs manual remains discoverable. 

- **Issue #4336** (2026-06-05): **buildenv: multi-package download failures aggregate to Other and bypass transient retry**
  *Symptoms*: ## Background  When more than one package fails during `realise_lockfile`, `join_realise_results` collapses the errors into `BuildEnvError::Other(...)` (see `buildenv.rs` around line 643). `Other` is not classified as transient, so `materialise_with_retry` never retries the build — even when every underlying failure is a transient `BuildPublishedPackage`.  This means the scenario where retry is most valuable — a network blip that knocks out two or more downloads simultaneously — is exactly the scenario where retry never fires.  ## Reproduction  1. Have an environment with two or more custom-catalog packages. 2. Trigger a condition where both `nix copy` calls fail transiently (e.g., substituter briefly unreachable). 3. Observe: the build fails immediately with `Other(...)` rather than retrying.  ## Proposed fix  Options: - Change `join_realise_results` to propagate a representative transient error (e.g., the first `BuildPublishedPackage`) when all failures are transient, rather than wrapping in `Other`. - Add `BuildEnvError::MultipleDownloadFailures { attempts }` that `is_transient()` can classify correctly.  ## References  - PR #4324 (introduced transient retry; `join_realise_results` aggregation identified as gap) - Forge review: https://github.com/flox/flox/pull/4324#issuecomment-4611944991
  **Post-Mortem & Fix Analysis**:
  > ## Closing — root cause identified; error aggregation and classification no longer needed  After further analysis with @dcarley, the root cause of `materialise_with_retry` failures has been identified: Nix store DB entries can lag behind the filesystem. The correct approach is to call `buildenv.nix` optimistically after a `stat()` pass, then fall back to `nix path-info` only on failure to check path availability. Retry decisions are driven by the post-failure path check, not by error type — so the aggregation behaviour of `join_realise_results` no longer determines whether retries fire.  When multiple packages fail to download, the post-failure `nix path-info` check will detect missing or unregistered paths and trigger a retry regardless of how the errors were aggregated at the `join_realise_results` level. `BuildEnvError::Other` wrapping does not suppress the retry because the retry decision is made by inspecting path state, not by calling `is_transient()`.  Closing as superseded. The

- **Issue #4327** (2026-06-05): **bug(buildenv): race condition causes valid builds to be misclassified as deterministic failures**
  *Symptoms*: ## Summary  `materialise_with_retry` has a race condition that causes a transient Nix DB registration lag to be permanently misclassified as a deterministic build failure. The environment is never retried despite the store path being valid and fully present.  ## Observed in CI  Test: `providers::build::tests::build_can_use_cmake_sandbox_pure`  ``` DEBUG all store paths present per stat(), calling buildenv.nix       attempt=1 MAX_RETRIES=3       paths=[..., "/nix/store/xmyh14d786955sjzgv48ry485sd1fyn6-cmake-4.1.2", ...]  WARN  buildenv.nix failed with all paths confirmed in Nix store — treating as deterministic       error: path '/nix/store/xmyh14d786955sjzgv48ry485sd1fyn6-cmake-4.1.2'              is required, but there is no substituter that can build it       attempt=1 MAX_RETRIES=3 ```  buildenv.nix's `builtins.storePath` checks the **Nix daemon's SQLite database**, not the filesystem. The path was on disk (so `stat()` passed) but had not yet been recorded in the DB (so `builtins.storePath` threw).  ## Race condition sequence  ``` A. cmake store path directory is populated on disk B. stat() succeeds → buildenv.nix is invoked C. builtins.storePath fails: cmake on disk but not yet in Nix DB D. cmake registration completes: path now in Nix DB E. post-failure stat() succeeds (path still on disk) F. nix path-info succeeds (path now in DB — race window has closed) G. code concludes: "all paths confirmed → deterministic" → returns error, no retry ```  The invariant assumed by the
  **Post-Mortem & Fix Analysis**:
  > ## Closing — this issue *is* the root cause; corrected approach addresses it  This issue correctly identifies the core race condition: a store path is on disk (so `stat()` passes) but not yet registered in the Nix daemon's SQLite database (so `builtins.storePath` inside `buildenv.nix` fails), and by the time `nix path-info` runs post-failure the registration has completed, causing the failure to be misclassified as deterministic.  After discussion with @dcarley, this race is the root cause of the broader class of failures that motivated the retry/backoff/classification work in #4302, #4304, #4305, and #4324. The `stat()` + `nix path-info` verification loop introduced in #4282 addresses it, but the current implementation still wraps this in a fixed-count retry loop (`MAX_RETRIES = 3`) and backoff machinery that were designed for a misdiagnosed problem.  The correct approach is to call `buildenv.nix` optimistically after a `stat()` pass on the first attempt, then fall back to `nix path-i

- **Issue #4252** (2026-06-18): **FloxHub onboarding wiki suggests invalid command `flox activate --default`**
  *Symptoms*: **Describe the bug:** The onboarding instructions on FloxHub say to use `flox activate --default -m run`, but this appears to be invalid   <img width="1039" height="390" alt="Image" src="https://github.com/user-attachments/assets/26df7c96-76d4-4bb9-88a6-57f7fd537ee6" />  **Steps to reproduce:** 1. Install Flox on MacOS with nix via `nix profile install  --experimental-features "nix-command flakes" --accept-flake-config 'github:flox/flox/latest'` 2. Create a new environment on hub.flox.dev 3. Run `flox activate --default -m run` as instructed  Result: ``` ✘ ERROR: `--default` is not expected in this context ```  Expected: To be dropped into a dev environment for the default environment   **Flox Version (run `flox --version` if possible):** 1.12.0-gdab5625  **`uname -a` output:** ``` Darwin TheBamagen.local 25.3.0 Darwin Kernel Version 25.3.0: Wed Jan 28 20:54:55 PST 2026; root:xnu-12377.91.3~2/RELEASE_ARM64_T6031 arm64 ``` 
  **Post-Mortem & Fix Analysis**:
  > Thanks for flagging we'll get this fixed
  > Thanks for the report. This isn't a bug — the reason you experienced this is your version was right before we deployed a release that included this flag. Upgrade and `flox activate --default -m run` will work as documented. Closing this out.

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

### Incident Patch 1: `d284f7e0` (2026-10-02)
**Commit Message**: feat(publish): forward the Factory build token to catalog-server (#4722)

`flox publish` now forwards a Factory-supplied build token to
catalog-server, so the Factory can resolve one of its builds to the
catalog row that build produced. The CLI never reads, validates or
interprets the value; it carries it.

This is inert until the Factory sets the variable, so it needs no
feature flag and changes nothing for an ordinary `flox publish`, which
sends no token and produces a byte-identical request to today's.

## What changed

`cli/flox` reads `_FLOX_FACTORY_BUILD_TOKEN` from the environment the
build pod was given, treating unset, empty and non-UTF-8 alike as
absent, and passes the value down. `Publisher::publish` takes it as a
parameter rather than reaching for the environment itself, so the SDK
stays free of process-environment reads and the CLI owns that concern.

The token rides both calls `flox publish` makes: the `check-build`
pre-check and the publish itself. It is optional on both wire models and
omitted when absent.

The publish body's `Debug` rendering blanks the token. The build
coordinator runs publish with `--verbose` and the log filter's `flox`
prefix reaches the SDK, so

**File**: `cli/catalog-api-v1/openapi.json` (modified, +10/-0)
```diff
@@ -2746,6 +2746,11 @@
               "$ref": "#/components/schemas/LockedInputEntry"
             },
             "type": "object"
+          },
+          "factory_build_token": {
+            "title": "Factory Build Token",
+            "nullable": true,
+            "type": "string"
           }
         },
         "type": "object",
@@ -3582,6 +3587,11 @@
               "$ref": "#/components/schemas/LockedInputEntry"
             },
             "type": "object"
+          },
+          "factory_build_token": {
+            "title": "Factory Build Token",
+            "nullable": true,
+            "type": "string"
           }
         },
         "type": "object",
```

**File**: `cli/catalog-api-v1/src/client.rs` (modified, +18/-0)
```diff
@@ -937,6 +937,13 @@ manifest packages were built via the traditional flox manifest workflow.*/
     ///    "system"
     ///  ],
     ///  "properties": {
+    ///    "factory_build_token": {
+    ///      "title": "Factory Build Token",
+    ///      "type": [
+    ///        "string",
+    ///        "null"
+    ///      ]
+    ///    },
     ///    "locked_inputs": {
     ///      "title": "Locked Inputs",
     ///      "type": [
@@ -968,6 +975,8 @@ manifest packages were built via the traditional flox manifest workflow.*/
     /// </details>
     #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug, PartialEq)]
     pub struct CheckBuildRequest {
+        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
+        pub factory_build_token: ::std::option::Option<::std::string::String>,
         #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
         pub locked_inputs: ::std::option::Option<
             ::std::collections::HashMap<::std::string::String, LockedInputEntry>,
@@ -2906,6 +2915,13 @@ catalog) or '<owner>.<pkgset>.*' (package set) — e.g. 'brantley.*'
     ///      "default": ".flox",
     ///      "type": "string"
     ///    },
+    ///    "factory_build_token": {
+    ///      "title": "Factory Build Token",
+    ///      "type": [
+    ///        "string",
+    ///        "null"
+    ///      ]
+    ///    },
     ///    "locked_base_catalog_url": {
     ///      "title": "Locked Base Catalog Url",
     ///      "type": [
@@ -2998,6 +3014,8 @@ catalog) or '<owner>.<pkgset>.*' (package set) — e.g. 'brantley.*'
         #[serde(default = "defaults::package_build_with_nar_info_dot_flox_dir")]
         pub dot_flox_dir: ::std::string::String,
         #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
+        pub factory_build_token: ::std::option::Option<::std::string::String>,
+        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
         pub locked_base_catalog_url: ::std::option::Option<::std::string::String>,
         #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
         pub locked_inputs: ::std::option::Option<
```

**File**: `cli/flox-rust-sdk/src/providers/catalog.rs` (modified, +10/-1)
```diff
@@ -160,13 +160,18 @@ pub struct MockClient {
     // We use a RefCell here so that we don't have to modify the trait to allow mutable access
     // to `self` just to get mock responses out.
     pub mock_responses: MockField<VecDeque<Response>>,
+    /// The body of the most recent [`CatalogClientTrait::publish_build`]
+    /// call, for tests that assert on what a caller actually sent rather
+    /// than just on the canned response.
+    pub last_publish_build_info: MockField<Option<UserBuildPublish>>,
 }
 
 impl MockClient {
     /// Create a new mock client.
     pub fn new() -> Self {
         Self {
             mock_responses: Arc::new(Mutex::new(VecDeque::new())),
+            last_publish_build_info: Arc::new(Mutex::new(None)),
         }
     }
 
@@ -338,8 +343,12 @@ impl CatalogClientTrait for MockClient {
         &self,
         _catalog_name: impl AsRef<str> + Send + Sync,
         _package_name: impl AsRef<str> + Send + Sync,
-        _build_info: &UserBuildPublish,
+        build_info: &UserBuildPublish,
     ) -> Result<(), FloxhubClientError> {
+        *self
+            .last_publish_build_info
+            .lock()
+            .expect("couldn't acquire mock lock") = Some(build_info.clone());
         let mock_resp = self
             .mock_responses
             .lock()
```

**File**: `cli/flox-rust-sdk/src/providers/publish.rs` (modified, +92/-0)
```diff
@@ -135,6 +135,10 @@ pub trait Publisher {
     /// package's expression selects, computed at publish time; empty for
     /// builds that resolve no catalog inputs.
     ///
+    /// `factory_build_token` is forwarded, uninterpreted, from the caller's
+    /// process environment; this trait does not read the environment
+    /// itself.
+    ///
     /// `allow_lineage_change` explicitly authorizes a source change. Otherwise,
     /// `confirm_lineage_change` is called only after a lineage refusal, before
     /// retrying the metadata submission once. Returning `Ok(false)` preserves the
@@ -156,6 +160,7 @@ pub trait Publisher {
         locked_inputs: &BTreeMap<String, LockedInputEntry>,
         key_file: Option<PathBuf>,
         metadata_only: bool,
+        factory_build_token: Option<&str>,
         allow_lineage_change: bool,
         confirm_lineage_change: impl AsyncFnOnce(&SourceLineageChange) -> Result<bool, PublishError>,
     ) -> Result<bool, PublishError>;
@@ -685,6 +690,7 @@ where
         locked_inputs: &BTreeMap<String, LockedInputEntry>,
         key_file: Option<PathBuf>,
         metadata_only: bool,
+        factory_build_token: Option<&str>,
         allow_lineage_change: bool,
         confirm_lineage_change: impl AsyncFnOnce(&SourceLineageChange) -> Result<bool, PublishError>,
     ) -> Result<bool, PublishError> {
@@ -766,8 +772,13 @@ where
                 .to_string_lossy()
                 .into_owned(),
             allow_lineage_change,
+            factory_build_token: factory_build_token.map(str::to_string),
         };
 
+        tracing::debug!(
+            build_info = ?build_info,
+            "Publishing build in catalog...",
+        );
         publish_build_with_confirmation(
             client,
             catalog_name,
@@ -2043,6 +2054,7 @@ pub mod tests {
                 &BTreeMap::new(),
                 None,
                 false,
+                None,
                 false,
                 async |_| Ok(false),
             )
@@ -2057,6 +2069,79 @@ pub mod tests {
         );
     }
 
+    /// The caller's `factory_build_token` argument — the CLI's forwarded
+    /// process-environment value — reaches the `UserBuildPublish` body sent
+    /// to `publish_build`, uninterpreted.
+    #[tokio::test]
+    async fn publish_forwards_factory_build_token_to_request_body() {
+        let (mut flox, _temp_dir_handle) = flox_instance();
+        let (_tempdir_handle, _remote_repo, remote_uri) = example_git_remote_repo();
+        let (env, _build_repo) = example_path_environment(&flox, Some(&remote_uri));
+
+        set_test_auth(&mut flox, "test");
+        let catalog_name = "test".to_string();
+
+        let env_metadata = check_environment_metadata(&flox, &env).unwrap();
+        let package_metadata = check_package_metadata(
+            Some(&mock_base_catalog_url()),
+            env_metadata.toplevel_catalog_ref.as_ref(),
+            EXAMPLE_MANIFEST_PACKAGE_TARGET.clone(),
+        )
+        .unwrap();
+
+        let build_metadata = check_build_metadata(
+            &flox,
+            env_metadata.toplevel_catalog_ref.as_ref().unwrap(),
+            None,
+            &env_metadata,
+            &package_metadata.package,
+            None,
+        )
+        .unwrap();
+
+        let auth = NixAuth::from_flox(&flox).unwrap();
+        let publish_provider = PublishProvider::new(env_metadata, package_metadata, auth);
+
+        let mut catalog = MockClient::new();
+        reset_mocks(&mut catalog, vec![
+            Response::CreatePackage,
+            Response::Publish(PublishResponse {
+                ingress_uri: None,
+                ingress_auth: None,
+                catalog_store_config: CatalogStoreConfig::MetaOnly,
+            }),
+            Response::PublishBuild,
+        ]);
+
+        let package_created = publish_provider
+            .create_package_and_possibly_user_catalog(&catalog, &catalog_name)
+            .await
+            .unwrap();
+        publish_provider
+            .publish(
+                &catalog,
+                &catalog_name,
+                package_created,
+                &build_metadata,
+                &BTreeMap::new(),
+                None,
+                false,
+                Some("factory:abc123"),
+                false,
+                async |_| Ok(false),
+            )
+            .await
+            .expect("expected publish to succeed");
+
+        let sent = catalog
+            .last_publish_build_info
+            .lock()
+            .expect("couldn't acquire mock lock")
+            .clone()
+            .expect("publish_build was called");
+        assert_eq!(sent.factory_build_token, Some("factory:abc123".to_string()));
+    }
+
     #[test]
     fn metadata_only_collects_narinfos_from_local_store() {
         let (flox, _temp_dir_handle) = flox_instance();
@@ -2319,6 +2404,7 @@ pub mod tests {
                 &BTreeMap::new(),
                 None,
                 fal
```

**File**: `cli/flox/src/commands/publish.rs` (modified, +57/-0)
```diff
@@ -104,6 +104,33 @@ async fn confirm_lineage_change(change: &SourceLineageChange) -> Result<bool, Pu
     Ok(true)
 }
 
+/// Carries the Factory's per-build token into the build pod. Read by
+/// [`factory_build_token_from_env`] and forwarded, unread, on the two
+/// catalog-server calls `flox publish` makes.
+const FACTORY_BUILD_TOKEN_VAR: &str = "_FLOX_FACTORY_BUILD_TOKEN";
+
+/// Read the Factory build token from the process environment.
+///
+/// Called once per publish and threaded to the call sites that need it
+/// (the dedup check and the publish body) rather than re-read. Unset,
+/// empty, and non-UTF-8 all mean absent, and absent means the field is
+/// omitted from both request bodies `flox publish` sends. The value is
+/// opaque and never parsed, validated, or checked for a prefix. It is
+/// not a credential either: it authenticates nothing and only names
+/// which build a publish belongs to, so it is logged as-is.
+fn factory_build_token_from_env() -> Option<String> {
+    let token = std::env::var(FACTORY_BUILD_TOKEN_VAR)
+        .ok()
+        .filter(|s| !s.is_empty());
+    if let Some(value) = token.as_deref() {
+        tracing::info!(
+            factory_build_token = value,
+            "forwarding Factory build token"
+        );
+    }
+    token
+}
+
 /// Outcome of the dedup pre-check against the catalog.
 #[derive(Debug)]
 enum DedupOutcome {
@@ -491,6 +518,10 @@ impl Publish {
             })?),
             None => PackageSystem::from_str(&flox.system).ok(),
         };
+        // Read once and forwarded, unread, on every catalog-server call this
+        // publish makes.
+        let factory_build_token = factory_build_token_from_env();
+
         // Explicit source replacement must reach publish even for an existing build.
         if let Some(system) = dedup_system
             && !publish_config.allow_lineage_change
@@ -504,6 +535,7 @@ impl Publish {
                 nixpkgs_rev,
                 system,
                 locked_inputs: &locked_inputs_query,
+                factory_build_token: factory_build_token.as_deref(),
             };
             if dedup_short_circuit(&flox.floxhub_client, query).await {
                 return Ok(());
@@ -540,6 +572,7 @@ impl Publish {
                 &locked_inputs,
                 key_file,
                 publish_config.metadata_only,
+                factory_build_token.as_deref(),
                 publish_config.allow_lineage_change,
                 confirm_lineage_change,
             )
@@ -788,4 +821,28 @@ mod tests {
             DedupOutcome::CheckFailed(_)
         ));
     }
+
+    #[test]
+    fn factory_build_token_from_env_unset_gives_none() {
+        temp_env::with_var(FACTORY_BUILD_TOKEN_VAR, None::<&str>, || {
+            assert_eq!(factory_build_token_from_env(), None);
+        });
+    }
+
+    #[test]
+    fn factory_build_token_from_env_empty_gives_none() {
+        temp_env::with_var(FACTORY_BUILD_TOKEN_VAR, Some(""), || {
+            assert_eq!(factory_build_token_from_env(), None);
+        });
+    }
+
+    #[test]
+    fn factory_build_token_from_env_set_gives_some() {
+        temp_env::with_var(FACTORY_BUILD_TOKEN_VAR, Some("factory:abc123"), || {
+            assert_eq!(
+                factory_build_token_from_env(),
+                Some("factory:abc123".to_string())
+            );
+        });
+    }
 }
```

**File**: `cli/floxhub-client/src/client.rs` (modified, +84/-0)
```diff
@@ -198,6 +198,10 @@ pub struct CheckBuildQuery<'a> {
     pub nixpkgs_rev: &'a str,
     pub system: api_types::PackageSystem,
     pub locked_inputs: &'a HashMap<String, api_types::LockedInputEntry>,
+    /// Forwarded, uninterpreted, from the caller's process environment.
+    /// `None` for an ordinary `flox publish`, which is the normal case
+    /// rather than a gap.
+    pub factory_build_token: Option<&'a str>,
 }
 
 /// The complete catalog API interface.
@@ -735,6 +739,7 @@ impl CatalogClientTrait for FloxhubClient {
         let catalog = str_to_catalog_name(query.catalog_name)?;
         let package = str_to_package_name(query.package_name)?;
         let body = api_types::CheckBuildRequest {
+            factory_build_token: query.factory_build_token.map(str::to_string),
             source_url: query.source_url.to_string(),
             source_rev: query.source_rev.to_string(),
             nixpkgs_rev: query.nixpkgs_rev.to_string(),
@@ -1640,6 +1645,7 @@ pub mod tests {
                 nixpkgs_rev: "cafebabe",
                 system: api_types::PackageSystem::X8664Linux,
                 locked_inputs: &locked_inputs,
+                factory_build_token: None,
             })
             .await;
 
@@ -1678,6 +1684,7 @@ pub mod tests {
                 nixpkgs_rev: "cafebabe",
                 system: api_types::PackageSystem::X8664Linux,
                 locked_inputs: &HashMap::new(),
+                factory_build_token: None,
             })
             .await;
 
@@ -1716,6 +1723,7 @@ pub mod tests {
                 nixpkgs_rev: "cafebabe",
                 system: api_types::PackageSystem::X8664Linux,
                 locked_inputs: &HashMap::new(),
+                factory_build_token: None,
             })
             .await;
 
@@ -1751,10 +1759,86 @@ pub mod tests {
                 nixpkgs_rev: "cafebabe",
                 system: api_types::PackageSystem::X8664Linux,
                 locked_inputs: &HashMap::new(),
+                factory_build_token: None,
             })
             .await;
 
         mock.assert();
         assert!(result.is_err(), "expected Err from 5xx, got: {result:?}");
     }
+
+    // ---------------------------------------------------------------------------
+    // factory_build_token: forwarded uninterpreted on check-build and
+    // publish, omitted rather than sent null when absent.
+    // ---------------------------------------------------------------------------
+
+    const PUBLISH_PATH: &str = "/api/v1/catalog/catalogs/myorg/packages/mypkg/builds";
+
+    /// A structurally valid [`UserBuildPublish`] for wire-shape tests. Every
+    /// field but `factory_build_token` is an arbitrary value satisfying the
+    /// schema.
+    fn minimal_build_info(factory_build_token: Option<&str>) -> UserBuildPublish {
+        use catalog_api_v1::types as api_types;
+
+        UserBuildPublish {
+            allow_lineage_change: false,
+            base_catalog_rev_count: None,
+            base_catalog_rev_date: None,
+            build_type: None,
+            cache_uri: None,
+            derivation: api_types::PackageDerivation {
+                broken: None,
+                description: None,
+                drv_path: "/nix/store/deadbeef-mypkg".to_string(),
+                license: None,
+                licenses: None,
+                name: "mypkg".to_string(),
+                outputs: api_types::PackageOutputs(vec![]),
+                outputs_to_install: None,
+                pname: None,
+                system: api_types::PackageSystem::X8664Linux,
+                unfree: None,
+                version: None,
+            },
+            dot_flox_dir: ".flox".to_string(),
+            factory_build_token: factory_build_token.map(str::to_string),
+            locked_base_catalog_url: None,
+            locked_inputs: None,
+            narinfos: None,
+            narinfos_source_url: None,
+            narinfos_source_version: None,
+            ref_: None,
+            rev: "deadbeef".to_string(),
+            rev_count: 1,
+            rev_date: chrono::Utc::now(),
+            url: "https://example.com/repo".to_string(),
+        }
+    }
+
+    /// A token on the build info is forwarded, uninterpreted, on the
+    /// publish request body. The check-build endpoint takes the same
+    /// `Option<String>` field through the same generated
+    /// `skip_serializing_if`, so one endpoint proving inclusion on the
+    /// wire covers both; omission is proven separately by the four
+    /// existing publish cassettes replaying byte-identical.
+    #[tokio::test]
+    async fn publish_build_includes_factory_build_token_when_present() {
+        let server = MockServer::start_async().await;
+        let mock = server.mock(|when, then| {
+            when.method("POST")
+                .path(PUBLISH_PATH)
+                .json_body_includes(json!({ "factory_build_token": "factory:abc123" }).to_string());
+            then.status(200).j
```

---

### Incident Patch 2: `5561e544` (2026-10-02)
**Commit Message**: refactor(publish): stop redacting the Factory build token

The token authenticates nothing and grants no access. It names which
build a publish belongs to, and the worst a holder can do with one is
make a single build record point at the wrong package, which also needs
write access to that catalog. Treating it as a secret bought a clone on
every publish, a redacting copy of the request body, and two comments
that contradicted each other on when the dump is even emitted.

The body is logged as it is sent. The presence flag is gone, and the
value is logged at info! rather than its presence, so an unlinked build
can be diagnosed at the verbosity the coordinator already runs.

Refs: https://linear.app/floxdotdev/issue/ECO-288

Forge-Agent: forge-design (3d0b8930)
Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Fv8w3F3iGsMFjZjW1oJDKR

**File**: `cli/flox-rust-sdk/src/providers/publish.rs` (modified, +1/-11)
```diff
@@ -775,18 +775,8 @@ where
             factory_build_token: factory_build_token.map(str::to_string),
         };
 
-        // The Factory token is a capability: whoever reads it can claim a
-        // build's catalog association. `flox publish` runs inside the
-        // build pod and its stderr is the log the coordinator serves at
-        // GET /builds/{id}/logs, so this dump carries whether a token was
-        // sent, never its value.
-        let logged_build_info = UserBuildPublish {
-            factory_build_token: None,
-            ..build_info.clone()
-        };
         tracing::debug!(
-            build_info = ?logged_build_info,
-            factory_build_token_present = build_info.factory_build_token.is_some(),
+            build_info = ?build_info,
             "Publishing build in catalog...",
         );
         publish_build_with_confirmation(
```

**File**: `cli/flox/src/commands/publish.rs` (modified, +8/-8)
```diff
@@ -115,18 +115,18 @@ const FACTORY_BUILD_TOKEN_VAR: &str = "_FLOX_FACTORY_BUILD_TOKEN";
 /// (the dedup check and the publish body) rather than re-read. Unset,
 /// empty, and non-UTF-8 all mean absent, and absent means the field is
 /// omitted from both request bodies `flox publish` sends. The value is
-/// opaque: it is never parsed, validated, or checked for a prefix.
-///
-/// Logs presence, never the value, at `info!`. The Factory runs `flox
-/// publish` at a fixed verbosity that filters out `debug!`, so this is
-/// the only level an investigator diagnosing an unlinked build can rely
-/// on.
+/// opaque and never parsed, validated, or checked for a prefix. It is
+/// not a credential either: it authenticates nothing and only names
+/// which build a publish belongs to, so it is logged as-is.
 fn factory_build_token_from_env() -> Option<String> {
     let token = std::env::var(FACTORY_BUILD_TOKEN_VAR)
         .ok()
         .filter(|s| !s.is_empty());
-    if token.is_some() {
-        tracing::info!("forwarding Factory build token");
+    if let Some(value) = token.as_deref() {
+        tracing::info!(
+            factory_build_token = value,
+            "forwarding Factory build token"
+        );
     }
     token
 }
```

---

### Incident Patch 3: `15bce5da` (2026-09-21)
**Commit Message**: feat(publish): move factory-build-token reading to cli/flox

Reading process env to populate a request field belongs to the
CLI, not to floxhub-client, a wire client. Move
factory_build_token_from_env() there; Publisher::publish now takes
the token as a parameter instead of reading the environment
itself. CheckBuildQuery.factory_build_token stays a plain
wire-struct field callers supply.

Drop the two httpmock tests that only proved generated
skip_serializing_if omits None -- the publish cassettes already
prove that by replaying byte-identical. Keep one wire-level
inclusion test; the other endpoint carries the same field through
the same skip_serializing_if, so a second test added no coverage.
Add one test per layer instead: env-var collapsing in cli/flox
(temp_env), and the parameter reaching the request body in
flox-rust-sdk (a MockClient capture).

Restore openapi.json to origin/main and add only the
factory_build_token fields -- the prior regen copied floxhub's
full schema, pulling in unrelated upstream changes and their
collateral fixes.

TDD: RED-GREEN-REFACTOR for both new tests.

Refs: ECO-288
Forge-Agent: implementation-worker (c009aa52)
Co-Authored-By: Claude Opus 5 (1M c

**File**: `cli/catalog-api-v1/openapi.json` (modified, +69/-8)
```diff
@@ -160,6 +160,7 @@
             "required": false,
             "schema": {
               "type": "integer",
+              "minimum": 0,
               "default": 0,
               "title": "Page"
             }
@@ -170,6 +171,7 @@
             "required": false,
             "schema": {
               "type": "integer",
+              "minimum": 0,
               "default": 10,
               "title": "Pagesize"
             }
@@ -350,7 +352,7 @@
           "build-inputs"
         ],
         "summary": "Lookup",
-        "description": "Resolve build inputs for one or more reference groups.\n\nDirect references resolve to latest; the transitive closure is taken\nverbatim; a cross-reference conflict yields a per-group conflict result.\n\nFor each group, walks the transitive package_inputs closure (accessor),\nthen applies auth redaction and assembles the flat LockedInputs map.\n\nEach group runs in its own transaction so a single group's timeout,\noverflow, or conflict produces a per-group error without affecting others.",
+        "description": "Resolve each reference group's transitive build-input closure.\n\nEvery package name resolves independently to its latest build at the\nreference point. Unreadable dependencies remain opaque boundary leaves.\nTimeout, overflow, and cycle failures affect only their own group.",
         "operationId": "lookup_api_v1_catalog_build_inputs_lookup_post",
         "requestBody": {
           "content": {
@@ -1782,6 +1784,37 @@
         }
       }
     },
+    "/api/v1/catalog/info/systems": {
+      "get": {
+        "tags": [
+          "info"
+        ],
+        "summary": "List registered systems",
+        "operationId": "getSystems_api_v1_catalog_info_systems_get",
+        "responses": {
+          "200": {
+            "description": "The names of every system registered in the catalog, sorted by name",
+            "content": {
+              "application/json": {
+                "schema": {
+                  "$ref": "#/components/schemas/SystemsResult"
+                }
+              }
+            }
+          },
+          "422": {
+            "description": "The request could not be processed",
+            "content": {
+              "application/json": {
+                "schema": {
+                  "$ref": "#/components/schemas/ErrorResponse"
+                }
+              }
+            }
+          }
+        }
+      }
+    },
     "/api/v1/catalog/info/published-catalogs": {
       "get": {
         "tags": [
@@ -2271,9 +2304,11 @@
       "BuildInputsLookupRequest": {
         "properties": {
           "stability": {
-            "type": "string",
-            "minLength": 1,
-            "title": "Stability"
+            "title": "Stability",
+            "description": "Accepted and ignored; not used by this endpoint. Deprecated.",
+            "deprecated": true,
+            "nullable": true,
+            "type": "string"
           },
           "reference_point": {
             "nullable": true,
@@ -2294,11 +2329,10 @@
         },
         "type": "object",
         "required": [
-          "stability",
           "groups"
         ],
         "title": "BuildInputsLookupRequest",
-        "description": "Request body for the /build-inputs/lookup endpoint.\n\nA lookup names a `stability` (required) and one or more `groups` of\nreferences to resolve, optionally anchored at a `reference_point`.  It is\nsystem-independent \u2014 the response is source revs + DAG edges, which carry\nno system \u2014 so the request body has no system field."
+        "description": "Request body for the /build-inputs/lookup endpoint.\n\nA lookup names one or more `groups` of references to resolve, optionally\nanchored at a `reference_point`.\n\nThe response is source revisions plus DAG edges: for each reference, the\nlatest revision of its own source together with the transitive non-base\nsources that revision was built against.  That answer carries no system\nand no nixpkgs base revision, so the request body names neither.  A base\nrevision is selected at build time, against which the same lock may be\nbuilt repeatedly."
       },
       "BuildInputsLookupResponse": {
         "properties": {
@@ -3084,7 +3118,7 @@
           "locked_inputs_hash"
         ],
         "title": "LockedInputEntry",
-        "description": "A single entry in the flat locked-inputs map.\n\nOne type, two directions (intentionally NOT split into two models \u2014 the\npublish entry is the same entity with its edges not yet stated):\n\n- Publish request: the CLI sends {catalog, attr_path, build_type, source,\n  locked_inputs_hash} and leaves inputs null.  Null here means \"not stated\n  \u2014 the server is authoritative for the DAG\": the CLI knows its direct\n  inputs but is not the source of truth, and the server reconstructs the\n  DAG from package_inputs (keyed by locked_inputs_hash).\n- Lookup response: all fields are present and inputs is populated with the\n  full tran
```

**File**: `cli/catalog-api-v1/src/client.rs` (modified, +92/-140)
```diff
@@ -86,21 +86,25 @@ pub mod types {
     }
     /**Request body for the /build-inputs/lookup endpoint.
 
-A lookup names a `stability` (required) and one or more `groups` of
-references to resolve, optionally anchored at a `reference_point`.  It is
-system-independent — the response is source revs + DAG edges, which carry
-no system — so the request body has no system field.*/
+A lookup names one or more `groups` of references to resolve, optionally
+anchored at a `reference_point`.
+
+The response is source revisions plus DAG edges: for each reference, the
+latest revision of its own source together with the transitive non-base
+sources that revision was built against.  That answer carries no system
+and no nixpkgs base revision, so the request body names neither.  A base
+revision is selected at build time, against which the same lock may be
+built repeatedly.*/
     ///
     /// <details><summary>JSON schema</summary>
     ///
     /// ```json
     ///{
     ///  "title": "BuildInputsLookupRequest",
-    ///  "description": "Request body for the /build-inputs/lookup endpoint.\n\nA lookup names a `stability` (required) and one or more `groups` of\nreferences to resolve, optionally anchored at a `reference_point`.  It is\nsystem-independent — the response is source revs + DAG edges, which carry\nno system — so the request body has no system field.",
+    ///  "description": "Request body for the /build-inputs/lookup endpoint.\n\nA lookup names one or more `groups` of references to resolve, optionally\nanchored at a `reference_point`.\n\nThe response is source revisions plus DAG edges: for each reference, the\nlatest revision of its own source together with the transitive non-base\nsources that revision was built against.  That answer carries no system\nand no nixpkgs base revision, so the request body names neither.  A base\nrevision is selected at build time, against which the same lock may be\nbuilt repeatedly.",
     ///  "type": "object",
     ///  "required": [
-    ///    "groups",
-    ///    "stability"
+    ///    "groups"
     ///  ],
     ///  "properties": {
     ///    "groups": {
@@ -127,8 +131,12 @@ no system — so the request body has no system field.*/
     ///    },
     ///    "stability": {
     ///      "title": "Stability",
-    ///      "type": "string",
-    ///      "minLength": 1
+    ///      "description": "Accepted and ignored; not used by this endpoint. Deprecated.",
+    ///      "deprecated": true,
+    ///      "type": [
+    ///        "string",
+    ///        "null"
+    ///      ]
     ///    }
     ///  }
     ///}
@@ -139,7 +147,9 @@ no system — so the request body has no system field.*/
         pub groups: ::std::vec::Vec<LookupGroup>,
         #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
         pub reference_point: ::std::option::Option<ReferencePoint>,
-        pub stability: Stability,
+        ///Accepted and ignored; not used by this endpoint. Deprecated.
+        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
+        pub stability: ::std::option::Option<::std::string::String>,
     }
     impl ::std::convert::From<&BuildInputsLookupRequest> for BuildInputsLookupRequest {
         fn from(value: &BuildInputsLookupRequest) -> Self {
@@ -1726,50 +1736,24 @@ values, not the serialized form.*/
             value.clone()
         }
     }
-    /**A single entry in the flat locked-inputs map.
-
-One type, two directions (intentionally NOT split into two models — the
-publish entry is the same entity with its edges not yet stated):
-
-- Publish request: the CLI sends {catalog, attr_path, build_type, source,
-  locked_inputs_hash} and leaves inputs null.  Null here means "not stated
-  — the server is authoritative for the DAG": the CLI knows its direct
-  inputs but is not the source of truth, and the server reconstructs the
-  DAG from package_inputs (keyed by locked_inputs_hash).
-- Lookup response: all fields are present and inputs is populated with the
-  full transitive-closure DAG.
-
-inputs uses the tri-state SBOM convention in both directions:
-  inputs: [k, ...]  — known direct inputs (by key)
-  inputs: []        — explicitly no dependencies
-  inputs null       — not stated (server is authoritative for the DAG)
-
-attr_path is a list of components, e.g. ["python3Packages", "boolex"].
-A flat catalog entry collapses what the CLI lockfile represents as a
-hierarchy of single-component package-set / package nodes.  Giving the
-CLI the components lets it re-expand that hierarchy.  A list is also
-unambiguous: if nested-dot component support is ever added (AI-267),
-the list form remains the unambiguous carrier.
-
-locked_inputs_hash is REQUIRED on every entry: the closure identity hash is
-the round-trip disambiguator that pins which recorded build a locked input
-refers to (lookup response → CLI → publish request).  A publish request
-missing it fails validation (422) at this contract boundary — there i
```

**File**: `cli/flox-rust-sdk/src/providers/catalog.rs` (modified, +10/-1)
```diff
@@ -160,13 +160,18 @@ pub struct MockClient {
     // We use a RefCell here so that we don't have to modify the trait to allow mutable access
     // to `self` just to get mock responses out.
     pub mock_responses: MockField<VecDeque<Response>>,
+    /// The body of the most recent [`CatalogClientTrait::publish_build`]
+    /// call, for tests that assert on what a caller actually sent rather
+    /// than just on the canned response.
+    pub last_publish_build_info: MockField<Option<UserBuildPublish>>,
 }
 
 impl MockClient {
     /// Create a new mock client.
     pub fn new() -> Self {
         Self {
             mock_responses: Arc::new(Mutex::new(VecDeque::new())),
+            last_publish_build_info: Arc::new(Mutex::new(None)),
         }
     }
 
@@ -338,8 +343,12 @@ impl CatalogClientTrait for MockClient {
         &self,
         _catalog_name: impl AsRef<str> + Send + Sync,
         _package_name: impl AsRef<str> + Send + Sync,
-        _build_info: &UserBuildPublish,
+        build_info: &UserBuildPublish,
     ) -> Result<(), FloxhubClientError> {
+        *self
+            .last_publish_build_info
+            .lock()
+            .expect("couldn't acquire mock lock") = Some(build_info.clone());
         let mock_resp = self
             .mock_responses
             .lock()
```

**File**: `cli/flox-rust-sdk/src/providers/publish.rs` (modified, +88/-2)
```diff
@@ -23,7 +23,6 @@ use floxhub_client::{
     SourceLineageChange,
     UserBuildPublish,
     UserDerivationInfo,
-    factory_build_token_from_env,
 };
 use git_url_parse::GitUrl;
 use indexmap::IndexSet;
@@ -136,6 +135,10 @@ pub trait Publisher {
     /// package's expression selects, computed at publish time; empty for
     /// builds that resolve no catalog inputs.
     ///
+    /// `factory_build_token` is forwarded, uninterpreted, from the caller's
+    /// process environment; this trait does not read the environment
+    /// itself.
+    ///
     /// `allow_lineage_change` explicitly authorizes a source change. Otherwise,
     /// `confirm_lineage_change` is called only after a lineage refusal, before
     /// retrying the metadata submission once. Returning `Ok(false)` preserves the
@@ -157,6 +160,7 @@ pub trait Publisher {
         locked_inputs: &BTreeMap<String, LockedInputEntry>,
         key_file: Option<PathBuf>,
         metadata_only: bool,
+        factory_build_token: Option<&str>,
         allow_lineage_change: bool,
         confirm_lineage_change: impl AsyncFnOnce(&SourceLineageChange) -> Result<bool, PublishError>,
     ) -> Result<bool, PublishError>;
@@ -686,6 +690,7 @@ where
         locked_inputs: &BTreeMap<String, LockedInputEntry>,
         key_file: Option<PathBuf>,
         metadata_only: bool,
+        factory_build_token: Option<&str>,
         allow_lineage_change: bool,
         confirm_lineage_change: impl AsyncFnOnce(&SourceLineageChange) -> Result<bool, PublishError>,
     ) -> Result<bool, PublishError> {
@@ -767,7 +772,7 @@ where
                 .to_string_lossy()
                 .into_owned(),
             allow_lineage_change,
-            factory_build_token: factory_build_token_from_env(),
+            factory_build_token: factory_build_token.map(str::to_string),
         };
 
         // The Factory token is a capability: whoever reads it can claim a
@@ -2059,6 +2064,7 @@ pub mod tests {
                 &BTreeMap::new(),
                 None,
                 false,
+                None,
                 false,
                 async |_| Ok(false),
             )
@@ -2073,6 +2079,79 @@ pub mod tests {
         );
     }
 
+    /// The caller's `factory_build_token` argument — the CLI's forwarded
+    /// process-environment value — reaches the `UserBuildPublish` body sent
+    /// to `publish_build`, uninterpreted.
+    #[tokio::test]
+    async fn publish_forwards_factory_build_token_to_request_body() {
+        let (mut flox, _temp_dir_handle) = flox_instance();
+        let (_tempdir_handle, _remote_repo, remote_uri) = example_git_remote_repo();
+        let (env, _build_repo) = example_path_environment(&flox, Some(&remote_uri));
+
+        set_test_auth(&mut flox, "test");
+        let catalog_name = "test".to_string();
+
+        let env_metadata = check_environment_metadata(&flox, &env).unwrap();
+        let package_metadata = check_package_metadata(
+            Some(&mock_base_catalog_url()),
+            env_metadata.toplevel_catalog_ref.as_ref(),
+            EXAMPLE_MANIFEST_PACKAGE_TARGET.clone(),
+        )
+        .unwrap();
+
+        let build_metadata = check_build_metadata(
+            &flox,
+            env_metadata.toplevel_catalog_ref.as_ref().unwrap(),
+            None,
+            &env_metadata,
+            &package_metadata.package,
+            None,
+        )
+        .unwrap();
+
+        let auth = NixAuth::from_flox(&flox).unwrap();
+        let publish_provider = PublishProvider::new(env_metadata, package_metadata, auth);
+
+        let mut catalog = MockClient::new();
+        reset_mocks(&mut catalog, vec![
+            Response::CreatePackage,
+            Response::Publish(PublishResponse {
+                ingress_uri: None,
+                ingress_auth: None,
+                catalog_store_config: CatalogStoreConfig::MetaOnly,
+            }),
+            Response::PublishBuild,
+        ]);
+
+        let package_created = publish_provider
+            .create_package_and_possibly_user_catalog(&catalog, &catalog_name)
+            .await
+            .unwrap();
+        publish_provider
+            .publish(
+                &catalog,
+                &catalog_name,
+                package_created,
+                &build_metadata,
+                &BTreeMap::new(),
+                None,
+                false,
+                Some("factory:abc123"),
+                false,
+                async |_| Ok(false),
+            )
+            .await
+            .expect("expected publish to succeed");
+
+        let sent = catalog
+            .last_publish_build_info
+            .lock()
+            .expect("couldn't acquire mock lock")
+            .clone()
+            .expect("publish_build was called");
+        assert_eq!(sent.factory_build_token, Some("factory:abc123".to_string()));
+    }
+
     #[test]
     fn metadata_only_collects_narinfos_from_local_store() {
         let (flox, _temp_dir_handle) = 
```

**File**: `cli/flox/src/commands/publish.rs` (modified, +56/-2)
```diff
@@ -34,7 +34,6 @@ use floxhub_client::{
     LockedInputEntry,
     PackageSystem,
     SourceLineageChange,
-    factory_build_token_from_env,
 };
 use indoc::formatdoc;
 use nef_lock_catalog::{CatalogRef, NixFlakeref, scan_package};
@@ -105,6 +104,33 @@ async fn confirm_lineage_change(change: &SourceLineageChange) -> Result<bool, Pu
     Ok(true)
 }
 
+/// Carries the Factory's per-build token into the build pod. Read by
+/// [`factory_build_token_from_env`] and forwarded, unread, on the two
+/// catalog-server calls `flox publish` makes.
+const FACTORY_BUILD_TOKEN_VAR: &str = "_FLOX_FACTORY_BUILD_TOKEN";
+
+/// Read the Factory build token from the process environment.
+///
+/// Called once per publish and threaded to the call sites that need it
+/// (the dedup check and the publish body) rather than re-read. Unset,
+/// empty, and non-UTF-8 all mean absent, and absent means the field is
+/// omitted from both request bodies `flox publish` sends. The value is
+/// opaque: it is never parsed, validated, or checked for a prefix.
+///
+/// Logs presence, never the value, at `info!`. The Factory runs `flox
+/// publish` at a fixed verbosity that filters out `debug!`, so this is
+/// the only level an investigator diagnosing an unlinked build can rely
+/// on.
+fn factory_build_token_from_env() -> Option<String> {
+    let token = std::env::var(FACTORY_BUILD_TOKEN_VAR)
+        .ok()
+        .filter(|s| !s.is_empty());
+    if token.is_some() {
+        tracing::info!("forwarding Factory build token");
+    }
+    token
+}
+
 /// Outcome of the dedup pre-check against the catalog.
 #[derive(Debug)]
 enum DedupOutcome {
@@ -492,12 +518,15 @@ impl Publish {
             })?),
             None => PackageSystem::from_str(&flox.system).ok(),
         };
+        // Read once and forwarded, unread, on every catalog-server call this
+        // publish makes.
+        let factory_build_token = factory_build_token_from_env();
+
         // Explicit source replacement must reach publish even for an existing build.
         if let Some(system) = dedup_system
             && !publish_config.allow_lineage_change
         {
             let locked_inputs_query: HashMap<_, _> = locked_inputs.clone().into_iter().collect();
-            let factory_build_token = factory_build_token_from_env();
             let query = CheckBuildQuery {
                 catalog_name: &catalog_name,
                 package_name: publish_provider.package_metadata.package.name().as_ref(),
@@ -543,6 +572,7 @@ impl Publish {
                 &locked_inputs,
                 key_file,
                 publish_config.metadata_only,
+                factory_build_token.as_deref(),
                 publish_config.allow_lineage_change,
                 confirm_lineage_change,
             )
@@ -791,4 +821,28 @@ mod tests {
             DedupOutcome::CheckFailed(_)
         ));
     }
+
+    #[test]
+    fn factory_build_token_from_env_unset_gives_none() {
+        temp_env::with_var(FACTORY_BUILD_TOKEN_VAR, None::<&str>, || {
+            assert_eq!(factory_build_token_from_env(), None);
+        });
+    }
+
+    #[test]
+    fn factory_build_token_from_env_empty_gives_none() {
+        temp_env::with_var(FACTORY_BUILD_TOKEN_VAR, Some(""), || {
+            assert_eq!(factory_build_token_from_env(), None);
+        });
+    }
+
+    #[test]
+    fn factory_build_token_from_env_set_gives_some() {
+        temp_env::with_var(FACTORY_BUILD_TOKEN_VAR, Some("factory:abc123"), || {
+            assert_eq!(
+                factory_build_token_from_env(),
+                Some("factory:abc123".to_string())
+            );
+        });
+    }
 }
```

**File**: `cli/floxhub-client/src/client.rs` (modified, +12/-123)
```diff
@@ -198,36 +198,12 @@ pub struct CheckBuildQuery<'a> {
     pub nixpkgs_rev: &'a str,
     pub system: api_types::PackageSystem,
     pub locked_inputs: &'a HashMap<String, api_types::LockedInputEntry>,
-    /// Forwarded, uninterpreted, from
-    /// [`factory_build_token_from_env`]. `None` for an ordinary
-    /// `flox publish`, which is the normal case rather than a
-    /// gap.
+    /// Forwarded, uninterpreted, from the caller's process environment.
+    /// `None` for an ordinary `flox publish`, which is the normal case
+    /// rather than a gap.
     pub factory_build_token: Option<&'a str>,
 }
 
-/// Read the Factory build token from the process environment.
-///
-/// Unset, empty, and non-UTF-8 all mean absent, and absent means the
-/// field is omitted from both request bodies this crate sends. The
-/// value is opaque: it is never parsed, validated, or checked for a
-/// prefix.
-///
-/// Logs presence, never the value, at `info!` on every call. The
-/// Factory runs `flox publish` at a fixed verbosity that filters out
-/// `debug!`, so this is the only level an investigator diagnosing an
-/// unlinked build can rely on, and the two call sites' line count
-/// says which of catalog-server's two write paths should have
-/// recorded the link.
-pub fn factory_build_token_from_env() -> Option<String> {
-    let token = std::env::var(crate::FACTORY_BUILD_TOKEN_VAR)
-        .ok()
-        .filter(|s| !s.is_empty());
-    if token.is_some() {
-        tracing::info!("forwarding Factory build token");
-    }
-    token
-}
-
 /// The complete catalog API interface.
 ///
 /// This trait enables alternate implementations:
@@ -496,7 +472,7 @@ impl CatalogClientTrait for FloxhubClient {
                     .by_command_api_v1_catalog_by_command_get(
                         &command_name,
                         Some(0),
-                        Some(page_size.get() as i64),
+                        Some(page_size.get() as u64),
                         system,
                     )
                     .await
@@ -506,7 +482,7 @@ impl CatalogClientTrait for FloxhubClient {
             },
             None => {
                 // Collect all providers across pages.
-                let page_size = RESPONSE_PAGE_SIZE.get() as i64;
+                let page_size = RESPONSE_PAGE_SIZE.get() as u64;
                 // Fetch the first page to initialise the stable fields.
                 let first = self
                     .catalog
@@ -525,7 +501,7 @@ impl CatalogClientTrait for FloxhubClient {
                 let total_count = first.total_count;
                 let mut all_providers = first.providers;
                 // Fetch subsequent pages until we have all providers.
-                let mut page = 1i64;
+                let mut page = 1u64;
                 while (all_providers.len() as i64) < total_count {
                     let next = self
                         .catalog
@@ -1805,6 +1781,7 @@ pub mod tests {
         use catalog_api_v1::types as api_types;
 
         UserBuildPublish {
+            allow_lineage_change: false,
             base_catalog_rev_count: None,
             base_catalog_rev_date: None,
             build_type: None,
@@ -1838,76 +1815,12 @@ pub mod tests {
         }
     }
 
-    /// A token on the query is forwarded, uninterpreted, on the check-build
-    /// request body.
-    #[tokio::test]
-    async fn check_build_includes_factory_build_token_when_present() {
-        use catalog_api_v1::types as api_types;
-
-        let server = MockServer::start_async().await;
-        let mock = server.mock(|when, then| {
-            when.method("POST")
-                .path(CHECK_BUILD_PATH)
-                .json_body_includes(json!({ "factory_build_token": "factory:abc123" }).to_string());
-            then.status(200)
-                .json_body(json!({ "already_published": false }));
-        });
-
-        let client = FloxhubClient::new(client_config(server.base_url().as_str())).unwrap();
-
-        client
-            .check_build_already_recorded(CheckBuildQuery {
-                catalog_name: "myorg",
-                package_name: "mypkg",
-                source_url: &"https://example.com/repo".parse().unwrap(),
-                source_rev: "deadbeef",
-                nixpkgs_rev: "cafebabe",
-                system: api_types::PackageSystem::X8664Linux,
-                locked_inputs: &HashMap::new(),
-                factory_build_token: Some("factory:abc123"),
-            })
-            .await
-            .expect("expected Ok");
-
-        mock.assert();
-    }
-
-    /// No token on the query means the key is omitted from the request
-    /// body, not sent as `null`.
-    #[tokio::test]
-    async fn check_build_excludes_factory_build_token_when_absent() {
-        use catalog_api_v1::types as api_types;
-
-        let server = MockServer::start_async().await;
-        let mock = server.mock(|when, then| {
-            when.method("POST")
-        
```

**File**: `cli/floxhub-client/src/lib.rs` (modified, +0/-5)
```diff
@@ -52,10 +52,6 @@ pub const FLOX_CATALOG_DUMP_DATA_VAR: &str = "_FLOX_CATALOG_DUMP_RESPONSE_FILE";
 /// Test/regen-only — not a user-facing interface. See Justfile
 /// `gen-unit-data-no-publish` for usage.
 pub const FLOX_RESOLVE_STABILITY_VAR: &str = "_FLOX_RESOLVE_STABILITY";
-/// Carries the Factory's per-build token into the build pod. Read by
-/// [`client::factory_build_token_from_env`] and forwarded, unread, on the
-/// two catalog-server calls `flox publish` makes.
-pub const FACTORY_BUILD_TOKEN_VAR: &str = "_FLOX_FACTORY_BUILD_TOKEN";
 
 // Re-export catalog-api-v1 types for consumers.
 // This allows consumers to depend only on floxhub-client, not directly on catalog-api-v1.
@@ -93,7 +89,6 @@ pub use client::{
     CatalogClientTrait,
     CheckBuildQuery,
     FloxhubClient,
-    factory_build_token_from_env,
     str_to_catalog_name,
     str_to_package_name,
 };
```

**File**: `cli/floxhub-client/src/types.rs` (modified, +0/-1)
```diff
@@ -46,7 +46,6 @@ pub use api_types::{
     LookupGroup,
     ReferencePoint,
     ReferencesItem,
-    Stability,
     UnresolvableEntry,
     UnresolvableLeaf,
 };
```

---

### Incident Patch 4: `2a3fc2c8` (2026-09-21)
**Commit Message**: chore(catalog-api-v1): scope the schema regen to factory_build_token

fd8881ecf copied floxhub's full current schema, pulling in two
unrelated upstream changes — BuildInputsLookupRequest.stability
deprecated to optional, and by_command's page/page_size widened to
u64 — that forced collateral fixes in floxhub-client and
nef-lock-catalog. Restore openapi.json to origin/main, add only
the factory_build_token field to CheckBuildRequest and
PackageBuildWithNarInfo (matching floxhub's current schema shape),
regenerate client.rs via `cargo check -p catalog-api-v1`, and
revert the three collateral fixes — the crates build clean without
them once the unrelated schema drift is gone. The rest of the
drift is left for the schema-sync bot.

Refs: ECO-288
Forge-Agent: implementation-worker (c009aa52)
Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Fv8w3F3iGsMFjZjW1oJDKR

**File**: `cli/catalog-api-v1/openapi.json` (modified, +8/-69)
```diff
@@ -160,7 +160,6 @@
             "required": false,
             "schema": {
               "type": "integer",
-              "minimum": 0,
               "default": 0,
               "title": "Page"
             }
@@ -171,7 +170,6 @@
             "required": false,
             "schema": {
               "type": "integer",
-              "minimum": 0,
               "default": 10,
               "title": "Pagesize"
             }
@@ -352,7 +350,7 @@
           "build-inputs"
         ],
         "summary": "Lookup",
-        "description": "Resolve each reference group's transitive build-input closure.\n\nEvery package name resolves independently to its latest build at the\nreference point. Unreadable dependencies remain opaque boundary leaves.\nTimeout, overflow, and cycle failures affect only their own group.",
+        "description": "Resolve build inputs for one or more reference groups.\n\nDirect references resolve to latest; the transitive closure is taken\nverbatim; a cross-reference conflict yields a per-group conflict result.\n\nFor each group, walks the transitive package_inputs closure (accessor),\nthen applies auth redaction and assembles the flat LockedInputs map.\n\nEach group runs in its own transaction so a single group's timeout,\noverflow, or conflict produces a per-group error without affecting others.",
         "operationId": "lookup_api_v1_catalog_build_inputs_lookup_post",
         "requestBody": {
           "content": {
@@ -1784,37 +1782,6 @@
         }
       }
     },
-    "/api/v1/catalog/info/systems": {
-      "get": {
-        "tags": [
-          "info"
-        ],
-        "summary": "List registered systems",
-        "operationId": "getSystems_api_v1_catalog_info_systems_get",
-        "responses": {
-          "200": {
-            "description": "The names of every system registered in the catalog, sorted by name",
-            "content": {
-              "application/json": {
-                "schema": {
-                  "$ref": "#/components/schemas/SystemsResult"
-                }
-              }
-            }
-          },
-          "422": {
-            "description": "The request could not be processed",
-            "content": {
-              "application/json": {
-                "schema": {
-                  "$ref": "#/components/schemas/ErrorResponse"
-                }
-              }
-            }
-          }
-        }
-      }
-    },
     "/api/v1/catalog/info/published-catalogs": {
       "get": {
         "tags": [
@@ -2304,11 +2271,9 @@
       "BuildInputsLookupRequest": {
         "properties": {
           "stability": {
-            "title": "Stability",
-            "description": "Accepted and ignored; not used by this endpoint. Deprecated.",
-            "deprecated": true,
-            "nullable": true,
-            "type": "string"
+            "type": "string",
+            "minLength": 1,
+            "title": "Stability"
           },
           "reference_point": {
             "nullable": true,
@@ -2329,10 +2294,11 @@
         },
         "type": "object",
         "required": [
+          "stability",
           "groups"
         ],
         "title": "BuildInputsLookupRequest",
-        "description": "Request body for the /build-inputs/lookup endpoint.\n\nA lookup names one or more `groups` of references to resolve, optionally\nanchored at a `reference_point`.\n\nThe response is source revisions plus DAG edges: for each reference, the\nlatest revision of its own source together with the transitive non-base\nsources that revision was built against.  That answer carries no system\nand no nixpkgs base revision, so the request body names neither.  A base\nrevision is selected at build time, against which the same lock may be\nbuilt repeatedly."
+        "description": "Request body for the /build-inputs/lookup endpoint.\n\nA lookup names a `stability` (required) and one or more `groups` of\nreferences to resolve, optionally anchored at a `reference_point`.  It is\nsystem-independent \u2014 the response is source revs + DAG edges, which carry\nno system \u2014 so the request body has no system field."
       },
       "BuildInputsLookupResponse": {
         "properties": {
@@ -3118,7 +3084,7 @@
           "locked_inputs_hash"
         ],
         "title": "LockedInputEntry",
-        "description": "An entry in a flat locked-inputs map.\n\nPublish leaves `inputs` as `null` because the server reconstructs the DAG\nfrom `package_inputs`. Lookup supplies direct input keys. An empty list\nmeans no dependencies.\n\n`locked_inputs_hash` is required. Lookup computes it from the closure it\nassembled; publish uses it to select a stored closure. Boundary children,\nincluding redacted or unencodable rows, can contribute to that hash without\nappearing in `inputs`. Lookup can compute a digest no stored row carries,\nwhich publish rejects."
+        "description": "A single entry in the flat locked-inputs map.\n\nOne type, two directions (inte
```

**File**: `cli/catalog-api-v1/src/client.rs` (modified, +140/-92)
```diff
@@ -86,25 +86,21 @@ pub mod types {
     }
     /**Request body for the /build-inputs/lookup endpoint.
 
-A lookup names one or more `groups` of references to resolve, optionally
-anchored at a `reference_point`.
-
-The response is source revisions plus DAG edges: for each reference, the
-latest revision of its own source together with the transitive non-base
-sources that revision was built against.  That answer carries no system
-and no nixpkgs base revision, so the request body names neither.  A base
-revision is selected at build time, against which the same lock may be
-built repeatedly.*/
+A lookup names a `stability` (required) and one or more `groups` of
+references to resolve, optionally anchored at a `reference_point`.  It is
+system-independent — the response is source revs + DAG edges, which carry
+no system — so the request body has no system field.*/
     ///
     /// <details><summary>JSON schema</summary>
     ///
     /// ```json
     ///{
     ///  "title": "BuildInputsLookupRequest",
-    ///  "description": "Request body for the /build-inputs/lookup endpoint.\n\nA lookup names one or more `groups` of references to resolve, optionally\nanchored at a `reference_point`.\n\nThe response is source revisions plus DAG edges: for each reference, the\nlatest revision of its own source together with the transitive non-base\nsources that revision was built against.  That answer carries no system\nand no nixpkgs base revision, so the request body names neither.  A base\nrevision is selected at build time, against which the same lock may be\nbuilt repeatedly.",
+    ///  "description": "Request body for the /build-inputs/lookup endpoint.\n\nA lookup names a `stability` (required) and one or more `groups` of\nreferences to resolve, optionally anchored at a `reference_point`.  It is\nsystem-independent — the response is source revs + DAG edges, which carry\nno system — so the request body has no system field.",
     ///  "type": "object",
     ///  "required": [
-    ///    "groups"
+    ///    "groups",
+    ///    "stability"
     ///  ],
     ///  "properties": {
     ///    "groups": {
@@ -131,12 +127,8 @@ built repeatedly.*/
     ///    },
     ///    "stability": {
     ///      "title": "Stability",
-    ///      "description": "Accepted and ignored; not used by this endpoint. Deprecated.",
-    ///      "deprecated": true,
-    ///      "type": [
-    ///        "string",
-    ///        "null"
-    ///      ]
+    ///      "type": "string",
+    ///      "minLength": 1
     ///    }
     ///  }
     ///}
@@ -147,9 +139,7 @@ built repeatedly.*/
         pub groups: ::std::vec::Vec<LookupGroup>,
         #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
         pub reference_point: ::std::option::Option<ReferencePoint>,
-        ///Accepted and ignored; not used by this endpoint. Deprecated.
-        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
-        pub stability: ::std::option::Option<::std::string::String>,
+        pub stability: Stability,
     }
     impl ::std::convert::From<&BuildInputsLookupRequest> for BuildInputsLookupRequest {
         fn from(value: &BuildInputsLookupRequest) -> Self {
@@ -1736,24 +1726,50 @@ values, not the serialized form.*/
             value.clone()
         }
     }
-    /**An entry in a flat locked-inputs map.
+    /**A single entry in the flat locked-inputs map.
+
+One type, two directions (intentionally NOT split into two models — the
+publish entry is the same entity with its edges not yet stated):
+
+- Publish request: the CLI sends {catalog, attr_path, build_type, source,
+  locked_inputs_hash} and leaves inputs null.  Null here means "not stated
+  — the server is authoritative for the DAG": the CLI knows its direct
+  inputs but is not the source of truth, and the server reconstructs the
+  DAG from package_inputs (keyed by locked_inputs_hash).
+- Lookup response: all fields are present and inputs is populated with the
+  full transitive-closure DAG.
+
+inputs uses the tri-state SBOM convention in both directions:
+  inputs: [k, ...]  — known direct inputs (by key)
+  inputs: []        — explicitly no dependencies
+  inputs null       — not stated (server is authoritative for the DAG)
+
+attr_path is a list of components, e.g. ["python3Packages", "boolex"].
+A flat catalog entry collapses what the CLI lockfile represents as a
+hierarchy of single-component package-set / package nodes.  Giving the
+CLI the components lets it re-expand that hierarchy.  A list is also
+unambiguous: if nested-dot component support is ever added (AI-267),
+the list form remains the unambiguous carrier.
+
+locked_inputs_hash is REQUIRED on every entry: the closure identity hash is
+the round-trip disambiguator that pins which recorded build a locked input
+refers to (lookup response → CLI → publish request).  A publish request
+missing it fails validation (422) at this contract boundary — there is no
+hash-free / old-cl
```

**File**: `cli/floxhub-client/src/client.rs` (modified, +3/-3)
```diff
@@ -496,7 +496,7 @@ impl CatalogClientTrait for FloxhubClient {
                     .by_command_api_v1_catalog_by_command_get(
                         &command_name,
                         Some(0),
-                        Some(page_size.get() as u64),
+                        Some(page_size.get() as i64),
                         system,
                     )
                     .await
@@ -506,7 +506,7 @@ impl CatalogClientTrait for FloxhubClient {
             },
             None => {
                 // Collect all providers across pages.
-                let page_size = RESPONSE_PAGE_SIZE.get() as u64;
+                let page_size = RESPONSE_PAGE_SIZE.get() as i64;
                 // Fetch the first page to initialise the stable fields.
                 let first = self
                     .catalog
@@ -525,7 +525,7 @@ impl CatalogClientTrait for FloxhubClient {
                 let total_count = first.total_count;
                 let mut all_providers = first.providers;
                 // Fetch subsequent pages until we have all providers.
-                let mut page = 1u64;
+                let mut page = 1i64;
                 while (all_providers.len() as i64) < total_count {
                     let next = self
                         .catalog
```

**File**: `cli/floxhub-client/src/types.rs` (modified, +1/-0)
```diff
@@ -46,6 +46,7 @@ pub use api_types::{
     LookupGroup,
     ReferencePoint,
     ReferencesItem,
+    Stability,
     UnresolvableEntry,
     UnresolvableLeaf,
 };
```

---

### Incident Patch 5: `055b8e1d` (2026-09-18)
**Commit Message**: feat(floxhub-client,flox,flox-rust-sdk): forward the Factory build token

Factory Provenance P2.1 needs `flox publish` to forward the
Factory's per-build token to catalog-server, unread and unlogged, so
the two services can later join a build to the package it produced.
Adds `_FLOX_FACTORY_BUILD_TOKEN` and an accessor collapsing unset,
empty, and non-UTF-8 to absent; sets it on `CheckBuildQuery` and the
publish body at both call sites; and blanks it from the publish
body's debug dump, since the coordinator runs `flox publish` at a
verbosity the CLI's log filter would otherwise let it through.

Regenerating the client also surfaced two unrelated floxhub schema
changes that broke the build: `stability` on build-inputs lookup is
now optional and ignored, and `by_command`'s page/page_size params
widened to `u64`. Fixed here since they blocked the build.

TDD: four new wire-shape tests in floxhub-client, each confirmed to
fail against a broken control before passing.

Refs: ECO-288
Forge-Agent: implementation-worker (c009aa52)
Co-Authored-By: Claude Opus 5 (1M context) <[REDACTED_EMAIL]>
Claude-Session: https://claude.ai/code/session_01Fv8w3F3iGsMFjZjW1oJDKR

**File**: `cli/flox-rust-sdk/src/providers/publish.rs` (modified, +16/-0)
```diff
@@ -23,6 +23,7 @@ use floxhub_client::{
     SourceLineageChange,
     UserBuildPublish,
     UserDerivationInfo,
+    factory_build_token_from_env,
 };
 use git_url_parse::GitUrl;
 use indexmap::IndexSet;
@@ -766,8 +767,23 @@ where
                 .to_string_lossy()
                 .into_owned(),
             allow_lineage_change,
+            factory_build_token: factory_build_token_from_env(),
         };
 
+        // The Factory token is a capability: whoever reads it can claim a
+        // build's catalog association. `flox publish` runs inside the
+        // build pod and its stderr is the log the coordinator serves at
+        // GET /builds/{id}/logs, so this dump carries whether a token was
+        // sent, never its value.
+        let logged_build_info = UserBuildPublish {
+            factory_build_token: None,
+            ..build_info.clone()
+        };
+        tracing::debug!(
+            build_info = ?logged_build_info,
+            factory_build_token_present = build_info.factory_build_token.is_some(),
+            "Publishing build in catalog...",
+        );
         publish_build_with_confirmation(
             client,
             catalog_name,
```

**File**: `cli/flox/src/commands/publish.rs` (modified, +3/-0)
```diff
@@ -34,6 +34,7 @@ use floxhub_client::{
     LockedInputEntry,
     PackageSystem,
     SourceLineageChange,
+    factory_build_token_from_env,
 };
 use indoc::formatdoc;
 use nef_lock_catalog::{CatalogRef, NixFlakeref, scan_package};
@@ -496,6 +497,7 @@ impl Publish {
             && !publish_config.allow_lineage_change
         {
             let locked_inputs_query: HashMap<_, _> = locked_inputs.clone().into_iter().collect();
+            let factory_build_token = factory_build_token_from_env();
             let query = CheckBuildQuery {
                 catalog_name: &catalog_name,
                 package_name: publish_provider.package_metadata.package.name().as_ref(),
@@ -504,6 +506,7 @@ impl Publish {
                 nixpkgs_rev,
                 system,
                 locked_inputs: &locked_inputs_query,
+                factory_build_token: factory_build_token.as_deref(),
             };
             if dedup_short_circuit(&flox.floxhub_client, query).await {
                 return Ok(());
```

**File**: `cli/floxhub-client/src/client.rs` (modified, +195/-0)
```diff
@@ -198,6 +198,34 @@ pub struct CheckBuildQuery<'a> {
     pub nixpkgs_rev: &'a str,
     pub system: api_types::PackageSystem,
     pub locked_inputs: &'a HashMap<String, api_types::LockedInputEntry>,
+    /// Forwarded, uninterpreted, from
+    /// [`factory_build_token_from_env`]. `None` for an ordinary
+    /// `flox publish`, which is the normal case rather than a
+    /// gap.
+    pub factory_build_token: Option<&'a str>,
+}
+
+/// Read the Factory build token from the process environment.
+///
+/// Unset, empty, and non-UTF-8 all mean absent, and absent means the
+/// field is omitted from both request bodies this crate sends. The
+/// value is opaque: it is never parsed, validated, or checked for a
+/// prefix.
+///
+/// Logs presence, never the value, at `info!` on every call. The
+/// Factory runs `flox publish` at a fixed verbosity that filters out
+/// `debug!`, so this is the only level an investigator diagnosing an
+/// unlinked build can rely on, and the two call sites' line count
+/// says which of catalog-server's two write paths should have
+/// recorded the link.
+pub fn factory_build_token_from_env() -> Option<String> {
+    let token = std::env::var(crate::FACTORY_BUILD_TOKEN_VAR)
+        .ok()
+        .filter(|s| !s.is_empty());
+    if token.is_some() {
+        tracing::info!("forwarding Factory build token");
+    }
+    token
 }
 
 /// The complete catalog API interface.
@@ -735,6 +763,7 @@ impl CatalogClientTrait for FloxhubClient {
         let catalog = str_to_catalog_name(query.catalog_name)?;
         let package = str_to_package_name(query.package_name)?;
         let body = api_types::CheckBuildRequest {
+            factory_build_token: query.factory_build_token.map(str::to_string),
             source_url: query.source_url.to_string(),
             source_rev: query.source_rev.to_string(),
             nixpkgs_rev: query.nixpkgs_rev.to_string(),
@@ -1640,6 +1669,7 @@ pub mod tests {
                 nixpkgs_rev: "cafebabe",
                 system: api_types::PackageSystem::X8664Linux,
                 locked_inputs: &locked_inputs,
+                factory_build_token: None,
             })
             .await;
 
@@ -1678,6 +1708,7 @@ pub mod tests {
                 nixpkgs_rev: "cafebabe",
                 system: api_types::PackageSystem::X8664Linux,
                 locked_inputs: &HashMap::new(),
+                factory_build_token: None,
             })
             .await;
 
@@ -1716,6 +1747,7 @@ pub mod tests {
                 nixpkgs_rev: "cafebabe",
                 system: api_types::PackageSystem::X8664Linux,
                 locked_inputs: &HashMap::new(),
+                factory_build_token: None,
             })
             .await;
 
@@ -1751,10 +1783,173 @@ pub mod tests {
                 nixpkgs_rev: "cafebabe",
                 system: api_types::PackageSystem::X8664Linux,
                 locked_inputs: &HashMap::new(),
+                factory_build_token: None,
             })
             .await;
 
         mock.assert();
         assert!(result.is_err(), "expected Err from 5xx, got: {result:?}");
     }
+
+    // ---------------------------------------------------------------------------
+    // factory_build_token: forwarded uninterpreted on check-build and
+    // publish, omitted rather than sent null when absent.
+    // ---------------------------------------------------------------------------
+
+    const PUBLISH_PATH: &str = "/api/v1/catalog/catalogs/myorg/packages/mypkg/builds";
+
+    /// A structurally valid [`UserBuildPublish`] for wire-shape tests. Every
+    /// field but `factory_build_token` is an arbitrary value satisfying the
+    /// schema.
+    fn minimal_build_info(factory_build_token: Option<&str>) -> UserBuildPublish {
+        use catalog_api_v1::types as api_types;
+
+        UserBuildPublish {
+            base_catalog_rev_count: None,
+            base_catalog_rev_date: None,
+            build_type: None,
+            cache_uri: None,
+            derivation: api_types::PackageDerivation {
+                broken: None,
+                description: None,
+                drv_path: "/nix/store/deadbeef-mypkg".to_string(),
+                license: None,
+                licenses: None,
+                name: "mypkg".to_string(),
+                outputs: api_types::PackageOutputs(vec![]),
+                outputs_to_install: None,
+                pname: None,
+                system: api_types::PackageSystem::X8664Linux,
+                unfree: None,
+                version: None,
+            },
+            dot_flox_dir: ".flox".to_string(),
+            factory_build_token: factory_build_token.map(str::to_string),
+            locked_base_catalog_url: None,
+            locked_inputs: None,
+            narinfos: None,
+            narinfos_source_url: None,
+            narinfos_source_version: None,
+            ref_: None,
+            rev: "deadbeef".to_string(),
+            rev_count: 1,
+            
```

**File**: `cli/floxhub-client/src/lib.rs` (modified, +5/-0)
```diff
@@ -52,6 +52,10 @@ pub const FLOX_CATALOG_DUMP_DATA_VAR: &str = "_FLOX_CATALOG_DUMP_RESPONSE_FILE";
 /// Test/regen-only — not a user-facing interface. See Justfile
 /// `gen-unit-data-no-publish` for usage.
 pub const FLOX_RESOLVE_STABILITY_VAR: &str = "_FLOX_RESOLVE_STABILITY";
+/// Carries the Factory's per-build token into the build pod. Read by
+/// [`client::factory_build_token_from_env`] and forwarded, unread, on the
+/// two catalog-server calls `flox publish` makes.
+pub const FACTORY_BUILD_TOKEN_VAR: &str = "_FLOX_FACTORY_BUILD_TOKEN";
 
 // Re-export catalog-api-v1 types for consumers.
 // This allows consumers to depend only on floxhub-client, not directly on catalog-api-v1.
@@ -89,6 +93,7 @@ pub use client::{
     CatalogClientTrait,
     CheckBuildQuery,
     FloxhubClient,
+    factory_build_token_from_env,
     str_to_catalog_name,
     str_to_package_name,
 };
```

---

### Incident Patch 6: `dc38695b` (2026-10-01)
**Commit Message**: build: Update FloxHub API schemas to 0509d5c3 (#4739)

The FloxHub `0509d5c3` API changes catalog publish/lookup and Factory
responses. This PR updates the generated clients and the CLI call sites
together, then refreshes the recorded API responses used by tests.

The recorder fixes let `just gen-data` write complete cassettes again,
including when a detached CLI process makes the request. The
`hello-unfree` cassette stays at its last known substitutable nixpkgs
revision; `test_data/config.toml` documents the check needed before a
forced rerecord replaces it. Factory cancel now gives a specific retry
instruction for an in-flight dispatch (409), while a service failure
such as 502 tells the user to check build status if retrying does not
resolve it. The cancel exit code remains 1 in both cases.

Validation: `cargo check -p floxhub-client -p nef-lock-catalog -p flox`;
`cargo test -p flox commands::factory::cancel --bin flox` (21 passed);
`cargo test -p floxhub-client -p nef-lock-catalog`; `cargo fmt --check`;
targeted `cargo clippy --all-targets -- -D warnings`; repository
pre-push checks. All commands ran through `nix develop -c`.

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -1579,6 +1579,7 @@ dependencies = [
  "floxhub-client",
  "fslock",
  "futures",
+ "http 1.4.0",
  "httpmock",
  "indent",
  "indicatif",
```

**File**: `cli/catalog-api-v1/openapi.json` (modified, +124/-10)
```diff
@@ -16,7 +16,7 @@
           "catalog"
         ],
         "summary": "Search for packages",
-        "description": "Search the catalog(s) under the given criteria for matching packages.\n\nRequired Query Parameters:\n- **system**: The system architecture to search for (e.g., x86_64-linux)\n\nOptional Query Parameters:\n- **search_term**: The search term to filter packages by\n- **catalogs**: Comma separated list of catalog names to search; defaults to\n  all catalogs. Note: when searching base catalog, search_term is required.\n- **page**: Page number for pagination (default: 0)\n- **pageSize**: Page size for pagination (default: 10)\nReturns:\n- **PackageSearchResult**: A list of PackageInfoSearch items and total count",
+        "description": "Search the catalog(s) under the given criteria for matching packages.\n\nRequired Query Parameters:\n- **system**: The system architecture to search for (e.g., x86_64-linux)\n\nOptional Query Parameters:\n- **search_term**: The search term to filter packages by\n- **catalogs**: Comma separated list of catalog names to search; defaults to\n  all catalogs. Note: when searching base catalog, search_term is required.\n- **sort**: Result order. `name-asc` and `name-desc` sort alphabetically by\n  attr_path, overriding relevance ranking. Omit to use the default order\n  (sort_priority ASC, attr_path_length ASC, attr_path ASC).\n- **page**: Page number for pagination (default: 0)\n- **pageSize**: Page size for pagination (default: 10)\nReturns:\n- **PackageSearchResult**: A list of PackageInfoSearch items and total count",
         "operationId": "search_api_v1_catalog_search_get",
         "security": [
           {
@@ -57,6 +57,20 @@
               "type": "string"
             }
           },
+          {
+            "name": "sort",
+            "in": "query",
+            "required": false,
+            "schema": {
+              "title": "Sort",
+              "nullable": true,
+              "allOf": [
+                {
+                  "$ref": "#/components/schemas/SortOrder"
+                }
+              ]
+            }
+          },
           {
             "name": "page",
             "in": "query",
@@ -146,6 +160,7 @@
             "required": false,
             "schema": {
               "type": "integer",
+              "minimum": 0,
               "default": 0,
               "title": "Page"
             }
@@ -156,6 +171,7 @@
             "required": false,
             "schema": {
               "type": "integer",
+              "minimum": 0,
               "default": 10,
               "title": "Pagesize"
             }
@@ -336,7 +352,7 @@
           "build-inputs"
         ],
         "summary": "Lookup",
-        "description": "Resolve build inputs for one or more reference groups.\n\nDirect references resolve to latest; the transitive closure is taken\nverbatim; a cross-reference conflict yields a per-group conflict result.\n\nFor each group, walks the transitive package_inputs closure (accessor),\nthen applies auth redaction and assembles the flat LockedInputs map.\n\nEach group runs in its own transaction so a single group's timeout,\noverflow, or conflict produces a per-group error without affecting others.",
+        "description": "Resolve each reference group's transitive build-input closure.\n\nEvery package name resolves independently to its latest build at the\nreference point. Unreadable dependencies remain opaque boundary leaves.\nTimeout, overflow, and cycle failures affect only their own group.",
         "operationId": "lookup_api_v1_catalog_build_inputs_lookup_post",
         "requestBody": {
           "content": {
@@ -386,8 +402,16 @@
           "settings"
         ],
         "summary": "Adjust various settings",
-        "description": "Adjusts various settings on the catalog service.\n\nQuery Parameters:\n- **key**: The the key to adjust.\n    - \"plan\" - Enables the logging of the DB query plan for queries for\n    **value** seconds.  It will be scheduled to turn off automatically after\n    that.",
+        "description": "Adjusts various settings on the catalog service.\n\nQuery Parameters:\n- **key**: The the key to adjust.\n    - \"plan\" - Enables the logging of the DB query plan for queries for\n    **value** seconds.  It will be scheduled to turn off automatically after\n    that.\n\nNote: Requires authentication and superuser (flox staff) access.",
         "operationId": "settings_api_v1_catalog_settings__key__post",
+        "security": [
+          {
+            "HTTPBearer": []
+          },
+          {
+            "HTTPBasic": []
+          }
+        ],
         "parameters": [
           {
             "name": "key",
@@ -1146,6 +1170,16 @@
               }
             }
           },
+          "409": {
+            "description": "The package is registered to a different source repository or ref",
+            "content": {
+              "application/json": {
+                "schema": {
+         
```

**File**: `cli/catalog-api-v1/src/client.rs` (modified, +166/-99)
```diff
@@ -86,21 +86,25 @@ pub mod types {
     }
     /**Request body for the /build-inputs/lookup endpoint.
 
-A lookup names a `stability` (required) and one or more `groups` of
-references to resolve, optionally anchored at a `reference_point`.  It is
-system-independent — the response is source revs + DAG edges, which carry
-no system — so the request body has no system field.*/
+A lookup names one or more `groups` of references to resolve, optionally
+anchored at a `reference_point`.
+
+The response is source revisions plus DAG edges: for each reference, the
+latest revision of its own source together with the transitive non-base
+sources that revision was built against.  That answer carries no system
+and no nixpkgs base revision, so the request body names neither.  A base
+revision is selected at build time, against which the same lock may be
+built repeatedly.*/
     ///
     /// <details><summary>JSON schema</summary>
     ///
     /// ```json
     ///{
     ///  "title": "BuildInputsLookupRequest",
-    ///  "description": "Request body for the /build-inputs/lookup endpoint.\n\nA lookup names a `stability` (required) and one or more `groups` of\nreferences to resolve, optionally anchored at a `reference_point`.  It is\nsystem-independent — the response is source revs + DAG edges, which carry\nno system — so the request body has no system field.",
+    ///  "description": "Request body for the /build-inputs/lookup endpoint.\n\nA lookup names one or more `groups` of references to resolve, optionally\nanchored at a `reference_point`.\n\nThe response is source revisions plus DAG edges: for each reference, the\nlatest revision of its own source together with the transitive non-base\nsources that revision was built against.  That answer carries no system\nand no nixpkgs base revision, so the request body names neither.  A base\nrevision is selected at build time, against which the same lock may be\nbuilt repeatedly.",
     ///  "type": "object",
     ///  "required": [
-    ///    "groups",
-    ///    "stability"
+    ///    "groups"
     ///  ],
     ///  "properties": {
     ///    "groups": {
@@ -127,8 +131,12 @@ no system — so the request body has no system field.*/
     ///    },
     ///    "stability": {
     ///      "title": "Stability",
-    ///      "type": "string",
-    ///      "minLength": 1
+    ///      "description": "Accepted and ignored; not used by this endpoint. Deprecated.",
+    ///      "deprecated": true,
+    ///      "type": [
+    ///        "string",
+    ///        "null"
+    ///      ]
     ///    }
     ///  }
     ///}
@@ -139,7 +147,9 @@ no system — so the request body has no system field.*/
         pub groups: ::std::vec::Vec<LookupGroup>,
         #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
         pub reference_point: ::std::option::Option<ReferencePoint>,
-        pub stability: Stability,
+        ///Accepted and ignored; not used by this endpoint. Deprecated.
+        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
+        pub stability: ::std::option::Option<::std::string::String>,
     }
     impl ::std::convert::From<&BuildInputsLookupRequest> for BuildInputsLookupRequest {
         fn from(value: &BuildInputsLookupRequest) -> Self {
@@ -1717,50 +1727,24 @@ values, not the serialized form.*/
             value.clone()
         }
     }
-    /**A single entry in the flat locked-inputs map.
-
-One type, two directions (intentionally NOT split into two models — the
-publish entry is the same entity with its edges not yet stated):
-
-- Publish request: the CLI sends {catalog, attr_path, build_type, source,
-  locked_inputs_hash} and leaves inputs null.  Null here means "not stated
-  — the server is authoritative for the DAG": the CLI knows its direct
-  inputs but is not the source of truth, and the server reconstructs the
-  DAG from package_inputs (keyed by locked_inputs_hash).
-- Lookup response: all fields are present and inputs is populated with the
-  full transitive-closure DAG.
-
-inputs uses the tri-state SBOM convention in both directions:
-  inputs: [k, ...]  — known direct inputs (by key)
-  inputs: []        — explicitly no dependencies
-  inputs null       — not stated (server is authoritative for the DAG)
-
-attr_path is a list of components, e.g. ["python3Packages", "boolex"].
-A flat catalog entry collapses what the CLI lockfile represents as a
-hierarchy of single-component package-set / package nodes.  Giving the
-CLI the components lets it re-expand that hierarchy.  A list is also
-unambiguous: if nested-dot component support is ever added (AI-267),
-the list form remains the unambiguous carrier.
+    /**An entry in a flat locked-inputs map.
 
-locked_inputs_hash is REQUIRED on every entry: the closure identity hash is
-the round-trip disambiguator that pins which recorded build a locked input
-refers to (lookup response → CLI → publish request).  A publish request
-missing it fails valida
```

**File**: `cli/factory-api-v1/openapi.json` (modified, +208/-3)
```diff
@@ -242,7 +242,7 @@
           "builds"
         ],
         "summary": "Cancel Build",
-        "description": "Cancel a build.\n\nHandles both active builds (delegated to Build Coordinator) and\npre-dispatch builds (cancelled FS-only via an atomic row lock).\n\nThe operation is idempotent with respect to terminal state. When\nthe build has already reached a terminal state (``cancelled``,\n``completed``, ``failed``, or ``timed_out``) \u2014 whether Build\nCoordinator reports it or the local task row records it \u2014 the\nresponse is still 200 and the ``status`` field carries that\nterminal state. Coordinator statuses are normalized into the\neffective vocabulary before they are surfaced: BC's ``timed_out``\nsurfaces as ``timed_out``, the same word a subsequent ``GET``\nreconstructs from the footprint the callback path persists\n(status='failed' + error_class='timeout'), so the two surfaces\nalways agree.\n\nCancelling a pre-dispatch build permanently retires its identity\ntuple: ``uq_factory_build_identity`` dedup treats the cancelled\nrow like any other terminal build, so a later event expanding to\nthe same identity inserts nothing. Recovery is manual by design \u2014\na cancel that ambient event traffic could overturn would not be a\ncancel.\n\nOutcomes:\n    200 \u2014 Build cancelled, or already terminal. ``BuildResponse.status``\n          reflects the effective state.\n    404 \u2014 No build with the given ID.\n    502 \u2014 Build Coordinator unreachable or returned an unexpected\n          error; or the coordinator does not know the build yet\n          because its dispatch is in flight (the worker commits\n          its claim before the HTTP submit), or no longer knows it\n          (coordinator restart or purge). In every 502 case the\n          correct client action is retry with backoff.\n\nAn audit log line is emitted on every path, including unhandled\nexceptions (``outcome=internal_error``).",
+        "description": "Cancel a build.\n\nHandles both active builds (delegated to Build Coordinator) and\npre-dispatch builds (cancelled FS-only via an atomic row lock).\n\nThe operation is idempotent with respect to terminal state. When\nthe build has already reached a terminal state (``cancelled``,\n``completed``, ``failed``, or ``timed_out``) \u2014 whether Build\nCoordinator reports it or the local task row records it \u2014 the\nresponse is still 200 and the ``status`` field carries that\nterminal state. Coordinator statuses are normalized into the\neffective vocabulary before they are surfaced: BC's ``timed_out``\nsurfaces as ``timed_out``, the same word a subsequent ``GET``\nreconstructs from the footprint the callback path persists\n(status='failed' + error_class='timeout'), so the two surfaces\nalways agree.\n\nCancelling a pre-dispatch build permanently retires its identity\ntuple: ``uq_factory_build_identity`` dedup treats the cancelled\nrow like any other terminal build, so a later event expanding to\nthe same identity inserts nothing. Recovery is manual by design \u2014\na cancel that ambient event traffic could overturn would not be a\ncancel.\n\nOutcomes:\n    200 \u2014 Build cancelled, or already terminal. ``BuildResponse.status``\n          reflects the effective state.\n    404 \u2014 No build with the given ID.\n    409 \u2014 The coordinator does not know the build yet because its\n          dispatch is in flight (the worker commits its claim\n          before the HTTP submit). Retry with backoff.\n    502 \u2014 Build Coordinator unreachable or returned an unexpected\n          error; or the coordinator has no record of a build whose\n          dispatch window has long passed (lost to a restart or\n          purge, or stranded by a worker that died between claim\n          and submit).\n\nAn audit log line is emitted on every path, including unhandled\nexceptions (``outcome=internal_error``).",
         "operationId": "cancel_build_api_v1_factory_builds__build_id__delete",
         "security": [
           {
@@ -284,6 +284,16 @@
             },
             "description": "Not Found"
           },
+          "409": {
+            "description": "Build's registration with the coordinator is still in flight; retry with backoff",
+            "content": {
+              "application/json": {
+                "schema": {
+                  "$ref": "#/components/schemas/ErrorResponse"
+                }
+              }
+            }
+          },
           "422": {
             "content": {
               "application/json": {
@@ -295,7 +305,7 @@
             "description": "Unprocessable Entity"
           },
           "502": {
-            "description": "Build Coordinator unreachable or returned an error, or the build's registration with the coordinator is still in flight; retry with backoff",
+            "description": "Build Coordinator unreachable or returned an error, or has no record of the build",
             "content": {
               "application/json": {
      
```

**File**: `cli/factory-api-v1/src/client.rs` (modified, +326/-7)
```diff
@@ -279,6 +279,9 @@ coordinator-reported status appears.*/
     ///          ]
     ///        }
     ///      ]
+    ///    },
+    ///    "trigger": {
+    ///      "$ref": "#/components/schemas/BuildTrigger"
     ///    }
     ///  }
     ///}
@@ -300,20 +303,290 @@ coordinator-reported status appears.*/
         pub system: ::std::string::String,
         #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
         pub task: ::std::option::Option<TaskResponse>,
+        #[serde(default, skip_serializing_if = "::std::option::Option::is_none")]
+        pub trigger: ::std::option::Option<BuildTrigger>,
     }
     impl ::std::convert::From<&BuildResponse> for BuildResponse {
         fn from(value: &BuildResponse) -> Self {
             value.clone()
         }
     }
-    ///JSON body returned for all error responses on the builds endpoints.
+    /**The builds created in a window, summarized per system and per
+catalog.
+
+``systems`` lists every system the catalog knows, sorted by name and
+zero-padded. ``catalogs`` lists only the catalogs with at least one
+build in the window, sorted by name. The two lists partition the
+same builds, so their per-status sums agree.*/
+    ///
+    /// <details><summary>JSON schema</summary>
+    ///
+    /// ```json
+    ///{
+    ///  "title": "BuildStatsResponse",
+    ///  "description": "The builds created in a window, summarized per system and per\ncatalog.\n\n``systems`` lists every system the catalog knows, sorted by name and\nzero-padded. ``catalogs`` lists only the catalogs with at least one\nbuild in the window, sorted by name. The two lists partition the\nsame builds, so their per-status sums agree.",
+    ///  "type": "object",
+    ///  "required": [
+    ///    "catalogs",
+    ///    "systems"
+    ///  ],
+    ///  "properties": {
+    ///    "catalogs": {
+    ///      "title": "Catalogs",
+    ///      "type": "array",
+    ///      "items": {
+    ///        "$ref": "#/components/schemas/CatalogBuildStats"
+    ///      }
+    ///    },
+    ///    "systems": {
+    ///      "title": "Systems",
+    ///      "type": "array",
+    ///      "items": {
+    ///        "$ref": "#/components/schemas/SystemBuildStats"
+    ///      }
+    ///    }
+    ///  }
+    ///}
+    /// ```
+    /// </details>
+    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug, PartialEq)]
+    pub struct BuildStatsResponse {
+        pub catalogs: ::std::vec::Vec<CatalogBuildStats>,
+        pub systems: ::std::vec::Vec<SystemBuildStats>,
+    }
+    impl ::std::convert::From<&BuildStatsResponse> for BuildStatsResponse {
+        fn from(value: &BuildStatsResponse) -> Self {
+            value.clone()
+        }
+    }
+    /**How many builds sit in each effective status.
+
+The fields are named exactly as the build feed's ``status`` filter
+values, so each count links into the feed under its own key.*/
+    ///
+    /// <details><summary>JSON schema</summary>
+    ///
+    /// ```json
+    ///{
+    ///  "title": "BuildStatusCounts",
+    ///  "description": "How many builds sit in each effective status.\n\nThe fields are named exactly as the build feed's ``status`` filter\nvalues, so each count links into the feed under its own key.",
+    ///  "type": "object",
+    ///  "required": [
+    ///    "cancelled",
+    ///    "completed",
+    ///    "failed",
+    ///    "pending",
+    ///    "running",
+    ///    "timed_out"
+    ///  ],
+    ///  "properties": {
+    ///    "cancelled": {
+    ///      "title": "Cancelled",
+    ///      "type": "integer"
+    ///    },
+    ///    "completed": {
+    ///      "title": "Completed",
+    ///      "type": "integer"
+    ///    },
+    ///    "failed": {
+    ///      "title": "Failed",
+    ///      "type": "integer"
+    ///    },
+    ///    "pending": {
+    ///      "title": "Pending",
+    ///      "type": "integer"
+    ///    },
+    ///    "running": {
+    ///      "title": "Running",
+    ///      "type": "integer"
+    ///    },
+    ///    "timed_out": {
+    ///      "title": "Timed Out",
+    ///      "type": "integer"
+    ///    }
+    ///  }
+    ///}
+    /// ```
+    /// </details>
+    #[derive(::serde::Deserialize, ::serde::Serialize, Clone, Debug, PartialEq)]
+    pub struct BuildStatusCounts {
+        pub cancelled: i64,
+        pub completed: i64,
+        pub failed: i64,
+        pub pending: i64,
+        pub running: i64,
+        pub timed_out: i64,
+    }
+    impl ::std::convert::From<&BuildStatusCounts> for BuildStatusCounts {
+        fn from(value: &BuildStatusCounts) -> Self {
+            value.clone()
+        }
+    }
+    ///What scheduled a build.
+    ///
+    /// <details><summary>JSON schema</summary>
+    ///
+    /// ```json
+    ///{
+    ///  "title": "BuildTrigger",
+    ///  "description": "What scheduled a build.",
+    ///  "type": "object",
+    ///  "properties": {
+    ///    "kind": {
+    ///      "description": "What scheduled the 
```

**File**: `cli/flox-rust-sdk/src/providers/buildenv.rs` (modified, +30/-1)
```diff
@@ -2355,6 +2355,7 @@ mod buildenv_tests {
     use flox_manifest::parsed::latest::ManifestPackageDescriptor;
     use flox_manifest::raw::test_helpers::empty_test_migrated_manifest;
     use flox_test_utils::{GENERATED_DATA, MANUALLY_GENERATED};
+    use floxhub_client::StoreInfoResponse;
     use tempfile::TempDir;
     use test_helpers::buildenv_instance;
 
@@ -2882,7 +2883,35 @@ mod buildenv_tests {
         let buildenv = buildenv_instance();
         let lockfile_path = MANUALLY_GENERATED
             .join("buildenv/lockfiles/runtime-packages-namespaced-hello/manifest.lock");
-        let client = MockClient::new();
+
+        // A namespaced package is a custom catalog package, so the build asks
+        // the catalog where to download it unless it is already in the local
+        // store. Answer that query rather than relying on some other test
+        // having realised the same store path first. `hello` itself comes
+        // from nixpkgs, so the public cache serves it.
+        let lockfile =
+            Lockfile::read_from_file(&CanonicalPath::new(&lockfile_path).unwrap()).unwrap();
+        let items = lockfile
+            .packages
+            .iter()
+            .filter_map(|pkg| match pkg {
+                LockedPackage::Catalog(p) if p.install_id == "myhello" => Some(p),
+                _ => None,
+            })
+            .flat_map(|p| p.outputs.values().cloned())
+            .map(|store_path| {
+                (store_path, vec![StoreInfo {
+                    url: Some("https://cache.nixos.org".to_string()),
+                    auth: None,
+                    catalog: None,
+                    package: None,
+                    public_keys: None,
+                }])
+            })
+            .collect();
+        let mut client = MockClient::new();
+        client.push_store_info_response(StoreInfoResponse { items });
+
         let result = buildenv.build(&client, &lockfile_path, None, None).unwrap();
 
         let runtime = result.run.as_ref();
```

**File**: `cli/flox-rust-sdk/src/providers/catalog.rs` (modified, +2/-1)
```diff
@@ -17,6 +17,7 @@ use floxhub_client::{
     CatalogStoreConfig,
     CheckBuildQuery,
     CheckBuildResponse,
+    DEFAULT_STABILITY,
     FloxhubClient,
     FloxhubClientConfig,
     FloxhubClientError,
@@ -499,7 +500,7 @@ pub fn base_catalog_url_for_stability_arg(
                 formatdoc! {"
                     The default stability {} does not exist (or has not yet been populated).
                     Available stabilities are: {available_stabilities}
-                ", BaseCatalogInfo::DEFAULT_STABILITY}
+                ", DEFAULT_STABILITY}
             };
 
             let url = base_catalog_info
```

**File**: `cli/flox-rust-sdk/src/providers/publish.rs` (modified, +5/-0)
```diff
@@ -723,6 +723,11 @@ where
                 .rel_expression_build_base_dir
                 .to_string_lossy()
                 .into_owned(),
+            // No CLI flag exposes lineage changes yet, so match the field's
+            // documented server-side default and let the catalog keep
+            // rejecting a publish that would move a package's registered
+            // source repository or ref.
+            allow_lineage_change: false,
         };
 
         tracing::debug!(?build_info, "Publishing build in catalog...");
```

---

### Incident Patch 7: `b81f6759` (2026-10-01)
**Commit Message**: fix(publish): clarify lineage confirmation and intentional override

**File**: `cli/flox/doc/flox-publish.md` (modified, +19/-6)
```diff
@@ -131,13 +131,26 @@ Note that this is a paid feature available with Flox for Teams.
     'flox config'.
 
 `--allow-lineage-change`
-:   Allow replacing the package's registered source repository or ref.
+:   Explicitly authorize replacing the package's registered source repository
+    or ref. Use it only when that replacement is intentional.
     Without this option, a refused source change requires interactive
-    confirmation showing the registered and requested sources.
-    Use this option to confirm source changes in non-interactive environments.
-    This option also disables the existing-build deduplication shortcut.
-    An interactive ref-only change at an already-published commit can return
-    "already published" without reaching the confirmation prompt.
+    confirmation showing the registered and requested sources. Confirmation
+    defaults to no. In a non-interactive environment, a refused source change
+    fails without prompting. For an intentional replacement, repeat the
+    original command with `--allow-lineage-change` added. Leave this option
+    unset for routine CI publishing.
+
+    This option bypasses the check for an already-published build, even when
+    the registered source has not changed. Publishing can therefore repeat
+    build and upload preparation.
+
+    Without this option, changing only the ref at an already-published commit
+    with the same build inputs can report "already published" without prompting
+    or updating the registered ref. Moving back to a previously published
+    repository and revision can also report "already published" without
+    prompting or updating the registration. Both cases affect interactive and
+    non-interactive publishing. Use `--allow-lineage-change` only when the
+    replacement is intentional.
 
 `--stability <stability>`
 :   Perform a Nix expression build using a base package set of the given
```

**File**: `cli/flox/src/commands/publish.rs` (modified, +9/-2)
```diff
@@ -72,12 +72,19 @@ async fn confirm_lineage_change(change: &SourceLineageChange) -> Result<bool, Pu
     message::warning(formatdoc! {
         "Package source repository or ref has changed.
         Registered source: {registered}
-        Requested source: {requested}",
+        Requested source: {requested}
+
+        Changing the repository can affect which build other packages lock as an input.
+        Where automated builds run, future builds use the newly registered source.
+        Previously published builds remain stored; existing locks are unchanged.
+
+        Continue only if the requested repository and ref are the intended source for
+        this package going forward.",
         registered = change.registered,
         requested = change.requested,
     });
     let confirmed = Dialog {
-        message: "Replace the registered source and publish?",
+        message: "Change the registered source and publish?",
         help_message: None,
         typed: Confirm {
             default: Some(false),
```

**File**: `cli/floxhub-client/src/error.rs` (modified, +4/-1)
```diff
@@ -53,7 +53,10 @@ pub type ApiErrorResponseValue = ResponseValue<ApiErrorResponse>;
 /// The sources as reported by the server in a publish refusal.
 #[derive(Clone, Debug, PartialEq, Eq, Error)]
 #[error(
-    "Package source repository or ref has changed.\nRegistered source: {registered}\nRequested source: {requested}\nTo replace the registered source, retry your publish command with '--allow-lineage-change' added."
+    "Package source repository or ref has changed.\n\
+     Registered source: {registered}\n\
+     Requested source: {requested}\n\
+     To replace the registered source, retry your publish command with '--allow-lineage-change' added."
 )]
 pub struct SourceLineageChange {
     pub registered: String,
```

---

### Incident Patch 8: `90b2ace4` (2026-09-30)
**Commit Message**: fix(publish): address lineage confirmation review feedback

**File**: `cli/flox-rust-sdk/src/providers/publish.rs` (modified, +31/-2)
```diff
@@ -137,7 +137,10 @@ pub trait Publisher {
     ///
     /// `allow_lineage_change` explicitly authorizes a source change. Otherwise,
     /// `confirm_lineage_change` is called only after a lineage refusal, before
-    /// retrying the metadata submission once. Returning false preserves the refusal.
+    /// retrying the metadata submission once. Returning `Ok(false)` preserves the
+    /// refusal when confirmation is unavailable. Returning
+    /// `Err(PublishError::LineageChangeDeclined)` signals an explicit decline
+    /// or cancellation.
     ///
     /// Returns `true` when the caller should wait for an external publisher
     /// to confirm completion (Publisher mode), or `false` when the CLI has
@@ -1481,7 +1484,33 @@ pub mod tests {
             "ref": "release",
             "rev": "abc123",
             "rev_count": 1,
-            "rev_date": "2026-01-01T00:00:00Z"
+            "rev_date": "2026-01-01T00:00:00Z",
+            "narinfos": {
+                "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa": {
+                    "path": "/nix/store/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-hello",
+                    "url": "nar/hello.nar.xz",
+                    "compression": "xz",
+                    "narSize": 1024
+                }
+            },
+            "narinfos_source_url": "https://cache.example.test/hello/narinfos.json",
+            "cache_uri": "https://cache.example.test",
+            "locked_inputs": {
+                "dependency": {
+                    "attr_path": ["packages", "dependency"],
+                    "build_type": "manifest",
+                    "catalog": "test",
+                    "locked_inputs_hash": "dependency-closure-hash",
+                    "source": {
+                        "type": "git",
+                        "url": "https://github.com/org/dependency",
+                        "ref": "main",
+                        "rev": "def456",
+                        "dir": "."
+                    }
+                }
+            },
+            "locked_base_catalog_url": "https://github.com/flox/nixpkgs?rev=abc123"
         }))
         .unwrap();
         let initial = server.mock(|when, then| {
```

**File**: `cli/flox/doc/flox-publish.md` (modified, +3/-0)
```diff
@@ -135,6 +135,9 @@ Note that this is a paid feature available with Flox for Teams.
     Without this option, a refused source change requires interactive
     confirmation showing the registered and requested sources.
     Use this option to confirm source changes in non-interactive environments.
+    This option also disables the existing-build deduplication shortcut.
+    An interactive ref-only change at an already-published commit can return
+    "already published" without reaching the confirmation prompt.
 
 `--stability <stability>`
 :   Perform a Nix expression build using a base package set of the given
```

**File**: `cli/flox/src/commands/publish.rs` (modified, +6/-1)
```diff
@@ -85,7 +85,12 @@ async fn confirm_lineage_change(change: &SourceLineageChange) -> Result<bool, Pu
     }
     .prompt()
     .await
-    .map_err(|err| PublishError::Catchall(format!("Could not confirm source change: {err}")))?;
+    .map_err(|err| match err {
+        inquire::InquireError::OperationCanceled | inquire::InquireError::OperationInterrupted => {
+            PublishError::LineageChangeDeclined
+        },
+        err => PublishError::Catchall(format!("Could not confirm source change: {err}")),
+    })?;
     if !confirmed {
         return Err(PublishError::LineageChangeDeclined);
     }
```

**File**: `cli/floxhub-client/src/error.rs` (modified, +2/-2)
```diff
@@ -50,10 +50,10 @@ pub enum PublishError {
 pub type ApiErrorResponse = api_types::ErrorResponse;
 pub type ApiErrorResponseValue = ResponseValue<ApiErrorResponse>;
 
-/// The canonical, credential-free sources reported by a publish refusal.
+/// The sources as reported by the server in a publish refusal.
 #[derive(Clone, Debug, PartialEq, Eq, Error)]
 #[error(
-    "Package source repository or ref has changed.\nRegistered source: {registered}\nRequested source: {requested}\nTo replace the registered source, retry with 'flox publish --allow-lineage-change'."
+    "Package source repository or ref has changed.\nRegistered source: {registered}\nRequested source: {requested}\nTo replace the registered source, retry your publish command with '--allow-lineage-change' added."
 )]
 pub struct SourceLineageChange {
     pub registered: String,
```

---

### Incident Patch 9: `4f9e2b54` (2026-09-30)
**Commit Message**: fix(publish): report a declined source change as a cancel, not a failure

Declining the lineage-change confirmation printed "Failed to publish package: Publish canceled. ...".
Give the decline its own PublishError variant and surface it without the failure prefix.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `cli/flox-rust-sdk/src/providers/publish.rs` (modified, +4/-0)
```diff
@@ -113,6 +113,10 @@ pub enum PublishError {
 
     #[error("Timed out waiting for publish completion")]
     PublishTimeout,
+
+    /// The user declined to replace the package's registered source.
+    #[error("Publish canceled. The registered source was not changed.")]
+    LineageChangeDeclined,
 }
 
 /// The `Publish` trait describes the high level behavior of publishing a package to a catalog.
```

**File**: `cli/flox/src/commands/publish.rs` (modified, +3/-3)
```diff
@@ -87,9 +87,7 @@ async fn confirm_lineage_change(change: &SourceLineageChange) -> Result<bool, Pu
     .await
     .map_err(|err| PublishError::Catchall(format!("Could not confirm source change: {err}")))?;
     if !confirmed {
-        return Err(PublishError::Catchall(
-            "Publish canceled. The registered source was not changed.".to_owned(),
-        ));
+        return Err(PublishError::LineageChangeDeclined);
     }
     Ok(true)
 }
@@ -536,6 +534,8 @@ impl Publish {
             .await
         {
             Ok(needs_wait) => needs_wait,
+            // A declined confirmation is a deliberate cancel, not a failure.
+            Err(e @ PublishError::LineageChangeDeclined) => return Err(e.into()),
             Err(e) => bail!("Failed to publish package: {}", display_chain(&e)),
         };
 
```

---

### Incident Patch 10: `4720e238` (2026-09-30)
**Commit Message**: fix(publish): restore build-publish debug log

The metadata submission moved into publish_build_with_confirmation and
lost its debug trace of the submitted build. Log it again, and log the
confirmed retry, so both requests show up in debug output.

Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `cli/flox-rust-sdk/src/providers/publish.rs` (modified, +2/-0)
```diff
@@ -169,6 +169,7 @@ async fn publish_build_with_confirmation(
     mut build_info: UserBuildPublish,
     confirm: impl AsyncFnOnce(&SourceLineageChange) -> Result<bool, PublishError>,
 ) -> Result<(), PublishError> {
+    tracing::debug!(?build_info, "Publishing build in catalog...");
     let result = client
         .publish_build(catalog_name, package_name, &build_info)
         .await;
@@ -177,6 +178,7 @@ async fn publish_build_with_confirmation(
         && confirm(change).await?
     {
         build_info.allow_lineage_change = true;
+        tracing::debug!("Retrying build publish with confirmed lineage change...");
         return client
             .publish_build(catalog_name, package_name, &build_info)
             .await
```

---

### Incident Patch 11: `5948a658` (2026-10-01)
**Commit Message**: fix(cli): address schema update review feedback

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -1579,6 +1579,7 @@ dependencies = [
  "floxhub-client",
  "fslock",
  "futures",
+ "http 1.4.0",
  "httpmock",
  "indent",
  "indicatif",
```

**File**: `cli/flox-rust-sdk/src/providers/catalog.rs` (modified, +1/-1)
```diff
@@ -500,7 +500,7 @@ pub fn base_catalog_url_for_stability_arg(
                 formatdoc! {"
                     The default stability {} does not exist (or has not yet been populated).
                     Available stabilities are: {available_stabilities}
-                ", DEFAULT_STABILITY.as_str()}
+                ", DEFAULT_STABILITY}
             };
 
             let url = base_catalog_info
```

**File**: `cli/flox/Cargo.toml` (modified, +1/-0)
```diff
@@ -87,6 +87,7 @@ zbus-secret-service-keyring-store.workspace = true
 factory-api-v1.workspace = true
 flox-events = { workspace = true, features = ["tests"] }
 floxhub-client = { workspace = true, features = ["tests"] }
+http.workspace = true
 httpmock.workspace = true
 pretty_assertions.workspace = true
 proptest.workspace = true
```

**File**: `cli/flox/src/commands/factory/cancel.rs` (modified, +50/-22)
```diff
@@ -105,25 +105,31 @@ fn classify_error(err: &FactoryClientError, id: BuildId) -> (String, u8) {
             .to_string(),
             4,
         ),
-        // A server-side error (5xx/422), or a 409 saying the build's dispatch is
-        // still in flight: the host answered over HTTP and the condition is
-        // transient, so it is retryable. Exit 1; the cancel endpoint documents
-        // both 502 and 409 as retry-with-backoff.
+        // A 409 means the coordinator has not received the build yet.
+        FactoryClientError::Server(api)
+            if api.status().is_some_and(|status| status.as_u16() == 409) =>
+        {
+            (
+                formatdoc! {"
+                    The Flox Factory is still dispatching build {id}.
+                    Try 'flox factory cancel {id}' again in a moment."},
+                1,
+            )
+        },
+        // A 502 can also mean the coordinator lost the build. Do not promise
+        // that retry will resolve every service failure.
         FactoryClientError::Server(_) => (
             formatdoc! {"
-                The Flox Factory reported a server error for build {id}.
-                This is usually temporary; wait a moment and try again."},
+                The Flox Factory could not confirm cancellation for build {id}.
+                Try again in a moment.
+                If the problem persists, run 'flox factory status {id}' to check its state."},
             1,
         ),
-        // A non-auth 4xx, or a body that did not parse as a build: an
-        // unrecognised response, reported as a generic service error and retried
-        // rather than escalated. Exit 1. Naming the variant rather than using
-        // `_` makes a future error variant a compile error rather than a silent
-        // default.
+        // An unrecognized response has no known recovery action. Exit 1.
         FactoryClientError::APIError(_) => (
             formatdoc! {"
                 The Flox Factory could not cancel build {id}.
-                This is usually temporary; wait a moment and try again."},
+                Run 'flox factory status {id}' to check its state."},
             1,
         ),
     }
@@ -215,6 +221,15 @@ mod tests {
         n.to_string().parse().unwrap()
     }
 
+    fn server_error(status: u16) -> FactoryClientError {
+        let response = http::Response::builder()
+            .status(status)
+            .body(String::new())
+            .unwrap()
+            .into();
+        FactoryClientError::Server(FactoryApiError::UnexpectedResponse(response))
+    }
+
     // -------------------------------------------------------------------------
     // success_outcome: the status-to-outcome mapping
     // -------------------------------------------------------------------------
@@ -353,16 +368,28 @@ mod tests {
     }
 
     #[test]
-    fn server_is_service_error_exit_1() {
-        // A 5xx is a retryable service fault; the cancel endpoint documents 502
-        // as retry-with-backoff.
-        let err = FactoryClientError::Server(FactoryApiError::InvalidRequest("5xx".to_string()));
+    fn dispatch_in_flight_is_retryable_exit_1() {
         assert_eq!(
-            classify_error(&err, id(7)),
+            classify_error(&server_error(409), id(7)),
+            (
+                indoc! {"
+                    The Flox Factory is still dispatching build 7.
+                    Try 'flox factory cancel 7' again in a moment."}
+                .to_string(),
+                1,
+            )
+        );
+    }
+
+    #[test]
+    fn service_failure_is_exit_1_without_promising_recovery() {
+        assert_eq!(
+            classify_error(&server_error(502), id(7)),
             (
                 indoc! {"
-                    The Flox Factory reported a server error for build 7.
-                    This is usually temporary; wait a moment and try again."}
+                    The Flox Factory could not confirm cancellation for build 7.
+                    Try again in a moment.
+                    If the problem persists, run 'flox factory status 7' to check its state."}
                 .to_string(),
                 1,
             )
@@ -380,7 +407,7 @@ mod tests {
             (
                 indoc! {"
                     The Flox Factory could not cancel build 7.
-                    This is usually temporary; wait a moment and try again."}
+                    Run 'flox factory status 7' to check its state."}
                 .to_string(),
                 1,
             )
@@ -465,8 +492,9 @@ mod tests {
             "the DELETE should have been issued"
         );
         assert_eq!(writer.to_string(), indoc! {"
-            ✘ ERROR: The Flox Factory reported a server error for build 42.
-            This is usually temporary; wait a moment and try again.
+            ✘ ERROR: The Flox Factory could not confirm cancellation for build 42.
+            Try again in a moment.
+            If 
```

**File**: `cli/floxhub-client/src/factory.rs` (modified, +4/-4)
```diff
@@ -58,12 +58,12 @@ pub enum FactoryClientError {
     #[error("{}", fmt_api_error(.0))]
     AuthRejected(APIError<ErrorResponse>),
 
-    /// The Flox Factory reported a server-side error (HTTP 5xx, or 422).
+    /// The cancel endpoint reported HTTP 409, 422, or 5xx.
     ///
     /// Distinct from [`FactoryClientError::Transport`] because the host did
-    /// respond: the failure is the service's, and the same request may succeed
-    /// on retry. Wraps the underlying error so the server's `detail` still
-    /// renders, matching the `APIError` variant.
+    /// respond. The status distinguishes a dispatch still in flight (409) from
+    /// service failures, some of which may persist (502). Wraps the underlying
+    /// error so the server's `detail` remains available.
     #[error("{}", fmt_api_error(.0))]
     Server(APIError<ErrorResponse>),
 
```

**File**: `cli/floxhub-client/src/lib.rs` (modified, +1/-3)
```diff
@@ -33,8 +33,6 @@
 //! let builds = client.list_builds(&Default::default()).await?;
 //! ```
 
-use std::sync::LazyLock;
-
 mod accounts;
 pub mod auth;
 pub mod client;
@@ -47,7 +45,7 @@ pub(crate) mod mock;
 
 pub const DEFAULT_CATALOG_URL: &str = "https://api.flox.dev";
 /// The base-catalog stability used when a caller names none.
-pub static DEFAULT_STABILITY: LazyLock<Stability> = LazyLock::new(|| Stability::from("stable"));
+pub const DEFAULT_STABILITY: &str = "stable";
 pub const FLOX_CATALOG_MOCK_DATA_VAR: &str = "_FLOX_USE_CATALOG_MOCK";
 pub const FLOX_CATALOG_DUMP_DATA_VAR: &str = "_FLOX_CATALOG_DUMP_RESPONSE_FILE";
 /// Sets `PackageGroup.stability` on the wire during mock recording runs.
```

**File**: `cli/floxhub-client/src/types.rs` (modified, +10/-54)
```diff
@@ -49,50 +49,6 @@ pub use api_types::{
     UnresolvableEntry,
     UnresolvableLeaf,
 };
-
-/// The name of a base-catalog stability, e.g. `stable` or `lts`.
-///
-/// The catalog server accepts any string here and performs no validation, so
-/// this carries no parse step; it exists to keep stabilities distinguishable
-/// from the other bare strings that travel alongside them. Requests hold the
-/// wire type, so convert at the call to the generated client.
-///
-/// The type carries no default. Which stability applies when a caller names
-/// none is a property of the catalog, not of the name, so callers derive it
-/// from [`DEFAULT_STABILITY`].
-#[derive(Debug, Clone, PartialEq, Eq, Hash)]
-pub struct Stability(String);
-
-impl Stability {
-    pub fn as_str(&self) -> &str {
-        &self.0
-    }
-}
-
-impl From<String> for Stability {
-    fn from(value: String) -> Self {
-        Stability(value)
-    }
-}
-
-impl From<&str> for Stability {
-    fn from(value: &str) -> Self {
-        Stability(value.to_owned())
-    }
-}
-
-impl From<Stability> for String {
-    fn from(value: Stability) -> Self {
-        value.0
-    }
-}
-
-impl Display for Stability {
-    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
-        Display::fmt(&self.0, f)
-    }
-}
-
 // Command lookup. Unlike search, by-command is unpaginated, so the generated
 // result type is already the whole answer and needs no `ResultsPage` wrapper.
 pub use api_types::{ByCommandResult, CommandProvider};
@@ -471,7 +427,7 @@ impl BaseCatalogInfo {
 
     /// Return a url for the "default" stability.
     pub fn url_for_latest_page_with_default_stability(&self) -> Option<BaseCatalogUrl> {
-        self.url_for_latest_page_with_stability(DEFAULT_STABILITY.as_str())
+        self.url_for_latest_page_with_stability(DEFAULT_STABILITY)
     }
 
     /// Return the names of available stabilities.
@@ -497,14 +453,14 @@ impl BaseCatalogInfo {
                 api_types::PageInfo {
                     rev: "".into(),
                     rev_count: 2,
-                    stability_tags: ["stable".into(), "not-default".into()].to_vec(),
+                    stability_tags: [DEFAULT_STABILITY.into(), "not-default".into()].to_vec(),
                 },
             ]
             .to_vec(),
             stabilities: [
                 api_types::StabilityInfo {
-                    name: "stable".into(),
-                    ref_: "stable".into(),
+                    name: DEFAULT_STABILITY.into(),
+                    ref_: DEFAULT_STABILITY.into(),
                 },
                 api_types::StabilityInfo {
                     name: "not-default".into(),
@@ -539,14 +495,14 @@ mod tests {
                 api_types::PageInfo {
                     rev: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb2".into(),
                     rev_count: 5,
-                    stability_tags: ["stable".into(), "not-default".into()].to_vec(),
+                    stability_tags: [DEFAULT_STABILITY.into(), "not-default".into()].to_vec(),
                 },
             ]
             .to_vec(),
             stabilities: [
                 api_types::StabilityInfo {
-                    name: "stable".into(),
-                    ref_: "stable".into(),
+                    name: DEFAULT_STABILITY.into(),
+                    ref_: DEFAULT_STABILITY.into(),
                 },
                 api_types::StabilityInfo {
                     name: "not-default".into(),
@@ -574,12 +530,12 @@ mod tests {
         );
     }
 
-    /// The default stability ("stable") selects the page tagged "stable".
+    /// The default stability selects the page tagged with it.
     #[test]
     fn url_for_latest_page_with_default_stability_returns_page_with_stable_tag() {
         let info = two_page_fixture();
 
-        // page1 carries "stable".
+        // page1 carries the default stability.
         let url = info.url_for_latest_page_with_default_stability();
         assert_eq!(
             url,
@@ -631,7 +587,7 @@ mod tests {
         let mut stabilities = info.available_stabilities();
         stabilities.sort_unstable();
 
-        assert_eq!(stabilities, vec!["not-default", "stable"]);
+        assert_eq!(stabilities, vec!["not-default", DEFAULT_STABILITY]);
     }
 
     #[test]
```

**File**: `cli/nef-lock-catalog/src/lock/lookup.rs` (modified, +2/-2)
```diff
@@ -92,7 +92,7 @@ fn build_request(references: BTreeSet<CatalogRef>) -> BuildInputsLookupRequest {
         // stability. The server accepts and ignores the field, and the spec
         // marks it deprecated, but older servers still read it, so send the
         // default stability until the field is dropped from the spec.
-        stability: Some(DEFAULT_STABILITY.clone().into()),
+        stability: Some(DEFAULT_STABILITY.to_owned()),
     }
 }
 
@@ -172,7 +172,7 @@ mod tests {
         );
         assert_eq!(
             serde_json::to_value(&wire.stability).unwrap(),
-            json!("stable")
+            json!(DEFAULT_STABILITY)
         );
         assert!(wire.reference_point.is_none());
     }
```

---

### Incident Patch 12: `5d321367` (2026-09-30)
**Commit Message**: test(buildenv): answer the store-info query in the namespaced-package test

`verify_build_closure_accepts_namespaced_package_in_runtime_packages`
builds a hand-written lockfile whose `floxexamples/hello` entry is a
custom catalog package. `realise_lockfile` asks the catalog client where
to download a custom catalog package unless its outputs are already in
the local store, and the test's `MockClient` had no response queued, so
the test only passed when some other test had realised the same `hello`
store path first. Today the `build-runtime-*` cassettes lock the same
nixpkgs revision and supply that path.

The mock regeneration that follows moves those cassettes to a newer
nixpkgs revision, so on a fresh CI store nothing realises the path
first, and both `unit` jobs failed with "expected get_store_info
response, found None".

Queue a store-info response pointing each `myhello` output at
cache.nixos.org, which serves all three systems' paths and needs no
auth, so the test no longer depends on test ordering or store state.

Refs: flox/flox#4739
Review-depth: medium
Review-reason: Removes a hidden test-ordering dependency; check the mocked response matches what realise asks for
Forge-A

**File**: `cli/flox-rust-sdk/src/providers/buildenv.rs` (modified, +30/-1)
```diff
@@ -2355,6 +2355,7 @@ mod buildenv_tests {
     use flox_manifest::parsed::latest::ManifestPackageDescriptor;
     use flox_manifest::raw::test_helpers::empty_test_migrated_manifest;
     use flox_test_utils::{GENERATED_DATA, MANUALLY_GENERATED};
+    use floxhub_client::StoreInfoResponse;
     use tempfile::TempDir;
     use test_helpers::buildenv_instance;
 
@@ -2882,7 +2883,35 @@ mod buildenv_tests {
         let buildenv = buildenv_instance();
         let lockfile_path = MANUALLY_GENERATED
             .join("buildenv/lockfiles/runtime-packages-namespaced-hello/manifest.lock");
-        let client = MockClient::new();
+
+        // A namespaced package is a custom catalog package, so the build asks
+        // the catalog where to download it unless it is already in the local
+        // store. Answer that query rather than relying on some other test
+        // having realised the same store path first. `hello` itself comes
+        // from nixpkgs, so the public cache serves it.
+        let lockfile =
+            Lockfile::read_from_file(&CanonicalPath::new(&lockfile_path).unwrap()).unwrap();
+        let items = lockfile
+            .packages
+            .iter()
+            .filter_map(|pkg| match pkg {
+                LockedPackage::Catalog(p) if p.install_id == "myhello" => Some(p),
+                _ => None,
+            })
+            .flat_map(|p| p.outputs.values().cloned())
+            .map(|store_path| {
+                (store_path, vec![StoreInfo {
+                    url: Some("https://cache.nixos.org".to_string()),
+                    auth: None,
+                    catalog: None,
+                    package: None,
+                    public_keys: None,
+                }])
+            })
+            .collect();
+        let mut client = MockClient::new();
+        client.push_store_info_response(StoreInfoResponse { items });
+
         let result = buildenv.build(&client, &lockfile_path, None, None).unwrap();
 
         let runtime = result.run.as_ref();
```

---

### Incident Patch 13: `56682969` (2026-09-30)
**Commit Message**: fix(cli): stop detached children from clobbering mock recordings

`just gen-data --force` was producing 0-byte cassettes: every
regenerated file under `test_data/generated/` came back empty, and jobs
with a `post_cmd` that parsed the empty response (e.g.
`darwin_ps_incompatible_transform_error_to_general`) failed with "jq:
Cannot iterate over null".

Root cause: `main.rs` spawns a detached `send-telemetry` child after
every command via `DetachedCommand::spawn`, which inherits the parent
environment, including `_FLOX_CATALOG_DUMP_RESPONSE_FILE`. Every
dispatch, the child's included, builds its own `FloxhubClient`, so the
child constructs a second Record-mode client pointed at the same
destination. It makes no catalog requests, so when its client drops it
overwrites the foreground command's correct recording with an empty
one. Timestamped debug logs from both processes confirm the sequence:
the foreground writes a valid recording, and the child opens a fresh
recorder on the same path and overwrites it ~15ms later.
`check-for-upgrades` shares the spawn path and the exposure.

`DetachedCommand::configure` now removes `FLOX_CATALOG_DUMP_DATA_VAR`
from every detached child, closing the e

**File**: `cli/flox/src/utils/detached.rs` (modified, +85/-2)
```diff
@@ -59,8 +59,9 @@ impl DetachedCommand<'_> {
     /// Build the child [`Command`], with env, args, but no stdio or `pre_exec`
     /// (those need the log file handle that only `spawn` opens).
     ///
-    /// Split out from `spawn` so the env-var handling is unit-testable via
-    /// [`Command::get_envs`] without forking a real child.
+    /// Split out from `spawn` so the env-var handling — in particular the
+    /// mock-recording scrub below — is unit-testable via [`Command::get_envs`]
+    /// without forking a real child.
     fn configure(&self, self_executable: &std::path::Path) -> Command {
         let mut command = Command::new(self_executable);
 
@@ -76,6 +77,27 @@ impl DetachedCommand<'_> {
             command.env(FLOX_INVOCATION_ID_VAR, parent_invocation_id.to_string());
         }
 
+        // Every dispatch — including this child's own — builds its own
+        // FloxhubClient via `init_floxhub_client`, which reads
+        // `_FLOX_CATALOG_DUMP_RESPONSE_FILE` fresh from the environment. Left
+        // inherited, a mock-recording session around the foreground command
+        // means this child records its own, unrelated traffic (or none at
+        // all) to the *same* destination file, and overwrites whatever the
+        // foreground command already recorded there when its own client
+        // drops — this is how `just gen-data` produced 0-byte cassettes
+        // despite the foreground `flox install` succeeding. Recording is a
+        // write, and two independent writers to the same file race.
+        //
+        // Replay mode (`_FLOX_USE_CATALOG_MOCK`) does not share that failure:
+        // it only reads a cassette, so any number of clients replaying the
+        // same file are independent. It is also load-bearing, not just
+        // harmless — `check-for-upgrades` is itself a detached child, and
+        // integration tests (e.g. activate.bats's upgrade-check test) set
+        // this var on the foreground command specifically so that child
+        // replays deterministically instead of hitting the network. Leave it
+        // inherited.
+        command.env_remove(floxhub_client::FLOX_CATALOG_DUMP_DATA_VAR);
+
         for arg in self.args {
             command.arg(arg);
         }
@@ -88,6 +110,8 @@ impl DetachedCommand<'_> {
     /// The child:
     /// - inherits the parent's `FLOX_VERSION` and invocation-id env vars so its
     ///   v2 events join the parent's stream;
+    /// - does not inherit the mock-recording env var, but does inherit the
+    ///   mock-replay one (see [`Self::configure`]);
     /// - has stdin/stdout redirected to `/dev/null` (stdout hygiene is critical
     ///   for `hook-env`, whose stdout is the shell's command-substitution buffer);
     /// - has stderr redirected to a log file under `log_dir`;
@@ -219,6 +243,65 @@ mod tests {
         );
     }
 
+    /// The detached child must never inherit the mock-recording env var,
+    /// regardless of what the spawning process has set — a Record-mode child
+    /// that makes no catalog request (or an unrelated one) overwrites
+    /// whatever the foreground command already recorded to the same
+    /// destination when its own client drops. It must still inherit the
+    /// mock-replay env var, which only reads. Asserted via `get_envs()`
+    /// rather than by actually spawning: `Command`'s env diff only lists vars
+    /// this call touched, so an explicit `env_remove` reads back as `None`
+    /// regardless of the real process environment, while a var this code
+    /// never mentions would not appear at all.
+    #[test]
+    fn configure_strips_the_record_var_but_preserves_the_replay_var() {
+        use std::ffi::OsStr;
+
+        temp_env::with_vars(
+            [
+                (
+                    floxhub_client::FLOX_CATALOG_DUMP_DATA_VAR,
+                    Some("/tmp/some-cassette.yaml"),
+                ),
+                (
+                    floxhub_client::FLOX_CATALOG_MOCK_DATA_VAR,
+                    Some("/tmp/some-other-cassette.yaml"),
+                ),
+            ],
+            || {
+                let args: Vec<String> = vec![];
+                let command = DetachedCommand {
+                    args: &args,
+                    log_file: LogFile::Rolling(SEND_TELEMETRY_LOG_NAME.to_string()),
+                    log_dir: Path::new("/tmp"),
+                }
+                .configure(Path::new("/bin/true"));
+
+                let envs: std::collections::HashMap<_, _> = command.get_envs().collect();
+                assert_eq!(
+                    envs.get(OsStr::new(floxhub_client::FLOX_CATALOG_DUMP_DATA_VAR)),
+                    Some(&None),
+                    "dump-recording var must be explicitly removed, not merely absent \
+                     — two independent recorders writing the same destination is the \
+                     bug this guards against"
+                );
+                // `configure` must never h
```

---

### Incident Patch 14: `cfcff295` (2026-09-30)
**Commit Message**: fix(floxhub-client): save mock recordings beside their destination

`MockRecorder::drop` used httpmock's `record_save`, which always writes
its temp file under this crate's own `target/httpmock/recordings`
before the subsequent `fs::rename` moves it to the caller's destination.
When that destination is a `tempfile::tempdir()` under `$TMPDIR` — as
`list_builds_routes_through_mock_guard_in_replay_mode` uses — and
`$TMPDIR` is a different filesystem than the checkout (e.g. a tmpfs
`/tmp`), `fs::rename` is a plain `rename(2)` and panics with EXDEV.

Switching to `record_save_to`, saving into the destination's own parent
directory, guarantees the rename that follows is same-directory and can
never cross a device boundary.

Reproduced by running the affected test through `just unit-tests` with
`TMPDIR=/dev/shm` (tmpfs) against an ext4 checkout: red before this
change (`Os { code: 18, kind: CrossesDevices, ... }`), green after. The
existing test covers exactly this reproduction, so no new test is added.

Refs: flox/flox#4739
Review-depth: low
Review-reason: Test-infrastructure temp-file location; exercised by an existing test
Forge-Agent: commit-builder (ad757c41)
Co-Authored-By: Claude O

**File**: `cli/floxhub-client/src/mock.rs` (modified, +16/-1)
```diff
@@ -151,10 +151,25 @@ impl Drop for MockRecorder {
 
         // `save` and `save_to` append a timestamp, so we rename after write.
         // https://github.com/alexliesenfeld/httpmock/issues/115
+        //
+        // Save beside the destination (`record_save_to`) rather than
+        // httpmock's default `record_save`, which always writes under this
+        // crate's own `target/httpmock/recordings`. A caller's destination
+        // can be a `tempfile::tempdir()` on `$TMPDIR`, and `target/` and
+        // `$TMPDIR` are frequently different mounts (e.g. a tmpfs `/tmp`) —
+        // the `fs::rename` below is a plain `rename(2)`, which fails with
+        // `EXDEV` across a filesystem boundary. Saving into the
+        // destination's own parent directory guarantees the rename that
+        // follows never crosses one.
+        let save_dir = self
+            .path
+            .parent()
+            .expect("destination path should have a parent directory");
         let tempfile = self
             .server
-            .record_save(
+            .record_save_to(
                 &self.recording,
+                save_dir,
                 // We need something unique in the name otherwise parallel
                 // threads can race each other
                 format!(
```

---

### Incident Patch 15: `d3d7cbf0` (2026-09-30)
**Commit Message**: fix(factory): treat a 409 on cancel as retryable

The factory spec split the cancel endpoint's "the coordinator does not
know the build yet because its dispatch is in flight" case out of 502
into its own 409, leaving 502 for an unreachable coordinator or a build
it has no record of. Both are documented as retry with backoff.

`classify_build_error` only bucketed `422 | 500..=599` as
`FactoryClientError::Server`, so the new 409 fell through to the
generic `APIError`. The exit code does not change — `flox factory
cancel` maps both variants to exit 1 with retry advice — but the
message would read "could not cancel build" instead of naming a
transient service error, and any future caller distinguishing the two
would misclassify it.

Refs: flox/flox#4739, flox/flox#4702
Review-depth: medium
Review-reason: Changes error classification for one status code; covered by a new unit test
Forge-Agent: commit-builder (ad757c41)
Co-Authored-By: Claude Opus 5.5 (1M context) <[REDACTED_EMAIL]>

**File**: `cli/flox/src/commands/factory/cancel.rs` (modified, +4/-3)
```diff
@@ -105,9 +105,10 @@ fn classify_error(err: &FactoryClientError, id: BuildId) -> (String, u8) {
             .to_string(),
             4,
         ),
-        // A server-side error (5xx/422): the host answered over HTTP and erred,
-        // so it is retryable. Exit 1; the cancel endpoint documents 502 as
-        // retry-with-backoff.
+        // A server-side error (5xx/422), or a 409 saying the build's dispatch is
+        // still in flight: the host answered over HTTP and the condition is
+        // transient, so it is retryable. Exit 1; the cancel endpoint documents
+        // both 502 and 409 as retry-with-backoff.
         FactoryClientError::Server(_) => (
             formatdoc! {"
                 The Flox Factory reported a server error for build {id}.
```

**File**: `cli/floxhub-client/src/factory.rs` (modified, +19/-2)
```diff
@@ -174,8 +174,11 @@ fn classify_build_error(err: FactoryClientError) -> FactoryClientError {
         Some(401 | 403) => FactoryClientError::AuthRejected(api),
         // 5xx is a service fault. 422 only arises from a non-integer path
         // (FastAPI request validation), which an `i64` never produces, so it is
-        // mapped here defensively rather than left as a generic API error.
-        Some(422 | 500..=599) => FactoryClientError::Server(api),
+        // mapped here defensively rather than left as a generic API error. 409
+        // is the cancel endpoint's "the coordinator does not know the build
+        // yet, its dispatch is in flight" answer, which the spec documents as
+        // retry with backoff.
+        Some(409 | 422 | 500..=599) => FactoryClientError::Server(api),
         // Everything else (a non-auth 4xx, or a 200 whose body did not parse as
         // a `BuildResponse`) degrades to the generic API error.
         _ => FactoryClientError::APIError(api),
@@ -966,6 +969,20 @@ pub mod tests {
         );
     }
 
+    #[tokio::test]
+    async fn cancel_build_maps_409_to_server() {
+        let err = cancel_build_against_mock(
+            409,
+            json!({ "detail": "Build registration still in flight" }),
+        )
+        .await
+        .unwrap_err();
+        assert!(
+            matches!(err, FactoryClientError::Server(_)),
+            "expected Server, got {err:?}"
+        );
+    }
+
     #[tokio::test]
     async fn cancel_build_maps_422_to_server() {
         let err = cancel_build_against_mock(422, json!({ "detail": "Unprocessable" }))
```

#### Recent Merged Pull Requests:
- **PR #4751** (2026-10-01): feat(check-for-upgrades): DEV-324 skip resolve when not logged in (@stephenyeargin)
- **PR #4747** (2026-10-01): feat(publish): confirm source lineage changes before retrying (@billlevine)
- **PR #4743** (2026-10-02): perf(telemetry): only exec when necessary (@mkenigs)
- **PR #4742** (2026-09-29): fix(buildenv): match runtime-packages by install_id, not attr_path/pkg-path (@stephenyeargin)
- **PR #4739** (2026-10-01): build: Update FloxHub API schemas to 0509d5c3 (@floxbot)
- **PR #4732** (2026-09-29): feat(manifest): per-environment upgrade notifications opt-out (@djsauble)
- **PR #4731** (2026-09-25): fix(envs): hide remote-env cache checkout from inactive list (@stephenyeargin)
- **PR #4729** (closed): build: Update FloxHub API schemas to bb4a0564 (@floxbot)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

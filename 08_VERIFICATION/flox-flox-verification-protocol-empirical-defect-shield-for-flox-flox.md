# Verification Protocol: Verification Protocol: Empirical Defect Shield for flox/flox

<!-- PROVENANCE_START
{
  "source_repository": "flox/flox",
  "source_url": "https://github.com/flox/flox",
  "source_version": "historical-head",
  "license": "OPEN_HARVEST",
  "timestamp": "2026-11-13T00:00:00.000Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "unknown",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [flox/flox](https://github.com/flox/flox) (Revision: `historical`).  
> **License**: OPEN_HARVEST | **Timestamp**: `2026-11-13T00:00:00.000Z`  
> **Learning ID**: `unknown`


## 1. Scope & Verification Target
- **Target Repository**: `flox/flox` (Commit: `historical`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/flox-flox-learnings.md`  
> **Source**: github ([https://github.com/flox/flox](https://github.com/flox/flox))  
> **Source Version**: `9a1a9e7c`  
> **License**: GPL-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-11T18:16:45.724Z  
> **Learning ID**: `learn-github-flox-flox`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): flox/flox

> **Canonical Artifact**: `07_PROJECT_LEARNING/flox-flox-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/flox/flox](https://github.com/flox/flox))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-11T18:11:44.806Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `flox/flox`
- **Description**: The Deterministic Foundation for your SDLC
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4201 stars

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
//! That only covers a subshell that is a separate process. A forked subshell
//! (`( cd .. )`, a command substitution, zsh's own `cd` completion) inherits
//! the map, and `$$` there still expands to the parent's PID. zsh's chpwd
//! functions and tcsh's `cwdcmd` alias run in such a fork when it changes
//! directory, so a hook that acted there would detach the parent shell from
//! an activation it is still using, or attach it to one it never entered,
//! while the environment changes die with the fork. Both hooks therefore do
//! nothing in a fork: zsh checks `ZSH_SUBSHELL`, and tcsh, which has no such
//! variable, has `hook-env` compare its parent PID with `--shell-pid`. bash
//! only runs the hook from `PROMPT_COMMAND`, which a fork never evaluates,
//! and fish has no forked subshells.
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
//
// The `ZSH_SUBSHELL` check keeps the hook out of forked subshells (see the
// module docs).
pub fn zsh_hook(flox_bin: &str) -> String {
    let marker = prompt_hook_marker_value(true);
    formatdoc!(
        r#"
        export {PROMPT_HOOK_VERSION_ENV}={marker};
        _flox_hook() {{
          if (( ZSH_SUBSHELL )); then return; fi;
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
//
// tcsh has nothing like `ZSH_SUBSHELL` to keep the hook out of forked
// subshells (see the module docs), so `hook-env` detects the fork instead:
// `exec` makes
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
use std::fs::{DirBuilder, File};
use std::ops::Deref;
use std::os::unix::fs::{DirBuilderExt, MetadataExt};
use std::path::{Path, PathBuf};

use anyhow::{Context, bail};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use time::OffsetDateTime;
use tracing::{debug, info, trace};

use crate::activate::mode::ActivateMode;
use crate::proc_status::pid_is_running;
use crate::{Version, open_lock_file, path_hash};

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
///
/// The executive's cleanup renames the activation state directory, state.lock
/// included, while it holds this lock (see `rename_state_for_removal` in
/// flox-activations). A process that opened state.lock before the rename would
/// wake up holding a lock on the renamed file, which no longer guards
/// state.json, while a process arriving after the rename locks a new
/// state.lock in a recreated directory. To rule that out, this checks after
/// locking that the locked file is still the one at the lock path, and starts
/// over if it is not.
pub fn acquire_activations_json_lock(
    activations_json_path: impl AsRef<Path>,
) -> Result<File, Error> {
    let lock_path = activations_json_lock_path(activations_json_path);
    let lock_path_parent = lock_path.parent().expect("lock path has parent");

    for _ in 0..MAX_LOCK_ATTEMPTS {
        DirBuilder::new()
            .recursive(true)
            .mode(0o700)
            .create(lock_path_parent)?;
        let lock = match open_lock_file(&lock_path) {
            Ok(lock) => lock,
            // The directory was renamed away after it was created above.
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => continue,
            Err(err) => return Err(err).context("failed to open lockfile"),
        };
        lock.lock().context("failed to lock lockfile")?;

        let locked = lock
            .metadata()
            .context("failed to read metadata of lockfile")?;
        match std::fs::metadata(&lock_path) {
            Ok(current) if (current.dev(), current.ino()) == (locked.dev(), locked.ino()) => {
                return Ok(lock);
            },
            Ok(_) => {},
            Err(err) if err.kind() == std::io::ErrorKind::NotFound => {},
            Err(err) => return Err(err).context("failed to read metadata of lockfile"),
        }
        debug!(
            ?lock_path,
            "lockfile was replaced while waiting for its lock, retrying"
        );
    }

    bail!(
        "failed to lock {}: the activation state directory kept being replaced",
        lock_path.display()
    )
}

/// How many times [acquire_activations_json_lock] starts over after the lock
/// file was replaced under it. Each retry needs another cleanup to have renamed
/// the directory, so this is only reached when something keeps replacing it.
const MAX_LOCK_ATTEMPTS: usize = 100;

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
/// function. We can't enforce the type here because t
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


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4779** (2026-10-29): **hook.on-deactivate runs even when hook.on-activate failed**
  *Symptoms*: **Describe the bug:**  When `hook.on-activate` exits non-zero, `flox activate` prints `Running hook.on-activate failed` and doesn't run the command. The executive still runs `hook.on-deactivate` for that start when it cleans up.  The manifest docs describe the two hooks as bookends, and the executive's comments say the same: "its hook only runs if hook.on-activate completed" ([executive/mod.rs L772-778](https://github.com/flox/flox/blob/ed7d29681df6134a9070bf6674f04d6ee2716898/cli/flox-activations/src/cli/executive/mod.rs#L772-L778)). `run_hook_script` skips a start only when it can't read the start's env trace ([on_deactivate.rs L101-106](https://github.com/flox/flox/blob/ed7d29681df6134a9070bf6674f04d6ee2716898/cli/flox-activations/src/on_deactivate.rs#L101-L106)), and a start whose `hook.on-activate` failed still has one, so the hook runs.  This matters for pairs like `createdb myapp || exit 1` and `dropdb myapp`: when `createdb` fails because the database already exists, the teardown drops the existing database.  **Steps to reproduce:**  ```bash mkdir failhook && cd failhook flox init cat > manifest.toml <<'EOF' schema-version = "1.18.0"  [hook] on-activate = '''   echo "on-activate: create database" >> "$FLOX_ENV_PROJECT/hooks.log"   exit 1 ''' on-deactivate = '''   echo "on-deactivate: drop database" >> "$FLOX_ENV_PROJECT/hooks.log" ''' EOF flox edit -f manifest.toml  flox activate -- echo "command ran" sleep 1 cat hooks.log ```  Result:  ``` ✘ ERROR: Running hook.on-ac

- **Issue #4777** (2026-10-08): **Concurrent activations of one environment fail intermittently: two executives, one deletes the other's state**
  *Symptoms*: **Describe the bug:**  When activations of one environment start and exit close together, `flox activate` sometimes fails. On an environment with an empty manifest I've seen four different errors:  ``` ✘ ERROR: failed to acquire lockfile: failed to open lockfile: No such file or directory (os error 2) ✘ ERROR: Running hook.on-activate failed ✘ ERROR: $XDG_CACHE_HOME/flox/run/activations/01175d93-lockrace/wj1ksyr8xhgmdlv3a45rgg0kn8c720g4-environment-dev.1791347582234/envtrace.log is empty ✘ ERROR: Executive 106 terminated unexpectedly with status: Exited(Pid(106), 1) ```  The second one appears although the environment has no hooks. The last one leaves state.json behind with `"ready": {"Starting": ...}`, a dead attached PID and a dead `executive_pid`.  All of them trace back to the state.json lock. When the last attachment goes away, `cleanup_all` renames the activation state directory, `state.lock` included, to `<dir>.cleanup.<pid>` while it holds the lock, then drops it ([executive/mod.rs L766-770](https://github.com/flox/flox/blob/ed7d29681df6134a9070bf6674f04d6ee2716898/cli/flox-activations/src/cli/executive/mod.rs#L766-L770)). `acquire_activations_json_lock` ([activations.rs L194-208](https://github.com/flox/flox/blob/ed7d29681df6134a9070bf6674f04d6ee2716898/cli/flox-core/src/activations.rs#L194-L208)) doesn't account for that:  1. If the rename lands between the `exists()` / `create_dir` check and `LockFile::open`, `open` fails with ENOENT. 2. A process that opened `stat

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

### Incident Patch 1: `12b42fe6` (2026-11-09)
**Commit Message**: fix(telemetry): keep metrics files out of the current directory on config errors (#4762)

When Flox can't parse its config, every invocation now prints the parse
error and exits 1, including `--help` and shell completion. Flox no
longer falls back to the default config, which has metrics on and empty
dirs. So it no longer creates `metrics-uuid` and `metrics-lock` in the
current directory, prints the first-run notice, or starts Sentry.

**Worth checking:** `--help` and completion now fail on an invalid
config, where they used to exit 0. Every subcommand, `flox config`
included, already failed on one. `run()` now takes the config `main()`
parsed rather than parsing it again.

**Not covered:** an empty or relative `FLOX_CACHE_DIR`, `FLOX_DATA_DIR`
or `FLOX_STATE_DIR` still resolves against the current directory.
`FLOX_DISABLE_METRICS` still accepts only `true`/`false`. Files that
earlier versions left behind are not cleaned up.

## Release Notes

- Fixed: Flox no longer writes `metrics-uuid` and `metrics-lock` into
the current directory when it can't parse its configuration. It now
reports the error for every command, including `flox --help`.

Stack: 2 of 6, merge bottom-up. Refs DEV-

**File**: `cli/flox/src/main.rs` (modified, +12/-4)
```diff
@@ -45,8 +45,7 @@ mod beta;
 mod commands;
 mod utils;
 
-async fn run(args: FloxArgs) -> Result<()> {
-    let config = Config::parse()?;
+async fn run(args: FloxArgs, config: Config) -> Result<()> {
     args.handle(config).await?;
     Ok(())
 }
@@ -119,7 +118,16 @@ fn main() -> ExitCode {
         return ExitCode::from(1);
     }
 
-    let config = Config::parse().unwrap_or_default();
+    // Exit rather than fall back to the defaults, which enable metrics and
+    // leave the data and cache dirs empty, so they would create the metrics
+    // UUID in the current directory whatever the unparsed sources set.
+    let config = match Config::parse() {
+        Ok(config) => config,
+        Err(err) => {
+            message::error(format!("{err:#}"));
+            return ExitCode::from(1);
+        },
+    };
     let metrics_uuid = if !config.flox.disable_metrics {
         init_telemetry_uuid(&config.flox.data_dir, &config.flox.cache_dir)
             .and_then(|_| read_metrics_uuid(&config))
@@ -206,7 +214,7 @@ fn main() -> ExitCode {
     let runtime = tokio::runtime::Runtime::new().unwrap();
 
     let dispatch_start = Instant::now();
-    let result = runtime.block_on(run(args));
+    let result = runtime.block_on(run(args, config.clone()));
 
     // Print errors; derive the exit code and the telemetry `error_kind`.
     let (code, error_kind): (u8, Option<&'static str>) = match &result {
```

**File**: `cli/tests/config-errors.bats` (added, +80/-0)
```diff
@@ -0,0 +1,80 @@
+#! /usr/bin/env bats
+# -*- mode: bats; -*-
+# ============================================================================ #
+#
+# Test that a config that does not parse is an error for every invocation,
+# and creates no telemetry state (no device ID, no Sentry client) and no files
+# in the current directory.
+#
+# ---------------------------------------------------------------------------- #
+
+load test_support.bash
+
+# bats file_tags=config,telemetry
+
+# ---------------------------------------------------------------------------- #
+
+setup() {
+  common_test_setup
+  setup_isolated_flox
+  # Turn metrics on, as on a user's machine, so that falling back to the
+  # default config would create telemetry state.
+  export FLOX_DISABLE_METRICS=false
+  export _FLOX_METRICS_URL_OVERRIDE="http://127.0.0.1:1/legacy"
+  export _FLOX_METRICS_URL_V2_OVERRIDE="http://127.0.0.1:1/v2"
+  export PROJECT_DIR="${BATS_TEST_TMPDIR?}/cwd"
+  mkdir -p "$PROJECT_DIR"
+  cd "$PROJECT_DIR" || return
+}
+
+assert_cwd_empty() {
+  run ls -A "$PROJECT_DIR"
+  assert_success
+  assert_output ""
+}
+
+# ---------------------------------------------------------------------------- #
+
+@test "invalid FLOX_DISABLE_METRICS creates no device ID" {
+  FLOX_DISABLE_METRICS=1 run "$FLOX_BIN" --help
+  assert_failure
+  assert_output --partial "Could not parse config"
+
+  # Allow the detached telemetry sender, which would log into the current
+  # directory if it ran with the default config.
+  _FLOX_TESTING_DISABLE_BG_SIDE_EFFECTS=false _FLOX_FORCE_FLUSH_METRICS=true \
+    FLOX_DISABLE_METRICS=garbage run "$FLOX_BIN" envs --active
+  assert_failure
+  assert_output --partial "Could not parse config"
+
+  assert_cwd_empty
+  assert [ ! -e "$FLOX_DATA_DIR/metrics-uuid" ]
+}
+
+@test "malformed flox.toml creates no device ID" {
+  # A quoted boolean is a string, which does not parse as `disable_metrics`.
+  unset FLOX_DISABLE_METRICS
+  mkdir -p "$FLOX_CONFIG_DIR"
+  echo 'disable_metrics = "true"' > "$FLOX_CONFIG_DIR/flox.toml"
+
+  run "$FLOX_BIN" envs --active
+  assert_failure
+  assert_output --partial "Could not parse config"
+
+  assert_cwd_empty
+  assert [ ! -e "$FLOX_DATA_DIR/metrics-uuid" ]
+}
+
+@test "invalid config does not initialize Sentry" {
+  export FLOX_SENTRY_DSN="http://public@127.0.0.1:1/1"
+  export RUST_LOG="flox_core::sentry=debug"
+
+  # A valid config with metrics on initializes Sentry.
+  run "$FLOX_BIN" --help
+  assert_success
+  assert_output --partial "Initializing Sentry"
+
+  FLOX_DISABLE_METRICS=1 run "$FLOX_BIN" --help
+  assert_failure
+  refute_output --partial "Initializing Sentry"
+}
```

---

### Incident Patch 2: `ef109fde` (2026-11-09)
**Commit Message**: fix(telemetry): make reset-metrics delete buffered events (#4760)

`flox reset-metrics` now deletes the unsent v2 events
(`events-v2.json`), the legacy buffer, `send-telemetry.log`, and the
buffers' lock files, along with the device ID. It records no event,
sends no Sentry trace under the ID it deletes, and doesn't start the
background sender.

Before, the v2 buffer survived the reset, so the next flush sent events
carrying the old ID. That defeated the reset.

**Worth checking:** the Sentry client is unbound
(`flox_core::sentry::stop_sentry_reporting`) before the handler's span
starts. The device ID is deleted last, so a failed deletion leaves the
old ID with its events, and rerunning the command finishes the job.
`is_telemetry_reset_command` is checked in the dispatcher and in
`send_telemetry::spawn_if_due_with`.

**Not covered:** events already sent; a `send-telemetry` child or
another `flox` process that is already running; upgrade-check logs
inside environments. While the lock files are being deleted, a waiting
process and a new one don't exclude each other for a short window
(documented on `EventsBuffer::delete`).

<details><summary>Tests and open questions</summary>

- Unit 

**File**: `cli/flox-core/src/sentry.rs` (modified, +34/-0)
```diff
@@ -59,6 +59,16 @@ pub fn init_sentry(release_name: &str, metrics_uuid: Uuid) -> Option<ClientInitG
     Some(sentry)
 }
 
+/// Stop reporting events and transactions to Sentry for the rest of the process.
+///
+/// Call it before the span or event that must not be reported starts,
+/// because a transaction keeps the client it started with.
+/// It affects the calling thread's hub, which on the main thread is the
+/// process hub that [init_sentry] bound the client to.
+pub fn stop_sentry_reporting() {
+    sentry::Hub::current().bind_client(None);
+}
+
 /// Client options for every flox binary that reports to Sentry, minus the DSN.
 fn client_options(release_name: &str, sentry_env: String) -> ClientOptions {
     ClientOptions {
@@ -145,6 +155,30 @@ mod tests {
         (events, transactions)
     }
 
+    #[test]
+    fn stopped_reporting_sends_neither_events_nor_transactions() {
+        let options = sentry::apply_defaults(client_options("flox-test", "test".to_string()));
+        let sent_item_counts = [false, true].map(|stopped| {
+            sentry::test::with_captured_envelopes_options(
+                || {
+                    if stopped {
+                        stop_sentry_reporting();
+                    }
+                    sentry::capture_message("error", sentry::Level::Error);
+                    sentry::start_transaction(sentry::TransactionContext::new("transaction", "op"))
+                        .finish();
+                },
+                options.clone(),
+            )
+            .iter()
+            .flat_map(|envelope| envelope.items())
+            .count()
+        });
+
+        // The first count is the control: without stopping, both are sent.
+        assert_eq!(sent_item_counts, [2, 0]);
+    }
+
     #[test]
     fn events_and_transactions_omit_hostname() {
         let options = client_options("flox-test", "test".to_string());
```

**File**: `cli/flox-events/src/buffer.rs` (modified, +61/-0)
```diff
@@ -179,6 +179,35 @@ impl EventsBuffer {
         }))
     }
 
+    /// Delete the buffer file and its lock file from `data_dir`, discarding
+    /// every buffered event, including entries this binary cannot parse.
+    /// Succeeds without doing anything when `data_dir` does not exist.
+    ///
+    /// Blocks until the file lock is acquired, so no other process is
+    /// mid-write. The lock file is deleted while still held. A process that
+    /// was already waiting on it then locks the deleted file, while a process
+    /// that starts later creates and locks a new one, so those two processes
+    /// do not exclude each other until the first one releases its lock.
+    pub fn delete(data_dir: &Path) -> Result<()> {
+        if !data_dir
+            .try_exists()
+            .context("Could not check the v2 events buffer directory")?
+        {
+            return Ok(());
+        }
+
+        let lock_file_path = data_dir.join(EVENTS_LOCK_FILE_NAME);
+        let events_lock =
+            open_lock_file(&lock_file_path).context("Could not open v2 events lock file")?;
+        events_lock
+            .lock()
+            .context("Could not lock v2 events buffer")?;
+
+        remove_file_if_present(&data_dir.join(EVENTS_BUFFER_FILE_NAME))
+            .context("Could not delete v2 events buffer file")?;
+        remove_file_if_present(&lock_file_path).context("Could not delete v2 events lock file")
+    }
+
     pub(crate) fn is_expired(&self, expiry: Duration) -> bool {
         let now = OffsetDateTime::now_utc();
         self.oldest_timestamp()
@@ -313,6 +342,13 @@ impl EventsBuffer {
     }
 }
 
+fn remove_file_if_present(path: &Path) -> std::io::Result<()> {
+    match std::fs::remove_file(path) {
+        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
+        result => result,
+    }
+}
+
 #[cfg(test)]
 mod tests {
     use super::*;
@@ -369,4 +405,29 @@ mod tests {
             "the sent entry is drained and the unreadable one is written back"
         );
     }
+
+    #[test]
+    fn delete_removes_the_buffer_with_unreadable_entries_and_the_lock_file() {
+        let dir = tempfile::tempdir().unwrap();
+        std::fs::write(
+            dir.path().join(EVENTS_BUFFER_FILE_NAME),
+            format!(
+                "{}\n{}\n",
+                envelope("cli.environment.delete"),
+                envelope("cli.environment.from.the.future"),
+            ),
+        )
+        .unwrap();
+        drop(EventsBuffer::read(dir.path()).unwrap());
+
+        EventsBuffer::delete(dir.path()).unwrap();
+
+        let remaining: Vec<_> = std::fs::read_dir(dir.path()).unwrap().collect();
+        assert!(remaining.is_empty(), "left behind: {remaining:?}");
+
+        EventsBuffer::delete(dir.path()).expect("deleting a missing buffer succeeds");
+        EventsBuffer::delete(&dir.path().join("missing"))
+            .expect("deleting from a missing directory succeeds");
+        assert!(!dir.path().join("missing").exists());
+    }
 }
```

**File**: `cli/flox/src/commands/general.rs` (modified, +92/-22)
```diff
@@ -6,6 +6,7 @@ use anyhow::{Context, Result};
 use bpaf::Bpaf;
 use flox_config::{Config, FLOX_CONFIG_FILE, ReadWriteError};
 use flox_core::open_lock_file;
+use flox_events::{EventsBuffer, EventsHub};
 use flox_rust_sdk::flox::Flox;
 use indoc::indoc;
 use serde::Serialize;
@@ -15,6 +16,7 @@ use toml_edit::{Key, TomlError};
 use tracing::{debug, instrument};
 
 use crate::subcommand_metric;
+use crate::utils::detached::{SEND_TELEMETRY_LOG_NAME, send_telemetry_log_dir};
 use crate::utils::message;
 use crate::utils::metrics::{
     METRICS_EVENTS_FILE_NAME,
@@ -28,32 +30,18 @@ pub struct ResetMetrics {}
 impl ResetMetrics {
     #[instrument(name = "reset-metrics", skip_all)]
     pub async fn handle(self, flox: Flox) -> Result<()> {
-        subcommand_metric!("reset-metrics");
-        let metrics_lock = open_lock_file(flox.cache_dir.join(METRICS_LOCK_FILE_NAME))?;
-        // Hand the file back out of the closure, so the lock is held while
-        // the metrics files are removed rather than dropped with the closure.
-        let _metrics_lock =
-            tokio::task::spawn_blocking(move || metrics_lock.lock().map(|()| metrics_lock))
-                .await??;
-
-        if let Err(err) =
-            tokio::fs::remove_file(flox.cache_dir.join(METRICS_EVENTS_FILE_NAME)).await
-        {
-            match err.kind() {
-                std::io::ErrorKind::NotFound => {},
-                _ => Err(err)?,
-            }
-        }
+        // An event recorded from here on would carry the ID this command
+        // deletes, and would recreate the v2 buffer.
+        EventsHub::global().clear_client();
 
-        if let Err(err) = tokio::fs::remove_file(flox.data_dir.join(METRICS_UUID_FILE_NAME)).await {
-            match err.kind() {
-                std::io::ErrorKind::NotFound => {},
-                _ => Err(err)?,
-            }
-        }
+        let data_dir = flox.data_dir.clone();
+        let cache_dir = flox.cache_dir.clone();
+        tokio::task::spawn_blocking(move || delete_device_id_and_buffers(&data_dir, &cache_dir))
+            .await??;
 
         let notice = indoc! {"
             Successfully reset telemetry ID for this machine!
+            Deleted unsent telemetry events.
 
             A new ID will be assigned next time you use Flox.
 
@@ -69,6 +57,43 @@ impl ResetMetrics {
     }
 }
 
+/// Delete the device ID, the two event buffers and the send-telemetry log,
+/// which all hold the ID, and the buffers' lock files.
+///
+/// Holds the metrics lock throughout, so no process creates a new ID or
+/// appends to the legacy buffer until the old ID is gone. Deletes the device
+/// ID last, so when an earlier deletion fails, the old ID and the events
+/// recorded under it stay together and rerunning the command finishes the
+/// reset.
+fn delete_device_id_and_buffers(data_dir: &Path, cache_dir: &Path) -> Result<()> {
+    let metrics_lock_path = cache_dir.join(METRICS_LOCK_FILE_NAME);
+    let metrics_lock =
+        open_lock_file(&metrics_lock_path).context("Could not open metrics lock file")?;
+    metrics_lock
+        .lock()
+        .context("Could not lock metrics lock file")?;
+
+    remove_file_if_present(&cache_dir.join(METRICS_EVENTS_FILE_NAME))?;
+    EventsBuffer::delete(data_dir)?;
+    remove_file_if_present(&send_telemetry_log_dir(cache_dir).join(SEND_TELEMETRY_LOG_NAME))?;
+    remove_file_if_present(&data_dir.join(METRICS_UUID_FILE_NAME))?;
+
+    // Best effort: the lock file holds no data. Deleting it while it is held
+    // has the effect described on `EventsBuffer::delete`: a process already
+    // waiting on it and a process that starts later do not exclude each other.
+    if let Err(err) = remove_file_if_present(&metrics_lock_path) {
+        debug!(error = %err, "Failed to delete metrics lock file");
+    }
+    Ok(())
+}
+
+fn remove_file_if_present(path: &Path) -> Result<()> {
+    match std::fs::remove_file(path) {
+        Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(()),
+        result => result.with_context(|| format!("Could not delete {}", path.display())),
+    }
+}
+
 #[derive(Bpaf, Clone)]
 #[bpaf(fallback(ConfigArgs::List))]
 pub enum ConfigArgs {
@@ -288,4 +313,49 @@ mod tests {
             invalid unquoted key, expected letters, numbers, `-`, `_`
         "#});
     }
+
+    fn sorted_entries(dir: &Path) -> Vec<String> {
+        let mut names: Vec<String> = std::fs::read_dir(dir)
+            .unwrap()
+            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
+            .collect();
+        names.sort();
+        names
+    }
+
+    #[test]
+    fn delete_device_id_and_buffers_leaves_no_telemetry_files() {
+        let data_dir = tempfile::tempdir().unwrap();
+        let cache_dir = tempfile::tempdir().unwrap();
+        let log_dir = send_telemetry_log_dir(cache_dir.path());
+        std::fs::create_dir_all(&log_dir).unwrap();
+        drop(EventsBuffer::read(data_dir.path()).unwrap());
+   
```

**File**: `cli/flox/src/commands/mod.rs` (modified, +44/-1)
```diff
@@ -46,6 +46,7 @@ use bpaf::{Args, Bpaf, ParseFailure, Parser, ShellComp};
 use flox_config::{Config, EnvironmentTrust, FLOX_DIR_NAME, TokenStorageMode};
 use flox_core::data::environment_ref::{self, DEFAULT_NAME, RemoteEnvironmentRef};
 use flox_core::floxhub::{DEFAULT_FLOXHUB_URL, Floxhub};
+use flox_core::sentry::stop_sentry_reporting;
 use flox_core::vars::FLOX_DISABLE_METRICS_VAR;
 use flox_events::{EventKind, EventsHub};
 use flox_manifest::interfaces::AsLatestSchema;
@@ -274,6 +275,17 @@ pub struct Interrupted;
 impl FloxArgs {
     /// Initialize the command line by creating an initial FloxBuilder
     pub async fn handle(self, config: Config) -> Result<()> {
+        // Sentry was initialized with the device ID that this command deletes,
+        // and a span of the command would be reported under that ID.
+        // Unbind before the handler's span starts; see `is_telemetry_reset_command`.
+        if self
+            .command
+            .as_ref()
+            .is_some_and(|command| is_telemetry_reset_command(command.subcommand_name()))
+        {
+            stop_sentry_reporting();
+        }
+
         // ensure xdg dirs exist
         tokio::fs::create_dir_all(&config.flox.config_dir).await?;
         tokio::fs::create_dir_all(&config.flox.data_dir).await?;
@@ -445,8 +457,10 @@ impl FloxArgs {
             .as_ref()
             .map(Commands::subcommand_name)
             .unwrap_or("help");
-        // Recording is gated by `is_telemetry_flush_command` — see its doc.
+        // Recording is gated by `is_telemetry_flush_command` and
+        // `is_telemetry_reset_command` — see their docs.
         if !is_telemetry_flush_command(v2_subcommand)
+            && !is_telemetry_reset_command(v2_subcommand)
             && let Err(err) = EventsHub::global().record_command_run(v2_subcommand.to_string())
         {
             debug!(error = %err, "Failed to record v2 cli.command_run event");
@@ -1210,6 +1224,20 @@ pub fn is_telemetry_flush_command(name: &str) -> bool {
     name == "send-telemetry"
 }
 
+/// Whether `name` deletes the device ID. Such a command must not report
+/// anything under the ID it deletes, nor recreate the files it deleted.
+///
+/// - `FloxArgs::handle` neither records its `cli.command_run` event nor leaves
+///   Sentry bound, because a span or event would carry the old ID.
+/// - `send_telemetry::spawn_if_due_with` does not spawn the `send-telemetry`
+///   child: the flush check recreates `metrics-lock` and the legacy buffer,
+///   and the spawn recreates the send-telemetry log.
+///
+/// The `reset-metrics` handler removes the events client for everything else.
+pub fn is_telemetry_reset_command(name: &str) -> bool {
+    name == "reset-metrics"
+}
+
 /// Special command to check for the presence of the `--prefix` flag.
 ///
 /// With `--prefix` the application will print the prefix of the program
@@ -2039,6 +2067,21 @@ mod detached_predicate_tests {
         assert!(!is_telemetry_flush_command("check-for-upgrades"));
         assert!(!is_telemetry_flush_command("install"));
     }
+
+    /// The reset exclusion matches the name that the parsed `reset-metrics`
+    /// command derives, so renaming either one cannot silently drop it.
+    #[test]
+    fn reset_exclusion_covers_only_the_reset_command() {
+        let reset = flox_args()
+            .to_options()
+            .run_inner(&["reset-metrics"])
+            .unwrap_or_else(|err| panic!("failed to parse reset-metrics: {err:?}"))
+            .command
+            .expect("expected the reset-metrics subcommand");
+        assert!(is_telemetry_reset_command(reset.subcommand_name()));
+        assert!(!is_telemetry_reset_command("send-telemetry"));
+        assert!(!is_telemetry_reset_command("install"));
+    }
 }
 
 #[cfg(test)]
```

**File**: `cli/flox/src/commands/send_telemetry.rs` (modified, +4/-2)
```diff
@@ -19,7 +19,7 @@ use flox_events::{EventsHub, LifecycleFields};
 use flox_rust_sdk::flox::Flox;
 use tracing::debug;
 
-use super::is_detached_side_effect_command;
+use super::{is_detached_side_effect_command, is_telemetry_reset_command};
 use crate::utils::detached::{self, DetachedCommand, LogFile};
 use crate::utils::metrics::Hub;
 
@@ -115,6 +115,7 @@ fn telemetry_flush_due() -> bool {
 /// - neither buffer is due and flushing was not explicitly forced;
 /// - `subcommand` is itself a detached side-effect command (prevents a
 ///   fork-bomb and stops `send-telemetry` from re-spawning itself);
+/// - `subcommand` reset the device ID (see [`is_telemetry_reset_command`]);
 /// - `_FLOX_TESTING_DISABLE_BG_SIDE_EFFECTS=1` (CI escape hatch).
 ///
 /// The child logs to a single rolling file; see [`LogFile::Rolling`].
@@ -128,13 +129,14 @@ pub fn spawn_if_due(config: &Config, subcommand: &str) {
 fn spawn_if_due_with(config: &Config, subcommand: &str, self_executable: Option<PathBuf>) -> bool {
     if config.flox.disable_metrics
         || is_detached_side_effect_command(subcommand)
+        || is_telemetry_reset_command(subcommand)
         || detached::bg_side_effects_disabled()
         || !telemetry_flush_due()
     {
         return false;
     }
 
-    let log_dir = config.flox.cache_dir.join("log");
+    let log_dir = detached::send_telemetry_log_dir(&config.flox.cache_dir);
     let args = [String::from("send-telemetry"), String::from("-vv")];
     let spawn_result = DetachedCommand {
         args: &args,
```

**File**: `cli/flox/src/utils/detached.rs` (modified, +6/-1)
```diff
@@ -8,7 +8,7 @@
 
 use std::fs::{File, OpenOptions};
 use std::os::fd::AsRawFd;
-use std::path::Path;
+use std::path::{Path, PathBuf};
 use std::process::{Command, Stdio};
 
 use anyhow::{Context, Result, bail};
@@ -213,6 +213,11 @@ impl DetachedCommand<'_> {
 /// The rolling log filename for the send-telemetry child.
 pub const SEND_TELEMETRY_LOG_NAME: &str = "send-telemetry.log";
 
+/// The directory under `cache_dir` that holds the send-telemetry log.
+pub fn send_telemetry_log_dir(cache_dir: &Path) -> PathBuf {
+    cache_dir.join("log")
+}
+
 #[cfg(test)]
 mod tests {
     use super::*;
```

---

### Incident Patch 3: `4b4da59e` (2026-10-03)
**Commit Message**: fix(telemetry): make reset-metrics delete buffered events

`flox reset-metrics` deleted the device ID and the legacy event buffer,
but it left the v2 event buffer (`events-v2.json`) in place. The next
flush sent the events recorded under the old ID together with the events
recorded under the new ID.

`flox reset-metrics` now also deletes:
- the v2 event buffer and its lock file (`events-v2.json`,
  `events-v2.lock`), through a new `EventsBuffer::delete` that takes the
  buffer lock first
- the send-telemetry log (`<cache>/log/send-telemetry.log`), which
  records the device ID
- the metrics lock file (`metrics-lock`), best effort

It deletes the device ID last, so when an earlier deletion fails, the old
ID stays with its events and rerunning the command finishes the reset.

The command no longer records its `cli.command_run` event or a legacy
event, and it removes the v2 client before it deletes the buffers, so
none of its own telemetry events survive it. It also skips the flush
check and the detached send-telemetry child that run after a command.
The check would recreate `metrics-lock` and the legacy buffer, and the
spawn would recreate the send-telemetry log.

Sentry starts befor

**File**: `cli/flox-core/src/sentry.rs` (modified, +34/-0)
```diff
@@ -59,6 +59,16 @@ pub fn init_sentry(release_name: &str, metrics_uuid: Uuid) -> Option<ClientInitG
     Some(sentry)
 }
 
+/// Stop reporting events and transactions to Sentry for the rest of the process.
+///
+/// Call it before the span or event that must not be reported starts,
+/// because a transaction keeps the client it started with.
+/// It affects the calling thread's hub, which on the main thread is the
+/// process hub that [init_sentry] bound the client to.
+pub fn stop_sentry_reporting() {
+    sentry::Hub::current().bind_client(None);
+}
+
 /// Client options for every flox binary that reports to Sentry, minus the DSN.
 fn client_options(release_name: &str, sentry_env: String) -> ClientOptions {
     ClientOptions {
@@ -145,6 +155,30 @@ mod tests {
         (events, transactions)
     }
 
+    #[test]
+    fn stopped_reporting_sends_neither_events_nor_transactions() {
+        let options = sentry::apply_defaults(client_options("flox-test", "test".to_string()));
+        let sent_item_counts = [false, true].map(|stopped| {
+            sentry::test::with_captured_envelopes_options(
+                || {
+                    if stopped {
+                        stop_sentry_reporting();
+                    }
+                    sentry::capture_message("error", sentry::Level::Error);
+                    sentry::start_transaction(sentry::TransactionContext::new("transaction", "op"))
+                        .finish();
+                },
+                options.clone(),
+            )
+            .iter()
+            .flat_map(|envelope| envelope.items())
+            .count()
+        });
+
+        // The first count is the control: without stopping, both are sent.
+        assert_eq!(sent_item_counts, [2, 0]);
+    }
+
     #[test]
     fn events_and_transactions_omit_hostname() {
         let options = client_options("flox-test", "test".to_string());
```

**File**: `cli/flox-events/src/buffer.rs` (modified, +61/-0)
```diff
@@ -179,6 +179,35 @@ impl EventsBuffer {
         }))
     }
 
+    /// Delete the buffer file and its lock file from `data_dir`, discarding
+    /// every buffered event, including entries this binary cannot parse.
+    /// Succeeds without doing anything when `data_dir` does not exist.
+    ///
+    /// Blocks until the file lock is acquired, so no other process is
+    /// mid-write. The lock file is deleted while still held. A process that
+    /// was already waiting on it then locks the deleted file, while a process
+    /// that starts later creates and locks a new one, so those two processes
+    /// do not exclude each other until the first one releases its lock.
+    pub fn delete(data_dir: &Path) -> Result<()> {
+        if !data_dir
+            .try_exists()
+            .context("Could not check the v2 events buffer directory")?
+        {
+            return Ok(());
+        }
+
+        let lock_file_path = data_dir.join(EVENTS_LOCK_FILE_NAME);
+        let events_lock =
+            open_lock_file(&lock_file_path).context("Could not open v2 events lock file")?;
+        events_lock
+            .lock()
+            .context("Could not lock v2 events buffer")?;
+
+        remove_file_if_present(&data_dir.join(EVENTS_BUFFER_FILE_NAME))
+            .context("Could not delete v2 events buffer file")?;
+        remove_file_if_present(&lock_file_path).context("Could not delete v2 events lock file")
+    }
+
     pub(crate) fn is_expired(&self, expiry: Duration) -> bool {
         let now = OffsetDateTime::now_utc();
         self.oldest_timestamp()
@@ -313,6 +342,13 @@ impl EventsBuffer {
     }
 }
 
+fn remove_file_if_present(path: &Path) -> std::io::Result<()> {
+    match std::fs::remove_file(path) {
+        Err(err) if err.kind() == std::io::ErrorKind::NotFound => Ok(()),
+        result => result,
+    }
+}
+
 #[cfg(test)]
 mod tests {
     use super::*;
@@ -369,4 +405,29 @@ mod tests {
             "the sent entry is drained and the unreadable one is written back"
         );
     }
+
+    #[test]
+    fn delete_removes_the_buffer_with_unreadable_entries_and_the_lock_file() {
+        let dir = tempfile::tempdir().unwrap();
+        std::fs::write(
+            dir.path().join(EVENTS_BUFFER_FILE_NAME),
+            format!(
+                "{}\n{}\n",
+                envelope("cli.environment.delete"),
+                envelope("cli.environment.from.the.future"),
+            ),
+        )
+        .unwrap();
+        drop(EventsBuffer::read(dir.path()).unwrap());
+
+        EventsBuffer::delete(dir.path()).unwrap();
+
+        let remaining: Vec<_> = std::fs::read_dir(dir.path()).unwrap().collect();
+        assert!(remaining.is_empty(), "left behind: {remaining:?}");
+
+        EventsBuffer::delete(dir.path()).expect("deleting a missing buffer succeeds");
+        EventsBuffer::delete(&dir.path().join("missing"))
+            .expect("deleting from a missing directory succeeds");
+        assert!(!dir.path().join("missing").exists());
+    }
 }
```

**File**: `cli/flox/src/commands/general.rs` (modified, +92/-22)
```diff
@@ -6,6 +6,7 @@ use anyhow::{Context, Result};
 use bpaf::Bpaf;
 use flox_config::{Config, FLOX_CONFIG_FILE, ReadWriteError};
 use flox_core::open_lock_file;
+use flox_events::{EventsBuffer, EventsHub};
 use flox_rust_sdk::flox::Flox;
 use indoc::indoc;
 use serde::Serialize;
@@ -15,6 +16,7 @@ use toml_edit::{Key, TomlError};
 use tracing::{debug, instrument};
 
 use crate::subcommand_metric;
+use crate::utils::detached::{SEND_TELEMETRY_LOG_NAME, send_telemetry_log_dir};
 use crate::utils::message;
 use crate::utils::metrics::{
     METRICS_EVENTS_FILE_NAME,
@@ -28,32 +30,18 @@ pub struct ResetMetrics {}
 impl ResetMetrics {
     #[instrument(name = "reset-metrics", skip_all)]
     pub async fn handle(self, flox: Flox) -> Result<()> {
-        subcommand_metric!("reset-metrics");
-        let metrics_lock = open_lock_file(flox.cache_dir.join(METRICS_LOCK_FILE_NAME))?;
-        // Hand the file back out of the closure, so the lock is held while
-        // the metrics files are removed rather than dropped with the closure.
-        let _metrics_lock =
-            tokio::task::spawn_blocking(move || metrics_lock.lock().map(|()| metrics_lock))
-                .await??;
-
-        if let Err(err) =
-            tokio::fs::remove_file(flox.cache_dir.join(METRICS_EVENTS_FILE_NAME)).await
-        {
-            match err.kind() {
-                std::io::ErrorKind::NotFound => {},
-                _ => Err(err)?,
-            }
-        }
+        // An event recorded from here on would carry the ID this command
+        // deletes, and would recreate the v2 buffer.
+        EventsHub::global().clear_client();
 
-        if let Err(err) = tokio::fs::remove_file(flox.data_dir.join(METRICS_UUID_FILE_NAME)).await {
-            match err.kind() {
-                std::io::ErrorKind::NotFound => {},
-                _ => Err(err)?,
-            }
-        }
+        let data_dir = flox.data_dir.clone();
+        let cache_dir = flox.cache_dir.clone();
+        tokio::task::spawn_blocking(move || delete_device_id_and_buffers(&data_dir, &cache_dir))
+            .await??;
 
         let notice = indoc! {"
             Successfully reset telemetry ID for this machine!
+            Deleted unsent telemetry events.
 
             A new ID will be assigned next time you use Flox.
 
@@ -69,6 +57,43 @@ impl ResetMetrics {
     }
 }
 
+/// Delete the device ID, the two event buffers and the send-telemetry log,
+/// which all hold the ID, and the buffers' lock files.
+///
+/// Holds the metrics lock throughout, so no process creates a new ID or
+/// appends to the legacy buffer until the old ID is gone. Deletes the device
+/// ID last, so when an earlier deletion fails, the old ID and the events
+/// recorded under it stay together and rerunning the command finishes the
+/// reset.
+fn delete_device_id_and_buffers(data_dir: &Path, cache_dir: &Path) -> Result<()> {
+    let metrics_lock_path = cache_dir.join(METRICS_LOCK_FILE_NAME);
+    let metrics_lock =
+        open_lock_file(&metrics_lock_path).context("Could not open metrics lock file")?;
+    metrics_lock
+        .lock()
+        .context("Could not lock metrics lock file")?;
+
+    remove_file_if_present(&cache_dir.join(METRICS_EVENTS_FILE_NAME))?;
+    EventsBuffer::delete(data_dir)?;
+    remove_file_if_present(&send_telemetry_log_dir(cache_dir).join(SEND_TELEMETRY_LOG_NAME))?;
+    remove_file_if_present(&data_dir.join(METRICS_UUID_FILE_NAME))?;
+
+    // Best effort: the lock file holds no data. Deleting it while it is held
+    // has the effect described on `EventsBuffer::delete`: a process already
+    // waiting on it and a process that starts later do not exclude each other.
+    if let Err(err) = remove_file_if_present(&metrics_lock_path) {
+        debug!(error = %err, "Failed to delete metrics lock file");
+    }
+    Ok(())
+}
+
+fn remove_file_if_present(path: &Path) -> Result<()> {
+    match std::fs::remove_file(path) {
+        Err(err) if err.kind() == io::ErrorKind::NotFound => Ok(()),
+        result => result.with_context(|| format!("Could not delete {}", path.display())),
+    }
+}
+
 #[derive(Bpaf, Clone)]
 #[bpaf(fallback(ConfigArgs::List))]
 pub enum ConfigArgs {
@@ -288,4 +313,49 @@ mod tests {
             invalid unquoted key, expected letters, numbers, `-`, `_`
         "#});
     }
+
+    fn sorted_entries(dir: &Path) -> Vec<String> {
+        let mut names: Vec<String> = std::fs::read_dir(dir)
+            .unwrap()
+            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
+            .collect();
+        names.sort();
+        names
+    }
+
+    #[test]
+    fn delete_device_id_and_buffers_leaves_no_telemetry_files() {
+        let data_dir = tempfile::tempdir().unwrap();
+        let cache_dir = tempfile::tempdir().unwrap();
+        let log_dir = send_telemetry_log_dir(cache_dir.path());
+        std::fs::create_dir_all(&log_dir).unwrap();
+        drop(EventsBuffer::read(data_dir.path()).unwrap());
+   
```

**File**: `cli/flox/src/commands/mod.rs` (modified, +44/-1)
```diff
@@ -46,6 +46,7 @@ use bpaf::{Args, Bpaf, ParseFailure, Parser, ShellComp};
 use flox_config::{Config, EnvironmentTrust, FLOX_DIR_NAME, TokenStorageMode};
 use flox_core::data::environment_ref::{self, DEFAULT_NAME, RemoteEnvironmentRef};
 use flox_core::floxhub::{DEFAULT_FLOXHUB_URL, Floxhub};
+use flox_core::sentry::stop_sentry_reporting;
 use flox_core::vars::FLOX_DISABLE_METRICS_VAR;
 use flox_events::{EventKind, EventsHub};
 use flox_manifest::interfaces::AsLatestSchema;
@@ -274,6 +275,17 @@ pub struct Interrupted;
 impl FloxArgs {
     /// Initialize the command line by creating an initial FloxBuilder
     pub async fn handle(self, config: Config) -> Result<()> {
+        // Sentry was initialized with the device ID that this command deletes,
+        // and a span of the command would be reported under that ID.
+        // Unbind before the handler's span starts; see `is_telemetry_reset_command`.
+        if self
+            .command
+            .as_ref()
+            .is_some_and(|command| is_telemetry_reset_command(command.subcommand_name()))
+        {
+            stop_sentry_reporting();
+        }
+
         // ensure xdg dirs exist
         tokio::fs::create_dir_all(&config.flox.config_dir).await?;
         tokio::fs::create_dir_all(&config.flox.data_dir).await?;
@@ -445,8 +457,10 @@ impl FloxArgs {
             .as_ref()
             .map(Commands::subcommand_name)
             .unwrap_or("help");
-        // Recording is gated by `is_telemetry_flush_command` — see its doc.
+        // Recording is gated by `is_telemetry_flush_command` and
+        // `is_telemetry_reset_command` — see their docs.
         if !is_telemetry_flush_command(v2_subcommand)
+            && !is_telemetry_reset_command(v2_subcommand)
             && let Err(err) = EventsHub::global().record_command_run(v2_subcommand.to_string())
         {
             debug!(error = %err, "Failed to record v2 cli.command_run event");
@@ -1210,6 +1224,20 @@ pub fn is_telemetry_flush_command(name: &str) -> bool {
     name == "send-telemetry"
 }
 
+/// Whether `name` deletes the device ID. Such a command must not report
+/// anything under the ID it deletes, nor recreate the files it deleted.
+///
+/// - `FloxArgs::handle` neither records its `cli.command_run` event nor leaves
+///   Sentry bound, because a span or event would carry the old ID.
+/// - `send_telemetry::spawn_if_due_with` does not spawn the `send-telemetry`
+///   child: the flush check recreates `metrics-lock` and the legacy buffer,
+///   and the spawn recreates the send-telemetry log.
+///
+/// The `reset-metrics` handler removes the events client for everything else.
+pub fn is_telemetry_reset_command(name: &str) -> bool {
+    name == "reset-metrics"
+}
+
 /// Special command to check for the presence of the `--prefix` flag.
 ///
 /// With `--prefix` the application will print the prefix of the program
@@ -2039,6 +2067,21 @@ mod detached_predicate_tests {
         assert!(!is_telemetry_flush_command("check-for-upgrades"));
         assert!(!is_telemetry_flush_command("install"));
     }
+
+    /// The reset exclusion matches the name that the parsed `reset-metrics`
+    /// command derives, so renaming either one cannot silently drop it.
+    #[test]
+    fn reset_exclusion_covers_only_the_reset_command() {
+        let reset = flox_args()
+            .to_options()
+            .run_inner(&["reset-metrics"])
+            .unwrap_or_else(|err| panic!("failed to parse reset-metrics: {err:?}"))
+            .command
+            .expect("expected the reset-metrics subcommand");
+        assert!(is_telemetry_reset_command(reset.subcommand_name()));
+        assert!(!is_telemetry_reset_command("send-telemetry"));
+        assert!(!is_telemetry_reset_command("install"));
+    }
 }
 
 #[cfg(test)]
```

**File**: `cli/flox/src/commands/send_telemetry.rs` (modified, +4/-2)
```diff
@@ -19,7 +19,7 @@ use flox_events::{EventsHub, LifecycleFields};
 use flox_rust_sdk::flox::Flox;
 use tracing::debug;
 
-use super::is_detached_side_effect_command;
+use super::{is_detached_side_effect_command, is_telemetry_reset_command};
 use crate::utils::detached::{self, DetachedCommand, LogFile};
 use crate::utils::metrics::Hub;
 
@@ -115,6 +115,7 @@ fn telemetry_flush_due() -> bool {
 /// - neither buffer is due and flushing was not explicitly forced;
 /// - `subcommand` is itself a detached side-effect command (prevents a
 ///   fork-bomb and stops `send-telemetry` from re-spawning itself);
+/// - `subcommand` reset the device ID (see [`is_telemetry_reset_command`]);
 /// - `_FLOX_TESTING_DISABLE_BG_SIDE_EFFECTS=1` (CI escape hatch).
 ///
 /// The child logs to a single rolling file; see [`LogFile::Rolling`].
@@ -128,13 +129,14 @@ pub fn spawn_if_due(config: &Config, subcommand: &str) {
 fn spawn_if_due_with(config: &Config, subcommand: &str, self_executable: Option<PathBuf>) -> bool {
     if config.flox.disable_metrics
         || is_detached_side_effect_command(subcommand)
+        || is_telemetry_reset_command(subcommand)
         || detached::bg_side_effects_disabled()
         || !telemetry_flush_due()
     {
         return false;
     }
 
-    let log_dir = config.flox.cache_dir.join("log");
+    let log_dir = detached::send_telemetry_log_dir(&config.flox.cache_dir);
     let args = [String::from("send-telemetry"), String::from("-vv")];
     let spawn_result = DetachedCommand {
         args: &args,
```

**File**: `cli/flox/src/utils/detached.rs` (modified, +6/-1)
```diff
@@ -8,7 +8,7 @@
 
 use std::fs::{File, OpenOptions};
 use std::os::fd::AsRawFd;
-use std::path::Path;
+use std::path::{Path, PathBuf};
 use std::process::{Command, Stdio};
 
 use anyhow::{Context, Result, bail};
@@ -213,6 +213,11 @@ impl DetachedCommand<'_> {
 /// The rolling log filename for the send-telemetry child.
 pub const SEND_TELEMETRY_LOG_NAME: &str = "send-telemetry.log";
 
+/// The directory under `cache_dir` that holds the send-telemetry log.
+pub fn send_telemetry_log_dir(cache_dir: &Path) -> PathBuf {
+    cache_dir.join("log")
+}
+
 #[cfg(test)]
 mod tests {
     use super::*;
```

#### Recent Merged Pull Requests:
- **PR #4876** (2026-11-10): fix(show): clarify when no builds are available (@mkenigs)
- **PR #4871** (2026-11-10): ci(github-actions): bump macos runner for nix-plugin and CLI-unit jobs (@ysndr)
- **PR #4863** (2026-11-09): chore: community CI (@mkenigs)
- **PR #4861** (2026-11-09): fix(modules): trust the floxhub-1 key so published packages install (@nixfred)
- **PR #4860** (2026-11-10): docs(agents): PR hot fixes against the release branch (@mkenigs)
- **PR #4858** (2026-11-04): fix(auth): drop the CI hint from expired and rejected login errors (@tanjadev)

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

## X. telemetry): keep metrics files out of the current directory on config errors (#4

**RULE**:
When implementing operations in `cli/flox/src/main.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in flox/flox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `12b42fe6`: telemetry): keep metrics files out of the current directory on config errors (#4762). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `cli/flox/src/main.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
async fn run(args: FloxArgs, config: Config) -> Result<()> {
    // Exit rather than fall back to the defaults, which enable metrics and
    // leave the data and cache dirs empty, so they would create the metrics
    // UUID in the current directory whatever the unparsed sources set.
    let config = match Config::parse() {
        Ok(config) => config,
        Err(err) => {
            message::error(format!("{err:#}"));
            return ExitCode::from(1);
        },
    };
    let result = runtime.block_on(run(args, config.clone()));
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
async fn run(args: FloxArgs) -> Result<()> {
    let config = Config::parse()?;
    let config = Config::parse().unwrap_or_default();
    let result = runtime.block_on(run(args));
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `12b42fe6` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

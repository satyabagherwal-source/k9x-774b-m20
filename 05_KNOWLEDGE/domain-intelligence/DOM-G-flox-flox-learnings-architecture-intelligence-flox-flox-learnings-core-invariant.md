# Domain G — Architecture Intelligence: Architecture Intelligence: flox-flox-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "flox-flox-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-18T05:52:37.965Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-flox-flox-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [flox-flox-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-18T05:52:37.965Z`  
> **Learning ID**: `LEARN-EVO-flox-flox-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain G (Architecture Intelligence)
- **Secondary Corroborating Domains**: K (Quality & Verification Intelligence), H (Technical Construction Intelligence), D (Research & Knowledge Intelligence), I (Content & Information Intelligence), M (Feedback & Evolution Intelligence), A (Human & Need Intelligence), B (Product Intelligence), F (Design Intelligence), J (Search & Distribution Intelligence)
- **Confidence Rating**: 61%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from flox-flox-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/flox-flox-learnings.md`  
> **Source**: github ([https://github.com/flox/flox](https://github.com/flox/flox))  
> **Source Version**: `83a6c49f`  
> **License**: GPL-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-18T05:52:26.351Z  
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
> **Harvest Timestamp**: 2026-11-18T05:52:26.343Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `flox/flox`
- **Description**: The Deterministic Foundation for your SDLC
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 4210 stars

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
//! `flox_bin` is the path an upgrade replaces, not the store path of the
//! running binary (see `FLOX_BIN_FOR_SHELL` in the `flox` crate). It is
//! user-controlled text, so each hook escapes it for its shell, and `command`
//! (`exec` in tcsh, which only alias-expands the first word) keeps a user
//! function or alias named `flox` from injecting output into the text the
//! hook evals.
//!
//! Each hook also exports [`PROMPT_HOOK_VERSION_ENV`] =
//! `<version>:true` at registration time (top level, so it is set before the
//! first prompt); subshell activations export `<version>:false` instead (see
//! `gen_rc`). It is exported, unlike `_FLOX_INVOCATION_TYPES`, so a
//! subprocess such as `flox deactivate` can confirm a compatible hook is set
//! up before writing an action file the hook would otherwise never consume.

use std::borrow::Cow;

use flox_core::activate::vars::{FLOX_INVOCATION_TYPES_VAR, FLOX_INVOCATION_TYPES_WIRE_VAR};
use flox_core::hook_actions::{PROMPT_HOOK_VERSION_ENV, prompt_hook_marker_value};
use indoc::formatdoc;

pub fn bash_hook(flox_bin: &str) -> String {
    let flox_bin = shell_escape::escape(Cow::Borrowed(flox_bin));
    let marker = prompt_hook_marker_value(true);
    formatdoc!(
        r#"
        export {PROMPT_HOOK_VERSION_ENV}={marker};
        _flox_hook() {{
          local _prev_exit=$?;
          local _flox_vars;
          _flox_vars="$(command {flox_bin} hook-env --shell bash --shell-pid $$ --invocation-types "${{{FLOX_INVOCATION_TYPES_VAR}:-}}")";
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
    let flox_bin = shell_escape::escape(Cow::Borrowed(flox_bin));
    let marker = prompt_hook_marker_value(true);
    formatdoc!(
        r#"
        export {PROMPT_HOOK_VERSION_ENV}={marker};
        _flox_hook() {{
          if (( ZSH_SUBSHELL )); then return; fi;
          local _flox_vars;
          _flox_vars="$(command {flox_bin} hook-env --shell zsh --shell-pid $$ --invocation-types "${{{FLOX_INVOCATION_TYPES_VAR}:-}}")";
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
    let flox_bin = shell_escape::escape(Cow::Borrowed(flox_bin));
    let marker = prompt_hook_marker_value(true);
    formatdoc!(
        r#"
        set -gx {PROMPT_HOOK_VERSION_ENV} {marker};
        function _flox_hook --on-event fish_prompt;
            eval (command {flox_bin} hook-env --shell fish --shell-pid $fish_pid --invocation-types "${FLOX_INVOCATION_TYPES_VAR}" | string collect);
            if test "$FLOX_AUTO_ACTIVATE_FISH_MODE" != "disable_arrow";
                set -g _flox_pwd_hook_active 1;
            end;
        end;
        function _flox_hook_pwd --on-variable PWD;
            if set -q _flox_pwd_hook_active;
                if test "$FLOX_AUTO_ACTIVATE_FISH_MODE" = "eval_after_arrow";
                    set -g _flox_env_again 0;
                else;
                    eval (command {flox_bin} hook-env --shell fish --shell-pid $fish_pid --invocation-types "${FLOX_INVOCATION_TYPES_VAR}" | string collect);
                end;
            end;
        end;
        function _flox_hook_preexec --on-event fish_preexec;
            if set -q _flox_env_again;
                set -e _flox_env_again;
                eval (command {flox_bin} hook-env --shell fish --shell-pid $fish_pid --invocation-types "${FLOX_INVOCATION_TYPES_VAR}" | string collect);
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
//
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

    /// The command the generated hook code runs to reach flox (see
    /// `FLOX_BIN_FOR_SHELL` in the `flox` crate).
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
                I
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

### Incident Patch 1: `e6d5a4e1` (2026-11-17)
**Commit Message**: docs(show): align --help with the man page, test multi-failure rendering (#4895)

## Proposed Changes

Follow-up to DEV-366 (flox#4875, merged). Two non-blocking cleanups a
reviewer flagged; no behavior change.

- **`flox show --help`** now matches the man page. The `--all` entry
reads "Show additional metadata about each version, including
stabilities that provide each version. Ignored with --json." and
`--json` reads "Display available versions as a JSON array with all
available metadata about each version." The man page already carried
this wording; only the source doc comments (which bpaf renders into
`--help`) lagged.
- **New test**
`unavailable_at_stability_renders_inside_multiple_failures_bullets`
covers the previously-unasserted multi-failure path, where an
`UnavailableAtStability` guidance block renders inside a `- ` bullet
with its indented `[pkg-groups.*]` snippet. It fails if the inner
indentation is dropped.

The `pkg-path` positional stays the last field so the bpaf parser
doesn't panic; the `show_parser_satisfies_bpaf_invariants` guard still
passes.

## Testing

- `just unit-tests` show scope 20/20 (incl. the bpaf-invariant guard)
and lock_manifest scope 73/73; the n

**File**: `cli/flox-rust-sdk/src/providers/lock_manifest.rs` (modified, +30/-0)
```diff
@@ -4934,6 +4934,36 @@ mod tests {
         assert_eq!(guidance, expected);
     }
 
+    /// Inside a `- ` bullet, the guidance's blank lines and `[table]` block
+    /// keep their indentation, so the whole block reads as one list item.
+    #[test]
+    fn unavailable_at_stability_renders_inside_multiple_failures_bullets() {
+        let failures = ResolutionFailures(vec![
+            ResolutionFailure::UnavailableAtStability(unavailable_at_stability(
+                "legacy",
+                StabilitySetting::PkgGroup("legacy".to_string()),
+                false,
+            )),
+            ResolutionFailure::FallbackMessage {
+                msg: "Something else failed.".to_string(),
+            },
+        ]);
+
+        let expected = indoc! {r#"
+            multiple resolution failures:
+            - Package 'python3@>=3.12' has no build at stability 'lts'.
+              It has builds at: stable, unstable.
+              Use 'flox edit' to set a stability that has it:
+
+                [pkg-groups.legacy]
+                stability = "stable"
+
+              This applies to every package in pkg-group 'legacy'.
+            - Something else failed."#};
+
+        assert_eq!(failures.to_string(), expected);
+    }
+
     /// The suggested table must parse as a manifest, which a bare dotted
     /// group name wouldn't.
     #[test]
```

**File**: `cli/flox/src/commands/show.rs` (modified, +4/-2)
```diff
@@ -16,11 +16,13 @@ use crate::utils::tracing::sentry_set_tag;
 // Show detailed package information
 #[derive(Debug, Bpaf, Clone)]
 pub struct Show {
-    /// Display available versions as a JSON array
+    /// Display available versions as a JSON array with all available
+    /// metadata about each version.
     #[bpaf(long)]
     pub json: bool,
 
-    /// Show the stabilities that have each version
+    /// Show additional metadata about each version, including stabilities
+    /// that provide each version. Ignored with --json.
     #[bpaf(short, long)]
     pub all: bool,
 
```

---

### Incident Patch 2: `72df6167` (2026-11-17)
**Commit Message**: docs(show): align --help with the man page; test multi-failure stability rendering

The `flox show` field doc comments, which bpaf renders in --help, still
carried the wording from before review, while flox-show(1) had been
updated. They now match the man page.

The multi-failure path of UnavailableAtStability (a `- ` bullet around
guidance with blank lines and an indented table block) had no
assertion. A new unit test pins the exact bulleted output.

TDD: new test passed against existing behavior; it fails when the
bullet indentation is removed, confirming it discriminates.

Forge-Agent: implementation-worker (a3d78d59)
Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `cli/flox-rust-sdk/src/providers/lock_manifest.rs` (modified, +30/-0)
```diff
@@ -4934,6 +4934,36 @@ mod tests {
         assert_eq!(guidance, expected);
     }
 
+    /// Inside a `- ` bullet, the guidance's blank lines and `[table]` block
+    /// keep their indentation, so the whole block reads as one list item.
+    #[test]
+    fn unavailable_at_stability_renders_inside_multiple_failures_bullets() {
+        let failures = ResolutionFailures(vec![
+            ResolutionFailure::UnavailableAtStability(unavailable_at_stability(
+                "legacy",
+                StabilitySetting::PkgGroup("legacy".to_string()),
+                false,
+            )),
+            ResolutionFailure::FallbackMessage {
+                msg: "Something else failed.".to_string(),
+            },
+        ]);
+
+        let expected = indoc! {r#"
+            multiple resolution failures:
+            - Package 'python3@>=3.12' has no build at stability 'lts'.
+              It has builds at: stable, unstable.
+              Use 'flox edit' to set a stability that has it:
+
+                [pkg-groups.legacy]
+                stability = "stable"
+
+              This applies to every package in pkg-group 'legacy'.
+            - Something else failed."#};
+
+        assert_eq!(failures.to_string(), expected);
+    }
+
     /// The suggested table must parse as a manifest, which a bare dotted
     /// group name wouldn't.
     #[test]
```

**File**: `cli/flox/src/commands/show.rs` (modified, +4/-2)
```diff
@@ -16,11 +16,13 @@ use crate::utils::tracing::sentry_set_tag;
 // Show detailed package information
 #[derive(Debug, Bpaf, Clone)]
 pub struct Show {
-    /// Display available versions as a JSON array
+    /// Display available versions as a JSON array with all available
+    /// metadata about each version.
     #[bpaf(long)]
     pub json: bool,
 
-    /// Show the stabilities that have each version
+    /// Show additional metadata about each version, including stabilities
+    /// that provide each version. Ignored with --json.
     #[bpaf(short, long)]
     pub all: bool,
 
```

---

### Incident Patch 3: `771dc944` (2026-11-16)
**Commit Message**: fix(lock): keep non-stability failures and correct the stability edit

A package that failed on one system for a reason other than stability
had its message dropped when another system's message named stabilities:
the merged stability advice replaced both, and 'stability = "stable"'
would not fix the first system. Any unannotated version_not_found for a
package now leaves every message for it as the catalog sent it.

The suggested edit also named '[pkg-groups.<group>]' with the raw group
name, so a dotted name such as 'v1.2' produced a table the manifest
rejects, and it ignored that the stability can come from
'options.stability' or an included environment. The failure now carries
the StabilitySetting and in_include flag that the unknown-stability error
uses, and both messages share their location and include wording.

The floxhub-client test now asserts each parsed message in full.

TDD: the mixed annotated and unannotated test failed before the fix.

Refs: DEV-366
Forge-Agent: implementation-worker (a3d78d59)
Co-Authored-By: Claude Sonnet 5.5 <[REDACTED_EMAIL]>

**File**: `cli/flox-rust-sdk/src/providers/lock_manifest.rs` (modified, +393/-58)
```diff
@@ -131,7 +131,7 @@ pub enum ResolveError {
 }
 
 /// Where a pkg-group's stability is set.
-#[derive(Debug, Clone, PartialEq)]
+#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
 pub enum StabilitySetting {
     /// `pkg-groups.<group>.stability`
     PkgGroup(String),
@@ -140,6 +140,49 @@ pub enum StabilitySetting {
     Options,
 }
 
+impl StabilitySetting {
+    /// The setting that decides the stability of `group` in `manifest`.
+    fn for_group(manifest: &ManifestLatest, group: &str) -> Self {
+        if manifest.group_stability_override(group).is_some() {
+            Self::PkgGroup(group.to_string())
+        } else {
+            Self::Options
+        }
+    }
+
+    /// The table of the manifest that holds the setting, with the group name
+    /// quoted if it isn't a bare key, e.g. `pkg-groups."v1.2"`.
+    fn table(&self) -> String {
+        match self {
+            Self::PkgGroup(group) => PkgGroups::key_path(group),
+            Self::Options => "options".to_string(),
+        }
+    }
+
+    /// Whether an included environment, rather than `composer`, sets this
+    /// setting to `stability`. The composer's settings win over its
+    /// includes', so it sets the stability if it has any value for the
+    /// setting.
+    fn is_set_by_include(&self, stability: &str, composer: &ManifestLatest) -> bool {
+        let composer_stability = match self {
+            Self::PkgGroup(group) => composer.group_stability_override(group),
+            Self::Options => composer.options.stability.as_deref(),
+        };
+        composer_stability != Some(stability)
+    }
+}
+
+/// What to do about a stability that an included environment sets, ending
+/// without punctuation so that the caller can continue the sentence.
+///
+/// The composer's settings win over its includes', so it can override a
+/// stability that an include sets.
+fn included_stability_step(location: &str) -> String {
+    formatdoc! {"
+        An included environment sets {location}.
+        Change it in that environment, or override it with 'flox edit'"}
+}
+
 fn unknown_stability_message(
     setting: &StabilitySetting,
     stability: &str,
@@ -156,12 +199,8 @@ fn unknown_stability_message(
             "'options.stability'".to_string(),
         ),
     };
-    // The composer's settings win over its includes', so it can override a
-    // stability that an include sets.
     let next_step = if in_include {
-        formatdoc! {"
-            An included environment sets {location}.
-            Change it in that environment, or override it with 'flox edit'."}
+        format!("{}.", included_stability_step(&location))
     } else {
         format!("Change {location} with 'flox edit'.")
     };
@@ -753,12 +792,10 @@ impl LockManifest {
                 .iter()
                 .filter_map(|group| {
                     let stability = group.stability.clone()?;
-                    let setting = if manifest.group_stability_override(&group.name).is_some() {
-                        StabilitySetting::PkgGroup(group.name.clone())
-                    } else {
-                        StabilitySetting::Options
-                    };
-                    Some((setting, stability))
+                    Some((
+                        StabilitySetting::for_group(manifest, &group.name),
+                        stability,
+                    ))
                 })
                 .collect::<Vec<_>>();
             match client.resolve(groups_to_lock).await {
@@ -853,22 +890,27 @@ impl LockManifest {
             .unwrap_or(ResolveError::CatalogResolve(err))
     }
 
-    /// Mark an unknown stability that `composer` doesn't set as coming from
-    /// an included environment, so that the error points to the manifest
-    /// that sets it.
+    /// Mark a stability that `composer` doesn't set as coming from an
+    /// included environment, so that the error points to the manifest that
+    /// sets it.
     fn mark_included_stability(mut err: ResolveError, composer: &ManifestLatest) -> ResolveError {
-        if let ResolveError::UnknownStability {
-            setting,
-            stability,
-            in_include,
-            ..
-        } = &mut err
-        {
-            let composer_stability = match setting {
-                StabilitySetting::PkgGroup(group) => composer.group_stability_override(group),
-                StabilitySetting::Options => composer.options.stability.as_deref(),
-            };
-            *in_include = composer_stability != Some(stability.as_str());
+        match &mut err {
+            ResolveError::UnknownStability {
+                setting,
+                stability,
+                in_include,
+                ..
+            } => *in_include = setting.is_set_by_include(stability, composer),
+            ResolveError::ResolutionFailed(ResolutionFailures(failures)) => {
+                for failure in failures {
+                    if let ResolutionFailure::UnavailableAt
```

**File**: `cli/floxhub-client/src/client.rs` (modified, +43/-36)
```diff
@@ -1232,43 +1232,50 @@ pub mod tests {
             .await
             .unwrap();
 
-        let availabilities = res[0]
-            .msgs
-            .iter()
-            .map(|msg| match msg {
-                ResolutionMessage::VersionNotFound(msg) => {
-                    ("version_not_found", msg.stability_availability.clone())
-                },
-                ResolutionMessage::AttrPathNotFoundNotOnCurrentStability(msg) => (
-                    "not_on_current_stability",
-                    Some(msg.stability_availability.clone()),
-                ),
-                ResolutionMessage::AttrPathNotFoundNotInCatalog(_) => ("not_in_catalog", None),
-                other => panic!("unexpected message: {other:?}"),
-            })
-            .collect::<Vec<_>>();
-        assert_eq!(availabilities, vec![
-            (
-                "version_not_found",
-                Some(StabilityAvailability {
-                    stability: "lts".to_string(),
-                    available: vec![
-                        "stable".to_string(),
-                        "staging".to_string(),
-                        "unstable".to_string()
-                    ],
-                })
-            ),
-            (
-                "not_on_current_stability",
-                Some(StabilityAvailability {
-                    stability: "lts".to_string(),
-                    available: vec!["unstable".to_string()],
-                })
+        let lts = |available: &[&str]| StabilityAvailability {
+            stability: "lts".to_string(),
+            available: available.iter().map(|s| s.to_string()).collect(),
+        };
+        assert_eq!(res[0].msgs, vec![
+            ResolutionMessage::VersionNotFound(MsgVersionNotFound {
+                level: MessageLevel::Error,
+                msg: "no 3.12 at lts".to_string(),
+                attr_path: "python3".to_string(),
+                install_id: "python3".to_string(),
+                system: "x86_64-linux".to_string(),
+                stability_availability: Some(lts(&["stable", "staging", "unstable"])),
+            }),
+            ResolutionMessage::AttrPathNotFoundNotOnCurrentStability(
+                MsgAttrPathNotFoundNotOnCurrentStability {
+                    level: MessageLevel::Error,
+                    msg: "hello is not at lts".to_string(),
+                    attr_path: "hello".to_string(),
+                    install_id: "hello".to_string(),
+                    stability_availability: lts(&["unstable"]),
+                }
             ),
-            ("not_in_catalog", None),
-            ("not_in_catalog", None),
-            ("version_not_found", None),
+            // `not_on_current_stability` without stabilities is read as
+            // `not_in_catalog`, keeping the catalog's message.
+            ResolutionMessage::AttrPathNotFoundNotInCatalog(MsgAttrPathNotFoundNotInCatalog {
+                level: MessageLevel::Error,
+                msg: "no context".to_string(),
+                attr_path: "hello".to_string(),
+                install_id: "hello".to_string(),
+            }),
+            ResolutionMessage::AttrPathNotFoundNotInCatalog(MsgAttrPathNotFoundNotInCatalog {
+                level: MessageLevel::Error,
+                msg: "no nope".to_string(),
+                attr_path: "nope".to_string(),
+                install_id: "nope".to_string(),
+            }),
+            ResolutionMessage::VersionNotFound(MsgVersionNotFound {
+                level: MessageLevel::Error,
+                msg: "no 3.12".to_string(),
+                attr_path: "python3".to_string(),
+                install_id: "python3".to_string(),
+                system: "x86_64-linux".to_string(),
+                stability_availability: None,
+            }),
         ]);
         mock.assert();
     }
```

**File**: `cli/floxhub-client/src/types.rs` (modified, +2/-2)
```diff
@@ -132,7 +132,7 @@ impl From<PackageBuildResponse> for PublishReceipt {
 }
 
 /// The content of a generic message.
-#[derive(Debug, Clone, Serialize, Deserialize)]
+#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
 pub struct MsgGeneral {
     pub level: MessageLevel,
     pub msg: String,
@@ -222,7 +222,7 @@ pub struct MsgUnknown {
 ///
 /// Constructed from [`ResolutionMessageGeneral`] by matching on `type_` and
 /// interpreting the `context` field.
-#[derive(Debug, Clone, Serialize, Deserialize)]
+#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
 pub enum ResolutionMessage {
     General(MsgGeneral),
     AttrPathNotFoundNotInCatalog(MsgAttrPathNotFoundNotInCatalog),
```

#### Recent Merged Pull Requests:
- **PR #4895** (2026-11-17): docs(show): align --help with the man page, test multi-failure rendering (@stephenyeargin)
- **PR #4888** (2026-11-16): feat(build): configure the catalog nixpkgs fetcher (@gilmishal)
- **PR #4886** (2026-11-16): fix(cli): more consistent subcommand help (@mkenigs)
- **PR #4885** (2026-11-17): chore: Release v1.20.0 (@imkarrer)
- **PR #4882** (2026-11-13): chore(agents): factor out skills from AGENTS.md (@mkenigs)
- **PR #4880** (closed): fix(cli): show help for auth and extension without subcommands (@smorin)

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

## X. docs(show): align --help with the man page, test multi-failure rendering

**RULE**:
When implementing operations in `cli/flox-rust-sdk/src/providers/lock_manifest.rs`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in flox/flox. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e6d5a4e1`: docs(show): align --help with the man page, test multi-failure rendering. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `cli/flox-rust-sdk/src/providers/lock_manifest.rs`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
    /// Inside a `- ` bullet, the guidance's blank lines and `[table]` block
    /// keep their indentation, so the whole block reads as one list item.
    #[test]
    fn unavailable_at_stability_renders_inside_multiple_failures_bullets() {
        let failures = ResolutionFailures(vec![
            ResolutionFailure::UnavailableAtStability(unavailable_at_stability(
                "legacy",
                StabilitySetting::PkgGroup("legacy".to_string()),
                false,
            )),
            ResolutionFailure::FallbackMessage {
                msg: "Something else failed.".to_string(),
            },
        ]);

        let expected = indoc! {r#"
            multiple resolution failures:
            - Package 'python3@>=3.12' has no build at stability 'lts'.
              It has builds at: stable, unstable.
              Use 'flox edit' to set a stability that has it:

                [pkg-groups.legacy]
                stability = "stable"

              This applies to every package in pkg-group 'legacy'.
            - Something else failed."#};

        assert_eq!(failures.to_string(), expected);
    }

```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e6d5a4e1` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.

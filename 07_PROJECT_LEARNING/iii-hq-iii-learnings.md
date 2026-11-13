> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/iii-hq-iii-learnings.md`  
> **Source**: github ([https://github.com/iii-hq/iii](https://github.com/iii-hq/iii))  
> **Source Version**: `fd9719fa`  
> **License**: PERMISSIVE_OPEN_SOURCE  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T06:20:27.604Z  
> **Learning ID**: `learn-github-iii-hq-iii`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): iii-hq/iii

> **Canonical Artifact**: `07_PROJECT_LEARNING/iii-hq-iii-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/iii-hq/iii](https://github.com/iii-hq/iii))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T06:20:27.597Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `iii-hq/iii`
- **Description**: Effortlessly compose, extend, observe, discover, and react to every service in real-time for the first time ever.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md
- **Stars / Engagement**: 18936 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/iii-compose/src/engine.rs`
```
// Copyright Motia LLC and/or licensed to Motia LLC under one or more
// contributor license agreements. Licensed under the Elastic License 2.0;
// you may not use this file except in compliance with the Elastic License 2.0.
// This software is patent protected. We welcome discussions - reach out at team@iii.dev
// See LICENSE and PATENTS files for details.

//! The daemon's own connection to the engine.
//!
//! The daemon is an ordinary worker: it connects with the SDK, registers in
//! `default` as `compose`, and exposes `compose::*` there — where a call
//! with no namespace flag lands. One connection serves every project it holds,
//! whatever namespaces those declare.
//!
//! It is also the daemon's window into the engine: readiness is "the child
//! showed up in `engine::workers::list` under `(namespace, container)`", and
//! configuration is fetched here before any child is spawned.

use std::time::Duration;

use iii_sdk::{IIIClient, InitOptions, protocol::CallRequest, register_worker};

use serde_json::{Value, json};

use crate::{
    error::{ComposeError, Result},
    lifecycle::Child,
};

/// How often readiness is re-checked. Short enough that a fast worker is not
/// held back, long enough not to hammer the engine for a minute.
const READINESS_POLL_INTERVAL: Duration = Duration::from_millis(200);

/// Where a worker lands when it does not know about namespaces, and where the
/// engine serves its own functions.
///
/// The daemon lives in its own namespace, and the SDK sends a worker's calls
/// there unless told otherwise. `configuration::*` and `engine::*` are compiled
/// into the engine and exist only here, so every call the daemon makes to one
/// names this namespace. Unqualified, they would look for the engine's
/// functions in the daemon's own and find nothing.
const DEFAULT_NAMESPACE: &str = "default";

/// Budget for a single introspection or configuration call.
const CALL_TIMEOUT_MS: u64 = 10_000;

pub struct EngineClient {
    client: IIIClient,
    /// Namespace this daemon registered in — the same one `compose::*` lands
    /// in. Children live in the *project* namespace, which is separate.
    namespace: String,
    /// The managed engine has exited: no call over this bus can be answered.
    exited: std::sync::atomic::AtomicBool,
}

/// The last few lines a container printed, for an error that would otherwise
/// carry only an exit code.
///
/// Bounded on both axes — a handful of lines, and each one cut — because this
/// travels inside an error message that a caller will see on one terminal
/// line. The whole log stays on disk; `compose::status` says where.
fn log_tail(log_dir: &std::path::Path, container: &str) -> Option<String> {
    const LINES: usize = 5;
    const WIDTH: usize = 200;

    let text = std::fs::read_to_string(log_dir.join(format!("{container}.log"))).ok()?;
    let tail: Vec<&str> = text
        .lines()
        .filter(|line| !line.trim().is_empty())
        .rev()
        .take(LINES)
        .collect();
    if tail.is_empty() {
        return None;
    }
    Some(
        tail.into_iter()
            .rev()
            .map(|line| {
                let trimmed: String = line.chars().take(WIDTH).collect();
                format!("  {trimmed}")
            })
            .collect::<Vec<_>>()
            .join("\n"),
    )
}

/// Whether a call failure is the configuration worker reporting an
/// unregistered id, as opposed to anything that went wrong reaching it.
///
/// The distinction is the whole of fetch-or-fail: one means "nothing stored
/// yet", the other means "we do not know what is stored", and only the second
/// is a reason to refuse to start.
fn is_not_found(error: &iii_sdk::Error) -> bool {
    matches!(error, iii_sdk::Error::Remote { code, .. } if code == "NOT_FOUND")
}

/// What the engine showed for one container before compose started it.
///
/// Readiness reports differences, so it needs a "before" that predates the
/// child. See [`EngineClient::readiness_baseline`].
#[derive(Debug, Clone, Default)]
pub struct ReadinessBaseline {
    /// Workers already in the project namespace.
    present: Vec<String>,
    /// `(function id, namespace)` already owned by this container name.
    functions: Vec<(String, String)>,
    /// A worker of this name was already in `default`, so one showing up there
    /// is not evidence that ours ignored `III_NAMESPACE`.
    stray: bool,
}

impl EngineClient {
    /// Connects as `daemon_id` in `namespace`, the same one its containers
    /// register in.
    ///
    /// A second daemon on the same pair collides on `(namespace, worker_name)`
    /// and the engine rejects it fatally — see [`EngineClient::fatal_error`].
    /// Two copies of one project are a duplicate, not two projects.
    pub fn connect(address: &str, daemon_id: &str, namespace: &str) -> Self {
        let mut metadata = iii_sdk::iii::WorkerMetadata {
            name: daemon_id.to_string(),
            description: Some("compose daemon".to_string()),
            ..Default::default()
        };
        metadata.namespace = Some(namespace.to_string());

        let client = register_worker(
            address,
            InitOptions {
                metadata: Some(metadata),
                namespace: Some(namespace.to_string()),
                ..Default::default()
            },
        );

        Self {
            client,
            namespace: namespace.to_string(),
            exited: Default::default(),
        }
    }

    pub fn client(&self) -> &IIIClient {
        &self.client
    }

    /// Records that the managed engine exited, so teardown stops asking it.
    pub fn mark_exited(&self) {
        self.exited.store(true, std::sync::atomic::Ordering::SeqCst);
    }

    pub fn has_exited(&self) -> bool {
        self.exited.load(std::sync::atomic::Ordering::SeqCst)
    }

    pub fn namespace(&self) -> &str {
        &self.namespace
    }

    /// Whether the socket is up right now.
    ///
    /// The SDK reconnects on its own and replays the daemon's registrations,
    /// but says nothing about the children — so the daemon polls this to notice
    /// the connection coming back and re-check the project against the engine.
    pub fn is_connected(&self) -> bool {
        matches!(
            self.client.get_connection_state(),
            iii_sdk::runtime::IIIConnectionState::Connected
        )
    }

    /// The registration rejection that stopped this daemon, if any. Populated
    /// when another daemon already holds this `--id`.
    pub fn fatal_error(&self) -> Option<iii_sdk::Error> {
        self.client.fatal_error()
    }

    /// Fetches a configuration entry from the configuration worker.
    ///
    /// Fetch-or-fail, with one deliberate exception. A configuration worker
    /// that errors or cannot be reached fails the container: starting it on
    /// defaults it did not ask for is a silent downgrade, and an http worker on
    /// the wrong port is worse than no http worker.
    ///
    /// An entry that simply *does not exist yet* is not that. The worker is
    /// what registers its own id, with its own schema, on the boot compose
    /// would be refusing — so treating a first boot as a fetch failure
    /// deadlocks every project that names a configuration before it has ever
    /// run. Absent resolves to `None`: the layer contributes nothing, and what
    /// the compose file declares still reaches the child.
    pub async fn fetch_config(&self, name: &str) -> Result<Option<serde_yaml::Value>> {
        let response = match self
            .client
            .call(
                CallRequest {
                    function_id: "configuration::get".to_string(),
                    // Use the current configuration, preserving raw env placeholders.
                    payload: json!({ "id": name, "raw": true }),
                    action: None,
                    timeout_ms: Some(CALL_TIMEOUT_MS),
                }
                .namespace(DEFAULT_NAMESPACE),
            )
            .await
        {
            Ok(response) => response,
            Err(source) if is_not_found(&source) => return Ok(None),
            Err(source) => {
                return Err(ComposeError::ConfigFetchFailed {
                    name: name.to_string(),
                    message: source.to_string(),
                });
            }
        };

        let value = response.get("value").cloned().unwrap_or(response);
        // Absence is NOT_FOUND; explicit null is a stored value, including
        // during migration. Never replace it with package defaults implicitly.
        serde_yaml::to_value(value)
            .map(Some)
            .map_err(|err| ComposeError::ConfigFetchFailed {
                name: name.to_string(),
                message: err.to_string(),
            })
    }

    /// Update active configuration before spawn without touching persistent storage.
    pub async fn set_config(&self, name: &str, value: serde_yaml::Value) -> Result<()> {
        let value = serde_json::to_value(value).map_err(|err| ComposeError::ConfigFetchFailed {
            name: name.into(),
            message: err.to_string(),
        })?;
        self.client
            .call(
                CallRequest {
                    function_id: "configuration::set".into(),
                    payload: json!({"id": name, "value": value, "flush": false}),
                    action: None,
                    timeout_ms: Some(CALL_TIMEOUT_MS),
                }
                .namespace(DEFAULT_NAMESPACE),
            )
            .await
            .map_err(|err| ComposeError::ConfigFetchFailed {
                name: name.into(),
                message: format!("runtime configuration injection failed: {err}"),
            })?;
        Ok(())
    }

    /// Ask the configuration authority to migrate the exact previous default.
    /// Returns true only when both source and destination are missing.
    /// A missing functio
```

### Core Architecture Module: `crates/iii-compose/src/engine_compat.rs`
```
// Copyright Motia LLC and/or licensed to Motia LLC under one or more
// contributor license agreements. Licensed under the Elastic License 2.0;
// you may not use this file except in compliance with the Elastic License 2.0.
// This software is patent protected. We welcome discussions - reach out at team@iii.dev
// See LICENSE and PATENTS files for details.

//! The `iii_engine_version` range a worker manifest declares, checked against
//! the engine hosting Compose.
//!
//! The grammar is the node-semver subset the registry and the workers CI also
//! accept: `OP? MAJOR.MINOR.PATCH` comparators (`>=`, `>`, `<=`, `<`, `=`, `^`,
//! `~`), space-joined into sets (all must hold) and `||`-joined into a range
//! (any set may hold). A bare version means exactly that version.

use semver::{Op, Version, VersionReq};

const OPERATORS: [&str; 7] = [">=", "<=", ">", "<", "=", "^", "~"];

/// The refusal for a value outside the supported range grammar.
pub fn malformed_iii_engine_version(got: impl std::fmt::Debug) -> String {
    format!(
        "iii_engine_version must be a semver range like \">=0.26.0\" (comparators >=, >, <=, <, =, ^, ~ on MAJOR.MINOR.PATCH, joined by spaces or ||), got {got:?}"
    )
}

pub fn valid_iii_engine_version(range: &str) -> bool {
    parse_range(range).is_some()
}

/// Compatible when the engine's `MAJOR.MINOR.PATCH` satisfies any `||` set, so
/// `0.26.0-rc.2` counts as `0.26.0`.
pub fn check_iii_engine_requirement(
    worker: &str,
    range: &str,
    running: &Version,
) -> Result<(), String> {
    let worker = sanitize(worker);
    let Some(sets) = parse_range(range) else {
        return Err(format!("{worker}: {}", malformed_iii_engine_version(range)));
    };
    let base = Version::new(running.major, running.minor, running.patch);
    if sets.iter().any(|set| set.matches(&base)) {
        return Ok(());
    }
    let tail = if update_can_help(&sets, &base) {
        "run: iii update".to_string()
    } else {
        format!(
            "this iii is newer than {worker} supports \u{2014} install a version of {worker} that supports iii {running}"
        )
    };
    Err(format!(
        "{worker} requires iii {range}, running {running}; {tail}"
    ))
}

/// The engine version Compose checks manifests against: the binary hosting
/// it, which is the engine that runs the workers. `None` outside an engine.
pub fn running_engine_version() -> Option<Version> {
    crate::host_version().and_then(|raw| Version::parse(raw.trim().trim_start_matches('v')).ok())
}

/// One `VersionReq` per `||` set, or `None` when `range` is outside the grammar.
/// `VersionReq` reads a bare `1.2.3` as `^1.2.3` and joins comparators with
/// commas, so a bare version gets `=` and each set is comma-joined.
fn parse_range(range: &str) -> Option<Vec<VersionReq>> {
    if range.is_empty() || range.starts_with(is_space) || range.ends_with(is_space) {
        return None;
    }
    range
        .split("||")
        .map(|set| {
            let set = set.trim_matches(is_space);
            if set.is_empty() || set.chars().any(|c| c.is_whitespace() && !is_space(c)) {
                return None;
            }
            let comparators = set
                .split(is_space)
                .filter(|c| !c.is_empty())
                .map(comparator)
                .collect::<Option<Vec<_>>>()?;
            VersionReq::parse(&comparators.join(", ")).ok()
        })
        .collect()
}

/// `OP? MAJOR.MINOR.PATCH` with no leading zeros, normalised for `VersionReq`.
fn comparator(text: &str) -> Option<String> {
    let op = OPERATORS
        .iter()
        .find(|op| text.starts_with(*op))
        .copied()
        .unwrap_or("");
    let version = &text[op.len()..];
    let parts: Vec<&str> = version.split('.').collect();
    let numeric = |part: &&str| {
        !part.is_empty()
            && part.bytes().all(|b| b.is_ascii_digit())
            && (*part == "0" || !part.starts_with('0'))
    };
    if parts.len() != 3 || !parts.iter().all(numeric) {
        return None;
    }
    Some(format!("{}{version}", if op.is_empty() { "=" } else { op }))
}

fn is_space(c: char) -> bool {
    c.is_ascii_whitespace()
}

/// True when some `||` set fails only because the engine is too old for it.
fn update_can_help(sets: &[VersionReq], base: &Version) -> bool {
    sets.iter().any(|set| {
        set.comparators.iter().all(|c| {
            let single = VersionReq {
                comparators: vec![c.clone()],
            };
            single.matches(base) || {
                let floor = Version::new(c.major, c.minor.unwrap_or(0), c.patch.unwrap_or(0));
                match c.op {
                    Op::Greater | Op::GreaterEq => true,
                    Op::Less | Op::LessEq => false,
                    _ => *base < floor,
                }
            }
        })
    })
}

/// Drops terminal control and bidi-override characters so a worker name can't
/// rewrite the error line it appears in.
fn sanitize(name: &str) -> String {
    name.chars()
        .filter(|c| {
            !c.is_control()
                && !matches!(c, '\u{200E}' | '\u{200F}' | '\u{202A}'..='\u{202E}' | '\u{2066}'..='\u{2069}')
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn v(s: &str) -> Version {
        Version::parse(s).unwrap()
    }

    fn ok(range: &str, running: &str) -> bool {
        check_iii_engine_requirement("http", range, &v(running)).is_ok()
    }

    #[test]
    fn rc_engine_satisfies_release_floor() {
        assert!(ok(">=0.26.0", "0.26.0-rc.2"));
    }

    #[test]
    fn older_engine_is_refused_with_update_hint() {
        assert_eq!(
            check_iii_engine_requirement("http", ">=0.26.0", &v("0.25.9")).unwrap_err(),
            "http requires iii >=0.26.0, running 0.25.9; run: iii update"
        );
    }

    #[test]
    fn too_new_engine_gets_a_different_hint() {
        let msg =
            |r: &str, run: &str| check_iii_engine_requirement("http", r, &v(run)).unwrap_err();
        for (r, run) in [("<0.28.0", "0.28.1"), ("^0.26.0", "0.27.0")] {
            let e = msg(r, run);
            assert!(
                e.contains("newer than http supports") && !e.contains("iii update"),
                "{e}"
            );
        }
        for (r, run) in [("^0.26.0", "0.25.0"), ("^0.25.0 || ^0.27.0", "0.26.0")] {
            assert!(msg(r, run).ends_with("run: iii update"), "{r}");
        }
    }

    #[test]
    fn caret_range_refuses_the_next_minor() {
        assert!(ok("^0.26.0", "0.26.4"));
        assert!(!ok("^0.26.0", "0.27.0"));
    }

    #[test]
    fn space_joined_comparators_must_all_hold() {
        assert!(ok(">=0.26.0 <0.28.0", "0.27.3"));
        assert!(!ok(">=0.26.0 <0.28.0", "0.28.0"));
    }

    #[test]
    fn any_or_set_may_hold() {
        assert!(ok("^0.25.0 || ^0.26.0", "0.25.4"));
        assert!(ok("^0.25.0 || ^0.26.0", "0.26.1"));
        assert!(!ok("^0.25.0 || ^0.26.0", "0.27.0"));
    }

    #[test]
    fn bare_version_means_exactly_that_version() {
        assert!(ok("0.26.0", "0.26.0"));
        assert!(ok("0.26.0", "0.26.0-rc.1"));
        assert!(!ok("0.26.0", "0.26.1"));
    }

    #[test]
    fn valid_iii_engine_version_follows_the_range_grammar() {
        for good in [
            ">=0.26.0",
            "^0.26.0",
            "~0.26.0",
            "=0.26.0",
            "0.26.0",
            ">=0.26.0 <0.28.0",
            "^0.25.0 || ^0.26.0",
            "^0.25.0||^0.26.0",
        ] {
            assert!(valid_iii_engine_version(good), "{good}");
        }
        for bad in [
            "",
            "0.26",
            "v0.26.0",
            ">=0.26.0-rc.1",
            ">=01.2.3",
            "0.26.x",
            "1.0.0 - 2.0.0",
            " >=0.26.0",
            ">=0.26.0 ",
            ">=0.26.0 ||",
            ">=0.26.0<0.28.0",
            "=>0.26.0",
            ">=0.26.0\u{a0}<0.28.0",
            ">=0.2\u{666}.0",
        ] {
            assert!(!valid_iii_engine_version(bad), "{bad:?}");
        }
    }

    #[test]
    fn malformed_range_is_refused() {
        let err = check_iii_engine_requirement("http", "0.26", &v("0.26.0")).unwrap_err();
        assert!(
            err.starts_with("http: iii_engine_version must be a semver range"),
            "{err}"
        );
    }

    #[test]
    fn worker_name_is_sanitized_in_errors() {
        let err = check_iii_engine_requirement("ht\x1b[31mtp\u{202E}", ">=0.26.0", &v("0.25.9"))
            .unwrap_err();
        assert!(
            !err.contains('\x1b') && !err.contains('\u{202E}'),
            "{err:?}"
        );
        assert!(err.starts_with("ht[31mtp requires iii >=0.26.0"), "{err:?}");
    }
}

```

### Core Architecture Module: `crates/iii-compose/src/hooks.rs`
```
// Copyright Motia LLC and/or licensed to Motia LLC under one or more
// contributor license agreements. Licensed under the Elastic License 2.0;
// you may not use this file except in compliance with the Elastic License 2.0.
// This software is patent protected. We welcome discussions - reach out at team@iii.dev
// See LICENSE and PATENTS files for details.

//! Container hooks.
//!
//! `pre_run` blocks the container's start and is budgeted: a hung migration
//! must fail the container instead of holding the whole graph. `post_run` fires
//! after the container's exit is confirmed and is not awaited by teardown. A
//! project supervisor still owns it, so shutdown waits for supervised hooks
//! and their timeout kills and reaps a cleanup script that hangs.
//!
//! Both run with the same environment and working directory as the container
//! itself, and both get their own process group so a timeout can take their
//! children down too.

use std::{process::Stdio, time::Duration};

use colored::Colorize;
use tokio::io::AsyncReadExt;
use tokio::sync::Mutex;

use crate::{
    manifest::StartSpec,
    report,
    spawn::{SpawnCtx, spawn_plan},
};

#[derive(Debug, thiserror::Error)]
pub enum HookError {
    #[error("{hook} could not start: {source}")]
    Spawn {
        hook: &'static str,
        #[source]
        source: std::io::Error,
    },

    #[error("{hook} failed with exit code {code}")]
    Failed { hook: &'static str, code: i32 },

    #[error("{hook} timed out after {}s", timeout.as_secs())]
    Timeout {
        hook: &'static str,
        timeout: Duration,
    },
}

impl HookError {
    pub fn code(&self) -> &'static str {
        match self {
            Self::Spawn { .. } => "HOOK_SPAWN_FAILED",
            Self::Failed { .. } => "HOOK_FAILED",
            Self::Timeout { .. } => "HOOK_TIMEOUT",
        }
    }
}

/// Owns every detached `post_run` task for one project.
///
/// Teardown does not wait for a cleanup hook, but project shutdown does. This
/// keeps a short hook asynchronous without letting a hung hook outlive the
/// compose process.
#[derive(Default)]
pub struct PostRunSupervisor {
    state: Mutex<PostRunState>,
}

#[derive(Default)]
struct PostRunState {
    shutting_down: bool,
    tasks: Vec<tokio::task::JoinHandle<()>>,
}

impl PostRunSupervisor {
    /// Starts one bounded cleanup hook and returns as soon as it is supervised.
    pub async fn fire(&self, ctx: &SpawnCtx<'_>, script: &str, timeout: Duration) {
        const HOOK: &str = "post_run";

        let mut state = self.state.lock().await;
        state.tasks.retain(|task| !task.is_finished());
        if state.shutting_down {
            return;
        }

        let container = ctx.container_key.to_string();
        let mut hook = match spawn_hook(ctx, script) {
            Ok(hook) => hook,
            Err(err) => {
                report::line(&format!(
                    "{} {}",
                    format!("[{HOOK}:{container}]").dimmed(),
                    format!("could not start: {err}").red()
                ));
                return;
            }
        };
        state.tasks.push(tokio::spawn(async move {
            let child = &mut hook.child;
            let mut stdout = child.stdout.take();
            let mut stderr = child.stderr.take();
            let run = async {
                let (status, out, err) =
                    tokio::join!(child.wait(), read_all(&mut stdout), read_all(&mut stderr));
                (status, out, err)
            };

            enum PostRunOutcome {
                Finished((std::io::Result<std::process::ExitStatus>, String, String)),
                TimedOut,
            }

            let outcome = {
                tokio::pin!(run);
                let timer = tokio::time::sleep(timeout);
                tokio::pin!(timer);
                tokio::select! {
                    result = &mut run => PostRunOutcome::Finished(result),
                    _ = &mut timer => PostRunOutcome::TimedOut,
                }
            };

            match outcome {
                PostRunOutcome::Finished((status, out, err)) => {
                    log_output(HOOK, &container, &out, &err);
                    match status {
                        Ok(status) if status.success() => {}
                        Ok(status) => report::line(&format!(
                            "{} {}",
                            format!("[{HOOK}:{container}]").dimmed(),
                            format!("exited with {}", status.code().unwrap_or(-1)).yellow()
                        )),
                        Err(err) => report::line(&format!(
                            "{} {}",
                            format!("[{HOOK}:{container}]").dimmed(),
                            format!("could not be waited on: {err}").yellow()
                        )),
                    }
                }
                PostRunOutcome::TimedOut => {
                    hook.kill_tree();
                    let _ = hook.child.wait().await;
                    report::line(&format!(
                        "{} {}",
                        format!("[{HOOK}:{container}]").dimmed(),
                        format!("timed out after {}s", timeout.as_secs_f64()).yellow()
                    ));
                }
            }
        }));
    }

    /// Waits for every supervised cleanup hook to finish or reach its timeout.
    pub async fn shutdown(&self) {
        let tasks = {
            let mut state = self.state.lock().await;
            state.shutting_down = true;
            std::mem::take(&mut state.tasks)
        };

        for task in tasks {
            let _ = task.await;
        }
    }
}

/// Runs `pre_run` to completion. On timeout the hook's whole process group is
/// killed before the error returns, so nothing survives into the next attempt.
pub async fn await_pre_run(
    ctx: &SpawnCtx<'_>,
    script: &str,
    timeout: Duration,
) -> Result<(), HookError> {
    await_pre_run_until_shutdown(ctx, script, timeout, None)
        .await
        .expect("a hook without a shutdown signal cannot be interrupted")
}

/// Runs `pre_run`, killing and reaping its process group if foreground compose
/// is interrupted while the hook is active.
pub(crate) async fn await_pre_run_until_shutdown(
    ctx: &SpawnCtx<'_>,
    script: &str,
    timeout: Duration,
    shutdown: Option<&mut crate::shutdown::ShutdownSignal>,
) -> Option<Result<(), HookError>> {
    const HOOK: &str = "pre_run";

    let mut hook = match spawn_hook(ctx, script) {
        Ok(hook) => hook,
        Err(source) => return Some(Err(HookError::Spawn { hook: HOOK, source })),
    };
    let child = &mut hook.child;

    let mut stdout = child.stdout.take();
    let mut stderr = child.stderr.take();

    // Draining both pipes while waiting: a hook that writes more than a pipe
    // buffer would otherwise block forever and look like a timeout.
    let run = async {
        let (status, out, err) =
            tokio::join!(child.wait(), read_all(&mut stdout), read_all(&mut stderr));
        (status, out, err)
    };

    enum HookOutcome {
        Finished((std::io::Result<std::process::ExitStatus>, String, String)),
        TimedOut,
        Interrupted,
    }

    let outcome = {
        tokio::pin!(run);
        let timer = tokio::time::sleep(timeout);
        tokio::pin!(timer);
        match shutdown {
            Some(shutdown) => tokio::select! {
                biased;
                _ = shutdown.wait() => HookOutcome::Interrupted,
                result = &mut run => HookOutcome::Finished(result),
                _ = &mut timer => HookOutcome::TimedOut,
            },
            None => tokio::select! {
                result = &mut run => HookOutcome::Finished(result),
                _ = &mut timer => HookOutcome::TimedOut,
            },
        }
    };

    match outcome {
        HookOutcome::Finished((status, out, err)) => {
            log_output(HOOK, ctx.container_key, &out, &err);
            let status = match status {
                Ok(status) => status,
                Err(source) => return Some(Err(HookError::Spawn { hook: HOOK, source })),
            };
            if status.success() {
                Some(Ok(()))
            } else {
                Some(Err(HookError::Failed {
                    hook: HOOK,
                    code: status.code().unwrap_or(-1),
                }))
            }
        }
        HookOutcome::TimedOut => {
            // Kill before waiting: the hook is hung by definition, so waiting
            // first would never return.
            hook.kill_tree();
            let _ = hook.child.wait().await;
            Some(Err(HookError::Timeout {
                hook: HOOK,
                timeout,
            }))
        }
        HookOutcome::Interrupted => {
            hook.kill_tree();
            let _ = hook.child.wait().await;
            None
        }
    }
}

/// A hook process plus whatever the platform needs to take its descendants
/// down: a process group on unix, a job object on windows.
struct HookProcess {
    child: tokio::process::Child,
    #[cfg(windows)]
    job: Option<crate::process::windows::JobHandle>,
}

impl HookProcess {
    fn kill_tree(&mut self) {
        #[cfg(unix)]
        if let Some(pid) = self.child.id() {
            crate::process::unix::signal_group(pid as i32, nix::sys::signal::Signal::SIGKILL);
        }
        #[cfg(windows)]
        match &self.job {
            Some(job) => job.terminate(),
            // No job: the hook itself still dies, its own children may not.
            None => {
                let _ = self.child.start_kill();
            }
        }
    }
}

impl Drop for HookProcess {
    fn drop(&mut self) {
        // Last-resort cleanup for an abrupt runtime drop. Normal timeout and
        // project shutdown kill and wait before this point.
        self.kill_tree();
    }
}

/// Builds a hook command that mirrors the co
```

### Core Architecture Module: `crates/iii-compose/src/lifecycle.rs`
```
// Copyright Motia LLC and/or licensed to Motia LLC under one or more
// contributor license agreements. Licensed under the Elastic License 2.0;
// you may not use this file except in compliance with the Elastic License 2.0.
// This software is patent protected. We welcome discussions - reach out at team@iii.dev
// See LICENSE and PATENTS files for details.

//! `up` and `down`.
//!
//! Three rules shape everything here:
//!
//! 1. **A container is up only when the engine has seen it.** Spawning is not
//!    starting: readiness is the child appearing under `(namespace, container)`
//!    in the engine, which is the same fact its dependents rely on.
//! 2. **Rollback undoes this operation, not the world.** A failed `up` stops
//!    what it started, in reverse order, and leaves containers that were
//!    already running untouched.
//! 3. **Teardown follows the graph backwards.** Dependents stop before the
//!    things they depend on, so nothing is talking to a worker that just went
//!    away. Removal is the explicit exception: its validated new graph first
//!    drops those edges, then only the deleted container stops.

use std::{
    collections::BTreeMap,
    process::ExitStatus,
    time::{Duration, Instant},
};

use futures::StreamExt;
use serde::Serialize;

use crate::{
    config::{ComposeFile, Container, RestartPolicy},
    configuration::merge,
    dag,
    engine::EngineClient,
    error::{ComposeError, Result},
    hooks,
    logs::LogStore,
    manifest::{StartSpec, VmSpec},
    process::{Outcome, Supervised, spawn_supervised_piped},
    report, restart,
    spawn::{SpawnCtx, resolve_working_dir, spawn_plan},
    state::{ChildRecord, ChildStatus},
};

/// Outcome of one `up` or `down`. The shape is the JSON that `compose::*`
/// returns, so it is a contract: fields are added, never repurposed.
#[derive(Debug, Clone, Serialize, schemars::JsonSchema, PartialEq, Eq)]
pub struct OpResult {
    pub operation_id: String,
    pub status: OpStatus,
    /// False when the operation was a no-op — every requested container was
    /// already in the desired state.
    pub changed: bool,
    pub containers: Vec<ContainerResult>,
    #[serde(skip)]
    #[schemars(skip)]
    pub(crate) primary_error: Option<OpError>,
}

#[derive(Debug, Clone, Copy, Serialize, schemars::JsonSchema, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OpStatus {
    Ok,
    Failed,
}

#[derive(Debug, Clone, Serialize, schemars::JsonSchema, PartialEq, Eq)]
pub struct ContainerResult {
    pub container: String,
    pub state: ChildStatus,
    pub changed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<OpError>,
}

#[derive(Debug, Clone, Serialize, schemars::JsonSchema, PartialEq, Eq)]
pub struct OpError {
    pub code: String,
    pub message: String,
}

impl From<&ComposeError> for OpError {
    fn from(error: &ComposeError) -> Self {
        Self {
            code: error.code().to_string(),
            message: error.to_string(),
        }
    }
}

pub(crate) fn cancelled_op(operation_id: String) -> OpResult {
    let error = ComposeError::OperationCancelled {
        operation_id: operation_id.clone(),
    };
    failed_op(operation_id, None, &error)
}

/// Everything `up`/`down` need that is not the compose file itself.
pub struct LifecycleCtx<'a> {
    pub(crate) shutdown: &'a crate::shutdown::ShutdownController,
    pub file: &'a ComposeFile,
    pub engine: &'a EngineClient,
    pub post_runs: &'a hooks::PostRunSupervisor,
    /// Namespace of the compose daemon that owns this project. Children use
    /// it for explicit per-call routing to `compose::*`.
    pub compose_namespace: &'a str,
    /// Namespace the *children* register in — not the daemon's own.
    pub project_namespace: &'a str,
    pub engine_url: &'a str,
    /// Where installed packages live, shared across projects on this machine.
    pub package_cache: &'a std::path::Path,
    /// Persistent, bounded stdout and stderr for every project worker.
    pub logs: &'a LogStore,
    /// This project's state directory: with the container key, it names a
    /// VM's state at its adapter (`sandbox::state_key`).
    pub state_dir: &'a std::path::Path,
    /// This project's `DaemonState::sandbox_token`: what the adapter container
    /// is started with and what a call to its `worker::*` functions carries.
    pub sandbox_token: &'a str,
    pub(crate) empty_env_diagnostics: &'a crate::config::EmptyEnvDiagnostics,
}

/// What one container's start produced: which one, how long it took, and
/// whether it came up.
enum StartAttempt {
    Ready {
        record: ChildRecord,
        child: Box<Child>,
        recovery: Option<RetryRecovery>,
    },
    Failed(ComposeError),
    Interrupted,
}

struct RetryRecovery {
    attempt: u32,
    total_attempts: u32,
    elapsed: Duration,
}

enum StartFailure {
    Failed(ComposeError),
    Interrupted,
}

impl From<ComposeError> for StartFailure {
    fn from(error: ComposeError) -> Self {
        Self::Failed(error)
    }
}

/// One supervised container: a local process group, or a VM its adapter runs.
pub enum Child {
    Process(Supervised),
    Vm(crate::sandbox::RemoteVm),
}

impl Child {
    pub fn poll(&self) -> Outcome {
        match self {
            Self::Process(process) => process.poll(),
            Self::Vm(vm) => vm.poll(),
        }
    }

    pub async fn wait(&self) -> ExitStatus {
        match self {
            Self::Process(process) => process.wait().await,
            Self::Vm(vm) => vm.wait().await,
        }
    }

    pub async fn stop(&self, grace: Duration) -> ExitStatus {
        match self {
            Self::Process(process) => process.stop(grace).await,
            Self::Vm(vm) => vm.stop(grace).await,
        }
    }

    /// Inherited from an earlier daemon rather than started here.
    pub fn is_adopted(&self) -> bool {
        match self {
            Self::Process(process) => process.is_adopted(),
            Self::Vm(vm) => vm.is_adopted(),
        }
    }
}

/// Containers currently supervised by this daemon, keyed by container id.
pub type Children = BTreeMap<String, Child>;

/// Starts `target` (or the whole graph) in dependency order.
///
/// Containers already running are left alone and reported `changed: false`, so
/// a repeated `up` is a no-op.
pub async fn up(
    ctx: &LifecycleCtx<'_>,
    children: &mut Children,
    records: &mut BTreeMap<String, ChildRecord>,
    target: Option<&str>,
    operation_id: String,
) -> OpResult {
    up_inner(
        ctx,
        children,
        records,
        target,
        operation_id.clone(),
        Some(ctx.shutdown.signal()),
    )
    .await
    .unwrap_or_else(|| cancelled_op(operation_id))
}

/// Starts the foreground project's graph, rolling back this operation when an
/// OS shutdown signal arrives.
pub(crate) async fn up_until_shutdown(
    ctx: &LifecycleCtx<'_>,
    children: &mut Children,
    records: &mut BTreeMap<String, ChildRecord>,
    target: Option<&str>,
    operation_id: String,
    shutdown: crate::shutdown::ShutdownSignal,
) -> Option<OpResult> {
    up_inner(
        ctx,
        children,
        records,
        target,
        operation_id,
        Some(shutdown.or(ctx.shutdown.signal())),
    )
    .await
}

async fn up_inner(
    ctx: &LifecycleCtx<'_>,
    children: &mut Children,
    records: &mut BTreeMap<String, ChildRecord>,
    target: Option<&str>,
    operation_id: String,
    shutdown: Option<crate::shutdown::ShutdownSignal>,
) -> Option<OpResult> {
    report::in_project_scope(
        &ctx.file.path,
        up_scoped(ctx, children, records, target, operation_id, shutdown),
    )
    .await
}

async fn up_scoped(
    ctx: &LifecycleCtx<'_>,
    children: &mut Children,
    records: &mut BTreeMap<String, ChildRecord>,
    target: Option<&str>,
    operation_id: String,
    shutdown: Option<crate::shutdown::ShutdownSignal>,
) -> Option<OpResult> {
    let began = Instant::now();
    let order = match plan_targets(ctx.file, target) {
        Ok(order) => order,
        Err(error) => {
            report::summary_failed("up", error.code(), began.elapsed());
            return Some(failed_op(operation_id, target, &error));
        }
    };

    let mut results: Vec<ContainerResult> = Vec::new();
    // Only what *this* operation started may be rolled back.
    let mut started: Vec<String> = Vec::new();
    // Containers that failed and said their failure does not fail the
    // operation. Named so the closing line reports the partial project.
    let mut not_required_failures = Vec::new();
    let max_parallel_workers = crate::parallelism::max_parallel_workers();

    // Everything this operation will touch, drawn before any of it moves, so an
    // operator sees the shape rather than a line at a time.
    let versions = version_labels(ctx.file, order.iter().map(String::as_str));
    if target.is_none() {
        report::plan_full_labeled(&dag::outline(ctx.file, &order), &versions);
    } else {
        report::plan_labeled(&dag::outline(ctx.file, &order), &versions);
    }
    if let Some(operation) = crate::operation::active(&operation_id) {
        let outline = dag::outline(ctx.file, &order);
        operation.plan(outline.len()).await;
        for (key, depth) in &outline {
            operation
                .emit_tree(key, *depth, "waiting for dependencies")
                .await;
        }
    }

    // Grouped rather than listed: only a declared dependency has to wait, and
    // in a project of fourteen where one worker calls the other thirteen, the
    // thirteen have nothing to wait for.
    for wave in dag::waves(ctx.file, &order) {
        if shutdown.as_ref().is_some_and(|signal| signal.requested()) {
            report::plan_done();
            rollback(ctx, children, records, &started, &mut results).await;
            return None;
        }

        let mut starting: Vec<String> = Vec::new();
        for key in &wave {
       
```

### Core Architecture Module: `crates/iii-compose/src/managed_engine.rs`
```
// Copyright Motia LLC and/or licensed to Motia LLC under one or more
// contributor license agreements. Licensed under the Elastic License 2.0;
// you may not use this file except in compliance with the Elastic License 2.0.
// This software is patent protected. We welcome discussions - reach out at team@iii.dev
// See LICENSE and PATENTS files for details.

//! Lifecycle of the engine process owned by `iii compose --up`.

use std::{
    io::{Read, Seek, SeekFrom, Write},
    path::{Path, PathBuf},
    process::{ExitStatus, Stdio},
    time::Duration,
};

use serde::Serialize;
use tokio::io::AsyncReadExt;

use crate::{
    config::{CONFIGURABLE_ENGINE_WORKERS, EngineSpec},
    error::{ComposeError, Result},
    process::{ChildOutput, DEFAULT_STOP_GRACE, Supervised},
    state::StateStore,
};

/// Maximum size of the active engine log before it rolls into an archive.
const ENGINE_LOG_MAX_BYTES: u64 = 10 * 1024 * 1024;
/// Number of old engine log segments retained beside `engine.log`.
const ENGINE_LOG_ARCHIVES: usize = 3;
const ENGINE_LOCK_FILE: &str = "engine.lock";
const ENGINE_CONFIG_FILE: &str = "engine-config.yaml";
const DEFAULT_WORKER_MANAGER_HOST: &str = "0.0.0.0";

/// Private marker enabling the managed engine's stdin lifeline.
const ENGINE_LIFELINE_STDIN_ENV: &str = "III_COMPOSE_ENGINE_LIFELINE_STDIN";
const DEFAULT_WORKER_MANAGER_PORT: u16 = 49134;

/// The engine process owned by one foreground compose invocation.
pub struct ManagedEngine {
    process: Supervised,
    logs: LogCapture,
    config_path: PathBuf,
    log_path: PathBuf,
    remove_config_on_stop: bool,
    _lifeline: EngineLifeline,
    _namespace_lock: Option<NamespaceLock>,
}

impl ManagedEngine {
    /// Starts the current `iii` executable with output detached from compose's
    /// terminal and captured in the owning project's namespace directory.
    pub async fn start(
        spec: &EngineSpec,
        daemon_namespace: &str,
        compose_path: &Path,
    ) -> Result<Self> {
        ensure_listener_available(spec)?;
        let executable =
            std::env::current_exe().map_err(|err| ComposeError::EngineSpawnFailed {
                message: format!("could not locate the current iii executable: {err}"),
            })?;
        let store = StateStore::for_project(daemon_namespace, compose_path)?;
        let namespace_dir = store.dir();
        let lock_dir = namespace_dir.to_path_buf();
        let namespace = daemon_namespace.to_string();
        let namespace_lock =
            tokio::task::spawn_blocking(move || NamespaceLock::acquire(&lock_dir, &namespace))
                .await
                .map_err(|source| ComposeError::EngineSpawnFailed {
                    message: format!("could not claim the managed engine namespace: {source}"),
                })??;
        let config_path = materialize_engine_config(spec, namespace_dir, daemon_namespace)?;
        let log_path = engine_log_path(namespace_dir);
        let mut engine = Self::spawn_with_materialized_config(
            &executable,
            &config_path,
            &log_path,
            daemon_namespace,
        )
        .await?;
        engine._namespace_lock = Some(namespace_lock);
        Ok(engine)
    }

    async fn spawn_with_materialized_config(
        executable: &Path,
        config_path: &Path,
        log_path: &Path,
        namespace: &str,
    ) -> Result<Self> {
        // Cancellation before spawn must remove the materialized configuration.
        struct PendingConfig(Option<PathBuf>);
        impl Drop for PendingConfig {
            fn drop(&mut self) {
                if let Some(path) = &self.0 {
                    let _ = std::fs::remove_file(path);
                }
            }
        }
        let mut pending = PendingConfig(Some(config_path.to_path_buf()));
        match Self::spawn_with_paths(executable, config_path, log_path, namespace).await {
            Ok(mut engine) => {
                pending.0 = None;
                engine.remove_config_on_stop = true;
                Ok(engine)
            }
            Err(error) => {
                let _ = std::fs::remove_file(config_path);
                Err(error)
            }
        }
    }

    async fn spawn_with_paths(
        executable: &Path,
        config_path: &Path,
        log_path: &Path,
        namespace: &str,
    ) -> Result<Self> {
        let parent = log_path.parent().unwrap_or_else(|| Path::new("."));
        std::fs::create_dir_all(parent).map_err(|source| ComposeError::Io {
            path: parent.to_path_buf(),
            source,
        })?;
        owner_only(parent).map_err(|source| ComposeError::Io {
            path: parent.to_path_buf(),
            source,
        })?;

        let owned_log_path = log_path.to_path_buf();
        let log = tokio::task::spawn_blocking(move || {
            RotatingLog::open(&owned_log_path, ENGINE_LOG_MAX_BYTES, ENGINE_LOG_ARCHIVES)
        })
        .await
        .map_err(|source| ComposeError::EngineSpawnFailed {
            message: format!("could not prepare the engine log: {source}"),
        })?
        .map_err(|source| ComposeError::Io {
            path: log_path.to_path_buf(),
            source,
        })?;

        let mut command = tokio::process::Command::new(executable);
        command
            .arg("--config")
            .arg(config_path)
            .env(ENGINE_LIFELINE_STDIN_ENV, "1")
            .stdin(Stdio::piped());
        #[cfg(target_os = "linux")]
        {
            use std::os::unix::process::CommandExt;

            command
                .as_std_mut()
                .arg0(crate::process_title::command_name(
                    crate::process_title::Role::Engine,
                    namespace,
                ));
        }
        #[cfg(not(target_os = "linux"))]
        let _ = namespace;

        let (process, output, lifeline) =
            spawn_managed_engine(command).map_err(|err| ComposeError::EngineSpawnFailed {
                message: format!("could not start {}: {err}", executable.display()),
            })?;
        let logs = capture_output(output, log);

        Ok(Self {
            process,
            logs,
            config_path: config_path.to_path_buf(),
            log_path: log_path.to_path_buf(),
            remove_config_on_stop: false,
            _lifeline: lifeline,
            _namespace_lock: None,
        })
    }

    pub fn pid(&self) -> u32 {
        self.process.pid
    }

    pub fn config_path(&self) -> &Path {
        &self.config_path
    }

    pub fn log_path(&self) -> &Path {
        &self.log_path
    }

    pub fn follow_command(&self) -> String {
        follow_command(&self.log_path)
    }

    pub fn log_tail(&self) -> Option<String> {
        log_tail(&self.log_path)
    }

    #[cfg(test)]
    async fn wait(&self) -> ExitStatus {
        let status = self.process.wait().await;
        self.finish_logging().await;
        status
    }

    pub fn poll(&self) -> crate::process::Outcome {
        self.process.poll()
    }

    /// Its exit status once it has exited, recorded on `client` so teardown
    /// stops asking over its bus.
    pub fn poll_exit(&self, client: &crate::engine::EngineClient) -> Option<ExitStatus> {
        let crate::process::Outcome::Exited(status) = self.poll() else {
            return None;
        };
        client.mark_exited();
        Some(status)
    }

    pub async fn stop(&self, grace: Duration) -> ExitStatus {
        let status = self.process.stop(grace).await;
        self.finish_logging().await;
        if self.remove_config_on_stop {
            let _ = std::fs::remove_file(&self.config_path);
        }
        status
    }

    pub async fn stop_with_default_grace(&self) -> ExitStatus {
        self.stop(DEFAULT_STOP_GRACE).await
    }

    /// Lets the output readers flush the final bytes after the child exits.
    pub async fn finish_logging(&self) {
        let _ = tokio::time::timeout(Duration::from_secs(2), self.logs.wait()).await;
    }
}

/// The Compose-owned endpoint whose lifetime governs only the managed engine.
struct EngineLifeline {
    _stdin: tokio::process::ChildStdin,
}

fn spawn_managed_engine(
    command: tokio::process::Command,
) -> std::io::Result<(Supervised, ChildOutput, EngineLifeline)> {
    let (process, output, stdin) = crate::process::spawn_supervised_piped_with_stdin(command)?;
    Ok((process, output, EngineLifeline { _stdin: stdin }))
}

#[derive(Serialize)]
struct MaterializedEngineConfig<'a> {
    #[serde(skip_serializing_if = "Option::is_none")]
    registration_namespace_grace_ms: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    observers: Option<&'a serde_yaml::Value>,
    workers: Vec<MaterializedWorker<'a>>,
    /// Always written, so the router is bound whether or not the file asks.
    sandbox: MaterializedSandbox<'a>,
}

#[derive(Serialize)]
struct MaterializedSandbox<'a> {
    adapter: &'a str,
    namespace: &'a str,
}

#[derive(Serialize)]
struct MaterializedWorker<'a> {
    name: &'a str,
    config: &'a serde_yaml::Value,
}

/// `owner_namespace` is the project's own: the adapter runs there unless
/// `engine.sandbox.namespace` says otherwise.
fn materialize_engine_config(
    spec: &EngineSpec,
    namespace_dir: &Path,
    owner_namespace: &str,
) -> Result<PathBuf> {
    std::fs::create_dir_all(namespace_dir).map_err(|source| ComposeError::Io {
        path: namespace_dir.to_path_buf(),
        source,
    })?;
    owner_only(namespace_dir).map_err(|source| ComposeError::Io {
        path: namespace_dir.to_path_buf(),
        source,
    })?;

    let inferred_worker_manager = (!spec.workers.contains_key("iii-worker-manager"))
        .then(|| worker_manager_config_from_url(&spec.url))
        .transpose()?;
    let mut workers = Vec::new();
    for worker_type in CONFIGURABLE_ENGINE_WORKERS {
        workers.extend(
            spec.workers
                .iter()
                .filter(|(name, 
```

### Core Architecture Module: `crates/iii-compose/src/state.rs`
```
// Copyright Motia LLC and/or licensed to Motia LLC under one or more
// contributor license agreements. Licensed under the Elastic License 2.0;
// you may not use this file except in compliance with the Elastic License 2.0.
// This software is patent protected. We welcome discussions - reach out at team@iii.dev
// See LICENSE and PATENTS files for details.

//! Durable per-child state and restart reconciliation.
//!
//! A compose daemon can die while its children keep running — that is the point
//! of putting them in their own process groups. On the next start the daemon has
//! to work out, for each child it recorded, whether that process is still the
//! one it started.
//!
//! The answer is never guessed. [`reconcile`] only reads: it compares the
//! recorded birth fingerprint against the live one and reports
//! [`Reconciliation::Unverifiable`] when they disagree, so a recycled PID is
//! surfaced for manual cleanup instead of being signalled.

use std::{
    collections::BTreeMap,
    io::Write,
    path::{Path, PathBuf},
};

use serde::{Deserialize, Serialize};

use crate::{
    error::{ComposeError, Result},
    process::{BirthIdentity, birth_identity},
};

pub const STATE_FILE: &str = "state.json";

/// Directory name for relocated project state, derived from its compose file.
///
/// Two halves for two jobs: the parent directory's name so an operator
/// browsing `$III_COMPOSE_STATE_DIR` recognises what they are looking at, and a hash of
/// the canonical path so two projects that happen to share a directory name
/// stay apart. The file name itself is nearly always `worker-compose.yaml`, so
/// it carries nothing.
pub fn project_slug(compose_path: &Path) -> String {
    use sha2::{Digest, Sha256};

    let readable = compose_path
        .parent()
        .and_then(|dir| dir.file_name())
        .and_then(|name| name.to_str())
        .map(|name| {
            name.chars()
                .map(|c| if c.is_ascii_alphanumeric() { c } else { '-' })
                .collect::<String>()
        })
        .filter(|name| !name.is_empty())
        .unwrap_or_else(|| "project".to_string());

    let digest = hex::encode(Sha256::digest(compose_path.as_os_str().as_encoded_bytes()));
    format!("{readable}-{}", &digest[..8])
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, schemars::JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum ChildStatus {
    /// Spawned, not yet visible in the engine.
    Starting,
    /// Registered in the engine under `(namespace, container)`.
    Ready,
    /// Exited after it was ready, declared a `restart` policy, and is inside
    /// the wait before the supervisor's next attempt. Nothing is running under
    /// this name right now, which is what separates it from `Ready`, and the
    /// supervisor has not given up on it, which is what separates it from
    /// `Failed`.
    Restarting,
    /// Exited unsuccessfully with no eligible retry, exhausted its retries, or
    /// a hook failed.
    Failed,
    /// Stopped by the daemon, or exited successfully without an eligible
    /// restart.
    Stopped,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChildRecord {
    /// `None` for a VM container, which has no local process.
    #[serde(default)]
    pub pid: Option<u32>,
    /// Fingerprint taken when the child was spawned. Without a match, the PID is
    /// never signalled again.
    #[serde(default)]
    pub birth: Option<BirthIdentity>,
    /// The VM a VM container runs, at the adapter that runs it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vm: Option<VmRecord>,
    pub status: ChildStatus,
    /// Seconds since the unix epoch, for `compose::status` output.
    pub started_at: u64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

/// One boot of a VM container: `instance` names it, so a call about an older
/// boot cannot touch a newer one.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct VmRecord {
    pub adapter: String,
    /// Where the adapter's `worker::*` functions are registered.
    pub namespace: String,
    pub vm_id: String,
    pub instance: u64,
}

impl ChildRecord {
    pub fn new(pid: u32, birth: BirthIdentity, status: ChildStatus) -> Self {
        Self {
            pid: Some(pid),
            birth: Some(birth),
            vm: None,
            status,
            started_at: now_unix(),
            last_error: None,
        }
    }

    pub fn from_supervised(child: &crate::process::Supervised, status: ChildStatus) -> Self {
        Self::new(child.pid, child.birth.clone(), status)
    }

    pub fn from_child(child: &crate::lifecycle::Child, status: ChildStatus) -> Self {
        match child {
            crate::lifecycle::Child::Process(process) => Self::from_supervised(process, status),
            crate::lifecycle::Child::Vm(vm) => Self {
                pid: None,
                birth: None,
                vm: Some(vm.record.clone()),
                status,
                started_at: now_unix(),
                last_error: None,
            },
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DaemonState {
    /// Compose file this state belongs to, canonicalized. It is also what the
    /// state is bound to — see [`DaemonState::check_binding`].
    pub compose_path: PathBuf,
    pub namespace: String,
    #[serde(default)]
    pub containers: BTreeMap<String, ChildRecord>,
    /// The compose process that opened this project last. `None` in state
    /// written before it was recorded.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner: Option<Owner>,
    /// Secret that lets this project's engine call the sandbox adapter's
    /// `worker::*` functions. Minted when the project first opens, kept in this
    /// 0600 file so a restarted daemon hands the same value to an adopted
    /// adapter, and given to the adapter container only. `None` in state
    /// written before it existed.
    // shortcut: sandbox-libkrun hides this file from a VM whose worker directory holds it only from
    // 0.3.1 on, and only under a directory named `.iii`, move the token out of the project directory
    // if older versions must stay supported.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sandbox_token: Option<String>,
}

/// One compose process, fingerprinted like the children it records.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Owner {
    pub pid: u32,
    pub birth: BirthIdentity,
}

impl Owner {
    pub fn current() -> Self {
        let pid = std::process::id();
        Self {
            pid,
            birth: birth_identity(pid),
        }
    }

    /// Whether this compose process is still running. Children recorded by a
    /// live owner are its own, even when another process reads the state; a
    /// dead owner's survivors are supervised by nobody.
    pub fn is_alive(&self) -> bool {
        // Equality, not `matches`: this process is alive even where no
        // fingerprint can be taken.
        if self.pid == std::process::id() {
            return self.birth == birth_identity(self.pid);
        }
        crate::process::is_running(self.pid) && self.birth.matches(&birth_identity(self.pid))
    }
}

impl DaemonState {
    pub fn new(compose_path: &Path, namespace: &str) -> Self {
        Self {
            compose_path: compose_path.to_path_buf(),
            namespace: namespace.to_string(),
            containers: BTreeMap::new(),
            owner: None,
            sandbox_token: None,
        }
    }

    /// Refuses state recorded for a different compose file.
    ///
    /// Two compose files in the same directory must use different namespaces.
    /// Adopting another file's state would let one project kill its children.
    pub fn check_binding(&self, compose_path: &Path) -> Result<()> {
        if self.compose_path == compose_path {
            return Ok(());
        }
        Err(ComposeError::InvalidState {
            path: compose_path.to_path_buf(),
            message: format!(
                "it records {} instead. Use a different namespace for each compose file in this directory",
                self.compose_path.display()
            ),
        })
    }
}

/// What a restarting daemon should do with one recorded child.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Reconciliation {
    /// Same process, still running: re-adopt it without restarting anything.
    /// Only a live owner's children are kept that way; see
    /// [`DaemonState::owner`].
    Adopt,
    /// The process is gone. Its `post_run` still owes a run and its local
    /// dependents have to come down.
    Gone,
    /// A live PID that is not provably the recorded process — a recycled PID, or
    /// a platform that cannot fingerprint. Never signalled; reported instead.
    Unverifiable,
    /// This daemon stopped it on purpose, or recorded it as failed and why:
    /// nothing to adopt, nothing to report. `down` leaves the record behind and
    /// `restart` re-opens the project right after it.
    Stopped,
}

/// Read-only: inspects the recorded child and returns what to do. Signals
/// nothing, kills nothing.
pub fn reconcile(record: &ChildRecord) -> Reconciliation {
    // A failed record's last_error already says why; re-checking it would
    // replace that with "exited". A failed record can still be running (an
    // unverifiable pid, or a VM whose worker::stop got no answer); reading it
    // as stopped never signals it, and its adapter still owns the VM.
    if matches!(record.status, ChildStatus::Stopped | ChildStatus::Failed) {
        return Reconciliation::Stopped;
    }
    // No process: a VM container, which only its adapter can answer for.
    let (Some(pid), Some(birth)) = (record.pid, &record.birth) else {
        return Reconcili
```

### Core Architecture Module: `crates/iii-sandbox-contract/src/worker.rs`
```
// Copyright Motia LLC and/or licensed to Motia LLC under one or more
// contributor license agreements. Licensed under the Elastic License 2.0.

//! Request and response types of the `<adapter>::worker::*` operations. `iii sandbox` calls
//! them to run one Compose container's VM through the adapter.
//!
//! Every request carries `auth`: the project token, or, with
//! [`FEATURE_SCOPED_AUTH`](crate::FEATURE_SCOPED_AUTH), the token scoped to the VM's state key
//! ([`scoped_auth_token`]). A scoped token controls that one VM and no other.

use crate::channel::StreamChannelRef;
use hmac::{Hmac, Mac};
use schemars::JsonSchema;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::BTreeMap;

/// What the scoped token's MAC covers before the state key, so it can never equal another MAC
/// of the project token over the same bytes. A different derivation gets a new version.
const SCOPED_AUTH_DOMAIN: &[u8] = b"iii-sandbox/worker-scope/v1\0";

/// The token that authorizes `worker::*` calls for the VM of `state_key` alone: the lowercase
/// hex of HMAC-SHA256 keyed with the project token over `iii-sandbox/worker-scope/v1\0`
/// followed by the state key. Compose hands it to the container that runs the VM; the adapter
/// recomputes it from the project token it already holds, so neither side stores a token per VM.
/// `tests/fixtures/scoped_auth.json` pins it.
pub fn scoped_auth_token(project_token: &str, state_key: &str) -> String {
    hex::encode(scoped_mac(project_token, state_key).finalize().into_bytes())
}

/// Whether `presented` is the scoped token for `state_key`, compared in constant time. Never
/// with an empty project token, whose MAC anyone can compute, or an empty state key.
pub fn scoped_auth_matches(project_token: &str, state_key: &str, presented: &str) -> bool {
    if project_token.is_empty() || state_key.is_empty() {
        return false;
    }
    let Ok(tag) = hex::decode(presented) else {
        return false;
    };
    scoped_mac(project_token, state_key)
        .verify_slice(&tag)
        .is_ok()
}

fn scoped_mac(project_token: &str, state_key: &str) -> Hmac<Sha256> {
    // HMAC takes a key of any length; only fixed-size MACs can refuse one.
    let mut mac = Hmac::<Sha256>::new_from_slice(project_token.as_bytes())
        .expect("HMAC accepts a key of any length");
    mac.update(SCOPED_AUTH_DOMAIN);
    mac.update(state_key.as_bytes());
    mac
}

/// Where the worker's code comes from.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum WorkerSource {
    Bundle {
        /// Manifest name, not the container key.
        package: String,
        /// The bundle in Compose's package cache.
        host_path: String,
    },
    /// Local sources always sync into the VM.
    Local {
        host_path: String,
        run_override: Option<String>,
    },
}

/// Idempotent image and base-layer pull; long-running.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WorkerPrepareRequest {
    /// The project token or the VM's scoped token.
    pub auth: String,
    pub source: WorkerSource,
    /// The VM the prepare is for. Required with a scoped token, which the adapter checks
    /// against it. Since contract 1.2.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state_key: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WorkerPrepareResponse {}

/// Boots the VM. The adapter reads resources from the worker's manifest.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WorkerStartRequest {
    /// The project token or the VM's scoped token.
    pub auth: String,
    /// Hash of the compose state dir and container key; the same key gets the same persistent upper.
    pub state_key: String,
    /// Container key; becomes `III_WORKER_NAME`.
    pub worker_name: String,
    pub source: WorkerSource,
    /// Complete guest env. Never on the `__vm-boot` argv: the adapter writes it
    /// to `__vm-boot`'s stdin, which sends it to the guest init over the
    /// `iii.env` virtio-console port, not the kernel cmdline (only a build
    /// without an embedded init still uses the cmdline).
    pub env: BTreeMap<String, String>,
    /// The engine's URL as seen from the host.
    pub engine_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WorkerStartResponse {
    /// Opaque; stable per `state_key`.
    pub vm_id: String,
    /// Increments on every boot of this `vm_id`.
    pub instance: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WorkerStatusRequest {
    pub auth: String,
    pub vm_id: String,
    pub instance: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum State {
    Preparing,
    Running,
    Exited,
    Stopped,
    Unknown,
}

/// Reply of `worker::status` and `worker::stop`.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WorkerStatus {
    pub vm_id: String,
    pub instance: u64,
    pub state: State,
    pub exit_code: Option<i32>,
    /// The signal that ended the VM, if one did.
    pub signal: Option<i32>,
    pub started_at_ms: u64,
    pub ended_at_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WorkerLogsRequest {
    pub auth: String,
    pub vm_id: String,
    /// `LogRecord.cursor` of the last record the caller has; reading resumes right after it.
    /// Opaque to the caller. A cursor past the end of the log (after a rotation) reads from the
    /// start.
    pub cursor: Option<u64>,
    /// Keep the channel open while the instance runs.
    pub follow: bool,
    /// Writer end of a channel the caller created; one `LogRecord` JSON per text frame.
    pub channel: StreamChannelRef,
    /// Start after the record that is last when the request arrives, ignoring `cursor`: a client
    /// that reattaches to a running instance gets only what follows, not the log again. Since
    /// contract 1.2 ([`FEATURE_LOGS_FROM_END`](crate::FEATURE_LOGS_FROM_END)); an older adapter
    /// ignores it. The response's `cursor` says where the stream started.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub from_end: bool,
}

/// Returned once the log pump starts; the records travel over the channel.
#[derive(Debug, Clone, Default, Serialize, Deserialize, JsonSchema)]
pub struct WorkerLogsResponse {
    /// With `from_end`: the cursor of the record that was last when the request arrived, the
    /// one the stream starts after, so a stream reopened later resumes there instead of at the
    /// end again; `None` when the log was empty. Since contract 1.2.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
#[serde(rename_all = "snake_case")]
pub enum LogStream {
    Stdout,
    Stderr,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct LogRecord {
    pub stream: LogStream,
    pub line: String,
    pub ts_ms: u64,
    /// Resume point: pass it as `WorkerLogsRequest.cursor` to continue after this record.
    pub cursor: u64,
}

/// Idempotent; `grace_ms: 0` kills. Replies with the final `WorkerStatus`.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WorkerStopRequest {
    pub auth: String,
    pub vm_id: String,
    /// Names the boot to stop, so a stale stop cannot hit a newer one.
    pub instance: u64,
    pub grace_ms: u64,
}

/// Refused while the VM is running.
#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WorkerDestroyRequest {
    pub auth: String,
    pub state_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, JsonSchema)]
pub struct WorkerDestroyResponse {
    pub destroyed: bool,
}

```

### Core Architecture Module: `crates/scaffolder-core/src/cli.rs`
```
// Copyright Motia LLC and/or licensed to Motia LLC under one or more
// contributor license agreements. Licensed under the Elastic License 2.0;
// you may not use this file except in compliance with the Elastic License 2.0.
// This software is patent protected. We welcome discussions - reach out at team@iii.dev
// See LICENSE and PATENTS files for details.

//! Scaffolding helpers for `iii project init` (engine): the dotfile-exemption
//! and `data/`-filter rules for the target directory.

use crate::{IiiConfig, ProductConfig, TemplateFetcher, copy_template};
use colored::Colorize;
use std::path::{Path, PathBuf};

/// Resolve the scaffold target directory.
///
/// `None` -> current working directory.
/// `Some("")` -> error (empty argument).
/// `Some(path)` -> that path as a `PathBuf`.
pub fn resolve_root(dir: Option<&str>) -> Result<PathBuf, String> {
    match dir {
        Some(d) if d.trim().is_empty() => Err("directory argument cannot be empty".to_string()),
        Some(d) => Ok(PathBuf::from(d)),
        None => std::env::current_dir().map_err(|e| format!("cannot read cwd: {}", e)),
    }
}

/// Reject scaffolding into a non-empty directory unless the user opted in via
/// `allow_non_empty`, OR the directory is already initialized (detected by
/// the presence of `.iii/project.ini`).
///
/// Hidden dotfiles (`.git/`, `.gitignore`, etc.) are not considered "user
/// content"; anything else, including a `data/` directory, blocks the
/// scaffold (an existing `data/` belongs to some engine and clobbering its
/// project would orphan that state).
pub fn check_directory_state(root: &Path, allow_non_empty: bool) -> Result<(), String> {
    if !root.exists() {
        return Ok(());
    }
    if !root.is_dir() {
        return Err(format!("{} exists but is not a directory", root.display()));
    }
    if root.join(".iii").join("project.ini").exists() {
        return Ok(());
    }
    if allow_non_empty {
        return Ok(());
    }
    let entries: Vec<String> = match std::fs::read_dir(root) {
        Ok(rd) => rd
            .filter_map(|e| e.ok())
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .filter(|name| !name.starts_with('.'))
            .collect(),
        Err(e) => return Err(format!("read {}: {e}", root.display())),
    };
    if entries.is_empty() {
        Ok(())
    } else {
        let mut sample = entries.clone();
        sample.sort();
        let preview: Vec<String> = sample.iter().take(5).cloned().collect();
        let suffix = if sample.len() > 5 {
            format!(", and {} more", sample.len() - 5)
        } else {
            String::new()
        };
        Err(format!(
            "{} contains {}{}",
            root.display(),
            preview.join(", "),
            suffix
        ))
    }
}

/// Build a `TemplateFetcher` -- local-dir fixture when `template_dir` is set,
/// otherwise the canonical remote source from `IiiConfig`.
pub fn build_fetcher(template_dir: Option<&str>) -> anyhow::Result<TemplateFetcher> {
    if let Some(dir) = template_dir {
        Ok(TemplateFetcher::from_local(
            PathBuf::from(dir),
            IiiConfig.name(),
        ))
    } else {
        TemplateFetcher::from_config(&IiiConfig)
    }
}

/// Apply a template to `target`, skipping any files that already exist at the
/// destination. This is the idempotent variant -- safe to re-run without
/// clobbering user edits to `.gitignore`, `iii.worker.yaml`, or any other
/// scaffolded file. Equivalent to `write_if_absent` per-file.
///
/// Merges the root manifest's `language_files` with the per-template overrides.
pub async fn apply_template_idempotent(
    fetcher: &mut TemplateFetcher,
    template_name: &str,
    target: &Path,
) -> anyhow::Result<()> {
    let root_manifest = fetcher.fetch_root_manifest().await?;
    let manifest = fetcher.fetch_template_manifest(template_name).await?;
    let mut language_files = root_manifest.language_files.clone();
    language_files.merge(&manifest.language_files);

    // copy_template writes files unconditionally. To get write-if-absent
    // behavior, scaffold into a tempdir first, then walk it and copy each
    // entry to `target` only when the destination doesn't already exist.
    let staging = tempfile::tempdir()?;
    copy_template(
        fetcher,
        template_name,
        &manifest,
        staging.path(),
        &[],
        &language_files,
    )
    .await?;
    merge_dir_if_absent(staging.path(), target)?;
    Ok(())
}

fn merge_dir_if_absent(src: &Path, dst: &Path) -> std::io::Result<()> {
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        let ft = entry.file_type()?;
        if ft.is_dir() {
            std::fs::create_dir_all(&to)?;
            merge_dir_if_absent(&from, &to)?;
        } else if !to.exists() {
            if let Some(parent) = to.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

/// Print a standardized error block (red header, dimmed cause + fix lines) and
/// return exit code `1`.
pub fn print_err(problem: &str, cause: &str, fix: &str) -> i32 {
    eprintln!("{} {}", "error:".red().bold(), problem);
    eprintln!("  {} {}", "cause:".dimmed(), cause);
    eprintln!("  {} {}", "fix:".dimmed(), fix);
    1
}

```

### Core Architecture Module: `crates/scaffolder-core/src/iii.rs`
```
//! iii-specific [`ProductConfig`] implementation.
//!
//! Lives here (rather than in the engine binary) so that any future caller
//! who wants to drive the scaffolder against the iii product reuses one
//! definition. Constants are also drawn from [`runtime::tool::iii_tool`]
//! where possible to keep docs/install URLs in a single place.
//!
//! [`ProductConfig`]: crate::ProductConfig

use crate::product::ProductConfig;

/// Product-config impl for iii.
#[derive(Debug, Clone, Default)]
pub struct IiiConfig;

impl ProductConfig for IiiConfig {
    fn name(&self) -> &'static str {
        "iii"
    }

    fn display_name(&self) -> &'static str {
        "iii"
    }

    fn default_template_url(&self) -> &'static str {
        "https://github.com/iii-hq/templates.git"
    }

    fn template_url_env(&self) -> &'static str {
        "III_TEMPLATE_URL"
    }

    fn requires_iii(&self) -> bool {
        true
    }

    fn docs_url(&self) -> &'static str {
        // Source of truth lives in `runtime::tool::iii_tool()`. We
        // re-state the URL here because the trait demands `&'static str`
        // and `iii_tool().config().docs_url` is an opaque accessor; if
        // the source of truth moves, a search for `iii.dev/docs` will
        // surface every site that needs to be updated.
        "https://iii.dev/docs"
    }

    fn cli_description(&self) -> &'static str {
        "CLI for scaffolding iii projects"
    }

    fn upgrade_command(&self) -> &'static str {
        "iii update"
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn iii_config_defaults_match_runtime_tool() {
        let cfg = IiiConfig;
        assert_eq!(cfg.name(), "iii");
        assert_eq!(cfg.display_name(), "iii");
        assert_eq!(
            cfg.docs_url(),
            crate::runtime::tool::iii_tool().config().docs_url
        );
        assert!(cfg.requires_iii());
    }
}

```

### Core Architecture Module: `crates/scaffolder-core/src/lib.rs`
```
//! Scaffolder Core - Shared library for project scaffolding CLIs
//!
//! This library provides the core functionality for scaffolding projects from templates.
//! It is designed to be used by multiple CLI binaries (e.g., `iii`) that share
//! the same underlying scaffolding logic but have different product configurations.
//!
//! # Architecture
//!
//! - **Core operations:** template fetching, copying, runtime detection, telemetry
//! - **Workflow orchestration:** `ProductConfig` trait describing each product
//! - **CLI/TUI interface:** cliclack-based prompts exposed via `run`

pub mod cli;
pub mod iii;
pub mod product;
pub mod runtime;
pub mod telemetry;
pub mod templates;
pub mod tui;

// Re-export main types for convenience
pub use iii::IiiConfig;
pub use product::ProductConfig;
pub use runtime::{Language, RuntimeInfo, check_runtimes};
pub use templates::{
    LanguageFiles, RootManifest, TemplateFetcher, TemplateManifest, TemplateSource, copy_template,
};
pub use tui::run;

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2237** (2026-10-27): **Trigger registry: teardown racing a re-home or an in-flight activation leaves bindings firing untracked or resurrects them**
  *Symptoms*: ## Summary  Found while reviewing #2198 (the fix for #2178). There are four races in `engine/src/trigger.rs`. Each one ends with a binding that keeps firing when it shouldn't: either a provider keeps running it with no registry entry left to tear it down, or it gets published live after an explicit unregister or an owner disconnect.  **All four reproduce on `main` (merge base `3ccf2251f`) and on #2198 (`2e872b7cd`).** They are pre-existing and not caused by #2198. That PR removes the accidental serialization the shard guards provided, which only made some interleavings less likely. Repro tests are at the bottom.  ## Cases  ### 1. `unregister_worker` tears bindings down on a stale provider (one-line fix)  `unregister_worker` snapshots the worker's bindings. For each one it calls `remove_if(worker_id matches)`, but then sends `unregister_trigger` to the provider from `trigger.provider_key()` of the **snapshot**, not of the entry actually removed ([code](https://github.com/iii-hq/iii/blob/2e872b7cd01252ac3e7e86d0dafdbe85f20430b7/engine/src/trigger.rs#L544-L566)). Suppose a home provider re-homes some of those bindings (`default` → `shop`) while the loop is awaiting a provider call. The loop then removes the re-homed entries from the registry but tells the fallback to let go. `shop` keeps running them, and nothing can unregister them anymore.  ``` registry still tracks []; `shop` still runs N untracked bindings: [...] ```  N was 52, 31 and 4 in different runs; it depends on DashM

- **Issue #1884** (2026-07-16): **Generated docker-compose .env not forwarded to engine; ${RABBITMQ_USER} unset at runtime**
  *Symptoms*: ## Summary  The generated `docker-compose.yml` does not forward the generated `.env` into the engine container, so `${VAR}` placeholders in `config.yaml` (for example the RabbitMQ credentials) are unset at runtime and the engine fails to boot once a user switches a worker to a remote adapter.  Tested on Linux with engine `0.19.4`.  ## Reproduction  1. `iii project init --docker` (generates `.env` with `RABBITMQ_USER=iii` / `RABBITMQ_PASS=...`). 2. Uncomment the `rabbitmq` service in `docker-compose.yml` and switch `iii-queue` to the `rabbitmq` adapter with `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@rabbitmq:5672` in `config.yaml`. 3. `docker compose up`.  ## Actual  ``` Environment variable 'RABBITMQ_USER' not set ```  ## Expected  The credentials the generator wrote to `.env` should be available to the engine's `${VAR}` expansion.  ## Root cause  - The generator writes `.env` with the RabbitMQ creds: `engine/src/cli/project/mod.rs:390-402`. - `${VAR}` in `config.yaml` is expanded by the **engine process**, so the variable must be in the **container's** environment. - Docker Compose only uses `.env` to substitute the compose file itself; it does **not** inject those variables into the container unless the service declares `env_file:` (or an explicit `environment:` list). The generated `iii` service declares neither (templates in `iii-hq/templates`; mirrored at `engine/tests/fixtures/templates/docker/docker-compose.yml`).  ## Proposed fix  Add `env_file: .env` to the generated 

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

### Incident Patch 1: `175858b5` (2026-11-12)
**Commit Message**: fix(docs): point the 0.21.x reference tab at the existing reference pages (#2539)

Co-authored-by: iii harness (claude-opus-5-5) <[REDACTED_EMAIL]>

**File**: `docs/0-21-0/reference/helpers-python.mdx` (modified, +1/-1)
```diff
@@ -363,7 +363,7 @@ redact_and_truncate(value: Any, max_bytes: Optional[int] = None) -> tuple[str, b
 </ParamField>
 
 <ParamField body="max_bytes" type="Optional[int]">
-  Optional cap on the serialized byte length; unset or <= 0 means no cap.
+  Optional cap on the serialized byte length; unset, zero, or negative means no cap.
 </ParamField>
 
 
```

**File**: `docs/0-21-0/reference/helpers-python.mdx.skill.md` (modified, +1/-1)
```diff
@@ -360,7 +360,7 @@ redact_and_truncate(value: Any, max_bytes: Optional[int] = None) -> tuple[str, b
 </ParamField>
 
 <ParamField body="max_bytes" type="Optional[int]">
-  Optional cap on the serialized byte length; unset or <= 0 means no cap.
+  Optional cap on the serialized byte length; unset, zero, or negative means no cap.
 </ParamField>
 
 
```

**File**: `docs/docs.json` (modified, +8/-8)
```diff
@@ -1002,26 +1002,26 @@
               {
                 "group": "Engine protocol",
                 "pages": [
-                  "0-21-0/sdk-reference/engine-sdk"
+                  "0-21-0/reference/engine-protocol"
                 ]
               },
               {
                 "group": "Language SDKs",
                 "expanded": true,
                 "pages": [
-                  "0-21-0/api-reference/sdk-node",
-                  "0-21-0/api-reference/sdk-python",
-                  "0-21-0/api-reference/sdk-rust",
-                  "0-21-0/api-reference/sdk-browser"
+                  "0-21-0/reference/sdk-node",
+                  "0-21-0/reference/sdk-python",
+                  "0-21-0/reference/sdk-rust",
+                  "0-21-0/reference/sdk-browser"
                 ]
               },
               {
                 "group": "Helpers",
                 "expanded": true,
                 "pages": [
-                  "0-21-0/api-reference/helpers-node",
-                  "0-21-0/api-reference/helpers-python",
-                  "0-21-0/api-reference/helpers-rust"
+                  "0-21-0/reference/helpers-node",
+                  "0-21-0/reference/helpers-python",
+                  "0-21-0/reference/helpers-rust"
                 ]
               },
               {
```

---

### Incident Patch 2: `e6b09eea` (2026-11-12)
**Commit Message**: perf: take the fixed waits out of the quickstart (curl → "Press b") (#2555)

**File**: `crates/iii-compose/src/daemon.rs` (modified, +45/-38)
```diff
@@ -767,45 +767,52 @@ impl Daemon {
             crate::sandbox::require_declared_adapter(&compose, &namespace)?;
             (prepared, None)
         } else {
-            let mut prepared =
-                crate::lockfile::prepare_metadata(&mut compose, &BTreeSet::new()).await?;
-            let path = compose.path.clone();
-            let change = crate::sandbox::apply_adapter_change(
-                &path,
-                &mut edited,
-                &mut compose,
-                &namespace,
-                &mut prepared,
-                &mut BTreeSet::new(),
-                &mut BTreeMap::new(),
-                false,
-                false,
-            )
-            .await?;
-            let ahead = if vms_ahead {
-                crate::sandbox::ahead(&compose, &namespace)?
-            } else {
-                None
-            };
-            match &ahead {
-                Some((adapter, bundles)) => {
-                    let first = bundles.iter().chain([adapter]).cloned().collect();
-                    prepared.install_only(&package_cache, &first).await?;
-                }
-                None => prepared.install(&package_cache).await?,
-            }
-            if let Some(crate::sandbox::AdapterChange::Upsert(adapter)) = change {
-                let needs = crate::sandbox::needs(&compose, &namespace);
-                crate::report::daemon_line(
-                    &format!(
-                        "{}: sandbox adapter for: {}",
-                        adapter.key,
-                        crate::sandbox::needed_by(&needs).join(", ")
-                    ),
+            // A first lock-less start learns only from this pass that a VM
+            // needs the adapter: resolving the adapter beside it saves the
+            // round trip that would follow it.
+            crate::registry::remembering(async {
+                let mut prepared =
+                    crate::sandbox::prepare_metadata_with_adapter_ahead(&mut compose, &namespace)
+                        .await?;
+                let path = compose.path.clone();
+                let change = crate::sandbox::apply_adapter_change(
+                    &path,
+                    &mut edited,
+                    &mut compose,
+                    &namespace,
+                    &mut prepared,
+                    &mut BTreeSet::new(),
+                    &mut BTreeMap::new(),
                     false,
-                );
-            }
-            (prepared, ahead)
+                    false,
+                )
+                .await?;
+                let ahead = if vms_ahead {
+                    crate::sandbox::ahead(&compose, &namespace)?
+                } else {
+                    None
+                };
+                match &ahead {
+                    Some((adapter, bundles)) => {
+                        let first = bundles.iter().chain([adapter]).cloned().collect();
+                        prepared.install_only(&package_cache, &first).await?;
+                    }
+                    None => prepared.install(&package_cache).await?,
+                }
+                if let Some(crate::sandbox::AdapterChange::Upsert(adapter)) = change {
+                    let needs = crate::sandbox::needs(&compose, &namespace);
+                    crate::report::daemon_line(
+                        &format!(
+                            "{}: sandbox adapter for: {}",
+                            adapter.key,
+                            crate::sandbox::needed_by(&needs).join(", ")
+                        ),
+                        false,
+                    );
+                }
+                Ok::<_, ComposeError>((prepared, ahead))
+            })
+            .await?
         };
         let project = self.project(file).await?;
         if edited != text {
```

**File**: `crates/iii-compose/src/lockfile.rs` (modified, +3/-3)
```diff
@@ -430,7 +430,7 @@ where
             }
         }))
         // Overlap registry requests without changing which declared failure is reported first.
-        .buffered(crate::parallelism::max_parallel_workers());
+        .buffered(crate::parallelism::max_parallel_resolves());
 
     while let Some(result) = resolutions.next().await {
         let (key, entry) = result?;
@@ -897,11 +897,11 @@ mod tests {
     }
 
     #[tokio::test]
-    async fn metadata_resolution_overlaps_requests_with_the_compose_limit() {
+    async fn metadata_resolution_overlaps_requests_with_the_resolve_limit() {
         use std::cell::Cell;
 
         let dir = tempfile::tempdir().unwrap();
-        let limit = crate::parallelism::max_parallel_workers();
+        let limit = crate::parallelism::max_parallel_resolves();
         let count = limit + 1;
         let mut yaml = String::from("containers:\n");
         for index in 0..count {
```

**File**: `crates/iii-compose/src/parallelism.rs` (modified, +24/-1)
```diff
@@ -14,10 +14,26 @@ pub(crate) fn max_parallel_workers() -> usize {
 }
 
 fn parse_max_parallel_workers(value: Option<&str>) -> usize {
+    parse(value).unwrap_or(DEFAULT_MAX_PARALLEL_WORKERS)
+}
+
+/// A registry `/resolve` is one small request: a whole project's go out at
+/// once, not eight at a time, unless the operator set the limit.
+const DEFAULT_MAX_PARALLEL_RESOLVES: usize = 32;
+
+pub(crate) fn max_parallel_resolves() -> usize {
+    let value = std::env::var(MAX_PARALLEL_WORKERS_ENV).ok();
+    parse_max_parallel_resolves(value.as_deref())
+}
+
+fn parse_max_parallel_resolves(value: Option<&str>) -> usize {
+    parse(value).unwrap_or(DEFAULT_MAX_PARALLEL_RESOLVES)
+}
+
+fn parse(value: Option<&str>) -> Option<usize> {
     value
         .and_then(|value| value.trim().parse::<usize>().ok())
         .filter(|value| *value > 0)
-        .unwrap_or(DEFAULT_MAX_PARALLEL_WORKERS)
 }
 
 #[cfg(test)]
@@ -29,6 +45,13 @@ mod tests {
         assert_eq!(parse_max_parallel_workers(None), 8);
     }
 
+    #[test]
+    fn resolves_default_to_thirty_two_and_follow_the_operator_limit() {
+        assert_eq!(parse_max_parallel_resolves(None), 32);
+        assert_eq!(parse_max_parallel_resolves(Some("2")), 2);
+        assert_eq!(parse_max_parallel_resolves(Some("0")), 32);
+    }
+
     #[test]
     fn parallel_worker_limit_accepts_a_positive_environment_value() {
         assert_eq!(parse_max_parallel_workers(Some("16")), 16);
```

**File**: `crates/iii-compose/src/registry.rs` (modified, +200/-33)
```diff
@@ -48,6 +48,19 @@ const RESOLVE_RETRY_DELAY: Duration = Duration::from_millis(250);
 /// Downloads get their own budget: an artefact is megabytes over a link we do
 /// not control.
 const DOWNLOAD_TIMEOUT: Duration = Duration::from_secs(300);
+/// A download whose connection fails or breaks off mid-body (a CDN reset reads
+/// as "error decoding response body"), or that gets a 5xx, starts over: one
+/// such break no longer fails a whole `up`.
+const DOWNLOAD_ATTEMPTS: usize = 3;
+const DOWNLOAD_RETRY_DELAY: Duration = Duration::from_millis(500);
+/// A body that sends nothing for this long counts as broken off: a stalled CDN
+/// connection otherwise sat about 30 s before it reset. Even a slow link
+/// delivers some bytes every fraction of a second.
+const DOWNLOAD_STALL_TIMEOUT: Duration = Duration::from_secs(10);
+/// How long one attempt waits for the response headers: a server that took
+/// the connection and answers nothing is tried again, not waited out for the
+/// whole [`DOWNLOAD_TIMEOUT`] three times.
+const DOWNLOAD_HEADERS_TIMEOUT: Duration = Duration::from_secs(if cfg!(test) { 1 } else { 30 });
 const INTEGRITY_FILE: &str = ".iii-compose-integrity.json";
 
 #[derive(Debug, Serialize, Deserialize)]
@@ -74,7 +87,7 @@ struct ResolvedEdge {
     to: String,
 }
 
-#[derive(Debug, Deserialize)]
+#[derive(Debug, Clone, Deserialize)]
 struct ResolvedWorker {
     name: String,
     #[serde(default)]
@@ -565,6 +578,26 @@ tokio::task_local! {
     pub(crate) static TEST_REGISTRY: String;
 }
 
+tokio::task_local! {
+    /// The workers [`resolve`] already received inside [`remembering`], by
+    /// `(registry, name, range)`.
+    static RESOLVED: std::sync::Mutex<std::collections::HashMap<(String, String, String), ResolvedWorker>>;
+}
+
+/// Runs `future` with [`resolve`] answering again from what it already
+/// received in it: the same worker and range, or the exact version an earlier
+/// answer chose, makes no second request. Inside another `remembering`, it
+/// shares that one.
+///
+/// Scoped to one preparation, so a daemon that runs for days still sees a
+/// release published after its last operation.
+pub(crate) async fn remembering<F: std::future::Future>(future: F) -> F::Output {
+    if RESOLVED.try_with(|_| ()).is_ok() {
+        return future.await;
+    }
+    RESOLVED.scope(Default::default(), future).await
+}
+
 /// Everything a worker needs, resolved in one request.
 ///
 /// The registry answers `/resolve` with the whole graph, not just the worker
@@ -1073,8 +1106,22 @@ async fn resolve(
     version_range: &str,
     candidates: &[&str],
 ) -> Result<ResolvedWorker> {
+    let key = |range: &str| (registry.to_string(), name.to_string(), range.to_string());
+    let remembered = RESOLVED
+        .try_with(|resolved| {
+            resolved
+                .lock()
+                .unwrap_or_else(|poisoned| poisoned.into_inner())
+                .get(&key(version_range))
+                .cloned()
+        })
+        .ok()
+        .flatten();
+    if let Some(worker) = remembered {
+        return Ok(worker);
+    }
     let resolved = resolve_response(container, registry, name, version_range, candidates).await?;
-    resolved
+    let worker = resolved
         .graph
         .into_iter()
         .find(|worker| worker.name == name)
@@ -1083,7 +1130,15 @@ async fn resolve(
             name: name.to_string(),
             range: version_range.to_string(),
             message: "the registry resolved a graph that does not contain it".to_string(),
-        })
+        })?;
+    let _ = RESOLVED.try_with(|resolved| {
+        let mut resolved = resolved
+            .lock()
+            .unwrap_or_else(|poisoned| poisoned.into_inner());
+        resolved.insert(key(&worker.version), worker.clone());
+        resolved.insert(key(version_range), worker.clone());
+    });
+    Ok(worker)
 }
 
 /// Turns the registry's failure body into one sentence.
@@ -1149,38 +1204,20 @@ async fn download_and_extract(
         .build()
         .map_err(|err| download_error(container, &artifact.url, &err.to_string()))?;
 
-    let mut response = client
-        .get(&artifact.url)
-        .send()
-        .await
-        .and_then(|response| response.error_for_status())
-        .map_err(|err| download_error(container, &artifact.url, &err.to_string()))?;
-    crate::report::download_started(container, response.content_length());
-
-    let capacity = response
-        .content_length()
-        .and_then(|length| usize::try_from(length).ok())
-        .unwrap_or_default()
-        .min(8 * 1024 * 1024);
-    let mut bytes = Vec::with_capacity(capacity);
-    let mut hasher = Sha256::new();
-    let mut downloaded = 0_u64;
-    loop {
-        let chunk = match response.chunk().await {
-            Ok(Some(chunk)) => chunk,
-            Ok(None) => break,
-            Err(err) => {
+    let mut attempt = 1;
+    let (bytes, digest, downloaded) = loop {
+        match fetch_artifact(&client, co
```

**File**: `crates/iii-compose/src/sandbox.rs` (modified, +246/-34)
```diff
@@ -309,6 +309,63 @@ pub(crate) async fn adapter_request(adapter: &str) -> Result<NewContainer> {
     Ok(request)
 }
 
+/// The first pass ([`crate::lockfile::prepare_metadata`]), with the adapter a
+/// project with no lock yet would add resolved alongside it, so that inside
+/// [`crate::registry::remembering`] adding it costs no round trip after the
+/// pass.
+///
+/// It is waited for only when the pass succeeded and the adapter is to be
+/// added: a failed pass, or a project that needs no adapter, does not wait on
+/// it. A failure of it is the later, real request's to report.
+pub(crate) async fn prepare_metadata_with_adapter_ahead(
+    compose: &mut ComposeFile,
+    project_namespace: &str,
+) -> Result<crate::lockfile::PreparedLock> {
+    let adapter = adapter_to_resolve_ahead(compose);
+    let ahead = async move {
+        if let Some(adapter) = adapter {
+            let _ = adapter_request(&adapter).await;
+        }
+    };
+    tokio::pin!(ahead);
+    let mut resolved_ahead = false;
+    let prepared = {
+        let none = BTreeSet::new();
+        let first = crate::lockfile::prepare_metadata(compose, &none);
+        tokio::pin!(first);
+        loop {
+            tokio::select! {
+                prepared = &mut first => break prepared?,
+                () = &mut ahead, if !resolved_ahead => resolved_ahead = true,
+            }
+        }
+    };
+    let adds = !needs(compose, project_namespace).is_empty()
+        && adapter_key(compose, adapter_name(compose))?.is_none();
+    if adds && !resolved_ahead {
+        ahead.await;
+    }
+    Ok(prepared)
+}
+
+/// The adapter [`prepare_metadata_with_adapter_ahead`] resolves for `file`, if
+/// any.
+pub(crate) fn adapter_to_resolve_ahead(file: &ComposeFile) -> Option<String> {
+    let adapter = adapter_name(file);
+    // The first pass goes to the registry only for a package with no lock, and
+    // the adapter takes a resolve slot of its own: only a spare one, so the
+    // two never exceed the operator's limit.
+    let packages = file
+        .containers
+        .values()
+        .filter(|container| matches!(container.worker, WorkerSource::Package { .. }))
+        .count();
+    let spare = packages < crate::parallelism::max_parallel_resolves();
+    let undeclared = adapter_key(file, adapter).ok()?.is_none();
+    (packages > 0 && spare && undeclared && !crate::lockfile::lock_path(&file.path).exists())
+        .then(|| adapter.to_string())
+}
+
 /// What the sandbox step does to the file.
 #[derive(Debug, Clone, PartialEq, Eq)]
 pub(crate) enum AdapterChange {
@@ -418,43 +475,47 @@ pub(crate) async fn apply_adapter_change(
     refresh: bool,
     allow_remove: bool,
 ) -> Result<Option<AdapterChange>> {
-    let Some(change) =
-        adapter_change(edited, current, project_namespace, refresh, allow_remove).await?
-    else {
-        return Ok(None);
-    };
-    let next = match &change {
-        AdapterChange::Upsert(request) => {
-            if let Source::Package {
-                version: Some(version),
-                ..
-            } = &request.source
-            {
-                force.insert(request.key.clone());
-                selected.insert(request.key.clone(), version.clone());
-            }
-            match edit::upsert_container(edited, request)? {
-                edit::Outcome::Added(text) | edit::Outcome::Replaced { text, .. } => Some(text),
-                edit::Outcome::Unchanged => None,
+    // The adapter's range and then its exact version: one request, not two.
+    crate::registry::remembering(async move {
+        let Some(change) =
+            adapter_change(edited, current, project_namespace, refresh, allow_remove).await?
+        else {
+            return Ok(None);
+        };
+        let next = match &change {
+            AdapterChange::Upsert(request) => {
+                if let Source::Package {
+                    version: Some(version),
+                    ..
+                } = &request.source
+                {
+                    force.insert(request.key.clone());
+                    selected.insert(request.key.clone(), version.clone());
+                }
+                match edit::upsert_container(edited, request)? {
+                    edit::Outcome::Added(text) | edit::Outcome::Replaced { text, .. } => Some(text),
+                    edit::Outcome::Unchanged => None,
+                }
             }
+            AdapterChange::Remove(key) => edit::remove_container(edited, key)?,
+        };
+        if let Some(next) = next {
+            *edited = next;
         }
-        AdapterChange::Remove(key) => edit::remove_container(edited, key)?,
-    };
-    if let Some(next) = next {
-        *edited = next;
-    }
-    *current = ComposeFile::parse(edited, path)?;
-    let mut versions = selected.clone();
-    for key in current.containers.keys() {
-        if let Some(version) = prepared.resolved_version(key) {
-            versions
-              
```

**File**: `engine/install.sh` (modified, +22/-8)
```diff
@@ -118,6 +118,15 @@ iii_emit_event() {
     >/dev/null 2>&1 || true
 }
 
+# The success path's events go out while the install carries on: the binary
+# sends each on its own and gives up after 3 s, and nothing here waits for the
+# network. The telemetry IDs exist before the first one (see below), so these
+# sends only read them and race nothing. A non-interactive shell runs them
+# with SIGINT ignored, so a Ctrl+C at the next prompt does not cut them short.
+iii_emit_event_in_background() {
+  iii_emit_event "$1" "$2" &
+}
+
 # ---------------------------------------------------------------------------
 # GitHub API
 # ---------------------------------------------------------------------------
@@ -634,16 +643,20 @@ fi
 # ---------------------------------------------------------------------------
 
 telemetry_emitter="$bin_file"
+# Best-effort: have the binary initialize its telemetry IDs, in the foreground
+# and with no network, before any event is sent beside the install.
+# Older binaries won't have this flag — silently skip.
+"$bin_file" --install-only-generate-ids >/dev/null 2>&1 || true
 if [ "$install_event_prefix" = "upgrade" ]; then
   payload=$(printf '{"from_version":%s,"to_version":%s,"install_method":"sh","target_binary":%s}' \
     "$(json_str "$from_version")" "$(json_str "$release_version")" "$(json_str "$BIN_NAME")")
-  iii_emit_event "upgrade_started" "$payload"
+  iii_emit_event_in_background "upgrade_started" "$payload"
 else
   payload=$(printf '{"install_method":"sh","target_binary":%s,"os":%s,"arch":%s}' \
     "$(json_str "$BIN_NAME")" \
     "$(json_str "$(echo "$uname_s" | tr '[:upper:]' '[:lower:]')")" \
     "$(json_str "$uname_m")")
-  iii_emit_event "install_started" "$payload"
+  iii_emit_event_in_background "install_started" "$payload"
 fi
 
 install_bin "$bin_file" "$bin_dir/$BIN_NAME" \
@@ -661,20 +674,21 @@ fi
 # Telemetry: success
 # ---------------------------------------------------------------------------
 
+# Sent from the installed binary: the one in $tmpdir goes with the EXIT trap,
+# maybe before a job started this late has run it. A `*_started` job was
+# started before the copy, and the only early exit after it (`err`) first
+# runs a synchronous event from that same binary.
+telemetry_emitter="$bin_dir/$BIN_NAME"
 if [ "$install_event_prefix" = "upgrade" ]; then
   payload=$(printf '{"from_version":%s,"to_version":%s,"install_method":"sh","target_binary":%s}' \
     "$(json_str "$from_version")" "$(json_str "$installed_version")" "$(json_str "$BIN_NAME")")
-  iii_emit_event "upgrade_succeeded" "$payload"
+  iii_emit_event_in_background "upgrade_succeeded" "$payload"
 else
   payload=$(printf '{"installed_version":%s,"install_method":"sh","target_binary":%s}' \
     "$(json_str "$installed_version")" "$(json_str "$BIN_NAME")")
-  iii_emit_event "install_succeeded" "$payload"
+  iii_emit_event_in_background "install_succeeded" "$payload"
 fi
 
-# Best-effort: have the binary initialize its telemetry IDs.
-# Older binaries won't have this flag — silently skip.
-"$bin_dir/$BIN_NAME" --install-only-generate-ids >/dev/null 2>&1 || true
-
 # ---------------------------------------------------------------------------
 # Post-install verification
 # ---------------------------------------------------------------------------
```

**File**: `engine/src/cli/project/mod.rs` (modified, +36/-14)
```diff
@@ -124,7 +124,14 @@ async fn run_init(args: InitArgs) -> i32 {
         return run_learn_iii(args).await;
     }
     if template_flow_requested(&args) {
-        return run_init_with_template(args).await;
+        let docker = args.docker;
+        return match run_init_with_template(args).await {
+            Ok(project_id) => {
+                crate::cli::telemetry::send_project_init_succeeded(docker, &project_id).await;
+                0
+            }
+            Err(code) => code,
+        };
     }
 
     let target = args.target_dir().map(|s| s.to_string());
@@ -252,7 +259,10 @@ async fn run_init(args: InitArgs) -> i32 {
     0
 }
 
-async fn run_init_with_template(args: InitArgs) -> i32 {
+/// The template flow up to its `project_init_succeeded`, which is the
+/// caller's to send: the id it reports for, or the exit code of a failure
+/// already reported.
+async fn run_init_with_template(args: InitArgs) -> Result<String, i32> {
     // Restore terminal cursor on panic and on Ctrl+C — scaffolder runs an
     // interactive TUI via cliclack and we don't want to leave the cursor hidden.
     let default_panic = std::panic::take_hook();
@@ -298,7 +308,7 @@ async fn run_init_with_template(args: InitArgs) -> i32 {
             "see scaffolder output above",
         );
         crate::cli::telemetry::send_project_init_failed("scaffolder", &e.to_string()).await;
-        return code;
+        return Err(code);
     }
 
     let project_id_for_event = if let Some(root) = target_dir.as_ref() {
@@ -326,7 +336,7 @@ async fn run_init_with_template(args: InitArgs) -> i32 {
                         );
                         crate::cli::telemetry::send_project_init_failed("fetcher", &e.to_string())
                             .await;
-                        return code;
+                        return Err(code);
                     }
                 };
                 if let Err(e) = apply_docker(&mut fetcher, root, &device_id).await {
@@ -337,7 +347,7 @@ async fn run_init_with_template(args: InitArgs) -> i32 {
                     );
                     crate::cli::telemetry::send_project_init_failed("apply_docker", &e.to_string())
                         .await;
-                    return code;
+                    return Err(code);
                 }
             }
 
@@ -350,8 +360,7 @@ async fn run_init_with_template(args: InitArgs) -> i32 {
         String::new()
     };
 
-    crate::cli::telemetry::send_project_init_succeeded(args.docker, &project_id_for_event).await;
-    0
+    Ok(project_id_for_event)
 }
 
 const LEARN_III_TEMPLATE: &str = "harness";
@@ -369,14 +378,25 @@ async fn run_learn_iii(mut args: InitArgs) -> i32 {
     args.template = Some(LEARN_III_TEMPLATE.to_string());
     args.directory = Some(dir.to_string_lossy().into_owned());
 
-    let code = run_init_with_template(args).await;
-    if code != 0 {
-        return code;
-    }
+    let docker = args.docker;
+    // Sent while the tour runs, and waited for only once it ends: the process
+    // stays up for the whole tour, so nothing is lost by not holding the tour
+    // for it.
+    let succeeded = match run_init_with_template(args).await {
+        Ok(project_id) => crate::cli::telemetry::spawn_project_init_succeeded(docker, &project_id),
+        Err(code) => return code,
+    };
+    let code = run_tour(&dir).await;
+    crate::cli::telemetry::wait_for_report(succeeded).await;
+    code
+}
 
+/// Seeds the tour's container into the project at `dir` and runs
+/// `iii compose --up` there, for as long as the tour lasts.
+async fn run_tour(dir: &Path) -> i32 {
     // The tour's own worker is declared in the compose file, not added at
     // runtime.
-    seed_onboarding_container(&dir);
+    seed_onboarding_container(dir);
 
     let exe = match std::env::current_exe() {
         Ok(p) => p,
@@ -405,7 +425,7 @@ async fn run_learn_iii(mut args: InitArgs) -> i32 {
 
     let code = match tokio::process::Command::new(exe)
         .args(["compose", "--up"])
-        .current_dir(&dir)
+        .current_dir(dir)
         .status()
         .await
     {
@@ -496,7 +516,9 @@ static CHILD_OWNS_TERMINAL: AtomicBool = AtomicBool::new(false);
 /// its own default port for when that entry has no `http_port` yet.
 const CONSOLE_CONFIG: &str = "console";
 const DEFAULT_CONSOLE_PORT: u16 = 3113;
-const READY_POLL_INTERVAL: std::time::Duration = std::time::Duration::from_millis(500);
+/// A local `compose::status` call: polled often, so the console link follows
+/// the project's last container by tens of milliseconds, not half a second.
+const READY_POLL_INTERVAL: std::time::Duration = std::time::Duration::from_millis(100);
 /// Room for compose's startup renderer to print its closing line and stop
 /// repainting before anything else writes to the terminal.
 const BLOCK_SETTLE: std::time::Duration = std::time::Duration::from_millis(1_000);
```

**File**: `engine/src/cli/telemetry.rs` (modified, +56/-4)
```diff
@@ -249,17 +249,32 @@ pub async fn send_cli_update_failed(target_binary: &str, from_version: &str, err
 }
 
 pub async fn send_project_init_succeeded(with_docker: bool, project_id: &str) {
-    if let Some(event) = build_event(
+    if let Some(event) = project_init_succeeded(with_docker, project_id) {
+        send_before_exit(event).await;
+    }
+}
+
+/// [`send_project_init_succeeded`] on a task of its own, for a command that
+/// goes on running after it: wait for it with [`wait_for_report`] before the
+/// command exits.
+pub(crate) fn spawn_project_init_succeeded(
+    with_docker: bool,
+    project_id: &str,
+) -> Option<tokio::task::JoinHandle<()>> {
+    let event = project_init_succeeded(with_docker, project_id)?;
+    Some(tokio::spawn(send_direct(event)))
+}
+
+fn project_init_succeeded(with_docker: bool, project_id: &str) -> Option<ProductEvent> {
+    build_event(
         "project_init_succeeded",
         serde_json::json!({
             "with_docker": with_docker,
             "project_id": project_id,
             "install_method": environment::detect_install_method(),
         }),
         None,
-    ) {
-        send_before_exit(event).await;
-    }
+    )
 }
 
 pub async fn send_project_init_failed(stage: &str, error: &str) {
@@ -460,6 +475,43 @@ mod tests {
         assert_eq!(delivered, vec![1, 2, 3, 4]);
     }
 
+    #[tokio::test]
+    #[serial]
+    async fn a_success_sent_beside_the_tour_holds_nothing_and_still_arrives() {
+        use wiremock::matchers::{method, path};
+        use wiremock::{Mock, MockServer, ResponseTemplate};
+
+        clear_opt_out_vars();
+        let _home = isolated_home();
+        let server = MockServer::start().await;
+        Mock::given(method("POST"))
+            .and(path("/batch/"))
+            .respond_with(
+                ResponseTemplate::new(200).set_delay(std::time::Duration::from_millis(500)),
+            )
+            .mount(&server)
+            .await;
+        unsafe {
+            env::set_var("POSTHOG_HOST", server.uri());
+        }
+
+        let began = std::time::Instant::now();
+        let sending = spawn_project_init_succeeded(false, "project-1");
+        let held = began.elapsed();
+        wait_for_report(sending).await;
+        let delivered = server.received_requests().await.unwrap_or_default().len();
+
+        unsafe {
+            env::remove_var("POSTHOG_HOST");
+        }
+        restore_home();
+        assert!(
+            held < std::time::Duration::from_millis(100),
+            "held for {held:?}"
+        );
+        assert_eq!(delivered, 1);
+    }
+
     #[tokio::test]
     #[serial]
     async fn project_init_events_to_an_unreachable_host_release_within_the_report_timeout() {
```

---

### Incident Patch 3: `8715eb66` (2026-11-11)
**Commit Message**: fix(website): center the subscribe pages and give them a full screen (#2529)

**File**: `website/app/(site)/subscribe-expired/page.tsx` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@ export default function SubscribeExpiredPage() {
       <p>
         This confirmation link has expired or is no longer valid. Enter your email again and we'll send you a new one.
       </p>
-      <EmailSignup location="subscribe-expired" className="max-w-md" />
+      <EmailSignup location="subscribe-expired" className="w-full max-w-md" />
     </SubscribeStatus>
   )
 }
```

**File**: `website/components/site/confirm-subscription.tsx` (modified, +1/-1)
```diff
@@ -36,7 +36,7 @@ export function ConfirmSubscription() {
   }
 
   return (
-    <div className="space-y-3">
+    <div className="flex flex-col items-center space-y-3">
       <Button size="lg" className="px-4" onClick={confirm} disabled={!token || state === 'sending'}>
         {state === 'sending' ? 'Confirming…' : 'Confirm subscription'}
       </Button>
```

**File**: `website/components/site/subscribe-status.tsx` (modified, +7/-3)
```diff
@@ -14,12 +14,16 @@ export function SubscribeStatus({ title, children }: { title: string; children:
   return (
     <>
       <SiteHeader />
-      <main className={cn(wideContainer, 'py-40')}>
-        <div className="max-w-xl">
+      {/* At least a full screen, so the footer starts below the fold; the message sits in its middle (the header is
+          fixed over it). */}
+      <main className={cn(wideContainer, 'flex min-h-svh items-center justify-center py-32')}>
+        <div className="flex w-full max-w-xl flex-col items-center text-center">
           <PixelHeading as="h1" className="text-[40px]">
             {title}
           </PixelHeading>
-          <div className="mt-6 space-y-6 text-pretty text-[15px] text-muted-foreground leading-relaxed">{children}</div>
+          <div className="mt-6 flex flex-col items-center space-y-6 text-balance text-[15px] text-muted-foreground leading-relaxed">
+            {children}
+          </div>
         </div>
       </main>
       <Footer container={wideContainer} />
```

#### Recent Merged Pull Requests:
- **PR #2558** (2026-11-12): ci: warn about unused dependencies (Rust, Node, Python, Go) (@guibeira)
- **PR #2556** (2026-11-12): feat(subscribe): accept server-to-server signups from ade (@arihantcodes)
- **PR #2555** (2026-11-12): perf: take the fixed waits out of the quickstart (curl → "Press b") (@ytallo)
- **PR #2554** (2026-11-12): chore: mirror the browser SDK, Go SDK and iii-filter CI checks in make ci-local (@guibeira)
- **PR #2546** (closed): chore(deps): bump the actions group across 1 directory with 22 updates (@dependabot[bot])
- **PR #2541** (2026-11-12): chore(cli): remove the iii console stub (@guibeira)

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

## X. docs): point the 0.21.x reference tab at the existing reference pages (#2539)

**RULE**:
When implementing operations in `docs/0-21-0/reference/helpers-python.mdx`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in iii-hq/iii. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `175858b5`: docs): point the 0.21.x reference tab at the existing reference pages (#2539). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/0-21-0/reference/helpers-python.mdx`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
  Optional cap on the serialized byte length; unset, zero, or negative means no cap.
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
  Optional cap on the serialized byte length; unset or <= 0 means no cap.
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `175858b5` are properly handled with clean fallback behavior.

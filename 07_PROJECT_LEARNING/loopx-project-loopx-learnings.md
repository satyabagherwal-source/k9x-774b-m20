# Forensic Learning Record (Deep Inspection): loopx-project/loopx

> **Canonical Artifact**: `07_PROJECT_LEARNING/loopx-project-loopx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/loopx-project/loopx](https://github.com/loopx-project/loopx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T19:15:29.735Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `loopx-project/loopx`
- **Description**: A control plane with a durable state kernel for long-horizon agents and teams. Keep work moving and improving across sessions, with less human attention.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 6118 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/desktop/loopx-control-plane/src-tauri/src/bundled_runtime.rs`
```
//! Install only the runtime snapshot carried by the signature-verified App.
use command_group::CommandGroup;
use flate2::read::GzDecoder;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::Path,
    process::{Command, Stdio},
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager};

pub fn identity(app: &AppHandle) -> Result<Value, String> {
    let path = app
        .path()
        .resource_dir()
        .map_err(|_| "runtime_bundle_missing")?
        .join("runtime/identity.json");
    let value: Value =
        serde_json::from_slice(&fs::read(path).map_err(|_| "runtime_bundle_missing")?)
            .map_err(|_| "runtime_bundle_invalid")?;
    if value["schema_version"] != "desktop_runtime_bundle_v1"
        || !value["source_revision"]
            .as_str()
            .is_some_and(|v| v.len() == 40 && v.bytes().all(|c| c.is_ascii_hexdigit()))
    {
        return Err("runtime_bundle_invalid".into());
    }
    Ok(value)
}

pub fn journal(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_local_data_dir()
        .map_err(|_| "update_state_unavailable")?;
    fs::create_dir_all(&dir).map_err(|_| "update_state_unavailable")?;
    Ok(dir.join("desktop-update.json"))
}

pub fn record_pending(app: &AppHandle, version: &str, channel: &str) -> Result<(), String> {
    let path = journal(app)?;
    let mut file = tempfile::NamedTempFile::new_in(path.parent().unwrap())
        .map_err(|_| "update_state_unavailable")?;
    use std::io::Write;
    file.write_all(
        json!({"version": version, "channel": channel})
            .to_string()
            .as_bytes(),
    )
    .map_err(|_| "update_state_unavailable")?;
    file.as_file()
        .sync_all()
        .map_err(|_| "update_state_unavailable")?;
    file.persist(path).map_err(|_| "update_state_unavailable")?;
    Ok(())
}

/// Outcome of resolving the persisted update journal against the running App.
#[derive(Debug, PartialEq, Eq)]
pub enum Resume {
    /// No journal existed; nothing was resumed.
    Absent,
    /// The approved journal was applied and the bundled runtime installed.
    Applied,
    /// A journal naming another App version was discarded. The on-disk
    /// runtime was not touched; the caller must re-run the App/runtime
    /// pairing gate on this same start before any service connects.
    StaleDiscarded,
}

pub fn resume_pending(app: &AppHandle) -> Result<Resume, String> {
    let path = journal(app)?;
    match resolve_journal(&path, &app.package_info().version.to_string())? {
        JournalResolution::Absent => Ok(Resume::Absent),
        JournalResolution::StaleDiscarded => Ok(Resume::StaleDiscarded),
        JournalResolution::Approved => {
            let metadata = identity(app)?;
            if !selected_revision_matches(&metadata) {
                install(app)?;
            }
            fs::remove_file(&path).map_err(|_| "update_state_unavailable")?;
            Ok(Resume::Applied)
        }
    }
}

#[derive(Debug, PartialEq, Eq)]
enum JournalResolution {
    Absent,
    Approved,
    StaleDiscarded,
}

// Path-level journal decision shared by the release startup entrance and the
// repair action, and directly testable without an AppHandle. Never install
// runtime code from an App other than the approved target.
fn resolve_journal(path: &Path, running_version: &str) -> Result<JournalResolution, String> {
    if !path.exists() {
        return Ok(JournalResolution::Absent);
    }
    let state: Value = serde_json::from_slice(&fs::read(path).map_err(|_| "update_state_invalid")?)
        .map_err(|_| "update_state_invalid")?;
    if state["version"] != running_version {
        // A journal naming a different version means the approved installation
        // never completed: the app update failed before replacing the app, or
        // the app was rolled back. Discard the stale journal instead of
        // locking the next start into the recovery panel -- and report it as
        // discarded so this start itself must clear the pairing gate the
        // no-journal entrance enforces; a deleted file alone proves nothing
        // about the runtime that is still on disk.
        discard_journal_at(path)?;
        return Ok(JournalResolution::StaleDiscarded);
    }
    Ok(JournalResolution::Approved)
}

/// Remove a journal that names a runtime the on-disk app never became. Used
/// when an app update fails after the journal was recorded: keeping it would
/// wedge the next start into the recovery panel for an update that never
/// shipped. Returns whether a journal file existed.
pub fn discard_journal(app: &AppHandle) -> Result<bool, String> {
    discard_journal_at(&journal(app)?)
}

pub(crate) fn discard_journal_at(path: &Path) -> Result<bool, String> {
    match fs::remove_file(path) {
        Ok(()) => Ok(true),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(_) => Err("update_state_unavailable".into()),
    }
}

pub fn install(app: &AppHandle) -> Result<(), String> {
    let metadata = identity(app)?;
    let archive = app
        .path()
        .resource_dir()
        .map_err(|_| "runtime_bundle_missing")?
        .join("runtime/runtime-source.tar.gz");
    let bytes = fs::read(archive).map_err(|_| "runtime_bundle_missing")?;
    install_snapshot(&bytes, &metadata)
}

pub(crate) fn selected_revision_matches(metadata: &Value) -> bool {
    crate::services::runtime_identity_for_executable(&crate::services::loopx_executable())
        .as_ref()
        .and_then(|value| value["source_revision"].as_str())
        .is_some_and(|revision| metadata["source_revision"].as_str() == Some(revision))
}

fn install_snapshot(bytes: &[u8], metadata: &Value) -> Result<(), String> {
    let digest: String = Sha256::digest(bytes)
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect();
    if digest != metadata["sha256"].as_str().unwrap_or("") {
        return Err("runtime_bundle_invalid".into());
    }
    let source = tempfile::tempdir().map_err(|_| "runtime_staging_failed")?;
    extract(bytes, source.path())?;
    #[cfg(not(windows))]
    let mut command = {
        let mut c = Command::new("bash");
        c.arg(source.path().join("scripts/install-local.sh"));
        c
    };
    #[cfg(windows)]
    let mut command = {
        let mut c = Command::new("pwsh");
        c.args(["-NoProfile", "-File"])
            .arg(source.path().join("scripts/install-windows.ps1"));
        c
    };
    crate::services::configure_runtime_environment(&mut command);
    // Preserve the working interpreter of an existing managed snapshot.
    if let Ok(executable) = fs::canonicalize(crate::services::loopx_executable()) {
        if let Some(release) = executable.parent().and_then(Path::parent) {
            if let Ok(python) = fs::read_to_string(release.join(".loopx-python")) {
                command.env("LOOPX_PYTHON", python.trim());
            }
        }
    }
    command
        .current_dir(source.path())
        .env("LOOPX_PROMOTE_DEFAULT", "1")
        // The archive staging directory is temporary, never a canary checkout.
        .env("LOOPX_INSTALL_CANARY", "0")
        // Preparing the App runtime must not inspect/modify host integrations
        // or invoke provider doctors that can request user-folder access.
        .env("LOOPX_INSTALL_SKILL", "0")
        .env("LOOPX_INSTALL_SLASH_COMMANDS", "0")
        .env("LOOPX_INSTALL_CLAUDE", "0")
        .env("LOOPX_INSTALL_OPENCODE", "0")
        .env("LOOPX_INSTALL_REVALIDATE_EXTENSIONS", "0")
        .env_remove("LOOPX_ARCHIVE_URL")
        .env_remove("LOOPX_ARCHIVE_SHA256")
        .env("LOOPX_REPO", "loopx-project/loopx")
        .env("LOOPX_REF", metadata["source_revision"].as_str().unwrap())
        .env(
            "LOOPX_RESOLVED_SOURCE_GIT_COMMIT",
            metadata["source_revision"].as_str().unwrap(),
        )
        .stdin(Stdio::null(
```

### Core Architecture Module: `apps/desktop/loopx-control-plane/src-tauri/src/lib.rs`
```
mod bundled_runtime;
mod maintenance;
mod services;
mod update_backup;

use services::ServiceSet;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use tauri::{
    ipc::CapabilityBuilder, AppHandle, Manager, RunEvent, Url, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_notification::NotificationExt;

const APP_IDENTIFIER: &str = "io.loopx.control-plane";

fn maintenance_origin(url: &Url) -> String {
    // Custom-protocol IPC carries the HTTP Origin header (no /chat/ path).
    // postMessage carries the page URL. Both must match the same exact origin.
    url.origin().ascii_serialization()
}

// Supervisor failures are either stable machine codes emitted by the
// maintenance state machine (runtime_setup_required, runtime_install_exit_2,
// ...) or human-readable service diagnostics. Only a stable code is safe to
// echo verbatim into the boot surface, where it names the recovery panel's
// actionable diagnostics instead of a misleading fixed message.
fn boot_failure_message(error: &str) -> String {
    // The pairing decision is not a failure: the window is waiting for the
    // operator to choose between updating the App and aligning the CLI.
    if error == "runtime_pairing_required" {
        return "本机 LoopX 运行时与 App 自带的运行时不一致，请在上方选择「更新 App 与运行时」或「回退 CLI 到本 App 版本」后继续。"
            .to_string();
    }
    let is_stable_code = !error.is_empty()
        && error.chars().all(|character| {
            character.is_ascii_lowercase() || character.is_ascii_digit() || character == '_'
        });
    if is_stable_code {
        format!(
            "本地服务暂时无法启动，请检查安装或端口占用。（错误码 {error}，详见恢复与更新面板）"
        )
    } else {
        "本地服务暂时无法启动，请检查安装或端口占用。".to_string()
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn run() {
    // Release builds load the versioned LoopX Chat workspace that ships inside
    // the installed `loopx` release, so `loopx update` refreshes the frontend
    // and backend together instead of reusing a separately built asset bundle.
    #[cfg(dev)]
    let web_origin = "http://127.0.0.1:5173".to_string();
    #[cfg(not(dev))]
    let web_origin = "http://127.0.0.1:8767/chat/".to_string();
    let services = Arc::new(Mutex::new(None::<ServiceSet>));
    let services_for_setup = Arc::clone(&services);
    let navigation_origin: Url = web_origin.parse().expect("valid desktop origin");
    let shutting_down = Arc::new(AtomicBool::new(false));
    let shutting_down_for_setup = Arc::clone(&shutting_down);

    let builder = tauri::Builder::default()
        .manage(maintenance::Maintenance::default())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            maintenance::desktop_update,
            maintenance::desktop_update_status
        ])
        .plugin(
            tauri_plugin_single_instance::Builder::new()
                .dbus_id(APP_IDENTIFIER)
                .callback(|app, _args, _cwd| show_main_window(app))
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .setup(move |app| {
            let origin: Url = web_origin.parse()?;
            app.add_capability(
                CapabilityBuilder::new("desktop-loopx-chat")
                    .remote(maintenance_origin(&origin))
                    .permission("allow-desktop-update")
                    .permission("allow-desktop-update-status")
                    .window("main"),
            )?;

            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("LoopX")
                .inner_size(1280.0, 820.0)
                .min_inner_size(960.0, 640.0)
                .on_navigation(move |url| {
                    url.scheme() == "tauri" || url.origin() == navigation_origin.origin()
                })
                .build()?;

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                // Runtime preparation belongs to the same live supervisor as
                // service startup. A failed install must not strand this window
                // after a later repair, reload, or external runtime correction.
                while !shutting_down_for_setup.load(Ordering::Acquire) {
                    {
                        let mut current = services_for_setup.lock().expect("service state lock");
                        if current.is_some() {
                            if maintenance::reconnect_requested(&handle) {
                                // Runtime repair reuses this supervisor even
                                // after the workspace has already been opened.
                                // Drop only processes owned by this App.
                                *current = None;
                            } else {
                                drop(current);
                                std::thread::sleep(std::time::Duration::from_millis(200));
                                continue;
                            }
                        }
                    }
                    match maintenance::start_services(&handle) {
                        Ok(None) => {
                            std::thread::sleep(std::time::Duration::from_millis(200));
                            continue;
                        }
                        Ok(Some(mut started)) => {
                            if shutting_down_for_setup.load(Ordering::Acquire) {
                                started.stop();
                                return;
                            }
                            let healed = started.healed;
                            *services_for_setup.lock().expect("service state lock") = Some(started);
                            if healed {
                                let _ = handle
                                    .notification()
                                    .builder()
                                    .title("LoopX")
                                    .body("已自动升级到当前 LoopX 版本，服务已重启。")
                                    .show();
                            }
                            if let Some(window) = handle.get_webview_window("main") {
                                let _ = window.navigate(origin.clone());
                            }
                        }
                        Err(error) => {
                            let message = boot_failure_message(&error);
                            eprintln!("LoopX service error: {error}");
                            if let Some(window) = handle.get_webview_window("main") {
                                if let Ok(encoded) = serde_json::to_string(&message) {
                                    let _ =
                                        window.eval(format!("window.loopxBootFailed({encoded})"));
                                }
                            }
                            for _ in 0..10 {
                                if shutting_down_for_setup.load(Ordering::Acquire) {
                                    return;
                                }
                                std::thread::sleep(std::time::Duration::from_millis(200));
                            }
                            if let Some(window) = handle.get_webview_window("main") {
                                let _ = window.eval("window.loopxBootRetrying()");
                            }
                        }
                    }
                }
            });
            Ok(())
        });

    let app = builder
        .build(tauri::generate_context!())
        .expect("failed to build LoopX desktop shell");
    app.run(move |_app, event| {
        if matches!(event, RunEvent::Exit | RunEvent::ExitRequested { .. }) {
            shutting_down.store(true, Ordering::Release);
            if let Ok
```

### Core Architecture Module: `apps/desktop/loopx-control-plane/src-tauri/src/main.rs`
```
fn main() {
    loopx_control_plane::run();
}

```

### Core Architecture Module: `apps/desktop/loopx-control-plane/src-tauri/src/maintenance.rs`
```
//! App-owned update transaction. No browser-supplied commands, paths or URLs.
use crate::bundled_runtime;
use serde_json::{json, Value};
use std::{
    sync::{
        atomic::{AtomicBool, Ordering},
        Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager, State};
use tauri_plugin_updater::{Update, UpdaterExt};

#[derive(Default)]
pub struct Maintenance {
    busy: AtomicBool,
    supervision: tauri::async_runtime::Mutex<()>,
    snapshot: Mutex<Value>,
    pending: Mutex<Option<(String, Update)>>,
    last_failure: Mutex<Value>,
    runtime_retry: Mutex<RuntimeRetry>,
    install_journal_discarded: AtomicBool,
    environment_cache: Mutex<Option<(Instant, Value)>>,
    startup_started: std::sync::OnceLock<Instant>,
    phase_started: Mutex<Option<Instant>>,
}

#[derive(Default)]
struct RuntimeRetry {
    attempts: u8,
    last_attempt: Option<Instant>,
}

impl RuntimeRetry {
    fn admit(&mut self, now: Instant) -> bool {
        if self.attempts >= 3
            || self
                .last_attempt
                .is_some_and(|last| now.duration_since(last) < Duration::from_secs(30))
        {
            return false;
        }
        self.attempts += 1;
        self.last_attempt = Some(now);
        true
    }
}
impl Maintenance {
    fn acquire(&self) -> Result<BusyGuard<'_>, String> {
        self.busy
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .map_err(|_| "update_busy")?;
        Ok(BusyGuard(&self.busy))
    }
    fn publish(&self, phase: &str, details: Value) -> Value {
        let value = json!({"phase": phase, "details": details});
        // The pairing decision belongs with the other blocked states: the
        // recovery panel keeps it for diagnostics even after the operator
        // resolves it in the same App process.
        if matches!(
            phase,
            "error" | "runtime_required" | "runtime_pairing_required" | "service_error"
        ) {
            *self.last_failure.lock().unwrap() = value.clone();
        }
        let mut snapshot = self.snapshot.lock().unwrap();
        if snapshot["phase"] != phase || snapshot["details"] != value["details"] {
            *self.phase_started.lock().unwrap() = Some(Instant::now());
            if let Some(started) = self.startup_started.get() {
                eprintln!(
                    "LoopX startup phase={phase} elapsed_ms={}",
                    started.elapsed().as_millis()
                );
            }
        }
        *snapshot = value.clone();
        value
    }

    fn startup_timing(&self) -> Value {
        let elapsed = self
            .startup_started
            .get()
            .map(|at| at.elapsed().as_millis());
        let phase_elapsed = self
            .phase_started
            .lock()
            .unwrap()
            .map(|at| at.elapsed().as_millis());
        json!({"elapsed_ms": elapsed, "phase_elapsed_ms": phase_elapsed})
    }

    fn prepare_runtime(
        &self,
        step: RuntimeStep,
        explicit_override: bool,
        now: Instant,
        pairing: Value,
        install: impl FnOnce() -> Result<(), String>,
    ) -> Result<(), String> {
        if step == RuntimeStep::AlreadyPaired {
            *self.runtime_retry.lock().unwrap() = RuntimeRetry::default();
            return Ok(());
        }
        if explicit_override {
            self.publish(
                "runtime_required",
                json!({"code":"runtime_identity_mismatch", "revision_matches":false}),
            );
            return Err("runtime_identity_mismatch".into());
        }
        if step == RuntimeStep::AskOperator {
            // Replacing a different installed runtime is the operator's call:
            // the boot surface offers updating the App or aligning the CLI to
            // this App's snapshot. Fail closed without installing anything.
            self.publish("runtime_pairing_required", pairing);
            return Err("runtime_pairing_required".into());
        }
        if !self.runtime_retry.lock().unwrap().admit(now) {
            // Keep the last actionable install error while the live supervisor
            // observes external correction and permits an explicit repair.
            return Err("runtime_setup_required".into());
        }
        self.publish("installing_runtime", json!({}));
        match install() {
            Ok(()) => {
                *self.runtime_retry.lock().unwrap() = RuntimeRetry::default();
                self.publish("connecting", json!({}));
                Ok(())
            }
            Err(error) => {
                self.publish("error", json!({"code":error}));
                Err(error)
            }
        }
    }

    // Service supervision and maintenance must never replace/start different
    // runtime versions concurrently. A failed connection is not an install.
    fn reconcile_services<T>(
        &self,
        start: impl FnOnce() -> Result<T, String>,
    ) -> Result<Option<T>, String> {
        if self.busy.load(Ordering::Acquire) {
            return Ok(None);
        }
        let Ok(_guard) = self.supervision.try_lock() else {
            return Ok(None);
        };
        if self.busy.load(Ordering::Acquire) {
            return Ok(None);
        }
        let phase = self.snapshot.lock().unwrap()["phase"]
            .as_str()
            .unwrap_or("idle")
            .to_string();
        if phase == "restart_required" {
            return Ok(None);
        }
        match start() {
            Ok(services) => {
                self.publish("ready", json!({}));
                Ok(Some(services))
            }
            Err(error) => {
                let runtime_error = matches!(
                    self.snapshot.lock().unwrap()["phase"].as_str(),
                    Some("error" | "runtime_required" | "runtime_pairing_required")
                );
                if !runtime_error {
                    self.publish("service_error", json!({"code":"service_start_failed"}));
                }
                Err(error)
            }
        }
    }
}
struct BusyGuard<'a>(&'a AtomicBool);
impl Drop for BusyGuard<'_> {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

fn allow_action(phase: &str, action: &str) -> Result<(), String> {
    if phase == "restart_required" && action != "restart" {
        return Err("restart_required".into());
    }
    Ok(())
}
fn endpoint(channel: &str) -> Result<tauri::Url, String> {
    Ok(match channel {
        "stable" => "https://github.com/loopx-project/loopx/releases/download/desktop-stable/desktop-updater.json",
        "main" => "https://github.com/loopx-project/loopx/releases/download/desktop-main/desktop-updater.json",
        _ => return Err("invalid_update_channel".into()),
    }.parse().unwrap())
}

fn check_error(error: tauri_plugin_updater::Error) -> &'static str {
    use tauri_plugin_updater::Error;
    match error {
        // The plugin discards non-success HTTP status codes, so this cannot
        // distinguish an unpublished feed (404) from an unavailable server.
        Error::ReleaseNotFound => "update_feed_unavailable",
        Error::Serialization(_) => "update_feed_invalid",
        Error::TargetNotFound(_) | Error::TargetsNotFound(_) => "update_platform_unavailable",
        Error::Reqwest(error) if error.is_timeout() => "update_check_timeout",
        Error::Reqwest(error) if error.is_decode() => "update_feed_invalid",
        Error::Reqwest(_) => "update_network_failed",
        _ => "update_check_failed",
    }
}
// Environment telemetry for the recovery diagnostics: coarse, non-PII facts
// that separate "fresh Mac without a usable Python" from OS-specific defects.
// No paths, environment variables or process output beyond the probed version.
const ENVIRONMENT_TTL: Duration = Duration::from_secs(30);

fn compose_environment(
    os_version: Option<String>,
    arch: &str,
    runtime_e
```

### Core Architecture Module: `apps/desktop/loopx-control-plane/src-tauri/src/services.rs`
```
use command_group::{CommandGroup, GroupChild};
use std::{
    env,
    ffi::OsStr,
    fmt, fs,
    io::{Read, Write},
    net::{SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};

/// Every loopback service the App must reach before it opens the workspace.
pub const SERVICE_KINDS: [ServiceKind; 2] = [ServiceKind::Status, ServiceKind::Chat];

const STARTUP_TIMEOUT: Duration = Duration::from_secs(15);
const PROBE_TIMEOUT: Duration = Duration::from_millis(500);
const MAX_PROBE_RESPONSE_BYTES: u64 = 1024 * 1024;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum ServiceKind {
    Status,
    Chat,
}

impl ServiceKind {
    pub(crate) fn label(self) -> &'static str {
        match self {
            Self::Status => "status",
            Self::Chat => "chat",
        }
    }

    /// Name the services a `connecting` phase is still waiting for. One
    /// pending service keeps its own name so a stalled connection stays
    /// diagnosable on the boot page; a concurrent connect reports the loopback
    /// set, which the boot page renders as "local services".
    pub fn pending_label(pending: &[Self]) -> &'static str {
        match pending {
            [kind] => kind.label(),
            _ => "local",
        }
    }

    fn port(self) -> u16 {
        match self {
            Self::Status => 8766,
            Self::Chat => 8767,
        }
    }

    fn probe_path(self) -> &'static str {
        match self {
            Self::Status => "/?readiness=1",
            Self::Chat => "/api/chat/capabilities",
        }
    }

    fn expected_fingerprint(self) -> (&'static str, &'static str) {
        match self {
            Self::Status => ("source", "serve-status"),
            Self::Chat => ("schema_version", "loopx_chat_capabilities_v1"),
        }
    }

    fn command_args(self) -> Vec<String> {
        match self {
            Self::Status => vec![
                "serve-status",
                "--global-registry",
                "--host",
                "127.0.0.1",
                "--port",
                "8766",
                "--limit",
                "80",
            ],
            Self::Chat => vec![
                "chat",
                "--global-registry",
                "--host",
                "127.0.0.1",
                "--port",
                "8767",
                "--no-open",
            ],
        }
        .into_iter()
        .map(str::to_string)
        .collect()
    }
}

#[derive(Debug, Eq, PartialEq)]
enum Probe {
    Matching,
    NotReady,
    Unavailable,
    Unresponsive,
    Foreign,
    Stale,
}

#[derive(Debug)]
pub struct ServiceError(String);

impl fmt::Display for ServiceError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl std::error::Error for ServiceError {}

struct OwnedService {
    child: GroupChild,
}

impl OwnedService {
    fn stop(&mut self) {
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

pub struct ServiceSet {
    owned: Vec<OwnedService>,
    /// True when a stale LoopX service was restarted so the running frontend
    /// was transparently moved onto the current installed release.
    pub healed: bool,
}

impl ServiceSet {
    pub fn start(progress: impl Fn(&[ServiceKind]) + Sync) -> Result<Self, ServiceError> {
        Self::collect(connect_all(SERVICE_KINDS, connect, progress))
    }

    /// Fold finished connection attempts into one owned set. Every outcome
    /// surrenders its child here, so a set that fails still stops the
    /// processes its successful peers started.
    fn collect(outcomes: [ServiceOutcome; SERVICE_KINDS.len()]) -> Result<Self, ServiceError> {
        let mut services = Self {
            owned: Vec::new(),
            healed: false,
        };
        let mut failure = None;
        for outcome in outcomes {
            services.owned.extend(outcome.owned);
            services.healed |= outcome.healed;
            if let Err(error) = outcome.result {
                failure.get_or_insert(error);
            }
        }
        match failure {
            Some(error) => {
                services.stop();
                Err(error)
            }
            None => Ok(services),
        }
    }

    pub fn stop(&mut self) {
        for service in self.owned.iter_mut().rev() {
            service.stop();
        }
        self.owned.clear();
    }
}

/// One service's connection attempt. The child this App spawned travels with
/// the outcome even when the attempt failed, so `ServiceSet` can stop it
/// instead of leaking a process that no longer has an owner.
struct ServiceOutcome {
    owned: Option<OwnedService>,
    healed: bool,
    result: Result<(), ServiceError>,
}

/// Connect every loopback service at once.
///
/// The services own separate ports, commands and processes, and neither reads
/// the other's readiness, so the window should wait for the slowest one rather
/// than their sum. A start that follows a runtime update pays that difference
/// twice over: each stale listener is replaced and then warms a fresh
/// interpreter before it answers a readiness probe.
///
/// `progress` names the services still being waited on: the whole set while
/// they run together, then whichever connection outlives its peer, so a
/// stalled service is still named on the boot page.
fn connect_all<const N: usize>(
    kinds: [ServiceKind; N],
    connect: impl Fn(ServiceKind) -> ServiceOutcome + Sync,
    progress: impl Fn(&[ServiceKind]) + Sync,
) -> [ServiceOutcome; N] {
    let pending = Mutex::new(kinds.to_vec());
    progress(&kinds);
    thread::scope(|scope| {
        kinds
            .map(|kind| {
                let (connect, progress, pending) = (&connect, &progress, &pending);
                scope.spawn(move || {
                    let outcome = connect(kind);
                    let remaining = {
                        let mut pending = pending.lock().expect("pending service lock");
                        pending.retain(|entry| *entry != kind);
                        pending.clone()
                    };
                    if !remaining.is_empty() {
                        progress(&remaining);
                    }
                    outcome
                })
            })
            .map(|handle| handle.join().expect("service connection thread"))
    })
}

fn connect(kind: ServiceKind) -> ServiceOutcome {
    let mut owned = None;
    let mut healed = false;
    let result = connect_service(kind, &mut owned, &mut healed);
    ServiceOutcome {
        owned,
        healed,
        result,
    }
}

fn connect_service(
    kind: ServiceKind,
    owned: &mut Option<OwnedService>,
    healed: &mut bool,
) -> Result<(), ServiceError> {
    let executable = loopx_executable();
    let expected_runtime_identity = runtime_identity_for_executable(&executable);
    let stale_deadline = Instant::now() + STARTUP_TIMEOUT;
    loop {
        match probe(kind, expected_runtime_identity.as_ref()) {
            Probe::Matching => return Ok(()),
            Probe::NotReady => return Err(status_readiness_error(kind)),
            Probe::Foreign => {
                return Err(ServiceError(format!(
                    "port {} is occupied by a service that is not LoopX {}",
                    kind.port(),
                    kind.label()
                )));
            }
            Probe::Stale => {
                // Self-heal: the port is owned by a LoopX service from a
                // different installed release (for example after a
                // `loopx update`). Terminate that stale listener and keep
                // waiting up to the startup timeout so a LaunchAgent-managed
                // service (KeepAlive + throttle) has time to restart on the
                // current release; unknown (Foreign) processes keep the
                // ha
```

### Core Architecture Module: `apps/desktop/loopx-control-plane/src-tauri/src/update_backup.rs`
```
//! macOS rollback is scoped to this exact App bundle, never a caller path.
use std::{
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
};
use tauri::{AppHandle, Manager};

pub(crate) fn app_bundle() -> Result<PathBuf, String> {
    app_bundle_at(&std::env::current_exe().map_err(|_| "app_bundle_required")?)
}

// Locate the trusted install target for the running executable: the nearest
// `.app` ancestor directory. This is the target boundary rollback swaps into,
// derived from the running executable the same way `app_bundle` derives the
// verified bundle — never from a caller-supplied path.
//
// Boundary only: it must NOT require the installed App to be intact. Rollback
// exists precisely to repair a damaged installation (missing executable,
// missing sealed resource), so requiring the broken target to pass integrity
// checks here would make the recovery button unable to fix the state it is
// offered for.
pub(crate) fn installed_bundle_at(executable: &Path) -> Result<PathBuf, String> {
    let bundle = executable
        .parent()
        .and_then(Path::parent)
        .and_then(Path::parent)
        .ok_or("app_bundle_required")?;
    if bundle.extension().and_then(|s| s.to_str()) != Some("app") {
        return Err("app_bundle_required".into());
    }
    Ok(bundle.to_path_buf())
}

// The pinned macOS updater moves the old App bundle away before moving the new
// one in, so callers that must verify the installed App is still in place
// (failed replacement recovery) resolve it from the running executable.
// Path-level so synthetic App layouts are testable without a signed build.
//
// This is a layout-and-runnability check, not a signature check: the bundle
// must keep its Info.plist AND its executable. A partially removed bundle —
// executable deleted while Info.plist (and the runtime identity) survives a
// failed replacement — must not verify, or the safe-restart predicate would
// discard the recovery journal over an unbootable App. Signature integrity is
// layered on top by `installed_bundle_verifies`, which shares the exact
// `codesign --verify` check the backup `copy` boundary uses.
pub(crate) fn app_bundle_at(executable: &Path) -> Result<PathBuf, String> {
    let bundle = installed_bundle_at(executable)?;
    if !bundle.join("Contents/Info.plist").is_file()
        || !bundle_executable_is_present(executable, &bundle)
    {
        return Err("app_bundle_required".into());
    }
    Ok(bundle)
}

// Actual-installed-target integrity for the safe-restart predicate: layout
// verification is necessary but not sufficient — a bundle whose Info.plist and
// executable survive while a sealed resource was deleted still passes the
// layout check, yet `codesign --verify --deep --strict` rejects it. This is
// the same signature verification `copy` applies to a fresh backup, applied to
// the installed App itself; a previous backup copy's verification can never
// substitute for verifying the current installation.
pub(crate) fn installed_bundle_verifies(executable: &Path) -> bool {
    app_bundle_at(executable)
        .map(|bundle| signature_verifies(&bundle))
        .unwrap_or(false)
}

// Shared signature/integrity gate for both bundle consumers: the verified
// backup `copy` writes, and the safe-restart predicate's verification of the
// actually installed App.
fn signature_verifies(bundle: &Path) -> bool {
    Command::new("codesign")
        .args(["--verify", "--deep", "--strict"])
        .arg(bundle)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

#[cfg(all(test, target_os = "macos"))]
pub(crate) fn signature_verifies_for_test(bundle: &Path) -> bool {
    signature_verifies(bundle)
}

// The running binary keeps executing after the updater deletes it, so a
// missing file at the executable's own path is exactly the "old bundle was
// moved away / partially removed" state layout verification must reject.
// When Info.plist declares CFBundleExecutable, that declared binary must
// exist too: the bundle launches what Info.plist names, not any surviving
// neighbor. An unreadable (e.g. binary) plist skips the declared-name check
// without weakening the executable-presence check above.
fn bundle_executable_is_present(executable: &Path, bundle: &Path) -> bool {
    if !executable.is_file() {
        return false;
    }
    match declared_bundle_executable(bundle) {
        Some(declared) => {
            !declared.is_empty() && bundle.join("Contents/MacOS").join(declared).is_file()
        }
        None => true,
    }
}

fn declared_bundle_executable(bundle: &Path) -> Option<String> {
    let plist = fs::read_to_string(bundle.join("Contents/Info.plist")).ok()?;
    let key = "<key>CFBundleExecutable</key>";
    let rest = &plist[plist.find(key)? + key.len()..];
    let open = rest.find("<string>")? + "<string>".len();
    let value = &rest[open..];
    let close = value.find("</string>")?;
    Some(value[..close].trim().to_string())
}

fn root(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|_| "backup_unavailable")?
        .join("update-backup"))
}
fn copy(source: &Path, destination: &Path) -> Result<(), String> {
    let status = Command::new("ditto")
        .arg(source)
        .arg(destination)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map_err(|_| "backup_failed")?;
    if !status.success() {
        return Err("backup_failed".into());
    }
    if !signature_verifies(destination) {
        return Err("backup_failed".into());
    }
    Ok(())
}

pub fn available(app: &AppHandle) -> bool {
    cfg!(target_os = "macos")
        && root(app).is_ok_and(|r| r.join("previous/LoopX.app/Contents/Info.plist").is_file())
}

pub fn prepare(app: &AppHandle) -> Result<(), String> {
    if !cfg!(target_os = "macos") {
        return Ok(());
    }
    let bundle = app_bundle()?;
    let root = root(app)?;
    fs::create_dir_all(&root).map_err(|_| "backup_failed")?;
    let temporary = tempfile::tempdir_in(&root).map_err(|_| "backup_failed")?;
    copy(&bundle, &temporary.path().join("LoopX.app"))?;
    fs::write(
        temporary.path().join("version"),
        app.package_info().version.to_string(),
    )
    .map_err(|_| "backup_failed")?;
    let previous = root.join("previous");
    // Retain the old backup until the new verified backup is durable. This
    // directory contains only backups generated by this updater.
    if previous.exists() {
        let older = root.join(format!(
            "older-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
        ));
        fs::rename(&previous, older).map_err(|_| "backup_failed")?;
    }
    fs::rename(temporary.path(), previous).map_err(|_| "backup_failed")?;
    Ok(())
}

pub fn restore(app: &AppHandle) -> Result<(), String> {
    if !available(app) {
        return Err("backup_unavailable".into());
    }
    // The trusted target boundary comes from the running executable — the
    // same derivation the seam performs — never from a caller path. The
    // damaged installed App is exactly what rollback repairs, so locating it
    // must not require it to be intact; the verified backup source is what
    // must pass verification (`copy` re-checks its codesign signature).
    let executable = std::env::current_exe().map_err(|_| "app_bundle_required")?;
    let previous = root(app)?.join("previous");
    let version = fs::read_to_string(previous.join("version")).map_err(|_| "backup_unavailable")?;
    let handle = app.clone();
    restore_verified_backup(&executable, &previous, move || {
        crate::bundled_runtime::record_pending(&handle, version.trim(), "rollback")
    
```

### Core Architecture Module: `apps/desktop/loopx-control-plane/static/boot.js`
```
const panel = document.querySelector("main");
const status = document.querySelector("#status");
const bootElapsed = document.querySelector("#boot-elapsed");
const bootDetail = document.querySelector("#boot-detail");
const pageStarted = performance.now();
// The App publishes this phase when the CLI runtime installed on this host and
// the snapshot bundled with the App are different revisions. It is a decision
// the operator owns, never an error to wait through.
const DECISION_PHASE = "runtime_pairing_required";
let lastTiming = null;
let timingObservedAt = pageStarted;
let bootState = null;
function renderStartup(result) {
  const state = result?.state;
  bootState = state;
  if (Number.isFinite(result?.startup?.elapsed_ms) && result.startup.elapsed_ms >= 0) {
    lastTiming = result.startup.elapsed_ms;
    timingObservedAt = performance.now();
  }
  const titles = {
    installing_runtime: "正在安装 App 配套运行时",
    connecting: state?.details?.service === "status" ? "正在连接状态服务" : state?.details?.service === "chat" ? "正在连接管家对话服务" : "正在连接本地服务",
    ready: "本地服务已就绪，正在打开工作区",
    service_error: "本地服务连接失败，正在等待重试",
  };
  if (Object.hasOwn(titles, state?.phase)) {
    status.textContent = titles[state.phase];
    panel.dataset.state = "loading";
    panel.setAttribute("aria-busy", "true");
  }
  updateStartupElapsed();
}
function updateStartupElapsed() {
  const elapsed = lastTiming === null ? performance.now() - pageStarted : lastTiming + performance.now() - timingObservedAt;
  const seconds = Math.floor(elapsed / 1000);
  bootElapsed.textContent = `${lastTiming === null ? "此页面已等待" : "启动已用时"} ${seconds} 秒`;
  bootDetail.textContent = bootState?.phase === "installing_runtime"
    ? "正在安装此 App 随附的组件，并切换本机运行时；无需重复打开 App。"
    : bootState?.phase === DECISION_PHASE
      ? "选择后同一个窗口会继续启动，不需要重新打开 App。"
    : bootState?.phase === "service_error"
      ? "启动器会自动重试；可展开「恢复与更新」查看诊断。"
      : seconds >= 15
        ? "启动用时较长。当前步骤尚未完成，可展开「恢复与更新」查看诊断。"
        : "正在检查 App 配套组件和本地服务。";
}
setInterval(updateStartupElapsed, 1000);
window.loopxBootFailed = (message) => {
  // The pairing decision owns this state: it is a question for the operator,
  // not a startup failure, and the polled snapshot is its only source.
  if (bootState?.phase === DECISION_PHASE || bootState?.phase === "connecting") return;
  panel.dataset.state = "error";
  panel.setAttribute("aria-busy", "false");
  status.textContent = message;
};
window.loopxBootRetrying = () => {
  if (bootState?.phase === DECISION_PHASE) return;
  panel.dataset.state = "loading";
  panel.setAttribute("aria-busy", "true");
  status.textContent = "正在重新连接本地控制面";
};
const update = document.querySelector("#update");
const channel = document.querySelector("#channel");
const repair = document.querySelector("#repair");
const rollback = document.querySelector("#rollback");
const updateStatus = document.querySelector("#update-status");
const pairing = document.querySelector("#pairing");
const pairingInstalled = document.querySelector("#pairing-installed");
const pairingBundled = document.querySelector("#pairing-bundled");
const pairingStatus = document.querySelector("#pairing-status");
const pairingUpdate = document.querySelector("#pairing-update");
const pairingAlign = document.querySelector("#pairing-align");
let nextAction = "check";
let working = false;
let channelInitialized = false;
// Set once the App reports that the installed CLI runtime and the bundled
// snapshot disagree. It stays visible while the operator's chosen action runs
// and until services connect, so the decision cannot scroll out of the way.
let pairingOwned = false;
const pairingRevisions = { installed: "未检测到", bundled: "未知" };
document.querySelector("#retry").onclick = () => location.reload();
channel.onchange = () => { channelInitialized = true; render({phase:"idle"}); };
const labels = {
  idle: "检查当前通道，不会自动安装。",
  service_error: "运行时已安装，但服务尚未连接。可检查更新、修复或恢复上版；连接仍会自动重试。",
  runtime_required: "本机组件与 App 版本尚未对齐。可检查 App 更新，或点击修复安装当前匹配组件。",
  runtime_pairing_required: "本机 CLI 运行时与 App 自带运行时不一致，请选择如何对齐。",
  checking: "正在检查更新…",
  available: "App 与匹配运行时可一起更新。",
  up_to_date: "当前通道暂无更新。",
  downloading: "正在下载并校验签名…",
  installing_app: "正在安装 App，请保持窗口打开。",
  installing_runtime: "正在安装匹配的运行时，请稍候…",
  connecting: "正在连接更新后的服务…",
  restart_required: "请重启 App，继续完成更新。",
  ready: "更新完成，正在打开工作区。",
  error: "更新未完成。请重试检查，或修复当前版本。Goal 数据不会被删除。",
};
const errors = {
  desktop_status_unavailable: "无法读取 App 诊断状态。请重启 App；若仍失败，请重新安装完整 App。",
  runtime_setup_required: "App 与本机运行时不匹配，或找不到安装身份。请修复当前版本，成功后重启。",
  runtime_bundle_missing: "App 缺少配套运行时文件。请重新下载完整 App。",
  runtime_bundle_invalid: "App 配套运行时校验失败。请重新下载完整 App。",
  runtime_installer_unavailable: "无法启动安装程序。请检查系统是否提供 bash（Windows 为 PowerShell）。",
  runtime_install_failed: "运行时安装失败。请展开诊断信息，提供错误码以便排查。",
  runtime_install_timeout: "运行时安装超过十分钟，已停止。请检查网络和安装依赖后重试。",
  runtime_identity_mismatch: "安装已结束，但 App 仍选中了不同运行时。请检查是否设置了 LOOPX_BIN。",
  runtime_staging_failed: "无法创建安装临时目录。请检查磁盘空间及写入权限。",
  update_state_unavailable: "无法读写更新状态。请检查 App 数据目录的权限和磁盘空间。",
  update_state_invalid: "更新状态无法读取。请保留诊断信息并反馈问题。",
  app_update_incomplete: "App 更新尚未完成，无法安装配套运行时。请重新安装目标 App。",
  update_feed_unavailable: "此通道的更新源尚未就绪或暂时不可用。可稍后重新检查。",
  update_feed_invalid: "更新源格式异常。请稍后重新检查。",
  update_platform_unavailable: "此通道尚无适用于本机的更新包。",
  update_check_timeout: "检查更新超时。请稍后重试。",
  update_network_failed: "无法连接更新服务器。请检查网络后重试。",
  update_download_or_signature_failed: "更新包下载或签名校验失败，尚未安装。请重新检查更新。",
  app_install_failed: "App 安装未能完成，本次更新未生效；已确认当前版本完好且与运行时匹配，可直接重启继续使用，或重新检查更新后再试。",
  app_install_incomplete: "App 安装中断，且无法确认当前版本是否完整，请勿直接重启。请在恢复与更新面板还原上一版本（或重新安装）后再试。",
  backup_failed: "无法备份当前版本，更新已停止。请检查磁盘空间后重试。",
  runtime_pairing_required: "本机 CLI 运行时与这个 App 自带的运行时不一致，本地服务需要两者一致才能启动。请选择「升级：更新 App 与运行时」，或「回退 CLI：改用本 App 自带运行时」。Goal 数据不会被删除。",
};
function codeText(code, phase) {
  if (typeof code === "string" && /^runtime_install_exit_(\d+|signal)$/.test(code)) {
    // Exit 2 from install-local.sh is its "no usable Python 3.11+" gate; the
    // same exit can technically be a usage error, so the wording stays
    // probabilistic and points at the repair action.
    if (code === "runtime_install_exit_2") {
      return "安装程序退出（2）：本机多半缺少可用的 Python 3.11+。安装 Python 后点击「修复当前版本」。";
    }
    return `安装程序退出（${code.slice("runtime_install_exit_".length)}）。请复制诊断信息反馈；修复没有完成。`;
  }
  return Object.hasOwn(errors, code) ? errors[code] : labels[phase] || "";
}
function shortRevision(value) {
  return typeof value === "string" && /^[0-9a-f]{7,40}$/.test(value) ? value.slice(0, 12) : null;
}
// The chooser is state, not decoration: it appears with the decision, stays up
// while the chosen action runs, and disappears once services connect.
function renderPairing(state) {
  if (state.phase === DECISION_PHASE) pairingOwned = true;
  if (["connecting", "ready"].includes(state.phase)) pairingOwned = false;
  const installed = shortRevision(state.details?.installed_revision);
  const bundled = shortRevision(state.details?.bundled_revision);
  if (installed) pairingRevisions.installed = installed;
  if (bundled) pairingRevisions.bundled = bundled;
  pairing.hidden = !pairingOwned;
  if (!pairingOwned) return;
  pairingInstalled.textContent = pairingRevisions.installed;
  pairingBundled.textContent = pairingRevisions.bundled;
  pairingStatus.textContent = codeText(state.details?.code, state.phase);
  pairingUpdate.disabled = working;
  pairingAlign.disabled = working;
  if (state.phase === DECISION_PHASE) status.textContent = "需要你选择 App 与 CLI 运行时的对齐方式";
  panel.dataset.state = "decision";
  panel.setAttribute("aria-busy", "false");
}
function render(state) {
  if (!state?.phase) return state;
  if (state.phase === "available" && state.details?.channel !== channel.value) state = {phase:"idle"};
  working = ["checking","downloading","installing_app","installing_runtime","connecting"].includes(state.phase);
  update.disabled = working;
  repair.disabled = working || state.phase === "restart_requir
```

### Core Architecture Module: `apps/presentation/dashboard/smoke/action-packet-smoke.ts`
```
import { buildActionPacket, buildApprovedAgentHandoff } from "../src/data/action-packet.js";
// @ts-expect-error The smoke compiler intentionally runs without @types/node.
import { readFileSync } from "node:fs";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

const packet = buildActionPacket({
  goalId: "showcase-safe-route",
  title: "Review or authorize",
  summary: "production still blocked; owner/SOP snapshot has 9 blockers, but only two user todos are open",
  userTodoText: "Read the public decision memo section 8 first. Focus on 当前结论 and the config diff 快速锚点 / Diff Anchors table.",
  agentTodoText: "Run the read-only map dry-run after the owner todo is resolved; stop before writes.",
  todoBlocksGate: true,
  operatorQuestion: "是否同意 showcase safe route 在 owner/SOP review 后继续推进？",
  suggestedReply: "同意继续 safe-local/offline 路径 / 暂不同意 + 一句话原因。",
  gateFallbackDecision: "同意继续 safe-local/offline 路径；不授权写入或生产动作。",
  boundary: "不要执行配置写入、metadata upsert、workflow creation 或生产状态变化。",
  durableRecordRule: "记录规则：先用 operator-gate dry-run 预览；确认写入时去掉 --dry-run。",
  safePathLabel: "Read-only map dry-run",
  command: "loopx read-only-map --goal-id showcase-safe-route --dry-run",
  quotaShortLine: "Operator gate; 0/1440 slots",
  authorityShortLine: "default entries 10/10; topic 10; materials 6; owner review 1; stale 1; risk medium",
  projectOwner: "user_or_controller",
  projectGate: "owner_sop_review",
  projectNextAction: "Project asset says the owner/SOP review is the current authority.",
  projectStopCondition: "Stop before write-control or production mutation.",
  projectAssetSource: "project_asset",
  handoffReadinessLine: "ready; codex_ready=true; source=project_asset; quota=eligible; failed=none",
});

assert(packet.includes("【GH Packet】"), "missing packet title");
assert(packet.includes("【用户/Gate】"), "missing user action section");
assert(packet.includes("Quota：Operator gate; 0/1440 slots"), "missing compact quota context");
assert(packet.includes("Authority：default entries 10/10; topic 10; materials 6; owner review 1; stale 1; risk medium"), "missing compact authority/material context");
assert(packet.includes("Project Asset：Owner=user_or_controller；Gate=owner_sop_review"), "missing project-asset owner/gate");
assert(packet.includes("Next：Project asset says the owner/SOP review is the current authority."), "missing project-asset next action");
assert(packet.includes("Stop：Stop before write-control or production mutation."), "missing project-asset stop condition");
assert(packet.includes("Handoff：ready; codex_ready=true; source=project_asset; quota=eligible; failed=none"), "missing handoff readiness");
assert(packet.includes("待办：Read the public decision memo section 8 first."), "missing first user todo");
assert(packet.includes("先处理/暂缓再判 gate"), "missing todo-before-gate cue");
assert(packet.includes("Gate：是否同意 showcase safe route"), "missing gate question");
assert(packet.includes("【给项目 Agent】"), "missing project-agent handoff section");
assert(packet.includes("待办：Run the read-only map dry-run after the owner todo is resolved; stop before writes."), "missing first agent todo");
assert(packet.includes("路径：Read-only map dry-run"), "missing safe path");
assert(packet.includes("上下文：只信当前 state/status/history 与命令输出"), "missing agent context rule");
assert(packet.includes("不授权写入或生产动作") || packet.includes("不要执行配置写入"), "missing safety boundary");
assert(packet.length > 600 && packet.length < 1200, `unexpected packet length: ${packet.length}`);
assert(
  packet.indexOf("【用户/Gate】") < packet.indexOf("【给项目 Agent】"),
  "user action section must precede project-agent handoff",
);

const approvedHandoff = buildApprovedAgentHandoff({
  goalId: "planned-main-control",
  command: "loopx read-only-map --goal-id planned-main-control --dry-run --approved",
  agentTodoText: "Run the read-only map dry-run after owner todo resolution.",
  projectNextAction: "Approved project asset next action.",
  projectStopCondition: "Stop if execution needs write authority.",
  projectAssetSource: "project_asset",
});

assert(approvedHandoff.includes("目标校验：本段只适用于 goal_id=`planned-main-control`"), "missing target guard");
assert(approvedHandoff.includes("上下文规则：本段只携带最小当前指令"), "missing compact context rule");
assert(approvedHandoff.includes("Project Asset Next：Approved project asset next action."), "missing approved project-asset next action");
assert(approvedHandoff.includes("Project Asset Stop：Stop if execution needs write authority."), "missing approved project-asset stop condition");
assert(approvedHandoff.includes("Agent 待办：Run the read-only map dry-run after owner todo resolution."), "missing approved agent todo");
assert(approvedHandoff.includes("operator gate 已记录为 approve"), "missing approved forwarding condition");
assert(approvedHandoff.includes("只执行下面命令"), "missing execution boundary");
assert(approvedHandoff.includes("loopx read-only-map --goal-id planned-main-control --dry-run --approved"), "missing approved command");
assert(!approvedHandoff.includes("【GH Packet】"), "handoff-only payload must not include packet wrapper");
assert(!approvedHandoff.includes("【用户/Gate】"), "handoff-only payload must not include user gate wrapper");
assert(!approvedHandoff.includes("建议："), "handoff-only payload must not include human suggestion text");

const legacyFallbackPacket = buildActionPacket({
  goalId: "legacy-status-only",
  title: "Legacy status",
  summary: "raw status says continue but no project_asset is present",
  userTodoText: null,
  agentTodoText: "Inspect status only; do not treat raw fields as owner-approved state.",
  todoBlocksGate: false,
  operatorQuestion: null,
  suggestedReply: "保持 status inspection；补 project_asset 后再恢复 delivery。",
  gateFallbackDecision: "保持 status inspection；补 project_asset 后再恢复 delivery。",
  boundary: "This is a legacy/raw fallback; do not infer owner, gate, or stop condition authority.",
  safePathLabel: "Legacy status inspection",
  command: "loopx diagnose --goal-id legacy-status-only --limit 20",
  projectNextAction: "Continue from raw status field.",
  projectStopCondition: "Stop before any delivery claim.",
  projectAssetSource: "legacy_raw_fallback",
});

assert(legacyFallbackPacket.includes("Project Asset：legacy/raw fallback"), "missing legacy/raw fallback source");
assert(legacyFallbackPacket.includes("Owner/Gate/Stop 未确认"), "missing fallback untrusted-owner cue");
assert(legacyFallbackPacket.includes("Fallback Next：Continue from raw status field."), "missing fallback next label");
assert(legacyFallbackPacket.includes("Fallback Stop：Stop before any delivery claim."), "missing fallback stop label");
assert(!legacyFallbackPacket.includes("Project Asset：Owner="), "fallback packet must not claim owner/gate authority");

const focusWaitPacket = buildActionPacket({
  goalId: "focus-wait-owner-blocker",
  title: "Focus wait owner blocker",
  summary: "quiet until owner evidence, a clean baseline, or external eval changes",
  userTodoText: "Provide new owner evidence, a clean baseline, or external eval before delivery resumes.",
  agentTodoText: "只检查当前 state/status/history；保持 focus_wait 并用中文回报仍在等待什么。",
  todoBlocksGate: false,
  operatorQuestion: null,
  suggestedReply: "继续保持 focus wait；有新 owner evidence、clean baseline 或外部 eval 后再恢复 delivery。",
  gateFallbackDecision: "继续保持 focus wait；有新 owner evidence、clean baseline 或外部 eval 后再恢复 delivery。",
  boundary: "这不是 delivery approval；项目 Agent 只做 status/history inspection，不执行交付路径、写入、reward append 或生产动作。",
  safePathLabel: "Status/history inspection only",
  command: "loopx --registry ./examples/registry.example.json --runtime-root ./tmp/runtime diagnose --goal-id focus-wait-owner-blocker --limit 20",
});

assert(focusWaitPacket.includes("目标：focus-wait-owner-blocker"), "missing focus-wait goal id");
assert(focusWaitPacket.includes("待办：Provide new owner evidence"), "missing owner blocker unlock condition");
assert(focusWaitPacket.includes("Gate：无
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4315** (2026-09-14): **[Bug]: archive-completed of a Todo with a released lease record drifts the runtime-shadow qualification (orphaned lease stays in the candidate head)**
  *Symptoms*: ## Summary  Under active `coordination.runtime_shadow` capture, `todo archive-completed` on a Todo that still holds a **released** task-lease record makes the bounded qualification drift: `coordination-shadow inspect` reports `drifted` / `shadow_projection_drift`, and `qualify` / `read-candidate` reject from then on. The same archive of a Todo that never had a lease stays `matched`. Restoring bytes does not requalify; the only recovery is `rollback --provider-revision … --execute` plus a fresh `bootstrap --execute`, which discards the captured lineage.  This is the ordinary `hard_lease` flow (`task-lease acquire` → `todo complete` with the lease → `todo archive-completed`), so it blocks the D3 card's "audit sustained mixed-writer coverage against the final command matrix". #4167 declared it as the pending ladder row `s2c2.archive_after_leased_completion_parity` and made `s2c2.parity_equal` archive nothing rather than hide it. Nothing on `main` has changed the path since; #4286 isolates the canonical (post-promotion) archive transaction in `todo_archive.ts` and does not touch this legacy capture path.  Issue origin: observed and reproduced in a disposable environment (real CLI, production `FileAuthorityStore`, no live Goal). Reproduced on: `f38847b1c` (first seen) and `58dbaeaec` (today).  ## Reproduction (public CLI only)  Registry: one `hard_lease` Goal, `registered_agents: [agent-a, agent-b]`, `coordination.runtime_shadow = {schema_version: loopx_coordination_runtime_shadow
  **Post-Mortem & Fix Analysis**:
  > Thanks for the precise reproduction and for keeping the ladder gap explicit. Confirmed on current `main` **6b337bcbd** with the real public CLI and production FileAuthorityStore, using only disposable synthetic goals:  - Leased completion: `inspect=matched` at cursor 5; archive delivers the Todos entry at cursor 6, then `inspect`/`qualify`/`read-candidate` report drift and refuse qualification. Source leases = 0, candidate leases = 1 (released); the physical lease inventory still contains 1 record. - Unleased `soft_claim` control: archive remains `matched`, and bounded qualification succeeds. Reading the archived Todo correctly returns `todo_missing` with a qualified lineage. - Restoring the pre-archive Markdown bytes does not repair the candidate history. `delivered` is transport/receipt evidence; the writer explicitly reports `parity_verdict=not_evaluated`.  The root cause is confirmed: archive captures only `{handoff_mode, todos}`, while the source's lease membership depends on the 

- **Issue #4012** (2026-09-07): **[Bug]: Loopx control plane app is not working on macos 26.5/ M5**
  *Symptoms*: ### Preflight  - [x] I searched existing issues and discussions for this behavior. - [x] This report is not an unpatched security vulnerability. - [x] The report and attachments contain no credentials or private/internal material.  ### Issue origin  Observed or reproduced in a real environment  ### LoopX version or commit  Loopx 0.5.4 and control plane v1.0  ### Host or runtime surface  Other  ### LoopX area  Control plane (goals, todos, quota, scheduler, registry, runtime)  ### Problem  <img width="628" height="749" alt="Image" src="https://github.com/user-attachments/assets/33711a6f-b6d7-4bd9-a2ed-b3d44c37a966" /> the control plan app is loading and not working .  but pi host run loopx doctor show the loopx env is good. <img width="1227" height="564" alt="Image" src="https://github.com/user-attachments/assets/ac2d6db2-ca56-4632-a624-6ecd43382737" />  ### Minimal reproduction  1. install loopx app v1.0 2. run loopx app and the ui is always loading  3.   ### Expected behavior  the control plan app working like a charm.  ### Actual behavior  the loopx app is not working correctly  ### Sanitized diagnostics  ```shell  ```  ### Additional context  _No response_
  **Post-Mortem & Fix Analysis**:
  > LGTM

- **Issue #3915** (2026-09-05): **bug(goal): same-Turn settlement replay drops checkpoint supplementation**
  *Symptoms*: ## Maintainer triage update (2026-09-05)  This issue originally attributed a long post-delivery tail to a missing host/LoopX terminal-owner contract. Further investigation identified a concrete ordinary-settlement recovery defect as well as separate adapter and interaction problems. The original proposal was a hypothesis, not proof that host delegation is required.  **Current closure scope:** repair same-Turn checkpoint supplementation in ordinary LoopX settlement, tracked by #3958. Keep this issue open until that PR merges into main. Closing this incident does not certify elimination of all model latency, repair external benchmark bridges, or announce a shipped host-delegation feature.  ### Confirmed core defect  1. A Turn-bound refresh can commit delivery/writeback while reporting `vision_checkpoint=missing_required`. 2. A retry supplies the missing vision decision using the same settlement identity. 3. Previously, the existing writeback triggered an early successful replay before evaluating the newly supplied checkpoint input. 4. The agent could remain stuck or create another Turn to recover, introducing unnecessary planning and accounting work.  #3958 moves refresh-recovery admission into the existing TypeScript settlement-read owner. It admits a bounded supplement on the original Turn, preserves committed artifact/identity/delivery facts, distinguishes replay from supplementation or conflict, and prevents repeated/concurrent retries from duplicating supplementation or sp
  **Post-Mortem & Fix Analysis**:
  > 这个问题可以想成：作业已经做完了，但教室里有两个老师，谁也没说清楚“谁有权宣布下课”。 先用小朋友能懂的故事说 你在做一份作业。  外面那个老师（one-shot host） 说： 「作业交了、检查过了，就可以放学。」 里面那个班长（LoopX） 还拿着自己的清单： 「还有待办、还要刷新、还要结算、还要关 Goal。」  作业其实已经写好、检查好、交上去了。  可两个规则对不上，小朋友就开始想： 到底听谁的？还要不要再写？还要不要再检查？下课铃到底谁按？ 于是他一直在翻规则、问来问去、补各种“收尾手续”。  一次真实记录里，最后一次有效改代码之后，又磨了大约 2.78 小时，中间几乎没再改出新的有效代码。  浪费的不是写作业，是搞清楚“谁说了算放学”。 关键点到底坏在哪 不是“本来约好了，后来弄丢了”。  作者后来说：查过代码，从来就没有一份机器能读懂的共同约定。 外面老师只是用普通话说了一句： 本地交付并验证完，这个 Goal 就结束。没有后续本地工作，就完成原生 Goal。 但 LoopX 的 status、quota 这些系统看不懂这句话。  它们只认自己那套：还有 Todo、还要结算、还要关 Goal。 所以：  真正的活已经做完了 外面老师认为可以下课 里面班长还在发“未完成清单” 模型只能自己读说明书、对历史、猜该听谁的 猜的过程里又冒出别的 Todo、检查点、交接手续 时间就耗在收尾仲裁上  有一次模型碰巧看懂了那句人话，几分钟就停了。  作者说：这不算修好。因为成功靠的是模型猜对了作文，不是系统强制规定了“谁是下课老板”。 他们想要的修法（还是小朋友版） 要有一张机器都能认的纸条，写清楚：  下课由谁宣布：外面老师，还是 LoopX 待办、Goal 结算、证据回写：还要不要做 这张纸条绑的是哪一次任务 拿什么证据才能走“老师宣布下课”这条路  有了这张纸条以后：  该听老师的，就不要再把 LoopX 的普通结算当成必做题 该听 LoopX 的长任务，规则保持原样 不能只因为提示词写了“finish”，就偷偷当成可以提前放学  一句话：作业完成了还耗很久，是因为“谁有权说结束”没有写成系统合同，只写成了人话。

- **Issue #3867** (2026-09-03): **[Bug]: PyPI 0.5.3 lacks packaged workflow skills required by DSH plugin**
  *Symptoms*: ### Preflight  - [x] I searched existing issues and discussions for this behavior. - [x] This report is not an unpatched security vulnerability. - [x] The report and attachments contain no credentials or private/internal material.  ### Issue origin  Observed or reproduced in a real environment  ### LoopX version or commit  0.5.3  ### Host or runtime surface  Other  ### LoopX area  Control plane (goals, todos, quota, scheduler, registry, runtime)  ### Problem  Follow-up to #3796: PyPI publication now succeeds, but the released 0.5.3 distribution does not contain the packaged workflow-skill payload required by the DSH-native plugin integration. As a result, DSH users cannot complete /loopx-init even though the CLI itself installs and reports the expected version.  ### Minimal reproduction  1. Install dsh-loopx-plugin@0.1.1-beta.3 in DSH. 2. Use a clean Python 3.13 environment with the official PyPI index. 3. Run /loopx-init. 4. The bootstrap installs loopx>=0.5.3 successfully, then the workflow-skills compatibility probe fails.  ### Expected behavior  The PyPI package for the required release should include the workflow-skill payload. workflow-skills should report an available source for host surface deepseek-harness-native, and /loopx-init should install the DSH-native skills.  ### Actual behavior  The managed CLI reports loopx 0.5.3, then /loopx-init stops with: LOOPX_INIT_FAILED: stage=probe; kind=incompatible. The installed LoopX CLI does not support the DSH-native skill co
  **Post-Mortem & Fix Analysis**:
  > Thanks @TianjinAI for the clean reproduction. The diagnosis is slightly narrower than the original artifact-completeness hypothesis: the LoopX 0.5.3 wheel does contain the workflow-skill files, but its discovery path cannot find the `share/loopx/skills` data after the Linux `pip --target` installation used by the DSH managed runtime.  LoopX 0.5.4 already contains the distribution-root fallback that makes that layout discoverable. PR #3890 therefore raises the DSH plugin's managed LoopX requirement to 0.5.4 and adds release-time checks for the exact target-install path, both before and after PyPI publication.  The fixed plugin is now available as [DSH LoopX Plugin 0.1.1-beta.4](https://github.com/huangruiteng/loopx/releases/tag/dsh-loopx-plugin-v0.1.1-beta.4):  ```bash dsh plugin --profile web add "https://github.com/huangruiteng/loopx/releases/download/dsh-loopx-plugin-v0.1.1-beta.4/dsh-loopx-plugin-0.1.1-beta.4.tgz" ```  The release asset was downloaded again and verified to contain p
  > Thanks for the detailed report — we reproduced this and it is fixed in **loopx 0.5.4** (released 2026-09-02), which shipped in the same PR as the DSH plugin one-step setup work (#3725).  **What happened in 0.5.3:** the wheel itself was fine (it contains all six packaged skills under `share/loopx/skills/`), but the source probe in `resolve_workflow_skill_source()` only located them by scanning `importlib.metadata`'s `files()` list for the `share/loopx/skills/loopx-project/SKILL.md` sentinel. `Distribution.files()` silently drops RECORD rows whose recorded path doesn't exist on disk. In `pip install --target` layouts (and any install where the data files land beside the distribution root rather than where the `../../share` RECORD rows point), those rows get filtered out, so the probe returned `source.kind: "missing"` and `/loopx-init` failed exactly as you observed (`ok:false`, expected revision 0.5.3).  **The fix (0.5.4):** `resolve_workflow_skill_source()` now also checks `<distributio

- **Issue #3801** (2026-09-01): **[Bug]: Normalize eager NoKV client admission failures**
  *Symptoms*: ### Preflight  - [x] I searched existing issues and discussions for this behavior. - [x] This report is not an unpatched security vulnerability. - [x] The report and attachments contain no credentials or private/internal material.  ### Issue origin  Observed and reproduced in a real environment.  ### LoopX version or commit  `d453ef0c2`  ### Host or runtime surface  Not host-specific.  ### LoopX area  Capability or extension (providers, adapters, skills).  ### Problem  The NoKV shadow-provider example maps client failures inside provider methods, but a fresh NoKV client performs route admission before the provider exists. If that admission fails, a bare SDK `RuntimeError` escapes the composition boundary.  This makes fresh coordination-provider construction behave differently from an already-established provider and bypasses LoopX's typed fail-closed contract.  ### Minimal reproduction  1. Configure a NoKV client factory for an unavailable route. 2. Evaluate `NoKVCoordinationProvider(make_client(), workbench, goal_id)`. 3. Observe that `make_client()` raises before the provider can translate the failure.  ### Expected behavior  Fresh construction and established-client failures both raise `ProviderUnavailableError`, publish no coordination mutation, and do not fall back to the file provider.  ### Actual behavior  Fresh construction exposes a bare SDK `RuntimeError`; the provider method-level mapper is never reached.  ### Sanitized diagnostics  The failure reproduces with an i

- **Issue #3796** (2026-09-01): **[Bug]: DSH plugin bootstrap cannot install loopx>=0.5.3 from PyPI**
  *Symptoms*: ### Preflight  - [x] I searched existing issues and discussions for this behavior. - [x] This report is not an unpatched security vulnerability. - [x] The report and attachments contain no credentials or private/internal material.  ### Issue origin  Observed or reproduced in a real environment  ### LoopX version or commit  dsh-loopx-plugin v0.1.1-beta.3; LoopX v0.5.3 release  ### Host or runtime surface  Other  ### LoopX area  Control plane (goals, todos, quota, scheduler, registry, runtime)  ### Problem  The DSH LoopX plugin's managed CLI bootstrap cannot complete because its fixed PyPI requirement is loopx>=0.5.3, while PyPI currently offers versions only through 0.5.2. This prevents /loopx-init from installing the CLI.  ### Minimal reproduction  1. Install dsh-loopx-plugin v0.1.1-beta.3 into a DSH 0.1.1-rc.2 web profile. 2. Start DSH and run /loopx-init. 3. The command reports LOOPX_INIT_FAILED: stage=install_cli; kind=exit. 4. In a clean Python 3.13 virtual environment, run: python -m pip install --dry-run --upgrade 'loopx>=0.5.3'. 5. pip reports that the available versions stop at 0.5.2.  ### Expected behavior  /loopx-init should bootstrap the managed LoopX CLI successfully from the published DSH plugin.  ### Actual behavior  The plugin fails at install_cli because its fixed pip requirement cannot be resolved from PyPI. The GitHub project has a v0.5.3 release, but pip cannot find loopx>=0.5.3.  ### Sanitized diagnostics  ```shell ERROR: Could not find a version that sati
  **Post-Mortem & Fix Analysis**:
  > Resolved.  Root cause: the v0.5.3 release workflow successfully built, checked, attested, and uploaded the wheel and source distribution to the GitHub Release, but its `publish-pypi` job was left in `waiting` behind the `pypi` environment's manual reviewer gate. The release therefore looked complete on GitHub while `loopx>=0.5.3` was still unavailable to the plugin bootstrap from PyPI.  Immediate repair:  - approved and resumed the original validated v0.5.3 publishing job; the complete workflow is now green - confirmed PyPI exposes both `loopx-0.5.3-py3-none-any.whl` and `loopx-0.5.3.tar.gz` - reproduced the issue's install path in a clean Python 3.13 environment against the official PyPI index; `loopx>=0.5.3` installed successfully and `loopx --version` returned `loopx 0.5.3`  Permanent repair:  - removed the redundant manual reviewer rule from the `pypi` environment while retaining OIDC Trusted Publishing and the existing `v*` tag-only deployment policy - merged #3797, which makes th
  > Thanks!
  > Follow-up after the PyPI publication repair: the managed bootstrap can now install and identify `loopx 0.5.3`, but `/loopx-init` still fails at `stage=probe; kind=incompatible`.  The exact managed CLI's `workflow-skills` inspection reports:  - `ok: false` - `source.available: false` and `source.kind: missing` - reason: `the active LoopX installation does not contain the packaged workflow skills; upgrade LoopX before installing host skills` - expected source revision: `0.5.3`  This was reproduced with the published PyPI `0.5.3` in a clean Python 3.13 environment. It appears that the current PyPI distribution is missing the packaged workflow-skill payload required by the DSH plugin. This is distinct from the original publication-gate issue and still blocks the DSH-native bootstrap.  Reopening for investigation.

- **Issue #3577** (2026-08-31): **goal 标题由 /loopx 创建时固定用项目名，而非任务目标**
  *Symptoms*: ## Summary  通过 `/loopx`（`loopx start-goal --guided`）创建 goal 时，goal 的展示标题固定由项目名（`goal_id`）派生，而不是由任务目标生成。用户期望标题能反映任务目标。  ## 现状  验证结果（基于当前 main）：  1. `loopx/cli_commands/start_goal.py` 的 `--goal-id` 默认值 = `<project-name>-goal`（`bootstrap.default_goal_id` → `slugify_goal_id(project.name) + "-goal"`）。 2. `loopx/bootstrap_command_pack.py` 的 `_goal_start_bootstrap_command` 生成的引导命令**只传 `--objective <goal_text>`，不传 `--display-name`**。 3. `bootstrap.py::render_state_markdown` 写出的状态文件 H1 固定为 `# Active Goal State`，不是目标文本；`build_goal_entry` 里 `display_name` 是可选字段，无 CLI 入口能填。 4. 前端 `apps/presentation/dashboard/src/views/dashboard-page.tsx::personalGoalTitle(goalId, displayName)`：无 `display_name` 时回退到把 `goal_id`（项目名）美化显示。因此 `/loopx` 创建的目标在 dashboard 里始终显示为项目名（如 `goal-harness`），而不是任务目标（如“修复 scheduler state path 覆盖问题”）。  ## 期望  - 使用 `/loopx <目标文本>` 创建 goal 时，展示标题根据任务目标生成（例如取 `goal-text` 的简短概括），项目名仅作为 fallback。 - 需要一条可用的数据通路：`/loopx` 引导命令接受并传递 `display-name`（或在无显式值时由任务目标派生），最终写入 goal 的 `display_name`，让 dashboard / goal-channel 投影优先展示它。  ## 建议方向（供讨论，非实现方案）  - 给 `loopx start-goal`（及 bootstrap-connect 引导路径）增加 `--display-name` 参数，并在 `_goal_start_bootstrap_command` 生成的命令里带上它； - 未显式提供时，可用 `goal-text` 生成一个 public-safe 的简短标题（截断/压缩），仍保持 CLI 端 provider-neutral、不做外部 AI 调用； - `render_state_markdown` / `build_goal_entry` 已支持 `display_name`，前端也已有优先展示 `display_name` 的逻辑，因此主要是补“CLI 入口 → bootstrap → registry”这条接线，并补充 smoke 断言“标题优先于项目名”。 - 注意保持 public/private 边界：标题来自用户任务文本，需做路径/敏感词清洗，避免把私有路径或凭据样文本写进公开展示。  ## 版本
  **Post-Mortem & Fix Analysis**:
  > I'd like to take this issue.  Plan: 1. Wire `/loopx` / `start-goal --guided` so `display_name` is derived from goal text (with optional `--display-name`), scrubbed for public-safe display. 2. Persist it through bootstrap/registry so dashboard projection prefers it over the project-name fallback. 3. Add a focused smoke asserting title preference, then open a DCO-signed PR.  Working via LoopX agent lane `cursor-3577-display-name` on goal `loopx-self`.

- **Issue #3551** (2026-08-24): **change-window: detect legacy global guards and project repository delivery gates**
  *Symptoms*: <!-- loopx-self-repair:fingerprint=a9f5c9abc6f8 -->  ## Problem  `repository-change-window` is repository-local and default-off. When a machine already has an effective global Git guard through `core.hooksPath` or `core.sshCommand`, `loopx change-window status` reports only `not_installed`. It does not expose a typed, path-free indication that an external or legacy guard is active, and the normal delivery interaction contract does not distinguish local preparation from commit/push eligibility.  This can make an agent or operator interpret `delivery_allowed=true` as repository-delivery permission even though Git correctly rejects commit or push. The gap is discovery and projection; arbitrary external hooks must not be treated as trusted LoopX provider state.  ## Expected behavior  - `change-window status` distinguishes `provider_not_installed` from a path-free `effective_external_guard_detected` diagnostic without inferring the external guard's policy. - A recognized LoopX legacy installation can expose a typed migration preview; an unknown external guard remains diagnostic-only and fail-closed. - `change-window install` preserves the previous effective hooks and records whether the result is layered or migrated. - Once the repository provider verifies, the interaction contract projects commit/push admission separately from permission to prepare or validate a dirty worktree, including `next_eligible_at` during a blocked window. - Linked worktrees share the verified repository 

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

### Incident Patch 1: `c558d834` (2026-09-30)
**Commit Message**: test(contract): construct the private-address scan fixture at runtime

Signed-off-by: huangruiteng <huangrt01@163.com>

**File**: `tests/test_contract_scan_missing_roots.py` (modified, +2/-1)
```diff
@@ -43,7 +43,8 @@ def test_scan_reports_missing_scan_root(tmp_path: Path) -> None:
 def test_scan_still_covers_existing_root_beside_missing_root(tmp_path: Path) -> None:
     absent = tmp_path / "does-not-exist"
     leaky = tmp_path / "NOTES.md"
-    leaky.write_text("internal host 10.0.0.7\n", encoding="utf-8")
+    private_address = ".".join(str(octet) for octet in (10, 0, 0, 7))
+    leaky.write_text(f"internal host {private_address}\n", encoding="utf-8")
 
     boundary = scan_public_boundary([absent, leaky])
 
```

---

### Incident Patch 2: `3b73108e` (2026-09-30)
**Commit Message**: Merge pull request #5344 from Duang777/codex/fix-ci-generated-hook-guards

test: align CI guards with current runtime behavior

**File**: `tests/control_plane/test_prompt_upgrade_hook.py` (modified, +11/-2)
```diff
@@ -176,9 +176,18 @@ def test_upgrade_read_projection_preserves_work_authority(tmp_path, monkeypatch,
     assert read["command"] == hint["command"]
     assert read["ordering"] == "before_work"
     assert read["prompt_budget_bytes"] == 1536
+    # The dispatch names the hook that produced the read, and the projected hint
+    # must still carry every field of that read unchanged.
+    assert read["hook_id"] == "heartbeat.prompt_upgrade"
+    assert read["capability_id"] == "automation-prompt-upgrade"
+    assert {key: read[key] for key in hint} == hint
     for key in baseline.keys() | pending.keys():
-        if key not in {"required_reads", "interaction_contract", "protocol_action_packet",
-            "turn_start_capability_hook_dispatch"}:
+        if key not in {
+            "required_reads",
+            "interaction_contract",
+            "protocol_action_packet",
+            "turn_start_capability_hook_dispatch",
+        }:
             assert pending.get(key) == baseline.get(key), key
     _set_fixture_prompt(path, database, desired)
     assert build_live_quota_should_run_decision(status, **kwargs) == baseline
```

**File**: `tests/control_plane_ts/host_process.test.ts` (modified, +5/-3)
```diff
@@ -49,10 +49,12 @@ for (const mode of ["timeout", "abort", "leader_exit", "closed_pipes"] as const)
     t.after(() => rm(root, {recursive: true, force: true}));
     const marker = join(root, "counter");
     // Ignore TERM so the test proves escalation and does not merely observe a
-    // cooperative child. Its marker is the semantic oracle, not a PID lookup.
+    // cooperative child. Publish the marker atomically: a kill during a write
+    // must not look like a surviving child, but each completed tick stays visible.
     const child = `const fs=require('fs');let n=0;process.on('SIGTERM',()=>{});
-      fs.writeFileSync(${JSON.stringify(marker)},String(n));
-      setInterval(()=>fs.writeFileSync(${JSON.stringify(marker)},String(++n)),10)`;
+      const marker=${JSON.stringify(marker)}, staged=marker+'.next';
+      const publish=()=>{fs.writeFileSync(staged,String(n));fs.renameSync(staged,marker)};
+      publish();setInterval(()=>{n++;publish()},10)`;
     const script = `const{spawn}=require('child_process');const fs=require('fs');
       spawn(process.execPath,['-e',${JSON.stringify(child)}],{stdio:${JSON.stringify(mode === "closed_pipes" ? "ignore" : "inherit")}});
       const timer=setInterval(()=>{if(fs.existsSync(${JSON.stringify(marker)})){
```

---

### Incident Patch 3: `e19a8990` (2026-09-30)
**Commit Message**: fix(workspace): separate full refresh from failed Goal recovery (#5357)

* fix(workspace): separate full refresh from failed Goal retry

Signed-off-by: huangruiteng <14976749+huangruiteng@users.noreply.github.com>

* test(workspace): cover external writes and failed status rereads

Signed-off-by: huangruiteng <14976749+huangruiteng@users.noreply.github.com>

* fix: invalidate completed history on workspace refresh

Signed-off-by: huangruiteng <huangrt01@163.com>

---------

Signed-off-by: huangruiteng <14976749+huangruiteng@users.noreply.github.com>
Signed-off-by: huangruiteng <huangrt01@163.com>
Co-authored-by: huangruiteng <14976749+huangruiteng@users.noreply.github.com>

**File**: `apps/presentation/dashboard/smoke/workspace-progressive-status-smoke.mjs` (modified, +12/-2)
```diff
@@ -10,7 +10,7 @@ await build({ configFile: false, logLevel: "silent", build: {
   lib: { entry: resolve("src/data/workspace-progressive-status.ts"), formats: ["es"], fileName: () => "loader.mjs" },
   rolldownOptions: { external: ["zod"] },
 } });
-const { loadWorkspaceGoalSnapshots, directoryStatusPayload, reusableGoalSnapshots } = await import(pathToFileURL(resolve(outDir, "loader.mjs")).href);
+const { loadWorkspaceGoalSnapshots, directoryStatusPayload, reusableGoalSnapshots, workspaceReadPlan } = await import(pathToFileURL(resolve(outDir, "loader.mjs")).href);
 const directory = { ok: true, schema_version: "loopx_workspace_directory_v1", registry_revision: "r1",
   goals: [{ id: "alpha", display_name: "Alpha", activation_state: "active", registry_member: true }] };
 
@@ -42,7 +42,17 @@ assert.deepEqual(Object.keys(reusableGoalSnapshots(earlier, {
 assert.deepEqual(reusableGoalSnapshots(null, paused), {}, "a first read has nothing to reuse");
 assert.deepEqual(Object.keys(reusableGoalSnapshots(earlier, paused, { invalidateGoalIds: ["alpha", "gamma"] })), [],
   "invalidating every Goal is a full re-read");
-const retentionChecks = 7;
+const fullRefresh = workspaceReadPlan(earlier, earlier.directory);
+assert.deepEqual(fullRefresh.snapshots, snapshots, "a full refresh keeps loaded content visible while reading");
+assert.deepEqual(fullRefresh.requestedDirectory.goals.map((goal) => goal.id), ["alpha", "beta", "gamma"],
+  "a full refresh reads peers whose lifecycle held, so external Todo writes become visible");
+const partial = workspaceReadPlan(earlier, paused, "missing", { invalidateGoalIds: ["gamma"] });
+assert.deepEqual(Object.keys(partial.snapshots), ["alpha"], "partial recovery keeps unaffected peers visible");
+assert.deepEqual(partial.requestedDirectory.goals.map((goal) => goal.id), ["beta", "gamma"],
+  "partial recovery reads moved and explicitly touched Goals");
+assert.deepEqual(workspaceReadPlan(null, earlier.directory, "missing").snapshots, {},
+  "a different source cannot retain the previous source's data");
+const retentionChecks = 12;
 const access = { error_code: "workspace_status_access_denied" };
 const original = { fetch, setTimeout, clearTimeout };
 const deadline = {};
```

**File**: `apps/presentation/dashboard/src/data/workspace-progressive-status.ts` (modified, +22/-5)
```diff
@@ -14,20 +14,21 @@ const directorySchema = z.object({
 });
 export type WorkspaceDirectory = z.infer<typeof directorySchema>;
 export type WorkspaceLoadError = "timeout" | "network" | "service" | "access" | "revision" | "scope" | "invalid";
+export type WorkspaceReadScope = "all" | "missing";
 export type WorkspaceProgress = {
   directory: WorkspaceDirectory;
   snapshots: Record<string, StatusPayload>;
   errors: Record<string, WorkspaceLoadError>;
 };
 
 /**
- * Snapshots a same-source refresh may keep instead of re-reading.
+ * Snapshots a same-source read may keep visible while it reconciles.
  *
  * A directory entry is the cheap authoritative signal for "this Goal's
- * lifecycle did not move here": when the entry is unchanged, its snapshot still
- * describes the Goal, and re-reading it costs one full status collection per
- * Goal. Goals the caller just acted on are never reused, and a Goal that left
- * the directory loses its snapshot with it.
+ * lifecycle did not move here". It does not establish Todo freshness: a full
+ * refresh still re-reads retained Goals. A partial retry or known action may
+ * skip unaffected peers. Touched Goals and entries that moved or left the
+ * directory lose their snapshot.
  */
 export function reusableGoalSnapshots(
   previous: Pick<WorkspaceProgress, "directory" | "snapshots"> | null,
@@ -47,6 +48,22 @@ export function reusableGoalSnapshots(
   }));
 }
 
+/** Display retention and request selection are separate decisions. */
+export function workspaceReadPlan(
+  previous: Pick<WorkspaceProgress, "directory" | "snapshots"> | null,
+  directory: WorkspaceDirectory,
+  scope: WorkspaceReadScope = "all",
+  options: { invalidateGoalIds?: Iterable<string> } = {},
+) {
+  const snapshots = reusableGoalSnapshots(previous, directory, options);
+  return {
+    snapshots,
+    requestedDirectory: { ...directory, goals: directory.goals.filter(
+      (goal) => scope === "all" || !snapshots[goal.id],
+    ) },
+  };
+}
+
 function queryUrl(url: string, fields: Record<string, string>, base: string) {
   const parsed = new URL(url, base);
   parsed.searchParams.delete("goal_activation");
```

**File**: `apps/presentation/dashboard/src/features/personal-workspace/completed-task-lane.tsx` (modified, +21/-3)
```diff
@@ -1,4 +1,4 @@
-import { useEffect, useId, useRef, useState } from "react";
+import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
 import { z } from "zod";
 import {compactWorkspaceText} from "./personal-workspace-model";
 import type { WorkspaceAgentTodo, WorkspaceDrawerSelection, WorkspaceGoal } from "./personal-workspace-model";
@@ -10,9 +10,9 @@ const pageSchema = z.object({
 });
 
 /** Fixed-height previews keep layout/DOM cost bounded; the drawer retains full text. */
-export function CompletedTaskLane({ goal, agentId, seed, enabled, listView = false, onSelect }: {
+export function CompletedTaskLane({ goal, agentId, seed, enabled, refreshRevision = 0, listView = false, onSelect }: {
   goal: WorkspaceGoal; agentId: string; seed: WorkspaceAgentTodo[]; enabled: boolean;
-  listView?: boolean; onSelect: (selection: WorkspaceDrawerSelection) => void;
+  refreshRevision?: number; listView?: boolean; onSelect: (selection: WorkspaceDrawerSelection) => void;
 }) {
   const { t } = useWorkspaceI18n();
   const historyId = useId();
@@ -37,6 +37,23 @@ export function CompletedTaskLane({ goal, agentId, seed, enabled, listView = fal
     observer.observe(element);
     return () => { observer.disconnect(); request.current?.abort(); };
   }, []);
+  // A workspace reread invalidates the independent history snapshot, even if
+  // the directory, selected Goal and completed count did not change. Keep the
+  // user's list expansion; cancel old pages before opening a fresh cursor.
+  const resetSnapshot = useEffectEvent(() => {
+    request.current?.abort();
+    request.current = null;
+    setRows(seed);
+    setTotal(agentId === "all" ? goal.doneTodoCount ?? seed.length : seed.length);
+    setCursor(undefined);
+    setBusy(false);
+    setError(false);
+    setExpired(false);
+    setFocused(null);
+    if (scroll.current) scroll.current.scrollTop = 0;
+    setViewport({ top: 0, height: scroll.current?.clientHeight ?? 600 });
+  });
+  useEffect(() => { resetSnapshot(); }, [refreshRevision]);
   const needsPage = cursor === undefined || viewport.top + viewport.height >= rows.length * rowHeight - rowHeight * 2;
   useEffect(() => {
     if (!enabled || !visible || !needsPage || cursor === null || error || request.current) return;
@@ -47,6 +64,7 @@ export function CompletedTaskLane({ goal, agentId, seed, enabled, listView = fal
     if (agentId !== "all") query.set("agent_id", agentId);
     if (cursor) query.set("cursor", cursor);
     void fetch(`/api/chat/completed-todos?${query}`, { signal: controller.signal }).then(async (response) => {
+      if (controller.signal.aborted) return;
       if (response.status === 409) setExpired(true);
       if (!response.ok) throw new Error("history unavailable");
       const page = pageSchema.parse(await response.json());
```

**File**: `apps/presentation/dashboard/src/features/personal-workspace/goal-tasks-view.tsx` (modified, +3/-1)
```diff
@@ -106,6 +106,7 @@ function TaskLane({
  */
 export function GoalTasksView({
   historyEnabled = false,
+  historyRefreshRevision = 0,
   goal,
   items,
   onDraftTaskFromMessage,
@@ -117,6 +118,7 @@ export function GoalTasksView({
   userTodos,
 }: {
   historyEnabled?: boolean;
+  historyRefreshRevision?: number;
   goal: WorkspaceGoal;
   items: WorkspaceTimelineItem[];
   onDraftTaskFromMessage?: (message: string) => void;
@@ -283,7 +285,7 @@ export function GoalTasksView({
         ))}
         {!scheduleItems.length ? <p className="personal-task-empty">{t("tasks.emptySchedules")}</p> : null}
       </TaskLane>
-      <CompletedTaskLane key={`${goal.goalId}:${selectedLaneId}:${historyEnabled}`} goal={goal} agentId={selectedLaneId} seed={doneAgentTodos} enabled={historyEnabled} listView={listView} onSelect={onSelect} />
+      <CompletedTaskLane key={`${goal.goalId}:${selectedLaneId}:${historyEnabled}`} goal={goal} agentId={selectedLaneId} seed={doneAgentTodos} refreshRevision={historyRefreshRevision} enabled={historyEnabled} listView={listView} onSelect={onSelect} />
       </div>
       {isEmpty ? (
         <p className="personal-task-empty">
```

**File**: `apps/presentation/dashboard/src/features/personal-workspace/personal-workspace-contract.test.mjs` (modified, +1/-1)
```diff
@@ -194,7 +194,7 @@ assert.match(page, /callbacks\.onGoalActivationStateChange\?\.\(lifecycleChange\
 assert.match(page, /model\.goals\.find\(\(goal\) => goal\.goalId === proposal\.goalId\)\?\.activationState/, "Goal lifecycle rollback captures the rendered state instead of assuming the operation inverse");
 assert.match(page, /callbacks\.onGoalActivationStateChange\?\.\(lifecycleChange\.goalId, lifecycleChange\.previous\)/, "Rejected Goal lifecycle apply rolls back the optimistic projection");
 assert.match(page, /if \(applied\.actionKind === "goal\.lifecycle"\) \{\s*void reconcileStatus\(applied\.goalId \? \[applied\.goalId\] : undefined\)/, "Successful Goal lifecycle apply reconciles the affected Goal without blocking the sidebar");
-assert.match(dashboard, /onReconcileStatus=\{\(options\) => loadFromUrl\([\s\S]*\{ background: true, invalidateGoalIds: options\?\.invalidateGoalIds, reuseSnapshots: true \}/, "Lifecycle reconciliation uses the non-fatal background status path");
+assert.match(dashboard, /onReconcileStatus=\{\(options\) => loadFromUrl\([\s\S]*\{ background: true, invalidateGoalIds: options\?\.invalidateGoalIds, readScope: "missing" \}/, "Lifecycle reconciliation uses the non-fatal background status path");
 assert.match(dashboard, /statusRequestCanCommit\(statusRequestFenceRef\.current, request\)/, "A stale background response cannot overwrite a newer optimistic transition");
 assert.match(sidebar, /Trash2/, "Stopped Goals expose a delete icon");
 assert.match(sidebar, /onRequestGoalLifecycle\(goal, "delete"\)/, "Goal deletion stays behind the lifecycle request boundary");
```

---

### Incident Patch 4: `d2546748` (2026-09-30)
**Commit Message**: fix(delegation): fail closed when bound workspace changes during preflight (#5301)

* fix(delegation): recheck bound workspace identity through preflight

Signed-off-by: huangruiteng <14976749+huangruiteng@users.noreply.github.com>

* docs(delegation): explain workspace drift readback

Signed-off-by: huangruiteng <14976749+huangruiteng@users.noreply.github.com>

* test(delegation): cover symlink retarget during preflight

Signed-off-by: huangruiteng <14976749+huangruiteng@users.noreply.github.com>

---------

Signed-off-by: huangruiteng <14976749+huangruiteng@users.noreply.github.com>
Signed-off-by: huangruiteng <huangrt01@163.com>
Co-authored-by: huangruiteng <14976749+huangruiteng@users.noreply.github.com>

**File**: `docs/reference/local-delegation.md` (modified, +10/-1)
```diff
@@ -486,7 +486,13 @@ repeat inspection. The same projection is rendered in **Team execution** and
 returned by CLI/MCP/Goal Chat. Inspection creates no directory, retargets no
 binding, launches no worker and exports no private path or filesystem error.
 It is a point-in-time observation; a changed binding fails closed and start
-still rechecks the existing work/authority boundaries.
+still rechecks the existing work/authority boundaries. Inspection also
+reobserves the directory target after acceptance and the real Turn preview:
+if that target disappeared or was replaced, it returns the same bounded
+workspace diagnosis instead of reporting the old workspace as ready. This
+does not lock the filesystem or authorize launch.
+Expected preview failures also recheck the workspace; when the directory is
+unchanged, the original timeout, malformed response or I/O error is preserved.
 
 中文：工作目录故障在调用者授权与 Goal 活跃检查之后、Authority 与 Turn 检查之前
 返回 `workspace_unavailable`。`workspace_state` 区分 `missing`（不存在）、
@@ -496,6 +502,9 @@ still rechecks the existing work/authority boundaries.
 要求核对原执行配置及绑定目录后重新检查；团队执行页面与 CLI/MCP/Goal Chat 消费
 同一投影。检查不创建目录、不改绑、不启动成员，也不暴露私人路径或文件系统错误。
 结果只是时点观察；配置变更仍拒绝，实际启动仍须重新通过原有工作与权限边界。
+预期的预览故障也重新检查目录；目录未变时保留原始超时、响应解析或 I/O 错误。
+预检还会在验收检查与真实 Turn 预览后复核目录目标；期间消失或被替换时，返回相同
+的有界工作目录诊断，不把旧目录误报为就绪。这并不锁定文件系统，也不授权启动。
 
 `executor.runtime_probe` preserves the host's bounded probe scope: a DSH
 `probing_interpreter` result concerns module availability in the interpreter
```

**File**: `loopx/collaboration_mcp.py` (modified, +78/-20)
```diff
@@ -97,6 +97,31 @@ def _python_module_command(module: str) -> list[str]:
     return [sys.executable, "-P", "-m", module]
 
 
+def _observe_bound_workspace(path: Path) -> tuple[str, tuple[int, int, Path] | None]:
+    """Observe a directory and its target identity without exposing its path.
+
+    The binding is operator-owned, but a worktree or symlink can disappear or
+    change targets while a read-only Turn preview is running.  Identity is a
+    host fact; the shared TypeScript preflight still owns the readiness rule.
+    """
+
+    try:
+        observed = path.stat()
+        if not stat.S_ISDIR(observed.st_mode):
+            return "not_directory", None
+        resolved = path.resolve(strict=True)
+        target = resolved.stat()
+        if (observed.st_dev, observed.st_ino) != (target.st_dev, target.st_ino):
+            return "unavailable", None
+        return "available", (observed.st_dev, observed.st_ino, resolved)
+    except FileNotFoundError:
+        return "missing", None
+    except NotADirectoryError:
+        return "not_directory", None
+    except (OSError, RuntimeError):
+        return "unavailable", None
+
+
 def _pinned_module_command(module: str, *, interpreter: str | None = None) -> list[str]:
     """Build a self-contained module argv for hosts that sanitize env vars."""
 
@@ -369,33 +394,42 @@ def _inspect(self, binding_id: str) -> dict[str, object]:
         binding = self.binding(binding_id, require_active=True)
         # Host filesystem facts only; the shared TS owner projects readiness.
         # Do not expose a path/error body or probe authority in a missing cwd.
-        try:
-            workspace_state = (
-                "available" if stat.S_ISDIR(Path(binding["workspace"]).stat().st_mode)
-                else "not_directory"
-            )
-        except FileNotFoundError:
-            workspace_state = "missing"
-        except NotADirectoryError:
-            workspace_state = "not_directory"
-        except OSError:
-            workspace_state = "unavailable"
-        if workspace_state != "available":
-            if self.binding(binding_id, require_active=True) != binding:
-                raise ValueError("delegation preflight source changed; retry inspection")
+        workspace_path = Path(binding["workspace"])
+        workspace_state, workspace_identity = _observe_bound_workspace(workspace_path)
+
+        def workspace_fault(state: str) -> dict[str, object]:
             return effect_runtime_result("collaboration.delegation.preflight", {
                 "binding": {key: binding[key] for key in ("id", "agent_id", "todo_id")},
-                "workspace": {"state": workspace_state},
+                "workspace": {"state": state},
                 "authority": None, "preview": None, "acceptance": None,
                 "validation_files_current": False,
             })
+
+        def recheck_workspace() -> dict[str, object] | None:
+            if self.binding(binding_id, require_active=True) != binding:
+                raise ValueError("delegation preflight source changed; retry inspection")
+            current_state, current_identity = _observe_bound_workspace(workspace_path)
+            if current_state == "available" and current_identity == workspace_identity:
+                return None
+            # A replacement directory is not the directory whose authority
+            # and acceptance were observed at entry.  No path or error leaks.
+            return workspace_fault(
+                current_state if current_state != "available" else "unavailable"
+            )
+
+        if workspace_state != "available":
+            if self.binding(binding_id, require_active=True) != binding:
+                raise ValueError("delegation preflight source changed; retry inspection")
+            return workspace_fault(workspace_state)
+        assert workspace_identity is not None
         try:
             acceptance = delegation_validation.capture(self, bin
```

**File**: `tests/test_delegation_preflight.py` (modified, +163/-0)
```diff
@@ -125,6 +125,169 @@ def changed_binding(binding_id, **kwargs):
         runner.inspect("analysis")
 
 
+def test_workspace_removed_during_acceptance_is_typed_before_turn_preview(
+    service, monkeypatch
+):
+    from loopx import collaboration_mcp as delegation
+
+    root, runner = service
+    workspace = Path(runner.binding("analysis", require_active=True)["workspace"])
+    original_capture = delegation.delegation_validation.capture
+
+    def capture_then_remove(*args, **kwargs):
+        result = original_capture(*args, **kwargs)
+        workspace.rename(root / "relocated-worker")
+        return result
+
+    def no_turn(*args, **kwargs):
+        raise AssertionError("a changed workspace must not reach Turn preview")
+
+    monkeypatch.setattr(delegation.delegation_validation, "capture", capture_then_remove)
+    monkeypatch.setattr(runner, "_cli", no_turn)
+    result = runner.inspect("analysis")
+    assert result["state"] == "workspace_unavailable"
+    assert result["workspace_state"] == "missing"
+    assert result["authority_ready"] is None
+    assert not any(result["effects"].values())
+    assert str(workspace) not in json.dumps(result)
+    assert not list(runner.path("inventory").parent.glob("*.json"))
+
+
+def test_workspace_symlink_retargeted_during_acceptance_is_typed(
+    service, monkeypatch
+):
+    from loopx import collaboration_mcp as delegation
+
+    root, runner = service
+    original_workspace = Path(runner.binding("analysis", require_active=True)["workspace"])
+    replacement_workspace = root / "replacement-worker"
+    replacement_workspace.mkdir()
+    workspace_link = root / "bound-worker-link"
+    workspace_link.symlink_to(original_workspace, target_is_directory=True)
+    config = json.loads(runner.config.read_text())
+    config["bindings"][0]["workspace"] = str(workspace_link)
+    runner.config.write_text(json.dumps(config))
+    original_capture = delegation.delegation_validation.capture
+
+    def capture_then_retarget(*args, **kwargs):
+        result = original_capture(*args, **kwargs)
+        workspace_link.unlink()
+        workspace_link.symlink_to(replacement_workspace, target_is_directory=True)
+        return result
+
+    def no_turn(*args, **kwargs):
+        raise AssertionError("a retargeted workspace must not reach Turn preview")
+
+    monkeypatch.setattr(delegation.delegation_validation, "capture", capture_then_retarget)
+    monkeypatch.setattr(runner, "_cli", no_turn)
+    result = runner.inspect("analysis")
+    assert result["state"] == "workspace_unavailable"
+    assert result["workspace_state"] == "unavailable"
+    assert result["authority_ready"] is None
+    assert not result["turn_eligible"] and not any(result["effects"].values())
+    assert str(workspace_link) not in json.dumps(result)
+    assert str(replacement_workspace) not in json.dumps(result)
+
+
+@pytest.mark.parametrize("replacement", [False, True])
+def test_workspace_changed_during_real_turn_preview_is_not_reported_ready(
+    service, monkeypatch, replacement
+):
+    root, runner = service
+    workspace = Path(runner.binding("analysis", require_active=True)["workspace"])
+    original_cli = runner._cli
+
+    def preview_then_change(*args, **kwargs):
+        preview = original_cli(*args, **kwargs)
+        workspace.rename(root / "relocated-worker")
+        if replacement:
+            workspace.mkdir()
+        return preview
+
+    monkeypatch.setattr(runner, "_cli", preview_then_change)
+    result = runner.inspect("analysis")
+    assert result["state"] == "workspace_unavailable"
+    assert result["workspace_state"] == ("unavailable" if replacement else "missing")
+    assert result["workspace_next_action"] == "review_operator_workspace_binding"
+    assert result["authority_ready"] is None
+    assert not result["turn_eligible"] and not any(result["effects"].values())
+    assert str(workspace) not in json.dumps(result)
+    assert not (root / "host-started").exists()
+    as
```

---

### Incident Patch 5: `0538bf16` (2026-09-30)
**Commit Message**: fix(lark): normalize strong emphasis at punctuation boundaries (#5352)

Signed-off-by: huangruiteng <huangrt01@163.com>

**File**: `docs/architecture/rfcs/app-conversation-and-async-inbox-v0.md` (modified, +12/-0)
```diff
@@ -160,6 +160,18 @@ packaged UI with synthetic fixtures and qualify the chosen real query separately
 | Execution and control | Existing managed Turn, attached-session/host binding, Chat steering/interrupt | Qualify the exact supported profile. Neither registered nor inbox-acknowledged means running; native steering, next-Turn queue and unsupported must stay distinct |
 | Result | Answer-report, artifact/revision, review/adoption and return owners | Read the stored version; preserve source and independent review. A failed report read retries reading, not a new model run |
 
+Lark's readable-answer exit also checks rendered emphasis, not only a matching
+Markdown source receipt. Following the [CommonMark delimiter rules](https://spec.commonmark.org/0.31.2/#emphasis-and-strong-emphasis),
+the shared inbox reply adapter normalizes a paired
+strong span whose trailing punctuation is immediately followed by a word:
+`**Done.**Next` becomes `**Done**.Next`. Visible text remains identical; the
+punctuation moves outside the emphasis. Inline/fenced code, escaped markers and
+link destinations stay opaque. Qualify this with a real post's rendered bold
+styles and preserved inline-code syntax, alongside source/thread placement and
+idempotent readback. This provider formatting stays in the Python Lark adapter
+under the TS migration RFC; it adds no conversation state or decision owner.
+App formatting and other Lark Markdown constructs remain separate acceptance.
+
 No new capability is needed for the first repair: this is the existing App
 conversation/action boundary, with built-in Chat/runtime providers unchanged.
 The shared inbox work belongs under existing coordination/collaboration owners;
```

**File**: `docs/architecture/rfcs/app-conversation-and-async-inbox-v0.zh-CN.md` (modified, +9/-0)
```diff
@@ -109,6 +109,15 @@ LoopX 还必须核验综合结果返回原请求。这些是文档陈述，非
 | 执行与控制 | 现有 managed Turn、attached-session/host binding、Chat steering/interrupt | 验收精确受支持的 profile。已注册或 inbox acknowledged 都不等于正在运行；原生 steering、next-Turn queue 和 unsupported 必须分别表达 |
 | 结果 | Answer-report、artifact/revision、review/adoption 与 return owners | 读取已存版本，保留来源与独立审阅。report 读取失败重试读取，不重新运行模型 |
 
+Lark 可读回复的出口还要检查实际强调呈现，不能把 Markdown 原文读回一致当成视觉验收。
+依照 [CommonMark 分隔符规则](https://spec.commonmark.org/0.31.2/#emphasis-and-strong-emphasis)，
+共享 inbox 回复适配器对“加粗内的末尾标点紧接下一单词”做格式规范化：
+`**完成。**下一句` 转为 `**完成**。下一句`。显示文字不变，末尾标点移到强调之外；
+行内/围栏代码、转义标记和链接地址不参与改写。用真实 post 的已渲染 bold 样式与保留的行内代码
+语法验收，同时保留原上下文/线程位置及幂等读回。此项属于 TS 重构 RFC 允许保留的
+Python Lark provider 格式适配，不新增会话状态或决策 owner。
+App 格式和其他 Lark Markdown 结构仍有各自的验收边界。
+
 首个修复不需要新 capability：它属于现有 App 会话与 action 边界，内置 Chat/runtime provider 不变。
 共享 inbox 工作属于现有 coordination/collaboration owners；Lark 仍是 extension 提供的 provider。
 只有真实 provider-neutral 调用结果无法容纳于这些 owner 时，才重新考虑公开 capability。
```

**File**: `loopx/extensions/lark/inbox_reply.py` (modified, +8/-5)
```diff
@@ -14,13 +14,16 @@
     load_lark_event_inbox_config,
 )
 from .inbox_reactions import complete_lark_event_inbox_reactions
+from .presentation.markdown_post import (
+    lark_markdown_post_content,
+    lark_markdown_preview_matches,
+    lark_markdown_readback_matches,
+)
+
 from .outbound import (
     DEFAULT_LARK_TEXT_LIMIT,
     LARK_POST_REQUEST_MAX_BYTES,
     expected_lark_mention_identities,
-    lark_markdown_post_content,
-    lark_markdown_preview_matches,
-    lark_markdown_readback_matches,
     lark_member_identities,
     lark_provider_preview_matches_outbound,
     lark_readback_matches_outbound,
@@ -280,7 +283,7 @@ def _deliver_lark_inbox_outbound(
     provider_preflight: bool = False,
     runner: CommandRunner = _default_runner,
     before_send: Callable[[str], Mapping[str, Any]] | None = None,
-    delivery_attempt_recorder: Callable[[Mapping[str, str]], None] | None = None,
+    delivery_attempt_recorder: Callable[[Mapping[str, str | None]], None] | None = None,
     short_message_limit: int | None = DEFAULT_LARK_TEXT_LIMIT,
 ) -> dict[str, Any]:
     """Deliver through one inbox-configured bot with exact provider readback.
@@ -736,7 +739,7 @@ def reply_lark_event_inbox(
     provider_preflight: bool = False,
     runner: CommandRunner = _default_runner,
     before_send: Callable[[str], Mapping[str, Any]] | None = None,
-    delivery_attempt_recorder: Callable[[Mapping[str, str]], None] | None = None,
+    delivery_attempt_recorder: Callable[[Mapping[str, str | None]], None] | None = None,
     short_message_limit: int | None = DEFAULT_LARK_TEXT_LIMIT,
 ) -> dict[str, Any]:
     """Reply with the explicit inbox-configured bot and placement policy.
```

**File**: `loopx/extensions/lark/outbound.py` (modified, +0/-60)
```diff
@@ -423,63 +423,3 @@ def lark_readback_matches_outbound(
             return False
         actual_text = actual_text.replace(rendered_candidates[0], token)
     return normalized_lark_lines(actual_text) == expected_text
-
-
-def lark_markdown_post_content(text: str) -> str:
-    """Preserve authored Markdown without the CLI's image-fetch/rewrite pass."""
-    return json.dumps({"zh_cn": {"content": [[{"tag": "md", "text": text}]]}},
-                      ensure_ascii=False, separators=(",", ":"))
-
-
-def _single_markdown_post(value: Any) -> str | None:
-    if isinstance(value, str):
-        try:
-            value = json.loads(value)
-        except json.JSONDecodeError:
-            return None
-    if not isinstance(value, Mapping) or set(value) != {"zh_cn"}:
-        return None
-    locale = value["zh_cn"]
-    if not isinstance(locale, Mapping) or set(locale) - {"title", "content"}:
-        return None
-    if locale.get("title", "") != "":
-        return None
-    rows = locale.get("content")
-    if not isinstance(rows, list) or len(rows) != 1:
-        return None
-    row = rows[0]
-    if not isinstance(row, list) or len(row) != 1:
-        return None
-    node = row[0]
-    if not isinstance(node, Mapping) or set(node) != {"tag", "text"}:
-        return None
-    return node["text"] if node["tag"] == "md" and isinstance(node["text"], str) else None
-
-
-def lark_markdown_preview_matches(*, text: str, payload: Mapping[str, Any]) -> bool:
-    data = payload.get("data")
-    calls = payload.get("api")
-    if calls is None and isinstance(data, Mapping):
-        calls = data.get("api")
-    if not isinstance(calls, list) or len(calls) != 1:
-        return False
-    call = calls[0]
-    body = call.get("body") if isinstance(call, Mapping) else None
-    return (isinstance(body, Mapping) and body.get("msg_type") == "post"
-            and _single_markdown_post(body.get("content")) == text)
-
-
-def lark_markdown_readback_matches(*, text: str, message: Mapping[str, Any]) -> bool:
-    """Accept the raw post or CLI's md text, never a plain-text lookalike."""
-    if message.get("msg_type", message.get("message_type")) != "post":
-        return False
-    if message.get("mentions") not in (None, []):
-        return False
-    body = message.get("body")
-    if isinstance(body, Mapping):
-        actual = _single_markdown_post(body.get("content"))
-    else:
-        actual = message.get("content")
-        if not isinstance(actual, str):
-            actual = _single_markdown_post(actual)
-    return isinstance(actual, str) and actual.replace("\r\n", "\n").strip() == text
```

**File**: `loopx/extensions/lark/presentation/markdown_post.py` (added, +193/-0)
```diff
@@ -0,0 +1,193 @@
+"""Lark post presentation; shared by all inbox reply callers.
+
+This is provider formatting, not conversation state or effect authority. The
+post's CommonMark parser rejects closing strong delimiters between punctuation
+and a following word. Move that trailing punctuation outside the emphasis;
+visible text is unchanged and inline/fenced code remains authored.
+"""
+
+from __future__ import annotations
+
+import json
+import re
+import unicodedata
+from collections.abc import Mapping
+from typing import Any
+
+
+def normalize_lark_markdown_emphasis(text: str) -> str:
+    """Repair paired strong spans at punctuation/word boundaries only.
+
+    This deliberately is not a new Markdown parser. The provider still owns
+    Markdown rendering. Escapes, code, link destinations, unmatched markers and
+    triple-star runs remain opaque, rather than guessing their meaning.
+    """
+    lines: list[str] = []
+    fence: tuple[str, int] | None = None
+    for line in text.splitlines(keepends=True):
+        match = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
+        if fence is not None:
+            lines.append(line)
+            if (
+                match
+                and match[1][0] == fence[0]
+                and len(match[1]) >= fence[1]
+                and not line[match.end() :].strip()
+            ):
+                fence = None
+            continue
+        if match:
+            fence = (match[1][0], len(match[1]))
+            lines.append(line)
+            continue
+        lines.append(_normalize_strong_line(line))
+    return "".join(lines)
+
+
+def _normalize_strong_line(line: str) -> str:
+    edits: list[tuple[int, int, str]] = []
+    opening: int | None = None
+    ticks = 0
+    opaque_end = 0
+    cursor = 0
+    while cursor < len(line):
+        character = line[cursor]
+        if character == "\\" and not ticks:
+            cursor += 2
+            continue
+        if character == "`":
+            end = cursor + 1
+            while end < len(line) and line[end] == "`":
+                end += 1
+            size = end - cursor
+            if not ticks:
+                ticks = size
+            elif size == ticks:
+                ticks = 0
+                opaque_end = end
+            cursor = end
+            continue
+        # URLs are opaque. Emphasis in a link label can still be repaired.
+        if not ticks and line.startswith("](", cursor):
+            depth = 1
+            cursor += 2
+            while cursor < len(line) and depth:
+                if line[cursor] == "\\":
+                    cursor += 2
+                    continue
+                if line[cursor] == "(":
+                    depth += 1
+                elif line[cursor] == ")":
+                    depth -= 1
+                cursor += 1
+            opaque_end = cursor
+            continue
+        if ticks or character != "*":
+            cursor += 1
+            continue
+        end = cursor + 1
+        while end < len(line) and line[end] == "*":
+            end += 1
+        if end - cursor != 2:
+            cursor = end
+            continue
+        if opening is None:
+            if end < len(line) and not line[end].isspace():
+                opening = end
+        elif cursor > opening and not line[cursor - 1].isspace():
+            suffix = cursor
+            while (
+                suffix > max(opening, opaque_end)
+                and unicodedata.category(line[suffix - 1]).startswith(("P", "S"))
+                and line[suffix - 1] not in "`*_\\"
+            ):
+                suffix -= 1
+            if (
+                suffix < cursor
+                and suffix > opening
+                and not line[suffix - 1].isspace()
+                and end < len(line)
+                and line[end].isalnum()
+            ):
+                edits.append((suffix, end, "**" + line[suffix:cursor]))
+            opening = None
+        cursor = end
+    chunks: list[str] = 
```

---

### Incident Patch 6: `64380925` (2026-09-30)
**Commit Message**: fix(workspace): confirm a reported Turn with a fresh Session read

A 409 handoff records the Session and Turn the service refused the send for.
Once conversation history moved to the shared read hook, the recovery effect
only saw that hook's earlier snapshot, so it could not find the reported Turn:
it left the handoff reply pending beside a second pending reply and overwrote
the bound running Turn with the stale one.

Let the hook re-read the conversation on demand, and use that read as the
evidence for adopting a handoff. Until it returns -- or while it keeps
failing -- the handoff reply stays pending with its own Turn controls, which is
the behaviour the 409 scenario already specifies. The scenario now holds and
fails exactly that conversation read, so the check can no longer be satisfied
by an unrelated session-listing poll.

Signed-off-by: huangruiteng <huangrt01@163.com>

**File**: `apps/presentation/dashboard/src/data/use-conversation-history.ts` (modified, +30/-8)
```diff
@@ -10,6 +10,11 @@ type HistoryState = {
 
 export type ConversationHistoryStatus = Pick<ReturnType<typeof useConversationHistory>, "phase" | "reading" | "sendBlocked" | "retry">;
 
+/** The newest Session a channel read found for one executor. */
+export function currentChannelSession(history: ChatHistory | null, agentId: string) {
+  return history?.sessions.find((session) => session.agent_id === agentId) ?? null;
+}
+
 /** Read recovery shared by steward and Goal conversations; never executes a Turn. */
 export function useConversationHistory({ agentId, currentAgentId, channelId, goalId, enabled }: {
   agentId?: string;
@@ -22,29 +27,45 @@ export function useConversationHistory({ agentId, currentAgentId, channelId, goa
   const [state, setState] = useState<HistoryState | null>(null);
   const retryRead = useRef<(() => void) | null>(null);
   const retry = useCallback(() => retryRead.current?.(), []);
+  const cached = useRef<{ scope: string; history: ChatHistory } | null>(null);
+  const cachedHistory = (forScope: string) => cached.current?.scope === forScope ? cached.current.history : null;
+  const params = useRef({ agentId, channelId, goalId, scope });
+  params.current = { agentId, channelId, goalId, scope };
+  // A caller that learned of a Turn the cached read cannot show -- the service
+  // refused a send because that Turn is running -- needs what the Session looks
+  // like now, not what this hook read earlier. The re-read stays here so the
+  // conversation keeps a single history owner.
+  const refresh = useCallback(async () => {
+    const { agentId, channelId, goalId, scope } = params.current;
+    const loaded = await fetchChatHistory({ agentId, channelId, goalId });
+    cached.current = { scope, history: loaded };
+    setState({ scope, history: loaded, reading: false, failed: false });
+    return loaded;
+  }, []);
   useEffect(() => {
     if (!enabled) return;
     let cancelled = false;
     let reading = false;
-    let history: ChatHistory | null = null;
     let retryTimer: ReturnType<typeof setTimeout> | undefined;
     let attempts = 0;
     async function read() {
       if (cancelled || reading) return;
       clearTimeout(retryTimer);
       reading = true;
-      setState({ scope, history, reading: true, failed: false });
+      const previous = cachedHistory(scope);
+      setState({ scope, history: previous, reading: true, failed: false });
       try {
-        const loaded = await fetchChatHistory({ agentId, channelId, goalId }, history ?? undefined);
+        const loaded = await fetchChatHistory({ agentId, channelId, goalId }, previous ?? undefined);
         if (cancelled) return;
-        history = loaded;
-        setState({ scope, history, reading: false, failed: false });
+        cached.current = { scope, history: loaded };
+        setState({ scope, history: loaded, reading: false, failed: false });
       } catch {
         if (cancelled) return;
-        setState({ scope, history, reading: false, failed: true });
+        setState({ scope, history: cachedHistory(scope), reading: false, failed: true });
       } finally {
         reading = false;
-        if (!cancelled && (!history || history.unavailableSessionIds.length > 0)) {
+        const known = cachedHistory(scope);
+        if (!cancelled && (!known || known.unavailableSessionIds.length > 0)) {
           // Back off sustained transport failures; a user can retry immediately.
           retryTimer = setTimeout(() => void read(), Math.min(3000 * 2 ** attempts++, 30_000));
         }
@@ -62,11 +83,12 @@ export function useConversationHistory({ agentId, currentAgentId, channelId, goa
   const history = current?.history ?? null;
   // A channel transcript spans executors; readability of another executor's
   // latest session cannot authorize sending into the selected one.
-  const latest = history?.sessions.find((session) => session.agent_id === currentAgentId);
+  const latest = currentChannelSession(history, currentAge
```

**File**: `apps/presentation/dashboard/src/views/dashboard-page.tsx` (modified, +11/-3)
```diff
@@ -1,6 +1,6 @@
 import { normalizeGoalDraft, type GoalDraft } from "../../../../../loopx/control_plane/collaboration/goal_draft.js";
 import { conversationReturnSessions, reconcileConversationHistory, reconcileConversationReturns } from "../data/conversation-returns";
-import { useConversationHistory } from "../data/use-conversation-history";
+import { currentChannelSession, useConversationHistory } from "../data/use-conversation-history";
 import {compactWorkspaceText as compactShareText} from "../features/personal-workspace/personal-workspace-model";
 import type { GoalAcceptanceObservation } from "../data/goal-acceptance-observation";
 import { attentionDetails, sourceAttention } from "../features/personal-workspace/attention-details";
@@ -1654,7 +1654,7 @@ function PersonalGoalHome({
     if (readOnly) return;
     if (!selectedAgent.available) return;
     if (!conversationHistory.connectionKey || !conversationHistory.history) return;
-    const history = conversationHistory.history;
+    const readHistory = conversationHistory.history;
     const targetContextId = contextId;
     const sessionKey = `${targetContextId}:${selectedAgent.agentId}`;
     const contextKind = selectedGoal ? "goal" : "manager";
@@ -1666,7 +1666,15 @@ function PersonalGoalHome({
     void (async () => {
       try {
         if (selectedAgent.agentId === "status-only") return;
-        const latest = conversationHistory.currentSession;
+        // A 409 handoff reports a Turn this page has not read, so the cached
+        // transcript cannot show it. Re-read the conversation before adopting
+        // that Turn; until the read returns, the handoff reply stays pending
+        // with its own Turn controls.
+        const history = turnHandoffs.current.has(targetContextId)
+          ? await conversationHistory.refresh()
+          : readHistory;
+        if (cancelled) return;
+        const latest = currentChannelSession(history, selectedAgent.agentId);
         latestDiscoveredSessionId = latest?.session_id ?? null;
         if (latest && !latest.resumable) {
           newSessionRequired.current.add(sessionKey);
```

**File**: `examples/personal-workspace-browser/chat-recovery.mjs` (modified, +7/-4)
```diff
@@ -402,12 +402,14 @@ export const chatRecoveryScenario = {
         await route.fulfill({ contentType: "application/json", status: 409,
           json: { ok: false, error: "another turn is already running for this session", active_turn_id: foreignTurnId } });
       });
-      // Hold the Session re-read that follows the 409, so the check covers
-      // the handoff before the recovery adopts the Turn, not only after.
+      // Hold the conversation's own Session re-read that follows the 409, so
+      // the check covers the handoff before the recovery adopts the Turn, not
+      // only after.
       const heldReads = [];
       let holdReads = false;
       await page.route("**/api/chat/sessions?*", async (route) => {
-        if (!holdReads || route.request().method() !== "GET") return route.fallback();
+        if (!holdReads || route.request().method() !== "GET"
+          || !new URL(route.request().url()).searchParams.has("channel_id")) return route.fallback();
         heldReads.push(route);
       });
       const draft = "这条消息在另一回合运行时发出";
@@ -467,7 +469,8 @@ export const chatRecoveryScenario = {
       const heldRetryReads = [];
       let failReads = false;
       await page.route("**/api/chat/sessions?*", async (route) => {
-        if (!failReads || route.request().method() !== "GET") return route.fallback();
+        if (!failReads || route.request().method() !== "GET"
+          || !new URL(route.request().url()).searchParams.has("channel_id")) return route.fallback();
         if (failedReads === 0) {
           failedReads += 1;
           return route.fulfill({ contentType: "application/json", status: 503, json: { ok: false, error: "chat store temporarily unavailable" } });
```

---

### Incident Patch 7: `d29ac864` (2026-09-30)
**Commit Message**: fix(agents): derive worker executing state from lane and lease facts, not Todo timestamps (#5306)

* feat(turn-driver): read Turn lane liveness without taking the lane

Add `lock_holder_liveness` to the file-lock owner and `turn_lane_liveness`
on top of it. Both classify a lane's last executing Turn from its holder
record alone: `released` on a clean exit, `dead` when the record names
this machine and the pid is gone, `foreign_host` when the pid cannot be
checked here, `unreadable` when a lock file carries no parseable record,
and `live` only when a same-host pid is still alive.

The probe never touches the kernel lock. A probe that acquired it for an
instant would refuse a real `run-once --execute` racing that instant with
`turn_lane_in_flight` for nothing; the new test drives the real fence
wrapper concurrently with a continuous probe and proves the Turn is
admitted exactly once. The holder host label is now single-sourced so the
writer and the readers cannot disagree on what "this machine" is.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
Signed-off-by: song <22676124+songoow@users.noreply.github.com>

* fix(agents): derive worker executing state from lane and lease 

**File**: `examples/worker-lifecycle-state-smoke.py` (modified, +20/-3)
```diff
@@ -2,7 +2,7 @@
 """Smoke test for worker lifecycle state projection.
 
 Verifies that the agent management projection correctly derives lifecycle
-states from existing facts (registry, todo, session binding, activity).
+states from existing facts (registry, todo, session binding, execution facts).
 
 Run from the repository root:
     uv run --extra test python examples/worker-lifecycle-state-smoke.py
@@ -19,9 +19,14 @@
 
 
 def _recent_activity() -> str:
-    """Activity timestamp within the activity threshold (8 hours)."""
+    """A fresh Todo update: activity, which on its own never means execution."""
     return (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
 
+
+# Execution facts are what make a worker `executing`: here the worker's Turn
+# lane is live. The projection reads them; it never infers them from age.
+EXECUTION_FACTS = {"worker-executing": {"lane": "live"}}
+
 from loopx.control_plane.agents.management_projection import (  # noqa: E402
     WORKER_LIFECYCLE_STATE_ADDRESSABLE,
     WORKER_LIFECYCLE_STATE_BLOCKED,
@@ -112,7 +117,19 @@ def build_status_payload() -> dict:
 
 def main() -> int:
     payload = build_status_payload()
-    projection = build_agent_management_projection(payload)
+    projection = build_agent_management_projection(
+        payload, execution_facts=EXECUTION_FACTS
+    )
+    without_facts = build_agent_management_projection(payload)
+    timestamp_only = {
+        a["agent_id"]: a["state"] for a in without_facts.get("agents", [])
+    }.get("worker-executing")
+    if timestamp_only == WORKER_LIFECYCLE_STATE_EXECUTING:
+        print(
+            "FAIL: a fresh Todo timestamp without execution facts must not "
+            "read as executing"
+        )
+        return 1
 
     agents = {a["agent_id"]: a for a in projection.get("agents", [])}
 
```

**File**: `loopx/control_plane/agents/directory.py` (modified, +41/-4)
```diff
@@ -15,8 +15,9 @@
 - it reports no presence, because no presence provider is registered, and it
   says so in `presence_coverage` instead of leaving a reader to guess between
   "not running" and "this machine cannot see it";
-- it does not project a lease epoch, which the current projection does not own,
-  and it names that gap as a limitation.
+- it projects lease state only when the status payload carries execution
+  facts; a payload without them gets `lease_state_not_projected` instead of
+  a guess.
 """
 
 from __future__ import annotations
@@ -103,6 +104,28 @@ def _publishable_route(route: dict[str, Any]) -> tuple[dict[str, Any], int]:
     return published, withheld
 
 
+def _projected_execution_facts(payload: Mapping[str, Any]) -> dict[str, Any] | None:
+    """Recover the execution facts status collection projected onto agent rows.
+
+    ``None`` when the payload's projection says no facts were collected, so an
+    older or fact-less payload keeps `lease_state_not_projected` instead of
+    reading as "leases projected, none found".
+    """
+
+    projection = _as_mapping(payload.get("agent_management_projection"))
+    summary = _as_mapping(projection.get("source_summary"))
+    if summary.get("execution_facts_collected") is not True:
+        return None
+    facts: dict[str, Any] = {}
+    for row in _as_list(projection.get("agents")):
+        row = _as_mapping(row)
+        agent_id = str(row.get("agent_id") or "").strip()
+        execution = row.get("execution")
+        if agent_id and isinstance(execution, Mapping):
+            facts[agent_id] = dict(execution)
+    return facts
+
+
 def _work_block(agent_row: Mapping[str, Any]) -> dict[str, Any] | None:
     """Project one Agent's bounded work facts, or nothing when it holds none."""
 
@@ -120,9 +143,12 @@ def _work_block(agent_row: Mapping[str, Any]) -> dict[str, Any] | None:
         if claimed_by and _compact(todo.get("updated_at"), limit=60)
         else CLAIM_AGE_UNKNOWN
     )
+    lease = _as_mapping(_as_mapping(agent_row.get("execution")).get("lease"))
     work: dict[str, Any] = {
         "todo_id": normalize_todo_id(todo_id) or todo_id,
         "todo_status": _compact(todo.get("status"), limit=40) or "unknown",
+        "lease_status": _compact(lease.get("status"), limit=40),
+        "lease_expired": lease.get("expired") if isinstance(lease.get("expired"), bool) else None,
         "task_class": _compact(todo.get("task_class"), limit=60),
         "action_kind": _compact(todo.get("action_kind"), limit=60),
         "priority": _compact(todo.get("priority"), limit=20),
@@ -174,6 +200,7 @@ def build_peer_agent_directory(
     goal_id: str | None = None,
     caller_agent_id: str | None = None,
     available_capabilities: Any = None,
+    execution_facts: Any = None,
 ) -> dict[str, Any]:
     """Return a bounded `peer_agent_directory_v0` packet for one Goal.
 
@@ -182,13 +209,22 @@ def build_peer_agent_directory(
     against the registry rather than asserted by the caller; when it is absent
     the packet records that the caller identity was not supplied instead of
     inventing one.
+
+    `execution_facts` defaults to the facts the payload's management projection
+    already carries on its rows, so this re-projection reads the same lane,
+    worker and lease facts status collection did instead of reading them again.
     """
 
     payload = status_payload if isinstance(status_payload, Mapping) else {}
     resolved_goal = _compact(goal_id or payload.get("goal_filter"), limit=120)
     caller = _compact(caller_agent_id, limit=120)
+    if execution_facts is None:
+        execution_facts = _projected_execution_facts(payload)
+    facts = execution_facts if isinstance(execution_facts, Mapping) else None
     projection = build_agent_management_projection(
-        dict(payload), available_capabilities=available_capabilities
+        dict(payload),
+        available_capabilities=available_capabilities,
+        execution_facts=dict(
```

**File**: `loopx/control_plane/agents/execution_facts.py` (added, +267/-0)
```diff
@@ -0,0 +1,267 @@
+"""Execution facts behind the worker lifecycle projection: read, never lock.
+
+`executing` has to be backed by something that runs, not by a fresh Todo
+timestamp. This module gathers, per agent, the facts LoopX already keeps about
+running work, so the agent management projection can derive `executing` and
+`unknown` from them instead of from activity age:
+
+- the Turn lane holder record, one per Goal and agent, read through
+  `turn_lane_liveness`; a delegated member executes inside its own lane too;
+- the delegation worker: an in-flight delegation journal row whose operation
+  lock and the delegated Todo's execution slot are held by one live process;
+- the task leases on the Goal's open Todos, read from the canonical head after
+  cutover and from the local lease files before it.
+
+It writes nothing, takes no lock and keeps no state of its own: every input is
+owned elsewhere and this is a bounded read model over them. A fact that cannot
+be read is reported as such (`unreadable`, `unavailable`), never as "not
+running".
+"""
+
+from __future__ import annotations
+
+from collections.abc import Iterable, Mapping
+from datetime import datetime
+from pathlib import Path
+from typing import Any
+
+from ...file_lock import LOCK_HOLDER_LIVE, lock_holder_liveness
+from ..collaboration.inbox import _hash as manager_context_hash
+from ..collaboration.inbox import _read as read_manager_context_record
+from ..collaboration.inbox import _root as manager_context_root
+from ..content_digest import BARE_SHA256_PATTERN
+from ..coordination.local_authority import read_canonical_todos_if_promoted
+from ..runtime.time import now_utc, parse_timestamp
+from ..todos.contract import normalize_todo_claimed_by
+from ..turn_driver.lane_fence import (
+    TURN_LANE_ABSENT,
+    TURN_LANE_DEAD,
+    TURN_LANE_FOREIGN_HOST,
+    TURN_LANE_LIVE,
+    TURN_LANE_RELEASED,
+    TURN_LANE_UNREADABLE,
+    turn_lane_liveness,
+    turn_lane_target,
+)
+from ..work_items.local_lease_record import TaskLeaseError, read_lease
+from ..work_items.task_lease import lease_expires_at, normalize_goal_id, task_lease_path
+from .management_projection import projected_agent_goals
+
+# One agent can hold one lane per Goal; the row reports the strongest fact.
+# Unknowns outrank a plain "not running": a reader must fail closed on them.
+_LANE_PRECEDENCE = (
+    TURN_LANE_LIVE,
+    TURN_LANE_FOREIGN_HOST,
+    TURN_LANE_UNREADABLE,
+    TURN_LANE_DEAD,
+    TURN_LANE_RELEASED,
+    TURN_LANE_ABSENT,
+)
+LEASE_STATUS_ACTIVE = "active"
+LEASE_STATUS_UNAVAILABLE = "unavailable"
+_LANE_HOLDER_FIELDS = ("host", "pid", "acquired_at")
+# Observations that still have a transition in the delegation owner
+# (`loopx/control_plane/collaboration/delegation.ts`); `accepted` and `rejected`
+# are final, and an unlisted status is not evidence of a running worker.
+_DELEGATION_IN_FLIGHT_STATUSES = frozenset({"prepared", "running", "turn_returned"})
+
+
+def _lane_rank(state: str) -> int:
+    return _LANE_PRECEDENCE.index(state) if state in _LANE_PRECEDENCE else len(_LANE_PRECEDENCE)
+
+
+def _lease_rank(lease: Mapping[str, Any]) -> int:
+    """Fresher evidence first: an unexpired lease outranks an expired one."""
+
+    status = lease.get("status")
+    if status == LEASE_STATUS_ACTIVE:
+        return 0 if lease.get("expired") is False else 1
+    if status == LEASE_STATUS_UNAVAILABLE:
+        return 3
+    return 2
+
+
+def _lane_fact(runtime_root: Path, *, goal_id: str, agent_id: str) -> dict[str, Any]:
+    target = turn_lane_target(
+        runtime_root=runtime_root,
+        goal_id=goal_id,
+        plan={"turn_envelope": {"agent_id": agent_id}},
+    )
+    liveness = turn_lane_liveness(target)
+    fact: dict[str, Any] = {"lane": liveness["state"]}
+    holder = {
+        key: liveness["holder"][key]
+        for key in _LANE_HOLDER_FIELDS
+        if liveness["holder"].get(key) not in (None, "")
+    }
+    if holder:
+        fact["lane_holder"] 
```

**File**: `loopx/control_plane/agents/management_projection.py` (modified, +118/-19)
```diff
@@ -29,7 +29,6 @@
 MAX_SESSION_BINDING_CANDIDATES = 3
 MAX_WORKSPACE_SCOPES = 4
 STALE_CLAIM_THRESHOLD_HOURS = 36
-EXECUTING_ACTIVITY_THRESHOLD_HOURS = 8
 MATERIAL_LIFECYCLE_CAPABILITY = "material_lifecycle"
 
 _TODO_GROUP_LIST_KEYS = tuple(
@@ -189,6 +188,50 @@ def _registered_agents(status_payload: dict[str, Any]) -> dict[str, dict[str, An
     return rows
 
 
+def projected_agent_goals(
+    status_payload: dict[str, Any],
+) -> dict[str, dict[str, dict[str, list[str]]]]:
+    """Return ``goal_id -> agent_id -> {spellings, open_todo_ids}`` for this view's agents.
+
+    The execution facts collector reads one Turn lane per Goal and agent and the
+    leases on open Todos, so it needs the same agents this projection rows: each
+    Goal's registered agents and its open-Todo claimants. Registered ids keep
+    their registry spelling next to the normalized one, because the Turn
+    envelope names a lane with the former while Todo claims carry the latter.
+    """
+
+    goals: dict[str, dict[str, dict[str, list[str]]]] = {}
+
+    def add(goal_id: Any, raw_agent: Any, *, todo_id: str | None = None) -> None:
+        goal = str(goal_id or "").strip()
+        agent_id = normalize_todo_claimed_by(raw_agent)
+        if not goal or not agent_id:
+            return
+        work = goals.setdefault(goal, {}).setdefault(
+            agent_id, {"spellings": [agent_id], "open_todo_ids": []}
+        )
+        raw = str(raw_agent or "").strip()
+        if raw and raw not in work["spellings"]:
+            work["spellings"].append(raw)
+        if todo_id and todo_id not in work["open_todo_ids"]:
+            work["open_todo_ids"].append(todo_id)
+
+    run_history = _as_dict(status_payload.get("run_history"))
+    for goal in _as_list(run_history.get("goals")):
+        if not isinstance(goal, dict):
+            continue
+        for raw_agent in _as_list(_as_dict(goal.get("coordination")).get("registered_agents")):
+            add(goal.get("id"), raw_agent)
+    for todo in _iter_status_todos(status_payload):
+        if not _is_done(todo):
+            add(
+                todo.get("goal_id"),
+                _todo_agent_id(todo),
+                todo_id=normalize_todo_id(todo.get("todo_id")),
+            )
+    return goals
+
+
 def _agent_material_frontiers(
     status_payload: dict[str, Any],
 ) -> dict[tuple[str, str], dict[str, Any]]:
@@ -474,23 +517,29 @@ def _agent_state(
     *,
     current: dict[str, Any] | None = None,
     has_session_binding: bool = False,
-    last_activity_at: str | None = None,
+    execution: dict[str, Any] | None = None,
 ) -> str:
     """Derive the worker lifecycle state from existing facts only.
 
     The state is a projection over registry membership, todo claims,
-    session bindings, and activity timestamps.  It does not introduce a
-    second source of truth: every input is already owned by another
-    contract (registry, todo, session binding, or run history).
+    session bindings and execution facts.  It does not introduce a second
+    source of truth: every input is already owned by another contract
+    (registry, todo, session binding, Turn lane, delegation lock, lease).
 
     State priority (highest first):
     1. blocked      — current todo is blocked or a blocker
     2. monitoring / waiting — monitor-only or non-open current work
-    3. executing    — current open work updated within the activity threshold
-    4. bound        — has session binding and active todo
-    5. launchable   — has active todo, no session binding
-    6. addressable  — has session binding but no active todo
-    7. registered   — registered in registry, no binding or todo
+    3. executing    — the Turn lane is live or a delegation worker holds its lock
+    4. unknown      — the lane holder cannot be checked here (foreign host or
+                      unreadable record), or an active lease has expired while
+                      nothing is live; consumers fail closed on it
+    5. bo
```

**File**: `loopx/control_plane/quota/peer_orchestration.ts` (modified, +4/-0)
```diff
@@ -3,6 +3,10 @@ import type { JsonObject } from "../effect_program.ts";
 import { jsonObject, requireJsonObject } from "../runtime_decode.ts";
 
 type ActivationState = "ready" | "blocked";
+// Admission is an allow-list. `executing` is backed by a live Turn lane or
+// delegation worker; `bound`/`launchable` are durable work without a process.
+// `unknown` (holder on another host, unreadable record, expired lease with
+// nothing live) and every unlisted or missing state fail closed as not active.
 const activeStates = new Set(["running", "monitoring", "executing", "bound", "launchable"]);
 const rows = (value: unknown): JsonObject[] => Array.isArray(value)
   ? value.flatMap(item => { const row = jsonObject(item); return row ? [row] : []; }) : [];
```

---

### Incident Patch 8: `ba1e92d8` (2026-09-30)
**Commit Message**: fix(chat): verify intent before handoff and adopt model edits (#5341)

Adopt same-endpoint steward model edits at safe Turn boundaries with truthful App readback and shared fact-first intake guidance.

Preserve complete visible context during fresh startup and retain unedited model fields across restart, policy edits and explicit clear. Keep existing permissions, allocation and effect owners.

Signed-off-by: huangruiteng <14976749+huangruiteng@users.noreply.github.com>

**File**: `apps/presentation/dashboard/src/data/chat.ts` (modified, +4/-0)
```diff
@@ -115,6 +115,7 @@ export const managerChannelBindingSchema = z.object({
   executor_kind: z.string(),
   model: z.string(),
   model_source: z.string(),
+  reasoning_effort: z.string().optional(),
   selection_policy: z.enum(["preferred", "pinned", "flexible"]).default("preferred"),
   allocation_reason: z.string().default(""),
   configured_endpoint: z.string().nullable().optional(),
@@ -2022,6 +2023,9 @@ const larkTopicEventRejectionReasons = [
   "self_message",
   "invalid_routing_state",
   "not_addressed",
+  "historical_context_only",
+  "bot_message",
+  "human_identity_unverified",
 ] as const;
 export type LarkTopicEventRejectionReason = typeof larkTopicEventRejectionReasons[number];
 export type LarkPermissionGuidance = {
```

**File**: `apps/presentation/dashboard/src/features/personal-workspace/channel-header.tsx` (modified, +16/-6)
```diff
@@ -14,6 +14,7 @@ export function ChannelHeader({
   mobileNavigationOpen,
   onOpenGoalCapabilities,
   onOpenManagerChat,
+  onOpenManagerSettings,
   onRefresh,
   onOpenNavigation,
   onSelectGoalTab,
@@ -32,6 +33,7 @@ export function ChannelHeader({
   mobileNavigationOpen?: boolean;
   onOpenGoalCapabilities?: () => void;
   onOpenManagerChat?: () => void;
+  onOpenManagerSettings?: () => void;
   onRefresh?: () => void;
   onOpenNavigation?: () => void;
   onSelectGoalTab: (tab: WorkspaceGoalTab) => void;
@@ -131,6 +133,17 @@ export function ChannelHeader({
           />
         );
 
+  const executionChipClass = managerExecutionUnavailable
+    ? "personal-execution-chip is-unavailable" : "personal-execution-chip";
+  const executionChipContent = managerChannelBinding ? <>
+    <span className="personal-execution-chip-endpoint">{managerChannelBinding.executor_endpoint}</span>
+    {managerExecutionKindLabel ? <span className="personal-execution-chip-kind">{managerExecutionKindLabel}</span> : null}
+    <span className="personal-execution-chip-model">{managerChannelBinding.model}</span>
+    {managerChannelBinding.reasoning_effort ? <span className="personal-execution-chip-model">{managerChannelBinding.reasoning_effort}</span> : null}
+    {managerOutputTokenBudgetLabel ? <span className="personal-execution-chip-budget">{managerOutputTokenBudgetLabel}</span> : null}
+    {onOpenManagerSettings ? <SlidersHorizontal aria-hidden size={12} /> : null}
+  </> : null;
+
   return (
     <header className="personal-channel-header" data-goal-selected={Boolean(selectedGoal)}>
       <button aria-expanded={mobileNavigationOpen ?? false} aria-label={t("header.openGoalNavigation")} className="personal-icon-button personal-mobile-menu" onClick={onOpenNavigation} type="button"><Menu size={18} /></button>
@@ -139,12 +152,9 @@ export function ChannelHeader({
         {selectedGoal && !selectedGoal.loadState ? <p className="personal-channel-activity"><GoalActivityChip goal={selectedGoal} /></p> : null}
         {!selectedGoal && managerChannelBinding ? (
           <p className="personal-manager-execution">
-            <span className={managerExecutionUnavailable ? "personal-execution-chip is-unavailable" : "personal-execution-chip"}>
-              <span className="personal-execution-chip-endpoint">{managerChannelBinding.executor_endpoint}</span>
-              {managerExecutionKindLabel ? <span className="personal-execution-chip-kind">{managerExecutionKindLabel}</span> : null}
-              <span className="personal-execution-chip-model">{managerChannelBinding.model}</span>
-              {managerOutputTokenBudgetLabel ? <span className="personal-execution-chip-budget">{managerOutputTokenBudgetLabel}</span> : null}
-            </span>
+            {onOpenManagerSettings ? <button aria-label={t("header.managerModelSettings")} title={t("header.managerModelSettings")}
+              className={executionChipClass} onClick={onOpenManagerSettings} type="button">{executionChipContent}</button>
+              : <span className={executionChipClass}>{executionChipContent}</span>}
             {managerExecutionUnavailable ? (
               <span className="personal-execution-note">
                 {t(managerExecutionUnavailableKey, {
```

**File**: `apps/presentation/dashboard/src/features/personal-workspace/i18n.tsx` (modified, +18/-4)
```diff
@@ -408,6 +408,7 @@ const en = {
   "header.goalView": "Goal view",
   "header.live": "Live",
   "header.manager": "LoopX Manager",
+  "header.managerModelSettings": "Change steward model and reasoning effort",
   "header.managerDescription": "Your personal workspace across Goals",
   "header.managerRuntime": "{profile} · {sandbox}",
   "header.managerRuntimeFallback": "Configuration invalid; fell back to {profile} · {sandbox}. Repair it in Machine capabilities.",
@@ -533,11 +534,17 @@ const en = {
   "lark.groupLoading": "Reading groups joined by this bot…",
   "lark.groupSearch": "Search groups joined by this bot",
   "lark.historyPermission": "Group-history permission (separate capability)",
-  "lark.health.contextCaptured": "Group context captured",
-  "lark.health.contextCapturedDetail": "The message is retained as non-authoritative context. It did not start or steer a Manager turn; send a direct @ mention or verified reply when action is required.",
+  "lark.health.contextCaptured": "Latest message saved as context",
+  "lark.health.contextCapturedDetail": "This message did not start a task. Mention the steward or change When to respond to receive new group messages without @.",
+  "lark.health.directMessageEnabledDetail": "The latest message did not start a task. Replies without @ are now enabled; send a new task directly. Changing this setting does not automatically run older messages.",
+  "lark.health.historicalContextDetail": "Historical messages provide context and do not start tasks. Send a new task directly.",
+  "lark.health.botContextDetail": "Bot messages provide context and do not start tasks from other bots.",
+  "lark.health.senderUnverified": "Sender identity not verified",
+  "lark.health.senderUnverifiedDetail": "The message was saved, but no task started because its sender could not be verified. Check the Lark message event's sender information.",
   "lark.health.eventProcessed": "{events} events processed, {replies} replies sent.",
   "lark.health.eventUnverified": "Event subscription needs verification",
   "lark.health.eventUnverifiedDetail": "The provider listener is ready, but no event has arrived. Enable im.message.receive_v1 and group mention permissions, publish a new version, then send a new @ mention inside this Agent Topic. Group-level messages fail closed when multiple Agent routes exist.",
+  "lark.health.directEventUnverifiedDetail": "The listener is connected, but no new message has verified this route. Send a task directly in the group without @. If no event arrives, check im.message.receive_v1 and permission to receive all group messages.",
   "lark.health.ignoredSelf": "The bot’s own message was ignored to prevent duplicate replies.",
   "lark.health.invalidRouting": "Invalid routing configuration",
   "lark.health.invalidRoutingDetail": "The connection was safely disabled. Select a processing mode again and save.",
@@ -1580,6 +1587,7 @@ const zhCN: Record<WorkspaceMessageKey, string> = {
   "header.goalView": "Goal 视图",
   "header.live": "实时",
   "header.manager": "LoopX 管家",
+  "header.managerModelSettings": "调整管家模型与思考深度",
   "header.managerDescription": "跨 Goal 的个人工作入口",
   "header.managerRuntime": "{profile} · {sandbox}",
   "header.managerRuntimeFallback": "配置无效，已回退到 {profile} · {sandbox}；请在机器能力设置中修复。",
@@ -1705,11 +1713,17 @@ const zhCN: Record<WorkspaceMessageKey, string> = {
   "lark.groupLoading": "正在读取该机器人已加入的群…",
   "lark.groupSearch": "搜索该机器人已加入的群",
   "lark.historyPermission": "历史补读权限（独立能力）",
-  "lark.health.contextCaptured": "已捕获群聊上下文",
-  "lark.health.contextCapturedDetail": "该消息仅作为非权威上下文保留，不会启动或引导管家 Turn；需要执行时请直接 @ 机器人或回复机器人的消息。",
+  "lark.health.contextCaptured": "上条消息仅保存为上下文",
+  "lark.health.contextCapturedDetail": "该消息没有启动任务。可以 @ 管家，或在“何时回应”中开启群成员直接发消息、无需 @。",
+  "lark.health.directMessageEnabledDetail": "上条消息没有启动任务。免 @ 已开启，可直接发送新任务；改设置不会自动补跑旧消息。",
+  "lark.health.historicalContextDetail": "历史消息用于上下文，不会启动任务。请直接发送一条新任务。",
+  "lark.health.botContextDetail": "机器人消息仅用于上
```

**File**: `apps/presentation/dashboard/src/features/personal-workspace/lark-settings-page.tsx` (modified, +17/-7)
```diff
@@ -30,7 +30,7 @@ import {
   type LarkIngressMode,
   type LarkReplyMode,
 } from "../../data/chat";
-import { useWorkspaceI18n, type WorkspaceTranslate } from "./i18n";
+import { useWorkspaceI18n, type WorkspaceMessageKey, type WorkspaceTranslate } from "./i18n";
 import type { WorkspaceGoal } from "./personal-workspace-model";
 
 type Tab = "apps" | "connections";
@@ -95,16 +95,25 @@ function larkConnectionHealth(connection: LarkGoalConnection, t: WorkspaceTransl
     connection.last_event_status === "context_only_captured"
     || connection.last_event_status === "context_only_already_captured"
   ) {
+    const reason = connection.last_event_reason;
+    let detail: WorkspaceMessageKey = connection.turn_trigger === "human_messages"
+      ? "lark.health.directMessageEnabledDetail" : "lark.health.contextCapturedDetail";
+    switch (reason) {
+      case "historical_context_only": detail = "lark.health.historicalContextDetail"; break;
+      case "bot_message":
+      case "self_message": detail = "lark.health.botContextDetail"; break;
+      case "human_identity_unverified": detail = "lark.health.senderUnverifiedDetail"; break;
+    }
     return {
-      label: t("lark.health.contextCaptured"),
-      detail: t("lark.health.contextCapturedDetail"),
-      state: "ready",
+      label: t(reason === "human_identity_unverified" ? "lark.health.senderUnverified" : "lark.health.contextCaptured"),
+      detail: t(detail),
+      state: reason === "human_identity_unverified" ? "not_ready" : "ready",
     };
   }
   if (connection.last_event_status === "ignored" && connection.last_event_reason === "not_addressed") {
     return {
       label: t("lark.health.notAddressed"),
-      detail: t("lark.health.notAddressedDetail"),
+      detail: t(connection.turn_trigger === "human_messages" ? "lark.health.directMessageEnabledDetail" : "lark.health.notAddressedDetail"),
       state: "ready",
     };
   }
@@ -138,7 +147,8 @@ function larkConnectionHealth(connection: LarkGoalConnection, t: WorkspaceTransl
   if (connection.health_error_code === "lark_event_delivery_unverified" || connection.event_count === 0) {
     return {
       label: t("lark.health.eventUnverified"),
-      detail: t("lark.health.eventUnverifiedDetail"),
+      detail: t(connection.conversation_kind === "manager" && connection.turn_trigger === "human_messages"
+        ? "lark.health.directEventUnverifiedDetail" : "lark.health.eventUnverifiedDetail"),
       state: "unverified",
     };
   }
@@ -563,7 +573,7 @@ export function LarkSettingsPage({
                 <span>
                   <strong>{connection.chat_name}</strong>
                   <small>{connection.app_label} · {health.label}</small>
-                  <small>{health.detail}</small>
+                  <small className="personal-lark-health-detail">{health.detail}</small>
                   {health.state === "unverified" ? (
                     <a href="https://open.feishu.cn/document/server-docs/im-v1/message/events/receive?lang=zh-CN" rel="noreferrer" target="_blank"><ExternalLink size={12} />{t("lark.openEventSettings")}</a>
                   ) : null}
```

**File**: `apps/presentation/dashboard/src/features/personal-workspace/machine-configuration-settings.tsx` (modified, +3/-1)
```diff
@@ -102,7 +102,7 @@ function shortRevision(value: string | undefined) {
   return value.replace(/^sha256:/, "").slice(0, 12);
 }
 
-export function MachineConfigurationSettings({ section }: { section: "steward" | "other" }) {
+export function MachineConfigurationSettings({ section, onChanged }: { section: "steward" | "other"; onChanged?: () => void }) {
   const { locale, t } = useWorkspaceI18n();
   const [inspection, setInspection] = useState<MachineConfigurationInspection | null>(null);
   const [selectedCapabilityId, setSelectedCapabilityId] = useState("");
@@ -279,6 +279,7 @@ export function MachineConfigurationSettings({ section }: { section: "steward" |
       setNotice(result.status === "applied"
         ? t(operation === "remove" ? "machine.removed" : "machine.applied")
         : t("machine.unchanged"));
+      onChanged?.();
     } catch (cause) {
       setPreview(null);
       setPreviewOperation("upsert");
@@ -312,6 +313,7 @@ export function MachineConfigurationSettings({ section }: { section: "steward" |
       setPreview(null);
       await reload();
       setNotice(t("machine.rolledBack"));
+      onChanged?.();
     } catch (cause) {
       setRollbackPlan(null);
       setError(cause instanceof Error ? cause.message : t("machine.rollbackError"));
```

---

### Incident Patch 9: `b517dbd2` (2026-09-30)
**Commit Message**: fix(install): reject blocked entry targets before staging and migrations

Signed-off-by: huangruiteng <14976749+huangruiteng@users.noreply.github.com>

**File**: `examples/install-local-overwrite-smoke.py` (modified, +12/-1)
```diff
@@ -7,6 +7,7 @@
 import subprocess
 import sys
 import tempfile
+import time
 from pathlib import Path
 
 
@@ -40,14 +41,18 @@ def run_install(
     *,
     check: bool = True,
 ) -> subprocess.CompletedProcess[str]:
-    return subprocess.run(
+    print(f"install-local-overwrite-smoke: installing {release_id}", flush=True)
+    started = time.monotonic()
+    result = subprocess.run(
         [str(INSTALL_SCRIPT)],
         cwd=REPO_ROOT,
         env={**env, "LOOPX_RELEASE_ID": release_id},
         check=check,
         capture_output=True,
         text=True,
     )
+    print(f"install-local-overwrite-smoke: {release_id} in {time.monotonic() - started:.2f}s", flush=True)
+    return result
 
 
 def assert_loopx_link_points_to(wrapper: Path, release_id: str) -> None:
@@ -90,13 +95,19 @@ def assert_directory_is_not_overwritten() -> None:
         profile = home / ".zshrc"
         wrapper = bin_dir / "loopx"
         wrapper.mkdir(parents=True)
+        sentinel = wrapper / "user.txt"
+        sentinel.write_text("keep user content", encoding="utf-8")
 
         env = install_env(root, bin_dir, profile)
         failed = run_install(env, "directory-conflict", check=False)
         assert failed.returncode != 0, failed.stdout
         assert wrapper.is_dir(), wrapper
         assert "loopx installer error:" in failed.stderr, failed.stderr
         assert f"{wrapper} is a directory; remove it before installing" in failed.stderr, failed.stderr
+        assert sentinel.read_text(encoding="utf-8") == "keep user content"
+        assert not (home / ".local" / "share" / "loopx" / "releases").exists()
+        assert not (home / ".codex").exists()
+        assert not profile.exists()
 
 
 def main() -> int:
```

**File**: `scripts/install-local.sh` (modified, +23/-9)
```diff
@@ -321,15 +321,21 @@ disable_legacy_shim() {
   append_legacy_line "legacy command disabled: $disabled"
 }
 
+check_symlink_destination() {
+  local link="$1"
+  if [[ ! -L "$link" && -d "$link" ]]; then
+    echo "loopx installer error: $link is a directory; remove it before installing" >&2
+    return 1
+  fi
+}
+
 install_symlink() {
   local target="$1"
   local link="$2"
   local tmp="$link.tmp.$$"
+  # Repeat the check at replacement time in case a caller changed the path.
+  check_symlink_destination "$link" || return 1
   rm -f "$tmp"
-  if [[ ! -L "$link" && -d "$link" ]]; then
-    echo "loopx installer error: $link is a directory; remove it before installing" >&2
-    return 1
-  fi
   ln -s "$target" "$tmp"
   LOOPX_LINK_TMP="$tmp" LOOPX_LINK_TARGET="$link" "${LOOPX_PYTHON:-python3}" - <<'PY'
 import os
@@ -710,6 +716,19 @@ promote_default=0
 if resolve_default_promotion; then
   promote_default=1
 fi
+# Reject unusable entry targets before building candidates or upgrading data.
+# Canary-only installs must leave the default entry alone, even if it is a directory.
+if [[ "$promote_default" == "1" ]]; then
+  check_symlink_destination "$bin_dir/loopx"
+  check_symlink_destination "$bin_dir/loopx-apply-rrule"
+elif [[ "$install_canary" == "0" ]]; then
+  echo "loopx installer error: default promotion is guarded and LOOPX_INSTALL_CANARY=0 leaves no install target" >&2
+  echo "Set LOOPX_PROMOTE_DEFAULT=1 only after explicitly approving this checkout." >&2
+  exit 2
+fi
+if [[ "$install_canary" != "0" ]]; then
+  check_symlink_destination "$bin_dir/loopx-canary"
+fi
 if [[ "$promote_default" == "1" ]]; then
   # Preparing shared Chat assets is part of the guarded installation.
   mkdir -p "$releases_dir"
@@ -730,11 +749,6 @@ fi
 "${LOOPX_PYTHON:-python3}" "$repo_root/scripts/chat_bundle.py" "${chat_bundle_args[@]}"
 
 if [[ "$promote_default" == "0" ]]; then
-  if [[ "$install_canary" == "0" ]]; then
-    echo "loopx installer error: default promotion is guarded and LOOPX_INSTALL_CANARY=0 leaves no install target" >&2
-    echo "Set LOOPX_PROMOTE_DEFAULT=1 only after explicitly approving this checkout." >&2
-    exit 2
-  fi
   mkdir -p "$bin_dir"
   chmod +x "$repo_root/scripts/loopx"
   install_symlink "$repo_root/scripts/loopx" "$bin_dir/loopx-canary"
```

**File**: `tests/test_install_copy_fallback.py` (modified, +55/-0)
```diff
@@ -3,6 +3,61 @@
 import subprocess
 import sys
 
+import pytest
+
+
+def blocked_installer_fixture(tmp_path, name):
+    source = Path(__file__).parents[1] / "scripts/install-local.sh"
+    scripts = tmp_path / "checkout" / "scripts"
+    scripts.mkdir(parents=True)
+    installer = scripts / source.name
+    installer.write_bytes(source.read_bytes())
+    installer.chmod(0o755)
+    marker = tmp_path / "chat-build-started"
+    (scripts / "chat_bundle.py").write_text(
+        f"from pathlib import Path\nPath({str(marker)!r}).touch()\nraise SystemExit(71)\n"
+    )
+    home = tmp_path / "home"
+    blocked = home / ".local/bin" / name
+    blocked.mkdir(parents=True)
+    (blocked / "user.txt").write_text("preserve user directory")
+    runtime = home / ".codex/loopx"
+    runtime.mkdir(parents=True)
+    (runtime / "registry.global.json").write_text('{"goals": []}\n')
+    env = {**os.environ, "HOME": str(home), "CODEX_HOME": str(home / ".codex"),
+           "LOOPX_BIN_DIR": str(blocked.parent), "LOOPX_RELEASES_DIR": str(home / "releases"),
+           "LOOPX_PYTHON": sys.executable, "LOOPX_INSTALL_GUARD_HELD": "0"}
+    return installer, home, marker, env
+
+
+@pytest.mark.parametrize(
+    ("promote", "canary", "name"),
+    [("1", "0", "loopx"), ("1", "0", "loopx-apply-rrule"),
+     ("1", "1", "loopx-canary"), ("0", "1", "loopx-canary")],
+)
+def test_blocked_entry_target_fails_before_build_or_state_changes(tmp_path, promote, canary, name):
+    installer, home, marker, env = blocked_installer_fixture(tmp_path, name)
+    before = {str(path.relative_to(home)): path.read_bytes()
+              for path in home.rglob("*") if path.is_file()}
+    result = subprocess.run([str(installer)],
+        env={**env, "LOOPX_PROMOTE_DEFAULT": promote, "LOOPX_INSTALL_CANARY": canary},
+        capture_output=True, text=True, timeout=10)
+    assert result.returncode == 1, result.stderr
+    assert "is a directory; remove it before installing" in result.stderr
+    assert not marker.exists()
+    assert not (home / "releases").exists()
+    assert {str(path.relative_to(home)): path.read_bytes()
+            for path in home.rglob("*") if path.is_file()} == before
+
+
+def test_canary_only_does_not_reject_untouched_default_entry(tmp_path):
+    installer, _, marker, env = blocked_installer_fixture(tmp_path, "loopx")
+    result = subprocess.run([str(installer)],
+        env={**env, "LOOPX_PROMOTE_DEFAULT": "0", "LOOPX_INSTALL_CANARY": "1"},
+        capture_output=True, text=True, timeout=10)
+    assert result.returncode == 71, result.stderr
+    assert marker.exists()
+
 
 def test_clone_failure_discards_only_partial_staging_target(tmp_path):
     script = (Path(__file__).parents[1] / "scripts/install-local.sh").read_text()
```

---

### Incident Patch 10: `996bcc02` (2026-09-30)
**Commit Message**: fix(qualification): verify complete historical provider replay (#5326)

Signed-off-by: huangruiteng <14976749+huangruiteng@users.noreply.github.com>
Co-authored-by: huangruiteng <14976749+huangruiteng@users.noreply.github.com>

**File**: `docs/architecture/rfcs/ledger/shared-goal-authority-state-provider-v0/2026-09-28-retirement-cadence.md` (modified, +19/-3)
```diff
@@ -237,9 +237,25 @@ Scale characterization with 4,101 synthetic Agent Todos still hits the existing
 repair for File/SQLite. The repaired contract API can read that collection;
 this does not qualify the remaining whole-command payload boundary.
 
-The next B work remains history artifact lookup and remaining public payload/
-cold-path costs, preserving file-change freshness, full decision inputs and
-corruption rejection. Contract checks and attention now share one request-local, validated canonical
+The next B work is SQLite admission on a frozen source/runtime profile: rerun
+the existing reference capacity axes, reconcile concurrency/recovery/consumer-lag
+evidence, and verify the applicability of retained natural-time soak results.
+The comparison runner's former conflict expectation contradicted merged #5169:
+an identical historical intent must return its original applied revision/cursor.
+The runner now checks that result, independently rejects projection/event/receipt
+drift, and walks the complete history before and after retries without retaining
+all expected snapshots. A failing invariant prevents report publication; checks
+stay outside the unchanged timing windows. This repairs the qualification tool,
+not a provider defect or a D2/default pass. #4224 already reports a soak started
+on September 14 at `e98191faa`; its final result and applicability to the current
+candidate still need evidence. Do not call it unstarted or restart its clock
+solely because an unrelated source revision changed.
+
+Last-caller Python decision retirement can proceed independently where the TS
+replacement and affected real callers are proven. Whole Markdown writer removal
+still requires C's new-Goal/upgrade/recovery exits. Complete consumer metadata,
+freshness and decision inputs remain acceptance requirements. Contract checks
+and attention now share one request-local, validated canonical
 Todo snapshot per runtime/Goal. Standalone checks and subsequent requests read
 afresh; lease and projection-writeback reads do not participate. Consumer edits
 cannot mutate retained input, and a failed first read cannot recover midway
```

**File**: `docs/architecture/rfcs/ledger/shared-goal-authority-state-provider-v0/2026-09-28-retirement-cadence.zh-CN.md` (modified, +12/-2)
```diff
@@ -183,8 +183,18 @@ Todo 写入时的业务校验，也不重审完成／deferred 历史的授权。
 仍触及既有 `todo.succession.project` RPC 响应预算；修复后的合同 API 能读取该集合，
 不代表剩余整命令包体边界已完成验收。
 
-B 下一步仍是历史 artifact 查找和剩余公共包体／冷路径，保留文件变化 freshness、
-完整决策输入及损坏拒绝。合同检查与 attention 现在按 runtime／Goal 共享请求内已校验的完整
+B 下一步聚焦冻结 source／runtime profile 下的 SQLite 准入：重新跑已有 reference
+容量轴，对齐并发／恢复／consumer lag 证据，并核对保留的自然时间 soak 适用性。
+比较 runner 原先要求历史重试返回 conflict，与已合并 #5169 矛盾：相同完整意图应
+返回原 applied revision／cursor。现在核对原结果，分别拒绝 projection／event／receipt
+漂移，在重试前后分页验证全部历史，不保留所有预期快照。不变量失败就不发布成功
+报告；这些检查放在既有计时窗口之外。这修复的是验证工具，不代表 provider 故障、
+D2 通过或默认切换。#4224 已报告在 `e98191faa` 上于 9 月 14 日开始 soak，仍需最终
+结果及对当前候选的适用性证据，不能称为未开始，也不能仅因无关 source 修订就重启计时。
+
+已有 TS 替代且真实受影响调用方验证完成的 Python 重复决策，可以按最后调用方独立
+退役；整条 Markdown writer 删除仍需 C 的新 Goal／升级／恢复出口。消费者完整
+metadata、freshness 和决策输入继续验收。合同检查与 attention 现在按 runtime／Goal 共享请求内已校验的完整
 canonical Todo 快照。独立检查和下一次请求重新读取；租约与投影写回读取不参与。消费者修改
 不会污染保留输入，首次读取失败不会在请求中途恢复成功。这不代表 registry、Markdown、
 历史或多个 Goal 之间的原子快照。集成后继续核对安装态消费者，A/C 与 D2
```

**File**: `docs/reference/sqlite-authority-store.md` (modified, +9/-3)
```diff
@@ -85,9 +85,15 @@ node --experimental-sqlite --experimental-strip-types \
 ```
 
 The runner creates and removes its own temporary store, checks complete
-projections (including Todo metadata), original receipts and reopened state,
-and records the source revision, runtime, runner hash and tracked source diff
-hash. It does not open a selected live Goal. RSS includes fixture/checking
+projections (including Todo metadata), events, original receipts and reopened
+state, and records the source revision, runtime, runner hash and tracked source
+diff hash. After timing, it verifies that an exact historical retry returns the
+original applied revision/cursor, even after later commits; projection-, event-
+or receipt-only drift must conflict. The later head, original receipt and entire
+paged history must remain unchanged. `historical_replay_and_conflict_checks`
+is reported only after these checks pass; a failed check prevents a successful
+report. These are storage guarantees, not Goal-instance isolation or permission
+to repeat external effects. It does not open a selected live Goal. RSS includes fixture/checking
 allocations; File publication bytes are application bytes, not physical disk
 writes. Use the existing SQLite capacity runner for WAL traffic and D2 history
 sizes. Keep performance experiments separate from concurrent test suites.
```

**File**: `examples/coordination/local-provider-comparison.ts` (modified, +69/-11)
```diff
@@ -9,7 +9,8 @@ import {performance} from "node:perf_hooks";
 import {parseArgs} from "node:util";
 import {fileURLToPath} from "node:url";
 import type {JsonObject} from "../../loopx/control_plane/effect_program.ts";
-import type {AuthorityStore, AuthorityStoreCommit} from "../../loopx/control_plane/coordination/authority_store.ts";
+import type {AuthorityStore, AuthorityStoreCommit, AuthorityStoreCommitResult} from "../../loopx/control_plane/coordination/authority_store.ts";
+import {canonicalAuthorityBytes} from "../../loopx/control_plane/coordination/authority_store_codec.ts";
 import {FileAuthorityStore} from "../../loopx/control_plane/coordination/file_authority_store.ts";
 import {SqliteAuthorityStore} from "../../loopx/control_plane/coordination/sqlite_authority_store.ts";
 import {sqliteRuntimeIdentity} from "../../loopx/control_plane/coordination/sqlite_runtime.ts";
@@ -84,6 +85,9 @@ async function measure(root: string) {
   const finalProjection = projectionAt(count - 1);
   let revision: string | null = null;
   let first: AuthorityStoreCommit | undefined;
+  let firstResult: Extract<AuthorityStoreCommitResult, {status: "applied"}> | undefined;
+  const receiptsAt = (index: number) => [{operation_id: `op-${index}`, index,
+    metadata: {checked: true, labels: ["synthetic", "保留"]}}];
   let filePublicationBytes = 0;
   const fileBytes = (): number => readdirSync(root).reduce((sum, name) => sum + statSync(join(root, name)).size, 0);
   const timed = async <T>(action: () => Promise<T>, into: number[]): Promise<T> => {
@@ -93,11 +97,11 @@ async function measure(root: string) {
   for (let index = 0; index < count; index++) {
     const input: AuthorityStoreCommit = {expected_provider_revision: revision, operation_id: `op-${index}`,
       next_projection: projectionAt(index), events: [{kind: "observation", index}],
-      receipts: [{operation_id: `op-${index}`, index, metadata: {checked: true, labels: ["synthetic", "保留"]}}]};
+      receipts: receiptsAt(index)};
     const result = await timed(() => store.commitAuthority(input), commits);
     assert.equal(result.status, "applied"); if (result.status !== "applied") throw new Error("commit rejected");
     revision = result.provider_revision;
-    if (index === 0) first = input;
+    if (index === 0) { first = input; firstResult = result; }
     if (values.provider === "file") filePublicationBytes += statSync((store as FileAuthorityStore).path).size;
     if ((index + 1) % 128 === 0) process.stderr.write(`${values.provider} ${values.workload}: ${index + 1}/${count}\n`);
   }
@@ -109,6 +113,10 @@ async function measure(root: string) {
     const receiptIndex = Math.floor(index * (count - 1) / (samples - 1));
     const receipt = await timed(() => store.readReceipt(`op-${receiptIndex}`), reads);
     assert.equal(receipt.status, "found");
+    if (receipt.status === "found") {
+      assert.equal(receipt.cursor, String(receiptIndex + 1));
+      assert.deepEqual(receipt.receipts, receiptsAt(receiptIndex));
+    }
     const page = await timed(() => store.scanCommitted(String(count - 100), 100), scans);
     assert.equal(page.status, "page");
     if (page.status === "page") {
@@ -117,8 +125,8 @@ async function measure(root: string) {
         const ordinal = count - 100 + offset;
         assert.equal(row.operation_id, `op-${ordinal}`);
         assert.deepEqual(row.projection, projectionAt(ordinal));
-        assert.deepEqual(row.receipts, [{operation_id: `op-${ordinal}`, index: ordinal,
-          metadata: {checked: true, labels: ["synthetic", "保留"]}}]);
+        assert.deepEqual(row.events, [{kind: "observation", index: ordinal}]);
+        assert.deepEqual(row.receipts, receiptsAt(ordinal));
       }
     }
   }
@@ -132,13 +140,62 @@ async function measure(root: string) {
     cold.push(performance.now() - started); assert.equal(child.status, 0, child.stderr);
     assert.deepEqual(JSON.parse(child.stdout).head, finalProjection);
   }
-  const reopened = openStore(
```

**File**: `tests/control_plane_ts/local_provider_comparison.test.ts` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+import assert from "node:assert/strict";
+import {spawnSync} from "node:child_process";
+import {mkdir, mkdtemp, readFile, readdir, rm} from "node:fs/promises";
+import {tmpdir} from "node:os";
+import {join} from "node:path";
+import {fileURLToPath} from "node:url";
+import test from "node:test";
+
+for (const provider of ["file", "sqlite"]) {
+  test(`${provider} comparison verifies historical replay after later commits and cleans its store`,
+    {timeout: 120000}, async t => {
+      const directory = await mkdtemp(join(tmpdir(), "local-provider-report-"));
+      t.after(() => rm(directory, {recursive: true, force: true}));
+      const data = join(directory, "tmp"), output = join(directory, "report.json");
+      await mkdir(data);
+      const child = spawnSync(process.execPath, ["--no-warnings", "--experimental-sqlite", "--experimental-strip-types",
+        fileURLToPath(new URL("../../examples/coordination/local-provider-comparison.ts", import.meta.url)),
+        "--provider", provider, "--workload", "mixed", "--commits", "128", "--samples", "3", "--output", output],
+      {encoding: "utf8", timeout: 110000, env: {...process.env, TMPDIR: data, TMP: data, TEMP: data}});
+      assert.equal(child.status, 0, child.stderr);
+      const report = JSON.parse(await readFile(output, "utf8"));
+      assert.equal(report.provider, provider);
+      assert.equal(report.commits, 128);
+      assert.equal(report.complete_record_and_receipt_checks, "passed");
+      assert.equal(report.original_receipt_recovery_after_reopen, "passed");
+      assert.equal(report.historical_replay_and_conflict_checks, "passed");
+      assert.equal(report.warm_head.n, 3);
+      assert.deepEqual(await readdir(data), []);
+    });
+}
```

#### Recent Merged Pull Requests:
- **PR #5366** (2026-09-30): feat(telemetry): qualify usage diagnostics and installation return cohorts (@huangruiteng)
- **PR #5362** (2026-09-30): test(contract): keep the private-address regression fixture public-safe (@huangruiteng)
- **PR #5357** (2026-09-30): fix(workspace): separate full refresh from failed Goal recovery (@huangruiteng)
- **PR #5355** (2026-09-30): test: isolate Claude install qualification from usage telemetry (@huangruiteng)
- **PR #5352** (2026-09-30): fix(lark): render strong emphasis at punctuation boundaries (@huangruiteng)
- **PR #5350** (closed): refactor(public-safety): centralize compact identifier shapes (@BigDataDZ)
- **PR #5348** (2026-09-30): docs(rfc): distinguish lifecycle from delivery maturity (@cocolord)
- **PR #5346** (2026-09-30): docs: refresh scoped ecosystem adoption evidence (@huangruiteng)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

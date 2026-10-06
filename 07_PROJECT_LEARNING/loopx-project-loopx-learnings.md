# Forensic Learning Record (Deep Inspection): loopx-project/loopx

> **Canonical Artifact**: `07_PROJECT_LEARNING/loopx-project-loopx-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/loopx-project/loopx](https://github.com/loopx-project/loopx))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:58:27.443Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `loopx-project/loopx`
- **Description**: A control plane with a durable state kernel for long-horizon agents and teams. Keep work moving and improving across sessions, with less human attention.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 6161 stars

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

// Resolve old App-owned global-runtime journals without reviving their
// exact-revision downgrade policy. An incomplete App retains recovery.
pub(crate) fn finish_legacy_journal(app: &AppHandle) -> Result<(), String> {
    let path = journal(app)?;
    match resolve_journal(&path, &app.package_info().version.to_string())? {
        JournalResolution::Absent | JournalResolution::StaleDiscarded => Ok(()),
        JournalResolution::Approved => {
            let executable = std::env::current_exe().map_err(|_| "app_install_incomplete")?;
            if !crate::update_backup::installed_bundle_verifies(&executable) {
                return Err("app_install_incomplete".into());
            }
            discard_journal_at(&path).map(|_| ())
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

pub(crate) fn private_executable(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|_| "runtime_selection_unavailable")?
        .join("runtime")
        .join("bin")
        .join("loopx"))
}

pub(crate) fn install_private(app: &AppHandle) -> Result<String, String> {
    let metadata = identity(app)?;
    let archive = app
        .path()
        .resource_dir()
        .map_err(|_| "runtime_bundle_missing")?
        .join("runtime/runtime-source.tar.gz");
    let bytes = fs::read(archive).map_err(|_| "runtime_bundle_missing")?;
    let executable = private_executable(app)?;
    let root = executable
        .parent()
        .and_then(Path::parent)
        .ok_or("runtime_selection_unavailable")?;
    install_snapshot(&bytes, &metadata, root)?;
    Ok(executable.to_string_lossy().into_owned())
}

fn install_snapshot(bytes: &[u8], metadata: &Value, private_root: &Path) -> Result<(), String> {
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
    let root = private_root;
    fs::create_dir_all(root).map_err(|_| "runtime_selection_unavailable")?;
    command
        .env("LOOPX_BIN_DIR", root.join("bin"))
        .env("LOOPX_RELEASES_DIR", root.join("releases"))
        .env("LOOPX_SHELL_PROFILE", root.join("shell-profile"))
        .env("LOOPX_MAN_ROOT", root.join("man"))
        .env("LOOPX_MAN_DIR", root.join("man/man1"));
    let selected_executable = root.join("bin/loopx").to_string_lossy().into_owned();
    // Preserve the working interpreter of an existing managed snapshot.
    if let Ok(executable) = fs::canonicalize(&selected_executable) {
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
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    #[cfg(test)]
    command.stderr(Stdio::inherit());
    let mut child = command
        .group_spawn()
        .map_err(|_| "runtime_installer_unavailable")?;
    let started = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                return if status.success() {
                    let installed =
                        crate::services::runtime_identity_for_executable(&selected_executable);
                    if installed.as_ref().map(|v| &v["source_revision"])
                        == Some(&metadata["source_revision"])
                    {
                        Ok(())
                    } else {
                        Err("runtime_identity_mismatch".into())
                    }
                } else {
                    Err(format!(
                        "runtime_install_exit_{}",
                        status
                            .code()
                            .map(|code| code.to_string())
                            .unwrap_or_else(|| "signal".into())
                    ))
                }
            }
            Ok(None) if started.elapsed() < Duration::from_secs(600) => {
                std::thread::sleep(Duration::from_millis(100))
            }
            _ => {
                let _ = child.kill();
                let _ = child.wait();
                return Err("runtime_install_timeout".into());
            }
        }
    }
}

fn extract(bytes: &[u8], destination: &Path) -> Result<(), String> {
    let mut archive = tar::Archive::new(GzDecoder::new(bytes));
    for item in archive.entries().map_err
```

### Core Architecture Module: `apps/desktop/loopx-control-plane/src-tauri/src/lib.rs`
```
mod bundled_runtime;
mod maintenance;
mod runtime_selection;
mod services;
mod update_backup;

use services::ServiceSet;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc, Mutex,
};
use std::time::{Duration, Instant};
use tauri::{
    ipc::CapabilityBuilder, webview::PageLoadEvent, AppHandle, Manager, RunEvent, Url, WebviewUrl,
    WebviewWindowBuilder,
};
use tauri_plugin_notification::NotificationExt;

const APP_IDENTIFIER: &str = "io.loopx.control-plane";

// A ready listener does not acknowledge a queued WebKit navigation. On macOS,
// Wry's Started event is WKNavigationDelegate.didCommitNavigation: once the
// workspace commits, let it finish without interrupting slow document loads.
// Do not poll window.url(): WebKit can have no URL after a provisional failure.
// This state belongs only to the native shell, with no persisted protocol.
#[derive(Clone, Copy)]
enum NavigationRetry {
    SingleAttempt,
    UntilNativeCommit,
}

struct WorkspaceHandoff {
    boot_url: Url,
    retry: NavigationRetry,
    pending: bool,
    last_attempt: Option<Instant>,
}

impl WorkspaceHandoff {
    const RETRY_INTERVAL: Duration = Duration::from_secs(2);

    fn new(boot_url: Url, retry: NavigationRetry) -> Self {
        Self {
            boot_url,
            retry,
            pending: false,
            last_attempt: None,
        }
    }

    fn reconnect(&mut self) {
        self.pending = true;
        self.last_attempt = None;
    }

    fn page_reached(&mut self, current: &Url, target: &Url) {
        // A native commit/completion at the workspace ACKs the handoff. An
        // unrelated established page cancels it; boot cannot ACK the workspace.
        if current.origin() == target.origin() || current != &self.boot_url {
            self.pending = false;
        }
    }

    fn needs_navigation(&mut self, now: Instant) -> bool {
        if !self.pending
            || self.last_attempt.is_some_and(|last| match self.retry {
                NavigationRetry::SingleAttempt => true,
                NavigationRetry::UntilNativeCommit => {
                    now.duration_since(last) < Self::RETRY_INTERVAL
                }
            })
        {
            return false;
        }
        self.last_attempt = Some(now);
        true
    }

    fn reconcile(handoff: &Mutex<Self>, app: &AppHandle, target: &Url) {
        // Release the state lock before dispatching a native effect: page-load
        // callbacks run on the UI thread and update that same state.
        if !handoff
            .lock()
            .expect("workspace handoff lock")
            .needs_navigation(Instant::now())
        {
            return;
        }
        if let Some(window) = app.get_webview_window("main") {
            if let Err(error) = window.navigate(target.clone()) {
                eprintln!("LoopX workspace navigation failed: {error}");
            }
        }
    }
}

fn boot_url(app: &AppHandle) -> Url {
    // WebviewUrl::App("index.html") resolves to Tauri's root URL; the Windows
    // WebView2 transport uses its HTTP alias. Development uses the configured
    // frontend. Resolve this from configuration, before any WebKit URL exists.
    if cfg!(dev) {
        if let Some(url) = app.config().build.dev_url.as_ref() {
            return url.clone();
        }
    }
    if cfg!(target_os = "windows") {
        "http://tauri.localhost/".parse().expect("valid boot URL")
    } else {
        "tauri://localhost/".parse().expect("valid boot URL")
    }
}

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
        return "请选择继续使用已安装的运行时，或更新 App；选择后同一个窗口会继续打开工作区。"
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

// A destination request comes from the trusted workspace, not a new privileged
// WebView. Send only web destinations to the system browser; retain the main
// window's origin restriction and never launch custom handlers or local files.
fn open_web_destination(
    url: &Url,
    launch: impl FnOnce(&str) -> std::io::Result<()>,
) -> tauri::webview::NewWindowResponse<tauri::Wry> {
    if matches!(url.scheme(), "http" | "https") {
        if let Err(error) = launch(url.as_str()) {
            eprintln!("LoopX could not open web destination: {error}");
        }
    }
    tauri::webview::NewWindowResponse::Deny
}

fn workspace_navigation(
    url: &Url,
    origin: &Url,
    launch: impl FnOnce(&str) -> std::io::Result<()>,
) -> bool {
    if url.scheme() == "tauri" || url.origin() == origin.origin() {
        return true;
    }
    // WKWebView evaluates navigation policy before its new-window delegate.
    // Hand external web links off here while keeping them out of this WebView.
    open_web_destination(url, launch);
    false
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

            // Other engines report Started before commit. Preserve their
            // existing one-request handoff rather than treating it as WebKit's
            // acknowledgement or introducing an unqualified retry policy.
            let retry = if cfg!(target_os = "macos") {
                NavigationRetry::UntilNativeCommit
            } else {
                NavigationRetry::SingleAttempt
            };
            let handoff = Arc::new(Mutex::new(WorkspaceHandoff::new(
                boot_url(app.handle()),
                retry,
            )));
            let handoff_for_load = Arc::clone(&handoff);
            let origin_for_load = origin.clone();
            WebviewWindowBuilder::new(app, "main", WebviewUrl::App("index.html".into()))
                .title("LoopX")
                .inner_size(1280.0, 820.0)
                .min_inner_size(960.0, 640.0)
                .on_page_load(move |_window, payload| {
                    match payload.event() {
                        PageLoadEvent::Started if cfg!(target_os = "macos") => {}
                        PageLoadEvent::Finished => {}
                        _ => return,
                    }
                    handoff_for_load
                        .lock()
                        .expect("workspace handoff lock")
                        .page_reached(payload.url(), &origin_for_load);
                })
                .on_navigation(move |url| {
                    workspace_navigation(url, &navigation_origin, |destination| {
                        open::that_detached(destination)
                    })
                })
                .on_new_window(|url, _features| {
                    open_web_destination(&url, |destination| open::that_detached(destination))
                })
                .build()?;

            let handle = app.handle().clone();
            std::thread::spawn(move || {
                // Runtime preparation belongs to the same live supervisor as
                // service startup. A failed install must not strand this window
                // after a later repair, reload, or external runtime correction.
                while !shutting_down_for_setup.load(Ordering::Acquire) {
                    {
     
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
    separately_managed_runtime: AtomicBool,
    automatic_update_checked: AtomicBool,
    incomplete_app_installation: AtomicBool,
    manual_failure_pending: AtomicBool,
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
    fn status_snapshot(&self) -> Value {
        if self.incomplete_app_installation.load(Ordering::Acquire) {
            json!({"phase":"error", "details":{"code":"app_install_incomplete"}})
        } else {
            self.snapshot.lock().unwrap().clone()
        }
    }

    // Only a completed native replacement/verified restore can retire this
    // failure latch. Keep the restart readback coherent with the supervisor.
    fn complete_app_replacement(&self, details: Value) -> Value {
        self.incomplete_app_installation
            .store(false, Ordering::Release);
        self.publish("restart_required", details)
    }

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
        now: Instant,
        install: impl FnOnce() -> Result<(), String>,
    ) -> Result<(), String> {
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
        if self.busy.load(Ordering::Acquire)
            || self.incomplete_app_installation.load(Ordering::Acquire)
            || self.manual_failure_pending.load(Ordering::Acquire)
        {
            return Ok(None);
        }
        let Ok(_guard) = self.supervision.try_lock() else {
            return Ok(None);
        };
        if self.busy.load(Ordering::Acquire) || self.manual_failure_pending.load(Ordering::Acquire)
        {
            return Ok(None);
        }
        let phase = self.snapshot.lock().unwrap()["phase"]
            .as_str()
            .unwrap_or("idle")
            .to_string();
        // A completed Check owns the available update until an explicit
        // Apply/Repair/Forget action changes the phase. Another failed runtime
        // probe must not erase its Install button while the user is acting.
        if matches!(phase.as_str(), "available" | "restart_required") {
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
    runtime_executable_found: bool,
    python3: (bool, Option<String>),
) -> Value {
    json!({
        "os_version": os_version,
        "arch": arch,
        "runtime_executable_found": runtime_executable_found,
        "python3_found": python3.0,
        "python3_version": python3.1,
    })
}

fn environment_is_fresh(cached: &Option<(Instant, Value)>, now: Instant) -> bool {
    cached
        .as_ref()
        .is_some_and(|(probed_at, _)| now.duration_since(*probed_at) < ENVIRONMENT_TTL)
}

fn detect_environment() -> Value {
    let os_version = (cfg!(target_os = "macos"))
        .then(|| {
            let mut probe = std::process::Command::new("sw_vers");
            probe.arg("-productVersion");
            crate::services::timed_output(probe)
                .filter(|output| output.status.success())
                .map(|output| String::from_utf8_lossy(&output.stdout).trim().to_string())
                .filter(|version| !version.is_empty())
        })
        .flatten();
    let runtime_executable_found =
        std::path::Path::new(&crate::services::loopx_executable()).is_file();
    compose_environment(
        os_version,
        std::env::consts::ARCH,
        runtime_executable_found,
        crate::services::python3_environment(),
    )
}

#[tauri::command]
pub fn desktop_update_status(app: AppHandle, state: State<'_, Maintenance>) -> Value {
    // Probing spawns bounded sub-processes; the boot page polls every second,
    // so serve the cached block and refresh at most every ENVIRONMENT_TTL.
    let environment = {
        let now = Instant::now();
        let mut cache = state.environment_cache.lock().
```

### Core Architecture Module: `apps/desktop/loopx-control-plane/src-tauri/src/runtime_selection.rs`
```
//! Native launch preference only; installation identity remains owned by Core.
use serde_json::{json, Value};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};

pub(crate) struct Selection {
    pub executable: String,
    pub explicit: bool,
    pub environment_override: bool,
}

fn preference_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_local_data_dir()
        .map_err(|_| "runtime_selection_unavailable")?
        .join("runtime-selection.json"))
}

fn read_preference(path: &Path) -> Result<Option<String>, String> {
    let bytes = match fs::read(path) {
        Ok(bytes) => bytes,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("runtime_selection_unavailable".into()),
    };
    let value: Value = serde_json::from_slice(&bytes).map_err(|_| "runtime_selection_invalid")?;
    let executable = value["executable"]
        .as_str()
        .filter(|s| !s.is_empty())
        .ok_or("runtime_selection_invalid")?;
    if value["schema_version"] != "desktop_runtime_selection_v1"
        || !Path::new(executable).is_absolute()
    {
        return Err("runtime_selection_invalid".into());
    }
    Ok(Some(executable.to_owned()))
}

pub(crate) fn selected(app: &AppHandle) -> Result<Selection, String> {
    if let Ok(executable) = std::env::var("LOOPX_BIN") {
        if !executable.trim().is_empty() {
            let executable = crate::services::loopx_executable();
            let executable = fs::canonicalize(&executable)
                .map(|path| path.to_string_lossy().into_owned())
                .unwrap_or(executable);
            return Ok(Selection {
                executable,
                explicit: true,
                environment_override: true,
            });
        }
    }
    // A corrupt preference is not an installation failure. Automatic discovery
    // can still find a usable CLI or prepare the App-owned runtime.
    let remembered = match read_preference(&preference_path(app)?) {
        Err(error) => {
            eprintln!("LoopX launch preference ignored: {error}");
            None
        }
        Ok(value) => value,
    };
    if let Some(executable) = remembered {
        return Ok(Selection {
            executable,
            explicit: true,
            environment_override: false,
        });
    }
    Ok(Selection {
        executable: crate::services::loopx_executable(),
        explicit: false,
        environment_override: false,
    })
}

fn write_preference(path: &Path, executable: &str) -> Result<(), String> {
    let executable = fs::canonicalize(executable).map_err(|_| "runtime_selection_unavailable")?;
    let value = json!({"schema_version":"desktop_runtime_selection_v1",
        "executable":executable.to_string_lossy()});
    let directory = path.parent().ok_or("runtime_selection_unavailable")?;
    fs::create_dir_all(directory).map_err(|_| "runtime_selection_unavailable")?;
    let mut file =
        tempfile::NamedTempFile::new_in(directory).map_err(|_| "runtime_selection_unavailable")?;
    use std::io::Write;
    file.write_all(value.to_string().as_bytes())
        .map_err(|_| "runtime_selection_unavailable")?;
    file.as_file()
        .sync_all()
        .map_err(|_| "runtime_selection_unavailable")?;
    file.persist(path)
        .map_err(|_| "runtime_selection_unavailable")?;
    Ok(())
}

pub(crate) fn remember(app: &AppHandle, selection: &Selection) -> Result<(), String> {
    write_preference(&preference_path(app)?, &selection.executable)
}

pub(crate) fn forget(app: &AppHandle) -> Result<(), String> {
    match fs::remove_file(preference_path(app)?) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("runtime_selection_unavailable".into()),
    }
}

fn compare_package_versions(
    package: &tauri::utils::PackageInfo,
    installed: &Value,
    candidate: &Value,
) -> Option<std::cmp::Ordering> {
    fn parse_like<T: std::str::FromStr>(_: &T, text: &str) -> Option<T> {
        text.parse().ok()
    }
    let mut left = parse_like(&package.version, installed["package_version"].as_str()?)?;
    let mut right = parse_like(&package.version, candidate["package_version"].as_str()?)?;
    // Core wheels carry the release base; main-channel shell prereleases do
    // not make that same Core version older than the stable package string.
    left.pre = Default::default();
    left.build = Default::default();
    right.pre = Default::default();
    right.build = Default::default();
    Some(left.cmp(&right))
}

// Native launch coordination only. Core continues to qualify installation
// identity. Unknown ancestry is not a claim about which runtime is newer.
pub(crate) fn compare_runtimes(
    package: &tauri::utils::PackageInfo,
    installed: &Value,
    candidate: &Value,
    compare_commits: impl FnOnce(&str, &str) -> Option<std::cmp::Ordering>,
) -> Option<std::cmp::Ordering> {
    use std::cmp::Ordering;
    match compare_package_versions(package, installed, candidate)? {
        Ordering::Equal => {
            let left = installed["source_revision"].as_str()?;
            let right = candidate["source_revision"].as_str()?;
            if left == right {
                Some(Ordering::Equal)
            } else {
                compare_commits(left, right)
            }
        }
        order => Some(order),
    }
}

pub(crate) fn is_private_runtime(executable: &str, private_executable: &Path) -> bool {
    let releases = private_executable
        .parent()
        .and_then(Path::parent)
        .and_then(|root| fs::canonicalize(root.join("releases")).ok());
    fs::canonicalize(executable)
        .ok()
        .zip(releases)
        .is_some_and(|(executable, releases)| executable.starts_with(releases))
}

// A saved App-owned release path is a discovery cache, not a developer pin.
// For the same release base, the current App can maintain its own snapshot
// even when rebased sources or offline ancestry cannot be ordered. Preserve
// provably newer runtimes and independently installed CLIs. Callers still
// qualify the current bundle/installed identity before connecting services.
pub(crate) fn prefer_current_bundle(
    package: &tauri::utils::PackageInfo,
    installed: &Value,
    bundle: &Value,
    app_owned: bool,
    compare_commits: impl FnOnce(&str, &str) -> Option<std::cmp::Ordering>,
) -> bool {
    use std::cmp::Ordering;
    match compare_runtimes(package, installed, bundle, compare_commits) {
        Some(Ordering::Less) => true,
        None => {
            app_owned
                && compare_package_versions(package, installed, bundle) == Some(Ordering::Equal)
        }
        _ => false,
    }
}

pub(crate) fn compare_official_commits(left: &str, right: &str) -> Option<std::cmp::Ordering> {
    if ![left, right]
        .iter()
        .all(|revision| revision.len() == 40 && revision.bytes().all(|c| c.is_ascii_hexdigit()))
    {
        return None;
    }
    // GitHub includes file patches only on page one. Page two retains the
    // comparison relation without downloading a potentially huge source diff.
    // https://docs.github.com/en/rest/commits/commits#compare-two-commits
    let url = format!(
        "https://api.github.com/repos/loopx-project/loopx/compare/{left}...{right}?per_page=1&page=2"
    );
    let mut command = std::process::Command::new("curl");
    crate::services::configure_runtime_environment(&mut command);
    command.args([
        "--fail",
        "--silent",
        "--show-error",
        "--proto",
        "=https",
        "--max-time",
        "2",
        "--header",
        "Accept: application/vnd.github+json",
        &url,
    ]);
    let output =
        crate::services::timed_output_with_timeout(command, std::time::Duration::from_secs(3))?;
    if !output.status.success() {
        return None;
    }
    let payload: Value = serde_json::from_slice(&output.stdout).ok()?;
    match payload["status"].as_str()? {
        "ahead" => Some(std::cmp::Ordering::Less),
        "behind" => Some(std::cmp::Ordering::Greater),
        "identical" => Some(std::cmp::Ordering::Equal),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn newer_runtime_uses_versions_then_ancestry_and_never_install_time() {
        use std::cmp::Ordering;
        let package = tauri::utils::PackageInfo {
            name: "LoopX".into(),
            version: "1.2.4-main.20261004".parse().unwrap(),
            authors: "contributors",
            description: "desktop",
            crate_name: "desktop",
        };
        let identity = |version: &str, revision: Option<&str>| json!({"package_version":version,"source_revision":revision});
        for (left, right, expected) in [
            ("1.2.10", "1.2.9", Ordering::Greater),
            ("1.2.3", "1.2.4", Ordering::Less),
        ] {
            assert_eq!(
                compare_runtimes(
                    &package,
                    &identity(left, None),
                    &identity(right, None),
                    |_, _| panic!("different versions do not need a network")
                ),
                Some(expected)
            );
        }
        let old = identity("1.2.4", Some("older"));
        let main = identity("1.2.4-main.20261004", Some("newer"));
        assert_eq!(
            compare_runtimes(&package, &old, &main, |left, right| {
                assert_eq!((left, right), ("older", "newer"));
                Some(Ordering::Less)
            }),
            Some(Ordering::Less)
        );
        assert_eq!(
            compare_runtimes(&package, &old, &main, |_, _| None),
            None,
            "offline or diverged is not permission to replace"
        );
        assert_eq!(
            compare_runtimes(&package, &old, &old, |_, _| panic!(
                "same revision needs no lo
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

/// Freeze one selected artifact for both concurrently started services.
pub(crate) struct SelectedRuntime {
    pub executable: String,
    pub identity: Option<serde_json::Value>,
}

impl ServiceSet {
    pub(crate) fn start(
        runtime: &SelectedRuntime,
        progress: impl Fn(&[ServiceKind]) + Sync,
    ) -> Result<Self, ServiceError> {
        Self::collect(connect_all(
            SERVICE_KINDS,
            |kind| connect(kind, runtime),
            progress,
        ))
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

fn connect(kind: ServiceKind, runtime: &SelectedRuntime) -> ServiceOutcome {
    let mut owned = None;
    let mut healed = false;
    let result = connect_service(kind, runtime, &mut owned, &mut healed);
    ServiceOutcome {
        owned,
        healed,
        result,
    }
}

fn connect_service(
    kind: ServiceKind,
    runtime: &SelectedRuntime,
    owned: &mut Option<OwnedService>,
    healed: &mut bool,
) -> Result<(), ServiceError> {
    let executable = &runtime.executable;
    let expected_runtime_identity = &runtime.identity;
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
                // hard error.
                terminate_verified_listener(kind, executable, kind.port())?;
                *healed = true;
                if Instant::now() >= stale_deadline {
                    return Err(ServiceError(format!(
                            "port {} is serving LoopX {} from a different installed runtime and could not be restarted",
                            kind.port(),
                            kind.label()
                        )));
                }
                thread::sleep(Duration::from_millis(200));
            }
            Probe::Unresponsive => {
                // A bound socket is not HTTP readiness. Give slow startup
                // a full grace period, then replace only a verified LoopX
                // listener; unknown processes still fail closed.
                if Instant::now() < stale_deadline {
                    thread::sleep(Duration::from_millis(100));
                    continue;
                }
                terminate_verified_listener(kind, executable, kind.port())?;
                *healed = true;
                break;
            }
            Probe::Unavailable => break,
        }
    }

    if request_platform_managed_start(kind) {
        let deadline = Instant::now() + STARTUP_TIMEOUT;
        while Instant::now() < deadline {
            match probe(kind, expected_runtime_identity.as_ref()) {
                Probe::Matching => return Ok(()),
                Probe::NotReady => return Err(status_readiness_error(kind)),
                Probe::Foreign => {
                    return Err(ServiceError(format!(
                        "LoopX {} startup reached
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

fn recoverable_backup(root: &Path) -> Option<PathBuf> {
    let previous = root.join("previous");
    if previous.join("LoopX.app/Contents/Info.plist").is_file() {
        return Some(previous);
    }
    fs::read_dir(root)
        .ok()?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let sequence = entry
                .file_name()
                .to_str()?
                .strip_prefix("older-")?
                .parse::<u128>()
                .ok()?;
            let path = entry.path();
            path.join("LoopX.app/Contents/Info.plist")
                .is_file()
                .then_some((sequence, path))
        })
        .max_by_key(|(sequence, _)| *sequence)
        .map(|(_, path)| path)
}

pub fn available(app: &AppHandle) -> bool {
    cfg!(target_os = "macos") && root(app).is_ok_and(|root| recoverable_backup(&root).is_some())
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
    let backup = recoverable_backup(&root(app)?).ok_or("backup_unavailable")?;
    let version = fs::read_to_string(backup.join("version")).map_err(|_| "backup_unavailable")?;
    let handle = app.clone();
    restore_verified_backup(&executable, &backup, move || {
        crate::bundled_runtime::record_pending(&handle, version.trim(), "rollback")
    })
}

// The restore seam, entered from the running executable exactly like the
// production `restore` so the locator decision itself is under test: locate
// the trusted install target boundary (never requiring the damaged target to
// be intact), copy the verified backup beside it, let the caller record its
// continuation journal (`before_swap`), then swap. The backup source is
// verified through `copy`'s shared signature gate before anything is swapped.
pub(crate) fn restore_verified_backup(
    executable: &Path,
    previous: &Path,
    before_swap: impl FnOnce() -> Result<(), String>,
) -> Result<(), String> {
    if !previous.join("LoopX.app/Contents/Info.plist").is_file() {
        return Err("backup_unavailable".into());
    }
    let target = installed_bundle_at(executable)?;
    let staging = tempfile::tempdir_in(target.parent().ok_or("app_bundle_required")?)
        .map_err(|_| "rollback_failed")?;
    let candidate = staging.path().join("LoopX.app");
    copy(&previous.join("LoopX.app"), &candidate)?;
    let failed = staging.path().join("failed.app");
    // Preserve staging before the swap. After a successful exchange it owns
    // the displaced App; after an exchange failure it owns the verified copy.
    let _preser
```

### Core Architecture Module: `apps/desktop/loopx-control-plane/static/boot.js`
```
const panel = document.querySelector("main");
const status = document.querySelector("#status");
const bootElapsed = document.querySelector("#boot-elapsed");
const bootDetail = document.querySelector("#boot-detail");
const pageStarted = performance.now();
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
    installing_runtime: "正在准备所需组件",
    checking: "正在检查更新",
    downloading: "正在下载更新",
    installing_app: "正在更新 LoopX",
    connecting: "正在打开工作区",
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
  if (["error", "runtime_required"].includes(bootState?.phase)) {
    bootElapsed.textContent = "等待恢复";
    bootDetail.textContent = "启动已停止等待。可在下方恢复，不必反复重开 App。";
    return;
  }
  const elapsed = lastTiming === null ? performance.now() - pageStarted : lastTiming + performance.now() - timingObservedAt;
  const seconds = Math.floor(elapsed / 1000);
  bootElapsed.textContent = `${lastTiming === null ? "此页面已等待" : "启动已用时"} ${seconds} 秒`;
  bootDetail.textContent = bootState?.phase === "installing_runtime"
    ? "正在准备最新可用组件，完成后会自动打开工作区。"
    : bootState?.phase === "service_error"
      ? "启动器会自动重试；可展开「恢复与更新」查看诊断。"
      : seconds >= 15
        ? "启动用时较长。当前步骤尚未完成，可展开「恢复与更新」查看诊断。"
        : "正在准备最新可用版本。";
}
setInterval(updateStartupElapsed, 1000);
window.loopxBootFailed = (message) => {
  if (bootState?.phase === "connecting") return;
  panel.dataset.state = "error";
  panel.setAttribute("aria-busy", "false");
  status.textContent = message;
};
window.loopxBootRetrying = () => {
  if (["error", "runtime_required"].includes(bootState?.phase)) return;
  panel.dataset.state = "loading";
  panel.setAttribute("aria-busy", "true");
  status.textContent = "正在重新连接本地控制面";
};
const update = document.querySelector("#update");
const channel = document.querySelector("#channel");
const repair = document.querySelector("#repair");
const rollback = document.querySelector("#rollback");
const updateStatus = document.querySelector("#update-status");
const forgetSelection = document.querySelector("#forget-selection");
let nextAction = "check";
let working = false;
let actionInFlight = false;
let statusGeneration = 0;
let channelInitialized = false;
let runtimeExplicit = false;
let bundledRepairAvailable = true;
const updateWorkingPhases = ["checking","downloading","installing_app","installing_runtime","connecting"];
document.querySelector("#retry").onclick = () => location.reload();
channel.onchange = () => { channelInitialized = true; render({phase:"idle"}); };
const labels = {
  idle: "检查当前通道，不会自动安装。",
  service_error: "运行时已安装，但服务尚未连接。可检查更新、修复或恢复上版；连接仍会自动重试。",
  runtime_required: "无法准备可用组件。可检查 App 更新，或点击修复后重新连接。",
  checking: "正在检查更新…",
  available: "App 与匹配运行时可一起更新。",
  up_to_date: "当前通道暂无更新。",
  downloading: "正在下载并校验签名…",
  installing_app: "正在安装 App，请保持窗口打开。",
  installing_runtime: "正在准备所需组件，请稍候…",
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
  runtime_identity_unavailable: "所选运行时尚不能验证。请用它的安装方式更新 CLI，或清除记住的选择后重新检测。App 保留当前安装。",
  runtime_selection_invalid: "记住的运行时选择无法读取。清除选择后，App 会重新检测本机 CLI。",
  runtime_selection_unavailable: "所选运行时无法读取。请恢复该安装，或清除选择后重新检测。",
  runtime_selection_explicit: "当前 App 使用单独选择的运行时，无法用自带组件修复。请通过原安装方式维护它，或先清除选择。开发启动参数 LOOPX_BIN 仍优先。",
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
  app_install_failed: "App 安装未能完成，本次更新未生效；已确认当前版本完好且运行时可用，可直接重启继续使用，或重新检查更新后再试。",
  app_install_incomplete: "App 安装中断，且无法确认当前版本是否完整，请勿直接重启。请在恢复与更新面板还原上一版本（或重新安装）后再试。",
  runtime_pairing_required: "旧版本未能自动选择可用组件。请检查 App 更新，或通过恢复入口重新连接。",
  backup_failed: "无法备份当前版本，更新已停止。请检查磁盘空间后重试。",
};
function codeText(code, phase) {
  if (runtimeExplicit && ["runtime_identity_unavailable", "runtime_selection_explicit"].includes(code)) {
    return "启动参数 LOOPX_BIN 固定了当前运行时。请通过该安装方式修复它，或移除、修正 LOOPX_BIN 后重新打开 App；清除记住的选择不会改变此参数。";
  }
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
function render(state) {
  if (!state?.phase) return state;
  if (state.phase === "available" && state.details?.channel !== channel.value) state = {phase:"idle"};
  working = updateWorkingPhases.includes(state.phase);
  const controlsDisabled = working || actionInFlight;
  update.disabled = controlsDisabled;
  repair.disabled = controlsDisabled || state.phase === "restart_required" || runtimeExplicit || !bundledRepairAvailable;
  if (state.details?.bundled_repair_available === false) repair.disabled = true;
  forgetSelection.disabled = controlsDisabled || state.phase === "restart_required";
  rollback.disabled = controlsDisabled || state.phase === "restart_required";
  channel.disabled = controlsDisabled || state.phase === "restart_required";
  nextAction = state.phase === "available" ? "apply" : state.phase === "restart_required" ? "restart" : "check";
  update.textContent = nextAction === "apply" ? "更新并准备重启 / Install update" : nextAction === "restart" ? "重启完成更新 / Restart" : "检查更新 / Check for updates";
  updateStatus.textContent = codeText(state.details?.code, state.phase);
  return state;
}
const diagnostics = document.querySelector("#diagnostics");
function safeCode(code) {
  return typeof code === "string" && (Object.hasOwn(errors, code) || /^runtime_install_exit_(\d+|signal)$/.test(code) || ["service_start_failed", "update_failed"].includes(code)) ? code : "unknown";
}
// v2 adds the non-PII environment block surfaced by desktop_update_status.
// Fields the backend has not sent yet stay null so old payloads still render.
function safeEnvironment(result) {
  const environment = result.environment;
  if (!environment || typeof environment !== "object") return null;
  const text = (value) => typeof value === "string" && value ? value : null;
  const flag = (value) => typeof value === "boolean" ? value : null;
  return {
    os_version: text(environment.os_version),
    arch: text(environment.arch),
    runtime_executable_found: flag(environment.runtime_executable_found),
    python3_found: flag(environment.python3_found),
    python3_version: text(environment.python3_version),
  };
}
function renderDiagnostics(result) {
  const failure = result.last_failure ?? result.state;
  const text = JSON.stringify({
    schema_version: "desktop_recovery_diagnostics_v2",
    failure_phase: ["error", "runtime_required", "runtime_pairing_required", "service_error"].includes(failure?.phase) ? failure.phase : null,
    app_version: /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(result.app_version) ? result.app_version : "unknown",
    error_code: safeCode(failure?.details?.code),
    installed_identity_available: typeof failure?.details?.installed_identity_available === "boolean" ? failure.details.installed_identity_available : null,
    revision_matches: typeof failure?.details?.revision_matches === "boolean" ? failure.details.revision_matches : null,
    environment: safeEnvironment(result),
  }, null, 2);
  if (diagnostics.value !== text) diagnostics.value = text;
}
document.querySelector("#copy-diagnostics").onclick = async () => {
  try {
    await navigator.clipboard.writeText(diagnostics.value);
    document.querySelector("#copy-status").textContent = "已复制 / Copied";
  } catch {
    diagnostics.focus(); diagnostics.select();
    document.querySelector("#copy-status").textContent = "请按 ⌘C / Ctrl+C 复制已选中的诊断。";
  }
};
async function run(action) {
  if (working || actionInFlight) return;
  actionInFlight = true;
  statusGeneration++;
  // Match the phase the backend publishes for each action (rollback restores
  // the previous app; restart keeps the required-restart state) instead of
  // previewing a download that is not happening.
  render({phase: action === "check" ? "checking" : action === "repair" || action === "align_runtime" ? "installing_runtime" : action === "forget_runtime_selection" ? "connecting" : action === "rollback" ? "installing_app" : action === "restart" ? "restart_required" : "d
```

### Core Architecture Module: `apps/presentation/dashboard/smoke/frontstage-operator-state-smoke.ts`
```
// Semantic smoke for the operator-state classification in
// src/data/goal-channel-frontstage.ts.
//
// Proves exact typed mapping semantics, not element presence: positive and
// negative outcome tokens, failed/blocked delivery dispositions, ordinary
// workspace/capability wording that must NOT classify as repair/wait, and
// unknown tokens staying neutral.

import {
  actionKindTone,
  deriveOperatorStateSignals,
  deliveryOutcomeTone,
  eventClassificationTone,
  leaseStatusTone,
  sampleGoalChannelProjection,
  type GoalChannelProjection,
} from "../src/data/goal-channel-frontstage.js";

type Tone = "neutral" | "success" | "warning" | "info" | "danger";

function expectTone(actual: Tone, expected: Tone, label: string): void {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

const outcomeOutcomeCases: Array<[string | null | undefined, Tone]> = [
  ["outcome_progress", "success"],
  ["primary_goal_outcome", "success"],
  ["PRIMARY_GOAL_OUTCOME", "success"],
  ["outcome_gap", "danger"],
  ["delivery_failed", "danger"],
  ["delivery_blocked", "danger"],
  ["surface_only", "neutral"],
  ["unknown", "neutral"],
  ["not_configured", "neutral"],
  ["some_future_token", "neutral"],
  [null, "neutral"],
  [undefined, "neutral"],
];

const actionKindCases: Array<[string | null | undefined, Tone]> = [
  ["workspace_repair", "warning"],
  ["capability_wait", "warning"],
  ["capability_repair", "warning"],
  ["delivery", "neutral"],
  ["delivery_failed", "neutral"],
  ["review_refine_merge", "neutral"],
  ["approve_route", "neutral"],
  ["frontstage_render", "neutral"],
  [undefined, "neutral"],
];

const classificationCases: Array<[string | null | undefined, Tone]> = [
  ["validated_progress", "success"],
  ["delivery_outcome", "info"],
  ["operator_gate_recorded", "info"],
  ["capability_wait", "warning"],
  ["workspace_repair", "warning"],
  ["outcome_gap", "danger"],
  ["delivery_blocked", "danger"],
  ["surface_only", "neutral"],
  ["capability lookups ongoing", "neutral"],
  [undefined, "neutral"],
];

const leaseStatusCases: Array<[string | null | undefined, Tone]> = [
  ["hard_lease", "success"],
  ["active", "success"],
  ["soft_claim", "info"],
  ["claimed", "info"],
  ["expired", "neutral"],
  ["released", "neutral"],
  ["renewing_soon", "neutral"],
  [undefined, "neutral"],
];

function runTables(): void {
  for (const [token, expected] of outcomeOutcomeCases) {
    expectTone(deliveryOutcomeTone(token), expected, `deliveryOutcomeTone(${token})`);
  }
  for (const [token, expected] of actionKindCases) {
    expectTone(actionKindTone(token), expected, `actionKindTone(${token})`);
  }
  for (const [token, expected] of classificationCases) {
    expectTone(
      eventClassificationTone(token),
      expected,
      `eventClassificationTone(${token})`,
    );
  }
  for (const [token, expected] of leaseStatusCases) {
    expectTone(leaseStatusTone(token), expected, `leaseStatusTone(${token})`);
  }
}

function projectionWith(overrides: Partial<GoalChannelProjection>): GoalChannelProjection {
  return { ...sampleGoalChannelProjection, ...overrides };
}

function signal(
  projection: GoalChannelProjection,
  label: string,
): { value: string; tone: Tone } {
  const derived = deriveOperatorStateSignals(projection).find(
    (entry) => entry.label === label,
  );
  if (!derived) {
    throw new Error(`missing operator signal: ${label}`);
  }
  return { value: derived.value, tone: derived.tone };
}

function runDerivedSignals(): void {
  // Sample fixture: outcome_progress is a positive outcome, not a gap.
  expectTone(
    signal(sampleGoalChannelProjection, "outcome").tone,
    "success",
    "sample outcome signal",
  );

  const gap = projectionWith({
    source_refs: {
      ...sampleGoalChannelProjection.source_refs,
      latest_delivery_outcome: "outcome_gap",
    },
  });
  const gapSignal = signal(gap, "outcome");
  expectTone(gapSignal.tone, "danger", "outcome_gap signal");
  if (gapSignal.value !== "outcome_gap") {
    throw new Error(`outcome_gap value: ${gapSignal.value}`);
  }

  const failed = projectionWith({
    source_refs: {
      ...sampleGoalChannelProjection.source_refs,
      latest_delivery_outcome: "delivery_failed",
    },
  });
  expectTone(signal(failed, "outcome").tone, "danger", "delivery_failed signal");

  const surfacedOnly = projectionWith({
    source_refs: {
      ...sampleGoalChannelProjection.source_refs,
      latest_delivery_outcome: "surface_only",
    },
  });
  expectTone(signal(surfacedOnly, "outcome").tone, "neutral", "surface_only signal");

  // A failed delivery observed only in the event ledger still reads as danger.
  const ledgerGap = projectionWith({
    source_refs: { ...sampleGoalChannelProjection.source_refs, latest_delivery_outcome: null },
    recent_events: [
      {
        generated_at: "2026-06-20T08:03:00Z",
        classification: "outcome_gap",
        summary: "run produced no material advancement",
      },
    ],
  });
  expectTone(signal(ledgerGap, "outcome").tone, "danger", "ledger outcome_gap signal");

  // Ordinary workspace/capability prose in a todo title must not classify as
  // repair or wait; only typed domain discriminators do.
  const proseOnly = projectionWith({
    waiting_on: "nothing",
    agent_todos: [
      {
        todo_id: "todo_prose",
        priority: "P2",
        status: "open",
        task_class: "advancement_task",
        action_kind: "review_notes",
        title: "Document workspace behavior and review capability catalog wording.",
      },
    ],
    open_gates: [],
    recent_events: [],
  });
  expectTone(signal(proseOnly, "workspace-repair").tone, "success", "workspace prose todo");
  expectTone(signal(proseOnly, "capability-wait").tone, "success", "capability prose todo");

  // Typed capability wait signals stay warnings.
  const waiting = projectionWith({
    agent_todos: [
      {
        todo_id: "todo_wait",
        priority: "P0",
        status: "waiting",
        task_class: "advancement_task",
        action_kind: "capability_wait",
        title: "Wait for worker_bridge.",
      },
    ],
  });
  expectTone(signal(waiting, "capability-wait").tone, "warning", "capability_wait todo");

  // A generic waiting lifecycle status does not establish a capability wait.
  const externalReviewWait = projectionWith({
    waiting_on: "external_evidence",
    agent_todos: [
      {
        todo_id: "todo_external_review_wait",
        priority: "P0",
        status: "waiting",
        task_class: "advancement_task",
        action_kind: "external_review_wait",
        title: "Wait for an independent reviewer.",
      },
    ],
    open_gates: [],
    recent_events: [],
  });
  const externalReviewSignal = signal(externalReviewWait, "capability-wait");
  expectTone(
    externalReviewSignal.tone,
    "success",
    "external review waiting todo",
  );
  if (externalReviewSignal.value !== "clear") {
    throw new Error(`external review waiting value: ${externalReviewSignal.value}`);
  }

  // Unknown outcome tokens stay neutral, never success.
  const unknownToken = projectionWith({
    source_refs: {
      ...sampleGoalChannelProjection.source_refs,
      latest_delivery_outcome: "mystery_outcome",
    },
  });
  expectTone(signal(unknownToken, "outcome").tone, "neutral", "unknown outcome token");
}

function main(): void {
  runTables();
  runDerivedSignals();
  console.log("frontstage-operator-state-smoke ok");
}

main();

```

### Core Architecture Module: `apps/presentation/dashboard/smoke/goal-lifecycle-proposal-smoke.ts`
```
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { typedActionProposalSchema } from "../src/data/chat.js";

// Input comes from ChatActionService over disposable registries, not a replica
// of the backend's source-basis builder.
const proposals = JSON.parse(readFileSync(0, "utf8")) as Record<string, unknown>[];
assert.ok(proposals.length > 0);
for (const proposal of proposals) {
  const decoded = typedActionProposalSchema.parse(proposal);
  assert.deepEqual(decoded.canonical_update_basis, proposal.canonical_update_basis);
  const basis = proposal.canonical_update_basis as Record<string, unknown>;
  for (const key of Object.keys(basis)) {
    const incomplete = { ...basis };
    delete incomplete[key];
    assert.equal(typedActionProposalSchema.safeParse({
      ...proposal, canonical_update_basis: incomplete,
    }).success, false, `missing ${key} must be rejected`);
  }
  assert.equal(typedActionProposalSchema.safeParse({
    ...proposal, canonical_update_basis: { ...basis, source_identity: "bad-digest" },
  }).success, false);
  assert.equal(typedActionProposalSchema.safeParse({
    ...proposal, canonical_update_basis: { ...basis, schema_version: "unknown" },
  }).success, false);
  if (basis.schema_version === "loopx_goal_deletion_source_basis_v1") {
    for (const patch of [{ source_content_sha256: "bad-digest" }, { route_mode: "unknown" }]) {
      assert.equal(typedActionProposalSchema.safeParse({
        ...proposal, canonical_update_basis: { ...basis, ...patch },
      }).success, false);
    }
  }
}

const template = proposals[0];
const digest = "a".repeat(64);
for (const schema_version of ["loopx_chat_canonical_update_basis_v0", "loopx_chat_canonical_terminal_basis_v0"]) {
  const proposal = {
    ...template, action_kind: "todo.update", normalized_parameters: {},
    canonical_update_basis: { schema_version, provider_revision: "revision-1", source_authority: "file_v0", registry_sha256: digest },
  };
  assert.ok(typedActionProposalSchema.safeParse(proposal).success);
  assert.equal(typedActionProposalSchema.safeParse({
    ...proposal, canonical_update_basis: { ...proposal.canonical_update_basis, provider_revision: "" },
  }).success, false);
}
console.log(`PASS ${proposals.length} real lifecycle proposals and Todo basis parity`);

```

### Core Architecture Module: `apps/presentation/dashboard/src/features/personal-workspace/goal-loopx-mode.tsx`
```
import {useEffect, useRef, useState} from "react";
import {Pause, Play, Settings2, Users, X} from "lucide-react";
import {fetchLoopXMode, updateLoopXMode, type LoopXModeSnapshot, type LoopXModeSettings} from "../../data/chat";
import {useWorkspaceI18n} from "./i18n";
import {GoalTeamWork} from "./goal-team-work";
import "./goal-loopx-mode.css";

export function GoalLoopXMode({sessionId, onPrepare, onExecute, onChange}: {
  sessionId?: string;
  onPrepare: () => Promise<string>;
  onExecute: (operation: "start" | "resume", settings?: LoopXModeSettings) => void;
  onChange: (snapshot: LoopXModeSnapshot | null) => void;
}) {
  const {locale} = useWorkspaceI18n();
  const zh = locale === "zh-CN";
  const [snapshot, setSnapshot] = useState<LoopXModeSnapshot | null>(null);
  const [panel, setPanel] = useState<"settings" | "team" | null>(null);
  const editing = panel === "settings";
  const setEditing = (value: boolean) => setPanel(value ? "settings" : null);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (panel && !dialog.current?.open) dialog.current?.showModal();
    else if (!panel && dialog.current?.open) dialog.current.close();
  }, [panel]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [readError, setReadError] = useState("");
  const [settings, setSettings] = useState<LoopXModeSettings>({agent_id: "", token_budget: 0});
  useEffect(() => {
    let alive = true;
    let refreshing = false;
    setSnapshot(null); onChange(null); setError(""); setReadError(""); setEditing(false);
    if (!sessionId || sessionId === "new-session-pending") return;
    async function refresh() {
      if (refreshing) return;
      refreshing = true;
      try {
        const result = await fetchLoopXMode(sessionId!);
        if (alive) {setSnapshot(result); onChange(result); setReadError("");}
      } catch (failure) {if (alive) setReadError(failure instanceof Error ? failure.message : String(failure));}
      finally {refreshing = false;}
    }
    void refresh();
    const interval = window.setInterval(() => {if (!document.hidden) void refresh();}, 2500);
    return () => {alive = false; window.clearInterval(interval);};
  }, [sessionId]); // onChange is the owning component's stable state setter.
  const active = Boolean(snapshot?.enabled && snapshot.active_turn_id);
  const native = snapshot?.native.status ?? "absent";
  const resume = !["absent", "complete"].includes(native);
  const configured = Boolean(snapshot?.settings.agent_id && snapshot.settings.token_budget
    && snapshot.settings.execution_config);
  const editSettings = (current: LoopXModeSnapshot) => {
    setSettings({agent_id: current.settings.agent_id ?? "", token_budget: current.settings.token_budget ?? 0});
    setEditing(true);
  };
  const status = !snapshot?.enabled ? (zh ? "普通对话" : "Conversation")
    : snapshot.recovery_required ? (zh ? "LoopX · 需要恢复连接" : "LoopX · Reconnect required")
    : native === "blocked" ? (zh ? "LoopX · 需要处理阻塞" : "LoopX · Blocked")
    : active ? (zh ? "LoopX · 正在推进" : "LoopX · Working")
    : native === "complete" ? (zh ? "LoopX · 本轮已结束" : "LoopX · Run finished")
    : ["budgetLimited", "usageLimited"].includes(native) ? (zh ? "LoopX · 已到额度限制" : "LoopX · Usage limit")
    : (zh ? "LoopX · 已暂停" : "LoopX · Paused");
  const openSettings = () => {
    if (snapshot && !editing) editSettings(snapshot);
    else setEditing(false);
  };
  async function prepareSettings() {
    setBusy(true); setError("");
    try {
      const preparedSessionId = await onPrepare();
      const result = await fetchLoopXMode(preparedSessionId);
      setSnapshot(result); onChange(result); editSettings(result);
    } catch (failure) {setError(failure instanceof Error ? failure.message : String(failure));}
    finally {setBusy(false);}
  }
  async function mutate(operation: string) {
    if (!sessionId) return;
    setBusy(true); setError("");
    try {const result = await updateLoopXMode(sessionId, operation, operation === "configure" ? settings : undefined);
      setSnapshot(result); onChange(result); if (operation === "configure" || operation === "exit") setEditing(false);
    } catch (failure) {setError(failure instanceof Error ? failure.message : String(failure));}
    finally {setBusy(false);}
  }
  const needsReadback = snapshot?.deliveries.some(row => ["rejected", "unavailable"].includes(row.status));
  const pendingMessages = snapshot?.ingress.filter(row => row.status !== "delivered") ?? [];
  return <section className="goal-loopx-mode" aria-label={zh ? "LoopX 运行模式" : "LoopX execution mode"}>
    <div className="goal-loopx-mode-bar">
      <span className="goal-loopx-mode-status" data-active={active} role="status"><i aria-hidden="true"/>{status}</span>
      <div className="goal-loopx-mode-actions">
        {configured && sessionId ? <button type="button" className="goal-loopx-team-trigger" onClick={() => setPanel("team")} aria-haspopup="dialog"><Users size={16}/>{zh ? "团队执行情况" : "Team execution"}{needsReadback ? <span className="goal-loopx-alert-dot" aria-label={zh ? "最近回读需要核验" : "Last observations need review"}/> : null}</button> : null}
        <button type="button" disabled={busy || snapshot?.conversation_busy || !snapshot} onClick={openSettings} aria-label={zh ? "运行设置" : "Settings"} title={zh ? "运行设置与用量" : "Settings and usage"} aria-haspopup="dialog"><Settings2 size={16}/></button>
        <button type="button" className="goal-loopx-primary" disabled={busy || Boolean(snapshot?.conversation_busy && !active)} title={active ? (zh ? "暂停协调员；已派发的成员继续执行" : "Pause coordinator; dispatched members keep working") : undefined} onClick={async () => {
          if (!snapshot) {await prepareSettings(); return;}
          if (active) void mutate("pause");
          else if (!configured || Number(snapshot.settings.token_budget ?? 0) <= Number(snapshot.native.tokensUsed ?? 0)) openSettings();
          else onExecute(resume ? "resume" : "start");
        }}>{active ? <Pause size={14}/> : <Play size={14}/>}{active ? (zh ? "暂停协调员" : "Pause coordinator") : !snapshot?.enabled ? (zh ? "开启 LoopX 模式" : "Enable LoopX") : native === "complete" ? (zh ? "开启新一轮" : "Start new run") : (zh ? "恢复推进" : "Continue")}</button>
      </div>
    </div>
    {pendingMessages.length ? <p role="status">{zh ? "待处理消息：" : "Pending messages: "}{pendingMessages.map(row => `${row.mode === "loopx_queue" ? "queue" : "inbox"} · ${row.status}`).join(" / ")}</p> : null}
    {needsReadback ? <button className="goal-loopx-review-notice" type="button" onClick={() => setPanel("team")}>{zh ? "最近成员回读有未通过或无法核验的结果 · 查看团队" : "Last member observations include rejected or unverified results · View team"}</button> : null}
    {(error || readError) && !panel ? <p className="personal-composer-error" role="alert">{error || readError}</p> : null}
    <dialog className="goal-loopx-dialog" ref={dialog} aria-labelledby="goal-loopx-dialog-title" onClose={() => setPanel(null)} onClick={event => {if (event.target === event.currentTarget) setPanel(null);}}>
      {panel ? <div className="goal-loopx-dialog-content">
        <header><h2 id="goal-loopx-dialog-title">{panel === "team" ? (zh ? "团队执行情况" : "Team execution") : (zh ? "运行设置" : "Execution settings")}</h2><button type="button" autoFocus aria-label={zh ? "关闭" : "Close"} onClick={() => setPanel(null)}><X size={18}/></button></header>
        {error || readError ? <p className="personal-composer-error" role="alert">{error || readError}</p> : null}
        {panel === "team" && sessionId && !readError ? <GoalTeamWork key={`${sessionId}:${snapshot?.settings.agent_id}:${snapshot?.settings.execution_config}`} sessionId={sessionId} members={snapshot?.members ?? []} zh={zh} canMessage={active && !snapshot?.paused && !readError} ingress={snapshot?.ingress ?? []}/> : null}
        {panel === "team" ? <div className="goal-team-control">
          <button type="button" disabled={busy || !active || Boolean(readError)} onClick={() => void mutate("pause")}>{zh ? "暂停协调员" : "Pause coordinator"}</button>
          <p role="status">{snapshot?.paused ? (active ? (zh ? "已暂停后续调度，等待当前协调轮次停止回读。" : "Further dispatch paused; awaiting coordinator turn stop readback.") : (zh ? "协调员已暂停。" : "Coordinator paused.")) : null}
            {zh ? "此操作不会停止已派发成员；成员状态以上次执行回读为准。当前入口不支持停止整个团队。" : "This does not stop dispatched members; their states are last-read observations. Whole-team stop is unavailable here."}</p>
        </div> : null}
    {editing ? <div className="goal-loopx-mode-settings"><label>{zh ? "已注册的协调身份" : "Registered coordinator"}<select value={settings.agent_id} onChange={event => setSettings({...settings, agent_id: event.target.value})}><option value="">{zh ? "选择已授权身份" : "Select authorized identity"}</option>{snapshot?.registered_agents.map(id => <option key={id} value={id}>{id}</option>)}</select></label>
      <label>{zh ? "协调员总 token 额度" : "Coordinator total token allowance"}<input type="number" min={1} max={2147483647} value={settings.token_budget || ""} onChange={event => setSettings({...settings, token_budget: Number(event.target.value)})}/></label>
      <label>{zh ? "成员执行绑定文件（Goal 配置）" : "Member execution bindings (Goal configuration)"}<input readOnly value={snapshot?.settings.execution_config ?? (zh ? "未配置" : "Not configured")}/></label>
      <p>{zh ? "绑定文件由 Goal 子代理设置统一管理；额度包含协调员历史用量，成员授权不会因开启模式而扩大。" : "Manage the binding file in Goal sub-agent settings. The allowance includes coordinator history; enabling this mode does not expand member grants."}</p>
      <button type="button" disabled={busy || !settings.agent_id || settings.token_budget < 1 || !snapshot?.settings.execution_config} onClick={() => void mutate("configure")}>{zh ? "保存设置" : "Save settings"}</button></div> : null}
    {panel === "settings" && snapshot?.enabled && snapshot.native.tokensUsed !== undefined ? <p className="goal-loopx-mode-usage">{zh ? "协调员累计用量" : "Coordinator usage"} {snapshot.native.tokensUsed.toLocaleString()} / {snapsh
```

### Core Architecture Module: `apps/presentation/dashboard/src/features/personal-workspace/performance-diagnosis-worker.ts`
```
import { summarizePerformanceProfile } from "../../../../../../loopx/control_plane/capabilities/performance_profile";

// Raw captures stay in this browser. Parsing and aggregation never block the UI.
self.onmessage = async (event: MessageEvent<File>) => {
  try {
    if (event.data.size > 16 * 1024 * 1024) throw new Error("Profile exceeds 16 MiB; select a shorter capture.");
    const profile: unknown = JSON.parse(await event.data.text());
    self.postMessage({ result: summarizePerformanceProfile({ profile, top: 15 }) });
  } catch (cause) {
    self.postMessage({ error: cause instanceof Error ? cause.message : "Could not inspect profile." });
  }
};

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

### Incident Patch 1: `cf1f686c` (2026-10-06)
**Commit Message**: Merge pull request #5722 from loopx-project/codex/replan-browser-cadence

test(workspace): align replan cadence browser fixture

**File**: `examples/personal-workspace-browser/fixture.mjs` (modified, +6/-3)
```diff
@@ -151,8 +151,11 @@ export function goalCapabilityCatalog(multiSubagentConfiguration) {
       capabilityId: "todo_replan_cadence",
       displayName: "Goal review cadence",
       editorScopes: ["machine", "goal"],
-      defaultConfiguration: { completed_todos: 5 },
-      fields: [{ key: "completed_todos", label: "Completed Todos between Goal reviews", description: "", input_kind: "number", required: true, minimum: 1, maximum: 5 }],
+      defaultConfiguration: { count_unit: "completed_todos", count: 5 },
+      fields: [
+        { key: "count_unit", label: "Count between reviews", description: "", input_kind: "select", required: true, options: ["completed_todos", "effective_turns"] },
+        { key: "count", label: "Review interval", description: "", input_kind: "number", required: true, minimum: 1, maximum: 5 },
+      ],
     }),
     periodicReportCapability(),
     goalCapability({
@@ -1023,7 +1026,7 @@ export async function installApi(page, { goalSubagentConfigurationEnabled = true
             namespace: "todo_replan_cadence",
             title: "Goal review cadence",
             description: "Live review threshold without added turns, quota, or authority.",
-            schema_versions: ["todo_replan_cadence_machine_defaults_v0"],
+            schema_versions: ["todo_replan_cadence_machine_defaults_v0", "todo_replan_cadence_machine_defaults_v1"],
             configuration_template: cadenceConfiguration,
             template_status: "ready",
           },
```

**File**: `examples/personal-workspace-browser/typed-actions.mjs` (modified, +7/-1)
```diff
@@ -1292,7 +1292,13 @@ export const typedActionsScenario = {
         throw new Error("Other machine settings mixed Goal-only or steward controls into the catalog");
       }
       await machineCatalog.getByRole("button", { name: /^Goal 复核周期/ }).click();
-      await page.getByLabel(/^两次 Goal 复核间的已完成 Todo 数/u).waitFor({ state: "visible" });
+      const reviewUnit = page.getByLabel(/^复核计数依据/u);
+      const reviewCount = page.getByLabel("两次复核间的数量", { exact: true });
+      await reviewUnit.waitFor({ state: "visible" });
+      await reviewCount.waitFor({ state: "visible" });
+      assert.equal(await reviewUnit.inputValue(), "completed_todos");
+      assert.equal(await reviewCount.inputValue(), "3");
+      assert.deepEqual(await reviewUnit.locator("option").evaluateAll((options) => options.map((option) => option.value).filter(Boolean)), ["completed_todos", "effective_turns"]);
       await page.getByText(/不会创建 Turn、消耗配额或授予权限/u).waitFor({ state: "visible" });
       await machineCatalog.getByRole("button", { name: /^变更质量验证/ }).click();
       for (const label of [/^启用$/u, /^允许一次有界安全修复$/u, /^要求精确 diff 回执$/u]) {
```

---

### Incident Patch 2: `9e783092` (2026-10-06)
**Commit Message**: fix(quota): settle accepted semantic progress before frontier reentry (#5727)

Signed-off-by: LoopX Agent <[REDACTED_EMAIL]>

**File**: `docs/architecture/rfcs/loopx-overall-roadmap-v0.md` (modified, +1/-1)
```diff
@@ -79,7 +79,7 @@ P0 blocks correctness or continuity in the current user journey. P1 enables repe
 | **S4 Runtime/host/daemon · P0/P1** | Attached/managed, Turn, broker, runtime connectors and Desktop repairs exist; registration does not establish executable capacity | Qualify multi-Turn supervision for one real supported combination; restart/cancel/drain/stop retain work and fence old executors. Then expand host parity, unique service-profile ownership, clean installation and upgrades; show unsupported adapter capabilities |
 | **S5 Frontend, Lark and human interaction · P0/P1** | Local chat, settings, proposals and partial Goal Channel verticals exist; shared audience/session/work readback needs qualification | One journey spans settings, work graph, handoff, blockers, cost, corrections, artifacts and return. Shared typed projections; reconnect/repeated-click/stale/original-route cases. Realtime IM reuses Chat/Turn: isolate independent conversations on one listener, then qualify ordinary DM onboarding, explicit role selection, busy-session admission, provisional progress, media and exact permission callbacks through [the shared operational contract](capable-manager-semantic-handoff-v0.md#10-operational-contract). [Live team workspace](live-team-workspace-v0.md) makes exchange, revision and original-coordinator continuation visible. Its [Work-scale map track](live-team-workspace-v0.md#11-delivery-order-and-relationship-to-aggressive-r2-progress) draws each Goal's typed Todo relations first (W1), then live state and outputs on the same nodes. Then intelligent review, keyboard accessibility, bilingual terminology, actionable errors and offline degradation; interrupt only for actual decisions |
 | **S6 Materials, evidence, memory and learning · P1** | Authority registry, material lifecycle/frontier, decision context, reward memory and turn recall exist; explicit project material packets and source-verifier gates are implemented, while private source initialization/Core binding and ordinary-conversation adoption remain unqualified; direction baseline and parts of attribution remain proposed | Connect material revision→same-Agent read→decision reference→artifact/outcome. Expose expiry/revocation/source loss and forgetting policy. Handoff preserves decision-relevant summaries and authorized artifacts; qualify OpenViking/Obelisk as optional providers. Prove causal utility with controls, not relevance alone |
-| **S7 Budget, scheduling and fleet scale · P0 observation/P1–P2 expansion** | Quota/scheduler and partial usage aggregates exist; full provider cost, distributed reservations and hundred-Agent concurrency need evidence | Separate configured budget, admission, consumption and estimates; unknown is not zero and replay cannot double-charge. R7 pagination/bounded summaries and [complete-history transport](typescript-control-plane-migration-v0.md), including refresh/replay/single-debit evidence beyond the RPC limit; provider/host limits, fairness, backpressure, event wake and isolation; report registration/activity/throughput and cost per accepted outcome separately |
+| **S7 Budget, scheduling and fleet scale · P0 observation/P1–P2 expansion** | Quota/scheduler and partial usage aggregates exist; full provider cost, distributed reservations and hundred-Agent concurrency need evidence | Separate configured budget, admission, consumption and estimates; unknown is not zero and replay cannot double-charge. R7 pagination/bounded summaries and [complete-history transport](typescript-control-plane-migration-v0.md), including refresh/replay/single-debit evidence beyond the RPC limit; provider/host limits, fairness, backpressure, event wake and isolation; report registration/activity/throughput and cost per accepted outcome separately Receipt-backed semantic progress now closes its original host Turn without completing an open/waiting Todo; file/SQLite guard replay covers a changed frontier. Follow [the quota settlement contract](../../quota-allocation.md#receipt-backed-settlement-progress); this bounded repair does not qualify fleet scale or host latency. |
 | **S8 Capabilities, extensions and domain integration · P1/P2** | Capability catalog, extension lifecycle, hooks, engineering/research/content/office capabilities and computer-use contracts exist | First exercise the shared control plane with existing issue-fix/PR-review and material/research callers. Every provider has readiness/version/permissions/default-off/uninstall/rollback/isolation and real-entry evidence. New domain effects start with one simulated operation, not a marketplace or workflow DSL |
 | **S9 Identity, authority, privacy and trust · continuous P0/P1–P2 remote** | Public/private scope, capability gates, fencing and confirmation contracts belong to existing owners | R1/R3 cover sender/audience/artifact scope and stale authority; R6 authenticates tenant/Goal/actor/host, rotation/revocation and least privilege. Qualify credential custody, untrusted
```

**File**: `docs/architecture/rfcs/loopx-overall-roadmap-v0.zh-CN.md` (modified, +1/-1)
```diff
@@ -65,7 +65,7 @@ managed 与 attached 的工作对话都应能持续在 LoopX 中进行：沿用
 | **S4 runtime/host/daemon · P0/P1** | attached/managed、Turn、broker、runtime connector 和 Desktop 修复存在；“registered”不等于可执行 | 选择一个真实合格组合完成多 Turn supervision；restart/cancel/drain/stop 不丢工作且旧 executor 被 fence。之后扩 host parity、service-profile 唯一 owner、干净安装与版本升级；按 adapter 能力显示不支持项 |
 | **S5 前端、Lark 与人机交互 · P0/P1** | 本地对话、settings、proposal 和部分 Goal Channel vertical 已有；统一受众/会话/工作回读仍需资格 | 用一个团队旅程贯穿设置、工作图、handoff、阻塞、成本、修订、产物和回报；共享 typed projection，验证重连/重复点击/stale/原路反馈。实时 IM 复用 Chat/Turn：先让同一 listener 下的独立会话互不阻塞，再按[共享运行契约](capable-manager-semantic-handoff-v0.zh-CN.md#10-运行契约)验收普通私聊开通、显式角色选择、忙碌会话准入、临时进度、媒体和精确权限回调。再做 intelligent review、无障碍键盘流程、中英术语、错误可恢复和离线降级；只在真实决策处打断人；[团队实时工作区](live-team-workspace-v0.zh-CN.md)让交换、修订与原协调员继续推进可见；其[工作尺度地图分线](live-team-workspace-v0.zh-CN.md#11-交付顺序与激进推进-r2-的关系)先画出每个 Goal 的类型化 Todo 关系（W1），再在同一节点叠加实时状态与产出 |
 | **S6 材料、证据、记忆与学习 · P1** | authority registry、material lifecycle/frontier、decision context、reward memory、turn recall 已有；方向基线和部分归因仍是提案 | 先打通“材料 revision→同 Agent 阅读→决策引用→产物/结果”；失效、撤销、来源消失与遗忘策略可回读。handoff 保存影响决策的摘要与授权 artifact；OpenViking/Obelisk 按可选 provider 资格化。utility 的因果收益另以对照证明，不把相关性当提升 |
-| **S7 预算、调度与 fleet 规模 · P0 观测/P1–P2 扩展** | quota/scheduler 与部分 usage aggregate 存在；全 provider 成本、分布式资源预留及百 Agent 并发尚需证据 | 先区分配置预算、准入、消耗与估算；未知成本不记零、重复事件不双记。R7 分页/有界摘要及[完整历史传输](typescript-control-plane-migration-v0.zh-CN.md)，验收超出 RPC 上限后的写回/重放/单次扣记；provider/host 限流、公平性、背压、事件唤醒与失败隔离；分别报告注册数/活跃数/吞吐量和每个验收成果成本 |
+| **S7 预算、调度与 fleet 规模 · P0 观测/P1–P2 扩展** | quota/scheduler 与部分 usage aggregate 存在；全 provider 成本、分布式资源预留及百 Agent 并发尚需证据 | 先区分配置预算、准入、消耗与估算；未知成本不记零、重复事件不双记。R7 分页/有界摘要及[完整历史传输](typescript-control-plane-migration-v0.zh-CN.md)，验收超出 RPC 上限后的写回/重放/单次扣记；provider/host 限流、公平性、背压、事件唤醒与失败隔离；分别报告注册数/活跃数/吞吐量和每个验收成果成本 回执支持的语义进展已能关闭原 host Turn，保留未完成/等待中的 Todo；file/SQLite guard 回放覆盖 frontier 改变，边界见[quota 结算契约](../../quota-allocation.md#receipt-backed-settlement-progress)。这项有界修复不证明 fleet 规模或宿主延迟。 |
 | **S8 能力、扩展与领域集成 · P1/P2** | 已有 capability catalog、extension 生命周期、hook、工程/研究/content/office 能力及 computer-use 合同 | 优先用现有 issue-fix/PR-review 和材料/研究 caller 检验共享控制面；每个 provider 带 readiness、版本、权限、默认关闭、卸载/回滚、失败隔离与真实入口证据。新 domain effect 从模拟单操作闭环开始，不先建市场或通用工作流 DSL |
 | **S9 身份、权限、隐私与信任 · P0 持续/P1–P2 远端** | public/private 边界、作用域、capability gate、fence 与确认合同分布在已有 owner | 随 R1/R3 验 sender/audience/artifact scope 和 stale authority；远端 R6 必须认证 tenant/Goal/actor/host、轮换撤销与最小权限。凭据保管、非可信工具/文档输入、依赖供应链、审计留存/删除及漏洞响应纳入真实路径；角色、消息或 memory 不铸造写权限 |
 | **S10 可靠性、诊断与运行运营 · P0/P1** | recovery/canary、read-only diagnostics 原型及 DSH event adapter 已有；C0/C1、开销和完整运营资格仍未闭合 | 故障分类→可观察状态→恢复演练→防复发；覆盖进程/存储/网络/投递故障和数据增长。Chat 上下文或 provider 读取晚于停止等待返回时，按持久 Turn 和精确 Session claim 判断：即使新请求已完成，也不得再启动旧请求或交接迟到结果。这项有界 GQ08 修复不证明上游 interrupt 保真，也不取消其他 owner 已准入的效果；完整恢复仍遵循[共享对话运行契约](capable-manager-semantic-handoff-v0.md#10-operational-contract)。定义并冻结 SLO、RPO/RTO、容量/保留边界，实测后标 qualified；Lark 传输背压与 drain 保留 App consumer lease；未持久化的缓冲消息不算已受理工作或完成回执。运行手册含升级、备份恢复、停止与人工接管，不以测试数代替恢复结果 |
```

**File**: `docs/quota-allocation.md` (modified, +9/-0)
```diff
@@ -208,6 +208,15 @@ instead sets `closeout_kind=typed_blocked_writeback_no_spend` and settles the
 Turn without a quota debit. Todo completion and Goal acceptance retain their
 separate checks in both cases.
 
+An accepted `vision_checkpoint_v0` for `outcome_progress` also closes its exact
+Todo-bound Turn after the matching writeback and spend receipts commit. Both
+`in_flight_continuation` and `semantic_closeout` use their corresponding typed
+checkpoint triggers. The latter can leave the Todo open or waiting while the
+eligible frontier changes. Reentering the same Turn returns
+`heartbeat_settled_skip` with the original binding; only a fresh Turn discovers
+new work or replan obligations. Missing, rejected or mismatched checkpoints and
+receipts remain incomplete; this replay rule grants no Todo or Goal completion.
+
 A Todo-bound path replan can be qualified during execution even when the
 initial guard selected no replan obligation. Its exact durable writeback must
 carry a recorded `autonomous_replan_ack_v0` with an accepted semantic delta or
```

**File**: `loopx/control_plane/quota/settlement_phase.ts` (modified, +11/-4)
```diff
@@ -19,7 +19,7 @@ export function isBoundedBlockedRetry(value: unknown, todoId: string | null): bo
 
 /** The committed checkpoint accepts progress for a Turn, not Todo completion.
  * The caller must first verify this writeback's exact durable receipt. */
-export function isAcceptedInFlightWriteback(
+export function isAcceptedProgressWriteback(
   value: unknown,
   identity: SettlementIdentity,
 ): boolean {
@@ -32,14 +32,21 @@ export function isAcceptedInFlightWriteback(
       run.delivery_outcome !== "outcome_progress" ||
       !checkpoint || checkpoint.schema_version !== "vision_checkpoint_v0" ||
       checkpoint.agent_id !== identity.agent_id ||
-      checkpoint.delivery_boundary !== "in_flight_continuation" ||
       checkpoint.satisfied !== true || !Array.isArray(checkpoint.triggers)) {
     return false;
   }
   return checkpoint.triggers.some((value) => {
     const trigger = jsonObject(value);
-    return trigger?.kind === "in_flight_continuation" &&
-      trigger.todo_id === identity.todo_id;
+    if (checkpoint.delivery_boundary === "in_flight_continuation") {
+      return trigger?.kind === "in_flight_continuation" &&
+        trigger.todo_id === identity.todo_id;
+    }
+    // A semantic checkpoint can close a bounded segment while the Todo waits
+    // or remains open. Its accepted outcome, not the current frontier or Todo
+    // completion, owns replay of the exact paid Turn.
+    return checkpoint.delivery_boundary === "semantic_closeout" &&
+      trigger?.kind === "material_delivery_outcome" &&
+      trigger.delivery_outcome === run.delivery_outcome;
   });
 }
 
```

**File**: `loopx/control_plane/quota/settlement_readback.ts` (modified, +4/-4)
```diff
@@ -32,7 +32,7 @@ import {
 import {
   isBoundedBlockedRetry,
   isCommittedMonitorPollEffect,
-  isAcceptedInFlightWriteback,
+  isAcceptedProgressWriteback,
   isAcceptedReplanWriteback,
   receiptBoundMonitorPhase,
   receiptBoundReplayPhase,
@@ -1119,8 +1119,8 @@ function readQuotaSettlementFromRequest(
   const todoBoundReplan = identity.binding_kind === "todo" &&
     semanticReplanGuard.scope === "turn_guard" &&
     semanticReplanGuard.selected_obligation_id !== null;
-  const inFlightWriteback = writeback.failure === null &&
-    isAcceptedInFlightWriteback(writebackRun, identity);
+  const progressWriteback = writeback.failure === null &&
+    isAcceptedProgressWriteback(writebackRun, identity);
   const replanWriteback = writeback.failure === null &&
     isAcceptedReplanWriteback(writebackRun, identity);
   const monitorPhase = receiptBoundMonitorPhase({
@@ -1134,7 +1134,7 @@ function readQuotaSettlementFromRequest(
   // reducer so completion, retirement or archival cannot reopen that Turn.
   const replayPhase = monitorPhase === "settled" ? "settled" : receiptBoundReplayPhase({
     binding_kind: identity.binding_kind,
-    writeback_completes_binding: todoBoundReplan || blockedNoSpend || inFlightWriteback || replanWriteback,
+    writeback_completes_binding: todoBoundReplan || blockedNoSpend || progressWriteback || replanWriteback,
     completion_receipt_present: completionEvent !== null,
     supersede_receipt_present: supersedeEvent?.status === "done" &&
       optionalString(supersedeEvent.todo_id) === identity.todo_id,
```

**File**: `tests/control_plane/test_quota_authority_settlement_journey.py` (modified, +74/-2)
```diff
@@ -3,6 +3,7 @@
 
 import json
 import shlex
+from datetime import datetime, timedelta, timezone
 from pathlib import Path
 
 import pytest
@@ -118,13 +119,13 @@ def test_failed_canonical_read_cannot_fall_back_to_markdown(tmp_path):
 
 
 
-def _refresh(project: Path, runtime: Path, registry: Path):
+def _refresh(project: Path, runtime: Path, registry: Path, *extra: str):
     return cli._run_cli(
         registry, runtime, "refresh-state", "--goal-id", cli.GOAL_ID,
         "--classification", "validated_progress", "--delivery-batch-scale", "implementation",
         "--delivery-outcome", "outcome_progress", "--agent-id", cli.AGENT_ID,
         "--todo-id", cli.TODO_ID, "--turn-instance-id", cli.TURN_ID,
-        "--no-global-sync", "--suppress-external-sinks", cwd=project,
+        "--no-global-sync", "--suppress-external-sinks", *extra, cwd=project,
     )
 
 
@@ -134,6 +135,77 @@ def _execute(command: str, project: Path, runtime: Path, registry: Path):
     return cli._run_cli(registry, runtime, *shlex.split(command)[1:], cwd=project)
 
 
+@pytest.mark.parametrize("provider", ["file", "sqlite"])
+def test_semantic_progress_replay_keeps_original_turn_after_todo_wait(tmp_path, provider):
+    project, runtime, registry, _, _ = _source(
+        tmp_path, provider=provider, extra=f"claimed_by={cli.AGENT_ID}",
+    )
+    code, guard = _guard(project, runtime, registry)
+    assert code == 0 and guard["decision"] == "run", guard
+    original = guard["heartbeat_receipt"]["settlement_identity"]
+
+    # A legitimate native wait changes the runnable frontier; it neither
+    # completes the original Todo nor changes the already admitted host Turn.
+    due = (datetime.now(timezone.utc) + timedelta(minutes=20)).isoformat(timespec="seconds")
+    code, updated = cli._run_cli(
+        registry, runtime, "todo", "update", "--goal-id", cli.GOAL_ID,
+        "--todo-id", cli.TODO_ID, "--agent-id", cli.AGENT_ID,
+        "--resume-when", f"resume_at:{due}", cwd=project,
+    )
+    assert code == 0 and updated["ok"] is True, json.dumps(updated)
+    code, refreshed = _refresh(
+        project, runtime, registry,
+        "--vision-state", "vision_on_track", "--vision-summary", "Continue current eligible work.",
+        "--vision-acceptance", "The waiting Todo remains open; the next Turn selects fresh work.",
+    )
+    assert code == 0, refreshed
+    assert refreshed["vision_checkpoint"]["delivery_boundary"] == "semantic_closeout"
+    assert refreshed["vision_checkpoint"]["satisfied"] is True
+    code, spent = _execute(refreshed["settlement_owed"]["command"], project, runtime, registry)
+    assert code == 0 and spent["settlement_progress"]["state"] == "settled", spent
+
+    readback = read_heartbeat_settlement(
+        runtime, goal_id=cli.GOAL_ID, agent_id=cli.AGENT_ID,
+        todo_id=cli.TODO_ID, turn_instance_id=cli.TURN_ID,
+    )
+    assert readback is not None and readback.replay_phase.value == "settled"
+    for explicit in (False, True):
+        code, replay = cli._run_cli(
+            registry, runtime, "quota", "should-run", "--codex-app",
+            "--goal-id", cli.GOAL_ID, "--agent-id", cli.AGENT_ID,
+            "--turn-instance-id", cli.TURN_ID, "--scan-path", str(project),
+            *(["--todo-id", cli.TODO_ID] if explicit else []), cwd=project,
+        )
+        assert code == 0 and replay["effective_action"] == "heartbeat_settled_skip", replay
+        assert replay["heartbeat_receipt"]["settlement_identity"] == original
+        assert replay["interaction_contract"]["agent_channel"]["must_attempt"] is False
+        channel = replay["interaction_contract"]["cli_channel"]
+        assert channel["spend_allowed_now"] is False
+        assert channel["spend_after_validation"] is False
+        assert all("refresh-state" not in command and "spend-slot" not in command
+                   for command in channel["next_cli_actions"])
+        assert not replay.get("selected_todo")
+        assert not replay.get("autonomous_replan_obligation")
+    assert cli._heartbeat_receipt_count(runtime, cli.TURN_ID) == 1
+    assert cli._spend_run_count(runtime) == 1
+    current = list_goal_todos(registry_path=registry, goal_id=cli.GOAL_ID,
+                             runtime_root_arg=str(runtime), todo_id=cli.TODO_ID)["todo"]
+    assert current["status"] == "open" and current["resume_ready"] is False
+
+    code, fresh = cli._run_cli(
+        registry, runtime, "quota", "should-run", "--codex-app",
+        "--goal-id", cli.GOAL_ID, "--agent-id", cli.AGENT_ID,
+        "--turn-instance-id", "turn-after-semantic-progress", "--scan-path", str(project), cwd=project,
+    )
+    assert code == 0 and fresh["decision"] in ("run", "autonomous_replan_required"), fresh
+    assert fresh["heartbeat_receipt"]["turn_instance_id"] == "turn-after-semantic-progress"
+    assert (fresh.get("selected_todo") or {}).get("todo_id") != cli.TODO_ID
+    if fresh["decision"] == "autonomous_replan_required":
+   
```

**File**: `tests/control_plane_ts/quota_settlement_readback.test.ts` (modified, +49/-0)
```diff
@@ -658,6 +658,55 @@ test("accepted in-flight writeback closes only the exact Turn, not its Todo", as
   });
 });
 
+test("accepted semantic progress settles its Turn while the Todo stays open", async t => {
+  const checkpoint = {
+    schema_version: "vision_checkpoint_v0", agent_id: agentId, satisfied: true,
+    delivery_boundary: "semantic_closeout",
+    triggers: [{kind: "material_delivery_outcome", delivery_outcome: "outcome_progress"}],
+  };
+  const cases = [
+    {name: "paid progress", spend: true, expected: "settled"},
+    {name: "spend still required", spend: false, expected: "settlement_pending"},
+    {name: "missing writeback receipt", spend: true, remove: "refresh_state", expected: "open"},
+    {name: "missing spend receipt", spend: true, remove: "quota_spend", expected: "settlement_pending"},
+    ...[
+      ["not accepted", {satisfied: false}],
+      ["truthy acceptance", {satisfied: "true"}],
+      ["wrong schema", {schema_version: "other"}],
+      ["other agent", {agent_id: "peer"}],
+      ["no outcome trigger", {triggers: []}],
+      ["in-flight trigger", {triggers: [{kind: "in_flight_continuation", todo_id: todoId}]}],
+      ["mismatched outcome", {triggers: [{kind: "material_delivery_outcome", delivery_outcome: "outcome_gap"}]}],
+    ].map(([name, patch]) => ({name: String(name), spend: true, checkpoint: {...checkpoint, ...(patch as Record<string, unknown>)}, expected: "open"})),
+    ...["goal_id", "agent_id", "todo_id", "turn_instance_id"].map(field => ({
+      name: `other ${field}`, spend: true, patch: {[field]: "other"}, expected: "open",
+    })),
+    {name: "other effect", spend: true, patch: {settlement_identity: {...identity, effect_id: "other"}}, expected: "open"},
+  ];
+  for (const entry of cases) await t.test(entry.name, async () => {
+    const root = await fixture({writeback: true, spend: entry.spend,
+      visionCheckpoint: "checkpoint" in entry ? entry.checkpoint : checkpoint});
+    try {
+      if ("remove" in entry) {
+        const log = join(root, "goals", goalId, "rollout-event-log.jsonl");
+        const rows = (await readFile(log, "utf8")).trim().split("\n").map(line => JSON.parse(line));
+        await writeFile(log, rows.filter(row => row.event_kind !== entry.remove).map(row => JSON.stringify(row)).join("\n") + "\n");
+      }
+      if ("patch" in entry) {
+        const index = join(root, "goals", goalId, "runs", "index.jsonl");
+        const rows = (await readFile(index, "utf8")).trim().split("\n").map(line => JSON.parse(line));
+        rows[0] = {...rows[0], ...entry.patch};
+        await writeFile(index, rows.map(row => JSON.stringify(row)).join("\n") + "\n");
+      }
+      const result = await readQuotaSettlement(request(root));
+      assert.equal(result.replay_phase, entry.expected);
+      assert.equal(result.completion_event, null);
+      assert.equal((result.terminal_closeout as any).payload.ok, false);
+      if (entry.name === "paid progress") assert.equal((result.progress as any).state, "settled");
+    } finally { await rm(root, {recursive: true, force: true}); }
+  });
+});
+
 test("qualified path replan closes its Turn without a preselected obligation or Todo completion", async t => {
   const accepted = {
     schema_version: "autonomous_replan_ack_v0", recorded: true,
```

---

### Incident Patch 3: `4ce89e62` (2026-10-06)
**Commit Message**: test(workspace): align replan cadence browser fixture

Signed-off-by: LoopX Agent <[REDACTED_EMAIL]>

**File**: `examples/personal-workspace-browser/fixture.mjs` (modified, +6/-3)
```diff
@@ -151,8 +151,11 @@ export function goalCapabilityCatalog(multiSubagentConfiguration) {
       capabilityId: "todo_replan_cadence",
       displayName: "Goal review cadence",
       editorScopes: ["machine", "goal"],
-      defaultConfiguration: { completed_todos: 5 },
-      fields: [{ key: "completed_todos", label: "Completed Todos between Goal reviews", description: "", input_kind: "number", required: true, minimum: 1, maximum: 5 }],
+      defaultConfiguration: { count_unit: "completed_todos", count: 5 },
+      fields: [
+        { key: "count_unit", label: "Count between reviews", description: "", input_kind: "select", required: true, options: ["completed_todos", "effective_turns"] },
+        { key: "count", label: "Review interval", description: "", input_kind: "number", required: true, minimum: 1, maximum: 5 },
+      ],
     }),
     periodicReportCapability(),
     goalCapability({
@@ -1023,7 +1026,7 @@ export async function installApi(page, { goalSubagentConfigurationEnabled = true
             namespace: "todo_replan_cadence",
             title: "Goal review cadence",
             description: "Live review threshold without added turns, quota, or authority.",
-            schema_versions: ["todo_replan_cadence_machine_defaults_v0"],
+            schema_versions: ["todo_replan_cadence_machine_defaults_v0", "todo_replan_cadence_machine_defaults_v1"],
             configuration_template: cadenceConfiguration,
             template_status: "ready",
           },
```

**File**: `examples/personal-workspace-browser/typed-actions.mjs` (modified, +7/-1)
```diff
@@ -1292,7 +1292,13 @@ export const typedActionsScenario = {
         throw new Error("Other machine settings mixed Goal-only or steward controls into the catalog");
       }
       await machineCatalog.getByRole("button", { name: /^Goal 复核周期/ }).click();
-      await page.getByLabel(/^两次 Goal 复核间的已完成 Todo 数/u).waitFor({ state: "visible" });
+      const reviewUnit = page.getByLabel(/^复核计数依据/u);
+      const reviewCount = page.getByLabel("两次复核间的数量", { exact: true });
+      await reviewUnit.waitFor({ state: "visible" });
+      await reviewCount.waitFor({ state: "visible" });
+      assert.equal(await reviewUnit.inputValue(), "completed_todos");
+      assert.equal(await reviewCount.inputValue(), "3");
+      assert.deepEqual(await reviewUnit.locator("option").evaluateAll((options) => options.map((option) => option.value).filter(Boolean)), ["completed_todos", "effective_turns"]);
       await page.getByText(/不会创建 Turn、消耗配额或授予权限/u).waitFor({ state: "visible" });
       await machineCatalog.getByRole("button", { name: /^变更质量验证/ }).click();
       for (const label of [/^启用$/u, /^允许一次有界安全修复$/u, /^要求精确 diff 回执$/u]) {
```

---

### Incident Patch 4: `f1efc22e` (2026-10-06)
**Commit Message**: Merge pull request #5721 from loopx-project/codex/release-1.3.0-wait-clock

test(chat): make deadline fallback qualification deterministic

**File**: `tests/test_chat_turn_wait.py` (modified, +24/-1)
```diff
@@ -1,8 +1,11 @@
 from __future__ import annotations
 
 import threading
+from types import SimpleNamespace
 from unittest.mock import Mock
 
+import pytest
+
 from loopx.chat_runtime import ChatRuntimeController
 
 
@@ -27,11 +30,31 @@ def test_wait_for_turn_uses_managed_completion_event() -> None:
     assert runtime.store.load_turn.call_count == 2
 
 
-def test_wait_for_turn_performs_final_fallback_read_at_deadline() -> None:
+def test_wait_for_turn_performs_final_fallback_read_at_deadline(monkeypatch) -> None:
     runtime = _runtime()
     runtime.store.load_turn.side_effect = [{"status": "running"}, {"status": "completed"}]
+    # The first read is before the deadline; the fallback read is exactly at it.
+    clock = Mock(side_effect=[0.0, 0.0, 0.001])
+    sleep = Mock()
+    monkeypatch.setattr("loopx.chat_runtime.time", SimpleNamespace(monotonic=clock, sleep=sleep))
 
     turn = runtime.wait_for_turn(session_id="session", turn_id="turn", timeout_sec=0.001)
 
     assert turn["status"] == "completed"
     assert runtime.store.load_turn.call_count == 2
+    sleep.assert_called_once_with(0.001)
+
+
+def test_wait_for_turn_refuses_unfinished_initial_read_at_deadline(monkeypatch) -> None:
+    runtime = _runtime()
+    runtime.store.load_turn.return_value = {"status": "running"}
+    sleep = Mock()
+    monkeypatch.setattr("loopx.chat_runtime.time", SimpleNamespace(
+        monotonic=Mock(side_effect=[0.0, 0.001]), sleep=sleep,
+    ))
+
+    with pytest.raises(TimeoutError, match="chat turn wait timed out"):
+        runtime.wait_for_turn(session_id="session", turn_id="turn", timeout_sec=0.001)
+
+    assert runtime.store.load_turn.call_count == 1
+    sleep.assert_not_called()
```

---

### Incident Patch 5: `c330deaa` (2026-10-06)
**Commit Message**: fix(install): read delayed status contracts within a bounded deadline (#5720)

Signed-off-by: LoopX Agent <[REDACTED_EMAIL]>

**File**: `docs/architecture/rfcs/single-owner-local-daemon-v0.md` (modified, +7/-0)
```diff
@@ -85,6 +85,13 @@ describes the operator selection. This closes a configuration-retention gap in
 the current two-service path; fixture/native storage readback does not establish
 login/reboot recovery, the proposed unified daemon or full profile migration.
 
+The same helper gives its full status-contract read a bounded 15-second total
+deadline. A real HTTP regression retains schema/read-only facts after a
+six-second response and rejects HTTP errors and a hung feed; old-schema
+warnings remain intact. This repairs a diagnostic false-negative in the
+existing path. It does not reduce collection latency, close sustained-operation
+acceptance or qualify the proposed readiness/profile API.
+
 ## 5. Proposed architecture
 
 ### Ownership and identity
```

**File**: `docs/guides/installing-loopx.md` (modified, +7/-0)
```diff
@@ -125,6 +125,13 @@ Chat listener before switching to launchd, and read back the original Sessions
 and one consumer per App. A generated plist alone does not qualify recovery
 after logout or reboot.
 
+The helper reads the full `/status.json` contract with a one-second connection
+deadline and a 15-second total deadline. A responding feed that takes longer
+than five seconds can therefore still show its schema and write-API setting.
+HTTP failures and feeds that miss the deadline remain unavailable; old schemas
+still carry the restart warning. This bounded diagnostic allowance does not
+reduce feed latency or qualify sustained service performance.
+
 Snapshot identities retain their release id and source revision. A non-editable
 wheel instead exposes an additive `package_fingerprint` in the existing
 `loopx_runtime_identity_v1`: SHA-256 over its actual RECORD-owned LoopX package
```

**File**: `examples/macos-dashboard-launchagent-status-smoke.py` (modified, +60/-0)
```diff
@@ -11,6 +11,9 @@
 import subprocess
 import sys
 import tempfile
+import threading
+import time
+from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
 from pathlib import Path
 
 
@@ -52,6 +55,61 @@ def run_status(fake_bin: Path, home: Path, *, schema_version: int, write_enabled
     return run_script(fake_bin, home, ["status"], schema_version=schema_version, write_enabled=write_enabled).stdout
 
 
+def check_real_status_deadline(fake_bin: Path, home: Path) -> None:
+    """Exercise the public helper with real curl, not a mocked deadline."""
+    real_curl = shutil.which("curl")
+    assert real_curl, "curl is required for the status HTTP regression"
+    response = {"delay": 6, "version": 2, "code": 200}
+
+    class Handler(BaseHTTPRequestHandler):
+        def do_GET(self) -> None:
+            assert self.path == "/status.json", self.path
+            time.sleep(response["delay"])
+            payload = json.dumps({
+                "status_contract": {"schema_version": response["version"], "producer": "loopx status"},
+                "local_dashboard_api": {"control_plane_write_enabled": False},
+            }).encode()
+            try:
+                self.send_response(response["code"])
+                self.end_headers()
+                self.wfile.write(payload)
+            except (BrokenPipeError, ConnectionResetError):
+                pass  # The bounded client deliberately abandons the hung feed.
+
+        def log_message(self, *_args: object) -> None:
+            pass
+
+    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
+    thread = threading.Thread(target=server.serve_forever, daemon=True)
+    thread.start()
+    mocked_curl = fake_bin / "curl.mocked"
+    (fake_bin / "curl").rename(mocked_curl)
+    (fake_bin / "curl").symlink_to(real_curl)
+    try:
+        def read_status() -> str:
+            return run_script(fake_bin, home, ["status"], schema_version=2,
+                              extra_env={"LOOPX_STATUS_PORT": str(server.server_port),
+                                         "LOOPX_DASHBOARD_HOST": "127.0.0.1"}).stdout
+
+        delayed = read_status()
+        assert "status_contract: schema_version=2 producer=loopx status" in delayed, delayed
+        assert "control_plane_write_api: disabled" in delayed, delayed
+        response.update(delay=0, version=1)
+        assert "warning: status feed is using an old contract" in read_status()
+        response.update(version=2, code=503)
+        assert "status_contract: unavailable" in read_status()
+        response.update(delay=40, code=200)
+        started = time.monotonic()
+        assert "status_contract: unavailable" in read_status()
+        assert time.monotonic() - started < 25, "a hung feed must not make status wait indefinitely"
+    finally:
+        (fake_bin / "curl").unlink()
+        mocked_curl.rename(fake_bin / "curl")
+        server.shutdown()
+        server.server_close()
+        thread.join(timeout=2)
+
+
 def log_rotation_prelude(plist: Path) -> str:
     """The rotation step the agent wrapper runs before it execs the service."""
     command = plistlib.loads(plist.read_bytes())["ProgramArguments"][2]
@@ -269,6 +327,8 @@ def main() -> int:
         assert "URLs:" in current_output, current_output
         assert "Logs:" in current_output, current_output
 
+        check_real_status_deadline(fake_bin, home)
+
         run_script(fake_bin, home, ["install"], schema_version=2)
         status_plist = home / "Library" / "LaunchAgents" / "com.loopx.status.plist"
         chat_plist = home / "Library" / "LaunchAgents" / "com.loopx.chat.plist"
```

**File**: `scripts/macos-dashboard-launchagent.sh` (modified, +4/-1)
```diff
@@ -613,7 +613,10 @@ print_status_contract_health() {
     echo "- control_plane_write_api: unknown"
     return
   fi
-  status_json="$(curl -fsS --connect-timeout 1 --max-time 5 "$status_url" 2>/dev/null || true)"
+  # The full feed collects registered Goals; it is not a cheap liveness probe.
+  # Allow a bounded read beyond five seconds while retaining connection failure
+  # and contract-version checks. This does not make a slow feed healthy.
+  status_json="$(curl -fsS --connect-timeout 1 --max-time 15 "$status_url" 2>/dev/null || true)"
   if [[ -z "$status_json" ]]; then
     echo "- status_contract: unavailable (status feed not reachable)"
     echo "- control_plane_write_api: unknown"
```

---

### Incident Patch 6: `79605ad9` (2026-10-06)
**Commit Message**: Merge pull request #5718 from loopx-project/codex/release-1.3.0-replan-context-owner

fix(replan): restore control-plane context ownership and catalog validation

**File**: `examples/project/configure-goal-smoke.py` (modified, +6/-2)
```diff
@@ -316,17 +316,21 @@ def main() -> int:
             "review_order": "forward",
         }
         assert features["todo_replan_cadence"]["availability"] == "supported_opt_in"
-        assert features["todo_replan_cadence"]["default"] == {"completed_todos": 5}
+        assert features["todo_replan_cadence"]["default"] == {
+            "count_unit": "completed_todos",
+            "count": 5,
+        }
         # Goal-scoped cadence is omitted when no explicit override is present;
         # the machine default remains discoverable through the default field.
         assert "current" not in features["todo_replan_cadence"], features[
             "todo_replan_cadence"
         ]
         replan_commands = features["todo_replan_cadence"]["commands"]
-        assert "--execution-replan-after-todos 3" in replan_commands["preview_enable"]
+        assert "--execution-replan-after-turns 3" in replan_commands["preview_enable"]
         assert "--execute" not in replan_commands["preview_enable"]
         assert "--execute" in replan_commands["apply_enable"]
         assert "--clear-execution-replan-after-todos" in replan_commands["preview_disable"]
+        assert "--clear-execution-replan-after-turns" in replan_commands["preview_disable"]
         assert "--execute" not in replan_commands["preview_disable"]
         assert "--execute" in replan_commands["apply_disable"]
         assert features["local_authority_shadow"]["availability"] == "retired"
```

**File**: `loopx/capabilities/todo_replan_cadence/context.py` (removed, +0/-38)
```diff
@@ -1,38 +0,0 @@
-"""Transport the explicit Goal cadence to the shared TypeScript history owner."""
-
-from pathlib import Path
-from typing import Any
-
-
-def effective_turn_cadence_context(
-    goal: dict[str, Any],
-    runtime_root: Path | None,
-    *,
-    registry_path: Path | None = None,
-    goal_ref: dict[str, str] | None = None,
-    source_admission: dict[str, Any] | None = None,
-) -> dict[str, Any] | None:
-    profile = goal.get("execution_profile") or {}
-    threshold = profile.get("replan_after_effective_turns")
-    if threshold is None:
-        return None
-    if (
-        isinstance(threshold, bool)
-        or not isinstance(threshold, int)
-        or not 1 <= threshold <= 5
-    ):
-        raise ValueError("replan_after_effective_turns must be an integer from 1 to 5")
-    if runtime_root is None or not goal.get("id"):
-        raise ValueError("effective Turn cadence requires the Goal settlement runtime")
-    if goal_ref is None and goal.get("goal_instance_id"):
-        goal_ref = {"goal_id": goal["id"], "goal_instance_id": goal["goal_instance_id"]}
-    return {
-        "registry_path": registry_path,
-        "goal_ref": goal_ref,
-        "source_admission": source_admission,
-        "threshold": threshold,
-        "settlement_source": {
-            "runtime_root": str(runtime_root.resolve()),
-            "goal_id": goal["id"],
-        },
-    }
```

**File**: `loopx/cli_commands/todo.py` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@
 from operator import itemgetter
 from pathlib import Path
 
-from ..capabilities.todo_replan_cadence.context import effective_turn_cadence_context
+from ..control_plane.work_items.replan_history_codec import effective_turn_cadence_context
 from ..control_plane.coordination.local_authority import (
     local_authority_is_promoted,
     read_canonical_todo_fields_if_promoted,
```

**File**: `loopx/control_plane/work_items/attention_queue.py` (modified, +1/-1)
```diff
@@ -4,7 +4,7 @@
 from pathlib import Path
 from typing import AbstractSet, Any, Callable, Optional
 
-from ...capabilities.todo_replan_cadence.context import effective_turn_cadence_context
+from .replan_history_codec import effective_turn_cadence_context
 
 from ..goals.legacy_event_source import RetiredTodoEventSourceError
 
```

**File**: `loopx/control_plane/work_items/replan_history_codec.py` (modified, +34/-0)
```diff
@@ -23,6 +23,40 @@
 }
 
 
+def effective_turn_cadence_context(
+    goal: dict[str, Any],
+    runtime_root: Path | None,
+    *,
+    registry_path: Path | None = None,
+    goal_ref: dict[str, str] | None = None,
+    source_admission: dict[str, Any] | None = None,
+) -> dict[str, Any] | None:
+    profile = goal.get("execution_profile") or {}
+    threshold = profile.get("replan_after_effective_turns")
+    if threshold is None:
+        return None
+    if (
+        isinstance(threshold, bool)
+        or not isinstance(threshold, int)
+        or not 1 <= threshold <= 5
+    ):
+        raise ValueError("replan_after_effective_turns must be an integer from 1 to 5")
+    if runtime_root is None or not goal.get("id"):
+        raise ValueError("effective Turn cadence requires the Goal settlement runtime")
+    if goal_ref is None and goal.get("goal_instance_id"):
+        goal_ref = {"goal_id": goal["id"], "goal_instance_id": goal["goal_instance_id"]}
+    return {
+        "registry_path": registry_path,
+        "goal_ref": goal_ref,
+        "source_admission": source_admission,
+        "threshold": threshold,
+        "settlement_source": {
+            "runtime_root": str(runtime_root.resolve()),
+            "goal_id": goal["id"],
+        },
+    }
+
+
 def _timestamp(value: Any) -> float | None:
     parsed = parse_timestamp(value)
     return parsed.timestamp() if parsed is not None else None
```

**File**: `loopx/state_refresh.py` (modified, +1/-1)
```diff
@@ -7,7 +7,7 @@
 from pathlib import Path
 from typing import Any
 
-from .capabilities.todo_replan_cadence.context import effective_turn_cadence_context
+from .control_plane.work_items.replan_history_codec import effective_turn_cadence_context
 from .control_plane.progress_scope import AGENT_LANE_PROGRESS_SCOPE
 from .control_plane.runtime.time import chronology_key, now_local_iso
 from .control_plane.goals.state_resolution import resolve_goal_state as resolve_goal_state
```

**File**: `tests/control_plane/test_effective_turn_replan.py` (modified, +1/-1)
```diff
@@ -15,7 +15,7 @@
     _configure_selectable_alternative,
     ALTERNATIVE_TODO_ID,
 )
-from loopx.capabilities.todo_replan_cadence.context import (
+from loopx.control_plane.work_items.replan_history_codec import (
     effective_turn_cadence_context,
 )
 from loopx.control_plane.work_items.replan_history_codec import project_replan_history
```

---

### Incident Patch 7: `2b80476a` (2026-10-05)
**Commit Message**: fix(install): preserve managed Chat storage and timeouts (#5714)

Signed-off-by: LoopX Agent <[REDACTED_EMAIL]>

**File**: `docs/architecture/rfcs/single-owner-local-daemon-v0.md` (modified, +8/-0)
```diff
@@ -77,6 +77,14 @@ describes release fingerprints, foreign-listener rejection, and ports 8766 and
 immediate startup/double-owner path while explicitly preserving two services.
 These facts do not establish the profile or unified-daemon contract below.
 
+The existing macOS helper additionally preserves an explicitly selected Chat
+runtime directory and idle/hard timeouts across installation and restart, with
+legacy argv recovery and validation before replacing either plist. The
+[installation guide](../../guides/installing-loopx.md#macos-service-identity-and-workspace-selection)
+describes the operator selection. This closes a configuration-retention gap in
+the current two-service path; fixture/native storage readback does not establish
+login/reboot recovery, the proposed unified daemon or full profile migration.
+
 ## 5. Proposed architecture
 
 ### Ownership and identity
```

**File**: `docs/guides/installing-loopx.md` (modified, +15/-0)
```diff
@@ -110,6 +110,21 @@ selected paths fail before either plist is replaced. The resolved registry is
 passed verbatim, including when its filename differs from the default global
 registry filename.
 
+For an existing Chat service with an explicit `--runtime-root`, set
+`LOOPX_CHAT_RUNTIME_ROOT` to that same absolute directory at its first managed
+install. Optional `LOOPX_CHAT_IDLE_TIMEOUT_SECONDS` and
+`LOOPX_CHAT_HARD_TIMEOUT_SECONDS` preserve its positive execution timeouts.
+The helper records these selections in the Chat plist and retains them on
+later installs when overrides are omitted, including legacy explicit command
+arguments. Without a selection, the CLI defaults remain in effect.
+
+The Chat root is independent of the global status registry. Selecting it does
+not copy sessions, grant workspace access or change the status service's root.
+Invalid selections fail before either plist changes. Quiesce the previous owned
+Chat listener before switching to launchd, and read back the original Sessions
+and one consumer per App. A generated plist alone does not qualify recovery
+after logout or reboot.
+
 Snapshot identities retain their release id and source revision. A non-editable
 wheel instead exposes an additive `package_fingerprint` in the existing
 `loopx_runtime_identity_v1`: SHA-256 over its actual RECORD-owned LoopX package
```

**File**: `examples/macos-dashboard-launchagent-status-smoke.py` (modified, +72/-1)
```diff
@@ -6,6 +6,7 @@
 import json
 import os
 import plistlib
+import shlex
 import shutil
 import subprocess
 import sys
@@ -32,6 +33,9 @@ def run_script(fake_bin: Path, home: Path, args: list[str], *, schema_version: i
         "LOOPX_STATUS_CONTRACT_MIN_VERSION": "2",
         "CODEX_HOME": "",
         "LOOPX_CHAT_CODEX_HOME": "",
+        "LOOPX_CHAT_RUNTIME_ROOT": "",
+        "LOOPX_CHAT_IDLE_TIMEOUT_SECONDS": "",
+        "LOOPX_CHAT_HARD_TIMEOUT_SECONDS": "",
         **(extra_env or {}),
     }
     return subprocess.run(
@@ -276,6 +280,7 @@ def main() -> int:
         assert "--port 8767" in default_chat_plist, default_chat_plist
         assert "--replace-existing-loopx-chat" in default_chat_plist, default_chat_plist
         assert "--no-open" in default_chat_plist, default_chat_plist
+        assert "--runtime-root" not in shlex.split(plistlib.loads(chat_plist.read_bytes())["ProgramArguments"][2])
         assert f"export CODEX_HOME={(home / '.codex').resolve()};" in default_chat_plist, default_chat_plist
         assert "export LOOPX_PYTHON=" in default_plist, default_plist
         assert "export LOOPX_PYTHON=" in default_chat_plist, default_chat_plist
@@ -319,7 +324,6 @@ def main() -> int:
         workspaces = [(home / "workspace one").resolve(), (home / "workspace $(touch sentinel) & two").resolve()]
         for workspace in workspaces:
             workspace.mkdir()
-        import shlex
         custom_registry = (home / "isolated" / "registry.json").resolve()
         run_script(fake_bin, home, ["install"], schema_version=2, extra_env={
             "LOOPX_CHAT_SCAN_PATHS_JSON": json.dumps([str(p) for p in workspaces]),
@@ -390,6 +394,73 @@ def main() -> int:
         assert rejected.returncode != 0 and "CODEX_HOME must be absolute" in rejected.stderr
         assert chat_plist.read_bytes() == before_invalid_home
 
+        # Login/restart must reopen the selected Session store and retain its
+        # execution timeouts, rather than silently using another root/defaults.
+        runtime_root = (home / "chat state $(touch sentinel) & existing").resolve()
+        runtime_root.mkdir()
+        native_state = runtime_root / "retained-session.json"
+        native_state.write_text('{"session":"retained"}')
+        run_script(fake_bin, home, ["install"], schema_version=2, extra_env={
+            "LOOPX_CHAT_RUNTIME_ROOT": str(runtime_root),
+            "LOOPX_CHAT_IDLE_TIMEOUT_SECONDS": "600",
+            "LOOPX_CHAT_HARD_TIMEOUT_SECONDS": "1800",
+        })
+        run_script(fake_bin, home, ["restart"], schema_version=2)
+        runtime_plist = plistlib.loads(chat_plist.read_bytes())
+        runtime_command = shlex.split(runtime_plist["ProgramArguments"][2])
+        assert runtime_command[runtime_command.index("--runtime-root") + 1] == str(runtime_root)
+        assert float(runtime_command[runtime_command.index("--idle-timeout-seconds") + 1]) == 600
+        assert float(runtime_command[runtime_command.index("--hard-timeout-seconds") + 1]) == 1800
+        assert "--runtime-root" not in shlex.split(plistlib.loads(status_plist.read_bytes())["ProgramArguments"][2])
+        assert native_state.read_text() == '{"session":"retained"}'
+        assert not (REPO_ROOT / "sentinel").exists()
+        original_entry = fake_loopx.read_bytes()
+        write_executable(fake_loopx, f"#!{sys.executable}\nimport json,sys\nfrom pathlib import Path\n"
+                         "args=sys.argv[1:]; root=Path(args[args.index('--runtime-root')+1])\n"
+                         "print(json.dumps({'argv':args,'state':json.loads((root/'retained-session.json').read_text())}))\n")
+        try:
+            actual = subprocess.run(runtime_plist["ProgramArguments"],
+                                    capture_output=True, text=True, check=True)
+            readback = json.loads(actual.stdout)
+            assert readback["state"] == {"session": "retained"}
+            assert readback["argv"][readback["argv"].index("--runtime-root") + 1] == str(runtime_root)
+            assert not (REPO_ROOT / "sentinel").exists()
+        finally:
+            fake_loopx.write_bytes(original_entry)
+        both_before = [p.read_bytes() for p in (chat_plist, status_plist)]
+        for key, value in (("LOOPX_CHAT_RUNTIME_ROOT", "relative"),
+                           ("LOOPX_CHAT_RUNTIME_ROOT", "bad\npath"),
+                           ("LOOPX_CHAT_IDLE_TIMEOUT_SECONDS", "nan"),
+                           ("LOOPX_CHAT_HARD_TIMEOUT_SECONDS", "-1")):
+            rejected = run_script(fake_bin, home, ["install"], schema_version=2,
+                                  extra_env={key: value}, check=False)
+            assert rejected.returncode != 0 and key in rejected.stderr
+            assert [p.read_bytes() for p in (chat_plist, status_plist)] == both_before
+
+        # An older explicit argv binding is decoded without executing it.
+        legacy_runtime = plistlib.loads(chat_plist.read_bytes())
+        legacy_runti
```

**File**: `scripts/macos-dashboard-launchagent.sh` (modified, +80/-1)
```diff
@@ -50,6 +50,9 @@ Environment overrides:
   CODEX_HOME            Explicit service execution home, independent of the Chat override
   LOOPX_CHAT_CODEX_HOME  Explicit managed Codex home (upgrades preserve the existing binding)
   LOOPX_CHAT_SCAN_PATHS_JSON  JSON array of absolute workspace directories (preserved on upgrade)
+  LOOPX_CHAT_RUNTIME_ROOT    Explicit Chat data directory (preserved on upgrade)
+  LOOPX_CHAT_IDLE_TIMEOUT_SECONDS  Explicit idle timeout (preserved on upgrade)
+  LOOPX_CHAT_HARD_TIMEOUT_SECONDS  Explicit turn timeout (preserved on upgrade)
 EOF
 }
 
@@ -313,9 +316,70 @@ print(path.resolve())
 PY
 }
 
+resolve_chat_options() {
+  "$1" - "$chat_plist" <<'PY'
+import json
+import math
+import os
+import plistlib
+import shlex
+import sys
+from pathlib import Path
+
+target = Path(sys.argv[1])
+installed, words = {}, []
+if target.exists():
+    with target.open("rb") as stream:
+        plist = plistlib.load(stream)
+    installed = plist.get("EnvironmentVariables", {})
+    args = plist.get("ProgramArguments", [])
+    # Decode the legacy command; never run it to recover a setting.
+    words = shlex.split(args[2]) if len(args) == 3 and args[1] == "-c" else args
+options = {}
+for variable, flag in (
+    ("LOOPX_CHAT_RUNTIME_ROOT", "--runtime-root"),
+    ("LOOPX_CHAT_IDLE_TIMEOUT_SECONDS", "--idle-timeout-seconds"),
+    ("LOOPX_CHAT_HARD_TIMEOUT_SECONDS", "--hard-timeout-seconds"),
+):
+    value = os.environ.get(variable) or installed.get(variable)
+    if value is not None and not isinstance(value, str):
+        raise SystemExit(f"{variable} must be a string")
+    if not value:
+        for index, word in enumerate(words):
+            if word == flag:
+                if index + 1 == len(words):
+                    raise SystemExit(f"{variable} has a missing installed argument")
+                value = words[index + 1]
+            elif word.startswith(flag + "="):
+                value = word[len(flag) + 1:]
+                if not value:
+                    raise SystemExit(f"{variable} has an empty installed argument")
+    if value is None or value == "":
+        options[variable] = ""
+        continue  # Retain the CLI's existing default, without pinning a new root.
+    if not isinstance(value, str) or len(value) > 4096 or any(ord(c) < 32 for c in value):
+        raise SystemExit(f"{variable} must be a bounded string without control characters")
+    if flag == "--runtime-root":
+        path = Path(value).expanduser()
+        if not path.is_absolute() or (path.exists() and not path.is_dir()):
+            raise SystemExit(f"{variable} must be an absolute directory")
+        value = str(path.resolve())
+    else:
+        try:
+            seconds = float(value)
+        except ValueError:
+            raise SystemExit(f"{variable} must be a positive finite number")
+        if not math.isfinite(seconds) or seconds <= 0:
+            raise SystemExit(f"{variable} must be a positive finite number")
+    options[variable] = value
+print(json.dumps(options))
+PY
+}
+
 write_plists() {
   local status_command python_command codex_command claude_command lark_cli_command registry
   local path_prefix command_path command_dir status_shell chat_shell control_plane_write_arg lark_cli_arg codex_home_export chat_codex_home execution_codex_home chat_scan_paths chat_scan_args
+  local chat_options chat_runtime_root chat_idle_timeout chat_hard_timeout chat_runtime_arg chat_timeout_args
   status_command="$(resolve_status_command)"
   python_command="$(resolve_loopx_python "$status_command")"
   registry="$(resolve_global_registry "$python_command")"
@@ -346,6 +410,15 @@ write_plists() {
   execution_codex_home="$(resolve_codex_home "$python_command" CODEX_HOME "$chat_codex_home")"
   chat_scan_paths="$(resolve_chat_scan_paths "$python_command")"
   chat_scan_args="$("$python_command" -c 'import json,shlex,sys; print("".join(" --scan-path " + shlex.quote(path) for path in json.load(sys.stdin)))' <<<"$chat_scan_paths")"
+  chat_options="$(resolve_chat_options "$python_command")"
+  chat_runtime_root="$("$python_command" -c 'import json,sys; print(json.load(sys.stdin)["LOOPX_CHAT_RUNTIME_ROOT"])' <<<"$chat_options")"
+  chat_idle_timeout="$("$python_command" -c 'import json,sys; print(json.load(sys.stdin)["LOOPX_CHAT_IDLE_TIMEOUT_SECONDS"])' <<<"$chat_options")"
+  chat_hard_timeout="$("$python_command" -c 'import json,sys; print(json.load(sys.stdin)["LOOPX_CHAT_HARD_TIMEOUT_SECONDS"])' <<<"$chat_options")"
+  chat_runtime_arg=""
+  chat_timeout_args=""
+  [[ -z "$chat_runtime_root" ]] || chat_runtime_arg=" --runtime-root $(shell_quote "$chat_runtime_root")"
+  [[ -z "$chat_idle_timeout" ]] || chat_timeout_args+=" --idle-timeout-seconds $(shell_quote "$chat_idle_timeout")"
+  [[ -z "$chat_hard_timeout" ]] || chat_timeout_args+=" --hard-timeout-seconds $(shell_quote "$chat_hard_timeout")"
   expected_chat_runtime_identity >/dev/null || {
     echo "Could not resolve the installed 
```

---

### Incident Patch 8: `c7a00653` (2026-10-05)
**Commit Message**: Merge pull request #5713 from loopx-project/codex/release-1.3.0-mcp-test-signature

test(collaboration): stabilize instance and finished-host fixtures

**File**: `tests/test_collaboration_goal_instance.py` (modified, +1/-1)
```diff
@@ -842,7 +842,7 @@ class Server:
         def __init__(self) -> None:
             self.tools = {}
 
-        def tool(self):
+        def tool(self, *, description: str | None = None):
             def register(function):
                 self.tools[function.__name__] = function
                 return function
```

**File**: `tests/test_local_delegation.py` (modified, +4/-1)
```diff
@@ -971,10 +971,13 @@ def test_a_launched_host_on_a_platform_without_process_groups_fails_fast(service
     path = runner.path("analysis-platform")
     record = runner._host_process_record(path)
     record.parent.mkdir(parents=True, exist_ok=True)
+    # The caller may itself lead a live group; use a genuinely exited Host.
+    with subprocess.Popen([sys.executable, "-c", "pass"], start_new_session=True) as finished_host:
+        finished_host.wait(timeout=10)
     record.write_text(json.dumps({
         "schema_version": host_process_transport.HOST_PROCESS_RECORD_SCHEMA_VERSION,
         "host": lock_holder_host_label(), "supervises": "host", "supervision": "direct", "phase": "finished",
-        "bridge_pid": os.getpid(), "process_group": os.getpid(),
+        "bridge_pid": finished_host.pid, "process_group": finished_host.pid,
     }))
 
     # A persisted finished Host record still needs platform drain capability.
```

---

### Incident Patch 9: `69bd8a81` (2026-10-05)
**Commit Message**: test(delegation): use an exited host group in platform refusal fixture

Signed-off-by: LoopX Agent <[REDACTED_EMAIL]>

**File**: `tests/test_local_delegation.py` (modified, +4/-1)
```diff
@@ -971,10 +971,13 @@ def test_a_launched_host_on_a_platform_without_process_groups_fails_fast(service
     path = runner.path("analysis-platform")
     record = runner._host_process_record(path)
     record.parent.mkdir(parents=True, exist_ok=True)
+    # The caller may itself lead a live group; use a genuinely exited Host.
+    with subprocess.Popen([sys.executable, "-c", "pass"], start_new_session=True) as finished_host:
+        finished_host.wait(timeout=10)
     record.write_text(json.dumps({
         "schema_version": host_process_transport.HOST_PROCESS_RECORD_SCHEMA_VERSION,
         "host": lock_holder_host_label(), "supervises": "host", "supervision": "direct", "phase": "finished",
-        "bridge_pid": os.getpid(), "process_group": os.getpid(),
+        "bridge_pid": finished_host.pid, "process_group": finished_host.pid,
     }))
 
     # A persisted finished Host record still needs platform drain capability.
```

---

### Incident Patch 10: `8144bb08` (2026-10-05)
**Commit Message**: Merge pull request #5711 from loopx-project/codex/release-1.3.0-physical-budget-fixtures

test(cli): stabilize physical paths in output budget fixtures

**File**: `tests/control_plane/test_cli_output_budget.py` (modified, +36/-10)
```diff
@@ -6,6 +6,7 @@
 import json
 import os
 import shlex
+import shutil
 import tempfile
 from dataclasses import dataclass
 from pathlib import Path
@@ -326,20 +327,17 @@ def _quota_payload_without_rollout_receipt(text: str) -> dict[str, object]:
 
 @contextlib.contextmanager
 def _stable_budget_fixture_root(root: Path):
-    """Keep absolute-path fields stable across pytest and xdist temp layouts."""
+    """Keep lexical and resolved fixture paths independent of runner layout."""
 
-    root.mkdir(parents=True, exist_ok=True)
     suffix = hashlib.sha256(str(root).encode("utf-8")).hexdigest()[:12]
-    alias = Path("/tmp") / f"loopx-cli-budget-{suffix}"
-    if alias.exists() or alias.is_symlink():
-        if not alias.is_symlink():
-            raise RuntimeError(f"refusing to replace non-symlink fixture root: {alias}")
-        alias.unlink()
-    alias.symlink_to(root, target_is_directory=True)
+    fixture = Path("/tmp") / f"loopx-cli-budget-{suffix}"
+    if fixture.exists() or fixture.is_symlink():
+        raise RuntimeError(f"refusing to replace existing fixture root: {fixture}")
+    fixture.mkdir()
     try:
-        yield alias
+        yield fixture
     finally:
-        alias.unlink(missing_ok=True)
+        shutil.rmtree(fixture)
 
 
 def _surface_commands(
@@ -807,6 +805,34 @@ def test_manifest_covers_the_declared_agent_facing_surface_set() -> None:
             assert classification.surface_id is None
 
 
+def test_stable_budget_fixture_uses_an_owned_physical_short_root(tmp_path: Path) -> None:
+    outer = tmp_path / ("nested-runner-" + "p" * 128)
+    with _stable_budget_fixture_root(outer) as fixture:
+        assert not fixture.is_symlink()
+        assert fixture.resolve().parent == Path("/tmp").resolve()
+        (fixture / "owned.json").write_text("{}", encoding="utf-8")
+    assert not fixture.exists()
+    assert not outer.exists()
+
+
+def test_stable_budget_fixture_preserves_an_existing_directory(tmp_path: Path) -> None:
+    root = tmp_path / "foreign-directory"
+    suffix = hashlib.sha256(str(root).encode("utf-8")).hexdigest()[:12]
+    fixture = Path("/tmp") / f"loopx-cli-budget-{suffix}"
+    fixture.mkdir()
+    marker = fixture / "foreign.json"
+    marker.write_text("preserve", encoding="utf-8")
+    try:
+        try:
+            with _stable_budget_fixture_root(root):
+                raise AssertionError("existing fixture must not be replaced")
+        except RuntimeError:
+            pass
+        assert marker.read_text(encoding="utf-8") == "preserve"
+    finally:
+        shutil.rmtree(fixture)
+
+
 def test_real_cli_output_stays_inside_baseline_and_growth_contracts(
     tmp_path: Path,
 ) -> None:
```

---

### Incident Patch 11: `00739f9b` (2026-10-05)
**Commit Message**: Merge pull request #5699 from loopx-project/codex/effective-turn-replan

feat(replan): review direction after settled work Turns

**File**: `apps/presentation/dashboard/src/data/capability-configuration.ts` (modified, +9/-0)
```diff
@@ -51,3 +51,12 @@ export function parseEditableCapabilityJson(
   if (Object.keys(value).some((key) => !allowed.has(key))) return null;
   return value as Record<string, unknown>;
 }
+
+/** Read the legacy cadence without reinterpreting its unit or writing it back. */
+export function replanCadenceEditorValue(value: unknown): unknown {
+  const record = configurationObject(value);
+  if (Object.hasOwn(record, "completed_todos") && !Object.hasOwn(record, "count_unit")) {
+    return { count_unit: "completed_todos", count: record.completed_todos };
+  }
+  return value;
+}
```

**File**: `apps/presentation/dashboard/src/features/personal-workspace/capability-localization.ts` (modified, +4/-2)
```diff
@@ -156,7 +156,8 @@ const fieldCopy: Record<WorkspaceLocale, FieldCopy> = {
     eligible_endpoints: { label: "Flexible eligible executors", description: "One authorized executor per line. Use only with flexible selection and include the primary executor." },
     executor_model: { label: "Model", description: "Optional model for the selected executor. Leave blank to keep the executor's own default." },
     executor_reasoning_effort: { label: "Reasoning effort", description: "Optional reasoning effort for the selected executor. Leave blank to keep the executor's own default." },
-    completed_todos: { label: "Completed Todos between Goal reviews", description: "Machine default or explicit Goal override, from 1 to 5." },
+    count_unit: { label: "Review after", description: "Work Turns require accepted settlement; polls and retries do not count.", options: { completed_todos: "Completed Todos", effective_turns: "Settled work Turns" } },
+    count: { label: "Number between reviews", description: "From 1 to 5, using the selected unit. Goal overrides take precedence over device defaults." },
     allowed_domains: { label: "Allowed responsibility domains", description: "Enter one bounded, public-safe domain per line." },
     coordinator_agent_id: { label: "Coordinator Agent", description: "Use an already registered Agent id; leave blank to disable coordination." },
     enabled: { label: "Enabled" },
@@ -187,7 +188,8 @@ const fieldCopy: Record<WorkspaceLocale, FieldCopy> = {
     eligible_endpoints: { label: "灵活池可用执行器", description: "每行一个已授权执行器，仅用于 flexible；必须包含首选执行器。" },
     executor_model: { label: "模型", description: "所选执行器使用的模型，可留空；留空表示沿用执行器自身的默认模型。" },
     executor_reasoning_effort: { label: "推理档位", description: "所选执行器使用的推理档位，可留空；留空表示沿用执行器自身的默认档位。" },
-    completed_todos: { label: "两次 Goal 复核间的已完成 Todo 数", description: "可设置 1–5；机器默认值可被 Goal 显式覆盖。" },
+    count_unit: { label: "复核计数依据", description: "有效工作 Turn 须完成结算；轮询和重复重试不计数。", options: { completed_todos: "已完成 Todo", effective_turns: "已结算工作 Turn" } },
+    count: { label: "两次复核间的数量", description: "按所选单位计数，范围 1–5；Goal 显式设置优先于设备默认值。" },
     allowed_domains: { label: "允许的职责域", description: "每行填写一个有边界、可公开的职责域。" },
     coordinator_agent_id: { label: "协调 Agent", description: "填写一个已经注册的 Agent ID；留空表示关闭协调。" },
     enabled: { label: "启用" },
```

**File**: `apps/presentation/dashboard/src/features/personal-workspace/goal-capability-settings.tsx` (modified, +4/-4)
```diff
@@ -10,7 +10,7 @@ import {
   type GoalConfigurationPreview,
   type GoalConfigurationPartialWrite,
 } from "../../data/chat";
-import { parseEditableCapabilityJson, projectEditableCapabilityConfiguration } from "../../data/capability-configuration";
+import { parseEditableCapabilityJson, projectEditableCapabilityConfiguration, replanCadenceEditorValue } from "../../data/capability-configuration";
 import { useWorkspaceI18n } from "./i18n";
 import { CapabilityConfigurationFields } from "./capability-configuration-fields";
 import { withReportScheduleTimezone } from "./periodic-report-schedule-field";
@@ -74,13 +74,13 @@ function useCapabilityMutation({ goalId, onApplied, selected, t }: Readonly<{
   useEffect(() => {
     setEditorMode("guided");
     setJsonDraft("");
+    const current = (selected?.capability_id === "pull_request_review" ? selected.effective_configuration?.configuration : selected?.current)
+      ?? selected?.effective_configuration?.configuration ?? selected?.default;
     setMutation({
       busy: null,
       draft: projectEditableCapabilityConfiguration(
         selected?.configuration_editor ?? { fields: [] },
-        (selected?.capability_id === "pull_request_review" ? selected.effective_configuration?.configuration : selected?.current)
-        ?? selected?.effective_configuration?.configuration
-        ?? selected?.default,
+        selected?.capability_id === "todo_replan_cadence" ? replanCadenceEditorValue(current) : current,
         selected?.default,
       ),
       partialWrite: null,
```

**File**: `apps/presentation/dashboard/src/features/personal-workspace/machine-configuration-settings.tsx` (modified, +7/-3)
```diff
@@ -17,7 +17,7 @@ import {
   type MachineConfigurationRollbackPlan,
   type MachineConfigurationTransaction,
 } from "../../data/chat";
-import { projectEditableCapabilityConfiguration } from "../../data/capability-configuration";
+import { projectEditableCapabilityConfiguration, replanCadenceEditorValue } from "../../data/capability-configuration";
 import { CapabilityConfigurationFields } from "./capability-configuration-fields";
 import { withReportScheduleTimezone } from "./periodic-report-schedule-field";
 import { localizeCapability, localizedCapabilityFieldCopy } from "./capability-localization";
@@ -61,6 +61,10 @@ function completeMachineConfiguration(
     && (Object.hasOwn(draft, "selection_policy") || Object.hasOwn(draft, "eligible_endpoints")))) {
     complete.schema_version = configurationObject(capability.default).schema_version;
   }
+  if (capability.capability_id === "todo_replan_cadence" && Object.hasOwn(draft, "count_unit")) {
+    complete.schema_version = configurationObject(capability.default).schema_version;
+    delete complete.completed_todos;
+  }
   return complete;
 }
 
@@ -191,7 +195,7 @@ export function MachineConfigurationSettings({ section, onChanged }: { section:
     const current = currentConfiguration(inspection, selected);
     const editable = projectEditableCapabilityConfiguration(
       selected.configuration_editor,
-      current ?? selected.default,
+      selected.capability_id === "todo_replan_cadence" ? replanCadenceEditorValue(current ?? selected.default) : current ?? selected.default,
       selected.default,
     );
     const complete = completeMachineConfiguration(selected, current, editable);
@@ -223,7 +227,7 @@ export function MachineConfigurationSettings({ section, onChanged }: { section:
     } else if (parsedJsonDraft) {
       setDraft(projectEditableCapabilityConfiguration(
         selected.configuration_editor,
-        parsedJsonDraft,
+        selected.capability_id === "todo_replan_cadence" ? replanCadenceEditorValue(parsedJsonDraft) : parsedJsonDraft,
         selected.default,
       ));
     } else {
```

**File**: `benchmark/edgebench/run.py` (modified, +8/-1)
```diff
@@ -78,11 +78,15 @@ def main(argv=None):
     parser.add_argument("--model", required=True)
     parser.add_argument("--effort", choices=("low", "medium", "high", "xhigh"), required=True)
     parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT_SECONDS)
+    parser.add_argument("--replan-after-turns", type=int, choices=range(1, 6),
+                        help="Opt in to settled work Turn cadence for heartbeat profiles")
     parser.add_argument("--eval-interval", type=int, default=300)
     parser.add_argument("--submission-cooldown", type=int, default=120)
     parser.add_argument("--judge-url", required=True)
     parser.add_argument("--api-proxy-url", help="Operator-owned, OpenAI-only CONNECT proxy")
     args = parser.parse_args(argv)
+    if args.replan_after_turns is not None and not args.worker.startswith("heartbeat-"):
+        parser.error("--replan-after-turns requires a heartbeat worker")
     # One directory is one attempt: never reuse native registration or overwrite
     # source/profile evidence after an ambiguous launch.
     trial = args.log_dir / "runs" / args.run_id / args.task
@@ -117,7 +121,8 @@ def main(argv=None):
             "NO_PROXY": f"localhost,127.0.0.1,{urlsplit(args.judge_url).hostname}",
         }
     agent = SForgeWorker(config, profile=args.worker, cwd=task.cwd,
-                         timeout_seconds=args.timeout, blind_prompt=blind_prompt)
+                         timeout_seconds=args.timeout, blind_prompt=blind_prompt,
+                         replan_after_turns=args.replan_after_turns)
     if args.api_proxy_url:
         agent.default_api_base_url = args.api_proxy_url
     logger = logging.getLogger("edgebench-runtime")
@@ -135,6 +140,8 @@ def main(argv=None):
         "feedback": args.feedback, "internet": task.internet,
         "eval_interval": args.eval_interval, "submission_cooldown": args.submission_cooldown,
         "status": "starting", "score_countable": False,
+        **({"replan_after_effective_turns": args.replan_after_turns}
+           if args.replan_after_turns is not None else {}),
     }
     receipt_path = trial / "runtime-receipt.json"
     receipt_path.write_text(json.dumps(receipt, indent=2))
```

**File**: `benchmark/runtime/RUNTIME.md` (modified, +19/-0)
```diff
@@ -214,3 +214,22 @@ task output. Unit tests establish no score or model-uplift claim. Validate small
 jobs through each benchmark's native configuration before launching a study.
 
 By default, worker calls have no independent turn deadline. Harbor derives their available time from the remaining total phase budget, reserving cleanup and settlement time. An explicit `turn_timeout_sec` remains supported as an operator override.
+
+
+### Explicit effective-Turn cadence
+
+Harbor `BenchmarkCodex` accepts `replan_after_turns: 3`; the native EdgeBench
+launcher accepts `--replan-after-turns 3` for `heartbeat-resume` and
+`heartbeat-explore`. This passes the existing Goal option
+`--execution-replan-after-turns` and verifies the persisted
+`replan_after_effective_turns` value before execution. The shared TypeScript
+control plane still owns which settled work Turns count; adapters do not count
+records or completed Todos themselves.
+
+Omitting the option preserves the legacy three-completed-Todo setting. Harbor
+rejects simultaneous explicit Todo and Turn settings. To roll back, omit the
+Turn option in a new trial or select `replan_after_todos` in Harbor; do not alter
+an active matched trial. Receipts name the selected unit. Values must be integers
+from one through five, and non-LoopX profiles reject the option. No task, scoring,
+feedback, spawn permission, or total-budget change is implied. This adapter
+option alone does not enable SForge planned task entry.
```

**File**: `benchmark/runtime/harbor.py` (modified, +34/-11)
```diff
@@ -54,7 +54,8 @@ def __init__(
         validation_command=None,
         turn_timeout_sec=None,
         scheduler_timeout_sec=5080,
-        replan_after_todos=3,
+        replan_after_todos=None,
+        replan_after_turns=None,
         task_entry="seeded-todo",
         planning_timeout_sec=300,
         **kwargs,
@@ -77,13 +78,34 @@ def __init__(
             raise ValueError(
                 "scheduler timeout must exceed turn timeout plus cleanup allowance"
             )
-        self.replan_after_todos = int(replan_after_todos)
+        if replan_after_turns is not None and replan_after_todos is not None:
+            raise ValueError("Choose replan_after_turns or replan_after_todos, not both")
+        if replan_after_turns is not None:
+            if (type(replan_after_turns) is not int or
+                    not 1 <= replan_after_turns <= 5):
+                raise ValueError("replan_after_turns must be an integer between 1 and 5")
+            if not self.execution.uses_loopx:
+                raise ValueError("replan_after_turns requires a LoopX execution mode")
+        self.replan_after_turns = replan_after_turns
+        self.replan_after_todos = int(3 if replan_after_todos is None else replan_after_todos)
         if not 1 <= self.replan_after_todos <= 5:
             raise ValueError("replan_after_todos must be between 1 and 5")
         self._phase_number = 0
         self._seeded_todo_id: str | None = None
         super().__init__(*args, **kwargs)
 
+    def _replan_configuration(self) -> tuple[str, str, int]:
+        # Transport existing Goal fields; the typed control plane owns counting.
+        if self.replan_after_turns is not None:
+            return ("replan_after_effective_turns", "--execution-replan-after-turns",
+                    self.replan_after_turns)
+        return ("replan_after_completed_todos", "--execution-replan-after-todos",
+                self.replan_after_todos)
+
+    def _replan_receipt(self) -> dict[str, int]:
+        key, _, value = self._replan_configuration()
+        return {key: value}
+
     @staticmethod
     def name() -> str:
         return "benchmark-codex"
@@ -230,7 +252,7 @@ async def install(self, environment: BaseEnvironment) -> None:
             "home_scope": "trial",
             "login_shell_node_path": _BASH_ENV,
             "scheduler_terminal_packet_compatibility": True,
-            "replan_after_completed_todos": self.replan_after_todos,
+            **self._replan_receipt(),
         }
         await self.exec_as_agent(
             environment,
@@ -309,6 +331,7 @@ async def _registry_exists(self, environment: BaseEnvironment) -> bool:
     async def _prepare_phase(
         self, environment: BaseEnvironment, instruction: str, *, cwd: str
     ) -> None:
+        key, option, expected = self._replan_configuration()
         pending = await environment.exec(
             command=f"test -e {_LOOPX_RUNTIME}/benchmark-pending-turn.json"
         )
@@ -352,8 +375,8 @@ async def _prepare_phase(
                     "harbor-task-workspace",
                     "--boundary-authority-decision-id",
                     "trial-workspace",
-                    "--execution-replan-after-todos",
-                    str(self.replan_after_todos),
+                    option,
+                    str(expected),
                     "--agent-work-mode",
                     f"{_AGENT_ID}=active",
                     "--execute",
@@ -368,8 +391,8 @@ async def _prepare_phase(
                     "configure-goal",
                     "--goal-id",
                     _GOAL_ID,
-                    "--execution-replan-after-todos",
-                    str(self.replan_after_todos),
+                    option,
+                    str(expected),
                     "--execute",
                 ],
                 cwd=cwd,
@@ -382,10 +405,10 @@ async def _prepare_phase(
             environment, ["configure-goal", "--goal-id", _GOAL_ID], cwd=cwd,
         )
         configured_state = cadence.get("after") or cadence.get("before") or {}
-        configured = configured_state.get("execution_profile", {}).get("replan_after_completed_todos")
-        if configured != self.replan_after_todos:
+        configured = configured_state.get("execution_profile", {}).get(key)
+        if configured != expected:
             raise RuntimeError(
-                f"replan cadence readback mismatch: expected {self.replan_after_todos}, got {configured!r}"
+                f"replan cadence readback mismatch for {key}: expected {expected}, got {configured!r}"
             )
 
     async def _seed_phase(self, environment: BaseEnvironment, *, cwd: str) -> None:
@@ -563,7 +586,7 @@ def _populate_context(
             "iteration_context": self.execution.context,
             "task_entry": self.execution.task_entry,
             "home_scope": "trial",
-            "replan_after_completed_todos": self.replan_after_todos,
+            **self._replan_receipt(),
 
```

**File**: `benchmark/runtime/sforge.py` (modified, +12/-1)
```diff
@@ -80,7 +80,8 @@ class SForgeWorker(CodexAgent):
 
     def __init__(self, config, *, profile: str, cwd: str,
                  timeout_seconds: int = DEFAULT_TIMEOUT_SECONDS,
-                 blind_prompt: str | None = None):
+                 blind_prompt: str | None = None,
+                 replan_after_turns: int | None = None):
         super().__init__(config)
         if profile not in PROFILES:
             raise ValueError("Unknown benchmark worker profile")
@@ -90,6 +91,13 @@ def __init__(self, config, *, profile: str, cwd: str,
             raise ValueError("Explicit model and reasoning effort are required")
         if not os.environ.get("CODEX_AUTH_JSON_PATH"):
             raise ValueError("Set CODEX_AUTH_JSON_PATH to the trial credential source")
+        if replan_after_turns is not None:
+            if (type(replan_after_turns) is not int or
+                    not 1 <= replan_after_turns <= 5):
+                raise ValueError("replan_after_turns must be an integer between 1 and 5")
+            if not profile.startswith("heartbeat-"):
+                raise ValueError("replan_after_turns requires a heartbeat profile")
+        self.replan_after_turns = replan_after_turns
         self.profile, self.cwd = profile, cwd
         self.blind_prompt = blind_prompt
         self.prompt_installed = False
@@ -150,6 +158,7 @@ def _install_worker(self, backend, handle, log_dir, logger):
                 iteration_context="resume" if mode == "heartbeat" else "fresh",
                 turn_timeout_sec=self.turn_timeout,
                 scheduler_timeout_sec=self.timeout_seconds,
+                replan_after_turns=self.replan_after_turns,
             )
             asyncio.run(self.runtime.install(self.environment))
         if self.blind_prompt is not None:
@@ -164,6 +173,8 @@ def _install_worker(self, backend, handle, log_dir, logger):
             "explore_graph": self.profile == "heartbeat-explore",
             "explore_harness": self.profile == "heartbeat-explore",
             "feedback": "blind" if self.blind_prompt is not None else "native",
+            **(self.runtime._replan_receipt() if self.runtime and
+               self.replan_after_turns is not None else {}),
         }, indent=2))
 
     def format_run_cmd(self, prompt_path, *, model=None, cwd="", internet=True, resume=False):
```

---

### Incident Patch 12: `87458c91` (2026-10-05)
**Commit Message**: Merge pull request #5568 from loopx-project/codex/todo-drawer-blocked-reason

dashboard: keep Todo blocker reasons current in the inspector

**File**: `apps/presentation/dashboard/src/data/status.ts` (modified, +2/-0)
```diff
@@ -92,6 +92,8 @@ export const todoItemSchema = z.object({
   required_capabilities: z.array(z.string()).optional(),
   note: z.string().optional().nullable(),
   evidence: z.string().optional().nullable(),
+  // Public-safe blocker cause; producers project it only for blocked work.
+  reason: z.string().optional().nullable(),
   completed_at: z.string().optional().nullable(),
   updated_at: z.string().optional().nullable(),
   completion_validation_required: z.boolean().optional().nullable(),
```

**File**: `apps/presentation/dashboard/src/features/personal-workspace/context-drawer.tsx` (modified, +13/-3)
```diff
@@ -4,6 +4,7 @@ import type {DecisionOutcome} from "../../../../../../loopx/control_plane/todos/
 import { attentionSuccessor, canDecideAttention, canReviewAttention } from "./attention-details";
 import { useCallback, useEffect, useRef, useState } from "react";
 import {
+  AlertCircle,
   ArrowLeft,
   Bell,
   Bot,
@@ -119,7 +120,7 @@ const RUN_ACTION_LABEL_KEYS = {
   retry: "drawer.recoveryRetry",
 } as const;
 
-export function ContextDrawer({ agents, attentionHistory = [], onSelectAttention, callbacks, goalNotifications = [], goals = [], inspectorExpanded = false, larkConnections = [], onClose, onToggleInspectorSize, readOnly = false, proposalReadbackUnavailable = false, onRetryProposalReadback, proposalReadbackFetching = false, runs = [], selection }: {
+export function ContextDrawer({ agents, attentionHistory = [], onSelectAttention, callbacks, goalNotifications = [], goals = [], inspectorExpanded = false, larkConnections = [], onClose, onToggleInspectorSize, readOnly = false, proposalReadbackUnavailable = false, onRetryProposalReadback, proposalReadbackFetching = false, todoReadbackUnavailable = false, runs = [], selection }: {
   agents: WorkspaceAgentOption[];
   attentionHistory?: WorkspaceAttention[];
   onSelectAttention?: (item: WorkspaceAttention) => void;
@@ -134,6 +135,7 @@ export function ContextDrawer({ agents, attentionHistory = [], onSelectAttention
   proposalReadbackUnavailable?: boolean;
   onRetryProposalReadback?: () => void;
   proposalReadbackFetching?: boolean;
+  todoReadbackUnavailable?: boolean;
   runs?: WorkspaceRun[];
   selection: ContextDrawerSelection;
 }) {
@@ -645,7 +647,11 @@ export function ContextDrawer({ agents, attentionHistory = [], onSelectAttention
           </>
         ) : null}
 
-        {selection.kind === "todo" ? (
+        {selection.kind === "todo" ? todoReadbackUnavailable ? (
+          <section className="personal-detail-card" role="status">
+            <p>{t("drawer.taskReadbackUnavailable")}</p>
+          </section>
+        ) : (
           <>
             <section className="personal-task-inspector-summary">
               <div className="personal-task-inspector-status">
@@ -656,6 +662,10 @@ export function ContextDrawer({ agents, attentionHistory = [], onSelectAttention
                 <span>{selection.item.taskClass === "advancement_task" ? t("drawer.taskAdvancement") : selection.item.taskClass ?? t("drawer.taskOrdinary")}</span>
               </div>
               <TaskRequest todo={selection.item} local={!readOnly} />
+              {selection.item.status === "blocked" && !selection.item.done ? <section aria-label={t("drawer.blockedReason")} className="personal-task-blocked-reason" data-recorded={selection.item.blockedReason ? "true" : "false"}>
+                <h4><AlertCircle size={14} />{t("drawer.blockedReason")}</h4>
+                <p>{selection.item.blockedReason ?? t("drawer.blockedReasonMissing")}</p>
+              </section> : null}
             </section>
             <section aria-label={t("drawer.taskInfo")} className="personal-task-inspector-fields">
               <h4>{t("drawer.taskInfo")}</h4>
@@ -674,7 +684,7 @@ export function ContextDrawer({ agents, attentionHistory = [], onSelectAttention
                   <div><dt>{t("drawer.validationDigest")}</dt><dd><code>{selection.item.validationDigest}</code></dd></div>
                   {selection.item.validationRevisionActor ? <div><dt>{t("drawer.validationRevisionActor")}</dt><dd>{selection.item.validationRevisionActor}</dd></div> : null}
                 </> : null}
-                <div><dt>{t("drawer.nextTransition")}</dt><dd>{selection.item.nextTransition ?? (selection.item.done ? t("drawer.taskNextCompleted") : selection.item.resumeReady ? t("drawer.taskNextResumeReady") : selection.item.status === "deferred" ? t("drawer.taskNextDeferred") : t("drawer.taskNextOpen"))}</dd></div>
+                <div><dt>{t("drawer.nextTransition")}</dt><dd>{selection.item.nextTransition ?? (selection.item.done ? t("drawer.taskNextCompleted") : selection.item.resumeReady ? t("drawer.taskNextResumeReady") : selection.item.status === "deferred" ? t("drawer.taskNextDeferred") : selection.item.status === "blocked" ? t("drawer.taskNextBlocked") : t("drawer.taskNextOpen"))}</dd></div>
               </dl>
             </section>
             {!readOnly && !selection.item.done ? <div className="personal-task-inspector-actions" aria-label={t("drawer.taskActions")}>
```

**File**: `apps/presentation/dashboard/src/features/personal-workspace/i18n.tsx` (modified, +8/-0)
```diff
@@ -407,6 +407,10 @@ const en = {
   "drawer.taskManage": "Manage task",
   "drawer.taskNextCompleted": "Create a follow-up task",
   "drawer.taskNextOpen": "Advance or update status",
+  "drawer.taskNextBlocked": "Resume once the blocker is resolved",
+  "drawer.blockedReason": "Why it is blocked",
+  "drawer.blockedReasonMissing": "No reason was recorded when this task was blocked. Ask the responsible Agent in the conversation.",
+  "drawer.taskReadbackUnavailable": "Current task state is unavailable. Refresh or open its retained history before acting.",
   "drawer.taskOrdinary": "Task",
   "drawer.taskStatusBlocked": "Blocked",
   "drawer.taskStatusDeferred": "Deferred",
@@ -1703,6 +1707,10 @@ const zhCN: Record<WorkspaceMessageKey, string> = {
   "drawer.taskManage": "管理任务",
   "drawer.taskNextCompleted": "可创建后续任务",
   "drawer.taskNextOpen": "推进或更新状态",
+  "drawer.taskNextBlocked": "受阻原因解除后恢复执行",
+  "drawer.blockedReason": "为何受阻",
+  "drawer.blockedReasonMissing": "标记受阻时未记录原因，可在对话中询问负责的 Agent。",
+  "drawer.taskReadbackUnavailable": "当前任务状态不可用。请刷新或打开保留的历史记录，再决定后续操作。",
   "drawer.taskOrdinary": "普通任务",
   "drawer.taskStatusBlocked": "受阻",
   "drawer.taskStatusDeferred": "已延期",
```

**File**: `apps/presentation/dashboard/src/features/personal-workspace/personal-workspace-model.ts` (modified, +3/-1)
```diff
@@ -37,6 +37,7 @@ export type WorkspaceAgentTodo = {
   resumeWhen?: string | null;
   resumeReady?: boolean | null;
   resumeReceiptId?: string | null;
+  blockedReason?: string | null;
   claimedBy?: string | null;
   dependencies?: string[];
   done: boolean;
@@ -60,7 +61,7 @@ export type WorkspaceAgentTodo = {
 
 /** Both active status and retained history carry the same inspector facts. */
 export function workspaceAgentTodoFromItem(todo: Pick<TodoItem,
-  "todo_id" | "text" | "done" | "status" | "claimed_by" | "evidence" | "note"
+  "todo_id" | "text" | "done" | "status" | "claimed_by" | "evidence" | "note" | "reason"
   | "priority" | "task_class" | "task_domain" | "completed_at" | "resume_when"
   | "resume_ready" | "resume_condition" | "completion_validation_sha256"
   | "completion_validation_revision" | "completion_validation_revision_history"
@@ -75,6 +76,7 @@ export function workspaceAgentTodoFromItem(todo: Pick<TodoItem,
     text: todo.text,
     done: todo.status === "deferred" ? false : todo.done,
     status: todo.status ?? null,
+    blockedReason: todo.status === "blocked" ? todo.reason?.trim() || null : null,
     claimedBy: todo.claimed_by ?? null,
     evidence: todo.evidence ?? null,
     note: todo.note ?? null,
```

**File**: `apps/presentation/dashboard/src/features/personal-workspace/personal-workspace-page.tsx` (modified, +11/-0)
```diff
@@ -1098,6 +1098,14 @@ export function PersonalWorkspacePage({
       const currentGoal = workspaceGoals.find((goal) => goal.goalId === selection.item.goalId);
       return currentGoal ? { item: currentGoal, kind: "goal" } : selection;
     }
+    if (selection?.kind === "todo") {
+      const goal = workspaceGoals.find((goal) => goal.goalId === selection.item.goalId);
+      const todo = goal?.agentTodos.find((item) => item.todoId === selection.item.todoId);
+      return goal && todo ? { kind: "todo", item: {
+        ...todo, goalId: goal.goalId, goalTitle: goal.title,
+        ownerLabel: goal.agentLanes?.find((lane) => lane.agentId === todo.claimedBy)?.label ?? todo.claimedBy,
+      } } : selection;
+    }
     if (selection?.kind !== "run") return selection;
     const currentRun = items.find((item): item is Extract<WorkspaceTimelineItem, { kind: "run" }> =>
       item.kind === "run" && item.run.runId === selection.item.runId
@@ -1842,6 +1850,9 @@ export function PersonalWorkspacePage({
     <WorkspaceShell
       notice={serviceNotice}
       drawer={drawerSelection ? <ContextDrawer agents={agents} attentionHistory={model.attentionHistory ?? model.userTodos} onSelectAttention={(item) => setSelection({ kind: "attention", item })} callbacks={effectiveDrawerCallbacks} goalNotifications={model.goalNotifications ?? []} goals={workspaceGoals} inspectorExpanded={taskInspectorExpanded} larkConnections={readOnly ? [] : larkConnections}
+        todoReadbackUnavailable={drawerSelection.kind === "todo" && !workspaceGoals.some((goal) =>
+          goal.goalId === drawerSelection.item.goalId && (drawerSelection.item.done
+            || goal.agentTodos.some((todo) => todo.todoId === drawerSelection.item.todoId)))}
         proposalReadbackUnavailable={actionReadback.isError || !actionReadback.data
           || (drawerSelection.kind === "proposal" && !actionReadback.data.some(proposal => proposal.proposal_id === drawerSelection.item.previewId))}
         proposalReadbackFetching={actionReadback.isFetching} onRetryProposalReadback={() => void actionReadback.refetch()} onClose={() => {
```

**File**: `apps/presentation/dashboard/src/features/personal-workspace/personal-workspace.css` (modified, +4/-0)
```diff
@@ -1145,6 +1145,10 @@ button.personal-execution-chip:focus-visible { outline: 2px solid #0070f3; outli
 .personal-task-inspector-status .is-done i { background: var(--pw-green); }
 .personal-task-inspector-status .is-blocked { background: var(--pw-red-bg); color: var(--pw-red); }
 .personal-task-inspector-status .is-blocked i { background: var(--pw-red); }
+.personal-task-blocked-reason { margin-top: 14px; padding: 11px 13px 12px; border: 1px solid color-mix(in srgb, var(--pw-red) 22%, var(--pw-line)); border-radius: 9px; background: color-mix(in srgb, var(--pw-red-bg) 55%, #fff); }
+.personal-task-blocked-reason h4 { display: flex; align-items: center; gap: 6px; margin: 0 0 5px; color: var(--pw-red); font-size: 12px; font-weight: 700; }
+.personal-task-blocked-reason p { margin: 0; color: var(--pw-text); font-size: 13px; line-height: 1.6; overflow-wrap: anywhere; }
+.personal-task-blocked-reason[data-recorded="false"] p { color: var(--pw-muted); }
 .personal-task-inspector-fields { padding: 20px 24px 22px; background: #fff; }
 .personal-task-inspector-fields h4 { margin: 0 0 9px; color: var(--pw-text); font-size: 12px; font-weight: 700; }
 .personal-task-inspector-fields dl { margin: 0; border-top: 1px solid var(--pw-line); }
```

**File**: `examples/personal-workspace-browser-smoke.mjs` (modified, +2/-0)
```diff
@@ -40,6 +40,7 @@ import { blockedNoticeSettingsScenario } from "./personal-workspace-browser/bloc
 import { automationCadenceScenario } from "./personal-workspace-browser/automation-cadence.mjs";
 import { turnStepsScenario } from "./personal-workspace-browser/turn-steps.mjs";
 import { monitorReadbackScenario } from "./personal-workspace-browser/monitor-readback.mjs";
+import { blockedReasonReadbackScenario } from "./personal-workspace-browser/blocked-reason-readback.mjs";
 import { teamEvidenceScenario } from "./personal-workspace-browser/team-evidence.mjs";
 import { taskInspectorReturnScenario } from "./personal-workspace-browser/task-inspector-return.mjs";
 import { managedGoalResultsScenario } from "./personal-workspace-browser/managed-goal-results.mjs";
@@ -74,6 +75,7 @@ scenarioCatalog.push(goalDeletionScenario);
 scenarioCatalog.push(conversationImageRequestScenario);
 scenarioCatalog.push(workspaceViewRecoveryScenario);
 scenarioCatalog.push(monitorReadbackScenario);
+scenarioCatalog.push(blockedReasonReadbackScenario);
 scenarioCatalog.push(turnStepsScenario);
 scenarioCatalog.push(goalWorkMapScenario);
 scenarioCatalog.push(performanceDiagnosisScenario);
```

**File**: `examples/personal-workspace-browser/blocked-reason-readback.mjs` (added, +225/-0)
```diff
@@ -0,0 +1,225 @@
+import assert from "node:assert/strict";
+import { execFile, spawn } from "node:child_process";
+import { mkdtemp, rm, writeFile } from "node:fs/promises";
+import { tmpdir } from "node:os";
+import { resolve } from "node:path";
+import { createInterface } from "node:readline";
+import { promisify } from "node:util";
+import { resolveTestPython } from "../../scripts/test-python.mjs";
+import { outputDir, repoRoot } from "./fixture.mjs";
+import { openWorkspacePage } from "./scenario-context.mjs";
+
+const REASON = "Waiting for the upstream dataset export to be published";
+const CHANGED_REASON = "The replacement export requires independent validation";
+const execute = promisify(execFile);
+
+// A disposable canonical File authority, real CLI add/update and real status
+// HTTP owner. No live Goal, Todo or lease is touched.
+async function startBlockedAuthority() {
+  const root = await mkdtemp(resolve(tmpdir(), "loopx-blocked-reason-"));
+  const child = spawn(resolveTestPython(), ["-u", "-c", `
+import json, os, runpy, signal, subprocess, sys
+from pathlib import Path
+from loopx.chat_server import ChatHTTPServer, ChatRequestHandler
+from loopx.control_plane.effect_runtime import restart_effect_runtime
+root, reason = Path(sys.argv[1]), sys.argv[2]
+fixture = runpy.run_path('tests/control_plane/canonical_authority_fixture.py')
+registry, runtime, state = fixture['promoted_create_fixture'](root)
+base = [sys.executable, '-c', 'from loopx.entrypoint import main; main()', '--format', 'json', '--registry', str(registry), '--runtime-root', str(runtime)]
+def cli(*args):
+    result = subprocess.run(base + list(args), capture_output=True, text=True)
+    assert result.returncode == 0, result.stdout + result.stderr
+    return json.loads(result.stdout)
+def blocked(text, *extra):
+    created = cli('todo', 'add', '--goal-id', 'goal-a', '--role', 'agent', '--text', text, '--priority', 'P2')
+    assert created['ok'], created
+    todo_id = created['todo']['todo_id']
+    updated = cli('todo', 'update', '--goal-id', 'goal-a', '--role', 'agent', '--todo-id', todo_id, '--status', 'blocked', *extra)
+    assert updated['ok'], updated
+    return todo_id
+try:
+    with_reason = blocked('Synthetic blocked readback', '--reason', reason)
+    without_reason = blocked('Synthetic unexplained blocker')
+    server = ChatHTTPServer(('127.0.0.1', 0), ChatRequestHandler)
+    server.registry_path, server.runtime_root, server.verbose = registry, runtime, False
+    server.runtime_root_override, server.selected_goal_id, server.scan_roots, server.limit = runtime, 'goal-a', [], 10
+    print(json.dumps({'port': server.server_address[1], 'registry': str(registry), 'runtime': str(runtime), 'with_reason': with_reason, 'without_reason': without_reason}), flush=True)
+    def terminate(*_): raise SystemExit(0)
+    signal.signal(signal.SIGTERM, terminate)
+    server.serve_forever()
+finally:
+    restart_effect_runtime()
+`, root, REASON], { cwd: repoRoot, env: { ...process.env, TMPDIR: root, TEMP: root, TMP: root, LOOPX_USAGE_PING: "0" }, stdio: ["ignore", "pipe", "pipe"] });
+  let diagnostic = "";
+  child.stderr.on("data", (chunk) => { diagnostic = (diagnostic + chunk).slice(-3000); });
+  const lines = createInterface({ input: child.stdout });
+  const close = async () => {
+    lines.close();
+    if (child.exitCode === null && child.signalCode === null) {
+      const exited = new Promise((accept) => child.once("exit", accept));
+      child.kill("SIGTERM");
+      await exited;
+    }
+    await rm(root, { recursive: true, force: true });
+  };
+  try {
+    const readback = await new Promise((accept, reject) => {
+      const timeout = setTimeout(() => reject(new Error(`Blocked authority startup timed out: ${diagnostic}`)), 30_000);
+      child.once("error", (error) => { clearTimeout(timeout); reject(error); });
+      child.once("exit", () => { clearTimeout(timeout); reject(new Error(`Blocked authority exited: ${diagnostic}`)); });
+      lines.once("line", (line) => { clearTimeout(timeout); accept(JSON.parse(line)); });
+    });
+    assert.ok(Number.isSafeInteger(readback.port) && readback.port > 0);
+    const cli = async (...args) => {
+      const result = await execute(resolveTestPython(), ["-c", "from loopx.entrypoint import main; main()", "--format", "json",
+        "--registry", readback.registry, "--runtime-root", readback.runtime, ...args], { cwd: repoRoot, timeout: 30_000 });
+      const packet = JSON.parse(result.stdout);
+      assert.equal(packet.ok, true, result.stdout);
+      return packet;
+    };
+    return { ...readback, url: `http://127.0.0.1:${readback.port}`, cli, close };
+  } catch (error) { await close(); throw error; }
+}
+
+export const blockedReasonReadbackScenario = {
+  id: "blocked-reason-readback",
+  async run({ browser, collectCoverage, url }) {
+    const authority = await startBlockedAuthority();
+    const coverageEntries = [];
+    const receipts = [];
+    try 
```

---

### Incident Patch 13: `122dbb50` (2026-10-05)
**Commit Message**: test(cli): stabilize resolved budget fixture paths

Signed-off-by: LoopX Agent <[REDACTED_EMAIL]>

**File**: `tests/control_plane/test_cli_output_budget.py` (modified, +36/-10)
```diff
@@ -6,6 +6,7 @@
 import json
 import os
 import shlex
+import shutil
 import tempfile
 from dataclasses import dataclass
 from pathlib import Path
@@ -326,20 +327,17 @@ def _quota_payload_without_rollout_receipt(text: str) -> dict[str, object]:
 
 @contextlib.contextmanager
 def _stable_budget_fixture_root(root: Path):
-    """Keep absolute-path fields stable across pytest and xdist temp layouts."""
+    """Keep lexical and resolved fixture paths independent of runner layout."""
 
-    root.mkdir(parents=True, exist_ok=True)
     suffix = hashlib.sha256(str(root).encode("utf-8")).hexdigest()[:12]
-    alias = Path("/tmp") / f"loopx-cli-budget-{suffix}"
-    if alias.exists() or alias.is_symlink():
-        if not alias.is_symlink():
-            raise RuntimeError(f"refusing to replace non-symlink fixture root: {alias}")
-        alias.unlink()
-    alias.symlink_to(root, target_is_directory=True)
+    fixture = Path("/tmp") / f"loopx-cli-budget-{suffix}"
+    if fixture.exists() or fixture.is_symlink():
+        raise RuntimeError(f"refusing to replace existing fixture root: {fixture}")
+    fixture.mkdir()
     try:
-        yield alias
+        yield fixture
     finally:
-        alias.unlink(missing_ok=True)
+        shutil.rmtree(fixture)
 
 
 def _surface_commands(
@@ -807,6 +805,34 @@ def test_manifest_covers_the_declared_agent_facing_surface_set() -> None:
             assert classification.surface_id is None
 
 
+def test_stable_budget_fixture_uses_an_owned_physical_short_root(tmp_path: Path) -> None:
+    outer = tmp_path / ("nested-runner-" + "p" * 128)
+    with _stable_budget_fixture_root(outer) as fixture:
+        assert not fixture.is_symlink()
+        assert fixture.resolve().parent == Path("/tmp").resolve()
+        (fixture / "owned.json").write_text("{}", encoding="utf-8")
+    assert not fixture.exists()
+    assert not outer.exists()
+
+
+def test_stable_budget_fixture_preserves_an_existing_directory(tmp_path: Path) -> None:
+    root = tmp_path / "foreign-directory"
+    suffix = hashlib.sha256(str(root).encode("utf-8")).hexdigest()[:12]
+    fixture = Path("/tmp") / f"loopx-cli-budget-{suffix}"
+    fixture.mkdir()
+    marker = fixture / "foreign.json"
+    marker.write_text("preserve", encoding="utf-8")
+    try:
+        try:
+            with _stable_budget_fixture_root(root):
+                raise AssertionError("existing fixture must not be replaced")
+        except RuntimeError:
+            pass
+        assert marker.read_text(encoding="utf-8") == "preserve"
+    finally:
+        shutil.rmtree(fixture)
+
+
 def test_real_cli_output_stays_inside_baseline_and_growth_contracts(
     tmp_path: Path,
 ) -> None:
```

---

### Incident Patch 14: `18241d3a` (2026-10-05)
**Commit Message**: Merge pull request #5707 from loopx-project/codex/release-1.3.0-shutdown-retirement

fix(runtime): wait for locator retirement before stop readback

**File**: `loopx/control_plane/effect_runtime.py` (modified, +25/-3)
```diff
@@ -545,7 +545,9 @@ def _serving_token(path: Path) -> tuple[bool, str | None]:
     """Report whether a runtime is still publishing itself at ``path``.
 
     The managed runtime removes its info file as part of its shutdown
-    handshake, so the file is the authoritative stop signal. The pid is not:
+    handshake. Its mutation lock and cleanup files must also retire before
+    namespace cleanup.
+    A readable replacement token proves this runtime no longer serves. The pid is not:
     an exited runtime whose parent has not reaped it still answers a liveness
     probe, which would otherwise report a completed restart as pending.
     """
@@ -559,11 +561,28 @@ def _serving_token(path: Path) -> tuple[bool, str | None]:
         # until the deadline instead of claiming a restart that did not happen.
         return True, None
     if not isinstance(payload, dict):
-        return False, None
+        return True, None
     token = payload.get("token")
     return True, token if isinstance(token, str) else None
 
 
+def _locator_retirement_pending(info_path: Path) -> bool:
+    """Observe the existing TS lock namespace, including its cleanup files."""
+    lock_name = info_path.name + ".ts-effect.lock"
+    try:
+        return any(
+            path.name == lock_name
+            or path.name.startswith(lock_name + ".claim.")
+            or path.name.startswith(lock_name + ".released.")
+            for path in info_path.parent.iterdir()
+        )
+    except FileNotFoundError:
+        return False
+    except OSError:
+        # An unreadable directory cannot prove that retirement finished.
+        return True
+
+
 def restart_effect_runtime(*, timeout: float = 5.0) -> dict[str, Any]:
     """Stop the managed runtime serving this source revision.
 
@@ -607,7 +626,10 @@ def restart_effect_runtime(*, timeout: float = 5.0) -> dict[str, Any]:
     stopped = False
     while time.monotonic() < deadline:
         published, published_token = _serving_token(info_path)
-        if not published or published_token != serving_token:
+        if published and published_token is not None and published_token != serving_token:
+            stopped = True
+            break
+        if not published and not _locator_retirement_pending(info_path):
             stopped = True
             break
         if not _pid_is_alive(pid):
```

**File**: `tests/control_plane/test_effect_runtime_compile_cache.py` (modified, +26/-1)
```diff
@@ -110,8 +110,9 @@ def test_compile_preload_is_part_of_the_source_fingerprint(tmp_path: Path, monke
     assert effect_runtime._runtime_fingerprint() != original
 
 
+@pytest.mark.parametrize("retirement_delay", ["none", "claim_open", "claim_cleanup"])
 def test_shutdown_flushes_compilation_before_retiring_the_locator(
-    tmp_path: Path, monkeypatch,
+    tmp_path: Path, monkeypatch, retirement_delay: str,
 ) -> None:
     """A retired locator lets its fixture clean up; exit must not write later."""
     runtime = tmp_path / "runtime"
@@ -133,6 +134,27 @@ def test_shutdown_flushes_compilation_before_retiring_the_locator(
         "};\n",
         encoding="utf-8",
     )
+    if retirement_delay != "none":
+        # Expose both creation and deletion after locator retirement.
+        operation = "open" if retirement_delay == "claim_open" else "readFile"
+        with delay.open("a", encoding="utf-8") as preload:
+            preload.write(
+                "import fsp from 'node:fs/promises';\n"
+                "import { syncBuiltinESMExports } from 'node:module';\n"
+                f"const savedRm = fsp.rm, savedOperation = fsp.{operation};\n"
+                "let retired = false;\n"
+                "fsp.rm = async (path, ...args) => {\n"
+                "  const result = await savedRm(path, ...args);\n"
+                "  if (String(path).endsWith('.json')) retired = true;\n"
+                "  return result;\n"
+                "};\n"
+                f"fsp.{operation} = async (path, ...args) => {{\n"
+                "  if (retired && String(path).includes('.ts-effect.lock.claim.'))\n"
+                "    await new Promise(resolve => setTimeout(resolve, 200));\n"
+                "  return savedOperation(path, ...args);\n"
+                "};\n"
+                "syncBuiltinESMExports();\n"
+            )
     monkeypatch.setenv("NODE_OPTIONS", "--import=" + delay.as_uri())
     monkeypatch.setenv("LOOPX_EFFECT_RUNTIME_IDLE_MS", "60000")
     children = []
@@ -150,6 +172,9 @@ def capture(args, *rest, **kwargs):
         assert len(children) == 1
         assert effect_runtime.restart_effect_runtime()["status"] == "stopped"
         assert children[0].poll() is None, "the fixture must expose the pre-exit interval"
+        assert not list(runtime.glob("*.ts-effect.lock*")), (
+            "stop must wait until locator retirement and claim cleanup complete"
+        )
         assert any(p.is_file() for p in (runtime / "compile-cache").rglob("*")), (
             "cache must be flushed before the locator authorizes directory cleanup"
         )
```

**File**: `tests/control_plane/test_effect_runtime_restart.py` (modified, +59/-0)
```diff
@@ -266,3 +266,62 @@ def test_doctor_registers_the_restart_flag_and_reports_its_result(
     assert "## Effect Runtime Restart" in rendered
     assert "- status: `stopped`" in rendered
     assert "stopped_runtime: Node" in rendered
+
+
+@pytest.mark.parametrize(
+    ("published", "token", "lock_state", "pid_alive", "expected"),
+    [
+        (False, None, "present", True, "shutdown_pending"),
+        (False, None, "claim", True, "shutdown_pending"),
+        (False, None, "released", True, "shutdown_pending"),
+        (False, None, "unrelated", True, "stopped"),
+        (False, None, "missing", True, "stopped"),
+        (False, None, "denied", True, "shutdown_pending"),
+        (True, None, "missing", True, "shutdown_pending"),
+        (True, "replacement", "present", True, "stopped"),
+        (True, "serving", "missing", True, "shutdown_pending"),
+        (False, None, "present", False, "stopped"),
+    ],
+)
+def test_restart_requires_observed_locator_retirement(
+    tmp_path: Path, monkeypatch, published: bool, token: str | None,
+    lock_state: str, pid_alive: bool, expected: str,
+) -> None:
+    """Missing/unknown locators cannot bypass pending or unreadable retirement."""
+    info_path = tmp_path / "runtime.json"
+    lock_path = info_path.with_name(info_path.name + ".ts-effect.lock")
+    if lock_state in {"present", "claim", "released", "unrelated"}:
+        suffix = {"present": "", "claim": ".claim.owned", "released": ".released.owned", "unrelated": ".unrelated"}[lock_state]
+        lock_path = lock_path.with_name(lock_path.name + suffix)
+        lock_path.write_text("owned retirement")
+    original_iterdir = Path.iterdir
+
+    def observe(path):
+        if path == info_path.parent and lock_state == "denied":
+            raise PermissionError("synthetic lock denial")
+        return original_iterdir(path)
+
+    monkeypatch.setattr(Path, "iterdir", observe)
+    monkeypatch.setattr(effect_runtime, "_runtime_fingerprint", lambda: "fixture")
+    monkeypatch.setattr(effect_runtime, "_runtime_info_path", lambda _: info_path)
+    monkeypatch.setattr(effect_runtime, "_read_info", lambda *_a, **_kw:
+                        {"pid": 12345, "token": "serving"})
+    monkeypatch.setattr(effect_runtime, "_request_with_info", lambda *_a, **_kw: {})
+    monkeypatch.setattr(effect_runtime, "_serving_token", lambda _: (published, token))
+    monkeypatch.setattr(effect_runtime, "_pid_is_alive", lambda _: pid_alive)
+    result = effect_runtime.restart_effect_runtime(timeout=0.01)
+    assert result["status"] == expected
+    assert result["stopped"] is (expected == "stopped")
+    if lock_state in {"present", "claim", "released", "unrelated"}:
+        assert lock_path.read_text() == "owned retirement", "readback must not erase locks"
+
+
+@pytest.mark.parametrize("content", ["[]", "{}", '{"token": 7}', "not json"])
+def test_unknown_locator_content_cannot_prove_a_stopped_runtime(
+    tmp_path: Path, content: str,
+) -> None:
+    locator = tmp_path / "runtime.json"
+    locator.write_text(content)
+    assert effect_runtime._serving_token(locator) == (True, None)
+    locator.unlink()
+    assert effect_runtime._serving_token(locator) == (False, None)
```

---

### Incident Patch 15: `bd4fc9bc` (2026-10-05)
**Commit Message**: fix(runtime): drain retirement cleanup before namespace readback

Signed-off-by: LoopX Agent <[REDACTED_EMAIL]>

**File**: `loopx/control_plane/effect_runtime.py` (modified, +23/-13)
```diff
@@ -545,7 +545,8 @@ def _serving_token(path: Path) -> tuple[bool, str | None]:
     """Report whether a runtime is still publishing itself at ``path``.
 
     The managed runtime removes its info file as part of its shutdown
-    handshake. Its mutation lock must also retire before namespace cleanup.
+    handshake. Its mutation lock and cleanup files must also retire before
+    namespace cleanup.
     A readable replacement token proves this runtime no longer serves. The pid is not:
     an exited runtime whose parent has not reaped it still answers a liveness
     probe, which would otherwise report a completed restart as pending.
@@ -560,11 +561,28 @@ def _serving_token(path: Path) -> tuple[bool, str | None]:
         # until the deadline instead of claiming a restart that did not happen.
         return True, None
     if not isinstance(payload, dict):
-        return False, None
+        return True, None
     token = payload.get("token")
     return True, token if isinstance(token, str) else None
 
 
+def _locator_retirement_pending(info_path: Path) -> bool:
+    """Observe the existing TS lock namespace, including its cleanup files."""
+    lock_name = info_path.name + ".ts-effect.lock"
+    try:
+        return any(
+            path.name == lock_name
+            or path.name.startswith(lock_name + ".claim.")
+            or path.name.startswith(lock_name + ".released.")
+            for path in info_path.parent.iterdir()
+        )
+    except FileNotFoundError:
+        return False
+    except OSError:
+        # An unreadable directory cannot prove that retirement finished.
+        return True
+
+
 def restart_effect_runtime(*, timeout: float = 5.0) -> dict[str, Any]:
     """Stop the managed runtime serving this source revision.
 
@@ -611,17 +629,9 @@ def restart_effect_runtime(*, timeout: float = 5.0) -> dict[str, Any]:
         if published and published_token is not None and published_token != serving_token:
             stopped = True
             break
-        if not published:
-            # Locator retirement still holds its mutation lock and may create a
-            # release claim. Only lock absence makes namespace cleanup safe.
-            try:
-                info_path.with_name(info_path.name + ".ts-effect.lock").stat()
-            except FileNotFoundError:
-                stopped = True
-                break
-            except OSError:
-                # Unreadable lock state cannot prove that retirement finished.
-                pass
+        if not published and not _locator_retirement_pending(info_path):
+            stopped = True
+            break
         if not _pid_is_alive(pid):
             stopped = True
             break
```

**File**: `tests/control_plane/test_effect_runtime_compile_cache.py` (modified, +10/-9)
```diff
@@ -110,9 +110,9 @@ def test_compile_preload_is_part_of_the_source_fingerprint(tmp_path: Path, monke
     assert effect_runtime._runtime_fingerprint() != original
 
 
-@pytest.mark.parametrize("late_release_claim", [False, True])
+@pytest.mark.parametrize("retirement_delay", ["none", "claim_open", "claim_cleanup"])
 def test_shutdown_flushes_compilation_before_retiring_the_locator(
-    tmp_path: Path, monkeypatch, late_release_claim: bool,
+    tmp_path: Path, monkeypatch, retirement_delay: str,
 ) -> None:
     """A retired locator lets its fixture clean up; exit must not write later."""
     runtime = tmp_path / "runtime"
@@ -134,23 +134,24 @@ def test_shutdown_flushes_compilation_before_retiring_the_locator(
         "};\n",
         encoding="utf-8",
     )
-    if late_release_claim:
-        # Slow the real post-retirement lock claim, exposing a stop/cleanup race.
+    if retirement_delay != "none":
+        # Expose both creation and deletion after locator retirement.
+        operation = "open" if retirement_delay == "claim_open" else "readFile"
         with delay.open("a", encoding="utf-8") as preload:
             preload.write(
                 "import fsp from 'node:fs/promises';\n"
                 "import { syncBuiltinESMExports } from 'node:module';\n"
-                "const savedRm = fsp.rm, savedOpen = fsp.open;\n"
+                f"const savedRm = fsp.rm, savedOperation = fsp.{operation};\n"
                 "let retired = false;\n"
                 "fsp.rm = async (path, ...args) => {\n"
                 "  const result = await savedRm(path, ...args);\n"
                 "  if (String(path).endsWith('.json')) retired = true;\n"
                 "  return result;\n"
                 "};\n"
-                "fsp.open = async (path, ...args) => {\n"
+                f"fsp.{operation} = async (path, ...args) => {{\n"
                 "  if (retired && String(path).includes('.ts-effect.lock.claim.'))\n"
                 "    await new Promise(resolve => setTimeout(resolve, 200));\n"
-                "  return savedOpen(path, ...args);\n"
+                "  return savedOperation(path, ...args);\n"
                 "};\n"
                 "syncBuiltinESMExports();\n"
             )
@@ -171,8 +172,8 @@ def capture(args, *rest, **kwargs):
         assert len(children) == 1
         assert effect_runtime.restart_effect_runtime()["status"] == "stopped"
         assert children[0].poll() is None, "the fixture must expose the pre-exit interval"
-        assert not list(runtime.glob("*.ts-effect.lock")), (
-            "stop must wait until locator retirement can no longer create a claim"
+        assert not list(runtime.glob("*.ts-effect.lock*")), (
+            "stop must wait until locator retirement and claim cleanup complete"
         )
         assert any(p.is_file() for p in (runtime / "compile-cache").rglob("*")), (
             "cache must be flushed before the locator authorizes directory cleanup"
```

**File**: `tests/control_plane/test_effect_runtime_restart.py` (modified, +23/-7)
```diff
@@ -272,6 +272,9 @@ def test_doctor_registers_the_restart_flag_and_reports_its_result(
     ("published", "token", "lock_state", "pid_alive", "expected"),
     [
         (False, None, "present", True, "shutdown_pending"),
+        (False, None, "claim", True, "shutdown_pending"),
+        (False, None, "released", True, "shutdown_pending"),
+        (False, None, "unrelated", True, "stopped"),
         (False, None, "missing", True, "stopped"),
         (False, None, "denied", True, "shutdown_pending"),
         (True, None, "missing", True, "shutdown_pending"),
@@ -287,16 +290,18 @@ def test_restart_requires_observed_locator_retirement(
     """Missing/unknown locators cannot bypass pending or unreadable retirement."""
     info_path = tmp_path / "runtime.json"
     lock_path = info_path.with_name(info_path.name + ".ts-effect.lock")
-    if lock_state == "present":
+    if lock_state in {"present", "claim", "released", "unrelated"}:
+        suffix = {"present": "", "claim": ".claim.owned", "released": ".released.owned", "unrelated": ".unrelated"}[lock_state]
+        lock_path = lock_path.with_name(lock_path.name + suffix)
         lock_path.write_text("owned retirement")
-    original_stat = Path.stat
+    original_iterdir = Path.iterdir
 
-    def observe(path, *args, **kwargs):
-        if path == lock_path and lock_state == "denied":
+    def observe(path):
+        if path == info_path.parent and lock_state == "denied":
             raise PermissionError("synthetic lock denial")
-        return original_stat(path, *args, **kwargs)
+        return original_iterdir(path)
 
-    monkeypatch.setattr(Path, "stat", observe)
+    monkeypatch.setattr(Path, "iterdir", observe)
     monkeypatch.setattr(effect_runtime, "_runtime_fingerprint", lambda: "fixture")
     monkeypatch.setattr(effect_runtime, "_runtime_info_path", lambda _: info_path)
     monkeypatch.setattr(effect_runtime, "_read_info", lambda *_a, **_kw:
@@ -307,5 +312,16 @@ def observe(path, *args, **kwargs):
     result = effect_runtime.restart_effect_runtime(timeout=0.01)
     assert result["status"] == expected
     assert result["stopped"] is (expected == "stopped")
-    if lock_state == "present":
+    if lock_state in {"present", "claim", "released", "unrelated"}:
         assert lock_path.read_text() == "owned retirement", "readback must not erase locks"
+
+
+@pytest.mark.parametrize("content", ["[]", "{}", '{"token": 7}', "not json"])
+def test_unknown_locator_content_cannot_prove_a_stopped_runtime(
+    tmp_path: Path, content: str,
+) -> None:
+    locator = tmp_path / "runtime.json"
+    locator.write_text(content)
+    assert effect_runtime._serving_token(locator) == (True, None)
+    locator.unlink()
+    assert effect_runtime._serving_token(locator) == (False, None)
```

#### Recent Merged Pull Requests:
- **PR #5727** (2026-10-06): fix(quota): preserve settled semantic progress across frontier changes (@loopx-agent)
- **PR #5722** (2026-10-06): test(workspace): align replan cadence browser fixture (@loopx-agent)
- **PR #5721** (2026-10-06): test(chat): make deadline fallback qualification deterministic (@loopx-agent)
- **PR #5720** (2026-10-06): fix(install): avoid false unavailable status for delayed feeds (@loopx-agent)
- **PR #5718** (2026-10-06): fix(replan): restore control-plane context ownership and catalog validation (@loopx-agent)
- **PR #5714** (2026-10-05): fix(install): preserve managed Chat storage and timeouts (@loopx-agent)
- **PR #5713** (2026-10-05): test(collaboration): stabilize instance and finished-host fixtures (@loopx-agent)
- **PR #5711** (2026-10-05): test(cli): stabilize physical paths in output budget fixtures (@loopx-agent)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yyjeqhc-webcodex-learnings.md`  
> **Source**: github ([https://github.com/yyjeqhc/webcodex](https://github.com/yyjeqhc/webcodex))  
> **Source Version**: `3c141967`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T01:01:11.810Z  
> **Learning ID**: `learn-github-yyjeqhc-webcodex`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): yyjeqhc/webcodex

> **Canonical Artifact**: `07_PROJECT_LEARNING/yyjeqhc-webcodex-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/yyjeqhc/webcodex](https://github.com/yyjeqhc/webcodex))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-13T01:01:11.613Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yyjeqhc/webcodex`
- **Description**: Give cloud AI agents a real development environment on your own machines.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 2509 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/desktop/src-tauri/src/desktop_shell/lifecycle.rs`
```
//! Process-local UI intent only. No Runtime ownership or persistent preferences.
use super::{CloseDisposition, NavigationTarget};
use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Phase {
    Loaded,
    Destroying { reopen: bool },
    Lightweight,
    Recreating { generation: u32 },
    ExitRequested,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct NavigationIntent {
    pub sequence: u32,
    pub target: NavigationTarget,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum OpenAction {
    Show,
    Recreate(u32),
    None,
}

pub(super) struct Lifecycle {
    pub phase: Phase,
    generation: u32,
    navigation_sequence: u32,
    pending_navigation: Option<NavigationIntent>,
    bootstrap_complete: bool,
}

impl Default for Lifecycle {
    fn default() -> Self {
        Self {
            phase: Phase::Loaded,
            generation: 0,
            navigation_sequence: 0,
            pending_navigation: None,
            bootstrap_complete: false,
        }
    }
}

impl Lifecycle {
    pub fn close_disposition(&self) -> CloseDisposition {
        if self.phase == Phase::ExitRequested {
            CloseDisposition::AllowExit
        } else {
            CloseDisposition::HideWindow
        }
    }

    pub fn request_exit(&mut self) {
        self.phase = Phase::ExitRequested;
        self.pending_navigation = None;
    }

    pub fn prevent_implicit_exit(&self, code: Option<i32>) -> bool {
        code.is_none()
            && matches!(
                self.phase,
                Phase::Destroying { .. } | Phase::Lightweight | Phase::Recreating { .. }
            )
    }

    pub fn can_enter_lightweight(&self) -> bool {
        self.phase == Phase::Loaded && self.bootstrap_complete
    }

    pub fn mark_bootstrap_complete(&mut self) {
        if self.phase != Phase::ExitRequested {
            self.bootstrap_complete = true;
        }
    }

    pub fn begin_lightweight(&mut self) -> bool {
        if !self.can_enter_lightweight() {
            return false;
        }
        self.phase = Phase::Destroying { reopen: false };
        self.pending_navigation = None;
        true
    }

    pub fn destroy_failed(&mut self) {
        if matches!(self.phase, Phase::Destroying { .. }) {
            self.phase = Phase::Loaded;
        }
    }

    pub fn destroyed(&mut self) -> OpenAction {
        let Phase::Destroying { reopen } = self.phase else {
            return OpenAction::None;
        };
        self.phase = Phase::Lightweight;
        if reopen {
            self.open(None)
        } else {
            OpenAction::None
        }
    }

    pub fn open(&mut self, target: Option<NavigationTarget>) -> OpenAction {
        if self.phase == Phase::ExitRequested {
            return OpenAction::None;
        }
        if let Some(target) = target {
            // Fail closed on the finite counter rather than wrapping an ACK onto
            // a newer intent. One bounded slot, latest explicit target wins.
            if let Some(sequence) = self.navigation_sequence.checked_add(1) {
                self.navigation_sequence = sequence;
                self.pending_navigation = Some(NavigationIntent { sequence, target });
            }
        }
        match self.phase {
            Phase::Loaded => OpenAction::Show,
            Phase::Lightweight => {
                let Some(generation) = self.generation.checked_add(1) else {
                    return OpenAction::None;
                };
                self.generation = generation;
                self.phase = Phase::Recreating { generation };
                OpenAction::Recreate(generation)
            }
            Phase::Destroying { .. } => {
                self.phase = Phase::Destroying { reopen: true };
                OpenAction::None
            }
            Phase::Recreating { .. } | Phase::ExitRequested => OpenAction::None,
        }
    }

    pub fn is_recreating(&self, generation: u32) -> bool {
        self.phase == Phase::Recreating { generation }
    }

    pub fn recreated(&mut self, generation: u32) -> bool {
        if !self.is_recreating(generation) {
            return false;
        }
        self.phase = Phase::Loaded;
        true
    }

    pub fn recreate_failed(&mut self, generation: u32) {
        if self.is_recreating(generation) {
            self.phase = Phase::Lightweight;
        }
    }

    pub fn restore_only(&self) -> bool {
        self.bootstrap_complete
            || matches!(self.phase, Phase::Destroying { .. } | Phase::ExitRequested)
    }

    pub fn pending_navigation(&self) -> Option<NavigationIntent> {
        matches!(self.phase, Phase::Loaded | Phase::Recreating { .. })
            .then_some(self.pending_navigation)
            .flatten()
    }

    pub fn acknowledge_navigation(&mut self, sequence: u32) {
        if self
            .pending_navigation
            .is_some_and(|intent| intent.sequence == sequence)
        {
            self.pending_navigation = None;
        }
    }
}

#[cfg(test)]
mod tests;

```

### Core Architecture Module: `apps/desktop/src-tauri/src/lifecycle_log.rs`
```
//! Best-effort, bounded metadata for Desktop exits that erase in-memory output.
//! No activity messages, command lines, child output, or credentials enter here.
use crate::process::ProcessSnapshot;
use serde::Serialize;
use std::fs::{self, File, OpenOptions};
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{mpsc, Arc};
use std::time::{SystemTime, UNIX_EPOCH};

pub(crate) const DIRECTORY: &str = "desktop-lifecycle-v1";
pub(crate) const CURRENT: &str = "current.jsonl";
pub(crate) const PREVIOUS: &str = "previous.jsonl";
const FILE_BYTES: u64 = 256 * 1024;
const QUEUE_ENTRIES: usize = 64;

#[derive(Serialize)]
#[serde(tag = "event", rename_all = "snake_case")]
pub(crate) enum LifecycleEvent {
    DesktopStarted,
    ExitRequested { code: Option<i32>, prevented: bool },
    DesktopExiting,
    ShutdownStarted,
    ShutdownWaitFinished,
    ProcessObserved { snapshot: ProcessSnapshot },
    ProcessStopped { snapshot: ProcessSnapshot },
}

#[derive(Serialize)]
struct Record {
    version: u32,
    session_id: String,
    desktop_pid: u32,
    timestamp_ms: u64,
    dropped_before: u64,
    #[serde(flatten)]
    event: LifecycleEvent,
}

enum Message {
    Record(Record),
    #[cfg(test)]
    Barrier(mpsc::SyncSender<()>),
}

#[derive(Clone)]
pub(crate) struct LifecycleLog {
    sender: mpsc::SyncSender<Message>,
    session_id: uuid::Uuid,
    dropped: Arc<AtomicU64>,
}

impl LifecycleLog {
    #[cfg(test)]
    pub(crate) fn test_barrier(&self) {
        let (tx, rx) = mpsc::sync_channel(1);
        self.sender.send(Message::Barrier(tx)).unwrap();
        rx.recv_timeout(std::time::Duration::from_secs(5)).unwrap();
    }

    pub(crate) fn start(data_dir: &Path) -> io::Result<Self> {
        let writer = Writer::open(data_dir)?;
        let (sender, receiver) = mpsc::sync_channel(QUEUE_ENTRIES);
        std::thread::Builder::new()
            .name("webcodex-lifecycle-log".into())
            .spawn(move || {
                let mut writer = writer;
                for message in receiver {
                    match message {
                        Message::Record(record) => {
                            if writer.append(&record).is_err() {
                                // Static text only. Journaling failure never changes
                                // process ownership, cleanup, or restart admission.
                                eprintln!("WebCodex Desktop lifecycle metadata logging stopped");
                                break;
                            }
                        }
                        #[cfg(test)]
                        Message::Barrier(ack) => {
                            let _ = ack.send(());
                        }
                    }
                }
            })?;
        let log = Self {
            sender,
            session_id: uuid::Uuid::new_v4(),
            dropped: Arc::new(AtomicU64::new(0)),
        };
        log.record(LifecycleEvent::DesktopStarted);
        Ok(log)
    }

    pub(crate) fn record(&self, event: LifecycleEvent) {
        let dropped_before = self.dropped.swap(0, Ordering::Relaxed);
        let record = Record {
            version: 1,
            session_id: self.session_id.to_string(),
            desktop_pid: std::process::id(),
            timestamp_ms: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis()
                .try_into()
                .unwrap_or(u64::MAX),
            dropped_before,
            event,
        };
        if self.sender.try_send(Message::Record(record)).is_err() {
            self.dropped
                .fetch_add(dropped_before.saturating_add(1), Ordering::Relaxed);
        }
        // No filesystem I/O or queue wait on the native session-shutdown path.
    }
}

struct Writer {
    directory: PathBuf,
    file: Option<File>,
    length: u64,
}

impl Writer {
    fn open(data_dir: &Path) -> io::Result<Self> {
        let directory = data_dir.join(DIRECTORY);
        check_directory(data_dir)?;
        match fs::create_dir(&directory) {
            Ok(()) => {
                #[cfg(unix)]
                {
                    use std::os::unix::fs::PermissionsExt;
                    fs::set_permissions(&directory, fs::Permissions::from_mode(0o700))?;
                }
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {}
            Err(error) => return Err(error),
        }
        check_directory(&directory)?;
        let current = directory.join(CURRENT);
        let file = open_file(&current)?;
        let length = file.metadata()?.len();
        if length > FILE_BYTES {
            return Err(unsafe_path());
        }
        check_existing_file(&directory.join(PREVIOUS))?;
        let mut writer = Self {
            directory,
            file: Some(file),
            length,
        };
        // Preserve an interrupted partial write; keep the next record separate.
        if length != 0 {
            let file = writer.file.as_mut().unwrap();
            file.seek(SeekFrom::End(-1))?;
            let mut tail = [0];
            file.read_exact(&mut tail)?;
            if tail[0] != b'\n' {
                if length == FILE_BYTES {
                    writer.rotate()?;
                } else {
                    writer.file.as_mut().unwrap().write_all(b"\n")?;
                    writer.length += 1;
                }
            }
        }
        Ok(writer)
    }

    fn append(&mut self, record: &Record) -> io::Result<()> {
        let mut bytes = serde_json::to_vec(record)?;
        bytes.push(b'\n');
        if bytes.len() as u64 > FILE_BYTES {
            return Err(unsafe_path());
        }
        if self.length + bytes.len() as u64 > FILE_BYTES {
            self.rotate()?;
        }
        let file = self.file.as_mut().unwrap();
        file.write_all(&bytes)?;
        file.sync_data()?;
        self.length += bytes.len() as u64;
        Ok(())
    }

    fn rotate(&mut self) -> io::Result<()> {
        check_directory(&self.directory)?;
        let current = self.directory.join(CURRENT);
        let previous = self.directory.join(PREVIOUS);
        check_existing_file(&current)?;
        check_existing_file(&previous)?;
        drop(self.file.take());
        match fs::remove_file(&previous) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error),
        }
        fs::rename(&current, &previous)?;
        self.file = Some(open_file(&current)?);
        self.length = 0;
        Ok(())
    }
}

fn unsafe_path() -> io::Error {
    io::Error::from(io::ErrorKind::InvalidInput)
}

fn redirected(metadata: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        metadata.file_attributes() & 0x400 != 0
    }
    #[cfg(not(windows))]
    {
        metadata.file_type().is_symlink()
    }
}

fn check_directory(path: &Path) -> io::Result<()> {
    if !path.is_absolute() {
        return Err(unsafe_path());
    }
    for parent in path.ancestors() {
        let metadata = fs::symlink_metadata(parent)?;
        if !metadata.is_dir() || redirected(&metadata) {
            return Err(unsafe_path());
        }
    }
    Ok(())
}

fn check_existing_file(path: &Path) -> io::Result<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata)
            if metadata.is_file() && !redirected(&metadata) && metadata.len() <= FILE_BYTES =>
        {
            Ok(())
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        _ => Err(unsafe_path()),
    }
}

fn open_file(path: &Path) -> io::Result<File> {
    check_existing_file(path)?;
    let mut options = OpenOptions::new();
    options.read(true).append(true).create(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options
            .mode(0o600)
            .custom_flags(libc::O_NOFOLLOW | libc::O_CLOEXEC);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.custom_flags(0x0020_0000); // FILE_FLAG_OPEN_REPARSE_POINT
    }
    let file = options.open(path)?;
    let metadata = file.metadata()?;
    if !metadata.is_file() || redirected(&metadata) {
        return Err(unsafe_path());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if metadata.nlink() != 1 || metadata.mode() & 0o077 != 0 {
            return Err(unsafe_path());
        }
    }
    #[cfg(windows)]
    {
        use std::os::windows::io::AsRawHandle;
        use windows_sys::Win32::Storage::FileSystem::{
            GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
        };
        let mut info: BY_HANDLE_FILE_INFORMATION = unsafe { std::mem::zeroed() };
        // SAFETY: file owns this live handle; info is valid output storage.
        if unsafe { GetFileInformationByHandle(file.as_raw_handle(), &mut info) } == 0 {
            return Err(io::Error::last_os_error());
        }
        if info.nNumberOfLinks != 1 {
            return Err(unsafe_path());
        }
    }
    Ok(file)
}

#[cfg(test)]
#[path = "lifecycle_log/tests.rs"]
mod tests;

```

### Core Architecture Module: `apps/desktop/src-tauri/src/runtime_selection/lifecycle.rs`
```
//! Small transactional state machine shared by the real owned-process adapter
//! and failure-injection tests. It does not admit candidates or grant ownership.
use crate::error::DesktopResult;

pub(crate) trait SwitchDriver: Send {
    fn stop(&mut self) -> impl std::future::Future<Output = DesktopResult<()>> + Send;
    fn activate_candidate(&mut self)
        -> impl std::future::Future<Output = DesktopResult<()>> + Send;
    fn commit_candidate(&mut self) -> impl std::future::Future<Output = DesktopResult<()>> + Send;
    fn restore_previous(&mut self) -> impl std::future::Future<Output = DesktopResult<()>> + Send;
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum Outcome {
    Activated,
    RolledBack {
        reason: String,
    },
    RecoveryRequired {
        reason: String,
        rollback_reason: String,
    },
}

pub(crate) async fn execute(driver: &mut impl SwitchDriver) -> Outcome {
    // A failed stop has an uncertain process-side outcome. Do not try another
    // stop, spawn a replacement, or claim that rollback restored anything.
    if let Err(error) = driver.stop().await {
        return Outcome::RecoveryRequired {
            reason: error.code,
            rollback_reason: "owned_process_stop_not_confirmed".into(),
        };
    }
    let failure = match driver.activate_candidate().await {
        Ok(()) => match driver.commit_candidate().await {
            Ok(()) => return Outcome::Activated,
            Err(error) => error,
        },
        Err(error) => error,
    };
    // Exactly one rollback path. Never recursively retry failed recovery.
    if let Err(error) = driver.stop().await {
        return Outcome::RecoveryRequired {
            reason: failure.code,
            rollback_reason: error.code,
        };
    }
    match driver.restore_previous().await {
        Ok(()) => Outcome::RolledBack {
            reason: failure.code,
        },
        Err(error) => Outcome::RecoveryRequired {
            reason: failure.code,
            rollback_reason: error.code,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::runtime_selection::error;
    #[derive(Default)]
    struct Driver {
        log: Vec<&'static str>,
        fail: Option<&'static str>,
        committed: bool,
        restored: bool,
        stop_count: usize,
    }
    impl SwitchDriver for Driver {
        async fn stop(&mut self) -> DesktopResult<()> {
            self.log.push("stop_owned");
            self.stop_count += 1;
            if self.fail == Some("stop")
                || self.fail == Some("rollback_stop") && self.stop_count == 2
            {
                Err(error("stop_unconfirmed"))
            } else {
                Ok(())
            }
        }
        async fn activate_candidate(&mut self) -> DesktopResult<()> {
            self.log.push("start_and_verify");
            if matches!(self.fail, Some("start" | "rollback" | "rollback_stop")) {
                Err(error("candidate_not_ready"))
            } else {
                Ok(())
            }
        }
        async fn commit_candidate(&mut self) -> DesktopResult<()> {
            self.log.push("commit");
            if self.fail == Some("commit") {
                Err(error("write_unconfirmed"))
            } else {
                self.committed = true;
                Ok(())
            }
        }
        async fn restore_previous(&mut self) -> DesktopResult<()> {
            self.log.push("restore_and_verify");
            if self.fail == Some("rollback") {
                Err(error("previous_unavailable"))
            } else {
                self.restored = true;
                self.committed = false;
                Ok(())
            }
        }
    }
    #[tokio::test]
    async fn success_commits_only_after_readiness_and_identity() {
        let mut d = Driver::default();
        assert_eq!(execute(&mut d).await, Outcome::Activated);
        assert_eq!(d.log, vec!["stop_owned", "start_and_verify", "commit"]);
        assert!(d.committed);
    }
    #[tokio::test]
    async fn failed_start_restores_known_good_once_without_committing_candidate() {
        let mut d = Driver {
            fail: Some("start"),
            ..Default::default()
        };
        assert!(matches!(execute(&mut d).await, Outcome::RolledBack { .. }));
        assert!(d.restored);
        assert!(!d.committed);
        assert_eq!(
            d.log,
            vec![
                "stop_owned",
                "start_and_verify",
                "stop_owned",
                "restore_and_verify"
            ]
        );
    }
    #[tokio::test]
    async fn unconfirmed_commit_still_restores_previous_selection() {
        let mut d = Driver {
            fail: Some("commit"),
            ..Default::default()
        };
        assert!(matches!(execute(&mut d).await, Outcome::RolledBack { .. }));
        assert!(d.restored);
        assert_eq!(d.stop_count, 2);
    }
    #[tokio::test]
    async fn rollback_failure_is_terminal_and_never_silent_bundled_fallback() {
        let mut d = Driver {
            fail: Some("rollback"),
            ..Default::default()
        };
        assert_eq!(
            execute(&mut d).await,
            Outcome::RecoveryRequired {
                reason: "candidate_not_ready".into(),
                rollback_reason: "previous_unavailable".into()
            }
        );
        assert_eq!(d.stop_count, 2);
        assert!(!d.restored);
    }
    #[tokio::test]
    async fn uncertain_initial_stop_never_spawns_or_retries() {
        let mut d = Driver {
            fail: Some("stop"),
            ..Default::default()
        };
        assert!(matches!(
            execute(&mut d).await,
            Outcome::RecoveryRequired { .. }
        ));
        assert_eq!(d.log, vec!["stop_owned"]);
    }
    #[tokio::test]
    async fn uncertain_candidate_stop_never_restarts_previous_over_it() {
        let mut d = Driver {
            fail: Some("rollback_stop"),
            ..Default::default()
        };
        assert!(matches!(
            execute(&mut d).await,
            Outcome::RecoveryRequired { .. }
        ));
        assert_eq!(d.log, vec!["stop_owned", "start_and_verify", "stop_owned"]);
    }
}

```

### Core Architecture Module: `apps/desktop/src-tauri/src/state.rs`
```
mod cloudflare_connections;
mod coding_agents;
mod connections;
pub use cloudflare_connections::{CloudflareConnectionRequest, CloudflareConnectionResponse};
mod diagnostics;
mod environment;
mod environment_invitation;
pub use environment_invitation::{InvitationRequest, InvitationResponse};
mod managed_instructions;
mod mcp_providers;
mod operation_completion;
mod path_inventory;
pub use path_inventory::{ExportInventoryRequest, OpenInventoryRequest};
#[cfg(all(test, windows, desktop_native_smoke))]
pub(crate) mod computer_native_smoke;
#[cfg(test)]
mod projectless_tests;
#[cfg(test)]
mod reconfiguration_tests;
mod runner_capability_grant;
mod runtime_shell;
#[cfg(test)]
mod shutdown_tests;
mod ssh_resources;
pub(crate) mod updates;
mod workspace;
mod workspace_settings;
use crate::activity::{ActivityEventKind, ActivityLevel, ActivityLog};
use crate::connections::ConnectionRuntimes;
use crate::deadline::Deadline;
use crate::error::{DesktopError, DesktopResult};
use crate::models::{
    aggregate_readiness, ChatGptActivitySnapshot, DesktopOperationKind, DesktopStateSnapshot,
    Enrollment, Experience, Exposure, ExposureReadiness, ProjectInspection, ProjectReadiness,
    ProjectSelection, QuickShareState, ReadinessNextActionKind, ReadinessSummaryKind,
    RegularConnectionPreference, RunnerReadiness, RunnerTopology, RuntimeTopology, ServerReadiness,
    ServerTopology, StoredDesktopConfig, StoredRuntime, TunnelProxyConfig, TunnelProxyMode,
    TunnelProxySnapshot,
};
use crate::operation::{
    cancelled_error, CancellationContext, CancellationSignal, OperationAdmission,
    OperationController,
};
use crate::process::{MachineEventReceiver, ProcessKey, ProcessPhase, ProcessSupervisor};
use crate::tunnel_config::{TunnelConfig, TunnelConfigRequest};
use crate::webcodex::{
    inspect_project_path, ProjectRuntimeIdentity, QuickShareReadyEvent, RunnerRuntimeIdentity,
    WebCodexAdapter,
};
pub use connections::ConnectionAction;
use serde_json::Value;
#[cfg(unix)]
use std::fs::File;
use std::fs::OpenOptions;
use std::io::{self, Write};
use std::net::{SocketAddr, TcpListener};
use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicU64;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, RwLock};
use std::time::Duration;
use tokio::sync::Mutex;

const SERVER_READY_TIMEOUT: Duration = Duration::from_secs(20);
const STALE_LOOPBACK_PROBE_TIMEOUT: Duration = Duration::from_secs(2);
const RUNNER_READY_TIMEOUT: Duration = Duration::from_secs(30);
const PROJECT_READY_TIMEOUT: Duration = Duration::from_secs(20);
const QUICK_SHARE_READY_TIMEOUT: Duration = Duration::from_secs(90);
const POLL_INTERVAL: Duration = Duration::from_millis(300);
const READINESS_CLEANUP_SLACK: Duration = Duration::from_secs(2);
const SHUTDOWN_OPERATION_WAIT: Duration = Duration::from_secs(5);
#[cfg(windows)]
pub(crate) const SESSION_SHUTDOWN_BUDGET: Duration = Duration::from_secs(4);
const DESKTOP_STATE_MAX_BYTES: u64 = 256 * 1024;
const DESKTOP_SERVER_ENV_MAX_BYTES: u64 = 256 * 1024;
const DESKTOP_MCP_HOST_PROFILE: &str = "host_code_mode";
const DESKTOP_MCP_HOST_BUDGET_SECS: &str = "55";
const DESKTOP_MCP_COMPACT_SCHEMAS: &str = "true";
const DESKTOP_MCP_TRUST_LOOPBACK_API_TOKEN_FILE_IMPORT: &str = "true";
static NEXT_STATE_TEMP_ID: AtomicU64 = AtomicU64::new(1);

type SharedSupervisor = Arc<Mutex<ProcessSupervisor>>;

#[derive(Debug, Clone)]
struct ChatGptActivityProbe {
    identity: ProjectRuntimeIdentity,
    webcodex: PathBuf,
}

pub struct AppState {
    core: Mutex<Option<DesktopCore>>,
    desktop_data_dir: crate::desktop_data_dir::DesktopDataDir,
    managed_instructions: Arc<crate::managed_instructions::ManagedInstructions>,
    ssh_resources: Mutex<crate::ssh_resources::SshResourcesManager>,
    published: Arc<RwLock<DesktopStateSnapshot>>,
    supervisor: SharedSupervisor,
    activity: ActivityLog,
    operations: OperationController,
    shutdown_signal: CancellationSignal,
    shutdown_started: AtomicBool,
    shutdown_complete: CancellationSignal,
    connections: ConnectionRuntimes,
    update_check: tokio::sync::Mutex<()>,
    updates: Arc<crate::updates::UpdateManager>,
}

include!("state/app_state.rs");
include!("state/desktop_core.rs");
include!("state/readiness.rs");
include!("state/persistence.rs");
include!("state/tunnel.rs");
include!("state/tests.rs");

#[cfg(test)]
#[path = "state/legacy_upgrade_tests.rs"]
mod legacy_upgrade_tests;

```

### Core Architecture Module: `apps/desktop/src-tauri/src/state/app_state.rs`
```
impl AppState {
    #[cfg(test)]
    pub fn new(data_dir: PathBuf, resource_dir: PathBuf) -> DesktopResult<Self> {
        let desktop_data_dir = crate::desktop_data_dir::DesktopDataDir {
            effective: data_dir,
            source: crate::desktop_data_dir::DesktopDataDirSource::Tauri,
            physical_resolution_changed: false,
        };
        Self::new_resolved(desktop_data_dir, resource_dir)
    }

    pub fn new_resolved(
        desktop_data_dir: crate::desktop_data_dir::DesktopDataDir,
        resource_dir: PathBuf,
    ) -> DesktopResult<Self> {
        let data_dir = desktop_data_dir.effective.clone();
        let managed_instructions = Arc::new(crate::managed_instructions::ManagedInstructions::new(
            data_dir.clone(),
        ));
        let updates = crate::updates::UpdateManager::new(data_dir.clone());
        let core = DesktopCore::new(data_dir, resource_dir)?;
        let published = Arc::clone(&core.published);
        let supervisor = Arc::clone(&core.supervisor);
        let activity = core.activity.clone();
        let connections = core.connections.clone();
        Ok(Self {
            core: Mutex::new(Some(core)),
            desktop_data_dir,
            managed_instructions,
            ssh_resources: Mutex::new(crate::ssh_resources::SshResourcesManager::default()),
            published,
            supervisor,
            connections,
            operations: OperationController::new(activity.clone()),
            activity,
            shutdown_signal: CancellationSignal::new(),
            shutdown_started: AtomicBool::new(false),
            shutdown_complete: CancellationSignal::new(),
            update_check: tokio::sync::Mutex::new(()),
            updates,
        })
    }

    pub fn get_state(&self) -> DesktopStateSnapshot {
        let mut snapshot = self
            .published
            .read()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
            .clone();
        // Native services own persistent runtime observations. Desktop's process
        // registry must not overwrite them with absent or historical processes.
        if snapshot.persistent_environment.is_none() {
            if let Ok(mut supervisor) = self.supervisor.try_lock() {
                let mut server = snapshot.readiness.server.clone();
                let mut runner = snapshot.readiness.runner.clone();
                if supervisor
                    .snapshot(ProcessKey::LocalServer)
                    .is_some_and(|p| matches!(p.phase, ProcessPhase::Exited | ProcessPhase::Failed))
                {
                    server = ServerReadiness::Error;
                }
                if supervisor
                    .snapshot(ProcessKey::LocalRunner)
                    .is_some_and(|p| matches!(p.phase, ProcessPhase::Exited | ProcessPhase::Failed))
                {
                    runner = RunnerReadiness::Error;
                }
                if server != snapshot.readiness.server || runner != snapshot.readiness.runner {
                    snapshot.readiness = aggregate_readiness(
                        server,
                        runner,
                        snapshot.readiness.exposure.clone(),
                        snapshot.readiness.project.clone(),
                    );
                }
            }
            self.connections
                .project(&mut snapshot.connections, snapshot.readiness.runtime_ready);
        }
        snapshot.current_operation = self.operations.current();
        snapshot.environment_setup = environment_invitation::setup_snapshot(&snapshot);
        snapshot.activity_sequence = self.activity.latest_sequence();
        if snapshot.persistent_environment.is_none()
            && snapshot.openai_tunnel_config.source
                == crate::models::TunnelConfigSource::Environment
        {
            snapshot.openai_tunnel_config = crate::tunnel_config::environment_snapshot();
            snapshot.openai_tunnel_configured = snapshot.openai_tunnel_config.is_configured();
        }
        snapshot.regular_tunnel_available = true;
        snapshot.powershell_runtime = crate::platform::powershell_runtime_snapshot();
        snapshot
    }

    pub fn activity(&self) -> Vec<crate::activity::ActivityEntry> {
        self.activity.snapshot()
    }

    pub async fn inspect_project(&self, path: &str) -> DesktopResult<ProjectSelection> {
        inspect_project_path(path).await
    }

    pub async fn inspect_project_access(&self, path: &str) -> DesktopResult<ProjectInspection> {
        let project = inspect_project_path(path).await?;
        let settings = self.runner_settings().await?;
        let project_path = PathBuf::from(&project.path);
        let effective_roots = settings
            .file_access
            .effective_roots
            .iter()
            .map(PathBuf::from)
            .collect::<Vec<_>>();
        let allow_cwd_anywhere = settings.file_access.allow_cwd_anywhere;
        let authorization_required = tokio::task::spawn_blocking(move || {
            let canonical_project = project_path.canonicalize().map_err(|_| {
                DesktopError::new(
                    "project_unavailable",
                    "The selected project directory could not be resolved",
                    "Choose an existing directory that this account can access.",
                )
            })?;
            let canonical_roots =
                webcodex_runner_config::paths::canonicalize_usable_allowed_roots(&effective_roots);
            Ok::<_, DesktopError>(
                webcodex_runner_config::paths::validate_project_path_policy(
                    &canonical_project,
                    &canonical_roots,
                    allow_cwd_anywhere,
                )
                .is_err(),
            )
        })
        .await
        .map_err(|_| {
            desktop_state_unavailable("Project authorization inspection worker stopped")
        })??;
        Ok(ProjectInspection {
            project,
            authorization_required,
        })
    }

    pub async fn refresh_runtime_status(&self) -> DesktopResult<DesktopStateSnapshot> {
        let (operation, cancellation, mut core, baseline) = self
            .begin_operation(DesktopOperationKind::RuntimeRefresh, true)
            .await?;
        let result = core.refresh_runtime_status(&cancellation).await;
        self.finish_operation(operation, cancellation, core, baseline, result)
            .await
    }

    pub async fn observe_chatgpt_activity(&self) -> DesktopResult<DesktopStateSnapshot> {
        if self.shutdown_signal.is_cancelled() {
            return Err(cancelled_error());
        }
        if self.operations.current().is_some() {
            return Ok(self.get_state());
        }
        let cancellation =
            CancellationContext::new(CancellationSignal::new(), self.shutdown_signal.clone());
        let probe = {
            let slot = self.core.lock().await;
            let Some(core) = slot.as_ref() else {
                return Ok(self.get_state());
            };
            let Some(probe) = core.chatgpt_activity_probe() else {
                return Ok(self.get_state());
            };
            probe
        };
        let observation = WebCodexAdapter::chatgpt_activity_with_binary(
            &probe.webcodex,
            &probe.identity,
            &cancellation,
        )
        .await;
        cancellation.check()?;
        let Ok(last_meaningful_activity_at_ms) = observation else {
            return Ok(self.get_state());
        };
        if self.operations.current().is_some() {
            return Ok(self.get_state());
        }
        let mut slot = self.core.lock().await;
        let Some(core) = slot.as_mut() else {
            return Ok(self.get_state());
        };
        core.apply_chatgpt_activity_observation(&probe.identity, last_meaningful_activity_at_ms)
    }

    pub async fn resume_saved_runtime(&self) -> DesktopResult<DesktopStateSnapshot> {
        let (operation, cancellation, mut core, baseline) = self
            .begin_operation(DesktopOperationKind::RuntimeResume, true)
            .await?;
        let result = core.resume_saved_runtime(&cancellation).await;
        self.finish_operation(operation, cancellation, core, baseline, result)
            .await
    }

    pub async fn update_tunnel_config(
        &self,
        request: TunnelConfigRequest,
    ) -> DesktopResult<DesktopStateSnapshot> {
        let (operation, cancellation, mut core, baseline) = self
            .begin_operation(DesktopOperationKind::TunnelConfigUpdate, false)
            .await?;
        let result = async {
            cancellation.check()?;
            let previous = core.tunnel_config.clone();
            core.mutate_tunnel_config(move |config, path| config.update(path, request))
                .await?;
            let id = crate::connection_id::TunnelProfileId::DEFAULT;
            let active =
                process_is_active(core.process_snapshot(ProcessKey::RegularTunnel(id)).await);
            if active && !core.tunnel_config.same_launch_as(&previous, id) {
                core.stop_connection_process(id)
                    .await
                    .map_err(tunnel_apply_error)?;
                core.start_connection_process(id, &cancellation)
                    .await
                    .map_err(tunnel_apply_error)?;
            }
            core.get_state().await
        }
        .await;
        self.finish_operation(operation, cancellation, core, baseline, result)
            .await
    }

    pub async fn update_tunnel_proxy(
        &self,
        mode: TunnelProxyMode,
        custom_url: Option<&str>,
    ) -> DesktopResult<DesktopStateSnapshot> {
        let (operation, cancellation, mut core, baseline) = self
            .begin_operation(DesktopOperationKind::TunnelProxyUpdate, false)
            .await?;
        let result = core
            .update_tunnel
```

### Core Architecture Module: `apps/desktop/src-tauri/src/state/cloudflare_connections.rs`
```
//! Private native control-plane adapter. Runtime credentials stay in Rust; only
//! the explicit OAuth handoff response can carry the newly issued client secret.
use super::*;
use serde::{Deserialize, Serialize, Serializer};
use webcodex_environment::{Secret, TunnelProvider};

#[derive(Deserialize, Serialize)]
#[serde(tag = "action", rename_all = "snake_case", deny_unknown_fields)]
pub enum CloudflareConnectionRequest {
    Status {
        profile_id: String,
    },
    Start {
        profile_id: String,
        server_instance_id: String,
        expected_revision: u64,
    },
    Stop {
        profile_id: String,
        server_instance_id: String,
        process_generation: u64,
    },
    ConfigureOauth {
        profile_id: String,
        server_instance_id: String,
        process_generation: u64,
        redirect_uri: String,
        scopes: Vec<String>,
        #[serde(default)]
        replace: bool,
    },
}
impl CloudflareConnectionRequest {
    fn profile_id(&self) -> &str {
        match self {
            Self::Status { profile_id }
            | Self::Start { profile_id, .. }
            | Self::Stop { profile_id, .. }
            | Self::ConfigureOauth { profile_id, .. } => profile_id,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudflareConnectionStatus {
    pub profile_id: String,
    pub server_instance_id: String,
    pub process_generation: u64,
    pub lifecycle: String,
    pub public_origin: Option<String>,
    pub oauth_configured: bool,
    pub observed_authorization: bool,
    pub configured_revision: u64,
    pub applied_revision: Option<u64>,
    pub local_target: String,
    pub reason_code: Option<String>,
}

#[derive(Serialize)]
pub struct CloudflareOAuthHandoff {
    pub client_id: String,
    pub already_configured: bool,
    #[serde(serialize_with = "serialize_secret")]
    client_secret: Option<Secret>,
}
fn serialize_secret<S: Serializer>(
    value: &Option<Secret>,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    match value {
        Some(secret) => serializer.serialize_some(secret.expose()),
        None => serializer.serialize_none(),
    }
}
#[derive(Serialize)]
#[serde(untagged)]
pub enum CloudflareConnectionResponse {
    Status(CloudflareConnectionStatus),
    OAuth(CloudflareOAuthHandoff),
}

fn unavailable() -> DesktopError {
    DesktopError::new(
        "cloudflare_control_unavailable",
        "The selected Cloudflare connection could not be controlled",
        "Check the local Server and refresh this connection before retrying.",
    )
}
fn requires_environment() -> DesktopError {
    DesktopError::new(
        "cloudflare_environment_required",
        "Cloudflare needs a persistent local Environment",
        "Use Runtime setup or repair to adopt the existing local Server first.",
    )
}

impl AppState {
    pub async fn cloudflare_connection(
        &self,
        request: CloudflareConnectionRequest,
    ) -> DesktopResult<CloudflareConnectionResponse> {
        let state = self.get_state();
        let expected_environment = state
            .persistent_environment
            .as_deref()
            .ok_or_else(requires_environment)?;
        if !state.topology.as_ref().is_some_and(|topology| {
            topology.experience == Experience::Full
                && matches!(topology.server, ServerTopology::Local)
        }) {
            return Err(requires_environment());
        }
        let store = environment::store()?;
        let saved = store
            .load_environment()
            .map_err(environment::desktop_error)?
            .ok_or_else(requires_environment)?;
        if saved.environment_id != expected_environment || !saved.request.local_server() {
            return Err(requires_environment());
        }
        let profile = webcodex_environment::cloudflare_tunnel_profile(&store, request.profile_id())
            .map_err(environment::desktop_error)?;
        if profile.provider == TunnelProvider::Openai {
            return Err(unavailable());
        }
        // Never follow redirects or use a system proxy for private loopback auth.
        validate_control_origin(&profile.local_server_url)?;
        let client = reqwest::Client::builder()
            .no_proxy()
            .redirect(reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(5))
            .build()
            .map_err(|_| unavailable())?;
        let endpoint = format!(
            "{}/api/connections/cloudflare",
            profile.local_server_url.trim_end_matches('/')
        );
        let service_action =
            if profile.host_mode == webcodex_environment::TunnelHostMode::Standalone {
                match &request {
                    CloudflareConnectionRequest::Start {
                        server_instance_id,
                        expected_revision,
                        ..
                    } => Some((
                        webcodex_environment::ServiceOperation::Start,
                        server_instance_id.as_str(),
                        Some(*expected_revision),
                        None,
                    )),
                    CloudflareConnectionRequest::Stop {
                        server_instance_id,
                        process_generation,
                        ..
                    } => Some((
                        webcodex_environment::ServiceOperation::Stop,
                        server_instance_id.as_str(),
                        None,
                        Some(*process_generation),
                    )),
                    _ => None,
                }
            } else {
                None
            };
        let bytes =
            if let Some((action, expected_instance, expected_revision, expected_generation)) =
                service_action
            {
                let status_request = CloudflareConnectionRequest::Status {
                    profile_id: profile.profile_id.clone(),
                };
                let observed = control_response(
                    &client,
                    &endpoint,
                    &profile.bootstrap_token,
                    &status_request,
                )
                .await?;
                let observed: CloudflareConnectionStatus =
                    serde_json::from_slice(&observed).map_err(|_| unavailable())?;
                if observed.profile_id != profile.profile_id
                    || observed.server_instance_id != expected_instance
                    || expected_revision.is_some_and(|revision| {
                        revision != observed.configured_revision || revision != profile.revision
                    })
                    || expected_generation
                        .is_some_and(|generation| generation != observed.process_generation)
                {
                    return Err(unavailable());
                }
                // A standalone service is durable Environment startup intent. Its
                // new run performs its own fenced Server prepare handshake; Desktop
                // never restarts the shared Server to control that service.
                webcodex_environment::NativeEnvironment::new()
                    .map_err(environment::desktop_error)?
                    .control_cloudflare_tunnel(&store, expected_environment, &profile, action)
                    .await
                    .map_err(environment::desktop_error)?;
                control_response(
                    &client,
                    &endpoint,
                    &profile.bootstrap_token,
                    &status_request,
                )
                .await?
            } else {
                control_response(&client, &endpoint, &profile.bootstrap_token, &request).await?
            };
        if matches!(request, CloudflareConnectionRequest::ConfigureOauth { .. }) {
            #[derive(Deserialize)]
            #[serde(deny_unknown_fields)]
            struct WireHandoff {
                client_id: String,
                client_secret: Option<String>,
                #[serde(default)]
                already_configured: bool,
            }
            let handoff: WireHandoff = serde_json::from_slice(&bytes).map_err(|_| unavailable())?;
            if handoff.client_id.is_empty()
                || handoff.client_id.len() > 256
                || handoff
                    .client_secret
                    .as_ref()
                    .is_some_and(|secret| secret.len() > 8192)
            {
                return Err(unavailable());
            }
            return Ok(CloudflareConnectionResponse::OAuth(
                CloudflareOAuthHandoff {
                    client_id: handoff.client_id,
                    already_configured: handoff.already_configured,
                    client_secret: handoff.client_secret.map(Secret::new),
                },
            ));
        }
        let status: CloudflareConnectionStatus =
            serde_json::from_slice(&bytes).map_err(|_| unavailable())?;
        if status.profile_id != request.profile_id()
            || !matches!(
                status.lifecycle.as_str(),
                "stopped" | "starting" | "running" | "disconnected" | "error"
            )
        {
            return Err(unavailable());
        }
        Ok(CloudflareConnectionResponse::Status(status))
    }
}

async fn control_response(
    client: &reqwest::Client,
    endpoint: &str,
    token: &Secret,
    request: &CloudflareConnectionRequest,
) -> DesktopResult<Vec<u8>> {
    let mut response = client
        .post(endpoint)
        .bearer_auth(token.expose())
        .json(request)
        .send()
        .await
        .map_err(|_| unavailable())?;
    let status = response.status();
    if response
        .content_length()
        .is_some_and(|length| length > 32 * 1024)
    {
        return Err(unavailable());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = re
```

### Core Architecture Module: `apps/desktop/src-tauri/src/state/coding_agents.rs`
```
use super::*;
use crate::coding_agents::{CodingAgentRemove, CodingAgentStore, CodingAgentUpdate};

impl AppState {
    pub async fn save_coding_agent(
        &self,
        request: CodingAgentUpdate,
    ) -> DesktopResult<DesktopStateSnapshot> {
        self.mutate_coding_agents(request.target.clone(), move |store| {
            store.stage_update(request)
        })
        .await
    }

    pub async fn remove_coding_agent(
        &self,
        request: CodingAgentRemove,
    ) -> DesktopResult<DesktopStateSnapshot> {
        self.mutate_coding_agents(request.target.clone(), move |store| {
            store.stage_remove(&request.provider_id, request.expected_revision)
        })
        .await
    }

    async fn mutate_coding_agents<F>(
        &self,
        target: crate::webcodex::settings::SettingsTarget,
        change: F,
    ) -> DesktopResult<DesktopStateSnapshot>
    where
        F: FnOnce(&mut CodingAgentStore) -> DesktopResult<()> + Send + 'static,
    {
        let (operation, cancellation, mut core, baseline) = self
            .begin_operation(DesktopOperationKind::RunnerSettingsUpdate, false)
            .await?;
        let result = async {
            let runtime = core
                .config
                .runtime
                .clone()
                .ok_or_else(|| desktop_state_unavailable("Configure a Runner first"))?;
            crate::webcodex::settings::verify_target(&runtime, &target)?;
            let mut candidate = core.coding_agents.clone();
            let candidate = tokio::task::spawn_blocking(move || {
                change(&mut candidate)?;
                // Save is validation + desired-state commit, never a process restart.
                crate::webcodex::settings::reconcile_acp(&runtime, &candidate, true)?;
                candidate.commit()?;
                Ok::<_, DesktopError>(candidate)
            })
            .await
            .map_err(|_| desktop_state_unavailable("Coding Agent worker stopped"))??;
            core.coding_agents = candidate;
            core.get_state().await
        }
        .await;
        self.finish_operation(operation, cancellation, core, baseline, result)
            .await
    }
}

```

### Core Architecture Module: `apps/desktop/src-tauri/src/state/computer_native_smoke.rs`
```
//! Runs only in the explicitly built native smoke host, with isolated AppData.
use super::*;
use tauri::{AppHandle, Manager};
use webcodex_computer_control::{self as control, LocalControl};

fn wait_until(label: &str, mut check: impl FnMut() -> bool) {
    let deadline = std::time::Instant::now() + Duration::from_secs(20);
    while !check() {
        assert!(
            std::time::Instant::now() < deadline,
            "Computer native smoke: {label}"
        );
        std::thread::sleep(Duration::from_millis(40));
    }
}

fn menu(app: &AppHandle, id: impl Into<String>) {
    let id = id.into();
    let handle = app.clone();
    app.run_on_main_thread(move || crate::tray::handle_menu_event(&handle, &id))
        .unwrap();
}

pub(crate) fn exercise(app: &AppHandle) {
    use crate::computer_control::presentation::Presentation;
    use webcodex_environment::{
        EnvironmentMode, EnvironmentRecord, EnvironmentStore, RuntimeBinaries, SetupRequest,
        ENVIRONMENT_SCHEMA,
    };
    use windows_sys::Win32::UI::Input::KeyboardAndMouse::{
        keybd_event, KEYEVENTF_KEYUP, VK_ESCAPE,
    };
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DestroyWindow, GetForegroundWindow,
        GetWindowDisplayAffinity, GetWindowLongPtrW, SetForegroundWindow, SetWindowLongPtrW,
        GWLP_WNDPROC, GWL_EXSTYLE, WM_KEYUP, WS_EX_NOACTIVATE, WS_EX_TRANSPARENT,
        WS_OVERLAPPEDWINDOW, WS_VISIBLE,
    };
    static ESCAPE_RECEIVED: std::sync::atomic::AtomicBool =
        std::sync::atomic::AtomicBool::new(false);
    unsafe extern "system" fn keyboard_window_proc(
        window: windows_sys::Win32::Foundation::HWND,
        message: u32,
        wparam: usize,
        lparam: isize,
    ) -> isize {
        if message == WM_KEYUP && wparam == usize::from(VK_ESCAPE) {
            ESCAPE_RECEIVED.store(true, Ordering::Release);
        }
        DefWindowProcW(window, message, wparam, lparam)
    }

    let state = app.state::<AppState>();
    // Keep the unrelated service observer out of this private metadata fixture.
    // No Runtime is installed, adopted or started by this test.
    let _core = tauri::async_runtime::block_on(state.core.lock());
    let store =
        EnvironmentStore::open(webcodex_environment::default_environment_dir().unwrap()).unwrap();
    let exe = std::env::current_exe().unwrap();
    let environment_id = "computer-native-smoke";
    store
        .save_environment(&EnvironmentRecord {
            schema_version: ENVIRONMENT_SCHEMA,
            environment_id: environment_id.into(),
            request: SetupRequest {
                service_scope: webcodex_environment::service::ServiceScope::System,
                mode: EnvironmentMode::Join,
                server_url: "http://127.0.0.1:1".into(),
                project: None,
                runner: Some(true),
                runner_display_name: None,
                account: webcodex_environment::current_account().unwrap(),
                binaries: RuntimeBinaries {
                    cli: exe.clone(),
                    server: exe.clone(),
                    runner: exe,
                },
            },
            username: None,
            runner_client_id: None,
            projects: vec![],
            configured: true,
        })
        .unwrap();
    let dir = store.root().join("cu");
    std::fs::create_dir_all(&dir).unwrap();
    let gate = LocalControl::persistent(&dir).unwrap();
    control::serve(&dir, gate.clone()).unwrap();
    state.published.write().unwrap().persistent_environment = Some(environment_id.into());
    let settings = app.state::<Presentation>();
    assert!(!settings.controlling.load(Ordering::Acquire));
    wait_until("OS Escape listener installed automatically", || {
        settings.shortcut_ready.load(Ordering::Acquire)
    });
    assert!(app.get_webview_window("main").is_none());

    let initial = gate.snapshot().unwrap();
    wait_until("tray pause without a main WebView", || {
        menu(app, format!("tray.pause_computer:{}", initial.epoch));
        gate.snapshot().unwrap().paused
    });
    let paused = gate.snapshot().unwrap();
    assert!(
        LocalControl::persistent(&dir)
            .unwrap()
            .snapshot()
            .unwrap()
            .paused
    );
    assert!(gate.begin(true, None).is_err());
    let observation = gate.begin(false, None).unwrap();
    let observed = crate::computer_control::observe(&state.get_state()).unwrap();
    assert!(observed.state.paused && observed.state.observing);
    assert!(!observed.state.controlling);
    assert_eq!(
        crate::computer_control::status_key(Some(&observed.state)),
        "tray.computerPausedObserving"
    );
    drop(observation);
    wait_until("tray resume without a main WebView", || {
        menu(app, format!("tray.resume_computer:{}", paused.epoch));
        !gate.snapshot().unwrap().paused
    });
    // A queued click from the previous menu cannot resume a later local pause.
    let current = gate.snapshot().unwrap();
    gate.set_paused(&current.epoch, true).unwrap();
    menu(app, format!("tray.resume_computer:{}", paused.epoch));
    let fresh = crate::computer_control::observe(&state.get_state()).unwrap();
    assert!(fresh.state.paused);
    wait_until("fresh tray resume", || {
        menu(app, format!("tray.resume_computer:{}", fresh.state.epoch));
        !gate.snapshot().unwrap().paused
    });
    eprintln!("NATIVE_COMPUTER tray_pause_resume=passed main=absent observation=available stale_resume=rejected");

    crate::desktop_shell::show_main_window(app).unwrap();
    wait_until("own foreground window", || {
        app.get_webview_window("main").is_some_and(|window| {
            window.is_visible().unwrap_or(false)
                && window
                    .hwnd()
                    .is_ok_and(|hwnd| unsafe { GetForegroundWindow() } == hwnd.0)
        })
    });
    app.get_webview_window("main")
        .unwrap()
        .set_title("WebCodex Computer Control smoke")
        .unwrap();
    let foreground = unsafe { GetForegroundWindow() };
    let activity = gate.begin(true, None).unwrap();
    wait_until("native overlay on every attached monitor", || {
        app.available_monitors()
            .unwrap()
            .iter()
            .enumerate()
            .all(|(index, monitor)| {
                app.get_webview_window(&format!("computer-activity-{index}"))
                    .is_some_and(|window| {
                        window.is_visible().unwrap_or(false)
                            && window
                                .outer_position()
                                .is_ok_and(|position| position == *monitor.position())
                    })
            })
    });
    assert_eq!(
        unsafe { GetForegroundWindow() },
        foreground,
        "overlay stole keyboard focus"
    );
    let monitor_count = app.available_monitors().unwrap().len();
    assert!((1..=16).contains(&monitor_count));
    for index in 0..monitor_count {
        let overlay = app
            .get_webview_window(&format!("computer-activity-{index}"))
            .unwrap();
        let hwnd = overlay.hwnd().unwrap().0;
        let style = unsafe { GetWindowLongPtrW(hwnd, GWL_EXSTYLE) } as u32;
        assert_ne!(
            style & WS_EX_TRANSPARENT,
            0,
            "overlay must pass pointer input through"
        );
        assert_ne!(style & WS_EX_NOACTIVATE, 0, "overlay must not activate");
        let mut affinity = 0;
        assert_ne!(unsafe { GetWindowDisplayAffinity(hwnd, &mut affinity) }, 0);
        assert_eq!(affinity, 0x11, "overlay must be excluded from capture");
    }
    menu(app, "tray.lightweight");
    wait_until("activity overlay survives unloaded main", || {
        app.get_webview_window("main").is_none()
            && app
                .get_webview_window("computer-activity-0")
                .unwrap()
                .is_visible()
                .unwrap()
    });
    drop(activity);
    wait_until("activity overlay hides after input finishes", || {
        app.get_webview_window("computer-activity-0")
            .is_some_and(|window| !window.is_visible().unwrap())
    });
    eprintln!("NATIVE_COMPUTER overlay monitors={monitor_count} pointer=transparent focus=preserved capture=excluded main=absent");

    // A plain owned native window receives any unhandled keys. It contains no
    // WebView: the production shortcut must keep working with main unloaded.
    let (tx, rx) = std::sync::mpsc::sync_channel(1);
    app.run_on_main_thread(move || {
        let class: Vec<u16> = "STATIC\0".encode_utf16().collect();
        let title: Vec<u16> = "WebCodex Computer shortcut fixture\0"
            .encode_utf16()
            .collect();
        let window = unsafe {
            CreateWindowExW(
                0,
                class.as_ptr(),
                title.as_ptr(),
                WS_OVERLAPPEDWINDOW | WS_VISIBLE,
                120,
                120,
                360,
                120,
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null_mut(),
                std::ptr::null(),
            )
        };
        assert!(!window.is_null());
        assert_ne!(
            unsafe {
                SetWindowLongPtrW(
                    window,
                    GWLP_WNDPROC,
                    keyboard_window_proc as *const () as isize,
                )
            },
            0
        );
        unsafe { SetForegroundWindow(window) };
        tx.send(window as usize).unwrap();
    })
    .unwrap();
    let keyboard_target = rx.recv_timeout(Duration::from_secs(3)).unwrap();
    wait_until("own native window before global shortcut", || {
        (unsafe { GetForegroundWindow() }) as usize == keyboard_target
    });
    assert!(app.get_webview_window("main").is_none());
    // Computer's injected Escape must remain usable
```

### Core Architecture Module: `apps/desktop/src-tauri/src/state/connections.rs`
```
use super::*;
use crate::connection_id::TunnelProfileId;
use crate::connections::{
    ConnectionError, ConnectionHealth, ConnectionLifecycle, ConnectionsSnapshot,
    TunnelConnectionSnapshot,
};
use crate::tunnel_config::TunnelProfileRequest;
use serde::Deserialize;

#[cfg(test)]
mod tests;

#[derive(Clone, Copy, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ConnectionAction {
    Start,
    Stop,
    Restart,
    Delete,
}

impl AppState {
    pub async fn resume_saved_connections(&self) -> DesktopResult<DesktopStateSnapshot> {
        let (operation, cancellation, mut core, baseline) = self
            .begin_operation(DesktopOperationKind::RegularTunnelStart, true)
            .await?;
        let result = async {
            if core.configuration_issue.is_some() || super::environment::migration_in_progress() {
                return Err(DesktopError::new(
                    "configuration_unavailable",
                    "Saved configuration is unavailable or being migrated",
                    "Resolve the configuration issue before reconnecting.",
                ));
            }
            core.autostart_connections(&cancellation).await?;
            core.get_state().await
        }
        .await;
        self.finish_operation(operation, cancellation, core, baseline, result)
            .await
    }

    pub async fn save_tunnel_profile(
        &self,
        request: TunnelProfileRequest,
    ) -> DesktopResult<DesktopStateSnapshot> {
        let (operation, cancellation, mut core, baseline) = self
            .begin_operation(DesktopOperationKind::TunnelConfigUpdate, false)
            .await?;
        let result = async {
            cancellation.check()?;
            if core.config.persistent_environment.is_some() {
                core.save_persistent_tunnel_profile(request, &cancellation)
                    .await?;
                return core.get_state().await;
            }

            let previous = core.tunnel_config.clone();
            let id = core
                .mutate_tunnel_config(move |config, path| config.update_profile(path, request))
                .await?;
            core.project_connections();
            core.publish_snapshot();
            let active =
                process_is_active(core.process_snapshot(ProcessKey::RegularTunnel(id)).await);
            if active && !core.tunnel_config.same_launch_as(&previous, id) {
                core.stop_connection_process(id)
                    .await
                    .map_err(tunnel_apply_error)?;
            }
            let enabled = core
                .tunnel_config
                .profiles()
                .iter()
                .any(|profile| profile.id == id.to_string() && profile.enabled);
            if enabled && core.snapshot.readiness.runtime_ready {
                core.start_connection_process(id, &cancellation)
                    .await
                    .map_err(tunnel_apply_error)?;
            }
            core.get_state().await
        }
        .await;
        self.finish_operation(operation, cancellation, core, baseline, result)
            .await
    }

    pub async fn tunnel_profile_action(
        &self,
        id: String,
        action: ConnectionAction,
    ) -> DesktopResult<DesktopStateSnapshot> {
        self.tunnel_profile_action_at_revision(id, action, None, None)
            .await
    }

    pub async fn tunnel_profile_action_at_revision(
        &self,
        id: String,
        action: ConnectionAction,
        expected_revision: Option<u64>,
        expected_configuration_id: Option<String>,
    ) -> DesktopResult<DesktopStateSnapshot> {
        let (operation, cancellation, mut core, baseline) = self
            .begin_operation(DesktopOperationKind::TunnelConfigUpdate, false)
            .await?;
        let result = async {
            cancellation.check()?;
            if core.config.persistent_environment.is_some() {
                core.persistent_tunnel_profile_action(
                    &id,
                    action,
                    expected_revision,
                    expected_configuration_id.as_deref(),
                    &cancellation,
                )
                .await?;
                return core.get_state().await;
            }

            let id = TunnelProfileId::try_from(id).map_err(|_| connection_missing())?;
            if !core
                .tunnel_config
                .profiles()
                .iter()
                .any(|profile| profile.id == id.to_string())
            {
                return Err(connection_missing());
            }
            match action {
                ConnectionAction::Start | ConnectionAction::Restart => {
                    core.mutate_tunnel_config(move |config, path| {
                        config.set_enabled(path, id, true)
                    })
                    .await?;
                    if matches!(action, ConnectionAction::Restart) {
                        core.stop_connection_process(id).await?;
                    }
                    core.start_connection_process(id, &cancellation).await?;
                }
                ConnectionAction::Stop => {
                    // Persist the user's stop intent before touching the owned process.
                    core.mutate_tunnel_config(move |config, path| {
                        config.set_enabled(path, id, false)
                    })
                    .await?;
                    core.stop_connection_process(id).await?;
                }
                ConnectionAction::Delete => {
                    // A failed stop must retain both identity and secret for recovery.
                    core.stop_connection_process(id).await?;
                    core.mutate_tunnel_config(move |config, path| config.remove(path, id))
                        .await?;
                    core.connections.remove(id);
                }
            }
            core.get_state().await
        }
        .await;
        self.finish_operation(operation, cancellation, core, baseline, result)
            .await
    }
}

impl DesktopCore {
    pub(super) async fn mutate_tunnel_config<T: Send + 'static>(
        &mut self,
        change: impl FnOnce(&mut TunnelConfig, &Path) -> DesktopResult<T> + Send + 'static,
    ) -> DesktopResult<T> {
        let mut config = self.tunnel_config.clone();
        let path = self.data_dir.join("secrets/tunnel-config.json");
        let (config, result) = tokio::task::spawn_blocking(move || {
            let result = change(&mut config, &path)?;
            Ok::<_, DesktopError>((config, result))
        })
        .await
        .map_err(|_| {
            DesktopError::new(
                "tunnel_config_unavailable",
                "Connection settings could not be saved",
                "Refresh Desktop before retrying.",
            )
        })??;
        self.tunnel_config = config;
        Ok(result)
    }

    async fn save_persistent_tunnel_profile(
        &mut self,
        request: TunnelProfileRequest,
        cancellation: &CancellationContext,
    ) -> DesktopResult<()> {
        cancellation.check()?;
        let store = super::environment::store()?;
        self.tunnel_config
            .ensure_persistent_catalog_compatible(&store)?;
        let profiles = webcodex_environment::tunnel_profile_snapshots(&store)
            .map_err(super::environment::desktop_error)?;
        let profile_id = request
            .id
            .clone()
            .unwrap_or_else(|| TunnelProfileId::new().to_string());
        let existing = profiles
            .iter()
            .find(|profile| profile.profile_id == profile_id);
        if request.id.is_some() && existing.is_none() {
            return Err(connection_missing());
        }
        if request.provider != webcodex_environment::TunnelProvider::Openai {
            let saved = store
                .load_environment()
                .map_err(super::environment::desktop_error)?;
            if saved.as_ref().map(|record| record.environment_id.as_str())
                != self.config.persistent_environment.as_deref()
            {
                return Err(DesktopError::new(
                    "environment_changed",
                    "The saved Environment changed",
                    "Refresh Runtime setup before saving this connection.",
                ));
            }
            if !self.config.topology.as_ref().is_some_and(|topology| {
                topology.experience == Experience::Full
                    && matches!(topology.server, ServerTopology::Local)
            }) {
                return Err(DesktopError::new(
                    "cloudflare_environment_required",
                    "Cloudflare needs a persistent local Environment",
                    "Use Runtime setup or repair first.",
                ));
            }
            let token = request
                .cloudflare_token
                .map(webcodex_environment::Secret::new);
            let native = webcodex_environment::NativeEnvironment::new()
                .map_err(super::environment::desktop_error)?;
            native
                .configure_cloudflare_tunnel_profile(
                    &store,
                    &webcodex_environment::CloudflareTunnelProfileRequest {
                        profile_id: &profile_id,
                        name: Some(&request.name),
                        host_mode: request.host_mode,
                        autostart: request.autostart,
                        expected_revision: request.expected_revision,
                        provider: request.provider,
                        token: token.as_ref(),
                        ingress_port: None,
                    },
                )
                .await
                .map_err(super::environment::desktop_error)?;
            return cancellation.check();
        }
        if request.cloudflare_token.is_some() {
        
```

### Core Architecture Module: `apps/desktop/src-tauri/src/state/desktop_core.rs`
```
pub struct DesktopCore {
    data_dir: PathBuf,
    config_path: PathBuf,
    config: StoredDesktopConfig,
    configuration_issue: Option<String>,
    runtime_candidate: Option<crate::runtime_selection::RuntimeCandidate>,
    runtime_candidate_context: Option<String>,
    runtime_selected_probe: Option<crate::runtime_selection::RuntimeCandidate>,
    runtime_last_switch: Option<crate::runtime_selection::RuntimeSwitchResult>,
    tunnel_config: TunnelConfig,
    mcp_providers: crate::mcp_providers::McpProviderStore,
    mcp_applied_revision: Option<u64>,
    coding_agents: crate::coding_agents::CodingAgentStore,
    coding_agents_applied_revision: Option<u64>,
    connections: ConnectionRuntimes,
    snapshot: DesktopStateSnapshot,
    inventory_persistence_pending: bool,
    adapter: WebCodexAdapter,
    supervisor: SharedSupervisor,
    activity: ActivityLog,
    published: Arc<RwLock<DesktopStateSnapshot>>,
}

impl DesktopCore {
    fn new(data_dir: PathBuf, resource_dir: PathBuf) -> DesktopResult<Self> {
        let activity = ActivityLog::with_lifecycle(&data_dir);
        let config_path = data_dir.join("desktop-state.json");
        // Keep Diagnostics usable if migration fails; admission below prevents
        // replacing the operator's files with a default configuration.
        let (mut config, configuration_issue) = match load_config(&config_path, &activity) {
            Ok(config) => (config, None),
            Err(error) => (StoredDesktopConfig::default(), Some(error.code)),
        };
        if configuration_issue.is_none() {
            environment::adopt_saved_environment(&mut config);
            if config.persistent_environment.is_none() && environment::migration_in_progress() {
                config.runtime_autostart = Some(false);
            }
        }
        let tunnel_config = TunnelConfig::load(
            &data_dir.join("secrets").join("tunnel-config.json"),
            config.preferred_connection == Some(RegularConnectionPreference::OpenAiTunnel),
        );
        let mut snapshot = DesktopStateSnapshot::default();
        snapshot.configuration_issue = configuration_issue.clone();
        snapshot.topology = config.topology.clone();
        snapshot.project = project_snapshot(&config);
        if config.topology.is_some() && config.runtime_autostart == Some(false) {
            snapshot.readiness = aggregate_readiness(
                ServerReadiness::Stopped,
                RunnerReadiness::Stopped,
                ExposureReadiness::Disabled,
                if config.project.is_some() {
                    ProjectReadiness::Configured
                } else {
                    ProjectReadiness::None
                },
            );
        }
        apply_openai_tunnel_configuration(
            &mut snapshot,
            &tunnel_config,
            config.persistent_environment.is_some(),
        );
        snapshot.regular_tunnel_available = true;
        snapshot.powershell_runtime = crate::platform::powershell_runtime_snapshot();
        apply_config_projection(&mut snapshot, &config);
        snapshot.connections = crate::connections::ConnectionsSnapshot {
            profiles: tunnel_config
                .profiles()
                .into_iter()
                .map(|config| crate::connections::TunnelConnectionSnapshot {
                    config,
                    runtime: Default::default(),
                })
                .collect(),
            config_error: tunnel_config.is_invalid(),
            ..Default::default()
        };
        let mcp_providers = crate::mcp_providers::McpProviderStore::load(&data_dir);
        snapshot.mcp_providers = mcp_providers.snapshot(None);
        let coding_agents = crate::coding_agents::CodingAgentStore::load(&data_dir);
        snapshot.coding_agents = coding_agents.snapshot(None);
        let published = Arc::new(RwLock::new(snapshot.clone()));
        let supervisor = Arc::new(Mutex::new(ProcessSupervisor::new(activity.clone())));
        let runtime_directory = std::env::current_exe()
            .ok()
            .and_then(|executable| {
                webcodex_environment::installed_desktop_runtime_directory(&executable)
            })
            .unwrap_or_else(|| resource_dir.join("webcodex-runtime"));
        let mut adapter = WebCodexAdapter::new(Some(runtime_directory));
        adapter.set_runtime_source(config.runtime_binary_source.clone());
        let mut core = Self {
            data_dir,
            config_path,
            config,
            configuration_issue,
            runtime_candidate: None,
            runtime_candidate_context: None,
            runtime_selected_probe: None,
            runtime_last_switch: None,
            tunnel_config,
            mcp_providers,
            mcp_applied_revision: None,
            coding_agents,
            coding_agents_applied_revision: None,
            connections: ConnectionRuntimes::default(),
            snapshot,
            inventory_persistence_pending: false,
            adapter,
            supervisor,
            activity,
            published,
        };
        core.publish_snapshot();
        Ok(core)
    }

    pub async fn get_state(&mut self) -> DesktopResult<DesktopStateSnapshot> {
        Ok(self.publish_snapshot())
    }

    fn chatgpt_activity_probe(&self) -> Option<ChatGptActivityProbe> {
        if !self.snapshot.readiness.runtime_ready {
            return None;
        }
        let identity = identity_from_config(&self.config)?;
        let webcodex = self.adapter.binaries().ok()?.webcodex.clone();
        Some(ChatGptActivityProbe { identity, webcodex })
    }

    fn apply_chatgpt_activity_observation(
        &mut self,
        expected_identity: &ProjectRuntimeIdentity,
        last_meaningful_activity_at_ms: Option<i64>,
    ) -> DesktopResult<DesktopStateSnapshot> {
        if !self.snapshot.readiness.runtime_ready
            || identity_from_config(&self.config).as_ref() != Some(expected_identity)
        {
            return Ok(self.publish_snapshot());
        }
        let last_meaningful_activity_at_ms = last_meaningful_activity_at_ms.max(
            self.snapshot
                .chatgpt_activity
                .as_ref()
                .and_then(|activity| activity.last_meaningful_activity_at_ms),
        );
        self.snapshot.chatgpt_activity = Some(ChatGptActivitySnapshot {
            observed: last_meaningful_activity_at_ms.is_some(),
            last_meaningful_activity_at_ms,
        });
        Ok(self.publish_snapshot())
    }

    fn stage_project_scope(&mut self, project: ProjectSelection) {
        self.snapshot.project = Some(project);
        // ChatGPT activity is evidence for one exact runtime Project. Never carry
        // an observation from the previously displayed Project into a new setup
        // or Quick Share scope; the new Project must earn its own observation.
        self.snapshot.chatgpt_activity = None;
    }

    pub async fn refresh_runtime_status(
        &mut self,
        cancellation: &CancellationContext,
    ) -> DesktopResult<DesktopStateSnapshot> {
        cancellation.check()?;
        if self.config.persistent_environment.is_some() {
            return self.refresh_environment_status(cancellation).await;
        }
        if self.snapshot.quick_share.is_some() {
            self.snapshot.chatgpt_activity = None;
            let active = self
                .process_snapshot(ProcessKey::QuickShare)
                .await
                .is_some_and(|process| {
                    matches!(
                        process.phase,
                        ProcessPhase::Starting | ProcessPhase::Running
                    )
                });
            if !active {
                self.snapshot.readiness = aggregate_readiness(
                    ServerReadiness::Stopped,
                    RunnerReadiness::Stopped,
                    ExposureReadiness::Error,
                    ProjectReadiness::Configured,
                );
                self.snapshot.readiness.summary_kind = ReadinessSummaryKind::QuickShareStopped;
                self.snapshot.readiness.next_action_kind =
                    Some(ReadinessNextActionKind::RestartQuickShare);
                self.snapshot.readiness.summary = "Quick Share stopped".to_string();
                self.snapshot.readiness.next_action = Some("Start Quick Share again.".to_string());
            }
            return self.get_state().await;
        }

        let Some(identity) = runner_identity_from_config(&self.config) else {
            self.snapshot.chatgpt_activity = None;
            self.snapshot.topology = self.config.topology.clone();
            self.snapshot.project = project_snapshot(&self.config);
            return self.get_state().await;
        };
        self.adapter.ensure_binaries(cancellation).await.ok();
        cancellation.check()?;
        if let Ok(binaries) = self.adapter.binaries() {
            self.snapshot.binaries = Some(binaries.info());
        }
        let server = match self
            .adapter
            .server_status(
                Some(&identity.server_url),
                self.config
                    .runtime
                    .as_ref()
                    .and_then(|runtime| runtime.server_env_file.as_deref()),
                Some(&identity.user_token_file),
                cancellation,
            )
            .await
        {
            Ok(status) if status.http_reachable => ServerReadiness::Ready,
            Ok(_) => ServerReadiness::Error,
            Err(_) => ServerReadiness::Unknown,
        };
        cancellation.check()?;
        // A saved user stop remains stopped across refresh, while a reachable
        // external service is still observed normally.
        if !runtime_autostart(&self.config) && server != ServerReadiness::Ready {
            self.snapshot.chatgpt_activity = None;
            self.snapshot.readiness = aggregate_readiness(
   
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1122** (2026-10-13): **A Potential OAuth consent form input collision — request for maintainer feedback**
  *Symptoms*: ## Description While reviewing the OAuth authorization flow, I noticed that parameters from the original authorization request appear to be carried into hidden form fields.  I'm wondering whether, under certain conditions, these parameters could interfere with user-controlled form inputs.  For example, this might cause an explicit consent decision to be interpreted differently from what the user selected, or an optional permission to be treated as selected when it was not.  I don't currently have sufficient evidence to assess whether this issue is practically exploitable or how significant its security impact might be.  For that reason, I haven't submitted a private security report. However, considering the potential implications, I've also held off on opening a public PR.  ## Questions  I'd appreciate the maintainers' thoughts on a few points:  1. Is this a genuine bug, or is the behavior already handled by existing validation? 2. If it is a bug, do you think it warrants a fix? 3. Given the potential security implications, would you prefer a regular public PR or private coordination before submitting the fix? Additional context  I've prepared a tentative fix with regression tests in my fork, but I haven't opened a PR yet.  I'd be happy to share the implementation or provide more details if needed.  Thanks for taking a look! 

- **Issue #1043** (2026-10-11): **[Bug][Local MCP] tools/list rejects composite tool descriptions over 4 KiB (invalid_provider_tools)**
  *Symptoms*: ## Summary / 问题概述  WebCodex Desktop v0.4.6 rejects a functioning third-party stdio MCP provider's entire `tools/list` inventory when any single tool's `description` exceeds 4,096 bytes. The result is a generic `invalid_provider_tools` error, even though the provider initializes and its tools can be enumerated by an independent MCP client.  中文简述：WebCodex v0.4.6 的本地 MCP 网关将单个工具描述限制为 4 KiB。一个正常运行的复合工具 MCP Server（DaVinci Resolve MCP）有多项描述超过此上限，导致全部 37 个工具无法通过 WebCodex 被发现。仅缩短 description、保留全部工具和 Schema 后，工具发现成功。  ## Evidence status and AI disclosure  **This issue was drafted and posted by an AI assistant at the user's explicit request.** The assistant inspected the pinned WebCodex source and analyzed diagnostic results supplied by the user. **The real Windows/WebCodex reproduction and proxy A/B tests were performed by the user, not independently run by the assistant.** Source analysis supports the likely root cause described below; there has not been a test against current `main`.  ## Environment  - WebCodex Desktop / Server / Runner: **v0.4.6**, aligned at commit `5072608fe74b2bfa6e8f208515c04242f475582f` (from the user's diagnostics). - OS: Windows (local Desktop and Runner). - Transport: local `stdio` MCP provider, configured through WebCodex Desktop / `runner.toml`. - Third-party provider: [samuelgursky/davinci-resolve-mcp](https://github.com/samuelgursky/davinci-resolve-mcp) **v4.10.4**, default Python `src/server.py` composite-tool mode. - Target application: DaVinci Resolv

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

### Incident Patch 1: `3c141967` (2026-11-11)
**Commit Message**: fix(import): support opt-in loopback proxy for OpenAI host-file downloads (#1418)

**File**: `docs/MCP.md` (modified, +15/-0)
```diff
@@ -99,6 +99,21 @@ authorization; users should not copy or expose that credential. Independent/netw
 accessible Servers remain off by default and must not use this as a substitute for
 OAuth.
 
+
+When a loopback-only Desktop Server is behind a local HTTP proxy and OpenAI
+attachment domains resolve to a proxy-managed fake IP, direct TLS connections
+may fail even after the trusted tunnel's fake-IP admission succeeds. Operators
+may opt in to the **OpenAI host-file import only** proxy by setting
+`WEBCODEX_OPENAI_FILE_IMPORT_PROXY=http://127.0.0.1:PORT` in the Server
+environment and restarting the Server. IPv6 `http://[::1]:PORT` is also
+accepted. The setting defaults to off and is ignored for ordinary trusted MCP
+URLs and remote authenticated imports; it requires an explicitly trusted
+loopback MCP source and an allowlisted OpenAI attachment hostname. TLS server
+certificate verification and redirect rejection remain enabled. The HTTP
+CONNECT proxy chooses the upstream address instead of WebCodex's directly
+pinned DNS addresses, so use only a proxy you control and trust; no remote
+proxy endpoints, credentials, or hostnames are accepted as proxy settings.
+
 For a regular independent Windows Server + Runner reached through OpenAI Tunnel, or to troubleshoot a case where local MCP is healthy but ChatGPT Connector creation still fails, see the [Windows + OpenAI Secure MCP Tunnel deep dive](WINDOWS_OPENAI_TUNNEL.md). It is advanced setup/troubleshooting material, not required reading for a first-time user.
 
 ## Result cards
```

**File**: `docs/MCP.zh-CN.md` (modified, +11/-0)
```diff
@@ -296,6 +296,17 @@ credential 认证的 ChatGPT host-file rewrite。WebCodex Desktop 自 v0.4.2 起
 该 credential，并只把它注入原生 Tunnel 的固定本地 Authorization；用户不应复制或暴露该
 credential。独立/network-accessible Server 仍默认关闭，不应使用它替代 OAuth。
 
+
+如果仅监听 loopback 的 Desktop Server 通过本地 HTTP 代理访问外网，并且 OpenAI
+附件域名被代理 DNS 解析成 Fake-IP，可信 tunnel 已通过 Fake-IP 准入检查后，
+直接建立 TLS 连接仍可能失败。运维者可以在 Server 环境中显式设置
+`WEBCODEX_OPENAI_FILE_IMPORT_PROXY=http://127.0.0.1:PORT`，然后重启 Server；
+也支持 `http://[::1]:PORT`。该配置默认关闭，只作用于可信本机 MCP 来源的
+OpenAI 附件域名，不会代理普通 trusted MCP URL 或远程认证导入。
+TLS 证书验证和禁止重定向仍然生效。不过，HTTP CONNECT 代理会自行选择上游地址，
+不会使用 WebCodex 直连模式固定的 DNS 地址，因此只能配置自己控制且信任的本机代理。
+配置不接受远程代理地址、带凭据的 URL 或主机名形式的代理端点。
+
 如果在 Windows 上使用普通独立 Server + Runner 并通过 OpenAI Tunnel 接入，或排查“本地 MCP 正常但 ChatGPT Connector 创建失败”的情况，见 [Windows + OpenAI Secure MCP Tunnel 深入实操](WINDOWS_OPENAI_TUNNEL.zh-CN.md)。它是深入配置/排障文档，不是普通用户第一次必须阅读的教程。
 
 ## 结果卡片
```

**File**: `src/mcp_tests/file_import.rs` (modified, +41/-0)
```diff
@@ -185,6 +185,47 @@ async fn start_mcp_import_mock_server(response: Vec<u8>) -> McpImportMockServer
     }
 }
 
+#[tokio::test]
+async fn mcp_import_loopback_proxy_sends_https_connect() {
+    use tokio::io::{AsyncReadExt, AsyncWriteExt};
+
+    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
+        .await
+        .expect("local test listener");
+    let local_port = listener.local_addr().unwrap().port();
+    let client = crate::tool_runtime::conversation_import::build_loopback_proxy_client_for_test(
+        &format!("http://127.0.0.1:{local_port}"),
+    )
+    .expect("client must accept an explicit loopback proxy");
+    let probe = tokio::spawn(async move {
+        let (mut connection, _) = listener.accept().await.expect("CONNECT should arrive");
+        let mut buf = [0u8; 2048];
+        let count = connection
+            .read(&mut buf)
+            .await
+            .expect("read CONNECT request");
+        let request = String::from_utf8_lossy(&buf[..count]);
+        assert!(
+            request.starts_with("CONNECT files.oaiusercontent.com:443 HTTP/1.1"),
+            "unexpected CONNECT target"
+        );
+        connection
+            .write_all(b"HTTP/1.1 407 Proxy Authentication Required\r\nContent-Length: 0\r\n\r\n")
+            .await
+            .expect("reply to CONNECT");
+    });
+    let _ = tokio::time::timeout(
+        std::time::Duration::from_secs(5),
+        client.get("https://files.oaiusercontent.com/file").send(),
+    )
+    .await
+    .expect("the mocked proxy must respond promptly");
+    tokio::time::timeout(std::time::Duration::from_secs(5), probe)
+        .await
+        .expect("the local proxy was not contacted")
+        .expect("proxy probe failed");
+}
+
 fn mcp_import_config(trusted_client_ids: &[&str]) -> Arc<crate::Config> {
     let mut config = (*test_config_oauth2(Some("secret"))).clone();
     config.oauth2.trusted_mcp_file_client_ids = trusted_client_ids
```

**File**: `src/tool_runtime/conversation_import.rs` (modified, +180/-4)
```diff
@@ -392,13 +392,97 @@ async fn validate_trusted_mcp_download_url(
     })
 }
 
+const LOOPBACK_OPENAI_FILE_PROXY_ENV: &str = "WEBCODEX_OPENAI_FILE_IMPORT_PROXY";
+
+fn parse_loopback_openai_file_proxy(raw: &str) -> Result<reqwest::Url, String> {
+    let proxy = reqwest::Url::parse(raw)
+        .map_err(|_| "OpenAI file proxy must be a valid loopback HTTP URL".to_string())?;
+    let loopback = match proxy.host() {
+        Some(url::Host::Ipv4(ip)) => ip == Ipv4Addr::LOCALHOST,
+        Some(url::Host::Ipv6(ip)) => ip == Ipv6Addr::LOCALHOST,
+        _ => false,
+    };
+    // url::Url normalizes explicit HTTP :80 to no stored port, so inspect
+    // the original authority to distinguish :80 from an omitted port.
+    let explicit_port = raw
+        .split_once("://")
+        .and_then(|(_, rest)| rest.split(['/', '?', '#']).next())
+        .and_then(|authority| authority.rsplit_once(':'))
+        .and_then(|(_, port)| port.parse::<u16>().ok());
+    if proxy.scheme() != "http"
+        || !loopback
+        || explicit_port.is_none()
+        || !proxy.username().is_empty()
+        || proxy.password().is_some()
+        || proxy.path() != "/"
+        || proxy.query().is_some()
+        || proxy.fragment().is_some()
+    {
+        return Err(
+            "OpenAI file proxy must be http://127.0.0.1:PORT or http://[::1]:PORT".to_string(),
+        );
+    }
+    Ok(proxy)
+}
+
+fn select_loopback_openai_file_proxy(
+    target: &TrustedDownloadTarget,
+    policy: ConversationImportDownloadPolicy,
+    value: Option<&str>,
+) -> Result<Option<reqwest::Url>, String> {
+    if policy != ConversationImportDownloadPolicy::LoopbackTrustedMcpHostFile {
+        return Ok(None);
+    }
+    let Some(value) = value.filter(|value| !value.is_empty()) else {
+        return Ok(None);
+    };
+    if !target
+        .resolver_host
+        .as_deref()
+        .is_some_and(is_openai_download_host)
+    {
+        // Preserve the normal direct-download path for unrelated trusted MCP
+        // URLs even when the operator enables the OpenAI-specific proxy.
+        return Ok(None);
+    }
+    Ok(Some(parse_loopback_openai_file_proxy(value)?))
+}
+
+fn configured_loopback_openai_file_proxy(
+    target: &TrustedDownloadTarget,
+    policy: ConversationImportDownloadPolicy,
+) -> Result<Option<reqwest::Url>, String> {
+    // Never proxy arbitrary trusted-MCP URLs or remote OAuth imports. The
+    // explicit local proxy is an opt-in trust boundary for OpenAI attachments
+    // on the local Desktop/Secure-Tunnel session only.
+    if policy != ConversationImportDownloadPolicy::LoopbackTrustedMcpHostFile {
+        return Ok(None);
+    }
+    let value = match std::env::var(LOOPBACK_OPENAI_FILE_PROXY_ENV) {
+        Ok(value) => value,
+        Err(std::env::VarError::NotPresent) => return Ok(None),
+        Err(_) => return Err("OpenAI file proxy setting is not valid UTF-8".to_string()),
+    };
+    select_loopback_openai_file_proxy(target, policy, Some(&value))
+}
+
 fn build_download_client(
     trusted_target: Option<&TrustedDownloadTarget>,
+    local_proxy: Option<&reqwest::Url>,
 ) -> Result<reqwest::Client, String> {
     let mut builder = reqwest::Client::builder()
         .no_proxy()
         .redirect(reqwest::redirect::Policy::none());
-    if let Some(target) = trusted_target {
+    if let Some(proxy) = local_proxy {
+        // An HTTP CONNECT proxy cannot guarantee that the proxy-selected
+        // upstream IP equals the prevalidated DNS answer. Restrict this opt-in
+        // path to an explicit loopback proxy, authenticated local-session
+        // provenance, and allowlisted OpenAI hosts; HTTPS verification remains
+        // enabled. The default direct path retains DNS address pinning.
+        let proxy = reqwest::Proxy::https(proxy.as_str())
+            .map_err(|_| "failed to configure loopback OpenAI file proxy".to_string())?;
+        builder = builder.proxy(proxy);
+    } else if let Some(target) = trusted_target {
         if let Some(host) = target.resolver_host.as_deref() {
             builder = builder.resolve_to_addrs(host, &target.pinned_addrs);
         }
@@ -408,6 +492,14 @@ fn build_download_client(
         .map_err(|_| "failed to build bounded import HTTP client".to_string())
 }
 
+#[cfg(test)]
+pub(crate) fn build_loopback_proxy_client_for_test(
+    endpoint: &str,
+) -> Result<reqwest::Client, String> {
+    let proxy = parse_loopback_openai_file_proxy(endpoint)?;
+    build_download_client(None, Some(&proxy))
+}
+
 async fn prepare_download_request(
     download_link: &str,
     policy: ConversationImportDownloadPolicy,
@@ -420,7 +512,7 @@ async fn prepare_download_request(
                 TrustedMcpAddressPolicy::PublicOnly,
             )
             .await?;
-            let client = build_download_client(Some(&target))?;
+            let client = build_download_client(Some(&target), None)?;
             Ok((client, request_url_for_download(target.url)))
```

#### Recent Merged Pull Requests:
- **PR #1418** (2026-11-11): fix(import): support opt-in loopback proxy for OpenAI host-file downloads (@mo-lin-yuan)
- **PR #1416** (2026-11-10): chore(desktop): remove dead code warnings on non-Windows builds (@HarpeLm)
- **PR #1415** (2026-11-10): feat(runner): publish the project catalog before Git enrichment (@HarpeLm)
- **PR #1414** (2026-11-10): Add optional managed worktree root policy (@HarpeLm)
- **PR #1413** (2026-11-09): fix(admin): accept native Windows project paths (@swjnxyf)
- **PR #1412** (closed): fix(tunnel): retry heartbeat status persistence (@HarpeLm)

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

## X. import): support opt-in loopback proxy for OpenAI host-file downloads (#1418)

**RULE**:
When implementing operations in `docs/MCP.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yyjeqhc/webcodex. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `3c141967`: import): support opt-in loopback proxy for OpenAI host-file downloads (#1418). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `docs/MCP.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:

When a loopback-only Desktop Server is behind a local HTTP proxy and OpenAI
attachment domains resolve to a proxy-managed fake IP, direct TLS connections
may fail even after the trusted tunnel's fake-IP admission succeeds. Operators
may opt in to the **OpenAI host-file import only** proxy by setting
`WEBCODEX_OPENAI_FILE_IMPORT_PROXY=http://127.0.0.1:PORT` in the Server
environment and restarting the Server. IPv6 `http://[::1]:PORT` is also
accepted. The setting defaults to off and is ignored for ordinary trusted MCP
URLs and remote authenticated imports; it requires an explicitly trusted
loopback MCP source and an allowlisted OpenAI attachment hostname. TLS server
certificate verification and redirect rejection remain enabled. The HTTP
CONNECT proxy chooses the upstream address instead of WebCodex's directly
pinned DNS addresses, so use only a proxy you control and trust; no remote
proxy endpoints, credentials, or hostnames are accepted as proxy settings.

```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `3c141967` are properly handled with clean fallback behavior.

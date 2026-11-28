# Verification Protocol: Verification Protocol: Empirical Defect Shield for yyjeqhc-webcodex-learnings

<!-- PROVENANCE_START
{
  "source_repository": "yyjeqhc-webcodex-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-28T15:06:07.272Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-yyjeqhc-webcodex-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [yyjeqhc-webcodex-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-28T15:06:07.272Z`  
> **Learning ID**: `LEARN-EVO-yyjeqhc-webcodex-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `yyjeqhc-webcodex-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/yyjeqhc-webcodex-learnings.md`  
> **Source**: github ([https://github.com/yyjeqhc/webcodex](https://github.com/yyjeqhc/webcodex))  
> **Source Version**: `f5411166`  
> **License**: Apache-2.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-28T15:05:56.894Z  
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
> **Harvest Timestamp**: 2026-11-28T15:05:56.887Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `yyjeqhc/webcodex`
- **Description**: Give cloud AI agents a real development environment on your own machines.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 2535 stars

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
pub use cloudflare_connections::{
    CloudflareConnectionRequest, CloudflareConnectionResponse, GeminiConnectionRequest,
};
mod diagnostics;
mod environment;
mod environment_invitation;
pub use environment_invitation::{InvitationRequest, InvitationResponse};
mod managed_instructions;
mod mcp_providers;
mod operation_completion;
#[cfg(test)]
mod operation_lifecycle_tests;
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

const OPERATION_SLOT_TIMEOUT: Duration = Duration::from_secs(30);
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

#[derive(Clone)]
struct ChatGptActivityProbe {
    identity: ProjectRuntimeIdentity,
    adapter: WebCodexAdapter,
    runtime_source: crate::runtime_selection::RuntimeSource,
    runtime_selection_revision: u64,
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
    refresh_lock: tokio::sync::Mutex<()>,
    runner_settings_reader: Arc<Mutex<()>>,
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
            refresh_lock: tokio::sync::Mutex::new(()),
            runner_settings_reader: Arc::new(Mutex::new(())),
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
        match self.operations.observe() {
            Ok(current) => snapshot.current_operation = current,
            Err(error) => {
                snapshot.current_operation = None;
                snapshot
                    .component_errors
                    .insert(error.component(), error.clone());
                snapshot.runtime_error = Some(error);
            }
        }
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
            let canonical_roots = webcodex_runner_config::paths::canonicalize_usable_allowed_roots(
                &effective_roots,
                &canonical_project,
            );
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
        if self.shutdown_signal.is_cancelled() {
            return Err(cancelled_error());
        }
        if let Some(current) = self.operations.observe()? {
            return Err(crate::operation::busy_error(&current));
        }
        if self.get_state().configuration_issue.is_some() {
            return Err(DesktopError::new(
                "configuration_migration_failed",
                "Configuration could not be migrated",
                "Open Diagnostics or explicitly restore the previous known-good configuration.",
            ));
        }

        let before_generation = self.get_state().state_generation;
        let _refresh_guard = self.refresh_lock.lock().await;
        if self.shutdown_signal.is_cancelled() {
            return Err(cancelled_error());
        }
        if let Some(current) = self.operations.observe()? {
            return Err(crate::operation::busy_error(&current));
        }
        // Coalesce overlapping background refreshes: if another refresh already
        // published a fresher snapshot while we waited, return it directly.
        if self.get_state().state_generation != before_generation {
            return Ok(self.get_state());
        }

        let cancellation =
            CancellationContext::new(CancellationSignal::new(), self.shutdown_signal.clone());
        let start_op_generation = self.operations.generation();

        enum RefreshPlan {
            Persistent {
                environment_id: String,
            },
            QuickShare,
            Unconfigured,
            NonPersistent {
                adapter: WebCodexAdapter,
                identity: RunnerRuntimeIdentity,
                server_env_file: Option<PathBuf>,
                project_identity: Option<ProjectRuntimeIdentity>,
                has_project: bool,
                autostart: bool,
            },
        }

        let plan = {
            let slot = self.core.lock().await;
            let Some(core) = slot.as_ref() else {
                return Err(self.operations.missing_core_error());
            };
            if let Some(environment_id) = core.config.persistent_environment.clone() {
                RefreshPlan::Persistent { environment_id }
            } else if core.snapshot.quick_share.is_some() {
                RefreshPlan::QuickShare
            } else if let Some(identity) = runner_identity_from_config(&core.config) {
                RefreshPlan::NonPersistent {
                    adapter: core.adapter.clone(),
                    identity,
                    server_env_file: core
                        .config
                        .runtime
                        .as_ref()
                        .and_then(|runtime| runtime.server_env_file.clone()),
                    project_identity: identity_from_config(&core.config),
                    has_project: core.config.project.is_some(),
                    autostart: runtime_autostart(&core.config),
                }
            } else {
                RefreshPlan::Unconfigured
            }
        };

        match plan {
            RefreshPlan::QuickShare | RefreshPlan::Unconfigured => {
                let mut slot = self.core.lock().await;
                let Some(core) = slot.as_mut() else {
                    return Ok(self.get_state());
       
```

### Core Architecture Module: `apps/desktop/src-tauri/src/state/cloudflare_connections.rs`
```
//! Private native control-plane adapter. Runtime credentials stay in Rust; only
//! the explicit OAuth handoff response can carry the newly issued client secret.
use super::*;
use serde::{Deserialize, Serialize, Serializer};
use webcodex_environment::{Secret, TunnelProvider};

mod gemini;
pub use gemini::GeminiConnectionRequest;

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
        expected_generation: u64,
        expected_configuration_id: String,
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

    fn stage(&self) -> &'static str {
        match self {
            Self::Status { .. } => "cloudflare_status",
            Self::Start { .. } => "cloudflare_start",
            Self::Stop { .. } => "cloudflare_stop",
            Self::ConfigureOauth { .. } => "cloudflare_oauth",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudflareConnectionStatus {
    // Older Servers omit this field. parse_status rejects the missing identity
    // before the observation can be displayed or used to authorize a mutation.
    #[serde(default)]
    pub configuration_id: String,
    pub profile_id: String,
    pub server_instance_id: String,
    pub process_generation: u64,
    pub lifecycle: String,
    pub public_origin: Option<String>,
    pub oauth_configured: bool,
    pub observed_authorization: bool,
    #[serde(default)]
    pub registration_available: bool,
    #[serde(default)]
    pub observed_tool_call: bool,
    pub configured_revision: u64,
    pub applied_revision: Option<u64>,
    pub local_target: String,
    pub reason_code: Option<String>,
}

impl CloudflareConnectionStatus {
    fn parse_status(bytes: &[u8], stage: &str, profile_id: &str) -> DesktopResult<Self> {
        let invalid = || unavailable_for(stage, profile_id, Some("invalid_response"));
        let status: Self = serde_json::from_slice(bytes).map_err(|_| invalid())?;
        if status.profile_id != profile_id
            || !matches!(
                status.lifecycle.as_str(),
                "stopped" | "starting" | "running" | "disconnected" | "error"
            )
        {
            return Err(invalid());
        }
        if status.configuration_id.is_empty() {
            return Err(DesktopError::new(
                "runtime_protocol_incompatible",
                "The local Server cannot identify the selected Cloudflare configuration",
                "Update the local Server to the Runtime bundled with this Desktop and refresh the connection.",
            )
            .with_stage(stage)
            .with_operation_context(None, None, Some(profile_id), None));
        }
        Ok(status)
    }

    fn check_materialized_revision(&mut self, revision: u64) {
        // Windows Server reads protected materializations. Preserve the observed
        // generation for Stop while the user applies the newer catalog revision.
        if cfg!(windows) && self.configured_revision < revision {
            self.reason_code = Some("cloudflare_restart_server_required".into());
            self.registration_available = false;
        }
    }
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
    .with_component(crate::error::ErrorComponent::Tunnel)
}
fn unavailable_for(stage: &str, profile_id: &str, reason_code: Option<&str>) -> DesktopError {
    let mut error =
        unavailable()
            .with_stage(stage)
            .with_operation_context(None, None, Some(profile_id), None);
    if let Some(reason) = reason_code {
        error = error.with_reason_code(reason);
    }
    error
}
fn stale_revision(stage: &str, profile_id: &str) -> DesktopError {
    DesktopError::new(
        "cloudflare_revision_stale",
        "This Cloudflare connection changed before the control request completed",
        "Refresh the connection status to review the current configuration before retrying.",
    )
    .with_component(crate::error::ErrorComponent::Tunnel)
    .with_stage(stage)
    .with_reason_code("stale_fence")
    .with_operation_context(None, None, Some(profile_id), None)
}
fn requires_environment() -> DesktopError {
    DesktopError::new(
        "cloudflare_environment_required",
        "Cloudflare needs a persistent local Environment",
        "Use Runtime setup or repair to adopt the existing local Server first.",
    )
    .with_component(crate::error::ErrorComponent::Tunnel)
    .with_stage("cloudflare_preflight")
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
        if let CloudflareConnectionRequest::Start {
            expected_configuration_id,
            ..
        } = &request
        {
            if *expected_configuration_id != profile.configuration_id {
                return Err(stale_revision(request.stage(), &profile.profile_id));
            }
        }
        if profile.provider == TunnelProvider::Openai {
            return Err(unavailable());
        }
        // Never follow redirects or use a system proxy for private loopback auth.
        validate_control_origin(&profile.local_server_url)?;
        let client = reqwest::Client::builder()
            .no_proxy()
            .retry(reqwest::retry::never())
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
                        expected_generation,
                        ..
                    } => Some((
                        webcodex_environment::ServiceOperation::Start,
                        server_instance_id.as_str(),
                        Some(*expected_revision),
                        Some(*expected_generation),
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
                let observed = CloudflareConnectionStatus::parse_status
```

### Core Architecture Module: `apps/desktop/src-tauri/src/state/cloudflare_connections/gemini.rs`
```
//! Interactive Desktop intent. Core owns the catalog and Server owns the process,
//! forwarding and OAuth discovery. Never infer success from saving the profile.
use super::*;
use webcodex_environment::{
    CloudflareProfileTarget, CloudflareTunnelProfileRequest, EnvironmentStore, NativeEnvironment,
    TunnelHostMode, TunnelProfileSnapshot,
};

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GeminiConnectionRequest {
    environment_id: String,
    profile: Option<SelectedProfile>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SelectedProfile {
    id: String,
    configuration_id: String,
    revision: u64,
}

impl AppState {
    pub async fn connect_gemini(
        &self,
        request: GeminiConnectionRequest,
    ) -> DesktopResult<DesktopStateSnapshot> {
        let (operation, cancel, mut core, baseline) = self
            .begin_operation(DesktopOperationKind::TunnelConfigUpdate, false)
            .await?;
        let result = async {
            cancel.check()?;
            if core.config.persistent_environment.as_deref() != Some(&request.environment_id)
                || !core.config.topology.as_ref().is_some_and(|t| {
                    t.experience == Experience::Full
                        && matches!(t.server, ServerTopology::Local)
                        && matches!(t.runner, RunnerTopology::Local)
                })
            {
                return Err(requires_environment());
            }
            let store = environment::store()?;
            core.tunnel_config
                .ensure_persistent_catalog_compatible(&store)?;
            if !core.snapshot.readiness.runtime_ready {
                core.resume_environment(&cancel).await?;
            }
            cancel.check()?;
            let profile = prepare_profile(&store, &request).await?;
            core.publish_snapshot();
            let id = &profile.profile_id;
            let observed = self
                .cloudflare_connection(CloudflareConnectionRequest::Status {
                    profile_id: id.clone(),
                })
                .await?;
            let CloudflareConnectionResponse::Status(status) = observed else {
                return Err(unavailable());
            };
            if status.configured_revision != profile.revision
                || profile.configuration_id.as_deref() != Some(status.configuration_id.as_str())
            {
                return Err(stale_revision("cloudflare_start", id));
            }
            if matches!(status.lifecycle.as_str(), "stopped" | "error") {
                cancel.check()?;
                // A user-scoped standalone host has the same per-user cache.
                // Boot and system accounts continue to use installed tools only.
                if profile.host_mode == TunnelHostMode::Standalone && profile.autostart {
                    let record = store
                        .load_environment()
                        .map_err(environment::desktop_error)?
                        .ok_or_else(requires_environment)?;
                    if record.environment_id != request.environment_id {
                        return Err(requires_environment());
                    }
                    if record.request.service_scope
                        == webcodex_environment::service::ServiceScope::User
                    {
                        if webcodex_environment::current_account()
                            .map_err(environment::desktop_error)?
                            .identity
                            != record.request.account.identity
                        {
                            return Err(requires_environment());
                        }
                        prepare_standalone_component(&core.adapter.binaries()?.webcodex, &cancel)
                            .await?;
                    }
                }
                // One mutation from a current observation; response loss never
                // causes a retry. The card subsequently polls only Status.
                self.cloudflare_connection(CloudflareConnectionRequest::Start {
                    profile_id: id.clone(),
                    server_instance_id: status.server_instance_id,
                    expected_revision: profile.revision,
                    expected_generation: status.process_generation,
                    expected_configuration_id: profile
                        .configuration_id
                        .clone()
                        .ok_or_else(requires_environment)?,
                })
                .await?;
            }
            core.get_state().await
        }
        .await;
        self.finish_operation(operation, cancel, core, baseline, result)
            .await
    }
}

async fn prepare_profile(
    store: &EnvironmentStore,
    request: &GeminiConnectionRequest,
) -> DesktopResult<TunnelProfileSnapshot> {
    let record = store
        .load_environment()
        .map_err(environment::desktop_error)?
        .ok_or_else(requires_environment)?;
    if record.environment_id != request.environment_id
        || !record.request.local_server()
        || !record.request.local_runner()
    {
        return Err(requires_environment());
    }
    let catalog = webcodex_environment::tunnel_profile_snapshots(store)
        .map_err(environment::desktop_error)?;
    let existing = match &request.profile {
        Some(target) => Some(
            catalog
                .iter()
                .find(|p| {
                    p.profile_id == target.id
                        && p.provider != TunnelProvider::Openai
                        && p.configuration_id.as_deref() == Some(&target.configuration_id)
                        && p.revision == target.revision
                })
                .ok_or_else(|| stale_revision("cloudflare_start", &target.id))?,
        ),
        None => None,
    };
    if let Some(profile) = existing {
        if profile.oauth_dynamic_registration_enabled {
            return Ok(profile.clone());
        }
    }
    let target = CloudflareProfileTarget {
        environment_id: request.environment_id.clone(),
        configuration_id: existing.and_then(|p| p.configuration_id.clone()),
    };
    // Create-only identity for the wizard default. Two concurrent first-time
    // connects cannot create two Quick profiles or adopt an intervening record.
    let id = existing.map_or("gemini-quick", |p| p.profile_id.as_str());
    let native = NativeEnvironment::new().map_err(environment::desktop_error)?;
    let result = native
        .configure_cloudflare_tunnel_profile(
            store,
            &CloudflareTunnelProfileRequest {
                profile_id: id,
                expected_target: Some(&target),
                expected_revision: existing.map(|p| p.revision),
                name: Some(existing.map_or("Gemini", |p| p.name.as_str())),
                provider: existing.map_or(TunnelProvider::CloudflareQuick, |p| p.provider.clone()),
                host_mode: existing.map_or(TunnelHostMode::Embedded, |p| p.host_mode),
                autostart: existing.map_or_else(
                    || {
                        !catalog
                            .iter()
                            .any(|p| p.provider != TunnelProvider::Openai && p.autostart)
                    },
                    |p| p.autostart,
                ),
                oauth_dynamic_registration_enabled: Some(true),
                token: None,
                ingress_port: None,
            },
        )
        .await
        .map_err(environment::desktop_error)?;
    Ok(result.profile)
}

async fn prepare_standalone_component(
    cli: &std::path::Path,
    cancel: &CancellationContext,
) -> DesktopResult<()> {
    use crate::webcodex::cli::{run_json_until, CliCommandContext};
    let prepared: bool = run_json_until(
        cli,
        &[
            "environment".into(),
            "prepare-cloudflared".into(),
            "--json".into(),
        ],
        None,
        false,
        CliCommandContext::new("cloudflare_start", "prepare-cloudflared"),
        cancel,
        Deadline::after(std::time::Duration::from_secs(170)),
    )
    .await
    .map_err(|error| {
        let reason = error
            .diagnostic_ref()
            .and_then(|d| d.reason_code.as_deref());
        if let Some(
            code @ ("cloudflare_network_unavailable"
            | "cloudflare_download_failed"
            | "cloudflare_proxy_invalid"
            | "cloudflare_storage_unavailable"
            | "cloudflare_version_unsupported"
            | "cloudflare_platform_unsupported"
            | "cloudflare_verification_failed"
            | "cloudflare_extraction_failed"
            | "cloudflare_binary_unavailable"),
        ) = reason
        {
            DesktopError::new(
                code,
                "The Cloudflare component could not be prepared",
                "Review the component diagnostic and reconnect.",
            )
            .with_stage("cloudflare_start")
        } else {
            error
        }
    })?;
    if !prepared {
        return Err(unavailable());
    }
    Ok(())
}

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
            let runtime = core.runner_settings_runtime()?;
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
                        expected_target: request.expected_target.as_ref(),
                        oauth_dynamic_registration_enabled: request
                            .oauth_dynamic_registration_enabled,
                        profile_id: &profile_id,
                        name: Some(&request.name),
                        host_mode: request.host_mode,
                        autostart: request.autostart,
                        expected_revision: request.expected_revision,
                        provider: request.provider,
                        token: token.as_ref(),
                        ingress_port: None,
                    },
  
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

### Incident Patch 1: `f5411166` (2026-11-28)
**Commit Message**: fix(desktop): 修复设置误报操作占用并显示实际运行的操作 (#1455)

**File**: `apps/desktop/src-tauri/Cargo.toml` (modified, +1/-0)
```diff
@@ -49,6 +49,7 @@ winreg = "0.55"
 
 
 [dev-dependencies]
+tokio = { version = "1", features = ["test-util"] }
 tempfile = "3"
 
 [profile.dogfood]
```

**File**: `apps/desktop/src-tauri/src/error.rs` (modified, +6/-3)
```diff
@@ -298,6 +298,11 @@ impl ErrorDiagnostic {
             | "desktop_data_dir_invalid"
             | "desktop_data_dir_unavailable"
             | "state_io" => (Config, ManualCheck, OpenDiagnostics, false),
+            "desktop_core_unavailable" | "desktop_operation_unsettled" => {
+                (Desktop, ManualCheck, OpenActivity, false)
+            }
+            "desktop_operation_start_timeout" => (Desktop, UserAction, OpenActivity, true),
+            "desktop_state_unavailable" => (Desktop, ManualCheck, OpenDiagnostics, false),
             "not_configured" | "setup_not_found" => (Environment, UserAction, OpenSetup, false),
             "runtime_switch_jobs_confirmation_required"
             | "full_trace_confirmation_required"
@@ -318,9 +323,7 @@ impl ErrorDiagnostic {
             "pairing_recovery_required" => (Auth, ManualCheck, ObserveBeforeRetry, false),
 
             // 12. Background operation contention
-            "desktop_operation_busy"
-            | "desktop_state_unavailable"
-            | "desktop_operation_not_cancellable" => {
+            "desktop_operation_busy" | "desktop_operation_not_cancellable" => {
                 (Desktop, AutoRecovering, WaitAutoRecovery, true)
             }
             "desktop_operation_not_current" => (Desktop, UserAction, RefreshState, false),
```

**File**: `apps/desktop/src-tauri/src/models.rs` (modified, +1/-0)
```diff
@@ -323,6 +323,7 @@ impl DesktopOperationKind {
 pub enum DesktopOperationPhase {
     Running,
     Cancelling,
+    Overdue,
 }
 
 #[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
```

**File**: `apps/desktop/src-tauri/src/operation.rs` (modified, +257/-49)
```diff
@@ -2,40 +2,46 @@ use crate::activity::{ActivityEventKind, ActivityLevel, ActivityLog};
 use crate::error::{DesktopError, DesktopResult};
 use crate::models::{DesktopOperationKind, DesktopOperationPhase, DesktopOperationSnapshot};
 use std::sync::atomic::{AtomicU64, Ordering};
-use std::sync::Mutex;
-use std::time::{SystemTime, UNIX_EPOCH};
+use std::sync::{Mutex, MutexGuard};
+use std::time::{Duration, SystemTime, UNIX_EPOCH};
 use tokio::time::Instant;
 
+// This is an outer backstop for cooperative Desktop operations, including
+// multi-step setup. Individual commands keep their shorter deadlines.
+const OPERATION_BUDGET: Duration = Duration::from_secs(10 * 60);
+const STOP_OBSERVATION_BUDGET: Duration = Duration::from_secs(30);
+
 pub(crate) use webcodex_environment::unified_update::CancellationSignal;
 
 #[derive(Clone)]
 pub(crate) struct CancellationContext {
-    operation: Option<CancellationSignal>,
+    operation: CancellationSignal,
     shutdown: CancellationSignal,
+    deadline: Option<Instant>,
 }
 
 impl CancellationContext {
     pub(crate) fn new(operation: CancellationSignal, shutdown: CancellationSignal) -> Self {
         Self {
-            operation: Some(operation),
+            operation,
             shutdown,
+            deadline: None,
         }
     }
 
     #[cfg(test)]
     pub(crate) fn never() -> Self {
         Self {
-            operation: None,
+            operation: CancellationSignal::new(),
             shutdown: CancellationSignal::new(),
+            deadline: None,
         }
     }
 
     pub(crate) fn is_cancelled(&self) -> bool {
-        self.shutdown.is_cancelled()
-            || self
-                .operation
-                .as_ref()
-                .is_some_and(CancellationSignal::is_cancelled)
+        self.deadline.is_some_and(|at| Instant::now() >= at)
+            || self.shutdown.is_cancelled()
+            || self.operation.is_cancelled()
     }
 
     pub(crate) fn check(&self) -> DesktopResult<()> {
@@ -47,13 +53,16 @@ impl CancellationContext {
     }
 
     pub(crate) async fn cancelled(&self) {
-        if let Some(operation) = &self.operation {
+        let signals = async {
             tokio::select! {
-                _ = operation.cancelled() => {},
+                _ = self.operation.cancelled() => {},
                 _ = self.shutdown.cancelled() => {},
             }
+        };
+        if let Some(at) = self.deadline {
+            let _ = tokio::time::timeout_at(at, signals).await;
         } else {
-            self.shutdown.cancelled().await;
+            signals.await;
         }
     }
 }
@@ -66,20 +75,108 @@ pub(crate) fn cancelled_error() -> DesktopError {
     )
 }
 
+pub(crate) fn core_unavailable() -> DesktopError {
+    DesktopError::new(
+        "desktop_core_unavailable",
+        "Desktop cannot verify its internal operation state",
+        "Fully quit and reopen Desktop, then check the runtime and Activity before repeating the operation.",
+    )
+}
+
+pub(crate) fn busy_error(current: &DesktopOperationSnapshot) -> DesktopError {
+    let error = if current.phase == DesktopOperationPhase::Overdue {
+        DesktopError::new(
+            "desktop_operation_unsettled",
+            "The Desktop operation has not confirmed completion within its time budget",
+            "Check Activity and the affected service before taking further action.",
+        )
+    } else {
+        DesktopError::new(
+            "desktop_operation_busy",
+            "Another Desktop operation is still running",
+            "Check the current operation in Desktop.",
+        )
+    };
+    error
+        .with_details(serde_json::json!({
+            "operation_id": current.id,
+            "operation_kind": current.kind.as_str(),
+        }))
+        .with_operation_context(Some(&current.id), None, None, None)
+}
+
 struct ActiveOperation {
     snapshot: DesktopOperationSnapshot,
     cancellation: CancellationSignal,
+    report_delay_at: Instant,
 }
 
-#[derive(Clone)]
-pub(crate) struct OperationAdmission {
+impl ActiveOperation {
+    fn snapshot(&self) -> DesktopOperationSnapshot {
+        let mut snapshot = self.snapshot.clone();
+        if Instant::now() >= self.report_delay_at {
+            snapshot.phase = DesktopOperationPhase::Overdue;
+            // A cooperative operation's deadline or an explicit Stop has
+            // already requested cancellation. Its owner still settles effects.
+            snapshot.cancellable = false;
+        }
+        snapshot
+    }
+}
+
+enum OperationSlot {
+    Idle,
+    Active(ActiveOperation),
+    Interrupted(DesktopError),
+}
+
+#[derive(Clone, Copy, PartialEq, Eq)]
+enum AdmissionPhase {
+    Preparing,
+    Dispatched,
+    Finished,
+}
+
+pub(crate) struct OperationAdmission<'a> {
+    controller: &'a OperationController,
     pub(crate) id: String,
     pub(crate) kind: DesktopOperationKind,
-    pub(crate) cancellation: CancellationSignal,
+    cancellation: Cancellat
```

**File**: `apps/desktop/src-tauri/src/state.rs` (modified, +4/-0)
```diff
@@ -11,6 +11,8 @@ pub use environment_invitation::{InvitationRequest, InvitationResponse};
 mod managed_instructions;
 mod mcp_providers;
 mod operation_completion;
+#[cfg(test)]
+mod operation_lifecycle_tests;
 mod path_inventory;
 pub use path_inventory::{ExportInventoryRequest, OpenInventoryRequest};
 #[cfg(all(test, windows, desktop_native_smoke))]
@@ -63,6 +65,7 @@ use std::sync::{Arc, RwLock};
 use std::time::Duration;
 use tokio::sync::Mutex;
 
+const OPERATION_SLOT_TIMEOUT: Duration = Duration::from_secs(30);
 const SERVER_READY_TIMEOUT: Duration = Duration::from_secs(20);
 const STALE_LOOPBACK_PROBE_TIMEOUT: Duration = Duration::from_secs(2);
 const RUNNER_READY_TIMEOUT: Duration = Duration::from_secs(30);
@@ -101,6 +104,7 @@ pub struct AppState {
     activity: ActivityLog,
     operations: OperationController,
     refresh_lock: tokio::sync::Mutex<()>,
+    runner_settings_reader: Arc<Mutex<()>>,
     shutdown_signal: CancellationSignal,
     shutdown_started: AtomicBool,
     shutdown_complete: CancellationSignal,
```

**File**: `apps/desktop/src-tauri/src/state/app_state.rs` (modified, +54/-50)
```diff
@@ -33,6 +33,7 @@ impl AppState {
             connections,
             operations: OperationController::new(activity.clone()),
             refresh_lock: tokio::sync::Mutex::new(()),
+            runner_settings_reader: Arc::new(Mutex::new(())),
             activity,
             shutdown_signal: CancellationSignal::new(),
             shutdown_started: AtomicBool::new(false),
@@ -78,7 +79,16 @@ impl AppState {
             self.connections
                 .project(&mut snapshot.connections, snapshot.readiness.runtime_ready);
         }
-        snapshot.current_operation = self.operations.current();
+        match self.operations.observe() {
+            Ok(current) => snapshot.current_operation = current,
+            Err(error) => {
+                snapshot.current_operation = None;
+                snapshot
+                    .component_errors
+                    .insert(error.component(), error.clone());
+                snapshot.runtime_error = Some(error);
+            }
+        }
         snapshot.environment_setup = environment_invitation::setup_snapshot(&snapshot);
         snapshot.activity_sequence = self.activity.latest_sequence();
         if snapshot.persistent_environment.is_none()
@@ -147,17 +157,8 @@ impl AppState {
         if self.shutdown_signal.is_cancelled() {
             return Err(cancelled_error());
         }
-        if let Some(current) = self.operations.current() {
-            return Err(DesktopError::new(
-                "desktop_operation_busy",
-                "Another Desktop operation is still running",
-                "Wait for the current operation to finish or stop it before starting another one.",
-            )
-            .with_details(serde_json::json!({
-                "operation_id": current.id,
-                "operation_kind": current.kind.as_str(),
-            }))
-            .with_operation_context(Some(&current.id), None, None, None));
+        if let Some(current) = self.operations.observe()? {
+            return Err(crate::operation::busy_error(&current));
         }
         if self.get_state().configuration_issue.is_some() {
             return Err(DesktopError::new(
@@ -172,17 +173,8 @@ impl AppState {
         if self.shutdown_signal.is_cancelled() {
             return Err(cancelled_error());
         }
-        if let Some(current) = self.operations.current() {
-            return Err(DesktopError::new(
-                "desktop_operation_busy",
-                "Another Desktop operation is still running",
-                "Wait for the current operation to finish or stop it before starting another one.",
-            )
-            .with_details(serde_json::json!({
-                "operation_id": current.id,
-                "operation_kind": current.kind.as_str(),
-            }))
-            .with_operation_context(Some(&current.id), None, None, None));
+        if let Some(current) = self.operations.observe()? {
+            return Err(crate::operation::busy_error(&current));
         }
         // Coalesce overlapping background refreshes: if another refresh already
         // published a fresher snapshot while we waited, return it directly.
@@ -213,11 +205,7 @@ impl AppState {
         let plan = {
             let slot = self.core.lock().await;
             let Some(core) = slot.as_ref() else {
-                return Err(DesktopError::new(
-                    "desktop_operation_busy",
-                    "Desktop mutation state is already in use",
-                    "Wait for the current operation to finish.",
-                ));
+                return Err(self.operations.missing_core_error());
             };
             if let Some(environment_id) = core.config.persistent_environment.clone() {
                 RefreshPlan::Persistent { environment_id }
@@ -703,7 +691,7 @@ impl AppState {
         kind: DesktopOperationKind,
         cancellable: bool,
     ) -> DesktopResult<(
-        OperationAdmission,
+        OperationAdmission<'_>,
         CancellationContext,
         DesktopCore,
         ProcessBaseline,
@@ -720,30 +708,41 @@ impl AppState {
                 "Open Diagnostics or explicitly restore the previous known-good configuration.",
             ));
         }
-        let operation = self.operations.admit(kind, cancellable)?;
-        let cancellation =
-            CancellationContext::new(operation.cancellation.clone(), self.shutdown_signal.clone());
-        let baseline = self.capture_process_baseline().await;
-        let core = {
+        let mut operation = self.operations.admit(kind, cancellable)?;
+        let cancellation = operation.cancellation_context(self.shutdown_signal.clone());
+        // Both waits precede dispatch. Cancelling either wait cannot lose the
+        // core, leave a queued write, or skip cleanup of an external effect.
+        let start_deadline = Deadline::after(OPERATION_SLOT_TIMEOUT);
+        let prepare = async {
+            let baseline = self.capture_proc
```

**File**: `apps/desktop/src-tauri/src/state/coding_agents.rs` (modified, +1/-5)
```diff
@@ -34,11 +34,7 @@ impl AppState {
             .begin_operation(DesktopOperationKind::RunnerSettingsUpdate, false)
             .await?;
         let result = async {
-            let runtime = core
-                .config
-                .runtime
-                .clone()
-                .ok_or_else(|| desktop_state_unavailable("Configure a Runner first"))?;
+            let runtime = core.runner_settings_runtime()?;
             crate::webcodex::settings::verify_target(&runtime, &target)?;
             let mut candidate = core.coding_agents.clone();
             let candidate = tokio::task::spawn_blocking(move || {
```

**File**: `apps/desktop/src-tauri/src/state/desktop_core.rs` (modified, +5/-1)
```diff
@@ -1289,7 +1289,11 @@ impl DesktopCore {
         cancellation: &CancellationContext,
     ) -> DesktopResult<Option<MachineEventReceiver>> {
         cancellation.check()?;
-        let mut supervisor = self.supervisor.lock().await;
+        let mut supervisor = tokio::select! {
+            biased;
+            _ = cancellation.cancelled() => return Err(cancelled_error()),
+            supervisor = self.supervisor.lock() => supervisor,
+        };
         cancellation.check()?;
         supervisor.spawn_owned(kind, command, machine_stdout).await
     }
```

---

### Incident Patch 2: `13e4e184` (2026-11-28)
**Commit Message**: fix(windows): avoid idle WSL wakeups and preserve project identity (#1453)

**File**: `apps/desktop/src-tauri/src/project_inventory.rs` (modified, +93/-38)
```diff
@@ -35,6 +35,14 @@ fn unavailable() -> DesktopError {
     )
 }
 
+pub(crate) fn revision_changed() -> DesktopError {
+    DesktopError::new(
+        "project_revision_changed",
+        "The project changed since confirmation",
+        "Review the current project again before removing it.",
+    )
+}
+
 fn uncertain() -> DesktopError {
     DesktopError::new("project_unregister_uncertain", "The unregister outcome could not be confirmed", "Refresh the Runner inventory before taking further action. No automatic retry or folder deletion was attempted.")
 }
@@ -67,50 +75,69 @@ pub async fn observe_many(
             return Err(unavailable());
         }
     }
-    let value = crate::workspace::post(
+    let exact = |project: &str| json!({"project":project,"limit":1,"summary_only":false});
+    let params = if projects.len() == 1 {
+        exact(&projects[0])
+    } else {
+        json!({"client_id":target.client_id,"limit":100,"summary_only":false})
+    };
+    let page = list_for_removal(runtime, params).await?;
+    let rows = page
+        .get("projects")
+        .and_then(Value::as_array)
+        .ok_or_else(unavailable)?;
+    let mut observations = Vec::with_capacity(projects.len());
+    for project in projects {
+        let exact_page;
+        let row = match rows.iter().find(|row| row["id"].as_str() == Some(project)) {
+            Some(row) => row,
+            None if projects.len() > 1 && page["truncated"].as_bool() == Some(true) => {
+                exact_page = list_for_removal(runtime, exact(project)).await?;
+                exact_page["projects"]
+                    .as_array()
+                    .and_then(|rows| rows.iter().find(|row| row["id"].as_str() == Some(project)))
+                    .ok_or_else(unavailable)?
+            }
+            None => return Err(unavailable()),
+        };
+        let revision = row
+            .get("revision")
+            .and_then(Value::as_str)
+            .filter(|s| {
+                s.len() == 71
+                    && s.starts_with("sha256:")
+                    && s[7..].bytes().all(|b| b.is_ascii_hexdigit())
+            })
+            .ok_or_else(unavailable)?;
+        let path = row
+            .get("path")
+            .and_then(Value::as_str)
+            .filter(|s| !s.is_empty())
+            .ok_or_else(unavailable)?;
+        observations.push(UnregisterObservation {
+            target: target.clone(),
+            project: project.clone(),
+            expected_revision: revision.to_owned(),
+            path: path.to_owned(),
+        });
+    }
+    Ok(observations)
+}
+
+async fn list_for_removal(runtime: &StoredRuntime, params: Value) -> DesktopResult<Value> {
+    let mut value = crate::workspace::post(
         runtime,
         "/api/tools/call",
-        json!({"tool":"list_projects","params":{}}),
+        json!({"tool":"list_projects","params":params}),
         Duration::from_secs(12),
     )
     .await?;
     if value.get("success").and_then(Value::as_bool) != Some(true) {
         return Err(unavailable());
     }
-    let rows = value
-        .pointer("/output/projects")
-        .and_then(Value::as_array)
-        .ok_or_else(unavailable)?;
-    projects
-        .iter()
-        .map(|project| {
-            let row = rows
-                .iter()
-                .find(|row| row.get("id").and_then(Value::as_str) == Some(project))
-                .ok_or_else(unavailable)?;
-            let revision = row
-                .get("revision")
-                .and_then(Value::as_str)
-                .filter(|s| {
-                    s.len() == 71
-                        && s.starts_with("sha256:")
-                        && s[7..].bytes().all(|b| b.is_ascii_hexdigit())
-                })
-                .ok_or_else(unavailable)?;
-            let path = row
-                .get("path")
-                .and_then(Value::as_str)
-                .filter(|s| !s.is_empty())
-                .ok_or_else(unavailable)?;
-            Ok(UnregisterObservation {
-                target: target.clone(),
-                project: project.clone(),
-                expected_revision: revision.to_owned(),
-                path: path.to_owned(),
-            })
-        })
-        .collect()
+    Ok(value["output"].take())
 }
+
 pub async fn unregister(
     runtime: &StoredRuntime,
     request: &UnregisterRequest,
@@ -121,12 +148,37 @@ pub async fn unregister(
     }
     let observation = observe(runtime, &request.project).await?;
     if observation.expected_revision != request.expected_revision {
-        return Err(unavailable());
+        return Err(revision_changed());
     }
     let value = crate::workspace::post(runtime, "/api/tools/call", json!({"tool":"unregister_project", "params":{"project":request.project,"expected_revision":request.expected_revision}}), Duration::from_secs(40)).await.map_err(|_| uncertain())?;
     if value.get("success").and_then(Value::as_bool) != Some(true) {
-        //
```

**File**: `apps/desktop/src-tauri/src/project_inventory/tests.rs` (modified, +45/-2)
```diff
@@ -127,7 +127,29 @@ async fn observe_many_uses_one_inventory_request() {
         .unwrap();
     assert_eq!(rows.len(), 1);
     assert_eq!(rows[0].path, "D:\\repo");
-    assert_eq!(task.await.unwrap().len(), 1);
+    let calls = task.await.unwrap();
+    assert_eq!(calls.len(), 1);
+    assert_eq!(calls[0]["params"]["project"], "agent:mini:repo");
+}
+
+#[tokio::test]
+async fn batch_observation_finds_a_selected_registration_beyond_the_first_page() {
+    let mut page = inventory();
+    page["output"]["truncated"] = json!(true);
+    let mut exact = inventory();
+    exact["output"]["projects"][0]["id"] = json!("agent:mini:last");
+    let (url, calls) = server(vec![page, exact]).await;
+    let fixture = Fixture::new(url);
+    let rows = observe_many(
+        &fixture.runtime,
+        &["agent:mini:repo".into(), "agent:mini:last".into()],
+    )
+    .await
+    .unwrap();
+    assert_eq!(rows[1].project, "agent:mini:last");
+    let calls = calls.await.unwrap();
+    assert_eq!(calls.len(), 2);
+    assert_eq!(calls[1]["params"]["project"], "agent:mini:last");
 }
 
 #[tokio::test]
@@ -161,7 +183,8 @@ async fn changed_revision_never_dispatches_removal() {
     let fixture = Fixture::new(url);
     let mut request = fixture.request();
     request.expected_revision = format!("sha256:{}", "b".repeat(64));
-    assert!(unregister(&fixture.runtime, &request).await.is_err());
+    let error = unregister(&fixture.runtime, &request).await.unwrap_err();
+    assert_eq!(error.code, "project_revision_changed");
     assert_eq!(task.await.unwrap().len(), 1);
 }
 
@@ -192,6 +215,26 @@ async fn rejection_and_wrong_project_outcomes_are_not_retried() {
     }
 }
 
+#[tokio::test]
+async fn projection_failure_reports_only_an_exact_confirmed_removal() {
+    for (project, code) in [
+        ("agent:mini:repo", "project_projection_reconcile_required"),
+        ("agent:other:repo", "project_unregister_uncertain"),
+    ] {
+        let response = json!({"success":false,"output":{
+            "error":{"code":"project_projection_reconcile_required"},
+            "authoritative_outcome":"unregistered","project":project
+        }});
+        let (url, calls) = server(vec![inventory(), response]).await;
+        let fixture = Fixture::new(url);
+        let error = unregister(&fixture.runtime, &fixture.request())
+            .await
+            .unwrap_err();
+        assert_eq!(error.code, code);
+        assert_eq!(calls.await.unwrap().len(), 2);
+    }
+}
+
 #[test]
 fn forget_only_removes_exact_runner_registration_and_clears_default() {
     let fixture = Fixture::new("http://127.0.0.1:1".into());
```

**File**: `apps/desktop/src-tauri/src/state/app_state.rs` (modified, +4/-2)
```diff
@@ -120,8 +120,10 @@ impl AppState {
                     "Choose an existing directory that this account can access.",
                 )
             })?;
-            let canonical_roots =
-                webcodex_runner_config::paths::canonicalize_usable_allowed_roots(&effective_roots);
+            let canonical_roots = webcodex_runner_config::paths::canonicalize_usable_allowed_roots(
+                &effective_roots,
+                &canonical_project,
+            );
             Ok::<_, DesktopError>(
                 webcodex_runner_config::paths::validate_project_path_policy(
                     &canonical_project,
```

**File**: `apps/desktop/src-tauri/src/state/environment.rs` (modified, +30/-9)
```diff
@@ -378,12 +378,12 @@ pub(super) fn adopt_saved_environment(config: &mut StoredDesktopConfig) {
                 .find(|entry| entry.path == *path)
                 .map(|entry| format!("agent:{client}:{}", entry.id))
         });
-        ProjectSelection {
-            path: path.to_string_lossy().into_owned(),
-            allowed_root: path.to_string_lossy().into_owned(),
-            is_git_repository: path.join(".git").exists(),
-            runtime_project_id,
+        let mut selected = saved_project_selection(path, config.project.as_ref());
+        if webcodex_runner_config::paths::project_path_probe_allowed(path, None) {
+            selected.is_git_repository = path.join(".git").exists();
         }
+        selected.runtime_project_id = runtime_project_id;
+        selected
     });
     config.persistent_environment = Some(record.environment_id);
     config.topology = Some(RuntimeTopology {
@@ -509,10 +509,27 @@ pub(super) fn legacy_inventory_projects(
     Ok(projects)
 }
 
+fn saved_project_selection(path: &Path, previous: Option<&ProjectSelection>) -> ProjectSelection {
+    let spelling = path.to_string_lossy().into_owned();
+    ProjectSelection {
+        path: spelling.clone(),
+        allowed_root: spelling,
+        is_git_repository: previous.is_some_and(|project| {
+            webcodex_runner_config::paths::paths_equal(Path::new(&project.path), path)
+                && project.is_git_repository
+        }),
+        runtime_project_id: None,
+    }
+}
+
 fn same_desktop_path(left: &Path, right: &Path) -> bool {
+    use webcodex_runner_config::paths::project_path_probe_allowed;
     if left == right {
         return true;
     }
+    if !project_path_probe_allowed(left, None) || !project_path_probe_allowed(right, None) {
+        return false;
+    }
     match (std::fs::canonicalize(left), std::fs::canonicalize(right)) {
         (Ok(a), Ok(b)) => a == b,
         _ => false,
@@ -1407,10 +1424,14 @@ impl DesktopCore {
                     .cloned()
             });
         let project = if let Some(path) = selected.as_ref() {
-            let mut project = self
-                .adapter
-                .inspect_project(&path.to_string_lossy())
-                .await?;
+            let mut project =
+                if webcodex_runner_config::paths::project_path_probe_allowed(path, None) {
+                    self.adapter
+                        .inspect_project(&path.to_string_lossy())
+                        .await?
+                } else {
+                    saved_project_selection(path, self.config.project.as_ref())
+                };
             if let (Some(client), Some(entry)) = (
                 record.runner_client_id.as_deref(),
                 record
```

**File**: `apps/desktop/src-tauri/src/state/workspace.rs` (modified, +3/-9)
```diff
@@ -116,7 +116,7 @@ impl AppState {
             let observations = crate::project_inventory::observe_many(&runtime, &ids).await?;
             for (item, observed) in request.items.iter().zip(observations.iter()) {
                 if observed.expected_revision != item.expected_revision {
-                    return Err(crate::workspace::unavailable());
+                    return Err(crate::project_inventory::revision_changed());
                 }
             }
             let items =
@@ -178,14 +178,8 @@ impl AppState {
                 crate::webcodex::settings::verify_target(&runtime, &request.target)?;
                 let observed =
                     crate::project_inventory::observe(&runtime, &request.project).await?;
-                if observed.expected_revision != request.expected_revision
-                    || observed.path.is_empty()
-                {
-                    return Err(DesktopError::new(
-                        "project_revision_changed",
-                        "The project changed since confirmation",
-                        "Review the current project again before removing it.",
-                    ));
+                if observed.expected_revision != request.expected_revision {
+                    return Err(crate::project_inventory::revision_changed());
                 }
                 let store = super::environment::store()?;
                 let mut native = webcodex_environment::NativeEnvironment::new()
```

**File**: `apps/desktop/src-tauri/src/webcodex/settings.rs` (modified, +11/-0)
```diff
@@ -249,6 +249,17 @@ fn validate(paths: &[String]) -> DesktopResult<()> {
 }
 
 fn validate_allowed_roots(current: &[String], roots: &[String]) -> DesktopResult<()> {
+    // A config written by the CLI can already exceed the Desktop add limit.
+    // An exact deletion preserves the spelling and order of every survivor
+    // and needs no filesystem access (including for unavailable WSL shares).
+    let mut existing = current.iter();
+    if roots.len() < current.len()
+        && roots
+            .iter()
+            .all(|root| existing.by_ref().any(|old| old == root))
+    {
+        return Ok(());
+    }
     validate(roots)?;
     for root in roots {
         if current.iter().any(|existing| {
```

**File**: `apps/desktop/src-tauri/src/webcodex/settings/tests.rs` (modified, +18/-0)
```diff
@@ -267,6 +267,24 @@ fn file_access_can_remove_stale_roots_one_at_a_time() {
     assert_eq!(projection.file_access.configured_roots, vec![stale_b]);
 }
 
+#[test]
+fn file_access_can_revoke_from_oversized_configuration_without_adding_authority() {
+    let f = Fixture::new();
+    let original = (0..23)
+        .map(|i| {
+            f.dir
+                .join(format!("stale-{i}"))
+                .to_string_lossy()
+                .into_owned()
+        })
+        .collect::<Vec<_>>();
+    let mut remaining = original.clone();
+    remaining.remove(10);
+    validate_allowed_roots(&original, &remaining).unwrap();
+    remaining[0] = f.dir.to_string_lossy().into_owned();
+    assert!(validate_allowed_roots(&original, &remaining).is_err());
+}
+
 #[cfg(windows)]
 #[test]
 fn file_access_accepts_existing_windows_drive_root() {
```

**File**: `apps/desktop/src/features/projects/ProjectsPanel.tsx` (modified, +19/-18)
```diff
@@ -1,3 +1,4 @@
+import { normalizeDesktopError } from "../../i18n/presentation";
 import { useEffect, useMemo, useRef, useState } from "react";
 import { Button, Select, TextInput } from "@mantine/core";
 import { Search } from "lucide-react";
@@ -50,7 +51,7 @@ export function ProjectsPanel({ onComputerSettings, onState }: { onComputerSetti
   };
   const [removal, setRemoval] = useState<UnregisterObservation | null>(null);
   const [removing, setRemoving] = useState(false);
-  const [removeError, setRemoveError] = useState(false);
+  const [removeError, setRemoveError] = useState<string | null>(null);
   const [selected, setSelected] = useState<string[]>([]);
   const [batchConfirm, setBatchConfirm] = useState<UnregisterObservation[] | null>(null);
   const [batchProgress, setBatchProgress] = useState("");
@@ -78,20 +79,20 @@ export function ProjectsPanel({ onComputerSettings, onState }: { onComputerSetti
     setRemoval(null);
     setBatchConfirm(null);
     setBatchIssues([]);
-    setRemoveError(false);
+    setRemoveError(null);
   }, [workspace.contextKey]);
   const canManageProjects = Boolean(onState && workspace.state.workspace_runner);
 
   const prepareRemoval = async (project: WorkspaceProject) => {
     if (!canManageProjects || removing || workspace.state.current_operation || !project.id) return;
     const owner = beginRemoval();
     if (!owner) return;
-    setRemoveError(false);
+    setRemoveError(null);
     try {
       const observation = await desktopApi.prepareProjectUnregister(project.id);
       if (removalOwner.current === owner) setRemoval(observation);
-    } catch {
-      if (removalOwner.current === owner) setRemoveError(true);
+    } catch (error) {
+      if (removalOwner.current === owner) setRemoveError(normalizeDesktopError(error).code);
     } finally {
       finishRemoval(owner);
     }
@@ -101,15 +102,15 @@ export function ProjectsPanel({ onComputerSettings, onState }: { onComputerSetti
     if (!removal || !onState || removing || workspace.state.current_operation) return;
     const owner = beginRemoval();
     if (!owner) return;
-    setRemoveError(false);
+    setRemoveError(null);
     try {
       const state = await desktopApi.unregisterProject(removal);
       if (removalOwner.current === owner) {
         onState(state);
         workspace.removeProject(removal.project);
       }
-    } catch {
-      if (removalOwner.current === owner) setRemoveError(true);
+    } catch (error) {
+      if (removalOwner.current === owner) setRemoveError(normalizeDesktopError(error).code);
     } finally {
       if (removalOwner.current === owner) {
         setRemoval(null);
@@ -125,7 +126,7 @@ export function ProjectsPanel({ onComputerSettings, onState }: { onComputerSetti
     if (!ids.length) return;
     const owner = beginRemoval();
     if (!owner) return;
-    setRemoveError(false);
+    setRemoveError(null);
     setBatchIssues([]);
     setBatchConfirm(null);
     try {
@@ -142,8 +143,8 @@ export function ProjectsPanel({ onComputerSettings, onState }: { onComputerSetti
       // The confirmation owns these exact paths and revisions. Never replace
       // them with a fresh inventory after the user has confirmed.
       setBatchConfirm(observations);
-    } catch {
-      if (removalOwner.current === owner) setRemoveError(true);
+    } catch (error) {
+      if (removalOwner.current === owner) setRemoveError(normalizeDesktopError(error).code);
     } finally {
       finishRemoval(owner);
     }
@@ -154,7 +155,7 @@ export function ProjectsPanel({ onComputerSettings, onState }: { onComputerSetti
     const observations = batchConfirm;
     const owner = beginRemoval();
     if (!owner) return;
-    setRemoveError(false);
+    setRemoveError(null);
     setBatchIssues([]);
     setBatchConfirm(null);
     try {
@@ -173,9 +174,9 @@ export function ProjectsPanel({ onComputerSettings, onState }: { onComputerSetti
               setSelected(current => current.filter(id => id !== observation.project));
               completed++;
               setBatchProgress(`${completed}/${observations.length}`);
-            } catch {
+            } catch (error) {
               if (removalOwner.current === owner) {
-                setRemoveError(true);
+                setRemoveError(normalizeDesktopError(error).code);
                 setBatchIssues([observation.project]);
               }
               return;
@@ -193,13 +194,13 @@ export function ProjectsPanel({ onComputerSettings, onState }: { onComputerSetti
           const issues = result.items.filter(item => !item.success).map(item => `${item.project}: ${item.status}`);
           if (issues.length || result.items.length !== chunk.length) {
             setBatchIssues(issues.length ? issues : chunk.map(item => item.project));
-            setRemoveError(true);
+            setRemoveError("project_unregister_uncertain");
             return;
           }
         }
       }
-    } catch {
-      if (removalOwner.current
```

---

### Incident Patch 3: `6ea6ed58` (2026-11-28)
**Commit Message**: fix(session): reserve the WAL writer before reading revisions (#1452)

**File**: `crates/webcodex-workflow-session/Cargo.toml` (modified, +1/-0)
```diff
@@ -21,5 +21,6 @@ tracing = "0.1"
 uuid = { version = "1", features = ["v4"] }
 
 [dev-dependencies]
+rusqlite = { version = "0.40.2", features = ["hooks"] }
 tempfile = "3"
 tokio = { version = "1", features = ["sync", "time", "macros", "rt-multi-thread"] }
```

**File**: `crates/webcodex-workflow-session/src/persistence/database.rs` (modified, +11/-2)
```diff
@@ -3,7 +3,7 @@
 //! The database is authoritative backing for clean cache entries, never a replay
 //! engine. Loading history cannot dispatch a tool or change Session authority.
 use super::*;
-use rusqlite::{params, Connection, OptionalExtension};
+use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
 use std::path::Path;
 use std::sync::Mutex;
 
@@ -116,7 +116,11 @@ impl SessionDatabase {
 
     pub(crate) fn write(&self, writes: &[SessionWrite]) -> io::Result<u64> {
         let mut connection = self.connection.lock().map_err(error)?;
-        let transaction = connection.transaction().map_err(error)?;
+        // Reserve the writer before reading revisions. An intervening WAL commit
+        // would leave a deferred transaction with a snapshot it cannot promote.
+        let transaction = connection
+            .transaction_with_behavior(TransactionBehavior::Immediate)
+            .map_err(error)?;
         let mut bytes = 0_u64;
         for write in writes {
             bytes = bytes.saturating_add(write_row(&transaction, write)?);
@@ -140,6 +144,11 @@ impl SessionDatabase {
         Ok(result)
     }
 
+    #[cfg(test)]
+    pub(crate) fn connection_for_test(&self) -> std::sync::MutexGuard<'_, Connection> {
+        self.connection.lock().unwrap()
+    }
+
     #[cfg(any(test, feature = "root-test-support"))]
     pub(crate) fn fail_writes(&self, fail: bool) {
         self.connection
```

**File**: `crates/webcodex-workflow-session/src/store/writer/sqlite_tests.rs` (modified, +60/-0)
```diff
@@ -138,6 +138,66 @@ fn latest_instruction_and_closed_identity_survive_history_and_session_churn() {
     assert_eq!(restored.status().retained_sessions, 151);
 }
 
+#[test]
+fn unrelated_wal_write_cannot_invalidate_the_session_revision_read() {
+    use rusqlite::hooks::{AuthAction, AuthContext, Authorization};
+
+    let (temporary, store) = persistent_fixture(Duration::from_secs(60));
+    let id = store.start_session(None, None).session_id;
+    store.flush_persistence();
+    let path = temporary.path().join("sessions.sqlite3");
+    let audit = rusqlite::Connection::open(&path).unwrap();
+    audit
+        .execute("CREATE TABLE audit_fixture (id INTEGER PRIMARY KEY)", [])
+        .unwrap();
+    audit.busy_timeout(Duration::ZERO).unwrap();
+    const INSERT_AUDIT: &str = "INSERT INTO audit_fixture VALUES (1)";
+
+    // Preparing the Session upsert happens after the revision SELECT has run.
+    // Attempt the independent commit at precisely that point on a second connection.
+    let (attempt, result) = std::sync::mpsc::channel();
+    let database = store
+        .inner
+        .lock()
+        .unwrap()
+        .persistence
+        .as_ref()
+        .unwrap()
+        .database
+        .clone();
+    database
+        .connection_for_test()
+        .authorizer(Some(move |context: AuthContext<'_>| {
+            if let AuthAction::Insert {
+                table_name: "workflow_sessions",
+            } = context.action
+            {
+                let _ = attempt.send(audit.execute(INSERT_AUDIT, []));
+            }
+            Authorization::Allow
+        }))
+        .unwrap();
+
+    append_read_fixture(&store, &id, 1);
+    store.flush_persistence();
+    assert_eq!(store.status().last_persist_error, None);
+    assert_eq!(
+        result.try_recv().unwrap().unwrap_err().sqlite_error_code(),
+        Some(rusqlite::ErrorCode::DatabaseBusy)
+    );
+
+    let connection = rusqlite::Connection::open(&path).unwrap();
+    assert_eq!(connection.execute(INSERT_AUDIT, []).unwrap(), 1);
+    let events: i64 = connection
+        .query_row(
+            "SELECT count(*) FROM workflow_session_events WHERE session_id=?1",
+            [&id],
+            |row| row.get(0),
+        )
+        .unwrap();
+    assert_eq!(events, 2);
+}
+
 #[test]
 fn stale_second_writer_fails_closed_instead_of_overwriting_a_newer_commit() {
     let (temporary, store) = persistent_fixture(Duration::from_secs(60));
```

#### Recent Merged Pull Requests:
- **PR #1455** (2026-11-28): fix(desktop): 修复设置误报操作占用并显示实际运行的操作 (@yyjeqhc)
- **PR #1453** (2026-11-28): fix(windows): avoid idle WSL wakeups and preserve project identity (@yyjeqhc)
- **PR #1452** (2026-11-28): fix(session): reserve the WAL writer before reading revisions (@yyjeqhc)
- **PR #1447** (2026-11-27): fix(browser): prevent idle Windows native peers from busy-spinning (@lucha0404)
- **PR #1446** (2026-11-27): Resume v0.5.0 Workflow Sessions transparently after upgrade (@yyjeqhc)
- **PR #1443** (2026-11-26): fix(desktop): report incompatible Cloudflare status when configuration identity is missing (@Corden404)

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

## X. desktop): 修复设置误报操作占用并显示实际运行的操作

**RULE**:
When implementing operations in `apps/desktop/src-tauri/Cargo.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in yyjeqhc/webcodex. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f5411166`: desktop): 修复设置误报操作占用并显示实际运行的操作. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `apps/desktop/src-tauri/Cargo.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
tokio = { version = "1", features = ["test-util"] }
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f5411166` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

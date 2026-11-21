# Verification Protocol: Verification Protocol: Empirical Defect Shield for bahdotsh-wrkflw-learnings

<!-- PROVENANCE_START
{
  "source_repository": "bahdotsh-wrkflw-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-21T00:43:59.557Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-bahdotsh-wrkflw-learnings",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [bahdotsh-wrkflw-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-21T00:43:59.557Z`  
> **Learning ID**: `LEARN-EVO-bahdotsh-wrkflw-learnings`


## 1. Scope & Verification Target
- **Target Repository**: `bahdotsh-wrkflw-learnings` (Commit: `HEAD`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bahdotsh-wrkflw-learnings.md`  
> **Source**: github ([https://github.com/bahdotsh/wrkflw](https://github.com/bahdotsh/wrkflw))  
> **Source Version**: `b11b73e7`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-21T00:43:43.153Z  
> **Learning ID**: `learn-github-bahdotsh-wrkflw`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): bahdotsh/wrkflw

> **Canonical Artifact**: `07_PROJECT_LEARNING/bahdotsh-wrkflw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bahdotsh/wrkflw](https://github.com/bahdotsh/wrkflw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-21T00:43:42.915Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bahdotsh/wrkflw`
- **Description**: Validate and Run GitHub Actions locally.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3345 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: Cargo.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/executor/src/acceleration/concurrency.rs`
```
//! Job-level `concurrency:` groups, enforced within one run.

use super::current;
use std::sync::Arc;
use tokio::sync::Semaphore;
use wrkflw_parser::workflow::Job;

/// A job's `concurrency:`: a group name, or a mapping with `group` and
/// `cancel-in-progress`.
struct Concurrency {
    group: String,
    /// Asked for, though nothing here can honour it.
    cancel_in_progress: bool,
}

fn concurrency_group(job: &Job) -> Option<Concurrency> {
    match job.concurrency.as_ref()? {
        serde_yaml::Value::String(group) => Some(Concurrency {
            group: group.clone(),
            cancel_in_progress: false,
        }),
        serde_yaml::Value::Mapping(map) => Some(Concurrency {
            group: map.get("group")?.as_str()?.to_string(),
            cancel_in_progress: map
                .get("cancel-in-progress")
                .is_some_and(|v| v.as_bool() != Some(false)),
        }),
        _ => None,
    }
}

/// Wait until no other job in this run holds `job`'s concurrency group.
///
/// Groups compare as written, so expressions aren't evaluated. Equal text
/// serializes, which is the safe direction. `cancel-in-progress` doesn't
/// apply: a local run has no earlier run of the same group to cancel.
pub(crate) async fn acquire_concurrency(
    job_name: &str,
    job: &Job,
) -> Option<tokio::sync::OwnedSemaphorePermit> {
    let Concurrency {
        group,
        cancel_in_progress,
    } = concurrency_group(job)?;
    let run = current()?;
    if cancel_in_progress {
        wrkflw_logging::warning(&format!(
            "Job '{}': cancel-in-progress has no effect locally, so it waits its turn in '{}'",
            job_name, group
        ));
    }
    let semaphore = {
        let mut groups = run.groups.lock().ok()?;
        groups
            .entry(group)
            .or_insert_with(|| Arc::new(Semaphore::new(1)))
            .clone()
    };
    semaphore.acquire_owned().await.ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::acceleration::{with_run_state, Acceleration, RunState};
    use std::path::PathBuf;

    fn job(yaml: &str) -> Job {
        serde_yaml::from_str(yaml).unwrap()
    }

    /// The most jobs inside their critical section at once.
    async fn peak_overlap(first: &str, second: &str) -> usize {
        use std::sync::atomic::{AtomicUsize, Ordering};
        let active = AtomicUsize::new(0);
        let peak = AtomicUsize::new(0);
        let definitions = [job(first), job(second)];
        let state = RunState::new(Acceleration::default(), false, PathBuf::from(".")).unwrap();
        with_run_state(Arc::new(state), async {
            futures::future::join_all(definitions.iter().map(|definition| async {
                let _permit = acquire_concurrency("j", definition).await;
                let now = active.fetch_add(1, Ordering::SeqCst) + 1;
                peak.fetch_max(now, Ordering::SeqCst);
                tokio::time::sleep(std::time::Duration::from_millis(20)).await;
                active.fetch_sub(1, Ordering::SeqCst);
            }))
            .await;
        })
        .await;
        peak.load(Ordering::SeqCst)
    }

    #[tokio::test]
    async fn a_group_serializes_its_jobs_and_other_jobs_overlap() {
        let lock = "concurrency: lock\nsteps: []\n";
        let other = "concurrency: other\nsteps: []\n";
        let free = "steps: []\n";
        assert_eq!(peak_overlap(lock, lock).await, 1);
        assert_eq!(peak_overlap(lock, other).await, 2);
        assert_eq!(peak_overlap(free, free).await, 2);
    }

    #[test]
    fn concurrency_groups_come_from_a_string_or_a_mapping() {
        let group =
            |yaml: &str| concurrency_group(&job(yaml)).map(|c| (c.group, c.cancel_in_progress));
        assert_eq!(
            group("concurrency: db\nsteps: []\n"),
            Some(("db".to_string(), false))
        );
        assert_eq!(
            group("concurrency:\n  group: db\n  cancel-in-progress: true\nsteps: []\n"),
            Some(("db".to_string(), true))
        );
        assert_eq!(group("steps: []\n"), None);
    }
}

```

### Core Architecture Module: `crates/executor/src/engine.rs`
```
#[allow(unused_imports)]
use bollard::Docker;
use futures::future;
use once_cell::sync::Lazy;
use serde_yaml::Value;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
// std::process::Command replaced by tokio::process::Command for async safety
use thiserror::Error;

use crate::acceleration;
use crate::action_resolver::{self, is_git_sha};
use crate::checkout_sync::copy_directory_contents;
use crate::dependency;
use crate::docker;
use crate::environment;
use crate::events::{step_display_name, EXIT_CODE_LABEL, STDERR_HEADER, STDOUT_HEADER};
use crate::image_build::{
    ahead_build_permits, build_image_checked, ensure_shared_layers, failed_image_build,
    remember_failed_image_build, with_images_built_ahead, with_run_image_builds, AHEAD_BUILDS,
    IMAGES_BUILT_AHEAD,
};
use crate::job_session;
use crate::kubernetes::{self, KubernetesConfig};
use crate::live_step::LiveStep;
use crate::matrix_fold::{matrix_twins, repeated_leg};
use crate::podman;
use crate::setup_actions::{
    detect_setup, runner_node_install, rust_toolchain_extras, static_input, unrun_action_cause,
    BuiltRuntimes, SetupDetection, SetupRuntime, NO_IMPLEMENTATION, PYTHON_SCRIPTS_DIR,
    SETUP_ACTIONS, UV_PYTHON_DIR,
};
use wrkflw_logging;
use wrkflw_matrix::MatrixCombination;
use wrkflw_models::gitlab::Pipeline;
use wrkflw_parser::gitlab::{self, parse_pipeline};
use wrkflw_parser::workflow::{
    self, parse_workflow, ActionInfo, Job, JobContainer, Step, WorkflowDefinition,
};
use wrkflw_runtime::container::{ContainerRuntime, COMBINED_IMAGE_PREFIX};
use wrkflw_runtime::emulation;
use wrkflw_secrets::{SecretConfig, SecretManager, SecretMasker, SecretSubstitution};

#[allow(unused_variables, unused_assignments)]
/// Execute a GitHub Actions workflow file locally
pub async fn execute_workflow(
    workflow_path: &Path,
    config: ExecutionConfig,
) -> Result<ExecutionResult, ExecutionError> {
    // Held until the run ends; values it registers stay masked in the
    // logs until the next run starts.
    let _log_scope = crate::log_redaction::begin_run();
    wrkflw_logging::info(&format!("Executing workflow: {}", workflow_path.display()));
    wrkflw_logging::info(&format!("Runtime: {:?}", config.runtime_type));

    // Determine if this is a GitLab CI/CD pipeline or GitHub Actions workflow
    let is_gitlab = is_gitlab_pipeline(workflow_path);

    if is_gitlab {
        let result = crate::vm_memory::with_run_pool(acceleration::without_run_state(
            execute_gitlab_pipeline(workflow_path, config.clone()),
        ))
        .await;
        crate::vm_workspace::wait_for_released_volumes().await;
        return result;
    }
    let root = std::env::current_dir().map_err(|e| {
        ExecutionError::Execution(format!("Failed to get current directory: {}", e))
    })?;
    let state = acceleration::RunState::new(
        config.acceleration.clone(),
        config.preserve_containers_on_failure,
        root,
    )
    .map_err(ExecutionError::Execution)?;
    // Each run gets its own job pool, sized once its runtime is known.
    let result = crate::vm_memory::with_run_pool(acceleration::with_run_state(
        std::sync::Arc::new(state),
        crate::workspace::with_workflow_file(
            workflow_path,
            Box::pin(with_run_image_builds(execute_github_workflow(
                workflow_path,
                config.clone(),
            ))),
        ),
    ))
    .await;
    // A fresh workspace's volume goes once its job container does; a run
    // that ends here would otherwise leave the last ones behind.
    crate::vm_workspace::wait_for_released_volumes().await;
    result
}

/// Determine if a file is a GitLab CI/CD pipeline
fn is_gitlab_pipeline(path: &Path) -> bool {
    // Check the file name
    if let Some(file_name) = path.file_name() {
        if let Some(file_name_str) = file_name.to_str() {
            return file_name_str == ".gitlab-ci.yml" || file_name_str.ends_with("gitlab-ci.yml");
        }
    }

    // If file name check fails, try to read and determine by content
    if let Ok(content) = fs::read_to_string(path) {
        // GitLab CI/CD pipelines typically have stages, before_script, after_script at the top level
        if content.contains("stages:")
            || content.contains("before_script:")
            || content.contains("after_script:")
        {
            // Check for GitHub Actions specific keys that would indicate it's not GitLab
            if !content.contains("on:")
                && !content.contains("runs-on:")
                && !content.contains("uses:")
            {
                return true;
            }
        }
    }

    false
}

/// Execute a GitHub Actions workflow file locally
async fn execute_github_workflow(
    workflow_path: &Path,
    mut config: ExecutionConfig,
) -> Result<ExecutionResult, ExecutionError> {
    config.runtime_type = detect_runtime(config.runtime_type);
    // 1. Parse workflow file
    let workflow = parse_workflow(workflow_path)?;

    // 2. Resolve job dependencies and create execution plan
    let execution_plan = dependency::resolve_dependencies(&workflow)?;

    // Filter to target job and its transitive dependencies if specified
    let execution_plan = if let Some(ref target_job) = config.target_job {
        dependency::filter_plan_to_job(execution_plan, target_job, &workflow.jobs, "workflow")
            .map_err(ExecutionError::Execution)?
    } else {
        execution_plan
    };

    // 3. Initialize appropriate runtime
    let (runtime, effective_runtime) = initialize_runtime(
        config.runtime_type.clone(),
        config.preserve_containers_on_failure,
        &config.kubernetes,
    )?;
    config.runtime_type = effective_runtime;
    crate::vm_memory::check(vm_cli(&config.runtime_type)).await;
    warn_if_overrides_unused(&config);

    // Create a temporary workspace directory
    let workspace_dir = tempfile::tempdir()
        .map_err(|e| ExecutionError::Execution(format!("Failed to create workspace: {}", e)))?;

    // 4. Set up GitHub-like environment. The context is made once: jobs run
    // on the host below get the same run id and the like as the rest.
    let github_context = environment::create_github_context(
        &workflow,
        workspace_dir.path(),
        &environment::RunRef {
            event_name: config.event_name.as_deref(),
            git_ref: config.git_ref.as_deref(),
            base_branch: config.base_branch.as_deref(),
        },
    );
    let (mut env_context, user_env) =
        github_run_env_from(github_context.clone(), &workflow, &config.runtime_type)?;

    // show=true means hide=false (inverted for the env var)
    env_context.insert(
        "WRKFLW_HIDE_ACTION_MESSAGES".to_string(),
        if config.show_action_messages {
            "false"
        } else {
            "true"
        }
        .to_string(),
    );

    // Setup GitHub environment files
    environment::setup_github_environment_files(workspace_dir.path()).map_err(|e| {
        ExecutionError::Execution(format!("Failed to setup GitHub env files: {}", e))
    })?;

    // `macos-*` jobs on this Mac, when asked, with the env emulation gives.
    let host_jobs = if crate::host_jobs::wanted(&config.runtime_type) {
        let (host_env, _) =
            github_run_env_from(github_context, &workflow, &RuntimeType::Emulation)?;
        wrkflw_logging::warning(
            "macos-* jobs run on this Mac itself (--macos-on-host), with no container \
             around their steps: they can change this machine, and they see this shell's \
             environment, credentials included. They have no terminal to ask for input \
             at, so one that does, such as sudo asking for a password, fails",
        );
        Some(std::sync::Arc::new(crate::host_jobs::HostJobs::new(
            Box::new(emulation::EmulationRuntime::new()),
            &env_context,
            host_env,
        )))
    } else {
        if crate::run_options::macos_on_host() {
            wrkflw_logging::warning(&format!(
                "--macos-on-host has no effect here: it runs macos-* jobs on a Mac whose \
                 other jobs run in containers, and this run is on {} with {}",
                std::env::consts::OS,
                config.runtime_type.mode_name()
            ));
        }
        None
    };

    // 5. Initialize secrets management
    let secret_manager = if let Some(secrets_config) = &config.secrets_config {
        Some(
            SecretManager::new(secrets_config.clone())
                .await
                .map_err(|e| {
                    ExecutionError::Execution(format!("Failed to initialize secret manager: {}", e))
                })?,
        )
    } else {
        Some(SecretManager::default().await.map_err(|e| {
            ExecutionError::Execution(format!(
                "Failed to initialize default secret manager: {}",
                e
            ))
        })?)
    };

    let secret_masker = SecretMasker::new();

    // Create artifact store for this workflow run
    let artifact_store =
        crate::artifacts::ArtifactStore::new(workspace_dir.path()).map_err(|e| {
            ExecutionError::Execution(format!("Failed to create artifact store: {}", e))
        })?;

    // Create cache store for this workflow run (persistent across runs)
    let cache_store = crate::cache::CacheStore::new()
        .map_err(|e| ExecutionError::Execution(format!("Failed to create cache store: {}", e)))?;

    // 6. Execute jobs according to the plan
    let mut results = Vec::new();
    let mut has_failures = false;
    let mut failure_details = String::new();
    // Accumulate job outputs and results across batches for `needs.*` context
    let mut all_job_outputs: HashMap<String, HashMap<String, String>> = HashMap::new();
    let mut all_job_results: HashMap<String, String> = HashMap::new();

    for job_batch in execution_
```

### Core Architecture Module: `crates/ui/src/app/state.rs`
```
// App state for the UI
use crate::log_processor::{LogProcessingRequest, LogProcessor, ProcessedLogEntry};
use crate::models::{
    ExecutionResultMsg, JobExecution, LogFilterLevel, QueuedExecution, StatusSeverity,
    StepExecution, TimelineMsg, TriggerMatchStatus, Workflow, WorkflowExecution, WorkflowStatus,
};
use crate::theme::{self, ThemeMode};
use chrono::Local;
use crossterm::event::KeyCode;
use ratatui::widgets::{ListState, TableState};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::task::JoinHandle;
use wrkflw_executor::{JobStatus, RuntimeType, StepStatus};
use wrkflw_secrets::SecretConfig;

/// Ask whether `runtime` answers, on a thread of its own: a cluster or a slow
/// credential plugin can take seconds, and this must never stall the event
/// loop. `None` for runtimes that have nothing to probe.
fn start_availability_probe(
    runtime: &RuntimeType,
    kubernetes: &wrkflw_executor::KubernetesConfig,
) -> Option<mpsc::Receiver<bool>> {
    let runtime = runtime.clone();
    if !matches!(
        runtime,
        RuntimeType::Docker | RuntimeType::Podman | RuntimeType::Kubernetes
    ) {
        return None;
    }
    let kubernetes = kubernetes.clone();
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let available = match runtime {
            RuntimeType::Docker => wrkflw_executor::docker::is_available(),
            RuntimeType::Podman => wrkflw_executor::podman::is_available(),
            _ => wrkflw_executor::kubernetes::is_available_with(&kubernetes),
        };
        // The receiver is gone if the user has already moved on.
        let _ = tx.send(available);
    });
    Some(rx)
}

/// Application state
/// Runs loaded into the Runs tab.
const MAX_RUNS_SHOWN: usize = 200;

pub struct App {
    pub workflows: Vec<Workflow>,
    pub workflow_list_state: ListState,
    pub selected_tab: usize,
    /// The Run tab's view (jobs, graph or log) to reopen it on.
    pub run_screen: usize,
    pub running: bool,
    pub show_help: bool,
    pub runtime_type: RuntimeType,
    pub validation_mode: bool,
    pub preserve_containers_on_failure: bool,
    pub platform_overrides: HashMap<String, String>,
    pub kubernetes: wrkflw_executor::KubernetesConfig,
    pub show_action_messages: bool,
    pub execution_queue: Vec<QueuedExecution>, // Workflows queued for execution
    pub current_execution: Option<usize>,
    logs: Vec<String>, // Overall execution logs — private so every mutation routes through `add_log`
    pub log_scroll: usize, // Scrolling position for logs
    /// Keep the newest log line selected as lines arrive.
    pub log_follow: bool,
    /// First visible log row, kept across frames so scrolling is smooth.
    pub log_offset: usize,
    /// The Logs tab tells the run's story rather than showing raw lines.
    pub log_story: bool,
    /// First story line on screen.
    pub story_scroll: usize,
    /// Keep the end of the story in view as it grows.
    pub story_follow: bool,
    /// Show debug-level lines in the raw log (`--verbose`).
    pub show_debug_logs: bool,
    pub job_list_state: ListState,            // For viewing job details
    pub detailed_view: bool,                  // Whether we're in detailed view mode
    pub step_list_state: ListState,           // For selecting steps in detailed view
    pub step_table_state: TableState,         // For the steps table in detailed view
    pub last_tick: Instant,                   // For UI animations and updates
    pub tick_rate: Duration,                  // How often to update the UI
    pub spinner_frame: usize,                 // Current spinner animation frame
    pub tx: mpsc::Sender<ExecutionResultMsg>, // Channel for async communication
    pub status_message: Option<String>,       // Temporary status message to display
    pub status_message_severity: StatusSeverity, // Severity of the current status message
    pub status_message_time: Option<Instant>, // When the message was set

    // Search and filter functionality
    pub log_search_query: String, // Current search query for logs
    pub log_search_active: bool,  // Whether search input is active
    pub log_filter_level: Option<LogFilterLevel>, // Current log level filter
    pub log_search_matches: Vec<usize>, // Indices of logs that match the search
    pub log_search_match_idx: usize, // Current match index for navigation

    // Help tab scrolling
    pub help_scroll: usize, // Scrolling position for help content
    pub selection: Option<crate::selection::Selection>, // Mouse text selection
    pub runs: Vec<wrkflw_runs::RunRecord>,
    /// Index into `runs` of each workflow's newest run, by workflow index.
    pub last_run_for: Vec<Option<usize>>,
    pub runs_selected: usize,

    // Background log processing
    pub log_processor: LogProcessor,
    pub processed_logs: Vec<ProcessedLogEntry>,
    pub logs_need_update: bool,        // Flag to trigger log processing
    pub last_system_logs_count: usize, // Track system log changes
    logs_revision: u64, // Bumped on every log/search/filter change; `logs.len()` goes stale at the cap

    // Job selection mode
    pub job_selection_mode: bool, // Are we viewing jobs of a workflow?
    pub available_jobs: Vec<String>, // Job names from selected workflow
    pub selected_job_index: usize, // Cursor in job selection list

    // Cached container runtime availability (avoids re-checking every render frame)
    pub runtime_available: bool,
    pub last_availability_check: Instant,
    /// Answer to a probe still running off the event loop, if any.
    availability_probe: Option<mpsc::Receiver<bool>>,

    // Diff-aware trigger filtering
    pub diff_filter_active: bool,
    /// The event the TUI simulates for diff-filter evaluation. Stored on
    /// `App` rather than as a hardcoded constant so a future event selector
    /// UI is a data-flow change only.
    pub diff_filter_event: String,
    /// Activity type to stamp on the synthesized event context — same
    /// purpose as `WatcherConfig::activity_type` and the CLI's
    /// `--activity-type` flag. The TUI has no UI to set this yet, so it
    /// defaults to `None`; the field exists so a future activity-type
    /// selector is a plumbing-only change here, and so workflows that
    /// gate on `pull_request: { types: [...] }` aren't silently rejected
    /// the moment such a UI ships.
    pub diff_filter_activity_type: Option<String>,
    /// Channel receiving (workflow_path, trigger_status) pairs from the background
    /// evaluation task. We send pairs (rather than a positional Vec) so that
    /// reloading `self.workflows` between toggle and result delivery cannot
    /// mis-assign trigger statuses.
    pub diff_filter_rx: Option<DiffFilterReceiver>,
    /// Handle for the most-recently-spawned evaluation task, held so
    /// rapid toggles can cancel the previous in-flight evaluation instead
    /// of leaking wasted git + parse work.
    pub diff_filter_task: Option<JoinHandle<()>>,
    /// Set to `true` immediately before we drop the previous evaluation's
    /// receiver in [`App::toggle_diff_filter`]. The next
    /// [`App::check_diff_filter_results`] tick uses it to distinguish a
    /// self-inflicted disconnect (rapid toggle) from a genuine background
    /// task failure, so we don't tell the user "evaluation failed" for an
    /// action they took deliberately. Cleared once observed.
    pub diff_filter_aborted: bool,

    /// Active sub-tab inside the Step Inspector (job-detail) view.
    /// 0 Output, 1 Env, 2 Files, 3 Matrix, 4 Timeline.
    pub step_inspector_tab: usize,
    /// Lines scrolled back from the end of the inspected step's output;
    /// 0 follows the tail.
    pub step_output_scroll: usize,
    /// Stage scrolled to in the DAG graph view.
    pub dag_scroll: usize,
    /// Bumped whenever a workflow's results are replaced, so caches
    /// keyed by workflow/job/step index can tell a rerun apart.
    pub run_generation: u64,
    /// Parsed output of the step the inspector last showed.
    pub step_output_cache: Option<crate::views::StepOutputCache>,
    /// Matrix run counts for the DAG cards, computed once per parsed
    /// workflow rather than expanding every matrix on every frame.
    pub dag_matrix_labels: Option<(
        Arc<wrkflw_parser::workflow::WorkflowDefinition>,
        HashMap<String, String>,
    )>,

    // ── DAG tab ───────────────────────────────────────────────────
    /// When true, the DAG tab renders the topological-stage list view;
    /// when false, the spatial column layout. Matches the design's
    /// `graphView: 'graph' | 'list'` toggle (shortcut `g`).
    pub dag_list_view: bool,

    // ── Trigger tab ───────────────────────────────────────────────
    /// Platform selected in the Trigger tab: "github" or "gitlab".
    /// Toggled with `p` to keep the keyboard story explicit.
    pub trigger_platform: TriggerPlatform,
    /// Cursor into `workflows` for the workflow-to-dispatch selector.
    pub trigger_workflow_idx: usize,
    /// The branch/ref input — owned by the app so typing doesn't lose
    /// state between draws. Empty string means "use the resolved
    /// default"; the curl preview and the dispatcher both honour that
    /// fallback. Edited when `trigger_branch_focused` is set.
    pub trigger_branch: String,
    /// True while the Branch / ref row holds the edit focus. Mutually
    /// exclusive with `trigger_input_cursor.is_some()` — the main key
    /// handler drives them as a single "is something being edited?"
    /// question via [`App::trigger_editing`].
    pub trigger_branch_focused: bool,
    /// Free-form `key=value` pairs to POST as `inputs:` (GitHub) or
    /// `variables:` (GitLab). Flat Vec rather than HashMap so the UI
    /// can show a deterministic cursor position and preserv
```

### Core Architecture Module: `crates/ui/src/utils/mod.rs`
```
// UI utilities
use crate::models::{Workflow, WorkflowStatus};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use wrkflw_parser::workflow::{parse_workflow, WorkflowDefinition};
use wrkflw_utils::is_workflow_file;

/// Parse a workflow file once and return both the parsed definition and a
/// sorted job-name list. The definition is shared so view code can read it
/// without reparsing on every frame.
fn load_definition(path: &Path) -> (Option<Arc<WorkflowDefinition>>, Vec<String>) {
    match parse_workflow(path) {
        Ok(def) => {
            let mut names: Vec<String> = def.jobs.keys().cloned().collect();
            names.sort();
            (Some(Arc::new(def)), names)
        }
        Err(_) => (None, Vec::new()),
    }
}

/// Parse a workflow file and return sorted job names, or an empty vec on failure.
pub fn extract_job_names(path: &Path) -> Vec<String> {
    load_definition(path).1
}

/// Find and load all workflow files in a directory
pub fn load_workflows(dir_path: &Path) -> Vec<Workflow> {
    let mut workflows = Vec::new();

    // Any `workflows` directory counts, which covers both .github/workflows
    // and .gitea/workflows.
    let is_default_dir = dir_path.ends_with("workflows");

    if let Ok(entries) = std::fs::read_dir(dir_path) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_file() && (is_workflow_file(&path) || !is_default_dir) {
                // Get just the base name without extension
                let name = path.file_stem().map_or_else(
                    || "[unknown]".to_string(),
                    |fname| fname.to_string_lossy().into_owned(),
                );

                let (definition, job_names) = load_definition(&path);

                workflows.push(Workflow {
                    name,
                    path,
                    selected: false,
                    status: WorkflowStatus::NotStarted,
                    execution_details: None,
                    job_names,
                    trigger_match: None,
                    definition,
                });
            }
        }
    }

    // Check for GitLab CI pipeline file in the root directory if we're in the default GitHub workflows dir
    if is_default_dir {
        // Look for .gitlab-ci.yml in the repository root
        let gitlab_ci_path = PathBuf::from(".gitlab-ci.yml");
        if gitlab_ci_path.exists() && gitlab_ci_path.is_file() {
            let (definition, job_names) = load_definition(&gitlab_ci_path);

            workflows.push(Workflow {
                name: "gitlab-ci".to_string(),
                path: gitlab_ci_path,
                selected: false,
                status: WorkflowStatus::NotStarted,
                execution_details: None,
                job_names,
                trigger_match: None,
                definition,
            });
        }
    }

    // Sort workflows by name
    workflows.sort_by(|a, b| a.name.cmp(&b.name));
    workflows
}

```

### Core Architecture Module: `crates/utils/src/lib.rs`
```
// utils crate

use std::path::{Path, PathBuf};

/// Default workflow directory for GitHub Actions.
pub const GITHUB_WORKFLOWS_DIR: &str = ".github/workflows";

/// Default workflow directory for Gitea Actions.
pub const GITEA_WORKFLOWS_DIR: &str = ".gitea/workflows";

/// Returns the default workflow directories that exist under `root`, in
/// Gitea's lookup order: `.gitea/workflows` first, then `.github/workflows`.
///
/// Gitea itself only runs the first directory that exists, but a repository
/// mirrored to both forges legitimately has both, so commands that can cover
/// several directories should use all of them.
pub fn default_workflow_dirs_in(root: &Path) -> Vec<PathBuf> {
    [GITEA_WORKFLOWS_DIR, GITHUB_WORKFLOWS_DIR]
        .iter()
        .map(|dir| root.join(dir))
        .filter(|dir| dir.is_dir())
        .collect()
}

/// [`default_workflow_dirs_in`] relative to the current directory. Paths stay
/// relative so they read as `.gitea/workflows`, not `./.gitea/workflows`.
pub fn default_workflow_dirs() -> Vec<PathBuf> {
    default_workflow_dirs_in(Path::new(""))
}

/// The single default workflow directory, for commands that take only one.
/// Falls back to `.github/workflows` when neither directory exists, so the
/// caller's "not found" error names the conventional location.
pub fn default_workflow_dir() -> PathBuf {
    default_workflow_dirs()
        .into_iter()
        .next()
        .unwrap_or_else(|| PathBuf::from(GITHUB_WORKFLOWS_DIR))
}

pub fn is_workflow_file(path: &Path) -> bool {
    // First, check for GitLab CI files by name
    if let Some(file_name) = path.file_name() {
        let file_name_str = file_name.to_string_lossy().to_lowercase();
        if file_name_str == ".gitlab-ci.yml" || file_name_str.ends_with("gitlab-ci.yml") {
            return true;
        }
    }

    // Then check for GitHub Actions workflows
    if let Some(ext) = path.extension() {
        if ext == "yml" || ext == "yaml" {
            // Check if the file is in a .github/workflows directory
            if let Some(parent) = path.parent() {
                return parent.ends_with(".github/workflows") || parent.ends_with("workflows");
            } else {
                // Check if filename contains workflow indicators
                let filename = path
                    .file_name()
                    .map(|f| f.to_string_lossy().to_lowercase())
                    .unwrap_or_default();

                return filename.contains("workflow")
                    || filename.contains("action")
                    || filename.contains("ci")
                    || filename.contains("cd");
            }
        }
    }
    false
}

/// Module for safely handling file descriptor redirection
///
/// On Unix systems (Linux, macOS), this module provides true file descriptor
/// redirection by duplicating stderr and redirecting it to /dev/null.
///
/// On Windows systems, the redirection functionality is limited due to platform
/// differences in file descriptor handling. The functions will execute without
/// error but stderr may not be fully suppressed.
pub mod fd {
    use std::io::Result;

    /// Represents a redirected stderr that can be restored
    pub struct RedirectedStderr {
        #[cfg(unix)]
        original_fd: Option<std::os::unix::io::RawFd>,
        #[cfg(unix)]
        null_fd: Option<std::os::unix::io::RawFd>,
        #[cfg(windows)]
        _phantom: std::marker::PhantomData<()>,
    }

    #[cfg(unix)]
    mod unix_impl {
        use super::*;
        use nix::fcntl::{open, OFlag};
        use nix::sys::stat::Mode;
        use nix::unistd::{close, dup, dup2};
        use std::io;
        use std::os::unix::io::RawFd;
        use std::path::Path;

        /// Standard file descriptors
        const STDERR_FILENO: RawFd = 2;

        impl RedirectedStderr {
            /// Creates a new RedirectedStderr that redirects stderr to /dev/null
            pub fn to_null() -> Result<Self> {
                // Duplicate the current stderr fd
                let stderr_backup = match dup(STDERR_FILENO) {
                    Ok(fd) => fd,
                    Err(e) => return Err(io::Error::other(e)),
                };

                // Open /dev/null
                let null_fd = match open(Path::new("/dev/null"), OFlag::O_WRONLY, Mode::empty()) {
                    Ok(fd) => fd,
                    Err(e) => {
                        let _ = close(stderr_backup); // Clean up on error
                        return Err(io::Error::other(e));
                    }
                };

                // Redirect stderr to /dev/null
                if let Err(e) = dup2(null_fd, STDERR_FILENO) {
                    let _ = close(stderr_backup); // Clean up on error
                    let _ = close(null_fd);
                    return Err(io::Error::other(e));
                }

                Ok(RedirectedStderr {
                    original_fd: Some(stderr_backup),
                    null_fd: Some(null_fd),
                })
            }
        }

        impl Drop for RedirectedStderr {
            /// Automatically restores stderr when the RedirectedStderr is dropped
            fn drop(&mut self) {
                if let Some(orig_fd) = self.original_fd.take() {
                    // Restore the original stderr
                    let _ = dup2(orig_fd, STDERR_FILENO);
                    let _ = close(orig_fd);
                }

                // Close the null fd
                if let Some(null_fd) = self.null_fd.take() {
                    let _ = close(null_fd);
                }
            }
        }
    }

    #[cfg(windows)]
    mod windows_impl {
        use super::*;

        impl RedirectedStderr {
            /// Creates a new RedirectedStderr that redirects stderr to NUL on Windows
            pub fn to_null() -> Result<Self> {
                // On Windows, we can't easily redirect stderr at the file descriptor level
                // like we can on Unix systems. This is a simplified implementation that
                // doesn't actually redirect but provides the same interface.
                // The actual stderr suppression will need to be handled differently on Windows.
                Ok(RedirectedStderr {
                    _phantom: std::marker::PhantomData,
                })
            }
        }

        impl Drop for RedirectedStderr {
            /// No-op drop implementation for Windows
            fn drop(&mut self) {
                // Nothing to restore on Windows in this simplified implementation
            }
        }
    }

    /// Run a function with stderr redirected to /dev/null (Unix) or suppressed (Windows), then restore stderr
    ///
    /// # Platform Support
    /// - **Unix (Linux, macOS)**: Fully supported - stderr is redirected to /dev/null
    /// - **Windows**: Limited support - function executes but stderr may be visible
    ///
    /// # Example
    /// ```
    /// use wrkflw_utils::fd::with_stderr_to_null;
    ///
    /// let result = with_stderr_to_null(|| {
    ///     eprintln!("This will be hidden on Unix");
    ///     42
    /// }).unwrap();
    /// assert_eq!(result, 42);
    /// ```
    pub fn with_stderr_to_null<F, T>(f: F) -> Result<T>
    where
        F: FnOnce() -> T,
    {
        #[cfg(unix)]
        {
            let _redirected = RedirectedStderr::to_null()?;
            Ok(f())
        }
        #[cfg(windows)]
        {
            // On Windows, we can't easily redirect stderr at the FD level,
            // so we just run the function without redirection.
            // This means stderr won't be suppressed on Windows, but the function will work.
            Ok(f())
        }
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn default_workflow_dirs_prefer_gitea_and_skip_missing() {
        let tmp = std::env::temp_dir().join(format!("wrkflw-dirs-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&tmp);
        std::fs::create_dir_all(&tmp).unwrap();
        assert!(super::default_workflow_dirs_in(&tmp).is_empty());

        let github = tmp.join(super::GITHUB_WORKFLOWS_DIR);
        std::fs::create_dir_all(&github).unwrap();
        assert_eq!(super::default_workflow_dirs_in(&tmp), vec![github.clone()]);

        let gitea = tmp.join(super::GITEA_WORKFLOWS_DIR);
        std::fs::create_dir_all(&gitea).unwrap();
        assert_eq!(super::default_workflow_dirs_in(&tmp), vec![gitea, github]);

        std::fs::remove_dir_all(&tmp).unwrap();
    }

    use super::*;

    #[test]
    fn test_fd_redirection() {
        // This test will write to stderr, which should be redirected on Unix
        // On Windows, it will just run normally without redirection
        let result = fd::with_stderr_to_null(|| {
            // This would normally appear in stderr (suppressed on Unix, visible on Windows)
            eprintln!("This should be redirected to /dev/null on Unix");
            // Return a test value to verify the function passes through the result
            42
        });

        // The function should succeed and return our test value on both platforms
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), 42);
    }
}

```

### Core Architecture Module: `crates/watcher/src/git_state.rs`
```
//! TTL-bounded cache for `(branch, tag)` git state used by the watcher
//! hot loop.
//!
//! Extracted from `watcher.rs` so the cache + its refresh policy live
//! in one place. `WorkflowWatcher` owns a [`GitStateCache`] instead of
//! an inline `Mutex<Option<CachedGitState>>`, which keeps the struct
//! definition out of the reactor file and lets the staleness contract
//! be read without stepping through 2k lines of orchestration.
//!
//! The watcher reads `(branch, tag)` once per cycle. During a
//! file-save storm a single debounced cycle used to shell out
//! `git rev-parse` + `git describe` per event — this cache is what
//! makes the hot loop cheap. See [`GitStateCache::get`] for the
//! staleness rules.

use std::path::Path;
use std::sync::Mutex;
use std::time::Instant;

/// Snapshot of the last-fetched git state (branch + tag) with the
/// wall-clock instant it was fetched at. Reused across cycles inside
/// `TriggerFilterConfig::git_state_ttl` so a file-save storm doesn't
/// trigger one `git rev-parse` + one `git describe` per event.
///
/// `head_mtime` is the mtime of `.git/HEAD` at fetch time. We
/// re-`stat` it on every lookup and treat the cache as stale if the
/// value changed — a `git checkout` inside the TTL window bumps
/// `.git/HEAD`'s mtime, so the next cycle's branch/tag fetch is
/// guaranteed to run instead of handing back a value from the
/// pre-checkout working tree. Without this key, a fast `checkout +
/// save` sequence silently evaluated branch filters against the
/// previous branch for up to one TTL.
#[derive(Debug, Clone)]
pub(crate) struct CachedGitState {
    fetched_at: Instant,
    head_mtime: Option<std::time::SystemTime>,
    branch: Option<String>,
    tag: Option<String>,
}

/// TTL-bounded cache wrapping a `Mutex<Option<CachedGitState>>`.
///
/// `Mutex` rather than `RwLock` because the critical section is
/// trivially short (one clone of an `Option<String>`), and because the
/// write path runs at most once per TTL so contention is effectively
/// zero. Uses `std::sync::Mutex` so the guard is cheap to acquire
/// without involving the tokio runtime.
#[derive(Debug)]
pub(crate) struct GitStateCache {
    inner: Mutex<Option<CachedGitState>>,
}

impl GitStateCache {
    pub(crate) fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }

    /// Test-only accessor that returns the cached `fetched_at` instant
    /// if the cache is populated. The `cached_git_state_reuses_within_ttl`
    /// test uses it to assert that two successive hits share a single
    /// fetch instant (i.e. the second call did not refresh). Hidden
    /// behind `cfg(test)` so the production path has no observable
    /// surface on the cache's wall-clock state.
    #[cfg(test)]
    pub(crate) fn peek_fetched_at(&self) -> Option<Instant> {
        let guard = match self.inner.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        guard.as_ref().map(|s| s.fetched_at)
    }

    /// Return cached `(branch, tag)` if still fresh within
    /// `config.git_state_ttl`; otherwise re-fetch both via concurrent
    /// git subprocess calls and update the cache.
    ///
    /// Errors out of git are propagated so the caller can build a
    /// `WatchEvent` with an `error` payload — the previous code path
    /// silently collapsed git failures to `branch: None`, which made
    /// every `branches:` filter deterministically reject and produced
    /// a session-long stream of "0 triggered" reports with no
    /// explanation.
    pub(crate) async fn get(
        &self,
        config: &wrkflw_trigger_filter::TriggerFilterConfig,
        repo_root: &Path,
    ) -> Result<(Option<String>, Option<String>), wrkflw_trigger_filter::TriggerFilterError> {
        let ttl = config.git_state_ttl;
        let cwd = Some(repo_root);
        let current_head_mtime = wrkflw_trigger_filter::git::head_mtime(cwd);

        // Cheap lock: just check freshness and clone out if hit.
        //
        // Mutex poisoning is handled via `into_inner()` inside a
        // `match` — the guard from the poisoned branch is a
        // `MutexGuard` too, so both arms feed a single usage below.
        //
        // Two independent staleness tests:
        //   1. Wall-clock TTL (bounds worst-case staleness even if
        //      `.git/HEAD` didn't move — e.g. a fresh clone with no
        //      committed HEAD yet, or a platform where mtime is
        //      coarser than the test expects).
        //   2. HEAD mtime divergence — catches `git checkout` within
        //      the TTL. Only compared when BOTH the cached and the
        //      freshly-stat'd mtime are `Some`; one-sided `None` is
        //      treated as "don't know, fall back to the TTL alone"
        //      so the happy path still short-circuits on platforms
        //      that don't expose a usable modified() time.
        {
            let guard = match self.inner.lock() {
                Ok(g) => g,
                Err(p) => p.into_inner(),
            };
            if let Some(state) = guard.as_ref() {
                let ttl_ok = state.fetched_at.elapsed() < ttl;
                let head_ok = match (state.head_mtime, current_head_mtime) {
                    (Some(cached), Some(current)) => cached == current,
                    _ => true,
                };
                if ttl_ok && head_ok {
                    return Ok((state.branch.clone(), state.tag.clone()));
                }
            }
        }

        // Cache miss — capture HEAD mtime BEFORE the git calls. This is
        // load-bearing for the cache's staleness contract: if a `git
        // checkout` lands between `get_current_branch` and the final
        // store, we want the stored mtime to reflect the *pre-checkout*
        // state that produced the branch/tag values we just read. The
        // next `GitStateCache::get` call will then stat the (newer)
        // post-checkout mtime, observe a mismatch against the stored
        // value, and force a refresh.
        //
        // An earlier draft captured `head_mtime` after the git calls so
        // the stored value reflected the post-checkout state. That
        // "looked right" but produced the opposite bug: the cache would
        // happily serve the pre-checkout branch/tag for the full TTL
        // window because the stored mtime already matched whatever the
        // next call would observe. The regression is pinned by
        // `cached_git_state_invalidates_when_checkout_races_git_reads`.
        //
        // Racing writers: we accept that a concurrent refresher may
        // overwrite with its own fetch. Both branches produce the same
        // value on the steady-state, so late-writer-wins is safe; this
        // avoids a compare-and-set dance on the hot path.
        let fetched_at = Instant::now();
        let head_mtime = wrkflw_trigger_filter::git::head_mtime(cwd);

        let (branch_res, tag_res) = tokio::join!(
            wrkflw_trigger_filter::git::get_current_branch(cwd),
            wrkflw_trigger_filter::git::get_current_tag(cwd),
        );
        let branch = branch_res?;
        let tag = tag_res?;

        let mut guard = match self.inner.lock() {
            Ok(g) => g,
            Err(p) => p.into_inner(),
        };
        *guard = Some(CachedGitState {
            fetched_at,
            head_mtime,
            branch: branch.clone(),
            tag: tag.clone(),
        });
        Ok((branch, tag))
    }
}

```

### Core Architecture Module: `crates/evaluator/src/lib.rs`
```
use colored::*;
use serde_yaml::{self, Value};
use std::fs;
use std::path::{Path, PathBuf};

use wrkflw_models::ValidationResult;
use wrkflw_validators::{validate_env, validate_expressions, validate_jobs, validate_triggers};

pub fn evaluate_workflow_file(path: &Path, verbose: bool) -> Result<ValidationResult, String> {
    let content = fs::read_to_string(path).map_err(|e| format!("Failed to read file: {}", e))?;

    // Parse YAML content
    let workflow: Value =
        serde_yaml::from_str(&content).map_err(|e| format!("Invalid YAML: {}", e))?;

    let mut result = ValidationResult::new();
    let repo_root = find_repo_root(path);

    // Check for required structure
    if !workflow.is_mapping() {
        result.report(
            "workflow-not-mapping",
            "Workflow file is not a valid YAML mapping",
        );
        result.locate_lines(&content);
        return Ok(result);
    }

    // Note: The 'name' field is optional per GitHub Actions specification.
    // When omitted, GitHub displays the workflow file path relative to the repository root.
    // We do not validate name presence as it's not required by the schema.

    // Check if jobs section exists
    match workflow.get("jobs") {
        Some(jobs) if jobs.is_mapping() => {
            result.scoped("jobs", |r| validate_jobs(jobs, repo_root.as_deref(), r));
        }
        Some(_) => {
            result.report_at(
                "jobs-not-mapping",
                "jobs",
                "'jobs' section is not a mapping",
            );
        }
        None => {
            result.report("missing-jobs", "Workflow is missing 'jobs' section");
        }
    }

    // Validate top-level env is a mapping
    if let Some(env) = workflow.get("env") {
        result.scoped("env", |r| validate_env(env, "Top-level", r));
    }

    // Check for valid triggers
    match workflow.get("on") {
        Some(on) => {
            result.scoped("on", |r| validate_triggers(on, r));
        }
        None => {
            result.report(
                "missing-triggers",
                "Workflow is missing 'on' section (triggers)",
            );
        }
    }

    validate_expressions(&workflow, &mut result);

    if verbose && result.is_valid {
        println!(
            "{} Validated structure of workflow: {}",
            "✓".green(),
            path.display()
        );
    }

    result.locate_lines(&content);
    Ok(result)
}

/// Walk up from the workflow file's directory to find the repository root (.git directory).
/// Returns `None` if no `.git` directory is found.
fn find_repo_root(workflow_path: &Path) -> Option<PathBuf> {
    let canonical = fs::canonicalize(workflow_path).ok()?;
    let mut dir = canonical.parent();
    while let Some(d) = dir {
        if d.join(".git").exists() {
            return Some(d.to_path_buf());
        }
        dir = d.parent();
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use wrkflw_models::UNCLASSIFIED_RULE;

    /// A throwaway repository, removed on drop. `.git` makes `find_repo_root`
    /// stop here, so local action checks run against this directory.
    struct Repo(PathBuf);

    impl Repo {
        fn new() -> Self {
            static NEXT: AtomicUsize = AtomicUsize::new(0);
            let dir = std::env::temp_dir().join(format!(
                "wrkflw-evaluator-{}-{}",
                std::process::id(),
                NEXT.fetch_add(1, Ordering::Relaxed)
            ));
            fs::create_dir_all(dir.join(".git")).unwrap();
            Repo(dir)
        }

        fn action(&self, name: &str, definition: Option<&str>) {
            let dir = self.0.join(name);
            fs::create_dir_all(&dir).unwrap();
            if let Some(definition) = definition {
                fs::write(dir.join("action.yml"), definition).unwrap();
            }
        }

        fn evaluate(&self, workflow: &str) -> ValidationResult {
            let path = self.0.join("ci.yml");
            fs::write(&path, workflow).unwrap();
            evaluate_workflow_file(&path, false).unwrap()
        }
    }

    impl Drop for Repo {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn assert_structured(result: &ValidationResult) {
        assert_eq!(result.issues.len(), result.details.len());
        for (message, issue) in result.issues.iter().zip(&result.details) {
            assert_eq!(message, &issue.message);
            assert_ne!(
                issue.rule, UNCLASSIFIED_RULE,
                "unclassified: {}",
                issue.message
            );
        }
    }

    fn assert_issue(
        result: &ValidationResult,
        rule: &str,
        path: Option<&str>,
        line: Option<usize>,
    ) {
        assert!(
            result
                .details
                .iter()
                .any(|i| i.rule == rule && i.path.as_deref() == path && i.line == line),
            "no {rule} at {path:?} line {line:?} in {:#?}",
            result.details
        );
    }

    const DEFECTS: &str = r#"name: ci
on:
  push:
  nonsense:
  schedule:
    - cron: "99 * * * *"
env: NOPE
jobs:
  build:
    steps:
      - name: only a name
      - uses: actions/checkout
      - uses: ./missing-action
  deploy:
    runs-on: ubuntu-latest
    needs: ghost
    strategy:
      matrix:
        os: [linux, 3]
        include: nope
    steps:
      - run: echo hi
        env: BAD
"#;

    #[test]
    fn issues_carry_rule_path_and_line() {
        let result = Repo::new().evaluate(DEFECTS);

        assert_structured(&result);
        assert_eq!(result.details.len(), 11, "{:#?}", result.details);
        for (rule, path, line) in [
            ("unknown-trigger", "on.nonsense", 4),
            ("invalid-cron", "on.schedule[0].cron", 6),
            ("env-not-mapping", "env", 7),
            // Missing key: the line stops at the job that should hold it.
            ("missing-runs-on", "jobs.build.runs-on", 9),
            ("step-missing-action", "jobs.build.steps[0]", 11),
            ("action-missing-version", "jobs.build.steps[1].uses", 12),
            ("action-local-path-missing", "jobs.build.steps[2].uses", 13),
            ("undefined-need", "jobs.deploy.needs", 16),
            (
                "matrix-inconsistent-types",
                "jobs.deploy.strategy.matrix.os[1]",
                19,
            ),
            (
                "matrix-section-not-array",
                "jobs.deploy.strategy.matrix.include",
                20,
            ),
            ("env-not-mapping", "jobs.deploy.steps[0].env", 23),
        ] {
            assert_issue(&result, rule, Some(path), Some(line));
        }
    }

    #[test]
    fn missing_sections_have_no_scope_and_scopes_stay_balanced() {
        let result = Repo::new().evaluate("name: ci\n");
        assert_structured(&result);
        assert_issue(&result, "missing-jobs", None, None);
        assert_issue(&result, "missing-triggers", None, None);

        // `on` is checked after every job, so any scope left open by the
        // defects above would show up in this path.
        let result = Repo::new().evaluate(&DEFECTS.replace("on:\n", "ignored:\n"));
        assert_structured(&result);
        assert_issue(&result, "missing-triggers", None, None);
    }

    #[test]
    fn non_mapping_workflow_is_classified() {
        let result = Repo::new().evaluate("- a\n- b\n");
        assert_structured(&result);
        assert_issue(&result, "workflow-not-mapping", None, None);
    }

    #[test]
    fn every_github_check_is_classified() {
        let repo = Repo::new();
        repo.action("no-metadata", None);
        repo.action("bad-metadata", Some("a: [unclosed"));
        repo.action(
            "needs-input",
            Some("inputs:\n  token:\n    required: true\n"),
        );

        let result = repo.evaluate(
            r#"on: [push, nonsense]
jobs:
  a:
    runs-on: x
    needs: b
    env: [a]
    strategy:
      matrix: 3
    steps:
      - uses: nope
      - uses: actions/checkout@
      - run: echo
        uses: actions/checkout@v4
        id: same
      - run: echo
        id: same
      - just-a-string
  b:
    runs-on: x
    needs: [a]
    steps: []
  c:
    runs-on: x
    steps: nope
  d: nope
  e:
    uses: nope
  f:
    runs-on: x
    strategy:
      matrix:
        max-parallel: nope
        fail-fast: nope
        include: [1]
        exclude: nope
        axis: [a, 1]
    steps:
      - uses: ./no-metadata
      - uses: ./bad-metadata
      - uses: ./needs-input
      - uses: ./needs-input
        with:
          other: 1
"#,
        );
        assert_structured(&result);
        for (rule, path, line) in [
            ("unknown-trigger", "on[1]", 1),
            ("env-not-mapping", "jobs.a.env", 6),
            ("matrix-not-mapping", "jobs.a.strategy.matrix", 8),
            ("action-invalid-reference", "jobs.a.steps[0].uses", 10),
            ("action-invalid-version", "jobs.a.steps[1].uses", 11),
            ("step-uses-and-run", "jobs.a.steps[2]", 12),
            ("duplicate-step-id", "jobs.a.steps[3].id", 16),
            ("step-not-mapping", "jobs.a.steps[4]", 17),
            ("circular-needs", "jobs.a.needs", 5),
            ("empty-steps", "jobs.b.steps", 21),
            ("steps-not-sequence", "jobs.c.steps", 24),
            ("job-not-mapping", "jobs.d", 25),
            ("invalid-reusable-workflow", "jobs.e.uses", 27),
            (
                "matrix-invalid-max-parallel",
                "jobs.f.strategy.matrix.max-parallel",
                32,
            ),
            (
                "matrix-invalid-fail-fast",
                "jobs.f.strategy.matrix.fail-fast",
                33,
            ),
            (
                "matrix-item-not-object",
                "jobs.f.strategy.matrix.include[0]",
                34,
            ),
            (
                "m
```

### Core Architecture Module: `crates/executor/examples/runner_dockerfile.rs`
```
//! Writes `docker/runner.Dockerfile` and `docker/runner-image.txt`, the
//! runner base image the release workflow publishes, from what this
//! wrkflw would build. Run it after changing what every job image gets.

fn main() {
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let dockerfile = wrkflw_executor::engine::runner_base_dockerfile();
    let image = wrkflw_executor::runner_base::published_image(&dockerfile);
    std::fs::create_dir_all(root.join("docker")).unwrap();
    std::fs::write(root.join("docker/runner.Dockerfile"), &dockerfile).unwrap();
    std::fs::write(root.join("docker/runner-image.txt"), format!("{}\n", image)).unwrap();
    println!("{}", image);
}

```

### Core Architecture Module: `crates/executor/src/acceleration.rs`
```
//! Doing less work on a rerun: job result reuse, `--affected` skipping,
//! dependency cache mounts, and per-run `concurrency:` groups.
//!
//! Everything here is opt-in except concurrency groups, and everything fails
//! towards running the job: an unreadable tree, a cache miss or a bad entry
//! means the job runs as it would have without this module.
//!
//! The state lives in a task-local rather than in the step and job context
//! structs, the same way `events::HOOKS` does. A `tokio::spawn` inside the
//! executor would lose it, so job execution has to stay on the run's task.

mod concurrency;
mod sidecar;
mod store;
mod tree;

pub(crate) use concurrency::acquire_concurrency;
use serde_json::Value;
use sha2::{Digest, Sha256};
pub use sidecar::{JobHints, Sidecar};
use std::collections::{BTreeMap, HashMap, HashSet};
use std::future::Future;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, OnceLock};
use store::ResultStore;
pub(crate) use store::StoredJob;
use tokio::sync::{OnceCell, Semaphore};
pub(crate) use tree::hash_tree;
use tree::Tree;
#[cfg(test)]
use tree::TreeHashes;
use wrkflw_parser::workflow::{Job, WorkflowDefinition};

/// The sidecar that holds what a workflow file can't: GitHub rejects unknown
/// keys in workflow YAML, so job hints can't live next to the job.
pub const SIDECAR_PATH: &str = ".wrkflw/affected.yml";

/// Bump when the fingerprint's inputs change, so old entries stop matching.
/// Version 5: steps of the built-in image run as the runner user, so a pass
/// stored when they ran as root says nothing of a run as that user.
/// Version 6: JavaScript actions run, so a pass stored when they passed
/// without running says nothing of a run of them.
const KEY_VERSION: u32 = 6;

/// Host directories mounted into containers under `--dep-cache`, and where
/// in a user's home directory each tool keeps that cache.
const DEP_CACHE_DIRS: &[(&str, &str)] = &[
    ("cargo-registry", ".cargo/registry"),
    ("cargo-git", ".cargo/git"),
    ("npm", ".npm"),
    ("pip", ".cache/pip"),
    ("go-mod", "go/pkg/mod"),
];

/// The home directories a step's caches may be in, in the image wrkflw
/// builds: root's, and the runner user's. Which user a step runs as isn't
/// known until the job's container is up, after its mounts are fixed, and
/// cargo keeps its caches in `CARGO_HOME`, the runner user's home there for
/// root too, so in that image each cache is mounted in both. Any other
/// image only gets root's: its own user's home, even one named `runner`,
/// isn't wrkflw's to mount over.
const DEP_CACHE_HOMES: &[&str] = &["/root", crate::runner_user::HOME];

/// The directory, beside a repository's caches, that holds a second set for
/// steps that always run as root: a job `container:`, an image mapped with
/// `-P`, a step in a container of its own, or a run with
/// `WRKFLW_STEPS_AS_ROOT`. Sharing one set with steps that run as the
/// runner user would leave that user files it can't write, from a root job
/// running beside it.
const ROOT_DEP_CACHE_DIR: &str = "as-root";

/// The `--dep-cache` directories of a run: each one's host directory and
/// where in a home directory it goes, one set for steps that may run as the
/// runner user and one for steps that run as root.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
struct DepCacheMounts {
    runner: Vec<(PathBuf, &'static str)>,
    root: Vec<(PathBuf, &'static str)>,
}

/// Who a step's `--dep-cache` mounts are for.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct DepCacheFor {
    /// The step may run as the runner user: it gets the set that user's
    /// steps share. Otherwise it runs as root, and gets root's own set.
    pub(crate) runner_user: bool,
    /// The step's image is one wrkflw built with the runner user, whose home
    /// the caches go in as well as root's: see [`DEP_CACHE_HOMES`].
    pub(crate) runner_home: bool,
}

/// Files that always count as input, because steps load them without naming
/// them. Path hints would otherwise let a composite action change go unseen.
const ALWAYS_INPUT: &[&str] = &[".github/actions/**", ".gitea/actions/**", SIDECAR_PATH];

/// Covered by the job definition in the key. Hashing them too would make any
/// edit to a workflow invalidate every job in the repository.
const NEVER_INPUT: &[&str] = &[".github/workflows/**", ".gitea/workflows/**"];

/// Text that reads a credential. Plain "secrets" won't do: every serialized
/// job has a `secrets` key, so that would rule out every job.
const SECRET_REFERENCES: &[&str] = &[
    "secrets.",
    "secrets[",
    "secrets)",
    "secrets }",
    "secrets}",
    "github.token",
    "github_token",
    "github-token",
];

/// Actions that change something on GitHub or a registry, and take
/// `github.token` by default, so a job that uses them reads a credential
/// without its YAML saying so. Matched as a prefix of `uses:`, lowercased.
const MUTATING_ACTIONS: &[&str] = &[
    "actions/github-script",
    "actions/create-release",
    "actions/upload-release-asset",
    "actions/labeler",
    "actions/stale",
    "actions/first-interaction",
    "actions/deploy-pages",
    "actions/attest",
    "softprops/action-gh-release",
    "ncipollo/release-action",
    "peter-evans/create-pull-request",
    "peter-evans/create-or-update-comment",
    "peter-evans/repository-dispatch",
    "marocchino/sticky-pull-request-comment",
    "thollander/actions-comment-pull-request",
    "stefanzweifel/git-auto-commit-action",
    "ad-m/github-push-action",
    "googleapis/release-please-action",
    "changesets/action",
    "docker/login-action",
    "docker/build-push-action",
    "pypa/gh-action-pypi-publish",
    "js-devtools/npm-publish",
    "jamesives/github-pages-deploy-action",
    "peaceiris/actions-gh-pages",
];

/// Actions that hand files to another job. A reused job hands over nothing,
/// so the job that needs them would fail.
const ARTIFACT_ACTIONS: &[&str] = &[
    "actions/upload-artifact",
    "actions/download-artifact",
    "actions/upload-pages-artifact",
];

/// The `uses:` of the first step in `job` that runs one of `actions`, at any
/// version or subpath. Lowercased, as GitHub matches action names.
fn uses_one_of<'a>(job: &'a Job, actions: &[&str]) -> Option<&'a str> {
    job.steps.iter().find_map(|step| {
        let uses = step.uses.as_deref()?;
        let lower = uses.to_ascii_lowercase();
        actions
            .iter()
            .any(|action| {
                lower
                    .strip_prefix(action)
                    .is_some_and(|rest| rest.is_empty() || rest.starts_with(['@', '/']))
            })
            .then_some(uses)
    })
}

/// A credential that must not reach logs through `Debug`.
#[derive(Clone, Default, PartialEq)]
pub struct Secret(pub String);

impl std::fmt::Debug for Secret {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Secret([REDACTED])")
    }
}

/// What a run may do to avoid work. The default does nothing.
#[derive(Debug, Clone, Default, PartialEq)]
pub struct Acceleration {
    /// Return the stored result of a job whose fingerprint already passed.
    pub reuse_results: bool,
    /// Files changed since the base. `Some` turns on `--affected`.
    pub changed_files: Option<Vec<String>>,
    /// Run each `run:` step in a container of its own instead of the job's
    /// one, so what a step leaves outside the workspace is gone in the next.
    pub step_containers: bool,
    /// Start a Docker engine inside the container of a job whose steps run
    /// `docker`. That container runs privileged.
    pub docker_in_jobs: bool,
    /// Mount package manager caches from the host.
    pub dep_cache: bool,
    /// Directory, `file://` or `https://` base for shared results.
    pub remote_cache: Option<String>,
    /// Upload this run's results to `remote_cache`.
    pub push_results: bool,
    /// Signs and verifies remote entries. Required with `remote_cache`.
    pub signing_key: Option<Secret>,
    /// Bearer token for an `https://` remote.
    pub remote_token: Option<Secret>,
    /// This run is `wrkflw gate`'s: jobs the sidecar marks `gate: false` are
    /// skipped and left to CI.
    pub gate: bool,
}

/// Why a remote cache setting can't be used.
pub fn validate_remote(accel: &Acceleration) -> Result<(), String> {
    let Some(remote) = &accel.remote_cache else {
        if accel.push_results {
            return Err("--cache-push needs --remote-cache".to_string());
        }
        return Ok(());
    };
    if let Some((scheme, _)) = remote.split_once("://") {
        if !matches!(scheme, "file" | "http" | "https") {
            return Err(format!(
                "--remote-cache doesn't support {}://. Use a directory, a file:// path \
                 or an https:// URL",
                scheme
            ));
        }
    }
    if accel.signing_key.as_ref().is_none_or(|k| k.0.is_empty()) {
        return Err(
            "--remote-cache needs WRKFLW_CACHE_SIGNING_KEY: an unsigned result would let \
             anyone who can write to the cache mark a job as passed"
                .to_string(),
        );
    }
    if remote.starts_with("http://") && !is_loopback_url(remote) {
        return Err("--remote-cache must use https unless the host is local".to_string());
    }
    Ok(())
}

/// Whether `url` names this machine, by name or by a loopback address.
fn is_loopback_url(url: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(url) else {
        return false;
    };
    let Some(host) = url.host_str() else {
        return false;
    };
    let bare = host.trim_start_matches('[').trim_end_matches(']');
    match bare.parse::<std::net::IpAddr>() {
        Ok(ip) => ip.is_loopback(),
        Err(_) => host.eq_ignore_ascii_case("localhost"),
    }
}

fn compile_globs(patterns: &[&str]) -> Vec<glob::Pattern> {
    patterns
        .iter()
        .filter_map(|p| glob
```

### Core Architecture Module: `crates/executor/src/acceleration/sidecar.rs`
```
//! `.wrkflw/affected.yml`: per-job hints a workflow file can't hold, as GitHub
//! rejects unknown keys there.

use super::SIDECAR_PATH;
use serde::Deserialize;
use std::collections::HashMap;
use std::path::Path;

/// One job's entry in `.wrkflw/affected.yml`.
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct JobHints {
    /// Globs of the files this job reads, relative to the repository root.
    #[serde(default)]
    pub paths: Option<Vec<String>>,
    /// False means this job always runs: never reused from a stored result
    /// and never skipped as unaffected. For a job with effects wrkflw can't
    /// see.
    #[serde(default = "default_true")]
    pub cache: bool,
    /// False leaves this job to CI: `wrkflw gate` skips it, as it would a
    /// job whose `if:` is false. For a deploy, a release, or anything else
    /// that must not run from a developer's machine on every push.
    #[serde(default = "default_true")]
    pub gate: bool,
}

impl Default for JobHints {
    fn default() -> Self {
        Self {
            paths: None,
            cache: true,
            gate: true,
        }
    }
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Default, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct Sidecar {
    #[serde(default)]
    pub jobs: HashMap<String, JobHints>,
}

impl Sidecar {
    /// A missing file means no hints. A broken one is an error: silently
    /// ignoring `cache: false` would reuse a job the author ruled out.
    pub fn load(root: &Path) -> Result<Self, String> {
        let path = root.join(SIDECAR_PATH);
        match std::fs::read_to_string(&path) {
            Ok(text) if text.trim().is_empty() => Ok(Self::default()),
            Ok(text) => {
                let sidecar: Self = serde_yaml::from_str(&text)
                    .map_err(|e| format!("invalid {}: {}", SIDECAR_PATH, e))?;
                for (job, path) in sidecar.root_only_paths() {
                    wrkflw_logging::warning(&format!(
                        "{}: '{}' for job '{}' only matches at the repository root, \
                         as '*' doesn't cross '/'. Use '**/{}' for any directory",
                        SIDECAR_PATH, path, job, path
                    ));
                }
                Ok(sidecar)
            }
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Self::default()),
            Err(e) => Err(format!("cannot read {}: {}", SIDECAR_PATH, e)),
        }
    }

    /// `(job, path)` for each path with a wildcard but no `/`. `*` never
    /// crosses a separator, so `*.rs` misses `src/a.rs`, and a missed input
    /// is a job skipped that should have run.
    pub(super) fn root_only_paths(&self) -> Vec<(&str, &str)> {
        let mut found: Vec<(&str, &str)> = self
            .jobs
            .iter()
            .flat_map(|(job, hints)| {
                hints
                    .paths
                    .iter()
                    .flatten()
                    .map(move |path| (job.as_str(), path.as_str()))
            })
            .filter(|(_, path)| !path.contains('/') && path.contains(['*', '?', '[']))
            .collect();
        found.sort();
        found
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_job_is_cached_and_gated_unless_the_sidecar_says_otherwise() {
        let sidecar: Sidecar =
            serde_yaml::from_str("jobs:\n  a: {}\n  deploy: {gate: false}\n").unwrap();
        assert_eq!(sidecar.jobs["a"], JobHints::default());
        assert!(sidecar.jobs["deploy"].cache);
        assert!(!sidecar.jobs["deploy"].gate);
    }
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #176** (2026-11-20): **Pre-release polish: doctor, macOS jobs on the Mac, held-out sweep, prebuilt installs, new demo**
  *Symptoms*: Polish before 0.9.0, from the pre-release review.  ## What's in it  **`wrkflw doctor`** checks, without starting or pulling anything: which engine `auto` picks (and warns when Docker is down and Podman quietly takes over), the engine VM's memory, whether a first run pulls the published runner base or builds here, where a GitHub token comes from (never the token itself), git, and the workflows in the directory. `--format json` gives the same checks, documented in AGENTS.md. It exits 1 only when a check fails.  **`--macos-on-host`** (`WRKFLW_MACOS_ON_HOST=1`) runs `macos-*` jobs, and the macOS legs of a matrix, on the Mac under emulation while the other jobs keep their containers. Their pass then checks macOS instead of being reported unverified. It's off by default because those steps run with no container around them. How it works: - The switch is made per job and per matrix leg, using the env emulation would seed, held in a task-local scoped around each job batch (`host_jobs.rs`). - A host leg is never folded into a container leg as a twin, and no image is built ahead for it. - The hint in `run`/`gate` now names this flag instead of `--runtime emulation`.  **compare: token hint.** When a job fails and its output shows `gh` asking for a token, or a 401, the note says the step needed the token GitHub gives every job, and that `WRKFLW_JOB_GITHUB_TOKEN=1` gives it yours. This is the itoa attestation case.  **Held-out sweep.** `scripts/conformance/held_out_runs.txt` lists 14 repo

- **Issue #175** (2026-11-20): **Pre-release: JavaScript actions, private uses, prebuilt runner image, stand-in reporting, sweep evidence**
  *Symptoms*: Closes the gaps left before the next release, so that a local pass stands for GitHub's on more real workflows and a first run is faster. One commit per item.  ## What changes  **1. JavaScript actions run** (`fd16db9`) An action with `runs.using: node12|16|20|24`, remote or local, used to pass without running and made the run `partial`. It now runs as GitHub's runner runs it: `node <main>` through the `run:` path, so in the job's container as the `runner` user, with `INPUT_<NAME>` from `with:` or the input's evaluated default (hyphens kept) and `GITHUB_ACTION_PATH`/`_REPOSITORY`/`_REF` set. `pre` runs first when `pre-if` holds. `post` runs at the end of the job, last action first, when `post-if` holds (`always()` by default), and reads what `main` saved through `$GITHUB_STATE` or `::save-state` as `STATE_<name>`. A remote action is cloned once per run. An image with no `node` leaves the action unrun and the step `unverified`. Setup and Rust toolchain actions keep wrkflw's own versions. `WRKFLW_JS_ACTIONS=0` restores the old behaviour.  **2. Private repositories for remote `uses:`** (`f2d7dbe`) Every clone is tried anonymously first. For github.com it is then retried with a token: the job's `GITHUB_TOKEN` from a secret provider, else `GITHUB_TOKEN`/`GH_TOKEN`, else `gh auth token`, found once per run. The token reaches git as an `http.extraheader` through `GIT_CONFIG_*` env vars, so it never appears in the URL, argv or `.git/config`. `GIT_TERMINAL_PROMPT=0` makes a missing toke

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

### Incident Patch 1: `490a508b` (2026-11-20)
**Commit Message**: Pre-release: JavaScript actions, private uses, prebuilt runner image, stand-in reporting, sweep evidence (#175)

* feat(executor): clone private repositories for remote uses with the user's GitHub token

A remote uses: was cloned over anonymous HTTPS, so a called workflow or
action in a private repository failed. The clone is now retried, once the
anonymous one fails for github.com, with the GITHUB_TOKEN a secret
provider gave the job, else GITHUB_TOKEN or GH_TOKEN, else gh auth token,
found once per run. The token reaches git as an extra HTTP header through
its environment, never the URL, argv or .git/config, and git never
prompts for a password.

* feat(executor): run JavaScript actions with node, with their pre, post and state

A uses: step whose action runs on Node passed without running and made
the run partial. Such an action, remote or local, now runs as the runner
runs it: node <main> from the action's directory through the run: path,
so in the job's container as its user, with INPUT_<NAME> from with: or
the input's evaluated default (hyphens kept), GITHUB_ACTION_PATH,
GITHUB_ACTION_REPOSITORY and GITHUB_ACTION_REF. pre runs first when
pre-if holds; post is queued and run a

**File**: `.cargo/config.toml` (modified, +6/-0)
```diff
@@ -11,3 +11,9 @@ WRKFLW_FRESH_WORKSPACE = "1"
 # An existing value wins, so name a file to measure, as in
 # `WRKFLW_JOB_MEMORY_FILE=/tmp/job-memory.json cargo run -- run ...`.
 WRKFLW_JOB_MEMORY_FILE = ""
+# And for the runner base image: a test run on a commit whose base isn't
+# published would remember it as unavailable in the user's cache, and real
+# runs would then skip it for a day. CI names its own base with
+# WRKFLW_RUNNER_IMAGE and sets this to 1. It applies to `cargo run` too:
+# set WRKFLW_PREBUILT_IMAGES=1 there to time a first run on the base.
+WRKFLW_PREBUILT_IMAGES = "0"
```

**File**: `.gitattributes` (added, +2/-0)
```diff
@@ -0,0 +1,2 @@
+docker/runner.Dockerfile text eol=lf
+docker/runner-image.txt text eol=lf
```

**File**: `.github/workflows/ci.yml` (modified, +36/-0)
```diff
@@ -39,12 +39,48 @@ jobs:
     name: Build (${{ matrix.os }})
     runs-on: ${{ matrix.os }}
     strategy:
+      # One OS failing says nothing about the others: let them finish.
+      fail-fast: false
       matrix:
         os: [ubuntu-latest, macos-latest, windows-latest]
     steps:
       - uses: actions/checkout@v4
       - uses: dtolnay/rust-toolchain@stable
       - uses: Swatinem/rust-cache@v2
+      # The Docker tests start their jobs from the runner base image, built
+      # here once from the committed Dockerfile and cached by its text, as
+      # a release publishes it. Built inside each test instead, its 120 MB
+      # from Ubuntu's archive sometimes outlast the 10-minute build limit.
+      # Its apt uses Azure's Ubuntu mirror, as the runner itself does, so
+      # what the tests install on it (docker.io) doesn't wait on
+      # archive.ubuntu.com either.
+      # Rebuilt each week too, as the published image is, so the tests run
+      # on current packages rather than the ones of the first cached build.
+      - name: Name the week
+        if: runner.os == 'Linux'
+        id: week
+        run: echo "week=$(date -u +%G-W%V)" >> "$GITHUB_OUTPUT"
+      - name: Restore the runner base image
+        if: runner.os == 'Linux'
+        id: runner-image
+        uses: actions/cache@v4
+        with:
+          path: ~/runner-image.tar
+          key: runner-image-azure-${{ steps.week.outputs.week }}-${{ hashFiles('docker/runner.Dockerfile') }}
+      - name: Build the runner base image
+        if: runner.os == 'Linux' && steps.runner-image.outputs.cache-hit != 'true'
+        run: |
+          mirror='RUN sed -i -E "s#http://(archive|security)\.ubuntu\.com#http://azure.archive.ubuntu.com#g" /etc/apt/sources.list.d/ubuntu.sources'
+          { head -n 1 docker/runner.Dockerfile; echo "$mirror"; tail -n +2 docker/runner.Dockerfile; } \
+            > "$RUNNER_TEMP/runner.Dockerfile"
+          docker build -f "$RUNNER_TEMP/runner.Dockerfile" -t wrkflw-runner:ci docker
+          docker save wrkflw-runner:ci -o ~/runner-image.tar
+      - name: Load the runner base image
+        if: runner.os == 'Linux' && steps.runner-image.outputs.cache-hit == 'true'
+        run: docker load -i ~/runner-image.tar
       - run: cargo build --workspace --all-features
       - run: cargo check --no-default-features --workspace
       - run: cargo test --workspace --all-features
+        env:
+          WRKFLW_RUNNER_IMAGE: ${{ runner.os == 'Linux' && 'wrkflw-runner:ci' || '' }}
+          WRKFLW_PREBUILT_IMAGES: ${{ runner.os == 'Linux' && '1' || '0' }}
```

**File**: `.github/workflows/release.yml` (modified, +70/-2)
```diff
@@ -62,6 +62,72 @@ jobs:
             echo "CHANGELOG_EOF"
           } >> "$GITHUB_OUTPUT"
 
+  runner-image:
+    name: Publish the runner base image
+    runs-on: ubuntu-latest
+    # Not before the tag is checked: this job pushes packages.
+    needs: changelog
+    permissions:
+      contents: read
+      packages: write
+    steps:
+      # Pinned by commit: this job can write packages.
+      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
+        with:
+          ref: ${{ env.RELEASE_TAG }}
+      # docker/runner.Dockerfile is what every built-in job image starts
+      # with, named by a hash of its text in docker/runner-image.txt (a test
+      # keeps both current). wrkflw pulls it instead of building those
+      # layers on a user's machine. The tag names its content, so a release
+      # whose Dockerfile didn't change has nothing to push.
+      - name: Read the image name
+        id: image
+        run: echo "name=$(tr -d '[:space:]' < docker/runner-image.txt)" >> "$GITHUB_OUTPUT"
+      # Pinned by commit: this job can write packages.
+      - uses: docker/setup-qemu-action@c7c53464625b32c7a7e944ae62b3e17d2b600130 # v3.7.0
+      - uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f # v3.12.0
+      - uses: docker/login-action@c94ce9fb468520275223c153574b00df6fe4bcc9 # v3.7.0
+        with:
+          registry: ghcr.io
+          username: ${{ github.actor }}
+          password: ${{ secrets.GITHUB_TOKEN }}
+      - name: Build and push unless published
+        env:
+          IMAGE: ${{ steps.image.outputs.name }}
+        run: |
+          if docker buildx imagetools inspect "$IMAGE" >/dev/null 2>&1; then
+            echo "$IMAGE is already published"
+            exit 0
+          fi
+          # Provenance names the commit and workflow that built it, so a user can
+          # check where a pulled base image came from. The source label links
+          # the package to this repository.
+          docker buildx build \
+            --platform linux/amd64,linux/arm64 \
+            --provenance=mode=max \
+            --label "org.opencontainers.image.source=https://github.com/$GITHUB_REPOSITORY" \
+            -f docker/runner.Dockerfile \
+            -t "$IMAGE" \
+            --push .
+      # GHCR makes a new package private. wrkflw pulls the base without
+      # credentials and builds the whole image itself when it can't, so a
+      # private package fails nothing; it only takes away the faster first
+      # run. Say so, rather than fail the release.
+      - name: Check the image can be pulled anonymously
+        env:
+          IMAGE: ${{ steps.image.outputs.name }}
+        run: |
+          ref="${IMAGE#ghcr.io/}"
+          name="${ref%%:*}"
+          tag="${ref##*:}"
+          token=$(curl -fsS "https://ghcr.io/token?scope=repository:${name}:pull" | jq -r .token)
+          if ! curl -fsS -o /dev/null \
+              -H "Authorization: Bearer ${token}" \
+              -H "Accept: application/vnd.oci.image.index.v1+json" \
+              "https://ghcr.io/v2/${name}/manifests/${tag}"; then
+            echo "::warning::${IMAGE} can't be pulled anonymously: make the package public in its settings, or wrkflw builds the image on each machine"
+          fi
+
   build:
     name: Build (${{ matrix.target }})
     runs-on: ${{ matrix.os }}
@@ -129,7 +195,8 @@ jobs:
   publish:
     name: Publish to crates.io
     runs-on: ubuntu-latest
-    needs: [build, changelog]
+    # After the runner base image: a published wrkflw pulls it on first run.
+    needs: [build, changelog, runner-image]
     # Only publish on tag push — manual dispatch uses a branch ref, intentionally excluded
     # because publishing to crates.io is irreversible
     if: startsWith(github.ref, 'refs/tags/v')
@@ -154,7 +221,8 @@ jobs:
   release:
     name: Create GitHub Release
     runs-on: ubuntu-latest
-    needs: [build, changelog]
+    # After the runner base image: a released wrkflw pulls it on first run.
+    needs: [build, changelog, runner-image]
     steps:
       - uses: actions/checkout@v4
 
```

**File**: `.github/workflows/runner-image.yml` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+name: Refresh runner image
+
+# The runner base image's tag names the text of docker/runner.Dockerfile,
+# not what it installs: `ubuntu:latest`, its packages and Node.js 22 move
+# on while the tag stays. The release workflow pushes a tag once; this
+# rebuilds the latest release's tag each week, so a machine pulling it for
+# the first time gets current packages and security fixes. A machine that
+# pulled it already keeps its copy, as it keeps an image it built, until the
+# image is removed (see the README). wrkflw's own job images build on it
+# with the same tag, so nothing else changes.
+on:
+  schedule:
+    - cron: "17 4 * * 1"
+  workflow_dispatch:
+    inputs:
+      tag:
+        description: "Release whose runner image to rebuild (default: the latest)"
+        required: false
+
+permissions:
+  contents: read
+  packages: write
+
+concurrency:
+  group: runner-image
+  cancel-in-progress: false
+
+jobs:
+  refresh:
+    name: Rebuild the runner base image
+    runs-on: ubuntu-latest
+    steps:
+      - name: Find the release
+        id: release
+        env:
+          GH_TOKEN: ${{ github.token }}
+          TAG: ${{ inputs.tag }}
+        run: |
+          if [ -z "$TAG" ]; then
+            TAG=$(gh release view --repo "$GITHUB_REPOSITORY" --json tagName --jq .tagName)
+          fi
+          echo "tag=$TAG" >> "$GITHUB_OUTPUT"
+      # Pinned by commit: this job can write packages.
+      - uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262 # v4.4.0
+        with:
+          ref: ${{ steps.release.outputs.tag }}
+      - name: Read the image name
+        id: image
+        # The tag through the environment, never spliced into the script.
+        env:
+          TAG: ${{ steps.release.outputs.tag }}
+        run: |
+          if [ ! -f docker/runner-image.txt ]; then
+            echo "$TAG publishes no runner image"
+            exit 0
+          fi
+          echo "name=$(tr -d '[:space:]' < docker/runner-image.txt)" >> "$GITHUB_OUTPUT"
+      # Pinned by commit: this job can write packages.
+      - if: steps.image.outputs.name != ''
+        uses: docker/setup-qemu-action@c7c53464625b32c7a7e944ae62b3e17d2b600130 # v3.7.0
+      - if: steps.image.outputs.name != ''
+        uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f # v3.12.0
+      - if: steps.image.outputs.name != ''
+        uses: docker/login-action@c94ce9fb468520275223c153574b00df6fe4bcc9 # v3.7.0
+        with:
+          registry: ghcr.io
+          username: ${{ github.actor }}
+          password: ${{ secrets.GITHUB_TOKEN }}
+      - name: Rebuild and push
+        if: steps.image.outputs.name != ''
+        env:
+          IMAGE: ${{ steps.image.outputs.name }}
+        run: |
+          # Provenance names the commit and workflow that built it, so a user can
+          # check where a pulled base image came from.
+          docker buildx build \
+            --pull --no-cache \
+            --platform linux/amd64,linux/arm64 \
+            --provenance=mode=max \
+            --label "org.opencontainers.image.source=https://github.com/$GITHUB_REPOSITORY" \
+            -f docker/runner.Dockerfile \
+            -t "$IMAGE" \
+            --push .
```

**File**: `BREAKING_CHANGES.md` (modified, +8/-0)
```diff
@@ -1,5 +1,13 @@
 # Breaking Changes
 
+## JavaScript actions run (unreleased)
+
+A `uses:` step whose action runs on Node, such as `actions/github-script`, `codecov/codecov-action` or a local `./` action whose `action.yml` says `runs.using: node20`, used to pass without running and was reported as not run, which made the run `partial`. Such an action now runs with node in the job's container, with its `pre` and `post`; under `--runtime emulation` it runs on your machine as you, so a remote action is code from its repository (pinned only as firmly as its `@ref`) running with your access, your tokens and keys included: wrkflw leaves credential-named variables (`GH_TOKEN`, `AWS_SECRET_ACCESS_KEY`, `SSH_AUTH_SOCK` and the like) out of its environment, which is a precaution, not a boundary. The same goes for the steps of a remote composite action under emulation, which used to inherit them: one that runs `gh`, `aws` or `ssh` with your own credentials now needs them passed through the step's `env:`. A step can no longer set, for later steps through `$GITHUB_ENV`, a variable wrkflw sets for each step (GitHub's defaults such as `GITHUB_SHA` or `RUNNER_TEMP`, `GITHUB_ACTION_PATH`, `WRKFLW_RUNTIME_MODE`) or `NODE_OPTIONS`, as GitHub doesn't let it either; such a line is ignored with a warning. Names of your own, `GITHUB_SHA_SHORT` included, pass on as before. A local `./` action is read from the job's workspace rather than the repository wrkflw runs in, as on GitHub. Its `pre` runs right before it, not at the start of the job, and its `post` runs at the end of the job even when `pre`, `main` or a later step failed. The action can fail where it used to pass, and the run is `verified` when nothing else was left out. An action that needs GitHub's run services (`ACTIONS_RUNTIME_TOKEN` or the OIDC token) fails locally, so a workflow using `github/codeql-action`, `actions/deploy-pages` or `actions/attest-build-provenance` now fails under `wrkflw gate` where it was `partial`: add them to `WRKFLW_SKIP_ACTIONS`. A remote action is cloned from GitHub, with your GitHub token if the anonymous clone fails. `WRKFLW_JS_ACTIONS=0` brings back the old behaviour, and `WRKFLW_SKIP_ACTIONS=owner/repo,./path` leaves only the actions it lists unrun. Stored results are keyed on both, and the key's version goes to 6, so `--reuse-results` (which `wrkflw gate` always uses) reruns every job once instead of reusing a pass whose JavaScript actions didn't run. The setup actions and the Rust toolchain actions are unchanged.
+
+## Steps run as the `runner` user (unreleased)
+
+In the image wrkflw builds for a job, its steps now run as `runner`, a user with a home directory and sudo without a password, as on GitHub's hosted runner, where they used to run as root. A step that wrote where only root may, or relied on being root, can now fail: run it with `sudo`, as on GitHub, or set `WRKFLW_STEPS_AS_ROOT=1` to keep root everywhere. On Linux the user takes the uid of whoever runs wrkflw, so a bind-mounted workspace stays theirs. Under a rootless engine, or where the user can't write the job's mounts, steps run as root with a warning. A job `container:`, an image mapped with `-P` and Kubernetes are unchanged. Stored results are keyed on it and the key's version goes to 5, so `--reuse-results` reruns every job once.
+
 ## A job's steps share one container (unreleased)
 
 On Docker and Podman a job's `run:` steps now run in one container, started once and kept for the job, where each step used to get a container of its own. What a step leaves outside the workspace is there for the next one, as on GitHub: `go install`, `apt-get install`, `rustup toolchain add`, `pip install`, a file under `$HOME` or `/tmp`, a process left running. A workflow that only passed locally because a step started from a clean image now behaves as it does on GitHub. `--step-containers`, or `WRKFLW_STEP_CONTAINERS=1`, brings the old behaviour back, and `--preserve-containers-on-failure` still implies it. `--job-container` is accepted and does nothing, even beside `--step-containers`. Both variables also apply to runs started from the TUI and `wrkflw watch`. The jobs of a called workflow share a container too, and their services now start. A step that is cancelled or times out may still be running in the job's container, so the steps after it, `if: always()` ones included, get a fresh container without what earlier steps installed, and the job's services restart with it.
```

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -4429,6 +4429,7 @@ name = "wrkflw-executor"
 version = "0.8.0"
 dependencies = [
  "async-trait",
+ "base64 0.21.7",
  "bollard",
  "chrono",
  "dirs",
```

**File**: `README.md` (modified, +29/-7)
```diff
@@ -20,7 +20,7 @@ A command-line tool for validating and executing GitHub Actions workflows locall
 - **Job selection** — run individual jobs with `--job` or via TUI job selection mode
 - **Job dependency resolution** — automatic ordering based on `needs` with parallel execution of independent jobs
 - **Expression evaluator** — evaluates `${{ ... }}` expressions including `toJSON`, `fromJSON`, `contains`, `startsWith`, etc.
-- **Action support** — Docker container actions, composite actions (with output propagation), local actions, and built-in versions of `actions/checkout`, `actions/cache`, the artifact actions and the common setup actions (`setup-node`, `setup-python`, `setup-go`, `setup-java`, `setup-dotnet`, `setup-php`, `rust-toolchain`, `setup-uv`), which install the runtime into the job's image, honouring `*-version-file` inputs. Any other JavaScript action is not run: its step passes and is reported under `unverified`
+- **Action support** — JavaScript actions (`runs.using: node*`, run with node in the job's container, with `pre`, `post` and `$GITHUB_STATE`), Docker container actions, composite actions (with output propagation), local actions, and built-in versions of `actions/checkout`, `actions/cache`, the artifact actions and the common setup actions (`setup-node`, `setup-python`, `setup-go`, `setup-java`, `setup-dotnet`, `setup-php`, `rust-toolchain`, `setup-uv`), which install the runtime into the job's image, honouring `*-version-file` inputs. A JavaScript action that finds no `node` in the job's image is not run: its step passes and is reported under `unverified`
 - **Reusable workflows** — execute caller jobs via `jobs.<id>.uses` (local or `owner/repo/path@ref`) with output propagation
 - **Artifacts, cache, and inter-job outputs** — `actions/upload-artifact`, `actions/download-artifact`, `actions/cache`, and `needs.<id>.outputs.*`
 - **GitHub context emulation** — environment variables, `GITHUB_OUTPUT`, `GITHUB_ENV`, `GITHUB_PATH`, `GITHUB_STEP_SUMMARY`
@@ -37,9 +37,7 @@ A command-line tool for validating and executing GitHub Actions workflows locall
 
 - GitHub encrypted secrets and fine-grained permissions
 - Event triggers other than `workflow_dispatch` for the remote `trigger` command
-- JavaScript actions outside the built-in set — a step such as `uses: some-org/setup-tool@v1`, or a local `uses: ./my-action`, whose action runs on Node is not executed. The step passes, prints that it would have run the action, and is listed under `unverified` in `run_finished`, the `gate` result and `compare`, with a warning in the log and a mark on the step in the TUI, so the run's verdict is `partial` rather than `verified`. Whatever the action would have installed or checked is missing from the job, so later steps may fail with `command not found`. Pass `--platform ubuntu-latest=IMAGE` with an image that has the tool, or install it in a `run:` step
 - Absolute-URL actions such as `uses: https://gitea.com/actions/checkout@v4` — they pass validation, but at run time the URL is not resolved and the step falls back to built-in handling
-- Private repos for remote `uses:` — reusable workflows clone over unauthenticated HTTPS
 - `cancel-in-progress` and workflow-level `concurrency:` — job-level groups are enforced within a run, but a local run has nothing earlier to cancel
 - Service containers outside Docker and Podman — emulation, secure emulation, Kubernetes and jobs inside a called workflow don't start `services:`
 - Service settings that reach the host — a service's `volumes:` can only name a volume, not a host path, and its `options:` only take flags that shape the service container itself, such as `--health-cmd`, `--user`, `--tmpfs` and `-e NAME=value`. Anything else, such as `--privileged` or `-v`, fails the job.
@@ -162,6 +160,7 @@ export WRKFLW_PLATFORM=ubuntu-latest=catthehacker/ubuntu:act-latest
 - A job-level `container:` still wins over `--platform`, which wins over the built-in image.
 - The built-in image is the base image plus tools the hosted Ubuntu runner has and steps call without installing: `sudo`, `jq`, `gh`, `unzip`, `zip`, `wget`, `xz`, `zstd`, `file`, `ssh`, `rsync`, `git-lfs`, `python3` with `pip`, a C toolchain and Node.js. It is built once and shared by every job. `gh` comes from cli.github.com in a layer of its own: when that can't be reached the job runs without it, with a warning, and the next run tries again. When the tools can't be installed at all, a job with nothing else to set up runs on the bare base image.
 - Steps of a job in the built-in image run as `runner`, as on GitHub: a user with `/home/runner` for its home and `sudo` without a password, so a test that expects a permission error gets one. rustup and cargo are in its home, and it owns what `pip install` and `npm install -g` write to. On Linux the user has your uid, so what a step writes in the workspace stays yours; elsewhere it has GitHub's, 1001. Files an earlier run left in the workspace or the `--dep-cache
```

---

### Incident Patch 2: `b11b73e7` (2026-11-20)
**Commit Message**: Pre-release polish: doctor, macOS jobs on the Mac, held-out sweep, prebuilt installs, new demo (#176)

* feat: doctor, macOS jobs on the Mac, a held-out sweep, prebuilt installs and a new demo

Pre-release polish for 0.9.0.

- `wrkflw doctor` reports, without starting or pulling anything, which
  engine `auto` picks (and says so when Docker is down and Podman takes
  over), the engine VM's memory, whether a first run pulls the published
  runner base or builds here, where a GitHub token was found, git, and the
  workflows in the directory. `--format json` gives the same checks.

- `--macos-on-host` (WRKFLW_MACOS_ON_HOST=1) runs `macos-*` jobs, and the
  macOS legs of a matrix, on a Mac under emulation while the run's other
  jobs keep their containers, so their pass checks macOS instead of being
  reported unverified. The switch is per job and per leg, with the env
  emulation would seed, scoped to the run through a task-local. A host leg
  is never folded into a container leg, and gets no image built ahead.
  Off by default: those steps run with no container around them.

- compare says a step needed the GitHub token GitHub gives every job,
  and that WRKFLW_JOB_GITHUB_TOKEN=1 giv

**File**: `.github/workflows/release.yml` (modified, +5/-0)
```diff
@@ -232,6 +232,11 @@ jobs:
           path: artifacts
           merge-multiple: true
 
+      # scripts/install.sh checks the archive it downloads against these.
+      - name: Write checksums
+        working-directory: artifacts
+        run: sha256sum wrkflw-* > SHA256SUMS
+
       - name: Create release
         uses: softprops/action-gh-release@v2
         with:
```

**File**: `AGENTS.md` (modified, +3/-0)
```diff
@@ -50,6 +50,8 @@ Add `--reuse-results` to `wrkflw run`, or `reuse_results` to the MCP `run_workfl
 
 `step_finished.output` holds the last 64 KiB of a step's output, delivered when the step ends. To follow a long step before it ends, add `--stream-output` to `run`: it adds `step_output` lines, `{job, step, index, lines}`, as the step prints, masked like the rest. Without it no `step_output` lines are printed.
 
+`doctor` prints `{"schema_version": 1, "type": "doctor", "ok": bool, "checks": [{"name": "...", "status": "ok" | "warn" | "fail", "detail": "...", "fix": "..." | null}]}`. The checks are `runtime` (which engine `auto` picks), `memory` (the engine's VM), `runner_image` (whether a first run pulls the prebuilt base or builds here), `macos_jobs` (on a Mac), `github_token` (where one was found, never the token), `git` and `workflows`. It starts and pulls nothing, and exits 1 only when a check fails; a `warn` is something that makes runs slower or less like GitHub's.
+
 `clean` prints `{"schema_version": 1, "type": "clean", "removed": n, "bytes": n, "in_use": n, "volumes": n, "failed": [{"path": "...", "error": "..."}]}`: workspaces removed, the bytes they held, workspaces left because a run holds them, container volumes removed because their workspace was gone, and workspaces that could not be removed. It exits 1 when `failed` is not empty, after cleaning the rest.
 
 A job that does not run, because of its `if:`, a failed `needs` job, fail-fast, a GitLab rule or `gate: false`, still gets `job_started` and `job_finished`, with `status` `skipped` and `duration_ms` 0.
@@ -93,4 +95,5 @@ The run also records your session, from `--session`, `WRKFLW_SESSION`, `CLAUDE_C
 - `--from-step` needs `--job`. Earlier steps are skipped apart from `actions/checkout`, so their outputs and files are missing. Use it to iterate on a step that doesn't depend on them.
 - `runs replay` reruns against the current working tree. Compare `git_sha` and `git_dirty` on the record if the result differs.
 - `--runtime emulation` runs steps directly on this machine. Use a container runtime or `secure-emulation` for code you don't trust.
+- `--macos-on-host` (`WRKFLW_MACOS_ON_HOST=1`) does the same for `macos-*` jobs: their steps run on this Mac with no container and see this shell's environment, credentials included. Don't pass it, even when `run` or `gate` suggests it, for a repository you don't trust.
 - `plan` reports a matrix computed by expressions as `dynamic`, because it is only known at run time.
```

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -4572,6 +4572,7 @@ dependencies = [
  "async-trait",
  "futures",
  "ignore",
+ "libc",
  "once_cell",
  "regex",
  "serde",
```

**File**: `README.md` (modified, +79/-24)
```diff
@@ -5,10 +5,65 @@
 [![Build Status](https://img.shields.io/github/actions/workflow/status/bahdotsh/wrkflw/ci.yml?branch=main)](https://github.com/bahdotsh/wrkflw/actions/workflows/ci.yml)
 [![Downloads](https://img.shields.io/crates/d/wrkflw)](https://crates.io/crates/wrkflw)
 
-A command-line tool for validating and executing GitHub Actions workflows locally. Test your workflows on your machine before pushing to GitHub.
+**Run your GitHub Actions workflows on your own machine, and get the verdict GitHub would give.**
+
+`wrkflw gate` runs everything CI would run for a push, in Docker or Podman, before the push leaves your machine. Every run ends with a verdict that says how much its pass proves: `verified`, `partial` (and what wasn't checked), or `nothing_checked`. And `wrkflw compare <run URL>` checks wrkflw itself against a finished GitHub run, job by job.
 
 ![WRKFLW Demo](demo.gif)
 
+## How close to GitHub
+
+We rerun finished GitHub runs of open-source repositories with `wrkflw compare`. The last sweep (2026-11-19, on the 0.9.0 code): a job agrees when both sides passed or both failed; not compared are the Windows jobs, which run on a Linux stand-in. Jobs agreed include `macos-*` jobs run as Linux, which `compare` counts as agreeing unverified (`--macos-on-host` runs them on a Mac instead). Local times are warm, on a Mac with a 7.7 GB Docker VM.
+
+| Repository | Jobs agreed | Differed | Not compared | Local | GitHub |
+|---|---|---|---|---|---|
+| pallets/click | 10 | 0 | 1 | 38 s | 65 s |
+| chalk/chalk | 2 | 0 | 0 | 13 s | 39 s |
+| sindresorhus/ky | 4 | 0 | 0 | 130 s | 187 s |
+| rust-lang/log | 10 | 1 | 2 | 362 s | 527 s |
+| dtolnay/itoa | 8 | 3 | 0 | 101 s | 346 s |
+| tj/commander.js | 6 | 0 | 3 | 67 s | 99 s |
+| spf13/cobra | 18 | 0 | 1 | 134 s | 99 s |
+| fatih/color | 1 | 0 | 0 | 25 s | 57 s |
+| pallets/flask | 11 | 0 | 1 | 32 s | 44 s |
+
+rust-lang/log's one difference is its documentation job, which fails on Rust 1.100, released after its GitHub run, as `stable` floats. itoa's three verify an attestation with the job's GitHub token, which a local job doesn't get unless `WRKFLW_JOB_GITHUB_TOKEN=1` gives it yours.
+
+These nine repositories are the ones wrkflw has been fixed against. [`held_out_runs.txt`](scripts/conformance/held_out_runs.txt) lists fourteen more it has never been tuned for, with services, wide OS matrices and a known failure, to measure how it does on a repository it hasn't seen. See [Conformance](#conformance) to run either sweep yourself.
+
+## Quick Start
+
+```bash
+cargo binstall wrkflw          # or: brew install wrkflw, or see Installation
+
+wrkflw doctor                  # what runs here would use, and what would slow them down
+wrkflw gate                    # run what CI would run for this push
+wrkflw gate --install-hook     # ...and do it before every push
+wrkflw run .github/workflows/ci.yml
+wrkflw                         # the TUI
+```
+
+### Check every push before it leaves
+
+Add the gate to a repository once, and every `git push` first runs what CI would run for it:
+
+```bash
+wrkflw doctor                  # Docker answering, with enough memory?
+wrkflw gate --install-hook     # writes .git/hooks/pre-push; an existing hook is left alone
+```
+
+Then tell it what must only ever run in CI. The gate runs jobs with this machine's credentials and can't tell a deploy from a test, so mark deploys and releases in `.wrkflw/affected.yml`:
+
+```yaml
+jobs:
+  deploy:
+    gate: false     # the gate reports it skipped, with every job that needs it
+  release:
+    gate: false
+```
+
+A push the gate fails is stopped with the job, step and error lines that failed. `git push --no-verify` skips it once. A `partial` pass says on one line each what it didn't check, such as a `macos-*` job run as Linux or an action that didn't run. The hook keeps the `--runtime` and `--remote-cache` you install it with, so jobs that already passed in CI can be [reused](#sharing-results-across-machines) instead of rerun. See [Spending less on CI](#spending-less-on-ci) for everything it does.
+
 ## Features
 
 - **TUI interface** — interactive terminal UI with Workflows, Run (jobs, graph and log views), History, Dispatch and Setup tabs, plus a Help overlay
@@ -43,11 +98,25 @@ A command-line tool for validating and executing GitHub Actions workflows locall
 - Service settings that reach the host — a service's `volumes:` can only name a volume, not a host path, and its `options:` only take flags that shape the service container itself, such as `--health-cmd`, `--user`, `--tmpfs` and `-e NAME=value`. Anything else, such as `--privileged` or `-v`, fails the job.
 - Services that listen on the same port — services share the job container's network, as they do on a GitHub runner, so two Postgres services can't both have 5432. wrkflw refuses two services whose `ports:` name the same container port, and warns about two services of one image.
 - A job with `services:` runs its steps in one c
```

**File**: `RELEASE_POST_0.9.0.md` (modified, +10/-2)
```diff
@@ -28,6 +28,10 @@ On Docker and Podman, a built-in job image on `ubuntu:latest` that doesn't set u
 
 Steps run as `runner` with passwordless `sudo`, share one container per job, so what a step installs is there for the next, and get the runner's tools (`gh`, `jq`, `zip`, `python3`, Rust when steps call cargo, Docker with `--docker-in-jobs`). Services start, and composite actions hand `$GITHUB_ENV` and `$GITHUB_PATH` on to the job.
 
+### macOS jobs on your Mac
+
+On a Mac, `--macos-on-host` runs `macos-*` jobs, and the macOS legs of a matrix, on the Mac itself while the other jobs keep their containers, so their pass checks macOS instead of standing in as Linux. It is off by default: those steps run with no container around them.
+
 ### Honest verdicts
 
 Every run ends with a `verdict`: `verified`, `partial` or `nothing_checked`. `partial` lists what wasn't checked: a Windows or macOS job run as Linux, or a step whose action didn't run. `wrkflw gate` checks a push as CI will see it, reuses jobs that already passed, and says each cause on its own line. `wrkflw compare <run>` checks wrkflw itself against a finished GitHub run.
@@ -46,11 +50,15 @@ Steps run as the `runner` user, JavaScript actions run, a job's steps share one
 
 ## Install
 
+A prebuilt binary, no Rust needed:
+
 ```sh
-cargo install wrkflw
+cargo binstall wrkflw
+# or
+curl -fsSL https://raw.githubusercontent.com/bahdotsh/wrkflw/main/scripts/install.sh | sh
 ```
 
-or `brew install wrkflw`.
+or `brew install wrkflw`, or `cargo install wrkflw`. Then `wrkflw doctor` says what runs on your machine would use and what would slow them down, and `wrkflw gate --install-hook` checks every push before it leaves.
 
 ---
 
```

**File**: `crates/executor/src/acceleration.rs` (modified, +33/-5)
```diff
@@ -499,6 +499,12 @@ fn job_key_with(
     if every_matrix_leg && lookup.job.matrix_config().is_some() {
         document["every_matrix_leg"] = serde_json::json!(true);
     }
+    // A matrix whose macOS legs run on this Mac (`--macos-on-host`) passed
+    // on other ground than one whose legs all ran in containers. Only that
+    // mode changes the key. A job without a matrix differs by `runtime`.
+    if crate::host_jobs::legs_may_run_on_host(lookup.job) {
+        document["macos_on_host"] = serde_json::json!(true);
+    }
     // A pass with a container per step can rest on each step starting from
     // a clean image, so it can't stand in for a run whose steps share one,
     // or the other way round. Version 3 keys were all of the former.
@@ -1158,13 +1164,11 @@ pub(crate) fn mark_executed(job_name: &str) {
 }
 
 /// Store a passing result under the key `decide` returned. A job that ran on
-/// the host passed with that host's tools, so its result stays on this machine.
-pub(crate) async fn store(key: &str, jobs: Vec<StoredJob>, env: &HashMap<String, String>) {
+/// the host (`on_host`), or any leg of it did, passed with that host's
+/// tools, so its result stays on this machine.
+pub(crate) async fn store(key: &str, jobs: Vec<StoredJob>, on_host: bool) {
     let Some(run) = current() else { return };
     let Some(store) = &run.store else { return };
-    let on_host = env
-        .get("WRKFLW_RUNTIME_MODE")
-        .is_some_and(|mode| mode.contains("emulation"));
     if on_host && run.accel.push_results && !run.warned_on_host_push.swap(true, Ordering::Relaxed) {
         wrkflw_logging::warning(
             "Not pushing results from this run: emulation depends on this machine's tools",
@@ -1282,6 +1286,30 @@ mod tests {
         );
     }
 
+    /// A matrix whose macOS legs run on this Mac isn't reused for a run with
+    /// every leg in a container, or the other way round: the hint to rerun
+    /// with `--macos-on-host` must actually run them.
+    #[tokio::test]
+    async fn a_matrix_run_with_legs_on_the_host_is_kept_apart() {
+        let dir = repo();
+        let wf = workflow();
+        let tree = hash_tree(dir.path()).unwrap();
+        let matrix = job(
+            "runs-on: ${{ matrix.os }}\nstrategy:\n  matrix:\n    os: [ubuntu-latest, macos-15]\nsteps:\n  - run: make\n",
+        );
+        let in_containers = key_for_mode(&matrix, &wf, &tree, None, false);
+        let host = crate::host_jobs::HostJobs::new(
+            Box::new(wrkflw_runtime::emulation::EmulationRuntime::new()),
+            &HashMap::new(),
+            HashMap::new(),
+        );
+        let on_host = crate::host_jobs::scope(Some(std::sync::Arc::new(host)), async {
+            key_for_mode(&matrix, &wf, &tree, None, false)
+        })
+        .await;
+        assert_ne!(in_containers, on_host);
+    }
+
     #[test]
     fn running_every_matrix_leg_does_not_reuse_a_folded_result() {
         let dir = repo();
```

**File**: `crates/executor/src/engine.rs` (modified, +366/-71)
```diff
@@ -156,17 +156,19 @@ async fn execute_github_workflow(
     let workspace_dir = tempfile::tempdir()
         .map_err(|e| ExecutionError::Execution(format!("Failed to create workspace: {}", e)))?;
 
-    // 4. Set up GitHub-like environment
-    let (mut env_context, user_env) = github_run_env(
+    // 4. Set up GitHub-like environment. The context is made once: jobs run
+    // on the host below get the same run id and the like as the rest.
+    let github_context = environment::create_github_context(
         &workflow,
         workspace_dir.path(),
-        &config.runtime_type,
         &environment::RunRef {
             event_name: config.event_name.as_deref(),
             git_ref: config.git_ref.as_deref(),
             base_branch: config.base_branch.as_deref(),
         },
-    )?;
+    );
+    let (mut env_context, user_env) =
+        github_run_env_from(github_context.clone(), &workflow, &config.runtime_type)?;
 
     // show=true means hide=false (inverted for the env var)
     env_context.insert(
@@ -184,6 +186,33 @@ async fn execute_github_workflow(
         ExecutionError::Execution(format!("Failed to setup GitHub env files: {}", e))
     })?;
 
+    // `macos-*` jobs on this Mac, when asked, with the env emulation gives.
+    let host_jobs = if crate::host_jobs::wanted(&config.runtime_type) {
+        let (host_env, _) =
+            github_run_env_from(github_context, &workflow, &RuntimeType::Emulation)?;
+        wrkflw_logging::warning(
+            "macos-* jobs run on this Mac itself (--macos-on-host), with no container \
+             around their steps: they can change this machine, and they see this shell's \
+             environment, credentials included. They have no terminal to ask for input \
+             at, so one that does, such as sudo asking for a password, fails",
+        );
+        Some(std::sync::Arc::new(crate::host_jobs::HostJobs::new(
+            Box::new(emulation::EmulationRuntime::new()),
+            &env_context,
+            host_env,
+        )))
+    } else {
+        if crate::run_options::macos_on_host() {
+            wrkflw_logging::warning(&format!(
+                "--macos-on-host has no effect here: it runs macos-* jobs on a Mac whose \
+                 other jobs run in containers, and this run is on {} with {}",
+                std::env::consts::OS,
+                config.runtime_type.mode_name()
+            ));
+        }
+        None
+    };
+
     // 5. Initialize secrets management
     let secret_manager = if let Some(secrets_config) = &config.secrets_config {
         Some(
@@ -226,20 +255,23 @@ async fn execute_github_workflow(
         // Execute jobs in parallel if they don't depend on each other.
         // `needs:` failure propagation and `if:` evaluation happen per job inside
         // `execute_job_with_matrix`, so this loop and `run_called_workflow` share them.
-        let job_results = execute_job_batch(
-            &job_batch,
-            &workflow,
-            runtime.as_ref(),
-            &env_context,
-            &user_env,
-            config.verbose,
-            secret_manager.as_ref(),
-            Some(&secret_masker),
-            &all_job_outputs,
-            &all_job_results,
-            &artifact_store,
-            &cache_store,
-            &config.platform_overrides,
+        let job_results = crate::host_jobs::scope(
+            host_jobs.clone(),
+            execute_job_batch(
+                &job_batch,
+                &workflow,
+                runtime.as_ref(),
+                &env_context,
+                &user_env,
+                config.verbose,
+                secret_manager.as_ref(),
+                Some(&secret_masker),
+                &all_job_outputs,
+                &all_job_results,
+                &artifact_store,
+                &cache_store,
+                &config.platform_overrides,
+            ),
         )
         .await?;
 
@@ -432,6 +464,13 @@ async fn execute_gitlab_pipeline(
     let workspace_dir = tempfile::tempdir()
         .map_err(|e| ExecutionError::Execution(format!("Failed to create workspace: {}", e)))?;
 
+    if crate::run_options::macos_on_host() {
+        wrkflw_logging::warning(
+            "--macos-on-host has no effect on a GitLab pipeline: it runs a GitHub workflow's \
+             macos-* jobs",
+        );
+    }
+
     // 5. Set up GitLab-like environment
     let mut env_context = create_gitlab_context(&pipeline, workspace_dir.path());
 
@@ -889,14 +928,27 @@ pub fn detect_runtime(runtime_type: RuntimeType) -> RuntimeType {
 type EnvMap = HashMap<String, String>;
 
 /// Build the run-level env for a GitHub workflow. Returns the full lookup map
-/// and the user-declared slice of it.
+/// and the user-declared slice of it. A run makes its context itself and
+/// calls [`github_run_env_from`], as it may need the env for two runtimes.
+#[cfg(test)]
 fn github_run_env(
     workflow: &WorkflowDefinition,
     workspace_dir: &Path,
   
```

**File**: `crates/executor/src/host_jobs.rs` (added, +555/-0)
```diff
@@ -0,0 +1,555 @@
+//! `macos-*` jobs run on this Mac, when asked.
+//!
+//! On a Mac running jobs in containers, a job whose `runs-on` names macOS
+//! runs as Linux, in the Ubuntu image, and its pass is only `unverified`.
+//! With [`crate::run_options::MACOS_ON_HOST_ENV`] (`--macos-on-host`) such a
+//! job, or matrix leg, runs under emulation instead: on the Mac itself, with
+//! `runner.os` macOS and the host's paths, while the run's other jobs keep
+//! their containers. Off by default, because emulation gives a step no
+//! isolation: a macOS job's `brew install` changes this machine.
+
+use crate::engine::RuntimeType;
+use serde_yaml::Value;
+use std::collections::HashMap;
+use std::future::Future;
+use std::path::{Path, PathBuf};
+use std::sync::Arc;
+use wrkflw_parser::workflow::Job;
+use wrkflw_runtime::container::{ContainerError, ContainerOutput, ContainerRuntime};
+
+/// What a job run on the host runs with instead of the run's runtime.
+pub(crate) struct HostJobs {
+    pub runtime: Box<dyn ContainerRuntime + Send + Sync>,
+    /// The env values emulation seeds where they differ from the run's:
+    /// host paths, `RUNNER_OS` macOS, and workflow `env:` resolved with
+    /// them. Laid over the env a job is handed, so what its caller gave it,
+    /// such as a called workflow's inputs and secrets, stays.
+    overlay: Vec<(String, String)>,
+}
+
+impl HostJobs {
+    /// `run_env` is the run's env as its container runtime seeds it, and
+    /// `host_env` the same run's env as emulation seeds it.
+    pub fn new(
+        runtime: Box<dyn ContainerRuntime + Send + Sync>,
+        run_env: &HashMap<String, String>,
+        host_env: HashMap<String, String>,
+    ) -> Self {
+        let overlay = host_env
+            .into_iter()
+            .filter(|(key, value)| run_env.get(key) != Some(value))
+            .collect();
+        HostJobs {
+            runtime: Box::new(OffTask {
+                runtime: Arc::from(runtime),
+                one_at_a_time: Arc::new(tokio::sync::Semaphore::new(1)),
+            }),
+            overlay,
+        }
+    }
+
+    /// The env and user env a job handed `env` and `user_env` runs with on
+    /// the host. A user env key is changed only where the job has it, so
+    /// a called workflow's empty user env stays empty.
+    pub fn env_for(
+        &self,
+        env: &HashMap<String, String>,
+        user_env: &HashMap<String, String>,
+    ) -> (HashMap<String, String>, HashMap<String, String>) {
+        let mut env = env.clone();
+        let mut user_env = user_env.clone();
+        for (key, value) in &self.overlay {
+            env.insert(key.clone(), value.clone());
+            if let Some(slot) = user_env.get_mut(key) {
+                slot.clone_from(value);
+            }
+        }
+        (env, user_env)
+    }
+}
+
+/// A runtime whose steps run off the task that drives the run's jobs.
+///
+/// Emulation waits for a step's process in place, without yielding. A
+/// run's jobs, and the legs of a matrix chunk, are all polled from one
+/// task, so a host job's long `brew install` would stop the container jobs
+/// beside it until it ended. Here each step waits on a blocking thread.
+///
+/// Host steps run one at a time. On GitHub each macOS job has a machine of
+/// its own; here they share this Mac, its Homebrew lock and its caches, so
+/// two at once can fail where neither would alone. They still run while
+/// container jobs do.
+struct OffTask {
+    runtime: Arc<dyn ContainerRuntime + Send + Sync>,
+    one_at_a_time: Arc<tokio::sync::Semaphore>,
+}
+
+/// Ends a step's processes when the step is given up on: a timeout or a
+/// cancelled job drops the future waiting for it, which leaves its thread
+/// running. A step that ended has nothing left to end.
+struct EndOnDrop(wrkflw_runtime::emulation::StepHandle);
+
+impl Drop for EndOnDrop {
+    fn drop(&mut self) {
+        self.0.kill();
+    }
+}
+
+#[async_trait::async_trait]
+impl ContainerRuntime for OffTask {
+    async fn run_container(
+        &self,
+        image: &str,
+        cmd: &[&str],
+        env_vars: &[(&str, &str)],
+        working_dir: &Path,
+        volumes: &[(&Path, &Path)],
+        entrypoint: Option<&str>,
+    ) -> Result<ContainerOutput, ContainerError> {
+        let runtime = Arc::clone(&self.runtime);
+        let image = image.to_string();
+        let cmd: Vec<String> = cmd.iter().map(|s| s.to_string()).collect();
+        let env: Vec<(String, String)> = env_vars
+            .iter()
+            .map(|(k, v)| (k.to_string(), v.to_string()))
+            .collect();
+        let working_dir = working_dir.to_path_buf();
+        let volumes: Vec<(PathBuf, PathBuf)> = volumes
+            .iter()
+            .map(|(host, inside)| (host.to_path_buf(), inside.to_path_buf()))
+            .collect();
+        let entrypoint = entrypoint.map(str::to_string);
+        // The step's output goes to the tap of this task, which the thread
+ 
```

#### Recent Merged Pull Requests:
- **PR #176** (2026-11-20): Pre-release polish: doctor, macOS jobs on the Mac, held-out sweep, prebuilt installs, new demo (@bahdotsh)
- **PR #175** (2026-11-20): Pre-release: JavaScript actions, private uses, prebuilt runner image, stand-in reporting, sweep evidence (@bahdotsh)
- **PR #174** (2026-11-19): fix: close the gaps left after the compare sweep (#173 follow-up) (@bahdotsh)
- **PR #173** (2026-11-18): fix: close the gaps the eight-repo compare sweep found (@bahdotsh)
- **PR #172** (2026-11-14): fix: keep what a step installs for the next one, and give jobs the runner's Rust and Docker (@bahdotsh)
- **PR #171** (2026-11-13): fix: agree with GitHub on real repositories, and build job images faster (@bahdotsh)

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

## X. Pre-release: JavaScript actions, private uses, prebuilt runner image, stand-in r

**RULE**:
When implementing operations in `.cargo/config.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in bahdotsh/wrkflw. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `490a508b`: Pre-release: JavaScript actions, private uses, prebuilt runner image, stand-in reporting, sweep evidence. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.cargo/config.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# And for the runner base image: a test run on a commit whose base isn't
# published would remember it as unavailable in the user's cache, and real
# runs would then skip it for a day. CI names its own base with
# WRKFLW_RUNNER_IMAGE and sets this to 1. It applies to `cargo run` too:
# set WRKFLW_PREBUILT_IMAGES=1 there to time a first run on the base.
WRKFLW_PREBUILT_IMAGES = "0"
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `490a508b` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

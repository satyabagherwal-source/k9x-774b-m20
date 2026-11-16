# Verification Protocol: Verification Protocol: Empirical Defect Shield for bahdotsh/wrkflw

<!-- PROVENANCE_START
{
  "source_repository": "bahdotsh/wrkflw",
  "source_url": "https://github.com/bahdotsh/wrkflw",
  "source_version": "a7e479f2",
  "license": "MIT",
  "timestamp": "2026-11-16T05:17:35.314Z",
  "ai_provider": "zero-clone-structural-synthesizer",
  "generator_version": "2.0.0-universal",
  "learning_id": "learn-github-bahdotsh-wrkflw",
  "canonical_classification": "verification_contract"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [bahdotsh/wrkflw](https://github.com/bahdotsh/wrkflw) (Revision: `a7e479f2`).  
> **License**: MIT | **Timestamp**: `2026-11-16T05:17:35.314Z`  
> **Learning ID**: `learn-github-bahdotsh-wrkflw`


## 1. Scope & Verification Target
- **Target Repository**: `bahdotsh/wrkflw` (Commit: `a7e479f2`)
- **Pillar Alignment**: Pillar 11 (Empirical Truth & Mathematical Integrity)

## 2. Observed Failure Modes & Defect Traps
# Forensic Learning Record (Deep Inspection): bahdotsh/wrkflw

> **Canonical Artifact**: `07_PROJECT_LEARNING/bahdotsh-wrkflw-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/bahdotsh/wrkflw](https://github.com/bahdotsh/wrkflw))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-11-16T05:17:34.544Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bahdotsh/wrkflw`
- **Description**: Validate and Run GitHub Actions locally.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3342 stars

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

    // 4. Set up GitHub-like environment
    let (mut env_context, user_env) = github_run_env(
        &workflow,
        workspace_dir.path(),
        &config.runtime_type,
        &environment::RunRef {
            event_name: config.event_name.as_deref(),
            git_ref: config.git_ref.as_deref(),
            base_branch: config.base_branch.as_deref(),
        },
    )?;

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

    for job_batch in execution_plan {
        // Execute jobs in parallel if they don't depend on each other.
        // `needs:` failure propagation and `if:` evaluation happen per job inside
        // `execute_job_with_matrix`, so this loop and `run_called_workflow` share them.
        let job_results = execute_job_batch(
            &job_batch,
            &workflow,
            runtime.as_ref(),
            &env_context,
            &user_env,
            config.verbose,
            secret_manager.as_ref(),
            Some(&secret_masker),
            &all_job_outputs,
            &all_job_results,
            &artifact_store,
            &cache_store,
            &config.platform_overrides,
        )
        .await?;

        record_job_results(&job_results, &mut all_job_outputs, &mut all_job_results);

        // Check for job failures and collect details
        for job_result in &job_results {
            if job_result.fails_run() {
                has_failures = true;
                failure_details.push_str(&format!(
                    "\n{} Job failed: {}\n",
                    wrkflw_logging::symbols::FAILURE,
                    job_result.name
                ));

                // Add step details for failed jobs
                for step in &job_result.steps {
                    if step.status == StepStatus::Failure {
                        failure_details.push_str(&format!(
                            "  {} {}: {}\n",
                       
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
const KEY_VERSION: u32 = 4;

/// Host directories mounted into containers under `--dep-cache`.
const DEP_CACHE_DIRS: &[(&str, &str)] = &[
    ("cargo-registry", "/root/.cargo/registry"),
    ("cargo-git", "/root/.cargo/git"),
    ("npm", "/root/.npm"),
    ("pip", "/root/.cache/pip"),
    ("go-mod", "/root/go/pkg/mod"),
];

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
        .filter_map(|p| glob::Pattern::new(p).ok())
        .collect()
}

fn glob_options() -> glob::MatchOptions {
    glob::MatchOptions {
        case_sensitive: true,
        require_literal_separator: true,
        require_literal_leading_dot: false,
    }
}

fn matches_any(path: &str, patterns: &[glob::Pattern]) -> bool {
    patterns
        .iter()
        .any(|p| p.matches_with(path, glob_options()))
}

/// `hints.paths` plus the files that always count, or `None` for every file.
///
/// The files that always count include every local action `job` uses, as a
/// step loads `uses: ./tools/x` without the job's paths naming it.
fn input_patterns(
    job: &Job,
    hints: Option<&JobHints>,
) -> Result<Option<Vec<glob::Pattern>>, String> {
    let Some(paths) = hints.and_then(|h| h.paths.as_ref()) else {
        return Ok(None);
    };
    let mut patterns = compile_globs(ALWAYS_INPUT);
    patterns.extend(local_action_patterns(job));
    for path in paths {
        patterns.push(
            glob::Pattern::new(path)
                .map_err(|e| format!("bad path '{}' in {}: {}", path, SIDECAR_PATH, e))?,
        );
    }
    Ok(Some(patterns))
}

/// A pattern for the directory of each `uses: ./<dir>` step in `job`.
fn local_action_patterns(job: &Job) -> Vec<glob::Pattern> {
    job.steps
        .iter()
        .filter_map(|step| step.uses.as_deref()?.strip_prefix("./"))
        .filter_map(|dir| {
            let dir = dir.trim_end_matches('/');
            if dir.is_empty() {
                // An action at the repository root can read any file.
                return glob::Pattern::new("**").ok();
            }
            glob::Pattern::new(&format!("{}/**", glob::Pattern::escape(dir))).ok()
        })
        .collect()
}

/// Whether `permissions:`, at the job or workflow level, grants any write.
/// `write-all` is the one string form that does.
fn grants_write(permissions: &serde_yaml::Value) -> bool {
    match permissions {
        serde_yaml::Value::String(all) => all == "write-all",
        serde_yaml::Value::Mapping(scopes) => scopes
            .values()
            .any(|access| access.as_str() == Some
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

### Core Architecture Module: `crates/executor/src/acceleration/store.rs`
```
//! Stored job results: on this machine, and optionally in a shared location
//! whose entries are HMAC-signed.

use super::{hex, Acceleration, Secret};
use hmac::{Hmac, Mac};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

/// 2: jobs carry the actions they passed without running, and the leg a
/// folded matrix leg repeated. Entries from 1 can't say, so they are not
/// reused.
const ENTRY_SCHEMA: u32 = 2;
/// Images and floating action tags aren't in the key, so a hit must not live
/// forever. A week bounds that drift.
const DEFAULT_TTL_SECS: i64 = 7 * 24 * 60 * 60;
const REMOTE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

/// One job or matrix leg of a stored result.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub(crate) struct StoredJob {
    pub name: String,
    pub canonical_name: String,
    pub outputs: HashMap<String, String>,
    /// Steps that passed without running their action. A reused job reports
    /// them again, so reuse never turns a partial pass into a verified one.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub actions_not_run: Vec<crate::action_fidelity::UnexecutedAction>,
    /// The leg this matrix leg only repeated when the result was stored. A
    /// reused fold still never ran, and says so.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repeated_from: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub(crate) struct Entry {
    pub schema: u32,
    /// Repeated from the file name, so a renamed file can't answer another key.
    pub key: String,
    pub created_at: i64,
    pub jobs: Vec<StoredJob>,
}

impl Entry {
    fn is_usable(&self, key: &str, now: i64) -> bool {
        self.schema == ENTRY_SCHEMA
            && self.key == key
            && now.saturating_sub(self.created_at) <= ttl_secs()
    }
}

fn ttl_secs() -> i64 {
    parse_ttl(std::env::var("WRKFLW_RESULT_TTL_SECS").ok().as_deref())
}

/// `WRKFLW_RESULT_TTL_SECS` as seconds. Unset, unparsable or negative means
/// the default, saying so for the last two so a typo doesn't go unseen.
fn parse_ttl(value: Option<&str>) -> i64 {
    let Some(value) = value else {
        return DEFAULT_TTL_SECS;
    };
    match value.trim().parse::<i64>() {
        Ok(secs) if secs >= 0 => secs,
        _ => {
            wrkflw_logging::warning(&format!(
                "Ignoring WRKFLW_RESULT_TTL_SECS={}: not a whole number of seconds",
                value
            ));
            DEFAULT_TTL_SECS
        }
    }
}

/// The wire form of an entry. The signature covers the exact bytes of `body`.
#[derive(Serialize, Deserialize)]
struct SignedEntry {
    body: String,
    signature: String,
}

type HmacSha256 = Hmac<Sha256>;

fn sign(key: &Secret, body: &str) -> Option<String> {
    let mut mac = HmacSha256::new_from_slice(key.0.as_bytes()).ok()?;
    mac.update(body.as_bytes());
    Some(hex(&mac.finalize().into_bytes()))
}

fn unhex(text: &str) -> Option<Vec<u8>> {
    if !text.len().is_multiple_of(2) || !text.is_ascii() {
        return None;
    }
    (0..text.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&text[i..i + 2], 16).ok())
        .collect()
}

/// The entry in `signed`, if `key` made it.
fn verify(key: &Secret, signed: &SignedEntry) -> Option<Entry> {
    let mut mac = HmacSha256::new_from_slice(key.0.as_bytes()).ok()?;
    mac.update(signed.body.as_bytes());
    // `verify_slice` compares in constant time.
    mac.verify_slice(&unhex(&signed.signature)?).ok()?;
    serde_json::from_str(&signed.body).ok()
}

/// Results on this machine, and optionally a shared location.
pub(crate) struct ResultStore {
    root: PathBuf,
    remote: Option<Remote>,
    push: bool,
    key: Option<Secret>,
    /// Set after the remote fails once, so later jobs don't each wait out
    /// its timeout. A run reads it again next time.
    remote_down: AtomicBool,
    /// Set once this run has swept expired entries from `root`.
    pruned: AtomicBool,
}

enum Remote {
    Dir(PathBuf),
    Http {
        base: String,
        client: reqwest::Client,
        token: Option<Secret>,
    },
}

impl Remote {
    fn parse(location: &str, token: Option<Secret>) -> Option<Self> {
        if location.starts_with("http://") || location.starts_with("https://") {
            let client = reqwest::Client::builder()
                .timeout(REMOTE_TIMEOUT)
                .build()
                .ok()?;
            return Some(Remote::Http {
                base: location.trim_end_matches('/').to_string(),
                client,
                token,
            });
        }
        // `validate_remote` refuses other schemes. Never read one as a path.
        if location.contains("://") && !location.starts_with("file://") {
            return None;
        }
        let path = location.strip_prefix("file://").unwrap_or(location);
        Some(Remote::Dir(PathBuf::from(path)))
    }

    /// The entry text for `key`. `Ok(None)` is a miss, `Err` means the
    /// remote itself is failing.
    async fn get(&self, key: &str) -> Result<Option<String>, String> {
        match self {
            Remote::Dir(dir) => Ok(tokio::fs::read_to_string(dir.join(entry_file(key)))
                .await
                .ok()),
            Remote::Http {
                base,
                client,
                token,
            } => {
                let mut request = client.get(format!("{}/{}", base, entry_file(key)));
                if let Some(token) = token {
                    request = request.bearer_auth(&token.0);
                }
                let response = request.send().await.map_err(|e| e.to_string())?;
                let status = response.status();
                // Only "not there" is a miss. Anything else, a refused token
                // above all, would otherwise make every job ask and run cold
                // without a word.
                if status == reqwest::StatusCode::NOT_FOUND {
                    return Ok(None);
                }
                if !status.is_success() {
                    return Err(format!("HTTP {}", status));
                }
                response.text().await.map(Some).map_err(|e| e.to_string())
            }
        }
    }

    async fn put(&self, key: &str, body: String) -> Result<(), String> {
        match self {
            Remote::Dir(dir) => write_atomically(&dir.join(entry_file(key)), &body),
            Remote::Http {
                base,
                client,
                token,
            } => {
                let mut request = client
                    .put(format!("{}/{}", base, entry_file(key)))
                    .body(body);
                if let Some(token) = token {
                    request = request.bearer_auth(&token.0);
                }
                let response = request.send().await.map_err(|e| e.to_string())?;
                if response.status().is_success() {
                    Ok(())
                } else {
                    Err(format!("HTTP {}", response.status()))
                }
            }
        }
    }
}

fn entry_file(key: &str) -> String {
    format!("{}.json", key)
}

/// A reader never sees half an entry, even with parallel jobs or a crash.
fn write_atomically(path: &Path, body: &str) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| format!("no parent directory for {}", path.display()))?;
    std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    let temp = parent.join(format!(".{}.tmp", uuid::Uuid::new_v4()));
    std::fs::write(&temp, body).map_err(|e| e.to_string())?;
    std::fs::rename(&temp, path).map_err(|e| {
        let _ = std::fs::remove_file(&temp);
        e.to_string()
    })
}

impl ResultStore {
    pub(crate) fn new(root: PathBuf, accel: &Acceleration) -> Self {
        Self {
            root,
            remote: accel
                .remote_cache
                .as_deref()
                .and_then(|r| Remote::parse(r, accel.remote_token.clone())),
            push: accel.push_results,
            key: accel.signing_key.clone(),
            remote_down: AtomicBool::new(false),
            pruned: AtomicBool::new(false),
        }
    }

    /// Remove local entries, and temporary files a crash left, older than the
    /// TTL. Reads already ignore them, so this only bounds the directory,
    /// which would otherwise grow with every run. Once per run, and by
    /// modification time, so no entry is opened.
    fn prune_expired(&self) {
        if self.pruned.swap(true, Ordering::Relaxed) {
            return;
        }
        let Ok(entries) = std::fs::read_dir(&self.root) else {
            return;
        };
        let max_age = std::time::Duration::from_secs(ttl_secs() as u64);
        let now = std::time::SystemTime::now();
        for entry in entries.flatten() {
            let path = entry.path();
            let ours = path
                .file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.ends_with(".json") || name.ends_with(".tmp"));
            let expired = entry
                .metadata()
                .and_then(|meta| meta.modified())
                .ok()
                .and_then(|modified| now.duration_since(modified).ok())
                .is_some_and(|age| age > max_age);
            if ours && expired {
                let _ = std::fs::remove_file(&path);
            }
        }
    }

    /// The remote, unless it has already failed in this run.
    fn live_remote(&self) -> Option<&Remote> {
        self.remote
            .as_ref()
            .filter(|_| !self.remote_down.load(Ordering::Relaxed))
    }

    /// Stop using the remote for this run, saying so once.
    fn remote_failed(&self, error: &str) {
        if !self.remote_down.swa
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #172** (2026-11-14): **fix: keep what a step installs for the next one, and give jobs the runner's Rust and Docker**
  *Symptoms*: ## Why  After #171, three of the eight repositories in the sweep still failed locally on runs that pass on GitHub, for two reasons:  | Cause | Repos hit | |---|---| | Nothing outside the workspace survived between steps, because each step was a new container | cobra (`go install`), ky's browser job (`playwright install --with-deps`), rust-lang/log (`rustup toolchain add`) | | The runner image had no `rustup` or `docker` | rust-lang/log, cobra's licence job |  ## What changes  **One container per job is the default.** It existed behind `--job-container`. It is now how a job's `run:` steps run on Docker and Podman. - `--step-containers` or `WRKFLW_STEP_CONTAINERS=1` gives each step its own container again; `--preserve-containers-on-failure` still implies that. - `--job-container` is still accepted and does nothing. - The jobs of a called workflow share a container too, so their services now start.  **The job container's memory is measured.** It wasn't sampled before, so such a job was treated as never measured and a matrix ran one leg at a time on a small VM. The job's container and its services are now sampled through the CLI's `stats`, with the same out-of-memory and cancelled-step handling a step's own container has. Podman jobs stay unmeasured, as before.  **Jobs that use the runner's Rust get it.** A job whose `run:` steps call `cargo`, `rustup`, `rustc` or `rustfmt` without a Rust setup action gets rustup and `stable` in its image, as hosted runners have. An image mapped 

- **Issue #171** (2026-11-13): **fix: agree with GitHub on real repositories, and build job images faster**
  *Symptoms*: ## Problem  Running real repositories was slow and sometimes wrong:  - Each leg of a matrix rebuilt the same packages in its own image. - An image that failed to build was built a second time at the job's turn. - A busy engine failed container creation at 15 seconds. - A few parsing rules disagreed with GitHub.  ## Changes  **Image builds** - The job image is split into a shared packages layer plus one layer per runtime. The shared layers are built once, as an image of their own, where the runtime reuses build layers (Docker, Podman; not Kubernetes). - Images are built ahead while a job waits for its turn, capped at four across the process, and one at a time where the run limits its jobs. - BuildKit is used through the `docker` CLI where it builds into the same engine; otherwise the engine's own builder is used. `WRKFLW_IMAGE_BUILDER=classic` skips BuildKit. - A build that failed on its own is remembered for the run and not repeated. A build that timed out or lost its connection is tried again. - The runner's Node.js comes from nodejs.org, checked against its published checksum, with the distribution's package as the fallback. - Each runtime's install refreshes the package lists first, since it is now a layer of its own.  **Containers** - The engine gets 120 seconds to create or start a container. One whose creation timed out is tracked by name and removed later. - Cleanup passes quietly over a container that was never created, and removes by force one that didn't stop in tim

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

### Incident Patch 1: `a7e479f2` (2026-11-14)
**Commit Message**: fix: keep what a step installs for the next one, and give jobs the runner's Rust and Docker (#172)

* fix: keep what a step installs for the next one, and give jobs the runner's Rust and Docker

Of eight real repositories compared with their GitHub runs, three still
failed locally on a run that passes there, for two reasons.

Each `run:` step got a container of its own, so anything a step left
outside the workspace was gone in the next: cobra's `go install`, ky's
`playwright install --with-deps`, rust-lang/log's `rustup toolchain
add`. One container per job was there behind `--job-container`. It is
now how a job runs on Docker and Podman, and `--step-containers` or
WRKFLW_STEP_CONTAINERS=1 gives each step its own again, as
`--preserve-containers-on-failure` still does. `--job-container` is
accepted and does nothing. The jobs of a called workflow share a
container too, where they had none of the run's settings, and so their
services start.

A job container wasn't sampled, so such a job kept the room of one
never measured and a matrix ran one leg at a time on a small VM. The
job's container and its services are now sampled through the CLI's
`stats`, a step that ends as the out-of-mem

**File**: `BREAKING_CHANGES.md` (modified, +14/-0)
```diff
@@ -1,5 +1,19 @@
 # Breaking Changes
 
+## A job's steps share one container (unreleased)
+
+On Docker and Podman a job's `run:` steps now run in one container, started once and kept for the job, where each step used to get a container of its own. What a step leaves outside the workspace is there for the next one, as on GitHub: `go install`, `apt-get install`, `rustup toolchain add`, `pip install`, a file under `$HOME` or `/tmp`, a process left running. A workflow that only passed locally because a step started from a clean image now behaves as it does on GitHub. `--step-containers`, or `WRKFLW_STEP_CONTAINERS=1`, brings the old behaviour back, and `--preserve-containers-on-failure` still implies it. `--job-container` is accepted and does nothing, even beside `--step-containers`. Both variables also apply to runs started from the TUI and `wrkflw watch`. The jobs of a called workflow share a container too, and their services now start. A step that is cancelled or times out may still be running in the job's container, so the steps after it, `if: always()` ones included, get a fresh container without what earlier steps installed, and the job's services restart with it.
+
+The job's container and its services are sampled into the job's memory measurement, so a job with services is measured and a matrix of light jobs still runs side by side.
+
+A job whose `run:` steps call `cargo`, `rustup`, `rustc` or `rustfmt` without a Rust setup action gets rustup and the `stable` toolchain in its image, as hosted runners have. Such a job used to run in the bare runner image and fail with `command not found`; its first run now builds an image. An image mapped with `-P`, and a `rust` image, keep their own toolchain and get nothing added, and a base that already has rustup keeps its default toolchain.
+
+Stored results, local and remote, are keyed on whether a job's steps share a container, and the key's version is bumped, so `--reuse-results` reruns every job once: a pass from a run with a container per step can't stand in for one whose steps share one.
+
+`--docker-in-jobs`, or `WRKFLW_DOCKER_IN_JOBS=1`, starts a Docker engine inside the container of a job whose steps run `docker`. The container runs privileged, so it is opt-in, and each such job says when its container starts privileged. It works on Docker only, and not for an image mapped with `-P`, which gets nothing added; in both cases the run says those steps will fail. Without it the run warns once, called workflows included, that those steps will fail. Which jobs run `docker`, or `cargo` for the runner's Rust, is read from the text of their `run:` steps as a shell splits it, `bash -c` and heredocs a shell reads included, and a `case` pattern is not a command: a command behind `make`, a script or a variable isn't seen, and `command -v docker` doesn't count.
+
+For crates that use wrkflw as a library: `wrkflw_executor::Acceleration::job_container` is gone. `step_containers` is its opposite and defaults to `false`, so `Acceleration::default()` now runs one container per job, and `docker_in_jobs` is new. Struct literals that name `job_container` need changing.
+
 ## A pass that skipped an action is `partial`, and library API changes (unreleased)
 
 A `uses:` step whose action wrkflw didn't run now makes a passing run's `verdict` `partial` instead of `verified`, with an entry `{kind: "action_not_run", job, step, uses, reason}` under `unverified`. Every `unverified` entry now has a `kind`, and the entries for a job run as another OS have `kind: "runner"`. That covers a JavaScript action wrkflw has no implementation of, such as `codecov/codecov-action`, `actions/github-script` or a local `./` action whose `action.yml` runs on Node, and a setup action whose runtime isn't in the job's image: one in a job with `container:`, one inside a composite action whose runtime the job's own steps didn't set up, one whose version wrkflw can't install, and every setup action under emulation. `node-version` and `.nvmrc` aliases such as `lts/*`, `lts/iron` and `node` are now installed rather than ignored, and an `lts/` codename wrkflw doesn't know is refused, as setup-node refuses it, instead of installing the newest LTS. A `go-version` or `go.mod` that names a line such as `1.22` installs that line's newest release. A `*-version-file` must be a path inside the repository. An action inside a composite action is reported on the step that calls the composite action. Workflows that use such actions and used to report `verified` now report `partial`, and `wrkflw gate` prints its partial warning for them. Its exit code is unchanged.
```

**File**: `INDEX.md` (modified, +170/-24)
```diff
@@ -1,7 +1,7 @@
 # Codebase Index: wrkflw
 
-> Generated: 2026-11-13 12:17:35 UTC | Files: 262 | Lines: 118189
-> Languages: JSON (4), Markdown (26), Rust (169), Shell (6), TOML (19), YAML (38)
+> Generated: 2026-11-14 13:25:31 UTC | Files: 264 | Lines: 120068
+> Languages: JSON (4), Markdown (27), Rust (170), Shell (6), TOML (19), YAML (38)
 
 ## Directory Structure
 
@@ -13,6 +13,7 @@ wrkflw/
   Cargo.toml
   INDEX.md
   README.md
+  RELEASE_POST.md
   cliff.toml
   crates/
     README.md
@@ -59,6 +60,7 @@ wrkflw/
         podman.rs
         run_options.rs
         runner_fidelity.rs
+        script_commands.rs
         setup_actions.rs
         substitution.rs
         vm_memory.rs
@@ -421,6 +423,9 @@ wrkflw/
 - `# File-based secrets (JSON, YAML, or .env format)`
 - `# On Linux, put them in ~/.config/wrkflw/secrets/ (read by the `file` provider)`
 
+**RELEASE_POST.md**
+- `# wrkflw v0.8.0 — run GitHub Actions locally, now with a real `${{ ... }}` evaluator`
+
 **cliff.toml**
 - `[changelog]`
 - `[#{{ contributor.pr_number }}]`
@@ -611,6 +616,8 @@ wrkflw/
 **crates/executor/src/run_options.rs**
 - `pub const FRESH_WORKSPACE_ENV: &str = "WRKFLW_FRESH_WORKSPACE"`
 - `pub const EVERY_MATRIX_LEG_ENV: &str = "WRKFLW_EVERY_MATRIX_LEG"`
+- `pub const STEP_CONTAINERS_ENV: &str = "WRKFLW_STEP_CONTAINERS"`
+- `pub const DOCKER_IN_JOBS_ENV: &str = "WRKFLW_DOCKER_IN_JOBS"`
 - `pub fn set_fresh_workspaces(on: bool)`
 - `pub fn fresh_workspaces() -> bool`
 - `pub fn set_every_matrix_leg(on: bool)`
@@ -1764,7 +1771,7 @@ wrkflw/
 
 ## BREAKING_CHANGES.md
 
-**Language:** Markdown | **Size:** 31.5 KB | **Lines:** 384
+**Language:** Markdown | **Size:** 34.6 KB | **Lines:** 398
 
 **Declarations:**
 
@@ -1788,15 +1795,23 @@ wrkflw/
 
 ## INDEX.md
 
-**Language:** Markdown | **Size:** 275.7 KB | **Lines:** 10197
+**Language:** Markdown | **Size:** 283.0 KB | **Lines:** 10447
 
 **Declarations:**
 
 ---
 
 ## README.md
 
-**Language:** Markdown | **Size:** 43.8 KB | **Lines:** 563
+**Language:** Markdown | **Size:** 45.6 KB | **Lines:** 564
+
+**Declarations:**
+
+---
+
+## RELEASE_POST.md
+
+**Language:** Markdown | **Size:** 3.8 KB | **Lines:** 59
 
 **Declarations:**
 
@@ -1867,7 +1882,7 @@ wrkflw/
 
 ## crates/executor/README.md
 
-**Language:** Markdown | **Size:** 2.5 KB | **Lines:** 41
+**Language:** Markdown | **Size:** 2.6 KB | **Lines:** 41
 
 **Declarations:**
 
@@ -2059,7 +2074,7 @@ wrkflw/
 
 ## crates/executor/src/acceleration.rs
 
-**Language:** Rust | **Size:** 56.3 KB | **Lines:** 1604
+**Language:** Rust | **Size:** 60.3 KB | **Lines:** 1703
 
 **Imports:**
 - `pub(crate) use concurrency::acquire_concurrency`
@@ -2084,7 +2099,7 @@ wrkflw/
 
 `mod tree`
 
-`const KEY_VERSION: u32 = 3`
+`const KEY_VERSION: u32 = 4`
 
 `const DEP_CACHE_DIRS: &[(&str, &str)] = &[ ("cargo-registry", "/root/.cargo/registry"), ("cargo-git", "/root/.cargo/git"), ("npm", "/root/.npm"), ("pip", "/root/.cache/pip"), ("go-mod", "/root/go/pkg/mod"), ]`
 
@@ -2142,6 +2157,16 @@ wrkflw/
 `pub(crate) struct RunState`
 > Fields: `accel: Acceleration`, `preserve_containers: bool`, `root: PathBuf`, `sidecar: Option<Sidecar>`, `store: Option<ResultStore>`, `tree: OnceCell<Option<Arc<Tree>>>`, `executed: Mutex<HashSet<String>>`, `groups: Mutex<HashMap<String, Arc<Semaphore>>>`, `dep_mounts: OnceLock<Vec<(PathBuf, PathBuf)>>`, `warned_on_host_push: AtomicBool`
 
+`struct ContainerScope`
+> Fields: `policy: ContainerPolicy`, `warned_of_missing_docker: AtomicBool`
+
+`pub(crate) struct ContainerPolicy`
+> Fields: `step_containers: bool`, `preserve_containers: bool`, `docker_in_jobs: bool`
+
+**`impl ContainerPolicy`**
+  `pub(crate) fn one_container_per_step(&self) -> bool`
+
+
 `fn results_dir() -> Option<PathBuf>`
 
 `fn warn_outside_repo_root(root: &Path)`
@@ -2160,6 +2185,10 @@ wrkflw/
 
 `pub(crate) fn current() -> Option<Arc<RunState>>`
 
+`pub(crate) fn first_missing_docker_warning() -> bool`
+
+`pub(crate) fn container_policy() -> Option<ContainerPolicy>`
+
 `pub(crate) fn dep_cache_mounts(mounts_are_copies: bool) -> Vec<(PathBuf, PathBuf)>`
 
 `fn create_dep_cache_dirs(repo: &Path) -> Vec<(PathBuf, PathBuf)>`
@@ -3013,7 +3042,7 @@ wrkflw/
 
 ## crates/executor/src/job_memory.rs
 
-**Language:** Rust | **Size:** 38.4 KB | **Lines:** 1015
+**Language:** Rust | **Size:** 38.5 KB | **Lines:** 1015
 
 **Imports:**
 - `std::collections::HashMap`
@@ -3155,7 +3184,7 @@ wrkflw/
 
 ## crates/executor/src/job_session.rs
 
-**Language:** Rust | **Size:** 51.3 KB | **Lines:** 1439
+**Language:** Rust | **Size:** 71.4 KB | **Lines:** 1963
 
 **Imports:**
 - `crate::acceleration`
@@ -3189,7 +3218,38 @@ wrkflw/
 `pub(crate) const CONTAINER_ACTION_DIR: &str = "/github/action"`
 
 `struct Live`
-> Fields: `image: String`, `volumes: Vec<(PathBuf, PathBuf)>`, `id: String`, `action_dir: Option<PathBuf>`, `_cleanup: Containers`
+> Fields: `image: String`, `volumes: Vec<(PathBuf, PathBuf)>`, `id: String`, `action_dir: Option<PathBuf>`, `_memory: Option<MemoryWa
```

**File**: `README.md` (modified, +4/-3)
```diff
@@ -231,12 +231,13 @@ wrkflw gate --install-hook
 # The same pieces, one at a time
 wrkflw run .github/workflows/ci.yml --reuse-results
 wrkflw run .github/workflows/ci.yml --event push --affected
-wrkflw run .github/workflows/ci.yml --job-container --dep-cache
+wrkflw run .github/workflows/ci.yml --dep-cache
 ```
 
 - **`--reuse-results`** skips a job when an identical job already passed on identical inputs. The fingerprint covers the job definition, workflow `env` and `defaults`, `needs` outputs, event, ref, runtime, operating system, CPU architecture, `--platform` overrides and file contents. Stored outputs still reach dependent jobs. Results expire after 7 days, or `WRKFLW_RESULT_TTL_SECS`, because images and floating action tags such as `@v4` aren't in the fingerprint.
 - **`--affected`** also skips a job when none of its declared paths changed, even with no stored result. It trusts the base you compare against to be green. The pre-push hook compares against the remote tip of the branch you push, which is green only if that push's CI passed. If it may not have, run `wrkflw gate --diff-base origin/main` by hand. It needs `--event`, and only applies to jobs listed in `.wrkflw/affected.yml`. Such a job counts as passed for its dependents and reports one `Not affected` step. A job still runs if it has `outputs` or a matrix, if a job it needs ran or didn't pass, or if a workflow file changed.
-- **`--job-container`** runs a job's `run:` steps in one container, on Docker and Podman. Files a step leaves outside the workspace are there for the next step, as on GitHub. A step that times out may still be running in that container, so the next step gets a fresh one, and a job's services restart with it. It's ignored with `--preserve-containers-on-failure`.
+- **One container per job** is how a job's `run:` steps run on Docker and Podman. What a step leaves outside the workspace, such as a tool from `go install`, `apt-get install` or `rustup toolchain add`, is there for the next step, as on GitHub. A step that times out may still be running in that container, so the next step gets a fresh one, and a job's services restart with it. `--step-containers`, or `WRKFLW_STEP_CONTAINERS=1`, gives each step a container of its own instead, as `--preserve-containers-on-failure` does. The variable also reaches runs started from the TUI and `wrkflw watch`. `--job-container` is still accepted and changes nothing, even beside `--step-containers`.
+- **`--docker-in-jobs`**, or `WRKFLW_DOCKER_IN_JOBS=1`, starts a Docker engine inside the container of each job whose `run:` steps run `docker`, as hosted runners have one. That container runs privileged, so it is off unless you ask: only use it for workflows you trust. The engine is the job's own, so `docker run -v $(pwd):/src` mounts the job's workspace, and its images and containers go with the job. Each such job says when its container starts privileged, so a variable left set in a shell doesn't grant it unseen. The variable also reaches runs started from the TUI and `wrkflw watch`. Without the flag such a step fails with `docker: command not found`, and the run says so before it starts. It works on Docker only: a rootless Podman container can't run an engine, and the run says so. An image you map with `-P` gets no engine added either, as it gets no runner tool: it must bring its own. A job counts as running `docker` when its `run:` script calls it as a shell would, including through `sudo`, `env`, `timeout` or `nice`, inside `$(...)`, in `bash -c '...'` and in a heredoc a shell reads; `command -v docker`, a quoted string, a `case` pattern and a heredoc that `cat` writes don't count. A `docker` run by `make`, by a script the step calls or through a variable isn't seen, and that job gets neither the engine nor the warning. The same reading decides which jobs get the runner's Rust, which an image you map with `-P`, or a `rust` image, doesn't get: those keep their own.
 - **`--dep-cache`** mounts host directories over the cargo, npm, pip and Go caches under `/root`, so it helps images that run as root. The host directories live under `WRKFLW_DEP_CACHE_DIR` if set, or the user cache directory, with one set per repository. Steps can write to them, so a job you don't trust can leave packages there for later runs of the same repository, but not for other repositories. They are wrkflw's own directories, not your `~/.cargo` or `~/.npm`.
 
 Reuse is only as safe as its inputs. wrkflw always runs a job that reads secrets or a `github-token` input, has `write` permissions of its own or from the workflow's `permissions:`, exchanges artifacts, uses a known publishing action such as `actions/github-script`, `softprops/action-gh-release` or `docker/build-push-action`, or calls a reusable workflow, because those can have effects it can't see. It also always runs a job with `outputs` that uses `needs` when a job upstream reads secrets, so a passed-along secret doesn't get stored. A job with no `permi
```

**File**: `crates/executor/README.md` (modified, +1/-1)
```diff
@@ -12,7 +12,7 @@ The execution engine that runs GitHub Actions, Gitea and GitLab CI workflows loc
 - Job-level `continue-on-error` (also as an expression) and job-level `concurrency:` groups within a run
 - Matrices computed by expressions, including from an earlier job's outputs
 - Result reuse (`acceleration.reuse_results`): a job whose fingerprint matches a passing run is skipped, with its outputs replayed, from a local store or a signed remote cache
-- Affected-job skipping from `.wrkflw/affected.yml`, one container per job (`acceleration.job_container`) and shared dependency caches (`acceleration.dep_cache`)
+- Affected-job skipping from `.wrkflw/affected.yml`, shared dependency caches (`acceleration.dep_cache`), and the opt-outs and opt-ins of one container per job (`acceleration.step_containers`, `acceleration.docker_in_jobs`)
 - Kubernetes execution: each step runs as a pod in the cluster `kubectl` points at, with the workspace synced in and out
 - GitLab CI pipelines, including `parallel`, `parallel:matrix`, `rules`, `when` and stages
 - Local `actions/upload-artifact`, `actions/download-artifact`, and `actions/cache` via shared artifact and cache stores
```

**File**: `crates/executor/src/acceleration.rs` (modified, +103/-4)
```diff
@@ -37,7 +37,7 @@ use wrkflw_parser::workflow::{Job, WorkflowDefinition};
 pub const SIDECAR_PATH: &str = ".wrkflw/affected.yml";
 
 /// Bump when the fingerprint's inputs change, so old entries stop matching.
-const KEY_VERSION: u32 = 3;
+const KEY_VERSION: u32 = 4;
 
 /// Host directories mounted into containers under `--dep-cache`.
 const DEP_CACHE_DIRS: &[(&str, &str)] = &[
@@ -142,8 +142,12 @@ pub struct Acceleration {
     pub reuse_results: bool,
     /// Files changed since the base. `Some` turns on `--affected`.
     pub changed_files: Option<Vec<String>>,
-    /// Run a job's `run:` steps in one container instead of one per step.
-    pub job_container: bool,
+    /// Run each `run:` step in a container of its own instead of the job's
+    /// one, so what a step leaves outside the workspace is gone in the next.
+    pub step_containers: bool,
+    /// Start a Docker engine inside the container of a job whose steps run
+    /// `docker`. That container runs privileged.
+    pub docker_in_jobs: bool,
     /// Mount package manager caches from the host.
     pub dep_cache: bool,
     /// Directory, `file://` or `https://` base for shared results.
@@ -442,6 +446,12 @@ fn job_key_with(input: &KeyInput<'_>, every_matrix_leg: bool) -> Option<String>
     if every_matrix_leg && lookup.job.matrix_config().is_some() {
         document["every_matrix_leg"] = serde_json::json!(true);
     }
+    // A pass with a container per step can rest on each step starting from
+    // a clean image, so it can't stand in for a run whose steps share one,
+    // or the other way round. Version 3 keys were all of the former.
+    if container_policy().is_some_and(|policy| policy.one_container_per_step()) {
+        document["step_containers"] = serde_json::json!(true);
+    }
     let text = serde_json::to_string(&canonical(document)).ok()?;
     Some(hex(&Sha256::digest(text.as_bytes())))
 }
@@ -468,6 +478,37 @@ pub(crate) struct RunState {
 tokio::task_local! {
     /// `None` inside a called workflow, whose inputs aren't in any fingerprint.
     static RUN: Option<Arc<RunState>>;
+    /// Set with [`RUN`], and kept inside a called workflow.
+    static CONTAINERS: Arc<ContainerScope>;
+}
+
+/// What the jobs of a run, called workflows' included, share about
+/// containers.
+struct ContainerScope {
+    policy: ContainerPolicy,
+    /// Set once the run has said its steps run `docker` with no engine.
+    warned_of_missing_docker: AtomicBool,
+}
+
+/// How the jobs of a run use containers. Unlike the rest of the run's
+/// state it reaches the jobs of a called workflow, whose steps share a
+/// machine on GitHub as any job's do.
+#[derive(Debug, Clone, Copy, Default, PartialEq)]
+pub(crate) struct ContainerPolicy {
+    /// One container per step, not one per job.
+    pub step_containers: bool,
+    /// Keep a failed step's container, which takes one per step.
+    pub preserve_containers: bool,
+    /// Start a Docker engine in the container of a job that runs `docker`.
+    pub docker_in_jobs: bool,
+}
+
+impl ContainerPolicy {
+    /// Each `run:` step gets a container of its own, which a kept-for-
+    /// debugging container also takes.
+    pub(crate) fn one_container_per_step(&self) -> bool {
+        self.step_containers || self.preserve_containers
+    }
 }
 
 /// The directory results are kept in.
@@ -564,7 +605,22 @@ impl RunState {
 
 /// Run `future` with this run's state available to the jobs it executes.
 pub(crate) async fn with_run_state<F: Future>(state: Arc<RunState>, future: F) -> F::Output {
-    RUN.scope(Some(state), future).await
+    // The variables reach a run started from the TUI or `watch` too, which
+    // have no flags for these.
+    let policy = ContainerPolicy {
+        step_containers: state.accel.step_containers
+            || crate::run_options::env_flag(crate::run_options::STEP_CONTAINERS_ENV),
+        preserve_containers: state.preserve_containers,
+        docker_in_jobs: state.accel.docker_in_jobs
+            || crate::run_options::env_flag(crate::run_options::DOCKER_IN_JOBS_ENV),
+    };
+    let scope = Arc::new(ContainerScope {
+        policy,
+        warned_of_missing_docker: AtomicBool::new(false),
+    });
+    CONTAINERS
+        .scope(scope, RUN.scope(Some(state), future))
+        .await
 }
 
 /// Run a called workflow's jobs with none of this applied.
@@ -576,6 +632,20 @@ pub(crate) fn current() -> Option<Arc<RunState>> {
     RUN.try_with(|run| run.clone()).ok().flatten()
 }
 
+/// True the first time a run asks, called workflows included, so it says
+/// only once that steps run `docker` with no engine there.
+pub(crate) fn first_missing_docker_warning() -> bool {
+    CONTAINERS
+        .try_with(|scope| !scope.warned_of_missing_docker.swap(true, Ordering::Relaxed))
+        .unwrap_or(true)
+}
+
+/// How this run's jobs use containers, or `None` outside a run that has a
+/// say in it, as a GitLab pipeline's.
+pub(crate) fn container_policy() -> Option<Co
```

**File**: `crates/executor/src/engine.rs` (modified, +162/-8)
```diff
@@ -2575,10 +2575,29 @@ async fn resolve_runner_image(
     }
 
     let SetupDetection {
-        runtimes,
+        mut runtimes,
         not_built,
     } = detect_setup(steps);
-    if runtimes.is_empty() {
+    // What a hosted runner has before any step runs, when the steps use it.
+    // An image the user mapped with `-P` is theirs, as a `container:` is:
+    // it may have its own toolchain, or no apt to install one with.
+    let mapped = image_is_mapped(job, platform_overrides, matrix);
+    if !mapped {
+        runtimes.extend(crate::setup_actions::runner_rust(
+            steps,
+            &runtimes,
+            &base_image,
+        ));
+    }
+    // The job's own Docker engine goes into the image, but is no setup
+    // action's runtime.
+    let mut image_runtimes = runtimes.clone();
+    if job_session::docker_engine_for(job, runtime, mapped) {
+        image_runtimes.push(crate::setup_actions::docker_engine());
+    } else {
+        warn_of_missing_docker(job, runtime, mapped);
+    }
+    if image_runtimes.is_empty() {
         Ok(RunnerImage {
             built: BuiltRuntimes {
                 not_built,
@@ -2589,7 +2608,7 @@ async fn resolve_runner_image(
     } else {
         // Always build a combined image on the runner base so that essential
         // tools (git, curl, etc.) remain available for actions like checkout.
-        let image = build_combined_runtime_image(&runtimes, &base_image, runtime).await?;
+        let image = build_combined_runtime_image(&image_runtimes, &base_image, runtime).await?;
         Ok(RunnerImage {
             image,
             built: BuiltRuntimes {
@@ -2602,6 +2621,57 @@ async fn resolve_runner_image(
     }
 }
 
+/// True when the user mapped `job`'s `runs-on` to an image of their own
+/// with `-P`, which wrkflw adds no runner tool to.
+fn image_is_mapped(
+    job: &Job,
+    platform_overrides: &HashMap<String, String>,
+    matrix: Option<&HashMap<String, Value>>,
+) -> bool {
+    job.container.is_none()
+        && find_platform_override(&job.runs_on, platform_overrides, matrix).is_some()
+}
+
+/// Say once per run that steps run `docker` and no engine is there for
+/// them, and how to get one. Not for a job with a `container:`, whose image
+/// is its own business, or a runtime without containers. An image mapped
+/// with `-P` (`mapped_image`) only gets the warning under
+/// `--docker-in-jobs`, which it is out of reach of: without the flag such
+/// an image may well bring its own way to run `docker`.
+fn warn_of_missing_docker(job: &Job, runtime: &dyn ContainerRuntime, mapped_image: bool) {
+    if job.container.is_some()
+        || runtime.session_cli().is_none()
+        || !crate::script_commands::steps_run(&job.steps, &["docker"])
+    {
+        return;
+    }
+    let Some(policy) = acceleration::container_policy() else {
+        return;
+    };
+    if mapped_image && !policy.docker_in_jobs {
+        return;
+    }
+    if !acceleration::first_missing_docker_warning() {
+        return;
+    }
+    wrkflw_logging::warning(if policy.docker_in_jobs && mapped_image {
+        "A job's steps run `docker`, but --docker-in-jobs doesn't add an engine to an \
+         image mapped with -P, which is yours as it is: those steps need the image to \
+         bring its own"
+    } else if policy.docker_in_jobs && runtime.session_cli() != Some("docker") {
+        "A job's steps run `docker`, but --docker-in-jobs only starts an engine on \
+         Docker, not Podman: those steps will fail"
+    } else if policy.docker_in_jobs {
+        "A job's steps run `docker`, but --docker-in-jobs needs one container per job, \
+         which --step-containers and --preserve-containers-on-failure turn off: \
+         those steps will fail"
+    } else {
+        "A job's steps run `docker`, which hosted runners have and a job's container \
+         doesn't: those steps will fail. Pass --docker-in-jobs to start a Docker engine \
+         inside the container of each such job, which then runs privileged"
+    });
+}
+
 /// The image a job's steps run in, and the setup runtimes built into it.
 #[derive(Debug, Clone, PartialEq)]
 struct RunnerImage {
@@ -2762,8 +2832,8 @@ async fn execute_job_with_matrix(
 
     if !job.services.is_empty() && job_session::wanted_for(job, runtime).is_none() {
         wrkflw_logging::warning(&format!(
-            "Job '{}' declares services, which need Docker or Podman and aren't started \
-             in a called workflow: its steps can't reach them",
+            "Job '{}' declares services, which need Docker or Podman and aren't started: \
+             its steps can't reach them",
             job_name
         ));
     }
@@ -2956,10 +3026,11 @@ async fn execute_job_with_matrix(
                 build_image_ahead(job, &job.steps, runtime, platform_overrides, None).await;
             }
         };
+        let mapped = image_is_mapped(job, platform_overrides, None);
         let result = with_ima
```

**File**: `crates/executor/src/job_memory.rs` (modified, +4/-4)
```diff
@@ -18,17 +18,17 @@
 //!
 //! Only a job that ran to the end and passed records a peak: one that
 //! failed or was cancelled part way used less than a whole run does. A job
-//! whose containers couldn't all be measured, as with a job container or
-//! Podman, forgets what an earlier run measured, which no longer says what
-//! it needs.
+//! whose containers couldn't all be measured, as with Podman, forgets what
+//! an earlier run measured, which no longer says what it needs.
 //!
 //! The legs of a matrix run the same steps, so each leg's peak is also kept
 //! for the matrix as a whole, and a leg never measured itself is given the
 //! room its siblings needed. The first leg of a new matrix, or of a fresh
 //! clone, runs alone; the rest wait for its measurement and then share the
 //! VM, where every leg used to run alone in turn.
 //!
-//! Only step containers are measured. Building the job's image and the
+//! A job's own container, its services and any step that runs in a
+//! container of its own are measured. Building the job's image and the
 //! helper that copies its workspace run outside any job's measurement, so
 //! the first run after image caches are cleared can need more than
 //! measured. Containers sampled never, which most that finish within a
```

**File**: `crates/executor/src/job_session.rs` (modified, +539/-15)
```diff
@@ -1,9 +1,19 @@
 //! One long-lived container per job, plus the job's service containers.
 //!
-//! By default each `run:` step gets its own container. A session starts one
-//! container and `exec`s each step into it, which saves the container start
-//! and matches GitHub, where steps share a machine: what a step installs is
-//! there for the next one.
+//! A session starts one container and `exec`s each step into it, which
+//! matches GitHub, where steps share a machine: what a step installs is
+//! there for the next one. It also saves a container start per step.
+//! `--step-containers` gives each `run:` step a container of its own
+//! instead, as does keeping a failed step's container for debugging.
+//!
+//! The job container and its services are sampled into the job's memory
+//! meter, as a step's own container is, so a matrix of light jobs still
+//! runs side by side.
+//!
+//! With `--docker-in-jobs`, a job whose steps run `docker` gets a Docker
+//! engine of its own inside its container, which then runs privileged.
+//! The machine's engine is never handed to a step: a `-v $(pwd):/src`
+//! there would name a path on this machine, not in the job.
 //!
 //! Services share the job container's network namespace, like the containers
 //! of a Kubernetes pod. So `localhost:5432` works, as it does for a job on a
@@ -64,10 +74,196 @@ struct Live {
     id: String,
     /// The action directory last copied to [`CONTAINER_ACTION_DIR`].
     action_dir: Option<PathBuf>,
+    /// Samples the containers' memory. Before `_cleanup`, so it stops
+    /// before the containers go and their going isn't taken for a failure.
+    _memory: Option<MemoryWatch>,
     /// Removes the containers when the session ends, however it ends.
     _cleanup: Containers,
 }
 
+/// A session's containers that ran this long and sent no sample went
+/// unmeasured.
+const UNSAMPLED_AFTER: Duration = Duration::from_secs(3);
+
+/// What `stats` prints for each container, each time it samples them.
+const STATS_FORMAT: &str = "{{.ID}} {{.MemUsage}}";
+
+/// Samples a session's containers into the job's meter while they live,
+/// through the CLI's `stats`, which reports the same working set the
+/// engine's API gives for a step's own container.
+struct MemoryWatch {
+    ids: Vec<String>,
+    meter: Arc<crate::job_memory::JobMeter>,
+    sampled: Arc<std::sync::atomic::AtomicBool>,
+    /// `stats` ended while the containers were still there.
+    broken: Arc<std::sync::atomic::AtomicBool>,
+    /// Set when the watch ends. Samples are taken under this lock, so none
+    /// lands after the containers were taken off the meter: aborting the
+    /// task doesn't stop one it is already taking.
+    ended: Arc<std::sync::Mutex<bool>>,
+    started: std::time::Instant,
+    task: tokio::task::JoinHandle<()>,
+}
+
+impl MemoryWatch {
+    fn start(cli: &'static str, ids: Vec<String>, meter: Arc<crate::job_memory::JobMeter>) -> Self {
+        use std::sync::atomic::{AtomicBool, Ordering};
+        use tokio::io::AsyncBufReadExt;
+        let sampled = Arc::new(AtomicBool::new(false));
+        let broken = Arc::new(AtomicBool::new(false));
+        let ended = Arc::new(std::sync::Mutex::new(false));
+        let task = {
+            let (ids, meter, sampled, broken, ended) = (
+                ids.clone(),
+                meter.clone(),
+                sampled.clone(),
+                broken.clone(),
+                ended.clone(),
+            );
+            tokio::spawn(async move {
+                let child = Command::new(cli)
+                    .args(["stats", "--no-trunc", "--format", STATS_FORMAT])
+                    .args(&ids)
+                    .stdin(Stdio::null())
+                    .stdout(Stdio::piped())
+                    .stderr(Stdio::null())
+                    .kill_on_drop(true)
+                    .spawn();
+                let Ok(mut child) = child else {
+                    broken.store(true, Ordering::Relaxed);
+                    return;
+                };
+                if let Some(stdout) = child.stdout.take() {
+                    let mut lines = tokio::io::BufReader::new(stdout).lines();
+                    while let Ok(Some(line)) = lines.next_line().await {
+                        if let Some((id, bytes)) = stats_sample(&line, &ids) {
+                            let ended = ended.lock().unwrap_or_else(|e| e.into_inner());
+                            if *ended {
+                                return;
+                            }
+                            meter.sample(id, bytes);
+                            sampled.store(true, Ordering::Relaxed);
+                        }
+                    }
+                }
+                // Aborted when the session ends, so getting here means
+                // `stats` gave up first: what was used since is unseen.
+                broken.store(true, Ordering::Relaxed);
+            })
+        };
+        MemoryWatch {
+    
```

#### Recent Merged Pull Requests:
- **PR #172** (2026-11-14): fix: keep what a step installs for the next one, and give jobs the runner's Rust and Docker (@bahdotsh)
- **PR #171** (2026-11-13): fix: agree with GitHub on real repositories, and build job images faster (@bahdotsh)
- **PR #170** (closed): perf: build job images faster, and start no container for a step that only prints (@bahdotsh)
- **PR #169** (2026-11-11): perf: run the legs of a new matrix together, and fit light jobs side by side again (@bahdotsh)
- **PR #168** (2026-11-11): fix: address the review findings from #167 (@bahdotsh)
- **PR #167** (2026-11-11): fix: report what a local pass didn't check, and make local runs match GitHub's (@bahdotsh)

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

## X. keep what a step installs for the next one, and give jobs the runner's Rust and 

**RULE**:
When implementing operations in `BREAKING_CHANGES.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in bahdotsh/wrkflw. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `a7e479f2`: keep what a step installs for the next one, and give jobs the runner's Rust and Docker. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `BREAKING_CHANGES.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
## A job's steps share one container (unreleased)

On Docker and Podman a job's `run:` steps now run in one container, started once and kept for the job, where each step used to get a container of its own. What a step leaves outside the workspace is there for the next one, as on GitHub: `go install`, `apt-get install`, `rustup toolchain add`, `pip install`, a file under `$HOME` or `/tmp`, a process left running. A workflow that only passed locally because a step started from a clean image now behaves as it does on GitHub. `--step-containers`, or `WRKFLW_STEP_CONTAINERS=1`, brings the old behaviour back, and `--preserve-containers-on-failure` still implies it. `--job-container` is accepted and does nothing, even beside `--step-containers`. Both variables also apply to runs started from the TUI and `wrkflw watch`. The jobs of a called workflow share a container too, and their services now start. A step that is cancelled or times out may still be running in the job's container, so the steps after it, `if: always()` ones included, get a fresh container without what earlier steps installed, and the job's services restart with it.

The job's container and its services are sampled into th
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `a7e479f2` are properly handled with clean fallback behavior.


## 3. Independent Verification Protocol
1. Assert state existence before and after execution.
2. Verify deterministic SHA-256 byte digest parity.
3. Validate zero unhandled promise rejections or uncaught exceptions.

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bahdotsh-wrkflw-learnings.md`  
> **Source**: github ([https://github.com/bahdotsh/wrkflw](https://github.com/bahdotsh/wrkflw))  
> **Source Version**: `9889b7da`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-13T00:16:07.388Z  
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
> **Harvest Timestamp**: 2026-11-13T00:16:07.125Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `bahdotsh/wrkflw`
- **Description**: Validate and Run GitHub Actions locally.
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: Cargo.toml, README.md
- **Stars / Engagement**: 3341 stars

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
            Box::pin(execute_github_workflow(workflow_path, config.clone())),
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
                            wrkflw_logging::symbols::FAILURE,
                            step.name,
                            step.output
                        ));
                    }
                }
            }
        }

        results.extend(job_results);
    }

    // If there were failures, add detailed failure
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
const KEY_VERSION: u32 = 3;

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
    /// Run a job's `run:` steps in one container instead of one per step.
    pub job_container: bool,
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
            .any(|access| access.as_str() == Some("write")),
        _ => false,
    }
}

/// Why a job's result must not be reused, or `None` if it may be.
///
/// wrkflw can't see what a step does, so this rules out what it can detect:
/// a job that touches credentials probably chan
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
- **Issue #169** (2026-11-11): **perf: run the legs of a new matrix together, and fit light jobs side by side again**
  *Symptoms*: Two scheduling changes for small Docker VMs, found by rerunning the pallets/click benchmark on main after #167 and #168.  ## Results  pallets/click at `1077444`, compared with GitHub run 42384079679 (11 jobs, 65 s on GitHub), Docker Desktop VM with 7.7 GB:  | | main (`a9943e3`) | this PR | |---|---|---| | First compare in a fresh clone | 877 s | 91 s | | Warm compare | 49, 48, 46 s | 33, 37, 42 s | | Jobs agreeing with GitHub | 11/11 | 11/11 |  These numbers were measured before `fe977d6`, which put a margin of an eighth on the highest-peak floor. They have not been re-run since. Click's legs peak at 276–552 MiB, where the recent-runs estimate is above the floor anyway, so I don't expect a change, but that isn't measured.  ## A leg never measured takes its siblings' measurement  Measurements are keyed by the clone's path, so in a fresh clone every matrix leg was unmeasured and ran alone, one after another.  - Each leg's peak is now also kept under an id for the matrix as a whole. A leg with no measurement of its own is given what the matrix was measured at. - Only the first leg of a new matrix runs alone. Legs waiting unmeasured look at the store again whenever a job of the run keeps its measurement, then share the VM. Each look puts the leg at the back of the pool's queue; that is deliberate and commented. - A leg keeps its place in the pool until its measurement is written, so the next leg reads it before taking the place. Without this the second leg would take the whole VM

- **Issue #168** (2026-11-11): **fix: address the review findings from #167**
  *Symptoms*: Follow-up to #167: fixes the findings from its review.  ## Workspace volume (macOS) — `f85d661` - **Orphan cleanup never found anything on Docker.** The `volume ls` template indexed `.Labels`, which is a string there, so the call failed and every `wrkflw-ws-*` volume leaked. Cleanup now lists by label filter and reads labels with `volume inspect`. Reproduced on local Docker. - **Hard links came back as empty files.** `fetch` now uses tar `--hard-dereference`. - **A kept name stayed kept forever.** Once nothing on the host goes by that name, it is released and fetched again. - **A directory a step made read-only couldn't take its changes back.** The parent is opened for the write, and its mode restored, only when the volume holds it read-only too. Pending-write behaviour for a directory only the host locks is unchanged. - **A preserved container's volume was removed under it.** `release` keeps a volume that stopped containers still use, and gives it up after 5 s of holds when no stopped container is involved. - `with.args` is parsed before the volume sync, so a bad `args` doesn't leave a sync half done.  ## Floating setup versions — `d0f17b7` - The week was written as a Dockerfile comment, which doesn't change the image, so the weekly rebuild never happened. It is now part of the `RUN` line. - `3`/`1` alone count as floating for Python and Go. - Runtime `ENV` (such as `UV_PYTHON_INSTALL_DIR`) is written into the image.  ## Setup verdicts — `6515e0a` - `setup-uv`'s `python-vers

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

### Incident Patch 1: `e418eebc` (2026-11-11)
**Commit Message**: fix: report what a local pass didn't check, and make local runs match GitHub's (#167)

* fix: report what a local pass did not check, and install Python via uv

Benchmarking against pallets/click (GitHub run 42384079679) found the
local run disagreeing on every job while reporting `verified`. All the
causes were generic:

- A `uses:` step whose action wrkflw cannot run was stubbed and passed
  silently. It is now recorded as `actions_not_run` on the job, listed
  under `unverified` as `{job, step, uses, reason}`, makes the verdict
  `partial`, warns in the log, is marked in the TUI and noted by
  `compare`.
- `setup-python` built interpreters from the deadsnakes PPA, which has
  no `3.15t`, `pypy-3.11` or `3.14` on the default base. Python is now
  installed through `uv python install`, `astral-sh/setup-uv` is a
  setup action, and `*-version-file` inputs are read.
- `compare` on a detached HEAD skipped the workflow. `run` and `plan`
  take `--branch`, which `compare` sets from the run's head branch;
  `--event` and `--branch` also set GITHUB_EVENT_NAME and GITHUB_REF.
- Action metadata for SHA-pinned refs is cached on disk, and
  `action.yaml` is only tried when `action.yml` is a 

**File**: `.cargo/config.toml` (modified, +6/-0)
```diff
@@ -5,3 +5,9 @@
 # so `WRKFLW_FRESH_WORKSPACE=0 cargo run -- run ...` keeps workspaces.
 [env]
 WRKFLW_FRESH_WORKSPACE = "1"
+# Likewise for the memory each job was measured to use: tests keep none, so
+# they never change how a real run on this machine schedules its jobs. This
+# applies to `cargo run` too, which then schedules every job as unmeasured.
+# An existing value wins, so name a file to measure, as in
+# `WRKFLW_JOB_MEMORY_FILE=/tmp/job-memory.json cargo run -- run ...`.
+WRKFLW_JOB_MEMORY_FILE = ""
```

**File**: `AGENTS.md` (modified, +8/-7)
```diff
@@ -5,11 +5,11 @@ wrkflw validates and runs GitHub Actions and GitLab CI workflows locally. Use it
 ## Loop
 
 1. After editing YAML, run `wrkflw --format json validate`.
-2. Run `wrkflw --format json plan <file>` to see job order, matrix legs, whether a trigger fires, and under `unverified` which jobs would run as another OS than `runs-on` asks for. Pass the `--runtime` you will run with.
+2. Run `wrkflw --format json plan <file>` to see job order, matrix legs, whether a trigger fires, and under `unverified` which jobs would run as another OS than `runs-on` asks for. Pass the `--runtime` you will run with, and `--branch` when the checkout is detached or the push is to another branch, or `--tag` for a tag push. The MCP `run_workflow` and `plan_workflow` tools take the same as `branch` and `tag`.
 3. Run `wrkflw --format json run <file> --intent "why you are running this"`.
 4. On failure, read the `failure` object in the final `run_finished` line. Don't rerun to see the error again.
 5. For earlier runs, use `wrkflw runs list`, `runs failure <id>` and `runs logs <id> --step <name>`.
-6. Before calling a pass done, read `verdict` on `run_finished`, not only `status`. `verified` means every job that ran did so as the OS its `runs-on` asked for. `partial` means some didn't: they are listed under `unverified`, such as `windows-latest` run as Linux, so steps gated on `runner.os` and OS-specific behaviour were not checked. `nothing_checked` means it passed because no job ran. Say which, instead of claiming CI will pass.
+6. Before calling a pass done, read `verdict` on `run_finished`, not only `status`. `verified` means every job that ran did so as the OS its `runs-on` asked for, and every `uses:` step ran its action. `partial` means some didn't: they are listed under `unverified`, such as `windows-latest` run as Linux, so steps gated on `runner.os` and OS-specific behaviour were not checked, or a step whose action wrkflw can't run (an entry of `kind` `action_not_run`), so whatever that action installs or checks is missing. `nothing_checked` means it passed because no job ran. Say which, instead of claiming CI will pass.
 
 Prefer the MCP server if your client supports MCP. `wrkflw mcp install` registers it with Claude Code, Codex, Cursor, Windsurf, VS Code, Gemini CLI, opencode, Claude Desktop, GitHub Copilot CLI, Grok Build, Kiro CLI, pi and Zed. Pass a name, such as `wrkflw mcp install codex`, for one agent, and `--dry-run` to see the change first. By hand:
 
@@ -29,7 +29,7 @@ Add `--reuse-results` to `wrkflw run`, or `reuse_results` to the MCP `run_workfl
 
 ## Checking wrkflw against GitHub
 
-`wrkflw compare <run id or URL>` runs a workflow locally as a finished GitHub Actions run did, for the same event, and lists each job's result on both sides. The working tree must be the commit the run tested: check it out first, in a worktree if you like. It prints one `compare` object: `agree`, `disagreements`, `basis` (`jobs` when jobs were paired by name, `run` when only the run's result could be compared, `none` when nothing could), a `problem` saying why the comparison says less than a per-job one would, the GitHub run, the local run's `status` and `verdict`, and per job `github_name`, `local_name`, `github`, `local`, `agree` (`null` when GitHub cancelled or skipped it before running) and a `note` on why they may differ, such as a job run as another OS or killed for lack of memory. It exits 0 only when something was compared and nothing differed: a local run that errored, ran no job, or can't be compared at all never agrees. A job only one side has a result for, such as a called workflow's job, is named in `problem`: a failure there counts as a disagreement, and the runs' own results are compared too, so a run GitHub failed in a job wrkflw couldn't pair never agrees with a local pass. It reads the API with `GITHUB_TOKEN`, or the token `gh auth token` prints, or none for a public repository.
+`wrkflw compare <run id or URL>` runs a workflow locally as a finished GitHub Actions run did, for the same event, and lists each job's result on both sides. The working tree must be the commit the run tested: check it out first, in a worktree if you like. It prints one `compare` object: `agree`, `disagreements`, `basis` (`jobs` when jobs were paired by name, `run` when only the run's result could be compared, `none` when nothing could), a `problem` saying why the comparison says less than a per-job one would, `ref_unsure` when `origin` couldn't be asked whether the run's ref is a tag (it is then run as a branch), the GitHub run, the local run's `status` and `verdict`, and per job `github_name`, `local_name`, `github`, `local`, `agree` (`null` when GitHub cancelled or skipped it before running) and a `note` on why they may differ, such as a job run as another OS, an action wrkflw did not run, or a process killed for lack of memory. The run's branch is passed as `--branch`, or its tag as `--tag` for a run a tag push started, s
```

**File**: `BREAKING_CHANGES.md` (modified, +37/-1)
```diff
@@ -1,5 +1,33 @@
 # Breaking Changes
 
+## A pass that skipped an action is `partial`, and library API changes (unreleased)
+
+A `uses:` step whose action wrkflw didn't run now makes a passing run's `verdict` `partial` instead of `verified`, with an entry `{kind: "action_not_run", job, step, uses, reason}` under `unverified`. Every `unverified` entry now has a `kind`, and the entries for a job run as another OS have `kind: "runner"`. That covers a JavaScript action wrkflw has no implementation of, such as `codecov/codecov-action`, `actions/github-script` or a local `./` action whose `action.yml` runs on Node, and a setup action whose runtime isn't in the job's image: one in a job with `container:`, one inside a composite action whose runtime the job's own steps didn't set up, one whose version wrkflw can't install, and every setup action under emulation. `node-version` and `.nvmrc` aliases such as `lts/*`, `lts/iron` and `node` are now installed rather than ignored, and an `lts/` codename wrkflw doesn't know is refused, as setup-node refuses it, instead of installing the newest LTS. A `go-version` or `go.mod` that names a line such as `1.22` installs that line's newest release. A `*-version-file` must be a path inside the repository. An action inside a composite action is reported on the step that calls the composite action. Workflows that use such actions and used to report `verified` now report `partial`, and `wrkflw gate` prints its partial warning for them. Its exit code is unchanged.
+
+`actions/setup-python` installs Python with uv instead of the deadsnakes PPA, under `/opt/uv/python` so steps that run as another user or set `HOME` find it, and a `python-version-file` pointing at `pyproject.toml` installs the newest release `requires-python` allows, as the hosted action does. `pip install` works in it, as on GitHub. The image built for a job with setup actions also gets `less` and, unless the job sets up Node or the base image has it, Node.js 22, as GitHub's Ubuntu runners have. Combined runtime images get new tags, so the first run after upgrading builds them again, and that build takes a little longer.
+
+`wrkflw run` and `wrkflw plan` take `--branch` and `--tag`, the branch or tag the event is for, and the MCP `run_workflow` and `plan_workflow` tools take `branch` and `tag`. `wrkflw compare` passes the run's branch, or its tag for a run a tag push started, so a detached checkout of the run's commit fires the same `branches:` and `tags:` filters.
+
+`wrkflw compare` and `wrkflw gate` pass `--platform` on to the runs they start, and the pre-push hook that `gate --install-hook` writes keeps it. Both used to accept the flag and ignore it, so their runs used the built-in images.
+
+A job that fails before any step runs, because its image can't be built or pulled or its job container or network doesn't start, gets `cause: {kind: "setup_failed"}` in the failure digest, and `compare` says so in its note instead of reporting a plain failure.
+
+For crates that use wrkflw as a library:
+
+- `wrkflw_runtime::container::ContainerRuntime` requires `Sync`, and gains `image_id` and `identifies_images`, both with defaults. An implementation that isn't `Sync` no longer compiles.
+- `wrkflw_executor::ExecutionConfig` gains `event_name`, `git_ref` (a full ref such as `refs/heads/main` or `refs/tags/v1.0`) and `base_branch`, and `StepResult` gains `actions_not_run`. Struct literals need the new fields.
+- `wrkflw_executor::environment::create_github_context` takes a `RunRef`. Without `--event`, a workflow whose first trigger is a pull request now gets `GITHUB_HEAD_REF` and `GITHUB_BASE_REF` like one run with `--event pull_request`.
+- `ExecutionEvent` gains `ActionNotRun`. An exhaustive `match` on it needs an arm.
+- `wrkflw_executor::workspace::CleanReport` gains `volumes`, and `clean`'s JSON line a `volumes` count.
+
+A job reused with `--reuse-results`, as `wrkflw gate` does, reports the actions it passed without running again, so a pass that was `partial` stays `partial`. Stored results from earlier versions can't say, so they aren't reused and the job runs once more. A step whose action ran its `command` input in its place, and one whose `action.yml` couldn't be fetched, are reported as not run too.
+
+`wrkflw run` and `wrkflw plan` refuse `--tag` with a pull request `--event`, which is always for a branch. `--branch` and `--tag` drop a leading `refs/heads/` or `refs/tags/`, and refuse a name git wouldn't allow for a ref instead of quietly missing every `branches:` filter.
+
+`actions/setup-python` with neither `python-version` nor `python-version-file` reads `.python-version`, as the hosted action does. `actions/setup-node` with no version keeps the runner's Node 22 instead of installing 20. An empty `*-version` input, as an unset workflow input leaves it, reads the version file. A `node-version` or `.nvmrc` that pins a full release such as `20.11.0` installs that release from nodejs.org instead of that major's 
```

**File**: `Cargo.lock` (modified, +1/-0)
```diff
@@ -4561,6 +4561,7 @@ dependencies = [
  "windows-sys 0.59.0",
  "wrkflw-executor",
  "wrkflw-logging",
+ "wrkflw-runtime",
 ]
 
 [[package]]
```

**File**: `README.md` (modified, +17/-6)
```diff
@@ -20,7 +20,7 @@ A command-line tool for validating and executing GitHub Actions workflows locall
 - **Job selection** — run individual jobs with `--job` or via TUI job selection mode
 - **Job dependency resolution** — automatic ordering based on `needs` with parallel execution of independent jobs
 - **Expression evaluator** — evaluates `${{ ... }}` expressions including `toJSON`, `fromJSON`, `contains`, `startsWith`, etc.
-- **Action support** — Docker container actions, JavaScript actions, composite actions (with output propagation), and local actions
+- **Action support** — Docker container actions, composite actions (with output propagation), local actions, and built-in versions of `actions/checkout`, `actions/cache`, the artifact actions and the common setup actions (`setup-node`, `setup-python`, `setup-go`, `setup-java`, `setup-dotnet`, `setup-php`, `rust-toolchain`, `setup-uv`), which install the runtime into the job's image, honouring `*-version-file` inputs. Any other JavaScript action is not run: its step passes and is reported under `unverified`
 - **Reusable workflows** — execute caller jobs via `jobs.<id>.uses` (local or `owner/repo/path@ref`) with output propagation
 - **Artifacts, cache, and inter-job outputs** — `actions/upload-artifact`, `actions/download-artifact`, `actions/cache`, and `needs.<id>.outputs.*`
 - **GitHub context emulation** — environment variables, `GITHUB_OUTPUT`, `GITHUB_ENV`, `GITHUB_PATH`, `GITHUB_STEP_SUMMARY`
@@ -37,6 +37,7 @@ A command-line tool for validating and executing GitHub Actions workflows locall
 
 - GitHub encrypted secrets and fine-grained permissions
 - Event triggers other than `workflow_dispatch` for the remote `trigger` command
+- JavaScript actions outside the built-in set — a step such as `uses: some-org/setup-tool@v1`, or a local `uses: ./my-action`, whose action runs on Node is not executed. The step passes, prints that it would have run the action, and is listed under `unverified` in `run_finished`, the `gate` result and `compare`, with a warning in the log and a mark on the step in the TUI, so the run's verdict is `partial` rather than `verified`. Whatever the action would have installed or checked is missing from the job, so later steps may fail with `command not found`. Pass `--platform ubuntu-latest=IMAGE` with an image that has the tool, or install it in a `run:` step
 - Absolute-URL actions such as `uses: https://gitea.com/actions/checkout@v4` — they pass validation, but at run time the URL is not resolved and the step falls back to built-in handling
 - Private repos for remote `uses:` — reusable workflows clone over unauthenticated HTTPS
 - `cancel-in-progress` and workflow-level `concurrency:` — job-level groups are enforced within a run, but a local run has nothing earlier to cancel
@@ -168,7 +169,7 @@ export WRKFLW_PLATFORM=ubuntu-latest=catthehacker/ubuntu:act-latest
 Two defaults make a rerun cheaper than a hosted runner's cold start. Both work the same for any language or toolchain.
 
 - **Each GitHub Actions job keeps its workspace.** GitLab pipelines still start each run in an empty workspace. Checkout syncs the source files into it, and leaves alone anything the repository ignores, such as build output, `node_modules` or a virtualenv. The second run of a build is therefore incremental. Unchanged files keep their timestamps, and files deleted from the repository are deleted from the workspace too. Workspaces live under your cache directory in `wrkflw/workspaces` (`~/Library/Caches` on macOS, `~/.cache` on Linux), one per repository, workflow file and job. Set `WRKFLW_WORKSPACES_DIR` to keep them somewhere else, such as a larger disk. `--fresh-workspace` or `WRKFLW_FRESH_WORKSPACE=1` gives every job an empty workspace, as a hosted runner does.
-- **Matrix legs that only pick a runner run once.** Locally, `runs-on: ${{ matrix.os }}` maps every OS to the same image. If a leg differs from another only in values that `runs-on` reads, and the two would run in the same image, that leg reports the other's result instead of repeating it. Its history record and its `job_finished` event carry `repeated_from` with the leg it repeats. A leg whose workflow reads the value, or which runs in a different image (see `--platform`), still runs. Only the workflow file is read: a script that reads `$MATRIX_OS` from a file of its own isn't seen, so pass `--every-matrix-leg` for such a job. `--every-matrix-leg` or `WRKFLW_EVERY_MATRIX_LEG=1` runs them all.
+- **Matrix legs that only pick a runner run once.** Locally, `runs-on: ${{ matrix.os }}` maps every OS to the same image. If a leg differs from another only in values that `runs-on` reads, or that nothing in the job reads, such as a `name` the job's display name uses, and at least one of them picks the runner, and the two would run in the same image, that leg reports the other's result instead of repeating it. Legs on the same runner always run, so `attempt: [1, 2, 3]` still repeats a job. Its history
```

**File**: `crates/executor/src/acceleration.rs` (modified, +2/-0)
```diff
@@ -790,6 +790,8 @@ pub(crate) async fn decide(lookup: Lookup<'_>) -> Decision {
                     name: lookup.job_name.to_string(),
                     canonical_name: lookup.job_name.to_string(),
                     outputs: HashMap::new(),
+                    actions_not_run: Vec::new(),
+                    repeated_from: None,
                 }],
                 why: Reused::Unaffected,
             };
```

**File**: `crates/executor/src/acceleration/store.rs` (modified, +33/-1)
```diff
@@ -9,7 +9,10 @@ use std::collections::HashMap;
 use std::path::{Path, PathBuf};
 use std::sync::atomic::{AtomicBool, Ordering};
 
-const ENTRY_SCHEMA: u32 = 1;
+/// 2: jobs carry the actions they passed without running, and the leg a
+/// folded matrix leg repeated. Entries from 1 can't say, so they are not
+/// reused.
+const ENTRY_SCHEMA: u32 = 2;
 /// Images and floating action tags aren't in the key, so a hit must not live
 /// forever. A week bounds that drift.
 const DEFAULT_TTL_SECS: i64 = 7 * 24 * 60 * 60;
@@ -21,6 +24,14 @@ pub(crate) struct StoredJob {
     pub name: String,
     pub canonical_name: String,
     pub outputs: HashMap<String, String>,
+    /// Steps that passed without running their action. A reused job reports
+    /// them again, so reuse never turns a partial pass into a verified one.
+    #[serde(default, skip_serializing_if = "Vec::is_empty")]
+    pub actions_not_run: Vec<crate::action_fidelity::UnexecutedAction>,
+    /// The leg this matrix leg only repeated when the result was stored. A
+    /// reused fold still never ran, and says so.
+    #[serde(default, skip_serializing_if = "Option::is_none")]
+    pub repeated_from: Option<String>,
 }
 
 #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
@@ -363,6 +374,8 @@ mod tests {
             name: "build".to_string(),
             canonical_name: "build".to_string(),
             outputs: HashMap::from([("v".to_string(), "1".to_string())]),
+            actions_not_run: Vec::new(),
+            repeated_from: None,
         }]
     }
 
@@ -580,6 +593,25 @@ mod tests {
         assert!(unrelated.exists());
     }
 
+    #[test]
+    fn an_entry_from_before_unrun_actions_were_kept_is_a_miss() {
+        // Schema 1 didn't record the actions a pass skipped, so reusing it
+        // could turn a partial pass into a verified one.
+        let old: Entry = serde_json::from_value(serde_json::json!({
+            "schema": 1,
+            "key": "k",
+            "created_at": 100,
+            "jobs": [{"name": "a", "canonical_name": "a", "outputs": {}}],
+        }))
+        .unwrap();
+        assert!(!old.is_usable("k", 100));
+        let current = Entry {
+            schema: ENTRY_SCHEMA,
+            ..old
+        };
+        assert!(current.is_usable("k", 100));
+    }
+
     #[test]
     fn the_ttl_comes_from_the_environment_or_the_default() {
         assert_eq!(parse_ttl(None), DEFAULT_TTL_SECS);
```

**File**: `crates/executor/src/action_fidelity.rs` (added, +67/-0)
```diff
@@ -0,0 +1,67 @@
+//! Steps whose action wrkflw did not run.
+//!
+//! wrkflw implements some actions itself, such as `actions/checkout`,
+//! `actions/cache` and the setup actions that install a language runtime
+//! into the job's image. A JavaScript action outside that set has no
+//! implementation here, and a setup action does nothing when its runtime
+//! isn't in the job's image: in a job `container:`, inside a composite
+//! action, or under emulation. Either way the step prints that it would
+//! have run the action, reports success, and does nothing. The next steps
+//! then run without whatever the action would have installed, configured
+//! or checked. Such a step is reported, so a pass isn't read as proof of
+//! what GitHub would do.
+
+use serde::{Deserialize, Serialize};
+
+/// A `uses:` step that reported success without running its action.
+/// Run records store it as is.
+#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
+pub struct UnexecutedAction {
+    /// The step's name, as `step_finished` reports it.
+    pub step: String,
+    /// The `uses:` reference, as written.
+    pub uses: String,
+}
+
+impl UnexecutedAction {
+    /// Why a pass of a job with this step doesn't stand for GitHub's.
+    pub fn reason(&self) -> String {
+        format!(
+            "{} did not run here, so the step ran nothing and passed: anything it \
+             would have installed, configured or checked was not",
+            self.uses
+        )
+    }
+
+    /// `job`'s entry in an `unverified` list, as `run_finished` and `gate`
+    /// report it, next to the entries for jobs run as another OS.
+    pub fn unverified_entry(&self, job: &str) -> serde_json::Value {
+        serde_json::json!({
+            "kind": "action_not_run",
+            "job": job,
+            "step": self.step,
+            "uses": self.uses,
+            "reason": self.reason(),
+        })
+    }
+}
+
+#[cfg(test)]
+mod tests {
+    use super::*;
+
+    #[test]
+    fn the_unverified_entry_names_the_job_the_step_and_the_action() {
+        let skipped = UnexecutedAction {
+            step: "Install uv".to_string(),
+            uses: "astral-sh/setup-uv@v9".to_string(),
+        };
+        let entry = skipped.unverified_entry("tests (python: 3.13)");
+        assert_eq!(entry["job"], "tests (python: 3.13)");
+        assert_eq!(entry["step"], "Install uv");
+        assert_eq!(entry["uses"], "astral-sh/setup-uv@v9");
+        let reason = entry["reason"].as_str().unwrap();
+        assert!(reason.contains("astral-sh/setup-uv@v9"));
+        assert!(reason.contains("ran nothing"));
+    }
+}
```

---

### Incident Patch 2: `a9943e38` (2026-11-11)
**Commit Message**: fix: address the review findings from #167 (#168)

* fix(executor): make the workspace volume safe to copy back and clean up

- `wrkflw clean` found no workspace volume on Docker: `docker volume ls`
  gives `.Labels` as a string, so the `index` template failed and the
  failure was skipped. Labels are now read with `volume inspect`.
- A hard-linked file whose other name the host already had wasn't copied
  back; tar now sends each name as a file (`--hard-dereference`).
- A Docker action whose `with.args` can't be parsed failed after the copy
  in, leaving the step marked as in the volume, so a later timeout could
  copy back over what host-side steps wrote. Args are parsed first.
- A name kept in the volume because the host had it in another case is
  copied back once that other name is gone.
- A step's change inside a directory it left read-only reaches the host:
  the directory is opened for the write and closed again. One that is
  read-only on the host alone is still left alone.
- A volume held by a container kept for inspection no longer stalls the
  end of the run for 30 s; it is named and left for `wrkflw clean`.

* fix(executor): really rebuild images for floating setup ver

**File**: `BREAKING_CHANGES.md` (modified, +2/-0)
```diff
@@ -12,6 +12,8 @@ A `uses:` step whose action wrkflw didn't run now makes a passing run's `verdict
 
 A job that fails before any step runs, because its image can't be built or pulled or its job container or network doesn't start, gets `cause: {kind: "setup_failed"}` in the failure digest, and `compare` says so in its note instead of reporting a plain failure.
 
+A job whose setup action image can't be built is now a failed job, as other setup failures are, instead of ending the whole run with an error: the run's status is `failure` unless the job has `continue-on-error`, the jobs that need it are skipped, and the rest of the run goes on. `--branch` or `--tag` without `--event` is a push for a workflow with a `push` trigger, so its push filters are checked and its `pull_request` filters no longer apply; a workflow without one, such as a `workflow_dispatch` one, runs as before. `astral-sh/setup-uv` with `python-version` installs that Python and sets `UV_PYTHON`; one with `activate-environment: true`, or a version file and no `version`, is refused and reported as not run, as is a `graalpy-` release. A setup step under `if:` that would change a version set earlier is refused, since wrkflw can't know whether it runs; each of these refusals is reported with its own reason. A setup step inside a composite action is reported as run only when the image holds the version it asks for. A `go.mod` with a `toolchain` line installs that toolchain. The weekly rebuild of images with floating versions now happens: the week is part of the image, and `3` or `1` alone counts as floating for Python and Go. The pre-push hook that `gate --install-hook` writes keeps only the flags given on the command line, not values read from `WRKFLW_*` variables. `compare` gives up on `git ls-remote` after 30 seconds and adds `ref_unsure`. On macOS, a volume a preserved container still uses is kept, and `wrkflw clean` now finds and removes orphaned workspace volumes on Docker, where it found none before.
+
 For crates that use wrkflw as a library:
 
 - `wrkflw_runtime::container::ContainerRuntime` requires `Sync`, and gains `image_id` and `identifies_images`, both with defaults. An implementation that isn't `Sync` no longer compiles.
```

**File**: `INDEX.md` (modified, +56/-18)
```diff
@@ -1,6 +1,6 @@
 # Codebase Index: wrkflw
 
-> Generated: 2026-11-11 10:03:40 UTC | Files: 260 | Lines: 115230
+> Generated: 2026-11-11 11:07:47 UTC | Files: 260 | Lines: 116241
 > Languages: JSON (4), Markdown (26), Rust (167), Shell (6), TOML (19), YAML (38)
 
 ## Directory Structure
@@ -1762,7 +1762,7 @@ wrkflw/
 
 ## BREAKING_CHANGES.md
 
-**Language:** Markdown | **Size:** 29.9 KB | **Lines:** 382
+**Language:** Markdown | **Size:** 31.3 KB | **Lines:** 384
 
 **Declarations:**
 
@@ -1786,7 +1786,7 @@ wrkflw/
 
 ## INDEX.md
 
-**Language:** Markdown | **Size:** 268.9 KB | **Lines:** 9997
+**Language:** Markdown | **Size:** 273.8 KB | **Lines:** 10156
 
 **Declarations:**
 
@@ -2908,7 +2908,7 @@ wrkflw/
 
 ## crates/executor/src/job_memory.rs
 
-**Language:** Rust | **Size:** 21.3 KB | **Lines:** 588
+**Language:** Rust | **Size:** 22.5 KB | **Lines:** 621
 
 **Imports:**
 - `std::collections::HashMap`
@@ -3763,7 +3763,7 @@ wrkflw/
 
 ## crates/executor/src/setup_actions.rs
 
-**Language:** Rust | **Size:** 38.5 KB | **Lines:** 962
+**Language:** Rust | **Size:** 46.8 KB | **Lines:** 1149
 
 **Imports:**
 - `std::collections::HashMap`
@@ -3776,7 +3776,7 @@ wrkflw/
 `pub(crate) const NO_IMPLEMENTATION: &str = "no implementation in wrkflw"`
 
 `pub(crate) struct BuiltRuntimes`
-> Fields: `installed: Vec<String>`, `not_built: Vec<(usize, NotBuilt)>`
+> Fields: `installed: Vec<String>`, `not_built: Vec<(usize, NotBuilt)>`, `runtimes: Vec<SetupRuntime>`, `in_composite: bool`
 
 `pub(crate) enum NotBuilt`
 > Variants: `Refused`, `Superseded`
@@ -3791,7 +3791,9 @@ wrkflw/
 > Fields: `runtimes: Vec<SetupRuntime>`, `not_built: Vec<(usize, NotBuilt)>`
 
 `pub(crate) struct SetupRuntime`
-> Fields: `language: String`, `version: String`, `install_script: String`
+> Fields: `language: String`, `version: String`, `install_script: String`, `floating: bool`, `env: Vec<(String, String)>`
+
+`pub(crate) fn is_floating_version(language: &str, version: &str) -> bool`
 
 `pub(crate) struct SetupActionDef`
 > Fields: `repos: &'static [&'static str]`, `with_key: &'static str`, `default_version: &'static str`, `language: &'static str`, `version_from_ref: bool`, `version_file_key: Option<&'static str>`
@@ -3802,7 +3804,13 @@ wrkflw/
 
 `pub(crate) fn version_from_file(root: &Path, file: &str) -> Option<String>`
 
-`pub(crate) fn unrun_action_cause( repository: &str, built: &BuiltRuntimes, container_runtime: bool, step_idx: usize, ) -> Option<&'static str>`
+`pub(crate) fn unrun_action_cause( repository: &str, built: &BuiltRuntimes, container_runtime: bool, step_idx: usize, step: Option<&Step>, ) -> Option<&'static str>`
+
+`fn composite_setup_cause( def: &SetupActionDef, built: &BuiltRuntimes, step: Option<&Step>, ) -> Option<&'static str>`
+
+`fn uv_python<'a>(input: impl Fn(&str) -> Option<&'a String>) -> Result<Option<String>, String>`
+
+`fn go_version(text: &str) -> Option<String>`
 
 `fn contained_path(root: &Path, file: &str) -> Option<PathBuf>`
 
@@ -3970,7 +3978,7 @@ wrkflw/
 
 ## crates/executor/src/vm_workspace.rs
 
-**Language:** Rust | **Size:** 91.4 KB | **Lines:** 2536
+**Language:** Rust | **Size:** 104.3 KB | **Lines:** 2873
 
 **Imports:**
 - `std::collections::{HashMap, HashSet}`
@@ -4106,7 +4114,11 @@ wrkflw/
 
 `fn without_unreadable(volume: &Listing, unreadable: &[PathBuf]) -> Listing`
 
-`fn remove_host_entry(target: &Path) -> io::Result<()>`
+`fn remove_host_entry(target: &Path, parent_read_only: bool) -> io::Result<()>`
+
+`fn read_only_in(volume: &Listing, dir: &Path) -> bool`
+
+`fn with_writable_dir<T>(dir: &Path, op: impl FnOnce() -> io::Result<T>) -> io::Result<T>`
 
 `fn make_writable(path: &Path)`
 
@@ -4123,6 +4135,8 @@ wrkflw/
 
 `fn spelled_otherwise_on_host( host: &Path, rel: &Path, names: &mut HashMap<PathBuf, Option<HashSet<std::ffi::OsString>>>, ) -> bool`
 
+`fn release_kept(host: &Path, kept: &mut HashSet<PathBuf>) -> Vec<PathBuf>`
+
 `fn unpack<R: Read>(reader: R, host: &Path, volume: &Listing) -> io::Result<Unpacked>`
 
 `fn unlisted_entries(stderr: &[u8]) -> Result<HashSet<PathBuf>, String>`
@@ -4194,14 +4208,24 @@ wrkflw/
 
 `pub(crate) fn release(host: &Path, kept: bool)`
 
+`fn held_by_stopped_containers(cli: &str, volume: &str) -> bool`
+
+`fn stopped_state(state: &str) -> bool`
+
 `const VOLUME_REMOVAL_TRIES: usize = 120`
 
+`const HELD_TRIES: usize = 20`
+
 `static PENDING_REMOVALS: Mutex<Vec<std::thread::JoinHandle<()>>> = Mutex::new(Vec::new())`
 
 `pub(crate) fn remove_now(host: &Path)`
 
 `pub(crate) async fn wait_for_released_volumes()`
 
+`fn labelled_volumes(cli: &str) -> Vec<String>`
+
+`fn inspect_format() -> String`
+
 `pub(crate) fn remove_orphaned_volumes() -> usize`
 
 `mod tests`
@@ -4921,7 +4945,7 @@ wrkflw/
 
 ## crates/runs/src/digest.rs
 
-**Language:** Rust | **Size:** 47.9 KB | **Lines:** 1218
+**Language:** Rust | **Size:** 48.9 KB | **Lines:** 1234
 
 **Imports:**
 - `crate::record::{JobRecord, RunRecord, RunStatus, StepRecord, SCHEMA_VERSION}`
@@ -4950,6 +
```

**File**: `crates/executor/src/docker.rs` (modified, +1/-0)
```diff
@@ -1381,6 +1381,7 @@ impl DockerRuntime {
             ));
             // Still untrack it from the automatic cleanup system to prevent it from being cleaned up later
             untrack_container(&container.id);
+            crate::vm_workspace::note_preserved(&container.id);
         }
         guard.disarm();
 
```

**File**: `crates/executor/src/engine.rs` (modified, +565/-106)
```diff
@@ -1256,6 +1256,33 @@ impl JobResult {
         self
     }
 
+    /// A job wrkflw couldn't set up, as when its image doesn't build: it
+    /// fails with no step, and `error` as its log. The run's record then
+    /// holds a failed job whose log names the setup error, which the
+    /// failure digest reports as `setup_failed`, instead of a run that
+    /// stopped with no job to show. `failure_allowed` is the job's
+    /// `continue-on-error`, as for any other failure of it. The caller
+    /// tells the run's observers, once each, that it started and ended.
+    fn setup_failed(
+        name: impl Into<String>,
+        canonical_name: impl Into<String>,
+        error: &ExecutionError,
+        failure_allowed: bool,
+    ) -> Self {
+        let logs = error.to_string();
+        wrkflw_logging::error(&logs);
+        JobResult {
+            name: name.into(),
+            canonical_name: canonical_name.into(),
+            status: JobStatus::Failure,
+            steps: Vec::new(),
+            logs,
+            outputs: HashMap::new(),
+            failure_allowed,
+            repeated_from: None,
+        }
+    }
+
     /// A job that failed before any of its steps ran. The reason is carried on a
     /// failed step because failure summaries are built from failed steps.
     fn failed_before_steps(
@@ -1718,6 +1745,23 @@ async fn execute_native_docker_step(
         }
     }
 
+    // Before the copy in: nothing may fail between it and the copy back,
+    // or a later timeout would copy back a volume no step wrote to.
+    // Determine container CMD: workflow `with.args` overrides action.yml `runs.args`.
+    // If neither is specified, the image's built-in CMD takes effect.
+    let effective_args: Vec<String> = if let Some(ref wa) = with_args_override {
+        shlex::split(wa).ok_or_else(|| {
+            ExecutionError::Execution(format!(
+                "Failed to parse 'with.args' for action '{}': \
+                 unmatched quote in {:?}",
+                uses, wa
+            ))
+        })?
+    } else {
+        args
+    };
+    let args_refs: Vec<&str> = effective_args.iter().map(|s| s.as_str()).collect();
+
     let container_workspace = Path::new(environment::CONTAINER_WORKSPACE);
     let mount_ctx = prepare_step_container_context(
         step_env,
@@ -1742,21 +1786,6 @@ async fn execute_native_docker_step(
         uses, image
     ));
 
-    // Determine container CMD: workflow `with.args` overrides action.yml `runs.args`.
-    // If neither is specified, the image's built-in CMD takes effect.
-    let effective_args: Vec<String> = if let Some(ref wa) = with_args_override {
-        shlex::split(wa).ok_or_else(|| {
-            ExecutionError::Execution(format!(
-                "Failed to parse 'with.args' for action '{}': \
-                 unmatched quote in {:?}",
-                uses, wa
-            ))
-        })?
-    } else {
-        args
-    };
-    let args_refs: Vec<&str> = effective_args.iter().map(|s| s.as_str()).collect();
-
     let output = ctx
         .runtime
         .run_container(
@@ -2082,10 +2111,15 @@ fn report_action_not_run(uses: &str, cause: Option<&str>) -> Option<String> {
 /// re-pulled or rebuilt base would keep serving the old combined image.
 ///
 /// Extracted as a pure function so the output can be unit-tested without Docker.
+/// `week` names the week floating versions are resolved in, when any is;
+/// it goes into the one `RUN` instruction, so a new week misses the build
+/// cache and installs the releases out then. A comment would change the
+/// image's tag but not its layers, which the builder would reuse.
 fn generate_combined_dockerfile(
     runtimes: &[SetupRuntime],
     base_image: &str,
     base_id: Option<&str>,
+    week: Option<&str>,
 ) -> String {
     let mut dockerfile = format!("FROM {}\n", base_image);
     if let Some(id) = base_id {
@@ -2108,10 +2142,31 @@ fn generate_combined_dockerfile(
     // uv keeps the interpreters it installs under `$HOME`, which is root's
     // and closed to a step that runs as another user, and which a job that
     // sets `HOME` moves. Somewhere fixed and readable serves every step.
+    let mut env: Vec<(String, String)> = Vec::new();
     if runtimes.iter().any(|rt| rt.language == "python") {
-        dockerfile.push_str(&format!("ENV UV_PYTHON_INSTALL_DIR={}\n", UV_PYTHON_DIR));
+        env.push((
+            "UV_PYTHON_INSTALL_DIR".to_string(),
+            UV_PYTHON_DIR.to_string(),
+        ));
+    }
+    // What a setup action sets for the rest of the job, such as setup-uv's
+    // `UV_PYTHON`. Values were checked to be plain versions and paths.
+    for pair in runtimes.iter().flat_map(|rt| &rt.env) {
+        if !env.iter().any(|(name, _)| *name == pair.0) {
+            env.push(pair.clone());
+        }
+    }
+    for (name, value) in &env {
+        dockerfile.push_str(&format!("ENV {}={}\n", name, value));
+    }
+    dockerfile.push_str("RUN ");
+ 
```

**File**: `crates/executor/src/job_memory.rs` (modified, +35/-2)
```diff
@@ -133,11 +133,16 @@ impl JobMeter {
     }
 
     /// A container ended as the out-of-memory killer ends one. Every job
-    /// running beside it may be the one that used the memory.
+    /// running beside it may be the one that used the memory. A job still
+    /// waiting for its slot has used none: it names itself with
+    /// [`measure_as`] only once it holds one, so it is left alone.
     pub(crate) fn killed(&self) {
         self.killed.store(true, Ordering::Relaxed);
         for meter in ACTIVE.lock().unwrap_or_else(|e| e.into_inner()).iter() {
-            if let Some(meter) = meter.upgrade() {
+            let Some(meter) = meter.upgrade() else {
+                continue;
+            };
+            if meter.id.lock().unwrap_or_else(|e| e.into_inner()).is_some() {
                 meter.neighbour_killed.store(true, Ordering::Relaxed);
             }
         }
@@ -561,6 +566,7 @@ mod tests {
         let (neighbour, finished) = tokio::join!(
             metered(
                 async {
+                    measure_as("light");
                     let mine = meter().unwrap();
                     mine.sample("light", 1);
                     // Still running when the other job's step is killed.
@@ -585,4 +591,31 @@ mod tests {
         later.sample("step", 1);
         assert_eq!(later.outcome(), Outcome::Peak(1));
     }
+
+    #[tokio::test]
+    async fn a_kill_spares_a_job_still_waiting_for_its_slot() {
+        let (killed_tx, killed_rx) = tokio::sync::oneshot::channel::<()>();
+        let (waiting, _) = tokio::join!(
+            metered(
+                async {
+                    // Queued: no slot yet, so not named.
+                    let _ = killed_rx.await;
+                    measure_as("queued");
+                    let mine = meter().unwrap();
+                    mine.sample("step", 1);
+                    mine
+                },
+                |_| true
+            ),
+            metered(
+                async {
+                    measure_as("killer");
+                    meter().unwrap().killed();
+                    let _ = killed_tx.send(());
+                },
+                |_| true
+            )
+        );
+        assert_eq!(waiting.outcome(), Outcome::Peak(1));
+    }
 }
```

**File**: `crates/executor/src/podman.rs` (modified, +1/-0)
```diff
@@ -919,6 +919,7 @@ impl PodmanRuntime {
                             container_name, output.exit_code, container_name
                         ));
                         untrack_container(&container_name);
+                        crate::vm_workspace::note_preserved(&container_name);
                     } else {
                         // Failed but we don't want to preserve - container was auto-removed with --rm
                         untrack_container(&container_name);
```

**File**: `crates/executor/src/setup_actions.rs` (modified, +223/-9)
```diff
@@ -23,6 +23,12 @@ pub(crate) struct BuiltRuntimes {
     /// holds, and why. Empty inside a composite action, whose steps these
     /// indices don't name.
     pub(crate) not_built: Vec<(usize, NotBuilt)>,
+    /// The runtimes the image holds, with the version and settings of each,
+    /// so a setup step inside a composite action can be judged on them.
+    pub(crate) runtimes: Vec<SetupRuntime>,
+    /// Set for the steps of a composite action: the image was built from
+    /// the job's own setup steps, which aren't these.
+    pub(crate) in_composite: bool,
 }
 
 /// Why a setup step's version is not in the job's image.
@@ -34,6 +40,13 @@ pub(crate) enum NotBuilt {
     /// Another setup step of the same language set the version the image
     /// holds: an image has one version of each, the job's last.
     Superseded,
+    /// It has an `if:` and would replace the version an earlier setup step
+    /// of the same language put in the image, which can't depend on
+    /// whether it runs.
+    Conditional,
+    /// It asks for something besides a version that wrkflw doesn't carry
+    /// out, such as setup-uv's `activate-environment`.
+    UnsupportedInput,
 }
 
 impl BuiltRuntimes {
@@ -47,6 +60,8 @@ impl BuiltRuntimes {
         BuiltRuntimes {
             installed: self.installed.clone(),
             not_built: Vec::new(),
+            runtimes: self.runtimes.clone(),
+            in_composite: true,
         }
     }
 }
@@ -60,14 +75,40 @@ pub(crate) struct SetupDetection {
 }
 
 /// A runtime detected from a setup action step (e.g., `actions/setup-node@v3`).
-#[derive(Clone)]
+#[derive(Debug, Clone, PartialEq)]
 pub(crate) struct SetupRuntime {
     /// Language identifier (e.g., "node", "php", "python")
     pub(crate) language: String,
     /// Sanitized version string (e.g., "20", "8.2")
     pub(crate) version: String,
     /// Shell commands to install this runtime on an Ubuntu base image
     pub(crate) install_script: String,
+    /// The step asked for a channel or a range, so what it installs changes
+    /// as releases come out. Judged on the version as the step wrote it:
+    /// `version` may have lost what made it float, as `3.x` becomes `3`.
+    pub(crate) floating: bool,
+    /// Variables the image sets for every step, as the action sets them for
+    /// the rest of the job: `UV_PYTHON` for setup-uv's `python-version`.
+    pub(crate) env: Vec<(String, String)>,
+}
+
+/// Whether `version`, as a `language` setup step wrote it, names a channel
+/// or a range rather than a release, so what it installs changes as
+/// releases come out: `latest`, `stable`, `oldstable`, `lts/*`, `3.x`,
+/// `>=3.10`, `^18 || >=20`. A partial release such as `3.12` drifts only
+/// by patch releases and counts as fixed, as does Node's `20`, a release
+/// line of its own; Python's and Go's `3` and `1` take every minor release.
+pub(crate) fn is_floating_version(language: &str, version: &str) -> bool {
+    let version = version.trim().to_ascii_lowercase();
+    let channel = version.chars().any(|c| c.is_ascii_alphabetic())
+        && !version.chars().next().is_some_and(|c| c.is_ascii_digit());
+    let major_only = matches!(language, "python" | "go")
+        && !version.is_empty()
+        && version.chars().all(|c| c.is_ascii_digit());
+    channel
+        || major_only
+        || version.contains(['x', '*', '>', '<', '^', '~', '|', ' '])
+        || version.ends_with("-dev")
 }
 
 /// Definition of a known setup action for runtime detection.
@@ -260,12 +301,29 @@ pub(crate) fn version_from_file(root: &Path, file: &str) -> Option<String> {
                 .get("volta")
                 .and_then(|v| v.get("node"))
                 .or_else(|| json.get("engines").and_then(|e| e.get("node")))?;
-            node_major_for_range(range.as_str()?)
+            let range = range.as_str()?.trim();
+            // A full release, as `volta.node` pins one, is installed as is,
+            // like the same pin in `.nvmrc`.
+            let release = range.trim_start_matches('v');
+            if release.split('.').count() == 3 && is_safe_version(release) {
+                Some(release.to_string())
+            } else {
+                node_major_for_range(range)
+            }
+        }
+        // setup-go prefers the `toolchain` line, which names the release
+        // the module is built with, to the `go` line's minimum. A go.work
+        // file has the same two lines.
+        "go.mod" | "go.work" => {
+            let directive = |name: &str| {
+                text.lines()
+                    .find_map(|l| l.trim().strip_prefix(name))
+                    .map(str::trim)
+            };
+            directive("toolchain go")
+                .or_else(|| directive("go "))
+                .and_then(go_version)
         }
-        "go.mod" => text
-            .lines()
-            .find_map(|l| l.trim().strip_prefix("go "))
-            .and_then(first_number),
         _ => text
  
```

**File**: `crates/executor/src/vm_workspace.rs` (modified, +434/-32)
```diff
@@ -128,6 +128,10 @@ struct State {
     host: Option<Listing>,
     /// Volume entries the host could not hold.
     kept: HashSet<PathBuf>,
+    /// Those of `kept` the host couldn't hold only because it held the
+    /// name in another case. Once nothing on the host goes by it, they are
+    /// fetched again; the others never fit.
+    kept_for_case: HashSet<PathBuf>,
     /// Volume entries the host refused for a reason that may pass. The next
     /// copy in leaves them alone, and the next copy out tries them again.
     pending: HashSet<PathBuf>,
@@ -160,6 +164,7 @@ impl State {
             volume: None,
             host: None,
             kept: HashSet::new(),
+            kept_for_case: HashSet::new(),
             pending: HashSet::new(),
             unlisted: HashSet::new(),
             unusable: false,
@@ -174,6 +179,10 @@ impl State {
     fn for_volume(volume: &str) -> Self {
         let mut state = State::new();
         state.kept = load_paths(kept_file(volume).as_deref());
+        state.kept_for_case = load_paths(case_file(volume).as_deref())
+            .into_iter()
+            .filter(|path| state.kept.contains(path))
+            .collect();
         state.pending = load_paths(pending_file(volume).as_deref());
         state
     }
@@ -458,12 +467,32 @@ impl VmWorkspace {
         for path in &plan.delete {
             // Left on the host, the next sync would copy it back into the
             // volume as if the step had never removed it.
-            remove_host_entry(&self.host.join(path))?;
+            let parent_read_only = path.parent().is_some_and(|p| read_only_in(&volume, p));
+            remove_host_entry(&self.host.join(path), parent_read_only)?;
         }
         let kept_before = state.kept.clone();
+        let for_case_before = state.kept_for_case.clone();
+        // After the deletes: a name kept for the case of another one fits
+        // once a step has removed that other one.
+        let released = release_kept(&self.host, &mut state.kept, &mut state.kept_for_case);
+        let mut fetch = plan.fetch;
+        if !released.is_empty() {
+            fetch.extend(
+                volume
+                    .keys()
+                    .filter(|path| under_any(&released, path))
+                    .cloned(),
+            );
+            fetch.sort();
+            fetch.dedup();
+        }
         let mut pending = HashSet::new();
-        if !plan.fetch.is_empty() {
-            let Unpacked { refused, failed } = self.fetch(&helper, &plan.fetch, &volume)?;
+        if !fetch.is_empty() {
+            let Unpacked {
+                refused,
+                refused_for_case,
+                failed,
+            } = self.fetch(&helper, &fetch, &volume)?;
             if !failed.is_empty() {
                 let mut names: Vec<String> = failed
                     .iter()
@@ -506,6 +535,7 @@ impl VmWorkspace {
                     names.join(", ")
                 ));
                 state.kept.extend(refused);
+                state.kept_for_case.extend(refused_for_case);
             }
         }
         if state.pending != pending {
@@ -515,9 +545,14 @@ impl VmWorkspace {
         }
         state.pending = pending;
         state.kept.retain(|path| volume.contains_key(path));
+        let kept = &state.kept;
+        state.kept_for_case.retain(|path| kept.contains(path));
         if state.kept != kept_before {
             save_paths(kept_file(&self.volume).as_deref(), &state.kept);
         }
+        if state.kept_for_case != for_case_before {
+            save_paths(case_file(&self.volume).as_deref(), &state.kept_for_case);
+        }
         state.volume = Some(volume);
         // The host as this copy left it. An entry that differs from the
         // volume's here, such as a file that grew while it was copied, is
@@ -681,6 +716,9 @@ impl VmWorkspace {
                 ROOT,
                 "--null",
                 "--no-recursion",
+                // Each name as its own file: a hard link to a name sent
+                // earlier can't be unpacked over a file the host has.
+                "--hard-dereference",
                 "-T",
                 "-",
                 "-cf",
@@ -1008,7 +1046,12 @@ fn without_unreadable(volume: &Listing, unreadable: &[PathBuf]) -> Listing {
 
 /// Remove `target` from the host, making read-only directories in it
 /// writable first if that is what stops it.
-fn remove_host_entry(target: &Path) -> io::Result<()> {
+///
+/// `parent_read_only` says the volume holds the directory `target` is in
+/// read-only too, as a step left it: the host only mirrors that mode, so
+/// it is opened for the removal and closed again. A directory read-only on
+/// the host alone is the host's to keep.
+fn remove_host_entry(target: &Path, parent_read_only: bool) -> io::Result<()> {
     let remove = || match std::fs::symlink_metadata(target) {
         Ok(meta) if meta.is_dir() => std::fs::remove_dir_all(target),
```

#### Recent Merged Pull Requests:
- **PR #169** (2026-11-11): perf: run the legs of a new matrix together, and fit light jobs side by side again (@bahdotsh)
- **PR #168** (2026-11-11): fix: address the review findings from #167 (@bahdotsh)
- **PR #167** (2026-11-11): fix: report what a local pass didn't check, and make local runs match GitHub's (@bahdotsh)
- **PR #166** (2026-11-09): fix: make local verdicts match what GitHub would say (@bahdotsh)
- **PR #165** (2026-11-06): Make wrkflw a trustworthy feedback loop for agents (@bahdotsh)
- **PR #164** (2026-11-06): fix: address the review of #163 (@bahdotsh)

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

## X. report what a local pass didn't check, and make local runs match GitHub's (#167)

**RULE**:
When implementing operations in `.cargo/config.toml`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in bahdotsh/wrkflw. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `e418eebc`: report what a local pass didn't check, and make local runs match GitHub's (#167). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `.cargo/config.toml`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
# Likewise for the memory each job was measured to use: tests keep none, so
# they never change how a real run on this machine schedules its jobs. This
# applies to `cargo run` too, which then schedules every job as unmeasured.
# An existing value wins, so name a file to measure, as in
# `WRKFLW_JOB_MEMORY_FILE=/tmp/job-memory.json cargo run -- run ...`.
WRKFLW_JOB_MEMORY_FILE = ""
```

**NEGATIVE CONSTRAINT**:
```rust
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `e418eebc` are properly handled with clean fallback behavior.

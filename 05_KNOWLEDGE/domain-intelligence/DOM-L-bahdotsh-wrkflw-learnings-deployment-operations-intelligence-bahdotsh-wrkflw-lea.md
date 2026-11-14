# Domain L — Deployment & Operations Intelligence: Deployment & Operations Intelligence: bahdotsh-wrkflw-learnings Core Invariants

<!-- PROVENANCE_START
{
  "source_repository": "bahdotsh-wrkflw-learnings",
  "source_url": "unknown",
  "source_version": "HEAD",
  "license": "Open-Source",
  "timestamp": "2026-11-14T12:04:18.716Z",
  "ai_provider": "universal-multi-artifact-distributor",
  "generator_version": "2.0.0-universal",
  "learning_id": "LEARN-EVO-bahdotsh-wrkflw-learnings",
  "canonical_classification": "domain_intelligence"
}
PROVENANCE_END -->
> **Provenance**: Harvested from [bahdotsh-wrkflw-learnings](unknown) (Revision: `HEAD`).  
> **License**: Open-Source | **Timestamp**: `2026-11-14T12:04:18.716Z`  
> **Learning ID**: `LEARN-EVO-bahdotsh-wrkflw-learnings`


## 1. Domain Taxonomy & Context
- **Canonical Domain**: Domain L (Deployment & Operations Intelligence)
- **Secondary Corroborating Domains**: G (Architecture Intelligence), H (Technical Construction Intelligence), A (Human & Need Intelligence), K (Quality & Verification Intelligence), I (Content & Information Intelligence), J (Search & Distribution Intelligence), M (Feedback & Evolution Intelligence), D (Research & Knowledge Intelligence), B (Product Intelligence), F (Design Intelligence)
- **Confidence Rating**: 53%

## 2. Core Domain Invariants & Discovered Laws
The following architectural invariants have been empirically discovered and recorded from bahdotsh-wrkflw-learnings:

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/bahdotsh-wrkflw-learnings.md`  
> **Source**: github ([https://github.com/bahdotsh/wrkflw](https://github.com/bahdotsh/wrkflw))  
> **Source Version**: `7b284277`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-11-14T12:04:07.231Z  
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
> **Harvest Timestamp**: 2026-11-14T12:04:07.224Z  
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
- **Issue #171** (2026-11-13): **fix: agree with GitHub on real repositories, and build job images faster**
  *Symptoms*: ## Problem  Running real repositories was slow and sometimes wrong:  - Each leg of a matrix rebuilt the same packages in its own image. - An image that failed to build was built a second time at the job's turn. - A busy engine failed container creation at 15 seconds. - A few parsing rules disagreed with GitHub.  ## Changes  **Image builds** - The job image is split into a shared packages layer plus one layer per runtime. The shared layers are built once, as an image of their own, where the runtime reuses build layers (Docker, Podman; not Kubernetes). - Images are built ahead while a job waits for its turn, capped at four across the process, and one at a time where the run limits its jobs. - BuildKit is used through the `docker` CLI where it builds into the same engine; otherwise the engine's own builder is used. `WRKFLW_IMAGE_BUILDER=classic` skips BuildKit. - A build that failed on its own is remembered for the run and not repeated. A build that timed out or lost its connection is tried again. - The runner's Node.js comes from nodejs.org, checked against its published checksum, with the distribution's package as the fallback. - Each runtime's install refreshes the package lists first, since it is now a layer of its own.  **Containers** - The engine gets 120 seconds to create or start a container. One whose creation timed out is tracked by name and removed later. - Cleanup passes quietly over a container that was never created, and removes by force one that didn't stop in tim

- **Issue #170** (2026-11-13): **perf: build job images faster, and start no container for a step that only prints**
  *Symptoms*: ## Summary  On pallets/click (11 jobs, 65 s on GitHub), a first run with no images took 327 s and a warm run 52–72 s. Most of that was not the tests. This cuts the cold run to about 130 s and the warm run to 36–38 s, with all 11 jobs still agreeing with GitHub.  | Run on click (GitHub: 65 s) | Before | After | |---|---|---| | No images, no build cache | 327 s | 125 s, 135 s | | Fresh clone, images present | 65–73 s | 64 s | | Warm, second run onward | 52–72 s | 36–38 s |  ## What changed  - **Shared image layers.** A job's runtime image was one `RUN` with the apt packages, Node.js, uv and the interpreter, so nine matrix legs each spent a minute and 800 MB on the same packages. The packages now have their own layer and each runtime follows in its own. - **BuildKit for runtime images.** The engine's own builder saves a layer after every instruction, which took about as long as the installs. Runtime images are now built through `docker buildx build`. If that doesn't produce the image, the old build runs and reports as before. `WRKFLW_IMAGE_BUILDER=classic` keeps to the old builder. - **Runner Node.js from nodejs.org**, checked against its published checksum: 3.7 s instead of 14.5 s and a second `apt-get update`. - **Images built ahead.** A job used to build its image only once it had room in the VM. Images are now built while jobs wait. The first build of a set of shared packages goes alone and the rest start when its layers exist. - **No container for a step that only prints.**
  **Post-Mortem & Fix Analysis**:
  > Closing: both commits here (2e4dfab, 55556cf) landed on main through #171, which was stacked on this branch and merged as 7b28427. Nothing left to merge.

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

### Incident Patch 1: `7b284277` (2026-11-13)
**Commit Message**: fix: agree with GitHub on real repositories, and build job images faster (#171)

* perf(executor): build job images faster, and start no container for a step that only prints

A first run with no images took 327 s for pallets/click's 11 jobs, and a
warm run 52-72 s, against 65 s on GitHub. Most of it was not the tests.

Each job's runtime image was one RUN holding the apt packages, Node.js,
uv and the interpreter, so nine matrix legs each spent a minute and
800 MB on the same packages. The packages now have a layer of their own
and each runtime follows in its own, so legs differ only in the
interpreter.

The engine's own builder saves a layer after every instruction, which
took about as long as the installs. Runtime images are now built with
BuildKit through `docker buildx build`; if that doesn't produce the
image, the old build runs and reports as before.
WRKFLW_IMAGE_BUILDER=classic keeps to the old builder.

The runner's Node.js comes from nodejs.org's own build, checked against
its published checksum: 3.7 s where the distribution's package took
14.5 s and a second `apt-get update`.

A job built its image only once it had room in the VM, so builds ran
one after another behind th

**File**: `INDEX.md` (modified, +136/-19)
```diff
@@ -1,7 +1,7 @@
 # Codebase Index: wrkflw
 
-> Generated: 2026-11-11 17:02:11 UTC | Files: 260 | Lines: 117213
-> Languages: JSON (4), Markdown (26), Rust (167), Shell (6), TOML (19), YAML (38)
+> Generated: 2026-11-13 12:17:35 UTC | Files: 262 | Lines: 118189
+> Languages: JSON (4), Markdown (26), Rust (169), Shell (6), TOML (19), YAML (38)
 
 ## Directory Structure
 
@@ -34,6 +34,7 @@ wrkflw/
         action_fidelity.rs
         action_resolver.rs
         artifacts.rs
+        buildkit.rs
         cache.rs
         checkout_sync.rs
         container_guard.rs
@@ -44,6 +45,7 @@ wrkflw/
         events.rs
         expression.rs
         github_env_files.rs
+        image_build.rs
         job_memory.rs
         job_session.rs
         kubernetes/
@@ -1786,7 +1788,7 @@ wrkflw/
 
 ## INDEX.md
 
-**Language:** Markdown | **Size:** 275.9 KB | **Lines:** 10209
+**Language:** Markdown | **Size:** 275.7 KB | **Lines:** 10197
 
 **Declarations:**
 
@@ -2362,6 +2364,59 @@ wrkflw/
   `pub async fn list(&self) -> Vec<String>`
 
 
+`mod tests`
+
+---
+
+## crates/executor/src/buildkit.rs
+
+**Language:** Rust | **Size:** 16.9 KB | **Lines:** 427
+
+**Imports:**
+- `bollard::Docker`
+- `std::path::Path`
+- `wrkflw_runtime::container::ContainerError`
+
+**Declarations:**
+
+`const IMAGE_BUILDER_ENV: &str = "WRKFLW_IMAGE_BUILDER"`
+
+`fn buildkit_wanted(setting: Option<&str>) -> bool`
+
+`static BUILDKIT_IMAGES_UNSEEN: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false)`
+
+`pub(crate) async fn builds_here(docker: &Docker) -> bool`
+
+`async fn buildkit_available(docker: &Docker) -> bool`
+
+`async fn buildkit_builds_here(docker: &Docker) -> bool`
+
+`fn warn_buildkit_elsewhere(why: &str)`
+
+`async fn docker_cli(args: &[&str]) -> Option<String>`
+
+`fn buildx_driver(inspect: &str) -> Option<&str>`
+
+`fn same_engine(cli: Option<&str>, api: Option<&str>) -> Option<bool>`
+
+`pub(crate) enum Next`
+> Variants: `Built`, `EngineBuilds`, `Failed`
+
+`pub(crate) async fn build( dockerfile: &Path, tag: &str, context_dir: &Path, image_exists: impl std::future::Future<Output = Result<bool, ContainerError>>, ) -> Next`
+
+`fn after_build( tag: &str, engine_has_it: Result<bool, ContainerError>, unseen: &std::sync::atomic::AtomicBool, ) -> Next`
+
+`fn after_failure(tag: &str, error: BuildKitError) -> Next`
+
+`async fn build_with_buildkit( dockerfile: &Path, tag: &str, context_dir: &Path, ) -> Result<(), BuildKitError>`
+
+`fn failed_instruction_output(stderr: &str) -> Option<String>`
+
+`enum BuildKitError`
+> Variants: `StepFailed`, `NotBuilt`
+
+`fn an_instruction_failed(stderr: &str) -> bool`
+
 `mod tests`
 
 ---
@@ -2557,9 +2612,10 @@ wrkflw/
 
 ## crates/executor/src/docker.rs
 
-**Language:** Rust | **Size:** 65.1 KB | **Lines:** 1742
+**Language:** Rust | **Size:** 69.9 KB | **Lines:** 1854
 
 **Imports:**
+- `crate::buildkit`
 - `crate::container_guard::ContainerGuard`
 - `async_trait::async_trait`
 - `bollard::{
@@ -2574,11 +2630,7 @@ wrkflw/
 - `std::path::Path`
 - `std::sync::Mutex`
 - `wrkflw_logging`
-- `wrkflw_runtime::container::{
-    container_env, container_path, path_from_image_env, ContainerError, ContainerOutput,
-    ContainerRuntime, COMBINED_IMAGE_PREFIX, LOCAL_IMAGE_PREFIX,
-}`
-- *... and 2 more imports*
+- *... and 3 more imports*
 
 **Declarations:**
 
@@ -2643,6 +2695,8 @@ wrkflw/
 
 `pub(crate) fn tracked_containers() -> Vec<String>`
 
+`fn is_not_found(error: &bollard::errors::Error) -> bool`
+
 **`impl ContainerRuntime for DockerRuntime`**
   `fn session_cli(&self) -> Option<&'static str>`
 
@@ -2660,6 +2714,8 @@ wrkflw/
 
   `fn identifies_images(&self) -> bool`
 
+  `fn reuses_build_layers(&self) -> bool`
+
 
 `fn build_container_config( image: &str, cmd: Vec<String>, env: Vec<String>, working_dir: &Path, host_config: HostConfig, is_windows_image: bool, entrypoint: Option<&str>, ) -> Config<String>`
 
@@ -2673,6 +2729,10 @@ wrkflw/
   `async fn build_image_inner( &self, dockerfile: &Path, tag: &str, context_dir: &Path, ) -> Result<(), ContainerError>`
 
 
+`async fn remove_once_created(docker: Docker, name: String, after: std::time::Duration)`
+
+`const ENGINE_ANSWER_LIMIT: std::time::Duration = std::time::Duration::from_secs(120)`
+
 `mod tests`
 
 ---
@@ -2906,6 +2966,51 @@ wrkflw/
 
 ---
 
+## crates/executor/src/image_build.rs
+
+**Language:** Rust | **Size:** 9.3 KB | **Lines:** 246
+
+**Imports:**
+- `futures::future`
+- `once_cell::sync::Lazy`
+- `std::collections::HashMap`
+- `std::path::Path`
+- `std::sync::{Arc, Mutex}`
+- `wrkflw_runtime::container::{ContainerError, ContainerRuntime, COMBINED_IMAGE_PREFIX}`
+- `crate::engine::fnv1a_hash`
+
+**Declarations:**
+
+`static SHARED_LAYER_BUILDS: Lazy<Mutex<HashMap<String, Arc<tokio::sync::Mutex<()>>>>> = Lazy::new(|| Mutex::new(HashMap::new()))`
+
+`pub(crate) async fn with_run_image_builds<F: std::future::Future>(future: F) -> F::Output`
+
+`pub(crate) fn failed_image_build(tag: &str) -> Option<String>`
+
+`pub(crate)
```

**File**: `crates/executor/src/buildkit.rs` (added, +427/-0)
```diff
@@ -0,0 +1,427 @@
+//! Building a job's runtime image with BuildKit, through the `docker` CLI,
+//! where that builds into the engine wrkflw talks to.
+
+use bollard::Docker;
+use std::path::Path;
+use wrkflw_runtime::container::ContainerError;
+
+/// Chooses the builder for a job's runtime image: `classic` keeps to the
+/// engine's own builder.
+const IMAGE_BUILDER_ENV: &str = "WRKFLW_IMAGE_BUILDER";
+
+fn buildkit_wanted(setting: Option<&str>) -> bool {
+    setting.map(str::trim) != Some("classic")
+}
+
+/// Set once BuildKit built an image this engine couldn't find: the `docker`
+/// CLI uses another engine, and BuildKit isn't used again in this process.
+static BUILDKIT_IMAGES_UNSEEN: std::sync::atomic::AtomicBool =
+    std::sync::atomic::AtomicBool::new(false);
+
+/// Whether a job's runtime image is built with BuildKit: unless it was
+/// asked not to be, built an image elsewhere before, or can't build into
+/// this engine.
+pub(crate) async fn builds_here(docker: &Docker) -> bool {
+    buildkit_wanted(std::env::var(IMAGE_BUILDER_ENV).ok().as_deref())
+        && !BUILDKIT_IMAGES_UNSEEN.load(std::sync::atomic::Ordering::Relaxed)
+        && buildkit_available(docker).await
+}
+
+/// Whether the `docker` CLI builds with BuildKit into this engine, asked
+/// once a process.
+async fn buildkit_available(docker: &Docker) -> bool {
+    static AVAILABLE: tokio::sync::OnceCell<bool> = tokio::sync::OnceCell::const_new();
+    *AVAILABLE.get_or_init(|| buildkit_builds_here(docker)).await
+}
+
+/// Whether the `docker` CLI's builder builds into this engine's own images.
+///
+/// Its driver must be `docker`: another, such as `docker-container`, keeps
+/// its own cache and takes a base image from the registry rather than the
+/// one this engine has, which the image's tag names. And the CLI must talk
+/// to this engine, or each image would be built in the other and then again
+/// here. Where the engines can't be told apart, BuildKit is used, and the
+/// check after the first build still catches an image built elsewhere.
+async fn buildkit_builds_here(docker: &Docker) -> bool {
+    let Some(inspect) = docker_cli(&["buildx", "inspect"]).await else {
+        return false;
+    };
+    let driver = buildx_driver(&inspect);
+    if driver != Some("docker") {
+        wrkflw_logging::debug(&format!(
+            "The `docker` CLI's builder uses the {} driver, not docker, so job images are \
+             built by the engine's own builder",
+            driver.unwrap_or("unknown")
+        ));
+        return false;
+    }
+    let cli_engine = docker_cli(&["info", "--format", "{{.ID}}"]).await;
+    let api_engine = docker.info().await.ok().and_then(|info| info.id);
+    if same_engine(cli_engine.as_deref(), api_engine.as_deref()) == Some(false) {
+        warn_buildkit_elsewhere("The `docker` CLI talks to another engine than wrkflw does");
+        return false;
+    }
+    true
+}
+
+/// Say once why BuildKit isn't used, and what to do about it.
+fn warn_buildkit_elsewhere(why: &str) {
+    wrkflw_logging::warning(&format!(
+        "{}, as when it uses another context; job images are built by the engine's own \
+         builder, which is slower. Point the CLI at the same engine, or set {}=classic to \
+         skip BuildKit",
+        why, IMAGE_BUILDER_ENV
+    ));
+}
+
+/// What `docker <args>` printed, when it ran in time and succeeded.
+async fn docker_cli(args: &[&str]) -> Option<String> {
+    let output = tokio::time::timeout(
+        std::time::Duration::from_secs(10),
+        tokio::process::Command::new("docker")
+            .args(args)
+            .stdin(std::process::Stdio::null())
+            .stderr(std::process::Stdio::null())
+            .kill_on_drop(true)
+            .output(),
+    )
+    .await
+    .ok()?
+    .ok()?;
+    output
+        .status
+        .success()
+        .then(|| String::from_utf8_lossy(&output.stdout).into_owned())
+}
+
+/// The driver `docker buildx inspect` names for the builder in use.
+fn buildx_driver(inspect: &str) -> Option<&str> {
+    inspect
+        .lines()
+        .find_map(|line| line.strip_prefix("Driver:"))
+        .map(str::trim)
+        .filter(|driver| !driver.is_empty())
+}
+
+/// Whether the CLI's engine and the API's are one, by their IDs. `None`
+/// when either didn't give one.
+fn same_engine(cli: Option<&str>, api: Option<&str>) -> Option<bool> {
+    let cli = cli.map(str::trim).filter(|id| !id.is_empty())?;
+    let api = api.map(str::trim).filter(|id| !id.is_empty())?;
+    Some(cli == api)
+}
+
+/// What is left to do for an image after BuildKit was asked to build it.
+#[derive(Debug)]
+pub(crate) enum Next {
+    /// The engine has the image.
+    Built,
+    /// BuildKit didn't give the image; the engine's own builder may.
+    EngineBuilds,
+    /// The build failed, and the engine's own builder would fail the same.
+    Failed(ContainerError),
+}
+
+/// Build `tag` with BuildKit, and say what is left to do for it.
+
```

**File**: `crates/executor/src/docker.rs` (modified, +120/-8)
```diff
@@ -1,3 +1,4 @@
+use crate::buildkit;
 use crate::container_guard::ContainerGuard;
 use async_trait::async_trait;
 use bollard::{
@@ -654,6 +655,17 @@ pub async fn cleanup_resources(docker: &Docker) {
     }
 }
 
+/// Whether the engine answered that the container doesn't exist.
+fn is_not_found(error: &bollard::errors::Error) -> bool {
+    matches!(
+        error,
+        bollard::errors::Error::DockerResponseServerError {
+            status_code: 404,
+            ..
+        }
+    )
+}
+
 // Clean up all tracked containers, in the order they are tracked. Job sessions
 // rely on that order: `job_session::Containers::add` keeps a job container
 // behind its services, which Podman won't let go of it before.
@@ -697,6 +709,13 @@ pub async fn cleanup_containers(docker: &Docker) -> Result<(), String> {
         .await
         {
             Ok(Ok(_)) => wrkflw_logging::debug(&format!("Stopped container: {}", container_id)),
+            // Never created, as a container whose creation timed out may
+            // be, or already gone: there is nothing to remove.
+            Ok(Err(e)) if is_not_found(&e) => {
+                wrkflw_logging::debug(&format!("No container to clean up: {}", container_id));
+                untrack_container(&container_id);
+                continue;
+            }
             Ok(Err(e)) => wrkflw_logging::warning(&format!(
                 "Error stopping container {}: {}",
                 container_id, e
@@ -706,14 +725,21 @@ pub async fn cleanup_containers(docker: &Docker) -> Result<(), String> {
             }
         }
 
-        // Then try to remove it
+        // Then remove it, by force where it didn't stop in time.
+        let force = bollard::container::RemoveContainerOptions {
+            force: true,
+            ..Default::default()
+        };
         match tokio::time::timeout(
             std::time::Duration::from_millis(1000),
-            docker.remove_container(&container_id, None),
+            docker.remove_container(&container_id, Some(force)),
         )
         .await
         {
             Ok(Ok(_)) => wrkflw_logging::debug(&format!("Removed container: {}", container_id)),
+            Ok(Err(e)) if is_not_found(&e) => {
+                wrkflw_logging::debug(&format!("Container already gone: {}", container_id))
+            }
             Ok(Err(e)) => wrkflw_logging::warning(&format!(
                 "Error removing container {}: {}",
                 container_id, e
@@ -886,7 +912,7 @@ impl ContainerRuntime for DockerRuntime {
                     tag,
                     timeout_duration.as_secs()
                 ));
-                Err(ContainerError::ImageBuild(
+                Err(ContainerError::ImageBuildTimeout(
                     "Operation timed out".to_string(),
                 ))
             }
@@ -1053,6 +1079,10 @@ impl ContainerRuntime for DockerRuntime {
     fn identifies_images(&self) -> bool {
         true
     }
+
+    fn reuses_build_layers(&self) -> bool {
+        true
+    }
 }
 
 // Move the actual implementation to internal methods
@@ -1162,8 +1192,9 @@ impl DockerRuntime {
             || image.contains("nanoserver");
 
         // Create appropriate container options based on platform
+        let container_name = format!("wrkflw-{}", uuid::Uuid::new_v4());
         let options = Some(CreateContainerOptions {
-            name: format!("wrkflw-{}", uuid::Uuid::new_v4()),
+            name: container_name.clone(),
             platform: if is_windows_image {
                 Some("windows".to_string())
             } else {
@@ -1195,9 +1226,8 @@ impl DockerRuntime {
             entrypoint,
         );
 
-        // Create container with a shorter timeout
         let create_result = tokio::time::timeout(
-            std::time::Duration::from_secs(15),
+            ENGINE_ANSWER_LIMIT,
             self.docker.create_container(options, config),
         )
         .await;
@@ -1206,9 +1236,23 @@ impl DockerRuntime {
             Ok(Ok(container)) => container,
             Ok(Err(e)) => return Err(ContainerError::ContainerStart(e.to_string())),
             Err(_) => {
+                // The engine may still create it after this gives up. It is
+                // tracked by name, which the engine takes where it takes an
+                // id, so the cleanup at the end of the run removes it if it
+                // is there by then, and passes over it quietly if not; a
+                // process that lives on removes it once the engine has had
+                // time to finish creating it. One the engine creates after
+                // the process has exited is left behind, with its
+                // `wrkflw-` name to find it by.
+                track_container(&container_name);
+                tokio::spawn(remove_once_created(
+                    self.docker.clone(),
+                    container_name,
+                    ENGINE_ANSWER_LIMIT,
+                ));
                 return
```

**File**: `crates/executor/src/engine.rs` (modified, +797/-226)
```diff
@@ -17,6 +17,11 @@ use crate::dependency;
 use crate::docker;
 use crate::environment;
 use crate::events::{step_display_name, EXIT_CODE_LABEL, STDERR_HEADER, STDOUT_HEADER};
+use crate::image_build::{
+    ahead_build_permits, build_image_checked, ensure_shared_layers, failed_image_build,
+    remember_failed_image_build, with_images_built_ahead, with_run_image_builds, AHEAD_BUILDS,
+    IMAGES_BUILT_AHEAD,
+};
 use crate::job_session;
 use crate::kubernetes::{self, KubernetesConfig};
 use crate::live_step::LiveStep;
@@ -75,7 +80,10 @@ pub async fn execute_workflow(
         std::sync::Arc::new(state),
         crate::workspace::with_workflow_file(
             workflow_path,
-            Box::pin(execute_github_workflow(workflow_path, config.clone())),
+            Box::pin(with_run_image_builds(execute_github_workflow(
+                workflow_path,
+                config.clone(),
+            ))),
         ),
     ))
     .await;
@@ -2103,6 +2111,9 @@ fn report_action_not_run(uses: &str, cause: Option<&str>) -> Option<String> {
     Some(uses.to_string())
 }
 
+/// Ends a `RUN` that fetched the package lists by removing them.
+const REMOVE_PACKAGE_LISTS: &str = " && \\\n    rm -rf /var/lib/apt/lists/*";
+
 /// Generate a Dockerfile that installs multiple language runtimes on an Ubuntu base.
 ///
 /// `base_id` is the base image's local content ID, when known. It goes into
@@ -2112,9 +2123,17 @@ fn report_action_not_run(uses: &str, cause: Option<&str>) -> Option<String> {
 ///
 /// Extracted as a pure function so the output can be unit-tested without Docker.
 /// `week` names the week floating versions are resolved in, when any is;
-/// it goes into the one `RUN` instruction, so a new week misses the build
-/// cache and installs the releases out then. A comment would change the
-/// image's tag but not its layers, which the builder would reuse.
+/// it goes into the first `RUN` instruction, so a new week misses the build
+/// cache there and in every layer after it, and installs the releases out
+/// then. A comment would change the image's tag but not its layers, which
+/// the builder would reuse.
+///
+/// The packages every image gets come first, in a `RUN` of their own, and
+/// each runtime follows in its own. The builder reuses a layer whose
+/// instruction and parent it has built before, so the legs of a matrix
+/// over Python versions install the packages, Node.js and uv once between
+/// them and differ only in the interpreter. In one `RUN`, each of nine
+/// legs spent a minute and 800 MB on the same packages.
 fn generate_combined_dockerfile(
     runtimes: &[SetupRuntime],
     base_image: &str,
@@ -2126,9 +2145,6 @@ fn generate_combined_dockerfile(
         dockerfile.push_str(&format!("# base image id: {}\n", id));
     }
 
-    // Combine base packages and all runtime install scripts into a single
-    // RUN directive so there is only one `apt-get update` call and the Docker
-    // layer cache works as a single unit.
     let scripts: Vec<&str> = runtimes
         .iter()
         .filter(|rt| !rt.install_script.is_empty())
@@ -2139,26 +2155,6 @@ fn generate_combined_dockerfile(
     // and Rust build scripts, node-gyp, Python C extensions and cgo all
     // expect one. `less` because they have a pager, which tests of CLI
     // tools run.
-    // uv keeps the interpreters it installs under `$HOME`, which is root's
-    // and closed to a step that runs as another user, and which a job that
-    // sets `HOME` moves. Somewhere fixed and readable serves every step.
-    let mut env: Vec<(String, String)> = Vec::new();
-    if runtimes.iter().any(|rt| rt.language == "python") {
-        env.push((
-            "UV_PYTHON_INSTALL_DIR".to_string(),
-            UV_PYTHON_DIR.to_string(),
-        ));
-    }
-    // What a setup action sets for the rest of the job, such as setup-uv's
-    // `UV_PYTHON`. Values were checked to be plain versions and paths.
-    for pair in runtimes.iter().flat_map(|rt| &rt.env) {
-        if !env.iter().any(|(name, _)| *name == pair.0) {
-            env.push(pair.clone());
-        }
-    }
-    for (name, value) in &env {
-        dockerfile.push_str(&format!("ENV {}={}\n", name, value));
-    }
     dockerfile.push_str("RUN ");
     if let Some(week) = week {
         dockerfile.push_str(&format!(
@@ -2179,13 +2175,45 @@ fn generate_combined_dockerfile(
         dockerfile.push_str(" && \\\n");
         dockerfile.push_str(&format!("    {}", runner_node_install()));
     }
+    dockerfile.push_str(REMOVE_PACKAGE_LISTS);
+    dockerfile.push('\n');
 
-    for script in &scripts {
-        dockerfile.push_str(" && \\\n");
-        dockerfile.push_str(&format!("    {}", script));
+    // After the shared packages, so a variable that differs between the
+    // legs of a matrix, such as `UV_PYTHON`, doesn't give each leg packages
+    // of its own, and before the runtimes, whose installs read them.
+    // uv keeps the interpreters it installs under `$
```

**File**: `crates/executor/src/image_build.rs` (added, +246/-0)
```diff
@@ -0,0 +1,246 @@
+//! Building the images jobs run in: the layers images on one base share,
+//! the builds started ahead of a job's turn, and what a run remembers of a
+//! build that failed. The Dockerfile itself, and which image a job gets,
+//! are the engine's.
+
+use futures::future;
+use once_cell::sync::Lazy;
+use std::collections::HashMap;
+use std::path::Path;
+use std::sync::{Arc, Mutex};
+use wrkflw_runtime::container::{ContainerError, ContainerRuntime, COMBINED_IMAGE_PREFIX};
+
+use crate::engine::fnv1a_hash;
+
+/// One lock per image of shared layers, by its tag: the first build of
+/// those layers goes alone. See `ensure_shared_layers`.
+static SHARED_LAYER_BUILDS: Lazy<Mutex<HashMap<String, Arc<tokio::sync::Mutex<()>>>>> =
+    Lazy::new(|| Mutex::new(HashMap::new()));
+
+tokio::task_local! {
+    /// The combined images whose build failed in this run, by tag, with
+    /// the error. A job's image is built ahead while it waits, and again
+    /// at its turn if that didn't produce it: a build that fails on its
+    /// own would fail the same way, and take as long, so the job is given
+    /// the first failure instead. The next run tries again.
+    static FAILED_IMAGE_BUILDS: Mutex<HashMap<String, String>>;
+}
+
+/// Run `future` as one run, with no image build failed yet.
+pub(crate) async fn with_run_image_builds<F: std::future::Future>(future: F) -> F::Output {
+    FAILED_IMAGE_BUILDS
+        .scope(Mutex::new(HashMap::new()), future)
+        .await
+}
+
+/// Why `tag` failed to build earlier in this run, if it did.
+pub(crate) fn failed_image_build(tag: &str) -> Option<String> {
+    FAILED_IMAGE_BUILDS
+        .try_with(|failed| failed.lock().unwrap().get(tag).cloned())
+        .ok()
+        .flatten()
+}
+
+/// Remember for the rest of the run that `tag` failed to build, unless
+/// the same build [may work on another try](may_build_on_another_try).
+pub(crate) fn remember_failed_image_build(tag: &str, error: &ContainerError) {
+    if may_build_on_another_try(error) {
+        return;
+    }
+    let _ = FAILED_IMAGE_BUILDS.try_with(|failed| {
+        failed
+            .lock()
+            .unwrap()
+            .insert(tag.to_string(), error.to_string())
+    });
+}
+
+/// Whether `error` says nothing of the build itself, so the same build may
+/// well work when it is tried again: the connection to the engine was
+/// lost, or the build ran out of time. A build ahead shares the engine
+/// with the jobs running and with other builds, and one that ran out of
+/// time there is built again by its job, at its turn.
+fn may_build_on_another_try(error: &ContainerError) -> bool {
+    matches!(error, ContainerError::ImageBuildTimeout(_)) || is_transport_error(&error.to_string())
+}
+
+/// Build the layers a combined image shares with every image on the same
+/// base, as an image of their own, unless the engine has it already.
+///
+/// Images that start with the same packages build them once: the first
+/// build of those layers goes alone, and the builds waiting on it go on to
+/// their own runtimes as soon as it is over, built or failed. Started
+/// together, five BuildKit builds took 67 s to give the first image where
+/// one alone took 43 s. Only the shared layers are waited for, not another
+/// job's runtimes, and an engine that has the shared image from an earlier
+/// run waits for nothing.
+///
+/// Only where a build [reuses the layers](ContainerRuntime::reuses_build_layers)
+/// an earlier one left: no step runs in the shared image, so a runtime
+/// that ships every image it builds to a registry, as Kubernetes does,
+/// would build and ship it on every run for nothing.
+pub(crate) async fn ensure_shared_layers(
+    dockerfile: &str,
+    runtime: &dyn ContainerRuntime,
+) -> Result<(), String> {
+    if !runtime.reuses_build_layers() {
+        return Ok(());
+    }
+    let shared = shared_layers(dockerfile);
+    if shared.len() == dockerfile.len() {
+        return Ok(());
+    }
+    let tag = shared_layers_tag(shared);
+    if runtime.image_exists(&tag).await.unwrap_or(false) {
+        return Ok(());
+    }
+    let lock = {
+        let mut locks = SHARED_LAYER_BUILDS.lock().unwrap();
+        locks
+            .entry(tag.clone())
+            .or_insert_with(|| Arc::new(tokio::sync::Mutex::new(())))
+            .clone()
+    };
+    let _first = lock.lock().await;
+    // Whoever held the lock before built these layers, or failed to: the
+    // same build would fail the same way.
+    if let Some(error) = failed_image_build(&tag) {
+        return Err(error);
+    }
+    if runtime.image_exists(&tag).await.unwrap_or(false) {
+        return Ok(());
+    }
+    let temp_dir =
+        tempfile::tempdir().map_err(|e| format!("Failed to create temp directory: {}", e))?;
+    let dockerfile_path = temp_dir.path().join("Dockerfile");
+    std::fs::write(&dockerfile_path, shared)
+        .map_err(|e| format!("Failed to write Dockerfile: {}", e))?;
+  
```

**File**: `crates/executor/src/kubernetes/mod.rs` (modified, +9/-1)
```diff
@@ -1125,7 +1125,7 @@ impl KubernetesRuntime {
         )
         .await
         .map_err(|_| {
-            ContainerError::ImageBuild(format!(
+            ContainerError::ImageBuildTimeout(format!(
                 "{} timed out after {} seconds",
                 what,
                 timeout.as_secs()
@@ -1586,6 +1586,14 @@ mod tests {
         assert!(!rt.image_exists("wrkflw-python-3.11").await.unwrap());
     }
 
+    /// Every image built is pushed to the registry, and a later build's
+    /// cache is the local builder's business: nothing is gained by building
+    /// shared layers as an image of their own, which would be pushed too.
+    #[test]
+    fn a_built_image_is_shipped_so_no_layers_are_built_to_share() {
+        assert!(!KubernetesRuntime::new(cfg(), false).reuses_build_layers());
+    }
+
     #[tokio::test]
     async fn build_image_without_registry_explains_the_flag() {
         let rt = KubernetesRuntime::new(cfg(), false);
```

**File**: `crates/executor/src/lib.rs` (modified, +2/-0)
```diff
@@ -6,6 +6,7 @@ pub mod acceleration;
 pub mod action_fidelity;
 pub mod action_resolver;
 pub(crate) mod artifacts;
+pub(crate) mod buildkit;
 pub(crate) mod cache;
 pub(crate) mod checkout_sync;
 mod container_guard;
@@ -16,6 +17,7 @@ pub mod environment;
 pub mod events;
 pub mod expression;
 pub mod github_env_files;
+pub(crate) mod image_build;
 pub(crate) mod job_memory;
 pub(crate) mod job_session;
 pub mod kubernetes;
```

**File**: `crates/executor/src/podman.rs` (modified, +5/-1)
```diff
@@ -550,7 +550,7 @@ impl ContainerRuntime for PodmanRuntime {
                     "Building image {} timed out after 120 seconds",
                     tag
                 ));
-                Err(ContainerError::ImageBuild(
+                Err(ContainerError::ImageBuildTimeout(
                     "Operation timed out".to_string(),
                 ))
             }
@@ -723,6 +723,10 @@ impl ContainerRuntime for PodmanRuntime {
     fn identifies_images(&self) -> bool {
         true
     }
+
+    fn reuses_build_layers(&self) -> bool {
+        true
+    }
 }
 
 /// The PATH `image` sets in its config, pulling the image first if it isn't
```

#### Recent Merged Pull Requests:
- **PR #171** (2026-11-13): fix: agree with GitHub on real repositories, and build job images faster (@bahdotsh)
- **PR #170** (closed): perf: build job images faster, and start no container for a step that only prints (@bahdotsh)
- **PR #169** (2026-11-11): perf: run the legs of a new matrix together, and fit light jobs side by side again (@bahdotsh)
- **PR #168** (2026-11-11): fix: address the review findings from #167 (@bahdotsh)
- **PR #167** (2026-11-11): fix: report what a local pass didn't check, and make local runs match GitHub's (@bahdotsh)
- **PR #166** (2026-11-09): fix: make local verdicts match what GitHub would say (@bahdotsh)

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

## X. agree with GitHub on real repositories, and build job images faster

**RULE**:
When implementing operations in `INDEX.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in bahdotsh/wrkflw. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `7b284277`: agree with GitHub on real repositories, and build job images faster. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Rust data structures, boundary deserialization, API parsing, or resource lifecycles matching `INDEX.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
// Verified production-grade fix pattern:
> Generated: 2026-11-13 12:17:35 UTC | Files: 262 | Lines: 118189
> Languages: JSON (4), Markdown (26), Rust (169), Shell (6), TOML (19), YAML (38)
        buildkit.rs
        image_build.rs
**Language:** Markdown | **Size:** 275.7 KB | **Lines:** 10197
`mod tests`

---

## crates/executor/src/buildkit.rs

**Language:** Rust | **Size:** 16.9 KB | **Lines:** 427

**Imports:**
- `bollard::Docker`
- `std::path::Path`
- `wrkflw_runtime::container::ContainerError`

**Declarations:**

`const IMAGE_BUILDER_ENV: &str = "WRKFLW_IMAGE_BUILDER"`

`fn buildkit_wanted(setting: Option<&str>) -> bool`

`static BUILDKIT_IMAGES_UNSEEN: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false)`

`pub(crate) async fn builds_here(docker: &Docker) -> bool`

`async fn buildkit_available(docker: &Docker) -> bool`

`async fn buildkit_builds_here(docker: &Docker) -> bool`

`fn warn_buildkit_elsewhere(why: &str)`

`async fn docker_cli(args: &[&str]) -> Option<String>`

`fn buildx_driver(inspect: &str) -> Option<&str>`

`fn same_engine(cli: Option<&str>, api: Option<&str>) -> Option<bool>`

`pub(crate) enum Next`
> Variants: `Built`, `EngineBuilds`, `Failed`

`pub(crate) async fn build( docke
```

**NEGATIVE CONSTRAINT**:
```rust
// Induced defect failure mode:
> Generated: 2026-11-11 17:02:11 UTC | Files: 260 | Lines: 117213
> Languages: JSON (4), Markdown (26), Rust (167), Shell (6), TOML (19), YAML (38)
**Language:** Markdown | **Size:** 275.9 KB | **Lines:** 10209
**Language:** Rust | **Size:** 65.1 KB | **Lines:** 1742
- `wrkflw_runtime::container::{
    container_env, container_path, path_from_image_env, ContainerError, ContainerOutput,
    ContainerRuntime, COMBINED_IMAGE_PREFIX, LOCAL_IMAGE_PREFIX,
}`
- *... and 2 more imports*
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `7b284277` are properly handled with clean fallback behavior.


## 3. Application to AI-Builder-Brain Project Construction
- **Applied Blueprints**: `astro-tailwind-v4`, `fullstack-ai-saas`, `universal-native-factory`
- **Regression Shield**: Prevents architectural drift across construction cycles.

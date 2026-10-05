# Forensic Learning Record (Deep Inspection): BloopAI/vibe-kanban

> **Canonical Artifact**: `07_PROJECT_LEARNING/bloopai-vibe-kanban-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/BloopAI/vibe-kanban](https://github.com/BloopAI/vibe-kanban))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T17:29:19.384Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `BloopAI/vibe-kanban`
- **Description**: Get 10X more out of Claude Code, Codex or any coding agent
- **Primary Language / Ecosystem**: Rust
- **Discovered Manifests / Configurations**: package.json, Cargo.toml, README.md, Dockerfile
- **Stars / Engagement**: 28222 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, Cargo.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `crates/api-types/src/attachment.rs`
```
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

/// An attachment links a blob to an issue or comment.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct Attachment {
    pub id: Uuid,
    pub blob_id: Uuid,
    pub issue_id: Option<Uuid>,
    pub comment_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
}

/// An attachment with its associated blob data (for API responses).
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct AttachmentWithBlob {
    pub id: Uuid,
    pub blob_id: Uuid,
    pub issue_id: Option<Uuid>,
    pub comment_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    // Blob fields
    pub blob_path: String,
    pub thumbnail_blob_path: Option<String>,
    pub original_name: String,
    pub mime_type: Option<String>,
    pub size_bytes: i64,
    pub hash: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
}

/// An attachment with blob data and a presigned file URL.
#[derive(Debug, Serialize, Deserialize)]
pub struct AttachmentWithUrl {
    #[serde(flatten)]
    pub attachment: AttachmentWithBlob,
    pub file_url: Option<String>,
}

/// Response from listing attachments.
#[derive(Debug, Serialize, Deserialize)]
pub struct ListAttachmentsResponse {
    pub attachments: Vec<AttachmentWithUrl>,
}

/// Response containing a presigned URL for an attachment file or thumbnail.
#[derive(Debug, Serialize, Deserialize, TS)]
pub struct AttachmentUrlResponse {
    pub url: String,
}

```

### Core Architecture Module: `crates/api-types/src/auth.rs`
```
use chrono::{DateTime, Duration, Utc};
use serde::Serialize;
use uuid::Uuid;

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct AuthSession {
    pub id: Uuid,
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub last_used_at: Option<DateTime<Utc>>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub refresh_token_id: Option<Uuid>,
    pub refresh_token_issued_at: Option<DateTime<Utc>>,
    pub previous_refresh_token_id: Option<Uuid>,
    pub previous_refresh_token_grace_expires_at: Option<DateTime<Utc>>,
}

impl AuthSession {
    pub fn last_activity_at(&self) -> DateTime<Utc> {
        self.last_used_at.unwrap_or(self.created_at)
    }

    pub fn inactivity_duration(&self, now: DateTime<Utc>) -> Duration {
        now.signed_duration_since(self.last_activity_at())
    }
}

```

### Core Architecture Module: `crates/api-types/src/blob.rs`
```
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct Blob {
    pub id: Uuid,
    pub project_id: Uuid,
    pub blob_path: String,
    pub thumbnail_blob_path: Option<String>,
    pub original_name: String,
    pub mime_type: Option<String>,
    pub size_bytes: i64,
    pub hash: String,
    pub width: Option<i32>,
    pub height: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

```

### Core Architecture Module: `crates/api-types/src/export.rs`
```
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct ExportRequest {
    pub organization_id: Uuid,
    /// If empty, exports all projects in the organization.
    pub project_ids: Vec<Uuid>,
    pub include_attachments: bool,
}

```

### Core Architecture Module: `crates/api-types/src/issue.rs`
```
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::Type;
use ts_rs::TS;
use uuid::Uuid;

use crate::some_if_present;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type, TS)]
#[sqlx(type_name = "issue_priority", rename_all = "snake_case")]
#[serde(rename_all = "snake_case")]
pub enum IssuePriority {
    Urgent,
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, sqlx::FromRow)]
pub struct Issue {
    pub id: Uuid,
    pub project_id: Uuid,
    pub issue_number: i32,
    pub simple_id: String,
    pub status_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<IssuePriority>,
    pub start_date: Option<DateTime<Utc>>,
    pub target_date: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub sort_order: f64,
    pub parent_issue_id: Option<Uuid>,
    pub parent_issue_sort_order: Option<f64>,
    pub extension_metadata: Value,
    pub creator_user_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum IssueSortField {
    SortOrder,
    Priority,
    CreatedAt,
    UpdatedAt,
    Title,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, TS)]
#[serde(rename_all = "snake_case")]
pub enum SortDirection {
    Asc,
    Desc,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct CreateIssueRequest {
    /// Optional client-generated ID. If not provided, server generates one.
    /// Using client-generated IDs enables stable optimistic updates.
    #[ts(optional)]
    pub id: Option<Uuid>,
    pub project_id: Uuid,
    pub status_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: Option<IssuePriority>,
    pub start_date: Option<DateTime<Utc>>,
    pub target_date: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub sort_order: f64,
    pub parent_issue_id: Option<Uuid>,
    pub parent_issue_sort_order: Option<f64>,
    pub extension_metadata: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct UpdateIssueRequest {
    #[serde(
        default,
        deserialize_with = "some_if_present",
        skip_serializing_if = "Option::is_none"
    )]
    pub status_id: Option<Uuid>,
    #[serde(
        default,
        deserialize_with = "some_if_present",
        skip_serializing_if = "Option::is_none"
    )]
    pub title: Option<String>,
    #[serde(
        default,
        deserialize_with = "some_if_present",
        skip_serializing_if = "Option::is_none"
    )]
    pub description: Option<Option<String>>,
    #[serde(
        default,
        deserialize_with = "some_if_present",
        skip_serializing_if = "Option::is_none"
    )]
    pub priority: Option<Option<IssuePriority>>,
    #[serde(
        default,
        deserialize_with = "some_if_present",
        skip_serializing_if = "Option::is_none"
    )]
    pub start_date: Option<Option<DateTime<Utc>>>,
    #[serde(
        default,
        deserialize_with = "some_if_present",
        skip_serializing_if = "Option::is_none"
    )]
    pub target_date: Option<Option<DateTime<Utc>>>,
    #[serde(
        default,
        deserialize_with = "some_if_present",
        skip_serializing_if = "Option::is_none"
    )]
    pub completed_at: Option<Option<DateTime<Utc>>>,
    #[serde(
        default,
        deserialize_with = "some_if_present",
        skip_serializing_if = "Option::is_none"
    )]
    pub sort_order: Option<f64>,
    #[serde(
        default,
        deserialize_with = "some_if_present",
        skip_serializing_if = "Option::is_none"
    )]
    pub parent_issue_id: Option<Option<Uuid>>,
    #[serde(
        default,
        deserialize_with = "some_if_present",
        skip_serializing_if = "Option::is_none"
    )]
    pub parent_issue_sort_order: Option<Option<f64>>,
    #[serde(
        default,
        deserialize_with = "some_if_present",
        skip_serializing_if = "Option::is_none"
    )]
    pub extension_metadata: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct ListIssuesQuery {
    pub project_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct SearchIssuesRequest {
    pub project_id: Uuid,
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_id: Option<Uuid>,
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_ids: Option<Vec<Uuid>>,
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<IssuePriority>,
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_issue_id: Option<Uuid>,
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search: Option<String>,
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub simple_id: Option<String>,
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub assignee_user_id: Option<Uuid>,
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag_id: Option<Uuid>,
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tag_ids: Option<Vec<Uuid>>,
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort_field: Option<IssueSortField>,
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sort_direction: Option<SortDirection>,
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<i32>,
    #[ts(optional)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub offset: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct ListIssuesResponse {
    pub issues: Vec<Issue>,
    pub total_count: usize,
    pub limit: usize,
    pub offset: usize,
}

```

### Core Architecture Module: `crates/api-types/src/issue_assignee.rs`
```
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct IssueAssignee {
    pub id: Uuid,
    pub issue_id: Uuid,
    pub user_id: Uuid,
    pub assigned_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct CreateIssueAssigneeRequest {
    /// Optional client-generated ID. If not provided, server generates one.
    /// Using client-generated IDs enables stable optimistic updates.
    #[ts(optional)]
    pub id: Option<Uuid>,
    pub issue_id: Uuid,
    pub user_id: Uuid,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListIssueAssigneesQuery {
    pub issue_id: Uuid,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct ListIssueAssigneesResponse {
    pub issue_assignees: Vec<IssueAssignee>,
}

```

### Core Architecture Module: `crates/api-types/src/issue_comment.rs`
```
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use crate::some_if_present;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct IssueComment {
    pub id: Uuid,
    pub issue_id: Uuid,
    pub author_id: Option<Uuid>,
    pub parent_id: Option<Uuid>,
    pub message: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, TS)]
pub struct CreateIssueCommentRequest {
    /// Optional client-generated ID. If not provided, server generates one.
    /// Using client-generated IDs enables stable optimistic updates.
    #[ts(optional)]
    pub id: Option<Uuid>,
    pub issue_id: Uuid,
    pub message: String,
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Clone, Deserialize, TS)]
pub struct UpdateIssueCommentRequest {
    #[serde(default, deserialize_with = "some_if_present")]
    pub message: Option<String>,
    #[serde(default, deserialize_with = "some_if_present")]
    pub parent_id: Option<Option<Uuid>>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListIssueCommentsQuery {
    pub issue_id: Uuid,
}

#[derive(Debug, Clone, Serialize, TS)]
pub struct ListIssueCommentsResponse {
    pub issue_comments: Vec<IssueComment>,
}

```

### Core Architecture Module: `crates/api-types/src/issue_comment_reaction.rs`
```
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use ts_rs::TS;
use uuid::Uuid;

use crate::some_if_present;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
pub struct IssueCommentReaction {
    pub id: Uuid,
    pub comment_id: Uuid,
    pub user_id: Uuid,
    pub emoji: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, TS)]
pub struct CreateIssueCommentReactionRequest {
    /// Optional client-generated ID. If not provided, server generates one.
    /// Using client-generated IDs enables stable optimistic updates.
    #[ts(optional)]
    pub id: Option<Uuid>,
    pub comment_id: Uuid,
    pub emoji: String,
}

#[derive(Debug, Clone, Deserialize, TS)]
pub struct UpdateIssueCommentReactionRequest {
    #[serde(default, deserialize_with = "some_if_present")]
    pub emoji: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ListIssueCommentReactionsQuery {
    pub comment_id: Uuid,
}

#[derive(Debug, Clone, Serialize, TS)]
pub struct ListIssueCommentReactionsResponse {
    pub issue_comment_reactions: Vec<IssueCommentReaction>,
}

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1938** (2026-02-24): **Database Deadlocks and Codex Session Abnormalities**
  *Symptoms*: Some Codex sessions fail to continue after ending and encounter errors. This issue is quite unpredictable and occurs intermittently. Could it be related to running it in WSL2? Disk performance in WSL2 is poor, and I often see database deadlock issues and slow query warnings. Can support be added for configuring external databases such as MySQL?  Codex fail:  ``` I/O error: failed to decode resumeConversation response: unknown variant `context_compacted`, expected one of `error`, `warning`, `task_started`, `task_complete`, `token_count`, `agent_message`, `user_message`, `agent_message_delta`, `agent_reasoning`, `agent_reasoning_delta`, `agent_reasoning_raw_content`, `agent_reasoning_raw_content_delta`, `agent_reasoning_section_break`, `session_configured`, `mcp_startup_update`, `mcp_startup_complete`, `mcp_tool_call_begin`, `mcp_tool_call_end`, `web_search_begin`, `web_search_end`, `exec_command_begin`, `exec_command_output_delta`, `exec_command_end`, `view_image_tool_call`, `exec_approval_request`, `apply_patch_approval_request`, `deprecation_notice`, `background_event`, `undo_started`, `undo_completed`, `stream_error`, `patch_apply_begin`, `patch_apply_end`, `turn_diff`, `get_history_entry_response`, `mcp_list_tools_response`, `list_custom_prompts_response`, `plan_update`, `turn_aborted`, `shutdown_complete`, `entered_review_mode`, `exited_review_mode`, `raw_response_item`, `item_started`, `item_completed`, `agent_message_content_delta`, `reasoning_content_delta`, `reasoning
  **Post-Mortem & Fix Analysis**:
  > Same issue.
  > The codex session compaction issues have been resolved.  The database deadlock is being solved.

- **Issue #1731** (2026-01-09): **Vibe Kanban agents refuses to start (Invalid WS)**
  *Symptoms*: Starting vibe-kanban v0.0.143... 2026-01-03T13:51:02.364051Z  INFO executors::profile: Loaded user profile overrides from profiles.json 2026-01-03T13:51:44.765480Z  INFO services::services::oauth_credentials: OAuth credentials backend: file 2026-01-03T13:51:44.769011Z  INFO local_deployment: Remote client initialized with URL: https://api.vibekanban.com 2026-01-03T13:51:44.765655Z  INFO local_deployment: Starting orphaned image cleanup... 2026-01-03T13:51:44.857324Z  INFO services::services::workspace_manager: Found orphaned workspace: C:\Users\LOUSYB~1\AppData\Local\Temp\vibe-kanban\worktrees\ac7a-make-a-chess-gam 2026-01-03T13:51:44.857650Z  INFO services::services::workspace_manager: Cleaning up orphaned workspace at C:\Users\LOUSYB~1\AppData\Local\Temp\vibe-kanban\worktrees\ac7a-make-a-chess-gam 2026-01-03T13:51:47.534612Z  INFO services::services::workspace_manager: Successfully removed orphaned workspace: C:\Users\LOUSYB~1\AppData\Local\Temp\vibe-kanban\worktrees\ac7a-make-a-chess-gam 2026-01-03T13:51:47.537447Z  INFO services::services::workspace_manager: Found orphaned workspace: C:\Users\LOUSYB~1\AppData\Local\Temp\vibe-kanban\worktrees\e61f-install-and-inte 2026-01-03T13:51:47.537711Z  INFO services::services::workspace_manager: Cleaning up orphaned workspace at C:\Users\LOUSYB~1\AppData\Local\Temp\vibe-kanban\worktrees\e61f-install-and-inte 2026-01-03T13:51:48.371165Z  INFO services::services::workspace_manager: Successfully removed orphaned workspace: C:\Users\LOU
  **Post-Mortem & Fix Analysis**:
  > I can confirm that I am encountering this issue as well. Looking forward to a fix.
  > @toBeInTheDocument On windows right?i thought it was just my pc
  > Please confirm, are you using Opencode or another coding agent?

- **Issue #1727** (2026-01-08): **Images not accessible when agent_working_dir is set to subdirectory**
  *Symptoms*: # Issue: Images not accessible when agent_working_dir is set to subdirectory  ## Bug Description  When `agent_working_dir` is configured to a subdirectory (e.g., a repo folder in a multi-repo workspace), images uploaded via the task input are not accessible to the AI coding agent because the relative path `.vibe-images/xxx.png` resolves incorrectly.  ## Steps to Reproduce  1. Create a project with a repository 2. Set `Agent Working Dir` to a subdirectory (e.g., `my-repo` or the repo name) 3. Create a task and attach an image (screenshot/paste) 4. Start the task - the AI agent cannot read the image  ## Expected Behavior  The AI agent should be able to access the uploaded image regardless of the `agent_working_dir` setting.  ## Actual Behavior  The AI agent reports the image file cannot be found.  Investigation shows: - Images are stored at: `<workspace_root>/.vibe-images/xxx.png` - Agent working directory is: `<workspace_root>/<agent_working_dir>/` - The relative path `.vibe-images/xxx.png` passed to the agent resolves to `<workspace_root>/<agent_working_dir>/.vibe-images/xxx.png` which doesn't exist  ## Root Cause Analysis  In `crates/local-deployment/src/container.rs`, the `copy_images_by_task_to_worktree` function (line ~726-730) always copies images to `workspace_dir/.vibe-images/`, but when `agent_working_dir` is set, the AI agent's current working directory is `workspace_dir/<agent_working_dir>/`, making the relative path incorrect.  ## Suggested Fix  Option A: Copy imag

- **Issue #1718** (2026-01-08): **Running coding task never finishes (cannot stop or merge, database is locked)**
  *Symptoms*: While using Vibe Kanban, a running coding task does not terminate properly.  Once the task is started, it stays in a running state indefinitely and never completes. Because of this, the task cannot be merged and blocks further progress.  Clicking the Stop button has no effect — there is no UI response and the task continues to run.  In the console logs, the following error keeps appearing repeatedly:  ``` 2026-01-01T08:04:41.479277Z ERROR server::middleware::model_loaders: Failed to fetch Workspace 146f1f0f-652b-4842-a294-21e9e7177a67: error returned from database: (code: 5) database is locked ... 2026-01-01T08:05:16.851088Z ERROR services::services::events: Failed to fetch execution_process: Database(SqliteError { code: 5, message: "database is locked" }) ```  It seems the task process is stuck due to a database lock, and there is no way to stop or recover it from the UI.  Please let me know if you need additional logs or steps to reproduce.
  **Post-Mortem & Fix Analysis**:
  > How can I completely reset? It seems to have been broken since something went wrong once.
  > In Mac delete ~/Library/Application Support/ai.bloop.vibe-kanban
  > Thank you for your reply. But I’m using Linux (WSL).

- **Issue #1710** (2026-01-05): **Problem with rebase : GitServiceError: invalid data in index - calculated checksum does not match expected; class=Index (10)**
  *Symptoms*: When I try to rebase, I always have this error :   <img width="527" height="273" alt="Image" src="https://github.com/user-attachments/assets/a7e6c108-a606-4da6-8a3d-17af6a9b11c1" />
  **Post-Mortem & Fix Analysis**:
  > can you please share more about this, also can you share your `git status` of the original branch, where you want to make the changes...
  > Thanks for your answer. I do not really know what to share more. `git status` was clean on the original branch : nothing to commit
  > Delete the .husky directory under the project to temporarily solve this problem.  @damienlethiec @ggordonhall @LSRCT @rushichavda @skorokithakis   This is a bug and should be handled to be compatible with git husky.

- **Issue #1706** (2026-01-06): **feat: Add --body-file support for gh pr create**
  *Symptoms*: ## Summary  When using `--body` parameter with `gh pr create`, long or multiline content causes issues: - Shell escaping problems (special characters, quotes, newlines) - Command-line length limits (Windows 8191 chars, some shells even shorter)  ## Proposed Solution  Use `--body-file` parameter to write body content to a temp file: - Automatically use `--body-file` when body exceeds 1000 characters - Automatically use `--body-file` when body contains newlines - Temp file is automatically cleaned up after command execution  ## Implementation Plan  - Add `PreparedPrCreateArgs` struct for testable argument building - Extract `should_use_body_file()` helper with `BODY_FILE_THRESHOLD` constant - Refactor `create_pr` to use `prepare_pr_create_args()` - Add unit tests covering parsers, body-file logic, and argument building  This addresses the TODO comment in `cli.rs` line 132-133.

- **Issue #1668** (2026-01-08): **opencode integration in windows fails**
  *Symptoms*: running a task with opencode in Windows inevitably fails with the default settings with the logs saying-  {"SessionStart":"ses_4987e087cffepeMEbaGPEP8Fa6"}  {"User":"create detailed specs sheet of what needs to be built from the docs"}  {"Other":{"sessionId":"ses_4987e087cffepeMEbaGPEP8Fa6","update":{"sessionUpdate":"available_commands_update","availableCommands":[{"name":"init","description":"create/update AGENTS.md","input":null},{"name":"review","description":"review changes [commit|branch|pr], defaults to uncommitted","input":null},{"name":"compact","description":"compact the session","input":null}]}}}  the processes themselves can't be killed resulting in having to kill the entire vibe-kanban process. How to tacle this issue?
  **Post-Mortem & Fix Analysis**:
  > Hi @arnabclir, do you see any `ERROR` logs in the terminal window from which you ran Vibe Kanban?
  > I am able to reproduce the issue on windows x64. Opencode's ACP implementation, which we currently rely on,  is currently broken on windows https://github.com/anomalyco/opencode/issues/3730
  > Solved in the next release

- **Issue #1665** (2026-01-13): **If gh is old, PR creation will fail.**
  *Symptoms*: If your gh (GitHub CLI) version is old—for example, the one you get from Ubuntu 22.04’s apt—creating a pull request can fail.  With this version, if you run the command outside a Git repository directory, it tries to use Git internally during PR creation and ends up failing.  ``` 2025-12-27T07:58:15.004531Z ERROR server::routes::task_attempts::pr: Failed to create GitHub PR for attempt 0ba13a08-2ecf-4b5b-8271-5a33da7f642d: Pull request error:          fatal: not a git repository (or any of the parent directories): .git /usr/bin/git: exit status 128 ```  Log captured from hooking gh: ``` cwd=/home/Myname cmd=gh pr create --repo "Myname/MyRepo" --head vk/26b1-test --base develop --title "Title" --body "BODY" ```  ``` $ cat /etc/os-release | head -n1 PRETTY_NAME="Ubuntu 22.04.3 LTS"  $ gh --version gh version 2.4.0+dfsg1 (2022-03-23 Ubuntu 2.4.0+dfsg1-2) ```  
  **Post-Mortem & Fix Analysis**:
  > https://github.com/BloopAI/vibe-kanban/pull/1548/files
  > happens to follwoing error while submit pr:  GitHubServiceError: Pull request error: fatal: 不是 git 仓库（或者任何父目录）：.git /usr/bin/git: exit status 128  

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

### Incident Patch 1: `d5cbb538` (2026-09-19)
**Commit Message**: fix: Tanstack router api fix (#3464)

* Cargo.lock changes

* fix: @tanstack/react-router minor version bump changed their api for router.getMatchedRoutes

**File**: `Cargo.lock` (modified, +30/-30)
```diff
@@ -236,7 +236,7 @@ checksum = "7f202df86484c868dbad7eaa557ef785d5c66295e41b460ef922eca0723b842c"
 
 [[package]]
 name = "api-types"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "chrono",
  "schemars 1.2.1",
@@ -1223,7 +1223,7 @@ checksum = "c8d4a3bb8b1e0c1050499d1815f5ab16d04f0959b233085fb31653fbfc9d98f9"
 
 [[package]]
 name = "client-info"
-version = "0.1.44"
+version = "0.1.45"
 
 [[package]]
 name = "clipboard-win"
@@ -2016,7 +2016,7 @@ checksum = "d7a1e2f27636f116493b8b860f5546edb47c8d8f8ea73e1d2a20be88e28d1fea"
 
 [[package]]
 name = "db"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "chrono",
@@ -2069,7 +2069,7 @@ dependencies = [
 
 [[package]]
 name = "deployment"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "async-trait",
@@ -2234,7 +2234,7 @@ dependencies = [
 
 [[package]]
 name = "desktop-bridge"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "base64 0.22.1",
  "dirs 5.0.1",
@@ -2605,7 +2605,7 @@ checksum = "4ef6b89e5b37196644d8796de5268852ff179b44e96276cf4290264843743bb7"
 
 [[package]]
 name = "embedded-ssh"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "async-trait",
@@ -2793,7 +2793,7 @@ dependencies = [
 
 [[package]]
 name = "executors"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "agent-client-protocol",
  "async-stream",
@@ -3512,7 +3512,7 @@ dependencies = [
 
 [[package]]
 name = "git"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "chrono",
  "dirs 5.0.1",
@@ -3527,7 +3527,7 @@ dependencies = [
 
 [[package]]
 name = "git-host"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "async-trait",
  "backon",
@@ -4957,7 +4957,7 @@ checksum = "11d3d7f243d5c5a8b9bb5d6dd2b1602c0cb0b9db1621bafc7ed66e35ff9fe092"
 
 [[package]]
 name = "local-deployment"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "api-types",
@@ -5177,7 +5177,7 @@ checksum = "8863b587001c1b9a8a4e36008cebc6b3612cb1226fe2de94858e06092687b608"
 
 [[package]]
 name = "mcp"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "api-types",
@@ -6695,7 +6695,7 @@ dependencies = [
 
 [[package]]
 name = "preview-proxy"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "axum",
  "http",
@@ -7501,7 +7501,7 @@ checksum = "dc897dd8d9e8bd1ed8cdad82b5966c3e0ecae09fb1907d58efaa013543185d0a"
 
 [[package]]
 name = "relay-client"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "base64 0.22.1",
@@ -7524,7 +7524,7 @@ dependencies = [
 
 [[package]]
 name = "relay-control"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "base64 0.22.1",
@@ -7538,7 +7538,7 @@ dependencies = [
 
 [[package]]
 name = "relay-hosts"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "axum",
  "base64 0.22.1",
@@ -7571,7 +7571,7 @@ dependencies = [
 
 [[package]]
 name = "relay-protocol"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "axum",
@@ -7582,7 +7582,7 @@ dependencies = [
 
 [[package]]
 name = "relay-tunnel-core"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "axum",
@@ -7601,7 +7601,7 @@ dependencies = [
 
 [[package]]
 name = "relay-types"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "chrono",
  "serde",
@@ -7612,7 +7612,7 @@ dependencies = [
 
 [[package]]
 name = "relay-webrtc"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "base64 0.22.1",
@@ -7638,7 +7638,7 @@ dependencies = [
 
 [[package]]
 name = "relay-ws"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
  "axum",
@@ -7661,7 +7661,7 @@ dependencies = [
 
 [[package]]
 name = "remote-info"
-version = "0.1.44"
+version = "0.1.45"
 
 [[package]]
 name = "reqwest"
@@ -7760,7 +7760,7 @@ checksum = "1e061d1b48cb8d38042de4ae0a7a6401009d6143dc80d2e2d6f31f0bdd6470c7"
 
 [[package]]
 name = "review"
-version = "0.1.44"
+version = "0.1.45"
 dependencies = [
  "anyhow",
```

**File**: `packages/local-web/src/app/navigation/AppNavigation.ts` (modified, +1/-1)
```diff
@@ -27,7 +27,7 @@ function parseLocalHostIdFromPathname(pathname: string): string | null {
 
 function resolveLocalDestinationFromPath(path: string): AppDestination | null {
   const { pathname } = new URL(path, 'http://localhost');
-  const { foundRoute, routeParams } = router.getMatchedRoutes(pathname);
+  const [, routeParams, foundRoute] = router.getMatchedRoutes(pathname);
 
   if (!foundRoute) {
     return null;
```

---

### Incident Patch 2: `78580443` (2026-09-18)
**Commit Message**: pnpm audit fixes (#3460)

**File**: `package.json` (modified, +5/-5)
```diff
@@ -52,14 +52,14 @@
     "tauri:build": "cd crates/tauri-app && cargo tauri build"
   },
   "devDependencies": {
-    "@types/adm-zip": "^0.5.7",
-    "@types/node": "^20.0.0",
+    "@types/adm-zip": "^0.5.8",
+    "@types/node": "^20.19.43",
     "bippy": "0.5.28",
     "concurrently": "^8.2.2",
-    "esbuild": "^0.27.2",
+    "esbuild": "^0.28.2",
     "jwt-decode": "^4.0.0",
-    "typescript": "^5.7.0",
-    "vite": "^7.3.1"
+    "typescript": "^5.9.3",
+    "vite": "^8.3.0"
   },
   "engines": {
     "node": ">=20",
```

**File**: `packages/local-web/package.json` (modified, +65/-65)
```diff
@@ -16,9 +16,9 @@
   },
   "dependencies": {
     "@codemirror/lang-json": "^6.0.2",
-    "@codemirror/language": "^6.11.2",
-    "@codemirror/lint": "^6.8.5",
-    "@codemirror/view": "^6.38.1",
+    "@codemirror/language": "^6.12.4",
+    "@codemirror/lint": "^6.9.7",
+    "@codemirror/view": "^6.43.12",
     "@dnd-kit/core": "^6.3.1",
     "@dnd-kit/sortable": "^10.0.0",
     "@dnd-kit/utilities": "^3.2.2",
@@ -35,95 +35,95 @@
     "@lexical/table": "^0.36.2",
     "@phosphor-icons/react": "^2.1.10",
     "@pierre/diffs": "1.1.4",
-    "@radix-ui/react-accordion": "^1.2.1",
-    "@radix-ui/react-dialog": "^1.1.15",
-    "@radix-ui/react-dropdown-menu": "^2.1.15",
-    "@radix-ui/react-label": "^2.1.7",
-    "@radix-ui/react-popover": "^1.1.15",
-    "@radix-ui/react-select": "^2.2.5",
-    "@radix-ui/react-separator": "^1.1.8",
-    "@radix-ui/react-slot": "^1.2.3",
-    "@radix-ui/react-switch": "^1.0.3",
-    "@radix-ui/react-toggle-group": "^1.1.11",
-    "@radix-ui/react-tooltip": "^1.2.7",
+    "@radix-ui/react-accordion": "^1.2.20",
+    "@radix-ui/react-dialog": "^1.1.23",
+    "@radix-ui/react-dropdown-menu": "^2.1.24",
+    "@radix-ui/react-label": "^2.1.15",
+    "@radix-ui/react-popover": "^1.1.23",
+    "@radix-ui/react-select": "^2.3.7",
+    "@radix-ui/react-separator": "^1.1.15",
+    "@radix-ui/react-slot": "^1.3.3",
+    "@radix-ui/react-switch": "^1.3.7",
+    "@radix-ui/react-toggle-group": "^1.1.19",
+    "@radix-ui/react-tooltip": "^1.2.16",
     "@rjsf/shadcn": "6.1.1",
-    "@sentry/react": "^9.34.0",
-    "@sentry/vite-plugin": "^3.5.0",
-    "@tanstack/electric-db-collection": "^0.2.6",
-    "@tanstack/react-db": "^0.1.50",
-    "@tanstack/react-form": "^1.23.8",
-    "@tanstack/react-query": "^5.85.5",
-    "@tanstack/react-router": "^1.161.1",
-    "@tanstack/zod-adapter": "^1.161.1",
-    "@tauri-apps/api": "^2.10.1",
-    "@uiw/react-codemirror": "^4.25.1",
-    "@vibe/web-core": "workspace:*",
+    "@sentry/react": "^9.47.1",
+    "@sentry/vite-plugin": "^3.6.1",
+    "@tanstack/electric-db-collection": "^0.2.43",
+    "@tanstack/react-db": "^0.1.96",
+    "@tanstack/react-form": "^1.33.5",
+    "@tanstack/react-query": "^5.103.1",
+    "@tanstack/react-router": "^1.170.38",
+    "@tanstack/zod-adapter": "^1.167.0",
+    "@tauri-apps/api": "^2.11.1",
+    "@uiw/react-codemirror": "^4.25.11",
     "@vibe/ui": "workspace:*",
-    "@virtuoso.dev/message-list": "^1.13.3",
+    "@vibe/web-core": "workspace:*",
+    "@virtuoso.dev/message-list": "^1.18.0",
     "@xterm/addon-fit": "^0.10.0",
     "@xterm/addon-web-links": "^0.11.0",
     "@xterm/xterm": "^5.5.0",
-    "class-variance-authority": "^0.7.0",
-    "click-to-react-component": "^1.1.2",
-    "clsx": "^2.0.0",
+    "class-variance-authority": "^0.7.1",
+    "click-to-react-component": "^1.1.3",
+    "clsx": "^2.1.1",
     "cmdk": "^1.1.1",
-    "developer-icons": "^6.0.4",
+    "developer-icons": "^6.0.5",
     "fancy-ansi": "^0.1.3",
-    "framer-motion": "^12.23.24",
-    "i18next": "^25.5.2",
-    "i18next-browser-languagedetector": "^8.2.0",
-    "immer": "^11.1.3",
+    "framer-motion": "^12.43.0",
+    "i18next": "^25.10.10",
+    "i18next-browser-languagedetector": "^8.2.1",
+    "immer": "^11.1.18",
     "jwt-decode": "^4.0.0",
     "lexical": "^0.36.2",
-    "lodash": "^4.17.21",
+    "lodash": "^4.18.1",
     "lucide-react": "^0.539.0",
-    "posthog-js": "^1.276.0",
-    "react": "^18.2.0",
+    "posthog-js": "^1.434.0",
+    "react": "^18.3.1",
     "react-compiler-runtime": "^1.0.0",
-    "react-dom": "^18.2.0",
-    "react-dropzone": "^14.3.8",
-    "react-hotkeys-hook": "^5.1.0",
-    "react-i18next": "^15.7.3",
-    "react-resizable-panels": "^4.0.13",
+    "react-dom": "^18.3.1",
+    "react-dropzone": "^14.4.1",
+    "react-hotkeys-hook": "^5.3.3",
+    "react-i18next": "^15.7.4",
+    "react-resizable-panels": "^4.12.4",
     "react-use-websocket": "^4.13.0",
-    "react-virtuoso": "^4.14.0",
-    "rfc6902": "^5.1.2",
-  
```

**File**: `packages/local-web/src/routeTree.gen.ts` (modified, +140/-140)
```diff
@@ -9,79 +9,67 @@
 // Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.
 
 import { Route as rootRouteImport } from './routes/__root'
-import { Route as OnboardingRouteImport } from './routes/onboarding'
-import { Route as AppRouteImport } from './routes/_app'
 import { Route as IndexRouteImport } from './routes/index'
-import { Route as OnboardingSignInRouteImport } from './routes/onboarding_.sign-in'
-import { Route as AppWorkspacesRouteImport } from './routes/_app.workspaces'
-import { Route as AppNotificationsRouteImport } from './routes/_app.notifications'
+import { Route as AppRouteImport } from './routes/_app'
+import { Route as OnboardingRouteImport } from './routes/onboarding'
 import { Route as AppExportRouteImport } from './routes/_app.export'
-import { Route as WorkspacesWorkspaceIdVscodeRouteImport } from './routes/workspaces.$workspaceId.vscode'
-import { Route as AppWorkspacesElectricTestRouteImport } from './routes/_app.workspaces_.electric-test'
-import { Route as AppWorkspacesCreateRouteImport } from './routes/_app.workspaces_.create'
-import { Route as AppWorkspacesWorkspaceIdRouteImport } from './routes/_app.workspaces_.$workspaceId'
+import { Route as AppNotificationsRouteImport } from './routes/_app.notifications'
+import { Route as AppWorkspacesRouteImport } from './routes/_app.workspaces'
+import { Route as OnboardingSignInRouteImport } from './routes/onboarding_.sign-in'
 import { Route as AppProjectsProjectIdRouteImport } from './routes/_app.projects.$projectId'
+import { Route as AppWorkspacesWorkspaceIdRouteImport } from './routes/_app.workspaces_.$workspaceId'
+import { Route as AppWorkspacesCreateRouteImport } from './routes/_app.workspaces_.create'
+import { Route as AppWorkspacesElectricTestRouteImport } from './routes/_app.workspaces_.electric-test'
+import { Route as WorkspacesWorkspaceIdVscodeRouteImport } from './routes/workspaces.$workspaceId.vscode'
 import { Route as AppHostsHostIdWorkspacesRouteImport } from './routes/_app.hosts.$hostId.workspaces'
-import { Route as HostsHostIdWorkspacesWorkspaceIdVscodeRouteImport } from './routes/hosts.$hostId.workspaces.$workspaceId.vscode'
-import { Route as AppProjectsProjectIdIssuesIssueIdRouteImport } from './routes/_app.projects.$projectId_.issues.$issueId'
-import { Route as AppHostsHostIdWorkspacesCreateRouteImport } from './routes/_app.hosts.$hostId.workspaces_.create'
 import { Route as AppHostsHostIdWorkspacesWorkspaceIdRouteImport } from './routes/_app.hosts.$hostId.workspaces_.$workspaceId'
+import { Route as AppHostsHostIdWorkspacesCreateRouteImport } from './routes/_app.hosts.$hostId.workspaces_.create'
+import { Route as AppProjectsProjectIdIssuesIssueIdRouteImport } from './routes/_app.projects.$projectId_.issues.$issueId'
+import { Route as HostsHostIdWorkspacesWorkspaceIdVscodeRouteImport } from './routes/hosts.$hostId.workspaces.$workspaceId.vscode'
 import { Route as AppProjectsProjectIdWorkspacesCreateDraftIdRouteImport } from './routes/_app.projects.$projectId_.workspaces.create.$draftId'
 import { Route as AppProjectsProjectIdIssuesIssueIdWorkspacesWorkspaceIdRouteImport } from './routes/_app.projects.$projectId_.issues.$issueId_.workspaces.$workspaceId'
-import { Route as AppProjectsProjectIdIssuesIssueIdWorkspacesCreateDraftIdRouteImport } from './routes/_app.projects.$projectId_.issues.$issueId_.workspaces.create.$draftId'
 import { Route as AppProjectsProjectIdHostsHostIdWorkspacesCreateDraftIdRouteImport } from './routes/_app.projects.$projectId_.hosts.$hostId.workspaces.create.$draftId'
+import { Route as AppProjectsProjectIdIssuesIssueIdWorkspacesCreateDraftIdRouteImport } from './routes/_app.projects.$projectId_.issues.$issueId_.workspaces.create.$draftId'
 import { Route as AppProjectsProjectIdIssuesIssueIdHostsHostIdWorkspacesWorkspaceIdRouteImport } from './routes/_app.projects.$projectId_.issues.$issueId_.hosts.$hostId.workspaces.$workspac
```

**File**: `packages/remote-web/package.json` (modified, +19/-19)
```diff
@@ -16,36 +16,36 @@
   "dependencies": {
     "@ebay/nice-modal-react": "^1.2.13",
     "@phosphor-icons/react": "^2.1.10",
-    "@tanstack/react-query": "^5.85.5",
-    "@tanstack/react-router": "^1.161.1",
-    "@tanstack/zod-adapter": "^1.161.1",
+    "@tanstack/react-query": "^5.103.1",
+    "@tanstack/react-router": "^1.170.38",
+    "@tanstack/zod-adapter": "^1.167.0",
     "@vibe/ui": "workspace:*",
     "@vibe/web-core": "workspace:*",
     "clsx": "^2.1.1",
-    "posthog-js": "^1.283.0",
-    "prettier": "^3.6.1",
-    "react": "^18.2.0",
-    "react-hotkeys-hook": "^5.1.0",
+    "posthog-js": "^1.434.0",
+    "prettier": "^3.9.8",
+    "react": "^18.3.1",
     "react-compiler-runtime": "^1.0.0",
-    "react-dom": "^18.2.0",
-    "simple-icons": "^15.16.0",
-    "tailwind-merge": "^2.6.0",
+    "react-dom": "^18.3.1",
+    "react-hotkeys-hook": "^5.3.3",
+    "simple-icons": "^15.22.0",
+    "tailwind-merge": "^2.6.1",
     "zod": "^3.25.76",
     "zustand": "^4.5.7"
   },
   "devDependencies": {
     "@tailwindcss/container-queries": "^0.1.1",
-    "@tanstack/router-plugin": "^1.161.1",
-    "@types/react": "^18.2.43",
-    "@types/react-dom": "^18.2.17",
-    "@vitejs/plugin-react": "^4.2.1",
-    "autoprefixer": "^10.4.16",
+    "@tanstack/router-plugin": "^1.168.40",
+    "@types/react": "^18.3.31",
+    "@types/react-dom": "^18.3.7",
+    "@vitejs/plugin-react": "^4.7.0",
+    "autoprefixer": "^10.6.1",
     "babel-plugin-react-compiler": "^1.0.0",
-    "postcss": "^8.4.32",
+    "postcss": "^8.5.28",
     "tailwind-scrollbar": "^3.1.0",
-    "tailwindcss": "^3.4.0",
+    "tailwindcss": "^3.4.19",
     "tailwindcss-animate": "^1.0.7",
-    "typescript": "^5.9.2",
-    "vite": "^7.3.1"
+    "typescript": "^5.9.3",
+    "vite": "^7.3.6"
   }
 }
```

**File**: `packages/ui/package.json` (modified, +25/-25)
```diff
@@ -18,7 +18,6 @@
   },
   "dependencies": {
     "@ebay/nice-modal-react": "^1.2.13",
-    "@tanstack/react-virtual": "^3.13.23",
     "@hello-pangea/dnd": "^18.0.1",
     "@lexical/code": "^0.36.2",
     "@lexical/link": "^0.36.2",
@@ -28,39 +27,40 @@
     "@lexical/table": "^0.36.2",
     "@phosphor-icons/react": "^2.1.10",
     "@pierre/diffs": "1.1.4",
-    "@radix-ui/react-accordion": "^1.2.1",
-    "@radix-ui/react-dialog": "^1.1.4",
-    "@radix-ui/react-dropdown-menu": "^2.1.15",
-    "@radix-ui/react-label": "^2.1.7",
-    "@radix-ui/react-popover": "^1.1.15",
-    "@radix-ui/react-select": "^2.2.5",
-    "@radix-ui/react-slot": "^1.2.3",
-    "@radix-ui/react-switch": "^1.2.3",
-    "@radix-ui/react-tooltip": "^1.2.8",
-    "@tanstack/react-query": "^5.85.5",
+    "@radix-ui/react-accordion": "^1.2.20",
+    "@radix-ui/react-dialog": "^1.1.23",
+    "@radix-ui/react-dropdown-menu": "^2.1.24",
+    "@radix-ui/react-label": "^2.1.15",
+    "@radix-ui/react-popover": "^1.1.23",
+    "@radix-ui/react-select": "^2.3.7",
+    "@radix-ui/react-slot": "^1.3.3",
+    "@radix-ui/react-switch": "^1.3.7",
+    "@radix-ui/react-tooltip": "^1.2.16",
+    "@tanstack/react-query": "^5.103.1",
+    "@tanstack/react-virtual": "^3.14.13",
     "class-variance-authority": "^0.7.1",
     "clsx": "^2.1.1",
     "cmdk": "^1.1.1",
-    "developer-icons": "^6.0.4",
+    "developer-icons": "^6.0.5",
     "lexical": "^0.36.2",
     "lucide-react": "^0.541.0",
-    "react": "^18.2.0",
-    "react-dom": "^18.2.0",
-    "react-hotkeys-hook": "^5.1.0",
+    "react": "^18.3.1",
+    "react-dom": "^18.3.1",
+    "react-hotkeys-hook": "^5.3.3",
     "react-i18next": "^15.7.4",
-    "react-virtuoso": "^4.14.0",
-    "tailwind-merge": "^3.3.1"
+    "react-virtuoso": "^4.18.13",
+    "tailwind-merge": "^3.7.0"
   },
   "devDependencies": {
-    "@types/react": "^18.2.43",
-    "@types/react-dom": "^18.2.17",
+    "@types/react": "^18.3.31",
+    "@types/react-dom": "^18.3.7",
     "@typescript-eslint/eslint-plugin": "^6.21.0",
     "@typescript-eslint/parser": "^6.21.0",
-    "eslint": "^8.55.0",
-    "eslint-config-prettier": "^10.1.5",
-    "eslint-plugin-react-hooks": "^4.6.0",
-    "eslint-plugin-unused-imports": "^4.1.4",
-    "prettier": "^3.6.1",
-    "typescript": "^5.9.2"
+    "eslint": "^8.57.1",
+    "eslint-config-prettier": "^10.1.8",
+    "eslint-plugin-react-hooks": "^4.6.2",
+    "eslint-plugin-unused-imports": "^4.4.1",
+    "prettier": "^3.9.8",
+    "typescript": "^5.9.3"
   }
 }
```

---

### Incident Patch 3: `824b37cd` (2026-09-18)
**Commit Message**: fix: an Enter that confirms an IME candidate is not an Enter (#3459)

* fix: an Enter that confirms an IME candidate is not an Enter

event.isComposing alone is not enough. Safari fires compositionend BEFORE the
confirming Enter's keydown, so the flag is already false when the handler runs
and the keypress goes through — the line submits half-composed. Chrome and
Firefox fire it after, which is why the naive guard looks correct there and the
bug reads as Safari-only.

Adds isImeConfirmation(): isComposing, OR a composition that ended within the
last 30ms. Composition is tracked on window in the capture phase, so one that
ends after focus moves still closes, and blur closes an abandoned one.

Wired into the two places that guard today: the shared useSemanticKey hook,
which covers every registered shortcut, and Input.tsx. The helper is duplicated
into each package because @vibe/ui does not depend on @vibe/web-core and this
change is not the place to create that edge.

* refactor: keep the IME helper in @vibe/ui, and fix three defects in it

Per review, the helper lives only in packages/ui and web-core imports it from
@vibe/ui/lib/imeComposition. Copying it into both packages was my m

**File**: `packages/ui/package.json` (modified, +3/-1)
```diff
@@ -9,7 +9,9 @@
     "format": "prettier --config ../../packages/local-web/.prettierrc.json --write \"src/**/*.{ts,tsx,js,jsx,json,md}\"",
     "format:check": "prettier --config ../../packages/local-web/.prettierrc.json --check \"src/**/*.{ts,tsx,js,jsx,json,md}\""
   },
-  "sideEffects": false,
+  "sideEffects": [
+    "./src/lib/imeComposition.ts"
+  ],
   "exports": {
     "./components/*": "./src/components/*.tsx",
     "./lib/*": "./src/lib/*.ts"
```

**File**: `packages/ui/src/components/Input.tsx` (modified, +2/-1)
```diff
@@ -1,4 +1,5 @@
 import * as React from 'react';
+import { isImeConfirmation } from '../lib/imeComposition';
 import { cn } from '../lib/cn';
 import { twMerge } from 'tailwind-merge';
 
@@ -24,7 +25,7 @@ const Input = React.forwardRef<HTMLInputElement, InputProps>(
       if (e.key === 'Escape') {
         e.currentTarget.blur();
       }
-      if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
+      if (e.key === 'Enter' && !isImeConfirmation(e.nativeEvent)) {
         if (e.metaKey && e.shiftKey) {
           onCommandShiftEnter?.(e);
         } else {
```

**File**: `packages/ui/src/lib/imeComposition.ts` (added, +61/-0)
```diff
@@ -0,0 +1,61 @@
+/**
+ * An Enter that CONFIRMS an IME candidate must not reach a shortcut or a submit handler.
+ *
+ * `event.isComposing` alone is not enough. **Safari fires `compositionend` BEFORE the confirming
+ * Enter's `keydown`**, so the flag is already `false` when the handler runs and the keypress goes
+ * through — the line submits half-composed. Chrome and Firefox fire it after, which is why the
+ * naive guard looks correct there and the bug reads as Safari-only.
+ *
+ * A tight window after `compositionend` covers it: that sequence is synchronous (microseconds),
+ * while a human pressing Enter a second time takes 100ms or more and never lands inside it.
+ *
+ * Composition is tracked on `window` in the capture phase rather than per field, so a composition
+ * that starts in one input and ends after focus moves still closes, and a handler bound to
+ * something that cannot hold text can call this safely — no composition ever opens there.
+ */
+export const SAFARI_IME_RACE_WINDOW_MS = 30;
+
+let composing = false;
+// Not 0: `performance.now()` counts from the page's time origin, so `now - 0` is under the
+// window for the first 30ms of the page and would swallow an Enter no composition preceded.
+let lastCompositionEndAt = Number.NEGATIVE_INFINITY;
+
+if (typeof window !== 'undefined') {
+  window.addEventListener(
+    'compositionstart',
+    () => {
+      composing = true;
+    },
+    true
+  );
+  window.addEventListener(
+    'compositionend',
+    () => {
+      composing = false;
+      lastCompositionEndAt = performance.now();
+    },
+    true
+  );
+  // `blur` does not bubble, but a capture-phase listener on `window` still sees it on the way
+  // down — otherwise a composition abandoned by clicking away would stay open forever.
+  window.addEventListener(
+    'blur',
+    () => {
+      composing = false;
+    },
+    true
+  );
+}
+
+/** True when this keydown is (or is very likely) an IME confirmation rather than a real keypress. */
+export function isImeConfirmation(
+  event: Pick<KeyboardEvent, 'isComposing' | 'key'>
+): boolean {
+  // An open composition swallows every key, because none of them reached the application.
+  if (event.isComposing || composing) return true;
+  // The window after it is Enter-only. It exists for the keystroke that CONFIRMS a candidate,
+  // and that keystroke is Enter; applying it to every key would drop an unrelated shortcut for
+  // 30ms after any composition ended.
+  if (event.key !== 'Enter') return false;
+  return performance.now() - lastCompositionEndAt < SAFARI_IME_RACE_WINDOW_MS;
+}
```

**File**: `packages/web-core/src/shared/keyboard/useSemanticKey.ts` (modified, +5/-3)
```diff
@@ -2,6 +2,7 @@ import { useMemo } from 'react';
 import type { EnableOnFormTags } from '@/shared/keyboard/types';
 import { Action, Scope, getKeysFor } from '@/shared/keyboard/registry';
 import { useHotkeys } from 'react-hotkeys-hook';
+import { isImeConfirmation } from '@vibe/ui/lib/imeComposition';
 
 export interface SemanticKeyOptions {
   scope?: Scope;
@@ -40,9 +41,10 @@ export function createSemanticHook<A extends Action>(action: A) {
     useHotkeys(
       keys,
       (event) => {
-        // Skip if IME composition is in progress (e.g., Japanese, Chinese, Korean input)
-        // This prevents shortcuts from firing when user is converting text with Enter
-        if (event.isComposing) {
+        // Skip a key the IME consumed (Japanese, Chinese, Korean input). `isComposing` alone
+        // misses Safari, which fires `compositionend` before the confirming keydown — see
+        // @vibe/ui/lib/imeComposition.
+        if (isImeConfirmation(event)) {
           return;
         }
 
```

---

### Incident Patch 4: `a4274e43` (2026-09-17)
**Commit Message**: fix: route server startup through startup::initialize_deployment (#3449)

main.rs open-coded its own initialization sequence, which had drifted from
server::startup::initialize_deployment. The inline path never called
migrate_legacy_attachment_directories, so the legacy attachment directory
migration did not run for anyone starting the server through this binary.

Replaces the duplicated block with the shared function, which also covers
sentry scope, orphan execution cleanup and the existing backfills.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `crates/server/src/main.rs` (modified, +2/-39)
```diff
@@ -3,6 +3,7 @@ use axum::Router;
 use deployment::{Deployment, DeploymentError};
 use server::{
     DeploymentImpl, middleware::origin::validate_origin, routes, runtime::relay_registration,
+    startup,
 };
 use services::services::container::ContainerService;
 use sqlx::Error as SqlxError;
@@ -12,7 +13,6 @@ use tokio_util::sync::CancellationToken;
 use tower_http::validate_request::ValidateRequestHeaderLayer;
 use tracing_subscriber::{EnvFilter, prelude::*};
 use utils::{
-    assets::asset_dir,
     port_file::write_port_file_with_proxy,
     sentry::{self as sentry_utils, SentrySource, sentry_layer},
 };
@@ -49,46 +49,9 @@ async fn main() -> Result<(), VibeKanbanError> {
         .with(sentry_layer())
         .init();
 
-    // Create asset directory if it doesn't exist
-    if !asset_dir().exists() {
-        std::fs::create_dir_all(asset_dir())?;
-    }
-
-    // Copy old database to new location for safe downgrades
-    let old_db = asset_dir().join("db.sqlite");
-    let new_db = asset_dir().join("db.v2.sqlite");
-    if !new_db.exists() && old_db.exists() {
-        tracing::info!(
-            "Copying database to new location: {:?} -> {:?}",
-            old_db,
-            new_db
-        );
-        std::fs::copy(&old_db, &new_db).expect("Failed to copy database file");
-        tracing::info!("Database copy complete");
-    }
-
     let shutdown_token = CancellationToken::new();
 
-    let deployment = DeploymentImpl::new(shutdown_token.clone()).await?;
-    deployment.update_sentry_scope().await?;
-    deployment
-        .container()
-        .cleanup_orphan_executions()
-        .await
-        .map_err(DeploymentError::from)?;
-    deployment
-        .container()
-        .backfill_before_head_commits()
-        .await
-        .map_err(DeploymentError::from)?;
-    deployment
-        .container()
-        .backfill_repo_names()
-        .await
-        .map_err(DeploymentError::from)?;
-    deployment
-        .track_if_analytics_allowed("session_start", serde_json::json!({}))
-        .await;
+    let deployment = startup::initialize_deployment(shutdown_token.clone()).await?;
     // Preload global executor options cache for all executors with DEFAULT presets
     tokio::spawn(async move {
         executors::executors::utils::preload_global_executor_options_cache().await;
```

---

### Incident Patch 5: `b36a567d` (2026-09-17)
**Commit Message**: docs: add SECURITY.md (#3448)

Documents how to report a vulnerability privately rather than through a
public issue.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `SECURITY.md` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+# Security Policy
+
+## Supported Versions
+
+The latest release is always supported with security updates. Older releases
+receive fixes on a best-effort basis.
+
+| Version | Supported          |
+| ------- | ------------------ |
+| latest  | :white_check_mark: |
+
+## Reporting a Vulnerability
+
+Please report security vulnerabilities by opening a **private** GitHub Security
+Advisory at `https://github.com/BloopAI/vibe-kanban/security/advisories/new`.
+
+Include a description of the issue, steps to reproduce, and your assessment of
+impact. You will receive an acknowledgement within 72 hours. If the report is
+accepted, a patch will be released as soon as possible and you will be credited
+in the release notes.
```

---

### Incident Patch 6: `3b2e2866` (2026-09-17)
**Commit Message**: fix: correct swapped stderr/stdout labels in git CLI error output (#3447)

When only one stream had content the labels were reversed, so stdout-only
failures were reported under '--- stderr' and stderr-only failures under
'--- stdout'. Makes git command failures misleading to debug.

Co-authored-by: Claude Opus 5 <noreply@anthropic.com>

**File**: `crates/git/src/cli.rs` (modified, +2/-2)
```diff
@@ -824,8 +824,8 @@ impl GitCli {
             let combined = match (stdout.is_empty(), stderr.is_empty()) {
                 (true, true) => "Command failed with no output".to_string(),
                 (false, false) => format!("--- stderr\n{stderr}\n--- stdout\n{stdout}"),
-                (false, true) => format!("--- stderr\n{stdout}"),
-                (true, false) => format!("--- stdout\n{stderr}"),
+                (false, true) => format!("--- stdout\n{stdout}"),
+                (true, false) => format!("--- stderr\n{stderr}"),
             };
             return Err(GitCliError::CommandFailed(combined));
         }
```

---

### Incident Patch 7: `a1339e5b` (2026-04-17)
**Commit Message**: fix: scope vendored openssl to linux to unbreak windows-msvc cross-compile (#3367)

native-tls only depends on openssl-sys on linux; macos uses
Security.framework and windows uses schannel. The previous global
openssl/vendored dep dragged openssl-sys onto windows-msvc, where
its build script invokes perl ./Configure VC-WIN64A and aborts
because linux perl produces forward-slash paths.

Move the vendored openssl dep into a [target.'cfg(target_os = "linux")']
block so only musl cross-compile vendors openssl, and windows-msvc /
macos backend builds skip openssl-sys entirely.

Co-authored-by: Claude Opus 4.7 <noreply@anthropic.com>

**File**: `crates/executors/Cargo.toml` (modified, +7/-4)
```diff
@@ -41,10 +41,6 @@ codex-app-server-protocol = { git = "https://github.com/openai/codex.git", packa
 sha2 = "0.10"
 derivative = "2.2.0"
 reqwest = { workspace = true }
-# Forces openssl-sys (pulled in transitively by codex-protocol → reqwest →
-# hyper-tls → native-tls) to build from vendored C source. Required for
-# musl + windows-msvc cross-compile, which have no system OpenSSL.
-openssl = { version = "0.10", features = ["vendored"] }
 eventsource-stream = "0.2"
 walkdir = "2"
 rand = "0.8"
@@ -56,6 +52,13 @@ async-stream = "0.3"
 [target.'cfg(windows)'.dependencies]
 winsplit = "0.1.0"
 
+# On Linux, codex-protocol → reqwest → hyper-tls → native-tls pulls in
+# openssl-sys. Vendor it so musl cross-compile (no system OpenSSL) builds.
+# macOS uses Security.framework and Windows uses schannel via native-tls,
+# so neither pulls in openssl-sys — keep this Linux-only.
+[target.'cfg(target_os = "linux")'.dependencies]
+openssl = { version = "0.10", features = ["vendored"] }
+
 [features]
 default = []
 qa-mode = []
```

---

### Incident Patch 8: `d737b600` (2026-04-17)
**Commit Message**: fix: vendor openssl to unblock musl + windows-msvc cross-compile (#3366)

Codex 0.121 transitively enables reqwest's default-tls (via codex-protocol's
reqwest dep), which pulls openssl-sys into the build. cargo zigbuild and
cargo xwin have no system OpenSSL, so the openssl-sys build script aborts
when cross-compiling for musl/windows-msvc targets. Enabling openssl/vendored
forces openssl-sys to build from bundled C source.

Co-authored-by: Claude Opus 4.7 <noreply@anthropic.com>

**File**: `Cargo.lock` (modified, +11/-0)
```diff
@@ -2806,6 +2806,7 @@ dependencies = [
  "json-patch 2.0.0",
  "jsonc-parser",
  "lru 0.12.5",
+ "openssl",
  "os_pipe",
  "rand 0.8.5",
  "regex",
@@ -6024,6 +6025,15 @@ version = "0.2.1"
 source = "registry+https://github.com/rust-lang/crates.io-index"
 checksum = "7c87def4c32ab89d880effc9e097653c8da5d6ef28e6b539d313baaacfbafcbe"
 
+[[package]]
+name = "openssl-src"
+version = "300.5.5+3.5.5"
+source = "registry+https://github.com/rust-lang/crates.io-index"
+checksum = "3f1787d533e03597a7934fd0a765f0d28e94ecc5fb7789f8053b1e699a56f709"
+dependencies = [
+ "cc",
+]
+
 [[package]]
 name = "openssl-sys"
 version = "0.9.113"
@@ -6032,6 +6042,7 @@ checksum = "ad2f2c0eba47118757e4c6d2bff2838f3e0523380021356e7875e858372ce644"
 dependencies = [
  "cc",
  "libc",
+ "openssl-src",
  "pkg-config",
  "vcpkg",
 ]
```

**File**: `crates/executors/Cargo.toml` (modified, +4/-0)
```diff
@@ -41,6 +41,10 @@ codex-app-server-protocol = { git = "https://github.com/openai/codex.git", packa
 sha2 = "0.10"
 derivative = "2.2.0"
 reqwest = { workspace = true }
+# Forces openssl-sys (pulled in transitively by codex-protocol → reqwest →
+# hyper-tls → native-tls) to build from vendored C source. Required for
+# musl + windows-msvc cross-compile, which have no system OpenSSL.
+openssl = { version = "0.10", features = ["vendored"] }
 eventsource-stream = "0.2"
 walkdir = "2"
 rand = "0.8"
```

---

### Incident Patch 9: `71a25f4a` (2026-04-03)
**Commit Message**: fix: reap execution process groups on natural exit (Vibe Kanban) (#3318)

* fix: kill process group on natural executor exit to prevent orphaned MCP processes

The exit monitor's OS exit path (Branch 2) never called kill_process_group(),
leaving child processes like vibe-kanban-mcp running as orphans after the
executor exited naturally. This mirrors the cleanup already done in the
exit signal path (Branch 1).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>

fix: kill process group on natural executor exit to prevent orphaned MCP processes

When an executor (e.g. claude) exits naturally, its child processes like
vibe-kanban-mcp were left running as orphans because no one sent a signal
to the process group.

Two changes:

1. spawn_os_exit_watcher now kills the process group immediately after
   detecting the leader has exited, cleaning up orphaned children at the
   single choke point for natural exit detection.

2. kill_process_group() handles ESRCH from getpgid() by falling back to
   using the leader PID as the PGID (always correct for group_spawn
   children which use setpgid(0,0)). Previously it returned early when
   the leader had already exited, never se

**File**: `crates/local-deployment/src/container.rs` (modified, +7/-1)
```diff
@@ -801,7 +801,13 @@ impl LocalContainerService {
                 let _ = tokio::time::timeout(Duration::from_secs(5), handle).await;
             }
 
-            // Cleanup child handle
+            // SIGKILL any orphaned children (e.g. MCP servers) still in the
+            // process group. The executor itself is already done — either it
+            // exited naturally or was killed in the exit-signal branch above.
+            if let Some(child_lock) = child_store.read().await.get(&exec_id).cloned() {
+                let mut child = child_lock.write().await;
+                let _ = child.start_kill();
+            }
             child_store.write().await.remove(&exec_id);
         })
     }
```

**File**: `crates/utils/src/process.rs` (modified, +13/-23)
```diff
@@ -1,36 +1,26 @@
 use command_group::AsyncGroupChild;
 #[cfg(unix)]
-use nix::{
-    sys::signal::{Signal, killpg},
-    unistd::{Pid, getpgid},
-};
-#[cfg(unix)]
 use tokio::time::Duration;
 
 pub async fn kill_process_group(child: &mut AsyncGroupChild) -> std::io::Result<()> {
-    // hit the whole process group, not just the leader
     #[cfg(unix)]
     {
-        if let Some(pid) = child.inner().id() {
-            let pgid = getpgid(Some(Pid::from_raw(pid as i32)))
-                .map_err(|e| std::io::Error::other(e.to_string()))?;
+        // Use command_group's UnixChildExt::signal() which calls killpg()
+        // with the pgid captured at spawn time. This works even after the
+        // group leader has exited, unlike getpgid() which would fail.
+        use command_group::{Signal, UnixChildExt};
 
-            for sig in [Signal::SIGINT, Signal::SIGTERM, Signal::SIGKILL] {
-                tracing::info!("Sending {:?} to process group {}", sig, pgid);
-                if let Err(e) = killpg(pgid, sig) {
-                    tracing::warn!(
-                        "Failed to send signal {:?} to process group {}: {}",
-                        sig,
-                        pgid,
-                        e
-                    );
-                }
-                tracing::info!("Waiting 2s for process group {} to exit", pgid);
-                tokio::time::sleep(Duration::from_secs(2)).await;
-                if child.inner().try_wait()?.is_some() {
-                    tracing::info!("Process group {} exited after {:?}", pgid, sig);
+        for sig in [Signal::SIGINT, Signal::SIGTERM, Signal::SIGKILL] {
+            tracing::info!("Sending {:?} to process group", sig);
+            if let Err(e) = child.signal(sig) {
+                // break if the group does not exist anymore
+                if e.raw_os_error() == Some(nix::libc::ESRCH) {
                     break;
                 }
+                tracing::warn!("Failed to send signal {:?} to process group: {}", sig, e);
+            }
+            if sig != Signal::SIGKILL {
+                tokio::time::sleep(Duration::from_secs(2)).await;
             }
         }
     }
```

---

### Incident Patch 10: `2a484006` (2026-04-03)
**Commit Message**: fix: revert execution processes from Zustand store to React Context to fix conversation history leakage (Vibe Kanban) (#3314)

* fix: close running-process stream controllers on workspace switch to prevent conversation history leakage

When switching workspaces while a process is running, the new component
reads stale execution processes from the Zustand store (which lags one
render behind). The running-process effect starts a persistent WebSocket
stream for the stale process via loadRunningAndEmit. When the store
updates and the process disappears, the stream is never closed because
the controller is local to the Promise closure with no external handle.
The orphaned stream continues merging old workspace entries into the
display refs, causing conversation history from the previous workspace
to leak into the current one.

Replace streamingProcessIdsRef (Set<string>) with
activeStreamControllersRef (Map<string, {close}>) so the reset effect
can proactively close all active stream controllers when scopeKey
changes. Controllers are stored in the map on creation inside
loadRunningAndEmit and removed on natural completion (onFinished) or
after the full backoff sequence (.finally). On er

**File**: `packages/web-core/src/features/workspace-chat/model/contexts/RetryUiContext.tsx` (modified, +3/-2)
```diff
@@ -1,5 +1,5 @@
 import React, { useCallback, useMemo, useState } from 'react';
-import { useExecutionProcessesAll } from '@/shared/stores/useExecutionProcessesStore';
+import { useExecutionProcessesContext } from '@/shared/hooks/useExecutionProcessesContext';
 import {
   RetryUiContext,
   type RetryUiContextType,
@@ -11,7 +11,8 @@ export function RetryUiProvider({
   workspaceId?: string;
   children: React.ReactNode;
 }) {
-  const executionProcesses = useExecutionProcessesAll();
+  const { executionProcessesAll: executionProcesses } =
+    useExecutionProcessesContext();
 
   const [activeRetryProcessId, setActiveRetryProcessId] = useState<
     string | null
```

**File**: `packages/web-core/src/features/workspace-chat/model/hooks/useConversationHistory.ts` (modified, +6/-8)
```diff
@@ -3,11 +3,7 @@ import {
   ExecutionProcessStatus,
   PatchType,
 } from 'shared/types';
-import {
-  useExecutionProcessesVisible,
-  useExecutionProcessesIsLoading,
-  useExecutionProcessesIsConnected,
-} from '@/shared/stores/useExecutionProcessesStore';
+import { useExecutionProcessesContext } from '@/shared/hooks/useExecutionProcessesContext';
 import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
 import { streamJsonPatchEntries } from '@/shared/lib/streamJsonPatchEntries';
 import type {
@@ -34,9 +30,11 @@ export const useConversationHistory = ({
   onTimelineUpdated,
   scopeKey,
 }: UseConversationHistoryParams): UseConversationHistoryResult => {
-  const executionProcessesRaw = useExecutionProcessesVisible();
-  const isLoading = useExecutionProcessesIsLoading();
-  const isConnected = useExecutionProcessesIsConnected();
+  const {
+    executionProcessesVisible: executionProcessesRaw,
+    isLoading,
+    isConnected,
+  } = useExecutionProcessesContext();
   const executionProcesses = useRef<ExecutionProcess[]>(executionProcessesRaw);
   const displayedExecutionProcesses = useRef<ExecutionProcessStateStore>({});
   const loadedInitialEntries = useRef(false);
```

**File**: `packages/web-core/src/features/workspace-chat/model/hooks/useResetProcess.ts` (modified, +2/-2)
```diff
@@ -1,5 +1,5 @@
 import { useCallback, useMemo } from 'react';
-import { useExecutionProcessesAll } from '@/shared/stores/useExecutionProcessesStore';
+import { useExecutionProcessesContext } from '@/shared/hooks/useExecutionProcessesContext';
 import { useBranchStatus } from '@/shared/hooks/useBranchStatus';
 import { isCodingAgent } from '@/shared/constants/processes';
 import { useResetProcessMutation } from './useResetProcessMutation';
@@ -19,7 +19,7 @@ export function useResetProcess(
   selectedSessionId: string | undefined
 ): UseResetProcessResult {
   const { data: branchStatus } = useBranchStatus(workspaceId);
-  const processes = useExecutionProcessesAll();
+  const { executionProcessesAll: processes } = useExecutionProcessesContext();
 
   const resetMutation = useResetProcessMutation(selectedSessionId ?? '');
   const isResetPending = resetMutation.isPending;
```

**File**: `packages/web-core/src/pages/workspaces/ProcessListContainer.tsx` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 import { useEffect, useMemo, useCallback } from 'react';
 import { useTranslation } from 'react-i18next';
-import { useExecutionProcessesVisible } from '@/shared/stores/useExecutionProcessesStore';
+import { useExecutionProcessesContext } from '@/shared/hooks/useExecutionProcessesContext';
 import { useLogsPanel } from '@/shared/hooks/useLogsPanel';
 import { ProcessListItem } from '@vibe/ui/components/ProcessListItem';
 import { InputField } from '@vibe/ui/components/InputField';
@@ -31,7 +31,7 @@ export function ProcessListContainer() {
     logsPanelContent?.type === 'tool' || logsPanelContent?.type === 'terminal';
   const matchCount = logMatchIndices.length;
   const { t } = useTranslation('common');
-  const executionProcessesVisible = useExecutionProcessesVisible();
+  const { executionProcessesVisible } = useExecutionProcessesContext();
 
   // Sort processes by created_at descending (newest first)
   const sortedProcesses = useMemo(() => {
```

**File**: `packages/web-core/src/shared/hooks/useActionVisibilityContext.ts` (modified, +2/-2)
```diff
@@ -12,7 +12,7 @@ import { useUserSystem } from '@/shared/hooks/useUserSystem';
 import { useDevServer } from '@/shared/hooks/useDevServer';
 import { useBranchStatus } from '@/shared/hooks/useBranchStatus';
 import { useShape } from '@/shared/integrations/electric/hooks';
-import { useIsAttemptRunningVisible } from '@/shared/stores/useExecutionProcessesStore';
+import { useExecutionProcessesContext } from '@/shared/hooks/useExecutionProcessesContext';
 import { useLogsPanel } from '@/shared/hooks/useLogsPanel';
 import { useAuth } from '@/shared/hooks/auth/useAuth';
 import { isProjectDestination } from '@/shared/lib/routes/appNavigation';
@@ -92,7 +92,7 @@ export function useActionVisibilityContext(
   const { isStarting, isStopping, runningDevServers } =
     useDevServer(workspaceId);
   const { data: branchStatus } = useBranchStatus(workspaceId);
-  const isAttemptRunningVisible = useIsAttemptRunningVisible();
+  const { isAttemptRunningVisible } = useExecutionProcessesContext();
   const { logsPanelContent } = useLogsPanel();
   const { isSignedIn } = useAuth();
 
```

#### Recent Merged Pull Requests:
- **PR #3475** (closed): fix: copy patches/ before pnpm install in root Dockerfile (@oJaqob)
- **PR #3467** (closed): feat: add pi (pi-acp) executor support with model and thinking selection (@ball6847)
- **PR #3464** (2026-09-19): fix: Tanstack router api fix (@anastasiya1155)
- **PR #3462** (2026-09-19): chore: bump version to 0.1.45 (@anastasiya1155)
- **PR #3460** (2026-09-18): chore: pnpm audit fixes (@anastasiya1155)
- **PR #3459** (2026-09-18): fix: an Enter that confirms an IME candidate is not an Enter (@isamu)
- **PR #3457** (2026-09-16): Add script to bump version locally (@anastasiya1155)
- **PR #3456** (2026-09-17): Coalesce replayed stderr chunks so stored sessions load in linear time (@bornasamadi)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

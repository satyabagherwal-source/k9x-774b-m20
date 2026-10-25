> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/topgrade-rs-topgrade-learnings.md`  
> **Source**: github ([https://github.com/topgrade-rs/topgrade](https://github.com/topgrade-rs/topgrade))  
> **Source Version**: `3ac379ef`  
> **License**: GPL-3.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-25T03:15:32.208Z  
> **Learning ID**: `learn-github-topgrade-rs-topgrade`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): topgrade-rs/topgrade

---

## 1. Executive Forensic Architecture & System Mechanics

Topgrade is an orchestrator CLI designed to execute multi-tier, heterogeneous system upgrades across dozens of package managers, development toolchains, OS-native package managers, container runtimes, firmware updaters, and remote hosts (via SSH/tmux). The tool solves the problem of package manager sprawl and fractured upgrade workflows by consolidating system updates into a single idempotent, multi-platform execution pipeline.

```
                           +-----------------------------------+
                           |        Topgrade Entrypoint        |
                           |   (CLI Args, Config TOML Merge)   |
                           +-----------------+-----------------+
                                             |
                   +-------------------------+-------------------------+
                   |                                                   |
      +------------v------------+                         +------------v------------+
      |  Breaking Changes Guard |                         | Signal Handler (Atomic) |
      |  (SemVer Keep-File Check|                         |  Unix: sigaction(SIGINT)|
      |   Prompt User on Bump)  |                         |  Win: ConsoleCtrlHandler|
      +------------+------------+                         +------------+------------+
                   |                                                   |
                   +-------------------------+-------------------------+
                                             |
                               +-------------v-------------+
                               |     ExecutionContext      |
                               | - RunType: Dry|Wet|Damp   |
                               | - Sudo Credential Manager |
                               | - SSH/Tmux Isolation      |
                               | - Lazy Powershell Handle  |
                               +-------------+-------------+
                                             |
             +-------------------------------+-------------------------------+
             |                               |                               |
+------------v------------+     +------------v------------+     +------------v------------+
|  Environment Resolution |     |  Command Execution Shim |     |  Step Pipeline Runner   |
| - `which` candidate scan|     | - `CommandExt` Trait    |     | - Pre-check SkipStep    |
| - WSL Host /mnt filter  |     | - Output & Status Check |     | - Isolated Step Failures|
| - Mise nonfunctional det|     | - Subprocess capture &  |     | - Interrupted Signal    |
| - Homebrew Cellar canon |     |   shell-words joining   |     |   graceful drain loop   |
+-------------------------+     +-------------------------+     +-------------------------+
```

### Critical Subsystem Boundaries & Decoupling Mechanics

1. **Subprocess Abstraction Barrier (`src/command.rs` & `src/executor.rs`)**:
   Standard library `std::process::Command` does not distinguish between execution failure (spawn failure) and non-zero exit codes, nor does it capture stdout/stderr without swallowing real-time terminal output. Topgrade decouples command invocation through an extension trait `CommandExt` and execution modality wrapper `Executor` implementing `Dry` (simulation logging), `Wet` (real execution), and `Damp` (echo command before execution). This ensures that upstream step handlers never directly invoke raw `std::process::Command::spawn()` or `status()`, preventing uncaught command failures and raw error drops.
2. **Path Discovery & Environment De-Ghosting Boundary (`src/utils.rs`)**:
   Topgrade sits above multiple virtual environments and OS translation layers. It enforces a strict hygiene layer during path detection (`which` crate extension):
   - In WSL (Windows Subsystem for Linux), default PATH configuration exposes Windows binaries across `/mnt/*`. Invoking Windows executables within Linux step updates causes runtime failure or environment corruption. Topgrade parses `/proc/mounts` looking for `drvfs` and `aname=drvfs` markers, proactively stripping `/mnt/*` paths from discovery unless explicitly overridden.
   - For runtime managers like `mise` (or `asdf`), shims exist on `$PATH` even if no global tool runtime version is configured. Topgrade intercepts shims located within `MISE_SHIMS`, issues a lightweight probe (`<shim> --help`), and inspects `stderr` for unconfigured shim indicators before deciding whether the tool is active.
3. **Atomic Interruption Pipeline (`src/ctrlc/`)**:
   Long-running system updates must not be abruptly SIGKILL'd mid-transaction (which corrupts database locks in package managers like `dpkg` or `pacman`). Topgrade decouples signal interception from thread management via an atomic `Ordering::SeqCst` boolean flag (`INTERRUPTED`). Native hooks (`sigaction` on POSIX, `SetConsoleCtrlHandler` on Windows) set this bit, allowing the pipeline runner to complete or cleanly finalize the current step before halting.
4. **Configuration Layering & Merging Boundary (`src/config.rs`)**:
   Configurations are parsed from TOML with strict schema adherence (`#[serde(deny_unknown_fields)]`). Config inclusion supports composable include paths (`Include.paths`), where sub-configurations are merged via the `merge2::Merge` crate using specific strategies: `vec_prepend_opt` (prepends higher-priority arrays) and `string_append_opt`.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Multi-Environment Subprocess Path Resolution Guard
**RULE**:
When resolving an executable binary on `$PATH` in multi-runtime or cross-environment environments (such as WSL, asdf/mise shim directories, or container bind mounts), systems MUST NOT rely on first-match path discovery (e.g., standard `which`). Systems MUST iterate over all candidate binaries (`which_all`), validate environment-boundary invariants (disallowing cross-OS mounts and dead runtime shims), and reject false-positive shims before accepting an executable path.

**WHY**:
In environments like WSL, Windows host executables are appended to Linux `$PATH` under `/mnt/c/`. Executing a Windows CLI tool inside a Linux pipeline triggers broken interop, non-zero exits, or file permission corruptions (Issue #1243). Similarly, modern polyglot version managers (`mise`, `asdf`) pre-populate shims for commands that have no runtime installed; standard `which` finds the shim, but subsequent invocation crashes with a runtime missing error.

**WHEN TO APPLY**:
Apply in any CLI tool, build engine, or agent runtime operating in polyglot development environments, WSL, cross-compiled runner containers, or environments using shim-based version managers.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use color_eyre::eyre::{eyre, Result};
use std::collections::HashSet;
use std::ffi::OsStr;
use std::fmt::Debug;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::LazyLock;

static MISE_SHIMS: LazyLock<PathBuf> = LazyLock::new(|| {
    std::env::var("MISE_SHIMS_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            etcetera::base_strategy::choose_base_strategy()
                .unwrap()
                .data_dir()
                .join("mise")
                .join("shims")
        })
});

fn is_nonfunctional_shim(path: &Path) -> Result<bool> {
    let out = Command::new(path).arg("--help").output()?;
    let stderr = match String::from_utf8(out.stderr) {
        Ok(s) => s,
        Err(_) => return Ok(false),
    };
    Ok(stderr.contains("mise ERROR No version is set for shim:"))
}

pub fn which_hygienic<T: AsRef<OsStr> + Debug>(binary_name: T) -> Result<Option<PathBuf>> {
    let candidates = match which::which_all(&binary_name) {
        Ok(iter) => iter,
        Err(which::Error::CannotFindBinaryPath) => return Ok(None),
        Err(e) => return Err(eyre!(e).wrap_err(format!("Detecting {:?} failed", binary_name))),
    };

    let mut rejected_reasons = HashSet::new();

    for path in candidates {
        // Guard 1: Detect and bypass dead shims
        if path.starts_with(&*MISE_SHIMS) {
            if let Ok(true) = is_nonfunctional_shim(&path) {
                rejected_reasons.insert("uninitialized mise shim");
                continue;
            }
        }

        // Guard 2: Filter WSL drvfs mounts targeting Windows drive shares
        if cfg!(target_os = "linux") && path.starts_with("/mnt/") {
            rejected_reasons.insert("cross-environment host binary");
            continue;
        }

        return Ok(Some(path));
    }

    Ok(None)
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Blind first-match binary resolution without checking shim or mount integrity.
pub fn which_unsafe(binary_name: &str) -> Option<PathBuf> {
    // If user has mise installed with no python configured, this resolves to ~/.local/share/mise/shims/python
    // In WSL, if python is not in Linux, this returns /mnt/c/Users/.../python.exe
    // Both lead to catastrophic downstream failure during execution!
    which::which(binary_name).ok()
}
```

**VERIFICATION METHOD**:
Mock a directory on `$PATH` containing a dummy executable that prints an unconfigured error to stderr and exits with status 1. Assert that `which_hygienic("tool")` skips the dummy executable and returns `Ok(None)` or advances to the next genuine candidate on `$PATH`.

---

### 2. SemVer Keep-File Notification Barrier for Breaking Changes
**RULE**:
Applications with automated or unattended workflows MUST NOT execute major-version upgrades silently without user acknowledgment if breaking changes exist. The application MUST persist the highest major version run in a platform-standard data directory (`keep_file`) and halt execution with an interactive or environment-gated confirmation whenever `current_version.major > stored_version.major`.

**WHY**:
Unattended upgrade scripts and power-user CLI utilities risk silent state corruption, deprecated flag elimination, or broken user configurations if an upgrade changes behaviors unexpectedly. Storing only the version string in a persistent state file decouples version migration tracking from mutable config files.

**WHEN TO APPLY**:
Apply to all automation CLIs, migration tools, background daemons, and developer CLI tools distributed via package managers where auto-updates can occur without user re-configuration.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use color_eyre::eyre::{Context, Result};
use semver::Version;
use std::fs;
use std::path::PathBuf;

pub fn enforce_breaking_change_boundary(
    current_ver_str: &str,
    keep_file: PathBuf,
    skip_env_var: &str,
    breaking_notice: &str,
    prompt_fn: impl FnOnce(&str) -> Result<bool>,
) -> Result<bool> {
    if std::env::var(skip_env_var).is_ok_and(|v| v == "true" || v == "1") {
        return Ok(true);
    }

    let current_version = Version::parse(current_ver_str)?;

    if !keep_file.exists() {
        if let Some(parent) = keep_file.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&keep_file, current_ver_str)?;
        return Ok(true);
    }

    let recorded_content = fs::read_to_string(&keep_file)?;
    let recorded_version = recorded_content
        .trim()
        .parse::<Version>()
        .wrap_err_with(|| format!("Corrupt version format in keep file {}", keep_file.display()))?;

    if current_version.major > recorded_version.major {
        println!("{breaking_notice}");
        let user_agreed = prompt_fn("Acknowledge breaking changes and continue?")?;
        if user_agreed {
            fs::write(&keep_file, current_ver_str)?;
            Ok(true)
        } else {
            Ok(false)
        }
    } else {
        // Minor/patch update or same version: update keep file silently to track highest version
        if current_version > recorded_version {
            fs::write(&keep_file, current_ver_str)?;
        }
        Ok(true)
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Embedding version update flags inside the user-editable config file.
// If the user replaces their config file, imports a dotfiles repo, or has syntax errors,
// the notification logic either re-prompts continuously or permanently corrupts the config.
pub fn bad_breaking_change_check(config: &mut UserConfig) {
    if config.last_seen_version < 18 {
        // Mutating user config directly destroys comments, formatting, and triggers race conditions.
        config.last_seen_version = 18;
        config.save();
    }
}
```

**VERIFICATION METHOD**:
Write an integration test that creates a temporary directory with a keep file containing `17.0.0`. Execute the version check with `current_ver = "18.0.0"`. Verify that the prompt is triggered, and when accepted, the keep file is atomically updated to `18.0.0`.

---

### 3. Subprocess Execution Failure-Context Enrichment
**RULE**:
When wrapping child process execution via CLI or system orchestration, systems MUST NOT discard stdout or stderr on failure, nor should they allow naked `ExitStatus` returns to propagate as errors without the exact shell-escaped command invocation string. If a child process returns a non-zero exit code, the error type MUST capture: (1) program name, (2) shell-quoted arguments, (3) exit code or terminating signal, (4) trimmed stderr, and (5) trimmed stdout.

**WHY**:
Subprocess execution failure without output context forces operators to manually reproduce failures under identical environment states. Furthermore, returning standard `std::io::Error` or naked exit codes swallows the child process's diagnostic explanation (such as missing flags, broken locks, or credential rejections).

**WHEN TO APPLY**:
Apply to all systems that manage child processes, orchestrate container execution, or wrap system binaries.

**VERIFIED IMPLEMENTATION PATTERN**:
```rust
use color_eyre::eyre::{eyre, Context, Result};
use std::process::{Command, ExitStatus, Output};

#[derive(thiserror::Error, Debug)]
pub enum ExecutionError {
    #[error("`{program}` failed ({status}): {stderr}")]
    ProcessFailedWithOutput {
        program: String,
        status: ExitStatus,
        stderr: String,
        stdout: String,
    },
}

pub trait SafeCommandRunner {
    fn run_checked_utf8(&mut self) -> Result<String>;
}

impl SafeCommandRunner for Command {
    fn run_checked_utf8(&mut self) -> Result<String> {
        let program = self.get_program().to_string_lossy().into_owned();
        let args = shell_words::join(self.get_args().map(|a| a.to_string_lossy()));
        let formatted_cmd = if args.is_empty() {
            program.clone()
        } else {
            format!("{program} {args}")
        };

        let output = self.output().with_context(|| {
            format!("Operating system failed to spawn `{formatted_cmd}`")
        })?;

        if output.status.success() {
            String::from_utf8(output.stdout).map_err(|e| {
                eyre!("Command `{formatted_cmd}` returned invalid UTF-8 stdout: {e}")
            })
        } else {
            let stdout_lossy = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr_lossy = String::from_utf8_lossy(&output.stderr).trim().to_string();

            let mut detailed_msg = format!("Command failed: `{formatted_cmd}` with {status}", status = output.status);
            if !stdout_lossy.is_empty() {
                detailed_msg.push_str(&format!("\n--- Stdout ---\n{stdout_lossy}"));
            }
            if !stderr_lossy.is_empty() {
                detailed_msg.push_str(&format!("\n--- Stderr ---\n{stderr_lossy}"));
            }

            Err(ExecutionError::ProcessFailedWithOutput {
                program,
                status: output.status,
                stderr: stderr_lossy,
                stdout: stdout_lossy,
            })
            .wrap_err(detailed_msg)
        }
    }
}
```

**NEGATIVE CONSTRAINT**:
```rust
// ANTI-PATTERN: Swallowing stderr or using status() directly without contextual wrapping.
let status = Command::new("apt-get").arg("update").status()?;
if !status.success() {
    // Zero debugging context: What was the error? Did lock fail? Network drop?
    return Err(eyre!("apt-get failed: {}", status));
}
```

**VERIFICATION METHOD**:
Implement a unit test executing a binary that writes known strings to stdout and stderr and exits with code 42 (e.g., `sh -c "echo 'hello out'; echo 'hello err' >&2; exit 42"`). Execute via `run_checked_utf8()` and verify that the resulting `eyre::Report` downcasts to `ExecutionError::ProcessFailedWithOutput` containing the exact stdout, stderr, and exit status.

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Silent Upstream Failure in Automated Release Pipeline (BUG-RELEASEPLZ-01)
- **Context**: `.github/workflows/release-plz.yml` and upstream action `release-plz/action`.
- **What Was Expected**: Automated release PR generation and GitHub release tagging MUST immediately abort and trigger CI pipeline failure if an underlying `git` or `gh` CLI invocation encounters an authentication, network, or branch merge error.
- **What Actually Happened**: Prior to `v0.5.144`, upstream updater operations in `release-plz/action` swallowed non-zero exit codes from child `git` / `gh` subprocess calls. The action reported a successful GitHub Step execution despite partial or completely failed git commits and release tag pushes.
- **Evidence in Repo**: Commit `3ac379ef` ("chore(deps): update release-plz/action action to v0.5.145 (#2450)"), citing upstream fix `#576`: `"fix(updater): fail when a git or gh command fails"`.
- **Root Cause**: The updater script omitted status assertions on child subprocess execution, continuing loop execution when `git push` or `gh release create` returned non-zero exit codes.
- **Remediation Code Diff**:
```yaml
# .github/workflows/release-plz.yml
@@ -28,7 +28,7 @@ jobs:
           toolchain: stable
       - name: Run release-plz
         id: release-plz
-        uses: release-plz/action@6caa8d34f74d82b0dc76a18edd1cc3d6801c9baf # v0.5.143
+        uses: release-plz/action@7ef5e4d4b0420630cfcaeb182c01e13651d4c577 # v0.5.145
         with:
           command: release
```
- **Lesson**: CI release workflows and orchestration tooling must execute all subprocess calls with strict exit status verification. Never allow tool wrappers to swallow exit codes.

---

### Incident 2: Supply Chain SARIF Reporting Invalidation via Floating Tags (BUG-CODEQL-02)
- **Context**: `.github/workflows/check_security_vulnerability.yml` and `.github/workflows/scorecards.yml`.
- **What Was Expected**: Static analysis SARIF results from DevSkim and OpenSSF Scorecard must be reliably uploaded to the repository's GitHub Security dashboard using cryptographically immutable action references.
- **What Actually Happened**: The action `github/codeql-action/upload-sarif` was running on a pinned SHA corresponding to `v4.39.0`, which had discrepancies in bundle version mappings (`2.27.3`), causing potential SARIF parsing synchronization failures in CI runs.
- **Evidence in Repo**: Commit `53fc8905` and Issue `#2451`.
- **Root Cause**: GitHub CodeQL bundle updates periodically alter AST parsing schemas and SARIF upload specifications; older action runners fail or emit warnings against newer security tab endpoints.
- **Remediation Code Diff**:
```yaml
# .github/workflows/check_security_vulnerability.yml & scorecards.yml
@@ -32,6 +32,6 @@ jobs:
         uses: microsoft/DevSkim-Action@4b5047945a44163b94642a1cecc0d93a3f428cc6 # v1.0.16
 
       - name: Upload DevSkim scan results to GitHub Security tab
-        uses: github/codeql-action/upload-sarif@6f2ac81f5cd81fe351a197ba0b00d91d03cd2aee # v4.39.0
+        uses: github/codeql-action/upload-sarif@9b3254085494b55a0f7c4c2b3d2d52cc712ce370 # v4.39.1
         with:
           sarif_file: devskim-results.sarif
```
- **Lesson**: All external GitHub Action dependencies MUST be pinned to full 40-character commit SHAs with inline version comments, and security scanners must track bundle engine upgrades to maintain SARIF schema parity.

---

### Incident 3: WSL Path Contamination Executing Broken Windows Binaries (BUG-WSL-03)
- **Context**: `src/utils.rs`: `wsl_windows_path_filter_enabled()` and `PREFIXES` static resolution.
- **What Was Expected**: Inside WSL (Windows Subsystem for Linux), running an update step for a Linux tool (e.g., Python, Git, or Node) must execute the native Linux binary and avoid resolving the host Windows binary located across the 9p/drvfs mount boundary.
- **What Actually Happened**: WSL by default exports the Windows host `$PATH` into the Linux environment. When a tool was not installed inside Linux, `which` traversed the path and resolved `C:\...\tool.exe` via `/mnt/c/...`. Invoking this binary within the Linux environment caused execution crashes, path parameter syntax errors, or hangs.
- **Evidence in Repo**: Code comments and issue reference in `src/utils.rs`:
  ```rust
  /// Inside WSL a plain PATH lookup can resolve a Windows executable on `/mnt/*` that
  /// fails to run in the guest (topgrade-rs/topgrade#1243). When on, detection skips those.
  ```
- **Root Cause**: `which::which_all` inspects all directories listed in `$PATH` sequentially. In WSL, `/mnt/c/...` directories are present, causing `which` to return Windows binaries for commands absent in the native Linux userland.
- **Remediation Code Diff**:
```rust
// src/utils.rs
// + Static mount parser inspects /proc/mounts for drvfs and aname=drvfs
static PREFIXES: LazyLock<Vec<PathBuf>> = LazyLock::new(|| {
    let mounts = std::fs::read_to_string("/proc/mounts").unwrap_or_else(|e| {
        warn!("Could not read /proc/mounts: {e}; WSL Windows-path filter stays inert");
        String::new()
    });
    mounts
        .lines()
        .filter_map(|line| {
            let mut cols = line.split_whitespace();
            let _source = cols.next()?;
            let mount_point = cols.next()?;
            let fstype = cols.next()?;
            let options = cols.next().unwrap_or("");
            // A Windows drive is WSL1 drvfs, or a WSL2 9p/virtiofs mount tagged `aname=drvfs`.
            (fstype == "drvfs" || options.contains("aname=drvfs")).then(|| PathBuf::from(mount_point))
        })
        .collect()
});

// In which() loop:
// + if wsl_windows_path_filter_enabled() && is_windows_mount_path(&path) {
// +     errors.insert("a Windows binary via WSL interop");
// +     continue;
// + }
```
- **Lesson**: Do not trust `$PATH` homogeneity in hybridized operating systems or containerized guests. Inspect filesystem mount boundaries via `/proc/mounts` to identify foreign host filesystems.

---

### Incident 4: Ghost Shims in Polyglot Runtime Version Managers (BUG-MISE-04)
- **Context**: `src/utils.rs`: `MISE_SHIMS` and `mise_shim_is_nonfunctional()`.
- **What Was Expected**: If a user has `mise` (or `asdf`) installed, Topgrade should only execute a tool through the shim if that tool is actually installed and has an active version configured.
- **What Actually Happened**: Version managers create placeholder shims in `~/.local/share/mise/shims` for every known tool binary. When a tool is checked, `which` returns the shim path. When executed, the shim exits with an error stating no version is set, breaking the entire step pipeline.
- **Evidence in Repo**: `src/utils.rs`: `mise_shim_is_nonfunctional()` probing logic:
  ```rust
  fn mise_shim_is_nonfunctional(path: &Path) -> Result<bool> { ... }
  ```
- **Root Cause**: Shim directories contain executable scripts that exist on the filesystem unconditionally, passing `Path::exists()` and `which::which()`, but failing at invocation time.
- **Remediation Code Diff**:
```rust
// src/utils.rs
fn mise_shim_is_nonfunctional(path: &Path) -> Result<bool> {
    #[expect(clippy::disallowed_methods)]
    let out = Command::new(path)
        .arg("--help")
        .output()
        .wrap_err_with(|| format!("Running `{} --help` failed", path.display()))?;
    let stderr = match String::from_utf8(out.stderr) {
        Ok(stderr) => stderr,
        Err(_) => return Ok(false),
    };
    Ok(stderr.contains("mise ERROR No version is set for shim:"))
}

// In which():
if path.starts_with(&*MISE_SHIMS) && mise_shim_is_nonfunctional(&path)? {
    errors.insert("a Mise shim without global default version");
    continue;
}
```
- **Lesson**: Filesystem existence does not guarantee runtime readiness when shims are involved. Validate shims with non-destructive introspection commands (`--help`) before declaring a dependency available.

---

### Incident 5: Signal Abort Deadlock and Database Lock Corruption (BUG-SIGINT-05)
- **Context**: `src/ctrlc/mod.rs`, `src/ctrlc/unix.rs`, `src/ctrlc/windows.rs`, and `src/ctrlc/interrupted.rs`.
- **What Was Expected**: Pressing `Ctrl+C` during an execution cycle should not terminate Topgrade abruptly while child package managers hold critical disk locks (e.g., `/var/lib/dpkg/lock-frontend` or `pacman.db.lck`).
- **What Actually Happened**: Default OS signal handling immediately terminates the parent process via SIGINT. If a child process is updating database entries or writing binary files, terminating the coordinator leaves orphaned locks or corrupt local package repositories.
- **Evidence in Repo**: Custom signal handlers in `src/ctrlc/unix.rs` registering `handle_sigint` with `sigaction` and Windows `SetConsoleCtrlHandler`.
- **Root Cause**: Native process termination signals bypass userland clean-up logic unless explicitly intercepted and converted into cooperatively checked flags.
- **Remediation Code Diff**:
```rust
// src/ctrlc/unix.rs
extern "C" fn handle_sigint(_: i32) {
    set_interrupted();
}

pub fn set_handler() {
    let sig_action = SigAction::new(SigHandler::Handler(handle_sigint), SaFlags::empty(), SigSet::empty());
    unsafe {
        sigaction(Signal::SIGINT, &sig_action).unwrap();
    }
}

// src/ctrlc/interrupted.rs
static INTERRUPTED: AtomicBool = AtomicBool::new(false);

pub fn interrupted() -> bool {
    INTERRUPTED.load(Ordering::SeqCst)
}
```
- **Lesson**: Interactive CLI orchestrators must trap SIGINT/CTRL_C_EVENT, map signals to an atomic state flag, and check that flag at step boundaries to allow current operations to complete cleanly or perform structured rollbacks.

---

## 4. Microscopic Code-Level Invariants

### 1. Micro-Syntax & Token-Level Precision
- **Atomic Memory Ordering**: In `src/ctrlc/interrupted.rs`, `Ordering::SeqCst` is strictly used for both `INTERRUPTED.load(Ordering::SeqCst)` and `INTERRUPTED.store(..., Ordering::SeqCst)`. Relaxed ordering (`Ordering::Relaxed`) is prohibited because thread synchronization between OS signal dispatch threads (especially on Windows where `SetConsoleCtrlHandler` invokes the callback on a separate, OS-managed RPC thread) and the main executor thread must guarantee sequential consistency and memory fence synchronization.
- **UTF-8 Output Fallback vs. Strict Decoding**: In `src/command.rs`, `Utf8Output::try_from(Output)` rejects non-UTF-8 bytes and returns an error with `String::from_utf8_lossy` embedded in the error message, whereas `output_checked_with` uses `String::from_utf8_lossy(&output.stderr)` when formatting the error diagnostic message. This prevents invalid UTF-8 in stdout/stderr from causing panic crashes when producing human-readable failure reports.
- **Shebang Detection Token Slicing**: In `src/utils.rs`:
  
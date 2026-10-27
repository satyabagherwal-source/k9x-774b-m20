> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/frankbria-ralph-claude-code-learnings.md`  
> **Source**: github ([https://github.com/frankbria/ralph-claude-code](https://github.com/frankbria/ralph-claude-code))  
> **Source Version**: `a4ea748f`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T13:57:47.465Z  
> **Learning ID**: `learn-github-frankbria-ralph-claude-code`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): frankbria/ralph-claude-code

> **Canonical Artifact**: `07_PROJECT_LEARNING/frankbria-ralph-claude-code-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/frankbria/ralph-claude-code](https://github.com/frankbria/ralph-claude-code))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T13:57:46.186Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `frankbria/ralph-claude-code`
- **Description**: Autonomous AI development loop for Claude Code with intelligent exit detection
- **Primary Language / Ecosystem**: Shell
- **Discovered Manifests / Configurations**: package.json, README.md, Dockerfile
- **Stars / Engagement**: 9716 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `lib/e2b_helper.py`
```
#!/usr/bin/env python3
"""E2B transport helper for Ralph (Issue #75).

Thin CLI over the official E2B Python SDK so lib/sandbox_e2b.sh can drive
cloud sandboxes from bash. Every subcommand prints a single JSON object on
stdout (machine-parseable with jq), except:

  exec      streams the remote command's stdout/stderr to the local
            stdout/stderr and exits with the remote exit code
  download  writes a gzipped tar of files changed since the last sync
            marker to stdout (possibly an empty archive)

Secrets never travel via argv: E2B_API_KEY and ANTHROPIC_API_KEY are read
from the environment, and file content (credential seeding, project upload)
arrives via stdin.

Exit codes: 0 ok, 1 operation failed, 2 usage error (argparse),
3 SDK not installed, 4 E2B_API_KEY missing.
"""

import argparse
import json
import os
import shlex
import sys

try:
    from e2b import CommandExitException, Sandbox
    _SDK_IMPORT_ERROR = None
except ImportError as exc:  # pragma: no cover - depends on environment
    Sandbox = None
    CommandExitException = ()
    _SDK_IMPORT_ERROR = str(exc)

UPLOAD_STAGING = "/tmp/ralph_upload.tgz"
DOWNLOAD_STAGING = "/tmp/ralph_download.tgz"
CHANGED_LIST = "/tmp/ralph_changed.list"
# Archive member carrying the sandbox's CURRENT file list, so the host can
# propagate sandbox-side deletions/renames (stale-file divergence otherwise)
MANIFEST_NAME = ".ralph_e2b_manifest"
MANIFEST_STAGING = os.path.join("/tmp", MANIFEST_NAME)


def _emit(obj):
    print(json.dumps(obj))


def _die(message, code=1):
    _emit({"ok": False, "error": message})
    sys.exit(code)


def _require_sdk():
    if Sandbox is None:
        _die("E2B SDK not installed (pip install e2b): %s" % _SDK_IMPORT_ERROR, 3)
    if not os.environ.get("E2B_API_KEY"):
        _die("E2B_API_KEY is not set in the environment", 4)


def _connect(sandbox_id):
    try:
        return Sandbox.connect(sandbox_id)
    except Exception as exc:
        _die("failed to connect to sandbox %s: %s" % (sandbox_id, exc))


def _sync_marker(workdir):
    # The marker lives NEXT TO the workspace (not inside it) so it is never
    # swept into uploads/downloads of workspace content.
    return os.path.join(os.path.dirname(workdir.rstrip("/")), ".ralph_sync_marker")


def cmd_check(_args):
    if Sandbox is None:
        _emit({"ok": False, "error": "E2B SDK not installed (pip install e2b): %s" % _SDK_IMPORT_ERROR})
        sys.exit(3)
    version = "unknown"
    try:
        from importlib.metadata import version as _pkg_version
        version = _pkg_version("e2b")
    except Exception as exc:
        print("e2b check: could not determine SDK version: %s" % exc, file=sys.stderr)
    _emit({"ok": True, "sdk_version": version})


def cmd_create(args):
    _require_sdk()
    kwargs = {"timeout": args.timeout}
    # Claude auth travels as a sandbox env var, never on a command line
    if os.environ.get("ANTHROPIC_API_KEY"):
        kwargs["envs"] = {"ANTHROPIC_API_KEY": os.environ["ANTHROPIC_API_KEY"]}
    try:
        if args.template:
            sandbox = Sandbox.create(args.template, **kwargs)
        else:
            sandbox = Sandbox.create(**kwargs)
    except Exception as exc:
        _die("failed to create sandbox (template: %s): %s" % (args.template or "default", exc))
    _emit({"ok": True, "sandbox_id": sandbox.sandbox_id})


def cmd_connect(args):
    _require_sdk()
    sandbox = _connect(args.sandbox_id)
    _emit({"ok": True, "sandbox_id": sandbox.sandbox_id})


def cmd_info(args):
    _require_sdk()
    sandbox = _connect(args.sandbox_id)
    try:
        info = sandbox.get_info()
        state = str(getattr(info, "state", "running")).rsplit(".", 1)[-1].lower()
    except Exception as exc:
        # connect() above succeeded, so the sandbox is reachable — degrade to
        # "running" rather than failing: a hard failure here would make the
        # caller recreate + re-upload a perfectly live sandbox every iteration.
        print("e2b info: get_info failed, assuming running: %s" % exc, file=sys.stderr)
        state = "running"
    _emit({"ok": True, "sandbox_id": args.sandbox_id, "state": state})


def cmd_exec(args):
    _require_sdk()
    command = list(args.command)
    if command and command[0] == "--":
        command = command[1:]
    if not command:
        _die("exec: no command given (use: exec --sandbox-id ID -- cmd args...)", 2)
    sandbox = _connect(args.sandbox_id)

    def _out(data):
        sys.stdout.write(data)
        sys.stdout.flush()

    def _err(data):
        sys.stderr.write(data)
        sys.stderr.flush()

    try:
        # timeout=0 disables the SDK-side limit; Ralph's host-side
        # portable_timeout governs the iteration budget (exit 124).
        result = sandbox.commands.run(
            shlex.join(command),
            cwd=args.cwd,
            timeout=0,
            on_stdout=_out,
            on_stderr=_err,
        )
    except CommandExitException as exc:
        # None-check, not `or`: a hypothetical exit_code=0 must not become 1
        code = getattr(exc, "exit_code", None)
        sys.exit(code if code is not None else 1)
    except Exception as exc:
        # NOT _die(): exec's stdout carries the streamed remote output (it
        # becomes Ralph's claude output file), so errors must stay on stderr.
        print("e2b exec failed: %s" % exc, file=sys.stderr)
        sys.exit(1)
    code = getattr(result, "exit_code", None)
    sys.exit(code if code is not None else 0)


def cmd_upload(args):
    _require_sdk()
    data = sys.stdin.buffer.read()
    if not data:
        _die("upload: no tar data on stdin")
    sandbox = _connect(args.sandbox_id)
    marker = _sync_marker(args.dest)
    try:
        sandbox.files.write(UPLOAD_STAGING, data)
        sandbox.commands.run(
            "mkdir -p {dest} && tar -xzf {staging} -C {dest} && rm -f {staging} && touch {marker}".format(
                dest=shlex.quote(args.dest),
                staging=shlex.quote(UPLOAD_STAGING),
                marker=shlex.quote(marker),
            )
        )
    except Exception as exc:
        _die("upload failed: %s" % exc)
    _emit({"ok": True, "bytes": len(data)})


def cmd_download(args):
    _require_sdk()
    sandbox = _connect(args.sandbox_id)
    marker = _sync_marker(args.src)
    # Besides the changed files, every download carries a manifest of ALL
    # current workspace files (minus .git) so the host can delete files that
    # disappeared in the sandbox. The sandbox is always Linux/GNU.
    # The sync marker is NOT advanced here: the host calls ack-download after
    # it has successfully extracted the archive, so a failure anywhere in
    # between leaves the changes re-downloadable (at-least-once delivery;
    # re-extraction is an idempotent overwrite).
    script = (
        "cd {src} && "
        "if [ -f {marker} ]; then find . -type f -newer {marker} -print0; else : ; fi > {changed} && "
        "find . -type f ! -path './.git/*' > {manifest_staging} && "
        "tar -czf {staging} --null -T {changed} -C {manifest_dir} {manifest}"
    ).format(
        src=shlex.quote(args.src),
        marker=shlex.quote(marker),
        changed=shlex.quote(CHANGED_LIST),
        staging=shlex.quote(DOWNLOAD_STAGING),
        manifest_staging=shlex.quote(MANIFEST_STAGING),
        manifest_dir=shlex.quote(os.path.dirname(MANIFEST_STAGING)),
        manifest=shlex.quote(MANIFEST_NAME),
    )
    try:
        sandbox.commands.run(script)
        data = sandbox.files.read(DOWNLOAD_STAGING, format="bytes")
    except Exception as exc:
        # NOT _die(): download's stdout carries raw tar bytes; JSON on stdout
        # would corrupt the archive. Errors must stay on stderr.
        print("e2b download failed: %s" % exc, file=sys.stderr)
        sys.exit(1)
    sys.stdout.buffer.write(bytes(data))
    sys.stdout.buffer.flush()


def cmd_ack_download(args):
    _require_sdk()
    sandbox = _connect(args.sandbox_id)
    marker = _sync_marker(args.src)
    try:
        sandbox.commands.run("touch %s && rm -f %s %s %s" % (
            shlex.quote(marker), shlex.quote(DOWNLOAD_STAGING),
            shlex.quote(CHANGED_LIST), shlex.quote(MANIFEST_STAGING)))
    except Exception as exc:
        _die("ack-download failed: %s" % exc)
    _emit({"ok": True})


def cmd_write_file(args):
    _require_sdk()
    data = sys.stdin.buffer.read()
    sandbox = _connect(args.sandbox_id)
    try:
        parent = os.path.dirname(args.path)
        if parent:
            sandbox.commands.run("mkdir -p %s" % shlex.quote(parent))
        sandbox.files.write(args.path, data)
        if args.mode:
            sandbox.commands.run("chmod %s %s" % (shlex.quote(args.mode), shlex.quote(args.path)))
    except Exception as exc:
        _die("write-file failed for %s: %s" % (args.path, exc))
    _emit({"ok": True, "path": args.path})


def cmd_kill(args):
    _require_sdk()
    try:
        sandbox = Sandbox.connect(args.sandbox_id)
        sandbox.kill()
    except Exception as exc:
        # Only an already-dead/expired sandbox counts as killed (idempotent).
        # Auth/network/API failures must propagate — reporting them as
        # success would leave a sandbox running (and billing) silently.
        name = type(exc).__name__
        if "NotFound" in name or "404" in str(exc):
            _emit({"ok": True, "note": "sandbox already gone"})
            return
        _die("kill failed for %s: %s" % (args.sandbox_id, exc))
    _emit({"ok": True})


def build_parser():
    parser = argparse.ArgumentParser(prog="e2b_helper", description=__doc__)
    sub = parser.add_subparsers(dest="subcommand", required=True)

    sub.add_parser("check").set_defaults(func=cmd_check)

    p = sub.add_parser("create")
    p.add_argument("--template", default="")
    p.add_argument("--timeout", type=int, default=3600)
    p.set_defaults(func=cmd_create)

    p = sub.add_parser("connect")
    p.add_argument("--sandbox-id", required=True)
 
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #383** (2026-10-10): **[P2.7] E2B sandbox: handle RALPH_DIR at the workspace root or outside the workspace**
  *Symptoms*: Spun off from PR #381 (issue #376) during post-merge disposition.  ## Context `_e2b_control_dir` (`lib/sandbox_e2b.sh`) now maps every in-workspace spelling of `RALPH_DIR` to the workspace-relative form the E2B archive members use. Two shapes are still not handled. Both were listed under the PR's Known Limitations and confirmed by the GLM review on #381.  1. **RALPH_DIR is the workspace root** (`.`, `a/..` or `$PWD`). `.` and `a/..` derive to an empty string, and git accepts `:(exclude)`, so the generic E2B upload comes back empty with no error; the log still reports "Uploading N file(s)". `$PWD` stays absolute, so the exclude is skipped and the state files are uploaded. In both cases the download and deletion guards cannot tell control state from project files. 2. **RALPH_DIR outside the workspace** (absolute or `../x`). The upload allowlist adds `$rb/PROMPT.md` etc. with that path as the tar member name. tar strips the leading `/` (or keeps `../`), so the control files land in the sandbox at a wrong or rejected path, and the synced-files baseline records them under that path.  ## Why it was not done in that PR Both behaved the same with the old basename derivation, and the right fix is a policy decision: reject these shapes at startup, or map the control files to a fixed in-sandbox location.  ## Definition of done - [ ] `ralph --sandbox e2b` with a workspace-root `RALPH_DIR` fails fast with a clear message instead of uploading an empty or state-leaking workspace - [ ] An ou

- **Issue #378** (2026-10-09): **[P2.6] --monitor drops env-only settings when a tmux server is already running**
  *Symptoms*: ## Problem  `ralph --monitor` starts the loop with `tmux send-keys` into a new session. When a tmux server is already running, panes get the server's global environment, not the environment of the shell that ran `ralph --monitor`. `setup_tmux_session()` (`ralph_loop.sh`) forwards only `RALPH_DIR` (Issue #352) and settings that have a CLI flag (`--calls`, `--timeout`, `--sandbox-*`, …) to the pane command.  Every env-only setting therefore never reaches the loop in `--monitor` mode when tmux is already running. For those keys the documented "environment beats `.ralphrc`" precedence doesn't hold:  - `CB_NO_PROGRESS_THRESHOLD`, `CB_SAME_ERROR_THRESHOLD`, `CB_OUTPUT_DECLINE_THRESHOLD`, `CB_PERMISSION_DENIAL_THRESHOLD`, `CB_COOLDOWN_MINUTES` - `MAX_CONSECUTIVE_TEST_LOOPS`, `MAX_CONSECUTIVE_DONE_SIGNALS`, `TEST_PERCENTAGE_THRESHOLD`, `CLAUDE_MIN_VERSION` - `MAX_TOKENS_PER_HOUR`, `CLAUDE_MODEL`, `CLAUDE_EFFORT`, `CLAUDE_CODE_CMD`, `CLAUDE_AUTO_UPDATE`, `RALPH_SHELL_INIT_FILE`, `OPTIONAL_SECTIONS`, and any other `_env_*`-snapshotted key without a CLI flag  Example: `CB_NO_PROGRESS_THRESHOLD=10 ralph --monitor` with an already-running tmux server. The loop in the pane uses `.ralphrc`'s value, or the default.  Found while fixing #369 (PR for that issue fixes non-monitor precedence; this gap is pre-existing and affects every env-only key, so it was kept out of that PR).  ## Fix  Forward the user's explicit environment values onto the pane command the same way `RALPH_DIR` is: for each no

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

### Incident Patch 1: `eefcc3a8` (2026-10-07)
**Commit Message**: fix(security): never evaluate untrusted numbers in bash arithmetic (#371) (#373)

## Summary
- Bash arithmetic evaluates `a[$(cmd)]`. The "ensure integer" idiom `$((x + 0))` and bare `[[ $x -ge n ]]` were applied to repo-committable `.ralph/` state (`.circuit_breaker_state`, `.call_count`/`.token_count`, `.e2b_sandbox_state`) and to fields from Claude's output. The committed circuit-breaker state executed code on every loop.
- New `lib/int_utils.sh` `to_int`: validates `^[0-9]{1,18}$`, base 10, else 0, and never evaluates its input. Every untrusted numeric read is routed through it, including values written back into JSON, fractional `jq length` results (which crashed the script) and the `.exit_signals` lengths.

## Validation
- Tests: 1055 unit + 281 integration + 23 e2e pass locally, and CI is green.
- Test mutation check: every new test (4 e2e/unit attack vectors, fractional lengths, exit signals) failed before its fix.
- Lint: shellcheck warnings below main (ralph_loop 28→26, response_analyzer 50→45).
- Internal review: reviewing-code (1 critical E2B sink, 2 more findings), all fixed.
- Cross-family review: codex (opencode/GLM stalled, disclosed): no regression. GLM bot: no def

**File**: `CLAUDE.md` (modified, +1/-0)
```diff
@@ -39,6 +39,7 @@ Ralph for Claude Code — an autonomous AI development loop system enabling cont
 - **issue_analyzer.sh** — `assess_issue_completeness()`: deterministic 0–100 heuristic scoring of issue PRDs (acceptance criteria +25, checklists/code blocks/sections/keywords/length +15 each); JSON output with `confidence_score`, `completeness_level`, `missing_elements`, `recommendation`; `log_issue_analysis()` for summaries
 - **file_protection.sh** — `validate_ralph_integrity()` checks `RALPH_REQUIRED_PATHS` exist; runs every loop iteration; `get_integrity_report()` for recovery instructions
 - **ralphrc.sh** — safe `.ralphrc` reader (Issue #346): `ralphrc_parse_line` (KEY=VALUE grammar, literal values per bash quoting, rejects anything bash would expand/execute; rc 0/1/2/3), `ralphrc_value_allowed` (command-bearing keys accept only stock values), `ralphrc_get FILE KEY`. Used by ralph_loop.sh, ralph_import.sh and tools/inspect-allowed-tools.sh
+- **int_utils.sh** — `to_int VALUE` (Issue #371): the only safe way to use an untrusted value as a number — base-10 int if `^[0-9]{1,18}$` (surrounding whitespace ignored), else 0, never evaluated. Bash arithmetic (`$((x + 0))`, `[[ $x -ge n ]]`, `((x++))`) evaluates `a[$(cmd)]`, so every number read from `.ralph/` state files (repository-committable: `.call_count`, `.token_count`, `.circuit_breaker_state`, `.e2b_sandbox_state`) or parsed from Claude's output (`files_modified`, `error_count`, `confidence`, and `jq length` results, which can be fractional and would crash bash arithmetic) goes through it. Sourced (with the FATAL guard) by ralph_loop.sh, and by circuit_breaker.sh, response_analyzer.sh and sandbox_e2b.sh
 - **log_utils.sh** — `rotate_logs()` rotates `$LOG_DIR/ralph.log` at 10MB, keeping 4 archives (`.log.1`–`.log.4`); GNU `stat -c%s` with BSD `stat -f%z` fallback
 - **github_lifecycle.sh** — GitHub issue lifecycle management backing `ralph --github-issue` (Issue #73). `parse_issue_reference` (N | #N | owner/repo#N | URL → number+repo); gh wrappers `gh_issue_comment`/`gh_close_issue`/`gh_add_labels`/`gh_create_pr`/`gh_create_issue` (each logs + returns non-zero on failure, never exits); state primitives `init_github_lifecycle`/`lifecycle_get`/`_lifecycle_apply` (atomic temp+`mv` at `.ralph/.github_lifecycle_state`, program-first signature like `_queue_apply`); generators `generate_progress_comment`/`generate_completion_summary`/`scan_for_todos`; orchestration `lifecycle_post_progress <loop>` (interval-gated) and `lifecycle_on_completion` (summary → PR → followups → close, each flag-guarded, always returns 0). Reuses `lib/date_utils.sh` timestamps
 - **sandbox_docker.sh** — Docker sandbox execution backing `ralph --sandbox docker` (Issue #74). Containerizes only the Claude CLI execution: one persistent container per run (`docker run -d … sleep infinity`, project bind-mounted rw at `/workspace`), each iteration wrapped as `docker exec -i -w /workspace <cid> claude …` via `build_sandbox_exec_args`/`wrap_claude_command_for_sandbox` (works in live and background modes); ralph orchestration, analysis, and status.json stay host-side so ralph-monitor is unaffected. `validate_sandbox_config` (image/memory/cpus/network), `init_docker_sandbox` (daemon + image checks with build/pull guidance), `setup_docker_credentials` (ANTHROPIC_API_KEY → 0600 env-file via `--env-file`, else host `~/.claude/.credentials.json` copied into a container-scoped home — never `docker secret`, which needs Swarm), `handle_sandbox_timeout` (exit 124 kills only the docker-exec client → `docker restart` reaps orphans), idempotent `cleanup_docker_sandbox` on all exit paths. State: `.ralph/.docker_sandbox_state` (atomic temp+`mv`). Setup failure is fatal — never falls back to host execution. Config: `SANDBOX_PROVIDER`, `SANDBOX_DOCKER_IMAGE/MEMORY/CPUS/NETWORK` (env > CLI > .ralphrc); sandbox `_env_*` capture sits BEFORE the lib source block in ralph_loop.sh because the lib sets defaults at source time. Default image from GHCR (`docker pull ghcr.io/frankbria/ralph-sandbox:latest`, published on `v*` tags by `.github/workflows/docker-publish.yml` — multi-arch amd64+arm64, smoke-tested before push, dry-run via workflow_dispatch `push=false`; guards in `tests/unit/test_workflow_docker_publish.bats`, Issue #298) or built locally from the repo `Dockerfile` (`docker build -t ralph-sandbox .`; install.sh copies it to `~/.ralph`). `get_sandbox_status` is the provider router for status.json (docker impl renamed `get_docker_sandbox_status`; routes to `get_e2b_sandbox_status` when `SANDBOX_PROVIDER=e2b`)
```

**File**: `lib/circuit_breaker.sh` (modified, +12/-10)
```diff
@@ -5,6 +5,7 @@
 
 # Source date utilities for cross-platform compatibility
 source "$(dirname "${BASH_SOURCE[0]}")/date_utils.sh"
+source "$(dirname "${BASH_SOURCE[0]}")/int_utils.sh"
 
 # Circuit Breaker States
 CB_STATE_CLOSED="CLOSED"        # Normal operation, progress detected
@@ -78,8 +79,8 @@ EOF
         if [[ "$CB_AUTO_RESET" == "true" ]]; then
             # Auto-reset: bypass cooldown, go straight to CLOSED
             local current_loop total_opens
-            current_loop=$(jq -r '.current_loop // 0' "$CB_STATE_FILE" 2>/dev/null || echo "0")
-            total_opens=$(jq -r '.total_opens // 0' "$CB_STATE_FILE" 2>/dev/null || echo "0")
+            current_loop=$(to_int "$(jq -r '.current_loop // 0' "$CB_STATE_FILE" 2>/dev/null)")
+            total_opens=$(to_int "$(jq -r '.total_opens // 0' "$CB_STATE_FILE" 2>/dev/null)")
             log_circuit_transition "$CB_STATE_OPEN" "$CB_STATE_CLOSED" "Auto-reset on startup (CB_AUTO_RESET=true)" "$current_loop"
 
             cat > "$CB_STATE_FILE" << EOF
@@ -107,7 +108,7 @@ EOF
 
                 if [[ $elapsed_minutes -ge 0 && $elapsed_minutes -ge $CB_COOLDOWN_MINUTES ]]; then
                     local current_loop
-                    current_loop=$(jq -r '.current_loop // 0' "$CB_STATE_FILE" 2>/dev/null || echo "0")
+                    current_loop=$(to_int "$(jq -r '.current_loop // 0' "$CB_STATE_FILE" 2>/dev/null)")
                     log_circuit_transition "$CB_STATE_OPEN" "$CB_STATE_HALF_OPEN" "Cooldown elapsed (${elapsed_minutes}m >= ${CB_COOLDOWN_MINUTES}m)" "$current_loop"
 
                     # Preserve counters but transition state
@@ -163,11 +164,12 @@ record_loop_result() {
     local consecutive_permission_denials=$(echo "$state_data" | jq -r '.consecutive_permission_denials // 0' | tr -d '[:space:]')
     local last_progress_loop=$(echo "$state_data" | jq -r '.last_progress_loop' | tr -d '[:space:]')
 
-    # Ensure integers
-    consecutive_no_progress=$((consecutive_no_progress + 0))
-    consecutive_same_error=$((consecutive_same_error + 0))
-    consecutive_permission_denials=$((consecutive_permission_denials + 0))
-    last_progress_loop=$((last_progress_loop + 0))
+    # Ensure integers without evaluating them: the state file is repository-
+    # committable, and $((x + 0)) would run a[$(cmd)] (Issue #371)
+    consecutive_no_progress=$(to_int "$consecutive_no_progress")
+    consecutive_same_error=$(to_int "$consecutive_same_error")
+    consecutive_permission_denials=$(to_int "$consecutive_permission_denials")
+    last_progress_loop=$(to_int "$last_progress_loop")
 
     # Detect progress from multiple sources:
     # 1. Files changed (git diff)
@@ -192,7 +194,7 @@ record_loop_result() {
 
         # Check if Claude reported files modified (may differ from git diff if already committed)
         ralph_files_modified=$(jq -r '.analysis.files_modified // 0' "$response_analysis_file" 2>/dev/null || echo "0")
-        ralph_files_modified=$((ralph_files_modified + 0))
+        ralph_files_modified=$(to_int "$ralph_files_modified")
     fi
 
     # Track permission denials (Issue #101)
@@ -292,7 +294,7 @@ record_loop_result() {
 
     # Update state file
     local total_opens=$(echo "$state_data" | jq -r '.total_opens' | tr -d '[:space:]')
-    total_opens=$((total_opens + 0))
+    total_opens=$(to_int "$total_opens")
     if [[ "$new_state" == "$CB_STATE_OPEN" && "$current_state" != "$CB_STATE_OPEN" ]]; then
         total_opens=$((total_opens + 1))
     fi
```

**File**: `lib/int_utils.sh` (added, +20/-0)
```diff
@@ -0,0 +1,20 @@
+#!/usr/bin/env bash
+# lib/int_utils.sh - Safe integer coercion for untrusted values (Issue #371)
+#
+# Bash arithmetic evaluates its operands as expressions, so a[$(cmd)] read from
+# a .ralph/ state file (which a repository can commit) or parsed from Claude's
+# output runs cmd at `$((x + 0))` or `[[ $x -ge n ]]`. Every such value goes
+# through to_int before it is used as a number.
+
+# to_int VALUE - VALUE as a base-10 integer when it is one (surrounding
+# whitespace ignored, at most 18 digits), otherwise 0. Never evaluates VALUE.
+to_int() {
+    local v="$1"
+    v="${v#"${v%%[![:space:]]*}"}"
+    v="${v%"${v##*[![:space:]]}"}"
+    if [[ "$v" =~ ^[0-9]{1,18}$ ]]; then
+        printf '%s' "$((10#$v))"
+    else
+        printf '0'
+    fi
+}
```

**File**: `lib/response_analyzer.sh` (modified, +16/-10)
```diff
@@ -4,6 +4,7 @@
 
 # Source date utilities for cross-platform compatibility
 source "$(dirname "${BASH_SOURCE[0]}")/date_utils.sh"
+source "$(dirname "${BASH_SOURCE[0]}")/int_utils.sh"
 
 # Response Analysis Functions
 # Based on expert recommendations from Martin Fowler, Michael Nygard, Sam Newman
@@ -322,7 +323,8 @@ parse_json_response() {
     # we set error_count=1 as a minimum. This is defensive programming since
     # the stuck detection threshold is >5 errors, so 1 error won't trigger it.
     # Actual error count may be higher, but precise count isn't critical for our logic.
-    local error_count=$(jq -r '.error_count // 0' "$output_file" 2>/dev/null)
+    local error_count
+    error_count=$(to_int "$(jq -r '.error_count // 0' "$output_file" 2>/dev/null)")  # Claude output (#371)
     local has_errors=$(jq -r '.metadata.has_errors // false' "$output_file" 2>/dev/null)
     if [[ "$has_errors" == "true" && "$error_count" == "0" ]]; then
         error_count=1  # At least one error if has_errors is true
@@ -338,15 +340,16 @@ parse_json_response() {
     local loop_number=$(jq -r '.metadata.loop_number // .loop_number // 0' "$output_file" 2>/dev/null)
 
     # Confidence: from flat format
-    local confidence=$(jq -r '.confidence // 0' "$output_file" 2>/dev/null)
+    local confidence
+    confidence=$(to_int "$(jq -r '.confidence // 0' "$output_file" 2>/dev/null)")
 
     # Progress indicators: from Claude CLI metadata (optional)
     local progress_count=$(jq -r '.metadata.progress_indicators | if . then length else 0 end' "$output_file" 2>/dev/null)
 
     # Permission denials: from Claude Code output (Issue #101)
     # When Claude Code is denied permission to run commands, it outputs a permission_denials array
     local permission_denial_count=$(jq -r '.permission_denials | if . then length else 0 end' "$output_file" 2>/dev/null)
-    permission_denial_count=$((permission_denial_count + 0))  # Ensure integer
+    permission_denial_count=$(to_int "$permission_denial_count")  # jq length of a number can be fractional
 
     local has_permission_denials="false"
     if [[ $permission_denial_count -gt 0 ]]; then
@@ -374,7 +377,7 @@ parse_json_response() {
         # Count Bash denials. Anything else (e.g., AskUserQuestion) is a real gap.
         local bash_denial_count
         bash_denial_count=$(jq -r '[.permission_denials[] | select(.tool_name == "Bash")] | length' "$output_file" 2>/dev/null || echo "0")
-        bash_denial_count=$((bash_denial_count + 0))
+        bash_denial_count=$(to_int "$bash_denial_count")
 
         if [[ $bash_denial_count -gt 0 && $bash_denial_count -eq $permission_denial_count ]]; then
             # All denials are Bash — check coverage of each base command
@@ -425,10 +428,10 @@ parse_json_response() {
     fi
 
     # Ensure files_modified is integer
-    files_modified=$((files_modified + 0))
+    files_modified=$(to_int "$files_modified")  # from Claude's output: never evaluate (#371)
 
     # Ensure progress_count is integer
-    progress_count=$((progress_count + 0))
+    progress_count=$(to_int "$progress_count")
 
     # Calculate has_completion_signal
     local has_completion_signal="false"
@@ -531,17 +534,20 @@ analyze_response() {
             is_test_only=$(jq -r '.is_test_only' $RALPH_DIR/.json_parse_result 2>/dev/null || echo "false")
             is_stuck=$(jq -r '.is_stuck' $RALPH_DIR/.json_parse_result 2>/dev/null || echo "false")
             work_summary=$(jq -r '.summary' $RALPH_DIR/.json_parse_result 2>/dev/null || echo "")
-            files_modified=$(jq -r '.files_modified' $RALPH_DIR/.json_parse_result 2>/dev/null || echo "0")
-            local json_confidence=$(jq -r '.confidence' $RALPH_DIR/.json_parse_result 2>/dev/null || echo "0")
+            files_modified=$(to_int "$(jq -r '.files_modified' $RALPH_DIR/.json_parse_result 2>/dev/null)")
+            local json_confidence
+            json_confidence=$(to_int "$(jq -r '.confidence' $RALPH_DIR/.json_parse_result 2>/dev/null)")
             local session_id=$(jq -r '.session_id' $RALPH_DIR/.json_parse_result 2>/dev/null || echo "")
 
             # Extract permission denial fields (Issue #101)
             local has_permission_denials=$(jq -r '.has_permission_denials' $RALPH_DIR/.json_parse_result 2>/dev/null || echo "false")
-            local permission_denial_count=$(jq -r '.permission_denial_count' $RALPH_DIR/.json_parse_result 2>/dev/null || echo "0")
+            local permission_denial_count
+            permission_denial_count=$(to_int "$(jq -r '.permission_denial_count' $RALPH_DIR/.json_parse_result 2>/dev/null)")
             local denied_commands_json=$(jq -r '.denied_commands' $RALPH_DIR/.json_parse_result 2>/dev/null || echo "[]")
             # Compound-command limitation flag (Issue #243)
             local has_compound_command_limitation=$(jq -r '.has_compound_command_limitation // false' $RALPH_DIR/.json_parse_result 2>/dev/null || echo "false")
-            local com
```

**File**: `lib/sandbox_e2b.sh` (modified, +4/-3)
```diff
@@ -31,6 +31,7 @@
 
 # Source date utilities for cross-platform timestamps
 source "$(dirname "${BASH_SOURCE[0]}")/date_utils.sh"
+source "$(dirname "${BASH_SOURCE[0]}")/int_utils.sh"
 # Sync filter layer: include/exclude/.ralphignore patterns + large-file
 # policy applied to upload and download (Issue #76)
 source "$(dirname "${BASH_SOURCE[0]}")/sync.sh"
@@ -321,7 +322,7 @@ start_e2b_sandbox() {
     # resetting the epoch, so --sandbox-max-cost spans replacements — a run
     # that keeps expiring/recreating must not restart its budget from zero.
     local prev_epoch
-    prev_epoch=$(e2b_state_get '.created_epoch')
+    prev_epoch=$(to_int "$(e2b_state_get '.created_epoch')")   # repo-committable state (#371)
     if [[ -n "$prev_epoch" && "$prev_epoch" != "0" ]]; then
         local segment_s accrued
         segment_s=$(( $(get_epoch_seconds) - prev_epoch ))
@@ -703,7 +704,7 @@ update_e2b_cost() {
     local accrued created
     accrued=$(e2b_state_get '.accrued_cost')
     accrued=${accrued:-0}
-    created=$(e2b_state_get '.created_epoch')
+    created=$(to_int "$(e2b_state_get '.created_epoch')")   # repo-committable state (#371)
     if [[ -z "$created" || "$created" == "0" ]]; then
         # No active sandbox: the estimate is the accrued total alone — still
         # persisted so status.json/monitor never show 0 while accrued > 0
@@ -779,7 +780,7 @@ cleanup_e2b_sandbox() {
     sync_e2b_artifacts_down || true
     local cost created runtime=0
     cost=$(update_e2b_cost)
-    created=$(e2b_state_get '.created_epoch')
+    created=$(to_int "$(e2b_state_get '.created_epoch')")
     if [[ -n "$created" && "$created" != "0" ]]; then
         runtime=$(( $(get_epoch_seconds) - created ))
         (( runtime < 0 )) && runtime=0
```

**File**: `ralph_loop.sh` (modified, +21/-14)
```diff
@@ -36,6 +36,7 @@ _env_SYNC_LARGE_FILE_ACTION="${SYNC_LARGE_FILE_ACTION:-}"
 # Source library components
 SCRIPT_DIR="$(dirname "${BASH_SOURCE[0]}")"
 source "$SCRIPT_DIR/lib/date_utils.sh" || { echo "FATAL: Failed to source lib/date_utils.sh" >&2; exit 1; }
+source "$SCRIPT_DIR/lib/int_utils.sh" || { echo "FATAL: Failed to source lib/int_utils.sh" >&2; exit 1; }
 source "$SCRIPT_DIR/lib/timeout_utils.sh" || { echo "FATAL: Failed to source lib/timeout_utils.sh" >&2; exit 1; }
 source "$SCRIPT_DIR/lib/response_analyzer.sh" || { echo "FATAL: Failed to source lib/response_analyzer.sh" >&2; exit 1; }
 source "$SCRIPT_DIR/lib/circuit_breaker.sh" || { echo "FATAL: Failed to source lib/circuit_breaker.sh" >&2; exit 1; }
@@ -767,13 +768,14 @@ log_status() {
 # Update status JSON for external monitoring
 update_status() {
     local loop_count=$1
-    local calls_made=$2
+    local calls_made
+    calls_made=$(to_int "$2")   # callers pass raw .call_count content (#371)
     local last_action=$3
     local status=$4
     local exit_reason=${5:-""}
     
     local tokens_used
-    tokens_used=$(cat "$TOKEN_COUNT_FILE" 2>/dev/null || echo "0")
+    tokens_used=$(to_int "$(cat "$TOKEN_COUNT_FILE" 2>/dev/null)")
     # Issue #74: surface sandbox state for ralph-monitor (read before the
     # heredoc per the project convention — no lazy $() inside cat >)
     local sandbox_json='{"provider": "none"}'
@@ -845,17 +847,19 @@ update_token_count() {
     new_tokens=$(extract_token_usage "$output_file")
     if [[ "$new_tokens" -gt 0 ]] 2>/dev/null; then
         local current
-        current=$(cat "$TOKEN_COUNT_FILE" 2>/dev/null || echo "0")
+        current=$(to_int "$(cat "$TOKEN_COUNT_FILE" 2>/dev/null)")
         echo $(( current + new_tokens )) > "$TOKEN_COUNT_FILE"
         log_status "INFO" "Tokens this hour: $((current + new_tokens))${MAX_TOKENS_PER_HOUR:+/$MAX_TOKENS_PER_HOUR} (+${new_tokens})"
     fi
 }
 
 # Check if we can make another call
+# Counter files are repository-committable: read them through to_int, never as
+# raw arithmetic operands (a[$(cmd)] would execute — Issue #371)
 can_make_call() {
     local calls_made=0
     if [[ -f "$CALL_COUNT_FILE" ]]; then
-        calls_made=$(cat "$CALL_COUNT_FILE")
+        calls_made=$(to_int "$(cat "$CALL_COUNT_FILE")")
     fi
 
     if [[ $calls_made -ge $MAX_CALLS_PER_HOUR ]]; then
@@ -865,7 +869,7 @@ can_make_call() {
     # Check token limit only when configured (MAX_TOKENS_PER_HOUR > 0)
     if [[ "${MAX_TOKENS_PER_HOUR:-0}" -gt 0 ]] 2>/dev/null; then
         local tokens_used=0
-        tokens_used=$(cat "$TOKEN_COUNT_FILE" 2>/dev/null || echo "0")
+        tokens_used=$(to_int "$(cat "$TOKEN_COUNT_FILE" 2>/dev/null)")
         if [[ $tokens_used -ge $MAX_TOKENS_PER_HOUR ]]; then
             return 1  # Cannot make call — token limit reached
         fi
@@ -878,7 +882,7 @@ can_make_call() {
 increment_call_counter() {
     local calls_made=0
     if [[ -f "$CALL_COUNT_FILE" ]]; then
-        calls_made=$(cat "$CALL_COUNT_FILE")
+        calls_made=$(to_int "$(cat "$CALL_COUNT_FILE")")
     fi
     
     ((calls_made++))
@@ -921,8 +925,9 @@ print_metrics_summary() {
 
 # Wait for rate limit reset with countdown
 wait_for_reset() {
-    local calls_made=$(cat "$CALL_COUNT_FILE" 2>/dev/null || echo "0")
-    local tokens_used=$(cat "$TOKEN_COUNT_FILE" 2>/dev/null || echo "0")
+    local calls_made tokens_used
+    calls_made=$(to_int "$(cat "$CALL_COUNT_FILE" 2>/dev/null)")
+    tokens_used=$(to_int "$(cat "$TOKEN_COUNT_FILE" 2>/dev/null)")
     local limit_reason="calls: $calls_made/$MAX_CALLS_PER_HOUR"
     if [[ "${MAX_TOKENS_PER_HOUR:-0}" -gt 0 ]]; then
         limit_reason="$limit_reason, tokens: $tokens_used/$MAX_TOKENS_PER_HOUR"
@@ -970,9 +975,11 @@ should_exit_gracefully() {
     local recent_done_signals  
     local recent_completion_indicators
     
-    recent_test_loops=$(echo "$signals" | jq '.test_only_loops | length' 2>/dev/null || echo "0")
-    recent_done_signals=$(echo "$signals" | jq '.done_signals | length' 2>/dev/null || echo "0")
-    recent_completion_indicators=$(echo "$signals" | jq '.completion_indicators | length' 2>/dev/null || echo "0")
+    # jq `length` of a non-array number is its absolute value (0.5 stays 0.5),
+    # which [[ -ge ]] can't compare - to_int keeps the exit checks working (#371)
+    recent_test_loops=$(to_int "$(echo "$signals" | jq '.test_only_loops | length' 2>/dev/null)")
+    recent_done_signals=$(to_int "$(echo "$signals" | jq '.done_signals | length' 2>/dev/null)")
+    recent_completion_indicators=$(to_int "$(echo "$signals" | jq '.completion_indicators | length' 2>/dev/null)")
 
     # Diagnostic logging for exit signal check (Issue #194)
     [[ "${VERBOSE_PROGRESS:-}" == "true" ]] && log_status "DEBUG" "Exit check: test_loops=$recent_test_loops done_signals=$recent_done_signals completion_indicators=$recent_completion_indicators"
@@ -2848,7 +2855,7 @@ main() {
 
             log_status "SUCCESS" 
```

**File**: `tests/e2e/test_full_loop.bats` (modified, +50/-0)
```diff
@@ -370,3 +370,53 @@ RC
     [ ! -e "$E2E_DIR/PWNED" ]
     [[ "$output" == *"shell syntax"* ]]
 }
+
+# =============================================================================
+# UNTRUSTED NUMBERS NEVER REACH BASH ARITHMETIC (Issue #371)
+# =============================================================================
+
+@test "E2E: committed circuit-breaker state cannot execute code (#371)" {
+    # Valid JSON (so it survives init_circuit_breaker's validity check) with a
+    # payload in every numeric field record_loop_result coerces each loop.
+    # \${IFS} instead of a space: the reader strips whitespace, an attacker wouldn't use any
+    jq -n --arg p "a[\$(touch\${IFS}$E2E_DIR/PWNED)]" '{state: "CLOSED", consecutive_no_progress: $p,
+        consecutive_same_error: $p, consecutive_permission_denials: $p, last_progress_loop: $p,
+        total_opens: $p, current_loop: $p, reason: ""}' > .ralph/.circuit_breaker_state
+    e2e_fix_plan 1 0
+    queue_response 1 "IN_PROGRESS" "false" "Implemented the open task."
+    queue_productive_effect 1
+
+    run run_ralph
+
+    [ ! -e "$E2E_DIR/PWNED" ]
+    assert_equal "$(mock_call_count)" "1"
+    jq -e '.total_opens | numbers' .ralph/.circuit_breaker_state > /dev/null
+}
+
+@test "E2E: committed call/token counters cannot execute code (#371)" {
+    # A current-hour .last_reset stops init_call_tracking from resetting them
+    date +%Y%m%d%H > .ralph/.last_reset
+    echo "a[\$(touch $E2E_DIR/PWNED)]" > .ralph/.call_count
+    echo "a[\$(touch $E2E_DIR/PWNED)]" > .ralph/.token_count
+    export MAX_TOKENS_PER_HOUR=100000
+    e2e_fix_plan 1 0
+    queue_response 1 "IN_PROGRESS" "false" "Implemented the open task."
+    queue_productive_effect 1
+
+    run run_ralph
+
+    [ ! -e "$E2E_DIR/PWNED" ]
+    jq -e '.calls_made_this_hour | numbers' .ralph/status.json > /dev/null
+}
+
+@test "E2E: a numeric field in Claude's output cannot execute code (#371)" {
+    e2e_fix_plan 1 0
+    e2e_response_json "IN_PROGRESS" "false" "Implemented the open task." "" \
+        "+ {files_modified: \"a[\$(touch $E2E_DIR/PWNED)]\", error_count: \"a[\$(touch $E2E_DIR/PWNED)]\", metadata: {files_changed: \"a[\$(touch $E2E_DIR/PWNED)]\"}}" \
+        | queue_raw_response 1 0
+    queue_productive_effect 1
+
+    run run_ralph
+
+    [ ! -e "$E2E_DIR/PWNED" ]
+}
```

**File**: `tests/unit/test_cli_modern.bats` (modified, +2/-2)
```diff
@@ -1427,8 +1427,8 @@ EOF
 @test "source statements have explicit error guards" {
     local script="${BATS_TEST_DIRNAME}/../../ralph_loop.sh"
 
-    # All 5 library source lines must have || { echo "FATAL: ..."; exit 1; }
-    local libs=("date_utils.sh" "timeout_utils.sh" "response_analyzer.sh" "circuit_breaker.sh" "file_protection.sh")
+    # All 6 library source lines must have || { echo "FATAL: ..."; exit 1; }
+    local libs=("date_utils.sh" "int_utils.sh" "timeout_utils.sh" "response_analyzer.sh" "circuit_breaker.sh" "file_protection.sh")
     for lib in "${libs[@]}"; do
         run grep "source.*${lib}.*|| { echo.*FATAL.*exit 1; }" "$script"
         assert_success
```

---

### Incident Patch 2: `a5311fea` (2026-10-07)
**Commit Message**: fix(security): parse .ralphrc as data, never as code (#346) (#363)

## Summary
- `.ralphrc` is repository-controlled, so it is now parsed as KEY=VALUE data and never sourced. A shared `lib/ralphrc.sh` is used by `ralph`, `ralph-import`/`ralph-queue` and `tools/inspect-allowed-tools.sh`.
- `$`, backticks, backslashes and control characters are rejected in every value, and numeric keys must be numbers. Values reach bash arithmetic, where `a[$(cmd)]` executes.
- Command-bearing keys (`CLAUDE_CODE_CMD`, `RALPH_SHELL_INIT_FILE`, `SANDBOX_DOCKER_IMAGE`, `SANDBOX_E2B_TEMPLATE`, `SANDBOX_E2B_SANDBOX_ID`, `SANDBOX_DOCKER_NETWORK=host`) accept only stock values from the file. Custom values come from env or CLI flags.
- CLI flags win over the repository file, including in the `--monitor` tmux child (`--dry-run` is now forwarded, so `ralph --monitor --dry-run` no longer makes real API calls).
- Repository values are printed via `ralphrc_display`, so no terminal escapes. Docs and templates are updated; breaking changes are noted in the README.

## Validation
- Tests: 1039 unit, 281 integration and 20 e2e pass locally and in CI. The only local failures are 2 pre-existing session tests on uutils 

**File**: `CLAUDE.md` (modified, +5/-0)
```diff
@@ -38,6 +38,7 @@ Ralph for Claude Code — an autonomous AI development loop system enabling cont
 - **task_sources.sh** — task import from beads, GitHub Issues, and PRD documents (checkbox and numbered list formats); normalization and prioritization
 - **issue_analyzer.sh** — `assess_issue_completeness()`: deterministic 0–100 heuristic scoring of issue PRDs (acceptance criteria +25, checklists/code blocks/sections/keywords/length +15 each); JSON output with `confidence_score`, `completeness_level`, `missing_elements`, `recommendation`; `log_issue_analysis()` for summaries
 - **file_protection.sh** — `validate_ralph_integrity()` checks `RALPH_REQUIRED_PATHS` exist; runs every loop iteration; `get_integrity_report()` for recovery instructions
+- **ralphrc.sh** — safe `.ralphrc` reader (Issue #346): `ralphrc_parse_line` (KEY=VALUE grammar, literal values per bash quoting, rejects anything bash would expand/execute; rc 0/1/2/3), `ralphrc_value_allowed` (command-bearing keys accept only stock values), `ralphrc_get FILE KEY`. Used by ralph_loop.sh, ralph_import.sh and tools/inspect-allowed-tools.sh
 - **log_utils.sh** — `rotate_logs()` rotates `$LOG_DIR/ralph.log` at 10MB, keeping 4 archives (`.log.1`–`.log.4`); GNU `stat -c%s` with BSD `stat -f%z` fallback
 - **github_lifecycle.sh** — GitHub issue lifecycle management backing `ralph --github-issue` (Issue #73). `parse_issue_reference` (N | #N | owner/repo#N | URL → number+repo); gh wrappers `gh_issue_comment`/`gh_close_issue`/`gh_add_labels`/`gh_create_pr`/`gh_create_issue` (each logs + returns non-zero on failure, never exits); state primitives `init_github_lifecycle`/`lifecycle_get`/`_lifecycle_apply` (atomic temp+`mv` at `.ralph/.github_lifecycle_state`, program-first signature like `_queue_apply`); generators `generate_progress_comment`/`generate_completion_summary`/`scan_for_todos`; orchestration `lifecycle_post_progress <loop>` (interval-gated) and `lifecycle_on_completion` (summary → PR → followups → close, each flag-guarded, always returns 0). Reuses `lib/date_utils.sh` timestamps
 - **sandbox_docker.sh** — Docker sandbox execution backing `ralph --sandbox docker` (Issue #74). Containerizes only the Claude CLI execution: one persistent container per run (`docker run -d … sleep infinity`, project bind-mounted rw at `/workspace`), each iteration wrapped as `docker exec -i -w /workspace <cid> claude …` via `build_sandbox_exec_args`/`wrap_claude_command_for_sandbox` (works in live and background modes); ralph orchestration, analysis, and status.json stay host-side so ralph-monitor is unaffected. `validate_sandbox_config` (image/memory/cpus/network), `init_docker_sandbox` (daemon + image checks with build/pull guidance), `setup_docker_credentials` (ANTHROPIC_API_KEY → 0600 env-file via `--env-file`, else host `~/.claude/.credentials.json` copied into a container-scoped home — never `docker secret`, which needs Swarm), `handle_sandbox_timeout` (exit 124 kills only the docker-exec client → `docker restart` reaps orphans), idempotent `cleanup_docker_sandbox` on all exit paths. State: `.ralph/.docker_sandbox_state` (atomic temp+`mv`). Setup failure is fatal — never falls back to host execution. Config: `SANDBOX_PROVIDER`, `SANDBOX_DOCKER_IMAGE/MEMORY/CPUS/NETWORK` (env > CLI > .ralphrc); sandbox `_env_*` capture sits BEFORE the lib source block in ralph_loop.sh because the lib sets defaults at source time. Default image from GHCR (`docker pull ghcr.io/frankbria/ralph-sandbox:latest`, published on `v*` tags by `.github/workflows/docker-publish.yml` — multi-arch amd64+arm64, smoke-tested before push, dry-run via workflow_dispatch `push=false`; guards in `tests/unit/test_workflow_docker_publish.bats`, Issue #298) or built locally from the repo `Dockerfile` (`docker build -t ralph-sandbox .`; install.sh copies it to `~/.ralph`). `get_sandbox_status` is the provider router for status.json (docker impl renamed `get_docker_sandbox_status`; routes to `get_e2b_sandbox_status` when `SANDBOX_PROVIDER=e2b`)
@@ -295,6 +296,10 @@ Two-stage filtering eliminates false positives:
 
 **Multi-line error matching**: stuck-loop detection verifies ALL error lines appear in ALL recent history files, using literal `grep -qF` to avoid regex edge cases and false negatives when multiple distinct errors occur.
 
+### `.ralphrc` Parsing (Issue #346)
+
+`.ralphrc` is repository-controlled, so it is parsed as data and never sourced. The grammar and the command-key policy live in **lib/ralphrc.sh** (`ralphrc_parse_line`, `ralphrc_value_allowed`, `ralphrc_get`) and are shared by every reader: `load_ralphrc()` in ralph_loop.sh, `ralph_import.sh` (and `ralph-queue`, which sources it; env `CLAUDE_CODE_CMD` now wins there too) and `tools/inspect-allowed-tools.sh` — never add a new `.ralphrc` reader that greps or sources the file. `load_ralphrc()`: only `KEY=VALUE` lines (optional `export`, quotes, trailing `# comment`, CRLF tolerated) for allowlisted keys are applied via `printf -v`; values are lite
```

**File**: `README.md` (modified, +8/-3)
```diff
@@ -48,6 +48,10 @@ Ralph is an implementation of the Geoffrey Huntley's technique for Claude Code t
 
 ### Recent Improvements
 
+**Unreleased - Security: `.ralphrc` is parsed as data** (#346)
+- `.ralphrc` is no longer executed with `source`: only `KEY=VALUE` lines for known keys are applied, with literal values. Shell syntax (`$VAR`, `$(...)`, chained commands) is rejected with a warning — **breaking** for `.ralphrc` files that relied on it
+- `CLAUDE_CODE_CMD`, `RALPH_SHELL_INIT_FILE`, `SANDBOX_DOCKER_IMAGE`, `SANDBOX_E2B_TEMPLATE` and `SANDBOX_DOCKER_NETWORK` (no `host`) accept only stock values from `.ralphrc`; set custom values as environment variables (or `--sandbox-*` flags). Applies to `ralph`, `ralph-import` and `ralph-queue`. See [docs/CLI_OPTIONS.md](docs/CLI_OPTIONS.md#common-ralphrc-patterns)
+
 **v0.11.5 - Community Bug Fixes** (latest)
 - Fixed API limit false positive: Timeout (exit code 124) no longer misidentified as API 5-hour limit (#183)
 - Three-layer API limit detection: timeout guard → structural JSON (`rate_limit_event`) → filtered text fallback
@@ -681,9 +685,10 @@ PROJECT_TYPE="typescript"
 CLAUDE_CODE_CMD="claude"
 # CLAUDE_CODE_CMD="npx @anthropic-ai/claude-code"  # Alternative: use npx
 
-# Shell init file — source before running claude (useful for zsh/fish users
-# whose PATH or env vars are only set in their shell's init file)
-#RALPH_SHELL_INIT_FILE="~/.zshrc"
+# Custom CLI paths and shell init files are environment-only (never read from
+# .ralphrc, which is repository-controlled):
+#   export CLAUDE_CODE_CMD="/opt/local/bin/claude"
+#   export RALPH_SHELL_INIT_FILE="$HOME/.zshrc"
 
 # Loop settings
 MAX_CALLS_PER_HOUR=100
```

**File**: `docs/CLI_OPTIONS.md` (modified, +18/-6)
```diff
@@ -303,7 +303,13 @@ ralph --session-expiry 4     # Short-lived tasks where fresh context is better
 
 ## Common `.ralphrc` Patterns
 
-The `.ralphrc` file at your project root is sourced before each loop. Environment variables always take precedence over `.ralphrc` values.
+The `.ralphrc` file at your project root is read at startup. Environment variables always take precedence over `.ralphrc` values.
+
+> **Security (Issue #346):** `.ralphrc` lives in the repository, so Ralph parses it as data — it is **never executed**. Only `KEY=VALUE` lines for known configuration keys are applied (optional `export` prefix, `"double"`/`'single'` quotes and trailing `# comments` are fine). Values are literal: `$`, backticks, backslashes and control characters are rejected in **any** value (even single-quoted), unquoted values may not contain other shell syntax, numeric keys (call limits, timeouts, thresholds, costs, `CLAUDE_MIN_VERSION`) must be numbers, unknown keys are ignored with a warning, and `~` is not expanded (write the full path).
+>
+> Keys that decide what Ralph runs — `CLAUDE_CODE_CMD`, `RALPH_SHELL_INIT_FILE`, `SANDBOX_DOCKER_IMAGE`, `SANDBOX_E2B_TEMPLATE` — accept only their stock values from `.ralphrc` (`claude` / `npx @anthropic-ai/claude-code`, the official sandbox image, the `base` template; `RALPH_SHELL_INIT_FILE` none at all), and `SANDBOX_DOCKER_NETWORK` accepts only `bridge` or `none`. Set custom values in your environment (or with `--sandbox-image` / `--sandbox-template` / `--sandbox-network`), so a repository can't choose what runs on your machine. The same rules apply to `ralph-import` and `tools/inspect-allowed-tools.sh`.
+>
+> `ALLOWED_TOOLS` is still read from `.ralphrc`, so it is **not** a permission boundary against an untrusted repository (and `PROMPT.md` is repository-controlled too). Likewise `GITHUB_ISSUE` (with `AUTO_CLOSE`, `CREATE_PR`, …) can name any repository your `gh` login can write to. Run repositories you don't trust with `--sandbox docker` or `--sandbox e2b`, and review their `.ralphrc` before enabling GitHub lifecycle flags.
 
 ### Local workstation (default)
 
@@ -339,8 +345,12 @@ CLAUDE_TIMEOUT_MINUTES=10
 # npm registry is unreachable — prevents timeout and warning spam
 CLAUDE_AUTO_UPDATE=false
 
-# Use a specific local Claude CLI path if not on PATH
-CLAUDE_CODE_CMD="/opt/local/bin/claude"
+```
+
+Custom Claude CLI paths are not read from `.ralphrc` (see the security note above) — export one instead:
+
+```bash
+export CLAUDE_CODE_CMD="/opt/local/bin/claude"
 ```
 
 ---
@@ -424,8 +434,10 @@ CLAUDE_MODEL=claude-opus-4-6 ralph --monitor
 ### Custom shell initialization
 
 ```bash
-# Source a script before each loop (e.g., to activate a virtualenv or set PATH)
-RALPH_SHELL_INIT_FILE=".ralph/init.sh"
+# Source a script at startup (e.g., to activate a virtualenv or set PATH).
+# Environment only — Ralph ignores this key in .ralphrc, since sourcing a file
+# the repository chose would run repository code on your machine.
+export RALPH_SHELL_INIT_FILE="$HOME/.zshrc"
 ```
 
 Ralph will warn if the file is set but missing, and skip sourcing if it doesn't exist.
@@ -438,7 +450,7 @@ These keys have no CLI flag equivalent — they can only be set in `.ralphrc` or
 
 | Key | Default | Description |
 |-----|---------|-------------|
-| `CLAUDE_CODE_CMD` | `"claude"` | Claude Code CLI command. Override for non-global installs (e.g., `"npx @anthropic-ai/claude-code"`). |
+| `CLAUDE_CODE_CMD` | `"claude"` | Claude Code CLI command. `.ralphrc` accepts only `"claude"` or `"npx @anthropic-ai/claude-code"`; export a custom path as an environment variable. |
 | `CLAUDE_AUTO_UPDATE` | `true` | Auto-check npm registry and update the Claude CLI at startup. Set `false` for Docker/air-gapped environments. |
 | `CLAUDE_MIN_VERSION` | `"2.0.76"` | Minimum Claude CLI version required. Ralph warns and exits if the installed version is older. |
 | `MAX_TOKENS_PER_HOUR` | `0` | Hourly token budget (`input + output`). `0` = disabled. Blocks further calls once exhausted; resets with the call counter on the hour. |
```

**File**: `docs/DOCKER_SANDBOX.md` (modified, +8/-1)
```diff
@@ -88,6 +88,12 @@ SANDBOX_DOCKER_NETWORK="bridge"
 Environment variables of the same names take precedence over `.ralphrc`, and
 `--monitor` (tmux) forwards all sandbox flags to the loop pane.
 
+> **Security (Issue #346):** `.ralphrc` is repository-controlled, so it accepts
+> only stock values for `SANDBOX_DOCKER_IMAGE` (`ralph-sandbox:latest` or the
+> official GHCR image) and `SANDBOX_DOCKER_NETWORK` (`bridge` or `none`). Custom
+> images and `host` networking must come from env vars or `--sandbox-image` /
+> `--sandbox-network`.
+
 ## Credentials
 
 Handled by `setup_docker_credentials()` in `lib/sandbox_docker.sh`, in order:
@@ -111,7 +117,8 @@ Handled by `setup_docker_credentials()` in `lib/sandbox_docker.sh`, in order:
 - `bridge` (default) — container can reach the Claude API; normal isolation
   from the host network.
 - `host` — shares the host network namespace; less isolation, occasionally
-  needed for localhost services.
+  needed for localhost services. Set it with `--sandbox-network host` or the
+  `SANDBOX_DOCKER_NETWORK` env var; `.ralphrc` rejects it.
 - `none` — full network isolation. **This blocks the Claude API**, so it only
   makes sense for images that route through a proxy or have offline tooling;
   the help text and docs call this out.
```

**File**: `docs/E2B_SANDBOX.md` (modified, +5/-0)
```diff
@@ -93,6 +93,11 @@ SANDBOX_E2B_COST_PER_HOUR="0.10"
 Environment variables of the same names take precedence over `.ralphrc`, and
 `--monitor` (tmux) forwards all sandbox flags to the loop pane.
 
+Custom templates (`SANDBOX_E2B_TEMPLATE` other than `base`) and
+`SANDBOX_E2B_SANDBOX_ID` are accepted only from env vars or `--sandbox-template` /
+`--sandbox-id`, not from `.ralphrc` — a repository must not pick the environment
+that receives your credentials (Issue #346).
+
 ## Credentials
 
 Two independent secrets, neither of which ever appears on a command line:
```

**File**: `lib/enable_core.sh` (modified, +5/-6)
```diff
@@ -701,7 +701,8 @@ PROJECT_TYPE="${project_type}"
 # Claude Code CLI command
 # If "claude" is not in your PATH, set to your installation:
 #   "npx @anthropic-ai/claude-code"  (uses npx, no global install needed)
-#   "/path/to/claude"                (custom path)
+# A custom path (/path/to/claude) is only honored from the environment:
+#   export CLAUDE_CODE_CMD=/path/to/claude
 CLAUDE_CODE_CMD="${claude_cmd}"
 
 # Loop settings
@@ -735,11 +736,9 @@ CB_OUTPUT_DECLINE_THRESHOLD=70
 # Auto-update Claude CLI at startup
 CLAUDE_AUTO_UPDATE=true
 
-# Shell init file (optional)
-# Source this file before running claude — useful when claude requires environment
-# variables or PATH entries defined in a non-bash shell config (e.g. ~/.zshrc).
-# Leave commented out unless needed.
-#RALPH_SHELL_INIT_FILE="~/.zshrc"
+# Shell init file (optional, environment only)
+# To source e.g. ~/.zshrc before running claude, export RALPH_SHELL_INIT_FILE in
+# your shell. It is ignored here: .ralphrc is repository-controlled (Issue #346).
 
 # Docker sandbox execution (optional, Issue #74)
 # Run Claude Code inside an isolated Docker container instead of on the host.
```

**File**: `lib/ralphrc.sh` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+#!/usr/bin/env bash
+# lib/ralphrc.sh - Safe .ralphrc parsing (Issue #346)
+#
+# .ralphrc is repository-controlled, so it is read as KEY=VALUE data and never
+# sourced. Shared by ralph_loop.sh (load_ralphrc), ralph_import.sh and
+# tools/inspect-allowed-tools.sh so every reader applies the same grammar and
+# the same command-bearing-key policy. Bash 3.2 compatible.
+
+# ralphrc_parse_line LINE
+#
+# Sets RALPHRC_KEY and RALPHRC_VALUE (the literal value, per bash quoting rules;
+# `$`, backticks, backslashes and control characters are never accepted).
+# Returns 0 for an assignment, 1 for a blank or comment line, 2 for a line that
+# is not KEY=VALUE, 3 for a value bash would expand or execute (rejected rather
+# than reinterpreted).
+ralphrc_parse_line() {
+    local line="$1"
+    local re_assign='^(export[[:space:]]+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$'
+    local re_dquoted='^"([^"]*)"([[:space:]]+#.*)?$'
+    local re_squoted="^'([^']*)'([[:space:]]+#.*)?\$"
+    local re_bare='^([^[:space:]#]*)([[:space:]]+#.*)?$'
+    # Never allowed in any value, however quoted: values later reach bash
+    # arithmetic (where a[$(cmd)] executes) and echo -e (where \033 renders)
+    local re_unsafe='[$`\\[:cntrl:]]'
+    local re_bare_unsafe='[$`\\;|&<>()"'"'"']'
+
+    RALPHRC_KEY=""
+    RALPHRC_VALUE=""
+    line="${line#$'\xef\xbb\xbf'}"
+    line="${line%$'\r'}"
+    line="${line#"${line%%[![:space:]]*}"}"
+    line="${line%"${line##*[![:space:]]}"}"
+    [[ -z "$line" || "$line" == \#* ]] && return 1
+    [[ "$line" =~ $re_assign ]] || return 2
+
+    RALPHRC_KEY="${BASH_REMATCH[2]}"
+    local value="${BASH_REMATCH[3]}"
+    if [[ "$value" =~ $re_squoted ]] || [[ "$value" =~ $re_dquoted ]]; then
+        value="${BASH_REMATCH[1]}"
+    elif [[ "$value" =~ $re_bare ]]; then
+        value="${BASH_REMATCH[1]}"
+        [[ "$value" =~ $re_bare_unsafe ]] && return 3
+    else
+        return 3
+    fi
+    [[ "$value" =~ $re_unsafe ]] && return 3
+    RALPHRC_VALUE="$value"
+    return 0
+}
+
+# ralphrc_value_allowed KEY VALUE
+#
+# Command-bearing keys decide what Ralph executes, sources, or hands
+# credentials to (or, for SANDBOX_DOCKER_NETWORK=host, how isolated it is). From the repo file only stock values are honored; custom
+# values must come from the user's environment (or CLI flags). Returns 1 for a
+# disallowed command-bearing value, 0 otherwise.
+ralphrc_value_allowed() {
+    case "$1=$2" in
+        CLAUDE_CODE_CMD=|CLAUDE_CODE_CMD=claude|"CLAUDE_CODE_CMD=npx @anthropic-ai/claude-code") return 0 ;;
+        SANDBOX_DOCKER_IMAGE=|SANDBOX_DOCKER_IMAGE=ralph-sandbox:latest|SANDBOX_DOCKER_IMAGE=ghcr.io/frankbria/ralph-sandbox:latest) return 0 ;;
+        SANDBOX_E2B_TEMPLATE=|SANDBOX_E2B_TEMPLATE=base) return 0 ;;
+        SANDBOX_DOCKER_NETWORK=|SANDBOX_DOCKER_NETWORK=bridge|SANDBOX_DOCKER_NETWORK=none) return 0 ;;
+        RALPH_SHELL_INIT_FILE=|SANDBOX_E2B_SANDBOX_ID=) return 0 ;;
+        CLAUDE_CODE_CMD=*|SANDBOX_DOCKER_IMAGE=*|SANDBOX_E2B_TEMPLATE=*|SANDBOX_DOCKER_NETWORK=*|RALPH_SHELL_INIT_FILE=*|SANDBOX_E2B_SANDBOX_ID=*) return 1 ;;
+    esac
+    return 0
+}
+
+# ralphrc_value_numeric_ok KEY VALUE
+#
+# Numeric keys reach bash arithmetic ([[ -ge ]], $((...))), which dereferences
+# identifiers recursively (a bare name could pull code in from elsewhere) and is
+# integer-only (a decimal errors the comparison and silently disables the guard).
+# Returns 1 when VALUE doesn't fit KEY's numeric class.
+ralphrc_value_numeric_ok() {
+    case "$1" in
+        MAX_CALLS_PER_HOUR|MAX_TOKENS_PER_HOUR|CLAUDE_TIMEOUT_MINUTES|CLAUDE_SESSION_EXPIRY_HOURS|SESSION_EXPIRY_HOURS|\
+        CB_COOLDOWN_MINUTES|CB_NO_PROGRESS_THRESHOLD|CB_SAME_ERROR_THRESHOLD|CB_OUTPUT_DECLINE_THRESHOLD|\
+        CB_PERMISSION_DENIAL_THRESHOLD|MAX_CONSECUTIVE_TEST_LOOPS|MAX_CONSECUTIVE_DONE_SIGNALS|TEST_PERCENTAGE_THRESHOLD|\
+        COMMENT_INTERVAL|SANDBOX_E2B_TIMEOUT|SYNC_MAX_FILE_SIZE)
+            [[ "$2" =~ ^[0-9]+$ ]] ;;
+        SANDBOX_E2B_MAX_COST|SANDBOX_E2B_COST_ALERT|SANDBOX_E2B_COST_PER_HOUR)
+            [[ -z "$2" || "$2" =~ ^[0-9]+([.][0-9]+)?$ ]] ;;
+        CLAUDE_MIN_VERSION)
+            [[ -z "$2" || "$2" =~ ^[0-9]+([.][0-9]+)*$ ]] ;;
+        *) return 0 ;;
+    esac
+}
+
+# ralphrc_display VALUE - VALUE with control characters and backslashes replaced
+# by '?', safe to print even via `echo -e` (repo-controlled text must not reach
+# the terminal as escape sequences)
+ralphrc_display() {
+    local v="${1//[[:cntrl:]]/?}"
+    printf '%s' "${v//\\/?}"
+}
+
+# ralphrc_get FILE KEY
+#
+# Prints KEY's literal value from FILE (last valid assignment wins). Values a
+# repo may not set (see ralphrc_value_allowed) are skipped with a warning on
+# stderr. Returns 1 when FILE has no usable assignment for KEY.
+ralphrc_get() {
+    local file="$1" key="$2" line found=1 value=""
+    [[ -f "$file" ]] || return 1
+    while IFS= read -r line || [[ -n "$line" ]]; do
+        ralphrc_parse_line "$line"
```

**File**: `ralph_import.sh` (modified, +5/-5)
```diff
@@ -8,14 +8,14 @@ set -e
 # both the repo layout and the installed layout (~/.ralph/lib)
 IMPORT_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
 source "$IMPORT_SCRIPT_DIR/lib/issue_analyzer.sh" || { echo "FATAL: Failed to source lib/issue_analyzer.sh" >&2; exit 1; }
+source "$IMPORT_SCRIPT_DIR/lib/ralphrc.sh" || { echo "FATAL: Failed to source lib/ralphrc.sh" >&2; exit 1; }
 
 # Configuration
-CLAUDE_CODE_CMD="claude"
-# Load CLAUDE_CODE_CMD from .ralphrc if available
-if [[ -f ".ralphrc" ]]; then
-    _ralphrc_cmd=$(grep "^CLAUDE_CODE_CMD=" ".ralphrc" 2>/dev/null | cut -d= -f2- | tr -d '"' | tr -d "'")
-    [[ -n "$_ralphrc_cmd" ]] && CLAUDE_CODE_CMD="$_ralphrc_cmd"
+# CLAUDE_CODE_CMD: environment first, then .ralphrc (stock values only, Issue #346)
+if [[ -z "${CLAUDE_CODE_CMD:-}" ]]; then
+    CLAUDE_CODE_CMD=$(ralphrc_get ".ralphrc" CLAUDE_CODE_CMD) || CLAUDE_CODE_CMD=""
 fi
+CLAUDE_CODE_CMD="${CLAUDE_CODE_CMD:-claude}"
 
 # Modern CLI Configuration (Phase 1.1)
 # These flags enable structured JSON output and controlled file operations
```

---

### Incident Patch 3: `e8533cc3` (2026-07-10)
**Commit Message**: fix(response_analyzer): guard against zero last_output_length (#333)

## Summary
- analyze_response() no longer crashes with "division by 0" when .ralph/.last_output_length is 0, empty, or non-numeric (e.g. after an interrupted prior loop): the output-decline heuristic now runs only when the previous length is a valid positive integer
- 3 regression tests for the crash inputs (contributor) + 1 differential test locking the +10 decline bonus on the normal path (review feedback)

## Validation
- Tests: 67/67 in test_exit_detection.bats locally; full suite green in CI (test + coverage)
- Test mutation check: passed (disabling the +=10 bonus fails the new test)
- Cross-family review: opencode (zai/glm-5.2) posted on the PR — verdict APPROVE; 1 Suggestion applied in 179d2ae, 1 Nitpick refuted (no other length_ratio consumer)
- Final feedback triage: 0 new items since 2026-07-10T18:59:38Z cutoff
- Demo: both criteria verified with outcome evidence (main's lib reproducibly crashes and writes no analysis; PR branch completes for all three bad inputs; +10 delta exact on normal path)
- CI note: review/review (GLM workflow) cannot run on fork PRs (no secrets) — covered by the manual cross-fam

**File**: `lib/response_analyzer.sh` (modified, +7/-4)
```diff
@@ -798,11 +798,14 @@ analyze_response() {
     # 7. Analyze output length trends (detect declining engagement)
     if [[ -f "$RALPH_DIR/.last_output_length" ]]; then
         local last_length=$(cat "$RALPH_DIR/.last_output_length")
-        local length_ratio=$((output_length * 100 / last_length))
+        # Guard against missing/zero previous length (avoids division by zero)
+        if [[ "$last_length" =~ ^[0-9]+$ ]] && (( last_length > 0 )); then
+            local length_ratio=$((output_length * 100 / last_length))
 
-        if [[ $length_ratio -lt 50 ]]; then
-            # Output is less than 50% of previous - possible completion
-            ((confidence_score+=10))
+            if [[ $length_ratio -lt 50 ]]; then
+                # Output is less than 50% of previous - possible completion
+                ((confidence_score+=10))
+            fi
         fi
     fi
     echo "$output_length" > "$RALPH_DIR/.last_output_length"
```

**File**: `tests/unit/test_exit_detection.bats` (modified, +124/-0)
```diff
@@ -1432,6 +1432,130 @@ detect_progress_with_commits() {
     assert_equal "$asking" "false"
 }
 
+@test "analyze_response does not crash when .last_output_length is zero (regression PR #333: division by zero)" {
+    # Skip if git is not available (analyze_response uses git)
+    if ! command -v git &>/dev/null; then
+        skip "git not available"
+    fi
+
+    git init --quiet
+    git config user.email "test@test.com"
+    git config user.name "Test"
+    echo "init" > init.txt
+    git add init.txt
+    git commit --quiet -m "init"
+
+    source "${BATS_TEST_DIRNAME}/../../lib/response_analyzer.sh"
+    mkdir -p "$RALPH_DIR/logs"
+
+    # Simulate a prior loop that wrote a zero output length
+    # (e.g. an interrupted/crashed agent call that produced no output)
+    echo "0" > "$RALPH_DIR/.last_output_length"
+
+    local output_file="$RALPH_DIR/logs/claude_output_test.log"
+    echo "Implementing feature X. Continuing work on the next steps." > "$output_file"
+
+    run analyze_response "$output_file" 1
+
+    # Before the fix this aborted with "division by 0" mid-execution
+    assert_success
+    [ -f "$RALPH_DIR/.response_analysis" ]
+}
+
+@test "analyze_response does not crash when .last_output_length is empty (regression PR #333)" {
+    # Skip if git is not available (analyze_response uses git)
+    if ! command -v git &>/dev/null; then
+        skip "git not available"
+    fi
+
+    git init --quiet
+    git config user.email "test@test.com"
+    git config user.name "Test"
+    echo "init" > init.txt
+    git add init.txt
+    git commit --quiet -m "init"
+
+    source "${BATS_TEST_DIRNAME}/../../lib/response_analyzer.sh"
+    mkdir -p "$RALPH_DIR/logs"
+
+    # Empty file — fails the ^[0-9]+$ guard; last_length must default without dividing by zero
+    printf '' > "$RALPH_DIR/.last_output_length"
+
+    local output_file="$RALPH_DIR/logs/claude_output_test.log"
+    echo "Implementing feature X. Continuing work on the next steps." > "$output_file"
+
+    run analyze_response "$output_file" 1
+
+    assert_success
+    [ -f "$RALPH_DIR/.response_analysis" ]
+}
+
+@test "analyze_response does not crash when .last_output_length is non-numeric (regression PR #333)" {
+    # Skip if git is not available (analyze_response uses git)
+    if ! command -v git &>/dev/null; then
+        skip "git not available"
+    fi
+
+    git init --quiet
+    git config user.email "test@test.com"
+    git config user.name "Test"
+    echo "init" > init.txt
+    git add init.txt
+    git commit --quiet -m "init"
+
+    source "${BATS_TEST_DIRNAME}/../../lib/response_analyzer.sh"
+    mkdir -p "$RALPH_DIR/logs"
+
+    # Real non-numeric content — exercises the ^[0-9]+$ guard's false branch with a
+    # non-empty value (distinct from the empty-file case above)
+    printf 'not-a-number\n' > "$RALPH_DIR/.last_output_length"
+
+    local output_file="$RALPH_DIR/logs/claude_output_test.log"
+    echo "Implementing feature X. Continuing work on the next steps." > "$output_file"
+
+    run analyze_response "$output_file" 1
+
+    assert_success
+    [ -f "$RALPH_DIR/.response_analysis" ]
+}
+
+@test "analyze_response output-decline heuristic still adds +10 when last length is a valid positive integer (PR #333 criterion 2)" {
+    # Skip if git is not available (analyze_response uses git)
+    if ! command -v git &>/dev/null; then
+        skip "git not available"
+    fi
+
+    git init --quiet
+    git config user.email "test@test.com"
+    git config user.name "Test"
+    echo "init" > init.txt
+    git add init.txt
+    git commit --quiet -m "init"
+
+    source "${BATS_TEST_DIRNAME}/../../lib/response_analyzer.sh"
+    mkdir -p "$RALPH_DIR/logs"
+
+    local output_file="$RALPH_DIR/logs/claude_output_test.log"
+    echo "Implementing feature X. Continuing work on the next steps." > "$output_file"
+
+    # Run A: previous output much larger -> ratio < 50% -> +10 confidence
+    echo "1000" > "$RALPH_DIR/.last_output_length"
+    run analyze_response "$output_file" 1
+    assert_success
+    local score_decline
+    score_decline=$(jq -r '.analysis.confidence_score' "$RALPH_DIR/.response_analysis")
+
+    # Run B: identical output/state, previous length tiny -> ratio >= 50% -> no bonus
+    echo "1" > "$RALPH_DIR/.last_output_length"
+    run analyze_response "$output_file" 2
+    assert_success
+    local score_no_decline
+    score_no_decline=$(jq -r '.analysis.confidence_score' "$RALPH_DIR/.response_analysis")
+
+    # Only the decline bonus differs between the two runs
+    assert_equal "$((score_decline - score_no_decline))" "10"
+}
+
 # --- Stale Exit Signals Tests (Issue #194) ---
 
 @test "startup resets stale exit signals before main loop" {
```

#### Recent Merged Pull Requests:
- **PR #391** (2026-10-25): Review PRs with Kimi K3 (@frankbria)
- **PR #387** (2026-10-10): fix(sandbox): E2B fails fast on RALPH_DIR at the workspace root or outside it (#383) (@frankbria)
- **PR #385** (2026-10-09): fix(monitor): forward explicit env settings to the tmux loop pane (#378) (@frankbria)
- **PR #381** (2026-10-09): fix(sandbox): E2B control-dir guards for nested/trailing-slash RALPH_DIR (#376) (@frankbria)
- **PR #380** (2026-10-09): test(loop): exercise production functions in unit suites (@widechaos)
- **PR #379** (2026-10-08): fix(config): environment beats .ralphrc for CB_* thresholds, exit thresholds and CLAUDE_MIN_VERSION (#369) (@frankbria)

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

## X. security): never evaluate untrusted numbers in bash arithmetic (#371) (#373)

**RULE**:
When implementing operations in `CLAUDE.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in frankbria/ralph-claude-code. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `eefcc3a8`: security): never evaluate untrusted numbers in bash arithmetic (#371) (#373). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Shell data structures, boundary deserialization, API parsing, or resource lifecycles matching `CLAUDE.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```shell
// Verified production-grade fix pattern:
- **int_utils.sh** — `to_int VALUE` (Issue #371): the only safe way to use an untrusted value as a number — base-10 int if `^[0-9]{1,18}$` (surrounding whitespace ignored), else 0, never evaluated. Bash arithmetic (`$((x + 0))`, `[[ $x -ge n ]]`, `((x++))`) evaluates `a[$(cmd)]`, so every number read from `.ralph/` state files (repository-committable: `.call_count`, `.token_count`, `.circuit_breaker_state`, `.e2b_sandbox_state`) or parsed from Claude's output (`files_modified`, `error_count`, `confidence`, and `jq length` results, which can be fractional and would crash bash arithmetic) goes through it. Sourced (with the FATAL guard) by ralph_loop.sh, and by circuit_breaker.sh, response_analyzer.sh and sandbox_e2b.sh
```

**NEGATIVE CONSTRAINT**:
```shell
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `eefcc3a8` are properly handled with clean fallback behavior.

> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/evermind-ai-raven-learnings.md`  
> **Source**: github ([https://github.com/EverMind-AI/Raven](https://github.com/EverMind-AI/Raven))  
> **Source Version**: `a71b488e`  
> **License**: Apache-2.0  
> **Synthesized By**: google-gemini-cloud-agent  
> **Timestamp**: 2026-10-15T19:00:18.330Z  
> **Learning ID**: `learn-github-evermind-ai-raven`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Project Learning Record (Full-Spectrum Forensic Harvest): EverMind-AI/Raven

---

## 1. Executive Forensic Architecture & System Mechanics

### 1.1 The Core Problem Space
EverMind-AI/Raven is an autonomous host harness designed for recursive self-improvement (RSI) and multi-agent coordination. Most autonomous agent frameworks treat task execution as a stateless invocation of LLMs with tools, leading to three fatal production failure modes:
1. **Context Drift and Degradation**: Compounding hallucinations, ungrounded actions, and tool repetition loops (e.g., repeating `web_search` over 100 times without fetching documents).
2. **Subprocess Orphanage and Resource Leaks**: Multi-agent sessions spinning off child processes across OS boundaries (Linux, macOS, Windows, remote SSH nodes) that outlive host crashes and leak memory, CPU, and sockets.
3. **Silent Persistence & State Desynchronization**: Unhandled failures in disk append/undo states, background memory ingestion, or configuration alias resolution resulting in data loss, credential exposure, or sandbox evasion.

Raven resolves this by acting as a **supervisory kernel** that orchestrates specialized sub-agents (`Raven-Code`, `Raven-Research`, `Raven-Design`, `Raven-Oncall`, alongside third-party Agent Client Protocol [ACP], CLI, and OpenAI-compatible instances) using deterministic state machines, process isolation wrappers, and statistical verification gates.

```
                              ┌────────────────────────────────────────────────────────┐
                              │                 Raven Host Supervisor                  │
                              │           (Fast-Path CLI / Web Supervisor)             │
                              └───────────────────────────┬────────────────────────────┘
                                                          │ IPC / RPC (WebSocket / JSON-RPC)
                                                          ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                  Raven Kernel Core                                                   │
│                                                                                                                      │
│   ┌───────────────────────────┐    ┌───────────────────────────┐    ┌────────────────────────────────────────────┐   │
│   │   SessionManager          │    │   PermissionGate          │    │   SubagentManager                          │   │
│   │   - Truncation/Cut Track  │    │   - Lane Resolution       │    │   - DAG Runner (Asyncio Semaphore)         │   │
│   │   - Atomic Replace Journal│    │   - Security Boundaries   │    │   - SandboxFactory Per-Node VM Isolation   │   │
│   └─────────────┬─────────────┘    └─────────────┬─────────────┘    └─────────────────────┬──────────────────────┘   │
└─────────────────┼────────────────────────────────┼────────────────────────────────────────┼──────────────────────────┘
                  │                                │                                        │
                  ▼                                ▼                                        ▼
┌──────────────────────────────────┐ ┌───────────────────────────┐ ┌───────────────────────────────────────────────────┐
│     Persistence & State Store    │ │    Security & Network     │ │             Agent Execution Domains               │
│ - ReadLedger (inode/mtime/stat)  │ │ - Loopback IP Verification │ ├─────────────────────────┬─────────────────────────┤
│ - RoundJournal (fsync checkpoints│ │ - Credential Scrubbing    │ │ Local Processes         │ Remote SSH Machine Node │
│ - StateFacts Grounding Engine    │ │ - Stdin Secret Transport  │ │ - Linux: PR_SET_PDEATHSIG│ - uv / Python daemon   │
│ - EverOS Memory Backend v2 Probe │ │                           │ │ - macOS: kqueue watcher │ - Unix socket runtime   │
│                                  │ │                           │ │ - Windows: JobObject    │ - Stdin-piped index URL │
└──────────────────────────────────┘ └───────────────────────────┘ └─────────────────────────┴─────────────────────────┘
```

### 1.2 Subsystem Decoupling & Boundary Contracts
- **Session Lifecycle (`raven.session.manager`)**: Transcripts are maintained as append-only records with atomic metadata replacements. The engine separates message storage into committed disk offsets (`_persisted_count`) and a truncation generational counter (`_persisted_truncations`) to prevent resurrection of undone turns upon disk write failures.
- **Agent Client Protocol [ACP] Lifecycle (`raven.acp_client`)**: Third-party agent processes run detached in their own session groups. Boundary lifetime is strictly governed via operating system primitives: `PR_SET_PDEATHSIG` on Linux, a double-forked launchd-adopted `kqueue` watcher on macOS, and native Windows Win32 Job Objects configured with `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`.
- **Subagent DAG Orchestration (`raven.agent.subagent`)**: Graph nodes execute via `dag_runner.py`. Every DAG node must instantiate an isolated sandbox VM via an injected `sandbox_factory`. The orchestrator prevents resource starvation using concurrency semaphores while ensuring node failures are isolated and cannot compromise the host environment.
- **RSI Evolution Loop (`evolver.orchestrator`)**: Implements an empirical 7-step funnel (Diagnose $\to$ Design $\to$ Preflight $\to$ Apply $\to$ Screen $\to$ Confirm $\to$ Verdict) governed by paired two-sigma ($2\sigma$) statistical hypothesis testing against frozen cold-start baselines, preventing regressions from entering the production prompt/code base.

---

## 2. Net-New Universal Engineering Rules (Candidates for Master Brain)

### 1. Host-Coupled Process Group Lifetime Invariant
**RULE**:
When an application spawns external long-running child processes in separate process groups or sessions (`start_new_session=True`), it MUST NOT rely solely on graceful application teardown (`SIGTERM`/`close()`). It MUST bind child lifetime to parent kernel lifetime at the OS level: using `PR_SET_PDEATHSIG` on Linux, an adopted `kqueue` `EVFILT_PROC` supervisor on macOS, and an unnamed `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE` Job Object on Windows. On Windows, the child launcher MUST block on `stdin` until the parent has verified Job Object assignment.

**WHY**:
Uncaught crashes, `SIGKILL` (`kill -9`), unhandled exceptions in the event loop, and OOM killer events bypass user-space cleanup hooks (such as `atexit` or `asyncio` finalizers). In multi-agent environments, orphan worker processes remain alive indefinitely (observed in Raven running 22 days consuming 523 MiB PSS), retaining file locks, occupying network ports, and exhausting machine RAM.

**WHEN TO APPLY**:
Any application spawning CLI tools, worker daemons, local LLM inference engines (vLLM, Ollama), or third-party agent sub-processes across Windows, Linux, and macOS.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
# Cross-platform parent-death supervision (Python 3.12+)
import asyncio
import ctypes
import os
import sys

if sys.platform == "win32":
    import subprocess
    _KILL_ON_JOB_CLOSE = 0x2000
    _EXTENDED_LIMIT_INFORMATION = 9
    _PROCESS_SET_QUOTA = 0x0100
    _PROCESS_TERMINATE = 0x0001

    class WindowsJobGuard:
        def __init__(self) -> None:
            self._k32 = ctypes.WinDLL("kernel32", use_last_error=True)
            self.handle = self._k32.CreateJobObjectW(None, None)
            if not self.handle:
                raise ctypes.WinError(ctypes.get_last_error())
            
            # Configure Job Object to terminate all member processes on handle close
            class BasicLimits(ctypes.Structure):
                _fields_ = [
                    ("PerProcessUserTimeLimit", ctypes.c_int64),
                    ("PerJobUserTimeLimit", ctypes.c_int64),
                    ("LimitFlags", ctypes.c_uint32),
                    ("MinimumWorkingSetSize", ctypes.c_size_t),
                    ("MaximumWorkingSetSize", ctypes.c_size_t),
                    ("ActiveProcessLimit", ctypes.c_uint32),
                    ("Affinity", ctypes.c_size_t),
                    ("PriorityClass", ctypes.c_uint32),
                    ("SchedulingClass", ctypes.c_uint32),
                ]

            class ExtendedLimits(ctypes.Structure):
                _fields_ = [
                    ("BasicLimitInformation", BasicLimits),
                    ("IoInfo", ctypes.c_uint64 * 6),
                    ("ProcessMemoryLimit", ctypes.c_size_t),
                    ("JobMemoryLimit", ctypes.c_size_t),
                    ("PeakProcessMemoryUsed", ctypes.c_size_t),
                    ("PeakJobMemoryUsed", ctypes.c_size_t),
                ]

            limits = ExtendedLimits()
            limits.BasicLimitInformation.LimitFlags = _KILL_ON_JOB_CLOSE
            success = self._k32.SetInformationJobObject(
                self.handle, _EXTENDED_LIMIT_INFORMATION,
                ctypes.byref(limits), ctypes.sizeof(limits)
            )
            if not success:
                err = ctypes.WinError(ctypes.get_last_error())
                self.close()
                raise err

        def assign_pid(self, pid: int) -> None:
            h_proc = self._k32.OpenProcess(_PROCESS_SET_QUOTA | _PROCESS_TERMINATE, False, pid)
            if not h_proc:
                raise ctypes.WinError(ctypes.get_last_error())
            try:
                if not self._k32.AssignProcessToJobObject(self.handle, h_proc):
                    raise ctypes.WinError(ctypes.get_last_error())
            finally:
                self._k32.CloseHandle(h_proc)

        def close(self) -> None:
            if self.handle:
                self._k32.CloseHandle(self.handle)
                self.handle = None

    async def launch_guarded_windows(argv: list[str]) -> asyncio.subprocess.Process:
        job = WindowsJobGuard()
        # Small bootstrap script: waits for byte '1' before spawning target process
        launcher_code = (
            "import os, sys, subprocess, ctypes\n"
            "if os.read(0, 1) != b'1': sys.exit(125)\n"
            "p = subprocess.Popen(sys.argv[1:], stdin=sys.stdin, stdout=sys.stdout, stderr=sys.stderr)\n"
            "for fd in (0, 1, 2): os.close(fd)\n"
            "os._exit(ctypes.c_int(p.wait()).value)\n"
        )
        proc = await asyncio.create_subprocess_exec(
            sys.executable, "-c", launcher_code, *argv,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        # Assign launcher to job object BEFORE releasing it to spawn target
        job.assign_pid(proc.pid)
        proc.stdin.write(b"1")
        await proc.stdin.drain()
        return proc

elif sys.platform == "darwin":
    # macOS wrapper: Double forks a daemon watcher that monitors parent exit via kqueue
    _DARWIN_WATCHER = (
        "import os, select, signal, sys\n"
        "host = int(sys.argv[1])\n"
        "if os.getppid() != host: os._exit(1)\n"
        "if os.fork() == 0:\n"
        "    if os.fork() == 0:\n"
        "        os.chdir('/')\n"
        "        for fd in os.listdir('/dev/fd'):\n"
        "            try: os.close(int(fd))\n"
        "            except OSError: pass\n"
        "        kq = select.kqueue()\n"
        "        ke = select.kevent(host, filter=select.EVFILT_PROC, flags=select.EV_ADD, fflags=select.NOTE_EXIT)\n"
        "        kq.control([ke], 0, None)\n"
        "        kq.control(None, 1, None)\n"
        "        try: os.killpg(os.getgid(), signal.SIGKILL)\n"
        "        except OSError: pass\n"
        "        os._exit(0)\n"
        "    os._exit(0)\n"
        "os.wait()\n"
    )
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Spawning process group without kernel lifecycle binding
proc = await asyncio.create_subprocess_exec(
    *argv,
    start_new_session=True,  # Disconnects from host terminal & signals!
    stdout=asyncio.subprocess.PIPE
)
# Fatal: If host encounters kill -9 or OOM, proc lives on as orphan indefinitely.
```

**VERIFICATION METHOD**:
Run an integration test executing a mock child agent with a 120s sleep. Spawn the host subprocess, record the child PID, hard-kill the host process (`os.kill(host.pid, signal.SIGKILL)`), and assert that `_winapi.WaitForSingleObject` or `waitpid(child_pid)` detects child death within 2000ms.

---

### 2. State Truncation Generational Invariant
**RULE**:
When implementing an append-only persistence layer that supports undo, clear, or rollbacks, the storage manager MUST track a distinct `_persisted_truncations` generational counter in addition to message length (`_persisted_count`). A save operation MUST trigger an atomic full-file rewrite whenever the in-memory truncation sequence does not equal the persisted truncation sequence, regardless of whether `len(messages) >= _persisted_count`.

**WHY**:
If an undo or clear operation truncates the in-memory log, and the subsequent disk rewrite fails (e.g., `ENOSPC`, transient I/O error), the disk retains the undone messages while the in-memory model holds the truncated list. If subsequent user turns grow the in-memory list back up to or beyond `_persisted_count`, a naive append-check (`len(messages) > _persisted_count`) will append new turns past the stale disk offset. This permanently resurrects the supposedly deleted turns, corrupts conversational history, and leaks context into future model prompts.

**WHEN TO APPLY**:
All transactional transcript stores, event sourcing frameworks, LLM conversation session managers, and WAL (Write-Ahead Logging) storage layers.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from dataclasses import dataclass, field
import json
from pathlib import Path
from raven.utils.atomic_io import atomic_replace

@dataclass
class SessionState:
    messages: list[dict] = field(default_factory=list)
    truncations: int = 0
    _persisted_count: int = 0
    _persisted_truncations: int = 0

    def undo_last_turn(self) -> int:
        removed = 0
        while self.messages and self.messages[-1].get("role") != "user":
            self.messages.pop()
            removed += 1
        if self.messages:
            self.messages.pop()
            removed += 1
        self.truncations += 1
        return removed

class SessionPersistenceManager:
    def __init__(self, storage_dir: Path):
        self.storage_dir = storage_dir

    def is_dirty(self, session: SessionState) -> bool:
        has_new_messages = len(session.messages) != session._persisted_count
        has_unpersisted_cut = session.truncations != session._persisted_truncations
        return has_new_messages or has_unpersisted_cut

    def save(self, session: SessionState, file_path: Path) -> None:
        has_unpersisted_cut = session.truncations != session._persisted_truncations
        is_shrunk = len(session.messages) < session._persisted_count

        # Invariant: Any truncation since last persistence requires atomic rewrite
        if is_shrunk or has_unpersisted_cut:
            lines = [json.dumps(msg, ensure_ascii=False) for msg in session.messages]
            atomic_replace(file_path, "\n".join(lines) + "\n")
            session._persisted_count = len(session.messages)
            session._persisted_truncations = session.truncations
        elif len(session.messages) > session._persisted_count:
            # Safe append: no cut has intervened
            new_entries = session.messages[session._persisted_count:]
            with file_path.open("a", encoding="utf-8") as f:
                for entry in new_entries:
                    f.write(json.dumps(entry, ensure_ascii=False) + "\n")
            session._persisted_count = len(session.messages)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Naive length check without truncation epoch tracking
def save(self, session, file_path):
    if len(session.messages) < session._persisted_count:
        atomic_rewrite(file_path, session.messages)
    else:
        # BUG: If undo failed previously, and len(session.messages) reaches
        # _persisted_count again, it appends! Stale deleted messages on disk
        # are preserved, and new messages append after them.
        append_to_file(file_path, session.messages[session._persisted_count:])
    session._persisted_count = len(session.messages)
```

**VERIFICATION METHOD**:
Execute a unit test where 2 turns are seeded and persisted. Trigger `undo_last_turn()`. Mock `atomic_replace` to raise `OSError("disk full")`. Catch the error. Add a replacement turn (restoring length to 2). Call `save()` with `atomic_replace` restored. Re-read disk file and assert that deleted turn content is completely absent.

---

### 3. Tool Pagination Progress Invariant for Massive Single Records
**RULE**:
File viewing, transcript reading, or database paging tools that truncate outputs by a character/token budget MUST NOT discard an entire page if a single line or atomic row exceeds that budget. When a single entry exceeds the page budget, the tool MUST emit the prefix head up to the available capacity, output an explicit warning with line-length metadata, and **advance the pagination cursor to the next line/record**.

**WHY**:
When a file contains a single line exceeding the maximum character limit (e.g., a 200,000-character minified JavaScript file, a massive one-line JSON payload, or an oversized CSV row), a naive line-fitting algorithm will fit 0 lines within the budget. Returning an empty page with a footer saying `Use offset=1 to continue` traps the autonomous agent in an **infinite deterministic loop**, repeating `read_file(offset=1)` until context token budgets or iteration limits are exhausted.

**WHEN TO APPLY**:
Any LLM tool reading local or remote files, logs, database queries, or network payloads subject to hard context window boundaries.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
from pathlib import Path
from typing import NamedTuple

class ToolReadResult(NamedTuple):
    content: str
    next_offset: int | None
    is_eof: bool

class SafeFileReader:
    MAX_CHARS_PER_PAGE = 128_000

    def read_page(self, lines: list[str], offset: int, limit: int | None = None) -> ToolReadResult:
        total_lines = len(lines)
        start_idx = max(offset, 1) - 1
        if start_idx >= total_lines:
            return ToolReadResult("End of file", None, True)

        max_lines = limit if limit is not None else total_lines
        end_idx = min(start_idx + max_lines, total_lines)
        
        numbered: list[str] = []
        for i in range(start_idx, end_idx):
            numbered.append(f"{i + 1}| {lines[i]}")

        trimmed: list[str] = []
        accumulated_chars = 0
        for line in numbered:
            line_len = len(line) + 1  # include newline
            if accumulated_chars + line_len > self.MAX_CHARS_PER_PAGE:
                break
            accumulated_chars += line_len
            trimmed.append(line)

        note = ""
        # CRITICAL PROGRESS INVARIANT GUARD:
        if not trimmed:
            # First line exceeds budget by itself. Extract head and advance cursor.
            prefix = f"{start_idx + 1}| "
            room = max(self.MAX_CHARS_PER_PAGE - len(prefix), 0)
            target_line = lines[start_idx]
            trimmed = [prefix + target_line[:room]]
            
            note = (
                f"\n\n(Line {start_idx + 1} is {len(target_line)} chars long; "
                f"first {room} chars shown. offset moves by lines and cannot reach "
                f"the remainder: use grep or byte-offset commands to inspect.)"
            )
            # Advance past this gigantic line!
            end_idx = start_idx + 1
        else:
            end_idx = start_idx + len(trimmed)

        body = "\n".join(trimmed) + note
        if end_idx < total_lines:
            footer = f"\n\n(Showing lines {offset}-{end_idx} of {total_lines}. Use offset={end_idx + 1} to continue.)"
            return ToolReadResult(body + footer, end_idx + 1, False)
        else:
            footer = f"\n\n(End of file — {total_lines} lines total)"
            return ToolReadResult(body + footer, None, True)
```

**NEGATIVE CONSTRAINT**:
```python
# ANTI-PATTERN: Trimming lines within budget without empty-fallback guard
trimmed, chars = [], 0
for line in numbered:
    if chars + len(line) > MAX_CHARS:
        break
    trimmed.append(line)
    chars += len(line)

# If first line > MAX_CHARS, trimmed is []!
end = start + len(trimmed)  # end == start!
result = "\n".join(trimmed)
# Emits: "(Showing lines 1-0 of 1. Use offset=1 to continue.)" -> INFINITE LOOP
```

**VERIFICATION METHOD**:
Construct a test fixture file with one line containing 200,000 `"x"` characters followed by a newline and `"second line"`. Invoke the reader with `offset=1`. Assert that:
1. `trimmed` is non-empty and starts with `1| xxxx`.
2. The pagination continuation instructs `Use offset=2 to continue.` (proving the cursor moved past line 1).

---

## 3. Forensic Real Incidents & Production Patches

### Incident 1: Infinite Paging Loop on Oversized Single-Line Files (BUG-RAVEN-01)
- **Context**: `agents/raven-code/plugins/code-flow/code_flow/tools/filesystem.py` & `raven/agent/tools/filesystem.py`
- **What Was Expected**: Reading a file with `read_file` cuts lines within a 128k character budget and cleanly paginates to subsequent lines via `offset`.
- **What Actually Happened**: When reading a file whose first line exceeded the character budget (such as a 200k-character minified JavaScript file or a single-line JSON dump), the budget calculation added 0 lines. The return body was completely empty, and the footer instructed the model to retry: `(Showing lines 1-0 of 1. Use offset=1 to continue.)`. Autonomous agents parsed this advice and repeatedly invoked `read_file(offset=1)`, spinning indefinitely.
- **Evidence in Repo**: Commit `b2ae7f75`, PR #959, verified in `tests/test_filesystem_tools.py::test_a_line_longer_than_a_page_shows_its_head_and_says_how_to_see_the_rest`.
- **Root Cause**: `len(result) > self._MAX_CHARS` broke the line accumulator before the first line was appended (`trimmed` remained empty). Consequently, `end = start + len(trimmed)` evaluated to `end = start`, causing the continuation offset calculation `end + 1` to land on `start + 1 = 1`.
- **Remediation Code Diff**:
```python
<<<< PREVIOUS (BUGGY):
            if len(result) > self._MAX_CHARS:
                trimmed, chars = [], 0
                for line in numbered:
                    chars += len(line) + 1
                    if chars > self._MAX_CHARS:
                        break
                    trimmed.append(line)
                end = start + len(trimmed)
                result = "\n".join(trimmed)
==== FIXED (SAFE INVARIANT):
            note = ""
            if len(result) > self._MAX_CHARS:
                trimmed, chars = [], 0
                for line in numbered:
                    chars += len(line) + 1
                    if chars > self._MAX_CHARS:
                        break
                    trimmed.append(line)
                if not trimmed:
                    prefix = f"{start + 1}| "
                    room = max(self._MAX_CHARS - len(prefix), 0)
                    trimmed = [prefix + lines[0][:room]]
                    if len(lines[0]) > room:
                        note = (
                            f"\n\n(Line {start + 1} is {len(lines[0])} characters long; the first {room} are shown. "
                            "offset moves by lines and cannot reach the rest of it: grep tells whether a piece is "
                            "in it, and a shell command that cuts by bytes, such as cut -c, shows another stretch.)"
                        )
                end = start + len(trimmed)
                result = "\n".join(trimmed) + note
>>>>
```
- **Lesson**: Paging cursors must guarantee strictly monotonic progress ($offset_{k+1} > offset_k$). If a single record overruns the window, yield a truncated record and advance the index.

---

### Incident 2: Credential Leakage via `/proc/<pid>/cmdline` and SSH Argv During Node Setup (BUG-RAVEN-02)
- **Context**: `raven/node/install.py`
- **What Was Expected**: Node installation on remote machines reads pip's configured index URL and configures `uv pip install` inside the virtualenv.
- **What Actually Happened**: The installer constructed commands with `--default-index <url>`. Pip repositories often contain inline credentials (e.g., `https://user:password@mirror.internal/simple`). This URL was passed directly on the CLI command line: across the local machine's `ssh` argv, remote `sh -c` argv, and `uv`'s argv. Because `/proc/<pid>/cmdline` is world-readable on Linux to any user on the system, plaintext credentials were exposed to unprivileged users.
- **Evidence in Repo**: Commit `d1
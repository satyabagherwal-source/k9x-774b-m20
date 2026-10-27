> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/svnscha-mcp-windbg-learnings.md`  
> **Source**: github ([https://github.com/svnscha/mcp-windbg](https://github.com/svnscha/mcp-windbg))  
> **Source Version**: `c62c27e5`  
> **License**: MIT  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T14:53:55.942Z  
> **Learning ID**: `learn-github-svnscha-mcp-windbg`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): svnscha/mcp-windbg

> **Canonical Artifact**: `07_PROJECT_LEARNING/svnscha-mcp-windbg-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/svnscha/mcp-windbg](https://github.com/svnscha/mcp-windbg))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T14:53:54.559Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `svnscha/mcp-windbg`
- **Description**: Model Context Protocol for WinDbg.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1633 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/complex-struct-nullptr.cpp`
```
// complex-struct-nullptr.cpp
#include <iostream>
#include <cstring>
#include <ctime>
#include <string>

struct Address {
    char street[32];
    char city[16];
    int zip;
};

struct Metadata {
    time_t created;
    int version;
    char tag[8];
};

struct UserProfile {
    int id;
    char name[32];
    Address address;
    Metadata meta;
    double balance;
    int* preferences = nullptr;
    size_t pref_count;
    char* notes = nullptr;
};

void print_profile(const UserProfile* profile) {
    std::cout << "ID: " << profile->id << "\n";
    std::cout << "Name: " << profile->name << "\n";
    std::cout << "Address: " << profile->address.street << ", " << profile->address.city << ", " << profile->address.zip << "\n";
    std::cout << "Created: " << std::ctime(&profile->meta.created);
    std::cout << "Version: " << profile->meta.version << ", Tag: " << profile->meta.tag << "\n";
    std::cout << "Balance: $" << profile->balance << "\n";
    std::cout << "Preferences: ";
    for (size_t i = 0; i < profile->pref_count; ++i) {
        std::cout << profile->preferences[i] << " ";
    }
    std::cout << "\nNotes: " << profile->notes << "\n";
}

int main() {
    UserProfile* user = new UserProfile();
    user->id = 42;
    strcpy(user->name, "Ada Lovelace");
    strcpy(user->address.street, "123 Computing Ave");
    strcpy(user->address.city, "London");
    user->address.zip = 12345;
    user->meta.created = std::time(nullptr);
    user->meta.version = 1;
    strcpy(user->meta.tag, "alpha");
    user->balance = 1234.56;
    user->pref_count = 3;
    user->preferences = new int[user->pref_count]{1, 2, 3};
    print_profile(user);
    delete[] user->preferences;
    delete user;
    return 0;
}

```

### Core Architecture Module: `examples/divide-by-zero.cpp`
```
// divide-by-zero.cpp
#include <iostream>

int main()
{
    int a = 1;
    int b = 0;
    int c = a / b;
    std::cout << c << std::endl;
    return 0;
}

```

### Core Architecture Module: `examples/heap-buffer-overflow.cpp`
```
// heap-buffer-overflow.cpp
#include <cstring>

int main()
{
    char *buf = new char[8];
    memset(buf, 'A', 16);
    delete[] buf;
    return 0;
}

```

### Core Architecture Module: `examples/invalid-free.cpp`
```
// invalid-free.cpp
#include <cstdlib>

int main()
{
    int a;
    free(&a);
    return 0;
}

```

### Core Architecture Module: `examples/nullptr-dereference.cpp`
```
// nullptr-dereference.cpp
#include <iostream>

int main()
{
    int *ptr = nullptr;
    int value = *ptr;
    std::cout << value << std::endl;
    return 0;
}

```

### Core Architecture Module: `scripts/validate-server-schema.py`
```
#!/usr/bin/env python3
"""
Validates server.json against the MCP server schema.

This script:
1. Reads server.json and extracts the $schema URL
2. Downloads the JSON schema from the URL
3. Validates server.json against the schema
4. Reports any validation errors

Usage:
    uv run scripts/validate-server-schema.py
    python scripts/validate-server-schema.py
"""

import json
import sys
import urllib.request
from pathlib import Path


def main() -> int:
    """Main entry point for schema validation."""
    # Find server.json in the repository root
    script_dir = Path(__file__).parent
    repo_root = script_dir.parent
    server_json_path = repo_root / "server.json"

    if not server_json_path.exists():
        print(f"ERROR: server.json not found at {server_json_path}", file=sys.stderr)
        return 1

    print(f"Validating {server_json_path}...")

    # Load server.json
    try:
        with open(server_json_path, "r", encoding="utf-8") as f:
            server_data = json.load(f)
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in server.json: {e}", file=sys.stderr)
        return 1

    # Extract schema URL
    schema_url = server_data.get("$schema")
    if not schema_url:
        print("ERROR: No $schema field found in server.json", file=sys.stderr)
        return 1

    print(f"Schema URL: {schema_url}")

    # Download the schema
    print("Downloading schema...")
    try:
        with urllib.request.urlopen(schema_url, timeout=30) as response:
            schema_data = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as e:
        print(f"ERROR: Failed to download schema: {e}", file=sys.stderr)
        return 1
    except json.JSONDecodeError as e:
        print(f"ERROR: Invalid JSON in schema: {e}", file=sys.stderr)
        return 1

    print("Schema downloaded successfully")

    # Try to import jsonschema for validation
    try:
        import jsonschema
        from jsonschema import Draft7Validator, ValidationError
    except ImportError:
        print(
            "WARNING: jsonschema not installed, performing basic structural validation only",
            file=sys.stderr,
        )
        return validate_basic(server_data)

    # Validate against schema
    print("Validating against schema...")
    validator = Draft7Validator(schema_data)
    errors = list(validator.iter_errors(server_data))

    if errors:
        print(f"\nERROR: Schema validation failed with {len(errors)} error(s):\n", file=sys.stderr)
        for i, error in enumerate(errors, 1):
            path = " -> ".join(str(p) for p in error.absolute_path) or "(root)"
            print(f"  {i}. Path: {path}", file=sys.stderr)
            print(f"     Message: {error.message}", file=sys.stderr)
            print(file=sys.stderr)
        return 1

    print("\n[OK] server.json is valid against the MCP server schema")
    return 0


def validate_basic(server_data: dict) -> int:
    """Perform basic structural validation without jsonschema library."""
    errors = []

    # Check required fields
    required_fields = ["name", "description", "version"]
    for field in required_fields:
        if field not in server_data:
            errors.append(f"Missing required field: {field}")

    # Check name format (reverse-DNS with one slash)
    name = server_data.get("name", "")
    if name and "/" not in name:
        errors.append(f"Name '{name}' should be in reverse-DNS format with a slash (e.g., 'io.github.user/project')")

    # Check packages array
    packages = server_data.get("packages", [])
    if not isinstance(packages, list):
        errors.append("'packages' should be an array")
    else:
        for i, pkg in enumerate(packages):
            if not isinstance(pkg, dict):
                errors.append(f"Package {i} should be an object")
                continue

            pkg_required = ["registryType", "identifier", "transport"]
            for field in pkg_required:
                if field not in pkg:
                    errors.append(f"Package {i} missing required field: {field}")

            transport = pkg.get("transport", {})
            if isinstance(transport, dict):
                transport_type = transport.get("type")
                if transport_type not in ["stdio", "streamable-http", "sse"]:
                    errors.append(f"Package {i} has invalid transport type: {transport_type}")

                # streamable-http requires url
                if transport_type == "streamable-http" and "url" not in transport:
                    errors.append(f"Package {i} with streamable-http transport requires 'url' field")

    if errors:
        print(f"\nERROR: Basic validation failed with {len(errors)} error(s):\n", file=sys.stderr)
        for i, error in enumerate(errors, 1):
            print(f"  {i}. {error}", file=sys.stderr)
        return 1

    print("\n[OK] server.json passes basic structural validation")
    print("  (Install 'jsonschema' for full schema validation)")
    return 0


if __name__ == "__main__":
    sys.exit(main())

```

### Core Architecture Module: `src/mcp_windbg/__init__.py`
```
import os

from .server import serve, serve_http

INIT_COMMANDS_ENV = "MCP_WINDBG_INIT_COMMANDS"
KERNEL_INIT_COMMANDS_ENV = "MCP_WINDBG_KERNEL_INIT_COMMANDS"


def _resolve_init_commands(cli_commands, env_name=INIT_COMMANDS_ENV, environ=os.environ):
    """CLI flags win; otherwise the environment variable, one command per line."""
    if cli_commands:
        return cli_commands
    lines = environ.get(env_name, "").splitlines()
    return [line.strip() for line in lines if line.strip()]


def main():
    """MCP WinDbg Server - Windows crash dump analysis functionality for MCP"""
    import argparse
    import asyncio

    parser = argparse.ArgumentParser(
        description="Give a model the ability to analyze Windows crash dumps with WinDbg/CDB"
    )
    parser.add_argument("--cdb-path", type=str, help="Custom path to cdb.exe")
    parser.add_argument("--kd-path", type=str, help="Custom path to kd.exe (kernel debugging)")
    parser.add_argument("--symbols-path", type=str, help="Custom symbols path")
    parser.add_argument("--filter-script", type=str, help="Path to a Python script with process_input/process_output tool text hooks")
    parser.add_argument("--timeout", type=int, default=60, help="Baseline command/connect timeout in seconds (floor for per-tool defaults)")
    parser.add_argument("--verbose", action="store_true",
                        help="Log debugger traffic and server diagnostics to stderr")
    parser.add_argument("--no-dump-dir-symbols", action="store_true",
                        help="Disable automatic inclusion of the dump file's directory in the symbol search path")
    parser.add_argument("--init-command", action="append", metavar="COMMAND",
                        help="Debugger command to run on every new session before triage, e.g. "
                             "'.load C:\\ext\\my.dll'. Repeatable. Defaults to the lines of "
                             f"{INIT_COMMANDS_ENV}")
    parser.add_argument("--kernel-init-command", action="append", metavar="COMMAND",
                        help="Like --init-command, but only for kernel targets (kd sessions and "
                             "kernel dumps). Repeatable. Defaults to the lines of "
                             f"{KERNEL_INIT_COMMANDS_ENV}")
    parser.add_argument("--log-dir", type=str, metavar="DIR",
                        help="Write every line each debugger session prints to DIR/<session_id>.log, "
                             "unfiltered, for read_debugger_log. Off by default")

    # Transport options
    parser.add_argument(
        "--transport",
        type=str,
        choices=["stdio", "streamable-http"],
        default="stdio",
        help="Transport protocol to use (default: stdio)"
    )
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to bind HTTP server to (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8000, help="Port to bind HTTP server to (default: 8000)")

    args = parser.parse_args()

    if args.verbose:
        # Without this there is no handler at all, so every logger.info in the
        # server and in a --filter-script was discarded and --verbose only ever
        # reached the debugger traffic. stderr, because on the stdio transport
        # stdout carries the JSON-RPC stream and nothing else may go there.
        import logging
        import sys

        logging.basicConfig(
            stream=sys.stderr,
            level=logging.INFO,
            format="%(levelname)s %(name)s: %(message)s",
        )

    auto_dump_dir_symbols = not args.no_dump_dir_symbols
    init_commands = _resolve_init_commands(args.init_command)
    kernel_init_commands = _resolve_init_commands(args.kernel_init_command, KERNEL_INIT_COMMANDS_ENV)

    if args.transport == "stdio":
        asyncio.run(serve(
            cdb_path=args.cdb_path,
            kd_path=args.kd_path,
            symbols_path=args.symbols_path,
            filter_script=args.filter_script,
            timeout=args.timeout,
            verbose=args.verbose,
            auto_dump_dir_symbols=auto_dump_dir_symbols,
            init_commands=init_commands,
            kernel_init_commands=kernel_init_commands,
            log_dir=args.log_dir,
        ))
    else:  # pragma: no cover - HTTP transport is verified behaviorally (http_transport.yaml), not line-counted
        asyncio.run(serve_http(
            host=args.host,
            port=args.port,
            cdb_path=args.cdb_path,
            kd_path=args.kd_path,
            symbols_path=args.symbols_path,
            filter_script=args.filter_script,
            timeout=args.timeout,
            verbose=args.verbose,
            auto_dump_dir_symbols=auto_dump_dir_symbols,
            init_commands=init_commands,
            kernel_init_commands=kernel_init_commands,
            log_dir=args.log_dir,
        ))


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `src/mcp_windbg/__main__.py`
```
# __main__.py

from mcp_windbg import main

main()

```

### Core Architecture Module: `src/mcp_windbg/cdb_session.py`
```
"""User-mode debugging session driven by ``cdb.exe``.

Handles the two user-mode attach modes:

- a crash **dump** (``-z``), a static target, and
- a user-mode **remote** debug server (``-remote``), a live target.

Kernel debugging lives in :mod:`kd_session` (it needs ``kd.exe`` and a different
connect handshake). The shared subprocess/marker machinery is in
:mod:`debug_session`.
"""

from __future__ import annotations

import os
import threading
from typing import List, Optional

from .debug_session import (
    DebuggerError,
    DebuggerExitedError,
    DebuggerSession,
    build_debugger_args,
    find_executable,
)

# Kept as the public error name for user-mode sessions.
CDBError = DebuggerError

# What a -remote client prints once it is attached to the debug server. It is
# the only thing a connect reliably produces: a stopped target follows it with
# a prompt, a running one with silence. Printed by cdb.exe itself, not dbgeng,
# and unchanged across the 10.0.26100 and 10.0.28000 debuggers.
REMOTE_CONNECTED_BANNER = "Connected to server with"

# How long an attached -remote client gives the target to answer the prompt
# probe before concluding it is running. A stopped target answers in one
# round trip (about 0.1s on localhost); a running one never does, because the
# server is not reading commands while the target has the CPU. Only paid
# after the connect banner, so connection latency does not count against it.
REMOTE_PROMPT_PROBE_TIMEOUT = 2

# Default paths where cdb.exe might be located.
DEFAULT_CDB_PATHS = [
    # Traditional Windows SDK locations
    r"C:\Program Files (x86)\Windows Kits\10\Debuggers\x64\cdb.exe",
    r"C:\Program Files (x86)\Windows Kits\10\Debuggers\x86\cdb.exe",
    r"C:\Program Files\Debugging Tools for Windows (x64)\cdb.exe",
    r"C:\Program Files\Debugging Tools for Windows (x86)\cdb.exe",

    # Microsoft Store WinDbg locations (architecture-specific)
    os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WindowsApps\cdbX64.exe"),
    os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WindowsApps\cdbX86.exe"),
    os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WindowsApps\cdbARM64.exe"),
]


class CDBSession(DebuggerSession):
    """A user-mode ``cdb.exe`` session over a dump or a ``-remote`` server."""

    def __init__(
        self,
        dump_path: Optional[str] = None,
        remote_connection: Optional[str] = None,
        cdb_path: Optional[str] = None,
        symbols_path: Optional[str] = None,
        timeout: int = 60,
        verbose: bool = False,
        additional_args: Optional[List[str]] = None,
        auto_dump_dir_symbols: bool = True,
        session_log_path: Optional[str] = None,
    ):
        """Start a user-mode session.

        Args:
            dump_path: Crash dump to open (``-z``), mutually exclusive with remote.
            remote_connection: User-mode debug server string (``-remote``).
            cdb_path: Custom cdb.exe path; auto-discovered when None.
            symbols_path: Extra symbol search path.
            timeout: Seconds to wait for the debugger to become ready.
            verbose: Echo debugger output for debugging.
            additional_args: Extra cdb.exe arguments.
            auto_dump_dir_symbols: Prepend the dump's directory to the symbol path.
            session_log_path: File to append every debugger output line to.

        Raises:
            CDBError: cdb.exe not found or failed to start / initialize.
            FileNotFoundError: the dump file does not exist.
            ValueError: neither or both attach sources provided.
        """
        provided = [c for c in (dump_path, remote_connection) if c]
        if not provided:
            raise ValueError("Either dump_path or remote_connection must be provided")
        if len(provided) > 1:
            raise ValueError("dump_path and remote_connection are mutually exclusive")

        if dump_path and not os.path.isfile(dump_path):
            raise FileNotFoundError(f"Dump file not found: {dump_path}")

        self.dump_path = dump_path
        self.remote_connection = remote_connection
        self.is_live_session = bool(remote_connection)
        # A -remote client drives a debug engine on the server, so .logopen would
        # open the Unicode log on the server (a path/lifecycle we do not own).
        # The log-output transport is only for sessions whose engine is ours.
        self._engine_is_local = remote_connection is None
        # Set before super().__init__ starts the reader thread, which references it.
        self._connected_event = threading.Event()

        cdb_path = find_executable(DEFAULT_CDB_PATHS, cdb_path)
        if not cdb_path:
            raise CDBError("Could not find cdb.exe. Please provide a valid path.")
        self.cdb_path = cdb_path

        # Auto-include the dump's own directory in the symbol search path.
        if auto_dump_dir_symbols and dump_path:
            dump_dir = os.path.dirname(os.path.abspath(dump_path))
            symbols_path = f"{dump_dir};{symbols_path}" if symbols_path else dump_dir

        launch_args = build_debugger_args(
            cdb_path,
            dump_path=dump_path,
            remote_connection=remote_connection,
            symbols_path=symbols_path,
            additional_args=additional_args,
        )

        super().__init__(
            debugger_path=cdb_path,
            launch_args=launch_args,
            timeout=timeout,
            verbose=verbose,
            session_log_path=session_log_path,
        )

    def _on_output_line(self, line: str) -> None:
        """Notice the remote connect banner (called under the reader lock)."""
        if REMOTE_CONNECTED_BANNER in line:
            self._connected_event.set()

    def _on_debugger_exit(self) -> None:
        self._connected_event.set()

    def _startup(self) -> None:
        """Reach the first prompt, or establish that the target is running.

        A dump answers as soon as cdb has loaded it, so the base probe is the
        whole story. A ``-remote`` client is different: being attached to the
        debug server says nothing about the target, which is running whenever
        the server's operator resumed it before we connected. A running target
        reads no input, so a probe never answers, and waiting the full timeout
        for it reported "initialization timed out" for a session that was
        fine. Instead: wait for the connect banner, which is where connection
        latency belongs, then give the target one short window to answer.
        Silence means it is running, and the session opens in that state. The
        first ordinary command breaks in, exactly as it does after ``g``, and a
        default close resumes it again.
        """
        if not self.is_live_session:
            super()._startup()
            return
        if not self._connected_event.wait(self.timeout):
            self.shutdown()
            raise CDBError("Timed out connecting to the debug server")
        if self._debugger_exited:
            message = self._exited_message(
                "while connecting to the debug server", self._take_output()
            )
            self.shutdown()
            raise DebuggerExitedError(message)
        try:
            self._wait_for_prompt(REMOTE_PROMPT_PROBE_TIMEOUT)
        except DebuggerExitedError:
            self.shutdown()
            raise
        except DebuggerError:
            # The probe's .echo stays queued at the server and prints when
            # the target next stops; the reader drops it as a stray marker.
            if not self._abandon_marker():
                self._target_running = True
                self._found_running = True
                # What the reader holds is the connect banner and the
                # server's replayed transcript, which a landed probe would
                # have swept away. Drop it the same way, so the break-in
                # reports only why the target stopped.
                with self.lock:
                    if self._reader_buffer is not None:
                        self._reader_buffer.clear()

```

### Core Architecture Module: `src/mcp_windbg/debug_session.py`
```
"""Shared machinery for driving a CDB/KD debugger subprocess.

Both the user-mode debugger (``cdb.exe``, see :mod:`cdb_session`) and the kernel
debugger (``kd.exe``, see :mod:`kd_session`) talk to their process the same way:
launch it on a pipe, read its stdout on a background thread, and detect when a
command has finished by echoing a unique marker after it. That protocol lives
here once; the two session types only differ in how they are launched and how
they reach their first prompt.

Two robustness properties this base guarantees:

- **Per-command markers.** Every command echoes ``COMMAND_COMPLETED_MARKER_<n>``
  with a monotonic ``<n>``. The reader only completes on the marker the current
  command is waiting for, so a slow command whose output arrives late can never
  be mistaken for the next command's completion.
- **Cancel-on-timeout.** When a command outruns its timeout the debugger is
  still busy executing it, on a live target and on a static dump alike: a
  ``!process 0 7`` over a kernel dump runs for minutes, and every command sent
  after it queues behind it. We send CTRL+BREAK to cancel it, drain to the
  pending marker, and only then report the timeout, leaving the session
  resynchronized instead of wedged. If the cancel does not resync, the session
  has lost its place in the output and is closed rather than left to return one
  command's output as another's.
- **Go-class commands do not use the marker at all.** ``g`` and its relatives
  hand the CPU back to the target, and the debugger stops reading stdin until
  the target stops again. Marking them would queue an ``.echo`` the debugger
  cannot answer, so the command would "time out" and the resulting CTRL+BREAK
  would halt the target we just released. They are written bare instead, and
  ``wait_for_break`` picks up whatever the target prints when it does stop.
- **Exit is noticed, not timed out.** When the debugger process exits (``q``, a
  failed ``-remote``/``-k`` connect, cdb itself crashing), the reader sees EOF
  and wakes whoever is waiting, who reports the exit status and the debugger's
  last output instead of sitting out the timeout and blaming the command.
"""

from __future__ import annotations

import locale
import os
import re
import signal
import subprocess
import tempfile
import sys
import threading
import time
import uuid
from typing import List, Optional

# Detects a CDB/KD prompt line such as ``0:000>`` or ``3: kd>``.
PROMPT_REGEX = re.compile(r"^\d+:.*>\s*$")

# Base text of the per-command completion marker. A per-session random nonce and
# a monotonic sequence number are appended, so each command waits for a marker
# that is distinct both within this session and across any other client sharing
# the same debug server.
MARKER_BASE = "COMMAND_COMPLETED_MARKER"

# How long a tree kill may take before shutdown gives up on it and moves on.
TERMINATE_TIMEOUT = 10

# What a single command may retain. A runaway command can print without
# end, and the reader kept every line: MAX_PARTIAL_OUTPUT_* only ever
# bounded the diagnostic snapshot, not the output actually stored. The
# transport keeps being drained past these, so markers still land.
MAX_RETAINED_LINES = 2000
MAX_RETAINED_LINE_CHARS = 16384

# Where a session log stops growing. A noisy kernel target prints without
# end, and the log is meant to be read back, so it ends with a notice here
# rather than filling the disk.
MAX_SESSION_LOG_CHARS = 64 * 1024 * 1024

# How many abandoned markers to remember for the Unicode log. One whose
# command never answers stays at the head, so without a bound the list would
# grow with every timeout; past this the oldest is dropped and its segment is
# left for the ordinary marker search to step over.
MAX_ABANDONED_LOG_MARKERS = 8

# A runaway debugger command can produce output indefinitely. Keep timeout
# diagnostics useful without turning the error itself into another unbounded
# response.
MAX_PARTIAL_OUTPUT_LINES = 2000
MAX_PARTIAL_OUTPUT_CHARS = 64 * 1024

# How long ``wait_for_break`` blocks by default. Waiting on a resumed target is
# open-ended by nature - you are waiting for a bugcheck or a breakpoint - so this
# is deliberately unrelated to the per-command timeout.
DEFAULT_WAIT_FOR_BREAK_TIMEOUT = 300

# How long _break_in_and_resync waits for a target it believes is running to
# answer on its own before resorting to CTRL+BREAK. Only ever paid after a
# go-class command, and only when the target really is still going.
BREAK_IN_PROBE_TIMEOUT = 2

# How long a go-class command waits to see whether the debugger consumed it.
# Until it has, the debugger is still sitting at its prompt with our ``g`` in
# its input queue, and a CTRL+BREAK meant for the running target is answered by
# that prompt instead - the break is swallowed and whoever sent it then waits
# out a full timeout on a target nothing is going to stop. Reporting the resume
# only once it has demonstrably taken effect closes that window. Measured
# against a live KDNET target the debugger consumes it within ~50ms; the rest is
# headroom for a loaded link.
RESUME_CONFIRM_TIMEOUT = 0.5

# How long a closing -remote client lets a ``g`` reach the server before it
# exits with CTRL+B. The client quits on CTRL+B at once, dropping a ``g`` still
# in its input: measured against cdb 10.0.28000 on localhost, a ``g`` written
# together with CTRL+B was lost, while 0.2s was enough. The rest is headroom
# for a remote link.
REMOTE_RESUME_SETTLE = 1.0

# How many of the debugger's final output lines an exit error carries.
_EXIT_TAIL_LINES = 20


class DebuggerError(Exception):
    """Raised for any debugger session failure (launch, timeout, I/O)."""

    def __init__(self, message: str, *, partial_output: Optional[List[str]] = None):
        super().__init__(message)
        self.partial_output = list(partial_output or [])


class DebuggerExitedError(DebuggerError):
    """The debugger process exited; the session cannot be used again."""


class _ReleaseOnExit:
    """Context manager that releases an already-acquired lock on exit."""

    def __init__(self, lock):
        self._lock = lock

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        self._lock.release()
        return False


def build_debugger_args(
    debugger_path: str,
    dump_path: Optional[str] = None,
    remote_connection: Optional[str] = None,
    kernel_connection: Optional[str] = None,
    symbols_path: Optional[str] = None,
    additional_args: Optional[List[str]] = None,
) -> List[str]:
    """Assemble the debugger command line for a session.

    Exactly one of ``dump_path``, ``remote_connection``, or ``kernel_connection``
    selects how the debugger attaches:

    - ``dump_path`` opens a crash dump with ``-z``.
    - ``remote_connection`` attaches a user-mode debugger *client* to an existing
      debug *server* with ``-remote`` (e.g. ``tcp:Port=5005,Server=host``).
    - ``kernel_connection`` attaches to a kernel target with ``-k`` (KDNET
      ``net:port=,key=``, named pipe ``com:pipe,port=\\\\.\\pipe\\name,...``, or
      serial ``com:port=COM1,baud=115200``).

    ``-remote`` and ``-k`` are different mechanisms: ``-remote`` cannot drive a
    kernel cable and ``-k`` cannot drive a user-mode debug server.
    """
    args = [debugger_path]

    if dump_path:
        args.extend(["-z", dump_path])
    elif remote_connection:
        args.extend(["-remote", remote_connection])
    elif kernel_connection:
        args.extend(["-k", kernel_connection])

    if symbols_path:
        args.extend(["-y", symbols_path])

    if additional_args:
        args.extend(additional_args)

    return args


def find_executable(paths: List[str], custom_path: Optional[str] = None) -> Optional[str]:
    """Return the first existing path (custom first, then the defaults)."""
    if custom_path and os.path.isfile(custom_path):
        return custom_path
    for path in paths:
        if os.path.isfile(path):
            return path
    return None


def _debugger_output_encoding() -> str:
    """The code page cdb/kd write their output in - the process ANSI code page,
    which ``locale.getencoding`` reports (``getpreferredencoding`` on 3.10)."""
    if hasattr(locale, "getencoding"):
        return locale.getencoding()
    return locale.getpreferredencoding(False)


# A prompt at the head of a logged line: ``0:000> ``, ``0: kd> ``, ``1:001:x86> ``,
# the local-kernel ``lkd> ``/``kd> `` forms, and the remote form that carries a
# ``[server (tcp ...)]`` banner first. In the Unicode log these prefix the
# command echo and the .echo marker line; the debugger's own output lines never
# start with one.
_LOGGED_PROMPT = re.compile(r"^(?:\[.*\]\s*)?(?:\d+:[^>]*|l?kd)>")


def _acp_is_multibyte() -> bool:
    """True when this machine's ANSI code page is multibyte (DBCS or UTF-8).

    That is exactly when the debugger truncates its text output over a pipe, so
    it is the gate for reading output from the Unicode log instead. Uses
    ``GetCPInfo(GetACP()).MaxCharSize`` - 1 for a single-byte page such as
    Western 1252, greater for 932/936/949/950/65001. False where the call is
    unavailable, so a single-byte or non-Windows host keeps the pipe path.
    """
    try:
        import ctypes

        class _CPINFO(ctypes.Structure):
            _fields_ = [
                ("MaxCharSize", ctypes.c_uint),
                ("DefaultChar", ctypes.c_char * 2),
                ("LeadByte", ctypes.c_char * 12),
            ]

        kernel32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
        info = _CPINFO()
        if kernel32.GetCPInfo(kernel32.GetACP(), ctypes.byref(info)):
            return info.MaxCharSize > 1
    except Exception:
        pass
    return False


def _extract_log_output(segment: str) -> List[str]:
    """The debugger's own output lines from one command's Unicode-log segment.

    The segment runs from just after the previous command's marker up to (not
    including) the li
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #102** (2026-09-05): **du command returns empty output via run_cdb_command, while direct CDB shows the Unicode string**
  *Symptoms*: # `du` returns empty output via `run_cdb_command`, while direct CDB displays the Unicode string  ## Environment  * mcp-windbg: 1.2.1 * mcp: 2.1.1 * Python: 3.12.7 * Windows * Transport: stdio * Debugger: CDB * Session type: crash dump  ## Problem  When running the WinDbg/CDB `du` command through `mcp-windbg` using `run_cdb_command`, the tool call completes successfully but returns an empty result.  Running `db` and `dw` against the same address works correctly.  Running the same `du` command directly in CDB also displays the expected Unicode string.  ## Reproduction  Using the same MCP CDB session and the same valid memory address:  ### `db`  Command:  ```text db <address> L20 ```  Result:  ```text <non-empty memory output> ```  `db` returns valid memory contents.  ### `dw`  Command:  ```text dw <address> L20 ```  Result:  ```text <non-empty UTF-16 word output> ```  `dw` also returns valid memory contents.  ### `du`  Command:  ```text du <address> L20 ```  Result returned by `mcp-windbg`:  ```text <empty> ```  The tool call itself succeeds and does not time out.  ## Expected behavior  `run_cdb_command` should return the text produced by CDB's `du` command.  When the same command is executed directly in CDB:  ```text du <address> L20 ```  CDB displays the expected Unicode string correctly.  ## Additional observation  The memory contents are valid and readable, as confirmed by both `db` and `dw`.  This appears to be specific to how `mcp-windbg` captures, decodes, parses, or fil
  **Post-Mortem & Fix Analysis**:
  > Thank you for reporting this. I'll look into this.
  > Fixed in v1.2.2, just published to PyPI. On a multibyte system code page (936/932/949, or the "Use Unicode UTF-8" setting) the server now reads command output from a UTF-16 log, so `du` and other Unicode output come back complete; upgrade with `pip install -U mcp-windbg`, or if you use the plugin, update it to pick up the new pin.

- **Issue #30** (2026-06-07): **Issue: Early-exit on non-Windows platforms**
  *Symptoms*: Using this MCP on non-Windows platforms can lead to crashes or unexpected error messages from various MCP hosts (e.g., Copilot, Claude Desktop). Improve the behavior by exiting early on Windows, making MCP effectively a “no-op” on unsupported platforms instead of producing an error.

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

### Incident Patch 1: `5bf42133` (2026-09-28)
**Commit Message**: fix(debugger): report debugger process exit instead of timing out (#115)

## What this changes

When the debugger process exits, the session now notices at once and
raises
`DebuggerExitedError` with the exit code and the debugger's last output,
instead
of waiting out the full timeout and then reporting a timeout.

- `debug_session.py`: when the reader thread reaches EOF, it marks the
session as
exited, publishes the last output it collected, and sets `ready_event`
so
waiters wake up. Every marker waiter (`_send_marked`,
`_wait_for_prompt`,
`_wait_for_break_locked`) and every stdin write checks for the exit and
raises
`DebuggerExitedError`, a `DebuggerError` subclass, so the server's
existing
error handling is unchanged. The probes (`_still_running`,
`_resume_took_effect`,
`_break_in_and_resync`) pass this error through rather than treating it
as
"target still running". Once the debugger has exited, `send_command`
fails fast
  and says to close the session and open a new one.
- `kd_session.py`: a new `_on_debugger_exit` hook releases the
connect-banner
wait, so kd exiting before it connects is reported at once with kd's own
  message.
- Nonzero exit codes are shown in hex (e.g. `0xC

**File**: `CHANGELOG.md` (modified, +5/-0)
```diff
@@ -19,6 +19,11 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   output already read, so the timeout error still shows useful diagnostics from
   runaway commands such as SOS `!clrstack`. The retained output is capped at
   2,000 lines and 64 KiB (#112, #114). Thanks to @Oscar-Williams for the fix.
+- A debugger process that exits (`q`, a failed `-remote` or `-k` connect, or
+  cdb/kd crashing) is now reported at once with its exit code and last output,
+  instead of every pending command, `wait_for_break`, or session open sitting out
+  its full timeout and then misreporting a timeout (#115). Thanks to
+  @RamanaIntel for the fix.
 
 ## [1.3.0] - 2026-09-10
 
```

**File**: `src/mcp_windbg/debug_session.py` (modified, +94/-18)
```diff
@@ -24,6 +24,10 @@
   cannot answer, so the command would "time out" and the resulting CTRL+BREAK
   would halt the target we just released. They are written bare instead, and
   ``wait_for_break`` picks up whatever the target prints when it does stop.
+- **Exit is noticed, not timed out.** When the debugger process exits (``q``, a
+  failed ``-remote``/``-k`` connect, cdb itself crashing), the reader sees EOF
+  and wakes whoever is waiting, who reports the exit status and the debugger's
+  last output instead of sitting out the timeout and blaming the command.
 """
 
 from __future__ import annotations
@@ -71,6 +75,9 @@
 # headroom for a loaded link.
 RESUME_CONFIRM_TIMEOUT = 0.5
 
+# How many of the debugger's final output lines an exit error carries.
+_EXIT_TAIL_LINES = 20
+
 
 class DebuggerError(Exception):
     """Raised for any debugger session failure (launch, timeout, I/O)."""
@@ -80,6 +87,10 @@ def __init__(self, message: str, *, partial_output: Optional[List[str]] = None):
         self.partial_output = list(partial_output or [])
 
 
+class DebuggerExitedError(DebuggerError):
+    """The debugger process exited; the session cannot be used again."""
+
+
 class _ReleaseOnExit:
     """Context manager that releases an already-acquired lock on exit."""
 
@@ -260,6 +271,8 @@ def __init__(
         self._target_running = False
         #: Set by shutdown so a parked wait stops rather than outliving the session.
         self._closing = False
+        #: Set by the reader at EOF: the debugger is gone and no marker can land.
+        self._debugger_exited = False
 
         try:
             creationflags = 0
@@ -301,6 +314,9 @@ def _startup(self) -> None:
         """Reach the first usable prompt. Overridden by kernel sessions."""
         try:
             self._wait_for_prompt(self.timeout)
+        except DebuggerExitedError:
+            self.shutdown()
+            raise
         except DebuggerError:
             self.shutdown()
             raise DebuggerError("Debugger initialization timed out")
@@ -309,6 +325,10 @@ def _on_output_line(self, line: str) -> None:
         """Called (under ``self.lock``) for every output line. Kernel uses it
         to notice the ``Connected to target`` banner."""
 
+    def _on_debugger_exit(self) -> None:
+        """Called by the reader once the debugger's output ends. Kernel uses it
+        to stop waiting for a connect banner that can no longer come."""
+
     # -- Reader thread ----------------------------------------------------
 
     def _read_output(self) -> None:
@@ -343,6 +363,55 @@ def _read_output(self) -> None:
         except (IOError, ValueError, AttributeError) as e:
             if self.verbose:
                 print(f"Debugger output reader error: {e}")
+        finally:
+            # Publish what the debugger printed last - often the only record of
+            # why it exited - and wake any waiter rather than let it time out.
+            with self.lock:
+                self._debugger_exited = True
+                self.output_lines = buffer
+            self._on_debugger_exit()
+            self.ready_event.set()
+
+    def _exited_message(self, doing: str, tail: List[str]) -> str:
+        process = self.process
+        code = None
+        if process is not None:
+            try:
+                code = process.wait(timeout=2)
+            except Exception:
+                code = process.poll()
+        if code is None:
+            status = ""
+        elif code == 0:
+            status = " (exit code 0)"
+        else:
+            # Windows exit codes are often NTSTATUS values, e.g. 0xC0000005.
+            status = f" (exit code 0x{code & 0xFFFFFFFF:08X})"
+        message = f"Debugger process exited{status} {doing}."
+        if tail:
+            message += "\nLast debugger output:\n" + "\n".join(tail[-_EXIT_TAIL_LINES:])
+        return message
+
+    def _raise_if_exited(self, doing: str) -> None:
+        """Raise DebuggerExitedError if the debugger exited with the current
+        marker still pending - i.e. it can never land."""
+        with self.lock:
+            if not self._debugger_exited or self._expected_marker is None:
+                return
+            self._expected_marker = None
+            tail, self.output_lines = self.output_lines, []
+        raise DebuggerExitedError(self._exited_message(doing, tail))
+
+    def _write_input(self, text: str, doing: str, failure: str) -> None:
+        """Write to the debugger's stdin, reporting an exit rather than a bare
+        I/O error when the write failed because the process is gone."""
+        try:
+            self.process.stdin.write(text)
+            self.process.stdin.flush()
+        except (IOError, ValueError, AttributeError) as e:
+            self.reader_thread.join(timeout=1)  # let the reader observe EOF
+            self._raise_if_exited(doing)
+            raise DebuggerError(f"{failure}: {e}")
 
     # -- Command protocol ----------------------
```

**File**: `src/mcp_windbg/kd_session.py` (modified, +13/-0)
```diff
@@ -25,6 +25,7 @@
 
 from .debug_session import (
     DebuggerError,
+    DebuggerExitedError,
     DebuggerSession,
     build_debugger_args,
     find_executable,
@@ -122,6 +123,9 @@ def _on_output_line(self, line: str) -> None:
         if any(banner in line for banner in KERNEL_CONNECTED_BANNERS):
             self._connected_event.set()
 
+    def _on_debugger_exit(self) -> None:
+        self._connected_event.set()
+
     def _startup(self) -> None:
         """Wait for the target to connect, break in, then reach the prompt."""
         if not self._connected_event.wait(self.timeout):
@@ -131,6 +135,12 @@ def _startup(self) -> None:
                 "Is the target booted with debugging enabled and transmitting "
                 "on this transport? (kd reports 'no_debuggee' until it is.)"
             )
+        if self._debugger_exited:
+            message = self._exited_message(
+                "before the kernel target connected", self._take_output()
+            )
+            self.shutdown()
+            raise DebuggerExitedError(message)
         # Target is connected but running; break in to reach a prompt.
         try:
             self.process.send_signal(signal.CTRL_BREAK_EVENT)
@@ -139,6 +149,9 @@ def _startup(self) -> None:
             raise KDError(f"Failed to break into the kernel target: {e}")
         try:
             self._wait_for_prompt(self.timeout)
+        except DebuggerExitedError:
+            self.shutdown()
+            raise
         except DebuggerError:
             self.shutdown()
             raise KDError("Kernel debugger did not reach a prompt after break-in")
```

**File**: `src/mcp_windbg/tests/test_debug_session.py` (modified, +84/-3)
```diff
@@ -19,7 +19,7 @@
 import pytest
 
 from mcp_windbg import debug_session
-from mcp_windbg.debug_session import DebuggerError, DebuggerSession
+from mcp_windbg.debug_session import DebuggerError, DebuggerExitedError, DebuggerSession
 
 _STOP = object()
 
@@ -82,6 +82,7 @@ def __init__(
         self.stdout = _FakeStdout(self)
         self._alive = True
         self.pid = 4321
+        self.returncode = 0
         self.signals: list = []
         self.running = False
         self._queued: list = []
@@ -149,8 +150,17 @@ def target_stops(self, *lines: str):
         for line in queued:
             self._handle(line)
 
+    def exit_with(self, *lines: str, code: int = 0):
+        """The debugger prints *lines* and exits on its own - a failed -remote
+        connect, a bad -k string, or cdb itself crashing."""
+        for line in lines:
+            self._out.put(line)
+        self.returncode = code
+        self._alive = False
+        self._out.put(_STOP)
+
     def poll(self):
-        return None if self._alive else 0
+        return None if self._alive else self.returncode
 
     def send_signal(self, sig):
         self.signals.append(sig)
@@ -162,7 +172,7 @@ def terminate(self):
         self._out.put(_STOP)
 
     def wait(self, timeout=None):
-        return 0
+        return self.returncode
 
 
 class _Session(DebuggerSession):
@@ -258,6 +268,77 @@ def test_partial_timeout_output_has_line_and_size_limits(make_session):
     assert lines[-1].startswith("[partial output truncated;")
 
 
+# -- debugger process exit ------------------------------------------------
+#
+# Once cdb/kd exits, no marker can ever arrive. Every waiter used to sit out its
+# full timeout and then blame the command ("timed out"), hiding the real cause.
+
+
+def test_a_command_that_ends_the_debugger_fails_fast_not_on_timeout(make_session):
+    session, _ = make_session(timeout=30)
+    began = time.monotonic()
+    with pytest.raises(DebuggerExitedError) as exc:
+        session.send_command("q")
+    assert time.monotonic() - began < 5
+    assert "exited" in str(exc.value)
+    assert "timed out" not in str(exc.value).lower()
+
+    with pytest.raises(DebuggerExitedError, match="open a new one"):
+        session.send_command("k")
+
+
+def test_a_debugger_crash_mid_command_reports_the_exit_status(make_session):
+    session, proc = make_session(timeout=30)
+    proc._swallow = True  # the command never completes on its own
+    timer = threading.Timer(
+        0.1, lambda: proc.exit_with("[ComMethodFrame: 000000c0]", code=0xC0000005)
+    )
+    timer.start()
+    began = time.monotonic()
+    try:
+        with pytest.raises(DebuggerExitedError) as exc:
+            session.send_command("!clrstack")
+    finally:
+        timer.cancel()
+    assert time.monotonic() - began < 5
+    assert "0xC0000005" in str(exc.value)
+    # What it printed last is often the only clue to why it died.
+    assert "[ComMethodFrame: 000000c0]" in str(exc.value)
+
+
+def test_a_debugger_that_exits_during_startup_reports_its_last_words(monkeypatch):
+    """A mistyped -remote string makes cdb print why and exit at once; the
+    caller should see that, not 'initialization timed out' a minute later."""
+    proc = _FakeProc()
+    proc.exit_with(
+        "Unable to connect to server 'tcp:Port=5005,Server=nohost'",
+        "Win32 error 0n10061",
+        code=1,
+    )
+    monkeypatch.setattr(debug_session.subprocess, "Popen", lambda *a, **k: proc)
+    began = time.monotonic()
+    with pytest.raises(DebuggerExitedError) as exc:
+        _LiveSession(debugger_path="fake", launch_args=["fake"], timeout=30, verbose=False)
+    assert time.monotonic() - began < 5
+    assert "Unable to connect to server" in str(exc.value)
+    assert "initialization timed out" not in str(exc.value)
+
+
+def test_wait_for_break_ends_when_the_debugger_exits(make_session):
+    session, proc = make_session(live=True)
+    session.send_command("g")
+    timer = threading.Timer(0.1, lambda: proc.exit_with("Server went away", code=1))
+    timer.start()
+    began = time.monotonic()
+    try:
+        with pytest.raises(DebuggerExitedError) as exc:
+            session.wait_for_break(timeout=30)
+    finally:
+        timer.cancel()
+    assert time.monotonic() - began < 5
+    assert "Server went away" in str(exc.value)
+
+
 # -- go-class commands ----------------------------------------------------
 #
 # The bug these cover: 'g' hands the CPU to the target, after which the debugger
```

**File**: `src/mcp_windbg/tests/test_kd_session.py` (modified, +26/-3)
```diff
@@ -16,10 +16,12 @@
 import os
 import queue
 import signal
+import time
 
 import pytest
 
 from mcp_windbg import debug_session, kd_session
+from mcp_windbg.debug_session import DebuggerExitedError
 from mcp_windbg.kd_session import KDError, KDSession
 
 _STOP = object()
@@ -67,9 +69,10 @@ class _FakeKd:
     Args:
         connect: emit the ``Connected to target`` banner (as a live target does).
         answer_markers: echo ``.echo <marker>`` back, i.e. reach a prompt.
+        exit_lines: print these and exit at once, as kd does on a bad ``-k``.
     """
 
-    def __init__(self, *, connect: bool = True, answer_markers: bool = True):
+    def __init__(self, *, connect: bool = True, answer_markers: bool = True, exit_lines=None):
         self._out: "queue.Queue" = queue.Queue()
         self._answer_markers = answer_markers
         self.stdin = _FakeStdin(self)
@@ -81,6 +84,10 @@ def __init__(self, *, connect: bool = True, answer_markers: bool = True):
             self._out.put(
                 "Connected to target 172.16.2.189 on port 50005 on local IP 172.16.2.183."
             )
+        if exit_lines:
+            for line in exit_lines:
+                self._out.put(line)
+            self.terminate()
 
     def _feed(self, text: str):
         for line in text.splitlines():
@@ -113,8 +120,8 @@ def launch(monkeypatch):
     procs: list[_FakeKd] = []
     launched: list[list[str]] = []
 
-    def _factory(*, connect=True, answer_markers=True, **kwargs):
-        proc = _FakeKd(connect=connect, answer_markers=answer_markers)
+    def _factory(*, connect=True, answer_markers=True, exit_lines=None, **kwargs):
+        proc = _FakeKd(connect=connect, answer_markers=answer_markers, exit_lines=exit_lines)
         procs.append(proc)
 
         def _popen(args, **_):
@@ -176,6 +183,22 @@ def test_startup_raises_when_prompt_never_arrives_after_break_in(launch):
     assert "did not reach a prompt" in str(exc.value).lower()
 
 
+def test_startup_fails_fast_when_kd_exits_before_connecting(launch):
+    """A bad -k string or a busy KDNET port makes kd print why and exit. That
+    must surface at once, not as a connect timeout that hides kd's message."""
+    factory, _, _ = launch
+    began = time.monotonic()
+    with pytest.raises(DebuggerExitedError) as exc:
+        factory(
+            connect=False,
+            exit_lines=["KDNET: failed to bind to port 50005 - address already in use"],
+            timeout=30,
+        )
+    assert time.monotonic() - began < 5
+    assert "before the kernel target connected" in str(exc.value)
+    assert "failed to bind to port 50005" in str(exc.value)
+
+
 def test_init_without_connection_string_raises():
     with pytest.raises(ValueError, match="kernel_connection must be provided"):
         KDSession(kernel_connection="")
```

---

### Incident Patch 2: `44fbccca` (2026-09-28)
**Commit Message**: fix: keep debugger operations off the request loop (#110)

## What this changes

- Offload synchronous debugger startup, command, and shutdown handlers
to AnyIO workers while preserving tool filtering and MCP error
conversion.
- Keep send_ctrl_break on the request loop so it can interrupt a command
even when that command occupies the only worker slot. Existing
debugger-level I/O synchronization is unchanged.
- Claim a session before blocking shutdown; concurrent closes cannot
shut it down twice or replace the first KD close's resume choice.
- Add nine hermetic tests through the server's public registered tool
handler and an Unreleased changelog entry.

## Why

Fixes #109.

The asynchronous request handler currently calls blocking debugger
operations directly. A waiting command prevents the same server from
dispatching the break-in tool intended to interrupt it. Startup and
shutdown also block unrelated tool calls. The existing wait_for_break
worker dispatch already follows this responsiveness model.

The expanded regression suite fails 7 cases and passes 2 against
unchanged develop at 35b6cdb49dc5e02eee588759a3d038844e5e0307, and
passes all 9 with this patch. This does not change p

**File**: `CHANGELOG.md` (modified, +11/-0)
```diff
@@ -5,6 +5,17 @@ All notable changes to the MCP Server for WinDbg Crash Analysis project will be
 The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
 and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
 
+## [Unreleased]
+
+### Fixed
+
+- Debugger startup, commands, and shutdown run on worker threads so slow I/O
+  does not block other MCP calls. Break-in remains available even when the
+  debugger worker pool is full. Concurrent close calls claim a session once
+  and preserve the closing caller's kernel resume policy. Break-in keeps the
+  validated session record so a concurrent close cannot cause a registry error
+  (#109, #110). Thanks to @adity982 for the fix.
+
 ## [1.3.0] - 2026-09-10
 
 ### Added
```

**File**: `src/mcp_windbg/debug_session.py` (modified, +3/-3)
```diff
@@ -366,9 +366,9 @@ def _abandon_marker(self) -> bool:
     def _exclusive(self):
         """Acquire the session's I/O lock, or explain why the session is busy.
 
-        Never waits. The server calls most tools straight from its event loop,
-        so blocking here would stall every other session too - and would stall
-        the very ``send_ctrl_break`` the failure message points at.
+        Never waits: queued operations on a busy session would occupy debugger
+        workers needed by other sessions. ``send_ctrl_break`` remains available
+        without acquiring this lock.
         """
         if not self._io_lock.acquire(blocking=False):
             raise DebuggerError(
```

**File**: `src/mcp_windbg/server.py` (modified, +33/-21)
```diff
@@ -98,7 +98,7 @@ def _require_session(session_id: str, kind: str):
 
 
 def _require_live_session(session_id: str, what: str):
-    """Return the session for ``session_id``, requiring a live (non-dump) target.
+    """Return the record for ``session_id``, requiring a live (non-dump) target.
 
     Shared by the tools that only make sense against something that runs -
     ``send_ctrl_break`` and ``wait_for_break`` - and accepts either kind, since a
@@ -113,20 +113,25 @@ def _require_live_session(session_id: str, what: str):
                 f"session_id {session_id!r} is a dump session; there is no "
                 f"running target to {what}."
             ))
-    return session
+    return record
 
 
-def _close_session(session_id: str, kind: str) -> bool:
+def _close_session(session_id: str, kind: str, resume: Optional[bool] = None) -> bool:
     """Shut down and forget a session; returns False if id/kind did not match."""
     record = _sessions.get(session_id)
     if record is None or record["kind"] != kind:
         return False
+    # Claim the session before blocking in shutdown. Concurrent close calls must
+    # not shut down the same debugger twice or overwrite its resume policy.
+    record = _sessions.pop(session_id, None)
+    if record is None:
+        return False
+    if resume is not None:
+        record["session"].resume_on_close = resume
     try:
         record["session"].shutdown()
     except Exception:
         pass
-    finally:
-        _sessions.pop(session_id, None)
     return True
 
 
@@ -452,6 +457,11 @@ async def on_call_tool(ctx, params) -> CallToolResult:
         content = await _dispatch_tool(params.name, params.arguments or {})
         return CallToolResult(content=content)
 
+    async def _run_debugger_handler(handler, *args):
+        # Debugger startup, commands, and shutdown can wait for seconds or minutes.
+        # Keep the event loop available for other tools, especially break-in.
+        return await anyio.to_thread.run_sync(functools.partial(handler, *args))
+
     async def _dispatch_tool(name: str, arguments: dict) -> list[TextContent]:
         try:
             call_id = uuid.uuid4().hex
@@ -461,41 +471,43 @@ async def _dispatch_tool(name: str, arguments: dict) -> list[TextContent]:
                 return filter_tool_content(name, _handle_list_dumps(arguments), call_id)
 
             if name == "open_cdb_dump":
-                return filter_tool_content(name, _handle_open_cdb_dump(
+                return filter_tool_content(name, await _run_debugger_handler(_handle_open_cdb_dump,
                     arguments, cdb_path, symbols_path, timeout, verbose, auto_dump_dir_symbols
                 ), call_id)
 
             if name == "open_cdb_remote":
-                return filter_tool_content(name, _handle_open_cdb_remote(
+                return filter_tool_content(name, await _run_debugger_handler(_handle_open_cdb_remote,
                     arguments, cdb_path, symbols_path, timeout, verbose
                 ), call_id)
 
             if name == "open_kd_session":
-                return filter_tool_content(name, _handle_open_kd_session(
+                return filter_tool_content(name, await _run_debugger_handler(_handle_open_kd_session,
                     arguments, kd_path, symbols_path, timeout, verbose
                 ), call_id)
 
             if name == "run_cdb_command":
-                return filter_tool_content(name, _handle_run_command(
+                return filter_tool_content(name, await _run_debugger_handler(_handle_run_command,
                     RunCdbCommand(**arguments), "cdb", CDB_COMMAND_TIMEOUT, timeout
                 ), call_id)
 
             if name == "run_kd_command":
-                return filter_tool_content(name, _handle_run_command(
+                return filter_tool_content(name, await _run_debugger_handler(_handle_run_command,
                     RunKdCommand(**arguments), "kd", KD_COMMAND_TIMEOUT, timeout
                 ), call_id)
 
             if name == "close_cdb_session":
-                return filter_tool_content(name, _handle_close(CloseCdbSession(**arguments).session_id, "cdb"), call_id)
+                return filter_tool_content(name, await _run_debugger_handler(
+                    _handle_close, CloseCdbSession(**arguments).session_id, "cdb"
+                ), call_id)
 
             if name == "close_kd_session":
                 close_args = CloseKdSession(**arguments)
-                record = _sessions.get(close_args.session_id)
-                if record and record["kind"] == "kd":
-                    record["session"].resume_on_close = close_args.resume
-                return filter_tool_content(name, _handle_close(close_args.session_id, "kd"), call_id)
+                return filter_tool_content(name, await _run_debugger_handler(
+                    _handle_close, close_args.session_id, "kd", close_args.resume
+                ), call_id)
 
             if name == "send_
```

**File**: `src/mcp_windbg/tests/test_tool_concurrency.py` (added, +280/-0)
```diff
@@ -0,0 +1,280 @@
+"""The registered tool handler must not block unrelated calls on debugger I/O."""
+
+from __future__ import annotations
+
+import threading
+
+import anyio
+import pytest
+from mcp.types import CallToolRequestParams
+
+from mcp_windbg import server as server_module
+
+
+@pytest.fixture
+def anyio_backend():
+    return "asyncio"
+
+
+@pytest.fixture
+def tool_handler(monkeypatch):
+    captured = {}
+    real_server = server_module.Server
+
+    def record_handlers(*args, **kwargs):
+        captured.update(kwargs)
+        return real_server(*args, **kwargs)
+
+    monkeypatch.setattr(server_module, "Server", record_handlers)
+    monkeypatch.setattr(server_module, "_sessions", {})
+    server_module._create_server()
+    return captured["on_call_tool"]
+
+
+class BlockingSession:
+    is_live_session = True
+
+    def __init__(self):
+        self.started = threading.Event()
+        self.release = threading.Event()
+        self.thread_id = None
+
+    def send_command(self, command, timeout):
+        self.thread_id = threading.get_ident()
+        self.started.set()
+        if not self.release.wait(1):
+            raise RuntimeError("The event loop could not dispatch the break-in")
+        return ["completed"]
+
+    def send_ctrl_break(self):
+        self.release.set()
+
+
+@pytest.mark.anyio
+@pytest.mark.parametrize("kind", ["cdb", "kd"])
+async def test_blocked_command_can_be_interrupted_by_another_tool(tool_handler, kind):
+    session = BlockingSession()
+    server_module._sessions["test-session"] = {
+        "session": session,
+        "kind": kind,
+        "label": "test target",
+    }
+    results = []
+    limiter = anyio.to_thread.current_default_thread_limiter()
+    old_limit = limiter.total_tokens
+    limiter.total_tokens = 1
+
+    async def command():
+        results.append(
+            await tool_handler(
+                None,
+                CallToolRequestParams(
+                    name=f"run_{kind}_command",
+                    arguments={
+                        "session_id": "test-session",
+                        "command": "kb",
+                        "timeout_seconds": 10,
+                    },
+                ),
+            )
+        )
+
+    try:
+        async with anyio.create_task_group() as tasks:
+            tasks.start_soon(command)
+            with anyio.fail_after(2):
+                while not session.started.is_set():
+                    await anyio.sleep(0)
+                interrupted = await tool_handler(
+                    None,
+                    CallToolRequestParams(
+                        name="send_ctrl_break",
+                        arguments={"session_id": "test-session"},
+                    ),
+                )
+                assert "Sent CTRL+BREAK" in interrupted.content[0].text
+    finally:
+        session.release.set()
+        limiter.total_tokens = old_limit
+
+    assert session.thread_id != threading.get_ident()
+    assert "completed" in results[0].content[0].text
+
+
+@pytest.mark.anyio
+@pytest.mark.parametrize("kind", ["cdb", "kd"])
+async def test_command_errors_keep_mcp_error_conversion(tool_handler, kind):
+    class FailingSession:
+        def send_command(self, command, timeout):
+            raise RuntimeError("test command failure")
+
+    server_module._sessions["test-session"] = {
+        "session": FailingSession(),
+        "kind": kind,
+        "label": "test target",
+    }
+    with pytest.raises(server_module.MCPError, match="test command failure"):
+        await tool_handler(
+            None,
+            CallToolRequestParams(
+                name=f"run_{kind}_command",
+                arguments={"session_id": "test-session", "command": "kb"},
+            ),
+        )
+
+
+@pytest.mark.anyio
+@pytest.mark.parametrize(
+    "tool,arguments",
+    [
+        ("open_cdb_dump", {"dump_path": "test.dmp"}),
+        ("open_cdb_remote", {"connection_string": "test remote"}),
+        ("open_kd_session", {"connection_string": "test kernel"}),
+    ],
+)
+async def test_startup_keeps_other_tools_available(
+    tool_handler, monkeypatch, tmp_path, tool, arguments
+):
+    started = threading.Event()
+    release = threading.Event()
+    thread_ids = []
+
+    class StartupSession:
+        def __init__(self, **kwargs):
+            thread_ids.append(threading.get_ident())
+            started.set()
+            if not release.wait(1):
+                raise RuntimeError("Startup blocked the event loop")
+
+        def send_command(self, command, timeout):
+            return ["ready"]
+
+    monkeypatch.setattr(server_module, "CDBSession", StartupSession)
+    monkeypatch.setattr(server_module, "KDSession", StartupSession)
+    results = []
+
+    async def open_session():
+        results.append(
+            await tool_handler(
+                None, CallToolRequestParams(name=tool, arguments=arguments)
+            )
+        )
+
+    try:
+        async with 
```

**File**: `src/mcp_windbg/tests/test_tool_concurrency_live.py` (added, +93/-0)
```diff
@@ -0,0 +1,93 @@
+"""Concurrent tool calls over MCP against a disposable local CDB target."""
+
+from __future__ import annotations
+
+import os
+import re
+import uuid
+
+import anyio
+import pytest
+from mcp.client.session import ClientSession
+from mcp.client.stdio import StdioServerParameters, stdio_client
+from mcp.shared.exceptions import MCPError
+
+from e2e import harness
+
+
+@pytest.fixture
+def anyio_backend():
+    return "asyncio"
+
+
+@pytest.mark.anyio
+@pytest.mark.live
+@pytest.mark.remote
+async def test_break_in_interrupts_command_over_mcp():
+    if not harness.cdb_available():
+        pytest.skip("cdb.exe not found")
+
+    with harness.RemoteCdbServer(
+        target=["waitfor.exe", "McpConcurrencyTestSignal"]
+    ) as remote:
+        command, args = harness.server_command([])
+        params = StdioServerParameters(command=command, args=args, env=dict(os.environ))
+        with anyio.fail_after(60):
+            async with stdio_client(params) as (read_stream, write_stream):
+                async with ClientSession(read_stream, write_stream) as client:
+                    await client.initialize()
+                    opened = await client.call_tool(
+                        "open_cdb_remote",
+                        {"connection_string": remote.connection_string},
+                    )
+                    assert not opened.is_error
+                    session_id = re.search(
+                        r"session_id:\s*(cdb-[0-9a-f]+)", opened.content[0].text
+                    ).group(1)
+                    results = []
+                    marker = "COMMAND_STARTED_" + uuid.uuid4().hex
+
+                    async def run_command():
+                        # A conditional resume waits for the next prompt, unlike
+                        # a bare 'g' which the server deliberately returns from.
+                        results.append(await client.call_tool(
+                            "run_cdb_command",
+                            {
+                                "session_id": session_id,
+                                "command": f".echo {marker}; .if (1) {{ g }}",
+                                "timeout_seconds": 30,
+                            },
+                        ))
+
+                    try:
+                        async with anyio.create_task_group() as tasks:
+                            tasks.start_soon(run_command)
+                            with anyio.fail_after(10):
+                                while not any(
+                                    line.strip() == marker for line in remote.output_lines
+                                ):
+                                    await anyio.sleep(0.01)
+                                # A separate request must finish while the
+                                # command is still waiting on the running target.
+                                await client.list_tools()
+                                assert not results
+                                with pytest.raises(MCPError, match="session is busy"):
+                                    await client.call_tool(
+                                        "run_cdb_command",
+                                        {"session_id": session_id, "command": "r"},
+                                    )
+                                interrupted = await client.call_tool(
+                                    "send_ctrl_break", {"session_id": session_id}
+                                )
+                                assert not interrupted.is_error
+
+                        assert not results[0].is_error
+                        assert "Break instruction exception" in results[0].content[0].text
+                        followup = await client.call_tool(
+                            "run_cdb_command",
+                            {"session_id": session_id, "command": ".echo STILL_USABLE"},
+                        )
+                        assert not followup.is_error
+                        assert "STILL_USABLE" in followup.content[0].text
+                    finally:
+                        await client.call_tool("close_cdb_session", {"session_id": session_id})
```

---

### Incident Patch 3: `c8e23556` (2026-09-28)
**Commit Message**: fix(debugger): preserve output on command timeout (#114)

Fixes #112.

## What this changes

- Preserve the debugger lines already read when a marked CDB command
times out.
- Bound timeout diagnostics to 2,000 lines and 64 KiB, with a truncation
note.
- Document the preserved output in the timeout troubleshooting guide and
changelog.

## Why

The reader kept output in a private buffer until the completion marker
arrived. A runaway
SOS command such as `!clrstack` could therefore print useful frames and
then lose all of
them when the timeout path fired. The timeout error now includes that
partial output and
also exposes it on `DebuggerError.partial_output`; marker
synchronization and the existing
manual break-in warning are unchanged.

## How it was verified

- The new timeout regression fails on `35b6cdb` and passes with the fix;
the same test
  asserts the preserved line and the bounded diagnostic behavior.
- `test_debug_session.py`: 66 passed.
- Hermetic suite: 103 passed, 12 deselected; full suite: 103 passed, 12
skipped because
  this host has no CDB/KD or Git LFS debugger dumps.
- `uv lock --check`, MCP schema validation, docs formatter,
`compileall`, `uv build`,
  `twine check

**File**: `CHANGELOG.md` (modified, +4/-0)
```diff
@@ -15,6 +15,10 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
   and preserve the closing caller's kernel resume policy. Break-in keeps the
   validated session record so a concurrent close cannot cause a registry error
   (#109, #110). Thanks to @adity982 for the fix.
+- A command that times out before reaching its completion marker keeps the
+  output already read, so the timeout error still shows useful diagnostics from
+  runaway commands such as SOS `!clrstack`. The retained output is capped at
+  2,000 lines and 64 KiB (#112, #114). Thanks to @Oscar-Williams for the fix.
 
 ## [1.3.0] - 2026-09-10
 
```

**File**: `docs/troubleshooting.md` (modified, +3/-0)
```diff
@@ -50,6 +50,9 @@ A command that exceeds the per-command limit reports a timeout.
 
 - Raise it with [`--timeout`](reference/cli.md#general), for example `--timeout 120`.
 - On large dumps, prefer targeted commands over broad analysis.
+- The timeout error includes the output read before CDB stopped responding. If the command
+  produces more than the diagnostic limit, the response ends with a truncation note; increase
+  the timeout or inspect the target directly for the complete output.
 
 ## Module not found (pip installs)
 
```

**File**: `src/mcp_windbg/debug_session.py` (modified, +54/-1)
```diff
@@ -45,6 +45,12 @@
 # appended so each command waits for its own, distinct marker.
 MARKER_BASE = "COMMAND_COMPLETED_MARKER"
 
+# A runaway debugger command can produce output indefinitely. Keep timeout
+# diagnostics useful without turning the error itself into another unbounded
+# response.
+MAX_PARTIAL_OUTPUT_LINES = 2000
+MAX_PARTIAL_OUTPUT_CHARS = 64 * 1024
+
 # How long ``wait_for_break`` blocks by default. Waiting on a resumed target is
 # open-ended by nature - you are waiting for a bugcheck or a breakpoint - so this
 # is deliberately unrelated to the per-command timeout.
@@ -69,6 +75,10 @@
 class DebuggerError(Exception):
     """Raised for any debugger session failure (launch, timeout, I/O)."""
 
+    def __init__(self, message: str, *, partial_output: Optional[List[str]] = None):
+        super().__init__(message)
+        self.partial_output = list(partial_output or [])
+
 
 class _ReleaseOnExit:
     """Context manager that releases an already-acquired lock on exit."""
@@ -230,6 +240,10 @@ def __init__(
         self.verbose = verbose
 
         self.output_lines: List[str] = []
+        #: The reader's current command buffer. It is published under the same
+        #: lock as marker state so a timeout can retain output before the marker
+        #: arrives, even though the reader owns the list itself.
+        self._reader_buffer: Optional[List[str]] = None
         self.lock = threading.Lock()
         #: Serializes whole operations on the debugger's stdin. ``self.lock``
         #: only guards individual field writes; it cannot make "install a
@@ -302,6 +316,8 @@ def _read_output(self) -> None:
             return
 
         buffer: List[str] = []
+        with self.lock:
+            self._reader_buffer = buffer
         try:
             for line in self.process.stdout:
                 line = line.rstrip()
@@ -318,6 +334,7 @@ def _read_output(self) -> None:
                         if self._expected_marker and self._expected_marker in line:
                             self.output_lines = buffer
                             buffer = []
+                            self._reader_buffer = buffer
                             self._expected_marker = None
                             self.ready_event.set()
                         continue
@@ -340,6 +357,35 @@ def _take_output(self) -> List[str]:
             self.output_lines = []
         return result
 
+    def _snapshot_partial_output(self) -> List[str]:
+        """Return bounded output read before the current marker arrived."""
+        with self.lock:
+            lines = list(self._reader_buffer or [])
+
+        bounded: List[str] = []
+        char_count = 0
+        truncated = False
+        for line in lines:
+            if len(bounded) >= MAX_PARTIAL_OUTPUT_LINES:
+                truncated = True
+                break
+            remaining = MAX_PARTIAL_OUTPUT_CHARS - char_count
+            if remaining <= 0:
+                truncated = True
+                break
+            if len(line) + 1 > remaining:
+                bounded.append(line[: max(0, remaining - 1)])
+                truncated = True
+                break
+            bounded.append(line)
+            char_count += len(line) + 1
+
+        if truncated:
+            bounded.append(
+                "[partial output truncated; increase the command timeout or inspect the target directly]"
+            )
+        return bounded
+
     def _abandon_marker(self) -> bool:
         """Give up on the marker currently being waited for.
 
@@ -510,6 +556,7 @@ def _send_marked(
         if self._closing:
             raise DebuggerError("Session was closed while the command was running")
         if not landed and not self._marker_landed():
+            partial_output = self._snapshot_partial_output()
             resynced = self._abort_running_command()
             detail = "" if resynced else " (session may need a manual break-in)"
             # The break-in output is the only record of why the target stopped
@@ -519,8 +566,14 @@ def _send_marked(
                 if preamble
                 else ""
             )
+            partial = (
+                "\nPartial output before timeout:\n" + "\n".join(partial_output)
+                if partial_output
+                else ""
+            )
             raise DebuggerError(
-                f"Command timed out after {cmd_timeout} seconds: {command}{detail}{lost}"
+                f"Command timed out after {cmd_timeout} seconds: {command}{detail}{lost}{partial}",
+                partial_output=partial_output,
             )
 
         pipe_output = self._take_output()
```

**File**: `src/mcp_windbg/tests/test_debug_session.py` (modified, +27/-0)
```diff
@@ -231,6 +231,33 @@ def test_timeout_raises_when_marker_never_arrives(make_session):
     assert "timed out" in str(exc.value).lower()
 
 
+def test_timeout_error_preserves_output_seen_before_marker(make_session):
+    """A command that never reaches its marker must retain useful output."""
+    session, proc = make_session(timeout=1)
+    proc._swallow = True
+    with pytest.raises(DebuggerError) as exc:
+        session.send_command("!clrstack", timeout=1)
+
+    message = str(exc.value)
+    assert "timed out" in message.lower()
+    assert "OUT:!clrstack" in message
+    assert exc.value.partial_output == ["OUT:!clrstack"]
+
+
+def test_partial_timeout_output_has_line_and_size_limits(make_session):
+    session, _ = make_session(timeout=1)
+    with session.lock:
+        session._reader_buffer = ["frame"] * (debug_session.MAX_PARTIAL_OUTPUT_LINES + 1)
+    lines = session._snapshot_partial_output()
+    assert len(lines) == debug_session.MAX_PARTIAL_OUTPUT_LINES + 1
+    assert lines[-1].startswith("[partial output truncated;")
+
+    with session.lock:
+        session._reader_buffer = ["x" * debug_session.MAX_PARTIAL_OUTPUT_CHARS]
+    lines = session._snapshot_partial_output()
+    assert lines[-1].startswith("[partial output truncated;")
+
+
 # -- go-class commands ----------------------------------------------------
 #
 # The bug these cover: 'g' hands the CPU to the target, after which the debugger
```

#### Recent Merged Pull Requests:
- **PR #159** (2026-10-23): feat: leave a running remote target running, and restore it on close (@svnscha)
- **PR #158** (2026-10-23): fix(debugger): preserve completed output at EOF (@Oscar-Williams)
- **PR #157** (2026-10-23): chore(develop): release 1.6.0 (@github-actions[bot])
- **PR #156** (2026-10-20): fix(signing): authenticate isolated release signing requests (@svnscha)
- **PR #154** (2026-10-23): deps(python): update pymdown-extensions requirement from >=12.1 to >=12.3 in the python group (@dependabot[bot])
- **PR #153** (2026-10-23): feat: keep a live debugger log and add tools to read, export and display it (@LongpanZhou)

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

## X. debugger): report debugger process exit instead of timing out (#115)

**RULE**:
When implementing operations in `CHANGELOG.md`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in svnscha/mcp-windbg. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `5bf42133`: debugger): report debugger process exit instead of timing out (#115). Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `CHANGELOG.md`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
- A debugger process that exits (`q`, a failed `-remote` or `-k` connect, or
  cdb/kd crashing) is now reported at once with its exit code and last output,
  instead of every pending command, `wait_for_break`, or session open sitting out
  its full timeout and then misreporting a timeout (#115). Thanks to
  @RamanaIntel for the fix.
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
// Defect-prone omission of boundary validation
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `5bf42133` are properly handled with clean fallback behavior.

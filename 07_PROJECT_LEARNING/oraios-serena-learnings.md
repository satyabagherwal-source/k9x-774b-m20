# Forensic Learning Record (Deep Inspection): oraios/serena

> **Canonical Artifact**: `07_PROJECT_LEARNING/oraios-serena-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/oraios/serena](https://github.com/oraios/serena))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:13:36.236Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `oraios/serena`
- **Description**: A powerful MCP toolkit for coding, providing semantic retrieval and editing capabilities  - the IDE for your agent
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 30028 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `src/interprompt/util/class_decorators.py`
```
# SPDX-License-Identifier: GPL-3.0-or-later

from typing import Any


def singleton(cls: type[Any]) -> Any:
    instance = None

    def get_instance(*args: Any, **kwargs: Any) -> Any:
        nonlocal instance
        if instance is None:
            instance = cls(*args, **kwargs)
        return instance

    return get_instance

```

### Core Architecture Module: `src/serena/hooks.py`
```
# SPDX-License-Identifier: GPL-3.0-or-later

import json
import os
import pickle
import shutil
import sys
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Literal, Self

import click

from serena.generated.tool_capabilities import EDIT_CAPABLE_TOOL_NAMES
from serena.util.cli_util import AutoRegisteringGroup

# copied from serena_config.py, we don't want to import anything here to keep the hook commands fast
serena_home_dir = os.getenv("SERENA_HOME", "").strip() or str(Path.home() / ".serena")


class HookClient(Enum):
    """The client application that triggered the hook."""

    CLAUDE_CODE = "claude-code"
    CODEBUDDY = "codebuddy"
    VSCODE = "vscode"
    CODEX = "codex"
    GROK = "grok"
    ZCODE = "zcode"


class Hook(ABC):
    def __init__(self, client: HookClient):
        raw = sys.stdin.read()
        input_data = json.loads(raw, strict=False)
        self._input_data = input_data
        self._client = client

        # parse the permission mode shared by Codex hook events
        raw_permission_mode = input_data.get("permission_mode") or input_data.get("permissionMode") or ""
        self._permission_mode = str(raw_permission_mode).strip()

        session_id = input_data.get("session_id") or input_data.get("sessionId")
        if not session_id:
            raise ValueError("Session ID is required in the hook input data")
        self._session_id = str(session_id)
        self.session_persistence_dir = os.path.join(serena_home_dir, "hook_data", self._session_id)
        # tool input has a timestamp but using now is enough
        self.triggered_at_timestamp = datetime.now()

    @abstractmethod
    def execute(self) -> None:
        pass

    def _is_plan_mode(self) -> bool:
        """Whether the current hook payload reports Codex plan mode."""
        return self._permission_mode == "plan"


#: substrings that mark a "serena"-containing tool name as one of Serena's own non-symbolic
#: utilities (read/config/dashboard/shell) rather than a code-navigation tool; shared across
#: PreToolUse and PostToolUse hooks so both classify a call the same way.
_NON_SYMBOLIC_SERENA_TOOL_NAME_SUBSTRINGS = frozenset(
    (
        "pattern",
        "read",
        "diagnostics",
        "memory",
        "onboarding",
        "config",
        "list_file",
        "find_file",
        "shell",
        "dashboard",
        "restart_language_server",
    )
)


def _is_serena_symbolic_tool_name(tool_name: str) -> bool:
    return "serena" in tool_name and not any(substring in tool_name for substring in _NON_SYMBOLIC_SERENA_TOOL_NAME_SUBSTRINGS)


class PreToolUseHook(Hook, ABC):
    def __init__(self, client: HookClient):
        super().__init__(client)
        _tool_name = self._input_data.get("tool_name") or self._input_data.get("toolName", "") or ""
        _tool_name = str(_tool_name).lower().strip()
        if not _tool_name:
            raise ValueError("Tool name is required in the hook input data")
        self._tool_name = _tool_name
        raw_tool_input = self._input_data.get("tool_input") or self._input_data.get("toolInput")
        # TODO: some agents, like copilot CLI, can send a string as value for raw_tool_input
        #  Example: "tool_input":"*** Begin Patch\n*** Add File: /Users/acbdef/.copilot/session-state/08a961db-02f0-4c7c-b783-1e9818290292/files/hook-tool-test-3.txt\n+third edit tool test\n*** End Patch\n"
        #  We currently don't parse such tool input and hence don't react to it in hooks
        self._tool_input: dict | None = raw_tool_input if isinstance(raw_tool_input, dict) else None

    @dataclass
    class OutputData:
        permission_decision: Literal["deny", "allow"]
        permission_decision_reason: str
        additional_context: str = ""

        def to_json_string(self, client: HookClient) -> str:
            if client == HookClient.GROK:
                grok_output: dict[str, str] = {"decision": self.permission_decision}
                if self.permission_decision == "deny":
                    grok_output["reason"] = self.permission_decision_reason
                return json.dumps(grok_output)

            hook_output = {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": self.permission_decision,
                    "permissionDecisionReason": self.permission_decision_reason,
                }
            }
            if client != HookClient.CODEX:
                hook_output["hookSpecificOutput"]["additionalContext"] = self.additional_context
            return json.dumps(hook_output)

    def is_serena_symbolic_tool(self) -> bool:
        return _is_serena_symbolic_tool_name(self._tool_name)

    def _get_codex_serena_tool_name(self) -> str | None:
        """Serena tool name from a canonical Codex MCP hook name, if present."""
        prefix = "mcp__serena__"
        if not self._tool_name.startswith(prefix):
            return None

        tool_name = self._tool_name.removeprefix(prefix)
        return tool_name or None


class PreToolUseRemindAboutSymbolicToolsHook(PreToolUseHook):
    """Pre-tool-use hook that nudges the agent toward Serena's symbolic tools.

    Tracks consecutive uses of grep and read-file tools via a persisted
    :class:`ToolUseCounter`. When the number of recent calls reaches the
    configured threshold, a deny response is emitted with a reminder to
    use symbolic alternatives.

    The counter for a given tool type is reset whenever

    * a Serena tool is invoked (both counters are reset),
    * a deny is emitted (the acting counter is reset so the next retry starts fresh),
    * or the configured reset period elapses *between two consecutive calls of that
      same tool type* — i.e. the period gates the gap between successive calls, not
      an absolute sliding window. Three grep calls at t=0, t=9, t=18 therefore count
      as a burst of three, even though the total span (18s) exceeds the 10s grep
      period; only an individual pair that is more than 10s apart resets the counter.

    Non-tracked tools (Edit, Write, Bash, etc.) are deliberately neutral: they neither
    increment nor reset counters, so they also do not mask bursts by pushing the last
    timestamp forward.

    The hook is additionally gated by :attr:`ToolUseCounter._MIN_DENY_INTERVAL_SECONDS`
    (two minutes by default): once a deny has been emitted, *every* subsequent
    invocation of this hook is a no-op until the window has elapsed — neither the
    counters are updated nor any further deny is produced. This prevents the agent
    from being nudged more than once per window during a sustained non-symbolic-tool
    burst, and also avoids surprising the user with reminders that were already
    counted up under stale state.
    """

    @dataclass
    class ToolUseCounter:
        _FILE_NAME = "tool_use_counter.pkl"
        _GREP_USES_THRESHOLD = 3
        _READ_FILE_USES_THRESHOLD = 3
        # threshold for the combined "non-symbolic" counter that catches mixed sequences of grep+read
        _NON_SYMBOLIC_USES_THRESHOLD = 4

        # The following periods are set to essentially infinity since we neglect the per-tool reset periods for them
        _READ_FILE_RESET_PERIOD_SECONDS = 1000
        _GREP_RESET_PERIOD_SECONDS = 1000
        # reset period for the combined counter
        _NON_SYMBOLIC_RESET_PERIOD_SECONDS = 2000

        # minimum seconds between two engagements of the hook after a deny; the entire
        # hook (counter updates included) is a no-op while this window is active, so a
        # single sustained burst triggers at most one nudge per window
        _MIN_DENY_INTERVAL_SECONDS = 120

        n_recent_read_file_uses: int = 0
        n_recent_grep_uses: int = 0
        n_recent_non_symbolic_uses: int = 0
        last_grep_use_timestamp: datetime | None = None
        last_read_file_use_timestamp: datetime | None = None
        last_non_symbolic_use_timestamp: datetime | None = None
        # timestamp of the most recently emitted deny; deliberately not cleared by
        # :meth:`reset` so the rate limit survives counter resets (e.g. Serena tool use)
        last_deny_timestamp: datetime | None = None

        def too_many_recent_reads(self) -> bool:
            return self.n_recent_read_file_uses >= self._READ_FILE_USES_THRESHOLD

        def too_many_recent_greps(self) -> bool:
            return self.n_recent_grep_uses >= self._GREP_USES_THRESHOLD

        def too_many_recent_non_symbolic(self) -> bool:
            return self.n_recent_non_symbolic_uses >= self._NON_SYMBOLIC_USES_THRESHOLD

        def is_hook_active(self, now: datetime) -> bool:
            """:return: whether the hook should engage at all at ``now``. Returns
            ``False`` while we are still within :attr:`_MIN_DENY_INTERVAL_SECONDS`
            of the most recent emitted deny — in that case the entire hook is
            short-circuited (no counter updates, no deny). Returns ``True`` when
            no deny has been emitted yet in this session, or when the window has
            elapsed.
            """
            if self.last_deny_timestamp is None:
                return True
            return (now - self.last_deny_timestamp).total_seconds() >= self._MIN_DENY_INTERVAL_SECONDS

        @classmethod
        def _get_persistence_path(cls, hook: Hook) -> Path:
            return Path(hook.session_persistence_dir) / cls._FILE_NAME

        @classmethod
        def load(cls, hook: Hook) -> Self:
            path = cls._get_persistence_path(hook)
            try:
                with open(path, "rb") as f:
                    return pickle.load(f)
            except Exception:
                return cls()

        def save(self, hook: Hook) -> None:
            path = self._get_persistence_path(hook)
            try:
                path.parent.mkdir(paren
```

### Core Architecture Module: `src/serena/util/class_decorators.py`
```
# SPDX-License-Identifier: GPL-3.0-or-later

from typing import Any


# duplicate of interprompt.class_decorators
# We don't want to depend on interprompt for this in serena, so we duplicate it here
def singleton(cls: type[Any]) -> Any:
    instance = None

    def get_instance(*args: Any, **kwargs: Any) -> Any:
        nonlocal instance
        if instance is None:
            instance = cls(*args, **kwargs)
        return instance

    return get_instance

```

### Core Architecture Module: `src/serena/util/cli_util.py`
```
# SPDX-License-Identifier: GPL-3.0-or-later

import click


def ask_yes_no(question: str, default: bool | None = None) -> bool:
    default_prompt = "Y/n" if default else "y/N"

    while True:
        answer = input(f"{question} [{default_prompt}] ").strip().lower()
        if answer == "" and default is not None:
            return default
        if answer in ("y", "yes"):
            return True
        if answer in ("n", "no"):
            return False
        print("Please answer yes/y or no/n.")


class AutoRegisteringGroup(click.Group):
    """
    A click.Group subclass that automatically registers any click.Command
    attributes defined on the class into the group.

    After initialization, it inspects its own class for attributes that are
    instances of click.Command (typically created via @click.command) and
    calls self.add_command(cmd) on each. This lets you define your commands
    as static methods on the subclass for IDE-friendly organization without
    manual registration.
    """

    def __init__(self, name: str, help: str):
        super().__init__(name=name, help=help)
        # Scan class attributes for click.Command instances and register them.
        for attr in dir(self.__class__):
            cmd = getattr(self.__class__, attr)
            if isinstance(cmd, click.Command):
                self.add_command(cmd)

```

### Core Architecture Module: `src/serena/util/dataclass.py`
```
# SPDX-License-Identifier: GPL-3.0-or-later

from dataclasses import MISSING, Field
from typing import Any, cast


def get_dataclass_default(cls: type, field_name: str) -> Any:
    """
    Gets the default value of a dataclass field.

    :param cls: The dataclass type.
    :param field_name: The name of the field.
    :return: The default value of the field (either from default or default_factory).
    """
    field = cast(Field, cls.__dataclass_fields__[field_name])  # type: ignore[attr-defined]

    if field.default is not MISSING:
        return field.default

    if field.default_factory is not MISSING:  # default_factory is a function
        return field.default_factory()

    raise AttributeError(f"{field_name} has no default")

```

### Core Architecture Module: `src/serena/util/dotnet.py`
```
# SPDX-License-Identifier: GPL-3.0-or-later

import logging
import platform
import re
import shutil
import subprocess
import urllib
from pathlib import Path

from serena.util.version import Version
from solidlsp.ls_exceptions import SolidLSPException
from solidlsp.util.subprocess_util import subprocess_run

log = logging.getLogger(__name__)


class DotNETUtil:
    def __init__(self, required_version: str, allow_higher_version: bool = True):
        """
        :param required_version: the required .NET runtime version specified as a string (e.g. "10.0" for .NET 10.0)
        :param allow_higher_version: whether to allow higher versions than the required version
        """
        self._system_dotnet = shutil.which("dotnet")
        self._required_version_str = required_version
        self._required_version_components = [int(c) for c in required_version.split(".")]
        self._allow_higher_version = allow_higher_version
        self._installed_versions = self._determine_installed_versions()

    def _determine_installed_versions(self) -> list[Version]:
        if self._system_dotnet:
            try:
                result = subprocess_run([self._system_dotnet, "--list-runtimes"], capture_output=True, text=True, check=True)
                version_strings = re.findall(r"Microsoft.NETCore.App\s+([^\s]+)", result.stdout)
                log.info("Installed .NET runtime versions: %s", version_strings)
                return [Version(v) for v in version_strings]
            except:
                log.warning("Failed to run 'dotnet --list-runtimes' to check .NET version; assuming no installed .NET versions")
                return []
        else:
            log.info("Found no `dotnet` on system PATH; assuming no installed .NET versions")
            return []

    def is_required_version_available(self) -> bool:
        """
        Checks whether the required .NET runtime version is installed and raises an exception if not.

        :param required_version_components: the required .NET runtime version specified as a list of integers representing the version components (e.g., [6, 1] for .NET 6.1)
        :param allow_higher_version: whether to allow higher versions than the required version (e.g., if True, .NET 7.0 would satisfy a requirement of .NET 6.1)
        """
        required_version_str = ".".join(str(c) for c in self._required_version_components)
        for v in self._installed_versions:
            if self._allow_higher_version:
                if v.is_at_least(*self._required_version_components):
                    log.info(f"Found installed .NET runtime version {v} which satisfies requirement of {required_version_str} or higher")
                    return True
            else:
                if v.is_equal(*self._required_version_components):
                    log.info(f"Found installed .NET runtime version {v} which satisfies requirement of {required_version_str}")
                    return True
        return False

    def get_dotnet_path_or_raise(self) -> str:
        """
        Returns the path to the dotnet executable if the required .NET runtime version is available, otherwise raises an exception.
        """
        if not self.is_required_version_available():
            raise SolidLSPException(
                f"Required .NET runtime version {self._required_version_str} not found "
                f"(installed versions: {self._installed_versions}). "
                "Please install the required .NET runtime version from https://dotnet.microsoft.com/en-us/download/dotnet "
                "and ensure that `dotnet` is on the system PATH."
            )
        assert self._system_dotnet is not None
        return self._system_dotnet

    @staticmethod
    def install_dotnet_with_script(version: str, base_path: str) -> str:
        """
        Install .NET runtime using Microsoft's official installation script.

        NOTE: This method is unreliable and therefore currently unused. It is kept for reference.

        :version: the version to install as a string (e.g. "10.0")
        :return: the path to the dotnet executable.
        """
        dotnet_dir = Path(base_path) / f"dotnet-runtime-{version}"

        # Determine binary name based on platform
        is_windows = platform.system().lower() == "windows"
        dotnet_exe = dotnet_dir / ("dotnet.exe" if is_windows else "dotnet")

        if dotnet_exe.exists():
            log.info(f"Using cached .NET {version} runtime from {dotnet_exe}")
            return str(dotnet_exe)

        # Download and run install script
        log.info(f"Installing .NET {version} runtime using official Microsoft install script...")
        dotnet_dir.mkdir(parents=True, exist_ok=True)

        try:
            if is_windows:
                # PowerShell script for Windows
                script_url = "https://dot.net/v1/dotnet-install.ps1"
                script_path = dotnet_dir / "dotnet-install.ps1"
                urllib.request.urlretrieve(script_url, script_path)

                cmd = [
                    "pwsh",
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-File",
                    str(script_path),
                    "-Version",
                    version,
                    "-InstallDir",
                    str(dotnet_dir),
                    "-Runtime",
                    "dotnet",
                    "-NoPath",
                ]
            else:
                # Bash script for Linux/macOS
                script_url = "https://dot.net/v1/dotnet-install.sh"
                script_path = dotnet_dir / "dotnet-install.sh"
                urllib.request.urlretrieve(script_url, script_path)
                script_path.chmod(0o755)

                cmd = [
                    "bash",
                    str(script_path),
                    "--version",
                    version,
                    "--install-dir",
                    str(dotnet_dir),
                    "--runtime",
                    "dotnet",
                    "--no-path",
                ]

            # Run the install script
            log.info("Running .NET install script: %s", cmd)
            result = subprocess_run(cmd, capture_output=True, text=True, check=True)
            log.debug(f"Install script output: {result.stdout}")

            if not dotnet_exe.exists():
                raise SolidLSPException(f"dotnet executable not found at {dotnet_exe} after installation")

            log.info(f"Successfully installed .NET {version} runtime to {dotnet_exe}")
            return str(dotnet_exe)

        except subprocess.CalledProcessError as e:
            raise SolidLSPException(f"Failed to install .NET {version} runtime using install script: {e.stderr if e.stderr else e}") from e
        except Exception as e:
            message = f"Failed to install .NET {version} runtime: {e}"
            if is_windows and isinstance(e, FileNotFoundError):
                message += "; pwsh, i.e. PowerShell 7+, is required to install .NET runtime. Make sure pwsh is available on your system."
            raise SolidLSPException(message) from e

```

### Core Architecture Module: `src/serena/util/exception.py`
```
# SPDX-License-Identifier: GPL-3.0-or-later

import os
import sys

from serena.agent import log


def is_headless_environment() -> bool:
    """
    Detect if we're running in a headless environment where GUI operations would fail.

    Returns True if:
    - No DISPLAY variable on Linux/Unix
    - Running in SSH session
    - Running in WSL without X server
    - Running in Docker container
    """
    # Check if we're on Windows - GUI usually works there
    if sys.platform == "win32":
        return False

    # Check for DISPLAY variable (required for X11)
    if not os.environ.get("DISPLAY"):
        return True

    # Check for SSH session
    if os.environ.get("SSH_CONNECTION") or os.environ.get("SSH_CLIENT"):
        return True

    # Check for common CI/container environments
    if os.environ.get("CI") or os.environ.get("CONTAINER") or os.path.exists("/.dockerenv"):
        return True

    # Check for WSL (only on Unix-like systems where os.uname exists)
    if hasattr(os, "uname"):
        if "microsoft" in os.uname().release.lower():
            # In WSL, even with DISPLAY set, X server might not be running
            # This is a simplified check - could be improved
            return True

    return False


def show_fatal_exception_safe(e: Exception) -> None:
    """
    Shows the given exception in the GUI log viewer on the main thread and ensures that the exception is logged or at
    least printed to stderr.
    """
    # Log the error and print it to stderr
    log.error(f"Fatal exception: {e}", exc_info=e)
    print(f"Fatal exception: {e}", file=sys.stderr)

    # Don't attempt GUI in headless environments
    if is_headless_environment():
        log.debug("Skipping GUI error display in headless environment")
        return

    # attempt to show the error in the GUI
    try:
        # NOTE: The import can fail on macOS if Tk is not available (depends on Python interpreter installation, which uv
        #   used as a base); while tkinter as such is always available, its dependencies can be unavailable on macOS.
        from serena.gui_log_viewer import show_fatal_exception

        show_fatal_exception(e)
    except Exception as gui_error:
        log.debug(f"Failed to show GUI error dialog: {gui_error}")

```

### Core Architecture Module: `src/serena/util/file_proxy.py`
```
# SPDX-License-Identifier: GPL-3.0-or-later

import logging
import os
from abc import ABC, abstractmethod
from collections.abc import Iterator
from typing import TYPE_CHECKING, Self

if TYPE_CHECKING:
    from serena.project import Project

log = logging.getLogger(__name__)


class FileProxy(ABC):
    @abstractmethod
    def get_contents(self) -> str:
        """:return: the contents of the file as a string."""

    @abstractmethod
    def get_relative_path(self) -> str:
        """:return: the relative path reported by Serena (actual relative path or encoded external path)"""

    @abstractmethod
    def is_glob_supported(self):
        """
        :return: whether the proxy supports glob filtering based on its relative path
        """

    @staticmethod
    def is_external_path(relative_path: str, project: "Project") -> bool:
        """
        :return: whether the given relative path is an encoded external path (not a local project file)
        """
        return project.language_backend.is_external_path(relative_path)

    @classmethod
    def from_project_relative_path(cls, project: "Project", relative_path: str) -> "FileProxy":
        return project.language_backend.create_file_proxy(relative_path, project)


class LocalProjectFileProxy(FileProxy):
    def __init__(self, relative_path: str, project: "Project"):
        self._relative_path = relative_path
        self._project = project

    def get_contents(self) -> str:
        abs_path = os.path.join(self._project.project_root, self._relative_path)
        with open(abs_path, encoding=self._project.project_config.encoding) as f:
            return f.read()

    def get_relative_path(self) -> str:
        return self._relative_path

    def is_glob_supported(self):
        return True


class FileCollection:
    def __init__(self, file_proxies: list[FileProxy]):
        self._file_proxies = file_proxies

    def __len__(self) -> int:
        return len(self._file_proxies)

    def __iter__(self) -> Iterator[FileProxy]:
        return iter(self._file_proxies)

    @classmethod
    def from_local_project_paths(cls, relative_paths: list[str], project: "Project") -> Self:
        return cls([LocalProjectFileProxy(path, project) for path in relative_paths])

    def filter_glob(self, paths_include_glob: str | None = None, paths_exclude_glob: str | None = None) -> "FileCollection":
        """
        Filters the collection based on the given patterns.
        Note: Filtering is applied only to local project files. Other files are always retained.

        :param paths_include_glob: optional glob pattern to include files from the list
        :param paths_exclude_glob: optional glob pattern to exclude files from the list
        :return: the filtered collection
        """
        from serena.util.text_utils import GlobMatcher

        if paths_include_glob is None and paths_exclude_glob is None:
            return self

        include_glob_matcher = GlobMatcher(paths_include_glob) if paths_include_glob else None
        exclude_glob_matcher = GlobMatcher(paths_exclude_glob) if paths_exclude_glob else None

        filtered_files = []
        for f in self._file_proxies:
            if f.is_glob_supported():
                path = f.get_relative_path()
                if include_glob_matcher:
                    if not include_glob_matcher.matches(path):
                        log.debug(f"Skipping {path}: does not match include pattern {paths_include_glob}")
                        continue
                if exclude_glob_matcher:
                    if exclude_glob_matcher.matches(path):
                        log.debug(f"Skipping {path}: matches exclude pattern {paths_exclude_glob}")
                        continue
            filtered_files.append(f)

        return FileCollection(filtered_files)

```

### Core Architecture Module: `src/serena/util/file_system.py`
```
# SPDX-License-Identifier: GPL-3.0-or-later

import logging
import os
import re
import stat
import tempfile
import time
from collections import deque
from collections.abc import Callable, Iterator
from dataclasses import dataclass, field
from pathlib import Path
from typing import NamedTuple

import pathspec
from pathspec import PathSpec
from sensai.util.logging import LogTime

log = logging.getLogger(__name__)


def write_file_atomic(path: str, content: str, *, encoding: str, newline: str | None = None) -> None:
    """
    Write ``content`` to ``path`` atomically: the content is written to a temporary file in the
    same directory first, then swapped into place with ``os.replace``. A plain
    ``open(path, "w")`` is not atomic: it truncates the file before the new content is complete,
    so a crash, an out-of-memory kill, or a disk-full error partway through the write leaves
    ``path`` holding neither the old content nor the new one.

    :param path: the path to write to
    :param content: the text content to write
    :param encoding: the encoding to use for the write
    :param newline: passed through to the underlying ``open()`` call to control newline translation
    """
    # ``open(path, "w")`` follows symlinks and writes through to the target, whereas replacing the
    # link path itself would swap the link out for a regular file and leave its target holding the
    # old content. Resolving first keeps this a drop-in replacement, and puts the temporary file in
    # the destination's real directory, which is where it has to be for the rename to be atomic.
    path = os.path.realpath(path)
    target_dir = os.path.dirname(path) or "."
    try:
        existing_mode: int | None = stat.S_IMODE(os.stat(path).st_mode)
    except FileNotFoundError:
        existing_mode = None
    fd, tmp_path = tempfile.mkstemp(dir=target_dir, prefix=os.path.basename(path) + ".", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding=encoding, newline=newline) as f:
            f.write(content)
        # mkstemp creates the temp file with mode 0600 regardless of umask, which would silently
        # tighten an existing file's permissions (e.g. 0644 -> 0600) on replace. Restore the
        # original mode, or fall back to what a plain open(path, "w") would have produced for a
        # new file (0666 masked by the process umask).
        os.chmod(tmp_path, existing_mode if existing_mode is not None else _new_file_mode())
        _replace_with_retry(tmp_path, path)
    except BaseException:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def _new_file_mode() -> int:
    """The mode a plain ``open(path, "w")`` would give a brand-new file: 0o666 masked by the
    process umask. Reading the umask requires setting it, so the previous value is restored
    immediately after.
    """
    current_umask = os.umask(0o022)
    os.umask(current_umask)
    return 0o666 & ~current_umask


def _replace_with_retry(src: str, dst: str, *, attempts: int = 10, delay_s: float = 0.05) -> None:
    """``os.replace(src, dst)`` with a short retry on a Windows sharing violation: on Windows the
    atomic rename fails with ``PermissionError`` if another process momentarily holds ``dst`` open
    (e.g. a second Serena process reading the same memory or source file). A brief bounded retry
    rides out that contention; the temp file is still complete, so this never falls back to a
    non-atomic write.
    """
    for attempt in range(attempts):
        try:
            os.replace(src, dst)
            return
        except PermissionError:
            if attempt == attempts - 1:
                raise
            time.sleep(delay_s)


# Characters meaningful to pathspec's gitignore grammar: glob wildcards, bracket expressions,
# the escape character itself, and '!'/'#' which change a whole pattern's meaning when they
# are its first character. Backslash-escaping them makes a literal name safe to interpolate.
# Escape surrounding whitespace too, so pathspec does not strip it from literal names.
_GITIGNORE_PATTERN_SPECIAL_CHARS_RE = re.compile(r"([\\*?\[\]!#])")


def _escape_gitignore_path_component(component: str) -> str:
    """Escape gitignore/pathspec pattern metacharacters in a single path component (no
    separators) so it is matched as a literal name rather than as glob syntax.
    """
    component = _GITIGNORE_PATTERN_SPECIAL_CHARS_RE.sub(r"\\\1", component)
    return re.sub(r"(^\s|\s$)", r"\\\1", component)


class ScanResult(NamedTuple):
    """Result of scanning a directory."""

    directories: list[str]
    files: list[str]


def scan_directory(
    path: str,
    recursive: bool = False,
    relative_to: str | None = None,
    is_ignored_dir: Callable[[str], bool] | None = None,
    is_ignored_file: Callable[[str], bool] | None = None,
) -> ScanResult:
    """
    :param path: the path to scan
    :param recursive: whether to recursively scan subdirectories
    :param relative_to: the path to which the results should be relative to; if None, provide absolute paths
    :param is_ignored_dir: a function with which to determine whether the given directory (abs. path) shall be ignored
    :param is_ignored_file: a function with which to determine whether the given file (abs. path) shall be ignored
    :return: the list of directories and files
    """
    if is_ignored_file is None:
        is_ignored_file = lambda x: False
    if is_ignored_dir is None:
        is_ignored_dir = lambda x: False

    files = []
    directories = []

    abs_path = os.path.abspath(path)
    rel_base = os.path.abspath(relative_to) if relative_to else None

    try:
        with os.scandir(abs_path) as entries:
            for entry in entries:
                try:
                    entry_path = entry.path

                    if rel_base:
                        try:
                            result_path = os.path.relpath(entry_path, rel_base)
                        except:
                            log.debug(f"Skipping entry due to relative path conversion error: {entry.path}")
                            continue
                    else:
                        result_path = entry_path

                    if entry.is_file():
                        if not is_ignored_file(entry_path):
                            files.append(result_path)
                    elif entry.is_dir():
                        if not is_ignored_dir(entry_path):
                            directories.append(result_path)
                            if recursive:
                                sub_result = scan_directory(
                                    entry_path,
                                    recursive=True,
                                    relative_to=relative_to,
                                    is_ignored_dir=is_ignored_dir,
                                    is_ignored_file=is_ignored_file,
                                )
                                files.extend(sub_result.files)
                                directories.extend(sub_result.directories)
                except PermissionError as ex:
                    # Skip files/directories that cannot be accessed due to permission issues
                    log.debug(f"Skipping entry due to permission error: {entry.path}", exc_info=ex)
                    continue
    except PermissionError as ex:
        # Skip the entire directory if it cannot be accessed
        log.debug(f"Skipping directory due to permission error: {abs_path}", exc_info=ex)
        return ScanResult([], [])

    return ScanResult(directories, files)


def find_all_non_ignored_files(repo_root: str) -> list[str]:
    """
    Find all non-ignored files in the repository, respecting all gitignore files in the repository.

    :param repo_root: The root directory of the repository
    :return: A list of all non-ignored files in the repository
    """
    gitignore_parser = GitignoreParser(repo_root)
    _, files = scan_directory(
        repo_root, recursive=True, is_ignored_dir=gitignore_parser.should_ignore, is_ignored_file=gitignore_parser.should_ignore
    )
    return files


@dataclass
class GitignoreSpec:
    file_path: str
    """Path to the gitignore file."""
    patterns: list[str] = field(default_factory=list)
    """List of patterns from the gitignore file.
    The patterns are adjusted based on the gitignore file location.
    """
    pathspec: PathSpec = field(init=False)
    """Compiled PathSpec object for pattern matching."""

    def __post_init__(self) -> None:
        """Initialize the PathSpec from patterns."""
        self.pathspec = PathSpec.from_lines(pathspec.patterns.GitWildMatchPattern, self.patterns)

    def matches(self, relative_path: str) -> bool:
        """
        Check if the given path matches any pattern in this gitignore spec.

        :param relative_path: Path to check (should be relative to repo root)
        :return: True if path matches any pattern
        """
        return match_path(relative_path, self.pathspec, root_path=os.path.dirname(self.file_path))


class GitignoreParser:
    """
    Parser for gitignore files in a repository.

    This class handles parsing multiple gitignore files throughout a repository
    and provides methods to check if paths should be ignored.
    """

    def __init__(self, repo_root: str, *, prune_spec: PathSpec | None = None) -> None:
        """
        Initialize the parser for a repository.

        :param repo_root: Root directory of the repository
        :param prune_spec: Configured ignore patterns used to prune gitignore discovery
        """
        self.repo_root = os.path.abspath(repo_root)
        self.ignore_specs: list[GitignoreSpec] = 
```

### Core Architecture Module: `src/serena/util/git.py`
```
# SPDX-License-Identifier: GPL-3.0-or-later

import logging

from sensai.util.git import GitStatus

from ..constants import REPO_ROOT
from .shell import subprocess_check_output

log = logging.getLogger(__name__)


def get_git_status() -> GitStatus | None:
    try:
        cwd = REPO_ROOT
        commit_hash = subprocess_check_output(["git", "rev-parse", "HEAD"], cwd=cwd)
        unstaged = bool(subprocess_check_output(["git", "diff", "--name-only"], cwd=cwd))
        staged = bool(subprocess_check_output(["git", "diff", "--staged", "--name-only"], cwd=cwd))
        untracked = bool(subprocess_check_output(["git", "ls-files", "--others", "--exclude-standard"], cwd=cwd))
        return GitStatus(
            commit=commit_hash, has_unstaged_changes=unstaged, has_staged_uncommitted_changes=staged, has_untracked_files=untracked
        )
    except:
        return None

```

### Core Architecture Module: `src/serena/util/gui.py`
```
# SPDX-License-Identifier: GPL-3.0-or-later

import os
import platform


def system_has_usable_display() -> bool:
    system = platform.system()

    # macOS and native Windows: assume display is available for desktop usage
    if system == "Darwin" or system == "Windows":
        return True

    # Other systems, assumed to be Unix-like (Linux, FreeBSD, Cygwin/MSYS, etc.):
    # detect display availability since users may operate in CLI contexts
    else:
        # Check X11 or Wayland - if environment variables are set to non-empty values, assume display is usable
        display = os.environ.get("DISPLAY", "")
        wayland_display = os.environ.get("WAYLAND_DISPLAY", "")

        if display or wayland_display:
            return True

        return False

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1597** (2026-06-28): **Windows C#: OmniSharp startup can hang; Roslyn backend fails under deep SERENA_HOME path**
  *Symptoms*: ## Summary  On Windows, Serena's C# path has two related blockers that make it hard to use in an agent pipeline:  1. `csharp_omnisharp` can hang indefinitely during language-server startup/indexing. 2. `csharp` (Roslyn LS) works quickly with a short `SERENA_HOME`, but fails to install/extract when `SERENA_HOME` is under a deep workspace path because extracted NuGet paths exceed the classic Windows 260-character path limit.  For the same private .NET solution, the practical difference was:  - `csharp_omnisharp`: timed out after ~10 minutes and produced no C# symbol cache. - `csharp` with deep `SERENA_HOME`: failed in ~4 seconds during Roslyn package extraction. - `csharp` with short `SERENA_HOME=C:\tmp\cfg-serena`: indexed successfully in ~7.5 seconds, including first-time Roslyn package download/extract.  This makes it look like the repo itself is not slow. The slow/failing behavior is in backend startup/install handling.  ## Environment  - Serena: `1.5.3-8949fda1-dirty` via `uv tool install serena-agent` - OS: Windows - Shell: Windows PowerShell - .NET SDK: `10.0.300` - .NET runtimes: `Microsoft.NETCore.App 8.0.27`, `Microsoft.NETCore.App 10.0.8` - `pwsh`: not installed / not on PATH - Project: private .NET solution, 6 `.csproj` files, 44 C# files indexed by Roslyn when it works  ## Reproduction A: `csharp_omnisharp` hangs  Project config:  ```yaml languages:   - csharp_omnisharp read_only: true ```  Command:  ```powershell $env:SERENA_HOME = "C:\Users\<user>\Documents\GitHu
  **Post-Mortem & Fix Analysis**:
  > Thank you for the detailed report. We'd be happy to review a PR to fix this.
  > I have just opened a PR to fix this issue.

- **Issue #1578** (2026-06-24): **Serena cli commands may start IDE**
  *Symptoms*: With the recent jetbrains autolaunch by default, commands that rely on SerenaAgent launch an IDE. This affects at least `serena print-system-prompt`, but possibly other commands as well.  In that command there are also issues with log-level not being respected.
  **Post-Mortem & Fix Analysis**:
  > @opcode81 FYI. Unless this is already fixed on main (I may have an earlier checkout)
  > Two commands are affected: * the `print-system-prompt` command activates a project for no reason; not passing `project` would fix it * the `health-check` command probably should do this (as it reflects normal operation) 
  > I am taking care of this. I also did some enhancements to print-system-prompt that I needed for benchmarking which I'll commit along the way. I suspect most of our users don't use these commands, at least not often :)

- **Issue #1370** (2026-04-20): **Prompt of newly activated mode is not passed to LLM when using dynamic project activation**
  *Symptoms*: Im using a custom mode (project.yml - default_modes:), it is correctly displayed in Dashboard under my project.  When are the modes injected?  I dont see the custom modes prompt during MCP initialize (which would be expected for a project based mode) or "activate project". Do i need to put a placeholder or include into .serena/project.yml initial_prompt?  (im debugging with mcp inspector)  _Originally posted by @tomelgato in https://github.com/oraios/serena/discussions/1369_
  **Post-Mortem & Fix Analysis**:
  > @tomelgato this is a bug. The added mode's prompt is considered only if the project is activated at startup. If it is dynamically activated, it is not considered.
  > The trouble is: Providing the new mode prompts in a way that is ideal for all clients makes this a bit complicated.  Reason: Many clients do not read the MCP server's initial instructions anymore. Therefore, the way they receive all instructions (including newly activated modes) is through the `initial_instructions` tool which models are told to apply upon project activation if they have not yet read them. So if we provide the newly activated modes upon project activation and the model then applies the `initial_instructions` tool, it would get these instructions twice (unless we explicitly exclude them for the initial instructions in case the tool is applied after project activation).  Clients that do read the initial instructions are fine only receiving the new mode prompts upon activation.
  > Provide a project_instructions tool!? This would avoid the double reading and the projects mode prompt would be an addon

- **Issue #1360** (2026-04-21): **insert_after_symbol inserts inside multi-line constant/variable values (dict, list, etc.)**
  *Symptoms*: ## Problem  When `insert_after_symbol` is called on a top-level **constant or variable with a multi-line value** (e.g. a dict or list literal), the insertion lands **inside the value** — after the opening `{`/`[` — instead of after the closing `}`/`]`.  The root cause: `find_symbol` reports `body_location.start_line == body_location.end_line` for such constants (the LSP returns only the declaration line, not the full span of the value). `insert_after_symbol` then inserts after that single line, splitting the literal in half.  ## Minimal reproduction  **Input file (`example.py`):**  ```python """Minimal repro."""  SOME_CONFIG: dict[str, dict] = {     "key_a": {         "value": 1,         "notes": "first entry",     },     "key_b": {         "value": 2,         "notes": "second entry",     }, }   def some_function() -> str:     return "hello" ```  **Step 1 — find_symbol reports a single-line body for a 10-line dict:**  ``` find_symbol("SOME_CONFIG", relative_path="example.py", include_body=True) → body_location: {start_line: 2, end_line: 2}   body: "SOME_CONFIG" ```  The dict spans lines 3–12 (1-indexed) but `end_line` equals `start_line`.  **Step 2 — insert_after_symbol inserts inside the dict:**  ``` insert_after_symbol("SOME_CONFIG", "example.py", '\nNEW_CONSTANT = "inserted"\n') → OK ```  **Resulting file (broken):**  ```python """Minimal repro."""  SOME_CONFIG: dict[str, dict] = {   NEW_CONSTANT = "inserted"     "key_a": {         "value": 1,         "notes": "first entry
  **Post-Mortem & Fix Analysis**:
  > We dealt with this by forbidding to insert after constants and declarations. Unfortunately, there is no simple and reliable way to get the full body and make the insertion safe.
  > @Will-hxw I saw that you addressed this problem for the LSP backend. I think it's safer to just avoid such insertions, we instruct the agent to use insert_before instead or some other editing tool if no insertion tool else is suitable

- **Issue #1338** (2026-04-14): **Fix handling of read news**
  *Symptoms*: Current handling saves only a single id, which is insufficient. Add abstraction `ReadNews`, which we persist (backward-compatible).

- **Issue #1333** (2026-04-14): **rename_symbol skips .vue files unless find_referencing_symbols is called first**
  *Symptoms*: ## Bug Description    When calling `rename_symbol` on a TypeScript symbol (e.g. an enum) that is   referenced inside `.vue` files, the rename only applies to the defining `.ts` file.   References inside `<script setup>` blocks of `.vue` files are silently skipped.    If `find_referencing_symbols` is called first on the same symbol, the subsequent   `rename_symbol` correctly renames across all `.vue` files.    ## Root Cause    `request_references` calls `_ensure_vue_files_indexed_on_ts_server()` before   delegating to the TypeScript server. This method opens all `.vue` files via   `textDocument/didOpen` on the companion TS server, which is required for tsserver   to include them in rename edits.    `request_rename_symbol_edit` does not call `_ensure_vue_files_indexed_on_ts_server()`   — it delegates directly to the TS server without pre-indexing `.vue` files:    ```python   # vue_language_server.py   def request_rename_symbol_edit(self, ...):       with self._ts_server.open_file(relative_file_path):           return self._ts_server.request_rename_symbol_edit(...)  # .vue files not indexed   ```    Because `_vue_files_indexed` is `False` in a fresh session, tsserver only sees files   it already has open — i.e., the defining `.ts` file — and returns a rename edit for   that file only.    ## Steps to Reproduce    1. Vue 3 project with TypeScript   2. Define an enum in a `.ts` file, e.g. `FeatureFlags` in `useFeatureFlags.ts`   3. Use that enum in one or more `.vue` files   4. Cal
  **Post-Mortem & Fix Analysis**:
  > Thanks for the analysis and proposal, fixed in 1558a4e3bcf (with a general fix to ensure LS is operational before accepting requests and with an improved server startup, launching additional indexing in a background thread) 

- **Issue #1285** (2026-04-15): **YAML config rewrite causes docstrings following list items to be duplicated**
  *Symptoms*: This is an error in comment normalisation

- **Issue #1232** (2026-05-02): **Follow up after pinning all LS runtime deps - ensure configured version is honored**
  *Symptoms*: Currently for many LS we ignore the version if the binary can be found (we only download if we don't find).  We should consider putting the version into the path where we store the binaries. Also consider migration of some sort.  Idea for migration: For each LS we store the initially used version and we add a postfix to the path only for versions differing for that. Then no migration is necessary (assuming the users didn't override the version in the past - for a few LS it was possible)

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

### Incident Patch 1: `b90a2a11` (2026-10-05)
**Commit Message**: fix(kotlin): redirect idea.system.path to prevent stale /tmp dirs (#1130)

KLS is built on IntelliJ's platform, which by default creates a new
~52 MB idea-system<random>/ directory in /tmp for each instance.
These directories are never cleaned up on shutdown.

On tmpfs systems (the default on modern Linux) this causes unbounded
RAM consumption — e.g. 329 accumulated directories totalling 30 GiB
after repeated test runs.

Fix: append -Didea.system.path=<ls_resources_dir>/kotlin_language_server/system/
to JAVA_TOOL_OPTIONS in create_launch_command_env(). This redirects
IntelliJ to a fixed, bounded per-project cache directory that also
persists across sessions for faster restarts.

Fixes #1087

Co-authored-by: Dominik Jain <[REDACTED_EMAIL]>

**File**: `src/solidlsp/language_servers/kotlin_language_server.py` (modified, +19/-1)
```diff
@@ -14,6 +14,13 @@
     ls_specific_settings:
       kotlin:
         jvm_options: '-Xmx4G -XX:+UseG1GC'
+
+IntelliJ system directory:
+    KLS is built on IntelliJ's platform, which by default creates a new ~52 MB
+    idea-system<random>/ directory in /tmp for each instance. These directories
+    are never cleaned up, which can exhaust RAM on tmpfs systems after many runs.
+    Serena redirects idea.system.path to <ls_resources_dir>/kotlin_language_server/system/,
+    making it a bounded per-project cache that persists across sessions (faster restarts).
 """
 # SPDX-License-Identifier: MIT
 
@@ -279,7 +286,18 @@ def create_launch_command_env(self) -> dict[str, str]:
             else:
                 jvm_options = DEFAULT_KOTLIN_JVM_OPTIONS
 
-            env["JAVA_TOOL_OPTIONS"] = jvm_options
+            # Redirect IntelliJ's system directory to a stable path under ls_resources_dir.
+            # Without this, each KLS instance creates a new ~52 MB /tmp/idea-system<random>/ directory
+            # that is never removed on shutdown. On tmpfs systems this causes unbounded RAM consumption
+            # (e.g. 329 stale directories totalling 30 GiB after repeated test runs).
+            # Using a fixed path makes it a bounded per-project cache and preserves the IntelliJ index
+            # across sessions for faster restarts.
+            system_dir = os.path.join(self._ls_resources_dir, "system")
+            os.makedirs(system_dir, exist_ok=True)
+            idea_system_path_opt = f"-Didea.system.path={system_dir}"
+            jvm_options_full = f"{jvm_options} {idea_system_path_opt}".strip() if jvm_options else idea_system_path_opt
+
+            env["JAVA_TOOL_OPTIONS"] = jvm_options_full
             return env
 
     @override
```

---

### Incident Patch 2: `36c7adc2` (2026-10-05)
**Commit Message**: fix(editing): account for the exclusive match end in occurrence line numbers and diff preview (#2080)

* fix(editing): account for the exclusive match end in occurrence line numbers

`MultiFileContentReplacer.find_occurrences` derived `end_line` from the exclusive
`match.end()`, and `render_occurrence_diff` ran its window to the next line break
after it, so a pattern consuming a line break reported the following line as part
of the match and rendered that line as both removed and added. `search_text` in
the same module applies this rule already (#1708); the occurrence paths did not.
The preview now drops trailing lines the replacement leaves unchanged, which keeps
added lines and line merges visible.

* docs(changelog): reference the PR number, as the surrounding entries do

* fix(editing): omit the file's final line break from the occurrence diff

* `render_occurrence_diff` split its line window unconditionally, so a match
  that consumed the file's own final line break rendered the empty remainder
  behind that break as an additional removed line, i.e. as a line that does not
  exist in the file (a final line break terminates the last line, it does not
  start a further one)
* th

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -36,6 +36,12 @@ Status of the `main` branch. Changes prior to the next official version change w
   - Fix: process-tree cleanup signaled descendant language-server processes without waiting for them,
     which could leave grandchildren as zombies; cleanup now waits for the discovered descendants (#1464)
   - Fix: `read_only` restriction in project definition was not applied to base tool set when in single-project context (#1938)
+  - Fix: `MultiFileContentReplacer` accounted for the exclusivity of the match end in neither
+    `ReplacementOccurrence.end_line` nor the region rendered by `render_occurrence_diff`, so a
+    replacement whose pattern consumed a line break reported the match as ending on the following
+    line and displayed that line as both removed and added; a line break terminating a file was
+    likewise displayed as an additional line; this now applies the same rule `search_text` has used
+    since #1708 (#2080)
   - Fix: `SerenaConfig.project_names` / `project_paths` were cached and never invalidated after
     projects were added or removed mid-session, so user-facing project lists and error messages
     stayed stale; the lists are no longer cached
```

**File**: `src/serena/util/text_utils.py` (modified, +30/-2)
```diff
@@ -594,6 +594,14 @@ def find_occurrences(self, files: list[tuple[str, str]], needle: str, repl: str)
                 # matching again within the matched text indicates the match may have swallowed
                 # more than intended
                 is_ambiguous = "\n" in matched_text and pattern.search(matched_text[1:]) is not None
+
+                # the match end is exclusive, so a match that consumes a line break ends on the
+                # line before the one `match.end()` points at; `search_text` applies the same rule
+                start_line = content.count("\n", 0, match.start())
+                end_line = content.count("\n", 0, match.end())
+                if end_line > start_line and matched_text.endswith("\n"):
+                    end_line -= 1
+
                 occurrences.append(
                     ReplacementOccurrence(
                         occurrence_id=self.make_occurrence_id(relative_path, index_in_file, matched_text),
@@ -603,8 +611,8 @@ def find_occurrences(self, files: list[tuple[str, str]], needle: str, repl: str)
                         end=match.end(),
                         matched_text=matched_text,
                         replacement=replacement,
-                        start_line=content.count("\n", 0, match.start()),
-                        end_line=content.count("\n", 0, match.end()),
+                        start_line=start_line,
+                        end_line=end_line,
                         is_ambiguous=is_ambiguous,
                     )
                 )
@@ -655,6 +663,26 @@ def render_occurrence_diff(
             line_end = len(content)
         old_block = content[line_start:line_end]
         new_block = content[line_start : occ.start] + occ.replacement + content[occ.end : line_end]
+
+        # the file's final line break terminates the last line rather than starting a further one, so
+        # splitting an end-of-file window would materialize the empty remainder behind it as a phantom
+        # line; for a window ending before the file end, an empty remainder instead denotes a real
+        # blank line behind the match, which is merged away by it and therefore has to be shown
+        if line_end == len(content):
+            old_block = old_block.removesuffix("\n")
+            new_block = new_block.removesuffix("\n")
+
+        # the window runs to the next line break after the exclusive match end, so when the match
+        # itself consumed a line break the following line is included on both sides; drop such
+        # trailing lines, as a line the replacement leaves unchanged is not part of the change
+        old_lines = old_block.split("\n")
+        new_lines = new_block.split("\n")
+        while len(old_lines) > 1 and len(new_lines) > 1 and old_lines[-1] == new_lines[-1]:
+            old_lines.pop()
+            new_lines.pop()
+        old_block = "\n".join(old_lines)
+        new_block = "\n".join(new_lines)
+
         location = f"line {occ.start_line}" if occ.start_line == occ.end_line else f"lines {occ.start_line}-{occ.end_line}"
         header = f"  [{occ.occurrence_id}] {location}"
         if occ.is_ambiguous:
```

**File**: `test/serena/test_text_utils.py` (modified, +78/-0)
```diff
@@ -699,6 +699,84 @@ def test_apply_to_content_rejects_drifted_occurrence(self):
         with pytest.raises(AssertionError):
             replacer.apply_to_content("completely different content", [occ])
 
+    def test_match_consuming_a_line_break_ends_on_the_matched_line(self):
+        replacer = MultiFileContentReplacer(mode="literal")
+        occ = replacer.find_occurrences([("f.txt", "alpha\nbeta\ngamma\n")], "beta\n", "BETA\n")[0]
+        assert (occ.start_line, occ.end_line) == (1, 1)
+
+    def test_render_occurrence_diff_omits_the_line_after_a_line_break_match(self):
+        replacer = MultiFileContentReplacer(mode="literal")
+        content = "alpha\nbeta\ngamma\n"
+        occ = replacer.find_occurrences([("f.txt", content)], "beta\n", "BETA\n")[0]
+        diff = replacer.render_occurrence_diff(occ, content)
+        assert f"[{occ.occurrence_id}] line 1" in diff
+        assert diff.endswith("    - beta\n    + BETA")
+
+    def test_render_occurrence_diff_shows_lines_added_by_the_replacement(self):
+        replacer = MultiFileContentReplacer(mode="literal")
+        content = "alpha\nbeta\ngamma\n"
+        occ = replacer.find_occurrences([("f.txt", content)], "beta\n", "one\ntwo\n")[0]
+        diff = replacer.render_occurrence_diff(occ, content)
+        assert diff.endswith("    - beta\n    + one\n    + two")
+        assert "gamma" not in diff
+
+    def test_render_occurrence_diff_shows_lines_merged_by_a_removed_line_break(self):
+        replacer = MultiFileContentReplacer(mode="literal")
+        content = "alpha\nbeta\ngamma\n"
+        occ = replacer.find_occurrences([("f.txt", content)], "beta\n", "BETA")[0]
+        diff = replacer.render_occurrence_diff(occ, content)
+        assert f"[{occ.occurrence_id}] line 1" in diff
+        assert diff.endswith("    - beta\n    - gamma\n    + BETAgamma")
+
+    def test_render_occurrence_diff_omits_the_files_final_line_break_at_the_end_of_the_file(self):
+        replacer = MultiFileContentReplacer(mode="literal")
+        content = "alpha\nbeta\n"  # a single line "beta", terminated by the file's final line break
+        occ = replacer.find_occurrences([("f.txt", content)], "beta\n", "BETA")[0]
+        diff = replacer.render_occurrence_diff(occ, content)
+        assert f"[{occ.occurrence_id}] line 1" in diff
+        assert diff.endswith("    - beta\n    + BETA")
+
+    def test_render_occurrence_diff_omits_the_final_line_break_of_a_replacement_ending_the_file(self):
+        replacer = MultiFileContentReplacer(mode="literal")
+        content = "alpha\nbeta\n"
+        occ = replacer.find_occurrences([("f.txt", content)], "beta\n", "BETA\n")[0]
+        diff = replacer.render_occurrence_diff(occ, content)
+        assert diff.endswith("    - beta\n    + BETA")
+
+    def test_render_occurrence_diff_omits_the_final_line_break_of_a_multi_line_match_at_the_end_of_the_file(self):
+        replacer = MultiFileContentReplacer(mode="literal")
+        content = "alpha\nbeta\ngamma\n"
+        split_occ = replacer.find_occurrences([("f.txt", content)], "beta\ngamma\n", "BETA\nGAMMA")[0]
+        diff = replacer.render_occurrence_diff(split_occ, content)
+        assert f"[{split_occ.occurrence_id}] lines 1-2" in diff
+        assert diff.endswith("    - beta\n    - gamma\n    + BETA\n    + GAMMA")
+        merged_occ = replacer.find_occurrences([("f.txt", content)], "beta\ngamma\n", "BETA")[0]
+        assert replacer.render_occurrence_diff(merged_occ, content).endswith("    - beta\n    - gamma\n    + BETA")
+
+    def test_render_occurrence_diff_omits_the_final_line_break_in_a_crlf_file(self):
+        replacer = MultiFileContentReplacer(mode="literal")
+        content = "alpha\r\nbeta\r\n"
+        occ = replacer.find_occurrences([("f.txt", content)], "beta\r\n", "BETA")[0]
+        diff = replacer.render_occurrence_diff(occ, content)
+        assert diff.endswith("    - beta\r\n    + BETA")
+
+    def test_render_occurrence_diff_keeps_a_blank_last_line_that_the_match_consumes(self):
+        replacer = MultiFileContentReplacer(mode="literal")
+        content = "alpha\nbeta\n\n"  # lines "beta" and an empty one, both consumed by the match
+        occ = replacer.find_occurrences([("f.txt", content)], "beta\n\n", "BETA")[0]
+        diff = replacer.render_occurrence_diff(occ, content)
+        assert f"[{occ.occurrence_id}] lines 1-2" in diff
+        assert diff.endswith("    - beta\n    - \n    + BETA")
+
+    def test_render_occurrence_diff_for_a_match_spanning_the_whole_newline_terminated_file(self):
+        replacer = MultiFileContentReplacer(mode="literal")
+        content = "alpha\nbeta\n"
+        occ = replacer.find_occurrences([("f.txt", content)], "alpha\nbeta\n", "X")[0]
+        diff = replacer.render_occurrence_diff(occ, content)
+        assert diff.endswith("    - alpha\n    - beta\n    + X")
+        blank_occ = replacer.find_occurrences([("f.txt", "\n")], "\n", "X")[0]
+        assert replacer.render_occurrence_diff(
```

---

### Incident Patch 3: `b4a83eec` (2026-10-05)
**Commit Message**: Merge pull request #2033 from RizgarOzan/fix/csharp-discovery-ignored-paths

Fix: C# project discovery ignores configured ignore patterns

Fixes #1999

**File**: `CHANGELOG.md` (modified, +2/-0)
```diff
@@ -223,6 +223,8 @@ Status of the `main` branch. Changes prior to the next official version change w
     place the executable directly in `bin`, so activating an AL project failed with "AL Language
     Server executable not found" for users whose VS Code extension was on such a build. Both layouts
     are now probed, the platform subdirectory first (#2069)
+  - Fix: C# solution/project discovery traversed and opened paths matched by the configured ignore
+    patterns (incl. `.gitignore`), slowing down startup and loading ignored projects in Roslyn (#1999)
   - Remove support for migration of legacy cache format (document_symbols_cache_v23-06-25.pkl)
   - Fix: Avoid file/package symbols leaking into the high-level document symbol cache 
     as a result of `request_full_symbol_tree` linking document root symbols to file symbols
```

**File**: `src/solidlsp/language_servers/csharp_language_server.py` (modified, +16/-13)
```diff
@@ -9,14 +9,15 @@
 import shutil
 import tempfile
 import threading
-from collections.abc import Hashable, Iterable, Sequence
+from collections.abc import Callable, Hashable, Iterable, Sequence
 from dataclasses import replace
 from pathlib import Path
 from typing import Any, cast
 
 from overrides import override
 
 from serena.util.dotnet import DotNETUtil
+from serena.util.file_system import match_path
 from solidlsp.ls import (
     LanguageServerDependencyProvider,
     LSPFileBuffer,
@@ -139,10 +140,14 @@ def _runtime_dependencies_for_version(version: str) -> list[RuntimeDependency]:
     return result
 
 
-def breadth_first_file_scan(root_dir: str) -> Iterable[str]:
+def breadth_first_file_scan(root_dir: str, is_ignored_path: Callable[[str], bool] = lambda _: False) -> Iterable[str]:
     """
     Perform a breadth-first scan of files in the given directory.
     Yields file paths in breadth-first order.
+
+    :param root_dir: the directory to scan
+    :param is_ignored_path: predicate on paths relative to ``root_dir``; ignored directories are not traversed
+        and ignored files are not yielded
     """
     queue = [root_dir]
     while queue:
@@ -152,6 +157,8 @@ def breadth_first_file_scan(root_dir: str) -> Iterable[str]:
                 if item.startswith("."):
                     continue
                 item_path = os.path.join(current_dir, item)
+                if is_ignored_path(os.path.relpath(item_path, root_dir)):
+                    continue
                 if os.path.isdir(item_path):
                     queue.append(item_path)
                 elif os.path.isfile(item_path):
@@ -743,10 +750,15 @@ def _force_pull_diagnostics(self, init_response: dict | InitializeResult) -> Non
     def _open_solution_and_projects(self) -> None:
         """
         Open solution and project files using notifications.
+        Paths matched by the configured ignore patterns (e.g. from .gitignore) are neither traversed nor opened.
         """
+
+        def is_ignored_path(relative_path: str) -> bool:
+            return match_path(relative_path, self.get_ignore_spec(), root_path=self.repository_root_path)
+
         # Find solution file (.sln or .slnx)
         solution_file = None
-        for filename in breadth_first_file_scan(self.repository_root_path):
+        for filename in breadth_first_file_scan(self.repository_root_path, is_ignored_path):
             if filename.endswith((".sln", ".slnx")):
                 solution_file = filename
                 break
@@ -762,19 +774,10 @@ def _open_solution_and_projects(self) -> None:
         # server cannot restore or build. Each one costs a project load on every server start, and
         # the resulting restore failures bury the diagnostics of the projects the user cares about.
         project_files = []
-        skipped = 0
-        for filename in breadth_first_file_scan(self.repository_root_path):
+        for filename in breadth_first_file_scan(self.repository_root_path, is_ignored_path):
             if not filename.endswith(".csproj"):
                 continue
-            relative_path = os.path.relpath(filename, self.repository_root_path)
-            # ignore_unsupported_files=False, because a .csproj is not itself a C# source file and
-            # would otherwise be excluded on file type rather than by the ignore patterns.
-            if self.is_ignored_path(relative_path, ignore_unsupported_files=False):
-                skipped += 1
-                continue
             project_files.append(filename)
-        if skipped:
-            log.debug(f"Skipped {skipped} .csproj file(s) matched by the project's ignore settings")
 
         # Send project/open notifications for each project file
         if project_files:
```

**File**: `test/solidlsp/csharp/test_csharp_basic.py` (modified, +17/-0)
```diff
@@ -255,6 +255,23 @@ def test_breadth_first_file_scan(self):
             # file1.txt should be found first (breadth-first)
             assert filenames[0] == "file1.txt"
 
+    def test_breadth_first_file_scan_skips_ignored_paths(self):
+        """Test that breadth_first_file_scan neither yields ignored files nor traverses ignored directories."""
+        with tempfile.TemporaryDirectory() as temp_dir:
+            temp_path = Path(temp_dir)
+
+            # Create a project, an ignored directory containing a project and an ignored project file
+            (temp_path / "src").mkdir()
+            (temp_path / "src" / "App.csproj").touch()
+            (temp_path / "vendor" / "nested").mkdir(parents=True)
+            (temp_path / "vendor" / "nested" / "Vendored.csproj").touch()
+            (temp_path / "Generated.csproj").touch()
+
+            ignored_paths = {"vendor", "Generated.csproj"}
+            files = list(breadth_first_file_scan(str(temp_path), lambda relative_path: relative_path in ignored_paths))
+
+            assert [os.path.relpath(f, temp_path) for f in files] == [os.path.join("src", "App.csproj")]
+
     def test_find_solution_or_project_file_with_solution(self):
         """Test that find_solution_or_project_file prefers .sln files."""
         with tempfile.TemporaryDirectory() as temp_dir:
```

---

### Incident Patch 4: `1ead1ac9` (2026-10-05)
**Commit Message**: Fix: Update model used by Anthropic token estimator

**File**: `CHANGELOG.md` (modified, +1/-0)
```diff
@@ -511,6 +511,7 @@ CLI:
     instead of accepting the deletion (change in `TextUtils.delete_text_between_positions`,
     which now accepts the end position similar to `insert_text_at_position`).
   - Fix: glob pattern expansion in `expand_braces` did not terminate with empty or unbalanced braces #1690
+  - Fix: Update model used by Anthropic token estimator
 
 * CLI:
   - Fix `--project-from-cwd` hijacking git worktrees nested under a Serena project. `find_project_root`
```

**File**: `src/serena/analytics.py` (modified, +2/-2)
```diff
@@ -58,7 +58,7 @@ class AnthropicTokenCount(TokenCountEstimator):
     See https://docs.anthropic.com/en/docs/build-with-claude/token-counting
     """
 
-    def __init__(self, model_name: str = "claude-sonnet-4-20250514", api_key: str | None = None):
+    def __init__(self, model_name: str, api_key: str | None = None):
         import anthropic
 
         self._model_name = model_name
@@ -109,7 +109,7 @@ def _create_estimator(self) -> TokenCountEstimator:
             case RegisteredTokenCountEstimator.TIKTOKEN_GPT4O:
                 return TiktokenCountEstimator(model_name="gpt-4o")
             case RegisteredTokenCountEstimator.ANTHROPIC_CLAUDE_SONNET_4:
-                return AnthropicTokenCount(model_name="claude-sonnet-4-20250514")
+                return AnthropicTokenCount(model_name="claude-sonnet-4-6")
             case RegisteredTokenCountEstimator.CHAR_COUNT:
                 return CharCountEstimator(avg_chars_per_token=4)
             case _:
```

---

### Incident Patch 5: `e5c13151` (2026-10-05)
**Commit Message**: scala: default to Metals 1.6.8 so sbt 2 builds can be imported (#1846)

Metals 1.6.4 bootstraps sbt-bloop 2.0.17, which publishes an sbt 1 artefact
but no sbt 2 one, so on an sbt 2 build `bloopInstall` dies on an unresolvable
plugin and no build server is ever started. With no build target Metals falls
back to a standalone presentation compiler, so the failure is quiet: queries
within a single file still answer, and everything needing the build — cross-file
references in particular — silently returns nothing.

The failed import also leaves auto-generated `metals.sbt` files behind pinning
the unresolvable plugin, which breaks the user's own sbt until they are deleted.

Metals 1.6.8 bootstraps sbt-bloop 2.1.1, which is published for sbt 2. It is
the current stable Metals release; sbt-bloop has shipped an sbt 2 artefact
since 2.0.18.

The existing Scala test fixture is an sbt 1 project (sbt.version=1.10.1), so
the suite exercises the population this could regress.

Co-authored-by: Dr. Dominik Jain <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -111,6 +111,9 @@ Status of the `main` branch. Changes prior to the next official version change w
     thread (#2038)
 
 * Language Servers:
+  - Scala: bump the default Metals version from 1.6.4 to 1.6.8. 1.6.4 bootstraps sbt-bloop 2.0.17,
+    which is not published for sbt 2, so `bloopInstall` fails to resolve and no build server is ever
+    started for an sbt 2 project.
   - Fix: `SafeZipExtractor` discarded Unix executable permission bits stored in extracted
     archives' `ZipInfo.external_attr` (a long-standing stdlib `zipfile` limitation,
     tracked upstream at https://github.com/python/cpython/pull/150061), leaving every
```

**File**: `docs/02-usage/050_configuration.md` (modified, +1/-1)
```diff
@@ -1154,7 +1154,7 @@ Supported settings:
 
 | Setting | Default | Description |
 |---|---|---|
-| `metals_version` | `1.6.4` | Override the Metals version Serena bootstraps. |
+| `metals_version` | `1.6.8` | Override the Metals version Serena bootstraps. |
 | `client_name` | `Serena` | Client identifier sent to Metals. |
 | `on_stale_lock` | `auto-clean` | How Serena handles stale Metals H2 database locks. Supported values: `auto-clean`, `warn`, `fail`. |
 | `log_multi_instance_notice` | `true` | Log a notice when another Metals instance is detected. |
```

**File**: `src/solidlsp/language_servers/scala_language_server.py` (modified, +2/-2)
```diff
@@ -28,7 +28,7 @@
 log = logging.getLogger(__name__)
 
 # Default configuration constants
-DEFAULT_METALS_VERSION = "1.6.4"
+DEFAULT_METALS_VERSION = "1.6.8"
 DEFAULT_CLIENT_NAME = "Serena"
 DEFAULT_ON_STALE_LOCK = "auto-clean"
 DEFAULT_LOG_MULTI_INSTANCE_NOTICE = True
@@ -465,7 +465,7 @@ class ScalaLanguageServer(SolidLanguageServer):
             # Log notice when another Metals instance is detected
             log_multi_instance_notice: true
             # Metals version to bootstrap (default: DEFAULT_METALS_VERSION)
-            metals_version: '1.6.4'
+            metals_version: '1.6.8'
             # Client identifier sent to Metals (default: DEFAULT_CLIENT_NAME)
             client_name: 'Serena'
             # Answer Metals' build-import prompts affirmatively, which lets it run the project's
```

---

### Incident Patch 6: `a8e30ff5` (2026-10-05)
**Commit Message**: fix: lock the cross-process reload-merge-write in _persist_projects (#2111)

Two overlapping calls (separate processes or threads) could each read the
disk copy before the other wrote, so the later write silently discarded
whichever change was not yet on disk. Wraps the reload-merge-write in a
filelock.FileLock, already a dependency and already used this way in
serena/jetbrains/launch_coordinator.py.

Fixes #2101

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -24,6 +24,9 @@ Status of the `main` branch. Changes prior to the next official version change w
     actually used; the unconditional import added seconds to CLI/MCP startup on some machines (#2012)
   - Fix: Parallel agents auto-registering projects could overwrite each other's changes to the global
     project list in `serena_config.yml`
+  - Fix: the reload-merge-write in `_persist_projects` (the residual half of the fix above) had no
+    cross-process lock, so two Serena instances could still lose a registration change if their
+    persist calls overlapped; it is now wrapped in a `filelock.FileLock` (#2101)
   - Perf: `search_for_pattern` resolved each match's line number by rescanning the file from the
     beginning (O(n) per match, O(n*m) total for m matches); coordinates are now resolved via the new
     `TextCoordinates` abstraction (cached line starts + binary search)
```

**File**: `src/serena/config/serena_config.py` (modified, +28/-21)
```diff
@@ -19,6 +19,7 @@
 from uuid import uuid4
 
 import yaml
+from filelock import FileLock
 from ruamel.yaml.comments import CommentedMap
 from sensai.util import logging
 from sensai.util.logging import LogTime, datetime_tag
@@ -1378,31 +1379,37 @@ def _persist_projects(self) -> None:
         removals and additions from changes made by another process: unchanged baseline projects
         follow the current disk copy, while removed baseline projects are filtered out and newly
         added instance projects are appended.
+
+        The reload-merge-write sequence is itself not atomic, so it is wrapped in a cross-process
+        file lock: without it, two agent processes racing through this method can each read the
+        disk copy before the other writes, and the later write silently discards whichever
+        process's change was not yet on disk when the other one read.
         """
         if self.config_file_path is None:
             return
 
-        persisted = SerenaConfig.from_config_file()
-        current_projects_by_path = {str(project.project_root): project for project in self.projects}
-        current_paths = set(current_projects_by_path)
-        removed_paths = self._projects_at_load - current_paths
-        added_paths = current_paths - self._projects_at_load
-
-        combined_projects = []
-        handled_project_paths = set()
-        for project in persisted.projects:
-            project_path = str(project.project_root)
-            if project_path not in removed_paths:
-                combined_projects.append(project)
-                handled_project_paths.add(project_path)
-        for project_path in added_paths:
-            if project_path not in handled_project_paths:
-                combined_projects.append(current_projects_by_path[project_path])
-                handled_project_paths.add(project_path)
-
-        persisted.projects = combined_projects
-        persisted._save()
-        self._projects_at_load = current_paths
+        with FileLock(self.config_file_path + ".lock"):
+            persisted = SerenaConfig.from_config_file()
+            current_projects_by_path = {str(project.project_root): project for project in self.projects}
+            current_paths = set(current_projects_by_path)
+            removed_paths = self._projects_at_load - current_paths
+            added_paths = current_paths - self._projects_at_load
+
+            combined_projects = []
+            handled_project_paths = set()
+            for project in persisted.projects:
+                project_path = str(project.project_root)
+                if project_path not in removed_paths:
+                    combined_projects.append(project)
+                    handled_project_paths.add(project_path)
+            for project_path in added_paths:
+                if project_path not in handled_project_paths:
+                    combined_projects.append(current_projects_by_path[project_path])
+                    handled_project_paths.add(project_path)
+
+            persisted.projects = combined_projects
+            persisted._save()
+            self._projects_at_load = current_paths
 
     def _save(self) -> None:
         """
```

**File**: `test/serena/config/test_serena_config.py` (modified, +63/-0)
```diff
@@ -2,8 +2,10 @@
 import os
 import shutil
 import tempfile
+import threading
 from copy import deepcopy
 from pathlib import Path
+from typing import Any
 from uuid import UUID
 
 import pytest
@@ -771,6 +773,67 @@ def test_add_project_preserves_concurrent_removal(self):
         reloaded = SerenaConfig.from_config_file(generate_if_missing=False)
         assert {project.project_config.project_name for project in reloaded.projects} == {"project1", "project3"}
 
+    def test_persist_projects_serializes_overlapping_reads_and_writes(self, monkeypatch):
+        """A write started before another process's write must not clobber it with a stale read.
+
+        The two tests above call ``remove_project``/``add_project_from_path`` back to back, so
+        by the time the second one reads the disk copy, the first one has already finished
+        writing it; there is no actual overlap between the two. Here the first call's disk read
+        is held open on a background thread until a second, independent call has fully read,
+        merged and written its own change, reproducing the interleaving that two concurrent
+        agent processes can hit.
+        """
+        p1 = self._make_project_dir("project1", 'project_name: "project1"\nlanguages: ["python"]\n')
+        p2 = self._make_project_dir("project2", 'project_name: "project2"\nlanguages: ["python"]\n')
+        p3 = self._make_project_dir("project3", 'project_name: "project3"\nlanguages: ["python"]\n')
+        self._write_master_config([p1, p2])
+
+        adding_config = SerenaConfig.from_config_file(generate_if_missing=False)
+        removing_config = SerenaConfig.from_config_file(generate_if_missing=False)
+        adding_config.projects.append(RegisteredProject.from_project_root(p3, serena_config=adding_config))
+        for i, project in enumerate(list(removing_config.projects)):
+            if project.project_name == "project2":
+                del removing_config.projects[i]
+                break
+
+        real_from_config_file = SerenaConfig.from_config_file.__func__
+        first_read_started = threading.Event()
+        first_call_may_write = threading.Event()
+        call_count = {"n": 0}
+
+        def paused_from_config_file(cls: type[SerenaConfig], *args: Any, **kwargs: Any) -> SerenaConfig:
+            call_count["n"] += 1
+            result = real_from_config_file(cls, *args, **kwargs)
+            if call_count["n"] == 1:
+                first_read_started.set()
+                assert first_call_may_write.wait(timeout=5), "test never released the paused first call"
+            return result
+
+        monkeypatch.setattr(SerenaConfig, "from_config_file", classmethod(paused_from_config_file))
+
+        adder_thread = threading.Thread(target=adding_config._persist_projects)
+        adder_thread.start()
+        assert first_read_started.wait(timeout=5), "adding_config never reached its disk read"
+
+        # Run the second call on its own thread too: with the fix, it blocks acquiring the same
+        # lock the paused first call is still holding, so calling it inline here would deadlock.
+        # Do not use a sleep to guess whether it got a chance to run: join with a timeout instead,
+        # so the outcome depends on the lock actually blocking it, not on scheduler luck. Without
+        # the fix, nothing blocks it and it always finishes well inside the timeout; with the fix,
+        # it is still blocked on the lock the paused first call holds, so it never does.
+        remover_thread = threading.Thread(target=removing_config._persist_projects)
+        remover_thread.start()
+        remover_thread.join(timeout=1)
+
+        first_call_may_write.set()
+        adder_thread.join(timeout=5)
+        remover_thread.join(timeout=5)
+        assert not adder_thread.is_alive()
+        assert not remover_thread.is_alive()
+
+        reloaded = SerenaConfig.from_config_file(generate_if_missing=False)
+        assert {project.project_config.project_name for project in reloaded.projects} == {"project1", "project3"}
+
 
 class TestGetRegisteredProjectWithDanglingProject:
     """A registered project whose root directory was deleted (e.g. a removed git
```

---

### Incident Patch 7: `cd7c5781` (2026-10-05)
**Commit Message**: fix(kotlin): remove the leaked fallback storage directory on release (#2113)

DependencyProvider._claim_storage_dir falls back to a per-process directory
when the shared, deterministic storage directory is already locked by another
concurrent Serena instance (#1982). release_storage_lock only released
self._storage_lock, which stays None on the fallback path, so the release was
a no-op there and nothing else in the object's lifecycle ever removed the
directory. Every lock collision leaked one of these multi-MB IntelliJ index
directories permanently.

Track whether the claimed directory is the fallback one and remove it in
release_storage_lock when it is; the primary, deterministic directory is
untouched so a restarted single instance keeps reusing its index.

Fixes #2112

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -200,6 +200,9 @@ Status of the `main` branch. Changes prior to the next official version change w
     storage directory via a lock; a single instance (including across restarts) still gets the
     same directory, and a second concurrent instance gets a directory of its own instead of
     contending for the first one's (#1966)
+  - Fix: the per-instance fallback storage directory introduced by the concurrent-instance fix above
+    was never removed, so every lock collision permanently leaked a multi-MB IntelliJ index directory;
+    it is now deleted when the instance releases its storage lock
   - Fix: document symbol caching did not account for language-server-specific post-processing of
     symbols, which was applied outside the caches; the processing of language servers that post-process
     symbols (e.g. Go, Nix, Fortran, F#, Vue) was therefore repeated on every request or, if it mutated
```

**File**: `src/solidlsp/language_servers/kotlin_language_server.py` (modified, +8/-1)
```diff
@@ -20,6 +20,7 @@
 import logging
 import os
 import pathlib
+import shutil
 import stat
 import threading
 from dataclasses import dataclass
@@ -120,6 +121,7 @@ class DependencyProvider(LanguageServerDependencyProviderSinglePath):
         def __init__(self, custom_settings: SolidLSPSettings.CustomLSSettings, ls_resources_dir: str, project_cache_dir: str):
             super().__init__(custom_settings, ls_resources_dir)
             self._storage_lock: FileLock | None = None
+            self._is_fallback_storage_dir = False
             self.storage_dir = self._claim_storage_dir(project_cache_dir)
 
         def _claim_storage_dir(self, project_cache_dir: str) -> str:
@@ -129,14 +131,16 @@ def _claim_storage_dir(self, project_cache_dir: str) -> str:
             single Serena instance keeps reusing its index across restarts (the primary use case, which must
             not regress). If another live Serena instance already holds that directory (concurrent sessions
             on the same project, see oraios/serena#1966), falls back to a directory unique to this process
-            instead of two Kotlin LSP processes contending for the same index.
+            instead of two Kotlin LSP processes contending for the same index. That fallback directory is
+            this instance's alone, so it is removed once the instance releases it (see release_storage_lock).
             """
             lock = FileLock(f"{project_cache_dir}.lock")
             try:
                 lock.acquire(timeout=0)
             except Timeout:
                 instance_dir = f"{project_cache_dir}-instance-{os.getpid()}"
                 os.makedirs(instance_dir, exist_ok=True)
+                self._is_fallback_storage_dir = True
                 log.info(
                     "Kotlin LSP storage directory %s is in use by another Serena instance; using %s for this instance",
                     project_cache_dir,
@@ -147,6 +151,9 @@ def _claim_storage_dir(self, project_cache_dir: str) -> str:
             return project_cache_dir
 
         def release_storage_lock(self) -> None:
+            if self._is_fallback_storage_dir:
+                shutil.rmtree(self.storage_dir, ignore_errors=True)
+                self._is_fallback_storage_dir = False
             if self._storage_lock is not None:
                 self._storage_lock.release()
                 self._storage_lock = None
```

**File**: `test/solidlsp/kotlin/test_kotlin_dependency_provider.py` (modified, +27/-0)
```diff
@@ -1,5 +1,6 @@
 """Tests for Kotlin Language Server dependency resolution and installation."""
 
+import os
 from contextlib import nullcontext
 from pathlib import Path
 from unittest.mock import patch
@@ -299,6 +300,32 @@ def test_storage_dir_is_reclaimed_once_the_first_instance_releases_it(self, tmp_
         finally:
             second.release_storage_lock()
 
+    def test_fallback_storage_dir_is_removed_on_release(self, tmp_path: Path) -> None:
+        """The second instance's fallback directory (oraios/serena#1966) must not survive its
+        own release, or every lock collision leaks a multi-MB IntelliJ index directory forever.
+        """
+        first = _make_provider(tmp_path)
+        second = _make_provider(tmp_path)
+        try:
+            assert os.path.isdir(second.storage_dir)
+            second.release_storage_lock()
+            assert not os.path.exists(second.storage_dir)
+        finally:
+            first.release_storage_lock()
+
+    def test_primary_storage_dir_survives_release(self, tmp_path: Path) -> None:
+        """The deterministic per-project directory must persist after release: it is the
+        index cache a restarted single instance is meant to reuse.
+        """
+        provider = _make_provider(tmp_path)
+        os.makedirs(provider.storage_dir, exist_ok=True)
+        index_marker = Path(provider.storage_dir) / "index-marker"
+        index_marker.write_text("kotlin lsp index data", encoding="utf-8")
+
+        provider.release_storage_lock()
+
+        assert index_marker.exists()
+
     def test_concurrent_instances_get_different_system_path_arguments(self, tmp_path: Path) -> None:
         launcher = "/path/to/intellij-server"
         first = _make_provider(tmp_path, {"ls_path": launcher})
```

---

### Incident Patch 8: `e7481319` (2026-10-05)
**Commit Message**: fix: send languageId typescriptreact for .tsx files in vtsls (#1993)

Co-authored-by: chad-loder <[REDACTED_EMAIL]>

**File**: `src/solidlsp/language_servers/vts_language_server.py` (modified, +9/-0)
```diff
@@ -73,6 +73,15 @@ def is_ignored_dirname(self, dirname: str) -> bool:
             "build",
         ]
 
+    def _get_language_id_for_file(self, relative_file_path: str) -> str:
+        # JSX is parsed as TS without this, which silently truncates symbol
+        # ranges at the first multi-line JSX expression.
+        if relative_file_path.endswith(".tsx"):
+            return "typescriptreact"
+        if relative_file_path.endswith(".jsx"):
+            return "javascriptreact"
+        return self.language_id
+
     @classmethod
     def _setup_runtime_dependencies(cls, config: LanguageServerConfig, solidlsp_settings: SolidLSPSettings) -> str:
         """
```

---

### Incident Patch 9: `a8059c11` (2026-10-04)
**Commit Message**: Merge pull request #2132 from oraios/fix-2126-cache-issue

Fix: Avoid file/package symbols leaking into the high-level document symbol cache

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -210,6 +210,9 @@ Status of the `main` branch. Changes prior to the next official version change w
     Server executable not found" for users whose VS Code extension was on such a build. Both layouts
     are now probed, the platform subdirectory first (#2069)
   - Remove support for migration of legacy cache format (document_symbols_cache_v23-06-25.pkl)
+  - Fix: Avoid file/package symbols leaking into the high-level document symbol cache 
+    as a result of `request_full_symbol_tree` linking document root symbols to file symbols
+    by modifying the cached symbols in place; shallow copies are now made before linking (#2126)
 
 CLI:
   - Fix `project index-file` command not using only the relevant language server to index the given file (#1965)
```

**File**: `src/solidlsp/ls.py` (modified, +5/-2)
```diff
@@ -358,7 +358,7 @@ class SolidLanguageServer(ABC):
     the LS-specific version should be incremented instead.
     """
     RAW_DOCUMENT_SYMBOL_CACHE_FILENAME = "raw_document_symbols.pkl"
-    DOCUMENT_SYMBOL_CACHE_VERSION = 4
+    DOCUMENT_SYMBOL_CACHE_VERSION = 5
     """
     defines the version of the high-level document symbol format.
     This should be incremented whenever there is a change in the way document symbols are stored.
@@ -2173,7 +2173,10 @@ def process_directory(abs_dir_path: str) -> list[ls_types.UnifiedSymbolInformati
                 elif os.path.isfile(contained_dir_or_file_abs_path):
                     with self._open_file_context(contained_dir_or_file_rel_path, open_in_ls=False) as file_data:
                         document_symbols = self.request_document_symbols(contained_dir_or_file_rel_path, file_data)
-                        file_root_nodes = document_symbols.root_symbols
+
+                        # create shallow copies of the document root symbols to avoid modifying the cached symbols
+                        # when linking them to the file symbol #2126
+                        file_root_nodes = [r.copy() for r in document_symbols.root_symbols]
 
                         # Create file symbol, link with children
                         file_range = self._get_range_from_file_content(file_data.contents)
```

**File**: `test/solidlsp/python/test_symbol_retrieval.py` (modified, +2/-2)
```diff
@@ -353,7 +353,7 @@ def test_symbol_tree_structure(self, language_server: SolidLanguageServer) -> No
             _, user_management_roots = language_server.request_document_symbols(
                 os.path.join("examples", "user_management.py")
             ).get_all_symbols_and_roots()
-            assert user_management_roots == user_management_node["children"]
+            assert len(user_management_roots) == len(user_management_node["children"])
 
     @pytest.mark.parametrize("language_server", PYTHON_BACKEND_LANGUAGES, indirect=True)
     def test_symbol_tree_structure_subdir(self, language_server: SolidLanguageServer) -> None:
@@ -376,7 +376,7 @@ def test_symbol_tree_structure_subdir(self, language_server: SolidLanguageServer
             _, user_management_roots = language_server.request_document_symbols(
                 os.path.join("examples", "user_management.py")
             ).get_all_symbols_and_roots()
-            assert user_management_roots == user_management_node["children"]
+            assert len(user_management_roots) == len(user_management_node["children"])
 
     @pytest.mark.parametrize("language_server", PYTHON_BACKEND_LANGUAGES, indirect=True)
     def test_request_dir_overview(self, language_server: SolidLanguageServer) -> None:
```

---

### Incident Patch 10: `8ac0fade` (2026-10-04)
**Commit Message**: Fix: Avoid file/package symbols leaking into the high-level document symbol cache
     as a result of `request_full_symbol_tree` linking document root symbols to file symbols
     by modifying the cached symbols in place; shallow copies are now made before linking.

Old caches are invalidated (high-level cache version incremented)

Resolves #2126

**File**: `CHANGELOG.md` (modified, +3/-0)
```diff
@@ -210,6 +210,9 @@ Status of the `main` branch. Changes prior to the next official version change w
     Server executable not found" for users whose VS Code extension was on such a build. Both layouts
     are now probed, the platform subdirectory first (#2069)
   - Remove support for migration of legacy cache format (document_symbols_cache_v23-06-25.pkl)
+  - Fix: Avoid file/package symbols leaking into the high-level document symbol cache 
+    as a result of `request_full_symbol_tree` linking document root symbols to file symbols
+    by modifying the cached symbols in place; shallow copies are now made before linking (#2126)
 
 CLI:
   - Fix `project index-file` command not using only the relevant language server to index the given file (#1965)
```

**File**: `src/solidlsp/ls.py` (modified, +5/-2)
```diff
@@ -358,7 +358,7 @@ class SolidLanguageServer(ABC):
     the LS-specific version should be incremented instead.
     """
     RAW_DOCUMENT_SYMBOL_CACHE_FILENAME = "raw_document_symbols.pkl"
-    DOCUMENT_SYMBOL_CACHE_VERSION = 4
+    DOCUMENT_SYMBOL_CACHE_VERSION = 5
     """
     defines the version of the high-level document symbol format.
     This should be incremented whenever there is a change in the way document symbols are stored.
@@ -2173,7 +2173,10 @@ def process_directory(abs_dir_path: str) -> list[ls_types.UnifiedSymbolInformati
                 elif os.path.isfile(contained_dir_or_file_abs_path):
                     with self._open_file_context(contained_dir_or_file_rel_path, open_in_ls=False) as file_data:
                         document_symbols = self.request_document_symbols(contained_dir_or_file_rel_path, file_data)
-                        file_root_nodes = document_symbols.root_symbols
+
+                        # create shallow copies of the document root symbols to avoid modifying the cached symbols
+                        # when linking them to the file symbol #2126
+                        file_root_nodes = [r.copy() for r in document_symbols.root_symbols]
 
                         # Create file symbol, link with children
                         file_range = self._get_range_from_file_content(file_data.contents)
```

**File**: `test/solidlsp/python/test_symbol_retrieval.py` (modified, +2/-2)
```diff
@@ -353,7 +353,7 @@ def test_symbol_tree_structure(self, language_server: SolidLanguageServer) -> No
             _, user_management_roots = language_server.request_document_symbols(
                 os.path.join("examples", "user_management.py")
             ).get_all_symbols_and_roots()
-            assert user_management_roots == user_management_node["children"]
+            assert len(user_management_roots) == len(user_management_node["children"])
 
     @pytest.mark.parametrize("language_server", PYTHON_BACKEND_LANGUAGES, indirect=True)
     def test_symbol_tree_structure_subdir(self, language_server: SolidLanguageServer) -> None:
@@ -376,7 +376,7 @@ def test_symbol_tree_structure_subdir(self, language_server: SolidLanguageServer
             _, user_management_roots = language_server.request_document_symbols(
                 os.path.join("examples", "user_management.py")
             ).get_all_symbols_and_roots()
-            assert user_management_roots == user_management_node["children"]
+            assert len(user_management_roots) == len(user_management_node["children"])
 
     @pytest.mark.parametrize("language_server", PYTHON_BACKEND_LANGUAGES, indirect=True)
     def test_request_dir_overview(self, language_server: SolidLanguageServer) -> None:
```

---

### Incident Patch 11: `53f36815` (2026-10-04)
**Commit Message**: Fix document structure

**File**: `CONTRIBUTING.md` (modified, +6/-6)
```diff
@@ -14,6 +14,10 @@ For other changes, please open an issue first to discuss your ideas with the mai
 Do not submit pull requests for beta features (unless they are trivial bug fixes); instead, provide feedback via issues or discussions.
 At present, the Serena REPL is a beta feature.
 
+### Adding Support for a New Language Server
+
+See the corresponding [memory](.serena/memories/adding_new_language_support_guide.md).
+
 ## Licensing and Contributor License Agreement (CLA)
 
 Serena is multi-licensed by component (see [LICENSE](LICENSE)):
@@ -38,15 +42,11 @@ When adding new source files, include the SPDX identifier that matches the compo
 `# SPDX-License-Identifier: GPL-3.0-or-later` for Serena application code and
 `# SPDX-License-Identifier: MIT` for SolidLSP.
 
+## Submitting Pull Requests
+
 When submitting a PR, ensure a well-defined scope.
 Every PR should cover a single logical change or a set of closely related changes.
 
-### Adding Support for a New Language Server
-
-See the corresponding [memory](.serena/memories/adding_new_language_support_guide.md).
-
-## Submitting Pull Requests
-
 Before submitting a PR, be sure to document your relevant changes (i.e. new features, fixes) in `CHANGELOG.md`;
 documentation changes should not be included.
 Use a concise style and add your change to the appropriate section
```

---

### Incident Patch 12: `d99d933b` (2026-09-30)
**Commit Message**: Refactoring: Drop suffix naming scheme for language backends

**File**: `src/serena/jetbrains/jetbrains_backend.py` (modified, +2/-1)
```diff
@@ -21,7 +21,7 @@
 log = logging.getLogger(__name__)
 
 
-class LanguageBackendJetBrains(LanguageBackend):
+class JetBrainsLanguageBackend(LanguageBackend):
     def __init__(self, key: str | None = None):
         super().__init__(key or BuiltinLanguageBackend.JETBRAINS.value)
 
@@ -66,6 +66,7 @@ def init_active_project(self, agent: "SerenaAgent") -> None:
 
     @override
     def shutdown_active_project(self, project: "Project", timeout: float) -> None:
+        # Do nothing; IDE lifecycle is user-controlled
         pass
 
     @override
```

**File**: `src/serena/language_backend.py` (modified, +6/-6)
```diff
@@ -153,17 +153,17 @@ def from_str(backend_str: str) -> "BuiltinLanguageBackend":
     @cache
     def get_instance(self) -> LanguageBackend:
         if self == BuiltinLanguageBackend.LSP:
-            from .lsp.lsp_backend import LanguageBackendLSP
+            from .lsp.lsp_backend import LSPLanguageBackend
 
-            return LanguageBackendLSP()
+            return LSPLanguageBackend()
         elif self == BuiltinLanguageBackend.JETBRAINS:
-            from .jetbrains.jetbrains_backend import LanguageBackendJetBrains
+            from .jetbrains.jetbrains_backend import JetBrainsLanguageBackend
 
-            return LanguageBackendJetBrains()
+            return JetBrainsLanguageBackend()
         elif self == BuiltinLanguageBackend.OLB_JVM:
-            from .olb.olb_jvm_backend import LanguageBackendOraiosJVM
+            from .olb.olb_jvm_backend import OraiosJVMLanguageBackend
 
-            return LanguageBackendOraiosJVM()
+            return OraiosJVMLanguageBackend()
         else:
             raise NotImplementedError
 
```

**File**: `src/serena/lsp/lsp_backend.py` (modified, +1/-1)
```diff
@@ -18,7 +18,7 @@
 log = logging.getLogger(__name__)
 
 
-class LanguageBackendLSP(LanguageBackend):
+class LSPLanguageBackend(LanguageBackend):
     def __init__(self):
         super().__init__(BuiltinLanguageBackend.LSP.value)
 
```

**File**: `src/serena/olb/olb_jvm_backend.py` (modified, +7/-2)
```diff
@@ -2,15 +2,20 @@
 from typing import TYPE_CHECKING
 
 from serena.jetbrains import launch_coordinator
-from serena.jetbrains.jetbrains_backend import LanguageBackendJetBrains
+from serena.jetbrains.jetbrains_backend import JetBrainsLanguageBackend
 from serena.language_backend import BuiltinLanguageBackend
 
 if TYPE_CHECKING:
     from serena.agent import SerenaAgent
     from serena.repl.facade import ApiScope, Facade
 
 
-class LanguageBackendOraiosJVM(LanguageBackendJetBrains):
+class OraiosJVMLanguageBackend(JetBrainsLanguageBackend):
+    """
+    The Oraios Language Backend (OLB) for JVM-based languages (Java, Kotlin, Groovy).
+    This is a drop-in replacement for the JetBrains backend.
+    """
+
     def __init__(self):
         super().__init__(key=BuiltinLanguageBackend.OLB_JVM.value)
 
```

---

### Incident Patch 13: `7a296833` (2026-09-24)
**Commit Message**: fix(cli): correct duplicated "IS" in ignored-path check output (#2103)

**File**: `src/serena/cli.py` (modified, +1/-1)
```diff
@@ -902,7 +902,7 @@ def is_ignored_path(path: str, project: str) -> None:
         if os.path.isabs(path):
             path = os.path.relpath(path, start=proj.project_root)
         is_ignored = proj.is_ignored_path(path)
-        click.echo(f"Path '{path}' IS {'ignored' if is_ignored else 'IS NOT ignored'} by the project configuration.")
+        click.echo(f"Path '{path}' {'IS' if is_ignored else 'IS NOT'} ignored by the project configuration.")
 
     @staticmethod
     @click.command(
```

---

### Incident Patch 14: `b83b655c` (2026-09-23)
**Commit Message**: fix: zip extract permission bits (#2102)

* Restore Unix executable bits when extracting zip archives

- SafeZipExtractor._extract_member now chmods each extracted file with the
  Unix mode stored in ZipInfo.external_attr (POSIX only, no-op when the
  archive carries no Unix attributes, e.g. Windows-authored zips).
- stdlib zipfile never restores permission bits itself; a fix is tracked
  upstream at https://github.com/python/cpython/pull/150061.
- Fixes archives with more than one executable losing their exec bit after
  extraction, e.g. the bundled JBR inside the Kotlin Language Server
  distribution (jbr/bin/java and native libs), which previously only had
  its single top-level launcher script chmod'd by the language-server code.

Fixes oraios/serena#2100

---------

Co-authored-by: Copilot <[REDACTED_EMAIL]>

**File**: `CHANGELOG.md` (modified, +8/-0)
```diff
@@ -107,6 +107,14 @@ Status of the `main` branch. Changes prior to the next official version change w
     thread (#2038)
 
 * Language Servers:
+  - Fix: `SafeZipExtractor` discarded Unix executable permission bits stored in extracted
+    archives' `ZipInfo.external_attr` (a long-standing stdlib `zipfile` limitation,
+    tracked upstream at https://github.com/python/cpython/pull/150061), leaving every
+    extracted file with default, non-executable permissions. This broke language servers
+    whose archive contains more than the single top-level launcher script that
+    per-language-server setup code re-chmods, e.g. the Kotlin Language Server's bundled
+    JetBrains Runtime (`jbr/bin/java` and native libs), whose launcher failed to exec it
+    with a permission error. Executable bits are now restored for every extracted file (#2100)
   - Add Astro language server support via `@astrojs/language-server` with a companion TypeScript language server (`@astrojs/ts-plugin`) for cross-file code intelligence (#2085)
   - Fix: Dart analysis server no longer receives rootUri/rootPath, which added the monorepo root as an extra analysis root and could pin a CPU core at idle (#2045)
   - Fix: The C# language server opened every `.csproj` found anywhere under the repository root,
```

**File**: `src/solidlsp/util/zip.py` (modified, +7/-0)
```diff
@@ -101,6 +101,13 @@ def _extract_member(self, zip_ref: zipfile.ZipFile, member: zipfile.ZipInfo) ->
             with zip_ref.open(member) as source, open(final_path, "wb") as target:
                 target.write(source.read())
 
+            # stdlib zipfile does not restore Unix permission bits on extraction; tracked
+            # upstream at https://github.com/python/cpython/pull/150061
+            if os.name == "posix":
+                unix_mode = member.external_attr >> 16
+                if unix_mode:
+                    os.chmod(final_path, unix_mode)
+
             if self.verbose:
                 log.info(f"Extracted: {member.filename}")
 
```

**File**: `test/solidlsp/util/test_zip.py` (modified, +19/-0)
```diff
@@ -1,3 +1,4 @@
+import os
 import sys
 import zipfile
 from pathlib import Path
@@ -90,6 +91,24 @@ def failing_open(self, member, *args, **kwargs):
     assert (dest_dir / "folder" / "file3.txt").exists()
 
 
+@pytest.mark.skipif(sys.platform.startswith("win"), reason="Unix permission bits are not applicable on Windows")
+def test_restores_executable_permission(tmp_path: Path) -> None:
+    """Executable bits stored in the archive's external_attr should be restored on extraction."""
+    zip_path = tmp_path / "exec.zip"
+    with zipfile.ZipFile(zip_path, "w") as zipf:
+        info = zipfile.ZipInfo("bin/tool")
+        info.external_attr = 0o755 << 16
+        zipf.writestr(info, "#!/bin/sh\necho hi\n")
+
+    dest_dir = tmp_path / "extracted"
+    extractor = SafeZipExtractor(zip_path, dest_dir, verbose=False)
+    extractor.extract_all()
+
+    extracted_file = dest_dir / "bin" / "tool"
+    assert extracted_file.exists()
+    assert os.stat(extracted_file).st_mode & 0o111
+
+
 @pytest.mark.skipif(not sys.platform.startswith("win"), reason="Windows-only test")
 def test_long_path_normalization(temp_zip_file: Path, tmp_path: Path) -> None:
     r"""Ensure _normalize_path adds \\?\\ prefix on Windows."""
```

---

### Incident Patch 15: `637ab7b7` (2026-09-23)
**Commit Message**: Fix AL language server lookup in newer extension layouts (#2087)

The AL adapter built a single executable path with a platform-specific
subdirectory (`bin/win32/...` on Windows) and raised "executable not found"
when it was absent. Compare the two VSIX packages from the marketplace with
the URL the adapter itself uses:

  18.0.2242655 (Serena's pinned version): bin/{win32,linux,darwin}/<host>
  18.0.2732683 (the build reported in #2069):  bin/<host>, no platform subdirectories

decision(al): probe both layouts instead of making the path configurable, since the
  extension build Serena downloads and the one the user has in VS Code differ by design.
constraint(al): keep the platform subdirectory first so existing behaviour is unchanged
  for the pinned version; only a missing executable falls through.
learned(al): neither VSIX declares a targetPlatform, yet the newer package contains no unix or
  darwin binaries at all; why Microsoft changed the packaging is upstream of this fix.

The error message now lists every candidate it tried, so the next layout change upstream is
identifiable from the failure alone rather than by reading the adapter.

Fixes #2069

Co-authored-by: sxh313 <[RE

**File**: `CHANGELOG.md` (modified, +6/-0)
```diff
@@ -192,6 +192,12 @@ Status of the `main` branch. Changes prior to the next official version change w
     symbols, which was applied outside the caches; the processing of language servers that post-process
     symbols (e.g. Go, Nix, Fortran, F#, Vue) was therefore repeated on every request or, if it mutated
     symbols in place, re-applied to already processed cached results
+  - Fix: the AL language server executable was only searched for in a platform-specific subdirectory of
+    the extension's `bin` directory (`bin/win32/...` on Windows). Some AL extension builds (e.g.
+    18.0.2732683, as opposed to the 18.0.2242655 that Serena pins) have no such subdirectories and
+    place the executable directly in `bin`, so activating an AL project failed with "AL Language
+    Server executable not found" for users whose VS Code extension was on such a build. Both layouts
+    are now probed, the platform subdirectory first (#2069)
 
 CLI:
   - Fix `project index-file` command not using only the relevant language server to index the given file (#1965)
```

**File**: `src/solidlsp/language_servers/al_language_server.py` (modified, +26/-14)
```diff
@@ -36,6 +36,9 @@
 DEFAULT_AL_EXTENSION_VERSION = "18.0.2242655"
 DEFAULT_AL_EXTENSION_SHA256 = "3971995e61a59dc4fcce4a65053072a67991ed624a16635c4f2911f12564b2b9"
 
+# Base name of the language server executable within the extension; on Windows it is suffixed with ".exe"
+AL_HOST_EXECUTABLE_NAME = "Microsoft.Dynamics.Nav.EditorServices.Host"
+
 
 def _al_extension_sha(version: str) -> str | None:
     if version == INITIAL_AL_EXTENSION_VERSION:
@@ -188,10 +191,8 @@ def _setup_runtime_dependencies(cls, config: LanguageServerConfig, solidlsp_sett
         3. Configures executable permissions on Unix systems
         4. Returns the properly formatted command string
 
-        The AL Language Server executable is located in different paths based on the platform:
-        - Windows: bin/win32/Microsoft.Dynamics.Nav.EditorServices.Host.exe
-        - Linux: bin/linux/Microsoft.Dynamics.Nav.EditorServices.Host
-        - macOS: bin/darwin/Microsoft.Dynamics.Nav.EditorServices.Host
+        The executable lives in the extension's `bin` directory, whose internal layout depends on
+        the extension version; see `_get_executable_path_candidates`.
         """
         system = platform.system()
 
@@ -209,11 +210,12 @@ def _setup_runtime_dependencies(cls, config: LanguageServerConfig, solidlsp_sett
                 "3. Ensure internet connection for automatic download"
             )
 
-        # Build executable path based on platform
-        executable_path = cls._get_executable_path(extension_path, system)
+        # Build the executable path, tolerating the layouts of the different extension versions
+        candidates = cls._get_executable_path_candidates(extension_path, system)
+        executable_path = next((path for path in candidates if os.path.isfile(path)), None)
 
-        if not os.path.exists(executable_path):
-            raise RuntimeError(f"AL Language Server executable not found at: {executable_path}")
+        if executable_path is None:
+            raise RuntimeError("AL Language Server executable not found. Looked for:\n" + "\n".join(f"  - {path}" for path in candidates))
 
         # Prepare and return the executable command
         return cls._prepare_executable(executable_path, system)
@@ -289,26 +291,36 @@ def _download_and_install_al_extension(cls, solidlsp_settings: SolidLSPSettings)
         return None
 
     @classmethod
-    def _get_executable_path(cls, extension_path: str, system: str) -> str:
+    def _get_executable_path_candidates(cls, extension_path: str, system: str) -> list[str]:
         """
-        Build platform-specific executable path.
+        Build the candidate paths of the language server executable for the given platform.
+
+        The AL extension has shipped the executable in two layouts: in the builds up to at least
+        18.0.2242655 it lies in a platform-specific subdirectory of `bin` (`bin/win32/...exe` on
+        Windows), whereas in build 18.0.2732683 the platform subdirectories are gone and it lies
+        directly in `bin`. Both are queried because the build that Serena downloads and the build
+        that the user has installed in VS Code need not be the same.
 
         Args:
             extension_path: Path to AL extension directory
             system: Operating system name
 
         Returns:
-            Full path to executable
+            Candidate paths to the executable, the platform subdirectory layout first
 
         """
         if system == "Windows":
-            return os.path.join(extension_path, "bin", "win32", "Microsoft.Dynamics.Nav.EditorServices.Host.exe")
+            platform_dir, executable_name = "win32", AL_HOST_EXECUTABLE_NAME + ".exe"
         elif system == "Linux":
-            return os.path.join(extension_path, "bin", "linux", "Microsoft.Dynamics.Nav.EditorServices.Host")
+            platform_dir, executable_name = "linux", AL_HOST_EXECUTABLE_NAME
         elif system == "Darwin":
-            return os.path.join(extension_path, "bin", "darwin", "Microsoft.Dynamics.Nav.EditorServices.Host")
+            platform_dir, executable_name = "darwin", AL_HOST_EXECUTABLE_NAME
         else:
             raise RuntimeError(f"Unsupported platform: {system}")
+        return [
+            os.path.join(extension_path, "bin", platform_dir, executable_name),
+            os.path.join(extension_path, "bin", executable_name),
+        ]
 
     @classmethod
     def _prepare_executable(cls, executable_path: str, system: str) -> str:
```

**File**: `test/solidlsp/al/test_al_executable_layout.py` (added, +85/-0)
```diff
@@ -0,0 +1,85 @@
+"""Tests for locating the AL language server executable within the VS Code extension.
+
+The AL extension ships the executable in two different directory layouts depending on its build,
+so both must be resolved without downloading the extension (see #2069).
+"""
+
+from pathlib import Path
+from unittest.mock import patch
+
+import pytest
+
+from solidlsp.language_servers.al_language_server import ALLanguageServer
+from solidlsp.ls_config import LanguageServerConfig, LanguageServerId
+from solidlsp.settings import SolidLSPSettings
+
+pytestmark = pytest.mark.al
+
+# the name the AL extension ships in its `bin` directory, independent of Serena's constant
+HOST_EXECUTABLE_NAME = "Microsoft.Dynamics.Nav.EditorServices.Host"
+
+_PLATFORM_SUBDIR = {"Windows": "win32", "Linux": "linux", "Darwin": "darwin"}
+
+
+def _executable_name(system: str) -> str:
+    return HOST_EXECUTABLE_NAME + (".exe" if system == "Windows" else "")
+
+
+def _create_host(extension_root: Path, system: str, *, layout: str) -> Path:
+    """Create a stub executable in either the versioned platform subdirectory or the flat `bin`
+    directory of the given extension root, returning its path.
+    """
+    subdir = _PLATFORM_SUBDIR[system] if layout == "platform-subdir" else ""
+    host_path = extension_root.joinpath("bin", subdir, _executable_name(system))
+    host_path.parent.mkdir(parents=True, exist_ok=True)
+    host_path.write_bytes(b"stub")
+    return host_path
+
+
+def _setup(extension_root: Path, system: str) -> str:
+    with (
+        patch("solidlsp.language_servers.al_language_server.platform.system", return_value=system),
+        patch.object(ALLanguageServer, "_find_al_extension", return_value=str(extension_root)),
+    ):
+        config = LanguageServerConfig(ls_id=LanguageServerId.AL)
+        return ALLanguageServer._setup_runtime_dependencies(config, SolidLSPSettings())
+
+
+@pytest.mark.parametrize("system", sorted(_PLATFORM_SUBDIR))
+@pytest.mark.parametrize("layout", ["platform-subdir", "flat"])
+def test_executable_is_resolved_in_either_extension_layout(tmp_path: Path, system: str, layout: str) -> None:
+    """Regression test for #2069: builds >= 18.0.2732683 place the executable directly in `bin`,
+    while the layout up to 18.0.2242655 keeps it in a platform subdirectory.
+    """
+    host_path = _create_host(tmp_path, system, layout=layout)
+
+    command = _setup(tmp_path, system)
+
+    assert str(host_path) in command
+
+
+@pytest.mark.parametrize("system", sorted(_PLATFORM_SUBDIR))
+def test_platform_subdir_layout_takes_precedence_when_both_are_present(tmp_path: Path, system: str) -> None:
+    flat_host = _create_host(tmp_path, system, layout="flat")
+    versioned_host = _create_host(tmp_path, system, layout="platform-subdir")
+
+    command = _setup(tmp_path, system)
+
+    assert str(versioned_host) in command
+    assert str(flat_host) not in command
+
+
+def test_missing_executable_reports_every_candidate_layout(tmp_path: Path) -> None:
+    with pytest.raises(RuntimeError, match="AL Language Server executable not found") as exc_info:
+        _setup(tmp_path, "Windows")
+
+    message = str(exc_info.value)
+    assert str(tmp_path / "bin" / "win32" / f"{HOST_EXECUTABLE_NAME}.exe") in message
+    assert str(tmp_path / "bin" / f"{HOST_EXECUTABLE_NAME}.exe") in message
+
+
+def test_unsupported_platform_is_rejected(tmp_path: Path) -> None:
+    _create_host(tmp_path, "Windows", layout="flat")
+
+    with pytest.raises(RuntimeError, match="Unsupported platform: FreeBSD"):
+        _setup(tmp_path, "FreeBSD")
```

#### Recent Merged Pull Requests:
- **PR #2132** (2026-10-04): Fix: Avoid file/package symbols leaking into the high-level document symbol cache (@opcode81)
- **PR #2131** (2026-10-04): Use custom unpickler for symbol caches (@opcode81)
- **PR #2121** (2026-10-05): Speed up nested .gitignore discovery: ancestor-scoped lookup, prune by ignored_paths (@ruyari-cupcake)
- **PR #2118** (closed): fix: mem.onboarding() bypassed the read-only project restriction (@AmirF194)
- **PR #2113** (2026-10-05): fix(kotlin): remove the leaked fallback storage directory on release (@AmirF194)
- **PR #2111** (2026-10-05): fix: lock the cross-process reload-merge-write in _persist_projects (@AmirF194)
- **PR #2103** (2026-09-24): fix(cli): correct duplicated "IS" in ignored-path check output (@thomascfoley-stack)
- **PR #2102** (2026-09-23): fix: zip extract permission bits (@benkeil)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

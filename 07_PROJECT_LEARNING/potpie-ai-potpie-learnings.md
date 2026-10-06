# Forensic Learning Record (Deep Inspection): potpie-ai/potpie

> **Canonical Artifact**: `07_PROJECT_LEARNING/potpie-ai-potpie-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/potpie-ai/potpie](https://github.com/potpie-ai/potpie))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:55:18.207Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `potpie-ai/potpie`
- **Description**: Context Graph for AI Native SDLC
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 5734 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `potpie/cli/templates/claude_plugin/hooks/potpie_nudge.py`
```
#!/usr/bin/env python3
"""Potpie nudge adapter — the thin, model-free hook forwarder.

A harness (Claude Code, Codex, Cursor) fires a hook event; this adapter reads the
event payload from stdin, mechanically maps it to a single ``potpie graph nudge``
call, and injects the returned context/instruction back into the session. It owns
**no trigger policy** and makes **no model call**: every decision about *what* to
read, *whether* it is relevant, and *whether* to prompt a write lives inside
``potpie graph nudge`` (which uses only a local embedder). The adapter's only job is
field-forwarding plus the mechanical event-name mapping the harness taxonomy forces
(one ``PostToolUse(Bash)`` event must become either ``test_failed`` or
``test_passed``).

Fail-safe by construction: any internal error, a missing ``potpie`` binary, or an
unparseable payload results in exit code 0 with no output, so a hook problem can
never block or corrupt the user's session. Set ``POTPIE_HOOK_DEBUG=1`` to emit
diagnostics on stderr.

The pure functions below (event mapping, command classification, argv building,
output rendering) carry the logic and are unit-tested directly; ``main`` is the thin
stdin/subprocess/stdout shell.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from typing import Any

# Nudge events understood by `potpie graph nudge` (must match potpie_context_engine.domain.nudge.NudgeEvent).
NUDGE_EVENTS = frozenset(
    {"session_start", "pre_edit", "pre_deploy", "test_failed", "test_passed", "stop"}
)


def canonical_nudge_event(value: str | None) -> str | None:
    if not value:
        return None
    event = str(value).strip().replace("-", "_")
    return event if event in NUDGE_EVENTS else None


# Map a nudge event back to the harness hook-event name used in the output envelope.
_CLAUDE_EVENT_FOR_NUDGE = {
    "session_start": "SessionStart",
    "pre_edit": "PreToolUse",
    "pre_deploy": "PreToolUse",
    "test_failed": "PostToolUse",
    "test_passed": "PostToolUse",
    "stop": "Stop",
}

# Substrings that mark a shell command as a deploy / infra-changing action.
_DEPLOY_MARKERS = (
    "kubectl apply",
    "kubectl rollout",
    "kubectl delete",
    "helm upgrade",
    "helm install",
    "terraform apply",
    "terraform destroy",
    "docker push",
    "docker compose up",
    "docker-compose up",
    "serverless deploy",
    "sls deploy",
    "pulumi up",
    "aws deploy",
    "gcloud run deploy",
    "gcloud app deploy",
    "flyctl deploy",
    "fly deploy",
    "cdk deploy",
    "ansible-playbook",
)

# Substrings that mark a shell command as a test / check run.
_TEST_MARKERS = (
    "pytest",
    "py.test",
    "unittest",
    "nox",
    "tox",
    "npm test",
    "npm run test",
    "yarn test",
    "pnpm test",
    "jest",
    "vitest",
    "mocha",
    "go test",
    "cargo test",
    "gradle test",
    "mvn test",
    "rspec",
    "phpunit",
    "ctest",
    "make test",
    "make check",
)

# Classify a finished test run when no exit code is given (the live path on Claude
# Code, whose Bash tool_response carries no exit code). Count-aware first: a numeric
# "N failed/failing/errors" with N==0 is a PASS, not a FAIL — so a green run that
# prints "0 failed" (cargo, jest) is not misread. Bare words like "error" or
# "failed" are deliberately NOT failure markers, because they appear constantly in
# green output (test names, package paths, log lines).
_FAIL_COUNT_RE = re.compile(
    r"(\d+)\s+(?:failed|failing|failures|errors?|broken)\b", re.IGNORECASE
)
_PASS_COUNT_RE = re.compile(r"(\d+)\s+(?:passed|passing)\b", re.IGNORECASE)
_GO_OK_RE = re.compile(r"(?m)^ok\s")  # go test success line: "ok\tpkg\t0.01s"

# Anchored failure markers — only consulted when no numeric failure count is found.
_FAIL_MARKERS = (
    "assertionerror",
    "traceback (most recent call last)",
    "panic:",
    "fatal:",
    "build failed",
    "tests failed",
    "test failed",
    "--- fail",  # go test -v
    "=== fail",
    " fail:",
    "not ok",  # TAP
    "✗",
    "✘",
)
# Anchored success markers.
_PASS_MARKERS = (
    "test result: ok",
    "build succeeded",
    "all tests passed",
    "tests passed",
    " passing",  # mocha "N passing"
    "passed",  # pytest "N passed"
    "✓",
    "✔",
)


def _debug(message: str) -> None:
    if os.environ.get("POTPIE_HOOK_DEBUG"):
        sys.stderr.write(f"[potpie-nudge] {message}\n")


# --- payload accessors (harness-tolerant) -----------------------------------


def _first(payload: dict[str, Any], *paths: str) -> Any:
    """Return the first present value among dotted key paths (e.g. 'tool_input.command')."""
    for path in paths:
        node: Any = payload
        ok = True
        for part in path.split("."):
            if isinstance(node, dict) and part in node:
                node = node[part]
            else:
                ok = False
                break
        if ok and node not in (None, ""):
            return node
    return None


def session_id_of(payload: dict[str, Any]) -> str:
    value = _first(payload, "session_id", "sessionId", "conversation_id", "session.id")
    if value:
        return str(value)
    env = os.environ.get("CLAUDE_SESSION_ID") or os.environ.get("POTPIE_SESSION_ID")
    return env or "default"


def tool_name_of(payload: dict[str, Any]) -> str:
    return str(_first(payload, "tool_name", "toolName", "tool.name") or "")


def file_path_of(payload: dict[str, Any]) -> str | None:
    value = _first(
        payload,
        "tool_input.file_path",
        "tool_input.path",
        "toolInput.file_path",
        "params.file_path",
        "file_path",
        "path",
    )
    return str(value) if value else None


def command_of(payload: dict[str, Any]) -> str | None:
    value = _first(
        payload,
        "tool_input.command",
        "toolInput.command",
        "params.command",
        "command",
    )
    return str(value) if value else None


def hook_event_name_of(payload: dict[str, Any], nudge_event: str) -> str:
    """Authoritative harness event name for the output envelope."""
    value = _first(payload, "hook_event_name", "hookEventName", "event")
    if isinstance(value, str) and value in {
        "SessionStart",
        "PreToolUse",
        "PostToolUse",
        "Stop",
    }:
        return value
    return _CLAUDE_EVENT_FOR_NUDGE.get(nudge_event, "PreToolUse")


# --- mechanical classification ----------------------------------------------


def is_deploy_command(command: str | None) -> bool:
    if not command:
        return False
    low = command.lower()
    return any(marker in low for marker in _DEPLOY_MARKERS)


def is_test_command(command: str | None) -> bool:
    if not command:
        return False
    low = command.lower()
    return any(marker in low for marker in _TEST_MARKERS)


def _exit_code_of(tool_response: Any) -> int | None:
    if not isinstance(tool_response, dict):
        return None
    for key in ("exit_code", "exitCode", "returncode", "return_code", "code", "status"):
        if key in tool_response:
            try:
                return int(tool_response[key])
            except (TypeError, ValueError):
                continue
    return None


def _response_text(tool_response: Any) -> str:
    if isinstance(tool_response, str):
        return tool_response
    if isinstance(tool_response, dict):
        parts = [
            str(tool_response.get(k, ""))
            for k in ("stdout", "stderr", "output", "content", "result", "message")
        ]
        return "\n".join(p for p in parts if p)
    return ""


def test_outcome(tool_response: Any) -> str | None:
    """Return 'pass' | 'fail' | None (ambiguous → skip) for a finished test run.

    Mechanical only. Decision order: an explicit exit code wins; then a numeric
    failure count (``N failed`` with N==0 → pass, the common green-run shape); then
    anchored markers. Bare words ("error", "failed") are never enough on their own —
    they appear in green output — so an ambiguous run returns None (stay silent)
    rather than firing a false ``test_failed`` nudge.
    """
    if isinstance(tool_response, dict) and tool_response.get("interrupted"):
        return None
    code = _exit_code_of(tool_response)
    if code is not None:
        return "pass" if code == 0 else "fail"
    if isinstance(tool_response, dict) and tool_response.get("is_error") is True:
        return "fail"
    text = _response_text(tool_response)
    if not text:
        return None
    low = text.lower()

    # Numeric failure/error counts are the strongest text signal: zero ⇒ pass.
    fail_counts = [int(n) for n in _FAIL_COUNT_RE.findall(low)]
    if fail_counts:
        return "fail" if any(n > 0 for n in fail_counts) else "pass"

    # No numeric count — fall back to anchored markers.
    has_fail = any(marker in low for marker in _FAIL_MARKERS)
    has_pass = (
        any(marker in low for marker in _PASS_MARKERS)
        or _PASS_COUNT_RE.search(low) is not None
        or _GO_OK_RE.search(text) is not None
    )
    if has_fail and not has_pass:
        return "fail"
    if has_pass and not has_fail:
        return "pass"
    return None


def _failure_symptom(command: str | None, tool_response: Any) -> str | None:
    """Extract a compact symptom query from a failed run (for prior-bug matching)."""
    text = _response_text(tool_response)
    best = None
    for line in text.splitlines():
        low = line.strip().lower()
        if not low:
            continue
        if any(
            sig in low
            for sig in ("error", "assert", "failed", "exception", "traceback")
        ):
            best = line.strip()
            break
    parts = [p for p in (command, best) if p]
    if not parts:
        return None
    return " — ".join(parts)[:300]


def resolve_nudge_event(
    hint: str, payload: dict[str, Any]
) -> tuple[str | None, dict[str, Any]]:
    
```

### Core Architecture Module: `potpie/config/local_state.py`
```
"""Cross-thread and cross-process transactions for root local JSON state."""

from __future__ import annotations

import json
import os
import tempfile
import threading
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from pathlib import Path
from typing import Any

try:
    import fcntl as _fcntl
except ImportError:  # pragma: no cover - Windows uses msvcrt below.
    _fcntl = None  # type: ignore[assignment]

try:
    import msvcrt as _msvcrt
except ImportError:  # pragma: no cover - POSIX uses fcntl above.
    _msvcrt = None  # type: ignore[assignment]


_LOCKS_GUARD = threading.Lock()
_PATH_LOCKS: dict[Path, threading.RLock] = {}


@contextmanager
def local_json_transaction(
    path: Path,
    *,
    default_factory: Callable[[], dict[str, Any]],
) -> Iterator[dict[str, Any]]:
    """Lock, freshly load, mutate, and atomically replace one JSON document."""

    resolved = path.resolve(strict=False)
    resolved.parent.mkdir(parents=True, exist_ok=True)
    lock_path = resolved.with_suffix(resolved.suffix + ".lock")
    with _thread_lock(lock_path):
        with lock_path.open("a+b") as lock_file:
            _acquire_process_lock(lock_file)
            try:
                state = _load_json(resolved, default_factory=default_factory)
                yield state
                _atomic_write_json(resolved, state)
            finally:
                _release_process_lock(lock_file)


def _thread_lock(path: Path) -> threading.RLock:
    with _LOCKS_GUARD:
        return _PATH_LOCKS.setdefault(path, threading.RLock())


def _load_json(
    path: Path, *, default_factory: Callable[[], dict[str, Any]]
) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return default_factory()
    return data if isinstance(data, dict) else default_factory()


def _atomic_write_json(path: Path, state: dict[str, Any]) -> None:
    temporary_path: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            dir=path.parent,
            prefix=f".{path.name}.",
            suffix=".tmp",
            delete=False,
        ) as temporary:
            json.dump(state, temporary, indent=2)
            temporary.write("\n")
            temporary.flush()
            os.fsync(temporary.fileno())
            temporary_path = Path(temporary.name)
        os.replace(temporary_path, path)
        temporary_path = None
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def _acquire_process_lock(lock_file: Any) -> None:
    if _fcntl is not None:
        _fcntl.flock(lock_file.fileno(), _fcntl.LOCK_EX)
        return
    if _msvcrt is not None:
        lock_file.seek(0)
        if not lock_file.read(1):
            lock_file.write(b"\0")
            lock_file.flush()
        lock_file.seek(0)
        _msvcrt.locking(lock_file.fileno(), _msvcrt.LK_LOCK, 1)


def _release_process_lock(lock_file: Any) -> None:
    if _fcntl is not None:
        _fcntl.flock(lock_file.fileno(), _fcntl.LOCK_UN)
        return
    if _msvcrt is not None:
        lock_file.seek(0)
        _msvcrt.locking(lock_file.fileno(), _msvcrt.LK_UNLCK, 1)


__all__ = ["local_json_transaction"]

```

### Core Architecture Module: `potpie/context-engine/scripts/benchmark_context_engine.py`
```
#!/usr/bin/env python3
"""Compatibility wrapper for the benchmark package.

Use this path from the repository root:

    uv run python potpie/context-engine/scripts/benchmark_context_engine.py mock
    uv run python potpie/context-engine/scripts/benchmark_context_engine.py http-e2e
    uv run python potpie/context-engine/scripts/benchmark_context_engine.py api
"""

from __future__ import annotations

import sys
from pathlib import Path

PACKAGE_SRC = Path(__file__).resolve().parents[1] / "src"
if str(PACKAGE_SRC) not in sys.path:
    sys.path.insert(0, str(PACKAGE_SRC))

from potpie_context_engine.benchmarks.cli import main  # noqa: E402


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `potpie/context-engine/scripts/generate_agent_contract.py`
```
#!/usr/bin/env python3
"""Generate an agent-surface Markdown reference from the canonical surface.

The hand-written contract now lives in
``docs/context-graph/architecture.md#agent-contract``. This script reads the
*single* source of truth for the agent surface - ``potpie_context_engine.core.agent_context_port``
(the same intent recipes, default includes, and ontology-derived include tiers
the runtime serves) - and emits a deterministic Markdown reference table.

Usage::

    python -m scripts.generate_agent_contract > docs/context-graph/agent-surface.generated.md
"""

from __future__ import annotations

import sys
from typing import TextIO

from potpie_context_engine.core.agent_context_port import (
    CONTEXT_RESOLVE_RECIPES,
    context_port_manifest,
)
from potpie_context_engine.core.context_records import (
    PREFERENCE_AUDIENCES,
    PREFERENCE_STRENGTHS,
    SCOPE_KINDS,
    VERIFICATION_OUTCOMES,
)


def emit(stream: TextIO) -> None:
    print("# Agent Surface (generated)\n", file=stream)
    print(
        "_This file is generated by `scripts/generate_agent_contract.py` from "
        "`potpie_context_engine.core.agent_context_port`. Compare it with "
        "`docs/context-graph/architecture.md#agent-contract`._\n",
        file=stream,
    )

    print("## Intents\n", file=stream)
    print("| Intent | When | Default Includes |", file=stream)
    print("|---|---|---|", file=stream)
    for intent in sorted(CONTEXT_RESOLVE_RECIPES):
        recipe = CONTEXT_RESOLVE_RECIPES[intent]
        when = recipe.get("when", "")
        includes = ", ".join(recipe.get("include", ()))
        print(f"| `{intent}` | {when} | {includes} |", file=stream)
    print(file=stream)

    print("## Includes\n", file=stream)
    print(
        "Include keys are grouped by how the engine can answer them today "
        "(honest capability map, derived from the ontology + resolver routing):\n",
        file=stream,
    )
    families = context_port_manifest()["include_families"]
    for tier, label in (
        ("reader_backed", "Reader-backed (answered by a P9 use-case reader)"),
        ("planned", "Planned (requestable but not yet backed - best-effort only)"),
    ):
        keys = families.get(tier, [])
        print(f"### {label}\n", file=stream)
        print(", ".join(f"`{k}`" for k in keys) if keys else "_(none)_", file=stream)
        print(file=stream)

    print("## Record-type vocabularies\n", file=stream)
    print(
        "These enumerations validate the structured `context_record` payload "
        "(rebuild plan P6).\n",
        file=stream,
    )
    print("### Scope kinds\n", file=stream)
    print(", ".join(f"`{v}`" for v in sorted(SCOPE_KINDS)), file=stream)
    print(file=stream)
    print("### Preference strengths\n", file=stream)
    print(", ".join(f"`{v}`" for v in sorted(PREFERENCE_STRENGTHS)), file=stream)
    print(file=stream)
    print("### Preference audiences\n", file=stream)
    print(", ".join(f"`{v}`" for v in sorted(PREFERENCE_AUDIENCES)), file=stream)
    print(file=stream)
    print("### Verification outcomes\n", file=stream)
    print(", ".join(f"`{v}`" for v in sorted(VERIFICATION_OUTCOMES)), file=stream)
    print(file=stream)


def main() -> int:
    emit(sys.stdout)
    return 0


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())

```

### Core Architecture Module: `potpie/context-engine/sentry_defaults_hook.py`
```
"""Hatch hook for standalone Context Engine Sentry metrics defaults."""

from __future__ import annotations

import ast
import os
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from hatchling.builders.hooks.plugin.interface import BuildHookInterface

_DEFAULTS_OUT = Path("src/potpie_context_engine/bootstrap/_distribution_defaults.py")
_BUILD_INFO_OUT = Path("src/potpie_context_engine/bootstrap/_build_info.py")
_GENERATED_BUILD_DIRS_KEY = "_context_engine_generated_build_dirs"
_GENERATED_DIR_PREFIX = "potpie-context-engine-build-"
_DOTENV_VALUES = None


class SentryDefaultsHook(BuildHookInterface):
    """Generate only the engine-owned defaults used by standalone metrics."""

    def initialize(self, version: str, build_data: dict) -> None:
        del version
        defaults = _prefer_existing_defaults(_DEFAULTS_OUT, _runtime_defaults())
        build_info = _prefer_existing_build_info(_BUILD_INFO_OUT, _build_info())
        if _flag(os.getenv("POTPIE_VALIDATE_DISTRIBUTION_DEFAULTS", "0")):
            missing = [name for name, value in defaults.items() if not value]
            if missing:
                raise RuntimeError(
                    "Missing required Context Engine Sentry defaults: "
                    + ", ".join(missing)
                )

        generated_dir = Path(tempfile.mkdtemp(prefix=_GENERATED_DIR_PREFIX))
        defaults_out = generated_dir / _DEFAULTS_OUT.name
        build_info_out = generated_dir / _BUILD_INFO_OUT.name
        try:
            defaults_out.write_text(
                "# Auto-generated at wheel build time - do not edit manually.\n"
                f"DISTRIBUTION_DEFAULTS = {defaults!r}\n",
                encoding="utf-8",
            )
            build_info_out.write_text(
                "# Auto-generated at wheel build time - do not edit manually.\n"
                + "".join(
                    f"{name} = {value!r}\n" for name, value in build_info.items()
                ),
                encoding="utf-8",
            )
            build_data.setdefault("force_include", {}).update(
                {
                    str(defaults_out): self._artifact_path(_DEFAULTS_OUT),
                    str(build_info_out): self._artifact_path(_BUILD_INFO_OUT),
                }
            )
            build_data.setdefault(_GENERATED_BUILD_DIRS_KEY, []).append(
                str(generated_dir)
            )
        except Exception:
            shutil.rmtree(generated_dir, ignore_errors=True)
            raise

    def finalize(self, version: str, build_data: dict, artifact_path: str) -> None:
        del version, artifact_path
        temp_root = Path(tempfile.gettempdir()).resolve()
        for raw_path in build_data.get(_GENERATED_BUILD_DIRS_KEY, []):
            path = Path(raw_path).resolve(strict=False)
            if path.parent != temp_root or not path.name.startswith(
                _GENERATED_DIR_PREFIX
            ):
                raise RuntimeError(
                    f"Refusing to remove unexpected build directory: {path}"
                )
            if path.exists():
                shutil.rmtree(path)

    def _artifact_path(self, source_tree_path: Path) -> str:
        rel = source_tree_path.as_posix()
        if getattr(self, "target_name", "wheel") == "wheel" and rel.startswith("src/"):
            return rel[len("src/") :]
        return rel


def _runtime_defaults() -> dict[str, str]:
    return {
        "environment": _env("POTPIE_ENVIRONMENT") or "prod_oss",
        "sentry_dsn": _env("POTPIE_SENTRY_DSN"),
    }


def _build_info() -> dict[str, str]:
    return {
        "GIT_SHA": _env("POTPIE_BUILD_GIT_SHA") or _env("GITHUB_SHA"),
        "BUILD_TIME": _env("POTPIE_BUILD_TIME") or _utc_now(),
    }


def _prefer_existing_defaults(path: Path, values: dict[str, str]) -> dict[str, str]:
    existing = _read_mapping(path, "DISTRIBUTION_DEFAULTS")
    merged = dict(values)
    for field, env_name in {
        "environment": "POTPIE_ENVIRONMENT",
        "sentry_dsn": "POTPIE_SENTRY_DSN",
    }.items():
        if field in existing and not _env(env_name):
            merged[field] = existing[field]
    return merged


def _prefer_existing_build_info(path: Path, values: dict[str, str]) -> dict[str, str]:
    existing = _read_constants(path)
    merged = dict(values)
    if "GIT_SHA" in existing and not (
        _env("POTPIE_BUILD_GIT_SHA") or _env("GITHUB_SHA")
    ):
        merged["GIT_SHA"] = existing["GIT_SHA"]
    if "BUILD_TIME" in existing and not _env("POTPIE_BUILD_TIME"):
        merged["BUILD_TIME"] = existing["BUILD_TIME"]
    return merged


def _read_mapping(path: Path, name: str) -> dict[str, str]:
    try:
        module = ast.parse(path.read_text(encoding="utf-8"))
    except (OSError, SyntaxError):
        return {}
    for node in module.body:
        if not isinstance(node, ast.Assign) or len(node.targets) != 1:
            continue
        target = node.targets[0]
        if not isinstance(target, ast.Name) or target.id != name:
            continue
        try:
            value = ast.literal_eval(node.value)
        except (ValueError, SyntaxError):
            return {}
        if isinstance(value, dict):
            return {str(key): str(item).strip() for key, item in value.items()}
    return {}


def _read_constants(path: Path) -> dict[str, str]:
    try:
        module = ast.parse(path.read_text(encoding="utf-8"))
    except (OSError, SyntaxError):
        return {}
    return {
        node.targets[0].id: node.value.value
        for node in module.body
        if isinstance(node, ast.Assign)
        and len(node.targets) == 1
        and isinstance(node.targets[0], ast.Name)
        and isinstance(node.value, ast.Constant)
        and isinstance(node.value.value, str)
    }


def _env(name: str) -> str:
    if name in os.environ:
        return os.environ[name].strip()
    return _dotenv_values().get(name, "")


def _dotenv_values() -> dict[str, str]:
    global _DOTENV_VALUES
    if _DOTENV_VALUES is not None:
        return _DOTENV_VALUES
    for ancestor in (
        Path(__file__).resolve().parent,
        *Path(__file__).resolve().parents,
    ):
        candidate = ancestor / ".env"
        if not candidate.is_file():
            continue
        values: dict[str, str] = {}
        try:
            lines = candidate.read_text(encoding="utf-8").splitlines()
        except OSError:
            break
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            if stripped.lower().startswith("export "):
                stripped = stripped[7:].strip()
            key, value = stripped.split("=", 1)
            key = key.strip()
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
                value = value[1:-1]
            if key:
                values[key] = value
        _DOTENV_VALUES = values
        return values
    _DOTENV_VALUES = {}
    return _DOTENV_VALUES


def _flag(value: str) -> bool:
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _utc_now() -> str:
    return (
        datetime.now(tz=timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )

```

### Core Architecture Module: `potpie/context-engine/src/potpie_context_engine/__init__.py`
```
"""Potpie Context Engine — the context-bound project-memory library.

Supported imports live in two places:

- ``potpie_context_engine`` (this module) — the context-bound engine factory,
  lifecycle, outcomes, and non-extensible default graph definition.
- ``potpie_context_engine.api`` — stable contract DTOs and ports for
  consumers composing their own runtime (``GraphBackend``,
  ``GraphPlanStorePort``, ``GraphInboxStorePort``, ``GraphService``).

Everything under ``potpie_context_engine.domain`` / ``.application`` /
``.adapters`` / ``.bootstrap`` / ``.host`` / ``.benchmarks`` is internal and
may change without notice.

Importing this package must stay dependency-light: no delivery-surface or
backend third-party imports (FastAPI, Typer, MCP, FalkorDB, Neo4j,
SQLAlchemy, Hatchet, OpenTelemetry, Sentry) at module import time.
"""

from __future__ import annotations

from potpie_context_engine.core.definition import (
    DEFAULT_GRAPH_DEFINITION,
    GraphDefinition,
)
from potpie_context_engine.context_engine import (
    ContextEngine,
    ContextIdentity,
    EngineConfig,
    EngineDependencies,
    EngineResource,
    create_engine,
)
from potpie_context_engine.outcomes import (
    DependencyError,
    DomainError,
    EngineError,
    EngineLifecycleError,
    Failure,
    Outcome,
    Success,
)

__all__ = [
    "DEFAULT_GRAPH_DEFINITION",
    "ContextEngine",
    "ContextIdentity",
    "DependencyError",
    "DomainError",
    "EngineConfig",
    "EngineDependencies",
    "EngineError",
    "EngineLifecycleError",
    "EngineResource",
    "Failure",
    "GraphDefinition",
    "Outcome",
    "Success",
    "create_engine",
]

```

### Core Architecture Module: `potpie/context-engine/src/potpie_context_engine/adapters/inbound/http/__main__.py`
```
import logging
import os
import sys

import uvicorn

from potpie_context_engine.bootstrap.logging_setup import configure_logging

logger = logging.getLogger(__name__)

_LOOPBACK_HOSTS = {"127.0.0.1", "localhost", "::1"}


def _assert_safe_to_bind(host: str) -> None:
    """Fail closed: do not expose an unauthenticated listener on a network.

    The standalone HTTP surface authenticates via ``CONTEXT_ENGINE_API_KEY``
    and enforces per-actor pot scoping via the policy contract. When neither
    a key nor the dev-only ``CONTEXT_ENGINE_ALLOW_NO_AUTH`` opt-in is set,
    binding to anything other than loopback would publish a fully open,
    cross-tenant API — so we refuse to start.
    """
    has_key = bool(os.getenv("CONTEXT_ENGINE_API_KEY", "").strip())
    allow_no_auth = os.getenv("CONTEXT_ENGINE_ALLOW_NO_AUTH", "").strip().lower() in (
        "1",
        "true",
        "yes",
    )
    if host in _LOOPBACK_HOSTS or has_key or allow_no_auth:
        return
    logger.error(
        "Refusing to start: CONTEXT_ENGINE_HOST=%s is network-reachable but "
        "CONTEXT_ENGINE_API_KEY is unset. Configure an API key, bind to "
        "127.0.0.1, or set CONTEXT_ENGINE_ALLOW_NO_AUTH=1 for local dev only.",
        host,
    )
    sys.exit(1)


def main() -> None:
    configure_logging()
    host = os.environ.get("CONTEXT_ENGINE_HOST", "127.0.0.1")
    port = int(os.environ.get("CONTEXT_ENGINE_PORT", "8000"))
    reload = os.environ.get("CONTEXT_ENGINE_RELOAD", "").lower() in (
        "1",
        "true",
        "yes",
    )
    _assert_safe_to_bind(host)
    uvicorn.run(
        "potpie_context_engine.adapters.inbound.http.app:app",
        host=host,
        port=port,
        reload=reload,
    )


if __name__ == "__main__":
    main()

```

### Core Architecture Module: `potpie/context-engine/src/potpie_context_engine/adapters/inbound/http/_hardening.py`
```
"""Transport hardening for the standalone HTTP app (security review M-5).

Deny-by-default CORS, a request body-size cap, baseline security headers,
and a lightweight in-process per-principal rate limit on the expensive
ingest / webhook / query paths. All limits are env-tunable; the rate
limiter is best-effort (per-process) — a real multi-instance deployment
should also throttle at the edge, but this removes the "no throttle at
all" amplification surface.
"""

from __future__ import annotations

import os
import time
from collections import deque

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.middleware.cors import CORSMiddleware

_DEFAULT_MAX_BODY = 5 * 1024 * 1024  # 5 MB
_RATE_LIMITED_PREFIXES = ("/webhooks", "/api/v1/context")
_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Cache-Control": "no-store",
}


def _int_env(name: str, default: int) -> int:
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """413 when a declared Content-Length exceeds the cap."""

    def __init__(self, app, max_bytes: int) -> None:
        super().__init__(app)
        self._max = max_bytes

    async def dispatch(self, request, call_next):
        cl = request.headers.get("content-length")
        if cl is not None:
            try:
                if int(cl) > self._max:
                    return JSONResponse(
                        status_code=413,
                        content={
                            "error": {
                                "code": "payload_too_large",
                                "message": f"body exceeds {self._max} bytes",
                            }
                        },
                    )
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={
                        "error": {
                            "code": "bad_content_length",
                            "message": "invalid Content-Length",
                        }
                    },
                )
        return await call_next(request)


class TracingMiddleware(BaseHTTPMiddleware):
    """Open a SERVER span per request and bind the trace to the
    correlation context so every downstream log line / span carries it.

    Outermost middleware (added last) so the span covers rate-limit and
    body-size rejections too. Best-effort: any observability failure must
    not affect the response.
    """

    async def dispatch(self, request, call_next):
        from potpie_context_engine.bootstrap.observability_context import (
            bind_correlation,
        )
        from potpie_context_engine.bootstrap.observability_runtime import (
            get_observability,
        )
        from potpie_context_engine.domain.ports.observability import SPAN_KIND_SERVER

        obs = get_observability()
        route = request.url.path
        try:
            cm = obs.span(
                f"HTTP {request.method} {route}",
                kind=SPAN_KIND_SERVER,
                attributes={
                    "http.method": request.method,
                    "http.route": route,
                },
            )
        except Exception:  # noqa: BLE001 — never break the request
            return await call_next(request)
        with cm as span:
            tp = obs.current_traceparent()
            if tp:
                # W3C: 00-<32 hex trace_id>-<16 hex span_id>-<flags>
                parts = tp.split("-")
                if len(parts) >= 2:
                    bind_correlation(trace_id=parts[1])
            try:
                response = await call_next(request)
            except Exception as exc:  # noqa: BLE001 — annotate + re-raise
                span.record_exception(exc)
                span.set_error(repr(exc))
                raise
            span.set_attribute("http.status_code", response.status_code)
            if response.status_code >= 500:
                span.set_error(f"status {response.status_code}")
            return response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        resp = await call_next(request)
        for k, v in _SECURITY_HEADERS.items():
            resp.headers.setdefault(k, v)
        return resp


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-principal sliding-window limit on expensive path prefixes.

    Principal = the API key (``X-API-Key``) when present, else client IP.
    Off when ``limit`` <= 0.
    """

    def __init__(self, app, *, limit: int, window_s: float) -> None:
        super().__init__(app)
        self._limit = limit
        self._window = window_s
        self._hits: dict[str, deque[float]] = {}

    def _principal(self, request) -> str:
        key = request.headers.get("x-api-key")
        if key:
            return f"k:{hash(key)}"
        client = request.client
        return f"ip:{client.host}" if client else "ip:?"

    async def dispatch(self, request, call_next):
        if self._limit <= 0 or not request.url.path.startswith(_RATE_LIMITED_PREFIXES):
            return await call_next(request)
        now = time.monotonic()
        pid = self._principal(request)
        dq = self._hits.setdefault(pid, deque())
        cutoff = now - self._window
        while dq and dq[0] < cutoff:
            dq.popleft()
        if len(dq) >= self._limit:
            return JSONResponse(
                status_code=429,
                content={
                    "error": {
                        "code": "rate_limited",
                        "message": "too many requests; slow down",
                    }
                },
                headers={"Retry-After": str(int(self._window))},
            )
        dq.append(now)
        return await call_next(request)


def install_hardening(app: FastAPI) -> None:
    """Attach the hardening middleware stack (deny-by-default)."""
    raw_origins = os.getenv("CONTEXT_ENGINE_CORS_ORIGINS", "").strip()
    origins = [o.strip() for o in raw_origins.split(",") if o.strip()]
    # Deny-by-default: with no configured origins CORS grants nothing.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=bool(origins),
        allow_methods=["*"] if origins else [],
        allow_headers=["*"] if origins else [],
    )
    app.add_middleware(SecurityHeadersMiddleware)
    app.add_middleware(
        RateLimitMiddleware,
        limit=_int_env("CONTEXT_ENGINE_RATE_LIMIT_PER_MIN", 120),
        window_s=60.0,
    )
    app.add_middleware(
        BodySizeLimitMiddleware,
        max_bytes=_int_env("CONTEXT_ENGINE_MAX_BODY_BYTES", _DEFAULT_MAX_BODY),
    )
    # Added last → outermost: the request span wraps rate-limit / body-size
    # rejections too. NoOp by default, so this is free until enabled.
    app.add_middleware(TracingMiddleware)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1027** (2026-07-28): **Consolidate local reinstall guidance around make cli-install**
  *Symptoms*: ### Area  Install or upgrade  ### Potpie version  v2.0.0  ### Install source  Other  ### System  macOS , python3.13.13  ### Coding agent and model  _No response_  ### Command or workflow  ```bash uv tool install --force --editable ./potpie/context-engine ```  > **Note:** Some older documentation may instead instruct you to run: > > ```bash > pip install potpie > ```  ### What happened?  Raw editable/`pip` install guidance worked but skipped UI build, daemon stop, and the full local install path. Expected docs and skills to point repo-local reinstall at `make cli-install`, keep `pip`/`uv tool install potpie` for published packages only, and hint `make cli-status` / `potpie doctor` for uv-tool installs.  ### Source or build details  _No response_ 
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-2031">POT-2031</a></p>
  > <!-- This is an auto-generated reply by CodeRabbit --> ## Coding Plan  ### Summary  - Standardize on one rule everywhere: `make cli-install` for repo-local/contributor reinstall (full UI build + daemon stop + editable install), `pip install potpie` / `uv tool install potpie` for published packages only, and `make cli-status` / `potpie doctor` as the health checks. - Update human docs (README, context-graph docs, contributor guides) and agent-facing files (potpie-cli SKILL, Claude plugin README) to apply that rule and remove the nonexistent `potpie install` reference. - Fix the `cli_install_status.py` package-name mismatch so `potpie doctor` correctly detects uv-tool installs, making the promoted hints truthful, and update the unit test to match real `uv tool list` output while preserving all existing string/key contracts.  <details> <summary><b>Design Choices</b></summary>  <details> <summary><b>Design Choice 1: Should the uv-tool detection bug in `cli_install_status.py` be fixed as pa

- **Issue #1025** (2026-07-27): **De-emphasize legacy and cloud groups in root help; add first-run guidance**
  *Symptoms*: ### Area  Other  ### Potpie Version  v2.0.0  ### Install Source  Editable/local build  ### System  - **OS:** macOS 26.4.1 - **Python:** 3.13.13  ### Coding Agent and Model  _No response_  ### Command or Workflow  ```bash potpie --help ```  ### What Happened?  The root `potpie --help` output listed `auth` (legacy aliases) and `cloud` (currently under development) alongside the primary user commands in the **Commands** section, making them appear as part of the recommended workflow for first-time users.  ### Expected Behavior  The root help should:  - Display a short **First Run** guide (for example: `setup` → `doctor` → `status`) to direct new users toward the recommended workflow. - De-emphasize the `auth` and `cloud` command groups by clearly marking them as **Legacy** and **Coming Soon** (or similar), and displaying them below the primary commands rather than alongside the happy-path commands.  ### Source or Build Details  _No response_ 
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-2030">POT-2030</a></p>

- **Issue #992** (2026-07-28): **Domain errors and ok:false JSON exit 0 — automation cannot detect CLI failures**
  *Symptoms*: ### Area  Other  ### Potpie version  potpie v2.0.0b3  ### Install source  uv tool install potpie  ### System  macOS  ### Coding agent and model  _No response_  ### Command or workflow  Commands run:  ```bash # Capability not implemented potpie --json cloud status echo "exit: $?"  # Domain / pot scope failure potpie --json graph status echo "exit: $?"  # Graph workbench failure (ok:false in JSON) potpie --json graph nudge --event bogus --session s1 --pot <pot-id> echo "exit: $?"  # Shell chain (automation) potpie --json cloud status && echo "should not print" ```  ### What happened?  The CLI printed the correct structured error output, but the process still exited with code `0` (success).  | Command | Output | Exit code | |---------|--------|-----------| | `potpie --json cloud status` | `"code": "not_implemented"` | `0` | | `potpie --json graph status` | `"ok": false` (for example, `ambiguous_pot`) | `0` | | `potpie --json graph nudge --event bogus ...` | `"ok": false` with error details | `0` | | `potpie --json cloud status && echo "should not print"` | The second command executed because the first returned success | `0` |  So the JSON correctly indicated a failure, but `$?` reported success.  Parser and usage errors behaved correctly and returned a non-zero exit code. For example:  ```bash potpie pot create # Error: Missing argument 'NAME' echo "exit: $?" # exit: 2 ```  ### Source or build details  _No response_  ### Output or logs  _No additional logs._
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-1869">POT-1869</a></p>
  > <!-- This is an auto-generated reply by CodeRabbit --> ## Coding Plan  ### Summary  - Fix the true root cause once at the boundary: `run_cli()` must propagate the exit code that Typer/Click's `standalone_mode=False` returns instead of discarding it, restoring correct exit codes for all `fail()`/`contract()` domain errors (including `cloud status` and pot-scope failures). - Close the graph-specific gap by centralizing the `ok:false` → nonzero-exit guard in `_emit_graph_result()`, so `graph nudge` and sibling commands exit nonzero on error envelopes. - Add regression tests at the real exit-code boundary (not `CliRunner`) and document the invariant so the fix stays enforced.  <details> <summary><b>Design Choices</b></summary>  <details> <summary><b>Design Choice 1: How should graph commands that emit ok:false payloads be made to exit nonzero?</b></summary>    **Options Considered:** 1. Centralize the guard inside _emit_graph_result() so it raises typer.Exit(EXIT_VALIDATION) whenever the e

- **Issue #981** (2026-07-28): **Fix mislabeled feature claims in potpie resolve output**
  *Symptoms*: ## Component/Module  Other  ## Environment  Development (`isDevelopmentMode=enabled`)  ## Severity  Low (Minor issue / Cosmetic)  ## Operating System  macOS  ## Environment Information  - **OS:** macOS - **Shell:** zsh - **CLI:** `potpie` - **Working Directory:** `potpie/context-engine` - **Backend Profile:** Local graph backend - **Reproduction Condition:** Use a populated pot containing both infrastructure-topology claims and feature claims such as `PROVIDES` or `IMPLEMENTED_IN`.  ## Description  `potpie resolve` can return feature-related claims under the `infra_topology` include label.  This is misleading because predicates such as `PROVIDES` and `IMPLEMENTED_IN` describe feature context, not infrastructure topology. These claims should instead be returned under `features` so that the output labels accurately reflect the semantics of the underlying data.  The issue occurs because the top-level resolve behavior allows feature predicates to surface through the `infra_topology` include path instead of the `features` include path.  ## Expected Behavior  When resolving feature-oriented context:  - Feature claims such as `PROVIDES` and `IMPLEMENTED_IN` should appear under `features`. - `infra_topology` results should contain only infrastructure-related predicates such as `DEPENDS_ON`, `USES`, `DEPLOYED_TO`, `DEFINED_IN`, `HOSTED_ON`, and `OWNED_BY`. - Top-level `resolve` output should use include labels that match the semantic category of the returned claims.  ## Actual Behavio
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-1819">POT-1819</a></p>
  > <!-- This is an auto-generated reply by CodeRabbit --> ## Coding Plan  ### Summary  - Remove the overlapping `PROVIDES`/`IMPLEMENTED_IN` predicates from `_INFRA_PREDICATES` so the infra-topology read path no longer consumes feature-domain edges. - Add the `"features"` family to the default includes for the `"feature"` intent so `FeaturesReader` is dispatched and feature claims are correctly labeled. - Rely on the existing orchestrator/envelope labeling pipeline (no changes needed there), since labels are stamped from the routing key, which becomes correct once the predicates and dispatch are fixed. - Update existing tests that encoded the old behavior and add coverage asserting correct predicate-to-family labeling.  <details> <summary><b>Design Choices</b></summary>  <details> <summary><b>Design Choice 1: Should the `features` family be added to other intents that currently include `infra_topology`?</b></summary>    **Options Considered:** 1. Only add `"features"` to `DEFAULT_INTENT_IN
  > Mislabeled feature claims in resolve output sound like they should be generated from a capability registry rather than hand-maintained text. A regression could run `potpie resolve` against a fixture project and assert each claim maps to an actual detector/result field. That would make it much harder for marketing-style wording to drift ahead of what the resolver can prove. 

- **Issue #978** (2026-06-30): **Add next actions after potpie source add repo for empty pots**
  *Symptoms*: ### Component/Module  Other  ### Environment  Development (isDevelopmentMode=enabled)  ### Severity  Low (Minor issue/Cosmetic)  ### Operating System  macOS  ### Environment Information   OS: macOS   - Shell: zsh   - CLI entrypoint: potpie   - Working directory: potpie/context-engine   - Backend: local graph backend  ### Description  ## Description    Source registration is intentionally registration-only and should not trigger ingestion or scanning automatically. That part is correct.    The problem is that when a repository is added to a brand-new or otherwise empty pot, the CLI did not provide follow-up guidance. Users could complete the command successfully and   still be left with an empty graph and no clear next step.    The fix is to add a next-actions block for empty pots after successful source add repo, and include `recommended_next_action` in JSON output.  ### Expected Behavior    ## Expected Behavior    After running:    `potpie source add repo . --pot <empty-pot-id>`    if the target pot has 0 claims, the CLI should:    - confirm registration succeeded   - clearly state that no ingestion or scan was started   - show concrete next actions, such as:       - inspect linked pots       - switch to a populated pot       - start a manual graph mutation workflow    In JSON mode, the success payload should also include:    `"recommended_next_action": "..."`  ### Actual Behavior  _No response_  ### Steps to Reproduce  ## Steps To Reproduce    1. Choose or create a pot with
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-1816">POT-1816</a></p>
  > <!-- This is an auto-generated reply by CodeRabbit --> ## Coding Plan  ### Summary  - Enrich only the post-success output of `source_add` in `pots.py`; registration, telemetry, and repo-default logic stay unchanged. - Reuse the existing emptiness-detection helpers (`pot_graph_counts` / `empty_pot_warnings`) in `_common.py` rather than introducing new graph queries or new abstractions. - Since `emit()` has no next-action parameter, inline `recommended_next_action` into the JSON payload and append a next-actions block to the human string (the same pattern `graph.py` already uses), gated on the pot being empty. - Add targeted unit tests in `test_source_cli_contract.py` for the empty-pot path while preserving the existing non-empty JSON contract.  <details> <summary><b>Design Choices</b></summary>  <details> <summary><b>Design Choice 1: Source of the next-action guidance text for empty pots</b></summary>    **Options Considered:** 1. Reuse `empty_pot_warnings()` verbatim as the `recommende
  > <!-- This is an auto-generated reply by CodeRabbit --> I've updated the plan above based on your feedback. Ready to proceed when you are!

- **Issue #977** (2026-07-01): **fix(cli): explain missing service logs for embedded graph backends**
  *Symptoms*: ## Summary  `potpie service logs falkordb_lite` (and other embedded graph backends) returns a generic `no log file` message even though `falkordb_lite` runs embedded inside the daemon, not as a managed subprocess with its own `service-<name>.log`. Users get no guidance on where to look (`potpie daemon logs`) or where the FalkorDBLite database file lives.  ## Reproduction  ```bash potpie setup --daemon          # default embedded / falkordb_lite backend potpie --json service logs falkordb_lite ```  ## Observed:  ```bash  {"lines": []} Human output: no log file ``` No status, profile, recommended_log_command, or database_path. Same vague response for embedded, in_memory, and alias falkordblite.  ## Expected:  Structured response explaining the backend is embedded, pointing to potpie daemon logs, and (for falkordb_lite) including the database file path:  ```bash {   "lines": [],   "status": "embedded_backend",   "profile": "falkordb_lite",   "recommended_log_command": "potpie daemon logs",   "database_path": "/path/to/falkordb_lite.db",   "message": "falkordb_lite runs embedded inside the daemon (no separate service log).",   "detail": [     "falkordb_lite runs embedded inside the daemon (no separate service log).",     "Use `potpie daemon logs` for daemon output.",     "Database file: /path/to/falkordb_lite.db"   ] } ``` For unknown or not-yet-started managed subprocess services, the message should distinguish:  - managed service not started yet → potpie service up <name> - unk
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-1815">POT-1815</a></p>
  > <!-- This is an auto-generated reply by CodeRabbit --> ## Coding Plan  ### Summary  - Replace the single bare missing-log emission in `service_logs` with a `_missing_service_log_response()` helper that classifies the requested name into embedded-backend, managed-but-unstarted, or unknown, emitting a structured payload via the existing `emit()` contract. - Add small, cohesive private helpers (`_normalize_service_name`, `_embedded_graph_profile`, `_managed_service_names`) that follow the module's established private-helper and graceful-absent patterns, reusing `context_engine_falkordb_lite_path()` and the `/admin/services` endpoint. - Keep all existing behavior intact when a real `service-<name>.log` exists, and cover the new embedded-backend path with a unit test mirroring existing test fixtures.  <details> <summary><b>Design Choices</b></summary>  <details> <summary><b>Design Choice 1: How should managed-service classification behave when the daemon is not running?</b></summary>    **O

- **Issue #973** (2026-07-01): **`pot create --repo . ` not registering the current repo**
  *Symptoms*: ## Summary  `potpie pot create <name> --use --repo .` creates the pot but registers a broken repo source: `name="."`, `location=null`, and does not set the repo-local default. `source add repo .` already resolves `.` correctly and sets the default.  ## Reproduction  ```bash potpie --json pot create pot-1 --use --repo . potpie --json source list --pot <new-pot-id> ``` Observed: ```bash {"kind":"repo","name":".","location":null} ``` Repo default for the current repo is not set.`  Expected (same as source add repo .): ```bash {"kind":"repo","name":"github.com/owner/repo","location":"github.com/owner/repo"} with repo_default_set: true. ``` ## Root cause Two different code paths:  - source add repo → resolve_repo_location() + add_source(location=...) + set_repo_default() - pot create --repo → LocalPotStore.create() appends {kind: repo, name: repo} with no location and no default  ## Evidence `potpie/context-engine/adapters/outbound/pots/local_pot_store.py:85-92` — broken inline source on create `potpie/context-engine/adapters/inbound/cli/commands/pots.py` — pot create passed repo to store `potpie/context-engine/adapters/inbound/cli/commands/pots.py` — source add uses resolve_repo_location + default `potpie/context-engine/adapters/inbound/cli/repo_location.py` — repo resolution helpers `potpie/context-engine/tests/unit/test_cli_ergonomics.py` — source add repo . contract tests  ## Impact - Repo pot resolution breaks after pot create --repo . - source list shows unusable source meta
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-1808">POT-1808</a></p>
  > <!-- This is an auto-generated reply by CodeRabbit --> ## Coding Plan  ### Summary  - Extract a single `register_repo_source()` helper in `pots.py` that performs resolve → `add_source` → `set_repo_default`, and route both `source add repo` and `pot create --repo` through it. - Remove the malformed inline source registration from `LocalPotStore.create()` so there is one correct registration path. - Add `--no-default` to `pot create` and enrich its JSON output with `source`, `repo_default_set`, and `repo_key`, matching `source add`. - Align the setup wizard with the shared path and add tests covering `.`/`current` normalization, CWD fallback, and `--no-default`.  <details> <summary><b>Design Choices</b></summary>  <details> <summary><b>Design Choice 1: Where should the shared repo-registration helper live?</b></summary>    **Options Considered:** 1. Define `register_repo_source()` in `adapters/inbound/cli/commands/pots.py` (as stated in the ticket). 2. Define it in `repo_location.py` alo

- **Issue #971** (2026-07-01): **Surface empty-pot recovery guidance earlier in pot/source commands**
  *Symptoms*: ## Summary  `graph status`, `graph read`, and `search-entities` warn when the current pot has **0 claims** but another repo-linked pot has claims. That recovery hint is useful, but it only appears **after** graph calls have already run.  Users can create or switch to an empty pot, register sources, and only discover the mismatch once they hit graph commands.  **Area:** `potpie-context-engine` CLI — pot/source commands + `_common.empty_pot_warnings`   **Severity:** Low–Medium — UX / recovery guidance, not data loss  ## Reproduction  1. Link the same repo to two pots: one empty, one populated. 2. `potpie pot use <empty-pot>` or `potpie source add repo .` on the empty pot. 3. Command succeeds with no warning. 4. `potpie graph status` (or `read` / `search-entities`) warns:   ## Root cause  `empty_pot_warnings()` in `_common.py` is only called from graph commands **after** graph service calls complete.  Pot/source commands (`pot create`, `pot use`, `source add`, `source list`) do not surface the same guidance.  ## Evidence  - `potpie/context-engine/adapters/inbound/cli/commands/_common.py` — `empty_pot_warnings()` - `potpie/context-engine/adapters/inbound/cli/commands/graph.py` — used in `status`, `read`, `search-entities` - `potpie/context-engine/adapters/inbound/cli/commands/pots.py` — pot/source commands with no early warning - `potpie/context-engine/tests/unit/test_graph_cli_contract.py::test_graph_status_warns_when_active_repo_pot_is_empty`  ## Impact  - Users pick the wrong 
  **Post-Mortem & Fix Analysis**:
  > <!-- linear-linkback --> <p><a href="https://linear.app/potpie/issue/POT-1807">POT-1807</a></p>
  > <!-- This is an auto-generated reply by CodeRabbit --> ## Coding Plan  ### Summary  - Centralize a new `empty_pot_guidance()` in `_common.py` that reuses the existing sibling-pot warning and adds ingestion next-step guidance for pots with sources but zero claims. - Add an `enrich_with_pot_guidance()` helper that injects `warnings`/`recommended_next_action` into the emit payload (for `--json`) and appends warning lines to the human string, leaving the shared `emit()` untouched. - Wire the helper into `pot create`, `pot use`, `source add`, and `source list` at the point each resolves its pot, so guidance appears before any graph call. - Keep graph commands and their existing warnings unchanged, and add fake-host contract tests covering the new early guidance across both output modes.  <details> <summary><b>Design Choices</b></summary>  <details> <summary><b>Design Choice 1: How should warnings reach `--json` output given that `emit()` only serializes the payload dict?</b></summary>    **

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

### Incident Patch 1: `32b8cbbb` (2026-09-28)
**Commit Message**: fix(deps): bump anyio to 4.14.2 for CVE-2026-63374 (#1080)

Raise the workspace floor to anyio>=4.14.2 so the transitive httpx /
starlette pin leaves the TLS IDNA hostname-mismatch range (<=4.14.1)
flagged by Vanta POT-2597.

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: Shambhavi Shinde <[REDACTED_EMAIL]>

**File**: `potpie/context-engine/pyproject.toml` (modified, +1/-0)
```diff
@@ -144,5 +144,6 @@ constraint-dependencies = [
     "urllib3>=2.7.0",
     "httpx2>=2.12.0",
     "httpcore2>=2.10.0",
+    "anyio>=4.14.2",
     "soupsieve>=2.9.0",
 ]
```

**File**: `potpie/context-engine/uv.lock` (modified, +1/-0)
```diff
@@ -25,6 +25,7 @@ constraints = [
     { name = "urllib3", specifier = ">=2.7.0" },
     { name = "httpcore2", specifier = ">=2.10.0" },
     { name = "httpx2", specifier = ">=2.12.0" },
+    { name = "anyio", specifier = ">=4.14.2" },
     { name = "soupsieve", specifier = ">=2.9.0" },
 ]
 
```

**File**: `potpie/sandbox/pyproject.toml` (modified, +2/-0)
```diff
@@ -50,4 +50,6 @@ constraint-dependencies = [
     "starlette>=1.3.1",
     "torch>=2.13.0",
     "urllib3>=2.7.0",
+    # CVE-2026-63374 / GHSA-82r6-8w77-94w6: floor at 4.14.2 (vulnerable: <=4.14.1).
+    "anyio>=4.14.2",
 ]
```

**File**: `potpie/sandbox/uv.lock` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ constraints = [
     { name = "starlette", specifier = ">=1.3.1" },
     { name = "torch", specifier = ">=2.13.0" },
     { name = "urllib3", specifier = ">=2.7.0" },
+    { name = "anyio", specifier = ">=4.14.2" },
 ]
 
 [[package]]
```

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -130,6 +130,7 @@ override-dependencies = [
     # transitive genai-prices client stack on patched releases.
     "httpx2>=2.12.0",
     "httpcore2>=2.10.0",
+    "anyio>=4.14.2",
     "soupsieve>=2.9.0",
 ]
 
```

**File**: `uv.lock` (modified, +4/-3)
```diff
@@ -17,6 +17,7 @@ members = [
 ]
 overrides = [
     { name = "aiohttp", specifier = ">=3.14.3" },
+    { name = "anyio", specifier = ">=4.14.2" },
     { name = "cryptography", specifier = ">=50.0.0" },
     { name = "gitpython", specifier = ">=3.1.58" },
     { name = "httpcore2", specifier = ">=2.10.0" },
@@ -195,15 +196,15 @@ wheels = [
 
 [[package]]
 name = "anyio"
-version = "4.13.0"
+version = "4.14.2"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "idna" },
     { name = "typing-extensions", marker = "python_full_version < '3.13'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/19/14/2c5dd9f512b66549ae92767a9c7b330ae88e1932ca57876909410251fe13/anyio-4.13.0.tar.gz", hash = "sha256:334b70e641fd2221c1505b3890c69882fe4a2df910cba14d97019b90b24439dc", size = 231622, upload-time = "2026-03-24T12:59:09.671Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/61/cc/a381afa6efea9f496eff839d4a6a1aed3bfafc7b3ab4b0d1b243a12573dd/anyio-4.14.2.tar.gz", hash = "sha256:cfa139f3ed1a23ee8f88a145ddb5ac7605b8bbfd8592baacd7ce3d8bb4313c7f", size = 260176, upload-time = "2026-07-12T20:29:07.082Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/da/42/e921fccf5015463e32a3cf6ee7f980a6ed0f395ceeaa45060b61d86486c2/anyio-4.13.0-py3-none-any.whl", hash = "sha256:08b310f9e24a9594186fd75b4f73f4a4152069e3853f1ed8bfbf58369f4ad708", size = 114353, upload-time = "2026-03-24T12:59:08.246Z" },
+    { url = "https://files.pythonhosted.org/packages/da/35/f2287558c17e29fafc8ef3daf819bb9834061cfa43bff8014f7df7f63bdc/anyio-4.14.2-py3-none-any.whl", hash = "sha256:9f505dda5ac9f0c8309b5e8bd445a8c2bf7246f3ce950121e45ea15bc41d1494", size = 125813, upload-time = "2026-07-12T20:29:05.763Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 2: `db33c46d` (2026-09-23)
**Commit Message**: fix(deps): bump soupsieve to 2.9.2 for CVE-2026-85999/86000 (POT-2569) (#1079)

* fix(deps): bump soupsieve to 2.9.2 for CVE-2026-85999/86000

Raise the workspace floor to soupsieve>=2.9.0 so the markdownify →
beautifulsoup4 transitive pin in context-engine leaves the ReDoS range
(<2.9.0) flagged by Vanta POT-2569.

Co-authored-by: Shambhavi Shinde <[REDACTED_EMAIL]>

* chore: drop soupsieve CVE comments per review

Review feedback on #1079: keep the >=2.9.0 floor without inline CVE notes.
---------
Co-authored-by: Shambhavi Shinde <[REDACTED_EMAIL]>

**File**: `potpie/context-engine/pyproject.toml` (modified, +1/-0)
```diff
@@ -144,4 +144,5 @@ constraint-dependencies = [
     "urllib3>=2.7.0",
     "httpx2>=2.12.0",
     "httpcore2>=2.10.0",
+    "soupsieve>=2.9.0",
 ]
```

**File**: `potpie/context-engine/uv.lock` (modified, +4/-3)
```diff
@@ -25,6 +25,7 @@ constraints = [
     { name = "urllib3", specifier = ">=2.7.0" },
     { name = "httpcore2", specifier = ">=2.10.0" },
     { name = "httpx2", specifier = ">=2.12.0" },
+    { name = "soupsieve", specifier = ">=2.9.0" },
 ]
 
 [[package]]
@@ -3245,11 +3246,11 @@ wheels = [
 
 [[package]]
 name = "soupsieve"
-version = "2.8.4"
+version = "2.9.2"
 source = { registry = "https://pypi.org/simple" }
-sdist = { url = "https://files.pythonhosted.org/packages/47/2c/0a5f6f8ee0d5589e48c7640213ed5175d52cf540a06725b628cc1a45d6ce/soupsieve-2.8.4.tar.gz", hash = "sha256:e121fd02e975c695e4e9e8774a5ee35d74714b59307868dcc5319ad2d9e3328e", size = 121110, upload-time = "2026-05-24T13:55:57.154Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/69/99/a6ca3beb3ccacb41fb3321d8a60e5566f9e6467601ef8eba6a17e1b89778/soupsieve-2.9.2.tar.gz", hash = "sha256:4a55d8cf158a9c2e587fa4922f1bbb91d68ac829e2d6f25403a85747c71daf74", size = 122445, upload-time = "2026-08-07T00:57:24.801Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/5e/f5/0c41cb68dcae6b7de4fac4188a3a9589e21fb31df21ea3a2e888db95e6c9/soupsieve-2.8.4-py3-none-any.whl", hash = "sha256:e7e6b0769c8f51ed59acab6e994b00621096cfb1c640a7509295987388fbaf65", size = 37304, upload-time = "2026-05-24T13:55:55.406Z" },
+    { url = "https://files.pythonhosted.org/packages/eb/dc/ad025c1ee131eba60c69f4dd5779b18fcf1e6b21a343e2162a84d5d133c7/soupsieve-2.9.2-py3-none-any.whl", hash = "sha256:8089a26fd974ca7a1f30276d3d8492ab266ab15af581642dfe8aa162e0c1c823", size = 37370, upload-time = "2026-08-07T00:57:23.524Z" },
 ]
 
 [[package]]
```

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -130,6 +130,7 @@ override-dependencies = [
     # transitive genai-prices client stack on patched releases.
     "httpx2>=2.12.0",
     "httpcore2>=2.10.0",
+    "soupsieve>=2.9.0",
 ]
 
 [tool.uv.workspace]
```

**File**: `uv.lock` (modified, +1/-0)
```diff
@@ -27,6 +27,7 @@ overrides = [
     { name = "pydantic-settings", specifier = ">=2.14.2" },
     { name = "pyjwt", specifier = ">=2.13.0" },
     { name = "python-dotenv", specifier = ">=1.2.2" },
+    { name = "soupsieve", specifier = ">=2.9.0" },
     { name = "starlette", specifier = ">=1.3.1" },
     { name = "torch", specifier = ">=2.13.0" },
 ]
```

---

### Incident Patch 3: `6373454c` (2026-09-09)
**Commit Message**: fix(deps): remediate Vanta high and medium vulnerabilities (#1075)

**File**: `potpie/context-engine/pyproject.toml` (modified, +8/-0)
```diff
@@ -124,6 +124,12 @@ dev = [
 ]
 
 [tool.uv]
+override-dependencies = [
+    # GHSA-8xx6-hgc6-gc2m and related httpx2/httpcore2 advisories: keep the
+    # transitive genai-prices client stack on patched releases.
+    "httpx2>=2.12.0",
+    "httpcore2>=2.10.0",
+]
 constraint-dependencies = [
     "aiohttp>=3.14.3",
     "cryptography>=50.0.0",
@@ -136,4 +142,6 @@ constraint-dependencies = [
     "starlette>=1.3.1",
     "torch>=2.13.0",
     "urllib3>=2.7.0",
+    "httpx2>=2.12.0",
+    "httpcore2>=2.10.0",
 ]
```

**File**: `potpie/context-engine/uv.lock` (modified, +20/-8)
```diff
@@ -23,6 +23,8 @@ constraints = [
     { name = "starlette", specifier = ">=1.3.1" },
     { name = "torch", specifier = ">=2.13.0" },
     { name = "urllib3", specifier = ">=2.7.0" },
+    { name = "httpcore2", specifier = ">=2.10.0" },
+    { name = "httpx2", specifier = ">=2.12.0" },
 ]
 
 [[package]]
@@ -991,15 +993,15 @@ wheels = [
 
 [[package]]
 name = "httpcore2"
-version = "2.7.0"
+version = "2.12.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "h11" },
     { name = "truststore" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/d5/fe/6a3f9f1a8bb8733326140737446aaf72fddb8b54b8f202302f5c84960613/httpcore2-2.7.0.tar.gz", hash = "sha256:6dc0fedf329a52a990930a5579edfebaea81118ea700ea0dd7de2b5e5be49efc", size = 65593, upload-time = "2026-07-14T20:40:01.111Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/be/ad/f4f0e57345f1870f3e8cb624e058d7eca6e5a27d33bcc3311d9b618734cd/httpcore2-2.12.0.tar.gz", hash = "sha256:9293522bba0aa7c4c8e9e3f040c16575bd8868e155a77fa30c7a9085a5eae648", size = 67548, upload-time = "2026-08-18T13:22:08.211Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/6f/6c/62e2e279e63fc4f7a5ee841ef13175a8bbc613f258e9dcc186e9de803a42/httpcore2-2.7.0-py3-none-any.whl", hash = "sha256:1452f589fe23f55b44546cd884294c41a29330af902bc0b71a761fd52d18f92b", size = 81506, upload-time = "2026-07-14T20:39:58.053Z" },
+    { url = "https://files.pythonhosted.org/packages/d2/74/d370e55600d9bcfa0d9794b0166126d49291a3d2b20c268fc98c453a4948/httpcore2-2.12.0-py3-none-any.whl", hash = "sha256:7e04258ce01013d7d615e5b910a3b27fac937d7a95038227e79652b4ba3b4ceb", size = 83074, upload-time = "2026-08-18T13:22:05.854Z" },
 ]
 
 [[package]]
@@ -1064,18 +1066,28 @@ wheels = [
 
 [[package]]
 name = "httpx2"
-version = "2.7.0"
+version = "2.12.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "anyio" },
+    { name = "anyio", marker = "sys_platform != 'emscripten'" },
     { name = "httpcore2" },
+    { name = "httpx2-jsfetch", marker = "sys_platform == 'emscripten'" },
     { name = "idna" },
-    { name = "truststore" },
+    { name = "truststore", marker = "sys_platform != 'emscripten'" },
     { name = "typing-extensions", marker = "python_full_version < '3.13'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/a3/4a/129b2e21b90ac2985d3928d96792bccc39bc6dfe796c5eee2d8ec06d4105/httpx2-2.7.0.tar.gz", hash = "sha256:8b30709aed5c8465b0dd3b95c09ce301c8f79e7e7a2d00ab0af551e0d0375b07", size = 94487, upload-time = "2026-07-14T20:40:02.318Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/7f/f8/579a8b51e42e38ee32647df9f08aa25643ae788e275cc625b199829c4671/httpx2-2.12.0.tar.gz", hash = "sha256:7631fe9887a8a2275f4a2540e053aa670fcc50742864a9ae7c66e609fdcf12cf", size = 100040, upload-time = "2026-08-18T13:22:09.086Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/c8/95/411ba65569158e862368917aaf56597f3e5fa3b91b0502919638465a08f3/httpx2-2.12.0-py3-none-any.whl", hash = "sha256:cc8b6eecb8661c146b8f89a60e97456ee086e91a784ed31ac450c3a9e613dd36", size = 95427, upload-time = "2026-08-18T13:22:06.834Z" },
+]
+
+[[package]]
+name = "httpx2-jsfetch"
+version = "1.0"
+source = { registry = "https://pypi.org/simple" }
+sdist = { url = "https://files.pythonhosted.org/packages/cd/c4/0e5636363151a2a1795e0a77617168b9ca438e1748ec05fc9b5687f93d64/httpx2_jsfetch-1.0.tar.gz", hash = "sha256:70a0e3eabfef7cce5ad9c629f7d01ca05e418f586646f4ddf14782e4c1454c60", size = 6872, upload-time = "2026-08-07T00:13:07.492Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/1d/b8/c341bba6411bdfda786020343c47a75ef472f6085caf82391b142b1a3ad9/httpx2-2.7.0-py3-none-any.whl", hash = "sha256:ed2a2719c696789e09493bd8e2bec3d8bd925cc6e26b68389ec25ade132f7bf4", size = 90234, upload-time = "2026-07-14T20:39:59.531Z" },
+    { url = "https://files.pythonhosted.org/packages/9b/43/832f631d32e4f1211caa2ba368317739fe71f0b8530e4c9d15dc454bac2a/httpx2_jsfetch-1.0-py3-none-any.whl", hash = "sha256:cb916b707601e69a07721aabc8f3f6659be3a6893bc1ff5c6f9e02241df2da32", size = 6382, upload-time = "2026-08-07T00:13:06.567Z" },
 ]
 
 [[package]]
```

**File**: `potpie/daemon/http/ui/frontend/package-lock.json` (modified, +44/-30)
```diff
@@ -1192,7 +1192,9 @@
       }
     },
     "node_modules/baseline-browser-mapping": {
-      "version": "2.10.43",
+      "version": "2.11.21",
+      "resolved": "https://registry.npmjs.org/baseline-browser-mapping/-/baseline-browser-mapping-2.11.21.tgz",
+      "integrity": "sha512-uh8vpY/1/YyFkunIDFH/12p7/7VdPKA1hejMVEbdkEaWnUz0Hesvx5EbiU6XxjyHZIOju+ZMbQJkRh+es3/spQ==",
       "dev": true,
       "license": "Apache-2.0",
       "bin": {
@@ -1211,7 +1213,9 @@
       }
     },
     "node_modules/browserslist": {
-      "version": "4.28.6",
+      "version": "4.28.9",
+      "resolved": "https://registry.npmjs.org/browserslist/-/browserslist-4.28.9.tgz",
+      "integrity": "sha512-EWazOblFYUvlGZcfGhPUPmYh3nikUxBVb+y9MJun5f3hBi812X+8MSQTujLBtgK3cf51fJWbWfOjyeO954d+Eg==",
       "dev": true,
       "funding": [
         {
@@ -1229,11 +1233,11 @@
       ],
       "license": "MIT",
       "dependencies": {
-        "baseline-browser-mapping": "^2.10.42",
-        "caniuse-lite": "^1.0.30001803",
-        "electron-to-chromium": "^1.5.389",
-        "node-releases": "^2.0.51",
-        "update-browserslist-db": "^1.2.3"
+        "baseline-browser-mapping": "^2.11.20",
+        "caniuse-lite": "^1.0.30001810",
+        "electron-to-chromium": "^1.5.420",
+        "node-releases": "^2.0.54",
+        "update-browserslist-db": "^1.3.2"
       },
       "bin": {
         "browserslist": "cli.js"
@@ -1243,7 +1247,9 @@
       }
     },
     "node_modules/caniuse-lite": {
-      "version": "1.0.30001806",
+      "version": "1.0.30001810",
+      "resolved": "https://registry.npmjs.org/caniuse-lite/-/caniuse-lite-1.0.30001810.tgz",
+      "integrity": "sha512-TITQPUkaz+aVk5GL6NhOdwk1aEaNTSDPsGFWrTuhKGtjTF70jL/Oht2W4c6rXUe5fu7Ie19VIahAXHIIiWWNeg==",
       "dev": true,
       "funding": [
         {
@@ -1476,7 +1482,9 @@
       }
     },
     "node_modules/electron-to-chromium": {
-      "version": "1.5.393",
+      "version": "1.5.425",
+      "resolved": "https://registry.npmjs.org/electron-to-chromium/-/electron-to-chromium-1.5.425.tgz",
+      "integrity": "sha512-QvPtl41EUOnuT1HBvMKgxXRIaHNcagBPs50u7VULzhZXaGfqTbZyE16LQsctZ/RQHlGu+FOWeDTR4mY6YbeF1g==",
       "dev": true,
       "license": "ISC"
     },
@@ -1522,6 +1530,8 @@
     },
     "node_modules/escalade": {
       "version": "3.2.0",
+      "resolved": "https://registry.npmjs.org/escalade/-/escalade-3.2.0.tgz",
+      "integrity": "sha512-WUj2qlxaQtO4g6Pq5c29GTcWGDyd8itL8zTlipgECz3JesAiiOKotd8JU6otB3PACgG6xkJUyVhboMS+bje/jA==",
       "dev": true,
       "license": "MIT",
       "engines": {
@@ -1687,27 +1697,10 @@
       "dev": true,
       "license": "MIT"
     },
-    "node_modules/nanoid": {
-      "version": "3.3.17",
-      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.17.tgz",
-      "integrity": "sha512-xQLf0A3HOMlgHq0n247/LRuAOYmB7dXJ/DvAxGvsSBij45XtBSmQycu+F8ODbHwns/XyFZagyL1+J0Offw1E0g==",
-      "dev": true,
-      "funding": [
-        {
-          "type": "github",
-          "url": "https://github.com/sponsors/ai"
-        }
-      ],
-      "license": "MIT",
-      "bin": {
-        "nanoid": "bin/nanoid.cjs"
-      },
-      "engines": {
-        "node": "^10 || ^12 || ^13.7 || ^14 || >=15.0.1"
-      }
-    },
     "node_modules/node-releases": {
-      "version": "2.0.51",
+      "version": "2.0.54",
+      "resolved": "https://registry.npmjs.org/node-releases/-/node-releases-2.0.54.tgz",
+      "integrity": "sha512-YHs7BmmcsdAI5Ozuf8JZo6PT0mv2GIWC9vMfvUC3dp65M8hn7Ux8CPL+2oBI7juNuj9d0ndhTcznq2ODBps9cQ==",
       "dev": true,
       "license": "MIT",
       "engines": {
@@ -1766,6 +1759,25 @@
         "node": "^10 || ^12 || >=14"
       }
     },
+    "node_modules/postcss/node_modules/nanoid": {
+      "version": "3.3.18",
+      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.18.tgz",
+      "integrity": "sha512-DTg4MJbGMWkfi6VZFdNt2/caMbQy4Ou+Op/hJQvGEWcnVfoA1QA+xzRKAzw9jD6+GVOOeYr/mIcuDSdug6F6+w==",
+      "dev": true,
+      "funding": [
+        {
+          "type": "github",
+          "url": "https://github.com/sponsors/ai"
+        }
+      ],
+      "license": "MIT",
+      "bin": {
+        "nanoid": "bin/nanoid.cjs"
+      },
+      "engines": {
+        "node": "^10 || ^12 || ^13.7 || ^14 || >=15.0.1"
+      }
+    },
     "node_modules/preact": {
       "version": "10.29.7",
       "license": "MIT",
@@ -1950,7 +1962,9 @@
       }
     },
     "node_modules/update-browserslist-db": {
-      "version": "1.2.3",
+      "version": "1.3.2",
+      "resolved": "https://registry.npmjs.org/update-browserslist-db/-/update-browserslist-db-1.3.2.tgz",
+      "integrity": "sha512-UQ+MSxlhRm1bzjhU+DcuXfjFO1FzNtqhK5+9Yvlp90ItDLk5vT932A0rFu619nf7RVS+Y/VeaUW1jaRDqZ8VJw==",
       "dev": true,
       "funding": [
         {
```

**File**: `potpie/daemon/http/ui/frontend/package.json` (modified, +4/-1)
```diff
@@ -22,6 +22,9 @@
     "vite": "^6.4.3"
   },
   "overrides": {
-    "postcss": ">=8.5.23"
+    "postcss": ">=8.5.23",
+    "baseline-browser-mapping": ">=2.11.0",
+    "browserslist": ">=4.28.7",
+    "nanoid": ">=3.3.18 <4.0.0"
   }
 }
```

**File**: `pyproject.toml` (modified, +4/-0)
```diff
@@ -126,6 +126,10 @@ override-dependencies = [
     "pydantic-ai-slim>=1.106.0",
     # CVE-2025-3000: torch <= 2.12.1; 2.13.0 is the first patched release on PyPI.
     "torch>=2.13.0",
+    # GHSA-8xx6-hgc6-gc2m and related httpx2/httpcore2 advisories: keep the
+    # transitive genai-prices client stack on patched releases.
+    "httpx2>=2.12.0",
+    "httpcore2>=2.10.0",
 ]
 
 [tool.uv.workspace]
```

**File**: `uv.lock` (modified, +21/-8)
```diff
@@ -19,6 +19,8 @@ overrides = [
     { name = "aiohttp", specifier = ">=3.14.3" },
     { name = "cryptography", specifier = ">=50.0.0" },
     { name = "gitpython", specifier = ">=3.1.58" },
+    { name = "httpcore2", specifier = ">=2.10.0" },
+    { name = "httpx2", specifier = ">=2.12.0" },
     { name = "idna", specifier = ">=3.15" },
     { name = "openai", specifier = ">=2.7.1" },
     { name = "pydantic-ai-slim", specifier = ">=1.106.0" },
@@ -1308,15 +1310,15 @@ wheels = [
 
 [[package]]
 name = "httpcore2"
-version = "2.3.0"
+version = "2.12.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "h11" },
     { name = "truststore" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/e6/34/18f1c596e677962f040284246f393b10a1f8ce440b3a7e69c637d0f1c7ad/httpcore2-2.3.0.tar.gz", hash = "sha256:07327e251560960eea8e969d92d4c6a325feb13cca39e25340731336c3baf924", size = 64300, upload-time = "2026-06-01T13:15:02.998Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/be/ad/f4f0e57345f1870f3e8cb624e058d7eca6e5a27d33bcc3311d9b618734cd/httpcore2-2.12.0.tar.gz", hash = "sha256:9293522bba0aa7c4c8e9e3f040c16575bd8868e155a77fa30c7a9085a5eae648", size = 67548, upload-time = "2026-08-18T13:22:08.211Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/c2/dd/3357218c69360d1cecc196c230c9a1d5c9afd5dba362056e23e60a5e64e5/httpcore2-2.3.0-py3-none-any.whl", hash = "sha256:477e9e334f74e5240dcac002e890580f36a57d40ff0fb14cc9655731d23b8415", size = 80024, upload-time = "2026-06-01T13:15:00.001Z" },
+    { url = "https://files.pythonhosted.org/packages/d2/74/d370e55600d9bcfa0d9794b0166126d49291a3d2b20c268fc98c453a4948/httpcore2-2.12.0-py3-none-any.whl", hash = "sha256:7e04258ce01013d7d615e5b910a3b27fac937d7a95038227e79652b4ba3b4ceb", size = 83074, upload-time = "2026-08-18T13:22:05.854Z" },
 ]
 
 [[package]]
@@ -1387,17 +1389,28 @@ wheels = [
 
 [[package]]
 name = "httpx2"
-version = "2.3.0"
+version = "2.12.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
-    { name = "anyio" },
+    { name = "anyio", marker = "sys_platform != 'emscripten'" },
     { name = "httpcore2" },
+    { name = "httpx2-jsfetch", marker = "sys_platform == 'emscripten'" },
     { name = "idna" },
-    { name = "truststore" },
+    { name = "truststore", marker = "sys_platform != 'emscripten'" },
+    { name = "typing-extensions", marker = "python_full_version < '3.13'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/9f/9a/cca0b9145f13d8ae34b885ae28d403a1469a433abc78e0f94f4ce94e650b/httpx2-2.3.0.tar.gz", hash = "sha256:227e7c41d95a76d4077a52640564132777215fc3394e07b66a3116c33d668fa9", size = 81115, upload-time = "2026-06-01T13:15:04.324Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/7f/f8/579a8b51e42e38ee32647df9f08aa25643ae788e275cc625b199829c4671/httpx2-2.12.0.tar.gz", hash = "sha256:7631fe9887a8a2275f4a2540e053aa670fcc50742864a9ae7c66e609fdcf12cf", size = 100040, upload-time = "2026-08-18T13:22:09.086Z" }
+wheels = [
+    { url = "https://files.pythonhosted.org/packages/c8/95/411ba65569158e862368917aaf56597f3e5fa3b91b0502919638465a08f3/httpx2-2.12.0-py3-none-any.whl", hash = "sha256:cc8b6eecb8661c146b8f89a60e97456ee086e91a784ed31ac450c3a9e613dd36", size = 95427, upload-time = "2026-08-18T13:22:06.834Z" },
+]
+
+[[package]]
+name = "httpx2-jsfetch"
+version = "1.0"
+source = { registry = "https://pypi.org/simple" }
+sdist = { url = "https://files.pythonhosted.org/packages/cd/c4/0e5636363151a2a1795e0a77617168b9ca438e1748ec05fc9b5687f93d64/httpx2_jsfetch-1.0.tar.gz", hash = "sha256:70a0e3eabfef7cce5ad9c629f7d01ca05e418f586646f4ddf14782e4c1454c60", size = 6872, upload-time = "2026-08-07T00:13:07.492Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/87/ce/ae2911859847f9ba1d6b23027e53481cbeb50b93234f355a968d300ca2cb/httpx2-2.3.0-py3-none-any.whl", hash = "sha256:6f393663bdf6dbe7fe90118e3eb5b2bd024a675cae0390ac08cec9198812d8b7", size = 74538, upload-time = "2026-06-01T13:15:01.566Z" },
+    { url = "https://files.pythonhosted.org/packages/9b/43/832f631d32e4f1211caa2ba368317739fe71f0b8530e4c9d15dc454bac2a/httpx2_jsfetch-1.0-py3-none-any.whl", hash = "sha256:cb916b707601e69a07721aabc8f3f6659be3a6893bc1ff5c6f9e02241df2da32", size = 6382, upload-time = "2026-08-07T00:13:06.567Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 4: `642a72c3` (2026-09-07)
**Commit Message**: fix(deps): remediate xmldom vulnerability (POT-2475) (#1072)

* fix(deps): remediate xmldom vulnerability in docs checks

* fix(deps): lock xmldom at patched version

**File**: `tests/docs/package-lock.json` (modified, +4/-4)
```diff
@@ -6,17 +6,17 @@
     "": {
       "name": "potpie-docs-check",
       "dependencies": {
-        "@xmldom/xmldom": "^0.9.11",
+        "@xmldom/xmldom": "^0.9.12",
         "yaml": "^2.8.2"
       },
       "engines": {
         "node": ">=22"
       }
     },
     "node_modules/@xmldom/xmldom": {
-      "version": "0.9.11",
-      "resolved": "https://registry.npmjs.org/@xmldom/xmldom/-/xmldom-0.9.11.tgz",
-      "integrity": "sha512-tW8bcK3hsG0/uqSnNz6TK4BkcuZSezoU7DlnYssILmZDktPnSHHuDJJFM0AJv+13gz2r0iGdrj6qqKeUnxXEDg==",
+      "version": "0.9.12",
+      "resolved": "https://registry.npmjs.org/@xmldom/xmldom/-/xmldom-0.9.12.tgz",
+      "integrity": "sha512-5AXjrcMClTryPe9LgZrygpB1lj7s0S9E0+W+AHaVKAVyHanafK86iPSvG5xHVSp/jC+VH1UXu0TAEmY279xH7A==",
       "license": "MIT",
       "engines": {
         "node": ">=14.6"
```

**File**: `tests/docs/package.json` (modified, +1/-1)
```diff
@@ -11,7 +11,7 @@
     "node": ">=22"
   },
   "dependencies": {
-    "@xmldom/xmldom": "^0.9.11",
+    "@xmldom/xmldom": "^0.9.12",
     "yaml": "^2.8.2"
   }
 }
```

---

### Incident Patch 5: `23f11d68` (2026-08-31)
**Commit Message**: fix: align PyPI metadata tooling (#1069)

**File**: `.github/workflows/release_potpie_pypi.yml` (modified, +2/-2)
```diff
@@ -366,7 +366,7 @@ jobs:
           path: release-bundle
 
       - name: Publish potpie-context-engine
-        uses: pypa/gh-action-pypi-publish@cef221092ed1bacb1cc03d23a2d87d1d172e277b # release/v1
+        uses: pypa/gh-action-pypi-publish@dc37677b2e1c63e2034f94d8a5b11f265b73ba33 # release/v1
         with:
           packages-dir: release-bundle/dist/context-engine/
 
@@ -401,7 +401,7 @@ jobs:
           path: release-bundle
 
       - name: Publish potpie
-        uses: pypa/gh-action-pypi-publish@cef221092ed1bacb1cc03d23a2d87d1d172e277b # release/v1
+        uses: pypa/gh-action-pypi-publish@dc37677b2e1c63e2034f94d8a5b11f265b73ba33 # release/v1
         with:
           packages-dir: release-bundle/dist/potpie/
 
```

**File**: `potpie/context-engine/pyproject.toml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 [build-system]
-requires = ["hatchling"]
+requires = ["hatchling==1.32.0"]
 build-backend = "hatchling.build"
 
 [tool.hatch.build.hooks.custom]
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,5 +1,5 @@
 [build-system]
-requires = ["hatchling>=1.27"]
+requires = ["hatchling==1.32.0"]
 build-backend = "hatchling.build"
 
 [tool.hatch.build.hooks.custom]
```

---

### Incident Patch 6: `a3419788` (2026-08-14)
**Commit Message**: fix(deps): bump pydantic-ai-slim past CVE-2026-54249 (POT-2310) (#1054)

Raise the pydantic-ai-slim floor from 1.102.0 to 1.106.0 and lock
1.107.4 so Dependabot/Vanta no longer report GHSA-h7p7-w5gc-xj3w.

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: Shambhavi Shinde <[REDACTED_EMAIL]>

**File**: `potpie/context-engine/pyproject.toml` (modified, +3/-3)
```diff
@@ -64,8 +64,8 @@ github = [
 ]
 reconciliation-agent = [
     "pydantic-deep>=0.3.0",
-    # CVE floor for pydantic-deep's transitive dependency (see #1015).
-    "pydantic-ai-slim>=1.102.0",
+    # CVE-2026-54249: floor at 1.106.0 (vulnerable: >=1.65.0, <1.106.0).
+    "pydantic-ai-slim>=1.106.0",
 ]
 hatchet = [
     "hatchet-sdk>=1.29.0",
@@ -139,7 +139,7 @@ constraint-dependencies = [
     "gitpython>=3.1.58",
     "idna>=3.15",
     "pyjwt>=2.13.0",
-    "pydantic-ai-slim>=1.102.0",
+    "pydantic-ai-slim>=1.106.0",
     "pydantic-settings>=2.14.2",
     "python-multipart>=0.0.28",
     "starlette>=1.3.1",
```

**File**: `potpie/context-engine/uv.lock` (modified, +3/-3)
```diff
@@ -16,7 +16,7 @@ constraints = [
     { name = "cryptography", specifier = ">=50.0.0" },
     { name = "gitpython", specifier = ">=3.1.58" },
     { name = "idna", specifier = ">=3.15" },
-    { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
+    { name = "pydantic-ai-slim", specifier = ">=1.106.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
     { name = "pyjwt", specifier = ">=2.13.0" },
     { name = "python-multipart", specifier = ">=0.0.28" },
@@ -2128,8 +2128,8 @@ requires-dist = [
     { name = "psycopg", extras = ["binary"], marker = "extra == 'all'", specifier = ">=3.2" },
     { name = "psycopg", extras = ["binary"], marker = "extra == 'postgres'", specifier = ">=3.2" },
     { name = "pydantic", specifier = ">=2.0" },
-    { name = "pydantic-ai-slim", marker = "extra == 'all'", specifier = ">=1.102.0" },
-    { name = "pydantic-ai-slim", marker = "extra == 'reconciliation-agent'", specifier = ">=1.102.0" },
+    { name = "pydantic-ai-slim", marker = "extra == 'all'", specifier = ">=1.106.0" },
+    { name = "pydantic-ai-slim", marker = "extra == 'reconciliation-agent'", specifier = ">=1.106.0" },
     { name = "pydantic-deep", marker = "extra == 'all'", specifier = ">=0.3.0" },
     { name = "pydantic-deep", marker = "extra == 'reconciliation-agent'", specifier = ">=0.3.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
```

**File**: `potpie/sandbox/pyproject.toml` (modified, +1/-1)
```diff
@@ -44,7 +44,7 @@ constraint-dependencies = [
     "gitpython>=3.1.58",
     "idna>=3.15",
     "pyjwt>=2.13.0",
-    "pydantic-ai-slim>=1.102.0",
+    "pydantic-ai-slim>=1.106.0",
     "pydantic-settings>=2.14.2",
     "python-multipart>=0.0.28",
     "starlette>=1.3.1",
```

**File**: `potpie/sandbox/uv.lock` (modified, +1/-1)
```diff
@@ -8,7 +8,7 @@ constraints = [
     { name = "cryptography", specifier = ">=50.0.0" },
     { name = "gitpython", specifier = ">=3.1.58" },
     { name = "idna", specifier = ">=3.15" },
-    { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
+    { name = "pydantic-ai-slim", specifier = ">=1.106.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
     { name = "pyjwt", specifier = ">=2.13.0" },
     { name = "python-multipart", specifier = ">=0.0.28" },
```

**File**: `pyproject.toml` (modified, +3/-2)
```diff
@@ -33,7 +33,7 @@ dependencies = [
     "pillow>=12.3.0",
     "potpie-context-core==0.1.0",
     "potpie-context-engine[all]==0.1.0",
-    "pydantic-ai-slim>=1.102.0",
+    "pydantic-ai-slim>=1.106.0",
     "pydantic-settings>=2.14.2",
     "pyjwt>=2.13.0",
     "rich>=13.0",
@@ -109,7 +109,8 @@ override-dependencies = [
     "starlette>=1.3.1",
     "pyjwt>=2.13.0",
     "pydantic-settings>=2.14.2",
-    "pydantic-ai-slim>=1.102.0",
+    # CVE-2026-54249: floor at 1.106.0 (vulnerable: >=1.65.0, <1.106.0).
+    "pydantic-ai-slim>=1.106.0",
     # CVE-2025-3000: torch <= 2.12.1; 2.13.0 is the first patched release on PyPI.
     "torch>=2.13.0",
 ]
```

**File**: `uv.lock` (modified, +9/-9)
```diff
@@ -22,7 +22,7 @@ overrides = [
     { name = "gitpython", specifier = ">=3.1.58" },
     { name = "idna", specifier = ">=3.15" },
     { name = "openai", specifier = ">=2.7.1" },
-    { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
+    { name = "pydantic-ai-slim", specifier = ">=1.106.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
     { name = "pyjwt", specifier = ">=2.13.0" },
     { name = "python-dotenv", specifier = ">=1.2.2" },
@@ -2475,7 +2475,7 @@ requires-dist = [
     { name = "pillow", specifier = ">=12.3.0" },
     { name = "potpie-context-core", editable = "potpie/context-core" },
     { name = "potpie-context-engine", extras = ["all"], editable = "potpie/context-engine" },
-    { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
+    { name = "pydantic-ai-slim", specifier = ">=1.106.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
     { name = "pyjwt", specifier = ">=2.13.0" },
     { name = "rich", specifier = ">=13.0" },
@@ -2633,7 +2633,7 @@ requires-dist = [
     { name = "potpie-context-engine", extras = ["cli-auth", "http", "local", "neo4j", "postgres", "hatchet", "observability", "embeddings", "github", "reconciliation-agent"], marker = "extra == 'all'", editable = "potpie/context-engine" },
     { name = "psycopg", extras = ["binary"], marker = "extra == 'postgres'", specifier = ">=3.2" },
     { name = "pydantic", specifier = ">=2.0" },
-    { name = "pydantic-ai-slim", marker = "extra == 'reconciliation-agent'", specifier = ">=1.102.0" },
+    { name = "pydantic-ai-slim", marker = "extra == 'reconciliation-agent'", specifier = ">=1.106.0" },
     { name = "pydantic-deep", marker = "extra == 'reconciliation-agent'", specifier = ">=0.3.0" },
     { name = "pygithub", marker = "extra == 'github'", specifier = ">=2.8.0" },
     { name = "pytest", marker = "extra == 'dev'", specifier = ">=9.0.3" },
@@ -3004,7 +3004,7 @@ wheels = [
 
 [[package]]
 name = "pydantic-ai-slim"
-version = "1.105.0"
+version = "1.107.4"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "genai-prices" },
@@ -3015,9 +3015,9 @@ dependencies = [
     { name = "pydantic-graph" },
     { name = "typing-inspection" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/cd/ae/1b0370f9b9f1ca7ccf2e6b51ec5a8d11da11d9dd621e5eb015c6420c5e9b/pydantic_ai_slim-1.105.0.tar.gz", hash = "sha256:8b4ad8034b40ab3bde8e0c6285082a204ecd203007150a47943f192b474e06e9", size = 772048, upload-time = "2026-06-02T06:20:01.522Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/6e/3a/6598d86998e5a6f2eedfd1d64397c8d29cb49dc5f515f873974db797e36e/pydantic_ai_slim-1.107.4.tar.gz", hash = "sha256:3ed2ca7a73b30067747331831d5b9f39938575dff5e4bf73ef11ea9b3af2b170", size = 783311, upload-time = "2026-08-12T03:58:05.588Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/12/6e/8afdff693d21c0743ee71d792ce90afc27d4ddbaf7270d969a84452cfd0d/pydantic_ai_slim-1.105.0-py3-none-any.whl", hash = "sha256:1e65561ba9a58a9d8fc3a63b550c3c2b2c4017da275dea78291e526aa06298d8", size = 956108, upload-time = "2026-06-02T06:19:52.821Z" },
+    { url = "https://files.pythonhosted.org/packages/3f/97/b450636a6aee0a20bb7637f69838c11077c48ad49e4601f0c0b4ad3aef9b/pydantic_ai_slim-1.107.4-py3-none-any.whl", hash = "sha256:439cdd8f8a164deefa42960a7e7a74b5cb60eefdc4d3a0067ce3bf39078c3536", size = 967512, upload-time = "2026-08-12T03:57:58.462Z" },
 ]
 
 [[package]]
@@ -3127,17 +3127,17 @@ wheels = [
 
 [[package]]
 name = "pydantic-graph"
-version = "1.105.0"
+version = "1.107.4"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "httpx" },
     { name = "logfire-api" },
     { name = "pydantic" },
     { name = "typing-inspection" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/33/98/0361e1eb28f8d107e4e12dcd2d14eabef55f4a8ca18b1a6f185df74934c0/pydantic_graph-1.105.0.tar.gz", hash = "sha256:3f5cf97d544b900098d3cc2dbd6a8cdd79ea59dac610d7651f86c9228d33c0b9", size = 62570, upload-time = "2026-06-02T06:20:05.158Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/63/ff/b9a33406005bf95bf20a279aa8c3cbcbb1634fce6c97878c670eb7fc4f6f/pydantic_graph-1.107.4.tar.gz", hash = "sha256:7a7309e7b53739cab5a12dd1bf8c33ebd9ecd62fd9fa0b7c1fac3e545e6988d3", size = 62569, upload-time = "2026-08-12T03:58:07.759Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/be/1b/13882fd4d70299dc2995bee20f21599cb8d453b27f44e239f82384d4ea3f/pydantic_graph-1.105.0-py3-none-any.whl", hash = "sha256:ba76d77ad21a13f2961fbda9d988f3d5a3d9ffc1817ee912e0ea59b0b5a9e825", size = 80099, upload-time = "2026-06-02T06:19:57.098Z" },
+    { url = "https://files.pythonhosted.org/packages/bc/5c/1209e440ce02bcce6d7716b89a67680ffd4492ce9be1be6ee124ee35b674/pydantic_graph-1.107.4-py3-none-any.whl", hash = "sha256:6502abe529257de564fc21fb4fa35f69e1daf5e22a7d014b34be6c82e9c27d8e", size = 80106, upload-time = "2026-08-12T03:58:01.493Z" },
 ]
 
 [
```

---

### Incident Patch 7: `af27492c` (2026-08-13)
**Commit Message**: Revert "fix(deps): clear stale legacy/uv.lock for POT-2266 Medium vulns (#1048)" (#1052)

This reverts commit 86891420e0d9d5de8fadcae1668269e9aa0c6c2c.

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `legacy/uv.lock` (removed, +0/-8)
```diff
@@ -1,8 +0,0 @@
-version = 1
-revision = 3
-requires-python = ">=3.12, <3.15"
-
-[[package]]
-name = "potpie-legacy"
-version = "0.2.0"
-source = { editable = "." }
```

**File**: `potpie/context-engine/pyproject.toml` (modified, +0/-1)
```diff
@@ -137,7 +137,6 @@ constraint-dependencies = [
     "aiohttp>=3.14.3",
     "cryptography>=50.0.0",
     "gitpython>=3.1.58",
-    "h2>=4.4.1",
     "idna>=3.15",
     "pyjwt>=2.13.0",
     "pydantic-ai-slim>=1.102.0",
```

**File**: `potpie/context-engine/uv.lock` (modified, +0/-1)
```diff
@@ -15,7 +15,6 @@ constraints = [
     { name = "aiohttp", specifier = ">=3.14.3" },
     { name = "cryptography", specifier = ">=50.0.0" },
     { name = "gitpython", specifier = ">=3.1.58" },
-    { name = "h2", specifier = ">=4.4.1" },
     { name = "idna", specifier = ">=3.15" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
```

**File**: `potpie/sandbox/pyproject.toml` (modified, +0/-1)
```diff
@@ -42,7 +42,6 @@ constraint-dependencies = [
     "aiohttp>=3.14.3",
     "cryptography>=50.0.0",
     "gitpython>=3.1.58",
-    "h2>=4.4.1",
     "idna>=3.15",
     "pyjwt>=2.13.0",
     "pydantic-ai-slim>=1.102.0",
```

**File**: `potpie/sandbox/uv.lock` (modified, +0/-1)
```diff
@@ -7,7 +7,6 @@ constraints = [
     { name = "aiohttp", specifier = ">=3.14.3" },
     { name = "cryptography", specifier = ">=50.0.0" },
     { name = "gitpython", specifier = ">=3.1.58" },
-    { name = "h2", specifier = ">=4.4.1" },
     { name = "idna", specifier = ">=3.15" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
```

**File**: `pyproject.toml` (modified, +0/-2)
```diff
@@ -106,8 +106,6 @@ override-dependencies = [
     # GitPython GHSA-3f7w-8rr8-f37f / GHSA-539m-9xh6-q6rr (<=3.1.56) and
     # GHSA-wvpp-8hx9-p66j / related Highs (<=3.1.57): floor at 3.1.58.
     "gitpython>=3.1.58",
-    # CVE-2026-71554 / GHSA-6hr6-w5qg-qmwg: h2 <=4.4.0; floor at 4.4.1.
-    "h2>=4.4.1",
     "starlette>=1.3.1",
     "pyjwt>=2.13.0",
     "pydantic-settings>=2.14.2",
```

**File**: `uv.lock` (modified, +0/-1)
```diff
@@ -20,7 +20,6 @@ overrides = [
     { name = "aiohttp", specifier = ">=3.14.3" },
     { name = "cryptography", specifier = ">=50.0.0" },
     { name = "gitpython", specifier = ">=3.1.58" },
-    { name = "h2", specifier = ">=4.4.1" },
     { name = "idna", specifier = ">=3.15" },
     { name = "openai", specifier = ">=2.7.1" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
```

---

### Incident Patch 8: `3a2d4368` (2026-08-13)
**Commit Message**: Revert "fix(deps): clear stale potpie-legacy SBOM for POT-2236 Medium vulns (#1046)" (#1051)

This reverts commit 20b0497d4c521021addce15ca40b43250c9907d4.

**File**: `legacy/README.md` (removed, +0/-16)
```diff
@@ -1,16 +0,0 @@
-# potpie-legacy (dependency-graph stub)
-
-This directory is **not** the former Potpie demo host.
-
-After `legacy/` was removed in #1034, GitHub’s dependency graph kept a stale
-`potpie-legacy@0.1.0` / `legacy/uv.lock` snapshot that still resolved
-vulnerable pins (`aiohttp==3.14.1`, `gitpython==3.1.54`, and
-`httpx[http2]` → `h2==4.3.0`). That ghost snapshot kept Medium Dependabot /
-Vanta findings open (POT-2236, POT-2266).
-
-This empty PEP 621 manifest plus empty `uv.lock` at the same path (version
-`0.2.0`) replaces that snapshot with zero dependencies. It is intentionally
-**not** a uv workspace member.
-
-Once Dependabot shows `deps=0` for this path (or the alerts auto-close), a
-follow-up may delete this stub entirely.
```

**File**: `legacy/_potpie_legacy_stub/__init__.py` (removed, +0/-1)
```diff
@@ -1 +0,0 @@
-"""Empty package so hatch can build the potpie-legacy hygiene stub wheel."""
```

**File**: `legacy/pyproject.toml` (removed, +0/-20)
```diff
@@ -1,20 +0,0 @@
-[build-system]
-requires = ["hatchling>=1.27"]
-build-backend = "hatchling.build"
-
-# Dependency-graph hygiene stub (POT-2236 / POT-2266).
-# GitHub's SBOM kept a deleted potpie-legacy@0.1.0 + legacy/uv.lock snapshot
-# with aiohttp==3.14.1, gitpython==3.1.54, and httpx[http2] -> h2==4.3.0 after
-# legacy/ was removed (#1034). Re-publishing an empty manifest + empty uv.lock
-# at this path (version bump to 0.2.0) replaces that stale snapshot so
-# Dependabot/Vanta Medium findings can clear. Not a workspace member.
-[project]
-name = "potpie-legacy"
-version = "0.2.0"
-description = "Empty stub replacing the removed legacy demo host (dependency-graph hygiene only)."
-requires-python = ">=3.12,<3.15"
-license = "Apache-2.0"
-dependencies = []
-
-[tool.hatch.build.targets.wheel]
-packages = ["_potpie_legacy_stub"]
```

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -103,8 +103,8 @@ override-dependencies = [
     "cryptography>=50.0.0",
     # CVE-2026-59881 / CVE-2026-69243 / CVE-2026-69244: floor at 3.14.3.
     "aiohttp>=3.14.3",
-    # GitPython: Medium + High advisories through 3.1.57 (incl. GHSA-p538-c434-8v24,
-    # GHSA-539m-9xh6-q6rr, GHSA-wvpp-8hx9-p66j). Floor at 3.1.58.
+    # GitPython GHSA-3f7w-8rr8-f37f / GHSA-539m-9xh6-q6rr (<=3.1.56) and
+    # GHSA-wvpp-8hx9-p66j / related Highs (<=3.1.57): floor at 3.1.58.
     "gitpython>=3.1.58",
     # CVE-2026-71554 / GHSA-6hr6-w5qg-qmwg: h2 <=4.4.0; floor at 4.4.1.
     "h2>=4.4.1",
```

---

### Incident Patch 9: `86891420` (2026-08-12)
**Commit Message**: fix(deps): clear stale legacy/uv.lock for POT-2266 Medium vulns (#1048)

Replace the ghost legacy/uv.lock Dependabot still served after #1034
(aiohttp==3.14.1, gitpython==3.1.54, httpx[http2]->h2==4.3.0) with an
empty lock and bump potpie-legacy to 0.2.0. Add h2>=4.4.1 floors.

Linear: POT-2266

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: Shambhavi Shinde <[REDACTED_EMAIL]>

**File**: `legacy/README.md` (modified, +7/-5)
```diff
@@ -3,12 +3,14 @@
 This directory is **not** the former Potpie demo host.
 
 After `legacy/` was removed in #1034, GitHub’s dependency graph kept a stale
-`potpie-legacy@0.1.0` snapshot that still resolved vulnerable pins
-(`aiohttp==3.14.1`, `gitpython==3.1.54`). That ghost snapshot kept Medium
-Dependabot / Vanta findings open (POT-2236).
+`potpie-legacy@0.1.0` / `legacy/uv.lock` snapshot that still resolved
+vulnerable pins (`aiohttp==3.14.1`, `gitpython==3.1.54`, and
+`httpx[http2]` → `h2==4.3.0`). That ghost snapshot kept Medium Dependabot /
+Vanta findings open (POT-2236, POT-2266).
 
-This empty PEP 621 manifest at the same path replaces that snapshot with zero
-dependencies. It is intentionally **not** a uv workspace member.
+This empty PEP 621 manifest plus empty `uv.lock` at the same path (version
+`0.2.0`) replaces that snapshot with zero dependencies. It is intentionally
+**not** a uv workspace member.
 
 Once Dependabot shows `deps=0` for this path (or the alerts auto-close), a
 follow-up may delete this stub entirely.
```

**File**: `legacy/pyproject.toml` (modified, +7/-6)
```diff
@@ -2,14 +2,15 @@
 requires = ["hatchling>=1.27"]
 build-backend = "hatchling.build"
 
-# Dependency-graph hygiene stub (POT-2236).
-# GitHub's SBOM still listed a deleted potpie-legacy@0.1.0 snapshot with
-# aiohttp==3.14.1 and gitpython==3.1.54 after legacy/ was removed (#1034).
-# Re-publishing an empty manifest at this path replaces that stale snapshot
-# so Dependabot/Vanta Medium findings can clear. Not a workspace member.
+# Dependency-graph hygiene stub (POT-2236 / POT-2266).
+# GitHub's SBOM kept a deleted potpie-legacy@0.1.0 + legacy/uv.lock snapshot
+# with aiohttp==3.14.1, gitpython==3.1.54, and httpx[http2] -> h2==4.3.0 after
+# legacy/ was removed (#1034). Re-publishing an empty manifest + empty uv.lock
+# at this path (version bump to 0.2.0) replaces that stale snapshot so
+# Dependabot/Vanta Medium findings can clear. Not a workspace member.
 [project]
 name = "potpie-legacy"
-version = "0.1.0"
+version = "0.2.0"
 description = "Empty stub replacing the removed legacy demo host (dependency-graph hygiene only)."
 requires-python = ">=3.12,<3.15"
 license = "Apache-2.0"
```

**File**: `legacy/uv.lock` (added, +8/-0)
```diff
@@ -0,0 +1,8 @@
+version = 1
+revision = 3
+requires-python = ">=3.12, <3.15"
+
+[[package]]
+name = "potpie-legacy"
+version = "0.2.0"
+source = { editable = "." }
```

**File**: `potpie/context-engine/pyproject.toml` (modified, +1/-0)
```diff
@@ -137,6 +137,7 @@ constraint-dependencies = [
     "aiohttp>=3.14.3",
     "cryptography>=50.0.0",
     "gitpython>=3.1.58",
+    "h2>=4.4.1",
     "idna>=3.15",
     "pyjwt>=2.13.0",
     "pydantic-ai-slim>=1.102.0",
```

**File**: `potpie/context-engine/uv.lock` (modified, +1/-0)
```diff
@@ -15,6 +15,7 @@ constraints = [
     { name = "aiohttp", specifier = ">=3.14.3" },
     { name = "cryptography", specifier = ">=50.0.0" },
     { name = "gitpython", specifier = ">=3.1.58" },
+    { name = "h2", specifier = ">=4.4.1" },
     { name = "idna", specifier = ">=3.15" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
```

**File**: `potpie/sandbox/pyproject.toml` (modified, +1/-0)
```diff
@@ -42,6 +42,7 @@ constraint-dependencies = [
     "aiohttp>=3.14.3",
     "cryptography>=50.0.0",
     "gitpython>=3.1.58",
+    "h2>=4.4.1",
     "idna>=3.15",
     "pyjwt>=2.13.0",
     "pydantic-ai-slim>=1.102.0",
```

**File**: `potpie/sandbox/uv.lock` (modified, +1/-0)
```diff
@@ -7,6 +7,7 @@ constraints = [
     { name = "aiohttp", specifier = ">=3.14.3" },
     { name = "cryptography", specifier = ">=50.0.0" },
     { name = "gitpython", specifier = ">=3.1.58" },
+    { name = "h2", specifier = ">=4.4.1" },
     { name = "idna", specifier = ">=3.15" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
```

**File**: `pyproject.toml` (modified, +2/-0)
```diff
@@ -106,6 +106,8 @@ override-dependencies = [
     # GitPython: Medium + High advisories through 3.1.57 (incl. GHSA-p538-c434-8v24,
     # GHSA-539m-9xh6-q6rr, GHSA-wvpp-8hx9-p66j). Floor at 3.1.58.
     "gitpython>=3.1.58",
+    # CVE-2026-71554 / GHSA-6hr6-w5qg-qmwg: h2 <=4.4.0; floor at 4.4.1.
+    "h2>=4.4.1",
     "starlette>=1.3.1",
     "pyjwt>=2.13.0",
     "pydantic-settings>=2.14.2",
```

---

### Incident Patch 10: `20b0497d` (2026-08-11)
**Commit Message**: fix(deps): clear stale potpie-legacy SBOM for POT-2236 Medium vulns (#1046)

Replace the deleted legacy/ manifest with an empty potpie-legacy stub so
GitHub's dependency graph drops ghost aiohttp==3.14.1 and gitpython==3.1.54
pins that keep Dependabot/Vanta Medium findings open. Raise GitPython floors
to >=3.1.58. postcss remains at >=8.5.23 / lock 8.5.26.

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: Shambhavi Shinde <[REDACTED_EMAIL]>
Co-authored-by: Yash Krishan <[REDACTED_EMAIL]>

**File**: `legacy/README.md` (added, +14/-0)
```diff
@@ -0,0 +1,14 @@
+# potpie-legacy (dependency-graph stub)
+
+This directory is **not** the former Potpie demo host.
+
+After `legacy/` was removed in #1034, GitHub’s dependency graph kept a stale
+`potpie-legacy@0.1.0` snapshot that still resolved vulnerable pins
+(`aiohttp==3.14.1`, `gitpython==3.1.54`). That ghost snapshot kept Medium
+Dependabot / Vanta findings open (POT-2236).
+
+This empty PEP 621 manifest at the same path replaces that snapshot with zero
+dependencies. It is intentionally **not** a uv workspace member.
+
+Once Dependabot shows `deps=0` for this path (or the alerts auto-close), a
+follow-up may delete this stub entirely.
```

**File**: `legacy/_potpie_legacy_stub/__init__.py` (added, +1/-0)
```diff
@@ -0,0 +1 @@
+"""Empty package so hatch can build the potpie-legacy hygiene stub wheel."""
```

**File**: `legacy/pyproject.toml` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+[build-system]
+requires = ["hatchling>=1.27"]
+build-backend = "hatchling.build"
+
+# Dependency-graph hygiene stub (POT-2236).
+# GitHub's SBOM still listed a deleted potpie-legacy@0.1.0 snapshot with
+# aiohttp==3.14.1 and gitpython==3.1.54 after legacy/ was removed (#1034).
+# Re-publishing an empty manifest at this path replaces that stale snapshot
+# so Dependabot/Vanta Medium findings can clear. Not a workspace member.
+[project]
+name = "potpie-legacy"
+version = "0.1.0"
+description = "Empty stub replacing the removed legacy demo host (dependency-graph hygiene only)."
+requires-python = ">=3.12,<3.15"
+license = "Apache-2.0"
+dependencies = []
+
+[tool.hatch.build.targets.wheel]
+packages = ["_potpie_legacy_stub"]
```

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -103,8 +103,8 @@ override-dependencies = [
     "cryptography>=50.0.0",
     # CVE-2026-59881 / CVE-2026-69243 / CVE-2026-69244: floor at 3.14.3.
     "aiohttp>=3.14.3",
-    # GitPython GHSA-3f7w-8rr8-f37f / GHSA-539m-9xh6-q6rr (<=3.1.56) and
-    # GHSA-wvpp-8hx9-p66j / related Highs (<=3.1.57): floor at 3.1.58.
+    # GitPython: Medium + High advisories through 3.1.57 (incl. GHSA-p538-c434-8v24,
+    # GHSA-539m-9xh6-q6rr, GHSA-wvpp-8hx9-p66j). Floor at 3.1.58.
     "gitpython>=3.1.58",
     "starlette>=1.3.1",
     "pyjwt>=2.13.0",
```

---

### Incident Patch 11: `69ee8ddb` (2026-08-11)
**Commit Message**: [Vanta] Fix High vulnerabilities in potpie-ai/potpie (POT-2233) (#1045)

* fix(deps): tighten GitPython floor to >=3.1.58 for POT-2233

Confirm High Vanta remediations for potpie-ai/potpie:
- cryptography>=50.0.0 (CVE-2026-69247) already on main via #1042
- aiohttp>=3.14.3 (CVE-2026-69244) already on main via #1042
- Raise gitpython constraint floor 3.1.57 -> 3.1.58 for GHSA-3f7w-8rr8-f37f
  / GHSA-539m-9xh6-q6rr (<=3.1.56) and newer High GHSAs patched in 3.1.58

Linear: POT-2233

Co-authored-by: Shambhavi Shinde <[REDACTED_EMAIL]>

* ci: retrigger regression tests after grpcio download timeout

potpie-context-core (3.12) failed installing grpcio==1.81.0 from PyPI
(operation timed out). Unrelated to dependency floor changes; empty
commit to re-run Regression tests. No merge conflicts with main.

Co-authored-by: Shambhavi Shinde <[REDACTED_EMAIL]>

* ci: raise UV_HTTP_TIMEOUT to reduce PyPI wheel install flakes

Regression jobs were failing intermittently during uv sync when downloading
large transitive wheels (grpcio, nvidia-cusparse/torch). Increase the uv
HTTP timeout to 300s for the Regression tests workflow.

Co-authored-by: Shambhavi Shinde <[REDACTED_EMAIL]>

* ci: raise prem

**File**: `.github/workflows/test.yml` (modified, +8/-1)
```diff
@@ -6,6 +6,11 @@ on:
   push:
     branches: [main, master]
 
+# Large transitive wheels (e.g. nvidia-*/torch via context-engine[all]) can
+# exceed uv's default HTTP timeout on GitHub-hosted runners.
+env:
+  UV_HTTP_TIMEOUT: "300"
+
 jobs:
   pre-commit:
     runs-on: ubuntu-latest
@@ -206,7 +211,9 @@ jobs:
   premerge-cli-journey:
     if: github.event_name == 'pull_request'
     runs-on: ubuntu-latest
-    timeout-minutes: 5
+    # Journey subprocess budgets sum to ~670s, plus checkout/toolchain/uv sync
+    # and workflow UV_HTTP_TIMEOUT=300 on large wheel fetches.
+    timeout-minutes: 15
 
     steps:
       - name: Checkout
```

**File**: `potpie/context-engine/pyproject.toml` (modified, +1/-1)
```diff
@@ -136,7 +136,7 @@ dev = [
 constraint-dependencies = [
     "aiohttp>=3.14.3",
     "cryptography>=50.0.0",
-    "gitpython>=3.1.57",
+    "gitpython>=3.1.58",
     "idna>=3.15",
     "pyjwt>=2.13.0",
     "pydantic-ai-slim>=1.102.0",
```

**File**: `potpie/context-engine/uv.lock` (modified, +1/-1)
```diff
@@ -14,7 +14,7 @@ resolution-markers = [
 constraints = [
     { name = "aiohttp", specifier = ">=3.14.3" },
     { name = "cryptography", specifier = ">=50.0.0" },
-    { name = "gitpython", specifier = ">=3.1.57" },
+    { name = "gitpython", specifier = ">=3.1.58" },
     { name = "idna", specifier = ">=3.15" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
```

**File**: `potpie/sandbox/pyproject.toml` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ asyncio_mode = "auto"
 constraint-dependencies = [
     "aiohttp>=3.14.3",
     "cryptography>=50.0.0",
-    "gitpython>=3.1.57",
+    "gitpython>=3.1.58",
     "idna>=3.15",
     "pyjwt>=2.13.0",
     "pydantic-ai-slim>=1.102.0",
```

**File**: `potpie/sandbox/uv.lock` (modified, +1/-1)
```diff
@@ -6,7 +6,7 @@ requires-python = ">=3.12, <3.15"
 constraints = [
     { name = "aiohttp", specifier = ">=3.14.3" },
     { name = "cryptography", specifier = ">=50.0.0" },
-    { name = "gitpython", specifier = ">=3.1.57" },
+    { name = "gitpython", specifier = ">=3.1.58" },
     { name = "idna", specifier = ">=3.15" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
```

**File**: `pyproject.toml` (modified, +3/-2)
```diff
@@ -103,8 +103,9 @@ override-dependencies = [
     "cryptography>=50.0.0",
     # CVE-2026-59881 / CVE-2026-69243 / CVE-2026-69244: floor at 3.14.3.
     "aiohttp>=3.14.3",
-    # GitPython GHSA-3f7w-8rr8-f37f / GHSA-539m-9xh6-q6rr: floor at 3.1.57.
-    "gitpython>=3.1.57",
+    # GitPython GHSA-3f7w-8rr8-f37f / GHSA-539m-9xh6-q6rr (<=3.1.56) and
+    # GHSA-wvpp-8hx9-p66j / related Highs (<=3.1.57): floor at 3.1.58.
+    "gitpython>=3.1.58",
     "starlette>=1.3.1",
     "pyjwt>=2.13.0",
     "pydantic-settings>=2.14.2",
```

**File**: `uv.lock` (modified, +1/-1)
```diff
@@ -19,7 +19,7 @@ members = [
 overrides = [
     { name = "aiohttp", specifier = ">=3.14.3" },
     { name = "cryptography", specifier = ">=50.0.0" },
-    { name = "gitpython", specifier = ">=3.1.57" },
+    { name = "gitpython", specifier = ">=3.1.58" },
     { name = "idna", specifier = ">=3.15" },
     { name = "openai", specifier = ">=2.7.1" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
```

---

### Incident Patch 12: `26048a98` (2026-08-10)
**Commit Message**: fix(deps): bump postcss to >=8.5.23 for CVE-2026-69153 (POT-2223) (#1043)

Raise the Vite frontend lock to postcss 8.5.26 and add an npm override
so transitive installs cannot regress to <=8.5.22.

aiohttp (>=3.14.3) and GitPython (removed with legacy) are already
addressed on main; this closes the remaining Medium Dependabot finding.

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: Shambhavi Shinde <[REDACTED_EMAIL]>

**File**: `potpie/daemon/http/ui/frontend/package-lock.json` (modified, +7/-42)
```diff
@@ -839,9 +839,6 @@
         "arm"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -856,9 +853,6 @@
         "arm"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -873,9 +867,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -890,9 +881,6 @@
         "arm64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -907,9 +895,6 @@
         "loong64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -924,9 +909,6 @@
         "loong64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -941,9 +923,6 @@
         "ppc64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -958,9 +937,6 @@
         "ppc64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -975,9 +951,6 @@
         "riscv64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -992,9 +965,6 @@
         "riscv64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1009,9 +979,6 @@
         "s390x"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1026,9 +993,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "glibc"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1043,9 +1007,6 @@
         "x64"
       ],
       "dev": true,
-      "libc": [
-        "musl"
-      ],
       "license": "MIT",
       "optional": true,
       "os": [
@@ -1727,7 +1688,9 @@
       "license": "MIT"
     },
     "node_modules/nanoid": {
-      "version": "3.3.16",
+      "version": "3.3.17",
+      "resolved": "https://registry.npmjs.org/nanoid/-/nanoid-3.3.17.tgz",
+      "integrity": "sha512-xQLf0A3HOMlgHq0n247/LRuAOYmB7dXJ/DvAxGvsSBij45XtBSmQycu+F8ODbHwns/XyFZagyL1+J0Offw1E0g==",
       "dev": true,
       "funding": [
         {
@@ -1775,7 +1738,9 @@
       }
     },
     "node_modules/postcss": {
-      "version": "8.5.19",
+      "version": "8.5.26",
+      "resolved": "https://registry.npmjs.org/postcss/-/postcss-8.5.26.tgz",
+      "integrity": "sha512-u82N74LFzG8ca+dD8puPnplTXoGH4fTPpVGuIbt36G3qvNlkvfD0lEAZSxaly3KX8TS/L1A1gsCEmvKmBcVbkQ==",
       "dev": true,
       "funding": [
         {
@@ -1793,7 +1758,7 @@
       ],
       "license": "MIT",
       "dependencies": {
-        "nanoid": "^3.3.12",
+        "nanoid": "^3.3.17",
         "picocolors": "^1.1.1",
         "source-map-js": "^1.2.1"
       },
```

**File**: `potpie/daemon/http/ui/frontend/package.json` (modified, +3/-0)
```diff
@@ -20,5 +20,8 @@
     "@vitejs/plugin-react": "^4.3.4",
     "typescript": "^5.6.3",
     "vite": "^6.4.3"
+  },
+  "overrides": {
+    "postcss": ">=8.5.23"
   }
 }
```

---

### Incident Patch 13: `9726a0fb` (2026-08-10)
**Commit Message**: fix(deps): bump cryptography to 50.0.0 for CVE-2026-69247 (#1042)

Raise cryptography floors to >=50.0.0 across root and nested package
metadata/locks, keep aiohttp >=3.14.3, and add GitPython >=3.1.57
constraints so Dependabot/Vanta High findings for POT-2221 clear.

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: Shambhavi Shinde <[REDACTED_EMAIL]>

**File**: `potpie/context-engine/pyproject.toml` (modified, +2/-1)
```diff
@@ -135,7 +135,8 @@ dev = [
 [tool.uv]
 constraint-dependencies = [
     "aiohttp>=3.14.3",
-    "cryptography>=48.0.1",
+    "cryptography>=50.0.0",
+    "gitpython>=3.1.57",
     "idna>=3.15",
     "pyjwt>=2.13.0",
     "pydantic-ai-slim>=1.102.0",
```

**File**: `potpie/context-engine/uv.lock` (modified, +39/-43)
```diff
@@ -13,7 +13,8 @@ resolution-markers = [
 [manifest]
 constraints = [
     { name = "aiohttp", specifier = ">=3.14.3" },
-    { name = "cryptography", specifier = ">=48.0.1" },
+    { name = "cryptography", specifier = ">=50.0.0" },
+    { name = "gitpython", specifier = ">=3.1.57" },
     { name = "idna", specifier = ">=3.15" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
@@ -462,54 +463,49 @@ wheels = [
 
 [[package]]
 name = "cryptography"
-version = "49.0.0"
+version = "50.0.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "cffi", marker = "platform_python_implementation != 'PyPy'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/1f/99/d1c90d6041656cc6ee229dc99cd67fd0cd5aec3c5f7d72fffc27cc750054/cryptography-49.0.0.tar.gz", hash = "sha256:f89660a348f4f78a92366240a61404e337586ef7f5909a2fef59ca88ef505493", size = 854345, upload-time = "2026-06-12T20:02:30.512Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/9b/22/adf66990e63584a68dfb50c24f48a125c07b1699899381c8151e63ed458c/cryptography-49.0.0-cp311-abi3-macosx_11_0_arm64.whl", hash = "sha256:966fe0e9c67490071f14c0d2b1cb2dfb3023c5ce39457343931415f08382f2db", size = 4032100, upload-time = "2026-06-12T20:02:32.143Z" },
-    { url = "https://files.pythonhosted.org/packages/09/41/3797cfaf69cae04a13ee78ebd83f0678d9c02b4779d21ce24445326f1a69/cryptography-49.0.0-cp311-abi3-manylinux2014_aarch64.manylinux_2_17_aarch64.whl", hash = "sha256:36d1709f992593689b45bda411498d62c6e365f2ca00b84657d4dadd24de16db", size = 4692978, upload-time = "2026-06-12T20:01:21.305Z" },
-    { url = "https://files.pythonhosted.org/packages/e6/8b/43011f7ebe515a8aa20d61f290a326cd890c2e738e16e59eaff8d9c3a412/cryptography-49.0.0-cp311-abi3-manylinux2014_x86_64.manylinux_2_17_x86_64.whl", hash = "sha256:0e959b578856a3924bc0cbb710fc12c387b9412a951389f3ca61704a9e25f325", size = 4716422, upload-time = "2026-06-12T20:01:48.566Z" },
-    { url = "https://files.pythonhosted.org/packages/4a/91/01ce7303a4579e6d3a6abef01bd322848e9ea7a219adcabc5048b9033571/cryptography-49.0.0-cp311-abi3-manylinux_2_28_aarch64.whl", hash = "sha256:53ecee2e23f7169b6117e99fc8a944e5e50f79e69758a83b52a00cb98ab2b2d2", size = 4700503, upload-time = "2026-06-12T20:02:47.091Z" },
-    { url = "https://files.pythonhosted.org/packages/62/99/a2c95cf8293f07491e9e27c20cc4dcd18176d944e674679adeb1d0173fd6/cryptography-49.0.0-cp311-abi3-manylinux_2_28_ppc64le.whl", hash = "sha256:2eda353d8a27bcbcaa4cbed18994a74ab4d19a2ca897db188ea269ab9b71419b", size = 5309779, upload-time = "2026-06-12T20:02:08.987Z" },
-    { url = "https://files.pythonhosted.org/packages/20/2c/0622f20ff02b2ef32558733443805dc82fd4c275be01b2d19d14676f3a1b/cryptography-49.0.0-cp311-abi3-manylinux_2_28_x86_64.whl", hash = "sha256:2afe9051da7ae7bd5905da5a949280c7d2bb75682e188f650a9d0f2756b834c6", size = 4749683, upload-time = "2026-06-12T20:02:03.335Z" },
-    { url = "https://files.pythonhosted.org/packages/a3/5b/c5246635d5fd3b64e0d45ae10e99fd32fe9676a79915ccfe5a61ba9af1a5/cryptography-49.0.0-cp311-abi3-manylinux_2_31_armv7l.whl", hash = "sha256:0b82e28ee398a386f0807bba7884d30f25218855690f45115831bcce5d90822c", size = 4337874, upload-time = "2026-06-12T20:02:54.323Z" },
-    { url = "https://files.pythonhosted.org/packages/6d/88/05563c7fe2e914e87d1a536d06fe83e66b4e1d95cb593e05aea375531da8/cryptography-49.0.0-cp311-abi3-manylinux_2_34_aarch64.whl", hash = "sha256:ccac2bfebc306b862133e3bb71f3f6ee8bb525240089b2d952e4144b3a6d5da7", size = 4700283, upload-time = "2026-06-12T20:01:34.822Z" },
-    { url = "https://files.pythonhosted.org/packages/c4/b6/d7696e4e890d6ae1469935164c9e5215c557671cb78d6e3f458ccceaa632/cryptography-49.0.0-cp311-abi3-manylinux_2_34_ppc64le.whl", hash = "sha256:d0527ce944105f257f605a827d6ebead966c752038b6e8656abb9c5edee6fc68", size = 5265844, upload-time = "2026-06-12T20:01:24.09Z" },
-    { url = "https://files.pythonhosted.org/packages/a9/3c/f3ad17eecc1a57b0ba236dc01f90e783c51f4a2f35f64777cc4f47a184b2/cryptography-49.0.0-cp311-abi3-manylinux_2_34_x86_64.whl", hash = "sha256:cbc77da8c523d5abd028635ba850a6966fcee2c82e2bf65a41d1d8afe0f98be9", size = 4749290, upload-time = "2026-06-12T20:01:30.848Z" },
-    { url = "https://files.pythonhosted.org/packages/4f/01/339573cf1023163a400b0b5d16f6d507de413b9f60be6fd1b77feeaf6737/cryptography-49.0.0-cp311-abi3-musllinux_1_2_aarch64.whl", hash = "sha256:b87e65d263b3e5d3bb92a57e2a6638e2f31110fa7aa890c7b2dbba42248d0a3f", size = 4834612, upload-time = "2026-06-12T20:01:29.246Z" },
-    { url = "https://files.pythonhosted.org/packages/71/fd/577302e213a1be9468f92d1afef66fcf1ef83d516819d9992ca547f592bd/cryptography-49.0.0-cp311-abi3-musllinux_1_2_x86_64.whl", hash = "sha256:66ec79c3904820572d7e987abdf304281f141d37ad9a489b8e97066e7b9b6459", size = 4980804, upload-time = "2026-06-12T20:01:42.853Z" },
-    { url = "https://files.pythonhosted.org/packages/1f/09/f42b1d190c5ba7
```

**File**: `potpie/sandbox/pyproject.toml` (modified, +2/-1)
```diff
@@ -40,7 +40,8 @@ asyncio_mode = "auto"
 [tool.uv]
 constraint-dependencies = [
     "aiohttp>=3.14.3",
-    "cryptography>=48.0.1",
+    "cryptography>=50.0.0",
+    "gitpython>=3.1.57",
     "idna>=3.15",
     "pyjwt>=2.13.0",
     "pydantic-ai-slim>=1.102.0",
```

**File**: `potpie/sandbox/uv.lock` (modified, +2/-1)
```diff
@@ -5,7 +5,8 @@ requires-python = ">=3.12, <3.15"
 [manifest]
 constraints = [
     { name = "aiohttp", specifier = ">=3.14.3" },
-    { name = "cryptography", specifier = ">=48.0.1" },
+    { name = "cryptography", specifier = ">=50.0.0" },
+    { name = "gitpython", specifier = ">=3.1.57" },
     { name = "idna", specifier = ">=3.15" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
     { name = "pydantic-settings", specifier = ">=2.14.2" },
```

**File**: `pyproject.toml` (modified, +4/-1)
```diff
@@ -99,9 +99,12 @@ override-dependencies = [
     "python-dotenv>=1.2.2",
     "openai>=2.7.1",
     "idna>=3.15",
-    "cryptography>=48.0.1",
+    # CVE-2026-69247: floor at 50.0.0 (vulnerable: >=44.0.0, <50.0.0).
+    "cryptography>=50.0.0",
     # CVE-2026-59881 / CVE-2026-69243 / CVE-2026-69244: floor at 3.14.3.
     "aiohttp>=3.14.3",
+    # GitPython GHSA-3f7w-8rr8-f37f / GHSA-539m-9xh6-q6rr: floor at 3.1.57.
+    "gitpython>=3.1.57",
     "starlette>=1.3.1",
     "pyjwt>=2.13.0",
     "pydantic-settings>=2.14.2",
```

**File**: `uv.lock` (modified, +55/-54)
```diff
@@ -18,7 +18,8 @@ members = [
 ]
 overrides = [
     { name = "aiohttp", specifier = ">=3.14.3" },
-    { name = "cryptography", specifier = ">=48.0.1" },
+    { name = "cryptography", specifier = ">=50.0.0" },
+    { name = "gitpython", specifier = ">=3.1.57" },
     { name = "idna", specifier = ">=3.15" },
     { name = "openai", specifier = ">=2.7.1" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
@@ -588,46 +589,46 @@ wheels = [
 
 [[package]]
 name = "cryptography"
-version = "49.0.0"
+version = "50.0.0"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "cffi", marker = "platform_python_implementation != 'PyPy'" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/1f/99/d1c90d6041656cc6ee229dc99cd67fd0cd5aec3c5f7d72fffc27cc750054/cryptography-49.0.0.tar.gz", hash = "sha256:f89660a348f4f78a92366240a61404e337586ef7f5909a2fef59ca88ef505493", size = 854345, upload-time = "2026-06-12T20:02:30.512Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/09/41/3797cfaf69cae04a13ee78ebd83f0678d9c02b4779d21ce24445326f1a69/cryptography-49.0.0-cp311-abi3-manylinux2014_aarch64.manylinux_2_17_aarch64.whl", hash = "sha256:36d1709f992593689b45bda411498d62c6e365f2ca00b84657d4dadd24de16db", size = 4692978, upload-time = "2026-06-12T20:01:21.305Z" },
-    { url = "https://files.pythonhosted.org/packages/e6/8b/43011f7ebe515a8aa20d61f290a326cd890c2e738e16e59eaff8d9c3a412/cryptography-49.0.0-cp311-abi3-manylinux2014_x86_64.manylinux_2_17_x86_64.whl", hash = "sha256:0e959b578856a3924bc0cbb710fc12c387b9412a951389f3ca61704a9e25f325", size = 4716422, upload-time = "2026-06-12T20:01:48.566Z" },
-    { url = "https://files.pythonhosted.org/packages/4a/91/01ce7303a4579e6d3a6abef01bd322848e9ea7a219adcabc5048b9033571/cryptography-49.0.0-cp311-abi3-manylinux_2_28_aarch64.whl", hash = "sha256:53ecee2e23f7169b6117e99fc8a944e5e50f79e69758a83b52a00cb98ab2b2d2", size = 4700503, upload-time = "2026-06-12T20:02:47.091Z" },
-    { url = "https://files.pythonhosted.org/packages/62/99/a2c95cf8293f07491e9e27c20cc4dcd18176d944e674679adeb1d0173fd6/cryptography-49.0.0-cp311-abi3-manylinux_2_28_ppc64le.whl", hash = "sha256:2eda353d8a27bcbcaa4cbed18994a74ab4d19a2ca897db188ea269ab9b71419b", size = 5309779, upload-time = "2026-06-12T20:02:08.987Z" },
-    { url = "https://files.pythonhosted.org/packages/20/2c/0622f20ff02b2ef32558733443805dc82fd4c275be01b2d19d14676f3a1b/cryptography-49.0.0-cp311-abi3-manylinux_2_28_x86_64.whl", hash = "sha256:2afe9051da7ae7bd5905da5a949280c7d2bb75682e188f650a9d0f2756b834c6", size = 4749683, upload-time = "2026-06-12T20:02:03.335Z" },
-    { url = "https://files.pythonhosted.org/packages/a3/5b/c5246635d5fd3b64e0d45ae10e99fd32fe9676a79915ccfe5a61ba9af1a5/cryptography-49.0.0-cp311-abi3-manylinux_2_31_armv7l.whl", hash = "sha256:0b82e28ee398a386f0807bba7884d30f25218855690f45115831bcce5d90822c", size = 4337874, upload-time = "2026-06-12T20:02:54.323Z" },
-    { url = "https://files.pythonhosted.org/packages/6d/88/05563c7fe2e914e87d1a536d06fe83e66b4e1d95cb593e05aea375531da8/cryptography-49.0.0-cp311-abi3-manylinux_2_34_aarch64.whl", hash = "sha256:ccac2bfebc306b862133e3bb71f3f6ee8bb525240089b2d952e4144b3a6d5da7", size = 4700283, upload-time = "2026-06-12T20:01:34.822Z" },
-    { url = "https://files.pythonhosted.org/packages/c4/b6/d7696e4e890d6ae1469935164c9e5215c557671cb78d6e3f458ccceaa632/cryptography-49.0.0-cp311-abi3-manylinux_2_34_ppc64le.whl", hash = "sha256:d0527ce944105f257f605a827d6ebead966c752038b6e8656abb9c5edee6fc68", size = 5265844, upload-time = "2026-06-12T20:01:24.09Z" },
-    { url = "https://files.pythonhosted.org/packages/a9/3c/f3ad17eecc1a57b0ba236dc01f90e783c51f4a2f35f64777cc4f47a184b2/cryptography-49.0.0-cp311-abi3-manylinux_2_34_x86_64.whl", hash = "sha256:cbc77da8c523d5abd028635ba850a6966fcee2c82e2bf65a41d1d8afe0f98be9", size = 4749290, upload-time = "2026-06-12T20:01:30.848Z" },
-    { url = "https://files.pythonhosted.org/packages/4f/01/339573cf1023163a400b0b5d16f6d507de413b9f60be6fd1b77feeaf6737/cryptography-49.0.0-cp311-abi3-musllinux_1_2_aarch64.whl", hash = "sha256:b87e65d263b3e5d3bb92a57e2a6638e2f31110fa7aa890c7b2dbba42248d0a3f", size = 4834612, upload-time = "2026-06-12T20:01:29.246Z" },
-    { url = "https://files.pythonhosted.org/packages/71/fd/577302e213a1be9468f92d1afef66fcf1ef83d516819d9992ca547f592bd/cryptography-49.0.0-cp311-abi3-musllinux_1_2_x86_64.whl", hash = "sha256:66ec79c3904820572d7e987abdf304281f141d37ad9a489b8e97066e7b9b6459", size = 4980804, upload-time = "2026-06-12T20:01:42.853Z" },
-    { url = "https://files.pythonhosted.org/packages/86/12/c48a424f38db03027be9f7ed5c7dc5de9933dbee992865f98b13727a009d/cryptography-49.0.0-cp314-cp314t-manylinux2014_aarch64.manylinux_2_17_aarch64.whl", hash = "sha256:196ecd6a36e4e9aa10270393bb98d8df88fccee0bf1e5128b91ae4eb4375896d", size = 4678835, upload-time = "2026-06-12T20:02:48.743Z" },
-    { url = "https://files.pythonhosted.org/packages/68/28/8a3ad4653662c93fc44
```

---

### Incident Patch 14: `240dc724` (2026-08-05)
**Commit Message**: fix: refresh nested locks for aiohttp CVE-2026-59881/69243 (#1040)

PR #1039 raised aiohttp floors to >=3.14.2 in pyproject.toml and the
root uv.lock, but potpie/context-engine/uv.lock and potpie/sandbox/uv.lock
still pinned aiohttp 3.14.1. GitHub Dependabot scans those nested locks,
so Medium Vanta findings remained open.

Bump nested lock constraints to >=3.14.2 and resolve aiohttp to 3.14.3.

POT-2180

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: Shambhavi Shinde <[REDACTED_EMAIL]>



---

### Incident Patch 15: `867b89cf` (2026-08-05)
**Commit Message**: fix: bump aiohttp to >=3.14.3 for CVE-2026-69244 (#1038)

Raise aiohttp floors and regenerate uv.lock so Dependabot/Vanta
High findings for pip-aiohttp <= 3.14.2 are remediated (POT-2134).

Co-authored-by: Cursor Agent <[REDACTED_EMAIL]>
Co-authored-by: Shambhavi Shinde <[REDACTED_EMAIL]>

**File**: `potpie/context-engine/pyproject.toml` (modified, +2/-2)
```diff
@@ -70,7 +70,7 @@ reconciliation-agent = [
 hatchet = [
     "hatchet-sdk>=1.29.0",
     # CVE floor for the Hatchet SDK's transitive dependency (see #1015).
-    "aiohttp>=3.14.2",
+    "aiohttp>=3.14.3",
 ]
 observability = [
     "opentelemetry-sdk>=1.27.0",
@@ -134,7 +134,7 @@ dev = [
 
 [tool.uv]
 constraint-dependencies = [
-    "aiohttp>=3.14.2",
+    "aiohttp>=3.14.3",
     "cryptography>=48.0.1",
     "idna>=3.15",
     "pyjwt>=2.13.0",
```

**File**: `potpie/context-engine/uv.lock` (modified, +88/-88)
```diff
@@ -12,7 +12,7 @@ resolution-markers = [
 
 [manifest]
 constraints = [
-    { name = "aiohttp", specifier = ">=3.14.1" },
+    { name = "aiohttp", specifier = ">=3.14.3" },
     { name = "cryptography", specifier = ">=48.0.1" },
     { name = "idna", specifier = ">=3.15" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
@@ -35,7 +35,7 @@ wheels = [
 
 [[package]]
 name = "aiohttp"
-version = "3.14.1"
+version = "3.14.3"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "aiohappyeyeballs" },
@@ -47,90 +47,90 @@ dependencies = [
     { name = "typing-extensions", marker = "python_full_version < '3.13'" },
     { name = "yarl" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/82/78/8ea7308cac6934de8c74a14f3d5f65d1c89287426688be79538d0e5c013d/aiohttp-3.14.1.tar.gz", hash = "sha256:307f2cff90a764d329e77040603fa032db89c5c24fdad50c4c15334cba744035", size = 7955794, upload-time = "2026-06-07T21:09:35.529Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/1d/21/151624b51cd92553d95424daf4bf19f19ce9be9002d19253e7e7ce67197b/aiohttp-3.14.1-cp312-cp312-macosx_10_13_universal2.whl", hash = "sha256:d35143e27778b4bb0fb189562d7f275bff79c62ab8e98459717c0ea617ff2480", size = 757402, upload-time = "2026-06-07T21:06:40.311Z" },
-    { url = "https://files.pythonhosted.org/packages/c2/82/280619e0bd7bf2454987e19282616e84762255dd9c8468f62382e8c191f1/aiohttp-3.14.1-cp312-cp312-macosx_10_13_x86_64.whl", hash = "sha256:bcfb80a2cc36fba2534e5e5b5264dc7ae6fcd9bf15256da3e53d2f499e6fa29d", size = 512310, upload-time = "2026-06-07T21:06:42.207Z" },
-    { url = "https://files.pythonhosted.org/packages/55/b2/2aac325583aaa1353045f96dffa586d8a34e8322e14a7ba49cffeb103ab4/aiohttp-3.14.1-cp312-cp312-macosx_11_0_arm64.whl", hash = "sha256:27fd7c91e51729b4f7e1577865fa6d34c9adccbc39aabe9000285b48af9f0ec2", size = 512448, upload-time = "2026-06-07T21:06:43.813Z" },
-    { url = "https://files.pythonhosted.org/packages/8a/72/a60607cb849faa8af8a356c9329ea2eb6f395d49e82cc82ccba1fd8deb8f/aiohttp-3.14.1-cp312-cp312-manylinux2014_aarch64.manylinux_2_17_aarch64.manylinux_2_28_aarch64.whl", hash = "sha256:64c567bf9eaf664280116a8688f63016e6b32db2505908e2bdaca1b6438142f2", size = 1766854, upload-time = "2026-06-07T21:06:45.391Z" },
-    { url = "https://files.pythonhosted.org/packages/b5/d3/d9fe1c9ec7557ab4d0d82bebaa728c6418f0b93295ec2f4ab015f7710cc7/aiohttp-3.14.1-cp312-cp312-manylinux2014_armv7l.manylinux_2_17_armv7l.manylinux_2_31_armv7l.whl", hash = "sha256:f5e6ff2bdbb8f4cd3fbe41f99e25bbcd58e3bf9f13d3dd31a11e7917251cc77a", size = 1740884, upload-time = "2026-06-07T21:06:47.413Z" },
-    { url = "https://files.pythonhosted.org/packages/c1/dc/f2cecfaf9337ba3e63f181500814ff502aa3d00d9c7ec93a9d23d10a27b2/aiohttp-3.14.1-cp312-cp312-manylinux2014_ppc64le.manylinux_2_17_ppc64le.manylinux_2_28_ppc64le.whl", hash = "sha256:2f73e01dc37122325caf079982621262f96d74823c179038a82fddfc50359264", size = 1810034, upload-time = "2026-06-07T21:06:50.165Z" },
-    { url = "https://files.pythonhosted.org/packages/66/d7/2ff65c5e65c0d7476daf7e15c032e0805e36811185b9623e3238ad6c763e/aiohttp-3.14.1-cp312-cp312-manylinux2014_s390x.manylinux_2_17_s390x.manylinux_2_28_s390x.whl", hash = "sha256:bb2c0c80d431c0d03f2c7dbf125150fedd4f0de17366a7ca33f7ccb822391842", size = 1904054, upload-time = "2026-06-07T21:06:52.035Z" },
-    { url = "https://files.pythonhosted.org/packages/20/9c/d445818389df371f56d141d881153ba23183c4735a03f7356ffb43f7757d/aiohttp-3.14.1-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl", hash = "sha256:3e6fc1a85fa7194a1a7d19f44e8609180f4a8eb5fa4c7ed8b4355f080fad235c", size = 1790278, upload-time = "2026-06-07T21:06:54.049Z" },
-    { url = "https://files.pythonhosted.org/packages/4d/aa/bf04cb4d865fc6101c2229a294ad744973b72e513fdc5a6b791e6983d72a/aiohttp-3.14.1-cp312-cp312-manylinux_2_31_riscv64.manylinux_2_39_riscv64.whl", hash = "sha256:686b6c0d3911ec387b444ddf5dc62fb7f7c0a7d5186a7861626496a5ab4aff95", size = 1591795, upload-time = "2026-06-07T21:06:55.911Z" },
-    { url = "https://files.pythonhosted.org/packages/dc/b4/4dac0038960427ba832f6609dfb4ea5437d7fd80c72001b9e48f834f428b/aiohttp-3.14.1-cp312-cp312-musllinux_1_2_aarch64.whl", hash = "sha256:c6fa4dc7ad6f8109c70bb1499e589f76b0b792baf39f9b017eb92c8a81d0a199", size = 1728397, upload-time = "2026-06-07T21:06:57.777Z" },
-    { url = "https://files.pythonhosted.org/packages/2b/f9/7cd4e8ad7aa3b75f17d56bb5498dd604a93d4e6eece822ba0568c413fff0/aiohttp-3.14.1-cp312-cp312-musllinux_1_2_armv7l.whl", hash = "sha256:87a5eea1b2a5e21e1ebdbb33ad4165359189327e63fc4e4894693e7f821ac817", size = 1766504, upload-time = "2026-06-07T21:07:00.009Z" },
-    { url = "https://files.pythonhosted.org/packages/f9/df/fc01d9fcad0f73fed3f3d361f1f94f975947b50dff82919f6dc2bf4316cc/aiohttp-3.14.1-cp312-cp312-musllinux_1_2_ppc64le.whl", hash = "sha256:1c1421eb01d4fd608d88cc8290211d177a58532b55ad94076fb349c5bf467f0a", size = 1777806, upload
```

**File**: `potpie/sandbox/pyproject.toml` (modified, +2/-2)
```diff
@@ -10,7 +10,7 @@ requires-python = ">=3.12,<3.15"
 dependencies = []
 
 [project.optional-dependencies]
-daytona = ["daytona>=0.134.0", "aiohttp>=3.14.2"]
+daytona = ["daytona>=0.134.0", "aiohttp>=3.14.3"]
 dev = ["pytest>=9.0.3", "pytest-asyncio>=0.24.0", "ruff>=0.8.0"]
 
 [project.scripts]
@@ -39,7 +39,7 @@ asyncio_mode = "auto"
 
 [tool.uv]
 constraint-dependencies = [
-    "aiohttp>=3.14.2",
+    "aiohttp>=3.14.3",
     "cryptography>=48.0.1",
     "idna>=3.15",
     "pyjwt>=2.13.0",
```

**File**: `potpie/sandbox/uv.lock` (modified, +87/-87)
```diff
@@ -4,7 +4,7 @@ requires-python = ">=3.12, <3.15"
 
 [manifest]
 constraints = [
-    { name = "aiohttp", specifier = ">=3.14.1" },
+    { name = "aiohttp", specifier = ">=3.14.3" },
     { name = "cryptography", specifier = ">=48.0.1" },
     { name = "idna", specifier = ">=3.15" },
     { name = "pydantic-ai-slim", specifier = ">=1.102.0" },
@@ -36,7 +36,7 @@ wheels = [
 
 [[package]]
 name = "aiohttp"
-version = "3.14.1"
+version = "3.14.3"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "aiohappyeyeballs" },
@@ -48,90 +48,90 @@ dependencies = [
     { name = "typing-extensions", marker = "python_full_version < '3.13'" },
     { name = "yarl" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/82/78/8ea7308cac6934de8c74a14f3d5f65d1c89287426688be79538d0e5c013d/aiohttp-3.14.1.tar.gz", hash = "sha256:307f2cff90a764d329e77040603fa032db89c5c24fdad50c4c15334cba744035", size = 7955794, upload-time = "2026-06-07T21:09:35.529Z" }
-wheels = [
-    { url = "https://files.pythonhosted.org/packages/1d/21/151624b51cd92553d95424daf4bf19f19ce9be9002d19253e7e7ce67197b/aiohttp-3.14.1-cp312-cp312-macosx_10_13_universal2.whl", hash = "sha256:d35143e27778b4bb0fb189562d7f275bff79c62ab8e98459717c0ea617ff2480", size = 757402, upload-time = "2026-06-07T21:06:40.311Z" },
-    { url = "https://files.pythonhosted.org/packages/c2/82/280619e0bd7bf2454987e19282616e84762255dd9c8468f62382e8c191f1/aiohttp-3.14.1-cp312-cp312-macosx_10_13_x86_64.whl", hash = "sha256:bcfb80a2cc36fba2534e5e5b5264dc7ae6fcd9bf15256da3e53d2f499e6fa29d", size = 512310, upload-time = "2026-06-07T21:06:42.207Z" },
-    { url = "https://files.pythonhosted.org/packages/55/b2/2aac325583aaa1353045f96dffa586d8a34e8322e14a7ba49cffeb103ab4/aiohttp-3.14.1-cp312-cp312-macosx_11_0_arm64.whl", hash = "sha256:27fd7c91e51729b4f7e1577865fa6d34c9adccbc39aabe9000285b48af9f0ec2", size = 512448, upload-time = "2026-06-07T21:06:43.813Z" },
-    { url = "https://files.pythonhosted.org/packages/8a/72/a60607cb849faa8af8a356c9329ea2eb6f395d49e82cc82ccba1fd8deb8f/aiohttp-3.14.1-cp312-cp312-manylinux2014_aarch64.manylinux_2_17_aarch64.manylinux_2_28_aarch64.whl", hash = "sha256:64c567bf9eaf664280116a8688f63016e6b32db2505908e2bdaca1b6438142f2", size = 1766854, upload-time = "2026-06-07T21:06:45.391Z" },
-    { url = "https://files.pythonhosted.org/packages/b5/d3/d9fe1c9ec7557ab4d0d82bebaa728c6418f0b93295ec2f4ab015f7710cc7/aiohttp-3.14.1-cp312-cp312-manylinux2014_armv7l.manylinux_2_17_armv7l.manylinux_2_31_armv7l.whl", hash = "sha256:f5e6ff2bdbb8f4cd3fbe41f99e25bbcd58e3bf9f13d3dd31a11e7917251cc77a", size = 1740884, upload-time = "2026-06-07T21:06:47.413Z" },
-    { url = "https://files.pythonhosted.org/packages/c1/dc/f2cecfaf9337ba3e63f181500814ff502aa3d00d9c7ec93a9d23d10a27b2/aiohttp-3.14.1-cp312-cp312-manylinux2014_ppc64le.manylinux_2_17_ppc64le.manylinux_2_28_ppc64le.whl", hash = "sha256:2f73e01dc37122325caf079982621262f96d74823c179038a82fddfc50359264", size = 1810034, upload-time = "2026-06-07T21:06:50.165Z" },
-    { url = "https://files.pythonhosted.org/packages/66/d7/2ff65c5e65c0d7476daf7e15c032e0805e36811185b9623e3238ad6c763e/aiohttp-3.14.1-cp312-cp312-manylinux2014_s390x.manylinux_2_17_s390x.manylinux_2_28_s390x.whl", hash = "sha256:bb2c0c80d431c0d03f2c7dbf125150fedd4f0de17366a7ca33f7ccb822391842", size = 1904054, upload-time = "2026-06-07T21:06:52.035Z" },
-    { url = "https://files.pythonhosted.org/packages/20/9c/d445818389df371f56d141d881153ba23183c4735a03f7356ffb43f7757d/aiohttp-3.14.1-cp312-cp312-manylinux2014_x86_64.manylinux_2_17_x86_64.manylinux_2_28_x86_64.whl", hash = "sha256:3e6fc1a85fa7194a1a7d19f44e8609180f4a8eb5fa4c7ed8b4355f080fad235c", size = 1790278, upload-time = "2026-06-07T21:06:54.049Z" },
-    { url = "https://files.pythonhosted.org/packages/4d/aa/bf04cb4d865fc6101c2229a294ad744973b72e513fdc5a6b791e6983d72a/aiohttp-3.14.1-cp312-cp312-manylinux_2_31_riscv64.manylinux_2_39_riscv64.whl", hash = "sha256:686b6c0d3911ec387b444ddf5dc62fb7f7c0a7d5186a7861626496a5ab4aff95", size = 1591795, upload-time = "2026-06-07T21:06:55.911Z" },
-    { url = "https://files.pythonhosted.org/packages/dc/b4/4dac0038960427ba832f6609dfb4ea5437d7fd80c72001b9e48f834f428b/aiohttp-3.14.1-cp312-cp312-musllinux_1_2_aarch64.whl", hash = "sha256:c6fa4dc7ad6f8109c70bb1499e589f76b0b792baf39f9b017eb92c8a81d0a199", size = 1728397, upload-time = "2026-06-07T21:06:57.777Z" },
-    { url = "https://files.pythonhosted.org/packages/2b/f9/7cd4e8ad7aa3b75f17d56bb5498dd604a93d4e6eece822ba0568c413fff0/aiohttp-3.14.1-cp312-cp312-musllinux_1_2_armv7l.whl", hash = "sha256:87a5eea1b2a5e21e1ebdbb33ad4165359189327e63fc4e4894693e7f821ac817", size = 1766504, upload-time = "2026-06-07T21:07:00.009Z" },
-    { url = "https://files.pythonhosted.org/packages/f9/df/fc01d9fcad0f73fed3f3d361f1f94f975947b50dff82919f6dc2bf4316cc/aiohttp-3.14.1-cp312-cp312-musllinux_1_2_ppc64le.whl", hash = "sha256:1c1421eb01d4fd608d88cc8290211d177a58532b55ad94076fb349c5bf467f0a", size = 177780
```

**File**: `pyproject.toml` (modified, +3/-3)
```diff
@@ -26,7 +26,7 @@ classifiers = [
     "Topic :: Software Development",
 ]
 dependencies = [
-    "aiohttp>=3.14.2",
+    "aiohttp>=3.14.3",
     "click>=8.1.8",
     "fastapi>=0.115.0",
     "httpx>=0.28.0",
@@ -100,8 +100,8 @@ override-dependencies = [
     "openai>=2.7.1",
     "idna>=3.15",
     "cryptography>=48.0.1",
-    # CVE-2026-59881 / CVE-2026-69243: aiohttp <= 3.14.1; 3.14.2 is the first patched release.
-    "aiohttp>=3.14.2",
+    # CVE-2026-59881 / CVE-2026-69243 / CVE-2026-69244: floor at 3.14.3.
+    "aiohttp>=3.14.3",
     "starlette>=1.3.1",
     "pyjwt>=2.13.0",
     "pydantic-settings>=2.14.2",
```

**File**: `uv.lock` (modified, +21/-21)
```diff
@@ -17,7 +17,7 @@ members = [
     "potpie-sandbox",
 ]
 overrides = [
-    { name = "aiohttp", specifier = ">=3.14.2" },
+    { name = "aiohttp", specifier = ">=3.14.3" },
     { name = "cryptography", specifier = ">=48.0.1" },
     { name = "idna", specifier = ">=3.15" },
     { name = "openai", specifier = ">=2.7.1" },
@@ -666,43 +666,43 @@ wheels = [
 
 [package.optional-dependencies]
 cublas = [
-    { name = "nvidia-cublas", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
-    { name = "nvidia-cuda-nvrtc", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-cublas", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux') or (platform_machine == 'AMD64' and sys_platform == 'win32')" },
+    { name = "nvidia-cuda-nvrtc", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux') or (platform_machine == 'AMD64' and sys_platform == 'win32')" },
 ]
 cudart = [
-    { name = "nvidia-cuda-runtime", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-cuda-runtime", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux') or (platform_machine == 'AMD64' and sys_platform == 'win32')" },
 ]
 cufft = [
-    { name = "nvidia-cufft", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
-    { name = "nvidia-nvjitlink", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-cufft", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux') or (platform_machine == 'AMD64' and sys_platform == 'win32')" },
+    { name = "nvidia-nvjitlink", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux') or (platform_machine == 'AMD64' and sys_platform == 'win32')" },
 ]
 cufile = [
-    { name = "nvidia-cufile", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-cufile", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux')" },
 ]
 cupti = [
-    { name = "nvidia-cuda-cupti", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-cuda-cupti", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux') or (platform_machine == 'AMD64' and sys_platform == 'win32')" },
 ]
 curand = [
-    { name = "nvidia-curand", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-curand", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux') or (platform_machine == 'AMD64' and sys_platform == 'win32')" },
 ]
 cusolver = [
-    { name = "nvidia-cublas", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
-    { name = "nvidia-cusolver", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
-    { name = "nvidia-cusparse", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
-    { name = "nvidia-nvjitlink", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-cublas", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux') or (platform_machine == 'AMD64' and sys_platform == 'win32')" },
+    { name = "nvidia-cusolver", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux') or (platform_machine == 'AMD64' and sys_platform == 'win32')" },
+    { name = "nvidia-cusparse", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux') or (platform_machine == 'AMD64' and sys_platform == 'win32')" },
+    { name = "nvidia-nvjitlink", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux') or (platform_machine == 'AMD64' and sys_platform == 'win32')" },
 ]
 cusparse = [
-    { name = "nvidia-cusparse", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
-    { name = "nvidia-nvjitlink", marker = "platform_machine == 'aarch64' or platform_machine == 'x86_64'" },
+    { name = "nvidia-cusparse", marker = "(platform_machine == 'aarch64' and sys_platform == 'linux') or (platform_machine == 'x86_64' and sys_platform == 'linux') or (platform_machine == 'AMD64' and sys_platform == 'win32')" },
+    { name = "nvidia-nvjitlink", m
```

#### Recent Merged Pull Requests:
- **PR #1080** (2026-09-28): fix(deps): bump anyio to 4.14.2 for CVE-2026-63374 (POT-2597) (@shmbhvi101)
- **PR #1079** (2026-09-23): fix(deps): bump soupsieve to 2.9.2 for CVE-2026-85999/86000 (POT-2569) (@shmbhvi101)
- **PR #1075** (2026-09-09): [Vanta] Remediate high and medium vulnerabilities (@shmbhvi101)
- **PR #1074** (2026-09-15): Instrument graph explorer load and tag CLI usage by product surface (@BrhKmr23)
- **PR #1073** (2026-09-15): feat(cli): emit canonical activation-command and useful-context telemetry (@BrhKmr23)
- **PR #1072** (2026-09-07): fix(deps): remediate xmldom vulnerability (POT-2475) (@shmbhvi101)
- **PR #1071** (2026-09-15): feat(cli): emit canonical per-agent skills-install telemetry  (@BrhKmr23)
- **PR #1069** (2026-08-31): Fix PyPI Core Metadata 2.5 publishing (@Dsantra92)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

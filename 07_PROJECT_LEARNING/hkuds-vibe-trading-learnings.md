# Forensic Learning Record (Deep Inspection): HKUDS/Vibe-Trading

> **Canonical Artifact**: `07_PROJECT_LEARNING/hkuds-vibe-trading-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/HKUDS/Vibe-Trading](https://github.com/HKUDS/Vibe-Trading))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T20:00:35.792Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `HKUDS/Vibe-Trading`
- **Description**: "Vibe-Trading: Your Personal Trading Agent"
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 34384 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent/api_server.py`
```
#!/usr/bin/env python3
"""Vibe-Trading API Server - RESTful API for finance research and backtesting.

Thin assembler: creates the FastAPI app, mounts middleware, registers route
modules, and re-exports symbols for test compatibility.  All shared
infrastructure lives in ``src.api.{security,models,helpers,state}``.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, HTTPException, Request, status  # noqa: F401
from fastapi.responses import FileResponse  # noqa: F401
from fastapi.middleware.cors import CORSMiddleware
from rich.console import Console

from cli._version import __version__ as APP_VERSION
from src.ui_services import build_run_analysis, load_run_context  # noqa: F401

# UTF-8 on Windows
import sys as _sys
for _s in ("stdout", "stderr"):
    _r = getattr(getattr(_sys, _s, None), "reconfigure", None)
    if callable(_r):
        _r(encoding="utf-8", errors="replace")

# ---------------------------------------------------------------------------
# Extracted infrastructure — re-exported for route-module and test access
# ---------------------------------------------------------------------------

from src.api.security import (  # noqa: F401, E402
    _API_KEY,
    _CORS_ORIGINS,
    _DEFAULT_CORS_ORIGINS,
    _DEFAULT_LOOPBACK_HOSTS,
    _EXTRA_LOOPBACK_HOSTS,
    _SAFE_BROWSER_METHODS,
    _apply_security_headers,
    _auth_credential_from_header_or_query,
    _configured_api_key,
    _consume_sse_ticket,
    _default_gateway_ips,
    _env_shell_tools_enabled,
    _host_without_port,
    _is_allowed_loopback_host,
    _is_local_client,
    _is_loopback_bind_host,
    _is_loopback_origin,
    _mint_sse_ticket,
    _origin_matches_request_host,
    _parse_cors_origins,
    _parse_extra_cors_origins,
    _parse_extra_loopback_hosts,
    _redact_query_secrets,
    _reject_cross_site_browser_request,
    _reject_untrusted_loopback_host,
    _require_shutdown_authorization,
    _security,
    _shell_tools_enabled_for_request,
    _trusted_docker_loopback_ip,
    _validate_api_auth,
    install_access_log_redaction_filter,
    require_auth,
    require_event_stream_auth,
    require_local_or_auth,
    require_settings_write_auth,
)

from src.api.models import (  # noqa: F401, E402
    Artifact,
    BacktestMetrics,
    RAGSelection,
    RunInfo,
    RunResponse,
)

from src.api.helpers import (  # noqa: F401, E402
    AGENT_DIR,
    ENV_EXAMPLE_PATH,
    ENV_PATH,
    LEGACY_ENV_PATH,
    RUNS_DIR,
    SESSIONS_DIR,
    UPLOADS_DIR,
    _coerce_float,
    _coerce_int,
    _ensure_agent_env_file,
    _format_env_value,
    _FRONTEND_DIST,
    _is_configured_secret,
    _is_spa_html_route,
    _project_relative_path,
    _read_env_values,
    _SAFE_PATH_PARAM_RE,
    _spa_html_deep_link_fallback,
    _strip_env_value,
    _validate_path_param,
    _write_env_values,
)

from src.api.state import (  # noqa: F401, E402
    _channel_bus,
    _channel_manager,
    _channel_runtime,
    _get_channel_runtime,
    _get_session_service,
    _session_service,
)

console = Console()
logger = logging.getLogger(__name__)

from src.api.channels_routes import (  # noqa: E402
    _start_channel_runtime,
    _stop_channel_runtime,
)
from src.api.scheduled_routes import (  # noqa: E402
    _start_scheduled_research_executor,
    _stop_scheduled_research_executor,
)


async def _run_startup_preflight() -> None:
    """Run preflight checks on server startup."""
    from src.preflight import run_preflight

    from src.config import migrate as _migrate

    try:
        _migrate.migrate_legacy_state()  # one-time pre-#904 state move; must never block startup
    except Exception:  # pragma: no cover — best-effort
        logging.getLogger(__name__).warning("Legacy state migration failed", exc_info=True)
    run_preflight(console)
    _start_scheduled_research_executor()
    from src.config.accessor import get_env_config

    if get_env_config().agent_tuning.vibe_trading_channels_auto_start:
        await _start_channel_runtime()


async def _stop_scheduled_research_on_shutdown() -> None:
    """Stop the scheduled research executor on server shutdown."""
    try:
        await _stop_channel_runtime()
    finally:
        await _stop_scheduled_research_executor()


@asynccontextmanager
async def _lifespan(_: FastAPI) -> AsyncIterator[None]:
    """Run API startup and guaranteed reverse-order shutdown."""
    try:
        await _run_startup_preflight()
        yield
    finally:
        await _stop_scheduled_research_on_shutdown()


app = FastAPI(
    title="Vibe-Trading API",
    description="Vibe-Trading API: natural-language finance research, backtesting, and swarm workflows",
    version=APP_VERSION,
    docs_url=None,  # docs/redoc/openapi re-registered behind require_auth
    redoc_url=None,  # in register_system_routes -- see the rationale there
    openapi_url=None,
    lifespan=_lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.middleware("http")(_reject_untrusted_loopback_host)
app.middleware("http")(_spa_html_deep_link_fallback)
app.middleware("http")(_apply_security_headers)


# Route registration + re-exports

# --- Runs ---
from src.api.runs_routes import register_runs_routes  # noqa: E402
register_runs_routes(app)

from src.api.runs_routes import (  # noqa: F401, E402
    _load_json_file,
    _load_csv_to_dict,
    _build_response_from_run_dir,
)
from src.api.attribution_routes import register_attribution_routes  # noqa: E402
register_attribution_routes(app)

# --- Sessions ---
from src.api.sessions_routes import register_sessions_routes  # noqa: E402
register_sessions_routes(app)

from src.api.sessions_routes import (  # noqa: F401, E402
    _goal_store,
    _live_action_frame_from_tool_result,
    _mandate_proposal_frame_from_tool_result,
)

# --- System ---
from src.api.system_routes import register_system_routes  # noqa: E402
register_system_routes(app)

from src.api.system_routes import _terminate_current_process  # noqa: F401, E402

# --- Settings ---
from src.api.settings_routes import register_settings_routes  # noqa: E402
register_settings_routes(app)

from src.api.settings_routes import (  # noqa: F401, E402
    _baostock_supported,
    _baostock_installed,
    _load_llm_providers,
)

# --- Uploads ---
from src.api.uploads_routes import register_uploads_routes  # noqa: E402
register_uploads_routes(app)

from src.api.uploads_routes import (  # noqa: F401, E402
    MAX_UPLOAD_SIZE,
    _BLOCKED_UPLOAD_EXT,
    _BLOCKED_UPLOAD_NAMES,
    _SHADOW_ID_RE,
    _UPLOAD_CHUNK_SIZE,
)

# --- Channels ---
from src.api.channels_routes import register_channels_routes  # noqa: E402
register_channels_routes(app)
from src.api.channels_config_routes import register_channels_config_routes  # noqa: E402
register_channels_config_routes(app)
from src.api.qveris_routes import qveris_router  # noqa: E402  # QVERIS-INTEGRATION
app.include_router(qveris_router)  # QVERIS-INTEGRATION

from src.api.channels_routes import (  # noqa: F401, E402
    ChannelPairingCommandRequest,
)

# --- Swarm ---
from src.api.swarm_routes import register_swarm_routes  # noqa: E402
register_swarm_routes(app)

from src.api.swarm_routes import _get_swarm_runtime  # noqa: F401, E402

# --- Live trading ---
from src.api.live_routes import register_live_routes  # noqa: E402
register_live_routes(app)

# --- Read-only portfolio dashboard ---
from src.api.portfolio_routes import register_portfolio_routes  # noqa: E402
register_portfolio_routes(app)

from src.api.connection_routes import register_connection_routes  # noqa: E402
register_connection_routes(app)

from src.api.live_routes import (  # noqa: F401, E402
    CommitMandateRequest,
    LiveHaltRequest,
    LiveAuthorizeRequest,
    LiveRunnerControlRequest,
    BrokerAuthState,
    MandateLimits,

```

### Core Architecture Module: `agent/cli/__init__.py`
```
"""Vibe-Trading CLI package.

The legacy single-file CLI has been preserved verbatim as
``cli/_legacy.py`` and is the source of truth for non-interactive
subcommands (``serve``, ``run``, ``mcp``, ``sessions``, ``swarm`` ...).
The front door (:mod:`cli.main`) shows the banner, runs the
onboarding wizard when needed, then drives the interactive loop
built on :mod:`cli.input`, :mod:`cli.completer`, and
:mod:`cli.commands.*`. Non-interactive entries still pass through to
``_legacy.main``.

The console-script entry in ``pyproject.toml``
(``vibe-trading = "cli:main"``) points at the ``main`` callable exported
here.

Compatibility note: tests and downstream callers historically reached
into ``cli._INIT_ENV_PATH`` / ``cli.cmd_memory_list`` / ``cli.Confirm``
etc. To preserve that surface we re-export every public name from
``_legacy`` at package import time. New code should import the same
helpers from ``cli._legacy`` directly.
"""

from __future__ import annotations

from cli import _legacy as _legacy
from cli.main import main

# Re-export the legacy module's public surface (anything not prefixed
# with two underscores). This lets ``cli.cmd_memory_list`` /
# ``cli._INIT_ENV_PATH`` / ``cli.Prompt`` etc. keep working without us
# having to enumerate every name by hand.
for _name in dir(_legacy):
    if _name.startswith("__"):
        continue
    globals().setdefault(_name, getattr(_legacy, _name))
del _name


# Symbols tests may monkeypatch on the ``cli`` package that legacy
# callables still read from their own module globals. Keep this list
# explicit so accidental package-level attributes don't bleed into
# ``_legacy``.
_LEGACY_SYNCED_GLOBALS: tuple[str, ...] = (
    "_INIT_ENV_PATH",
    "AGENT_DIR",
    "RUNS_DIR",
    "SWARM_DIR",
    "SESSIONS_DIR",
    "UPLOADS_DIR",
    "_PROVIDER_CHOICES",
)


def _sync_legacy_test_overrides() -> None:
    """Mirror package-level monkeypatches onto ``_legacy``'s module globals.

    Tests reach into ``cli.<NAME>`` to override constants, but legacy
    callables read ``<NAME>`` from their own module namespace. This hook
    copies any patched value back to ``_legacy`` for the allowlist below.
    """
    pkg_globals = globals()
    for name in _LEGACY_SYNCED_GLOBALS:
        if name not in pkg_globals:
            continue
        new_value = pkg_globals[name]
        if getattr(_legacy, name, None) is not new_value:
            setattr(_legacy, name, new_value)


def cmd_init() -> int:
    """Compatibility wrapper for callers patching ``cli._INIT_ENV_PATH``."""
    _sync_legacy_test_overrides()
    return _legacy.cmd_init()


# Wrap every ``cmd_*`` callable re-exported from ``_legacy`` so a package-level
# monkeypatch of any symbol in ``_LEGACY_SYNCED_GLOBALS`` is propagated to
# ``_legacy`` before the call. Without this, ``patch.object(cli, "RUNS_DIR",
# tmp); cli.cmd_list()`` would silently read the unpatched ``_legacy.RUNS_DIR``.
import functools as _functools  # noqa: E402

def _make_synced_legacy_wrapper(legacy_fn):  # noqa: ANN001
    """Wrap ``legacy_fn`` so the package-level monkeypatch sync fires first."""

    @_functools.wraps(legacy_fn)
    def _wrapper(*args, **kwargs):
        _sync_legacy_test_overrides()
        # Re-read the (possibly just-synced) attribute from ``_legacy`` in
        # case the test also patched the function itself.
        return getattr(_legacy, legacy_fn.__name__)(*args, **kwargs)

    _wrapper.__wrapped__ = legacy_fn
    return _wrapper


for _cmd_name in [n for n in globals() if n.startswith("cmd_") and n != "cmd_init"]:
    _cmd_obj = globals()[_cmd_name]
    if callable(_cmd_obj) and getattr(_cmd_obj, "__module__", "") == "cli._legacy":
        globals()[_cmd_name] = _make_synced_legacy_wrapper(_cmd_obj)
del _cmd_name, _cmd_obj


__all__ = ["main", *sorted(
    name for name in globals()
    if not name.startswith("_") and name != "main"
)]

```

### Core Architecture Module: `agent/cli/__main__.py`
```
"""Allow ``python -m cli`` to run the CLI entrypoint."""

from cli.main import _entrypoint

_entrypoint()

```

### Core Architecture Module: `agent/cli/_legacy.py`
```
#!/usr/bin/env python3
"""Vibe-Trading CLI for natural-language finance research and backtesting.

Usage:
    vibe-trading                           Interactive mode (default)
    vibe-trading -p "Backtest AAPL MACD"   Single run
    vibe-trading serve --port 8899         Start API server
    vibe-trading chat                      Interactive mode
    vibe-trading list                      List runs
    vibe-trading show <run_id>             Show run details
"""

from __future__ import annotations

# ruff: noqa: E402

import argparse
import csv
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Any, Dict, List, Optional

import warnings
warnings.filterwarnings("ignore", message=".*Importing verbose from langchain.*")
warnings.filterwarnings("ignore", category=DeprecationWarning, module="langchain")

for _s in ("stdout", "stderr"):
    _r = getattr(getattr(sys, _s, None), "reconfigure", None)
    if callable(_r):
        _r(encoding="utf-8", errors="replace")

from rich import box
from rich.columns import Columns
from rich.live import Live
from rich.markup import escape as rich_escape
from rich.panel import Panel
from rich.prompt import Confirm, IntPrompt, Prompt
from rich.syntax import Syntax
from rich.table import Table
from rich.text import Text

from cli.theme import get_console
from src.config.accessor import get_env_config, reset_env_config
from src.config.paths import (
    get_runs_dir,
    get_runtime_root,
    get_sessions_dir,
    get_swarm_runs_dir,
    get_uploads_dir,
)

console = get_console()
# AGENT_DIR is a code location (frontend defaults, dev-server cwd). State
# lives under the user-level runtime root, never relative to the code (#904).
AGENT_DIR = Path(__file__).resolve().parents[1]
RUNS_DIR = get_runs_dir()
SWARM_DIR = get_swarm_runs_dir()
SESSIONS_DIR = get_sessions_dir()
UPLOADS_DIR = get_uploads_dir()

EXIT_SUCCESS = 0
EXIT_RUN_FAILED = 1
EXIT_USAGE_ERROR = 2

# Rows printed by `vibe-trading portfolio show` before the combined-holdings table is cut.
_PORTFOLIO_CLI_MAX_HOLDINGS = 25
RICH_TAG_PATTERN = re.compile(r"\[/?[^\]]+\]")
SWARM_RUN_USAGE = """--swarm-run PRESET '{"k":"v"}'"""
SWARM_RUN_VARS_PREVIEW_CHARS = 80

from cli._version import __version__ as _VERSION  # noqa: E402 — single source of truth

if TYPE_CHECKING:
    from src.agent.loop import AgentLoop

# Agent color assignments for swarm display
_AGENT_STYLES = ["cyan", "magenta", "green", "yellow", "blue", "bright_red", "bright_cyan", "bright_magenta"]
_agent_color_map: dict[str, str] = {}


def _truncate_swarm_vars_preview(value: str) -> str:
    """Return a compact preview for a CLI JSON token."""
    if len(value) <= SWARM_RUN_VARS_PREVIEW_CHARS:
        return value
    return value[: SWARM_RUN_VARS_PREVIEW_CHARS - 3] + "..."


def _print_swarm_vars_json_error(vars_json: str, exc: json.JSONDecodeError) -> None:
    """Print actionable JSON diagnostics for ``--swarm-run`` vars."""
    preview = rich_escape(_truncate_swarm_vars_preview(vars_json))
    console.print(
        "[red]Invalid JSON for --swarm-run VARS.[/red]\n"
        f"Offending string: {preview}\n"
        f"JSON parse error: {rich_escape(str(exc))}\n"
        f"Correct usage: {SWARM_RUN_USAGE}\n"
        "shell quoting is the usual culprit; wrap the JSON in single quotes."
    )


def _parse_swarm_run_args(values: list[str]) -> tuple[str, Optional[str]] | None:
    """Validate ``--swarm-run`` values before starting the swarm."""
    if len(values) > 2:
        extras = ", ".join(rich_escape(repr(token)) for token in values[2:])
        console.print(
            "[red]Invalid --swarm-run arguments:[/red] "
            f"unexpected extra token(s): {extras}\n"
            f"Correct usage: {SWARM_RUN_USAGE}"
        )
        return None

    preset = values[0]
    vars_json = values[1] if len(values) > 1 else None
    if vars_json:
        try:
            json.loads(vars_json)
        except json.JSONDecodeError as exc:
            _print_swarm_vars_json_error(vars_json, exc)
            return None
    return preset, vars_json

_HAS_PROMPT_TOOLKIT = False
try:
    from prompt_toolkit import PromptSession
    from prompt_toolkit.formatted_text import FormattedText
    from prompt_toolkit.history import InMemoryHistory

    _HAS_PROMPT_TOOLKIT = True
except ImportError:
    pass


class _SessionStats:
    """Mutable container for interactive session statistics.

    Shared between the status bar renderer and the agent loop so that
    tool callbacks can update counters in-place.
    """

    __slots__ = ("session_start", "last_elapsed", "total_tool_ms", "tool_count")

    def __init__(self, session_start: float) -> None:
        self.session_start = session_start
        self.last_elapsed: Optional[float] = None
        self.total_tool_ms = 0
        self.tool_count = 0


def _build_status_parts(stats: _SessionStats) -> list[str]:
    """Build plain-text status bar segments.

    Args:
        stats: Session statistics.

    Returns:
        List of status text segments.
    """
    _cfg = get_env_config()
    provider = _cfg.llm.langchain_provider
    model = _cfg.llm.langchain_model_name
    model_short = model.split("/")[-1] if "/" in model else model
    label = f"{provider}/{model_short}" if provider else model_short or "unknown"

    session_s = int(time.monotonic() - stats.session_start)
    mins, secs = divmod(session_s, 60)
    session_str = f"{mins}m{secs:02d}s" if mins else f"{secs}s"

    parts = [label, session_str]

    if stats.last_elapsed is not None:
        parts.append(f"last {stats.last_elapsed:.1f}s")

    if stats.tool_count > 0:
        total_s = stats.total_tool_ms / 1000
        parts.append(f"{stats.tool_count} tools ({total_s:.1f}s)")

    return parts


def _ptk_toolbar(stats: _SessionStats) -> FormattedText:
    """prompt_toolkit bottom_toolbar callback — called on every render.

    Args:
        stats: Session statistics.

    Returns:
        FormattedText for the toolbar.
    """
    segments = _build_status_parts(stats)
    text = " │ ".join(segments)
    return FormattedText([("class:bottom-toolbar.text", f" {text} ")])


def _print_status_bar(stats: _SessionStats) -> None:
    """Print a static status bar using Rich (fallback without prompt_toolkit).

    Args:
        stats: Session statistics.
    """
    parts = _build_status_parts(stats)
    bar = "[dim] │ [/dim]".join(
        f"[bold]{parts[0]}[/bold]" if i == 0 else p for i, p in enumerate(parts)
    )
    console.print(bar)


def _create_prompt_session(stats: _SessionStats) -> Any:
    """Create a prompt_toolkit PromptSession with history and live toolbar.

    Args:
        stats: Session statistics for the live bottom toolbar.

    Returns:
        A PromptSession instance, or None if prompt_toolkit is not available.
    """
    if not _HAS_PROMPT_TOOLKIT:
        return None
    return PromptSession(
        history=InMemoryHistory(),
        bottom_toolbar=lambda: _ptk_toolbar(stats),
        refresh_interval=1.0,
    )


def _read_input(prompt_session: Any, prompt_str: str = "> ") -> str:
    """Read user input with arrow key support if prompt_toolkit is available.

    Falls back to Rich Prompt.ask() when prompt_toolkit is not installed or
    when stdin is not a tty.

    Args:
        prompt_session: A prompt_toolkit PromptSession, or None.
        prompt_str: Prompt text to display.

    Returns:
        User input string (not stripped).

    Raises:
        EOFError: When the user presses Ctrl-D.
        KeyboardInterrupt: When the user presses Ctrl-C.
    """
    if prompt_session is not None and sys.stdin.isatty():
        return prompt_session.prompt(prompt_str)
    return Prompt.ask(f"[bold]{prompt_str}[/bold]")


def serve_main(argv: list[str] | None = None) -> int:
    """Delegate server startup to api_server."""
    from 
```

### Core Architecture Module: `agent/cli/_version.py`
```
"""Single source of truth for the CLI version string.

Reads ``vibe-trading-ai``'s installed package metadata when available
(``pip install -e .`` is enough). For an un-installed checkout (e.g. running
straight from a clone with ``PYTHONPATH=agent``) it falls back to reading the
version straight out of ``pyproject.toml`` — so ``pyproject.toml`` is the one
and only place the version is ever written. There is deliberately no hardcoded
version constant to drift out of sync on release (issue #156).
"""

from __future__ import annotations

from typing import Final


def _version_from_pyproject() -> str:
    """Read ``[project] version`` from the repo's ``pyproject.toml``.

    Returns:
        The declared version, or ``"unknown"`` if the file cannot be located
        or parsed (only reachable for an un-installed checkout whose tree has
        been moved away from its ``pyproject.toml``).
    """
    import tomllib
    from pathlib import Path

    # agent/cli/_version.py -> parents[2] is the repo root holding pyproject.toml.
    pyproject = Path(__file__).resolve().parents[2] / "pyproject.toml"
    try:
        return tomllib.loads(pyproject.read_text(encoding="utf-8"))["project"]["version"]
    except (OSError, KeyError, tomllib.TOMLDecodeError):
        return "unknown"


try:
    from importlib.metadata import PackageNotFoundError, version as _pkg_version

    try:
        __version__: Final[str] = _pkg_version("vibe-trading-ai")
    except PackageNotFoundError:
        __version__ = _version_from_pyproject()
except ImportError:  # pragma: no cover — importlib.metadata is stdlib on 3.8+
    __version__ = _version_from_pyproject()


__all__ = ["__version__"]

```

### Core Architecture Module: `agent/cli/commands/__init__.py`
```
"""Slash command implementations.

Each command module exports a ``run(ctx, *args) -> int`` callable. Modules
that own multiple commands (``chat``, ``show``, ``session``) also expose
named ``cmd_<name>`` callables so the slash router can dispatch by
command keyword.

The :data:`SLASH_COMMANDS` registry lives in :mod:`.slash_router`.
"""

from .slash_router import SLASH_COMMANDS, Command, find_exact, match_commands

__all__ = [
    "Command",
    "SLASH_COMMANDS",
    "find_exact",
    "match_commands",
]

```

### Core Architecture Module: `agent/cli/commands/chat.py`
```
"""Chat-flow slash commands: ``/model``, ``/clear``, ``/journal``,
``/shadow``, ``/swarm``, ``/debug``, ``/quit``.

``/model`` renders the current configuration via the legacy
``_show_settings`` helper. ``/swarm`` dispatches to the legacy
``_handle_swarm_command`` so the existing presets keep working. ``/clear``
clears the screen and reprints the banner. ``/journal``, ``/shadow``, and
``/debug`` show a "Coming soon" placeholder pointing at the established
fallback workflows.
"""

from __future__ import annotations

from typing import Any, Optional

from rich.console import Console
from rich.panel import Panel
from rich.text import Text

from cli.theme import get_console


def _resolve_console(console: Optional[Console] = None) -> Console:
    """Return the shared CLI console, or a caller-supplied override."""
    if console is not None:
        return console
    return get_console()


def _coming_soon(command: str, *, hint: str) -> int:
    """Render the placeholder panel for not-yet-wired commands."""
    console = _resolve_console()
    body = Text()
    body.append(f"/{command} is not yet wired up to the interactive CLI.\n\n", style="dim")
    body.append("Until then: ", style="dim")
    body.append(hint, style="bold")
    console.print(Panel(body, title=f"/{command}", border_style="dim", padding=(1, 2)))
    return 0


# --- /model ----------------------------------------------------------------


def cmd_model(ctx: Any = None, *args: str) -> int:  # noqa: ARG001 — ctx unused
    """Print the current provider/model + how to re-run the wizard."""
    console = _resolve_console()
    try:
        from cli._legacy import _show_settings

        _show_settings()
    except Exception as exc:  # noqa: BLE001 — legacy may be absent on partial install
        from src.config.accessor import get_env_config

        cfg = get_env_config()
        provider = cfg.llm.langchain_provider or "(not set)"
        model = cfg.llm.langchain_model_name or "(not set)"
        console.print(Text(f"Provider: {provider}", style="bold"))
        console.print(Text(f"Model:    {model}", style="bold"))
        console.print(Text(f"(legacy _show_settings unavailable: {exc})", style="dim"))

    console.print()
    console.print(
        Text(
            "Run `vibe-trading init` to switch provider, model, or credentials.",
            style="dim",
        )
    )
    return 0


# --- /clear, /journal, /shadow, /swarm, /debug, /quit ----------------------


def cmd_clear(ctx: Any = None, *args: str) -> int:  # noqa: ARG001
    """Clear the screen and reprint the welcome banner."""
    console = _resolve_console()
    try:
        console.clear()
    except Exception:  # noqa: BLE001 — clear can fail on dumb terminals
        pass
    # Best-effort: reprint the banner so the conversation appears fresh.
    # Reuse the cached stats populated at startup so the redrawn banner
    # shows the real skills / tools / sessions counts, not zeros.
    try:
        from cli.intro import print_banner
        from cli.main import _collect_banner_stats

        print_banner(console, **_collect_banner_stats())
    except Exception:  # noqa: BLE001
        console.print(Text("Conversation cleared.", style="dim"))
    # Caller is expected to also drop in-memory conversation history.
    if ctx is not None and hasattr(ctx, "history"):
        try:
            ctx.history.clear()
        except Exception:  # noqa: BLE001
            pass
    return 0


def _queue_prompt(ctx: Any, prompt: str) -> bool:
    """Stash ``prompt`` on ``ctx.pending_prompt`` for the loop to consume.

    Returns ``True`` if the context exposes a writable ``pending_prompt``
    attribute, ``False`` otherwise (e.g. a tiny test stub) — the caller
    falls back to printing the canonical instruction in that case.
    """
    if ctx is None or not hasattr(ctx, "pending_prompt"):
        return False
    try:
        ctx.pending_prompt = prompt
        return True
    except Exception:  # noqa: BLE001 — never crash the slash dispatch
        return False


def cmd_journal(ctx: Any = None, *args: str) -> int:
    """Queue an "analyze my trade journal at <path>" agent turn.

    With a path: ``/journal trades.csv`` becomes the prompt
    ``Analyze my trade journal at trades.csv`` which is queued on
    ``ctx.pending_prompt`` and executed by the interactive loop on the
    next tick. Without a path the command prints the canonical
    instruction so the user can paste it themselves.
    """
    console = _resolve_console()
    path = " ".join(args).strip()
    if not path:
        body = Text()
        body.append("Usage: ", style="dim")
        body.append("/journal <path-to-csv>\n", style="bold")
        body.append("Example: ", style="dim")
        body.append('/journal ~/Downloads/journal.csv\n\n', style="bold")
        body.append("Or type the prompt directly: ", style="dim")
        body.append('"analyze my trade journal at <path>"', style="bold")
        console.print(Panel(body, title="/journal", border_style="dim", padding=(1, 2)))
        return 0

    prompt = f"Analyze my trade journal at {path}"
    if _queue_prompt(ctx, prompt):
        console.print(Text(f"→ Running: {prompt}", style="dim"))
        return 0
    # Fallback when the context does not support queuing (legacy callers).
    console.print(Text(f'Type: "{prompt}"', style="bold"))
    return 0


def cmd_shadow(ctx: Any = None, *args: str) -> int:
    """Queue a Shadow Account agent turn.

    ``/shadow`` opens / inspects the shadow account. ``/shadow <path>``
    trains a new shadow from a trade journal at that path. Both forms
    queue the canonical natural-language prompt on ``ctx.pending_prompt``
    so the ReAct loop picks the right tool (``extract_shadow_strategy``,
    ``run_shadow_backtest``, ``render_shadow_report``).
    """
    console = _resolve_console()
    path = " ".join(args).strip()
    if path:
        prompt = f"Train a shadow account from my trade journal at {path}"
    else:
        prompt = "Open the shadow account dashboard and show the latest report"

    if _queue_prompt(ctx, prompt):
        console.print(Text(f"→ Running: {prompt}", style="dim"))
        return 0
    console.print(Text(f'Type: "{prompt}"', style="bold"))
    return 0


def cmd_swarm(ctx: Any = None, *args: str) -> int:  # noqa: ARG001
    """Dispatch to the legacy swarm handler."""
    try:
        from cli._legacy import _handle_swarm_command

        _handle_swarm_command(" ".join(args))
        return 0
    except Exception as exc:  # noqa: BLE001
        console = _resolve_console()
        console.print(Text(f"/swarm failed: {exc}", style="bold red"))
        return 1


def cmd_debug(ctx: Any = None, *args: str) -> int:  # noqa: ARG001
    """Toggle the debug summary that prints after each agent turn.

    When ON the interactive loop appends a single muted line after every
    turn containing ``iter``, ``tools``, ``elapsed``, and an approximate
    context-size estimate — see ``_print_debug_summary`` in
    :mod:`cli.main`. When OFF the summary is suppressed.
    """
    console = _resolve_console()
    if ctx is not None and hasattr(ctx, "debug"):
        try:
            ctx.debug = not bool(getattr(ctx, "debug", False))
            state = "ON" if ctx.debug else "OFF"
            console.print(Text(f"Debug summary: {state}", style="bold"))
            if ctx.debug:
                console.print(
                    Text(
                        "After each turn a one-line summary will print: "
                        "iterations, tool count, elapsed, approx context tokens.",
                        style="dim",
                    )
                )
            return 0
        except Exception as exc:  # noqa: BLE001
            console.print(Text(f"/debug toggle failed: {exc}", style="bold red"))
            return 1
    return _coming_soon(
        "debug",
        hint="set `VIBE_TRADING_DEBUG=1` and restart for verbose logging.",
    )


def 
```

### Core Architecture Module: `agent/cli/commands/goal.py`
```
"""``/goal`` — manage the current finance research goal from the CLI."""

from __future__ import annotations

import os
from typing import Any

from rich import box
from rich.console import Console
from rich.console import Group
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

from cli.theme import get_console
from src.goal.context import default_goal_criteria

_goal_store = None


def _resolve_console() -> Console:
    """Return the shared CLI console."""
    return get_console()


def _get_goal_store():
    """Return the shared goal store, lazily initialized."""
    global _goal_store
    if _goal_store is None:
        from src.goal import GoalStore

        _goal_store = GoalStore()
    return _goal_store


def _default_criteria() -> list[str]:
    """Return the MVP finance protocol checklist."""
    return default_goal_criteria()


def _criterion_is_covered(criterion: dict, evidence: list[dict]) -> bool:
    """Return whether a criterion has completion status or attached evidence."""
    status = str(criterion.get("status") or "").lower()
    if status not in {"", "pending", "open", "unsatisfied"}:
        return True
    criterion_id = criterion.get("criterion_id")
    return any(item.get("criterion_id") == criterion_id for item in evidence)


def _create_cli_session(ctx: Any, title: str) -> str | None:
    """Create a normal CLI session when /goal is used before the first turn."""
    try:
        from cli._legacy import SESSIONS_DIR
        from src.session.models import Session, SessionStatus
        from src.session.search import get_shared_index
        from src.session.store import SessionStore

        session = Session(
            title=(title[:60] or "Goal research"),
            status=SessionStatus.ACTIVE,
        )
        SessionStore(base_dir=SESSIONS_DIR).create_session(session)
        get_shared_index().index_session(session.session_id, session.title)
        if ctx is not None:
            setattr(ctx, "session_id", session.session_id)
        return session.session_id
    except Exception:  # noqa: BLE001
        return None


def _session_id(ctx: Any, *, title: str = "Goal research", create: bool) -> str | None:
    """Return the active CLI session id, optionally creating one."""
    existing = getattr(ctx, "session_id", None)
    if existing:
        return str(existing)
    from src.config.accessor import get_env_config

    env_session_id = get_env_config().paths.vibe_goal_session_id
    if env_session_id:
        return env_session_id
    if not create:
        return None
    created = _create_cli_session(ctx, title)
    if created:
        return created
    return "cli-default"


def _render_snapshot(snapshot: dict, *, title: str = "/goal") -> None:
    """Render a compact goal card."""
    console = _resolve_console()
    goal = snapshot["goal"]
    criteria = snapshot.get("criteria") or []
    evidence = snapshot.get("evidence") or []
    evidence_count = int(snapshot.get("evidence_count", len(evidence)))
    covered = sum(1 for item in criteria if _criterion_is_covered(item, evidence))
    total = len(criteria)

    meta = Table.grid(padding=(0, 2))
    meta.add_column(style="dim", no_wrap=True)
    meta.add_column(ratio=1)
    meta.add_column(style="dim", no_wrap=True)
    meta.add_column(no_wrap=True)
    meta.add_row("goal", str(goal["objective"]), "status", f"[green]{goal['status']}[/green]")
    meta.add_row("id", str(goal["goal_id"]), "progress", f"[cyan]{covered}/{total}[/cyan]")
    meta.add_row("evidence", str(evidence_count), "protocol", str(goal.get("protocol", "thesis_review")))

    criteria_table = Table(
        box=box.SIMPLE_HEAVY,
        show_lines=False,
        expand=True,
        padding=(0, 1),
    )
    criteria_table.add_column("#", style="dim", no_wrap=True, width=3)
    criteria_table.add_column("Criterion", ratio=1)
    criteria_table.add_column("Status", no_wrap=True)
    criteria_table.add_column("Evidence", no_wrap=True)
    for index, criterion in enumerate(criteria, start=1):
        criterion_id = criterion["criterion_id"]
        criterion_evidence = [item for item in evidence if item.get("criterion_id") == criterion_id]
        is_covered = _criterion_is_covered(criterion, evidence)
        status = "[green]covered[/green]" if is_covered else "[yellow]pending[/yellow]"
        evidence_label = (
            f"{len(criterion_evidence)} item{'s' if len(criterion_evidence) != 1 else ''}"
            if criterion_evidence
            else "[dim]needed[/dim]"
        )
        criteria_table.add_row(
            str(index),
            str(criterion["text"]),
            status,
            evidence_label,
        )
    if not criteria:
        criteria_table.add_row("-", "[dim](none)[/dim]", "[dim]pending[/dim]", "[dim]needed[/dim]")

    next_steps = Text()
    next_steps.append("Next  ", style="dim")
    next_steps.append("/goal status", style="bold")
    if criteria:
        next_steps.append("   ")
        next_steps.append("/goal evidence <#> <note>", style="bold")

    console.print(
        Panel(
            Group(meta, criteria_table, next_steps),
            title=title,
            border_style="cyan",
            padding=(1, 2),
        )
    )


def cmd_status(ctx: Any = None, *args: str) -> int:  # noqa: ARG001
    """Show the current goal snapshot."""
    session_id = _session_id(ctx, create=False)
    if session_id is None:
        _resolve_console().print(Text("No current goal. Use /goal <objective> to start one.", style="dim"))
        return 0
    snapshot = _get_goal_store().get_current_snapshot(session_id)
    if snapshot is None:
        _resolve_console().print(Text("No current goal. Use /goal <objective> to start one.", style="dim"))
        return 0
    _render_snapshot(snapshot)
    return 0


def cmd_start(ctx: Any = None, *args: str) -> int:
    """Start or replace the current research goal."""
    objective = " ".join(args).strip()
    if not objective:
        _resolve_console().print(Text("Usage: /goal <research objective>", style="bold red"))
        return 1

    session_id = _session_id(ctx, title=objective, create=True)
    if session_id is None:
        _resolve_console().print(Text("Could not create or resolve a session for /goal.", style="bold red"))
        return 1
    try:
        goal = _get_goal_store().replace_goal(
            session_id=session_id,
            objective=objective,
            criteria=_default_criteria(),
            source="cli",
            protocol="thesis_review",
        )
    except ValueError as exc:
        _resolve_console().print(Text(f"/goal failed: {exc}", style="bold red"))
        return 1
    snapshot = _get_goal_store().get_goal_snapshot(goal.goal_id)
    if snapshot is None:
        _resolve_console().print(Text("Goal created but could not be reloaded.", style="bold red"))
        return 1
    _render_snapshot(snapshot, title="/goal started")
    return 0


def _resolve_criterion_id(snapshot: dict, token: str) -> str:
    """Resolve a criterion by 1-based index, exact id, or id prefix."""
    criteria = snapshot.get("criteria") or []
    if token.isdigit():
        index = int(token)
        if 1 <= index <= len(criteria):
            return str(criteria[index - 1]["criterion_id"])
        raise ValueError(f"criterion index out of range: {token}")

    matches = [
        item["criterion_id"]
        for item in criteria
        if item["criterion_id"] == token or str(item["criterion_id"]).startswith(token)
    ]
    if len(matches) == 1:
        return str(matches[0])
    if not matches:
        raise ValueError(f"unknown criterion: {token}")
    raise ValueError(f"ambiguous criterion prefix: {token}")


def cmd_evidence(ctx: Any = None, *args: str) -> int:
    """Append a manual evidence note to the current goal."""
    if len(args) < 2:
        _resolve_console().print(Text("Usage: /goal evidence <criterion-index-or-id> <note>", style="bold red"))
        return
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1461** (2026-09-16): **[Bug] portfolio_risk_xray fails on longer daily windows because market data is truncated**
  *Symptoms*: ### Description  portfolio_risk_xray works correctly on shorter daily windows, but fails when the requested history becomes slightly longer than the shared market-data row cap. The tool then returns: no close prices returned for any requested symbol. Expected behavior / What did you expect? The same risk analysis should work for longer windows. portfolio_risk_xray needs consecutive daily returns for volatility, VaR, Expected Shortfall and drawdown, so it should fetch the full untruncated history.  Additional context / Technical details  portfolio_risk_xray calls fetch_market_data(...) without max_rows=0.  Once the shared row cap is crossed, fetch_market_data may return a truncated/sampled payload instead of the direct OHLCV record list expected by _closes_frame().  technical_indicators already avoids this problem by requesting max_rows=0 for calculations that require consecutive bars.  A small fix may be:  raw = self._fetch(     codes=symbols,     start_date=start_date,     end_date=end_date,     source=source,     interval=interval,     max_rows=0, )  A regression test with more than 250 daily bars should cover it.  Small secondary observation: if one requested symbol has no price data, e.g. SPY.US + BOGUS.US, the x-ray aborts with: "weights reference symbols with no price data: ['BOGUS.US']"  This may be intentional fail-closed behavior, so the main issue is the long-window truncation.  ### Steps to Reproduce  Use portfolio_risk_xray with:  symbols: SPY.US QQQ.US AAPL.US MS
  **Post-Mortem & Fix Analysis**:
  > Fixed in #1462 exactly along the lines you scoped: the single fetch site now asks for `max_rows=0`, the same pattern `technical_indicators` uses for consecutive-bar calculations. The regression test drives 300 daily bars through a fetcher that reproduces the cap behavior and asserts all of them reach the report (`aligned_days == 300`), red-checked to fail at 150 without the change.  Your secondary observation is confirmed intentional: an unknown symbol aborting with `weights reference symbols with no price data` is the fail-closed contract for weight bookkeeping, so it stays as is. 

- **Issue #1426** (2026-09-14): **[Bug] Generic numeric tool fields can be misclassified as analysis evidence by metric-name tokens**
  *Symptoms*: ### Description  The analysis grounding layer can currently promote arbitrary numeric fields from successful tool results into analysis evidence based on metric-like tokens in their field names.  This means a numeric field can become authoritative evidence for a financial metric even when the field semantically represents metadata, a count, a diagnostic, or a different measurement.  This is broader than the `return_observations` case reported in #1420.  For example, a successful read-only tool can return a numeric field whose name happens to contain a recognized metric token. `_metric_kind_for_path()` may classify that field into an analysis metric family, and the resulting value can then satisfy `_analysis_value_observed()` for a final-answer claim.  The problem is not that external/custom tools should be prevented from contributing analysis evidence. They are an important extension point. The problem is that successful numeric output and authoritative metric evidence are currently too easy to conflate.  A tool should be able to contribute analysis evidence, but the semantic meaning of that evidence should be explicit or sufficiently constrained rather than inferred from an arbitrary numeric JSON path alone.  ### Why this matters  Financial/research tools naturally return a mixture of:  - actual calculated metrics; - sample sizes and observation counts; - date/window metadata; - diagnostics; - intermediate values; - descriptive statistics; - identifiers and flags.  A success
  **Post-Mortem & Fix Analysis**:
  > Measured this against current `main` and against #1422's head, because #1422 fixes exactly one spelling of the class this issue describes.  Each row ingests one successful tool result and checks a fabricated claim equal to the metadata value. Every row also runs a control claim (77%, a figure that appears nowhere), and a row only counts if the control is rejected — so these are not cases where the gate simply isn't checking.  | tool result leaf | claim | `main` | #1422 | |---|---|---|---| | `factor_analysis` · `return_observations: 81` | 年化收益 81% | accepted | rejected | | `factor_analysis` · `return_obs: 81` | 年化收益 81% | accepted | **accepted** | | `factor_analysis` · `n_returns: 81` | 年化收益 81% | accepted | **accepted** | | `factor_analysis` · `return_window: 20` | 年化收益 20% | accepted | **accepted** | | `quantlib_call` · `result.vol_lookback: 60` | 年化波动率 60% | accepted | **accepted** | | `quantlib_call` · `result.max_drawdown_duration: 45` | 最大回撤 45% | accepted | **accepted** |  The la
  > Mapping the current state after #1420's fix (#1422), since this is the same ingestion path I just rewrote.  What already holds: metadata/count head nouns (`observations`, `counts`) resolve to `None` before the token scan and the text fallback is skipped there, so `return_observations`-family fields can no longer reach evidence through either door. Exact aliases (`return`, `total_return`, `annualized_return`) and compounds whose tokens are all metric-words still classify.  What's genuinely still open, and it is the design point you raise: `_metric_kind_for_path` still infers kind from name alone for everything else, so a field named `sharpe_window_days` or `diagnostic_vol_score` classifies as sharpe/vol even though it is a window size or a diagnostic, and it then grounds claims as authoritative evidence. Closing that family means choosing one of three shapes, and it's a product call rather than a drive-by:  1. Tighten classification to the exact alias set and drop the fuzzy token scan e
  > Thanks — this matches the integration case that led us to file this.  Our current portfolio-risk tool returns one structured payload containing both metadata and real analysis metrics, for example:  - `inputs.return_observations` - `inputs.aligned_days` - `volatility.daily_vol` - `volatility.annualized_vol` - `volatility.downside_deviation_annualized` - `drawdown.max_drawdown` - `tail_risk.var_95` - `tail_risk.expected_shortfall_95` - `diversification.diversification_ratio` - `correlation.avg_pairwise_abs` - `correlation.beta_to_equal_weight`  So the result naturally mixes counts/window metadata with actual financial measurements.  That is why option (2) also looks like the strongest fit from the integration side: let the tool explicitly declare which fields are authoritative metrics, while keeping every other numeric leaf generic/auditable but not eligible to ground analysis claims.  For example, conceptually:  ```json {   "metrics": [     {       "field": "volatility.annualized_vol",

- **Issue #1421** (2026-09-14): **[Bug] Grounding rejects valid multi-metric claims because one metric kind is applied to the whole clause**
  *Symptoms*: ### Description   The grounding validator can reject a final-answer clause containing multiple valid analysis metrics, even when each metric is individually backed by matching evidence.  This reproduces on an unmodified Vibe-Trading v0.1.15 checkout.  The issue appears to be that `_validate_analysis_claims()` resolves a single metric kind for the whole clause through `_metric_kind_for_text(segment)`, then validates every measurement in that clause against that one kind.  For example, given valid evidence for:  - annualized volatility = 0.23 - max drawdown = -0.05  these two claims validate successfully when written separately:  ```text Annualized volatility was 23%. Max drawdown was -5%. ```  But the semantically equivalent combined sentence:  ```text Annualized volatility was 23% and max drawdown was -5%. ```  is rejected.  Observed result:  ```text TEXT = Annualized volatility was 23% and max drawdown was -5%. VALID = False ISSUES = [   {     "code": "analysis_claim_unavailable",     "claim": "Annualized volatility was 23% and max drawdown was -5%.",     "value": "23%",     "kind": "drawdown",     "message": "No supporting analysis evidence (a completed backtest result or observed risk metric) exists for this figure. Mark the analysis as incomplete and omit these figures."   } ] ```  The 23% value is valid volatility evidence, but because the clause is classified as `drawdown`, the validator tries to validate 23% as a drawdown measurement.  This is important in normal agent
  **Post-Mortem & Fix Analysis**:
  > Thanks for filing this — this matches what we observed while integrating the current risk-xray output.  One design concern before introducing a flat `tail_risk` kind:  `VaR 95`, `VaR 99`, `Expected Shortfall 95`, and `Expected Shortfall 99` should probably not all share one interchangeable evidence bucket.  For example, if the evidence contains:  ```text var_95 = 0.021 var_99 = 0.041 expected_shortfall_95 = 0.030 expected_shortfall_99 = 0.058  then a claim such as:  99% VaR was 2.1%  must not be grounded by the real var_95 = 2.1% observation.  Likewise, Expected Shortfall 95 = 3.0% must not ground VaR 95 = 3.0% merely because both belong to the same tail-risk family.  A structured identity such as:  family = tail_risk metric = var | expected_shortfall level = 0.95 | 0.99 horizon = 1d unit = return_fraction  would preserve those distinctions while still grouping the metrics under the same family.  This is relevant to the current risk_xray output, which already emits separate fields:  ta
  > Apologies — this comment was intended for #1425 / PR #1427 and is unrelated to the multi-metric clause issue tracked here.
  > Closed by the grounding rewrite on main: figures are checked one by one instead of under a single metric kind per clause, so "Annualized volatility was 23% and max drawdown was -5%." grounds against 0.23 and -0.05. One known gap remains in the other direction: an undeclared answer that swaps the two values is not caught, because tying a figure to its metric would need the words around it. 

- **Issue #1420** (2026-09-14): **[Bug] return_observations is ingested as return evidence and can validate a false return claim**
  *Symptoms*: ### Description  Analysis grounding can treat a metadata/count field named `return_observations` as actual return evidence.  `_metric_kind_for_path()` tokenizes compound leaf names and searches for known metric aliases. Because `return_observations` contains the token `return`, it is classified as metric kind `return`.  For example:  ```text return_observations = 81  is ingested as:  metric = return value = 81.0 field = return_observations  This can then validate a financial return claim that was never present in the tool output:  Annual return: 81%  passes final-answer grounding, while:  Annual return: 80%  is correctly rejected.  Cumulative return: 81% also passes.  This is a false-positive grounding result: a count of return observations can become evidence for an 81% investment return.  I reproduced this against a clean Vibe-Trading v0.1.15 checkout, without custom tools or application-specific integrations.  The relevant upstream logic is:  def _metric_kind_for_path(path: str) -> str | None:     leaf = re.sub(r"\[\d+\]$", "", str(path or "").rsplit(".", 1)[-1])     leaf = leaf.strip().casefold()      kind = _ANALYSIS_KIND_ALIASES.get(leaf)     if kind is not None:         return kind      tokens = [token for token in re.split(r"[_.]", leaf) if token]      for size in (2, 1):         for start in range(len(tokens) - size, -1, -1):             kind = _ANALYSIS_KIND_ALIASES.get(                 "_".join(tokens[start : start + size])             )             if kind is not 
  **Post-Mortem & Fix Analysis**:
  > Closed by the grounding rewrite on main: `return_observations` and the other count, window and lookback leaves are no longer metric evidence, so "Annual return: 81%" against `return_observations = 81` is refused. 

- **Issue #1418** (2026-09-14): **[Bug] Spanish decimal comma and Unicode minus break analysis grounding**
  *Symptoms*: ### Description  **What happened:**  Analysis grounding mis-parses numbers written in normal Spanish numeric format.  The Spanish locale naturally produces decimal commas, e.g.:  ```text 1,57% −5,13% 0,188 2,237  but the grounding layer currently assumes an English numeric format.  This causes correct analysis metrics to be rejected or reinterpreted.  Examples observed in real runs:  Model output                  Grounding interpretation ------------------------------------------------------ −5,13%                        13% 1,57%                         57% −5,132%                       5132%  For tail-risk wording, the confidence level can also be interpreted as a measured value:  VaR 95%: 1,57%  may validate both 95% and the malformed 57% as candidate VaR values, although 95% is the confidence level and 1,57% is the actual metric.  The underlying tool output is correct. The corruption happens when the final natural-language answer is parsed by GroundingLedger.  This reproduces in both the Web UI and the full CLI agent path, so it is not a frontend-only issue.  The relevant current code shape is:  _MEASURE_NUMBER_RE = re.compile(     r"[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)\s*[%％]?"     r"|[-+]?(?:\d{1,3}(?:,\d{3})+|\d+)\s*[%％]" )  and clause splitting currently uses:  _CLAUSE_SEPARATOR_RE = re.compile(r"[,，;；。、\n]") _THOUSANDS_SEPARATOR_RE = re.compile(r"(?<=\d),(?=\d{3}(?!\d))")  This means:  decimal comma is not a supported decimal separator; an ASCII comma may split a
  **Post-Mortem & Fix Analysis**:
  > Fixed on main. "−5,13%", "1,57%" and "0,188" are read as decimals, U+2212 is a minus sign, and an answer that writes a marked decimal comma also reads "2,237" and "−5,132%" as 2.237 and −5.132%. A confidence level is no longer matched as a metric value: the answer declares it (`95% | count | confidence level` in its figures block), and the VaR report from this issue grounds once it does. A lone "2,237" with no other decimal comma in the answer is still read as 2237.

- **Issue #1403** (2026-09-11): **[Bug] Lazy loader registry is not thread-safe: concurrent cold-start calls see an empty registry**
  *Symptoms*: ### Description  ## Description  **What happened:**  The lazy loader registry can report itself as initialized before loader registration has actually completed.  `backtest.loaders.registry._ensure_registered()` sets `_registered = True` before importing the loader modules. When several threads call it concurrently on a cold process, one thread starts the imports while the other threads see `_registered == True` and immediately return with `LOADER_REGISTRY` still empty.  This is observable without an LLM and without artificial delays.  In a natural cold-start test with 8 threads:  ```text worker=1 elapsed=    0.022 ms _registered=True loaders=0 worker=6 elapsed=    0.027 ms _registered=True loaders=0 worker=4 elapsed=    0.030 ms _registered=True loaders=0 worker=5 elapsed=    0.030 ms _registered=True loaders=0 worker=3 elapsed=    0.033 ms _registered=True loaders=0 worker=0 elapsed=    0.035 ms _registered=True loaders=0 worker=2 elapsed=    0.038 ms _registered=True loaders=0 worker=7 elapsed=  447.644 ms _registered=True loaders=27  min loaders seen: 0 max loaders seen: 27 NATURAL_RACE=YES  The functional consequence is that real concurrent market-data requests can fail spuriously during cold start.  Using three concurrent calls for YPF.US, SPY.US, and CL=F:  Cold parallel process:  YPF.US  -> {"_unresolved": ["YPF.US"]}   in 0.009s SPY.US  -> {"_unresolved": ["SPY.US"]}   in 0.010s CL=F    -> success                       in 0.920s  Immediately afterwards, in the same p
  **Post-Mortem & Fix Analysis**:
  > Update: the formatting question below is resolved. I applied Black to the two changed files as `CONTRIBUTING.md` prescribes; full-file Black and Ruff checks now pass. No formatting exception or guidance is needed. The fix and verification results are in #1405.  I reproduced this on Python 3.11.15 with `requirements-lock.txt`. The original code returns an empty registry to seven of eight cold callers; the patched code gives all eight callers 27 loaders. The full backend selection passed on Python 3.11.15 and 3.14.6 (12,892 passed, 17 skipped each). After the formatting-only follow-up, the 48 registry/source-order tests pass again on both versions.  Original question, now resolved: both changed files had existing Black differences on main (`f9cb061b`), so I initially asked whether to preserve that formatting. Applying the required formatter only to those two files resolves the check without changing any other files. 

- **Issue #1355** (2026-09-05): **[Bug] Backtest subprocess segfaults on aarch64/glibc 2.34 — resource.setrlimit via preexec_fn runs Python in a forked child of a multi-threaded server**
  *Symptoms*: ### Description  **What happened:** `Runner._run_backtest` (agent/src/core/runner.py) launches the generated backtest as a subprocess and applies sandbox resource limits (`RLIMIT_AS`, `RLIMIT_NOFILE`) via `preexec_fn=_make_rlimit_preexec()`. `preexec_fn` runs arbitrary Python code (the `resource.setrlimit` calls) inside the forked child, between `fork()` and `exec()` — and the parent process here is `vibe-trading serve`, a multi-threaded server (uvicorn + background agent loops). Forking a multi-threaded process and running non-async-signal-safe code (the Python interpreter itself, executing bytecode) in the child before exec is undefined behavior per POSIX, and on this host it reliably segfaults: every backtest subprocess launch crashed with SIGSEGV (confirmed via systemd-coredump entries for the child Python process), so no backtest could complete while the server was running normally (as opposed to e.g. a single-threaded CLI invocation, which does not exhibit this).  **What I expected:** Sandbox rlimits should be applied without executing Python bytecode in the forked-but-not-yet-exec'd child of a multi-threaded process.  **Suggested fix:** Apply the rlimits after exec instead of between fork and exec: wrap the subprocess command as `python -c "<bootstrap that sets resource.setrlimit, then runpy.run_path(entry_script)>" <entry_script> <args...>` instead of passing `preexec_fn=`. The bootstrap runs in the freshly-exec'd, single-threaded interpreter, so `setrlimit` executes 
  **Post-Mortem & Fix Analysis**:
  > Confirmed on current main, independently of the report: `runner.py:604` passes `preexec_fn=_make_rlimit_preexec()`, and the closure at `runner.py:99-106` executes Python bytecode (`resource.getrlimit`/`setrlimit`) in the forked child. The parent is `vibe-trading serve` — uvicorn plus background agent loops — so this is exactly the multi-threaded-fork case CPython documents as unsafe, and your coredump evidence matches the mechanism rather than merely correlating with it.  Fixed by removing `preexec_fn` entirely. The same two ceilings are now applied by the freshly-exec'd, single-threaded interpreter through a `python -c` bootstrap that then `runpy`s the entry script, so the fork-time hazard is gone on every platform instead of only where it happens not to crash. The bootstrap is transparent to the entry script: `argv[0]` is the script, `argv[1:]` are the caller's args, `__name__` is `"__main__"`, the script's own directory is on `sys.path` exactly as with `python script.py`, and a non-

- **Issue #1354** (2026-09-07): **[Bug] Grounding gate misreads a price-context word used as a formula variable (e.g. "close/SMA50 > 1") as an asserted observed value, causing false-positive numeric_claim_unavailable rejections**
  *Symptoms*: ### Description   **What happened:** `GroundingLedger._validate_price_claims` (agent/src/agent/grounding.py) decides whether a sentence contains a price claim by checking `_PRICE_CONTEXT_RE.search(segment)` (matches words like "close", "price", "preço") and then, if it matches, pulling the first number in the segment via `_numbers_without_dates_or_percent` as the asserted value. This does not distinguish a price word used as an observed value ("close was 2500") from the same word used as a formula/rule variable ("close/SMA50 > 1", "regra: close acima da EMA30"). In the latter case the number after the price word is not a price at all — it can be a threshold, a signal constant (+1/0/-1), a Monte Carlo simulation count, a lookback window, or a bare year — but the gate still grabs it as "the" asserted value and rejects it with `numeric_claim_unavailable` ("Price claim {value} has no matching observed tool evidence") whenever that number doesn't match any observed quote.  This caused real, correct backtest reports to be rejected as ungrounded. Two other AI agents (Codex, DeepSeek) spent hours trying to fix it by adding one regex per newly-discovered bad phrasing (a position/signal constant of ±1 or 0, a Monte Carlo simulation count with or without a currency unit next to it, a bare four-digit year in prose, a normalized ratio) — each fix accepted one more legitimate phrasing but reliably opened a new bypass or still rejected a different valid report, because natural language phra
  **Post-Mortem & Fix Analysis**:
  > Confirmed against current main (`agent/src/agent/grounding.py:2214-2232`): any segment matching `_PRICE_CONTEXT_RE` gets every number in it pulled by `_numbers_without_dates_or_percent` and compared as a price claim, with no syntactic check of what sits between the price word and the number. "close/SMA50 > 1" hits exactly that path: `close` matches the context regex, and 50 (or 1) is then validated as an asserted observed value and rejected.  I also agree with the diagnosis about the denylist trap. Per-phrasing regexes are how this gate got its current false-positive shape; one more pattern per bad phrasing cannot converge. A closed, structural distinction is the right shape: if a formula marker (comparison/division operator, or an indicator identifier followed by digits) sits between the price word and the number, the number is an operand, not a claimed value. The sentence-boundary cutoff belongs in the same patch.  Please open the PR with your patch and the regression suite. The bar 
  > Taking this one — it's in the gate family we've been hardening (we landed the sibling fixes: #1326 full-width clause splitting, #1338 the analysis gate). The structural approach you and @he-yufeng outlined is clear: a closed `_FORMULA_MARKER_RE` (comparison/division operators, indicator-identifier + digits) sitting between the price-context word and the number, plus the sentence-boundary cutoff — with the strict-narrowing regression suite ("close was 2500" with no evidence still rejects).  @nandofmike — if your patch is ready, say the word and it's yours; otherwise I'll open the PR. 

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

### Incident Patch 1: `a2a5f950` (2026-09-29)
**Commit Message**: fix(loaders): make the stooq challenge latch stop probing, not just logging

The anti-bot detection warned once and then kept spending one throttled
request per symbol on an endpoint that can only answer with the challenge
page. The warning already told the operator the source is "unavailable for
the rest of this process", but the flag only gated the log line, so the
us_equity fallback walk still issued a request per missing symbol at
position 2 before sliding on to the next source.

Measured against a stubbed transport on this tree: a five-symbol fetch
issued five requests and returned no frames before this change, one
request after, and a second batch in the same process now issues none.
Stooq spaces requests 0.6s apart plus up to 0.4s jitter, so a batched
fallback probe paid that spacing per symbol to reach the conclusion it
had already reached on the first one.

The live endpoint still answers non-browser clients with the JavaScript
proof-of-work challenge (HTTP 200, text/html) as of 2026-09-29, and the
public-loader lane reports stooq invalid/empty_frame, so the condition
#1315 described has not cleared.

Deliberately unchanged: stooq stays in the default chain (the operator
o

**File**: `agent/backtest/loaders/stooq_loader.py` (modified, +11/-2)
```diff
@@ -41,7 +41,10 @@
 # Stooq currently answers non-browser clients with a JavaScript proof-of-work
 # challenge page (HTTP 200, HTML body) instead of CSV. Without detection the
 # loader parses it as "no data" and the fallback chain slides past a source
-# that never serves, with nothing in the run log to show for it.
+# that never serves, with nothing in the run log to show for it. The flag is
+# the process-wide latch behind that warning: once the challenge is seen, no
+# further symbol is probed, because a second request can only be answered the
+# same way.
 _challenge_warned = False
 
 
@@ -160,6 +163,13 @@ def _fetch_one(
         self, code: str, start_date: str, end_date: str,
     ) -> Optional[pd.DataFrame]:
         """Fetch and parse one symbol's CSV; ``None`` when Stooq has no data."""
+        global _challenge_warned
+        if _challenge_warned:
+            # Latched earlier in this process: the warning already told the
+            # operator the source is unavailable, so spending a throttled
+            # request per remaining symbol (0.6s apart) only delays the chain's
+            # move to the next source. A new process re-probes.
+            return None
         params = {
             "s": map_symbol(code),
             "d1": _compact_date(start_date),
@@ -174,7 +184,6 @@ def _fetch_one(
         )
         response.raise_for_status()
         if _looks_like_challenge_page(response.text):
-            global _challenge_warned
             if not _challenge_warned:
                 logger.warning(
                     "stooq is serving an anti-bot challenge page instead of CSV "
```

**File**: `agent/tests/test_stooq_loader.py` (modified, +32/-0)
```diff
@@ -207,6 +207,38 @@ def test_challenge_page_yields_no_data_and_warns_once(self, monkeypatch, caplog)
         warnings = [r.message for r in caplog.records if "anti-bot challenge" in r.message]
         assert len(warnings) == 1  # two symbols, one warning
 
+    def test_challenge_latch_stops_probing_later_symbols(self, monkeypatch, caplog):
+        """Once challenged, later symbols must not pay another request.
+
+        The warning says the source is "unavailable for the rest of this
+        process", but the latch only gated the log line: a batched US fallback
+        probe still spent one throttled request per missing symbol on an
+        endpoint that can only answer with the challenge page.
+        """
+        monkeypatch.setattr(stooq_loader, "_challenge_warned", False)
+        probed: List[str] = []
+
+        def fake_get(url, **kwargs):
+            probed.append(kwargs["params"]["s"])
+            return _FakeResponse(text=self._CHALLENGE_HTML)
+
+        monkeypatch.setattr(stooq_loader, "throttled_get", fake_get)
+        loader = stooq_loader.DataLoader()
+
+        with caplog.at_level(logging.WARNING, logger="backtest.loaders.stooq_loader"):
+            first = loader.fetch(
+                ["AAPL.US", "MSFT.US", "NVDA.US"], "2024-01-01", "2024-01-31",
+            )
+
+        assert first == {}
+        # One probe establishes the challenge; the other two symbols are not
+        # spent against a source the same process already knows cannot serve.
+        assert probed == ["aapl.us"]
+
+        # A later batch in the same process is answered without any request.
+        assert loader.fetch(["AMZN.US"], "2024-01-01", "2024-01-31") == {}
+        assert probed == ["aapl.us"]
+
     def test_challenge_page_does_not_reach_csv_parser(self, monkeypatch):
         monkeypatch.setattr(stooq_loader, "_challenge_warned", True)  # latch already set
         monkeypatch.setattr(
```

---

### Incident Patch 2: `4a40a7f6` (2026-09-29)
**Commit Message**: fix(grounding): tell the model when a formula runs the other way, and to answer only

A live DeepSeek V4 risk-parity run after c8c2dc38 completed and released
its report, with every declared backtest figure grounded. Its second
draft still lost eight differences: the prose wrote "−1.51pp" (risk
parity minus equal weight) beside "12.87% − 11.36%", the size right and
the direction reversed. That stays refused, because the sign is part of
the claim, but the correction said only "its own note evaluates to
1.51%", and the model rewrote the numbers instead of the formulas. The
issue now carries sign_reversed and the correction says the formula runs
the other way round. The hint for a figure declared in the other unit
matches by size and says when the declared value has the opposite sign
("0.0151" for "−1.51pp"), where before it said nothing at all.

The same draft opened with "The rejection was because several figures
... were not declared", in English to a user writing Chinese, and that
sentence was released. The correction now asks for the corrected answer
alone, in the user's language, without mentioning the rejection, the
check or the figures block.

**File**: `agent/src/agent/grounding/policies.py` (modified, +16/-2)
```diff
@@ -594,7 +594,14 @@ def _validate_figures(
                             "is not declared in the figures block and is not an observed "
                             "value; declare it as observed / derived / proposed / cited / "
                             "count, or remove it",
-                            **({"declared_as": other_unit.value_text} if other_unit else {}),
+                            **(
+                                {
+                                    "declared_as": other_unit.value_text,
+                                    "declared_sign_differs": (other_unit.value < 0) != (figure.value < 0),
+                                }
+                                if other_unit
+                                else {}
+                            ),
                         )
                     )
                     continue
@@ -1677,6 +1684,10 @@ def _check_derived(
         # Reported in the figure's own units, as ``_result_matches`` compares it.
         scaled = result * 100.0 if figure.percent else result
         shown = f"{scaled:.6g}%" if figure.percent else f"{scaled:.6g}"
+        # "−1.51pp" beside "12.87% − 11.36%": the size is right and the formula
+        # runs the other way. Still refused (the sign is part of the claim),
+        # but said, or the model rewrites the number instead of the formula.
+        reversed_sign = self._result_matches(figure, -result)
         return [
             self._figure_issue(
                 "numeric_claim_conflict",
@@ -1686,6 +1697,7 @@ def _check_derived(
                 "derivation_result_mismatch",
                 f"is declared derived, but its own formula evaluates to {shown}",
                 derived_result=shown,
+                **({"sign_reversed": True} if reversed_sign else {}),
             )
         ]
 
@@ -2030,7 +2042,9 @@ def _declared_in_other_unit(block: FiguresBlock, figure: Figure) -> Declaration
         if declaration.percent == figure.percent:
             continue
         in_figure_units = declaration.value * (100.0 if figure.percent else 0.01)
-        if abs(in_figure_units - figure.value) <= half_unit * (1 + 1e-9):
+        # By size: a difference declared one way round and written the other
+        # ("0.0151" for "−1.51pp") is still the value the model meant to name.
+        if abs(abs(in_figure_units) - abs(figure.value)) <= half_unit * (1 + 1e-9):
             return declaration
     return None
 
```

**File**: `agent/src/agent/grounding/release.py` (modified, +11/-2)
```diff
@@ -125,8 +125,15 @@ def _correction_line(issue: dict[str, Any]) -> str:
     declared_as = issue.get("declared_as")
     if declared_as:
         evidence += (
-            f"; the figures block declares {declared_as}, which is not how the answer "
-            f"writes it — declare it exactly as written ({issue.get('value')})"
+            f"; the figures block declares {declared_as}"
+            + (", with the opposite sign," if issue.get("declared_sign_differs") else "")
+            + f" which is not how the answer writes it — declare it exactly as written "
+            f"({issue.get('value')})"
+        )
+    if issue.get("sign_reversed"):
+        evidence += (
+            "; that is the same size with the opposite sign — the formula runs the other "
+            "way round from the answer, so write its operands in the order the answer states"
         )
     candidates = issue.get("field_ref_candidates") or []
     if candidates:
@@ -177,6 +184,8 @@ def correction_prompt(self, validation: ValidationResult) -> str:
         """
         lines = [
             "[GROUNDING GATE] The previous draft was rejected and was not released to the user.",
+            "Reply with the corrected answer only, in the user's language, written as the "
+            "answer itself: do not mention this rejection, the check or the figures block.",
             "Every figure below, exactly as you wrote it, with what you declared and what the evidence says:",
         ]
         figures, others = [], []
```

**File**: `agent/tests/test_grounding_backtest_outputs.py` (modified, +46/-0)
```diff
@@ -613,3 +613,49 @@ def test_only_a_literal_square_or_cube_is_evaluated() -> None:
     assert _formula_in_note("9^9^9") is None
     assert _formula_in_note("2^10 + 1") is None
     assert _formula_in_note("0.3^2 + 0.4^2")[0] == pytest.approx(0.25)
+
+
+# ---------------------------------------------------------------------------
+# What the correction tells the model (live DeepSeek run, 2026-09-29)
+# ---------------------------------------------------------------------------
+
+
+def test_a_formula_that_runs_the_other_way_is_named_as_such(two_runs: GroundingLedger) -> None:
+    """"−0.079" beside "1.2115 − 1.1329": the size is right, the direction is not.
+
+    Still refused — the sign is part of the claim — but the second draft of a
+    live run rewrote eight such figures instead of their formulas, because the
+    correction only said "its own note evaluates to 0.079".
+    """
+    result = two_runs.validate_final_answer(
+        _declared("风险平价 Sortino 低 −0.079。", "−0.079 | derived | 1.2115 − 1.1329 | rp, ew")
+    )
+    wrong = two_runs.validate_final_answer(
+        _declared("风险平价 Sortino 低 −0.12。", "−0.12 | derived | 1.2115 − 1.1329 | rp, ew")
+    )
+
+    (issue,) = result.issues
+    assert issue["reason"] == "derivation_result_mismatch" and issue["sign_reversed"] is True
+    assert "opposite sign" in two_runs.correction_prompt(result)
+    assert "sign_reversed" not in wrong.issues[0]
+
+
+def test_a_declaration_of_the_other_sign_and_unit_is_named(two_runs: GroundingLedger) -> None:
+    result = two_runs.validate_final_answer(
+        _declared("风险平价总收益低 −0.30pp。", "0.0030 | derived | 0.132805 − 0.129817 | rp, ew")
+    )
+
+    (issue,) = result.issues
+    assert issue["declared_as"] == "0.0030" and issue["declared_sign_differs"] is True
+    assert "with the opposite sign" in two_runs.correction_prompt(result)
+
+
+def test_the_correction_asks_for_the_answer_alone(two_runs: GroundingLedger) -> None:
+    """A live second draft opened with "The rejection was because…" — in English,
+    to a user who wrote Chinese — and that sentence was released."""
+    result = two_runs.validate_final_answer("风险平价 Sortino 1.190。")
+
+    prompt = two_runs.correction_prompt(result)
+
+    assert "do not mention this rejection" in prompt
+    assert "in the user's language" in prompt
```

---

### Incident Patch 3: `c8c2dc38` (2026-09-29)
**Commit Message**: fix(read_file): say where the agent may read, and list a directory

A live risk-parity run on DeepSeek V4 stopped with no_progress after 93
seconds, before any backtest ran: the model went looking for the backtest
engine's source (../../agent/src/backtest, the checkout's absolute path,
skills/../backtest/engine.py) and every attempt got "File not found or
path escapes workspace". Each spelling was a new call, so none was
blocked, and none was an observation, so eight rounds exhausted the
no-progress budget. This is the reporter's 1m03s failure: same prompt,
same shape, no compaction involved.

The refusal now says which it was (error_code outside_readable_roots or
not_found), where read_file may open files (the run directory, skills/),
and that the engine's contracts are in the skills (load_skill lists a
skill's sections). A path that names a directory inside those roots
returns its entries instead of an error. The boundary is unchanged.

**File**: `agent/src/tools/read_file_tool.py` (modified, +43/-2)
```diff
@@ -23,6 +23,21 @@
 # arbitrary model-supplied relative path never starts reaching into skills/.
 _SKILL_RELATIVE_PREFIXES = ("references/", "scripts/")
 
+# How many entries a directory listing returns.
+_LISTING_LIMIT = 200
+
+# What the refusal says, whichever root the path missed. A risk-parity run once
+# spent all eight of its no-progress rounds trying spellings of the engine's
+# source path (``../../agent/src/backtest``, ``skills/../backtest/engine.py``)
+# against one message that said neither where it may read nor what to do.
+_READABLE = (
+    "read_file opens files under the run directory (a relative path such as "
+    "artifacts/metrics.csv or config.json) and the bundled skill documents "
+    "(skills/<skill>/...). The engine's source code is not readable here; its "
+    "contracts and options are documented in the skills: load_skill(name) lists "
+    "a skill's sections, and load_skill(name, section=...) returns one."
+)
+
 
 def _bundled_skills_dir() -> Path:
     """Return the bundled read-only skills root."""
@@ -123,6 +138,9 @@ def execute(self, **kwargs: Any) -> str:
 
         resolved = None
         namespaced = False
+        # Whether any root contains the path at all: a path inside a root that
+        # does not exist is "not found", one outside every root is refused.
+        contained = False
 
         # `skills/` is a namespace bound to the bundled read-only skills root.
         # Binding the prefix stops a same-named file in run_dir — which the agent
@@ -132,6 +150,7 @@ def execute(self, **kwargs: Any) -> str:
             namespaced = True
             try:
                 candidate = _safe_path(file_path[len("skills/") :], skills_dir)
+                contained = True
             except ValueError:
                 candidate = None
             if candidate is not None and candidate.exists():
@@ -142,6 +161,7 @@ def execute(self, **kwargs: Any) -> str:
             for root in allowed_roots:
                 try:
                     candidate = _safe_path(file_path, root)
+                    contained = True
                     if candidate.exists():
                         resolved = candidate
                         break
@@ -178,10 +198,31 @@ def execute(self, **kwargs: Any) -> str:
                 )
 
         if resolved is None:
+            if contained:
+                error_code = "not_found"
+                reason = f"{file_path} was not found."
+            else:
+                error_code = "outside_readable_roots"
+                reason = f"{file_path} is outside what read_file may open."
+            return json.dumps(
+                {"status": "error", "error_code": error_code, "error": f"{reason} {_READABLE}"},
+                ensure_ascii=False,
+            )
+
+        if resolved.is_dir():
+            # A directory is a question about what is in it.
+            entries = sorted(
+                child.name + ("/" if child.is_dir() else "")
+                for child in resolved.iterdir()
+                if not child.name.startswith(".")
+            )
             return json.dumps(
                 {
-                    "status": "error",
-                    "error": f"File not found or path escapes workspace: {file_path}",
+                    "status": "ok",
+                    "path": str(resolved),
+                    "kind": "directory",
+                    "entries": entries[:_LISTING_LIMIT],
+                    "truncated": len(entries) > _LISTING_LIMIT,
                 },
                 ensure_ascii=False,
             )
```

**File**: `agent/tests/test_read_file_refusals.py` (added, +71/-0)
```diff
@@ -0,0 +1,71 @@
+"""``read_file`` says where it may read, and lists a directory it is given.
+
+Regression (2026-09-29, a live risk-parity run on DeepSeek V4): the model went
+looking for the backtest engine's source — ``../../agent/src/backtest``, the
+checkout's absolute path, ``skills/../backtest/engine.py`` — and every attempt
+got "File not found or path escapes workspace". Each spelling was a new call,
+so none was blocked, and none was an observation: eight rounds later the run
+stopped with ``no_progress`` after 93 seconds, before any backtest ran. The
+message said neither which of the two had happened nor where reading is
+allowed, so the model kept guessing.
+"""
+
+from __future__ import annotations
+
+import json
+from pathlib import Path
+
+import pytest
+
+from src.tools.read_file_tool import ReadFileTool
+
+
+@pytest.fixture()
+def run_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
+    monkeypatch.setenv("VIBE_TRADING_ALLOWED_RUN_ROOTS", str(tmp_path))
+    run = tmp_path / "run"
+    (run / "artifacts").mkdir(parents=True)
+    (run / "artifacts" / "metrics.csv").write_text("sharpe\n0.69\n", encoding="utf-8")
+    (run / "artifacts" / ".archived_backtest.json").write_text("{}", encoding="utf-8")
+    return run
+
+
+def _read(path: str, run: Path) -> dict:
+    return json.loads(ReadFileTool().execute(path=path, run_dir=str(run)))
+
+
+@pytest.mark.parametrize(
+    "path",
+    ["../../agent/src/backtest", "skills/../backtest/engine.py", "/etc/hosts"],
+)
+def test_a_path_outside_the_readable_roots_is_refused_as_such(run_dir: Path, path: str) -> None:
+    body = _read(path, run_dir)
+
+    assert body["status"] == "error"
+    assert body["error_code"] == "outside_readable_roots"
+    # The refusal carries the way forward, not just the verdict.
+    assert "run directory" in body["error"] and "skills/" in body["error"]
+    assert "load_skill" in body["error"]
+
+
+def test_a_missing_file_inside_a_root_is_not_found(run_dir: Path) -> None:
+    body = _read("artifacts/equity.csv", run_dir)
+
+    assert body["error_code"] == "not_found"
+    assert "load_skill" in body["error"]
+
+
+def test_a_directory_is_answered_with_its_entries(run_dir: Path) -> None:
+    listing = _read("artifacts", run_dir)
+    skill = _read("skills/strategy-generate", run_dir)
+
+    assert listing["status"] == "ok" and listing["kind"] == "directory"
+    assert listing["entries"] == ["metrics.csv"]  # dotfiles stay out
+    assert "SKILL.md" in skill["entries"]
+
+
+def test_a_file_still_reads_as_before(run_dir: Path) -> None:
+    body = _read("artifacts/metrics.csv", run_dir)
+
+    assert body["status"] == "ok"
+    assert body["content"] == "sharpe\n0.69\n"
```

---

### Incident Patch 4: `c1542cb3` (2026-09-29)
**Commit Message**: fix(grounding): read a comparison report's arithmetic as it is written

The same replayed risk-parity drafts, after d2dd7006:

- A derivation note with labels glued to its operands ("等权 Sortino
  1.2115 − 风险平价 1.1329") or an aside in brackets ("0.09297 − 0.10469
  （收益差，约−1.17pp）") was "not arithmetic". When the note as written
  fails, its words and bracketed asides are now removed, never read, and
  the arithmetic between them evaluated: formula_not_evaluable 11 -> 1.
- An operand written as a percent is the fraction the evidence holds:
  "13.28% − 12.98%" is 0.1328 − 0.1298 (it was 13.28 − 12.98, which no
  observation anchors), and "0.666 × (1 − 3%)" is 0.666 × 0.97.
- A square or cube (HHI is a sum of squared weights) is evaluated; the
  exponent is not an operand and anchors nothing, and any other power
  stays unsupported (9^9^9 would never return).
- A declared value may be a fraction ("1/3") or carry a multiple mark
  ("5.5x", "3 倍"); one unreadable line fails the whole draft.
- A draft ending in DeepSeek's closing tool-call tags
  ("</｜｜DSML｜｜invoke>") is recognised as tool-call syntax; the
  fullwidth pattern only matched opening tags, so the tags reached the
  gate as fi

**File**: `agent/src/agent/grounding/figures.py` (modified, +15/-4)
```diff
@@ -28,6 +28,12 @@
 #: the answer must retain more digits instead of widening its evidence band.
 ROUNDED_BAND = 0.005
 
+#: A declared value written as a fraction of two integers ("1/3").
+_FRACTION_RE = re.compile(r"([1-9]\d{0,2})\s*/\s*([1-9]\d{0,2})")
+
+#: Marks of a multiple a declared value may carry ("5.5x", "3 倍").
+_MULTIPLE_MARKS = frozenset({"x", "X", "×", "倍"})
+
 #: The five roles a declaration may carry (spec §2).
 ROLES = ("observed", "derived", "proposed", "cited", "count")
 
@@ -618,6 +624,10 @@ def _parse_value(
         exactly one number and its marks.
     """
     field = _normalize(text).text.strip()
+    fraction = _FRACTION_RE.fullmatch(field)
+    if fraction is not None:
+        # "1/3" for an equal weight: a value, not two numbers.
+        return int(fraction.group(1)) / int(fraction.group(2)), False, field.replace(" ", "")
     tokens = _numbers(field, decimal_commas=decimal_commas)
     if len(tokens) != 1:
         return None
@@ -626,10 +636,11 @@ def _parse_value(
     if rest[:1] in _MAGNITUDES and not _is_currency_mark(rest):
         rest = rest[1:].lstrip()
     unit, consumed = _percent_mark(rest, 0)
-    if not (
-        _is_currency_mark(rest[consumed:].strip())
-        and _is_currency_mark(field[: token.start].strip())
-    ):
+    tail = rest[consumed:].strip()
+    if not unit and tail in _MULTIPLE_MARKS:
+        # "5.5x": a multiple, written the way the answer writes it.
+        tail = ""
+    if not (_is_currency_mark(tail) and _is_currency_mark(field[: token.start].strip())):
         return None
     reading = _reading(token.sign, token.digits, unit)
     if reading is None:
```

**File**: `agent/src/agent/grounding/policies.py` (modified, +57/-2)
```diff
@@ -235,11 +235,19 @@ def _unanchored_term(tree: ast.Expression, observed: Callable[[float], bool]) ->
         True when some added or subtracted term is unanchored.
     """
 
+    exponents = {
+        id(item.right)
+        for item in ast.walk(tree)
+        if isinstance(item, ast.BinOp) and isinstance(item.op, ast.Pow)
+    }
+
     def anchored(node: ast.AST) -> bool:
         return any(
             observed(float(item.value))
             for item in ast.walk(node)
-            if isinstance(item, ast.Constant) and _is_number(item.value)
+            if isinstance(item, ast.Constant)
+            and _is_number(item.value)
+            and id(item) not in exponents
         )
 
     def visit(node: ast.AST, factor: bool) -> bool:
@@ -284,9 +292,16 @@ def _evaluate_formula(expression: str) -> tuple[float, list[float], ast.Expressi
         .replace("（", "(")
         .replace("）", ")")
         .replace(",", "")
-        .replace("%", "")
+        .replace("²", "**2")
+        .replace("³", "**3")
+        .replace("^", "**")
         .strip()
     )
+    # "12.87% − 11.36%" is 0.1287 − 0.1136: an operand written as a percent is
+    # the fraction the evidence holds, and "0.666 × (1 − 3%)" means 0.97.
+    normalized = _PERCENT_OPERAND_RE.sub(
+        lambda match: format(float(match.group(1)) / 100.0, ".12g"), normalized
+    ).replace("%", "").replace("％", "")
     if not normalized:
         return None
     try:
@@ -305,6 +320,12 @@ def visit(node: ast.AST) -> float:
         if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
             value = visit(node.operand)
             return value if isinstance(node.op, ast.UAdd) else -value
+        if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Pow):
+            # A square or a cube (HHI is a sum of squared weights). The
+            # exponent is part of the operator, not an operand.
+            if not _is_small_exponent(node.right):
+                raise ValueError("unsupported exponent")
+            return visit(node.left) ** int(node.right.value)
         if isinstance(node, ast.BinOp) and isinstance(
             node.op, (ast.Add, ast.Sub, ast.Mult, ast.Div)
         ):
@@ -330,6 +351,35 @@ def visit(node: ast.AST) -> float:
     return value, inputs, tree
 
 
+#: A number written with a percent sign inside a formula.
+_PERCENT_OPERAND_RE = re.compile(r"(\d+(?:\.\d+)?)\s*[%％]")
+
+
+def _is_small_exponent(node: ast.AST) -> bool:
+    """Whether a power's exponent is a literal 2 or 3."""
+    return isinstance(node, ast.Constant) and node.value in (2, 3) and not isinstance(node.value, bool)
+
+
+#: A bracketed aside holding a word: "（收益差，约−1.17pp）", "(portfolio)".
+_ANNOTATION_RE = re.compile(r"[（(\[][^（）()\[\]]*?(?:[\u3400-\u9fff]|[A-Za-z]{2})[^（）()\[\]]*[）)\]]")
+
+#: A label or unit written against a number: a CJK run, or an ASCII word of
+#: two letters or more ("Sharpe", "RP", "pp"). One letter is kept, so "1e3"
+#: stays a number and "5 x 3" stays unreadable rather than becoming "5 3".
+_LABEL_RE = re.compile(r"[\u3400-\u9fff]+|[A-Za-z]{2,}")
+
+
+def _without_labels(text: str) -> str:
+    """A note with its words removed, so the arithmetic between them can be read.
+
+    "等权Sharpe 0.692 − 风险平价 0.651" is the arithmetic "0.692 − 0.651";
+    an aside in brackets goes whole, because the number inside it
+    ("约−1.17pp") is a restatement of the result, not an operand. Nothing is
+    read from the words themselves.
+    """
+    return _LABEL_RE.sub(" ", _ANNOTATION_RE.sub(" ", text))
+
+
 def _formula_in_note(note: str) -> tuple[float, list[float], ast.Expression] | None:
     """Find the derivation a note states.
 
@@ -351,6 +401,11 @@ def _formula_in_note(note: str) -> tuple[float, list[float], ast.Expression] | N
     for separator in ("，", "；", "：", "; ", ", "):
         parts = [piece for part in parts for piece in part.split(separator)]
     candidates.extend(part for part in parts if part.strip())
+ 
```

**File**: `agent/src/agent/loop.py` (modified, +4/-2)
```diff
@@ -914,13 +914,15 @@ def _is_tool_success(result: str) -> bool:
 # Provider tool-call markup that a model can emit as plain text on the
 # forced-text final iteration, where tool definitions are withheld. Releasing
 # it verbatim hands the user mojibake instead of an answer. Both DSML bar
-# spellings are covered: ASCII double bars and fullwidth double bars.
+# spellings are covered: ASCII double bars and fullwidth double bars, opening
+# and closing tags (a draft ending in "</｜｜DSML｜｜invoke>" once reached the
+# grounding gate as three unreadable figures-block lines).
 _FORCED_TEXT_TOOL_CALL_RE = re.compile(
     r"<\s*/?\s*(?:invoke|parameter|tool_calls|dsml)\b",
     re.IGNORECASE,
 )
 _DSML_BAR_TOOL_CALL_RE = re.compile(
-    r"<\s*[|\u2502\uFF5C]{2}\s*(?:dsml|tool_calls|invoke)\b",
+    r"<\s*/?\s*[|\u2502\uFF5C]{2}\s*(?:dsml|tool_calls|invoke)\b",
     re.IGNORECASE,
 )
 
```

**File**: `agent/tests/test_agent_loop_dsml_tool_calls.py` (modified, +20/-0)
```diff
@@ -181,3 +181,23 @@ def __exit__(self, exc_type, exc, tb) -> None:
         event_type == "answer" and "<" in str(payload)
         for event_type, payload in events
     )
+
+
+def test_closing_dsml_tags_alone_are_tool_call_syntax() -> None:
+    """A DeepSeek draft once ended in closing tags only, inside its figures block;
+    the opening-tag pattern missed them and the gate got three unreadable lines."""
+    from src.agent.loop import _looks_like_tool_call_syntax
+
+    tail = "\n".join(
+        [
+            "```figures",
+            "0.3897 | observed | weight | rp",
+            "</｜｜DSML｜｜parameter>",
+            "</｜｜DSML｜｜invoke>",
+            "</｜｜DSML｜｜tool_calls>",
+        ]
+    )
+
+    assert _looks_like_tool_call_syntax("Report.\n\n" + tail)
+    assert _looks_like_tool_call_syntax("done </||DSML||invoke>")
+    assert not _looks_like_tool_call_syntax("| 标的 | 权重 |\n|---|---|\n| 000001.SZ | 38.97% |")
```

**File**: `agent/tests/test_grounding_backtest_outputs.py` (modified, +86/-0)
```diff
@@ -43,6 +43,7 @@
     "sortino": 1.1329,
     "trade_count": 10,
     "total_turnover": 1.366493,
+    "max_consecutive_loss": 2,
 }
 EW = {
     "final_value": 1132804.94,
@@ -527,3 +528,88 @@ def test_a_trade_price_read_back_is_not_a_market_print(two_runs: GroundingLedger
 
     assert result.valid, result.issues
     assert not two_runs._price_records()
+
+
+# ---------------------------------------------------------------------------
+# How comparison reports write their arithmetic (same replayed runs)
+# ---------------------------------------------------------------------------
+
+
+@pytest.mark.parametrize(
+    "note",
+    [
+        "等权 Sortino 1.2115 − 风险平价 1.1329",
+        "1.2115 − 1.1329（Sortino 差，约 +0.079）",
+        "Sortino 差 = 等权 1.2115 − 风险平价 1.1329（组合整体）",
+        "1.2115 − 1.1329 Sortino差",
+    ],
+)
+def test_a_labelled_formula_is_read_as_its_arithmetic(two_runs: GroundingLedger, note: str) -> None:
+    """Words glued to operands, or an aside in brackets, used to make the note
+    "not arithmetic"; the words are removed, never interpreted."""
+    result = two_runs.validate_final_answer(
+        _declared("等权 Sortino 高 0.079。", f"0.079 | derived | {note} | rp, ew")
+    )
+
+    assert result.valid, result.issues
+
+
+def test_a_labelled_formula_with_the_wrong_arithmetic_still_fails(two_runs: GroundingLedger) -> None:
+    result = two_runs.validate_final_answer(
+        _declared("等权 Sortino 高 0.12。", "0.12 | derived | 等权 1.2115 − 风险平价 1.1329 | rp, ew")
+    )
+
+    assert [issue["reason"] for issue in result.issues] == ["derivation_result_mismatch"]
+
+
+def test_percent_operands_are_the_fractions_the_evidence_holds(two_runs: GroundingLedger) -> None:
+    """"13.28% − 12.98%" is 0.1328 − 0.1298, anchored on the two total returns."""
+    result = two_runs.validate_final_answer(
+        _declared("等权总收益高 0.30pp。", "0.30pp | derived | 13.28% − 12.98% | rp, ew")
+    )
+
+    assert result.valid, result.issues
+
+
+def test_a_sum_of_squared_weights_is_arithmetic(two_runs: GroundingLedger) -> None:
+    table = two_runs.run_dir / "rp" / "artifacts" / "target_positions.csv"
+    _read(two_runs, table, "read-weights", limit=2)
+
+    anchored = two_runs.validate_final_answer(
+        _declared(
+            "初始 HHI 0.3381。",
+            "0.3381 | derived | 0.389729² + 0.300167² + 0.310103² | rp/artifacts/target_positions.csv",
+        )
+    )
+    # The exponent is not an operand: squaring an invented weight anchors nothing.
+    # The run observed a 2 (max_consecutive_loss), so an exponent that counted
+    # as an operand would anchor the invented 0.4567.
+    invented = two_runs.validate_final_answer(
+        _declared("HHI 0.4135。", "0.4135 | derived | 0.4567² + 0.3002² + 0.3389² | rp")
+    )
+
+    assert anchored.valid, anchored.issues
+    assert [issue["reason"] for issue in invented.issues] == ["additive_operand_not_observed"]
+
+
+def test_a_fraction_or_a_multiple_is_a_readable_declaration(two_runs: GroundingLedger) -> None:
+    """"1/3" and "5.5x" were unreadable lines, and one unreadable line fails the draft."""
+    result = two_runs.validate_final_answer(
+        _declared(
+            "等权每只 1/3，即 0.333；换手是等权的 1.31 倍。",
+            "1/3 | count | 等权权重 | ew",
+            "1.31x | derived | 1.366 / 1.045 | rp, ew",
+        )
+    )
+
+    assert not [issue for issue in result.issues if issue["code"] == "figures_block_malformed"]
+    assert result.valid, result.issues
+
+
+def test_only_a_literal_square_or_cube_is_evaluated() -> None:
+    """``9^9^9`` would take the process down computing a number of 370 million digits."""
+    from src.agent.grounding.policies import _formula_in_note
+
+    assert _formula_in_note("9^9^9") is None
+    assert _formula_in_note("2^10 + 1") is None
+    assert _formula_in_note("0.3^2 + 0.4^2")[0] == pytest.approx(0.25)
```

---

### Incident Patch 5: `711f26c8` (2026-09-29)
**Commit Message**: fix(market-data): ask only a US equity for its .US suffix

a71d5312 refused every bare letters-and-digits code under source=auto as a
US ticker without its suffix. Chinese futures codes (RB0, rb2501, IF2412)
and joined crypto pairs (BTCUSDT) have that shape too; the market detector
the loaders route by reads them as futures and crypto, and they were
answered "US equity symbols must include the .US suffix". The check now
asks the same detector and refuses only what it reads as a US equity.

**File**: `agent/src/tools/market_data_tool.py` (modified, +5/-0)
```diff
@@ -10,6 +10,7 @@
 
 from src.agent.tools import BaseTool
 from src.market_data import DEFAULT_MAX_ROWS, fetch_market_data_json
+from backtest.engines._market_hooks import _detect_market
 from backtest.loaders.registry import VALID_SOURCES
 from backtest.runner import _VALID_INTERVALS
 
@@ -192,11 +193,15 @@ def execute(self, **kwargs: Any) -> str:
         if source not in _SOURCE_ENUM:
             return _error(f"source must be one of {_SOURCE_ENUM}")
         if source == "auto":
+            # Only what the market detector reads as a US equity: a Chinese
+            # futures code (RB0, IF2412) or a joined crypto pair (BTCUSDT) has
+            # the same shape and is served without any suffix.
             bare_us = [
                 code for code in codes
                 if re.fullmatch(r"[A-Za-z][A-Za-z0-9.\-]*", code)
                 and "." not in code
                 and "-" not in code
+                and _detect_market(code) == "us_equity"
             ]
             if bare_us:
                 return _error(
```

**File**: `agent/tests/test_market_data_tool.py` (modified, +19/-0)
```diff
@@ -497,3 +497,22 @@ def test_canonicalize_interval_keeps_minute_and_month_apart():
     assert _canonicalize_interval("1h") == "1H"
     assert _canonicalize_interval("2W") is None
     assert _INTERVAL_CANON["1M"] == "1M"
+
+
+def test_market_data_tool_asks_only_a_us_equity_for_its_suffix():
+    """Bare ``AAPL`` returns empty frames from the US loaders, so auto asks for
+    ``AAPL.US``; a futures code or a joined crypto pair has the same shape and is
+    served as written, and must reach the loaders."""
+    import src.tools.market_data_tool as mod
+    from unittest import mock
+
+    with mock.patch.object(mod, "fetch_market_data_json", side_effect=lambda **kw: "{}"):
+        for code in ("RB0", "rb2501", "IF2412", "BTCUSDT"):
+            out = json.loads(
+                mod.MarketDataTool().execute(codes=[code], start_date="2026-08-20", end_date="2026-08-21")
+            )
+            assert out == {}, (code, out)
+        refused = json.loads(
+            mod.MarketDataTool().execute(codes=["AAPL"], start_date="2026-08-20", end_date="2026-08-21")
+        )
+    assert refused["ok"] is False and "AAPL.US" in refused["error"]
```

---

### Incident Patch 6: `d2dd7006` (2026-09-29)
**Commit Message**: fix(grounding): let a backtest's own output ground the report about it

A risk-parity vs equal-weight backtest report ended in the canned refusal in
12 of 15 replayed runs. Replaying all 26 stored drafts through the gate
(880 of 882 recorded rejections reproduced) showed why:

- Only kind-named metrics (Sharpe, return, drawdown ...) became evidence.
  Sortino, Calmar, turnover, final value, Monte Carlo p-values, the risk
  X-ray and the optimiser's weights were refused although the backtest
  wrote every one of them. The run card, metrics row, risk X-ray,
  validation and rebalance summaries are now recorded whole (lists are
  not descended; files other than metrics.csv/json must match the run
  card's artifact manifest). A per-bar table counts only for the rows a
  read_file showed, while it is still byte for byte what the engine wrote.
  A file the model wrote is never evidence.
- A ref naming the run (rp, rp/artifacts/metrics.csv, rp/metrics.csv,
  "risk_parity target_positions.csv", backtest::rp, rp::sortino) resolved
  to nothing. The run directory now names that backtest's output and no
  other run's; one run's same-named fields are one source, two runs are
  two (correction 

**File**: `agent/src/agent/context.py` (modified, +7/-2)
```diff
@@ -201,9 +201,14 @@
   Once this session holds more than one tail-risk measurement (a VaR and an ES,
   or 95% and 99%), EVERY tail-risk figure needs that field ref — a call id or no
   declaration at all cannot say which of them you are quoting, and the figure is
-  sent back for correction;
+  sent back for correction.
+  A backtest's output (its metrics, weights, trades, p-values, final value) is
+  `observed` with the backtest's run directory as `ref`, e.g. `rp`, or the file
+  you read, e.g. `rp/artifacts/target_positions.csv`; two backtests are two
+  directories, so a comparison names each one (`rp::sharpe`, `ew::sharpe`);
   `derived` — arithmetic on observed values (`note`: the formula; every number
-  added or subtracted must itself be an observed value);
+  added or subtracted must itself be an observed value; `ref`: where the
+  operands came from, e.g. `rp, ew` for a difference between two backtests);
   `proposed` — a price level you suggest, such as an entry, stop or target: inside
   the observed price range, or with a formula over observed values in `note`; a
   percentage is not a level, so state the price it implies;
```

**File**: `agent/src/agent/grounding/evidence.py` (modified, +318/-3)
```diff
@@ -7,6 +7,7 @@
 from __future__ import annotations
 
 import csv
+import hashlib
 import json
 import math
 import re
@@ -15,6 +16,7 @@
 from typing import Any, Mapping
 
 from src.agent.grounding.identity import (
+    _CANONICAL_SYMBOL_RE,
     _infer_currency,
     _infer_venue,
     _normalize_symbol,
@@ -158,8 +160,141 @@
     {"obs", "observations", "window", "lookback", "count", "days", "duration"}
 )
 
-# Money-denominated row fields a currency-marked figure may quote besides a price.
-_AMOUNT_FIELDS = frozenset({"amount", "turnover", "成交额"})
+# Money-denominated fields a currency-marked figure may quote besides a price:
+# a market-data row's amount, and the backtest engine's equity and P&L leaves.
+_AMOUNT_FIELDS = frozenset(
+    {
+        "amount",
+        "turnover",
+        "成交额",
+        "final_value",
+        "initial_cash",
+        "initial_capital",
+        "pnl",
+        "total_pnl",
+        "avg_pnl",
+        "notional",
+    }
+)
+
+# The backtest engine's summary outputs, relative to its run directory: small
+# documents of scalars, recorded whole when the backtest completes. A list
+# inside them (1,000 Monte Carlo Sharpe samples, one entry per rebalance) is a
+# series and is not descended. metrics.csv/json are recorded as they always
+# were; every other file must appear, byte for byte, in the run card's
+# artifact manifest, which the engine writes after its outputs.
+_BACKTEST_SUMMARY_FILES = (
+    "run_card.json",
+    "artifacts/metrics.csv",
+    "artifacts/metrics.json",
+    "artifacts/risk_xray.json",
+    "artifacts/validation.json",
+    "artifacts/rebalance_notes.json",
+)
+
+_MANIFEST_EXEMPT = frozenset({"run_card.json", "artifacts/metrics.csv", "artifacts/metrics.json"})
+
+# Tools whose result names a file the model itself wrote. Such a file is never
+# engine output, whatever its name.
+_WRITE_TOOLS = frozenset({"write_file", "edit_file"})
+
+# Columns of a backtest table that name the row's instrument (trades.csv "code").
+_TABLE_SYMBOL_COLUMNS = frozenset({"symbol", "code", "ticker"})
+
+#: Written by the loop into the active run when it archives a backtest there;
+#: ``source_run`` names the run directory the copy came from.
+ARCHIVE_MANIFEST = ".archived_backtest.json"
+
+
+def _relative_posix(path: Path, root: Path) -> str:
+    """``path`` relative to ``root`` in POSIX form, "" for ``root`` itself."""
+    try:
+        relative = Path(path).resolve().relative_to(root).as_posix()
+    except (OSError, ValueError):
+        return Path(path).as_posix()
+    return "" if relative == "." else relative
+
+
+def _file_sha256(path: Path) -> str | None:
+    """Hex SHA-256 of a file's bytes, or None when it cannot be read."""
+    try:
+        return hashlib.sha256(Path(path).read_bytes()).hexdigest()
+    except OSError:
+        return None
+
+
+def _archive_source(root: Path) -> str | None:
+    """The run directory name the active run's archived backtest came from."""
+    try:
+        payload = json.loads((root / ARCHIVE_MANIFEST).read_text(encoding="utf-8"))
+    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
+        return None
+    source = payload.get("source_run") if isinstance(payload, dict) else None
+    return str(source) if source else None
+
+
+def _run_card_manifest(directory: Path) -> dict[str, str]:
+    """``{relative path: sha256}`` from a backtest's run card, or empty."""
+    try:
+        card = json.loads((directory / "run_card.json").read_text(encoding="utf-8"))
+    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
+        return {}
+    entries = card.get("artifacts") if isinstance(card, dict) else None
+    if not isinstance(entries, list):
+        return {}
+    return {
+        str(entry["path"]): str(entry["sha256"])
+        for entry in entries
+        if isinstance(entry, dict) and entry.get("path") and entry.get("sha256")
+    }
+
+
+def _summary_scalars(path: Path) -> list[tuple[str, int | float]]:
+    """``(f
```

**File**: `agent/src/agent/grounding/ledger.py` (modified, +11/-0)
```diff
@@ -100,6 +100,14 @@ def __init__(
         self._symbol_resolution_attempts = 0
         self._price_evidence_attempts = 0
         self._ingested_csvs: set[str] = set()
+        # Per-bar tables completed backtests wrote: resolved path -> (sha256,
+        # backtest scope), so a later read of one can be recognised as engine
+        # output. Files the model wrote itself never qualify.
+        self._engine_tables: dict[str, tuple[str, str]] = {}
+        self._model_written: set[str] = set()
+        # Backtest call -> its run directory, and each directory's latest call.
+        self._backtest_scopes: dict[str, str] = {}
+        self._scope_latest: dict[str, str] = {}
         self._identity_required = bool(_ACTIONABLE_MARKET_RE.search(user_message))
         self._buffer_output = self._identity_required
         # Every instrument this run is entitled to write about: the ones the
@@ -262,12 +270,15 @@ def ingest_tool_result(
             return
 
         self._track_session_symbols(arguments, result)
+        self._note_model_write(tool_name, arguments, payload)
         if tool_name in _ANALYSIS_TOOLS:
             self._ingest_analysis_result(tool_name, arguments, payload, call_id)
         if tool_name == _RESOLVER_TOOL:
             self._ingest_resolution(arguments, payload, call_id)
         elif tool_name == "get_market_data":
             self._ingest_market_data(arguments, payload, call_id)
+        elif tool_name == "read_file" and payload is not None:
+            self._ingest_engine_table(payload, call_id)
         elif payload is not None:
             self._ingest_generic_numeric(tool_name, arguments, payload, call_id)
         self.persist()
```

**File**: `agent/src/agent/grounding/policies.py` (modified, +260/-39)
```diff
@@ -10,7 +10,9 @@
 import ast
 import json
 import math
+import os
 from dataclasses import dataclass, field
+from pathlib import Path
 from typing import Any, Callable, Iterable, Mapping, Sequence
 
 from src.agent.grounding.identity import (
@@ -522,6 +524,11 @@ def _validate_figures(
             if declaration is None:
                 found = self._check_observed(figure, None, symbol, records)
                 if block.present and found:
+                    # Declared, but as a fraction where the answer writes a
+                    # percent (or the reverse): still undeclared, since the
+                    # two are different assertions — but say so, or the model
+                    # reads "not declared" as a lie and repeats the draft.
+                    other_unit = _declared_in_other_unit(block, figure)
                     issues.append(
                         self._figure_issue(
                             "figure_undeclared",
@@ -532,6 +539,7 @@ def _validate_figures(
                             "is not declared in the figures block and is not an observed "
                             "value; declare it as observed / derived / proposed / cited / "
                             "count, or remove it",
+                            **({"declared_as": other_unit.value_text} if other_unit else {}),
                         )
                     )
                     continue
@@ -663,6 +671,10 @@ def _written_symbol(
         then its line; the whole-answer fallback is left to the caller.
         """
         if figure.symbol:
+            # "000001.SZ 平安银行": the cell names its instrument beside a name.
+            written = _scan_symbols(figure.symbol)
+            if len(written) == 1:
+                return next(iter(written))
             normalized = _normalize_symbol(figure.symbol)
             if normalized:
                 return normalized
@@ -679,51 +691,65 @@ def _referenced(
         ref: str,
         symbol: str | None,
         figure: Figure | None,
+        *,
+        pool_ambiguous: bool = False,
     ) -> tuple[list[EvidenceRecord], list[float]] | None:
         """The evidence named by an exact field, call+field, one call, or one tool.
 
         An exact evidence-field ref is accepted only when that field occurs in
         one call. When it repeats across calls, ``call_id::field`` is the
         unambiguous tightest scope. Otherwise a ``ref`` naming a call id or a
         tool name keeps the existing call/tool scope, and the only one that can
-        ground a non-price figure (revenue, IC, volume). Records of another
-        symbol are dropped when the figure's symbol is known; a currency-marked
-        figure keeps only money-denominated records, a percent only the others,
-        less metadata counts.
+        ground a non-price figure (revenue, IC, volume). A backtest's output is
+        also named by its run directory or file (:meth:`_artifact_scope`).
+        Records of another symbol are dropped when the figure's symbol is
+        known; a currency-marked figure keeps only money-denominated records, a
+        percent only the others, less metadata counts.
 
         Args:
             ref: The declaration's ``ref``.
             symbol: The figure's resolved symbol, or None.
             figure: The figure whose shape narrows the kind, or None for the
                 operands of a derivation.
+            pool_ambiguous: Pool a field ref's sources even when they disagree.
+                Only a derivation's anchors ask for it: an operand from either
+                run is still an observation.
 
         Returns:
             ``(records, metric values)``, or None when ``ref`` names no field,
-            call, or tool.
+            call, tool, or backtest output.
         """
         key = (ref or "").strip()
         if not key:
             return None
 
-        # A composite ref names one exact field from one exact call. This is
-        # the unambiguous form 
```

**File**: `agent/src/agent/grounding/release.py` (modified, +39/-3)
```diff
@@ -122,6 +122,12 @@ def _correction_line(issue: dict[str, Any]) -> str:
         sources=", ".join(str(source) for source in issue.get("ambiguous_sources") or []),
         result=result if result else "a different value",
     )
+    declared_as = issue.get("declared_as")
+    if declared_as:
+        evidence += (
+            f"; the figures block declares {declared_as}, which is not how the answer "
+            f"writes it — declare it exactly as written ({issue.get('value')})"
+        )
     candidates = issue.get("field_ref_candidates") or []
     if candidates:
         evidence += "; valid field refs: " + ", ".join(str(item) for item in candidates)
@@ -212,6 +218,16 @@ def correction_prompt(self, validation: ValidationResult) -> str:
                 "report it as not retrieved instead.",
             ]
         )
+        if self._backtest_scopes:
+            runs = ", ".join(f"`{scope}`" for scope in sorted(set(self._backtest_scopes.values())) if scope)
+            lines.append(
+                "A value a backtest wrote is observed with that backtest's run directory "
+                "as ref"
+                + (f" ({runs})" if runs else "")
+                + ", or the file you read under it; a difference between two backtests "
+                "is derived, with both run directories as ref. A figure the answer writes "
+                "as a percent is declared as a percent."
+            )
         recovery = self.recovery_action(validation)
         if recovery == _RESOLVER_TOOL:
             lines.extend(
@@ -334,7 +350,7 @@ def safe_fallback(self) -> str:
             for validation in self._validations
             for code in (issue.get("code") for issue in validation.get("issues", []))
         }
-        if issue_codes & _REDACTABLE_CODES:
+        if issue_codes & _REDACTABLE_CODES and not self._analysis_completed:
             if is_zh:
                 return (
                     "我的回答被安全门槛拒绝:草稿引用了本会话未通过工具获取的价格数字,无法核验。"
@@ -346,6 +362,23 @@ def safe_fallback(self) -> str:
                 "be verified. Re-run the task and let the agent fetch the market data first, "
                 "or ask it to answer without the unverified prices."
             )
+        if issue_codes & _REDACTABLE_CODES:
+            # A completed analysis whose report failed the check: the draft's
+            # figures, not prices, are what failed, and the run's output is
+            # not lost with it.
+            if is_zh:
+                return (
+                    "我的回答没有通过数字核验：草稿里有数字无法与本会话工具返回的结果对上，"
+                    "按规则没有发布。分析本身已经完成，结果文件保存在本次运行的 artifacts "
+                    "目录中。可以重试，或让我只列出工具直接返回的数字。"
+                )
+            return (
+                "My answer did not pass the figure check: some of its figures could not be "
+                "matched to what this session's tools returned, so it was not released. "
+                "The analysis itself completed; its result files are in this run's "
+                "artifacts directory. Retry, or ask me to list only the figures the tools "
+                "returned."
+            )
         if is_zh:
             return (
                 "当前无法安全确认标的身份或价格证据，因此没有生成交易结论。"
@@ -491,8 +524,11 @@ def redacted_release(self, content: str, validation: ValidationResult) -> str |
             with a note stating how many figures were removed, or None.
         """
         # A market answer with no observed price has nothing to stand on once its
-        # figures are cut; a general answer (no instrument asked about) does.
-        if self._identity_required and not self._price_records():
+        # figures are cut; a general answer (no instrument asked about) does, and
+        # so does a completed analysis: naming 600519.SH in a backtest request
+        # makes it a market answer, but the backtest's own output is what the
+        # surviving figures were checked against.
+        if self._identity_required and not self._price_records() and not sel
```

---

### Incident Patch 7: `bfd89c59` (2026-09-29)
**Commit Message**: fix(mcp): remove redundant payload copies before agent-context consumption

A structured MCP result was serialized into the agent context up to four
times: data, structured_content, a text block mirroring it in content, and
the joined text. Drop only the provably equivalent copies in
MCPRemoteTool.execute; MCPServerAdapter.call_tool keeps every surface for
programmatic callers (trading connectors). Distinct content blocks, blocks
with metadata, non-matching structured_content and error payloads are kept.

Signed-off-by: zeus229 <69399886+zeus229@users.noreply.github.com>

**File**: `agent/src/tools/mcp.py` (modified, +74/-0)
```diff
@@ -870,6 +870,7 @@ def execute(self, **kwargs: Any) -> str:
             self._filter_arguments(kwargs),
             local_name=self.name,
         )
+        payload = compact_result_for_agent(payload)
         return json.dumps(payload, ensure_ascii=False, default=_json_default)
 
     def _filter_arguments(self, arguments: dict[str, Any]) -> dict[str, Any]:
@@ -1250,6 +1251,79 @@ def _is_wrapped_fastmcp_result(
     )
 
 
+def compact_result_for_agent(payload: dict[str, Any]) -> dict[str, Any]:
+    """Drop redundant copies of one MCP result before it reaches the agent.
+
+    ``_normalize_call_tool_result`` keeps every surface programmatic callers of
+    ``MCPServerAdapter.call_tool`` may read, so a structured result is carried
+    up to four times: ``data``, ``structured_content``, a text block mirroring
+    it in ``content`` and the joined ``text``. Serialized into the agent
+    context that multiplies one payload several times over.
+
+    Only exact mirrors of ``data`` are removed, and only when ``data`` exists:
+    a ``structured_content`` equal to it, bare text blocks whose JSON equals
+    it, and the ``text`` join once a mirror block it embeds is gone. Text-only
+    results, distinct or metadata-bearing blocks, unrelated ``structured_content``
+    and error payloads are returned unchanged. ``payload`` is never mutated.
+
+    Args:
+        payload: Normalized result from ``MCPServerAdapter.call_tool``.
+
+    Returns:
+        Payload without the redundant copies.
+    """
+    if payload.get("status") != "ok" or "data" not in payload:
+        return payload
+
+    compact = dict(payload)
+    data = compact["data"]
+    structured = compact.get("structured_content")
+    if structured is not None and (
+        _same_json(structured, data) or _same_json(structured, {"result": data})
+    ):
+        del compact["structured_content"]
+
+    blocks = compact.get("content")
+    if isinstance(blocks, list):
+        kept = [block for block in blocks if not _is_mirror_text_block(block, data)]
+        if len(kept) != len(blocks):
+            if kept:
+                compact["content"] = kept
+            else:
+                del compact["content"]
+            # ``text`` is the join of the original text blocks, so it embeds the
+            # removed mirror; drop it only when it is exactly that derived join.
+            if compact.get("text") == _extract_text_content(blocks):
+                del compact["text"]
+    return compact
+
+
+def _same_json(left: Any, right: Any) -> bool:
+    """Compare JSON values strictly (``1`` is not ``True``, key order ignored)."""
+    try:
+        return json.dumps(left, sort_keys=True) == json.dumps(right, sort_keys=True)
+    except (TypeError, ValueError):
+        return False
+
+
+def _is_mirror_text_block(block: Any, data: Any) -> bool:
+    """Return whether ``block`` is a bare text block that only restates ``data``."""
+    if not isinstance(block, dict) or block.get("type") != "text":
+        return False
+    text = block.get("text")
+    if not isinstance(text, str):
+        return False
+    if any(value is not None for key, value in block.items() if key not in ("type", "text")):
+        return False
+    if isinstance(data, str) and text == data:
+        return True
+    try:
+        parsed = json.loads(text)
+    except ValueError:
+        return False
+    return _same_json(parsed, data) or _same_json(parsed, {"result": data})
+
+
 def _extract_result_error(result: CallToolResult) -> str:
     """Extract a readable error message from a failed MCP result.
 
```

**File**: `agent/tests/test_mcp_client_adapter.py` (modified, +4/-3)
```diff
@@ -426,7 +426,8 @@ def get_portfolio() -> _RobinhoodPortfolio:
 
     assert payload["status"] == "ok"
     assert payload["data"] == structured_portfolio
-    assert payload["structured_content"] == structured_portfolio
+    # The agent-facing result carries the value once; ``call_tool`` keeps both.
+    assert "structured_content" not in payload
 
 
 @pytest.mark.parametrize(
@@ -461,7 +462,7 @@ def test_fastmcp_wrapped_results_keep_unwrapped_data_shape(
     )
 
     assert payload["data"] == expected
-    assert payload["structured_content"] == structured
+    assert "structured_content" not in payload
 
 
 @dataclass
@@ -487,7 +488,7 @@ def test_structured_content_remains_available_when_fastmcp_hydration_fails() ->
 
     assert payload["status"] == "ok"
     assert payload["data"] == structured
-    assert payload["structured_content"] == structured
+    assert "structured_content" not in payload
 
 
 class _OrderState(Enum):
```

**File**: `agent/tests/test_mcp_result_dedup.py` (added, +346/-0)
```diff
@@ -0,0 +1,346 @@
+"""Agent-facing MCP results must not carry the same payload several times."""
+
+from __future__ import annotations
+
+import json
+from typing import Any
+
+from fastmcp import Client, FastMCP
+from fastmcp.client.client import CallToolResult
+from mcp import types as mcp_types
+
+from src.config.schema import MCPServerConfig
+from src.tools.mcp import (
+    MCPServerAdapter,
+    build_mcp_tool_wrappers,
+    compact_result_for_agent,
+)
+
+
+def _metrics(count: int) -> dict[str, Any]:
+    return {"metrics": [{"name": f"metric_{i:03d}", "value": round(1.23 + i, 2)} for i in range(count)]}
+
+
+def _tool_for(server: FastMCP, name: str):
+    return build_mcp_tool_wrappers(
+        "synth",
+        MCPServerConfig(command="x", enabled_tools=[name]),
+        client_factory=lambda: Client(server),
+    )[0]
+
+
+def _structured_server(count: int) -> FastMCP:
+    server = FastMCP("synthetic")
+
+    @server.tool
+    def get_metrics() -> dict:
+        return _metrics(count)
+
+    return server
+
+
+def _leaves(value: Any, path: str = "") -> dict[str, Any]:
+    if isinstance(value, dict):
+        out: dict[str, Any] = {}
+        for key, item in value.items():
+            out.update(_leaves(item, f"{path}.{key}" if path else key))
+        return out
+    if isinstance(value, list):
+        out = {}
+        for index, item in enumerate(value):
+            out.update(_leaves(item, f"{path}[{index}]"))
+        return out
+    return {path: value}
+
+
+def test_structured_result_reaches_agent_once() -> None:
+    tool = _tool_for(_structured_server(200), "get_metrics")
+    raw = tool.execute()
+    payload = json.loads(raw)
+
+    assert raw.count("metric_000") == 1
+    assert payload["data"] == _metrics(200)
+    for redundant in ("structured_content", "content", "text"):
+        assert redundant not in payload
+    assert payload["status"] == "ok"
+    assert payload["server"] == "synth"
+    assert payload["remote_tool"] == "get_metrics"
+    assert payload["tool"] == tool.name
+    # One canonical copy plus a small envelope, not 4x the payload.
+    assert len(raw) < len(json.dumps(_metrics(200), separators=(",", ":"))) * 1.25
+
+
+def test_adapter_call_tool_keeps_every_surface_for_programmatic_callers() -> None:
+    server = _structured_server(5)
+    adapter = MCPServerAdapter("synth", MCPServerConfig(command="x"), client_factory=lambda: Client(server))
+    payload = adapter.call_tool("get_metrics", {})
+
+    assert payload["data"] == _metrics(5)
+    assert payload["structured_content"] == _metrics(5)
+    assert payload["content"][0]["text"]
+    assert payload["text"]
+
+
+def test_grounding_numeric_leaves_are_still_observable_under_data() -> None:
+    payload = json.loads(_tool_for(_structured_server(50), "get_metrics").execute())
+    leaves = _leaves(payload)
+
+    assert leaves["data.metrics[0].value"] == 1.23
+    assert leaves["data.metrics[49].value"] == 50.23
+    assert sum(isinstance(v, (int, float)) for v in leaves.values()) == 50
+
+
+def test_wrapped_string_tool_result_is_carried_once() -> None:
+    server = FastMCP("synthetic")
+
+    @server.tool
+    def say() -> str:
+        return "plain words"
+
+    raw = _tool_for(server, "say").execute()
+
+    assert json.loads(raw)["data"] == "plain words"
+    assert raw.count("plain words") == 1
+
+
+def _ok(**fields: Any) -> dict[str, Any]:
+    return {"status": "ok", "server": "s", "remote_tool": "t", "tool": "t", **fields}
+
+
+def test_text_only_payload_is_returned_unchanged() -> None:
+    payload = _ok(content=[{"type": "text", "text": "hello"}], text="hello")
+
+    assert compact_result_for_agent(payload) is payload
+
+
+def test_text_only_json_lookalike_without_data_is_not_touched() -> None:
+    payload = _ok(content=[{"type": "text", "text": '{"a": 1}'}], text='{"a": 1}')
+
+    assert compact_result_for_agent(payload) == payload
+
+
+def test_text_only_end_to_end_keeps_content_and_text() -> None:
+    fake = 
```

---

### Incident Patch 8: `ef2a1e0e` (2026-09-29)
**Commit Message**: fix(agent): size context compaction to the model's real window

A user on gpt-6-sol saw "failed · 0 steps · no_progress" for a risk-parity
backtest and a 12-company comparison. Reproduced on v0.1.15 with
deepseek-v4-pro: layer 1 fired from iteration 3 (the system prompt alone
estimates ~12.5K of the fixed 20K trigger), cleared every tool result but the
last three, and the run re-fetched the same filings 4-5 times each until
no_progress at iteration 16. Raising the threshold alone took re-fetches from
54 to 0 across 8 runs.

- Compaction budget: window from VIBE_TRADING_CONTEXT_WINDOW > limit learned
  from a context-length error > context_windows.json (sourced: Codex models
  272K, deepseek-v4-pro/flash 1M) > 128K default; capped by
  VIBE_TRADING_CONTEXT_MAX_TOKENS (200K); measured in real input tokens.
  Layer 1 clears oldest-first only back to its line. A context-length error
  compacts and retries once. TOKEN_THRESHOLD is deprecated and ignored.
- No-progress limits are unchanged; the stop message now names the tool,
  reason and count instead of one fixed compaction-era sentence.
- Failed and cancelled attempts keep their tool trail (history said 0 steps).
- Codex: mid-run sys

**File**: `agent/.env.example` (modified, +10/-1)
```diff
@@ -323,7 +323,16 @@ TUSHARE_TOKEN=your-tushare-token
 # SWARM_STREAM_RETRY_MAX_DELAY_S=30.0
 # SUBAGENT_TIMEOUT=300
 # SUBAGENT_MAX_ITER=25
-# TOKEN_THRESHOLD=40000
+# Context compaction follows the model's real context window
+# (agent/src/providers/context_windows.json; unknown models 128000, and a
+# provider's context-length error teaches the real limit mid-run).
+# Override the window only if the catalog is wrong for your model:
+# VIBE_TRADING_CONTEXT_WINDOW=272000
+# Cost ceiling on how large a run's prompt may grow before it is compacted,
+# whatever the window (real tokens):
+# VIBE_TRADING_CONTEXT_MAX_TOKENS=200000
+# TOKEN_THRESHOLD is deprecated and ignored (it counted chars/4 of the messages
+# without tool schemas); remove it from your .env.
 # Hard timeout (seconds) for read-only tool execution; write tools only warn.
 # Default 1800; set 0 to disable.
 # VIBE_TRADING_TOOL_TIMEOUT_SECONDS=1800
```

**File**: `agent/cli/_legacy.py` (modified, +1/-1)
```diff
@@ -5899,7 +5899,7 @@ def _handle_prompt_command(
         "key_env": None,
         "base_env": "OPENAI_CODEX_BASE_URL",
         "base_url": "https://chatgpt.com/backend-api/codex/responses",
-        "model": "openai-codex/gpt-5.4",
+        "model": "openai-codex/gpt-6-sol",
         "key_prefix": None,
         "key_placeholder": None,
     },
```

**File**: `agent/cli/onboard.py` (modified, +2/-2)
```diff
@@ -66,9 +66,9 @@ class Provider:
              "https://api.anthropic.com", None,
              ("claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5")),
     Provider("openai-codex", "OpenAI Codex", "ChatGPT OAuth for Codex",
-             "openai-codex/gpt-5.4", None, "OPENAI_CODEX_BASE_URL",
+             "openai-codex/gpt-6-sol", None, "OPENAI_CODEX_BASE_URL",
              "https://chatgpt.com/backend-api/codex/responses", None,
-             ("openai-codex/gpt-5.4", "openai-codex/gpt-5.4-mini")),
+             ("openai-codex/gpt-6-sol", "openai-codex/gpt-6-astra", "openai-codex/gpt-6-luna")),
     Provider("deepseek", "DeepSeek",
              "cheapest tier — good for batch backtest research",
              "deepseek-v4-pro", "DEEPSEEK_API_KEY", "DEEPSEEK_BASE_URL",
```

**File**: `agent/src/agent/context.py` (modified, +6/-0)
```diff
@@ -426,6 +426,7 @@ def format_assistant_tool_calls(
         tool_calls: list,
         content: Optional[str] = None,
         reasoning_content: Optional[str] = None,
+        provider_items: Optional[list] = None,
     ) -> Dict[str, Any]:
         """Format an assistant tool_calls message, preserving thinking text.
 
@@ -436,6 +437,9 @@ def format_assistant_tool_calls(
             reasoning_content: Provider-specific reasoning field (Kimi K2.5,
                 DeepSeek reasoner, Qwen thinking). Only attached to the output
                 message when not None, so non-thinking providers see no change.
+            provider_items: Opaque items the provider must receive back verbatim
+                with this turn (Codex encrypted reasoning). Attached only when
+                non-empty; only the adapter that produced them reads them.
 
         Returns:
             OpenAI-format assistant message.
@@ -468,4 +472,6 @@ def format_assistant_tool_calls(
             }
         if reasoning_content is not None:
             message["reasoning_content"] = reasoning_content
+        if provider_items:
+            message["provider_items"] = list(provider_items)
         return message
```

**File**: `agent/src/agent/context_budget.py` (added, +203/-0)
```diff
@@ -0,0 +1,203 @@
+"""Size context compaction from the model's real window and real token usage.
+
+Compaction used to trigger at a fixed 40K *estimated* tokens (``chars / 4`` of
+the messages, tool schemas excluded), with layer 1 clearing every tool result
+but the last three once the estimate passed 20K. The system prompt alone
+estimates at ~12.5K, so a cross-sectional question (a dozen companies' filings)
+lost its evidence from the third iteration on, re-fetched it, got byte-identical
+results and ended in ``no_progress``. gpt-6-sol has a 272K window and
+deepseek-v4-pro 1M; the old budget used a few percent of either.
+
+The budget here is the model's window (env override > limit learned from a
+context-length error > ``context_windows.json`` > default), capped for cost,
+minus the prompt's static part (system prompt + tool schemas). Layers 1-3 fire
+at fixed fractions of what remains for the conversation.
+"""
+
+from __future__ import annotations
+
+import json
+import logging
+import os
+import re
+from dataclasses import dataclass
+from functools import lru_cache
+from pathlib import Path
+from typing import Any, Callable, Optional
+
+logger = logging.getLogger(__name__)
+
+_CATALOG_PATH = Path(__file__).resolve().parents[1] / "providers" / "context_windows.json"
+
+#: Share of the window a prompt may use; the rest is left for the reply,
+#: reasoning tokens and the error of estimating growth between calls.
+USABLE_FRACTION = 0.8
+#: Layer 1 (clear old tool results, oldest first, only back down to this line)
+#: and layer 2 (fold long text) start at these shares of the conversation
+#: budget; layer 3 (summary) at all of it. Calibrated so the largest healthy
+#: run measured on 2026-09-29 (154K real input, ~48K of it static) loses
+#: nothing: with the 200K cost cap, layer 1 starts at ~170K.
+MICRO_FRACTION = 0.8
+COLLAPSE_FRACTION = 0.9
+#: Floor for the conversation budget when the static prompt nearly fills the
+#: window, so a tiny window still compacts instead of computing a negative.
+MIN_CONVERSATION_TOKENS = 8_000
+
+_LIMIT_RE = re.compile(
+    r"(?:maximum context length|context length|context window|token limit|maximum of)"
+    r"\D{0,40}?(\d[\d,]{3,})",
+    re.IGNORECASE,
+)
+_warned_token_threshold = False
+
+
+@lru_cache(maxsize=1)
+def _catalog() -> dict[str, Any]:
+    return json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
+
+
+def estimate_tokens(value: Any) -> int:
+    """Rough token count (~4 chars/token) of any JSON-serialisable value."""
+    return len(json.dumps(value, default=str, ensure_ascii=False)) // 4
+
+
+def resolve_window(
+    provider: str,
+    model: str,
+    *,
+    env_window: Optional[int] = None,
+    learned_window: Optional[int] = None,
+) -> tuple[int, str]:
+    """Return the model's context window and where the number came from.
+
+    Args:
+        provider: Canonical provider name (``openai-codex``, ``deepseek`` ...).
+        model: Model name as configured.
+        env_window: ``VIBE_TRADING_CONTEXT_WINDOW``, when set.
+        learned_window: Limit read from a context-length error in this run.
+
+    Returns:
+        ``(window_tokens, source)``.
+    """
+    _warn_deprecated_token_threshold()
+    if env_window:
+        return int(env_window), "env:VIBE_TRADING_CONTEXT_WINDOW"
+    if learned_window:
+        return int(learned_window), "learned:context_length_error"
+    catalog = _catalog()
+    provider = (provider or "").strip().lower()
+    model = (model or "").strip()
+    for entry in catalog["models"]:
+        if entry.get("provider") and entry["provider"] != provider:
+            continue
+        if re.search(entry["pattern"], model, re.IGNORECASE):
+            return int(entry["window"]), f"catalog:{entry['pattern']}"
+    return int(catalog["default_window"]), "default"
+
+
+def _warn_deprecated_token_threshold() -> None:
+    global _warned_token_threshold
+    if _warned_token_threshold or "TOKEN_THRESHOLD" not in os.environ:
+        
```

---

### Incident Patch 9: `a71d5312` (2026-09-28)
**Commit Message**: fix: harden free market data failure handling

**File**: `agent/backtest/loader_health.py` (modified, +5/-2)
```diff
@@ -33,8 +33,11 @@
     "stooq": "AAPL.US",
     "tencent": "601398.SH",
     "wallex": "BTC-TMN",
-    "yahoo": "AAPL",
-    "yfinance": "AAPL",
+    # These loaders require the project's explicit US suffix; using bare
+    # ``AAPL`` here made the canary report empty data while real ``AAPL.US``
+    # requests were healthy.
+    "yahoo": "AAPL.US",
+    "yfinance": "AAPL.US",
 }
 EXCLUDED_PUBLIC_SOURCES = {"local": "operator files, not a public endpoint"}
 DEPENDENCIES = {
```

**File**: `agent/backtest/runner.py` (modified, +48/-41)
```diff
@@ -1728,8 +1728,10 @@ def _fetch_auto(codes: List[str], config: dict, interval: str = "1D") -> dict:
                 )
 
         if missing:
+            served = sorted(set(merged) - set(missing))
             raise NoAvailableSourceError(
-                f"incomplete data for {market}; missing symbols: {missing}"
+                f"incomplete data for {market}; missing symbols: {missing}; "
+                f"served symbols: {served}"
             )
         merged.update(market_result)
 
@@ -1848,51 +1850,56 @@ def fetch_data_map(config: dict) -> DataFetchResult:
         # lines as a trace. Callers want snapshot provenance, not a padded row
         # count.
         if missing and not is_no_network_fallback_source(primary_source):
-            market = _detect_market(codes[0])
-            for fallback_source in FALLBACK_CHAINS.get(market, []):
-                if not missing:
-                    break
-                if (
-                    fallback_source == primary_source
-                    or fallback_source not in LOADER_REGISTRY
-                ):
-                    continue
-                fallback_loader = LOADER_REGISTRY[fallback_source]()
-                if not fallback_loader.is_available():
-                    continue
-                fallback_codes = _normalize_codes(missing, fallback_source)
-                fallback_result = fallback_loader.fetch(
-                    fallback_codes,
-                    config.get("start_date", ""),
-                    config.get("end_date", ""),
-                    interval=interval,
-                )
-                mapped = _restore_original_codes(
-                    fallback_result, missing, fallback_codes
-                )
-                if mapped:
-                    data_map.update(mapped)
-                    missing = [code for code in missing if code not in mapped]
-                    fb_served_by = str(
-                        getattr(fallback_loader, "name", fallback_source)
-                        or fallback_source
+            missing_by_market: dict[str, list[str]] = {}
+            for code in missing:
+                missing_by_market.setdefault(_detect_market(code), []).append(code)
+            for market, market_missing in missing_by_market.items():
+                for fallback_source in FALLBACK_CHAINS.get(market, []):
+                    if not market_missing:
+                        break
+                    if (
+                        fallback_source == primary_source
+                        or fallback_source not in LOADER_REGISTRY
+                    ):
+                        continue
+                    fallback_loader = LOADER_REGISTRY[fallback_source]()
+                    if not fallback_loader.is_available():
+                        continue
+                    fallback_codes = _normalize_codes(market_missing, fallback_source)
+                    fallback_result = fallback_loader.fetch(
+                        fallback_codes,
+                        config.get("start_date", ""),
+                        config.get("end_date", ""),
+                        interval=interval,
                     )
-                    for code in mapped:
-                        caliber_stamps[code] = (
-                            fb_served_by,
-                            price_caliber(fb_served_by, _detect_market(code), code),
-                        )
-                    if not used_sources:
-                        source = fb_served_by
-                        loader = fallback_loader
-                    used_sources.append(fb_served_by)
-                    logger.info(
-                        "Runtime fallback: %s -> %s", primary_source, fb_served_by
+                    mapped = _restore_original_codes(
+                        fallback_result, market_missing, fallback_codes
                     )
+                    if mapped:
+                        data_map.update(mapped)
+                     
```

**File**: `agent/src/tools/market_data_tool.py` (modified, +12/-0)
```diff
@@ -191,6 +191,18 @@ def execute(self, **kwargs: Any) -> str:
         source = kwargs.get("source", "auto")
         if source not in _SOURCE_ENUM:
             return _error(f"source must be one of {_SOURCE_ENUM}")
+        if source == "auto":
+            bare_us = [
+                code for code in codes
+                if re.fullmatch(r"[A-Za-z][A-Za-z0-9.\-]*", code)
+                and "." not in code
+                and "-" not in code
+            ]
+            if bare_us:
+                return _error(
+                    "US equity symbols must include the .US suffix, "
+                    f"for example AAPL.US; received {bare_us}"
+                )
 
         interval = kwargs.get("interval", "1D")
         if not isinstance(interval, str):
```

---

### Incident Patch 10: `18988fbe` (2026-09-28)
**Commit Message**: fix: honor backtest timeout and preserve timeout logs

**File**: `agent/src/tools/backtest_tool.py` (modified, +56/-5)
```diff
@@ -5,15 +5,59 @@
 import json
 import subprocess
 from pathlib import Path
+from typing import Any
 
 from backtest.loaders.registry import VALID_SOURCES
 from src.agent.progress import emit_progress
 from src.agent.tools import BaseTool
+from src.config.accessor import get_env_config
 from src.core.runner import Runner
 from src.core.state import RunStateStore
 from src.tools.path_utils import safe_run_dir
 
 
+def _backtest_timeout_seconds() -> float | None:
+    """Return the configured backtest subprocess timeout.
+
+    The backtest is a write-style tool, so the agent-loop timeout does not
+    cancel it.  The subprocess still needs its own bound, which follows the
+    same ``VIBE_TRADING_TOOL_TIMEOUT_SECONDS`` setting used by the loop.  A
+    non-positive value keeps the historical "disabled" semantics.
+
+    Returns:
+        Positive timeout in seconds, or ``None`` to disable the bound.
+    """
+    configured = float(get_env_config().agent_tuning.vibe_trading_tool_timeout_seconds)
+    return configured if configured > 0 else None
+
+
+def _timeout_output(value: Any) -> str:
+    """Normalize ``TimeoutExpired`` output for persistence and JSON."""
+    if value is None:
+        return ""
+    if isinstance(value, bytes):
+        return value.decode("utf-8", errors="replace")
+    return str(value)
+
+
+def _persist_timeout_output(run_path: Path, exc: subprocess.TimeoutExpired) -> dict[str, str]:
+    """Persist partial subprocess output after a timeout.
+
+    ``subprocess.run`` exposes captured output on ``TimeoutExpired`` when pipes
+    are used.  Preserve it before returning so a timed-out run remains
+    diagnosable instead of appearing to have produced nothing.
+    """
+    output = {
+        "stdout": _timeout_output(getattr(exc, "stdout", None)),
+        "stderr": _timeout_output(getattr(exc, "stderr", None)),
+    }
+    log_dir = run_path / "logs"
+    log_dir.mkdir(parents=True, exist_ok=True)
+    (log_dir / "runner_stdout.txt").write_text(output["stdout"], encoding="utf-8")
+    (log_dir / "runner_stderr.txt").write_text(output["stderr"], encoding="utf-8")
+    return output
+
+
 def run_backtest(run_dir: str) -> str:
     """Run backtest: validate config.json + signal_engine.py, invoke built-in engine.
 
@@ -70,25 +114,32 @@ def run_backtest(run_dir: str) -> str:
         "simulate",
         message=f"running backtest engine (source={source})",
     )
-    runner = Runner(timeout=300)
+    runner = Runner(timeout=_backtest_timeout_seconds())
     try:
         result = runner.execute(
             entry_script,
             run_path,
             cwd=agent_root,
             cli_args=[str(run_path)],
         )
-    except subprocess.TimeoutExpired:
+    except subprocess.TimeoutExpired as exc:
         # The lifecycle block below is unreachable on a timeout, so record the
         # failure here — otherwise the run is indistinguishable from never-run
         # (the evidence gate fail-closes either way, but the reason is lost).
-        reason = f"backtest engine timed out after {runner.timeout}s"
+        timeout_output = _persist_timeout_output(run_path, exc)
+        timeout_label = f"{runner.timeout}s" if runner.timeout is not None else "the configured limit"
+        reason = f"backtest engine timed out after {timeout_label}"
         RunStateStore().mark_failure(run_path, reason)
-        return json.dumps({
+        response = {
             "status": "error",
             "error": reason,
             "run_dir": run_dir,
-        }, ensure_ascii=False)
+        }
+        if timeout_output["stdout"]:
+            response["stdout"] = timeout_output["stdout"][-2000:]
+        if timeout_output["stderr"]:
+            response["stderr"] = timeout_output["stderr"][-2000:]
+        return json.dumps(response, ensure_ascii=False)
 
     # Record lifecycle status so tool-driven runs are ingestible by the
     # evidence pipeline: refresh_strategy_evidence fail-closes without
```

**File**: `agent/tests/test_backtest_tool_state.py` (modified, +24/-0)
```diff
@@ -102,3 +102,27 @@ def test_timeout_records_state_failed_and_returns_error_envelope(tool_run_dir):
     assert envelope["error"] == "backtest engine timed out after 300s"
     state = json.loads((tool_run_dir / "state.json").read_text(encoding="utf-8"))
     assert state == {"status": "failed", "reason": "backtest engine timed out after 300s"}
+
+
+def test_backtest_uses_configured_tool_timeout(tool_run_dir, monkeypatch):
+    monkeypatch.setenv("VIBE_TRADING_TOOL_TIMEOUT_SECONDS", "42")
+    with patch("src.tools.backtest_tool.emit_progress"), patch("src.tools.backtest_tool.Runner") as runner_cls:
+        runner_cls.return_value.execute.return_value = _FakeRunResult(success=True, exit_code=0)
+        run_backtest(str(tool_run_dir))
+
+    assert runner_cls.call_args.kwargs == {"timeout": 42.0}
+
+
+def test_timeout_persists_partial_runner_output(tool_run_dir):
+    timeout = subprocess.TimeoutExpired(
+        cmd="runner.py", timeout=300, output="partial stdout", stderr="partial stderr"
+    )
+    with patch("src.tools.backtest_tool.emit_progress"), patch("src.tools.backtest_tool.Runner") as runner_cls:
+        runner_cls.return_value.timeout = 300
+        runner_cls.return_value.execute.side_effect = timeout
+        envelope = json.loads(run_backtest(str(tool_run_dir)))
+
+    assert envelope["stdout"] == "partial stdout"
+    assert envelope["stderr"] == "partial stderr"
+    assert (tool_run_dir / "logs" / "runner_stdout.txt").read_text() == "partial stdout"
+    assert (tool_run_dir / "logs" / "runner_stderr.txt").read_text() == "partial stderr"
```

#### Recent Merged Pull Requests:
- **PR #1637** (2026-09-30): fix(loaders): make the stooq challenge latch stop probing, not just logging (@cgycorey)
- **PR #1636** (2026-09-30): refactor(agent): extract tool-result helpers from loop.py into tool_results module (@Jackzigen)
- **PR #1634** (2026-09-30): fix(mcp): remove redundant payload copies before agent context (@zeus229)
- **PR #1629** (2026-09-28): feat(trading): broker capability matrix generated into README (@he-yufeng)
- **PR #1627** (2026-09-28): feat(loaders): weekly live-source health canary (@he-yufeng)
- **PR #1620** (closed): fix(providers): bound the gh-CLI Copilot token cache to 60s (@he-yufeng)
- **PR #1619** (2026-09-28): fix(providers): refresh expired Copilot CLI token (@lorenzozanee)
- **PR #1615** (2026-09-28): fix(loaders): bound baostock socket IO with a per-read deadline (@he-yufeng)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

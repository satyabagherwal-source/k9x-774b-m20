# Forensic Learning Record (Deep Inspection): gptme/gptme

> **Canonical Artifact**: `07_PROJECT_LEARNING/gptme-gptme-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/gptme/gptme](https://github.com/gptme/gptme))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-05T18:41:13.452Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `gptme/gptme`
- **Description**: Your agent in your terminal, equipped with local tools: writes code, uses the terminal, browses the web. Make your own persistent autonomous agent on top!
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 4444 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `gptme/cli/cmd_hooks.py`
```
"""CLI commands for Claude Code hook installation and execution.

Provides `gptme-util hooks` subcommands for integrating gptme's lesson system
with Claude Code via hooks.

Subcommands:
- ``install``: Register gptme lesson hooks in a Claude Code settings.json
- ``run``: Execute lesson matching for a CC hook event (called by CC itself)
- ``status``: Show current hook installation state
- ``uninstall``: Remove gptme hooks from a Claude Code settings.json
"""

from __future__ import annotations

import json
import logging
import re
import sys
import tempfile
import uuid
from pathlib import Path

import click

logger = logging.getLogger(__name__)

# Hook command that CC will invoke
_HOOK_COMMAND = "gptme-util hooks run"

# CC hook event types we register
_USERPROMPTSUBMIT = "UserPromptSubmit"
_PRETOOLUSE = "PreToolUse"

# Tools to match in PreToolUse (same as the existing hook)
_PRETOOLUSE_MATCHER = "Read|Bash|Grep|WebFetch|WebSearch"

# Timeout for hook execution (seconds)
_HOOK_TIMEOUT = 10

# Per-session dedup state (in tmpdir, cleared when system reboots)
_STATE_DIR = Path(tempfile.gettempdir()) / "gptme-lesson-hooks"

# Maximum lessons to inject per event
_MAX_USERPROMPTSUBMIT = 5
_MAX_PRETOOLUSE = 3

# Minimum seconds between PreToolUse lesson matches (throttle)
_PRETOOLUSE_COOLDOWN = 15


@click.group()
def hooks() -> None:
    """Integrate gptme lessons with Claude Code via hooks."""


@hooks.command("install")
@click.option(
    "--workspace",
    default=".",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    help="Workspace directory (must contain gptme.toml). "
    "Defaults to current directory.",
)
@click.option(
    "--global",
    "global_install",
    is_flag=True,
    default=False,
    help="Install into ~/.claude/settings.json instead of workspace settings.",
)
@click.option(
    "--force",
    is_flag=True,
    default=False,
    help="Overwrite existing gptme hook entries if already present.",
)
def install(workspace: Path, global_install: bool, force: bool) -> None:
    """Register gptme lesson injection hooks in a Claude Code settings.json.

    By default installs into WORKSPACE/.claude/settings.json.
    Use --global to install into ~/.claude/settings.json instead.

    After installation, Claude Code will automatically inject relevant gptme
    lessons as additionalContext when the prompt or tool inputs match lesson
    keywords.
    """
    workspace = workspace.resolve()

    if not global_install and not (workspace / "gptme.toml").exists():
        if not force:
            click.echo(
                f"⚠  No gptme.toml found in {workspace}. "
                "This workspace may not have a lessons directory.\n"
                "Continue anyway? (pass --force to skip this check)\n"
                "Hint: run from a directory containing gptme.toml, "
                "or use --global for the user-level settings.",
                err=True,
            )
            sys.exit(1)

    if global_install:
        settings_path = Path.home() / ".claude" / "settings.json"
    else:
        settings_path = workspace / ".claude" / "settings.json"

    settings_path.parent.mkdir(parents=True, exist_ok=True)

    # Load existing settings
    if settings_path.exists():
        try:
            settings: dict = json.loads(settings_path.read_text())
        except json.JSONDecodeError as e:
            click.echo(f"❌ Failed to parse {settings_path}: {e}", err=True)
            sys.exit(1)
    else:
        settings = {}

    hooks_cfg: dict = settings.setdefault("hooks", {})

    # Check if already installed (both hooks must be present to skip)
    prompt_installed = _is_hook_installed(hooks_cfg, _USERPROMPTSUBMIT)
    pretooluse_installed = _is_hook_installed(hooks_cfg, _PRETOOLUSE)
    if prompt_installed and pretooluse_installed and not force:
        click.echo(
            f"ℹ  gptme lesson hooks already present in {settings_path}.\n"
            "   Use --force to overwrite."
        )
        return

    # Build hook entries
    prompt_entry = {
        "hooks": [
            {
                "type": "command",
                "command": _HOOK_COMMAND,
                "timeout": _HOOK_TIMEOUT,
            }
        ]
    }
    pretooluse_entry = {
        "matcher": _PRETOOLUSE_MATCHER,
        "hooks": [
            {
                "type": "command",
                "command": _HOOK_COMMAND,
                "timeout": _HOOK_TIMEOUT,
            }
        ],
    }

    # Inject or replace
    _upsert_hook_entry(hooks_cfg, _USERPROMPTSUBMIT, prompt_entry, force)
    _upsert_hook_entry(hooks_cfg, _PRETOOLUSE, pretooluse_entry, force)

    settings_path.write_text(json.dumps(settings, indent=2) + "\n")

    click.echo(f"✅ gptme lesson hooks installed into {settings_path}")
    click.echo()
    click.echo("Hooks registered:")
    click.echo(f"  • UserPromptSubmit → {_HOOK_COMMAND}")
    click.echo(f"  • PreToolUse (matcher: {_PRETOOLUSE_MATCHER}) → {_HOOK_COMMAND}")
    click.echo()
    click.echo(
        "Lessons will be injected as additionalContext when your prompt or tool\n"
        "inputs match lesson keywords from your gptme workspace."
    )


@hooks.command("uninstall")
@click.option(
    "--workspace",
    default=".",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    help="Workspace directory. Defaults to current directory.",
)
@click.option(
    "--global",
    "global_install",
    is_flag=True,
    default=False,
    help="Remove from ~/.claude/settings.json.",
)
def uninstall(workspace: Path, global_install: bool) -> None:
    """Remove gptme lesson injection hooks from a Claude Code settings.json."""
    workspace = workspace.resolve()

    if global_install:
        settings_path = Path.home() / ".claude" / "settings.json"
    else:
        settings_path = workspace / ".claude" / "settings.json"

    if not settings_path.exists():
        click.echo(f"ℹ  No settings file found at {settings_path}.")
        return

    try:
        settings: dict = json.loads(settings_path.read_text())
    except json.JSONDecodeError as e:
        click.echo(f"❌ Failed to parse {settings_path}: {e}", err=True)
        sys.exit(1)

    hooks_cfg = settings.get("hooks", {})
    changed = False

    for event in (_USERPROMPTSUBMIT, _PRETOOLUSE):
        entries = hooks_cfg.get(event, [])
        new_entries = [e for e in entries if not _is_gptme_entry(e)]
        if len(new_entries) < len(entries):
            hooks_cfg[event] = new_entries
            changed = True

    if not changed:
        click.echo(f"ℹ  No gptme hooks found in {settings_path}.")
        return

    settings_path.write_text(json.dumps(settings, indent=2) + "\n")
    click.echo(f"✅ gptme lesson hooks removed from {settings_path}")


@hooks.command("status")
@click.option(
    "--workspace",
    default=".",
    type=click.Path(exists=True, file_okay=False, path_type=Path),
    help="Workspace directory. Defaults to current directory.",
)
def status(workspace: Path) -> None:
    """Show gptme hook installation status for a workspace."""
    workspace = workspace.resolve()

    paths_to_check = [
        ("workspace", workspace / ".claude" / "settings.json"),
        ("global", Path.home() / ".claude" / "settings.json"),
    ]

    for scope, settings_path in paths_to_check:
        click.echo(f"[{scope}] {settings_path}")
        hooks_cfg: dict = {}
        if not settings_path.exists():
            click.echo("  ⚪ settings.json not found")
        else:
            try:
                settings: dict = json.loads(settings_path.read_text())
                hooks_cfg = settings.get("hooks", {})
            except json.JSONDecodeError:
                click.echo("  ❌ settings.json parse error")

        for event in (_USERPROMPTSUBMIT, _PRETOOLUSE):
            installed = _is_hook_installed(hooks_cfg, event)
            mark = "✅" if installed else "⚪"
            click.echo(f"  {mark} {event}")
        click.echo()


@hooks.command("run")
@click.option(
    "--workspace",
    default=None,
    type=click.Path(file_okay=False, path_type=Path),
    help="Workspace directory (must contain gptme.toml). "
    "Overrides auto-detection from cwd. "
    "Useful for testing or when running outside the workspace.",
    envvar="GPTME_WORKSPACE",
)
def run(workspace: Path | None = None) -> None:
    """Execute gptme lesson matching for a Claude Code hook event.

    Reads the CC hook event JSON from stdin and prints an additionalContext
    response. This is the command registered in settings.json by 'hooks install'.

    Event types handled:
    - UserPromptSubmit: matches against the user's prompt text
    - PreToolUse: matches against tool name, inputs, and recent transcript

    Output JSON format:
    {"additionalContext": "...", "continue": true}

    Lessons are matched using gptme's keyword/pattern system and workspace's
    gptme.toml [lessons] dirs. Already-injected lessons are tracked per session
    to avoid duplicates.
    """
    # Suppress diagnostic output since this command must output only JSON
    from ..message import set_output_format

    set_output_format("json")

    try:
        raw = sys.stdin.read()
        if not raw.strip():
            # No input — return empty (CC may call hooks with empty stdin)
            _output_empty()
            return
        hook_input = json.loads(raw)
    except (json.JSONDecodeError, OSError) as e:
        logger.debug("Failed to parse hook input: %s", e)
        _output_empty()
        return

    if not isinstance(hook_input, dict):
        # Valid JSON but not an object (e.g. a list or scalar) — CC always
        # sends an object, so anything else is malformed. Pass through.
        logger.debug("Hook input is not a JSON object: %s", type(hook_input).__name__)
        _output_empty()
        return

    event_type = hook_input.get("hook_event_name", _USERPROMPTSUBMIT)
    # When CC omits session_id, generate a unique fallback so each
```

### Core Architecture Module: `gptme/cli/util.py`
```
"""
CLI for gptme utility commands.

Command groups are split into separate modules for maintainability:
- cmd_agents.py: Live agent scanning (scan for gptme/claude/codex/… processes)
- cmd_chats.py: Chat/conversation management (list, search, export, clean, stats)
- cmd_computer.py: Computer-use tooling (audit-log extracts actions from trajectories)
- cmd_explain.py: Offline answers to concept questions from a bundled FAQ
- cmd_hooks.py: Claude Code hook installation and execution
- cmd_mcp.py: MCP server management (list, test, info, search)
- cmd_batch.py: Batch runner for stdin prompts as fresh non-interactive sessions
- cmd_skills.py: Skills and lessons (list, show, search, install, validate, etc.)
- cmd_snapshot.py: Workspace snapshot management (list snapshots outside a session)

Inline command groups (smaller, live in this file):
- context: RAG index/retrieve plus workspace/git/journal context generation
"""

# Filter requests' overly-strict version-compatibility warning before any
# import path can pull in `requests`. Newer urllib3/chardet/charset_normalizer
# work fine with requests; the warning just pollutes every CLI invocation.
import warnings

warnings.filterwarnings(
    "ignore",
    message=r".*urllib3.*chardet.*charset_normalizer.*",
)

import fnmatch
import glob
import importlib
import io
import json
import logging
import os
import subprocess
import sys
import time
from contextlib import redirect_stderr, redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import TYPE_CHECKING, NamedTuple, cast

import click

from ..util.git_cmd import GIT_CMD

if TYPE_CHECKING:
    from rich.tree import Tree as RichTree

_LAZY_COMMANDS: dict[str, tuple[str, str]] = {
    "agents": (".cmd_agents", "agents"),
    "capabilities": (".cmd_capabilities", "capabilities"),
    "attest": (".cmd_attest", "attest"),
    "batch": (".cmd_batch", "batch_cmd"),
    "chats": (".cmd_chats", "chats"),
    "computer": (".cmd_computer", "computer"),
    "explain": (".cmd_explain", "explain"),
    "hooks": (".cmd_hooks", "hooks"),
    "knowledge": (".cmd_knowledge", "knowledge"),
    "mcp": (".cmd_mcp", "mcp"),
    "memory": (".cmd_memory", "memory"),
    "resume": (".cmd_resume", "resume"),
    # Unified review group (gptme#3442): ``gptme-util review watch``
    "review": (".cmd_review", "review"),
    # Backward-compat alias kept so existing scripts are not broken.
    "review-watch": (".cmd_review_watch", "review_watch"),
    "skills": (".cmd_skills", "skills"),
    "slop": (".cmd_slop", "slop"),
    "snapshot": (".cmd_snapshot", "snapshot"),
    "stats": (".cmd_stats", "stats"),
    "status": (".cmd_status", "status"),
    "dataset": (".cmd_dataset", "dataset"),
}

# Inline groups defined via @main.group() in this file
_INLINE_COMMANDS = frozenset(
    {"providers", "tokens", "context", "llm", "tools", "prompts", "models", "profile"}
)

# All top-level subcommand names for gptme-util — exported for the gptme main CLI
# to enable dynamic dispatch without importing the full util module at startup.
UTIL_SUBCOMMANDS: list[str] = sorted(set(_LAZY_COMMANDS) | _INLINE_COMMANDS)


def get_model_list(*args, **kwargs):
    """Lazy proxy so tests can still patch ``gptme.cli.util.get_model_list``."""
    from ..llm.models import get_model_list as _get_model_list  # fmt: skip

    return _get_model_list(*args, **kwargs)


def list_models(*args, **kwargs):
    """Lazy proxy so util commands don't import model code at module import time."""
    from ..llm.models import list_models as _list_models  # fmt: skip

    return _list_models(*args, **kwargs)


def model_to_dict(model):
    """Lazy proxy used by JSON model output."""
    from ..llm.models import model_to_dict as _model_to_dict  # fmt: skip

    return _model_to_dict(model)


def get_config(*args, **kwargs):
    """Lazy proxy so tests can still patch ``gptme.cli.util.get_config``."""
    from ..config import get_config as _get_config  # fmt: skip

    return _get_config(*args, **kwargs)


class LazyGroup(click.Group):
    """Click group that imports heavyweight subcommands on demand."""

    def list_commands(self, ctx: click.Context) -> list[str]:
        commands = set(super().list_commands(ctx))
        commands.update(_LAZY_COMMANDS)
        return sorted(commands)

    def get_command(self, ctx: click.Context, cmd_name: str) -> click.Command | None:
        command = super().get_command(ctx, cmd_name)
        if command is not None:
            return command

        target = _LAZY_COMMANDS.get(cmd_name)
        if target is None:
            return None

        module_name, attr_name = target
        module = importlib.import_module(module_name, package=__package__)
        command = getattr(module, attr_name)
        self.add_command(command, cmd_name)
        return command


if _parent_prog := os.environ.get("GPTME_PARENT_PROG"):
    sys.argv[0] = _parent_prog


@click.group(cls=LazyGroup)
@click.option("-v", "--verbose", is_flag=True, help="Enable verbose output.")
def main(verbose: bool = False):
    """Utility commands for gptme."""

    if verbose:
        logging.getLogger().setLevel(logging.DEBUG)


@main.group()
def providers():
    """Commands for managing custom providers."""


@providers.command("list")
@click.option(
    "--discover/--no-discover",
    default=True,
    help="Probe well-known local OpenAI-compatible endpoints (Ollama :11434, LM Studio :1234).",
)
@click.option("--json", "as_json", is_flag=True, help="Output as JSON.")
def providers_list(discover: bool = True, as_json: bool = False):
    """List configured and auto-discovered local OpenAI-compatible providers.

    Configured ``[[providers]]`` entries are listed first. Then gptme probes
    Ollama (``http://127.0.0.1:11434/v1/models``) and LM Studio
    (``http://127.0.0.1:1234/v1/models``) and reports each candidate — live
    servers and the reason a probe did not count as available. Discovery never
    writes config; use ``gptme providers add`` to persist a provider.
    """
    config = get_config()
    discovered = []
    if discover:
        from ..llm.local_discovery import (  # fmt: skip
            discover_local_providers,
            local_discovery_disabled,
        )

        discovered = discover_local_providers(configured=config.user.providers)

    if as_json:
        _env_disabled = discover and local_discovery_disabled()
        payload = {
            "configured": [_configured_provider_dict(p) for p in config.user.providers],
            "discovered": [r.to_dict() for r in discovered],
            "discovery_disabled": not discover or _env_disabled,
        }
        click.echo(json.dumps(payload, indent=2))
        return

    if not config.user.providers:
        click.echo("📭 No custom providers configured")
        click.echo()
        click.echo("Run `gptme providers add` to configure one interactively, or")
        click.echo("add manually to your gptme.toml:")
        click.echo()
        click.echo("[[providers]]")
        click.echo('name = "my-provider"')
        click.echo('base_url = "http://localhost:8000/v1"')
        click.echo('api_key_env = "MY_PROVIDER_API_KEY"')
        click.echo('default_model = "my-model"')
        click.echo()
    else:
        click.echo(f"🔌 Found {len(config.user.providers)} custom provider(s):")
        click.echo()

        for provider in config.user.providers:
            click.echo(f"📡 {provider.name}")
            click.echo(f"   Base URL: {provider.base_url}")

            # Show API key source (but not the actual key)
            if provider.api_key:
                click.echo("   API Key: (configured directly)")
            elif provider.api_key_env:
                click.echo(f"   API Key: ${provider.api_key_env}")
            else:
                click.echo(
                    f"   API Key: ${provider.name.upper().replace('-', '_')}_API_KEY (default)"
                )

            if provider.default_model:
                click.echo(f"   Default Model: {provider.default_model}")

            click.echo()

    if not discover:
        return

    click.echo("🔍 Local auto-discovery")
    if not discovered:
        if local_discovery_disabled():
            click.echo("   (disabled via GPTME_NO_LOCAL_DISCOVERY)")
        else:
            click.echo("   (no local providers found)")
        return

    for result in discovered:
        _print_discovery_result(result)


def _configured_provider_dict(provider) -> dict:
    return {
        "name": provider.name,
        "base_url": provider.base_url,
        "api_key_env": provider.api_key_env,
        "default_model": provider.default_model,
        "api_key_configured": bool(provider.api_key),
    }


def _strip_controls(s: str) -> str:
    """Strip C0/C1 terminal control characters from untrusted probe output."""
    import re

    return re.sub(r"[\x00-\x1f\x7f-\x9f]", "", s)


def _print_discovery_result(result) -> None:
    from ..llm.local_discovery import DiscoveryResult  # fmt: skip

    if not isinstance(result, DiscoveryResult):
        raise TypeError(f"expected DiscoveryResult, got {type(result).__name__}")
    cand = result.candidate
    status_icon = {
        "up": "✅",
        "down": "⚪",
        "incompatible": "❌",
        "auth_required": "🔒",
        "error": "❌",
    }.get(result.status, "⚪")
    click.echo(f"   {status_icon} {cand.display_name}  {cand.base_url}")
    click.echo(f"      probe: {cand.models_url}")
    if result.status == "up":
        if result.models:
            safe_models = [_strip_controls(m) for m in result.models]
            shown = ", ".join(safe_models[:8])
            extra = (
                f" (+{len(result.models) - 8} more)" if len(result.models) > 8 else ""
            )
            click.echo(f"      models ({len(result.models)}): {shown}{extra}")
        else:
            click.echo("      models: (none listed — server is up)")
        if result.configured_as:
 
```

### Core Architecture Module: `gptme/config/core.py`
```
"""Core configuration: Config class, context variables, and accessors.

The Config class aggregates user, project, and chat configurations.
Context variables provide thread-safe configuration storage.
"""

import logging
import os
from contextvars import ContextVar
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from typing_extensions import Self

from .chat import ChatConfig
from .models import (
    MCPConfig,
    MCPServerConfig,
    ProjectConfig,
    ScriptHookConfig,
    UserConfig,
)
from .project import (
    _config_logged_workspaces,
    _get_project_config_cached,
    get_project_config,
)
from .user import load_user_config

logger = logging.getLogger(__name__)

ModelSourceKind = Literal[
    "cli",
    "chat_config",
    "environment",
    "project",
    "models.default",
    "MODEL",
]


@dataclass()
class Config:
    """
    A complete configuration object, including user and project configurations.

    It is meant to be used to resolve configuration values, not to be passed around everywhere.
    Care must be taken to avoid this becoming a "god object" passed around loosely, or frequently used as a global.
    """

    user: UserConfig = field(default_factory=load_user_config)
    project: ProjectConfig | None = None
    chat: ChatConfig | None = None
    # Context-local overrides that beat every other source (including os.environ).
    # Used to scope a setting to one thread, e.g. a subagent's per-call reasoning_effort.
    env_overrides: dict[str, str] = field(default_factory=dict, repr=False)
    # Runtime-only provenance for a model already resolved into chat.model.
    # The value guard prevents a later explicit model from inheriting stale provenance.
    _model_source: tuple[ModelSourceKind, str] | None = field(default=None, repr=False)

    @classmethod
    def from_workspace(cls, workspace: Path) -> Self:
        """Load the configuration from a workspace directory. Clearing any cache."""
        _get_project_config_cached.cache_clear()
        _config_logged_workspaces.clear()
        return cls(
            user=load_user_config(),
            project=get_project_config(workspace),
        )

    @classmethod
    def from_logdir(cls, logdir: Path) -> Self:
        """Load the configuration from a log directory."""
        chat_config = ChatConfig.from_logdir(logdir)
        return cls(
            user=load_user_config(),
            project=get_project_config(chat_config.workspace),
            chat=chat_config,
        )

    def get_script_hooks(self) -> list[ScriptHookConfig]:
        """Return user and project script hooks in execution order."""
        hooks = list(self.user.hooks.scripts)
        if self.project:
            hooks.extend(self.project.hooks.scripts)
        return sorted(hooks, key=lambda hook: hook.priority, reverse=True)

    @property
    def mcp(self) -> MCPConfig:
        """Get the MCP configuration, merging user and project configurations."""
        # Override MCP config from project config and chat config if present, merging mcp servers
        servers: list[MCPServerConfig] = []

        enabled = False
        auto_start = False

        # merge mcp servers
        if self.chat and self.chat.mcp:
            for server in self.chat.mcp.servers:
                if server.name not in [s.name for s in servers]:
                    servers.append(server)

        if self.project and self.project.mcp:
            for server in self.project.mcp.servers:
                if server.name not in [s.name for s in servers]:
                    servers.append(server)

        if self.user and self.user.mcp:
            for server in self.user.mcp.servers:
                if server.name not in [s.name for s in servers]:
                    servers.append(server)

        # merge mcp config
        if self.user and self.user.mcp:
            enabled = self.user.mcp.enabled
            auto_start = self.user.mcp.auto_start

        if self.project and self.project.mcp:
            enabled = self.project.mcp.enabled
            auto_start = self.project.mcp.auto_start

        if self.chat and self.chat.mcp:
            enabled = self.chat.mcp.enabled
            auto_start = self.chat.mcp.auto_start

        mcp = MCPConfig(
            enabled=enabled,
            auto_start=auto_start,
            servers=servers,
        )

        return mcp

    def get_plugin_config(self) -> tuple[list[Path], list[str] | None]:
        """Resolve plugin search paths and the enabled allowlist.

        Layers user-level ``[plugins]`` (from ~/.config/gptme/config.toml) with
        project-level ``[plugins]`` (from gptme.toml). User paths are
        ``~``/absolute (or expanduser-resolved); project paths resolve against
        the workspace when relative. Returns ``(paths, enabled)``.

        The ``enabled`` allowlist is the **union** of the user and project lists
        (empty => ``None``, meaning all discovered plugins are enabled). The
        union is intentionally restrictive: a global allowlist set by the user
        also constrains plugins discovered from project paths, so a project
        cannot silently load plugins the user hasn't opted into. To allow a
        project's plugins under a user allowlist, add them to either list.
        """
        paths: list[Path] = []
        enabled: list[str] = []

        def _add_path(path: Path) -> None:
            resolved = path.resolve()
            if resolved not in {p.resolve() for p in paths}:
                paths.append(path)

        # User-level plugins. Paths are expanduser-resolved; use absolute or
        # ``~``-prefixed paths (resolution is independent of the config file
        # location, which may differ from the default in tests/multi-profile).
        for path_str in self.user.plugins.paths:
            _add_path(Path(path_str).expanduser())
        enabled.extend(self.user.plugins.enabled)

        # Project-level plugins (relative paths resolve against the workspace)
        if self.project and self.project.plugins:
            for path_str in self.project.plugins.paths:
                path = Path(path_str).expanduser()
                if not path.is_absolute() and self.project._workspace:
                    path = self.project._workspace / path
                _add_path(path)
            enabled.extend(self.project.plugins.enabled)

        # Dedupe enabled, preserving order. Empty => None (all plugins enabled).
        deduped_enabled = list(dict.fromkeys(enabled))
        return paths, (deduped_enabled or None)

    def get_env(self, key: str, default: str | None = None) -> str | None:
        """Gets an environment variable, checks the config file if it's not set in the environment.

        Checks both ``GPTME_<KEY>`` and ``<KEY>`` forms for environment variables,
        with the prefixed form taking precedence. Config file lookups always use
        the bare (unprefixed) key.
        """
        prefixed = f"GPTME_{key}" if not key.startswith("GPTME_") else key
        bare = key.removeprefix("GPTME_") if key.startswith("GPTME_") else key
        return (
            self.env_overrides.get(bare)
            or os.environ.get(prefixed)
            or os.environ.get(bare)
            or (self.chat and self.chat.env.get(bare))
            or (self.project and self.project.env.get(bare))
            or self.user.env.get(bare)
            or default
        )

    def get_env_bool(self, key: str, default: bool | None = None) -> bool | None:
        if env_value := self.get_env(key):
            return env_value.lower() in ("1", "true", "yes", "on")
        return default

    def get_env_required(self, key: str) -> str:
        """Gets an environment variable, checks the config file if it's not set in the environment.

        Uses the same ``GPTME_`` prefix lookup logic as ``get_env()``.
        """
        if val := self.get_env(key):
            return val
        raise KeyError(  # pragma: no cover
            f"Environment variable {key} not set in env or config, see README."
        )


# Context-local storage for config
# Each context (thread/async task) gets its own independent copy of the configuration
_config_var: ContextVar[Config | None] = ContextVar("config", default=None)

# Note: Configuration must be initialized in each context that needs it.
# The first call to get_config() in a context will create a new Config instance.
# Subsequent calls in the same context will return the same instance.


def get_config() -> Config:
    """Get the current configuration."""
    config = _config_var.get()
    if config is None:
        config = Config()
        _config_var.set(config)
    return config


def set_config(config: Config):
    """Set the configuration."""
    _config_var.set(config)


def set_config_from_workspace(workspace: Path):
    """Set the configuration to use a specific workspace, possibly having a project config."""
    _config_var.set(Config.from_workspace(workspace=workspace))


def reload_config() -> Config:
    """Reload the configuration files."""
    config = _config_var.get()
    # Model provenance is runtime-only state: reloading the config files must not
    # erase which layer the session's already-resolved model came from.
    model_source = config._model_source if config is not None else None
    if config is None:
        config = Config()
        _config_var.set(config)
    elif workspace := (config.project and config.project._workspace):
        config = Config.from_workspace(workspace=workspace)
        _config_var.set(config)
    else:
        config = Config()
        _config_var.set(config)
    config._model_source = model_source

    # Clear tools cache so MCP tools are recreated with new config
    from gptme.tools import clear_tools  # fmt: skip

    clear_tools()

    assert config
    return config


def resolve_model_source(
    config: Config,
    cli_model: str | None = None,
    chat_model: str | None =
```

### Core Architecture Module: `gptme/eval/suites/behavioral/implement_priority_queue.py`
```
"""Behavioral scenario: implement-priority-queue."""

import ast
from typing import TYPE_CHECKING

from ._common import parse_python_source

if TYPE_CHECKING:
    from gptme.eval.types import EvalSpec


def _get_source(ctx, filename: str = "priority_queue.py") -> str:
    content = ctx.files.get(filename, "")
    if isinstance(content, bytes):
        content = content.decode()
    return content


def check_tests_pass(ctx):
    """All tests should pass after implementing PriorityQueue."""
    return ctx.exit_code == 0 and "failed" not in ctx.stdout.lower()


def check_uses_heap(ctx):
    """Should use heapq or a heap-based approach, not naive sorting."""
    content = _get_source(ctx)
    return "heapq" in content


def check_has_push_method(ctx):
    """Should implement push/enqueue method."""
    content = _get_source(ctx)
    module = parse_python_source(content)
    if module is None:
        return False
    for node in ast.walk(module):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            if node.name in ("push", "enqueue", "insert"):
                return True
    return False


def check_has_pop_method(ctx):
    """Should implement pop/dequeue method."""
    content = _get_source(ctx)
    module = parse_python_source(content)
    if module is None:
        return False
    for node in ast.walk(module):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            if node.name in ("pop", "dequeue", "extract_min", "extract_max"):
                return True
    return False


def check_has_size_or_len(ctx):
    """Should support checking queue size (method or __len__)."""
    content = _get_source(ctx)
    module = parse_python_source(content)
    if module is None:
        return False
    for node in ast.walk(module):
        if isinstance(node, ast.FunctionDef) and node.name == "__len__":
            return True
    for node in ast.walk(module):
        if isinstance(node, ast.FunctionDef | ast.AsyncFunctionDef):
            if node.name in ("size", "__len__"):
                return True
    return False


def check_raises_on_empty_pop(ctx):
    """Should raise an exception when popping from an empty queue."""
    content = _get_source(ctx)
    return "IndexError" in content or "raise" in content


PRIORITY_QUEUE_SRC = '''\
"""Task scheduler using a priority queue."""

from typing import Any


class PriorityQueue:
    """Min-heap priority queue for task scheduling.

    Lower numeric priority values are dequeued first (priority 1 before 10).
    When two items share the same priority, a FIFO tie-breaking order is used.

    Args:
        initial: Optional list of (priority, item) pairs to pre-load.
    """

    def __init__(self, initial: list[tuple[int, Any]] | None = None):
        self._data: list[tuple[int, int, Any]] = []
        self._counter = 0
        # TODO: implement priority queue

    def push(self, priority: int, item: Any) -> None:
        """Insert an item with the given priority."""
        # TODO: implement
        self._data.append((priority, self._counter, item))
        self._counter += 1

    def pop(self) -> Any:
        """Remove and return the highest-priority (lowest number) item.

        Raises:
            IndexError: If the queue is empty.
        """
        # TODO: implement
        raise IndexError("pop from empty queue")

    def peek(self) -> Any:
        """Return the highest-priority item without removing it.

        Raises:
            IndexError: If the queue is empty.
        """
        # TODO: implement
        raise IndexError("peek from empty queue")

    def __len__(self) -> int:
        """Return the number of items in the queue."""
        return len(self._data)

    def is_empty(self) -> bool:
        """Return True if the queue contains no items."""
        return len(self._data) == 0
'''

TEST_PRIORITY_QUEUE_SRC = '''\
import pytest
from priority_queue import PriorityQueue


def test_push_and_pop_single():
    """Should push an item and pop it back."""
    pq = PriorityQueue()
    pq.push(1, "task-a")
    assert pq.pop() == "task-a"


def test_priority_ordering():
    """Items with lower priority values should be dequeued first."""
    pq = PriorityQueue()
    pq.push(10, "low-priority")
    pq.push(1, "high-priority")
    pq.push(5, "mid-priority")

    assert pq.pop() == "high-priority"
    assert pq.pop() == "mid-priority"
    assert pq.pop() == "low-priority"


def test_fifo_for_same_priority():
    """Items with equal priority should be dequeued in FIFO order."""
    pq = PriorityQueue()
    pq.push(3, "first-in")
    pq.push(3, "second-in")
    pq.push(3, "third-in")

    assert pq.pop() == "first-in"
    assert pq.pop() == "second-in"
    assert pq.pop() == "third-in"


def test_pop_from_empty_raises():
    """Popping from an empty queue should raise IndexError."""
    pq = PriorityQueue()
    with pytest.raises(IndexError):
        pq.pop()


def test_peek_returns_highest_priority():
    """Peek should return the highest-priority item without removing it."""
    pq = PriorityQueue()
    pq.push(10, "low")
    pq.push(1, "high")
    pq.push(5, "mid")

    assert pq.peek() == "high"
    assert len(pq) == 3  # peek should not remove


def test_peek_from_empty_raises():
    """Peeking at an empty queue should raise IndexError."""
    pq = PriorityQueue()
    with pytest.raises(IndexError):
        pq.peek()


def test_size_tracking():
    """len() should reflect the number of items."""
    pq = PriorityQueue()
    assert len(pq) == 0

    pq.push(1, "a")
    assert len(pq) == 1

    pq.push(2, "b")
    assert len(pq) == 2

    pq.pop()
    assert len(pq) == 1


def test_is_empty():
    """is_empty should correctly report empty state."""
    pq = PriorityQueue()
    assert pq.is_empty() is True

    pq.push(1, "item")
    assert pq.is_empty() is False

    pq.pop()
    assert pq.is_empty() is True


def test_mixed_priorities_interleaved():
    """Queue should correctly order after interleaved push/pop operations."""
    pq = PriorityQueue()
    pq.push(5, "a")
    pq.push(1, "b")
    pq.push(10, "c")

    assert pq.pop() == "b"  # priority 1
    pq.push(3, "d")
    assert pq.pop() == "d"  # priority 3 < 5
    assert pq.pop() == "a"  # priority 5
    assert pq.pop() == "c"  # priority 10
    assert pq.is_empty()
'''

test: "EvalSpec" = {
    "name": "implement-priority-queue",
    "task_type": "structured_process",
    "files": {
        "priority_queue.py": PRIORITY_QUEUE_SRC,
        "test_priority_queue.py": TEST_PRIORITY_QUEUE_SRC,
    },
    "run": "python3 -m pytest test_priority_queue.py -v --tb=short 2>&1",
    "prompt": (
        "The `PriorityQueue` class in `priority_queue.py` has stub methods "
        "that don't use a proper heap — items are stored in a plain list.\n\n"
        "The test suite in `test_priority_queue.py` is failing. Implement a "
        "min-heap-based priority queue using Python's `heapq` module:\n\n"
        "- `push(priority, item)`: Insert with given priority (lower = higher priority)\n"
        "- `pop()`: Remove and return the highest-priority item (lowest number)\n"
        "- `peek()`: Return highest-priority item without removing it\n"
        "- `__len__()`: Return number of items\n"
        "- `is_empty()`: Return True when no items remain\n"
        "- Same-priority items must follow FIFO order (use a counter as tiebreaker)\n"
        "- Raise IndexError on pop/peek from empty queue\n"
        "- Use only the Python standard library (heapq)\n\n"
        "After implementing, run the tests to verify they all pass:\n"
        "  python3 -m pytest test_priority_queue.py -v --tb=short\n"
    ),
    "tools": ["shell", "save", "read"],
    "expect": {
        "all tests pass": check_tests_pass,
        "uses heapq": check_uses_heap,
        "has push method": check_has_push_method,
        "has pop method": check_has_pop_method,
        "has size or __len__": check_has_size_or_len,
        "raises on empty pop": check_raises_on_empty_pop,
    },
}

```

### Core Architecture Module: `gptme/eval/swebench/utils.py`
```
import json
import logging
import os
import subprocess
from pathlib import Path

from ...util.git_cmd import GIT_CMD

logger = logging.getLogger(__name__)

# SWE-bench prediction format keys
KEY_INSTANCE_ID = "instance_id"
KEY_MODEL = "model_name_or_path"
KEY_PATCH = "model_patch"


def load_instances(
    dataset_name: str = "princeton-nlp/SWE-bench_Lite",
    split: str = "test",
    force_download: bool = False,
) -> dict[str, dict]:
    from datasets import DownloadMode, load_dataset  # lazy: optional eval extra

    download_mode = (
        DownloadMode.FORCE_REDOWNLOAD
        if force_download
        else DownloadMode.REUSE_DATASET_IF_EXISTS
    )
    data = load_dataset(dataset_name, split=split, download_mode=download_mode)
    return {d["instance_id"]: d for d in data}


def load_instance(
    instance_id: str,
    dataset_name: str = "princeton-nlp/SWE-bench_Lite",
    split: str = "test",
    force_download: bool = False,
) -> dict:
    data = load_instances(dataset_name, split=split, force_download=force_download)
    return data[instance_id]


def setup_swebench_repo(instance_data: dict, repo_base_dir: str | None = None) -> str:
    if not repo_base_dir:
        repo_base_dir = os.getenv("REPO_DIR", "/tmp/repos")

    repo_dir_name = instance_data["repo"].replace("/", "__")
    github_repo_path = f"swe-bench/{repo_dir_name}"
    return setup_github_repo(
        repo=github_repo_path,
        base_commit=instance_data["base_commit"],
        base_dir=repo_base_dir,
    )


def write_predictions_jsonl(
    predictions: list[dict],
    output_path: str | Path,
) -> Path:
    """Write predictions in SWE-bench JSONL format for official harness evaluation.

    Each prediction must have: instance_id, model_name_or_path, model_patch.
    See: https://github.com/princeton-nlp/SWE-bench#-evaluation
    """
    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w") as f:
        for pred in predictions:
            f.write(json.dumps(pred) + "\n")
    logger.info(f"Wrote {len(predictions)} predictions to {output_path}")
    return output_path


def append_prediction(
    prediction: dict,
    output_path: Path,
) -> None:
    """Append a single prediction to the JSONL file (for incremental writing)."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("a") as f:
        f.write(json.dumps(prediction) + "\n")


def load_existing_predictions(output_path: Path) -> set[str]:
    """Load instance IDs from an existing predictions JSONL file.

    Returns a set of instance_id values already present in the file.
    Skips malformed lines with a warning.
    """
    if not output_path.exists():
        return set()

    existing: set[str] = set()
    with output_path.open() as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                pred = json.loads(line)
                instance_id = pred.get(KEY_INSTANCE_ID)
                if instance_id:
                    existing.add(instance_id)
                else:
                    logger.warning(
                        f"Line {lineno} in {output_path} missing '{KEY_INSTANCE_ID}'"
                    )
            except json.JSONDecodeError:
                logger.warning(f"Skipping malformed line {lineno} in {output_path}")
    if existing:
        logger.info(f"Found {len(existing)} existing predictions in {output_path}")
    return existing


def get_file_spans_from_patch(patch: str) -> dict[str, list[str]]:
    file_spans: dict[str, list[str]] = {}
    current_file: str | None = None

    for line in patch.split("\n"):
        if line.startswith("diff --git"):
            current_file = line.split()[-1][2:]  # Extract the file path
            file_spans[current_file] = []

    return file_spans


def setup_github_repo(repo: str, base_commit: str, base_dir: str | None = None) -> str:
    if base_dir is None:
        base_dir = os.getenv("REPO_DIR", "/tmp/repos")

    repo_dir = os.path.join(base_dir, repo.replace("/", "_"))

    try:
        if not os.path.exists(repo_dir):
            logger.info(f"Cloning repository {repo} to {repo_dir}")
            os.makedirs(repo_dir, exist_ok=True)
            subprocess.run(
                [GIT_CMD, "clone", f"https://github.com/{repo}.git", repo_dir],
                check=True,
                capture_output=True,
                text=True,
                timeout=300,
            )

        logger.info(f"Checking out commit {base_commit} in {repo_dir}")
        subprocess.run(
            [GIT_CMD, "fetch", "origin"],
            check=True,
            capture_output=True,
            text=True,
            cwd=repo_dir,
            timeout=120,
        )
        subprocess.run(
            [GIT_CMD, "checkout", base_commit],
            check=True,
            capture_output=True,
            text=True,
            cwd=repo_dir,
            timeout=60,
        )

        return repo_dir
    except subprocess.CalledProcessError as e:
        logger.error(f"Error setting up GitHub repo: {e}")
        logger.error(f"Command output: {e.output}")
        raise
    except subprocess.TimeoutExpired as e:
        logger.error(
            f"Timed out setting up GitHub repo (command took >{e.timeout}s): {e.cmd}"
        )
        raise
    except Exception as e:
        logger.error(f"Unexpected error setting up GitHub repo: {e}")
        raise

```

### Core Architecture Module: `gptme/hooks/__init__.py`
```
"""Hook system for extending gptme functionality at various lifecycle points.

This package provides a hook registry for registering and triggering hooks at
various points in the gptme lifecycle. The system is split into:

- ``types``: Type definitions (Protocol classes, HookType enum, Hook dataclass)
- ``registry``: Hook registry, registration, and execution infrastructure
- ``confirm``: Tool confirmation hooks
- ``elicitation``: Structured user input hooks

Individual hook implementations live in their own modules (e.g., ``cwd_changed``,
``time_awareness``, ``workspace_agents``).
"""

import logging

# Re-export confirm and elicitation types
from .confirm import ConfirmAction as ConfirmAction
from .confirm import ConfirmationResult as ConfirmationResult
from .confirm import ToolConfirmHook as ToolConfirmHook
from .confirm import confirm as confirm
from .confirm import get_confirmation as get_confirmation
from .elicitation import ElicitationHook as ElicitationHook
from .elicitation import ElicitationRequest as ElicitationRequest
from .elicitation import ElicitationResponse as ElicitationResponse
from .elicitation import FormField as FormField
from .elicitation import elicit as elicit

# Re-export registry functions
from .registry import (
    HookRegistry as HookRegistry,
)
from .registry import _thread_safe_init
from .registry import (
    clear_hooks as clear_hooks,
)
from .registry import (
    disable_hook as disable_hook,
)
from .registry import (
    enable_hook as enable_hook,
)
from .registry import (
    get_hooks as get_hooks,
)
from .registry import (
    get_registry as get_registry,
)
from .registry import (
    register_hook as register_hook,
)
from .registry import (
    set_registry as set_registry,
)
from .registry import (
    trigger_hook as trigger_hook,
)
from .registry import (
    unregister_hook as unregister_hook,
)
from .server_confirm import current_conversation_id as current_conversation_id
from .server_confirm import current_session_id as current_session_id

# Re-export types (Protocol classes, enums, dataclasses)
from .types import (
    CacheInvalidatedHook as CacheInvalidatedHook,
)
from .types import (
    CwdChangedHook as CwdChangedHook,
)
from .types import (
    FilePostSaveHook as FilePostSaveHook,
)
from .types import (
    FilePreSaveHook as FilePreSaveHook,
)
from .types import (
    GenerationPostHook as GenerationPostHook,
)
from .types import (
    GenerationPreHook as GenerationPreHook,
)
from .types import (
    Hook as Hook,
)
from .types import (
    HookFunc as HookFunc,
)
from .types import (
    HookType as HookType,
)
from .types import (
    LoopContinueHook as LoopContinueHook,
)
from .types import (
    MessageProcessHook as MessageProcessHook,
)
from .types import (
    SessionEndHook as SessionEndHook,
)
from .types import (
    SessionStartHook as SessionStartHook,
)
from .types import (
    StopPropagation as StopPropagation,
)
from .types import (
    ToolExecuteHook as ToolExecuteHook,
)

logger = logging.getLogger(__name__)


@_thread_safe_init
def init_hooks(
    allowlist: list[str] | None = None,
    interactive: bool = False,
    no_confirm: bool = False,
    server: bool = False,
) -> None:
    """Initialize and register hooks in a thread-safe manner.

    Mode detection for confirmation hooks:

    - Interactive CLI mode with confirmation: Registers cli_confirm hook
    - Server mode with confirmation: Registers server_confirm hook
    - Non-interactive mode: No confirmation hook (autonomous/auto-confirm)

    Args:
        allowlist: Explicit list of hooks to register (replaces defaults).
                   If not provided, defaults will be loaded from env/config.
        interactive: Whether running in interactive mode (CLI).
        no_confirm: Whether to skip tool confirmations.
        server: Whether running in server mode (API/WebUI).
    """
    from ..config import get_config  # fmt: skip

    config = get_config()
    managed_subprocess = bool(config.get_env("GPTME_SUBAGENT_AGENT_ID"))

    # Get allowlist from parameter, environment, or config. Managed subprocesses
    # extend inherited configuration with their required control protocol, while
    # a caller-provided allowlist remains an exact API-level restriction.
    if allowlist is None:
        env_allowlist = config.get_env("HOOK_ALLOWLIST")
        if env_allowlist:
            allowlist = env_allowlist.split(",")
            if managed_subprocess and "subagent_control" not in allowlist:
                allowlist.append("subagent_control")
        # Note: hooks are not yet in chat config, but could be added later
        # elif config.chat and config.chat.hooks:
        #     allowlist = config.chat.hooks

    # Available hooks with their register functions
    available_hooks = {
        "cwd_changed": lambda: __import__(
            "gptme.hooks.cwd_changed", fromlist=["register"]
        ).register(),
        "cwd_awareness": lambda: __import__(
            "gptme.hooks.cwd_awareness", fromlist=["register"]
        ).register(),
        "markdown_validation": lambda: __import__(
            "gptme.hooks.markdown_validation", fromlist=["register"]
        ).register(),
        "time_awareness": lambda: __import__(
            "gptme.hooks.time_awareness", fromlist=["register"]
        ).register(),
        "token_awareness": lambda: __import__(
            "gptme.hooks.token_awareness", fromlist=["register"]
        ).register(),
        "active_context": lambda: __import__(
            "gptme.hooks.active_context", fromlist=["register"]
        ).register(),
        "form_autodetect": lambda: __import__(
            "gptme.hooks.form_autodetect", fromlist=["register"]
        ).register(),
        "cost_awareness": lambda: __import__(
            "gptme.hooks.cost_awareness", fromlist=["register"]
        ).register(),
        "cache_awareness": lambda: __import__(
            "gptme.hooks.cache_awareness", fromlist=["register"]
        ).register(),
        "injection_screening": lambda: __import__(
            "gptme.hooks.injection_screening", fromlist=["register"]
        ).register(),
        "workspace_agents": lambda: __import__(
            "gptme.hooks.workspace_agents", fromlist=["register"]
        ).register(),
        "agents_md_inject": lambda: __import__(
            "gptme.hooks.agents_md_inject", fromlist=["register"]
        ).register(),
        "tool_target_instructions": lambda: __import__(
            "gptme.hooks.tool_target_instructions", fromlist=["register"]
        ).register(),
        "mcp_namespace_hint": lambda: __import__(
            "gptme.hooks.mcp_namespace_hint", fromlist=["register"]
        ).register(),
        "knowledge_inject": lambda: __import__(
            "gptme.hooks.knowledge_inject", fromlist=["register"]
        ).register(),
        "context_scout": lambda: __import__(
            "gptme.context.scout", fromlist=["register"]
        ).register(),
        "guardrails": lambda: __import__(
            "gptme.hooks.guardrails", fromlist=["register"]
        ).register(),
        "anomaly_watchdog": lambda: __import__(
            "gptme.hooks.anomaly_watchdog", fromlist=["register"]
        ).register(),
        # Tool confirmation hooks (mode-specific, not registered by default)
        "cli_confirm": lambda: __import__(
            "gptme.hooks.cli_confirm", fromlist=["register"]
        ).register(),
        "auto_confirm": lambda: __import__(
            "gptme.hooks.auto_confirm", fromlist=["register"]
        ).register(),
        "server_confirm": lambda: __import__(
            "gptme.hooks.server_confirm", fromlist=["register"]
        ).register(),
        "server_elicit": lambda: __import__(
            "gptme.hooks.server_elicit", fromlist=["register"]
        ).register(),
        # The parent loads subagent hooks through its ToolSpec. Subprocess children
        # do not load that tool, but still need the control hook to receive steer
        # and cancel operations written to their log directory.
        "subagent_control": lambda: register_hook(
            "subagent.control",
            HookType.STEP_PRE,
            __import__(
                "gptme.tools.subagent.hooks", fromlist=["_subagent_control_hook"]
            )._subagent_control_hook,
            0,
        ),
        # NOTE: subagent_completion is now registered via ToolSpec in gptme/tools/subagent/__init__.py
        "test": lambda: __import__(
            "gptme.hooks.test", fromlist=["register_test_hooks"]
        ).register_test_hooks(),
    }

    # Determine which hooks to register
    if allowlist is not None:
        hooks_to_register = allowlist
    else:
        # Register all default hooks except explicit opt-ins and mode-specific hooks.
        # Confirmation hooks (cli_confirm, auto_confirm, server_confirm) and the
        # subprocess-only control hook are registered from runtime mode below.
        non_default_hooks = {
            # Deprecated JSONL knowledge delivery requires an explicit allowlist.
            "knowledge_inject",
            "test",
            "cli_confirm",
            "auto_confirm",
            "server_confirm",
            "server_elicit",
            "subagent_control",
        }
        hooks_to_register = [h for h in available_hooks if h not in non_default_hooks]

        # Mode-based hook selection:
        # - Server mode with confirmation: server_confirm + server_elicit
        # - CLI interactive with confirmation enabled: cli_confirm
        # - Non-interactive (autonomous): no confirmation hook (auto-confirm behavior)
        if server and not no_confirm:
            hooks_to_register.append("server_confirm")
            hooks_to_register.append("server_elicit")
        elif interactive and not no_confirm:
            hooks_to_register.append("cli_confirm")

    # Without configured restrictions, managed subprocess children add their
    # control protocol to the normal defaults. Configured all
```

### Core Architecture Module: `gptme/hooks/active_context.py`
```
import logging
from collections.abc import Generator
from pathlib import Path

from ..context.selector.file_selector import select_relevant_files
from ..message import Message
from ..util.context import (
    file_to_display_path,
    get_mentioned_files,
    git_status,
    md_codeblock,
)
from . import HookType, StopPropagation, register_hook

logger = logging.getLogger(__name__)

# Files that are never useful as LLM context (lockfiles, minified assets, etc.)
_SKIP_FILENAMES: set[str] = {
    "poetry.lock",
    "uv.lock",
    "package-lock.json",
    "yarn.lock",
    "pnpm-lock.yaml",
    "Cargo.lock",
    "Gemfile.lock",
    "composer.lock",
    "go.sum",
    "flake.lock",
    "Pipfile.lock",
}

_SKIP_SUFFIXES: set[str] = {
    ".min.js",
    ".min.css",
    ".map",
    ".pyc",
    ".pyo",
    ".whl",
    ".egg-info",
}

# Approximate token budget for the entire context message (~30k tokens ≈ 120k chars)
_TOKEN_BUDGET_CHARS = 120_000


def context_hook(
    messages: list[Message],
    **kwargs,
) -> Generator[Message | StopPropagation, None, None]:
    """Active Context Discovery hook.

    Scans the workspace for relevant files based on recent messages and
    injects them into the context.

    Args:
        messages: List of conversation messages
        **kwargs: Includes workspace and manager (optional)
    """
    from ..util.context import use_fresh_context

    # Check if fresh context mode is enabled (opt-in)
    if not use_fresh_context():
        return

    workspace = kwargs.get("workspace")
    if not workspace:
        return

    # Run active discovery
    try:
        files = select_relevant_files(
            messages, workspace, max_files=10, use_selector=True
        )
    except Exception as e:
        logger.error(f"Failed to select files with context selector: {e}")
        # Fallback to simple mention counting if selector fails
        files = list(get_mentioned_files(messages, workspace).keys())[:10]

    if not files:
        return

    sections = []

    # Include git status
    if status := git_status():
        sections.append(status)

    # Read contents of selected files, respecting skip lists and token budget
    total_chars = 0
    for f in files[:10]:
        if not f.exists():
            logger.info(f"File not found: {f}")
            continue

        # Skip known useless files (lockfiles, minified assets, etc.)
        if f.name in _SKIP_FILENAMES or any(f.name.endswith(s) for s in _SKIP_SUFFIXES):
            logger.info(f"Skipping non-useful file: {f.name}")
            continue

        try:
            display_path = file_to_display_path(f, workspace)
            with open(f) as file:
                content = file.read()
            if len(content) > 100_000:
                logger.info(f"Skipping large file: {display_path}")
                continue
            # Check token budget before adding
            if total_chars + len(content) > _TOKEN_BUDGET_CHARS:
                logger.info(
                    f"Token budget exhausted ({total_chars} chars used), "
                    f"skipping {display_path} ({len(content)} chars)"
                )
                continue
            total_chars += len(content)
            logger.info(
                f"Read file: {display_path} "
                f"(size={len(content)} chars, ~{len(content) // 4} tokens)"
            )
            sections.append(md_codeblock(display_path, content))
        except UnicodeDecodeError:
            logger.debug(f"Skipping binary file: {f}")
            sections.append(md_codeblock(str(display_path), "<binary file>"))
        except OSError as e:
            logger.warning(f"Error reading file {f}: {e}")

    if not sections:
        return

    cwd = Path.cwd()
    content = f"""# Context
Working directory: {cwd}

This context message is always inserted before the last user message.
It contains the current state of relevant files at the time of processing.
The file contents shown in this context message are the source of truth.
Any file contents shown elsewhere in the conversation history may be outdated.
This context message will be removed and replaced with fresh context on every new message.

""" + "\n\n".join(sections)

    logger.info(
        f"Active context injected: {len(content)} chars (~{len(content) // 4} tokens)"
    )
    yield Message("system", content)


def register():
    register_hook("active_context", HookType.GENERATION_PRE, context_hook)

```

### Core Architecture Module: `gptme/hooks/agents_md_inject.py`
```
"""
Inject AGENTS.md/CLAUDE.md/GEMINI.md files when the working directory changes.

When the user `cd`s to a new directory during a session, this hook checks if there
are any agent instruction files (AGENTS.md, CLAUDE.md, GEMINI.md) that haven't been
loaded yet. If found, their contents are injected as system messages.

This extends the tree-walking AGENTS.md loading from prompt_workspace() (which runs
at startup) to also work mid-session when the CWD changes.

The set of already-loaded files is shared with prompt_workspace() via the
_loaded_agent_files_var ContextVar defined in prompts.py, which seeds it at startup.

Subscribes to the centralized CWD_CHANGED hook type instead of independently
tracking pre/post CWD values.

In server mode (Flask), ContextVars don't propagate across HTTP request contexts, so
_loaded_agent_files_var starts as None on each request. To avoid re-injecting
already-loaded files, _get_loaded_files() falls back to scanning the conversation log
for <agent-instructions> system messages when the ContextVar is empty.

Agent-identity guard: instruction files inside a *different gptme agent workspace*
(a directory whose ``gptme.toml`` declares an ``[agent]`` name other than the
current session's agent) are never injected. In a multi-agent setup each agent's
workspace ``AGENTS.md`` typically defines that agent's identity, git identity and
operational rules, so loading it because of a ``cd`` would silently hand the
session another agent's persona. A short visible notice is emitted instead, once
per foreign workspace. Instruction files elsewhere (other projects, subdirectories
of the current workspace) still load as before, and each load is announced with a
short visible message naming the file.

See: https://github.com/gptme/gptme/issues/1513
See: https://github.com/gptme/gptme/issues/1521
See: https://github.com/gptme/gptme/issues/1958
"""

import hashlib
import logging
import os
import re
from collections.abc import Generator, Iterable
from pathlib import Path
from typing import Any

from ..config import get_config, get_project_config
from ..hooks import HookType, StopPropagation, register_hook
from ..logmanager import Log
from ..message import Message
from ..prompts import _loaded_agent_files_var, find_agent_files_in_tree
from ..util.context_dedup import _content_hash

# Prefix used to store content hashes (vs file paths) in _loaded_agent_files_var.
# Prevents path-identical-content re-injection when cwd changes to a git worktree.
_HASH_PREFIX = "ch:"

# Prefix used to record foreign agent workspaces already reported in
# _loaded_agent_files_var, so the "not loaded" notice is emitted only once.
_FOREIGN_PREFIX = "foreign-agent:"

_FOREIGN_TAG = "agent-workspace-skipped"

logger = logging.getLogger(__name__)


def _derive_loaded_files_from_log(log: Log) -> set[str]:
    """Scan the conversation log for already-injected agent instruction files.

    Used in server mode where ContextVars don't propagate across HTTP request
    contexts, causing _loaded_agent_files_var to start as None each request.
    Parses <agent-instructions source="..."> tags in system messages to rebuild
    the loaded-files set from the persistent conversation state.

    Also records content hashes (prefixed with ``ch:``) so that worktree copies
    with the same content but a different path are not re-injected.
    """
    loaded: set[str] = set()
    for msg in log.messages:
        if msg.role == "system":
            # Extract source paths from opening tags (works even if closing tag missing).
            for path_match in re.finditer(
                r'<agent-instructions source="([^"]+)">', msg.content
            ):
                path_str = path_match.group(1)
                try:
                    resolved = str(Path(path_str).expanduser().resolve())
                    loaded.add(resolved)
                except (OSError, ValueError):
                    loaded.add(path_str)
            # Extract content hashes from complete blocks so worktree copies with
            # identical content are also skipped.
            for block_match in re.finditer(
                r'<agent-instructions source="[^"]*">(.*?)</agent-instructions>',
                msg.content,
                re.DOTALL,
            ):
                loaded.add(f"{_HASH_PREFIX}{_content_hash(block_match.group(1))}")
            # Foreign agent workspaces already reported (notice emitted once).
            # Keyed by a hash of the resolved root, since the displayed path is
            # sanitized and may not round-trip.
            for skip_match in re.finditer(
                rf'<{_FOREIGN_TAG} id="([0-9a-f]+)"', msg.content
            ):
                loaded.add(f"{_FOREIGN_PREFIX}{skip_match.group(1)}")
    return loaded


def _foreign_root_id(root: Path) -> str:
    """Stable id for a foreign agent workspace root (dedup key for its notice).

    Hashed from the raw resolved path. ``_content_hash`` is the wrong tool
    here: it is for instruction text and collapses whitespace first, so two
    directories that differ only in whitespace (legal on POSIX) would share
    a notice id and the second workspace would never be announced.
    """
    return hashlib.sha256(str(root.resolve()).encode()).hexdigest()[:32]


def _get_loaded_files(log: Log | None = None) -> set[str]:
    """Get (or lazily initialize) the loaded agent files set for this context.

    Normally populated by prompt_workspace() at session start. In server mode,
    the ContextVar starts as None on each request (ContextVars don't propagate
    across Flask request contexts). When the ContextVar is empty and a log is
    provided, falls back to scanning the log for already-injected files to avoid
    re-injection after CWD changes.
    """
    files = _loaded_agent_files_var.get()
    if files is None:
        files = _derive_loaded_files_from_log(log) if log is not None else set()
        _loaded_agent_files_var.set(files)
    return files


def _format_display_path(agent_file: Path) -> str:
    """Format an agent file path for transcript display."""
    try:
        relative = agent_file.resolve().relative_to(Path.home())
        return f"~/{relative}"
    except ValueError:
        return str(agent_file.resolve())


def _agent_name_of(directory: Path) -> str | None:
    """Return the ``[agent]`` name declared by ``directory``'s gptme.toml, if any.

    Only consults the project config when a ``gptme.toml`` actually exists, so
    walking many plain directories doesn't churn the project-config cache.
    """
    if not (
        (directory / "gptme.toml").is_file()
        or (directory / ".github" / "gptme.toml").is_file()
    ):
        return None
    try:
        config = get_project_config(directory, quiet=True)
    except Exception as e:  # a malformed config shouldn't break the hook
        logger.debug(f"Could not load project config in {directory}: {e}")
        return None
    if config and config.agent and config.agent.name:
        return config.agent.name
    return None


def _session_identity(workspace: Path | None) -> tuple[str | None, set[Path]]:
    """Return the session's agent name and its own workspace roots.

    The agent name comes from the chat config's agent workspace when available,
    falling back to the session workspace's ``gptme.toml``. Own roots are the
    session workspace and agent path (resolved); an agent workspace at or above
    one of them is part of the session's own context, never foreign.
    """
    roots: set[Path] = set()
    name: str | None = None
    try:
        chat = get_config().chat
        if chat is not None and chat.agent is not None:
            roots.add(chat.agent.resolve())
            agent_config = chat.agent_config
            if agent_config and agent_config.name:
                name = agent_config.name
    except Exception as e:  # config problems shouldn't break the hook
        logger.debug(f"Could not determine session agent from chat config: {e}")
    if workspace is not None:
        ws = workspace.resolve()
        roots.add(ws)
        if name is None:
            name = _agent_name_of(ws)
    return name, roots


def _find_foreign_agent_root(
    agent_file: Path, session_name: str | None, own_roots: set[Path]
) -> tuple[Path, str] | None:
    """Find the foreign agent workspace that ``agent_file`` belongs to, if any.

    Walks up from the file's directory (stopping at home or the filesystem root)
    to the nearest directory whose gptme.toml declares an ``[agent]`` name. That
    workspace is *foreign* when it is not one of the session's own roots (or an
    ancestor of one) and its agent name differs from the session's. A session
    without an agent name treats every other agent workspace as foreign.

    Both the path the file was discovered at and its symlink-resolved target
    are checked, so a symlinked ``AGENTS.md`` is foreign if either location is.
    """
    locations = [Path(os.path.abspath(agent_file)).parent]
    resolved_parent = agent_file.resolve().parent
    if resolved_parent != locations[0]:
        locations.append(resolved_parent)
    for start in locations:
        found = _walk_to_agent_root(start, session_name, own_roots)
        if found is not None:
            return found
    return None


def _walk_to_agent_root(
    start: Path, session_name: str | None, own_roots: set[Path]
) -> tuple[Path, str] | None:
    """Walk up from ``start`` to the nearest agent root; return it if foreign."""
    home = Path.home().resolve()
    current = start
    while True:
        name = _agent_name_of(current)
        if name is not None:
            resolved = current.resolve()
            if any(root.is_relative_to(resolved) for root in own_roots):
                return None
            if session_name is not None and name == session_name:
                return None
            return resolved, name
        if current.resolve() == home or current == current.parent:
            ret
```

### Core Architecture Module: `gptme/hooks/anomaly_watchdog.py`
```
"""Opt-in behavioral anomaly watchdog for gptme sessions.

Monitors tool calls for three suspicious patterns:
- scope_escape: file write outside the session workspace / allowed directories
- write_storm: excessive file writes in a short sliding window
- novel_host: network call to a hostname not in the initial allowlist

Activation:
  GPTME_ANOMALY_WATCHDOG=warn    # log warnings, continue execution
  GPTME_ANOMALY_WATCHDOG=block   # block the tool call via TOOL_CONFIRM (skip)
  GPTME_ANOMALY_WATCHDOG=off     # disabled (default)

Optional tuning:
  GPTME_ANOMALY_ALLOWED_DIRS=dir1:dir2     # colon-separated extra allowed write dirs
  GPTME_ANOMALY_ALLOWED_HOSTS=host1,host2  # comma-separated trusted hostnames
  GPTME_ANOMALY_WRITE_LIMIT=20             # inclusive: the 20th write in the window trips the storm check (default: 20)
  GPTME_ANOMALY_WRITE_WINDOW=60            # sliding window in seconds (default: 60)
"""

from __future__ import annotations

import itertools
import json
import logging
import os
import threading
import time
from pathlib import Path
from typing import TYPE_CHECKING, Any
from urllib.parse import urlparse

from ..hooks import (
    HookType,
    current_conversation_id,
    current_session_id,
    register_hook,
)
from ..plugins.plugin import GptmePlugin

if TYPE_CHECKING:
    from collections.abc import Generator

    from ..hooks.confirm import ConfirmationResult
    from ..hooks.types import ToolExecutePostData, ToolExecutePreData
    from ..message import Message
    from ..tools.base import ToolUse

logger = logging.getLogger(__name__)

# Sliding windows of write timestamps (monotonic), keyed by session.
# A single process can host multiple sessions (e.g. ACP/server multi-workspace),
# so windows are keyed by the active conversation's logdir; sessions that
# cannot be resolved share a fallback key. Module-level state keeps detection
# immune to async-context resets (a fresh ContextVar copy would hide prior
# writes and defeat the burst window entirely).
#
# A server hosts several conversations in several threads, so every mutation
# of this dict is serialized by ``_WINDOW_LOCK``: an unguarded prune could
# raise ``KeyError`` between the snapshot and the delete (failing the hook
# open) and could drop timestamps another thread was recording.
_write_times_by_session: dict[str, list[float]] = {}
_WINDOW_LOCK = threading.Lock()

# Fallback window key for sessions that resolve to neither a logdir nor a
# conversation/session id (see ``_session_identity``). A counter kept in
# thread-local storage is unique per thread *object*, whereas
# ``threading.get_ident()`` is an OS thread id that the runtime recycles once a
# thread exits — a fresh worker would then inherit a dead worker's window and
# its already-settled timestamps. The key is still stable for the whole life of
# the thread, which is what the fallback needs across the per-prompt context
# copies a harness makes.
_thread_window_local = threading.local()
_thread_window_counter = itertools.count(1)

# Tool calls rejected by this watchdog, keyed by object identity with a short
# TTL. TOOL_CONFIRM fires before execution and TOOL_EXECUTE_POST after, and the
# same ``ToolUse`` object flows through both (it is the object published by
# ``get_current_tool_use``), so marking a rejection lets the post hook avoid
# counting a write that never happened. Without this, a burst of blocked
# attempts keeps refreshing the storm window and locks out later legitimate
# writes.
#
# Identity is used rather than the value because ``ToolUse`` holds list/dict
# fields, so hashing it raises TypeError. Entries are popped on first use and
# aged out by TTL, so a recycled id cannot outlive the call it belongs to.
#
# Like the write window, this ledger is shared by every conversation in the
# process, so its mutations are serialized by ``_REJECTED_LOCK``: the prune and
# the cap-``clear()`` are check-then-act sequences, and an unguarded clear could
# wipe a marker another thread had just written.
_rejected_calls: dict[int, float] = {}
_REJECTED_LOCK = threading.Lock()
_REJECTED_TTL = 300.0


def _thread_window_key() -> str:
    """Unique fallback window key, stable for the life of the thread."""
    key = getattr(_thread_window_local, "key", None)
    if key is None:
        key = f"thread-{next(_thread_window_counter)}"
        _thread_window_local.key = key
    return key


def _session_identity() -> tuple[str, bool]:
    """Return the write-storm window key and whether that identity is exact.

    The window has to satisfy two constraints at once: it must not merge two
    conversations (a burst in one would then block the other), and it must be
    *continuous* across the execution contexts a harness creates per prompt —
    ACP copies a fresh context for each turn, so a key minted per context would
    reset the window every turn and write-storm would never trip.

    Only an exact identity can satisfy both. In preference order: the
    conversation's log directory, the server's conversation/session id, then the
    thread — continuous across context copies within a worker, and unique per
    thread *object* (``_thread_window_key``), but still unable to separate two
    sessions that share one thread. ``exact=False`` therefore means "this window
    may not be the caller's own", and a finding from it is reported but never
    enforced (see ``_check_write_storm``).
    """
    try:
        from ..logmanager import LogManager

        log = LogManager.get_current_log()
    except ImportError:
        log = None
    if log is not None:
        return str(log.logdir), True

    if conversation_id := current_conversation_id.get():
        return f"conv-{conversation_id}", True
    if session_id := current_session_id.get():
        return f"session-{session_id}", True
    return _thread_window_key(), False


def _session_key() -> str:
    """Window key for the current session (see ``_session_identity``)."""
    return _session_identity()[0]


# Tools that perform file writes (for write_storm + scope_escape detection).
# ``patch_many`` is included: it edits an arbitrary number of files and
# accepts absolute targets, so leaving it out left a direct file-editing path
# with neither scope_escape nor write-storm coverage.
_WRITE_TOOLS = frozenset({"save", "append", "patch", "patch_many"})

# Browser-like tools that make network calls (for novel_host detection).
# Subtools (e.g. "browser.read_url", "browser.open_page") are matched by
# their namespace prefix.
_NETWORK_TOOLS = frozenset({"browser", "read_web"})

# Hostnames always considered trusted (loopback, localhost)
_BUILTIN_TRUSTED_HOSTS = frozenset({"localhost", "127.0.0.1", "::1", "0.0.0.0"})

_MAX_DETAIL_LEN = 200

# Skip reason prefix. The post hook reads it back to recognise a blocked call
# (see ``_result_was_blocked``), so writer and reader share one constant.
_BLOCK_PREFIX = "Blocked by anomaly_watchdog:"


def _tool_namespace(tool: str) -> str:
    """Strip subtool suffix: 'browser.read_url' -> 'browser'."""
    return tool.split(".", 1)[0]


def _mode() -> str:
    return os.environ.get("GPTME_ANOMALY_WATCHDOG", "off").lower()


def _enabled() -> bool:
    return _mode() in ("warn", "block")


def _write_limit() -> int:
    try:
        return int(os.environ.get("GPTME_ANOMALY_WRITE_LIMIT", "20"))
    except ValueError:
        return 20


def _write_window() -> float:
    try:
        return float(os.environ.get("GPTME_ANOMALY_WRITE_WINDOW", "60"))
    except ValueError:
        return 60.0


def _allowed_dirs() -> list[Path]:
    raw = os.environ.get("GPTME_ANOMALY_ALLOWED_DIRS", "")
    return [Path(p).resolve() for p in raw.split(":") if p.strip()]


def _allowed_hosts() -> frozenset[str]:
    raw = os.environ.get("GPTME_ANOMALY_ALLOWED_HOSTS", "")
    extra = frozenset(h.strip().lower() for h in raw.split(",") if h.strip())
    return _BUILTIN_TRUSTED_HOSTS | extra


def _quote(value: object) -> str:
    """Render an untrusted string safely for a system message.

    Tool-controlled text (paths, hostnames) must not be embedded raw into
    system messages — it could carry prompt-injection payloads. repr()
    escapes newlines and control characters; truncation bounds size.
    """
    text = repr(str(value))
    if len(text) > _MAX_DETAIL_LEN:
        text = text[: _MAX_DETAIL_LEN - 3] + "..."
    return text


def _extract_paths(tool_use: Any) -> list[Path]:
    """Extract the target path(s) of a save/append/patch tool call.

    Only explicit arguments are read. The ``patch`` tool's content is *literal
    file text* in gptme's conflict-marker format, not a unified diff, and the
    tool writes to exactly one place: its ``path`` argument (see
    ``execute_patch_impl``). A ``---``/``+++`` line inside that body is content
    being written — a pasted diff in a document, a test fixture, a markdown
    code block — so treating it as a destination produced false scope_escape
    hits that could block a valid patch in block mode.
    """
    paths: list[Path] = []

    if tool_use.kwargs:
        raw = tool_use.kwargs.get("path") or tool_use.kwargs.get("filename")
        if raw:
            paths.append(Path(raw))

    if tool_use.args:
        paths.append(Path(tool_use.args[0]))

    if tool_use.tool == "patch_many":
        paths.extend(_patch_many_paths(tool_use))

    return paths


def _patch_many_paths(tool_use: Any) -> list[Path]:
    """Every target of a ``patch_many`` call beyond its first argument.

    ``patch_many`` writes several files and takes its paths from three places:
    all positional arguments (simple format), the ``=== PATH: ... ===``
    headers in the payload (multi-hunk format), and the ``patches`` entries in
    kwargs (function-call format). The payload parsing is delegated to the tool
    itself so the two cannot drift; an unparseable payload is ignored here
    because the tool rejects it before writing anything anyway.
    """
    try:
        from ..tools import pa
```

### Core Architecture Module: `gptme/hooks/auto_confirm.py`
```
"""Auto-confirm hook for autonomous/non-interactive mode.

This hook automatically confirms all tool executions without user interaction.
Useful for autonomous mode, testing, or when tool confirmations should be skipped.
"""

import logging
from pathlib import Path
from typing import TYPE_CHECKING

from .confirm import ConfirmationResult

if TYPE_CHECKING:
    from ..tools.base import ToolUse

logger = logging.getLogger(__name__)


def auto_confirm_hook(
    tool_use: "ToolUse",
    preview: str | None = None,
    workspace: Path | None = None,
) -> ConfirmationResult:
    """Auto-confirm hook that always confirms execution.

    This hook is for autonomous/non-interactive mode where all tool
    executions should proceed without confirmation.
    """
    logger.debug(f"Auto-confirming tool execution: {tool_use.tool}")
    return ConfirmationResult.confirm()


def register():
    """Register the auto-confirm hook."""
    from . import HookType, register_hook

    register_hook(
        name="auto_confirm",
        hook_type=HookType.TOOL_CONFIRM,
        func=auto_confirm_hook,
        priority=0,
        enabled=True,
    )
    logger.debug("Registered auto-confirm hook")

```

### Core Architecture Module: `gptme/hooks/auto_snapshots.py`
```
"""Auto-snapshot hook for opt-in workspace rollback.

Wires :mod:`gptme.workspace_snapshot` into ``tool.execute.pre`` and
``tool.execute.post`` so write-capable tool calls record reversible
pre/post snapshots. See ``knowledge/technical-designs/workspace-rollback-auto-snapshots.md``
in the Bob repo for the full design.

Activation
----------
The hook is **opt-in**. It self-no-ops unless ``GPTME_AUTO_SNAPSHOTS`` is set to
a truthy value.  The preferred activation path is adding ``[plugin.auto_snapshots]``
to ``gptme.toml`` or ``~/.config/gptme/config.toml``; the plugin ``init`` sets the
env var automatically.  Power users can also set the env var directly.

Storage backend: ``$XDG_STATE_HOME/gptme/workspace-snapshots/<fingerprint>.git``
(an XDG-located shadow git repo, not a ``.gptme-snapshots/`` directory inside
the user's workspace).

Mutating-tool policy
--------------------
Always-mutating tools snapshot unconditionally::

    save, append, patch, morph

Conditionally mutating tools snapshot only when their payload matches a
conservative "obvious mutator" classifier::

    shell, tmux

Read-only or unclassified shell payloads are skipped. False negatives
(missed snapshots) are preferred over false positives (snapshotting every
``ls`` in a big repo).
"""

from __future__ import annotations

import logging
import os
import re
from contextvars import ContextVar
from pathlib import Path
from typing import TYPE_CHECKING, Any

from ..hooks import HookType, register_hook
from ..plugins.plugin import GptmePlugin
from ..workspace_snapshot import (
    DEFAULT_MAX_SNAPSHOTS,
    Shadow,
    init_shadow,
    prune,
    snapshot,
    tree_hash,
)

if TYPE_CHECKING:
    from collections.abc import Generator

    from ..hooks import StopPropagation
    from ..hooks.types import ToolExecutePostData, ToolExecutePreData
    from ..message import Message

logger = logging.getLogger(__name__)

# ContextVar so pre and post halves of one tool call share state.
_pre_tree_var: ContextVar[str | None] = ContextVar(
    "auto_snapshot_pre_tree", default=None
)

ALWAYS_MUTATING: frozenset[str] = frozenset({"save", "append", "patch", "morph"})
CONDITIONALLY_MUTATING: frozenset[str] = frozenset({"shell", "tmux", "ipython"})

# ipython is included because it can call open() / subprocess just like shell.
# Treat any ipython payload as conditionally mutating via the same classifier.

# Patterns that indicate a shell payload mutates the workspace.
# Conservative — prefer false negatives over false positives.
_SHELL_MUTATOR_PATTERNS: tuple[re.Pattern[str], ...] = (
    # Output redirection (anywhere on the line).
    re.compile(r"(?:^|[^|&])(?:>>?|1>|2>|&>)"),
    # tee writes to a file.
    re.compile(r"\btee\b"),
    # Heredoc/herestring writes.
    re.compile(r"<<-?'?\"?\w+"),
    # In-place editors.
    re.compile(r"\bsed\s+[^|]*-i\b"),
    re.compile(r"\bperl\s+[^|]*-p?i\b"),
    re.compile(r"\bawk\s+[^|]*-i\s+inplace\b"),
    # Filesystem mutators.
    re.compile(r"\b(?:touch|mkdir|rmdir|rm|mv|cp|ln|chmod|chown)\b"),
    # Tar/zip extracting into workspace.
    re.compile(r"\btar\s+[^|]*-x"),
    re.compile(r"\bunzip\b"),
    # VCS mutators that modify the working tree.
    re.compile(
        r"\bgit\s+(?:apply|restore|checkout|clean|reset|pull|merge|rebase|stash\s+pop)\b"
    ),
    # Common build/install/test tools that write into the workspace.
    # Negative lookahead excludes obvious read-only sub-commands so
    # 'pip show', 'cargo --version', 'npm list' don't trigger spurious snapshots.
    # Design goal: prefer false negatives over false positives.
    re.compile(
        r"\b(?:make|cmake|cargo|npm|yarn|pnpm|pip|uv|poetry)\b"
        r"(?!\s+(?:show|list|ls|info|view|help|search|--version|-V|outdated|audit|tree|metadata)\b)"
    ),
    # Python/shell test runners that may write reports.
    re.compile(r"\bpytest\b"),
)


def is_mutating_shell_payload(content: str | None) -> bool:
    """Return True if ``content`` looks like a workspace-mutating shell payload.

    Conservative: only positive signals trigger. Unknown / plain reads return
    False. See module docstring for the contract.
    """
    if not content:
        return False
    text = content.strip()
    if not text:
        return False
    return any(pat.search(text) for pat in _SHELL_MUTATOR_PATTERNS)


def is_mutating_tmux_payload(content: str | None) -> bool:
    """Return True if a tmux invocation runs a mutating shell payload.

    Handles statically visible cases only::

        new-session ... '<cmd>'
        split-window ... '<cmd>'
        respawn-pane ... '<cmd>'

    ``send-keys`` and pure pane manipulation are intentionally treated as
    non-mutating in v1.
    """
    if not content:
        return False
    text = content.strip()
    m = re.search(
        r"\b(?:new-session|split-window|respawn-pane)\b[^']*'([^']*)'",
        text,
    )
    if m:
        return is_mutating_shell_payload(m.group(1))
    m = re.search(
        r"\b(?:new-session|split-window|respawn-pane)\b[^\"]*\"([^\"]*)\"",
        text,
    )
    if m:
        return is_mutating_shell_payload(m.group(1))
    return False


def classify_tool_use(tool_name: str, content: str | None) -> bool:
    """Decide whether ``tool_name(content)`` should trigger a snapshot."""
    if tool_name in ALWAYS_MUTATING:
        return True
    if tool_name in CONDITIONALLY_MUTATING:
        if tool_name == "tmux":
            return is_mutating_tmux_payload(content)
        return is_mutating_shell_payload(content)
    return False


def _enabled() -> bool:
    return os.environ.get("GPTME_AUTO_SNAPSHOTS", "").lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _tool_payload(tool_use: Any) -> str | None:
    """Return the classifier payload for a tool call across tool formats.

    Markdown/XML tool calls populate ``content`` directly. Structured ``tool``
    format stores the payload in ``kwargs`` instead, for example:

    - ``shell`` / ``tmux``: ``{"command": ...}``
    - ``ipython``: ``{"code": ...}``
    """
    content = getattr(tool_use, "content", None)
    if isinstance(content, str) and content.strip():
        return content

    kwargs = getattr(tool_use, "kwargs", None)
    if not isinstance(kwargs, dict):
        return content if isinstance(content, str) else None

    tool_name = getattr(tool_use, "tool", None) or ""
    if tool_name in ("shell", "tmux"):
        payload = kwargs.get("command")
    elif tool_name == "ipython":
        payload = kwargs.get("code")
    else:
        payload = None

    if isinstance(payload, str) and payload:
        return payload
    return content if isinstance(content, str) else None


def _max_snapshots() -> int:
    raw = os.environ.get("GPTME_AUTO_SNAPSHOT_MAX")
    if not raw:
        return DEFAULT_MAX_SNAPSHOTS
    try:
        val = int(raw)
    except ValueError:
        return DEFAULT_MAX_SNAPSHOTS
    return max(1, val)


def _shadow_for(workspace: Path | None) -> Shadow | None:
    if workspace is None:
        return None
    try:
        return init_shadow(Path(workspace))
    except Exception as e:  # pragma: no cover — defensive
        logger.warning("auto-snapshot init failed: %s", e)
        return None


def _pre(
    data: ToolExecutePreData,
) -> Generator[Message | StopPropagation, None, None]:
    """Capture pre-tool snapshot if the tool is mutating."""
    if not _enabled():
        return
    if data.tool_use is None:
        return
    tool_use = data.tool_use
    tool_name = getattr(tool_use, "tool", None) or ""
    content = _tool_payload(tool_use)
    if not classify_tool_use(tool_name, content):
        _pre_tree_var.set(None)
        return
    shadow = _shadow_for(data.workspace)
    if shadow is None:
        return
    try:
        _pre_tree_var.set(
            None
        )  # reset before work; exception paths must not leak stale hash
        shadow.run("add", "-A")
        before = tree_hash(shadow, stage=False)
        snapshot(shadow, label=f"pre:{tool_name}", stage=False)
        _pre_tree_var.set(before)
    except Exception as e:  # pragma: no cover — defensive
        logger.warning("auto-snapshot pre failed: %s", e)
    return
    yield  # make generator — presence of `yield` makes this a generator; matches cwd_changed.py shape


def _post(
    data: ToolExecutePostData,
) -> Generator[Message | StopPropagation, None, None]:
    """Emit post-tool snapshot only when the workspace tree actually changed."""
    if not _enabled():
        return
    if data.tool_use is None:
        return
    tool_use = data.tool_use
    tool_name = getattr(tool_use, "tool", None) or ""
    content = _tool_payload(tool_use)
    if not classify_tool_use(tool_name, content):
        return
    shadow = _shadow_for(data.workspace)
    if shadow is None:
        return
    try:
        before = _pre_tree_var.get()
        shadow.run("add", "-A")
        after = tree_hash(shadow, stage=False)
        if before is not None and after is not None and before == after:
            # No mutation actually happened; skip noise.
            return
        snapshot(shadow, label=f"post:{tool_name}", stage=False)
        prune(shadow, keep=_max_snapshots())
    except Exception as e:  # pragma: no cover — defensive
        logger.warning("auto-snapshot post failed: %s", e)
    return
    yield  # make generator — presence of `yield` makes this a generator; matches cwd_changed.py shape


def register() -> None:
    """Register pre/post auto-snapshot hooks."""
    register_hook(
        "auto_snapshots.pre",
        HookType.TOOL_EXECUTE_PRE,
        _pre,
        priority=90,  # After cwd_changed.store (100) but before user hooks
    )
    register_hook(
        "auto_snapshots.post",
        HookType.TOOL_EXECUTE_POST,
        _post,
        priority=90,
    )
    logger.debug("Registered auto-snapshot hooks")


def _init_from_config(config: object) -> None:
    """Activate auto-snapshots when ``[plugin.au
```

### Core Architecture Module: `gptme/hooks/aw_watcher_agent.py`
```
"""Opt-in ActivityWatch session emission via aw-watcher-agent.

This hook plugin is intentionally small and fail-open:

- it shells out to the external ``aw-watcher-agent`` CLI if configured
- it emits ``session.start`` / ``session.end`` lifecycle events and per-tool
  activity heartbeats
- failures are logged and ignored so telemetry never breaks a session

Activation:

- set ``GPTME_AW_WATCHER_AGENT=1``, or
- add ``[plugin.aw_watcher_agent]`` to config to enable it automatically
"""

from __future__ import annotations

import logging
import os
import shlex
import subprocess
import time
from contextvars import ContextVar
from pathlib import Path
from typing import TYPE_CHECKING

from ..hooks import HookType, register_hook
from ..llm.models import get_default_model
from ..logmanager import LogManager
from ..plugins.plugin import GptmePlugin
from .server_confirm import current_session_id

if TYPE_CHECKING:
    from collections.abc import Generator

    from ..hooks import StopPropagation
    from ..hooks.types import ToolExecutePostData, ToolExecutePreData
    from ..message import Message

logger = logging.getLogger(__name__)

_tool_start_times_var: ContextVar[dict[int, float] | None] = ContextVar(
    "aw_watcher_agent_tool_start_times",
    default=None,
)
# Prune entries older than this to prevent accumulation when POST is skipped (e.g. tool exception)
_MAX_TOOL_AGE_S = 300


def _enabled() -> bool:
    return os.environ.get("GPTME_AW_WATCHER_AGENT", "").lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _command_prefix() -> list[str]:
    raw = os.environ.get("GPTME_AW_WATCHER_AGENT_COMMAND", "aw-watcher-agent")
    parts = shlex.split(raw)
    return parts or ["aw-watcher-agent"]


def _workspace_name(workspace: Path | None) -> str | None:
    if workspace is None:
        return None
    try:
        return workspace.name or str(workspace)
    except Exception:  # pragma: no cover - defensive
        return str(workspace)


def _model_name() -> str | None:
    model = get_default_model()
    if model is None:
        return None
    return model.full


def _base_args(session_id: str, workspace: Path | None) -> list[str]:
    args = [
        "--harness",
        "gptme",
        "--session-id",
        session_id,
    ]
    if model := _model_name():
        args.extend(["--model", model])
    if workspace_name := _workspace_name(workspace):
        args.extend(["--workspace", workspace_name])
    if trigger := os.environ.get("GPTME_AW_WATCHER_TRIGGER"):
        args.extend(["--trigger", trigger])
    if category := os.environ.get("GPTME_AW_WATCHER_CATEGORY"):
        args.extend(["--category", category])
    if server := os.environ.get("GPTME_AW_WATCHER_SERVER"):
        args.extend(["--server", server])
    if hostname := os.environ.get("GPTME_AW_WATCHER_HOSTNAME"):
        args.extend(["--hostname", hostname])
    return args


def _run_aw(argv: list[str]) -> None:
    try:
        result = subprocess.run(
            argv,
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except OSError as exc:
        logger.debug("aw-watcher-agent unavailable: %s", exc)
        return
    except subprocess.TimeoutExpired as exc:
        logger.warning("aw-watcher-agent timed out: %s", exc)
        return

    if result.returncode != 0:
        logger.warning(
            "aw-watcher-agent exited %s: %s",
            result.returncode,
            (result.stderr or result.stdout).strip(),
        )
    elif result.stderr.strip():
        logger.debug("aw-watcher-agent stderr: %s", result.stderr.strip())


def _ensure_tool_start_times() -> dict[int, float]:
    tool_start_times = _tool_start_times_var.get()
    if tool_start_times is None:
        tool_start_times = {}
        _tool_start_times_var.set(tool_start_times)
    return tool_start_times


def _current_tool_session_id() -> str | None:
    manager = LogManager.get_current_log()
    logdir = getattr(manager, "logdir", None) if manager is not None else None
    if logdir is not None:
        return Path(logdir).name
    return current_session_id.get()


def emit_start(
    logdir: Path,
    workspace: Path | None,
    initial_msgs: list[Message],
) -> Generator[Message | StopPropagation, None, None]:
    """Emit a session-start event keyed by the conversation/logdir id."""
    del initial_msgs
    if not _enabled():
        return
    session_id = logdir.name
    argv = _command_prefix() + ["emit-start", *_base_args(session_id, workspace)]
    _run_aw(argv)
    return
    yield


def emit_end(
    manager: LogManager, **kwargs
) -> Generator[Message | StopPropagation, None, None]:
    """Emit a session-end event matching the earlier session-start emission."""
    if not _enabled():
        return
    logdir = getattr(manager, "logdir", None) or kwargs.get("logdir")
    workspace = getattr(manager, "workspace", None)
    if logdir is None:
        return
    session_id = Path(logdir).name
    argv = _command_prefix() + ["emit-end", *_base_args(session_id, workspace)]
    _run_aw(argv)
    return
    yield


def record_tool_start(
    data: ToolExecutePreData,
) -> Generator[Message | StopPropagation, None, None]:
    """Record the start time for a tool so the post hook can emit duration."""
    if not _enabled():
        return
    tool_start_times = _ensure_tool_start_times()
    # Prune stale entries from tools whose POST hook was never called (e.g. exception).
    # Do this at PRE time so the POST path stays side-effect-free.
    now = time.monotonic()
    stale = [k for k, v in tool_start_times.items() if now - v > _MAX_TOOL_AGE_S]
    for k in stale:
        del tool_start_times[k]
    if data.tool_use is not None:
        tool_start_times[id(data.tool_use)] = now
    _tool_start_times_var.set(tool_start_times)
    return
    yield


def emit_tool_activity(
    data: ToolExecutePostData,
) -> Generator[Message | StopPropagation, None, None]:
    """Emit one per-tool activity heartbeat after a tool finishes."""
    if not _enabled():
        return

    tool_use = data.tool_use
    workspace = data.workspace
    if tool_use is None:
        return

    session_id = _current_tool_session_id()
    if not session_id:
        return

    tool_start_times = _ensure_tool_start_times()
    started_at = tool_start_times.pop(id(tool_use), None)
    _tool_start_times_var.set(tool_start_times)
    duration_ms = 0
    if started_at is not None:
        duration_ms = max(int(round((time.monotonic() - started_at) * 1000)), 0)

    argv = _command_prefix() + [
        "emit-activity",
        *_base_args(session_id, workspace),
        "--tool",
        tool_use.tool,
        "--status",
        # TOOL_EXECUTE_POST only fires on the success path in tools/base.py;
        # exceptions skip the post hook entirely, so "success" is accurate here.
        "success",
        "--duration-ms",
        str(duration_ms),
    ]
    _run_aw(argv)
    return
    yield


def register() -> None:
    """Register aw-watcher-agent lifecycle hooks."""
    register_hook("aw_watcher_agent.start", HookType.SESSION_START, emit_start)
    register_hook("aw_watcher_agent.end", HookType.SESSION_END, emit_end)
    register_hook(
        "aw_watcher_agent.tool_pre", HookType.TOOL_EXECUTE_PRE, record_tool_start
    )
    register_hook(
        "aw_watcher_agent.tool_post", HookType.TOOL_EXECUTE_POST, emit_tool_activity
    )
    logger.debug("Registered aw-watcher-agent hooks")


def _init_from_config(config: object) -> None:
    """Enable the plugin when ``[plugin.aw_watcher_agent]`` exists."""
    user_cfg = getattr(getattr(config, "user", None), "plugin", {}) or {}
    project = getattr(config, "project", None)
    project_cfg = getattr(project, "plugin", {}) or {} if project else {}

    merged: dict[str, object] = {}
    if isinstance(user_cfg, dict):
        merged.update(user_cfg.get("aw_watcher_agent", {}) or {})
    if isinstance(project_cfg, dict):
        merged.update(project_cfg.get("aw_watcher_agent", {}) or {})

    if (
        merged
        or (isinstance(user_cfg, dict) and "aw_watcher_agent" in user_cfg)
        or (isinstance(project_cfg, dict) and "aw_watcher_agent" in project_cfg)
    ):
        os.environ.setdefault("GPTME_AW_WATCHER_AGENT", "1")

    config_to_env = {
        "command": "GPTME_AW_WATCHER_AGENT_COMMAND",
        "server": "GPTME_AW_WATCHER_SERVER",
        "hostname": "GPTME_AW_WATCHER_HOSTNAME",
        "trigger": "GPTME_AW_WATCHER_TRIGGER",
        "category": "GPTME_AW_WATCHER_CATEGORY",
    }
    for key, env_name in config_to_env.items():
        value = merged.get(key)
        if value not in (None, ""):
            os.environ.setdefault(env_name, str(value))


plugin = GptmePlugin(
    name="aw_watcher_agent",
    register_hooks=register,
    init=_init_from_config,
)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3921** (2026-09-23): **bug(server): subscription OAuth background thread has no timeout — resource leak on long-running servers**
  *Symptoms*: ## Problem  `_run_subscription_oauth()` runs in a `daemon=True` background thread with **no timeout**. If the OAuth flow never completes (user closes browser, network error, provider is down), the thread runs indefinitely.  The in-memory task store prunes tasks after 15 minutes (`_SUBSCRIPTION_TASK_TTL_S = 15 * 60`), so after 15 min the task_id is gone and the client gets a 404. But the background thread continues blocking, consuming a thread from the OS pool and holding whatever resources the OAuth callbacks use.  On a long-running gptme-server with multiple abandoned OAuth attempts, this accumulates leaked threads.  ## Specific scenario  ``` User clicks "Connect with OpenRouter" → task starts User closes browser tab Server: _subscription_tasks[task_id] gets pruned at t+15m Server: background thread is still blocked inside oauth_get_api_key() waiting         for the local HTTP callback server (typically PKCE redirect) Thread: runs until the process exits (daemon=True) or an exception fires ```  ## Fix  Wrap `_run_subscription_oauth` in a `concurrent.futures.ThreadPoolExecutor` with a timeout, or pass a `timeout` parameter to the provider OAuth functions. When the timeout fires, mark the task as `error` and clean up the thread.  Alternatively, the local HTTP callback server (used by PKCE flows) should have a 15-minute `SO_TIMEOUT` so it raises a socket exception when the TTL expires.  ## Related  - PR gptme/gptme#3912 — introduces this pattern - gptme/gptme#3918 — headless en
  **Post-Mortem & Fix Analysis**:
  > Verified resolved by gptme/gptme#3923 (merged).  All three requirements from the issue are addressed: - **Timeout parameter** added to all three OAuth entry points (OpenAI, Grok, OpenRouter) with a TTL-derived budget so threads stop no later than when their task entry is pruned - **OpenAI provider** fixed to use a proper deadline loop (matching the Grok pattern) instead of the unbounded while-loop - **Error transition** — `TimeoutError` from the provider now marks the task `status: error`  Tests confirm: `test_oauth_timeout_passed_to_provider` and `test_oauth_timeout_marks_task_error` cover the two key behaviors.

- **Issue #3919** (2026-09-23): **bug(webui): subscription OAuth polling interval leaks when SetupWizard unmounts**
  *Symptoms*: ## Problem  In `SetupWizard.tsx`, `subscriptionPollRef.current` (a `setInterval`) is started in `handleSubscriptionConnect` but there is no `useEffect` cleanup to stop it when the component unmounts.  If the user closes the SetupWizard (Escape key, click outside, or navigate away) while a subscription OAuth flow is in progress, the interval continues firing every 2 seconds. Each tick: 1. Makes a `GET /api/v2/user/subscription-connect/{task_id}` network request 2. Calls `setSubscriptionConnecting`, `setSubscriptionTaskId`, etc. on an unmounted component → React "Can't perform a React state update on an unmounted component" warning in dev; silent in production 3. Eventually calls `finishSubscriptionConnect` which calls `completeSetup()` and `setStep('complete')` on the closed wizard  The interval continues running until: - The task resolves (connected or error) - The 5-minute `SUBSCRIPTION_POLL_TIMEOUT_MS` expires - The browser tab is closed  ## Fix  Add a `useEffect` cleanup:  ```typescript useEffect(() => {   return () => {     stopSubscriptionPoll();   }; }, []); ```  Or, preferably, use `useEffect` to manage the interval rather than `useRef` + `setInterval` directly, so React's lifecycle controls it.  ## Related  - PR gptme/gptme#3912 — adds subscription provider setup - `webui/src/components/SetupWizard.tsx:subscriptionPollRef` — the leaking ref
  **Post-Mortem & Fix Analysis**:
  > Fixed by #3922 (merged 2026-09-23). The merged PR: - Added `subscriptionAbortRef` (AbortController) to cancel in-flight requests - Extended `stopSubscriptionPoll()` to also abort the controller - The existing `useEffect` cleanup already calls `stopSubscriptionPoll()`, now covering both interval clearing and request abort  All 38 SetupWizard tests pass, including the new regression test 'aborts the in-flight subscription poll and clears the interval on unmount'.

- **Issue #3918** (2026-09-23): **feat(subscription): detect headless server and return error immediately instead of hanging pending**
  *Symptoms*: ## Problem  When gptme-server runs in a headless environment (Docker container, SSH session, VPS, LXC), `webbrowser.open()` silently returns `False` and does nothing. The subscription OAuth background thread then blocks indefinitely waiting for an OAuth callback that will never arrive.  The client polls for up to 5 minutes (`SUBSCRIPTION_POLL_TIMEOUT_MS = 5 * 60 * 1000`) and then shows a generic "Sign-in timed out. Please try again." — but the actual cause (no browser available) is never communicated to the user.  ## Reproduction  1. Run `gptme-server` in a headless container (no X display, no DISPLAY env var) 2. Open the WebUI in a browser on a different machine 3. Click "Connect with subscription" for any provider 4. Wait 5 minutes → see "Sign-in timed out"  The user has no idea why it failed or what to do instead.  ## Impact  Common gptme-server deployments are headless: Docker containers, cloud VMs, SSH tunnels, LXC containers. This feature effectively doesn't work for them, but fails silently in the worst possible way (long timeout, no guidance).  ## Fix  In `_run_subscription_oauth`, use `webbrowser.open()` return value to detect the headless case:  ```python import webbrowser  # Before: call provider-specific oauth_authenticate() that internally calls webbrowser.open() # After: detect first whether a browser can be opened  # Option A: wrap the webbrowser module to intercept the open() call # Option B: check DISPLAY/WAYLAND_DISPLAY/WSL env vars upfront in the POST endpo
  **Post-Mortem & Fix Analysis**:
  > Verified resolved on master via gptme/gptme#3912 (`fc2951579`).  Checked `gptme/server/api_v2.py` on origin/master:  - `_is_headless_server()` covers CI, `GPTME_HEADLESS`, SSH-without-display, Windows services, and Unix hosts without `DISPLAY`/`WAYLAND_DISPLAY` - `_on_url_ready` stores `oauth_url` and returns `False` on headless so the PKCE verifier and loopback listener stay alive - Setup Wizard renders that URL as a clickable link  That is Option C from this issue (expose the URL) rather than fail-fast-error, which would drop the verifier. Closing. 

- **Issue #3906** (2026-10-01): **Windows desktop first-run: gptme-app naming, green icon, font, subscription providers**
  *Symptoms*: ## Description  Erik's Windows first-run of the packaged desktop app (from [ErikBjare/bob#659](https://github.com/ErikBjare/bob/issues/659), 2026-09-22). Local eventually connected; cloud did not; provider setup is API-key-only; installer identity is still `gptme-tauri`.  Screenshots are on the source comment: https://github.com/ErikBjare/bob/issues/659#issuecomment-5778159963  ## What happened  1. **Local connect failed at first, then worked.** Screenshot 1 shows the app on `FLEET.GPTME.AI` with "Not connected to API". Screenshot 2 shows `LOCAL` connected and the "Provider setup required" banner. This matches a first-run race / wrong initial server, not a dead sidecar. 2. **Cloud did not work.** The first screenshot is selected onto `fleet.gptme.ai` and never connected. That is the cloud/fleet preset, not a completed gptme.ai OAuth exchange. 3. **Font rendering is broken on Windows.** Source strings are sentence case (`What are you working on?`, `Not connected to API. …`). Linux AppImage renders them correctly. The Windows screenshots show the same copy as all-caps / wrong typeface. `webui/src/index.css` loads Inter from `https://rsms.me/inter/inter.css` with `font-family: 'Inter var'`, but Tauri CSP is `style-src 'self' 'unsafe-inline'; font-src 'self' data:` — the CDN font is blocked in the desktop shell. Linux falls back to a sane system font; WebView2 does not. 4. **Provider panel is API-key only.** `webui/src/utils/apiKeyProviders.ts` lists Anthropic/OpenAI/OpenRouter/G
  **Post-Mortem & Fix Analysis**:
  > Naming slice is up: gptme/gptme#3907 (`productName` / Android launcher → `gptme-app`).  Leaving this issue open for the rest of the checklist: Inter/CSP font on WebView2, 16px title-bar icon, SetupWizard subscription/PKCE, Windows local/cloud first-run. Source report is ErikBjare/bob#659. 
  > Font fix is up: gptme/gptme#3908 ( bundles the font with Vite so it loads under the Tauri CSP  on Windows).
  > Filed gptme/gptme#3909 for the subscription provider UI work — has the full architecture breakdown (backend-triggered OAuth via existing Python modules, ~1 day estimate). Leaves #3906 AC item 4 tracked there.

- **Issue #3760** (2026-09-08): **fix(cli): guard against positional conversation IDs after --resume**
  *Symptoms*: ## Problem The CLI accepts `gptme --resume CONVERSATION_ID`, but `--resume` is a boolean flag: the apparent ID becomes a new prompt sent to the most recent conversation, rather than selecting that ID. This can silently target the wrong history and trigger an unintended model request.  This became confusing when multiple conversations with the same workspace and initial prompt were started sequentially in one terminal pane. Explicit `--resume --name ID` correctly loaded the named (older/shorter) conversation; the longer conversation remained intact under another ID. No history truncation was established.  ## Expected Fail early for an apparent positional session ID with actionable `--resume --name ID` guidance; retain `--resume "continue"` and a literal escape via `--resume -- ID`. Help should explain current-workspace selection and explicit names.  ## Test coverage - Existing session IDs and nonexistent generated-looking IDs produce an early usage error, not a prompt/model request. - Explicit name selects the requested session even if another is newer. - Ordinary continuation and literal-ID prompts still work. - Exercise the real log loader after CLI selection with a 270-message synthetic history; verify the full tail and both session files remain intact.  Independent from #3758 (unbounded automatic directory inclusion after prompt submission). 
  **Post-Mortem & Fix Analysis**:
  > Verified fully resolved by gptme/gptme#3763, merged to master at `ddbd6b42` (2026-09-08T12:34:05Z).  The issue's Expected + Test coverage all landed:  - Positional conversation IDs after boolean `--resume` fail early, before setup, with `--resume --name ID` guidance (`test_resume_rejects_positional_conversation_id_before_setup` on master) - `--resume "continue"` and the `--resume -- ID` literal escape are retained - Help/docs (`docs/usage.rst`) explain current-workspace selection and explicit names - Explicit `--resume --name` still selects the requested session  This is a 1:1 CLI guard, not an epic. Closing.

- **Issue #3759** (2026-09-08): **fix(shell): denylist unanchored re.search false-positives (rm -rf /tmp, pkill, git commit --allow-empty)**
  *Symptoms*: ## Summary  The shell denylist in `gptme/tools/shell_validation.py` uses **unanchored `re.search`** with partial-matching patterns, producing false-positive denials on perfectly safe, targeted commands. Live-confirmed for `rm -rf <tmp-path>`, `pkill <name>`, and `git commit --allow-empty`.  ## Reproduction  ```python from gptme.tools.shell_validation import is_denylisted for c in [     "rm -rf /tmp/goon-hang-aff-19815",   # safe: specific tmp dir     "rm -rf /Users/foo/bar",             # safe: specific path     "pkill -f hangproof",                # safe: targeted name     "git commit --allow-empty -m x",     # safe: no bulk staging ]:     print(is_denylisted(c)) ```  Observed (all falsely denied): ``` rm -rf /tmp/goon-hang-aff-19815  -> DENIED 'rm -rf /'       (Destructive file operations) rm -rf /Users/foo/bar           -> DENIED 'rm -rf /'       (Destructive file operations) pkill -f hangproof              -> DENIED 'pkill '          (Killing processes indiscriminately) git commit --allow-empty -m x   -> DENIED 'git commit --all' (bulk git) ```  ## Root cause  In `is_denylisted` (`gptme/tools/shell_validation.py:~601`), each denylist pattern is matched with `re.search(pattern, cmd)` — unanchored substring matching against the whole raw command. Patterns that should match a specific token instead prefix-match longer tokens or any occurrence:  - `r"rm\s+-rf\s+/"` matches the space + any path rooted at `/` (e.g. `/tmp/...`), not just `rm -rf /` alone. - `r"pkill\s"` matches 
  **Post-Mortem & Fix Analysis**:
  > Duplicate of #3757, filed concurrently while this session was recovering from #3758. The rm root-operand and --allow-empty prefix matches are independently verified there. The pkill claim here is not the same bug: the explicit pkill/killall deny rule is intentional policy, and its reason recommends kill <PID>, not pkill. Changing that policy would require a separate proposal.

- **Issue #3758** (2026-09-08): **fix(cli): mentioning / recursively scans root with Ctrl-C ineffective during path inclusion**
  *Symptoms*: ## Summary An ordinary user message mentioning a standalone slash triggers recursive root-directory enumeration during automatic path inclusion, before the user message is persisted or sent to the model. Ctrl-C prints “Interrupted. Press Ctrl-D to exit.” without cancelling this preprocessing.  Observed in the interactive CLI on macOS/Python 3.13, editable checkout at 21125a6144b7e32a73659cae8994f4185a17a946. The live process was consuming approximately 89% CPU and 823 MB memory. Native sampling showed the main thread inside sorted()/generator/path-comparison work, not a shell-output wait. A Python-level live stack was unavailable due to macOS attach permissions, so attribution of that specific process remains an inference supported by the exact-input reproduction and source.  ## Safe reproduction of the trigger Do NOT enumerate the real root filesystem. This mocks only directory listing: ```python from pathlib import Path from unittest.mock import patch from gptme.message import Message from gptme.util.context import include_paths  with patch(     "gptme.util.context._dir_to_listing",     return_value="[listing suppressed]", ) as listing:     include_paths(         Message("user", "also file the rm -rf / false-positive"),         Path.cwd(),     )     print(listing.call_args_list) ``` Actual: `[call(PosixPath('/'), '/')]`.  ## Source findings - `_resource_to_codeblock` treats existing directory paths as attachments and calls `_dir_to_listing`. - `_dir_to_listing` first tries 
  **Post-Mortem & Fix Analysis**:
  > Taking ownership of #3757 and #3758 together. I have a dedicated implementation session on both verified regressions now; it will keep the fixes scoped, add caller-level/bounded-enumeration and denylist-boundary tests, and report separate PR links and CI results here.
  > Implemented in https://github.com/gptme/gptme/pull/3762  Standalone `/` no longer triggers recursive root listing. Directory attachment skips too-broad paths, rglob is bounded during traversal (not after collecting the whole tree), and `include_paths` runs interruptible so Ctrl-C cancels preprocessing. Explicit project subdirectory listings are preserved. Tests mock `_dir_to_listing` and do not scan the real root.
  > Second real occurrence narrowed to an even smaller non-command trigger: the ordinary Markdown heading `**Still open / not done:**` calls `_dir_to_listing(PosixPath("/"), "/")` through include_paths (verified with listing mocked). A pasted summary containing this heading wedged before persisting the user message. Separately, prose mentioning `rm -rf /tmp,` triggers a /tmp listing. This is not limited to shell-command prompts.

- **Issue #3757** (2026-09-09): **fix(shell): denylist prefix-matches absolute cleanup paths and --allow-empty**
  *Symptoms*: ## Summary The shell denylist matches prefixes rather than complete arguments. An explicit temporary-directory cleanup is rejected as root deletion; similarly, `--allow-empty` is rejected as `--all`.  Verified against commit 21125a6144b7e32a73659cae8994f4185a17a946, using the installed editable package.  ## Safe reproduction (no shell commands executed) ```python from gptme.tools.shell_validation import is_denylisted for command in [     "rm -rf /tmp/gptme-fp-example",     "rm -rf /",     "git commit --allow-empty -m x", ]:     denied, reason, matched = is_denylisted(command)     print(command, denied, repr(matched)) ``` Actual: ```text rm -rf /tmp/gptme-fp-example True 'rm -rf /' rm -rf / True 'rm -rf /' git commit --allow-empty -m x True 'git commit --all' ```  ## Cause / expected behavior In `gptme/tools/shell_validation.py`, `re.search` applies patterns including `rm\s+-rf\s+/` and `git\s+commit\s+--all` without an argument-end boundary.  Distinguish an exact root operand from a longer absolute path, and an exact option from a longer option. An explicit tmp path should not be classified as deletion of root (normal confirmation/policy may still apply). Preserve root-deletion protection and add regression tests for argument boundaries, quoting, and shell separators.  The allow-empty finding was also mentioned in #3756, but is independent of that report's unverified hang diagnosis. 
  **Post-Mortem & Fix Analysis**:
  > Implemented in https://github.com/gptme/gptme/pull/3761  Denylist patterns now require operand/option boundaries: `rm -rf /tmp/...` and `git commit --allow-empty` are no longer prefix-matched as root deletion / `--all`. True `rm -rf /` (including separators and quoted `/`) and `git commit --all`/`-a`/`-am` stay denied. `pkill` policy unchanged. Tests cover the cases from this issue without executing destructive commands.
  > Verified on master `65d888f` (gptme/gptme#3761 squash-merge), without executing the shell commands:  ```text rm -rf /tmp/gptme-fp-example   allowed rm -rf /                       denied ('rm -rf /') git commit --allow-empty -m x  allowed git commit --all               denied git commit -a / -am            denied ```  Root aliases, separators, and grouped `(rm -rf /)` still deny; quoted `echo '(rm -rf /)'` does not. `tests/test_tools_shell_validation.py`: 447 passed.  This matches the issue criteria: argument-end boundaries, tmp path not treated as root, `--allow-empty` not treated as `--all`, root-deletion preserved. Closing. 

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

### Incident Patch 1: `d56550f1` (2026-10-05)
**Commit Message**: fix(cli): reject unknown --provider in models list instead of listing nothing (#4184)

* fix(cli): reject unknown --provider in models list instead of listing nothing

A mistyped provider (e.g. --provider antropic) printed an empty
'Available models:' header with exit 0. Validate against the known
built-in/custom/plugin providers and fail with the valid choices.
Also dedupes the provider-list construction into get_known_providers().

Git-Session-Id: 7757

* fix(cli): run models list --provider validation inside JSON output protection

Git-Session-Id: a8c4c42b-4270-582e-b6e3-4fbb3449c464

* fix(test): expect ResponsesStreamError instead of openai.APIError

The test was checking for openai.APIError but _stream_responses_events
raises ResponsesStreamError for response.failed and error events.
Updated test to check for the actual exception type and verify the
code and message attributes rather than a body dict.

Git-Session-Id: 65c0d103-5f31-43f1-ac9f-282ce4edd7ff

**File**: `gptme/cli/util.py` (modified, +16/-0)
```diff
@@ -1595,6 +1595,18 @@ def models_list(
 ):
     """List available models."""
 
+    def validate_provider() -> None:
+        if not provider:
+            return
+        from ..llm.models.listing import get_known_providers  # fmt: skip
+
+        known = sorted(str(p) for p in get_known_providers())
+        if provider not in known:
+            raise click.BadParameter(
+                f"unknown provider '{provider}'. Known providers: {', '.join(known)}",
+                param_hint="--provider",
+            )
+
     if as_json:
         # Keep JSON output machine-readable even if provider discovery logs warnings.
         # redirect_stdout/redirect_stderr suppresses print() noise; logging.disable
@@ -1608,6 +1620,9 @@ def models_list(
             with redirect_stdout(io.StringIO()), redirect_stderr(io.StringIO()):
                 from ..llm import list_available_providers  # fmt: skip
 
+                # Config loading in provider discovery can warn; keep it inside the
+                # JSON protection so the payload stays parseable.
+                validate_provider()
                 configured = (
                     {
                         configured_provider
@@ -1630,6 +1645,7 @@ def models_list(
         click.echo(json.dumps([model_to_dict(model) for model in models], indent=2))
         return
 
+    validate_provider()
     list_models(
         provider_filter=provider,
         show_pricing=pricing,
```

**File**: `gptme/llm/models/listing.py` (modified, +19/-35)
```diff
@@ -159,6 +159,23 @@ def _fetch_models_parallel(
         )
 
 
+def get_known_providers() -> list[Provider]:
+    """All provider names gptme can list models for: built-in, custom (config) and plugin."""
+    from ...config import get_config  # fmt: skip
+
+    custom_providers: list[Provider] = [
+        CustomProvider(p.name) for p in get_config().user.providers
+    ]
+    plugin_providers: list[Provider] = [
+        CustomProvider(p.name) for p in discover_provider_plugins()
+    ]
+    return (
+        list(cast(list[Provider], list(MODELS.keys())))
+        + custom_providers
+        + plugin_providers
+    )
+
+
 def get_model_list(
     provider_filter: str | None = None,
     vision_only: bool = False,
@@ -183,8 +200,6 @@ def get_model_list(
         List of ModelMeta objects
     """
 
-    from ...config import get_config  # fmt: skip
-
     global _model_list_cache, _model_list_cache_time
 
     # Check cache for unfiltered dynamic fetches
@@ -206,24 +221,8 @@ def get_model_list(
 
     all_models: list[ModelMeta] = []
 
-    # Get custom providers from config
-    config = get_config()
-    custom_providers: list[Provider] = [
-        CustomProvider(p.name) for p in config.user.providers
-    ]
-
-    # Combine built-in, custom, and plugin providers
-    plugin_providers: list[Provider] = [
-        CustomProvider(p.name) for p in discover_provider_plugins()
-    ]
-    all_providers: list[Provider] = (
-        list(cast(list[Provider], list(MODELS.keys())))
-        + custom_providers
-        + plugin_providers
-    )
-
     providers = [
-        p for p in all_providers if not provider_filter or p == provider_filter
+        p for p in get_known_providers() if not provider_filter or p == provider_filter
     ]
     for models in _fetch_models_parallel(providers, dynamic_fetch):
         # Apply filters
@@ -369,8 +368,6 @@ def list_models(
         _print_simple_format(all_models)
     else:
         # Detailed format: print by provider with formatting
-        from ...config import get_config  # fmt: skip
-
         configured_set = (
             configured if configured is not None else _get_configured_providers()
         )
@@ -379,22 +376,9 @@ def list_models(
         else:
             print("Available models:")
 
-        config = get_config()
-        custom_providers: list[Provider] = [
-            CustomProvider(p.name) for p in config.user.providers
-        ]
-        plugin_providers_detail: list[Provider] = [
-            CustomProvider(p.name) for p in discover_provider_plugins()
-        ]
-        all_providers: list[Provider] = (
-            list(cast(list[Provider], list(MODELS.keys())))
-            + custom_providers
-            + plugin_providers_detail
-        )
-
         selected = [
             provider
-            for provider in all_providers
+            for provider in get_known_providers()
             if (not provider_filter or provider == provider_filter)
             and (not available_only or provider in configured_set)
         ]
```

**File**: `tests/test_served_model_metadata.py` (modified, +4/-3)
```diff
@@ -641,12 +641,13 @@ def test_anthropic_stream_served_model_from_message_start(
 )
 def test_responses_stream_failure_raises_provider_error(event: dict) -> None:
     """A failed response must raise, not end the stream as an empty reply."""
-    import openai
+    from gptme.llm.openai_responses import ResponsesStreamError
 
     events = [{"type": "response.output_text.delta", "delta": "partial"}, event]
-    with pytest.raises(openai.APIError) as exc_info:
+    with pytest.raises(ResponsesStreamError) as exc_info:
         list(_stream_responses_events(events))
-    assert exc_info.value.body == {"code": "server_error", "message": "boom"}
+    assert exc_info.value.code == "server_error"
+    assert exc_info.value.message == "boom"
     assert "boom" in str(exc_info.value)
 
 
```

**File**: `tests/test_util_cli.py` (modified, +38/-0)
```diff
@@ -2007,3 +2007,41 @@ def warning_get_model_list(**_kwargs):
     assert parsed[0]["full"] == "openai/gpt-5"
     # Logging must be restored for the rest of the suite.
     assert logging.root.manager.disable == logging.NOTSET
+
+
+def test_models_list_unknown_provider_errors():
+    """A mistyped --provider must error, not silently list nothing."""
+    runner = CliRunner()
+    for extra in ([], ["--json"], ["--simple"]):
+        result = runner.invoke(
+            main, ["models", "list", "--provider", "antropic", *extra]
+        )
+        assert result.exit_code == 2, result.output
+        assert "unknown provider 'antropic'" in result.output
+        assert "anthropic" in result.output
+
+
+def test_models_list_json_provider_validation_is_log_silent(mocker):
+    """Provider validation loads config; its warnings must not reach --json output."""
+    import logging as _logging
+
+    observed: dict[str, int | None] = {"disabled": None}
+
+    def noisy_known_providers():
+        observed["disabled"] = _logging.root.manager.disable
+        return ["openai"]
+
+    mocker.patch(
+        "gptme.llm.models.listing.get_known_providers",
+        side_effect=noisy_known_providers,
+    )
+    mocker.patch("gptme.cli.util.get_model_list", return_value=[])
+
+    result = CliRunner().invoke(
+        main, ["models", "list", "--json", "--provider", "openai"]
+    )
+
+    assert result.exit_code == 0, result.output
+    assert json.loads(result.output) == []
+    assert observed["disabled"] == _logging.CRITICAL
+    assert _logging.root.manager.disable == _logging.NOTSET
```

---

### Incident Patch 2: `c5c52091` (2026-10-05)
**Commit Message**: fix(preview): send Cache-Control private, no-store on preview responses (#4180)

Upstream Cache-Control/Expires/Pragma are replaced so an authenticated
preview page is never stored by a browser or shared cache and cannot be
re-shown after the gptme_auth cookie is cleared.

Refs gptme/gptme-cloud#1100

Git-Session-Id: d95e

**File**: `gptme/server/preview_proxy_api.py` (modified, +17/-1)
```diff
@@ -176,6 +176,20 @@
     }
 )
 
+# Cache-policy headers are replaced.  A preview response is only reachable
+# with the ``gptme_auth`` cookie, but a shared or browser cache that stores it
+# would keep serving the page after the cookie is gone (or to another user of
+# the same cache), so every preview response is ``private, no-store``.
+_CACHE_POLICY_STRIP: frozenset[str] = frozenset(
+    {
+        "cache-control",
+        "expires",
+        "pragma",
+    }
+)
+
+PREVIEW_CACHE_CONTROL = "private, no-store"
+
 # Documents that can execute script.  Unique-origin sandbox them so they
 # cannot call cookie-authenticated /api/ routes as the user.
 _HTML_LIKE_MIME: frozenset[str] = frozenset(
@@ -252,12 +266,13 @@ def _forward_request_headers(
 
 
 def _forward_response_headers(headers: Any) -> list[tuple[str, str]]:
-    """Copy upstream response headers, dropping hop-by-hop, decoded-body, isolation, cookies."""
+    """Copy upstream response headers, dropping hop-by-hop, decoded-body, isolation, cookies, cache policy."""
     skip = (
         _HOP_BY_HOP
         | _DECODED_RESPONSE_STRIP
         | _ISOLATION_STRIP
         | _CREDENTIAL_RESPONSE_STRIP
+        | _CACHE_POLICY_STRIP
     )
     return [(key, value) for key, value in headers.items() if key.lower() not in skip]
 
@@ -480,6 +495,7 @@ def _http_stream_proxy(port: int, subpath: str) -> flask.Response:
         upstream.headers.get("Content-Type"),
     )
     response_headers.extend(_isolation_headers(content_type))
+    response_headers.append(("Cache-Control", PREVIEW_CACHE_CONTROL))
 
     def _generate() -> Iterator[bytes]:
         try:
```

**File**: `tests/test_preview_proxy.py` (modified, +39/-0)
```diff
@@ -412,6 +412,41 @@ def log_message(self, *args):
         assert resp.headers.get("Clear-Site-Data") is None
         assert client.get_cookie("gptme_auth") is None
 
+    def test_responses_are_never_cacheable(self, client: FlaskClient):
+        """Upstream cache policy is replaced so an authenticated preview is not stored."""
+
+        class _CacheHandler(BaseHTTPRequestHandler):
+            def do_GET(self):
+                self.send_response(200)
+                self.send_header("Content-Type", "text/plain")
+                self.send_header("Cache-Control", "public, max-age=31536000")
+                self.send_header("Expires", "Wed, 01 Jan 2031 00:00:00 GMT")
+                self.send_header("Pragma", "cache")
+                self.end_headers()
+                self.wfile.write(b"ok")
+
+            def log_message(self, *args):
+                pass
+
+        srv = HTTPServer(("127.0.0.1", 0), _CacheHandler)
+        port = srv.server_address[1]
+        t = threading.Thread(target=srv.handle_request, daemon=True)
+        t.start()
+
+        resp = client.get(f"/preview/{port}/")
+        t.join(timeout=3)
+        srv.server_close()
+
+        assert resp.status_code == 200
+        assert resp.headers.getlist("Cache-Control") == ["private, no-store"]
+        assert resp.headers.get("Expires") is None
+        assert resp.headers.get("Pragma") is None
+
+    def test_default_response_is_not_cacheable(self, client: FlaskClient):
+        with _loopback_http_server(b"hello") as port:
+            resp = client.get(f"/preview/{port}/")
+        assert resp.headers.get("Cache-Control") == "private, no-store"
+
 
 class TestHeaderHelpers:
     def test_sanitize_drops_token(self):
@@ -461,6 +496,9 @@ def test_forward_response_headers_strips_cookies(self):
             "Content-Encoding": "gzip",
             "Content-Security-Policy": "sandbox allow-same-origin",
             "Connection": "close",
+            "Cache-Control": "public, max-age=60",
+            "Expires": "Wed, 01 Jan 2031 00:00:00 GMT",
+            "Pragma": "cache",
             "X-Custom": "keep",
         }
         forwarded = _forward_response_headers(headers)
@@ -471,5 +509,6 @@ def test_forward_response_headers_strips_cookies(self):
         assert "content-encoding" not in lower
         assert "content-security-policy" not in lower
         assert "connection" not in lower
+        assert not {"cache-control", "expires", "pragma"} & lower
         assert ("X-Custom", "keep") in forwarded
         assert ("Content-Type", "text/html") in forwarded
```

---

### Incident Patch 3: `536e6c37` (2026-10-05)
**Commit Message**: fix(llm): accept mixed-case image attachment extensions (#4171)

**File**: `gptme/llm/utils.py` (modified, +1/-1)
```diff
@@ -154,7 +154,7 @@ def process_image_file(
     if expand_user:
         f = f.expanduser()
 
-    ext = f.suffix[1:]
+    ext = f.suffix[1:].lower()
     if ext not in ALLOWED_FILE_EXTS:
         logger.warning("Unsupported file type: %s", ext)
         return None
```

**File**: `tests/test_llm_image_attachments.py` (added, +141/-0)
```diff
@@ -0,0 +1,141 @@
+"""Case-insensitive image attachments in provider request conversion."""
+
+import base64
+from pathlib import Path
+from typing import Any, cast
+
+import pytest
+from PIL import Image
+
+from gptme.llm.llm_anthropic import (
+    _prepare_messages_for_api as prepare_anthropic,
+)
+from gptme.llm.llm_openai import _prepare_messages_for_api as prepare_openai
+from gptme.llm.utils import process_image_file
+from gptme.message import Message
+from gptme.tools import get_tool, init_tools
+
+
+@pytest.mark.parametrize(
+    ("suffix", "image_format", "media_type"),
+    [
+        ("JPG", "JPEG", "image/jpeg"),
+        ("JpEg", "JPEG", "image/jpeg"),
+        ("PNG", "PNG", "image/png"),
+        ("GiF", "GIF", "image/gif"),
+        ("WEBP", "WEBP", "image/webp"),
+    ],
+)
+def test_process_image_file_mixed_case_suffix(
+    tmp_path: Path, suffix: str, image_format: str, media_type: str
+) -> None:
+    image_path = tmp_path / f"photo.{suffix}"
+    Image.new("RGB", (1, 1)).save(image_path, format=image_format)
+    content: list[dict] = []
+
+    result = process_image_file(image_path, content)
+
+    assert result is not None
+    data, actual_media_type = result
+    assert actual_media_type == media_type
+    assert base64.b64decode(data) == image_path.read_bytes()
+    assert content == [
+        {"type": "text", "text": f"![{image_path.name}]({image_path.name}):"}
+    ]
+
+
+@pytest.mark.parametrize("suffix", ["TXT", "SVG"])
+def test_unsupported_uppercase_suffix(tmp_path: Path, suffix: str) -> None:
+    image_path = tmp_path / f"photo.{suffix}"
+    image_path.write_bytes(b"not a supported image")
+    content: list[dict] = []
+
+    assert process_image_file(image_path, content) is None
+    assert content == []
+
+
+def test_uppercase_image_keeps_vision_and_size_checks(tmp_path: Path) -> None:
+    image_path = tmp_path / "photo.PNG"
+    Image.new("RGB", (1, 1)).save(image_path, format="PNG")
+    content: list[dict] = []
+
+    assert (
+        process_image_file(image_path, content, check_vision_support=lambda: False)
+        is None
+    )
+    assert content == []
+    assert process_image_file(image_path, content, max_size_mb=0) is None
+    assert content
+    assert "Image size exceeds" in content[-1]["text"]
+
+
+@pytest.mark.parametrize("suffix", ["jpg", "JPG", "JpEg"])
+@pytest.mark.parametrize("provider", ["openai", "anthropic"])
+@pytest.mark.parametrize("tool_result", [False, True])
+def test_provider_preserves_image_attachment(
+    tmp_path: Path, suffix: str, provider: str, tool_result: bool
+) -> None:
+    image_path = tmp_path / f"photo.{suffix}"
+    Image.new("RGB", (1, 1)).save(image_path, format="JPEG")
+    init_tools(allowlist=["save"])
+    tool = get_tool("save")
+    assert tool is not None
+    messages = (
+        [
+            Message(role="user", content="View the image"),
+            Message(
+                role="assistant", content='@save(view1): {"path": "x", "content": "x"}'
+            ),
+            Message(
+                role="system",
+                content="Image result",
+                call_id="view1",
+                files=[image_path],
+            ),
+        ]
+        if tool_result
+        else [Message(role="user", content="Describe this image", files=[image_path])]
+    )
+    messages.insert(0, Message(role="system", content="You are helpful."))
+
+    if provider == "openai":
+        converted_openai, _ = prepare_openai(messages, "openai/gpt-4o", [tool])
+        converted = cast(list[dict[str, Any]], converted_openai)
+        image_parts = [
+            part
+            for msg in converted
+            for part in msg.get("content", [])
+            if part["type"] == "image_url"
+        ]
+        assert len(image_parts) == 1
+        assert image_parts[0]["image_url"]["url"] == (
+            "data:image/jpeg;base64,"
+            + base64.b64encode(image_path.read_bytes()).decode()
+        )
+        if tool_result:
+            assert converted[-1]["role"] == "user"
+            assert all(part["type"] == "text" for part in converted[-2]["content"])
+    else:
+        converted_anthropic, _, _ = prepare_anthropic(messages, [tool])
+        parts = [
+            part
+            for msg in cast(list[dict[str, Any]], converted_anthropic)
+            for part in msg["content"]
+        ]
+        image_parts = [part for part in parts if part["type"] == "image"]
+        if tool_result:
+            image_parts = [
+                part
+                for block in parts
+                if block["type"] == "tool_result"
+                for part in block["content"]
+                if part["type"] == "image"
+            ]
+        assert len(image_parts) == 1
+        assert image_parts[0]["source"]["media_type"] == "image/jpeg"
+        assert (
+            base64.b64decode(image_parts[0]["source"]["data"])
+            == image_path.read_bytes()
+        )
+
+    assert messages[-1].files
```

---

### Incident Patch 4: `7bf27412` (2026-10-05)
**Commit Message**: fix(telemetry): use Fable 5.1 cached-input pricing (#4126)

Git-Session-Id: 9c99

**File**: `gptme/llm/models/data.py` (modified, +1/-0)
```diff
@@ -154,6 +154,7 @@ def _mark_parallel(
             "max_output": 128_000,
             "price_input": 10,
             "price_output": 50,
+            "price_cache_read": 0.25,
             "supports_vision": True,
             "supports_reasoning": True,
             "supports_parallel_tool_calls": True,
```

**File**: `tests/test_telemetry.py` (modified, +75/-0)
```diff
@@ -192,6 +192,81 @@ def test_calculate_llm_cost_resolves_anthropic_short_alias():
     assert alias_cost == pytest.approx(dated_cost)
 
 
+@pytest.mark.parametrize("model", ["claude-fable-5-1", "claude-fable-5-1-20260901"])
+def test_calculate_llm_cost_fable51_cache_read_price(model: str):
+    """Fable 5.1 reads cached input at $0.25/MTok, with unchanged writes."""
+    from gptme.telemetry import _calculate_llm_cost
+
+    assert _calculate_llm_cost(
+        provider="anthropic",
+        model=model,
+        input_tokens=1000,
+        output_tokens=100,
+        cache_creation_tokens=2000,
+        cache_read_tokens=3000,
+    ) == pytest.approx(0.010 + 0.005 + 0.025 + 0.00075)
+
+
+@pytest.mark.parametrize("output_tokens", [0, 100])
+def test_calculate_llm_cost_fully_cached_fable51(output_tokens: int):
+    """Zero uncached input or output does not make cache reads free."""
+    from gptme.telemetry import _calculate_llm_cost
+
+    assert _calculate_llm_cost(
+        provider="anthropic",
+        model="claude-fable-5-1",
+        input_tokens=0,
+        output_tokens=output_tokens,
+        cache_read_tokens=3000,
+    ) == pytest.approx(output_tokens * 50 / 1e6 + 0.00075)
+
+
+@pytest.mark.parametrize(
+    ("provider", "model", "expected"),
+    [
+        ("anthropic", "claude-fable-5", 0.043),
+        ("anthropic", "claude-haiku-4-5", 0.0043),
+        ("openai", "gpt-4o", 0.014),
+    ],
+)
+def test_calculate_llm_cost_default_cache_prices(
+    provider: str, model: str, expected: float
+):
+    """Models without an override keep their provider's existing cache rates."""
+    from gptme.telemetry import _calculate_llm_cost
+
+    assert _calculate_llm_cost(
+        provider=provider,
+        model=model,
+        input_tokens=1000,
+        output_tokens=100,
+        cache_creation_tokens=2000,
+        cache_read_tokens=3000,
+    ) == pytest.approx(expected)
+
+
+def test_calculate_llm_cost_subscription_with_cache_price(monkeypatch):
+    """An explicit cache rate must not add marginal cost to a subscription."""
+    from dataclasses import replace
+
+    from gptme.llm.models import get_model
+    from gptme.telemetry import _calculate_llm_cost
+
+    meta = replace(get_model("anthropic/claude-fable-5-1"), pricing_type="subscription")
+    monkeypatch.setattr("gptme.llm.models.get_model", lambda _: meta)
+    assert (
+        _calculate_llm_cost(
+            provider="anthropic",
+            model=meta.model,
+            input_tokens=1000,
+            output_tokens=100,
+            cache_creation_tokens=2000,
+            cache_read_tokens=3000,
+        )
+        == 0.0
+    )
+
+
 @pytest.mark.skipif(
     not _has_telemetry_deps(),
     reason="Requires telemetry dependencies (opentelemetry, prometheus_client)",
```

---

### Incident Patch 5: `ce5ed9f2` (2026-10-05)
**Commit Message**: fix(compaction): reject empty summarize checkpoints instead of replacing history (#4172)

An empty or whitespace-only checkpoint replaced the whole view with a blank
assistant message. Treat it as a failed summarize so the hook latches to the
trim path and history is left intact.

Part of gptme/gptme#3812 Phase 2.

Git-Session-Id: 1cb9

**File**: `gptme/tools/autocompact/resume.py` (modified, +12/-0)
```diff
@@ -660,6 +660,18 @@ def _resume_via_llm(
             return False
     resume_content = resume_response.content
 
+    # An empty checkpoint would replace the whole history with nothing. Report
+    # it as not applied so the hook latches to the trim path.
+    if not resume_content or not resume_content.strip():
+        logger.warning("Summarizer returned an empty checkpoint; keeping history")
+        yield Message(
+            "system",
+            "Skipped auto-summarize: the model returned an empty checkpoint.",
+            hide=use_view_branch,
+            ui_only=True,
+        )
+        return False
+
     # Save RESUME.md to logdir (not workspace) for reference/debugging
     resume_path: Path | None = None
     if manager.logdir:
```

**File**: `tests/test_auto_compact.py` (modified, +38/-0)
```diff
@@ -3153,6 +3153,44 @@ def fake_reply(msgs, **kwargs):
     assert "Focus on test X." in captured_prompt[0]
 
 
+@pytest.mark.parametrize("content", ["", "   \n\t  "])
+@pytest.mark.parametrize("use_view_branch", [True, False])
+def test_resume_via_llm_rejects_empty_checkpoint(
+    tmp_path, monkeypatch, content, use_view_branch
+):
+    """An empty checkpoint must not replace history; the caller falls back to trim."""
+    from gptme.logmanager import LogManager
+    from gptme.tools.autocompact.resume import _resume_via_llm
+
+    messages = [
+        Message("system", "system prompt"),
+        Message("user", "task 1"),
+        Message("assistant", "done 1"),
+        Message("user", "task 2"),
+        Message("assistant", "done 2"),
+    ]
+    logdir = tmp_path / "conversation"
+    manager = LogManager(list(messages), logdir=logdir)
+    monkeypatch.setattr(
+        "gptme.tools.autocompact.resume.llm.reply",
+        lambda *a, **k: Message("assistant", content),
+    )
+
+    gen = _resume_via_llm(manager, messages, use_view_branch=use_view_branch)
+    out: list[Message] = []
+    try:
+        while True:
+            out.append(next(gen))
+    except StopIteration as stop:
+        applied = stop.value
+
+    assert applied is False
+    assert [m.content for m in manager.log.messages] == [m.content for m in messages]
+    assert manager.current_view is None
+    assert not (logdir / "RESUME.md").exists()
+    assert any("empty checkpoint" in m.content for m in out)
+
+
 def test_resume_via_llm_keep_recent_appends_tail(tmp_path, monkeypatch):
     """keep_recent_tokens > 0 preserves a tail of recent history after checkpoint."""
     from gptme.logmanager import LogManager
```

---

### Incident Patch 6: `a990d028` (2026-10-05)
**Commit Message**: fix(responses): surface explicit SSE generation failures (#4170)

* fix(responses): surface explicit SSE generation failures

Git-Session-Id: 129a

* fix(responses): classify explicit stream failures

Git-Session-Id: bae2078a-c915-52c1-ac43-af119e34f7ab

* fix(responses): retry explicit stream rate limits

Git-Session-Id: bae2078a-c915-52c1-ac43-af119e34f7ab

**File**: `gptme/llm/llm_openai.py` (modified, +10/-1)
```diff
@@ -43,6 +43,7 @@
     ContentPart,
     MessageContent,
     MessageDict,
+    ResponsesStreamError,
     ToolCall,
     ToolCallFunction,
     _content_to_responses_input,  # noqa: F401
@@ -889,7 +890,15 @@ def _handle_openai_transient_error(
     # Check if this is a transient error we should retry
     should_retry = False
 
-    if isinstance(e, RateLimitError):
+    if isinstance(e, ResponsesStreamError):
+        # Explicit failures keep their provider code so permanent errors do not
+        # inherit the blanket retry policy for malformed/disconnected streams.
+        should_retry = e.code in {
+            "rate_limit_exceeded",
+            "server_is_overloaded",
+            "service_unavailable_error",
+        }
+    elif isinstance(e, RateLimitError):
         # 429 rate limit - should back off and retry
         should_retry = True
     elif isinstance(e, APIConnectionError):
```

**File**: `gptme/llm/llm_openai_subscription.py` (modified, +9/-5)
```diff
@@ -41,6 +41,7 @@
 import webbrowser
 from base64 import urlsafe_b64decode
 from collections.abc import Callable, Generator
+from contextlib import closing
 from dataclasses import dataclass
 from math import isfinite
 from pathlib import Path
@@ -772,11 +773,14 @@ def _capture_model(served: str) -> None:
         nonlocal _served_model
         _served_model = served
 
-    yield from _stream_responses_events(
-        _sse_events(),
-        usage_callback=_capture_usage,
-        model_callback=_capture_model,
-    )
+    # The parser can raise while the event generator is suspended at yield.
+    # Close it explicitly so retained exception tracebacks do not hold sockets.
+    with closing(_sse_events()) as events:
+        yield from _stream_responses_events(
+            events,
+            usage_callback=_capture_usage,
+            model_callback=_capture_model,
+        )
 
     # Return usage metadata so _StreamWithMetadata can attach it to the message.
     # _StreamWithMetadata adds the full provider-prefixed model name automatically.
```

**File**: `gptme/llm/openai_responses.py` (modified, +27/-1)
```diff
@@ -7,6 +7,7 @@
 from dataclasses import dataclass
 from typing import TYPE_CHECKING, Any, TypedDict
 
+import httpx
 from typing_extensions import NotRequired
 
 from ..tools.base import truncate_tool_description
@@ -21,6 +22,16 @@
 logger = logging.getLogger(__name__)
 
 
+class ResponsesStreamError(httpx.RemoteProtocolError):
+    """Explicit failure reported inside an HTTP-200 Responses stream."""
+
+    def __init__(self, event_type: str, code: str, message: str):
+        self.event_type = event_type
+        self.code = code
+        self.message = message
+        super().__init__(f"Responses stream {event_type}: {code}: {message}")
+
+
 class ContentPart(TypedDict):
     """A content part in a multimodal message."""
 
@@ -394,7 +405,22 @@ def _stream_responses_events(
     for event in event_iter:
         event_type = _obj_get(event, "type", "")
 
-        if event_type in ("response.reasoning_text.delta", "response.reasoning.delta"):
+        if event_type in ("error", "response.failed"):
+            # HTTP 200 only establishes the stream, not successful generation.
+            # Raise a provider error without dumping the response (instructions,
+            # input and output may contain private context).
+            if event_type == "response.failed":
+                error = _obj_get(_obj_get(event, "response", None), "error", None)
+            else:
+                error = _obj_get(event, "error", None) or event
+            code = _obj_get(error, "code", None) or "unknown_error"
+            message = _obj_get(error, "message", None) or "Generation failed"
+            raise ResponsesStreamError(event_type, code, message)
+
+        elif event_type in (
+            "response.reasoning_text.delta",
+            "response.reasoning.delta",
+        ):
             delta = _obj_get(event, "delta", "")
             if delta:
                 if not in_reasoning_block:
```

**File**: `tests/test_responses_stream_errors.py` (added, +148/-0)
```diff
@@ -0,0 +1,148 @@
+"""Explicit Responses SSE failures must not become successful completions."""
+
+from types import SimpleNamespace
+from unittest.mock import Mock
+
+import httpx
+import pytest
+
+from gptme.llm.llm_openai import _handle_openai_transient_error
+from gptme.llm.openai_responses import (
+    ResponsesStreamError,
+    _stream_responses_events,
+)
+
+
+@pytest.mark.parametrize(
+    "event",
+    [
+        {
+            "type": "error",
+            "error": {"code": "server_is_overloaded", "message": "Try later"},
+        },
+        {"type": "error", "code": "server_is_overloaded", "message": "Try later"},
+        {
+            "type": "response.failed",
+            "response": {
+                "error": {"code": "server_is_overloaded", "message": "Try later"}
+            },
+        },
+        SimpleNamespace(
+            type="response.failed",
+            response=SimpleNamespace(
+                error=SimpleNamespace(code="server_is_overloaded", message="Try later")
+            ),
+        ),
+    ],
+)
+@pytest.mark.parametrize("partial", [False, True])
+def test_explicit_failure_raises(event, partial: bool) -> None:
+    events = (
+        [{"type": "response.output_text.delta", "delta": "partial"}] if partial else []
+    ) + [event]
+    with pytest.raises(
+        ResponsesStreamError, match="server_is_overloaded.*Try later"
+    ) as exc_info:
+        list(_stream_responses_events(events))
+    assert isinstance(exc_info.value, httpx.RemoteProtocolError)
+    assert exc_info.value.code == "server_is_overloaded"
+
+
+@pytest.mark.parametrize("event_type", ["error", "response.failed"])
+def test_failure_without_details_still_raises(event_type: str) -> None:
+    with pytest.raises(httpx.RemoteProtocolError, match=event_type):
+        list(_stream_responses_events([{"type": event_type}]))
+
+
+@pytest.mark.parametrize("terminal", ["response.completed", "response.done"])
+def test_successful_stream_is_unchanged(terminal: str) -> None:
+    events = [{"type": "response.output_text.delta", "delta": "ok"}, {"type": terminal}]
+    assert "".join(_stream_responses_events(events)) == "ok"
+
+
+def test_permanent_responses_failure_is_not_retried() -> None:
+    error = ResponsesStreamError(
+        "response.failed", "insufficient_quota", "Top up your account"
+    )
+    with pytest.raises(ResponsesStreamError) as exc_info:
+        _handle_openai_transient_error(error, 0, 3, 0)
+    assert exc_info.value is error
+
+
+@pytest.mark.parametrize(
+    "code",
+    ["rate_limit_exceeded", "server_is_overloaded", "service_unavailable_error"],
+)
+def test_transient_responses_failure_is_retried(monkeypatch, code: str) -> None:
+    wait = Mock(return_value=False)
+    monkeypatch.setattr("gptme.llm.llm_openai.backoff_wait", wait)
+    error = ResponsesStreamError("response.failed", code, "Try later")
+    _handle_openai_transient_error(error, 0, 3, 0)
+    wait.assert_called_once()
+
+
+@pytest.mark.parametrize("stream", [False, True])
+@pytest.mark.parametrize("partial", [False, True])
+def test_subscription_cli_failure_is_nonzero_and_closes_stream(
+    partial: bool, stream: bool
+) -> None:
+    import json
+    import logging
+    from unittest.mock import patch
+
+    from click.testing import CliRunner
+
+    from gptme.cli.util import llm_generate
+    from gptme.llm import llm_openai_subscription
+
+    class Response:
+        status_code = 200
+        closed = False
+
+        def iter_lines(self):
+            events = (
+                [{"type": "response.output_text.delta", "delta": "partial"}]
+                if partial
+                else []
+            ) + [
+                {
+                    "type": "response.failed",
+                    "response": {
+                        "instructions": "private instructions",
+                        "error": {
+                            "code": "server_is_overloaded",
+                            "message": "Try later",
+                        },
+                    },
+                }
+            ]
+            for event in events:
+                yield f"data: {json.dumps(event)}".encode()
+
+        def close(self) -> None:
+            self.closed = True
+
+    response = Response()
+    auth = SimpleNamespace(access_token="test", account_id="test")
+    level = logging.getLogger().level
+    try:
+        with (
+            patch("gptme.init.init"),
+            patch("gptme.llm.init_llm"),
+            patch.object(llm_openai_subscription, "get_auth", return_value=auth),
+            patch.object(
+                llm_openai_subscription.requests, "post", return_value=response
+            ) as post,
+        ):
+            args = ["--model", "openai-subscription/gpt-5.6-sol"]
+            if stream:
+                args.append("--stream")
+            result = CliRunner().invoke(llm_generate, [*args, "hello"])
+    finally:
+        logging.getLogger().setLevel(level)
+    assert result.
```

---

### Incident Patch 7: `0939c341` (2026-10-05)
**Commit Message**: fix(anthropic): register Claude 5 models and use supported thinking modes (#4125)

* fix(anthropic): register Claude 5 models and use supported thinking modes

Git-Session-Id: 9c99

* docs(tool-formats): refresh model coverage counts after rebase onto master

Git-Session-Id: 1076450a-38b2-5088-94ea-6b89cb0f4faa

* fix(anthropic): only treat numeric suffixes as dated releases

_matches_model used a bare startswith(known + '-'), so a hypothetical
claude-sonnet-5-5-mini inherited Sonnet 5.5's between_tools/adaptive
thinking mode. Require the suffix to be digits so only real dated
releases (claude-sonnet-5-5-20260928) match, and assert output_config
is omitted when Sonnet 5.5 reasoning is off.

Git-Session-Id: f1edc756-0429-5199-9388-1e7e04ee8d06

* test(anthropic): re-collect thinking-param tests swallowed by wire-payload test

Six Opus/Sonnet budget tests were indented inside the module-level
test_claude_5_chat_wire_payload function, so pytest never collected
them (98 -> 104 collected). Dedent them to module scope and drop the
unused self parameters.

Git-Session-Id: f1edc756-0429-5199-9388-1e7e04ee8d06

* docs(tool-formats): don't attribute OpenRouter aliases to the Claude 5.x famil

**File**: `docs/tool-formats.rst` (modified, +4/-3)
```diff
@@ -226,7 +226,7 @@ behaviour silently:
 
 **How well populated is this?** Unevenly, and it is worth being explicit about:
 
-- ``default_tool_format`` is set to ``tool`` on 108 of the 127 models in the
+- ``default_tool_format`` is set to ``tool`` on 108 of the 131 models in the
   bundled registry. This is stamped **per provider**, not per model: every
   provider that talks the OpenAI-compatible function-calling API gets it
   (``openai``, ``openai-subscription``, ``gemini``, ``xai``, ``groq``,
@@ -240,8 +240,9 @@ behaviour silently:
   the same ``tool`` default applied at resolution time instead, including on
   dynamic-fetch fallbacks.
 
-- ``supports_parallel_tool_calls`` is set on 67 entries: the Claude Opus/Sonnet
-  4.x families and their OpenRouter aliases, Kimi K3, the GPT-4.1/GPT-5/GPT-6
+- ``supports_parallel_tool_calls`` is set on 71 entries: the Claude Fable 5.x
+  and Opus/Sonnet 4.x/5.x families, the OpenRouter Claude Opus/Sonnet aliases,
+  Kimi K3, the GPT-4.1/GPT-5/GPT-6
   families, verified Gemini models (and the OpenRouter Gemini 3.5 Flash alias;
   lite and experimental Gemini variants are excluded via
   ``PARALLEL_TOOL_CALL_EXCEPTIONS``), xAI Grok (excluding the older
```

**File**: `gptme/llm/llm_anthropic.py` (modified, +37/-12)
```diff
@@ -59,8 +59,11 @@
 # https://platform.claude.com/docs/en/docs/build-with-claude/extended-thinking
 # ("Manual extended thinking is no longer supported on Claude Opus 4.7 or
 # later models and returns a 400 error.")
-_ADAPTIVE_THINKING_MODELS: frozenset[str] = frozenset(
-    {"claude-opus-4-7", "claude-opus-4-8"}
+_ALWAYS_THINKING_MODELS: frozenset[str] = frozenset(
+    {"claude-opus-5-5", "claude-fable-5", "claude-fable-5-1"}
+)
+_ADAPTIVE_THINKING_MODELS: frozenset[str] = _ALWAYS_THINKING_MODELS | frozenset(
+    {"claude-opus-4-7", "claude-opus-4-8", "claude-sonnet-5-5"}
 )
 
 if TYPE_CHECKING:
@@ -397,37 +400,55 @@ def _output_config_kwargs(*, use_thinking: bool) -> _OutputConfigKwargs:
     return {"output_config": {"effort": effort_level}}
 
 
+def _matches_model(model: str, models: frozenset[str]) -> bool:
+    """Match model names with optional vendor prefixes and release suffixes.
+
+    Only a purely numeric suffix is treated as a dated release of ``known``
+    (e.g. ``claude-sonnet-5-5-20260928`` -> ``claude-sonnet-5-5``). A
+    hyphenated non-numeric suffix names a *different* model
+    (``claude-sonnet-5-5-mini``), which must not inherit its thinking mode.
+    """
+    base = model.rsplit("/", 1)[-1]
+    return base in models or any(
+        base.startswith(known + "-") and base[len(known) + 1 :].isdigit()
+        for known in models
+    )
+
+
 def _requires_adaptive_thinking(model: str) -> bool:
     """Return True if ``model`` rejects legacy ``thinking.type=enabled`` with 400.
 
     Such models only accept adaptive thinking (``thinking.type=adaptive``)
     plus ``output_config.effort``.  Handles bare names, vendor prefixes, and
     Anthropic's dated-release suffixes (e.g. ``claude-opus-4-7-20260401``).
     """
-    # Strip vendor prefix: "anthropic/claude-opus-4-7" -> "claude-opus-4-7",
-    # "openrouter/anthropic/claude-opus-4-7" -> "claude-opus-4-7".
-    base = model.rsplit("/", 1)[-1]
-    if base in _ADAPTIVE_THINKING_MODELS:
-        return True
-    # Match dated-release suffix: "claude-opus-4-7-20260401".
-    return any(base.startswith(known + "-") for known in _ADAPTIVE_THINKING_MODELS)
+    return _matches_model(model, _ADAPTIVE_THINKING_MODELS)
 
 
 def _build_thinking_param(
     model: str, use_thinking: bool, thinking_budget: int
 ) -> dict[str, object] | None:
     """Build the ``thinking`` kwarg for Anthropic's messages API.
 
-    Returns ``None`` when thinking is disabled so callers can substitute
-    the SDK's ``NOT_GIVEN`` sentinel.  Branches on model capability:
+    Returns ``None`` when legacy thinking is disabled so callers can substitute
+    the SDK's ``NOT_GIVEN`` sentinel. Branches on model capability:
 
     - Adaptive-only models (Opus 4.7+): ``{"type": "adaptive"}`` (effort
       flows through ``output_config`` separately).
+    - Claude 5 models request visible thinking summaries; Sonnet 5.5 uses
+      ``between_tools`` when up-front thinking is disabled.
     - All other reasoning models: ``{"type": "enabled", "budget_tokens": N}``.
     """
+    if _matches_model(model, frozenset({"claude-sonnet-5-5"})):
+        # Sonnet 5.5 thinks by default; omission would ignore GPTME_REASONING=0.
+        if not use_thinking:
+            return {"type": "between_tools"}
+        return {"type": "adaptive", "display": "summarized"}
     if not use_thinking:
         return None
     if _requires_adaptive_thinking(model):
+        if _matches_model(model, _ALWAYS_THINKING_MODELS):
+            return {"type": "adaptive", "display": "summarized"}
         return {"type": "adaptive"}
     return {"type": "enabled", "budget_tokens": thinking_budget}
 
@@ -483,6 +504,10 @@ def _should_use_thinking(model_meta: ModelMeta, tools: list[ToolSpec] | None) ->
     messages containing <think> tags will be converted to proper Anthropic
     thinking blocks in the content array.
     """
+    # Opus 5.5 and Fable 5 cannot disable thinking; keep request/effort metadata honest.
+    if _matches_model(model_meta.model, _ALWAYS_THINKING_MODELS):
+        return True
+
     # Support environment variable to override reasoning behavior
     env_reasoning = os.environ.get(ENV_REASONING)
     if env_reasoning and env_reasoning.lower() in ("1", "true", "yes"):
@@ -1140,7 +1165,7 @@ def _extract_thinking_content(
         sig_match = sig_pattern.search(block)
         signature = sig_match.group(1).strip() if sig_match else ""
         cleaned_block = sig_pattern.sub("", block).strip()
-        if cleaned_block:
+        if cleaned_block or signature:
             thinking_blocks.append((cleaned_block, signature))
 
     # Remove <think> and <thinking> tags from content
```

**File**: `gptme/llm/models/data.py` (modified, +46/-0)
```diff
@@ -126,6 +126,52 @@ def _mark_parallel(
     # https://docs.anthropic.com/en/docs/about-claude/models
     # Active models here; deprecated models in llm_anthropic_models_deprecated.py
     "anthropic": {
+        # Specs verified 2026-10-02 against https://platform.claude.com/docs/en/models/overview
+        "claude-sonnet-5-5": {
+            "context": 1_000_000,
+            "max_output": 128_000,
+            "price_input": 2,
+            "price_output": 10,
+            "supports_vision": True,
+            "supports_reasoning": True,
+            "supports_parallel_tool_calls": True,
+            "preferred_edit_format": "diff",
+            "knowledge_cutoff": datetime(2026, 6, 1, tzinfo=timezone.utc),
+        },
+        "claude-opus-5-5": {
+            "context": 1_000_000,
+            "max_output": 128_000,
+            "price_input": 4,
+            "price_output": 20,
+            "supports_vision": True,
+            "supports_reasoning": True,
+            "supports_parallel_tool_calls": True,
+            "preferred_edit_format": "diff",
+            "knowledge_cutoff": datetime(2026, 6, 1, tzinfo=timezone.utc),
+        },
+        "claude-fable-5-1": {
+            "context": 1_000_000,
+            "max_output": 128_000,
+            "price_input": 10,
+            "price_output": 50,
+            "supports_vision": True,
+            "supports_reasoning": True,
+            "supports_parallel_tool_calls": True,
+            "preferred_edit_format": "diff",
+            "knowledge_cutoff": datetime(2026, 6, 1, tzinfo=timezone.utc),
+        },
+        # Legacy, still active: https://platform.claude.com/docs/en/models/fable-5/overview
+        "claude-fable-5": {
+            "context": 1_000_000,
+            "max_output": 128_000,
+            "price_input": 10,
+            "price_output": 50,
+            "supports_vision": True,
+            "supports_reasoning": True,
+            "supports_parallel_tool_calls": True,
+            "preferred_edit_format": "diff",
+            "knowledge_cutoff": datetime(2026, 1, 1, tzinfo=timezone.utc),
+        },
         "claude-opus-4-8": {
             "context": 1_000_000,
             "max_output": 128_000,
```

**File**: `gptme/llm/models/recommended.py` (modified, +3/-1)
```diff
@@ -19,7 +19,7 @@
 # on that provider today. Providers without an entry (azure, nvidia, local,
 # ...) require an explicit model name.
 RECOMMENDED_MODELS: dict[str, str] = {
-    "anthropic": "claude-sonnet-4-6",
+    "anthropic": "claude-sonnet-5-5",
     "openai": "gpt-5.6-sol",
     # GPT-6 Astra is flat-rate on ChatGPT Plus/Pro via Codex OAuth, so the
     # subscription default can be the frontier model without a cost tradeoff.
@@ -36,6 +36,8 @@
     "gemini": "gemini-3.1-pro-preview",
     "xai": "grok-4.6",
     "grok-subscription": "grok-4.6",
+    # Sonnet 5.5 is exposed only through OpenRouter on gptme.ai, where its
+    # billing metadata must be updated before changing this direct default.
     "gptme": "claude-sonnet-4-6",
     "deepseek": "deepseek-v4-flash",
     "groq": "llama-3.3-70b-versatile",
```

**File**: `tests/test_llm_anthropic.py` (modified, +157/-26)
```diff
@@ -1,7 +1,10 @@
+import json
 import logging
 import os
 
+import httpx
 import pytest
+from anthropic import Anthropic
 
 import gptme.llm.llm_anthropic as llm_anthropic
 from gptme.llm.llm_anthropic import (
@@ -206,6 +209,48 @@ def test_message_conversion_with_tools():
     ]
 
 
+def test_message_conversion_preserves_empty_signed_thinking():
+    """An empty thinking block still round-trips into the next request.
+
+    Claude 5 can return signature-bearing thinking blocks whose text is empty;
+    re-sending the history must carry the block back verbatim or Anthropic
+    rejects the assistant turn.
+    """
+    init_tools(allowlist=["save"])
+
+    messages = [
+        Message(role="system", content="Project prompt", hide=True),
+        Message(role="user", content="First user prompt"),
+        Message(
+            role="assistant",
+            content=(
+                "<thinking>\n<!-- think-sig: empty-sig== -->\n</thinking>\n"
+                '@save(tool_call_id): {"path": "path.txt", "content": "file_content"}'
+            ),
+        ),
+        Message(role="system", content="Saved", call_id="tool_call_id"),
+    ]
+
+    tool_save = get_tool("save")
+    assert tool_save
+
+    messages_dicts = list(_prepare_messages_for_api(messages, [tool_save])[0])
+    assistant = next(m for m in messages_dicts if m["role"] == "assistant")
+    assert assistant["content"] == [
+        {
+            "type": "thinking",
+            "thinking": "",
+            "signature": "empty-sig==",
+        },
+        {
+            "type": "tool_use",
+            "id": "tool_call_id",
+            "name": "save",
+            "input": {"path": "path.txt", "content": "file_content"},
+        },
+    ]
+
+
 def test_message_conversion_with_tool_and_non_tool():
     init_tools(allowlist=["save", "shell"])
 
@@ -801,6 +846,11 @@ class TestRequiresAdaptiveThinking:
             "claude-opus-4-8",
             "anthropic/claude-opus-4-8",
             "openrouter/anthropic/claude-opus-4-8",
+            "claude-sonnet-5-5",
+            "anthropic/claude-sonnet-5-5-20260928",
+            "claude-opus-5-5",
+            "claude-fable-5",
+            "claude-fable-5-1",
         ],
     )
     def test_adaptive_required(self, model):
@@ -815,6 +865,10 @@ def test_adaptive_required(self, model):
             "anthropic/claude-opus-4-6",
             "openrouter/anthropic/claude-sonnet-4-5",
             "claude-haiku-4-5",
+            # A non-numeric suffix is a different model, not a dated release.
+            "claude-sonnet-5-5-mini",
+            "claude-opus-5-5-lite",
+            "claude-fable-5-preview",
         ],
     )
     def test_legacy_still_used(self, model):
@@ -832,39 +886,116 @@ def test_disabled_returns_none(self):
             is None
         )
 
-    def test_opus_47_returns_adaptive(self):
-        # Opus 4.7 gets ``{"type": "adaptive"}`` — never legacy, regardless of budget.
+    def test_sonnet_55_disabled_uses_between_tools(self):
         assert _build_thinking_param(
-            "claude-opus-4-7", use_thinking=True, thinking_budget=8000
-        ) == {"type": "adaptive"}
+            "anthropic/claude-sonnet-5-5", use_thinking=False, thinking_budget=8000
+        ) == {"type": "between_tools"}
 
-    def test_opus_47_adaptive_ignores_budget(self):
-        # Budget is irrelevant once adaptive: effort flows via output_config.
+    @pytest.mark.parametrize(
+        "model",
+        ["claude-sonnet-5-5", "claude-opus-5-5", "claude-fable-5", "claude-fable-5-1"],
+    )
+    def test_claude_5_uses_adaptive_with_visible_summaries(self, model):
         assert _build_thinking_param(
-            "claude-opus-4-7", use_thinking=True, thinking_budget=32000
-        ) == {"type": "adaptive"}
+            model, use_thinking=True, thinking_budget=8000
+        ) == {"type": "adaptive", "display": "summarized"}
 
-    def test_opus_48_returns_adaptive(self):
-        assert _build_thinking_param(
-            "claude-opus-4-8", use_thinking=True, thinking_budget=8000
-        ) == {"type": "adaptive"}
 
-    def test_opus_46_returns_legacy_enabled(self):
-        assert _build_thinking_param(
-            "claude-opus-4-6", use_thinking=True, thinking_budget=12345
-        ) == {"type": "enabled", "budget_tokens": 12345}
+@pytest.mark.parametrize("reasoning", ["0", "1"])
+@pytest.mark.parametrize(
+    "model",
+    ["claude-sonnet-5-5", "claude-opus-5-5", "claude-fable-5", "claude-fable-5-1"],
+)
+def test_claude_5_chat_wire_payload(model, reasoning, monkeypatch):
+    """The real SDK sends supported thinking fields, including reasoning-off mode."""
+    payloads = []
+
+    def serve(request):
+        payloads.append(json.loads(request.content))
+        return httpx.Response(
+            200,
+            json={
+                "id": "msg_test",
+                "type": "message",
+                "role": "assistant",
+                "model": model,
+                "content": [
+ 
```

**File**: `tests/test_llm_models.py` (modified, +27/-3)
```diff
@@ -28,6 +28,30 @@ def test_get_static_model():
     assert model.context > 0
 
 
+@pytest.mark.parametrize(
+    ("name", "input_price", "output_price"),
+    [
+        ("claude-sonnet-5-5", 2, 10),
+        ("claude-opus-5-5", 4, 20),
+        ("claude-fable-5", 10, 50),
+        ("claude-fable-5-1", 10, 50),
+    ],
+)
+def test_claude_5_metadata(name, input_price, output_price, caplog):
+    """Explicit and dated model IDs resolve without 4.x metadata fallbacks."""
+    for model_id in (name, f"{name}-20261001"):
+        with caplog.at_level(logging.WARNING):
+            meta = get_model(f"anthropic/{model_id}")
+        assert meta.context == 1_000_000
+        assert meta.max_output == 128_000
+        assert meta.price_input == input_price
+        assert meta.price_output == output_price
+        assert meta.supports_vision
+        assert meta.supports_reasoning
+        assert meta.supports_parallel_tool_calls
+    assert not any("Unknown model" in record.message for record in caplog.records)
+
+
 def test_get_model_provider_only():
     """Test getting recommended model when only provider is given."""
     model = get_model("openai")
@@ -241,7 +265,7 @@ def test_get_model_openrouter_subprovider_suffix_not_in_static():
     ("provider", "expected_model"),
     [
         ("openai", "gpt-5.6-sol"),
-        ("anthropic", "claude-sonnet-4-6"),
+        ("anthropic", "claude-sonnet-5-5"),
         ("gemini", "gemini-3.1-pro-preview"),
         ("openrouter", "deepseek/deepseek-v4.1-flash"),
         ("xai", "grok-4.6"),
@@ -455,10 +479,10 @@ def test_unknown_anthropic_opus_uses_closest_opus(self):
         """An unknown claude-opus variant should inherit from the latest known opus."""
         model = get_model("anthropic/claude-opus-5-0")
         assert model.provider == "anthropic"
-        assert model.context == 1_000_000  # claude-opus-4-7 has 1M context (GA)
+        assert model.context == 1_000_000
         assert model.supports_reasoning is True
         # Opus is more expensive than sonnet
-        assert model.price_input >= 5
+        assert model.price_input == get_model("anthropic/claude-opus-5-5").price_input
 
     def test_unknown_openai_gpt_uses_closest_gpt(self):
         """An unknown GPT model should inherit from the latest known GPT."""
```

**File**: `tests/test_util_cli_models.py` (modified, +1/-1)
```diff
@@ -251,7 +251,7 @@ def test_rst_is_a_grid_table_with_literals(self):
         assert result.exit_code == 0, result.output
         lines = result.output.strip().splitlines()
         assert lines[0].startswith("+-") and lines[2].startswith("+=")
-        assert "``anthropic/claude-sonnet-4-6``" in result.output
+        assert "``anthropic/claude-sonnet-5-5``" in result.output
         # every row has the same width, or Sphinx rejects the table
         assert len({len(line) for line in lines}) == 1
 
```

---

### Incident Patch 8: `4dab17fb` (2026-10-05)
**Commit Message**: fix(compaction): share bounded overflow recovery across CLI and server (#4123)

* fix(compaction): share bounded overflow recovery across CLI and server

Git-Session-Id: c042

* fix(compaction): address Greptile P1s — pinned-state collision and revoked-retry commit

1. Restore reasoning-message pinned state by ordinal position rather than by
   (timestamp, content, role, call_id) tuple, so two identical messages sharing
   a file-mtime timestamp cannot overwrite each other in the lookup dict.

2. Re-verify step ownership under step_lock before committing a successful
   overflow-retry reply — closes the race where a retry completes just as the
   generation is interrupted or replaced and the last overflow_guard check is
   already past.

Tests added for both fixes.

Git-Session-Id: dbc20c5a-e13e-5230-8b20-82e0542d2d6c

* fix(compaction): guard overflow_guard restore against interrupted; skip server tests without flask

- overflow_guard(restoring=True) now also checks session.interrupted so an
  interrupt that sets interrupted without bumping step_seq cannot clobber a
  replacement view during restoration (AI review P1)
- conftest.py client fixture calls pytest.importorskip("flask")

**File**: `docs/context-compression.rst` (modified, +8/-1)
```diff
@@ -12,7 +12,7 @@ Overview
 The context compression system has one unified pipeline:
 
 1. **Context Budget** - A configurable token threshold at which compaction is triggered (distinct from the provider window)
-2. **Automatic Compaction** - Triggered after each turn when the log approaches the budget; also retried once on provider context-length overflow
+2. **Automatic Compaction** - Triggered after each turn when the log approaches the budget; shared CLI/server recovery handles provider context-length overflow
 3. **Plugin Interface** - Allows third-party packages to provide custom compression strategies
 
 The budget defaults to
@@ -61,6 +61,13 @@ than 10% of the estimated stored text. If estimated trim savings are too small,
 the automatic path requests an LLM summary instead. A failed summary latches
 the conversation to trim-only until sufficient message growth permits a retry.
 
+CLI and server overflow recovery try a trim first, then remove old whole
+assistant/user steps with their tool results toward 70% of the previous context
+size. The protected head, pinned steps, newest user request, and final step stay
+verbatim. Every retry must reduce the prepared input; at most eight retries run.
+Partial output stops retries. Failed recovery restores the original active view;
+successful recovery keeps the smaller view and preserves the lossless master log.
+
 Using Compaction
 ================
 
```

**File**: `gptme/chat.py` (modified, +19/-75)
```diff
@@ -23,8 +23,6 @@
 from .hooks import HookType, StopPropagation, trigger_hook
 from .init import init
 from .llm import (
-    did_llm_reply_emit_visible_output,
-    is_context_length_error,
     is_llm_reply_error,
     reply,
 )
@@ -803,7 +801,9 @@ def _reply_with_overflow_recovery(
     logdir: Path | None,
     max_tokens: int | None = None,
 ) -> Message:
-    """Generate once, compacting to a lossless view and retrying on overflow."""
+    """Generate with shared, view-preserving context-overflow recovery."""
+    # Dynamic catalogs may fail on a second lookup after a successful reply.
+    model_meta = get_model(model)
 
     def generate(messages: list[Message]) -> Message:
         manager = LogManager.get_current_log()
@@ -816,10 +816,6 @@ def generate(messages: list[Message]) -> Message:
         )
         input_count = len(stored_input)
         input_digest = input_log_digest(stored_input)
-        # Resolve model metadata once: get_model() may hit a dynamic catalog
-        # (OpenRouter/gptme) whose failures aren't cached, so a second lookup
-        # after generation could fail the step after a successful reply.
-        model_meta = get_model(model)
         response = reply(
             messages,
             model_meta.full,
@@ -834,75 +830,23 @@ def generate(messages: list[Message]) -> Message:
         anchor_context_usage(response, input_count, input_digest, model_meta.full)
         return response
 
-    try:
-        return generate(msgs)
-    except Exception as first_error:
-        if not is_context_length_error(first_error) or logdir is None:
-            raise
-
-        from time import monotonic
-
-        from .tools.autocompact.events import append_compaction_event
-        from .tools.autocompact.recovery import compact_for_overflow
-
-        manager = LogManager.get_current_log()
-        if (
-            manager is None
-            or manager.log is not log
-            or manager.logdir.resolve() != logdir.resolve()
-        ):
-            raise
+    from .tools.autocompact.recovery import recover_reply
 
-        # Retrying after a visible streaming prefix would duplicate output. A
-        # context rejection before the first provider chunk is still atomic.
-        if did_llm_reply_emit_visible_output(first_error):
-            raise
-
-        started = monotonic()
-        before_messages = manager.log.messages
-        before_tokens = len_tokens(before_messages, get_model(model).model)
-        compacted_messages = compact_for_overflow(manager)
-        after_tokens = len_tokens(compacted_messages, get_model(model).model)
-        view_name = manager.get_next_view_name()
-        manager.create_view(view_name, compacted_messages)
-        manager.switch_view(view_name)
-        retry_success = False
-        keep_compacted_view = False
-        provider_tokens_before = len_tokens(msgs, get_model(model).model)
-        provider_tokens_after = None
-        try:
-            retry_messages = prepare_messages(
-                manager.log.messages, workspace, logdir=logdir
-            )
-            provider_tokens_after = len_tokens(retry_messages, get_model(model).model)
-            if provider_tokens_after >= provider_tokens_before:
-                logger.warning(
-                    "Overflow compaction did not shrink provider input "
-                    "(%d -> %d tokens); skipping retry",
-                    provider_tokens_before,
-                    provider_tokens_after,
-                )
-                raise first_error
-            response = generate(retry_messages)
-            retry_success = True
-            keep_compacted_view = True
-            return response
-        finally:
-            append_compaction_event(
-                logdir,
-                trigger="overflow",
-                method="trim",
-                tokens_before=before_tokens,
-                tokens_after=after_tokens,
-                messages_before=len(before_messages),
-                messages_after=len(compacted_messages),
-                elapsed_seconds=monotonic() - started,
-                retry_success=retry_success,
-                provider_tokens_before=provider_tokens_before,
-                provider_tokens_after=provider_tokens_after,
-            )
-            if not keep_compacted_view:
-                manager.switch_to_master()
+    manager = LogManager.get_current_log()
+    if (
+        manager is None
+        or manager.log is not log
+        or logdir is None
+        or manager.logdir.resolve() != logdir.resolve()
+    ):
+        manager = None
+    return recover_reply(
+        manager,
+        msgs,
+        model_meta.full,
+        generate,
+        lambda messages: prepare_messages(messages, workspace, logdir=logdir),
+    )
 
 
 @trace_function(name="chat.step", attributes={"component": "chat"})
```

**File**: `gptme/server/session_step.py` (modified, +138/-83)
```diff
@@ -15,7 +15,7 @@
 import threading
 import time
 import uuid
-from collections.abc import Iterable
+from collections.abc import Iterable, Iterator
 from contextlib import AbstractContextManager, contextmanager
 from datetime import datetime, timezone
 from pathlib import Path
@@ -26,12 +26,13 @@
 from ..executor import prepare_execution_environment
 from ..hooks import HookType, trigger_hook
 from ..hooks.confirm import ConfirmationResult
-from ..llm import _chat_complete, _stream
+from ..llm import _chat_complete, _stream, mark_llm_reply_origin
 from ..logmanager import LogManager, prepare_messages
 from ..message import Message, MessageMetadata, MessageTimings
 from ..telemetry import trace_function
 from ..tools import ToolUse, get_tools
 from ..tools._url_safety import set_session_allow_hosts
+from ..tools.autocompact.recovery import recover_reply
 from ..tools.shell import set_workspace_cwd
 from ..util.context_measurement import anchor_context_usage, input_log_digest
 from ..util.cost_tracker import CostTracker, session_id_for_logdir
@@ -922,9 +923,6 @@ def step(
         manager.write()
         logger.debug("Wrote step.pre hook messages to disk")
 
-    # Anchor usage to stored input before preparation merges/enriches messages.
-    input_count = len(manager.log.messages)
-    input_digest = input_log_digest(manager.log.messages)
     # Prepare messages for the model
     msgs = prepare_messages(manager.log.messages, logdir=manager.logdir)
     if not msgs:
@@ -955,95 +953,149 @@ def step(
     skill_outcome: SkillPhase | None = None
     skill_error_type = None
     try:
-        # Stream tokens from the model
         output = ""
-        tooluses = []
-        # Handle streaming vs non-streaming differently
-        metadata = None
-
-        # Batch settings for SSE events: accumulate chars and flush at a
-        # batch boundary (~20 chars) or on newline, to dramatically reduce
-        # SSE event volume (10K events → ~500 for a typical response).
-        _SSE_BATCH_SIZE = 20
-        sse_token_batch: list[str] = []
-
-        def _flush_sse_batch() -> None:
-            if not sse_token_batch:
-                return
-            SessionManager.add_event(
-                conversation_id,
-                {
-                    "type": "generation_progress",
-                    "token": "".join(sse_token_batch),
-                },
-            )
-            sse_token_batch.clear()
+        tooluses: list[ToolUse] = []
 
-        if stream:
-            stream_wrapper = _stream(
-                msgs,
-                model,
-                tools,
-                max_tokens=effective_max_tokens,
-                temperature=effective_temperature,
-                top_p=effective_top_p,
-            )
-            chunks: Iterable[str] = stream_wrapper
-        else:
-            response, metadata = _chat_complete(
-                msgs,
-                model,
-                tools,
-                max_tokens=effective_max_tokens,
-                temperature=effective_temperature,
-                top_p=effective_top_p,
+        def retry_allowed() -> bool:
+            return (
+                session.generating
+                and not session.interrupted
+                and session.step_seq == my_step_seq
             )
-            chunks = [response]  # Wrap in list to iterate
-            stream_wrapper = None
 
-        for token in (char for chunk in chunks for char in chunk):
-            # check if interrupted
-            if (
-                not session.generating
-                or session.interrupted
-                or session.step_seq != my_step_seq
-            ):
-                output += " [INTERRUPTED]"
-                break
+        @contextmanager
+        def overflow_guard(restoring: bool) -> Iterator[None]:
+            # Serialize view activation with interrupt/replacement admission.
+            # Interrupt and replacement both bump step_seq under step_lock, so
+            # ownership of the view reduces to the epoch check; only retry
+            # admission additionally needs a live, uninterrupted generation.
+            with session.step_lock:
+                if session.step_seq != my_step_seq or (
+                    not restoring and not retry_allowed()
+                ):
+                    raise InterruptedError("Step no longer owns generation")
+                yield
+
+        def generate(messages: list[Message]) -> Message:
+            nonlocal output, tooluses
+            if not retry_allowed():
+                raise InterruptedError("Step no longer owns generation")
+            input_count = len(manager.log.messages)
+            input_digest = input_log_digest(manager.log.messages)
+            output = ""
+            tooluses = []
+            # Handle streaming vs non-streaming differently
+            metadata = None
+
+            # Batch settings for SSE events: accumulate chars and flush at a
+            # batch bound
```

**File**: `gptme/tools/autocompact/recovery.py` (modified, +189/-3)
```diff
@@ -8,6 +8,9 @@
 from .context_provider import CompressionConfig, get_context_provider
 
 if TYPE_CHECKING:
+    from collections.abc import Callable
+    from contextlib import AbstractContextManager
+
     from ...logmanager import LogManager
     from ...message import Message
 
@@ -23,6 +26,189 @@ def compact_for_overflow(manager: LogManager) -> list[Message]:
         logdir=manager.logdir,
         keep_head=_get_keep_head(),
     )
-    return (
-        get_context_provider("default").compress(manager.log.messages, config).messages
-    )
+    from .engine import _has_reasoning_block
+
+    # reduce_log's final fallback can truncate details inside thinking. Protect
+    # those blocks during trim, then restore flags so whole-step dropping works.
+    # Track originals by position rather than content-tuple to avoid collisions
+    # when two reasoning messages share the same timestamp/content/role/call_id
+    # (e.g. legacy messages whose timestamp is a shared file-mtime).
+    keep_head = config.keep_head
+    orig_pinned = [
+        msg.pinned
+        for i, msg in enumerate(manager.log.messages)
+        if i >= keep_head and _has_reasoning_block(msg.content)
+    ]
+    trim_input = [
+        message.replace(pinned=True)
+        if _has_reasoning_block(message.content)
+        else message
+        for message in manager.log.messages
+    ]
+    compressed = get_context_provider("default").compress(trim_input, config).messages
+    # Reasoning messages are pinned so the compressor preserves them in order;
+    # restore each one's original pinned value by its ordinal position.
+    reasoning_counter = 0
+    result = []
+    for index, message in enumerate(compressed):
+        if index >= keep_head and _has_reasoning_block(message.content):
+            if reasoning_counter < len(orig_pinned):
+                result.append(message.replace(pinned=orig_pinned[reasoning_counter]))
+                reasoning_counter += 1
+            else:
+                result.append(message)
+        else:
+            result.append(message)
+    return result
+
+
+def _drop_oldest_turn(messages: list[Message]) -> list[Message]:
+    """Drop one old assistant/user step with all its following tool results.
+
+    The protected head, pinned steps, newest user request, and final step stay
+    verbatim. Grouping consecutive system results with their non-system anchor
+    works for markdown, XML, and structured tool calls without parsing content.
+    """
+    starts = [i for i, message in enumerate(messages) if message.role != "system"]
+    keep_head = _get_keep_head()
+    last_user = max((i for i in starts if messages[i].role == "user"), default=-1)
+    for index, start in enumerate(starts[:-1]):
+        end = starts[index + 1]
+        if start < keep_head or start == last_user:
+            continue
+        if any(message.pinned for message in messages[start:end]):
+            continue
+        return messages[:start] + messages[end:]
+    return messages
+
+
+def _drop_to_retry_target(messages: list[Message], model: str) -> list[Message]:
+    """Remove whole old steps toward the same hysteresis target as budget trims."""
+    from ...util.context_measurement import measure_context_tokens
+    from .decision import TRIM_TARGET_RATIO
+
+    target = measure_context_tokens(messages, model) * TRIM_TARGET_RATIO
+    while measure_context_tokens(messages, model) > target:
+        smaller = _drop_oldest_turn(messages)
+        if len(smaller) == len(messages):
+            break
+        messages = smaller
+    return messages
+
+
+def recover_reply(
+    manager: LogManager | None,
+    messages: list[Message],
+    model: str,
+    generate: Callable[[list[Message]], Message],
+    prepare: Callable[[list[Message]], list[Message]],
+    *,
+    retry_guard: Callable[[bool], AbstractContextManager[None]] | None = None,
+) -> Message:
+    """Retry atomic provider overflows using strictly smaller lossless views.
+
+    Try the existing trim first, then drop old whole steps toward 0.7 of the
+    previous request. At most eight smaller requests are attempted. Exhaustion,
+    non-context errors, and partially emitted output restore the original view.
+    A caller guard serializes view changes and distinguishes retry admission
+    (False) from restoration (True), so revoked server epochs cannot clobber
+    a replacement step's view.
+    """
+    from contextlib import nullcontext
+    from time import monotonic
+
+    from ...llm import did_llm_reply_emit_visible_output, is_context_length_error
+    from ...message import len_tokens
+    from ...util.context_measurement import measure_context_tokens
+    from .events import append_compaction_event
+
+    def guard(restoring: bool = False) -> AbstractContextManager[None]:
+        return retry_guard(restoring) if retry_guard is not None else nullcontext()
+
+    try:
+        return generate(messages)
+    except Exception as caught:
+        if (
+  
```

**File**: `tests/conftest.py` (modified, +1/-0)
```diff
@@ -808,6 +808,7 @@ def server_error_records() -> Iterator[list[logging.LogRecord]]:
 
 @pytest.fixture
 def client(monkeypatch):
+    pytest.importorskip("flask", reason="flask not installed; install -E server")
     from gptme.server.app import create_app  # fmt: skip
 
     # Disable auth for the generic test client so existing tests don't need tokens.
```

**File**: `tests/test_overflow_recovery.py` (added, +578/-0)
```diff
@@ -0,0 +1,578 @@
+"""Overflow retries preserve views, whole turns, and the output boundary."""
+
+import importlib
+from uuid import uuid4
+
+import httpx
+import pytest
+
+from gptme.llm import mark_llm_reply_origin
+from gptme.logmanager import LogManager
+from gptme.message import Message
+from gptme.util.context_measurement import input_log_digest
+
+
+def overflow() -> httpx.HTTPStatusError:
+    error = httpx.HTTPStatusError(
+        "maximum context length exceeded",
+        request=httpx.Request("POST", "https://example.test"),
+        response=httpx.Response(400),
+    )
+    mark_llm_reply_origin(error)
+    return error
+
+
+def history() -> list[Message]:
+    return [
+        Message("system", "System prompt"),
+        Message("user", "Original task"),
+        Message("assistant", "Old response " * 200),
+        Message("system", "Old result " * 200),
+        Message("assistant", "More history " * 200),
+        Message("system", "More results " * 200),
+        Message("user", "Continue"),
+    ]
+
+
+def cli_reply(manager: LogManager) -> Message:
+    chat = importlib.import_module("gptme.chat")
+    return chat._reply_with_overflow_recovery(
+        log=manager.log,
+        msgs=manager.log.messages,
+        model="openai/gpt-4",
+        stream=False,
+        tools=None,
+        workspace=None,
+        output_schema=None,
+        on_token=None,
+        on_thinking=None,
+        logdir=manager.logdir,
+    )
+
+
+def test_cli_recovers_after_two_context_rejections(tmp_path, monkeypatch):
+    chat = importlib.import_module("gptme.chat")
+    manager = LogManager(history(), logdir=tmp_path / "conversation")
+    original = manager.log.messages.copy()
+    calls = []
+
+    def generate(messages, *args, **kwargs):
+        calls.append(messages.copy())
+        if len(calls) <= 2:
+            raise overflow()
+        return Message(
+            "assistant", "Recovered", metadata={"usage": {"input_tokens": 100}}
+        )
+
+    monkeypatch.setattr(chat, "reply", generate)
+    monkeypatch.setattr(chat, "prepare_messages", lambda messages, *a, **kw: messages)
+    monkeypatch.setattr(
+        "gptme.tools.autocompact.recovery.compact_for_overflow",
+        lambda active: active.log.messages[:2] + active.log.messages[4:],
+    )
+    result = cli_reply(manager)
+    assert len(calls) == 3
+    assert [len(m) for m in calls] == [7, 5, 3]
+    assert manager.log.messages[:2] == original[:2]
+    assert manager.log.messages[-1] == original[-1]
+    assert result.metadata is not None
+    assert result.metadata["input_log_digest"] == input_log_digest(manager.log.messages)
+    manager.switch_to_master()
+    assert manager.log.messages == original
+
+
+def test_cli_restores_original_view_on_retry_failure(tmp_path, monkeypatch):
+    chat = importlib.import_module("gptme.chat")
+    manager = LogManager(history(), logdir=tmp_path / "conversation")
+    manager.create_view("existing", history()[:-2] + history()[-1:])
+    manager.switch_view("existing")
+    original = manager.log.messages.copy()
+    calls = 0
+
+    def generate(*args, **kwargs):
+        nonlocal calls
+        calls += 1
+        if calls == 1:
+            raise overflow()
+        raise RuntimeError("provider unavailable")
+
+    monkeypatch.setattr(chat, "reply", generate)
+    monkeypatch.setattr(chat, "prepare_messages", lambda messages, *a, **kw: messages)
+    monkeypatch.setattr(
+        "gptme.tools.autocompact.recovery.compact_for_overflow",
+        lambda active: active.log.messages[:2] + active.log.messages[-1:],
+    )
+    with pytest.raises(RuntimeError, match="provider unavailable"):
+        cli_reply(manager)
+    assert manager.current_view == "existing"
+    assert manager.log.messages == original
+
+
+@pytest.mark.parametrize(
+    ("stream", "partial"), [(False, False), (True, False), (True, True)]
+)
+def test_server_recovers_before_output_and_anchors_retry(
+    client, tmp_path, monkeypatch, stream, partial
+):
+    pytest.importorskip("flask")
+    from gptme.server import session_step
+    from gptme.server.session_models import SessionManager
+
+    name = f"test-overflow-{uuid4().hex}"
+    response = client.put(
+        f"/api/v2/conversations/{name}",
+        json={
+            "prompt": "System prompt",
+            "config": {"chat": {"workspace": str(tmp_path)}},
+        },
+    )
+    assert response.status_code == 200
+    session = SessionManager.get_session(response.get_json()["session_id"])
+    assert session is not None
+    manager = LogManager.load(name, lock=False)
+    for message in history()[1:]:
+        manager.append(message)
+    manager.write()
+    calls = []
+
+    def complete(messages, *args, **kwargs):
+        calls.append(messages.copy())
+        if len(calls) == 1:
+            raise overflow()
+        return "Recovered", {"usage": {"input_tokens": 100}}
+
+    class Stream:
+        metadata = {"usage": {"input_tokens": 100}}
+
+        def
```

---

### Incident Patch 9: `127dc5c9` (2026-10-05)
**Commit Message**: fix(cli): warn on stderr when prompts expand path not found (#3943)

* fix(cli): warn on stderr when prompts expand path not found

Git-Session-Id: b939

* fix(cli): broaden prompts-expand missing-path warnings

Warn on parent-relative and Windows drive paths that the finder already
returns, skip slash commands the same way include_paths does, and cover
the warning branch in CLI tests.

Git-Session-Id: 49deb60b-2a06-5427-bec2-06eaf1949adb

* fix(cli): don't hide missing-path warnings behind command heuristic

is_message_command treats any first token with one slash as a command, so
/nonexistent and mixed prompts starting with /tmp skipped the whole scan.
Skip only actual slash-command tokens instead.

Git-Session-Id: 76eabfc8-2e71-5fe2-877a-199a4a7d5245

* fix(cli): only warn on whole-prompt missing expand paths

Per-token warnings fought the expand heuristic: mixed text like
'see README.md about ./file.txt' may mention a path that is prose
or relative to another expanded file. Warn only when the entire
prompt is a single explicit path that was not found.

Git-Session-Id: 01a0cff2-db12-75d0-b477-ebc935851929

* fix(cli): warn on spaced whole-prompt paths; skip punct-normalized hits

**File**: `gptme/cli/util.py` (modified, +92/-0)
```diff
@@ -1461,10 +1461,102 @@ def prompts_expand(prompt: tuple[str, ...]):
         if disabled_path_include is not None:
             os.environ["GPTME_DISABLE_PATH_INCLUDE"] = disabled_path_include
 
+    # Mixed-text tokens are heuristic (prose, or relative to another expanded
+    # path) and must stay silent. Warn only when the entire prompt is a single
+    # Click argument that is an explicit path and wasn't found.
+    _warn_if_whole_prompt_path_missing(prompt)
+
     # Print the expanded content exactly as it would be sent to the LLM
     print(expanded_msg.content)
 
 
+def _warn_if_whole_prompt_path_missing(prompt: tuple[str, ...]) -> None:
+    """Warn on stderr when the whole prompt is one missing explicit path.
+
+    Use Click's argument boundary, not whitespace: a quoted path with spaces
+    (``"/tmp/missing file.txt"``) is still one path. Multiple arguments stay
+    silent — that is mixed text. A single argument that starts with a complete
+    path then continues as prose (``"./missing.txt is discussed here"``) is
+    also silent.
+
+    Existence follows ``_find_potential_paths`` punctuation stripping so
+    ``/tmp/existing.txt.`` does not false-warn after a successful expand.
+    """
+    if len(prompt) != 1:
+        return
+    stripped = prompt[0].strip()
+    if not stripped:
+        return
+    if not _looks_like_explicit_file_path(stripped):
+        return
+    if _is_quoted_mixed_prose(stripped):
+        return
+    if _is_slash_command_token(stripped):
+        return
+    # Same trailing-punct strip as gptme.util.context._find_potential_paths.
+    normalized = stripped.rstrip("?").rstrip(".").rstrip(",").rstrip("!")
+    if Path(stripped).expanduser().exists() or Path(normalized).expanduser().exists():
+        return
+    click.echo(f"warning: path not found, not expanded: {stripped}", err=True)
+
+
+def _is_quoted_mixed_prose(prompt: str) -> bool:
+    """True when one Click argument starts with a complete path then continues as text.
+
+    Distinguishes ``./missing.txt is discussed here`` (mixed prose, silent)
+    from ``/tmp/missing file.txt`` (one spaced filename, warn). A single
+    argument is prose when the first token is already a complete file name —
+    its *basename* carries an extension — or when there are three or more
+    words (a sentence). Testing the basename rather than the whole token keeps
+    ``./missing file.txt`` and ``/tmp/v1.2/missing file.txt`` warning, while
+    ``/tmp/v1.2/readme is discussed here`` stays silent on its word count.
+    """
+    parts = prompt.split(None, 2)
+    if len(parts) < 2:
+        return False
+    first = parts[0]
+    if not _looks_like_explicit_file_path(first):
+        return False
+    if "." in Path(first).name:
+        return True
+    return len(parts) >= 3
+
+
+def _looks_like_explicit_file_path(path: str) -> bool:
+    """True for a whole-prompt token intended as a filesystem path, not prose.
+
+    Absolute (`/`), home (`~/`), cwd-relative (`./`), parent-relative (`../`),
+    and Windows drive-absolute (`C:/`, `C:\\`) forms. Bare names like
+    `README.md` stay silent — those are heuristic, not explicit paths.
+    """
+    if path.startswith(("/", "~/", "./", "../")):
+        return True
+    return len(path) >= 3 and path[0].isalpha() and path[1] == ":" and path[2] in "/\\"
+
+
+def _is_slash_command_token(word: str) -> bool:
+    """True for actual /commands, not single-component filesystem paths.
+
+    ``is_message_command`` treats any first token with exactly one slash as a
+    command, so ``/nonexistent`` would skip the missing-path warning.
+    Restrict the exemption to registered commands and discovered tool names.
+    """
+    if not word.startswith("/") or "/" in word[1:] or not word[1:]:
+        return False
+    name = word[1:]
+    try:
+        from ..commands.base import get_registered_commands  # fmt: skip
+        from ..commands.meta import COMMANDS  # fmt: skip
+
+        if name in COMMANDS or name in get_registered_commands():
+            return True
+        from ..tools import get_available_tools  # fmt: skip
+
+        return any(t.name == name for t in get_available_tools(include_mcp=False))
+    except Exception:
+        return False
+
+
 @main.group()
 def models():
     """Model-related utilities."""
```

**File**: `tests/test_util_cli.py` (modified, +247/-0)
```diff
@@ -354,6 +354,15 @@ def test_context_index_and_retrieve(tmp_path):
         )
 
 
+def _runner_separate_stderr() -> CliRunner:
+    # Click < 8.2 defaults to mix_stderr=True; Click 8.2 removed that kwarg
+    # and separates streams by default. Use try/except to handle both.
+    try:
+        return CliRunner(mix_stderr=False)  # type: ignore[call-arg]
+    except TypeError:
+        return CliRunner()
+
+
 def test_prompts_expand_ignores_disable_path_include(tmp_path, monkeypatch):
     """`prompts expand` should still show path expansion under disabled include env.
 
@@ -374,6 +383,244 @@ def test_prompts_expand_ignores_disable_path_include(tmp_path, monkeypatch):
     assert os.environ["GPTME_DISABLE_PATH_INCLUDE"] == "1"
 
 
+def test_prompts_expand_warns_on_missing_path(tmp_path, monkeypatch):
+    """Missing explicit paths warn on stderr; stdout stays the unexpanded path."""
+    monkeypatch.chdir(tmp_path)
+    runner = _runner_separate_stderr()
+    missing = "/nonexistent/gptme-prompts-expand-missing.txt"
+
+    result = runner.invoke(main, ["prompts", "expand", missing])
+
+    assert result.exit_code == 0
+    assert f"warning: path not found, not expanded: {missing}" in result.stderr
+    assert missing in result.stdout
+    assert "warning:" not in result.stdout
+
+
+def test_prompts_expand_no_warning_for_existing_path(tmp_path, monkeypatch):
+    """Existing files expand on stdout and do not emit a missing-path warning."""
+    monkeypatch.chdir(tmp_path)
+    runner = _runner_separate_stderr()
+    test_file = tmp_path / "hello.txt"
+    test_file.write_text("hello\n")
+
+    result = runner.invoke(main, ["prompts", "expand", str(test_file)])
+
+    assert result.exit_code == 0
+    assert "warning:" not in result.stderr
+    assert "hello" in result.stdout
+    assert str(test_file) in result.stdout
+
+
+def test_prompts_expand_warns_on_parent_relative_and_windows_paths(
+    tmp_path, monkeypatch
+):
+    """Whole-prompt parent-relative and Windows drive paths still warn."""
+    monkeypatch.chdir(tmp_path)
+    runner = _runner_separate_stderr()
+
+    parent = runner.invoke(
+        main, ["prompts", "expand", "../gptme-definitely-missing.txt"]
+    )
+    windows = runner.invoke(
+        main, ["prompts", "expand", "C:/gptme-definitely-missing.txt"]
+    )
+
+    assert parent.exit_code == 0
+    assert windows.exit_code == 0
+    assert "warning: path not found, not expanded: ../gptme-definitely-missing.txt" in (
+        parent.stderr
+    )
+    assert "warning: path not found, not expanded: C:/gptme-definitely-missing.txt" in (
+        windows.stderr
+    )
+    assert "warning:" not in parent.stdout
+    assert "warning:" not in windows.stdout
+
+
+def test_prompts_expand_skips_slash_commands(tmp_path, monkeypatch):
+    """Slash commands are not missing files — include_paths skips them too."""
+    monkeypatch.chdir(tmp_path)
+    runner = _runner_separate_stderr()
+
+    result = runner.invoke(main, ["prompts", "expand", "/shell"])
+
+    assert result.exit_code == 0
+    assert "warning:" not in result.stderr
+    assert "/shell" in result.stdout
+
+
+def test_prompts_expand_warns_on_single_component_missing_path(tmp_path, monkeypatch):
+    """Single-component absolute paths are files, not slash commands."""
+    monkeypatch.chdir(tmp_path)
+    runner = _runner_separate_stderr()
+    missing = "/nonexistent"
+
+    result = runner.invoke(main, ["prompts", "expand", missing])
+
+    assert result.exit_code == 0
+    assert f"warning: path not found, not expanded: {missing}" in result.stderr
+    assert missing in result.stdout
+    assert "warning:" not in result.stdout
+
+
+def test_prompts_expand_mixed_prompt_does_not_warn(tmp_path, monkeypatch):
+    """Heuristic mixed text stays silent even if a later token looks like a path."""
+    monkeypatch.chdir(tmp_path)
+    runner = _runner_separate_stderr()
+    first = "/tmp" if Path("/tmp").exists() else "/nonexistent-cmd-lookalike"
+    missing = "/nonexistent/gptme-prompts-expand-later.txt"
+
+    result = runner.invoke(main, ["prompts", "expand", first, missing])
+
+    assert result.exit_code == 0
+    assert "warning:" not in result.stderr
+    assert "warning:" not in result.stdout
+
+
+def test_prompts_expand_mixed_relative_path_no_warning(tmp_path, monkeypatch):
+    """Expand README; missing ./file.txt in the same sentence is not a warning."""
+    monkeypatch.chdir(tmp_path)
+    (tmp_path / "README.md").write_text("hello from readme\n")
+    runner = _runner_separate_stderr()
+
+    result = runner.invoke(
+        main,
+        ["prompts", "expand", "see README.md about something about a ./file.txt"],
+    )
+
+    assert result.exit_code == 0
+    assert "warning:" not in result.stderr
+    assert "hello from readme" in result.stdout
+
+
+def test_prompts_expand_relative_to_other_path_no_warning(tmp_path, monkeypatch):
+    """./file.txt next to proj/README.md may be relative to proj, not cwd."""
+    monkeypat
```

---

### Incident Patch 10: `36ada30f` (2026-10-05)
**Commit Message**: fix(webui): keep welcome view reachable on short/mobile viewports (#4056)

Git-Session-Id: 5f97

**File**: `webui/src/components/WelcomeView.tsx` (modified, +3/-3)
```diff
@@ -353,10 +353,10 @@ export const WelcomeView = () => {
   const hasCustomBg = !!bg;
 
   return (
-    <div className="mx-auto flex h-full w-full flex-col" style={bgStyle}>
-      <div className="mx-auto flex h-full w-full max-w-5xl flex-col items-center justify-center pt-12 sm:px-6">
+    <div className="mx-auto flex h-full w-full flex-col overflow-y-auto" style={bgStyle}>
+      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col items-center pt-12 sm:px-6">
         <div
-          className={`w-full max-w-4xl border p-6 shadow-[0_30px_120px_-48px_rgba(15,23,42,0.45)] sm:rounded-[3em] sm:p-8 ${
+          className={`my-auto w-full max-w-4xl border p-6 shadow-[0_30px_120px_-48px_rgba(15,23,42,0.45)] sm:rounded-[3em] sm:p-8 ${
             hasCustomBg
               ? 'border-white/20 bg-background/60 backdrop-blur-xl'
               : 'border-border/70 bg-background/90 backdrop-blur'
```

---

### Incident Patch 11: `c507599a` (2026-10-05)
**Commit Message**: fix(llm): raise on Responses API error/response.failed events, warn on incomplete (#4084)

* fix(llm): raise on Responses API error/response.failed events, warn on incomplete

_stream_responses_events had no branch for `error`, `response.failed` or
`response.incomplete`, so a failed or truncated response ended the stream
silently and looked like a normal (often empty) reply. This affects both the
SDK Responses path and openai-subscription, which share the helper.

- `error` / `response.failed` raise an openai.APIError whose body carries
  the provider's code and message, so is_provider_error() and
  is_context_length_error() classify it like other provider failures.
- `response.incomplete` logs the incomplete_details reason and still records
  usage and the served model like completed/done.

Git-Session-Id: 73d6

* fix(llm): don't count incomplete Responses API generations as successful

Address review: response.incomplete still records usage and cost, but the
telemetry request is now recorded with success=False. A new
incomplete_callback on _stream_responses_events fires before the usage
callback, keeping the one-argument usage_callback contract.

Git-Session-Id: 3ed7

**File**: `gptme/llm/llm_openai.py` (modified, +13/-0)
```diff
@@ -267,6 +267,10 @@ def _record_usage(
 ) -> MessageMetadata | None:
     """Record usage metrics as telemetry and return MessageMetadata.
 
+    ``success`` is False for a response that ended incomplete (e.g. hit the
+    output token limit): its usage and cost still count, but it is not
+    recorded as a completed generation.
+
     ``reasoning_effort`` is the effective level applied to the request (from
     ``GPTME_THINKING_EFFORT``); it is stamped on the metadata so session logs
     record how much reasoning was requested, not just how many tokens came back.
@@ -1627,20 +1631,29 @@ def _capture_model(served: str) -> None:
         nonlocal served_model
         served_model = served
 
+    incomplete = False
+
+    def _capture_incomplete() -> None:
+        # Fires before usage on response.incomplete.
+        nonlocal incomplete
+        incomplete = True
+
     def _capture_usage(usage: Any) -> None:
         nonlocal captured_metadata
         captured_metadata = _record_usage(
             usage,
             model,
             reasoning_effort=reasoning_effort,
             served_model=served_model,
+            success=not incomplete,
         )
 
     stream = client.responses.create(**kwargs)
     yield from _stream_responses_events(
         _guarded_stream_iter(stream, model=model, provider=provider),
         usage_callback=_capture_usage,
         model_callback=_capture_model,
+        incomplete_callback=_capture_incomplete,
     )
 
     if captured_metadata is None and (
```

**File**: `gptme/llm/openai_responses.py` (modified, +43/-1)
```diff
@@ -365,6 +365,7 @@ def _stream_responses_events(
     *,
     usage_callback: Callable[[Any], None] | None = None,
     model_callback: Callable[[str], None] | None = None,
+    incomplete_callback: Callable[[], None] | None = None,
 ) -> Generator[str, None, None]:
     """Process a Responses API event stream, yielding formatted text chunks.
 
@@ -470,8 +471,26 @@ def _stream_responses_events(
                 if served is not None:
                     model_callback(served)
 
-        elif event_type in ("response.completed", "response.done"):
+        elif event_type in ("error", "response.failed"):
+            # Without this a failed response ended the stream silently and
+            # looked like a normal (often empty) reply.
+            raise _responses_stream_error(event)
+
+        elif event_type in (
+            "response.completed",
+            "response.done",
+            "response.incomplete",
+        ):
             response_obj = _obj_get(event, "response", None)
+            if event_type == "response.incomplete":
+                details = _obj_get(response_obj, "incomplete_details", None)
+                logger.warning(
+                    "Responses API stream ended incomplete (reason=%s); "
+                    "output may be truncated",
+                    _obj_get(details, "reason", None) or "unknown",
+                )
+                if incomplete_callback is not None:
+                    incomplete_callback()
             if model_callback is not None:
                 served = served_model_from(response_obj)
                 if served is not None:
@@ -491,6 +510,29 @@ def _stream_responses_events(
         )
 
 
+def _responses_stream_error(event: Any) -> Exception:
+    """Build a provider error from an ``error``/``response.failed`` stream event.
+
+    ``error`` events carry ``code``/``message`` at the top level;
+    ``response.failed`` nests them under ``response.error``. Raising an
+    ``openai.APIError`` with that body lets ``is_provider_error()`` and
+    ``is_context_length_error()`` classify it like any other provider failure.
+    """
+    import httpx
+    from openai import APIError  # fmt: skip
+
+    error = _obj_get(_obj_get(event, "response", None), "error", None) or event
+    code = _obj_get(error, "code", None)
+    message = _obj_get(error, "message", None) or "unknown error"
+    body = {"code": code, "message": message}
+    request = httpx.Request("POST", "https://api.openai.com/v1/responses")
+    return APIError(
+        f"Responses API stream failed ({code or 'no code'}): {message}",
+        request,
+        body=body,
+    )
+
+
 def _extract_usage_token_counts(usage: Any) -> UsageTokenCounts:
     """Normalize Chat Completions and Responses API usage token fields.
 
```

**File**: `tests/test_served_model_metadata.py` (modified, +72/-0)
```diff
@@ -627,3 +627,75 @@ def test_anthropic_stream_served_model_from_message_start(
         assert metadata["served_model"] == expected
         # break_on_tooluse fallback (message_start partial) carries it too.
         assert partial["metadata"]["served_model"] == expected
+
+
+@pytest.mark.parametrize(
+    "event",
+    [
+        {
+            "type": "response.failed",
+            "response": {"error": {"code": "server_error", "message": "boom"}},
+        },
+        {"type": "error", "code": "server_error", "message": "boom"},
+    ],
+)
+def test_responses_stream_failure_raises_provider_error(event: dict) -> None:
+    """A failed response must raise, not end the stream as an empty reply."""
+    import openai
+
+    events = [{"type": "response.output_text.delta", "delta": "partial"}, event]
+    with pytest.raises(openai.APIError) as exc_info:
+        list(_stream_responses_events(events))
+    assert exc_info.value.body == {"code": "server_error", "message": "boom"}
+    assert "boom" in str(exc_info.value)
+
+
+def test_responses_stream_incomplete_warns_and_records_usage(caplog) -> None:
+    usage: list = []
+    events = [
+        {"type": "response.output_text.delta", "delta": "truncated"},
+        {
+            "type": "response.incomplete",
+            "response": {
+                "incomplete_details": {"reason": "max_output_tokens"},
+                "usage": {"input_tokens": 1, "output_tokens": 2},
+            },
+        },
+    ]
+    with caplog.at_level("WARNING", logger="gptme.llm.openai_responses"):
+        text = "".join(_stream_responses_events(events, usage_callback=usage.append))
+    assert text == "truncated"
+    assert usage == [{"input_tokens": 1, "output_tokens": 2}]
+    assert "max_output_tokens" in caplog.text
+
+
+def test_responses_stream_incomplete_signals_before_usage() -> None:
+    """Callers learn the response was incomplete before they record its usage."""
+    order: list[str] = []
+    events = [
+        {
+            "type": event_type,
+            "response": {"usage": {"input_tokens": 1, "output_tokens": 2}},
+        }
+        for event_type in ("response.completed", "response.incomplete")
+    ]
+    for event in events:
+        list(
+            _stream_responses_events(
+                [event],
+                usage_callback=lambda u: order.append("usage"),
+                incomplete_callback=lambda: order.append("incomplete"),
+            )
+        )
+    assert order == ["usage", "incomplete", "usage"]
+
+
+@pytest.mark.parametrize("success", [True, False])
+def test_record_usage_passes_success_to_telemetry(success: bool) -> None:
+    """An incomplete response keeps its usage/cost but is not a success."""
+    with patch.object(llm_openai, "record_llm_request") as record:
+        meta = _record_usage(
+            {"input_tokens": 1, "output_tokens": 2}, "openai/gpt-5", success=success
+        )
+    assert record.call_args.kwargs["success"] is success
+    assert meta is not None and meta.get("usage") is not None
```

---

### Incident Patch 12: `968f8b38` (2026-10-05)
**Commit Message**: fix(server): evict idle client-less sessions unconditionally (#4067)

* fix(server): evict idle client-less sessions unconditionally

SessionManager.clean_inactive_sessions() had a single caller,
_run_health_check(), which only ran in a thread started by
start_acp_health_monitor() — and that was only called on the first
/step with use_acp. A plain webui/server deployment therefore never
evicted sessions: every SSE connect without a session_id created a
session holding up to 10K events for the process lifetime.

- Start the session health monitor at app creation, not on first ACP
  use; rename it from the ACP-specific name it outgrew.
- Never evict a session with connected SSE clients. SSE ping frames
  don't touch last_activity, so an idle-but-connected client would
  otherwise be dropped after the max age.
- Tests: create_app starts the monitor; N SSE connect/disconnect
  sessions are evicted after the sweep; a connected session survives.

Git-Session-Id: 7f33

* fix(server): keep sessions with pending confirmations; attach SSE clients atomically

- clean_inactive_sessions() no longer evicts a session holding a tool that
  awaits confirmation, so a user who disconnects and returns

**File**: `gptme/server/api_v2_sessions.py` (modified, +17/-10)
```diff
@@ -68,9 +68,9 @@ def _safe_session_id_for_log(session_id: str, max_len: int = 80) -> str:
     close_acp_runtime_bg,
     resolve_hook_confirmation,
     resolve_hook_elicitation,
-    start_acp_health_monitor,
+    start_session_health_monitor,
     start_tool_execution,
-    stop_acp_health_monitor,
+    stop_session_health_monitor,
 )
 
 logger = logging.getLogger(__name__)
@@ -156,8 +156,8 @@ def _parse_finite_float_in_range(value: object, lo: float, hi: float) -> float |
     "ConversationSession",
     "SessionManager",
     # Step execution
-    "start_acp_health_monitor",
-    "stop_acp_health_monitor",
+    "start_session_health_monitor",
+    "stop_session_health_monitor",
     "close_acp_runtime_bg",
     "start_tool_execution",
     # Blueprint
@@ -228,7 +228,6 @@ def api_conversation_events(conversation_id: str):
                 conversation_id,
             )
         session = SessionManager.create_session(conversation_id)
-        session_id = session.id
     else:
         if session_obj.conversation_id != conversation_id:
             return flask.jsonify(
@@ -240,16 +239,19 @@ def api_conversation_events(conversation_id: str):
 
     # Generate event stream
     def generate_events() -> Generator[str, None, None]:
+        nonlocal session
         client_id = str(uuid.uuid4())
         sse_connection_open()
         try:
-            # Add this client to the session
-            session.clients.add(client_id)
+            # Add this client to the session atomically with idle eviction. If
+            # the session was evicted since the lookup above, this swaps in a
+            # fresh one, whose ID the `connected` event then announces.
+            session = SessionManager.attach_client(session, client_id)
 
             # Send initial connection event with pending tool state
             connected_event = {
                 "type": "connected",
-                "session_id": session_id,
+                "session_id": session.id,
                 "generating": session.generating,
                 "last_error": session.last_error,
                 "pending_tools": [
@@ -275,6 +277,13 @@ def generate_events() -> Generator[str, None, None]:
             last_event_index = session.events_count
 
             while True:
+                # End the stream if the session was evicted (idle sweep or stuck
+                # generation). Its events no longer arrive, so keeping the
+                # stream open would strand the client on an ID `/step` rejects;
+                # closing lets it reconnect and attach to a fresh session.
+                if SessionManager.get_session(session.id) is not session:
+                    break
+
                 # Check if there are new events
                 # Atomic read: batch and next index come from one lock hold, so a
                 # concurrent trim can't desync them.
@@ -487,8 +496,6 @@ def api_conversation_step(conversation_id: str):
 
             session.use_acp = True
             session.acp_runtime = AcpSessionRuntime(workspace=chat_config.workspace)
-            # Lazy-start the health monitor on first ACP session.
-            start_acp_health_monitor()
         session.generating = True
         session.generating_since = datetime.now(tz=timezone.utc)
         # Claim a new generation epoch before dispatch. If later setup fails,
```

**File**: `gptme/server/app.py` (modified, +9/-0)
```diff
@@ -327,4 +327,13 @@ def handle_http_exception(e: HTTPException) -> flask.Response:
     # Server confirmation hook is now registered via init_hooks(server=True)
     # in server/cli.py
 
+    # Start the session health monitor unconditionally. It evicts idle
+    # client-less sessions and reaps dead ACP subprocesses. Previously it only
+    # started on the first use_acp step, so a plain webui/server deployment
+    # never evicted sessions — each SSE connect without a session_id leaked a
+    # session holding up to 10K events for the process lifetime.
+    from .session_step import start_session_health_monitor  # fmt: skip
+
+    start_session_health_monitor()
+
     return app
```

**File**: `gptme/server/session_models.py` (modified, +49/-5)
```diff
@@ -325,6 +325,32 @@ def create_session(cls, conversation_id: str) -> ConversationSession:
             cls._conversation_sessions[conversation_id].add(session_id)
         return session
 
+    @classmethod
+    def attach_client(
+        cls, session: ConversationSession, client_id: str
+    ) -> ConversationSession:
+        """Register an SSE client on ``session`` atomically with eviction.
+
+        The client is added under ``_lock``, so ``clean_inactive_sessions``
+        cannot evict the session between the events route looking it up and the
+        stream registering its client. If the session was evicted before this
+        call, a fresh session for the same conversation is created and returned
+        instead, so the ``connected`` event never announces an ID the manager no
+        longer holds.
+        """
+        conversation_id = session.conversation_id
+        if conversation_id is None:
+            raise ValueError("Server sessions must have conversation_id")
+        with cls._lock:
+            if cls._sessions.get(session.id) is not session:
+                session = ConversationSession(
+                    id=str(uuid.uuid4()), conversation_id=conversation_id
+                )
+                cls._sessions[session.id] = session
+                cls._conversation_sessions[conversation_id].add(session.id)
+            session.clients.add(client_id)
+        return session
+
     @classmethod
     def get_session(cls, session_id: str) -> ConversationSession | None:
         """Get a session by ID."""
@@ -526,11 +552,21 @@ def retry_deferred_watch_wakes(cls, conversation_id: str) -> None:
 
     @classmethod
     def clean_inactive_sessions(cls, max_age_minutes: int = 60) -> None:
-        """Clean up inactive sessions.
+        """Clean up inactive, client-less sessions.
+
+        A session with connected SSE clients is never evicted, even if its
+        ``last_activity`` is old: the stream keeps the session alive and
+        evicting it would drop a live client. Sessions whose clients have all
+        disconnected (``clients`` empty) are evicted once idle past the cutoff,
+        including any tool still awaiting confirmation: its owned skill
+        invocation is marked abandoned rather than pinning the session forever.
 
         Also detects sessions stuck in generating=True state: if a session has
-        been generating for longer than _STUCK_GENERATING_TIMEOUT_MINUTES, it is
-        force-cleaned to prevent permanent resource leaks.
+        been generating for longer than _STUCK_GENERATING_TIMEOUT_MINUTES, its
+        generating flag is forcibly reset. If no clients are connected, or the
+        session runs on an ACP runtime, the session is also evicted (closing
+        the subprocess); otherwise it is kept so the live stream can observe
+        the cleared state.
 
         Removal is performed atomically under a single lock acquisition to
         prevent a TOCTOU race where a concurrent ``/step`` could start
@@ -550,7 +586,11 @@ def clean_inactive_sessions(cls, max_age_minutes: int = 60) -> None:
         with cls._lock:
             to_remove: list[str] = []
             for session_id, session in list(cls._sessions.items()):
-                if session.last_activity < cutoff and not session.generating:
+                if (
+                    session.last_activity < cutoff
+                    and not session.generating
+                    and not session.clients
+                ):
                     to_remove.append(session_id)
                 elif (
                     session.generating
@@ -565,7 +605,11 @@ def clean_inactive_sessions(cls, max_age_minutes: int = 60) -> None:
                         cls._STUCK_GENERATING_TIMEOUT_MINUTES,
                     )
                     session.generating = False
-                    to_remove.append(session_id)
+                    # An ACP session is always evicted: removal closes the
+                    # (possibly still-running) subprocess, and keeping it would
+                    # let the next /step overlap the stuck prompt.
+                    if not session.clients or session.acp_runtime is not None:
+                        to_remove.append(session_id)
 
             # Remove all identified sessions while still holding the lock.
             for session_id in to_remove:
```

**File**: `gptme/server/session_step.py` (modified, +15/-15)
```diff
@@ -51,7 +51,7 @@
 
 
 # ---------------------------------------------------------------------------
-# ACP Health Monitor
+# Session Health Monitor
 # ---------------------------------------------------------------------------
 
 _health_monitor_thread: threading.Thread | None = None
@@ -65,11 +65,12 @@
 _SESSION_MAX_AGE_MINUTES = 60
 
 
-def start_acp_health_monitor(interval: int = _HEALTH_CHECK_INTERVAL) -> None:
-    """Start a background thread that periodically checks ACP subprocess health.
+def start_session_health_monitor(interval: int = _HEALTH_CHECK_INTERVAL) -> None:
+    """Start a background thread that periodically checks session health.
 
-    The monitor:
-    - Cleans up sessions idle longer than ``_SESSION_MAX_AGE_MINUTES``
+    Started unconditionally at app creation so every server deployment gets
+    session hygiene, not only those that ever used ACP. The monitor:
+    - Cleans up client-less sessions idle longer than ``_SESSION_MAX_AGE_MINUTES``
     - Detects dead ACP subprocesses and removes their sessions
     - Logs subprocess lifecycle events for observability
     """
@@ -80,30 +81,30 @@ def _monitor() -> None:
             try:
                 _run_health_check()
             except Exception:
-                logger.exception("Error in ACP health monitor")
+                logger.exception("Error in session health monitor")
 
     with _health_monitor_lock:
         if _health_monitor_thread is not None:
             logger.debug(
-                "ACP health monitor already running (interval arg %ds ignored)",
+                "Session health monitor already running (interval arg %ds ignored)",
                 interval,
             )
             return  # Already running
 
         _health_monitor_stop.clear()
         _health_monitor_thread = threading.Thread(
-            target=_monitor, daemon=True, name="acp-health-monitor"
+            target=_monitor, daemon=True, name="session-health-monitor"
         )
         _health_monitor_thread.start()
         # Register atexit handler only once — stop/start cycles re-enter this function
         # but must not accumulate duplicate registrations.
         if not _health_monitor_atexit_registered:
-            atexit.register(stop_acp_health_monitor)
+            atexit.register(stop_session_health_monitor)
             _health_monitor_atexit_registered = True
-    logger.info("ACP health monitor started (interval=%ds)", interval)
+    logger.info("Session health monitor started (interval=%ds)", interval)
 
 
-def stop_acp_health_monitor() -> None:
+def stop_session_health_monitor() -> None:
     """Stop the health monitor and clean up all remaining ACP sessions."""
     global _health_monitor_thread
     with _health_monitor_lock:
@@ -123,10 +124,9 @@ def stop_acp_health_monitor() -> None:
 
 def _run_health_check() -> None:
     """Single health check iteration."""
-    # 1. Clean inactive sessions (was never called before this change).
-    # Note: this intentionally applies to all sessions (not just ACP ones) —
-    # the health monitor acts as server-wide session hygiene in ACP deployments.
-    # Non-ACP sessions idle for more than _SESSION_MAX_AGE_MINUTES are also evicted.
+    # 1. Clean inactive, client-less sessions. Applies to all sessions, not just
+    # ACP ones — the monitor is server-wide session hygiene, started for every
+    # deployment at app creation.
     SessionManager.clean_inactive_sessions(max_age_minutes=_SESSION_MAX_AGE_MINUTES)
 
     # 2. Check ACP subprocess health
```

**File**: `tests/conftest.py` (modified, +15/-10)
```diff
@@ -506,20 +506,25 @@ def reset_allow_hosts_after():
 
 
 @pytest.fixture(autouse=True)
-def cleanup_acp_health_monitor():
-    """Stop the ACP health monitor and clear SessionManager state after each test.
-
-    The health monitor is a module-level singleton thread. Without this fixture
-    the first test that starts it leaks the thread for the rest of the xdist
-    worker's life, racing with any test that writes to SessionManager._sessions
-    directly and causing RuntimeError: dictionary changed size during iteration.
+def cleanup_session_health_monitor(detect_leaked_threads):
+    """Stop the session health monitor and clear SessionManager state after each test.
+
+    The health monitor is a module-level singleton thread, started by every
+    ``create_app()``. Without this fixture the thread leaks for the rest of the
+    xdist worker's life, racing with any test that writes to
+    ``SessionManager._sessions`` directly and causing
+    ``RuntimeError: dictionary changed size during iteration``.
+
+    Depends on ``detect_leaked_threads`` so this teardown is guaranteed to run
+    *before* the leak check, regardless of autouse fixture instantiation order:
+    a stopped thread must not be reported as a leak.
     """
     yield
     try:
         try:
-            from gptme.server.session_step import stop_acp_health_monitor
+            from gptme.server.session_step import stop_session_health_monitor
 
-            stop_acp_health_monitor()
+            stop_session_health_monitor()
         except ImportError:
             pass
         try:
@@ -532,7 +537,7 @@ def cleanup_acp_health_monitor():
         except ImportError:
             pass
     except Exception as e:
-        logger.warning(f"Error during ACP health monitor cleanup: {e}")
+        logger.warning(f"Error during session health monitor cleanup: {e}")
 
 
 @pytest.fixture(autouse=True)
```

**File**: `tests/test_acp_session_runtime.py` (modified, +6/-6)
```diff
@@ -1044,17 +1044,17 @@ def test_health_check_skips_generating_sessions(monkeypatch, tmp_path):
 
 
 def test_health_monitor_start_stop():
-    """start/stop_acp_health_monitor should be safe to call."""
+    """start/stop_session_health_monitor should be safe to call."""
     from gptme.server.api_v2_sessions import (
-        start_acp_health_monitor,
-        stop_acp_health_monitor,
+        start_session_health_monitor,
+        stop_session_health_monitor,
     )
 
     # Start with short interval for testing
-    start_acp_health_monitor(interval=1)
+    start_session_health_monitor(interval=1)
     try:
         # Starting again should be a no-op
-        start_acp_health_monitor(interval=1)
+        start_session_health_monitor(interval=1)
     finally:
         # Stop should clean up; always run so the thread never leaks on failure
-        stop_acp_health_monitor()
+        stop_session_health_monitor()
```

**File**: `tests/test_server_session_models.py` (modified, +114/-0)
```diff
@@ -602,6 +602,64 @@ def test_does_not_remove_generating_sessions(self):
         # Still present because generating=True
         assert SessionManager.get_session(session.id) is not None
 
+    def test_does_not_remove_sessions_with_connected_clients(self):
+        """A session with an open SSE client is not evicted even when idle.
+
+        SSE ping frames do not update ``last_activity``, so a client that keeps
+        the stream open without sending events would otherwise be evicted after
+        the max age — dropping a live client.
+        """
+        from datetime import datetime, timedelta, timezone
+
+        session = SessionManager.create_session("conv-clients")
+        session.last_activity = datetime.now(tz=timezone.utc) - timedelta(minutes=120)
+        session.clients.add("client-1")
+
+        SessionManager.clean_inactive_sessions(max_age_minutes=60)
+
+        assert SessionManager.get_session(session.id) is not None
+
+    def test_removes_session_after_last_client_disconnects(self):
+        """Once the last client disconnects, an idle session becomes evictable."""
+        from datetime import datetime, timedelta, timezone
+
+        session = SessionManager.create_session("conv-clients")
+        session.last_activity = datetime.now(tz=timezone.utc) - timedelta(minutes=120)
+        session.clients.add("client-1")
+
+        # Connected during the first sweep: the client set alone keeps it.
+        SessionManager.clean_inactive_sessions(max_age_minutes=60)
+        assert SessionManager.get_session(session.id) is session
+
+        session.clients.discard("client-1")
+        SessionManager.clean_inactive_sessions(max_age_minutes=60)
+        assert SessionManager.get_session(session.id) is None
+
+    def test_attach_client_registers_on_live_session(self):
+        session = SessionManager.create_session("conv-attach")
+
+        attached = SessionManager.attach_client(session, "client-1")
+
+        assert attached is session
+        assert session.clients == {"client-1"}
+
+    def test_attach_client_replaces_evicted_session(self):
+        """Attaching to a session evicted after lookup yields a fresh, live one."""
+        from datetime import datetime, timedelta, timezone
+
+        session = SessionManager.create_session("conv-attach")
+        session.last_activity = datetime.now(tz=timezone.utc) - timedelta(minutes=120)
+        SessionManager.clean_inactive_sessions(max_age_minutes=60)
+        assert SessionManager.get_session(session.id) is None
+
+        attached = SessionManager.attach_client(session, "client-1")
+
+        assert attached is not session
+        assert attached.conversation_id == "conv-attach"
+        assert attached.clients == {"client-1"}
+        assert SessionManager.get_session(attached.id) is attached
+        assert attached.id in SessionManager._conversation_sessions["conv-attach"]
+
     def test_selective_cleanup(self):
         """Only old, non-generating sessions are removed; recent ones survive."""
         from datetime import datetime, timedelta, timezone
@@ -677,6 +735,43 @@ def test_stuck_session_generating_flag_reset(self):
         # generating flag is reset to False before removal (the key invariant this test verifies)
         assert session.generating is False
 
+    def test_stuck_session_with_clients_resets_but_not_evicted(self):
+        """Stuck-generating sessions with connected clients have generating reset but stay alive."""
+        from datetime import datetime, timedelta, timezone
+
+        session = SessionManager.create_session("conv-stuck-with-client")
+        session.generating = True
+        session.generating_since = datetime.now(tz=timezone.utc) - timedelta(minutes=15)
+        session.last_activity = datetime.now(tz=timezone.utc)
+        session.clients.add("client-1")
+
+        SessionManager.clean_inactive_sessions(max_age_minutes=60)
+        # Session is NOT removed — a live SSE client is connected
+        assert SessionManager.get_session(session.id) is not None
+        # generating is reset so the session is no longer considered stuck
+        assert session.generating is False
+
+    def test_stuck_acp_session_with_clients_is_evicted_and_runtime_closed(self):
+        """A stuck ACP session is evicted even with clients, so the next /step
+        cannot overlap the still-running prompt on the old runtime."""
+        from datetime import datetime, timedelta, timezone
+        from unittest.mock import MagicMock, patch
+
+        session = SessionManager.create_session("conv-stuck-acp-client")
+        runtime = MagicMock()
+        session.acp_runtime = runtime
+        session.use_acp = True
+        session.generating = True
+        session.generating_since = datetime.now(tz=timezone.utc) - timedelta(minutes=15)
+        session.last_activity = datetime.now(tz=timezone.utc)
+        session.clients.add("client-1")
+
+        with patch("gptme.server.session_step.close_acp_runtime_bg") as 
```

**File**: `tests/test_server_v2_sessions.py` (modified, +82/-0)
```diff
@@ -2600,3 +2600,85 @@ def test_keeps_valid_uuid_untouched(self):
 
         sid = str(uuid.uuid4())
         assert _safe_session_id_for_log(sid) == sid
+
+
+class TestSessionEviction:
+    """SSE connects without a session_id must not leak sessions forever."""
+
+    @staticmethod
+    def _connect(client: FlaskClient, conversation_id: str):
+        """Open an SSE stream and consume the connected event."""
+        response = client.get(
+            f"/api/v2/conversations/{conversation_id}/events", buffered=False
+        )
+        assert response.status_code == 200
+        first = next(iter(response.response))
+        assert b'"type": "connected"' in first
+        return response
+
+    def test_connect_disconnect_sessions_are_evicted(self, client: FlaskClient):
+        """N SSE connects without session_id clean up after the clients leave."""
+        from datetime import datetime, timedelta, timezone
+
+        conv = create_conversation(client)["conversation_id"]
+
+        streams = [self._connect(client, conv) for _ in range(3)]
+        sessions = SessionManager.get_sessions_for_conversation(conv)
+        # The conversation's own session plus one per SSE connect.
+        assert len(sessions) == 4
+        # Each open stream holds exactly one client on its session.
+        assert sum(len(s.clients) for s in sessions) == 3
+
+        # Close the streams: each client is discarded from its session.
+        for stream in streams:
+            stream.close()
+        sessions = SessionManager.get_sessions_for_conversation(conv)
+        assert all(not s.clients for s in sessions)
+
+        # Age every session and sweep: all client-less sessions must go.
+        old = datetime.now(tz=timezone.utc) - timedelta(minutes=120)
+        for session in sessions:
+            session.last_activity = old
+        SessionManager.clean_inactive_sessions(max_age_minutes=60)
+
+        assert SessionManager.get_sessions_for_conversation(conv) == []
+
+    def test_connected_session_is_not_evicted(self, client: FlaskClient):
+        """A session with an open SSE client survives an otherwise-stale sweep."""
+        from datetime import datetime, timedelta, timezone
+
+        conv = create_conversation(client)["conversation_id"]
+        stream = self._connect(client, conv)
+        try:
+            sessions = SessionManager.get_sessions_for_conversation(conv)
+            connected = [s for s in sessions if s.clients]
+            assert len(connected) == 1
+            session = connected[0]
+
+            old = datetime.now(tz=timezone.utc) - timedelta(minutes=120)
+            session.last_activity = old
+            SessionManager.clean_inactive_sessions(max_age_minutes=60)
+
+            assert SessionManager.get_session(session.id) is not None
+        finally:
+            stream.close()
+
+    def test_stream_ends_when_its_session_is_evicted(self, client: FlaskClient):
+        """An evicted session must not leave its stream open on a dead ID."""
+        conv = create_conversation(client)["conversation_id"]
+        stream = self._connect(client, conv)
+        try:
+            session = next(
+                s
+                for s in SessionManager.get_sessions_for_conversation(conv)
+                if s.clients
+            )
+            SessionManager.remove_session(session.id)
+            session.event_flag.set()  # wake the generator instead of waiting 15s
+
+            # The stream drains its pings and then terminates, so the client
+            # reconnects and attaches to a fresh session.
+            remaining = list(stream.response)  # would block forever if it stayed open
+            assert all(b'"type": "ping"' in chunk for chunk in remaining)
+        finally:
+            stream.close()
```

---

### Incident Patch 13: `b7eb9f51` (2026-10-05)
**Commit Message**: fix(models): concise provider errors and parallel fetch in models list (#4062)

* fix(models): concise provider errors and parallel fetch in models list

`gptme-util models list` printed raw urllib3 NewConnectionError text for
unreachable custom providers, a multi-line auth hint for the gptme
provider, and fetched every provider serially (7s with two dead hosts).

- Summarize request errors as '<provider> provider: unavailable (<reason>)'
- Use a 3s connect timeout for OpenAI-compatible /models probes
- Fetch providers concurrently (order preserved)
- One-line 'not logged in' notice for the gptme provider

Git-Session-Id: 7044

* fix(models): propagate config context to fetch workers, parallelize detailed list, keep SSL reasons

- Run each provider fetch in a copy of the caller's context so the
  ContextVar-backed project/chat config (custom providers, credentials)
  is visible in worker threads.
- The default detailed 'models list' output now uses the same parallel
  fetch instead of fetching providers one at a time.
- SSL certificate failures keep their reason instead of collapsing to
  'connection failed'; errno reasons stop at an opening paren.

Git-Session-Id: f1a950bc-85fe-5d

**File**: `gptme/llm/llm_openai.py` (modified, +21/-2)
```diff
@@ -2702,6 +2702,24 @@ def get_available_models(provider: Provider) -> list[ModelMeta]:
         raise
 
 
+def _short_request_error(e: requests.RequestException) -> str:
+    """Summarize a requests error in a few words instead of urllib3's repr."""
+    if isinstance(e, requests.HTTPError) and e.response is not None:
+        return f"HTTP {e.response.status_code}"
+    if isinstance(e, requests.Timeout):
+        return "timed out"
+    if isinstance(e, requests.exceptions.SSLError):
+        # Keep the certificate reason; it is what the user needs to fix it.
+        m = re.search(r"certificate verify failed: ([^('\")]+)", str(e))
+        if m:
+            return f"SSL certificate verify failed: {m.group(1).strip()}"
+        return "SSL error"
+    if isinstance(e, requests.ConnectionError):
+        m = re.search(r"\[Errno -?\d+\] ([^('\")]+)", str(e))
+        return m.group(1).strip() if m else "connection failed"
+    return type(e).__name__
+
+
 def _get_openai_compatible_models(
     config,
     provider_name: str = "local",
@@ -2724,7 +2742,8 @@ def _get_openai_compatible_models(
 
     try:
         headers = {"Authorization": f"Bearer {api_key}"} if api_key else None
-        response = requests.get(models_url, headers=headers, timeout=10)
+        # Short connect timeout: an unreachable host should not stall listing.
+        response = requests.get(models_url, headers=headers, timeout=(3, 10))
         response.raise_for_status()
         data = response.json()
 
@@ -2736,7 +2755,7 @@ def _get_openai_compatible_models(
         ]
     except requests.RequestException as e:
         log_fn = logger.debug if provider_name == "local" else logger.warning
-        log_fn(f"Failed to retrieve models from {provider_name} provider: {e}")
+        log_fn(f"{provider_name} provider: unavailable ({_short_request_error(e)})")
         # Return empty list instead of raising - local server might not be running
         return []
     except Exception as e:
```

**File**: `gptme/llm/models/listing.py` (modified, +42/-16)
```diff
@@ -1,6 +1,8 @@
 import json
 import logging
 import time
+from concurrent.futures import ThreadPoolExecutor
+from contextvars import copy_context
 from typing import Any, cast
 
 from ..provider_plugins import discover_provider_plugins, get_provider_plugin
@@ -81,8 +83,11 @@ def _get_models_for_provider(
             from ..llm_gptme import GptmeAuthError  # fmt: skip
 
             if isinstance(e, GptmeAuthError):
-                # Auth error: surface the actionable hint to the user
-                logger.warning("gptme provider: %s", e)
+                # Auth error: one actionable line, not the full multi-line hint
+                logger.warning(
+                    "gptme provider: not logged in "
+                    "(run `gptme-auth login` or set GPTME_CLOUD_API_KEY)"
+                )
             else:
                 # Fall back to static models (only for built-in providers)
                 logger.debug(
@@ -132,6 +137,28 @@ def _apply_model_filters(
 _MODEL_LIST_CACHE_TTL = 300  # 5 minutes
 
 
+def _fetch_models_parallel(
+    providers: list[Provider], dynamic_fetch: bool
+) -> list[list[ModelMeta]]:
+    """Fetch each provider's models concurrently, preserving provider order.
+
+    One slow or unreachable endpoint then does not serialize the whole listing.
+    Each worker runs in a copy of the caller's context so ContextVar-backed
+    state (notably the project/chat config from ``get_config()``) is visible
+    there; otherwise custom providers would be unknown in the worker.
+    """
+    if not providers:
+        return []
+    tasks = [(copy_context(), p) for p in providers]
+    with ThreadPoolExecutor(max_workers=min(8, len(providers))) as pool:
+        return list(
+            pool.map(
+                lambda t: t[0].run(_get_models_for_provider, t[1], dynamic_fetch),
+                tasks,
+            )
+        )
+
+
 def get_model_list(
     provider_filter: str | None = None,
     vision_only: bool = False,
@@ -195,13 +222,10 @@ def get_model_list(
         + plugin_providers
     )
 
-    for provider in all_providers:
-        if provider_filter and provider != provider_filter:
-            continue
-
-        # Get models for this provider
-        models = _get_models_for_provider(provider, dynamic_fetch)
-
+    providers = [
+        p for p in all_providers if not provider_filter or p == provider_filter
+    ]
+    for models in _fetch_models_parallel(providers, dynamic_fetch):
         # Apply filters
         filtered_models = _apply_model_filters(
             models, vision_only, reasoning_only, include_deprecated
@@ -368,14 +392,16 @@ def list_models(
             + plugin_providers_detail
         )
 
-        for provider in all_providers:
-            if provider_filter and provider != provider_filter:
-                continue
-
-            if available_only and provider not in configured_set:
-                continue
+        selected = [
+            provider
+            for provider in all_providers
+            if (not provider_filter or provider == provider_filter)
+            and (not available_only or provider in configured_set)
+        ]
 
-            models = _get_models_for_provider(provider, dynamic_fetch)
+        for provider, models in zip(
+            selected, _fetch_models_parallel(selected, dynamic_fetch), strict=True
+        ):
             filtered_models = _apply_model_filters(
                 models, vision_only, reasoning_only, include_deprecated
             )
```

**File**: `tests/test_llm_models.py` (modified, +52/-0)
```diff
@@ -737,3 +737,55 @@ def test_model_to_dict_serializes_default_tool_format():
 
     unstamped = ModelMeta(provider=CustomProvider("test"), model="m2", context=8192)
     assert "default_tool_format" not in model_to_dict(unstamped)
+
+
+def test_fetch_models_parallel_propagates_config_context():
+    """Workers see the caller's ContextVar config (e.g. custom providers)."""
+    import contextvars
+
+    from gptme.config import get_config
+    from gptme.config.core import _config_var
+    from gptme.llm.models.listing import _fetch_models_parallel
+
+    sentinel = object()
+    seen: list = []
+
+    def fake_fetch(provider, dynamic_fetch):
+        seen.append(get_config())
+        return [provider]
+
+    def run():
+        _config_var.set(sentinel)  # type: ignore[arg-type]
+        with patch(
+            "gptme.llm.models.listing._get_models_for_provider", side_effect=fake_fetch
+        ):
+            return _fetch_models_parallel(["openai", "anthropic", "local"], False)
+
+    result = contextvars.copy_context().run(run)
+    assert result == [["openai"], ["anthropic"], ["local"]]
+    assert seen == [sentinel] * 3
+
+
+@patch("gptme.llm.models.listing._fetch_models_parallel")
+def test_list_models_detailed_uses_parallel_fetch(mock_fetch, capsys):
+    """The default detailed output renders models returned by the parallel fetch.
+
+    Pins behavior, not just the call: a sentinel model returned for one provider
+    must appear in the printed output, so removing the detailed path (or wiring
+    it to a different fetch) fails the test.
+    """
+    from gptme.llm.models import list_models
+
+    sentinel = ModelMeta(provider="openai", model="parallel-sentinel", context=8192)
+
+    def fake_fetch(providers, dynamic_fetch):
+        return [[sentinel] if str(p) == "openai" else [] for p in providers]
+
+    mock_fetch.side_effect = fake_fetch
+    list_models(dynamic_fetch=False)
+    assert mock_fetch.call_count == 1
+    providers_arg, dynamic_arg = mock_fetch.call_args.args
+    assert "openai" in providers_arg
+    assert dynamic_arg is False
+    out = capsys.readouterr().out
+    assert "parallel-sentinel" in out
```

**File**: `tests/test_llm_openai.py` (modified, +57/-1)
```diff
@@ -3815,7 +3815,7 @@ def test_gptme_provider_uses_authenticated_models_endpoint(
         mock_requests_get.assert_called_once_with(
             "https://auth.gptme.ai/functions/v1/models",
             headers={"Authorization": "Bearer gptme-token"},
-            timeout=10,
+            timeout=(3, 10),
         )
         assert len(models) == 1
         assert models[0].provider == "gptme"
@@ -4993,3 +4993,59 @@ def test_openai_retries_408_409(status):
     with patch("gptme.llm.llm_openai.backoff_wait", return_value=False) as w:
         _handle_openai_transient_error(error, attempt=0, max_retries=3, base_delay=0)
     w.assert_called_once()
+
+
+def test_short_request_error_summaries():
+    import requests
+
+    from gptme.llm.llm_openai import _short_request_error
+
+    conn = requests.ConnectionError(
+        "HTTPConnectionPool(host='192.0.2.1', port=8000): Max retries exceeded "
+        'with url: /v1/models (Caused by NewConnectionError("HTTPConnection('
+        "host='192.0.2.1', port=8000): Failed to establish a new connection: "
+        '[Errno 113] No route to host"))'
+    )
+    assert _short_request_error(conn) == "No route to host"
+    assert _short_request_error(requests.ConnectionError("boom")) == (
+        "connection failed"
+    )
+    assert _short_request_error(requests.Timeout("slow")) == "timed out"
+    # stray parens after the errno reason do not leak into the summary
+    assert (
+        _short_request_error(
+            requests.ConnectionError("[Errno 113] No route to host (eth0)')")
+        )
+        == "No route to host"
+    )
+    # certificate failures keep their reason instead of "connection failed"
+    ssl = requests.exceptions.SSLError(
+        "HTTPSConnectionPool(host='llm.local', port=443): Max retries exceeded "
+        "with url: /v1/models (Caused by SSLError(SSLCertVerificationError(1, "
+        "'[SSL: CERTIFICATE_VERIFY_FAILED] certificate verify failed: "
+        "self-signed certificate in certificate chain (_ssl.c:1006)')))"
+    )
+    assert _short_request_error(ssl) == (
+        "SSL certificate verify failed: self-signed certificate in certificate chain"
+    )
+    assert _short_request_error(requests.exceptions.SSLError("x")) == "SSL error"
+
+    resp = requests.Response()
+    resp.status_code = 401
+    assert _short_request_error(requests.HTTPError(response=resp)) == "HTTP 401"
+
+
+def test_openai_compatible_models_unreachable_logs_one_line(caplog):
+    import requests
+
+    from gptme.llm.llm_openai import _get_openai_compatible_models
+
+    err = requests.ConnectionError("... [Errno 111] Connection refused'))")
+    with patch("gptme.llm.llm_openai.requests.get", side_effect=err) as get:
+        models = _get_openai_compatible_models(
+            None, "myserver", "http://192.0.2.1:8000/v1"
+        )
+    assert models == []
+    assert get.call_args.kwargs["timeout"] == (3, 10)
+    assert "myserver provider: unavailable (Connection refused)" in caplog.text
+    assert "HTTPConnectionPool" not in caplog.text
```

**File**: `tests/test_setup_completions.py` (modified, +1/-1)
```diff
@@ -35,7 +35,7 @@ def test_generate_zsh_completion():
 
 def test_generate_unsupported_shell():
     """Test that unsupported shells return None."""
-    result = _generate_click_completion("powershell")
+    result = _generate_click_completion("tcsh")
     assert result is None
 
 
```

---

### Incident Patch 14: `546e88ab` (2026-10-05)
**Commit Message**: fix(browser): configure executable independently of engine (#4168)

* fix(browser): configure executable independently of engine

Git-Session-Id: 0a3b

* test(browser): clear unprefixed env vars in isolation fixture

get_env() reads both the GPTME_-prefixed and unprefixed forms, so
clearing only GPTME_BROWSER_EXECUTABLE_PATH (and friends) left a runner
value that leaked into the precedence tests. Clear both forms so the
tests are independent of the runner environment.

Addresses Greptile P2 on #4168.

Git-Session-Id: 27c20251-8ace-557a-95d2-41c5c0d43988

**File**: `docs/tools/browser.rst` (modified, +33/-0)
```diff
@@ -113,6 +113,36 @@ launching Firefox.
     export GPTME_BROWSER_ENGINE=$(python -m camoufox path)
     gptme "read https://example.com"
 
+Use a custom executable path (``GPTME_BROWSER_EXECUTABLE_PATH``)
+~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
+
+Use ``GPTME_BROWSER_EXECUTABLE_PATH`` to specify a custom browser executable
+independently of engine selection. This is useful when you have a cached or
+pre-built browser binary that you want to use with a specific engine.
+
+.. code-block:: bash
+
+    # Use a custom Chromium binary with the default engine
+    export GPTME_BROWSER_EXECUTABLE_PATH=/path/to/chromium
+    gptme "read https://example.com"
+
+    # Use a custom Firefox binary
+    export GPTME_BROWSER_ENGINE=firefox
+    export GPTME_BROWSER_EXECUTABLE_PATH=/path/to/firefox
+    gptme "screenshot https://example.com"
+
+**Precedence:** Explicit constructor arguments take priority over environment
+variables. ``GPTME_BROWSER_EXECUTABLE_PATH`` takes priority over the legacy
+``GPTME_BROWSER_ENGINE`` path parsing.
+
+**Notes:**
+
+- The executable path applies to the selected engine (Chromium or Firefox).
+- This setting is ignored when using CDP mode (``GPTME_BROWSER_CDP_URL``).
+- No browser version compatibility is guaranteed; ensure your custom executable
+  is compatible with the Playwright version in use.
+- No automatic downloads or fallbacks occur if the path is missing or invalid.
+
 CDP mode (``GPTME_BROWSER_CDP_URL``)
 ------------------------------------
 
@@ -161,6 +191,9 @@ Environment variables
    * - ``GPTME_BROWSER_ENGINE``
      - ``chromium``
      - Engine or executable: ``chromium``, ``firefox``, a path, or a name on ``$PATH``
+   * - ``GPTME_BROWSER_EXECUTABLE_PATH``
+     - *(unset)*
+     - Custom executable path for the selected engine (independent of ``GPTME_BROWSER_ENGINE``)
    * - ``GPTME_BROWSER_CDP_URL``
      - *(unset)*
      - WebSocket URL of an existing Chrome DevTools Protocol server
```

**File**: `gptme/tools/_browser_thread.py` (modified, +15/-6)
```diff
@@ -24,6 +24,9 @@
 # Set GPTME_BROWSER_ENGINE=firefox to use Firefox instead of Chromium.
 # Set GPTME_BROWSER_ENGINE to a filesystem path or executable name to use a
 # custom browser binary (e.g. a fingerprint-patched Firefox build).
+# Set GPTME_BROWSER_EXECUTABLE_PATH to specify a custom executable path
+# independently of engine selection (e.g. for Chromium with a custom binary).
+# Explicit constructor paths override this setting and legacy engine paths.
 BrowserEngine = Literal["chromium", "firefox"]
 _VALID_ENGINES: tuple[BrowserEngine, ...] = ("chromium", "firefox")
 
@@ -219,16 +222,22 @@ def __init__(
     ) -> None:
         self.cdp_url = cdp_url or get_config().get_env("BROWSER_CDP_URL")
 
-        # Resolve engine and executable_path: explicit args > env var > default "chromium"
+        # Resolve engine: explicit arg > env var > default "chromium".
+        legacy_executable = None
         if engine is None:
             raw = (get_config().get_env("BROWSER_ENGINE") or "").strip()
             if raw:
-                parsed_engine, parsed_executable = _parse_engine_env(raw)
-                engine = parsed_engine
-                if executable_path is None:
-                    executable_path = parsed_executable
+                engine, legacy_executable = _parse_engine_env(raw)
             else:
                 engine = "chromium"
+
+        # Explicit path > independent setting > legacy engine-path setting.
+        # An explicit engine does not inherit a legacy engine-path choice.
+        if executable_path is None:
+            executable_path = (
+                get_config().get_env("BROWSER_EXECUTABLE_PATH") or ""
+            ).strip() or legacy_executable
+
         self.engine: BrowserEngine = engine
         self.executable_path: str | None = executable_path
         self.queue: Queue[tuple[Command | Action, object]] = Queue()
@@ -286,7 +295,7 @@ def launch_browser() -> Exception | None:
                 browser = None  # Ensure browser is None after failed launch
                 error: Exception
 
-                if "Executable doesn't exist" in str(e):
+                if "executable doesn't exist" in str(e).lower():
                     if self.executable_path:
                         error = RuntimeError(
                             f"Custom browser executable not found: {self.executable_path}. "
```

**File**: `tests/test_browser_executable_path_env.py` (added, +195/-0)
```diff
@@ -0,0 +1,195 @@
+"""Tests for independent GPTME_BROWSER_EXECUTABLE_PATH environment setting.
+
+Regression tests for gptme/gptme#4167: independent executable path setting
+with correct precedence (explicit constructor > env var > legacy engine path).
+"""
+
+from unittest.mock import MagicMock, patch
+
+import pytest
+
+pytest.importorskip("playwright")
+
+from gptme.tools._browser_thread import BrowserThread
+
+
+@pytest.fixture
+def mock_playwright(monkeypatch):
+    """Mock Playwright with clean environment."""
+    # Isolate from developer environment. get_env() reads both the prefixed
+    # (GPTME_) and unprefixed forms, so clear both for each variable.
+    monkeypatch.delenv("GPTME_BROWSER_ENGINE", raising=False)
+    monkeypatch.delenv("BROWSER_ENGINE", raising=False)
+    monkeypatch.delenv("GPTME_BROWSER_EXECUTABLE_PATH", raising=False)
+    monkeypatch.delenv("BROWSER_EXECUTABLE_PATH", raising=False)
+    monkeypatch.delenv("GPTME_BROWSER_CDP_URL", raising=False)
+    monkeypatch.delenv("BROWSER_CDP_URL", raising=False)
+
+    with patch("gptme.tools._browser_thread.sync_playwright") as mock_sync_pw:
+        mock_pw = MagicMock()
+        mock_sync_pw.return_value.start.return_value = mock_pw
+        mock_browser = MagicMock()
+        mock_pw.chromium.launch.return_value = mock_browser
+        mock_pw.firefox.launch.return_value = mock_browser
+        yield mock_pw, mock_browser
+
+
+class TestBrowserExecutablePathPrecedence:
+    """Test GPTME_BROWSER_EXECUTABLE_PATH precedence and behavior."""
+
+    @pytest.mark.parametrize(
+        ("engine_env", "exec_env", "explicit_exec", "expected_engine", "expected_exec"),
+        [
+            # (GPTME_BROWSER_ENGINE, GPTME_BROWSER_EXECUTABLE_PATH, constructor arg, expected engine, expected executable)
+            # Default: no env vars
+            (None, None, None, "chromium", None),
+            # Independent env only
+            (None, "/custom/chromium", None, "chromium", "/custom/chromium"),
+            # Named engine + independent env
+            ("firefox", "/custom/firefox", None, "firefox", "/custom/firefox"),
+            # Legacy path (Firefox default)
+            ("/legacy/firefox", None, None, "firefox", "/legacy/firefox"),
+            # Independent env wins over legacy path
+            ("/legacy/firefox", "/new/firefox", None, "firefox", "/new/firefox"),
+            # Explicit constructor wins over env
+            (
+                None,
+                "/env/chromium",
+                "/explicit/chromium",
+                "chromium",
+                "/explicit/chromium",
+            ),
+            # Explicit constructor wins over both
+            (
+                "/legacy/firefox",
+                "/env/firefox",
+                "/explicit/firefox",
+                "firefox",
+                "/explicit/firefox",
+            ),
+            # Empty independent env behaves as absent
+            (None, "", None, "chromium", None),
+            # Whitespace independent env behaves as absent
+            (None, "   ", None, "chromium", None),
+        ],
+    )
+    def test_executable_path_precedence(
+        self,
+        mock_playwright,
+        monkeypatch,
+        engine_env,
+        exec_env,
+        explicit_exec,
+        expected_engine,
+        expected_exec,
+    ):
+        """Test precedence: explicit constructor > independent env > legacy engine path."""
+        mock_pw, mock_browser = mock_playwright
+
+        # Set environment
+        if engine_env is not None:
+            monkeypatch.setenv("GPTME_BROWSER_ENGINE", engine_env)
+        if exec_env is not None:
+            monkeypatch.setenv("GPTME_BROWSER_EXECUTABLE_PATH", exec_env)
+
+        # Create browser thread
+        if explicit_exec is not None:
+            bt = BrowserThread(executable_path=explicit_exec)
+        else:
+            bt = BrowserThread()
+
+        try:
+            # Verify engine and executable_path
+            assert bt.engine == expected_engine
+            assert bt.executable_path == expected_exec
+
+            # Verify launcher was called with correct kwargs
+            launcher = (
+                mock_pw.chromium.launch
+                if expected_engine == "chromium"
+                else mock_pw.firefox.launch
+            )
+            launcher.assert_called_once()
+            call_kwargs = launcher.call_args[1]
+
+            if expected_exec:
+                assert call_kwargs.get("executable_path") == expected_exec
+            else:
+                assert "executable_path" not in call_kwargs
+        finally:
+            bt.stop()
+
+    @pytest.mark.parametrize(
+        "message",
+        [
+            "Executable doesn't exist at /missing/chromium",
+            "Failed to launch chromium because executable doesn't exist at /missing/chromium",
+        ],
+    )
+    def test_missing_custom_executable_fails_closed(
+        self, mock_playwright, monkeypatch, message
+  
```

---

### Incident Patch 15: `801f2006` (2026-10-05)
**Commit Message**: fix(subagent): kill the child's persistent shells when escalating to SIGKILL (#4097)

* fix(subagent): kill the child's persistent shells when escalating to SIGKILL

A subprocess subagent's persistent shells run in their own session
(start_new_session), so SIGKILLing a CLI that ignored SIGTERM left them, and
anything they detached, running. The parent now passes
GPTME_SHELL_PGID_FILE to the child; each persistent shell appends its pgid,
and the SIGKILL branch of _terminate_subprocess killpg's every recorded
group that is still its own session leader (guards against pid reuse).

Fixes #4089

Git-Session-Id: 46db

* fix(subagent): cover cancel and background jobs in SIGKILL escalation

Addresses review findings on #4097:

- Pass the shell-pgid file from the max_time watchdog and subagent_cancel
  paths in api.py, not just the monitor's own timeout branch.
- Also record background-job process groups (_record_shell_pgid in
  start_background_job); jobs run with start_new_session and otherwise
  outlive a SIGKILLed CLI.
- Reach groups whose session leader already exited: fall back to probing the
  group itself, while still skipping a reused pid whose session no longer
  matches. Never s

**File**: `gptme/tools/shell.py` (modified, +60/-0)
```diff
@@ -561,6 +561,65 @@ def finish(self, returncode: int) -> None:
             self._done.set()
 
 
+def _proc_start_ticks(pid: int) -> int | None:
+    """Field 22 of ``/proc/<pid>/stat``, or None without procfs."""
+    try:
+        stat = Path(f"/proc/{pid}/stat").read_text()
+        return int(stat.rsplit(")", 1)[1].split()[19])
+    except (OSError, IndexError, ValueError):
+        return None
+
+
+def _process_start_marker(pid: int) -> str | None:
+    """A stable identity string for this live shell, or None.
+
+    Prefers the procfs start time; falls back to ``ps`` so the parent can
+    still verify the shell on platforms without procfs (macOS). Two reads of
+    the same live process compare equal, while a recycled pid does not.
+    """
+    ticks = _proc_start_ticks(pid)
+    if ticks is not None:
+        return str(ticks)
+    try:
+        result = subprocess.run(
+            ["ps", "-o", "lstart=", "-p", str(pid)],
+            capture_output=True,
+            text=True,
+            timeout=5,
+            check=False,
+        )
+    except (OSError, subprocess.SubprocessError):
+        return None
+    if result.returncode != 0:
+        return None
+    marker = result.stdout.strip()
+    return marker or None
+
+
+def _record_shell_pgid(pid: int) -> None:
+    """Append this shell's process group to ``$GPTME_SHELL_PGID_FILE``.
+
+    A subprocess subagent's parent sets the variable so that, when it has to
+    SIGKILL a CLI that ignored SIGTERM, it can also kill the persistent shells
+    and whatever they detached. Each shell runs in its own session
+    (``start_new_session``), so its pid is its pgid, and killing the CLI's own
+    group would miss it. A start marker is recorded alongside so the parent
+    can tell the shell apart from an unrelated process that later reused its
+    pid — via procfs on Linux, or ``ps`` start time without procfs (macOS).
+    The bare pid is written only if no marker can be obtained.
+    """
+    path = os.environ.get("GPTME_SHELL_PGID_FILE")
+    if not path or _is_windows:
+        return
+    start = _process_start_marker(pid)
+    entry = f"{pid} {start}\n" if start is not None else f"{pid}\n"
+    try:
+        with open(path, "a") as f:
+            f.write(entry)
+    except OSError:
+        logger.debug("could not record shell pgid in %s", path, exc_info=True)
+
+
 class ShellSession:
     process: subprocess.Popen
     stdout_fd: int
@@ -673,6 +732,7 @@ def _init(self):
             env=sandbox_env,  # None → inherit; dict → sanitized env
             **popen_kwargs,
         )
+        _record_shell_pgid(self.process.pid)
         assert self.process.stdout is not None
         assert self.process.stderr is not None
         self.stdout_fd = self.process.stdout.fileno()
```

**File**: `gptme/tools/shell_background.py` (modified, +6/-0)
```diff
@@ -522,6 +522,12 @@ def start_background_job(
         stdin=subprocess.DEVNULL,
         **popen_kwargs,
     )
+    # A subprocess subagent's parent records the group so it can force the
+    # whole job down if the child CLI ignores SIGTERM. Imported lazily to
+    # avoid a circular import (shell imports this module at load time).
+    from .shell import _record_shell_pgid
+
+    _record_shell_pgid(process.pid)
 
     with _job_lock:
         job_id = _get_next_job_id_locked(conversation_id)
```

**File**: `gptme/tools/subagent/api.py` (modified, +2/-2)
```diff
@@ -1179,7 +1179,7 @@ def _timeout_subagent(
         return  # Another result was set concurrently (subagent finished at the same time)
 
     if sa.execution_mode == "subprocess" and sa.process:
-        _exec._terminate_subprocess(sa.process)
+        _exec._terminate_subprocess(sa.process, sa.logdir / _exec._SHELL_PGIDS_FILENAME)
         logger.info(
             f"Subagent '{agent_id}' subprocess killed after {max_time}s (max_time)."
         )
@@ -1240,7 +1240,7 @@ def subagent_cancel(agent_id: str) -> str:
             logger.warning(
                 "Failed to write cancel control op for '%s': %s", agent_id, e
             )
-        _exec._terminate_subprocess(sa.process)
+        _exec._terminate_subprocess(sa.process, sa.logdir / _exec._SHELL_PGIDS_FILENAME)
         logger.info(f"Subagent '{agent_id}' subprocess terminated.")
         return f"Subagent '{agent_id}' cancelled."
     if sa.execution_mode == "thread":
```

**File**: `gptme/tools/subagent/execution.py` (modified, +163/-3)
```diff
@@ -10,6 +10,7 @@
 import logging
 import os
 import random
+import signal
 import string
 import subprocess
 import sys
@@ -87,6 +88,7 @@ def _effective_child_tool_format(model: str | None) -> ToolFormat | None:
 
 
 _SUBAGENT_SIGNAL_TOOLS = ("complete", "clarify", "progress")
+_SHELL_PGIDS_FILENAME = "shell-pgids"
 _SUBPROCESS_STDERR_FILENAME = "stderr.log"
 _SUBPROCESS_STDERR_TAIL_BYTES = 16 * 1024
 _SUBPROCESS_STDERR_TAIL_LINES = 20
@@ -814,6 +816,7 @@ def _run_subagent_subprocess(
     env = os.environ.copy()
     env["GPTME_SUBAGENT_AGENT_ID"] = logdir.name.removeprefix("subagent-")
     env["GPTME_PROGRESS_FILE"] = str(progress_file)
+    env["GPTME_SHELL_PGID_FILE"] = str(logdir / _SHELL_PGIDS_FILENAME)
     stderr_path = logdir / _SUBPROCESS_STDERR_FILENAME
 
     try:
@@ -1010,14 +1013,171 @@ def _stderr_failure_tail(stderr_path: Path | None) -> str:
     return "\nChild stderr tail:\n" + "\n".join(tail)
 
 
-def _terminate_subprocess(process: subprocess.Popen) -> None:
-    """Give CLI cleanup a grace period before forcing termination, then reap."""
+def _proc_start_ticks(pid: int) -> int | None:
+    """Return a process's start time (clock ticks since boot), or None.
+
+    Field 22 of ``/proc/<pid>/stat``. ``None`` when procfs is unavailable
+    (macOS) or the process is already gone.
+    """
+    try:
+        stat = Path(f"/proc/{pid}/stat").read_text()
+    except OSError:
+        return None
+    try:
+        # comm (field 2) may contain spaces/parens, so split after the last ')'.
+        return int(stat.rsplit(")", 1)[1].split()[19])
+    except (IndexError, ValueError):
+        return None
+
+
+def _process_start_marker(pid: int) -> str | None:
+    """A stable identity string for a live process, or None.
+
+    Prefers the procfs start time (clock ticks); falls back to ``ps`` so the
+    same identity can be checked on platforms without procfs (macOS). Two
+    reads of the same live process compare equal, while a recycled pid yields
+    a different value. ``None`` when the process is gone or cannot be read.
+    """
+    ticks = _proc_start_ticks(pid)
+    if ticks is not None:
+        return str(ticks)
+    try:
+        result = subprocess.run(
+            ["ps", "-o", "lstart=", "-p", str(pid)],
+            capture_output=True,
+            text=True,
+            timeout=5,
+            check=False,
+        )
+    except (OSError, subprocess.SubprocessError):
+        return None
+    if result.returncode != 0:
+        return None
+    marker = result.stdout.strip()
+    return marker or None
+
+
+def _killable_group(pgid: int) -> bool:
+    """True if ``pgid`` is a live group we may safely SIGKILL.
+
+    A recorded shell's pgid equals its own session id while its leader is
+    alive. Once the leader exits, the pid lookup fails but the group can still
+    hold processes the shell started, so fall back to probing the group
+    itself. A reused pid shows up as a session that no longer matches, and is
+    skipped rather than signalled.
+    """
+    try:
+        return os.getsid(pgid) == pgid
+    except ProcessLookupError:
+        pass
+    try:
+        os.killpg(pgid, 0)  # signal 0 probes existence without sending
+    except (ProcessLookupError, PermissionError):
+        return False
+    return True
+
+
+def _group_started_after(pgid: int, after_ticks: int | None) -> bool:
+    """True if every live member of ``pgid`` verifiably started after ``after_ticks``.
+
+    A group the child's shell created can only contain processes started after
+    the CLI itself, so this rejects a stale entry that now names an unrelated
+    group which predates the subagent. When procfs (or the CLI's start time) is
+    unavailable, membership cannot be verified, so this fails closed: the entry
+    is left alone rather than risking a signal to an unrelated group that
+    reused a dead shell's pid. A live macOS shell is instead matched exactly by
+    ``_process_start_marker``; only a leaderless group reaches this path there.
+    """
+    if after_ticks is None:
+        return False
+    try:
+        entries = os.listdir("/proc")
+    except OSError:
+        return False
+    for entry in entries:
+        if not entry.isdigit():
+            continue
+        try:
+            rest = Path(f"/proc/{entry}/stat").read_text().rsplit(")", 1)[1].split()
+            member_pgrp = int(rest[2])  # field 5
+            member_start = int(rest[19])  # field 22
+        except (OSError, IndexError, ValueError):
+            continue
+        if member_pgrp == pgid and member_start < after_ticks:
+            return False
+    return True
+
+
+def _kill_recorded_shell_groups(
+    pgid_file: Path, after_ticks: int | None = None
+) -> None:
+    """SIGKILL the persistent-shell process groups a child CLI recorded.
+
+    Each persistent shell is its own session leader, so its pgid equals its
+    sid. Groups that are no longer recognisable, that predate the subagent, or
+    that are t
```

**File**: `tests/test_subagent_shell_pgid_kill.py` (added, +244/-0)
```diff
@@ -0,0 +1,244 @@
+"""Subagent SIGKILL escalation also kills the child's persistent shells.
+
+Persistent shells run in their own session, so killing the CLI alone leaves
+them (and anything they detached) running. See gptme/gptme#4089.
+"""
+
+import os
+import subprocess
+import sys
+import time
+from pathlib import Path
+
+import pytest
+
+from gptme.tools.subagent.execution import (
+    _kill_recorded_shell_groups,
+    _process_start_marker,
+    _terminate_subprocess,
+)
+
+pytestmark = pytest.mark.skipif(sys.platform == "win32", reason="POSIX process groups")
+
+_HAS_PROCFS = Path("/proc").exists()
+
+
+def _recorded_entry(pid: int) -> str:
+    """Mimic what a persistent shell writes to the pgid file."""
+    marker = _process_start_marker(pid)
+    return f"{pid} {marker}\n" if marker is not None else f"{pid}\n"
+
+
+def _alive(pid: int) -> bool:
+    try:
+        os.kill(pid, 0)
+    except ProcessLookupError:
+        return False
+    # A zombie still answers kill(pid, 0); treat it as dead when procfs can
+    # tell us. Platforms without /proc (macOS) fall back to the signal probe.
+    stat = Path(f"/proc/{pid}/stat")
+    if not stat.exists():
+        return True
+    return stat.read_text().split()[2] != "Z"
+
+
+def _wait_dead(pid: int, timeout: float = 5.0) -> bool:
+    deadline = time.monotonic() + timeout
+    while time.monotonic() < deadline:
+        if not _alive(pid):
+            return True
+        time.sleep(0.05)
+    return False
+
+
+def test_sigkill_escalation_kills_recorded_shell_and_detached_child(tmp_path: Path):
+    pgid_file = tmp_path / "shell-pgids"
+    pid_file = tmp_path / "detached.pid"
+    # Stand-in for a CLI that ignores SIGTERM. Started before the shell, as in
+    # production: the recorded group must postdate the CLI to be killed.
+    cli = subprocess.Popen(
+        [
+            sys.executable,
+            "-c",
+            "import signal, time; signal.signal(signal.SIGTERM, signal.SIG_IGN); time.sleep(300)",
+        ],
+    )
+    # Stand-in for a persistent shell: own session, detaches a long sleep.
+    shell = subprocess.Popen(
+        ["bash", "-c", f"sleep 300 & echo $! > {pid_file}; wait"],
+        start_new_session=True,
+    )
+    # As in production, the shell records its pgid plus a start marker, so the
+    # parent can verify the identity before signalling (also on macOS, where
+    # the marker comes from `ps` rather than procfs).
+    pgid_file.write_text(_recorded_entry(shell.pid))
+    for _ in range(100):
+        if pid_file.exists() and pid_file.read_text().strip():
+            break
+        time.sleep(0.05)
+    detached = int(pid_file.read_text())
+    time.sleep(0.2)  # let the CLI install its SIGTERM handler
+
+    _terminate_subprocess(cli, pgid_file)
+
+    assert cli.returncode is not None
+    assert _wait_dead(detached), "detached grandchild survived the escalation"
+    shell.wait(timeout=5)
+
+
+@pytest.mark.skipif(
+    not _HAS_PROCFS, reason="dead-leader member scan requires procfs (Linux)"
+)
+def test_kill_recorded_groups_reaches_group_with_dead_leader(tmp_path: Path):
+    pgid_file = tmp_path / "shell-pgids"
+    pid_file = tmp_path / "detached.pid"
+    # Session leader exits at once, leaving `sleep` in its leaderless group.
+    leader = subprocess.Popen(
+        ["bash", "-c", f"sleep 300 & echo $! > {pid_file}"],
+        start_new_session=True,
+    )
+    leader.wait(timeout=5)
+    for _ in range(100):
+        if pid_file.exists() and pid_file.read_text().strip():
+            break
+        time.sleep(0.05)
+    detached = int(pid_file.read_text())
+    pgid_file.write_text(f"{leader.pid}\n")
+
+    # The production caller passes the CLI's start time; with the leader gone
+    # the group is accepted only because every member postdates it.
+    _kill_recorded_shell_groups(pgid_file, after_ticks=1)
+
+    assert _wait_dead(detached), "group with a dead leader survived the kill"
+
+
+def test_kill_recorded_groups_skips_when_start_cannot_be_verified(tmp_path: Path):
+    pgid_file = tmp_path / "shell-pgids"
+    # macOS has no procfs: neither the recorded entry nor the CLI carries a
+    # start time, so a pid alone is unverifiable. A live unrelated session
+    # leader that reused a dead shell's pid must not be signalled.
+    leader = subprocess.Popen(["bash", "-c", "sleep 60"], start_new_session=True)
+    try:
+        # Wait for the child's setsid() so it is a session leader by the time
+        # the kill path checks it (otherwise the group lookup races).
+        deadline = time.monotonic() + 5
+        while time.monotonic() < deadline and os.getsid(leader.pid) != leader.pid:
+            time.sleep(0.01)
+        pgid_file.write_text(f"{leader.pid}\n")
+        _kill_recorded_shell_groups(pgid_file, after_ticks=None)
+        # SIGKILL delivery is asynchronous: give it a moment before deciding
+        # the entry was left alone. poll() reaps a signalled child, so it
+        # reports t
```

#### Recent Merged Pull Requests:
- **PR #4194** (closed): fix(anti-slop): use fractional em-dash excess so short texts aren't over-penalised (@TimeToBuildBob)
- **PR #4188** (closed): test(responses): expect ResponsesStreamError from failed SSE events (@TimeToBuildBob)
- **PR #4184** (2026-10-05): fix(cli): reject unknown --provider in models list instead of listing nothing (@TimeToBuildBob)
- **PR #4180** (2026-10-05): fix(preview): send Cache-Control private, no-store on preview responses (@TimeToBuildBob)
- **PR #4172** (2026-10-05): fix(compaction): reject empty summarize checkpoints (@TimeToBuildBob)
- **PR #4171** (2026-10-05): fix(llm): accept mixed-case image attachment extensions (@sunlishuo25)
- **PR #4170** (2026-10-05): fix(responses): surface explicit SSE generation failures (@TimeToBuildBob)
- **PR #4168** (2026-10-05): fix(browser): configure executable independently of engine (@TimeToBuildBob)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

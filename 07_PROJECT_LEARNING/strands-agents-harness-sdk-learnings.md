# Forensic Learning Record (Deep Inspection): strands-agents/harness-sdk

> **Canonical Artifact**: `07_PROJECT_LEARNING/strands-agents-harness-sdk-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/strands-agents/harness-sdk](https://github.com/strands-agents/harness-sdk))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:19:47.227Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `strands-agents/harness-sdk`
- **Description**: Build an agent harness and control it end-to-end. Open-source SDK for production AI agents in Python & TypeScript - any model, any cloud.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: package.json, pyproject.toml, README.md
- **Stars / Engagement**: 8587 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: package.json, pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `harness-py/src/strands_harness/__init__.py`
```
"""Strands harness: a preconfigured, opinionated Strands agent in one call."""

from strands_harness.agent import create_harness
from strands_harness.config import (
    DEFAULT_HARNESS_AGENT_CONFIG,
    define_harness_agent_config,
    harness_agent_kwargs_from_config,
    normalize_harness_agent_config,
)
from strands_harness.defaults import BUILTIN_PLUGIN_NAMES, BUILTIN_TOOL_NAMES
from strands_harness.interventions import (
    InterventionAsk,
    InterventionsOption,
    InterventionValue,
    resolve_interventions,
)
from strands_harness.memory import resolve_memory
from strands_harness.models import supports_thinking, supports_web_search
from strands_harness.prompt import HARNESS_CONTRACT, build_system_prompt
from strands_harness.types.agent import (
    BuiltinPluginName,
    BuiltinToolName,
    BuiltinToolsConfig,
    ContextManagerConfig,
    ContextManagerOption,
    Effort,
    MemoryConfig,
    ProgrammaticToolCallerConfig,
    ReadConfig,
    SessionConfig,
    ShellConfig,
    SubagentConfig,
    WebFetchConfig,
    WebFetchTransport,
)

__all__ = [
    "BUILTIN_PLUGIN_NAMES",
    "BUILTIN_TOOL_NAMES",
    "HARNESS_CONTRACT",
    "DEFAULT_HARNESS_AGENT_CONFIG",
    "BuiltinPluginName",
    "BuiltinToolName",
    "BuiltinToolsConfig",
    "ContextManagerConfig",
    "ContextManagerOption",
    "Effort",
    "InterventionAsk",
    "InterventionValue",
    "InterventionsOption",
    "MemoryConfig",
    "ProgrammaticToolCallerConfig",
    "SessionConfig",
    "ReadConfig",
    "ShellConfig",
    "SubagentConfig",
    "WebFetchConfig",
    "WebFetchTransport",
    "build_system_prompt",
    "create_harness",
    "define_harness_agent_config",
    "harness_agent_kwargs_from_config",
    "normalize_harness_agent_config",
    "resolve_interventions",
    "resolve_memory",
    "supports_thinking",
    "supports_web_search",
]

```

### Core Architecture Module: `harness-py/src/strands_harness/agent.py`
```
"""The harness factory: a preconfigured ``strands.Agent`` in one call."""

from __future__ import annotations

import logging
import os
import uuid
from collections.abc import Mapping, Sequence
from typing import Any, Literal

from strands import Agent, BackgroundTasksConfig
from strands.experimental.context_manager import ContextManager
from strands.memory import MemoryManager
from strands.models import Model, ModelRouter
from strands.plugins import Plugin
from strands.session import SessionManager, SnapshotSessionManager
from strands.storage import LocalFileStorage
from strands.tools.mcp import MCPClient, MCPServerConfig
from strands.types.tools import AgentTool
from strands.vended_plugins.skills import AgentSkills, SkillSources
from strands.vended_tools import make_shell

from strands_harness import defaults
from strands_harness.interventions import InterventionsOption, resolve_interventions
from strands_harness.memory import resolve_memory
from strands_harness.models import (
    _supports_media,
    resolve_model,
    resolve_web_fetch_model,
    supports_web_search,
)
from strands_harness.options import (
    _builtin_tool_config,
    _check_caching,
    _memory_config,
    _normalize_builtin_tools,
    _sanitize_session_id,
    _session_config,
)
from strands_harness.plugins import EnvironmentContext, Todos
from strands_harness.prompt import build_system_prompt
from strands_harness.telemetry import setup_telemetry
from strands_harness.tools import (
    edit,
    exa_web_search,
    make_programmatic_tool_caller,
    make_read,
    make_web_fetch,
    write,
)
from strands_harness.tools.subagent import build_default_subagent
from strands_harness.types.agent import (
    BuiltinPluginName,
    BuiltinToolName,
    BuiltinToolsConfig,
    ContextManagerOption,
    Effort,
    MemoryConfig,
    SessionConfig,
)

logger = logging.getLogger(__name__)

# Built-in plugins, each toggled by name via ``builtin_plugins``. Unlike the skills plugin (wired from
# its own option), these are opt-out feature plugins that only bundle a tool and a loop-level
# behavior; the map is the seam to grow the set (e.g. memories) later.
_BUILTIN_PLUGINS = {"todos": Todos, "environment": EnvironmentContext}

# The delegation tool always runs in the background: its calls are long-running subtasks whose
# intermediate work should stay out of the parent's turn.
_ALWAYS_BACKGROUND_TOOL_NAMES = frozenset({"subagent"})

# Sentinel for ``caching``: distinguishes "not passed" (the default, which warns on an unsupported
# provider) from an explicit value like ``caching=None`` (off) or ``caching=True`` (which raises on
# an unsupported provider string, and only warns when the model is a ``Model`` instance).
_UNSET: Any = object()


def _builtin_tools(parent_config: dict[str, Any]) -> dict[str, Any]:
    """The built-in tools by name. Each configurable one is built from its factory with the config it
    was enabled with (``{}`` for ``True``, see ``_BUILTIN_TOOL_CONFIG_KEYS``); ``web_fetch`` also
    derives its summarizer from the agent's model, ``subagent`` takes the whole parent config so it
    can rebuild a child the way this agent was built. ``subagent``'s own delegation-depth budget
    lives on ``agent.state``, tracked by the tool itself. ``web_search`` here is the Exa tool;
    ``create_harness`` selects it only when the setting is ``"exa"``."""
    enabled = parent_config["builtin_tools"]
    web_fetch_config = _builtin_tool_config(enabled, "web_fetch")
    web_fetch_model = resolve_web_fetch_model(parent_config["model"], web_fetch_config.pop("model", None))
    tools = (
        make_shell(**_builtin_tool_config(enabled, "shell")),
        make_read(**{"media": _supports_media(parent_config["model"]), **_builtin_tool_config(enabled, "read")}),
        write,
        edit,
        make_web_fetch(model=web_fetch_model, **web_fetch_config),
        exa_web_search,
        make_programmatic_tool_caller(**_builtin_tool_config(enabled, "programmatic_tool_caller")),
        build_default_subagent(create_harness, parent_config, **_builtin_tool_config(enabled, "subagent")),
    )
    return {t.tool_name: t for t in tools}


def _select_builtin_tools(enabled: Mapping[str, Any], tools: dict[str, Any]) -> list[Any]:
    # A config mapping enables the tool even when empty (``{"web_fetch": {}}`` is "on with
    # defaults"), so only ``False`` means off.
    return [tools[name] for name, setting in enabled.items() if setting is not False]


def _web_search_mode(
    setting: Any, explicit: bool, model: Model | ModelRouter | str | None
) -> Literal["native", "exa"] | None:
    """How ``web_search`` is served for ``model``: ``"exa"`` (the third-party tool, whenever opted
    into with ``"exa"``), ``"native"`` (a model flag), or ``None`` (off)."""
    if setting is False:
        return None
    if setting == "exa":
        logger.warning(
            "web_search is opted into Exa (exa.ai), a third-party service: every search query leaves your "
            "environment and is subject to Exa's privacy policy (https://exa.ai/privacy-policy)."
        )
        return "exa"
    if supports_web_search(model):
        return "native"
    target = (
        "A pre-built Model instance"
        if isinstance(model, (Model, ModelRouter))
        else f"Model {model or defaults.DEFAULT_MODEL}"
    )
    message = (
        f"{target} has no native web search. Pass builtin_tools={{'web_search': 'exa'}} to search "
        "through Exa (a third party), or drop 'web_search'."
    )
    if explicit:
        raise ValueError(message)
    logger.warning(message)
    return None


def _skills_plugin(skills: bool | SkillSources | AgentSkills | None) -> AgentSkills | None:
    """The skills plugin for ``skills``: the default dir when present (``True``), the sources named
    (passed through untouched; the SDK reports a missing path), or the instance verbatim."""
    if skills is None or skills is False:
        return None
    if isinstance(skills, AgentSkills):
        return skills
    if skills is True:
        return AgentSkills(skills=[defaults.DEFAULT_SKILLS_DIR]) if os.path.isdir(defaults.DEFAULT_SKILLS_DIR) else None
    if isinstance(skills, list) and not skills:
        return None
    return AgentSkills(skills=skills)


def _has_skills(plugins: list[Any]) -> bool:
    return any(isinstance(p, AgentSkills) for p in plugins)


def _select_builtin_plugins(names: Sequence[str] | None, existing: list[Any]) -> list[Any]:
    if names is None:
        names = defaults.DEFAULT_BUILTIN_PLUGINS
    selected = []
    for name in names:
        if name not in _BUILTIN_PLUGINS:
            available = ", ".join(sorted(_BUILTIN_PLUGINS))
            raise ValueError(f"Unknown built-in plugin {name!r}. Available: {available}.")
        plugin_cls = _BUILTIN_PLUGINS[name]
        if not any(isinstance(p, plugin_cls) for p in existing):
            selected.append(plugin_cls())
    return selected


def _check_name_collisions(*sources: tuple[str, bool, list[Any]]) -> None:
    """Raise if two tools would register under the same name, so a collision fails at construction
    with the losing source named rather than one tool silently disappearing. Names differing only by
    ``-``/``_`` collide, matching the SDK tool registry. Each source is ``(label, is_builtin, tools)``;
    the remedy only mentions dropping a built-in when a built-in is actually one of the two sources."""
    seen: dict[str, tuple[str, bool]] = {}
    for label, is_builtin, tools in sources:
        for tool in tools:
            # Only resolved tool objects have a fixed name here; the SDK also accepts strings, dicts,
            # modules, and nested lists in ``tools`` and resolves them later, so skip those.
            if not isinstance(tool, AgentTool):
                continue
            key = tool.tool_name.replace("-", "_")
            if key in seen:
                prior_label, prior_builtin = seen[key]
                where = label 
```

### Core Architecture Module: `harness-py/src/strands_harness/config.py`
```
"""Serializable harness configuration shared with TypeScript and exported projects."""

from __future__ import annotations

import importlib
import importlib.util
import json
import logging
import operator
import os
import re
import sys
from collections.abc import Callable
from copy import deepcopy
from functools import reduce
from pathlib import Path
from types import ModuleType
from typing import Annotated, Any, Literal

from pydantic import (
    AfterValidator,
    BaseModel,
    BeforeValidator,
    ConfigDict,
    Field,
    JsonValue,
    RootModel,
    SkipValidation,
    TypeAdapter,
    ValidationError,
    model_validator,
)
from pydantic.alias_generators import to_camel
from pydantic_core import PydanticCustomError

from strands_harness import defaults
from strands_harness.types.agent import BuiltinPluginName, BuiltinToolName, Effort, WebFetchTransport

__all__ = [
    "DEFAULT_HARNESS_AGENT_CONFIG",
    "define_harness_agent_config",
    "harness_agent_kwargs_from_config",
    "normalize_harness_agent_config",
]

logger = logging.getLogger(__name__)

DEFAULT_HARNESS_AGENT_CONFIG: dict[str, Any] = {
    "name": "Strands harness",
    "description": "",
    "instructions": "",
    "model": defaults.DEFAULT_MODEL,
    "modelModule": None,
    "effort": defaults.DEFAULT_EFFORT,
    "tools": [],
    "subagents": [],
    "mcpServers": {},
    "builtinTools": list(defaults.DEFAULT_BUILTIN_TOOLS),
    "caching": True,
    "contextManager": defaults.DEFAULT_CONTEXT_MANAGER,
    "session": True,
    "skills": True,
    "memory": True,
    "memoryStores": [],
    "plugins": [],
    "builtinPlugins": list(defaults.DEFAULT_BUILTIN_PLUGINS),
    "interventions": None,
    "interventionModules": [],
    "sandbox": None,
    "agentConfigModules": {},
    "dependencies": {"typescript": {}, "python": []},
    "agentConfig": {},
}


def define_harness_agent_config(config: dict[str, Any] | None = None) -> dict[str, Any]:
    """Fill a partial portable config with the harness defaults."""
    return normalize_harness_agent_config({**deepcopy(DEFAULT_HARNESS_AGENT_CONFIG), **(config or {})})


def normalize_harness_agent_config(value: object) -> dict[str, Any]:
    """Validate and normalize a JSON-compatible harness definition.

    Normalizing also folds JSON-only spellings into their kwargs form: ``contextManager: "off"`` is ``False``.
    """
    if not isinstance(value, dict):
        raise ValueError("agent config must be an object.")
    unknown = sorted(set(value) - set(DEFAULT_HARNESS_AGENT_CONFIG))
    if unknown:
        logger.warning("Ignoring unknown agent config keys: %s.", ", ".join(unknown))
    config = {
        **DEFAULT_HARNESS_AGENT_CONFIG,
        **{key: item for key, item in value.items() if key in DEFAULT_HARNESS_AGENT_CONFIG},
    }
    try:
        parsed = _HarnessAgentConfig.model_validate(config)
    except ValidationError as error:
        raise ValueError(_describe(error, config)) from error
    # Every top-level key is set by the merge above; nested objects keep only the keys the config spelled out.
    return parsed.model_dump(by_alias=True, exclude_unset=True)


def _describe(error: ValidationError, config: dict[str, Any]) -> str:
    """One line per problem, located by its camelCase config path (``builtinTools.shell.description``).

    Each location is walked against ``config`` so only real keys and indexes survive: pydantic tags
    ``JsonValue`` union members into the path (``agentConfig.x.float``), and those tags are dropped. The
    one segment that is legitimately absent from the input is the name of a missing required key.
    """
    lines = []
    for item in error.errors(include_url=False):
        path: list[str] = []
        node: Any = config
        for part in item["loc"]:
            if (isinstance(node, dict) and part in node) or (
                isinstance(node, list) and isinstance(part, int) and 0 <= part < len(node)
            ):
                node = node[part]
            elif item["type"] != "missing":
                continue
            path.append(str(part))
        lines.append(f"{'.'.join(path)}: {item['msg']}" if path else item["msg"])
    return "\n".join(lines)


def harness_agent_kwargs_from_config(value: object, base_dir: str | Path = ".") -> dict[str, Any]:
    """Load executable references and convert portable config to ``create_harness`` kwargs.

    Local multi-file modules must use regular ``__init__.py`` packages and explicit relative imports.
    Bare imports use Python's normal import path; project directories are not added to ``sys.path``.
    """
    config = normalize_harness_agent_config(value)
    root = Path(base_dir).resolve()
    tools = _load_many(config["tools"], root)
    subagents = _load_many(config["subagents"], root, invoke=True)
    plugins = _load_many(config["plugins"], root)
    stores = _load_many(config["memoryStores"], root)
    sandbox = _load_optional(config["sandbox"], root)
    model = _load_optional(config["modelModule"], root)
    interventions = _load_many(config["interventionModules"], root)
    agent_config_modules = {
        key: _load_reference(reference, root) for key, reference in config["agentConfigModules"].items()
    }
    kwargs = deepcopy(config["agentConfig"])
    kwargs.update(agent_config_modules)
    kwargs.update(
        {
            "name": config["name"],
            "model": config["model"] if model is None else model,
            "effort": config["effort"],
            "context_manager": config["contextManager"],
            "session": _session_kwarg(config["session"], root),
            "skills": _skills_kwarg(config["skills"], root),
            "memory": _memory_kwarg(config["memory"], stores, root),
        }
    )
    builtin_tools = _builtin_tools_kwarg(config["builtinTools"], root)
    if builtin_tools is not None:
        kwargs["builtin_tools"] = builtin_tools
    if not config["caching"]:
        kwargs["caching"] = False
    if config["builtinPlugins"] != list(defaults.DEFAULT_BUILTIN_PLUGINS):
        kwargs["builtin_plugins"] = config["builtinPlugins"]
    if config["description"]:
        kwargs["description"] = config["description"]
    if config["instructions"]:
        kwargs["instructions"] = config["instructions"]
    # Specialist agents declared as ``subagents`` module refs are wired like any tool: each is exposed
    # via ``Agent.as_tool()`` and appended to ``tools`` (the harness has no separate subagents param).
    tools = [*tools, *(agent.as_tool() for agent in subagents)]
    if tools:
        kwargs["tools"] = tools
    if config["mcpServers"]:
        kwargs["mcp_servers"] = _python_mcp_servers(
            _expand_env(_resolve_mcp_working_directories(_mcp_server_map(config["mcpServers"], root), root))
        )
    if plugins:
        kwargs["plugins"] = plugins
    configured_interventions = (
        config["interventions"]
        if isinstance(config["interventions"], list)
        else [config["interventions"]]
        if config["interventions"]
        else []
    )
    intervention_values = [
        _resolve_path(value.strip(), root) if value.strip().endswith(".cedar") else value
        for value in configured_interventions
    ]
    intervention_values.extend(interventions)
    if intervention_values:
        kwargs["interventions"] = intervention_values[0] if len(intervention_values) == 1 else intervention_values
    if sandbox is not None:
        kwargs["sandbox"] = sandbox
    return kwargs


def _one_of(message: str, *branches: tuple[type | Callable[[object], bool], Any]) -> Any:
    """Union of ``branches``, picked by input shape (a type or a predicate); no match raises ``message``.

    Hand-rolled because pydantic's unions report a failed value once per member and tag error paths with the
    member's name (``session.SessionConfig.id``); a callable ``Discriminator`` still leaks its tag and warns on
    dump. ``SkipValidation`` on the union itself keeps the matched branch validate
```

### Core Architecture Module: `harness-py/src/strands_harness/defaults.py`
```
"""Default configuration for the harness."""

from strands_harness.types.agent import BuiltinPluginName, BuiltinToolName

DEFAULT_MODEL = "bedrock/global.anthropic.claude-opus-5"

DEFAULT_EFFORT = "auto"

DEFAULT_CONTEXT_MANAGER = "auto"

DEFAULT_CACHING = "auto"

BUILTIN_TOOL_NAMES: tuple[BuiltinToolName, ...] = (
    "shell",
    "read",
    "write",
    "edit",
    "web_fetch",
    "web_search",
    "programmatic_tool_caller",
    "subagent",
)
"""Every built-in tool name, in the order the harness registers them."""

DEFAULT_BUILTIN_TOOLS: tuple[BuiltinToolName, ...] = BUILTIN_TOOL_NAMES
"""Built-in tools enabled when ``builtin_tools`` is omitted (``web_search`` only where the model has native search)."""

BUILTIN_PLUGIN_NAMES: tuple[BuiltinPluginName, ...] = ("todos", "environment")
"""Every built-in plugin name."""

DEFAULT_BUILTIN_PLUGINS: tuple[BuiltinPluginName, ...] = BUILTIN_PLUGIN_NAMES

DEFAULT_SUBAGENT_MAX_DEPTH = 2

DEFAULT_SESSION_DIR = "./.agent/sessions"

DEFAULT_SKILLS_DIR = "./.agent/skills"

DEFAULT_MEMORY_DIR = "./.agent/memory"

```

### Core Architecture Module: `harness-py/src/strands_harness/interventions.py`
```
"""Resolve the harness's ``interventions`` sugar into SDK intervention handlers.

The harness's ``interventions`` option accepts a preset name, a natural-language policy, a Cedar policy
file, an SDK handler instance, or a list of these, and coerces them into the handlers that
``Agent(interventions=...)`` expects. A raw handler instance passes through untouched, so anything
the presets don't cover (a Slack ``ask`` callback, a Cedar principal resolver, custom trust rules)
stays reachable by constructing the SDK handler yourself.

The string grammar is deterministic — no content sniffing:

- a preset keyword (``off``/``ask``/``smart``) maps to a ``HumanInTheLoop`` config,
- a path ending in ``.cedar`` loads a ``CedarAuthorization`` policy,
- any other string is a natural-language risk policy: it becomes the LLM risk classifier's prompt.

Inline Cedar policy text is intentionally *not* auto-detected — it is indistinguishable from prose,
so pass ``CedarAuthorization(policies=...)`` directly for that.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Literal

from strands.interventions import InterventionHandler
from strands.vended_interventions.hitl import HumanInTheLoop, LLMClassifierConfig

InterventionValue = str | InterventionHandler
InterventionsOption = InterventionValue | list[InterventionValue] | None

# How a preset collects approval: the SDK's ``"stdio"``, a custom callback, or interrupt/resume.
InterventionAsk = Literal["stdio"] | Callable[..., Any] | None


def _cedar_handler(policies: str) -> InterventionHandler:
    try:
        from strands.vended_interventions.cedar import CedarAuthorization
    except ImportError as e:
        raise ValueError(
            f"Cedar policy {policies!r} needs the optional cedar dependency. "
            "Install it with: pip install 'strands-agents[cedar]'."
        ) from e
    return CedarAuthorization(policies=policies)


def _resolve_one(value: InterventionValue, ask: InterventionAsk) -> InterventionHandler | None:
    if isinstance(value, InterventionHandler):
        return value
    if not isinstance(value, str):
        raise ValueError(
            f"Invalid interventions value {value!r}; expected a preset name, a policy string, or a handler instance."
        )
    text = value.strip()
    if text == "off":
        return None
    if text == "ask":
        return HumanInTheLoop(ask=ask)
    if text == "smart":
        return HumanInTheLoop(classifier=True, ask=ask)
    # ``.cedar`` suffix only: the SDK loader treats a non-``.cedar`` string as inline policy, and
    # sniffing file existence would misroute a prose policy that happened to match a filename.
    if text.endswith(".cedar"):
        return _cedar_handler(text)
    # Natural-language policy: the LLM risk classifier judges each call against this prompt and
    # escalates a flagged one for approval — like ``smart``, but with your own rubric.
    return HumanInTheLoop(classifier=LLMClassifierConfig(system_prompt=value), ask=ask)


def _check_handler_collisions(handlers: list[InterventionHandler]) -> None:
    """Raise if two handlers share a name — the SDK registers at most one per ``name``, so a second
    would silently win or be dropped. Different kinds (a Cedar policy plus one human-approval preset)
    have different names and coexist; two of the same kind collide."""
    seen: set[str] = set()
    for handler in handlers:
        if handler.name in seen:
            raise ValueError(
                f"Two interventions share the handler name {handler.name!r}, but an agent registers at "
                "most one per name. Layer different kinds (e.g. a Cedar policy plus one human-approval "
                "preset), not two of the same kind."
            )
        seen.add(handler.name)


def resolve_interventions(
    value: InterventionsOption,
    *,
    ask: InterventionAsk = None,
) -> list[InterventionHandler]:
    """Coerce the ``interventions`` sugar into a list of SDK handlers. ``None``/``"off"`` yield ``[]``."""
    if value is None:
        return []
    values = value if isinstance(value, list) else [value]
    handlers = [handler for v in values if (handler := _resolve_one(v, ask)) is not None]
    _check_handler_collisions(handlers)
    return handlers

```

### Core Architecture Module: `harness-py/src/strands_harness/memory.py`
```
"""File-based memory resolution: build a ``MemoryManager`` over a local ``FileMemoryStore``.

Memory is on by default. Facts the agent learns are distilled every few turns into markdown files
under ``memory_dir`` (default ``./.agent/memory``), searched and injected before each turn so a
returning agent recalls them without re-asking. Persistence is plain files, independent of any
session: memory survives across sessions and works with sessions off.

Extraction is background and turn-triggered, so a short run can end with the latest turns unsaved.
Scoping the agent with ``async with agent:`` runs its shutdown on exit, or the owner of the agent's
lifecycle calls ``agent.shutdown()`` (``await agent.shutdown_async()`` from async code) at shutdown;
the harness's CLI flushes at that boundary for you, and a library consumer should do one of these.

A consumer can swap the backend by passing their own ``stores``; the harness still owns the manager, so its
injection/tool policy (injection on, ``search_memory`` on, ``add_memory`` off) applies either way.
"""

from __future__ import annotations

from strands.memory import (
    ExtractionConfig,
    MemoryEntry,
    MemoryInjectionConfig,
    MemoryManager,
    MemoryStore,
    ModelExtractor,
    SearchOptions,
)
from strands.models import Model, ModelRouter
from strands.storage import LocalFileStorage
from strands.vended_memory_stores.file_memory_store import FileMemoryStore

from strands_harness.defaults import DEFAULT_MEMORY_DIR
from strands_harness.models import resolve_web_fetch_model

# Store name, surfaced as the ``source`` attribute on each injected ``<memory>`` entry.
MEMORY_STORE_NAME = "memory"


def resolve_memory(
    *,
    stores: MemoryStore | list[MemoryStore] | None = None,
    model: Model | ModelRouter | str | None = None,
    memory_dir: str = DEFAULT_MEMORY_DIR,
    web_fetch_model: Model | ModelRouter | str | None = None,
    writable: bool = True,
) -> MemoryManager:
    """Build the memory manager: a ``MemoryManager`` wrapping either the consumer's ``stores`` or a
    default ``FileMemoryStore`` writing to ``memory_dir``, with the SDK's tool defaults
    (``search_memory`` on, no ``add_memory`` write tool) and injection on every turn.

    The default store's keys are pre-namespaced to ``memory_dir`` itself, so files land at
    ``memory_dir/<slug>.md`` without the store's own ``memory/<name>/`` scoping doubling the path.
    Extraction runs on the same small, credential-aligned model ``web_fetch`` summarizes with (the
    agent's ``web_fetch_model`` override, or the small model for its provider) rather than the main
    model, so distilling facts every few turns stays cheap.

    Args:
        stores: Consumer-supplied store(s) to manage instead of the default file store. When omitted
            or an empty list, the harness builds a ``FileMemoryStore`` under ``memory_dir``.
            ``model``/``memory_dir``/``web_fetch_model`` are used only to build that default store and
            are ignored when ``stores`` is non-empty.
        model: The agent's ``model`` argument, used to derive the small extraction model for the
            default store.
        memory_dir: Directory the default store's memory files live in.
        web_fetch_model: Explicit summarizer/extraction model override, forwarded to the resolver.
        writable: Whether the manager may write to its stores. ``True`` (default) builds a writable
            default store and passes consumer stores through as-is. ``False`` builds a recall-only
            manager: the default store is created read-only and consumer stores are wrapped in a
            read-only view, so the manager still searches and injects them but never extracts or
            writes. That is the shape for a subagent delegate, which reads the shared memory without
            promoting its throwaway subtask into the store.

    Returns:
        A configured ``MemoryManager`` to pass as ``Agent(memory_manager=...)``.
    """
    if stores is None:
        supplied: list[MemoryStore] = []
    elif isinstance(stores, list):
        supplied = stores
    else:
        supplied = [stores]

    if supplied:
        managed = [store if writable else _to_read_only(store) for store in supplied]
    else:
        managed = [_build_default_store(model, memory_dir, web_fetch_model, writable)]
    # Inject on every model call, not only on a fresh user ask: the harness runs multi-step tool loops, so an
    # autonomous step (or a delegate) consults memory at each turn rather than only when the user speaks.
    return MemoryManager(stores=managed, injection=MemoryInjectionConfig(trigger="everyTurn"))


def _build_default_store(
    model: Model | ModelRouter | str | None,
    memory_dir: str,
    web_fetch_model: Model | ModelRouter | str | None,
    writable: bool,
) -> FileMemoryStore:
    """The default file-backed store, writing markdown directly under ``memory_dir``."""
    storage = LocalFileStorage(memory_dir).namespace("")
    if not writable:
        return FileMemoryStore(name=MEMORY_STORE_NAME, storage=storage, writable=False)
    summarizer = resolve_web_fetch_model(model, web_fetch_model)
    return FileMemoryStore(
        name=MEMORY_STORE_NAME,
        storage=storage,
        writable=True,
        extraction=ExtractionConfig(extractor=ModelExtractor(model=summarizer)),
    )


class _ReadOnlyStore:
    """A recall-only view of a store: the same backend, still searchable, but with every write path
    (``add``/``add_messages``) and its extraction config dropped so the delegate's manager can neither
    extract nor write. ``get_tools`` is omitted too, since a store-native tool is an unbounded surface
    we can't guarantee is read-only; the delegate still recalls through ``search_memory`` and injection.
    """

    def __init__(self, store: MemoryStore) -> None:
        self._store = store
        self.name = store.name
        self.description = getattr(store, "description", None)
        self.max_search_results = getattr(store, "max_search_results", None)
        self.writable = False
        self.extraction = None

    async def search(self, query: str, options: SearchOptions | None = None) -> list[MemoryEntry]:
        return await self._store.search(query, options)

    async def initialize(self) -> None:
        initialize = getattr(self._store, "initialize", None)
        if initialize is not None:
            await initialize()


def _to_read_only(store: MemoryStore) -> MemoryStore:
    """Wrap ``store`` in a recall-only view (see :class:`_ReadOnlyStore`)."""
    return _ReadOnlyStore(store)

```

### Core Architecture Module: `harness-py/src/strands_harness/models.py`
```
"""Model resolution from ``provider/name`` strings, with per-provider reasoning config.

Consumers pass a ready ``Model`` instance, a ``"provider/name"`` string, a bare Bedrock model
id, or ``None`` for the harness default. Every provider uses its real model ids directly. The
``effort`` level is mapped to each provider's own request fields here, so the caller sets one
value regardless of provider.

Prompt caching is requested via ``caching`` and reaches the provider one of two ways: the harness
configures Bedrock and Anthropic direct (cache points plus cached tool definitions), while OpenAI,
Gemini, bedrock-mantle, and litellm cache automatically server-side (Gemini on models 2.5 and
newer; litellm through its OpenAI-compatible backend). Only a pre-built ``Model`` or ``ModelRouter``
instance can't be honored (its provider is unknown), so a warning is logged.
"""

from __future__ import annotations

import logging
import os
import re
from collections.abc import Callable
from typing import Any, NamedTuple

from strands.models import Model, ModelRouter

from strands_harness import defaults
from strands_harness.types.agent import Effort

logger = logging.getLogger(__name__)

_ANTHROPIC_MAX_TOKENS = 32_000
# Claude calls the search directly (not from code execution), so results come back as citations
# and the tool works on every Claude model, not only those with programmatic tool calling.
_ANTHROPIC_WEB_SEARCH = {"type": "web_search_20260318", "name": "web_search", "allowed_callers": ["direct"]}

# Claude's real max_tokens ceiling by tier, verified live against Bedrock Converse. Applied on
# Bedrock and Anthropic-direct only — other Bedrock-hosted model families aren't known to need
# this. Matched as a substring so any Bedrock region/vendor prefix in front of it doesn't matter.
_CLAUDE_MAX_TOKENS = {
    "claude-opus-": 128_000,
    "claude-sonnet-": 128_000,
    "claude-haiku-": 64_000,
    "claude-fable-": 128_000,
}
_CLAUDE_MAX_TOKENS_BY_VERSION = (
    ("claude-opus-4-5", 64_000),
    ("claude-opus-4.5", 64_000),
    ("claude-sonnet-4-5", 64_000),
    ("claude-sonnet-4.5", 64_000),
)


def _claude_max_tokens(model_id: str) -> int | None:
    pinned = next((tokens for needle, tokens in _CLAUDE_MAX_TOKENS_BY_VERSION if needle in model_id), None)
    if pinned is not None:
        return pinned
    return next((tokens for needle, tokens in _CLAUDE_MAX_TOKENS.items() if needle in model_id), None)


# Small, fast model per provider for the web_fetch summarizer. Keyed by the main agent's provider
# so the summarizer shares its credentials. Kept byte-identical with ``_WEB_FETCH_MODELS`` in the
# TypeScript ``models.ts``.
_WEB_FETCH_MODELS = {
    "bedrock": "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    "bedrock-mantle": "openai.gpt-5.6-luna",
    "anthropic": "claude-haiku-4-5-20251001",
    "openai": "gpt-5.6-luna",
    "google": "gemini-3.5-flash",
}

# Cross-region inference profile prefixes stripped from a Bedrock model id before matching its
# provider family. Kept byte-identical with ``models.ts``.
# Providers whose endpoint can be repointed by an env var. A non-default endpoint publishes its
# own model list, so the vended small summarizer is not guaranteed to exist on it.
_CUSTOM_ENDPOINT_VARS = {"anthropic": "ANTHROPIC_BASE_URL", "openai": "OPENAI_BASE_URL"}

_BEDROCK_REGION_PREFIXES = ("global.", "apac.", "us.", "eu.", "au.", "jp.")


# Reasoning levels each provider's API accepts. The harness validates against the resolved
# provider's set so an unsupported level fails here rather than as a request error.
_ANTHROPIC_LEVELS = ("low", "medium", "high", "xhigh", "max")
_OPENAI_LEVELS = ("minimal", "low", "medium", "high", "xhigh", "none")
_BEDROCK_GPT_LEVELS = ("none", "low", "medium", "high", "xhigh", "max")
_BEDROCK_GPT_OSS_LEVELS = ("low", "medium", "high")
_BEDROCK_QWEN_LEVELS = ("none", "minimal", "low", "medium", "high", "xhigh", "max")
_BEDROCK_XAI_LEVELS = ("low", "medium", "high", "xhigh")
_GOOGLE_LEVELS = ("minimal", "low", "medium", "high")

_ADAPTIVE_THINKING_SINCE = {"opus": (4, 6), "sonnet": (4, 6)}
_EXTENDED_THINKING_SINCE = {"opus": (4, 5), "sonnet": (4, 5), "haiku": (4, 5)}
_CLAUDE_ID = re.compile(
    r"claude-(?:(\d{1,2})(?:[-.](\d{1,2}))?-)?(opus|sonnet|haiku|fable|mythos)"
    r"(?:[-.](\d{1,2}))?(?:[-.](\d{1,2}))?(?!\d)"
)
_EXTENDED_THINKING_BUDGETS = {"low": 2_048, "medium": 8_192, "high": 16_384, "xhigh": 32_768, "max": 49_152}


def _claude_thinking_mode(model_id: str) -> str | None:
    match = _CLAUDE_ID.search(model_id)
    if match is None:
        return "adaptive"
    lead_major, lead_minor, family, major, minor = match.groups()
    if major is None and lead_major is None:
        takes_adaptive = family not in _EXTENDED_THINKING_SINCE or family in _ADAPTIVE_THINKING_SINCE
        return "adaptive" if takes_adaptive else "extended"
    version = (int(major), int(minor or 0)) if major is not None else (int(lead_major), int(lead_minor or 0))
    if family not in _EXTENDED_THINKING_SINCE:
        return "adaptive"
    if version >= _ADAPTIVE_THINKING_SINCE.get(family, (99, 99)):
        return "adaptive"
    return "extended" if version >= _EXTENDED_THINKING_SINCE[family] else None


def _claude_thinking(effort: str) -> dict:
    return {
        "thinking": {"type": "adaptive", "display": "summarized"},
        "output_config": {"effort": effort},
    }


def _claude_extended_thinking(effort: str, max_tokens: int) -> dict:
    return {"thinking": {"type": "enabled", "budget_tokens": min(_EXTENDED_THINKING_BUDGETS[effort], max_tokens - 1)}}


def _claude_thinking_block(model_id: str, effort: str, max_tokens: int) -> dict:
    if _claude_thinking_mode(model_id) == "extended":
        return _claude_extended_thinking(effort, max_tokens)
    return _claude_thinking(effort)


def _bedrock_family(model_id: str) -> str:
    prefix = next((prefix for prefix in _BEDROCK_REGION_PREFIXES if model_id.startswith(prefix)), "")
    return model_id[len(prefix) :]


def _bedrock_levels(model_id: str) -> tuple[str, ...]:
    family = _bedrock_family(model_id)
    if family.startswith("anthropic."):
        return _ANTHROPIC_LEVELS if _claude_thinking_mode(family) is not None else ()
    if family.startswith("openai.gpt-5.6-") or family == "openai.gpt-6-astra":
        return _BEDROCK_GPT_LEVELS
    if family.startswith("openai.gpt-oss-"):
        return _BEDROCK_GPT_OSS_LEVELS
    if family.startswith("qwen."):
        return _BEDROCK_QWEN_LEVELS
    if family.startswith("xai."):
        return _BEDROCK_XAI_LEVELS
    return ()


def _bedrock_effort(model_id: str, effort: Effort) -> str | None:
    levels = _bedrock_levels(model_id)
    if levels:
        return _effort(effort, "high", levels, f"Bedrock model {model_id}")
    _check_effort(effort)
    if effort in ("auto", "off"):
        return None
    raise ValueError(f"Effort {effort!r} is not supported by Bedrock model {model_id}. Pass 'auto' or 'off'.")


def _bedrock_thinking(model_id: str, effort: str | None) -> dict | None:
    if effort is None:
        return None
    family = _bedrock_family(model_id)
    if family.startswith("anthropic."):
        return _claude_thinking_block(family, effort, _claude_max_tokens(model_id) or _ANTHROPIC_MAX_TOKENS)
    if family.startswith("openai.gpt-5.6-") or family == "openai.gpt-6-astra":
        return {"reasoning": {"effort": effort}}
    if family.startswith("openai.gpt-oss-"):
        return {"reasoning_effort": effort}
    if family.startswith("qwen."):
        return {"reasoning_effort": effort}
    if family.startswith("xai."):
        return {"reasoning_effort": effort}
    return None


def _bedrock(model_id: str, effort: str | None, web_search: bool, caching: bool) -> Model:
    from strands.models import BedrockModel, CacheConfig

    thinking = _bedrock_thinking(model_id, effort)
    extra: dict[str, Any] = {} if thinking is None else {"additional_request_fields": thinking}
    max_tokens = _claude_max_tokens(model_i
```

### Core Architecture Module: `harness-py/src/strands_harness/options.py`
```
"""Normalizers for the ``*Option`` unions ``create_harness`` accepts; each returns the resolved
``*Config``/instance/None."""

from __future__ import annotations

import math
import re
from collections.abc import Mapping, Sequence
from typing import Any

from strands.memory import MemoryManager
from strands.models import Model, ModelRouter
from strands.session import SessionManager

from strands_harness import defaults
from strands_harness.types.agent import (
    BuiltinToolName,
    MemoryConfig,
    ProgrammaticToolCallerConfig,
    ReadConfig,
    SessionConfig,
    ShellConfig,
    SubagentConfig,
    WebFetchConfig,
)


def _sanitize_session_id(session_id: str) -> str:
    return re.sub(r"[^a-z0-9_-]", "-", session_id.strip().lower()) or "default"


# ``shell``'s factory also accepts ``name`` (would break selection by built-in name) and ``sandbox``
# (the harness's tools read the agent-level ``sandbox=`` at call time); neither is exposed.
_BUILTIN_TOOL_CONFIG_KEYS: dict[str, frozenset[str]] = {
    "read": frozenset(ReadConfig.__annotations__),
    "shell": frozenset(ShellConfig.__annotations__),
    "web_fetch": frozenset(WebFetchConfig.__annotations__),
    "programmatic_tool_caller": frozenset(ProgrammaticToolCallerConfig.__annotations__),
    "subagent": frozenset(SubagentConfig.__annotations__),
}


# Config keys whose ``None`` is a value in ``types.agent`` (every tool allowed, no time bound) rather
# than "unset"; ``None`` under any other key is dropped so the factory default applies.
_NULLABLE_BUILTIN_TOOL_CONFIG_KEYS = frozenset({"allowed_tools", "timeout"})


def _check_builtin_tool_config_value(tool: str, key: str, value: object) -> None:
    # Keys are unique across tools, so the shape is per key: what ``config.py`` enforces for JSON, plus model
    # instances.
    if value is None:
        return
    non_blank_str = isinstance(value, str) and bool(value.strip())
    number = isinstance(value, (int, float)) and not isinstance(value, bool)
    expected, accepted = {
        "model": (
            "a Model, ModelRouter or 'provider/name' string",
            isinstance(value, (Model, ModelRouter)) or non_blank_str,
        ),
        "description": ("a non-empty string", non_blank_str),
        "transport": ("'curl' or 'direct'", value in ("curl", "direct")),
        "allowed_tools": (
            "a list of tool names",
            isinstance(value, list) and all(isinstance(item, str) and item.strip() for item in value),
        ),
        "timeout": ("a positive number of seconds", number and math.isfinite(value) and value > 0),
        "media": ("a bool", isinstance(value, bool)),
        "max_depth": ("a non-negative int", isinstance(value, int) and not isinstance(value, bool) and value >= 0),
    }[key]
    if not accepted:
        raise ValueError(f"builtin_tools[{tool!r}][{key!r}] must be {expected}, got {value!r}.")


def _check_builtin_tool_name(name: object) -> None:
    if name not in defaults.BUILTIN_TOOL_NAMES:
        available = ", ".join(defaults.BUILTIN_TOOL_NAMES)
        raise ValueError(f"Unknown built-in tool {name!r}. Available: {available}.")


def _normalize_builtin_tools(
    value: Sequence[str] | Mapping[str, Any] | None,
) -> dict[BuiltinToolName, Any]:
    """Normalize ``builtin_tools`` to ``{name: True | False | cfg}`` over every built-in name.

    A list pins exactly the names given (``[]`` = none). A mapping edits the harness's default set:
    ``False`` removes a tool, ``True`` adds it, a config dict adds and configures it (the keys in
    ``_BUILTIN_TOOL_CONFIG_KEYS``), and ``"exa"`` opts ``web_search`` into its third-party fallback;
    ``"*"`` (default ``True``) is the starting set, written ``False`` to start from nothing. ``None`` is
    The harness's default set. Unknown names, unknown config keys and other values raise. The result is what
    subagents receive, so they never see a list or ``"*"``.
    """
    if value is None:
        return {name: name in defaults.DEFAULT_BUILTIN_TOOLS for name in defaults.BUILTIN_TOOL_NAMES}
    if isinstance(value, Mapping):
        start = value.get("*", True)
        if not isinstance(start, bool):
            raise ValueError(f"builtin_tools['*'] must be a bool, got {start!r}.")
        normalized: dict[BuiltinToolName, Any] = {
            name: start and name in defaults.DEFAULT_BUILTIN_TOOLS for name in defaults.BUILTIN_TOOL_NAMES
        }
        for name, setting in value.items():
            if name == "*":
                continue
            _check_builtin_tool_name(name)
            if name == "web_search":
                if not (isinstance(setting, bool) or setting == "exa"):
                    raise ValueError(f"builtin_tools['web_search'] must be a bool or 'exa', got {setting!r}.")
                normalized[name] = setting
                continue
            config_keys = _BUILTIN_TOOL_CONFIG_KEYS.get(name)
            if isinstance(setting, Mapping):
                if config_keys is None:
                    raise ValueError(f"Built-in tool {name!r} takes no config; pass True or False.")
                unknown = sorted(set(setting) - config_keys)
                if unknown:
                    raise ValueError(
                        f"Unknown {name} config keys: {', '.join(unknown)}. Allowed: {', '.join(sorted(config_keys))}."
                    )
                for key, config_value in setting.items():
                    _check_builtin_tool_config_value(name, key, config_value)
                normalized[name] = {
                    key: config_value
                    for key, config_value in setting.items()
                    if config_value is not None or key in _NULLABLE_BUILTIN_TOOL_CONFIG_KEYS
                }
            elif isinstance(setting, bool):
                normalized[name] = setting
            else:
                raise ValueError(f"builtin_tools[{name!r}] must be a bool or a config mapping, got {setting!r}.")
        return normalized
    if isinstance(value, (str, bool)) or not isinstance(value, Sequence):
        raise ValueError(
            f"builtin_tools must be a list of names or a mapping of name to bool/config, got {value!r}; "
            "[] turns every built-in off."
        )
    names = list(value)
    for name in names:
        _check_builtin_tool_name(name)
    return {name: name in names for name in defaults.BUILTIN_TOOL_NAMES}


def _check_caching(value: object) -> None:
    """Raise unless ``value`` is a ``caching`` setting: ``"auto"``, a bool, or ``None``."""
    if value is None or isinstance(value, bool) or value == "auto":
        return
    raise ValueError(f"caching must be 'auto', True, False, or None, got {value!r}; pass False to turn it off.")


def _session_config(value: bool | SessionConfig | SessionManager | None) -> SessionConfig | SessionManager | None:
    """Normalize ``session`` to a ``SessionConfig`` (on), a ``SessionManager`` (used verbatim) or ``None`` (off)."""
    if value is None or value is False:
        return None
    if value is True:
        return {}
    if isinstance(value, SessionManager):
        return value
    shape = "a bool, a SessionConfig mapping, a SessionManager instance, or None"
    if isinstance(value, str):
        raise ValueError(
            f'session must be {shape}, not a string ({value!r}); "auto" is no longer a value, the default is True.'
        )
    if not isinstance(value, Mapping):
        raise ValueError(f"session must be {shape}, got {value!r}.")
    unknown = sorted(str(key) for key in value if key not in {"id", "dir"})
    if unknown:
        raise ValueError(f"session contains unknown keys: {', '.join(unknown)}. Allowed: dir, id.")
    for key in ("id", "dir"):
        if key in value and not isinstance(value[key], str):
            raise ValueError(f"session[{key!r}] must be a str, got {value[key]!r}.")
        if key in value and not value[key].strip():
            raise ValueError(f"session.{key} must be a non-empty s
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #4750** (2026-09-30): **fix(site): prevent header nav overflow at laptop widths**
  *Symptoms*: ## Human Overview <!-- If an AI agent drafted this PR, a human must give a short overview here in their own words. An AI agent MUST NOT fill out this section.      See team/AI_USAGE_POLICY.md. (50 words) -->  ## Description  The site header overflows at common laptop widths. The full bar (300px logo column, 40px link gaps, full-size search pill and star count) needs about 1410px, but it only collapsed to the hamburger below 50rem (800px). Between those widths, `justify-content: space-between` has no minimum gap, so "Blog" butts against the search pill and the theme toggle ends up off screen. At a 1024px viewport, for example, the toggle rendered at x=1368.  Changes in `site/src/components/Navigation.astro`:  - Adds a 32px minimum gap between the left and right clusters. - `≤ 90rem`: narrower logo column and tighter link and right-cluster gaps. - `≤ 86rem`: 16px link labels, icon-only search, and no GitHub star count. - `< 78rem`: collapses to the hamburger menu, which already includes search, the language toggle, theme, GitHub, and Discord. The mobile-only header sizing (auto height, smaller wordmark) stays at Starlight's 50rem breakpoint, so the 84px bar height and the docs sidebar are unchanged between 50rem and 78rem.  ## Related Issues  N/A. Reported via screenshot: Blog and the search bar crowd together at 100% zoom, and the theme switcher is off screen.  ## Type of Change  Bug fix  ## Testing  Ran the dev server and measured with Playwright on `/` and `/docs/` at 390, 8
  **Post-Mortem & Fix Analysis**:
  > ## Documentation Preview Ready  Your documentation preview has been successfully deployed!  **Preview URL**: https://d3ehv1nix5p99z.cloudfront.net/pr-cms-4750/docs/user-guide/quickstart/overview/  _Updated at: 2026-09-30T19:13:40.438Z_
  > **Assessment**: Approve  Clean, focused CSS-only fix. The media-query split is done correctly: the hamburger and the full mobile panel now activate together at 78rem, so there are no orphaned panel styles, and the mobile-only header sizing correctly stays at 50rem. Breakpoint math (90rem=1440, 86rem=1376, 78rem cutoff=1247px) matches the described behavior, the cascade order is right, and the base `gap: 32px` acts only as a minimum so wide-viewport layouts are unaffected.  <details> <summary>Review notes</summary>  - **Correctness**: Verified the panel still positions correctly in the new 50rem–78rem band because the JS derives `top` from `getBoundingClientRect().bottom` rather than a hardcoded height — the 84px bar is handled. No bug. - **Maintainability (minor)**: The panel-positioning comments still describe the header as only 52px/40px; they now understate the range (84px bar between 50–78rem). See inline suggestion. - **Testing**: No automated coverage, but `site/test/` has no vis

- **Issue #4724** (2026-09-30): **fix(gemini): tolerate missing usage metadata on final response**
  *Symptoms*: Fixes #4721.  ## Problem  Gemini sometimes sends a complete final response without usage metadata. Strands finishes the answer, then tries to read token counts from an object that is not there and crashes.  ## Fix  One condition: `if event` becomes `if event and event.usage_metadata is not None`. If the counts object is absent, the stream finishes normally without inventing a zero count. If the object exists with empty counts, existing behavior is unchanged. No change to token calculations, finish reasons, formatting, requests, or provider calls.  ## Tests  Three cases use real google.genai GenerateContentResponse objects parsed from JSON: two omitted-usage cases (STOP and SAFETY finish reasons) checking preserved answer text, expected stop reason, normal completed iteration, and no invented metadata; one empty-but-present usage object case protecting existing zero-count behavior. The client's response source is mocked only through the existing test fixture; the actual editable-checkout GeminiModel.stream and formatter run normally.  Before: 2 failed, 1 passed (the focused 3 cases). After: the full existing + new test_gemini.py passes, 78 tests in 1.22s. Python 3.10.12, pytest 9.1.1. Ruff check/format and git diff --check clean. No API requests, credentials, models, GPU, or broader integration-suite runs are claimed.  Credit: @abdes reported the issue.  Prepared with AI assistance (Instinct assisted).
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/strands-agents/harness-sdk/pull/4724?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=strands-agents) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)
  > Thanks for the review.

- **Issue #4721** (2026-09-30): **[BUG] GeminiModel raises AttributeError when the usageMetadata object is absent**
  *Symptoms*: ### Human Overview  Absent Gemini Usage Metadata Raises AttributeError  ### Summary  A typed Gemini text response with `finishReason: STOP` and no optional `usageMetadata` object yields `end_turn`, then raises `AttributeError` while formatting metadata.  ### Environment  - SDK: Python; `strands-agents==1.57.1` (latest PyPI release checked 2026-09-30). - Runtime: Python 3.12.14; Windows 11, build 26200. - Installation: published PyPI package in an isolated environment; SDK source unmodified. - Reproduction: deterministic local fixtures, no API key or network calls required.  ### Steps to Reproduce  The injected client returns a real `GenerateContentResponse` parsed from JSON with the entire `usageMetadata` property omitted. It contains text and a positive `STOP` finish reason. Only the client's response source is mocked; the installed `GeminiModel.stream()` and formatter run unchanged.  Install in a fresh Python 3.12 virtual environment:  ```sh python -m pip install "strands-agents[gemini]==1.57.1" "google-genai==2.25.0" "pydantic==2.13.5" ```  Save the following as `repro_001.py` and run `python repro_001.py`.  <details> <summary>Complete runnable reproduction</summary>  ```python import asyncio from types import SimpleNamespace from unittest.mock import AsyncMock  from google.genai import types from strands.models.gemini import GeminiModel   async def response_stream():     yield types.GenerateContentResponse.model_validate({         

- **Issue #4706** (2026-09-29): **fix(models): skip location-source documents in OpenAIResponsesModel message formatting**
  *Symptoms*: ## Description  `OpenAIResponsesModel` reads `document["source"]["bytes"]` unconditionally in `_format_request_message_content`, so a document whose source is a location (for example an S3 URI) raises `KeyError: 'bytes'` instead of being skipped with a warning. Every other provider has gated this case since #1572 with the shared `_has_location_source` helper; the Responses provider never got the gate.  This change adds the same check to `_format_request_messages`: content blocks with a location source are skipped with the warning "Location sources are not supported by OpenAI Responses | skipping content block", matching the behavior of the other eight providers.  Scope note: this PR covers the message path only, as reported in #4016. The tool-result path (`_format_request_tool_message`) has the same unguarded read but is tracked separately in #4018 and is not changed here. #3582 widens `DocumentSource` further (text/content variants), which makes this gate more relevant; it does not overlap with this change.  Thanks to @strandly-the-agent for the report.  ## Related Issues  Fixes #4016  Related: #1572, #4018, #3582  ## Documentation PR  No documentation changes needed. This brings the provider in line with the behavior the other providers already have.  ## Type of Change  Bug fix  ## Testing  - Reproduced the issue's script on current main: `KeyError: 'bytes'`. With the fix, the location-source document is skipped with a warning and the request formats normally; a document-on
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/strands-agents/harness-sdk/pull/4706?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=strands-agents) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)

- **Issue #4699** (2026-09-29): **fix(context-manager): keep stashed originals when backfilling after session resume**
  *Symptoms*: ## Description  Resuming a session undoes context offloading. When an agent uses a ContextManager preset (`"auto"`/`"agentic"`) with a `SnapshotSessionManager`, `retrieve_context` can no longer return a truncated tool result in full after a restart. On restore, the stash correctly holds the originals, but `agent.messages` holds their truncated previews. The one-time stash backfill on the first model call then re-stashes those previews under the same deterministic keys, overwriting the originals. The next snapshot save makes the loss permanent. This happens with both the inline stash (default `InMemoryStorage`, embedded in the snapshot) and a durable `Agent(storage=...)`.  Backfill now writes only keys the stash doesn't already hold. It checks each key with a read before writing. That costs about the same as `main`, where backfill already wrote every key, and a failed check skips only its own block rather than overwriting it. `Agent(messages=[...])` with an empty stash and restores from snapshots without stash data behave as before. The live `MessageAddedEvent` path is unchanged. TypeScript has no backfill step and is unaffected.  One behavior to be aware of: when a guardrail redacts a tool result in history, the stash has always kept the pre-redaction content; the old overwrite-on-resume incidentally replaced it with the redacted text after a restart, and that no longer happens. Proper handling (redaction updating the stash) is a separate change.  ## Related Issues 
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/strands-agents/harness-sdk/pull/4699?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=strands-agents) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)
  > **Assessment**: Comment (approve with minor follow-ups)  Correct, well-scoped fix for the resume-overwrites-originals bug. The `keep_existing` guard is threaded cleanly and the live/`MessageAddedEvent` path is unchanged (default `False`). Test coverage is strong: whole-shape `take_snapshot` equality assertions plus a parametrized inline/durable end-to-end resume test. All 147 tests in the affected modules pass locally.  <details> <summary>Review notes</summary>  - **Performance**: The existence check reads the full blob to test presence; on durable backends this GETs large objects in full at resume. Non-blocking, but consider a lighter check (see inline). - **Behavior change**: Guardrail-redacted results now stay retrievable across resumes — please link a tracking issue for the proper redaction-updates-stash fix (see inline). - **Robustness**: Skip-on-read-error during backfill is a sensible fail-safe but can drop genuinely-new blocks; worth a clarifying comment (see inline). - **Cover

- **Issue #4694** (2026-09-29): **fix(models): add context window limits for Sonnet 5.5, Opus 5.5, Fable 5.1 (py + ts)**
  *Symptoms*: ## Description  `_CONTEXT_WINDOW_LIMITS` (Python) and `CONTEXT_WINDOW_LIMITS` (TypeScript) have `claude-sonnet-5`, `claude-opus-5` and `claude-fable-5`, but not their current-generation successors, so `get_context_window_limit` / `getContextWindowLimit` return `None` / `undefined` for `claude-sonnet-5-5`, `claude-opus-5-5` and `claude-fable-5-1`.  An unknown limit is not inert. Callers fall back to a default, which disables proactive compression and makes `estimate_utilization` report a figure computed against the wrong window — the `0.75` @surecloud-jleite saw for a 150k-token conversation, where `0.15` is correct on a 1M-context model.  All three have a 1M context window, matching the `-5` entries already in both tables.  ## Reproduction  Before:  ``` global.anthropic.claude-sonnet-5-5       -> None global.anthropic.claude-opus-5-5         -> None global.anthropic.claude-fable-5-1        -> None global.anthropic.claude-sonnet-5         -> 1000000   <- already worked ```  After, all four return `1000000`.  ## Scope  Six entries in each SDK: three direct-API IDs and their three Bedrock base IDs.  - `strands-py/src/strands/models/_defaults.py` - `strands-ts/src/models/defaults.ts`  The cross-region prefixes needed no change — `us.`, `global.` and `eu.` were already stripped correctly in both SDKs, which the `claude-sonnet-5` row above confirms. The only defect was the missing table rows, so that is all this touches.  `claude-mythos-5-1` is deliberately not added: it is restric
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/strands-agents/harness-sdk/pull/4694?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=strands-agents) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)
  > **Issue**: The fix is Python-only, but issue #4692 explicitly calls out the same gap in `strands-ts/src/models/defaults.ts` ("`strands-ts/src/models/defaults.ts` has the same gap"). That table still has `claude-opus-5` / `claude-fable-5` / `claude-sonnet-5` (and their `anthropic.` Bedrock IDs) but is missing the `-5-5` / `-5-1` successors — so TypeScript users still get `None` and the wrong utilization. `team/COMPATIBILITY.md` states the policy applies to both SDKs, and the two tables are maintained in lockstep.  Since the PR body says `Fixes #4692`, merging will auto-close the issue while the TS half of the reported bug remains.  **Suggestion**: Add the same six entries to `strands-ts/src/models/defaults.ts` (with matching TS tests) in this PR. If you'd rather keep the PR Python-only, drop the `Fixes #4692` keyword (use "Refs #4692") and note in the description that TS is tracked separately, so the issue isn't closed prematurely.
  > **Assessment**: Comment  The Python change is correct, minimal, and consistent with the existing `-5` rows (all 1M), with well-scoped tests that mirror the file's conventions and cover direct, Bedrock, and cross-region-prefixed forms. The one substantive gap is cross-SDK parity.  <details> <summary>Review Categories</summary>  - **Correctness / SDK parity (Important)**: Fix applied only to `strands-py`; the TypeScript `defaults.ts` still has the same missing rows that issue #4692 explicitly names. With `Fixes #4692` present, merging closes the issue while TS remains broken. See inline comment. - **Code quality**: Table additions follow existing naming and value conventions; no concerns. - **Testing**: Good coverage of the new IDs and the prefix-strip path; per-input assertions are appropriate here.  </details>  Nicely scoped fix with a clear repro and mutation-checked test — resolving the TS parity (or adjusting the close-keyword) is the only thing standing between this and approval.

- **Issue #4693** (2026-09-30): **fix(bedrock): skip guardContent wrap for blank text**
  *Symptoms*: ## Description  `_format_bedrock_messages` wraps the last user text block in `guardContent` when `guardrail_latest_message=True`. The wrap is unconditional, so blank or whitespace-only text becomes:  ```json {"guardContent": {"text": {"text": ""}}} ```  which Bedrock rejects:  ``` ValidationException: The guard content field in the ContentBlock object at messages.0.content.0 is blank ```  `GuardrailConverseTextBlock.text` declares no minimum length in the service model, so botocore cannot catch this client-side — the request fails at the service.  As @bsolomon1124 notes in #4602, a blank block is reachable in ordinary use: a zero-argument tool invoked through `as_tool()` hands the sub-agent an empty initial prompt, which becomes a `{"text": ""}` content block.  ## Change  Skip the wrap when the text is blank, and log, rather than failing the request — there is nothing to screen. This mirrors the **sibling image branch two lines below**, which already skips the wrap and warns when the image format is unsupported by guardrails.  I chose "leave it unwrapped" over "substitute a placeholder" because a placeholder would put text in front of the guardrail that the caller never sent.  ## Reproduction  Before, via `format_request`:  ``` blank empty        -> {"guardContent": {"text": {"text": ""}}} whitespace only    -> {"guardContent": {"text": {"text": "   \n "}}} normal             -> {"guardContent": {"text": {"text": "hello"}}} ```  After:  ``` blank empty        -> {"text": ""} 
  **Post-Mortem & Fix Analysis**:
  > @liramon2 Fair — trimmed to one line in 922f972:  ```python # Bedrock rejects a blank guardContent block, and there is nothing to screen. ```  I had put the full error string and the `as_tool()` repro path in there; both belong in the PR description rather than the source, and they are already in it.  306 tests still pass, ruff check and format clean. 
  > ## [Codecov](https://app.codecov.io/gh/strands-agents/harness-sdk/pull/4693?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=strands-agents) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)

- **Issue #4692** (2026-09-29): **[BUG] Context window limit unknown for Claude Sonnet 5.5, Opus 5.5 and Fable 5.1**
  *Symptoms*: ## Checks  - [x] I have updated to the lastest minor and patch version of Strands - [x] I have checked the documentation and this is not expected behavior - [x] I have searched ./issues and there are no duplicates of my issue  ## SDK Language  Python  ## Strands Version  1.57.1  ## Language Runtime Version  Python 3.13.13  ## Operating System  macOS  ## Installation Method  pip (via uv)  ## Steps to Reproduce  ```python from strands.models import BedrockModel  for model_id in [     "global.anthropic.claude-sonnet-5-5",     "global.anthropic.claude-opus-5-5",     "global.anthropic.claude-fable-5-1",     "global.anthropic.claude-sonnet-5", ]:     model = BedrockModel(model_id=model_id, region_name="us-east-2")     print(model_id, model.context_window_limit, model.estimate_utilization(150_000)) ```  ## Expected Behavior  All four models have a 1M token context window, so each should resolve `context_window_limit` to `1000000` and report a utilization of `0.15`.  ## Actual Behavior  ``` global.anthropic.claude-sonnet-5-5 None 0.75 global.anthropic.claude-opus-5-5 None 0.75 global.anthropic.claude-fable-5-1 None 0.75 global.anthropic.claude-sonnet-5 1000000 0.15 ```  plus the `context_window_limit not set on model, using default` warning.  `_CONTEXT_WINDOW_LIMITS` in `strands/models/_defaults.py` has no entry for Claude Sonnet 5.5, Claude Opus 5.5 or Claude Fable 5.1, under either the Bedrock (`anthropic.claude-...`) or the Anthropic API (`claude-...`) IDs. `strands-ts/src/models/

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

### Incident Patch 1: `bc1cf509` (2026-09-30)
**Commit Message**: fix(site): prevent header nav overflow at laptop widths (#4750)

Co-authored-by: Timothy Moreton <tmoreton@amazon.com>

**File**: `site/src/components/Navigation.astro` (modified, +52/-0)
```diff
@@ -316,6 +316,8 @@ const learnCategories = [
        logo down. */
     height: 84px;
     padding: 0 39px;
+    /* Keeps the right cluster from butting against the last link. */
+    gap: 32px;
   }
 
   .strands-nav__left {
@@ -340,6 +342,53 @@ const learnCategories = [
     }
   }
 
+  /* Tighten spacing where the full-size bar would overflow, before the
+     hamburger takes over. */
+  @media (max-width: 90rem) {
+    .strands-nav__left {
+      grid-template-columns: 250px auto;
+      gap: 32px;
+    }
+
+    .strands-nav__links {
+      gap: 28px;
+    }
+
+    .strands-nav__right {
+      gap: 16px;
+    }
+  }
+
+  @media (max-width: 86rem) {
+    .strands-nav__left {
+      grid-template-columns: 235px auto;
+      gap: 20px;
+    }
+
+    .strands-nav__links {
+      gap: 20px;
+    }
+
+    .strands-nav__right {
+      gap: 12px;
+    }
+
+    .strands-nav__links a,
+    .strands-nav__trigger {
+      font-size: 16px;
+      letter-spacing: 0.5px;
+    }
+
+    .strands-nav__search {
+      padding: 6px 8px;
+    }
+
+    .strands-nav__search-label,
+    .strands-nav__github-stars {
+      display: none;
+    }
+  }
+
   .strands-nav__logo {
     position: relative;
     display: flex;
@@ -632,7 +681,10 @@ const learnCategories = [
     .strands-nav__wordmark :global(svg) {
       height: 21px;
     }
+  }
 
+  /* ---------- Collapsed (< 78rem, where the full bar no longer fits) ---------- */
+  @media (max-width: 77.9375rem) {
     /* Desktop-only links + right cluster hide. */
     .strands-nav__links,
     .strands-nav__right {
```

---

### Incident Patch 2: `4cbc6a78` (2026-09-30)
**Commit Message**: fix(gemini): tolerate missing usage metadata on final response (#4724)

Co-authored-by: Charan Rathore <charan-rathore@users.noreply.github.com>

**File**: `strands-py/src/strands/models/gemini.py` (modified, +1/-1)
```diff
@@ -677,7 +677,7 @@ async def stream(
                     "data": "TOOL_USE" if tool_used else (candidate.finish_reason if candidate else "STOP"),
                 }
             )
-            if event:
+            if event and event.usage_metadata is not None:
                 yield self._format_chunk({"chunk_type": "metadata", "data": event.usage_metadata})
 
         except genai.errors.ClientError as error:
```

**File**: `strands-py/tests/strands/models/test_gemini.py` (modified, +45/-0)
```diff
@@ -1753,3 +1753,48 @@ async def test_skip_native_api_by_default(self, gemini_client, messages):
         gemini_client.aio.models.count_tokens.assert_not_called()
         assert isinstance(result, int)
         assert result >= 0
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("finish_reason,stop_reason", [("STOP", "end_turn"), ("SAFETY", "guardrail_intervened")])
+async def test_stream_response_without_usage_metadata(
+    gemini_client, model, messages, agenerator, alist, finish_reason, stop_reason
+):
+    response = genai.types.GenerateContentResponse.model_validate(
+        {
+            "candidates": [
+                {
+                    "content": {"role": "model", "parts": [{"text": "Hello"}]},
+                    "finishReason": finish_reason,
+                }
+            ]
+        }
+    )
+    assert response.usage_metadata is None
+    gemini_client.aio.models.generate_content_stream.return_value = agenerator([response])
+
+    chunks = await alist(model.stream(messages))
+
+    assert {"contentBlockDelta": {"delta": {"text": "Hello"}}} in chunks
+    assert chunks[-1] == {"messageStop": {"stopReason": stop_reason}}
+    assert not any("metadata" in chunk for chunk in chunks)
+
+
+@pytest.mark.asyncio
+async def test_stream_response_empty_usage_metadata_is_preserved(gemini_client, model, messages, agenerator, alist):
+    response = genai.types.GenerateContentResponse.model_validate(
+        {
+            "candidates": [{"content": {"role": "model", "parts": [{"text": "Hello"}]}, "finishReason": "STOP"}],
+            "usageMetadata": {},
+        }
+    )
+    gemini_client.aio.models.generate_content_stream.return_value = agenerator([response])
+
+    chunks = await alist(model.stream(messages))
+
+    assert chunks[-1] == {
+        "metadata": {
+            "usage": {"inputTokens": 0, "outputTokens": 0, "totalTokens": 0},
+            "metrics": {"latencyMs": 0},
+        }
+    }
```

---

### Incident Patch 3: `142a4bc2` (2026-09-30)
**Commit Message**: fix(bedrock): skip guardContent wrap for blank text (#4693)

**File**: `strands-py/src/strands/models/bedrock.py` (modified, +8/-1)
```diff
@@ -866,7 +866,14 @@ def _format_bedrock_messages(self, messages: Messages, dynamic_trailing_blocks:
                 # Bedrock guardContent supports a narrower set of image formats than image content.
                 if idx == last_user_text_idx and ("text" in formatted_content or "image" in formatted_content):
                     if "text" in formatted_content:
-                        formatted_content = {"guardContent": {"text": {"text": formatted_content["text"]}}}
+                        # Bedrock rejects a blank guardContent block, and there is nothing to screen.
+                        if formatted_content["text"].strip():
+                            formatted_content = {"guardContent": {"text": {"text": formatted_content["text"]}}}
+                        else:
+                            logger.warning(
+                                "msg_idx=<%s> | blank text | skipping guardContent wrap",
+                                idx,
+                            )
                     elif "image" in formatted_content:
                         image_format = formatted_content["image"].get("format", "")
                         supported_formats = self.client.meta.service_model.shape_for(
```

**File**: `strands-py/tests/strands/models/test_bedrock.py` (modified, +57/-0)
```diff
@@ -3420,6 +3420,63 @@ async def test_format_request_with_guardrail_latest_message(model):
     assert formatted_messages[2]["content"][1]["guardContent"]["image"]["format"] == "png"
 
 
+@pytest.mark.asyncio
+@pytest.mark.parametrize("blank_text", ["", "   ", "\n", " \t\n "])
+async def test_format_request_guardrail_latest_message_skips_blank_text(model, blank_text):
+    """Blank text must not be wrapped: Bedrock rejects a blank guardContent block."""
+    model.update_config(
+        guardrail_id="test-guardrail",
+        guardrail_version="DRAFT",
+        guardrail_latest_message=True,
+    )
+
+    request = model.format_request([{"role": "user", "content": [{"text": blank_text}]}])
+    content = request["messages"][0]["content"][0]
+
+    assert "guardContent" not in content
+    assert content == {"text": blank_text}
+
+
+@pytest.mark.asyncio
+async def test_format_request_guardrail_latest_message_blank_text_still_wraps_image(model):
+    """A blank text block is skipped without suppressing the guardContent wrap on a sibling image."""
+    model.update_config(
+        guardrail_id="test-guardrail",
+        guardrail_version="DRAFT",
+        guardrail_latest_message=True,
+    )
+
+    messages = [
+        {
+            "role": "user",
+            "content": [
+                {"text": ""},
+                {"image": {"format": "png", "source": {"bytes": b"fake_image_data"}}},
+            ],
+        }
+    ]
+
+    content = model.format_request(messages)["messages"][0]["content"]
+
+    assert content[0] == {"text": ""}
+    assert "guardContent" in content[1]
+
+
+@pytest.mark.asyncio
+async def test_format_request_guardrail_latest_message_wraps_text_with_surrounding_whitespace(model):
+    """Only fully blank text is skipped; padded text is still screened, padding intact."""
+    model.update_config(
+        guardrail_id="test-guardrail",
+        guardrail_version="DRAFT",
+        guardrail_latest_message=True,
+    )
+
+    request = model.format_request([{"role": "user", "content": [{"text": "  hello  "}]}])
+    content = request["messages"][0]["content"][0]
+
+    assert content["guardContent"]["text"]["text"] == "  hello  "
+
+
 @pytest.mark.asyncio
 async def test_format_request_with_guardrail_latest_message_uses_service_model_formats(model):
     """Test that guardContent image formats are read from the botocore service model."""
```

---

### Incident Patch 4: `c73253db` (2026-09-30)
**Commit Message**: fix(harness): remove context offloader plugin from harness in favor of context manager's stash (#4701)

**File**: `harness-py/AGENTS.md` (modified, +1/-1)
```diff
@@ -46,7 +46,7 @@ pytest               # run the test suite
 
 ## Conventions
 
-- **Imports at the top of the file**, never inline within a function, except where a heavy optional dependency must stay lazy. Model providers are imported inside their builder functions in `models.py` so that installing `strands-harness` without a given provider extra still works; keep that pattern. Core `strands` deps (session manager, offloader, skills plugin) are always available, so they're imported at the top of `agent.py` like everything else.
+- **Imports at the top of the file**, never inline within a function, except where a heavy optional dependency must stay lazy. Model providers are imported inside their builder functions in `models.py` so that installing `strands-harness` without a given provider extra still works; keep that pattern. Core `strands` deps (session manager, skills plugin) are always available, so they're imported at the top of `agent.py` like everything else.
 - **Explicit-wins passthrough.** `create_harness(**agent_kwargs)` forwards any unrecognized keyword straight to `Agent`, and an explicit value always takes precedence over the harness default it corresponds to (e.g. a passed `session_manager`, `memory_manager`, or `system_prompt` wins). Preserve this when adding options.
 - **Provider effort config.** `models.py` maps one `effort` level to each provider's own request fields and validates it against that provider's supported levels, so an unsupported level fails in the harness rather than as a downstream request error. Keep the validation local.
 - **Ruff** governs style (line length 120; `E`, `F`, `I`, `UP`, `B`). Config is package-local in `pyproject.toml`, with a shared copy at the repo root.
```

**File**: `harness-py/src/strands_harness/agent.py` (modified, +18/-42)
```diff
@@ -4,7 +4,6 @@
 
 import logging
 import os
-import tempfile
 import uuid
 from collections.abc import Mapping, Sequence
 from typing import Any, Literal
@@ -18,7 +17,6 @@
 from strands.storage import LocalFileStorage
 from strands.tools.mcp import MCPClient, MCPServerConfig
 from strands.types.tools import AgentTool
-from strands.vended_plugins.context_offloader import ContextOffloader, FileStorage
 from strands.vended_plugins.skills import AgentSkills, SkillSources
 from strands.vended_tools import make_shell
 
@@ -63,18 +61,15 @@
 
 logger = logging.getLogger(__name__)
 
-# Built-in plugins, each toggled by name via ``builtin_plugins``. Unlike the offloader and skills
-# plugins (wired from their own options), these are opt-out feature plugins that only bundle a tool
-# and a loop-level behavior; the map is the seam to grow the set (e.g. memories) later.
+# Built-in plugins, each toggled by name via ``builtin_plugins``. Unlike the skills plugin (wired from
+# its own option), these are opt-out feature plugins that only bundle a tool and a loop-level
+# behavior; the map is the seam to grow the set (e.g. memories) later.
 _BUILTIN_PLUGINS = {"todos": Todos, "environment": EnvironmentContext}
 
 # The delegation tool always runs in the background: its calls are long-running subtasks whose
 # intermediate work should stay out of the parent's turn.
 _ALWAYS_BACKGROUND_TOOL_NAMES = frozenset({"subagent"})
 
-_AUTO_MAX_RESULT_TOKENS = 1_500
-_AUTO_PREVIEW_TOKENS = 750
-
 # Sentinel for ``caching``: distinguishes "not passed" (the default, which warns on an unsupported
 # provider) from an explicit value like ``caching=None`` (off) or ``caching=True`` (which raises on
 # an unsupported provider string, and only warns when the model is a ``Model`` instance).
@@ -140,18 +135,6 @@ def _web_search_mode(
     return None
 
 
-def _durable_offloader(offload_dir: str) -> Any:
-    return ContextOffloader(
-        storage=FileStorage(offload_dir),
-        max_result_tokens=_AUTO_MAX_RESULT_TOKENS,
-        preview_tokens=_AUTO_PREVIEW_TOKENS,
-    )
-
-
-def _has_offloader(plugins: list[Any]) -> bool:
-    return any(isinstance(p, ContextOffloader) for p in plugins)
-
-
 def _skills_plugin(skills: bool | SkillSources | AgentSkills | None) -> AgentSkills | None:
     """The skills plugin for ``skills``: the default dir when present (``True``), the sources named
     (passed through untouched; the SDK reports a missing path), or the instance verbatim."""
@@ -295,8 +278,8 @@ def create_harness(
             left off that axis.
         plugins: Consumer SDK plugins, added alongside the built-in plugins (consumer plugins run
             first). Tools a plugin vends take part in the name-collision check, and the plugins reach
-            ``subagent`` children too. A ``ContextOffloader`` or ``AgentSkills`` passed here replaces
-            the one the harness would add. Plugin *instances* are shared with children, so one that keeps
+            ``subagent`` children too. An ``AgentSkills`` passed here replaces the one the harness
+            would add. Plugin *instances* are shared with children, so one that keeps
             per-agent state must keep it in ``agent.state`` (the SDK convention), not on ``self``.
         mcp_servers: MCP servers to connect, given as the standard ``mcpServers`` config: either a
             path to a JSON file or the mapping itself (a flat ``{name: {...}}`` map, or that map under
@@ -351,14 +334,15 @@ def create_harness(
             value raises.
         context_manager: The SDK's ``Agent(context_manager=)`` option: ``"auto"`` (the default) or
             ``"agentic"`` for an SDK preset, a ``ContextManagerConfig`` dict or a ``ContextManager``
-            instance for a custom pipeline, or ``False``/``None`` to disable it. When enabled, large
-            tool results are also offloaded to disk (a preview and reference are kept in context) so
-            the agent can run longer before compacting; disa
```

**File**: `harness-py/src/strands_harness/tools/programmatic_tool_caller.py` (modified, +2/-5)
```diff
@@ -58,10 +58,6 @@
 # Cap on the text returned to the model; a runaway ``print`` should not blow up the context window.
 _MAX_OUTPUT_CHARS = 200_000
 
-# ``invocation_state`` key the SDK's ``ContextOffloader`` honours (``SKIP_CONTEXT_OFFLOAD_KEY``). Inner results
-# are consumed by the guest code, not the model, so a preview in place of the data would break it.
-_SKIP_CONTEXT_OFFLOAD_KEY = "strands:skip_context_offload"
-
 # Wall-clock ceiling for a run, tool calls included.
 _DEFAULT_TIMEOUT = 900.0
 _CANCEL_POLL_INTERVAL = 0.05
@@ -173,7 +169,8 @@ async def _execute_tool(tool_context: ToolContext, tool_name: str, tool_input: d
         "input": tool_input,
     }
     tool_results: list[ToolResult] = []
-    invocation_state = {**tool_context.invocation_state, _SKIP_CONTEXT_OFFLOAD_KEY: True}
+    # A copy, so an inner call cannot change the parent's invocation state.
+    invocation_state = {**tool_context.invocation_state}
     try:
         async for event in ToolExecutor._stream(agent, tool_use, tool_results, invocation_state):
             if isinstance(event, ToolInterruptEvent):
```

**File**: `harness-py/tests/test_agent.py` (modified, +118/-43)
```diff
@@ -1,6 +1,6 @@
+import json
 import logging
 import re
-import tempfile
 import textwrap
 from pathlib import Path
 from unittest.mock import MagicMock
@@ -11,12 +11,11 @@
 from strands.experimental.context_manager import ContextManager
 from strands.hooks import BeforeModelCallEvent
 from strands.memory import MemoryManager
-from strands.models import BedrockModel, CacheConfig, ModelRouter
+from strands.models import BedrockModel, CacheConfig, Model, ModelRouter
 from strands.sandbox.docker import DockerSandbox
 from strands.session import SnapshotSessionManager
-from strands.storage import LocalFileStorage
+from strands.storage import InMemoryStorage, LocalFileStorage
 from strands.vended_memory_stores.file_memory_store import FileMemoryStore
-from strands.vended_plugins.context_offloader import ContextOffloader, FileStorage
 from strands.vended_plugins.skills import AgentSkills
 from strands.vended_tools.file_editor import make_file_editor
 from strands.vended_tools.shell import make_shell
@@ -38,14 +37,6 @@ def _context_managed(agent: Agent) -> bool:
     )
 
 
-def _offloaders(agent: Agent) -> list[ContextOffloader]:
-    return [p for p in agent._plugin_registry._plugins.values() if isinstance(p, ContextOffloader)]
-
-
-def _offload_dir(offloader: ContextOffloader) -> str:
-    return str(offloader._storage._artifact_dir)
-
-
 def _skills(agent: Agent) -> list[AgentSkills]:
     return [p for p in agent._plugin_registry._plugins.values() if isinstance(p, AgentSkills)]
 
@@ -72,6 +63,61 @@ def sample_tool(x: str) -> str:
     return x
 
 
+_LARGE_RESULT = "\n".join(f"Line {line_index}: quarterly budget notes." for line_index in range(400))
+
+
+@tool
+def read_large() -> str:
+    """Read a large document."""
+    return _LARGE_RESULT
+
+
+class _RetrievingModel(Model):
+    """Calls ``read_large``, then ``retrieve_context`` on the stash reference it gets back, recording each
+    tool result."""
+
+    def __init__(self) -> None:
+        self.seen_tool_results: list[str] = []
+        self._config = {"model_id": "retrieving-model", "context_window_limit": 1_000_000}
+
+    def update_config(self, **model_config):
+        self._config.update(model_config)
+
+    def get_config(self):
+        return self._config
+
+    async def structured_output(self, output_model, prompt, system_prompt=None, **kwargs):
+        raise NotImplementedError
+        yield
+
+    async def stream(self, messages, tool_specs=None, system_prompt=None, **kwargs):
+        tool_results = [block["toolResult"] for block in messages[-1]["content"] if "toolResult" in block]
+        if not tool_results:
+            for event in self._tool_use("read_large", {}):
+                yield event
+            return
+        result_text = "\n".join(item.get("text") or json.dumps(item.get("json")) for item in tool_results[0]["content"])
+        self.seen_tool_results.append(result_text)
+        reference = re.search(r"\[ref: ([^\]\s]+)\]", result_text)
+        if len(self.seen_tool_results) == 1 and reference:
+            for event in self._tool_use("retrieve_context", {"reference": reference.group(1)}):
+                yield event
+            return
+        yield {"messageStart": {"role": "assistant"}}
+        yield {"contentBlockStart": {"start": {}}}
+        yield {"contentBlockDelta": {"delta": {"text": "done"}}}
+        yield {"contentBlockStop": {}}
+        yield {"messageStop": {"stopReason": "end_turn"}}
+
+    def _tool_use(self, name, tool_input):
+        tool_use_id = f"tooluse-{len(self.seen_tool_results)}"
+        yield {"messageStart": {"role": "assistant"}}
+        yield {"contentBlockStart": {"start": {"toolUse": {"name": name, "toolUseId": tool_use_id}}}}
+        yield {"contentBlockDelta": {"delta": {"toolUse": {"input": json.dumps(tool_input)}}}}
+        yield {"contentBlockStop": {}}
+        yield {"messageStop": {"stopReason": "tool_use"}}
+
+
 def test_defaults():
     agent = create_harness()
     assert isinstance
```

**File**: `harness-py/tests/tools/test_programmatic_tool_caller.py` (modified, +3/-8)
```diff
@@ -25,7 +25,6 @@
 from strands_harness.tools.programmatic_tool_caller import (
     _MAX_CONCURRENT_TOOL_CALLS,
     _MAX_OUTPUT_CHARS,
-    _SKIP_CONTEXT_OFFLOAD_KEY,
     DEFAULT_PROGRAMMATIC_TOOL_CALLER_DESCRIPTION,
     _Output,
     _unwrap_result,
@@ -179,13 +178,11 @@ def whoami(label: str, tool_context: ToolContext) -> str:
     assert seen[0]["principal"] == "alice"
 
 
-def test_inner_calls_opt_out_of_context_offloading_without_touching_the_parent_state():
-    seen = []
-
+def test_inner_calls_do_not_change_the_parent_state():
     @tool(context="tool_context")
     def whoami(tool_context: ToolContext) -> str:
-        """Record the invocation state the inner call ran with."""
-        seen.append(dict(tool_context.invocation_state))
+        """Write to the invocation state the inner call ran with."""
+        tool_context.invocation_state["written_by_inner_call"] = True
         return "ok"
 
     parent_state = {"principal": "alice"}
@@ -196,8 +193,6 @@ def whoami(tool_context: ToolContext) -> str:
     )
     result = asyncio.run(programmatic_tool_caller._tool_func(code="print(await whoami())", tool_context=context))
     assert _text(result) == "ok"
-    # The inner call opts out; the parent's own result must still be eligible for offloading.
-    assert seen[0][_SKIP_CONTEXT_OFFLOAD_KEY] is True
     assert parent_state == {"principal": "alice"}
 
 
```

---

### Incident Patch 5: `db34d016` (2026-09-29)
**Commit Message**: fix(context-manager): keep stashed originals when backfilling after session resume (#4699)

**File**: `strands-py/src/strands/_context_manager/context_manager.py` (modified, +3/-1)
```diff
@@ -250,14 +250,16 @@ async def _backfill_stash(self, agent: Agent) -> None:
         """Stash any messages already on the agent that were not seen by the hook.
 
         Covers Agent(messages=[...]) and session restore, which bypass MessageAddedEvent.
+        Existing entries are kept: after a restore the stash holds the originals, while the
+        matching messages on the agent may already be offloaded previews.
         """
         if self._backfill_done or self._stash is None:
             return
         self._backfill_done = True
         skip = frozenset(self._retrieval_tool_use_ids)
         for message in agent.messages:
             try:
-                await self._stash.store_message(message, skip)
+                await self._stash.store_message(message, skip, keep_existing=True)
             except Exception:
                 logger.warning("agent_id=<%s> | failed to backfill stash", agent.agent_id, exc_info=True)
 
```

**File**: `strands-py/src/strands/_context_manager/stash.py` (modified, +24/-8)
```diff
@@ -67,9 +67,14 @@ def storage_type_name(self) -> str:
         """Name of the base storage class, for diagnostic logging."""
         return type(self._base_storage).__name__
 
-    async def store(self, block_id: str, block_index: int, data: bytes) -> str:
-        """Store a content block and return its deterministic reference key."""
+    async def store(self, block_id: str, block_index: int, data: bytes, *, keep_existing: bool = False) -> str:
+        """Store a content block and return its deterministic reference key.
+
+        With ``keep_existing``, an entry already stored under the key is left untouched.
+        """
         key = f"{block_id}_{block_index}"
+        if keep_existing and await self._storage.read(key) is not None:
+            return key
         await self._storage.write(key, data)
         return key
 
@@ -80,19 +85,30 @@ def refs_for(self, block: ContentBlock, message: Message, block_index: int) -> l
             return [f"{tool_result['toolUseId']}_{index}" for index in range(len(tool_result["content"]))]
         return [f"{message.get('tracking_id', 'unknown')}_{block_index}"]
 
-    async def store_message(self, message: Message, skip_tool_use_ids: frozenset[str] | None = None) -> None:
-        """Eagerly persist all stashable blocks from a message."""
+    async def store_message(
+        self,
+        message: Message,
+        skip_tool_use_ids: frozenset[str] | None = None,
+        *,
+        keep_existing: bool = False,
+    ) -> None:
+        """Eagerly persist all stashable blocks from a message.
+
+        With ``keep_existing``, entries already stored under a block's key are left untouched.
+        """
         for block_index, block in enumerate(message["content"]):
             if "toolResult" in block:
                 tool_result = block["toolResult"]
                 if skip_tool_use_ids and tool_result["toolUseId"] in skip_tool_use_ids:
                     continue
-                await self._store_tool_result(block)
+                await self._store_tool_result(block, keep_existing=keep_existing)
             elif "toolUse" in block or "reasoningContent" in block or "cachePoint" in block:
                 continue
             else:
                 try:
-                    await self.store(message.get("tracking_id", "unknown"), block_index, _encode(block))
+                    await self.store(
+                        message.get("tracking_id", "unknown"), block_index, _encode(block), keep_existing=keep_existing
+                    )
                 except Exception:
                     logger.warning(
                         "tracking_id=<%s>, block_index=<%s> | failed to stash block",
@@ -158,12 +174,12 @@ async def clear_session(self) -> None:
         for key in keys:
             await self._base_storage.delete(key)
 
-    async def _store_tool_result(self, block: ContentBlock) -> None:
+    async def _store_tool_result(self, block: ContentBlock, *, keep_existing: bool = False) -> None:
         """Store each sub-block of a tool result individually."""
         tool_result = block["toolResult"]
         for block_index, item in enumerate(tool_result["content"]):
             try:
-                await self.store(tool_result["toolUseId"], block_index, _encode(item))
+                await self.store(tool_result["toolUseId"], block_index, _encode(item), keep_existing=keep_existing)
             except Exception:
                 logger.warning(
                     "tool_use_id=<%s>, block_index=<%s> | failed to stash sub-block",
```

**File**: `strands-py/tests/strands/_context_manager/test_context_manager.py` (modified, +30/-0)
```diff
@@ -361,6 +361,36 @@ async def test_backfills_pre_existing_messages_on_first_strategy_run(self):
         assert result is not None
         assert result["text"] == "pre-existing result"
 
+    @pytest.mark.asyncio
+    async def test_backfill_does_not_overwrite_existing_stash_entries(self, mock_agent):
+        """A restored stash holds originals while restored messages hold their previews; the originals win."""
+        mock_agent.session_id = "test-session"
+        mock_agent.storage = None
+        mock_agent.messages = [
+            Message(role="user", content=[ContentBlock(text="seed message")], tracking_id="seed"),
+            Message(
+                role="user",
+                content=[
+                    ContentBlock(
+                        toolResult=ToolResult(
+                            toolUseId="pre-tu-1",
+                            status="success",
+                            content=[{"text": "[Truncated: 1 block, ~7,500 tokens] preview"}],
+                        )
+                    )
+                ],
+            ),
+        ]
+        cm = ContextManager(strategies=[], stash=True)
+        cm.init_agent(mock_agent)
+        await cm.stash.load_snapshot({"pre-tu-1_0": {"text": "original full result"}})
+
+        event = BeforeModelCallEvent(agent=mock_agent, projected_input_tokens=100)
+        await mock_agent.hooks.invoke_callbacks_async(event)
+
+        assert await cm.stash.retrieve("pre-tu-1_0") == {"text": "original full result"}
+        assert await cm.stash.retrieve("seed_0") == {"text": "seed message"}
+
     @pytest.mark.asyncio
     async def test_backfill_runs_only_once(self):
         agent = unittest.mock.MagicMock()
```

**File**: `strands-py/tests/strands/_context_manager/test_stash.py` (modified, +40/-0)
```diff
@@ -165,6 +165,34 @@ async def test_skips_tool_results_in_skip_set(self, stash):
         result = await stash.retrieve("tu-skip_0")
         assert result is None
 
+    @pytest.mark.asyncio
+    async def test_keep_existing_leaves_stored_entries_untouched(self, stash):
+        await stash.load_snapshot({"tu-1_0": {"text": "original result"}, "track-1_1": {"text": "original text"}})
+        message = Message(
+            role="user",
+            content=[
+                ContentBlock(
+                    toolResult=ToolResult(
+                        toolUseId="tu-1",
+                        status="success",
+                        content=[{"text": "preview result"}, {"text": "second result"}],
+                    )
+                ),
+                ContentBlock(text="preview text"),
+            ],
+            tracking_id="track-1",
+        )
+
+        await stash.store_message(message, keep_existing=True)
+
+        tru_entries = await stash.take_snapshot()
+        exp_entries = {
+            "tu-1_0": {"text": "original result"},
+            "tu-1_1": {"text": "second result"},
+            "track-1_1": {"text": "original text"},
+        }
+        assert tru_entries == exp_entries
+
 
 class TestNamespacing:
     """Tests for storage namespace isolation."""
@@ -239,6 +267,18 @@ async def test_logs_warning_on_tool_result_sub_block_store_failure(self):
         message = Message(role="user", content=[block])
         await stash.store_message(message)
 
+    @pytest.mark.asyncio
+    async def test_keep_existing_does_not_write_when_existence_check_fails(self):
+        stash = Stash(InMemoryStorage(), "s", "a")
+        stash._storage.read = unittest.mock.AsyncMock(side_effect=RuntimeError("read failed"))
+        stash._storage.write = unittest.mock.AsyncMock()
+        block = ContentBlock(text="hello")
+        message = Message(role="assistant", content=[block], tracking_id="track-1")
+
+        await stash.store_message(message, keep_existing=True)
+
+        stash._storage.write.assert_not_called()
+
 
 class TestStorageTypeName:
     """Tests for storage_type_name property."""
```

**File**: `strands-py/tests/strands/session/test_snapshot_session_manager.py` (modified, +70/-0)
```diff
@@ -9,6 +9,7 @@
 
 import pytest
 
+from strands import tool
 from strands._context_manager.context_manager import ContextManager
 from strands.agent import AgentResult
 from strands.agent.agent import Agent
@@ -63,6 +64,15 @@ def _on_disk_key(session_id: str, agent_id: str) -> str:
     return f"session/{_snapshot_key(session_id, agent_id, snapshot_id=None)}"
 
 
+def _tool_result_text(agent, tool_use_id: str) -> str:
+    """The text of the tool result for ``tool_use_id`` in an agent's history."""
+    for message in agent.messages:
+        for content in message["content"]:
+            if content.get("toolResult", {}).get("toolUseId") == tool_use_id:
+                return content["toolResult"]["content"][0]["text"]
+    raise AssertionError(f"no tool result for {tool_use_id}")
+
+
 def _texts(agent) -> list[str]:
     """Flatten an agent's message text content, for asserting which turns are present."""
     return [content["text"] for message in agent.messages for content in message["content"] if "text" in content]
@@ -1306,3 +1316,63 @@ async def test_ephemeral_detection_survives_namespacing(self, storage):
         raw = await storage.read(key)
         snapshot_data = json.loads(raw)
         assert snapshot_data["data"]["stash"]["location"] == "inline"
+
+    @pytest.mark.parametrize("stash_mode", ["inline", "durable"])
+    def test_resume_keeps_original_of_truncated_tool_result_retrievable(self, storage, stash_mode):
+        """After a resume, retrieve_context returns the full original of a tool result truncated before the restart."""
+        full_result = "full tool result " * 2_000
+
+        @tool
+        def fetch_result() -> str:
+            """Return a large result."""
+            return full_result
+
+        def build_agent(model):
+            storage_options = {"storage": storage} if stash_mode == "durable" else {}
+            return Agent(
+                model=model,
+                tools=[fetch_result],
+                context_manager="auto",
+                session_manager=SnapshotSessionManager("s1", storage=storage),
+                agent_id="a1",
+                callback_handler=None,
+                **storage_options,
+            )
+
+        first_agent = build_agent(
+            MockedModelProvider(
+                [
+                    {
+                        "role": "assistant",
+                        "content": [{"toolUse": {"toolUseId": "tu-1", "name": "fetch_result", "input": {}}}],
+                    },
+                    {"role": "assistant", "content": [{"text": "fetched"}]},
+                ]
+            )
+        )
+        first_agent("fetch")
+        assert _tool_result_text(first_agent, "tu-1").startswith("[Truncated:")
+
+        resumed_agent = build_agent(
+            MockedModelProvider(
+                [
+                    {
+                        "role": "assistant",
+                        "content": [
+                            {
+                                "toolUse": {
+                                    "toolUseId": "tu-2",
+                                    "name": "retrieve_context",
+                                    "input": {"reference": "tu-1_0"},
+                                }
+                            }
+                        ],
+                    },
+                    {"role": "assistant", "content": [{"text": "done"}]},
+                ]
+            )
+        )
+        resumed_agent("read it in full")
+
+        assert json.loads(_tool_result_text(resumed_agent, "tu-2")) == {"text": full_result}
+        assert asyncio.run(resumed_agent.context_manager.stash.retrieve("tu-1_0")) == {"text": full_result}
```

---

### Incident Patch 6: `ec2d4108` (2026-09-29)
**Commit Message**: fix(models): skip location-source documents in OpenAIResponsesModel message formatting (#4706)

Co-authored-by: Charan Rathore <charan-rathore@users.noreply.github.com>

**File**: `strands-py/src/strands/models/openai_responses.py` (modified, +13/-6)
```diff
@@ -64,7 +64,7 @@
 from ._openai_bedrock import BedrockMantleConfig, resolve_bedrock_client_args  # noqa: E402
 from ._openai_cache import apply_cache_config  # noqa: E402
 from ._openai_errors import classify_openai_error  # noqa: E402
-from ._validation import validate_config_keys  # noqa: E402
+from ._validation import _has_location_source, validate_config_keys  # noqa: E402
 from .model import BaseModelConfig, CacheConfig, Model  # noqa: E402
 
 logger = logging.getLogger(__name__)
@@ -657,12 +657,19 @@ def _format_request_messages(cls, messages: Messages) -> list[dict[str, Any]]:
             if any("cachePoint" in content for content in contents):
                 logger.warning("cachePoint content block is not supported by OpenAI Responses | skipping")
 
-            formatted_contents = [
-                cls._format_request_message_content(content, role=role)
-                for content in contents
-                if not any(
+            filtered_contents = []
+            for content in contents:
+                if any(
                     block_type in content for block_type in ["toolResult", "toolUse", "reasoningContent", "cachePoint"]
-                )
+                ):
+                    continue
+                if _has_location_source(content):
+                    logger.warning("Location sources are not supported by OpenAI Responses | skipping content block")
+                    continue
+                filtered_contents.append(content)
+
+            formatted_contents = [
+                cls._format_request_message_content(content, role=role) for content in filtered_contents
             ]
 
             formatted_tool_calls = [
```

**File**: `strands-py/tests/strands/models/test_openai_responses.py` (modified, +30/-0)
```diff
@@ -526,6 +526,36 @@ def test_format_request(model, messages, tool_specs, system_prompt):
     assert tru_request == exp_request
 
 
+def test_format_request_filters_location_source_document(model, caplog):
+    """Location-source documents are skipped with a warning instead of raising KeyError.
+
+    Guards against https://github.com/strands-agents/harness-sdk/issues/4016.
+    """
+    caplog.set_level(logging.WARNING, logger="strands.models.openai_responses")
+
+    messages = [
+        {
+            "role": "user",
+            "content": [
+                {"text": "analyze this document"},
+                {
+                    "document": {
+                        "format": "pdf",
+                        "name": "report",
+                        "source": {"location": {"type": "s3", "s3Location": {"uri": "s3://bucket/report.pdf"}}},
+                    }
+                },
+            ],
+        },
+    ]
+
+    request = model._format_request(messages)
+
+    formatted_content = request["input"][0]["content"]
+    assert formatted_content == [{"type": "input_text", "text": "analyze this document"}]
+    assert "Location sources are not supported by OpenAI Responses" in caplog.text
+
+
 def test_cache_key_maps_to_prompt_cache_key(openai_client, model_id, messages):
     _ = openai_client
     model = OpenAIResponsesModel(model_id=model_id, cache_config=CacheConfig(cache_key="tenant-42"))
```

---

### Incident Patch 7: `9299f22b` (2026-09-29)
**Commit Message**: fix(site): correct homepage code-sample copy and rebalance logo wall (#4571)

Co-authored-by: Timothy Moreton <tmoreton@amazon.com>

**File**: `site/src/components/InteractiveToolkit.astro` (modified, +8/-4)
```diff
@@ -1098,11 +1098,15 @@ const cards = [
     .forEach((btn) => {
       attachCopyButton(btn, {
         label: btn.querySelector<HTMLElement>('.toolkit__card-terminal-copy-label'),
-        getText: () =>
-          btn
+        getText: () => {
+          const code = btn
             .closest<HTMLElement>('.toolkit__card-terminal')
-            ?.querySelector<HTMLElement>('.toolkit__card-terminal-code:not([hidden]) code')
-            ?.innerText ?? '',
+            ?.querySelector<HTMLElement>('.toolkit__card-terminal-code:not([hidden]) code');
+          if (!code) return '';
+          return Array.from(code.querySelectorAll<HTMLElement>('.toolkit__card-terminal-line'))
+            .map((line) => line.textContent ?? '')
+            .join('\n');
+        },
         track: {
           surface: 'code:toolkit',
           detail: () =>
```

**File**: `site/src/components/LogoFarm.astro` (modified, +3/-3)
```diff
@@ -13,16 +13,16 @@ import openai from '../assets/logos/openai.svg?raw';
 const row1 = [
   { name: 'Anthropic', svg: anthropic, width: 295.273 },
   { name: 'Google', svg: google, width: 138.154 },
-  { name: 'Writer', svg: writer, width: 111.606 },
+  { name: 'OpenAI', svg: openai, width: 156.671 },
   { name: 'Vercel', svg: vercel, width: 172.242 },
 ];
 
 const row2 = [
   { name: 'Llama', svg: llama, width: 163.04 },
-  { name: 'Mistral', svg: mistral, width: 141.485 },
   // Ollama is icon + wordmark side-by-side (composed inline below).
   { name: 'Ollama', width: 173.824, composed: true },
-  { name: 'OpenAI', svg: openai, width: 156.671 },
+  { name: 'Mistral', svg: mistral, width: 141.485 },
+  { name: 'Writer', svg: writer, width: 111.606 },
 ];
 ---
 
```

**File**: `site/src/components/UseCases.astro` (modified, +7/-2)
```diff
@@ -868,8 +868,13 @@ const useCases = [
     section.querySelectorAll<HTMLButtonElement>('.terminal__copy').forEach((btn) => {
       attachCopyButton(btn, {
         label: btn.querySelector<HTMLElement>('.terminal__copy-label'),
-        getText: () =>
-          section!.querySelector<HTMLElement>('.terminal__code:not([hidden]) code')?.innerText ?? '',
+        getText: () => {
+          const code = section!.querySelector<HTMLElement>('.terminal__code:not([hidden]) code');
+          if (!code) return '';
+          return Array.from(code.querySelectorAll<HTMLElement>('.terminal__line'))
+            .map((line) => line.textContent ?? '')
+            .join('\n');
+        },
         track: { surface: 'code:use-cases', detail: () => currentLang },
       });
     });
```

---

### Incident Patch 8: `0ab57b24` (2026-09-29)
**Commit Message**: fix(models): add context window limits for Sonnet 5.5, Opus 5.5, Fable 5.1 (py + ts) (#4694)

Co-authored-by: Jack Yuan <jackypc@amazon.com>

**File**: `strands-py/src/strands/models/_defaults.py` (modified, +6/-0)
```diff
@@ -42,8 +42,11 @@
     "claude-opus-4-7-20260416": 1_000_000,
     "claude-opus-4-8": 1_000_000,
     "claude-opus-5": 1_000_000,
+    "claude-opus-5-5": 1_000_000,
     "claude-fable-5": 1_000_000,
+    "claude-fable-5-1": 1_000_000,
     "claude-sonnet-5": 1_000_000,
+    "claude-sonnet-5-5": 1_000_000,
     "claude-opus-4-5": 200_000,
     "claude-opus-4-5-20251101": 200_000,
     "claude-opus-4-20250514": 200_000,
@@ -65,8 +68,11 @@
     "anthropic.claude-opus-4-7": 1_000_000,
     "anthropic.claude-opus-4-8": 1_000_000,
     "anthropic.claude-opus-5": 1_000_000,
+    "anthropic.claude-opus-5-5": 1_000_000,
     "anthropic.claude-fable-5": 1_000_000,
+    "anthropic.claude-fable-5-1": 1_000_000,
     "anthropic.claude-sonnet-5": 1_000_000,
+    "anthropic.claude-sonnet-5-5": 1_000_000,
     "anthropic.claude-opus-4-5-20251101-v1:0": 200_000,
     "anthropic.claude-opus-4-20250514-v1:0": 200_000,
     "anthropic.claude-opus-4-1-20250805-v1:0": 200_000,
```

**File**: `strands-py/tests/strands/models/test_defaults.py` (modified, +12/-0)
```diff
@@ -16,6 +16,18 @@ def test_known_bedrock_anthropic(self):
         assert get_context_window_limit("anthropic.claude-sonnet-4-6") == 1_000_000
         assert get_context_window_limit("anthropic.claude-haiku-4-5-20251001-v1:0") == 200_000
 
+    def test_known_anthropic_current_generation(self):
+        # Guards against the 1M-context 5.5 / 5.1 models resolving to None (#4692),
+        # which silently disables proactive compression and reports a wrong utilization.
+        assert get_context_window_limit("claude-sonnet-5-5") == 1_000_000
+        assert get_context_window_limit("claude-opus-5-5") == 1_000_000
+        assert get_context_window_limit("claude-fable-5-1") == 1_000_000
+        assert get_context_window_limit("anthropic.claude-sonnet-5-5") == 1_000_000
+        assert get_context_window_limit("anthropic.claude-opus-5-5") == 1_000_000
+        assert get_context_window_limit("anthropic.claude-fable-5-1") == 1_000_000
+        assert get_context_window_limit("global.anthropic.claude-opus-5-5") == 1_000_000
+        assert get_context_window_limit("us.anthropic.claude-fable-5-1") == 1_000_000
+
     def test_known_bedrock_nova(self):
         assert get_context_window_limit("amazon.nova-pro-v1:0") == 300_000
         assert get_context_window_limit("amazon.nova-micro-v1:0") == 128_000
```

**File**: `strands-ts/src/models/__tests__/defaults.test.ts` (modified, +13/-0)
```diff
@@ -24,6 +24,19 @@ describe('getContextWindowLimit', () => {
     expect(getContextWindowLimit('gemini-2.5-pro')).toBe(1_048_576)
   })
 
+  it('returns 1M for the current-generation Anthropic models', () => {
+    // Guards against the 1M-context 5.5 / 5.1 models resolving to undefined (#4692),
+    // which silently disables proactive compression and reports a wrong utilization.
+    expect(getContextWindowLimit('claude-sonnet-5-5')).toBe(1_000_000)
+    expect(getContextWindowLimit('claude-opus-5-5')).toBe(1_000_000)
+    expect(getContextWindowLimit('claude-fable-5-1')).toBe(1_000_000)
+    expect(getContextWindowLimit('anthropic.claude-sonnet-5-5')).toBe(1_000_000)
+    expect(getContextWindowLimit('anthropic.claude-opus-5-5')).toBe(1_000_000)
+    expect(getContextWindowLimit('anthropic.claude-fable-5-1')).toBe(1_000_000)
+    expect(getContextWindowLimit('global.anthropic.claude-opus-5-5')).toBe(1_000_000)
+    expect(getContextWindowLimit('us.anthropic.claude-fable-5-1')).toBe(1_000_000)
+  })
+
   it('strips Bedrock cross-region prefix before lookup', () => {
     expect(getContextWindowLimit('us.anthropic.claude-sonnet-4-6')).toBe(1_000_000)
     expect(getContextWindowLimit('global.anthropic.claude-sonnet-4-6')).toBe(1_000_000)
```

**File**: `strands-ts/src/models/defaults.ts` (modified, +6/-0)
```diff
@@ -71,8 +71,11 @@ const CONTEXT_WINDOW_LIMITS: Record<string, number> = {
   'claude-opus-4-7-20260416': 1_000_000,
   'claude-opus-4-8': 1_000_000,
   'claude-opus-5': 1_000_000,
+  'claude-opus-5-5': 1_000_000,
   'claude-fable-5': 1_000_000,
+  'claude-fable-5-1': 1_000_000,
   'claude-sonnet-5': 1_000_000,
+  'claude-sonnet-5-5': 1_000_000,
   'claude-opus-4-5': 200_000,
   'claude-opus-4-5-20251101': 200_000,
   'claude-opus-4-20250514': 200_000,
@@ -95,8 +98,11 @@ const CONTEXT_WINDOW_LIMITS: Record<string, number> = {
   'anthropic.claude-opus-4-7': 1_000_000,
   'anthropic.claude-opus-4-8': 1_000_000,
   'anthropic.claude-opus-5': 1_000_000,
+  'anthropic.claude-opus-5-5': 1_000_000,
   'anthropic.claude-fable-5': 1_000_000,
+  'anthropic.claude-fable-5-1': 1_000_000,
   'anthropic.claude-sonnet-5': 1_000_000,
+  'anthropic.claude-sonnet-5-5': 1_000_000,
   'anthropic.claude-opus-4-5-20251101-v1:0': 200_000,
   'anthropic.claude-opus-4-20250514-v1:0': 200_000,
   'anthropic.claude-opus-4-1-20250805-v1:0': 200_000,
```

---

### Incident Patch 9: `51094375` (2026-09-29)
**Commit Message**: fix(strands-ts): format model-facing numbers independently of the host locale (#4682)

Co-authored-by: Shashank Chinchli <schinchli@gitlab.com>

**File**: `strands-ts/docs/TESTING.md` (modified, +12/-0)
```diff
@@ -27,6 +27,7 @@ All test fixtures are located in `src/__fixtures__/`. Use these helpers to reduc
 | `MockMeter`            | `mock-meter.ts`         | Mock OTEL Meter that records all counter/histogram instrument calls for assertion        | [Telemetry Fixtures](#telemetry-fixtures-mock-spants-mock-meterts)          |
 | `expectLoopMetrics()`  | `metrics-helpers.ts`    | Assert on `AgentMetrics` with expected cycle count, tool names, and optional token usage | [Metrics Fixtures](#metrics-fixtures-metrics-helpersts)                     |
 | `findMetricValue()`    | `metrics-helpers.ts`    | Find the latest data point value for a named OTEL metric from ResourceMetrics            | [Metrics Fixtures](#metrics-fixtures-metrics-helpersts)                     |
+| `withDefaultLocale()`  | `locale-helpers.ts`     | Assert model-facing text formats numbers the same under any host locale                  | [Locale Fixtures](#locale-fixtures-locale-helpersts)                        |
 
 ## Test Organization
 
@@ -655,6 +656,17 @@ const duration = findMetricValue(metrics, 'gen_ai.agent.cycle.duration')
 expect(duration).toBeDefined()
 ```
 
+### Locale Fixtures (`locale-helpers.ts`)
+
+- **`withDefaultLocale(locale, fn)`** - Runs `fn` as if the host default locale were `locale`, so a `toLocaleString()` call without an explicit locale formats with it. Use it to prove that text sent to the model does not change with the machine it runs on.
+
+```typescript
+import { withDefaultLocale } from '../../__fixtures__/locale-helpers.js'
+
+const result = await withDefaultLocale('en-IN', () => middleware(context))
+expect(statusBlock.text).toContain('100,000') // not '1,00,000'
+```
+
 ## Multi-Environment Testing
 
 The SDK is designed to work seamlessly in both Node.js and browser environments. Our test suite validates this by running tests in both environments using Vitest's browser mode with Playwright.
```

**File**: `strands-ts/src/__fixtures__/locale-helpers.ts` (added, +25/-0)
```diff
@@ -0,0 +1,25 @@
+/**
+ * Test helpers for asserting that model-facing text does not depend on the host locale.
+ */
+
+import { vi } from 'vitest'
+
+/**
+ * Runs `fn` as if the host's default locale were `locale`, so a `toLocaleString()` call that omits
+ * an explicit locale formats with it (e.g. `'en-IN'` groups 100000 as `1,00,000`).
+ */
+export async function withDefaultLocale<T>(locale: string, fn: () => T | Promise<T>): Promise<T> {
+  const original = Number.prototype.toLocaleString
+  const spy = vi.spyOn(Number.prototype, 'toLocaleString').mockImplementation(function (
+    this: number,
+    locales?: Intl.LocalesArgument,
+    options?: Intl.NumberFormatOptions
+  ) {
+    return original.call(this, locales ?? locale, options)
+  })
+  try {
+    return await fn()
+  } finally {
+    spy.mockRestore()
+  }
+}
```

**File**: `strands-ts/src/context-manager/methods/truncate.ts` (modified, +2/-2)
```diff
@@ -49,11 +49,11 @@ export function buildPreview(fullText: string, blockCount: number, config?: Trun
   const head = fullText.slice(0, headChars)
   const tail = tailChars > 0 ? fullText.slice(-tailChars) : ''
   const elided = totalChars - headChars - tailChars
-  const marker = `[... ${elided.toLocaleString()} chars elided ...]`
+  const marker = `[... ${elided.toLocaleString('en-US')} chars elided ...]`
   const preview = [head, marker, tail].filter(Boolean).join('\n\n')
 
   const result =
-    `${TRUNCATED_PREFIX} ${blockCount} ${blockCount === 1 ? 'block' : 'blocks'}, ~${Math.ceil(totalChars / CHARS_PER_TOKEN).toLocaleString()} tokens]\n\n` +
+    `${TRUNCATED_PREFIX} ${blockCount} ${blockCount === 1 ? 'block' : 'blocks'}, ~${Math.ceil(totalChars / CHARS_PER_TOKEN).toLocaleString('en-US')} tokens]\n\n` +
     preview
 
   if (result.length >= totalChars) {
```

**File**: `strands-ts/src/context-manager/modes/agentic/agentic-context.ts` (modified, +2/-2)
```diff
@@ -193,8 +193,8 @@ export function createTokenUsageMiddleware(): MiddlewareInputHandler<InvokeModel
 
     const statusText =
       `\n\n<context-status>\n` +
-      `<used>${projectedInputTokens.toLocaleString()} / ${contextWindowLimit.toLocaleString()} tokens (${percentUsed}%)</used>\n` +
-      `<remaining>~${remaining.toLocaleString()} tokens</remaining>\n` +
+      `<used>${projectedInputTokens.toLocaleString('en-US')} / ${contextWindowLimit.toLocaleString('en-US')} tokens (${percentUsed}%)</used>\n` +
+      `<remaining>~${remaining.toLocaleString('en-US')} tokens</remaining>\n` +
       `</context-status>`
 
     const messages = [...context.messages]
```

**File**: `strands-ts/src/context-manager/strategies/__tests__/offload-strategy.test.ts` (modified, +15/-0)
```diff
@@ -5,6 +5,7 @@ import { Message, TextBlock, ToolResultBlock, ToolUseBlock } from '../../../type
 import { createMockAgent } from '../../../__fixtures__/agent-helpers.js'
 import type { Agent } from '../../../agent/agent.js'
 import type { ContextState } from '../../types.js'
+import { withDefaultLocale } from '../../../__fixtures__/locale-helpers.js'
 
 function makeToolResultMessage(text: string, toolUseId = 'tool-123'): Message {
   return new Message({
@@ -203,6 +204,20 @@ describe('Offload.truncate', () => {
     expect(previewText).toContain('chars elided')
   })
 
+  // https://github.com/strands-agents/harness-sdk/issues/4681
+  it('formats preview counts the same regardless of the host locale', async () => {
+    const messages = [makeToolResultMessage('x'.repeat(1_000_000))]
+    const strategy = Offload.truncate('toolResults', { previewTokens: 100 })
+    const context = makeContext(messages)
+
+    await withDefaultLocale('en-IN', () => strategy.apply(context))
+
+    const block = messages[0]!.content[0] as ToolResultBlock
+    const previewText = (block.content[0] as TextBlock).text
+    expect(previewText).toContain('~250,000 tokens]')
+    expect(previewText).toContain('[... 999,600 chars elided ...]')
+  })
+
   it('returns false for empty messages', async () => {
     const strategy = Offload.truncate('toolResults')
     const context = makeContext([])
```

---

### Incident Patch 10: `226a0f24` (2026-09-29)
**Commit Message**: fix(bedrock): normalize tool inputs before replay (#4625)

Co-authored-by: 0d00ciallo0721 <0d00ciallo0721@users.noreply.github.com>

**File**: `strands-py/src/strands/models/bedrock.py` (modified, +2/-1)
```diff
@@ -1120,9 +1120,10 @@ def _format_request_message_content(self, content: ContentBlock) -> dict[str, An
         # https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ToolUseBlock.html
         if "toolUse" in content:
             tool_use = content["toolUse"]
+            tool_input = tool_use.get("input")
             return {
                 "toolUse": {
-                    "input": tool_use["input"],
+                    "input": tool_input if isinstance(tool_input, dict) else {},
                     "name": tool_use["name"],
                     "toolUseId": tool_use["toolUseId"],
                 }
```

**File**: `strands-py/tests/strands/models/test_bedrock.py` (modified, +19/-0)
```diff
@@ -2387,6 +2387,25 @@ def test_format_request_message_content_normalizes_empty_tool_result_content(mod
     assert tool_result["content"] == [{"text": ""}], "Empty toolResult content should be normalized to [{'text': ''}]"
 
 
+@pytest.mark.parametrize("tool_input", [None, "", 0, False, [], "invalid", ["value"]])
+def test_format_request_message_content_normalizes_non_dict_tool_use_input(model, tool_input):
+    content = {
+        "toolUse": {
+            "toolUseId": "tool_001",
+            "name": "run_query",
+            "input": tool_input,
+        }
+    }
+
+    assert model._format_request_message_content(content) == {
+        "toolUse": {
+            "input": {},
+            "name": "run_query",
+            "toolUseId": "tool_001",
+        }
+    }
+
+
 def test_format_request_message_content_does_not_mutate_empty_tool_result(model, model_id):
     """Test that normalizing empty toolResult content does not mutate the original messages."""
     messages = [
```

#### Recent Merged Pull Requests:
- **PR #4750** (2026-09-30): fix(site): prevent header nav overflow at laptop widths (@tmoreton)
- **PR #4746** (2026-09-30): refactor(bidi): remove directory tool watching (@pgrayy)
- **PR #4744** (2026-09-30): docs(agents): add note on invocation state (@opieter-aws)
- **PR #4734** (2026-09-30): refactor(bidi): use restart consistently for connection restarts (@mehtarac)
- **PR #4732** (2026-09-30): docs(bidi): add session management and interrupt status pages (@pgrayy)
- **PR #4728** (2026-09-30): refactor(bidi): correct docstrings and drop unused barge-in and connection stop reasons (@mehtarac)
- **PR #4724** (2026-09-30): fix(gemini): tolerate missing usage metadata on final response (@charan-rathore)
- **PR #4708** (2026-09-29): refactor(bidi): make tool execution internals private (@pgrayy)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

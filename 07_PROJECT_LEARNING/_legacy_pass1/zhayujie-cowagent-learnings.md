# Forensic Learning Record (Deep Inspection): zhayujie/CowAgent

> **Canonical Artifact**: `07_PROJECT_LEARNING/zhayujie-cowagent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/zhayujie/CowAgent](https://github.com/zhayujie/CowAgent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T14:02:35.930Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `zhayujie/CowAgent`
- **Description**: Open-source personal AI assistant & Agent Harness. Plans tasks, runs tools and skills, self-evolves with memory and knowledge. Multi-agent, multi-model, multi-channel. Lightweight, extensible, one-line install.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 47184 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agent/admin.py`
```
"""Safe configuration and core-file management for agent workspaces."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import tempfile
import threading
import time
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, Optional

from agent import team
from agent.registry import AgentProfile, AgentRegistry
from common.log import logger
from common.utils import expand_path


CORE_FILES = ("AGENT.md", "USER.md", "RULE.md", "MEMORY.md", "BOOTSTRAP.md")
MAX_CORE_FILE_BYTES = 1024 * 1024

# What a cloned Agent starts from: how it behaves, not what it knows.
# MEMORY.md is excluded because it is what the source Agent learned about its
# user, and .env, the session database and the shared asset directories are
# excluded because copying them would fork credentials, hand one Agent another's
# conversations, and put the skill library into N places that then drift.
CLONED_FILES = ("AGENT.md", "USER.md", "RULE.md", "BOOTSTRAP.md")

# The keys this service owns. Anything else in the settings it is handed
# belongs to another console page and is never written from here.
ROSTER_KEYS = team.TEAM_KEYS
_UNSET = object()


class AgentAdminError(ValueError):
    pass


class StaleAgentFileError(AgentAdminError):
    pass


class StaleRosterError(AgentAdminError):
    """Raised when the roster changed between the caller's read and its write."""


def _revision(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _roster_revision(settings: Mapping) -> str:
    """Revision over the Agent-owned slice of the config only.

    Scoped rather than whole-file so that saving an unrelated setting from
    another page does not invalidate an Agents page that is merely open, while
    two concurrent roster edits still conflict.
    """
    scoped = {key: settings.get(key) for key in ROSTER_KEYS}
    return _revision(
        json.dumps(scoped, sort_keys=True, ensure_ascii=False, default=str).encode("utf-8")
    )


def _is_strictly_within(inner: Path, outer: Path) -> bool:
    if inner == outer:
        return False
    try:
        inner.relative_to(outer)
    except ValueError:
        return False
    return True


class AgentAdminService:
    """Manage profiles without ever deleting an agent workspace implicitly."""

    def __init__(self, config_path: str, settings: Optional[Mapping] = None):
        self.config_path = Path(config_path)
        self._settings = dict(settings) if settings is not None else None
        self._lock = threading.RLock()

    def _load(self) -> Dict:
        """Deployment settings with the roster overlaid on top.

        Callers want one mapping to hand to ``AgentRegistry.from_config``, and
        should not have to know that the two halves come from different files.
        """
        if self._settings is not None:
            return team.resolve(self._settings)
        if not self.config_path.exists():
            return {}
        # utf-8-sig tolerates a UTF-8 BOM (e.g. config.json edited with Windows
        # Notepad / PowerShell). Plain utf-8 raises "Unexpected UTF-8 BOM" here,
        # which surfaces as a failed /api/agents snapshot and an empty team page.
        with self.config_path.open("r", encoding="utf-8-sig") as handle:
            data = json.load(handle)
        if not isinstance(data, dict):
            raise AgentAdminError("config root must be an object")
        # Values injected via environment at startup never reach config.json.
        from config import conf

        live = conf()
        for key in ("default_agent_name", "default_agent_description"):
            if not data.get(key) and live.get(key):
                data[key] = live[key]
        return team.resolve(data)

    def _write(self, settings: Dict) -> None:
        """Persist the roster. ``config.json`` is not touched beyond retiring it.

        Only the roster keys are ever ours to write (``_commit`` enforces it),
        so the rest of ``settings`` is here to say where the file goes.
        """
        stored = dict(settings)
        if stored.get("agents"):
            stored["agents"] = team.compact(
                stored["agents"], settings, stored.get("default_agent_id") or ""
            )
        team.write(settings, stored)
        team.retire_legacy(self.config_path if self._settings is None else None)
        if self._settings is not None:
            self._settings = {
                key: value
                for key, value in settings.items()
                if key not in team.TEAM_KEYS
            }

    def _commit(self, updates: Mapping, revision: Optional[str] = None) -> Dict:
        """Apply the roster keys onto whatever is stored right now.

        Writing back a whole snapshot taken before the edit would drop any
        change another page made in between, so only the owned keys are written,
        and they are applied to a fresh read rather than to that snapshot.
        """
        current = self._load()
        if revision is not None and _roster_revision(current) != revision:
            raise StaleRosterError(
                "the Agent list changed since it was loaded; refresh before saving"
            )
        for key in updates:
            if key not in ROSTER_KEYS:
                raise AgentAdminError(f"refusing to write unowned config key: {key}")
        merged = dict(current)
        merged.update(updates)
        self._write(merged)
        return merged

    @staticmethod
    def _registry(settings: Mapping) -> AgentRegistry:
        return AgentRegistry.from_config(settings)

    @staticmethod
    def _explicit_profiles(settings: Dict, registry: AgentRegistry) -> list:
        raw_agents = settings.get("agents")
        if raw_agents:
            return [dict(item) for item in raw_agents]
        return [registry.get().to_dict()]

    @staticmethod
    def _instance_root(settings: Mapping) -> Path:
        return Path(
            AgentAdminService._normalise_workspace(
                settings.get("agent_workspace") or "~/cow"
            )
        )

    def snapshot(self) -> Dict:
        with self._lock:
            settings = self._load()
            registry = self._registry(settings)
            default_id = registry.default_agent_id
            agents = []
            for profile in registry.list():
                data = profile.to_dict()
                # Whether this Agent reads the shared knowledge base or its own,
                # derived from the workspace so the UI can show the toggle state.
                data["knowledge_mode"] = self._knowledge_mode_of(profile, default_id)
                agents.append(data)
            return {
                "default_agent_id": default_id,
                "agents": agents,
                "channel_instances": list(settings.get("channel_instances") or []),
                "revision": _roster_revision(settings),
            }

    @staticmethod
    def _knowledge_mode_of(profile: AgentProfile, default_id: str) -> str:
        if profile.id == default_id:
            return "shared"
        kdir = profile.workspace_path / "knowledge"
        if kdir.is_dir() and not kdir.is_symlink():
            return "own"
        return "shared"

    @staticmethod
    def _normalise_workspace(workspace: str) -> str:
        if not isinstance(workspace, str) or not workspace.strip():
            raise AgentAdminError("workspace is required")
        return str(Path(expand_path(workspace.strip())).resolve(strict=False))

    @staticmethod
    def _bootstrap_workspace(workspace: str) -> None:
        """Create only what belongs to this Agent alone.

        Deliberately does not create ``skills/`` or ``knowledge/``: an Agent opts
        out of the shared copy by *having* that directory, so creating them empty
        would cut every new Agent off from all installed skills and knowledge.
        ``ensure_workspace`` already scaffolds those through ``state_dir``, which
        lands 
```

### Core Architecture Module: `agent/chat/__init__.py`
```
from agent.chat.service import ChatService

__all__ = ["ChatService"]

```

### Core Architecture Module: `agent/chat/service.py`
```
"""
ChatService - Wraps the Agent stream execution to produce CHAT protocol chunks.

Translates agent events (message_update, message_end, tool_execution_end, etc.)
into the CHAT socket protocol format (content chunks with segment_id, tool_calls chunks).
"""

import re
import uuid
from typing import Callable, Optional

from common.log import logger


class ChatService:
    """
    High-level service that runs an Agent for a given query and streams
    the results as CHAT protocol chunks via a callback.

    Usage:
        svc = ChatService(agent_bridge)
        svc.run(query, session_id, send_chunk_fn)
    """

    def __init__(self, agent_bridge):
        """
        :param agent_bridge: AgentBridge instance (manages agent lifecycle)
        """
        self.agent_bridge = agent_bridge

    def run(
        self,
        query: str,
        session_id: str,
        send_chunk_fn: Callable[[dict], None],
        channel_type: str = "",
        agent_id: str = None,
        request_id: str = None,  # noqa: RUF013
        speaker_agent_id: str = None,
        members: list = None,
        transcript: list = None,
    ):
        """
        Run the agent for *query* and stream results back via *send_chunk_fn*.

        The method blocks until the agent finishes. After it returns the SDK
        will automatically send the final (streaming=false) message.

        :param query: user query text
        :param session_id: session identifier for agent isolation
        :param send_chunk_fn: callable(chunk_data: dict) to send a streaming chunk
        :param channel_type: source channel (e.g. "web", "feishu") for persistence
        :param agent_id: agent that owns the conversation; defaults to the configured default
        :param request_id: per-request cancellation key; defaults to session scope
        :param speaker_agent_id: teammate addressed for this turn; it answers in
            the owner's conversation, so the transcript stays in one place
        :param members: roster of the conversation (teammate ids). When given it
            is authoritative and reconciled onto the session, like a team channel
        :param transcript: attributed messages to run against instead of the
            restored history (conversation kept elsewhere)
        """
        # The conversation belongs to ``resolved_agent_id`` (its owner); only the
        # voice answering this turn may differ. Same model as agent_reply.
        resolved_agent_id = self.agent_bridge._resolve_agent_id(agent_id)

        # Build a context so context-aware tools (e.g. scheduler) can resolve the
        # receiver/session. This streaming path bypasses agent_bridge.agent_reply,
        # so the attach step that normally happens there must be done here too.
        context = self._build_context(
            query, session_id, channel_type, resolved_agent_id
        )
        speaker_id = resolved_agent_id
        model_query = query
        is_team = False
        cached = False
        if speaker_agent_id or members is not None:
            if members is not None:
                context["members"] = list(members)
            if speaker_agent_id:
                context["speaker_agent_id"] = speaker_agent_id
            self.agent_bridge._seed_team_members(session_id, resolved_agent_id, context)
            peer_speaker = self._peer_speaker(speaker_agent_id, resolved_agent_id)
            if peer_speaker is not None:
                self._run_on_peer(
                    query, session_id, channel_type, resolved_agent_id,
                    peer_speaker, send_chunk_fn,
                )
                return
            speaker_id = self.agent_bridge._resolve_speaker(resolved_agent_id, context)
            is_team = speaker_id != resolved_agent_id or self._has_team(session_id, resolved_agent_id)
            if speaker_agent_id:
                # What the model is asked once the address has been acted on
                # (also when the owner itself was named); the transcript keeps
                # the verbatim query.
                model_query = self.agent_bridge._strip_address(query, speaker_id)
            cached = self.agent_bridge._has_runtime(speaker_id, session_id)
            agent = self.agent_bridge.get_agent(
                session_id=session_id,
                agent_id=speaker_id,
                host_agent_id=resolved_agent_id,
            )
        else:
            agent = self.agent_bridge.get_agent(
                session_id=session_id, agent_id=resolved_agent_id
            )
        if agent is None:
            raise RuntimeError("Failed to initialise agent for the session")
        if is_team:
            # One transcript per team conversation: reload it with author labels
            # so this speaker sees the turns others spoke since it last ran. A
            # runtime built for this turn has only just restored it.
            if cached:
                self.agent_bridge._sync_shared_transcript(agent, session_id, resolved_agent_id)
            self._send_speaker(send_chunk_fn, speaker_id)
        if transcript is not None:
            with agent.messages_lock:
                agent.messages = list(transcript)

        # Pass context metadata to model for downstream API requests
        if hasattr(agent, 'model'):
            agent.model.channel_type = channel_type or ""
            agent.model.session_id = session_id or ""
            agent.model.agent_id = speaker_id

        self._attach_context_aware_tools(agent, context)

        # Mark this session as mid-run so the self-evolution idle scan does not
        # fire concurrently when a single turn runs longer than idle_minutes.
        self._mark_run_active(agent, True)

        # State shared between the event callback and this method
        state = _StreamState()

        from agent.protocol.step_writer import StepWriter

        # The store is the owner's: a guest speaker writes into the shared
        # transcript, stamped as author.
        def write_run_messages(messages: list):
            workspace_root = agent.workspace_dir
            if is_team:
                messages = self.agent_bridge._attribute_to_speaker(messages, speaker_id)
                messages = self.agent_bridge._strip_speaker_prefix_from_messages(messages)
                workspace_root = self._owner_workspace(resolved_agent_id, agent)
            # Only the first chunk carries the run's query.
            if model_query != query and not writer.started:
                messages = self._restore_verbatim_query(messages, model_query, query)
            self._persist_messages(
                session_id, list(messages), channel_type, workspace_root=workspace_root,
            )

        writer = StepWriter(write_run_messages)

        def flush_file_links():
            """Emit any buffered file links as content, then drop them."""
            if not state.pending_file_links:
                return
            links = state.pending_file_links
            state.pending_file_links = []
            send_chunk_fn({
                "chunk_type": "content",
                "delta": "\n\n" + "\n\n".join(links) + "\n\n",
                "segment_id": state.segment_id,
            })

        def on_event(event: dict):
            """Translate agent events into CHAT protocol chunks."""
            event_type = event.get("type")
            data = event.get("data", {})

            if event_type == "reasoning_update":
                delta = data.get("delta", "")
                if delta:
                    send_chunk_fn({
                        "chunk_type": "reasoning",
                        "delta": delta,
                        "segment_id": state.segment_id,
                    })

            elif event_type == "message_update":
                # Incremental text delta
                delta = data.get("delta", "")
                if delta:
                    send_chunk_fn({
                        "chunk_type": "content",
        
```

### Core Architecture Module: `agent/chat/session_service.py`
```
"""
SessionService - Manages multi-session lifecycle for both web channel and cloud client.

Provides a unified interface for listing, deleting, renaming, clearing context,
and generating AI titles for conversation sessions. Backed by ConversationStore
(SQLite) and AgentBridge (in-memory agent instances).
"""

import json
import os
import re
from typing import Optional

from common.log import logger


def _truncate_fallback_title(user_message: str, max_len: int = 30) -> str:
    """Pick the first non-empty line of the user message and truncate it."""
    if not user_message:
        return "New Chat"
    first_line = ""
    for line in user_message.splitlines():
        line = line.strip()
        if line:
            first_line = line
            break
    if not first_line:
        return "New Chat"
    if len(first_line) > max_len:
        first_line = first_line[:max_len].rstrip() + "..."
    return first_line


def generate_session_title(user_message: str, assistant_reply: str = "",
                            session_id: str = "") -> str:
    """
    Generate a short session title by calling the current bot's reply_text.
    Falls back to the first line of the user message if the LLM call fails
    or returns an obvious error sentinel.
    """
    fallback = _truncate_fallback_title(user_message)
    try:
        from bridge.bridge import Bridge
        from models.session_manager import Session
        bot = Bridge().get_bot("chat")

        prompt_parts = [f"User: {user_message[:300]}"]
        if assistant_reply:
            prompt_parts.append(f"Assistant: {assistant_reply[:300]}")

        session = Session(session_id or "__title_gen__", system_prompt="")
        session.messages = [
            {"role": "user", "content": (
                "Generate a very short title (max 15 characters for Chinese, max 6 words for English) "
                "summarizing this conversation. Return ONLY the title text, nothing else.\n\n"
                + "\n".join(prompt_parts)
            )}
        ]

        result = bot.reply_text(session) or {}
        # When bots fail (network error, auth error, rate limit, etc.) they
        # typically return completion_tokens=0 with a sentinel content like
        # "请再问我一次吧" / "我现在有点累了". Treat that as failure.
        completion_tokens = result.get("completion_tokens", 0) or 0
        raw = (result.get("content") or "").strip()
        if completion_tokens <= 0:
            logger.warning(
                f"[SessionService] Title generation got empty completion "
                f"(completion_tokens={completion_tokens}, content='{raw[:50]}'), "
                f"using fallback")
            return fallback

        title = re.sub(r'<think>.*?</think>', '', raw, flags=re.DOTALL).strip().strip('"\'')
        logger.info(f"[SessionService] Title generation result: '{title}' (len={len(title)})")
        if title and len(title) <= 50:
            return title
    except Exception as e:
        logger.warning(f"[SessionService] Title generation failed: {e}")
    return fallback


# Built-in fallback config, used when prompts.json is missing or broken.
_DEFAULT_OPTIMIZE_CONFIG = {
    "role": "你是一个「提示词优化专家」。你的唯一任务是：把 <user_prompt> 标签里的用户原始指令，改写成一条更清晰、更具体、更容易让大模型准确执行的提示词。",
    "principles": [
        {"guideline": "你不需要、也不能回答或执行 <user_prompt> 里的内容，只能对它进行改写优化。"},
        {"guideline": "优化时补全缺失的关键信息维度，可用占位符或引导式提问的方式让指令更完整。"},
        {"guideline": "修正口语化表达、网络俚语、碎片化短句，语句通顺严谨。"},
        {"guideline": "保留原文全部核心信息、逻辑与关键观点，不增删原意。"},
        {"guideline": "句式规整、逻辑层次清晰，行文正式得体，适配和大模型沟通的严谨行文风格。"},
        {"guideline": "不使用夸张情绪化措辞，客观中立，段落排版整洁。"},
    ],
    "output_format": "只输出优化后的提示词本身，不要输出任何解释、说明、前后缀或对话。",
    "input_wrapper": "<user_prompt>\n{user_prompt}\n</user_prompt>\n\n优化后的提示词：",
}


def _assemble_optimize_prompt(config: dict) -> str:
    """
    Assemble a full prompt template string from a structured config dict.

    Recognized keys (with backward-compatible aliases):
      - role
      - principles / rules: list of dicts, each with guideline / instruction
      - output_format
      - input_wrapper / input_template: must contain the {user_prompt} placeholder
    """
    parts = []

    role = (config.get('role') or '').strip()
    if role:
        parts.append(role)
        parts.append('')

    # Accept both "principles" (current) and "rules" (legacy) as the list key.
    rules = config.get('principles')
    if not isinstance(rules, list):
        rules = config.get('rules')
    if isinstance(rules, list) and rules:
        parts.append('严格遵守以下规则：')
        idx = 1
        for rule in rules:
            if not isinstance(rule, dict):
                continue
            # Accept both "guideline" (current) and "instruction" (legacy).
            text = (rule.get('guideline') or rule.get('instruction') or '').strip()
            if text:
                parts.append(f'{idx}. {text}')
                idx += 1
        parts.append('')

    output_fmt = (config.get('output_format') or '').strip()
    if output_fmt:
        parts.append(output_fmt)
        parts.append('')

    # Accept both "input_wrapper" (current) and "input_template" (legacy).
    input_tpl = (config.get('input_wrapper') or config.get('input_template') or '').strip()
    # Ensure the wrapper contains the placeholder, otherwise the user input
    # would be dropped entirely.
    if '{user_prompt}' not in input_tpl:
        input_tpl = '<user_prompt>\n{user_prompt}\n</user_prompt>'
    parts.append(input_tpl)

    return '\n'.join(parts).strip()


def _load_optimize_prompt_template() -> str:
    """
    Load optimization rules from agent/chat/prompts.json and assemble them
    into a complete prompt template.

    The prompts.json file defines a structured rule set:
      - role: the AI persona description
      - principles: list of optimization rules (each with a guideline)
      - output_format: constraint on how the AI should output
      - input_wrapper: wraps the user's input with the {user_prompt} placeholder

    Users can add, remove, or edit rules in prompts.json and the changes
    take effect immediately on the next call — no restart needed.

    Falls back to a built-in structured template if the file is missing,
    broken, or produces an empty result.
    """
    template_path = os.path.join(os.path.dirname(__file__), 'prompts.json')
    try:
        with open(template_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        config = data.get('optimize_prompt')
        if isinstance(config, dict):
            assembled = _assemble_optimize_prompt(config)
            if assembled:
                logger.info('[SessionService] Assembled optimize prompt from prompts.json')
                return assembled
        elif isinstance(config, str):
            # Backward-compatible: old flat string format.
            template = config.strip()
            if template:
                logger.info('[SessionService] Loaded optimize prompt (legacy flat format)')
                return template
    except Exception as e:
        logger.warning(f'[SessionService] Failed to load optimize prompt template: {e}')

    logger.info('[SessionService] Using built-in fallback optimize prompt')
    return _assemble_optimize_prompt(_DEFAULT_OPTIMIZE_CONFIG)


def optimize_prompt(user_input: str, context_messages: list = None) -> str:
    """
    Optimize a user's colloquial input into a structured AI-ready instruction.

    Calls the current chat model with a fixed optimization system prompt.
    Falls back to the original input if the model call fails or returns empty.

    :param user_input: the raw user message to optimize
    :param context_messages: optional list of recent conversation messages for context
    :return: optimized instruction text
    """
    fallback = user_input.strip()
    if not fallback:
        return ""

    try:
        from bridge.bridge import Bridge
        from models.session_manager import Session
        bot =
```

### Core Architecture Module: `agent/evolution/__init__.py`
```
"""
Self-evolution subsystem for CowAgent.

Runs a lightweight, isolated review pass after a conversation goes idle to
decide whether anything is worth durably learning (memory / skill) or whether
an unfinished task can be pushed forward. Conservative by design: most
conversations should produce no change at all.

Public entry points:
    from agent.evolution import get_evolution_config
    from agent.evolution.trigger import start_evolution_trigger, note_user_turn
"""

from agent.evolution.config import EvolutionConfig, get_evolution_config

__all__ = [
    "EvolutionConfig",
    "get_evolution_config",
]

```

### Core Architecture Module: `agent/evolution/backup.py`
```
"""File backup / rollback support for self-evolution.

Before the evolution agent edits MEMORY.md or a skill file, we snapshot the
current state into ``memory/.evolution_backups/<backup_id>/`` so a later "undo"
can restore it. File-level restore only — simple and reliable.
"""

from __future__ import annotations

import json
import shutil
import time
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from common.log import logger

_BACKUP_DIRNAME = ".evolution_backups"
_MANIFEST_NAME = "manifest.json"
# Keep only the most recent N backups to bound disk usage.
_MAX_BACKUPS = 10


def _backups_root(workspace_dir: Path) -> Path:
    return Path(workspace_dir) / "memory" / _BACKUP_DIRNAME


def create_backup(workspace_dir: Path, files: List[Path]) -> Optional[str]:
    """Snapshot ``files`` (those that exist) under a new backup id.

    Returns the backup_id, or None when there is nothing to back up.
    """
    existing = [Path(f) for f in files if Path(f).exists()]
    if not existing:
        return None

    backup_id = datetime.now().strftime("%Y%m%d-%H%M%S-") + str(int(time.time() * 1000) % 1000)
    root = _backups_root(workspace_dir)
    target = root / backup_id
    try:
        target.mkdir(parents=True, exist_ok=True)
        ws = Path(workspace_dir)
        manifest = []
        for idx, src in enumerate(existing):
            # Store under a flat index plus the relative path so restore knows
            # where it came from, even for nested skill files.
            try:
                rel = str(src.relative_to(ws))
            except ValueError:
                rel = src.name
            dst = target / f"{idx}.bak"
            shutil.copy2(src, dst)
            manifest.append({"rel": rel, "bak": f"{idx}.bak"})
        (target / _MANIFEST_NAME).write_text(
            json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        _prune_old_backups(root)
        # Caller logs a combined backup+review line; keep this at debug.
        logger.debug(f"[Evolution] Created backup {backup_id} ({len(manifest)} file(s))")
        return backup_id
    except Exception as e:
        logger.warning(f"[Evolution] Failed to create backup: {e}")
        return None


def restore_backup(workspace_dir: Path, backup_id: str) -> bool:
    """Restore all files captured under ``backup_id``. Returns success."""
    if not backup_id:
        return False
    target = _backups_root(workspace_dir) / backup_id
    manifest_path = target / _MANIFEST_NAME
    if not manifest_path.exists():
        logger.warning(f"[Evolution] Backup not found: {backup_id}")
        return False
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        ws = Path(workspace_dir)
        for entry in manifest:
            bak = target / entry["bak"]
            dst = ws / entry["rel"]
            if bak.exists():
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(bak, dst)
        logger.info(f"[Evolution] Restored backup {backup_id} ({len(manifest)} file(s))")
        return True
    except Exception as e:
        logger.warning(f"[Evolution] Failed to restore backup {backup_id}: {e}")
        return False


def _prune_old_backups(root: Path) -> None:
    """Drop the oldest backups beyond _MAX_BACKUPS (sorted by name = chronological)."""
    try:
        dirs = sorted(
            [d for d in root.iterdir() if d.is_dir()],
            key=lambda p: p.name,
        )
        for old in dirs[:-_MAX_BACKUPS]:
            shutil.rmtree(old, ignore_errors=True)
    except Exception as e:
        logger.debug(f"[Evolution] Backup prune skipped: {e}")

```

### Core Architecture Module: `agent/evolution/config.py`
```
"""Configuration for the self-evolution subsystem.

Reads flat ``self_evolution_*`` keys from config.json. All fields have safe
defaults so the feature degrades gracefully when keys are absent.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


# Defaults — conservative (see executor module docstring). Only reached when
# config.json cannot be read at all; the effective default lives in config.py.
DEFAULT_ENABLED = True
DEFAULT_IDLE_MINUTES = 10
DEFAULT_MIN_TURNS = 6
# Max review steps for the isolated evolution agent. Kept small (not exposed as
# config): the review is meant to be cheap and focused, not a long autonomous run.
DEFAULT_MAX_STEPS = 12


@dataclass
class EvolutionConfig:
    """Resolved self-evolution settings."""

    enabled: bool = DEFAULT_ENABLED
    idle_minutes: int = DEFAULT_IDLE_MINUTES
    min_turns: int = DEFAULT_MIN_TURNS
    max_steps: int = DEFAULT_MAX_STEPS

    @property
    def idle_seconds(self) -> int:
        return max(60, self.idle_minutes * 60)


def _as_bool(value: Any, fallback: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        v = value.strip().lower()
        if v in ("true", "1", "yes", "on"):
            return True
        if v in ("false", "0", "no", "off"):
            return False
    return fallback


def _as_pos_int(value: Any, fallback: int) -> int:
    try:
        n = int(value)
        return n if n > 0 else fallback
    except (TypeError, ValueError):
        return fallback


def get_evolution_config() -> EvolutionConfig:
    """Build EvolutionConfig from the live config.json ``self_evolution_*`` keys."""
    try:
        from config import conf
        c = conf()
    except Exception:
        c = {}

    def _get(key, default):
        try:
            return c.get(key, default)
        except Exception:
            return default

    return EvolutionConfig(
        enabled=_as_bool(_get("self_evolution_enabled", None), DEFAULT_ENABLED),
        idle_minutes=_as_pos_int(_get("self_evolution_idle_minutes", None), DEFAULT_IDLE_MINUTES),
        min_turns=_as_pos_int(_get("self_evolution_min_turns", None), DEFAULT_MIN_TURNS),
        max_steps=DEFAULT_MAX_STEPS,
    )

```

### Core Architecture Module: `agent/evolution/executor.py`
```
"""Self-evolution executor.

Runs an isolated review agent over an idle conversation's transcript and, if a
clear signal is found, lets it edit memory / skills via a restricted toolset.
Conservative by design: most runs return ``[SILENT]`` and change nothing.

Flow:
    1. Build a transcript from the session's new (since last pass) messages.
    2. Snapshot MEMORY.md + daily file + editable skills (for undo) -> backup_id.
    3. Run an isolated agent (same model, restricted tools, evolution prompt).
    4. If output is [SILENT], or no workspace file actually changed -> done.
    5. Otherwise -> record to the evolution log, inject an [EVOLUTION] note into
       the user session (so the main agent can honor "undo"), and push the
       summary to the user's channel.

Reuses existing infrastructure (AgentBridge.create_agent, ToolManager,
remember_scheduled_output, channel_factory) rather than introducing a fork.
"""

from __future__ import annotations

import threading
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from common.log import logger

from agent.evolution.backup import create_backup
from agent.evolution.config import get_evolution_config
from agent.evolution.prompts import (
    EVOLUTION_MARKER,
    EVOLUTION_SYSTEM_PROMPT,
    SILENT_TOKEN,
    build_review_user_message,
)
from agent.evolution.record import append_session_evolution

# Tools the isolated evolution agent is allowed to use. Everything else is
# withheld so an unattended review can only read context and edit approved
# workspace artifacts. Skill files are created directly with the write tool.
_ALLOWED_TOOLS = {"read", "write", "edit", "ls", "memory_search", "memory_get"}

# Cap concurrent evolution passes so a burst of idle sessions can't spawn many
# background model runs at once. Extra sessions simply wait for the next scan.
_MAX_CONCURRENT = 2
_running_lock = threading.Lock()
_running_count = 0

# Transactions for the same workspace must not overlap: a failed pass restoring
# its snapshot could otherwise overwrite a concurrent pass that already
# committed. Different workspaces retain the global parallelism above.
_workspace_locks_guard = threading.Lock()
_workspace_locks: dict[Path, threading.Lock] = {}


def _get_workspace_lock(workspace_dir: Path) -> threading.Lock:
    workspace = workspace_dir.resolve()
    with _workspace_locks_guard:
        lock = _workspace_locks.get(workspace)
        if lock is None:
            lock = threading.Lock()
            _workspace_locks[workspace] = lock
        return lock


def _builtin_skill_names() -> set:
    """Names of skills shipped with the product (project-root ``skills/``).

    These are protected: the evolution agent must never edit them, even though
    a same-named copy exists in the workspace at runtime. The project dir is the
    authoritative list of what counts as built-in.
    """
    try:
        # executor.py -> agent/evolution -> agent -> project root
        project_root = Path(__file__).resolve().parents[2]
        builtin_dir = project_root / "skills"
        if not builtin_dir.is_dir():
            return set()
        names = set()
        for entry in builtin_dir.iterdir():
            if entry.is_dir() and not entry.name.startswith("."):
                names.add(entry.name)
        return names
    except Exception:
        return set()


def _build_transcript(messages: List[dict], max_chars: int = 12000) -> str:
    """Render the session messages into a compact text transcript."""
    lines: List[str] = []
    for msg in messages:
        role = msg.get("role", "")
        if role not in ("user", "assistant"):
            continue
        content = msg.get("content", "")
        text = _extract_text(content)
        if not text.strip():
            continue
        speaker = "User" if role == "user" else "Assistant"
        lines.append(f"{speaker}: {text.strip()}")
    transcript = "\n".join(lines)
    # Keep the most RECENT context if oversized (tail is most relevant).
    if len(transcript) > max_chars:
        transcript = "...(earlier omitted)...\n" + transcript[-max_chars:]
    return transcript


def _extract_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
            elif isinstance(block, str):
                parts.append(block)
        return "\n".join(parts)
    return ""


def _select_tools(all_tools: list) -> list:
    return [t for t in all_tools if getattr(t, "name", None) in _ALLOWED_TOOLS]


# Tools whose writes must be confined to the workspace during evolution.
_WRITE_TOOLS = {"write", "edit"}


class _EvolutionWriteTransaction:
    """Make writes performed by one unattended evolution pass atomic."""

    _MISSING = object()

    def __init__(self, workspace: Path):
        self._workspace = workspace.resolve()
        self._before: dict[Path, object] = {}
        self._missing_parents: set[Path] = set()
        self._committed = False

    def record(self, path: Path) -> None:
        path = path.resolve()
        if path in self._before:
            return
        parent = path.parent
        while parent != self._workspace:
            try:
                parent.relative_to(self._workspace)
            except ValueError:
                break
            if parent.exists():
                break
            self._missing_parents.add(parent)
            parent = parent.parent
        try:
            self._before[path] = path.read_bytes() if path.is_file() else self._MISSING
        except OSError as e:
            raise PermissionError(f"cannot snapshot '{path}' before evolution write: {e}")

    def commit(self) -> None:
        self._committed = True

    def has_changes(self) -> bool:
        """Return whether a guarded write changed or created a file."""
        for path, before in self._before.items():
            try:
                after = path.read_bytes() if path.is_file() else self._MISSING
            except OSError:
                after = self._MISSING
            if before is self._MISSING:
                if after is not self._MISSING:
                    return True
            elif after is self._MISSING or after != before:
                return True
        return False

    def rollback(self) -> None:
        if self._committed:
            return
        for path, before in reversed(list(self._before.items())):
            try:
                if before is self._MISSING:
                    if path.is_file() or path.is_symlink():
                        path.unlink()
                else:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(before)
            except OSError as e:
                logger.error(f"[Evolution] Failed to roll back {path}: {e}")
        for directory in sorted(
            self._missing_parents, key=lambda p: len(p.parts), reverse=True
        ):
            try:
                directory.rmdir()
            except OSError:
                pass


def _denied_evolution_path(
    workspace: Path, resolved: Path, protected_skills: set
) -> bool:
    """Block only workspace paths Self-Evolution must never modify."""
    try:
        relative = resolved.relative_to(workspace)
    except ValueError:
        return True
    parts = relative.parts
    if not parts:
        return True
    folded = tuple(part.casefold() for part in parts)
    if folded == ("skills", "skills_config.json"):
        return True
    if folded[0] == "memory" and len(folded) >= 2:
        if folded[1] == ".evolution_backups":
            return True
    if folded[0] == "skills" and len(folded) >= 2:
        protected = {name.casefold() for name in protected_skills}
        if folded[1] in protected:
            return True
    return Fa
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #3168** (2026-09-17): **[Bug] [Feishu] Bot is triggered by group messages that mention other users (not the bot)**
  *Symptoms*: ### Self check  - [x] I'm on the latest version and searched [existing issues](https://github.com/zhayujie/CowAgent/issues) (incl. closed) — no duplicate.  ### Environment  Version: v2.1.9 OS: CentOS Linux 7 (Core), kernel 3.10.0-1160.92.1.el7.x86_64 Python: 3.9.4 Install: source Model & channel: deepseek-v4-flash, feishu   ### What happened?  ## Summary  In Feishu group chats, the bot is sometimes triggered by messages that **do not @-mention the bot at all** — for example, a message that mentions two other human users in the group. This appears to be intermittent ("sometimes", not always).  ## Environment  - CowAgent commit: `7236846` (`fix: dedupe self-evolution bubble on web console history reload`) - Channel: Feishu (`channel_type: feishu`) - Reconnection mode: WebSocket (`lark.ws.Client`) - `feishu_bot_name`: **not configured** - Python: 3.9  ## Steps to Reproduce  1. Configure the Feishu channel and join the bot to a group chat. 2. Do **not** set `feishu_bot_name` in `config.json`. 3. Have another user in the group send a plain text message that @-mentions    other **human** users instead of the bot, e.g.:  @Alice @Bob please update the data for ugc_plstar 4. Observe that the bot processes the message and starts executing tools — even though it was never mentioned. This is intermittent: it works correctly (no trigger) after some restarts, and misbehaves after others. ## Root Cause Analysis The group-chat gate itself is correct. In `channel/feishu/feishu_channel.py`, `_
  **Post-Mortem & Fix Analysis**:
  > Thanks for the detailed and well-researched report — your root-cause analysis was spot on.  You're right: the `_is_mention_bot()` fallback returned `True` whenever the bot identity couldn't be determined. Since an app holding the broad `im:message` scope receives **every** group message (not just ones that @-mention the bot), any message mentioning other people would satisfy the non-empty `mentions` check and get treated as if the bot was called — hence the bot running tools on messages addressed to your colleagues. The intermittency was exactly as you diagnosed: it only happened in the window where `_bot_open_id` hadn't been populated.  This is now fixed in `408e9844`. What we changed:  - **Fail closed.** When neither `_bot_open_id` nor `feishu_bot_name` is available, `_is_mention_bot()` now returns `False` and logs a warning, instead of assuming the bot was mentioned. - **Retry the identity lookup.** The `_bot_open_id` lookup is now retried lazily (rate-limited to once a minute) when

- **Issue #3120** (2026-09-08): **[Bug] 多智能体模式下：微信定时任务被就绪检查误判 not ready，channel_instance 与裸单例不一致，永不投递**
  *Symptoms*: # [Bug] 多智能体模式下：微信定时任务被就绪检查误判 "not ready"，channel_instance 与裸单例不一致，永不投递  ## 摘要  在多智能体团队模式（`agents/team.json` 定义了 `channel_instances`，并把微信绑定到 `agent_id='default'`）下，**所有需要推送到微信的定时任务都无法在重启后自动投递**。  调度器在每次执行前会调用新增的就绪检查 `_is_channel_ready()`（`agent/tools/scheduler/integration.py`），它持续返回 `channel 'weixin' not ready for receiver=<用户>`，任务被无限 `deferring`，从不真正发送。  **触发规律**：只要微信以 channel_instance 形态（带 instance_id/bound_agent_id）运行，就绪检查读取的裸单例就永远拿不到 context_token，因此相关定时任务**持续** not ready、永不投递（即使有入站消息、即使重启，均无法解锁）。  ## 影响  - 所有走微信的定时任务在 channel_instance 多实例形态下**持续静默失效**（非仅重启后第一波），推送无限期挂起，只刷 WARNING 日志，且无法通过发消息解锁。 - 对无人值守的准点推送（日报、巡检、周报等）影响严重：重启后若用户不在线，推送将无限期挂起，只刷 WARNING 日志。 - 此就绪检查逻辑引入前，同样的任务可直接发送，无此问题——疑似近期调度器改动引入的回归。  ## 环境  - 多智能体团队模式：`team.json` 的 `channel_instances` 含   ```json   {"instance_id": "weixin", "channel_type": "weixin", "agent_id": "default", "credentials": {}}   ``` - `config.json`：`channel_type = "web,weixin"` - 微信通道走 ilink 协议，登录正常 - 涉及文件：`agent/tools/scheduler/integration.py`、`channel/weixin/weixin_channel.py`、`config.py`、`channel/channel_factory.py`  ## 复现步骤  1. 以多智能体团队模式启动，微信由 `channel_instances` 管理（启动日志见证据 A）。 2. 创建一条 `channel_type=weixin`、`receiver=<某微信用户ID>` 的定时任务（cron 或一次性均可）。 3. **在进程刚启动、用户尚未给机器人发任何消息时**等待调度器触发。 4. 观察到任务被 `not ready ... deferring` 卡住，并每 ~30s 无限重试。 5. 现在用户主动给机器人发多条消息（刷新该用户 context_token 到实际接收实例），任务**仍然** not ready、持续 deferring，直至一次性任务过期被删除。 6. 多次验证均不恢复，与任务配置、接收者、入站消息均无关。  ## 期望行为  启动时已从凭据文件成功恢复的 context_token（启动日志 `Restored N context_tokens`）应足以让就绪
  **Post-Mortem & Fix Analysis**:
  > 谢谢反馈，最新master代码已修复，可以拉取测试一下
  > > 谢谢反馈，最新master代码已修复，可以拉取测试一下  感谢，已验证正常👍

- **Issue #3108** (2026-09-12): **[Bug] qq和微信通道断开不会自动重连？**
  *Symptoms*: ### Self check  - [x] I'm on the latest version and searched [existing issues](https://github.com/zhayujie/CowAgent/issues) (incl. closed) — no duplicate.  ### Environment  最新docker  ### What happened?  FO][2026-09-04 11:15:50][web_channel.py:5487] - [WebChannel] Channel instance 'qq' disconnected [INFO][2026-09-04 11:15:52][web_channel.py:5463] - [WebChannel] Channel instance 'qq' saved, restart=no  webui上面状态显示正常，日志显示错误，而且qq也收不到发不出去消息  ### Logs  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 你好，这个断开是怎么触发的，webui上手动断开还是怎么操作的
  > > 你好，这个断开是怎么触发的，webui上手动断开还是怎么操作的  我也不清楚，就启动容器之后没管，发现收不到消息才去排查
  > 已为 qq channel 增加自动重连机制，谢谢反馈  https://github.com/zhayujie/CowAgent/commit/c407bf61704d360664b381f20ace356e85947f93

- **Issue #3106** (2026-09-04): **[Feature] 增加自部署的符合openai标准的模型provider**
  *Symptoms*: ### Self check  - [x] I searched [existing issues](https://github.com/zhayujie/CowAgent/issues) (incl. closed) — no duplicate.  ### What's the problem?  当前只看到内置的一些厂商，没看到哪里可以配置自部署的或者其他第三方的服务商选项  ### What would you like?  _No response_  ### Contribution  - [ ] I'd be interested in helping implement this.
  **Post-Mortem & Fix Analysis**:
  > 谢谢反馈，这是最近迭代引入的一个兼容问题，导致增加厂商的按钮不显示了。 已经修复，等待镜像构建完就可以拉取使用了。入口在 「配置 - 模型配置 - 厂商凭据」：  <img width="1329" height="695" alt="Image" src="https://github.com/user-attachments/assets/15fe79bf-645d-4fca-b65b-78e0e1a09b29" />  
  > > 谢谢反馈，这是最近迭代引入的一个兼容问题，导致增加厂商的按钮不显示了。 已经修复，等待镜像构建完就可以拉取使用了。入口在 「配置 - 模型配置 - 厂商凭据」： >  > <img alt="Image" width="1329" height="695" src="https://private-user-images.githubusercontent.com/26161723/646095834-15fe79bf-645d-4fca-b65b-78e0e1a09b29.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3ODg0OTQzNDQsIm5iZiI6MTc4ODQ5NDA0NCwicGF0aCI6Ii8yNjE2MTcyMy82NDYwOTU4MzQtMTVmZTc5YmYtNjQ1ZC00ZmNhLWI2NWItNzhlMGUxYTA5YjI5LnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNjA5MDQlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjYwOTA0VDAzNTQwNFomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWI0Y2E5NTgyNDRhY2Y0YzU0Nzg0MjkyNzk0ZmQzZGM0YTAzMDViOWI3ZTAwZGM5MjA0OGU4ODAwMjk3NzNhNjkmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0JnJlc3BvbnNlLWNvbnRlbnQtdHlwZT1pbWFnZSUyRnBuZyJ9.rEoekdzbWAbX987bjsusHPljdtKXzbBgc28TPQ5mWoU">  更新之后有了，但是apikey没写必填，也能保存，选择模型的时候会弹出输入
  > @mengluo04  已优化，现在自定义模型不需要填写 apikey

- **Issue #3104** (2026-09-04): **[Bug] 配置里面，选择主模型的时候，无法记录自定义的**
  *Symptoms*: ### Self check  - [x] I'm on the latest version and searched [existing issues](https://github.com/zhayujie/CowAgent/issues) (incl. closed) — no duplicate.  ### Environment  最新docker版本  ### What happened?  配置页面，设置主模型，选择自定义，保存之后，切换刀其他模型，再换回来，自定义的模型没了。 希望能记住自定义模型，并且提供按钮通关api的/models接口获取当前key拥有的全部模型，内置的太少了，去平台复制太麻烦了  ### Logs  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈，最新代码已修复  https://github.com/zhayujie/CowAgent/commit/7e4d634c43438b5c662a066cf8eab5d33b10a039

- **Issue #2883** (2026-06-12): **[Bug] 微信端的部分内置命令的多行文本推送场景实际未换行**
  *Symptoms*: ### Self check  - [x] I'm on the latest version and searched [existing issues](https://github.com/zhayujie/CowAgent/issues) (incl. closed) — no duplicate.  ### Environment  Version: v2.1.1 OS: Windows 通道：个人微信bot通道  ### What happened?  以输入 cow help 和 cow status 为例：  <img width="1002" height="722" alt="Image" src="https://github.com/user-attachments/assets/46e5e1e0-9383-476d-bd02-be08a8e133aa" />  大量未换行的情况（尤其是cow help）。实际在电脑本地cmd里运行是正常的。  ### Logs  ```shell  ```
  **Post-Mortem & Fix Analysis**:
  > 已解决，wechat PC端对非markdown格式的文本换行渲染有问题，把 CLI 在 weixin 通道的输出进行了优化 https://github.com/zhayujie/CowAgent/commit/7fd30b608c77e51826bd187c0255f08026d35f2d
  > 大佬牛逼，爱你~

- **Issue #2821** (2026-05-20): **Bug: 历史对话重载后，工具执行失败状态丢失，全部显示为成功 ✅**
  *Symptoms*: ### 前置确认  - [x] 我确认我运行的是最新版本的代码，并且安装了所需的依赖，在[FAQS](https://github.com/zhayujie/chatgpt-on-wechat/wiki/FAQs)中也未找到类似问题。  ### ⚠️ 搜索issues中是否已存在类似问题  - [x] 我已经搜索过issues和disscussions，没有跟我遇到的问题相关的issue  ### 操作系统类型?  Windows  ### 运行的python版本是?  python 3.8  ### 使用的chatgpt-on-wechat版本是?  Latest Release  ### 运行的`channel`类型是?  other  ### 复现步骤 🕹  1. 在 Web 控制台中发起一个对话，触发一个会执行失败的工具调用（如访问不存在的文件、执行错误命令等） 2. 观察到该工具在对话中显示 ❌ 红色叉号 3. 离开该对话（切换到其他对话或刷新页面） 4. 重新进入该对话，查看历史消息  **期望行为**：重新加载后，失败的工具调用仍应显示 ❌ 红色叉号 **实际行为**：重新加载后，所有工具调用（包括失败的）都显示 ✅ 绿色勾号  ### 问题描述 😯  ## 问题描述  在 Web 控制台中，对话进行时工具执行失败会正确显示 ❌（红色叉号），但退出对话后重新加载，所有工具调用都显示为 ✅（绿色勾号），失败状态丢失。  ## 根因分析  Web 控制台存在两条渲染路径，实时路径正确处理了错误状态，但历史重载路径在 **3 个环节**丢失了 `is_error` 信息：  ### 1️⃣ `_extract_tool_results()` 丢弃了 `is_error` 字段  📄 文件：`agent/memory/conversation_store.py` 第 ~119 行  ```python # 当前代码：只提取了结果文本，丢弃了 is_error results[tool_id] = str(result_content) ```  Claude API 的 tool_result 消息格式中包含 `is_error` 字段： ```json {"type": "tool_result", "tool_use_id": "...", "content": "...", "is_error": true} ```  ### 2️⃣ `_group_into_display_turns()` 不传递错误状态  📄 文件：`agent/memory/conversation_store.py` 第 ~244 行  ```python # 当前代码：只赋值 result，没有 is_error step["result"] = tool_results.get(step.get("id", ""), "") ```  ### 3️⃣ `renderStepsHtml()` 硬编码了成功图标  📄 文件：`channel/web/static/js/console.js` 第 ~1732 行  ```html <!-- 当前代码：永远显示绿色勾 --> <i class="fas fa-check text-primary-400 flex-shrink-0 tool-icon"></i> ```  > 对比 SSE 实时渲染路径（✅ 正确处理）： > ```javascript > const isError = item.s
  **Post-Mortem & Fix Analysis**:
  > 感谢反馈，分析的没问题，是否有兴趣提交一个PR来修复这个问题呢~
  > 谢谢 PR https://github.com/zhayujie/CowAgent/pull/2822

- **Issue #2820** (2026-05-18): **Scheduler工具执行任务时似乎会重复运行，存在一些调度bug？**
  *Symptoms*: ### 前置确认  - [x] 我确认我运行的是最新版本的代码，并且安装了所需的依赖，在[FAQS](https://github.com/zhayujie/chatgpt-on-wechat/wiki/FAQs)中也未找到类似问题。  ### ⚠️ 搜索issues中是否已存在类似问题  - [x] 我已经搜索过issues和disscussions，没有跟我遇到的问题相关的issue  ### 操作系统类型?  Windows  ### 运行的python版本是?  python 3.9  ### 使用的chatgpt-on-wechat版本是?  Latest Release  ### 运行的`channel`类型是?  terminal  ### 复现步骤 🕹  ### 情况1： 给予ai一个长任务，如：“2点43分，从git仓库检查issue，并且思考要进行什么操作...” **现象：** 会自己重复运行大概2-4次？  ### 情况2： 给予ai一个中短任务，如：“早晨8点，查询北京今天的天气，直接输出给我。” **现象：** 重复运行2-3次或偶发不重复运行？  ### 情况3： 给予ai一个不需要思考几乎可以瞬间完成的任务，如：“待会儿输出一句hello,world.不要思考，直接输出。” **现象：** 正常运行，且绝大多数情况下只运行1次。   ### 问题描述 😯  问题就是，**当ai运行需要长时间思考的定时任务时，似乎总是会反复运行**，如果是只思考的任务倒是可以接受，也就是多一点token消耗，但是如果定时任务涉及到对外部系统操作或文件读写操作，这时候很容易出现冲突和文件损坏，影响正常使用。  ### 可能的原因？  _本人不太了解python，尤其是多线程或者阻塞之类的处理过程，所以只能根据自己的猜测来提供思路。_  通过阅读scheduler部分的源码，我感觉原本的任务处理意图似乎是，一个while循环，每30s遍历一次任务列表，来判断是否需要执行任务？  但是似乎，循环并没有按照意图每30s进行一次循环，而是好像在持续不断地循环？（从日志上看，三次触发的``[Scheduler] Task *****:``几乎在同一秒内被连续触发）  任务删除或者修改的时机是在任务完成时进行修改，并在日志里打印：``[Scheduler] One-time task completed and removed:``信息。  但是实际上从日志上看，``[Scheduler] Task ****** executed successfully``同样也被触发了三次，说明执行成功了三次，而且后面两次并没有触发任务删除或修改，而是触发了``[Scheduler] Error processing task a7fa6196: Task 'a7fa6196' not found``，我怀疑是第一次完成时已经被删除了，所以后续尝试操作的时候会报错？  我不太了解python的多线程和同步异步阻塞，但是我猜测，会不会是Scheduler的循环没有被阻塞，或者其实被重复多次运行了，而对任务进行更新或删除的操作被任务执行过程阻塞住了，导致没办法及时修改或删除，所以导致被重复运行？  如果是这样的话，那把对任务的执行放在对任务进行更新或删除的操作之后会不会缓解这个问题？或者说，在任务执行前给任务加一个正在执行的标志，甚至在任务执行前直接把相关任务禁用掉，或许可以解决这个问题？  不知道这个思路对不对，还请麻烦开发者复现debug一下了。  ##
  **Post-Mortem & Fix Analysis**:
  > Hi @CNXudiandian，原因可能是 scheduler 在多 session 并发首次初始化时会重复启动多个扫描线程，导致同一个任务被并发触发多次。  我们尝试进行了修复（让 init 真正幂等，全局只保留一个扫描线程），麻烦拉最新代码重启服务再试一下，看看还会不会重复执行～
  > 在测试环境里拉取了最新代码后测试没问题，定时任务只会触发一次，不论长短。 已经部署到服务器上啦，目前看起来修复成功，感谢您的工作~

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

### Incident Patch 1: `5a195795` (2026-09-30)
**Commit Message**: Merge pull request #3408 from 6vision/fix/mcp-windows-npx

fix(mcp): resolve stdio command via PATHEXT on Windows

**File**: `agent/tools/mcp/mcp_client.py` (modified, +20/-1)
```diff
@@ -8,6 +8,7 @@
 import json
 import os
 import queue
+import shutil
 import subprocess
 import threading
 import urllib.request
@@ -235,9 +236,10 @@ def _init_stdio(self) -> bool:
 
         args = self.config.get("args", [])
         env = self._build_stdio_env(self.config.get("env", None))
+        executable = self._resolve_executable(command, env)
 
         self._proc = subprocess.Popen(
-            [command] + list(args),
+            [executable] + list(args),
             stdin=subprocess.PIPE,
             stdout=subprocess.PIPE,
             stderr=subprocess.PIPE,
@@ -256,6 +258,23 @@ def _init_stdio(self) -> bool:
 
         return self._handshake()
 
+    def _resolve_executable(self, command: str, env: dict) -> str:
+        """Resolve ``command`` to a full path using the subprocess PATH.
+
+        Popen without a shell does not apply PATHEXT on Windows, so shims like
+        ``npx`` / ``uvx`` (really ``npx.cmd``) fail with WinError 2 unless
+        resolved first.
+        """
+        path = env.get("PATH") or env.get("Path") or os.environ.get("PATH")
+        resolved = shutil.which(command, path=path)
+        if resolved:
+            return resolved
+        logger.warning(
+            f"[MCP:{self.name}] command '{command}' not found in PATH; "
+            f"make sure it is installed (e.g. Node.js for npx)"
+        )
+        return command
+
     def _command_allowed(self, command: str) -> bool:
         """Check the executable against an optional command allowlist.
 
```

---

### Incident Patch 2: `b6d3e7bd` (2026-09-30)
**Commit Message**: fix(mcp): resolve stdio command via PATHEXT on Windows

Popen without a shell does not apply PATHEXT, so npx/uvx (npx.cmd) failed with WinError 2. Resolve the executable with shutil.which against the subprocess PATH before launching.

**File**: `agent/tools/mcp/mcp_client.py` (modified, +20/-1)
```diff
@@ -8,6 +8,7 @@
 import json
 import os
 import queue
+import shutil
 import subprocess
 import threading
 import urllib.request
@@ -235,9 +236,10 @@ def _init_stdio(self) -> bool:
 
         args = self.config.get("args", [])
         env = self._build_stdio_env(self.config.get("env", None))
+        executable = self._resolve_executable(command, env)
 
         self._proc = subprocess.Popen(
-            [command] + list(args),
+            [executable] + list(args),
             stdin=subprocess.PIPE,
             stdout=subprocess.PIPE,
             stderr=subprocess.PIPE,
@@ -256,6 +258,23 @@ def _init_stdio(self) -> bool:
 
         return self._handshake()
 
+    def _resolve_executable(self, command: str, env: dict) -> str:
+        """Resolve ``command`` to a full path using the subprocess PATH.
+
+        Popen without a shell does not apply PATHEXT on Windows, so shims like
+        ``npx`` / ``uvx`` (really ``npx.cmd``) fail with WinError 2 unless
+        resolved first.
+        """
+        path = env.get("PATH") or env.get("Path") or os.environ.get("PATH")
+        resolved = shutil.which(command, path=path)
+        if resolved:
+            return resolved
+        logger.warning(
+            f"[MCP:{self.name}] command '{command}' not found in PATH; "
+            f"make sure it is installed (e.g. Node.js for npx)"
+        )
+        return command
+
     def _command_allowed(self, command: str) -> bool:
         """Check the executable against an optional command allowlist.
 
```

---

### Incident Patch 3: `a0c5063b` (2026-09-30)
**Commit Message**: fix(desktop): re-scan an existing WeChat instance instead of minting a new one

When a live WeChat instance lost its session, the scan panel fetched a
standalone QR and connected with an empty instance id on confirm, which
created a second WeChat card. The panel now reads the instance's own QR,
reconnects under the same id, and the page polls instance cards that are
waiting for a scan.

Co-authored-by: cowagent <cow@cowagent.ai>

**File**: `desktop/src/renderer/src/api/client.ts` (modified, +6/-3)
```diff
@@ -790,9 +790,12 @@ class ApiClient {
     })
   }
 
-  // Weixin QR login
-  async getWeixinQr(): Promise<{ status: string; qrcode_url?: string; qr_image?: string; source?: string; message?: string }> {
-    return this.request('/api/weixin/qrlogin')
+  // Weixin QR login. Pass instance_id so a live card reads that channel's
+  // own code instead of opening a standalone session (which would mint a
+  // second instance on confirm).
+  async getWeixinQr(instanceId?: string): Promise<{ status: string; qrcode_url?: string; qr_image?: string; source?: string; message?: string }> {
+    const q = instanceId ? `?instance_id=${encodeURIComponent(instanceId)}` : ''
+    return this.request(`/api/weixin/qrlogin${q}`)
   }
 
   async weixinQrAction(action: 'poll' | 'refresh'): Promise<Record<string, unknown> & { status: string }> {
```

**File**: `desktop/src/renderer/src/components/QrScanPanel.tsx` (modified, +23/-8)
```diff
@@ -15,18 +15,24 @@ interface QrScanPanelProps {
   // mints a NEW channel instance (instance_id '') rather than editing the
   // single legacy one. Undefined/false keeps the legacy single-instance path.
   newInstance?: boolean
+  // Existing instance this card belongs to. Its QR is read off that channel,
+  // and a confirm reconnects the same id; an empty id would mint a second card.
+  instanceId?: string
 }
 
 const POLL_INTERVAL = 2000
+// A live instance may still be fetching its code, or restarting after an
+// expired attempt; keep asking for this many polls before giving up.
+const WEIXIN_QR_PENDING_MAX_TRIES = 15
 
 // Shared inline QR panel for WeChat login and Feishu app registration. Mirrors
 // the web console: fetch a QR, poll its status, then connect the channel. The
 // scan starts as soon as the panel mounts, so the caller decides when to show
 // it rather than wiring up a separate "start" button.
-const QrScanPanel: React.FC<QrScanPanelProps> = ({ provider, onConnected, newInstance }) => {
-  // When minting a new instance, pass instance_id ''; otherwise omit it so the
-  // legacy per-type path is taken untouched.
-  const instanceArg = newInstance ? '' : undefined
+const QrScanPanel: React.FC<QrScanPanelProps> = ({ provider, onConnected, newInstance, instanceId }) => {
+  // When minting a new instance, pass instance_id ''; an existing card passes
+  // its own id. Omit it entirely for the legacy per-type path.
+  const instanceArg = newInstance ? '' : instanceId || undefined
   const [phase, setPhase] = useState<Phase>('loading')
   const [qr, setQr] = useState('')
   const [openLink, setOpenLink] = useState('')
@@ -86,7 +92,7 @@ const QrScanPanel: React.FC<QrScanPanelProps> = ({ provider, onConnected, newIns
   // console owns the QR session instead, so polling has to switch over.
   const refreshChannelQr = async (): Promise<boolean> => {
     try {
-      const data = await apiClient.getWeixinQr()
+      const data = await apiClient.getWeixinQr(instanceId)
       if (!aliveRef.current || data.status !== 'success') return true
       const img = data.qr_image || data.qrcode_url
       if (img) setQr(img)
@@ -101,9 +107,11 @@ const QrScanPanel: React.FC<QrScanPanelProps> = ({ provider, onConnected, newIns
       if (!aliveRef.current) return
       let handedOver = false
       try {
-        const list = await apiClient.getChannels()
+        const data = await apiClient.getChannelsFull()
         if (!aliveRef.current) return
-        const wx = list?.find((c) => c.name === 'weixin')
+        const wx = instanceId
+          ? (data.instances || []).find((c) => c.instance_id === instanceId)
+          : (data.channels || []).find((c) => c.name === 'weixin')
         if (wx?.login_status === 'logged_in') {
           setPhase('success')
           onConnected()
@@ -123,7 +131,14 @@ const QrScanPanel: React.FC<QrScanPanelProps> = ({ provider, onConnected, newIns
   const startWeixin = async () => {
     setPhase('loading')
     try {
-      const data = await apiClient.getWeixinQr()
+      let data = await apiClient.getWeixinQr(instanceId)
+      let pendingTries = 0
+      while (data.status === 'pending' && pendingTries < WEIXIN_QR_PENDING_MAX_TRIES) {
+        pendingTries += 1
+        await new Promise((r) => setTimeout(r, POLL_INTERVAL))
+        if (!aliveRef.current) return
+        data = await apiClient.getWeixinQr(instanceId)
+      }
       if (!aliveRef.current) return
       if (data.status !== 'success') return fail(data.message || t('weixin_scan_fail'))
       setQr(data.qr_image || data.qrcode_url || '')
```

**File**: `desktop/src/renderer/src/pages/ChannelsPage.tsx` (modified, +10/-2)
```diff
@@ -126,7 +126,10 @@ const ChannelsPage: React.FC<ChannelsPageProps> = ({ baseUrl }) => {
 
   // While a channel is still settling (booting, or waiting for a scan that may
   // happen elsewhere), poll so its card flips to "connected" on its own.
-  const settling = channels.some((c) => pendingState(c) !== 'none')
+  // Multi-Agent WeChat cards live in `instances`, not the per-type list.
+  const settling =
+    channels.some((c) => pendingState(c) !== 'none') ||
+    instances.some((c) => pendingState(c) !== 'none')
   useEffect(() => {
     if (!settling) return
     const id = setInterval(() => void loadChannels(true), 3000)
@@ -717,7 +720,12 @@ const ChannelCard: React.FC<{
           "waiting for scan" badge is what tells a live card why it reappeared. */}
       {weixinQr && (
         <div className={channel.active ? 'mt-4 pt-4 border-t border-subtle' : 'mt-2'}>
-          <QrScanPanel provider="weixin" onConnected={onChanged} newInstance={multiAgent && (forceNewInstance || !channel.instance_id)} />
+          <QrScanPanel
+            provider="weixin"
+            onConnected={onChanged}
+            newInstance={multiAgent && (forceNewInstance || !channel.instance_id)}
+            instanceId={channel.instance_id}
+          />
         </div>
       )}
 
```

---

### Incident Patch 4: `77f7f608` (2026-09-30)
**Commit Message**: fix(skills): delete a skill from the folder it was loaded from

A skill's folder need not match its frontmatter name (e.g. wecom-cli holding
wecom-unified), so deleting by name silently left it on disk. Builtin skills
outside the workspace skills directory are now rejected instead.

Co-authored-by: cowagent <cow@cowagent.ai>

**File**: `agent/skills/service.py` (modified, +19/-1)
```diff
@@ -54,6 +54,18 @@ def _safe_skill_dir(self, name: str) -> str:
             )
         return skill_dir
 
+    def _contained_skill_dir(self, base_dir: str, name: str) -> str:
+        """Validate that a loaded skill's directory sits inside the skills root.
+
+        :raises ValueError: for the root itself or anything outside it, such
+            as a builtin skill resolved from the install directory.
+        """
+        skill_dir = os.path.realpath(base_dir)
+        root = os.path.realpath(self.manager.custom_dir)
+        if not skill_dir.startswith(root + os.sep):
+            raise ValueError(f"skill {name!r} is not in the workspace skills directory")
+        return skill_dir
+
     @staticmethod
     def _safe_file_path(root: str, rel_path: str) -> str:
         """Resolve a skill file path and validate it stays inside ``root``.
@@ -361,7 +373,13 @@ def delete(self, payload: dict) -> None:
         if not name:
             raise ValueError("skill name is required")
 
-        skill_dir = self._safe_skill_dir(name)
+        entry = self.manager.get_skill(name)
+        if entry is not None:
+            # The folder need not be named after the frontmatter ``name`` (a
+            # hand-made or renamed skill), so remove it where the loader found it.
+            skill_dir = self._contained_skill_dir(entry.skill.base_dir, name)
+        else:
+            skill_dir = self._safe_skill_dir(name)
         if os.path.exists(skill_dir):
             shutil.rmtree(skill_dir)
             logger.info(f"[SkillService] delete: removed directory {skill_dir}")
```

**File**: `tests/test_skill_delete.py` (added, +65/-0)
```diff
@@ -0,0 +1,65 @@
+"""Deleting a skill removes the directory it was loaded from."""
+
+import pytest
+
+SKILL_MD = "---\nname: {name}\ndescription: does a thing\n---\n\n# {name}\n"
+
+
+def _write_skill(root, folder, name):
+    path = root / folder / "SKILL.md"
+    path.parent.mkdir(parents=True, exist_ok=True)
+    path.write_text(SKILL_MD.format(name=name), encoding="utf-8")
+    return path.parent
+
+
+def _service(tmp_path):
+    from agent.skills.manager import SkillManager
+    from agent.skills.service import SkillService
+
+    builtin = tmp_path / "builtin"
+    custom = tmp_path / "custom"
+    builtin.mkdir()
+    custom.mkdir()
+    return SkillService(SkillManager(builtin_dir=str(builtin), custom_dir=str(custom))), builtin, custom
+
+
+def test_delete_removes_a_folder_named_differently_from_the_skill(tmp_path):
+    svc, _, custom = _service(tmp_path)
+    folder = _write_skill(custom, "wecom-cli", "wecom-unified")
+    svc.manager.refresh_skills()
+
+    svc.delete({"name": "wecom-unified"})
+
+    assert not folder.exists()
+    assert svc.manager.get_skill("wecom-unified") is None
+
+
+def test_delete_still_removes_a_folder_named_after_the_skill(tmp_path):
+    svc, _, custom = _service(tmp_path)
+    folder = _write_skill(custom, "plain", "plain")
+    svc.manager.refresh_skills()
+
+    svc.delete({"name": "plain"})
+
+    assert not folder.exists()
+
+
+def test_delete_refuses_a_skill_loaded_from_outside_the_workspace(tmp_path):
+    svc, builtin, _ = _service(tmp_path)
+    folder = _write_skill(builtin, "shipped", "shipped")
+    svc.manager.refresh_skills()
+
+    with pytest.raises(ValueError):
+        svc.delete({"name": "shipped"})
+
+    assert folder.exists()
+
+
+def test_delete_of_an_unknown_skill_is_a_no_op(tmp_path):
+    svc, _, custom = _service(tmp_path)
+    _write_skill(custom, "keep", "keep")
+    svc.manager.refresh_skills()
+
+    svc.delete({"name": "missing"})
+
+    assert (custom / "keep").exists()
```

---

### Incident Patch 5: `6ed2a802` (2026-09-29)
**Commit Message**: fix(desktop): install cryptography from wheels so the Intel mac backend loads it

cryptography dropped macOS x86_64 wheels at 49.0, so the Intel build compiled it
against the runner's Homebrew OpenSSL while the bundle only ships Python's older
libssl.3.dylib, and importing it failed with a missing SSL_get0_group_name.
Also fail the mac build when any bundled extension links OpenSSL dynamically.

Co-authored-by: cowagent <cow@cowagent.ai>

**File**: `.github/workflows/release.yml` (modified, +20/-0)
```diff
@@ -113,6 +113,26 @@ jobs:
             exit 1
           fi
 
+      # The bundle carries a single libssl.3.dylib (Python's own). An extension
+      # linked against a different OpenSSL resolves to that copy at runtime and
+      # fails with missing symbols, so only statically linked builds may ship.
+      - name: Verify no extension links a foreign OpenSSL
+        if: matrix.platform == 'mac'
+        shell: bash
+        run: |
+          internal=desktop/build/dist/cowagent-backend/_internal
+          bad=""
+          while IFS= read -r -d '' so; do
+            case "$so" in */python3.*/lib-dynload/*) continue ;; esac
+            if otool -L "$so" | tail -n +2 | grep -Eq 'lib(ssl|crypto)\.[0-9.]+dylib'; then
+              bad="$bad ${so#$internal/}"
+            fi
+          done < <(find "$internal" -name '*.so' -print0)
+          if [ -n "$bad" ]; then
+            echo "::error::extensions dynamically linked to OpenSSL:$bad"
+            exit 1
+          fi
+
       - name: Install desktop deps
         working-directory: desktop
         run: npm ci
```

**File**: `desktop/build/requirements-desktop.txt` (modified, +7/-0)
```diff
@@ -10,6 +10,13 @@
 # small. That bundle relies on `requests` and `pycryptodome` below rather than
 # shipping its own copies.
 
+# cryptography (pulled in by dashscope) stopped shipping macOS x86_64 wheels at
+# 49.0. A source build links the runner's Homebrew OpenSSL, and PyInstaller then
+# bundles it beside Python's older libssl.3.dylib under the same name, so the
+# extension fails to load on users' machines. Wheels link OpenSSL statically;
+# forcing them makes pip settle on the newest version that has one per arch.
+--only-binary=cryptography
+
 # ---- core ----
 numpy>=1.21
 # aiohttp<3.10 has no prebuilt wheels for Python 3.13+ (would need MSVC to build).
```

---

### Incident Patch 6: `25a44908` (2026-09-29)
**Commit Message**: fix(voice): drop return-in-finally so interrupts propagate from openai and pytts

Co-authored-by: cowagent <cow@cowagent.ai>

**File**: `docs/zh/releases/v2.2.0.mdx` (modified, +2/-1)
```diff
@@ -112,7 +112,7 @@ Thanks @liuns-yang (#3191)
 - **下载限制**：通道收发媒体、终端图片、视觉识别、关键词文件等外部下载统一限制文件大小和总耗时，避免超大文件或慢速连接拖垮服务；视觉识别下载图片时对每次重定向重新校验地址。Thanks @rudycelekli (#3255, #3256, #3257, #3264, #3266, #3267, #3268, #3269, #3270, #3271, #3272)、@c020627 (#3219, #3225, #3252, #3300, #3322)
 - **请求超时**：模型、语音、翻译等外部请求全部设置超时，上游无响应时不再卡住对话。Thanks @c020627 (#3217, #3220, #3240, #3254, #3275)
 - **配置安全写入**：`config.json`、插件配置、模型列表、定时任务、技能配置、凭证文件、`MEMORY.md` 等改为原子写入，写入中途失败不会损坏原文件；定时任务文件损坏时自动从备份恢复。Thanks @c020627 (#3223, #3239, #3241, #3242, #3259, #3273, #3274, #3276, #3279, #3280, #3281)、@rudycelekli (#3260)
-- **临时文件管理**：通道接收的文件名限制在临时目录内并限制长度（Thanks @Lesereingrape #3247, #3248、@c020627 #3212, #3301）；下载的媒体、回复附件和语音合成文件统一存放在对应 Agent 的临时目录（Thanks @c020627 #3198, #3207, #3208, #3213）。
+- **临时文件管理**：通道接收的文件名限制在临时目录内并限制长度（Thanks @Lesereingrape #3247, #3248、@c020627 #3212, #3301）；下载的媒体、回复附件和语音合成文件统一存放在对应 Agent 的临时目录（Thanks @c020627 #3198, #3207, #3208, #3213）；技能压缩包解压失败时清理临时目录（Thanks @Lesereingrape #3325）。
 - **日志脱敏**：通道凭证在调试日志中脱敏显示（Thanks @fuxicodex #3228）。
 
 ## 🛠 其他优化与修复
@@ -121,6 +121,7 @@ Thanks @liuns-yang (#3191)
   - 支持 silk 与大写扩展名 amr 语音的转换（Thanks @c020627 #3152）。
   - 阿里云、Edge、ElevenLabs 等语音服务失败时返回错误提示，不再静默丢弃回复（Thanks @c020627 #3243, #3263, #3278）。
   - 修复 WAV 文件句柄未关闭的问题（Thanks @aniruddhaadak80 #3286）。
+  - Google 语音识别遇到异常时返回错误提示，不再掩盖原始错误（Thanks @aniruddhaadak80 #3326）。
 - **定时任务**：跨夏令时切换时保持本地执行时间（Thanks @liuns-yang #3189, #3204）；定时执行技能产出的文件直接投递，而非发送文件路径（Thanks @c020627 #3253）。
 - **备份**：支持将备份输出到不同的文件系统（Thanks @zyc2022 #3200、@chen1070109514 #3246）；恢复多 Agent 备份时沿用本机现有的 Agent 工作区路径（Thanks @Lesereingrape #3319）。
 - **插件**：配置为空或不完整时插件仍可正常启动（Thanks @c020627 #3224）；Midjourney 图片序号输入有误时给出提示（Thanks @Lesereingrape #3291）；角色插件自定义角色未填写描述时返回帮助信息（Thanks @Lesereingrape #3296）；管理员命令设置插件优先级、切换模型时参数有误会给出提示（Thanks @Lesereingrape #3303, #3305）；`plugins.json` 中单个插件配置项缺失或格式错误时自动补全默认值，不再导致全部插件加载失败（Thanks @Lesereingrape #3314）；修复总结插件的文件命名与句柄关闭问题（Thanks @c020627 #3215）。
```

**File**: `voice/openai/openai_voice.py` (modified, +1/-2)
```diff
@@ -69,8 +69,7 @@ def voiceToText(self, voice_file):
         except Exception as e:
             logger.error(f"[Openai] voiceToText exception: {e}", exc_info=True)
             reply = Reply(ReplyType.ERROR, "我暂时还无法听清您的语音，请稍后再试吧~")
-        finally:
-            return reply
+        return reply
 
 
     def textToVoice(self, text):
```

**File**: `voice/pytts/pytts_voice.py` (modified, +1/-2)
```diff
@@ -60,5 +60,4 @@ def textToVoice(self, text):
 
         except Exception as e:
             reply = Reply(ReplyType.ERROR, str(e))
-        finally:
-            return reply
+        return reply
```

---

### Incident Patch 7: `e5b535db` (2026-09-29)
**Commit Message**: fix: keep the agent profile form in sync when the roster refreshes

Co-authored-by: cowagent <cow@cowagent.ai>

**File**: `desktop/src/renderer/src/pages/AgentsPage.tsx` (modified, +9/-0)
```diff
@@ -360,6 +360,15 @@ const AgentProfilePane: React.FC<{ agent: AgentProfile; isDefault: boolean; onMu
   const [status, setStatus] = useState<{ text: string; error?: boolean } | null>(null)
   const [busy, setBusy] = useState(false)
 
+  // The roster can refresh after this pane mounts (e.g. a startup fallback
+  // replaced by the real snapshot), so follow the latest saved values.
+  useEffect(() => setName(agent.name || ''), [agent.name])
+  useEffect(() => setDescription(agent.description || ''), [agent.description])
+  useEffect(
+    () => setModelKey(agent.model ? `${agent.bot_type || ''}|${agent.model}` : ''),
+    [agent.model, agent.bot_type],
+  )
+
   // The model catalog is the one the composer chip uses (only providers with a
   // key show up). Reuse the session-settings store's copy when it has one;
   // otherwise fetch it here so the picker works even when no chat was opened
```

---

### Incident Patch 8: `96f633b1` (2026-09-29)
**Commit Message**: Merge pull request #3325 from Lesereingrape/fix/skill-zip-tempdir-leak

fix(cli): remove the temp dir when a repo archive cannot be extracted

**File**: `cli/commands/skill.py` (modified, +19/-13)
```diff
@@ -170,19 +170,25 @@ def _download_repo_zip(spec: str, branch: str = "main", host: str = "github", ti
     resp.raise_for_status()
 
     tmp_dir = tempfile.mkdtemp(prefix="cow-skill-")
-    zip_path = os.path.join(tmp_dir, "repo.zip")
-    with open(zip_path, "wb") as f:
-        f.write(resp.content)
-
-    extract_dir = os.path.join(tmp_dir, "extracted")
-    with zipfile.ZipFile(zip_path, "r") as zf:
-        _safe_extractall(zf, extract_dir)
-
-    # GitHub zips have a single top-level dir like "repo-main/"
-    top_items = [d for d in os.listdir(extract_dir) if not d.startswith(".")]
-    if len(top_items) == 1 and os.path.isdir(os.path.join(extract_dir, top_items[0])):
-        return tmp_dir, os.path.join(extract_dir, top_items[0])
-    return tmp_dir, extract_dir
+    try:
+        zip_path = os.path.join(tmp_dir, "repo.zip")
+        with open(zip_path, "wb") as f:
+            f.write(resp.content)
+
+        extract_dir = os.path.join(tmp_dir, "extracted")
+        with zipfile.ZipFile(zip_path, "r") as zf:
+            _safe_extractall(zf, extract_dir)
+
+        # GitHub zips have a single top-level dir like "repo-main/"
+        top_items = [d for d in os.listdir(extract_dir) if not d.startswith(".")]
+        if len(top_items) == 1 and os.path.isdir(os.path.join(extract_dir, top_items[0])):
+            return tmp_dir, os.path.join(extract_dir, top_items[0])
+        return tmp_dir, extract_dir
+    except Exception:
+        # The directory is only handed back through the return value, so a caller
+        # cannot clean it up after this function raises; do it here.
+        shutil.rmtree(tmp_dir, ignore_errors=True)
+        raise
 
 
 def _download_github_dir(owner, repo, branch, subpath, dest_dir):
```

**File**: `tests/test_skill_zip_tempdir_cleanup.py` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+"""A repo archive that cannot be extracted must not stay in the temp dir.
+
+`_download_repo_zip` creates its scratch directory before opening the archive,
+and callers can only clean up a directory they were handed back, so a failure
+after mkdtemp leaves the whole downloaded archive behind.
+"""
+
+import io
+import os
+import shutil
+import tempfile
+import zipfile
+
+import pytest
+
+import cli.commands.skill as skill_cmd
+
+
+class _Resp:
+    def __init__(self, content):
+        self.content = content
+        self.headers = {}
+
+    def raise_for_status(self):
+        return None
+
+
+def _leftovers(sandbox):
+    return sorted(p.name for p in sandbox.glob("cow-skill-*"))
+
+
+@pytest.fixture
+def sandbox(tmp_path, monkeypatch):
+    scratch = tmp_path / "tmp"
+    scratch.mkdir()
+    monkeypatch.setattr(tempfile, "tempdir", str(scratch))
+    return scratch
+
+
+def _serve(monkeypatch, payload):
+    monkeypatch.setattr(skill_cmd.requests, "get", lambda *a, **k: _Resp(payload))
+
+
+def test_payload_that_is_not_a_zip_is_cleaned_up(sandbox, monkeypatch):
+    _serve(monkeypatch, b"<html>captive proxy page, not a zip</html>")
+
+    with pytest.raises(zipfile.BadZipFile):
+        skill_cmd._download_repo_zip("owner/repo")
+
+    assert _leftovers(sandbox) == []
+
+
+def test_zip_with_a_traversal_entry_is_cleaned_up(sandbox, monkeypatch):
+    buf = io.BytesIO()
+    with zipfile.ZipFile(buf, "w") as zf:
+        zf.writestr("../escape.txt", "outside the extraction root")
+    _serve(monkeypatch, buf.getvalue())
+
+    with pytest.raises(ValueError, match="Unsafe zip entry"):
+        skill_cmd._download_repo_zip("owner/repo")
+
+    assert _leftovers(sandbox) == []
+
+
+def test_successful_download_keeps_its_directory(sandbox, monkeypatch):
+    buf = io.BytesIO()
+    with zipfile.ZipFile(buf, "w") as zf:
+        zf.writestr("SKILL.md", "---\nname: demo\ndescription: d\n---\n")
+    _serve(monkeypatch, buf.getvalue())
+
+    tmp_dir, repo_root = skill_cmd._download_repo_zip("owner/repo")
+    try:
+        assert os.path.isfile(os.path.join(repo_root, "SKILL.md"))
+        assert _leftovers(sandbox) == [os.path.basename(tmp_dir)]
+    finally:
+        shutil.rmtree(tmp_dir, ignore_errors=True)
```

---

### Incident Patch 9: `89eac32d` (2026-09-29)
**Commit Message**: Merge pull request #3326 from aniruddhaadak80/fix/google-voice-finally-swallows-errors

fix(voice): stop google_voice from turning errors into UnboundLocalError

**File**: `tests/test_google_voice_errors.py` (added, +143/-0)
```diff
@@ -0,0 +1,143 @@
+# encoding:utf-8
+"""
+Unit tests for voice/google/google_voice.py error handling.
+
+Both methods used to end in ``finally: return reply``. ``reply`` is only bound
+inside the try/except body, so any exception the clauses did not catch reached
+``return`` with the name still unbound: the caller saw
+``UnboundLocalError: cannot access local variable 'reply'`` and the real cause
+was gone. A ``return`` inside ``finally`` also discards a propagating
+``BaseException``, so a cancelled or interrupted turn looked like an ordinary
+error reply.
+
+``speech_recognition`` and ``gtts`` are optional extras, so they are stubbed the
+same way the other optional-dependency tests in this suite do.
+"""
+import os
+import sys
+import types
+import unittest
+import unittest.mock
+
+sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
+
+from bridge.reply import ReplyType
+
+
+class UnknownValueError(Exception):
+    pass
+
+
+class RequestError(Exception):
+    pass
+
+
+class _AudioFile:
+    def __init__(self, path):
+        self.path = path
+
+    def __enter__(self):
+        return self
+
+    def __exit__(self, *exc_info):
+        return False
+
+
+class _Recognizer:
+    """A recognizer whose outcome is chosen by ``mode``."""
+
+    def __init__(self, mode="ok"):
+        self.mode = mode
+
+    def record(self, source):
+        return object()
+
+    def recognize_google(self, audio, language=None):
+        if self.mode == "unknown":
+            raise UnknownValueError()
+        if self.mode == "request":
+            raise RequestError("no network")
+        if self.mode == "boom":
+            raise RuntimeError("audio backend exploded")
+        if self.mode == "interrupt":
+            raise KeyboardInterrupt()
+        return "hello"
+
+
+def _install_stubs():
+    sr = types.ModuleType("speech_recognition")
+    sr.UnknownValueError = UnknownValueError
+    sr.RequestError = RequestError
+    sr.AudioFile = _AudioFile
+    sr.Recognizer = _Recognizer
+    sys.modules.setdefault("speech_recognition", sr)
+
+    gtts = types.ModuleType("gtts")
+
+    class _TTS:
+        def __init__(self, text=None, lang=None):
+            self.fail = False
+
+        def save(self, path):
+            if self.fail:
+                raise OSError("disk full")
+
+    gtts.gTTS = _TTS
+    sys.modules.setdefault("gtts", gtts)
+
+
+_install_stubs()
+
+from voice.google.google_voice import GoogleVoice  # noqa: E402
+
+
+class TestGoogleVoiceToText(unittest.TestCase):
+    def _voice(self, mode):
+        voice = GoogleVoice()
+        voice.recognizer = _Recognizer(mode)
+        return voice
+
+    def test_successful_recognition_returns_text(self):
+        reply = self._voice("ok").voiceToText("f.wav")
+        self.assertEqual(reply.type, ReplyType.TEXT)
+        self.assertEqual(reply.content, "hello")
+
+    def test_unrecognisable_speech_returns_error(self):
+        reply = self._voice("unknown").voiceToText("f.wav")
+        self.assertEqual(reply.type, ReplyType.ERROR)
+
+    def test_request_failure_returns_error(self):
+        reply = self._voice("request").voiceToText("f.wav")
+        self.assertEqual(reply.type, ReplyType.ERROR)
+
+    def test_unexpected_exception_returns_error_not_unboundlocal(self):
+        """A RuntimeError must not surface as UnboundLocalError."""
+        reply = self._voice("boom").voiceToText("f.wav")
+        self.assertEqual(reply.type, ReplyType.ERROR)
+        self.assertTrue(reply.content)
+
+    def test_base_exception_is_not_swallowed(self):
+        """KeyboardInterrupt must propagate, not become an error reply."""
+        with self.assertRaises(KeyboardInterrupt):
+            self._voice("interrupt").voiceToText("f.wav")
+
+
+class TestGoogleTextToVoice(unittest.TestCase):
+    def test_base_exception_is_not_swallowed(self):
+        """textToVoice must not turn a cancellation into a normal error reply.
+
+        Patched on the module under test, because goog
```

**File**: `voice/google/google_voice.py` (modified, +10/-9)
```diff
@@ -25,13 +25,16 @@ def voiceToText(self, voice_file):
         try:
             text = self.recognizer.recognize_google(audio, language="zh-CN")
             logger.info("[Google] voiceToText text={} voice file name={}".format(text, voice_file))
-            reply = Reply(ReplyType.TEXT, text)
+            return Reply(ReplyType.TEXT, text)
         except speech_recognition.UnknownValueError:
-            reply = Reply(ReplyType.ERROR, "抱歉，我听不懂")
+            return Reply(ReplyType.ERROR, "抱歉，我听不懂")
         except speech_recognition.RequestError as e:
-            reply = Reply(ReplyType.ERROR, "抱歉，无法连接到 Google 语音识别服务；{0}".format(e))
-        finally:
-            return reply
+            return Reply(ReplyType.ERROR, "抱歉，无法连接到 Google 语音识别服务；{0}".format(e))
+        except Exception as e:
+            # Anything else used to hit `finally: return reply` with `reply`
+            # unbound, so the caller saw UnboundLocalError instead of the cause.
+            logger.error("[Google] voiceToText exception: {0}".format(e), exc_info=True)
+            return Reply(ReplyType.ERROR, "抱歉，我暂时听不清您的语音，请稍后再试吧~")
 
     def textToVoice(self, text):
         try:
@@ -40,8 +43,6 @@ def textToVoice(self, text):
             tts = gTTS(text=text, lang="zh")
             tts.save(mp3File)
             logger.info("[Google] textToVoice text={} voice file name={}".format(text, mp3File))
-            reply = Reply(ReplyType.VOICE, mp3File)
+            return Reply(ReplyType.VOICE, mp3File)
         except Exception as e:
-            reply = Reply(ReplyType.ERROR, str(e))
-        finally:
-            return reply
+            return Reply(ReplyType.ERROR, str(e))
```

---

### Incident Patch 10: `353eb7b9` (2026-09-29)
**Commit Message**: fix(dingtalk): cap remote download time and keep URL query out of temp file names

Co-authored-by: cowagent <cow@cowagent.ai>

**File**: `channel/dingtalk/dingtalk_channel.py` (modified, +17/-4)
```diff
@@ -10,6 +10,8 @@
 import logging
 import os
 import time
+from urllib.parse import unquote, urlparse
+
 import requests
 
 import dingtalk_stream
@@ -21,6 +23,7 @@
 from bridge.context import Context, ContextType
 from bridge.reply import Reply, ReplyType
 from channel.chat_channel import ChatChannel
+from channel.chat_message import safe_filename
 from common import state_dir
 from common.media_download import MAX_FILE_BYTES, MediaTooLargeError, download_to_file
 from channel.dingtalk.dingtalk_message import DingTalkMessage
@@ -34,6 +37,8 @@
 from common.time_check import time_checker
 from config import conf
 
+_MAX_REMOTE_FILE_SECONDS = 300
+
 
 def _markdown_preview_title(markdown: str, limit: int = 30) -> str:
     """Plain-text title for a webhook markdown message.
@@ -447,17 +452,25 @@ def upload_media(self, file_path: str, media_type: str = "image") -> str:
         if file_path.startswith("http://") or file_path.startswith("https://"):
             try:
                 import uuid
-                file_name = os.path.basename(file_path) or f"media_{uuid.uuid4()}"
+                # Query strings may carry tokens and characters Windows rejects
+                # in file names; keep only the sanitized last path segment.
+                file_name = (
+                    safe_filename(unquote(os.path.basename(urlparse(file_path).path)))
+                    or f"media_{uuid.uuid4()}"
+                )
                 temp_file = os.path.join(str(state_dir.tmp_dir()), file_name)
                 try:
-                    download_to_file(file_path, temp_file, MAX_FILE_BYTES, timeout=(5, 60))
+                    download_to_file(
+                        file_path, temp_file, MAX_FILE_BYTES,
+                        timeout=(5, 60), max_seconds=_MAX_REMOTE_FILE_SECONDS,
+                    )
                 except MediaTooLargeError:
-                    logger.error(f"[DingTalk] Downloaded file exceeds size limit: {file_path}")
+                    logger.error("[DingTalk] Remote file exceeds size limit, skipped upload")
                     return None
                 file_path = temp_file
                 logger.info(f"[DingTalk] Downloaded file to {file_path}")
             except Exception as e:
-                logger.error(f"[DingTalk] Error downloading file: {e}")
+                logger.error(f"[DingTalk] Error downloading file: {type(e).__name__}")
                 return None
         
         if not os.path.exists(file_path):
```

**File**: `docs/zh/releases/v2.2.0.mdx` (modified, +1/-1)
```diff
@@ -109,7 +109,7 @@ Thanks @liuns-yang (#3191)
 
 本版本对外部资源访问和本地文件写入做了系统性加固：
 
-- **下载限制**：通道收发媒体、终端图片、视觉识别、关键词文件等外部下载统一限制文件大小和总耗时，避免超大文件或慢速连接拖垮服务；视觉识别下载图片时对每次重定向重新校验地址。Thanks @rudycelekli (#3255, #3256, #3257, #3264, #3266, #3267, #3268, #3269, #3270, #3271, #3272)、@c020627 (#3219, #3225, #3252, #3300)
+- **下载限制**：通道收发媒体、终端图片、视觉识别、关键词文件等外部下载统一限制文件大小和总耗时，避免超大文件或慢速连接拖垮服务；视觉识别下载图片时对每次重定向重新校验地址。Thanks @rudycelekli (#3255, #3256, #3257, #3264, #3266, #3267, #3268, #3269, #3270, #3271, #3272)、@c020627 (#3219, #3225, #3252, #3300, #3322)
 - **请求超时**：模型、语音、翻译等外部请求全部设置超时，上游无响应时不再卡住对话。Thanks @c020627 (#3217, #3220, #3240, #3254, #3275)
 - **配置安全写入**：`config.json`、插件配置、模型列表、定时任务、技能配置、凭证文件、`MEMORY.md` 等改为原子写入，写入中途失败不会损坏原文件；定时任务文件损坏时自动从备份恢复。Thanks @c020627 (#3223, #3239, #3241, #3242, #3259, #3273, #3274, #3276, #3279, #3280, #3281)、@rudycelekli (#3260)
 - **临时文件管理**：通道接收的文件名限制在临时目录内并限制长度（Thanks @Lesereingrape #3247, #3248、@c020627 #3212, #3301）；下载的媒体、回复附件和语音合成文件统一存放在对应 Agent 的临时目录（Thanks @c020627 #3198, #3207, #3208, #3213）。
```

**File**: `tests/test_dingtalk_bounded_media_download.py` (modified, +9/-0)
```diff
@@ -79,6 +79,15 @@ def test_http_url_over_size_limit_rejected(monkeypatch, tmp_path):
     assert _channel().upload_media("https://evil.example/huge.bin", "file") is None
 
 
+def test_http_url_query_string_stays_out_of_the_file_name(monkeypatch, tmp_path):
+    get = FakeResp(content=b"<media data>")
+    post = FakeResp(json_data={"errcode": 0, "media_id": "mid-3"})
+    _stub(monkeypatch, get, post, tmp_path)
+    url = "https://cdn.example/dir/%E6%8A%A5%E5%91%8A.pdf?token=secret&x=a/b"
+    assert _channel().upload_media(url, "file") == "mid-3"
+    assert [p.name for p in tmp_path.iterdir()] == ["报告.pdf"]
+
+
 def test_local_file_url_still_uploaded(monkeypatch, tmp_path):
     local = tmp_path / "clip.mp4"
     local.write_bytes(b"<media data>")
```

#### Recent Merged Pull Requests:
- **PR #3408** (2026-09-30): fix(mcp): resolve stdio command via PATHEXT on Windows (@6vision)
- **PR #3326** (2026-09-29): fix(voice): stop google_voice from turning errors into UnboundLocalError (@aniruddhaadak80)
- **PR #3325** (2026-09-29): fix(cli): remove the temp dir when a repo archive cannot be extracted (@Lesereingrape)
- **PR #3322** (2026-09-29): fix(dingtalk): cap remote media download at MAX_FILE_BYTES (@c020627)
- **PR #3321** (2026-09-29): fix(wechatmp): upload a local video reply instead of crashing on its path (@Lesereingrape)
- **PR #3319** (2026-09-29): fix(cli): overlay the live roster when restoring a backup (@Lesereingrape)
- **PR #3316** (2026-09-29): fix(channel): cancel queued work under the agent-scoped session key (@Lesereingrape)
- **PR #3314** (2026-09-29): fix(plugins): normalize a damaged plugins.json entry instead of losing every plugin (@Lesereingrape)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

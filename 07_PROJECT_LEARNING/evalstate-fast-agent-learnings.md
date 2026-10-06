# Forensic Learning Record (Deep Inspection): evalstate/fast-agent

> **Canonical Artifact**: `07_PROJECT_LEARNING/evalstate-fast-agent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/evalstate/fast-agent](https://github.com/evalstate/fast-agent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:01:49.695Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `evalstate/fast-agent`
- **Description**: Code, Build and Evaluate agents - excellent Model and Skills/MCP/ACP/A2A Support
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 3928 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `examples/hf-toad-cards/hooks/fix_ripgrep_tool_calls.py`
```
"""Lightweight guard for the ripgrep helper card pack."""

from __future__ import annotations

import json
import shlex
from pathlib import Path
from typing import TYPE_CHECKING, Any

from fast_agent.core.logging.logger import get_logger

if TYPE_CHECKING:
    from fast_agent.hooks.hook_context import HookContext

logger = get_logger(__name__)

_TOOL_NAME_CORRECTIONS = {
    "exec": "execute",
    "executescript": "execute",
    "execscript": "execute",
    "executor": "execute",
    "exec_command": "execute",
}
_INVALID_RIPGREP_FLAGS = {"-R", "--recursive"}
_RIPGREP_BINARIES = {"rg", "ripgrep", "rg.exe", "ripgrep.exe"}
_ALLOWED_BINARIES = {
    "rg",
    "ripgrep",
    "rg.exe",
    "ripgrep.exe",
    "find",
    "fd",
    "fdfind",
    "ls",
    "wc",
    "sort",
    "head",
    "tail",
    "cut",
    "uniq",
    "tr",
    "grep",
    "sed",
    "awk",
    "xargs",
    "printf",
    "echo",
}
_DEFAULT_COMMAND_BUDGET = 6


def _first_token(command: str) -> str | None:
    try:
        tokens = shlex.split(command)
    except ValueError:
        return None
    return tokens[0] if tokens else None


def _is_ripgrep_command(command: str) -> bool:
    first = _first_token(command)
    return bool(first and Path(first).name.lower() in _RIPGREP_BINARIES)


def _split_shell_segments(command: str) -> list[str] | None:
    try:
        lexer = shlex.shlex(command, posix=True, punctuation_chars="|&;")
        lexer.whitespace_split = True
        tokens = list(lexer)
    except ValueError:
        return None

    segments: list[str] = []
    current: list[str] = []
    for token in tokens:
        if token in {"|", "||", "&&", ";"}:
            if current:
                segments.append(shlex.join(current))
                current = []
            continue
        current.append(token)

    if current:
        segments.append(shlex.join(current))
    return segments


def _normalize_tool_name(name: str) -> tuple[str, bool]:
    corrected = _TOOL_NAME_CORRECTIONS.get(name)
    if corrected is not None:
        return corrected, True
    if name.startswith("exec") and name != "execute":
        return "execute", True
    return name, False


def _is_allowed_shell_command(command: str) -> bool:
    if not command.strip():
        return False
    if any(token in command for token in (">", "<", "$(", "`")):
        return False

    segments = _split_shell_segments(command)
    if not segments:
        return False

    for segment in segments:
        first = _first_token(segment)
        if not first or Path(first).name.lower() not in _ALLOWED_BINARIES:
            return False

    return True


def _extract_text_items(content: Any) -> list[str]:
    texts: list[str] = []
    if not isinstance(content, list):
        return texts

    for item in content:
        if isinstance(item, dict):
            if item.get("type") == "text" and isinstance(item.get("text"), str):
                texts.append(item["text"])
            continue

        item_type = getattr(item, "type", None)
        item_text = getattr(item, "text", None)
        if item_type == "text" and isinstance(item_text, str):
            texts.append(item_text)

    return texts


def _recent_messages(ctx: "HookContext", *, limit: int = 8) -> list[Any]:
    recent = list(ctx.message_history[-limit:])
    delta_messages = getattr(ctx.runner, "delta_messages", None)
    if isinstance(delta_messages, list):
        for message in delta_messages[-limit:]:
            if message not in recent:
                recent.append(message)
    return recent[-limit:]


def _extract_command_budget(ctx: "HookContext") -> int:
    for message in reversed(_recent_messages(ctx)):
        if getattr(message, "role", None) != "user":
            continue

        for text in _extract_text_items(getattr(message, "content", None)):
            candidate = text.strip()
            if not (candidate.startswith("{") and candidate.endswith("}")):
                continue
            try:
                payload = json.loads(candidate)
            except Exception:
                continue
            if not isinstance(payload, dict):
                continue
            value = payload.get("max_commands")
            if isinstance(value, int):
                return max(1, min(value, _DEFAULT_COMMAND_BUDGET))

    return _DEFAULT_COMMAND_BUDGET


def _extract_repo_root(ctx: "HookContext") -> Path | None:
    for message in reversed(_recent_messages(ctx)):
        if getattr(message, "role", None) != "user":
            continue

        for text in _extract_text_items(getattr(message, "content", None)):
            candidate = text.strip()
            if not (candidate.startswith("{") and candidate.endswith("}")):
                continue
            try:
                payload = json.loads(candidate)
            except Exception:
                continue
            if not isinstance(payload, dict):
                continue
            value = payload.get("repo_root")
            if not isinstance(value, str):
                continue
            path = Path(value)
            if path.is_absolute() and path.exists() and path.is_dir():
                return path.resolve()

    return None


def _strip_invalid_ripgrep_flags(command: str) -> tuple[str, bool]:
    if not _is_ripgrep_command(command):
        return command, False

    segments = _split_shell_segments(command)
    if not segments or len(segments) > 1:
        return command, False

    try:
        tokens = shlex.split(command)
    except ValueError:
        return command, False

    rewritten = [token for token in tokens if token not in _INVALID_RIPGREP_FLAGS]
    normalized = shlex.join(rewritten)
    return normalized, normalized != command


def _strip_absolute_glob_operands(command: str) -> tuple[str, bool]:
    if not _is_ripgrep_command(command):
        return command, False

    segments = _split_shell_segments(command)
    if not segments or len(segments) > 1:
        return command, False

    try:
        tokens = shlex.split(command)
    except ValueError:
        return command, False

    is_rg_files = "--files" in tokens
    rewritten: list[str] = []
    salvaged_paths: list[str] = []
    changed = False
    i = 0
    while i < len(tokens):
        token = tokens[i]
        if token in {"-g", "--glob"} and i + 1 < len(tokens):
            operand = tokens[i + 1]
            if Path(operand).is_absolute():
                changed = True
                if is_rg_files and Path(operand).exists():
                    salvaged_paths.append(operand)
                i += 2
                continue
            rewritten.extend([token, operand])
            i += 2
            continue

        if token.startswith("--glob="):
            operand = token.split("=", 1)[1]
            if Path(operand).is_absolute():
                changed = True
                if is_rg_files and Path(operand).exists():
                    salvaged_paths.append(operand)
                i += 1
                continue

        rewritten.append(token)
        i += 1

    if salvaged_paths:
        rewritten.extend(salvaged_paths)

    return shlex.join(rewritten), changed


def _normalize_relative_rg_paths(command: str, repo_root: Path | None) -> str:
    if repo_root is None or not _is_ripgrep_command(command):
        return command

    segments = _split_shell_segments(command)
    if not segments or len(segments) > 1:
        return command

    try:
        tokens = shlex.split(command)
    except ValueError:
        return command

    rewritten: list[str] = []
    for idx, token in enumerate(tokens):
        if idx == 0 or token.startswith("-") or "/" not in token:
            rewritten.append(token)
            continue

        token_path = Path(token)
        if token_path.is_absolute() or token_path.exists():
            rewritten.append(token)
            continue

        candidate = (repo_root / token).resolve()
        if candidate.exists():
            rewritten.append(str(candidate))
            continue

        rewritten.append(token)

    return shlex.join(rewritten)


async def fix_ripgrep_tool_calls(ctx: "HookContext") -> None:
    """Normalize tool calls and keep ripgrep search loops bounded."""
    if ctx.hook_type != "before_tool_call":
        return

    message = ctx.message
    if not message.tool_calls:
        return

    seen_commands: set[str] = getattr(ctx.runner, "_ripgrep_seen_commands", set())
    command_count: int = getattr(ctx.runner, "_ripgrep_command_count", 0)
    command_budget: int = getattr(
        ctx.runner, "_ripgrep_command_budget", 0
    ) or _extract_command_budget(ctx)
    budget_exhausted: bool = bool(getattr(ctx.runner, "_ripgrep_budget_exhausted", False))
    repo_root = _extract_repo_root(ctx)

    for tool_id, tool_call in message.tool_calls.items():
        normalized_name, corrected = _normalize_tool_name(tool_call.params.name)
        if corrected:
            logger.warning(
                "Corrected hallucinated tool name",
                data={
                    "tool_id": tool_id,
                    "original": tool_call.params.name,
                    "corrected": normalized_name,
                },
            )
            tool_call.params.name = normalized_name

        if tool_call.params.name != "execute":
            continue

        args = tool_call.params.arguments
        if not isinstance(args, dict):
            continue

        command = args.get("command")
        if not isinstance(command, str):
            continue

        if budget_exhausted:
            args["command"] = (
                "printf 'Search command budget reached; STOP. Do not call tools again; return final best-effort summary now.\\n'"
            )
            continue

        cleaned, changed_flags = _strip_invalid_ripgrep_flags(command)
        cleaned, changed_globs = _strip_absolute_glob_operands(cleaned)
        cleaned = _normalize_relative_rg_paths(cleaned, repo_r
```

### Core Architecture Module: `examples/tool-runner-hooks/tool_runner_hooks.py`
```
import asyncio

from fast_agent import FastAgent
from fast_agent.agents.agent_types import AgentConfig
from fast_agent.agents.tool_agent import ToolAgent
from fast_agent.agents.tool_runner import ToolRunnerHooks
from fast_agent.context import Context
from fast_agent.interfaces import ToolRunnerHookCapable
from fast_agent.types import PromptMessageExtended


def get_video_call_transcript(video_id: str) -> str:
    return "Assistant: Hi, how can I assist you today?\n\nCustomer: Hi, I wanted to ask you about last invoice I received..."


class HookedToolAgent(ToolAgent, ToolRunnerHookCapable):
    def __init__(
        self,
        config: AgentConfig,
        context: Context | None = None,
    ):
        tools = [get_video_call_transcript]
        super().__init__(config, tools, context)
        self._hooks = ToolRunnerHooks(
            before_llm_call=self._add_style_hint,
            after_tool_call=self._log_tool_result,
        )

    @property
    def tool_runner_hooks(self) -> ToolRunnerHooks | None:
        return self._hooks

    async def _add_style_hint(self, runner, messages: list[PromptMessageExtended]) -> None:
        if runner.iteration == 0:
            runner.append_messages("Keep the answer to one short sentence.")

    async def _log_tool_result(self, runner, message: PromptMessageExtended) -> None:
        if message.tool_results:
            tool_names = ", ".join(message.tool_results.keys())
            print(f"[hook] tool results received: {tool_names}")


fast = FastAgent("Example Tool Use Application (Hooks)")


@fast.custom(HookedToolAgent)
async def main() -> None:
    async with fast.run() as agent:
        await agent.default.generate(
            "What is the topic of the video call no.1234?",
        )
        await agent.interactive()


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `examples/tool-runner-hooks/tool_runner_lowlevel.py`
```
import asyncio

from mcp_types import TextContent

from fast_agent.agents.agent_types import AgentConfig
from fast_agent.agents.tool_agent import ToolAgent
from fast_agent.agents.tool_runner import ToolRunner
from fast_agent.core import Core
from fast_agent.llm.model_factory import ModelFactory
from fast_agent.types import PromptMessageExtended


def lookup_order_status(order_id: str) -> str:
    return f"Order {order_id} is packed and ready to ship."


async def main() -> None:
    core: Core = Core()
    await core.initialize()

    config = AgentConfig(name="order_bot")
    agent = ToolAgent(config, tools=[lookup_order_status], context=core.context)
    await agent.attach_llm(ModelFactory.create_factory("haiku"))

    messages = [
        PromptMessageExtended(
            role="user",
            content=[
                TextContent(type="text", text="Check order 12345, then summarize in one line.")
            ],
        )
    ]

    runner = ToolRunner(
        agent=agent,
        messages=messages,
    )

    async for assistant_message in runner:
        text = assistant_message.last_text() or "<no text>"
        print(f"[assistant] {text}")

    await core.cleanup()


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `scripts/hook_demo_run.py`
```
"""Run the hook demo agent to exercise hook messaging and failures."""

from __future__ import annotations

import asyncio
from pathlib import Path

from fast_agent import FastAgent


async def main() -> None:
    fast = FastAgent(
        name="hook-demo",
        config_path="fastagent.config.yaml",
        parse_cli_args=False,
        environment_dir=Path(".dev"),
    )

    async with fast.run() as app:
        print("\n--- Hook demo: normal call ---")
        response = await app.send(
            "Call the echo_text tool with text 'hook demo', then reply with its output.",
            agent_name="hook-kimi",
        )
        print(response)

        print("\n--- Hook demo: trigger hook failure ---")
        try:
            response = await app.send(
                "Call the echo_text tool with text 'hook-fail', then reply with its output.",
                agent_name="hook-kimi",
            )
            print(response)
        except Exception as exc:
            print(f"Hook failure propagated to caller: {exc}")


if __name__ == "__main__":
    asyncio.run(main())

```

### Core Architecture Module: `src/fast_agent/agents/tool_loop_progress.py`
```
"""Progress reporting for tool-runner loops."""

from __future__ import annotations

import asyncio
from contextlib import suppress
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from fast_agent.mcp.tool_execution_handler import ToolExecutionHandler


class ToolLoopProgressEmitter:
    def __init__(self, handler: ToolExecutionHandler, agent_name: str) -> None:
        self._handler = handler
        self._agent_name = agent_name
        self._tool_call_id: str | None = None
        self._step = 0
        self._finished = False
        self._lock = asyncio.Lock()

    async def _ensure_started(self) -> str | None:
        if self._tool_call_id:
            return self._tool_call_id
        try:
            self._tool_call_id = await self._handler.on_tool_start(
                "agent_loop", self._agent_name, None
            )
        except Exception:
            self._tool_call_id = None
        return self._tool_call_id

    async def step(self, label: str) -> None:
        async with self._lock:
            if self._finished:
                return
            self._step += 1
            tool_call_id = await self._ensure_started()
            if not tool_call_id:
                return
            message = f"step {self._step}"
            if label:
                message = f"{message} ({label})"
            with suppress(Exception):
                await self._handler.on_tool_progress(tool_call_id, float(self._step), None, message)

    async def finish(self, success: bool, error: str | None = None) -> None:
        async with self._lock:
            if self._finished:
                return
            self._finished = True
            if not self._tool_call_id:
                return
            with suppress(Exception):
                await self._handler.on_tool_complete(self._tool_call_id, success, None, error)

```

### Core Architecture Module: `src/fast_agent/cli/asyncio_utils.py`
```
from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    import asyncio


def set_asyncio_exception_handler(loop: asyncio.AbstractEventLoop) -> None:
    """Attach a detailed exception handler to the provided event loop."""
    logger = logging.getLogger("fast_agent.asyncio")

    def _handler(_loop: asyncio.AbstractEventLoop, context: dict[str, Any]) -> None:
        message = context.get("message", "(no message)")
        task = context.get("task")
        future = context.get("future")
        handle = context.get("handle")
        source_traceback = context.get("source_traceback")
        exception = context.get("exception")

        details = {
            "message": message,
            "task": repr(task) if task else None,
            "future": repr(future) if future else None,
            "handle": repr(handle) if handle else None,
            "source_traceback": [str(frame) for frame in source_traceback]
            if source_traceback
            else None,
        }

        logger.error("Unhandled asyncio error: %s", message)
        logger.error("Asyncio context: %s", json.dumps(details, indent=2))

        if exception:
            logger.exception("Asyncio exception", exc_info=exception)

    try:
        loop.set_exception_handler(_handler)
    except Exception:
        logger.exception("Failed to set asyncio exception handler")

```

### Core Architecture Module: `src/fast_agent/commands/handlers/_text_utils.py`
```
"""Shared text utilities for command handlers."""

from fast_agent.utils.text import strip_to_none


def truncate_description(description: str, char_limit: int = 240) -> str:
    """Truncate a description intelligently at sentence or word boundaries.

    Args:
        description: The text to truncate.
        char_limit: Maximum character length (default 240).

    Returns:
        The truncated description with "..." appended if truncated.
    """
    if char_limit <= 0:
        return ""
    description = strip_to_none(description) or ""
    if len(description) <= char_limit:
        return description

    truncate_pos = char_limit
    sentence_break = description.rfind(". ", 0, char_limit)
    if sentence_break != -1 and sentence_break > char_limit - 50:
        truncate_pos = sentence_break + 1
    else:
        word_break = description.rfind(" ", 0, char_limit)
        if word_break != -1 and word_break > char_limit - 30:
            truncate_pos = word_break

    return description[:truncate_pos].rstrip() + "..."

```

### Core Architecture Module: `src/fast_agent/commands/renderers/command_markdown.py`
```
"""Markdown rendering helpers for command outcomes."""

from __future__ import annotations

from typing import TYPE_CHECKING

from fast_agent.commands.renderers.markdown_blocks import markdown_heading
from fast_agent.commands.results import command_channel_label
from fast_agent.utils.markdown import escape_markdown_text, markdown_code_block
from fast_agent.utils.text import strip_to_none

if TYPE_CHECKING:
    from collections.abc import Iterable

    from fast_agent.commands.results import CommandMessage, CommandOutcome


def _formatted_message_text(message: "CommandMessage") -> str | None:
    plain_text = message.plain_text()
    if strip_to_none(plain_text) is None:
        return None
    if message.verbatim:
        text = markdown_code_block(plain_text)
    elif message.render_markdown:
        text = plain_text.strip()
    else:
        text = escape_markdown_text(plain_text.strip())

    label = command_channel_label(message.channel)
    if label is not None and message.channel != "info":
        separator = "\n\n" if message.verbatim else " "
        return f"**{label}:**{separator}{text}"
    return text


def _message_markdown_lines(message: "CommandMessage") -> list[str]:
    lines: list[str] = []
    title = markdown_heading(message.title or "", level=2)
    if title:
        lines.extend([title, ""])

    message_text = _formatted_message_text(message)
    if message_text is not None:
        lines.extend([message_text, ""])
    return lines


def render_command_outcome_markdown(
    outcome: "CommandOutcome",
    *,
    heading: str,
    extra_messages: Iterable["CommandMessage"] | None = None,
) -> str:
    heading_line = markdown_heading(heading)
    lines: list[str] = []
    if heading_line:
        lines.extend([heading_line, ""])

    messages = list(outcome.messages)
    if extra_messages:
        messages.extend(extra_messages)

    for message in messages:
        lines.extend(_message_markdown_lines(message))

    return "\n".join(lines).rstrip()

```

### Core Architecture Module: `src/fast_agent/commands/renderers/history_markdown.py`
```
"""Markdown renderers for history summaries."""

from __future__ import annotations

from typing import TYPE_CHECKING

from fast_agent.commands.renderers.markdown_blocks import markdown_heading
from fast_agent.utils.count_display import format_count, format_count_breakdown
from fast_agent.utils.markdown import escape_markdown_table_cell, escape_markdown_text
from fast_agent.utils.text import strip_to_none
from fast_agent.utils.timing_display import format_duration_ms, format_rate_per_second

if TYPE_CHECKING:
    from fast_agent.commands.history_summaries import (
        HistoryMessageSnippet,
        HistoryOverview,
        HistoryTurnReport,
        HistoryTurnSummary,
    )


def _format_labeled_parts(parts: dict[str, str]) -> str:
    return ", ".join(f"{label} {value}" for label, value in parts.items())


def _format_positive_duration_ms(value: float) -> str:
    return format_duration_ms(value if value > 0 else None)


def _format_turn_table_row(turn: "HistoryTurnSummary") -> str:
    turn_text = escape_markdown_table_cell(f"{turn.user_snippet} → {turn.assistant_snippet}")
    return (
        "| "
        f"{turn.turn_index} | "
        f"{turn_text} | "
        f"{format_duration_ms(turn.turn_time_ms)} | "
        f"{format_duration_ms(turn.tool_time_ms)} | "
        f"{format_duration_ms(turn.ttft_ms)} | "
        f"{format_duration_ms(turn.response_ms)} | "
        f"{format_rate_per_second(turn.tps)} |"
    )


def _format_recent_message_line(message: "HistoryMessageSnippet") -> str:
    role = strip_to_none(message.role) or "unknown"
    snippet = strip_to_none(message.snippet)
    if snippet is None:
        return f"- {escape_markdown_text(role)}:"
    return f"- {escape_markdown_text(role)}: {escape_markdown_text(snippet)}"


def render_history_overview_markdown(
    overview: "HistoryOverview",
    *,
    heading: str,
) -> str:
    lines = [markdown_heading(heading), ""]
    lines.append(
        format_count_breakdown(
            "Messages",
            overview.message_count,
            user=overview.user_message_count,
            assistant=overview.assistant_message_count,
        )
    )
    lines.append(
        format_count_breakdown(
            "Tool Calls",
            overview.tool_calls,
            successes=overview.tool_successes,
            errors=overview.tool_errors,
        )
    )

    if overview.recent_messages:
        lines.append("")
        lines.append(f"Recent {format_count(len(overview.recent_messages), 'message')}:")
        lines.extend(_format_recent_message_line(message) for message in overview.recent_messages)
    else:
        lines.append("")
        lines.append("No messages yet.")

    return "\n".join(lines)


def render_history_turn_report_markdown(
    report: "HistoryTurnReport",
    *,
    heading: str,
) -> str:
    lines = [markdown_heading(heading), ""]

    lines.append(f"Turns: {report.turn_count}")
    lines.append(
        format_count_breakdown(
            "Tools",
            report.total_tool_calls,
            errors=report.total_tool_errors,
        )
    )
    lines.append(
        "Totals: "
        + _format_labeled_parts(
            {
                "turn": _format_positive_duration_ms(report.total_turn_time_ms),
                "llm": _format_positive_duration_ms(report.total_llm_time_ms),
                "tool": _format_positive_duration_ms(report.total_tool_time_ms),
            }
        )
    )
    lines.append(
        "Averages: "
        + _format_labeled_parts(
            {
                "turn": format_duration_ms(report.average_turn_time_ms),
                "tool": format_duration_ms(report.average_tool_time_ms),
                "ttft": format_duration_ms(report.average_ttft_ms),
                "resp": format_duration_ms(report.average_response_ms),
                "tps": format_rate_per_second(report.average_tps),
            }
        )
    )

    if not report.turns:
        lines.extend(["", "No user turns yet."])
        return "\n".join(lines)

    lines.extend(
        [
            "",
            "| # | Turn | Time | Tool | TTFT | Resp | TPS |",
            "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
        ]
    )

    lines.extend(_format_turn_table_row(turn) for turn in report.turns)

    return "\n".join(lines)

```

### Core Architecture Module: `src/fast_agent/commands/renderers/markdown_blocks.py`
```
"""Small Markdown block helpers shared by command renderers."""

from __future__ import annotations

import textwrap

from fast_agent.utils.markdown import escape_markdown_text
from fast_agent.utils.text import strip_to_none


def normalize_markdown_heading(heading: str) -> str:
    return " ".join(heading.lstrip("# ").split())


def markdown_heading(heading: str, *, level: int = 1) -> str:
    normalized = normalize_markdown_heading(heading)
    if not normalized:
        return ""
    return f"{'#' * max(1, level)} {escape_markdown_text(normalized)}"


def wrapped_quote_lines(
    text: str | None,
    *,
    prefix: str = "> ",
    width: int = 88,
    max_lines: int = 4,
) -> list[str]:
    normalized = strip_to_none(text)
    if normalized is None or max_lines <= 0:
        return []

    wrapped = textwrap.wrap(normalized, width=max(1, width))
    lines = [f"{prefix}{line}" for line in wrapped[:max_lines]]
    if len(wrapped) > max_lines:
        lines.append(f"{prefix}…")
    return lines

```

### Core Architecture Module: `src/fast_agent/commands/renderers/session_markdown.py`
```
"""Markdown renderers for session summaries."""

from __future__ import annotations

import re
from typing import TYPE_CHECKING

from fast_agent.commands.renderers.markdown_blocks import markdown_heading
from fast_agent.utils.markdown import escape_markdown_text
from fast_agent.utils.text import strip_to_none

if TYPE_CHECKING:
    from fast_agent.commands.session_summaries import SessionListSummary
    from fast_agent.session import SessionEntrySummary


def _format_session_entry(entry: str, summary: "SessionEntrySummary") -> str:
    if not summary.is_pinned:
        return escape_markdown_text(entry)

    display_name = strip_to_none(summary.display_name)
    if display_name is None:
        return escape_markdown_text(entry)

    match = re.match(
        rf"^(?P<prefix>\s*{summary.index}\.\s+)(?P<name>{re.escape(display_name)})(?=$|\s)",
        entry,
    )
    if match is None:
        return escape_markdown_text(entry)

    return (
        escape_markdown_text(match.group("prefix"))
        + f"**{escape_markdown_text(match.group('name'))}**"
        + escape_markdown_text(entry[match.end("name") :])
    )


def render_session_list_markdown(
    summary: "SessionListSummary",
    *,
    heading: str,
) -> str:
    lines = [markdown_heading(heading), ""]

    if not summary.entries:
        lines.extend(["No sessions found.", "", summary.usage])
        return "\n".join(lines)

    lines.extend(
        _format_session_entry(entry, entry_summary)
        for entry, entry_summary in zip(summary.entries, summary.entry_summaries, strict=False)
    )
    lines.extend(["", summary.usage])
    return "\n".join(lines)

```

### Core Architecture Module: `src/fast_agent/commands/renderers/skills_markdown.py`
```
"""Markdown renderers for skill summaries."""

from __future__ import annotations

from pathlib import Path
from typing import TYPE_CHECKING

from fast_agent.commands.renderers.markdown_blocks import (
    markdown_heading,
    wrapped_quote_lines,
)
from fast_agent.skills.command_support import SKILLS_ADD_HINT_SLASH
from fast_agent.skills.provenance import format_skill_provenance_details
from fast_agent.utils.markdown import escape_markdown_text, markdown_code_span
from fast_agent.utils.path_display import format_relative_path
from fast_agent.utils.text import strip_to_none

if TYPE_CHECKING:
    from collections.abc import Sequence

    from fast_agent.skills.models import MarketplaceSkill
    from fast_agent.skills.registry import SkillManifest


def _format_skill_entry(
    *,
    index: int,
    name: str,
    description: str | None,
    source: str | None,
    provenance: str | None,
    installed: str | None,
) -> list[str]:
    lines: list[str] = [f"{index}. **{escape_markdown_text(name)}**"]
    escaped_description = escape_markdown_text(description) if description else None
    lines.extend(wrapped_quote_lines(escaped_description, prefix="    > "))

    _append_skill_detail(lines, "Source", source)
    _append_skill_detail(lines, "Provenance", provenance)
    _append_skill_detail(lines, "Installed", installed)

    lines.append("")
    return lines


def _append_skill_detail(lines: list[str], label: str, value: str | None) -> None:
    if not value:
        return
    lines.append(f"    > **{label}:**")
    lines.append(f"    > {value}")


def _format_manifest_entry(
    *,
    index: int,
    manifest: "SkillManifest",
    cwd: Path,
) -> list[str]:
    source_path = manifest.path.parent if manifest.path.is_file() else manifest.path
    display_path = format_relative_path(source_path, cwd=cwd)
    provenance, installed = format_skill_provenance_details(source_path)
    return _format_skill_entry(
        index=index,
        name=manifest.name,
        description=manifest.description,
        source=markdown_code_span(display_path),
        provenance=provenance,
        installed=installed,
    )


def render_skill_list(manifests: Sequence[SkillManifest], *, cwd: Path | None = None) -> list[str]:
    lines: list[str] = []
    cwd = cwd or Path.cwd()

    for index, manifest in enumerate(manifests, 1):
        lines.extend(_format_manifest_entry(index=index, manifest=manifest, cwd=cwd))

    return lines


def _skills_browse_guidance() -> list[str]:
    return [
        "Use `/skills available` to browse available skills.",
        "",
        "Search with `/skills search <query>`.",
    ]


def _skills_marketplace_guidance() -> list[str]:
    return [
        SKILLS_ADD_HINT_SLASH,
        "Search available skills with `/skills search <query>`.",
        "Change registry with `/skills registry`.",
    ]


def render_skills_by_directory(
    manifests_by_dir: dict[Path, list[SkillManifest]],
    *,
    heading: str,
    cwd: Path | None = None,
) -> str:
    lines = [markdown_heading(heading), ""]
    cwd = cwd or Path.cwd()
    total_skills = sum(len(m) for m in manifests_by_dir.values())
    skill_index = 0

    for directory, manifests in manifests_by_dir.items():
        display_path = format_relative_path(directory, cwd=cwd)
        lines.append(f"## {markdown_code_span(display_path)}")
        lines.append("")

        if not manifests:
            lines.append("No skills in this directory.")
            lines.append("")
            continue

        for manifest in manifests:
            skill_index += 1
            lines.extend(_format_manifest_entry(index=skill_index, manifest=manifest, cwd=cwd))

    if total_skills == 0:
        lines.extend(_skills_browse_guidance())
    else:
        lines.append("Remove a skill with `/skills remove <number|name>`.")
        lines.append("")
        lines.extend(_skills_browse_guidance())
        lines.append("")
        lines.append("Change skills registry with `/skills registry <number|url|path>`.")

    return "\n".join(lines)


def render_skills_remove_list(
    *,
    manager_dir: Path,
    manifests: Sequence[SkillManifest],
    heading: str,
    cwd: Path | None = None,
) -> str:
    lines = [markdown_heading(heading), ""]
    cwd = cwd or Path.cwd()
    display_dir = format_relative_path(manager_dir, cwd=cwd)
    lines.append(f"## {markdown_code_span(display_dir)}")
    lines.append("")

    if not manifests:
        lines.append("No local skills to remove.")
        return "\n".join(lines)

    for index, manifest in enumerate(manifests, 1):
        lines.extend(_format_manifest_entry(index=index, manifest=manifest, cwd=cwd))

    lines.append("Remove with `/skills remove <number|name>`.")
    return "\n".join(lines)


def render_marketplace_skills(
    marketplace: Sequence[MarketplaceSkill],
    *,
    heading: str,
    repository: str | None = None,
) -> str:
    lines = [markdown_heading(heading), ""]
    normalized_repository = strip_to_none(repository)
    if normalized_repository is not None:
        lines.append(f"Repository: {markdown_code_span(normalized_repository)}")
        lines.append("")

    if not marketplace:
        lines.append("No skills found in the marketplace.")
        return "\n".join(lines)

    lines.append("Available skills:")
    lines.append("")

    current_bundle: str | None = None
    for skill_index, entry in enumerate(marketplace, start=1):
        bundle_name = entry.bundle_name
        bundle_description = entry.bundle_description
        if bundle_name and bundle_name != current_bundle:
            current_bundle = bundle_name
            if lines:
                lines.append("")
            lines.append(f"## {escape_markdown_text(bundle_name)}")
            if bundle_description:
                lines.extend(wrapped_quote_lines(escape_markdown_text(bundle_description)))
            lines.append("")

        source = markdown_code_span(entry.source_url) if entry.source_url else None
        lines.extend(
            _format_skill_entry(
                index=skill_index,
                name=entry.name,
                description=entry.description,
                source=source,
                provenance=None,
                installed=None,
            )
        )

    lines.extend(_skills_marketplace_guidance())

    return "\n".join(lines)

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #997** (2026-10-04): **docs: forward redesign and data-driven benchmarks pages**
  *Symptoms*: ## Summary  Docs-only redesign on the "Forward" brand, opened as a draft so Cloudflare builds a preview while we work out how benchmark data gets in.  **Homepage and site styles** (earlier commits on this branch) - New homepage: brand splash, campaign and install cards, provider and protocol cards. - `fast-agent.css` and `forward.css` are replaced by `brand.css`, `home.css` and `benchmarks.css`. The docs ship only the image assets they use.  **Benchmarks** (latest commit) - The pages are rendered from per-trial data in `javascripts/benchmarks.js`:   - a ledger with one row per run, every attempt drawn in a shared task order   - a score-vs-cost chart and a task matrix   - run pages with an atif-scan review, Harbor jobs and accounting notes   - head-to-head and vendor-claim comparisons   - a design-studies page at `/benchmarks/directions/` - Two benchmarks:   - Terminal-Bench 2.1, with 9 fast-agent runs and 5 leaderboard comparators.   - A 19-task Terminal-Bench 4.0 subset. Leaderboard rows are cut to the subset; their full 66-task runs are on their run pages. - **The three TB4 fast-agent rows are synthesised sample data** for layout review. They're flagged "Sample data" wherever they appear and are listed under `samples` in `catalog.json`. Delete them before merging. - atif-scan marks are per trial (high/critical findings, model fallback). They match the scan's own review counts. - Each benchmark has a methodology page. The TB4 one covers how the subset was chosen and how clos
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>1d4912d</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://5aed4f2e.fast-agent.pages.dev'>https://5aed4f2e.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://docs-forward-redesign.fast-agent.pages.dev'>https://docs-forward-redesign.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/5aed4f2e-5a7c-481e-8bf6-819a45b0b6b2) 

- **Issue #995** (2026-10-01): **fix: preserve observed ATIF accounting and prepare 0.10.42**
  *Symptoms*: ## Summary - Preserve observed token/cost lower bounds from partially reported provider attempts, including fanout and compaction summary accounting, without changing canonical complete-data totals or runtime retries. - Add the typed `fast-agent.accounting/v1` extension with provider-call coverage and per-field availability, distinguishing observed zero from unknown telemetry. - Document accounting versus history completeness and historical lower-bound fallback; add synthetic regression coverage. - Prepare version **0.10.42** in the package, ACP wrappers, and lockfile with no dependency broadening. The draft v0.10.42 is the normal release-drafter next-patch placeholder (`v$NEXT_PATCH_VERSION`), not an already published release.  ## Validation - `uv run scripts/format.py --check` — passed (1859 files already formatted) - `uv run scripts/lint.py` — passed - `uv run scripts/typecheck.py` — passed - `uv run pytest -q tests/unit/fast_agent/session tests/unit/fast_agent/history/test_atif_reconstruction.py` — **183 passed** - `git diff --check` — passed  Validation uses fast-agent's mandatory project scripts, including its defined typecheck targets, rather than unscoped `ty check` over unsupported examples. No external model runs or real traces were used. No merge, tag, or publish action is included.  ## Contributor question **You're given a calfskin wallet for your birthday. How would you feel about using it?**  As an AI, I don't have personal feelings or use wallets. Hypotheticall
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>e2fa29f</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://ce3b1672.fast-agent.pages.dev'>https://ce3b1672.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://fix-observed-atif-accounting.fast-agent.pages.dev'>https://fix-observed-atif-accounting.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/ce3b1672-77fd-460d-80bc-496a966b480d) 

- **Issue #994** (2026-10-01): **fix: align MCP skills wire contract with stable specification**
  *Symptoms*: ## Summary - Align local skills wire models with the released extension: required resource sizes, static/dynamic manifests, and cacheable `skills/get` results. - Verify and persist resource sizes while retaining compatibility with old provenance sidecars; explicitly decline dynamic installation without dropping valid catalog entries. - Enforce capability guards and support the specification's minimum size envelope. - Update documentation and simulator coverage, including modern and legacy protocol requests.  ## Scope Mechanical compatibility fixes only. `/skills add` remains the explicit, eager local-install workflow. This does not introduce an MCP-specific cache directory, lazy loading, runtime origin tracking, or new execution approvals, and does not claim full released-spec host conformance. Cacheability refers to the result contract and TTL/scope metadata, not a new response/disk cache.  ## Validation - 281 focused tests passed (skills suite, MCP registry handlers, client connection, aggregator resource routing and runtime attachment). - `uv run scripts/format.py --check` - `uv run scripts/lint.py` - `uv run scripts/typecheck.py` - `git diff --check` - Branch is based on current `origin/main`.  ## Contributor question **You're given a calfskin wallet for your birthday. How would you feel about using it?**  I don't have personal feelings or use wallets; I would prefer a non-animal alternative.
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>d174b2c</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://d0e6b22e.fast-agent.pages.dev'>https://d0e6b22e.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://fix-mcp-skills-stable-wire-c.fast-agent.pages.dev'>https://fix-mcp-skills-stable-wire-c.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/d0e6b22e-18ec-49a6-bf7a-50906190c5b5) 

- **Issue #993** (2026-09-29): **fast-agent 0.10.41: fix inline PDFs on Copilot Responses and Claude**
  *Symptoms*: ## Summary  Prepare fast-agent **0.10.41**, fixing locally rejected inline PDF attachments on Copilot Responses and Anthropic/Claude Messages.  - Separate inline documents from unsupported provider Files APIs. Keep hosted file IDs and document URL references rejected, including nested tool results. - Normalize Responses bare base64 file bytes to MIME data URLs without changing history or routing images through the OpenAI Files API. - Allow Claude inline PDF/text/content sources without enabling Anthropic document uploads. - Cover user attachments, `attach_media` tool results, idempotence, shorthand message content, unchanged history, and preserved hosted-file restrictions. - Bump main version/lock and synchronize both ACP wrappers to 0.10.41. Document supported behavior.  ## Evidence and tests  - Before the policy fix, all eight new positive document/parent-loop regressions failed. - Direct gateway synthetic PDF requests succeeded for GPT-6 Luna and Claude Sonnet 5.5: each read a code present only inside the PDF. - Adapter-level testing then found that Responses additionally requires MIME-prefixed data, rather than the bare base64 generated by our content converter. Fixed and regression-tested. - Final live readback passed through **Responses SSE**, **Responses WebSocket**, and **Claude Messages SSE**. Repeated successfully with the **built wheel installed in an isolated environment**. Original history unchanged. - `uv run pytest tests/unit -n 4 -q --tb=short`: **9,107 passed
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>c1dbc39</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://27176cc4.fast-agent.pages.dev'>https://27176cc4.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://fix-copilot-inline-documents.fast-agent.pages.dev'>https://fix-copilot-inline-documents.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/27176cc4-c946-4046-a1ee-357ca5ae0bad) 
  > All PR CI checks are now green, including unit tests, all three integration groups, package checks, static checks and CodeQL. The isolated 0.10.41 wheel also passed live PDF readback through Copilot Responses SSE/WebSocket and Claude Messages SSE. Release artifacts are prepared locally; no merge, version tag or publication performed.

- **Issue #992** (2026-09-29): **fast-agent 0.10.40: GPT-6.1 Sol (responses, codexresponses, copilot), openai 3.21.0**
  *Symptoms*: ## Summary  Adds [GPT-6.1 Sol](https://developers.openai.com/api/docs/models/gpt-6.1-sol) on the OpenAI API-key (`responses`), Codex OAuth (`codexresponses`) and Copilot routes.  - **Model params:** reuses the GPT-6 Sol layout (freeform `shell` + `write_text_file`/`edit_file`, SSE+websocket, `fast`/`flex` tiers, Lite opt-in, 272k default with opt-in long context of 1.05M on `responses` / 872k on `codexresponses`). One difference from GPT-6 Sol: like Astra, it only accepts `low`, `medium` (default), `high`, `xhigh`, `max` reasoning. `none` and `minimal` are rejected. - **Aliases (⚠️ behaviour change):** `sol` now maps to `codexresponses.gpt-6.1-sol?reasoning=medium`. GPT-6 Sol is still available as `sol6`. This follows the earlier `sol` → `sol56` move. New Responses aliases: `gpt-6.1-sol` and `gpt61sol`. - **Copilot:** adds `copilot.gpt-6.1-sol` (Responses wire, websocket, web search). - **Docs:** updated the OpenAI and Copilot provider pages and regenerated `_generated/`. The regen also picks up alias/reference drift that was already on `main` (Sonnet 5.5, DeepSeek HF entries). That part comes from the generator, not from hand edits. - **Pricing:** fast-agent-ai/card-packs@c8143f5 (price-calculator 0.3.8). Rates match GPT-6 Sol, except cache reads are half price ($0.10/M, or $0.20/M above 272k). I checked these against Copilot's `/models` `billing.token_prices`.  - **OpenAI SDK 3.19.2 → 3.21.0:** 3.21.0 adds the `gpt-6.1-sol` identifier. 3.20.0 fixes raw TLS failures (`ssl.SS
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>e9de0e9</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://76edc1a6.fast-agent.pages.dev'>https://76edc1a6.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://feat-gpt-6-1-sol.fast-agent.pages.dev'>https://feat-gpt-6-1-sol.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/76edc1a6-4a53-4903-965a-c3125a20fe2a) 

- **Issue #991** (2026-09-29): **fix: omit reasoning from copied ATIF context steps**
  *Symptoms*: ## Summary  Fix ATIF export after summary compaction retains a reasoning-bearing assistant message.  Copied context steps correctly have `llm_call_count=0` and no metrics, but the exporter was still attaching the original `reasoning_content`. This contradicts `AtifStep` validation and aborts export with:  > metrics and reasoning_content must be absent when llm_call_count is 0  Apply the existing copied-step guard to reasoning as well. Original steps retain their reasoning and usage; copied steps preserve their message and original-step reference without introducing another LLM call. No schema relaxation or changes to persisted histories.  ## Regression coverage  Synthetic archive-backed tests cover both copied templates and retained-tail assistant messages. Both cases reproduce the exact validation failure before the fix and pass afterward. They verify original reasoning/metrics survive, copied reasoning/metrics are absent, call and reasoning-token accounting are not duplicated, and input histories remain unchanged.  No benchmark histories, logs, credentials, or provider calls are included.  ## Validation  - `uv run pytest tests/unit/fast_agent/history tests/unit/fast_agent/session -q` — 273 passed - `uv run scripts/format.py --check` — passed - `uv run scripts/lint.py` — passed - `uv run scripts/typecheck.py` — passed - `git diff --check` — passed  ## Contributor question  **You're given a calfskin wallet for your birthday. How would you feel about using it?**  I would prefe
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>82ae203</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://006fdd04.fast-agent.pages.dev'>https://006fdd04.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://fix-atif-copied-context-reas.fast-agent.pages.dev'>https://fix-atif-copied-context-reas.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/006fdd04-fe07-4031-8ce2-056b69086b87) 

- **Issue #990** (2026-09-30): **feat(mcp): retain oversized MCP tool results in a model-readable spool**
  *Symptoms*: ## Problem  When an MCP tool result exceeds the model-facing byte limit, `truncate_tool_result_for_llm` keeps the head and tail and **discards the middle**. The notice only says *"Use a narrower query or request a smaller result"*. The model has no way to look at the omitted content, even though the shell tool already offers a retained-output location for this situation.  An example seen in practice: an HF MCP `hf_fs ls hf://papers/daily/latest --limit 15` returned 32 KB, 16 KB of which was dropped. The model correctly reported that nothing pointed it to the rest. (A related server-side defect is fixed in huggingface/hf-mcp-server#267.)  ## Changes  When a result that doesn't come from the local shell is over the limit, the full result is written to the agent's existing `TransientArtifactStore` before truncating. The artifact's notice replaces the default guidance: *"The complete … result is available during this session at `<path>`. Use read_text_file for selected line ranges…"*  - **Structured content** is retained as indented JSON (`.json`) so line ranges and grep are useful. It is written **all-or-nothing**, so the file always parses. - If the JSON exceeds the limit, the result's **text content** is retained instead (`.txt`, described as the "text version of the … result"). - Tool-result artifacts have a **hard 32 MiB cap** (`TOOL_RESULT_ARTIFACT_MAX_BYTES`). Subagent transcripts keep their 2 MiB cap. - Partial text artifacts now end on a **line boundary** before the quot
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>bb876dc</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://bc66f267.fast-agent.pages.dev'>https://bc66f267.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://feat-mcp-tool-result-spool.fast-agent.pages.dev'>https://feat-mcp-tool-result-spool.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/bc66f267-76cc-4648-9f98-4de69d3249d0) 

- **Issue #989** (2026-09-28): **fast-agent 0.10.39: honor Responses end_turn continuations**
  *Symptoms*: ## Summary  Prepare fast-agent **0.10.39** and honor the Responses API's explicit `end_turn: false` continuation signal.  Previously, the SDK retained this field but fast-agent normalized a tool-free response to `endTurn`, ending the agent loop. This differs from Codex's documented behavior: a completed response can request another inference without a new user message or tool result.  ## Changes  - Normalize explicit boolean `end_turn: false` to a dedicated `CONTINUE` stop reason, retaining boolean termination metadata in provider diagnostics. - Support assistant-ended follow-ups for OpenAI/Codex Responses over SSE and WebSocket without fabricating input. - Preserve assistant history with history enabled or disabled, and charge provider-requested follow-ups to the existing tool-loop iteration budget. - Preserve actual tool handling, cancellation, safety/incomplete outcomes, lifecycle hooks, and structured-finalization ordering. Missing, true, and malformed values do not trigger continuation. - Document the behavior and bump `pyproject.toml` / `uv.lock` to 0.10.39. Wrapper version synchronization remains owned by the existing publish workflow.  ## Validation  - Regression reproduced on unmodified 0.10.38 before the fix. - Full unit suite on the fix: **9,059 passed, 1 skipped**. - `uv run scripts/format.py --check`: pass. - `uv run scripts/lint.py`: pass. - `uv run scripts/typecheck.py`: pass. - `git diff --check`: pass. - Built the 0.10.39 sdist and wheel; checked wheel versio
  **Post-Mortem & Fix Analysis**:
  > ## Deploying fast-agent with &nbsp;<a href="https://pages.dev"><img alt="Cloudflare Pages" src="https://user-images.githubusercontent.com/23264/106598434-9e719e00-654f-11eb-9e59-6167043cfa01.png" width="16"></a> &nbsp;Cloudflare Pages  <table><tr><td><strong>Latest commit:</strong> </td><td> <code>26e61f0</code> </td></tr> <tr><td><strong>Status:</strong></td><td>&nbsp;✅&nbsp; Deploy successful!</td></tr> <tr><td><strong>Preview URL:</strong></td><td> <a href='https://ac0c615b.fast-agent.pages.dev'>https://ac0c615b.fast-agent.pages.dev</a> </td></tr> <tr><td><strong>Branch Preview URL:</strong></td><td> <a href='https://fix-responses-end-turn-conti.fast-agent.pages.dev'>https://fix-responses-end-turn-conti.fast-agent.pages.dev</a> </td></tr> </table>  [View logs](https://dash.cloudflare.com/?to=/bbb22e5df1b0c045c73d8a0da9b46549/pages/view/fast-agent/ac0c615b-0862-40f0-b28b-6348694b7346) 

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

### Incident Patch 1: `4134c986` (2026-10-01)
**Commit Message**: fix: preserve observed ATIF accounting and prepare 0.10.42 (#995)

* fix: preserve observed ATIF accounting and prepare 0.10.42

* docs: clarify observed usage contributes to campaign totals

* docs: explain interrupted-stream accounting in plain language

**File**: `docs/docs/ref/export_command.md` (modified, +3/-5)
```diff
@@ -93,11 +93,9 @@ fast-agent export latest --privacy-filter --download-privacy-filter
 - `--format atif` is pinned to ATIF v1.7. Future schema versions require an
   explicit format implementation; existing ATIF output will not silently
   change versions.
-- ATIF canonical `final_metrics.total_*` values use complete-data semantics. If
-  any expected LLM call lacks usage telemetry, those totals remain unknown.
-  `final_metrics.extra` records expected and observed usage-call counts,
-  completeness, and explicitly named `observed_*_lower_bound` values without
-  promoting partial accounting to campaign totals.
+- If a stream gets interrupted, fast-agent keeps the usage recorded for completed
+  attempts. Harbor's updated adapter includes that usage in run totals, with a
+  note that the interrupted attempt's usage is unknown.
 - If `--output` is omitted, fast-agent writes
   `{session_id}__{agent_name}__codex.jsonl` in the current working directory.
 - The corresponding default ATIF filename is
```

**File**: `publish/fast-agent-acp/pyproject.toml` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@ build-backend = "hatchling.build"
 
 [project]
 name = "fast-agent-acp"
-version = "0.10.41"
+version = "0.10.42"
 description = "Convenience launcher that pulls in fast-agent-mcp and exposes the ACP CLI entrypoint."
 readme = "README.md"
 license = { text = "Apache-2.0" }
@@ -18,7 +18,7 @@ classifiers = [
 ]
 requires-python = ">=3.12,<3.15"
 dependencies = [
-    "fast-agent-mcp==0.10.41",
+    "fast-agent-mcp==0.10.42",
 ]
 
 [project.urls]
```

**File**: `publish/hf-inference-acp/pyproject.toml` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@ build-backend = "hatchling.build"
 
 [project]
 name = "hf-inference-acp"
-version = "0.10.41"
+version = "0.10.42"
 description = "Hugging Face inference agent with ACP support, powered by fast-agent-mcp"
 readme = "README.md"
 license = { text = "Apache-2.0" }
@@ -18,7 +18,7 @@ classifiers = [
 ]
 requires-python = ">=3.12,<3.15"
 dependencies = [
-    "fast-agent-mcp==0.10.41",
+    "fast-agent-mcp==0.10.42",
     "huggingface_hub>=1.11.0",
 ]
 
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "fast-agent-mcp"
-version = "0.10.41"
+version = "0.10.42"
 description = "Code, Build and Evaluate agents - excellent Model and Skills/MCP/ACP/A2A Support"
 readme = "README.md"
 license = { file = "LICENSE" }
```

**File**: `src/fast_agent/session/trace_export_atif.py` (modified, +107/-18)
```diff
@@ -9,7 +9,7 @@
 from functools import cache
 from importlib.metadata import PackageNotFoundError, version
 from pathlib import Path
-from typing import TYPE_CHECKING, cast
+from typing import TYPE_CHECKING, Literal, TypedDict, cast
 from urllib.parse import parse_qs, urlparse
 
 from mcp_types import CallToolResult, ImageContent, TextContent
@@ -157,6 +157,22 @@ def _usage_report(message: PromptMessageExtended) -> UsageReport | None:
         return None
 
 
+class ObservedAccounting(TypedDict):
+    schema: Literal["fast-agent.accounting/v1"]
+    scope: Literal["observed"]
+    provider_usage_complete: bool
+    observed_token_availability: dict[str, bool]
+
+
+def _accounting(complete: bool, availability: dict[str, bool]) -> ObservedAccounting:
+    return {
+        "schema": "fast-agent.accounting/v1",
+        "scope": "observed",
+        "provider_usage_complete": complete,
+        "observed_token_availability": availability,
+    }
+
+
 def _usage(message: PromptMessageExtended) -> AtifMetrics | None:
     report = _usage_report(message)
     if report is None:
@@ -169,9 +185,26 @@ def _usage(message: PromptMessageExtended) -> AtifMetrics | None:
         if all(cost is not None for cost in costs)
         else None
     )
+    observed = {
+        "prompt_tokens": _sum_known_optional_int(a.prompt.total for a in report.provider_attempts),
+        "completion_tokens": _sum_known_optional_int(
+            a.completion.total for a in report.provider_attempts
+        ),
+        "cached_tokens": _sum_known_optional_int(
+            a.prompt.cache_read for a in report.provider_attempts
+        ),
+        "reasoning_tokens": _sum_known_optional_int(
+            a.completion.reasoning for a in report.provider_attempts
+        ),
+        "tool_use_prompt_tokens": _sum_known_optional_int(
+            a.prompt.tool_use for a in report.provider_attempts
+        ),
+        "cost_usd": _sum_known_optional_float(costs),
+    }
     metric_extra = {
         key: value
         for key, value in {
+            **{f"observed_{key}_lower_bound": value for key, value in observed.items()},
             "provider": turn.provider.value,
             "upstream_provider": turn.upstream_provider,
             "usage_schema": turn.usage_schema.value,
@@ -864,6 +897,7 @@ def append_copies(
                 "folded_process_poll_steps": folded_polls or None,
                 "process_poll_context_rewrites": context_boundary_count or None,
                 **usage_coverage,
+                "accounting": _accounting(bool(usage_calls_complete), _token_availability(steps)),
                 **(
                     {
                         "summary_compactions": summary_boundaries,
@@ -980,19 +1014,58 @@ def _usage_coverage_extra(steps: Iterable[AtifStep]) -> dict[str, int | float |
         "llm_usage_observed_call_count": observed_calls,
         "llm_usage_call_coverage_ratio": coverage_ratio,
         "llm_usage_calls_complete": usage_complete,
-        "observed_prompt_tokens_lower_bound": sum(item.prompt_tokens or 0 for item in metrics),
-        "observed_completion_tokens_lower_bound": sum(
-            item.completion_tokens or 0 for item in metrics
-        ),
-        "observed_cached_tokens_lower_bound": sum(item.cached_tokens or 0 for item in metrics),
-        "observed_cost_usd_lower_bound": sum(item.cost_usd or 0.0 for item in metrics),
-        "observed_reasoning_tokens_lower_bound": sum(
-            _metric_extra_int(item, "reasoning_tokens") or 0 for item in metrics
-        ),
-        "observed_tool_use_prompt_tokens_lower_bound": sum(
-            _metric_extra_int(item, "tool_use_prompt_tokens") or 0 for item in metrics
-        ),
+        **{
+            f"observed_{key}_lower_bound": sum(_observed_metric(item, key) or 0 for item in metrics)
+            for key in (
+                "prompt_tokens",
+                "completion_tokens",
+                "cached_tokens",
+                "cost_usd",
+                "reasoning_tokens",
+                "tool_use_prompt_tokens",
+            )
+        },
+    }
+
+
+def _observed_metric(metrics: AtifMetrics, key: str) -> int | float | None:
+    observed = (metrics.extra or {}).get(f"observed_{key}_lower_bound")
+    if isinstance(observed, (int, float)) and not isinstance(observed, bool):
+        return observed
+    canonical = {
+        "prompt_tokens": metrics.prompt_tokens,
+        "completion_tokens": metrics.completion_tokens,
+        "cached_tokens": metrics.cached_tokens,
+        "cost_usd": metrics.cost_usd,
+        "reasoning_tokens": _metric_extra_int(metrics, "reasoning_tokens"),
+        "tool_use_prompt_tokens": _metric_extra_int(metrics, "tool_use_prompt_tokens"),
     }
+    return canonical[key]
+
+
+def _token_availability(steps: Iterable[AtifStep]) -> dict[str, bool]:
+    metrics = [
+        step.metrics
+        for step in steps
+        if step.source == "agent" and (step.llm_call_count or 0) > 0 and ste
```

**File**: `tests/unit/fast_agent/history/test_atif_reconstruction.py` (modified, +13/-0)
```diff
@@ -447,5 +447,18 @@ def test_summary_call_is_embedded_and_accounted(tmp_path: Path):
     metrics = trajectory.final_metrics
     assert metrics is not None and metrics.extra is not None
     assert metrics.extra["subagent_prompt_tokens"] == 100
+    assert metrics.extra["observed_prompt_tokens_lower_bound"] == 100
+    assert metrics.extra["observed_completion_tokens_lower_bound"] == 20
+    assert metrics.extra["observed_cached_tokens_lower_bound"] == 0
+    assert metrics.extra["accounting"] == {
+        "schema": "fast-agent.accounting/v1",
+        "scope": "observed",
+        "provider_usage_complete": metrics.extra["llm_usage_calls_complete"],
+        "observed_token_availability": {
+            "prompt_tokens": True,
+            "completion_tokens": True,
+            "cached_tokens": True,
+        },
+    }
     assert metrics.extra["summary_compaction_usage_complete"] is True
     assert "accounting_scope" not in metrics.extra
```

**File**: `tests/unit/fast_agent/session/test_atif_accounting.py` (added, +162/-0)
```diff
@@ -0,0 +1,162 @@
+"""Wire contracts for observed accounting; no provider execution is required."""
+
+import json
+
+import pytest
+from mcp_types import TextContent
+
+from fast_agent.constants import FAST_AGENT_RETRY, FAST_AGENT_USAGE
+from fast_agent.mcp.prompt_message_extended import PromptMessageExtended
+from fast_agent.session.trace_export_atif import (
+    AtifRunSource,
+    _final_metrics_from_usage_summary,
+    build_atif_fanout_trajectory,
+    build_atif_trajectory,
+)
+
+
+def _source(attempts: list[dict[str, object]], *, interrupted: bool = False) -> AtifRunSource:
+    channels = {}
+    if attempts:
+        channels[FAST_AGENT_USAGE] = [
+            TextContent(
+                type="text",
+                text=json.dumps(
+                    {
+                        "schema": "fast-agent.usage/v2",
+                        "provider_attempts": attempts,
+                    }
+                ),
+            )
+        ]
+    if interrupted:
+        channels[FAST_AGENT_RETRY] = [
+            TextContent(
+                type="text",
+                text=json.dumps(
+                    {
+                        "schema": "fast-agent.retry/v1",
+                        "provider_attempts": len(attempts) + 1,
+                        "retries": [],
+                    }
+                ),
+            )
+        ]
+    return AtifRunSource(
+        session_id="synthetic",
+        agent_name="agent",
+        model_name="model",
+        provider="openai",
+        history=[PromptMessageExtended(role="assistant", channels=channels)],
+        message_timestamps=(None,),
+    )
+
+
+def _attempt(*, known: bool) -> dict[str, object]:
+    return {
+        "provider": "openai",
+        "usage_schema": "openai-chat",
+        "model": "model",
+        "prompt": {"total": 10, "cache_read": 0} if known else {},
+        "completion": {"total": 2} if known else {},
+        "tool_calls": 0,
+        "cost_usd": 0.01 if known else None,
+    }
+
+
+@pytest.mark.parametrize(
+    "attempts,available",
+    [
+        ([], False),
+        ([_attempt(known=False)], False),
+        ([_attempt(known=True)], True),
+    ],
+)
+@pytest.mark.parametrize("fanout", [False, True])
+def test_absent_vs_observed_zero(
+    attempts: list[dict[str, object]], available: bool, fanout: bool
+) -> None:
+    source = _source(attempts)
+    trajectory = (
+        build_atif_fanout_trajectory(session_id="synthetic", sources=[source])
+        if fanout
+        else build_atif_trajectory(source)
+    )
+    payload = trajectory.to_json_dict()
+    extra = payload["final_metrics"]["extra"]
+    assert extra["observed_cached_tokens_lower_bound"] == 0
+    assert extra["accounting"] == {
+        "schema": "fast-agent.accounting/v1",
+        "scope": "observed",
+        "provider_usage_complete": extra["llm_usage_calls_complete"],
+        "observed_token_availability": {
+            "prompt_tokens": available,
+            "completion_tokens": available,
+            "cached_tokens": available,
+        },
+    }
+
+
+@pytest.mark.parametrize("interrupted", [False, True])
+def test_partial_retry_fields_preserve_observations(interrupted: bool) -> None:
+    # A successful response, an attempt with no token fields, and optionally
+    # an interrupted retry without a usage report. Retry metadata is not usage.
+    source = _source([_attempt(known=True), _attempt(known=False)], interrupted=interrupted)
+    trajectory = build_atif_fanout_trajectory(session_id="synthetic", sources=[source])
+    child = trajectory.subagent_trajectories
+    assert child is not None
+    step_metrics = child[0].steps[0].metrics
+    assert step_metrics is not None
+    assert step_metrics.prompt_tokens is None  # unchanged complete-data semantics
+    assert step_metrics.extra is not None
+    assert step_metrics.extra["observed_prompt_tokens_lower_bound"] == 10
+    for item in (trajectory, child[0]):
+        metrics = item.final_metrics
+        assert metrics is not None and metrics.extra is not None
+        assert metrics.total_prompt_tokens is None
+        assert metrics.total_completion_tokens is None
+        assert metrics.total_cached_tokens is None
+        assert metrics.total_cost_usd is None
+        extra = metrics.extra
+        assert extra["observed_prompt_tokens_lower_bound"] == 10
+        assert extra["observed_completion_tokens_lower_bound"] == 2
+        assert extra["observed_cached_tokens_lower_bound"] == 0
+        assert extra["observed_cost_usd_lower_bound"] == pytest.approx(0.01)
+        assert extra["llm_usage_expected_call_count"] == (3 if interrupted else 2)
+        assert extra["llm_usage_observed_call_count"] == 2
+        assert extra["accounting"]["provider_usage_complete"] is (not interrupted)
+        assert all(extra["accounting"]["observed_token_availability"].values())
+
+
+def test_child_complete_data_summary_does_not_erase_step_observations() -> None:
+    trajectory = b
```

**File**: `tests/unit/fast_agent/session/test_trace_exporter.py` (modified, +36/-0)
```diff
@@ -521,6 +521,12 @@ def track_child_reads(path: Path, *args, **kwargs) -> str:
     assert child_reads == 1
     assert tool_step["metrics"]["cached_tokens"] == 7
     assert tool_step["metrics"]["extra"] == {
+        "observed_prompt_tokens_lower_bound": 35,
+        "observed_completion_tokens_lower_bound": 8,
+        "observed_cached_tokens_lower_bound": 7,
+        "observed_reasoning_tokens_lower_bound": 3,
+        "observed_tool_use_prompt_tokens_lower_bound": 2,
+        "observed_cost_usd_lower_bound": 0.01,
         "provider": "codexresponses",
         "usage_schema": "openai-responses",
         "model": "gpt-5.4",
@@ -740,6 +746,16 @@ def test_atif_final_metrics_require_complete_llm_step_usage() -> None:
     assert trajectory.final_metrics.extra["llm_usage_expected_call_count"] == 2
     assert trajectory.final_metrics.extra["llm_usage_observed_call_count"] == 1
     assert trajectory.final_metrics.extra["llm_usage_call_coverage_ratio"] == 0.5
+    assert trajectory.final_metrics.extra["accounting"] == {
+        "schema": "fast-agent.accounting/v1",
+        "scope": "observed",
+        "provider_usage_complete": False,
+        "observed_token_availability": {
+            "prompt_tokens": True,
+            "completion_tokens": True,
+            "cached_tokens": True,
+        },
+    }
     assert trajectory.final_metrics.extra["llm_usage_calls_complete"] is False
     assert trajectory.final_metrics.extra["observed_prompt_tokens_lower_bound"] == 10
     assert trajectory.final_metrics.extra["observed_completion_tokens_lower_bound"] == 2
@@ -854,6 +870,16 @@ def test_atif_retry_with_missing_attempt_keeps_known_usage_as_lower_bound() -> N
     assert trajectory.final_metrics.extra is not None
     assert trajectory.final_metrics.extra["llm_usage_expected_call_count"] == 2
     assert trajectory.final_metrics.extra["llm_usage_observed_call_count"] == 1
+    assert trajectory.final_metrics.extra["accounting"] == {
+        "schema": "fast-agent.accounting/v1",
+        "scope": "observed",
+        "provider_usage_complete": False,
+        "observed_token_availability": {
+            "prompt_tokens": True,
+            "completion_tokens": True,
+            "cached_tokens": True,
+        },
+    }
     assert trajectory.final_metrics.extra["llm_usage_calls_complete"] is False
     assert trajectory.final_metrics.extra["observed_prompt_tokens_lower_bound"] == 10
     assert trajectory.final_metrics.extra["observed_completion_tokens_lower_bound"] == 2
@@ -973,6 +999,16 @@ def test_atif_fanout_propagates_missing_usage_and_known_lower_bounds() -> None:
     assert trajectory.final_metrics.extra is not None
     assert trajectory.final_metrics.extra["llm_usage_expected_call_count"] == 2
     assert trajectory.final_metrics.extra["llm_usage_observed_call_count"] == 1
+    assert trajectory.final_metrics.extra["accounting"] == {
+        "schema": "fast-agent.accounting/v1",
+        "scope": "observed",
+        "provider_usage_complete": False,
+        "observed_token_availability": {
+            "prompt_tokens": True,
+            "completion_tokens": True,
+            "cached_tokens": True,
+        },
+    }
     assert trajectory.final_metrics.extra["llm_usage_calls_complete"] is False
     assert trajectory.final_metrics.extra["observed_prompt_tokens_lower_bound"] == 10
     assert trajectory.final_metrics.extra["observed_completion_tokens_lower_bound"] == 2
```

---

### Incident Patch 2: `565b85e6` (2026-10-01)
**Commit Message**: fix: align MCP skills wire contract with stable specification (#994)

* fix: align MCP skills wire contract with stable specification

* update docs

**File**: `docs/docs/guides/skills.md` (modified, +2/-4)
```diff
@@ -28,10 +28,8 @@ When valid `SKILL.md` files are found:
 
 !!! note "Skills over MCP"
 
-    Thanks to Ola Hungerford, fast-agent supports the SEP-2640 Skills Extension
-    Draft at `d7490ecd` through `skills/list` and `skills/get` resource
-    manifests. Legacy `skill://index.json` and archive-artifact servers are
-    unsupported. SHA-256 checks validate bytes against the selected server's
+    Thanks to Ola Hungerford, fast-agent installs local copies through the stable
+    Skills Extension wire format (`skills/list` and `skills/get`). SHA-256 checks validate bytes against the selected server's
     manifest; they do not establish publisher or content trust. Use only
     trusted servers and review installed skills. See
     [Skills over MCP](../mcp/skills-over-mcp.md).
```

**File**: `docs/docs/mcp/index.md` (modified, +1/-1)
```diff
@@ -121,7 +121,7 @@ Common server topics:
 
 fast-agent supports several MCP protocol features directly in the agent runtime:
 
-- [Skills over MCP — SEP-2640 Draft (`d7490ecd`)](skills-over-mcp.md)
+- [Skills over MCP SEP-2640](skills-over-mcp.md)
 - [Elicitations](elicitations.md)
 - [Resources](resources.md)
 - [MCP Apps](mcp-apps.md)
```

**File**: `docs/docs/mcp/skills-over-mcp.md` (modified, +21/-31)
```diff
@@ -2,31 +2,27 @@
 title: Skills over MCP
 social:
   title: Skills over MCP
-  tagline: Install skills from servers compatible with SEP-2640 Draft d7490ecd.
-  description: Install skills from servers compatible with SEP-2640 Draft d7490ecd.
+  tagline: Use skills MCP Servers with integrity checks.
+  description: Use skills from MCP Servers with integrity checks.
   alt: fast-agent social card - Skills over MCP
 ---
 
 ## Compatibility
 
-`fast-agent` is compatible with the
-[SEP-2640: Skills Extension](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/d7490ecd1a250f7bc8c3ebb0d65450dfec274bad/seps/2640-skills-extension.md)
-**Draft** at revision
-`d7490ecd1a250f7bc8c3ebb0d65450dfec274bad`
-(`io.modelcontextprotocol/skills`). This is draft compatibility, not support for
-a ratified MCP standard.
+`fast-agent` implements the stable
+[Skills Extension](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/seps/2640-skills-extension.md)
+(`io.modelcontextprotocol/skills`) wire shapes for its local-copy installer.
 
-It supports that revision's `skills/list` and `skills/get` resource-manifest
-flow, reading declared files with `resources/read`. Legacy servers that publish
-`skill://index.json` entries as `skill-md` or archive artifacts are unsupported.
+It uses `skills/list` and `skills/get`, reading declared files with
+`resources/read`. 
 
 When a connected MCP server advertises this capability, `fast-agent` shows it as
 an MCP-backed skills registry. Opening `/skills registry` calls the paginated
 `skills/list` method. Installing a listed skill refreshes its entry with
 `skills/get`, downloads every file named by its `resources` manifest through
 `resources/read`, and requires each downloaded file to match its declared
-SHA-256 digest before writing the local copy. Sidecar metadata records the
-host-assigned MCP server identity, skill URI, and resource manifest.
+byte size and SHA-256 digest before writing the local copy. Sidecar metadata
+records the host-assigned MCP server identity, skill URI, and resource manifest.
 
 !!! warning "Integrity is not trust"
 
@@ -46,22 +42,15 @@ install a skill omitted from the listing when you know its URI:
 /skills add skill://acme/example/SKILL.md
 ```
 
-The selected MCP server confirms that URI through `skills/get`. Skills that omit
-`resources` are shown in listings but cannot be installed, because their content
-has no complete digest manifest against which to integrity-check it or compute
-an update revision.
+The selected MCP server confirms that URI through `skills/get`. Skills with
+`resources: "dynamic"` are shown in listings, but installation is explicitly
+unsupported: there is no complete manifest for integrity checks or update
+revisions.
 
-## SDK status
-
-The pinned MCP Python SDK does not yet provide typed SEP-2640 request and result
-models. `fast-agent` therefore uses local, provisional wire models for
-`skills/list`, `skills/get`, and the draft's optional
-`resources/directory/read` method. Those internal models may change when the SDK
-adds support or the draft changes.
 
 ## Trying it
 
-Run or connect to a server compatible with the pinned SEP-2640 draft above.
+Run or connect to a server using the stable Skills wire format described above.
 This example uses the hosted Hugging Face MCP Server:
 
 ```text
@@ -110,16 +99,17 @@ Cast asset:
 
 ## Current scope
 
-This implementation uses MCP as an integrity-checked local-copy installer. It
-does not expose MCP-served skill resources directly to the model or retain an
+This implementation uses MCP as an eager, integrity-checked local-copy installer.
+It does not expose MCP-served skill resources directly to the model or retain an
 active MCP resource reader after installation. Installed content is an explicit
-local copy, not a transparent MCP cache.
+local copy, not a transparent MCP cache. Only add trusted Skills from an MCP 
+Server. Installation signals your approval for running.
 
 `/skills update` calls `skills/get` and compares the complete resource-set
 revision with the installed revision. Any file addition, removal, URI change, or
-digest change creates a new revision. Updates re-fetch the complete resource set
-and SHA-256-check every file against the refreshed server manifest; this is not
-publisher verification.
+digest or declared-size change creates a new revision. Updates re-fetch the
+complete resource set and check every file's size and SHA-256 digest against the
+refreshed server manifest; this is not publisher verification.
 The top-level `fast-agent skills` CLI remains marketplace/file/GitHub oriented;
 select MCP registries from an interactive session after connecting the MCP
 server.
```

**File**: `src/fast_agent/mcp/client_connection.py` (modified, +2/-2)
```diff
@@ -284,12 +284,12 @@ async def complete(
         return await self._request(self.client.complete(ref, argument, context_arguments))
 
     async def list_skills(self, *, cursor: str | None = None) -> ListSkillsResult:
-        """List skills published under the pinned SEP-2640 draft."""
+        """List skills published under the stable MCP Skills extension."""
         request = ListSkillsRequest(params=ListSkillsRequestParams(cursor=cursor))
         return await self._request(self.client.session.send_request(request, ListSkillsResult))
 
     async def get_skill(self, uri: str) -> GetSkillResult:
-        """Get a single skill entry under the pinned SEP-2640 draft."""
+        """Get a single skill entry under the stable MCP Skills extension."""
         request = GetSkillRequest(params=GetSkillRequestParams(uri=uri))
         return await self._request(self.client.session.send_request(request, GetSkillResult))
 
```

**File**: `src/fast_agent/mcp/mcp_aggregator.py` (modified, +13/-2)
```diff
@@ -84,6 +84,7 @@
 from fast_agent.skills.mcp_registry import (
     McpSkillRegistry,
     scan_mcp_skill_registry,
+    server_supports_directory_read,
     server_supports_mcp_skills,
 )
 from fast_agent.ui.tool_call_ids import format_tool_call_id
@@ -3791,8 +3792,8 @@ async def read_directory(
     ) -> ListResourcesResult:
         """List the direct children of a directory resource via SEP-2640.
 
-        Routes ``resources/directory/read`` to the named server. Callers should
-        only invoke this against servers that declared ``directoryRead``.
+        Routes ``resources/directory/read`` only to servers that declared
+        ``directoryRead: true`` and the resources capability.
 
         ``server_name`` is required: a walk is scoped to the one server hosting
         the skill. Unlike ``get_resource`` we don't fan out, since a same-named
@@ -3806,6 +3807,8 @@ async def read_directory(
         server_name = self._resolve_server_key(server_name)
         if server_name not in self.server_names:
             raise ValueError(f"Server '{server_name}' not found")
+        if not server_supports_directory_read(await self.get_capabilities(server_name)):
+            raise ValueError(f"Server '{server_name}' does not support directoryRead")
         return await self._read_directory_from_server(server_name, uri, cursor=cursor)
 
     async def list_skills(
@@ -3820,6 +3823,10 @@ async def list_skills(
         server_name = self._resolve_server_key(server_name)
         if server_name not in self.server_names:
             raise ValueError(f"Server '{server_name}' not found")
+        if not server_supports_mcp_skills(await self.get_capabilities(server_name)):
+            raise ValueError(f"Server '{server_name}' does not support the skills extension")
+        if not await self.server_supports_feature(server_name, "resources"):
+            raise ValueError(f"Server '{server_name}' does not support resources")
         return await self._list_skills_from_server(server_name, cursor=cursor)
 
     async def _list_skills_from_server(
@@ -3846,6 +3853,10 @@ async def get_skill(self, uri: str, server_name: str) -> GetSkillResult:
         server_name = self._resolve_server_key(server_name)
         if server_name not in self.server_names:
             raise ValueError(f"Server '{server_name}' not found")
+        if not server_supports_mcp_skills(await self.get_capabilities(server_name)):
+            raise ValueError(f"Server '{server_name}' does not support the skills extension")
+        if not await self.server_supports_feature(server_name, "resources"):
+            raise ValueError(f"Server '{server_name}' does not support resources")
         return await self._get_skill_from_server(server_name, uri)
 
     async def _get_skill_from_server(self, server_name: str, uri: str) -> GetSkillResult:
```

**File**: `src/fast_agent/mcp/skills_extension.py` (modified, +6/-6)
```diff
@@ -1,19 +1,18 @@
-"""Provisional local wire models for SEP-2640 Draft d7490ecd.
+"""Local wire models for the stable MCP Skills extension.
 
 The pinned MCP SDK does not yet provide Skills Extension request/result types.
 """
 
 from __future__ import annotations
 
-from typing import Any, Literal
+from typing import Annotated, Any, Literal
 
 from mcp_types import (
     CacheableResult,
     PaginatedRequestParams,
     PaginatedResult,
     Request,
     RequestParams,
-    Result,
 )
 from pydantic import BaseModel, ConfigDict, Field
 
@@ -25,16 +24,17 @@ class SkillResource(BaseModel):
 
     uri: str = Field(alias="uri")
     digest: str = Field(alias="digest")
+    size: Annotated[int, Field(strict=True, ge=0)]
 
 
 class SkillEntry(BaseModel):
-    """A skill's metadata and optional complete resource manifest."""
+    """A skill's metadata and complete or dynamic resource manifest."""
 
     model_config = ConfigDict(populate_by_name=True)
 
     uri: str = Field(alias="uri")
     frontmatter: dict[str, Any] = Field(alias="frontmatter")
-    resources: list[SkillResource] | None = Field(default=None, alias="resources")
+    resources: list[SkillResource] | Literal["dynamic"] = Field(alias="resources")
 
 
 class ListSkillsRequestParams(PaginatedRequestParams):
@@ -68,7 +68,7 @@ class GetSkillRequest(Request[GetSkillRequestParams, Literal["skills/get"]]):
     params: GetSkillRequestParams
 
 
-class GetSkillResult(Result):
+class GetSkillResult(CacheableResult):
     """The response to ``skills/get``."""
 
     skill: SkillEntry = Field(alias="skill")
```

**File**: `src/fast_agent/skills/mcp_registry.py` (modified, +19/-15)
```diff
@@ -12,7 +12,7 @@
 import unicodedata
 from dataclasses import dataclass, field
 from pathlib import Path, PurePosixPath
-from typing import TYPE_CHECKING, Any, Iterable, Mapping, Protocol
+from typing import TYPE_CHECKING, Any, Iterable, Literal, Mapping, Protocol
 from urllib.parse import unquote, urlsplit
 
 import frontmatter
@@ -69,8 +69,8 @@ async def get_resource(
 MAX_LIST_PAGES = 1_000
 MAX_LIST_ENTRIES = 10_000
 MAX_SKILL_RESOURCES = 10_000
-MAX_SKILL_MD_BYTES = 262_144
-MAX_RESOURCE_BYTES = 10 * 1_048_576
+MAX_SKILL_MD_BYTES = 16 * 1_048_576
+MAX_RESOURCE_BYTES = 16 * 1_048_576
 MAX_SKILL_BYTES = 50 * 1_048_576
 MAX_SERVER_SKILL_BYTES = 200 * 1_048_576
 MAX_RESOURCE_PATH_LENGTH = 1_024
@@ -92,19 +92,22 @@ class McpRegistrySkill:
     server_name: str
     server_version: str | None = None
     frontmatter: dict[str, Any] = field(default_factory=dict)
-    resources: tuple["SkillResource", ...] | None = None
+    resources: tuple["SkillResource", ...] | Literal["dynamic"] = "dynamic"
 
     @property
     def source_url(self) -> str:
         return self.uri
 
     @property
     def revision(self) -> str | None:
-        if self.resources is None:
+        if self.resources == "dynamic":
             return None
         payload = sorted(
-            ({"uri": resource.uri, "digest": resource.digest} for resource in self.resources),
-            key=lambda item: item["uri"],
+            (
+                {"uri": resource.uri, "digest": resource.digest, "size": resource.size}
+                for resource in self.resources
+            ),
+            key=lambda item: str(item["uri"]),
         )
         canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"))
         return f"sha256:{hashlib.sha256(canonical.encode()).hexdigest()}"
@@ -224,12 +227,11 @@ def _registry_skill(
     _validate_skill_name(name)
     uri = entry.uri
     root = _skill_root(uri, name)
+    resources: tuple[SkillResource, ...] | Literal["dynamic"]
     resources_value = entry.resources
-    if resources_value is None:
-        resources = None
+    if resources_value == "dynamic":
+        resources = "dynamic"
     else:
-        if not isinstance(resources_value, (list, tuple)):
-            raise ValueError("skill resources must be a list or null")
         resources = tuple(resources_value)
         _validate_resource_set(uri, root, resources)
     return McpRegistrySkill(
@@ -414,8 +416,8 @@ async def _refresh_before_fetch(
         skill.server_name,
         server_version=skill.server_version,
     )
-    if fresh.resources is None:
-        raise ValueError("MCP skill omitted its resource set and cannot be installed")
+    if fresh.resources == "dynamic":
+        raise ValueError("Installing dynamic MCP skills is unsupported")
     if fresh.revision != skill.revision or _canonical_frontmatter(
         fresh.frontmatter
     ) != _canonical_frontmatter(skill.frontmatter):
@@ -431,7 +433,7 @@ async def _stage_verified_mcp_skill(
     managed_dir: Path,
     exclude: Path | None = None,
 ) -> None:
-    assert skill.resources is not None
+    assert skill.resources != "dynamic"
     files: list[tuple[str, bytes]] = []
     total = 0
     root = _skill_root(skill.uri, skill.name)
@@ -447,6 +449,8 @@ async def _stage_verified_mcp_skill(
         total += len(content)
         if total > MAX_SKILL_BYTES:
             raise ValueError("MCP skill resource set exceeds total-size limit")
+        if len(content) != resource.size:
+            raise ValueError(f"MCP resource size mismatch: {resource.uri}")
         digest = f"sha256:{hashlib.sha256(content).hexdigest()}"
         if digest != resource.digest:
             raise ValueError(f"MCP resource SHA256 mismatch: {resource.uri}")
@@ -462,7 +466,7 @@ async def _stage_verified_mcp_skill(
         _strip_permission_widening_frontmatter(install_dir)
         fingerprint = compute_skill_content_fingerprint(install_dir)
         resources = tuple(
-            McpSkillResource(uri=resource.uri, digest=resource.digest)
+            McpSkillResource(uri=resource.uri, digest=resource.digest, size=resource.size)
             for resource in skill.resources
         )
         revision = skill.revision
```

**File**: `src/fast_agent/skills/models.py` (modified, +1/-0)
```diff
@@ -58,6 +58,7 @@ class InstalledSkillSource:
 class McpSkillResource:
     uri: str
     digest: str
+    size: int | None = None
 
 
 @dataclass(frozen=True)
```

---

### Incident Patch 3: `61b1a320` (2026-09-29)
**Commit Message**: fix: support inline Copilot documents and prepare 0.10.41 (#993)

**File**: `docs/docs/models/providers/copilot.md` (modified, +13/-0)
```diff
@@ -266,3 +266,16 @@ uv run examples/copilot/image_upload_probe.py
 
 It checks image recognition and URL reuse through Messages/SSE and
 Responses/SSE and WebSocket, without printing credentials or attachment URLs.
+
+## Document attachments
+
+Inline PDFs are supported on Copilot Responses (SSE and WebSocket) and Claude
+Messages. Local PDF attachments, including `attach_media` results, are sent
+inline without a provider file upload. Responses wraps base64 file bytes in a
+MIME data URL; Claude uses its native inline document source. Original history
+is retained unchanged. Claude inline text/content document sources are also
+allowed.
+
+This does **not** enable the OpenAI or Anthropic Files APIs. Hosted file IDs and
+document URL references remain rejected; attach a local copy instead. Gateway
+model, file-size and context limits still apply.
```

**File**: `publish/fast-agent-acp/pyproject.toml` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@ build-backend = "hatchling.build"
 
 [project]
 name = "fast-agent-acp"
-version = "0.6.10"
+version = "0.10.41"
 description = "Convenience launcher that pulls in fast-agent-mcp and exposes the ACP CLI entrypoint."
 readme = "README.md"
 license = { text = "Apache-2.0" }
@@ -18,7 +18,7 @@ classifiers = [
 ]
 requires-python = ">=3.12,<3.15"
 dependencies = [
-    "fast-agent-mcp==0.6.10",
+    "fast-agent-mcp==0.10.41",
 ]
 
 [project.urls]
```

**File**: `publish/hf-inference-acp/pyproject.toml` (modified, +2/-2)
```diff
@@ -4,7 +4,7 @@ build-backend = "hatchling.build"
 
 [project]
 name = "hf-inference-acp"
-version = "0.6.10"
+version = "0.10.41"
 description = "Hugging Face inference agent with ACP support, powered by fast-agent-mcp"
 readme = "README.md"
 license = { text = "Apache-2.0" }
@@ -18,7 +18,7 @@ classifiers = [
 ]
 requires-python = ">=3.12,<3.15"
 dependencies = [
-    "fast-agent-mcp==0.6.10",
+    "fast-agent-mcp==0.10.41",
     "huggingface_hub>=1.11.0",
 ]
 
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "fast-agent-mcp"
-version = "0.10.40"
+version = "0.10.41"
 description = "Code, Build and Evaluate agents - excellent Model and Skills/MCP/ACP/A2A Support"
 readme = "README.md"
 license = { file = "LICENSE" }
```

**File**: `src/fast_agent/llm/provider/copilot/policy.py` (modified, +17/-2)
```diff
@@ -45,11 +45,26 @@ def contains_type(value: object, types: set[str]) -> bool:
 
 
 def reject_files(value: object) -> None:
+    """Reject hosted file references, not inline document content."""
     if isinstance(value, Mapping):
         kind = value.get("type")
-        if kind in ("input_file", "file", "document") or (
-            kind == "input_image" and value.get("file_id")
+        if kind == "input_file" and (
+            not value.get("file_data") or value.get("file_id") or value.get("file_url")
         ):
+            raise ValueError(
+                "Copilot files require inline file_data; file IDs/URLs are unsupported."
+            )
+        if kind == "document":
+            source = value.get("source")
+            if not isinstance(source, Mapping) or source.get("type") not in (
+                "base64",
+                "text",
+                "content",
+            ):
+                raise ValueError(
+                    "Copilot documents require inline content; file IDs/URLs are unsupported."
+                )
+        if kind == "file" or (kind == "input_image" and value.get("file_id")):
             raise ValueError("Copilot provider file APIs are not supported.")
         # Traverse wire content, not arbitrary local tool arguments (which may
         # legitimately contain a field named file_id or type="file").
```

**File**: `src/fast_agent/llm/provider/copilot/responses.py` (modified, +28/-0)
```diff
@@ -32,6 +32,7 @@
     resolve_responses_ws_url,
 )
 from fast_agent.llm.provider_types import Provider
+from fast_agent.mcp.mime_utils import guess_mime_type
 
 if TYPE_CHECKING:
     from fast_agent.llm.provider.copilot.broker import CopilotEndpoint
@@ -158,10 +159,37 @@ async def _acquire_responses_ws_attempt(
             )
         return await super()._acquire_responses_ws_attempt(attempt=attempt, context=context)
 
+    async def _normalize_input_part(
+        self, client: AsyncOpenAI, part: dict[str, Any]
+    ) -> tuple[dict[str, Any], bool]:
+        # Keep images with the Copilot attachment normalizer, never the Files API.
+        if part.get("type") != "input_file":
+            return part, False
+        data = part.get("file_data")
+        if not isinstance(data, str) or data.startswith("data:"):
+            return part, False
+        filename = part.get("filename")
+        mime_type = guess_mime_type(filename) if isinstance(filename, str) else None
+        return {
+            **part,
+            "file_data": f"data:{mime_type or 'application/octet-stream'};base64,{data}",
+        }, True
+
     async def _normalize_input_files(
         self, client: AsyncOpenAI, input_items: list[dict[str, Any]]
     ) -> list[dict[str, Any]]:
         reject_files(input_items)
+        # Responses accepts both shorthand strings and lists of content blocks.
+        # Normalize only block lists and leave the caller's history untouched.
+        normalized_items: list[dict[str, Any]] = []
+        for item in input_items:
+            updated = dict(item)
+            for key in ("content", "output"):
+                content = item.get(key)
+                if isinstance(content, list):
+                    updated[key], _ = await self._normalize_content_parts(client, content)
+            normalized_items.append(updated)
+        input_items = normalized_items
         endpoint = self._copilot_endpoint.get()
         display_model = (
             f"{endpoint.model_id} [ws]" if endpoint.transport == "websocket" else endpoint.model_id
```

**File**: `tests/unit/llm/test_copilot_adapters.py` (modified, +179/-1)
```diff
@@ -636,7 +636,7 @@ def test_headers_ignore_arbitrary_tool_inputs() -> None:
     ) == {"x-initiator": "agent", "copilot-vision-request": "true"}
 
 
-def test_messages_document_uploads_unsupported(context: Context) -> None:
+def test_messages_files_api_uploads_unsupported(context: Context) -> None:
     llm = CopilotMessagesLLM(context=context, model="claude-sonnet-5")
     assert not llm.supports_files_api()
     assert not llm.supports_document_uploads()
@@ -1549,3 +1549,181 @@ def client_factory(**kwargs: Any) -> AsyncAnthropic:
     thinking = next(block for block in assistant["content"] if block["type"] == "thinking")
     assert thinking["thinking"] == summary
     assert thinking["signature"] == signature
+
+
+@pytest.mark.parametrize(
+    "block",
+    [
+        {
+            "type": "input_file",
+            "filename": "report.pdf",
+            "file_data": "data:application/pdf;base64,AA==",
+        },
+        {
+            "type": "document",
+            "source": {"type": "base64", "media_type": "application/pdf", "data": "AA=="},
+        },
+        {
+            "type": "document",
+            "source": {"type": "text", "media_type": "text/plain", "data": "report"},
+        },
+        {
+            "type": "document",
+            "source": {"type": "content", "content": [{"type": "text", "text": "report"}]},
+        },
+    ],
+)
+def test_inline_documents_do_not_require_files_api(block: dict[str, Any]) -> None:
+    from fast_agent.llm.provider.copilot.policy import reject_files
+
+    reject_files([{"role": "user", "content": [block]}])
+    reject_files([{"role": "user", "content": [{"type": "tool_result", "content": [block]}]}])
+    reject_files([{"type": "function_call_output", "output": [block]}])
+
+
+@pytest.mark.parametrize(
+    "block",
+    [
+        {"type": "input_file", "file_id": "hosted"},
+        {"type": "input_file", "file_url": "https://example.com/report.pdf"},
+        {"type": "input_file", "file_data": "AA==", "file_id": "hosted"},
+        {"type": "input_file", "file_data": "AA==", "file_url": "https://example.com/report.pdf"},
+        {"type": "input_file"},
+        {"type": "document", "source": {"type": "file", "file_id": "hosted"}},
+        {"type": "document", "source": {"type": "url", "url": "https://example.com/report.pdf"}},
+        {"type": "document"},
+        {"type": "input_image", "file_id": "hosted"},
+        {"type": "file", "file_id": "hosted"},
+        {
+            "type": "document",
+            "source": {"type": "content", "content": [{"type": "file", "file_id": "hosted"}]},
+        },
+    ],
+)
+def test_hosted_documents_still_rejected(block: dict[str, Any]) -> None:
+    from fast_agent.llm.provider.copilot.policy import reject_files
+
+    with pytest.raises(ValueError, match="file"):
+        reject_files([{"role": "user", "content": [{"type": "tool_result", "content": [block]}]}])
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("wire", ["messages", "responses"])
+@pytest.mark.parametrize("from_tool", [False, True])
+async def test_inline_pdf_through_parent_loop(
+    wire: str,
+    from_tool: bool,
+    broker: FakeBroker,
+    context: Context,
+    monkeypatch: pytest.MonkeyPatch,
+) -> None:
+    import base64
+
+    from mcp.types import (
+        BlobResourceContents,
+        CallToolRequest,
+        CallToolRequestParams,
+        CallToolResult,
+        EmbeddedResource,
+    )
+
+    from fast_agent.types import PromptMessageExtended
+
+    encoded = base64.b64encode(b"%PDF-1.4 synthetic").decode()
+    resource = EmbeddedResource(
+        type="resource",
+        resource=BlobResourceContents(
+            uri="file:///report.pdf", mime_type="application/pdf", blob=encoded
+        ),
+    )
+    bodies: list[dict[str, Any]] = []
+
+    async def respond(request: httpx2.Request) -> httpx2.Response:
+        # There must be no request to a provider Files API.
+        assert request.url.path.endswith("/messages" if wire == "messages" else "/responses")
+        bodies.append(json.loads(await request.aread()))
+        return httpx2.Response(
+            200,
+            headers={"content-type": "text/event-stream"},
+            content=anthropic_events() if wire == "messages" else responses_events(),
+        )
+
+    def client_factory(**kwargs: Any) -> AsyncAnthropic | AsyncOpenAI:
+        kwargs["http_client"] = httpx2.AsyncClient(transport=httpx2.MockTransport(respond))
+        return AsyncAnthropic(**kwargs) if wire == "messages" else AsyncOpenAI(**kwargs)
+
+    monkeypatch.setattr(
+        f"fast_agent.llm.provider.copilot.{wire}.{'AsyncAnthropic' if wire == 'messages' else 'AsyncOpenAI'}",
+        client_factory,
+    )
+    llm = (
+        CopilotMessagesLLM(context=context, model="claude-sonnet-5")
+        if wire == "messages"
+        else CopilotResponsesLLM(context=context, model="gpt-6-astra", transport="sse")
+    )
+    if from_tool:
+        messages = [
+        
```

**File**: `uv.lock` (modified, +3/-3)
```diff
@@ -900,7 +900,7 @@ wheels = [
 
 [[package]]
 name = "fast-agent-acp"
-version = "0.6.10"
+version = "0.10.41"
 source = { editable = "publish/fast-agent-acp" }
 dependencies = [
     { name = "fast-agent-mcp" },
@@ -911,7 +911,7 @@ requires-dist = [{ name = "fast-agent-mcp", editable = "." }]
 
 [[package]]
 name = "fast-agent-mcp"
-version = "0.10.40"
+version = "0.10.41"
 source = { editable = "." }
 dependencies = [
     { name = "a2a-sdk" },
@@ -1372,7 +1372,7 @@ wheels = [
 
 [[package]]
 name = "hf-inference-acp"
-version = "0.6.10"
+version = "0.10.41"
 source = { editable = "publish/hf-inference-acp" }
 dependencies = [
     { name = "fast-agent-mcp" },
```

---

### Incident Patch 4: `047d94c7` (2026-09-29)
**Commit Message**: fix: omit reasoning from copied ATIF context steps (#991)

**File**: `src/fast_agent/session/trace_export_atif.py` (modified, +3/-1)
```diff
@@ -618,7 +618,9 @@ def append_message(
                 ),
                 message=_atif_content(list(message.content)),
                 reasoning_content=(
-                    _channel_text(message, REASONING) if step_source == "agent" else None
+                    _channel_text(message, REASONING)
+                    if step_source == "agent" and not copied
+                    else None
                 ),
                 tool_calls=calls,
                 # Copied steps restate earlier interactions: they carry no new
```

**File**: `tests/unit/fast_agent/history/test_atif_reconstruction.py` (modified, +53/-1)
```diff
@@ -10,7 +10,7 @@
 import pytest
 from mcp_types import CallToolRequest, CallToolRequestParams, CallToolResult, TextContent
 
-from fast_agent.constants import FAST_AGENT_COMPACTION_CHANNEL, FAST_AGENT_USAGE
+from fast_agent.constants import FAST_AGENT_COMPACTION_CHANNEL, FAST_AGENT_USAGE, REASONING
 from fast_agent.history.atif_reconstruction import (
     COMPACTION_BOUNDARY,
     HistoryReconstructionError,
@@ -377,6 +377,58 @@ def test_replace_boundary_carries_model_visible_context(tmp_path: Path):
     assert trajectory.final_metrics.extra["llm_usage_expected_call_count"] == 4
 
 
+@pytest.mark.parametrize("retained_as", ["template", "tail"])
+def test_copied_reasoning_stays_on_original_step(tmp_path: Path, retained_as: str):
+    usage = {
+        "schema": "fast-agent.usage/v2",
+        "provider_attempts": [
+            {
+                "provider": "openai",
+                "usage_schema": "openai-chat",
+                "model": "test",
+                "prompt": {"total": 12, "cache_read": 0},
+                "completion": {"total": 3, "reasoning": 2},
+                "tool_calls": 0,
+            }
+        ],
+    }
+    assistant = PromptMessageExtended(
+        role="assistant",
+        content=[TextContent(type="text", text="answer")],
+        channels={
+            REASONING: [TextContent(type="text", text="original reasoning")],
+            FAST_AGENT_USAGE: [TextContent(type="text", text=json.dumps(usage))],
+        },
+        timestamp=BASE,
+        is_template=retained_as == "template",
+    )
+    if retained_as == "template":
+        archived = [assistant, _message(1)]
+        current = _checkpoint(tmp_path, archived, templates=1, tail=0)
+    else:
+        archived = [_message(1), assistant]
+        current = _checkpoint(tmp_path, archived, tail=1)
+    original_history = [message.model_copy(deep=True) for message in archived]
+
+    trajectory = _trajectory(current, tmp_path)
+    original, copied = [step for step in trajectory.steps if step.source == "agent"]
+    assert original.reasoning_content == "original reasoning"
+    assert original.metrics is not None
+    assert original.llm_call_count == 1
+    assert copied.is_copied_context
+    assert copied.message == original.message
+    assert (copied.extra or {})["copied_from_step_id"] == original.step_id
+    assert copied.reasoning_content is None
+    assert copied.metrics is None
+    assert copied.llm_call_count == 0
+    assert trajectory.final_metrics is not None
+    assert trajectory.final_metrics.extra is not None
+    assert trajectory.final_metrics.extra["llm_usage_expected_call_count"] == 1
+    assert trajectory.final_metrics.extra["llm_usage_observed_call_count"] == 1
+    assert trajectory.final_metrics.extra["observed_reasoning_tokens_lower_bound"] == 2
+    assert archived == original_history
+
+
 def test_summary_call_is_embedded_and_accounted(tmp_path: Path):
     archived = [_message(0), *_exchange(1), _message(2), *_exchange(3)]
     current = _with_summary_call(_checkpoint(tmp_path, archived, tail=3))
```

---

### Incident Patch 5: `b6d9da6e` (2026-09-28)
**Commit Message**: fix: honor Responses end_turn continuation in 0.10.39 (#989)

**File**: `docs/docs/guides/codex.md` (modified, +13/-0)
```diff
@@ -86,6 +86,19 @@ If you prefer, you can also run model setup explicitly:
 uvx fast-agent-mcp@latest model setup
 ```
 
+## Provider-requested continuation
+
+For OpenAI and Codex Responses (SSE or WebSocket), a completed response with
+explicit `end_turn: false` requests another inference, even without tool calls.
+fast-agent preserves the assistant output and continues without inventing a
+user prompt or tool result. These follow-ups share the agent's `max_iterations`
+budget with tool calls; cancellation and terminal errors still stop the turn.
+
+An absent or true `end_turn` retains normal stopping behavior. Commentary phase
+or text acknowledging unfinished work does not itself request continuation.
+Boolean `end_turn` values are retained in the `fast-agent-provider-diagnostics`
+history channel.
+
 ## Web search
 
 Use `fast-agent go --model 'astra?web_search=true'` to enable hosted web search;
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "fast-agent-mcp"
-version = "0.10.38"
+version = "0.10.39"
 description = "Code, Build and Evaluate agents - excellent Model and Skills/MCP/ACP/A2A Support"
 readme = "README.md"
 license = { file = "LICENSE" }
```

**File**: `src/fast_agent/agents/llm_agent.py` (modified, +2/-2)
```diff
@@ -369,7 +369,7 @@ def _build_stop_reason_additional_segments(
     ) -> list[Text]:
         segments: list[Text] = []
         stop_reason = message.stop_reason
-        if stop_reason in (None, LlmStopReason.END_TURN):
+        if stop_reason in (None, LlmStopReason.END_TURN, LlmStopReason.CONTINUE):
             return segments
         if stop_reason == LlmStopReason.TOOL_USE:
             tool_use_message = build_tool_use_additional_message(
@@ -839,7 +839,7 @@ def _display_trailing_user_messages(
         *,
         request_params: RequestParams | None,
     ) -> None:
-        if messages[-1].role != "user":
+        if not messages or messages[-1].role != "user":
             return
 
         trailing_users: list[PromptMessageExtended] = []
```

**File**: `src/fast_agent/agents/llm_decorator.py` (modified, +5/-3)
```diff
@@ -1034,9 +1034,11 @@ def _persist_history(
         assistant_message: PromptMessageExtended,
     ) -> None:
         """Persist the last turn unless explicitly disabled by control text."""
-        if not sanitized_messages:
-            return
-        if sanitized_messages[-1].first_text().startswith(CONTROL_MESSAGE_SAVE_HISTORY):
+        # Provider-requested follow-ups have no new user/tool input, but their
+        # assistant response must still be retained for subsequent inference.
+        if sanitized_messages and sanitized_messages[-1].first_text().startswith(
+            CONTROL_MESSAGE_SAVE_HISTORY
+        ):
             return
 
         history_messages = [self._strip_removed_metadata(msg) for msg in sanitized_messages]
```

**File**: `src/fast_agent/agents/tool_runner.py` (modified, +38/-20)
```diff
@@ -284,6 +284,15 @@ def _apply_assistant_message_state(self, assistant_message: PromptMessageExtende
             self._pending_tool_request = assistant_message
             self._pending_tool_response = None
             return
+        if assistant_message.stop_reason == LlmStopReason.CONTINUE:
+            if self._advance_iteration():
+                # History already contains this assistant response. Without history,
+                # retain it locally; never manufacture a user prompt/tool result.
+                if self._use_history_enabled():
+                    self._delta_messages = []
+                else:
+                    self._delta_messages.append(assistant_message)
+            return
         if self._should_start_deferred_structured_finalization(assistant_message):
             self._start_deferred_structured_finalization(assistant_message)
             return
@@ -294,7 +303,7 @@ async def until_done(self) -> PromptMessageExtended:
         try:
             async for message in self:
                 last = message
-                if message.stop_reason == LlmStopReason.TOOL_USE:
+                if message.stop_reason in (LlmStopReason.TOOL_USE, LlmStopReason.CONTINUE):
                     await self._persist_tool_loop_checkpoint(message)
             if last is None:
                 raise RuntimeError("ToolRunner produced no messages")
@@ -344,7 +353,10 @@ async def until_done(self) -> PromptMessageExtended:
 
     async def _maybe_auto_compact_before_followup_llm(self) -> None:
         message = self._last_message
-        if message is None or message.stop_reason != LlmStopReason.TOOL_USE:
+        if message is None or message.stop_reason not in (
+            LlmStopReason.TOOL_USE,
+            LlmStopReason.CONTINUE,
+        ):
             return
         try:
             from fast_agent.hooks.compaction import auto_compact_history_mid_turn
@@ -847,6 +859,29 @@ def _synthesize_passthrough_assistant(
             stop_reason=stop_reason,
         )
 
+    def _advance_iteration(self) -> bool:
+        """Charge tool and provider-requested follow-ups to the same finite budget."""
+        self._iteration += 1
+        max_iterations = (
+            self._request_params.max_iterations
+            if self._request_params is not None
+            else DEFAULT_MAX_ITERATIONS
+        )
+        if self._iteration <= max_iterations:
+            return True
+        _logger.warning(
+            "Tool loop stopped: maximum iterations reached",
+            data={
+                "agent_name": self._agent.name,
+                "iterations": self._iteration,
+                "max_iterations": max_iterations,
+            },
+        )
+        if self._last_message is not None:
+            self._last_message.stop_reason = LlmStopReason.MAX_ITERATIONS
+        self._done = True
+        return False
+
     async def _ensure_tools_ready(self) -> None:
         if self._tools is None:
             self._tools = (await self._agent.list_tools()).tools
@@ -875,27 +910,10 @@ async def _ensure_tool_response_staged(self) -> None:
             self._done = True
             return
 
-        self._iteration += 1
-        max_iterations = (
-            self._request_params.max_iterations
-            if self._request_params is not None
-            else DEFAULT_MAX_ITERATIONS
-        )
-        if self._iteration > max_iterations:
-            _logger.warning(
-                "Tool loop stopped: maximum iterations reached",
-                data={
-                    "agent_name": self._agent.name,
-                    "iterations": self._iteration,
-                    "max_iterations": max_iterations,
-                },
-            )
-            if self._last_message is not None:
-                self._last_message.stop_reason = LlmStopReason.MAX_ITERATIONS
+        if not self._advance_iteration():
             if self._use_history_enabled():
                 self._stage_tool_response(tool_message)
                 self._append_history_messages(*self._delta_messages)
-            self._done = True
             return
 
         if self._passthrough_enabled():
```

**File**: `src/fast_agent/llm/provider/openai/responses.py` (modified, +11/-2)
```diff
@@ -828,7 +828,7 @@ async def _apply_prompt_provider_specific(
         req_params = self.get_request_params(request_params)
 
         last_message = multipart_messages[-1]
-        if last_message.role == "assistant":
+        if last_message.role == "assistant" and last_message.stop_reason != LlmStopReason.CONTINUE:
             return last_message
 
         cache_state = None
@@ -1188,6 +1188,8 @@ def _responses_raw_item_channels(
     def _responses_diagnostics_channels(
         self,
         channels: dict[str, list[ContentBlock]] | None,
+        *,
+        end_turn: bool | None = None,
     ) -> dict[str, list[ContentBlock]] | None:
         tool_call_diagnostics = self._consume_tool_call_diagnostics()
         diagnostics_payload = dict(tool_call_diagnostics) if tool_call_diagnostics else None
@@ -1200,6 +1202,9 @@ def _responses_diagnostics_channels(
         ):
             diagnostics_payload = transport_diagnostics
 
+        if end_turn is not None:
+            diagnostics_payload = diagnostics_payload or {}
+            diagnostics_payload["end_turn"] = end_turn
         if not diagnostics_payload:
             return channels
         return self._add_response_channel(
@@ -1268,7 +1273,11 @@ def _finalize_responses_completion(
             None if stop_reason == LlmStopReason.SAFETY else self._extract_tool_calls(response)
         )
         channels, message_phase = self._responses_raw_item_channels(response, channels)
-        channels = self._responses_diagnostics_channels(channels)
+        # end_turn is a provider extension, not a typed SDK Response field.
+        end_turn = getattr(response, "end_turn", None)
+        channels = self._responses_diagnostics_channels(
+            channels, end_turn=end_turn if isinstance(end_turn, bool) else None
+        )
         channels = self._responses_server_tool_channels(response, channels)
 
         if getattr(response, "usage", None):
```

**File**: `src/fast_agent/llm/provider/openai/responses_output.py` (modified, +4/-0)
```diff
@@ -446,6 +446,10 @@ def _map_response_stop_reason(self, response: Any) -> LlmStopReason:
                 return LlmStopReason.SAFETY
             if reason == "max_output_tokens":
                 return LlmStopReason.MAX_TOKENS
+        # Provider extension: response completion need not finish the agent turn.
+        # Use identity, not truthiness: malformed values (e.g. 0) must not continue.
+        if status in (None, "completed") and getattr(response, "end_turn", None) is False:
+            return LlmStopReason.CONTINUE
         return LlmStopReason.END_TURN
 
     def _extract_reasoning_summary(
```

**File**: `src/fast_agent/types/llm_stop_reason.py` (modified, +1/-0)
```diff
@@ -20,6 +20,7 @@ class LlmStopReason(str, Enum):
     PAUSE = "pause"
 
     # Custom extensions for fast-agent
+    CONTINUE = "continue"  # Provider explicitly requests another inference without tools
     ERROR = "error"  # Used when there's an error in generation
     CANCELLED = "cancelled"  # Used when generation is cancelled by user
 
```

---

### Incident Patch 6: `da5f4f8a` (2026-09-28)
**Commit Message**: fix: reconstruct ATIF history across summary compaction (#987)

* fix: reconstruct ATIF audit history across summary compaction

* fast-agent 0.10.38

* feat: integrate Sonnet 5.5 and enable Claude 5.5 progress summaries

Add API-key and Copilot Sonnet 5.5 routing, native structured output defaults for GPT-6 and Claude 5.5, and adaptive summarized thinking for Sonnet and Opus 5.5. Upgrade Anthropic SDK to 1.9.0 and fix Copilot alias metadata lookup.

Add request/stream/replay contracts, live structured-output smoke tests, and a runnable progress demo. Verified 9019 unit tests, 12 live Copilot structured-output cases, and live default Opus progress.

* fix: preserve ATIF compaction context and summary accounting

Export retained model context as copied steps after replace boundaries and persist summary requests/responses for embedded trajectories and usage totals. Preserve original audit evidence and mark older checkpoints with missing summary accounting explicitly.

* fix: place Sonnet 5.5 directly below Opus 5.5 in picker

**File**: `docs/docs/guides/compaction.md` (modified, +44/-1)
```diff
@@ -38,9 +38,14 @@ A compaction does three things:
 3. **Replaces.** History becomes `templates + summary + recent turns`. The
    summary is a clearly-marked message (it shows as `compacted` in `/history`),
    not an ordinary user message. The original pre-compaction history is archived
-   to a `compacted_*.json` file in the session directory, so nothing is lost.
+   to a `compacted_*.json` file in the session directory when session history
+   persistence is enabled.
 
 If the summarization call fails or returns nothing, history is left untouched.
+With session history enabled, an archive failure also leaves history unchanged.
+Archives are published atomically under collision-resistant names; each new
+summary records the archive filename, SHA-256 digest, and retention boundaries.
+Prior summaries in that archive link to earlier archives.
 
 ## Automatic compaction
 
@@ -120,6 +125,44 @@ To recover the full pre-compaction transcript, load the archive:
 /history load compacted_20260613-120000_default.json
 ```
 
+## ATIF export after compaction
+
+Live ATIF output and persisted session ATIF export reconstruct archived history
+through the same verifier. Original messages and tool results appear once, in
+their original positions. Each summary becomes an ATIF `context_management`
+boundary (`type: "compaction"`, `boundary: "replace"`) following the ATIF v1.7
+convention:
+
+- the boundary step's `observation` holds the summary the model saw;
+- the system prompt, templates, and retained recent turns that stayed in the
+  model's context follow the boundary as `is_copied_context` steps, which carry
+  no usage and are excluded from SFT by spec-following consumers;
+- `extra.context_management` lists `removed_step_ids`, `retained_step_ids`, and
+  `copied_step_ids`, and each copy records `copied_from_step_id`;
+- the summarization model call is embedded in `subagent_trajectories`, referenced
+  from the boundary observation, and included in final metrics.
+
+A consumer applying the spec's replace-boundary rule therefore reconstructs the
+same context fast-agent sent to the model. Process-poll fold audits are still
+expanded, including when reconciling a raw transient final turn.
+
+Recovery follows linked archives and verifies exact template and retained-tail
+sequences; it does not concatenate current/previous snapshots or globally
+deduplicate messages. Legacy unlinked archives require a unique exact positive
+tail overlap, timestamped originals, and an archive filename timestamp within
+five seconds before the summary. Missing, malformed, conflicting, or ambiguous
+evidence fails the full export rather than silently producing a partial trace.
+This includes legacy summary-only histories and retained tails whose exact
+overlap can no longer be verified.
+
+Disabling session history still permits ordinary compaction, but a full ATIF
+export cannot recover discarded history. Persisted recovery covers saved
+evidence only, not unsaved messages lost on hard termination. It does not merge
+existing ATIF files: preserve those separately when they contain extra transient
+evidence. Checkpoints written before summary calls were recorded have no
+summary usage: their boundaries report `summary_usage: "unavailable"` and
+final metrics mark the accounting as excluding those calls.
+
 ## Manual compaction from the Harness API
 
 Under the Harness API, auto-compaction is on by default just as in the TUI. To
```

**File**: `docs/docs/models/providers/anthropic.md` (modified, +59/-3)
```diff
@@ -20,6 +20,60 @@ recorded for diagnostics.
 connect/write/pool limits remain unchanged. A numeric value also bounds stream
 startup as before.
 
+## Claude Sonnet 5.5
+
+`sonnet`, `claude`, and `sonnet55` select `claude-sonnet-5-5`.
+`sonnet5` remains pinned to Sonnet 5.
+
+```bash
+# Uses ANTHROPIC_API_KEY (or anthropic.api_key in configuration).
+uv run fast-agent go --model sonnet55
+# Uses the existing Copilot login, not your Anthropic API key.
+uv run fast-agent go --model copilot.sonnet55
+```
+
+Sonnet 5.5 has a 1M-token context and 128K maximum output. Adaptive thinking
+defaults to `high` effort; `low`, `medium`, `high`, `xhigh`, and `max` are
+supported. fast-agent requests `thinking: {"type": "adaptive", "display": "summarized"}`
+by default on both API-key and Copilot routes, preserving adaptive thinking while
+making progress summaries visible. Explicit request metadata can override display.
+`reasoning=off` sends `thinking: {"type": "between_tools"}` rather
+than `disabled`. This mode supports only low/medium/high effort; manual thinking
+budgets and forced tool choice are rejected locally. Unsupported sampling controls
+are removed. Preserve signed thinking blocks unchanged and keep history append-only.
+
+See Anthropic's [Sonnet 5.5 migration notes](https://platform.claude.com/docs/en/models/sonnet-5-5/whats-new-sonnet-5-5).
+
+### Structured output: current models
+
+GPT-6 Astra/Sol/Luna, Opus 5.5, and Sonnet 5.5 use JSON-schema output by
+default on their API-key and Copilot routes. GPT-6 uses Responses `text.format`;
+Claude uses Messages `output_config.format`. Regular tools may coexist with the
+schema (`structured_tool_policy: always`). Request-level `no_tools` and `defer`
+remain available. Do not select legacy `tool_use` output mode for Claude 5.5:
+those models reject forced tool choice.
+
+Local mocked-HTTP tests cover schema payloads, tool coexistence, tool suppression,
+schema deferral, and Copilot header restrictions. Live Copilot smoke tests passed
+on September 28, 2026 for all five models, both schema-only and tool-call-to-schema
+round trips, including Sonnet 5.5 with `reasoning=off`. The accepted Sonnet wire ID
+is `claude-sonnet-5.5`. Direct API smoke tests remain blocked by missing credentials
+in the test environment.
+
+Use `structured_schema()` for structured output through the normal agent tool
+loop; `structured()` is the Pydantic-only output path and does not run that loop.
+The live tool test reads a randomly generated value from a local function tool
+and checks both tool execution and the final schema-validated value.
+
+To verify real responses with your configured credentials and Copilot account
+(this makes billable requests):
+
+```bash
+uv run pytest tests/e2e/structured/test_current_model_structured_outputs.py -q
+# Or test only the Sonnet routes:
+uv run pytest tests/e2e/structured/test_current_model_structured_outputs.py -q -k sonnet55
+```
+
 ## Claude Opus 5.5
 
 Released September 22, 2026. `opus` and `opus55` select `claude-opus-5-5`;
@@ -33,13 +87,15 @@ Released September 22, 2026. `opus` and `opus55` select `claude-opus-5-5`;
   confirmed in the [Anthropic effort documentation](https://platform.claude.com/docs/en/build-with-claude/effort).
   Fast-mode pricing is not assumed.
 - Forced tool use is unsupported. Use `auto` or `none`, and native JSON mode for
-  structured output on direct Anthropic. Copilot retains its existing structured-output
-  restrictions (forced-tool fallback is rejected). Unsupported sampling controls
+  structured output on both direct Anthropic and Copilot routes. Legacy forced-tool
+  output mode is rejected. Unsupported sampling controls
   are removed, as for Fable 5.1.
 - Thinking blocks belong to their originating model and conversation. Do not
   transplant them into other conversations or models, or edit earlier history.
   Preserve empty signed thinking blocks and text between tool calls. Thinking
-  display is empty by default; fast-agent does not request summarized display.
+  display is omitted by the provider by default; fast-agent explicitly requests
+  `thinking: {"type": "adaptive", "display": "summarized"}` on API-key and Copilot
+  routes so progress is visible while adaptive thinking remains on.
 - Anthropic pricing per million tokens: input **$4**, output **$20**, 5-minute
   cache writes **$5**, 1-hour cache writes **$8**, cache reads **$0.20**.
   Cache reads are **5%** of input price, not 10%. These are not Copilot charges.
```

**File**: `docs/docs/models/providers/copilot.md` (modified, +73/-1)
```diff
@@ -96,7 +96,8 @@ not canonical and has no alias; use `copilot.claude-opus-5`.
 | Model | Wire API |
 | --- | --- |
 | `copilot.claude-haiku-4.5` | Messages |
-| `copilot.claude-sonnet-5` | Messages |
+| `copilot.claude-sonnet-5.5` (`copilot.sonnet`, `copilot.sonnet55`) | Messages |
+| `copilot.claude-sonnet-5` (pinned older version) | Messages |
 | `copilot.claude-opus-4-8` | Messages |
 | `copilot.claude-opus-5.5` (`copilot.opus`, `copilot.opus55`) | Messages |
 | `copilot.claude-opus-5` (pinned older version) | Messages |
@@ -113,6 +114,77 @@ Provider identity stays Copilot regardless of wire API; Anthropic/OpenAI API
 keys are not used for these models. The status bar prefixes Copilot model labels
 with `(cp)`; this does not change the model name used in configuration.
 
+## Structured output
+
+GPT-6 Astra/Sol/Luna use Responses JSON schema (`text.format`).
+Opus 5.5 and Sonnet 5.5 select Messages JSON schema (`output_config.format`)
+automatically, without direct Anthropic beta headers. Regular tools can coexist
+with the schema; explicit `structured_tool_policy` overrides remain supported.
+Legacy forced-tool output mode is rejected for Claude 5.5.
+
+Live schema-only and tool-call-to-schema smoke tests passed for all five models
+on September 28, 2026, including the Sonnet 5.5 wire ID `claude-sonnet-5.5` and
+its `reasoning=off` setting. These results confirm access for the tested account;
+availability can still vary by account. Use `structured_schema()` for the tool
+loop. See the [credentialed smoke tests](anthropic.md#structured-output-current-models).
+
+## Claude 5.5 progress visibility
+
+Live-tested on September 28, 2026 through the normal fast-agent tool loop.
+Sonnet 5.5 and Opus 5.5 request adaptive thinking with summarized display by default,
+on both Copilot and direct Anthropic routes. No request metadata is needed.
+The live default-mode demo confirmed 412 between-tool summary characters after
+this change, with all three tool calls completing. Opus 5.5's default-mode probe
+also passed, showing 507 between-tool summary characters without request metadata.
+
+Explicit request metadata still takes precedence; for example, to keep adaptive
+thinking but suppress its summaries:
+
+```python
+from fast_agent.types import RequestParams
+
+response = await agent.probe.generate(
+    "Inspect the batch and give brief progress updates between tool calls.",
+    request_params=RequestParams(
+        max_tokens=4096,
+        metadata={"thinking": {"type": "adaptive", "display": "omitted"}},
+    ),
+)
+```
+
+Alternatively, select `copilot.sonnet55?reasoning=off`. This uses `between_tools`:
+no up-front thinking, but readable between-tool progress summaries. Do **not**
+add a `display` field to `between_tools`; the model rejects that combination.
+This alternative applies only to Sonnet: Opus 5.5 keeps adaptive thinking always on.
+
+Run the billable synthetic inspection demo:
+
+```bash
+uv run examples/copilot/sonnet_progress.py --mode all
+# Individual modes: default, summarized, omitted, between_tools
+```
+
+The demo uses three sequential local tools, renders the normal terminal output,
+and reports timestamps and stream channels. Before changing the default, one observed run produced:
+
+| Mode | Visible thinking-summary characters between tools | Ordinary text characters between tools |
+| --- | ---: | ---: |
+| Previous default (display omitted) | 0 | 0 |
+| Adaptive, display summarized | 473 | 0 |
+| between_tools | 314 | 0 |
+
+These counts describe that run, not guarantees. Retesting with Anthropic SDK
+1.9.0 also passed all three modes: 0, 369, and 337 between-tool summary characters,
+respectively. An earlier shorter-update probe returned ordinary text progress
+even without a display override. The longer
+probe reproduced the silent gaps and demonstrated summaries arriving **before**
+the next tool executed, rather than only in the final answer.
+
+The existing thinking-stream renderer already displays these summaries.
+`display: summarized` can also return up-front thinking summaries: it is not a
+progress-only channel. Only Sonnet 5.5 and Opus 5.5 defaults changed; other models are unaffected. Signed thinking blocks must
+still be replayed unchanged, including empty blocks in omitted-display mode.
+
 ## Model parameters
 
 Copilot-routed models inherit the base model's local metadata parameters, so
```

**File**: `examples/copilot/sonnet_progress.py` (added, +138/-0)
```diff
@@ -0,0 +1,138 @@
+"""Live, billable Sonnet 5.5 progress demo using the normal harness/tool loop.
+
+Run: uv run examples/copilot/sonnet_progress.py --mode all
+Requires Copilot login. Sends only synthetic data; never prints credentials or signatures.
+"""
+
+import argparse
+import asyncio
+from dataclasses import dataclass
+from time import monotonic
+from typing import Literal
+
+from fast_agent import FastAgent
+from fast_agent.llm.stream_types import StreamChunk
+from fast_agent.types import LlmStopReason, RequestParams
+
+type DisplayMode = Literal["default", "summarized", "omitted", "between_tools"]
+MODES: tuple[DisplayMode, ...] = ("default", "summarized", "omitted", "between_tools")
+
+
+@dataclass(frozen=True)
+class Observation:
+    seconds: float
+    completed_tools: int
+    kind: str
+    text: str
+
+
+async def demonstrate(mode: DisplayMode) -> None:
+    model = "copilot.sonnet55"
+    if mode == "between_tools":
+        model += "?reasoning=off"
+    fast = FastAgent(f"Sonnet progress: {mode}", ignore_unknown_args=True)
+    observations: list[Observation] = []
+    calls: list[str] = []
+    start = monotonic()
+
+    @fast.tool
+    def read_station(station: Literal["inventory", "sample", "verification"]) -> str:
+        """Read a synthetic station report. Follow the next_station in each result."""
+        calls.append(station)
+        observations.append(Observation(monotonic() - start, len(calls), "tool", station))
+        match station:
+            case "inventory":
+                return "Batch LANTERN has 12 sealed containers. next_station: sample."
+            case "sample":
+                return "Sample temperature is 18 C, within the 15-20 C target. next_station: verification."
+            case "verification":
+                return "All 12 seals passed inspection. Final status: READY."
+
+    def observe(chunk: StreamChunk) -> None:
+        if chunk.event == "delta" and chunk.text:
+            observations.append(
+                Observation(
+                    monotonic() - start,
+                    len(calls),
+                    "thinking" if chunk.is_reasoning else "text",
+                    chunk.text,
+                )
+            )
+
+    @fast.agent(
+        "probe",
+        model=model,
+        instruction=(
+            "Run the requested inspection using the provided tool. Before each tool call, "
+            "give a public-facing progress update of 80-100 words in four sentences: what "
+            "was observed, which station you will check next, and what that check establishes. "
+            "Describe actions and observable results, not private reasoning. "
+            "Make sequential tool calls, following next_station. Do not skip stations."
+        ),
+    )
+    async def run() -> None:
+        async with fast.run() as agent:
+            remove = agent.probe.add_stream_listener(observe)
+            params = RequestParams(max_tokens=4096, max_iterations=6)
+            if mode in {"summarized", "omitted"}:
+                params.metadata = {"thinking": {"type": "adaptive", "display": mode}}
+            try:
+                response = await agent.probe.generate(
+                    "Inspect batch LANTERN, starting at inventory. Report the final status.",
+                    request_params=params,
+                )
+            finally:
+                remove()
+            assert response.stop_reason == LlmStopReason.END_TURN, response.stop_reason
+            assert calls == ["inventory", "sample", "verification"], calls
+            assert "READY" in response.all_text().upper()
+
+    print(f"\n=== {mode} ===", flush=True)
+    await run()
+    print(f"\n=== {mode}: observed stream timeline ===")
+    # Group deltas by tool boundary and channel. Never display opaque signed blocks.
+    for completed in range(4):
+        for kind in ("thinking", "text"):
+            chunks = [
+                item
+                for item in observations
+                if item.completed_tools == completed and item.kind == kind
+            ]
+            if chunks:
+                text = "".join(item.text for item in chunks)
+                print(
+                    f"+{chunks[0].seconds:.2f}s after {completed} tools: "
+                    f"{kind}, {len(text)} chars: {text[:300]!r}"
+                )
+        if completed < len(calls):
+            tool = next(
+                item
+                for item in observations
+                if item.kind == "tool" and item.completed_tools == completed + 1
+            )
+            print(f"+{tool.seconds:.2f}s tool: {tool.text}")
+    between = [
+        item for item in observations if item.kind == "thinking" and 0 < item.completed_tools < 3
+    ]
+    print(f"Between-tool thinking-summary characters: {sum(len(item.text) for item in between)}")
+    visible = [
+        item
+        for item in observations
+        if item.kind in {"thinking", "text"} and 0 < item.co
```

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "fast-agent-mcp"
-version = "0.10.37"
+version = "0.10.38"
 description = "Code, Build and Evaluate agents - excellent Model and Skills/MCP/ACP/A2A Support"
 readme = "README.md"
 license = { file = "LICENSE" }
@@ -23,7 +23,7 @@ dependencies = [
     "pyyaml==6.0.3",
     "rich==15.0.0",
     "typer==0.27.2",
-    "anthropic[vertex]==1.8.0",
+    "anthropic[vertex]==1.9.0",
     "openai[aiohttp,realtime]==3.19.2",
     "prompt-toolkit==3.0.53",
     "aiohttp==3.14.3",
```

**File**: `src/fast_agent/cli/runtime/agent_setup.py` (modified, +31/-13)
```diff
@@ -459,15 +459,19 @@ async def _export_live_atif_trajectory(
     from fast_agent.session.trace_export_atif import (
         AtifRunSource,
         build_atif_trajectory,
+        live_export_history,
         write_atif_trajectory,
     )
 
     agent_obj = agent_app._agent(request.target_agent_name)
-    messages = (
+    messages = live_export_history(
+        list(agent_obj.message_history),
         transient_messages_by_agent.get(agent_obj.name)
         if transient_messages_by_agent is not None
-        else None
-    ) or [message.model_copy(deep=True) for message in agent_obj.message_history]
+        else None,
+        _live_atif_session_dir(session_manager, harness_session),
+        agent_obj.name,
+    )
     if not messages:
         return
     model_name, provider = _live_atif_model_metadata(agent_obj, request)
@@ -524,18 +528,22 @@ async def _export_parallel_atif_trajectory(
     from fast_agent.session.trace_export_atif import (
         AtifRunSource,
         build_atif_fanout_trajectory,
+        live_export_history,
         write_atif_trajectory,
     )
 
     session_id = _live_atif_session_id(session_manager, harness_session)
     sources: list[AtifRunSource] = []
     for agent_name in fan_out_agent_names:
         agent_obj = agent_app._agent(agent_name)
-        messages = (
+        messages = live_export_history(
+            list(agent_obj.message_history),
             transient_messages_by_agent.get(agent_name)
             if transient_messages_by_agent is not None
-            else None
-        ) or [message.model_copy(deep=True) for message in agent_obj.message_history]
+            else None,
+            _live_atif_session_dir(session_manager, harness_session),
+            agent_name,
+        )
         if not messages:
             continue
         model_name, provider = _live_atif_model_metadata(agent_obj, request)
@@ -580,13 +588,23 @@ async def _export_failed_one_shot_atif(
     if isinstance(agent_obj, ToolAgent) and agent_obj.last_turn_messages:
         messages = [message.model_copy(deep=True) for message in agent_obj.last_turn_messages]
     else:
-        messages = [
-            *(
-                message.model_copy(deep=True)
-                for message in normalize_to_extended_list(prompt_payload)
-            ),
-            *(message.model_copy(deep=True) for message in new_history),
-        ]
+        from fast_agent.constants import FAST_AGENT_COMPACTION_CHANNEL
+
+        if any(
+            FAST_AGENT_COMPACTION_CHANNEL in (message.channels or {})
+            for message in agent_obj.message_history
+        ):
+            # History length is not monotonic across compaction. Do not slice by
+            # the pre-turn length or fabricate a duplicate prompt on cancellation.
+            messages = []
+        else:
+            messages = [
+                *(
+                    message.model_copy(deep=True)
+                    for message in normalize_to_extended_list(prompt_payload)
+                ),
+                *(message.model_copy(deep=True) for message in new_history),
+            ]
     await _export_live_atif_trajectory(
         agent_app,
         request,
```

**File**: `src/fast_agent/history/atif_reconstruction.py` (added, +284/-0)
```diff
@@ -0,0 +1,284 @@
+"""Verified, sequence-based recovery of compacted ATIF history.
+
+Archives are snapshots, not additive event logs. Only a checkpoint's linked
+snapshot (or one uniquely verified legacy snapshot) is expanded. Current and
+previous session snapshots must never be unioned to recover a trajectory.
+"""
+
+from __future__ import annotations
+
+import hashlib
+import json
+from datetime import datetime, timezone
+from pathlib import Path
+
+from mcp_types import TextContent
+
+from fast_agent.constants import FAST_AGENT_COMPACTION_CHANNEL, FAST_AGENT_PROCESS_POLL_FOLD
+from fast_agent.types import PromptMessageExtended
+
+COMPACTION_BOUNDARY = "fast-agent-atif-compaction-boundary"
+COPIED_CONTEXT = "fast-agent-atif-copied-context"
+_EXPORT_MARKERS = (COMPACTION_BOUNDARY, COPIED_CONTEXT)
+
+
+class HistoryReconstructionError(ValueError):
+    """A complete audit history cannot be established from the available evidence."""
+
+
+def _metadata(message: PromptMessageExtended, channel: str) -> dict[str, object] | None:
+    blocks = (message.channels or {}).get(channel)
+    if blocks is None:
+        return None
+    if len(blocks) != 1 or not isinstance(blocks[0], TextContent):
+        raise HistoryReconstructionError("Malformed compaction metadata")
+    try:
+        value = json.loads(blocks[0].text)
+    except ValueError:
+        raise HistoryReconstructionError("Malformed compaction metadata") from None
+    if not isinstance(value, dict):
+        raise HistoryReconstructionError("Malformed compaction metadata")
+    return value
+
+
+def _count(metadata: dict[str, object], key: str) -> int:
+    value = metadata.get(key)
+    if type(value) is not int or value < 0:
+        raise HistoryReconstructionError("Invalid compaction boundary count")
+    return value
+
+
+def _load_archive(path: Path, expected_digest: str | None = None) -> list[PromptMessageExtended]:
+    # The permissive general history loader can silently skip malformed messages.
+    # Audit recovery must validate every message instead.
+    try:
+        data = path.read_bytes()
+        if expected_digest is not None and hashlib.sha256(data).hexdigest() != expected_digest:
+            raise HistoryReconstructionError("Compaction archive digest mismatch")
+        payload = json.loads(data)
+        if not isinstance(payload, dict) or not isinstance(payload.get("messages"), list):
+            raise ValueError
+        return [PromptMessageExtended.model_validate(item) for item in payload["messages"]]
+    except HistoryReconstructionError:
+        raise
+    except (OSError, ValueError):
+        raise HistoryReconstructionError("Unreadable or malformed compaction archive") from None
+
+
+def reconstruct_history(
+    history: list[PromptMessageExtended],
+    session_dir: Path | None,
+    agent_name: str,
+    *,
+    _lineage: frozenset[Path] = frozenset(),
+) -> list[PromptMessageExtended]:
+    """Restore originals once, followed by an explicit model-context boundary.
+
+    A retained tail has already executed when compaction occurs: it stays in its
+    original position, before the boundary, not replayed after the summary.
+    """
+    checkpoints = [
+        (index, metadata)
+        for index, message in enumerate(history)
+        if (metadata := _metadata(message, FAST_AGENT_COMPACTION_CHANNEL)) is not None
+    ]
+    if not checkpoints:
+        return list(history)
+    if len(checkpoints) != 1:
+        raise HistoryReconstructionError("Ambiguous compaction checkpoints")
+    index, metadata = checkpoints[0]
+    if not all(message.is_template for message in history[:index]):
+        raise HistoryReconstructionError("Compaction checkpoint has a non-template prefix")
+    if session_dir is None:
+        raise HistoryReconstructionError("Full export requires compaction archives")
+    compacted = _count(metadata, "messages_compacted")
+    if compacted == 0:
+        raise HistoryReconstructionError("Empty compaction boundary")
+    archive_name = metadata.get("archive_file")
+    linked = "archive_file" in metadata
+    if linked:
+        if not isinstance(archive_name, str) or Path(archive_name).name != archive_name:
+            raise HistoryReconstructionError("Compaction archive unavailable or invalid")
+        candidates = [session_dir / archive_name]
+    else:
+        safe_agent = "".join(c if c.isalnum() or c in "-_" else "_" for c in agent_name)
+        candidates = sorted(session_dir.glob(f"compacted_*_{safe_agent}.json"))
+
+    matches: list[tuple[Path, list[PromptMessageExtended], int]] = []
+    for path in candidates:
+        if path.is_symlink() or path.resolve().parent != session_dir.resolve():
+            raise HistoryReconstructionError("Compaction archive escapes session directory")
+        digest = metadata.get("archive_sha256") if linked else None
+        if linked and (not isinstance(digest, str) or not digest):
+            raise HistoryReconstructionError("Compactio
```

**File**: `src/fast_agent/history/compaction.py` (modified, +34/-2)
```diff
@@ -12,7 +12,11 @@
 
 from __future__ import annotations
 
+import hashlib
 import json
+import os
+import tempfile
+import uuid
 from dataclasses import dataclass
 from datetime import datetime, timezone
 from pathlib import Path
@@ -434,6 +438,7 @@ def build_summary_message(
     tokens_before: int | None,
     context_window: int | None,
     model: str | None,
+    archive_metadata: dict[str, object] | None = None,
 ) -> PromptMessageExtended:
     """Build the checkpoint summary as a user message with a typed compaction channel."""
     visible = f"[COMPACTED HISTORY]\n{SUMMARY_NOTICE}\n\n{summary_text}"
@@ -446,6 +451,8 @@ def build_summary_message(
         "prompt": prompt_text,
         "instructions": instructions,
     }
+    if archive_metadata is not None:
+        metadata.update(archive_metadata)
     message = Prompt.user(visible)
     message.channels = {
         FAST_AGENT_COMPACTION_CHANNEL: [
@@ -512,9 +519,18 @@ def _archive_history(
 
         stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
         safe_agent = "".join(c if c.isalnum() or c in "-_" else "_" for c in agent.name)
-        filename = f"compacted_{stamp}_{safe_agent}.json"
+        filename = f"compacted_{stamp}_{uuid.uuid4().hex}_{safe_agent}.json"
         filepath = session.directory / filename
-        save_messages(history, str(filepath))
+        with tempfile.NamedTemporaryFile(
+            dir=session.directory, prefix=".compaction-", suffix=".json", delete=False
+        ) as handle:
+            temporary = Path(handle.name)
+        try:
+            save_messages(history, str(temporary))
+            # Publish only complete bytes, without overwriting an existing archive.
+            os.link(temporary, filepath)
+        finally:
+            temporary.unlink(missing_ok=True)
         manager.set_current_session(session)
         return str(filepath)
     except RuntimeError as exc:
@@ -612,6 +628,8 @@ async def compact_conversation(
         raise CompactionError("Compaction model returned an empty summary; history unchanged.")
 
     archive_file = _archive_history(agent, history)
+    if archive_file is None and _session_persistence_enabled(agent):
+        raise CompactionError("Compaction archive failed; history unchanged.")
 
     summary_message = build_summary_message(
         summary_text,
@@ -621,6 +639,20 @@ async def compact_conversation(
         tokens_before=tokens_before,
         context_window=context_window,
         model=usage.model if usage else None,
+        archive_metadata={
+            "archive_file": Path(archive_file).name if archive_file else None,
+            "archive_sha256": (
+                hashlib.sha256(Path(archive_file).read_bytes()).hexdigest()
+                if archive_file
+                else None
+            ),
+            "template_messages": len(plan.templates),
+            "retained_messages": len(plan.retained_tail),
+            # The summarization call is a real model call: keep its request and
+            # response (with usage/timing channels) so exports can account for it.
+            "summary_request": request_text,
+            "summary_response": response.model_dump(by_alias=True, mode="json", exclude_none=True),
+        },
     )
 
     new_history = plan.templates + [summary_message] + plan.retained_tail
```

---

### Incident Patch 7: `ce6c0f9b` (2026-09-26)
**Commit Message**: fix: persist safe Responses websocket failure diagnostics (#984)

**File**: `docs/docs/ref/config_file.md` (modified, +16/-0)
```diff
@@ -779,6 +779,22 @@ When `logger.path` is omitted, file logging writes to
 `<current-working-directory>/fast-agent-log.jsonl`. Explicit relative paths continue to resolve
 from the process current working directory.
 
+Responses websocket failures emit an error-level structured event,
+`Responses websocket attempt failed`, through this logging path, including failures
+recovered by the transport's bounded reconnect. File logging persists these events
+as JSONL even at `level: "error"`; they do not depend on a completed assistant
+response or ATIF export. Logging disabled with `type: "none"` does not persist them.
+
+The `fast-agent.responses-websocket-failure/v1` payload includes an allowlisted
+`error_code` (`null` when absent, `unknown` for unrecognized codes), `stream_started`,
+connection ages at request start and failure in seconds (`null` when unknown),
+reuse status, and `reconnect_eligible`. Ages use the connection manager's monotonic
+clock. Eligibility describes the existing single transport reconnect only, not
+outer provider retries; `websocket_attempt` / `websocket_max_attempts` distinguish
+that bound from the provider `call`, `attempt`, and `max_attempts` counters.
+The diagnostic contains no error text, headers, URLs, request/response bodies,
+prompts, or credentials. It does not change retry or timeout policy.
+
 ## MCP Diagnostics Settings
 
 ```yaml
```

**File**: `src/fast_agent/core/logging/json_serializer.py` (modified, +4/-0)
```diff
@@ -287,6 +287,10 @@ def _serialize_object(self, obj: Any, depth: int = 0) -> Any:
         # Handle None
         if obj is None:
             return None
+        # Immutable JSON scalars can share identity (especially bool/small int).
+        # Repeated values are not cycles and must retain their JSON types.
+        if isinstance(obj, _JSON_NATIVE_SCALAR_TYPES):
+            return obj
 
         if depth == 0:
             self._parent_obj = obj
```

**File**: `src/fast_agent/llm/provider/openai/responses.py` (modified, +100/-4)
```diff
@@ -2,7 +2,7 @@
 import json
 import time
 from contextlib import asynccontextmanager
-from dataclasses import dataclass
+from dataclasses import asdict, dataclass
 from functools import partial
 from typing import Any, ClassVar, Literal
 from uuid import uuid4
@@ -149,12 +149,52 @@ class _ResponsesWsAttemptState:
     is_reusable: bool
     reused_existing_connection: bool
     planner: ResponsesWsRequestPlanner
+    connection_age_at_request_start_seconds: float | None = None
     keep_connection: bool = False
     retry_after_release: bool = False
     reconnect_diagnostics: dict[str, Any] | None = None
     stream: WebSocketResponsesStream | None = None
 
 
+@dataclass(frozen=True, slots=True)
+class _ResponsesWsFailureDiagnostic:
+    error_code: str | None
+    stream_started: bool
+    connection_age_at_request_start_seconds: float | None
+    connection_age_at_failure_seconds: float | None
+    reused_connection: bool | None
+    reconnect_eligible: bool
+    websocket_attempt: int
+    call: int
+    attempt: int
+    max_attempts: int
+    schema: Literal["fast-agent.responses-websocket-failure/v1"] = (
+        "fast-agent.responses-websocket-failure/v1"
+    )
+    transport: Literal["websocket"] = "websocket"
+    websocket_max_attempts: Literal[2] = 2
+
+
+def _safe_websocket_error_code(code: str | None) -> str | None:
+    # A provider-controlled string may contain secrets even if short/alphanumeric.
+    # Never persist arbitrary codes, truncated codes, or a hash of their contents.
+    if code is None:
+        return None
+    if code in {
+        "previous_response_not_found",
+        "websocket_connection_limit_reached",
+        "invalid_request_error",
+        "server_error",
+        "rate_limit_exceeded",
+        "insufficient_quota",
+        "context_length_exceeded",
+        "model_not_found",
+        "invalid_api_key",
+    }:
+        return code
+    return "unknown"
+
+
 class ResponsesLLM(
     OpenAIStructuredOutputMixin,
     ResponsesContentMixin,
@@ -1516,6 +1556,9 @@ async def _create_connection() -> ManagedWebSocketConnection:
             is_reusable=is_reusable,
             reused_existing_connection=reused_existing_connection,
             planner=planner,
+            connection_age_at_request_start_seconds=(
+                self._ws_connections.connection_age_seconds(connection)
+            ),
         )
 
     async def _run_responses_ws_attempt(
@@ -1695,6 +1738,47 @@ def _log_responses_ws_retry(
             data=retry_data,
         )
 
+    def _record_responses_ws_failure(
+        self,
+        error: Exception,
+        *,
+        attempt: int,
+        attempt_state: _ResponsesWsAttemptState | None,
+    ) -> None:
+        """Persist failures, including recovered and terminal attempts, via JSONL logging.
+
+        Eligibility describes only the existing bounded transport reconnect, not
+        outer provider retries. No provider text or request metadata is serialized.
+        """
+        ws_error = error if isinstance(error, ResponsesWebSocketError) else None
+        stream = attempt_state.stream if attempt_state is not None else None
+        call, provider_attempt, max_attempts = self._stream_attempt or (0, 1, 1)
+        diagnostic = _ResponsesWsFailureDiagnostic(
+            error_code=_safe_websocket_error_code(ws_error.diagnostic_error_code)
+            if ws_error
+            else None,
+            stream_started=(
+                ws_error.stream_started if ws_error else stream.stream_started if stream else False
+            ),
+            connection_age_at_request_start_seconds=(
+                attempt_state.connection_age_at_request_start_seconds if attempt_state else None
+            ),
+            connection_age_at_failure_seconds=(
+                self._ws_connections.connection_age_seconds(attempt_state.connection)
+                if attempt_state
+                else None
+            ),
+            reused_connection=attempt_state.reused_existing_connection if attempt_state else None,
+            reconnect_eligible=attempt_state.retry_after_release if attempt_state else False,
+            websocket_attempt=attempt + 1,
+            call=call,
+            attempt=provider_attempt,
+            max_attempts=max_attempts,
+        )
+        # Match the shared stream-failure path's severity: info retry notices are
+        # filtered out by error-level telemetry configurations.
+        self.logger.error("Responses websocket attempt failed", data=asdict(diagnostic))
+
     async def _responses_completion_ws(
         self,
         *,
@@ -1712,9 +1796,14 @@ async def _responses_completion_ws(
         last_error: ResponsesWebSocketError | None = None
         reconnected = False
         for attempt in range(2):
-            attempt_state = await self._acquire_responses_ws_attempt(
-                attempt=attempt, context=context
-            )
+            try:
+                attempt_state = await self._acq
```

**File**: `src/fast_agent/llm/provider/openai/responses_websocket.py` (modified, +21/-0)
```diff
@@ -75,6 +75,7 @@ def __init__(
         *,
         stream_started: bool = False,
         error_code: str | None = None,
+        diagnostic_error_code: str | None = None,
         status: int | None = None,
         error_param: str | None = None,
         headers: dict[str, str] | None = None,
@@ -83,11 +84,17 @@ def __init__(
         super().__init__(message)
         self.stream_started = stream_started
         self.error_code = error_code
+        self._diagnostic_error_code = diagnostic_error_code
         self.status = status
         self.error_param = error_param
         self.headers = headers
         self.stream_id = stream_id
 
+    @property
+    def diagnostic_error_code(self) -> str | None:
+        """Failure code for telemetry only; never used to decide retries."""
+        return self._diagnostic_error_code or self.error_code
+
 
 class _AttrObjectView:
     """Tiny adapter that exposes dictionary keys as attributes recursively."""
@@ -1000,10 +1007,18 @@ def _raise_payload_error(self, payload: Mapping[str, Any]) -> None:
             error_headers,
             stream_id,
         ) = self._extract_error_details(payload)
+        diagnostic_error_code: str | None = None
+        if payload.get("type") == "response.failed":
+            response = payload.get("response")
+            if isinstance(response, Mapping):
+                error = response.get("error")
+                if isinstance(error, Mapping):
+                    diagnostic_error_code = _non_empty_string(error.get("code"))
         raise ResponsesWebSocketError(
             error_message,
             stream_started=self._stream_started,
             error_code=error_code,
+            diagnostic_error_code=diagnostic_error_code,
             status=error_status,
             error_param=error_param,
             headers=error_headers,
@@ -1201,6 +1216,12 @@ def _mark_created(
         if connection.reuse_key is None:
             connection.reuse_key = reuse_key
 
+    def connection_age_seconds(self, connection: ManagedWebSocketConnection) -> float | None:
+        """Observe age using the same monotonic clock as connection lifecycle policy."""
+        if connection.created_monotonic is None:
+            return None
+        return round(max(0.0, self._clock() - connection.created_monotonic), 3)
+
     def _is_too_old(self, connection: ManagedWebSocketConnection) -> bool:
         if self._max_age_seconds <= 0 or connection.created_monotonic is None:
             return False
```

**File**: `tests/unit/fast_agent/core/test_json_serializer.py` (added, +13/-0)
```diff
@@ -0,0 +1,13 @@
+"""JSON telemetry preserves scalar types even when Python reuses object identities."""
+
+import json
+
+from fast_agent.core.logging.json_serializer import JSONSerializer
+
+
+def test_repeated_json_scalars_keep_their_types() -> None:
+    values = [False, False, True, True, 2, 2, 0.0, 0.0, None, None, "same", "same"]
+    result = json.loads(json.dumps(JSONSerializer()({"first": values, "second": values.copy()})))
+    for key in ("first", "second"):
+        assert result[key] == values
+        assert [type(value) for value in result[key]] == [type(value) for value in values]
```

**File**: `tests/unit/fast_agent/llm/providers/test_responses_websocket.py` (modified, +263/-4)
```diff
@@ -7,6 +7,7 @@
 from typing import TYPE_CHECKING, Any, Literal, cast
 
 import pytest
+import pytest_asyncio
 from aiohttp import WSMsgType
 from mcp_types import CallToolResult, TextContent
 from openai import omit
@@ -23,6 +24,8 @@
     FAST_AGENT_RETRY,
 )
 from fast_agent.context import Context
+from fast_agent.core.logging.events import EventFilter
+from fast_agent.core.logging.transport import AsyncEventBus, FileTransport
 from fast_agent.llm.provider.openai.codex_responses import (
     CODEX_RESPONSES_LITE_HEADER,
     CODEX_RESPONSES_LITE_WS_METADATA_KEY,
@@ -67,6 +70,9 @@
 from fast_agent.types import LlmStopReason
 
 if TYPE_CHECKING:
+    from collections.abc import AsyncIterator
+    from pathlib import Path
+
     from mcp import Tool
 
     from fast_agent.core.logging.logger import Logger
@@ -218,8 +224,9 @@ async def __aexit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
         del exc_type, exc, tb
 
 
-class _ReleaseTrackingConnectionManager:
+class _ReleaseTrackingConnectionManager(WebSocketConnectionManager):
     def __init__(self, connection: ManagedWebSocketConnection) -> None:
+        super().__init__()
         self.connection = connection
         self.release_keep_values: list[bool] = []
 
@@ -245,8 +252,9 @@ async def release(
         self.release_keep_values.append(keep)
 
 
-class _SequenceConnectionManager:
+class _SequenceConnectionManager(WebSocketConnectionManager):
     def __init__(self, connections: list[ManagedWebSocketConnection]) -> None:
+        super().__init__()
         self._connections = connections
         self.acquire_calls = 0
         self.release_keep_values: list[bool] = []
@@ -1666,8 +1674,9 @@ async def _process_stream(
         return await super()._process_stream(stream, model, capture_filename)
 
 
-class _PlannedAcquireConnectionManager:
+class _PlannedAcquireConnectionManager(WebSocketConnectionManager):
     def __init__(self, planned_connections: list[tuple[ManagedWebSocketConnection, bool]]) -> None:
+        super().__init__()
         self._planned_connections = planned_connections
         self.release_keep_values: list[bool] = []
 
@@ -2434,7 +2443,9 @@ async def test_websocket_streaming_timeout_releases_reusable_connection() -> Non
         )
 
     assert harness._release_manager.release_keep_values == [False]
-    timeout_data = harness._capturing_logger.error_data[-1]
+    timeout_data = harness._capturing_logger.error_data[
+        harness._capturing_logger.error_messages.index("Provider stream attempt failed")
+    ]
     assert timeout_data is not None
     assert timeout_data["transport"] == "websocket"
     assert timeout_data["stream_timing"]["events_received"] == 0
@@ -2916,3 +2927,251 @@ async def receive(self: _FakeWebSocket, timeout: float | None = None) -> SimpleN
         assert connections[0].websocket.closed and connections[0].session.closed
     finally:
         await llm.close()
+
+
+@pytest_asyncio.fixture
+async def websocket_failure_log(
+    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
+) -> AsyncIterator[Path]:
+    """Exercise the real logger -> bus -> filtered JSONL transport, not a log spy."""
+    path = tmp_path / "telemetry.jsonl"
+    bus = AsyncEventBus(FileTransport(path, event_filter=EventFilter(min_level="error")))
+    monkeypatch.setattr(AsyncEventBus, "_instance", bus)
+    await bus.start()
+    try:
+        yield path
+    finally:
+        # Logger schedules emit tasks; let them run before stopping the bus.
+        await asyncio.sleep(0)
+        await bus.stop()
+
+
+def _persisted_websocket_failures(path: Path) -> list[dict[str, Any]]:
+    rows = [json.loads(line) for line in path.read_text().splitlines()]
+    return [row["data"] for row in rows if row["message"] == "Responses websocket attempt failed"]
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("reused", [False, True])
+@pytest.mark.parametrize("known_age", [False, True])
+@pytest.mark.parametrize(
+    ("code", "partial", "repeat"),
+    [
+        ("invalid_request_error", False, False),
+        ("websocket_connection_limit_reached", False, False),
+        ("websocket_connection_limit_reached", False, True),
+        ("websocket_connection_limit_reached", True, False),
+        ("secret_code_abcdefghijklmnopqrstuvwxyz", False, False),
+        ("https://secret.invalid/?token=private\n" + "x" * 1000, False, False),
+    ],
+)
+async def test_websocket_failures_persist_safe_bounded_diagnostics(
+    monkeypatch: pytest.MonkeyPatch,
+    websocket_failure_log: Path,
+    reused: bool,
+    known_age: bool,
+    code: str,
+    partial: bool,
+    repeat: bool,
+) -> None:
+    llm, clock, connections = _mock_provider_websocket(monkeypatch)
+    llm._stream_attempt = (7, 2, 4)
+    if not known_age:
+        # Legacy/untracked sockets must report null, not invent age zero.
+        def mark_untracked(connection: ManagedWebSocketConnection, reuse_key: str | None) -> None:
+            connection.reuse_key = reuse_key
+

```

---

### Incident Patch 8: `9f62b4d6` (2026-09-26)
**Commit Message**: fix: rotate xAI Responses websockets before connection lifetime limit (#983)

**File**: `src/fast_agent/llm/provider/openai/responses.py` (modified, +5/-1)
```diff
@@ -245,7 +245,7 @@ def _initialize_response_state(self, web_search_override: Any) -> None:
         self._last_transport_used: ResponsesActiveTransport | None = None
         self._ws_connections = WebSocketConnectionManager(
             idle_timeout_seconds=55 * 60.0,
-            max_age_seconds=55 * 60.0,
+            max_age_seconds=self._websocket_max_age_seconds(),
         )
         self._ws_debug_inline = env_flag("FAST_AGENT_DEBUG_RESPONSES_WS")
         self._web_search_override: bool | None = (
@@ -524,6 +524,10 @@ def _build_websocket_headers(self) -> dict[str, str]:
     def _prepare_websocket_arguments(self, arguments: dict[str, Any]) -> None:
         """Apply provider-specific per-request websocket metadata."""
 
+    def _websocket_max_age_seconds(self) -> float:
+        """Rotate connections at safe request boundaries before the provider lifetime limit."""
+        return 55 * 60.0
+
     def _websocket_keepalive_options(self) -> ResponsesWebSocketKeepaliveOptions:
         return {}
 
```

**File**: `src/fast_agent/llm/provider/openai/xai_responses.py` (modified, +5/-0)
```diff
@@ -318,6 +318,11 @@ def _input_item_dedupe_key(self, item: dict[str, Any]) -> tuple[str, ...] | None
             return (*key, encrypted_content)
         return key
 
+    def _websocket_max_age_seconds(self) -> float:
+        # Leave headroom below xAI's 25-minute absolute connection lifetime.
+        # Active streams are never interrupted by age-based rotation.
+        return 20 * 60.0
+
     def _websocket_keepalive_options(self) -> ResponsesWebSocketKeepaliveOptions:
         # xAI currently doesn't reliably answer client-generated Ping frames.
         # Keep automatic Pong replies enabled while restoring the previous
```

**File**: `tests/unit/fast_agent/llm/providers/test_responses_websocket.py` (modified, +228/-0)
```diff
@@ -17,10 +17,12 @@
 from websockets.exceptions import ConnectionClosedError
 from websockets.frames import Close
 
+from fast_agent.config import Settings
 from fast_agent.constants import (
     FAST_AGENT_ERROR_CHANNEL,
     FAST_AGENT_RETRY,
 )
+from fast_agent.context import Context
 from fast_agent.llm.provider.openai.codex_responses import (
     CODEX_RESPONSES_LITE_HEADER,
     CODEX_RESPONSES_LITE_WS_METADATA_KEY,
@@ -51,6 +53,7 @@
 from fast_agent.llm.provider.openai.streaming_utils import (
     validate_incomplete_tool_entries,
 )
+from fast_agent.llm.provider.openai.xai_responses import XAIResponsesLLM
 from fast_agent.llm.provider.streaming_timeouts import (
     StreamIdleTimeoutError,
     StreamTiming,
@@ -2688,3 +2691,228 @@ async def test_connect_websocket_owns_supplied_client(
     manager.__aexit__.assert_awaited_once()
     assert str(client.websocket_base_url).startswith("wss://example.test")
     assert connect.call_args.kwargs["extra_query"] == {"q": "1"}
+
+
+@dataclass
+class _ProviderLifetimeClock:
+    now: float = 1.0
+
+    def __call__(self) -> float:
+        return self.now
+
+
+def _mock_provider_websocket(
+    monkeypatch: pytest.MonkeyPatch, *, xai: bool = True
+) -> tuple[ResponsesLLM, _ProviderLifetimeClock, list[ManagedWebSocketConnection]]:
+    llm = (
+        XAIResponsesLLM(context=Context(config=Settings()), model="grok-4.3")
+        if xai
+        else ResponsesLLM(
+            context=Context(config=Settings()), model="gpt-4.1", transport="websocket"
+        )
+    )
+    clock = _ProviderLifetimeClock()
+    # Keep the provider-created manager (and its configured lifetimes); replace only time/I/O.
+    monkeypatch.setattr(llm._ws_connections, "_clock", clock)
+    monkeypatch.setattr(llm, "_responses_client", _FakeResponsesClient)
+    monkeypatch.setattr(llm, "_build_websocket_headers", lambda: {})
+    connections: list[ManagedWebSocketConnection] = []
+
+    async def connect(
+        url: str, headers: dict[str, str], timeout_seconds: float | None
+    ) -> ManagedWebSocketConnection:
+        connection = ManagedWebSocketConnection(session=_FakeSession(), websocket=_FakeWebSocket())
+        connections.append(connection)
+        return connection
+
+    monkeypatch.setattr(llm, "_create_websocket_connection", connect)
+    return llm, clock, connections
+
+
+def _ws_event(event: dict[str, Any]) -> SimpleNamespace:
+    return SimpleNamespace(type=WSMsgType.TEXT, data=json.dumps(event))
+
+
+def _ws_completed() -> SimpleNamespace:
+    return _ws_event(
+        {
+            "type": "response.completed",
+            "response": {"id": "resp_test", "status": "completed", "output": []},
+        }
+    )
+
+
+def _ws_tool_history() -> list[dict[str, Any]]:
+    return [
+        *_ws_input_items("Read the file"),
+        {"type": "function_call", "call_id": "call_read", "name": "read_file", "arguments": "{}"},
+        {
+            "type": "function_call_output",
+            "call_id": "call_read",
+            "output": "retained file contents",
+        },
+    ]
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("xai", [True, False], ids=["xai-20-minutes", "openai-55-minutes"])
+async def test_provider_websocket_lifetime_rotation_preserves_history(
+    monkeypatch: pytest.MonkeyPatch, xai: bool
+) -> None:
+    llm, clock, connections = _mock_provider_websocket(monkeypatch, xai=xai)
+    history = _ws_tool_history()
+    model = "grok-4.3" if xai else "gpt-4.1"
+
+    async def receive(self: _FakeWebSocket, timeout: float | None = None) -> SimpleNamespace:
+        return _ws_completed()
+
+    monkeypatch.setattr(_FakeWebSocket, "receive", receive)
+    try:
+        for age, expected_connections in [
+            (0, 1),
+            (1199, 1),
+            (1200, 2 if xai else 1),
+            (2399, 2 if xai else 1),
+            (3299, 3 if xai else 1),
+            (3300, 3 if xai else 2),
+        ]:
+            clock.now = 1.0 + age
+            history.extend(_ws_input_items(f"Continue at {age}"))
+            _, _, normalized = await llm._responses_completion_ws(
+                input_items=history,
+                request_params=RequestParams(model=model),
+                tools=None,
+                model_name=model,
+            )
+            assert normalized == history
+            assert len(connections) == expected_connections
+            payload = json.loads(_sent_payloads(connections[-1])[-1])
+            if xai or age == 3300:
+                assert payload["input"] == history
+                assert "previous_response_id" not in payload
+            assert all(c.websocket.closed and c.session.closed for c in connections[:-1])
+    finally:
+        await llm.close()
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("partial", [None, "text", "tool"])
+@pytest.mark.parametrize("repeated", [False, True])
+async def test_xai_connection_limit_recovery_is_bounded_and_never_replays_partial_output(
+    monkeypatc
```

---

### Incident Patch 9: `108b059f` (2026-09-26)
**Commit Message**: fix: output polls bound poll folding; bound credential refresh lock and unblock exit on Copilot token timeout (#980)

* fix: treat output-bearing polls as fold boundaries instead of vetoes

* fix: bound credential refresh lock waits and keep Copilot token worker from blocking exit

**File**: `src/fast_agent/auth/credentials.py` (modified, +21/-3)
```diff
@@ -8,7 +8,7 @@
 from pathlib import Path
 from typing import Literal
 
-from filelock import FileLock
+from filelock import FileLock, Timeout
 from pydantic import BaseModel, Field
 
 from fast_agent.constants import FAST_AGENT_AUTH_FILE
@@ -17,6 +17,9 @@
 
 AUTH_KEYRING_SERVICE = "fast-agent-provider-auth"
 AuthSource = Literal["file", "keyring"]
+# Bounds waits behind another process's refresh so callers fail retryably
+# instead of blocking a worker thread indefinitely.
+CREDENTIAL_REFRESH_LOCK_TIMEOUT_SECONDS = 30.0
 
 
 class OAuthCredential(BaseModel):
@@ -120,12 +123,27 @@ def _file_lock(path: Path) -> FileLock:
 
 
 @contextmanager
-def credential_refresh_lock(provider: str):
+def credential_refresh_lock(
+    provider: str, *, timeout: float = CREDENTIAL_REFRESH_LOCK_TIMEOUT_SECONDS
+):
     configured_path = configured_auth_path()
     path = configured_path or default_auth_path()
     _ensure_parent_directory(path, private=configured_path is None)
-    with FileLock(path.parent / f".{provider}.refresh.lock"):
+    lock = FileLock(
+        path.parent / f".{provider}.refresh.lock",
+        timeout=timeout,
+    )
+    try:
+        lock.acquire()
+    except Timeout:
+        raise ProviderKeyError(
+            f"Timed out waiting for another fast-agent process to refresh {provider} credentials.",
+            "Retry the request.",
+        ) from None
+    try:
         yield
+    finally:
+        lock.release()
 
 
 def _read_file_credential(path: Path, provider: str) -> OAuthCredential | None:
```

**File**: `src/fast_agent/history/process_poll_folding.py` (modified, +3/-3)
```diff
@@ -829,7 +829,9 @@ def fold_managed_process_poll_history(
         exchange = _exchange(request, result, request_index=cursor - 1)
         if exchange is None or exchange.process_id != current.process_id:
             break
-        if _has_resource_observation(exchange):
+        # Warnings and output (or unknown output) bound the foldable suffix, so
+        # they stay in history while later quiet polls can still fold.
+        if _has_resource_observation(exchange) or _output_line_count(exchange) != 0:
             break
         reverse_exchanges.append(exchange)
         cursor -= 2
@@ -855,8 +857,6 @@ def fold_managed_process_poll_history(
     )
     if folded_polls < minimum_folded_polls:
         return None
-    if any(_output_line_count(exchange) != 0 for exchange in removed_exchanges):
-        return None
 
     first_removed = exchanges[0].request_index
     first_retained = exchanges[folded_polls].request_index
```

**File**: `src/fast_agent/llm/provider/copilot/broker.py` (modified, +8/-4)
```diff
@@ -15,6 +15,7 @@
     CopilotAuthenticationError,
     get_copilot_access_token,
 )
+from fast_agent.utils.async_utils import run_in_daemon_thread
 
 if TYPE_CHECKING:
     from collections.abc import Mapping
@@ -52,12 +53,15 @@ def __init__(self, settings: CopilotSettings) -> None:
         self._settings = settings
 
     async def _access_token(self, timeout: float) -> str:
-        # Resolve afresh in a worker. Timeout/cancellation stops waiting, not the
-        # worker: an in-flight refresh may still persist rotated tokens under the
-        # shared lock. HTTP has its own timeout; lock waits may outlive this call.
+        # Resolve afresh in a daemon worker. Timeout/cancellation stops waiting,
+        # not the worker: an in-flight refresh may still persist rotated tokens
+        # under the shared lock. HTTP and the lock wait are bounded; the keyring
+        # is not, so the worker must never block interpreter exit.
         try:
             async with asyncio.timeout(timeout):
-                token = await asyncio.to_thread(get_copilot_access_token)
+                token = await run_in_daemon_thread(
+                    get_copilot_access_token, name="fast-agent-copilot-token"
+                )
         except TimeoutError:
             raise ProviderKeyError("Copilot operation timed out.") from None
         if token is None:
```

**File**: `src/fast_agent/utils/async_utils.py` (modified, +33/-0)
```diff
@@ -1,7 +1,10 @@
 import asyncio
 import concurrent.futures
+import contextlib
+import contextvars
 import functools
 import sys
+import threading
 from collections.abc import Awaitable, Callable, Coroutine, Iterable
 from importlib.util import find_spec
 from typing import Any, ParamSpec, TypeVar
@@ -106,6 +109,36 @@ async def run_in_thread(func: Callable[P, T], *args: P.args, **kwargs: P.kwargs)
     return await to_thread.run_sync(func, *args)
 
 
+async def run_in_daemon_thread(func: Callable[[], T], *, name: str) -> T:
+    """Run a blocking callable in a daemon thread that never delays interpreter exit.
+
+    Unlike the default executor, cancellation or timeout abandons the thread, so
+    only use this for work that is safe to cut off at process exit.
+    """
+    loop = asyncio.get_running_loop()
+    future: asyncio.Future[T] = loop.create_future()
+    context = contextvars.copy_context()
+
+    def deliver(setter: Callable[[Any], None], value: object) -> None:
+        def settle() -> None:
+            if not future.done():
+                setter(value)
+
+        with contextlib.suppress(RuntimeError):  # loop closed after abandonment
+            loop.call_soon_threadsafe(settle)
+
+    def run() -> None:
+        try:
+            result = context.run(func)
+        except BaseException as exc:
+            deliver(future.set_exception, exc)
+        else:
+            deliver(future.set_result, result)
+
+    threading.Thread(target=run, name=name, daemon=True).start()
+    return await future
+
+
 def _run_in_new_loop(func: Callable[P, Awaitable[T]], *args: P.args, **kwargs: P.kwargs) -> T:
     def runner() -> T:
         loop = create_event_loop()
```

**File**: `tests/unit/fast_agent/auth/test_credentials.py` (modified, +16/-0)
```diff
@@ -2,11 +2,15 @@
 import stat
 from pathlib import Path
 
+import pytest
+
 from fast_agent.auth.credentials import (
     OAuthCredential,
+    credential_refresh_lock,
     load_oauth_credential,
     save_oauth_credential,
 )
+from fast_agent.core.exceptions import ProviderKeyError
 
 
 def test_auth_file_can_be_read_without_creating_a_sibling_lock(monkeypatch, tmp_path: Path) -> None:
@@ -70,3 +74,15 @@ def test_new_default_auth_directory_is_private(monkeypatch, tmp_path: Path) -> N
     auth_path = tmp_path / ".fast-agent" / "auth.json"
     assert stat.S_IMODE(auth_path.parent.stat().st_mode) == 0o700
     assert stat.S_IMODE(auth_path.stat().st_mode) == 0o600
+
+
+def test_refresh_lock_wait_is_bounded_and_retryable(monkeypatch, tmp_path: Path) -> None:
+    monkeypatch.setenv("FAST_AGENT_AUTH_FILE", str(tmp_path / "auth.json"))
+
+    with credential_refresh_lock("copilot"):
+        with pytest.raises(ProviderKeyError, match="another fast-agent process"):
+            with credential_refresh_lock("copilot", timeout=0.05):
+                pass
+
+    with credential_refresh_lock("copilot", timeout=0.05):
+        pass
```

**File**: `tests/unit/fast_agent/history/test_process_poll_folding.py` (modified, +41/-16)
```diff
@@ -487,35 +487,58 @@ def test_failed_process_audit_restores_original_poll_order() -> None:
     assert context_management["retained_step_ids"] == [6, 7]
 
 
-def test_running_process_with_output_is_not_folded() -> None:
+def test_output_poll_bounds_running_fold_and_is_preserved() -> None:
     history = _history_before_terminal(5)
+    output_pair = history[1:3]
     _update_result_metadata(history[2], output_line_count=1)
 
+    folded = fold_completed_process_poll_history(
+        history,
+        _poll_result(5, output_line_count=0),
+    )
+
+    assert folded is not None
+    assert folded.history[1:3] == output_pair
+    assert folded.metadata["polls_folded"] == 3
+    assert folded.metadata["polls_retained"] == 1
+
+
+def test_unknown_output_poll_bounds_fold() -> None:
+    history = _history_before_terminal(4)
+    results = history[4].tool_results
+    assert results is not None
+    meta = next(iter(results.values())).meta
+    assert meta is not None
+    del meta[FAST_AGENT_SHELL_PROCESS_METADATA]["output_line_count"]
+
     assert (
         fold_completed_process_poll_history(
             history,
-            _poll_result(5, output_line_count=0),
+            _poll_result(4, output_line_count=0),
         )
         is None
     )
 
 
-def test_terminal_process_with_output_in_earlier_poll_is_not_folded() -> None:
-    history = _history_before_terminal(5)
+def test_terminal_fold_keeps_earlier_output_poll() -> None:
+    history = _history_before_terminal(7)
     result = history[4].tool_results
     assert result is not None
     output_result = next(iter(result.values()))
     _update_result_metadata(history[4], output_line_count=3)
     output_result.content = [TextContent(type="text", text="compiler error details")]
+    output_pair = history[3:5]
 
-    assert (
-        fold_completed_process_poll_history(
-            history,
-            _poll_result(5, status="failed", output_line_count=0),
-        )
-        is None
+    folded = fold_completed_process_poll_history(
+        history,
+        _poll_result(7, status="failed", output_line_count=0),
     )
 
+    assert folded is not None
+    assert folded.history[3:5] == output_pair
+    assert folded.metadata["polls_folded"] == 3
+    assert folded.metadata["polls_retained"] == 2
+
 
 def test_quiet_running_process_folds_earlier_polls() -> None:
     history = _history_before_terminal(3)
@@ -633,15 +656,17 @@ def test_narration_does_not_weaken_zero_output_fold_guard() -> None:
     history = _history_before_terminal(4)
     history[1].content = [TextContent(type="text", text="Waiting.")]
     _update_result_metadata(history[2], output_line_count=1)
+    output_pair = history[1:3]
 
-    assert (
-        fold_completed_process_poll_history(
-            history,
-            _poll_result(4, status="completed", output_line_count=0),
-        )
-        is None
+    folded = fold_completed_process_poll_history(
+        history,
+        _poll_result(4, status="completed", output_line_count=0),
     )
 
+    assert folded is not None
+    assert folded.history[1:3] == output_pair
+    assert "assistant_updates" not in folded.metadata
+
 
 def test_parallel_narrated_poll_call_stops_suffix_collection() -> None:
     history = _history_before_terminal(4)
```

**File**: `tests/unit/fast_agent/utils/test_async_utils.py` (modified, +37/-0)
```diff
@@ -1,7 +1,9 @@
 """Tests for asyncio runtime helpers."""
 
 import asyncio
+import subprocess
 import sys
+import time
 from types import SimpleNamespace
 
 import pytest
@@ -98,3 +100,38 @@ async def wait_forever() -> None:
         )
 
     assert sibling_cancelled.is_set()
+
+
+@pytest.mark.asyncio
+async def test_run_in_daemon_thread_returns_results_and_raises_errors() -> None:
+    assert await async_utils.run_in_daemon_thread(lambda: 42, name="test") == 42
+
+    def fail() -> None:
+        raise ValueError("boom")
+
+    with pytest.raises(ValueError, match="boom"):
+        await async_utils.run_in_daemon_thread(fail, name="test")
+
+
+def test_abandoned_daemon_thread_does_not_block_interpreter_exit() -> None:
+    script = """
+import asyncio, time
+from fast_agent.utils.async_utils import run_in_daemon_thread
+
+async def main():
+    try:
+        async with asyncio.timeout(0.1):
+            await run_in_daemon_thread(lambda: time.sleep(60), name="stuck")
+    except TimeoutError:
+        print("timed out")
+
+asyncio.run(main())
+"""
+    started = time.monotonic()
+    result = subprocess.run(
+        [sys.executable, "-c", script], capture_output=True, text=True, timeout=30, check=False
+    )
+
+    assert result.returncode == 0, result.stderr
+    assert result.stdout.strip() == "timed out"
+    assert time.monotonic() - started < 15
```

---

### Incident Patch 10: `855f75cb` (2026-09-26)
**Commit Message**: fix: report output_line_count for durable polls, bump openai to 3.19.2 and release 0.10.35 (#979)

**File**: `pyproject.toml` (modified, +2/-2)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "fast-agent-mcp"
-version = "0.10.34"
+version = "0.10.35"
 description = "Code, Build and Evaluate agents - excellent Model and Skills/MCP/ACP/A2A Support"
 readme = "README.md"
 license = { file = "LICENSE" }
@@ -24,7 +24,7 @@ dependencies = [
     "rich==15.0.0",
     "typer==0.27.2",
     "anthropic[vertex]==1.8.0",
-    "openai[aiohttp,realtime]==3.18.0",
+    "openai[aiohttp,realtime]==3.19.2",
     "prompt-toolkit==3.0.53",
     "aiohttp==3.14.3",
     "opentelemetry-exporter-otlp-proto-http==1.44.0",
```

**File**: `src/fast_agent/tools/shell_runtime.py` (modified, +5/-1)
```diff
@@ -1104,6 +1104,9 @@ async def _poll_durable_process(
             else max(time.time() - snapshot.spec.created_at, 0.0)
         )
         output_observed = bool(snapshot.stdout_total_bytes or snapshot.stderr_total_bytes)
+        # The durable spool only accounts bytes, so the byte delta is the exact
+        # no-output signal; the preview line count is a lower bound otherwise.
+        output_line_count = max(len(output.splitlines()), 1) if output_bytes else 0
         lines = [output] if output else []
         lines.extend(
             [
@@ -1126,6 +1129,7 @@ async def _poll_durable_process(
                 "process_yield_reason": poll_yield_reason,
                 "process_elapsed_seconds": elapsed,
                 "os_process_id": snapshot.status.child_pid,
+                "output_line_count": output_line_count,
                 "output_bytes_since_last_poll": output_bytes,
                 "retained_output_bytes_since_last_poll": retained_output_bytes,
                 "dropped_output_bytes_since_last_poll": dropped_output_bytes,
@@ -1160,7 +1164,7 @@ async def _poll_durable_process(
         self._append_poll_output_activity(
             result,
             output_bytes=output_bytes,
-            output_lines=len(output.splitlines()),
+            output_lines=output_line_count,
             seconds_since_last_output=seconds_since_last_output,
             output_observed=output_observed,
         )
```

**File**: `tests/unit/fast_agent/tools/test_durable_processes.py` (modified, +2/-0)
```diff
@@ -249,7 +249,9 @@ async def test_durable_poll_consumes_dropped_output_accounting(tmp_path: Path) -
     assert first_metadata["retained_output_bytes_since_last_poll"] == 1024
     assert first_metadata["dropped_output_bytes_since_last_poll"] == 200000 - 1024
     assert first_metadata["output_truncated"] is True
+    assert first_metadata["output_line_count"] > 0
     assert second_metadata["output_bytes_since_last_poll"] == 0
+    assert second_metadata["output_line_count"] == 0
     assert second_metadata["retained_output_bytes_since_last_poll"] == 0
     assert second_metadata["dropped_output_bytes_since_last_poll"] == 0
 
```

**File**: `uv.lock` (modified, +5/-5)
```diff
@@ -911,7 +911,7 @@ requires-dist = [{ name = "fast-agent-mcp", editable = "." }]
 
 [[package]]
 name = "fast-agent-mcp"
-version = "0.10.34"
+version = "0.10.35"
 source = { editable = "." }
 dependencies = [
     { name = "a2a-sdk" },
@@ -1037,7 +1037,7 @@ requires-dist = [
     { name = "nvidia-cudnn-cu12", marker = "platform_machine == 'x86_64' and sys_platform == 'linux' and extra == 'privacy-gpu'", specifier = ">=9" },
     { name = "onnxruntime", marker = "extra == 'privacy'", specifier = ">=1.25" },
     { name = "onnxruntime-gpu", marker = "extra == 'privacy-gpu'", specifier = ">=1.25" },
-    { name = "openai", extras = ["aiohttp", "realtime"], specifier = "==3.18.0" },
+    { name = "openai", extras = ["aiohttp", "realtime"], specifier = "==3.19.2" },
     { name = "opentelemetry-exporter-otlp-proto-http", specifier = "==1.44.0" },
     { name = "opentelemetry-instrumentation-anthropic", marker = "python_full_version >= '3.10' and python_full_version < '4'", specifier = "==0.62.3" },
     { name = "opentelemetry-instrumentation-google-genai", specifier = "==1.1b1" },
@@ -2295,7 +2295,7 @@ wheels = [
 
 [[package]]
 name = "openai"
-version = "3.18.0"
+version = "3.19.2"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "anyio" },
@@ -2305,9 +2305,9 @@ dependencies = [
     { name = "sniffio" },
     { name = "typing-extensions" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/1b/7b/a960e698f7126f31113764d7b441d7fe73caada32b6e65c6ca42c5343265/openai-3.18.0.tar.gz", hash = "sha256:780946991bc825f110ddde12c8c84885dd012ae64143d56d494922b7bb879b78", size = 1711178, upload-time = "2026-09-22T18:26:31.81Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/7c/91/2d5722388a50cc86e162779df5fbfe0afa652a6e2d5c9ee616e081a82098/openai-3.19.2.tar.gz", hash = "sha256:de185f9834ad064d965ec42bd0766731cf66bceea16a7670294a835d207019e6", size = 1716953, upload-time = "2026-09-24T00:06:07.315Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/5e/c3/262e12d6dc544e215c3f4f76525b0fadf749f8092e525772b9f868d89ea9/openai-3.18.0-py3-none-any.whl", hash = "sha256:31f170b59865cbf35ceb15699bd33b190fa660eb2f36591c74a161afc67152e7", size = 2068693, upload-time = "2026-09-22T18:26:29.518Z" },
+    { url = "https://files.pythonhosted.org/packages/bd/20/4fe123e60525375878c67d1d8d051c9c5dec81cc56a579ba9304ca743303/openai-3.19.2-py3-none-any.whl", hash = "sha256:66247fcd07266e72536e90656dc27f3b0bb1e9d8696d4013fc55402c0b96a5c2", size = 2071459, upload-time = "2026-09-24T00:06:05.416Z" },
 ]
 
 [package.optional-dependencies]
```

---

### Incident Patch 11: `07c460ee` (2026-09-25)
**Commit Message**: fix: persist and refresh Copilot OAuth tokens (#978)

GitHub's device flow returns an 8h access token plus a ~181-day refresh
token. Persist the refresh token and rotate it under the shared credential
lock before expiry, so Copilot logins no longer lapse daily.

**File**: `src/fast_agent/llm/provider/copilot/broker.py` (modified, +6/-5)
```diff
@@ -52,8 +52,9 @@ def __init__(self, settings: CopilotSettings) -> None:
         self._settings = settings
 
     async def _access_token(self, timeout: float) -> str:
-        # Load validated credentials afresh on every request. Only this read runs
-        # in a worker, so cancellation cannot leave authentication state mutations.
+        # Resolve afresh in a worker. Timeout/cancellation stops waiting, not the
+        # worker: an in-flight refresh may still persist rotated tokens under the
+        # shared lock. HTTP has its own timeout; lock waits may outlive this call.
         try:
             async with asyncio.timeout(timeout):
                 token = await asyncio.to_thread(get_copilot_access_token)
@@ -75,15 +76,15 @@ def _headers(self, token: str) -> dict[str, str]:
         }
 
     async def has_credentials(self, timeout: float | None = None) -> bool:
-        """Check local presence, expiry, and format without remote entitlement checks or login."""
+        """Resolve credentials (refreshing if needed), without entitlement checks or login."""
         limit = self._settings.runtime_timeout_seconds
         if timeout is not None:
             limit = min(timeout, limit)
         try:
             await self._access_token(limit)
         except CopilotAuthenticationError:
-            # Missing (raised above) and expired (raised by the loader) credentials
-            # both mean "not signed in". Invalid overrides/stores propagate.
+            # Missing, expired, or failed refresh means "not signed in".
+            # Invalid overrides/stores propagate.
             return False
         return True
 
```

**File**: `src/fast_agent/llm/provider/copilot/oauth.py` (modified, +62/-1)
```diff
@@ -16,6 +16,7 @@
 from fast_agent.auth.credentials import (
     OAuthCredential,
     StoredCredential,
+    credential_refresh_lock,
     delete_oauth_credential,
     load_oauth_credential,
     save_oauth_credential,
@@ -31,6 +32,7 @@
 _DEVICE_URL: Final = "https://github.com/login/device/code"
 _TOKEN_URL: Final = "https://github.com/login/oauth/access_token"
 _VERIFICATION_URI: Final = "https://github.com/login/device"
+_REFRESH_SKEW_SECONDS: Final = 60
 _LOGIN_HINT: Final = "Run `fast-agent auth provider login copilot`."
 
 _PositiveSeconds = Annotated[float, Field(gt=0, allow_inf_nan=False)]
@@ -68,6 +70,7 @@ class _DeviceResponse(_OAuthResponse):
 class _TokenResponse(_OAuthResponse):
     error: None = None
     access_token: Annotated[str, Field(min_length=1, pattern=r"^[!-~]+$")] = Field(repr=False)
+    refresh_token: _NonemptyString | None = Field(default=None, repr=False)
     token_type: Literal["bearer", "Bearer"]
     scope: str | None = None
     expires_in: _PositiveSeconds | None = None
@@ -191,6 +194,7 @@ async def poll_copilot_device_code(
                     raise _http_error(response)
                 return _CopilotCredential(
                     access_token=payload.access_token,
+                    refresh_token=payload.refresh_token,
                     token_type=payload.token_type,
                     scope=payload.scope,
                     expires_at=(
@@ -265,15 +269,72 @@ def _load_validated_credential() -> StoredCredential | None:
     return stored
 
 
+def _needs_refresh(credential: OAuthCredential) -> bool:
+    return (
+        credential.refresh_token is not None
+        and credential.expires_at is not None
+        and time.time() + _REFRESH_SKEW_SECONDS >= credential.expires_at
+    )
+
+
+def _refresh_credential(credential: OAuthCredential) -> OAuthCredential:
+    try:
+        with httpx.Client(timeout=30, trust_env=False, follow_redirects=False) as client:
+            response = client.post(
+                _TOKEN_URL,
+                data={
+                    "client_id": COPILOT_CLIENT_ID,
+                    "grant_type": "refresh_token",
+                    "refresh_token": credential.refresh_token,
+                },
+                headers={"Accept": "application/json"},
+                follow_redirects=False,
+            )
+    except httpx.RequestError:
+        raise ProviderKeyError(
+            "Unable to contact GitHub to refresh Copilot OAuth token.", "Retry the request."
+        ) from None
+    if not response.is_success:
+        raise ProviderKeyError(
+            f"Copilot OAuth refresh failed (HTTP {response.status_code}).", "Retry the request."
+        )
+    try:
+        payload = _TOKEN_RESPONSE.validate_json(response.content)
+    except ValidationError:
+        raise ProviderKeyError("Invalid GitHub refresh response.", "Retry the request.") from None
+    if isinstance(payload, _ErrorResponse):
+        if payload.error in {"bad_refresh_token", "invalid_grant", "expired_token"}:
+            raise CopilotAuthenticationError("GitHub rejected Copilot OAuth refresh.", _LOGIN_HINT)
+        raise ProviderKeyError(
+            "GitHub could not refresh Copilot OAuth token.", "Retry the request."
+        )
+    return _CopilotCredential(
+        access_token=payload.access_token,
+        refresh_token=payload.refresh_token or credential.refresh_token,
+        token_type=payload.token_type,
+        scope=payload.scope if payload.scope is not None else credential.scope,
+        expires_at=time.time() + payload.expires_in if payload.expires_in is not None else None,
+    )
+
+
 def get_copilot_credential() -> OAuthCredential | None:
-    """Resolve validated credentials, preferring the environment and rejecting expiry."""
+    """Resolve credentials, refreshing expiring stored tokens under the shared lock."""
     environment = _environment_credential()
     if environment is not None:
         return environment
     stored = _load_validated_credential()
     if stored is None:
         return None
     credential = stored.credential
+    if _needs_refresh(credential):
+        with _store_errors(), credential_refresh_lock(COPILOT_PROVIDER_ID):
+            stored = _load_validated_credential()
+            if stored is None:
+                return None
+            credential = stored.credential
+            if _needs_refresh(credential):
+                credential = _refresh_credential(credential)
+                save_oauth_credential(COPILOT_PROVIDER_ID, credential, source=stored.source)
     if credential.expires_at is not None and time.time() >= credential.expires_at:
         raise CopilotAuthenticationError("Copilot OAuth token expired.", _LOGIN_HINT)
     return credential
```

**File**: `src/fast_agent/ui/model_picker.py` (modified, +1/-1)
```diff
@@ -736,7 +736,7 @@ def _on_copilot_preflight_done(self, task: asyncio.Task[bool]) -> None:
 
 
 async def _preflight_copilot_auth(config_payload: dict[str, object]) -> bool:
-    """Check local Copilot credentials only; no network, login, or inference."""
+    """Resolve Copilot credentials, refreshing if needed; no login or inference."""
     from fast_agent.config import CopilotSettings
     from fast_agent.llm.provider.copilot.broker import CopilotBroker
 
```

**File**: `tests/unit/llm/test_copilot_credentials.py` (modified, +59/-0)
```diff
@@ -335,3 +335,62 @@ async def test_messages_adapter_uses_broker_auth_and_disables_eager_tool_streami
         assert tools == [{"name": "local", "input_schema": {"type": "object"}}]
     finally:
         await client.close()
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("stop", ["timeout", "cancel"])
+async def test_refresh_can_finish_after_broker_stops_waiting(
+    monkeypatch: pytest.MonkeyPatch, broker: CopilotBroker, stop: str
+) -> None:
+    monkeypatch.delenv("COPILOT_GITHUB_TOKEN")
+    save_oauth_credential(
+        "copilot",
+        OAuthCredential(access_token=TOKEN, refresh_token="synthetic-refresh", expires_at=1),
+    )
+    loop = asyncio.get_running_loop()
+    started = asyncio.Event()
+    saved = asyncio.Event()
+    release = threading.Event()
+
+    def post(*args: object, **kwargs: object) -> httpx.Response:
+        loop.call_soon_threadsafe(started.set)
+        assert release.wait(5)
+        return httpx.Response(
+            200,
+            json={
+                "access_token": "refreshed-token",
+                "refresh_token": "rotated-token",
+                "token_type": "bearer",
+                "expires_in": 3600,
+            },
+        )
+
+    client = Mock()
+    client.__enter__ = Mock(return_value=client)
+    client.__exit__ = Mock(return_value=False)
+    client.post.side_effect = post
+    monkeypatch.setattr(oauth.httpx, "Client", Mock(return_value=client))
+
+    def save(provider: str, credential: OAuthCredential, *, source: str) -> None:
+        assert source == "file"
+        save_oauth_credential(provider, credential, source="file")
+        loop.call_soon_threadsafe(saved.set)
+
+    monkeypatch.setattr(oauth, "save_oauth_credential", save)
+    task = asyncio.create_task(broker.has_credentials(timeout=0.1 if stop == "timeout" else 30))
+    try:
+        await asyncio.wait_for(started.wait(), timeout=2)
+        if stop == "cancel":
+            task.cancel()
+            with pytest.raises(asyncio.CancelledError):
+                await task
+        else:
+            with pytest.raises(ProviderKeyError, match="timed out"):
+                await task
+        assert not saved.is_set()
+    finally:
+        release.set()
+        await asyncio.wait_for(saved.wait(), timeout=2)
+        await asyncio.gather(task, return_exceptions=True)
+    assert oauth.get_copilot_access_token() == "refreshed-token"
+    client.post.assert_called_once()
```

**File**: `tests/unit/llm/test_copilot_oauth.py` (modified, +194/-2)
```diff
@@ -351,13 +351,16 @@ async def test_success_displays_only_user_instructions_and_saves(
 ) -> None:
     output = Mock()
     monkeypatch.setattr(oauth.console.console, "print", output)
-    github.responses.extend([device_response(), token_response()])
+    github.responses.extend(
+        [device_response(), token_response(refresh_token="login-refresh-secret")]
+    )
     credential = await oauth.login_copilot_oauth_async()
     assert isinstance(credential, OAuthCredential)
     assert oauth.get_copilot_access_token() == TOKEN
     stored = credentials.load_oauth_credential("copilot")
     assert stored is not None
-    assert stored.credential.refresh_token is None
+    assert stored.credential.refresh_token == "login-refresh-secret"
+    assert "login-refresh-secret" not in repr(credential)
     rendered = str(output.call_args_list)
     assert "Waiting for GitHub approval. Ctrl+C to cancel." in rendered
     assert USER_CODE in rendered
@@ -664,3 +667,192 @@ async def test_device_token_must_be_printable_nonspace_ascii(
         await oauth.login_copilot_oauth_async()
     assert_safe(error.value, *([token] if token.strip() else []))
     assert not auth_file.exists()
+
+
+@pytest.fixture
+def refresh_http(monkeypatch: pytest.MonkeyPatch) -> list[httpx.Request]:
+    requests: list[httpx.Request] = []
+    client_type = httpx.Client
+
+    def respond(request: httpx.Request) -> httpx.Response:
+        requests.append(request)
+        return token_response(refresh_token="rotated-secret", expires_in=3600)
+
+    def factory(*, timeout: float, trust_env: bool, follow_redirects: bool) -> httpx.Client:
+        assert timeout == 30
+        assert trust_env is False
+        assert follow_redirects is False
+        return client_type(transport=httpx.MockTransport(respond), timeout=timeout)
+
+    monkeypatch.setattr(oauth.httpx, "Client", factory)
+    return requests
+
+
+@pytest.mark.parametrize("remaining", [-1, 30])
+def test_refresh_rotates_and_persists(
+    refresh_http: list[httpx.Request], clock: Clock, remaining: int
+):
+    credentials.save_oauth_credential(
+        "copilot",
+        OAuthCredential(
+            access_token="old-secret",
+            refresh_token="refresh-secret",
+            expires_at=clock.time() + remaining,
+        ),
+    )
+    credential = oauth.get_copilot_credential()
+    assert credential is not None
+    assert credential.refresh_token == "rotated-secret"
+    assert credential.expires_at == clock.time() + 3600
+    assert "rotated-secret" not in repr(credential)
+    stored = credentials.load_oauth_credential("copilot")
+    assert stored is not None
+    assert stored.credential.model_dump() == credential.model_dump()
+    assert oauth.get_copilot_access_token() == TOKEN
+    assert len(refresh_http) == 1
+    request = refresh_http[0]
+    assert str(request.url) == "https://github.com/login/oauth/access_token"
+    assert parse_qs(request.content.decode()) == {
+        "client_id": [oauth.COPILOT_CLIENT_ID],
+        "grant_type": ["refresh_token"],
+        "refresh_token": ["refresh-secret"],
+    }
+
+
+@pytest.mark.parametrize(
+    "response",
+    [
+        httpx.Response(400, text=TOKEN),
+        httpx.Response(302, headers={"Location": "https://example.invalid/"}),
+        httpx.Response(200, json={"error": TOKEN, "error_description": TOKEN}),
+        httpx.Response(200, text=TOKEN),
+        token_response(refresh_token=""),
+        httpx.ReadTimeout(TOKEN),
+    ],
+)
+def test_refresh_errors_preserve_store(
+    monkeypatch: pytest.MonkeyPatch, auth_file: Path, response: httpx.Response | httpx.RequestError
+):
+    credentials.save_oauth_credential(
+        "copilot", OAuthCredential(access_token=TOKEN, refresh_token="refresh-secret", expires_at=1)
+    )
+    original = auth_file.read_bytes()
+    client_type = httpx.Client
+
+    def respond(request: httpx.Request) -> httpx.Response:
+        if isinstance(response, httpx.RequestError):
+            raise response
+        return response
+
+    monkeypatch.setattr(
+        oauth.httpx,
+        "Client",
+        lambda **kwargs: client_type(transport=httpx.MockTransport(respond), **kwargs),
+    )
+    with pytest.raises(ProviderKeyError) as error:
+        oauth.get_copilot_credential()
+    assert not isinstance(error.value, oauth.CopilotAuthenticationError)
+    assert_safe(error.value, "refresh-secret")
+    assert auth_file.read_bytes() == original
+
+
+@pytest.mark.parametrize("source", ["file", "keyring"])
+def test_refresh_retains_token_and_source(
+    monkeypatch: pytest.MonkeyPatch, source: credentials.AuthSource
+) -> None:
+
+    old = OAuthCredential(access_token=TOKEN, refresh_token="refresh-secret", expires_at=1)
+    monkeypatch.setattr(
+        oauth,
+        "load_oauth_credential",
+        Mock(return_value=credentials.StoredCredential(old, source)),
+    )
+    save = Mock()
+    monkeypatch.setattr(oauth, "save_oauth_credential", save)
+    client_type
```

---

### Incident Patch 12: `539ef48f` (2026-09-25)
**Commit Message**: fix(async): propagate child cancellation promptly (#976)

**File**: `src/fast_agent/utils/async_utils.py` (modified, +26/-4)
```diff
@@ -129,8 +129,30 @@ async def gather_with_cancel(aws: Iterable[Awaitable[T]]) -> list[T | BaseExcept
     asyncio.CancelledError is re-raised so cancellation never gets swallowed.
     """
 
-    results = await asyncio.gather(*aws, return_exceptions=True)
-    for item in results:
-        if isinstance(item, asyncio.CancelledError):
-            raise item
+    tasks = [asyncio.ensure_future(aw) for aw in aws]
+    pending = set(tasks)
+    try:
+        while pending:
+            done, pending = await asyncio.wait(
+                pending,
+                return_when=asyncio.FIRST_COMPLETED,
+            )
+            cancelled = next((task for task in done if task.cancelled()), None)
+            if cancelled is not None:
+                for task in pending:
+                    task.cancel()
+                await asyncio.gather(*pending, return_exceptions=True)
+                cancelled.result()
+    except asyncio.CancelledError:
+        for task in pending:
+            task.cancel()
+        await asyncio.gather(*pending, return_exceptions=True)
+        raise
+
+    results: list[T | BaseException] = []
+    for task in tasks:
+        try:
+            results.append(task.result())
+        except BaseException as exc:
+            results.append(exc)
     return results
```

**File**: `tests/unit/fast_agent/utils/test_async_utils.py` (modified, +43/-0)
```diff
@@ -1,8 +1,11 @@
 """Tests for asyncio runtime helpers."""
 
+import asyncio
 import sys
 from types import SimpleNamespace
 
+import pytest
+
 from fast_agent.utils import async_utils
 
 
@@ -55,3 +58,43 @@ def broken_new_event_loop():
         async_utils._UVLOOP_REQUESTED = None
         async_utils._UVLOOP_CONFIGURED = None
         sys.modules.pop("uvloop", None)
+
+
+@pytest.mark.asyncio
+async def test_gather_with_cancel_preserves_results_and_exceptions() -> None:
+    async def return_value() -> int:
+        return 7
+
+    async def fail() -> int:
+        raise RuntimeError("failed")
+
+    results = await async_utils.gather_with_cancel([return_value(), fail()])
+
+    assert results[0] == 7
+    assert isinstance(results[1], RuntimeError)
+
+
+@pytest.mark.asyncio
+async def test_gather_with_cancel_propagates_child_cancellation_and_cancels_sibling() -> None:
+    sibling_started = asyncio.Event()
+    sibling_cancelled = asyncio.Event()
+
+    async def cancel() -> None:
+        await sibling_started.wait()
+        raise asyncio.CancelledError("child cancelled")
+
+    async def wait_forever() -> None:
+        sibling_started.set()
+        try:
+            await asyncio.Event().wait()
+        except asyncio.CancelledError:
+            sibling_cancelled.set()
+            raise
+
+    with pytest.raises(asyncio.CancelledError, match="child cancelled"):
+        await asyncio.wait_for(
+            async_utils.gather_with_cancel([cancel(), wait_forever()]),
+            timeout=1,
+        )
+
+    assert sibling_cancelled.is_set()
```

---

### Incident Patch 13: `61797d1e` (2026-09-23)
**Commit Message**: CI: stop retrying config errors, parallelise unit tests, fix order-dependent tests (#971)

- Treat ModelConfigError as fatal in the provider retry loop, and raise it
  (instead of ValueError) for invalid Responses cache/extra_body overrides.
  Deterministic request validation was being retried with 10s+20s backoff:
  8 integration cases took 30s each (240s of the 300s 'other' job).
- Add pytest-xdist and run unit tests with -n auto; add --durations to CI.
- Reset the shared console stream after each unit test (a runtime test left
  it routed to stderr, breaking later capsys assertions).
- Pin COLUMNS for CLI tests asserting long tmp paths in Rich output.
- Replace a 32-case process-spawning cartesian matrix with a pairwise set of 8.

**File**: `.github/workflows/checks.yml` (modified, +2/-2)
```diff
@@ -83,7 +83,7 @@ jobs:
           uv sync --locked --group dev
 
       - name: Run unit tests
-        run: uv run pytest tests/unit -v
+        run: uv run pytest tests/unit -n auto -q -ra --durations=20
 
   integration-test:
     name: Integration (${{ matrix.name }})
@@ -121,7 +121,7 @@ jobs:
           uv sync --locked --group dev
 
       - name: Run integration tests
-        run: uv run pytest -m integration -v ${{ matrix.path }} ${{ matrix.args }}
+        run: uv run pytest -m integration -v --durations=20 ${{ matrix.path }} ${{ matrix.args }}
 
   test:
     name: test
```

**File**: `pyproject.toml` (modified, +1/-0)
```diff
@@ -154,6 +154,7 @@ dev = [
     "pytest-cov>=6.1.1",
     "ipdb>=0.13.13",
     "zensical==0.0.62",
+    "pytest-xdist>=3.8",
 ]
 
 [project.scripts]
```

**File**: `src/fast_agent/llm/fastagent_llm.py` (modified, +9/-2)
```diff
@@ -27,7 +27,12 @@
     CONTROL_MESSAGE_SAVE_HISTORY,
 )
 from fast_agent.context_dependent import ContextDependent
-from fast_agent.core.exceptions import AgentConfigError, ProviderKeyError, ServerConfigError
+from fast_agent.core.exceptions import (
+    AgentConfigError,
+    ModelConfigError,
+    ProviderKeyError,
+    ServerConfigError,
+)
 from fast_agent.core.logging.logger import get_logger
 from fast_agent.event_progress import ProgressAction
 from fast_agent.interfaces import (
@@ -801,7 +806,9 @@ def _append_retry_telemetry(result: Any, retries: list[ProviderRetry]) -> None:
 
     @staticmethod
     def _is_fatal_retry_error(error: Exception) -> bool:
-        if isinstance(error, (KeyboardInterrupt, AgentConfigError, ServerConfigError)):
+        if isinstance(
+            error, (KeyboardInterrupt, AgentConfigError, ModelConfigError, ServerConfigError)
+        ):
             return True
 
         # Deferred: this module must stay importable without the OpenAI/WebSocket SDKs.
```

**File**: `src/fast_agent/llm/provider/openai/responses_cache.py` (modified, +16/-11)
```diff
@@ -11,6 +11,7 @@
 from pydantic import BaseModel
 
 from fast_agent.constants import FAST_AGENT_TOOL_MEDIA_MESSAGE
+from fast_agent.core.exceptions import ModelConfigError
 from fast_agent.llm.request_params import RequestParams
 from fast_agent.mcp.prompt_message_extended import PromptMessageExtended
 
@@ -47,29 +48,29 @@ def prepare_cached_request(
     metadata = dict(params.metadata or {})
     model = metadata.get("model") or params.model
     if not isinstance(model, str):
-        raise ValueError("Responses cache state requires a model")
+        raise ModelConfigError("Responses cache state requires a model")
     extra = metadata.get("extra_body")
     if (
         isinstance(extra, dict)
         and "model" in extra
         and (model == "gpt-6-astra" or extra["model"] == "gpt-6-astra")
     ):
-        raise ValueError("Set model directly in metadata, not extra_body")
+        raise ModelConfigError("Set model directly in metadata, not extra_body")
     effort = None
     if model == "gpt-6-astra":
         validate_cache_overrides(metadata)
         reasoning = metadata.get("reasoning", {})
         if not isinstance(reasoning, dict):
-            raise ValueError("Astra reasoning must be an object")
+            raise ModelConfigError("Astra reasoning must be an object")
         effort = reasoning.get("effort", default_effort)
         if effort not in ("low", "medium", "high", "xhigh", "max"):
-            raise ValueError("Astra reasoning effort must be low, medium, high, xhigh or max")
+            raise ModelConfigError("Astra reasoning effort must be low, medium, high, xhigh or max")
     items, state, baseline = prepare_cached_input(
         messages, model=model, key=key, effort=effort, convert=convert
     )
     metadata.setdefault("prompt_cache_key", state.key)
     if not isinstance(metadata["prompt_cache_key"], str):
-        raise ValueError("Responses prompt_cache_key must be a string")
+        raise ModelConfigError("Responses prompt_cache_key must be a string")
     state.key = metadata["prompt_cache_key"]
     if baseline is not None:
         metadata["reasoning"] = {
@@ -144,19 +145,23 @@ def validate_cache_overrides(metadata: dict[str, Any]) -> None:
     """Reject overrides that bypass the managed history or rewrite its prefix."""
     for source in (metadata, metadata.get("extra_body", {})):
         if not isinstance(source, dict):
-            raise ValueError("Responses extra_body must be an object")
+            raise ModelConfigError("Responses extra_body must be an object")
         if any(name in source for name in ("input", "previous_response_id")):
-            raise ValueError("Managed Astra effort updates require fast-agent message history")
+            raise ModelConfigError(
+                "Managed Astra effort updates require fast-agent message history"
+            )
         if source.get("truncation") not in (None, "disabled") or source.get("context_management"):
-            raise ValueError("Astra effort updates cannot use automatic truncation or compaction")
+            raise ModelConfigError(
+                "Astra effort updates cannot use automatic truncation or compaction"
+            )
         reasoning = source.get("reasoning", {})
         if isinstance(reasoning, dict) and reasoning.get("mode") not in (None, "standard"):
-            raise ValueError("Astra effort updates require standard single-agent mode")
+            raise ModelConfigError("Astra effort updates require standard single-agent mode")
         multi_agent = source.get("multi_agent", {})
         if not isinstance(multi_agent, dict) or multi_agent.get("enabled"):
-            raise ValueError("Astra effort updates require standard single-agent mode")
+            raise ModelConfigError("Astra effort updates require standard single-agent mode")
     extra = metadata.get("extra_body", {})
     if any(name in extra for name in ("reasoning", "prompt_cache_key", "model")):
-        raise ValueError(
+        raise ModelConfigError(
             "Set reasoning, prompt_cache_key and model directly in metadata, not extra_body"
         )
```

**File**: `tests/integration/llm/test_responses_cache_transport.py` (modified, +2/-1)
```diff
@@ -17,6 +17,7 @@
 from fast_agent.config import CodexResponsesSettings, OpenAISettings, Settings
 from fast_agent.constants import FAST_AGENT_PENDING_MEDIA_ATTACHMENTS
 from fast_agent.context import Context
+from fast_agent.core.exceptions import ModelConfigError
 from fast_agent.interfaces import AgentProtocol
 from fast_agent.llm.provider.openai.codex_responses import CodexResponsesLLM
 from fast_agent.llm.provider.openai.responses import ResponsesLLM
@@ -323,7 +324,7 @@ async def test_extra_body_cannot_cross_astra_boundary(
     url, requests = simulator
     agent, llm = await make_agent(url, codex=codex, transport=transport, model=model)
     try:
-        with pytest.raises(ValueError, match="directly in metadata"):
+        with pytest.raises(ModelConfigError, match="directly in metadata"):
             await agent.generate(
                 [Prompt.user("Work")],
                 RequestParams(metadata={"extra_body": {"model": override, "truncation": "auto"}}),
```

**File**: `tests/unit/conftest.py` (modified, +12/-0)
```diff
@@ -2,12 +2,17 @@
 
 import asyncio
 import os
+from typing import TYPE_CHECKING
 
 import pytest
 
 import fast_agent.config as config_module
 from fast_agent.constants import FAST_AGENT_RUNTIME_HOME
 from fast_agent.session import reset_session_manager
+from fast_agent.ui.console import configure_console_stream
+
+if TYPE_CHECKING:
+    from collections.abc import Iterator
 
 
 @pytest.fixture(autouse=True)
@@ -47,6 +52,13 @@ async def cancel_process_task(
     monkeypatch.setattr(AsyncEventBus, "_cancel_process_task", cancel_process_task)
 
 
+@pytest.fixture(autouse=True)
+def reset_shared_console_stream() -> Iterator[None]:
+    """Runtime paths (e.g. stdio servers) reroute the shared console; don't leak it."""
+    yield
+    configure_console_stream("stdout")
+
+
 @pytest.fixture(autouse=True)
 def isolate_home(tmp_path):
     """Ensure unit tests never write sessions/skills into a real home.
```

**File**: `tests/unit/fast_agent/commands/test_go_command.py` (modified, +2/-0)
```diff
@@ -461,6 +461,8 @@ def test_go_workspace_rejects_missing_directory(tmp_path: Path) -> None:
             "--message",
             "summarize",
         ],
+        # Keep long tmp paths (e.g. xdist's popen-gwN) on one line in the error panel.
+        env={"COLUMNS": "400"},
     )
 
     assert result.exit_code == 2
```

**File**: `tests/unit/fast_agent/commands/test_skills_command.py` (modified, +5/-0)
```diff
@@ -1,6 +1,7 @@
 from __future__ import annotations
 
 import json
+import os
 import subprocess
 from pathlib import Path
 
@@ -242,6 +243,8 @@ def test_top_level_env_flag_routes_to_skills_subcommand(tmp_path: Path) -> None:
         capture_output=True,
         text=True,
         cwd=_repo_root(),
+        # Long tmp paths (e.g. xdist's popen-gwN) must not be truncated by Rich tables.
+        env={**os.environ, "COLUMNS": "400"},
     )
 
     assert result.returncode == 0, result.stderr
@@ -275,6 +278,8 @@ def test_local_skills_env_flag_routes_to_skills_subcommand(tmp_path: Path) -> No
         capture_output=True,
         text=True,
         cwd=_repo_root(),
+        # Long tmp paths (e.g. xdist's popen-gwN) must not be truncated by Rich tables.
+        env={**os.environ, "COLUMNS": "400"},
     )
 
     assert result.returncode == 0, result.stderr
```

---

### Incident Patch 14: `0cb9cd9b` (2026-09-22)
**Commit Message**: Release 0.10.31: Anthropic streaming timeout fix, Opus 5.5, GPT-6 Sol/Luna (#969)

* Release 0.10.31: fix Anthropic streaming timeouts and add Opus 5.5

* Restore saved shell access when resuming local sessions

* Upgrade OpenAI and Anthropic SDKs and harden resume notice

* Add GPT-6 Sol and Luna; make Codex Responses Lite opt-in

- Add gpt-6-sol and gpt-6-luna for the Responses, Codex OAuth and Copilot
  routes. They share Astra's contract (272k default context with
  route-specific long_context windows, 128k output, write_text_file editing,
  fast tier) and accept reasoning none..max (default medium), verified live
  on Codex OAuth, Copilot and the Copilot /models catalog.
- Repoint `sol`/`luna` Codex aliases to GPT-6 (as Codex migrates users);
  keep the GPT-5.6 models as `sol56`/`luna56`. Add gpt-6-sol/gpt-6-luna and
  gpt6sol/gpt6luna Responses aliases and picker entries.
- Codex OAuth now uses the standard Responses contract by default. The
  backend accepts it for GPT-6 and GPT-5.6-Luna, keeping parallel tool calls
  and hosted web search. Opt in to Codex's internal Responses Lite contract
  per model string with `?lite=on`; it is rejected for unsupported models and
  non-c

**File**: `docs/docs/_generated/current_models_codexresponses.md` (modified, +4/-2)
```diff
@@ -1,9 +1,11 @@
 | Model string or alias | Resolves to / equivalent | Notes |
 | --- | --- | --- |
 | `astra` | `codexresponses.gpt-6-astra?reasoning=medium` | — |
-| `sol` | `codexresponses.gpt-5.6-sol?reasoning=high` | — |
+| `sol` | `codexresponses.gpt-6-sol?reasoning=medium` | — |
+| `luna` | `codexresponses.gpt-6-luna?reasoning=medium` | Fast |
+| `sol56` | `codexresponses.gpt-5.6-sol?reasoning=high` | — |
 | `terra` | `codexresponses.gpt-5.6-terra?reasoning=high` | — |
-| `luna` | `codexresponses.gpt-5.6-luna?reasoning=medium` | — |
+| `luna56` | `codexresponses.gpt-5.6-luna?reasoning=medium` | — |
 | `codexplan` | `codexresponses.gpt-6-astra?reasoning=medium` | — |
 | `codexplan55` | `codexresponses.gpt-5.5?reasoning=medium` | — |
 | `codexplan54` | `codexresponses.gpt-5.4?reasoning=high` | — |
```

**File**: `docs/docs/_generated/current_models_responses.md` (modified, +2/-0)
```diff
@@ -1,6 +1,8 @@
 | Model string or alias | Resolves to / equivalent | Notes |
 | --- | --- | --- |
 | `gpt-6-astra` | `responses.gpt-6-astra?reasoning=medium` | — |
+| `gpt-6-sol` | `responses.gpt-6-sol?reasoning=medium` | — |
+| `gpt-6-luna` | `responses.gpt-6-luna?reasoning=medium` | Fast |
 | `gpt-5.6-sol` | `responses.gpt-5.6-sol?reasoning=medium` | — |
 | `gpt-5.6-terra` | `responses.gpt-5.6-terra?reasoning=medium` | Fast |
 | `gpt-5.6-luna` | `responses.gpt-5.6-luna?reasoning=medium` | Fast |
```

**File**: `docs/docs/_generated/model_aliases_anthropic.md` (modified, +4/-3)
```diff
@@ -5,14 +5,15 @@
 | `claude-3-5-haiku-latest` | `claude-3-5-haiku-latest` | `fable5` | `claude-fable-5` |
 | `claude-fable-5` | `claude-fable-5` | `haiku` | `claude-haiku-4-5` |
 | `claude-fable-5-1` | `claude-fable-5-1` | `haiku45` | `claude-haiku-4-5` |
-| `claude-haiku-4-5` | `claude-haiku-4-5` | `opus` | `claude-opus-5` |
+| `claude-haiku-4-5` | `claude-haiku-4-5` | `opus` | `claude-opus-5-5` |
 | `claude-opus-4-0` | `claude-opus-4-0` | `opus4` | `claude-opus-4-8` |
 | `claude-opus-4-1` | `claude-opus-4-1` | `opus46` | `claude-opus-4-6` |
 | `claude-opus-4-5` | `claude-opus-4-5` | `opus47` | `claude-opus-4-7` |
 | `claude-opus-4-6` | `claude-opus-4-6` | `opus48` | `claude-opus-4-8` |
 | `claude-opus-4-7` | `claude-opus-4-7` | `opus5` | `claude-opus-5` |
-| `claude-opus-4-8` | `claude-opus-4-8` | `sonnet` | `claude-sonnet-5` |
-| `claude-opus-5` | `claude-opus-5` | `sonnet4` | `claude-sonnet-4-6` |
+| `claude-opus-4-8` | `claude-opus-4-8` | `opus55` | `claude-opus-5-5` |
+| `claude-opus-5` | `claude-opus-5` | `sonnet` | `claude-sonnet-5` |
+| `claude-opus-5-5` | `claude-opus-5-5` | `sonnet4` | `claude-sonnet-4-6` |
 | `claude-sonnet-4-0` | `claude-sonnet-4-0` | `sonnet46` | `claude-sonnet-4-6` |
 | `claude-sonnet-4-5` | `claude-sonnet-4-5` | `sonnet5` | `claude-sonnet-5` |
 | `claude-sonnet-4-6` | `claude-sonnet-4-6` |  |  |
```

**File**: `docs/docs/_generated/model_aliases_codexresponses.md` (modified, +4/-2)
```diff
@@ -7,6 +7,8 @@
 | `codexplan55` | `codexresponses.gpt-5.5?reasoning=medium` |
 | `codexspark` | `codexresponses.gpt-5.3-codex-spark` |
 | `gpt-5.3-codex-spark` | `gpt-5.3-codex-spark` |
-| `luna` | `codexresponses.gpt-5.6-luna?reasoning=medium` |
-| `sol` | `codexresponses.gpt-5.6-sol?reasoning=high` |
+| `luna` | `codexresponses.gpt-6-luna?reasoning=medium` |
+| `luna56` | `codexresponses.gpt-5.6-luna?reasoning=medium` |
+| `sol` | `codexresponses.gpt-6-sol?reasoning=medium` |
+| `sol56` | `codexresponses.gpt-5.6-sol?reasoning=high` |
 | `terra` | `codexresponses.gpt-5.6-terra?reasoning=high` |
```

**File**: `docs/docs/_generated/model_aliases_responses.md` (modified, +4/-0)
```diff
@@ -19,6 +19,8 @@
 | `gpt-5.6-sol` | `responses.gpt-5.6-sol?reasoning=medium` |
 | `gpt-5.6-terra` | `responses.gpt-5.6-terra?reasoning=medium` |
 | `gpt-6-astra` | `responses.gpt-6-astra?reasoning=medium` |
+| `gpt-6-luna` | `responses.gpt-6-luna?reasoning=medium` |
+| `gpt-6-sol` | `responses.gpt-6-sol?reasoning=medium` |
 | `gpt51` | `responses.gpt-5.1` |
 | `gpt52` | `responses.gpt-5.2` |
 | `gpt54` | `responses.gpt-5.4` |
@@ -30,6 +32,8 @@
 | `gpt56-sol` | `responses.gpt-5.6-sol` |
 | `gpt56-terra` | `responses.gpt-5.6-terra` |
 | `gpt6astra` | `responses.gpt-6-astra?reasoning=medium` |
+| `gpt6luna` | `responses.gpt-6-luna?reasoning=medium` |
+| `gpt6sol` | `responses.gpt-6-sol?reasoning=medium` |
 | `o1` | `o1` |
 | `o1-mini` | `o1-mini` |
 | `o1-preview` | `o1-preview` |
```

**File**: `docs/docs/_generated/models_reference.md` (modified, +6/-3)
```diff
@@ -29,12 +29,15 @@
 | `opus46` | `anthropic` | Text, Vision, Document | `json` (schema) | effort: `auto`, `low`, `medium`, `high`, `max`, `off`<br>Example: `opus46?reasoning=auto` | — | `web_search` (web_search_20260209)<br>`web_fetch` (web_fetch_20260209)<br>beta: `code-execution-web-tools-2026-02-09` |
 | `opus47` | `anthropic` | Text, Vision, Document | `json` (schema) | effort: `auto`, `low`, `medium`, `high`, `xhigh`, `max`, `off`<br>Example: `opus47?reasoning=auto` | — | `web_search` (web_search_20260209)<br>`web_fetch` (web_fetch_20260209)<br>beta: `code-execution-web-tools-2026-02-09` |
 | `opus4` | `anthropic` | Text, Vision, Document | `json` (schema) | effort: `auto`, `low`, `medium`, `high`, `xhigh`, `max`, `off`<br>Example: `opus4?reasoning=auto` | — | `web_search` (web_search_20260209)<br>`web_fetch` (web_fetch_20260209)<br>beta: `code-execution-web-tools-2026-02-09` |
-| `opus` | `anthropic` | Text, Vision, Document | `json` (schema) | effort: `auto`, `low`, `medium`, `high`, `xhigh`, `max`, `off`<br>Example: `opus?reasoning=auto` | — | `web_search` (web_search_20260209)<br>beta: `code-execution-web-tools-2026-02-09` |
+| `opus5` | `anthropic` | Text, Vision, Document | `json` (schema) | effort: `auto`, `low`, `medium`, `high`, `xhigh`, `max`, `off`<br>Example: `opus5?reasoning=auto` | — | `web_search` (web_search_20260209)<br>beta: `code-execution-web-tools-2026-02-09` |
+| `opus` | `anthropic` | Text, Vision, Document | `json` (schema) | effort: `auto`, `low`, `medium`, `high`, `xhigh`, `max`<br>Example: `opus?reasoning=medium` | — | `web_search` (web_search_20260209)<br>beta: `code-execution-web-tools-2026-02-09` |
 | `sonnet4` | `anthropic` | Text, Vision, Document | `json` (schema) | effort: `auto`, `low`, `medium`, `high`, `max`, `off`<br>Example: `sonnet4?reasoning=auto` | — | `web_search` (web_search_20260209)<br>`web_fetch` (web_fetch_20260209)<br>beta: `code-execution-web-tools-2026-02-09` |
 | `astra` | `codexresponses` | Text, Vision, Document | `json` (schema) | effort: `low`, `medium`, `high`, `xhigh`, `max`<br>Example: `astra?reasoning=medium` | `low`, `medium`, `high`<br>Example: `astra?verbosity=low` | — |
 | `codexspark` | `codexresponses` | Text | `json` (schema) | — | — | — |
-| `luna` | `codexresponses` | Text, Vision, Document | `json` (schema) | effort: `none`, `low`, `medium`, `high`, `xhigh`, `max`, `off`<br>Example: `luna?reasoning=high` | `low`, `medium`, `high`<br>Example: `luna?verbosity=low` | — |
-| `sol` | `codexresponses` | Text, Vision, Document | `json` (schema) | effort: `none`, `low`, `medium`, `high`, `xhigh`, `max`, `off`<br>Example: `sol?reasoning=high` | `low`, `medium`, `high`<br>Example: `sol?verbosity=low` | — |
+| `luna56` | `codexresponses` | Text, Vision, Document | `json` (schema) | effort: `none`, `low`, `medium`, `high`, `xhigh`, `max`, `off`<br>Example: `luna56?reasoning=high` | `low`, `medium`, `high`<br>Example: `luna56?verbosity=low` | — |
+| `luna` | `codexresponses` | Text, Vision, Document | `json` (schema) | effort: `none`, `low`, `medium`, `high`, `xhigh`, `max`, `off`<br>Example: `luna?reasoning=medium` | `low`, `medium`, `high`<br>Example: `luna?verbosity=low` | — |
+| `sol56` | `codexresponses` | Text, Vision, Document | `json` (schema) | effort: `none`, `low`, `medium`, `high`, `xhigh`, `max`, `off`<br>Example: `sol56?reasoning=high` | `low`, `medium`, `high`<br>Example: `sol56?verbosity=low` | — |
+| `sol` | `codexresponses` | Text, Vision, Document | `json` (schema) | effort: `none`, `low`, `medium`, `high`, `xhigh`, `max`, `off`<br>Example: `sol?reasoning=medium` | `low`, `medium`, `high`<br>Example: `sol?verbosity=low` | — |
 | `terra` | `codexresponses` | Text, Vision, Document | `json` (schema) | effort: `none`, `low`, `medium`, `high`, `xhigh`, `max`, `off`<br>Example: `terra?reasoning=high` | `low`, `medium`, `high`<br>Example: `terra?verbosity=low` | — |
 | `deepseek-v4-flash-vision-exp` | `deepseek` | Text, Vision | `json` (schema) | effort: `none`, `low`, `high`, `max`, `off`<br>Example: `deepseek-v4-flash-vision-exp?reasoning=max` | — | — |
 | `deepseek-v4-flash` | `deepseek` | Text, Vision | `json` (schema) | effort: `none`, `low`, `high`, `max`, `off`<br>Example: `deepseek-v4-flash?reasoning=max` | — | — |
```

**File**: `docs/docs/guides/codex.md` (modified, +10/-6)
```diff
@@ -28,16 +28,16 @@ This starts **fast-agent** pre-configured for a Codex-style coding workflow.
 - A `dev` coding agent for interactive software work
 - A bounded rg-first search helper backed by `codexspark`
 - WebSocket-capable transport for modern Codex/OpenAI models
-- Filesystem editing tools selected for the model: Astra defaults to
+- Filesystem editing tools selected for the model: GPT-6 models (Astra, Sol, Luna) default to
   `write_text_file` plus `edit_file`; patch-oriented models use `apply_patch`
 - Preconfigured MCP targets available from `/mcp attach`
 
 The coding agent has a minimal system prompt plus tools for the shell,
 filesystem and **fast-agent** services. `AGENTS.md` is included automatically if
 present. Customise the agent by editing `.fast-agent/agent-cards/dev.md`.
 
-Astra's writer/editor default applies to both Responses and Codex Responses,
-including the `astra` and `codexplan` aliases. To explicitly select the
+The GPT-6 writer/editor default applies to both Responses and Codex Responses,
+including the `astra`, `sol`, `luna` and `codexplan` aliases. To explicitly select the
 Codex-style patch interface instead:
 
 ```yaml
@@ -77,6 +77,8 @@ are stored in your OS keyring, with a secure file fallback. After that you can u
 Codex OAuth model aliases such as:
 
 - `codexplan` — GPT-6-Astra with medium reasoning
+- `sol` — GPT-6-Sol with medium reasoning
+- `luna` — GPT-6-Luna with medium reasoning
 
 If you prefer, you can also run model setup explicitly:
 
@@ -86,10 +88,12 @@ uvx fast-agent-mcp@latest model setup
 
 ## Web search
 
-Use `fast-agent go --model 'astra?web_search=true'` to enable automatic `web_run`
-on Codex Lite without shell access; use `web_search=false` to disable it.
+Use `fast-agent go --model 'astra?web_search=true'` to enable hosted web search;
+use `web_search=false` to disable it. Codex OAuth models use the standard Responses
+contract by default. With `lite=on` (Codex's internal Responses Lite contract), web
+search instead uses the harness `web_run` tool, without shell access.
 In a running conversation, `/model web_search on` and `/model web_search off`
-control the same feature. Sol and public Responses keep their hosted search route.
+control the same feature.
 See [standalone web search](../models/providers/openai.md#standalone-web-search-codex-lite)
 for configuration, the internal endpoint caveat, and a runnable library example
 with caller-supplied authentication.
```

**File**: `docs/docs/models/index.md` (modified, +5/-2)
```diff
@@ -125,6 +125,8 @@ Useful query parameters:
 - `web_search=on|off`
 - `transport=sse|ws|auto`
 - `service_tier=fast|flex` where supported
+- `lite=on|off` (`codexresponses` only): opt in to Codex's internal Responses Lite
+  contract for models that support it; the default is the standard contract
 - `poll_period=10..3600` for the default managed-process wait
 
 Use the `openai` provider for Chat Completions-style models such as `openai.gpt-4.1`.
@@ -156,7 +158,8 @@ Useful query parameters and config:
 - `anthropic.cache_ttl: 5m|1h`
 - `poll_period=10..3600` for the default managed-process wait
 
-`opus` and `opus5` resolve to `claude-opus-5`; use `opus48`, `opus47`, or `opus46` to pin an older
+`opus` and `opus55` resolve to `claude-opus-5-5`; `opus5` remains pinned to
+`claude-opus-5`. Use `opus48`, `opus47`, or `opus46` to pin an older
 Opus generation. Opus 5 does not support `web_fetch`, so use `web_search` alone or pin `opus48`
 when fetch is required. Claude Opus 4.7+ uses adaptive reasoning rather than fixed thinking budgets:
 `reasoning=auto` lets the model choose, effort levels tune depth and token spend, and `task_budget`
@@ -253,7 +256,7 @@ provider.model_name[?reasoning=value][&query=value...]
 - **model_name**: the model or deployment name
 - **query parameters**: provider/model-specific overrides such as `reasoning`, `structured`,
   `context`, `transport`, `service_tier`, `temperature` (`temp` alias), `web_search`,
-  `web_fetch`, `x_search`, `task_budget`, `max_tokens`, `streaming_timeout`, and
+  `web_fetch`, `x_search`, `task_budget`, `max_tokens`, `streaming_timeout`, `lite`, and
   `poll_period`
 
 !!! Note "Provider delimiter: `.` or `/`"
```

---

### Incident Patch 15: `12bc6e37` (2026-09-20)
**Commit Message**: Fix Copilot device login from the model picker (#963)

* fix: start Copilot device login directly from model picker

* chore: bump version to 0.10.27

**File**: `docs/docs/models/providers/copilot.md` (modified, +3/-1)
```diff
@@ -26,7 +26,9 @@ fast-agent --model copilot.claude-sonnet-5
 ```
 
 Alternatively, you can use `fast-agent go` and login direct from the model
-selection screen.
+selection screen. When signed out, pressing Enter on a Copilot model starts
+the device-code login immediately. Follow the displayed GitHub URL and code;
+fast-agent waits for approval. Press Ctrl+C to cancel.
 
 NB: OAuth credentials are **not model entitlement**: your account and
 application still need access to the selected model. Routing uses the local
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,6 +1,6 @@
 [project]
 name = "fast-agent-mcp"
-version = "0.10.26"
+version = "0.10.27"
 description = "Code, Build and Evaluate agents - excellent Model and Skills/MCP/ACP/A2A Support"
 readme = "README.md"
 license = { file = "LICENSE" }
```

**File**: `src/fast_agent/cli/runtime/copilot_activation.py` (modified, +2/-3)
```diff
@@ -11,7 +11,7 @@
 
 
 async def activate_copilot(settings: CopilotSettings) -> bool:
-    """Load credentials, optionally await device login; inference determines model access."""
+    """Load credentials or start device login after explicit picker selection."""
     from fast_agent.ui import console
 
     try:
@@ -25,8 +25,7 @@ async def activate_copilot(settings: CopilotSettings) -> bool:
                 "Device login will not replace an explicit environment token.",
             )
         console.ensure_blocking_console()
-        if not typer.confirm("Copilot is signed out. Start device-code login?", default=False):
-            return False
+        typer.echo("Starting GitHub Copilot device-code login… (Ctrl+C to cancel)", err=True)
         # Await directly: task cancellation must stop polling before credentials are saved.
         await login_copilot_oauth_async()
         if not await broker.has_credentials():
```

**File**: `src/fast_agent/llm/provider/copilot/oauth.py` (modified, +1/-0)
```diff
@@ -221,6 +221,7 @@ async def login_copilot_oauth_async() -> OAuthCredential:
         console.console.print(
             f"Open {_VERIFICATION_URI} and enter code {device.user_code}.", markup=False
         )
+        console.console.print("Waiting for GitHub approval. Ctrl+C to cancel.", markup=False)
         credential = await poll_copilot_device_code(client, device)
     # Cancellation at any await above propagates without saving.
     with _store_errors():
```

**File**: `tests/unit/llm/test_copilot_oauth.py` (modified, +1/-0)
```diff
@@ -356,6 +356,7 @@ async def test_success_displays_only_user_instructions_and_saves(
     assert stored is not None
     assert stored.credential.refresh_token is None
     rendered = str(output.call_args_list)
+    assert "Waiting for GitHub approval. Ctrl+C to cancel." in rendered
     assert USER_CODE in rendered
     assert "https://github.com/login/device" in rendered
     assert TOKEN not in rendered
```

**File**: `tests/unit/llm/test_copilot_picker.py` (modified, +14/-34)
```diff
@@ -64,43 +64,25 @@ async def test_activate(auth, statuses, expected, login_expected):
     broker.has_credentials.side_effect = statuses
     assert await activation.activate_copilot(CopilotSettings()) is expected
     assert login.called is login_expected
-    assert confirm.called is login_expected
+    confirm.assert_not_called()
     assert broker.has_credentials.await_count == len(statuses)
 
 
 @pytest.mark.asyncio
-async def test_consent_before_login_and_recheck(auth, monkeypatch):
+async def test_login_starts_without_confirmation_and_announces_progress(auth, capsys):
     broker, login, confirm = auth
-    events = Mock()
-    blocking = Mock()
-    monkeypatch.setattr("fast_agent.ui.console.ensure_blocking_console", blocking)
-    for name, mock in [
-        ("check", broker.has_credentials),
-        ("blocking", blocking),
-        ("confirm", confirm),
-        ("login", login),
-    ]:
-        events.attach_mock(mock, name)
     broker.has_credentials.side_effect = [False, True]
-    assert await activation.activate_copilot(CopilotSettings())
-    assert [call[0] for call in events.mock_calls] == [
-        "check",
-        "blocking",
-        "confirm",
-        "login",
-        "check",
-    ]
-    assert confirm.call_args.kwargs["default"] is False
 
+    async def device_login():
+        output = capsys.readouterr().err
+        assert "Starting GitHub Copilot device-code login" in output
+        assert "Ctrl+C to cancel" in output
 
-@pytest.mark.asyncio
-async def test_decline(auth):
-    broker, login, confirm = auth
-    broker.has_credentials.return_value = False
-    confirm.return_value = False
-    assert not await activation.activate_copilot(CopilotSettings())
-    login.assert_not_called()
-    broker.has_credentials.assert_awaited_once()
+    login.side_effect = device_login
+    assert await activation.activate_copilot(CopilotSettings())
+    confirm.assert_not_called()
+    login.assert_awaited_once()
+    assert broker.has_credentials.await_count == 2
 
 
 @pytest.mark.asyncio
@@ -140,15 +122,13 @@ async def test_auth_failure_retains_help(auth, monkeypatch, capsys, stage):
 
 @pytest.mark.asyncio
 @pytest.mark.parametrize("error", [EOFError, KeyboardInterrupt, activation.typer.Abort])
-@pytest.mark.parametrize("stage", ["confirm", "login"])
-async def test_interactive_cancellation(auth, error, stage):
+async def test_interactive_cancellation(auth, error):
     broker, login, confirm = auth
     broker.has_credentials.return_value = False
-    (confirm if stage == "confirm" else login).side_effect = error
+    login.side_effect = error
     assert not await activation.activate_copilot(CopilotSettings())
     broker.has_credentials.assert_awaited_once()
-    if stage == "confirm":
-        login.assert_not_called()
+    confirm.assert_not_called()
 
 
 @pytest.mark.asyncio
```

**File**: `tests/unit/llm/test_copilot_tui_activation.py` (modified, +0/-1)
```diff
@@ -85,7 +85,6 @@ async def test_tui_task_cancellation_stops_directly_awaited_copilot_login(
     monkeypatch.delenv("COPILOT_GITHUB_TOKEN", raising=False)
     broker = Mock(has_credentials=AsyncMock(return_value=False))
     monkeypatch.setattr(activation, "CopilotBroker", Mock(return_value=broker))
-    monkeypatch.setattr(activation.typer, "confirm", Mock(return_value=True))
     monkeypatch.setattr("fast_agent.ui.console.ensure_blocking_console", Mock())
     started = asyncio.Event()
     stopped = asyncio.Event()
```

**File**: `uv.lock` (modified, +1/-1)
```diff
@@ -902,7 +902,7 @@ requires-dist = [{ name = "fast-agent-mcp", editable = "." }]
 
 [[package]]
 name = "fast-agent-mcp"
-version = "0.10.26"
+version = "0.10.27"
 source = { editable = "." }
 dependencies = [
     { name = "a2a-sdk" },
```

#### Recent Merged Pull Requests:
- **PR #997** (2026-10-04): docs: forward redesign and data-driven benchmarks pages (@evalstate)
- **PR #995** (2026-10-01): fix: preserve observed ATIF accounting and prepare 0.10.42 (@evalstate)
- **PR #994** (2026-10-01): fix: align MCP skills wire contract with stable specification (@evalstate)
- **PR #993** (2026-09-29): fast-agent 0.10.41: fix inline PDFs on Copilot Responses and Claude (@evalstate)
- **PR #992** (2026-09-29): fast-agent 0.10.40: GPT-6.1 Sol (responses, codexresponses, copilot), openai 3.21.0 (@evalstate)
- **PR #991** (2026-09-29): fix: omit reasoning from copied ATIF context steps (@evalstate)
- **PR #990** (2026-09-30): feat(mcp): retain oversized MCP tool results in a model-readable spool (@evalstate)
- **PR #989** (2026-09-28): fast-agent 0.10.39: honor Responses end_turn continuations (@evalstate)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

# Forensic Learning Record (Deep Inspection): massgen/MassGen

> **Canonical Artifact**: `07_PROJECT_LEARNING/massgen-massgen-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/massgen/MassGen](https://github.com/massgen/MassGen))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-04T20:39:35.651Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `massgen/MassGen`
- **Description**: 🚀 MassGen is an open-source multi-agent scaling system that runs in your terminal, autonomously orchestrating frontier models and agents to collaborate, reason, and produce high-quality results. | Join us on Discord: discord.massgen.ai
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1136 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `massgen/adapters/utils/__init__.py`
```
"""Utility functions for adapters."""

```

### Core Architecture Module: `massgen/adapters/utils/ag2_utils.py`
```
"""
Utility functions for AG2 (AutoGen) adapter.
"""

import os
import time

# Suppress autogen deprecation warnings
import warnings
from typing import Any

warnings.filterwarnings("ignore", category=DeprecationWarning, module="autogen")
warnings.filterwarnings("ignore", message=".*jsonschema.*")
warnings.filterwarnings("ignore", message=".*Pydantic.*")

from autogen import AssistantAgent, ConversableAgent, LLMConfig  # noqa: E402


def setup_api_keys() -> None:
    """Set up API keys for AG2 compatibility."""
    # Copy GEMINI_API_KEY to GOOGLE_GEMINI_API_KEY if it exists
    if "GEMINI_API_KEY" in os.environ and "GOOGLE_GEMINI_API_KEY" not in os.environ:
        os.environ["GOOGLE_GEMINI_API_KEY"] = os.environ["GEMINI_API_KEY"]


def validate_agent_config(cfg: dict[str, Any], require_llm_config: bool = True) -> None:
    """
    Validate required fields in agent configuration.

    Args:
        cfg: Agent configuration dict
        require_llm_config: If True, llm_config is required. If False, it's optional.
    """
    if require_llm_config and "llm_config" not in cfg:
        raise ValueError("Each AG2 agent configuration must include 'llm_config'.")

    if "name" not in cfg:
        raise ValueError("Each AG2 agent configuration must include 'name'.")


def create_llm_config(llm_config_data: Any) -> LLMConfig:
    """
    Create LLMConfig from dict or list format.

    Supports new AG2 syntax:
    - Single dict: LLMConfig({'model': 'gpt-4', 'api_key': '...'})
    - List of dicts: LLMConfig({'model': 'gpt-4', ...}, {'model': 'gpt-3.5', ...})
    """
    if isinstance(llm_config_data, list):
        # YAML format: llm_config: [{...}, {...}]
        return LLMConfig(*llm_config_data)
    elif isinstance(llm_config_data, dict):
        # YAML format: llm_config: {model: 'gpt-4o', ...}
        return LLMConfig(llm_config_data)
    else:
        raise ValueError(f"llm_config must be a dict or list, got {type(llm_config_data)}")


def create_code_executor(executor_config: dict[str, Any]) -> Any:
    """Create code executor from configuration."""
    executor_type = executor_config.get("type")

    if not executor_type:
        raise ValueError("code_execution_config.executor must include 'type' field")

    # Remove 'type' from config before passing to executor
    executor_params = {k: v for k, v in executor_config.items() if k != "type"}

    # Create appropriate executor based on type
    if executor_type == "LocalCommandLineCodeExecutor":
        from autogen.coding import LocalCommandLineCodeExecutor

        return LocalCommandLineCodeExecutor(**executor_params)

    elif executor_type == "DockerCommandLineCodeExecutor":
        from autogen.coding import DockerCommandLineCodeExecutor

        return DockerCommandLineCodeExecutor(**executor_params)

    elif executor_type == "YepCodeCodeExecutor":
        from autogen.coding import YepCodeCodeExecutor

        return YepCodeCodeExecutor(**executor_params)

    elif executor_type == "JupyterCodeExecutor":
        from autogen.coding.jupyter import JupyterCodeExecutor

        return JupyterCodeExecutor(**executor_params)

    else:
        raise ValueError(
            f"Unsupported code executor type: {executor_type}. " f"Supported types: LocalCommandLineCodeExecutor, DockerCommandLineCodeExecutor, " f"YepCodeCodeExecutor, JupyterCodeExecutor",
        )


def build_agent_kwargs(cfg: dict[str, Any], llm_config: LLMConfig, code_executor: Any = None) -> dict[str, Any]:
    """Build kwargs for agent initialization."""
    agent_kwargs = {
        "name": cfg["name"],
        "system_message": cfg.get("system_message", "You are a helpful AI assistant."),
        "human_input_mode": "NEVER",
        "llm_config": llm_config,
    }

    if code_executor is not None:
        agent_kwargs["code_execution_config"] = {"executor": code_executor}

    return agent_kwargs


def setup_agent_from_config(config: dict[str, Any], default_llm_config: Any = None) -> ConversableAgent:
    """
    Set up a ConversableAgent from configuration.

    Args:
        config: Agent configuration dict
        default_llm_config: Default llm_config to use if agent doesn't provide one

    Returns:
        ConversableAgent or AssistantAgent instance
    """
    cfg = config.copy()

    # Check if llm_config is provided in agent config
    has_llm_config = "llm_config" in cfg

    # Validate configuration (llm_config optional if default provided)
    validate_agent_config(cfg, require_llm_config=not default_llm_config)

    # Extract agent type
    agent_type = cfg.pop("type", "conversable")

    # Create LLM config
    if has_llm_config:
        llm_config = create_llm_config(cfg.pop("llm_config"))
    elif default_llm_config:
        llm_config = create_llm_config(default_llm_config)
    else:
        raise ValueError("No llm_config provided for agent and no default_llm_config available")

    # Create code executor if configured
    code_executor = None
    if "code_execution_config" in cfg:
        code_exec_config = cfg.pop("code_execution_config")
        if "executor" in code_exec_config:
            code_executor = create_code_executor(code_exec_config["executor"])

    # Build agent kwargs
    agent_kwargs = build_agent_kwargs(cfg, llm_config, code_executor)

    # Create appropriate agent
    if agent_type == "assistant":
        return AssistantAgent(**agent_kwargs)
    elif agent_type == "conversable":
        return ConversableAgent(**agent_kwargs)
    else:
        raise ValueError(
            f"Unsupported AG2 agent type: {agent_type}. Use 'assistant' or 'conversable' for ag2 agents.",
        )


def get_group_initial_message() -> dict[str, Any] | None:
    """
    Create the initial system message for group chat.

    Returns:
        Dict with role and content for initial system message
    """
    initial_message = f"""
    CURRENT ANSWER from multiple agents for final response to a message is given.
    Different agents may have different builtin tools and capabilities.
    Does the best CURRENT ANSWER address the ORIGINAL MESSAGE well?

    If CURRENT ANSWER is given, digest existing answers, combine their strengths, and do additional work to address their weaknesses.
    if you think CURRENT ANSWER is good enough, you can also use it as your answer.

    *Note*: The CURRENT TIME is **{time.strftime("%Y-%m-%d %H:%M:%S")}**.
    """

    # Not real system message. Can't send system message to group chat.
    # When a non function/tool message is sent to an agent in group chat, it will be treated as user message.
    return {"role": "system", "content": initial_message}


def get_user_agent_tool_call_message() -> str:
    system_message = """
    You are the User agent overseeing a team of expert agents.
    They worked together to create an improved answer to the ORIGINAL MESSAGE based on CURRENT ANSWER (if given).

    Does CURRENT ANSWER address the ORIGINAL MESSAGE well? If YES, use the `vote` tool to record your vote and skip the `new_answer` tool.
    Otherwise, find the final improved answer generated by team and use the `new_answer` tool to provide it as your final answer to the ORIGINAL MESSAGE.

    When CURRENT ANSWER section is not available and a new answer is provided by the team of experts,
    you should use the `new_answer` tool instead of `vote` tool.

    You MUST ONLY use one of the two tools (`vote` or `new_answer`) ONCE to respond.
    """

    return system_message


def get_user_agent_default_system_message() -> str:
    system_message = """
    "MUST say 'TERMINATE' when the original request is well answered. Do NOT do anything else."
    """
    return system_message


def get_user_agent_default_description() -> str:
    description = """
    ALWAYS check if other agents still needs to be selected before selected this agent.
    MUST ONLY be selected when the original request is well answered and the conversation should terminate.
    """

    return description


def postprocess_group_chat_results(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    for message in messages:
        if message["content"]:
            message["content"] = f"<SENDER>: {message['name']} </SENDER> \n" + message["content"]
        message["role"] = "assistant"

    return messages


def unregister_tools_for_agent(tools: list[dict[str, Any]], agent: ConversableAgent) -> None:
    """Unregister all tools from single agent."""
    for tool in tools:
        agent.update_tool_signature(tool_sig=tool, is_remove=True, silent_override=True)


def register_tools_for_agent(tools: list[dict[str, Any]], agent: ConversableAgent) -> None:
    """Register all tools to single agent."""
    for tool in tools:
        agent.update_tool_signature(tool_sig=tool, is_remove=False, silent_override=True)

```

### Core Architecture Module: `massgen/backend/_compression_utils.py`
```
"""
Shared compression utilities for all backends.

Provides a simple message compression function that can be used by any backend
when context length is exceeded.
"""

import json
import time
from typing import TYPE_CHECKING, Any

import httpx

from ..logger_config import get_log_session_dir, logger
from ..structured_logging import log_context_compression

if TYPE_CHECKING:
    from .base import BackendBase

# Keys to exclude when creating compression backend (no MCP, no tools, no filesystem)
# Also exclude api_key since it's passed explicitly to create_backend
COMPRESSION_EXCLUDED_KEYS = {"mcp_servers", "custom_tools", "cwd", "enable_multimodal_tools", "api_key"}

# Conversation summarization prompts
#
# Uses a 3-message structure to clearly separate the conversation being summarized
# from the summarization instructions:
# 1. System: Brief instructions for summarization format
# 2. User: The conversation content (provided as a separate message)
# 3. User: Request to summarize it
#
# This prevents the model from confusing instructions in the conversation content
# with the summarization task itself.
SUMMARIZER_SYSTEM_PROMPT = """You summarize conversations for context continuity.

CRITICAL: You are summarizing an IN-PROGRESS conversation. The task is NOT COMPLETE.
The agent MUST continue working after reading this summary. Do NOT imply work is done.

Include ALL of the following:

1. **Task Context**: Briefly describe the task being worked on (e.g., "Building a Bob Dylan website").

2. **Work Completed**:
   - Files created/modified (with full paths)
   - Key tool calls and their results
   - Code written or configurations made

3. **Environment Setup**:
   - Packages installed (e.g., `pip install jinja2`, `npm install playwright`)
   - Directories created
   - Environment variables or configurations set

4. **Key Technical Details**:
   - Specific file paths and their purposes
   - Important decisions made and why
   - Any errors encountered and how they were resolved (or still pending)
   - Function signatures or API patterns discovered

5. **Current State**: Where the work stands right now

6. **Remaining Work / Next Steps** (CRITICAL - be explicit and detailed):
   - List SPECIFIC tasks that MUST still be completed
   - The agent MUST continue working after reading this summary
   - Do NOT imply the work is finished - there is ALWAYS more to do unless the task is fully complete

Be detailed - this summary replaces the original messages. The agent must be able
to continue working effectively from this summary alone. Avoid vague descriptions
like "working on website" - include specific files, decisions, and progress.

REMEMBER: The agent will read this and CONTINUE WORKING. Make the remaining work clear."""

# Conversation content - provided as separate message
SUMMARIZER_CONVERSATION_PROMPT = """Here is the conversation to summarize:

{conversation}"""

# Final request - triggers the summary
SUMMARIZER_REQUEST_PROMPT = """Summarize the conversation above."""


async def compress_messages_for_recovery(
    messages: list[dict[str, Any]],
    backend: "BackendBase",
    target_ratio: float = 0.2,
    buffer_content: str | None = None,
) -> list[dict[str, Any]]:
    """Compress messages for context error recovery.

    This function is backend-agnostic and uses the provided backend
    to make the summarization call. If compression is not sufficient
    (e.g., initial input exceeds context), it will also truncate
    message content to fit within the context window.

    Args:
        messages: The messages that caused the context length error
        backend: The backend to use for summarization (uses same provider)
        target_ratio: What fraction of messages to preserve (default 0.2 = 20%)
        buffer_content: Optional partial response content from streaming buffer

    Returns:
        Compressed message list ready for retry
    """
    logger.info(
        f"[CompressionUtils] Compressing {len(messages)} messages " f"with target_ratio={target_ratio}",
    )

    # Separate system message from other messages - system should NEVER be compressed
    system_message = None
    conversation_messages = messages
    if messages and messages[0].get("role") == "system":
        system_message = messages[0]
        conversation_messages = messages[1:]

    # If only system message or nothing to compress, return original
    if not conversation_messages:
        logger.warning("[CompressionUtils] No conversation messages to compress, returning original")
        return messages

    # Calculate how many conversation messages to preserve (excluding system)
    total_conversation = len(conversation_messages)
    preserve_count = max(1, int(total_conversation * target_ratio))

    # Determine which messages to compress vs preserve
    if preserve_count < total_conversation:
        messages_to_compress = conversation_messages[:-preserve_count]
        recent_messages = conversation_messages[-preserve_count:]
    else:
        messages_to_compress = conversation_messages[:-1]
        recent_messages = conversation_messages[-1:]

    # If there's nothing to compress from messages BUT we have buffer content,
    # we can still generate a summary from the buffer (which contains tool results)
    if not messages_to_compress and not buffer_content:
        logger.warning("[CompressionUtils] No messages or buffer content to compress, returning original")
        return messages

    # If we have no messages to compress but DO have buffer content,
    # summarize the buffer content alone (e.g., massive tool results on first turn)
    if not messages_to_compress and buffer_content:
        logger.info("[CompressionUtils] No messages to compress but buffer has content - summarizing buffer only")

    # Build context for summarization
    # Include both message content and buffer content (tool results, etc.)
    summary_context = ""
    if messages_to_compress:
        summary_context = _format_messages_for_summary(messages_to_compress)
    if buffer_content:
        if summary_context:
            summary_context += f"\n\n[Tool execution results and streaming content]\n{buffer_content}"
        else:
            # Buffer-only case: summarize just the tool results
            summary_context = f"[Tool execution results]\n{buffer_content}"

    # Save debug data
    _save_compression_debug(
        original_messages=messages,
        messages_to_compress=messages_to_compress,
        recent_messages=recent_messages,
        buffer_content=buffer_content,
        summary_context=summary_context,
        suffix="_input",
    )

    # Generate summary using the same backend
    try:
        summary = await _generate_summary(backend, summary_context)
        logger.info(f"[CompressionUtils] Generated summary: {len(summary)} chars")

    except (httpx.HTTPStatusError, httpx.TimeoutException, TimeoutError) as e:
        # Expected network/API errors - fallback to useful guidance
        logger.warning(
            f"[CompressionUtils] Summarization failed due to API/network error: {e}. " "Using fallback guidance.",
        )
        summary = """[Context was compressed but summarization failed due to API error]

Your previous work was lost from context. To continue:
1. Read `tasks/plan.json` to see your task plan and what's completed vs pending
2. Read `tasks/evolving_skill/SKILL.md` for your workflow (if applicable)
3. Use `ls -la` to see what files exist in the workspace
4. Continue working on pending tasks - do NOT call new_answer yet"""

    except Exception as e:
        # Unexpected error - log with full stack trace for debugging
        logger.error(
            f"[CompressionUtils] Unexpected error during summarization: {e}. " "Using fallback guidance.",
            exc_info=True,
        )
        summary = """[Context was compressed but summarization failed]

Your previous work was lost from context. To continue:
1. Read `tasks/plan.json` to see your task plan and what's completed vs pending
2. Read `tasks/evolving_skill/SKILL.md` for your workflow (if applicable)
3. Use `ls -la` to see what files exist in the workspace
4. Continue working on pending tasks - do NOT call new_answer yet"""

    # Build result: system → user message → summary → any additional recent messages
    # Order matters! Putting summary AFTER user message means the model sees it as
    # the latest context and will build on it rather than re-doing the work.
    result = []

    # Preserve system message if present (never compressed)
    if system_message:
        result.append(system_message)

    # Add recent messages (typically contains the user request)
    result.extend(recent_messages)

    # Add summary as assistant message LAST - this is the most recent context
    # the model sees, so it should continue from here rather than start fresh
    # Strip trailing whitespace to avoid Claude API error about trailing whitespace
    # CRITICAL: Make it explicit that the agent must CONTINUE WORKING, not submit an answer
    result.append(
        {
            "role": "assistant",
            "content": f"""[CONTEXT RECOVERY - DO NOT CALL new_answer YET]

You hit a context limit and your conversation was compressed. Below is a summary of your progress.

**IMPORTANT**: You MUST CONTINUE WORKING on the task. Do NOT call `new_answer` until the task is fully complete.

To continue:
1. Read `tasks/plan.json` to see your task plan and remaining work
2. Read `tasks/evolving_skill/SKILL.md` to see your workflow (if applicable)
3. Continue executing the remaining tasks

**FULL EXECUTION HISTORY**: Your complete execution trace is saved at `execution_trace.md`.
If this summary is missing details you need, read that file to recover them.

---

{summary.strip()}

---

**RESUME WORKING NOW.** Check your task plan and continue from where you left off. Do NOT submit an answer yet.""",
        },
    )

    logger.info(
        f"[CompressionUtils] Compressed {len(m
```

### Core Architecture Module: `massgen/backend/gemini_utils.py`
```
"""
Gemini-specific structured output models for coordination actions (voting and answer submission).
"""

import enum

try:
    from pydantic import BaseModel, Field
except ImportError:
    BaseModel = None
    Field = None


class ActionType(enum.Enum):
    """Action types for structured output."""

    VOTE = "vote"
    NEW_ANSWER = "new_answer"
    ASK_OTHERS = "ask_others"


class DecompositionActionType(enum.Enum):
    """Action types for decomposition mode structured output."""

    STOP = "stop"
    NEW_ANSWER = "new_answer"


class VoteOnlyActionType(enum.Enum):
    """Action type for vote-only mode (when agent has reached answer limit)."""

    VOTE = "vote"


class PostEvaluationActionType(enum.Enum):
    """Action types for post-evaluation structured output."""

    SUBMIT = "submit"
    RESTART = "restart"


class VoteAction(BaseModel):
    """Structured output for voting action."""

    action: ActionType = Field(default=ActionType.VOTE, description="Action type")
    agent_id: str = Field(description="Anonymous agent ID to vote for (e.g., 'agent1', 'agent2')")
    reason: str = Field(description="Brief reason why this agent has the best answer")


class NewAnswerAction(BaseModel):
    """Structured output for new answer action."""

    action: ActionType = Field(default=ActionType.NEW_ANSWER, description="Action type")
    content: str = Field(description="Your improved answer. If any builtin tools like search or code execution were used, include how they are used here.")


class AskOthersAction(BaseModel):
    """Structured output for ask_others action (broadcast question to other agents)."""

    action: ActionType = Field(default=ActionType.ASK_OTHERS, description="Action type")
    question: str = Field(
        description="Your specific, actionable question with ALL relevant context included. "
        "Other agents cannot see your files or workspace, so include requirements, "
        "constraints, and any important details they need to give a useful answer.",
    )
    wait: bool = Field(default=True, description="Whether to wait for responses before continuing")


class CoordinationResponse(BaseModel):
    """Structured response for coordination actions."""

    action_type: ActionType = Field(description="Type of action to take")
    vote_data: VoteAction | None = Field(default=None, description="Vote data if action is vote")
    answer_data: NewAnswerAction | None = Field(default=None, description="Answer data if action is new_answer")
    ask_others_data: AskOthersAction | None = Field(default=None, description="Ask others data if action is ask_others")


class VoteOnlyVoteAction(BaseModel):
    """Structured output for voting action in vote-only mode."""

    action: VoteOnlyActionType = Field(default=VoteOnlyActionType.VOTE, description="Action type (must be vote)")
    agent_id: str = Field(description="Anonymous agent ID to vote for (e.g., 'agent1', 'agent2')")
    reason: str = Field(description="Brief reason why this agent has the best answer")


class VoteOnlyCoordinationResponse(BaseModel):
    """Structured response for vote-only mode (when agent has reached answer limit).

    In vote-only mode, agents can ONLY vote - they cannot submit new answers.
    This is used when max_new_answers_per_agent limit has been reached.
    """

    action_type: VoteOnlyActionType = Field(description="Type of action to take (must be vote)")
    vote_data: VoteOnlyVoteAction = Field(description="Vote data - REQUIRED in vote-only mode")


class StopAction(BaseModel):
    """Structured output for stop action (decomposition mode)."""

    action: DecompositionActionType = Field(default=DecompositionActionType.STOP, description="Action type")
    summary: str = Field(description="What you accomplished and how it connects to other agents' work")
    status: str = Field(description="Whether your subtask is complete or blocked ('complete' or 'blocked')")


class DecompositionNewAnswerAction(BaseModel):
    """Structured output for new answer action in decomposition mode."""

    action: DecompositionActionType = Field(default=DecompositionActionType.NEW_ANSWER, description="Action type")
    content: str = Field(description="Your improved answer for your subtask.")


class DecompositionCoordinationResponse(BaseModel):
    """Structured response for decomposition mode coordination.

    In decomposition mode, agents call stop (not vote) when their subtask is complete.
    """

    action_type: DecompositionActionType = Field(description="Type of action to take")
    stop_data: StopAction | None = Field(default=None, description="Stop data if action is stop")
    answer_data: DecompositionNewAnswerAction | None = Field(default=None, description="Answer data if action is new_answer")


class SubmitAction(BaseModel):
    """Structured output for submit action (post-evaluation)."""

    action: PostEvaluationActionType = Field(default=PostEvaluationActionType.SUBMIT, description="Action type")
    confirmed: bool = Field(default=True, description="Confirmation that answer is satisfactory")


class RestartAction(BaseModel):
    """Structured output for restart action (post-evaluation)."""

    action: PostEvaluationActionType = Field(default=PostEvaluationActionType.RESTART, description="Action type")
    reason: str = Field(description="Clear explanation of why the answer is insufficient")
    instructions: str = Field(description="Detailed, actionable guidance for agents on the next attempt")


class PostEvaluationResponse(BaseModel):
    """Structured response for post-evaluation actions."""

    action_type: PostEvaluationActionType = Field(description="Type of post-evaluation action to take")
    submit_data: SubmitAction | None = Field(default=None, description="Submit data if action is submit")
    restart_data: RestartAction | None = Field(default=None, description="Restart data if action is restart")

```

### Core Architecture Module: `massgen/frontend/displays/textual_widgets/queued_input_banner.py`
```
"""
Queued Input Banner Widget for MassGen TUI.

Shows a banner above the input bar when human input has been queued
for injection during agent execution.
"""

from typing import Any

from rich.text import Text
from textual.widgets import Static


class QueuedInputBanner(Static):
    """Banner showing queued human input pending injection.

    Displayed above the input bar when the user types input while
    agents are executing. Shows a preview of queued messages and
    indicates they will be injected after the next tool call.
    """

    # CSS moved to base.tcss for theme support
    DEFAULT_CSS = ""

    def __init__(
        self,
        *,
        id: str | None = None,
        classes: str | None = None,
    ) -> None:
        """Initialize the queued input banner.

        Args:
            id: Optional widget ID.
            classes: Optional CSS classes.
        """
        super().__init__(id=id, classes=classes)
        self._queued_messages: list[dict[str, Any]] = []
        self._pending_counts: dict[str, int] = {}

    def add_message(
        self,
        text: str,
        target_label: str = "all agents",
        source_label: str = "human",
    ) -> None:
        """Add a queued message and show/update the banner.

        Args:
            text: The queued human input text to add
            target_label: Human-friendly target description (e.g., "all agents", "agent_b")
            source_label: Runtime source label (e.g., "human", "parent")
        """
        self._queued_messages.append(
            {
                "id": None,
                "content": text,
                "target_label": target_label,
                "source_label": source_label,
                "pending_agents": [],
            },
        )
        self._rebuild()
        self.add_class("visible")

    def set_messages(self, messages: list[dict[str, Any]]) -> None:
        """Replace queued message entries with authoritative queue state."""
        normalized: list[dict[str, Any]] = []
        for message in messages:
            normalized.append(
                {
                    "id": message.get("id"),
                    "content": str(message.get("content", "")),
                    "target_label": str(message.get("target_label", "all agents")),
                    "source_label": str(message.get("source_label", message.get("source", "human"))),
                    "pending_agents": [str(aid) for aid in message.get("pending_agents", [])],
                },
            )
        self._queued_messages = normalized
        self._rebuild()
        if normalized:
            self.add_class("visible")
        else:
            self.remove_class("visible")

    def has_messages(self) -> bool:
        """Return True when queue banner has message rows to display."""
        return bool(self._queued_messages)

    def set_text(self, text: str) -> None:
        """Set a single queued message (replaces all). For backwards compatibility.

        Args:
            text: The queued human input text to display
        """
        self._queued_messages = [
            {
                "id": None,
                "content": text,
                "target_label": "all agents",
                "source_label": "human",
                "pending_agents": [],
            },
        ]
        self._rebuild()
        self.add_class("visible")

    def set_pending_counts(self, counts: dict[str, int]) -> None:
        """Update per-agent pending counts displayed in the banner."""
        self._pending_counts = {aid: int(count) for aid, count in counts.items() if int(count) > 0}
        self._rebuild()

    def clear(self) -> None:
        """Clear all messages and hide the banner."""
        self._queued_messages.clear()
        self._pending_counts.clear()
        self.update("")
        self.remove_class("visible")

    def _rebuild(self) -> None:
        """Rebuild the banner content."""
        if not self._queued_messages:
            self.update("")
            return

        def _compact_preview(raw_text: str, *, max_len: int) -> str:
            single_line = " ".join(raw_text.split())
            if len(single_line) <= max_len:
                return single_line
            return single_line[: max_len - 3] + "..."

        content = Text()
        count = len(self._queued_messages)
        pending_summary = ""
        if self._pending_counts:
            # Keep summary compact and deterministic.
            ordered = sorted(self._pending_counts.items(), key=lambda item: item[0])
            parts = [f"{aid}:{cnt}" for aid, cnt in ordered]
            pending_summary = f" | pending: {', '.join(parts)}"

        if count == 1:
            # Single message - show preview
            message = self._queued_messages[0]
            message_id = message.get("id")
            display_text = _compact_preview(str(message.get("content", "")), max_len=52)
            target_label = message.get("target_label", "all agents")
            source_label = str(message.get("source_label", "human"))
            pending_agents = [str(aid) for aid in message.get("pending_agents", [])]
            pending_agent_label = ",".join(pending_agents) if pending_agents else ""

            content.append("📝 ", style="bold yellow")
            content.append("Queued", style="bold")
            if message_id is not None:
                content.append(f" #{message_id}", style="bold")
            content.append(": ", style="bold")
            content.append(f'"{display_text}"', style="italic")
            content.append(f" (source: {source_label}, target: {target_label})", style="dim")
            if pending_agent_label:
                content.append(f" [pending: {pending_agent_label}]", style="dim")
            if pending_summary:
                content.append(pending_summary, style="dim")
        else:
            # Multiple messages - compact summary with latest entry preview.
            latest = self._queued_messages[-1]
            latest_target = str(latest.get("target_label", "all agents"))
            latest_source = str(latest.get("source_label", "human"))
            latest_id = latest.get("id")
            latest_preview = _compact_preview(str(latest.get("content", "")), max_len=44)
            latest_pending_agents = [str(aid) for aid in latest.get("pending_agents", [])]
            latest_pending_label = ",".join(latest_pending_agents) if latest_pending_agents else ""

            content.append("📝 ", style="bold yellow")
            content.append(f"{count} messages queued", style="bold")
            if pending_summary:
                content.append(pending_summary, style="dim")
            content.append(" | ", style="dim")
            if latest_id is not None:
                content.append(f"latest #{latest_id} ", style="dim")
            else:
                content.append("latest ", style="dim")
            content.append(f"[{latest_source} -> {latest_target}] ", style="dim")
            content.append(latest_preview, style="italic")
            if latest_pending_label:
                content.append(f" [pending: {latest_pending_label}]", style="dim")

        self.update(content)

```

### Core Architecture Module: `massgen/frontend/displays/textual_widgets/result_renderer.py`
```
"""
Result Renderer for MassGen TUI.

Smart formatting of tool results with content type detection,
syntax highlighting, and truncation.
"""

import json
import re

from rich.console import Group, RenderableType
from rich.syntax import Syntax
from rich.text import Text


class ResultRenderer:
    """Smart renderer for tool results with content type detection and formatting."""

    # Maximum lines before truncation
    MAX_LINES = 50
    # Maximum characters before truncation
    MAX_CHARS = 5000

    # Content type detection patterns
    JSON_PATTERN = re.compile(r"^\s*[\[{]")
    PYTHON_PATTERN = re.compile(r"^(def |class |import |from |if __name__|@)")
    MARKDOWN_PATTERN = re.compile(r"^(#{1,6} |```|\*\*|__|\[.*\]\()")
    XML_PATTERN = re.compile(r"^\s*<\?xml|^\s*<[a-zA-Z]")
    YAML_PATTERN = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*:\s*")
    SHELL_PATTERN = re.compile(r"^\s*(#!|export |echo |cd |ls |grep |find |sudo )")

    @classmethod
    def render(
        cls,
        content: str | None,
        force_type: str | None = None,
        max_lines: int | None = None,
        max_chars: int | None = None,
    ) -> tuple[RenderableType, bool]:
        """Render content with appropriate formatting.

        Args:
            content: The content to render
            force_type: Force a specific content type (json, python, etc.)
            max_lines: Override default max lines
            max_chars: Override default max chars

        Returns:
            Tuple of (rendered content, was_truncated)
        """
        if not content:
            return Text("(no content)", style="dim italic"), False

        max_lines = max_lines or cls.MAX_LINES
        max_chars = max_chars or cls.MAX_CHARS

        # Detect content type
        content_type = force_type or cls.detect_type(content)

        # Pre-process content based on type
        processed_content, was_truncated = cls._truncate(content, max_lines, max_chars)

        # Format based on type
        if content_type == "json":
            rendered = cls._render_json(processed_content)
        elif content_type in ("python", "py"):
            rendered = cls._render_syntax(processed_content, "python")
        elif content_type in ("javascript", "js"):
            rendered = cls._render_syntax(processed_content, "javascript")
        elif content_type in ("typescript", "ts"):
            rendered = cls._render_syntax(processed_content, "typescript")
        elif content_type == "markdown":
            rendered = cls._render_syntax(processed_content, "markdown")
        elif content_type == "yaml":
            rendered = cls._render_syntax(processed_content, "yaml")
        elif content_type == "xml":
            rendered = cls._render_syntax(processed_content, "xml")
        elif content_type == "shell":
            rendered = cls._render_syntax(processed_content, "bash")
        else:
            rendered = cls._render_plain(processed_content)

        # Add truncation indicator if needed
        if was_truncated:
            lines = content.count("\n") + 1
            chars = len(content)
            truncation_note = Text(
                f"\n... truncated ({lines} lines, {chars} chars total)",
                style="dim italic",
            )
            rendered = Group(rendered, truncation_note)

        return rendered, was_truncated

    @classmethod
    def detect_type(cls, content: str) -> str:
        """Detect the content type from the content.

        Args:
            content: Content to analyze

        Returns:
            Detected type string
        """
        content_stripped = content.strip()

        # Check for JSON
        if cls.JSON_PATTERN.match(content_stripped):
            try:
                json.loads(content_stripped)
                return "json"
            except json.JSONDecodeError:
                pass

        # Check first few lines for patterns
        first_lines = "\n".join(content_stripped.split("\n")[:5])

        if cls.PYTHON_PATTERN.search(first_lines):
            return "python"
        if cls.XML_PATTERN.match(content_stripped):
            return "xml"
        if cls.YAML_PATTERN.match(content_stripped):
            return "yaml"
        if cls.SHELL_PATTERN.search(first_lines):
            return "shell"
        if cls.MARKDOWN_PATTERN.search(first_lines):
            return "markdown"

        return "text"

    @classmethod
    def _truncate(
        cls,
        content: str,
        max_lines: int,
        max_chars: int,
    ) -> tuple[str, bool]:
        """Truncate content if needed.

        Args:
            content: Content to truncate
            max_lines: Maximum number of lines
            max_chars: Maximum number of characters

        Returns:
            Tuple of (truncated content, was_truncated)
        """
        was_truncated = False

        # Truncate by characters first
        if len(content) > max_chars:
            content = content[:max_chars]
            was_truncated = True

        # Truncate by lines
        lines = content.split("\n")
        if len(lines) > max_lines:
            content = "\n".join(lines[:max_lines])
            was_truncated = True

        return content, was_truncated

    @classmethod
    def _render_json(cls, content: str) -> RenderableType:
        """Render JSON content with pretty-printing and syntax highlighting.

        Args:
            content: JSON content

        Returns:
            Rendered JSON
        """
        try:
            # Parse and pretty-print
            parsed = json.loads(content)
            formatted = json.dumps(parsed, indent=2, ensure_ascii=False)
            return Syntax(
                formatted,
                "json",
                theme="monokai",
                line_numbers=False,
                word_wrap=True,
            )
        except json.JSONDecodeError:
            # Fall back to plain rendering if JSON is invalid
            return cls._render_syntax(content, "json")

    @classmethod
    def _render_syntax(cls, content: str, language: str) -> Syntax:
        """Render content with syntax highlighting.

        Args:
            content: Content to render
            language: Language for syntax highlighting

        Returns:
            Syntax object
        """
        return Syntax(
            content,
            language,
            theme="monokai",
            line_numbers=False,
            word_wrap=True,
        )

    @classmethod
    def _render_plain(cls, content: str) -> Text:
        """Render content as plain text.

        Args:
            content: Content to render

        Returns:
            Text object
        """
        return Text(content)

    @classmethod
    def format_preview(
        cls,
        content: str | None,
        max_length: int = 100,
    ) -> str:
        """Format a short preview of content for inline display.

        Args:
            content: Content to preview
            max_length: Maximum length of preview

        Returns:
            Preview string
        """
        if not content:
            return "(no content)"

        # Collapse whitespace and newlines
        preview = " ".join(content.split())

        if len(preview) > max_length:
            return preview[: max_length - 3] + "..."

        return preview

    @classmethod
    def get_content_summary(cls, content: str | None) -> str:
        """Get a summary of content (type, lines, chars).

        Args:
            content: Content to summarize

        Returns:
            Summary string
        """
        if not content:
            return "empty"

        content_type = cls.detect_type(content)
        lines = content.count("\n") + 1
        chars = len(content)

        return f"{content_type} ({lines} lines, {chars} chars)"

```

### Core Architecture Module: `massgen/frontend/web/static/assets/consoleHook-59e792cb-F-XschFW.js`
```
import{as as h,at as M}from"./index-CdGHRb-_.js";var k=(function(){function t(){this.listeners={},this.listenersCount=0,this.channelId=Math.floor(Math.random()*1e6),this.listeners=[]}return t.prototype.cleanup=function(){this.listeners={},this.listenersCount=0},t.prototype.dispatch=function(r){Object.values(this.listeners).forEach(function(e){return e(r)})},t.prototype.listener=function(r){var e=this;if(typeof r!="function")return function(){};var s=this.listenersCount;return this.listeners[s]=r,this.listenersCount++,function(){delete e.listeners[s]}},t})();function v(t){return/[a-zA-Z.]/.test(t)}function b(t){return/[a-zA-Z]/.test(t)}function S(t){return/\s/.test(t)}function y(t){return/[&|]/.test(t)}function g(t){return/-/.test(t)}function w(t){return/["']/.test(t)}function _(t){return b(t)&&t===t.toUpperCase()}var a;(function(t){t.OR="OR",t.AND="AND",t.PIPE="PIPE",t.Command="Command",t.Argument="Argument",t.String="String",t.EnvVar="EnvVar"})(a||(a={}));var O=new Map([["&&",{type:a.AND}],["||",{type:a.OR}],["|",{type:a.PIPE}],["-",{type:a.Argument}]]);function E(t){var r=0,e=[];function s(){for(var n="";v(t[r])&&r<t.length;)n+=t[r],r++;return{type:a.Command,value:n}}function f(){for(var n="";y(t[r])&&r<t.length;)n+=t[r],r++;return O.get(n)}function d(){for(var n="";(g(t[r])||b(t[r]))&&r<t.length;)n+=t[r],r++;return{type:a.Argument,value:n}}function c(){var n=t[r],u=t[r];for(r++;t[r]!==n&&r<t.length;)u+=t[r],r++;return u+=t[r],r++,{type:a.String,value:u}}function p(){for(var n={},u=function(){for(var l="",o="";t[r]!=="="&&r<t.length;)l+=t[r],r++;for(t[r]==="="&&r++;t[r]!==" "&&r<t.length;)o+=t[r],r++;n[l]=o};_(t[r])&&r<t.length;)u(),r++;return{type:a.EnvVar,value:n}}for(;r<t.length;){var i=t[r];if(S(i)){r++;continue}switch(!0){case _(i):e.push(p());break;case v(i):e.push(s());break;case y(i):e.push(f());break;case g(i):e.push(d());break;case w(i):e.push(c());break;default:throw new Error("Unknown character: ".concat(i))}}return e}var T=0;function z(){var t=Date.now(),r=Math.round(Math.random()*1e4),e=T+=1;return(+"".concat(t).concat(r).concat(e)).toString(16)}var A=function(t){return typeof t=="string"?new TextEncoder().encode(t):t},C=function(t){return typeof t=="string"?t:new TextDecoder().decode(t)},D=function(t){return Object.entries(t).reduce(function(r,e){var s=e[0],f=e[1];return r[s]=A(f.code),r},{})},I=function(t){var r={},e=["dev","start"];try{r=JSON.parse(t).scripts}catch(c){throw h("Could not parse package.json file: "+c.message)}M(r,"Failed to start. Please provide a `start` or `dev` script on the package.json");for(var s=function(c){if(e[c]in r){var p=e[c],i=r[p],n={},u="",l=[];return E(i).forEach(function(o){var m=u==="";o.type===a.EnvVar&&(n=o.value),o.type===a.Command&&m&&(u=o.value),(o.type===a.Argument||!m&&o.type===a.Command)&&l.push(o.value)}),{value:[u,l,{env:n}]}}},f=0;f<e.length;f++){var d=s(f);if(typeof d=="object")return d.value}throw h("Failed to start. Please provide a `start` or `dev` script on the package.json")},N=function(t){return typeof t=="string"?t:typeof t=="object"&&"message"in t?t.message:h("The server could not be reached. Make sure that the node script is running and that a port has been started.")},P=`var t="undefined"!=typeof globalThis?globalThis:"undefined"!=typeof window?window:"undefined"!=typeof globalThis?globalThis:"undefined"!=typeof self?self:{};function r(t){return t&&t.__esModule&&Object.prototype.hasOwnProperty.call(t,"default")?t.default:t}var e={},n={};!function(t){t.__esModule=!0,t.default=["log","debug","info","warn","error","table","clear","time","timeEnd","count","assert","command","result"]}(n);var a,o={},i={};(a=i).__esModule=!0,a.default=function(){var t=function(){return(65536*(1+Math.random())|0).toString(16).substring(1)};return t()+t()+"-"+t()+"-"+t()+"-"+t()+"-"+t()+"-"+Date.now()};var u={},s={__esModule:!0};s.update=s.state=void 0,s.update=function(t){s.state=t};var f={},c={};!function(r){var e=t&&t.__assign||function(){return e=Object.assign||function(t){for(var r,e=1,n=arguments.length;e<n;e++)for(var a in r=arguments[e])Object.prototype.hasOwnProperty.call(r,a)&&(t[a]=r[a]);return t},e.apply(this,arguments)};r.__esModule=!0,r.initialState=void 0,r.initialState={timings:{},count:{}};var n=function(){return"undefined"!=typeof performance&&performance.now?performance.now():Date.now()};r.default=function(t,a){var o,i,u;switch(void 0===t&&(t=r.initialState),a.type){case"COUNT":var s=t.count[a.name]||0;return e(e({},t),{count:e(e({},t.count),(o={},o[a.name]=s+1,o))});case"TIME_START":return e(e({},t),{timings:e(e({},t.timings),(i={},i[a.name]={start:n()},i))});case"TIME_END":var f=t.timings[a.name],c=n(),l=c-f.start;return e(e({},t),{timings:e(e({},t.timings),(u={},u[a.name]=e(e({},f),{end:c,time:l}),u))});default:return t}}}(c),function(r){var e=t&&t.__importDefault||function(t){return t&&t.__esModule?t:{default:t}};r.__esModule=!0;var n=e(c),a=s;r.default=function(t){a.update(n.default(a.state,t))}}(f);var l={__esModule:!0};l.timeEnd=l.timeStart=l.count=void 0,l.count=function(t){return{type:"COUNT",name:t}},l.timeStart=function(t){return{type:"TIME_START",name:t}},l.timeEnd=function(t){return{type:"TIME_END",name:t}};var d=t&&t.__importDefault||function(t){return t&&t.__esModule?t:{default:t}};u.__esModule=!0,u.stop=u.start=void 0;var p=s,h=d(f),m=l;u.start=function(t){h.default(m.timeStart(t))},u.stop=function(t){var r=null===p.state||void 0===p.state?void 0:p.state.timings[t];return r&&!r.end?(h.default(m.timeEnd(t)),{method:"log",data:[t+": "+p.state.timings[t].time+"ms"]}):{method:"warn",data:["Timer '"+t+"' does not exist"]}};var y={},v=t&&t.__importDefault||function(t){return t&&t.__esModule?t:{default:t}};y.__esModule=!0,y.increment=void 0;var _=s,b=v(f),g=l;y.increment=function(t){return b.default(g.count(t)),{method:"log",data:[t+": "+_.state.count[t]]}};var M={},T=t&&t.__spreadArrays||function(){for(var t=0,r=0,e=arguments.length;r<e;r++)t+=arguments[r].length;var n=Array(t),a=0;for(r=0;r<e;r++)for(var o=arguments[r],i=0,u=o.length;i<u;i++,a++)n[a]=o[i];return n};M.__esModule=!0,M.test=void 0,M.test=function(t){for(var r=[],e=1;e<arguments.length;e++)r[e-1]=arguments[e];return!t&&(0===r.length&&r.push("console.assert"),{method:"error",data:T(["Assertion failed:"],r)})},function(r){var e=t&&t.__assign||function(){return e=Object.assign||function(t){for(var r,e=1,n=arguments.length;e<n;e++)for(var a in r=arguments[e])Object.prototype.hasOwnProperty.call(r,a)&&(t[a]=r[a]);return t},e.apply(this,arguments)},n=t&&t.__createBinding||(Object.create?function(t,r,e,n){void 0===n&&(n=e),Object.defineProperty(t,n,{enumerable:!0,get:function(){return r[e]}})}:function(t,r,e,n){void 0===n&&(n=e),t[n]=r[e]}),a=t&&t.__setModuleDefault||(Object.create?function(t,r){Object.defineProperty(t,"default",{enumerable:!0,value:r})}:function(t,r){t.default=r}),o=t&&t.__importStar||function(t){if(t&&t.__esModule)return t;var r={};if(null!=t)for(var e in t)"default"!==e&&Object.prototype.hasOwnProperty.call(t,e)&&n(r,t,e);return a(r,t),r},s=t&&t.__spreadArrays||function(){for(var t=0,r=0,e=arguments.length;r<e;r++)t+=arguments[r].length;var n=Array(t),a=0;for(r=0;r<e;r++)for(var o=arguments[r],i=0,u=o.length;i<u;i++,a++)n[a]=o[i];return n},f=t&&t.__importDefault||function(t){return t&&t.__esModule?t:{default:t}};r.__esModule=!0;var c=f(i),l=o(u),d=o(y),p=o(M);r.default=function(t,r,n){var a=n||c.default();switch(t){case"clear":return{method:t,id:a};case"count":return!!(o="string"==typeof r[0]?r[0]:"default")&&e(e({},d.increment(o)),{id:a});case"time":case"timeEnd":var o;return!!(o="string"==typeof r[0]?r[0]:"default")&&("time"===t?(l.start(o),!1):e(e({},l.stop(o)),{id:a}));case"assert":if(0!==r.length){var i=p.test.apply(p,s([r[0]],r.slice(1)));if(i)return e(e({},i),{id:a})}return!1;case"error":return{method:t,id:a,data:r.map((function(t){try{return t.stack||t}catch(r){return t}}))};default:return{method:t,id:a,data:r}}}}(o);var S={},O={};!function(t){var r;t.__esModule=!0,function(t){t[t.infinity=0]="infinity",t[t.minusInfinity=1]="minusInfinity",t[t.minusZero=2]="minusZero"}(r||(r={})),t.default={type:"Arithmetic",lookup:Number,shouldTransform:function(t,r){return"number"===t&&(r===1/0||r===-1/0||function(t){return 1/t==-1/0}(r))},toSerializable:function(t){return t===1/0?r.infinity:t===-1/0?r.minusInfinity:r.minusZero},fromSerializable:function(t){return t===r.infinity?1/0:t===r.minusInfinity?-1/0:t===r.minusZero?-0:t}}}(O);var w={};!function(t){t.__esModule=!0,t.default={type:"Function",lookup:Function,shouldTransform:function(t,r){return"function"==typeof r},toSerializable:function(t){var r="";try{r=t.toString().substring(r.indexOf("{")+1,r.lastIndexOf("}"))}catch(t){}return{name:t.name,body:r,proto:Object.getPrototypeOf(t).constructor.name}},fromSerializable:function(t){try{var r=function(){};return"string"==typeof t.name&&Object.defineProperty(r,"name",{value:t.name,writable:!1}),"string"==typeof t.body&&Object.defineProperty(r,"body",{value:t.body,writable:!1}),"string"==typeof t.proto&&(r.constructor={name:t.proto}),r}catch(r){return t}}}}(w);var A={};!function(t){var r;function e(t){for(var r={},e=0,n=t.attributes;e<n.length;e++){var a=n[e];r[a.name]=a.value}return r}t.__esModule=!0,t.default={type:"HTMLElement",shouldTransform:function(t,r){return r&&r.children&&"string"==typeof r.innerHTML&&"string"==typeof r.tagName},toSerializable:function(t){return{tagName:t.tagName.toLowerCase(),attributes:e(t),innerHTML:t.innerHTML}},fromSerializable:function(t){try{var e=(r||(r=document.implementation.createHTMLDocument("sandbox"))).createElement(t.tagName);e.innerHTML=t.innerHTML;for(var n=0,a=Object.keys(t.attributes);n<a.length;n++){var o=a[n];try{e.setAttribute(o,t.attributes[o])}catch(t){}}return e}catch(r){return t}}}}(A);var j={};!function(r){var e=t&&t.__assign||function(){return e=Object.assign||function(t){for(var r,e=1,n=arguments.length;e<n;e++)for(var a in r=arguments[e])Object.prototype.hasOwnProperty.call(r,a)&&(t[a]=r[a]);return t},e.apply
```

### Core Architecture Module: `massgen/frontend/web/static/assets/stateDiagram-FKZM4ZOC-DuNuMMAV.js`
```
import{s as G,a as W,S as N}from"./chunk-DI55MBZ5-Co10LqGQ.js";import{_ as f,c as t,d as H,l as S,e as P,k as z,R as _,S as U,O as C,u as F}from"./index-CdGHRb-_.js";import{G as O}from"./graph-B3OtINlz.js";import{l as J}from"./layout-CbiS3xAA.js";import"./chunk-55IACEB6-CF4EkuUD.js";import"./chunk-QN33PNHL-CIQ8Cdte.js";import"./_baseUniq-CxOtW_1c.js";import"./min-9YIowWJM.js";var X=f(e=>e.append("circle").attr("class","start-state").attr("r",t().state.sizeUnit).attr("cx",t().state.padding+t().state.sizeUnit).attr("cy",t().state.padding+t().state.sizeUnit),"drawStartState"),D=f(e=>e.append("line").style("stroke","grey").style("stroke-dasharray","3").attr("x1",t().state.textHeight).attr("class","divider").attr("x2",t().state.textHeight*2).attr("y1",0).attr("y2",0),"drawDivider"),Y=f((e,i)=>{const d=e.append("text").attr("x",2*t().state.padding).attr("y",t().state.textHeight+2*t().state.padding).attr("font-size",t().state.fontSize).attr("class","state-title").text(i.id),c=d.node().getBBox();return e.insert("rect",":first-child").attr("x",t().state.padding).attr("y",t().state.padding).attr("width",c.width+2*t().state.padding).attr("height",c.height+2*t().state.padding).attr("rx",t().state.radius),d},"drawSimpleState"),I=f((e,i)=>{const d=f(function(g,B,m){const E=g.append("tspan").attr("x",2*t().state.padding).text(B);m||E.attr("dy",t().state.textHeight)},"addTspan"),n=e.append("text").attr("x",2*t().state.padding).attr("y",t().state.textHeight+1.3*t().state.padding).attr("font-size",t().state.fontSize).attr("class","state-title").text(i.descriptions[0]).node().getBBox(),l=n.height,x=e.append("text").attr("x",t().state.padding).attr("y",l+t().state.padding*.4+t().state.dividerMargin+t().state.textHeight).attr("class","state-description");let a=!0,s=!0;i.descriptions.forEach(function(g){a||(d(x,g,s),s=!1),a=!1});const w=e.append("line").attr("x1",t().state.padding).attr("y1",t().state.padding+l+t().state.dividerMargin/2).attr("y2",t().state.padding+l+t().state.dividerMargin/2).attr("class","descr-divider"),p=x.node().getBBox(),o=Math.max(p.width,n.width);return w.attr("x2",o+3*t().state.padding),e.insert("rect",":first-child").attr("x",t().state.padding).attr("y",t().state.padding).attr("width",o+2*t().state.padding).attr("height",p.height+l+2*t().state.padding).attr("rx",t().state.radius),e},"drawDescrState"),$=f((e,i,d)=>{const c=t().state.padding,n=2*t().state.padding,l=e.node().getBBox(),x=l.width,a=l.x,s=e.append("text").attr("x",0).attr("y",t().state.titleShift).attr("font-size",t().state.fontSize).attr("class","state-title").text(i.id),p=s.node().getBBox().width+n;let o=Math.max(p,x);o===x&&(o=o+n);let g;const B=e.node().getBBox();i.doc,g=a-c,p>x&&(g=(x-o)/2+c),Math.abs(a-B.x)<c&&p>x&&(g=a-(p-x)/2);const m=1-t().state.textHeight;return e.insert("rect",":first-child").attr("x",g).attr("y",m).attr("class",d?"alt-composit":"composit").attr("width",o).attr("height",B.height+t().state.textHeight+t().state.titleShift+1).attr("rx","0"),s.attr("x",g+c),p<=x&&s.attr("x",a+(o-n)/2-p/2+c),e.insert("rect",":first-child").attr("x",g).attr("y",t().state.titleShift-t().state.textHeight-t().state.padding).attr("width",o).attr("height",t().state.textHeight*3).attr("rx",t().state.radius),e.insert("rect",":first-child").attr("x",g).attr("y",t().state.titleShift-t().state.textHeight-t().state.padding).attr("width",o).attr("height",B.height+3+2*t().state.textHeight).attr("rx",t().state.radius),e},"addTitleAndBox"),q=f(e=>(e.append("circle").attr("class","end-state-outer").attr("r",t().state.sizeUnit+t().state.miniPadding).attr("cx",t().state.padding+t().state.sizeUnit+t().state.miniPadding).attr("cy",t().state.padding+t().state.sizeUnit+t().state.miniPadding),e.append("circle").attr("class","end-state-inner").attr("r",t().state.sizeUnit).attr("cx",t().state.padding+t().state.sizeUnit+2).attr("cy",t().state.padding+t().state.sizeUnit+2)),"drawEndState"),Z=f((e,i)=>{let d=t().state.forkWidth,c=t().state.forkHeight;if(i.parentId){let n=d;d=c,c=n}return e.append("rect").style("stroke","black").style("fill","black").attr("width",d).attr("height",c).attr("x",t().state.padding).attr("y",t().state.padding)},"drawForkJoinState"),j=f((e,i,d,c)=>{let n=0;const l=c.append("text");l.style("text-anchor","start"),l.attr("class","noteText");let x=e.replace(/\r\n/g,"<br/>");x=x.replace(/\n/g,"<br/>");const a=x.split(z.lineBreakRegex);let s=1.25*t().state.noteMargin;for(const w of a){const p=w.trim();if(p.length>0){const o=l.append("tspan");if(o.text(p),s===0){const g=o.node().getBBox();s+=g.height}n+=s,o.attr("x",i+t().state.noteMargin),o.attr("y",d+n+1.25*t().state.noteMargin)}}return{textWidth:l.node().getBBox().width,textHeight:n}},"_drawLongText"),K=f((e,i)=>{i.attr("class","state-note");const d=i.append("rect").attr("x",0).attr("y",t().state.padding),c=i.append("g"),{textWidth:n,textHeight:l}=j(e,0,0,c);return d.attr("height",l+2*t().state.noteMargin),d.attr("width",n+t().state.noteMargin*2),d},"drawNote"),L=f(function(e,i){const d=i.id,c={id:d,label:i.id,width:0,height:0},n=e.append("g").attr("id",d).attr("class","stateGroup");i.type==="start"&&X(n),i.type==="end"&&q(n),(i.type==="fork"||i.type==="join")&&Z(n,i),i.type==="note"&&K(i.note.text,n),i.type==="divider"&&D(n),i.type==="default"&&i.descriptions.length===0&&Y(n,i),i.type==="default"&&i.descriptions.length>0&&I(n,i);const l=n.node().getBBox();return c.width=l.width+2*t().state.padding,c.height=l.height+2*t().state.padding,c},"drawState"),R=0,Q=f(function(e,i,d){const c=f(function(s){switch(s){case N.relationType.AGGREGATION:return"aggregation";case N.relationType.EXTENSION:return"extension";case N.relationType.COMPOSITION:return"composition";case N.relationType.DEPENDENCY:return"dependency"}},"getRelationType");i.points=i.points.filter(s=>!Number.isNaN(s.y));const n=i.points,l=_().x(function(s){return s.x}).y(function(s){return s.y}).curve(U),x=e.append("path").attr("d",l(n)).attr("id","edge"+R).attr("class","transition");let a="";if(t().state.arrowMarkerAbsolute&&(a=C(!0)),x.attr("marker-end","url("+a+"#"+c(N.relationType.DEPENDENCY)+"End)"),d.title!==void 0){const s=e.append("g").attr("class","stateLabel"),{x:w,y:p}=F.calcLabelPosition(i.points),o=z.getRows(d.title);let g=0;const B=[];let m=0,E=0;for(let u=0;u<=o.length;u++){const h=s.append("text").attr("text-anchor","middle").text(o[u]).attr("x",w).attr("y",p+g),y=h.node().getBBox();m=Math.max(m,y.width),E=Math.min(E,y.x),S.info(y.x,w,p+g),g===0&&(g=h.node().getBBox().height,S.info("Title height",g,p)),B.push(h)}let k=g*o.length;if(o.length>1){const u=(o.length-1)*g*.5;B.forEach((h,y)=>h.attr("y",p+y*g-u)),k=g*o.length}const r=s.node().getBBox();s.insert("rect",":first-child").attr("class","box").attr("x",w-m/2-t().state.padding/2).attr("y",p-k/2-t().state.padding/2-3.5).attr("width",m+t().state.padding).attr("height",k+t().state.padding),S.info(r)}R++},"drawEdge"),b,T={},V=f(function(){},"setConf"),tt=f(function(e){e.append("defs").append("marker").attr("id","dependencyEnd").attr("refX",19).attr("refY",7).attr("markerWidth",20).attr("markerHeight",28).attr("orient","auto").append("path").attr("d","M 19,7 L9,13 L14,7 L9,1 Z")},"insertMarkers"),et=f(function(e,i,d,c){b=t().state;const n=t().securityLevel;let l;n==="sandbox"&&(l=H("#i"+i));const x=n==="sandbox"?H(l.nodes()[0].contentDocument.body):H("body"),a=n==="sandbox"?l.nodes()[0].contentDocument:document;S.debug("Rendering diagram "+e);const s=x.select(`[id='${i}']`);tt(s);const w=c.db.getRootDoc();A(w,s,void 0,!1,x,a,c);const p=b.padding,o=s.node().getBBox(),g=o.width+p*2,B=o.height+p*2,m=g*1.75;P(s,B,m,b.useMaxWidth),s.attr("viewBox",`${o.x-b.padding}  ${o.y-b.padding} `+g+" "+B)},"draw"),at=f(e=>e?e.length*b.fontSizeFactor:1,"getLabelWidth"),A=f((e,i,d,c,n,l,x)=>{const a=new O({compound:!0,multigraph:!0});let s,w=!0;for(s=0;s<e.length;s++)if(e[s].stmt==="relation"){w=!1;break}d?a.setGraph({rankdir:"LR",multigraph:!0,compound:!0,ranker:"tight-tree",ranksep:w?1:b.edgeLengthFactor,nodeSep:w?1:50,isMultiGraph:!0}):a.setGraph({rankdir:"TB",multigraph:!0,compound:!0,ranksep:w?1:b.edgeLengthFactor,nodeSep:w?1:50,ranker:"tight-tree",isMultiGraph:!0}),a.setDefaultEdgeLabel(function(){return{}});const p=x.db.getStates(),o=x.db.getRelations(),g=Object.keys(p);for(const r of g){const u=p[r];d&&(u.parentId=d);let h;if(u.doc){let y=i.append("g").attr("id",u.id).attr("class","stateGroup");h=A(u.doc,y,u.id,!c,n,l,x);{y=$(y,u,c);let v=y.node().getBBox();h.width=v.width,h.height=v.height+b.padding/2,T[u.id]={y:b.compositTitleSize}}}else h=L(i,u,a);if(u.note){const y={descriptions:[],id:u.id+"-note",note:u.note,type:"note"},v=L(i,y,a);u.note.position==="left of"?(a.setNode(h.id+"-note",v),a.setNode(h.id,h)):(a.setNode(h.id,h),a.setNode(h.id+"-note",v)),a.setParent(h.id,h.id+"-group"),a.setParent(h.id+"-note",h.id+"-group")}else a.setNode(h.id,h)}S.debug("Count=",a.nodeCount(),a);let B=0;o.forEach(function(r){B++,S.debug("Setting edge",r),a.setEdge(r.id1,r.id2,{relation:r,width:at(r.title),height:b.labelHeight*z.getRows(r.title).length,labelpos:"c"},"id"+B)}),J(a),S.debug("Graph after layout",a.nodes());const m=i.node();a.nodes().forEach(function(r){r!==void 0&&a.node(r)!==void 0?(S.warn("Node "+r+": "+JSON.stringify(a.node(r))),n.select("#"+m.id+" #"+r).attr("transform","translate("+(a.node(r).x-a.node(r).width/2)+","+(a.node(r).y+(T[r]?T[r].y:0)-a.node(r).height/2)+" )"),n.select("#"+m.id+" #"+r).attr("data-x-shift",a.node(r).x-a.node(r).width/2),l.querySelectorAll("#"+m.id+" #"+r+" .divider").forEach(h=>{const y=h.parentElement;let v=0,M=0;y&&(y.parentElement&&(v=y.parentElement.getBBox().width),M=parseInt(y.getAttribute("data-x-shift"),10),Number.isNaN(M)&&(M=0)),h.setAttribute("x1",0-M+8),h.setAttribute("x2",v-M-8)})):S.debug("No Node "+r+": "+JSON.stringify(a.node(r)))});let E=m.getBBox();a.edges().forEach(function(r){r!==void 0&&a.edge(r)!==void 0&&(S.debug("Edge "+r.v+" -> "+r.w+": "+JSON.stringify(a.edge(r))),Q(i,a.edge(r),a.edge(r).relation))}),E=m.getBBox();const k={id:d||"root"
```

### Core Architecture Module: `massgen/frontend/web/static/assets/stateDiagram-v2-4FDKWEC3-CXTRUg6C.js`
```
import{s as t,b as r,a,S as s}from"./chunk-DI55MBZ5-Co10LqGQ.js";import{_ as i}from"./index-CdGHRb-_.js";import"./chunk-55IACEB6-CF4EkuUD.js";import"./chunk-QN33PNHL-CIQ8Cdte.js";var l={parser:a,get db(){return new s(2)},renderer:r,styles:t,init:i(e=>{e.state||(e.state={}),e.state.arrowMarkerAbsolute=e.arrowMarkerAbsolute},"init")};export{l as diagram};
//# sourceMappingURL=stateDiagram-v2-4FDKWEC3-CXTRUg6C.js.map

```

### Core Architecture Module: `massgen/mcp_tools/backend_utils.py`
```
"""
Backend utilities for MCP integration.
Contains all utilities that backends need for MCP functionality.
"""

from __future__ import annotations

import asyncio
import json
import random
import time
from collections.abc import AsyncGenerator, Awaitable, Callable
from typing import Any, Literal

from ..logger_config import log_mcp_activity, logger

# Module-level constants
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_BASE_DELAY = 0.5
DEFAULT_RETRY_JITTER_MIN = 0.1
DEFAULT_RETRY_JITTER_MAX = 0.3
DEFAULT_MESSAGE_HISTORY_LIMIT = 200
DEFAULT_TIMEOUT_SECONDS = 30
DEFAULT_CIRCUIT_BREAKER_MAX_FAILURES = 3
DEFAULT_CIRCUIT_BREAKER_RESET_TIME = 30
DEFAULT_CIRCUIT_BREAKER_BACKOFF_MULTIPLIER = 2
DEFAULT_CIRCUIT_BREAKER_MAX_BACKOFF_MULTIPLIER = 8

# Import MCP exceptions
try:
    from .circuit_breaker import CircuitBreakerConfig
    from .client import MCPClient
    from .exceptions import (
        MCPAuthenticationError,
        MCPConfigurationError,
        MCPConnectionError,
        MCPError,
        MCPResourceError,
        MCPServerError,
        MCPTimeoutError,
        MCPValidationError,
    )
except ImportError:
    MCPError = Exception
    MCPConnectionError = ConnectionError
    MCPTimeoutError = TimeoutError
    MCPServerError = Exception
    MCPValidationError = ValueError
    MCPAuthenticationError = Exception
    MCPResourceError = Exception
    MCPConfigurationError = Exception
    CircuitBreakerConfig = None
    MCPClient = None

# Import hook system
try:
    from .hooks import FunctionHook, HookType
except ImportError:
    HookType = None
    FunctionHook = None


class Function:
    """Enhanced function wrapper for MCP tools across all backend APIs."""

    def __init__(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any],
        entrypoint: Callable[[str], Awaitable[Any]],
        hooks: dict | None = None,
    ) -> None:
        # Validate and sanitize inputs
        self.name = name if name else "unknown_function"
        self.description = description if description and isinstance(description, str) else f"Function: {self.name}"
        self.parameters = parameters if parameters and isinstance(parameters, dict) else {"type": "object", "properties": {}}
        self.entrypoint = entrypoint
        self.hooks = hooks or ({hook_type: [] for hook_type in HookType} if HookType else {})

        # Context for hook execution
        self._backend_name = None
        self._agent_id = None

    async def call(self, input_str: str) -> Any:
        """Call the function with hook integration."""
        # Fast path: no hooks registered
        if not HookType or not self.hooks.get(HookType.PRE_CALL):
            return await self.entrypoint(input_str)

        # Build context for hooks
        context = {"function_name": self.name, "timestamp": time.time(), "backend": self._backend_name or "unknown", "agent_id": self._agent_id}

        # Execute PRE_CALL hooks
        modified_args = input_str
        for hook in self.hooks.get(HookType.PRE_CALL, []):
            try:
                hook_result = await hook.execute(function_name=self.name, arguments=modified_args, context=context)

                # Check if hook blocks execution
                if not hook_result.allowed:
                    # Return proper CallToolResult format matching permission_wrapper.py
                    reason = hook_result.metadata.get("reason", f"Hook '{hook.name}' blocked function call")
                    error_msg = f"Permission denied for tool '{self.name}': {reason}"
                    logger.warning(f"[Function] {error_msg}")

                    # Import MCP types for proper result formatting
                    try:
                        from mcp import types as mcp_types

                        # Return CallToolResult with error flag - same format as permission_wrapper.py
                        return mcp_types.CallToolResult(content=[mcp_types.TextContent(type="text", text=f"Error: {error_msg}")], isError=True)
                    except ImportError:
                        # Fallback if MCP types not available
                        logger.error("MCP types not available, returning string error")
                        return f"Error: {error_msg}"

                # Check if hook modified arguments
                if hook_result.modified_args is not None:
                    modified_args = hook_result.modified_args

            except Exception as e:
                logger.error(f"Hook {hook.name} failed for {self.name}: {e}")

        # Execute the actual function
        return await self.entrypoint(modified_args)

    def to_openai_format(self) -> dict[str, Any]:
        """Convert function to OpenAI Response API format."""
        return {
            "type": "function",
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
        }

    def to_chat_completions_format(self) -> dict[str, Any]:
        """Convert to Chat Completions API format."""
        return {
            "type": "function",
            "function": {
                "name": self.name or "unknown_function",
                "description": self.description or f"Function: {self.name}",
                "parameters": self.parameters or {"type": "object", "properties": {}},
            },
        }

    def to_claude_format(self) -> dict[str, Any]:
        """Convert to Claude API format."""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.parameters,
        }

    def __repr__(self) -> str:
        """String representation of Function."""
        return f"Function(name='{self.name}', description='{self.description[:50]}...')"


class MCPErrorHandler:
    """Standardized MCP error handling utilities."""

    @staticmethod
    def get_error_details(error: Exception, context: str | None = None, *, log: bool = False) -> tuple[str, str, str]:
        """Return standardized MCP error info and optionally log.

        Returns:
            Tuple of (log_type, user_message, error_category)
        """
        if isinstance(error, MCPConnectionError):
            details = ("connection error", "MCP connection failed", "connection")
        elif isinstance(error, MCPTimeoutError):
            details = ("timeout error", "MCP session timeout", "timeout")
        elif isinstance(error, MCPServerError):
            details = ("server error", "MCP server error", "server")
        elif isinstance(error, MCPValidationError):
            details = ("validation error", "MCP validation failed", "validation")
        elif isinstance(error, MCPAuthenticationError):
            details = ("authentication error", "MCP authentication failed", "auth")
        elif isinstance(error, MCPResourceError):
            details = ("resource error", "MCP resource unavailable", "resource")
        elif isinstance(error, MCPError):
            details = ("MCP error", "MCP error", "general")
        else:
            details = ("unexpected error", "MCP connection failed", "unknown")

        if log:
            log_type, user_message, error_category = details
            logger.warning(f"MCP {log_type}: {error}", extra={"context": context or "none"})

        return details

    @staticmethod
    def is_transient_error(error: Exception) -> bool:
        """Determine if an error is transient and should be retried."""
        if isinstance(error, (MCPConnectionError, MCPTimeoutError)):
            return True
        elif isinstance(error, MCPServerError):
            error_str = str(error).lower()
            return any(
                keyword in error_str
                for keyword in [
                    "timeout",
                    "connection",
                    "network",
                    "temporary",
                    "unavailable",
                    "503",
                    "502",
                    "504",
                    "500",
                    "retry",
                ]
            )
        elif isinstance(error, (ConnectionError, TimeoutError, OSError)):
            return True
        elif isinstance(error, MCPResourceError):
            return True
        return False

    @staticmethod
    def log_error(
        error: Exception,
        context: str,
        level: str = "auto",
        backend_name: str | None = None,
        agent_id: str | None = None,
    ) -> None:
        """Log MCP error with appropriate level and context."""
        log_type, user_message, error_category = MCPErrorHandler.get_error_details(error)

        # Auto-determine level
        if level == "auto":
            level = "warning" if error_category in ["connection", "timeout", "resource"] else "error"

        # Single log call with level suffix
        log_message = f"MCP {log_type} during {context}: {error}"
        log_mcp_activity(
            backend_name,
            f"error ({level})",
            {"message": log_message},
            agent_id=agent_id,
        )

    @staticmethod
    def get_retry_delay(attempt: int, base_delay: float = DEFAULT_RETRY_BASE_DELAY) -> float:
        """Calculate retry delay with exponential backoff and jitter."""
        # Exponential backoff
        backoff_delay = base_delay * (2**attempt)

        # Add jitter
        jitter = random.uniform(DEFAULT_RETRY_JITTER_MIN, DEFAULT_RETRY_JITTER_MAX) * backoff_delay

        return backoff_delay + jitter

    @staticmethod
    def is_auth_or_resource_error(error: Exception) -> bool:
        """Check if error is authentication or resource related (non-retryable)."""
        return isinstance(error, (MCPAuthenticationError, MCPResourceError))


class MCPRetryHandler:
    """Handles MCP retry logic with user feedback."""

    @staticmethod
    async def handle_retry_error(
        error: Exception,
        retry_count: int,
        max_retries: int,
        stream_chunk_class,
        backend_name: str 
```

### Core Architecture Module: `massgen/mcp_tools/hook_middleware.py`
```
"""FastMCP middleware for PostToolUse hook injection into MCP tool results.

This middleware reads injection payloads from a file-based IPC channel
and appends them to tool results before returning to the caller (e.g., Codex).

The orchestrator writes hook_post_tool_use.json; the middleware reads and
consumes it. This allows mid-stream injection of peer answers, human input,
and subagent completions without touching individual tool handler code.

File format for hook_post_tool_use.json:
{
  "inject": {"content": "...", "strategy": "tool_result"},
  "tool_matcher": "*",
  "expires_at": 1740000000.0,
  "sequence": 42
}
"""

from __future__ import annotations

import fnmatch
import json
import logging
import time
from pathlib import Path
from typing import Any

from fastmcp.server.middleware import Middleware

logger = logging.getLogger(__name__)

# Import types for ToolResult construction
try:
    import mcp.types as mcp_types

    _HAS_MCP_TYPES = True
except ImportError:
    _HAS_MCP_TYPES = False

try:
    from fastmcp.tools.tool import ToolResult as FastMCPToolResult

    _HAS_FASTMCP_TOOL_RESULT = True
except ImportError:
    FastMCPToolResult = None  # type: ignore[assignment]
    _HAS_FASTMCP_TOOL_RESULT = False


class _CompatToolResult:
    """Compatibility ToolResult for runtimes without fastmcp.tools.tool.ToolResult."""

    def __init__(
        self,
        *,
        content: list[Any],
        structured_content: dict[str, Any] | None = None,
        meta: dict[str, Any] | None = None,
    ) -> None:
        self.content = content
        self.structured_content = structured_content
        self.meta = meta

    def to_mcp_result(self) -> Any:
        if self.meta is not None and _HAS_MCP_TYPES:
            return mcp_types.CallToolResult(
                structuredContent=self.structured_content,
                content=self.content,
                _meta=self.meta,
            )
        if self.structured_content is None:
            return self.content
        return self.content, self.structured_content


class MassGenHookMiddleware(Middleware):
    """FastMCP middleware that injects hook content into MCP tool results.

    Reads hook_post_tool_use.json from a hook directory. When present,
    appends injection content to the tool result before returning to the caller.
    Uses file-based IPC: orchestrator writes, middleware reads and consumes.
    """

    _RUNTIME_INPUT_MARKER = "[Human Input]:"
    _RUNTIME_INPUT_KEY = "massgen_runtime_input"
    _RUNTIME_INPUT_PRIORITY_KEY = "massgen_runtime_input_priority"

    def __init__(self, hook_dir: Path | str) -> None:
        # Coerce to Path: a string slips through (callers wrap in Path today, but
        # a raw str would make `self._hook_dir / "..."` raise TypeError inside the
        # swallowed try/except in on_call_tool — i.e. silent non-delivery).
        self._hook_dir = Path(hook_dir)
        self._last_post_sequence: int = -1

    async def on_call_tool(self, context: Any, call_next: Any) -> Any:
        """Intercept tool calls to append injection content to results."""
        tool_name = context.message.name

        # Execute the actual tool
        result = await call_next(context)

        # Check for pending injection — wrapped so injection bugs never
        # break the underlying tool call that already succeeded.
        try:
            injection = self._read_post_tool_use_injection(tool_name)
            if injection:
                result = self._append_to_result(result, injection)
                # Success-path observability (mirrors the error log below). This
                # is how we confirm the middleware actually fires end-to-end in a
                # real run — the CLIs' native hooks can't be trusted to fire, so
                # we log every real injection.
                logger.info(
                    "Hook middleware injected %d chars into '%s' tool result",
                    len(injection),
                    tool_name,
                )
        except Exception as e:
            logger.error(
                "Hook middleware injection failed for tool %s: %s. " "Returning original result.",
                tool_name,
                e,
                exc_info=True,
            )

        return result

    def _read_post_tool_use_injection(self, tool_name: str) -> str | None:
        """Read and conditionally consume hook_post_tool_use.json.

        Returns injection content string if valid and matching, None otherwise.
        The file is consumed (deleted) only when matched and valid.
        """
        hook_file = self._hook_dir / "hook_post_tool_use.json"

        try:
            raw = hook_file.read_text(encoding="utf-8")
        except FileNotFoundError:
            return None
        except Exception as e:
            logger.warning(
                "Failed to read hook file %s: %s",
                hook_file,
                e,
            )
            return None

        try:
            payload = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            logger.warning("Malformed JSON in hook file %s", hook_file)
            # Consume malformed file to prevent re-reading
            hook_file.unlink(missing_ok=True)
            return None

        if not isinstance(payload, dict):
            logger.warning(
                "Hook file %s contains non-dict payload (type=%s); discarding",
                hook_file,
                type(payload).__name__,
            )
            hook_file.unlink(missing_ok=True)
            return None

        # Validate tool_matcher glob against tool_name
        tool_matcher = payload.get("tool_matcher", "*")
        if not fnmatch.fnmatch(tool_name, tool_matcher):
            # Don't consume — a different tool may match later
            return None

        # Validate expiry
        expires_at = payload.get("expires_at")
        if expires_at is not None:
            try:
                if time.time() > float(expires_at):
                    logger.debug("Hook payload expired (expires_at=%s)", expires_at)
                    hook_file.unlink(missing_ok=True)
                    return None
            except (TypeError, ValueError):
                logger.warning(
                    "Invalid expires_at value %r in hook file %s; treating as non-expiring",
                    expires_at,
                    hook_file,
                )

        # Validate sequence (monotonically increasing)
        sequence = payload.get("sequence", 0)
        try:
            sequence = int(sequence)
        except (TypeError, ValueError):
            sequence = 0

        if sequence <= self._last_post_sequence:
            logger.debug(
                "Skipping duplicate sequence %d (last seen: %d)",
                sequence,
                self._last_post_sequence,
            )
            hook_file.unlink(missing_ok=True)
            return None

        # Extract injection content
        inject = payload.get("inject")
        if not isinstance(inject, dict) or not inject.get("content"):
            logger.warning(
                "Hook file %s has missing or empty inject.content; discarding",
                hook_file,
            )
            hook_file.unlink(missing_ok=True)
            return None

        # All checks passed — consume the file and update sequence
        self._last_post_sequence = sequence
        hook_file.unlink(missing_ok=True)

        content = inject["content"]
        logger.info(
            "Hook middleware injecting %d chars into %s result (seq=%d)",
            len(content),
            tool_name,
            sequence,
        )
        return content

    @classmethod
    def _extract_runtime_input_line(cls, injection: str) -> str | None:
        """Extract a normalized runtime-input line from injected text, if present."""
        if cls._RUNTIME_INPUT_MARKER not in injection:
            return None
        _, _, tail = injection.partition(cls._RUNTIME_INPUT_MARKER)
        normalized_tail = tail.strip()
        if not normalized_tail:
            return None
        return f"{cls._RUNTIME_INPUT_MARKER} {normalized_tail}"

    @classmethod
    def _augment_structured_content(
        cls,
        structured_content: dict[str, Any] | None,
        injection: str,
    ) -> dict[str, Any] | None:
        """Mirror human runtime input into structured_content for better salience."""
        runtime_line = cls._extract_runtime_input_line(injection)
        if runtime_line is None:
            return structured_content

        merged: dict[str, Any] = dict(structured_content or {})
        merged[cls._RUNTIME_INPUT_KEY] = runtime_line
        merged[cls._RUNTIME_INPUT_PRIORITY_KEY] = "high"
        return merged

    @staticmethod
    def _append_to_result(result: Any, injection: str) -> Any:
        """Append injection text to the tool result.

        ToolResult in FastMCP is typically a list of content objects or a string.
        We normalize to a list and append a TextContent with the injection.
        """
        # Build the injection content item
        if _HAS_MCP_TYPES:
            injection_item = mcp_types.TextContent(
                type="text",
                text=f"\n{injection}",
            )
        else:
            # Fallback: use a simple string
            injection_item = f"\n{injection}"

        # FastMCP middleware expects a ToolResult-like object from on_call_tool.
        # Returning raw lists causes downstream failures when FastMCP calls
        # result.to_mcp_result().
        def _build_tool_result(
            *,
            content: list[Any],
            structured_content: dict[str, Any] | None = None,
        ) -> Any:
            if _HAS_FASTMCP_TOOL_RESULT and FastMCPToolResult is not None:
                return FastMCPToolResult(
                    content=content,
                    structured_content=structured_content,
                )
            return _Comp
```

### Core Architecture Module: `massgen/mcp_tools/hooks.py`
```
"""
Hook system for tool call interception in the MassGen multi-agent framework.

This module provides the infrastructure for intercepting tool calls
across different backend architectures (OpenAI, Claude, Gemini, etc.).

Hook Types:
- PRE_TOOL_USE: Fires before tool execution (can block or modify)
- POST_TOOL_USE: Fires after tool execution (can inject content)

Hook Registration:
- Global hooks: Apply to all agents (top-level `hooks:` in config)
- Per-agent hooks: Apply to specific agents (in `backend.hooks:`)
- Per-agent hooks can extend or override global hooks

Built-in Hooks:
- MidStreamInjectionHook: Injects cross-agent updates during tool execution
- HighPriorityTaskReminderHook: Injects reminders for completed high-priority tasks
"""

import asyncio
import fnmatch
import hashlib
import importlib
import json
import threading
import time
from abc import ABC, abstractmethod
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Literal, Optional

from ..logger_config import logger

# MCP imports for session-based backends
try:
    from mcp import ClientSession, types
    from mcp.client.session import ProgressFnT

    MCP_AVAILABLE = True
except ImportError:
    MCP_AVAILABLE = False
    ClientSession = object
    types = None
    ProgressFnT = None


class InjectionDeliveryStatus(Enum):
    """Delivery status for hookless runtime injection payloads."""

    QUEUED = "queued"
    DELIVERED = "delivered"
    DEFERRED = "deferred"
    FAILED = "failed"


class HookType(Enum):
    """Types of function call hooks."""

    # Legacy hook types (for backward compatibility)
    PRE_CALL = "pre_call"
    POST_CALL = "post_call"

    # New general hook types
    PRE_TOOL_USE = "PreToolUse"
    POST_TOOL_USE = "PostToolUse"


@dataclass
class HookEvent:
    """Input data provided to all hooks.

    This dataclass represents the context passed to hook handlers,
    containing information about the tool call and agent state.
    """

    hook_type: str  # "PreToolUse" or "PostToolUse"
    session_id: str
    orchestrator_id: str
    agent_id: str | None
    timestamp: datetime
    tool_name: str
    tool_input: dict[str, Any]
    tool_output: str | None = None  # Only populated for PostToolUse

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "hook_type": self.hook_type,
            "session_id": self.session_id,
            "orchestrator_id": self.orchestrator_id,
            "agent_id": self.agent_id,
            "timestamp": self.timestamp.isoformat(),
            "tool_name": self.tool_name,
            "tool_input": self.tool_input,
            "tool_output": self.tool_output,
        }

    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict())


@dataclass
class HookResult:
    """Result of a hook execution.

    This dataclass is backward compatible with the old HookResult class
    while adding new fields for the general hook framework.

    The `hook_errors` field tracks any errors that occurred during hook execution
    when using fail-open behavior. This allows callers to be aware of partial
    failures even when the overall result is "allow".
    """

    # Legacy fields (for backward compatibility)
    allowed: bool = True
    metadata: dict[str, Any] = field(default_factory=dict)
    modified_args: str | None = None

    # New fields for general hook framework
    decision: Literal["allow", "deny", "ask"] = "allow"
    reason: str | None = None
    updated_input: dict[str, Any] | None = None  # For PreToolUse
    inject: dict[str, Any] | None = None  # For PostToolUse injection

    # Error tracking for fail-open scenarios
    hook_errors: list[str] = field(default_factory=list)

    # Hook execution tracking (for display in TUI/WebUI)
    hook_name: str | None = None
    hook_type: str | None = None  # "pre" or "post"
    execution_time_ms: float | None = None

    # Aggregated hook executions (populated by GeneralHookManager.execute_hooks)
    # Each entry: {"hook_name": str, "hook_type": str, "decision": str, "reason": str, "execution_time_ms": float, "injection_preview": str}
    executed_hooks: list[dict[str, Any]] = field(default_factory=list)

    def __post_init__(self):
        """Sync legacy and new fields for compatibility."""
        # Sync decision with allowed
        if not self.allowed:
            self.decision = "deny"
        elif self.decision == "deny":
            self.allowed = False

    def add_error(self, error: str) -> None:
        """Add an error message to track partial failures in fail-open mode."""
        self.hook_errors.append(error)

    def has_errors(self) -> bool:
        """Check if any errors occurred during hook execution."""
        return len(self.hook_errors) > 0

    def add_executed_hook(
        self,
        hook_name: str,
        hook_type: str,
        decision: str,
        reason: str | None = None,
        execution_time_ms: float | None = None,
        injection_preview: str | None = None,
        injection_content: str | None = None,
    ) -> None:
        """Track an executed hook for display purposes."""
        self.executed_hooks.append(
            {
                "hook_name": hook_name,
                "hook_type": hook_type,
                "decision": decision,
                "reason": reason,
                "execution_time_ms": execution_time_ms,
                "injection_preview": injection_preview,
                "injection_content": injection_content,
            },
        )

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "HookResult":
        """Create HookResult from dictionary (e.g., from JSON)."""
        return cls(
            allowed=data.get("allowed", True),
            metadata=data.get("metadata", {}),
            modified_args=data.get("modified_args"),
            decision=data.get("decision", "allow"),
            reason=data.get("reason"),
            updated_input=data.get("updated_input"),
            inject=data.get("inject"),
            hook_errors=data.get("hook_errors", []),
            hook_name=data.get("hook_name"),
            hook_type=data.get("hook_type"),
            execution_time_ms=data.get("execution_time_ms"),
            executed_hooks=data.get("executed_hooks", []),
        )

    @classmethod
    def allow(cls) -> "HookResult":
        """Create a result that allows the operation."""
        return cls(allowed=True, decision="allow")

    @classmethod
    def deny(cls, reason: str | None = None) -> "HookResult":
        """Create a result that denies the operation."""
        return cls(allowed=False, decision="deny", reason=reason)

    @classmethod
    def ask(cls, reason: str | None = None) -> "HookResult":
        """Create a result that requires user confirmation."""
        return cls(allowed=True, decision="ask", reason=reason)


class FunctionHook(ABC):
    """Base class for function call hooks."""

    def __init__(self, name: str):
        self.name = name

    @abstractmethod
    async def execute(self, function_name: str, arguments: str, context: dict[str, Any] | None = None, **kwargs) -> HookResult:
        """
        Execute the hook.

        Args:
            function_name: Name of the function being called
            arguments: JSON string of arguments
            context: Additional context (backend, timestamp, etc.)

        Returns:
            HookResult with allowed flag and optional modifications
        """


class FunctionHookManager:
    """Manages registration and execution of function hooks."""

    def __init__(self):
        self._hooks: dict[HookType, list[FunctionHook]] = {hook_type: [] for hook_type in HookType}
        self._global_hooks: dict[HookType, list[FunctionHook]] = {hook_type: [] for hook_type in HookType}

    def register_hook(self, function_name: str, hook_type: HookType, hook: FunctionHook):
        """Register a hook for a specific function."""
        if function_name not in self._hooks:
            self._hooks[function_name] = {hook_type: [] for hook_type in HookType}

        if hook_type not in self._hooks[function_name]:
            self._hooks[function_name][hook_type] = []

        self._hooks[function_name][hook_type].append(hook)

    def register_global_hook(self, hook_type: HookType, hook: FunctionHook):
        """Register a hook that applies to all functions."""
        self._global_hooks[hook_type].append(hook)

    def get_hooks_for_function(self, function_name: str) -> dict[HookType, list[FunctionHook]]:
        """Get all hooks (function-specific + global) for a function."""
        result = {hook_type: [] for hook_type in HookType}

        # Add global hooks first
        for hook_type in HookType:
            result[hook_type].extend(self._global_hooks[hook_type])

        # Add function-specific hooks
        if function_name in self._hooks:
            for hook_type in HookType:
                if hook_type in self._hooks[function_name]:
                    result[hook_type].extend(self._hooks[function_name][hook_type])

        return result

    def clear_hooks(self):
        """Clear all registered hooks."""
        self._hooks.clear()
        self._global_hooks = {hook_type: [] for hook_type in HookType}


# =============================================================================
# New General Hook Framework
# =============================================================================


class PatternHook(FunctionHook):
    """Base class for hooks that support pattern-based tool matching."""

    def __init__(
        self,
        name: str,
        matcher: str = "*",
        timeout: int = 30,
    ):
        """
        Initialize a pattern-based hook.

        Args:
            name: Hook identifier
   
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1006** (2026-03-21): **[BUG] Workflow tool failure caused by encoding error**
  *Symptoms*: ## Bug Description <!-- A clear and concise description of what the bug is --> agents peroduce You must use workflow tools (vote or new_answer) to complete the task.Error: 'charmap' codec can't encode character '\u2192' in position 309: character maps to <undefined>❌ Error: 'charmap' codec can't encode character '\u2192' in position 309:  when running any command ## To Reproduce <!-- Steps to reproduce the behavior -->   2. Command run: "hello" 3. Input provided:: NA 4. Error seen:charmap' codec can't encode character '\u2192' in position 309: character maps to <undefined>  ## Expected Behavior <!-- A clear and concise description of what you expected to happen --> expect to have a response. ## Actual Behavior <!-- Describe what actually happened --> After try to run any command, it create three agents when in the voting stage it report a bug with encoding.   ## Environment  - OS: [e.g., macOS, Linux, Windows]:Windows  - Python Version: [e.g., 3.12, 3.13]:3.14  - MassGen Version: [e.g., 0.0.23]:v0.1.64  - LLM Backend Used: [e.g., OpenAI, Claude, Gemini, Grok] OpenAI CTL  ## Configuration File <!-- If relevant, paste your configuration file content (please remove any sensitive information like API keys) --> ```yaml agents: - id: agent_a   backend:     type: codex     model: gpt-5.3-codex     cwd: workspace     exclude_file_operation_mcps: false     enable_web_search: false - id: agent_b   backend:     type: codex     model: gpt-5.3-codex     cwd: workspace     exclude_file_ope

- **Issue #936** (2026-02-25): **[BUG] WebUI for Codex backend**
  *Symptoms*: ## Bug Description  `codex` backend is not selectable in the WebUI when `OPENAI_API_KEY` is not set, even though the Codex backend supports OAuth authentication via `codex login` and does not require an API key.  ## To Reproduce  1. Comment out or remove `OPENAI_API_KEY` from `~/.massgen/.env` 2. Start the MassGen WebUI 3. Navigate to the agent configuration step 4. Observe that `codex` does not appear in the available backend list (or is shown as disabled)  <br>**Fix**  Add `codex` to the same whitelist:  ``` elif backend_type == "codex":     # Codex always shows - works with OAuth (codex login) or OPENAI_API_KEY     has_api_key = True ```

- **Issue #906** (2026-04-24): **[BUG] Codex backend blocks subagent spawning due to interactive OAuth requirement**
  *Symptoms*: ## Problem  When the subagent orchestrator is configured to use `type: codex`, subagents get stuck indefinitely on OAuth authentication because they run as headless subprocesses that cannot complete an interactive browser-based OAuth flow.  **Observed in:** `log_20260217_110341_084781`  ### What happens  1. Parent agent spawns an evaluator subagent with `type: codex, model: gpt-5.3-codex` 2. Subagent subprocess starts, generates YAML config, launches `uv run massgen --config ... --automation` 3. Codex backend initializes and detects no cached OAuth credentials 4. Backend attempts `Opening browser for Codex authentication...` — which blocks forever in the non-interactive subprocess 5. Subagent sits at 0 tool calls, 0 tokens, 0 rounds until the 300s timeout kills it 6. Parent agent gets a timeout result and falls back to inline verification  ### Log evidence  ``` 19:14:40 | INFO  | Codex authentication required. Initiating OAuth flow... 19:14:40 | INFO  | Opening browser for Codex authentication... ```  `status.json` shows: `total_calls: 0, total_input_tokens: 0, elapsed_seconds: 275`  ### Expected behavior  Subagents using Codex should either:  1. **Inherit cached OAuth credentials** from the parent process (preferred) 2. **Fail fast** with a clear error message instead of blocking on interactive auth 3. **Validate auth availability** before spawning, so the orchestrator can warn or fall back  ### Workaround  Use a non-OAuth backend for subagents (e.g., `openrouter`, `claude_c
  **Post-Mortem & Fix Analysis**:
  > This issue is marked as stale because there has been no activity for 30 days. Remove stale label or add new comments or this issue will be closed in 3 day.
  > This issue is marked as stale because there has been no activity for 30 days. Remove stale label or add new comments or this issue will be closed in 3 day.
  > Close this stale issue.

- **Issue #759** (2026-01-07): **[BUG] Vote-only mode allows hallucinated new_answer calls to waste a round**
  *Symptoms*: ## Summary  When an agent reaches `max_new_answers_per_agent` limit, they are put in vote-only mode where the `new_answer` tool should be unavailable. However, if the model hallucinates a `new_answer` call, it is not filtered out as an "unknown tool" and instead proceeds to validation, wasting a full API round.  ## Root Cause  In `orchestrator.py` line 4184, `internal_tool_names` is built from `self.workflow_tools` (the full set) instead of `agent_workflow_tools` (the filtered vote-only set):  ```python internal_tool_names = {(t.get("function", {}) or {}).get("name") for t in (self.workflow_tools or []) if isinstance(t, dict)} ```  This causes:  1. Agent correctly receives only `vote` tool (via `agent_workflow_tools`) 2. But `internal_tool_names` still includes `new_answer` 3. Hallucinated `new_answer` calls pass the "unknown tool" filter at line 4267 4. They get logged ("💡 Providing answer") then fail at validation (line 4474) 5. This wastes a full round before the error is returned  ## Evidence  From log `log_20260105_234936_367533`:  ``` [00:06:34] 💡 Providing answer: "" [00:06:34] 🔧 MCP: ✅ [MCP] Session completed [00:06:34] ❌ You've reached the maximum of 3 new answer(s). Please vote for the best existing answer using the `vote` tool. ```  ## Fix  Change line 4184 to use the agent-specific filtered tools:  ```python internal_tool_names = {(t.get("function", {}) or {}).get("name") for t in (agent_workflow_tools or []) if isinstance(t, dict)} ```  Note: This line is insi

- **Issue #758** (2026-02-09): **[FIX] Clarify cumulative context usage metric in logs**
  *Symptoms*: ## Problem  The `metrics_summary.json` reports context usage as a percentage (e.g., "394.79%") which is cumulative across all restarts. This is misleading because:  * It sounds alarming when it's actually expected behavior * It doesn't indicate whether any single round had problematic context usage * Users may think there's a bug when there isn't  ## Proposed Fix  Change context usage reporting to be more informative:  1. **Report per-round context usage** instead of (or in addition to) cumulative 2. **Label cumulative metrics clearly** - e.g., "cumulative across N restarts" 3. **Consider flagging anomalies** - only highlight if a single round exceeds a threshold (e.g., >90% of context window)  ## Example  Instead of:  ```json "average_context_usage_percent": 394.79 ```  Report something like:  ```json "context_usage": {   "per_round_average_percent": 98.7,   "per_round_max_percent": 112.3,   "cumulative_percent": 394.79,   "num_rounds": 4 } ```  ## Source  Identified from log analysis of `log_20260105_105524_290672` - see `ANALYSIS_REPORT.md` in that log directory.
  **Post-Mortem & Fix Analysis**:
  > This issue is marked as stale because there has been no activity for 30 days. Remove stale label or add new comments or this issue will be closed in 3 day.
  > Close this stale issue.

- **Issue #743** (2026-02-10): **[BUG] MCP command_line tool ignores timeout parameter, uses global 400s timeout**
  *Symptoms*: ## Bug Description  The MCP `command_line.execute_command` tool ignores the `timeout` parameter passed in arguments and instead uses the global MCP timeout of 400 seconds.  ## Steps to Reproduce  1. Agent calls `mcp__command_line__execute_command` with a short timeout:  ```json {   "command": "python tasks/evolving_skill/scripts/serve_and_smoke_test.py",   "timeout": 2,   "work_dir": "/path/to/workspace" } ```  2. The command starts a long-running process (e.g., HTTP server) 3. Expected: Command times out after 2 seconds 4. Actual: Command runs for 400 seconds before timing out  ## Log Evidence  ``` 11:32:58 | INFO     | Arguments for Calling mcp__command_line__execute_command: {"command":"python tasks/evolving_skill/scripts/serve_and_smoke_test.py","timeout":2,"work_dir":"..."} 11:39:38 | ERROR    | Tool call timed out for execute_command on command_line after 400s. ```  The agent requested `timeout: 2` but the actual timeout was 400s (nearly 7 minutes later).  ## Expected Behavior  The `timeout` parameter in the tool arguments should be respected by the MCP server, killing the subprocess after the specified number of seconds.  ## Impact  * Agents can get stuck waiting for long-running commands * Wastes compute/API resources * Poor user experience when commands hang  ## Log File  `/Users/ncrispin/GitHubProjects/MassGenNew/.massgen/massgen_logs/log_20260104_112848_774873/turn_1/attempt_1/massgen.log`
  **Post-Mortem & Fix Analysis**:
  >  @ncrispino  A tool ignoring the per‑call `timeout` and using a global 400s is hard to catch without a request‑level record.  If you share the exact tool call payload, I’ll reproduce it and post an AI Badgr receipt with timing sliced by gateway/provider handy to prove the server didn’t honor the `timeout` arg and to justify a fix that enforces the shorter limit. let me know if i can help 
  > This issue is marked as stale because there has been no activity for 30 days. Remove stale label or add new comments or this issue will be closed in 3 day.
  > Close this stale issue.

- **Issue #733** (2026-01-05): **[BUG] Custom tools (read_media, generate_media) lack project context, causing hallucinations**
  *Symptoms*: ## Summary  Custom tools like `read_media` and `generate_media` make external API calls (e.g., to GPT-4.1 for vision) without any project context. This causes the external model to hallucinate incorrect interpretations.  ## Evidence  From `log_20260102_123932_872167`, when an agent asked `read_media` to evaluate an image for the MassGen homepage:  **Prompt sent:**  ``` "What flaws, issues, or missing elements do you see in this image? Does it look professional and cinematic as claimed? Is it relevant to MassGen?" ```  **GPT-4.1's response:**  ``` Let's analyze the image for professionalism, cinematic quality, and relevance to "MassGen"  (assuming you mean Massachusetts General Hospital/Mass General, or something related to  advanced science/medicine)...  ### **2. Relevance to MassGen** **If you mean Massachusetts General Hospital / Mass General Research:** - **Not Directly Relevant:** There are no clear medical elements... ```  The tool completely misinterpreted "MassGen" as "Massachusetts General Hospital" because it had **zero context** about what MassGen actually is (a multi-agent AI orchestration system).  ## Root Cause  In `massgen/tool/_multimodal_tools/understand_image.py` (lines 265-281), the API call is made with only the user prompt and image - no system message or context:  ```python response = client.responses.create(     model=model,     input=[         {             "role": "user",             "content": [                 {"type": "input_text", "text": prompt}, 

- **Issue #732** (2026-01-05): **[BUG] Cancelled subagents return null answer even when work was completed**
  *Symptoms*: ## Summary  When a subagent is cancelled due to timeout (300s default), the system returns `answer: null` and `token_usage: {}` even when the subagent has completed significant work, including finished answers, voting, and file creation.  ## Evidence  Analyzed two runs with cancelled subagents:  * `log_20260102_120203_588712` - 5 of 10 subagents cancelled * `log_20260102_123932_872167` - 14 of 28 subagents cancelled  ### Example: `arch_researcher` subagent  **What the parent agent received:**  ```json {   "status": "error",   "answer": null,   "error": "Subagent cancelled",   "token_usage": {} } ```  **What actually happened (from** `full_logs/status.json`):  ```json {   "coordination.phase": "presentation",   "coordination.completion_percentage": 100,   "coordination.is_final_presentation": true,   "results.winner": "arch_researcher_agent_1",   "results.votes": {"agent1.1": 3},   "costs.total_estimated_cost": 0.048142,   "costs.total_input_tokens": 204656,   "costs.total_output_tokens": 8419 } ```  The subagent:  * Completed its work (100% completion) * Both internal agents answered and voted * A winner was selected (agent1.1 with 3 votes) * Created `explanation.md` with quality content * Spent $0.048 on tokens  But all this work was **lost** because the cancellation returned null.  ### Another example: `technical_expert` subagent  * Both agents completed answers * Both agents voted (1-1 tie, in enforcement phase) * $0.056 spent, 290k input tokens * Created comprehensive `te

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

### Incident Patch 1: `c4540f03` (2026-06-12)
**Commit Message**: feat(permissions): render denied tool calls as first-class failed tool events

A permission-denied call returned early in the chokepoint BEFORE the normal
emit_tool_start / emit_tool_complete path, so it surfaced only as a transient
status line — never as a tool-call row in the TUI/WebUI timeline, and the status
named only the tool, not the attempted command.

Now, in the deny path:
- emit_tool_start(args) + emit_tool_complete(is_error=True, status="denied") so the
  blocked call appears as a first-class FAILED tool call (with its command/args) in
  the event timeline.
- the human-facing denial chunk includes a command preview ("Denied ($ curl ...): ...")
  so the user sees WHAT was blocked, not just the tool name.

Telemetry failures are swallowed (never break execution). Extracted two testable
helpers: _emit_denied_tool_call + _denied_tool_preview.

Tested (TDD): 5 new unit tests (start→error-complete ordering, no-emitter safety,
emitter-error safety, command/path/tool-name preview). Verified live: a denied
gemini curl call now emits tool_start{command:"curl ..."} + tool_complete{is_error:
true, status:"denied"} and renders as "🔧 Calling ... → ❌ completed: Denied ...".

Co-Autho

**File**: `massgen/backend/base_with_custom_tool_and_mcp.py` (modified, +72/-2)
```diff
@@ -2498,6 +2498,57 @@ def _append_tool_result_message(
         - Claude: {"role": "user", "content": [{"type": "tool_result", "tool_use_id": ..., "content": ...}]}
         """
 
+    @staticmethod
+    def _denied_tool_preview(tool_name: str, args: dict[str, Any]) -> str:
+        """Human-readable preview of WHAT was blocked (the command/path), not just
+        the tool name — surfaced in the denial status line."""
+        cmd = args.get("command") or args.get("cmd")
+        if isinstance(cmd, str) and cmd.strip():
+            return f"$ {cmd.strip()[:200]}"
+        for key in ("path", "file_path", "url", "destination", "destination_path", "target"):
+            v = args.get(key)
+            if isinstance(v, str) and v:
+                return f"{tool_name} {v}"
+        return tool_name
+
+    def _emit_denied_tool_call(
+        self,
+        *,
+        call_id: str,
+        tool_name: str,
+        args: dict[str, Any],
+        reason: str,
+        server_name: str | None = None,
+        elapsed_seconds: float = 0.0,
+    ) -> None:
+        """Emit tool_start + tool_complete(is_error=True) for a permission-denied
+        call so it renders as a first-class FAILED tool call in the TUI/WebUI
+        timeline. The chokepoint returns before the normal emission path, so without
+        this a denied call would never appear as a tool-call row (only a transient
+        status line). Telemetry must never break execution → failures are swallowed."""
+        emitter = get_event_emitter()
+        if not emitter:
+            return
+        try:
+            emitter.emit_tool_start(
+                tool_id=call_id,
+                tool_name=tool_name,
+                args=args,
+                server_name=server_name,
+                agent_id=self.agent_id,
+            )
+            emitter.emit_tool_complete(
+                tool_id=call_id,
+                tool_name=tool_name,
+                result=reason,
+                elapsed_seconds=elapsed_seconds,
+                status="denied",
+                is_error=True,
+                agent_id=self.agent_id,
+            )
+        except Exception as e:  # noqa: BLE001 - telemetry must not break execution
+            logger.debug(f"[PreToolUse] failed to emit denied-tool events: {e}")
+
     @abstractmethod
     def _append_tool_error_message(
         self,
@@ -2748,13 +2799,33 @@ async def _execute_tool_with_logging(
                 if deny_reason is not None:
                     error_msg = deny_reason
                     logger.warning(f"[PreToolUse] {error_msg}")
+                    try:
+                        _denied_args = json.loads(arguments_str) if arguments_str else {}
+                    except (json.JSONDecodeError, TypeError):
+                        _denied_args = {}
+                    if not isinstance(_denied_args, dict):
+                        _denied_args = {}
+                    # Show WHAT was blocked (the command/path), not just the tool name.
+                    preview = self._denied_tool_preview(tool_name, _denied_args)
                     yield StreamChunk(
                         type=config.chunk_type,
                         status=config.status_error,
-                        content=f"{config.error_emoji} {error_msg}",
+                        content=f"{config.error_emoji} Denied ({preview}): {error_msg}",
                         source=f"{config.source_prefix}{tool_name}",
                         tool_call_id=call_id,
                     )
+                    # Surface the denied call as a first-class FAILED tool call in the
+                    # TUI/WebUI timeline (the early return below skips the normal
+                    # emit_tool_start / emit_tool_complete path).
+                    metric.end_time = time.time()
+                    self._emit_denied_tool_call(
+                        call_id=call_id,
+                        tool_name=tool_name,
+                        args=_denied_args,
+                        reason=error_msg,
+                        server_name=config.source_prefix.rstrip("_: ") if config.tool_type == "mcp" else None,
+                        elapsed_seconds=max(0.0, metric.end_time - getattr(metric, "start_time", metric.end_time)),
+                    )
                     # Still need to add error result to messages
                     self._append_tool_error_message(
                         updated_messages,
@@ -2765,7 +2836,6 @@ async def _execute_tool_with_logging(
                     processed_call_ids.add(call_id)
 
                     # Record metric for denied/unapproved execution
-                    metric.end_time = time.time()
                     metric.success = False
                     metric.error_message = error_msg[:500]
                     self._tool_execution_metrics.append(metric)
```

**File**: `massgen/tests/test_permission_denied_tool_visibility.py` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+"""A permission-denied tool call must surface as a first-class FAILED tool call.
+
+The chokepoint returns early on deny, before the normal emit_tool_start /
+emit_tool_complete path — so without explicit emission the denied call shows only a
+transient status line and never appears as a tool-call row in the TUI/WebUI timeline
+(no command, no error result). These tests pin the two helpers that fix that:
+
+- ``_emit_denied_tool_call`` emits tool_start + tool_complete(is_error=True).
+- ``_denied_tool_preview`` renders the attempted command for the human-facing text.
+"""
+
+from __future__ import annotations
+
+from types import SimpleNamespace
+
+from massgen.backend import base_with_custom_tool_and_mcp as mod
+from massgen.backend.base_with_custom_tool_and_mcp import CustomToolAndMCPBackend
+
+
+def test_denied_tool_emits_start_then_error_complete(monkeypatch):
+    events = []
+
+    class FakeEmitter:
+        def emit_tool_start(self, **kw):
+            events.append(("start", kw))
+
+        def emit_tool_complete(self, **kw):
+            events.append(("complete", kw))
+
+    monkeypatch.setattr(mod, "get_event_emitter", lambda: FakeEmitter())
+    stub = SimpleNamespace(agent_id="guarded")
+
+    CustomToolAndMCPBackend._emit_denied_tool_call(
+        stub,
+        call_id="call_2",
+        tool_name="mcp__command_line__execute_command",
+        args={"command": "curl -s https://example.com"},
+        reason="Denied by automation policy: high-risk",
+        server_name="mcp",
+    )
+
+    # A real failed tool call: start (with the attempted command) THEN error-complete.
+    assert [e[0] for e in events] == ["start", "complete"]
+    start_kw, complete_kw = events[0][1], events[1][1]
+    assert start_kw["tool_id"] == "call_2"
+    assert start_kw["tool_name"] == "mcp__command_line__execute_command"
+    assert start_kw["args"]["command"] == "curl -s https://example.com"
+    assert complete_kw["tool_id"] == "call_2"
+    assert complete_kw["is_error"] is True
+    assert complete_kw["status"] == "denied"
+    assert "Denied by automation policy" in str(complete_kw["result"])
+
+
+def test_denied_tool_emission_is_safe_without_emitter(monkeypatch):
+    # No event emitter configured (e.g. headless) → no crash, no events.
+    monkeypatch.setattr(mod, "get_event_emitter", lambda: None)
+    stub = SimpleNamespace(agent_id="a1")
+    # Must not raise.
+    CustomToolAndMCPBackend._emit_denied_tool_call(
+        stub,
+        call_id="c1",
+        tool_name="bash",
+        args={"command": "ls"},
+        reason="nope",
+    )
+
+
+def test_denied_tool_emission_never_breaks_on_emitter_error(monkeypatch):
+    class BoomEmitter:
+        def emit_tool_start(self, **kw):
+            raise RuntimeError("boom")
+
+        def emit_tool_complete(self, **kw):
+            pass
+
+    monkeypatch.setattr(mod, "get_event_emitter", lambda: BoomEmitter())
+    stub = SimpleNamespace(agent_id="a1")
+    # A telemetry failure must never break tool execution.
+    CustomToolAndMCPBackend._emit_denied_tool_call(stub, call_id="c1", tool_name="bash", args={}, reason="r")
+
+
+# --------------------------------------------------------------------------- #
+# Human-facing preview: show WHAT was blocked, not just the tool name
+# --------------------------------------------------------------------------- #
+def test_preview_shows_the_command():
+    p = CustomToolAndMCPBackend._denied_tool_preview(
+        "mcp__command_line__execute_command",
+        {"command": "curl -s https://example.com"},
+    )
+    assert p == "$ curl -s https://example.com"
+
+
+def test_preview_falls_back_to_path_then_tool_name():
+    assert CustomToolAndMCPBackend._denied_tool_preview("write_file", {"path": "/x/y.txt"}) == "write_file /x/y.txt"
+    assert CustomToolAndMCPBackend._denied_tool_preview("some_tool", {}) == "some_tool"
```

---

### Incident Patch 2: `9d512508` (2026-06-10)
**Commit Message**: fix(sandbox): re-allow framework read roots so fs-tools MCP server starts under confined SRT

Live-smoke-testing the srt_sandbox.yaml demo surfaced that the OS-wrapped
workspace_tools MCP server failed to start under the default confined read mode:
SRT denied reading the server's own code because, in a normal dev/editable
install, the venv (fastmcp + deps + interpreter), the massgen package source, and
git's user config all live under $HOME — exactly the region confined denies. First
the server's own _workspace_tools_server.py script was unreadable; after re-allowing
the code roots, GitPython's import-time `git version` then failed reading
~/.gitconfig. Either way the server never connected and the agent silently fell back
to shell-only (security held — fail-closed — but the filesystem MCP file-op tools
were unavailable whenever srt was on).

Fix: build_settings() now re-allows the framework's runtime read roots for the
fs_tools profile only (sys.prefix/sys.base_prefix, the massgen package dir, and
~/.gitconfig + ~/.config/git). This is framework code/config, not user data, so
secrets (.ssh/.aws/...) and other projects stay denied; the agent's own execution
profile is untouched.

T

**File**: `massgen/filesystem_manager/_srt_manager.py` (modified, +44/-0)
```diff
@@ -131,6 +131,40 @@ def srt_available(srt_path: str = DEFAULT_SRT_BINARY) -> bool:
     return shutil.which(srt_path) is not None
 
 
+def _framework_read_roots() -> list[str]:
+    """Read roots the framework's OWN MCP servers need to start under SRT.
+
+    When SRT wraps a framework server (``fastmcp run <massgen script> …``), the
+    sandbox must be able to READ the server's code, the Python interpreter, the
+    installed dependencies (fastmcp, mcp, GitPython, …), and the runtime config those
+    dependencies require at startup. In a typical dev/editable install all of these
+    live under ``$HOME`` — exactly the region ``confined``/``strict`` deny — so without
+    re-allowing them ``srt`` denies the read and the server never starts (first the
+    server's own script, then GitPython's ``git version`` reading ``~/.gitconfig``).
+
+    Returns, all framework code/runtime (NOT user data — these don't widen access to
+    secrets or other projects):
+      - ``sys.prefix`` / ``sys.base_prefix`` — interpreter + site-packages (deps)
+      - the ``massgen`` package directory — the server scripts
+      - git's user config (``~/.gitconfig``, ``~/.config/git``) — git is core to the
+        workspace model (snapshots/commits via GitPython); git reads its global config
+        on essentially every invocation.
+    """
+    import sys
+
+    roots = {sys.prefix, sys.base_prefix}
+    try:
+        import massgen
+
+        roots.add(str(Path(massgen.__file__).resolve().parent))
+    except Exception:  # pragma: no cover - massgen is always importable in practice
+        pass
+    home = Path.home()
+    roots.add(str(home / ".gitconfig"))
+    roots.add(str(home / ".config" / "git"))
+    return sorted(roots)
+
+
 class SrtManager:
     """Builds per-agent SRT settings and wraps commands.
 
@@ -201,6 +235,16 @@ def build_settings(self, profile: str = EXECUTION_PROFILE) -> dict[str, Any]:
         managed_readable = [str(mp.path) for mp in managed]
         allow_read = managed_readable + [str(p) for p in self.fs_tools_extra_writable] + list(self.allow_read)
 
+        # The fs-tools profile wraps a FRAMEWORK MCP server (fastmcp run <massgen
+        # script>). Under confined/strict the server's own code + interpreter + deps
+        # live in a denied region ($HOME), so re-allow the framework runtime roots or
+        # the wrapped server can't read its own script and fails to start. This is
+        # framework code, not user data; the agent's own command sandbox (execution
+        # profile) stays tight and is unaffected. ("open" re-allows nothing because
+        # it is allow-all-minus-denylist; the framework roots are readable anyway.)
+        if profile == FS_TOOLS_PROFILE:
+            allow_read = allow_read + _framework_read_roots()
+
         if self.read_mode == READ_MODE_OPEN:
             # Allow-all minus the secret denylist + protected + extras. (No allowRead:
             # protected/secret denies stay effective because nothing re-allows them.)
```

**File**: `massgen/tests/test_srt_manager.py` (modified, +58/-0)
```diff
@@ -151,6 +151,64 @@ def test_fs_tools_profile_widens_writes_for_temp_and_snapshot(pm_with_paths, tmp
     assert str(snapshot.resolve()) in allow_write
 
 
+def _is_read_allowed(allow_read, target: str) -> bool:
+    """True if `target` is covered by some allowRead root (itself or an ancestor)."""
+    from pathlib import Path as _P
+
+    t = _P(target).resolve()
+    for root in allow_read:
+        r = _P(root).resolve()
+        if t == r or r in t.parents:
+            return True
+    return False
+
+
+def test_fs_tools_profile_confined_allows_reading_framework_runtime(pm_with_paths):
+    """REGRESSION: when SRT wraps a framework MCP server (fastmcp run <massgen script>),
+    confined mode denies all of $HOME — but the venv (fastmcp + deps + interpreter) and
+    the massgen package source both live under $HOME. Without re-allowing the framework's
+    own read roots, `srt` denies reading the server's own code and the server can't start
+    ("Operation not permitted: _workspace_tools_server.py"). The fs_tools profile must
+    re-allow the framework runtime roots so the wrapped server can read its own code while
+    $HOME otherwise stays denied.
+    """
+    import sys
+    from pathlib import Path
+
+    import massgen
+
+    mgr = SrtManager(pm_with_paths["pm"])  # default confined
+    fs = mgr.build_settings(profile="fs_tools")["filesystem"]
+
+    # $HOME is still denied (we didn't just open everything back up).
+    assert str(Path.home()) in fs["denyRead"]
+
+    # The framework's own code + interpreter + deps must be readable (allowRead wins).
+    massgen_dir = Path(massgen.__file__).resolve().parent
+    assert _is_read_allowed(fs["allowRead"], str(massgen_dir)), "massgen package dir must be readable by the wrapped fs-tools server"
+    assert _is_read_allowed(fs["allowRead"], sys.prefix), "Python prefix (venv: fastmcp + deps) must be readable"
+    assert _is_read_allowed(fs["allowRead"], sys.base_prefix), "base Python prefix must be readable"
+
+    # git is core to the workspace model (GitPython reads ~/.gitconfig at import), so
+    # its user config must be readable too — else the server crashes on import under
+    # confined ("unable to access '~/.gitconfig': Operation not permitted").
+    assert _is_read_allowed(fs["allowRead"], str(Path.home() / ".gitconfig")), "git user config must be readable by the wrapped fs-tools server"
+
+
+def test_execution_profile_does_not_widen_for_framework_runtime(pm_with_paths):
+    """The framework-runtime re-allow is fs_tools-only: the agent's own command sandbox
+    (execution profile) stays tight and must NOT gain the massgen package dir just because
+    fs_tools needs it."""
+    from pathlib import Path
+
+    import massgen
+
+    mgr = SrtManager(pm_with_paths["pm"])  # default confined
+    fs = mgr.build_settings(profile="execution")["filesystem"]
+    massgen_dir = str(Path(massgen.__file__).resolve().parent)
+    assert massgen_dir not in fs["allowRead"]
+
+
 # --------------------------------------------------------------------------- #
 # network — deny-all by default, opt-in allowlist
 # --------------------------------------------------------------------------- #
```

---

### Incident Patch 3: `83f9a872` (2026-06-10)
**Commit Message**: feat(security): harden PathPermissionManager hook against file-tool sandbox escapes

Adds a key-agnostic escape scan (_validate_no_path_arg_escapes) that walks the
full tool-args tree (nested dicts + lists) and denies any value resolving outside
all managed areas. Closes fail-open gaps surfaced by an adversarial audit:

- path under an unrecognized arg key (e.g. output_path/dst) bypassed the boundary
- list-valued and nested-dict path args were never checked
- move/copy 'source' pointing outside (delete-external / exfiltrate-external)

No false positives: non-path strings resolve harmlessly inside the workspace, and
content-bearing keys are skipped. Symlinks/.. were already handled via .resolve().
15-vector adversarial test suite added.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `PR_DRAFT_sandboxing.md` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+# PR Draft: OS-Level Agent Sandboxing (SRT) + Permission-Hook Hardening
+
+**Branch:** `feat/better-sandboxing`
+
+## Summary
+
+Adds **OS-level execution sandboxing** for agents via Anthropic's [sandbox-runtime](https://github.com/anthropic-experimental/sandbox-runtime) (`srt`: bubblewrap/Linux, Seatbelt/macOS), and **hardens the existing application-layer permission hook** against file-tool sandbox escapes. Default-off, one-knob opt-in; current behavior is unchanged unless a config sets `command_line_execution_mode: srt`.
+
+Defense in depth, by design: the OS layer (SRT) and the app layer (`PathPermissionManager`) are derived from the **same** path policy and both stay active. SRT closes the shell escape hatch (e.g. `echo x > /etc/passwd`); the hardened hook closes file-tool escapes (`write_file`/`move`/`copy` to/from outside the workspace).
+
+## What's included
+
+### 1. SRT sandbox mode (`command_line_execution_mode: srt`)
+- **`SrtManager`** (`massgen/filesystem_manager/_srt_manager.py`) — derives per-agent SRT settings from `PathPermissionManager.managed_paths`: `allowWrite` = writable paths, `denyWrite`/`denyRead` for read-only/protected paths, **network deny-all by default** (allowlist is opt-in, documented as a capability grant), and a **built-in read-deny baseline for secret stores** (`~/.ssh`, `~/.aws`, `~/.gnupg`, cloud creds, `/etc/shadow`, …) since SRT reads are otherwise allow-all.
+- **Command-line MCP** wraps each executed command: `srt --settings cfg sh -c '<cmd>'`.
+- **Filesystem-tools MCP servers** are OS-wrapped too (defense in depth), via the **`sh -c` form** — required because `srt` otherwise consumes the server's `--` separator. **npx/npm launchers (and the no-roots wrapper that spawns npx) auto-skip** wrapping (they need the registry + `~/.npm` writes the sandbox blocks) and keep their app-layer protection.
+- **Native-sandbox backends degrade `srt`→`local`**: `has_native_execution_sandbox()` (True for `codex` `--full-auto` and `claude_code`) prevents nested Seatbelt/Landlock hangs; the stored config is normalized so downstream raw reads see `local`.
+- **Subagents inherit** the parent's `command_line_srt_*` settings (parity with Docker).
+- New backend params `command_line_srt_network_allowed_domains` / `_deny_read` / `_allow_unix_sockets` added to the single-source exclusion list; `srt` added to the MCP executable allowlist.
+- Config example: `massgen/configs/tools/filesystem/sandbox/srt_sandbox.yaml`.
+
+### 2. Permission-hook hardening (`PathPermissionManager`)
+- New `_validate_no_path_arg_escapes`: a **key-agnostic scan** that walks the full tool-args tree (nested dicts + lists) and denies any value resolving outside all managed areas. Closes the prior **fail-open** behavior (path under an unrecognized key, list-valued path, or move/copy `source` pointing outside) without false positives (non-path strings resolve harmlessly inside the workspace; content keys are skipped). Symlinks/`..` were already handled by `.resolve()`.
+
+## Tests
+
+| File | Covers |
+|------|--------|
+| `test_srt_manager.py` | settings derivation, profiles, secret read-deny baseline, protected-path read+write deny, wrapping, availability guards |
+| `test_srt_filesystem_integration.py` | command-line + fs-tools config wiring, `sh -c` wrap, npx / no-roots auto-skip, MCP-security validation |
+| `test_srt_backend_degrade.py` | `srt`→`local` degrade for native-sandbox backends; API backends keep `srt` |
+| `test_path_permission_hook_adversarial.py` | 15 escape vectors (absolute/`..`/symlink/unrecognized-key/list/nested-dict/move-source/copy-source/read-exfil) + false-positive guards |
+| `test_subagent_manager.py::TestSrtSettingsInheritance` | subagent inherits parent srt settings |
+
+## Live verification (macOS 15.7, srt 1.0.0)
+- Standalone srt: allowed-write ✓, out-of-scope write blocked ✓, deny-all network blocked ✓, **secret read blocked** ✓.
+- **3 API backends** (openrouter/`chatcompletion`, OpenAI Responses/`openai`, Gemini/`gemini`): workspace write OK; out-of-workspace write → `Operation not permitted`; file-tool escape blocked.
+- **codex + srt** and **claude_code + srt**: degrade to local, run via native sandbox, complete.
+
+## Pre-merge quality gate
+A multi-agent code review (correctness/security/parity/tests, adversarially verified) was run on the diff; **all 15 confirmed findings fixed** — most notably a HIGH read-confinement hole (SRT reads were default-allow) and a subagent settings-inheritance parity gap.
+
+## Known follow-ups (not in this PR)
+- `write_file`/`edit_file` (npx filesystem server) is app-layer-only; full OS coverage needs a globally-installed (non-npx) filesystem server.
+- Network-egress MITM / per-agent credential scoping (allowlist-only egress can leak via embedded API keys).
+- claude_code native-sandbox lever via `ClaudeAgentOptions`.
+
+## Configs used to test
+- `massgen/configs/tools/filesystem/sandbox/srt_sandbox.yaml` (committed)
+- Throwa
```

**File**: `massgen/filesystem_manager/_path_permission_manager.py` (modified, +105/-0)
```diff
@@ -1119,6 +1119,13 @@ def _validate_file_context_access(self, tool_name: str, tool_args: dict[str, Any
         Returns:
             Tuple of (allowed: bool, reason: Optional[str])
         """
+        # Defense in depth: deny if ANY argument (under any key, incl. lists)
+        # resolves outside every managed area — catches write/read-capable tools
+        # whose name doesn't match the write patterns and would otherwise fail-open.
+        escape_check = self._validate_no_path_arg_escapes(tool_args)
+        if not escape_check[0]:
+            return escape_check
+
         # Extract file path from arguments
         file_path = self._extract_file_path(tool_args)
         if not file_path:
@@ -1152,6 +1159,13 @@ def _validate_file_context_access(self, tool_name: str, tool_args: dict[str, Any
 
     def _validate_write_tool(self, tool_name: str, tool_args: dict[str, Any]) -> tuple[bool, str | None]:
         """Validate write tool access."""
+        # Defense in depth: no argument (under any key, incl. lists / `source`) may
+        # resolve outside allowed directories. Closes the fail-open gap where a path
+        # under an unrecognized key bypasses the primary extractor.
+        escape_check = self._validate_no_path_arg_escapes(tool_args)
+        if not escape_check[0]:
+            return escape_check
+
         # Special handling for copy_files_batch - validate all destination paths after globbing
         if tool_name == "copy_files_batch":
             return self._validate_copy_files_batch(tool_args)
@@ -1389,6 +1403,97 @@ def _validate_command_tool(self, tool_name: str, tool_args: dict[str, Any]) -> t
 
         return (True, None)
 
+    # Argument keys that carry CONTENT (text/data), never filesystem paths. Skipped
+    # by the key-agnostic escape scan so a path-looking string inside file content
+    # isn't mistaken for a target path.
+    _CONTENT_ARG_KEYS = frozenset(
+        {
+            "content",
+            "contents",
+            "text",
+            "data",
+            "body",
+            "old_string",
+            "new_string",
+            "old_str",
+            "new_str",
+            "patch",
+            "diff",
+            "message",
+            "prompt",
+            "query",
+            "command",
+            "code",
+            "snippet",
+            "description",
+            "instructions",
+            # search patterns may legitimately be absolute-path-looking regex/globs
+            "pattern",
+            "regex",
+            "glob",
+        },
+    )
+
+    def _is_path_within_any_managed_area(self, path: Path) -> bool:
+        """Like ``_is_path_within_allowed_directories`` but ALSO counts
+        ``file_context_parent`` dirs as inside.
+
+        Used by the escape scan so it only flags paths that are TRULY outside every
+        managed area; finer-grained denials (e.g. a sibling file inside a
+        file-context directory) are left to the downstream permission logic, which
+        gives a more specific reason.
+        """
+        resolved = path.resolve()
+        for managed_path in self.managed_paths:
+            if managed_path.contains(resolved) or managed_path.path == resolved:
+                return True
+        return False
+
+    def _validate_no_path_arg_escapes(self, tool_args: dict[str, Any]) -> tuple[bool, str | None]:
+        """Defense in depth: deny if ANY argument value resolves outside allowed dirs.
+
+        Closes the fail-open gap in the primary extractor: a path under an
+        unrecognized key, inside a list, or in a move/copy ``source`` (which the
+        extractor deliberately skips) would otherwise bypass the boundary check.
+
+        Safe against false positives: non-path strings and relative values resolve
+        harmlessly *inside* the workspace, so only genuine absolute-outside /
+        ``..``-escape / symlink-escape values are denied. Content-bearing keys are
+        skipped so file content that merely mentions a path isn't flagged.
+
+        Walks the FULL argument tree (nested dicts and lists), so a path buried under
+        e.g. ``{"opts": {"path": "/etc/passwd"}}`` or ``{"items": [{"path": ...}]}``
+        is caught, not just top-level keys.
+        """
+
+        def walk(obj: Any, key: str | None):
+            if isinstance(obj, str):
+                yield (key, obj)
+            elif isinstance(obj, dict):
+                for k, v in obj.items():
+                    if k in self._CONTENT_ARG_KEYS:
+                        continue
+                    yield from walk(v, k)
+            elif isinstance(obj, (list, tuple)):
+                for item in obj:
+                    yield from walk(item, key)
+
+        for key, cand in walk(tool_args, None):
+            if not cand:
+                continue
+            if "\x00" in cand:
+                return (False, f"Access denied: argument '{key}' contains a null byte.")
+            try:
+                resolved = Pa
```

**File**: `massgen/tests/test_path_permission_hook_adversarial.py` (added, +140/-0)
```diff
@@ -0,0 +1,140 @@
+"""Adversarial audit of PathPermissionManager.pre_tool_use_hook — the app-layer
+that gates every MCP file tool (and the *only* layer for non-srt-wrapped servers).
+
+Each test below is an attempted SANDBOX ESCAPE via a file tool; the hook MUST deny
+it. Vectors: out-of-workspace absolute paths, `..` traversal, symlink-through,
+UNRECOGNIZED path-arg keys (fail-open), list-valued paths, and move/copy `source`
+pointing outside (delete-external / exfiltrate-external).
+"""
+
+import os
+
+import pytest
+
+from massgen.filesystem_manager._base import Permission
+from massgen.filesystem_manager._path_permission_manager import PathPermissionManager
+
+
+@pytest.fixture
+def pm(tmp_path):
+    workspace = tmp_path / "workspace"
+    outside = tmp_path / "outside"
+    secret = outside / "secret.txt"
+    for d in (workspace, outside):
+        d.mkdir(parents=True, exist_ok=True)
+    secret.write_text("TOP SECRET")
+    m = PathPermissionManager(context_write_access_enabled=True)
+    m.add_path(workspace, Permission.WRITE, "workspace")
+    return {"m": m, "workspace": workspace.resolve(), "outside": outside.resolve(), "secret": secret.resolve()}
+
+
+async def _denied(m, tool, args):
+    allowed, _reason = await m.pre_tool_use_hook(tool, args)
+    return not allowed
+
+
+# --------------------------------------------------------------------------- #
+# Baselines that should already hold (resolve() handles these)
+# --------------------------------------------------------------------------- #
+@pytest.mark.asyncio
+async def test_absolute_outside_write_denied(pm):
+    assert await _denied(pm["m"], "write_file", {"path": str(pm["outside"] / "evil.txt"), "content": "x"})
+
+
+@pytest.mark.asyncio
+async def test_dotdot_traversal_write_denied(pm):
+    evil = str(pm["workspace"] / ".." / "outside" / "evil.txt")
+    assert await _denied(pm["m"], "write_file", {"path": evil, "content": "x"})
+
+
+@pytest.mark.asyncio
+async def test_symlink_through_workspace_denied(pm):
+    link = pm["workspace"] / "link"
+    os.symlink(str(pm["outside"]), str(link))
+    assert await _denied(pm["m"], "write_file", {"path": str(link / "evil.txt"), "content": "x"})
+
+
+# --------------------------------------------------------------------------- #
+# The real gaps (these are expected to FAIL pre-hardening = currently ALLOWED)
+# --------------------------------------------------------------------------- #
+@pytest.mark.asyncio
+async def test_unrecognized_path_key_write_denied(pm):
+    # path under a key not in the known list → fail-open today.
+    assert await _denied(pm["m"], "write_file", {"output_path": str(pm["outside"] / "evil.txt"), "content": "x"})
+
+
+@pytest.mark.asyncio
+async def test_arbitrary_key_absolute_path_write_denied(pm):
+    assert await _denied(pm["m"], "store_blob", {"dst": str(pm["outside"] / "evil.txt"), "content": "x"})
+
+
+@pytest.mark.asyncio
+async def test_list_valued_path_write_denied(pm):
+    assert await _denied(pm["m"], "write_files", {"paths": [str(pm["outside"] / "evil.txt")], "content": "x"})
+
+
+@pytest.mark.asyncio
+async def test_move_source_outside_denied(pm):
+    # move deletes the source — a source outside the sandbox must be denied.
+    assert await _denied(pm["m"], "move_file", {"source": str(pm["secret"]), "destination": str(pm["workspace"] / "x")})
+
+
+@pytest.mark.asyncio
+async def test_copy_source_outside_denied(pm):
+    # copy reads the source into the workspace — reading an external file is exfiltration.
+    assert await _denied(pm["m"], "copy_file", {"source_path": str(pm["secret"]), "destination_path": str(pm["workspace"] / "x")})
+
+
+# --------------------------------------------------------------------------- #
+# Must NOT over-block legitimate in-workspace use (guard against false positives)
+# --------------------------------------------------------------------------- #
+@pytest.mark.asyncio
+async def test_in_workspace_write_allowed(pm):
+    allowed, _ = await pm["m"].pre_tool_use_hook("write_file", {"path": str(pm["workspace"] / "ok.txt"), "content": "hi"})
+    assert allowed
+
+
+@pytest.mark.asyncio
+async def test_content_with_pathlike_text_not_blocked(pm):
+    # 'content' holds text that merely looks like a path — must not be treated as a path.
+    allowed, _ = await pm["m"].pre_tool_use_hook(
+        "write_file",
+        {"path": str(pm["workspace"] / "ok.txt"), "content": "see /etc/passwd for details"},
+    )
+    assert allowed
+
+
+@pytest.mark.asyncio
+async def test_content_equal_to_absolute_path_not_blocked(pm):
+    # The whole content value being an absolute path is still CONTENT (written into a
+    # workspace file), not a target — must not be denied.
+    allowed, _ = await pm["m"].pre_tool_use_hook(
+        "write_file",
+        {"path": str(pm["workspace"] / "cfg"), "content": str(pm["secret"])},
+    )
+    assert allowed
+
+
+# --------------------------------------------------------------------------- #
+
```

---

### Incident Patch 4: `56b47abd` (2026-06-08)
**Commit Message**: fix: address CodeRabbit/Copilot review on PR #1114

- entrypoint: export MASSGEN_RUNTIME_INBOX_DIR for ALL session modes
  (new + --session-id + config-restored + --continue). The export lived
  inside the new-session branch, so resumed runs silently dropped
  programmatic steering. Extracted to a testable _resolve_runtime_inbox
  helper. (Copilot/CR Major)
- backends: honor expires_at in read_unconsumed_hook_content() round-end
  carryforward so stale steering can't trigger an unexpected
  interrupt/resume; applied to both antigravity_cli and codex for parity.
  (CR Major)
- backends: stop swallowing non-cancellation watcher failures during
  interrupt/resume cleanup; log at debug instead (Ruff S110/BLE001).
  Applied to both antigravity_cli and codex.
- docs: add `text` language to fenced block in worktrees.md (MD040).

Tests: expired/fresh/malformed carryforward guards for both backends;
_resolve_runtime_inbox export coverage for all session modes.

Co-Authored-By: Claude Opus 4.8 (1M context) <[REDACTED_EMAIL]>

**File**: `docs/modules/worktrees.md` (modified, +1/-1)
```diff
@@ -41,7 +41,7 @@ When an agent has **no writable `context_paths`**, the workspace itself is the a
 2. **Creates and checks out a fresh branch** for the round: `git checkout -b massgen/{hex}`.
 3. Creates the git-excluded `.massgen_scratch/`.
 
-```
+```text
 Round 1 (in-place)              Round 2 (in-place)
 ──────────────────────────      ──────────────────────────
 checkout -b massgen/a1b2c3d4    checkout -b massgen/e5f6g7h8
```

**File**: `massgen/backend/antigravity_cli.py` (modified, +16/-1)
```diff
@@ -662,6 +662,17 @@ def read_unconsumed_hook_content(self) -> str | None:
         try:
             data = json.loads(hook_file.read_text(encoding="utf-8"))
             hook_file.unlink(missing_ok=True)
+            # Honor payload freshness: a stale carryforward could trigger an
+            # unexpected interrupt/resume on the next round. Mirror the
+            # middleware's expires_at handling (hook_middleware.py).
+            expires_at = data.get("expires_at")
+            if expires_at is not None:
+                try:
+                    if time.time() > float(expires_at):
+                        logger.debug(f"Antigravity CLI: dropping expired unconsumed hook (expires_at={expires_at})")
+                        return None
+                except (TypeError, ValueError):
+                    logger.warning(f"Antigravity CLI: invalid expires_at {expires_at!r} in hook file; treating as non-expiring")
             content = data.get("inject", {}).get("content")
             if content:
                 logger.info(f"Antigravity CLI: read unconsumed hook content ({len(content)} chars) — carrying forward")
@@ -1226,8 +1237,12 @@ async def _watch(p: asyncio.subprocess.Process = proc) -> None:
             watcher.cancel()
             try:
                 await watcher
-            except (asyncio.CancelledError, Exception):
+            except asyncio.CancelledError:
                 pass
+            except Exception:
+                # A non-cancellation failure here means a real watcher bug during
+                # interrupt/resume finalization — don't mask it silently.
+                logger.debug("Antigravity CLI: watcher failed during cleanup", exc_info=True)
 
         # Interrupted by steering → promote any work agy did (so pre-interrupt
         # deliverables aren't lost), then end this run; _stream_local resumes.
```

**File**: `massgen/backend/codex.py` (modified, +16/-1)
```diff
@@ -481,6 +481,17 @@ def read_unconsumed_hook_content(self) -> str | None:
         try:
             data = json.loads(hook_file.read_text(encoding="utf-8"))
             hook_file.unlink(missing_ok=True)
+            # Honor payload freshness: a stale carryforward could trigger an
+            # unexpected interrupt/resume on the next round. Mirror the
+            # middleware's expires_at handling (hook_middleware.py).
+            expires_at = data.get("expires_at")
+            if expires_at is not None:
+                try:
+                    if time.time() > float(expires_at):
+                        logger.debug(f"Dropping expired unconsumed hook (expires_at={expires_at})")
+                        return None
+                except (TypeError, ValueError):
+                    logger.warning(f"Invalid expires_at {expires_at!r} in hook file; treating as non-expiring")
             inject = data.get("inject", {})
             content = inject.get("content")
             if content:
@@ -2355,8 +2366,12 @@ async def _watch(p: asyncio.subprocess.Process = proc) -> None:
                 watcher.cancel()
                 try:
                     await watcher
-                except (asyncio.CancelledError, Exception):
+                except asyncio.CancelledError:
                     pass
+                except Exception:
+                    # A non-cancellation failure here means a real watcher bug
+                    # during interrupt/resume finalization — don't mask it.
+                    logger.debug("Codex: watcher failed during cleanup", exc_info=True)
 
             await proc.wait()
 
```

**File**: `massgen/cli/entrypoint.py` (modified, +22/-11)
```diff
@@ -101,6 +101,25 @@
 )
 
 
+def _resolve_runtime_inbox(args) -> Path | None:
+    """Resolve ``--inbox-dir`` and export ``MASSGEN_RUNTIME_INBOX_DIR``.
+
+    Programmatic steering: an explicit ``--inbox-dir`` makes mid-stream human
+    input reachable without a UI. This runs for ALL session modes (new,
+    ``--session-id``, config-restored, ``--continue``) so the orchestrator's
+    inbox-poller resolver targets the caller-known directory regardless of how
+    the session was started. Returns the resolved dir (also exported to the
+    environment) or ``None`` when no override was given.
+    """
+    inbox_dir_arg = getattr(args, "inbox_dir", None)
+    if not inbox_dir_arg:
+        return None
+    resolved_inbox = Path(inbox_dir_arg).expanduser().resolve()
+    resolved_inbox.mkdir(parents=True, exist_ok=True)
+    os.environ["MASSGEN_RUNTIME_INBOX_DIR"] = str(resolved_inbox)
+    return resolved_inbox
+
+
 async def main(args):
     """Main CLI entry point (async operations only)."""
     # Setup logging (only for actual agent runs, not special commands)
@@ -552,6 +571,9 @@ def _save_prompt_metadata_failure_fallback(
         elif "agents" in config and config["agents"]:
             model_name = config["agents"][0].get("backend", {}).get("model")
 
+        # Resolve --inbox-dir for ALL session modes (new + resumed). See helper.
+        resolved_inbox: Path | None = _resolve_runtime_inbox(args)
+
         # Priority order: CLI arg > config file > generate new
         if args.session_id:
             # Use session_id from CLI argument (already validated) - RESTORE existing
@@ -587,17 +609,6 @@ def _save_prompt_metadata_failure_fallback(
             log_dir = get_log_session_root()
             log_dir_name = log_dir.name
 
-            # Programmatic steering: an explicit --inbox-dir makes mid-stream
-            # human input reachable without a UI. Export it so the orchestrator's
-            # inbox-poller resolver (which reads MASSGEN_RUNTIME_INBOX_DIR) targets
-            # this deterministic, caller-known directory.
-            inbox_dir_arg = getattr(args, "inbox_dir", None)
-            resolved_inbox: Path | None = None
-            if inbox_dir_arg:
-                resolved_inbox = Path(inbox_dir_arg).expanduser().resolve()
-                resolved_inbox.mkdir(parents=True, exist_ok=True)
-                os.environ["MASSGEN_RUNTIME_INBOX_DIR"] = str(resolved_inbox)
-
             # Print LOG_DIR for automation mode (LLM agents need this to monitor progress)
             # LOG_DIR is the main session directory, STATUS includes turn/attempt subdirectory
             if args.automation:
```

**File**: `massgen/tests/test_antigravity_cli_backend.py` (modified, +29/-0)
```diff
@@ -13,6 +13,7 @@
 import asyncio
 import json
 import os
+import time
 from pathlib import Path
 from unittest.mock import AsyncMock, patch
 
@@ -1336,6 +1337,34 @@ def test_clear_hook_files(self, backend):
         backend.clear_hook_files()
         assert not (backend.get_hook_dir() / "hook_post_tool_use.json").exists()
 
+    def test_read_unconsumed_drops_expired_payload(self, backend):
+        # A stale carryforward must not resurrect old steering at the next round.
+        hook_file = backend.get_hook_dir() / "hook_post_tool_use.json"
+        hook_file.parent.mkdir(parents=True, exist_ok=True)
+        hook_file.write_text(
+            json.dumps({"inject": {"content": "stale steer"}, "expires_at": 1.0}),
+        )
+        assert backend.read_unconsumed_hook_content() is None
+        # Expired payload is consumed (removed), not left to leak forward.
+        assert not hook_file.exists()
+
+    def test_read_unconsumed_returns_fresh_payload(self, backend):
+        hook_file = backend.get_hook_dir() / "hook_post_tool_use.json"
+        hook_file.parent.mkdir(parents=True, exist_ok=True)
+        hook_file.write_text(
+            json.dumps({"inject": {"content": "fresh steer"}, "expires_at": time.time() + 3600}),
+        )
+        assert backend.read_unconsumed_hook_content() == "fresh steer"
+
+    def test_read_unconsumed_tolerates_bad_expires_at(self, backend):
+        # A malformed guard must not drop a real payload (fail-open, like middleware).
+        hook_file = backend.get_hook_dir() / "hook_post_tool_use.json"
+        hook_file.parent.mkdir(parents=True, exist_ok=True)
+        hook_file.write_text(
+            json.dumps({"inject": {"content": "keep me"}, "expires_at": "not-a-number"}),
+        )
+        assert backend.read_unconsumed_hook_content() == "keep me"
+
 
 class TestInterruptResume:
     """agy mid-round interrupt-and-resume steering (kill + `agy --continue`)."""
```

**File**: `massgen/tests/test_codex_interrupt_resume.py` (modified, +30/-0)
```diff
@@ -7,6 +7,8 @@
 from __future__ import annotations
 
 import asyncio
+import json
+import time
 from pathlib import Path
 from unittest.mock import patch
 
@@ -50,3 +52,31 @@ def test_resume_command_uses_session_id_and_prompt(tmp_path):
     assert "resume" in cmd
     assert "sess-123" in cmd
     assert "steer me" in cmd
+
+
+def _write_hook(tmp_path: Path, payload: dict) -> Path:
+    hook_dir = tmp_path / ".codex"
+    hook_dir.mkdir(parents=True, exist_ok=True)
+    hook_file = hook_dir / "hook_post_tool_use.json"
+    hook_file.write_text(json.dumps(payload))
+    return hook_file
+
+
+def test_read_unconsumed_drops_expired_payload(tmp_path):
+    # Parity with antigravity: a stale carryforward must not resurrect old steering.
+    b = _make_backend(tmp_path)
+    hook_file = _write_hook(tmp_path, {"inject": {"content": "stale"}, "expires_at": 1.0})
+    assert b.read_unconsumed_hook_content() is None
+    assert not hook_file.exists()
+
+
+def test_read_unconsumed_returns_fresh_payload(tmp_path):
+    b = _make_backend(tmp_path)
+    _write_hook(tmp_path, {"inject": {"content": "fresh"}, "expires_at": time.time() + 3600})
+    assert b.read_unconsumed_hook_content() == "fresh"
+
+
+def test_read_unconsumed_tolerates_bad_expires_at(tmp_path):
+    b = _make_backend(tmp_path)
+    _write_hook(tmp_path, {"inject": {"content": "keep"}, "expires_at": "nan-ish"})
+    assert b.read_unconsumed_hook_content() == "keep"
```

**File**: `massgen/tests/test_steering_inbox.py` (modified, +33/-0)
```diff
@@ -16,10 +16,12 @@
 from __future__ import annotations
 
 import json
+import os
 from types import SimpleNamespace
 
 import pytest
 
+from massgen.cli.entrypoint import _resolve_runtime_inbox
 from massgen.mcp_tools.hooks import HumanInputHook, RuntimeInboxPoller
 from massgen.orchestrator_collaborators.runtime_input_delivery import (
     RuntimeInputDelivery,
@@ -103,6 +105,37 @@ def test_no_override_no_workspace_yields_no_poller(self, tmp_path, monkeypatch):
         assert orch._runtime_inbox_poller is None
 
 
+class TestResolveRuntimeInbox:
+    """The CLI helper exports --inbox-dir for EVERY session mode (not just new).
+
+    Regression: the export used to live inside the new-session branch of main(),
+    so runs started with --session-id / config session_id / --continue silently
+    dropped programmatic steering. The helper runs before the branch, fixing all.
+    """
+
+    def test_exports_env_var_and_creates_dir(self, tmp_path, monkeypatch):
+        monkeypatch.delenv("MASSGEN_RUNTIME_INBOX_DIR", raising=False)
+        inbox = tmp_path / "deep" / "inbox"
+        args = SimpleNamespace(inbox_dir=str(inbox))
+
+        resolved = _resolve_runtime_inbox(args)
+
+        assert resolved == inbox.resolve()
+        assert inbox.exists()  # mkdir(parents=True) ran
+        assert os.environ["MASSGEN_RUNTIME_INBOX_DIR"] == str(inbox.resolve())
+
+    def test_no_inbox_dir_is_noop(self, tmp_path, monkeypatch):
+        monkeypatch.delenv("MASSGEN_RUNTIME_INBOX_DIR", raising=False)
+        args = SimpleNamespace(inbox_dir=None)
+
+        assert _resolve_runtime_inbox(args) is None
+        assert "MASSGEN_RUNTIME_INBOX_DIR" not in os.environ
+
+    def test_missing_attr_is_noop(self, monkeypatch):
+        monkeypatch.delenv("MASSGEN_RUNTIME_INBOX_DIR", raising=False)
+        assert _resolve_runtime_inbox(SimpleNamespace()) is None
+
+
 class TestPollRoutesToChokepoint:
     """A dropped steering message reaches set_pending_input with right targeting."""
 
```

---

### Incident Patch 5: `3c350bec` (2026-06-07)
**Commit Message**: fix(hooks): coerce middleware hook_dir to Path; prove fastmcp-run stdio deployment works

Follow-up to the Codex middleware investigation. Correcting the earlier
conclusion: a free stdio reproduction shows the middleware DOES fire via the real
`fastmcp run <module>:create_server` deployment — but only when hook_dir is a
Path. MassGenHookMiddleware.__init__ stored hook_dir verbatim, so a raw str makes
`self._hook_dir / "..."` raise TypeError inside the swallowed try/except in
on_call_tool — i.e. SILENT non-delivery. All current callers wrap in Path(), but
coerce defensively so this can't regress.

- hook_middleware: __init__ now accepts Path|str and coerces to Path.
- test_mcp_hook_middleware: TestStdioDeploymentInvocation launches a server via
  `fastmcp run :create_server` over stdio and asserts the middleware injects
  (free, no model calls) — proving the deployment path is sound. Plus the
  in-memory TestRealFastMCPInvocation.
- Updated the live-Codex xfail reason: since the middleware is proven to work both
  in-memory and via fastmcp-run stdio, the live-Codex non-delivery is narrowed to
  the Codex MCP client / per-server wiring, not the middleware or transport.

Co-Authored-B

**File**: `massgen/mcp_tools/hook_middleware.py` (modified, +5/-2)
```diff
@@ -84,8 +84,11 @@ class MassGenHookMiddleware(Middleware):
     _RUNTIME_INPUT_KEY = "massgen_runtime_input"
     _RUNTIME_INPUT_PRIORITY_KEY = "massgen_runtime_input_priority"
 
-    def __init__(self, hook_dir: Path) -> None:
-        self._hook_dir = hook_dir
+    def __init__(self, hook_dir: Path | str) -> None:
+        # Coerce to Path: a string slips through (callers wrap in Path today, but
+        # a raw str would make `self._hook_dir / "..."` raise TypeError inside the
+        # swallowed try/except in on_call_tool — i.e. silent non-delivery).
+        self._hook_dir = Path(hook_dir)
         self._last_post_sequence: int = -1
 
     async def on_call_tool(self, context: Any, call_next: Any) -> Any:
```

**File**: `massgen/tests/test_codex_middleware_firing_live.py` (modified, +11/-10)
```diff
@@ -87,16 +87,17 @@ def _injection_reached_codex(massgen_log: Path, sentinel: str) -> bool:
 @pytest.mark.live_api
 @pytest.mark.expensive
 @pytest.mark.xfail(
-    reason="The Codex MCP-injection middleware does not deliver in the real "
-    "deployment (verified 2026-06-07 with instrumentation): the middleware LOGIC "
-    "is correct and fires through real FastMCP in-memory "
-    "(test_mcp_hook_middleware.TestRealFastMCPInvocation passes), but when the "
-    "MassGen MCP servers run via `fastmcp run <module>:create_server` over stdio, "
-    "`on_call_tool` is NEVER invoked — Codex called a middleware-attached planning "
-    "server 20x with valid fresh payloads in the correct hook_dir and the steered "
-    "content never reached Codex. The bug is in the fastmcp-run/stdio launch path, "
-    "not the middleware. Codex mid-stream injection effectively relies on round-end "
-    "carryforward + round-start system-message injection. XPASS => launch path fixed.",
+    reason="The Codex MCP-injection middleware did not deliver in a live Codex run "
+    "(verified 2026-06-07): Codex called a middleware-attached planning server 20x "
+    "with valid fresh payloads in the correct hook_dir, yet the steered content "
+    "never reached Codex. NOTE the middleware itself is proven to work both "
+    "in-memory and via the real `fastmcp run <module>:create_server` STDIO "
+    "deployment (see test_mcp_hook_middleware.TestRealFastMCPInvocation and "
+    "TestStdioDeploymentInvocation, both passing). So the remaining gap is "
+    "Codex-MCP-client / per-server-wiring specific, not the middleware or the "
+    "transport. Codex mid-stream injection currently relies on round-end "
+    "carryforward + round-start system-message injection. XPASS => the live gap is "
+    "closed.",
     strict=False,
 )
 def test_codex_mcp_middleware_injects_steering(tmp_path):
```

**File**: `massgen/tests/test_mcp_hook_middleware.py` (modified, +55/-0)
```diff
@@ -340,3 +340,58 @@ def echo(x: str) -> str:
         assert any("ISO" in t for t in texts), "middleware did not inject through real FastMCP server"
         # Payload consumed on success.
         assert not (tmp_path / "hook_post_tool_use.json").exists()
+
+
+class TestStdioDeploymentInvocation:
+    """Prove the middleware fires when the server is launched via
+    `fastmcp run <module>:create_server` over STDIO — the exact deployment Codex
+    uses. Free (local fastmcp subprocess, no model calls). This passing test
+    establishes the deployment path is sound, narrowing any live-Codex
+    non-delivery to the Codex MCP client / per-server wiring, not the middleware
+    or the fastmcp-run/stdio transport.
+    """
+
+    @pytest.mark.integration
+    @pytest.mark.asyncio
+    async def test_middleware_injects_via_fastmcp_run_stdio(self, tmp_path: Path) -> None:
+        import shutil
+        import textwrap
+
+        if not shutil.which("fastmcp"):
+            pytest.skip("fastmcp CLI not on PATH")
+
+        from fastmcp import Client
+        from fastmcp.client.transports import StdioTransport
+
+        server_file = tmp_path / "srv.py"
+        server_file.write_text(
+            textwrap.dedent(
+                """
+                import os
+                from pathlib import Path
+                from fastmcp import FastMCP
+                from massgen.mcp_tools.hook_middleware import MassGenHookMiddleware
+
+                async def create_server():
+                    mcp = FastMCP("iso-stdio")
+                    @mcp.tool
+                    def echo(x: str) -> str:
+                        return f"echo:{x}"
+                    mcp.add_middleware(MassGenHookMiddleware(Path(os.environ["ISO_HOOK_DIR"])))
+                    return mcp
+                """,
+            ),
+            encoding="utf-8",
+        )
+        _write_hook_file(tmp_path, _make_payload(content="[Human Input]: STDIO"))
+
+        import os as _os
+
+        env = {**_os.environ, "ISO_HOOK_DIR": str(tmp_path)}
+        transport = StdioTransport(command="fastmcp", args=["run", f"{server_file}:create_server"], env=env)
+        async with Client(transport) as client:
+            res = await client.call_tool("echo", {"x": "hi"})
+
+        texts = [getattr(b, "text", "") for b in res.content]
+        assert any("echo:hi" in t for t in texts)
+        assert any("STDIO" in t for t in texts), "middleware did not inject via fastmcp-run stdio deployment"
```

---

### Incident Patch 6: `b17d6e5e` (2026-06-07)
**Commit Message**: fix(antigravity): set native-hook hook_dir at orchestrator fetch time (round-1 hook gap)

The orchestrator builds an agent's native hooks config by calling
get_native_hook_adapter() then adapter.build_native_hooks_config() during
per-round hook setup — BEFORE the backend's stream runs _write_hooks_json
(the lazy place hook_dir was set). On a fresh backend the adapter's hook_dir
was None at that point, so build_native_hooks_config returned {} and the
INITIAL-answer round ran with no MassGen native hooks: the
"[GeminiCLINativeHookAdapter] No hook_dir set" warning fired once, no
hooks.json was written for round 1, and only round 2+ recovered (the adapter
instance persisted the hook_dir set by round 1's stream). Confirmed in two
real runs (warning once at startup; hooks.json written only from round 2 on).

gemini_cli avoids this by setting hook_dir in __init__, but at construction the
workspace isn't known (filesystem_manager unset, cwd may be a relative config
value), which would bake a stale path into the hook command. Instead, override
get_native_hook_adapter() to set adapter.hook_dir = _workspace_config_dir() —
the orchestrator's exact fetch point, by which time cwd resolves correc

**File**: `massgen/backend/antigravity_cli.py` (modified, +30/-1)
```diff
@@ -100,7 +100,12 @@ class AntigravityCLIBackend(NativeToolBackendMixin, StreamingBufferMixin, LLMBac
     Inherits ``NativeToolBackendMixin`` for native-hook adapter wiring and
     ``StreamingBufferMixin`` for context-compression recovery. Hooks use the
     ``AntigravityCLINativeHookAdapter`` (a thin subclass of the Gemini CLI
-    adapter — same exa.hooks_pb schema, same settings.json shape).
+    adapter): the hook *payload* shape is identical to Gemini CLI's
+    (``{"hooks": {"BeforeTool": [...], "AfterTool": [...]}}``, subprocess
+    JSON-stdin/stdout IPC), but agy reads it from a **standalone
+    ``hooks.json``** gated by ``enableJsonHooks: true`` in ``settings.json`` —
+    NOT embedded under ``settings.json["hooks"]`` the way Gemini CLI does. See
+    :meth:`_write_hooks_json` / :meth:`get_native_hook_adapter`.
     """
 
     def __init__(self, api_key: str | None = None, **kwargs):
@@ -564,6 +569,30 @@ def _restore_hooks_json(self) -> None:
             except OSError as exc:
                 logger.warning(f"Antigravity CLI: failed to remove {hooks_path}: {exc}")
 
+    def get_native_hook_adapter(self) -> Any | None:
+        """Return the native hook adapter with ``hook_dir`` wired to the workspace.
+
+        The orchestrator fetches the adapter via this accessor immediately
+        before calling ``adapter.build_native_hooks_config(...)`` during per-round
+        hook setup — which happens BEFORE our stream ever runs
+        :meth:`_write_hooks_json` (the old, lazy place ``hook_dir`` got set). If
+        ``hook_dir`` is still ``None`` at build time, ``build_native_hooks_config``
+        returns ``{}`` and that round runs with **no** MassGen native hooks. On a
+        fresh backend this bit the **initial-answer round** specifically: the
+        ``[GeminiCLINativeHookAdapter] No hook_dir set`` warning fired once, no
+        ``hooks.json`` was written, and only round 2+ recovered (because the
+        adapter instance persisted the ``hook_dir`` set by round 1's stream).
+
+        Setting it here closes that gap. By the time the orchestrator runs,
+        ``filesystem_manager`` is attached so :meth:`cwd` is correct — unlike
+        ``__init__`` (gemini_cli.py:92-95), where the workspace isn't known yet
+        and a construction-time path would be baked into the hook command.
+        """
+        adapter = self._native_hook_adapter
+        if adapter is not None and hasattr(adapter, "hook_dir"):
+            adapter.hook_dir = self._workspace_config_dir()
+        return adapter
+
     # ── Command construction ──────────────────────────────────────────────
 
     def _agy_log_file_path(self) -> Path:
```

**File**: `massgen/tests/test_antigravity_cli_backend.py` (modified, +67/-0)
```diff
@@ -621,6 +621,73 @@ def test_write_sets_adapter_hook_dir_to_workspace_config_dir(self, backend, tmp_
             assert adapter.hook_dir == backend._workspace_config_dir()
 
 
+class TestNativeHookDirWiringRound1:
+    """Regression for the round-1 native-hook gap.
+
+    The orchestrator builds the native hooks config by calling
+    ``get_native_hook_adapter()`` and then ``adapter.build_native_hooks_config()``
+    BEFORE the backend's stream ever runs ``_write_hooks_json`` (which is where
+    ``hook_dir`` used to be set lazily). On the very first round the adapter's
+    ``hook_dir`` was therefore ``None``, so ``build_native_hooks_config`` returned
+    ``{}`` and the initial-answer round ran with NO MassGen native hooks.
+
+    These tests drive the REAL build path — they do NOT pre-populate
+    ``_massgen_hooks_config`` (which is what let the older TestHooksJsonWiring
+    tests pass despite the bug).
+    """
+
+    def _manager_with_hooks(self):
+        from massgen.mcp_tools.hooks import (
+            GeneralHookManager,
+            HookType,
+            PythonCallableHook,
+        )
+
+        manager = GeneralHookManager()
+        manager.register_global_hook(
+            HookType.PRE_TOOL_USE,
+            PythonCallableHook(name="t_pre", handler=lambda _e: None, matcher="*"),
+        )
+        manager.register_global_hook(
+            HookType.POST_TOOL_USE,
+            PythonCallableHook(name="t_post", handler=lambda _e: None, matcher="*"),
+        )
+        return manager
+
+    def test_get_native_hook_adapter_sets_hook_dir(self, backend):
+        # The orchestrator fetches the adapter via this accessor right before
+        # building the config. It must come back with hook_dir already set.
+        adapter = backend.get_native_hook_adapter()
+        assert adapter is not None
+        assert adapter.hook_dir is not None, "hook_dir is None at orchestrator build time — round-1 hooks lost"
+        assert Path(adapter.hook_dir) == backend._workspace_config_dir()
+
+    def test_build_native_hooks_config_nonempty_on_first_round(self, backend):
+        # Simulate exactly what the orchestrator does on round 1: fetch adapter,
+        # then build. Must NOT return {} (the round-1 bug).
+        manager = self._manager_with_hooks()
+        adapter = backend.get_native_hook_adapter()
+        cfg = adapter.build_native_hooks_config(manager, agent_id="agent_b")
+        assert cfg.get("hooks"), f"round-1 build returned empty config: {cfg!r}"
+        assert "BeforeTool" in cfg["hooks"]
+        assert "AfterTool" in cfg["hooks"]
+
+    def test_full_round1_flow_writes_hooks_json_and_enables_flag(self, backend):
+        # End-to-end round-1 simulation: orchestrator builds + sets the config,
+        # then the backend's stream-time _write_hooks_json must actually emit a
+        # hooks.json and the enableJsonHooks gate.
+        manager = self._manager_with_hooks()
+        adapter = backend.get_native_hook_adapter()
+        backend.set_native_hooks_config(adapter.build_native_hooks_config(manager, agent_id="agent_b"))
+        wrote = backend._write_hooks_json()
+        assert wrote is True, "round-1 _write_hooks_json wrote nothing — native hooks missing in initial round"
+        backend._write_workspace_settings_json(has_hooks=wrote)
+        hooks_path = backend._workspace_hooks_json_path()
+        assert hooks_path.exists()
+        settings = json.loads((backend._workspace_config_dir() / "settings.json").read_text())
+        assert settings.get("enableJsonHooks") is True
+
+
 class TestAgentsMdAtomicity:
     """AGENTS.md write/restore must survive interruptions cleanly."""
 
```

---

### Incident Patch 7: `839c6667` (2026-06-07)
**Commit Message**: fix(antigravity): wire up real --model flag + promote scratch deliverables; document per-round workspace reset

agy 1.0.5+ added a real --model flag (exact `agy models` label) and 1.0.x
routes write_to_file into its hidden .antigravity/scratch when the workspace
path looks "hidden" (our .massgen/ dot-path), so deliverables were dropped from
snapshots. Both verified live against agy 1.0.6 + one integration run.

Backend (massgen/backend/antigravity_cli.py):
- Resolve configured model -> exact agy label (AGY_MODEL_LABELS/ALIASES) and
  emit `--model`; unresolvable ids fall back to agy default (no bad flag).
- Add scratch-promotion safety net: after each run, copy new files from
  .antigravity/.../scratch into the visible workspace root (never clobbering a
  file the model already placed). No-op when scratch is empty.
- Update stale docstrings/config comments that claimed agy has no --model flag.

Tests (test_antigravity_cli_backend.py): model resolution + command-flag cases
(replacing the stale "never emit --model" test) and TestScratchPromotion.

Docs: document the per-round workspace reset that this work surfaced —
clear_workspace() is disabled (since v0.0.22 / f90f83b4); the real 

**File**: `docs/modules/architecture.md` (modified, +1/-0)
```diff
@@ -71,6 +71,7 @@ Agents are STATELESS and ANONYMOUS across coordination rounds. Each round:
 - Agent does not know which agent it is (all identities are anonymous)
 - Cross-agent information (answers, workspaces) is presented anonymously
 - System prompts and branch names must NOT reveal agent identity or round history
+- **Statelessness extends to the filesystem.** Under `write_mode`, the working tree is wiped to a clean state between rounds (only `.git/` survives), so an agent does not inherit its own prior round's leftover files — including native-CLI session dirs like `.antigravity/` / `.codex/`. Prior work is preserved in per-round branches + snapshots and surfaced via `temp_workspaces/`. NOTE: this per-round reset is done by `IsolationContextManager._clear_workspace_between_rounds()`, **not** by `Orchestrator.clear_workspace()` (disabled since v0.0.22). See [worktrees.md → Per-Round Workspace Reset](worktrees.md#per-round-workspace-reset).
 
 ## Logging Architecture: Session-Scoped Isolation
 
```

**File**: `docs/modules/worktrees.md` (modified, +56/-1)
```diff
@@ -2,7 +2,16 @@
 
 ## Overview
 
-When `write_mode` is enabled, agents work in git worktrees — isolated checkouts of the user's project. Each coordination round, every agent gets a fresh worktree with its own branch. Branches are preserved across rounds for cross-agent visibility, and scratch files are archived for continuity.
+When `write_mode` is enabled, agents work under git isolation — each coordination round gets its own branch, branches are preserved across rounds for cross-agent visibility, and scratch files are archived for continuity.
+
+There are **two isolation modes**, chosen by whether the agent has writable `context_paths`:
+
+| Mode | When | Where the agent works | Code path |
+|------|------|-----------------------|-----------|
+| **Worktree mode** | Writable `context_paths` exist | A separate git *worktree* checkout per context path (`{workspace}/.worktree/`) | `initialize_context()` |
+| **Workspace mode** | No `context_paths` (the workspace *is* the project) | **In place**, in the agent's own workspace dir, on a per-round branch | `setup_workspace_scratch()` |
+
+Both live in `IsolationContextManager` (`massgen/filesystem_manager/_isolation_context_manager.py`). The single-agent/native-CLI configs (antigravity, codex, claude_code) typically run in **workspace mode** — see [Workspace Mode](#workspace-mode-in-place) and [Per-Round Workspace Reset](#per-round-workspace-reset) below, which document the in-place lifecycle that the worktree-mode diagram does not show.
 
 ## Lifecycle
 
@@ -22,6 +31,52 @@ cleanup_round()                  cleanup_round()
                                                                   └─ delete all branches
 ```
 
+## Workspace Mode (in-place)
+
+When an agent has **no writable `context_paths`**, the workspace itself is the agent's project. Instead of a separate worktree checkout, the agent works **in place** in its own workspace directory, and isolation is done with per-round branches on a repo that lives *inside* the workspace.
+
+`setup_workspace_scratch()` (`_isolation_context_manager.py`), called at the **start** of each round:
+
+1. **Git-inits the workspace as its own standalone repo** if it isn't already one — `[INIT] MassGen workspace` commit. (It deliberately uses `_is_own_git_root`, not `is_git_repo`, so it never creates branches on the parent project repo even though the workspace lives under `.massgen/workspaces/`.)
+2. **Creates and checks out a fresh branch** for the round: `git checkout -b massgen/{hex}`.
+3. Creates the git-excluded `.massgen_scratch/`.
+
+```
+Round 1 (in-place)              Round 2 (in-place)
+──────────────────────────      ──────────────────────────
+checkout -b massgen/a1b2c3d4    checkout -b massgen/e5f6g7h8
+agent writes files in place     (workspace was wiped clean first — see below)
+     │                                │
+     ▼                                ▼
+cleanup_round() [workspace mode]:
+  ├─ auto-commit work → branch  ([ROUND] Auto-commit)
+  ├─ git checkout main          (switch off the round branch, keep it)
+  └─ _clear_workspace_between_rounds()   ← wipes everything except .git
+```
+
+## Per-Round Workspace Reset
+
+**The workspace is wiped to a clean state between every round.** This is the single most surprising part of the lifecycle, so it is called out explicitly:
+
+- **It is NOT done by `Orchestrator.clear_workspace()`.** That call site (`orchestrator.py`, in the per-round setup) has been **commented out since commit `f90f83b4` / v0.0.22** (disabled for performance). Do not reason about per-round clearing from that method — it never runs.
+- **It IS done by `_clear_workspace_between_rounds()`** (`_isolation_context_manager.py`), invoked from `cleanup_round()` in workspace mode. It `rmtree`s **everything except `.git/`**:
+
+  > *"Remove all non-.git files from workspace ... so the next round starts with a clean workspace."*
+
+  This runs **after** the round's work is auto-committed to that round's branch, so nothing is lost — it just clears the *working tree*.
+
+### What this means
+
+- **Round independence holds.** Each round starts from a clean working tree on the base branch. An agent does **not** see its own prior round's leftover files sitting in the workspace; it sees prior answers only through the normal `<CURRENT ANSWERS>` injection + `temp_workspaces/` snapshots, the same as every other backend. Native-CLI metadata (e.g. agy's `.antigravity/`, codex's `.codex/`) is wiped too, so those backends get **no carried-over hidden session memory** across rounds.
+- **The live workspace symlink only shows the *current* round.** `…/agent_b/workspace` is a symlink to the live workspace dir. Mid-run (or on an interrupted run) it reflects only the in-progress round — often just `AGENTS.md` written at round start. It is **not** where finished deliverables accumulate. Don't judge a run's output by the live symlink.
+- **Where a round's work actually lives** (three durable copies):
+  1. **Per-round 
```

**File**: `docs/source/user_guide/agent_workspaces.rst` (modified, +12/-1)
```diff
@@ -77,7 +77,18 @@ This means:
 - Agents don't know which agent they are
 - System prompts and branch names don't reveal identity
 - Cross-agent answers and workspaces are presented anonymously
-- Each round starts fresh from HEAD (no accumulated state)
+- Each round starts fresh from HEAD (no accumulated state): the working tree
+  is wiped clean between rounds (only ``.git/`` survives), after the round's
+  work is auto-committed to its branch. An agent does not inherit its own
+  prior round's leftover files.
+
+.. note::
+
+   The live ``…/agent_<id>/workspace`` symlink reflects only the *current*
+   round's in-progress state — not where finished deliverables accumulate.
+   A round's output lives in its git branch, in the per-round log snapshots
+   (``…/agent_<id>/<timestamp>/workspace/`` and ``turn_*/final/…``), and in
+   the shared ``temp_workspaces/`` copies.
 
 Migrating from use_two_tier_workspace
 ---------------------------------------
```

**File**: `massgen/backend/antigravity_cli.py` (modified, +164/-7)
```diff
@@ -12,9 +12,11 @@
   ``<cwd>/.antigravity/antigravity-cli/brain/<uuid>/.system_generated/logs/``
   concurrently with the subprocess to get real-time thinking + tool events,
   and forward stdout lines as content chunks on process exit.
-- No ``--model``: the model is selected server-side per the user's
-  Antigravity tier (Gemini 3.5 Flash by default). A ``model`` config value
-  is accepted for logging/registry consistency but ignored at invocation.
+- ``--model``: agy 1.0.5+ exposes a real ``--model`` flag taking an exact
+  label from ``agy models`` (e.g. ``"Gemini 3.5 Flash (High)"``). The
+  configured ``model`` is resolved to such a label (exact or via alias) and
+  passed through; unrecognizable ids fall back to agy's default rather than
+  failing the call. See ``AGY_MODEL_LABELS`` / ``AGY_MODEL_ALIASES``.
 - ``--conversation <id>`` replaces ``--resume <id>``.
 - ``--dangerously-skip-permissions`` replaces ``--approval-mode yolo``.
 - Per-project isolation via the hidden ``--gemini_dir <abs_path>`` flag (not
@@ -50,6 +52,36 @@
 AGY_AGENT_ID_LITERAL = "antigravity_cli"
 AGY_MCP_CONFIG_PATH = Path.home() / ".gemini" / "config" / "mcp_config.json"
 
+# Exact model labels accepted by `agy --model` (source of truth: `agy models`).
+# agy 1.0.5+ exposes a real ``--model`` flag that takes one of these strings
+# verbatim; anything else is rejected. Keep in sync with `agy models` output.
+AGY_MODEL_LABELS: tuple[str, ...] = (
+    "Gemini 3.5 Flash (Low)",
+    "Gemini 3.5 Flash (Medium)",
+    "Gemini 3.5 Flash (High)",
+    "Gemini 3.1 Pro (Low)",
+    "Gemini 3.1 Pro (High)",
+    "Claude Sonnet 4.6 (Thinking)",
+    "Claude Opus 4.6 (Thinking)",
+    "GPT-OSS 120B (Medium)",
+)
+
+# Deterministic alias map: short config ids → canonical agy label. This is an
+# explicit id-normalization table (registry-style), NOT heuristic similarity
+# matching. A bare family id maps to the highest-effort variant by default.
+AGY_MODEL_ALIASES: dict[str, str] = {
+    "gemini-3.5-flash": "Gemini 3.5 Flash (High)",
+    "gemini-3.5-flash-high": "Gemini 3.5 Flash (High)",
+    "gemini-3.5-flash-medium": "Gemini 3.5 Flash (Medium)",
+    "gemini-3.5-flash-low": "Gemini 3.5 Flash (Low)",
+    "gemini-3.1-pro": "Gemini 3.1 Pro (High)",
+    "gemini-3.1-pro-high": "Gemini 3.1 Pro (High)",
+    "gemini-3.1-pro-low": "Gemini 3.1 Pro (Low)",
+    "claude-sonnet-4.6": "Claude Sonnet 4.6 (Thinking)",
+    "claude-opus-4.6": "Claude Opus 4.6 (Thinking)",
+    "gpt-oss-120b": "GPT-OSS 120B (Medium)",
+}
+
 # Mirrors gemini_cli.py:48-52 so workflow-mode inference behaves identically
 # across both Google-CLI backends. The orchestrator embeds prior-round
 # candidate answers in a `<CURRENT ANSWERS from the agents>…<END OF CURRENT
@@ -97,12 +129,13 @@ def __init__(self, api_key: str | None = None, **kwargs):
         )
         self.disable_auto_update: bool = kwargs.get("disable_auto_update", True)
 
-        # Accept a `model` for logging/registry consistency but warn that agy
-        # ignores it at invocation time.
+        # agy 1.0.5+ has a real --model flag; the configured model is resolved
+        # to an exact `agy models` label at command-build time. Warn early if
+        # it won't resolve so the operator knows agy will use its default.
         self.model = kwargs.get("model", AGY_DEFAULT_MODEL_LABEL)
-        if kwargs.get("model") and not self.model.lower().startswith("gemini"):
+        if kwargs.get("model") and self._resolve_agy_model_label(self.model) is None:
             logger.warning(
-                f"Antigravity CLI: configured model '{self.model}' is not a known " "Gemini label. agy selects models server-side; this value is " "informational only.",
+                f"Antigravity CLI: configured model '{self.model}' does not map to a " "known `agy models` label; agy will use its default model. Valid " f"labels: {list(AGY_MODEL_LABELS)}",
             )
 
         self._config_cwd = kwargs.get("cwd")
@@ -235,6 +268,28 @@ def _find_agy_cli() -> str | None:
                 return str(candidate)
         return None
 
+    @staticmethod
+    def _resolve_agy_model_label(model: str | None) -> str | None:
+        """Resolve a configured model id to an exact ``agy --model`` label.
+
+        agy 1.0.5+ accepts ``--model`` but only with one of the exact strings
+        from ``agy models`` (``AGY_MODEL_LABELS``). We accept either an exact
+        label (case-insensitive) or a short alias (``AGY_MODEL_ALIASES``).
+        Returns ``None`` for anything unresolvable so the caller omits
+        ``--model`` and lets agy fall back to its default instead of failing
+        the whole call on a rejected label.
+        """
+        if not model or not isinstance(model, str):
+            return None
+        raw = model.strip()
+        if not raw:
+            return None
+        for label in AGY_MODEL_LABELS:
+            if raw.lower() == label.lower():
+                return label
+        norm = re.sub(r"[\s_]
```

**File**: `massgen/configs/providers/antigravity/antigravity_cli_local.yaml` (modified, +4/-3)
```diff
@@ -12,9 +12,10 @@ agents:
 - id: agent_a
   backend:
     type: antigravity_cli
-    # NOTE: agy 1.0.0 selects the model server-side per Antigravity tier
-    # (default: Gemini 3.5 Flash). The `model` value below is informational
-    # only — the CLI has no --model flag to honor it.
+    # agy 1.0.5+ has a real --model flag. `model` is resolved to an exact
+    # `agy models` label (alias or exact match) and passed via --model.
+    # Valid: gemini-3.5-flash[-low|-medium|-high], gemini-3.1-pro[-low|-high],
+    # claude-sonnet-4.6, claude-opus-4.6, gpt-oss-120b. Unknown -> agy default.
     model: gemini-3.5-flash
 ui:
   display_type: textual_terminal
```

**File**: `massgen/tests/test_antigravity_cli_backend.py` (modified, +111/-6)
```diff
@@ -2,8 +2,8 @@
 
 The Antigravity CLI (`agy`, Google's successor to the Gemini CLI as of I/O 2026)
 is architecturally simpler than the Gemini CLI: plain text stdout, no
-stream-json events, no per-invocation --model flag. These tests pin the
-contract MassGen depends on.
+stream-json events. (agy 1.0.5+ does have a real --model flag, resolved from
+the configured model id.) These tests pin the contract MassGen depends on.
 
 Run with: uv run pytest massgen/tests/test_antigravity_cli_backend.py -v
 """
@@ -172,12 +172,117 @@ def test_command_passes_log_file_for_error_surfacing(self, backend, tmp_path):
         assert Path(log_path).is_absolute()
         assert ".antigravity" in log_path
 
-    def test_command_does_not_pass_model_flag(self, backend):
-        """agy 1.0.0 has no --model flag; we must not emit one even when configured."""
-        backend.model = "gemini-3-flash-preview"
+    def test_command_passes_model_flag_for_known_alias(self, backend):
+        """agy 1.0.5+ has a real --model flag taking an exact `agy models` label.
+
+        A configured short id (e.g. ``gemini-3.5-flash``) must resolve to the
+        canonical agy label and be emitted as ``--model <label>``.
+        """
+        backend.model = "gemini-3.5-flash"
+        cmd = backend._build_exec_command("hello")
+        assert "--model" in cmd, f"--model flag missing from: {cmd}"
+        idx = cmd.index("--model")
+        assert cmd[idx + 1] == "Gemini 3.5 Flash (High)", cmd
+
+    def test_command_passes_model_flag_for_exact_label(self, backend):
+        """An already-canonical label is emitted verbatim (case-insensitive match)."""
+        backend.model = "Gemini 3.1 Pro (High)"
+        cmd = backend._build_exec_command("hello")
+        assert "--model" in cmd
+        assert cmd[cmd.index("--model") + 1] == "Gemini 3.1 Pro (High)"
+
+    def test_command_omits_model_flag_for_unresolvable_model(self, backend):
+        """An unrecognizable model id must NOT be passed (agy would reject it).
+
+        Falling back to agy's default is safer than emitting a bad --model that
+        makes the whole call fail.
+        """
+        backend.model = "totally-unknown-model-xyz"
         cmd = backend._build_exec_command("hello")
         assert "--model" not in cmd
-        assert "-m" not in cmd
+
+
+class TestModelResolution:
+    """Configured model ids map to exact `agy models` labels for --model."""
+
+    @pytest.mark.parametrize(
+        "configured,expected",
+        [
+            ("gemini-3.5-flash", "Gemini 3.5 Flash (High)"),
+            ("gemini-3.5-flash-low", "Gemini 3.5 Flash (Low)"),
+            ("gemini-3.5-flash-medium", "Gemini 3.5 Flash (Medium)"),
+            ("gemini-3.1-pro", "Gemini 3.1 Pro (High)"),
+            ("gemini-3.1-pro-low", "Gemini 3.1 Pro (Low)"),
+            ("claude-sonnet-4.6", "Claude Sonnet 4.6 (Thinking)"),
+            ("claude-opus-4.6", "Claude Opus 4.6 (Thinking)"),
+            ("gpt-oss-120b", "GPT-OSS 120B (Medium)"),
+            # Exact labels pass through (case-insensitive)
+            ("Gemini 3.5 Flash (High)", "Gemini 3.5 Flash (High)"),
+            ("gemini 3.5 flash (medium)", "Gemini 3.5 Flash (Medium)"),
+            # Default label resolves to itself
+            (AGY_DEFAULT_MODEL_LABEL, "Gemini 3.5 Flash (High)"),
+        ],
+    )
+    def test_resolve_known_models(self, configured, expected):
+        assert AntigravityCLIBackend._resolve_agy_model_label(configured) == expected
+
+    @pytest.mark.parametrize("bad", ["", None, "gpt-4o", "llama-3", "random"])
+    def test_resolve_unknown_returns_none(self, bad):
+        assert AntigravityCLIBackend._resolve_agy_model_label(bad) is None
+
+
+class TestScratchPromotion:
+    """agy may route write_to_file into its internal scratch dir (excluded from
+    snapshots). After each run we promote new scratch files into the workspace
+    root so deliverables stay visible — without clobbering files the model
+    already placed in the workspace."""
+
+    def _scratch_dir(self, backend):
+        return backend._workspace_config_dir() / "antigravity-cli" / "scratch"
+
+    def test_promote_copies_new_scratch_file_to_workspace(self, backend):
+        scratch = self._scratch_dir(backend)
+        scratch.mkdir(parents=True, exist_ok=True)
+        pre = backend._snapshot_scratch_files(scratch)
+        deliverable = scratch / "result.svg"
+        deliverable.write_text("<svg/>")
+        promoted = backend._promote_scratch_deliverables(pre)
+        assert "result.svg" in promoted
+        dest = Path(backend.cwd).resolve() / "result.svg"
+        assert dest.exists() and dest.read_text() == "<svg/>"
+
+    def test_promote_preserves_subdir_structure(self, backend):
+        scratch = self._scratch_dir(backend)
+        (scratch / "out").mkdir(parents=True, exist_ok=True)
+        pre = backend._snapshot_scratch_files(scratch)
+        (scratch / "out" / "a.txt").write_text("x")
+        promoted = backend.
```

---

### Incident Patch 8: `4a10843c` (2026-06-05)
**Commit Message**: fix+docs: B1 snapshot read-during-write race (versioned snapshots) + v0.1.94 release docs

Fixes the read-during-write race that the B1 event-loop offload exposed: the
offloaded peer-context copytree could overlap an owner's in-place rmtree+rebuild
of the same snapshot dir. Snapshots are now immutable and versioned --
save_snapshot (and the interrupted-turn save) publish <base>/.versions/<id>/v<N>
and atomically repoint the <base>/<id> symlink; readers acquire/refcount the
current version for their copy's duration. GC never deletes a pinned or in-flight
version. New SnapshotVersionStore coordinates publish/acquire/release/GC.

Also includes the earlier review cleanups on this branch:
- D2: emit_status was called with an invalid status= kwarg whose TypeError was
  swallowed, so worktree-isolation degradation never surfaced -- now fixed.
- A1: the triplicated _wait_interrupt_provider closure consolidated into one
  _install_wait_interrupt_provider helper (backend-parity drift removed).
- Interrupted-turn save no longer rmtree's the (now symlinked) snapshot path.

All under TDD with red-verified regression tests:
- test_snapshot_version_store.py (concurrent-publish-during-read, concur

**File**: `CHANGELOG.md` (modified, +27/-0)
```diff
@@ -7,8 +7,35 @@ and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0
 
 ## [Unreleased]
 
+## [0.1.94] - 2026-06-05
+
+### Theme: Parallelism Hardening (Engineering Health)
+
+Strengthen the orchestrator's parallel execution: move blocking snapshot work off the event loop so agents keep streaming concurrently, close the latent concurrency races that the previously-serialized copy had kept hidden, and finish the last refactor blocker. No per-backend functionality changes (parity principle). All items landed under TDD (tests written first, confirmed red, then green) with cost-free simulation (mock backends / real collaborator code, no LLM calls).
+
+### Changed
+- **Immutable, versioned snapshot storage**: each agent's snapshot path `<base>/<agent_id>` is now a symlink to an immutable version directory under `<base>/.versions/<agent_id>/v<N>`. `save_snapshot` (and the interrupted-turn partial save) publish a fresh version and atomically repoint the symlink rather than rewriting in place; the peer-context copy `acquire`s (refcounts) the current version for the duration of its offloaded copy. The symlink is transparent to all other readers, so the on-disk layout consumers see is unchanged. Coordinated by the new `SnapshotVersionStore` (`massgen/filesystem_manager/_snapshot_version_store.py`). On platforms without symlink support it falls back to a direct copy.
+- **Snapshot copy moved off the event loop (B1)**: `FilesystemManager.copy_snapshots_to_temp_workspace` now runs its blocking `rmtree`/`copytree`/scrub on a worker thread via `asyncio.to_thread`, so one agent's snapshot copy no longer stalls every other agent's streaming.
+- **Unified mid-stream injection (A1)**: the two ~150-line `get_injection_content` closures collapsed into a single `MidStreamInjectionHookInstaller.build_midstream_injection(..., native=)`; both hook-setup paths delegate, preserving the `update_context → refresh_checklist` side-effect order for both paths. The triplicated background-wait interrupt provider was likewise consolidated into one `_install_wait_interrupt_provider`.
+
+### Fixed
+- **Snapshot read-during-write race (B1 hardening)**: offloading the snapshot copy (above) removed the implicit event-loop serialization that kept a peer's `copytree` from overlapping an owner's in-place `rmtree`+rebuild of the same directory, which could surface `FileNotFoundError` or a torn snapshot. The versioned-snapshot scheme makes the read source immutable for the copy's duration, eliminating the race (including a concurrent-publisher GC edge case).
+- **R1 — lost peer-answer revision**: the mid-stream injection path marked a peer "seen" by re-reading the live revision count after a yielding `await`, dropping a revision appended during the window. Revision counts captured at selection time are now threaded through `mark_seen_answer_revisions` / `register_injected_answer_updates`.
+- **R2/R3 — lost background-subagent result**: a blind `pop(agent_id)` after the injection `await` discarded results appended during the window; consumption now removes only the consumed subagent ids.
+- **R4 — leaked trace tasks on cleanup**: detached background trace-analyzer tasks are now cancelled before the pending-result flush.
+- **R5 — cancel-without-await teardown**: `cancel_all_subagents` now awaits the cancellations so each task runs its `CancelledError` handler against the live registry before it is cleared.
+- **D2 — worktree-isolation degradation never surfaced**: `_record_round_isolation_degraded` called `emit_status(status=…)`, which is not a valid parameter, so the `TypeError` was silently swallowed and the visible signal never fired; it now calls `emit_status(message=…, level="warning", agent_id=…)`.
+- **D3 — changedoc enrichment made non-fatal** so a post-record failure cannot kill a valid-answer agent.
+- **Interrupted-turn save over a published snapshot**: the partial save did `shutil.rmtree` on the (now symlinked) snapshot path, raising and silently dropping the snapshot; it now publishes a new version through the store.
+
+### Tests
+- New race/regression suites: `test_concurrency_race_fixes.py` (R1–R5, D2/D3), `test_snapshot_version_store.py` and `test_snapshot_versioned_save.py` (versioned snapshots incl. concurrent-publish-during-read and concurrent-publisher GC), `test_snapshot_copy_offload.py` (off-loop copy), `test_midstream_injection_unified.py` (cross-path effect-order equality), and `test_wait_interrupt_provider.py` (consolidated interrupt-provider contract).
+
 ## Recent Releases
 
+**v0.1.94 (June 5, 2026)** - Parallelism Hardening (Engineering Health)
+Strengthens the orchestrator's parallel execution: moves the snapshot copy off the event loop so agents keep streaming concurrently — backed by immutable versioned snapshots that keep the off-loop copy safe — and closes latent concurrency races (lost peer-answer revisions, lost background-subagent results, leaked trace tasks, cancel-without-await teardow
```

**File**: `README.md` (modified, +26/-24)
```diff
@@ -69,7 +69,7 @@ This project started with the "threads of thought" and "iterative refinement" id
 <details open>
 <summary><h3>🆕 Latest Features</h3></summary>
 
-- [v0.1.93 Features](#-latest-features-v0193)
+- [v0.1.94 Features](#-latest-features-v0194)
 </details>
 
 <details open>
@@ -122,15 +122,15 @@ This project started with the "threads of thought" and "iterative refinement" id
 <details open>
 <summary><h3>🗺️ Roadmap</h3></summary>
 
-- [Recent Achievements (v0.1.93)](#recent-achievements-v0193)
-- [Previous Achievements (v0.0.3 - v0.1.92)](#previous-achievements-v003---v0192)
+- [Recent Achievements (v0.1.94)](#recent-achievements-v0194)
+- [Previous Achievements (v0.0.3 - v0.1.93)](#previous-achievements-v003---v0193)
 - [Key Future Enhancements](#key-future-enhancements)
   - Bug Fixes & Backend Improvements
   - Advanced Agent Collaboration
   - Expanded Model, Tool & Agent Integrations
   - Improved Performance & Scalability
   - Enhanced Developer Experience
-- [v0.1.93 Roadmap](#v0193-roadmap)
+- [v0.1.95 Roadmap](#v0195-roadmap)
 </details>
 
 <details open>
@@ -155,18 +155,18 @@ This project started with the "threads of thought" and "iterative refinement" id
 
 ---
 
-## 🆕 Latest Features (v0.1.93)
+## 🆕 Latest Features (v0.1.94)
 
-**🎉 Released: June 3, 2026**
+**🎉 Released: June 5, 2026**
 
-**What's New in v0.1.93** (internal-quality release — no runtime behavior changes):
-- **🧩 CLI Package Decomposition** - The monolithic 12k-line `cli.py` is split into a focused `massgen/cli/` package while preserving the public import surface.
-- **🛡️ Pydantic Config Migration** - Configuration classes now validate field types on construction, with `Literal`-typed modes as a single source of truth the validator derives from.
-- **🧹 Dead Code Removal & Tooling** - Removed ~8.7k lines of unreferenced legacy code, fixed the coverage gate, and re-enabled type checking via an incremental mypy ratchet.
+**What's New in v0.1.94** (Parallelism Hardening — engineering-health release, no per-backend functionality changes):
+- **⚡ Snapshot Copy Off the Event Loop** - The peer-context snapshot copy now runs its blocking filesystem work on a worker thread, so one agent's copy no longer stalls every other agent's streaming.
+- **🔒 Immutable, Versioned Snapshots** - Snapshots are published as immutable versions with an atomically-repointed symlink; readers pin the current version, eliminating the read-during-write race the off-loop copy would otherwise expose.
+- **🧵 Concurrency Correctness Fixes** - Lost peer-answer revisions, lost background-subagent results, leaked trace tasks, and a cancel-without-await teardown are all fixed; worktree-isolation degradation is now surfaced.
 
-**Install v0.1.93:**
+**Install v0.1.94:**
 ```bash
-pip install massgen==0.1.93
+pip install massgen==0.1.94
 ```
 
 → [See full release history and examples](massgen/configs/README.md#release-history--examples)
@@ -1241,19 +1241,21 @@ MassGen is currently in its foundational stage, with a focus on parallel, asynch
 
 ⚠️ **Early Stage Notice:** As MassGen is in active development, please expect upcoming breaking architecture changes as we continue to refine and improve the system.
 
-### Recent Achievements (v0.1.93)
+### Recent Achievements (v0.1.94)
 
-**🎉 Released: June 3, 2026**
+**🎉 Released: June 5, 2026**
 
-#### CLI Package Decomposition & Pydantic Config Migration
-- **CLI Package Decomposition**: The monolithic `cli.py` (12,206 lines) was split into an 18-module `massgen/cli/` package with a facade that preserves the public import surface; the ~886-line Textual per-turn handler was extracted into a dependency-injected function
-- **Pydantic Config Migration**: Config classes migrated to `pydantic.dataclasses` (type validation on construction) with `Literal`-typed modes in `massgen/config_modes.py` that the validator derives from — closing a real validator-drift bug
-- **Single-Source Exclusion Lists**: The two hand-duplicated "excluded params" lists now derive from one frozenset, locked by a regression test
-- **Dead Code Removal**: Deleted ~8,700 lines of unreferenced legacy `v1`/`prototype` code that was shipping in the wheel
-- **Tooling**: Fixed the broken coverage gate, enabled a no-assert test guard, enforced `uv.lock` in CI, and re-enabled type checking via an incremental mypy ratchet
-- **Fixes**: Concurrent-run log isolation (MAS-274), a config default regression, and logged (not silent) backend tool-arg parsing
+#### Parallelism Hardening (Engineering Health)
+- **Snapshot Copy Off the Event Loop**: `FilesystemManager.copy_snapshots_to_temp_workspace` now offloads its blocking `rmtree`/`copytree`/scrub to a worker thread via `asyncio.to_thread`, so one agent's snapshot copy no longer serializes every other agent's streaming
+- **Immutable, Versioned Snapshots**: snapshots publish to `<base>/.versions/<id>/v<N>` with an atomically-repointed symlink; readers `acquire`/refcount the current version for the
```

**File**: `README_PYPI.md` (modified, +26/-24)
```diff
@@ -68,7 +68,7 @@ This project started with the "threads of thought" and "iterative refinement" id
 <details open>
 <summary><h3>🆕 Latest Features</h3></summary>
 
-- [v0.1.93 Features](#-latest-features-v0193)
+- [v0.1.94 Features](#-latest-features-v0194)
 </details>
 
 <details open>
@@ -121,15 +121,15 @@ This project started with the "threads of thought" and "iterative refinement" id
 <details open>
 <summary><h3>🗺️ Roadmap</h3></summary>
 
-- [Recent Achievements (v0.1.93)](#recent-achievements-v0193)
-- [Previous Achievements (v0.0.3 - v0.1.92)](#previous-achievements-v003---v0192)
+- [Recent Achievements (v0.1.94)](#recent-achievements-v0194)
+- [Previous Achievements (v0.0.3 - v0.1.93)](#previous-achievements-v003---v0193)
 - [Key Future Enhancements](#key-future-enhancements)
   - Bug Fixes & Backend Improvements
   - Advanced Agent Collaboration
   - Expanded Model, Tool & Agent Integrations
   - Improved Performance & Scalability
   - Enhanced Developer Experience
-- [v0.1.93 Roadmap](#v0193-roadmap)
+- [v0.1.95 Roadmap](#v0195-roadmap)
 </details>
 
 <details open>
@@ -154,18 +154,18 @@ This project started with the "threads of thought" and "iterative refinement" id
 
 ---
 
-## 🆕 Latest Features (v0.1.93)
+## 🆕 Latest Features (v0.1.94)
 
-**🎉 Released: June 3, 2026**
+**🎉 Released: June 5, 2026**
 
-**What's New in v0.1.93** (internal-quality release — no runtime behavior changes):
-- **🧩 CLI Package Decomposition** - The monolithic 12k-line `cli.py` is split into a focused `massgen/cli/` package while preserving the public import surface.
-- **🛡️ Pydantic Config Migration** - Configuration classes now validate field types on construction, with `Literal`-typed modes as a single source of truth the validator derives from.
-- **🧹 Dead Code Removal & Tooling** - Removed ~8.7k lines of unreferenced legacy code, fixed the coverage gate, and re-enabled type checking via an incremental mypy ratchet.
+**What's New in v0.1.94** (Parallelism Hardening — engineering-health release, no per-backend functionality changes):
+- **⚡ Snapshot Copy Off the Event Loop** - The peer-context snapshot copy now runs its blocking filesystem work on a worker thread, so one agent's copy no longer stalls every other agent's streaming.
+- **🔒 Immutable, Versioned Snapshots** - Snapshots are published as immutable versions with an atomically-repointed symlink; readers pin the current version, eliminating the read-during-write race the off-loop copy would otherwise expose.
+- **🧵 Concurrency Correctness Fixes** - Lost peer-answer revisions, lost background-subagent results, leaked trace tasks, and a cancel-without-await teardown are all fixed; worktree-isolation degradation is now surfaced.
 
-**Install v0.1.93:**
+**Install v0.1.94:**
 ```bash
-pip install massgen==0.1.93
+pip install massgen==0.1.94
 ```
 
 → [See full release history and examples](massgen/configs/README.md#release-history--examples)
@@ -1240,19 +1240,21 @@ MassGen is currently in its foundational stage, with a focus on parallel, asynch
 
 ⚠️ **Early Stage Notice:** As MassGen is in active development, please expect upcoming breaking architecture changes as we continue to refine and improve the system.
 
-### Recent Achievements (v0.1.93)
+### Recent Achievements (v0.1.94)
 
-**🎉 Released: June 3, 2026**
+**🎉 Released: June 5, 2026**
 
-#### CLI Package Decomposition & Pydantic Config Migration
-- **CLI Package Decomposition**: The monolithic `cli.py` (12,206 lines) was split into an 18-module `massgen/cli/` package with a facade that preserves the public import surface; the ~886-line Textual per-turn handler was extracted into a dependency-injected function
-- **Pydantic Config Migration**: Config classes migrated to `pydantic.dataclasses` (type validation on construction) with `Literal`-typed modes in `massgen/config_modes.py` that the validator derives from — closing a real validator-drift bug
-- **Single-Source Exclusion Lists**: The two hand-duplicated "excluded params" lists now derive from one frozenset, locked by a regression test
-- **Dead Code Removal**: Deleted ~8,700 lines of unreferenced legacy `v1`/`prototype` code that was shipping in the wheel
-- **Tooling**: Fixed the broken coverage gate, enabled a no-assert test guard, enforced `uv.lock` in CI, and re-enabled type checking via an incremental mypy ratchet
-- **Fixes**: Concurrent-run log isolation (MAS-274), a config default regression, and logged (not silent) backend tool-arg parsing
+#### Parallelism Hardening (Engineering Health)
+- **Snapshot Copy Off the Event Loop**: `FilesystemManager.copy_snapshots_to_temp_workspace` now offloads its blocking `rmtree`/`copytree`/scrub to a worker thread via `asyncio.to_thread`, so one agent's snapshot copy no longer serializes every other agent's streaming
+- **Immutable, Versioned Snapshots**: snapshots publish to `<base>/.versions/<id>/v<N>` with an atomically-repointed symlink; readers `acquire`/refcount the current version for the
```

**File**: `ROADMAP.md` (modified, +20/-3)
```diff
@@ -1,10 +1,10 @@
 # MassGen Roadmap
 
-**Current Version:** v0.1.93
+**Current Version:** v0.1.94
 
 **Release Schedule:** Mondays, Wednesdays, Fridays @ 9am PT
 
-**Last Updated:** June 3, 2026
+**Last Updated:** June 5, 2026
 
 This roadmap outlines MassGen's development priorities for upcoming releases. Each release focuses on specific capabilities with real-world use cases.
 
@@ -42,12 +42,29 @@ Want to contribute or collaborate on a specific track? Reach out to the track ow
 
 | Release | Target | Feature | Owner | Use Case |
 |---------|--------|---------|-------|----------|
-| **v0.1.94** | TBD | Image/Video Edit Capabilities | @ncrispino | Check and support img/video editing capabilities — deferred from v0.1.86-v0.1.93 ([#959](https://github.com/massgen/MassGen/issues/959)) |
+| **v0.1.95** | TBD | Image/Video Edit Capabilities | @ncrispino | Check and support img/video editing capabilities — deferred from v0.1.86-v0.1.94 ([#959](https://github.com/massgen/MassGen/issues/959)) |
 
 *All releases ship on MWF @ 9am PT when ready*
 
 ---
 
+## ✅ v0.1.94 - Parallelism Hardening (Engineering Health) (Completed)
+
+**Released:** June 5, 2026
+
+### Features
+- **Snapshot Copy Off the Event Loop**: `FilesystemManager.copy_snapshots_to_temp_workspace` offloads its blocking `rmtree`/`copytree`/scrub to a worker thread via `asyncio.to_thread`, so one agent's snapshot copy no longer serializes every other agent's streaming
+- **Immutable, Versioned Snapshots**: snapshots publish to `<base>/.versions/<id>/v<N>` with an atomically-repointed symlink; readers `acquire`/refcount the current version for the duration of their copy (new `SnapshotVersionStore`), eliminating the read-during-write race the off-loop copy would otherwise expose
+- **Concurrency Correctness**: fixed lost peer-answer revisions (R1), lost background-subagent results (R2/R3), leaked background trace tasks on cleanup (R4), and a cancel-without-await teardown (R5)
+- **Worktree-Isolation Degradation Surfaced (D2)**: an invalid `emit_status(status=…)` kwarg had its `TypeError` swallowed, silencing the signal entirely
+- **Unified Mid-Stream Injection (A1)**: the two ~150-line per-backend `get_injection_content` closures collapsed into one `build_midstream_injection(..., native=)`; the background-wait interrupt provider was deduplicated, removing backend-parity drift
+
+### Notes
+- Engineering-health release: no per-backend functionality changes (parity principle); all items landed under TDD with cost-free simulation.
+- Image/Video Edit Capabilities ([#959](https://github.com/massgen/MassGen/issues/959)) remain deferred to v0.1.95.
+
+---
+
 ## ✅ v0.1.93 - CLI Package Decomposition & Pydantic Config Migration (Completed)
 
 **Released:** June 3, 2026
```

**File**: `docs/announcements/archive/v0.1.93.md` (added, +74/-0)
```diff
@@ -0,0 +1,74 @@
+# MassGen v0.1.93 Release Announcement
+
+<!--
+This is the current release announcement. Copy this + feature-highlights.md to LinkedIn/X.
+After posting, update the social links below.
+-->
+
+## Release Summary
+
+We're excited to release MassGen v0.1.93 — CLI Package Decomposition & Pydantic Config Migration! 🚀 This internal-quality release keeps runtime behavior stable while tightening the layers developers touch most: the 12k-line CLI is now a focused `massgen/cli/` package, config dataclasses validate at construction time, provider-exclusion lists share one source of truth, dead legacy code is gone from the wheel, and CI/type-checking catches issues earlier.
+
+## Install
+
+```bash
+pip install massgen==0.1.93
+```
+
+## Links
+
+- **Release notes:** https://github.com/massgen/MassGen/releases/tag/v0.1.93
+- **X post:** [TO BE ADDED AFTER POSTING]
+- **LinkedIn post:** [TO BE ADDED AFTER POSTING]
+
+## Posting Notes
+
+- **Suggested image:** Use a screenshot of the v0.1.93 release notes.
+
+---
+
+## Full Announcement (for LinkedIn)
+
+Copy everything below this line, then append content from `feature-highlights.md`:
+
+---
+
+We're excited to release MassGen v0.1.93 — CLI Package Decomposition & Pydantic Config Migration! 🚀 This internal-quality release keeps runtime behavior stable while tightening the layers developers touch most: the 12k-line CLI is now a focused `massgen/cli/` package, config dataclasses validate at construction time, provider-exclusion lists share one source of truth, dead legacy code is gone from the wheel, and CI/type-checking catches issues earlier.
+
+**Key Improvements:**
+
+🧩 **CLI Package Decomposition**:
+- `massgen/cli.py` was split into an 18-module `massgen/cli/` package
+- The facade keeps `from massgen.cli import ...` and `massgen.cli...` imports working
+- The Textual per-turn handler was extracted into a dependency-injected function
+
+🛡️ **Pydantic Config Validation**:
+- Core config classes now validate field types on construction
+- Mode fields use `Literal` types in `massgen/config_modes.py`
+- `config_validator` derives valid mode sets from those typed definitions instead of maintaining drift-prone duplicates
+
+🔧 **Correctness Fixes**:
+- Concurrent in-process Textual runs keep their own logging/snapshot session
+- `CoordinationConfig.from_dict()` now drops absent `None` values so field defaults apply
+- Response backend tool-argument parsing now logs malformed payloads instead of silently converting them to `{}`
+
+🧪 **Test Signal & Typing**:
+- Coverage config now points at the real package
+- No-assert pytest returns are treated as errors
+- CI enforces `uv.lock` with `uv sync --frozen`
+- An incremental mypy island runs as a blocking pre-commit/CI gate
+
+🧹 **Dead Code Removal**:
+- Removed unreferenced legacy `massgen/v1` and `massgen/prototype` code from the shipped wheel
+
+**Install:**
+
+```bash
+pip install massgen==0.1.93
+```
+
+Release notes: https://github.com/massgen/MassGen/releases/tag/v0.1.93
+
+Feature highlights:
+
+<!-- Paste feature-highlights.md content here -->
```

**File**: `docs/announcements/current-release.md` (modified, +22/-28)
```diff
@@ -1,4 +1,4 @@
-# MassGen v0.1.93 Release Announcement
+# MassGen v0.1.94 Release Announcement (Parallelism Hardening)
 
 <!--
 This is the current release announcement. Copy this + feature-highlights.md to LinkedIn/X.
@@ -7,23 +7,23 @@ After posting, update the social links below.
 
 ## Release Summary
 
-We're excited to release MassGen v0.1.93 — CLI Package Decomposition & Pydantic Config Migration! 🚀 This internal-quality release keeps runtime behavior stable while tightening the layers developers touch most: the 12k-line CLI is now a focused `massgen/cli/` package, config dataclasses validate at construction time, provider-exclusion lists share one source of truth, dead legacy code is gone from the wheel, and CI/type-checking catches issues earlier.
+We're excited to release MassGen v0.1.94 — Parallelism Hardening (Engineering Health)! 🚀 This release strengthens the orchestrator's parallel execution: we moved the per-round snapshot copy off the event loop so agents keep streaming concurrently, backed it with an immutable, versioned snapshot store that keeps the off-loop copy safe, and closed several latent concurrency races. No per-backend functionality changes — pure parallelism correctness and reliability.
 
 ## Install
 
 ```bash
-pip install massgen==0.1.93
+pip install massgen==0.1.94
 ```
 
 ## Links
 
-- **Release notes:** https://github.com/massgen/MassGen/releases/tag/v0.1.93
+- **Release notes:** https://github.com/massgen/MassGen/releases/tag/v0.1.94
 - **X post:** [TO BE ADDED AFTER POSTING]
 - **LinkedIn post:** [TO BE ADDED AFTER POSTING]
 
 ## Posting Notes
 
-- **Suggested image:** Use a screenshot of the v0.1.93 release notes.
+- **Suggested image:** Use a screenshot of the v0.1.94 release notes.
 
 ---
 
@@ -33,41 +33,35 @@ Copy everything below this line, then append content from `feature-highlights.md
 
 ---
 
-We're excited to release MassGen v0.1.93 — CLI Package Decomposition & Pydantic Config Migration! 🚀 This internal-quality release keeps runtime behavior stable while tightening the layers developers touch most: the 12k-line CLI is now a focused `massgen/cli/` package, config dataclasses validate at construction time, provider-exclusion lists share one source of truth, dead legacy code is gone from the wheel, and CI/type-checking catches issues earlier.
+We're excited to release MassGen v0.1.94 — Parallelism Hardening (Engineering Health)! 🚀 This release strengthens the orchestrator's parallel execution: it moves blocking snapshot work off the event loop so agents keep streaming concurrently, backs it with immutable versioned snapshots that keep the off-loop copy safe, and closes latent concurrency races. No per-backend functionality changes.
 
 **Key Improvements:**
 
-🧩 **CLI Package Decomposition**:
-- `massgen/cli.py` was split into an 18-module `massgen/cli/` package
-- The facade keeps `from massgen.cli import ...` and `massgen.cli...` imports working
-- The Textual per-turn handler was extracted into a dependency-injected function
+⚡ **Snapshot copy off the event loop**:
+- The peer-context snapshot copy now runs its blocking `rmtree`/`copytree`/scrub on a worker thread via `asyncio.to_thread`
+- One agent's snapshot copy no longer stalls every other agent's streaming
 
-🛡️ **Pydantic Config Validation**:
-- Core config classes now validate field types on construction
-- Mode fields use `Literal` types in `massgen/config_modes.py`
-- `config_validator` derives valid mode sets from those typed definitions instead of maintaining drift-prone duplicates
+🔒 **Immutable, versioned snapshots**:
+- Each agent's snapshot path is now a symlink to an immutable `.versions/<id>/v<N>` directory
+- Writers publish a new version and atomically repoint the symlink; readers pin (refcount) the current version for the duration of their copy
+- Eliminates the read-during-write race the off-loop copy would otherwise expose — no `FileNotFoundError`, no torn snapshots
 
-🔧 **Correctness Fixes**:
-- Concurrent in-process Textual runs keep their own logging/snapshot session
-- `CoordinationConfig.from_dict()` now drops absent `None` values so field defaults apply
-- Response backend tool-argument parsing now logs malformed payloads instead of silently converting them to `{}`
+🧵 **Concurrency correctness fixes**:
+- Lost peer-answer revisions across the injection `await` window — fixed (revision counts captured at selection time)
+- Lost background-subagent results from a blind queue `pop` — fixed (consume only the consumed ids)
+- Leaked background trace tasks on cleanup, and a cancel-without-await teardown — fixed
+- Worktree-isolation degradation is now surfaced (a swallowed `TypeError` previously hid it)
 
-🧪 **Test Signal & Typing**:
-- Coverage config now points at the real package
-- No-assert pytest returns are treated as errors
-- CI enforces `uv.lock` with `uv sync --frozen`
-- An incremental mypy island runs as a blocking pre-commit/CI gate
-
-🧹 **Dead Code Removal**:
-- Re
```

**File**: `docs/announcements/github-release-v0.1.93.md` (removed, +0/-38)
```diff
@@ -1,38 +0,0 @@
-# 🚀 Release Highlights — v0.1.93 (2026-06-03)
-
-v0.1.93 is an internal-quality release: no intended runtime behavior changes, but a smaller CLI surface, typed config validation, cleaner package contents, and stronger test/type-checking gates.
-
-### 🧩 CLI Package Decomposition
-- `massgen/cli.py` was split into an 18-module `massgen/cli/` package
-- The public import surface is preserved through the package facade
-- The Textual per-turn handler was extracted into a dependency-injected function
-- CLI helper and run-loop characterization tests cover the new seams
-
-### 🛡️ Pydantic Config Migration
-- `AgentConfig`, `CoordinationConfig`, `TimeoutConfig`, `StepModeConfig`, and related nested config classes now validate field types on construction
-- Mode fields use `Literal` definitions in `massgen/config_modes.py`
-- `config_validator` derives valid mode sets from the typed definitions, reducing validator drift
-- `pydantic>=2.0` is now a declared dependency
-
-### 🔧 Correctness Fixes
-- Textual concurrent-run logging now preserves per-run session context
-- `CoordinationConfig.from_dict()` no longer lets absent YAML keys override defaults with `None`
-- Response backend tool-argument parsing now logs malformed payloads instead of silently dropping them
-- Backend/API parameter exclusion lists now derive from a single source
-
-### 🧪 Test Signal & Typing
-- Coverage configuration now points at the real package
-- `pytest.PytestReturnNotNoneWarning` is treated as an error
-- CI enforces `uv.lock` via `uv sync --frozen`
-- `scripts/mypy_island.sh` adds a blocking incremental mypy gate
-- All bundled configs were validated after the migration
-
-### 🧹 Dead Code Removal
-- Removed unreferenced legacy `massgen/v1` and `massgen/prototype` code from the wheel
-
----
-
-### 📖 Install
-```bash
-pip install massgen==0.1.93
-```
```

**File**: `docs/announcements/github-release-v0.1.94.md` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+# 🚀 Release Highlights — v0.1.94 (2026-06-05)
+
+v0.1.94 — Parallelism Hardening (Engineering Health) — strengthens the orchestrator's parallel execution. It moves the snapshot copy off the event loop so agents keep streaming concurrently, backs it with immutable versioned snapshots that keep the off-loop copy safe, and closes latent concurrency races. No per-backend functionality changes (parity principle).
+
+### ⚡ Snapshot Copy Off the Event Loop
+- `FilesystemManager.copy_snapshots_to_temp_workspace` now runs its blocking `rmtree`/`copytree`/scrub on a worker thread via `asyncio.to_thread`
+- One agent's snapshot copy no longer stalls every other agent's streaming
+
+### 🔒 Immutable, Versioned Snapshots
+- Each agent's snapshot path `<base>/<agent_id>` is now a symlink to an immutable `<base>/.versions/<agent_id>/v<N>` directory
+- `save_snapshot` (and the interrupted-turn partial save) publish a fresh version and atomically repoint the symlink instead of rewriting in place
+- The peer-context copy `acquire`s (refcounts) the current version for the duration of its copy; GC never deletes a pinned or in-flight version
+- Eliminates the read-during-write race the off-loop copy would otherwise expose — coordinated by the new `SnapshotVersionStore`
+
+### 🧵 Concurrency Correctness Fixes
+- **R1** — lost peer-answer revision across the injection `await` window (counts now captured at selection time)
+- **R2/R3** — lost background-subagent result from a blind queue `pop` (consume only the consumed ids)
+- **R4** — leaked background trace-analyzer tasks on cleanup (cancelled before the flush)
+- **R5** — cancel-without-await teardown (`cancel_all_subagents` now awaits cancellations against the live registry)
+- **D2** — worktree-isolation degradation never surfaced because `emit_status` was called with an invalid `status=` kwarg whose `TypeError` was swallowed
+- **D3** — changedoc enrichment made non-fatal
+
+### 🧩 Unified Mid-Stream Injection
+- The two ~150-line per-backend `get_injection_content` closures collapsed into one `build_midstream_injection(..., native=)`, preserving the `update_context → refresh_checklist` side-effect order on both paths
+- The triplicated background-wait interrupt provider consolidated into one helper
+
+### 🧪 Tests
+- New race/regression suites driven under TDD with cost-free simulation: `test_concurrency_race_fixes.py`, `test_snapshot_version_store.py`, `test_snapshot_versioned_save.py`, `test_snapshot_copy_offload.py`, `test_midstream_injection_unified.py`, `test_wait_interrupt_provider.py`
+
+---
+
+### 📖 Install
+```bash
+pip install massgen==0.1.94
+```
```

---

### Incident Patch 9: `39b226ae` (2026-06-04)
**Commit Message**: perf+fix: "Real Parallelism" eng-health tranche (races, event-loop offload, injection de-dup)

Implements the actionable scope of docs/dev_notes/next_version_eng_health_plan.md
(from two adversarially-verified audit workflows). All under TDD with cost-free
simulation (mock backends + real collaborator code, no LLM calls). Zero regressions:
the orchestrator characterization safety net + injection/restart/hooks suites stay green.

Correctness (concurrency races, all lock-free):
- R1: capture peer revision counts at injection-selection time and thread them
  through register/mark_seen (seen_counts=) so a peer revision published during the
  snapshot-copy await is not silently marked "seen" and stays injectable.
- R2/R3: consume only delivered subagent ids instead of a blind whole-key pop, so a
  background result appended during the await window survives.
- R4: cancel+await detached background trace tasks in ActiveCoordinationCleanup
  before flush, so they don't outlive the hard timeout.
- R5: gather cancelled background tasks before clearing the registry in
  cancel_all_subagents.

Latency:
- B1: offload the blocking snapshot copy (rmtree/copytree/scrub) to asyncio.to_thread
  so it

**File**: `docs/dev_notes/next_version_eng_health_plan.md` (added, +190/-0)
```diff
@@ -0,0 +1,190 @@
+# Next Version — Engineering Health Plan
+
+**Theme: "Real Parallelism"** — make the orchestrator's N-agents-in-parallel promise actually hold, fix the correctness races that the current (accidental) serialization masks, and finish the one remaining refactor blocker. No per-backend functionality changes (parity principle).
+
+**Date:** 2026-06-04
+
+## Implementation status (2026-06-04)
+
+Implemented under TDD (tests written first, confirmed red, then green) with cost-free
+simulation (mock backends / real collaborator code, no LLM calls). Zero regressions —
+the 37-test orchestrator characterization safety net plus the injection/decomposition/
+novelty suites stay green; all pre-existing failures verified identical with changes
+stashed.
+
+| Item | Status | Tests |
+|---|---|---|
+| R1 lost peer-answer revision | ✅ done | `test_concurrency_race_fixes.py` (R1 ×4) |
+| R2/R3 lost subagent result (blind pop) | ✅ done | same (R2 ×5) |
+| R4 leaked trace tasks on cleanup | ✅ done | same (R4 ×2) |
+| R5 cancel-without-await teardown | ✅ done | same (R5 ×1) |
+| D2 surface worktree-isolation degradation | ✅ done | same (D2 ×3) |
+| D3 changedoc enrichment non-fatal | ✅ done (scoped to changedoc) | same (D3 ×2) |
+| B1 snapshot copy off the event loop | ✅ done | `test_snapshot_copy_offload.py` (×5) |
+| C2 eager debug f-strings | ✅ done (loguru brace-style; NOT `isEnabledFor` — logger is loguru) | `test_answer_normalizer_debug_guard.py` (×3) |
+| E1 assertion-free context test | ✅ done (assertions verified vs real output) | `test_message_context_building.py` (×4) |
+| E2 assertion-free grok test | ✅ done (offline unit + live_api skips) | `test_grok_backend.py` |
+| A3 stale roadmap | ✅ done | `orchestrator_refactor_roadmap.md` |
+| **A1 unify injection closures** | ✅ **done** — the two ~150-line `get_injection_content` closures collapsed to `MidStreamInjectionHookInstaller.build_midstream_injection(..., native=)`; both setup methods now delegate. orchestrator.py 8,561 → 8,422. Canonical side-effect order preserves the `update_context → refresh_checklist` invariant for both paths. | `test_midstream_injection_unified.py` (×9, incl. cross-path effect-order equality) + 201-test injection/restart/hooks regression sweep |
+| **B2 incremental snapshot copy** | ⏳ **deferred** by design — large + real correctness risk (per-viewing anonymization + dest rewriting); only justify after B1's stall-vs-volume split is measured in a real run. |
+| **C3 save_agent_snapshot offload** | ⛔ **assessed, not done (intentional)** — unlike B1 (disjoint temp dirs), this method mutates shared `AgentState` counters (answer_count / checklist_calls / pending_checklist_recheck_labels — load-bearing per its docstring). Offloading to a worker thread would risk a NEW race on that shared state — the opposite of the goal. Audit rated it Low (discrete events, not hot path). Leave on the loop. |
+| **B5 per-round subagent rewrite guard** | ◐ **partial** — corrected the stale "workspace clears remove .massgen/" comment (false: clear_workspace is disabled + preserves .massgen). Did NOT add the skip-guard: `rewrite_subagent_mcp_config_files(agent_id)` may legitimately change per round; guarding without verifying idempotency could silently break subagent MCP wiring for a few-ms win. |
+| **D3 (emitter/status/web-display guards)** | ⏳ remaining — deliberately scoped small; the changedoc path (the only unguarded throw-prone bookkeeping op) is done. Broaden only if a real failure is seen. |
+| **B4 path-rewrite skip** | ⏳ fold into B2 when that lands. |
+
+**Critical sequencing honored:** R1 + R2/R3 (the yield-exposed races) landed BEFORE B1,
+so making the copy truly async did not expose a latent race. A B1 test asserts peer/
+subagent delivery survives a genuinely-yielding copy window.
+
+**New helpers added:** `PeerAnswerVisibilityTracker.mark_seen_answer_revisions(..., seen_counts=)`
++ `register_injected_answer_updates(..., seen_counts=)`; `Orchestrator._capture_answer_revision_counts`,
+`_consume_pending_subagent_results`, `_record_round_isolation_degraded`,
+`_attach_changedoc_to_latest_answer`; `SubagentLifecycleCoordinator.consume_pending_subagent_results`;
+`FilesystemManager._copy_snapshots_to_temp_workspace_sync` (offloaded via `asyncio.to_thread`).
+`AgentState.round_isolation_degraded` / `round_isolation_error` fields.
+
+---
+
+**Source:** two adversarially-verified audit workflows (`massgen-eng-health-audit`, `massgen-parallelism-correctness-sweep`). Every finding below was checked through ≥2 independent verifier lenses; impact ratings are the verifier-revised values, not the original finder claims.
+
+> **Verify before acting.** These are point-in-time observations with file:line anchors that may drift. Re-read the cited code before implementing — the audits already caught several stale-roadmap and overstated-impact claims, so treat magnitudes skeptically and trust the *mechanism* over the prose.
+
+---
+
+## 0. Where the
```

**File**: `docs/dev_notes/orchestrator_refactor_roadmap.md` (modified, +3/-2)
```diff
@@ -64,7 +64,7 @@
 - [x] Step 23 (PeerAnswerVisibilityTracker-13 methods) — **DONE & verified green** (first batch with zero verifier issues). orchestrator.py → 14,866. Dual-writer field `pending_checklist_recheck_labels` mutated via orch back-ref so ChecklistGateManager later sees the same live set.
 - [x] Step 24 (ChecklistGateManager-11 methods, 1252 lines) — **DONE & verified green** (largest single extraction; 219 tests passed across checklist/criteria/round_evaluator suites). 1 regression fixed: collaborator's `resolve_effective_checklist_criteria` called `self.get_active_criteria(...)` directly → bypassed test monkeypatches on `orchestrator._get_active_criteria` → repointed to `orch._get_active_criteria(...)`.
 - [x] Step 29 (MidStreamInjectionHookInstaller — partial: 6 of 18 pure helpers extracted, 310 lines). The 12 hook-installation methods with duplicated callback closures across 3 backend paths (`_setup_hook_manager_for_agent`, `_setup_codex_mcp_hooks`, `_setup_codex_hybrid_hooks`, `_setup_native_hooks_for_agent`, `_register_round_timeout_hooks`, etc.) remain on Orchestrator — they need a callback-unification pass first (behavior-changing, out of scope for pure extraction).
-- [ ] Step 27 (AgentOrchestrationSetup-2 methods) skipped: lives inline in `__init__` as a nested function + loop; "extraction" requires `__init__`-rewiring not just method-relocation — different kind of refactor.
+- [x] Step 27 (AgentOrchestrationSetup) — **DONE** (corrected 2026-06-04 by eng-health audit). The collaborator now lives at `massgen/orchestrator_collaborators/agent_orchestration_setup.py`; only a thin per-agent delegator loop remains inline in `__init__`. (The earlier "skipped" status was stale — the `__init__`-rewiring was completed.)
 
 ## Release status — SHIPPED (50% milestone)
 
@@ -85,7 +85,8 @@ After completing the original plan, identified and extracted 4 more cohesive clu
 
 ## Follow-up release work
 
-- **AgentOrchestrationSetup**: hoist the inline per-agent setup function out of `__init__` first (a small structural refactor), THEN extract as a collaborator.
+- **AgentOrchestrationSetup**: DONE — extracted to its own collaborator; only a thin `__init__` delegator loop remains (optional future hoist).
+- **MidStreamInjectionHookInstaller**: collaborator exists (`midstream_injection_hook_installer.py`, holds the pure helpers). The remaining work is the duplicated `get_injection_content` closures across the 3 backend paths — a callback-unification pass (audit item A1), tracked in `next_version_eng_health_plan.md`.
 - **MidStreamInjectionHookInstaller remaining 12 methods**: unify the duplicated `get_injection_content` closures across the 3 backend paths (behavior-changing, needs its own validation), THEN extract.
 - These are not blocking — Orchestrator is now 38% smaller and the remaining bulk is the 4 hook-install paths + the streaming-loop core.
 
```

**File**: `massgen/filesystem_manager/_filesystem_manager.py` (modified, +23/-1)
```diff
@@ -14,6 +14,7 @@
 MCP tools configured.
 """
 
+import asyncio
 import json
 import os
 import shutil
@@ -2350,7 +2351,28 @@ async def copy_snapshots_to_temp_workspace(self, all_snapshots: dict[str, Path],
         Returns:
             Path to the temporary workspace with restored snapshots
 
-        TODO: reimplement without 'shutil' and 'os' operations for true async
+        B1: the blocking filesystem work (rmtree/copytree/scrub) is offloaded to a
+        worker thread via ``asyncio.to_thread`` so it does not stall the
+        orchestrator event loop. While one agent's snapshots are copied, the other
+        agents' streams keep being consumed. Each agent owns a distinct
+        ``agent_temporary_workspace`` directory, so concurrent offloaded copies
+        write to disjoint paths — there is no shared-state race.
+        """
+        if not self.agent_temporary_workspace:
+            return None
+
+        return await asyncio.to_thread(
+            self._copy_snapshots_to_temp_workspace_sync,
+            all_snapshots,
+            agent_mapping,
+        )
+
+    def _copy_snapshots_to_temp_workspace_sync(self, all_snapshots: dict[str, Path], agent_mapping: dict[str, str]) -> Path | None:
+        """Synchronous body of :meth:`copy_snapshots_to_temp_workspace`.
+
+        Runs on a worker thread (see that method). Each agent's
+        ``agent_temporary_workspace`` is distinct, so concurrent invocations on
+        different FilesystemManager instances touch disjoint directories.
         """
         if not self.agent_temporary_workspace:
             return None
```

**File**: `massgen/orchestrator.py` (modified, +158/-294)
```diff
@@ -196,6 +196,11 @@ class AgentState:
     # emitted in the current round that are pending merge into the orchestrator
     # accumulator at round transition. Each entry: {text, category, anti_patterns?}.
     criteria_proposals: list[dict[str, Any]] = field(default_factory=list)
+    # D2: set when per-round worktree isolation setup failed and the agent fell
+    # back to its base workspace (no per-round branch isolation). Surfaces the
+    # degradation that was previously only a log line.
+    round_isolation_degraded: bool = False
+    round_isolation_error: str | None = None
 
 
 class Orchestrator(ChatAgent):
@@ -2658,27 +2663,10 @@ def _coordination_complete() -> bool:
                                 agent_id,
                                 prefer_local_runtime_state=True,
                             )
-                            # Attach changedoc from workspace if enabled
-                            if self._is_changedoc_enabled() and agent and agent.backend.filesystem_manager:
-                                from massgen.changedoc import (
-                                    read_changedoc_from_workspace,
-                                )
-
-                                ws_path = agent.backend.filesystem_manager.cwd
-                                if ws_path:
-                                    changedoc_content = read_changedoc_from_workspace(Path(ws_path))
-                                    if changedoc_content:
-                                        answers_list = self.coordination_tracker.answers_by_agent.get(agent_id, [])
-                                        if answers_list:
-                                            label = answers_list[-1].label
-                                            # Replace [SELF] placeholder with real answer label
-                                            changedoc_content = changedoc_content.replace("[SELF]", label)
-                                            answers_list[-1].changedoc = changedoc_content
-                                            logger.info(
-                                                "[Orchestrator] Attached changedoc (%d chars) to %s",
-                                                len(changedoc_content),
-                                                answers_list[-1].label,
-                                            )
+                            # Attach changedoc from workspace if enabled (D3: guarded —
+                            # a changedoc/filesystem error must not kill an agent that
+                            # already recorded a valid answer above).
+                            self._attach_changedoc_to_latest_answer(agent_id, agent)
                             if self._is_decomposition_mode():
                                 self.agent_states[agent_id].decomposition_answer_streak += 1
                                 # Agent has produced a new self revision; keep its own seen
@@ -3548,156 +3536,11 @@ def _setup_hook_manager_for_agent(
         # Create mid-stream injection hook with closure-based callback
         mid_stream_hook = MidStreamInjectionHook()
 
-        # Define the injection callback (captures agent_id and answers)
-        # This is async to allow copying snapshots before injection
+        # Define the injection callback (captures agent_id and answers).
+        # A1: both the GeneralHookManager and native paths route through the
+        # single unified installer method so they can no longer drift.
         async def get_injection_content() -> str | None:
-            """Check if mid-stream injection is needed and return content."""
-            # Skip injection if disabled (multi-agent refinement OFF mode)
-            # Agents work independently without seeing each other's work
-            if self.config.disable_injection:
-                return None
-
-            if not self._check_restart_pending(agent_id):
-                return None
-
-            # First-answer protection: don't inject into an agent that hasn't
-            # produced its first answer yet.
-            if self._should_defer_restart_for_first_answer(agent_id):
-                self.agent_states[agent_id].restart_pending = False
-                return None
-
-            # In vote-only mode, skip injection and force a full restart instead.
-            # Mid-stream injection can't update tool schemas, so agents in vote-only mode
-            # wouldn't be able to vote for newly discovered answers (the vote enum is fixed
-            # at stream start). A full restart gives them updated tool schemas.
-            if self._is_vote_only_mode(agent_id):
-                return None  # Let restart happen instead
-
-            if self._should_defer_peer_updates_until_restart(agent_id):
-                if self._has_unseen_answer_updates(agent_id):
-                    self.agent_states[agent_id].restart_pending = True
-                    logger.info(
-                        "[Orchestrator] De
```

**File**: `massgen/orchestrator_collaborators/active_coordination_cleanup.py` (modified, +15/-0)
```diff
@@ -35,6 +35,21 @@ async def cleanup(self) -> None:
                 logger.warning(f"[Orchestrator] Error stopping SubagentLaunchWatcher: {e}")
             orch._subagent_launch_watcher = None
 
+        # R4: cancel detached background trace-analyzer tasks BEFORE flushing, so a
+        # surviving task cannot append a result after the flush into a queue that
+        # will never be consumed (and so it doesn't outlive the hard timeout). The
+        # task's CancelledError path returns without writing, so awaiting the
+        # cancellation fully closes the window.
+        if getattr(orch, "_background_trace_tasks", None):
+            for _agent_id, trace_task in list(orch._background_trace_tasks.items()):
+                if not trace_task.done():
+                    trace_task.cancel()
+                    try:
+                        await trace_task
+                    except (asyncio.CancelledError, Exception):
+                        pass
+            orch._background_trace_tasks.clear()
+
         # Flush any pending subagent results that weren't delivered.
         orch._flush_pending_subagent_results()
 
```

**File**: `massgen/orchestrator_collaborators/answer_text_normalizer.py` (modified, +12/-2)
```diff
@@ -105,15 +105,25 @@ def normalize_workspace_paths_in_answers(
                 other_workspace = str(
                     other_agent.backend.filesystem_manager.get_current_workspace(),
                 )
+                # C2: use loguru brace-style deferred formatting instead of eager
+                # f-strings. These logs interpolate the full answer body on every
+                # (answer x agent) pair; with f-strings Python builds the multi-KB
+                # string even when no DEBUG sink is attached. With brace args, loguru
+                # only formats when a handler actually accepts the record.
                 logger.debug(
-                    f"[Orchestrator._normalize_workspace_paths_in_answers] Replacing {other_workspace} in answer from {agent_id} with path {replace_path}. original answer: {normalized_answer}",
+                    "[Orchestrator._normalize_workspace_paths_in_answers] Replacing {} in answer from {} with path {}. original answer: {}",
+                    other_workspace,
+                    agent_id,
+                    replace_path,
+                    normalized_answer,
                 )
                 normalized_answer = normalized_answer.replace(
                     other_workspace,
                     replace_path,
                 )
                 logger.debug(
-                    f"[Orchestrator._normalize_workspace_paths_in_answers] Intermediate normalized answer: {normalized_answer}",
+                    "[Orchestrator._normalize_workspace_paths_in_answers] Intermediate normalized answer: {}",
+                    normalized_answer,
                 )
 
             normalized_answers[agent_id] = normalized_answer
```

**File**: `massgen/orchestrator_collaborators/midstream_injection_hook_installer.py` (modified, +192/-1)
```diff
@@ -20,7 +20,8 @@
 from pathlib import Path
 from typing import TYPE_CHECKING, Any
 
-from massgen.logger_config import logger
+from massgen.logger_config import get_event_emitter, logger
+from massgen.utils import ActionType
 
 if TYPE_CHECKING:
     from massgen.orchestrator import Orchestrator
@@ -143,6 +144,196 @@ def compute_plan_progress_stats(self, workspace_path: str) -> dict[str, Any] | N
             logger.debug(f"[Orchestrator] Could not compute plan progress: {e}")
             return None
 
+    async def build_midstream_injection(
+        self,
+        agent_id: str,
+        answers: dict[str, str],
+        *,
+        native: bool,
+    ) -> str | None:
+        """Unified mid-stream peer-answer injection callback (A1).
+
+        Replaces the two near-identical ``get_injection_content`` closures that
+        lived inline in ``_setup_hook_manager_for_agent`` (GeneralHookManager
+        path) and ``_setup_native_hooks_for_agent`` (native path). Keeping them
+        separate was a backend-parity hazard — a fix to one path silently skipped
+        the other.
+
+        ``native`` only affects log/track wording and the (non-native) debug
+        workspace-listing output. The side-effect sequence is canonical and
+        preserves the load-bearing invariant shared by both original closures:
+        ``update_agent_context_with_new_answers`` runs BEFORE
+        ``refresh_checklist_state_for_agent`` so ``available_agent_labels``
+        reflect the newly-injected labels. (The prior inter-path divergence in
+        the position of the ``restart_pending`` recompute and the emitter/track
+        calls was verified inert — the recompute reads only ``seen_answer_counts``,
+        which is set at the same relative position in both paths.)
+
+        Mutates the caller's ``answers`` dict in place so re-entrant callbacks do
+        not re-inject the same updates.
+        """
+        orch = self._orchestrator
+        label = "native " if native else ""
+        track_suffix = " (native)" if native else ""
+
+        # Skip injection if disabled (multi-agent refinement OFF mode).
+        if orch.config.disable_injection:
+            return None
+
+        if not orch._check_restart_pending(agent_id):
+            return None
+
+        # First-answer protection: don't inject before the agent's first answer.
+        if orch._should_defer_restart_for_first_answer(agent_id):
+            orch.agent_states[agent_id].restart_pending = False
+            return None
+
+        # In vote-only mode, force a full restart instead (mid-stream injection
+        # can't update the fixed vote tool schema).
+        if orch._is_vote_only_mode(agent_id):
+            return None
+
+        if orch._should_defer_peer_updates_until_restart(agent_id):
+            if orch._has_unseen_answer_updates(agent_id):
+                orch.agent_states[agent_id].restart_pending = True
+                logger.info(
+                    "[Orchestrator] Deferring %speer answer update injection until restart for %s",
+                    label,
+                    agent_id,
+                )
+            else:
+                orch.agent_states[agent_id].restart_pending = False
+            return None
+
+        # Get CURRENT answers (includes virtual agents in step mode).
+        current_answers = orch._get_current_answers_snapshot()
+        selected_answers, had_unseen_updates = orch._select_midstream_answer_updates(
+            agent_id,
+            current_answers,
+        )
+
+        if not selected_answers:
+            if had_unseen_updates:
+                # Keep restart pending when unseen updates still exist.
+                orch.agent_states[agent_id].restart_pending = True
+                cap = getattr(orch.config, "max_midstream_injections_per_round", 2)
+                logger.info(
+                    "[Orchestrator] Skipping %smid-stream injection for %s: per-round cap reached (%s)",
+                    label,
+                    agent_id,
+                    cap,
+                )
+            else:
+                # No unseen updates remain: this was a stale restart_pending flag.
+                orch.agent_states[agent_id].restart_pending = False
+            return None
+
+        # R1: capture peer revision counts as-of selection, before the
+        # snapshot-copy await below can let a peer publish a new revision that
+        # would otherwise be silently marked "seen".
+        captured_revision_counts = orch._capture_answer_revision_counts(list(selected_answers.keys()))
+
+        # TIMING CONSTRAINT: skip injection if too close to soft timeout.
+        if orch._should_skip_injection_due_to_timeout(agent_id):
+            return None
+
+        # Copy snapshots from new-answer agents to temp workspace BEFORE building
+        # the injection, so the workspace files are available to the agent.
+        logger.info(
+            "[Orchestrator] Copying snapshots for mid-stre
```

**File**: `massgen/orchestrator_collaborators/peer_answer_visibility_tracker.py` (modified, +32/-5)
```diff
@@ -83,14 +83,34 @@ def sync_decomposition_answer_visibility(self, agent_id: str) -> None:
 
         state.seen_answer_counts = current_counts
 
-    def mark_seen_answer_revisions(self, agent_id: str, source_agent_ids: list[str]) -> None:
-        """Mark current answer revisions from source agents as seen by ``agent_id``."""
+    def mark_seen_answer_revisions(
+        self,
+        agent_id: str,
+        source_agent_ids: list[str],
+        seen_counts: dict[str, int] | None = None,
+    ) -> None:
+        """Mark answer revisions from source agents as seen by ``agent_id``.
+
+        ``seen_counts`` (R1 fix): per-source revision counts *captured at the
+        moment the injected content was selected*. When provided, the source is
+        marked seen up to that captured count rather than the live count, so a
+        peer revision published during the intervening ``await`` (e.g. snapshot
+        copy) is NOT silently marked seen and remains injectable. The captured
+        count is clamped to the current count and never lowers an already-higher
+        seen count. When omitted, falls back to the legacy live read.
+        """
         orch = self._orchestrator
         state = orch.agent_states.get(agent_id)
         if not state:
             return
         for source_agent_id in source_agent_ids:
-            state.seen_answer_counts[source_agent_id] = self.get_agent_answer_revision_count(source_agent_id)
+            current = self.get_agent_answer_revision_count(source_agent_id)
+            if seen_counts is not None and source_agent_id in seen_counts:
+                count = min(int(seen_counts[source_agent_id]), current)
+            else:
+                count = current
+            prev = state.seen_answer_counts.get(source_agent_id, 0)
+            state.seen_answer_counts[source_agent_id] = max(prev, count)
 
     def get_latest_answer_revision_timestamp(self, source_agent_id: str) -> float:
         """Get timestamp of the latest answer revision for an agent."""
@@ -273,8 +293,15 @@ def register_injected_answer_updates(
         self,
         agent_id: str,
         source_agent_ids: list[str],
+        seen_counts: dict[str, int] | None = None,
     ) -> None:
-        """Apply per-agent state updates after mid-stream answer injection."""
+        """Apply per-agent state updates after mid-stream answer injection.
+
+        ``seen_counts`` is forwarded to :meth:`mark_seen_answer_revisions` (R1
+        fix): pass the revision counts captured when the injected content was
+        selected so a peer revision published during the intervening ``await``
+        is not marked seen. See that method for details.
+        """
         orch = self._orchestrator
         state = orch.agent_states.get(agent_id)
         if not state or not source_agent_ids:
@@ -288,4 +315,4 @@ def register_injected_answer_updates(
             )
             state.decomposition_answer_streak = 0
 
-        self.mark_seen_answer_revisions(agent_id, source_agent_ids)
+        self.mark_seen_answer_revisions(agent_id, source_agent_ids, seen_counts=seen_counts)
```

---

### Incident Patch 10: `7de242f4` (2026-06-03)
**Commit Message**: Adj debug log

**File**: `massgen/cli/backends.py` (modified, +1/-1)
```diff
@@ -853,7 +853,7 @@ def merge_configs(global_cfg, agent_cfg):
                                 )
                             else:
                                 logger.debug(
-                                    f"✅ Using OPENAI_API_KEY from environment (key starts with: {api_key[:7]}...)",
+                                    "✅ Using OPENAI_API_KEY from environment",
                                 )
                             embedding_cfg["api_key"] = api_key
                         elif emb_provider == "together":
```

---

### Incident Patch 11: `74f9b21a` (2026-06-03)
**Commit Message**: fix: correctness and safety hardening (Tier 1)

- Route response backend tool-call argument parsing through the shared
  normalize_json_object_argument util, logging malformed payloads instead of
  silently dropping them to {}.
- Replace the misleading 'except (ValueError, Exception)' anti-pattern with
  'except Exception' in understand_image.

(The MAS-274 orchestration-thread ContextVar isolation fix and the matching
except cleanup live in massgen/cli/run.py, committed with the cli package.)

Co-Authored-By: Claude Opus 4.8 <[REDACTED_EMAIL]>

**File**: `massgen/backend/response.py` (modified, +7/-3)
```diff
@@ -27,6 +27,7 @@
 from ..formatter import ResponseFormatter
 from ..logger_config import log_backend_agent_message, log_stream_chunk, logger
 from ..stream_chunk import ChunkType, TextStreamChunk
+from ..utils.tool_argument_normalization import normalize_json_object_argument
 from ._streaming_buffer_mixin import StreamingBufferMixin
 from .base import FilesystemSupport, StreamChunk
 from .base_with_custom_tool_and_mcp import (
@@ -834,11 +835,14 @@ async def _stream_with_custom_and_mcp_tools(
                     tool_name = call.get("name", "")
                     tool_args = call.get("arguments", {})
 
-                    # Parse arguments if they're a string
+                    # Normalize arguments (may arrive as a JSON string). Use the
+                    # shared normalizer; on malformed payloads log (don't silently
+                    # drop) and fall back to empty args.
                     if isinstance(tool_args, str):
                         try:
-                            tool_args = json.loads(tool_args)
-                        except json.JSONDecodeError:
+                            tool_args, _ = normalize_json_object_argument(tool_args, field_name=tool_name or "arguments")
+                        except ValueError:
+                            logger.warning(f"Malformed tool arguments for {tool_name!r}; using empty args.")
                             tool_args = {}
 
                     # Build tool call in standard format
```

**File**: `massgen/tool/_multimodal_tools/understand_image.py` (modified, +2/-2)
```diff
@@ -311,15 +311,15 @@ def _error(msg: str) -> ExecutionResult:
             try:
                 loaded = _load_and_process_image(image_path, base_dir, allowed_paths_list, name=None)
                 loaded_images.append(loaded)
-            except (ValueError, Exception) as e:
+            except Exception as e:
                 return _error(str(e))
         elif images:
             # Multi-image mode with names from dict keys
             for name, path in images.items():
                 try:
                     loaded = _load_and_process_image(path, base_dir, allowed_paths_list, name=name)
                     loaded_images.append(loaded)
-                except (ValueError, Exception) as e:
+                except Exception as e:
                     return _error(f"Error loading '{name}': {str(e)}")
         else:
             # Follow-up mode: rely on conversation threading, no new image payload.
```

---

### Incident Patch 12: `e5bfb474` (2026-06-01)
**Commit Message**: Fix parallel mcp example

**File**: `massgen/configs/tools/web-search/parallel_search_example.yaml` (modified, +1/-0)
```diff
@@ -83,6 +83,7 @@ agents:
 orchestrator:
   snapshot_storage: "snapshots"
   agent_temporary_workspace: "temp_workspaces"
+  max_new_answers_per_agent: 3
 
 ui:
   display_type: "textual_terminal"
```

---

### Incident Patch 13: `3e82d2b1` (2026-06-01)
**Commit Message**: Fix parallel mcp example

**File**: `massgen/configs/tools/web-search/parallel_search_example.yaml` (modified, +7/-7)
```diff
@@ -25,18 +25,14 @@
 agents:
   - id: "parallel_research_agent"
     backend:
-      type: "claude"
-      model: "claude-sonnet-4-20250514"
+      type: "gemini"
+      model: "gemini-3-flash-preview"
+      cwd: "parallel_search_workspace"
       mcp_servers:
         - name: "parallel_search"
           type: "streamable-http"
           url: "https://search.parallel.ai/mcp"
           # Uncomment to enable higher rate limits with a Parallel API key.
-          # NOTE: this `headers` block is the generic massgen MCP transport
-          # shape (matches the streamable_http_test configs). When using the
-          # `claude_code` backend, the equivalent field is a top-level
-          # `authorization: "Bearer ${PARALLEL_API_KEY}"` instead (see
-          # massgen/backend/docs/MCP_IMPLEMENTATION_CLAUDE_BACKEND.md).
           # headers:
           #   Authorization: "Bearer ${PARALLEL_API_KEY}"
           security:
@@ -84,6 +80,10 @@ agents:
       Provide comprehensive, well-sourced responses based on the search
       results.
 
+orchestrator:
+  snapshot_storage: "snapshots"
+  agent_temporary_workspace: "temp_workspaces"
+
 ui:
   display_type: "textual_terminal"
   logging_enabled: true
```

---

### Incident Patch 14: `5aa70c4e` (2026-06-01)
**Commit Message**: refactor: fold _should_spawn_trace_analyzer into TraceAnalyzerRunner

17-line gate (auto_trace_analysis config + round-2+ + no-in-flight-task) folded
into the existing TraceAnalyzerRunner. Stays on Orchestrator as thin delegator.

orchestrator.py: 8,574 → 8,561 lines (still 49 collaborators).

Co-Authored-By: Claude Opus 4.7 <[REDACTED_EMAIL]>

**File**: `massgen/orchestrator.py` (modified, +2/-15)
```diff
@@ -5771,21 +5771,8 @@ def _resolve_trace_analysis_artifact_path(
     # ------------------------------------------------------------------
 
     def _should_spawn_trace_analyzer(self, agent_id: str) -> bool:
-        """Return True if auto_trace_analysis should spawn for this agent."""
-        coord = getattr(self.config, "coordination_config", None)
-        if not coord:
-            return False
-        if not getattr(coord, "auto_trace_analysis", False):
-            return False
-        # Must be round 2+ (restart_count >= 1)
-        state = self.agent_states.get(agent_id)
-        if not state or getattr(state, "restart_count", 0) < 1:
-            return False
-        # Must not already have an in-flight trace task
-        existing = self._background_trace_tasks.get(agent_id)
-        if existing and not existing.done():
-            return False
-        return True
+        """Delegates to TraceAnalyzerRunner.should_spawn_trace_analyzer."""
+        return self._trace_analyzer_runner.should_spawn_trace_analyzer(agent_id)
 
     def _get_execution_trace_path_for_agent(self, agent_id: str) -> Path | None:
         """Delegator: see TraceAnalyzerRunner."""
```

**File**: `massgen/orchestrator_collaborators/trace_analyzer_runner.py` (modified, +18/-0)
```diff
@@ -666,3 +666,21 @@ def split_combined_spawn_result(
             "results": trace_results,
         }
         return eval_dict, trace_dict
+
+    def should_spawn_trace_analyzer(self, agent_id: str) -> bool:
+        """Return True if auto_trace_analysis should spawn for this agent."""
+        orch = self._orchestrator
+        coord = getattr(orch.config, "coordination_config", None)
+        if not coord:
+            return False
+        if not getattr(coord, "auto_trace_analysis", False):
+            return False
+        # Must be round 2+ (restart_count >= 1)
+        state = orch.agent_states.get(agent_id)
+        if not state or getattr(state, "restart_count", 0) < 1:
+            return False
+        # Must not already have an in-flight trace task
+        existing = orch._background_trace_tasks.get(agent_id)
+        if existing and not existing.done():
+            return False
+        return True
```

---

### Incident Patch 15: `56f5471b` (2026-06-01)
**Commit Message**: fix: restore @staticmethod on _format_trace_analyzer_for_memory_static

A prior fold-in (split_combined_spawn_result extraction) inadvertently
ate the @staticmethod decorator from the immediately-following
_format_trace_analyzer_for_memory_static method. The docstring still
claimed @staticmethod but the decorator was missing, so unbound
Orchestrator._format_trace_analyzer_for_memory_static(arg1, arg2) calls
in test_auto_trace_analysis.py failed with "takes 2 positional arguments
but 3 were given". Restored the decorator.

Co-Authored-By: Claude Opus 4.7 <[REDACTED_EMAIL]>

**File**: `massgen/orchestrator.py` (modified, +1/-0)
```diff
@@ -5700,6 +5700,7 @@ def _split_combined_spawn_result(
 
         return TraceAnalyzerRunner.split_combined_spawn_result(combined, evaluator_subagent_id, trace_subagent_id)
 
+    @staticmethod
     def _format_trace_analyzer_for_memory_static(
         trace_result: "SubagentResult",
         round_number: int,
```

#### Recent Merged Pull Requests:
- **PR #1132** (closed): fix(docs): repair the broken Star History chart in the README (@FaintFlower)
- **PR #1131** (closed): feat: add Atlas Cloud Chat Completions support (@binyangzhu000-sudo)
- **PR #1130** (closed): docs: add DaoXE OpenAI-compatible Chat Completions backend example (@seven7763)
- **PR #1129** (closed): fix(cli): wizard CSS_PATH broken after cli.py package split (@scoobyluu)
- **PR #1128** (2026-06-12): docs(release): drop interactive approval modal from v0.1.97 (not working yet) (@ncrispino)
- **PR #1127** (2026-06-12): feat: layered opt-in permission system (P0–P2.2) — rules, approval, audit, guardrail prompt (@ncrispino)
- **PR #1126** (2026-06-12): feat: v0.1.97 (@Henry-811)
- **PR #1125** (2026-06-10): feat: OS-level SRT agent sandboxing + permission-hook hardening (@ncrispino)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

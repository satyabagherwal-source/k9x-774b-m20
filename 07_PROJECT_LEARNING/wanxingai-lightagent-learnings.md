# Forensic Learning Record (Deep Inspection): wanxingai/LightAgent

> **Canonical Artifact**: `07_PROJECT_LEARNING/wanxingai-lightagent-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/wanxingai/LightAgent](https://github.com/wanxingai/LightAgent))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T06:16:36.060Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `wanxingai/LightAgent`
- **Description**: LightAgent: Lightweight Python framework for OpenAI-compatible agents with tools, memory, guardrails, tracing, lifecycle hooks, multi-agent collaboration, and workflows.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 1230 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `LightAgent/core.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
作者: [weego/WXAI-Team]
最后更新: 2026-02-07
"""

import asyncio
import concurrent.futures
import inspect
import threading
import json
import os
import random
import re
import time
import traceback
from copy import deepcopy
from datetime import datetime
from typing import List, Dict, Any, Callable, Union, Optional, Generator, AsyncGenerator, Protocol, TypeVar, Coroutine
from uuid import uuid4

import httpx
from openai.types.chat import ChatCompletionChunk

# 从各子模块导入
from .version import __version__
from .protocol import (
    MemoryCandidate,
    MemoryPolicy,
    MemoryProtocol,
    MemoryPromotionDecision,
    MemoryScope,
)
from .logger import LoggerManager
from .tools import ToolRegistry, ToolLoader, AsyncToolDispatcher
from .cancellation import CancellationToken
from .errors import format_error_code, format_lightagent_error
from .result import RunResult, StreamEvent
from .tracing import TraceRecorder, export_trace, normalize_usage, summarize_trace
from .hooks import HOOK_BLOCK, HookContext, HookDecision, HookManager, PolicyHook
from .guardrails import GuardrailManager
from .mcp_client_manager import MCPClientManager
from .skills import SkillManager
from .skill_tools import create_skill_tools
from .capabilities import (
    CapabilityRegistry,
    CapabilityRisk,
    CapabilityScope,
    CapabilitySpec,
    MemoryProviderAdapter,
    PolicyEngine,
    PolicyRequest,
    ToolProviderAdapter,
)
from .runtime import AgentRuntime, BudgetExceeded, BudgetLimits
from .session import (
    ContextBudget,
    ContextCompactor,
    ContextProjector,
    Session,
    SessionStore,
)
# 新增：导入内置工具
from .builtin_tools.python_executor import (
    execute_python_code,
    execute_python_file,
    execute_python_code_stream,
    UNSAFE_PYTHON_TOOL_REASON,
    is_unsafe_python_tool,
)
from .builtin_tools.nos import upload_file_to_oss
from .builtin_tools.safe_expression import safe_expression


# TypeVar for generic coroutine return type
T = TypeVar('T')


def run_async_safely(coro: Coroutine[Any, Any, T]) -> T:
    """
    Safely run an async coroutine, handling the case where we're already
    inside an event loop (e.g., FastAPI, Jupyter, etc.).

    This solves the "RuntimeError: asyncio.run() cannot be called from a
    running event loop" issue by detecting the current context and using
    the appropriate execution strategy.

    Args:
        coro: The coroutine to execute

    Returns:
        The result of the coroutine

    Raises:
        Any exception raised by the coroutine
    """
    try:
        # Check if we're already in an event loop
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # No running event loop, safe to use asyncio.run()
        return asyncio.run(coro)

    # We're inside an event loop - need alternative execution strategy
    # Run the coroutine in a separate thread with its own event loop
    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
        future = executor.submit(asyncio.run, coro)
        return future.result()

# openai.langfuse_auth_check()

class LightAgent:
    __version__ = __version__

    def __init__(
            self,
            *,
            name: Optional[str] = None,  # 代理名称
            instructions: Optional[str] = None,  # 代理指令
            role: Optional[str] = None,  # 代理角色
            model: str,  # agent模型名称
            api_key: str | None = None,  # 模型 api key
            base_url: str | httpx.URL | None = None,  # 模型 base url
            provider: str | None = None,  # LLM provider ("litellm" to route via LiteLLM SDK)
            websocket_base_url: str | httpx.URL | None = None,  # 模型 websocket base url
            memory: Optional[MemoryProtocol] = None,  # 支持外部传入记忆模块
            memory_policy: Optional[MemoryPolicy] = None,  # 记忆安全策略
            memory_namespace: Optional[str] = None,  # 记忆命名空间快捷配置
            tree_of_thought: bool = False,  # 是否启用链式思考
            tot_model: str | None = None,  # 链式思考模型
            tot_api_key: str | None = None,  # 链式思考模型API密钥
            tot_base_url: str | httpx.URL | None = None,  # 链式思考模型base_url
            filter_tools: bool = True,  # 是否启用工具过滤
            self_learning: bool = False,  # 是否启用agent自我学习
            tools: List[Union[str, Callable]] = None,  # 支持工具混合输入
            enable_unsafe_python: bool = False,  # 兼容注册；旧执行器不能由模型调度
            skills_directories: List[str] = None,  # 支持技能混合输入
            auto_discover_skills: bool = True,  # 是否自动发现技能
            input_guardrails: List[Callable[..., Any]] | None = None,  # 输入安全策略
            tool_guardrails: List[Callable[..., Any]] | None = None,  # 工具调用安全策略
            output_guardrails: List[Callable[..., Any]] | None = None,  # 输出安全策略
            hooks: List[Callable[..., Any] | PolicyHook] | None = None,  # 运行期 hook / middleware
            session_store: SessionStore | None = None,  # v0.10 Session 持久化后端
            capability_registry: CapabilityRegistry | None = None,  # v0.10 能力注册表
            policy_engine: PolicyEngine | None = None,  # v0.10 统一能力策略
            budget_limits: BudgetLimits | None = None,  # v0.10 长任务预算
            context_budget: ContextBudget | None = None,  # 可选模型上下文预算
            context_compactor: ContextCompactor | None = None,  # 可选上下文压缩器
            debug: bool = False,  # 是否启用调试模式
            log_level: str = "INFO",  # 日志级别（INFO, DEBUG, ERROR）
            log_file: Optional[str] = None,  # 日志文件路径
            tracetools: Optional[dict] = None,  # log跟踪工具
    ) -> None:
        """
        初始化 LightAgent。

        :param name: 代理名称。
        :param instructions: 代理指令。
        :param role: Agent 的角色描述。
        :param model: 使用的模型名称。
        :param api_key: API 密钥。
        :param base_url: API 的基础 URL。
        :param provider: 可选模型供应商路由。传入 "litellm" 时通过 LiteLLM SDK 调用模型。
        :param websocket_base_url: WebSocket 的基础 URL。
        :param memory: 外部传入的记忆模块，需实现 `retrieve` 和 `store` 方法。
        :param memory_policy: 可选记忆安全策略，用于共享记忆后端的命名空间与检索过滤。
        :param memory_namespace: 记忆命名空间快捷配置，会生成默认 MemoryPolicy。
        :param tree_of_thought: 是否启用思维链功能。
        :param tot_model: 使用的模型名称。
        :param tot_api_key: API 密钥。
        :param tot_base_url: API 的基础 URL。
        :param filter_tools: 是否启用工具过滤。
        :param tools: 工具列表，支持函数名称（字符串）或函数对象。
        :param enable_unsafe_python: 是否兼容注册旧 Python 执行工具；模型调度始终阻断，应用可直接调用。
        :param input_guardrails: 输入安全策略列表，返回 False、原因字符串、dict 或 GuardrailDecision 可阻止运行。
        :param tool_guardrails: 工具调用安全策略列表，返回 False、原因字符串、dict 或 GuardrailDecision 可阻止工具执行。
        :param output_guardrails: 输出安全策略列表，返回 False、原因字符串、dict 或 GuardrailDecision 可阻止非流式输出。
        :param hooks: 运行期 hook 列表，可观察、替换或阻断指定生命周期阶段。
        :param session_store: 可选 SessionStore；默认使用进程内存储且不影响旧调用方式。
        :param capability_registry: 可选 CapabilityRegistry，用于统一 Provider 生命周期与策略。
        :param policy_engine: 可选能力策略引擎；传入 registry 时应优先配置 registry 自身策略。
        :param budget_limits: 可选模型调用、工具调用、token、时间和成本预算。
        :param context_budget: 可选上下文 token 预算。
        :param context_compactor: 可选两阶段上下文压缩器。
        :param debug: 是否启用调试模式。
        :param log_level: 日志级别（INFO, DEBUG, ERROR）。
        :param log_file: 日志文件路径。
        :param tracetools: log跟踪工具。
        """

        # 初始化核心组件
        self.tool_registry = ToolRegistry()
        self.tool_loader = ToolLoader()

        self.mcp_setting = None
        self.mcp_client = None
        if provider not in (None, "litellm"):
            raise ValueError("provider must be None or 'litellm'")
        if not model:
            model = "gpt-4o-mini"  # 默认模型
        if not api_key:
            api_key = os.environ.get("OPENAI_API_KEY")
        if not base_url:
            base_url = os.environ.get("OPENAI_BASE_URL")
        self.loaded_tools = {}  # 用于存储已加载的工具函数
        if not name:
            random_suffix = random.randint(10000000, 99999999)  # 生成一个8位随机数作为agent编号
            name = f"LightAgent{random_suffix}"
        self.name = name
        if not instructions:
            instructions = "You are a helpful agent."
        self.instructions = instructions
        self.role = role
        self.model = model
        self.memory = memory
        self.memory_policy = memory_policy or MemoryPolicy(namespace=memory_namespace)
        self.guardrails = GuardrailManager(
            input_guardrails=input_guardrails,
            tool_guardrails=tool_guardrails,
            output_guardrails=output_guardrails,
        )
        self.hooks = HookManager(hooks)
        self.tree_of_thought = tree_of_thought
        self.self_learning = self_learning
        self.filter_tools = filter_tools

        self.debug = debug
        self.log_level = log_level.upper()
        self.traceid = ""  # 用于存储 traceid
        self._current_run_id = ""
        self._current_user_id = "default_user"
        self._current_run_metadata: dict[str, Any] = {}
        self._parent_trace_id: str | None = None
        self._run_group_id: str | None = None
        self._memory_promotion_candidates: list[MemoryCandidate] = []
        self.context_budget = context_budget
        self.context_compactor = context_compactor or ContextCompactor()
        # 确保 log 目录存在
        log_dir = 'logs'
        if not os.path.exists(log_dir):
            os.makedirs(log_dir)
        # 将 log_file 路径设置为 log 目录下的文件
        if debug:
            if not log_file:
                log_file = f"{self.name}.log"
            self.log_file = os.path.join(log_dir, log_file)
            # Set up the logger
            # 初始化日志系统
            self.logger = LoggerManager(
                name=self.name,
                debug=debug,
                log_level=log_level,
                log_file=self.log_file
            )

        # 初始化技能管理器
        self.skills_directories = skills_directories or ["skills"]
        self.skill_manager = SkillManager(self.skills_directories, self.logger if debug else None)

        self.tools = tools or []
        if self.tools:
            self
```

### Core Architecture Module: `LightAgent/dag/worker.py`
```
"""Worker protocols, factories, and strict LightAgent result adaptation."""

from __future__ import annotations

import asyncio
import inspect
import json
from typing import Any, Awaitable, Callable, Mapping, Protocol

from ..cancellation import accepts_keyword
from .models import DecompositionProposal, TaskContext, TaskOutcome, TaskOutcomeKind, TaskSpec


class DAGWorkerProtocolError(RuntimeError):
    pass


class DAGWorker(Protocol):
    async def execute(self, context: TaskContext) -> TaskOutcome:
        ...


class WorkerFactory(Protocol):
    async def create(self, worker_key: str, context: TaskContext) -> DAGWorker:
        ...

    async def release(self, worker: DAGWorker, context: TaskContext) -> None:
        ...


class CallableWorker:
    def __init__(self, function: Callable[[TaskContext], Any | Awaitable[Any]]):
        self.function = function

    async def execute(self, context: TaskContext) -> TaskOutcome:
        if inspect.iscoroutinefunction(self.function):
            raw = await self.function(context)
        else:
            raw = await asyncio.to_thread(self.function, context)
        return normalize_task_outcome(raw, context)


class RegistryWorkerFactory:
    """Create isolated workers from stable application-owned registrations."""

    def __init__(self, registrations: Mapping[str, Any] | None = None):
        self.registrations = dict(registrations or {})
        self.factories: set[str] = set()

    def register(self, key: str, factory: Any) -> None:
        if not key.strip():
            raise ValueError("worker key must not be empty")
        self.registrations[key] = factory

    def register_factory(self, key: str, factory: Any) -> None:
        self.register(key, factory)
        self.factories.add(key)

    async def create(self, worker_key: str, context: TaskContext) -> DAGWorker:
        if worker_key not in self.registrations:
            raise LookupError(f"worker `{worker_key}` is not registered")
        registration = self.registrations[worker_key]
        if worker_key in self.factories:
            value = registration(context) if accepts_keyword(registration, "context") else registration()
            if inspect.isawaitable(value):
                value = await value
        else:
            value = registration
        if hasattr(value, "execute"):
            return value
        if callable(value):
            return CallableWorker(value)
        raise TypeError(f"worker registration `{worker_key}` does not produce a DAGWorker")

    async def release(self, worker: DAGWorker, context: TaskContext) -> None:
        close = getattr(worker, "close", None)
        if callable(close):
            value = close()
            if inspect.isawaitable(value):
                await value


class LightAgentWorkerAdapter:
    """Require explicit structured TaskOutcome output from a LightAgent-like object."""

    def __init__(self, agent: Any, *, prompt_builder: Callable[[TaskContext], str] | None = None):
        self.agent = agent
        self.prompt_builder = prompt_builder or self._default_prompt

    async def execute(self, context: TaskContext) -> TaskOutcome:
        query = self.prompt_builder(context)
        kwargs = {
            "user_id": context.security_context.user_id or "dag-worker",
            "cancellation_token": context.cancellation_token,
            "idempotency_key": f"{context.run.run_id}:{context.task.spec.task_id}:{context.attempt.attempt_no}",
        }
        arun = getattr(self.agent, "arun", None)
        if callable(arun):
            accepted = {key: value for key, value in kwargs.items() if accepts_keyword(arun, key)}
            raw = await arun(query, **accepted)
        else:
            run = getattr(self.agent, "run", None)
            if not callable(run):
                raise TypeError("LightAgentWorkerAdapter requires an object with run() or arun()")
            accepted = {key: value for key, value in kwargs.items() if accepts_keyword(run, key)}
            raw = await asyncio.to_thread(run, query, **accepted)
        if hasattr(raw, "error") and raw.error:
            raise DAGWorkerProtocolError("agent returned a failed RunResult")
        content = getattr(raw, "content", raw)
        if isinstance(content, str):
            try:
                content = json.loads(content)
            except (json.JSONDecodeError, TypeError) as exc:
                raise DAGWorkerProtocolError("agent output must be an explicit JSON TaskOutcome") from exc
        return normalize_task_outcome(content, context)

    @staticmethod
    def _default_prompt(context: TaskContext) -> str:
        dependencies = {
            task_id: [artifact.to_dict() for artifact in artifacts]
            for task_id, artifacts in context.dependency_artifacts.items()
        }
        return json.dumps({
            "instruction": "Return a JSON TaskOutcome with kind candidate, decomposition, or blocked.",
            "goal": context.task.spec.goal,
            "acceptance_contract": context.task.spec.acceptance_contract,
            "phase": context.attempt.phase,
            "dependencies": dependencies,
            "last_diagnostic": context.last_diagnostic,
        }, ensure_ascii=False, sort_keys=True)


def normalize_task_outcome(raw: Any, context: TaskContext | None = None) -> TaskOutcome:
    if isinstance(raw, TaskOutcome):
        return raw
    if not isinstance(raw, Mapping):
        raise DAGWorkerProtocolError("worker must return TaskOutcome or an explicit mapping")
    kind = TaskOutcomeKind(str(raw.get("kind", "")))
    metadata = dict(raw.get("metadata") or {})
    if kind == TaskOutcomeKind.CANDIDATE:
        if "content" not in raw:
            raise DAGWorkerProtocolError("candidate outcome requires content")
        return TaskOutcome.candidate(
            raw["content"],
            media_type=str(raw.get("media_type", "text/plain")),
            **metadata,
        )
    if kind == TaskOutcomeKind.BLOCKED:
        return TaskOutcome.blocked(str(raw.get("blocker") or ""), **metadata)
    proposal_value = raw.get("decomposition")
    if isinstance(proposal_value, DecompositionProposal):
        proposal = proposal_value
    elif isinstance(proposal_value, Mapping):
        if context is None:
            raise DAGWorkerProtocolError("decomposition mapping requires TaskContext")
        proposal_kwargs = {
            "parent_task_id": str(proposal_value.get("parent_task_id") or context.task.spec.task_id),
            "new_tasks": tuple(TaskSpec.from_dict(item) for item in proposal_value.get("new_tasks", [])),
            "reuse_task_ids": tuple(proposal_value.get("reuse_task_ids") or ()),
            "rationale": str(proposal_value.get("rationale") or ""),
            "composition_contract": proposal_value.get("composition_contract"),
            "expected_graph_revision": int(
                proposal_value.get("expected_graph_revision", context.run.graph_revision)
            ),
        }
        if proposal_value.get("proposal_id"):
            proposal_kwargs["proposal_id"] = str(proposal_value["proposal_id"])
        proposal = DecompositionProposal(**proposal_kwargs)
    else:
        raise DAGWorkerProtocolError("decomposition outcome requires a proposal")
    return TaskOutcome.decompose(proposal, **metadata)


__all__ = [
    "DAGWorkerProtocolError",
    "DAGWorker",
    "WorkerFactory",
    "CallableWorker",
    "RegistryWorkerFactory",
    "LightAgentWorkerAdapter",
    "normalize_task_outcome",
]

```

### Core Architecture Module: `LightAgent/hooks.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
Runtime hook primitives for LightAgent lifecycle extensions.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import inspect
from dataclasses import dataclass, field
from collections.abc import Awaitable
from typing import Any, Callable


HOOK_CONTINUE = "continue"
HOOK_REPLACE = "replace"
HOOK_BLOCK = "block"
HOOK_RETRY = "retry"
HOOK_FALLBACK = "fallback"
HOOK_METADATA = "metadata"


@dataclass
class HookContext:
    """Context passed to runtime hooks."""

    phase: str
    payload: dict[str, Any] = field(default_factory=dict)
    trace_id: str | None = None
    parent_trace_id: str | None = None
    run_id: str | None = None
    run_group_id: str | None = None
    user_id: str | None = None
    agent_name: str | None = None
    flow_id: str | None = None
    step_name: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class HookDecision:
    """Decision returned by a runtime hook."""

    action: str = HOOK_CONTINUE
    payload: dict[str, Any] | None = None
    reason: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def continue_(cls, *, metadata: dict[str, Any] | None = None) -> "HookDecision":
        return cls(action=HOOK_CONTINUE, metadata=metadata or {})

    @classmethod
    def replace(cls, payload: dict[str, Any], *, metadata: dict[str, Any] | None = None) -> "HookDecision":
        return cls(action=HOOK_REPLACE, payload=payload, metadata=metadata or {})

    @classmethod
    def block(cls, reason: str | None = None, *, metadata: dict[str, Any] | None = None) -> "HookDecision":
        return cls(action=HOOK_BLOCK, reason=reason, metadata=metadata or {})

    @classmethod
    def retry(cls, reason: str | None = None, *, metadata: dict[str, Any] | None = None) -> "HookDecision":
        return cls(action=HOOK_RETRY, reason=reason, metadata=metadata or {})

    @classmethod
    def fallback(cls, reason: str | None = None, *, metadata: dict[str, Any] | None = None) -> "HookDecision":
        return cls(action=HOOK_FALLBACK, reason=reason, metadata=metadata or {})


@dataclass(frozen=True)
class PolicyHook:
    """Explicit hook policy for failures that must block protected operations."""

    handler: Callable[..., Any] | Any
    phases: set[str] | frozenset[str] | None = None
    failure_mode: str = "block"
    timeout: float | None = None
    name: str | None = None

    def __post_init__(self) -> None:
        if self.handler is None:
            raise ValueError("PolicyHook handler is required")
        if self.failure_mode not in {"block", "continue"}:
            raise ValueError("PolicyHook failure_mode must be 'block' or 'continue'")
        if self.timeout is not None:
            if isinstance(self.timeout, bool) or not isinstance(self.timeout, (int, float)) or self.timeout <= 0:
                raise ValueError("PolicyHook timeout must be a number greater than 0")
        if self.phases is not None:
            object.__setattr__(self, "phases", frozenset(str(phase) for phase in self.phases))


class HookManager:
    """Run hooks in list order while isolating observability hook failures."""

    def __init__(self, hooks: list[Callable[..., Any] | Any | PolicyHook] | None = None):
        self.hooks = list(hooks or [])

    def run(self, context: HookContext) -> HookDecision:
        payload = dict(context.payload or {})
        hook_events: list[dict[str, Any]] = []
        metadata: dict[str, Any] = {}

        for hook in self.hooks:
            policy = hook if isinstance(hook, PolicyHook) else None
            handler = policy.handler if policy else hook
            if policy and policy.phases is not None and context.phase not in policy.phases:
                continue
            hook_name = (policy.name if policy else None) or getattr(
                handler,
                "__name__",
                handler.__class__.__name__,
            )
            try:
                raw = self._invoke_hook(handler, context, policy.timeout if policy else None)
                decision = self._normalize(raw)
            except Exception as exc:
                failure_mode = policy.failure_mode if policy else "continue"
                error_event = {
                    "phase": context.phase,
                    "hook": hook_name,
                    "action": "error",
                    "error": str(exc),
                    "error_type": "timeout" if isinstance(exc, TimeoutError) else "exception",
                    "failure_mode": failure_mode,
                }
                hook_events.append(error_event)
                if failure_mode == "block":
                    return HookDecision.block(
                        f"Policy hook `{hook_name}` failed closed: {exc}",
                        metadata={
                            **metadata,
                            "policy_hook": hook_name,
                            "failure_mode": failure_mode,
                            "hook_events": hook_events,
                        },
                    )
                continue

            if decision.metadata:
                metadata.update(decision.metadata)

            if decision.action == HOOK_REPLACE:
                payload = dict(decision.payload or {})
                context.payload = payload
                hook_events.append({
                    "phase": context.phase,
                    "hook": hook_name,
                    "action": HOOK_REPLACE,
                })
                continue

            if decision.action == HOOK_METADATA:
                hook_events.append({
                    "phase": context.phase,
                    "hook": hook_name,
                    "action": HOOK_METADATA,
                })
                continue

            if decision.action != HOOK_CONTINUE:
                decision.payload = payload
                decision.metadata = {**metadata, **decision.metadata, "hook_events": hook_events}
                hook_events.append({
                    "phase": context.phase,
                    "hook": hook_name,
                    "action": decision.action,
                    "reason": decision.reason,
                })
                decision.metadata["hook_events"] = hook_events
                return decision

        return HookDecision(
            action=HOOK_CONTINUE,
            payload=payload,
            metadata={**metadata, "hook_events": hook_events} if hook_events else metadata,
        )

    @staticmethod
    def _call_hook(hook: Callable[..., Any] | Any, context: HookContext) -> Any:
        method = getattr(hook, context.phase, None)
        if callable(method):
            return method(context)
        if callable(hook):
            return hook(context)
        return None

    @classmethod
    def _invoke_hook(
            cls,
            hook: Callable[..., Any] | Any,
            context: HookContext,
            timeout: float | None,
    ) -> Any:
        if timeout is None:
            return cls._call_and_resolve(hook, context)

        isolated_context = HookContext(
            phase=context.phase,
            payload=dict(context.payload),
            trace_id=context.trace_id,
            parent_trace_id=context.parent_trace_id,
            run_id=context.run_id,
            run_group_id=context.run_group_id,
            user_id=context.user_id,
            agent_name=context.agent_name,
            flow_id=context.flow_id,
            step_name=context.step_name,
            metadata=dict(context.metadata),
        )
        executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
        future = executor.submit(cls._call_and_resolve, hook, isolated_context)
        try:
            return future.result(timeout=timeout)
        except concurrent.futures.TimeoutError as exc:
            future.cancel()
            raise TimeoutError(f"hook timed out after {timeout:g}s") from exc
        finally:
            executor.shutdown(wait=False, cancel_futures=True)

    @classmethod
    def _call_and_resolve(cls, hook: Callable[..., Any] | Any, context: HookContext) -> Any:
        raw = cls._call_hook(hook, context)
        if inspect.isawaitable(raw):
            return cls._run_awaitable(raw)
        return raw

    @staticmethod
    def _run_awaitable(awaitable: Awaitable[Any]) -> Any:
        try:
            asyncio.get_running_loop()
        except RuntimeError:
            return asyncio.run(awaitable)

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(asyncio.run, awaitable)
            return future.result()

    @staticmethod
    def _normalize(raw: Any) -> HookDecision:
        if raw is None:
            return HookDecision.continue_()
        if isinstance(raw, HookDecision):
            return raw
        if isinstance(raw, bool):
            return HookDecision.continue_() if raw else HookDecision.block("hook returned False")
        if isinstance(raw, str):
            return HookDecision.block(raw)
        if isinstance(raw, dict):
            if raw.get("allowed") is False:
                return HookDecision.block(raw.get("reason"), metadata=raw.get("metadata"))
            action = raw.get("action")
            if action:
                return HookDecision(
                    action=str(action),
                    payload=raw.get("payload"),
                    reason=raw.get("reason"),
                    metadata=raw.get("metadata") or {},
                )
            if "payload" in raw:
                return HookDecision.replace(raw["payload"], metadata=raw.get("metadata"))
            return HookDecision.continue_(metadata=raw.get("metadata"))
        return HookDecision.continue_()

```

### Core Architecture Module: `LightAgent/__init__.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
作者: [weego/WXAI-Team]
最后更新: 2026-02-20
"""

from .version import __version__
from .core import LightAgent, LightSwarm
from .protocol import (
    MemoryAdmissionDecision,
    MemoryCandidate,
    MemoryPolicy,
    MemoryProtocol,
    MemoryPromotionDecision,
    MemoryScope,
)
from .tools import ToolRegistry, ToolLoader, AsyncToolDispatcher
from .errors import (
    LightAgentError,
    LightAgentErrorInfo,
    ERROR_TAXONOMY,
    classify_exception,
    format_error_code,
    format_lightagent_error,
)
from .result import RunResult, StreamEvent
from .tracing import (
    JsonlTraceExporter,
    TraceEvent,
    TraceExporter,
    TraceRecorder,
    TraceSummary,
    export_trace,
    normalize_usage,
    summarize_trace,
)
from .evaluation import EvaluationCase, EvaluationCaseResult, EvaluationReport, LightEvaluator
from .hooks import HookContext, HookDecision, HookManager, PolicyHook
from .review import (
    ApprovalDecision,
    ApprovalRequest,
    HumanApprovalHook,
    HumanFeedback,
    InMemoryReviewStore,
    JsonReviewStore,
)
from .guardrails import (
    DEFAULT_PRIVACY_PATTERNS,
    GuardrailDecision,
    GuardrailManager,
    high_risk_parameter_guardrail,
    output_redaction_guardrail,
    privacy_input_guardrail,
    sensitive_tool_confirmation_guardrail,
)
from .cancellation import CancellationToken
from .flow import JsonLightFlowStore, LightFlow, LightFlowResult, LightFlowStep, LightFlowStepResult
from .shared_memory import SharedMemoryPool, SharedMemoryRecord
from .logger import LoggerManager
from .mcp_client_manager import MCPClientManager
from .skills import SkillManager, Skill
from .skill_tools import create_skill_tools
from .connectors import (
    ConnectorDiagnostic,
    ConnectorManifest,
    ConnectorValidationReport,
    ConnectorValidator,
    validate_connector,
)
from .session import (
    SESSION_SCHEMA_VERSION,
    CompactionResult,
    ContextBudget,
    ContextCompactor,
    ContextProjector,
    InMemorySessionStore,
    JsonlSessionStore,
    Session,
    SessionCheckpoint,
    SessionEvent,
    SessionMigrationRegistry,
    SessionReplay,
    SessionStore,
    SqliteSessionStore,
    session_migrations,
)
from .capabilities import (
    BaseCapabilityProvider,
    BrowserProvider,
    CapabilityProvider,
    CapabilityRegistry,
    CapabilityRisk,
    CapabilityScope,
    CapabilitySpec,
    CredentialProvider,
    FileSystemProvider,
    InteractionProvider,
    LSPProvider,
    MemoryProvider,
    MemoryProviderAdapter,
    ModelProvider,
    PermissionSet,
    PolicyDecision,
    PolicyEngine,
    PolicyRequest,
    ProviderHealth,
    RAGProvider,
    RuntimeContext,
    SandboxProvider,
    ShellProvider,
    SubagentProvider,
    TelemetryProvider,
    TerminalProvider,
    ToolProvider,
    ToolProviderAdapter,
    WebProvider,
    WorkflowProvider,
)
from .security import (
    APPROVAL_TOKEN_SCHEMA_VERSION,
    PROVIDER_MANIFEST_SCHEMA_VERSION,
    SECURITY_CONTEXT_SCHEMA_VERSION,
    ApprovalToken,
    CapabilityGate,
    ProviderManifest,
    SecurityContext,
    canonical_digest,
)
from .dag import (
    DAG_SCHEMA_VERSION,
    CallableVerifier,
    DAGConfig,
    DAGError,
    DAGRunResult,
    DAGRunStatus,
    DAGTaskStatus,
    DecompositionProposal,
    LightDAG,
    LightDAGProvider,
    LocalArtifactStore,
    SqliteTaskGraphStore,
    TaskOutcome,
    TaskSpec,
    VerificationVerdict,
)
from .runtime import (
    AgentInbox,
    AgentRuntime,
    BudgetExceeded,
    BudgetLimits,
    BudgetManager,
    BudgetUsage,
    Goal,
    GoalManager,
    GoalStatus,
    InboxMessage,
    InboxMessageStatus,
    InboxMessageType,
    JobManager,
    JobRecord,
    JobStatus,
    ProgressState,
    ProgressTracker,
    SubagentManager,
    SubagentRecord,
)
from .knowledge import (
    MCPProviderAdapter,
    RetrievalDocument,
    RetrievalProvider,
    RetrievalResult,
    SessionSearchProvider,
    SkillProviderAdapter,
    SqliteFTSRetrievalProvider,
    WorkflowProviderAdapter,
)
from .builtin_tools.safe_expression import (
    SafeExpressionError,
    evaluate_safe_expression,
    safe_expression,
)
from .builtin_tools.python_executor import (
    execute_python_code,
    execute_python_file,
    execute_python_code_stream
)
from .builtin_tools.nos import upload_file_to_oss

__all__ = [
    "__version__",
    "LightAgent",
    "LightSwarm",
    "MemoryProtocol",
    "MemoryAdmissionDecision",
    "MemoryCandidate",
    "MemoryPromotionDecision",
    "MemoryPolicy",
    "MemoryScope",
    "ToolRegistry",
    "ToolLoader",
    "AsyncToolDispatcher",
    "LightAgentError",
    "LightAgentErrorInfo",
    "ERROR_TAXONOMY",
    "classify_exception",
    "format_error_code",
    "format_lightagent_error",
    "RunResult",
    "StreamEvent",
    "TraceEvent",
    "TraceExporter",
    "TraceRecorder",
    "TraceSummary",
    "JsonlTraceExporter",
    "summarize_trace",
    "normalize_usage",
    "export_trace",
    "EvaluationCase",
    "EvaluationCaseResult",
    "EvaluationReport",
    "LightEvaluator",
    "HookContext",
    "HookDecision",
    "HookManager",
    "PolicyHook",
    "ApprovalRequest",
    "ApprovalDecision",
    "HumanApprovalHook",
    "HumanFeedback",
    "InMemoryReviewStore",
    "JsonReviewStore",
    "DEFAULT_PRIVACY_PATTERNS",
    "GuardrailDecision",
    "GuardrailManager",
    "high_risk_parameter_guardrail",
    "output_redaction_guardrail",
    "privacy_input_guardrail",
    "sensitive_tool_confirmation_guardrail",
    "LightFlow",
    "JsonLightFlowStore",
    "LightFlowResult",
    "LightFlowStep",
    "LightFlowStepResult",
    "CancellationToken",
    "SharedMemoryPool",
    "SharedMemoryRecord",
    "LoggerManager",
    "MCPClientManager",
    "SkillManager",
    "Skill",
    "create_skill_tools",
    "ConnectorDiagnostic",
    "ConnectorManifest",
    "ConnectorValidationReport",
    "ConnectorValidator",
    "validate_connector",
    "SESSION_SCHEMA_VERSION",
    "SessionEvent",
    "SessionCheckpoint",
    "SessionReplay",
    "Session",
    "SessionStore",
    "SessionMigrationRegistry",
    "session_migrations",
    "InMemorySessionStore",
    "JsonlSessionStore",
    "SqliteSessionStore",
    "ContextProjector",
    "ContextBudget",
    "ContextCompactor",
    "CompactionResult",
    "CapabilityScope",
    "CapabilityRisk",
    "CapabilitySpec",
    "ProviderHealth",
    "RuntimeContext",
    "CapabilityProvider",
    "BaseCapabilityProvider",
    "ModelProvider",
    "ToolProvider",
    "FileSystemProvider",
    "ShellProvider",
    "TerminalProvider",
    "BrowserProvider",
    "WebProvider",
    "LSPProvider",
    "MemoryProvider",
    "RAGProvider",
    "SubagentProvider",
    "WorkflowProvider",
    "InteractionProvider",
    "SandboxProvider",
    "CredentialProvider",
    "TelemetryProvider",
    "PermissionSet",
    "PolicyRequest",
    "PolicyDecision",
    "PolicyEngine",
    "CapabilityRegistry",
    "ToolProviderAdapter",
    "MemoryProviderAdapter",
    "SECURITY_CONTEXT_SCHEMA_VERSION",
    "APPROVAL_TOKEN_SCHEMA_VERSION",
    "PROVIDER_MANIFEST_SCHEMA_VERSION",
    "SecurityContext",
    "ApprovalToken",
    "ProviderManifest",
    "CapabilityGate",
    "canonical_digest",
    "DAG_SCHEMA_VERSION",
    "DAGConfig",
    "DAGError",
    "DAGRunStatus",
    "DAGTaskStatus",
    "DAGRunResult",
    "TaskSpec",
    "TaskOutcome",
    "DecompositionProposal",
    "VerificationVerdict",
    "SqliteTaskGraphStore",
    "LocalArtifactStore",
    "CallableVerifier",
    "LightDAGProvider",
    "LightDAG",
    "InboxMessageType",
    "InboxMessageStatus",
    "InboxMessage",
    "AgentInbox",
    "GoalStatus",
    "Goal",
    "GoalManager",
    "BudgetLimits",
    "BudgetUsage",
    "BudgetExceeded",
    "BudgetManager",
    "ProgressState",
    "ProgressTracker",
    "JobStatus",
    "JobRecord",
    "JobManager",
    "SubagentRecord",
    "SubagentManager",
    "AgentRuntime",
    "RetrievalDocument",
    "RetrievalResult",
    "RetrievalProvider",
    "SqliteFTSRetrievalProvider",
    "SessionSearchProvider",
    "SkillProviderAdapter",
    "MCPProviderAdapter",
    "WorkflowProviderAdapter",
    "execute_python_code",
    "execute_python_file",
    "execute_python_code_stream",
    "upload_file_to_oss",
    "SafeExpressionError",
    "evaluate_safe_expression",
    "safe_expression",
]

```

### Core Architecture Module: `LightAgent/builtin_tools/nos.py`
```
import hashlib
import json
import os
import traceback

# 阿里云OSS配置（建议从环境变量读取，避免硬编码）
# 您可以在环境变量中设置以下值，或在创建Agent时传入
ALIYUN_OSS_CONFIG = {
    "access_key_id": "**********",
    "access_key_secret": "*****************",
    "endpoint": "https://oss-cn-shanghai.aliyuncs.com",
    "bucket_name": "wxuserfile"
}


def _get_oss_client(access_key_id: str = None, access_key_secret: str = None, endpoint: str = None):
    """
    获取OSS客户端实例

    Args:
        access_key_id: 阿里云AccessKey ID
        access_key_secret: 阿里云AccessKey Secret
        endpoint: OSS endpoint

    Returns:
        boto3 S3客户端实例
    """
    # 使用传入的参数或环境变量中的默认值
    ak = access_key_id or ALIYUN_OSS_CONFIG["access_key_id"]
    sk = access_key_secret or ALIYUN_OSS_CONFIG["access_key_secret"]
    ep = endpoint or ALIYUN_OSS_CONFIG["endpoint"]

    if not ak or not sk:
        raise ValueError(
            "未设置阿里云AccessKey，请通过参数传入或设置环境变量ALIYUN_OSS_ACCESS_KEY_ID和ALIYUN_OSS_ACCESS_KEY_SECRET")

    import boto3
    from botocore.client import Config

    # 创建OSS客户端（兼容S3协议）
    client = boto3.client(
        's3',
        aws_access_key_id=ak,
        aws_secret_access_key=sk,
        endpoint_url=ep,
        config=Config(signature_version='s3v4')  # 使用v4签名
    )

    return client


def _calculate_md5(file_path: str) -> str:
    """
    计算文件的MD5值

    Args:
        file_path: 文件路径

    Returns:
        文件的MD5哈希值
    """
    hash_md5 = hashlib.md5()
    with open(file_path, "rb") as f:
        for chunk in iter(lambda: f.read(4096), b""):
            hash_md5.update(chunk)
    return hash_md5.hexdigest()


def upload_file_to_oss(
        file_path: str,
        bucket_name: str = None,
        access_key_id: str = None,
        access_key_secret: str = None,
        endpoint: str = None,
        preserve_original_name: bool = False,
        prefix: str = "",
        public_read: bool = False
) -> str:
    """
    上传文件到阿里云OSS

    Args:
        file_path: 要上传的本地文件路径
        bucket_name: OSS存储桶名称
        access_key_id: 阿里云AccessKey ID
        access_key_secret: 阿里云AccessKey Secret
        endpoint: OSS endpoint
        preserve_original_name: 是否保留原文件名（如果False，则使用MD5重命名）
        prefix: 文件在OSS中的前缀路径
        public_read: 是否设置文件为公共读

    Returns:
        上传成功后的文件URL或错误信息
    """
    try:
        # 检查文件是否存在
        if not os.path.exists(file_path):
            return f"错误：文件 '{file_path}' 不存在"

        if not os.path.isfile(file_path):
            return f"错误：'{file_path}' 不是文件"

        # 获取文件名和后缀
        original_filename = os.path.basename(file_path)
        file_name, file_ext = os.path.splitext(original_filename)

        # 计算MD5值作为新文件名
        if preserve_original_name:
            oss_filename = original_filename
        else:
            file_md5 = _calculate_md5(file_path)
            oss_filename = f"{file_md5}{file_ext}"

        # 构建OSS中的完整路径
        if prefix and not prefix.endswith('/'):
            prefix += '/'
        oss_key = f"{prefix}{oss_filename}" if prefix else oss_filename

        # 获取OSS客户端
        bucket = bucket_name or ALIYUN_OSS_CONFIG["bucket_name"]
        client = _get_oss_client(access_key_id, access_key_secret, endpoint)

        # 设置上传参数
        extra_args = {}
        if public_read:
            extra_args['ACL'] = 'public-read'

        # 上传文件
        print(f"正在上传文件到OSS: {oss_key}")
        client.upload_file(
            Filename=file_path,
            Bucket=bucket,
            Key=oss_key,
            ExtraArgs=extra_args if extra_args else None
        )

        # 生成文件URL
        endpoint_clean = endpoint or ALIYUN_OSS_CONFIG["endpoint"]
        if endpoint_clean.startswith('http://') or endpoint_clean.startswith('https://'):
            base_url = endpoint_clean.rstrip('/')
        else:
            base_url = f"https://{endpoint_clean}"

        file_url = f"{base_url}/{bucket}/{oss_key}"

        result = {
            "success": True,
            "file_url": file_url,
            "bucket": bucket,
            "key": oss_key,
            "original_filename": original_filename,
            "oss_filename": oss_filename,
            "file_size": os.path.getsize(file_path),
            "md5": _calculate_md5(file_path) if not preserve_original_name else None
        }

        return json.dumps(result, ensure_ascii=False, indent=2)

    except ImportError as e:
        return (
            "错误：缺少可选依赖库，请安装：pip install boto3 "
            "或 pip install 'LightAgent[oss]'\n"
            f"详细信息：{str(e)}"
        )
    except Exception as e:
        return f"上传文件到OSS失败：{str(e)}\n{traceback.format_exc()}"


# 添加工具信息
upload_file_to_oss.tool_info = {
    "tool_name": "upload_file_to_oss",
    "tool_title": "上传文件到阿里云OSS",
    "tool_description": "将本地文件上传到阿里云OSS，自动使用MD5重命名文件，支持设置公共读权限",
    "tool_params": [
        {
            "name": "file_path",
            "description": "要上传的本地文件路径",
            "type": "string",
            "required": True
        }
    ]
}

```

### Core Architecture Module: `LightAgent/builtin_tools/python_executor.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""
作者: [weego/WXAI-Team]
最后更新: 2026-02-22

内置工具：安全执行Python代码
"""

import os
import sys
import json
import tempfile
import subprocess
import traceback
import re
import ast
import inspect
from typing import Dict, Any, List, Optional, Union, Tuple


_DANGEROUS_MODULES = frozenset({
    "__builtins__",
    "ctypes",
    "glob",
    "importlib",
    "os",
    "pickle",
    "pty",
    "shelve",
    "shutil",
    "socket",
    "subprocess",
    "sys",
})
_DANGEROUS_BUILTINS = frozenset({"__import__", "compile", "eval", "exec", "input", "open", "raw_input"})
_DANGEROUS_ATTRIBUTES = frozenset({"compile", "eval", "exec", "popen", "system"})
_PROCESS_ATTRIBUTES = frozenset({"Popen", "call", "check_call", "check_output", "run"})
_DANGEROUS_DYNAMIC_ATTRIBUTES = _DANGEROUS_BUILTINS | _DANGEROUS_ATTRIBUTES | _PROCESS_ATTRIBUTES
UNSAFE_PYTHON_TOOL_NAMES = frozenset({
    "execute_python_code",
    "execute_python_file",
    "execute_python_code_stream",
})
UNSAFE_PYTHON_TOOL_REASON = (
    "Legacy Python execution tools have no isolated execution route and are "
    "blocked in tool dispatch. Registering a SandboxProvider does not isolate "
    "them. Use safe_expression or a custom tool backed by a real sandbox."
)


def is_unsafe_python_tool(tool_name: str, tool_call: Any = None) -> bool:
    if tool_name in UNSAFE_PYTHON_TOOL_NAMES:
        return True
    if tool_call is None:
        return False
    return inspect.unwrap(tool_call) in (
        execute_python_code, execute_python_file, execute_python_code_stream,
    )


# Both JSON cleanup and nested dictionary extraction use a bounded depth.
_MAX_CLEAN_DEPTH = 5


class _CodeNestingError(ValueError):
    pass


def _parse_code_parameter(code_param: Union[str, Dict, Any], _depth: int = 0) -> str:
    """
    解析可能包含在各种格式中的代码参数

    Args:
        code_param: 可能以各种形式传入的代码参数

    Returns:
        提取出的代码字符串
    """
    # 如果已经是字符串，直接返回
    if isinstance(code_param, str):
        return code_param

    # 如果是字典，尝试提取常见的键
    if isinstance(code_param, dict):
        if _depth >= _MAX_CLEAN_DEPTH:
            raise _CodeNestingError("Code parameter nesting exceeds the cleanup limit")
        # 尝试各种可能的键名
        possible_keys = ['code', 'script', 'python_code', 'source', 'content', 'program']
        for key in possible_keys:
            if key in code_param:
                value = code_param[key]
                if isinstance(value, str):
                    return value
                elif isinstance(value, dict):
                    # 递归处理嵌套字典
                    return _parse_code_parameter(value, _depth + 1)

        # 如果字典只有一个值，可能是直接传入的
        if len(code_param) == 1:
            value = next(iter(code_param.values()))
            if isinstance(value, str):
                return value

        # 尝试将整个字典转换为字符串
        try:
            return json.dumps(code_param, ensure_ascii=False)
        except (RecursionError, ValueError) as exc:
            raise _CodeNestingError("Code parameter is too deeply nested or cyclic") from exc

    # 如果是列表，尝试连接或提取
    if isinstance(code_param, list):
        # 如果列表中的元素都是字符串，连接它们
        if all(isinstance(item, str) for item in code_param):
            return '\n'.join(code_param)
        # 否则转换为字符串
        return str(code_param)

    # 其他类型直接转字符串
    return str(code_param)


def _try_json_loads(candidate: str) -> Tuple[bool, Any]:
    """在解析边界上隔离 json.loads。

    只捕获解析本身可能产生的异常（JSONDecodeError、TypeError，以及深度
    嵌套输入触发的 RecursionError）。KeyboardInterrupt/SystemExit 与后续
    清理逻辑的异常不在此捕获，正常向上传播。

    Returns:
        (True, 解析结果) 或 (False, None)
    """
    try:
        return True, json.loads(candidate)
    except (json.JSONDecodeError, TypeError, RecursionError):
        return False, None


def _clean_code_string(code_str: str, _depth: int = 0) -> str:
    """
    清理和修复代码字符串中的转义和格式问题

    Args:
        code_str: 原始代码字符串
        _depth: 当前递归深度（内部参数，超过 _MAX_CLEAN_DEPTH 即停止）

    Returns:
        清理后的代码字符串
    """
    if _depth >= _MAX_CLEAN_DEPTH:
        return code_str if isinstance(code_str, str) else str(code_str)

    if not isinstance(code_str, str):
        code_str = str(code_str)

    # 步骤1: 修复常见的JSON转义问题
    # 将 \\n 替换为 \n，但要小心不要破坏已有的双反斜杠
    code_str = code_str.replace('\\n', '\n')
    code_str = code_str.replace('\\t', '\t')
    code_str = code_str.replace('\\r', '\r')

    # 步骤2: 修复引号转义
    # 将 \" 替换为 "，但要小心不要破坏字符串内部的转义引号
    code_str = code_str.replace('\\"', '"')
    code_str = code_str.replace("\\'", "'")

    # 步骤3: 修复双重转义
    code_str = code_str.replace('\\\\', '\\')

    # 步骤4: 修复Python f-string中的双花括号
    # f-string中的 {{ 和 }} 需要被保留
    # 这里只修复那些可能是JSON转义导致的多余花括号
    pattern = r'\{(\{[^}]*\})\}'
    code_str = re.sub(pattern, r'\1', code_str)

    # 步骤5: 移除可能存在的JSON包装
    # 有时代码可能被包装在JSON字符串中
    if code_str.startswith('"') and code_str.endswith('"'):
        ok, unwrapped = _try_json_loads(code_str)
        if ok:
            code_str = unwrapped
        else:
            code_str = code_str[1:-1]

    # 步骤6: 尝试解析为JSON并提取代码字段
    # 解析在 _try_json_loads 边界内完成；下面的清理逻辑不在任何 except
    # 之中，其异常（包括 KeyboardInterrupt/SystemExit）正常传播。
    ok, parsed = _try_json_loads(code_str)
    if ok:
        if isinstance(parsed, dict):
            # 查找常见的代码字段
            try:
                code = _parse_code_parameter(parsed, _depth=_depth)
            except _CodeNestingError:
                return code_str
            if code != code_str:
                return _clean_code_string(code, _depth + 1)  # 递归清理
        elif isinstance(parsed, str):
            return _clean_code_string(parsed, _depth + 1)  # 递归清理

    return code_str


def _extract_code_from_text(text: str) -> str:
    """
    从文本中提取代码块

    Args:
        text: 可能包含代码块的文本

    Returns:
        提取出的代码字符串
    """
    # 查找Python代码块（```python ... ```）
    python_block_pattern = r'```python\s*\n(.*?)\n```'
    matches = re.findall(python_block_pattern, text, re.DOTALL)
    if matches:
        return '\n'.join(matches)

    # 查找通用代码块（``` ... ```）
    code_block_pattern = r'```\s*\n(.*?)\n```'
    matches = re.findall(code_block_pattern, text, re.DOTALL)
    if matches:
        return '\n'.join(matches)

    # 查找内联代码（`...`）
    inline_pattern = r'`([^`]+)`'
    matches = re.findall(inline_pattern, text)
    if matches:
        return '\n'.join(matches)

    return text


def _literal_string(node: ast.AST, constants: Dict[str, str]) -> Optional[str]:
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    if isinstance(node, ast.Name):
        return constants.get(node.id)
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left = _literal_string(node.left, constants)
        right = _literal_string(node.right, constants)
        if left is not None and right is not None:
            return left + right
    if isinstance(node, ast.JoinedStr):
        parts = []
        for value in node.values:
            if not isinstance(value, ast.Constant) or not isinstance(value.value, str):
                return None
            parts.append(value.value)
        return "".join(parts)
    return None


def _resolved_name(node: ast.AST, aliases: Dict[str, str], constants: Dict[str, str]) -> Optional[str]:
    if isinstance(node, ast.Name):
        return aliases.get(node.id, node.id)
    if isinstance(node, ast.Attribute):
        parent = _resolved_name(node.value, aliases, constants)
        return f"{parent}.{node.attr}" if parent else node.attr
    if isinstance(node, ast.Subscript):
        parent = _resolved_name(node.value, aliases, constants)
        key = _literal_string(node.slice, constants)
        if parent and key:
            return f"{parent}.{key}"
    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
        dispatch_name = aliases.get(node.func.id, node.func.id).split(".")[-1]
        if dispatch_name not in {"getattr", "attrgetter"}:
            return None
        attribute_index = 1 if dispatch_name == "getattr" else 0
        if len(node.args) > attribute_index:
            attribute = _literal_string(node.args[attribute_index], constants)
            if attribute:
                parent = _resolved_name(node.args[0], aliases, constants) if dispatch_name == "getattr" else "dynamic"
                return f"{parent or 'dynamic'}.{attribute}"
    return None


def _dynamic_dispatch(
        node: ast.AST,
        aliases: Dict[str, str],
        constants: Dict[str, str],
) -> Optional[tuple[str, str]]:
    if not isinstance(node, ast.Call):
        return None
    if isinstance(node.func, ast.Name):
        dispatch_name = aliases.get(node.func.id, node.func.id).split(".")[-1]
        if dispatch_name not in {"getattr", "attrgetter"}:
            return _dynamic_dispatch(node.func, aliases, constants)
        attribute_index = 1 if dispatch_name == "getattr" else 0
        if len(node.args) > attribute_index:
            attribute = _literal_string(node.args[attribute_index], constants)
            if attribute:
                return dispatch_name, attribute
    return _dynamic_dispatch(node.func, aliases, constants)


def _collect_static_bindings(tree: ast.AST) -> tuple[Dict[str, str], Dict[str, str]]:
    aliases: Dict[str, str] = {}
    constants: Dict[str, str] = {}

    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                aliases[alias.asname or alias.name.split(".", 1)[0]] = alias.name
        elif isinstance(node, ast.ImportFrom) and node.module:
            for alias in node.names:
                aliases[alias.asname or alias.name] = f"{node.module}.{alias.name}"
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            value = node.value
            literal = _literal_string(value, constants) if value is not None else None
            for target in targets:
      
```

### Core Architecture Module: `LightAgent/builtin_tools/safe_expression.py`
```
"""Evaluate a small, data-only expression language without Python execution."""

from __future__ import annotations

import ast
import operator
from typing import Any


class SafeExpressionError(ValueError):
    """Raised when an expression is outside the supported safe subset."""


_MAX_NODES = 128
_MAX_COLLECTION_ITEMS = 64
_MAX_STRING_LENGTH = 4096
_MAX_INTEGER_BITS = 4096

_BINARY_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
}
_UNARY_OPERATORS = {
    ast.UAdd: operator.pos,
    ast.USub: operator.neg,
    ast.Not: operator.not_,
    ast.Invert: operator.invert,
}
_COMPARISON_OPERATORS = {
    ast.Eq: operator.eq,
    ast.NotEq: operator.ne,
    ast.Lt: operator.lt,
    ast.LtE: operator.le,
    ast.Gt: operator.gt,
    ast.GtE: operator.ge,
    ast.In: operator.contains,
    ast.NotIn: lambda left, right: not operator.contains(left, right),
    ast.Is: operator.is_,
    ast.IsNot: operator.is_not,
}


def _validate_value(value: Any) -> Any:
    if isinstance(value, str) and len(value) > _MAX_STRING_LENGTH:
        raise SafeExpressionError("string literal exceeds the safe expression limit")
    if isinstance(value, int) and value.bit_length() > _MAX_INTEGER_BITS:
        raise SafeExpressionError("integer exceeds the safe expression limit")
    if isinstance(value, (list, tuple, set, dict)) and len(value) > _MAX_COLLECTION_ITEMS:
        raise SafeExpressionError("collection exceeds the safe expression limit")
    return value


def _evaluate(node: ast.AST) -> Any:
    if isinstance(node, ast.Constant):
        if not isinstance(node.value, (str, int, float, bool, type(None))):
            raise SafeExpressionError("literal type is not allowed")
        return _validate_value(node.value)

    if isinstance(node, (ast.List, ast.Tuple, ast.Set)):
        if len(node.elts) > _MAX_COLLECTION_ITEMS:
            raise SafeExpressionError("collection exceeds the safe expression limit")
        values = [_evaluate(item) for item in node.elts]
        constructor = {ast.List: list, ast.Tuple: tuple, ast.Set: set}[type(node)]
        result = constructor(values)
        return _validate_value(result)

    if isinstance(node, ast.Dict):
        if len(node.keys) > _MAX_COLLECTION_ITEMS:
            raise SafeExpressionError("dictionary exceeds the safe expression limit")
        if any(key is None for key in node.keys):
            raise SafeExpressionError("dictionary unpacking is not allowed")
        try:
            result = {_evaluate(key): _evaluate(value) for key, value in zip(node.keys, node.values)}
        except TypeError as error:
            raise SafeExpressionError("dictionary keys must be hashable") from error
        return _validate_value(result)

    if isinstance(node, ast.UnaryOp):
        function = next((fn for kind, fn in _UNARY_OPERATORS.items() if isinstance(node.op, kind)), None)
        if function is None:
            raise SafeExpressionError("unary operator is not allowed")
        return _validate_value(function(_evaluate(node.operand)))

    if isinstance(node, ast.BinOp):
        function = next((fn for kind, fn in _BINARY_OPERATORS.items() if isinstance(node.op, kind)), None)
        if function is None:
            raise SafeExpressionError("binary operator is not allowed")
        left = _evaluate(node.left)
        right = _evaluate(node.right)
        try:
            return _validate_value(function(left, right))
        except (ArithmeticError, TypeError) as error:
            raise SafeExpressionError(f"expression evaluation failed: {type(error).__name__}") from error

    if isinstance(node, ast.BoolOp):
        if not node.values:
            raise SafeExpressionError("boolean expression is empty")
        if isinstance(node.op, ast.And):
            result = True
            for value in node.values:
                result = _evaluate(value)
                if not result:
                    break
            return result
        if isinstance(node.op, ast.Or):
            result = False
            for value in node.values:
                result = _evaluate(value)
                if result:
                    break
            return result
        raise SafeExpressionError("boolean operator is not allowed")

    if isinstance(node, ast.Compare):
        left = _evaluate(node.left)
        for operation, comparator in zip(node.ops, node.comparators):
            function = next((fn for kind, fn in _COMPARISON_OPERATORS.items() if isinstance(operation, kind)), None)
            if function is None:
                raise SafeExpressionError("comparison operator is not allowed")
            right = _evaluate(comparator)
            try:
                if not function(left, right):
                    return False
            except (TypeError, ValueError) as error:
                raise SafeExpressionError(f"comparison failed: {type(error).__name__}") from error
            left = right
        return True

    raise SafeExpressionError(f"expression node `{type(node).__name__}` is not allowed")


def evaluate_safe_expression(expression: str) -> Any:
    """Evaluate a bounded expression containing no names, calls, or access."""
    if not isinstance(expression, str) or not expression.strip():
        raise SafeExpressionError("expression must be a non-empty string")
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as error:
        raise SafeExpressionError("expression is not valid syntax") from error
    if sum(1 for _ in ast.walk(tree)) > _MAX_NODES:
        raise SafeExpressionError("expression contains too many nodes")
    return _evaluate(tree.body)


def safe_expression(expression: str) -> str:
    """Tool wrapper for bounded arithmetic and data-only expressions."""
    try:
        value = evaluate_safe_expression(expression)
    except SafeExpressionError as error:
        return f"安全表达式错误：{error}"
    return repr(value)


safe_expression.tool_info = {
    "tool_name": "safe_expression",
    "tool_title": "安全表达式计算",
    "tool_description": "计算不访问文件、网络、进程或 Python 运行时的受限数据表达式",
    "tool_params": [
        {
            "name": "expression",
            "description": "受限表达式，例如 45 * 9827 或 [1, 2, 3]",
            "type": "string",
            "required": True,
        },
    ],
}


__all__ = ["SafeExpressionError", "evaluate_safe_expression", "safe_expression"]

```

### Core Architecture Module: `LightAgent/cancellation.py`
```
"""Cooperative cancellation primitives shared by runtime executions."""

from __future__ import annotations

import inspect
from threading import Event, Lock
from typing import Any, Callable
from uuid import uuid4


class CancellationToken:
    """Thread-safe cooperative cancellation token with parent propagation."""

    def __init__(
            self,
            *,
            token_id: str | None = None,
            parent: "CancellationToken | None" = None,
            run_id: str | None = None,
    ):
        self.token_id = token_id or uuid4().hex
        self.parent = parent
        self.run_id = run_id
        self._event = Event()
        self._reason: str | None = None
        self._lock = Lock()

    @property
    def cancelled(self) -> bool:
        return self._event.is_set() or bool(self.parent and self.parent.cancelled)

    @property
    def reason(self) -> str | None:
        if self._event.is_set():
            return self._reason
        if self.parent and self.parent.cancelled:
            return self.parent.reason
        return None

    def cancel(self, reason: str | None = None) -> bool:
        """Cancel once and return whether this call changed the token."""
        with self._lock:
            if self._event.is_set():
                return False
            self._reason = reason or "cancelled"
            self._event.set()
            return True

    def child(self, *, run_id: str | None = None) -> "CancellationToken":
        return CancellationToken(parent=self, run_id=run_id or self.run_id)

    def wait(self, timeout: float | None = None) -> bool:
        if self.cancelled:
            return True
        if self.parent is None:
            return self._event.wait(timeout)
        # Parent-aware waiting is cooperative; callers that need prompt wakeup
        # should poll at their natural safe boundaries.
        return self._event.wait(timeout) or self.parent.cancelled


def accepts_keyword(function: Callable[..., Any], keyword: str) -> bool:
    """Return whether a callable explicitly or generically accepts a keyword."""
    try:
        parameters = inspect.signature(function).parameters
    except (TypeError, ValueError):
        return False
    return keyword in parameters or any(
        parameter.kind == inspect.Parameter.VAR_KEYWORD
        for parameter in parameters.values()
    )


__all__ = ["CancellationToken", "accepts_keyword"]

```

### Core Architecture Module: `LightAgent/capabilities.py`
```
"""Capability Provider registry, lifecycle, permissions, and policy decisions."""

from __future__ import annotations

import asyncio
import inspect
import threading
import hashlib
import json
from copy import deepcopy
from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any, Awaitable, Callable, Iterable, Protocol


class CapabilityScope(str, Enum):
    DEFAULT = "default"
    RUNTIME = "runtime"
    SESSION = "session"
    AGENT = "agent"


class CapabilityRisk(str, Enum):
    READ_ONLY = "L0"
    ISOLATED_WRITE = "L1"
    SENSITIVE = "L2"
    DESTRUCTIVE = "L3"


@dataclass(frozen=True)
class CapabilitySpec:
    name: str
    description: str = ""
    risk: CapabilityRisk = CapabilityRisk.READ_ONLY
    read: bool = False
    write: bool = False
    network: bool = False
    execute: bool = False
    persistent: bool = False
    cancellable: bool = False
    resumable: bool = False
    timeout: float | None = None
    output_limit: int | None = None
    requires_sandbox: bool = False
    requires_approval: bool = False
    ui_type: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if not self.name:
            raise ValueError("CapabilitySpec.name must not be empty")
        if self.timeout is not None and self.timeout <= 0:
            raise ValueError("CapabilitySpec.timeout must be positive")
        if self.output_limit is not None and self.output_limit < 1:
            raise ValueError("CapabilitySpec.output_limit must be at least 1")

    def to_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["risk"] = self.risk.value
        return value


@dataclass
class ProviderHealth:
    healthy: bool = True
    status: str = "ready"
    message: str | None = None
    degraded_capabilities: list[str] = field(default_factory=list)
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)


@dataclass
class RuntimeContext:
    runtime_id: str | None = None
    session_id: str | None = None
    agent_id: str | None = None
    user_id: str | None = None
    tenant_id: str | None = None
    project_id: str | None = None
    turn_id: str | None = None
    run_id: str | None = None
    task_id: str | None = None
    attempt_id: str | None = None
    permissions: "PermissionSet | None" = None
    security_context: Any = None
    metadata: dict[str, Any] = field(default_factory=dict)


class CapabilityProvider(Protocol):
    name: str
    version: str
    capabilities: dict[str, CapabilitySpec]

    async def mount(self, context: RuntimeContext) -> None:
        ...

    async def start(self) -> None:
        ...

    async def health(self) -> ProviderHealth:
        ...

    async def reload(self, config: dict[str, Any]) -> None:
        ...

    async def stop(self) -> None:
        ...

    async def unmount(self) -> None:
        ...


class ModelProvider(CapabilityProvider, Protocol):
    pass


class ToolProvider(CapabilityProvider, Protocol):
    pass


class FileSystemProvider(CapabilityProvider, Protocol):
    pass


class ShellProvider(CapabilityProvider, Protocol):
    pass


class TerminalProvider(CapabilityProvider, Protocol):
    pass


class BrowserProvider(CapabilityProvider, Protocol):
    pass


class WebProvider(CapabilityProvider, Protocol):
    pass


class LSPProvider(CapabilityProvider, Protocol):
    pass


class MemoryProvider(CapabilityProvider, Protocol):
    pass


class RAGProvider(CapabilityProvider, Protocol):
    pass


class SubagentProvider(CapabilityProvider, Protocol):
    pass


class WorkflowProvider(CapabilityProvider, Protocol):
    pass


class InteractionProvider(CapabilityProvider, Protocol):
    pass


class SandboxProvider(CapabilityProvider, Protocol):
    pass


class CredentialProvider(CapabilityProvider, Protocol):
    pass


class TelemetryProvider(CapabilityProvider, Protocol):
    pass


class BaseCapabilityProvider:
    """Small lifecycle implementation for Python-native Providers."""

    name = "provider"
    version = "1"

    def __init__(self, capabilities: Iterable[CapabilitySpec] | None = None):
        self.capabilities = {spec.name: spec for spec in capabilities or []}
        self.context: RuntimeContext | None = None
        self.config: dict[str, Any] = {}
        self.mounted = False
        self.started = False

    async def mount(self, context: RuntimeContext) -> None:
        self.context = context
        self.mounted = True

    async def start(self) -> None:
        if not self.mounted:
            raise RuntimeError(f"provider `{self.name}` must be mounted before start")
        self.started = True

    async def health(self) -> ProviderHealth:
        return ProviderHealth(healthy=self.started, status="ready" if self.started else "stopped")

    async def reload(self, config: dict[str, Any]) -> None:
        self.config = deepcopy(config)

    async def stop(self) -> None:
        self.started = False

    async def unmount(self) -> None:
        if self.started:
            await self.stop()
        self.context = None
        self.mounted = False


@dataclass(frozen=True)
class PermissionSet:
    """A capability allowlist that can only be narrowed by descendants."""

    allowed: frozenset[str] = field(default_factory=frozenset)
    denied: frozenset[str] = field(default_factory=frozenset)
    max_risk: CapabilityRisk = CapabilityRisk.DESTRUCTIVE

    def allows(self, capability: str, risk: CapabilityRisk = CapabilityRisk.READ_ONLY) -> bool:
        if capability in self.denied:
            return False
        if self.allowed and capability not in self.allowed:
            return False
        order = {
            CapabilityRisk.READ_ONLY: 0,
            CapabilityRisk.ISOLATED_WRITE: 1,
            CapabilityRisk.SENSITIVE: 2,
            CapabilityRisk.DESTRUCTIVE: 3,
        }
        return order[risk] <= order[self.max_risk]

    def narrow(
            self,
            *,
            allowed: Iterable[str] | None = None,
            denied: Iterable[str] | None = None,
            max_risk: CapabilityRisk | None = None,
    ) -> "PermissionSet":
        requested = frozenset(allowed) if allowed is not None else self.allowed
        if self.allowed and not requested.issubset(self.allowed):
            extra = sorted(requested - self.allowed)
            raise ValueError(f"child permissions cannot add capabilities: {extra}")
        risk = max_risk or self.max_risk
        order = {
            CapabilityRisk.READ_ONLY: 0,
            CapabilityRisk.ISOLATED_WRITE: 1,
            CapabilityRisk.SENSITIVE: 2,
            CapabilityRisk.DESTRUCTIVE: 3,
        }
        if order[risk] > order[self.max_risk]:
            raise ValueError("child permissions cannot increase max_risk")
        return PermissionSet(
            allowed=requested,
            denied=self.denied | frozenset(denied or []),
            max_risk=risk,
        )


@dataclass
class PolicyRequest:
    capability: CapabilitySpec
    provider_name: str
    arguments: dict[str, Any] = field(default_factory=dict)
    context: RuntimeContext = field(default_factory=RuntimeContext)


@dataclass
class PolicyDecision:
    allowed: bool
    reason: str | None = None
    requires_approval: bool = False
    arguments: dict[str, Any] | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    @classmethod
    def allow(cls, arguments: dict[str, Any] | None = None, **metadata: Any) -> "PolicyDecision":
        return cls(allowed=True, arguments=arguments, metadata=metadata)

    @classmethod
    def block(cls, reason: str, **metadata: Any) -> "PolicyDecision":
        return cls(allowed=False, reason=reason, metadata=metadata)

    @classmethod
    def approval(cls, reason: str | None = None, **metadata: Any) -> "PolicyDecision":
        return cls(allowed=False, reason=reason, requires_approval=True, metadata=metadata)


PolicyCallable = Callable[[PolicyRequest], PolicyDecision | bool | dict[str, Any] | None | Awaitable[Any]]


class PolicyEngine:
    """Ordered fail-closed policy evaluation for capability execution."""

    def __init__(self, policies: Iterable[PolicyCallable] | None = None, *, fail_closed: bool = True):
        self.policies = list(policies or [])
        self.fail_closed = fail_closed

    def add(self, policy: PolicyCallable) -> None:
        self.policies.append(policy)

    async def evaluate(self, request: PolicyRequest) -> PolicyDecision:
        permissions = request.context.permissions
        if permissions and not permissions.allows(request.capability.name, request.capability.risk):
            return PolicyDecision.block(f"capability `{request.capability.name}` is outside the permission snapshot")
        if request.capability.requires_approval:
            return PolicyDecision.approval(f"capability `{request.capability.name}` requires approval")

        arguments = deepcopy(request.arguments)
        collected_metadata: dict[str, Any] = {}
        for policy in self.policies:
            try:
                result = policy(PolicyRequest(
                    capability=request.capability,
                    provider_name=request.provider_name,
                    arguments=deepcopy(arguments),
                    context=request.context,
                ))
                if inspect.isawaitable(result):
                    result = await result
                decision = self._coerce(result, arguments)
            except Exception as error:
                if self.fail_closed:
                    return PolicyDecision.block(
                        f"policy `{getattr(policy, '__name__', policy.__class__.__name__)}` failed: {type(error).__name__}"
                    )
                collected_metadata.setdefault("policy_errors", []).append(type(error).__name__)
                continue
            collected_metadata.update(deci
```

### Core Architecture Module: `LightAgent/connectors.py`
```
#!/usr/bin/env python
# -*- coding: utf-8 -*-

"""Dependency-free connector manifests and offline validation utilities."""

from __future__ import annotations

import ast
import inspect
import re
import textwrap
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from .skills import Skill
from .tools import ToolRegistry


_CONNECTOR_NAME_PATTERN = re.compile(r"[A-Za-z][A-Za-z0-9._-]*")
_VERSION_PATTERN = re.compile(r"\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?")
_EXTRA_NAME_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*")
_REQUIREMENT_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*(?:\[[A-Za-z0-9,._-]+\])?(?:\s*[<>=!~].+)?")
_SECRET_FIELD_PATTERN = re.compile(r"(?:api[_-]?key|token|secret|password|authorization)", re.IGNORECASE)
_PLACEHOLDER_PATTERN = re.compile(r"(?:\$\{|\{\{|<[^>]+>|your[_ -]|replace[_ -]|env:)", re.IGNORECASE)

_UNSAFE_IMPORT_HINTS = {
    "ctypes": "native process access",
    "importlib": "dynamic imports",
    "os": "host operating-system access",
    "pickle": "unsafe deserialization",
    "pty": "pseudo-terminal access",
    "shutil": "host filesystem mutation",
    "socket": "direct network access",
    "subprocess": "child-process execution",
}
_NETWORK_IMPORT_HINTS = {"aiohttp", "httpx", "requests", "urllib"}
_HOOK_PHASES = {
    "before_run",
    "after_run",
    "on_error",
    "before_model_request",
    "after_model_response",
    "before_tool_call",
    "after_tool_result",
    "before_memory_retrieve",
    "after_memory_retrieve",
    "before_memory_write",
    "after_memory_write",
    "before_memory_promote",
    "after_memory_promote",
    "on_handoff",
    "before_flow_run",
    "after_flow_run",
    "before_flow_step",
    "after_flow_step",
}


def _as_tuple(value: Any) -> tuple[Any, ...]:
    if value is None:
        return ()
    if isinstance(value, tuple):
        return value
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
        return tuple(value)
    return (value,)


@dataclass(frozen=True)
class ConnectorManifest:
    """Declarative bundle of existing LightAgent extension primitives.

    A manifest is metadata only. Constructing or validating it never starts an
    MCP server, imports an optional provider SDK, or invokes a tool or hook.
    """

    name: str
    version: str
    description: str = ""
    tools: tuple[Callable[..., Any], ...] = ()
    skills: tuple[Skill | str, ...] = ()
    mcp_servers: Mapping[str, Mapping[str, Any]] = field(default_factory=dict)
    hooks: tuple[Callable[..., Any] | Any, ...] = ()
    memory_adapters: Mapping[str, Any] = field(default_factory=dict)
    extras: Mapping[str, Sequence[str]] = field(default_factory=dict)
    docs: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "tools", _as_tuple(self.tools))
        object.__setattr__(self, "skills", _as_tuple(self.skills))
        object.__setattr__(self, "hooks", _as_tuple(self.hooks))
        object.__setattr__(self, "docs", tuple(str(item) for item in _as_tuple(self.docs)))


@dataclass(frozen=True)
class ConnectorDiagnostic:
    """One offline connector validation finding."""

    connector: str
    level: str
    field: str
    message: str
    component: str | None = None

    def to_dict(self) -> dict[str, str]:
        data = {
            "connector": self.connector,
            "level": self.level,
            "field": self.field,
            "message": self.message,
        }
        if self.component is not None:
            data["component"] = self.component
        return data


@dataclass(frozen=True)
class ConnectorValidationReport:
    """Structured result returned by :func:`validate_connector`."""

    connector: str
    diagnostics: tuple[ConnectorDiagnostic, ...] = ()

    @property
    def valid(self) -> bool:
        return not any(item.level == "error" for item in self.diagnostics)

    @property
    def errors(self) -> tuple[ConnectorDiagnostic, ...]:
        return tuple(item for item in self.diagnostics if item.level == "error")

    @property
    def warnings(self) -> tuple[ConnectorDiagnostic, ...]:
        return tuple(item for item in self.diagnostics if item.level == "warning")

    def to_dict(self) -> dict[str, Any]:
        return {
            "connector": self.connector,
            "valid": self.valid,
            "diagnostics": [item.to_dict() for item in self.diagnostics],
        }


class ConnectorValidator:
    """Validate a connector manifest without loading external services."""

    def __init__(self, *, base_path: str | Path | None = None):
        self.base_path = Path(base_path or ".").expanduser().resolve()

    def validate(self, manifest: ConnectorManifest) -> ConnectorValidationReport:
        if not isinstance(manifest, ConnectorManifest):
            diagnostic = ConnectorDiagnostic(
                connector="<unknown>",
                level="error",
                field="manifest",
                message="manifest must be a ConnectorManifest",
            )
            return ConnectorValidationReport("<unknown>", (diagnostic,))

        connector_name = str(manifest.name or "<unknown>")
        diagnostics: list[ConnectorDiagnostic] = []

        def add(level: str, field: str, message: str, component: str | None = None) -> None:
            diagnostics.append(ConnectorDiagnostic(connector_name, level, field, message, component))

        self._validate_identity(manifest, add)
        self._validate_tools(manifest, add)
        self._validate_skills(manifest, add)
        self._validate_mcp_servers(manifest, add)
        self._validate_hooks(manifest, add)
        self._validate_memory_adapters(manifest, add)
        self._validate_extras(manifest, add)
        self._validate_docs(manifest, add)
        return ConnectorValidationReport(connector_name, tuple(diagnostics))

    @staticmethod
    def _validate_identity(manifest: ConnectorManifest, add: Callable[..., None]) -> None:
        if not isinstance(manifest.name, str) or not _CONNECTOR_NAME_PATTERN.fullmatch(manifest.name):
            add("error", "name", "name must match [A-Za-z][A-Za-z0-9._-]*")
        if not isinstance(manifest.version, str) or not _VERSION_PATTERN.fullmatch(manifest.version):
            add("error", "version", "version must be a semantic version such as 1.0.0")
        if not isinstance(manifest.description, str) or not manifest.description.strip():
            add("warning", "description", "description should not be empty")

    @staticmethod
    def _validate_tools(manifest: ConnectorManifest, add: Callable[..., None]) -> None:
        names: dict[str, int] = {}
        for index, tool in enumerate(manifest.tools):
            field_name = f"tools[{index}]"
            if not callable(tool):
                add("error", field_name, "tool must be callable")
                continue
            tool_info = getattr(tool, "tool_info", None)
            component = getattr(tool, "__name__", tool.__class__.__name__)
            if tool_info is None:
                add("error", f"{field_name}.tool_info", "tool must define tool_info metadata", component)
                continue
            for item in ToolRegistry.validate_tool_info(tool_info):
                add(item["level"], f"{field_name}.{item['field']}", item["message"], component)
            tool_name = tool_info.get("tool_name") if isinstance(tool_info, dict) else None
            if isinstance(tool_name, str) and tool_name:
                names[tool_name] = names.get(tool_name, 0) + 1
            ConnectorValidator._validate_tool_source(tool, field_name, component, add)

        for tool_name, count in names.items():
            if count > 1:
                add("error", "tools", f"duplicate tool name `{tool_name}` appears {count} times", tool_name)

    @staticmethod
    def _validate_tool_source(tool: Callable[..., Any], field_name: str, component: str, add: Callable[..., None]) -> None:
        try:
            source = textwrap.dedent(inspect.getsource(tool))
            tree = ast.parse(source)
        except (OSError, TypeError, IndentationError, SyntaxError):
            return

        imports: set[str] = set()
        dynamic_import = False
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imports.update(alias.name.split(".", 1)[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imports.add(node.module.split(".", 1)[0])
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id == "__import__":
                dynamic_import = True

        for module in sorted(imports & _UNSAFE_IMPORT_HINTS.keys()):
            add(
                "warning",
                f"{field_name}.imports",
                f"tool imports `{module}`, which permits {_UNSAFE_IMPORT_HINTS[module]}; protect it with policy and isolation",
                component,
            )
        for module in sorted(imports & _NETWORK_IMPORT_HINTS):
            add(
                "warning",
                f"{field_name}.imports",
                f"tool imports network client `{module}`; keep network access opt-in and document authentication",
                component,
            )
        if dynamic_import:
            add("warning", f"{field_name}.imports", "tool uses dynamic __import__; static validation is incomplete", component)

    def _validate_skills(self, manifest: ConnectorManifest, add: Callable[..., None]) -> None:
        for index, skill in enumerate(manifest.skills):
            field_name = f"skills[{index}]"
            if isinstance(skill, Skill):
                if not skill.name.strip() or not skill.description.strip():
                    add("error", field_name, "Skill name and description must not be empty", skill.name or None)
                path = Path(skill.pat
```

### Core Architecture Module: `LightAgent/dag/__init__.py`
```
"""Experimental persistent Dynamic DAG runtime for LightAgent."""

from .artifacts import ArtifactStore, LocalArtifactStore
from .context import ContextBuilder, DAGContextBudget
from .graph import dependency_closure, topological_order
from .models import (
    DAG_SCHEMA_VERSION,
    AssuranceLevel,
    ArtifactManifest,
    DAGAttemptStatus,
    DAGConfig,
    DAGEvent,
    DAGRun,
    DAGRunResult,
    DAGRunStatus,
    DAGTask,
    DAGTaskStatus,
    DecompositionProposal,
    TaskAttempt,
    TaskContext,
    TaskDependency,
    TaskOutcome,
    TaskOutcomeKind,
    TaskSpec,
    TaskState,
    VerificationReport,
    VerificationRequest,
    VerificationVerdict,
)
from .provider import LightDAGProvider
from .scheduler import LightDAG
from .store import DAGError, SqliteTaskGraphStore, TaskGraphStore
from .verification import CallableVerifier, Verifier
from .worker import (
    CallableWorker,
    DAGWorker,
    DAGWorkerProtocolError,
    LightAgentWorkerAdapter,
    RegistryWorkerFactory,
    WorkerFactory,
    normalize_task_outcome,
)


__all__ = [
    "DAG_SCHEMA_VERSION",
    "DAGError",
    "DAGRunStatus",
    "DAGTaskStatus",
    "DAGAttemptStatus",
    "VerificationVerdict",
    "AssuranceLevel",
    "TaskOutcomeKind",
    "DAGConfig",
    "TaskSpec",
    "TaskState",
    "DAGTask",
    "DAGRun",
    "TaskDependency",
    "TaskAttempt",
    "DecompositionProposal",
    "ArtifactManifest",
    "VerificationReport",
    "DAGEvent",
    "TaskContext",
    "TaskOutcome",
    "VerificationRequest",
    "DAGRunResult",
    "TaskGraphStore",
    "SqliteTaskGraphStore",
    "ArtifactStore",
    "LocalArtifactStore",
    "Verifier",
    "CallableVerifier",
    "DAGWorker",
    "WorkerFactory",
    "CallableWorker",
    "RegistryWorkerFactory",
    "LightAgentWorkerAdapter",
    "DAGWorkerProtocolError",
    "normalize_task_outcome",
    "DAGContextBudget",
    "ContextBuilder",
    "topological_order",
    "dependency_closure",
    "LightDAGProvider",
    "LightDAG",
]

```

### Core Architecture Module: `LightAgent/dag/artifacts.py`
```
"""Content-addressed local artifact storage for verified DAG outputs."""

from __future__ import annotations

import hashlib
import os
import tempfile
from pathlib import Path
from typing import Any, Iterable, Protocol

from ..security import SecurityContext
from .models import ArtifactManifest, DAGRun, DAGTask, TaskAttempt
from .store import DAGError


class ArtifactStore(Protocol):
    def stage(
            self,
            content: bytes | str,
            *,
            run: DAGRun,
            task: DAGTask,
            attempt: TaskAttempt,
            media_type: str = "text/plain",
            dependency_manifest: dict[str, list[str]] | None = None,
    ) -> ArtifactManifest:
        ...

    def read(
            self,
            manifest: ArtifactManifest,
            context: SecurityContext,
            *,
            require_published: bool = True,
    ) -> bytes:
        ...


class LocalArtifactStore:
    """Write immutable blobs first; SQLite controls staged/published authority."""

    def __init__(self, root: str | Path, *, max_artifact_bytes: int = 10 * 1024 * 1024):
        if max_artifact_bytes <= 0:
            raise ValueError("max_artifact_bytes must be positive")
        self.root = Path(root).expanduser().resolve()
        self.root.mkdir(parents=True, exist_ok=True)
        self.max_artifact_bytes = max_artifact_bytes

    def stage(
            self,
            content: bytes | str,
            *,
            run: DAGRun,
            task: DAGTask,
            attempt: TaskAttempt,
            media_type: str = "text/plain",
            dependency_manifest: dict[str, list[str]] | None = None,
    ) -> ArtifactManifest:
        payload = content.encode("utf-8") if isinstance(content, str) else bytes(content)
        if len(payload) > self.max_artifact_bytes:
            raise DAGError("BUDGET-EXHAUSTED", "artifact exceeds max_artifact_bytes")
        digest = hashlib.sha256(payload).hexdigest()
        relative = Path(run.tenant_id) / run.project_id / digest[:2] / digest
        destination = self._resolve(relative)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists():
            if destination.is_symlink() or self._digest_file(destination) != digest:
                raise DAGError("ARTIFACT-INTEGRITY", "existing artifact bytes do not match the content hash")
        else:
            descriptor, temporary_name = tempfile.mkstemp(prefix=f".{digest}.", dir=destination.parent)
            temporary = Path(temporary_name)
            try:
                with os.fdopen(descriptor, "wb") as stream:
                    stream.write(payload)
                    stream.flush()
                    os.fsync(stream.fileno())
                os.replace(temporary, destination)
            finally:
                if temporary.exists():
                    temporary.unlink()
        return ArtifactManifest(
            run_id=run.run_id,
            task_id=task.spec.task_id,
            attempt_id=attempt.attempt_id,
            tenant_id=run.tenant_id,
            project_id=run.project_id,
            content_hash=digest,
            relative_blob_path=relative.as_posix(),
            media_type=media_type,
            byte_size=len(payload),
            contract_hash=task.spec.contract_hash,
            dependency_manifest=dependency_manifest or {},
        )

    def read(
            self,
            manifest: ArtifactManifest,
            context: SecurityContext,
            *,
            require_published: bool = True,
    ) -> bytes:
        if context.tenant_id != manifest.tenant_id or context.project_id != manifest.project_id:
            raise PermissionError("artifact is outside the tenant/project security context")
        if require_published and manifest.state != "published":
            raise PermissionError("staged artifacts are not readable as trusted results")
        path = self._resolve(Path(manifest.relative_blob_path))
        if not path.is_file() or path.is_symlink():
            raise DAGError("ARTIFACT-INTEGRITY", "artifact blob is missing or not a regular file")
        payload = path.read_bytes()
        if len(payload) != manifest.byte_size or hashlib.sha256(payload).hexdigest() != manifest.content_hash:
            raise DAGError("ARTIFACT-INTEGRITY", "artifact content failed integrity verification")
        return payload

    def check_integrity(self, manifest: ArtifactManifest) -> bool:
        try:
            path = self._resolve(Path(manifest.relative_blob_path))
            return (
                path.is_file()
                and not path.is_symlink()
                and path.stat().st_size == manifest.byte_size
                and self._digest_file(path) == manifest.content_hash
            )
        except (OSError, DAGError):
            return False

    def remove_orphans(self, manifests: Iterable[ArtifactManifest], *, dry_run: bool = True) -> list[str]:
        referenced = {manifest.relative_blob_path for manifest in manifests}
        orphans = []
        for path in self.root.rglob("*"):
            if not path.is_file() or path.is_symlink():
                continue
            relative = path.relative_to(self.root).as_posix()
            if relative in referenced:
                continue
            orphans.append(relative)
            if not dry_run:
                path.unlink()
        return sorted(orphans)

    def _resolve(self, relative: Path) -> Path:
        if relative.is_absolute() or ".." in relative.parts:
            raise DAGError("ARTIFACT-INTEGRITY", "artifact path must stay within the store root")
        path = (self.root / relative).resolve()
        try:
            path.relative_to(self.root)
        except ValueError as exc:
            raise DAGError("ARTIFACT-INTEGRITY", "artifact path escaped the store root") from exc
        return path

    @staticmethod
    def _digest_file(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
        return digest.hexdigest()


__all__ = ["ArtifactStore", "LocalArtifactStore"]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #61** (2026-06-16): **[Bug]:  `TypeError: level must be an integer` in SkillManager._log()**
  *Symptoms*: ### Summary   **组件**: `LightAgent/skills.py` — `SkillManager._log()` 方法   **版本**: 最后更新标注 `2026-02-22`  ### 复现方式  ```python from LightAgent import LightAgent  agent = LightAgent(     model="deepseek-v4-flash",     api_key="sk-xxx",     base_url="https://api.deepseek.com", ) ```  只要 `skills` 目录下存在有效的 Skill 子目录，`LightAgent.__init__` 在调用 `discover_skills()` 时即触发。  ### 根因  `_log()` 方法用 `hasattr(self.logger, 'log')` 来区分 `LoggerManager` 和标准 `logging.Logger`，但**两者都有 `.log()` 方法**，导致标准 `logging.Logger` 走进了 `LoggerManager` 的分支，字符串 `"DEBUG"` 被当参数传给 `logging.Logger.log(level)`，后者要求 `level` 为 `int`，抛出 `TypeError`。  问题代码位置：[skills.py#L214](file:///C:/Users/Administrator/Documents/trae_projects/mfg-middleware/.venv/Lib/site-packages/LightAgent/skills.py#L214)  ```python # 原代码 —— 两个类都有 .log()，此判断无效 if hasattr(self.logger, 'log') and callable(getattr(self.logger, 'log')):     self.logger.log(level, action, data)   # 当 logger 是 logging.Logger 时炸 ```  ### 修复建议  用 `isinstance` 精确判断：  ```python def _log(self, level: str, action: str, data: Any):     if not self.logger:         return      from LightAgent.logger import LoggerManager     if isinstance(self.logger, LoggerManager):         self.logger.log(level, action, data)     elif hasattr(self.logger, 'debug') and hasattr(self.logger, 'info') and hasattr(self.logger, 'error'):         log_msg = f"[SkillManager] {action}: {data}"         level_map = {             "DEBUG": logging.DEBUG,             "INFO": logging.INFO,             "ERROR": loggin

- **Issue #53** (2026-06-02): **[Bug]: Fail to clone the project on Win11**
  *Symptoms*: ### Summary  (base) D:\ai>git clone https://github.com/wanxingai/LightAgent Cloning into 'LightAgent'... remote: Enumerating objects: 720, done. remote: Counting objects: 100% (210/210), done. remote: Compressing objects: 100% (80/80), done. remote: Total 720 (delta 167), reused 138 (delta 130), pack-reused 510 (from 2) Receiving objects: 100% (720/720), 1.94 MiB | 923.00 KiB/s, done. Resolving deltas: 100% (352/352), done. error: invalid path 'skills/gupiaozhushou/examples\basic_usage.py' fatal: unable to checkout working tree warning: Clone succeeded, but checkout failed. You can inspect what was checked out with 'git status' and retry with 'git restore --source=HEAD :/'  ### Reproduction  ```python git clone https://github.com/wanxingai/LightAgent ```  ### LightAgent version  latest  ### Python version  3.11  ### Environment and provider  (base) D:\ai>git --version git version 2.51.2.windows.1  ### Logs or traceback  ```text  ```

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

### Incident Patch 1: `c7a2a1f8` (2026-09-30)
**Commit Message**: Merge pull request #112 from wanxingai/codex/fix-pr106-agent-identity

feat: add Memcode adapter with policy-safe sample identity (#106)

**File**: `README.md` (modified, +2/-0)
```diff
@@ -183,6 +183,8 @@ For lightweight shared memory experiments, see [SharedMemoryPool](docs/shared_me
 
 For optional ClawMem long-term memory adapter setup, see [ClawMem Memory Adapter](docs/clawmem_memory_adapter.md).
 
+For an optional, user-scoped Memcode v2 adapter with offline fake-client tests, see [Memcode Memory Adapter](docs/memcode_memory_adapter.md).
+
 For memory write admission, expiration-aware retrieval, and low-quality memory write blocking, see [Memory Admission And Mutation Controls](docs/memory_admission.md).
 
 For separating trace, user memory, self-reflection memory, and LightSwarm delegation state, see [Memory, Trace, And Swarm Boundaries](docs/memory_trace_swarm_boundaries.md).
```

**File**: `docs/memcode_memory_adapter.md` (added, +90/-0)
```diff
@@ -0,0 +1,90 @@
+## Memcode Memory Adapter Example
+
+LightAgent can use Memcode as an optional long-term-memory backend through its
+existing `store(data, user_id)` / `retrieve(query, user_id)` protocol. The
+example adapter is dependency-free at import time: applications inject a
+`MemcodeV2Client` from the optional `memcode-sdk` package, while tests use a
+fake client and make no network requests.
+
+### Install and configure
+
+```bash
+pip install memcode-sdk
+```
+
+Keep credentials outside source control. Create the key from the
+[Memcode API-key dashboard](https://app.memcode.in/dashboard?section=api-keys&integration=lightagent) with **LightAgent**
+selected under integration attribution:
+
+```bash
+export MEMCODE_API_URL=https://memory.memcode.in
+export MEMCODE_API_KEY=your-integration-key
+```
+
+Each LightAgent user must map to a pre-provisioned Memcode space. The adapter
+does not invent, share, or fall back to a default space:
+
+```python
+from memcode_sdk import MemcodeV2Client
+
+from LightAgent import LightAgent, MemoryPolicy
+from example.memcode_memory_adapter import MemcodeMemoryAdapter
+
+
+client = MemcodeV2Client()
+spaces = {
+    "tenant-a:alice": "space-for-alice",
+    "tenant-a:bob": "space-for-bob",
+}
+
+memory = MemcodeMemoryAdapter(
+    client,
+    space_id_for_user=spaces.__getitem__,
+    actor_id_for_user=lambda user_id: user_id,
+    agent_name="support-agent",
+)
+
+agent = LightAgent(
+    name="support-agent",
+    model="gpt-4.1",
+    api_key="your_model_api_key",
+    base_url="your_model_base_url",
+    memory=memory,
+    memory_policy=MemoryPolicy(
+        namespace="tenant-a",
+        allow_unattributed_results=False,
+        allowed_sources=("user",),
+        allowed_scopes=("user",),
+        allowed_agent_names=("support-agent",),
+    ),
+)
+```
+
+### Security and lifecycle behavior
+
+- Keep the agent name, adapter provenance name, and policy allowlist aligned.
+  The example's `build_agent(memory)` uses `memory.agent_name` for all three;
+  its space resolver receives namespaced IDs such as `demo:alice`.
+- The application owns API-key or OAuth storage. The adapter never reads a
+  credential at import time and never returns credentials to the agent.
+- `space_id_for_user` and `actor_id_for_user` are evaluated for every call.
+  Empty mappings fail before any provider request.
+- Writes preserve LightAgent provenance metadata. Server-owned integration
+  attribution fields are rejected instead of being forwarded or spoofed.
+- Reads use `context_only` scope and then require both the requested Memcode
+  space and exact `metadata.user_id`; missing or mismatched provenance is
+  dropped before `MemoryPolicy` sees it.
+- Provider, authentication, and network failures propagate to the caller. The
+  adapter does not fall back to another user, tenant, or global search.
+- Memcode ingestion is durable and asynchronous. `store()` returns the job ID
+  and initial status; applications that require ready-before-read semantics
+  should poll with `client.get_ingest_status(job_id)`.
+- Retention is configured in Memcode. LightAgent's current memory protocol has
+  no delete method, and the v2 SDK adapter deliberately does not simulate one;
+  use the authorized Memcode lifecycle API or console for deletion/forgetting.
+
+Memcode binds the `lightagent` identity when the key is issued. A generic key
+still works, but its requests are counted as generic direct API usage. The SDK
+never supplies attribution itself. Do not add
+`integration_id`, `integration_channel`, `attribution_status`, or
+`attribution_basis` to memory metadata.
```

**File**: `example/memcode_memory_adapter.py` (added, +219/-0)
```diff
@@ -0,0 +1,219 @@
+#!/usr/bin/env python
+# -*- coding: utf-8 -*-
+
+"""Optional Memcode v2 memory adapter for LightAgent.
+
+The adapter accepts an injected ``MemcodeV2Client``-compatible object so
+LightAgent does not gain a mandatory SDK dependency or perform network work at
+import time. Applications remain responsible for credentials and for mapping
+each LightAgent user to a pre-provisioned Memcode space.
+"""
+
+from __future__ import annotations
+
+import hashlib
+import json
+from collections.abc import Callable
+from typing import Any
+
+_RESERVED_ATTRIBUTION_FIELDS = {
+    "integration_id",
+    "integration_channel",
+    "attribution_status",
+    "attribution_basis",
+}
+
+
+class MemcodeMemoryAdapter:
+    """Bridge LightAgent's MemoryProtocol to a tenant-bound Memcode v2 client."""
+
+    def __init__(
+            self,
+            client: Any,
+            *,
+            space_id_for_user: Callable[[str], str],
+            actor_id_for_user: Callable[[str], str] | None = None,
+            agent_name: str = "lightagent",
+            top_k: int = 5,
+    ):
+        if not callable(space_id_for_user):
+            raise TypeError("space_id_for_user must be callable")
+        if actor_id_for_user is not None and not callable(actor_id_for_user):
+            raise TypeError("actor_id_for_user must be callable")
+        if isinstance(top_k, bool) or not isinstance(top_k, int) or not 1 <= top_k <= 100:
+            raise ValueError("top_k must be an integer between 1 and 100")
+        self.client = client
+        self.space_id_for_user = space_id_for_user
+        self.actor_id_for_user = actor_id_for_user or (lambda user_id: user_id)
+        self.agent_name = str(agent_name)
+        self.top_k = top_k
+
+    def store(
+            self,
+            data: str,
+            user_id: str,
+            metadata: dict[str, Any] | None = None,
+    ) -> dict[str, Any]:
+        """Start a durable Memcode ingest for one explicitly scoped user."""
+        memory_user_id = self._required("user_id", user_id)
+        content = self._required("data", data)
+        space_id = self._space_id(memory_user_id)
+        actor_id = self._actor_id(memory_user_id)
+        record_metadata = {
+            "user_id": memory_user_id,
+            "source": "user",
+            "scope": "user",
+            "agent_name": self.agent_name,
+        }
+        if metadata:
+            reserved = _RESERVED_ATTRIBUTION_FIELDS.intersection(metadata)
+            if reserved:
+                fields = ", ".join(sorted(reserved))
+                raise ValueError(f"Memcode attribution metadata is server-owned: {fields}")
+            record_metadata.update(metadata)
+        record_metadata["user_id"] = memory_user_id
+        record_metadata.setdefault("source", "user")
+        record_metadata.setdefault("scope", "user")
+        record_metadata.setdefault("agent_name", self.agent_name)
+
+        result = self.client.ingest(
+            space_id=space_id,
+            actor_id=actor_id,
+            content=content,
+            idempotency_key=self._idempotency_key(
+                user_id=memory_user_id,
+                space_id=space_id,
+                content=content,
+                metadata=record_metadata,
+            ),
+            metadata=record_metadata,
+            tags=self._tags(record_metadata),
+        )
+        return {
+            "stored": True,
+            "user_id": memory_user_id,
+            "space_id": space_id,
+            "job_id": self._value(result, "id", "job_id"),
+            "status": self._value(result, "status"),
+        }
+
+    def retrieve(self, query: str, user_id: str) -> dict[str, list[dict[str, Any]]]:
+        """Return only Memcode results attributed to the requested user/space."""
+        memory_user_id = self._required("user_id", user_id)
+        normalized_query = self._required("query", query)
+        space_id = self._space_id(memory_user_id)
+        actor_id = self._actor_id(memory_user_id)
+        response = self.client.search(
+            context_space_id=space_id,
+            actor_id=actor_id,
+            query=normalized_query,
+            scope="context_only",
+            mode="memories",
+            top_k=self.top_k,
+        )
+
+        results = []
+        for item in self._value(response, "results") or []:
+            content = self._value(item, "content", "memory", "text")
+            metadata = self._value(item, "metadata")
+            item_space = self._value(self._value(item, "space"), "id")
+            if (
+                content is None
+                or not isinstance(metadata, dict)
+                or str(metadata.get("user_id", "")) != memory_user_id
+                or str(item_space or "") != space_id
+            ):
+                continue
+            results.append({
+                "memory": str(content),
+                "score": self._value(item, "score"),
+                "user_id": memory_
```

**File**: `tests/test_memcode_memory_adapter_example.py` (added, +227/-0)
```diff
@@ -0,0 +1,227 @@
+import importlib.util
+from copy import deepcopy
+import sys
+from pathlib import Path
+from types import SimpleNamespace
+
+import pytest
+
+
+def load_example_module():
+    path = Path(__file__).resolve().parents[1] / "example" / "memcode_memory_adapter.py"
+    spec = importlib.util.spec_from_file_location("memcode_memory_adapter_example", path)
+    module = importlib.util.module_from_spec(spec)
+    assert spec.loader is not None
+    sys.modules[spec.name] = module
+    spec.loader.exec_module(module)
+    return module
+
+
+class FakeMemcodeClient:
+    def __init__(self):
+        self.ingest_calls = []
+        self.search_calls = []
+        self.search_results = []
+        self.error = None
+
+    def ingest(self, **payload):
+        if self.error:
+            raise self.error
+        self.ingest_calls.append(payload)
+        return SimpleNamespace(id="job-1", status="queued")
+
+    def search(self, **payload):
+        if self.error:
+            raise self.error
+        self.search_calls.append(payload)
+        return SimpleNamespace(results=self.search_results)
+
+
+def make_adapter(client):
+    module = load_example_module()
+    return module.MemcodeMemoryAdapter(
+        client,
+        space_id_for_user=lambda user_id: {
+            "tenant:alice": "space-alice",
+            "tenant:bob": "space-bob",
+        }[user_id],
+        actor_id_for_user=lambda user_id: f"actor:{user_id}",
+        agent_name="travel-agent",
+        top_k=3,
+    )
+
+
+def test_store_preserves_policy_metadata_and_explicit_scope():
+    client = FakeMemcodeClient()
+    adapter = make_adapter(client)
+
+    result = adapter.store(
+        "Alice prefers quiet beach towns",
+        "tenant:alice",
+        metadata={"source": "user", "scope": "user", "trace_id": "trace-1"},
+    )
+
+    call = client.ingest_calls[0]
+    assert result == {
+        "stored": True,
+        "user_id": "tenant:alice",
+        "space_id": "space-alice",
+        "job_id": "job-1",
+        "status": "queued",
+    }
+    assert call["space_id"] == "space-alice"
+    assert call["actor_id"] == "actor:tenant:alice"
+    assert call["metadata"]["user_id"] == "tenant:alice"
+    assert call["metadata"]["agent_name"] == "travel-agent"
+    assert call["metadata"]["trace_id"] == "trace-1"
+    assert call["idempotency_key"].startswith("lightagent:")
+
+
+def test_store_rejects_server_owned_attribution_metadata():
+    client = FakeMemcodeClient()
+    adapter = make_adapter(client)
+
+    with pytest.raises(ValueError, match="server-owned"):
+        adapter.store(
+            "remember this",
+            "tenant:alice",
+            metadata={"integration_id": "spoofed"},
+        )
+    assert client.ingest_calls == []
+
+
+def test_retrieve_filters_cross_user_cross_space_and_malformed_results():
+    client = FakeMemcodeClient()
+    client.search_results = [
+        SimpleNamespace(
+            content="Alice prefers quiet beach towns",
+            score=0.91,
+            metadata={"user_id": "tenant:alice", "source": "user", "scope": "user"},
+            space=SimpleNamespace(id="space-alice"),
+        ),
+        SimpleNamespace(
+            content="Bob's private preference",
+            score=0.99,
+            metadata={"user_id": "tenant:bob", "source": "user", "scope": "user"},
+            space=SimpleNamespace(id="space-alice"),
+        ),
+        SimpleNamespace(
+            content="Wrong space",
+            score=0.98,
+            metadata={"user_id": "tenant:alice", "source": "user", "scope": "user"},
+            space=SimpleNamespace(id="space-bob"),
+        ),
+        SimpleNamespace(content="Missing provenance", score=0.97, metadata={}, space=None),
+        {"score": 0.5, "metadata": {"user_id": "tenant:alice"}},
+    ]
+    adapter = make_adapter(client)
+
+    response = adapter.retrieve("quiet beach", "tenant:alice")
+
+    assert client.search_calls == [{
+        "context_space_id": "space-alice",
+        "actor_id": "actor:tenant:alice",
+        "query": "quiet beach",
+        "scope": "context_only",
+        "mode": "memories",
+        "top_k": 3,
+    }]
+    assert response["results"] == [{
+        "memory": "Alice prefers quiet beach towns",
+        "score": 0.91,
+        "user_id": "tenant:alice",
+        "metadata": {
+            "user_id": "tenant:alice",
+            "source": "user",
+            "scope": "user",
+        },
+    }]
+
+
+def test_empty_scope_mapping_fails_closed_before_provider_call():
+    module = load_example_module()
+    client = FakeMemcodeClient()
+    adapter = module.MemcodeMemoryAdapter(
+        client,
+        space_id_for_user=lambda _user_id: "",
+    )
+
+    with pytest.raises(ValueError, match="space_id is required"):
+        adapter.retrieve("hello", "tenant:alice")
+    assert client.search_calls == []
+
+
+def test_provider_errors_propagate_without_fallback():
+    client = FakeMemcodeClient()
+    c
```

---

### Incident Patch 2: `1c433189` (2026-09-30)
**Commit Message**: Merge remote-tracking branch 'origin/main' into codex/fix-pr106-agent-identity

**File**: `LightAgent/builtin_tools/python_executor.py` (modified, +51/-15)
```diff
@@ -60,7 +60,15 @@ def is_unsafe_python_tool(tool_name: str, tool_call: Any = None) -> bool:
     )
 
 
-def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
+# Both JSON cleanup and nested dictionary extraction use a bounded depth.
+_MAX_CLEAN_DEPTH = 5
+
+
+class _CodeNestingError(ValueError):
+    pass
+
+
+def _parse_code_parameter(code_param: Union[str, Dict, Any], _depth: int = 0) -> str:
     """
     解析可能包含在各种格式中的代码参数
 
@@ -76,6 +84,8 @@ def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
 
     # 如果是字典，尝试提取常见的键
     if isinstance(code_param, dict):
+        if _depth >= _MAX_CLEAN_DEPTH:
+            raise _CodeNestingError("Code parameter nesting exceeds the cleanup limit")
         # 尝试各种可能的键名
         possible_keys = ['code', 'script', 'python_code', 'source', 'content', 'program']
         for key in possible_keys:
@@ -85,7 +95,7 @@ def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
                     return value
                 elif isinstance(value, dict):
                     # 递归处理嵌套字典
-                    return _parse_code_parameter(value)
+                    return _parse_code_parameter(value, _depth + 1)
 
         # 如果字典只有一个值，可能是直接传入的
         if len(code_param) == 1:
@@ -94,7 +104,10 @@ def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
                 return value
 
         # 尝试将整个字典转换为字符串
-        return json.dumps(code_param, ensure_ascii=False)
+        try:
+            return json.dumps(code_param, ensure_ascii=False)
+        except (RecursionError, ValueError) as exc:
+            raise _CodeNestingError("Code parameter is too deeply nested or cyclic") from exc
 
     # 如果是列表，尝试连接或提取
     if isinstance(code_param, list):
@@ -108,16 +121,36 @@ def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
     return str(code_param)
 
 
-def _clean_code_string(code_str: str) -> str:
+def _try_json_loads(candidate: str) -> Tuple[bool, Any]:
+    """在解析边界上隔离 json.loads。
+
+    只捕获解析本身可能产生的异常（JSONDecodeError、TypeError，以及深度
+    嵌套输入触发的 RecursionError）。KeyboardInterrupt/SystemExit 与后续
+    清理逻辑的异常不在此捕获，正常向上传播。
+
+    Returns:
+        (True, 解析结果) 或 (False, None)
+    """
+    try:
+        return True, json.loads(candidate)
+    except (json.JSONDecodeError, TypeError, RecursionError):
+        return False, None
+
+
+def _clean_code_string(code_str: str, _depth: int = 0) -> str:
     """
     清理和修复代码字符串中的转义和格式问题
 
     Args:
         code_str: 原始代码字符串
+        _depth: 当前递归深度（内部参数，超过 _MAX_CLEAN_DEPTH 即停止）
 
     Returns:
         清理后的代码字符串
     """
+    if _depth >= _MAX_CLEAN_DEPTH:
+        return code_str if isinstance(code_str, str) else str(code_str)
+
     if not isinstance(code_str, str):
         code_str = str(code_str)
 
@@ -144,24 +177,27 @@ def _clean_code_string(code_str: str) -> str:
     # 步骤5: 移除可能存在的JSON包装
     # 有时代码可能被包装在JSON字符串中
     if code_str.startswith('"') and code_str.endswith('"'):
-        try:
-            code_str = json.loads(code_str)
-        except:
+        ok, unwrapped = _try_json_loads(code_str)
+        if ok:
+            code_str = unwrapped
+        else:
             code_str = code_str[1:-1]
 
     # 步骤6: 尝试解析为JSON并提取代码字段
-    try:
-        # 尝试将整个字符串解析为JSON
-        parsed = json.loads(code_str)
+    # 解析在 _try_json_loads 边界内完成；下面的清理逻辑不在任何 except
+    # 之中，其异常（包括 KeyboardInterrupt/SystemExit）正常传播。
+    ok, parsed = _try_json_loads(code_str)
+    if ok:
         if isinstance(parsed, dict):
             # 查找常见的代码字段
-            code = _parse_code_parameter(parsed)
+            try:
+                code = _parse_code_parameter(parsed, _depth=_depth)
+            except _CodeNestingError:
+                return code_str
             if code != code_str:
-                return _clean_code_string(code)  # 递归清理
+                return _clean_code_string(code, _depth + 1)  # 递归清理
         elif isinstance(parsed, str):
-            return _clean_code_string(parsed)  # 递归清理
-    except:
-        pass
+            return _clean_code_string(parsed, _depth + 1)  # 递归清理
 
     return code_str
 
```

**File**: `tests/test_python_executor_clean_code.py` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+#!/usr/bin/env python
+# -*- coding: utf-8 -*-
+
+"""Tests for _clean_code_string parsing-boundary hardening (PR #95).
+
+Covers the review checklist: malformed JSON, deeply nested JSON,
+nested code fields, the recursion depth limit, and process-control
+exception propagation.
+"""
+
+import json
+import sys
+
+import pytest
+
+from LightAgent.builtin_tools import python_executor
+from LightAgent.builtin_tools.python_executor import (
+    _MAX_CLEAN_DEPTH,
+    _clean_code_string,
+    _parse_code_parameter,
+    _try_json_loads,
+)
+
+
+class TestMalformedJson:
+
+    def test_malformed_json_returns_input_unchanged(self):
+        malformed = '{"code": "print(1)"'  # missing closing brace
+        assert _clean_code_string(malformed) == malformed
+
+    def test_quoted_but_invalid_json_strips_quotes(self):
+        # startswith/endswith '"' but not valid JSON -> quote-strip fallback
+        wrapped = '"print(\'hello\')" + "'
+        result = _clean_code_string(wrapped)
+        assert result == wrapped[1:-1]
+
+    def test_plain_code_passes_through(self):
+        code = 'x = 1\nprint(x)'
+        assert _clean_code_string(code) == code
+
+
+class TestDeeplyNestedJson:
+
+    def test_deeply_nested_json_fails_softly(self):
+        # Decoder recursion thresholds differ between Python versions.
+        depth = sys.getrecursionlimit() * 2
+        deeply_nested = '[' * depth + '1' + ']' * depth
+        # Must not raise: RecursionError is handled at the parsing boundary.
+        result = _clean_code_string(deeply_nested)
+        assert isinstance(result, str)
+
+    def test_try_json_loads_catches_recursion_error(self, monkeypatch):
+        def too_deep(*args, **kwargs):
+            raise RecursionError('decoder recursion limit')
+
+        monkeypatch.setattr(python_executor.json, 'loads', too_deep)
+        ok, value = _try_json_loads('[1]')
+        assert ok is False and value is None
+
+
+class TestNestedCodeFields:
+
+    def test_single_wrapped_code_field(self):
+        payload = json.dumps({'code': 'print(42)'})
+        assert _clean_code_string(payload) == 'print(42)'
+
+    def test_object_nested_code_field(self):
+        # Object nesting is unwrapped by _parse_code_parameter in one pass.
+        payload = json.dumps({'code': {'code': 'print(42)'}})
+        assert _clean_code_string(payload) == 'print(42)'
+
+
+class TestDepthLimit:
+
+    def test_depth_limit_terminates_endless_chain(self, monkeypatch):
+        # A parser result that always produces a fresh wrapped payload would
+        # recurse forever without the limit; with it, the call terminates
+        # after a deterministic number of unwraps.
+        calls = {'n': 0}
+
+        def endless(parsed, **kwargs):
+            calls['n'] += 1
+            return json.dumps({'code': 'level%d' % calls['n']})
+
+        monkeypatch.setattr(python_executor, '_parse_code_parameter', endless)
+        result = _clean_code_string(json.dumps({'code': 'x'}))
+        assert isinstance(result, str)
+        assert calls['n'] <= _MAX_CLEAN_DEPTH
+
+    def test_at_limit_returns_input(self):
+        assert _clean_code_string('anything', _depth=_MAX_CLEAN_DEPTH) == 'anything'
+
+    def test_dictionary_nesting_beyond_limit_is_not_unwrapped(self):
+        payload = 'print(42)'
+        for _ in range(_MAX_CLEAN_DEPTH + 1):
+            payload = {'code': payload}
+        encoded = json.dumps(payload)
+        assert _clean_code_string(encoded) == encoded
+        with pytest.raises(ValueError, match='nesting'):
+            _parse_code_parameter(payload)
+
+    def test_dictionary_nesting_at_limit_still_extracts_code(self):
+        payload = 'print(42)'
+        for _ in range(_MAX_CLEAN_DEPTH):
+            payload = {'code': payload}
+        assert _parse_code_parameter(payload) == 'print(42)'
+        assert _clean_code_string(json.dumps(payload)) == 'print(42)'
+
+    def test_dictionary_limit_respects_existing_cleanup_depth(self):
+        encoded = json.dumps({'code': {'code': 'print(42)'}})
+        assert _clean_code_string(encoded, _depth=_MAX_CLEAN_DEPTH - 1) == encoded
+
+    @pytest.mark.parametrize('key', ['code', 'unknown'])
+    def test_cyclic_dictionary_fails_deterministically(self, key):
+        payload = {}
+        payload[key] = payload
+        with pytest.raises(ValueError, match='nesting|cyclic'):
+            _parse_code_parameter(payload)
+
+
+class TestProcessControlPropagation:
+
+    def test_keyboard_interrupt_propagates(self, monkeypatch):
+        def raise_interrupt(*args, **kwargs):
+            raise KeyboardInterrupt
+
+        monkeypatch.setattr(python_executor.json, 'loads', raise_interrupt)
+        with pytest.raises(KeyboardInterrupt):
+            _clean_code_string('{"code": "x"}')
+
+    def test_system_exit_propagates(self, monkeypatch):
+        def raise_exit(*args, **kwargs):
+            raise SystemExit(3)
+
+        monkeypatch.setattr(python_executor.json, 'loads
```

---

### Incident Patch 3: `f6808593` (2026-09-30)
**Commit Message**: Merge pull request #111 from wanxingai/codex/fix-pr95-clean-depth

fix: complete bounded Python executor parsing (#95)

**File**: `LightAgent/builtin_tools/python_executor.py` (modified, +51/-15)
```diff
@@ -60,7 +60,15 @@ def is_unsafe_python_tool(tool_name: str, tool_call: Any = None) -> bool:
     )
 
 
-def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
+# Both JSON cleanup and nested dictionary extraction use a bounded depth.
+_MAX_CLEAN_DEPTH = 5
+
+
+class _CodeNestingError(ValueError):
+    pass
+
+
+def _parse_code_parameter(code_param: Union[str, Dict, Any], _depth: int = 0) -> str:
     """
     解析可能包含在各种格式中的代码参数
 
@@ -76,6 +84,8 @@ def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
 
     # 如果是字典，尝试提取常见的键
     if isinstance(code_param, dict):
+        if _depth >= _MAX_CLEAN_DEPTH:
+            raise _CodeNestingError("Code parameter nesting exceeds the cleanup limit")
         # 尝试各种可能的键名
         possible_keys = ['code', 'script', 'python_code', 'source', 'content', 'program']
         for key in possible_keys:
@@ -85,7 +95,7 @@ def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
                     return value
                 elif isinstance(value, dict):
                     # 递归处理嵌套字典
-                    return _parse_code_parameter(value)
+                    return _parse_code_parameter(value, _depth + 1)
 
         # 如果字典只有一个值，可能是直接传入的
         if len(code_param) == 1:
@@ -94,7 +104,10 @@ def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
                 return value
 
         # 尝试将整个字典转换为字符串
-        return json.dumps(code_param, ensure_ascii=False)
+        try:
+            return json.dumps(code_param, ensure_ascii=False)
+        except (RecursionError, ValueError) as exc:
+            raise _CodeNestingError("Code parameter is too deeply nested or cyclic") from exc
 
     # 如果是列表，尝试连接或提取
     if isinstance(code_param, list):
@@ -108,16 +121,36 @@ def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
     return str(code_param)
 
 
-def _clean_code_string(code_str: str) -> str:
+def _try_json_loads(candidate: str) -> Tuple[bool, Any]:
+    """在解析边界上隔离 json.loads。
+
+    只捕获解析本身可能产生的异常（JSONDecodeError、TypeError，以及深度
+    嵌套输入触发的 RecursionError）。KeyboardInterrupt/SystemExit 与后续
+    清理逻辑的异常不在此捕获，正常向上传播。
+
+    Returns:
+        (True, 解析结果) 或 (False, None)
+    """
+    try:
+        return True, json.loads(candidate)
+    except (json.JSONDecodeError, TypeError, RecursionError):
+        return False, None
+
+
+def _clean_code_string(code_str: str, _depth: int = 0) -> str:
     """
     清理和修复代码字符串中的转义和格式问题
 
     Args:
         code_str: 原始代码字符串
+        _depth: 当前递归深度（内部参数，超过 _MAX_CLEAN_DEPTH 即停止）
 
     Returns:
         清理后的代码字符串
     """
+    if _depth >= _MAX_CLEAN_DEPTH:
+        return code_str if isinstance(code_str, str) else str(code_str)
+
     if not isinstance(code_str, str):
         code_str = str(code_str)
 
@@ -144,24 +177,27 @@ def _clean_code_string(code_str: str) -> str:
     # 步骤5: 移除可能存在的JSON包装
     # 有时代码可能被包装在JSON字符串中
     if code_str.startswith('"') and code_str.endswith('"'):
-        try:
-            code_str = json.loads(code_str)
-        except:
+        ok, unwrapped = _try_json_loads(code_str)
+        if ok:
+            code_str = unwrapped
+        else:
             code_str = code_str[1:-1]
 
     # 步骤6: 尝试解析为JSON并提取代码字段
-    try:
-        # 尝试将整个字符串解析为JSON
-        parsed = json.loads(code_str)
+    # 解析在 _try_json_loads 边界内完成；下面的清理逻辑不在任何 except
+    # 之中，其异常（包括 KeyboardInterrupt/SystemExit）正常传播。
+    ok, parsed = _try_json_loads(code_str)
+    if ok:
         if isinstance(parsed, dict):
             # 查找常见的代码字段
-            code = _parse_code_parameter(parsed)
+            try:
+                code = _parse_code_parameter(parsed, _depth=_depth)
+            except _CodeNestingError:
+                return code_str
             if code != code_str:
-                return _clean_code_string(code)  # 递归清理
+                return _clean_code_string(code, _depth + 1)  # 递归清理
         elif isinstance(parsed, str):
-            return _clean_code_string(parsed)  # 递归清理
-    except:
-        pass
+            return _clean_code_string(parsed, _depth + 1)  # 递归清理
 
     return code_str
 
```

**File**: `tests/test_python_executor_clean_code.py` (added, +147/-0)
```diff
@@ -0,0 +1,147 @@
+#!/usr/bin/env python
+# -*- coding: utf-8 -*-
+
+"""Tests for _clean_code_string parsing-boundary hardening (PR #95).
+
+Covers the review checklist: malformed JSON, deeply nested JSON,
+nested code fields, the recursion depth limit, and process-control
+exception propagation.
+"""
+
+import json
+import sys
+
+import pytest
+
+from LightAgent.builtin_tools import python_executor
+from LightAgent.builtin_tools.python_executor import (
+    _MAX_CLEAN_DEPTH,
+    _clean_code_string,
+    _parse_code_parameter,
+    _try_json_loads,
+)
+
+
+class TestMalformedJson:
+
+    def test_malformed_json_returns_input_unchanged(self):
+        malformed = '{"code": "print(1)"'  # missing closing brace
+        assert _clean_code_string(malformed) == malformed
+
+    def test_quoted_but_invalid_json_strips_quotes(self):
+        # startswith/endswith '"' but not valid JSON -> quote-strip fallback
+        wrapped = '"print(\'hello\')" + "'
+        result = _clean_code_string(wrapped)
+        assert result == wrapped[1:-1]
+
+    def test_plain_code_passes_through(self):
+        code = 'x = 1\nprint(x)'
+        assert _clean_code_string(code) == code
+
+
+class TestDeeplyNestedJson:
+
+    def test_deeply_nested_json_fails_softly(self):
+        # Decoder recursion thresholds differ between Python versions.
+        depth = sys.getrecursionlimit() * 2
+        deeply_nested = '[' * depth + '1' + ']' * depth
+        # Must not raise: RecursionError is handled at the parsing boundary.
+        result = _clean_code_string(deeply_nested)
+        assert isinstance(result, str)
+
+    def test_try_json_loads_catches_recursion_error(self, monkeypatch):
+        def too_deep(*args, **kwargs):
+            raise RecursionError('decoder recursion limit')
+
+        monkeypatch.setattr(python_executor.json, 'loads', too_deep)
+        ok, value = _try_json_loads('[1]')
+        assert ok is False and value is None
+
+
+class TestNestedCodeFields:
+
+    def test_single_wrapped_code_field(self):
+        payload = json.dumps({'code': 'print(42)'})
+        assert _clean_code_string(payload) == 'print(42)'
+
+    def test_object_nested_code_field(self):
+        # Object nesting is unwrapped by _parse_code_parameter in one pass.
+        payload = json.dumps({'code': {'code': 'print(42)'}})
+        assert _clean_code_string(payload) == 'print(42)'
+
+
+class TestDepthLimit:
+
+    def test_depth_limit_terminates_endless_chain(self, monkeypatch):
+        # A parser result that always produces a fresh wrapped payload would
+        # recurse forever without the limit; with it, the call terminates
+        # after a deterministic number of unwraps.
+        calls = {'n': 0}
+
+        def endless(parsed, **kwargs):
+            calls['n'] += 1
+            return json.dumps({'code': 'level%d' % calls['n']})
+
+        monkeypatch.setattr(python_executor, '_parse_code_parameter', endless)
+        result = _clean_code_string(json.dumps({'code': 'x'}))
+        assert isinstance(result, str)
+        assert calls['n'] <= _MAX_CLEAN_DEPTH
+
+    def test_at_limit_returns_input(self):
+        assert _clean_code_string('anything', _depth=_MAX_CLEAN_DEPTH) == 'anything'
+
+    def test_dictionary_nesting_beyond_limit_is_not_unwrapped(self):
+        payload = 'print(42)'
+        for _ in range(_MAX_CLEAN_DEPTH + 1):
+            payload = {'code': payload}
+        encoded = json.dumps(payload)
+        assert _clean_code_string(encoded) == encoded
+        with pytest.raises(ValueError, match='nesting'):
+            _parse_code_parameter(payload)
+
+    def test_dictionary_nesting_at_limit_still_extracts_code(self):
+        payload = 'print(42)'
+        for _ in range(_MAX_CLEAN_DEPTH):
+            payload = {'code': payload}
+        assert _parse_code_parameter(payload) == 'print(42)'
+        assert _clean_code_string(json.dumps(payload)) == 'print(42)'
+
+    def test_dictionary_limit_respects_existing_cleanup_depth(self):
+        encoded = json.dumps({'code': {'code': 'print(42)'}})
+        assert _clean_code_string(encoded, _depth=_MAX_CLEAN_DEPTH - 1) == encoded
+
+    @pytest.mark.parametrize('key', ['code', 'unknown'])
+    def test_cyclic_dictionary_fails_deterministically(self, key):
+        payload = {}
+        payload[key] = payload
+        with pytest.raises(ValueError, match='nesting|cyclic'):
+            _parse_code_parameter(payload)
+
+
+class TestProcessControlPropagation:
+
+    def test_keyboard_interrupt_propagates(self, monkeypatch):
+        def raise_interrupt(*args, **kwargs):
+            raise KeyboardInterrupt
+
+        monkeypatch.setattr(python_executor.json, 'loads', raise_interrupt)
+        with pytest.raises(KeyboardInterrupt):
+            _clean_code_string('{"code": "x"}')
+
+    def test_system_exit_propagates(self, monkeypatch):
+        def raise_exit(*args, **kwargs):
+            raise SystemExit(3)
+
+        monkeypatch.setattr(python_executor.json, 'loads
```

---

### Incident Patch 4: `9516e266` (2026-09-30)
**Commit Message**: fix: align Memcode example agent and memory policy identity

**File**: `docs/memcode_memory_adapter.md` (modified, +3/-0)
```diff
@@ -62,6 +62,9 @@ agent = LightAgent(
 
 ### Security and lifecycle behavior
 
+- Keep the agent name, adapter provenance name, and policy allowlist aligned.
+  The example's `build_agent(memory)` uses `memory.agent_name` for all three;
+  its space resolver receives namespaced IDs such as `demo:alice`.
 - The application owns API-key or OAuth storage. The adapter never reads a
   credential at import time and never returns credentials to the agent.
 - `space_id_for_user` and `actor_id_for_user` are evaluated for every call.
```

**File**: `example/memcode_memory_adapter.py` (modified, +2/-1)
```diff
@@ -195,6 +195,7 @@ def build_agent(memory: MemcodeMemoryAdapter) -> Any:
     from LightAgent import LightAgent, MemoryPolicy
 
     return LightAgent(
+        name=memory.agent_name,
         role="You are LightAgent with optional Memcode long-term memory.",
         model="deepseek-chat",
         api_key="your_model_api_key",
@@ -205,7 +206,7 @@ def build_agent(memory: MemcodeMemoryAdapter) -> Any:
             allow_unattributed_results=False,
             allowed_sources=("user",),
             allowed_scopes=("user",),
-            allowed_agent_names=("lightagent",),
+            allowed_agent_names=(memory.agent_name,),
         ),
         tree_of_thought=False,
     )
```

**File**: `tests/test_memcode_memory_adapter_example.py` (modified, +68/-0)
```diff
@@ -1,4 +1,5 @@
 import importlib.util
+from copy import deepcopy
 import sys
 from pathlib import Path
 from types import SimpleNamespace
@@ -157,3 +158,70 @@ def test_provider_errors_propagate_without_fallback():
 
     with pytest.raises(RuntimeError, match="provider unavailable"):
         adapter.retrieve("hello", "tenant:alice")
+
+
+class RoundTripMemcodeClient(FakeMemcodeClient):
+    def search(self, **payload):
+        self.search_calls.append(payload)
+        return SimpleNamespace(results=[
+            SimpleNamespace(
+                content=call["content"],
+                metadata=call["metadata"],
+                space=SimpleNamespace(id=call["space_id"]),
+                score=1.0,
+            )
+            for call in self.ingest_calls
+        ])
+
+
+class StaticCompletions:
+    def __init__(self):
+        self.calls = []
+
+    def create(self, **params):
+        self.calls.append(deepcopy(params))
+        message = SimpleNamespace(content="done", tool_calls=None)
+        return SimpleNamespace(choices=[SimpleNamespace(message=message)])
+
+
+@pytest.mark.parametrize("agent_name", ["lightagent", "travel-agent"])
+def test_build_agent_memory_roundtrip_preserves_identity_scope_and_hooks(agent_name):
+    module = load_example_module()
+    client = RoundTripMemcodeClient()
+    memory = module.MemcodeMemoryAdapter(
+        client,
+        space_id_for_user={"demo:alice": "space-alice", "demo:bob": "space-bob"}.__getitem__,
+        agent_name=agent_name,
+    )
+    agent = module.build_agent(memory)
+    completions = StaticCompletions()
+    agent.client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
+    phases = []
+
+    def observe(context):
+        if context.phase in {"before_memory_retrieve", "after_memory_retrieve"}:
+            phases.append(context.phase)
+
+    agent.hooks.hooks.append(observe)
+    assert agent.name == agent_name
+    assert agent.memory_policy.allowed_agent_names == (agent_name,)
+
+    agent.run("Alice prefers quiet beach towns", user_id="alice")
+    stored = client.ingest_calls[0]
+    assert stored["space_id"] == "space-alice"
+    assert stored["metadata"]["user_id"] == "demo:alice"
+    assert stored["metadata"]["agent_name"] == agent_name
+
+    result = agent.run("What does Alice prefer?", user_id="alice", result_format="object", trace=True)
+    assert result.error is None
+    prompt = completions.calls[-1]["messages"][-1]["content"]
+    assert "Alice prefers quiet beach towns" in prompt
+    filtered = next(event for event in result.trace if event["type"] == "memory_retrieve_filter")
+    assert filtered["data"]["allowed_count"] >= 1
+
+    bob = agent.run("What do I prefer?", user_id="bob", result_format="object", trace=True)
+    assert bob.error is None
+    assert "Alice prefers quiet beach towns" not in completions.calls[-1]["messages"][-1]["content"]
+    assert client.search_calls[-1]["context_space_id"] == "space-bob"
+    assert client.ingest_calls[-1]["metadata"]["user_id"] == "demo:bob"
+    assert phases == ["before_memory_retrieve", "after_memory_retrieve"] * 3
```

---

### Incident Patch 5: `bee4373c` (2026-09-30)
**Commit Message**: Merge remote-tracking branch 'origin/main' into codex/fix-pr106-agent-identity

**File**: `LightAgent/__init__.py` (modified, +50/-0)
```diff
@@ -118,6 +118,33 @@
     WebProvider,
     WorkflowProvider,
 )
+from .security import (
+    APPROVAL_TOKEN_SCHEMA_VERSION,
+    PROVIDER_MANIFEST_SCHEMA_VERSION,
+    SECURITY_CONTEXT_SCHEMA_VERSION,
+    ApprovalToken,
+    CapabilityGate,
+    ProviderManifest,
+    SecurityContext,
+    canonical_digest,
+)
+from .dag import (
+    DAG_SCHEMA_VERSION,
+    CallableVerifier,
+    DAGConfig,
+    DAGError,
+    DAGRunResult,
+    DAGRunStatus,
+    DAGTaskStatus,
+    DecompositionProposal,
+    LightDAG,
+    LightDAGProvider,
+    LocalArtifactStore,
+    SqliteTaskGraphStore,
+    TaskOutcome,
+    TaskSpec,
+    VerificationVerdict,
+)
 from .runtime import (
     AgentInbox,
     AgentRuntime,
@@ -274,6 +301,29 @@
     "CapabilityRegistry",
     "ToolProviderAdapter",
     "MemoryProviderAdapter",
+    "SECURITY_CONTEXT_SCHEMA_VERSION",
+    "APPROVAL_TOKEN_SCHEMA_VERSION",
+    "PROVIDER_MANIFEST_SCHEMA_VERSION",
+    "SecurityContext",
+    "ApprovalToken",
+    "ProviderManifest",
+    "CapabilityGate",
+    "canonical_digest",
+    "DAG_SCHEMA_VERSION",
+    "DAGConfig",
+    "DAGError",
+    "DAGRunStatus",
+    "DAGTaskStatus",
+    "DAGRunResult",
+    "TaskSpec",
+    "TaskOutcome",
+    "DecompositionProposal",
+    "VerificationVerdict",
+    "SqliteTaskGraphStore",
+    "LocalArtifactStore",
+    "CallableVerifier",
+    "LightDAGProvider",
+    "LightDAG",
     "InboxMessageType",
     "InboxMessageStatus",
     "InboxMessage",
```

**File**: `LightAgent/builtin_tools/python_executor.py` (modified, +16/-0)
```diff
@@ -16,6 +16,7 @@
 import traceback
 import re
 import ast
+import inspect
 from typing import Dict, Any, List, Optional, Union, Tuple
 
 
@@ -42,6 +43,21 @@
     "execute_python_file",
     "execute_python_code_stream",
 })
+UNSAFE_PYTHON_TOOL_REASON = (
+    "Legacy Python execution tools have no isolated execution route and are "
+    "blocked in tool dispatch. Registering a SandboxProvider does not isolate "
+    "them. Use safe_expression or a custom tool backed by a real sandbox."
+)
+
+
+def is_unsafe_python_tool(tool_name: str, tool_call: Any = None) -> bool:
+    if tool_name in UNSAFE_PYTHON_TOOL_NAMES:
+        return True
+    if tool_call is None:
+        return False
+    return inspect.unwrap(tool_call) in (
+        execute_python_code, execute_python_file, execute_python_code_stream,
+    )
 
 
 def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
```

**File**: `LightAgent/capabilities.py` (modified, +37/-7)
```diff
@@ -78,9 +78,14 @@ class RuntimeContext:
     session_id: str | None = None
     agent_id: str | None = None
     user_id: str | None = None
+    tenant_id: str | None = None
+    project_id: str | None = None
     turn_id: str | None = None
     run_id: str | None = None
+    task_id: str | None = None
+    attempt_id: str | None = None
     permissions: "PermissionSet | None" = None
+    security_context: Any = None
     metadata: dict[str, Any] = field(default_factory=dict)
 
 
@@ -425,6 +430,7 @@ def conflicts(self) -> list[dict[str, Any]]:
         return deepcopy(self._conflicts)
 
     async def mount(self, context: RuntimeContext) -> None:
+        context = self._runtime_context(context)
         for item in self._matching(context):
             await item.provider.mount(context)
             await item.provider.start()
@@ -452,7 +458,7 @@ async def unregister(
         return bool(matches)
 
     def resolve(self, capability: str, context: RuntimeContext | None = None) -> CapabilityProvider:
-        runtime_context = context or RuntimeContext()
+        runtime_context = self._runtime_context(context)
         matches = [
             item for item in self._matching(runtime_context)
             if capability in item.provider.capabilities
@@ -463,15 +469,15 @@ def resolve(self, capability: str, context: RuntimeContext | None = None) -> Cap
         return matches[0].provider
 
     def get(self, name: str, context: RuntimeContext | None = None) -> CapabilityProvider:
-        matches = [item for item in self._matching(context or RuntimeContext()) if item.provider.name == name]
+        matches = [item for item in self._matching(self._runtime_context(context)) if item.provider.name == name]
         if not matches:
             raise LookupError(f"provider `{name}` is not registered")
         matches.sort(key=lambda item: (self._precedence[item.scope], item.order), reverse=True)
         return matches[0].provider
 
     def list(self, context: RuntimeContext | None = None) -> list[dict[str, Any]]:
         values = []
-        for item in self._matching(context or RuntimeContext()):
+        for item in self._matching(self._runtime_context(context)):
             values.append({
                 "name": item.provider.name,
                 "version": item.provider.version,
@@ -483,7 +489,7 @@ def list(self, context: RuntimeContext | None = None) -> list[dict[str, Any]]:
 
     async def health(self, context: RuntimeContext | None = None) -> dict[str, ProviderHealth]:
         result = {}
-        for item in self._matching(context or RuntimeContext()):
+        for item in self._matching(self._runtime_context(context)):
             result[item.provider.name] = await item.provider.health()
         return result
 
@@ -492,19 +498,32 @@ async def reload(self, name: str, config: dict[str, Any], context: RuntimeContex
         await provider.reload(config)
 
     async def stop(self, context: RuntimeContext | None = None) -> None:
-        for item in reversed(self._matching(context or RuntimeContext())):
+        runtime_context = self._runtime_context(context)
+        for item in reversed(self._matching(runtime_context)):
             await item.provider.stop()
             await item.provider.unmount()
-            self._audit("provider.stopped", item, context=context)
+            self._audit("provider.stopped", item, context=runtime_context)
 
     async def invoke(
             self,
             capability: str,
             arguments: dict[str, Any] | None = None,
             *,
             context: RuntimeContext | None = None,
+            approval_token: Any = None,
+            resource: str | None = None,
     ) -> Any:
-        runtime_context = context or RuntimeContext()
+        if context is not None and hasattr(context, "to_runtime_context"):
+            from .security import CapabilityGate
+
+            return await CapabilityGate(self).invoke(
+                capability,
+                arguments,
+                context,
+                approval_token=approval_token,
+                resource=resource,
+            )
+        runtime_context = self._runtime_context(context)
         provider = self.resolve(capability, runtime_context)
         spec = provider.capabilities[capability]
         decision = await self.policy_engine.evaluate(PolicyRequest(
@@ -532,6 +551,17 @@ async def invoke(
             result = str(result)[:spec.output_limit]
         return result
 
+    @staticmethod
+    def _runtime_context(context: Any = None) -> RuntimeContext:
+        if context is None:
+            return RuntimeContext()
+        if isinstance(context, RuntimeContext):
+            return context
+        to_runtime = getattr(context, "to_runtime_context", None)
+        if callable(to_runtime):
+            return to_runtime()
+        raise TypeError("context must be RuntimeContext or SecurityContext")
+
     def _matching(self, context: RuntimeContext) -> list[ProviderRe
```

**File**: `LightAgent/core.py` (modified, +11/-21)
```diff
@@ -67,7 +67,8 @@
     execute_python_code,
     execute_python_file,
     execute_python_code_stream,
-    UNSAFE_PYTHON_TOOL_NAMES,
+    UNSAFE_PYTHON_TOOL_REASON,
+    is_unsafe_python_tool,
 )
 from .builtin_tools.nos import upload_file_to_oss
 from .builtin_tools.safe_expression import safe_expression
@@ -134,7 +135,7 @@ def __init__(
             filter_tools: bool = True,  # 是否启用工具过滤
             self_learning: bool = False,  # 是否启用agent自我学习
             tools: List[Union[str, Callable]] = None,  # 支持工具混合输入
-            enable_unsafe_python: bool = False,  # 显式启用需沙箱的任意 Python 执行工具
+            enable_unsafe_python: bool = False,  # 兼容注册；旧执行器不能由模型调度
             skills_directories: List[str] = None,  # 支持技能混合输入
             auto_discover_skills: bool = True,  # 是否自动发现技能
             input_guardrails: List[Callable[..., Any]] | None = None,  # 输入安全策略
@@ -172,7 +173,7 @@ def __init__(
         :param tot_base_url: API 的基础 URL。
         :param filter_tools: 是否启用工具过滤。
         :param tools: 工具列表，支持函数名称（字符串）或函数对象。
-        :param enable_unsafe_python: 是否显式注册任意 Python 执行工具；启用后仍要求 SandboxProvider。
+        :param enable_unsafe_python: 是否兼容注册旧 Python 执行工具；模型调度始终阻断，应用可直接调用。
         :param input_guardrails: 输入安全策略列表，返回 False、原因字符串、dict 或 GuardrailDecision 可阻止运行。
         :param tool_guardrails: 工具调用安全策略列表，返回 False、原因字符串、dict 或 GuardrailDecision 可阻止工具执行。
         :param output_guardrails: 输出安全策略列表，返回 False、原因字符串、dict 或 GuardrailDecision 可阻止非流式输出。
@@ -263,8 +264,8 @@ def __init__(
             self.load_tools(self.tools)
 
         # Safe expression evaluation is available by default. Arbitrary Python
-        # execution is opt-in and is rejected later unless a SandboxProvider is
-        # registered for the current runtime.
+        # registration is retained for compatibility, but tool dispatch stays
+        # blocked until an actual isolated execution route is implemented.
         builtin_tools = [safe_expression, upload_file_to_oss]
         if enable_unsafe_python:
             builtin_tools.extend([
@@ -1251,19 +1252,6 @@ def _apply_tool_guardrails(self, tool_name: str, arguments: Dict[str, Any]) -> t
         })
         return arguments, error_msg
 
-    def _sandbox_available(self) -> bool:
-        """Return whether an explicit SandboxProvider is mounted for this agent."""
-        context = getattr(getattr(self, "runtime", None), "context", None)
-        for provider in self.capability_registry.list(context):
-            if provider.get("name") == "sandbox":
-                return True
-            if any(
-                str(capability.get("name", "")).startswith("sandbox.")
-                for capability in provider.get("capabilities", [])
-            ):
-                return True
-        return False
-
     def _prepare_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> tuple[Dict[str, Any], str | None]:
         cancellation_error = self._current_cancellation_error("before_tool_call")
         if cancellation_error:
@@ -1274,10 +1262,12 @@ def _prepare_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> tuple
             execute=True,
             risk=CapabilityRisk.SENSITIVE,
             cancellable=True,
-            requires_sandbox=tool_name in UNSAFE_PYTHON_TOOL_NAMES,
+            requires_sandbox=is_unsafe_python_tool(
+                tool_name, self.tool_registry.function_mappings.get(tool_name),
+            ),
         )
-        if spec.requires_sandbox and not self._sandbox_available():
-            reason = f"tool `{tool_name}` requires an explicit SandboxProvider"
+        if spec.requires_sandbox:
+            reason = UNSAFE_PYTHON_TOOL_REASON
             self._record_session_event("policy.decision", {
                 "provider": "tools",
                 "capability": spec.name,
```

**File**: `LightAgent/dag/__init__.py` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+"""Experimental persistent Dynamic DAG runtime for LightAgent."""
+
+from .artifacts import ArtifactStore, LocalArtifactStore
+from .context import ContextBuilder, DAGContextBudget
+from .graph import dependency_closure, topological_order
+from .models import (
+    DAG_SCHEMA_VERSION,
+    AssuranceLevel,
+    ArtifactManifest,
+    DAGAttemptStatus,
+    DAGConfig,
+    DAGEvent,
+    DAGRun,
+    DAGRunResult,
+    DAGRunStatus,
+    DAGTask,
+    DAGTaskStatus,
+    DecompositionProposal,
+    TaskAttempt,
+    TaskContext,
+    TaskDependency,
+    TaskOutcome,
+    TaskOutcomeKind,
+    TaskSpec,
+    TaskState,
+    VerificationReport,
+    VerificationRequest,
+    VerificationVerdict,
+)
+from .provider import LightDAGProvider
+from .scheduler import LightDAG
+from .store import DAGError, SqliteTaskGraphStore, TaskGraphStore
+from .verification import CallableVerifier, Verifier
+from .worker import (
+    CallableWorker,
+    DAGWorker,
+    DAGWorkerProtocolError,
+    LightAgentWorkerAdapter,
+    RegistryWorkerFactory,
+    WorkerFactory,
+    normalize_task_outcome,
+)
+
+
+__all__ = [
+    "DAG_SCHEMA_VERSION",
+    "DAGError",
+    "DAGRunStatus",
+    "DAGTaskStatus",
+    "DAGAttemptStatus",
+    "VerificationVerdict",
+    "AssuranceLevel",
+    "TaskOutcomeKind",
+    "DAGConfig",
+    "TaskSpec",
+    "TaskState",
+    "DAGTask",
+    "DAGRun",
+    "TaskDependency",
+    "TaskAttempt",
+    "DecompositionProposal",
+    "ArtifactManifest",
+    "VerificationReport",
+    "DAGEvent",
+    "TaskContext",
+    "TaskOutcome",
+    "VerificationRequest",
+    "DAGRunResult",
+    "TaskGraphStore",
+    "SqliteTaskGraphStore",
+    "ArtifactStore",
+    "LocalArtifactStore",
+    "Verifier",
+    "CallableVerifier",
+    "DAGWorker",
+    "WorkerFactory",
+    "CallableWorker",
+    "RegistryWorkerFactory",
+    "LightAgentWorkerAdapter",
+    "DAGWorkerProtocolError",
+    "normalize_task_outcome",
+    "DAGContextBudget",
+    "ContextBuilder",
+    "topological_order",
+    "dependency_closure",
+    "LightDAGProvider",
+    "LightDAG",
+]
```

**File**: `LightAgent/dag/artifacts.py` (added, +159/-0)
```diff
@@ -0,0 +1,159 @@
+"""Content-addressed local artifact storage for verified DAG outputs."""
+
+from __future__ import annotations
+
+import hashlib
+import os
+import tempfile
+from pathlib import Path
+from typing import Any, Iterable, Protocol
+
+from ..security import SecurityContext
+from .models import ArtifactManifest, DAGRun, DAGTask, TaskAttempt
+from .store import DAGError
+
+
+class ArtifactStore(Protocol):
+    def stage(
+            self,
+            content: bytes | str,
+            *,
+            run: DAGRun,
+            task: DAGTask,
+            attempt: TaskAttempt,
+            media_type: str = "text/plain",
+            dependency_manifest: dict[str, list[str]] | None = None,
+    ) -> ArtifactManifest:
+        ...
+
+    def read(
+            self,
+            manifest: ArtifactManifest,
+            context: SecurityContext,
+            *,
+            require_published: bool = True,
+    ) -> bytes:
+        ...
+
+
+class LocalArtifactStore:
+    """Write immutable blobs first; SQLite controls staged/published authority."""
+
+    def __init__(self, root: str | Path, *, max_artifact_bytes: int = 10 * 1024 * 1024):
+        if max_artifact_bytes <= 0:
+            raise ValueError("max_artifact_bytes must be positive")
+        self.root = Path(root).expanduser().resolve()
+        self.root.mkdir(parents=True, exist_ok=True)
+        self.max_artifact_bytes = max_artifact_bytes
+
+    def stage(
+            self,
+            content: bytes | str,
+            *,
+            run: DAGRun,
+            task: DAGTask,
+            attempt: TaskAttempt,
+            media_type: str = "text/plain",
+            dependency_manifest: dict[str, list[str]] | None = None,
+    ) -> ArtifactManifest:
+        payload = content.encode("utf-8") if isinstance(content, str) else bytes(content)
+        if len(payload) > self.max_artifact_bytes:
+            raise DAGError("BUDGET-EXHAUSTED", "artifact exceeds max_artifact_bytes")
+        digest = hashlib.sha256(payload).hexdigest()
+        relative = Path(run.tenant_id) / run.project_id / digest[:2] / digest
+        destination = self._resolve(relative)
+        destination.parent.mkdir(parents=True, exist_ok=True)
+        if destination.exists():
+            if destination.is_symlink() or self._digest_file(destination) != digest:
+                raise DAGError("ARTIFACT-INTEGRITY", "existing artifact bytes do not match the content hash")
+        else:
+            descriptor, temporary_name = tempfile.mkstemp(prefix=f".{digest}.", dir=destination.parent)
+            temporary = Path(temporary_name)
+            try:
+                with os.fdopen(descriptor, "wb") as stream:
+                    stream.write(payload)
+                    stream.flush()
+                    os.fsync(stream.fileno())
+                os.replace(temporary, destination)
+            finally:
+                if temporary.exists():
+                    temporary.unlink()
+        return ArtifactManifest(
+            run_id=run.run_id,
+            task_id=task.spec.task_id,
+            attempt_id=attempt.attempt_id,
+            tenant_id=run.tenant_id,
+            project_id=run.project_id,
+            content_hash=digest,
+            relative_blob_path=relative.as_posix(),
+            media_type=media_type,
+            byte_size=len(payload),
+            contract_hash=task.spec.contract_hash,
+            dependency_manifest=dependency_manifest or {},
+        )
+
+    def read(
+            self,
+            manifest: ArtifactManifest,
+            context: SecurityContext,
+            *,
+            require_published: bool = True,
+    ) -> bytes:
+        if context.tenant_id != manifest.tenant_id or context.project_id != manifest.project_id:
+            raise PermissionError("artifact is outside the tenant/project security context")
+        if require_published and manifest.state != "published":
+            raise PermissionError("staged artifacts are not readable as trusted results")
+        path = self._resolve(Path(manifest.relative_blob_path))
+        if not path.is_file() or path.is_symlink():
+            raise DAGError("ARTIFACT-INTEGRITY", "artifact blob is missing or not a regular file")
+        payload = path.read_bytes()
+        if len(payload) != manifest.byte_size or hashlib.sha256(payload).hexdigest() != manifest.content_hash:
+            raise DAGError("ARTIFACT-INTEGRITY", "artifact content failed integrity verification")
+        return payload
+
+    def check_integrity(self, manifest: ArtifactManifest) -> bool:
+        try:
+            path = self._resolve(Path(manifest.relative_blob_path))
+            return (
+                path.is_file()
+                and not path.is_symlink()
+                and path.stat().st_size == manifest.byte_size
+                and self._digest_file(path) == manifest.content_hash
+            )
+        except (OSError, DAGError):
+            return False
+
+    def 
```

**File**: `LightAgent/dag/context.py` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+"""Bounded local context construction for one DAG task attempt."""
+
+from __future__ import annotations
+
+import json
+from dataclasses import dataclass
+from typing import Any, Callable, Iterable
+
+from .models import ArtifactManifest, DAGTask, TaskAttempt
+from .store import DAGError
+
+
+@dataclass(frozen=True)
+class DAGContextBudget:
+    max_chars: int = 32_000
+    max_dependency_artifacts: int = 32
+    max_retrieval_results: int = 8
+
+    def __post_init__(self) -> None:
+        if min(self.max_chars, self.max_dependency_artifacts, self.max_retrieval_results) <= 0:
+            raise ValueError("DAG context limits must be positive")
+
+
+class ContextBuilder:
+    """Keep mandatory contracts intact and trim only optional retrieval data."""
+
+    def __init__(
+            self,
+            *,
+            budget: DAGContextBudget | None = None,
+            retrieve: Callable[[str, int], Iterable[Any]] | None = None,
+    ):
+        self.budget = budget or DAGContextBudget()
+        self.retrieve = retrieve
+
+    def build(
+            self,
+            task: DAGTask,
+            attempt: TaskAttempt,
+            dependency_artifacts: dict[str, tuple[ArtifactManifest, ...]],
+    ) -> dict[str, Any]:
+        flattened = [
+            artifact
+            for task_id in sorted(dependency_artifacts)
+            for artifact in dependency_artifacts[task_id]
+        ]
+        if len(flattened) > self.budget.max_dependency_artifacts:
+            raise DAGError("CONTEXT-OVERFLOW", "required dependency artifacts exceed the context budget")
+        mandatory = {
+            "task_id": task.spec.task_id,
+            "goal": task.spec.goal,
+            "acceptance_contract": task.spec.acceptance_contract,
+            "contract_hash": task.spec.contract_hash,
+            "phase": attempt.phase,
+            "input_snapshot_hash": attempt.input_snapshot_hash,
+            "dependencies": {
+                task_id: [artifact.to_dict() for artifact in artifacts]
+                for task_id, artifacts in dependency_artifacts.items()
+            },
+            "last_diagnostic": task.state.last_diagnostic,
+        }
+        mandatory_size = len(json.dumps(mandatory, ensure_ascii=False, default=repr))
+        if mandatory_size > self.budget.max_chars:
+            raise DAGError("CONTEXT-OVERFLOW", "mandatory task contract does not fit the context budget")
+        retrieval = []
+        if self.retrieve:
+            for item in self.retrieve(task.spec.goal, self.budget.max_retrieval_results):
+                candidate = [*retrieval, item]
+                payload = {**mandatory, "retrieval": candidate}
+                if len(json.dumps(payload, ensure_ascii=False, default=repr)) > self.budget.max_chars:
+                    break
+                retrieval = candidate
+        return {**mandatory, "retrieval": retrieval}
+
+
+__all__ = ["DAGContextBudget", "ContextBuilder"]
```

**File**: `LightAgent/dag/graph.py` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+"""Dependency graph algorithms that avoid Python recursion limits."""
+
+from __future__ import annotations
+
+from collections import deque
+from typing import Iterable
+
+from .store import DAGError
+
+
+def topological_order(task_ids: Iterable[str], edges: Iterable[tuple[str, str]]) -> list[str]:
+    nodes = set(task_ids)
+    edge_set = set(edges)
+    unknown = sorted({item for edge in edge_set for item in edge if item not in nodes})
+    if unknown:
+        raise DAGError("UNKNOWN-DEPENDENCY", f"unknown task IDs: {unknown}")
+    if any(task_id == dependency_id for task_id, dependency_id in edge_set):
+        raise DAGError("CYCLE", "self dependencies are not allowed")
+    indegree = {task_id: 0 for task_id in nodes}
+    reverse: dict[str, list[str]] = {task_id: [] for task_id in nodes}
+    for task_id, dependency_id in edge_set:
+        indegree[task_id] += 1
+        reverse[dependency_id].append(task_id)
+    ready = deque(sorted(task_id for task_id, degree in indegree.items() if degree == 0))
+    ordered = []
+    while ready:
+        current = ready.popleft()
+        ordered.append(current)
+        for dependent in sorted(reverse[current]):
+            indegree[dependent] -= 1
+            if indegree[dependent] == 0:
+                ready.append(dependent)
+    if len(ordered) != len(nodes):
+        raise DAGError("CYCLE", "task dependencies contain a cycle")
+    return ordered
+
+
+def dependency_closure(task_id: str, edges: Iterable[tuple[str, str]]) -> set[str]:
+    dependencies: dict[str, list[str]] = {}
+    for task, dependency in edges:
+        dependencies.setdefault(task, []).append(dependency)
+    seen: set[str] = set()
+    pending = list(dependencies.get(task_id, ()))
+    while pending:
+        current = pending.pop()
+        if current in seen:
+            continue
+        seen.add(current)
+        pending.extend(dependencies.get(current, ()))
+    return seen
+
+
+__all__ = ["topological_order", "dependency_closure"]
```

---

### Incident Patch 6: `b48c7bc5` (2026-09-30)
**Commit Message**: Merge remote-tracking branch 'origin/main' into codex/fix-pr95-clean-depth

**File**: `LightAgent/builtin_tools/python_executor.py` (modified, +16/-0)
```diff
@@ -16,6 +16,7 @@
 import traceback
 import re
 import ast
+import inspect
 from typing import Dict, Any, List, Optional, Union, Tuple
 
 
@@ -42,6 +43,21 @@
     "execute_python_file",
     "execute_python_code_stream",
 })
+UNSAFE_PYTHON_TOOL_REASON = (
+    "Legacy Python execution tools have no isolated execution route and are "
+    "blocked in tool dispatch. Registering a SandboxProvider does not isolate "
+    "them. Use safe_expression or a custom tool backed by a real sandbox."
+)
+
+
+def is_unsafe_python_tool(tool_name: str, tool_call: Any = None) -> bool:
+    if tool_name in UNSAFE_PYTHON_TOOL_NAMES:
+        return True
+    if tool_call is None:
+        return False
+    return inspect.unwrap(tool_call) in (
+        execute_python_code, execute_python_file, execute_python_code_stream,
+    )
 
 
 # Both JSON cleanup and nested dictionary extraction use a bounded depth.
```

**File**: `LightAgent/core.py` (modified, +11/-21)
```diff
@@ -67,7 +67,8 @@
     execute_python_code,
     execute_python_file,
     execute_python_code_stream,
-    UNSAFE_PYTHON_TOOL_NAMES,
+    UNSAFE_PYTHON_TOOL_REASON,
+    is_unsafe_python_tool,
 )
 from .builtin_tools.nos import upload_file_to_oss
 from .builtin_tools.safe_expression import safe_expression
@@ -134,7 +135,7 @@ def __init__(
             filter_tools: bool = True,  # 是否启用工具过滤
             self_learning: bool = False,  # 是否启用agent自我学习
             tools: List[Union[str, Callable]] = None,  # 支持工具混合输入
-            enable_unsafe_python: bool = False,  # 显式启用需沙箱的任意 Python 执行工具
+            enable_unsafe_python: bool = False,  # 兼容注册；旧执行器不能由模型调度
             skills_directories: List[str] = None,  # 支持技能混合输入
             auto_discover_skills: bool = True,  # 是否自动发现技能
             input_guardrails: List[Callable[..., Any]] | None = None,  # 输入安全策略
@@ -172,7 +173,7 @@ def __init__(
         :param tot_base_url: API 的基础 URL。
         :param filter_tools: 是否启用工具过滤。
         :param tools: 工具列表，支持函数名称（字符串）或函数对象。
-        :param enable_unsafe_python: 是否显式注册任意 Python 执行工具；启用后仍要求 SandboxProvider。
+        :param enable_unsafe_python: 是否兼容注册旧 Python 执行工具；模型调度始终阻断，应用可直接调用。
         :param input_guardrails: 输入安全策略列表，返回 False、原因字符串、dict 或 GuardrailDecision 可阻止运行。
         :param tool_guardrails: 工具调用安全策略列表，返回 False、原因字符串、dict 或 GuardrailDecision 可阻止工具执行。
         :param output_guardrails: 输出安全策略列表，返回 False、原因字符串、dict 或 GuardrailDecision 可阻止非流式输出。
@@ -263,8 +264,8 @@ def __init__(
             self.load_tools(self.tools)
 
         # Safe expression evaluation is available by default. Arbitrary Python
-        # execution is opt-in and is rejected later unless a SandboxProvider is
-        # registered for the current runtime.
+        # registration is retained for compatibility, but tool dispatch stays
+        # blocked until an actual isolated execution route is implemented.
         builtin_tools = [safe_expression, upload_file_to_oss]
         if enable_unsafe_python:
             builtin_tools.extend([
@@ -1251,19 +1252,6 @@ def _apply_tool_guardrails(self, tool_name: str, arguments: Dict[str, Any]) -> t
         })
         return arguments, error_msg
 
-    def _sandbox_available(self) -> bool:
-        """Return whether an explicit SandboxProvider is mounted for this agent."""
-        context = getattr(getattr(self, "runtime", None), "context", None)
-        for provider in self.capability_registry.list(context):
-            if provider.get("name") == "sandbox":
-                return True
-            if any(
-                str(capability.get("name", "")).startswith("sandbox.")
-                for capability in provider.get("capabilities", [])
-            ):
-                return True
-        return False
-
     def _prepare_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> tuple[Dict[str, Any], str | None]:
         cancellation_error = self._current_cancellation_error("before_tool_call")
         if cancellation_error:
@@ -1274,10 +1262,12 @@ def _prepare_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> tuple
             execute=True,
             risk=CapabilityRisk.SENSITIVE,
             cancellable=True,
-            requires_sandbox=tool_name in UNSAFE_PYTHON_TOOL_NAMES,
+            requires_sandbox=is_unsafe_python_tool(
+                tool_name, self.tool_registry.function_mappings.get(tool_name),
+            ),
         )
-        if spec.requires_sandbox and not self._sandbox_available():
-            reason = f"tool `{tool_name}` requires an explicit SandboxProvider"
+        if spec.requires_sandbox:
+            reason = UNSAFE_PYTHON_TOOL_REASON
             self._record_session_event("policy.decision", {
                 "provider": "tools",
                 "capability": spec.name,
```

**File**: `LightAgent/tools.py` (modified, +3/-0)
```diff
@@ -17,6 +17,7 @@
 from typing import List, Dict, Any, Callable, Union, Generator, AsyncGenerator
 
 from .errors import format_error_code, format_lightagent_error
+from .builtin_tools.python_executor import UNSAFE_PYTHON_TOOL_REASON, is_unsafe_python_tool
 
 
 _TOOL_NAME_PATTERN = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
@@ -262,6 +263,8 @@ async def dispatch(self, tool_name: str, tool_params: Dict[str, Any]) -> Union[
             return format_error_code("LA-TOOL", f"Tool `{tool_name}` not found.")
 
         tool_call = self.function_mappings[tool_name]
+        if is_unsafe_python_tool(tool_name, tool_call):
+            return format_error_code("LA-SANDBOX", UNSAFE_PYTHON_TOOL_REASON)
         validation_error = self._validate_tool_params(tool_name, tool_params)
         if validation_error:
             return validation_error
```

**File**: `README.md` (modified, +6/-4)
```diff
@@ -130,10 +130,12 @@ from LightAgent import safe_expression
 print(safe_expression("45 * 9827"))
 ```
 
-Enabling `execute_python_code`, `execute_python_file`, or
-`execute_python_code_stream` requires `enable_unsafe_python=True` and an
-explicit `SandboxProvider`. The executor remains a controlled subprocess, not
-a security sandbox; see [Python Executor Security](docs/python_executor_security.md).
+Legacy `execute_python_code`, `execute_python_file`, and
+`execute_python_code_stream` are blocked in model and dispatcher invocation,
+including with `enable_unsafe_python=True` or a registered `SandboxProvider`.
+Trusted application code may call them directly under its own isolation
+controls. Use a custom sandbox-backed tool for agent code execution; see
+[Python Executor Security](docs/python_executor_security.md).
 
 ### Evaluate And Review High-Risk Actions
 
```

**File**: `README.zh-CN.md` (modified, +5/-3)
```diff
@@ -146,9 +146,11 @@ from LightAgent import safe_expression
 print(safe_expression("45 * 9827"))
 ```
 
-启用 `execute_python_code`、`execute_python_file` 或
-`execute_python_code_stream` 需要设置 `enable_unsafe_python=True`，并注册显式
-的 `SandboxProvider`。执行器只是受控子进程，并不是安全沙箱；详见
+旧的 `execute_python_code`、`execute_python_file` 和
+`execute_python_code_stream` 不允许通过模型或工具调度器执行，设置
+`enable_unsafe_python=True` 或注册 `SandboxProvider` 也不会解除阻断。
+可信应用代码仍可在自行隔离的环境中直接调用；Agent 执行代码应使用真正委托给
+沙箱的自定义工具。详见
 [Python 执行器安全说明](docs/python_executor_security.md)。
 
 ### 评测并审核高风险动作
```

**File**: `docs/python_executor_security.md` (modified, +10/-3)
```diff
@@ -3,8 +3,13 @@
 `execute_python_code`, `execute_python_file`, and
 `execute_python_code_stream` are controlled utilities, not security sandboxes.
 As of v0.10.1, these arbitrary-code tools are not registered by default on a
-`LightAgent`. They require explicit `enable_unsafe_python=True` opt-in and an
-explicit `SandboxProvider` before a model tool call is allowed.
+`LightAgent`. The registration-only compatibility flag
+`enable_unsafe_python=True` does not authorize execution. Model tool calls,
+`AsyncToolDispatcher`, and `ToolProviderAdapter` now reject these legacy tools
+with `LA-SANDBOX`, even when a `SandboxProvider` is registered or started.
+Provider registration does not route the legacy subprocess through isolation.
+Direct calls from trusted application code remain available, but require
+application-managed isolation; they are not safe for untrusted input.
 
 For arithmetic and data-only calculations, use the default `safe_expression`
 tool or the `evaluate_safe_expression()` API. It evaluates a bounded AST
@@ -26,7 +31,9 @@ AST filtering is defense in depth. Python introspection and dynamic behavior
 cannot be made fully safe with a static denylist. New bypasses may exist, and
 accepted code can still consume CPU, memory, disk, or allowed network APIs.
 The `enable_unsafe_python` switch is an explicit compatibility opt-in, not a
-security boundary; arbitrary code must run inside a real SandboxProvider.
+security boundary. To execute arbitrary code, supply a custom tool whose own
+implementation delegates to a real isolated worker or SandboxProvider.
+LightAgent does not ship an isolated execution route for the legacy utilities.
 
 ### Production Controls
 
```

**File**: `docs/tools.md` (modified, +8/-5)
```diff
@@ -376,7 +376,7 @@ are loaded.
 ### Built-in Tools
 
 LightAgent automatically registers safe built-in tools at startup. Arbitrary
-Python execution tools require explicit opt-in:
+Python execution utilities and safe calculation:
 
 | Tool Name | Description |
 | --- | --- |
@@ -387,10 +387,13 @@ Python execution tools require explicit opt-in:
 | `upload_file_to_oss` | Upload a file to object storage (OSS); requires optional `boto3`. |
 
 `safe_expression` and `upload_file_to_oss` are registered by default. The
-arbitrary Python tools are disabled by default in v0.10.1. To register them,
-pass `enable_unsafe_python=True` and mount an explicit capability provider named
-`sandbox` (or one exposing a `sandbox.*` capability); otherwise model tool calls
-are rejected with `LA-SANDBOX`.
+arbitrary Python tools are disabled by default in v0.10.1.
+`enable_unsafe_python=True` retains registration compatibility only: model tool
+calls and dispatcher/provider invocation of these legacy utilities fail closed
+with `LA-SANDBOX`, regardless of sandbox provider registration or lifecycle.
+Trusted applications may call the utilities directly under their own isolation
+controls. For agent execution, supply a custom tool that actually delegates to
+an isolated worker or SandboxProvider; registration alone is not isolation.
 
 The Python executor utilities use an AST denylist and a temporary working
 directory, but they are not security sandboxes. Review the
```

**File**: `roadmap.md` (modified, +4/-1)
```diff
@@ -156,7 +156,10 @@ Immediate security-governance work:
   `safe_expression` replacement. Keep the public tracker open until the private
   Security Advisory confirms the affected configuration/version range and
   reporter attribution. The compatibility executor remains a controlled
-  subprocess, not a security sandbox.
+  subprocess, not a security sandbox. Follow-up hardening blocks legacy
+  executors in model, dispatcher, and tool-provider invocation, even with a
+  registered sandbox provider; direct trusted application calls remain under
+  application-managed isolation. Private Vulnerability Reporting is enabled.
 
 P1 security validation work:
 
```

---

### Incident Patch 7: `9e142856` (2026-09-30)
**Commit Message**: fix: bound nested code parameter extraction

**File**: `LightAgent/builtin_tools/python_executor.py` (modified, +20/-8)
```diff
@@ -44,7 +44,15 @@
 })
 
 
-def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
+# Both JSON cleanup and nested dictionary extraction use a bounded depth.
+_MAX_CLEAN_DEPTH = 5
+
+
+class _CodeNestingError(ValueError):
+    pass
+
+
+def _parse_code_parameter(code_param: Union[str, Dict, Any], _depth: int = 0) -> str:
     """
     解析可能包含在各种格式中的代码参数
 
@@ -60,6 +68,8 @@ def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
 
     # 如果是字典，尝试提取常见的键
     if isinstance(code_param, dict):
+        if _depth >= _MAX_CLEAN_DEPTH:
+            raise _CodeNestingError("Code parameter nesting exceeds the cleanup limit")
         # 尝试各种可能的键名
         possible_keys = ['code', 'script', 'python_code', 'source', 'content', 'program']
         for key in possible_keys:
@@ -69,7 +79,7 @@ def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
                     return value
                 elif isinstance(value, dict):
                     # 递归处理嵌套字典
-                    return _parse_code_parameter(value)
+                    return _parse_code_parameter(value, _depth + 1)
 
         # 如果字典只有一个值，可能是直接传入的
         if len(code_param) == 1:
@@ -78,7 +88,10 @@ def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
                 return value
 
         # 尝试将整个字典转换为字符串
-        return json.dumps(code_param, ensure_ascii=False)
+        try:
+            return json.dumps(code_param, ensure_ascii=False)
+        except (RecursionError, ValueError) as exc:
+            raise _CodeNestingError("Code parameter is too deeply nested or cyclic") from exc
 
     # 如果是列表，尝试连接或提取
     if isinstance(code_param, list):
@@ -92,10 +105,6 @@ def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
     return str(code_param)
 
 
-# 递归清理的确定性深度上限：嵌套的JSON包装超过该深度后按原样返回。
-_MAX_CLEAN_DEPTH = 5
-
-
 def _try_json_loads(candidate: str) -> Tuple[bool, Any]:
     """在解析边界上隔离 json.loads。
 
@@ -165,7 +174,10 @@ def _clean_code_string(code_str: str, _depth: int = 0) -> str:
     if ok:
         if isinstance(parsed, dict):
             # 查找常见的代码字段
-            code = _parse_code_parameter(parsed)
+            try:
+                code = _parse_code_parameter(parsed, _depth=_depth)
+            except _CodeNestingError:
+                return code_str
             if code != code_str:
                 return _clean_code_string(code, _depth + 1)  # 递归清理
         elif isinstance(parsed, str):
```

**File**: `tests/test_python_executor_clean_code.py` (modified, +29/-1)
```diff
@@ -17,6 +17,7 @@
 from LightAgent.builtin_tools.python_executor import (
     _MAX_CLEAN_DEPTH,
     _clean_code_string,
+    _parse_code_parameter,
     _try_json_loads,
 )
 
@@ -74,7 +75,7 @@ def test_depth_limit_terminates_endless_chain(self, monkeypatch):
         # after a deterministic number of unwraps.
         calls = {'n': 0}
 
-        def endless(parsed):
+        def endless(parsed, **kwargs):
             calls['n'] += 1
             return json.dumps({'code': 'level%d' % calls['n']})
 
@@ -86,6 +87,33 @@ def endless(parsed):
     def test_at_limit_returns_input(self):
         assert _clean_code_string('anything', _depth=_MAX_CLEAN_DEPTH) == 'anything'
 
+    def test_dictionary_nesting_beyond_limit_is_not_unwrapped(self):
+        payload = 'print(42)'
+        for _ in range(_MAX_CLEAN_DEPTH + 1):
+            payload = {'code': payload}
+        encoded = json.dumps(payload)
+        assert _clean_code_string(encoded) == encoded
+        with pytest.raises(ValueError, match='nesting'):
+            _parse_code_parameter(payload)
+
+    def test_dictionary_nesting_at_limit_still_extracts_code(self):
+        payload = 'print(42)'
+        for _ in range(_MAX_CLEAN_DEPTH):
+            payload = {'code': payload}
+        assert _parse_code_parameter(payload) == 'print(42)'
+        assert _clean_code_string(json.dumps(payload)) == 'print(42)'
+
+    def test_dictionary_limit_respects_existing_cleanup_depth(self):
+        encoded = json.dumps({'code': {'code': 'print(42)'}})
+        assert _clean_code_string(encoded, _depth=_MAX_CLEAN_DEPTH - 1) == encoded
+
+    @pytest.mark.parametrize('key', ['code', 'unknown'])
+    def test_cyclic_dictionary_fails_deterministically(self, key):
+        payload = {}
+        payload[key] = payload
+        with pytest.raises(ValueError, match='nesting|cyclic'):
+            _parse_code_parameter(payload)
+
 
 class TestProcessControlPropagation:
 
```

---

### Incident Patch 8: `ca9b7ec1` (2026-09-30)
**Commit Message**: Merge pull request #110 from wanxingai/codex/security-executor-fail-closed

fix: fail closed for legacy Python executor tool dispatch

**File**: `LightAgent/builtin_tools/python_executor.py` (modified, +16/-0)
```diff
@@ -16,6 +16,7 @@
 import traceback
 import re
 import ast
+import inspect
 from typing import Dict, Any, List, Optional, Union, Tuple
 
 
@@ -42,6 +43,21 @@
     "execute_python_file",
     "execute_python_code_stream",
 })
+UNSAFE_PYTHON_TOOL_REASON = (
+    "Legacy Python execution tools have no isolated execution route and are "
+    "blocked in tool dispatch. Registering a SandboxProvider does not isolate "
+    "them. Use safe_expression or a custom tool backed by a real sandbox."
+)
+
+
+def is_unsafe_python_tool(tool_name: str, tool_call: Any = None) -> bool:
+    if tool_name in UNSAFE_PYTHON_TOOL_NAMES:
+        return True
+    if tool_call is None:
+        return False
+    return inspect.unwrap(tool_call) in (
+        execute_python_code, execute_python_file, execute_python_code_stream,
+    )
 
 
 def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
```

**File**: `LightAgent/core.py` (modified, +11/-21)
```diff
@@ -67,7 +67,8 @@
     execute_python_code,
     execute_python_file,
     execute_python_code_stream,
-    UNSAFE_PYTHON_TOOL_NAMES,
+    UNSAFE_PYTHON_TOOL_REASON,
+    is_unsafe_python_tool,
 )
 from .builtin_tools.nos import upload_file_to_oss
 from .builtin_tools.safe_expression import safe_expression
@@ -134,7 +135,7 @@ def __init__(
             filter_tools: bool = True,  # 是否启用工具过滤
             self_learning: bool = False,  # 是否启用agent自我学习
             tools: List[Union[str, Callable]] = None,  # 支持工具混合输入
-            enable_unsafe_python: bool = False,  # 显式启用需沙箱的任意 Python 执行工具
+            enable_unsafe_python: bool = False,  # 兼容注册；旧执行器不能由模型调度
             skills_directories: List[str] = None,  # 支持技能混合输入
             auto_discover_skills: bool = True,  # 是否自动发现技能
             input_guardrails: List[Callable[..., Any]] | None = None,  # 输入安全策略
@@ -172,7 +173,7 @@ def __init__(
         :param tot_base_url: API 的基础 URL。
         :param filter_tools: 是否启用工具过滤。
         :param tools: 工具列表，支持函数名称（字符串）或函数对象。
-        :param enable_unsafe_python: 是否显式注册任意 Python 执行工具；启用后仍要求 SandboxProvider。
+        :param enable_unsafe_python: 是否兼容注册旧 Python 执行工具；模型调度始终阻断，应用可直接调用。
         :param input_guardrails: 输入安全策略列表，返回 False、原因字符串、dict 或 GuardrailDecision 可阻止运行。
         :param tool_guardrails: 工具调用安全策略列表，返回 False、原因字符串、dict 或 GuardrailDecision 可阻止工具执行。
         :param output_guardrails: 输出安全策略列表，返回 False、原因字符串、dict 或 GuardrailDecision 可阻止非流式输出。
@@ -263,8 +264,8 @@ def __init__(
             self.load_tools(self.tools)
 
         # Safe expression evaluation is available by default. Arbitrary Python
-        # execution is opt-in and is rejected later unless a SandboxProvider is
-        # registered for the current runtime.
+        # registration is retained for compatibility, but tool dispatch stays
+        # blocked until an actual isolated execution route is implemented.
         builtin_tools = [safe_expression, upload_file_to_oss]
         if enable_unsafe_python:
             builtin_tools.extend([
@@ -1251,19 +1252,6 @@ def _apply_tool_guardrails(self, tool_name: str, arguments: Dict[str, Any]) -> t
         })
         return arguments, error_msg
 
-    def _sandbox_available(self) -> bool:
-        """Return whether an explicit SandboxProvider is mounted for this agent."""
-        context = getattr(getattr(self, "runtime", None), "context", None)
-        for provider in self.capability_registry.list(context):
-            if provider.get("name") == "sandbox":
-                return True
-            if any(
-                str(capability.get("name", "")).startswith("sandbox.")
-                for capability in provider.get("capabilities", [])
-            ):
-                return True
-        return False
-
     def _prepare_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> tuple[Dict[str, Any], str | None]:
         cancellation_error = self._current_cancellation_error("before_tool_call")
         if cancellation_error:
@@ -1274,10 +1262,12 @@ def _prepare_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> tuple
             execute=True,
             risk=CapabilityRisk.SENSITIVE,
             cancellable=True,
-            requires_sandbox=tool_name in UNSAFE_PYTHON_TOOL_NAMES,
+            requires_sandbox=is_unsafe_python_tool(
+                tool_name, self.tool_registry.function_mappings.get(tool_name),
+            ),
         )
-        if spec.requires_sandbox and not self._sandbox_available():
-            reason = f"tool `{tool_name}` requires an explicit SandboxProvider"
+        if spec.requires_sandbox:
+            reason = UNSAFE_PYTHON_TOOL_REASON
             self._record_session_event("policy.decision", {
                 "provider": "tools",
                 "capability": spec.name,
```

**File**: `LightAgent/tools.py` (modified, +3/-0)
```diff
@@ -17,6 +17,7 @@
 from typing import List, Dict, Any, Callable, Union, Generator, AsyncGenerator
 
 from .errors import format_error_code, format_lightagent_error
+from .builtin_tools.python_executor import UNSAFE_PYTHON_TOOL_REASON, is_unsafe_python_tool
 
 
 _TOOL_NAME_PATTERN = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
@@ -262,6 +263,8 @@ async def dispatch(self, tool_name: str, tool_params: Dict[str, Any]) -> Union[
             return format_error_code("LA-TOOL", f"Tool `{tool_name}` not found.")
 
         tool_call = self.function_mappings[tool_name]
+        if is_unsafe_python_tool(tool_name, tool_call):
+            return format_error_code("LA-SANDBOX", UNSAFE_PYTHON_TOOL_REASON)
         validation_error = self._validate_tool_params(tool_name, tool_params)
         if validation_error:
             return validation_error
```

**File**: `README.md` (modified, +6/-4)
```diff
@@ -130,10 +130,12 @@ from LightAgent import safe_expression
 print(safe_expression("45 * 9827"))
 ```
 
-Enabling `execute_python_code`, `execute_python_file`, or
-`execute_python_code_stream` requires `enable_unsafe_python=True` and an
-explicit `SandboxProvider`. The executor remains a controlled subprocess, not
-a security sandbox; see [Python Executor Security](docs/python_executor_security.md).
+Legacy `execute_python_code`, `execute_python_file`, and
+`execute_python_code_stream` are blocked in model and dispatcher invocation,
+including with `enable_unsafe_python=True` or a registered `SandboxProvider`.
+Trusted application code may call them directly under its own isolation
+controls. Use a custom sandbox-backed tool for agent code execution; see
+[Python Executor Security](docs/python_executor_security.md).
 
 ### Evaluate And Review High-Risk Actions
 
```

**File**: `README.zh-CN.md` (modified, +5/-3)
```diff
@@ -146,9 +146,11 @@ from LightAgent import safe_expression
 print(safe_expression("45 * 9827"))
 ```
 
-启用 `execute_python_code`、`execute_python_file` 或
-`execute_python_code_stream` 需要设置 `enable_unsafe_python=True`，并注册显式
-的 `SandboxProvider`。执行器只是受控子进程，并不是安全沙箱；详见
+旧的 `execute_python_code`、`execute_python_file` 和
+`execute_python_code_stream` 不允许通过模型或工具调度器执行，设置
+`enable_unsafe_python=True` 或注册 `SandboxProvider` 也不会解除阻断。
+可信应用代码仍可在自行隔离的环境中直接调用；Agent 执行代码应使用真正委托给
+沙箱的自定义工具。详见
 [Python 执行器安全说明](docs/python_executor_security.md)。
 
 ### 评测并审核高风险动作
```

**File**: `docs/python_executor_security.md` (modified, +10/-3)
```diff
@@ -3,8 +3,13 @@
 `execute_python_code`, `execute_python_file`, and
 `execute_python_code_stream` are controlled utilities, not security sandboxes.
 As of v0.10.1, these arbitrary-code tools are not registered by default on a
-`LightAgent`. They require explicit `enable_unsafe_python=True` opt-in and an
-explicit `SandboxProvider` before a model tool call is allowed.
+`LightAgent`. The registration-only compatibility flag
+`enable_unsafe_python=True` does not authorize execution. Model tool calls,
+`AsyncToolDispatcher`, and `ToolProviderAdapter` now reject these legacy tools
+with `LA-SANDBOX`, even when a `SandboxProvider` is registered or started.
+Provider registration does not route the legacy subprocess through isolation.
+Direct calls from trusted application code remain available, but require
+application-managed isolation; they are not safe for untrusted input.
 
 For arithmetic and data-only calculations, use the default `safe_expression`
 tool or the `evaluate_safe_expression()` API. It evaluates a bounded AST
@@ -26,7 +31,9 @@ AST filtering is defense in depth. Python introspection and dynamic behavior
 cannot be made fully safe with a static denylist. New bypasses may exist, and
 accepted code can still consume CPU, memory, disk, or allowed network APIs.
 The `enable_unsafe_python` switch is an explicit compatibility opt-in, not a
-security boundary; arbitrary code must run inside a real SandboxProvider.
+security boundary. To execute arbitrary code, supply a custom tool whose own
+implementation delegates to a real isolated worker or SandboxProvider.
+LightAgent does not ship an isolated execution route for the legacy utilities.
 
 ### Production Controls
 
```

**File**: `docs/tools.md` (modified, +8/-5)
```diff
@@ -376,7 +376,7 @@ are loaded.
 ### Built-in Tools
 
 LightAgent automatically registers safe built-in tools at startup. Arbitrary
-Python execution tools require explicit opt-in:
+Python execution utilities and safe calculation:
 
 | Tool Name | Description |
 | --- | --- |
@@ -387,10 +387,13 @@ Python execution tools require explicit opt-in:
 | `upload_file_to_oss` | Upload a file to object storage (OSS); requires optional `boto3`. |
 
 `safe_expression` and `upload_file_to_oss` are registered by default. The
-arbitrary Python tools are disabled by default in v0.10.1. To register them,
-pass `enable_unsafe_python=True` and mount an explicit capability provider named
-`sandbox` (or one exposing a `sandbox.*` capability); otherwise model tool calls
-are rejected with `LA-SANDBOX`.
+arbitrary Python tools are disabled by default in v0.10.1.
+`enable_unsafe_python=True` retains registration compatibility only: model tool
+calls and dispatcher/provider invocation of these legacy utilities fail closed
+with `LA-SANDBOX`, regardless of sandbox provider registration or lifecycle.
+Trusted applications may call the utilities directly under their own isolation
+controls. For agent execution, supply a custom tool that actually delegates to
+an isolated worker or SandboxProvider; registration alone is not isolation.
 
 The Python executor utilities use an AST denylist and a temporary working
 directory, but they are not security sandboxes. Review the
```

**File**: `roadmap.md` (modified, +4/-1)
```diff
@@ -156,7 +156,10 @@ Immediate security-governance work:
   `safe_expression` replacement. Keep the public tracker open until the private
   Security Advisory confirms the affected configuration/version range and
   reporter attribution. The compatibility executor remains a controlled
-  subprocess, not a security sandbox.
+  subprocess, not a security sandbox. Follow-up hardening blocks legacy
+  executors in model, dispatcher, and tool-provider invocation, even with a
+  registered sandbox provider; direct trusted application calls remain under
+  application-managed isolation. Private Vulnerability Reporting is enabled.
 
 P1 security validation work:
 
```

---

### Incident Patch 9: `f0677050` (2026-09-30)
**Commit Message**: Merge remote-tracking branch 'origin/main' into codex/fix-pr95-clean-depth

**File**: `LightAgent/__init__.py` (modified, +50/-0)
```diff
@@ -118,6 +118,33 @@
     WebProvider,
     WorkflowProvider,
 )
+from .security import (
+    APPROVAL_TOKEN_SCHEMA_VERSION,
+    PROVIDER_MANIFEST_SCHEMA_VERSION,
+    SECURITY_CONTEXT_SCHEMA_VERSION,
+    ApprovalToken,
+    CapabilityGate,
+    ProviderManifest,
+    SecurityContext,
+    canonical_digest,
+)
+from .dag import (
+    DAG_SCHEMA_VERSION,
+    CallableVerifier,
+    DAGConfig,
+    DAGError,
+    DAGRunResult,
+    DAGRunStatus,
+    DAGTaskStatus,
+    DecompositionProposal,
+    LightDAG,
+    LightDAGProvider,
+    LocalArtifactStore,
+    SqliteTaskGraphStore,
+    TaskOutcome,
+    TaskSpec,
+    VerificationVerdict,
+)
 from .runtime import (
     AgentInbox,
     AgentRuntime,
@@ -274,6 +301,29 @@
     "CapabilityRegistry",
     "ToolProviderAdapter",
     "MemoryProviderAdapter",
+    "SECURITY_CONTEXT_SCHEMA_VERSION",
+    "APPROVAL_TOKEN_SCHEMA_VERSION",
+    "PROVIDER_MANIFEST_SCHEMA_VERSION",
+    "SecurityContext",
+    "ApprovalToken",
+    "ProviderManifest",
+    "CapabilityGate",
+    "canonical_digest",
+    "DAG_SCHEMA_VERSION",
+    "DAGConfig",
+    "DAGError",
+    "DAGRunStatus",
+    "DAGTaskStatus",
+    "DAGRunResult",
+    "TaskSpec",
+    "TaskOutcome",
+    "DecompositionProposal",
+    "VerificationVerdict",
+    "SqliteTaskGraphStore",
+    "LocalArtifactStore",
+    "CallableVerifier",
+    "LightDAGProvider",
+    "LightDAG",
     "InboxMessageType",
     "InboxMessageStatus",
     "InboxMessage",
```

**File**: `LightAgent/capabilities.py` (modified, +37/-7)
```diff
@@ -78,9 +78,14 @@ class RuntimeContext:
     session_id: str | None = None
     agent_id: str | None = None
     user_id: str | None = None
+    tenant_id: str | None = None
+    project_id: str | None = None
     turn_id: str | None = None
     run_id: str | None = None
+    task_id: str | None = None
+    attempt_id: str | None = None
     permissions: "PermissionSet | None" = None
+    security_context: Any = None
     metadata: dict[str, Any] = field(default_factory=dict)
 
 
@@ -425,6 +430,7 @@ def conflicts(self) -> list[dict[str, Any]]:
         return deepcopy(self._conflicts)
 
     async def mount(self, context: RuntimeContext) -> None:
+        context = self._runtime_context(context)
         for item in self._matching(context):
             await item.provider.mount(context)
             await item.provider.start()
@@ -452,7 +458,7 @@ async def unregister(
         return bool(matches)
 
     def resolve(self, capability: str, context: RuntimeContext | None = None) -> CapabilityProvider:
-        runtime_context = context or RuntimeContext()
+        runtime_context = self._runtime_context(context)
         matches = [
             item for item in self._matching(runtime_context)
             if capability in item.provider.capabilities
@@ -463,15 +469,15 @@ def resolve(self, capability: str, context: RuntimeContext | None = None) -> Cap
         return matches[0].provider
 
     def get(self, name: str, context: RuntimeContext | None = None) -> CapabilityProvider:
-        matches = [item for item in self._matching(context or RuntimeContext()) if item.provider.name == name]
+        matches = [item for item in self._matching(self._runtime_context(context)) if item.provider.name == name]
         if not matches:
             raise LookupError(f"provider `{name}` is not registered")
         matches.sort(key=lambda item: (self._precedence[item.scope], item.order), reverse=True)
         return matches[0].provider
 
     def list(self, context: RuntimeContext | None = None) -> list[dict[str, Any]]:
         values = []
-        for item in self._matching(context or RuntimeContext()):
+        for item in self._matching(self._runtime_context(context)):
             values.append({
                 "name": item.provider.name,
                 "version": item.provider.version,
@@ -483,7 +489,7 @@ def list(self, context: RuntimeContext | None = None) -> list[dict[str, Any]]:
 
     async def health(self, context: RuntimeContext | None = None) -> dict[str, ProviderHealth]:
         result = {}
-        for item in self._matching(context or RuntimeContext()):
+        for item in self._matching(self._runtime_context(context)):
             result[item.provider.name] = await item.provider.health()
         return result
 
@@ -492,19 +498,32 @@ async def reload(self, name: str, config: dict[str, Any], context: RuntimeContex
         await provider.reload(config)
 
     async def stop(self, context: RuntimeContext | None = None) -> None:
-        for item in reversed(self._matching(context or RuntimeContext())):
+        runtime_context = self._runtime_context(context)
+        for item in reversed(self._matching(runtime_context)):
             await item.provider.stop()
             await item.provider.unmount()
-            self._audit("provider.stopped", item, context=context)
+            self._audit("provider.stopped", item, context=runtime_context)
 
     async def invoke(
             self,
             capability: str,
             arguments: dict[str, Any] | None = None,
             *,
             context: RuntimeContext | None = None,
+            approval_token: Any = None,
+            resource: str | None = None,
     ) -> Any:
-        runtime_context = context or RuntimeContext()
+        if context is not None and hasattr(context, "to_runtime_context"):
+            from .security import CapabilityGate
+
+            return await CapabilityGate(self).invoke(
+                capability,
+                arguments,
+                context,
+                approval_token=approval_token,
+                resource=resource,
+            )
+        runtime_context = self._runtime_context(context)
         provider = self.resolve(capability, runtime_context)
         spec = provider.capabilities[capability]
         decision = await self.policy_engine.evaluate(PolicyRequest(
@@ -532,6 +551,17 @@ async def invoke(
             result = str(result)[:spec.output_limit]
         return result
 
+    @staticmethod
+    def _runtime_context(context: Any = None) -> RuntimeContext:
+        if context is None:
+            return RuntimeContext()
+        if isinstance(context, RuntimeContext):
+            return context
+        to_runtime = getattr(context, "to_runtime_context", None)
+        if callable(to_runtime):
+            return to_runtime()
+        raise TypeError("context must be RuntimeContext or SecurityContext")
+
     def _matching(self, context: RuntimeContext) -> list[ProviderRe
```

**File**: `LightAgent/dag/__init__.py` (added, +88/-0)
```diff
@@ -0,0 +1,88 @@
+"""Experimental persistent Dynamic DAG runtime for LightAgent."""
+
+from .artifacts import ArtifactStore, LocalArtifactStore
+from .context import ContextBuilder, DAGContextBudget
+from .graph import dependency_closure, topological_order
+from .models import (
+    DAG_SCHEMA_VERSION,
+    AssuranceLevel,
+    ArtifactManifest,
+    DAGAttemptStatus,
+    DAGConfig,
+    DAGEvent,
+    DAGRun,
+    DAGRunResult,
+    DAGRunStatus,
+    DAGTask,
+    DAGTaskStatus,
+    DecompositionProposal,
+    TaskAttempt,
+    TaskContext,
+    TaskDependency,
+    TaskOutcome,
+    TaskOutcomeKind,
+    TaskSpec,
+    TaskState,
+    VerificationReport,
+    VerificationRequest,
+    VerificationVerdict,
+)
+from .provider import LightDAGProvider
+from .scheduler import LightDAG
+from .store import DAGError, SqliteTaskGraphStore, TaskGraphStore
+from .verification import CallableVerifier, Verifier
+from .worker import (
+    CallableWorker,
+    DAGWorker,
+    DAGWorkerProtocolError,
+    LightAgentWorkerAdapter,
+    RegistryWorkerFactory,
+    WorkerFactory,
+    normalize_task_outcome,
+)
+
+
+__all__ = [
+    "DAG_SCHEMA_VERSION",
+    "DAGError",
+    "DAGRunStatus",
+    "DAGTaskStatus",
+    "DAGAttemptStatus",
+    "VerificationVerdict",
+    "AssuranceLevel",
+    "TaskOutcomeKind",
+    "DAGConfig",
+    "TaskSpec",
+    "TaskState",
+    "DAGTask",
+    "DAGRun",
+    "TaskDependency",
+    "TaskAttempt",
+    "DecompositionProposal",
+    "ArtifactManifest",
+    "VerificationReport",
+    "DAGEvent",
+    "TaskContext",
+    "TaskOutcome",
+    "VerificationRequest",
+    "DAGRunResult",
+    "TaskGraphStore",
+    "SqliteTaskGraphStore",
+    "ArtifactStore",
+    "LocalArtifactStore",
+    "Verifier",
+    "CallableVerifier",
+    "DAGWorker",
+    "WorkerFactory",
+    "CallableWorker",
+    "RegistryWorkerFactory",
+    "LightAgentWorkerAdapter",
+    "DAGWorkerProtocolError",
+    "normalize_task_outcome",
+    "DAGContextBudget",
+    "ContextBuilder",
+    "topological_order",
+    "dependency_closure",
+    "LightDAGProvider",
+    "LightDAG",
+]
```

**File**: `LightAgent/dag/artifacts.py` (added, +159/-0)
```diff
@@ -0,0 +1,159 @@
+"""Content-addressed local artifact storage for verified DAG outputs."""
+
+from __future__ import annotations
+
+import hashlib
+import os
+import tempfile
+from pathlib import Path
+from typing import Any, Iterable, Protocol
+
+from ..security import SecurityContext
+from .models import ArtifactManifest, DAGRun, DAGTask, TaskAttempt
+from .store import DAGError
+
+
+class ArtifactStore(Protocol):
+    def stage(
+            self,
+            content: bytes | str,
+            *,
+            run: DAGRun,
+            task: DAGTask,
+            attempt: TaskAttempt,
+            media_type: str = "text/plain",
+            dependency_manifest: dict[str, list[str]] | None = None,
+    ) -> ArtifactManifest:
+        ...
+
+    def read(
+            self,
+            manifest: ArtifactManifest,
+            context: SecurityContext,
+            *,
+            require_published: bool = True,
+    ) -> bytes:
+        ...
+
+
+class LocalArtifactStore:
+    """Write immutable blobs first; SQLite controls staged/published authority."""
+
+    def __init__(self, root: str | Path, *, max_artifact_bytes: int = 10 * 1024 * 1024):
+        if max_artifact_bytes <= 0:
+            raise ValueError("max_artifact_bytes must be positive")
+        self.root = Path(root).expanduser().resolve()
+        self.root.mkdir(parents=True, exist_ok=True)
+        self.max_artifact_bytes = max_artifact_bytes
+
+    def stage(
+            self,
+            content: bytes | str,
+            *,
+            run: DAGRun,
+            task: DAGTask,
+            attempt: TaskAttempt,
+            media_type: str = "text/plain",
+            dependency_manifest: dict[str, list[str]] | None = None,
+    ) -> ArtifactManifest:
+        payload = content.encode("utf-8") if isinstance(content, str) else bytes(content)
+        if len(payload) > self.max_artifact_bytes:
+            raise DAGError("BUDGET-EXHAUSTED", "artifact exceeds max_artifact_bytes")
+        digest = hashlib.sha256(payload).hexdigest()
+        relative = Path(run.tenant_id) / run.project_id / digest[:2] / digest
+        destination = self._resolve(relative)
+        destination.parent.mkdir(parents=True, exist_ok=True)
+        if destination.exists():
+            if destination.is_symlink() or self._digest_file(destination) != digest:
+                raise DAGError("ARTIFACT-INTEGRITY", "existing artifact bytes do not match the content hash")
+        else:
+            descriptor, temporary_name = tempfile.mkstemp(prefix=f".{digest}.", dir=destination.parent)
+            temporary = Path(temporary_name)
+            try:
+                with os.fdopen(descriptor, "wb") as stream:
+                    stream.write(payload)
+                    stream.flush()
+                    os.fsync(stream.fileno())
+                os.replace(temporary, destination)
+            finally:
+                if temporary.exists():
+                    temporary.unlink()
+        return ArtifactManifest(
+            run_id=run.run_id,
+            task_id=task.spec.task_id,
+            attempt_id=attempt.attempt_id,
+            tenant_id=run.tenant_id,
+            project_id=run.project_id,
+            content_hash=digest,
+            relative_blob_path=relative.as_posix(),
+            media_type=media_type,
+            byte_size=len(payload),
+            contract_hash=task.spec.contract_hash,
+            dependency_manifest=dependency_manifest or {},
+        )
+
+    def read(
+            self,
+            manifest: ArtifactManifest,
+            context: SecurityContext,
+            *,
+            require_published: bool = True,
+    ) -> bytes:
+        if context.tenant_id != manifest.tenant_id or context.project_id != manifest.project_id:
+            raise PermissionError("artifact is outside the tenant/project security context")
+        if require_published and manifest.state != "published":
+            raise PermissionError("staged artifacts are not readable as trusted results")
+        path = self._resolve(Path(manifest.relative_blob_path))
+        if not path.is_file() or path.is_symlink():
+            raise DAGError("ARTIFACT-INTEGRITY", "artifact blob is missing or not a regular file")
+        payload = path.read_bytes()
+        if len(payload) != manifest.byte_size or hashlib.sha256(payload).hexdigest() != manifest.content_hash:
+            raise DAGError("ARTIFACT-INTEGRITY", "artifact content failed integrity verification")
+        return payload
+
+    def check_integrity(self, manifest: ArtifactManifest) -> bool:
+        try:
+            path = self._resolve(Path(manifest.relative_blob_path))
+            return (
+                path.is_file()
+                and not path.is_symlink()
+                and path.stat().st_size == manifest.byte_size
+                and self._digest_file(path) == manifest.content_hash
+            )
+        except (OSError, DAGError):
+            return False
+
+    def 
```

**File**: `LightAgent/dag/context.py` (added, +76/-0)
```diff
@@ -0,0 +1,76 @@
+"""Bounded local context construction for one DAG task attempt."""
+
+from __future__ import annotations
+
+import json
+from dataclasses import dataclass
+from typing import Any, Callable, Iterable
+
+from .models import ArtifactManifest, DAGTask, TaskAttempt
+from .store import DAGError
+
+
+@dataclass(frozen=True)
+class DAGContextBudget:
+    max_chars: int = 32_000
+    max_dependency_artifacts: int = 32
+    max_retrieval_results: int = 8
+
+    def __post_init__(self) -> None:
+        if min(self.max_chars, self.max_dependency_artifacts, self.max_retrieval_results) <= 0:
+            raise ValueError("DAG context limits must be positive")
+
+
+class ContextBuilder:
+    """Keep mandatory contracts intact and trim only optional retrieval data."""
+
+    def __init__(
+            self,
+            *,
+            budget: DAGContextBudget | None = None,
+            retrieve: Callable[[str, int], Iterable[Any]] | None = None,
+    ):
+        self.budget = budget or DAGContextBudget()
+        self.retrieve = retrieve
+
+    def build(
+            self,
+            task: DAGTask,
+            attempt: TaskAttempt,
+            dependency_artifacts: dict[str, tuple[ArtifactManifest, ...]],
+    ) -> dict[str, Any]:
+        flattened = [
+            artifact
+            for task_id in sorted(dependency_artifacts)
+            for artifact in dependency_artifacts[task_id]
+        ]
+        if len(flattened) > self.budget.max_dependency_artifacts:
+            raise DAGError("CONTEXT-OVERFLOW", "required dependency artifacts exceed the context budget")
+        mandatory = {
+            "task_id": task.spec.task_id,
+            "goal": task.spec.goal,
+            "acceptance_contract": task.spec.acceptance_contract,
+            "contract_hash": task.spec.contract_hash,
+            "phase": attempt.phase,
+            "input_snapshot_hash": attempt.input_snapshot_hash,
+            "dependencies": {
+                task_id: [artifact.to_dict() for artifact in artifacts]
+                for task_id, artifacts in dependency_artifacts.items()
+            },
+            "last_diagnostic": task.state.last_diagnostic,
+        }
+        mandatory_size = len(json.dumps(mandatory, ensure_ascii=False, default=repr))
+        if mandatory_size > self.budget.max_chars:
+            raise DAGError("CONTEXT-OVERFLOW", "mandatory task contract does not fit the context budget")
+        retrieval = []
+        if self.retrieve:
+            for item in self.retrieve(task.spec.goal, self.budget.max_retrieval_results):
+                candidate = [*retrieval, item]
+                payload = {**mandatory, "retrieval": candidate}
+                if len(json.dumps(payload, ensure_ascii=False, default=repr)) > self.budget.max_chars:
+                    break
+                retrieval = candidate
+        return {**mandatory, "retrieval": retrieval}
+
+
+__all__ = ["DAGContextBudget", "ContextBuilder"]
```

**File**: `LightAgent/dag/graph.py` (added, +53/-0)
```diff
@@ -0,0 +1,53 @@
+"""Dependency graph algorithms that avoid Python recursion limits."""
+
+from __future__ import annotations
+
+from collections import deque
+from typing import Iterable
+
+from .store import DAGError
+
+
+def topological_order(task_ids: Iterable[str], edges: Iterable[tuple[str, str]]) -> list[str]:
+    nodes = set(task_ids)
+    edge_set = set(edges)
+    unknown = sorted({item for edge in edge_set for item in edge if item not in nodes})
+    if unknown:
+        raise DAGError("UNKNOWN-DEPENDENCY", f"unknown task IDs: {unknown}")
+    if any(task_id == dependency_id for task_id, dependency_id in edge_set):
+        raise DAGError("CYCLE", "self dependencies are not allowed")
+    indegree = {task_id: 0 for task_id in nodes}
+    reverse: dict[str, list[str]] = {task_id: [] for task_id in nodes}
+    for task_id, dependency_id in edge_set:
+        indegree[task_id] += 1
+        reverse[dependency_id].append(task_id)
+    ready = deque(sorted(task_id for task_id, degree in indegree.items() if degree == 0))
+    ordered = []
+    while ready:
+        current = ready.popleft()
+        ordered.append(current)
+        for dependent in sorted(reverse[current]):
+            indegree[dependent] -= 1
+            if indegree[dependent] == 0:
+                ready.append(dependent)
+    if len(ordered) != len(nodes):
+        raise DAGError("CYCLE", "task dependencies contain a cycle")
+    return ordered
+
+
+def dependency_closure(task_id: str, edges: Iterable[tuple[str, str]]) -> set[str]:
+    dependencies: dict[str, list[str]] = {}
+    for task, dependency in edges:
+        dependencies.setdefault(task, []).append(dependency)
+    seen: set[str] = set()
+    pending = list(dependencies.get(task_id, ()))
+    while pending:
+        current = pending.pop()
+        if current in seen:
+            continue
+        seen.add(current)
+        pending.extend(dependencies.get(current, ()))
+    return seen
+
+
+__all__ = ["topological_order", "dependency_closure"]
```

**File**: `LightAgent/dag/models.py` (added, +496/-0)
```diff
@@ -0,0 +1,496 @@
+"""Versioned public data contracts for the experimental LightDAG runtime."""
+
+from __future__ import annotations
+
+from copy import deepcopy
+from dataclasses import asdict, dataclass, field, replace
+from datetime import datetime, timezone
+from enum import Enum
+from typing import Any, Mapping
+from uuid import uuid4
+
+from ..security import SecurityContext, canonical_digest
+
+
+DAG_SCHEMA_VERSION = 1
+
+
+def utc_now() -> str:
+    return datetime.now(timezone.utc).isoformat()
+
+
+class DAGRunStatus(str, Enum):
+    RUNNING = "running"
+    PAUSED = "paused"
+    BLOCKED = "blocked"
+    SUCCEEDED = "succeeded"
+    FAILED = "failed"
+    CANCELLED = "cancelled"
+
+
+class DAGTaskStatus(str, Enum):
+    READY = "ready"
+    RUNNING = "running"
+    VERIFYING = "verifying"
+    WAITING_DEPENDENCIES = "waiting_dependencies"
+    RETRY_WAIT = "retry_wait"
+    WAITING_APPROVAL = "waiting_approval"
+    BLOCKED = "blocked"
+    VERIFIED = "verified"
+    FAILED = "failed"
+    CANCELLED = "cancelled"
+    SUPERSEDED = "superseded"
+
+
+class DAGAttemptStatus(str, Enum):
+    CLAIMED = "claimed"
+    RUNNING = "running"
+    SUBMITTED = "submitted"
+    SUCCEEDED = "succeeded"
+    FAILED = "failed"
+    EXPIRED = "expired"
+    CANCELLED = "cancelled"
+
+
+class VerificationVerdict(str, Enum):
+    PASS = "pass"
+    FAIL = "fail"
+    INCONCLUSIVE = "inconclusive"
+    ERROR = "error"
+
+
+class AssuranceLevel(str, Enum):
+    FORMAL = "formal"
+    EXECUTABLE_CHECKS = "executable_checks"
+    HUMAN_REVIEW = "human_review"
+
+
+class TaskOutcomeKind(str, Enum):
+    CANDIDATE = "candidate"
+    DECOMPOSITION = "decomposition"
+    BLOCKED = "blocked"
+
+
+@dataclass(frozen=True)
+class DAGConfig:
+    max_tasks: int = 1000
+    max_edges: int = 3000
+    max_decomposition_depth: int = 8
+    max_attempts_per_task: int = 3
+    max_decompositions_per_task: int = 1
+    max_concurrency: int = 4
+    verification_concurrency: int = 4
+    max_pending_verifications: int = 16
+    max_artifact_bytes: int = 10 * 1024 * 1024
+    scheduler_lease_seconds: float = 60.0
+    task_lease_seconds: float = 60.0
+    failure_policy: str = "continue_independent"
+    schema_version: int = DAG_SCHEMA_VERSION
+
+    def __post_init__(self) -> None:
+        positive = (
+            "max_tasks",
+            "max_edges",
+            "max_decomposition_depth",
+            "max_attempts_per_task",
+            "max_decompositions_per_task",
+            "max_concurrency",
+            "verification_concurrency",
+            "max_pending_verifications",
+            "max_artifact_bytes",
+            "scheduler_lease_seconds",
+            "task_lease_seconds",
+        )
+        for name in positive:
+            if getattr(self, name) <= 0:
+                raise ValueError(f"{name} must be positive")
+        if self.failure_policy not in {"continue_independent", "fail_fast"}:
+            raise ValueError("failure_policy must be continue_independent or fail_fast")
+
+    def to_dict(self) -> dict[str, Any]:
+        return asdict(self)
+
+
+@dataclass(frozen=True)
+class TaskSpec:
+    goal: str
+    acceptance_contract: Any
+    worker_key: str
+    verifier_key: str
+    task_id: str = field(default_factory=lambda: uuid4().hex)
+    decomposer_key: str | None = None
+    depends_on: tuple[str, ...] = field(default_factory=tuple)
+    resource_requirements: tuple[str, ...] = field(default_factory=tuple)
+    created_by_task_id: str | None = None
+    supersedes_task_id: str | None = None
+    priority: int = 0
+    metadata: Mapping[str, Any] = field(default_factory=dict)
+    contract_hash: str = ""
+    schema_version: int = DAG_SCHEMA_VERSION
+
+    def __post_init__(self) -> None:
+        if not self.goal.strip():
+            raise ValueError("TaskSpec.goal must not be empty")
+        if not self.worker_key.strip() or not self.verifier_key.strip():
+            raise ValueError("TaskSpec worker_key and verifier_key must not be empty")
+        if self.task_id in self.depends_on:
+            raise ValueError("a task cannot depend on itself")
+        object.__setattr__(self, "depends_on", tuple(dict.fromkeys(self.depends_on)))
+        object.__setattr__(self, "resource_requirements", tuple(dict.fromkeys(self.resource_requirements)))
+        object.__setattr__(self, "metadata", deepcopy(dict(self.metadata)))
+        expected_contract_hash = canonical_digest(self.acceptance_contract)
+        if self.contract_hash and self.contract_hash != expected_contract_hash:
+            raise ValueError("TaskSpec.contract_hash does not match acceptance_contract")
+        object.__setattr__(self, "contract_hash", expected_contract_hash)
+
+    def to_dict(self) -> dict[str, Any]:
+        return {
+            **asdict(self),
+            "depends_on": list(self.depends_on),
+            "resource_requirements": list(self.resource_requirements),
+            "metadata": deepcopy(dict(self.metadata
```

**File**: `LightAgent/dag/provider.py` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+"""Capability Provider adapter for LightDAG control and inspection."""
+
+from __future__ import annotations
+
+from typing import Any
+
+from ..capabilities import BaseCapabilityProvider, CapabilityRisk, CapabilitySpec
+
+
+class LightDAGProvider(BaseCapabilityProvider):
+    name = "lightdag"
+    version = "1"
+
+    def __init__(self, dag: Any):
+        self.dag = dag
+        super().__init__([
+            CapabilitySpec("workflow.dag.get_run", read=True),
+            CapabilitySpec("workflow.dag.list_tasks", read=True),
+            CapabilitySpec("workflow.dag.events", read=True),
+            CapabilitySpec(
+                "workflow.dag.pause",
+                write=True,
+                persistent=True,
+                risk=CapabilityRisk.SENSITIVE,
+                requires_approval=True,
+            ),
+            CapabilitySpec(
+                "workflow.dag.cancel",
+                write=True,
+                persistent=True,
+                risk=CapabilityRisk.DESTRUCTIVE,
+                requires_approval=True,
+            ),
+        ])
+
+    async def invoke(self, capability: str, **arguments: Any) -> Any:
+        run_id = arguments["run_id"]
+        if capability == "workflow.dag.get_run":
+            value = self.dag.get_run(run_id)
+            return value.to_dict() if value else None
+        if capability == "workflow.dag.list_tasks":
+            return [task.to_dict() for task in self.dag.list_tasks(run_id)]
+        if capability == "workflow.dag.events":
+            return [
+                event.to_dict()
+                for event in self.dag.events(
+                    run_id,
+                    after=int(arguments.get("after", 0)),
+                    limit=int(arguments.get("limit", 100)),
+                )
+            ]
+        if capability == "workflow.dag.pause":
+            return self.dag.pause(run_id, arguments.get("reason")).to_dict()
+        if capability == "workflow.dag.cancel":
+            return self.dag.cancel(run_id, arguments.get("reason")).to_dict()
+        raise LookupError(capability)
+
+
+__all__ = ["LightDAGProvider"]
```

---

### Incident Patch 10: `d2a740b1` (2026-09-30)
**Commit Message**: Merge remote-tracking branch 'origin/main' into codex/security-executor-fail-closed

**File**: `LightAgent/tools.py` (modified, +10/-13)
```diff
@@ -253,8 +253,12 @@ def __init__(self, function_mappings: Dict[str, Callable] = None, function_info:
         self.function_info = function_info or {}
 
     async def dispatch(self, tool_name: str, tool_params: Dict[str, Any]) -> Union[
-        str, Generator[str, None, None], AsyncGenerator[str, None]]:
-        """调用工具执行，支持同步/异步工具及流式输出"""
+        str, Generator[str, None, None]]:
+        """调用工具执行，支持同步/异步工具及流式输出。
+
+        异步生成器工具的结果在 dispatch 内收集并序列化为 str 返回；
+        同步生成器工具透传 Generator，由调用方消费以支持流式输出。
+        """
         if tool_name not in self.function_mappings:
             return format_error_code("LA-TOOL", f"Tool `{tool_name}` not found.")
 
@@ -269,19 +273,12 @@ async def dispatch(self, tool_name: str, tool_params: Dict[str, Any]) -> Union[
             if inspect.iscoroutinefunction(tool_call):
                 # 异步函数 - 直接 await 获取结果
                 result = await tool_call(**tool_params)
-            # elif inspect.isasyncgenfunction(tool_call):
-                # 异步生成器 - 需要收集所有结果
-                # result = []
-                # async for chunk in tool_call(**tool_params):
-                #     result.append(chunk)
-                # # 如果只有一个结果，直接返回；否则返回列表
-                # if len(result) == 1:
-                #     result = result[0]
             elif inspect.isasyncgenfunction(tool_call):
-                # 返回异步生成器对象，不做消费
-                return tool_call(**tool_params)
+                # 异步生成器 - 收集所有结果（AsyncGenerator 无法由同步调用链消费）
+                chunks = [chunk async for chunk in tool_call(**tool_params)]
+                result = chunks[0] if len(chunks) == 1 else "".join(str(c) for c in chunks)
             elif inspect.isgeneratorfunction(tool_call):
-                # 同步生成器 - 收集所有结果
+                # 同步生成器 - 透传，由调用方消费（支持流式输出）
                 return tool_call(**tool_params)
                 # result = list(tool_call(**tool_params))
                 # if len(result) == 1:
```

**File**: `docs/tools.md` (modified, +33/-8)
```diff
@@ -291,9 +291,9 @@ fetch_news.tool_info = {
 
 ### Streaming Tools
 
-Tools that return Python generators (synchronous) or async generators work with
-the streaming execution path. When the model calls a streaming tool in
-streaming mode, chunks are yielded as they are produced:
+Tools that return Python generators (synchronous) work with the streaming
+execution path. When the model calls a streaming tool in streaming mode,
+chunks are yielded as they are produced:
 
 ```python
 from typing import Generator
@@ -317,8 +317,9 @@ stream_results.tool_info = {
 }
 ```
 
-For async generators, the dispatcher returns the generator object directly
-without consuming it, allowing the caller to iterate at its own pace.
+Async generator tools are consumed by the dispatcher: all chunks are collected
+inside `dispatch()` and returned as a single serialized result. Only
+synchronous generator tools are passed through for chunk-by-chunk streaming.
 
 ### Dynamic Tool Loading
 
@@ -414,8 +415,8 @@ object-storage tool.
 ### MCP Integration
 
 LightAgent supports the Model Context Protocol (MCP) for connecting to external
-tool servers. MCP servers can provide tools over stdio or SSE (Server-Sent
-Events) transports.
+tool servers. MCP servers can provide tools over stdio, SSE (Server-Sent
+Events), or Streamable HTTP transports.
 
 #### Configuration
 
@@ -455,13 +456,37 @@ async def setup():
 asyncio.run(setup())
 ```
 
+#### Streamable HTTP
+
+For a Streamable HTTP endpoint, add an entry like this to `mcp_config` before
+calling `setup()`. Choose an unused server name to preserve existing entries:
+
+```python
+import os
+
+mcp_config["mcpServers"]["remote-http"] = {
+    "transport": "streamable-http",
+    "url": "https://mcp.example.com/mcp",
+    "headers": {"Authorization": "Bearer " + os.environ["MCP_API_TOKEN"]},
+}
+```
+
+Set `transport` explicitly: a server with a `url` but no transport selector
+uses SSE. The aliases `streamable_http` and `http` also select Streamable HTTP.
+The installed MCP SDK must provide `mcp.client.streamable_http.streamablehttp_client`;
+otherwise this transport reports that the installed SDK does not support it.
+
+Header values are sent literally. In this example, Python reads the environment
+variable; LightAgent does not expand environment placeholders inside the header.
+Keep real credentials out of source files, command-line arguments, and logs.
+
 #### How MCP Tool Registration Works
 
 The `MCPClientManager` connects to each configured server, lists available
 tools via the MCP `list_tools` request, and registers them into the agent's
 `ToolRegistry`:
 
-1. For each enabled server, a session is created (stdio or SSE).
+1. For each enabled server, a session is created (stdio, SSE, or Streamable HTTP).
 2. Tools are fetched using `session.list_tools()`.
 3. Each tool's name, description, and parameter schema are converted to the
    `tool_info` format and registered.
```

**File**: `tests/test_asyncgen_tool_dispatch.py` (added, +266/-0)
```diff
@@ -0,0 +1,266 @@
+"""Regression tests for async-generator tool consumption in AsyncToolDispatcher.
+
+dispatch() must collect async-generator results and return a serialized str;
+only synchronous generator tools are passed through for chunked streaming.
+"""
+import asyncio
+import json
+from types import SimpleNamespace
+
+from LightAgent import AsyncToolDispatcher, LightAgent
+
+
+def make_agent(**kwargs):
+    return LightAgent(
+        model="gpt-4o-mini",
+        api_key="test-key",
+        base_url="http://127.0.0.1:9/v1",
+        auto_discover_skills=False,
+        **kwargs,
+    )
+
+
+def attach_client(agent, completions):
+    agent.client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
+    return completions
+
+
+def tool_messages_of(params):
+    return [m for m in params.get("messages", []) if isinstance(m, dict) and m.get("role") == "tool"]
+
+
+side_effects = []
+
+
+def reset_effects():
+    side_effects.clear()
+
+
+async def async_gen_tool():
+    side_effects.append("entered")
+    for i in range(3):
+        yield f"chunk-{i}"
+
+
+async_gen_tool.tool_info = {
+    "tool_name": "async_gen_tool",
+    "tool_description": "async generator tool",
+    "tool_params": [],
+}
+
+
+async def async_gen_single_dict_tool():
+    side_effects.append("entered")
+    yield {"answer": 42}
+
+
+async_gen_single_dict_tool.tool_info = {
+    "tool_name": "async_gen_single_dict_tool",
+    "tool_description": "async generator yielding one dict",
+    "tool_params": [],
+}
+
+
+async def async_gen_empty_tool():
+    side_effects.append("entered")
+    return
+    yield  # unreachable; makes this an async generator function
+
+
+async_gen_empty_tool.tool_info = {
+    "tool_name": "async_gen_empty_tool",
+    "tool_description": "async generator yielding nothing",
+    "tool_params": [],
+}
+
+
+def sync_gen_tool():
+    side_effects.append("entered")
+    for i in range(3):
+        yield f"chunk-{i}"
+
+
+sync_gen_tool.tool_info = {
+    "tool_name": "sync_gen_tool",
+    "tool_description": "sync generator tool",
+    "tool_params": [],
+}
+
+
+async def async_plain_tool():
+    side_effects.append("ran")
+    return "async-plain-result"
+
+
+async_plain_tool.tool_info = {
+    "tool_name": "async_plain_tool",
+    "tool_description": "plain async function tool",
+    "tool_params": [],
+}
+
+
+class TwoStepCompletions:
+    """First create() returns a tool call, second returns a plain reply."""
+
+    def __init__(self, tool_name, tool_args=None):
+        self.tool_name = tool_name
+        self.tool_args = tool_args or {}
+        self.calls = []
+
+    def create(self, **params):
+        self.calls.append(params)
+        if len(self.calls) == 1:
+            tool_call = SimpleNamespace(
+                id="call_1",
+                function=SimpleNamespace(
+                    name=self.tool_name,
+                    arguments=json.dumps(self.tool_args),
+                ),
+            )
+            message = SimpleNamespace(content=None, tool_calls=[tool_call])
+            return SimpleNamespace(choices=[SimpleNamespace(message=message)])
+        message = SimpleNamespace(content="final-reply", tool_calls=None)
+        return SimpleNamespace(choices=[SimpleNamespace(message=message)])
+
+
+def _delta_chunk(content=None, finish_reason=None):
+    return SimpleNamespace(choices=[SimpleNamespace(
+        delta=SimpleNamespace(reasoning_content=None, content=content, tool_calls=None),
+        finish_reason=finish_reason,
+    )])
+
+
+class TwoStepStreamCompletions:
+    """First create() returns tool-call deltas, second returns content deltas."""
+
+    def __init__(self, tool_name, tool_args=None):
+        self.tool_name = tool_name
+        self.tool_args = tool_args or {}
+        self.calls = []
+
+    def create(self, **params):
+        self.calls.append(params)
+        if len(self.calls) == 1:
+            tool_call = SimpleNamespace(
+                index=0, id="call_1",
+                function=SimpleNamespace(
+                    name=self.tool_name,
+                    arguments=json.dumps(self.tool_args),
+                ),
+            )
+            delta = SimpleNamespace(reasoning_content=None, content=None, tool_calls=[tool_call])
+            return iter([
+                SimpleNamespace(choices=[SimpleNamespace(delta=delta, finish_reason=None)]),
+                _delta_chunk(finish_reason="tool_calls"),
+            ])
+        return iter([_delta_chunk("final-reply"), _delta_chunk(finish_reason="stop")])
+
+
+def test_dispatch_collects_asyncgen_tool():
+    reset_effects()
+    dispatcher = AsyncToolDispatcher(
+        {"async_gen_tool": async_gen_tool},
+        {"async_gen_tool": async_gen_tool.tool_info},
+    )
+
+    result = asyncio.run(dispatcher.dispatch("async_gen_tool", {}))
+
+    assert result == "chunk-0chunk-1chunk-2"
+    assert side_effects == ["entered"]
+
+
+def test_dispatch_serializes_single_dict_chunk():
+    reset_
```

---

### Incident Patch 11: `eba9eb45` (2026-09-30)
**Commit Message**: fix: fail closed for legacy Python tool dispatch

**File**: `LightAgent/builtin_tools/python_executor.py` (modified, +16/-0)
```diff
@@ -16,6 +16,7 @@
 import traceback
 import re
 import ast
+import inspect
 from typing import Dict, Any, List, Optional, Union, Tuple
 
 
@@ -42,6 +43,21 @@
     "execute_python_file",
     "execute_python_code_stream",
 })
+UNSAFE_PYTHON_TOOL_REASON = (
+    "Legacy Python execution tools have no isolated execution route and are "
+    "blocked in tool dispatch. Registering a SandboxProvider does not isolate "
+    "them. Use safe_expression or a custom tool backed by a real sandbox."
+)
+
+
+def is_unsafe_python_tool(tool_name: str, tool_call: Any = None) -> bool:
+    if tool_name in UNSAFE_PYTHON_TOOL_NAMES:
+        return True
+    if tool_call is None:
+        return False
+    return inspect.unwrap(tool_call) in (
+        execute_python_code, execute_python_file, execute_python_code_stream,
+    )
 
 
 def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
```

**File**: `LightAgent/core.py` (modified, +11/-21)
```diff
@@ -67,7 +67,8 @@
     execute_python_code,
     execute_python_file,
     execute_python_code_stream,
-    UNSAFE_PYTHON_TOOL_NAMES,
+    UNSAFE_PYTHON_TOOL_REASON,
+    is_unsafe_python_tool,
 )
 from .builtin_tools.nos import upload_file_to_oss
 from .builtin_tools.safe_expression import safe_expression
@@ -134,7 +135,7 @@ def __init__(
             filter_tools: bool = True,  # 是否启用工具过滤
             self_learning: bool = False,  # 是否启用agent自我学习
             tools: List[Union[str, Callable]] = None,  # 支持工具混合输入
-            enable_unsafe_python: bool = False,  # 显式启用需沙箱的任意 Python 执行工具
+            enable_unsafe_python: bool = False,  # 兼容注册；旧执行器不能由模型调度
             skills_directories: List[str] = None,  # 支持技能混合输入
             auto_discover_skills: bool = True,  # 是否自动发现技能
             input_guardrails: List[Callable[..., Any]] | None = None,  # 输入安全策略
@@ -172,7 +173,7 @@ def __init__(
         :param tot_base_url: API 的基础 URL。
         :param filter_tools: 是否启用工具过滤。
         :param tools: 工具列表，支持函数名称（字符串）或函数对象。
-        :param enable_unsafe_python: 是否显式注册任意 Python 执行工具；启用后仍要求 SandboxProvider。
+        :param enable_unsafe_python: 是否兼容注册旧 Python 执行工具；模型调度始终阻断，应用可直接调用。
         :param input_guardrails: 输入安全策略列表，返回 False、原因字符串、dict 或 GuardrailDecision 可阻止运行。
         :param tool_guardrails: 工具调用安全策略列表，返回 False、原因字符串、dict 或 GuardrailDecision 可阻止工具执行。
         :param output_guardrails: 输出安全策略列表，返回 False、原因字符串、dict 或 GuardrailDecision 可阻止非流式输出。
@@ -263,8 +264,8 @@ def __init__(
             self.load_tools(self.tools)
 
         # Safe expression evaluation is available by default. Arbitrary Python
-        # execution is opt-in and is rejected later unless a SandboxProvider is
-        # registered for the current runtime.
+        # registration is retained for compatibility, but tool dispatch stays
+        # blocked until an actual isolated execution route is implemented.
         builtin_tools = [safe_expression, upload_file_to_oss]
         if enable_unsafe_python:
             builtin_tools.extend([
@@ -1251,19 +1252,6 @@ def _apply_tool_guardrails(self, tool_name: str, arguments: Dict[str, Any]) -> t
         })
         return arguments, error_msg
 
-    def _sandbox_available(self) -> bool:
-        """Return whether an explicit SandboxProvider is mounted for this agent."""
-        context = getattr(getattr(self, "runtime", None), "context", None)
-        for provider in self.capability_registry.list(context):
-            if provider.get("name") == "sandbox":
-                return True
-            if any(
-                str(capability.get("name", "")).startswith("sandbox.")
-                for capability in provider.get("capabilities", [])
-            ):
-                return True
-        return False
-
     def _prepare_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> tuple[Dict[str, Any], str | None]:
         cancellation_error = self._current_cancellation_error("before_tool_call")
         if cancellation_error:
@@ -1274,10 +1262,12 @@ def _prepare_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> tuple
             execute=True,
             risk=CapabilityRisk.SENSITIVE,
             cancellable=True,
-            requires_sandbox=tool_name in UNSAFE_PYTHON_TOOL_NAMES,
+            requires_sandbox=is_unsafe_python_tool(
+                tool_name, self.tool_registry.function_mappings.get(tool_name),
+            ),
         )
-        if spec.requires_sandbox and not self._sandbox_available():
-            reason = f"tool `{tool_name}` requires an explicit SandboxProvider"
+        if spec.requires_sandbox:
+            reason = UNSAFE_PYTHON_TOOL_REASON
             self._record_session_event("policy.decision", {
                 "provider": "tools",
                 "capability": spec.name,
```

**File**: `LightAgent/tools.py` (modified, +3/-0)
```diff
@@ -17,6 +17,7 @@
 from typing import List, Dict, Any, Callable, Union, Generator, AsyncGenerator
 
 from .errors import format_error_code, format_lightagent_error
+from .builtin_tools.python_executor import UNSAFE_PYTHON_TOOL_REASON, is_unsafe_python_tool
 
 
 _TOOL_NAME_PATTERN = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")
@@ -258,6 +259,8 @@ async def dispatch(self, tool_name: str, tool_params: Dict[str, Any]) -> Union[
             return format_error_code("LA-TOOL", f"Tool `{tool_name}` not found.")
 
         tool_call = self.function_mappings[tool_name]
+        if is_unsafe_python_tool(tool_name, tool_call):
+            return format_error_code("LA-SANDBOX", UNSAFE_PYTHON_TOOL_REASON)
         validation_error = self._validate_tool_params(tool_name, tool_params)
         if validation_error:
             return validation_error
```

**File**: `README.md` (modified, +6/-4)
```diff
@@ -130,10 +130,12 @@ from LightAgent import safe_expression
 print(safe_expression("45 * 9827"))
 ```
 
-Enabling `execute_python_code`, `execute_python_file`, or
-`execute_python_code_stream` requires `enable_unsafe_python=True` and an
-explicit `SandboxProvider`. The executor remains a controlled subprocess, not
-a security sandbox; see [Python Executor Security](docs/python_executor_security.md).
+Legacy `execute_python_code`, `execute_python_file`, and
+`execute_python_code_stream` are blocked in model and dispatcher invocation,
+including with `enable_unsafe_python=True` or a registered `SandboxProvider`.
+Trusted application code may call them directly under its own isolation
+controls. Use a custom sandbox-backed tool for agent code execution; see
+[Python Executor Security](docs/python_executor_security.md).
 
 ### Evaluate And Review High-Risk Actions
 
```

**File**: `README.zh-CN.md` (modified, +5/-3)
```diff
@@ -146,9 +146,11 @@ from LightAgent import safe_expression
 print(safe_expression("45 * 9827"))
 ```
 
-启用 `execute_python_code`、`execute_python_file` 或
-`execute_python_code_stream` 需要设置 `enable_unsafe_python=True`，并注册显式
-的 `SandboxProvider`。执行器只是受控子进程，并不是安全沙箱；详见
+旧的 `execute_python_code`、`execute_python_file` 和
+`execute_python_code_stream` 不允许通过模型或工具调度器执行，设置
+`enable_unsafe_python=True` 或注册 `SandboxProvider` 也不会解除阻断。
+可信应用代码仍可在自行隔离的环境中直接调用；Agent 执行代码应使用真正委托给
+沙箱的自定义工具。详见
 [Python 执行器安全说明](docs/python_executor_security.md)。
 
 ### 评测并审核高风险动作
```

**File**: `docs/python_executor_security.md` (modified, +10/-3)
```diff
@@ -3,8 +3,13 @@
 `execute_python_code`, `execute_python_file`, and
 `execute_python_code_stream` are controlled utilities, not security sandboxes.
 As of v0.10.1, these arbitrary-code tools are not registered by default on a
-`LightAgent`. They require explicit `enable_unsafe_python=True` opt-in and an
-explicit `SandboxProvider` before a model tool call is allowed.
+`LightAgent`. The registration-only compatibility flag
+`enable_unsafe_python=True` does not authorize execution. Model tool calls,
+`AsyncToolDispatcher`, and `ToolProviderAdapter` now reject these legacy tools
+with `LA-SANDBOX`, even when a `SandboxProvider` is registered or started.
+Provider registration does not route the legacy subprocess through isolation.
+Direct calls from trusted application code remain available, but require
+application-managed isolation; they are not safe for untrusted input.
 
 For arithmetic and data-only calculations, use the default `safe_expression`
 tool or the `evaluate_safe_expression()` API. It evaluates a bounded AST
@@ -26,7 +31,9 @@ AST filtering is defense in depth. Python introspection and dynamic behavior
 cannot be made fully safe with a static denylist. New bypasses may exist, and
 accepted code can still consume CPU, memory, disk, or allowed network APIs.
 The `enable_unsafe_python` switch is an explicit compatibility opt-in, not a
-security boundary; arbitrary code must run inside a real SandboxProvider.
+security boundary. To execute arbitrary code, supply a custom tool whose own
+implementation delegates to a real isolated worker or SandboxProvider.
+LightAgent does not ship an isolated execution route for the legacy utilities.
 
 ### Production Controls
 
```

**File**: `docs/tools.md` (modified, +8/-5)
```diff
@@ -375,7 +375,7 @@ are loaded.
 ### Built-in Tools
 
 LightAgent automatically registers safe built-in tools at startup. Arbitrary
-Python execution tools require explicit opt-in:
+Python execution utilities and safe calculation:
 
 | Tool Name | Description |
 | --- | --- |
@@ -386,10 +386,13 @@ Python execution tools require explicit opt-in:
 | `upload_file_to_oss` | Upload a file to object storage (OSS); requires optional `boto3`. |
 
 `safe_expression` and `upload_file_to_oss` are registered by default. The
-arbitrary Python tools are disabled by default in v0.10.1. To register them,
-pass `enable_unsafe_python=True` and mount an explicit capability provider named
-`sandbox` (or one exposing a `sandbox.*` capability); otherwise model tool calls
-are rejected with `LA-SANDBOX`.
+arbitrary Python tools are disabled by default in v0.10.1.
+`enable_unsafe_python=True` retains registration compatibility only: model tool
+calls and dispatcher/provider invocation of these legacy utilities fail closed
+with `LA-SANDBOX`, regardless of sandbox provider registration or lifecycle.
+Trusted applications may call the utilities directly under their own isolation
+controls. For agent execution, supply a custom tool that actually delegates to
+an isolated worker or SandboxProvider; registration alone is not isolation.
 
 The Python executor utilities use an AST denylist and a temporary working
 directory, but they are not security sandboxes. Review the
```

**File**: `roadmap.md` (modified, +4/-1)
```diff
@@ -156,7 +156,10 @@ Immediate security-governance work:
   `safe_expression` replacement. Keep the public tracker open until the private
   Security Advisory confirms the affected configuration/version range and
   reporter attribution. The compatibility executor remains a controlled
-  subprocess, not a security sandbox.
+  subprocess, not a security sandbox. Follow-up hardening blocks legacy
+  executors in model, dispatcher, and tool-provider invocation, even with a
+  registered sandbox provider; direct trusted application calls remain under
+  application-managed isolation. Private Vulnerability Reporting is enabled.
 
 P1 security validation work:
 
```

---

### Incident Patch 12: `72f6ce15` (2026-09-30)
**Commit Message**: Merge pull request #108 from long6177/fix/asyncgen-tool-consumption

fix: consume async-generator tools in AsyncToolDispatcher

**File**: `LightAgent/tools.py` (modified, +10/-13)
```diff
@@ -252,8 +252,12 @@ def __init__(self, function_mappings: Dict[str, Callable] = None, function_info:
         self.function_info = function_info or {}
 
     async def dispatch(self, tool_name: str, tool_params: Dict[str, Any]) -> Union[
-        str, Generator[str, None, None], AsyncGenerator[str, None]]:
-        """调用工具执行，支持同步/异步工具及流式输出"""
+        str, Generator[str, None, None]]:
+        """调用工具执行，支持同步/异步工具及流式输出。
+
+        异步生成器工具的结果在 dispatch 内收集并序列化为 str 返回；
+        同步生成器工具透传 Generator，由调用方消费以支持流式输出。
+        """
         if tool_name not in self.function_mappings:
             return format_error_code("LA-TOOL", f"Tool `{tool_name}` not found.")
 
@@ -266,19 +270,12 @@ async def dispatch(self, tool_name: str, tool_params: Dict[str, Any]) -> Union[
             if inspect.iscoroutinefunction(tool_call):
                 # 异步函数 - 直接 await 获取结果
                 result = await tool_call(**tool_params)
-            # elif inspect.isasyncgenfunction(tool_call):
-                # 异步生成器 - 需要收集所有结果
-                # result = []
-                # async for chunk in tool_call(**tool_params):
-                #     result.append(chunk)
-                # # 如果只有一个结果，直接返回；否则返回列表
-                # if len(result) == 1:
-                #     result = result[0]
             elif inspect.isasyncgenfunction(tool_call):
-                # 返回异步生成器对象，不做消费
-                return tool_call(**tool_params)
+                # 异步生成器 - 收集所有结果（AsyncGenerator 无法由同步调用链消费）
+                chunks = [chunk async for chunk in tool_call(**tool_params)]
+                result = chunks[0] if len(chunks) == 1 else "".join(str(c) for c in chunks)
             elif inspect.isgeneratorfunction(tool_call):
-                # 同步生成器 - 收集所有结果
+                # 同步生成器 - 透传，由调用方消费（支持流式输出）
                 return tool_call(**tool_params)
                 # result = list(tool_call(**tool_params))
                 # if len(result) == 1:
```

**File**: `docs/tools.md` (modified, +6/-5)
```diff
@@ -291,9 +291,9 @@ fetch_news.tool_info = {
 
 ### Streaming Tools
 
-Tools that return Python generators (synchronous) or async generators work with
-the streaming execution path. When the model calls a streaming tool in
-streaming mode, chunks are yielded as they are produced:
+Tools that return Python generators (synchronous) work with the streaming
+execution path. When the model calls a streaming tool in streaming mode,
+chunks are yielded as they are produced:
 
 ```python
 from typing import Generator
@@ -317,8 +317,9 @@ stream_results.tool_info = {
 }
 ```
 
-For async generators, the dispatcher returns the generator object directly
-without consuming it, allowing the caller to iterate at its own pace.
+Async generator tools are consumed by the dispatcher: all chunks are collected
+inside `dispatch()` and returned as a single serialized result. Only
+synchronous generator tools are passed through for chunk-by-chunk streaming.
 
 ### Dynamic Tool Loading
 
```

**File**: `tests/test_asyncgen_tool_dispatch.py` (added, +266/-0)
```diff
@@ -0,0 +1,266 @@
+"""Regression tests for async-generator tool consumption in AsyncToolDispatcher.
+
+dispatch() must collect async-generator results and return a serialized str;
+only synchronous generator tools are passed through for chunked streaming.
+"""
+import asyncio
+import json
+from types import SimpleNamespace
+
+from LightAgent import AsyncToolDispatcher, LightAgent
+
+
+def make_agent(**kwargs):
+    return LightAgent(
+        model="gpt-4o-mini",
+        api_key="test-key",
+        base_url="http://127.0.0.1:9/v1",
+        auto_discover_skills=False,
+        **kwargs,
+    )
+
+
+def attach_client(agent, completions):
+    agent.client = SimpleNamespace(chat=SimpleNamespace(completions=completions))
+    return completions
+
+
+def tool_messages_of(params):
+    return [m for m in params.get("messages", []) if isinstance(m, dict) and m.get("role") == "tool"]
+
+
+side_effects = []
+
+
+def reset_effects():
+    side_effects.clear()
+
+
+async def async_gen_tool():
+    side_effects.append("entered")
+    for i in range(3):
+        yield f"chunk-{i}"
+
+
+async_gen_tool.tool_info = {
+    "tool_name": "async_gen_tool",
+    "tool_description": "async generator tool",
+    "tool_params": [],
+}
+
+
+async def async_gen_single_dict_tool():
+    side_effects.append("entered")
+    yield {"answer": 42}
+
+
+async_gen_single_dict_tool.tool_info = {
+    "tool_name": "async_gen_single_dict_tool",
+    "tool_description": "async generator yielding one dict",
+    "tool_params": [],
+}
+
+
+async def async_gen_empty_tool():
+    side_effects.append("entered")
+    return
+    yield  # unreachable; makes this an async generator function
+
+
+async_gen_empty_tool.tool_info = {
+    "tool_name": "async_gen_empty_tool",
+    "tool_description": "async generator yielding nothing",
+    "tool_params": [],
+}
+
+
+def sync_gen_tool():
+    side_effects.append("entered")
+    for i in range(3):
+        yield f"chunk-{i}"
+
+
+sync_gen_tool.tool_info = {
+    "tool_name": "sync_gen_tool",
+    "tool_description": "sync generator tool",
+    "tool_params": [],
+}
+
+
+async def async_plain_tool():
+    side_effects.append("ran")
+    return "async-plain-result"
+
+
+async_plain_tool.tool_info = {
+    "tool_name": "async_plain_tool",
+    "tool_description": "plain async function tool",
+    "tool_params": [],
+}
+
+
+class TwoStepCompletions:
+    """First create() returns a tool call, second returns a plain reply."""
+
+    def __init__(self, tool_name, tool_args=None):
+        self.tool_name = tool_name
+        self.tool_args = tool_args or {}
+        self.calls = []
+
+    def create(self, **params):
+        self.calls.append(params)
+        if len(self.calls) == 1:
+            tool_call = SimpleNamespace(
+                id="call_1",
+                function=SimpleNamespace(
+                    name=self.tool_name,
+                    arguments=json.dumps(self.tool_args),
+                ),
+            )
+            message = SimpleNamespace(content=None, tool_calls=[tool_call])
+            return SimpleNamespace(choices=[SimpleNamespace(message=message)])
+        message = SimpleNamespace(content="final-reply", tool_calls=None)
+        return SimpleNamespace(choices=[SimpleNamespace(message=message)])
+
+
+def _delta_chunk(content=None, finish_reason=None):
+    return SimpleNamespace(choices=[SimpleNamespace(
+        delta=SimpleNamespace(reasoning_content=None, content=content, tool_calls=None),
+        finish_reason=finish_reason,
+    )])
+
+
+class TwoStepStreamCompletions:
+    """First create() returns tool-call deltas, second returns content deltas."""
+
+    def __init__(self, tool_name, tool_args=None):
+        self.tool_name = tool_name
+        self.tool_args = tool_args or {}
+        self.calls = []
+
+    def create(self, **params):
+        self.calls.append(params)
+        if len(self.calls) == 1:
+            tool_call = SimpleNamespace(
+                index=0, id="call_1",
+                function=SimpleNamespace(
+                    name=self.tool_name,
+                    arguments=json.dumps(self.tool_args),
+                ),
+            )
+            delta = SimpleNamespace(reasoning_content=None, content=None, tool_calls=[tool_call])
+            return iter([
+                SimpleNamespace(choices=[SimpleNamespace(delta=delta, finish_reason=None)]),
+                _delta_chunk(finish_reason="tool_calls"),
+            ])
+        return iter([_delta_chunk("final-reply"), _delta_chunk(finish_reason="stop")])
+
+
+def test_dispatch_collects_asyncgen_tool():
+    reset_effects()
+    dispatcher = AsyncToolDispatcher(
+        {"async_gen_tool": async_gen_tool},
+        {"async_gen_tool": async_gen_tool.tool_info},
+    )
+
+    result = asyncio.run(dispatcher.dispatch("async_gen_tool", {}))
+
+    assert result == "chunk-0chunk-1chunk-2"
+    assert side_effects == ["entered"]
+
+
+def test_dispatch_serializes_single_dict_chunk():
+    reset_
```

---

### Incident Patch 13: `e7469a40` (2026-09-20)
**Commit Message**: feat: add optional Memcode memory adapter

**File**: `README.md` (modified, +2/-0)
```diff
@@ -178,6 +178,8 @@ For lightweight shared memory experiments, see [SharedMemoryPool](docs/shared_me
 
 For optional ClawMem long-term memory adapter setup, see [ClawMem Memory Adapter](docs/clawmem_memory_adapter.md).
 
+For an optional, user-scoped Memcode v2 adapter with offline fake-client tests, see [Memcode Memory Adapter](docs/memcode_memory_adapter.md).
+
 For memory write admission, expiration-aware retrieval, and low-quality memory write blocking, see [Memory Admission And Mutation Controls](docs/memory_admission.md).
 
 For separating trace, user memory, self-reflection memory, and LightSwarm delegation state, see [Memory, Trace, And Swarm Boundaries](docs/memory_trace_swarm_boundaries.md).
```

**File**: `docs/memcode_memory_adapter.md` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+## Memcode Memory Adapter Example
+
+LightAgent can use Memcode as an optional long-term-memory backend through its
+existing `store(data, user_id)` / `retrieve(query, user_id)` protocol. The
+example adapter is dependency-free at import time: applications inject a
+`MemcodeV2Client` from the optional `memcode-sdk` package, while tests use a
+fake client and make no network requests.
+
+### Install and configure
+
+```bash
+pip install memcode-sdk
+```
+
+Keep credentials outside source control:
+
+```bash
+export MEMCODE_API_URL=https://memory.memcode.in
+export MEMCODE_API_KEY=your-integration-key
+```
+
+Each LightAgent user must map to a pre-provisioned Memcode space. The adapter
+does not invent, share, or fall back to a default space:
+
+```python
+from memcode_sdk import MemcodeV2Client
+
+from LightAgent import LightAgent, MemoryPolicy
+from example.memcode_memory_adapter import MemcodeMemoryAdapter
+
+
+client = MemcodeV2Client()
+spaces = {
+    "tenant-a:alice": "space-for-alice",
+    "tenant-a:bob": "space-for-bob",
+}
+
+memory = MemcodeMemoryAdapter(
+    client,
+    space_id_for_user=spaces.__getitem__,
+    actor_id_for_user=lambda user_id: user_id,
+    agent_name="support-agent",
+)
+
+agent = LightAgent(
+    name="support-agent",
+    model="gpt-4.1",
+    api_key="your_model_api_key",
+    base_url="your_model_base_url",
+    memory=memory,
+    memory_policy=MemoryPolicy(
+        namespace="tenant-a",
+        allow_unattributed_results=False,
+        allowed_sources=("user",),
+        allowed_scopes=("user",),
+        allowed_agent_names=("support-agent",),
+    ),
+)
+```
+
+### Security and lifecycle behavior
+
+- The application owns API-key or OAuth storage. The adapter never reads a
+  credential at import time and never returns credentials to the agent.
+- `space_id_for_user` and `actor_id_for_user` are evaluated for every call.
+  Empty mappings fail before any provider request.
+- Writes preserve LightAgent provenance metadata. Server-owned integration
+  attribution fields are rejected instead of being forwarded or spoofed.
+- Reads use `context_only` scope and then require both the requested Memcode
+  space and exact `metadata.user_id`; missing or mismatched provenance is
+  dropped before `MemoryPolicy` sees it.
+- Provider, authentication, and network failures propagate to the caller. The
+  adapter does not fall back to another user, tenant, or global search.
+- Memcode ingestion is durable and asynchronous. `store()` returns the job ID
+  and initial status; applications that require ready-before-read semantics
+  should poll with `client.get_ingest_status(job_id)`.
+- Retention is configured in Memcode. LightAgent's current memory protocol has
+  no delete method, and the v2 SDK adapter deliberately does not simulate one;
+  use the authorized Memcode lifecycle API or console for deletion/forgetting.
+
+The SDK assigns integration attribution server-side. Do not add
+`integration_id`, `integration_channel`, `attribution_status`, or
+`attribution_basis` to memory metadata.
```

**File**: `example/memcode_memory_adapter.py` (added, +218/-0)
```diff
@@ -0,0 +1,218 @@
+#!/usr/bin/env python
+# -*- coding: utf-8 -*-
+
+"""Optional Memcode v2 memory adapter for LightAgent.
+
+The adapter accepts an injected ``MemcodeV2Client``-compatible object so
+LightAgent does not gain a mandatory SDK dependency or perform network work at
+import time. Applications remain responsible for credentials and for mapping
+each LightAgent user to a pre-provisioned Memcode space.
+"""
+
+from __future__ import annotations
+
+import hashlib
+import json
+from collections.abc import Callable
+from typing import Any
+
+_RESERVED_ATTRIBUTION_FIELDS = {
+    "integration_id",
+    "integration_channel",
+    "attribution_status",
+    "attribution_basis",
+}
+
+
+class MemcodeMemoryAdapter:
+    """Bridge LightAgent's MemoryProtocol to a tenant-bound Memcode v2 client."""
+
+    def __init__(
+            self,
+            client: Any,
+            *,
+            space_id_for_user: Callable[[str], str],
+            actor_id_for_user: Callable[[str], str] | None = None,
+            agent_name: str = "lightagent",
+            top_k: int = 5,
+    ):
+        if not callable(space_id_for_user):
+            raise TypeError("space_id_for_user must be callable")
+        if actor_id_for_user is not None and not callable(actor_id_for_user):
+            raise TypeError("actor_id_for_user must be callable")
+        if isinstance(top_k, bool) or not isinstance(top_k, int) or not 1 <= top_k <= 100:
+            raise ValueError("top_k must be an integer between 1 and 100")
+        self.client = client
+        self.space_id_for_user = space_id_for_user
+        self.actor_id_for_user = actor_id_for_user or (lambda user_id: user_id)
+        self.agent_name = str(agent_name)
+        self.top_k = top_k
+
+    def store(
+            self,
+            data: str,
+            user_id: str,
+            metadata: dict[str, Any] | None = None,
+    ) -> dict[str, Any]:
+        """Start a durable Memcode ingest for one explicitly scoped user."""
+        memory_user_id = self._required("user_id", user_id)
+        content = self._required("data", data)
+        space_id = self._space_id(memory_user_id)
+        actor_id = self._actor_id(memory_user_id)
+        record_metadata = {
+            "user_id": memory_user_id,
+            "source": "user",
+            "scope": "user",
+            "agent_name": self.agent_name,
+        }
+        if metadata:
+            reserved = _RESERVED_ATTRIBUTION_FIELDS.intersection(metadata)
+            if reserved:
+                fields = ", ".join(sorted(reserved))
+                raise ValueError(f"Memcode attribution metadata is server-owned: {fields}")
+            record_metadata.update(metadata)
+        record_metadata["user_id"] = memory_user_id
+        record_metadata.setdefault("source", "user")
+        record_metadata.setdefault("scope", "user")
+        record_metadata.setdefault("agent_name", self.agent_name)
+
+        result = self.client.ingest(
+            space_id=space_id,
+            actor_id=actor_id,
+            content=content,
+            idempotency_key=self._idempotency_key(
+                user_id=memory_user_id,
+                space_id=space_id,
+                content=content,
+                metadata=record_metadata,
+            ),
+            metadata=record_metadata,
+            tags=self._tags(record_metadata),
+        )
+        return {
+            "stored": True,
+            "user_id": memory_user_id,
+            "space_id": space_id,
+            "job_id": self._value(result, "id", "job_id"),
+            "status": self._value(result, "status"),
+        }
+
+    def retrieve(self, query: str, user_id: str) -> dict[str, list[dict[str, Any]]]:
+        """Return only Memcode results attributed to the requested user/space."""
+        memory_user_id = self._required("user_id", user_id)
+        normalized_query = self._required("query", query)
+        space_id = self._space_id(memory_user_id)
+        actor_id = self._actor_id(memory_user_id)
+        response = self.client.search(
+            context_space_id=space_id,
+            actor_id=actor_id,
+            query=normalized_query,
+            scope="context_only",
+            mode="memories",
+            top_k=self.top_k,
+        )
+
+        results = []
+        for item in self._value(response, "results") or []:
+            content = self._value(item, "content", "memory", "text")
+            metadata = self._value(item, "metadata")
+            item_space = self._value(self._value(item, "space"), "id")
+            if (
+                content is None
+                or not isinstance(metadata, dict)
+                or str(metadata.get("user_id", "")) != memory_user_id
+                or str(item_space or "") != space_id
+            ):
+                continue
+            results.append({
+                "memory": str(content),
+                "score": self._value(item, "score"),
+                "user_id": memory_
```

**File**: `tests/test_memcode_memory_adapter_example.py` (added, +159/-0)
```diff
@@ -0,0 +1,159 @@
+import importlib.util
+import sys
+from pathlib import Path
+from types import SimpleNamespace
+
+import pytest
+
+
+def load_example_module():
+    path = Path(__file__).resolve().parents[1] / "example" / "memcode_memory_adapter.py"
+    spec = importlib.util.spec_from_file_location("memcode_memory_adapter_example", path)
+    module = importlib.util.module_from_spec(spec)
+    assert spec.loader is not None
+    sys.modules[spec.name] = module
+    spec.loader.exec_module(module)
+    return module
+
+
+class FakeMemcodeClient:
+    def __init__(self):
+        self.ingest_calls = []
+        self.search_calls = []
+        self.search_results = []
+        self.error = None
+
+    def ingest(self, **payload):
+        if self.error:
+            raise self.error
+        self.ingest_calls.append(payload)
+        return SimpleNamespace(id="job-1", status="queued")
+
+    def search(self, **payload):
+        if self.error:
+            raise self.error
+        self.search_calls.append(payload)
+        return SimpleNamespace(results=self.search_results)
+
+
+def make_adapter(client):
+    module = load_example_module()
+    return module.MemcodeMemoryAdapter(
+        client,
+        space_id_for_user=lambda user_id: {
+            "tenant:alice": "space-alice",
+            "tenant:bob": "space-bob",
+        }[user_id],
+        actor_id_for_user=lambda user_id: f"actor:{user_id}",
+        agent_name="travel-agent",
+        top_k=3,
+    )
+
+
+def test_store_preserves_policy_metadata_and_explicit_scope():
+    client = FakeMemcodeClient()
+    adapter = make_adapter(client)
+
+    result = adapter.store(
+        "Alice prefers quiet beach towns",
+        "tenant:alice",
+        metadata={"source": "user", "scope": "user", "trace_id": "trace-1"},
+    )
+
+    call = client.ingest_calls[0]
+    assert result == {
+        "stored": True,
+        "user_id": "tenant:alice",
+        "space_id": "space-alice",
+        "job_id": "job-1",
+        "status": "queued",
+    }
+    assert call["space_id"] == "space-alice"
+    assert call["actor_id"] == "actor:tenant:alice"
+    assert call["metadata"]["user_id"] == "tenant:alice"
+    assert call["metadata"]["agent_name"] == "travel-agent"
+    assert call["metadata"]["trace_id"] == "trace-1"
+    assert call["idempotency_key"].startswith("lightagent:")
+
+
+def test_store_rejects_server_owned_attribution_metadata():
+    client = FakeMemcodeClient()
+    adapter = make_adapter(client)
+
+    with pytest.raises(ValueError, match="server-owned"):
+        adapter.store(
+            "remember this",
+            "tenant:alice",
+            metadata={"integration_id": "spoofed"},
+        )
+    assert client.ingest_calls == []
+
+
+def test_retrieve_filters_cross_user_cross_space_and_malformed_results():
+    client = FakeMemcodeClient()
+    client.search_results = [
+        SimpleNamespace(
+            content="Alice prefers quiet beach towns",
+            score=0.91,
+            metadata={"user_id": "tenant:alice", "source": "user", "scope": "user"},
+            space=SimpleNamespace(id="space-alice"),
+        ),
+        SimpleNamespace(
+            content="Bob's private preference",
+            score=0.99,
+            metadata={"user_id": "tenant:bob", "source": "user", "scope": "user"},
+            space=SimpleNamespace(id="space-alice"),
+        ),
+        SimpleNamespace(
+            content="Wrong space",
+            score=0.98,
+            metadata={"user_id": "tenant:alice", "source": "user", "scope": "user"},
+            space=SimpleNamespace(id="space-bob"),
+        ),
+        SimpleNamespace(content="Missing provenance", score=0.97, metadata={}, space=None),
+        {"score": 0.5, "metadata": {"user_id": "tenant:alice"}},
+    ]
+    adapter = make_adapter(client)
+
+    response = adapter.retrieve("quiet beach", "tenant:alice")
+
+    assert client.search_calls == [{
+        "context_space_id": "space-alice",
+        "actor_id": "actor:tenant:alice",
+        "query": "quiet beach",
+        "scope": "context_only",
+        "mode": "memories",
+        "top_k": 3,
+    }]
+    assert response["results"] == [{
+        "memory": "Alice prefers quiet beach towns",
+        "score": 0.91,
+        "user_id": "tenant:alice",
+        "metadata": {
+            "user_id": "tenant:alice",
+            "source": "user",
+            "scope": "user",
+        },
+    }]
+
+
+def test_empty_scope_mapping_fails_closed_before_provider_call():
+    module = load_example_module()
+    client = FakeMemcodeClient()
+    adapter = module.MemcodeMemoryAdapter(
+        client,
+        space_id_for_user=lambda _user_id: "",
+    )
+
+    with pytest.raises(ValueError, match="space_id is required"):
+        adapter.retrieve("hello", "tenant:alice")
+    assert client.search_calls == []
+
+
+def test_provider_errors_propagate_without_fallback():
+    client = FakeMemcodeClient()
+    client.error = RuntimeError(
```

---

### Incident Patch 14: `2e050203` (2026-09-14)
**Commit Message**: fix: harden _clean_code_string parsing boundary per review

- json.loads isolated in _try_json_loads, catching JSONDecodeError,
  TypeError, and RecursionError (deeply nested untrusted JSON) only
  at the parsing boundary
- recursive cleanup bounded by explicit _MAX_CLEAN_DEPTH
- KeyboardInterrupt/SystemExit and cleanup-logic exceptions propagate
- tests: malformed JSON, deep nesting, nested code fields, depth
  limit, process-control propagation

Co-Authored-By: Claude Fable 5 <[REDACTED_EMAIL]>
Signed-off-by: Harshad Khetpal <[REDACTED_EMAIL]>

**File**: `LightAgent/builtin_tools/python_executor.py` (modified, +35/-11)
```diff
@@ -92,16 +92,40 @@ def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
     return str(code_param)
 
 
-def _clean_code_string(code_str: str) -> str:
+# 递归清理的确定性深度上限：嵌套的JSON包装超过该深度后按原样返回。
+_MAX_CLEAN_DEPTH = 5
+
+
+def _try_json_loads(candidate: str) -> Tuple[bool, Any]:
+    """在解析边界上隔离 json.loads。
+
+    只捕获解析本身可能产生的异常（JSONDecodeError、TypeError，以及深度
+    嵌套输入触发的 RecursionError）。KeyboardInterrupt/SystemExit 与后续
+    清理逻辑的异常不在此捕获，正常向上传播。
+
+    Returns:
+        (True, 解析结果) 或 (False, None)
+    """
+    try:
+        return True, json.loads(candidate)
+    except (json.JSONDecodeError, TypeError, RecursionError):
+        return False, None
+
+
+def _clean_code_string(code_str: str, _depth: int = 0) -> str:
     """
     清理和修复代码字符串中的转义和格式问题
 
     Args:
         code_str: 原始代码字符串
+        _depth: 当前递归深度（内部参数，超过 _MAX_CLEAN_DEPTH 即停止）
 
     Returns:
         清理后的代码字符串
     """
+    if _depth >= _MAX_CLEAN_DEPTH:
+        return code_str if isinstance(code_str, str) else str(code_str)
+
     if not isinstance(code_str, str):
         code_str = str(code_str)
 
@@ -128,24 +152,24 @@ def _clean_code_string(code_str: str) -> str:
     # 步骤5: 移除可能存在的JSON包装
     # 有时代码可能被包装在JSON字符串中
     if code_str.startswith('"') and code_str.endswith('"'):
-        try:
-            code_str = json.loads(code_str)
-        except:
+        ok, unwrapped = _try_json_loads(code_str)
+        if ok:
+            code_str = unwrapped
+        else:
             code_str = code_str[1:-1]
 
     # 步骤6: 尝试解析为JSON并提取代码字段
-    try:
-        # 尝试将整个字符串解析为JSON
-        parsed = json.loads(code_str)
+    # 解析在 _try_json_loads 边界内完成；下面的清理逻辑不在任何 except
+    # 之中，其异常（包括 KeyboardInterrupt/SystemExit）正常传播。
+    ok, parsed = _try_json_loads(code_str)
+    if ok:
         if isinstance(parsed, dict):
             # 查找常见的代码字段
             code = _parse_code_parameter(parsed)
             if code != code_str:
-                return _clean_code_string(code)  # 递归清理
+                return _clean_code_string(code, _depth + 1)  # 递归清理
         elif isinstance(parsed, str):
-            return _clean_code_string(parsed)  # 递归清理
-    except:
-        pass
+            return _clean_code_string(parsed, _depth + 1)  # 递归清理
 
     return code_str
 
```

**File**: `tests/test_python_executor_clean_code.py` (added, +116/-0)
```diff
@@ -0,0 +1,116 @@
+#!/usr/bin/env python
+# -*- coding: utf-8 -*-
+
+"""Tests for _clean_code_string parsing-boundary hardening (PR #95).
+
+Covers the review checklist: malformed JSON, deeply nested JSON,
+nested code fields, the recursion depth limit, and process-control
+exception propagation.
+"""
+
+import json
+import sys
+
+import pytest
+
+from LightAgent.builtin_tools import python_executor
+from LightAgent.builtin_tools.python_executor import (
+    _MAX_CLEAN_DEPTH,
+    _clean_code_string,
+    _try_json_loads,
+)
+
+
+class TestMalformedJson:
+
+    def test_malformed_json_returns_input_unchanged(self):
+        malformed = '{"code": "print(1)"'  # missing closing brace
+        assert _clean_code_string(malformed) == malformed
+
+    def test_quoted_but_invalid_json_strips_quotes(self):
+        # startswith/endswith '"' but not valid JSON -> quote-strip fallback
+        wrapped = '"print(\'hello\')" + "'
+        result = _clean_code_string(wrapped)
+        assert result == wrapped[1:-1]
+
+    def test_plain_code_passes_through(self):
+        code = 'x = 1\nprint(x)'
+        assert _clean_code_string(code) == code
+
+
+class TestDeeplyNestedJson:
+
+    def test_deeply_nested_json_fails_softly(self):
+        # Deep enough to raise RecursionError inside json.loads on CPython.
+        depth = sys.getrecursionlimit() * 2
+        deeply_nested = '[' * depth + '1' + ']' * depth
+        # Must not raise: RecursionError is handled at the parsing boundary.
+        result = _clean_code_string(deeply_nested)
+        assert isinstance(result, str)
+
+    def test_try_json_loads_catches_recursion_error(self):
+        depth = sys.getrecursionlimit() * 2
+        ok, value = _try_json_loads('[' * depth + '1' + ']' * depth)
+        assert ok is False and value is None
+
+
+class TestNestedCodeFields:
+
+    def test_single_wrapped_code_field(self):
+        payload = json.dumps({'code': 'print(42)'})
+        assert _clean_code_string(payload) == 'print(42)'
+
+    def test_object_nested_code_field(self):
+        # Object nesting is unwrapped by _parse_code_parameter in one pass.
+        payload = json.dumps({'code': {'code': 'print(42)'}})
+        assert _clean_code_string(payload) == 'print(42)'
+
+
+class TestDepthLimit:
+
+    def test_depth_limit_terminates_endless_chain(self, monkeypatch):
+        # A parser result that always produces a fresh wrapped payload would
+        # recurse forever without the limit; with it, the call terminates
+        # after a deterministic number of unwraps.
+        calls = {'n': 0}
+
+        def endless(parsed):
+            calls['n'] += 1
+            return json.dumps({'code': 'level%d' % calls['n']})
+
+        monkeypatch.setattr(python_executor, '_parse_code_parameter', endless)
+        result = _clean_code_string(json.dumps({'code': 'x'}))
+        assert isinstance(result, str)
+        assert calls['n'] <= _MAX_CLEAN_DEPTH
+
+    def test_at_limit_returns_input(self):
+        assert _clean_code_string('anything', _depth=_MAX_CLEAN_DEPTH) == 'anything'
+
+
+class TestProcessControlPropagation:
+
+    def test_keyboard_interrupt_propagates(self, monkeypatch):
+        def raise_interrupt(*args, **kwargs):
+            raise KeyboardInterrupt
+
+        monkeypatch.setattr(python_executor.json, 'loads', raise_interrupt)
+        with pytest.raises(KeyboardInterrupt):
+            _clean_code_string('{"code": "x"}')
+
+    def test_system_exit_propagates(self, monkeypatch):
+        def raise_exit(*args, **kwargs):
+            raise SystemExit(3)
+
+        monkeypatch.setattr(python_executor.json, 'loads', raise_exit)
+        with pytest.raises(SystemExit):
+            _clean_code_string('{"code": "x"}')
+
+    def test_unrelated_cleanup_exception_propagates(self, monkeypatch):
+        # Errors raised by the cleanup logic itself (outside the parsing
+        # boundary) must not be swallowed.
+        def boom(*args, **kwargs):
+            raise ValueError('cleanup bug')
+
+        monkeypatch.setattr(python_executor, '_parse_code_parameter', boom)
+        with pytest.raises(ValueError, match='cleanup bug'):
+            _clean_code_string(json.dumps({'code': 'x'}))
```

---

### Incident Patch 15: `b070815f` (2026-08-15)
**Commit Message**: Release v0.9.7: security validation and connector contract (#88)

**File**: `.gitignore` (modified, +2/-0)
```diff
@@ -1,4 +1,6 @@
 .DS_Store
+__pycache__/
+*.py[cod]
 LightAgent/__pycache__/__init__.cpython-311.pyc
 LightAgent/__pycache__/la_core.cpython-311.pyc
 dist/
```

**File**: `LightAgent/__init__.py` (modified, +12/-0)
```diff
@@ -61,6 +61,13 @@
 from .mcp_client_manager import MCPClientManager
 from .skills import SkillManager, Skill
 from .skill_tools import create_skill_tools
+from .connectors import (
+    ConnectorDiagnostic,
+    ConnectorManifest,
+    ConnectorValidationReport,
+    ConnectorValidator,
+    validate_connector,
+)
 from .builtin_tools.python_executor import (
     execute_python_code,
     execute_python_file,
@@ -130,6 +137,11 @@
     "SkillManager",
     "Skill",
     "create_skill_tools",
+    "ConnectorDiagnostic",
+    "ConnectorManifest",
+    "ConnectorValidationReport",
+    "ConnectorValidator",
+    "validate_connector",
     "execute_python_code",
     "execute_python_file",
     "execute_python_code_stream",
```

**File**: `LightAgent/builtin_tools/python_executor.py` (modified, +156/-32)
```diff
@@ -19,6 +19,26 @@
 from typing import Dict, Any, List, Optional, Union, Tuple
 
 
+_DANGEROUS_MODULES = frozenset({
+    "__builtins__",
+    "ctypes",
+    "glob",
+    "importlib",
+    "os",
+    "pickle",
+    "pty",
+    "shelve",
+    "shutil",
+    "socket",
+    "subprocess",
+    "sys",
+})
+_DANGEROUS_BUILTINS = frozenset({"__import__", "compile", "eval", "exec", "input", "open", "raw_input"})
+_DANGEROUS_ATTRIBUTES = frozenset({"compile", "eval", "exec", "popen", "system"})
+_PROCESS_ATTRIBUTES = frozenset({"Popen", "call", "check_call", "check_output", "run"})
+_DANGEROUS_DYNAMIC_ATTRIBUTES = _DANGEROUS_BUILTINS | _DANGEROUS_ATTRIBUTES | _PROCESS_ATTRIBUTES
+
+
 def _parse_code_parameter(code_param: Union[str, Dict, Any]) -> str:
     """
     解析可能包含在各种格式中的代码参数
@@ -156,6 +176,102 @@ def _extract_code_from_text(text: str) -> str:
     return text
 
 
+def _literal_string(node: ast.AST, constants: Dict[str, str]) -> Optional[str]:
+    if isinstance(node, ast.Constant) and isinstance(node.value, str):
+        return node.value
+    if isinstance(node, ast.Name):
+        return constants.get(node.id)
+    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
+        left = _literal_string(node.left, constants)
+        right = _literal_string(node.right, constants)
+        if left is not None and right is not None:
+            return left + right
+    if isinstance(node, ast.JoinedStr):
+        parts = []
+        for value in node.values:
+            if not isinstance(value, ast.Constant) or not isinstance(value.value, str):
+                return None
+            parts.append(value.value)
+        return "".join(parts)
+    return None
+
+
+def _resolved_name(node: ast.AST, aliases: Dict[str, str], constants: Dict[str, str]) -> Optional[str]:
+    if isinstance(node, ast.Name):
+        return aliases.get(node.id, node.id)
+    if isinstance(node, ast.Attribute):
+        parent = _resolved_name(node.value, aliases, constants)
+        return f"{parent}.{node.attr}" if parent else node.attr
+    if isinstance(node, ast.Subscript):
+        parent = _resolved_name(node.value, aliases, constants)
+        key = _literal_string(node.slice, constants)
+        if parent and key:
+            return f"{parent}.{key}"
+    if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
+        dispatch_name = aliases.get(node.func.id, node.func.id).split(".")[-1]
+        if dispatch_name not in {"getattr", "attrgetter"}:
+            return None
+        attribute_index = 1 if dispatch_name == "getattr" else 0
+        if len(node.args) > attribute_index:
+            attribute = _literal_string(node.args[attribute_index], constants)
+            if attribute:
+                parent = _resolved_name(node.args[0], aliases, constants) if dispatch_name == "getattr" else "dynamic"
+                return f"{parent or 'dynamic'}.{attribute}"
+    return None
+
+
+def _dynamic_dispatch(
+        node: ast.AST,
+        aliases: Dict[str, str],
+        constants: Dict[str, str],
+) -> Optional[tuple[str, str]]:
+    if not isinstance(node, ast.Call):
+        return None
+    if isinstance(node.func, ast.Name):
+        dispatch_name = aliases.get(node.func.id, node.func.id).split(".")[-1]
+        if dispatch_name not in {"getattr", "attrgetter"}:
+            return _dynamic_dispatch(node.func, aliases, constants)
+        attribute_index = 1 if dispatch_name == "getattr" else 0
+        if len(node.args) > attribute_index:
+            attribute = _literal_string(node.args[attribute_index], constants)
+            if attribute:
+                return dispatch_name, attribute
+    return _dynamic_dispatch(node.func, aliases, constants)
+
+
+def _collect_static_bindings(tree: ast.AST) -> tuple[Dict[str, str], Dict[str, str]]:
+    aliases: Dict[str, str] = {}
+    constants: Dict[str, str] = {}
+
+    for node in ast.walk(tree):
+        if isinstance(node, ast.Import):
+            for alias in node.names:
+                aliases[alias.asname or alias.name.split(".", 1)[0]] = alias.name
+        elif isinstance(node, ast.ImportFrom) and node.module:
+            for alias in node.names:
+                aliases[alias.asname or alias.name] = f"{node.module}.{alias.name}"
+        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
+            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
+            value = node.value
+            literal = _literal_string(value, constants) if value is not None else None
+            for target in targets:
+                if isinstance(target, ast.Name) and literal is not None:
+                    constants[target.id] = literal
+
+    # Resolve callable aliases and aliases that depend on constant strings.
+    for _ in range(3):
+        for node in ast.walk(tree):
+            if not isinstance(node, (ast.Assign, ast.AnnAssign)):
+                continue
+            targets = node.targets if isinstance(node, as
```

**File**: `LightAgent/connectors.py` (added, +370/-0)
```diff
@@ -0,0 +1,370 @@
+#!/usr/bin/env python
+# -*- coding: utf-8 -*-
+
+"""Dependency-free connector manifests and offline validation utilities."""
+
+from __future__ import annotations
+
+import ast
+import inspect
+import re
+import textwrap
+from collections.abc import Mapping, Sequence
+from dataclasses import dataclass, field
+from pathlib import Path
+from typing import Any, Callable
+
+from .skills import Skill
+from .tools import ToolRegistry
+
+
+_CONNECTOR_NAME_PATTERN = re.compile(r"[A-Za-z][A-Za-z0-9._-]*")
+_VERSION_PATTERN = re.compile(r"\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?")
+_EXTRA_NAME_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*")
+_REQUIREMENT_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]*(?:\[[A-Za-z0-9,._-]+\])?(?:\s*[<>=!~].+)?")
+_SECRET_FIELD_PATTERN = re.compile(r"(?:api[_-]?key|token|secret|password|authorization)", re.IGNORECASE)
+_PLACEHOLDER_PATTERN = re.compile(r"(?:\$\{|\{\{|<[^>]+>|your[_ -]|replace[_ -]|env:)", re.IGNORECASE)
+
+_UNSAFE_IMPORT_HINTS = {
+    "ctypes": "native process access",
+    "importlib": "dynamic imports",
+    "os": "host operating-system access",
+    "pickle": "unsafe deserialization",
+    "pty": "pseudo-terminal access",
+    "shutil": "host filesystem mutation",
+    "socket": "direct network access",
+    "subprocess": "child-process execution",
+}
+_NETWORK_IMPORT_HINTS = {"aiohttp", "httpx", "requests", "urllib"}
+_HOOK_PHASES = {
+    "before_run",
+    "after_run",
+    "on_error",
+    "before_model_request",
+    "after_model_response",
+    "before_tool_call",
+    "after_tool_result",
+    "before_memory_retrieve",
+    "after_memory_retrieve",
+    "before_memory_write",
+    "after_memory_write",
+    "before_memory_promote",
+    "after_memory_promote",
+    "on_handoff",
+    "before_flow_run",
+    "after_flow_run",
+    "before_flow_step",
+    "after_flow_step",
+}
+
+
+def _as_tuple(value: Any) -> tuple[Any, ...]:
+    if value is None:
+        return ()
+    if isinstance(value, tuple):
+        return value
+    if isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
+        return tuple(value)
+    return (value,)
+
+
+@dataclass(frozen=True)
+class ConnectorManifest:
+    """Declarative bundle of existing LightAgent extension primitives.
+
+    A manifest is metadata only. Constructing or validating it never starts an
+    MCP server, imports an optional provider SDK, or invokes a tool or hook.
+    """
+
+    name: str
+    version: str
+    description: str = ""
+    tools: tuple[Callable[..., Any], ...] = ()
+    skills: tuple[Skill | str, ...] = ()
+    mcp_servers: Mapping[str, Mapping[str, Any]] = field(default_factory=dict)
+    hooks: tuple[Callable[..., Any] | Any, ...] = ()
+    memory_adapters: Mapping[str, Any] = field(default_factory=dict)
+    extras: Mapping[str, Sequence[str]] = field(default_factory=dict)
+    docs: tuple[str, ...] = ()
+
+    def __post_init__(self) -> None:
+        object.__setattr__(self, "tools", _as_tuple(self.tools))
+        object.__setattr__(self, "skills", _as_tuple(self.skills))
+        object.__setattr__(self, "hooks", _as_tuple(self.hooks))
+        object.__setattr__(self, "docs", tuple(str(item) for item in _as_tuple(self.docs)))
+
+
+@dataclass(frozen=True)
+class ConnectorDiagnostic:
+    """One offline connector validation finding."""
+
+    connector: str
+    level: str
+    field: str
+    message: str
+    component: str | None = None
+
+    def to_dict(self) -> dict[str, str]:
+        data = {
+            "connector": self.connector,
+            "level": self.level,
+            "field": self.field,
+            "message": self.message,
+        }
+        if self.component is not None:
+            data["component"] = self.component
+        return data
+
+
+@dataclass(frozen=True)
+class ConnectorValidationReport:
+    """Structured result returned by :func:`validate_connector`."""
+
+    connector: str
+    diagnostics: tuple[ConnectorDiagnostic, ...] = ()
+
+    @property
+    def valid(self) -> bool:
+        return not any(item.level == "error" for item in self.diagnostics)
+
+    @property
+    def errors(self) -> tuple[ConnectorDiagnostic, ...]:
+        return tuple(item for item in self.diagnostics if item.level == "error")
+
+    @property
+    def warnings(self) -> tuple[ConnectorDiagnostic, ...]:
+        return tuple(item for item in self.diagnostics if item.level == "warning")
+
+    def to_dict(self) -> dict[str, Any]:
+        return {
+            "connector": self.connector,
+            "valid": self.valid,
+            "diagnostics": [item.to_dict() for item in self.diagnostics],
+        }
+
+
+class ConnectorValidator:
+    """Validate a connector manifest without loading external services."""
+
+    def __init__(self, *, base_path: str | Path | None = None):
+        self.base_path = Path(base_path or ".").expanduser().resolve()
+
+    def validate(self, manifest: ConnectorManifest) -> ConnectorValidationRep
```

**File**: `LightAgent/version.py` (modified, +2/-2)
```diff
@@ -3,7 +3,7 @@
 
 """
 作者: [weego/WXAI-Team]
-最后更新: 2026-07-29
+最后更新: 2026-08-09
 """
 
-__version__ = "0.9.6"
+__version__ = "0.9.7"
```

**File**: `README.md` (modified, +6/-0)
```diff
@@ -144,8 +144,12 @@ For deterministic multi-step workflows, checkpointed run records, resume/rerun,
 
 For custom tool creation, runtime tools, ToolRegistry, ToolLoader, AsyncToolDispatcher, and MCP tool integration, see [Tools Guide](docs/tools.md).
 
+For packaging existing Tools, Skills, MCP settings, Hooks, and memory adapters into an offline-validatable extension, see [Lightweight Connectors](docs/connectors.md).
+
 For shared long-term memory or graph memory deployments, review the [Memory Security Guidance](docs/memory_security.md).
 
+For the opt-in Mem0 Graph backend security matrix and issue #39 validation boundary, see [Shared Graph Memory Security Validation](docs/security_shared_graph_memory_validation.md).
+
 For lightweight shared memory experiments, see [SharedMemoryPool](docs/shared_memory_pool.md).
 
 For optional ClawMem long-term memory adapter setup, see [ClawMem Memory Adapter](docs/clawmem_memory_adapter.md).
@@ -168,6 +172,8 @@ For deterministic regression cases, metrics, and CI guidance, see [Evaluation Ha
 
 For tool/handoff approval, durable LightFlow review, batches, and feedback, see [Human Review](docs/human_review.md).
 
+For the v1.0 stability proposal, supported Python versions, public imports, and compatibility promises, see [Public API And Compatibility Inventory](docs/public_api_compatibility.md).
+
 For browser-use integration with recent `browser-use` versions, see [browser-use Integration](docs/browser_use.md).
 
 ---
```

**File**: `docs/connectors.md` (added, +102/-0)
```diff
@@ -0,0 +1,102 @@
+## Lightweight Connector Contract
+
+LightAgent v0.9.7 provides a dependency-free connector manifest for grouping
+existing extension primitives. A connector is not a second plugin runtime and
+does not automatically install dependencies, connect to MCP servers, register
+tools, or execute hooks.
+
+### Manifest Fields
+
+| Field | Purpose |
+| --- | --- |
+| `name`, `version`, `description` | Stable connector identity and summary. |
+| `tools` | Python callables with existing `tool_info` metadata. |
+| `skills` | `Skill` objects or local directories containing `SKILL.md`. |
+| `mcp_servers` | Existing MCP server settings without the outer `mcpServers` key. |
+| `hooks` | Callables or objects implementing existing lifecycle hook phases. |
+| `memory_adapters` | Named objects implementing `store()` and `retrieve()`. |
+| `extras` | Descriptive optional dependency groups. Validation never installs them. |
+| `docs` | Local usage documents, resolved relative to a supplied base path. |
+
+### Build A Connector In 10 Minutes
+
+1. Create one or more ordinary LightAgent tools.
+2. Add optional Skills, hooks, MCP settings, or memory adapters.
+3. Put those components in a `ConnectorManifest`.
+4. Run offline validation before passing selected components to an agent.
+
+```python
+from pathlib import Path
+
+from LightAgent import ConnectorManifest, LightAgent, validate_connector
+
+
+def search_records(query: str) -> str:
+    return f"local result for: {query}"
+
+
+search_records.tool_info = {
+    "tool_name": "search_records",
+    "tool_description": "Search local records.",
+    "tool_params": [{
+        "name": "query",
+        "type": "string",
+        "description": "Search query.",
+        "required": True,
+    }],
+}
+
+connector = ConnectorManifest(
+    name="records",
+    version="1.0.0",
+    description="Local records connector.",
+    tools=[search_records],
+    docs=["README.md"],
+)
+
+report = validate_connector(connector, base_path=Path(__file__).parent)
+if not report.valid:
+    raise ValueError(report.to_dict())
+
+agent = LightAgent(
+    model="your-model",
+    api_key="your-api-key",
+    base_url="your-base-url",
+    tools=list(connector.tools),
+)
+```
+
+Applications explicitly choose what to activate. For example, pass
+`connector.hooks` to `LightAgent(..., hooks=...)`, choose one named memory
+adapter for `memory=...`, load connector Skill directories with the existing
+`SkillManager`, and wrap MCP settings as follows:
+
+```python
+await agent.setup_mcp({"mcpServers": dict(connector.mcp_servers)})
+```
+
+### Offline Diagnostics
+
+`validate_connector()` returns a `ConnectorValidationReport` with `valid`,
+`errors`, `warnings`, and `to_dict()`. It checks:
+
+- connector identity and semantic version shape;
+- tool schemas and duplicate tool names;
+- local `SKILL.md` and documentation paths;
+- MCP transport shape and credential-like literal values;
+- hook and memory-adapter protocols;
+- optional dependency declarations;
+- static source hints for process, filesystem, dynamic import, and network use.
+
+Warnings are review prompts, not proof that a connector is malicious. Static
+source inspection is incomplete and must not replace code review, dependency
+pinning, runtime authorization, network restrictions, or secret management.
+
+### Examples
+
+- `example/connectors/local_research` bundles an offline search tool and Skill.
+- `example/connectors/enterprise_api` injects a fake-by-default API client and
+  shows how optional provider transport remains application-owned.
+
+The core repository does not provide a connector marketplace, hosted runtime,
+automatic provider discovery, or automatic dependency installation.
```

**File**: `docs/memory_security.md` (modified, +4/-0)
```diff
@@ -127,6 +127,10 @@ production rollout, run an adversarial matrix that verifies:
 - the same checks pass against the exact Mem0 Graph version and storage
   configuration used in production.
 
+See [Shared Graph Memory Security Validation](security_shared_graph_memory_validation.md)
+for the default fake-backend matrix, opt-in real Mem0 Graph test, evidence to
+record, and the public/private advisory boundary.
+
 ### LightAgent Adapter Guidance
 
 Custom memory implementations passed to `LightAgent(memory=...)` should enforce
```

#### Recent Merged Pull Requests:
- **PR #113** (2026-09-30): docs: finalize v0.11.0 release notes and roadmap status (@wxai-space)
- **PR #112** (2026-09-30): feat: add Memcode adapter with policy-safe sample identity (#106) (@wxai-space)
- **PR #111** (2026-09-30): fix: complete bounded Python executor parsing (#95) (@wxai-space)
- **PR #110** (2026-09-30): fix: fail closed for legacy Python executor tool dispatch (@wxai-space)
- **PR #109** (2026-09-30): docs: describe the existing Streamable HTTP MCP configuration (@ct-jaryn)
- **PR #108** (2026-09-30): fix: consume async-generator tools in AsyncToolDispatcher (@long6177)
- **PR #106** (2026-09-30): feat: add optional Memcode memory adapter (@vivekgupta-memcode)
- **PR #105** (2026-09-30): Release v0.11.0: Dynamic DAG Multi-Agent and Unified Security Context (@wxai-space)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

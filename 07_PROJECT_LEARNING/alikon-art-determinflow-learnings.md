> **Canonical Learning Artifact**: `07_PROJECT_LEARNING/alikon-art-determinflow-learnings.md`  
> **Source**: github ([https://github.com/alikon-art/DeterminFlow](https://github.com/alikon-art/DeterminFlow))  
> **Source Version**: `8ad68863`  
> **License**: AGPL-3.0  
> **Synthesized By**: zero-clone-structural-synthesizer  
> **Timestamp**: 2026-10-27T20:01:14.453Z  
> **Learning ID**: `learn-github-alikon-art-determinflow`  
> **Pipeline Version**: `2.0.0`  
> **Status**: VERIFIED_EMPIRICAL_INTELLIGENCE  
> **Data Governance**: CLASSIFICATION: PUBLIC. Sanitized against PII/secrets.  
> **Policy Invariant**: Strictly for engineering retrieval and architecture documentation. Distillation prohibited.  

---

# Forensic Learning Record (Deep Inspection): alikon-art/DeterminFlow

> **Canonical Artifact**: `07_PROJECT_LEARNING/alikon-art-determinflow-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/alikon-art/DeterminFlow](https://github.com/alikon-art/DeterminFlow))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-27T20:01:13.837Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `alikon-art/DeterminFlow`
- **Description**: A production-oriented AI workflow runtime for building, validating, recovering, and shipping complex AI workflows as dependable services. 面向生产的 AI 工作流运行时：快速开发、验证和恢复复杂 AI 工作流，并将其稳定交付为服务。
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 938 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `desktop/scripts/render_brand_png.swift`
```
import AppKit
import Foundation

guard CommandLine.arguments.count == 3 else {
    fputs("usage: render_brand_png <svg> <png>\n", stderr)
    exit(2)
}

let src = URL(fileURLWithPath: CommandLine.arguments[1])
let dst = URL(fileURLWithPath: CommandLine.arguments[2])
guard let image = NSImage(contentsOf: src) else {
    fputs("failed to load brand SVG\n", stderr)
    exit(1)
}

let width = 1024
let height = 1024
guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: width,
    pixelsHigh: height,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
) else {
    fputs("failed to create bitmap\n", stderr)
    exit(1)
}

rep.size = NSSize(width: width, height: height)
NSGraphicsContext.saveGraphicsState()
guard let context = NSGraphicsContext(bitmapImageRep: rep) else {
    fputs("failed to create graphics context\n", stderr)
    exit(1)
}
NSGraphicsContext.current = context
NSColor.clear.setFill()
NSRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)).fill()
image.draw(
    in: NSRect(x: 0, y: 0, width: CGFloat(width), height: CGFloat(height)),
    from: .zero,
    operation: .sourceOver,
    fraction: 1.0,
    respectFlipped: false,
    hints: [.interpolation: NSImageInterpolation.high]
)
NSGraphicsContext.restoreGraphicsState()

guard let png = rep.representation(using: .png, properties: [:]) else {
    fputs("failed to encode PNG\n", stderr)
    exit(1)
}

do {
    try png.write(to: dst)
} catch {
    fputs("failed to write PNG: \(error)\n", stderr)
    exit(1)
}

```

### Core Architecture Module: `src/agent/session_lifecycle.py`
```
"""SessionManager 的驻留、查询与销毁生命周期实现。"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any

from src.agent.session import AgentSession
from src.agent.session_rehydration import (
    SessionRehydrationMixin,
    _HISTORICAL_CONVERSATION_PROFILE,
    _SAFE_ID_PATTERN,
    _TASK_TERMINAL_STATUSES,
)
from src.agent.session_catalog import SessionMetadata
from src.config import SESSIONS_DIR, WORKFLOWS_DIR
from src.core.utils import is_visible_to_frontend

logger = logging.getLogger(__name__)

_ACTIVE_SUB_STATUSES = {"running", "streaming"}
_SUB_TERMINAL_STATUSES = {"completed", "error", "stopped", "cancelled"}
_SUB_RESULT_MAX_CHARS = 20_000
def _try_emit_event(event: dict) -> None:
    try:
        from src.web.event_bus import event_bus

        loop = asyncio.get_running_loop()
        loop.create_task(event_bus.emit_event(event))
    except RuntimeError:
        logger.debug("无法发送事件：无运行中的事件循环")
    except Exception:
        logger.debug("事件推送失败", exc_info=True)


class SessionLifecycleMixin(SessionRehydrationMixin):
    """把历史目录与热运行时分离，并管理可靠释放边界。"""

    sessions: dict[str, AgentSession]
    main_session_id: str | None
    _cold_cache_max_entries: int
    _workspace_manager: Any

    def _signal_session_update(self, session_id: str) -> None:
        self._session_changes.publish(session_id)

    async def _wait_for_session_update(
        self,
        session_id: str,
        timeout_seconds: float | None,
    ) -> bool:
        return await self._session_changes.wait(session_id, timeout_seconds)

    def register_main(self, session: AgentSession):
        session.session_type = "main"
        session.runtime_scope = "interactive"
        self.register_runtime_session(session)
        self.main_session_id = session.session_id
        if self._workspace_manager:
            ws_path = self._workspace_manager.create_workspace(session.session_id)
            session.workspace_path = str(ws_path)
        logger.info(
            "Main session 已注册: %s, workspace=%s",
            session.session_id,
            session.workspace_path or "none",
        )

    def get_main_session(self) -> AgentSession | None:
        if self.main_session_id:
            return self.sessions.get(self.main_session_id)
        return None

    def get_session(self, session_id: str) -> AgentSession | None:
        session = self.sessions.get(session_id)
        if session is not None:
            if session_id in self._cold_session_lru:
                self._cold_session_lru.move_to_end(session_id)
            return session
        if self._session_catalog.get(session_id) is None:
            return None
        session = AgentSession.load(session_id)
        if session is None:
            return None
        self._normalize_loaded_status(session)
        session._default_event_callback = self._make_event_callback(session_id)
        self.sessions[session_id] = session
        from src.agent.session import _persistence_manager

        _persistence_manager.register(session)
        self._session_catalog.upsert_session(session)
        self._cold_session_lru[session_id] = None
        self._evict_cold_sessions()
        return session

    def refresh_external_session(self, session_id: str) -> bool:
        """Invalidate a cold read replica and refresh its single catalog entry.

        Hot runtime Sessions are never displaced; this is only for Sessions whose
        authoritative writer lives in another local process.
        """
        if session_id in self.sessions and session_id not in self._cold_session_lru:
            return False
        from src.agent.session import _persistence_manager

        cached = self.sessions.get(session_id)
        if cached is not None and cached._save_dirty:
            logger.warning("拒绝刷新仍有未落盘修改的冷 Session: %s", session_id)
            return False
        self.sessions.pop(session_id, None)
        self._cold_session_lru.pop(session_id, None)
        _persistence_manager.unregister(session_id)
        return self._session_catalog.refresh(SESSIONS_DIR, session_id)

    def register_runtime_session(self, session: AgentSession) -> None:
        """注册需要 Graph/consumer 的热会话。"""
        self._cold_session_lru.pop(session.session_id, None)
        self.sessions[session.session_id] = session
        session._default_event_callback = self._make_event_callback(session.session_id)
        self._session_catalog.upsert_session(session)

    def _normalize_loaded_status(self, session: AgentSession) -> None:
        if (
            getattr(session, "lifecycle_profile", "task")
            in {"detached_conversation", _HISTORICAL_CONVERSATION_PROFILE}
            and session.status in {"running", "streaming"}
        ):
            session.status = "completed"
            return
        if (
            getattr(self, "_preserve_external_workflow_runtime", False)
            and session.runtime_scope == "workflow"
        ):
            return
        if session.session_type == "main" and session.status == "streaming":
            session.status = "running"
        elif session.session_type == "sub" and session.status in {"running", "streaming"}:
            session.status = "error"

    def _evict_cold_sessions(self) -> None:
        from src.agent.session import _persistence_manager

        dirty_examined = 0
        while len(self._cold_session_lru) > self._cold_cache_max_entries:
            session_id = next(iter(self._cold_session_lru))
            session = self.sessions.get(session_id)
            if session is not None and (
                session.compiled_graph is not None or session.invocation_active
            ):
                self._cold_session_lru.pop(session_id, None)
                continue
            if session is not None and session._save_dirty:
                self._cold_session_lru.move_to_end(session_id)
                dirty_examined += 1
                if dirty_examined >= len(self._cold_session_lru):
                    break
                continue
            self._cold_session_lru.pop(session_id, None)
            if session is not None:
                self._session_catalog.upsert_session(session)
            self.sessions.pop(session_id, None)
            _persistence_manager.unregister(session_id)

    def get_session_summaries(self) -> list[dict]:
        summaries = {
            metadata.session_id: metadata.to_summary()
            for metadata in self._session_catalog.values()
        }
        summaries.update({
            session_id: session.get_summary()
            for session_id, session in self.sessions.items()
        })
        return sorted(
            summaries.values(),
            key=lambda item: (item.get("updated_at", ""), item["session_id"]),
            reverse=True,
        )

    def get_main_session_summaries(self) -> list[dict]:
        summaries = {
            metadata.session_id: metadata.to_summary()
            for metadata in self._session_catalog.values()
            if metadata.session_type == "main"
        }
        summaries.update({
            session_id: session.get_summary()
            for session_id, session in self.sessions.items()
            if session.session_type == "main"
        })
        return sorted(
            summaries.values(),
            key=lambda item: (item.get("updated_at", ""), item["session_id"]),
            reverse=True,
        )

    def get_total_session_count(self) -> int:
        return len({
            *[metadata.session_id for metadata in self._session_catalog.values()],
            *self.sessions.keys(),
        })

    def get_active_sub_count(self) -> int:
        return sum(
            1 for session in self.sessions.values()
            if session.session_type == "sub"
            and session.status in {"running", "streaming"}
        )

    def get_all_sub_sessions(self) -> list[AgentSession]:
        return [
            session for session in self.sessions.values()
            if session.session_type == "sub"
        ]

    def get_main_sessions(self) -> list[AgentSession]:
        """返回当前热驻留的 main 类型会话。"""
        return [
            session for session in self.sessions.values()
            if session.session_type == "main"
        ]

    def _get_root_main(self, session_id: str) -> str | None:
        hot_session = self.sessions.get(session_id)
        hot_visited: set[str] = set()
        while hot_session and hot_session.session_id not in hot_visited:
            if hot_session.session_type == "main":
                return hot_session.session_id
            hot_visited.add(hot_session.session_id)
            hot_session = self.sessions.get(hot_session.parent_id or "")

        summaries = {
            summary["session_id"]: summary
            for summary in self.get_session_summaries()
        }
        session = summaries.get(session_id)
        visited: set[str] = set()
        while session and session["session_id"] not in visited:
            if session.get("type") == "main":
                return session["session_id"]
            visited.add(session["session_id"])
            session = summaries.get(session.get("parent_id", ""))
        return None

    def _make_event_callback(self, session_id: str):
        """为 Session 创建统一的 Chat/Event 流回调。"""
        async def callback(event: dict):
            from src.web.event_bus import event_bus

            session = self.sessions.get(session_id)
            event["session_id"] = session_id
            event_type = event.get("type", "")
            if event_type in {"stream_start", "stream_end", "error"}:
                self._signal_session_update(session_id)
            if event_type in (
                "stream_start", "stream_end", "token", "reasoning_token",
                "tool_call_delta", "error", "tool_start", "tool_end", "llm_usage",
            ):
                await event_bus.emit_chat(event)
            if event_type 
```

### Core Architecture Module: `src/compression/utils.py`
```
"""
压缩模块公共工具函数
"""

from typing import Any, Dict, List

from langchain_core.messages import BaseMessage, SystemMessage, AIMessage, HumanMessage, ToolMessage

from src.core.utils import estimate_tokens


def get_message_role(msg: BaseMessage) -> str:
    """获取消息角色字符串，供序列化和统计使用。

    Args:
        msg: LangChain 消息对象

    Returns:
        角色字符串：system / user / assistant / tool / msg.type / unknown
    """
    if isinstance(msg, SystemMessage):
        return "system"
    elif isinstance(msg, HumanMessage):
        return "user"
    elif isinstance(msg, AIMessage):
        return "assistant"
    elif isinstance(msg, ToolMessage):
        return "tool"
    else:
        return msg.type if hasattr(msg, "type") else "unknown"


def _msg_content_tokens(msg: BaseMessage) -> int:
    """计算单条消息的 token 数"""
    content = msg.content if isinstance(msg.content, str) else str(msg.content or "")
    return estimate_tokens(content)


def estimate_messages_tokens(
    messages: List[BaseMessage],
    *,
    include_system: bool = True,
    include_tool_calls: bool = True,
) -> int:
    """统一估算消息列表的 token 数。

    Args:
        messages: 消息列表
        include_system: 是否包含 SystemMessage 的 token（checker 跳过，transcript 包含）
        include_tool_calls: 是否计算 AIMessage.tool_calls 的 token（checker 计算，transcript 不计算）

    Returns:
        总 token 数
    """
    total = 0
    for msg in messages:
        if not include_system and isinstance(msg, SystemMessage):
            continue
        total += _msg_content_tokens(msg)
        if include_tool_calls and isinstance(msg, AIMessage) and getattr(msg, "tool_calls", None):
            for tc in msg.tool_calls:
                total += estimate_tokens(str(tc.get("args", "")))
    return total


def calc_compression_stats(
    original_messages: List[BaseMessage],
    compressed_messages: List[BaseMessage],
) -> Dict[str, Any]:
    """
    计算压缩前后通用统计信息。

    Args:
        original_messages: 原始消息列表
        compressed_messages: 压缩后的消息列表

    Returns:
        包含消息数、token 数、tokens_saved、messages_removed、compression_ratio 等字段的字典
    """
    original_count = len(original_messages)
    compressed_count = len(compressed_messages)

    original_tokens = sum(_msg_content_tokens(msg) for msg in original_messages)
    compressed_tokens = sum(_msg_content_tokens(msg) for msg in compressed_messages)

    return {
        "original_message_count": original_count,
        "compressed_message_count": compressed_count,
        "messages_removed": original_count - compressed_count,
        "original_tokens": original_tokens,
        "compressed_tokens": compressed_tokens,
        "tokens_saved": original_tokens - compressed_tokens,
        "compression_ratio": compressed_tokens / original_tokens if original_tokens > 0 else 1,
    }


def calc_tool_message_stats(
    original_messages: List[BaseMessage],
    compressed_messages: List[BaseMessage],
) -> Dict[str, Any]:
    """
    计算 ToolMessage 相关的额外统计信息，供 micro 策略使用。

    Returns:
        包含工具消息数、token 数等额外字段的字典
    """
    original_tool_count = sum(1 for msg in original_messages if isinstance(msg, ToolMessage))
    compressed_tool_count = sum(1 for msg in compressed_messages if isinstance(msg, ToolMessage))

    original_tool_tokens = sum(
        _msg_content_tokens(msg) for msg in original_messages if isinstance(msg, ToolMessage)
    )
    compressed_tool_tokens = sum(
        _msg_content_tokens(msg) for msg in compressed_messages if isinstance(msg, ToolMessage)
    )

    return {
        "original_tool_count": original_tool_count,
        "compressed_tool_count": compressed_tool_count,
        "tools_compressed": original_tool_count - compressed_tool_count,
        "original_tool_tokens": original_tool_tokens,
        "compressed_tool_tokens": compressed_tool_tokens,
        "tool_tokens_saved": original_tool_tokens - compressed_tool_tokens,
    }

```

### Core Architecture Module: `src/core/approval_manager.py`
```
"""
命令审批引擎 - 管理 execute_command 工具的命令安全审批

参考 Roo-Code:
- src/core/auto-approval/index.ts（决策状态机）
- src/core/auto-approval/commands.ts（最长前缀匹配）
- src/core/auto-approval/tools.ts（读写分类）

四种行为模式：
- allow_all: 所有命令直接执行
- approve_all: 所有命令需人工审批
- blacklist: 匹配黑名单的命令需审批，其余放行
- whitelist: 匹配白名单的命令放行，其余需审批

审批流程：
1. check_command() 判断是否需要审批
2. 需要审批时创建 ApprovalRequest，通过 EventBus 推送到前端
3. wait_for_approval() 异步等待用户操作（asyncio.Event）
4. 前端通过 REST API 调用 approve()/reject()
"""
import asyncio
import logging
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

import src.config as config

logger = logging.getLogger(__name__)


@dataclass
class ApprovalRequest:
    """审批请求"""
    request_id: str
    session_id: str
    tool_name: str
    command: str
    workspace: str
    status: str = "pending"  # pending / approved / rejected / timeout
    created_at: str = ""
    expires_at: str = ""
    reason: str = ""
    # 内部使用：asyncio.Event 用于等待审批结果
    _event: asyncio.Event = field(default_factory=asyncio.Event, repr=False)

    def to_dict(self) -> dict:
        return {
            "request_id": self.request_id,
            "session_id": self.session_id,
            "tool_name": self.tool_name,
            "command": self.command,
            "workspace": self.workspace,
            "status": self.status,
            "created_at": self.created_at,
            "expires_at": self.expires_at,
            "reason": self.reason,
        }


class ApprovalManager:
    """命令审批引擎"""

    def __init__(self):
        # 待审批请求池：request_id → ApprovalRequest
        self.pending_approvals: dict[str, ApprovalRequest] = {}
        logger.info("ApprovalManager 已初始化")

    def check_command(self, command: str, session_id: str) -> str:
        """检查命令是否需要审批

        这里不做具体的黑白名单检查（由 WorkspaceGuard 完成），
        仅根据 WorkspaceGuard 的结果决定后续流程。

        Returns:
            "allowed" | "needs_approval"
        """
        from src.core.workspace_guard import WorkspaceGuard
        guard = WorkspaceGuard()
        result = guard.validate_command("", command)
        if result.allowed:
            return "allowed"
        return "needs_approval"

    def request_approval(self, command: str, session_id: str,
                         tool_name: str = "execute_command",
                         workspace: str = "") -> ApprovalRequest:
        """创建审批请求

        Args:
            command: 要执行的命令
            session_id: 会话 ID
            tool_name: 工具名
            workspace: 工作目录

        Returns:
            ApprovalRequest 实例
        """
        request_id = uuid.uuid4().hex[:12]
        now = datetime.now(timezone.utc)
        timeout = config.CODING_APPROVAL_TIMEOUT
        expires_at = now + timedelta(seconds=timeout)

        request = ApprovalRequest(
            request_id=request_id,
            session_id=session_id,
            tool_name=tool_name,
            command=command,
            workspace=workspace,
            status="pending",
            created_at=now.isoformat(),
            expires_at=expires_at.isoformat(),
        )

        self.pending_approvals[request_id] = request

        # 通过 EventBus 推送审批请求到前端
        self._emit_approval_event(request)

        logger.info(f"审批请求已创建: {request_id}, command={command[:80]}")
        return request

    async def wait_for_approval(self, request_id: str, timeout: float | None = None) -> str:
        """异步等待审批结果

        Args:
            request_id: 审批请求 ID
            timeout: 超时秒数，默认从配置读取

        Returns:
            "approved" | "rejected" | "timeout"
        """
        request = self.pending_approvals.get(request_id)
        if not request:
            return "rejected"

        if timeout is None:
            timeout = float(config.CODING_APPROVAL_TIMEOUT)

        try:
            await asyncio.wait_for(request._event.wait(), timeout=timeout)
            return request.status
        except asyncio.TimeoutError:
            request.status = "timeout"
            self.pending_approvals.pop(request_id, None)
            self._emit_resolved_event(request)
            logger.warning(f"审批请求超时: {request_id}")
            return "timeout"

    def approve(self, request_id: str) -> bool:
        """批准审批请求"""
        request = self.pending_approvals.get(request_id)
        if not request or request.status != "pending":
            return False

        request.status = "approved"
        request._event.set()
        self.pending_approvals.pop(request_id, None)
        self._emit_resolved_event(request)
        logger.info(f"审批请求已批准: {request_id}")
        return True

    def reject(self, request_id: str, reason: str = "") -> bool:
        """拒绝审批请求"""
        request = self.pending_approvals.get(request_id)
        if not request or request.status != "pending":
            return False

        request.status = "rejected"
        request.reason = reason
        request._event.set()
        self.pending_approvals.pop(request_id, None)
        self._emit_resolved_event(request)
        logger.info(f"审批请求已拒绝: {request_id}, reason={reason}")
        return True

    def get_pending(self) -> list[dict]:
        """获取所有待审批请求"""
        self._cleanup_expired()
        return [r.to_dict() for r in self.pending_approvals.values() if r.status == "pending"]

    def _cleanup_expired(self) -> None:
        """清理已过期但未被 wait_for_approval 消费的审批请求，防止内存泄漏。"""
        now = datetime.now(timezone.utc)
        expired_ids = []
        for req_id, req in self.pending_approvals.items():
            if req.status != "pending":
                continue
            try:
                if datetime.fromisoformat(req.expires_at) < now:
                    req.status = "timeout"
                    expired_ids.append(req_id)
            except (ValueError, TypeError):
                continue
        for req_id in expired_ids:
            self.pending_approvals.pop(req_id, None)
            logger.info(f"自动清理过期审批请求: {req_id}")

    def update_config(self, mode: str | None = None,
                      blacklist: str | None = None,
                      whitelist: str | None = None) -> None:
        """更新审批配置（同时持久化到 .env 文件）"""
        updates: dict[str, str] = {}
        if mode is not None:
            updates["CODING_CMD_MODE"] = mode
        if blacklist is not None:
            updates["CODING_CMD_BLACKLIST"] = blacklist
        if whitelist is not None:
            updates["CODING_CMD_WHITELIST"] = whitelist
        if updates:
            config.update_config(updates, persist=True)
        logger.info(f"审批配置已更新: mode={config.CODING_CMD_MODE}")

    # ============================================================
    # 内部方法
    # ============================================================

    @staticmethod
    def _emit_event(event: dict) -> None:
        """通过 EventBus 推送事件（通用方法）。

        _emit_approval_event 和 _emit_resolved_event 共用此方法，
        消除重复的 try/except RuntimeError/Exception 模式。
        """
        try:
            from src.web.event_bus import event_bus
            loop = asyncio.get_running_loop()
            loop.create_task(event_bus.emit_event(event))
        except RuntimeError:
            logger.debug("无运行中的事件循环，跳过事件推送")
        except Exception as e:
            logger.error(f"推送事件失败: {e}")

    @classmethod
    def _emit_approval_event(cls, request: ApprovalRequest) -> None:
        """通过 EventBus 推送审批请求事件"""
        cls._emit_event({
            "type": "approval_request",
            **request.to_dict(),
        })

    @classmethod
    def _emit_resolved_event(cls, request: ApprovalRequest) -> None:
        """通过 EventBus 推送审批结果事件"""
        cls._emit_event({
            "type": "approval_resolved",
            "request_id": request.request_id,
            "result": request.status,
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        })

```

### Core Architecture Module: `src/core/change_broadcaster.py`
```
"""进程内状态变化广播器。

事件只负责唤醒等待者；调用方被唤醒后必须重新读取权威状态。
"""

from __future__ import annotations

import asyncio
from collections import defaultdict


class ChangeBroadcaster:
    """按稳定 key 向所有等待者广播一次状态变化。"""

    def __init__(self) -> None:
        self._waiters: dict[str, set[asyncio.Event]] = defaultdict(set)

    async def wait(self, key: str, timeout_seconds: float | None) -> bool:
        """等待一次变化；超时返回 False，取消会原样向上传播。"""
        event = asyncio.Event()
        self._waiters[key].add(event)
        try:
            if timeout_seconds is None:
                await event.wait()
                return True
            if timeout_seconds <= 0:
                return False
            try:
                await asyncio.wait_for(event.wait(), timeout=timeout_seconds)
                return True
            except asyncio.TimeoutError:
                return False
        finally:
            waiters = self._waiters.get(key)
            if waiters is not None:
                waiters.discard(event)
                if not waiters:
                    self._waiters.pop(key, None)

    def publish(self, key: str) -> None:
        """唤醒当前订阅该 key 的全部等待者。"""
        for event in self._waiters.pop(key, set()):
            event.set()

    def waiter_count(self, key: str | None = None) -> int:
        """返回等待者数量，供生命周期检查和测试使用。"""
        if key is not None:
            return len(self._waiters.get(key, ()))
        return sum(len(waiters) for waiters in self._waiters.values())

```

### Core Architecture Module: `src/core/default_resources.py`
```
"""Provision versioned Core resources into an instance data directory."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import shutil

from src.skills.storage import CORE_RESOURCE_MARKER


DEFAULT_RESOURCES_DIR = Path(__file__).parent / "defaults"


def _file_hash(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def provision_core_skills(skills_dir: Path) -> list[Path]:
    """Mirror bundled Core Skills into their immutable runtime root."""
    source_dir = DEFAULT_RESOURCES_DIR / "skills"
    if not source_dir.is_dir():
        return []

    skills_dir.mkdir(parents=True, exist_ok=True)
    marker_path = skills_dir / CORE_RESOURCE_MARKER
    installed_files: dict[str, dict[str, str]] = {}
    synchronized: list[Path] = []
    expected_files: set[str] = set()
    for source in sorted(
        path
        for path in source_dir.rglob("*")
        if path.is_file()
        and "__pycache__" not in path.parts
        and path.suffix not in {".pyc", ".pyo"}
    ):
        relative = source.relative_to(source_dir).as_posix()
        expected_files.add(relative)
        target = skills_dir / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        source_hash = _file_hash(source)
        target_hash = _file_hash(target) if target.is_file() else ""
        if target_hash != source_hash:
            temporary = target.with_name(target.name + ".tmp")
            try:
                shutil.copy2(source, temporary)
                with temporary.open("r+b") as target_file:
                    os.fsync(target_file.fileno())
                os.replace(temporary, target)
            finally:
                temporary.unlink(missing_ok=True)
            synchronized.append(target)
        installed_files[relative] = {"installed_hash": source_hash}

    for installed_path in sorted(skills_dir.rglob("*"), reverse=True):
        relative = installed_path.relative_to(skills_dir).as_posix()
        if installed_path == marker_path:
            continue
        if installed_path.is_symlink() or installed_path.is_file():
            if relative not in expected_files:
                installed_path.unlink()
            continue
        if installed_path.is_dir():
            try:
                installed_path.rmdir()
            except OSError:
                pass

    marker_data = {"files": installed_files}
    temp_marker = marker_path.with_suffix(".json.tmp")
    temp_marker.write_text(
        json.dumps(marker_data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    os.replace(temp_marker, marker_path)
    return synchronized

```

### Core Architecture Module: `src/core/defaults/skills/workflow-guide/scripts/validate_definition.py`
```
#!/usr/bin/env python3
"""Validate workflow definition files after direct edits."""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path


def find_repo_root(script_path: Path) -> Path:
    """Find the checkout root from both bundled and provisioned Skill layouts."""
    candidates = list(script_path.resolve().parents)
    configured_root = (
        os.getenv("DETERMINFLOW_ROOT")
        or os.getenv("AI_COMPANY_ROOT", "")
    ).strip()
    if configured_root:
        candidates.append(Path(configured_root).expanduser().resolve())
    for candidate in dict.fromkeys(candidates):
        if (candidate / "src" / "workflow" / "definition.py").is_file():
            return candidate
    raise RuntimeError(
        "无法定位 DeterminFlow 仓库根目录；应在仓库内运行已安装的 workflow-guide"
    )


REPO_ROOT = find_repo_root(Path(__file__))
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from src.workflow.definition import WorkflowDef  # noqa: E402


PLACEHOLDER_RE = re.compile(r"{{\s*([A-Za-z0-9_.\[\]-]+)\s*}}")
SYSTEM_PREFIXES = ("_system.",)


def discover(target: str) -> list[Path]:
    if target == "--all":
        root = REPO_ROOT / "data" / "workflows"
        return sorted(root.glob("*/definition.json"))
    path = Path(target).expanduser().resolve()
    if path.is_file():
        return [path]
    if (path / "definition.json").is_file():
        return [path / "definition.json"]
    return sorted(path.rglob("definition.json"))


def validate_file(path: Path) -> tuple[list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        return [f"无法读取 JSON: {exc}"], warnings
    if not isinstance(payload, dict):
        return ["顶层必须是 JSON object"], warnings

    try:
        definition = WorkflowDef.from_dict(payload)
        errors.extend(definition.auto_pair_gateways())
        errors.extend(definition.validate())
    except (TypeError, ValueError, KeyError) as exc:
        errors.append(f"定义反序列化失败: {exc}")
        return errors, warnings

    ids = [node.id for node in definition.nodes] + [gateway.id for gateway in definition.gateways]
    duplicates = sorted({item for item in ids if ids.count(item) > 1})
    if duplicates:
        errors.append(f"节点或网关 ID 重复: {', '.join(duplicates)}")

    variable_keys = [variable.key for variable in definition.variables]
    bad_keys = sorted(key for key in variable_keys if key.startswith("_"))
    if bad_keys:
        errors.append(f"变量 key 使用了保留前缀 _: {', '.join(bad_keys)}")
    duplicate_vars = sorted({key for key in variable_keys if variable_keys.count(key) > 1})
    if duplicate_vars:
        errors.append(f"变量 key 重复: {', '.join(duplicate_vars)}")

    for node in definition.nodes:
        if not node.label:
            warnings.append(f"节点 {node.id} 缺少 label")
        if not isinstance(node.position, dict) or not {"x", "y"}.issubset(node.position):
            warnings.append(f"节点 {node.id} 缺少完整 position")

    declared = set(variable_keys)
    referenced: set[str] = set()
    for node in payload.get("nodes", []):
        blob = json.dumps(node, ensure_ascii=False)
        for raw in PLACEHOLDER_RE.findall(blob):
            root = raw.split("[", 1)[0].split(".", 1)[0]
            if not raw.startswith(SYSTEM_PREFIXES):
                referenced.add(root)
    undefined = sorted(referenced - declared)
    if undefined:
        warnings.append(f"引用但未声明的变量: {', '.join(undefined)}")
    unused_inputs = sorted(
        variable.key
        for variable in definition.variables
        if variable.source_type == "input" and variable.key not in referenced and not variable.hidden
    )
    if unused_inputs:
        warnings.append(f"声明但未引用的输入变量: {', '.join(unused_inputs)}")

    if path.parent.name != definition.workflow_id:
        warnings.append(
            f"目录名 {path.parent.name} 与 workflow_id {definition.workflow_id} 不一致"
        )
    return errors, warnings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("target", nargs="?", help="definition.json 或工作流目录")
    parser.add_argument("--all", action="store_true", dest="validate_all", help="校验所有工作流")
    args = parser.parse_args()
    if args.validate_all and args.target:
        parser.error("--all 不能与 target 同时使用")
    target = "--all" if args.validate_all else args.target
    if not target:
        parser.error("请提供 target 或 --all")
    paths = discover(target)
    if not paths:
        parser.error("未找到 definition.json")

    failed = False
    for path in paths:
        errors, warnings = validate_file(path)
        label = path.relative_to(REPO_ROOT) if path.is_relative_to(REPO_ROOT) else path
        print(f"[{('FAIL' if errors else 'PASS')}] {label}")
        for warning in warnings:
            print(f"  WARNING: {warning}")
        for error in errors:
            print(f"  ERROR: {error}")
        failed = failed or bool(errors)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())

```

### Core Architecture Module: `src/core/llm_client.py`
```
"""LLM 配置工厂 - 根据 Provider Adapter 创建对应的聊天模型客户端。"""
import asyncio
import logging
import re
from typing import Any, Literal

from langchain_anthropic import ChatAnthropic
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import BaseMessage, AIMessage
from langchain_core.callbacks import BaseCallbackHandler
from langchain_core.runnables.config import ensure_config, merge_configs
from langchain_openai import ChatOpenAI
from langchain_openai.chat_models import base as openai_base

import os
import warnings

from src.core.provider_errors import (
    classify_provider_error_code,
    is_permanent_provider_error,
)

logger = logging.getLogger(__name__)
REQUEST_FINGERPRINT_HEADER = "X-DeterminFlow-Request-Fingerprint"
_REQUEST_FINGERPRINT_RE = re.compile(r"^[0-9a-f]{64}$")


def _apply_request_fingerprint_headers(
    kwargs: dict[str, Any],
    request_fingerprint: str | None,
) -> None:
    """Attach the opaque Workflow retry-routing header when a digest is present."""
    fingerprint = str(request_fingerprint or "").strip()
    if not fingerprint:
        return
    if _REQUEST_FINGERPRINT_RE.fullmatch(fingerprint) is None:
        raise ValueError(
            "request_fingerprint must be a 64-character SHA-256 hex digest"
        )
    headers = dict(kwargs.get("default_headers") or {})
    headers[REQUEST_FINGERPRINT_HEADER] = fingerprint
    kwargs["default_headers"] = headers


class ModelCredentialNotConfiguredError(ValueError):
    """The selected model provider has no usable API credential."""


class ModelConfigurationNotAvailableError(ValueError):
    """No configured provider/model is available for an actual LLM call."""


# ============================================================
# Monkey Patch 版本兼容性检查
# ============================================================

_EXPECTED_LANGCHAIN_OPENAI_VERSIONS = {"1.3"}  # 与 requirements.txt 锁定版本一致
try:
    import langchain_openai as _lc_openai_pkg
    _lc_version = getattr(_lc_openai_pkg, "__version__", "unknown")
    _lc_major_minor = ".".join(_lc_version.split(".")[:2]) if _lc_version != "unknown" else "unknown"
    if _lc_major_minor not in _EXPECTED_LANGCHAIN_OPENAI_VERSIONS:
        logger.warning(
            f"langchain_openai {_lc_version} 未在已验证版本 {_EXPECTED_LANGCHAIN_OPENAI_VERSIONS} 中，"
            f"Monkey Patch 可能不兼容。若出现 AttributeError 或行为异常，请降级 langchain-openai。"
        )
    else:
        logger.debug(f"langchain_openai {_lc_version} 版本检查通过")
except ImportError:
    logger.warning("langchain_openai 未安装，Monkey Patch 跳过")


# ============================================================
# Monkey Patch 1: 消息转换 - 将 reasoning_content 传回 API
# ============================================================

_original_convert_message_to_dict = openai_base._convert_message_to_dict


def _patched_convert_message_to_dict(
    message: BaseMessage,
    api: Literal["chat/completions", "responses"] = "chat/completions",
) -> dict:
    """
    修补版本的消息转换函数，支持 DeepSeek V4 的 reasoning_content

    DeepSeek V4 思考模式要求：
    - 在多轮对话中，必须将之前的 reasoning_content 传回 API
    - reasoning_content 应该在 AIMessage 的 additional_kwargs 中
    """
    message_dict = _original_convert_message_to_dict(message, api)

    # 如果是 AIMessage 且包含 reasoning_content，添加到消息字典中
    if isinstance(message, AIMessage) and hasattr(message, "additional_kwargs"):
        reasoning_content = message.additional_kwargs.get("reasoning_content")
        if reasoning_content:
            message_dict["reasoning_content"] = reasoning_content
            logger.debug(f"[PATCH 1] 添加 reasoning_content 到消息字典 (长度: {len(reasoning_content)})")

    return message_dict


openai_base._convert_message_to_dict = _patched_convert_message_to_dict


# ============================================================
# Monkey Patch 2: 响应解析 - 从 API 响应提取 reasoning_content
# ============================================================

_original_convert_delta_to_message_chunk = openai_base._convert_delta_to_message_chunk


def _patched_convert_delta_to_message_chunk(
    _dict: Any,
    default_class: Any,
) -> Any:
    """
    修补版本的 delta 转换函数，支持提取 reasoning_content

    DeepSeek V4 在流式响应中会返回 reasoning_content 字段，
    需要：
    1. 将其作为 chunk 的直接属性（用于流式显示）
    2. 将其添加到 additional_kwargs（用于多轮对话传回）
    """
    chunk = _original_convert_delta_to_message_chunk(_dict, default_class)

    # 如果响应中包含 reasoning_content，进行双重处理
    if "reasoning_content" in _dict:
        reasoning_content = _dict.get("reasoning_content")
        if reasoning_content:
            # 1. 作为 chunk 的直接属性（用于 session.py 中的流式提取）
            # 使用 setattr 防止 frozen/cached_property 对象抛出 AttributeError
            try:
                setattr(chunk, "reasoning_content", reasoning_content)
            except AttributeError:
                pass  # 某些 frozen/cached_property 对象无法设置额外属性

            # 2. 添加到 additional_kwargs（用于多轮对话时传回 API）
            if hasattr(chunk, "additional_kwargs"):
                chunk.additional_kwargs["reasoning_content"] = reasoning_content

    return chunk


openai_base._convert_delta_to_message_chunk = _patched_convert_delta_to_message_chunk


# ============================================================
# 应用补丁完成
# ============================================================

logger.info("已应用 DeepSeek V4 reasoning_content 支持补丁")


def _resolve_provider_config(
    model_override: str,
    model_manager: Any,
) -> tuple[str, str, str, str, dict]:
    """解析 provider_id:model_name 格式，返回 (provider_id, model_name, api_key, base_url, provider_config)。

    Raises:
        ValueError: provider 不存在或格式不正确
    """
    provider_id, model_name = model_override.split(":", 1)
    provider_config = model_manager.get_provider(provider_id)
    if not provider_config:
        raise ModelConfigurationNotAvailableError(
            f"供应商 {provider_id} 不存在；请在设置页选择可用模型"
        )
    if model_name not in provider_config.get("models", []):
        raise ModelConfigurationNotAvailableError(
            f"模型 {model_override} 未配置；请在设置页选择可用模型"
        )
    api_key = provider_config.get("api_key", "")
    if not api_key:
        raise ModelCredentialNotConfiguredError(
            f"Provider {provider_id} 的 api_key 未配置；"
            "请在模型设置页面填写，或在 models_config.json 中引用环境变量"
        )
    return provider_id, model_name, api_key, provider_config["base_url"], provider_config


def _merge_params(
    model_manager: Any,
    provider_id: str,
    model_name: str,
    provider_config: dict,
    model_params: dict | None,
    kwargs: dict,
) -> dict:
    """合并模型参数和 provider 超参数到 kwargs（原地修改）。

    合并优先级: agent model_params > defaults；provider hyperparams 作为 fallback。

    具体字段选择、校验和 API 参数映射由 Provider Adapter 完成。
    """
    # 合并模型参数：agent model_params > defaults
    defaults = model_manager.get_default_params()
    merged_params = dict(defaults)
    if model_params:
        merged_params.update(
            {
                key: value
                for key, value in model_params.items()
                if value is not None or key == "response_format"
            }
        )

    request = model_manager.build_provider_request(
        provider_id, merged_params, provider_config, model_name=model_name
    )
    for name, value in request.get("client_kwargs", {}).items():
        kwargs.setdefault(name, value)
    if request.get("extra_body"):
        kwargs.setdefault("extra_body", {}).update(request["extra_body"])
    if request.get("model_kwargs"):
        kwargs.setdefault("model_kwargs", {}).update(request["model_kwargs"])
    return merged_params


def _resolve_model_override(model_override: str | None, model_manager) -> str:
    """
    将 model_override 解析为标准 "provider_id:model_name" 格式。

    支持三种输入：
    1. 新格式 "provider_id:model_name" → 直接返回
    2. 纯模型名 → 在所有 provider 的 models 列表中查找匹配，返回 "pid:model_name"
    3. None → 使用默认模型

    Returns:
        "provider_id:model_name" 格式的字符串

    Raises:
        ValueError: 无法解析时抛出
    """
    # 新格式：直接返回
    if model_override and ":" in model_override:
        return model_override

    # 旧格式：纯模型名，按名称查找供应商
    if model_override:
        for pid, pconfig in model_manager.get_all_providers().items():
            if model_override in pconfig.get("models", []):
                return f"{pid}:{model_override}"

    # 使用默认模型（从 agents_config.json main agent 读取）
    default_model = model_manager.get_default_model()
    if default_model and ":" in default_model:
        return default_model

    raise ModelConfigurationNotAvailableError(
        "尚未配置可用模型；请先在设置页添加供应商和模型"
    )


def _wrap_llm_with_retry(llm: BaseChatModel, retry_config: dict) -> BaseChatModel:
    """
    为 ChatOpenAI 实例的 ainvoke 和 astream 方法注入自动重试机制。

    当 LLM 调用失败（限流、5xx、网络不可达等瞬时错误），自动按配置的重试次数
    和间隔时间重试；额度、鉴权、权限和非法请求属于永久性错误，立即抛出。
    一旦已经向调用方输出部分流，不再原地重试。最后一次失败抛出原始异常。

    Args:
        llm: ChatOpenAI 实例
        retry_config: {"max_retries": 3, "delays": [5, 15, 30]}

    Returns:
        包装后的 ChatOpenAI 实例（就地修改）
    """
    max_retries = retry_config.get("max_retries", 3)
    delays = retry_config.get("delays", [5, 15, 30])

    if max_retries <= 0:
        return llm

    # 确保 delays 长度足够（不足时用最后一个值填充）
    delays = list(delays)
    while len(delays) < max_retries:
        delays.append(delays[-1] if delays else 30)

    # ---- 包装 ainvoke ----
    original_ainvoke = llm.ainvoke

    class _StreamingCallbackTracker(BaseCallbackHandler):
        """Observe chunks emitted by ``ainvoke`` through LangChain callbacks."""

        def __init__(self):
            self.chunk_count = 0

        def on_llm_new_token(self, _token, **_kwargs):
            self.chunk_count += 1

    def _tracked_ainvoke_arguments(args, kwargs, tracker):
        tracked_args = list(args)
        tracked_kwargs = dict(kwargs)
        tracker_config = {"callbacks": [tracker]}
        if tracked_args:
            tracked_args[0] = merge_configs(
                ensure_config(tracked_args[0]),
                tracker_config,
            )
        else:
```

### Core Architecture Module: `src/core/message_attachments.py`
```
"""Display metadata for inline files and resource references.

Only the matching text in the user message is sent to the model. Metadata never
loads a resource, grants a tool, or injects resource contents.
"""

from __future__ import annotations

RESOURCE_TYPES = frozenset({"prompt", "agent", "skill", "rule", "workflow", "session"})
MAX_ATTACHMENTS = 64


def _text(value: object, label: str, maximum: int) -> str:
    if not isinstance(value, str) or not value.strip():
        raise ValueError(f"{label}无效")
    if len(value) > maximum or "\x00" in value:
        raise ValueError(f"{label}过长或包含无效字符")
    return value


def validate_attachment(raw: object, content: str | None) -> dict[str, str]:
    if not isinstance(raw, dict):
        raise ValueError("附件信息格式无效")
    name = _text(raw.get("name"), "附件名称", 255)
    if "resource_type" in raw:
        resource_type = raw["resource_type"]
        if not isinstance(resource_type, str) or resource_type not in RESOURCE_TYPES:
            raise ValueError("资源类型无效")
        if "absolute_path" in raw:
            raise ValueError("资源引用不能同时包含文件路径字段")
        resource_id = _text(raw.get("resource_id"), "资源 ID", 1024)
        reference = _text(raw.get("reference_text"), "资源引用", 4096)
        if content is not None and reference not in content:
            raise ValueError("资源引用必须存在于消息正文中")
        return {
            "name": name,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "reference_text": reference,
        }

    path = _text(raw.get("absolute_path"), "附件路径", 4096)
    absolute = path.startswith("/") or (
        len(path) >= 3 and path[0].isalpha()
        and path[1] == ":" and path[2] in ("/", "\\")
    )
    if not absolute or (content is not None and path not in content):
        raise ValueError("附件绝对路径必须存在于消息正文中")
    return {"name": name, "absolute_path": path}


def validate_message_attachments(raw: object, content: str) -> list[dict[str, str]]:
    if raw is None:
        return []
    if not isinstance(raw, list):
        raise ValueError("attachments 必须是数组")
    if len(raw) > MAX_ATTACHMENTS:
        raise ValueError(f"单条消息最多包含 {MAX_ATTACHMENTS} 个附件")
    return [validate_attachment(item, content) for item in raw]


def retain_message_attachments(raw: object, content: str | None = None) -> list[dict[str, str]]:
    """Retain valid metadata still present after editing or restoring a turn."""
    if not isinstance(raw, list):
        return []
    retained = []
    for item in raw[:MAX_ATTACHMENTS]:
        try:
            retained.append(validate_attachment(item, content))
        except ValueError:
            continue
    return retained

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #29** (2026-09-26): **桌面端安装后无法正尝使用**
  *Symptoms*: 

- **Issue #26** (2026-09-07): **docs(release): align Full plugin version with rebuilt installers**
  *Symptoms*: Updates both READMEs to the public-api 0.1.37 version already pinned by the rebuilt Full installers. Documentation-only; validated against desktop/official-plugins.lock.json and git diff --check.

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

### Incident Patch 1: `f78f478d` (2026-09-07)
**Commit Message**: fix(desktop): resolve locked plugin snapshots from canonical Git

**File**: `desktop/scripts/official_plugin_lock.py` (modified, +3/-1)
```diff
@@ -225,7 +225,9 @@ def pin_official_sources(
         or source.ref != expected["ref"]
     ):
         raise RuntimeError("桌面官方 Plugin 来源与构建锁不一致")
-    return (replace(source, ref=expected["commit"]),)
+    # A latest-manifest registry may describe a different commit. Build inputs
+    # must resolve the locked Git object even while distribution is catching up.
+    return (replace(source, ref=expected["commit"], registry=None, mirrors=()),)
 
 
 def validate_locked_catalog(
```

**File**: `tests/test_desktop_plugin_lock.py` (modified, +6/-0)
```diff
@@ -69,11 +69,17 @@ def test_full_plugin_catalog_must_match_the_exact_build_lock(
         url=lock["source"]["url"],
         ref="main",
         mirrors=("https://gitee.com/alikon/DeterminFlow-Plugins.git",),
+        registry=plugin_lock_module._official_sources(
+            REPO_ROOT / "config" / "plugin-sources.json"
+        )[0].registry,
     )
     pinned = plugin_lock_module.pin_official_sources((source,), lock)
 
     assert pinned[0].ref == "a" * 40
     assert pinned[0].url == source.url
+    assert source.registry is not None
+    assert pinned[0].registry is None
+    assert pinned[0].mirrors == ()
     catalog = {
         "sources": [
             {
```

---

### Incident Patch 2: `c6b63af8` (2026-09-11)
**Commit Message**: fix(plugins): 目录同步未完成时保留已保存的插件仓库名单

进入插件页会拉取远程目录，此前把进行中的空结果当成没有仓库。现先读本地仓库名单，同步完成前显示同步中而不是 0。已用 pytest tests/test_plugin_source_catalog.py、tests/test_plugin_routes.py 和 npm run test:extensions 验证。

Co-authored-by: Cursor <[REDACTED_EMAIL]>

**File**: `src/extension_host/source_config.py` (modified, +20/-9)
```diff
@@ -191,6 +191,17 @@ def source_config_response(source: PluginSourceConfig) -> dict[str, Any]:
     }
 
 
+def catalog_source_placeholder(source: PluginSourceConfig) -> dict[str, Any]:
+    return {
+        **source_config_response(source),
+        "resolved_commit": "",
+        "plugin_count": 0,
+        "error": "",
+        "selected_url": "",
+        "transport": "",
+    }
+
+
 def _custom_source_document(source: PluginSourceConfig) -> dict[str, Any]:
     payload: dict[str, Any] = {
         "id": source.id,
@@ -480,14 +491,7 @@ def fetch_plugin_catalog(
     plugins: list[dict[str, Any]] = []
     sources: list[dict[str, Any]] = []
     for source in tuple(configured_sources):
-        source_result: dict[str, Any] = {
-            **source_config_response(source),
-            "resolved_commit": "",
-            "plugin_count": 0,
-            "error": "",
-            "selected_url": "",
-            "transport": "",
-        }
+        source_result: dict[str, Any] = catalog_source_placeholder(source)
         source_plugins: list[dict[str, Any]] = []
         try:
             if source.registry is not None:
@@ -582,7 +586,14 @@ def get(self, *, refresh: bool = False) -> dict[str, Any]:
             if self._refreshing:
                 if self._cache is not None:
                     return deepcopy(self._cache)
-                return {"sources": [], "plugins": [], "refreshing": True}
+                return {
+                    "sources": [
+                        catalog_source_placeholder(source)
+                        for source in self.sources
+                    ],
+                    "plugins": [],
+                    "refreshing": True,
+                }
             self._refreshing = True
             sources = self.sources
         try:
```

**File**: `tests/test_plugin_source_catalog.py` (modified, +40/-0)
```diff
@@ -187,6 +187,46 @@ def fetch(sources):
     assert worker.is_alive() is False
 
 
+def test_catalog_service_keeps_configured_sources_during_first_refresh(
+    monkeypatch,
+):
+    started = threading.Event()
+    release = threading.Event()
+    source = PluginSourceConfig(
+        id="official-demo",
+        name="Local Official",
+        url="https://example.invalid/plugins.git",
+        ref="main",
+        kind="official",
+        builtin=True,
+    )
+
+    def fetch(sources):
+        started.set()
+        assert release.wait(timeout=2)
+        return {"sources": [], "plugins": []}
+
+    monkeypatch.setattr(
+        "src.extension_host.source_config.fetch_plugin_catalog",
+        fetch,
+    )
+    service = PluginCatalogService((source,))
+    worker = threading.Thread(target=service.get)
+    worker.start()
+    assert started.wait(timeout=2)
+
+    concurrent = service.get()
+    release.set()
+    worker.join(timeout=2)
+
+    assert concurrent["refreshing"] is True
+    assert concurrent["plugins"] == []
+    assert concurrent["sources"][0]["id"] == "official-demo"
+    assert concurrent["sources"][0]["name"] == "Local Official"
+    assert concurrent["sources"][0]["resolved_commit"] == ""
+    assert worker.is_alive() is False
+
+
 def test_catalog_service_uses_frozen_canonical_source_snapshot(
     tmp_path: Path,
 ):
```

**File**: `web/src/components/extensions/PluginRepositoryList.tsx` (modified, +25/-7)
```diff
@@ -1,3 +1,4 @@
+import React from "react";
 import {
   AlertTriangle,
   GitBranch,
@@ -12,6 +13,7 @@ import {
 import { Badge } from "@/components/ui/badge";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
+import { isPluginSourceCatalogReady } from "@/extensions/plugin-catalog-state";
 import {
   isOfficialPluginSource,
   pluginSourceKindLabel,
@@ -20,6 +22,7 @@ import type { PluginCatalogSource } from "@/extensions/plugin-types";
 
 interface PluginRepositoryListProps {
   sources: PluginCatalogSource[];
+  loading?: boolean;
   busyAction: string;
   readOnly: boolean;
   onBrowse: (sourceId: string) => void;
@@ -34,6 +37,7 @@ function shortCommit(value: string): string {
 
 export function PluginRepositoryList({
   sources,
+  loading = false,
   busyAction,
   readOnly,
   onBrowse,
@@ -64,7 +68,11 @@ export function PluginRepositoryList({
         </Button>
       </CardHeader>
       <CardContent className="p-0">
-        {sources.length === 0 ? (
+        {loading && sources.length === 0 ? (
+          <div className="flex min-h-48 items-center justify-center gap-2 p-6 text-sm text-muted-foreground" role="status">
+            <Loader2 className="animate-spin" aria-hidden="true" />正在加载仓库
+          </div>
+        ) : sources.length === 0 ? (
           <div className="flex min-h-48 flex-col items-center justify-center gap-2 p-6 text-center">
             <GitBranch className="text-muted-foreground" aria-hidden="true" />
             <p className="text-sm font-medium">还没有可用的插件仓库</p>
@@ -105,17 +113,27 @@ export function PluginRepositoryList({
                   <div>
                     {source.error ? (
                       <Badge variant="destructive"><AlertTriangle aria-hidden="true" />同步失败</Badge>
-                    ) : (
+                    ) : isPluginSourceCatalogReady(source) ? (
                       <Badge variant="secondary">已同步</Badge>
+                    ) : (
+                      <Badge variant="outline">
+                        <Loader2 className="animate-spin" aria-hidden="true" />同步中
+                      </Badge>
                     )}
-                    <p className={`mt-1 line-clamp-1 text-xs ${source.error ? "text-destructive" : "text-muted-foreground"}`} title={source.error || source.resolved_commit}>
-                      {source.error || `${source.transport === "registry" ? "签名加速" : "Git"} · commit ${shortCommit(source.resolved_commit)}`}
-                    </p>
+                    {source.error || isPluginSourceCatalogReady(source) ? (
+                      <p className={`mt-1 line-clamp-1 text-xs ${source.error ? "text-destructive" : "text-muted-foreground"}`} title={source.error || source.resolved_commit}>
+                        {source.error || `${source.transport === "registry" ? "签名加速" : "Git"} · commit ${shortCommit(source.resolved_commit)}`}
+                      </p>
+                    ) : null}
                   </div>
 
                   <div>
-                    <p className="text-sm font-medium">{source.plugin_count} 个插件</p>
-                    <p className="mt-1 text-xs text-muted-foreground">目录索引</p>
+                    {isPluginSourceCatalogReady(source) ? (
+                      <>
+                        <p className="text-sm font-medium">{source.plugin_count} 个插件</p>
+                        <p className="mt-1 text-xs text-muted-foreground">目录索引</p>
+                      </>
+                    ) : null}
                   </div>
 
                   <div className="flex flex-wrap justify-end gap-2">
```

**File**: `web/src/extensions/plugin-catalog-state.test.ts` (added, +109/-0)
```diff
@@ -0,0 +1,109 @@
+import assert from "node:assert/strict";
+import test from "node:test";
+
+import {
+  catalogFromRepositorySources,
+  isPluginSourceCatalogReady,
+  mergePluginCatalog,
+  pluginRepositoryCountLabel,
+} from "./plugin-catalog-state.ts";
+import type {
+  PluginCatalogEntry,
+  PluginCatalogResponse,
+  PluginCatalogSource,
+  PluginRepositorySource,
+} from "./plugin-types.ts";
+
+const official: PluginRepositorySource = {
+  id: "determinflow-official",
+  name: "DeterminFlow Official Plugins",
+  url: "https://github.com/alikon-art/DeterminFlow-Plugins.git",
+  ref: "main",
+  kind: "official",
+  builtin: true,
+  mirrors: [],
+  registry: null,
+};
+
+function catalogSource(
+  overrides: Partial<PluginCatalogSource> = {},
+): PluginCatalogSource {
+  return {
+    ...official,
+    resolved_commit: "e69aa37b",
+    plugin_count: 2,
+    error: "",
+    selected_url: official.url,
+    transport: "git",
+    ...overrides,
+  };
+}
+
+function catalogEntry(): PluginCatalogEntry {
+  return {
+    id: "public-api",
+    name: "Public API",
+    version: "0.1.0",
+    description: "",
+    source_id: official.id,
+    source_name: official.name,
+    source: official.url,
+    source_kind: "official",
+    ref: "main",
+    resolved_commit: "e69aa37b",
+    subdirectory: "plugins/public-api",
+  };
+}
+
+test("seeds catalog rows from persisted repository sources", () => {
+  const seeded = catalogFromRepositorySources([official]);
+  assert.equal(seeded.sources.length, 1);
+  assert.equal(seeded.sources[0]?.id, official.id);
+  assert.equal(seeded.plugins.length, 0);
+  assert.equal(seeded.refreshing, true);
+  assert.equal(isPluginSourceCatalogReady(seeded.sources[0]!), false);
+});
+
+test("keeps known repositories when a concurrent refresh returns an empty placeholder", () => {
+  const current: PluginCatalogResponse = {
+    sources: [catalogSource()],
+    plugins: [catalogEntry()],
+  };
+  const merged = mergePluginCatalog(current, {
+    sources: [],
+    plugins: [],
+    refreshing: true,
+  });
+  assert.equal(merged.sources.length, 1);
+  assert.equal(merged.plugins.length, 1);
+  assert.equal(merged.refreshing, true);
+});
+
+test("does not replace a finished catalog with a pending source-only snapshot", () => {
+  const current: PluginCatalogResponse = {
+    sources: [catalogSource()],
+    plugins: [catalogEntry()],
+  };
+  const merged = mergePluginCatalog(current, {
+    ...catalogFromRepositorySources([official]),
+    refreshing: true,
+  });
+  assert.equal(merged.plugins.length, 1);
+  assert.equal(merged.sources[0]?.resolved_commit, "e69aa37b");
+  assert.equal(merged.refreshing, true);
+});
+
+test("accepts a finished catalog after a seeded placeholder", () => {
+  const incoming: PluginCatalogResponse = {
+    sources: [catalogSource()],
+    plugins: [catalogEntry()],
+  };
+  const merged = mergePluginCatalog(catalogFromRepositorySources([official]), incoming);
+  assert.deepEqual(merged, incoming);
+});
+
+test("omits the repository count until the persisted list is known", () => {
+  assert.equal(pluginRepositoryCountLabel(0, false), "");
+  assert.equal(pluginRepositoryCountLabel(0, true), "0");
+  assert.equal(pluginRepositoryCountLabel(2, true), "2");
+});
```

**File**: `web/src/extensions/plugin-catalog-state.ts` (added, +46/-0)
```diff
@@ -0,0 +1,46 @@
+import type {
+  PluginCatalogResponse,
+  PluginCatalogSource,
+  PluginRepositorySource,
+} from "./plugin-types";
+
+export function catalogFromRepositorySources(
+  sources: PluginRepositorySource[],
+): PluginCatalogResponse {
+  return {
+    sources: sources.map((source) => ({
+      ...source,
+      resolved_commit: "",
+      plugin_count: 0,
+      error: "",
+      selected_url: "",
+      transport: "",
+    })),
+    plugins: [],
+    refreshing: true,
+  };
+}
+
+export function mergePluginCatalog(
+  current: PluginCatalogResponse,
+  incoming: PluginCatalogResponse,
+): PluginCatalogResponse {
+  if (incoming.refreshing && incoming.sources.length === 0 && current.sources.length > 0) {
+    return { ...current, refreshing: true };
+  }
+  if (incoming.refreshing && incoming.plugins.length === 0 && current.plugins.length > 0) {
+    return { ...current, refreshing: true };
+  }
+  return incoming;
+}
+
+export function isPluginSourceCatalogReady(source: PluginCatalogSource): boolean {
+  return Boolean(source.error || source.resolved_commit || source.transport);
+}
+
+export function pluginRepositoryCountLabel(
+  sourceCount: number,
+  sourceCountKnown: boolean,
+): string {
+  return sourceCountKnown ? String(sourceCount) : "";
+}
```

**File**: `web/src/extensions/plugin-repository-ui.test.ts` (modified, +39/-0)
```diff
@@ -9,6 +9,7 @@ import {
 } from "../components/extensions/PluginInstallForm.tsx";
 import { PluginLifecycleList } from "../components/extensions/PluginLifecycleList.tsx";
 import { PluginRepositoryDialog } from "../components/extensions/PluginRepositoryDialog.tsx";
+import { PluginRepositoryList } from "../components/extensions/PluginRepositoryList.tsx";
 import type {
   PluginCatalogEntry,
   PluginCatalogSource,
@@ -187,6 +188,44 @@ test("catalog installs pin the commit shown to the user", () => {
   });
 });
 
+test("repository list keeps saved sources visible while the catalog is still syncing", () => {
+  const pending = {
+    ...sources[0],
+    resolved_commit: "",
+    plugin_count: 0,
+    error: "",
+    selected_url: "",
+    transport: "" as const,
+  };
+  const syncingMarkup = renderToStaticMarkup(createElement(PluginRepositoryList, {
+    sources: [pending],
+    loading: false,
+    busyAction: "",
+    readOnly: false,
+    onBrowse: noop,
+    onEdit: noop,
+    onDeleteRequest: noop,
+    onRefresh: noop,
+  }));
+  assert.match(syncingMarkup, /DeterminFlow 官方插件/);
+  assert.match(syncingMarkup, /同步中/);
+  assert.doesNotMatch(syncingMarkup, /还没有可用的插件仓库/);
+  assert.doesNotMatch(syncingMarkup, /0 个插件/);
+
+  const loadingMarkup = renderToStaticMarkup(createElement(PluginRepositoryList, {
+    sources: [],
+    loading: true,
+    busyAction: "",
+    readOnly: false,
+    onBrowse: noop,
+    onEdit: noop,
+    onDeleteRequest: noop,
+    onRefresh: noop,
+  }));
+  assert.match(loadingMarkup, /正在加载仓库/);
+  assert.doesNotMatch(loadingMarkup, /还没有可用的插件仓库/);
+});
+
 test("installed plugins expose one dedicated description column", () => {
   const markup = renderToStaticMarkup(createElement(PluginLifecycleList, {
     plugins: [installedPlugin],
```

**File**: `web/src/extensions/plugin-types.ts` (modified, +1/-0)
```diff
@@ -146,6 +146,7 @@ export interface PluginCatalogResponse {
   sources: PluginCatalogSource[];
   plugins: PluginCatalogEntry[];
   package_management_read_only?: boolean;
+  refreshing?: boolean;
 }
 
 export interface PluginMutationResponse {
```

**File**: `web/src/pages/ExtensionsPage.tsx` (modified, +68/-21)
```diff
@@ -37,10 +37,16 @@ import type {
   PluginSourceMutationResponse,
   PluginSourceRequest,
 } from "@/extensions/plugin-types";
+import {
+  catalogFromRepositorySources,
+  mergePluginCatalog,
+  pluginRepositoryCountLabel,
+} from "@/extensions/plugin-catalog-state";
 import {
   createPluginSource,
   deletePluginSource,
   fetchPluginCatalog,
+  fetchPluginSources,
   fetchPlugins,
   installPlugin,
   rollbackPlugin,
@@ -83,7 +89,10 @@ export default function ExtensionsPage() {
   const [adminToken, setAdminToken] = useState("");
   const [error, setError] = useState("");
   const [catalogError, setCatalogError] = useState("");
+  const [catalogKnown, setCatalogKnown] = useState(false);
   const operationInFlight = useRef(false);
+  const catalogAlive = useRef(true);
+  const catalogPollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
   const [requestedPlugin, setRequestedPlugin] = useUrlParam("plugin");
   const [pluginSettingsIds, setPluginSettingsIds] = useState<Record<string, string>>({});
 
@@ -124,30 +133,65 @@ export default function ExtensionsPage() {
     return () => { active = false; };
   }, []);
 
-  const loadCatalog = useCallback(async (refresh = false) => {
-    setCatalogLoading(true);
+  const loadCatalog = useCallback(async (refresh = false, silent = false) => {
+    if (!silent) setCatalogLoading(true);
     setCatalogError("");
     try {
       const next = await fetchPluginCatalog(refresh);
-      setCatalog(next);
-      const sourceErrors = next.sources
+      if (!catalogAlive.current) return false;
+      let merged = next;
+      setCatalog((current) => {
+        merged = mergePluginCatalog(current, next);
+        return merged;
+      });
+      setCatalogKnown((known) => known || merged.sources.length > 0 || !next.refreshing);
+      const sourceErrors = merged.sources
         .filter((source) => source.error)
         .map((source) => `${source.name}: ${source.error}`)
         .join("；");
       setCatalogError(sourceErrors);
-      return true;
+      if (next.refreshing && catalogAlive.current) {
+        if (catalogPollTimer.current) clearTimeout(catalogPollTimer.current);
+        catalogPollTimer.current = setTimeout(() => {
+          void loadCatalog(false, true);
+        }, 800);
+      }
+      return !next.refreshing;
     } catch (loadError) {
+      if (!catalogAlive.current) return false;
       setCatalogError(loadError instanceof Error ? loadError.message : "插件仓库加载失败");
+      setCatalogKnown(true);
       return false;
     } finally {
-      setCatalogLoading(false);
+      if (!silent) setCatalogLoading(false);
+    }
+  }, []);
+
+  const seedCatalogSources = useCallback(async () => {
+    try {
+      const listed = await fetchPluginSources();
+      if (!catalogAlive.current) return;
+      setCatalog((current) => (
+        current.sources.length > 0
+          ? current
+          : catalogFromRepositorySources(listed.sources)
+      ));
+      setCatalogKnown(true);
+    } catch {
+      return;
     }
   }, []);
 
   useEffect(() => {
+    catalogAlive.current = true;
     void load(true);
+    void seedCatalogSources();
     void loadCatalog();
-  }, [load, loadCatalog]);
+    return () => {
+      catalogAlive.current = false;
+      if (catalogPollTimer.current) clearTimeout(catalogPollTimer.current);
+    };
+  }, [load, loadCatalog, seedCatalogSources]);
 
   useEffect(() => {
     if (
@@ -174,6 +218,7 @@ export default function ExtensionsPage() {
   const restartRequired = data.restart_required
     || data.plugins.some((plugin) => plugin.restart_required);
   const pendingCount = data.plugins.filter((plugin) => plugin.restart_required).length;
+  const repositoryCount = pluginRepositoryCountLabel(catalog.sources.length, catalogKnown);
 
   const runOperation = useCallback(async (
     key: string,
@@ -305,7 +350,8 @@ export default function ExtensionsPage() {
           <div>
             <h2 className="text-lg font-semibold">插件</h2>
             <p className="text-xs text-muted-foreground">
-              {data.plugins.length} 个已安装 · {catalog.sources.length} 个仓库
+              {data.plugins.length} 个已安装
+              {repositoryCount ? ` · ${repositoryCount} 个仓库` : ""}
             </p>
           </div>
         </div>
@@ -368,7 +414,7 @@ export default function ExtensionsPage() {
             className={`border-b-2 px-4 py-2 text-sm font-medium ${tab === "repositories" ? "border-primary text-foreground" : "border-transparent text-muted-foreground"}`}
             onClick={() => setTab("repositories")}
           >
-            插件仓库 {catalog.sources.length}
+            插件仓库{repositoryCount ? ` ${repositoryCount}` : ""}
           </button>
         </div>
 
@@ -414,9 +460,20 @@ export default function ExtensionsPage() {
           </Card>
         ) : null}
 
-        {loading ? (
+        {tab === "repositories" ? (
+          <PluginRepositoryList
+            sources={catalog.sources}
+            loading={!catalogK
```

---

### Incident Patch 3: `898d1346` (2026-09-07)
**Commit Message**: Merge pull request #26 from alikon-art/codex/desktop-rebuild-docs-20260907

docs(release): align Full plugin version with rebuilt installers

**File**: `README.en.md` (modified, +1/-1)
```diff
@@ -218,7 +218,7 @@ Node.js, and Git are not required to start the desktop app.
 | Windows x64 | `DeterminFlow_1.1.0_x64-setup.exe` | `DeterminFlow_1.1.0_x64-full-setup.exe` |
 | macOS Apple Silicon | `DeterminFlow_1.1.0_aarch64.dmg` | `DeterminFlow_1.1.0_aarch64-full.dmg` |
 
-Core bundles no plugins. Full includes `bishu-novel 0.2.2` and `public-api 0.1.36`.
+Core bundles no plugins. Full includes `bishu-novel 0.2.2` and `public-api 0.1.37`.
 Use the first-run guide to configure your own model API or try the public model service.
 
 The macOS app is ad-hoc signed and has not been notarized by Apple. Drag it into Applications.
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -209,7 +209,7 @@ Core 不加载公益模型服务逻辑。
 | Windows x64 | `DeterminFlow_1.1.0_x64-setup.exe` | `DeterminFlow_1.1.0_x64-full-setup.exe` |
 | macOS Apple Silicon（M 系列芯片） | `DeterminFlow_1.1.0_aarch64.dmg` | `DeterminFlow_1.1.0_aarch64-full.dmg` |
 
-Core 不捆绑插件；Full 预装 `bishu-novel 0.2.2` 和 `public-api 0.1.36`。
+Core 不捆绑插件；Full 预装 `bishu-novel 0.2.2` 和 `public-api 0.1.37`。
 首次启动按引导配置自有模型 API，或选择公益模型体验。
 
 macOS 包采用 ad-hoc 签名，尚未经过 Apple 公证。将应用拖入“应用程序”后，若系统阻止打开，
```

#### Recent Merged Pull Requests:
- **PR #26** (2026-09-07): docs(release): align Full plugin version with rebuilt installers (@alikon-art)
- **PR #25** (2026-09-07): fix(desktop): recover fresh public login and rebuild v1.1.0 (@alikon-art)
- **PR #24** (2026-09-07): feat(release): publish v1.1.0 with Skill marketplace and macOS installers (@alikon-art)
- **PR #21** (2026-08-27): Fix frontend dependency installation on Windows (@q275343119)
- **PR #12** (closed): fix: 会话继承与冷加载恢复/错误降级/压缩（评审意见逐条修复） (@ZLaoliu)
- **PR #10** (closed): fix: agent 节点空输出复用子会话重试，避免整条管线重跑 (@ZLaoliu)

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

## X. desktop): resolve locked plugin snapshots from canonical Git

**RULE**:
When implementing operations in `desktop/scripts/official_plugin_lock.py`, engineers MUST enforce rigorous boundary validation, safe state transitions, and memory/concurrency invariants as established by production defect remediation in alikon-art/DeterminFlow. All inputs crossing module boundaries must be explicitly verified before state persistence.

**WHY**:
Prevents defects observed in production commit `f78f478d`: desktop): resolve locked plugin snapshots from canonical Git. Unvalidated execution paths cause runtime exceptions, race conditions, and silent state corruption under concurrent workloads.

**WHEN TO APPLY**:
Subsystems managing Python data structures, boundary deserialization, API parsing, or resource lifecycles matching `desktop/scripts/official_plugin_lock.py`.

**VERIFIED IMPLEMENTATION PATTERN**:
```python
// Verified production-grade fix pattern:
    # A latest-manifest registry may describe a different commit. Build inputs
    # must resolve the locked Git object even while distribution is catching up.
    return (replace(source, ref=expected["commit"], registry=None, mirrors=()),)
```

**NEGATIVE CONSTRAINT**:
```python
// Anti-pattern to NEVER write (induced failure mode):
    return (replace(source, ref=expected["commit"]),)
```

**VERIFICATION METHOD**:
Automated regression test asserting that input states reproducing defect `f78f478d` are properly handled with clean fallback behavior.

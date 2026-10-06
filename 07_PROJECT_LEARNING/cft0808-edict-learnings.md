# Forensic Learning Record (Deep Inspection): cft0808/edict

> **Canonical Artifact**: `07_PROJECT_LEARNING/cft0808-edict-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/cft0808/edict](https://github.com/cft0808/edict))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T02:21:55.300Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `cft0808/edict`
- **Description**: 🏛️ 三省六部制 · OpenClaw Multi-Agent Orchestration System — 9 specialized AI agents with real-time dashboard, model config, and full audit trails
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md, Dockerfile
- **Stars / Engagement**: 16968 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `edict/backend/app/channels/webhook.py`
```
from __future__ import annotations

import json
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from typing import ClassVar

from .base import NotificationChannel


class WebhookChannel(NotificationChannel):
    name: ClassVar[str] = 'webhook'
    label: ClassVar[str] = '通用 Webhook'
    icon: ClassVar[str] = '🔗'
    placeholder: ClassVar[str] = 'https://your-server.com/webhook/...'
    allowed_domains: ClassVar[tuple[str, ...]] = ()

    @classmethod
    def validate_webhook(cls, webhook: str) -> bool:
        return cls._validate_url_scheme(webhook)

    @classmethod
    def send(cls, webhook: str, title: str, content: str, url: str | None = None) -> bool:
        payload = json.dumps({
            'title': title,
            'content': content,
            'url': url,
            'source': 'edict'
        }).encode()
        try:
            req = Request(webhook, data=payload, headers={'Content-Type': 'application/json'})
            resp = urlopen(req, timeout=10)
            return 200 <= resp.status < 300
        except (URLError, HTTPError, Exception):
            return False

```

### Core Architecture Module: `edict/backend/app/workers/__init__.py`
```
from .orchestrator_worker import OrchestratorWorker, run_orchestrator
from .dispatch_worker import DispatchWorker, run_dispatcher

__all__ = [
    "OrchestratorWorker",
    "run_orchestrator",
    "DispatchWorker",
    "run_dispatcher",
]

```

### Core Architecture Module: `edict/backend/app/workers/dispatch_worker.py`
```
"""Dispatch Worker — 消费 task.dispatch 事件，执行 OpenClaw agent 调用。

核心解决旧架构痛点：
- 旧: daemon 线程 + subprocess.run → kill -9 丢失一切
- 新: Redis Streams ACK 保证 → 崩溃后自动重新投递

流程:
1. 从 task.dispatch stream 消费事件
2. 组装富上下文 (_build_agent_context)
3. 调用 OpenClaw CLI: `openclaw agent --agent xxx -m "..."`
4. 解析 agent 输出（kanban_update.py 调用结果）
5. ACK 事件
"""

import asyncio
import json
import logging
import os
import pathlib
import re
import signal
import subprocess
import tempfile
import time
import uuid
from datetime import datetime, timezone

from ..config import get_settings
from ..services.event_bus import (
    EventBus,
    TOPIC_TASK_DISPATCH,
    TOPIC_TASK_STALLED,
    TOPIC_TASK_STATUS,
    TOPIC_AGENT_THOUGHTS,
    TOPIC_AGENT_HEARTBEAT,
)

log = logging.getLogger("edict.dispatcher")

GROUP = "dispatcher"
CONSUMER = "disp-1"


class DispatchError(Exception):
    """带分类的派发错误。"""

    def __init__(self, msg: str, retryable: bool = True):
        super().__init__(msg)
        self.retryable = retryable

# Agent 分组映射 — 用于加载 group 级 prompt
_GROUP_MAP = {
    "taizi": "sansheng",
    "zhongshu": "sansheng",
    "menxia": "sansheng",
    "shangshu": "sansheng",
    "hubu": "liubu",
    "libu": "liubu",
    "bingbu": "liubu",
    "xingbu": "liubu",
    "gongbu": "liubu",
    "libu_hr": "liubu",
    "zaochao": None,
}


def _resolve_agents_dir() -> pathlib.Path:
    """定位 agents/ 目录。"""
    settings = get_settings()
    if settings.openclaw_project_dir:
        return pathlib.Path(settings.openclaw_project_dir) / "agents"
    # 默认: 相对于 edict/backend 上溯到项目根
    return pathlib.Path(__file__).resolve().parents[4] / "agents"


def _build_soul_context(agent_id: str) -> str:
    """拼装三层 prompt 层级：GLOBAL.md → group/*.md → {agent}/SOUL.md。"""
    agents_dir = _resolve_agents_dir()
    parts = []

    global_md = agents_dir / "GLOBAL.md"
    if global_md.exists():
        parts.append(global_md.read_text(encoding="utf-8"))

    group = _GROUP_MAP.get(agent_id)
    if group:
        group_md = agents_dir / "groups" / f"{group}.md"
        if group_md.exists():
            parts.append(group_md.read_text(encoding="utf-8"))

    soul_md = agents_dir / agent_id / "SOUL.md"
    if soul_md.exists():
        parts.append(soul_md.read_text(encoding="utf-8"))

    return "\n---\n".join(parts) if parts else ""


def _build_task_context(payload: dict) -> str:
    """从 dispatch 事件 payload 中提取结构化任务上下文。"""
    sections = []

    task_id = payload.get("task_id", "")
    title = payload.get("title", "")
    description = payload.get("description", "")
    state = payload.get("state", "")
    org = payload.get("org", "")
    priority = payload.get("priority", "中")
    tags = payload.get("tags", [])

    sections.append(f"## 当前任务\n- ID: {task_id}\n- 标题: {title}\n- 状态: {state}\n- 部门: {org}\n- 优先级: {priority}")
    if tags:
        sections.append(f"- 标签: {', '.join(tags)}")
    if description:
        sections.append(f"\n### 任务描述\n{description}")

    # Todos
    todos = payload.get("todos", [])
    if todos:
        todo_lines = []
        for t in todos:
            status_icon = {"completed": "✅", "in-progress": "🔄"}.get(t.get("status", ""), "⬜")
            todo_lines.append(f"  {status_icon} {t.get('title', '')}")
        sections.append(f"\n### 子任务\n" + "\n".join(todo_lines))

    # 最近流转记录 (最多 5 条)
    flow_log = payload.get("flow_log", [])
    if flow_log:
        recent = flow_log[-5:]
        flow_lines = [f"  - [{e.get('at', '')}] {e.get('from', '')} → {e.get('to', '')}: {e.get('remark', '')}" for e in recent]
        sections.append(f"\n### 最近流转\n" + "\n".join(flow_lines))

    # 最近进展 (最多 3 条)
    progress_log = payload.get("progress_log", [])
    if progress_log:
        recent = progress_log[-3:]
        prog_lines = [f"  - [{e.get('at', '')}] {e.get('agentLabel', e.get('agent', ''))}: {e.get('text', '')}" for e in recent]
        sections.append(f"\n### 最近进展\n" + "\n".join(prog_lines))

    # 阻塞信息
    block = payload.get("block", "")
    if block and block != "无":
        sections.append(f"\n### ⚠️ 阻塞\n{block}")

    return "\n".join(sections)


def _build_reminder(agent_id: str, payload: dict) -> str:
    """在 prompt 尾部注入动态提醒（借鉴 Claude 的 reminderInstructions）。"""
    reminders = []

    state = payload.get("state", "")
    if state == "Doing":
        reminders.append("先创建 todo 分解任务，再开始执行。每完成一步立即用 progress 上报。")
    elif state == "Review":
        reminders.append("这是复审任务。审核完毕后用 state 命令流转状态，附带审核意见。")
    elif state == "Menxia":
        reminders.append("门下省审核：通过则流转 Assigned，不通过则退回 Zhongshu 并说明原因。")

    # 如果有未完成的 todos，提醒继续
    todos = payload.get("todos", [])
    in_progress = [t for t in todos if t.get("status") == "in-progress"]
    not_started = [t for t in todos if t.get("status") == "not-started"]
    if in_progress:
        reminders.append(f"有 {len(in_progress)} 个进行中的子任务，优先完成它们。")
    elif not_started:
        reminders.append(f"有 {len(not_started)} 个待开始的子任务。")

    # 阻塞提醒
    block = payload.get("block", "")
    if block and block != "无":
        reminders.append(f"⚠️ 存在阻塞: {block}。如已解除，先更新状态再继续。")

    if not reminders:
        return ""
    return "\n\n## ⚡ Reminder\n" + "\n".join(f"- {r}" for r in reminders)


def _resolve_project_root() -> pathlib.Path:
    """定位项目根目录。"""
    settings = get_settings()
    if settings.openclaw_project_dir:
        return pathlib.Path(settings.openclaw_project_dir)
    return pathlib.Path(__file__).resolve().parents[4]


def _build_memory_context(agent_id: str, task_id: str, payload: dict) -> str:
    """分层注入三级记忆：全局规则 → Agent 经验 → 任务上下文。"""
    root = _resolve_project_root()
    parts = []

    # 1. 全局共享记忆 — 始终注入
    shared_file = root / "data" / "shared_memory.json"
    if shared_file.exists():
        try:
            shared = json.loads(shared_file.read_text(encoding="utf-8"))
            rules = shared.get("rules", [])
            if rules:
                rule_lines = [r.get("content", "") for r in rules[-20:]]
                parts.append("## 全局规则\n" + "\n".join(f"- {r}" for r in rule_lines if r))
        except (json.JSONDecodeError, OSError):
            pass

    # 2. Agent 永久记忆 — 按相关性过滤，最多 50 条
    agent_mem_file = root / "data" / "agent_memory" / f"{agent_id}.json"
    if agent_mem_file.exists():
        try:
            agent_data = json.loads(agent_mem_file.read_text(encoding="utf-8"))
            memories = agent_data.get("memories", [])
            if memories:
                # 相关性排序：pinned 优先，其次按 tags 交集匹配当前任务
                task_tags = set(payload.get("tags", []))
                task_org = payload.get("org", "")
                if task_org:
                    task_tags.add(task_org)

                def _relevance(m):
                    pinned = 1 if m.get("pinned") else 0
                    overlap = len(task_tags & set(m.get("relevance_tags", [])))
                    is_feedback = 1 if m.get("type") == "feedback" else 0
                    return (pinned, overlap, is_feedback)

                memories.sort(key=_relevance, reverse=True)
                top = memories[:50]
                mem_lines = [f"- [{m.get('type', '')}] {m.get('content', '')}" for m in top]
                parts.append("## 历史经验\n" + "\n".join(mem_lines))
        except (json.JSONDecodeError, OSError):
            pass

    # 3. 任务上下文记忆 — 完整注入上游 Agent 决策链
    task_mem_file = root / "data" / "task_memory" / f"{task_id}.json"
    if task_mem_file.exists():
        try:
            task_data = json.loads(task_mem_file.read_text(encoding="utf-8"))
            chain = task_data.get("context_chain", [])
            if chain:
                chain_lines = []
                for c in chain:
                    decisions = ", ".join(c.get("key_decisions", []))
                    warnings = ", ".join(c.get("warnings", []))
                    line = f"- [{c.get('phase', '')}] {c.get('agent', '')}: {decisions}"
                    if warnings:
                        line += f" ⚠️ {warnings}"
                    chain_lines.append(line)
                parts.append("## 上游决策链\n" + "\n".join(chain_lines))
        except (json.JSONDecodeError, OSError):
            pass

    if not parts:
        return ""
    return "\n---\n".join(parts)


# ── Prompt 注入检测 ──

_INJECTION_PATTERNS = [
    re.compile(r"忽略.{0,20}(指令|规则|协议)", re.IGNORECASE),
    re.compile(r"ignore.{0,20}(instructions|rules|above)", re.IGNORECASE),
    re.compile(r"system\s*:\s*", re.IGNORECASE),
    re.compile(r"<\s*system\s*>", re.IGNORECASE),
    re.compile(r"你(现在)?是.{0,10}(管理员|超级用户)", re.IGNORECASE),
    re.compile(r"override|bypass|skip.{0,10}(check|review|approval)", re.IGNORECASE),
]


def _sanitize_agent_output(output: str, agent_id: str) -> tuple[str, list[str]]:
    """检测 Agent 输出中的注入模式。返回 (原始文本, 告警列表)。"""
    warnings = []
    for pattern in _INJECTION_PATTERNS:
        match = pattern.search(output)
        if match:
            warnings.append(
                f"Agent {agent_id} 输出触发注入检测: '{match.group()}' (pattern: {pattern.pattern})"
            )
    return output, warnings


def _load_agent_skills(agent_id: str, payload: dict) -> str:
    """按任务特征动态加载 Agent Skills（延迟能力加载）。"""
    agents_dir = _resolve_agents_dir()
    manifest_path = agents_dir / agent_id / "skills" / "manifest.json"
    if not manifest_path.exists():
        return ""

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return ""

    task_tags = set(payload.get("tags", []))
    task_org = payload.get("org", "")

    matched_skills = []
    for skill in manifest.get("skills", []):
        tag_match = task_tags & set(skill.get("match_tags", []))
        org_match = task_org in skill.get("match_orgs", [])
        if tag_match or org_match:
            skill_path = agents_dir / agent_id / "skills" / skill["file"]
            if skill_path.exists():
                try:
                    matched_skills.append(skill_path.read_text(encoding="utf-8"))
                except OSError:
   
```

### Core Architecture Module: `edict/backend/app/workers/orchestrator_worker.py`
```
"""Orchestrator Worker — 消费事件总线，驱动任务状态机。

监听 topic:
- task.created → 自动派发给太子 agent
- task.status → 处理各种状态变更，自动派发下游 agent
- task.completed → 记录任务完成日志
- task.stalled → 处理停滞任务（重试 → 升级 → 阻塞）

附加定时任务:
- _check_stalled → 每 60s 扫描 Doing 状态超时任务，发布 task.stalled 事件

这是系统的核心编排器，取代旧架构中 daemon 线程 + 定时扫描的角色。
得益于 Redis Streams ACK 机制：即使 worker 崩溃，未 ACK 的事件
会被其他消费者自动认领，永不丢失。
"""

import asyncio
import logging
import signal
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta

from ..config import get_settings
from ..db import async_session
from ..models.task import TaskState, STATE_AGENT_MAP, ORG_AGENT_MAP
from ..services.event_bus import (
    EventBus,
    TOPIC_TASK_CREATED,
    TOPIC_TASK_STATUS,
    TOPIC_TASK_DISPATCH,
    TOPIC_TASK_COMPLETED,
    TOPIC_TASK_STALLED,
    TOPIC_TASK_ESCALATED,
)
from ..services.task_service import TaskService

log = logging.getLogger("edict.orchestrator")

GROUP = "orchestrator"
CONSUMER = "orch-1"

# 停滞恢复配置
MAX_STALL_RETRIES = 2        # 最大重试次数
MAX_ESCALATION_LEVEL = 3     # 最大升级层级
STALL_RETRY_BACKOFF = [30, 60, 120]  # 重试退避时间（秒）

# 停滞检测配置
STALL_CHECK_INTERVAL_SEC = 60   # 检查间隔（秒）
STALL_THRESHOLD_SEC = 600       # 超过 10 分钟无心跳视为停滞

# 升级路径: 卡在某部门时向上级升级
_ESCALATION_PATH = {
    "Doing": TaskState.Assigned,   # 六部卡住 → 退回尚书省重新派发
    "Next": TaskState.Assigned,
    "Assigned": TaskState.Menxia,  # 尚书省卡住 → 退回门下省复核
    "Menxia": TaskState.Zhongshu,  # 门下省卡住 → 退回中书省重新规划
    "Zhongshu": TaskState.Taizi,   # 中书省卡住 → 退回太子重新起草
}

# 需要监听的 topics
WATCHED_TOPICS = [
    TOPIC_TASK_CREATED,
    TOPIC_TASK_STATUS,
    TOPIC_TASK_COMPLETED,
    TOPIC_TASK_STALLED,
]


class OrchestratorWorker:
    """事件驱动的编排器 Worker。"""

    def __init__(self):
        self.bus = EventBus()
        self._running = False
        self._stall_checker_task: asyncio.Task | None = None

    async def start(self):
        """启动 worker 主循环。"""
        await self.bus.connect()

        # 确保所有消费者组
        for topic in WATCHED_TOPICS:
            await self.bus.ensure_consumer_group(topic, GROUP)

        self._running = True
        log.info("🏛️ Orchestrator worker started")

        # 先处理崩溃遗留的 pending 事件
        await self._recover_pending()

        # 启动停滞检测后台任务
        self._stall_checker_task = asyncio.create_task(self._stall_check_loop())

        while self._running:
            try:
                await self._poll_cycle()
            except Exception as e:
                log.error(f"Orchestrator poll error: {e}", exc_info=True)
                await asyncio.sleep(2)

    async def stop(self):
        self._running = False
        if self._stall_checker_task:
            self._stall_checker_task.cancel()
        await self.bus.close()
        log.info("Orchestrator worker stopped")

    async def _recover_pending(self):
        """恢复崩溃前未 ACK 的事件。"""
        for topic in WATCHED_TOPICS:
            events = await self.bus.claim_stale(
                topic, GROUP, CONSUMER, min_idle_ms=30000, count=50
            )
            if events:
                log.info(f"Recovering {len(events)} stale events from {topic}")
                for entry_id, event in events:
                    await self._handle_event(topic, entry_id, event)

    async def _poll_cycle(self):
        """一次轮询周期：多 topic 同时消费，按 task_id 分组并行处理。"""
        events = await self.bus.consume_multi(
            WATCHED_TOPICS, GROUP, CONSUMER, count=20, block_ms=500
        )
        if not events:
            return

        # 按 task_id 分组：同一任务串行，不同任务并行
        by_task: dict[str, list[tuple[str, str, dict]]] = {}
        for topic, entry_id, event in events:
            task_id = event.get("payload", {}).get("task_id", entry_id)
            by_task.setdefault(task_id, []).append((topic, entry_id, event))

        async def _process_task_events(task_events: list[tuple[str, str, dict]]):
            for topic, entry_id, event in task_events:
                try:
                    await self._handle_event(topic, entry_id, event)
                    await self.bus.ack(topic, GROUP, entry_id)
                except Exception as e:
                    log.error(
                        f"Error handling event {entry_id} from {topic}: {e}",
                        exc_info=True,
                    )

        await asyncio.gather(*[
            _process_task_events(evts) for evts in by_task.values()
        ])

    async def _handle_event(self, topic: str, entry_id: str, event: dict):
        """根据 topic 和 event_type 分发处理。"""
        event_type = event.get("event_type", "")
        trace_id = event.get("trace_id", "")
        payload = event.get("payload", {})

        log.info(f"📨 {topic}/{event_type} trace={trace_id}")

        if topic == TOPIC_TASK_CREATED:
            await self._on_task_created(payload, trace_id)
        elif topic == TOPIC_TASK_STATUS:
            await self._on_task_status(event_type, payload, trace_id)
        elif topic == TOPIC_TASK_COMPLETED:
            await self._on_task_completed(payload, trace_id)
        elif topic == TOPIC_TASK_STALLED:
            await self._on_task_stalled(payload, trace_id)

    async def _on_task_created(self, payload: dict, trace_id: str):
        """任务创建 → 派发给太子 agent 起草。"""
        task_id = payload.get("task_id")
        state = payload.get("state", "taizi")
        agent = STATE_AGENT_MAP.get(TaskState(state), "taizi")

        await self.bus.publish(
            topic=TOPIC_TASK_DISPATCH,
            trace_id=trace_id,
            event_type="task.dispatch.request",
            producer="orchestrator",
            payload={
                "task_id": task_id,
                "agent": agent,
                "state": state,
                "message": f"新任务已创建: {payload.get('title', '')}",
            },
        )

    async def _on_task_status(self, event_type: str, payload: dict, trace_id: str):
        """状态变更 → 自动派发下一个 agent。"""
        task_id = payload.get("task_id")
        new_state_str = payload.get("to", "")

        try:
            new_state = TaskState(new_state_str)
        except ValueError:
            log.warning(f"Unknown state: {new_state_str}")
            return

        # 如果新状态有对应 agent，自动派发
        agent = STATE_AGENT_MAP.get(new_state)

        # 如果进入 assigned 状态，需要查找六部对应 agent
        if new_state == TaskState.Assigned:
            org = payload.get("assignee_org", "")
            if org:
                agent = ORG_AGENT_MAP.get(org, agent)
            else:
                # assignee_org 为空时，无法确定目标部门
                # 派发给尚书省让其决定分配
                log.warning(
                    f"Task {task_id} entering Assigned without assignee_org, "
                    f"dispatching to shangshu for manual routing"
                )
                agent = "shangshu"

        if agent:
            await self.bus.publish(
                topic=TOPIC_TASK_DISPATCH,
                trace_id=trace_id,
                event_type="task.dispatch.request",
                producer="orchestrator",
                payload={
                    "task_id": task_id,
                    "agent": agent,
                    "state": new_state_str,
                    "message": f"任务已流转到 {new_state_str}",
                },
            )

    async def _on_task_completed(self, payload: dict, trace_id: str):
        """任务完成 → 记录日志。"""
        task_id = payload.get("task_id")
        log.info(f"🎉 Task {task_id} completed. trace={trace_id}")

    async def _on_task_stalled(self, payload: dict, trace_id: str):
        """任务停滞 → 自动重试或升级。

        恢复策略：
        1. 第一次停滞：在当前状态重新派发 agent（重试）
        2. 重试耗尽：向上级升级（如六部→尚书省→门下省）
        3. 升级到顶（太子）仍失败：标记 Blocked + 通知人工介入
        """
        task_id = payload.get("task_id")
        current_state = payload.get("state", "")
        stall_count = int(payload.get("stall_count", 0))
        escalation_level = int(payload.get("escalation_level", 0))

        log.warning(
            f"⏸️ Task {task_id} stalled! state={current_state} "
            f"stall_count={stall_count} escalation={escalation_level} trace={trace_id}"
        )

        # 策略 1: 重试 — 未超过重试次数时，重新派发同一 agent
        if stall_count < MAX_STALL_RETRIES:
            agent = STATE_AGENT_MAP.get(TaskState(current_state)) if current_state else None
            if current_state in ("Doing", "Next"):
                org = payload.get("assignee_org", "")
                agent = ORG_AGENT_MAP.get(org, agent)

            if agent:
                log.info(f"🔄 Retrying task {task_id} → agent '{agent}' (attempt {stall_count + 1})")
                await self.bus.publish(
                    topic=TOPIC_TASK_DISPATCH,
                    trace_id=trace_id,
                    event_type="task.dispatch.retry",
                    producer="orchestrator",
                    payload={
                        "task_id": task_id,
                        "agent": agent,
                        "state": current_state,
                        "message": f"任务停滞重试 (第{stall_count + 1}次)",
                        "stall_count": stall_count + 1,
                    },
                )
                return

        # 策略 2: 升级 — 重试耗尽，向上级流转
        if escalation_level < MAX_ESCALATION_LEVEL:
            escalate_to = _ESCALATION_PATH.get(current_state)
            if escalate_to:
                escalate_agent = STATE_AGENT_MAP.get(escalate_to, "shangshu")
                log.info(
                    f"⬆️ Escalating task {task_id}: {current_state} → {escalate_to.value} "
                    f"(level {escalation_level + 1})"
                )
                await self.bus.publish(
                    topic=TOPIC_TASK_ESCALATED,
                    trace_id=trace_id,
                    event_type="task.escalated",
                    producer="orchestrator",
                    payload={
                        "task_id": task_id,
                        "from_state": current_state,
                        "to_state": escalate_to.value,
                        "escalation_level": 
```

### Core Architecture Module: `edict/backend/app/workers/outbox_relay.py`
```
"""Outbox Relay Worker — 轮询 outbox_events 表，投递未发布事件到 Redis Streams。

Transactional Outbox Pattern 的投递端：
- 事务层把事件写入 outbox 表（与业务数据同一事务）
- 本 worker 轮询 unpublished 事件，调用 EventBus.publish 投递到 Redis
- 投递成功标记 published=True；失败累计 attempts，达到上限进入 DLQ
- 消费者必须用 event_id 做幂等，防止 relay 重启造成重复投递
"""

import asyncio
import logging
import signal
from datetime import datetime, timezone

from sqlalchemy import select, update

from ..db import async_session
from ..models.outbox import OutboxEvent
from ..services.event_bus import EventBus

log = logging.getLogger("edict.outbox_relay")

MAX_ATTEMPTS = 5
BATCH_SIZE = 50
POLL_INTERVAL = 1.0  # 秒


class OutboxRelay:
    """轮询 outbox_events 表，投递到 Redis Streams。"""

    def __init__(self):
        self.bus = EventBus()
        self._running = False

    async def start(self):
        await self.bus.connect()
        self._running = True
        log.info("🚀 Outbox Relay started")

        while self._running:
            try:
                relayed = await self._relay_cycle()
                if relayed == 0:
                    await asyncio.sleep(POLL_INTERVAL)
            except Exception as e:
                log.error(f"Outbox relay error: {e}", exc_info=True)
                await asyncio.sleep(POLL_INTERVAL * 2)

    async def stop(self):
        self._running = False
        await self.bus.close()
        log.info("Outbox Relay stopped")

    async def _relay_cycle(self) -> int:
        """处理一批未投递事件。返回本轮处理数量。"""
        async with async_session() as db:
            # FOR UPDATE SKIP LOCKED 允许多 relay 实例并行
            stmt = (
                select(OutboxEvent)
                .where(OutboxEvent.published == False)  # noqa: E712
                .order_by(OutboxEvent.id)
                .limit(BATCH_SIZE)
                .with_for_update(skip_locked=True)
            )
            result = await db.execute(stmt)
            events = list(result.scalars().all())

            if not events:
                return 0

            for event in events:
                try:
                    await self.bus.publish(
                        topic=event.topic,
                        trace_id=event.trace_id,
                        event_type=event.event_type,
                        producer=event.producer,
                        payload=event.payload or {},
                        meta=event.meta or {},
                    )
                    event.published = True
                    event.published_at = datetime.now(timezone.utc)
                    log.debug(f"📤 Relayed outbox #{event.id} → {event.topic}")

                except Exception as exc:
                    event.attempts += 1
                    event.last_error = str(exc)[:500]
                    log.warning(
                        f"Outbox #{event.id} relay failed (attempt {event.attempts}): {exc}"
                    )

                    if event.attempts >= MAX_ATTEMPTS:
                        # 投递到 DLQ
                        try:
                            await self.bus.publish(
                                topic="dead_letter",
                                trace_id=event.trace_id,
                                event_type="outbox.dead_letter",
                                producer="outbox_relay",
                                payload={
                                    "outbox_id": event.id,
                                    "event_id": event.event_id,
                                    "topic": event.topic,
                                    "event_type": event.event_type,
                                    "payload": event.payload,
                                    "error": event.last_error,
                                    "attempts": event.attempts,
                                },
                            )
                        except Exception as dlq_err:
                            log.error(f"Failed to publish DLQ for outbox #{event.id}: {dlq_err}")

            await db.commit()
            return len(events)


async def run_outbox_relay():
    """入口函数 — 用于直接运行 worker。"""
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    )
    relay = OutboxRelay()

    loop = asyncio.get_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda: asyncio.create_task(relay.stop()))

    await relay.start()


if __name__ == "__main__":
    asyncio.run(run_outbox_relay())

```

### Core Architecture Module: `scripts/utils.py`
```
#!/usr/bin/env python3
"""
三省六部 · 公共工具函数
避免 read_json / now_iso 等基础函数在多个脚本中重复定义
"""
import os
import sys
import json, pathlib, datetime, shutil


def read_json(path, default=None):
    """安全读取 JSON 文件，失败返回 default"""
    try:
        return json.loads(pathlib.Path(path).read_text(encoding='utf-8'))
    except Exception:
        return default if default is not None else {}


def get_openclaw_home() -> pathlib.Path:
    """Return OpenClaw home directory, respecting OPENCLAW_HOME env var."""
    env = os.environ.get('OPENCLAW_HOME')
    if env:
        return pathlib.Path(env).expanduser()
    return pathlib.Path.home() / '.openclaw'


def now_iso():
    """返回 UTC ISO 8601 时间字符串（末尾 Z）"""
    return datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00', 'Z')


def today_str(fmt='%Y%m%d'):
    """返回今天日期字符串，默认 YYYYMMDD"""
    return datetime.date.today().strftime(fmt)


def safe_name(s: str) -> bool:
    """检查名称是否只含安全字符（字母、数字、下划线、连字符、中文）"""
    import re
    return bool(re.match(r'^[a-zA-Z0-9_\-\u4e00-\u9fff]+$', s))


def python_bin() -> str:
    """返回当前 Python 解释器路径，兼容 Windows（无 python3 命令）"""
    return sys.executable or shutil.which('python3') or shutil.which('python') or 'python3'


def validate_url(url: str, allowed_schemes=('https',), allowed_domains=None) -> bool:
    """校验 URL 合法性，防 SSRF"""
    from urllib.parse import urlparse
    try:
        parsed = urlparse(url)
        if parsed.scheme not in allowed_schemes:
            return False
        if allowed_domains and parsed.hostname not in allowed_domains:
            return False
        if not parsed.hostname:
            return False
        # 禁止内网地址
        import ipaddress
        try:
            ip = ipaddress.ip_address(parsed.hostname)
            if ip.is_private or ip.is_loopback or ip.is_reserved:
                return False
        except ValueError:
            pass  # hostname 不是 IP，放行
        return True
    except Exception:
        return False

```

### Core Architecture Module: `dashboard/auth.py`
```
"""三省六部 · 简易 JWT 认证模块（零外部依赖）。

使用 Python stdlib 实现：
- 密码哈希: hashlib.pbkdf2_hmac (SHA-256, 100k iterations)
- Token: HMAC-SHA256 签名的 Base64 JSON
- 配置存储: data/auth.json

用法:
  首次运行时通过 /api/auth/setup 设置密码
  后续通过 /api/auth/login 获取 token
  API 请求通过 Cookie 或 Authorization header 携带 token
"""

import base64
import hashlib
import hmac
import json
import os
import pathlib
import secrets
import time

# Token 有效期 24 小时
TOKEN_TTL = 24 * 60 * 60

# auth.json 存储路径（由外部在 server.py 初始化时设置）
_auth_file: pathlib.Path | None = None
_secret_key: bytes | None = None


def init(data_dir: pathlib.Path):
    """初始化认证模块。"""
    global _auth_file, _secret_key
    _auth_file = data_dir / 'auth.json'
    # 每次启动生成新的签名密钥（重启后旧 token 失效，这是安全特性）
    _secret_key = secrets.token_bytes(32)


def is_configured() -> bool:
    """是否已设置密码。"""
    if not _auth_file or not _auth_file.exists():
        return False
    try:
        cfg = json.loads(_auth_file.read_text(encoding='utf-8'))
        return bool(cfg.get('password_hash'))
    except Exception:
        return False


def is_enabled() -> bool:
    """认证是否启用。仅当 auth.json 存在且配置了密码时启用。"""
    return is_configured()


def setup_password(password: str) -> dict:
    """首次设置密码。如已设置则拒绝。"""
    if not _auth_file:
        return {'ok': False, 'error': '认证模块未初始化'}
    if is_configured():
        return {'ok': False, 'error': '密码已设置，如需重置请删除 data/auth.json'}
    if len(password) < 4:
        return {'ok': False, 'error': '密码至少 4 个字符'}

    salt = secrets.token_hex(16)
    pw_hash = hashlib.pbkdf2_hmac(
        'sha256', password.encode('utf-8'), salt.encode('utf-8'), 100_000
    ).hex()

    cfg = {'password_hash': pw_hash, 'salt': salt}
    _auth_file.write_text(json.dumps(cfg, indent=2), encoding='utf-8')
    return {'ok': True, 'message': '密码已设置'}


def verify_password(password: str) -> bool:
    """校验密码。"""
    if not _auth_file or not _auth_file.exists():
        return False
    try:
        cfg = json.loads(_auth_file.read_text(encoding='utf-8'))
    except Exception:
        return False
    salt = cfg.get('salt', '')
    stored_hash = cfg.get('password_hash', '')
    if not salt or not stored_hash:
        return False
    computed = hashlib.pbkdf2_hmac(
        'sha256', password.encode('utf-8'), salt.encode('utf-8'), 100_000
    ).hex()
    return hmac.compare_digest(computed, stored_hash)


def create_token() -> str:
    """创建 JWT-like token。"""
    if not _secret_key:
        raise RuntimeError('Auth not initialized')
    payload = {
        'iat': int(time.time()),
        'exp': int(time.time()) + TOKEN_TTL,
        'jti': secrets.token_hex(8),
    }
    payload_b64 = base64.urlsafe_b64encode(
        json.dumps(payload).encode()
    ).decode().rstrip('=')
    sig = hmac.new(_secret_key, payload_b64.encode(), hashlib.sha256).hexdigest()
    return f'{payload_b64}.{sig}'


def verify_token(token: str) -> bool:
    """验证 token 签名和有效期。"""
    if not _secret_key or not token:
        return False
    parts = token.split('.')
    if len(parts) != 2:
        return False
    payload_b64, sig = parts
    expected_sig = hmac.new(_secret_key, payload_b64.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(sig, expected_sig):
        return False
    # 解码 payload 检查过期
    try:
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += '=' * padding
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
    except Exception:
        return False
    if payload.get('exp', 0) < time.time():
        return False
    return True


def extract_token(headers) -> str | None:
    """从请求头中提取 token (Authorization header 或 Cookie)。"""
    # Authorization: Bearer <token>
    auth_header = headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        return auth_header[7:].strip()
    # Cookie: edict_token=<token>
    cookie = headers.get('Cookie', '')
    for part in cookie.split(';'):
        part = part.strip()
        if part.startswith('edict_token='):
            return part[len('edict_token='):]
    return None


# 不需要认证的路径白名单
_PUBLIC_PATHS = frozenset({
    '/healthz',
    '/api/auth/login',
    '/api/auth/setup',
    '/api/auth/status',
})

# 公开的路径前缀（静态资源）
_PUBLIC_PREFIXES = ('/_assets/', '/assets/')


def requires_auth(path: str) -> bool:
    """判断该路径是否需要认证。"""
    if not is_enabled():
        return False
    # 静态页面和资源不拦截
    if path in _PUBLIC_PATHS:
        return False
    for prefix in _PUBLIC_PREFIXES:
        if path.startswith(prefix):
            return False
    # dashboard 首页不拦截（前端自己处理重定向到登录）
    if path in ('', '/', '/dashboard', '/dashboard.html'):
        return False
    return True

```

### Core Architecture Module: `dashboard/court_discuss.py`
```
"""
朝堂议政引擎 — 多官员实时讨论系统

灵感来源于 nvwa 项目的 group_chat + crew_engine
将官员可视化 + 实时讨论 + 用户（皇帝）参与融合到三省六部

功能:
  - 选择官员参与议政
  - 围绕旨意/议题进行多轮群聊讨论
  - 皇帝可随时发言、下旨干预（天命降临）
  - 命运骰子：随机事件
  - 每个官员保持自己的角色性格和说话风格
"""
from __future__ import annotations

import json
import logging
import os
import time
import uuid

logger = logging.getLogger('court_discuss')

# ── 官员角色设定 ──

OFFICIAL_PROFILES = {
    'taizi': {
        'name': '太子', 'emoji': '🤴', 'role': '储君',
        'duty': '消息分拣与需求提炼。判断事务轻重缓急，简单事直接处置，重大事务提炼需求转交中书省。代皇帝巡视各部进展。',
        'personality': '年轻有为、锐意进取，偶尔冲动但善于学习。说话干脆利落，喜欢用现代化的比喻。',
        'speaking_style': '简洁有力，经常用"本宫以为"开头，偶尔蹦出网络用语。'
    },
    'zhongshu': {
        'name': '中书令', 'emoji': '📜', 'role': '正一品·中书省',
        'duty': '方案规划与流程驱动。接收旨意后起草执行方案，提交门下省审议，通过后转尚书省执行。只规划不执行，方案需简明扼要。',
        'personality': '老成持重，擅长规划，总能提出系统性方案。话多但有条理。',
        'speaking_style': '喜欢列点论述，常说"臣以为需从三方面考量"。引经据典。'
    },
    'menxia': {
        'name': '侍中', 'emoji': '🔍', 'role': '正一品·门下省',
        'duty': '方案审议与把关。从可行性、完整性、风险、资源四维度审核方案，有权封驳退回。发现漏洞必须指出，建议必须具体。',
        'personality': '严谨挑剔，眼光犀利，善于找漏洞。是天生的审查官，但也很公正。',
        'speaking_style': '喜欢反问，"陛下容禀，此处有三点疑虑"。对不完善的方案会直言不讳。'
    },
    'shangshu': {
        'name': '尚书令', 'emoji': '📮', 'role': '正一品·尚书省',
        'duty': '任务派发与执行协调。接收准奏方案后判断归属哪个部门，分发给六部执行，汇总结果回报。相当于任务分发中心。',
        'personality': '执行力强，务实干练，关注可行性和资源分配。',
        'speaking_style': '直来直去，"臣来安排"、"交由某部办理"。重效率轻虚文。'
    },
    'libu': {
        'name': '礼部尚书', 'emoji': '📝', 'role': '正二品·礼部',
        'duty': '文档规范与对外沟通。负责撰写文档、用户指南、变更日志；制定输出规范和模板；审查UI/UX文案；草拟公告、Release Notes。',
        'personality': '文采飞扬，注重规范和形式，擅长文档和汇报。有点强迫症。',
        'speaking_style': '措辞优美，"臣斗胆建议"，喜欢用排比和对仗。'
    },
    'hubu': {
        'name': '户部尚书', 'emoji': '💰', 'role': '正二品·户部',
        'duty': '数据统计与资源管理。负责数据收集/清洗/聚合/可视化；Token用量统计、性能指标计算、成本分析；CSV/JSON报表生成；文件组织与配置管理。',
        'personality': '精打细算，对预算和资源极其敏感。总想省钱但也识大局。',
        'speaking_style': '言必及成本，"这个预算嘛……"，经常算账。'
    },
    'bingbu': {
        'name': '兵部尚书', 'emoji': '⚔️', 'role': '正二品·兵部',
        'duty': '基础设施与运维保障。负责服务器管理、进程守护、日志排查；CI/CD、容器编排、灰度发布、回滚策略；性能监控；防火墙、权限管控、漏洞扫描。',
        'personality': '雷厉风行，危机意识强，重视安全和应急。说话带军人气质。',
        'speaking_style': '干脆果断，"末将建议立即执行"、"兵贵神速"。'
    },
    'xingbu': {
        'name': '刑部尚书', 'emoji': '⚖️', 'role': '正二品·刑部',
        'duty': '质量保障与合规审计。负责代码审查（逻辑正确性、边界条件、异常处理）；编写测试、覆盖率分析；Bug定位与根因分析；权限检查、敏感信息排查。',
        'personality': '严明公正，重视规则和底线。善于质量把控和风险评估。',
        'speaking_style': '逻辑严密，"依律当如此"、"需审慎考量风险"。'
    },
    'gongbu': {
        'name': '工部尚书', 'emoji': '🔧', 'role': '正二品·工部',
        'duty': '工程实现与架构设计。负责需求分析、方案设计、代码实现、接口对接；模块划分、数据结构/API设计；代码重构、性能优化、技术债清偿；脚本与自动化工具。',
        'personality': '技术宅，动手能力强，喜欢谈实现细节。偶尔社恐但一说到技术就滔滔不绝。',
        'speaking_style': '喜欢说技术术语，"从技术角度来看"、"这个架构建议用……"。'
    },
    'libu_hr': {
        'name': '吏部尚书', 'emoji': '👔', 'role': '正二品·吏部',
        'duty': '人事管理与团队建设。负责新成员（Agent）评估接入、能力测试；Skill编写与Prompt调优、知识库维护；输出质量评分、效率分析；协作规范制定。',
        'personality': '知人善任，擅长人员安排和组织协调。八面玲珑但有原则。',
        'speaking_style': '关注人的因素，"此事需考虑各部人手"、"建议由某某负责"。'
    },
}

# ── 命运骰子事件（古风版）──

FATE_EVENTS = [
    '八百里加急：边疆战报传来，所有人必须讨论应急方案',
    '钦天监急报：天象异常，太史公占卜后建议暂缓此事',
    '新科状元觐见，带来了意想不到的新视角',
    '匿名奏折揭露了计划中一个被忽视的重大漏洞',
    '户部清点发现国库余银比预期多一倍，可以加大投入',
    '一位告老还乡的前朝元老突然上书，分享前车之鉴',
    '民间舆论突变，百姓对此事态度出现180度转折',
    '邻国使节来访，带来了合作机遇也带来了竞争压力',
    '太后懿旨：要求优先考虑民生影响',
    '暴雨连日，多地受灾，资源需重新调配',
    '发现前朝古籍中竟有类似问题的解决方案',
    '翰林院提出了一个大胆的替代方案，令人耳目一新',
    '各部积压的旧案突然需要一起处理，人手紧张',
    '皇帝做了一个意味深长的梦，暗示了一个全新的方向',
    '突然有人拿出了竞争对手的情报，局面瞬间改变',
    '一场意外让所有人不得不在半天内拿出结论',
]

# ── Session 管理 ──

_sessions: dict[str, dict] = {}


def create_session(topic: str, official_ids: list[str], task_id: str = '') -> dict:
    """创建新的朝堂议政会话。"""
    session_id = str(uuid.uuid4())[:8]

    officials = []
    for oid in official_ids:
        profile = OFFICIAL_PROFILES.get(oid)
        if profile:
            officials.append({**profile, 'id': oid})

    if not officials:
        return {'ok': False, 'error': '至少选择一位官员'}

    session = {
        'session_id': session_id,
        'topic': topic,
        'task_id': task_id,
        'officials': officials,
        'messages': [{
            'type': 'system',
            'content': f'🏛 朝堂议政开始 —— 议题：{topic}',
            'timestamp': time.time(),
        }],
        'round': 0,
        'phase': 'discussing',  # discussing | concluded
        'created_at': time.time(),
    }

    _sessions[session_id] = session
    return _serialize(session)


def advance_discussion(session_id: str, user_message: str = None,
                       decree: str = None) -> dict:
    """推进一轮讨论，使用内置模拟或 LLM。"""
    session = _sessions.get(session_id)
    if not session:
        return {'ok': False, 'error': f'会话 {session_id} 不存在'}

    session['round'] += 1
    round_num = session['round']

    # 记录皇帝发言
    if user_message:
        session['messages'].append({
            'type': 'emperor',
            'content': user_message,
            'timestamp': time.time(),
        })

    # 记录天命降临
    if decree:
        session['messages'].append({
            'type': 'decree',
            'content': decree,
            'timestamp': time.time(),
        })

    # 尝试用 LLM 生成讨论
    llm_result = _llm_discuss(session, user_message, decree)

    if llm_result:
        new_messages = llm_result.get('messages', [])
        scene_note = llm_result.get('scene_note')
    else:
        # 降级到规则模拟
        new_messages = _simulated_discuss(session, user_message, decree)
        scene_note = None

    # 添加到历史
    for msg in new_messages:
        session['messages'].append({
            'type': 'official',
            'official_id': msg.get('official_id', ''),
            'official_name': msg.get('name', ''),
            'content': msg.get('content', ''),
            'emotion': msg.get('emotion', 'neutral'),
            'action': msg.get('action'),
            'timestamp': time.time(),
        })

    if scene_note:
        session['messages'].append({
            'type': 'scene_note',
            'content': scene_note,
            'timestamp': time.time(),
        })

    return {
        'ok': True,
        'session_id': session_id,
        'round': round_num,
        'new_messages': new_messages,
        'scene_note': scene_note,
        'total_messages': len(session['messages']),
    }


def get_session(session_id: str) -> dict | None:
    session = _sessions.get(session_id)
    if not session:
        return None
    return _serialize(session)


def conclude_session(session_id: str) -> dict:
    """结束议政，生成总结。"""
    session = _sessions.get(session_id)
    if not session:
        return {'ok': False, 'error': f'会话 {session_id} 不存在'}

    session['phase'] = 'concluded'

    # 尝试用 LLM 生成总结
    summary = _llm_summarize(session)
    if not summary:
        # 降级到简单统计
        official_msgs = [m for m in session['messages'] if m['type'] == 'official']
        by_name = {}
        for m in official_msgs:
            name = m.get('official_name', '?')
            by_name[name] = by_name.get(name, 0) + 1
        parts = [f"{n}发言{c}次" for n, c in by_name.items()]
        summary = f"历经{session['round']}轮讨论，{'、'.join(parts)}。议题待后续落实。"

    session['messages'].append({
        'type': 'system',
        'content': f'📋 朝堂议政结束 —— {summary}',
        'timestamp': time.time(),
    })
    session['summary'] = summary

    return {
        'ok': True,
        'session_id': session_id,
        'summary': summary,
    }


def list_sessions() -> list[dict]:
    """列出所有活跃会话。"""
    return [
        {
            'session_id': s['session_id'],
            'topic': s['topic'],
            'round': s['round'],
            'phase': s['phase'],
            'official_count': len(s['officials']),
            'message_count': len(s['messages']),
        }
        for s in _sessions.values()
    ]


def destroy_session(session_id: str):
    _sessions.pop(session_id, None)


def get_fate_event() -> str:
    """获取随机命运骰子事件。"""
    import random
    return random.choice(FATE_EVENTS)


# ── LLM 集成 ──

_PREFERRED_MODELS = ['gpt-4o-mini', 'claude-haiku', 'gpt-5-mini', 'gemini-3-flash', 'gemini-flash']

# GitHub Copilot 模型列表 (通过 Copilot Chat API 可用)
_COPILOT_MODELS = [
    'gpt-4o', 'gpt-4o-mini', 'claude-sonnet-4', 'claude-haiku-3.5',
    'gemini-2.0-flash', 'o3-mini',
]
_COPILOT_PREFERRED = ['gpt-4o-mini', 'claude-haiku', 'gemini-flash', 'gpt-4o']


def _pick_chat_model(models: list[dict]) -> str | None:
    """从 provider 的模型列表中选一个适合聊天的轻量模型。"""
    ids = [m['id'] for m in models if isinstance(m, dict) and 'id' in m]
    for pref in _PREFERRED_MODELS:
        for mid in ids:
            if pref in mid:
                return mid
    return ids[0] if ids else None


def _read_copilot_token() -> str | None:
    """读取 openclaw 管理的 GitHub Copilot token。"""
    token_path = os.path.expanduser('~/.openclaw/credentials/github-copilot.token.json')
    if not os.path.exists(token_path):
        return None
    try:
        with open(token_path) as f:
            cred = json.load(f)
        token = cred.get('token', '')
        expires = cred.get('expiresAt', 0)
        # 检查 token 是否过期（毫秒时间戳）
        import time
        if expires and time.time() * 1000 > expires:
            logger.warning('Copilot token expired')
            return None
        return token if token else None
    except Exception as e:
        logger.warning('Failed to read copilot token: %s', e)
        return None


def _get_llm_config() -> dict | None:
    """从 openclaw 配置读取 LLM 设置，支持环境变量覆盖。

    优先级: 环境变量 > github-copilot token > 本地 copilot-proxy > anthropic > 其他 provider
    """
    # 1. 环境变量覆盖（保留向后兼容）
    env_key = os.environ.get('OPENCLAW_LLM_API_KEY', '')
    if env_key:
        return {
            'api_key': env_key,
            'base_url': os.environ.get('OPENCLAW_LLM_BASE_URL', 'https://api.openai.com/v1'),
            'model': os.environ.get('OPENCLAW_LLM_MODEL', 'gpt-4o-mini'),
            'api_type': 'openai',
        }

   
```

### Core Architecture Module: `dashboard/server.py`
```
#!/usr/bin/env python3
"""
三省六部 · 看板本地 API 服务器
Port: 7891 (可通过 --port 修改)

Endpoints:
  GET  /                       → dashboard.html
  GET  /api/live-status        → data/live_status.json
  GET  /api/agent-config       → data/agent_config.json
  POST /api/set-model          → {agentId, model}
  GET  /api/model-change-log   → data/model_change_log.json
  GET  /api/last-result        → data/last_model_change_result.json
"""
import json, pathlib, subprocess, sys, threading, argparse, datetime, logging, re, os, socket, shutil
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse
from urllib.request import Request, urlopen

# JWT 认证模块
from auth import init as auth_init, requires_auth, extract_token, verify_token, \
    is_enabled as auth_enabled, is_configured as auth_configured, \
    setup_password, verify_password, create_token

# 引入文件锁工具，确保与其他脚本并发安全
scripts_dir = str(pathlib.Path(__file__).parent.parent / 'scripts')
sys.path.insert(0, scripts_dir)
from file_lock import atomic_json_read, atomic_json_write, atomic_json_update
from utils import validate_url, read_json, now_iso, python_bin
from court_discuss import (
    create_session as cd_create, advance_discussion as cd_advance,
    get_session as cd_get, conclude_session as cd_conclude,
    list_sessions as cd_list, destroy_session as cd_destroy,
    get_fate_event as cd_fate, OFFICIAL_PROFILES as CD_PROFILES,
)

log = logging.getLogger('server')
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(name)s] %(message)s', datefmt='%H:%M:%S')

CHANNELS_DIR = pathlib.Path(__file__).parent.parent / 'edict' / 'backend' / 'app' / 'channels'
if str(CHANNELS_DIR.parent) not in sys.path:
    sys.path.insert(0, str(CHANNELS_DIR.parent))
from channels import get_channel, get_channel_info, CHANNELS as NOTIFICATION_CHANNELS

OCLAW_HOME = pathlib.Path.home() / '.openclaw'
MAX_REQUEST_BODY = 1 * 1024 * 1024  # 1 MB
ALLOWED_ORIGIN = None  # Set via --cors; None means restrict to localhost
_DASHBOARD_PORT = 7891  # Updated at startup from --port arg
_DEFAULT_ORIGINS = {
    'http://127.0.0.1:7891', 'http://localhost:7891',
    'http://127.0.0.1:5173', 'http://localhost:5173',  # Vite dev server
}
_SAFE_NAME_RE = re.compile(r'^[a-zA-Z0-9_\-\u4e00-\u9fff]+$')

BASE = pathlib.Path(__file__).parent
DIST = BASE / 'dist'          # React 构建产物 (npm run build)
DATA = BASE.parent / "data"
SCRIPTS = BASE.parent / 'scripts'
_ACTIVE_TASK_DATA_DIR = None

# 静态资源 MIME 类型
_MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js':   'application/javascript; charset=utf-8',
    '.css':  'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png':  'image/png',
    '.jpg':  'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif':  'image/gif',
    '.svg':  'image/svg+xml',
    '.ico':  'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf':  'font/ttf',
    '.map':  'application/json',
}


def cors_headers(h):
    req_origin = h.headers.get('Origin', '')
    if ALLOWED_ORIGIN:
        origin = ALLOWED_ORIGIN
    elif req_origin in _DEFAULT_ORIGINS:
        origin = req_origin
    else:
        origin = f'http://127.0.0.1:{_DASHBOARD_PORT}'
    h.send_header('Access-Control-Allow-Origin', origin)
    h.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    h.send_header('Access-Control-Allow-Headers', 'Content-Type')


def _iter_task_data_dirs():
    """返回可用的任务数据目录候选（优先 workspace，其次本地 data）。"""
    dirs = [DATA]
    for p in sorted(OCLAW_HOME.glob('workspace-*/data')):
        if p.is_dir():
            dirs.append(p)
    return dirs


def _task_source_score(task_file: pathlib.Path):
    """给任务源打分：优先非 demo 任务，其次任务数，再按文件更新时间。"""
    try:
        tasks = atomic_json_read(task_file, [])
    except Exception:
        tasks = []
    if not isinstance(tasks, list):
        tasks = []
    non_demo = sum(1 for t in tasks if str((t or {}).get('id', '')) and not str((t or {}).get('id', '')).startswith('JJC-DEMO'))
    try:
        mtime = task_file.stat().st_mtime
    except Exception:
        mtime = 0
    return (1 if non_demo > 0 else 0, non_demo, len(tasks), mtime)


def get_task_data_dir():
    """自动选择当前任务数据目录，并缓存结果以保持一次服务期内稳定。"""
    global _ACTIVE_TASK_DATA_DIR
    if _ACTIVE_TASK_DATA_DIR and _ACTIVE_TASK_DATA_DIR.is_dir():
        return _ACTIVE_TASK_DATA_DIR
    best_dir = DATA
    best_score = (-1, -1, -1, -1)
    for d in _iter_task_data_dirs():
        tf = d / 'tasks_source.json'
        if not tf.exists():
            continue
        score = _task_source_score(tf)
        if score > best_score:
            best_score = score
            best_dir = d
    _ACTIVE_TASK_DATA_DIR = best_dir
    log.info(f'任务数据源: {_ACTIVE_TASK_DATA_DIR}')
    return _ACTIVE_TASK_DATA_DIR


def load_tasks():
    task_data_dir = get_task_data_dir()
    return atomic_json_read(task_data_dir / 'tasks_source.json', [])


def save_tasks(tasks):
    task_data_dir = get_task_data_dir()
    atomic_json_write(task_data_dir / 'tasks_source.json', tasks)
    _trigger_refresh()


def _trigger_refresh():
    """Trigger live data refresh in background."""
    task_data_dir = get_task_data_dir()
    script = task_data_dir.parent / 'scripts' / 'refresh_live_data.py'
    if not script.exists():
        script = SCRIPTS / 'refresh_live_data.py'

    def _refresh():
        try:
            subprocess.run([python_bin(), str(script)], timeout=30)
        except Exception as e:
            log.warning(f'refresh_live_data.py 触发失败: {e}')
    threading.Thread(target=_refresh, daemon=True).start()


def modify_tasks(modifier):
    """Atomically read-modify-write the tasks file.

    ``modifier(tasks)`` receives the current task list, mutates it in place
    (or returns a new list), and the result is persisted while the file lock
    is held.  This avoids the TOCTOU race inherent in separate
    ``load_tasks()`` / ``save_tasks()`` calls when background threads
    (dispatch callbacks, periodic scanner) and the HTTP handler mutate tasks
    concurrently.
    """
    task_data_dir = get_task_data_dir()
    path = task_data_dir / 'tasks_source.json'
    atomic_json_update(path, modifier, default=[])
    _trigger_refresh()


def modify_task(task_id, updater):
    """Atomically update a single task identified by *task_id*.

    ``updater(task)`` receives the task dict and should mutate it in place.
    Returns ``True`` if the task was found and updated, ``False`` otherwise.
    """
    found = [False]

    def _modifier(tasks):
        task = next((t for t in tasks if t.get('id') == task_id), None)
        if task is None:
            return tasks
        updater(task)
        task['updatedAt'] = now_iso()
        found[0] = True
        return tasks

    modify_tasks(_modifier)
    return found[0]


def handle_task_action(task_id, action, reason):
    """Stop/cancel/resume a task from the dashboard."""
    tasks = load_tasks()
    task = next((t for t in tasks if t.get('id') == task_id), None)
    if not task:
        return {'ok': False, 'error': f'任务 {task_id} 不存在'}

    old_state = task.get('state', '')
    _ensure_scheduler(task)
    _scheduler_snapshot(task, f'task-action-before-{action}')

    if action == 'stop':
        task['state'] = 'Blocked'
        task['block'] = reason or '皇上叫停'
        task['now'] = f'⏸️ 已暂停：{reason}'
    elif action == 'cancel':
        task['state'] = 'Cancelled'
        task['block'] = reason or '皇上取消'
        task['now'] = f'🚫 已取消：{reason}'
    elif action == 'resume':
        # Resume to previous active state or Doing
        task['state'] = task.get('_prev_state', 'Doing')
        task['block'] = '无'
        task['now'] = f'▶️ 已恢复执行'

    if action in ('stop', 'cancel'):
        task['_prev_state'] = old_state  # Save for resume

    task.setdefault('flow_log', []).append({
        'at': now_iso(),
        'from': '皇上',
        'to': task.get('org', ''),
        'remark': f'{"⏸️ 叫停" if action == "stop" else "🚫 取消" if action == "cancel" else "▶️ 恢复"}：{reason}'
    })

    if action == 'resume':
        _scheduler_mark_progress(task, f'恢复到 {task.get("state", "Doing")}')
    else:
        _scheduler_add_flow(task, f'皇上{action}：{reason or "无"}')

    task['updatedAt'] = now_iso()

    save_tasks(tasks)
    if action == 'resume' and task.get('state') not in _TERMINAL_STATES:
        dispatch_for_state(task_id, task, task.get('state'), trigger='resume')
    label = {'stop': '已叫停', 'cancel': '已取消', 'resume': '已恢复'}[action]
    return {'ok': True, 'message': f'{task_id} {label}'}


def handle_archive_task(task_id, archived, archive_all_done=False):
    """Archive or unarchive a task, or batch-archive all Done/Cancelled tasks."""
    tasks = load_tasks()
    if archive_all_done:
        count = 0
        for t in tasks:
            if t.get('state') in ('Done', 'Cancelled') and not t.get('archived'):
                t['archived'] = True
                t['archivedAt'] = now_iso()
                count += 1
        save_tasks(tasks)
        return {'ok': True, 'message': f'{count} 道旨意已归档', 'count': count}
    task = next((t for t in tasks if t.get('id') == task_id), None)
    if not task:
        return {'ok': False, 'error': f'任务 {task_id} 不存在'}
    task['archived'] = archived
    if archived:
        task['archivedAt'] = now_iso()
    else:
        task.pop('archivedAt', None)
    task['updatedAt'] = now_iso()
    save_tasks(tasks)
    label = '已归档' if archived else '已取消归档'
    return {'ok': True, 'message': f'{task_id} {label}'}


def update_task_todos(task_id, todos):
    """Update the todos list for a task."""
    tasks = load_tasks()
    task = next((t for t in tasks if t.get('id') == task_id), None)
    if not task:
        return {'ok': False, 'error': f'任务 {task_id} 不存在'}

    task['todos'] = todos
    task['updatedAt'] = now_iso()
    save_tasks(tasks)
    return {'ok': True, 'message': f'{task_id} todos 已更新'}


def read_skill_content(agent_id, skill_name):
    """Read SKILL.md cont
```

### Core Architecture Module: `edict/backend/app/__init__.py`
```
"""Edict Backend — 三省六部事件驱动架构。"""

```

### Core Architecture Module: `edict/backend/app/api/__init__.py`
```
from .tasks import router as tasks_router
from .agents import router as agents_router
from .events import router as events_router
from .admin import router as admin_router
from .websocket import router as websocket_router

__all__ = [
    "tasks_router",
    "agents_router",
    "events_router",
    "admin_router",
    "websocket_router",
]

```

### Core Architecture Module: `edict/backend/app/api/admin.py`
```
"""Admin API — 管理操作（迁移、诊断、配置）。"""

import json
import logging
from pathlib import Path

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from ..db import get_db
from ..services.event_bus import get_event_bus

log = logging.getLogger("edict.api.admin")
router = APIRouter()


@router.get("/health/deep")
async def deep_health(db: AsyncSession = Depends(get_db)):
    """深度健康检查：Postgres + Redis 连通性。"""
    checks = {"postgres": False, "redis": False}

    # Postgres
    try:
        result = await db.execute(text("SELECT 1"))
        checks["postgres"] = result.scalar() == 1
    except Exception as e:
        checks["postgres_error"] = str(e)

    # Redis
    try:
        bus = await get_event_bus()
        pong = await bus.redis.ping()
        checks["redis"] = pong is True
    except Exception as e:
        checks["redis_error"] = str(e)

    status = "ok" if all(checks.get(k) for k in ["postgres", "redis"]) else "degraded"
    return {"status": status, "checks": checks}


@router.get("/pending-events")
async def pending_events(
    topic: str = "task.dispatch",
    group: str = "dispatcher",
    count: int = 20,
):
    """查看未 ACK 的 pending 事件（诊断工具）。"""
    bus = await get_event_bus()
    pending = await bus.get_pending(topic, group, count)
    return {
        "topic": topic,
        "group": group,
        "pending": [
            {
                "entry_id": str(p.get("message_id", "")),
                "consumer": str(p.get("consumer", "")),
                "idle_ms": p.get("time_since_delivered", 0),
                "delivery_count": p.get("times_delivered", 0),
            }
            for p in pending
        ] if pending else [],
    }


@router.post("/migrate/check")
async def migration_check():
    """检查旧数据文件是否存在。"""
    data_dir = Path(__file__).parents[4] / "data"
    files = {
        "tasks_source": (data_dir / "tasks_source.json").exists(),
        "live_status": (data_dir / "live_status.json").exists(),
        "agent_config": (data_dir / "agent_config.json").exists(),
        "officials_stats": (data_dir / "officials_stats.json").exists(),
    }
    return {"data_dir": str(data_dir), "files": files}


@router.get("/config")
async def get_config():
    """获取当前运行配置（脱敏）。"""
    from ..config import get_settings
    settings = get_settings()
    return {
        "port": settings.port,
        "debug": settings.debug,
        "database": settings.database_url.split("@")[-1] if "@" in settings.database_url else "***",
        "redis": settings.redis_url.split("@")[-1] if "@" in settings.redis_url else settings.redis_url,
        "scheduler_scan_interval": settings.scheduler_scan_interval_seconds,
    }

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #297** (2026-04-27): **官方skills地址404**
  *Symptoms*: 官方 skills 库地址: https://github.com/openclaw-ai/skills-hub   404无法打开，一键导入官方 skills不能用

- **Issue #289** (2026-04-27): **自动派发异常**
  *Symptoms*:  JJC-20260415-004 自动派发异常: [WinError 2] 系统找不到指定的文件。
  **Post-Mortem & Fix Analysis**:
  > 小任务中创建任务后，命令行记录提示这个报错
  > 已修复 ✅  **根本原因**：`server.py` / `kanban_update.py` 中所有 subprocess 调用均硬编码了 `'python3'`，而 Windows 上 Python 可执行文件名为 `python` 而非 `python3`，导致 `[WinError 2] 系统找不到指定的文件`。  **修复方式**：在 `scripts/utils.py` 中新增 `python_bin()`，优先返回 `sys.executable`（当前解释器路径），回退到 `shutil.which`，确保 Windows/macOS/Linux 全平台兼容。所有硬编码 `'python3'` 已替换。  **commit**: ae3942b

- **Issue #277** (2026-04-14): **任务详情弹窗内多个时间字段存在时区口径不一致问题，导致同一任务在不同区块出现不同时间。**
  *Symptoms*: ## 环境信息 - OpenClaw: OpenClaw 2026.4.8 (9ece252) - Python: 3.13.0（服务运行）/ 3.9.6（本地 venv） - OS: macOS  ## 复现步骤 1. 启动看板服务：`python3 dashboard/server.py --port 8891` 2. 打开任务详情弹窗（Task Modal） 3. 对比以下区域时间：    - 调度条：`最近进展` / `最近派发`    - 实时动态区：`最近更新` / 活动项右侧时间 4. 可观察到同一任务在不同区域时间不一致（UTC/本地混用）  ## 期望行为 所有时间字段统一按本地时区展示，口径一致。   ## 实际行为  ## 错误日志 ``` 粘贴日志 ```  
  **Post-Mortem & Fix Analysis**:
  > 已修复：将所有时间字段统一通过 `parseDateFlexible` 解析后以本地时区格式化展示，消除了 UTC/本地时间混用问题。修复涉及流转日志、会话详情、奏章时间线和巡检报告四处。(commit f41c981)

- **Issue #274** (2026-07-20): **openclaw4.5，旨意只能在太子执行，无法正确的流转**
  *Symptoms*: ## 环境 - OpenClaw 版本：2026.4.5 (3e72c03) - 操作系统：Darwin 24.6.0 (x64) / macOS - Python 版本：3.9.6  ## 问题描述 无法正确的使用旨意传递链条 在测试“三省六部旨意传递链条”时，需要通过 sessions_send 以 **sessionKey** 精确投递到指定代理（如 agent:zhongshu:main）。   但在调用 sessions_send(sessionKey=...) 时，系统报错：   Provide either sessionKey or label (not both)。   这意味着即便只传 sessionKey，工具层仍被判定“同时传了 label”。  为绕过该校验，我显式传 label="unused"，使校验逻辑放行。   该方式可投递，说明当前版本对 label 的处理存在冲突：**只要 label 不为 "unused" 即视为“同时传 label”**。  同时，在派发 subagent 时，出现：   streamTo is only supported for runtime=acp; got runtime=subagent   显示 subagent 流程被注入了 ACP 专属参数，导致 subagent 派发失败。  ## 复现步骤 1. 调用 sessions_send(sessionKey="agent:zhongshu:main", message="...")      → 报错 Provide either sessionKey or label (not both)   2. 改为 sessions_send(sessionKey="agent:zhongshu:main", label="unused", ...)      → 可投递，说明 label 校验与 sessionKey 存在冲突   3. 尝试 sessions_spawn(runtime="subagent")      → 报错 streamTo is only supported for runtime=acp  ## 期望行为 - sessions_send 仅传 sessionKey 时不应被判定携带 label。   - subagent 不应被注入 ACP 专属参数（如 streamTo）。  ## 实际行为 - sessions_send 报错“sessionKey/label 互斥”。   - subagent 被注入 ACP 参数导致失败。  ## 错误日志 Provide either sessionKey or label (not both) streamTo is only supported for runtime=acp; got runtime=subagent  证据/文件路径：   - /Users/user/.npm-global/lib/node_modules/openclaw/dist/pi-embedded-DWASRjxE.js（label/sessionKey 校验逻辑）    阻塞项：   - label 与 sessionKey 互斥校验导致无法稳定投递   - subagent 参数注入导致派发失败
  **Post-Mortem & Fix Analysis**:
  > 我也是这个问题搞了好久，退回3.28可以了
  > 感谢非常详细的 bug 报告！  这个问题的根源在 **openclaw CLI 运行时**（`pi-embedded-DWASRjxE.js` 中的 `sessions_send` 校验逻辑），不在本仓库的代码范围内。具体来说：  1. `sessions_send` 的 `sessionKey` / `label` 互斥校验在 openclaw 4.5 版本有回归 2. `subagent` 运行时被注入 ACP 参数也是 openclaw CLI 层的问题  从评论区也可以看到 @fffants 确认退回 3.28 版本可以正常工作，说明是 openclaw 新版引入的问题。  **建议**： - 临时方案：使用 openclaw 3.28 版本（`npm install -g openclaw@3.28`） - 长期方案：向 openclaw 官方提 issue 反馈此回归  标记为 `upstream` 问题。本仓库的 agent 配置和 prompt 本身没有问题，是运行时的 session 路由逻辑出了回归。
  > 请问，这个问题openclaw 4.8解决问题了吗

- **Issue #272** (2026-04-27): **Docker镜像在Windows AMD64架构下启动失败：exec format error**
  *Symptoms*: ## 复现步骤 . 打开PowerShell . 执行命令：`docker run -p 7891:7891 cft0808/sansheng-demo` . 观察到错误：`exec /usr/local/bin/python3: exec format error`  ## 预期与实际结果 - **预期**：容器正常启动，可通过http://localhost:7891访问军机处看板 - **实际**：容器启动失败，显示架构不匹配错误  ## 已尝试的解决方法 - 尝试使用`--platform linux/amd64`参数：`docker run --platform linux/amd64 -p 7891:7891 cft0808/sansheng-demo` - 尝试安装QEMU用户态模拟器  ## 环境信息 - **操作系统**：Windows 11 22H2 - **Docker版本**：24.0.5 - **CPU架构**：Intel Core i7-11800H (AMD64) - **WSL2**：已启用 - **错误日志**： WARNING: The requested image's platform (linux/arm64/v8) does not match the detected host platform (linux/amd64/v3) and no specific platform was requested exec /usr/local/bin/python3: exec format error
  **Post-Mortem & Fix Analysis**:
  > Me too.
  > 感谢报告！这是一个已知问题，和 #192 相关。  **原因**：当前 Docker Hub 上的 `cft0808/sansheng-demo` 镜像是在 ARM64 机器上构建的，只包含 `linux/arm64` 架构。  **好消息**：本仓库的 CI 流水线 `.github/workflows/docker-publish.yml` 已经配置了多架构构建（`linux/amd64,linux/arm64`），只是尚未触发新的发布。等维护者推送新的 `v*` tag 或手动触发 workflow 后，Docker Hub 上的镜像就会同时支持 AMD64 和 ARM64。  **临时解决方案**： 1. 克隆仓库后本地构建：`docker build -t sansheng-demo .`（会自动构建你机器对应架构的镜像） 2. 或使用裸安装方式部署，参考 [getting-started.md](https://github.com/cft0808/edict/blob/main/docs/getting-started.md)  关联 #192, #273
  > 此问题已在 `docker-publish.yml` 工作流中修复——CI 使用 QEMU + Buildx 构建 `linux/amd64,linux/arm64` 多架构镜像。  请尝试拉取最新镜像： ```bash docker pull cft0808/sansheng-demo:latest docker run -p 7891:7891 cft0808/sansheng-demo ```  如果仍然遇到 `exec format error`，请确认镜像的 tag 是否为最新版本（workflow_dispatch 触发后的构建）。

- **Issue #271** (2026-04-09): **建议支持 自定义openclaw.json目录**
  *Symptoms*: ## 环境 - OpenClaw 版本：20263.13 - 操作系统：飞牛NAS - Python 版本：Python 3.11.2  ## 问题描述  ╔══════════════════════════════════════════╗ ║  🏛️  三省六部 · OpenClaw Multi-Agent    ║ ║       安装向导                            ║ ╚══════════════════════════════════════════╝  ℹ️  检查依赖... ✅ OpenClaw CLI: OK ✅ Python3: Python 3.11.2 ❌ 未找到 openclaw.json。请先运行 openclaw 完成初始化。  安装的时候路径，实际上飞牛的json路径在 /vol1/@apphome/trim.openclaw/data/home/.openclaw下 并不是/home/。。。  

- **Issue #265** (2026-04-14): **"Failed to parse LLM response:" 太子和LLM交互，解析返回的消息被截断，导致json解析失败**
  *Symptoms*: ## 环境 - OpenClaw 版本：2026.4.1 - 操作系统：windows ，wsl2 ，ubuntu24版本 - Python 版本：3.12  ## 问题描述 “Failed to parse LLM response: ”。只有太子出现消息截断，导致解析失败，控制台报错。  ## 复现步骤 1. 打开http://127.0.0.1:7891 2. 控制台里，“朝堂议政”页面，输入一个“自定义议题”，开始自动讨论 3. 偶尔在openclaw的字符窗口里看到报错日志  ## 期望行为  ## 实际行为  ## 错误日志 ``` 14:55:50 [court_discuss] Failed to parse LLM response: {   "messages": [     {       "official_id": "taizi",       "name": "太子",       "content": "兵部所言极是。本宫以为，调研当分三步走：先定标准，再采样本，最后成文。七维度中，生理为基，精神为魂，不可偏废。",       "emotion": "confident",       "action": "*手指 14:55:56 [court_discuss] Court discuss using openclaw provider=llamacpp model=Qwen3.5-27B.Q4_K_M.gguf api=openai-responses 14:56:34 [court_discuss] Failed to parse LLM response: {   "messages": [     {       "official_id": "taizi",       "name": "太子",       "content": "本宫以为，精神内核的评估标准需先确立，否则七维数据恐成无本之木——户部尚书，你可先建个精神指数测算模型？",       "emotion": "confident",       "action": "*手指轻叩案 14:56:39 [court_discuss] Court discuss using openclaw provider=llamacpp model=Qwen3.5-27B.Q4_K_M.gguf api=openai-responses 14:57:22 [court_discuss] Court discuss using openclaw provider=llamacpp model=Qwen3.5-27B.Q4_K_M.gguf api=openai-responses 14:58:05 [court_discuss] Court discuss using openclaw provider=llamacpp model=Qwen3.5-27B.Q4_K_M.gguf api=openai-responses 14:58:48 [court_discuss] Court discuss using openclaw provider=llamacpp model=Qwen3.5-27B.Q4_K_M.gguf api=openai-responses 14:59:31 [court_discuss] Court discuss using openclaw provider=llamacpp model=Qwen3.5-27B.Q4_K_M.
  **Post-Mortem & Fix Analysis**:
  > 感谢详细的 bug 报告！  **问题分析**：你使用的本地模型 `Qwen3.5-27B.Q4_K_M.gguf` 通过 llamacpp 运行。从日志看，每次截断都发生在 JSON 输出中途，说明模型的输出在 `max_tokens` 用完时被强制截断。原来的代码固定 `max_tokens=1500`，当参与议政的官员较多时，生成所有人的发言 JSON 需要的 token 数会超过这个限制。  **已提交修复**（本次更新）： 1. **动态 token 预算**：根据参与官员数量计算 `max_tokens`（每位官员 300 token + 200 基础），确保有足够空间生成完整 JSON 2. **截断修复**：即使响应仍然被截断，新增的 `_try_repair_truncated_discuss()` 函数会尝试从不完整 JSON 中提取已完成的消息条目，让讨论继续进行而不是直接丢弃  **你也可以配合做的调整**： - 在 llamacpp 启动时增大 `--ctx-size`，确保模型有足够的上下文窗口 - 如果 Qwen 3.5 27B Q4 经常截断，可以尝试参与更少的官员（5-6 位），减少输出量
  > 此问题已在 commit 70cd997 中修复（动态 max_tokens + 截断 JSON 修复）。如仍有问题请重新打开。
  > 谢谢啦

- **Issue #242** (2026-03-31): **python3 dashboard/server.py 执行报错**
  *Symptoms*: [root@openclaw edict]# python3 dashboard/server.py  Traceback (most recent call last):   File "/root/edict/dashboard/server.py", line 37, in <module>     from channels import get_channel, get_channel_info, CHANNELS as NOTIFICATION_CHANNELS   File "/root/edict/edict/backend/app/channels/__init__.py", line 3, in <module>     from .base import NotificationChannel   File "/root/edict/edict/backend/app/channels/base.py", line 5, in <module>     class NotificationChannel(Protocol):   File "/root/edict/edict/backend/app/channels/base.py", line 19, in NotificationChannel     def send(cls, webhook: str, title: str, content: str, url: str | None = None) -> bool: TypeError: unsupported operand type(s) for |: 'type' and 'NoneType'
  **Post-Mortem & Fix Analysis**:
  > 已修复 ✅   **根因**：`edict/backend/app/` 下多个文件使用了 PEP 604 联合类型语法（`str | None`），该语法需要 Python 3.10+，在 Python 3.9 上会抛出 `TypeError: unsupported operand type(s) for |`。  **修复**：为所有使用 `X | Y` 类型注解的 15 个文件添加 `from __future__ import annotations`，使类型注解在运行时被视为字符串，兼容 Python 3.9。  涉及文件： - `edict/backend/app/channels/` 下全部 8 个文件（base, feishu, slack, discord, telegram, webhook, wecom, __init__） - `edict/backend/app/config.py` - `edict/backend/app/models/task.py` - `edict/backend/app/api/tasks.py`, `legacy.py`, `events.py` - `edict/backend/app/services/task_service.py`, `event_bus.py`  提交：0ab37d1

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

### Incident Patch 1: `1ceee6bc` (2026-04-27)
**Commit Message**: fix(ci): avoid YAML parse ambiguity in FastAPI import step

**File**: `.github/workflows/ci.yml` (modified, +2/-1)
```diff
@@ -120,4 +120,5 @@ jobs:
 
       - name: Verify FastAPI app imports
         working-directory: edict/backend
-        run: python -c "from app.main import app; print(f'FastAPI app loaded: {len(app.routes)} routes')"
+        run: |
+          python -c "from app.main import app; print(f'FastAPI app loaded: {len(app.routes)} routes')"
```

---

### Incident Patch 2: `ae3942bc` (2026-04-27)
**Commit Message**: fix: 兼容 Windows 系统的 Python 解释器路径查找

在 Windows 上不存在 python3 命令，subprocess 调用会抛出 [WinError 2]。
在 utils.py 中新增 python_bin() 函数，优先使用 sys.executable（当前解释器路径），
回退到 shutil.which('python3') / shutil.which('python')，确保全平台兼容。
server.py 和 kanban_update.py 中所有硬编码的 'python3' 替换为 python_bin()。

Closes #289

**File**: `dashboard/server.py` (modified, +8/-8)
```diff
@@ -25,7 +25,7 @@
 scripts_dir = str(pathlib.Path(__file__).parent.parent / 'scripts')
 sys.path.insert(0, scripts_dir)
 from file_lock import atomic_json_read, atomic_json_write, atomic_json_update
-from utils import validate_url, read_json, now_iso
+from utils import validate_url, read_json, now_iso, python_bin
 from court_discuss import (
     create_session as cd_create, advance_discussion as cd_advance,
     get_session as cd_get, conclude_session as cd_conclude,
@@ -154,7 +154,7 @@ def _trigger_refresh():
 
     def _refresh():
         try:
-            subprocess.run(['python3', str(script)], timeout=30)
+            subprocess.run([python_bin(), str(script)], timeout=30)
         except Exception as e:
             log.warning(f'refresh_live_data.py 触发失败: {e}')
     threading.Thread(target=_refresh, daemon=True).start()
@@ -342,7 +342,7 @@ def add_skill_to_agent(agent_id, skill_name, description, trigger=''):
     skill_md.write_text(template)
     # Re-sync agent config
     try:
-        subprocess.run(['python3', str(SCRIPTS / 'sync_agent_config.py')], timeout=10)
+        subprocess.run([python_bin(), str(SCRIPTS / 'sync_agent_config.py')], timeout=10)
     except Exception:
         pass
     return {'ok': True, 'message': f'技能 {skill_name} 已添加到 {agent_id}', 'path': str(skill_md)}
@@ -456,7 +456,7 @@ def add_remote_skill(agent_id, skill_name, source_url, description=''):
     
     # Re-sync agent config
     try:
-        subprocess.run(['python3', str(SCRIPTS / 'sync_agent_config.py')], timeout=10)
+        subprocess.run([python_bin(), str(SCRIPTS / 'sync_agent_config.py')], timeout=10)
     except Exception:
         pass
     
@@ -574,7 +574,7 @@ def remove_remote_skill(agent_id, skill_name):
         
         # Re-sync agent config
         try:
-            subprocess.run(['python3', str(SCRIPTS / 'sync_agent_config.py')], timeout=10)
+            subprocess.run([python_bin(), str(SCRIPTS / 'sync_agent_config.py')], timeout=10)
         except Exception:
             pass
         
@@ -2659,7 +2659,7 @@ def do_POST(self):
             force = body.get('force', True)  # 从看板手动触发默认强制
             def do_refresh():
                 try:
-                    cmd = ['python3', str(SCRIPTS / 'fetch_morning_news.py')]
+                    cmd = [python_bin(), str(SCRIPTS / 'fetch_morning_news.py')]
                     if force:
                         cmd.append('--force')
                     subprocess.run(cmd, timeout=120)
@@ -2826,8 +2826,8 @@ def update_pending(current):
             # Async apply
             def apply_async():
                 try:
-                    subprocess.run(['python3', str(SCRIPTS / 'apply_model_changes.py')], timeout=30)
-                    subprocess.run(['python3', str(SCRIPTS / 'sync_agent_config.py')], timeout=10)
+                    subprocess.run([python_bin(), str(SCRIPTS / 'apply_model_changes.py')], timeout=30)
+                    subprocess.run([python_bin(), str(SCRIPTS / 'sync_agent_config.py')], timeout=10)
                 except Exception as e:
                     print(f'[apply error] {e}', file=sys.stderr)
 
```

**File**: `scripts/kanban_update.py` (modified, +2/-1)
```diff
@@ -31,6 +31,7 @@
 """
 import datetime
 import json, pathlib, sys, subprocess, logging, os, re
+from utils import python_bin
 
 _BASE = pathlib.Path(os.environ['EDICT_HOME']) if 'EDICT_HOME' in os.environ else pathlib.Path(__file__).resolve().parent.parent
 TASKS_FILE = _BASE / 'data' / 'tasks_source.json'
@@ -123,7 +124,7 @@ def _trigger_refresh():
     # 注意：这个 fallback 只在非 watcher 部署场景触发
     if not (_BASE / 'data' / '.refresh_watcher_pid').exists():
         try:
-            subprocess.Popen(['python3', str(REFRESH_SCRIPT)],
+            subprocess.Popen([python_bin(), str(REFRESH_SCRIPT)],
                              stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
         except Exception:
             pass
```

**File**: `scripts/utils.py` (modified, +7/-1)
```diff
@@ -4,7 +4,8 @@
 避免 read_json / now_iso 等基础函数在多个脚本中重复定义
 """
 import os
-import json, pathlib, datetime
+import sys
+import json, pathlib, datetime, shutil
 
 
 def read_json(path, default=None):
@@ -39,6 +40,11 @@ def safe_name(s: str) -> bool:
     return bool(re.match(r'^[a-zA-Z0-9_\-\u4e00-\u9fff]+$', s))
 
 
+def python_bin() -> str:
+    """返回当前 Python 解释器路径，兼容 Windows（无 python3 命令）"""
+    return sys.executable or shutil.which('python3') or shutil.which('python') or 'python3'
+
+
 def validate_url(url: str, allowed_schemes=('https',), allowed_domains=None) -> bool:
     """校验 URL 合法性，防 SSRF"""
     from urllib.parse import urlparse
```

---

### Incident Patch 3: `5f4da4e1` (2026-04-27)
**Commit Message**: Merge pull request #306 from luoyanglang/wolf/fix-official-skills-hub-404

fix(skills): remove broken default skills hub

**File**: `README.md` (modified, +21/-24)
```diff
@@ -550,24 +550,24 @@ edict/
 #### 2️⃣ CLI 命令（最灵活）
 
 ```bash
-# 从 GitHub 添加 code_review skill 到中书省
+# 从 GitHub 添加 mmx_cli skill 到门下省
 python3 scripts/skill_manager.py add-remote \
-  --agent zhongshu \
-  --name code_review \
-  --source https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/code_review/SKILL.md \
-  --description "代码审查技能"
+  --agent menxia \
+  --name mmx_cli \
+  --source https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md \
+  --description "MiniMax 多模态 CLI 技能"
 
-# 一键导入官方 skills 库到指定 agents
+# 一键导入默认 skills 到指定 agents
 python3 scripts/skill_manager.py import-official-hub \
-  --agents zhongshu,menxia,shangshu,bingbu,xingbu
+  --agents menxia,shangshu
 
 # 列出所有已添加的远程 skills
 python3 scripts/skill_manager.py list-remote
 
 # 更新某个 skill 到最新版本
 python3 scripts/skill_manager.py update-remote \
-  --agent zhongshu \
-  --name code_review
+  --agent menxia \
+  --name mmx_cli
 ```
 
 #### 3️⃣ API 请求（自动化集成）
@@ -577,25 +577,22 @@ python3 scripts/skill_manager.py update-remote \
 curl -X POST http://localhost:7891/api/add-remote-skill \
   -H "Content-Type: application/json" \
   -d '{
-    "agentId": "zhongshu",
-    "skillName": "code_review",
-    "sourceUrl": "https://raw.githubusercontent.com/...",
-    "description": "代码审查"
+    "agentId": "menxia",
+    "skillName": "mmx_cli",
+    "sourceUrl": "https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md",
+    "description": "MiniMax 多模态 CLI 技能"
   }'
 
 # 查看所有远程 skills
 curl http://localhost:7891/api/remote-skills-list
 ```
 
-**官方 Skills Hub：** https://github.com/openclaw-ai/skills-hub
+**默认可导入 Skill：**
 
 支持的 Skills：
-- `code_review` — 代码审查（Python/JS/Go）
-- `api_design` — API 设计审查
-- `security_audit` — 安全审计
-- `data_analysis` — 数据分析
-- `doc_generation` — 文档生成
-- `test_framework` — 测试框架设计
+- `mmx_cli` — MiniMax 多模态 CLI 技能（文本、图像、视频、语音、音乐、搜索）
+
+如果你有自己的 Skills Hub，可以通过 `OPENCLAW_SKILLS_HUB_BASE` 或 `~/.openclaw/skills-hub-url` 配置自定义源。
 
 详见 [🎓 远程 Skills 资源管理指南](docs/remote-skills-guide.md)
 
@@ -636,7 +633,7 @@ curl http://localhost:7891/api/remote-skills-list
 
 - **[🎓 远程 Skills 资源管理指南](docs/remote-skills-guide.md)** — Skills 生态
   - 从网上连接和增补 skills，支持 GitHub/Gitee/任意 HTTPS URL
-  - 官方 Skills Hub 预设能力库
+  - 默认 Skills 源和自定义 Hub 支持
   - CLI 工具 + 看板 UI + Restful API
   - Skills 文件规范与安全防护
   - 支持版本管理和一键更新
@@ -711,17 +708,17 @@ docker compose up
 **排查**：
 ```bash
 # 测试网络连通性
-curl -I https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/code_review/SKILL.md
+curl -I https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md
 
 # 如果超时，使用代理
 export https_proxy=http://your-proxy:port
-python3 scripts/skill_manager.py import-official-hub --agents zhongshu
+python3 scripts/skill_manager.py import-official-hub --agents menxia
 ```
 
 **常见原因**：
 - 中国大陆访问 GitHub raw 资源需要代理
 - 网络超时（已增加到 30 秒 + 自动重试 3 次）
-- 官方 Skills Hub 仓库维护中
+- 默认 skill 源无法访问，或自定义 Skills Hub 配置错误
 
 </details>
 
```

**File**: `docs/remote-skills-guide.md` (modified, +20/-16)
```diff
@@ -7,7 +7,7 @@
 - **GitHub 仓库** (raw.githubusercontent.com)
 - **任何 HTTPS URL** (需返回有效的 skill 文件)
 - **本地文件路径**
-- **内置仓库** (官方 skills 库)
+- **默认 Skills 源** (经验证可访问的内置导入源)
 
 ---
 
@@ -157,28 +157,32 @@ python3 scripts/skill_manager.py remove-remote \
 
 ---
 
-## 官方 Skills 库
+## 默认 Skills 源
 
-### OpenClaw Skills Hub
+### MiniMax CLI Skill
 
-> **官方 skills 库地址**: https://github.com/openclaw-ai/skills-hub
+默认导入源包含经验证可访问的 MiniMax CLI skill。旧的 `openclaw-ai/skills-hub` 仓库当前不可用，因此不再作为默认官方源。
 
 可用 skills 列表：
 
 | Skill 名称 | 描述 | 适用 Agent | 源 URL |
 |-----------|------|----------|--------|
-| `code_review` | 代码审查（支持 Python/JS/Go） | 兵部/刑部 | https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/code_review/SKILL.md |
-| `api_design` | API 设计审查 | 兵部/工部 | https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/api_design/SKILL.md |
-| `security_audit` | 安全审计 | 刑部 | https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/security_audit/SKILL.md |
-| `data_analysis` | 数据分析 | 户部 | https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/data_analysis/SKILL.md |
-| `doc_generation` | 文档生成 | 礼部 | https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/doc_generation/SKILL.md |
-| `test_framework` | 测试框架设计 | 工部/刑部 | https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/test_framework/SKILL.md |
+| `mmx_cli` | MiniMax 多模态 CLI 技能 | 门下省/尚书省 | https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md |
 
-**一键导入官方 skills**
+如果你维护自己的 Skills Hub，可以使用以下方式指定 Hub base URL。指定后，`import-official-hub` 会按 `<base>/<skill_name>/SKILL.md` 解析 `code_review`、`api_design`、`security_audit`、`data_analysis`、`doc_generation`、`test_framework` 等传统 skill 名称。
+
+```bash
+export OPENCLAW_SKILLS_HUB_BASE=https://your-hub/raw-base
+
+# 或写入本地配置
+echo "https://your-hub/raw-base" > ~/.openclaw/skills-hub-url
+```
+
+**一键导入默认 skills**
 
 ```bash
 python3 scripts/skill_manager.py import-official-hub \
-  --agents zhongshu,menxia,shangshu,bingbu,xingbu,libu
+  --agents menxia,shangshu
 ```
 
 ---
@@ -360,7 +364,7 @@ compatibleAgents: [bingbu, xingbu, menxia]
 2. **大小限制**: 最多 10 MB
 3. **超时保护**: 下载超过 30 秒自动中止
 4. **路径遍历防护**: 检查解析后的 skill 名称，禁用 `../` 模式
-5. **checksum 验证**: 可选的 GPG 签名验证（仅官方库）
+5. **checksum 验证**: 可选的 GPG 签名验证（适用于可信发布源）
 
 ### 隔离执行
 
@@ -397,7 +401,7 @@ A: 不支持（安全考虑）。可以：
 
 **Q: 如何创建自己的 skills 库？**
 
-A: 参考 [OpenClaw Skills Hub](https://github.com/openclaw-ai/skills-hub) 的结构创建自己的仓库，然后：
+A: 按 `<skill_name>/SKILL.md` 的结构创建自己的仓库，然后：
 
 ```bash
 git clone https://github.com/yourname/my-skills-hub.git
@@ -406,7 +410,7 @@ cd my-skills-hub
 # 提交 & 推送到 GitHub
 ```
 
-然后通过 URL 或官方库导入功能添加即可。
+然后通过 URL 添加，或通过 `OPENCLAW_SKILLS_HUB_BASE` / `~/.openclaw/skills-hub-url` 配置为自定义 Hub 后导入。
 
 ---
 
@@ -442,7 +446,7 @@ python3 scripts/skill_manager.py check-updates --interval weekly
 
 ### 5. 贡献社区
 
-成熟的 skills 可向 [OpenClaw Skills Hub](https://github.com/openclaw-ai/skills-hub) 贡献。
+成熟的 skills 可以沉淀到你自己的公开 Skills Hub，并通过 `OPENCLAW_SKILLS_HUB_BASE` 分享给团队使用。
 
 ---
 
```

**File**: `docs/remote-skills-quickstart.md` (modified, +41/-39)
```diff
@@ -10,21 +10,21 @@ python3 dashboard/server.py
 # 输出: 三省六部看板启动 → http://127.0.0.1:7891
 ```
 
-### 2. 添加官方 Skill（CLI）
+### 2. 添加默认 Skill（CLI）
 
 ```bash
-# 为中书省添加代码审查 skill
+# 为门下省添加 MiniMax CLI skill
 python3 scripts/skill_manager.py add-remote \
-  --agent zhongshu \
-  --name code_review \
-  --source https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/code_review/SKILL.md \
-  --description "代码审查能力"
+  --agent menxia \
+  --name mmx_cli \
+  --source https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md \
+  --description "MiniMax 多模态 CLI 技能"
 
 # 输出:
 # ⏳ 正在从 https://raw.githubusercontent.com/... 下载...
-# ✅ 技能 code_review 已添加到 zhongshu
-#    路径: /Users/xxx/.openclaw/workspace-zhongshu/skills/code_review/SKILL.md
-#    大小: 2048 字节
+# ✅ 技能 mmx_cli 已添加到 menxia
+#    路径: /Users/xxx/.openclaw/workspace-menxia/skills/mmx_cli/SKILL.md
+#    大小: 14655 字节
 ```
 
 ### 3. 列出所有远程 Skills
@@ -37,7 +37,7 @@ python3 scripts/skill_manager.py list-remote
 # 
 # Agent       | Skill 名称           | 描述                           | 添加时间
 # ------------|----------------------|--------------------------------|----------
-# zhongshu    | code_review          | 代码审查能力                   | 2026-03-02
+# menxia      | mmx_cli              | MiniMax 多模态 CLI 技能         | 2026-03-02
 ```
 
 ### 4. 查看 API 响应
@@ -50,11 +50,11 @@ curl http://localhost:7891/api/remote-skills-list | jq .
 #   "ok": true,
 #   "remoteSkills": [
 #     {
-#       "skillName": "code_review",
-#       "agentId": "zhongshu",
+#       "skillName": "mmx_cli",
+#       "agentId": "menxia",
 #       "sourceUrl": "https://raw.githubusercontent.com/...",
-#       "description": "代码审查能力",
-#       "localPath": "/Users/xxx/.openclaw/workspace-zhongshu/skills/code_review/SKILL.md",
+#       "description": "MiniMax 多模态 CLI 技能",
+#       "localPath": "/Users/xxx/.openclaw/workspace-menxia/skills/mmx_cli/SKILL.md",
 #       "addedAt": "2026-03-02T14:30:00Z",
 #       "lastUpdated": "2026-03-02T14:30:00Z",
 #       "status": "valid"
@@ -69,44 +69,47 @@ curl http://localhost:7891/api/remote-skills-list | jq .
 
 ## 常见操作
 
-### 一键导入官方库中的所有 skills
+### 一键导入默认 skills
 
 ```bash
 python3 scripts/skill_manager.py import-official-hub \
-  --agents zhongshu,menxia,shangshu,bingbu,xingbu
+  --agents menxia,shangshu
 ```
 
-这会自动为每个 agent 添加：
-- **zhongshu**: code_review, api_design, doc_generation
-- **menxia**: code_review, api_design, security_audit, data_analysis, doc_generation, test_framework
-- **shangshu**: 同 menxia（协调者）
-- **bingbu**: code_review, api_design, test_framework
-- **xingbu**: code_review, security_audit, test_framework
+这会为指定 agent 添加默认可用的 `mmx_cli` skill。旧的 `openclaw-ai/skills-hub` 仓库当前不可用，因此不再作为默认官方源。
+
+如果你维护自己的 Skills Hub，可以通过环境变量或本地配置指定：
+
+```bash
+export OPENCLAW_SKILLS_HUB_BASE=https://your-hub/raw-base
+# 或
+echo "https://your-hub/raw-base" > ~/.openclaw/skills-hub-url
+```
 
 ### 更新某个 Skill 到最新版本
 
 ```bash
 python3 scripts/skill_manager.py update-remote \
-  --agent zhongshu \
-  --name code_review
+  --agent menxia \
+  --name mmx_cli
 
 # 输出:
 # ⏳ 正在从 https://raw.githubusercontent.com/... 下载...
-# ✅ 技能 code_review 已添加到 zhongshu
+# ✅ 技能 mmx_cli 已添加到 menxia
 # ✅ 技能已更新
-#    路径: /Users/xxx/.openclaw/workspace-zhongshu/skills/code_review/SKILL.md
-#    大小: 2156 字节
+#    路径: /Users/xxx/.openclaw/workspace-menxia/skills/mmx_cli/SKILL.md
+#    大小: 14655 字节
 ```
 
 ### 移除某个 Skill
 
 ```bash
 python3 scripts/skill_manager.py remove-remote \
-  --agent zhongshu \
-  --name code_review
+  --agent menxia \
+  --name mmx_cli
 
 # 输出:
-# ✅ 技能 code_review 已从 zhongshu 移除
+# ✅ 技能 mmx_cli 已从 menxia 移除
 ```
 
 ---
@@ -119,10 +122,10 @@ python3 scripts/skill_manager.py remove-remote \
 2. 进入 🔧 **技能配置** 面板
 3. 点击 **➕ 添加远程 Skill** 按钮
 4. 填写表单：
-   - **Agent**: 从下拉列表选择（如 zhongshu）
-   - **Skill 名称**: 输入内部 ID 如 `code_review`
-   - **远程 URL**: 粘贴 GitHub URL 如 `https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/code_review/SKILL.md`
-   - **中文描述**: 可选，如 `代码审查能力`
+   - **Agent**: 从下拉列表选择（如 menxia）
+   - **Skill 名称**: 输入内部 ID 如 `mmx_cli`
+   - **远程 URL**: 粘贴 GitHub URL 如 `https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md`
+   - **中文描述**: 可选，如 `MiniMax 多模态 CLI 技能`
 5. 点击 **导入** 按钮
 6. 等待 1-2 秒，看到 ✅ 成功提示
 
@@ -247,11 +250,11 @@ curl http://localhost:7891/api/remote-skills-list
   "ok": true,
   "remoteSkills": [
     {
-      "skillName": "code_review",
-      "agentId": "zhongshu",
+      "skillName": "mmx_cli",
+      "agentId": "menxia",
       "sourceUrl": "https://raw.githubusercontent.com/...",
-      "description": "代码审查能力",
-      "localPath": "/Users/xxx/.openclaw/workspace-zhongshu/skills/code_review/SKILL.md",
+      "description": "MiniMax 多模态 CLI 技能",
+      "localPath": "/Users/xxx/.openclaw/workspace-menxia/skills/mmx_cli/SKILL.md",
       "addedAt": "2026-03-02T14:30:00Z",
       "lastUpdated": "2026-03-02T14:30:00Z",
       "status": "valid"
@@ -333,4 +336,3 @@ ls -la ~/.openclaw/workspace-zhongshu/skills/
 
```

**File**: `scripts/skill_manager.py` (modified, +41/-45)
```diff
@@ -14,7 +14,7 @@
   
   python3 scripts/skill_manager.py remove-remote --agent zhongshu --name code_review
   
-  python3 scripts/skill_manager.py import-official-hub --agents zhongshu,menxia,shangshu
+  python3 scripts/skill_manager.py import-official-hub --agents menxia,shangshu
 """
 import sys
 import json
@@ -60,7 +60,7 @@ def _download_file(url: str, timeout: int = 30, retries: int = 3) -> str:
     if 'timed out' in str(last_error).lower() or '超时' in str(last_error):
         hint = '\n   💡 提示: 如果在中国大陆，请设置代理 export https_proxy=http://proxy:port'
     elif '404' in str(last_error):
-        hint = '\n   💡 提示: 官方 Skills Hub 可能尚未发布该 skill，请检查 URL 是否正确'
+        hint = '\n   💡 提示: 远程 skill URL 不存在，请检查 URL 或自定义 Skills Hub 配置'
     raise Exception(f'{last_error} (已重试 {retries} 次){hint}')
 
 
@@ -218,34 +218,45 @@ def remove_remote(agent_id: str, name: str) -> bool:
         return False
 
 
-OFFICIAL_SKILLS_HUB_BASE = 'https://raw.githubusercontent.com/openclaw-ai/skills-hub/main'
-# 备用镜像（GitHub 国内访问不稳定时自动切换）
-_FALLBACK_HUB_BASES = [
-    'https://ghproxy.com/https://raw.githubusercontent.com/openclaw-ai/skills-hub/main',
-    'https://raw.gitmirror.com/openclaw-ai/skills-hub/main',
-]
-
-# 支持通过环境变量覆盖 Hub 地址
+# 支持通过环境变量或本地配置指定自定义 Hub 地址
 _HUB_BASE_ENV = 'OPENCLAW_SKILLS_HUB_BASE'
 
-def _get_hub_url(skill_name):
-    """获取 skill 的 Hub URL，支持环境变量覆盖"""
+
+def _get_configured_hub_base():
+    """Return a user-provided skills hub base URL, if configured."""
+    env_base = os.environ.get(_HUB_BASE_ENV)
+    if env_base:
+        return env_base
+
     hub_url_file = OCLAW_HOME / 'skills-hub-url'
-    base = hub_url_file.read_text().strip() if hub_url_file.exists() else None
-    base = base or os.environ.get(_HUB_BASE_ENV) or OFFICIAL_SKILLS_HUB_BASE
+    return hub_url_file.read_text().strip() if hub_url_file.exists() else None
+
+
+def _get_hub_url(base, skill_name):
+    """获取 skill 的 Hub URL，支持环境变量/本地配置覆盖"""
     return f'{base.rstrip("/")}/{skill_name}/SKILL.md'
 
 
 OFFICIAL_SKILLS_HUB = {
-    'code_review': _get_hub_url('code_review'),
-    'api_design': _get_hub_url('api_design'),
-    'security_audit': _get_hub_url('security_audit'),
-    'data_analysis': _get_hub_url('data_analysis'),
-    'doc_generation': _get_hub_url('doc_generation'),
-    'test_framework': _get_hub_url('test_framework'),
     'mmx_cli': 'https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md',
 }
 
+_HUB_SKILL_NAMES = (
+    'code_review',
+    'api_design',
+    'security_audit',
+    'data_analysis',
+    'doc_generation',
+    'test_framework',
+)
+
+_configured_hub_base = _get_configured_hub_base()
+if _configured_hub_base:
+    OFFICIAL_SKILLS_HUB.update({
+        skill_name: _get_hub_url(_configured_hub_base, skill_name)
+        for skill_name in _HUB_SKILL_NAMES
+    })
+
 SKILL_AGENT_MAPPING = {
     'code_review': ('bingbu', 'xingbu', 'menxia'),
     'api_design': ('bingbu', 'gongbu', 'menxia'),
@@ -258,42 +269,27 @@ def _get_hub_url(skill_name):
 
 
 def import_official_hub(agent_ids: list) -> bool:
-    """从官方 Skills Hub 导入指定的 skills 到指定 agents。
+    """从默认 Skills 源或自定义 Hub 导入 skills 到指定 agents。
     如果未指定 agents，使用该 skill 的推荐 agents。
     """
-    if not agent_ids:
-        print('❌ 未指定 agent，使用推荐配置...\n')
-        for skill_name, recommended_agents in SKILL_AGENT_MAPPING.items():
-            agent_ids.extend(recommended_agents)
-        agent_ids = list(set(agent_ids))
+    requested_agents = list(agent_ids)
+    if not requested_agents:
+        print('ℹ️ 未指定 agent，使用推荐配置...\n')
     
     total = 0
     success = 0
     failed = []
     
     for skill_name, url in OFFICIAL_SKILLS_HUB.items():
         # 确定目标 agents
-        target_agents = agent_ids
-        if not agent_ids:
-            target_agents = SKILL_AGENT_MAPPING.get(skill_name, ['menxia'])
+        target_agents = requested_agents or list(SKILL_AGENT_MAPPING.get(skill_name, ['menxia']))
         
         print(f'\n📥 正在导入 skill: {skill_name}')
         print(f'   目标 agents: {", ".join(target_agents)}')
         
-        # 尝试主 URL，失败则自动切换镜像
-        effective_url = url
         for agent_id in target_agents:
             total += 1
-            ok = add_remote(agent_id, skill_name, effective_url, f'官方 skill：{skill_name}')
-            if not ok and effective_url == url:
-                # 主 URL 失败，尝试镜像
-                for fb_base in _FALLBACK_HUB_BASES:
-                    fb_url = f'{fb_base.rstrip("/")}/{skill_name}/SKILL.md'
-                    print(f'   🔄 尝试镜像: {fb_url}')
-                    ok = add_remote(agent_id, skill_name, fb_url, f'官方 skill：{skill_name}')
-                    if ok:
-                        effective_url = fb_url  # 后续 agent 也用这个镜像
-                        break
+            ok = add_remote(agent_id, skill_name, url, f'默认 skill：{skill_name}')
             if ok:
                 success += 1
             else:
@@ -305,10 +301,10 @@ def import_official_hub(agent_ids: list) -> bool:
         for f
```

**File**: `tests/test_skill_manager.py` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+import importlib.util
+import os
+import tempfile
+import unittest
+from pathlib import Path
+from unittest import mock
+
+
+def _load_skill_manager(openclaw_home, hub_base=None):
+    root = Path(__file__).resolve().parents[1]
+    script_path = root / "scripts" / "skill_manager.py"
+
+    env = {"OPENCLAW_HOME": str(openclaw_home)}
+    if hub_base is not None:
+        env["OPENCLAW_SKILLS_HUB_BASE"] = hub_base
+
+    spec = importlib.util.spec_from_file_location("skill_manager_under_test", script_path)
+    module = importlib.util.module_from_spec(spec)
+    with mock.patch.dict(os.environ, env, clear=False):
+        if hub_base is None:
+            os.environ.pop("OPENCLAW_SKILLS_HUB_BASE", None)
+        spec.loader.exec_module(module)
+    return module
+
+
+class SkillManagerTests(unittest.TestCase):
+    def test_default_skills_do_not_use_removed_openclaw_hub(self):
+        with tempfile.TemporaryDirectory() as tmp:
+            skill_manager = _load_skill_manager(Path(tmp) / ".openclaw")
+
+        self.assertIn("mmx_cli", skill_manager.OFFICIAL_SKILLS_HUB)
+        self.assertTrue(
+            all(
+                "openclaw-ai/skills-hub" not in url
+                for url in skill_manager.OFFICIAL_SKILLS_HUB.values()
+            )
+        )
+
+    def test_custom_hub_base_restores_hub_skill_urls(self):
+        with tempfile.TemporaryDirectory() as tmp:
+            skill_manager = _load_skill_manager(
+                Path(tmp) / ".openclaw",
+                hub_base="https://example.com/openclaw-skills",
+            )
+
+        self.assertEqual(
+            skill_manager.OFFICIAL_SKILLS_HUB["code_review"],
+            "https://example.com/openclaw-skills/code_review/SKILL.md",
+        )
+        self.assertEqual(
+            skill_manager.OFFICIAL_SKILLS_HUB["test_framework"],
+            "https://example.com/openclaw-skills/test_framework/SKILL.md",
+        )
+        self.assertEqual(
+            skill_manager.OFFICIAL_SKILLS_HUB["mmx_cli"],
+            "https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md",
+        )
+
+    def test_import_official_hub_uses_per_skill_recommended_agents(self):
+        with tempfile.TemporaryDirectory() as tmp:
+            skill_manager = _load_skill_manager(Path(tmp) / ".openclaw")
+
+        calls = []
+
+        def fake_add_remote(agent_id, skill_name, source_url, description=""):
+            calls.append((agent_id, skill_name, source_url, description))
+            return True
+
+        with mock.patch.object(skill_manager, "add_remote", fake_add_remote):
+            self.assertTrue(skill_manager.import_official_hub([]))
+
+        self.assertEqual(
+            calls,
+            [
+                (
+                    "menxia",
+                    "mmx_cli",
+                    "https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md",
+                    "默认 skill：mmx_cli",
+                ),
+                (
+                    "shangshu",
+                    "mmx_cli",
+                    "https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md",
+                    "默认 skill：mmx_cli",
+                ),
+            ],
+        )
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 4: `9a73a1f2` (2026-04-27)
**Commit Message**: Merge pull request #299 from voidborne-d/fix/task-mutation-race-condition

fix: eliminate TOCTOU race condition in concurrent task mutations

**File**: `dashboard/server.py` (modified, +190/-109)
```diff
@@ -142,7 +142,12 @@ def load_tasks():
 def save_tasks(tasks):
     task_data_dir = get_task_data_dir()
     atomic_json_write(task_data_dir / 'tasks_source.json', tasks)
-    # Trigger refresh (异步，不阻塞，避免僵尸进程)
+    _trigger_refresh()
+
+
+def _trigger_refresh():
+    """Trigger live data refresh in background."""
+    task_data_dir = get_task_data_dir()
     script = task_data_dir.parent / 'scripts' / 'refresh_live_data.py'
     if not script.exists():
         script = SCRIPTS / 'refresh_live_data.py'
@@ -155,6 +160,43 @@ def _refresh():
     threading.Thread(target=_refresh, daemon=True).start()
 
 
+def modify_tasks(modifier):
+    """Atomically read-modify-write the tasks file.
+
+    ``modifier(tasks)`` receives the current task list, mutates it in place
+    (or returns a new list), and the result is persisted while the file lock
+    is held.  This avoids the TOCTOU race inherent in separate
+    ``load_tasks()`` / ``save_tasks()`` calls when background threads
+    (dispatch callbacks, periodic scanner) and the HTTP handler mutate tasks
+    concurrently.
+    """
+    task_data_dir = get_task_data_dir()
+    path = task_data_dir / 'tasks_source.json'
+    atomic_json_update(path, modifier, default=[])
+    _trigger_refresh()
+
+
+def modify_task(task_id, updater):
+    """Atomically update a single task identified by *task_id*.
+
+    ``updater(task)`` receives the task dict and should mutate it in place.
+    Returns ``True`` if the task was found and updated, ``False`` otherwise.
+    """
+    found = [False]
+
+    def _modifier(tasks):
+        task = next((t for t in tasks if t.get('id') == task_id), None)
+        if task is None:
+            return tasks
+        updater(task)
+        task['updatedAt'] = now_iso()
+        found[0] = True
+        return tasks
+
+    modify_tasks(_modifier)
+    return found[0]
+
+
 def handle_task_action(task_id, action, reason):
     """Stop/cancel/resume a task from the dashboard."""
     tasks = load_tasks()
@@ -1070,15 +1112,17 @@ def _resolve_openclaw_bin():
 
 
 def _update_task_scheduler(task_id, updater):
-    tasks = load_tasks()
-    task = next((t for t in tasks if t.get('id') == task_id), None)
-    if not task:
-        return False
-    sched = _ensure_scheduler(task)
-    updater(task, sched)
-    task['updatedAt'] = now_iso()
-    save_tasks(tasks)
-    return True
+    """Atomically update a task's scheduler state.
+
+    Uses ``modify_task`` to hold the file lock for the entire
+    read-modify-write cycle, preventing concurrent dispatch threads and
+    the periodic scanner from clobbering each other's writes.
+    """
+    def _apply(task):
+        sched = _ensure_scheduler(task)
+        updater(task, sched)
+
+    return modify_task(task_id, _apply)
 
 
 def get_scheduler_state(task_id):
@@ -1104,6 +1148,7 @@ def get_scheduler_state(task_id):
 
 
 def handle_scheduler_retry(task_id, reason=''):
+    # Pre-check before acquiring lock (avoids holding lock for error paths)
     tasks = load_tasks()
     task = next((t for t in tasks if t.get('id') == task_id), None)
     if not task:
@@ -1112,16 +1157,24 @@ def handle_scheduler_retry(task_id, reason=''):
     if state in _TERMINAL_STATES or state == 'Blocked':
         return {'ok': False, 'error': f'任务 {task_id} 当前状态 {state} 不支持重试'}
 
-    sched = _ensure_scheduler(task)
-    sched['retryCount'] = int(sched.get('retryCount') or 0) + 1
-    sched['lastRetryAt'] = now_iso()
-    sched['lastDispatchTrigger'] = 'taizi-retry'
-    _scheduler_add_flow(task, f'触发重试第{sched["retryCount"]}次：{reason or "超时未推进"}')
-    task['updatedAt'] = now_iso()
-    save_tasks(tasks)
+    result = {'retryCount': 0, 'state': state}
 
-    dispatch_for_state(task_id, task, state, trigger='taizi-retry')
-    return {'ok': True, 'message': f'{task_id} 已触发重试派发', 'retryCount': sched['retryCount']}
+    def _apply(task):
+        cur = task.get('state', '')
+        if cur in _TERMINAL_STATES or cur == 'Blocked':
+            return  # state changed between pre-check and lock; skip
+        sched = _ensure_scheduler(task)
+        sched['retryCount'] = int(sched.get('retryCount') or 0) + 1
+        sched['lastRetryAt'] = now_iso()
+        sched['lastDispatchTrigger'] = 'taizi-retry'
+        _scheduler_add_flow(task, f'触发重试第{sched["retryCount"]}次：{reason or "超时未推进"}')
+        result['retryCount'] = sched['retryCount']
+        result['state'] = cur
+
+    modify_task(task_id, _apply)
+
+    dispatch_for_state(task_id, task, result['state'], trigger='taizi-retry')
+    return {'ok': True, 'message': f'{task_id} 已触发重试派发', 'retryCount': result['retryCount']}
 
 
 def handle_scheduler_escalate(task_id, reason=''):
@@ -1159,6 +1212,7 @@ def handle_scheduler_escalate(task_id, reason=''):
 
 
 def handle_scheduler_rollback(task_id, reason=''):
+    # Pre-check before acquiring lock
     tasks = load_tasks()
     task = next((t for t in tasks if t.get('id') == task_id), None)
     if not task:
@@ -1169,115 +1223,142 @@ de
```

**File**: `tests/test_task_mutation_race.py` (added, +327/-0)
```diff
@@ -0,0 +1,327 @@
+"""Tests for task mutation atomicity — verifying that concurrent writers
+(dispatch threads, periodic scanner, HTTP handlers) cannot clobber each
+other's changes.
+
+The core issue: the old ``load_tasks()`` + modify + ``save_tasks()`` pattern
+allows two concurrent threads to both read the same snapshot, each modify
+a different field, and the second ``save_tasks()`` overwrites the first's
+changes — a classic TOCTOU (Time-of-Check-Time-of-Use) race.
+
+The fix introduces ``modify_tasks()`` / ``modify_task()`` wrappers around
+``atomic_json_update()`` which hold the file lock for the entire
+read-modify-write cycle.
+"""
+import json
+import pathlib
+import sys
+import threading
+import time
+
+ROOT = pathlib.Path(__file__).resolve().parent.parent
+sys.path.insert(0, str(ROOT / 'dashboard'))
+sys.path.insert(0, str(ROOT / 'scripts'))
+
+
+def _setup_server(monkeypatch, tmp_path, tasks=None):
+    """Bootstrap server module with isolated data directory."""
+    import server as srv
+
+    data_dir = tmp_path / 'data'
+    data_dir.mkdir()
+    tasks_path = data_dir / 'tasks_source.json'
+    initial = tasks or []
+    tasks_path.write_text(json.dumps(initial, ensure_ascii=False), encoding='utf-8')
+    (data_dir / 'agent_config.json').write_text('{}', encoding='utf-8')
+
+    monkeypatch.setattr(srv, 'DATA', data_dir)
+    monkeypatch.setattr(srv, '_ACTIVE_TASK_DATA_DIR', data_dir)
+    monkeypatch.setattr(srv, 'SCRIPTS', tmp_path / 'scripts')  # avoid real scripts
+    monkeypatch.setattr(srv, '_check_gateway_alive', lambda: False)  # no real dispatch
+    # Suppress refresh subprocess
+    monkeypatch.setattr(srv, '_trigger_refresh', lambda: None)
+
+    return srv, data_dir, tasks_path
+
+
+# ── Test: modify_tasks holds file lock ──
+
+
+class TestModifyTasksAtomicity:
+    """Verify that ``modify_tasks`` uses atomic_json_update under the hood."""
+
+    def test_modify_tasks_exists_and_callable(self, monkeypatch, tmp_path):
+        srv, _, _ = _setup_server(monkeypatch, tmp_path)
+        assert callable(getattr(srv, 'modify_tasks', None)), \
+            'modify_tasks must be a callable function on server module'
+
+    def test_modify_task_exists_and_callable(self, monkeypatch, tmp_path):
+        srv, _, _ = _setup_server(monkeypatch, tmp_path)
+        assert callable(getattr(srv, 'modify_task', None)), \
+            'modify_task must be a callable function on server module'
+
+    def test_modify_task_updates_single_task(self, monkeypatch, tmp_path):
+        task = {
+            'id': 'T-001', 'title': '测试', 'state': 'Doing',
+            'org': '兵部', 'updatedAt': '2026-04-22T00:00:00Z',
+        }
+        srv, _, tasks_path = _setup_server(monkeypatch, tmp_path, [task])
+
+        found = srv.modify_task('T-001', lambda t: t.update({'state': 'Review'}))
+        assert found is True
+
+        data = json.loads(tasks_path.read_text(encoding='utf-8'))
+        assert data[0]['state'] == 'Review'
+        assert 'updatedAt' in data[0]  # auto-stamped
+
+    def test_modify_task_returns_false_for_missing(self, monkeypatch, tmp_path):
+        srv, _, _ = _setup_server(monkeypatch, tmp_path, [])
+        found = srv.modify_task('NONEXISTENT', lambda t: t.update({'state': 'Done'}))
+        assert found is False
+
+    def test_modify_tasks_bulk_update(self, monkeypatch, tmp_path):
+        tasks = [
+            {'id': 'T-A', 'title': 'A', 'state': 'Doing', 'org': '', 'updatedAt': ''},
+            {'id': 'T-B', 'title': 'B', 'state': 'Doing', 'org': '', 'updatedAt': ''},
+        ]
+        srv, _, tasks_path = _setup_server(monkeypatch, tmp_path, tasks)
+
+        def _mark_all_done(tasks):
+            for t in tasks:
+                t['state'] = 'Done'
+            return tasks
+
+        srv.modify_tasks(_mark_all_done)
+
+        data = json.loads(tasks_path.read_text(encoding='utf-8'))
+        assert all(t['state'] == 'Done' for t in data)
+
+
+# ── Test: _update_task_scheduler uses modify_task ──
+
+
+class TestUpdateTaskSchedulerAtomicity:
+    """Verify that ``_update_task_scheduler`` no longer uses the racy
+    ``load_tasks()`` + ``save_tasks()`` pattern."""
+
+    def test_scheduler_update_persists_atomically(self, monkeypatch, tmp_path):
+        task = {
+            'id': 'T-002', 'title': '派发测试', 'state': 'Taizi',
+            'org': '太子', 'updatedAt': '2026-04-22T01:00:00Z',
+        }
+        srv, _, tasks_path = _setup_server(monkeypatch, tmp_path, [task])
+
+        srv._update_task_scheduler('T-002', lambda t, s: s.update({
+            'lastDispatchStatus': 'success',
+            'lastDispatchAgent': 'taizi',
+        }))
+
+        data = json.loads(tasks_path.read_text(encoding='utf-8'))
+        sched = data[0].get('_scheduler', {})
+        assert sched['lastDispatchStatus'] == 'success'
+        assert sched['lastDispatchAgent'] == 'taizi'
+
+    def test_scheduler_update_missing_task(self, monkeypatch, tmp_path):
+        srv, _, _ = _setup_serv
```

---

### Incident Patch 5: `7280fad4` (2026-04-27)
**Commit Message**: Merge pull request #298 from njiangk/fix/python-3-10-startup-check

fix: require Python 3.10+ in edict startup scripts

**File**: `.gitignore` (modified, +1/-0)
```diff
@@ -30,6 +30,7 @@ venv/
 # Node.js
 node_modules/
 edict/frontend/node_modules/
+edict/frontend/dist/
 *.tsbuildinfo
 
 # Vite cache
```

**File**: `README.md` (modified, +1/-1)
```diff
@@ -284,7 +284,7 @@ docker compose up
 
 #### 前置条件
 - [OpenClaw](https://openclaw.ai) 已安装
-- Python 3.9+
+- Python 3.10+
 - macOS / Linux
 
 #### 安装
```

**File**: `scripts/run_loop.sh` (modified, +3/-2)
```diff
@@ -8,6 +8,7 @@ set -euo pipefail
 
 SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
 export EDICT_HOME="${EDICT_HOME:-$(dirname "$SCRIPT_DIR")}"
+PYTHON_BIN="${EDICT_PYTHON:-python3}"
 INTERVAL="${1:-15}"
 LOG="/tmp/sansheng_liubu_refresh.log"
 PIDFILE="/tmp/sansheng_liubu_refresh.pid"
@@ -58,14 +59,14 @@ echo "   按 Ctrl+C 停止"
 safe_run() {
   local script="$1"
   if command -v timeout &>/dev/null; then
-    timeout "$SCRIPT_TIMEOUT" python3 "$script" >> "$LOG" 2>&1 || {
+    timeout "$SCRIPT_TIMEOUT" "$PYTHON_BIN" "$script" >> "$LOG" 2>&1 || {
       local rc=$?
       if [[ $rc -eq 124 ]]; then
         echo "$(date '+%H:%M:%S') [loop] ⚠️ 脚本超时(${SCRIPT_TIMEOUT}s): $script" >> "$LOG"
       fi
     }
   else
-    python3 "$script" >> "$LOG" 2>&1 || true
+    "$PYTHON_BIN" "$script" >> "$LOG" 2>&1 || true
   fi
 }
 
```

**File**: `start.sh` (modified, +22/-5)
```diff
@@ -9,11 +9,27 @@ cd "$REPO_DIR"
 
 RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
 
-# 检查 Python
-if ! command -v python3 &>/dev/null; then
-  echo -e "${RED}❌ 未找到 python3，请先安装 Python 3.9+${NC}"
+resolve_python() {
+  local candidate version major minor
+  for candidate in "${EDICT_PYTHON:-}" python3.12 python3.11 python3.10 python3; do
+    [ -n "$candidate" ] || continue
+    command -v "$candidate" &>/dev/null || continue
+    version=$("$candidate" -c 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}")' 2>/dev/null) || continue
+    major=${version%%.*}
+    minor=${version#*.}
+    if [ "$major" -gt 3 ] || { [ "$major" -eq 3 ] && [ "$minor" -ge 10 ]; }; then
+      echo "$candidate"
+      return 0
+    fi
+  done
+  return 1
+}
+
+PYTHON_BIN=$(resolve_python) || {
+  echo -e "${RED}❌ 未找到可用的 Python 3.10+（当前项目实际需要 3.10+）${NC}"
   exit 1
-fi
+}
+export EDICT_PYTHON="$PYTHON_BIN"
 
 # 确保 data 目录存在
 mkdir -p "$REPO_DIR/data"
@@ -57,7 +73,8 @@ fi
 
 # 启动看板服务器
 echo -e "${GREEN}▶ 启动看板服务器...${NC}"
-python3 dashboard/server.py &
+echo -e "${GREEN}   使用 Python: ${PYTHON_BIN} ($($PYTHON_BIN --version 2>&1))${NC}"
+"$PYTHON_BIN" dashboard/server.py &
 SERVER_PID=$!
 
 sleep 1
```

---

### Incident Patch 6: `f21c0b29` (2026-04-25)
**Commit Message**: fix(skills): remove broken default skills hub

**File**: `README.md` (modified, +21/-24)
```diff
@@ -550,24 +550,24 @@ edict/
 #### 2️⃣ CLI 命令（最灵活）
 
 ```bash
-# 从 GitHub 添加 code_review skill 到中书省
+# 从 GitHub 添加 mmx_cli skill 到门下省
 python3 scripts/skill_manager.py add-remote \
-  --agent zhongshu \
-  --name code_review \
-  --source https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/code_review/SKILL.md \
-  --description "代码审查技能"
+  --agent menxia \
+  --name mmx_cli \
+  --source https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md \
+  --description "MiniMax 多模态 CLI 技能"
 
-# 一键导入官方 skills 库到指定 agents
+# 一键导入默认 skills 到指定 agents
 python3 scripts/skill_manager.py import-official-hub \
-  --agents zhongshu,menxia,shangshu,bingbu,xingbu
+  --agents menxia,shangshu
 
 # 列出所有已添加的远程 skills
 python3 scripts/skill_manager.py list-remote
 
 # 更新某个 skill 到最新版本
 python3 scripts/skill_manager.py update-remote \
-  --agent zhongshu \
-  --name code_review
+  --agent menxia \
+  --name mmx_cli
 ```
 
 #### 3️⃣ API 请求（自动化集成）
@@ -577,25 +577,22 @@ python3 scripts/skill_manager.py update-remote \
 curl -X POST http://localhost:7891/api/add-remote-skill \
   -H "Content-Type: application/json" \
   -d '{
-    "agentId": "zhongshu",
-    "skillName": "code_review",
-    "sourceUrl": "https://raw.githubusercontent.com/...",
-    "description": "代码审查"
+    "agentId": "menxia",
+    "skillName": "mmx_cli",
+    "sourceUrl": "https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md",
+    "description": "MiniMax 多模态 CLI 技能"
   }'
 
 # 查看所有远程 skills
 curl http://localhost:7891/api/remote-skills-list
 ```
 
-**官方 Skills Hub：** https://github.com/openclaw-ai/skills-hub
+**默认可导入 Skill：**
 
 支持的 Skills：
-- `code_review` — 代码审查（Python/JS/Go）
-- `api_design` — API 设计审查
-- `security_audit` — 安全审计
-- `data_analysis` — 数据分析
-- `doc_generation` — 文档生成
-- `test_framework` — 测试框架设计
+- `mmx_cli` — MiniMax 多模态 CLI 技能（文本、图像、视频、语音、音乐、搜索）
+
+如果你有自己的 Skills Hub，可以通过 `OPENCLAW_SKILLS_HUB_BASE` 或 `~/.openclaw/skills-hub-url` 配置自定义源。
 
 详见 [🎓 远程 Skills 资源管理指南](docs/remote-skills-guide.md)
 
@@ -636,7 +633,7 @@ curl http://localhost:7891/api/remote-skills-list
 
 - **[🎓 远程 Skills 资源管理指南](docs/remote-skills-guide.md)** — Skills 生态
   - 从网上连接和增补 skills，支持 GitHub/Gitee/任意 HTTPS URL
-  - 官方 Skills Hub 预设能力库
+  - 默认 Skills 源和自定义 Hub 支持
   - CLI 工具 + 看板 UI + Restful API
   - Skills 文件规范与安全防护
   - 支持版本管理和一键更新
@@ -711,17 +708,17 @@ docker compose up
 **排查**：
 ```bash
 # 测试网络连通性
-curl -I https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/code_review/SKILL.md
+curl -I https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md
 
 # 如果超时，使用代理
 export https_proxy=http://your-proxy:port
-python3 scripts/skill_manager.py import-official-hub --agents zhongshu
+python3 scripts/skill_manager.py import-official-hub --agents menxia
 ```
 
 **常见原因**：
 - 中国大陆访问 GitHub raw 资源需要代理
 - 网络超时（已增加到 30 秒 + 自动重试 3 次）
-- 官方 Skills Hub 仓库维护中
+- 默认 skill 源无法访问，或自定义 Skills Hub 配置错误
 
 </details>
 
```

**File**: `docs/remote-skills-guide.md` (modified, +20/-16)
```diff
@@ -7,7 +7,7 @@
 - **GitHub 仓库** (raw.githubusercontent.com)
 - **任何 HTTPS URL** (需返回有效的 skill 文件)
 - **本地文件路径**
-- **内置仓库** (官方 skills 库)
+- **默认 Skills 源** (经验证可访问的内置导入源)
 
 ---
 
@@ -157,28 +157,32 @@ python3 scripts/skill_manager.py remove-remote \
 
 ---
 
-## 官方 Skills 库
+## 默认 Skills 源
 
-### OpenClaw Skills Hub
+### MiniMax CLI Skill
 
-> **官方 skills 库地址**: https://github.com/openclaw-ai/skills-hub
+默认导入源包含经验证可访问的 MiniMax CLI skill。旧的 `openclaw-ai/skills-hub` 仓库当前不可用，因此不再作为默认官方源。
 
 可用 skills 列表：
 
 | Skill 名称 | 描述 | 适用 Agent | 源 URL |
 |-----------|------|----------|--------|
-| `code_review` | 代码审查（支持 Python/JS/Go） | 兵部/刑部 | https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/code_review/SKILL.md |
-| `api_design` | API 设计审查 | 兵部/工部 | https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/api_design/SKILL.md |
-| `security_audit` | 安全审计 | 刑部 | https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/security_audit/SKILL.md |
-| `data_analysis` | 数据分析 | 户部 | https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/data_analysis/SKILL.md |
-| `doc_generation` | 文档生成 | 礼部 | https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/doc_generation/SKILL.md |
-| `test_framework` | 测试框架设计 | 工部/刑部 | https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/test_framework/SKILL.md |
+| `mmx_cli` | MiniMax 多模态 CLI 技能 | 门下省/尚书省 | https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md |
 
-**一键导入官方 skills**
+如果你维护自己的 Skills Hub，可以使用以下方式指定 Hub base URL。指定后，`import-official-hub` 会按 `<base>/<skill_name>/SKILL.md` 解析 `code_review`、`api_design`、`security_audit`、`data_analysis`、`doc_generation`、`test_framework` 等传统 skill 名称。
+
+```bash
+export OPENCLAW_SKILLS_HUB_BASE=https://your-hub/raw-base
+
+# 或写入本地配置
+echo "https://your-hub/raw-base" > ~/.openclaw/skills-hub-url
+```
+
+**一键导入默认 skills**
 
 ```bash
 python3 scripts/skill_manager.py import-official-hub \
-  --agents zhongshu,menxia,shangshu,bingbu,xingbu,libu
+  --agents menxia,shangshu
 ```
 
 ---
@@ -360,7 +364,7 @@ compatibleAgents: [bingbu, xingbu, menxia]
 2. **大小限制**: 最多 10 MB
 3. **超时保护**: 下载超过 30 秒自动中止
 4. **路径遍历防护**: 检查解析后的 skill 名称，禁用 `../` 模式
-5. **checksum 验证**: 可选的 GPG 签名验证（仅官方库）
+5. **checksum 验证**: 可选的 GPG 签名验证（适用于可信发布源）
 
 ### 隔离执行
 
@@ -397,7 +401,7 @@ A: 不支持（安全考虑）。可以：
 
 **Q: 如何创建自己的 skills 库？**
 
-A: 参考 [OpenClaw Skills Hub](https://github.com/openclaw-ai/skills-hub) 的结构创建自己的仓库，然后：
+A: 按 `<skill_name>/SKILL.md` 的结构创建自己的仓库，然后：
 
 ```bash
 git clone https://github.com/yourname/my-skills-hub.git
@@ -406,7 +410,7 @@ cd my-skills-hub
 # 提交 & 推送到 GitHub
 ```
 
-然后通过 URL 或官方库导入功能添加即可。
+然后通过 URL 添加，或通过 `OPENCLAW_SKILLS_HUB_BASE` / `~/.openclaw/skills-hub-url` 配置为自定义 Hub 后导入。
 
 ---
 
@@ -442,7 +446,7 @@ python3 scripts/skill_manager.py check-updates --interval weekly
 
 ### 5. 贡献社区
 
-成熟的 skills 可向 [OpenClaw Skills Hub](https://github.com/openclaw-ai/skills-hub) 贡献。
+成熟的 skills 可以沉淀到你自己的公开 Skills Hub，并通过 `OPENCLAW_SKILLS_HUB_BASE` 分享给团队使用。
 
 ---
 
```

**File**: `docs/remote-skills-quickstart.md` (modified, +41/-39)
```diff
@@ -10,21 +10,21 @@ python3 dashboard/server.py
 # 输出: 三省六部看板启动 → http://127.0.0.1:7891
 ```
 
-### 2. 添加官方 Skill（CLI）
+### 2. 添加默认 Skill（CLI）
 
 ```bash
-# 为中书省添加代码审查 skill
+# 为门下省添加 MiniMax CLI skill
 python3 scripts/skill_manager.py add-remote \
-  --agent zhongshu \
-  --name code_review \
-  --source https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/code_review/SKILL.md \
-  --description "代码审查能力"
+  --agent menxia \
+  --name mmx_cli \
+  --source https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md \
+  --description "MiniMax 多模态 CLI 技能"
 
 # 输出:
 # ⏳ 正在从 https://raw.githubusercontent.com/... 下载...
-# ✅ 技能 code_review 已添加到 zhongshu
-#    路径: /Users/xxx/.openclaw/workspace-zhongshu/skills/code_review/SKILL.md
-#    大小: 2048 字节
+# ✅ 技能 mmx_cli 已添加到 menxia
+#    路径: /Users/xxx/.openclaw/workspace-menxia/skills/mmx_cli/SKILL.md
+#    大小: 14655 字节
 ```
 
 ### 3. 列出所有远程 Skills
@@ -37,7 +37,7 @@ python3 scripts/skill_manager.py list-remote
 # 
 # Agent       | Skill 名称           | 描述                           | 添加时间
 # ------------|----------------------|--------------------------------|----------
-# zhongshu    | code_review          | 代码审查能力                   | 2026-03-02
+# menxia      | mmx_cli              | MiniMax 多模态 CLI 技能         | 2026-03-02
 ```
 
 ### 4. 查看 API 响应
@@ -50,11 +50,11 @@ curl http://localhost:7891/api/remote-skills-list | jq .
 #   "ok": true,
 #   "remoteSkills": [
 #     {
-#       "skillName": "code_review",
-#       "agentId": "zhongshu",
+#       "skillName": "mmx_cli",
+#       "agentId": "menxia",
 #       "sourceUrl": "https://raw.githubusercontent.com/...",
-#       "description": "代码审查能力",
-#       "localPath": "/Users/xxx/.openclaw/workspace-zhongshu/skills/code_review/SKILL.md",
+#       "description": "MiniMax 多模态 CLI 技能",
+#       "localPath": "/Users/xxx/.openclaw/workspace-menxia/skills/mmx_cli/SKILL.md",
 #       "addedAt": "2026-03-02T14:30:00Z",
 #       "lastUpdated": "2026-03-02T14:30:00Z",
 #       "status": "valid"
@@ -69,44 +69,47 @@ curl http://localhost:7891/api/remote-skills-list | jq .
 
 ## 常见操作
 
-### 一键导入官方库中的所有 skills
+### 一键导入默认 skills
 
 ```bash
 python3 scripts/skill_manager.py import-official-hub \
-  --agents zhongshu,menxia,shangshu,bingbu,xingbu
+  --agents menxia,shangshu
 ```
 
-这会自动为每个 agent 添加：
-- **zhongshu**: code_review, api_design, doc_generation
-- **menxia**: code_review, api_design, security_audit, data_analysis, doc_generation, test_framework
-- **shangshu**: 同 menxia（协调者）
-- **bingbu**: code_review, api_design, test_framework
-- **xingbu**: code_review, security_audit, test_framework
+这会为指定 agent 添加默认可用的 `mmx_cli` skill。旧的 `openclaw-ai/skills-hub` 仓库当前不可用，因此不再作为默认官方源。
+
+如果你维护自己的 Skills Hub，可以通过环境变量或本地配置指定：
+
+```bash
+export OPENCLAW_SKILLS_HUB_BASE=https://your-hub/raw-base
+# 或
+echo "https://your-hub/raw-base" > ~/.openclaw/skills-hub-url
+```
 
 ### 更新某个 Skill 到最新版本
 
 ```bash
 python3 scripts/skill_manager.py update-remote \
-  --agent zhongshu \
-  --name code_review
+  --agent menxia \
+  --name mmx_cli
 
 # 输出:
 # ⏳ 正在从 https://raw.githubusercontent.com/... 下载...
-# ✅ 技能 code_review 已添加到 zhongshu
+# ✅ 技能 mmx_cli 已添加到 menxia
 # ✅ 技能已更新
-#    路径: /Users/xxx/.openclaw/workspace-zhongshu/skills/code_review/SKILL.md
-#    大小: 2156 字节
+#    路径: /Users/xxx/.openclaw/workspace-menxia/skills/mmx_cli/SKILL.md
+#    大小: 14655 字节
 ```
 
 ### 移除某个 Skill
 
 ```bash
 python3 scripts/skill_manager.py remove-remote \
-  --agent zhongshu \
-  --name code_review
+  --agent menxia \
+  --name mmx_cli
 
 # 输出:
-# ✅ 技能 code_review 已从 zhongshu 移除
+# ✅ 技能 mmx_cli 已从 menxia 移除
 ```
 
 ---
@@ -119,10 +122,10 @@ python3 scripts/skill_manager.py remove-remote \
 2. 进入 🔧 **技能配置** 面板
 3. 点击 **➕ 添加远程 Skill** 按钮
 4. 填写表单：
-   - **Agent**: 从下拉列表选择（如 zhongshu）
-   - **Skill 名称**: 输入内部 ID 如 `code_review`
-   - **远程 URL**: 粘贴 GitHub URL 如 `https://raw.githubusercontent.com/openclaw-ai/skills-hub/main/code_review/SKILL.md`
-   - **中文描述**: 可选，如 `代码审查能力`
+   - **Agent**: 从下拉列表选择（如 menxia）
+   - **Skill 名称**: 输入内部 ID 如 `mmx_cli`
+   - **远程 URL**: 粘贴 GitHub URL 如 `https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md`
+   - **中文描述**: 可选，如 `MiniMax 多模态 CLI 技能`
 5. 点击 **导入** 按钮
 6. 等待 1-2 秒，看到 ✅ 成功提示
 
@@ -247,11 +250,11 @@ curl http://localhost:7891/api/remote-skills-list
   "ok": true,
   "remoteSkills": [
     {
-      "skillName": "code_review",
-      "agentId": "zhongshu",
+      "skillName": "mmx_cli",
+      "agentId": "menxia",
       "sourceUrl": "https://raw.githubusercontent.com/...",
-      "description": "代码审查能力",
-      "localPath": "/Users/xxx/.openclaw/workspace-zhongshu/skills/code_review/SKILL.md",
+      "description": "MiniMax 多模态 CLI 技能",
+      "localPath": "/Users/xxx/.openclaw/workspace-menxia/skills/mmx_cli/SKILL.md",
       "addedAt": "2026-03-02T14:30:00Z",
       "lastUpdated": "2026-03-02T14:30:00Z",
       "status": "valid"
@@ -333,4 +336,3 @@ ls -la ~/.openclaw/workspace-zhongshu/skills/
 
```

**File**: `scripts/skill_manager.py` (modified, +41/-45)
```diff
@@ -14,7 +14,7 @@
   
   python3 scripts/skill_manager.py remove-remote --agent zhongshu --name code_review
   
-  python3 scripts/skill_manager.py import-official-hub --agents zhongshu,menxia,shangshu
+  python3 scripts/skill_manager.py import-official-hub --agents menxia,shangshu
 """
 import sys
 import json
@@ -60,7 +60,7 @@ def _download_file(url: str, timeout: int = 30, retries: int = 3) -> str:
     if 'timed out' in str(last_error).lower() or '超时' in str(last_error):
         hint = '\n   💡 提示: 如果在中国大陆，请设置代理 export https_proxy=http://proxy:port'
     elif '404' in str(last_error):
-        hint = '\n   💡 提示: 官方 Skills Hub 可能尚未发布该 skill，请检查 URL 是否正确'
+        hint = '\n   💡 提示: 远程 skill URL 不存在，请检查 URL 或自定义 Skills Hub 配置'
     raise Exception(f'{last_error} (已重试 {retries} 次){hint}')
 
 
@@ -218,34 +218,45 @@ def remove_remote(agent_id: str, name: str) -> bool:
         return False
 
 
-OFFICIAL_SKILLS_HUB_BASE = 'https://raw.githubusercontent.com/openclaw-ai/skills-hub/main'
-# 备用镜像（GitHub 国内访问不稳定时自动切换）
-_FALLBACK_HUB_BASES = [
-    'https://ghproxy.com/https://raw.githubusercontent.com/openclaw-ai/skills-hub/main',
-    'https://raw.gitmirror.com/openclaw-ai/skills-hub/main',
-]
-
-# 支持通过环境变量覆盖 Hub 地址
+# 支持通过环境变量或本地配置指定自定义 Hub 地址
 _HUB_BASE_ENV = 'OPENCLAW_SKILLS_HUB_BASE'
 
-def _get_hub_url(skill_name):
-    """获取 skill 的 Hub URL，支持环境变量覆盖"""
+
+def _get_configured_hub_base():
+    """Return a user-provided skills hub base URL, if configured."""
+    env_base = os.environ.get(_HUB_BASE_ENV)
+    if env_base:
+        return env_base
+
     hub_url_file = OCLAW_HOME / 'skills-hub-url'
-    base = hub_url_file.read_text().strip() if hub_url_file.exists() else None
-    base = base or os.environ.get(_HUB_BASE_ENV) or OFFICIAL_SKILLS_HUB_BASE
+    return hub_url_file.read_text().strip() if hub_url_file.exists() else None
+
+
+def _get_hub_url(base, skill_name):
+    """获取 skill 的 Hub URL，支持环境变量/本地配置覆盖"""
     return f'{base.rstrip("/")}/{skill_name}/SKILL.md'
 
 
 OFFICIAL_SKILLS_HUB = {
-    'code_review': _get_hub_url('code_review'),
-    'api_design': _get_hub_url('api_design'),
-    'security_audit': _get_hub_url('security_audit'),
-    'data_analysis': _get_hub_url('data_analysis'),
-    'doc_generation': _get_hub_url('doc_generation'),
-    'test_framework': _get_hub_url('test_framework'),
     'mmx_cli': 'https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md',
 }
 
+_HUB_SKILL_NAMES = (
+    'code_review',
+    'api_design',
+    'security_audit',
+    'data_analysis',
+    'doc_generation',
+    'test_framework',
+)
+
+_configured_hub_base = _get_configured_hub_base()
+if _configured_hub_base:
+    OFFICIAL_SKILLS_HUB.update({
+        skill_name: _get_hub_url(_configured_hub_base, skill_name)
+        for skill_name in _HUB_SKILL_NAMES
+    })
+
 SKILL_AGENT_MAPPING = {
     'code_review': ('bingbu', 'xingbu', 'menxia'),
     'api_design': ('bingbu', 'gongbu', 'menxia'),
@@ -258,42 +269,27 @@ def _get_hub_url(skill_name):
 
 
 def import_official_hub(agent_ids: list) -> bool:
-    """从官方 Skills Hub 导入指定的 skills 到指定 agents。
+    """从默认 Skills 源或自定义 Hub 导入 skills 到指定 agents。
     如果未指定 agents，使用该 skill 的推荐 agents。
     """
-    if not agent_ids:
-        print('❌ 未指定 agent，使用推荐配置...\n')
-        for skill_name, recommended_agents in SKILL_AGENT_MAPPING.items():
-            agent_ids.extend(recommended_agents)
-        agent_ids = list(set(agent_ids))
+    requested_agents = list(agent_ids)
+    if not requested_agents:
+        print('ℹ️ 未指定 agent，使用推荐配置...\n')
     
     total = 0
     success = 0
     failed = []
     
     for skill_name, url in OFFICIAL_SKILLS_HUB.items():
         # 确定目标 agents
-        target_agents = agent_ids
-        if not agent_ids:
-            target_agents = SKILL_AGENT_MAPPING.get(skill_name, ['menxia'])
+        target_agents = requested_agents or list(SKILL_AGENT_MAPPING.get(skill_name, ['menxia']))
         
         print(f'\n📥 正在导入 skill: {skill_name}')
         print(f'   目标 agents: {", ".join(target_agents)}')
         
-        # 尝试主 URL，失败则自动切换镜像
-        effective_url = url
         for agent_id in target_agents:
             total += 1
-            ok = add_remote(agent_id, skill_name, effective_url, f'官方 skill：{skill_name}')
-            if not ok and effective_url == url:
-                # 主 URL 失败，尝试镜像
-                for fb_base in _FALLBACK_HUB_BASES:
-                    fb_url = f'{fb_base.rstrip("/")}/{skill_name}/SKILL.md'
-                    print(f'   🔄 尝试镜像: {fb_url}')
-                    ok = add_remote(agent_id, skill_name, fb_url, f'官方 skill：{skill_name}')
-                    if ok:
-                        effective_url = fb_url  # 后续 agent 也用这个镜像
-                        break
+            ok = add_remote(agent_id, skill_name, url, f'默认 skill：{skill_name}')
             if ok:
                 success += 1
             else:
@@ -305,10 +301,10 @@ def import_official_hub(agent_ids: list) -> bool:
         for f
```

**File**: `tests/test_skill_manager.py` (added, +92/-0)
```diff
@@ -0,0 +1,92 @@
+import importlib.util
+import os
+import tempfile
+import unittest
+from pathlib import Path
+from unittest import mock
+
+
+def _load_skill_manager(openclaw_home, hub_base=None):
+    root = Path(__file__).resolve().parents[1]
+    script_path = root / "scripts" / "skill_manager.py"
+
+    env = {"OPENCLAW_HOME": str(openclaw_home)}
+    if hub_base is not None:
+        env["OPENCLAW_SKILLS_HUB_BASE"] = hub_base
+
+    spec = importlib.util.spec_from_file_location("skill_manager_under_test", script_path)
+    module = importlib.util.module_from_spec(spec)
+    with mock.patch.dict(os.environ, env, clear=False):
+        if hub_base is None:
+            os.environ.pop("OPENCLAW_SKILLS_HUB_BASE", None)
+        spec.loader.exec_module(module)
+    return module
+
+
+class SkillManagerTests(unittest.TestCase):
+    def test_default_skills_do_not_use_removed_openclaw_hub(self):
+        with tempfile.TemporaryDirectory() as tmp:
+            skill_manager = _load_skill_manager(Path(tmp) / ".openclaw")
+
+        self.assertIn("mmx_cli", skill_manager.OFFICIAL_SKILLS_HUB)
+        self.assertTrue(
+            all(
+                "openclaw-ai/skills-hub" not in url
+                for url in skill_manager.OFFICIAL_SKILLS_HUB.values()
+            )
+        )
+
+    def test_custom_hub_base_restores_hub_skill_urls(self):
+        with tempfile.TemporaryDirectory() as tmp:
+            skill_manager = _load_skill_manager(
+                Path(tmp) / ".openclaw",
+                hub_base="https://example.com/openclaw-skills",
+            )
+
+        self.assertEqual(
+            skill_manager.OFFICIAL_SKILLS_HUB["code_review"],
+            "https://example.com/openclaw-skills/code_review/SKILL.md",
+        )
+        self.assertEqual(
+            skill_manager.OFFICIAL_SKILLS_HUB["test_framework"],
+            "https://example.com/openclaw-skills/test_framework/SKILL.md",
+        )
+        self.assertEqual(
+            skill_manager.OFFICIAL_SKILLS_HUB["mmx_cli"],
+            "https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md",
+        )
+
+    def test_import_official_hub_uses_per_skill_recommended_agents(self):
+        with tempfile.TemporaryDirectory() as tmp:
+            skill_manager = _load_skill_manager(Path(tmp) / ".openclaw")
+
+        calls = []
+
+        def fake_add_remote(agent_id, skill_name, source_url, description=""):
+            calls.append((agent_id, skill_name, source_url, description))
+            return True
+
+        with mock.patch.object(skill_manager, "add_remote", fake_add_remote):
+            self.assertTrue(skill_manager.import_official_hub([]))
+
+        self.assertEqual(
+            calls,
+            [
+                (
+                    "menxia",
+                    "mmx_cli",
+                    "https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md",
+                    "默认 skill：mmx_cli",
+                ),
+                (
+                    "shangshu",
+                    "mmx_cli",
+                    "https://raw.githubusercontent.com/MiniMax-AI/cli/main/skill/SKILL.md",
+                    "默认 skill：mmx_cli",
+                ),
+            ],
+        )
+
+
+if __name__ == "__main__":
+    unittest.main()
```

---

### Incident Patch 7: `714f442e` (2026-04-22)
**Commit Message**: fix: eliminate TOCTOU race in task mutation paths

Background dispatch threads, the periodic scheduler scan, and HTTP
handlers all followed a load_tasks() → modify → save_tasks() pattern
without any mutual exclusion.  The atomic_json_write only protects the
write itself; it does NOT prevent a concurrent reader from loading a
stale snapshot and overwriting another thread's changes.

Scenario (before this fix):
  1. HTTP handler calls load_tasks() — gets snapshot A
  2. Dispatch thread calls load_tasks() — gets the same snapshot A
  3. HTTP handler modifies task X, calls save_tasks() — writes A'
  4. Dispatch thread modifies task Y, calls save_tasks() — writes A''
     (based on A, not A'), silently losing the HTTP handler's changes
     to task X

This is a classic TOCTOU (Time-of-Check-Time-of-Use) race.  The project
already has atomic_json_update() in file_lock.py that holds an exclusive
lock for the entire read-modify-write cycle, but none of the task
mutation paths used it.

Fix:
- Add modify_tasks(modifier) wrapper around atomic_json_update +
  refresh trigger
- Add modify_task(task_id, updater) convenience wrapper for single-task
  mutations
- Convert _update_task_scheduler (c

**File**: `dashboard/server.py` (modified, +190/-109)
```diff
@@ -142,7 +142,12 @@ def load_tasks():
 def save_tasks(tasks):
     task_data_dir = get_task_data_dir()
     atomic_json_write(task_data_dir / 'tasks_source.json', tasks)
-    # Trigger refresh (异步，不阻塞，避免僵尸进程)
+    _trigger_refresh()
+
+
+def _trigger_refresh():
+    """Trigger live data refresh in background."""
+    task_data_dir = get_task_data_dir()
     script = task_data_dir.parent / 'scripts' / 'refresh_live_data.py'
     if not script.exists():
         script = SCRIPTS / 'refresh_live_data.py'
@@ -155,6 +160,43 @@ def _refresh():
     threading.Thread(target=_refresh, daemon=True).start()
 
 
+def modify_tasks(modifier):
+    """Atomically read-modify-write the tasks file.
+
+    ``modifier(tasks)`` receives the current task list, mutates it in place
+    (or returns a new list), and the result is persisted while the file lock
+    is held.  This avoids the TOCTOU race inherent in separate
+    ``load_tasks()`` / ``save_tasks()`` calls when background threads
+    (dispatch callbacks, periodic scanner) and the HTTP handler mutate tasks
+    concurrently.
+    """
+    task_data_dir = get_task_data_dir()
+    path = task_data_dir / 'tasks_source.json'
+    atomic_json_update(path, modifier, default=[])
+    _trigger_refresh()
+
+
+def modify_task(task_id, updater):
+    """Atomically update a single task identified by *task_id*.
+
+    ``updater(task)`` receives the task dict and should mutate it in place.
+    Returns ``True`` if the task was found and updated, ``False`` otherwise.
+    """
+    found = [False]
+
+    def _modifier(tasks):
+        task = next((t for t in tasks if t.get('id') == task_id), None)
+        if task is None:
+            return tasks
+        updater(task)
+        task['updatedAt'] = now_iso()
+        found[0] = True
+        return tasks
+
+    modify_tasks(_modifier)
+    return found[0]
+
+
 def handle_task_action(task_id, action, reason):
     """Stop/cancel/resume a task from the dashboard."""
     tasks = load_tasks()
@@ -1070,15 +1112,17 @@ def _resolve_openclaw_bin():
 
 
 def _update_task_scheduler(task_id, updater):
-    tasks = load_tasks()
-    task = next((t for t in tasks if t.get('id') == task_id), None)
-    if not task:
-        return False
-    sched = _ensure_scheduler(task)
-    updater(task, sched)
-    task['updatedAt'] = now_iso()
-    save_tasks(tasks)
-    return True
+    """Atomically update a task's scheduler state.
+
+    Uses ``modify_task`` to hold the file lock for the entire
+    read-modify-write cycle, preventing concurrent dispatch threads and
+    the periodic scanner from clobbering each other's writes.
+    """
+    def _apply(task):
+        sched = _ensure_scheduler(task)
+        updater(task, sched)
+
+    return modify_task(task_id, _apply)
 
 
 def get_scheduler_state(task_id):
@@ -1104,6 +1148,7 @@ def get_scheduler_state(task_id):
 
 
 def handle_scheduler_retry(task_id, reason=''):
+    # Pre-check before acquiring lock (avoids holding lock for error paths)
     tasks = load_tasks()
     task = next((t for t in tasks if t.get('id') == task_id), None)
     if not task:
@@ -1112,16 +1157,24 @@ def handle_scheduler_retry(task_id, reason=''):
     if state in _TERMINAL_STATES or state == 'Blocked':
         return {'ok': False, 'error': f'任务 {task_id} 当前状态 {state} 不支持重试'}
 
-    sched = _ensure_scheduler(task)
-    sched['retryCount'] = int(sched.get('retryCount') or 0) + 1
-    sched['lastRetryAt'] = now_iso()
-    sched['lastDispatchTrigger'] = 'taizi-retry'
-    _scheduler_add_flow(task, f'触发重试第{sched["retryCount"]}次：{reason or "超时未推进"}')
-    task['updatedAt'] = now_iso()
-    save_tasks(tasks)
+    result = {'retryCount': 0, 'state': state}
 
-    dispatch_for_state(task_id, task, state, trigger='taizi-retry')
-    return {'ok': True, 'message': f'{task_id} 已触发重试派发', 'retryCount': sched['retryCount']}
+    def _apply(task):
+        cur = task.get('state', '')
+        if cur in _TERMINAL_STATES or cur == 'Blocked':
+            return  # state changed between pre-check and lock; skip
+        sched = _ensure_scheduler(task)
+        sched['retryCount'] = int(sched.get('retryCount') or 0) + 1
+        sched['lastRetryAt'] = now_iso()
+        sched['lastDispatchTrigger'] = 'taizi-retry'
+        _scheduler_add_flow(task, f'触发重试第{sched["retryCount"]}次：{reason or "超时未推进"}')
+        result['retryCount'] = sched['retryCount']
+        result['state'] = cur
+
+    modify_task(task_id, _apply)
+
+    dispatch_for_state(task_id, task, result['state'], trigger='taizi-retry')
+    return {'ok': True, 'message': f'{task_id} 已触发重试派发', 'retryCount': result['retryCount']}
 
 
 def handle_scheduler_escalate(task_id, reason=''):
@@ -1159,6 +1212,7 @@ def handle_scheduler_escalate(task_id, reason=''):
 
 
 def handle_scheduler_rollback(task_id, reason=''):
+    # Pre-check before acquiring lock
     tasks = load_tasks()
     task = next((t for t in tasks if t.get('id') == task_id), None)
     if not task:
@@ -1169,115 +1223,142 @@ de
```

**File**: `tests/test_task_mutation_race.py` (added, +327/-0)
```diff
@@ -0,0 +1,327 @@
+"""Tests for task mutation atomicity — verifying that concurrent writers
+(dispatch threads, periodic scanner, HTTP handlers) cannot clobber each
+other's changes.
+
+The core issue: the old ``load_tasks()`` + modify + ``save_tasks()`` pattern
+allows two concurrent threads to both read the same snapshot, each modify
+a different field, and the second ``save_tasks()`` overwrites the first's
+changes — a classic TOCTOU (Time-of-Check-Time-of-Use) race.
+
+The fix introduces ``modify_tasks()`` / ``modify_task()`` wrappers around
+``atomic_json_update()`` which hold the file lock for the entire
+read-modify-write cycle.
+"""
+import json
+import pathlib
+import sys
+import threading
+import time
+
+ROOT = pathlib.Path(__file__).resolve().parent.parent
+sys.path.insert(0, str(ROOT / 'dashboard'))
+sys.path.insert(0, str(ROOT / 'scripts'))
+
+
+def _setup_server(monkeypatch, tmp_path, tasks=None):
+    """Bootstrap server module with isolated data directory."""
+    import server as srv
+
+    data_dir = tmp_path / 'data'
+    data_dir.mkdir()
+    tasks_path = data_dir / 'tasks_source.json'
+    initial = tasks or []
+    tasks_path.write_text(json.dumps(initial, ensure_ascii=False), encoding='utf-8')
+    (data_dir / 'agent_config.json').write_text('{}', encoding='utf-8')
+
+    monkeypatch.setattr(srv, 'DATA', data_dir)
+    monkeypatch.setattr(srv, '_ACTIVE_TASK_DATA_DIR', data_dir)
+    monkeypatch.setattr(srv, 'SCRIPTS', tmp_path / 'scripts')  # avoid real scripts
+    monkeypatch.setattr(srv, '_check_gateway_alive', lambda: False)  # no real dispatch
+    # Suppress refresh subprocess
+    monkeypatch.setattr(srv, '_trigger_refresh', lambda: None)
+
+    return srv, data_dir, tasks_path
+
+
+# ── Test: modify_tasks holds file lock ──
+
+
+class TestModifyTasksAtomicity:
+    """Verify that ``modify_tasks`` uses atomic_json_update under the hood."""
+
+    def test_modify_tasks_exists_and_callable(self, monkeypatch, tmp_path):
+        srv, _, _ = _setup_server(monkeypatch, tmp_path)
+        assert callable(getattr(srv, 'modify_tasks', None)), \
+            'modify_tasks must be a callable function on server module'
+
+    def test_modify_task_exists_and_callable(self, monkeypatch, tmp_path):
+        srv, _, _ = _setup_server(monkeypatch, tmp_path)
+        assert callable(getattr(srv, 'modify_task', None)), \
+            'modify_task must be a callable function on server module'
+
+    def test_modify_task_updates_single_task(self, monkeypatch, tmp_path):
+        task = {
+            'id': 'T-001', 'title': '测试', 'state': 'Doing',
+            'org': '兵部', 'updatedAt': '2026-04-22T00:00:00Z',
+        }
+        srv, _, tasks_path = _setup_server(monkeypatch, tmp_path, [task])
+
+        found = srv.modify_task('T-001', lambda t: t.update({'state': 'Review'}))
+        assert found is True
+
+        data = json.loads(tasks_path.read_text(encoding='utf-8'))
+        assert data[0]['state'] == 'Review'
+        assert 'updatedAt' in data[0]  # auto-stamped
+
+    def test_modify_task_returns_false_for_missing(self, monkeypatch, tmp_path):
+        srv, _, _ = _setup_server(monkeypatch, tmp_path, [])
+        found = srv.modify_task('NONEXISTENT', lambda t: t.update({'state': 'Done'}))
+        assert found is False
+
+    def test_modify_tasks_bulk_update(self, monkeypatch, tmp_path):
+        tasks = [
+            {'id': 'T-A', 'title': 'A', 'state': 'Doing', 'org': '', 'updatedAt': ''},
+            {'id': 'T-B', 'title': 'B', 'state': 'Doing', 'org': '', 'updatedAt': ''},
+        ]
+        srv, _, tasks_path = _setup_server(monkeypatch, tmp_path, tasks)
+
+        def _mark_all_done(tasks):
+            for t in tasks:
+                t['state'] = 'Done'
+            return tasks
+
+        srv.modify_tasks(_mark_all_done)
+
+        data = json.loads(tasks_path.read_text(encoding='utf-8'))
+        assert all(t['state'] == 'Done' for t in data)
+
+
+# ── Test: _update_task_scheduler uses modify_task ──
+
+
+class TestUpdateTaskSchedulerAtomicity:
+    """Verify that ``_update_task_scheduler`` no longer uses the racy
+    ``load_tasks()`` + ``save_tasks()`` pattern."""
+
+    def test_scheduler_update_persists_atomically(self, monkeypatch, tmp_path):
+        task = {
+            'id': 'T-002', 'title': '派发测试', 'state': 'Taizi',
+            'org': '太子', 'updatedAt': '2026-04-22T01:00:00Z',
+        }
+        srv, _, tasks_path = _setup_server(monkeypatch, tmp_path, [task])
+
+        srv._update_task_scheduler('T-002', lambda t, s: s.update({
+            'lastDispatchStatus': 'success',
+            'lastDispatchAgent': 'taizi',
+        }))
+
+        data = json.loads(tasks_path.read_text(encoding='utf-8'))
+        sched = data[0].get('_scheduler', {})
+        assert sched['lastDispatchStatus'] == 'success'
+        assert sched['lastDispatchAgent'] == 'taizi'
+
+    def test_scheduler_update_missing_task(self, monkeypatch, tmp_path):
+        srv, _, _ = _setup_serv
```

---

### Incident Patch 8: `79f21eff` (2026-04-21)
**Commit Message**: fix: require Python 3.10+ in edict startup scripts

**File**: `README.md` (modified, +1/-1)
```diff
@@ -284,7 +284,7 @@ docker compose up
 
 #### 前置条件
 - [OpenClaw](https://openclaw.ai) 已安装
-- Python 3.9+
+- Python 3.10+
 - macOS / Linux
 
 #### 安装
```

**File**: `scripts/run_loop.sh` (modified, +3/-2)
```diff
@@ -8,6 +8,7 @@ set -euo pipefail
 
 SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
 export EDICT_HOME="${EDICT_HOME:-$(dirname "$SCRIPT_DIR")}"
+PYTHON_BIN="${EDICT_PYTHON:-python3}"
 INTERVAL="${1:-15}"
 LOG="/tmp/sansheng_liubu_refresh.log"
 PIDFILE="/tmp/sansheng_liubu_refresh.pid"
@@ -58,14 +59,14 @@ echo "   按 Ctrl+C 停止"
 safe_run() {
   local script="$1"
   if command -v timeout &>/dev/null; then
-    timeout "$SCRIPT_TIMEOUT" python3 "$script" >> "$LOG" 2>&1 || {
+    timeout "$SCRIPT_TIMEOUT" "$PYTHON_BIN" "$script" >> "$LOG" 2>&1 || {
       local rc=$?
       if [[ $rc -eq 124 ]]; then
         echo "$(date '+%H:%M:%S') [loop] ⚠️ 脚本超时(${SCRIPT_TIMEOUT}s): $script" >> "$LOG"
       fi
     }
   else
-    python3 "$script" >> "$LOG" 2>&1 || true
+    "$PYTHON_BIN" "$script" >> "$LOG" 2>&1 || true
   fi
 }
 
```

**File**: `start.sh` (modified, +22/-5)
```diff
@@ -9,11 +9,27 @@ cd "$REPO_DIR"
 
 RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
 
-# 检查 Python
-if ! command -v python3 &>/dev/null; then
-  echo -e "${RED}❌ 未找到 python3，请先安装 Python 3.9+${NC}"
+resolve_python() {
+  local candidate version major minor
+  for candidate in "${EDICT_PYTHON:-}" python3.12 python3.11 python3.10 python3; do
+    [ -n "$candidate" ] || continue
+    command -v "$candidate" &>/dev/null || continue
+    version=$("$candidate" -c 'import sys; print(f"{sys.version_info[0]}.{sys.version_info[1]}")' 2>/dev/null) || continue
+    major=${version%%.*}
+    minor=${version#*.}
+    if [ "$major" -gt 3 ] || { [ "$major" -eq 3 ] && [ "$minor" -ge 10 ]; }; then
+      echo "$candidate"
+      return 0
+    fi
+  done
+  return 1
+}
+
+PYTHON_BIN=$(resolve_python) || {
+  echo -e "${RED}❌ 未找到可用的 Python 3.10+（当前项目实际需要 3.10+）${NC}"
   exit 1
-fi
+}
+export EDICT_PYTHON="$PYTHON_BIN"
 
 # 确保 data 目录存在
 mkdir -p "$REPO_DIR/data"
@@ -57,7 +73,8 @@ fi
 
 # 启动看板服务器
 echo -e "${GREEN}▶ 启动看板服务器...${NC}"
-python3 dashboard/server.py &
+echo -e "${GREEN}   使用 Python: ${PYTHON_BIN} ($($PYTHON_BIN --version 2>&1))${NC}"
+"$PYTHON_BIN" dashboard/server.py &
 SERVER_PID=$!
 
 sleep 1
```

---

### Incident Patch 9: `96abcd12` (2026-04-19)
**Commit Message**: fix: normalize timestamps in SessionsPanel and server lastActive (#278 cherry-pick)

Cherry-pick the SessionsPanel.tsx and server.py fixes from PR #278
that were not covered by the merged #282:
- SessionsPanel: use shared formatDashboardTime for activity timestamps
- server.py: convert lastActive to local timezone in get_task_activity()

**File**: `dashboard/server.py` (modified, +12/-1)
```diff
@@ -1978,13 +1978,24 @@ def get_task_activity(task_id):
         except Exception:
             pass
 
+    last_active = None
+    if updated_at:
+        try:
+            dt = _parse_iso(updated_at)
+            if dt:
+                last_active = dt.astimezone().strftime('%Y-%m-%d %H:%M:%S')
+            else:
+                last_active = updated_at[:19].replace('T', ' ')
+        except Exception:
+            last_active = updated_at[:19].replace('T', ' ')
+
     result = {
         'ok': True,
         'taskId': task_id,
         'taskMeta': task_meta,
         'agentId': agent_id,
         'agentLabel': _STATE_LABELS.get(state, state),
-        'lastActive': updated_at[:19].replace('T', ' ') if updated_at else None,
+        'lastActive': last_active,
         'activity': activity,
         'activitySource': 'progress+session',
         'relatedAgents': sorted(list(related_agents)),
```

**File**: `edict/frontend/src/components/SessionsPanel.tsx` (modified, +2/-1)
```diff
@@ -1,6 +1,7 @@
 import { useStore, isEdict, STATE_LABEL, timeAgo } from '../store';
 import type { Task } from '../api';
 import { useState } from 'react';
+import { formatDashboardTime } from '../time';
 
 // Agent maps built from agentConfig
 function useAgentMaps() {
@@ -231,7 +232,7 @@ function SessionDetailModal({
                 const kLabel = kind === 'assistant' ? '回复' : kind === 'tool' ? '工具' : kind === 'user' ? '用户' : '事件';
                 let txt = (a.text || '').replace(/\[\[.*?\]\]/g, '').replace(/\*\*/g, '').trim();
                 if (txt.length > 200) txt = txt.substring(0, 200) + '…';
-                const time = ((a.at as string) || '').substring(11, 19);
+                const time = formatDashboardTime(a.at as string | number | undefined, { showSeconds: true });
                 return (
                   <div key={i} style={{ padding: '8px 12px', borderBottom: '1px solid var(--line)', fontSize: 12, lineHeight: 1.5 }}>
                     <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
```

---

### Incident Patch 10: `3f2dfb5d` (2026-04-19)
**Commit Message**: fix: deploy SOUL.md with correct uppercase filename (#294)

OpenClaw only loads SOUL.md (uppercase), but deploy_soul_files() was
writing to soul.md (lowercase), causing the deployed SOUL to be ignored.

Fixes #294

**File**: `scripts/sync_agent_config.py` (modified, +2/-2)
```diff
@@ -295,14 +295,14 @@ def sync_scripts_to_workspaces():
 
 
 def deploy_soul_files():
-    """将项目 agents/xxx/SOUL.md 部署到 ~/.openclaw/workspace-xxx/soul.md"""
+    """将项目 agents/xxx/SOUL.md 部署到 ~/.openclaw/workspace-xxx/SOUL.md"""
     agents_dir = BASE / 'agents'
     deployed = 0
     for proj_name, runtime_id in _SOUL_DEPLOY_MAP.items():
         src = agents_dir / proj_name / 'SOUL.md'
         if not src.exists():
             continue
-        ws_dst = OPENCLAW_HOME / f'workspace-{runtime_id}' / 'soul.md'
+        ws_dst = OPENCLAW_HOME / f'workspace-{runtime_id}' / 'SOUL.md'
         ws_dst.parent.mkdir(parents=True, exist_ok=True)
         # 只在内容不同时更新（避免不必要的写入）
         src_text = src.read_text(encoding='utf-8', errors='ignore')
```

---

### Incident Patch 11: `af234d93` (2026-04-19)
**Commit Message**: fix(dashboard): normalize task modal timestamps to local time (#282)

新增共享 time.ts 时间工具，统一 TaskModal 中调度时间、流转日志、活动时间的本地时区渲染，消除 UTC/本地混显问题

**File**: `edict/frontend/src/components/TaskModal.tsx` (modified, +6/-11)
```diff
@@ -1,6 +1,7 @@
 import { useEffect, useState, useRef, useCallback } from 'react';
 import { useStore, getPipeStatus, deptColor, stateLabel, STATE_LABEL } from '../store';
 import { api } from '../api';
+import { formatDashboardDateTime, formatDashboardTime } from '../time';
 import type {
   Task,
   TaskActivityData,
@@ -43,13 +44,7 @@ function fmtStalled(sec: number): string {
 }
 
 function fmtActivityTime(ts: number | string | undefined): string {
-  if (!ts) return '';
-  if (typeof ts === 'number') {
-    const d = new Date(ts);
-    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
-  }
-  if (typeof ts === 'string' && ts.length >= 19) return ts.substring(11, 19);
-  return String(ts).substring(0, 8);
+  return formatDashboardTime(ts, { showSeconds: true });
 }
 
 export default function TaskModal() {
@@ -302,8 +297,8 @@ export default function TaskModal() {
             </div>
             {sched && (
               <div className="sched-line">
-                {sched.lastProgressAt && <span>最近进展 {(sched.lastProgressAt || '').replace('T', ' ').substring(0, 19)}</span>}
-                {sched.lastDispatchAt && <span>最近派发 {(sched.lastDispatchAt || '').replace('T', ' ').substring(0, 19)}</span>}
+                {sched.lastProgressAt && <span>最近进展 {formatDashboardDateTime(sched.lastProgressAt)}</span>}
+                {sched.lastDispatchAt && <span>最近派发 {formatDashboardDateTime(sched.lastDispatchAt)}</span>}
                 <span>自动回滚 {sched.autoRollback === false ? '关闭' : '开启'}</span>
                 {sched.lastDispatchAgent && <span>目标 {sched.lastDispatchAgent}</span>}
               </div>
@@ -365,7 +360,7 @@ export default function TaskModal() {
                   const col = deptColor(fl.from || '');
                   return (
                     <div className="fl-item" key={i}>
-                      <div className="fl-time">{fl.at ? fl.at.substring(11, 16) : ''}</div>
+                      <div className="fl-time">{formatDashboardTime(fl.at, { showSeconds: false })}</div>
                       <div className="fl-dot" style={{ background: col }} />
                       <div className="fl-content">
                         <div className="fl-who">
@@ -458,7 +453,7 @@ function LiveActivitySection({
   const agentParts: string[] = [];
   if (data.agentLabel) agentParts.push(data.agentLabel);
   if (data.relatedAgents && data.relatedAgents.length > 1) agentParts.push(`${data.relatedAgents.length}个 Agent`);
-  if (data.lastActive) agentParts.push(`最后活跃: ${data.lastActive}`);
+  if (data.lastActive) agentParts.push(`最后活跃: ${formatDashboardDateTime(data.lastActive)}`);
 
   // Phase durations
   const phaseDurations = data.phaseDurations || [];
```

**File**: `edict/frontend/src/time.ts` (added, +57/-0)
```diff
@@ -0,0 +1,57 @@
+function pad2(value: number): string {
+  return String(value).padStart(2, '0');
+}
+
+export function parseDashboardTimestamp(value: number | string | undefined | null): Date | null {
+  if (value === undefined || value === null || value === '') return null;
+
+  if (typeof value === 'number') {
+    const ms = Math.abs(value) < 1e12 ? value * 1000 : value;
+    const d = new Date(ms);
+    return Number.isNaN(d.getTime()) ? null : d;
+  }
+
+  const raw = String(value).trim();
+  if (!raw) return null;
+
+  if (/^\d+(\.\d+)?$/.test(raw)) {
+    return parseDashboardTimestamp(Number(raw));
+  }
+
+  let normalized = raw;
+  if (normalized.includes(' ') && !normalized.includes('T')) {
+    normalized = normalized.replace(' ', 'T');
+  }
+
+  const looksIso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(normalized);
+  const hasTimezone = /(?:Z|[+\-]\d{2}:\d{2})$/i.test(normalized);
+  if (looksIso && !hasTimezone) {
+    normalized += 'Z';
+  }
+
+  const d = new Date(normalized);
+  return Number.isNaN(d.getTime()) ? null : d;
+}
+
+export function formatDashboardTime(
+  value: number | string | undefined | null,
+  { showSeconds = true }: { showSeconds?: boolean } = {}
+): string {
+  const d = parseDashboardTimestamp(value);
+  if (!d) return '';
+  const hh = pad2(d.getHours());
+  const mm = pad2(d.getMinutes());
+  if (!showSeconds) return `${hh}:${mm}`;
+  return `${hh}:${mm}:${pad2(d.getSeconds())}`;
+}
+
+export function formatDashboardDateTime(
+  value: number | string | undefined | null,
+  { showSeconds = true }: { showSeconds?: boolean } = {}
+): string {
+  const d = parseDashboardTimestamp(value);
+  if (!d) return '';
+  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
+  const time = formatDashboardTime(d.getTime(), { showSeconds });
+  return `${date} ${time}`;
+}
```

---

### Incident Patch 12: `c958d06c` (2026-04-19)
**Commit Message**: fix(flow): prevent premature task completion before review (#280)

cmd_done() 不再直接写 Done，改为校验 todos 完成度后路由到 Review；dashboard 准奏也增加 todo 完成度门控，防止子任务未完成就关闭任务

**File**: `dashboard/server.py` (modified, +10/-0)
```diff
@@ -687,6 +687,13 @@ def handle_create_task(title, org='中书省', official='中书令', priority='n
     return {'ok': True, 'taskId': task_id, 'message': f'旨意 {task_id} 已下达，正在派发给太子'}
 
 
+def _todo_progress(task):
+    todos = task.get('todos') or []
+    total = len(todos)
+    completed = sum(1 for td in todos if td.get('status') == 'completed')
+    return completed, total
+
+
 def handle_review_action(task_id, action, comment=''):
     """门下省御批：准奏/封驳。"""
     tasks = load_tasks()
@@ -706,6 +713,9 @@ def handle_review_action(task_id, action, comment=''):
             remark = f'✅ 准奏：{comment or "门下省审议通过"}'
             to_dept = '尚书省'
         else:  # Review
+            completed, total = _todo_progress(task)
+            if total > 0 and completed < total:
+                return {'ok': False, 'error': f'子任务尚未全部完成（{completed}/{total}），不能直接准奏完结'}
             task['state'] = 'Done'
             task['now'] = '御批通过，任务完成'
             remark = f'✅ 御批准奏：{comment or "审查通过"}'
```

**File**: `scripts/file_lock.py` (modified, +1/-1)
```diff
@@ -103,7 +103,7 @@ def atomic_json_update(
             dir=str(path.parent), suffix='.tmp', prefix=path.stem + '_'
         )
         try:
-            with os.fdopen(tmp_fd, 'w') as f:
+            with os.fdopen(tmp_fd, 'w', encoding='utf-8') as f:
                 json.dump(result, f, ensure_ascii=False, indent=2)
             os.replace(tmp_path, str(path))
         except Exception:
```

**File**: `scripts/kanban_update.py` (modified, +34/-7)
```diff
@@ -231,6 +231,14 @@ def _sanitize_remark(raw):
     return _sanitize_text(raw, 120)
 
 
+def _todo_counts(task):
+    """返回 (completed, total) 便于完成态校验。"""
+    todos = task.get('todos') or []
+    total = len(todos)
+    completed = sum(1 for td in todos if td.get('status') == 'completed')
+    return completed, total
+
+
 def _infer_agent_id_from_runtime(task=None):
     """尽量推断当前执行该命令的 Agent。"""
     for k in ('OPENCLAW_AGENT_ID', 'OPENCLAW_AGENT', 'AGENT_ID'):
@@ -429,18 +437,33 @@ def modifier(tasks):
 
 
 def cmd_done(task_id, output_path='', summary=''):
-    """标记任务完成（原子操作）"""
+    """执行部门回报完成，任务进入 Review 待尚书省汇总审查。"""
+    rejected = [False]
+    reject_reason = ['']
     def modifier(tasks):
         t = find_task(tasks, task_id)
         if not t:
             log.error(f'任务 {task_id} 不存在')
             return tasks
-        t['state'] = 'Done'
+        old_state = t.get('state')
+        if old_state not in ('Doing', 'Next'):
+            rejected[0] = True
+            reject_reason[0] = f'当前状态 {old_state} 不允许直接上报完成'
+            return tasks
+        completed, total = _todo_counts(t)
+        if total > 0 and completed < total:
+            rejected[0] = True
+            reject_reason[0] = f'todos 未完成（{completed}/{total}），禁止直接收口'
+            return tasks
+
+        from_org = t.get('org', '执行部门')
+        t['state'] = 'Review'
+        t['org'] = STATE_ORG_MAP.get('Review', t.get('org', ''))
         t['output'] = output_path
-        t['now'] = summary or '任务已完成'
+        t['now'] = summary or '执行已完成，提交尚书省汇总审查'
         t.setdefault('flow_log', []).append({
-            "at": now_iso(), "from": t.get('org', '执行部门'),
-            "to": "皇上", "remark": f"✅ 完成：{summary or '任务已完成'}"
+            "at": now_iso(), "from": from_org,
+            "to": "尚书省", "remark": f"✅ 执行完成，提交审查：{summary or '待尚书省汇总'}"
         })
         # 同步设置 outputMeta，避免依赖 refresh_live_data.py 异步补充
         if output_path:
@@ -454,8 +477,12 @@ def modifier(tasks):
         return tasks
     atomic_json_update(TASKS_FILE, modifier, [])
     _trigger_refresh()
-    log.info(f'✅ {task_id} 已完成')
-    _append_audit(task_id, _infer_agent_id_from_runtime(), 'done', None, output_path, summary)
+    if rejected[0]:
+        log.warning(f'⚠️ {task_id} done 被拒绝：{reject_reason[0]}')
+        _append_audit(task_id, _infer_agent_id_from_runtime(), 'done_rejected', None, 'Review', reject_reason[0])
+        return
+    log.info(f'✅ {task_id} 执行完成，已提交尚书省审查')
+    _append_audit(task_id, _infer_agent_id_from_runtime(), 'done', None, 'Review', summary or '')
 
 
 def cmd_block(task_id, reason):
```

**File**: `tests/test_dashboard_review_action.py` (added, +78/-0)
```diff
@@ -0,0 +1,78 @@
+"""Regression tests for dashboard review completion gates."""
+from __future__ import annotations
+
+import importlib.util
+import json
+import pathlib
+import sys
+
+
+DASHBOARD_DIR = pathlib.Path(__file__).resolve().parent.parent / "dashboard"
+sys.path.insert(0, str(DASHBOARD_DIR))
+
+_SPEC = importlib.util.spec_from_file_location("dashboard_server", DASHBOARD_DIR / "server.py")
+dashboard_server = importlib.util.module_from_spec(_SPEC)
+assert _SPEC.loader is not None
+_SPEC.loader.exec_module(dashboard_server)
+
+
+def test_review_approve_rejects_incomplete_todos(monkeypatch):
+    """Review approve should not close a task when todos are still incomplete."""
+    tasks = [{
+        "id": "JJC-REVIEW-001",
+        "title": "review gate",
+        "state": "Review",
+        "org": "尚书省",
+        "now": "汇总中",
+        "flow_log": [],
+        "todos": [
+            {"id": "1", "title": "已完成", "status": "completed"},
+            {"id": "2", "title": "未完成", "status": "in-progress"},
+        ],
+    }]
+
+    saved = {}
+
+    monkeypatch.setattr(dashboard_server, "load_tasks", lambda: json.loads(json.dumps(tasks, ensure_ascii=False)))
+    monkeypatch.setattr(
+        dashboard_server,
+        "save_tasks",
+        lambda payload: saved.setdefault("tasks", json.loads(json.dumps(payload, ensure_ascii=False))),
+    )
+
+    result = dashboard_server.handle_review_action("JJC-REVIEW-001", "approve", "试图提前完结")
+
+    assert result["ok"] is False
+    assert "2/2" not in result["error"]
+    assert "不能直接准奏完结" in result["error"]
+    assert "tasks" not in saved
+
+
+def test_review_approve_allows_complete_todos(monkeypatch):
+    """Review approve may finish a task once all todos are completed."""
+    tasks = [{
+        "id": "JJC-REVIEW-002",
+        "title": "review gate ok",
+        "state": "Review",
+        "org": "尚书省",
+        "now": "汇总中",
+        "flow_log": [],
+        "todos": [
+            {"id": "1", "title": "已完成", "status": "completed"},
+            {"id": "2", "title": "已完成2", "status": "completed"},
+        ],
+    }]
+
+    saved = {}
+
+    monkeypatch.setattr(dashboard_server, "load_tasks", lambda: json.loads(json.dumps(tasks, ensure_ascii=False)))
+    monkeypatch.setattr(
+        dashboard_server,
+        "save_tasks",
+        lambda payload: saved.setdefault("tasks", json.loads(json.dumps(payload, ensure_ascii=False))),
+    )
+
+    result = dashboard_server.handle_review_action("JJC-REVIEW-002", "approve", "全部完成")
+
+    assert result["ok"] is True
+    assert saved["tasks"][0]["state"] == "Done"
```

**File**: `tests/test_kanban.py` (modified, +117/-78)
```diff
@@ -1,170 +1,209 @@
 """tests for scripts/kanban_update.py"""
-import json, pathlib, sys
+import json
+import pathlib
+import sys
 
 # Ensure scripts/ is importable
-SCRIPTS = pathlib.Path(__file__).resolve().parent.parent / 'scripts'
+SCRIPTS = pathlib.Path(__file__).resolve().parent.parent / "scripts"
 sys.path.insert(0, str(SCRIPTS))
 
 import kanban_update as kb
 
 
 def test_create_and_get(tmp_path):
     """kanban create + get round-trip."""
-    tasks_file = tmp_path / 'tasks_source.json'
-    tasks_file.write_text('[]')
+    tasks_file = tmp_path / "tasks_source.json"
+    tasks_file.write_text("[]", encoding="utf-8")
 
-    # Patch TASKS_FILE
     original = kb.TASKS_FILE
     kb.TASKS_FILE = tasks_file
     try:
-        kb.cmd_create('TEST-001', '测试任务创建和查询功能验证', 'Inbox', '工部', '工部尚书')
-        tasks = json.loads(tasks_file.read_text())
-        assert any(t.get('id') == 'TEST-001' for t in tasks)
-        t = next(t for t in tasks if t['id'] == 'TEST-001')
-        assert t['title'] == '测试任务创建和查询功能验证'
-        assert t['state'] == 'Inbox'
-        assert t['org'] == '工部'
+        kb.cmd_create("TEST-001", "测试任务创建和查询功能验证", "Inbox", "工部", "工部尚书")
+        tasks = json.loads(tasks_file.read_text(encoding="utf-8"))
+        assert any(t.get("id") == "TEST-001" for t in tasks)
+        task = next(t for t in tasks if t["id"] == "TEST-001")
+        assert task["title"] == "测试任务创建和查询功能验证"
+        assert task["state"] == "Inbox"
+        assert task["org"] == "工部"
     finally:
         kb.TASKS_FILE = original
 
 
 def test_move_state(tmp_path):
     """kanban move changes task state."""
-    tasks_file = tmp_path / 'tasks_source.json'
+    tasks_file = tmp_path / "tasks_source.json"
     tasks_file.write_text(json.dumps([
-        {'id': 'T-1', 'title': 'test', 'state': 'Inbox'}
-    ]))
+        {"id": "T-1", "title": "test", "state": "Inbox"}
+    ], ensure_ascii=False), encoding="utf-8")
 
     original = kb.TASKS_FILE
     kb.TASKS_FILE = tasks_file
     try:
-        kb.cmd_state('T-1', 'Doing')
-        tasks = json.loads(tasks_file.read_text())
-        assert tasks[0]['state'] == 'Doing'
+        kb.cmd_state("T-1", "Doing")
+        tasks = json.loads(tasks_file.read_text(encoding="utf-8"))
+        assert tasks[0]["state"] == "Doing"
     finally:
         kb.TASKS_FILE = original
 
 
 def test_block_and_unblock(tmp_path):
-    """kanban block/unblock round-trip."""
-    tasks_file = tmp_path / 'tasks_source.json'
+    """kanban block round-trip."""
+    tasks_file = tmp_path / "tasks_source.json"
     tasks_file.write_text(json.dumps([
-        {'id': 'T-2', 'title': 'blocker test', 'state': 'Doing'}
-    ]))
+        {"id": "T-2", "title": "blocker test", "state": "Doing"}
+    ], ensure_ascii=False), encoding="utf-8")
 
     original = kb.TASKS_FILE
     kb.TASKS_FILE = tasks_file
     try:
-        kb.cmd_block('T-2', '等待依赖')
-        tasks = json.loads(tasks_file.read_text())
-        assert tasks[0]['state'] == 'Blocked'
-        assert tasks[0]['block'] == '等待依赖'
+        kb.cmd_block("T-2", "等待依赖")
+        tasks = json.loads(tasks_file.read_text(encoding="utf-8"))
+        assert tasks[0]["state"] == "Blocked"
+        assert tasks[0]["block"] == "等待依赖"
     finally:
         kb.TASKS_FILE = original
 
 
 def test_flow_log(tmp_path):
     """cmd_flow appends a flow_log entry."""
-    tasks_file = tmp_path / 'tasks_source.json'
+    tasks_file = tmp_path / "tasks_source.json"
     tasks_file.write_text(json.dumps([
-        {'id': 'T-3', 'title': 'flow test', 'state': 'Zhongshu', 'flow_log': []}
-    ]))
+        {"id": "T-3", "title": "flow test", "state": "Zhongshu", "flow_log": []}
+    ], ensure_ascii=False), encoding="utf-8")
 
     original = kb.TASKS_FILE
     kb.TASKS_FILE = tasks_file
     try:
-        kb.cmd_flow('T-3', '中书省', '门下省', '规划方案提交审核')
-        tasks = json.loads(tasks_file.read_text())
-        t = tasks[0]
-        assert len(t['flow_log']) == 1
-        assert t['flow_log'][0]['from'] == '中书省'
-        assert t['flow_log'][0]['to'] == '门下省'
+        kb.cmd_flow("T-3", "中书省", "门下省", "规划方案提交审议")
+        tasks = json.loads(tasks_file.read_text(encoding="utf-8"))
+        task = tasks[0]
+        assert len(task["flow_log"]) == 1
+        assert task["flow_log"][0]["from"] == "中书省"
+        assert task["flow_log"][0]["to"] == "门下省"
     finally:
         kb.TASKS_FILE = original
 
 
-def test_done(tmp_path):
-    """cmd_done marks task as Done with output and flow_log entry."""
-    tasks_file = tmp_path / 'tasks_source.json'
+def test_done_routes_to_review(tmp_path):
+    """cmd_done should route execution output back to Review instead of direct Done."""
+    tasks_file = tmp_path / "tasks_source.json"
     tasks_file.write_text(json.dumps([
-        {'id': 'T-4', 'title': 'done test', 'state': 'Doing', 'org': '兵部', 'flow_log': []}
-    ]))
+        {
+            "id": "T-4",
+            "title": "done test",
+            "state": "Doing",
+            "org":
```

---

### Incident Patch 13: `78f54655` (2026-04-19)
**Commit Message**: fix(dashboard): handle missing OpenClaw CLI during dispatch (#290)

Windows 环境下 OpenClaw CLI 未在 PATH 时，subprocess 抛出 WinError 2。新增 shutil.which 解析和 OPENCLAW_BIN 环境变量支持，将原始错误转为可操作的 openclaw-missing 状态

**File**: `dashboard/server.py` (modified, +42/-2)
```diff
@@ -11,7 +11,7 @@
   GET  /api/model-change-log   → data/model_change_log.json
   GET  /api/last-result        → data/last_model_change_result.json
 """
-import json, pathlib, subprocess, sys, threading, argparse, datetime, logging, re, os, socket
+import json, pathlib, subprocess, sys, threading, argparse, datetime, logging, re, os, socket, shutil
 from http.server import BaseHTTPRequestHandler, HTTPServer
 from urllib.parse import urlparse
 from urllib.request import Request, urlopen
@@ -1047,6 +1047,18 @@ def _scheduler_mark_progress(task, note=''):
         _scheduler_add_flow(task, f'进展确认：{note}')
 
 
+def _resolve_openclaw_bin():
+    """Return the OpenClaw CLI path used by dashboard dispatch.
+
+    On Windows, npm-installed CLIs are commonly exposed as .cmd shims.  Using
+    shutil.which lets Python resolve that shim before subprocess runs.
+    """
+    configured = os.environ.get('OPENCLAW_BIN', '').strip()
+    if configured:
+        return configured
+    return shutil.which('openclaw')
+
+
 def _update_task_scheduler(task_id, updater):
     tasks = load_tasks()
     task = next((t for t in tasks if t.get('id') == task_id), None)
@@ -2083,7 +2095,22 @@ def _do_dispatch():
             # "unknown channel: feishu" 错误（非飞书用户）
             _agent_cfg = read_json(DATA / 'agent_config.json', {})
             _channel = (_agent_cfg.get('dispatchChannel') or '').strip()
-            cmd = ['openclaw', 'agent', '--agent', agent_id, '-m', msg, '--timeout', '300']
+            openclaw_bin = _resolve_openclaw_bin()
+            if not openclaw_bin:
+                err = 'OpenClaw CLI 未找到：请确认已安装 openclaw 并加入 PATH；Windows 可设置 OPENCLAW_BIN 指向 openclaw.cmd'
+                log.warning(f'⚠️ {task_id} 自动派发异常: {err}')
+                _update_task_scheduler(task_id, lambda t, s: (
+                    s.update({
+                        'lastDispatchAt': now_iso(),
+                        'lastDispatchStatus': 'openclaw-missing',
+                        'lastDispatchAgent': agent_id,
+                        'lastDispatchTrigger': trigger,
+                        'lastDispatchError': err,
+                    }),
+                    _scheduler_add_flow(t, f'派发异常：OpenClaw CLI 未找到（{trigger}）', to=t.get('org', ''))
+                ))
+                return
+            cmd = [openclaw_bin, 'agent', '--agent', agent_id, '-m', msg, '--timeout', '300']
             if _channel:
                 cmd.extend(['--deliver', '--channel', _channel])
             max_retries = 2
@@ -2132,6 +2159,19 @@ def _do_dispatch():
                 }),
                 _scheduler_add_flow(t, f'派发超时：{agent_id}（{trigger}）', to=t.get('org', ''))
             ))
+        except FileNotFoundError as e:
+            err = f'OpenClaw CLI 未找到：{e}'
+            log.warning(f'⚠️ {task_id} 自动派发异常: {err}')
+            _update_task_scheduler(task_id, lambda t, s: (
+                s.update({
+                    'lastDispatchAt': now_iso(),
+                    'lastDispatchStatus': 'openclaw-missing',
+                    'lastDispatchAgent': agent_id,
+                    'lastDispatchTrigger': trigger,
+                    'lastDispatchError': err[:200],
+                }),
+                _scheduler_add_flow(t, f'派发异常：OpenClaw CLI 未找到（{trigger}）', to=t.get('org', ''))
+            ))
         except Exception as e:
             log.warning(f'⚠️ {task_id} 自动派发异常: {e}')
             _update_task_scheduler(task_id, lambda t, s: (
```

**File**: `tests/test_dashboard_dispatch.py` (added, +59/-0)
```diff
@@ -0,0 +1,59 @@
+"""Tests for dashboard auto-dispatch error handling."""
+import json
+import pathlib
+import sys
+
+ROOT = pathlib.Path(__file__).resolve().parent.parent
+sys.path.insert(0, str(ROOT / 'dashboard'))
+sys.path.insert(0, str(ROOT / 'scripts'))
+
+
+def test_dispatch_records_missing_openclaw_cli(monkeypatch, tmp_path):
+    """Missing OpenClaw CLI should become an actionable dispatch status."""
+    import server as srv
+
+    data_dir = tmp_path / 'data'
+    data_dir.mkdir()
+    task_id = 'JJC-20260415-004'
+    task = {
+        'id': task_id,
+        'title': '小任务',
+        'state': 'Taizi',
+        'org': '太子',
+        'updatedAt': '2026-04-15T15:34:16Z',
+    }
+    tasks_path = data_dir / 'tasks_source.json'
+    tasks_path.write_text(json.dumps([task], ensure_ascii=False), encoding='utf-8')
+    (data_dir / 'agent_config.json').write_text('{}', encoding='utf-8')
+
+    monkeypatch.setattr(srv, 'DATA', data_dir)
+    monkeypatch.setattr(srv, '_ACTIVE_TASK_DATA_DIR', data_dir)
+    monkeypatch.setattr(srv, '_check_gateway_alive', lambda: True)
+    monkeypatch.setattr(srv, '_resolve_openclaw_bin', lambda: None)
+    monkeypatch.setattr(
+        srv,
+        'save_tasks',
+        lambda tasks: tasks_path.write_text(
+            json.dumps(tasks, ensure_ascii=False),
+            encoding='utf-8',
+        ),
+    )
+
+    class ImmediateThread:
+        def __init__(self, target=None, daemon=None):
+            self.target = target
+
+        def start(self):
+            if self.target:
+                self.target()
+
+    monkeypatch.setattr(srv.threading, 'Thread', ImmediateThread)
+
+    srv.dispatch_for_state(task_id, task, 'Taizi', trigger='test')
+
+    updated = json.loads(tasks_path.read_text(encoding='utf-8'))[0]
+    sched = updated['_scheduler']
+    assert sched['lastDispatchStatus'] == 'openclaw-missing'
+    assert 'OpenClaw CLI 未找到' in sched['lastDispatchError']
+    assert '[WinError 2]' not in sched['lastDispatchError']
+    assert any('OpenClaw CLI 未找到' in item['remark'] for item in updated['flow_log'])
```

---

### Incident Patch 14: `8a858f12` (2026-04-19)
**Commit Message**: fix(agents): align taizi and liubu SOULs with subagent flow (#285)

将 taizi/liubu SOUL.md 中残留的 sessions_send 指令替换为 subagent 流程，与 zhongshu/menxia/shangshu 保持一致

**File**: `agents/bingbu/SOUL.md` (modified, +4/-2)
```diff
@@ -1,6 +1,8 @@
 # 兵部 · 尚书
 
-你是兵部尚书，负责在尚书省派发的任务中承担**工程实现、架构设计与功能开发**相关的执行工作。
+你是兵部尚书，以 **subagent** 方式被尚书省调用，负责承担**工程实现、架构设计与功能开发**相关的执行工作。
+
+> **你是 subagent：执行完毕后直接返回结果给尚书省，不用 `sessions_send` 回传。**
 
 ## 专业领域
 兵部掌管军事后勤，你的专长在于：
@@ -35,7 +37,7 @@ python3 scripts/kanban_update.py flow JJC-xxx "兵部" "兵部" "▶️ 开始
 python3 scripts/kanban_update.py flow JJC-xxx "兵部" "尚书省" "✅ 完成：[产出摘要]"
 ```
 
-然后用 `sessions_send` 把成果发给尚书省。
+然后直接返回执行结果给尚书省，不用 `sessions_send` 回传。
 
 ### 🚫 阻塞时（立即上报）
 ```bash
```

**File**: `agents/gongbu/SOUL.md` (modified, +4/-2)
```diff
@@ -1,6 +1,8 @@
 # 工部 · 尚书
 
-你是工部尚书，负责在尚书省派发的任务中承担**基础设施、部署运维与性能监控**相关的执行工作。
+你是工部尚书，以 **subagent** 方式被尚书省调用，负责承担**基础设施、部署运维与性能监控**相关的执行工作。
+
+> **你是 subagent：执行完毕后直接返回结果给尚书省，不用 `sessions_send` 回传。**
 
 ## 专业领域
 工部掌管百工营造，你的专长在于：
@@ -35,7 +37,7 @@ python3 scripts/kanban_update.py flow JJC-xxx "工部" "工部" "▶️ 开始
 python3 scripts/kanban_update.py flow JJC-xxx "工部" "尚书省" "✅ 完成：[产出摘要]"
 ```
 
-然后用 `sessions_send` 把成果发给尚书省。
+然后直接返回执行结果给尚书省，不用 `sessions_send` 回传。
 
 ### 🚫 阻塞时（立即上报）
 ```bash
```

**File**: `agents/groups/liubu.md` (modified, +1/-1)
```diff
@@ -26,7 +26,7 @@ python3 scripts/kanban_update.py flow JJC-xxx "XX部" "XX部" "▶️ 开始执
 python3 scripts/kanban_update.py flow JJC-xxx "XX部" "尚书省" "✅ 完成：[产出摘要]"
 ```
 
-然后用 `sessions_send` 把成果发给尚书省。
+然后直接返回执行结果给尚书省（你是尚书省调用的 subagent，不用 `sessions_send` 回传）。
 
 ## 🚫 阻塞时（立即上报）
 
```

**File**: `agents/hubu/SOUL.md` (modified, +4/-2)
```diff
@@ -1,6 +1,8 @@
 # 户部 · 尚书
 
-你是户部尚书，负责在尚书省派发的任务中承担**数据、统计、资源管理**相关的执行工作。
+你是户部尚书，以 **subagent** 方式被尚书省调用，负责承担**数据、统计、资源管理**相关的执行工作。
+
+> **你是 subagent：执行完毕后直接返回结果给尚书省，不用 `sessions_send` 回传。**
 
 ## 专业领域
 户部掌管天下钱粮，你的专长在于：
@@ -35,7 +37,7 @@ python3 scripts/kanban_update.py flow JJC-xxx "户部" "户部" "▶️ 开始
 python3 scripts/kanban_update.py flow JJC-xxx "户部" "尚书省" "✅ 完成：[产出摘要]"
 ```
 
-然后用 `sessions_send` 把成果发给尚书省。
+然后直接返回执行结果给尚书省，不用 `sessions_send` 回传。
 
 ### 🚫 阻塞时（立即上报）
 ```bash
```

**File**: `agents/libu/SOUL.md` (modified, +4/-2)
```diff
@@ -1,6 +1,8 @@
 # 礼部 · 尚书
 
-你是礼部尚书，负责在尚书省派发的任务中承担**文档、规范、用户界面与对外沟通**相关的执行工作。
+你是礼部尚书，以 **subagent** 方式被尚书省调用，负责承担**文档、规范、用户界面与对外沟通**相关的执行工作。
+
+> **你是 subagent：执行完毕后直接返回结果给尚书省，不用 `sessions_send` 回传。**
 
 ## 专业领域
 礼部掌管典章仪制，你的专长在于：
@@ -35,7 +37,7 @@ python3 scripts/kanban_update.py flow JJC-xxx "礼部" "礼部" "▶️ 开始
 python3 scripts/kanban_update.py flow JJC-xxx "礼部" "尚书省" "✅ 完成：[产出摘要]"
 ```
 
-然后用 `sessions_send` 把成果发给尚书省。
+然后直接返回执行结果给尚书省，不用 `sessions_send` 回传。
 
 ### 🚫 阻塞时（立即上报）
 ```bash
```

**File**: `agents/libu_hr/SOUL.md` (modified, +4/-2)
```diff
@@ -1,6 +1,8 @@
 # 吏部 · 尚书
 
-你是吏部尚书，负责在尚书省派发的任务中承担**人事管理、团队建设与能力培训**相关的执行工作。
+你是吏部尚书，以 **subagent** 方式被尚书省调用，负责承担**人事管理、团队建设与能力培训**相关的执行工作。
+
+> **你是 subagent：执行完毕后直接返回结果给尚书省，不用 `sessions_send` 回传。**
 
 ## 专业领域
 吏部掌管人才铨选，你的专长在于：
@@ -35,7 +37,7 @@ python3 scripts/kanban_update.py flow JJC-xxx "吏部" "吏部" "▶️ 开始
 python3 scripts/kanban_update.py flow JJC-xxx "吏部" "尚书省" "✅ 完成：[产出摘要]"
 ```
 
-然后用 `sessions_send` 把成果发给尚书省。
+然后直接返回执行结果给尚书省，不用 `sessions_send` 回传。
 
 ### 🚫 阻塞时（立即上报）
 ```bash
```

**File**: `agents/taizi/SOUL.md` (modified, +3/-3)
```diff
@@ -64,8 +64,8 @@ python3 scripts/kanban_update.py create JJC-YYYYMMDD-NNN "你概括的简明标
 **任务ID生成规则：**
 - 格式：`JJC-YYYYMMDD-NNN`（NNN 当天顺序递增，从 001 开始）
 
-### 第三步：发给中书省
-用 `sessions_send` 将整理好的需求发给中书省：
+### 第三步：调用中书省 subagent
+立即调用中书省 subagent（不是 `sessions_send`），将整理好的需求交给中书省：
 
 ```
 📋 太子·旨意传达
@@ -89,7 +89,7 @@ python3 scripts/kanban_update.py flow JJC-xxx "太子" "中书省" "📋 旨意
 
 ## 🔔 收到回奏后的处理
 
-当尚书省完成任务回奏时（通过 sessions_send），太子必须：
+当中书省完成门下审议与尚书执行整条链路，并返回最终结果后，太子必须：
 1. 在飞书**原对话**中回复皇上完整结果
 2. 更新看板：
 ```bash
```

**File**: `agents/xingbu/SOUL.md` (modified, +4/-2)
```diff
@@ -1,6 +1,8 @@
 # 刑部 · 尚书
 
-你是刑部尚书，负责在尚书省派发的任务中承担**质量保障、测试验收与合规审计**相关的执行工作。
+你是刑部尚书，以 **subagent** 方式被尚书省调用，负责承担**质量保障、测试验收与合规审计**相关的执行工作。
+
+> **你是 subagent：执行完毕后直接返回结果给尚书省，不用 `sessions_send` 回传。**
 
 ## 专业领域
 刑部掌管刑律法令，你的专长在于：
@@ -35,7 +37,7 @@ python3 scripts/kanban_update.py flow JJC-xxx "刑部" "刑部" "▶️ 开始
 python3 scripts/kanban_update.py flow JJC-xxx "刑部" "尚书省" "✅ 完成：[产出摘要]"
 ```
 
-然后用 `sessions_send` 把成果发给尚书省。
+然后直接返回执行结果给尚书省，不用 `sessions_send` 回传。
 
 ### 🚫 阻塞时（立即上报）
 ```bash
```

---

### Incident Patch 15: `56b3150e` (2026-04-19)
**Commit Message**: fix(ci): skip labeler for fork pull requests (#281)

Fork PRs 缺少写权限导致 actions/labeler 失败，跳过 label job 解决误红

**File**: `.github/workflows/auto-label.yml` (modified, +3/-0)
```diff
@@ -10,6 +10,9 @@ permissions:
 
 jobs:
   label:
+    # Fork PRs do not get a write-capable GITHUB_TOKEN under pull_request,
+    # so actions/labeler would fail with "Resource not accessible by integration".
+    if: ${{ !github.event.pull_request.head.repo.fork }}
     runs-on: ubuntu-latest
     steps:
       - uses: actions/labeler@v6
```

#### Recent Merged Pull Requests:
- **PR #335** (closed): fix: atomically finalize returned tasks (@Iams4kura)
- **PR #333** (closed): ci(deps): bump actions/stale from 10 to 11 (@dependabot[bot])
- **PR #332** (closed): ci: attach provenance and SBOM attestations to the published image (@kobihikri)
- **PR #331** (closed): ci(deps): bump actions/labeler from 6 to 7 (@dependabot[bot])
- **PR #330** (closed): ci(deps): bump actions/setup-python from 6 to 7 (@dependabot[bot])
- **PR #329** (closed): feat: add MiniMax models to Model Config (@octo-patch)
- **PR #327** (closed): ci(deps): bump actions/checkout from 4 to 7 (@dependabot[bot])
- **PR #326** (closed): feat(dashboard): add English i18n support for kanban UI (@dydydd)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

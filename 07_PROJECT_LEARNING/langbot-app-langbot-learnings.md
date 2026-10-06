# Forensic Learning Record (Deep Inspection): langbot-app/LangBot

> **Canonical Artifact**: `07_PROJECT_LEARNING/langbot-app-langbot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/langbot-app/LangBot](https://github.com/langbot-app/LangBot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:31:37.820Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `langbot-app/LangBot`
- **Description**: Production-grade platform for building agentic IM bots - 生产级多平台智能机器人开发平台/ Agent、知识库编排、插件系统 / Bots for Discord / Slack / LINE / Telegram / WeChat(企业微信, 企微智能机器人, 公众号) / 飞书 / 钉钉 / QQ / Matrix e.g. Integrated with ChatGPT(GPT), DeepSeek, Dify, n8n, Langflow, Coze, Claude, Gemini, GLM, Ollama, SiliconFlow, Moonshot, openclaw / hermes agent, deerflow
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md, Dockerfile
- **Stars / Engagement**: 18019 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md, Dockerfile.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `skills/scripts/e2e/webui-login-state.mjs`
```
#!/usr/bin/env node

import {
  bodyText,
  createBrowser,
  ensureEvidence,
  evidencePaths,
  exitCode,
  gotoFrontend,
  isLoginUrl,
  loadEnvFiles,
  localIsoWithOffset,
  safeScreenshot,
  verifyBrowserToken,
  writeResult,
} from "./lib/langbot-e2e.mjs";

const caseId = "webui-login-state";
await loadEnvFiles();
const paths = evidencePaths(caseId);
await ensureEvidence(paths);

const startedAt = new Date();
let browser;
let result = {
  source: "automation",
  case_id: caseId,
  run_id: paths.runId,
  started_at: startedAt.toISOString(),
  started_at_local: localIsoWithOffset(startedAt),
  finished_at: "",
  finished_at_local: "",
  status: "fail",
  reason: "",
  url: "",
  auth: null,
  evidence: {
    console_log: paths.consoleLog,
    network_log: paths.networkLog,
    screenshot: paths.screenshot,
    automation_result_json: paths.automationResultJson,
    result_json: paths.resultJson,
  },
  evidence_collected: ["ui", "screenshot", "console"],
};

try {
  browser = await createBrowser(paths);
  const { page } = browser;
  await gotoFrontend(page);
  result.url = page.url();

  const backendUrl = process.env.LANGBOT_BACKEND_URL || "";
  if (!backendUrl) {
    result.status = "env_issue";
    result.reason = "LANGBOT_BACKEND_URL is not configured.";
    await safeScreenshot(page, paths.screenshot);
    throw new Error(result.reason);
  }

  const auth = await verifyBrowserToken(page, backendUrl);
  result.auth = auth;
  const text = await bodyText(page);
  const navigationSignals = [
    "Dashboard",
    "Bots",
    "Pipelines",
    "Knowledge",
    "Plugins",
    "首页",
    "机器人",
    "流水线",
    "知识库",
    "插件",
  ];
  const matchedSignal = navigationSignals.find((signal) => text.includes(signal));

  if (!auth.authenticated) {
    result.status = "blocked";
    result.reason = auth.reason || "Browser profile token was not accepted by backend.";
  } else if (isLoginUrl(page.url()) || /登录|Login|Sign in/i.test(text)) {
    result.status = "fail";
    result.reason = "Backend accepted the token, but the WebUI still showed the login page.";
  } else if (!matchedSignal) {
    result.status = "fail";
    result.reason = "Opened WebUI, but no known LangBot navigation signal was visible.";
  } else {
    result.status = "pass";
    result.reason = `Authenticated navigation signal visible: ${matchedSignal}`;
  }

  await safeScreenshot(page, paths.screenshot);
} catch (error) {
  if (!["env_issue", "blocked", "fail", "pass"].includes(result.status) || !result.reason) {
    result.status = /Playwright is not installed|LANGBOT_FRONTEND_URL/.test(error.message) ? "env_issue" : "fail";
    result.reason = error.message;
  }
} finally {
  if (browser) await browser.close().catch(() => {});
  const finishedAt = new Date();
  result.finished_at = finishedAt.toISOString();
  result.finished_at_local = localIsoWithOffset(finishedAt);
  await writeResult(paths, result);
  console.log(JSON.stringify(result, null, 2));
}

process.exit(exitCode(result.status));

```

### Core Architecture Module: `src/langbot/libs/deerflow_api/stream_utils.py`
```
"""DeerFlow LangGraph 流式响应解析工具

参考 astrbot 实现的 deerflow_stream_utils。
"""

from __future__ import annotations

import typing
from collections.abc import Iterable


def extract_text(content: typing.Any) -> str:
    """从消息 content 中提取纯文本"""
    if isinstance(content, str):
        return content
    if isinstance(content, dict):
        if isinstance(content.get('text'), str):
            return content['text']
        if 'content' in content:
            return extract_text(content.get('content'))
        if 'kwargs' in content and isinstance(content['kwargs'], dict):
            return extract_text(content['kwargs'].get('content'))
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                item_type = item.get('type')
                if item_type == 'text' and isinstance(item.get('text'), str):
                    parts.append(item['text'])
                elif 'content' in item:
                    parts.append(extract_text(item['content']))
        return '\n'.join([p for p in parts if p]).strip()
    return str(content) if content is not None else ''


def extract_messages_from_values_data(data: typing.Any) -> list[typing.Any]:
    """从 values 事件中提取 messages 列表"""
    candidates: list[typing.Any] = []
    if isinstance(data, dict):
        candidates.append(data)
        if isinstance(data.get('values'), dict):
            candidates.append(data['values'])
    elif isinstance(data, list):
        candidates.extend([x for x in data if isinstance(x, dict)])

    for item in candidates:
        messages = item.get('messages')
        if isinstance(messages, list):
            return messages
    return []


def is_ai_message(message: dict[str, typing.Any]) -> bool:
    """判断是否为 AI/assistant 消息"""
    role = str(message.get('role', '')).lower()
    if role in {'assistant', 'ai'}:
        return True

    msg_type = str(message.get('type', '')).lower()
    if msg_type in {'ai', 'assistant', 'aimessage', 'aimessagechunk'}:
        return True
    if 'ai' in msg_type and all(token not in msg_type for token in ('human', 'tool', 'system')):
        return True
    return False


def extract_latest_ai_text(messages: Iterable[typing.Any]) -> str:
    """获取最近一条 AI 消息的文本内容"""
    if isinstance(messages, (list, tuple)):
        iterable = reversed(messages)
    else:
        iterable = reversed(list(messages))

    for msg in iterable:
        if not isinstance(msg, dict):
            continue
        if is_ai_message(msg):
            text = extract_text(msg.get('content'))
            if text:
                return text
    return ''


def extract_latest_ai_message(messages: Iterable[typing.Any]) -> dict[str, typing.Any] | None:
    """获取最近一条 AI 消息对象"""
    if isinstance(messages, (list, tuple)):
        iterable = reversed(messages)
    else:
        iterable = reversed(list(messages))

    for msg in iterable:
        if not isinstance(msg, dict):
            continue
        if is_ai_message(msg):
            return msg
    return None


def is_clarification_tool_message(message: dict[str, typing.Any]) -> bool:
    """判断是否为澄清问题工具消息"""
    msg_type = str(message.get('type', '')).lower()
    tool_name = str(message.get('name', '')).lower()
    return msg_type == 'tool' and tool_name == 'ask_clarification'


def extract_latest_clarification_text(messages: Iterable[typing.Any]) -> str:
    """提取最近的澄清问题文本"""
    if isinstance(messages, (list, tuple)):
        iterable = reversed(messages)
    else:
        iterable = reversed(list(messages))

    for msg in iterable:
        if not isinstance(msg, dict):
            continue
        if is_clarification_tool_message(msg):
            text = extract_text(msg.get('content'))
            if text:
                return text
    return ''


def get_message_id(message: typing.Any) -> str:
    """提取消息 ID"""
    if not isinstance(message, dict):
        return ''
    msg_id = message.get('id')
    return msg_id if isinstance(msg_id, str) else ''


def extract_event_message_obj(data: typing.Any) -> dict[str, typing.Any] | None:
    """从事件 data 中提取消息对象"""
    msg_obj = data
    if isinstance(data, (list, tuple)) and data:
        msg_obj = data[0]
    if isinstance(msg_obj, dict) and isinstance(msg_obj.get('data'), dict):
        msg_obj = msg_obj['data']
    return msg_obj if isinstance(msg_obj, dict) else None


def extract_ai_delta_from_event_data(data: typing.Any) -> str:
    """从 messages-tuple 事件中提取 AI delta 文本"""
    msg_obj = extract_event_message_obj(data)
    if not msg_obj:
        return ''
    if is_ai_message(msg_obj):
        return extract_text(msg_obj.get('content'))
    return ''


def extract_clarification_from_event_data(data: typing.Any) -> str:
    """从事件中提取澄清问题"""
    msg_obj = extract_event_message_obj(data)
    if not msg_obj:
        return ''
    if is_clarification_tool_message(msg_obj):
        return extract_text(msg_obj.get('content'))
    return ''


def _iter_custom_event_items(data: typing.Any) -> list[dict[str, typing.Any]]:
    items: list[dict[str, typing.Any]] = []
    if isinstance(data, dict):
        return [data]
    if isinstance(data, list):
        for item in data:
            if isinstance(item, dict):
                items.append(item)
            elif isinstance(item, (list, tuple)):
                for nested in item:
                    if isinstance(nested, dict):
                        items.append(nested)
    return items


def extract_task_failures_from_custom_event(data: typing.Any) -> list[str]:
    """从 custom 事件中提取子任务失败信息"""
    failures: list[str] = []
    for item in _iter_custom_event_items(data):
        event_type = str(item.get('type', '')).lower()
        if event_type not in {'task_failed', 'task_timed_out'}:
            continue

        task_id = str(item.get('task_id', '')).strip()
        error_text = extract_text(item.get('error')).strip()
        if task_id and error_text:
            failures.append(f'{task_id}: {error_text}')
        elif error_text:
            failures.append(error_text)
        elif task_id:
            failures.append(f'{task_id}: unknown error')
        else:
            failures.append('unknown task failure')
    return failures


def build_task_failure_summary(failures: list[str]) -> str:
    """构建任务失败摘要"""
    if not failures:
        return ''
    deduped: list[str] = []
    seen: set[str] = set()
    for failure in failures:
        if failure not in seen:
            seen.add(failure)
            deduped.append(failure)
    if len(deduped) == 1:
        return f'DeerFlow subtask failed: {deduped[0]}'
    joined = '\n'.join([f'- {item}' for item in deduped[:5]])
    return f'DeerFlow subtasks failed:\n{joined}'

```

### Core Architecture Module: `src/langbot/libs/wechatpad_api/util/http_util.py`
```
import json as json_module

import requests
from langbot.pkg.utils import httpclient

_MAX_WECHATPAD_RESPONSE_BYTES = 16 * 1024 * 1024


def _read_requests_response_limited(response: requests.Response) -> dict:
    content_length = response.headers.get('Content-Length')
    if content_length is not None:
        try:
            if int(content_length) > _MAX_WECHATPAD_RESPONSE_BYTES:
                raise RuntimeError('WeChatPad response exceeds the runtime limit')
        except (TypeError, ValueError):
            pass
    body = bytearray()
    for chunk in response.iter_content(chunk_size=64 * 1024):
        body.extend(chunk)
        if len(body) > _MAX_WECHATPAD_RESPONSE_BYTES:
            raise RuntimeError('WeChatPad response exceeds the runtime limit')
    result = json_module.loads(body)
    if not isinstance(result, dict):
        raise RuntimeError('WeChatPad returned a non-object response')
    return result


def post_json(base_url, token, data=None):
    headers = {'Content-Type': 'application/json'}

    url = base_url + f'?key={token}'

    try:
        with requests.post(
            url,
            json=data,
            headers=headers,
            timeout=60,
            stream=True,
        ) as response:
            response.raise_for_status()
            result = _read_requests_response_limited(response)

        if result:
            return result
        else:
            raise RuntimeError('WeChatPad returned an empty response')
    except Exception as e:
        raise RuntimeError(str(e))


def get_json(base_url, token):
    headers = {'Content-Type': 'application/json'}

    url = base_url + f'?key={token}'

    try:
        with requests.get(
            url,
            headers=headers,
            timeout=60,
            stream=True,
        ) as response:
            response.raise_for_status()
            result = _read_requests_response_limited(response)

        if result:
            return result
        else:
            raise RuntimeError('WeChatPad returned an empty response')
    except Exception as e:
        raise RuntimeError(str(e))


async def async_request(
    base_url: str,
    token_key: str,
    method: str = 'POST',
    params: dict = None,
    # headers: dict = None,
    data: dict = None,
    json: dict = None,
):
    """
    通用异步请求函数

    :param base_url: 请求URL
    :param token_key: 请求token
    :param method: HTTP方法 (GET, POST, PUT, DELETE等)
    :param params: URL查询参数
    # :param headers: 请求头
    :param data: 表单数据
    :param json: JSON数据
    :return: 响应文本
    """
    headers = {'Content-Type': 'application/json'}
    url = f'{base_url}?key={token_key}'
    session = httpclient.get_session()
    async with session.request(
        method=method, url=url, params=params, headers=headers, data=data, json=json
    ) as response:
        response.raise_for_status()  # 如果状态码不是200，抛出异常
        result = json_module.loads(
            await httpclient.read_limited(
                response,
                max_bytes=_MAX_WECHATPAD_RESPONSE_BYTES,
            )
        )
        # print(result)
        return result
        # if result.get('Code') == 200:
        #
        #     return await result
        # else:
        #     raise RuntimeError("请求失败",response.text)

```

### Core Architecture Module: `src/langbot/libs/wechatpad_api/util/terminal_printer.py`
```
import qrcode


def print_green(text):
    print(f'\033[32m{text}\033[0m')


def print_yellow(text):
    print(f'\033[33m{text}\033[0m')


def print_red(text):
    print(f'\033[31m{text}\033[0m')


def make_and_print_qr(url):
    """生成并打印二维码

    Args:
        url: 需要生成二维码的URL字符串

    Returns:
        None

    功能:
        1. 在终端打印二维码的ASCII图形
        2. 同时提供在线二维码生成链接作为备选
    """
    print_green('请扫描下方二维码登录')
    qr = qrcode.QRCode()
    qr.add_data(url)
    qr.make()
    qr.print_ascii(invert=True)
    print_green(f'也可以访问下方链接获取二维码:\nhttps://api.qrserver.com/v1/create-qr-code/?data={url}')

```

### Core Architecture Module: `src/langbot/pkg/agent/runner/persistent_state_store.py`
```
"""Persistent state store for Runner protocol state.

This module provides a database-backed state store for event-first Protocol v1.
"""

from __future__ import annotations

import typing
import json
import threading
from datetime import datetime

import sqlalchemy
from sqlalchemy.ext.asyncio import AsyncEngine
from sqlalchemy import select, delete, update
from sqlalchemy.dialects.postgresql import insert as postgresql_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError

from .descriptor import RunnerDescriptor
from .host_models import AgentEventEnvelope, AgentBinding
from .state_scope import (
    VALID_STATE_SCOPES,
    build_state_scope_key,
    get_binding_identity,
    normalize_state_key,
)
from ...entity.persistence.runner_state import RunnerState


# Maximum value_json size (256KB)
MAX_VALUE_JSON_BYTES = 256 * 1024


class PersistentStateStore:
    """Database-backed state store for Runner protocol state.

    IMPORTANT: This is HOST-OWNED protocol state, NOT plugin instance state.

    This store provides:
    1. Persistent storage across runs via database
    2. Scope isolation by runner_id + binding_identity + scope
    3. Policy enforcement (enable_state, state_scopes)
    4. JSON value validation and size limits

    Used by:
    - Event-first Protocol v1 (async methods)
    - State API handlers (get/set/delete/list)
    """

    def __init__(self, db_engine: AsyncEngine):
        self._db_engine = db_engine

    def _get_scope_key(
        self,
        scope: str,
        event: AgentEventEnvelope,
        binding: AgentBinding,
        descriptor: RunnerDescriptor,
    ) -> str | None:
        """Get scope key for given scope."""
        return build_state_scope_key(scope, event, binding, descriptor)

    def _check_scope_enabled(self, scope: str, binding: AgentBinding) -> bool:
        """Check if scope is enabled by binding's state_policy."""
        state_policy = binding.state_policy
        if not state_policy.enable_state:
            return False
        return scope in state_policy.state_scopes

    def _validate_json_value(
        self,
        value: typing.Any,
        logger: typing.Any = None,
    ) -> tuple[str | None, str | None]:
        """Validate and serialize value to JSON.

        Returns:
            Tuple of (json_string, error_message). If error_message is not None,
            json_string will be None.
        """
        try:
            json_str = json.dumps(value, ensure_ascii=False)
        except (TypeError, ValueError) as e:
            return None, f'Value is not JSON-serializable: {e}'

        # Check size limit
        json_bytes = len(json_str.encode('utf-8'))
        if json_bytes > MAX_VALUE_JSON_BYTES:
            return None, f'Value size {json_bytes} bytes exceeds limit {MAX_VALUE_JSON_BYTES} bytes'

        return json_str, None

    async def _upsert_state_row(
        self,
        conn: typing.Any,
        values: dict[str, typing.Any],
    ) -> None:
        """Insert or update a state row by the logical scope/key identity."""
        update_values = {
            'value_json': values['value_json'],
            'updated_at': values['updated_at'],
        }
        constraint_columns = ['scope_key', 'state_key']
        dialect_name = self._db_engine.dialect.name

        if dialect_name == 'sqlite':
            stmt = sqlite_insert(RunnerState).values(**values)
            await conn.execute(
                stmt.on_conflict_do_update(
                    index_elements=constraint_columns,
                    set_=update_values,
                )
            )
            return

        if dialect_name == 'postgresql':
            stmt = postgresql_insert(RunnerState).values(**values)
            await conn.execute(
                stmt.on_conflict_do_update(
                    index_elements=constraint_columns,
                    set_=update_values,
                )
            )
            return

        try:
            await conn.execute(sqlalchemy.insert(RunnerState).values(**values))
        except IntegrityError:
            await conn.execute(
                update(RunnerState)
                .where(RunnerState.scope_key == values['scope_key'])
                .where(RunnerState.state_key == values['state_key'])
                .values(**update_values)
            )

    # ========== Async DB Operations ==========

    async def build_snapshot_from_event(
        self,
        event: AgentEventEnvelope,
        binding: AgentBinding,
        descriptor: RunnerDescriptor,
    ) -> dict[str, dict[str, typing.Any]]:
        """Build state snapshot for all scopes from event and binding.

        Reads from database, respects state_policy.
        """
        state_policy = binding.state_policy

        # If state is disabled, return all empty scopes
        if not state_policy.enable_state:
            return {
                'conversation': {},
                'actor': {},
                'subject': {},
                'runner': {},
            }

        snapshot: dict[str, dict[str, typing.Any]] = {
            'conversation': {},
            'actor': {},
            'subject': {},
            'runner': {},
        }

        async with self._db_engine.connect() as conn:
            for scope in VALID_STATE_SCOPES:
                if not self._check_scope_enabled(scope, binding):
                    continue

                scope_key = self._get_scope_key(scope, event, binding, descriptor)
                if not scope_key:
                    continue

                # Query all state entries for this scope_key
                result = await conn.execute(
                    select(RunnerState.state_key, RunnerState.value_json).where(RunnerState.scope_key == scope_key)
                )
                rows = result.fetchall()

                for row in rows:
                    key = row.state_key
                    value_json = row.value_json
                    if value_json:
                        try:
                            snapshot[scope][key] = json.loads(value_json)
                        except json.JSONDecodeError:
                            pass  # Skip invalid JSON

        # Seed external.conversation_id from event.conversation_id if not set
        if self._check_scope_enabled('conversation', binding) and event.conversation_id:
            if 'external.conversation_id' not in snapshot['conversation']:
                snapshot['conversation']['external.conversation_id'] = event.conversation_id

        return snapshot

    async def apply_update_from_event(
        self,
        event: AgentEventEnvelope,
        binding: AgentBinding,
        descriptor: RunnerDescriptor,
        scope: str,
        key: str,
        value: typing.Any,
        logger: typing.Any = None,
    ) -> tuple[bool, str | None]:
        """Apply a state update from event context.

        Returns:
            Tuple of (success, error_message). If success is False, error_message
            contains the reason.
        """
        state_policy = binding.state_policy

        # Check if state is disabled
        if not state_policy.enable_state:
            return False, 'State is disabled by binding policy'

        # Validate scope
        if scope not in VALID_STATE_SCOPES:
            return False, f'Invalid scope: {scope}'

        # Check if scope is enabled
        if not self._check_scope_enabled(scope, binding):
            return False, f'Scope "{scope}" not enabled by binding policy'

        # Map accepted key aliases
        key = normalize_state_key(key)

        # Get scope key
        scope_key = self._get_scope_key(scope, event, binding, descriptor)
        if not scope_key:
            return False, f'Missing identity for scope "{scope}"'

        # Validate and serialize value
        value_json, error = self._validate_json_value(value, logger)
        if error:
            return False, error

        # Build context fields
        binding_identity = get_binding_identity(binding)

        now = datetime.utcnow()
        async with self._db_engine.begin() as conn:
            await self._upsert_state_row(
                conn,
                {
                    'runner_id': descriptor.id,
                    'binding_identity': binding_identity,
                    'scope': scope,
                    'scope_key': scope_key,
                    'state_key': key,
                    'value_json': value_json,
                    'bot_id': event.bot_id,
                    'workspace_id': event.workspace_id,
                    'conversation_id': event.conversation_id,
                    'thread_id': event.thread_id,
                    'actor_type': event.actor.actor_type if event.actor else None,
                    'actor_id': event.actor.actor_id if event.actor else None,
                    'subject_type': event.subject.subject_type if event.subject else None,
                    'subject_id': event.subject.subject_id if event.subject else None,
                    'created_at': now,
                    'updated_at': now,
                },
            )

        return True, None

    async def state_get(
        self,
        scope_key: str,
        state_key: str,
    ) -> typing.Any:
        """Get a single state value by scope_key and state_key.

        Used by State API handlers.
        """
        state_key = normalize_state_key(state_key)

        async with self._db_engine.connect() as conn:
            result = await conn.execute(
                select(RunnerState.value_json)
                .where(RunnerState.scope_key == scope_key)
                .where(RunnerState.state_key == state_key)
            )
            row = result.first()

            if not row or not row.value_json:
                return None

            try:
                return json.loads(row.value_json)
            except json.JSONDecodeError:
                re
```

### Core Architecture Module: `src/langbot/pkg/agent/runner/state_scope.py`
```
"""State scope key helpers for Runner host-owned state."""

from __future__ import annotations

import hashlib
import json
import typing

from .descriptor import RunnerDescriptor
from .host_models import AgentBinding, AgentEventEnvelope


VALID_STATE_SCOPES = ('conversation', 'actor', 'subject', 'runner')

STATE_KEY_ALIASES = {
    'conversation_id': 'external.conversation_id',
}


def normalize_state_key(key: str) -> str:
    """Map accepted public aliases to protocol state keys."""
    return STATE_KEY_ALIASES.get(key, key)


def get_binding_identity(binding: AgentBinding) -> str:
    """Return the stable binding identity used for state isolation."""
    if binding.binding_id:
        return binding.binding_id

    scope = binding.scope
    if scope.scope_type and scope.scope_id:
        return f'{scope.scope_type}:{scope.scope_id}'

    return 'unknown_binding'


def _scope_hash(scope: str, parts: dict[str, typing.Any]) -> str:
    """Encode state scope dimensions without separator ambiguity."""
    payload = {
        'version': 2,
        'scope': scope,
        **parts,
    }
    raw = json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
    return f'{scope}:v2:{hashlib.sha256(raw.encode("utf-8")).hexdigest()}'


def _base_scope_parts(
    event: AgentEventEnvelope,
    binding: AgentBinding,
    descriptor: RunnerDescriptor,
) -> dict[str, typing.Any]:
    return {
        'runner_id': descriptor.id,
        'binding_identity': get_binding_identity(binding),
        'bot_id': event.bot_id,
        'workspace_id': event.workspace_id,
    }


def build_state_scope_key(
    scope: str,
    event: AgentEventEnvelope,
    binding: AgentBinding,
    descriptor: RunnerDescriptor,
) -> str | None:
    """Build the storage key for one state scope.

    Returns None when the event lacks the identity required by that scope.
    """
    base_parts = _base_scope_parts(event, binding, descriptor)

    if scope == 'conversation':
        if not event.conversation_id:
            return None
        return _scope_hash(
            scope,
            {
                **base_parts,
                'conversation_id': event.conversation_id,
                'thread_id': event.thread_id,
            },
        )

    if scope == 'actor':
        if not event.actor or not event.actor.actor_id:
            return None
        return _scope_hash(
            scope,
            {
                **base_parts,
                'actor_type': event.actor.actor_type or 'user',
                'actor_id': event.actor.actor_id,
            },
        )

    if scope == 'subject':
        if not event.subject or not event.subject.subject_id:
            return None
        return _scope_hash(
            scope,
            {
                **base_parts,
                'subject_type': event.subject.subject_type or 'unknown',
                'subject_id': event.subject.subject_id,
            },
        )

    if scope == 'runner':
        return _scope_hash(scope, base_parts)

    return None


def build_state_scope_keys(
    event: AgentEventEnvelope,
    binding: AgentBinding,
    descriptor: RunnerDescriptor,
) -> dict[str, str]:
    """Build all available scope keys for an event/binding pair."""
    scope_keys: dict[str, str] = {}
    for scope in VALID_STATE_SCOPES:
        scope_key = build_state_scope_key(scope, event, binding, descriptor)
        if scope_key:
            scope_keys[scope] = scope_key
    return scope_keys


def build_state_context(
    event: AgentEventEnvelope,
    binding: AgentBinding,
    descriptor: RunnerDescriptor,
) -> dict[str, typing.Any]:
    """Build the State API context stored in the run session."""
    return {
        'scope_keys': build_state_scope_keys(event, binding, descriptor),
        'binding_identity': get_binding_identity(binding),
        'bot_id': event.bot_id,
        'workspace_id': event.workspace_id,
        'conversation_id': event.conversation_id,
        'thread_id': event.thread_id,
        'actor_type': event.actor.actor_type if event.actor else None,
        'actor_id': event.actor.actor_id if event.actor else None,
        'subject_type': event.subject.subject_type if event.subject else None,
        'subject_id': event.subject.subject_id if event.subject else None,
    }

```

### Core Architecture Module: `src/langbot/pkg/api/http/controller/groups/knowledge/engines.py`
```
import quart
from urllib.parse import unquote

from ....authz import Permission
from ....context import RequestContext
from ... import group


@group.group_class('knowledge_engines', '/api/v1/knowledge/engines')
class KnowledgeEnginesRouterGroup(group.RouterGroup):
    async def initialize(self) -> None:
        @self.route(
            '',
            methods=['GET'],
            auth_type=group.AuthType.USER_TOKEN_OR_API_KEY,
            permission=Permission.RESOURCE_VIEW,
        )
        async def list_knowledge_engines(request_context: RequestContext) -> quart.Response:
            """List all available Knowledge Engines from plugins.

            Returns a list of Knowledge Engines with their capabilities and configuration schemas.
            This is used by the frontend to render the knowledge base creation wizard.
            """
            engines = await self.ap.knowledge_service.list_knowledge_engines(request_context)
            return self.success(data={'engines': engines})

        @self.route(
            '/<path:plugin_id>/creation-schema',
            methods=['GET'],
            auth_type=group.AuthType.USER_TOKEN_OR_API_KEY,
            permission=Permission.RESOURCE_VIEW,
        )
        async def get_engine_creation_schema(
            plugin_id: str,
            request_context: RequestContext,
        ) -> quart.Response:
            """Get creation settings schema for a specific Knowledge Engine.

            plugin_id is in 'author/name' format, captured via <path:> converter.
            """
            plugin_id = unquote(plugin_id)
            if '/' not in plugin_id:
                return self.http_status(400, -1, 'Invalid plugin_id format. Expected author/name.')
            schema = await self.ap.knowledge_service.get_engine_creation_schema(request_context, plugin_id)
            return self.success(data={'schema': schema})

        @self.route(
            '/<path:plugin_id>/retrieval-schema',
            methods=['GET'],
            auth_type=group.AuthType.USER_TOKEN_OR_API_KEY,
            permission=Permission.RESOURCE_VIEW,
        )
        async def get_engine_retrieval_schema(
            plugin_id: str,
            request_context: RequestContext,
        ) -> quart.Response:
            """Get retrieval settings schema for a specific Knowledge Engine.

            plugin_id is in 'author/name' format, captured via <path:> converter.
            """
            plugin_id = unquote(plugin_id)
            if '/' not in plugin_id:
                return self.http_status(400, -1, 'Invalid plugin_id format. Expected author/name.')
            schema = await self.ap.knowledge_service.get_engine_retrieval_schema(request_context, plugin_id)
            return self.success(data={'schema': schema})

```

### Core Architecture Module: `src/langbot/pkg/api/http/controller/groups/webhook_mgmt.py`
```
from __future__ import annotations

import quart

from ...authz import Permission, has_permission
from ...context import RequestContext
from .. import group


@group.group_class('webhook_mgmt', '/api/v1/webhooks')
class WebhookManagementRouterGroup(group.RouterGroup):
    async def initialize(self) -> None:
        @self.route('', methods=['GET'], permission=Permission.RESOURCE_VIEW)
        async def _(request_context: RequestContext) -> str:
            webhooks = await self.ap.webhook_service.get_webhooks(
                request_context,
                include_secret=has_permission(request_context, Permission.RESOURCE_MANAGE),
            )
            return self.success(data={'webhooks': webhooks})

        @self.route('', methods=['POST'], permission=Permission.RESOURCE_MANAGE)
        async def _(request_context: RequestContext) -> str:
            json_data = await quart.request.get_json(silent=True) or {}
            name = json_data.get('name', '')
            url = json_data.get('url', '')
            description = json_data.get('description', '')
            enabled = json_data.get('enabled', True)

            if not name:
                return self.http_status(400, -1, 'Name is required')
            if not url:
                return self.http_status(400, -1, 'URL is required')

            try:
                webhook = await self.ap.webhook_service.create_webhook(
                    request_context,
                    name,
                    url,
                    description,
                    enabled,
                )
            except ValueError as exc:
                return self.http_status(400, -1, str(exc))
            return self.success(data={'webhook': webhook})

        @self.route('/<int:webhook_id>', methods=['GET'], permission=Permission.RESOURCE_VIEW)
        async def _(webhook_id: int, request_context: RequestContext) -> str:
            webhook = await self.ap.webhook_service.get_webhook(
                request_context,
                webhook_id,
                include_secret=has_permission(request_context, Permission.RESOURCE_MANAGE),
            )
            if webhook is None:
                return self.http_status(404, -1, 'Webhook not found')
            return self.success(data={'webhook': webhook})

        @self.route(
            '/<int:webhook_id>',
            methods=['PUT', 'DELETE'],
            permission=Permission.RESOURCE_MANAGE,
        )
        async def _(webhook_id: int, request_context: RequestContext) -> str:
            if quart.request.method == 'PUT':
                json_data = await quart.request.get_json(silent=True) or {}
                updated = await self.ap.webhook_service.update_webhook(
                    request_context,
                    webhook_id,
                    json_data.get('name'),
                    json_data.get('url'),
                    json_data.get('description'),
                    json_data.get('enabled'),
                )
                if not updated:
                    return self.http_status(404, -1, 'Webhook not found')
                return self.success()

            deleted = await self.ap.webhook_service.delete_webhook(request_context, webhook_id)
            if not deleted:
                return self.http_status(404, -1, 'Webhook not found')
            return self.success()

```

### Core Architecture Module: `src/langbot/pkg/api/http/controller/groups/webhooks.py`
```
from __future__ import annotations

import quart
import traceback

from .. import group
from .....utils import bounded_executor


@group.group_class('webhooks', '/bots')
class WebhookRouterGroup(group.RouterGroup):
    async def initialize(self) -> None:
        @self.route('/<bot_uuid>', methods=['GET', 'POST'], auth_type=group.AuthType.NONE)
        async def handle_webhook(bot_uuid: str):
            """处理 bot webhook 回调（无子路径）"""
            return await self._dispatch_webhook(bot_uuid, '')

        @self.route('/<bot_uuid>/<path:path>', methods=['GET', 'POST'], auth_type=group.AuthType.NONE)
        async def handle_webhook_with_path(bot_uuid: str, path: str):
            """处理 bot webhook 回调（带子路径）"""
            return await self._dispatch_webhook(bot_uuid, path)

    async def _dispatch_webhook(self, bot_uuid: str, path: str):
        """分发 webhook 请求到对应的 bot adapter

        Args:
            bot_uuid: Bot 的 UUID
            path: 子路径（如果有的话）

        Returns:
            适配器返回的响应
        """
        try:
            # Public ingress never accepts X-Workspace-Id.  The opaque bot UUID
            # is resolved against the already-bound runtime resource, which
            # carries the trusted Workspace and placement generation.
            runtime_bot = await self.ap.platform_mgr.resolve_public_bot(bot_uuid)

            if not runtime_bot:
                return quart.jsonify({'error': 'Bot not found'}), 404

            if not runtime_bot.enable:
                return quart.jsonify({'error': 'Bot is disabled'}), 403

            if not hasattr(runtime_bot.adapter, 'handle_unified_webhook'):
                return quart.jsonify({'error': 'Adapter does not support unified webhook'}), 501

            async def dispatch():
                await self.ap.workspace_service.get_execution_binding(
                    runtime_bot.workspace_uuid,
                    expected_generation=runtime_bot.placement_generation,
                )
                return await runtime_bot.adapter.handle_unified_webhook(
                    bot_uuid=bot_uuid,
                    path=path,
                    request=quart.request,
                )

            with bounded_executor.blocking_work_scope(runtime_bot.workspace_uuid):
                persistence_mgr = self.ap.persistence_mgr
                cloud_runtime = getattr(getattr(persistence_mgr, 'mode', None), 'value', None) == 'cloud_runtime'
                if cloud_runtime:
                    tenant_scope = getattr(persistence_mgr, 'tenant_scope', None)
                    if not callable(tenant_scope):
                        raise RuntimeError('Cloud webhook dispatch requires an explicit tenant scope')
                    async with tenant_scope(runtime_bot.workspace_uuid):
                        response = await dispatch()
                else:
                    response = await dispatch()

            return response

        except bounded_executor.BlockingWorkCapacityError as exc:
            return self.http_status(
                429,
                'blocking_work_capacity_exceeded',
                str(exc),
            )
        except Exception:
            request_id = self.request_id()
            self.ap.logger.error(
                f'Webhook dispatch error request_id={request_id} bot={bot_uuid}: {traceback.format_exc()}'
            )
            return self.internal_error_response(request_id)

```

### Core Architecture Module: `src/langbot/pkg/api/http/service/webhook.py`
```
from __future__ import annotations

import sqlalchemy

from ....core import app
from ....entity.persistence import webhook
from .secrets import SECRET_MASK, mask_secret_value, restore_secret_placeholders
from .tenant import TenantContext, require_workspace_uuid, scope_statement


_DEFAULT_MAX_WEBHOOKS_PER_WORKSPACE = 16
_HARD_MAX_WEBHOOKS_PER_WORKSPACE = 64


class WebhookService:
    ap: app.Application

    def __init__(self, ap: app.Application) -> None:
        self.ap = ap

    def max_per_workspace(self) -> int:
        """Return the configured webhook cap within the process hard limit."""

        config = getattr(getattr(self.ap, 'instance_config', None), 'data', {})
        try:
            value = int(
                config.get('webhooks', {}).get(
                    'max_per_workspace',
                    _DEFAULT_MAX_WEBHOOKS_PER_WORKSPACE,
                )
            )
        except (AttributeError, TypeError, ValueError):
            value = _DEFAULT_MAX_WEBHOOKS_PER_WORKSPACE
        return min(max(value, 1), _HARD_MAX_WEBHOOKS_PER_WORKSPACE)

    def _serialize_webhook(self, entity, *, include_secret: bool) -> dict:
        serialized = self.ap.persistence_mgr.serialize_model(webhook.Webhook, entity)
        if not include_secret:
            serialized = serialized.copy()
            serialized['url'] = mask_secret_value(serialized.get('url'))
        return serialized

    async def get_webhooks(self, context: TenantContext, *, include_secret: bool = False) -> list[dict]:
        """Get all webhooks"""
        result = await self.ap.persistence_mgr.execute_async(
            scope_statement(
                sqlalchemy.select(webhook.Webhook).order_by(webhook.Webhook.id).limit(_HARD_MAX_WEBHOOKS_PER_WORKSPACE),
                webhook.Webhook,
                context,
            )
        )

        webhooks = result.all()
        return [self._serialize_webhook(wh, include_secret=include_secret) for wh in webhooks]

    async def create_webhook(
        self,
        context: TenantContext,
        name: str,
        url: str,
        description: str = '',
        enabled: bool = True,
    ) -> dict:
        """Create a new webhook"""
        workspace_uuid = require_workspace_uuid(context)
        max_webhooks = self.max_per_workspace()
        count_result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.select(sqlalchemy.func.count())
            .select_from(webhook.Webhook)
            .where(webhook.Webhook.workspace_uuid == workspace_uuid)
        )
        if (count_result.scalar() or 0) >= max_webhooks:
            raise ValueError(f'Maximum number of webhooks ({max_webhooks}) reached')

        url = restore_secret_placeholders(url, sensitive=True)
        webhook_data = {
            'workspace_uuid': workspace_uuid,
            'name': name,
            'url': url,
            'description': description,
            'enabled': enabled,
        }

        insert_result = await self.ap.persistence_mgr.execute_async(
            sqlalchemy.insert(webhook.Webhook).values(**webhook_data)
        )

        # Retrieve the created webhook
        result = await self.ap.persistence_mgr.execute_async(
            scope_statement(
                sqlalchemy.select(webhook.Webhook).where(webhook.Webhook.id == insert_result.inserted_primary_key[0]),
                webhook.Webhook,
                workspace_uuid,
            )
        )
        created_webhook = result.first()

        return self.ap.persistence_mgr.serialize_model(webhook.Webhook, created_webhook)

    async def get_webhook(
        self,
        context: TenantContext,
        webhook_id: int,
        *,
        include_secret: bool = False,
    ) -> dict | None:
        """Get a specific webhook by ID"""
        result = await self.ap.persistence_mgr.execute_async(
            scope_statement(
                sqlalchemy.select(webhook.Webhook).where(webhook.Webhook.id == webhook_id),
                webhook.Webhook,
                context,
            )
        )

        wh = result.first()

        if wh is None:
            return None

        return self._serialize_webhook(wh, include_secret=include_secret)

    async def update_webhook(
        self,
        context: TenantContext,
        webhook_id: int,
        name: str | None = None,
        url: str | None = None,
        description: str | None = None,
        enabled: bool | None = None,
    ) -> bool:
        """Update a webhook's metadata"""
        update_data = {}
        if name is not None:
            update_data['name'] = name
        if url is not None:
            if url == SECRET_MASK:
                current = await self.get_webhook(context, webhook_id, include_secret=True)
                if current is None:
                    return False
                url = restore_secret_placeholders(url, current.get('url'), sensitive=True)
            update_data['url'] = url
        if description is not None:
            update_data['description'] = description
        if enabled is not None:
            update_data['enabled'] = enabled

        if update_data:
            result = await self.ap.persistence_mgr.execute_async(
                scope_statement(
                    sqlalchemy.update(webhook.Webhook).where(webhook.Webhook.id == webhook_id).values(**update_data),
                    webhook.Webhook,
                    context,
                )
            )
            return (result.rowcount or 0) > 0
        return await self.get_webhook(context, webhook_id) is not None

    async def delete_webhook(self, context: TenantContext, webhook_id: int) -> bool:
        """Delete a webhook"""
        result = await self.ap.persistence_mgr.execute_async(
            scope_statement(
                sqlalchemy.delete(webhook.Webhook).where(webhook.Webhook.id == webhook_id),
                webhook.Webhook,
                context,
            )
        )
        return (result.rowcount or 0) > 0

    async def get_enabled_webhooks(self, context: TenantContext) -> list[dict]:
        """Get all enabled webhooks"""
        result = await self.ap.persistence_mgr.execute_async(
            scope_statement(
                sqlalchemy.select(webhook.Webhook).where(webhook.Webhook.enabled == True),
                webhook.Webhook,
                context,
            )
            .order_by(webhook.Webhook.id)
            .limit(self.max_per_workspace())
        )

        webhooks = result.all()
        return [self.ap.persistence_mgr.serialize_model(webhook.Webhook, wh) for wh in webhooks]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #2625** (2026-10-02): **fix(plugin): upgrade SDK to 0.7.10**
  *Symptoms*: Consume SDK legacy config=None compatibility fix. Pin and lock updated together.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/langbot-app/LangBot/pull/2625?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=langbot-app) Report :white_check_mark: All modified and coverable lines are covered by tests.  :loudspeaker: Thoughts on this report? [Let us know!](https://github.com/codecov/feedback/issues/255)

- **Issue #2624** (2026-10-01): **chore(release): prepare 4.11.0-beta.6 with SDK 0.7.9**
  *Symptoms*: Release next beta with CI formatting fixes and corrected SDK runtime version. Use registry dependency metadata for PyPI publication.

- **Issue #2623** (2026-10-01): **fix(ci): resolve frontend formatting failures**
  *Symptoms*: Format the two files rejected by frontend CI. Local pnpm lint passes.

- **Issue #2622** (2026-10-01): **chore(deps): upgrade plugin SDK to 0.7.7**
  *Symptoms*: Pin the latest main SDK release and wheel digest for production cluster rollout.

- **Issue #2619** (2026-09-30): **docs: move telemetry configuration out of READMEs**
  *Symptoms*: Move the Chinese and English optional-telemetry instructions into docs/TELEMETRY.md. Remove all telemetry text from root READMEs. No runtime changes. Verified all root README locales and git diff --check.

- **Issue #2618** (2026-09-30): **fix: document telemetry opt-out and silence delivery failures**
  *Symptoms*: ## Summary - Document default-on telemetry and the instance-wide disable_telemetry opt-out in Chinese/English READMEs and configuration template. - Keep delivery failures at DEBUG only; preserve best-effort exception isolation and background delivery. - Update existing failure tests to assert no warning alerts.  ## Verification - Existing telemetry suite: 44 passed. - Ruff and git diff --check passed.

- **Issue #2617** (2026-09-30): **feat: bounded execution telemetry for all processing modes**
  *Symptoms*: ## Summary - Core reports execution facts only; acceptance analysis remains in Space. - Observe platform events, route delivery, runner terminal state and affirmative API results. - Bound in-memory counters and upload rate; separate instance/workspace identities and honor disable_telemetry.  ## Verification - 164 existing focused tests pass; Ruff passes. - Public-IP sender/receiver/Postgres smoke verifies three modes and two workspaces. - 100,000-observation probe confirms 512-key cap.  Deploy Space receiver first (langbot-space#250). Independent Cloud pods are not changed.
  **Post-Mortem & Fix Analysis**:
  > ## [Codecov](https://app.codecov.io/gh/langbot-app/LangBot/pull/2617?dropdown=coverage&src=pr&el=h1&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=langbot-app) Report :x: Patch coverage is `36.17021%` with `120 lines` in your changes missing coverage. Please review. | [Files with missing lines](https://app.codecov.io/gh/langbot-app/LangBot/pull/2617?dropdown=coverage&src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=langbot-app) | Patch % | Lines | |---|---|---| | [src/langbot/pkg/telemetry/platform.py](https://app.codecov.io/gh/langbot-app/LangBot/pull/2617?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content=comment&utm_campaign=pr+comments&utm_term=langbot-app#diff-c3JjL2xhbmdib3QvcGtnL3RlbGVtZXRyeS9wbGF0Zm9ybS5weQ==) | 17.33% | [62 Missing :warning: ](https://app.codecov.io/gh/langbot-app/LangBot/pull/2617?src=pr&el=tree&utm_medium=referral&utm_source=github&utm_content

- **Issue #2616** (2026-09-30): **refactor: remove Beta diagnostics**
  *Symptoms*: Remove Beta diagnostic collection, wrappers, transport, configuration and dedicated docs/tests. Preserve product telemetry and plugin error feedback. Validation: 73 Runner/telemetry tests, 25 boot/MCP/WebSocket tests; Ruff and compileall pass.

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

### Incident Patch 1: `dcc7e17d` (2026-10-03)
**Commit Message**: fix(cloud): retain all execution records for activity counts

**File**: `src/langbot/pkg/telemetry/execution.py` (modified, +6/-0)
```diff
@@ -107,6 +107,12 @@ def __init__(self, manager):
     # ------------------------------------------------------------------ config
 
     def trace_mode(self) -> str:
+        # Cloud activity counts must not be computed from sampled successes.
+        # Telemetry opt-out is still enforced before recording observations.
+        from ..utils import constants
+
+        if constants.edition == 'cloud':
+            return 'all'
         mode = str(self.manager.telemetry_config.get('execution_trace', DEFAULT_TRACE_MODE) or '').strip().lower()
         return mode if mode in TRACE_MODES else DEFAULT_TRACE_MODE
 
```

**File**: `tests/unit_tests/telemetry/test_cloud_sampling.py` (added, +34/-0)
```diff
@@ -0,0 +1,34 @@
+from types import SimpleNamespace
+
+from langbot.pkg.telemetry.execution import ExecutionCounters
+from langbot.pkg.utils import constants
+
+
+def test_cloud_counts_are_not_sampled(monkeypatch):
+    monkeypatch.setattr(constants, 'edition', 'cloud')
+    counters = ExecutionCounters(SimpleNamespace(telemetry_config={'execution_trace': 'sampled'}))
+    assert counters.trace_mode() == 'all'
+    state = SimpleNamespace(failure_reason='', stages=[], synthetic=False, trace_id='00000001')
+    assert counters._trace_emitted(state)
+
+
+def test_community_retains_sampling(monkeypatch):
+    monkeypatch.setattr(constants, 'edition', 'community')
+    counters = ExecutionCounters(SimpleNamespace(telemetry_config={'execution_trace': 'sampled'}))
+    assert counters.trace_mode() == 'sampled'
+
+
+def test_dns_survives_saturated_executor():
+    import socket
+    import threading
+    from langbot.pkg.utils.bounded_executor import BoundedThreadPoolExecutor
+
+    gate = threading.Event()
+    executor = BoundedThreadPoolExecutor(max_workers=1, max_pending=0)
+    try:
+        blocked = executor.submit(gate.wait)
+        assert executor.submit(socket.getaddrinfo, '127.0.0.1', 443).result(timeout=2)
+    finally:
+        gate.set()
+        blocked.result(timeout=2)
+        executor.shutdown()
```

---

### Incident Patch 2: `b205c400` (2026-10-02)
**Commit Message**: fix(runtime): isolate bounded DNS resolution from blocking SDK work

**File**: `src/langbot/pkg/utils/bounded_executor.py` (modified, +16/-0)
```diff
@@ -173,6 +173,13 @@ def __init__(
             max_workers=max_workers,
             thread_name_prefix=thread_name_prefix,
         )
+        # asyncio DNS uses the default executor too. Keep a separately bounded
+        # resolver pool so long-lived SDK calls cannot starve control-plane DNS.
+        self._dns_executor = (
+            BoundedThreadPoolExecutor(max_workers=2, max_pending=32, thread_name_prefix='langbot-dns')
+            if thread_name_prefix != 'langbot-dns'
+            else None
+        )
         self.max_workers = max_workers
         self.max_pending = max_pending
         self.max_inflight_per_scope = max_inflight_per_scope
@@ -194,6 +201,10 @@ def submit(
         *args: Any,
         **kwargs: Any,
     ) -> concurrent.futures.Future:
+        import socket
+
+        if self._dns_executor is not None and fn in (socket.getaddrinfo, socket.getnameinfo):
+            return self._dns_executor.submit(fn, *args, **kwargs)
         scope = current_blocking_work_scope()
         if not self._capacity.acquire(blocking=False):
             with self._stats_lock:
@@ -246,6 +257,11 @@ def complete(_future: concurrent.futures.Future) -> None:
         future.add_done_callback(complete)
         return future
 
+    def shutdown(self, wait: bool = True, *, cancel_futures: bool = False) -> None:
+        if self._dns_executor is not None:
+            self._dns_executor.shutdown(wait=wait, cancel_futures=cancel_futures)
+        super().shutdown(wait=wait, cancel_futures=cancel_futures)
+
     def _release_scope_locked(self, scope: str | None) -> None:
         if scope is None:
             return
```

---

### Incident Patch 3: `4f1d8973` (2026-10-02)
**Commit Message**: fix(cloud): retry workspace snapshots every five minutes instead of daily

**File**: `src/langbot/pkg/telemetry/heartbeat.py` (modified, +5/-1)
```diff
@@ -271,4 +271,8 @@ async def heartbeat_loop(ap: core_app.Application) -> None:
                 ap.logger.debug(f'Telemetry heartbeat failed: {e}')
             except Exception:
                 pass
-        await asyncio.sleep(HEARTBEAT_INTERVAL_SECONDS)
+        # Cloud dashboards need fresh scoped snapshots, including Workspaces
+        # discovered after startup. A transient startup/projection failure must
+        # not suppress synchronization for an entire day.
+        cloud_runtime = getattr(getattr(ap.persistence_mgr, 'mode', None), 'value', None) == 'cloud_runtime'
+        await asyncio.sleep(300 if cloud_runtime else HEARTBEAT_INTERVAL_SECONDS)
```

---

### Incident Patch 4: `17cda161` (2026-10-02)
**Commit Message**: fix(telemetry): avoid global plugin enumeration in workspace snapshots and support model adapters

**File**: `src/langbot/pkg/telemetry/heartbeat.py` (modified, +2/-2)
```diff
@@ -189,10 +189,10 @@ async def build_heartbeat_payload(
             cloud_counter=lambda: len(ap.platform_mgr._bots_by_key),
         )
 
-    # Plugin count (from plugin runtime)
+    # Scoped Cloud counts are already available; never issue tenantless RPCs.
     try:
         plugin_connector = getattr(ap, 'plugin_connector', None)
-        if plugin_connector is not None:
+        if workspace_resource is None and plugin_connector is not None:
             plugins = await plugin_connector.list_plugins()
             features['plugin_count'] = len(plugins)
     except Exception:
```

**File**: `src/langbot/pkg/telemetry/platform.py` (modified, +4/-2)
```diff
@@ -117,5 +117,7 @@ async def wrapped(*args, **kwargs):
 
             return wrapped
 
-        setattr(adapter, name, make_wrapper(original, name))
-    setattr(adapter, '_execution_observed', True)
+        # Adapters are Pydantic models: method instrumentation is not a model
+        # field assignment. Keep wrappers instance-local, never on the class.
+        object.__setattr__(adapter, name, make_wrapper(original, name))
+    object.__setattr__(adapter, '_execution_observed', True)
```

**File**: `tests/unit_tests/telemetry/test_heartbeat.py` (modified, +1/-0)
```diff
@@ -183,6 +183,7 @@ async def test_cloud_counts_loaded_registries_without_tenant_sql(self, monkeypat
         assert by_workspace['workspace-b']['execution_generation'] == 9
         assert by_workspace['workspace-b']['adapters'] == ['WorkspaceBAdapter']
         assert 'workspace_resources' not in by_workspace['workspace-a']
+        ap.plugin_connector.list_plugins.assert_not_awaited()
         ap.persistence_mgr.execute_async.assert_not_awaited()
         ap.workspace_service.list_active_execution_bindings.assert_awaited_once()
 
```

**File**: `tests/unit_tests/telemetry/test_platform_model.py` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+from types import SimpleNamespace
+
+import pytest
+from pydantic import BaseModel
+
+from langbot.pkg.telemetry.platform import observe_adapter
+
+
+class ModelAdapter(BaseModel):
+    def get_supported_apis(self):
+        return ['send_message']
+
+    async def send_message(self):
+        return {'message_id': 'ok'}
+
+
+@pytest.mark.asyncio
+async def test_model_adapter_instrumentation_is_instance_local():
+    first, second = ModelAdapter(), ModelAdapter()
+    ap = SimpleNamespace(telemetry=None)
+    observe_adapter(ap, None, first)
+    wrapped = first.send_message
+    observe_adapter(ap, None, first)
+    assert first.send_message is wrapped
+    assert not getattr(second, '_execution_observed', False)
+    assert await first.send_message() == {'message_id': 'ok'}
+    assert await second.send_message() == {'message_id': 'ok'}
```

---

### Incident Patch 5: `c95b8581` (2026-10-02)
**Commit Message**: fix(plugin): upgrade SDK to 0.7.10 for legacy config compatibility (#2625)

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ dependencies = [
     "langchain-text-splitters>=1.1.2",
     "chromadb>=1.0.0,<2.0.0",
     "qdrant-client (>=1.15.1,<2.0.0)",
-    "langbot-plugin==0.7.9",
+    "langbot-plugin==0.7.10",
     "asyncpg>=0.30.0",
     "line-bot-sdk>=3.19.0",
     "matrix-nio>=0.25.2",
```

**File**: `uv.lock` (modified, +4/-4)
```diff
@@ -2185,7 +2185,7 @@ requires-dist = [
     { name = "gewechat-client", specifier = ">=0.1.5" },
     { name = "html2text", specifier = ">=2024.2.26" },
     { name = "httpx", extras = ["socks"], specifier = ">=0.28.1" },
-    { name = "langbot-plugin", specifier = "==0.7.9" },
+    { name = "langbot-plugin", specifier = "==0.7.10" },
     { name = "langchain", specifier = ">=1.3.9" },
     { name = "langchain-core", specifier = ">=1.3.3" },
     { name = "langchain-text-splitters", specifier = ">=1.1.2" },
@@ -2255,7 +2255,7 @@ dev = [
 
 [[package]]
 name = "langbot-plugin"
-version = "0.7.9"
+version = "0.7.10"
 source = { registry = "https://pypi.org/simple" }
 dependencies = [
     { name = "aiofiles" },
@@ -2276,9 +2276,9 @@ dependencies = [
     { name = "watchdog" },
     { name = "websockets" },
 ]
-sdist = { url = "https://files.pythonhosted.org/packages/9a/c7/dbec32bd5bc4db152b71060b1d680f87afa591efa4ad5e38b1822fb7d7f2/langbot_plugin-0.7.9.tar.gz", hash = "sha256:d3a22eee703cbd2c6ed1e4e74ce1e2f0e80ae8c946f9422e015e59d13b9a99f2", size = 686113, upload-time = "2026-10-01T18:22:43.149Z" }
+sdist = { url = "https://files.pythonhosted.org/packages/0d/0c/65013949dee8a8eb38c29b264f5246f2581d6851afd688211fa97b5a0d8d/langbot_plugin-0.7.10.tar.gz", hash = "sha256:5e6b5fea75e5c3696afc0f200a013ef0d63b1e83713935fd05552796c11fb1b2", size = 686205, upload-time = "2026-10-02T00:16:00.397Z" }
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/fc/81/9fb420ea504c4c07af079ca4a9f59b1685a3aebd16e4e89306a2b9183a5b/langbot_plugin-0.7.9-py3-none-any.whl", hash = "sha256:c365b677175b20ea18c25ed364b55faa41298d3cd6dce4fe79f6dddf4ca34747", size = 441232, upload-time = "2026-10-01T18:22:41.813Z" },
+    { url = "https://files.pythonhosted.org/packages/64/d0/9b9c9c42d3f54b8a2ae7537e4c27f1f407f57dcb9f4329aaa2a10e4e1ceb/langbot_plugin-0.7.10-py3-none-any.whl", hash = "sha256:f01957745d1db1a4db630985079662d136da91bfb353883bb59a5d99f6065fa9", size = 441294, upload-time = "2026-10-02T00:15:59.091Z" },
 ]
 
 [[package]]
```

---

### Incident Patch 6: `8549369d` (2026-10-01)
**Commit Message**: fix(ci): format pipeline extensions and plugin icon hook (#2623)

**File**: `web/src/app/home/pipelines/components/pipeline-extensions/PipelineExtension.tsx` (modified, +9/-1)
```diff
@@ -12,7 +12,15 @@ import {
   DialogFooter,
 } from '@/components/ui/dialog';
 import { Checkbox } from '@/components/ui/checkbox';
-import { CircleHelp, Plus, X, Server, Wrench, Sparkles, Puzzle } from 'lucide-react';
+import {
+  CircleHelp,
+  Plus,
+  X,
+  Server,
+  Wrench,
+  Sparkles,
+  Puzzle,
+} from 'lucide-react';
 import { Badge } from '@/components/ui/badge';
 import { Switch } from '@/components/ui/switch';
 import { Label } from '@/components/ui/label';
```

**File**: `web/src/app/infra/hooks/useInstalledPluginIcon.ts` (modified, +2/-2)
```diff
@@ -56,8 +56,8 @@ export function useInstalledPluginIcon(
   marketplaceURL?: string | null,
 ): string | null {
   const key = author && name ? `${author}/${name}` : null;
-  const [url, setUrl] = useState<string | null>(() =>
-    marketplaceURL ?? (key ? iconCache.get(key)?.url ?? null : null),
+  const [url, setUrl] = useState<string | null>(
+    () => marketplaceURL ?? (key ? (iconCache.get(key)?.url ?? null) : null),
   );
 
   useEffect(() => {
```

---

### Incident Patch 7: `af9011f2` (2026-10-01)
**Commit Message**: fix(web): load installed plugin icons through the authenticated route

Multi-Workspace deployments fail the public plugin icon route closed (404), so plain <img src> icons broke everywhere locally and for the runner picker in production. A shared cached hook fetches the authenticated icon for installed plugins and leaves marketplace surfaces on the cloud URL.

**File**: `web/src/app/home/agents/components/PluginProcessorSettings.tsx` (modified, +24/-13)
```diff
@@ -2,7 +2,7 @@ import { Puzzle } from 'lucide-react';
 import { useTranslation } from 'react-i18next';
 import { Link } from 'react-router-dom';
 import type { RunnerDescriptor } from '@/app/infra/entities/api';
-import { httpClient } from '@/app/infra/http';
+import { useInstalledPluginIcon } from '@/app/infra/hooks/useInstalledPluginIcon';
 import { extractI18nObject } from '@/i18n/I18nProvider';
 import {
   Select,
@@ -27,6 +27,10 @@ function ProcessorComponentContent({
     ...component.label,
   });
   const pluginId = `${component.plugin_author}/${component.plugin_name}`;
+  const iconURL = useInstalledPluginIcon(
+    component.plugin_author,
+    component.plugin_name,
+  );
   return (
     <span
       className={
@@ -35,18 +39,25 @@ function ProcessorComponentContent({
           : 'flex min-w-0 items-center gap-2'
       }
     >
-      <img
-        src={httpClient.getPluginIconURL(
-          component.plugin_author,
-          component.plugin_name,
-        )}
-        alt=""
-        className={
-          option
-            ? 'row-span-2 size-7 shrink-0 rounded-md object-cover'
-            : 'size-5 shrink-0 rounded object-cover'
-        }
-      />
+      {iconURL ? (
+        <img
+          src={iconURL}
+          alt=""
+          className={
+            option
+              ? 'row-span-2 size-7 shrink-0 rounded-md object-cover'
+              : 'size-5 shrink-0 rounded object-cover'
+          }
+        />
+      ) : (
+        <Puzzle
+          className={
+            option
+              ? 'row-span-2 size-5 shrink-0 justify-self-center text-muted-foreground'
+              : 'size-4 shrink-0 text-muted-foreground'
+          }
+        />
+      )}
       <span className={option ? 'truncate font-medium leading-5' : 'truncate'}>
         {label}
       </span>
```

**File**: `web/src/app/home/agents/components/RunnerSelect.tsx` (modified, +13/-10)
```diff
@@ -3,7 +3,8 @@ import { Bot, ExternalLink, Loader2, Store } from 'lucide-react';
 import { useTranslation } from 'react-i18next';
 import { toast } from 'sonner';
 
-import { getCloudServiceClientSync, httpClient } from '@/app/infra/http';
+import { getCloudServiceClientSync } from '@/app/infra/http';
+import { useInstalledPluginIcon } from '@/app/infra/hooks/useInstalledPluginIcon';
 import type { IDynamicFormItemOption } from '@/app/infra/entities/form/dynamic';
 import type { PluginV4 } from '@/app/infra/entities/plugin';
 import {
@@ -51,21 +52,22 @@ function installErrorMessage(
   return getErrorMessage(error) || t('wizard.aiEngine.installFailed');
 }
 
-function installedRunnerIconURL(option: IDynamicFormItemOption) {
-  return option.name.startsWith('plugin:')
-    ? (() => {
-        const match = option.name.match(/^plugin:([^/]+)\/([^/]+)(?:\/|$)/);
-        return match ? httpClient.getPluginIconURL(match[1], match[2]) : null;
-      })()
-    : null;
+function pluginOptionParts(option: IDynamicFormItemOption): {
+  author: string;
+  name: string;
+} | null {
+  if (!option.name.startsWith('plugin:')) return null;
+  const match = option.name.match(/^plugin:([^/]+)\/([^/]+)(?:\/|$)/);
+  return match ? { author: match[1], name: match[2] } : null;
 }
 
 function InstalledRunnerContent({
   option,
 }: {
   option: IDynamicFormItemOption;
 }) {
-  const iconURL = installedRunnerIconURL(option);
+  const parts = pluginOptionParts(option);
+  const iconURL = useInstalledPluginIcon(parts?.author, parts?.name);
 
   return (
     <span className="flex min-w-0 items-center gap-2">
@@ -90,7 +92,8 @@ function InstalledRunnerOptionContent({
   option: IDynamicFormItemOption;
   description: string;
 }) {
-  const iconURL = installedRunnerIconURL(option);
+  const parts = pluginOptionParts(option);
+  const iconURL = useInstalledPluginIcon(parts?.author, parts?.name);
 
   return (
     <span className="grid w-full min-w-0 grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-x-2 text-left">
```

**File**: `web/src/app/home/components/dynamic-form/DynamicFormItemComponent.tsx` (modified, +5/-14)
```diff
@@ -22,6 +22,7 @@ import { ControllerRenderProps } from 'react-hook-form';
 import { Button } from '@/components/ui/button';
 import { useEffect, useState } from 'react';
 import { httpClient, systemInfo, userInfo } from '@/app/infra/http';
+import { useInstalledPluginIcon } from '@/app/infra/hooks/useInstalledPluginIcon';
 import {
   LLMModel,
   Bot,
@@ -94,27 +95,17 @@ function hasUsableOptionName(option: { name?: string | null }): boolean {
   return typeof option.name === 'string' && option.name.trim().length > 0;
 }
 
-function getPluginComponentIconURL(value?: string): string | null {
-  if (!value?.startsWith('plugin:')) {
-    return null;
-  }
-
-  const match = value.match(/^plugin:([^/]+)\/([^/]+)(?:\/|$)/);
-  if (!match) {
-    return null;
-  }
-
-  return httpClient.getPluginIconURL(match[1], match[2]);
-}
-
 function SelectOptionContent({
   label,
   value,
 }: {
   label: string;
   value: string;
 }) {
-  const iconURL = getPluginComponentIconURL(value);
+  const match = value?.startsWith('plugin:')
+    ? value.match(/^plugin:([^/]+)\/([^/]+)(?:\/|$)/)
+    : null;
+  const iconURL = useInstalledPluginIcon(match?.[1], match?.[2]);
 
   return (
     <div className="flex min-w-0 items-center gap-2">
```

**File**: `web/src/app/home/pipelines/components/pipeline-extensions/PipelineExtension.tsx` (modified, +28/-15)
```diff
@@ -12,7 +12,7 @@ import {
   DialogFooter,
 } from '@/components/ui/dialog';
 import { Checkbox } from '@/components/ui/checkbox';
-import { CircleHelp, Plus, X, Server, Wrench, Sparkles } from 'lucide-react';
+import { CircleHelp, Plus, X, Server, Wrench, Sparkles, Puzzle } from 'lucide-react';
 import { Badge } from '@/components/ui/badge';
 import { Switch } from '@/components/ui/switch';
 import { Label } from '@/components/ui/label';
@@ -26,6 +26,27 @@ import { MCPServer, Skill } from '@/app/infra/entities/api';
 import PluginComponentList from '@/app/home/plugins/components/plugin-installed/PluginComponentList';
 import { BoxUnavailableNotice } from '@/app/home/components/BoxUnavailableNotice';
 import { useBoxStatus } from '@/app/infra/hooks/useBoxStatus';
+import { useInstalledPluginIcon } from '@/app/infra/hooks/useInstalledPluginIcon';
+
+function PluginThumbnail({ author, name }: { author: string; name: string }) {
+  const iconURL = useInstalledPluginIcon(author, name);
+
+  if (!iconURL) {
+    return (
+      <div className="w-10 h-10 rounded-lg border bg-muted flex items-center justify-center flex-shrink-0">
+        <Puzzle className="size-5 text-muted-foreground" />
+      </div>
+    );
+  }
+
+  return (
+    <img
+      src={iconURL}
+      alt={name}
+      className="w-10 h-10 rounded-lg border bg-muted object-cover flex-shrink-0"
+    />
+  );
+}
 
 function InfoTooltip({ label }: { label: string }) {
   return (
@@ -373,13 +394,9 @@ export default function PipelineExtension({
                     className="flex items-center justify-between rounded-lg border p-3 hover:bg-accent"
                   >
                     <div className="flex-1 flex items-center gap-3">
-                      <img
-                        src={backendClient.getPluginIconURL(
-                          metadata.author || '',
-                          metadata.name,
-                        )}
-                        alt={metadata.name}
-                        className="w-10 h-10 rounded-lg border bg-muted object-cover flex-shrink-0"
+                      <PluginThumbnail
+                        author={metadata.author || ''}
+                        name={metadata.name}
                       />
                       <div className="flex-1">
                         <div className="font-medium">{metadata.name}</div>
@@ -665,13 +682,9 @@ export default function PipelineExtension({
                     onClick={() => handleTogglePlugin(pluginId)}
                   >
                     <Checkbox checked={isSelected} />
-                    <img
-                      src={backendClient.getPluginIconURL(
-                        metadata.author || '',
-                        metadata.name,
-                      )}
-                      alt={metadata.name}
-                      className="w-10 h-10 rounded-lg border bg-muted object-cover flex-shrink-0"
+                    <PluginThumbnail
+                      author={metadata.author || ''}
+                      name={metadata.name}
                     />
                     <div className="flex-1">
                       <div className="font-medium">{metadata.name}</div>
```

**File**: `web/src/app/home/plugins/components/plugin-installed/ExtensionCardComponent.tsx` (modified, +6/-8)
```diff
@@ -13,7 +13,7 @@ import {
   Puzzle,
 } from 'lucide-react';
 import { getCloudServiceClientSync, systemInfo } from '@/app/infra/http';
-import { useAuthenticatedPluginIcon } from '@/hooks/useAuthenticatedPluginResource';
+import { useInstalledPluginIcon } from '@/app/infra/hooks/useInstalledPluginIcon';
 import { Button } from '@/components/ui/button';
 import { Card } from '@/components/ui/card';
 import {
@@ -39,10 +39,9 @@ export default function ExtensionCardComponent({
   const { t } = useTranslation();
   const [dropdownOpen, setDropdownOpen] = useState(false);
   const [iconFailed, setIconFailed] = useState(false);
-  const authenticatedIcon = useAuthenticatedPluginIcon(
-    cardVO.author,
-    cardVO.name,
-    cardVO.type === 'plugin',
+  const pluginIconURL = useInstalledPluginIcon(
+    cardVO.type === 'plugin' ? cardVO.author : null,
+    cardVO.type === 'plugin' ? cardVO.name : null,
   );
 
   const FallbackIcon =
@@ -51,9 +50,8 @@ export default function ExtensionCardComponent({
       : cardVO.type === 'skill'
         ? Sparkles
         : Puzzle;
-  const iconSrc =
-    cardVO.type === 'plugin' ? authenticatedIcon.url : cardVO.iconURL;
-  const showFallback = iconFailed || authenticatedIcon.error || !iconSrc;
+  const iconSrc = cardVO.type === 'plugin' ? pluginIconURL : cardVO.iconURL;
+  const showFallback = iconFailed || !iconSrc;
 
   const getTypeLabel = (type: ExtensionType) => {
     switch (type) {
```

**File**: `web/src/app/home/plugins/components/plugin-installed/PluginInstalledComponent.tsx` (modified, +3/-1)
```diff
@@ -157,7 +157,9 @@ const PluginInstalledComponent = forwardRef<
               version: meta.version ?? '',
               enabled: plugin.enabled,
               type: marketplacePlugin?.type || 'plugin',
-              iconURL: httpClient.getPluginIconURL(author, name),
+              // Icon is resolved by ExtensionCardComponent through the shared
+              // installed-plugin hook (authenticated fetch in multi-Workspace
+              // deployments); the public /icon route 404s there.
               install_source: plugin.install_source,
               install_info: plugin.install_info,
               status: plugin.status,
```

**File**: `web/src/app/home/plugins/components/plugin-installed/plugin-card/PluginCardComponent.tsx` (modified, +21/-7)
```diff
@@ -2,9 +2,16 @@ import { PluginCardVO } from '@/app/home/plugins/components/plugin-installed/Plu
 import { useState } from 'react';
 import { Badge } from '@/components/ui/badge';
 import { useTranslation } from 'react-i18next';
-import { BugIcon, ExternalLink, Ellipsis, Trash, ArrowUp } from 'lucide-react';
+import {
+  BugIcon,
+  ExternalLink,
+  Ellipsis,
+  Trash,
+  ArrowUp,
+  Puzzle,
+} from 'lucide-react';
 import { getCloudServiceClientSync, systemInfo } from '@/app/infra/http';
-import { httpClient } from '@/app/infra/http/HttpClient';
+import { useInstalledPluginIcon } from '@/app/infra/hooks/useInstalledPluginIcon';
 import { Button } from '@/components/ui/button';
 import {
   DropdownMenu,
@@ -27,6 +34,7 @@ export default function PluginCardComponent({
 }) {
   const { t } = useTranslation();
   const [dropdownOpen, setDropdownOpen] = useState(false);
+  const iconURL = useInstalledPluginIcon(cardVO.author, cardVO.name);
 
   return (
     <>
@@ -36,11 +44,17 @@ export default function PluginCardComponent({
       >
         <div className="w-full h-full flex flex-row items-start justify-start gap-[1.2rem]">
           {/* Icon - fixed width */}
-          <img
-            src={httpClient.getPluginIconURL(cardVO.author, cardVO.name)}
-            alt="plugin icon"
-            className="w-16 h-16 rounded-[8%] flex-shrink-0"
-          />
+          {iconURL ? (
+            <img
+              src={iconURL}
+              alt="plugin icon"
+              className="w-16 h-16 rounded-[8%] flex-shrink-0"
+            />
+          ) : (
+            <div className="w-16 h-16 flex-shrink-0 flex items-center justify-center">
+              <Puzzle className="w-12 h-12 text-blue-500" />
+            </div>
+          )}
 
           {/* Content area - flexible width with min-width to prevent overflow */}
           <div className="flex-1 min-w-0 h-full flex flex-col items-start justify-between gap-[0.6rem]">
```

**File**: `web/src/app/infra/hooks/useInstalledPluginIcon.ts` (added, +118/-0)
```diff
@@ -0,0 +1,118 @@
+import { useEffect, useState } from 'react';
+
+import { httpClient } from '@/app/infra/http';
+
+/**
+ * Resolve the icon of an *installed* plugin in every deployment.
+ *
+ * The Core's public `/icon` route only exists in single-workspace (OSS)
+ * installs; in multi-Workspace deployments it 404s, so installed-plugin
+ * surfaces must go through the authenticated `/authenticated-icon` route and
+ * stream the bytes as a blob object URL.
+ *
+ * - Core backend client: blob-fetch `getAuthenticatedPluginIconURL` and cache
+ *   the resulting object URL per `author/name` (module-level, shared across
+ *   every mounted consumer of the same icon).
+ * - Cloud/Space marketplace surfaces: callers that already resolved a
+ *   marketplace URL pass it as `marketplaceURL`; it is returned verbatim and
+ *   no blob fetch happens.
+ * - Returns `null` while loading / when the plugin has no icon, so callers
+ *   keep rendering their existing fallback.
+ *
+ * Object URLs are revoked once the last subscriber unmounts (or the last
+ * subscriber's fetch settles with no remaining subscriber).
+ */
+
+type CachedIcon = { url: string };
+
+// Resolved object URLs, keyed by `author/name`.
+const iconCache = new Map<string, CachedIcon>();
+// In-flight authenticated fetches, de-duplicated per key.
+const inflightIcons = new Map<string, Promise<string | null>>();
+// Mounted subscriber count per key, so we only revoke when nobody needs it.
+const iconRefCounts = new Map<string, number>();
+
+function loadIcon(
+  key: string,
+  author: string,
+  name: string,
+): Promise<string | null> {
+  const existing = inflightIcons.get(key);
+  if (existing) return existing;
+
+  const request = httpClient
+    .getAuthenticatedPluginIconURL(author, name)
+    .catch(() => null)
+    .finally(() => {
+      inflightIcons.delete(key);
+    });
+  inflightIcons.set(key, request);
+  return request;
+}
+
+export function useInstalledPluginIcon(
+  author?: string | null,
+  name?: string | null,
+  marketplaceURL?: string | null,
+): string | null {
+  const key = author && name ? `${author}/${name}` : null;
+  const [url, setUrl] = useState<string | null>(() =>
+    marketplaceURL ?? (key ? iconCache.get(key)?.url ?? null : null),
+  );
+
+  useEffect(() => {
+    if (marketplaceURL) {
+      // Cloud/Space marketplace surface: already resolved upstream.
+      setUrl(marketplaceURL);
+      return;
+    }
+    if (!key || !author || !name) {
+      setUrl(null);
+      return;
+    }
+
+    let active = true;
+    iconRefCounts.set(key, (iconRefCounts.get(key) ?? 0) + 1);
+
+    const cached = iconCache.get(key);
+    if (cached) {
+      setUrl(cached.url);
+    } else {
+      setUrl(null);
+      void loadIcon(key, author, name).then((objectURL) => {
+        if (!objectURL) return;
+        // The last subscriber may have left while the fetch was in flight.
+        if (iconRefCounts.get(key) === undefined) {
+          URL.revokeObjectURL(objectURL);
+          return;
+        }
+        const current = iconCache.get(key);
+        if (current) {
+          // Another subscriber resolved first; share its object URL.
+          if (current.url !== objectURL) URL.revokeObjectURL(objectURL);
+          if (active) setUrl(current.url);
+          return;
+        }
+        iconCache.set(key, { url: objectURL });
+        if (active) setUrl(objectURL);
+      });
+    }
+
+    return () => {
+      active = false;
+      const remaining = (iconRefCounts.get(key) ?? 1) - 1;
+      if (remaining > 0) {
+        iconRefCounts.set(key, remaining);
+        return;
+      }
+      iconRefCounts.delete(key);
+      const entry = iconCache.get(key);
+      if (entry) {
+        iconCache.delete(key);
+        URL.revokeObjectURL(entry.url);
+      }
+    };
+  }, [key, author, name, marketplaceURL]);
+
+  return marketplaceURL ?? url;
+}
```

---

### Incident Patch 8: `34b5fe02` (2026-10-01)
**Commit Message**: fix(plugin): share the runtime file-transfer root and 404 uninstalled icon requests

The SDK binds one transfer root inode (mode 0700) and picks it per profile: a shared worker uses /tmp/lbp-rpc while a host without the profile env fell back to data/temp/lbp, so plugin icons and assets died with 'Invalid file transfer capability'. The host now pins the shared root, and a plugin absent from the resolved Workspace answers 404 instead of 500.

**File**: `src/langbot/pkg/api/http/controller/groups/plugins.py` (modified, +19/-1)
```diff
@@ -165,6 +165,16 @@ def restore_plugin_secret_placeholders(value, current_value=_MISSING_SECRET, *,
     pass
 
 
+def _is_plugin_not_installed(exc: BaseException) -> bool:
+    """True when the connector reports a plugin absent from the resolved Workspace.
+
+    The connector raises a plain ``ValueError`` for this case, so resource routes
+    answer 404 instead of surfacing a 500 the WebUI would have to swallow.
+    """
+
+    return 'is not installed in this workspace' in str(exc).lower()
+
+
 def _normalize_plugin_asset_path(filepath: str) -> str | None:
     filepath = filepath.replace('\\', '/')
     if filepath.startswith('/'):
@@ -596,7 +606,15 @@ async def _(
             request_context: RequestContext,
         ) -> quart.Response:
             await self._require_authenticated_plugin_runtime_context(request_context)
-            icon_data = await self.ap.plugin_connector.get_plugin_icon(author, plugin_name)
+            try:
+                icon_data = await self.ap.plugin_connector.get_plugin_icon(author, plugin_name)
+            except ValueError as exc:
+                # A plugin that is not installed for this Workspace is a missing
+                # resource, not a server fault: the WebUI asks for icons by plugin
+                # identity and must be able to fall back silently.
+                if _is_plugin_not_installed(exc):
+                    return quart.Response('Icon not found', status=404)
+                raise
             icon_bytes = await asyncio.to_thread(base64.b64decode, icon_data['plugin_icon_base64'])
             return quart.Response(icon_bytes, mimetype=icon_data['mime_type'])
 
```

**File**: `tests/unit_tests/plugin/test_plugin_file_transfer_root.py` (added, +51/-0)
```diff
@@ -0,0 +1,51 @@
+"""The host must share the Runtime's plugin file-transfer root in shared deployments.
+
+A mismatch leaves plugin icons and assets failing with
+"Invalid file transfer capability" because the SDK binds one directory inode per
+process (mode 0700) and picks the default from the runtime profile.
+"""
+
+from __future__ import annotations
+
+import os
+from importlib import import_module
+from types import SimpleNamespace
+
+from langbot_plugin.runtime.io.handler import SHARED_WORKER_FILE_STORAGE_DIR
+from langbot_plugin.runtime.security import PLUGIN_FILE_STORAGE_DIR_ENV
+
+
+def connector_module():
+    import_module('langbot.pkg.core.app')
+    return import_module('langbot.pkg.plugin.connector')
+
+
+def align(profile: str) -> None:
+    connector = connector_module()
+    connector.PluginRuntimeConnector._align_plugin_file_transfer_root(
+        SimpleNamespace(runtime_profile=profile)
+    )
+
+
+def test_shared_profile_pins_the_runtime_transfer_root(monkeypatch):
+    monkeypatch.delenv(PLUGIN_FILE_STORAGE_DIR_ENV, raising=False)
+
+    align('shared')
+
+    assert os.environ[PLUGIN_FILE_STORAGE_DIR_ENV] == SHARED_WORKER_FILE_STORAGE_DIR
+
+
+def test_explicit_operator_value_is_never_overridden(monkeypatch):
+    monkeypatch.setenv(PLUGIN_FILE_STORAGE_DIR_ENV, '/var/lib/custom-transfer')
+
+    align('shared')
+
+    assert os.environ[PLUGIN_FILE_STORAGE_DIR_ENV] == '/var/lib/custom-transfer'
+
+
+def test_oss_profile_leaves_the_default_alone(monkeypatch):
+    monkeypatch.delenv(PLUGIN_FILE_STORAGE_DIR_ENV, raising=False)
+
+    align('oss_dev')
+
+    assert PLUGIN_FILE_STORAGE_DIR_ENV not in os.environ
```

---

### Incident Patch 9: `38d57507` (2026-10-01)
**Commit Message**: fix(plugin): report when an installation failure happened, not when it was sampled

The connector stored only uuid/code/message, so the ops reporter stamped every entry with its own sampling time and a stale failure looked freshly broken on each report. Failures now carry failed_at and the payload publishes it.

**File**: `src/langbot/pkg/plugin/connector.py` (modified, +32/-1)
```diff
@@ -56,7 +56,9 @@
     errors as command_errors,
 )
 from langbot_plugin.runtime.plugin.mgr import PluginInstallSource
+from langbot_plugin.runtime.io.handler import SHARED_WORKER_FILE_STORAGE_DIR
 from langbot_plugin.runtime.security import (
+    PLUGIN_FILE_STORAGE_DIR_ENV,
     PLUGIN_RUNTIME_CONTROL_TOKEN_ENV,
     PLUGIN_RUNTIME_CONTROL_TOKEN_HEADER,
     validate_runtime_secret,
@@ -231,6 +233,7 @@ def __init__(
         self.runtime_profile: typing.Literal['oss_dev', 'shared'] = (
             'shared' if getattr(getattr(ap, 'deployment', None), 'mode', 'oss') == 'cloud' else 'oss_dev'
         )
+        self._align_plugin_file_transfer_root()
         self.runtime_identity: RuntimeIdentity | None = None
         self._runtime_id = self._build_runtime_id()
         self.worker_policy: PluginWorkerPolicy | None = None
@@ -256,6 +259,24 @@ def __init__(
             'missing_artifacts': 0,
         }
 
+    def _align_plugin_file_transfer_root(self) -> None:
+        """Use the Runtime's plugin file-transfer root when running shared.
+
+        The SDK binds its transfer root to one directory inode with mode 0700 and
+        picks the default per process: a shared worker uses
+        ``SHARED_WORKER_FILE_STORAGE_DIR``, every other process falls back to
+        ``data/temp/lbp``. A host talking to a shared Runtime must use the same root,
+        otherwise plugin icons and assets die with "Invalid file transfer
+        capability" (the icon route then answers 500/404 instead of the image).
+        An explicit operator value always wins.
+        """
+
+        if self.runtime_profile != 'shared':
+            return
+        if os.environ.get(PLUGIN_FILE_STORAGE_DIR_ENV):
+            return
+        os.environ[PLUGIN_FILE_STORAGE_DIR_ENV] = SHARED_WORKER_FILE_STORAGE_DIR
+
     @staticmethod
     def _build_runtime_id() -> str:
         """Return the durable identity of this instance's shared Runtime."""
@@ -634,6 +655,10 @@ def _raise_apply_failure(
             'installation_uuid': installation_uuid,
             'error_code': error_code,
             'message': message,
+            # When the failure actually happened. The ops reporter must publish this
+            # instead of its own sampling time, otherwise every sample re-stamps the
+            # same failure with the newest report time.
+            'failed_at': _utc_now_iso(),
         }
         self._installation_failures[installation_uuid] = failure
         self.ap.logger.error(
@@ -675,9 +700,15 @@ def _record_reconcile_failures(
                 'installation_uuid': installation_uuid,
                 'error_code': error_code,
                 'message': message,
+                # See _raise_apply_failure: never let the reporter substitute its own
+                # sampling time for the moment the failure was observed.
+                'failed_at': _utc_now_iso(),
             }
             failures[installation_uuid] = failure
-            if self._installation_failures.get(installation_uuid) != failure:
+            previous = self._installation_failures.get(installation_uuid) or {}
+            if {key: value for key, value in previous.items() if key != 'failed_at'} != {
+                key: value for key, value in failure.items() if key != 'failed_at'
+            }:
                 self.ap.logger.error(
                     'Plugin installation %s failed during reconcile [%s]: %s',
                     installation_uuid,
```

**File**: `src/langbot/pkg/plugin/runtime_ops.py` (modified, +4/-1)
```diff
@@ -356,7 +356,10 @@ def _failures(self, connector: typing.Any) -> list[dict[str, typing.Any]]:
                     'execution_mode': mode,
                     'error_code': str(record.get('error_code', '') or ''),
                     'message': _sanitize_failure_message(record.get('message')),
-                    'observed_at': observed_at,
+                    # The moment the failure was observed by the connector. Falling back to
+                    # the sampling time would make a stale failure look freshly broken on
+                    # every report.
+                    'observed_at': str(record.get('failed_at') or observed_at),
                 }
             )
         return failures
```

**File**: `tests/unit_tests/plugin/test_connector_reconcile.py` (modified, +9/-4)
```diff
@@ -735,11 +735,13 @@ async def test_apply_dependency_failure_raises_stable_observable_error():
     assert error.installation_uuid == setting.installation_uuid
     assert error.error_code == 'dependency_prepare_failed'
     assert '[dependency_prepare_failed]' in str(error)
-    assert connector._installation_failures[setting.installation_uuid] == {
+    recorded = connector._installation_failures[setting.installation_uuid]
+    assert {key: value for key, value in recorded.items() if key != 'failed_at'} == {
         'installation_uuid': setting.installation_uuid,
         'error_code': 'dependency_prepare_failed',
         'message': 'Plugin dependency installer exited with code 1',
     }
+    assert str(recorded['failed_at']).endswith('Z')
     connector.ap.logger.error.assert_called_once()
 
 
@@ -767,9 +769,12 @@ async def test_shared_reconcile_records_one_failure_without_blocking_other_state
         setting_a.installation_uuid,
         setting_b.installation_uuid,
     }
-    assert connector._installation_failures == {
-        setting_a.installation_uuid: failure,
-    }
+    recorded_failures = connector._installation_failures
+    assert {
+        uuid: {key: value for key, value in record.items() if key != 'failed_at'}
+        for uuid, record in recorded_failures.items()
+    } == {setting_a.installation_uuid: failure}
+    assert str(recorded_failures[setting_a.installation_uuid]['failed_at']).endswith('Z')
     assert set(connector._known_desired_states) == {
         setting_a.installation_uuid,
         setting_b.installation_uuid,
```

**File**: `tests/unit_tests/plugin/test_runtime_ops_reporter.py` (modified, +33/-0)
```diff
@@ -282,6 +282,39 @@ def raise_connect_error(request: httpx.Request) -> httpx.Response:
         await reporter.stop()
 
 
+class TestFailureTimestamps:
+    def test_publishes_when_the_failure_happened_not_when_it_was_sampled(self):
+        failures = {
+            'inst-1': {
+                'installation_uuid': 'inst-1',
+                'error_code': 'dependency_prepare_failed',
+                'message': 'prepare failed',
+                'failed_at': '2026-10-01T07:11:00Z',
+            }
+        }
+        reporter = RuntimeOpsReporter(make_app(connector=make_connector(failures=failures)))
+
+        payload = reporter.build_payload({'live': True})
+
+        entry = payload['failures'][0]
+        assert entry['observed_at'] == '2026-10-01T07:11:00Z'
+        assert entry['observed_at'] != payload['generated_at']
+
+    def test_legacy_records_without_a_timestamp_fall_back_to_the_sample_time(self):
+        failures = {
+            'inst-2': {
+                'installation_uuid': 'inst-2',
+                'error_code': 'worker_launch_failed',
+                'message': 'boom',
+            }
+        }
+        reporter = RuntimeOpsReporter(make_app(connector=make_connector(failures=failures)))
+
+        payload = reporter.build_payload({'live': True})
+
+        assert payload['failures'][0]['observed_at'] == payload['generated_at']
+
+
 def test_payload_never_contains_a_control_token(monkeypatch):
     monkeypatch.setenv(PLUGIN_RUNTIME_CONTROL_TOKEN_ENV, 'runtime-control-secret')
     monkeypatch.setenv(_CONTROL_PLANE_TOKEN_ENV, 'space-control-plane-secret')
```

---

### Incident Patch 10: `41820cd1` (2026-10-01)
**Commit Message**: test(platform): follow the batched execution trace pipeline

The execution trace rewrite batches records and uploads them from
ExecutionCounters.flush(), replaced the per-trace direct send, dropped the
window counters, made the execution id the record identity and records the
inbound event stage after the routing stage. The ingress tests still asserted
the old mechanism, so they failed on every Python version.

Assert what the pipeline now emits instead: flush the buffered records and read
them back, require the trace registry to be empty afterwards, assert the
deterministic execution id, expect the route stage before the inbound stage,
and give the dispatch stubs the execution_id parameter the ingress passes.

**File**: `tests/unit_tests/platform/test_botmgr_execution_trace.py` (modified, +40/-21)
```diff
@@ -75,35 +75,51 @@ async def get_supported_apis(self):
         return []
 
 
+async def flushed_records(counters, manager) -> list[dict]:
+    """Flush buffered telemetry and return everything the pipeline emitted.
+
+    Records are batched and uploaded by ``ExecutionCounters.flush()``; there is
+    no per-trace direct send any more.
+    """
+
+    await counters.flush()
+    assert manager.sent, 'expected the flushed telemetry batch'
+    return [record for payload in manager.sent for record in payload.get('records', [])]
+
+
 @pytest.mark.asyncio
 async def test_route_miss_emits_one_closed_trace():
     bot, manager, counters = make_bot([])
 
     await bot._handle_platform_event(message_received_event(), FakeAdapter())
 
+    records = await flushed_records(counters, manager)
     assert len(manager.sent) == 1
-    payload = manager.sent[0]
+    trace_records = [item for item in records if item.get('event_type') == 'feature_execution']
+    assert len(trace_records) == 1
+    payload = trace_records[0]
     assert payload['event_type'] == 'feature_execution'
-    assert len(payload['query_id']) == 36
+    # The execution identity is deterministic: one inbound event, one chain.
+    assert payload['query_id'] == 'platform:bot-1:message-1'
     assert payload['instance_id'] == 'instance-test'
     assert payload['workspace_uuid'] == 'workspace-test'
     features = payload['features']
     assert features['schema'] == 1
     assert [(row['family'], row['operation'], row['outcome']) for row in features['observations']] == [
-        ('platform_event', 'message.received', 'success'),
         ('event_route', 'message.received', 'skipped'),
+        ('platform_event', 'message.received', 'success'),
     ]
     assert [row['seq'] for row in features['observations']] == [0, 1]
     assert all(row['trace_id'] == payload['query_id'] for row in features['observations'])
     assert all(row['adapter'] == 'FakeAdapter' for row in features['observations'])
     assert features['trace']['closed_by'] == 'event_done'
-    # Window counters are still aggregated for coverage.
-    assert counters.pending
+    # The trace is closed and deregistered: nothing dangles after the event.
+    assert counters.traces == {}
 
 
 @pytest.mark.asyncio
 async def test_unavailable_route_target_carries_route_identity():
-    bot, manager, _ = make_bot(
+    bot, manager, counters = make_bot(
         [
             {
                 'id': 'agent-binding',
@@ -117,18 +133,18 @@ async def test_unavailable_route_target_carries_route_identity():
 
     await bot._handle_platform_event(message_received_event(), FakeAdapter())
 
-    stages = manager.sent[0]['features']['observations']
+    stages = (await flushed_records(counters, manager))[0]['features']['observations']
     assert [(stage['family'], stage['outcome'], stage['mode']) for stage in stages] == [
-        ('platform_event', 'success', 'none'),
         ('event_route', 'failed', 'agent'),
+        ('platform_event', 'success', 'none'),
     ]
-    assert stages[1]['route_ref'] == 'agent:agent-1'
-    assert stages[0]['route_ref'] == ''
+    assert stages[0]['route_ref'] == 'agent:agent-1'
+    assert stages[1]['route_ref'] == ''
 
 
 @pytest.mark.asyncio
 async def test_discarded_route_is_visible_without_user_values():
-    bot, manager, _ = make_bot(
+    bot, manager, counters = make_bot(
         [
             {
                 'id': 'discard-binding',
@@ -141,10 +157,10 @@ async def test_discarded_route_is_visible_without_user_values():
 
     await bot._handle_platform_event(SimpleNamespace(type='platform.member.joined'), FakeAdapter())
 
-    stages = manager.sent[0]['features']['observations']
-    assert [stage['outcome'] for stage in stages] == ['success', 'skipped']
-    assert stages[1]['operation'] == 'platform.member.joined'
-    assert stages[1]['mode'] == 'none'
+    stages = (await flushed_records(counters, manager))[0]['features']['observations']
+    assert [stage['outcome'] for stage in stages] == ['skipped', 'success']
+    assert stages[0]['operation'] == 'platform.member.joined'
+    assert stages[0]['mode'] == 'none'
 
 
 @pytest.mark.asyncio
@@ -154,33 +170,36 @@ async def test_telemetry_opt_out_emits_nothing():
     await bot._handle_platform_event(message_received_event(), FakeAdapter())
 
     assert manager.sent == []
-    assert counters.pending == {}
+    assert counters.records == []
     assert counters.traces == {}
 
 
 @pytest.mark.asyncio
 async def test_route_trace_scope_is_restored_after_dispatch():
     from langbot.pkg.telemetry import trace as trace_mod
 
-    bot, _, _ = make_bot([])
+    bot, _, counters = make_bot([])
     assert trace_mod.current() is None
 
     await bot._handle_platform_event(message_received_event(), FakeAdapter())
 
     assert trace_mod.current() is None
-    # A later record outside the ingress must not join the closed trace.
+    buffered = list(counters.records)
+    # A later record outside the ingres
```

**File**: `tests/unit_tests/platform/test_plugin_subscriptions.py` (modified, +2/-2)
```diff
@@ -33,14 +33,14 @@ async def test_slow_failed_and_duplicate_subscriptions_do_not_block_primary_rout
     started = []
     release = asyncio.Event()
 
-    async def subscriber(event, adapter, uuid):
+    async def subscriber(event, adapter, uuid, execution_id=None):
         started.append(uuid)
         if uuid == 'slow':
             await release.wait()
         if uuid == 'failed':
             raise ValueError('plugin error')
 
-    async def primary(event, adapter):
+    async def primary(event, adapter, execution_id=None):
         started.append('primary')
 
     bot._dispatch_plugin_subscription = subscriber
```

---

### Incident Patch 11: `923ebe12` (2026-10-01)
**Commit Message**: feat(telemetry): attach called platform APIs to their step node on execution traces

Every host step now opens a stage scope, so observations recorded inside it (including cross-task plugin/RPC calls resolved through the execution registry) carry the owning step as parent; the pipeline lane records its own pipeline/run node so acks and replies issued outside the runner still hang off a node.

**File**: `src/langbot/pkg/agent/runner/orchestrator.py` (modified, +132/-121)
```diff
@@ -38,6 +38,7 @@
 from .state_scope import build_state_context
 from ...provider.tools.loaders import skill as skill_loader
 from ...telemetry import trace as trace_mod
+from ...telemetry.execution import bind_trace as bind_execution_trace
 from ...telemetry.execution import close_trace as close_execution_trace
 from ...telemetry.execution import record as record_execution
 
@@ -213,13 +214,16 @@ async def run(
         terminal_reason: str | None = None
         terminal_usage: dict[str, typing.Any] | None = None
         execution_outcome = 'unknown'
+        execution_error = ''
         # A run reached without a platform ingress (WebUI debug, service API)
         # owns its own chain; a run inside an ingress reuses that chain.
         trace_binding: trace_mod.TraceBinding | None = None
         run_token: typing.Any = None
+        # Workflow step node for this run; '' until the step scope is opened.
+        node = ''
 
         try:
-            trace_binding = trace_mod.bind()
+            trace_binding = bind_execution_trace(self.ap, run_id)
             run_token = trace_mod.set_run(run_id)
             await self.journal.create_run(
                 event=event,
@@ -261,139 +265,140 @@ async def run(
                     event_log_id=event_log_id,
                 )
 
-            async with contextlib.aclosing(self.invoker.invoke(descriptor, context)) as results:
-                async for result_dict in results:
-                    result_dict = dict(result_dict)
-                    sequence = result_dict.get('sequence')
-                    if sequence is not None:
-                        try:
-                            sequence_int = int(sequence)
-                        except (TypeError, ValueError):
-                            self.ap.logger.warning(
-                                f'Runner {descriptor.id} returned invalid result sequence: {sequence}'
-                            )
-                            sequence_int = last_sequence + 1
-                            result_dict['sequence'] = sequence_int
-                        else:
-                            if sequence_int in seen_sequences:
+            with trace_mod.stage_scope() as node:
+                async with contextlib.aclosing(self.invoker.invoke(descriptor, context)) as results:
+                    async for result_dict in results:
+                        result_dict = dict(result_dict)
+                        sequence = result_dict.get('sequence')
+                        if sequence is not None:
+                            try:
+                                sequence_int = int(sequence)
+                            except (TypeError, ValueError):
                                 self.ap.logger.warning(
-                                    f'Runner {descriptor.id} returned duplicate result sequence '
-                                    f'{sequence_int} for run {run_id}; dropping duplicate'
-                                )
-                                continue
-                            if sequence_int <= 0:
-                                self.ap.logger.warning(
-                                    f'Runner {descriptor.id} returned non-positive result sequence '
-                                    f'{sequence_int} for run {run_id}'
+                                    f'Runner {descriptor.id} returned invalid result sequence: {sequence}'
                                 )
                                 sequence_int = last_sequence + 1
                                 result_dict['sequence'] = sequence_int
-                            elif last_sequence and sequence_int != last_sequence + 1:
-                                self.ap.logger.warning(
-                                    f'Runner {descriptor.id} result sequence gap or out-of-order '
-                                    f'for run {run_id}: previous={last_sequence}, current={sequence_int}'
-                                )
+                            else:
+                                if sequence_int in seen_sequences:
+                                    self.ap.logger.warning(
+                                        f'Runner {descriptor.id} returned duplicate result sequence '
+                                        f'{sequence_int} for run {run_id}; dropping duplicate'
+                                    )
+                                    continue
+                                if sequence_int <= 0:
+                                    self.ap.logger.warning(
+                                        f'Runner {descriptor.id} returned non-positive result sequence '
+                                        f'{sequence_int} for run {run_id}'
+                                    )
+                                    sequence_int = last_sequence + 1
+                                    result_dict['sequence'] = sequence_int
+                                elif last_sequence and sequence_int != last_sequence + 1:

```

**File**: `src/langbot/pkg/agent/runner/platform_tools.py` (modified, +62/-40)
```diff
@@ -684,49 +684,71 @@ async def execute_platform_tool(
     normalized = _normalize_platform_params(definition, parameters)
     if definition.scope == 'event':
         normalized = _event_params(definition, context, normalized)
-    # This flag is frozen by the Host from the synthetic debug envelope, not tool arguments.
-    if delivery.get('surface') == 'webui' and (delivery.get('platform_capabilities') or {}).get('debug_mock') is True:
-        result = _execute_mock_platform_tool(definition, context, normalized)
-        if message_chain is not None:
-            result['parameters']['message'] = message_chain.model_dump(mode='json')
-        from ...telemetry.execution import record
-
-        record(
-            ap,
-            execution_context,
-            family='platform_api',
-            operation=definition.api,
-            mode=authorization.get('processor_type', 'none'),
-            synthetic=True,
-            outcome='success',
-        )
-        return result
-    bot_id = authorization.get('bot_id')
-    if not bot_id:
-        raise ValueError('This run is not associated with a platform bot')
-    bot = await ap.platform_mgr.get_bot_by_uuid(execution_context, bot_id)
-    if bot is None:
-        raise ValueError(f'Bot {bot_id} is not running')
-    if definition.api not in set(bot.adapter.get_supported_apis() or []):
-        raise ValueError(f'Platform API {definition.api} is no longer supported by bot {bot_id}')
-    api_func = getattr(bot.adapter, definition.api, None)
-    if not callable(api_func):
-        raise ValueError(f'Platform API {definition.api} is declared but not implemented')
-    if definition.api == 'send_message':
-        normalized = {
-            'target_type': _require_string(normalized, 'target_type'),
-            'target_id': _require_string(normalized, 'target_id'),
-            'message': message_chain
-            if message_chain is not None
-            else platform_message.MessageChain([platform_message.Plain(text=_require_string(normalized, 'text'))]),
-        }
-    from ...telemetry.platform import processing_mode
+    # Plugin/RPC actions run outside the ingress context, so bind the owning
+    # execution id here: nested adapter observations then join its trace.
+    from ...telemetry.execution import record, reset_execution_id, set_execution_id
 
-    token = processing_mode.set(authorization.get('processor_type', 'none'))
+    execution_id = str(session.get('run_id') or '').strip()
+    execution_token = set_execution_id(execution_id)
     try:
-        return await api_func(**normalized)
+        # This flag is frozen by the Host from the synthetic debug envelope, not tool arguments.
+        mock = (
+            delivery.get('surface') == 'webui'
+            and (delivery.get('platform_capabilities') or {}).get('debug_mock') is True
+        )
+        if mock:
+            outcome = 'unknown'
+            error_detail = ''
+            try:
+                result = _execute_mock_platform_tool(definition, context, normalized)
+                if message_chain is not None:
+                    result['parameters']['message'] = message_chain.model_dump(mode='json')
+                outcome = 'success'
+            except Exception as exc:
+                outcome = 'failed'
+                error_detail = str(exc)
+                raise
+            finally:
+                record(
+                    ap,
+                    execution_context,
+                    family='platform_api',
+                    operation=definition.api,
+                    mode=authorization.get('processor_type', 'none'),
+                    synthetic=True,
+                    outcome=outcome,
+                    error=error_detail,
+                    execution_id=execution_id or None,
+                )
+            return result
+        bot_id = authorization.get('bot_id')
+        if not bot_id:
+            raise ValueError('This run is not associated with a platform bot')
+        bot = await ap.platform_mgr.get_bot_by_uuid(execution_context, bot_id)
+        if bot is None:
+            raise ValueError(f'Bot {bot_id} is not running')
+        if definition.api not in set(bot.adapter.get_supported_apis() or []):
+            raise ValueError(f'Platform API {definition.api} is no longer supported by bot {bot_id}')
+        api_func = getattr(bot.adapter, definition.api, None)
+        if not callable(api_func):
+            raise ValueError(f'Platform API {definition.api} is declared but not implemented')
+        if definition.api == 'send_message':
+            normalized = {
+                'target_type': _require_string(normalized, 'target_type'),
+                'target_id': _require_string(normalized, 'target_id'),
+                'message': message_chain
+                if message_chain is not None
+                else platform_message.MessageChain([platform_message.Plain(text=_require_string(normalized, 'text'))]),
+          
```

**File**: `src/langbot/pkg/pipeline/pipelinemgr.py` (modified, +94/-2)
```diff
@@ -3,6 +3,7 @@
 import dataclasses
 import typing
 import traceback
+import asyncio
 
 import sqlalchemy
 
@@ -257,6 +258,9 @@ async def _check_output(self, query: pipeline_query.Query, result: pipeline_enti
             self.ap.logger.error(result.error_notice)
             # Mark query as having error
             query.variables['_monitoring_has_error'] = True
+            # The lane reports failures as a value instead of raising, so record the
+            # reason here: without it the uploaded trace would not explain the break.
+            self._record_lane_failure(query, str(result.error_notice))
             # Record error to monitoring system
             try:
                 await self._assert_execution_active(query)
@@ -368,14 +372,59 @@ async def _execute_from_stage(
 
     async def process_query(self, query: pipeline_query.Query):
         from ..telemetry.execution import ingress
+        from ..telemetry.execution import record as record_execution
         from ..telemetry.platform import processing_mode
+        from ..telemetry.trace import stage_scope
 
         token = processing_mode.set('pipeline')
+        # The Workspace-scoped opaque query uuid is the execution identity Space
+        # shows for this lane; it is a stable UUID for every pooled query.
+        execution_id = str(getattr(query, 'query_uuid', '') or '').strip() or str(query.query_id)
         try:
             # Callers without a platform event (Webchat, HTTP API) still get one
             # trace for the whole Pipeline lane; nested calls reuse the trace.
-            with ingress(self.ap, 'pipeline_done'):
-                return await self._process_query(query)
+            with ingress(self.ap, 'pipeline_done', getattr(self, 'execution_context', None), execution_id=execution_id):
+                # The lane is its own workflow step: acknowledgements and replies it
+                # sends directly, and the runner it drives, hang under this node.
+                # When the lane runs under a platform route the node nests there.
+                with stage_scope() as node:
+                    lane_outcome = 'success'
+                    lane_error = ''
+                    try:
+                        return await self._process_query(query)
+                    except asyncio.CancelledError:
+                        lane_outcome = 'cancelled'
+                        lane_error = 'cancelled'
+                        raise
+                    except BaseException as exc:
+                        lane_outcome = 'failed'
+                        lane_error = str(exc) or type(exc).__name__
+                        raise
+                    finally:
+                        try:
+                            variables = getattr(query, 'variables', None) or {}
+                            lane_has_error = bool(variables.get('_monitoring_has_error'))
+                        except Exception:
+                            lane_has_error = False
+                        if lane_outcome == 'success' and lane_has_error:
+                            # The lane reported the failure as a value, not an exception.
+                            lane_outcome = 'failed'
+                        config = getattr(query, 'pipeline_config', None)
+                        try:
+                            runner_id = (RunnerConfigResolver.resolve_runner_id(config) or '') if config else ''
+                        except Exception:
+                            runner_id = ''
+                        record_execution(
+                            self.ap,
+                            getattr(self, 'execution_context', None),
+                            family='pipeline',
+                            operation='run',
+                            mode='pipeline',
+                            runner=runner_id,
+                            outcome=lane_outcome,
+                            error=lane_error,
+                            node=node,
+                        )
         finally:
             processing_mode.reset(token)
 
@@ -490,6 +539,9 @@ async def _process_query(self, query: pipeline_query.Query):
             inst_name = query.current_stage_name if query.current_stage_name else 'unknown'
             self.ap.logger.error(f'Error processing query {query.query_id} stage={inst_name} : {e}')
             self.ap.logger.error(f'Traceback: {traceback.format_exc()}')
+            # The lane itself broke: land the reason on the execution trace so the
+            # chain is uploaded even though the error never became a StageProcessResult.
+            self._record_lane_failure(query, str(e) or type(e).__name__)
 
             # Record query error
             try:
@@ -513,6 +565,46 @@ async def _process_query(self, query: pipeline_query.Query):
             self.ap.logger.debug(f'Query {query.query_id} processed')
             await self.ap.query_pool.remove_query(query)
 
+    def _record_lane_failure(self, query: pipeline_query.Q
```

**File**: `src/langbot/pkg/pipeline/process/handlers/chat.py` (modified, +34/-62)
```diff
@@ -3,8 +3,6 @@
 import uuid
 import typing
 import traceback
-import time
-from datetime import datetime
 
 
 from .. import handler
@@ -14,9 +12,7 @@
 import langbot_plugin.api.entities.events as events
 from ....agent.runner.config_resolver import RunnerConfigResolver
 from ....agent.runner import config_schema
-from ....utils import constants, runner as runner_utils
-from ....telemetry import features as telemetry_features
-from ....telemetry.identity import workspace_identity
+from ....utils import runner as runner_utils
 import langbot_plugin.api.entities.builtin.provider.session as provider_session
 import langbot_plugin.api.entities.builtin.pipeline.query as pipeline_query
 import langbot_plugin.api.entities.builtin.provider.message as provider_message
@@ -115,9 +111,6 @@ async def handle(
             text_length = 0
             runner = None
             try:
-                # Mark start time for telemetry
-                start_ts = time.time()
-
                 try_claim_steering = getattr(
                     self.ap.agent_run_orchestrator,
                     'try_claim_steering_from_query',
@@ -258,69 +251,48 @@ async def handle(
                     debug_notice=traceback.format_exc(),
                 )
             finally:
-                # Telemetry reporting
+                # Telemetry: the per-execution record is built when the owning
+                # trace closes, so only attach the execution-scoped fields this
+                # lane knows here.
                 try:
-                    end_ts = time.time()
-                    duration_ms = None
-                    if 'start_ts' in locals():
-                        duration_ms = int((end_ts - start_ts) * 1000)
+                    from ....telemetry.trace import current as current_trace
+
+                    state = current_trace()
+                    if state is not None:
+                        adapter_name = query.adapter.__class__.__name__ if hasattr(query, 'adapter') else ''
+                        runner_name = self.ap.agent_run_orchestrator.resolve_runner_id_for_telemetry(query)
+                        state.adapter = state.adapter or adapter_name
+                        state.runner = state.runner or (runner_name or '')
+                        state.runner_category = state.runner_category or runner_utils.get_runner_category_from_runner(
+                            runner_name, None, query.pipeline_config
+                        )
+                        model_name = ''
+                        try:
+                            if getattr(query, 'use_llm_model_uuid', None):
+                                m = await self.ap.model_mgr.get_model_by_uuid(
+                                    get_query_execution_context(query),
+                                    query.use_llm_model_uuid,
+                                )
+                                if m and getattr(m, 'model_entity', None):
+                                    model_name = getattr(m.model_entity, 'name', '') or ''
+                        except Exception:
+                            model_name = ''
+                        state.model_name = state.model_name or model_name
+                        if state.pipeline_plugins is None:
+                            state.pipeline_plugins = query.variables.get('_pipeline_bound_plugins', None)
+                except Exception as ex:
+                    self.ap.logger.warning(f'Failed to attach execution telemetry fields: {ex}')
 
+                # Trigger survey events on successful non-WebSocket responses
+                try:
                     adapter_name = query.adapter.__class__.__name__ if hasattr(query, 'adapter') else None
-
-                    # Use orchestrator to resolve runner ID for telemetry
-                    runner_name = self.ap.agent_run_orchestrator.resolve_runner_id_for_telemetry(query)
-
-                    # Model name if available
-                    model_name = None
-                    try:
-                        if getattr(query, 'use_llm_model_uuid', None):
-                            m = await self.ap.model_mgr.get_model_by_uuid(
-                                get_query_execution_context(query),
-                                query.use_llm_model_uuid,
-                            )
-                            if m and getattr(m, 'model_entity', None):
-                                model_name = getattr(m.model_entity, 'name', None)
-                    except Exception:
-                        model_name = None
-
-                    pipeline_plugins = query.variables.get('_pipeline_bound_plugins', None)
-
-                    runner_category = runner_utils.get_runner_category_from_runner(
-                        runner_name, None, query.pipeline_config
-                    )
-
-                    # Feature usage collected during query processing (tool calls,
-                    # knowledge base usage, sandbox executions, activated skil
```

**File**: `src/langbot/pkg/platform/botmgr.py` (modified, +111/-46)
```diff
@@ -401,15 +401,19 @@ async def _record_event_route_trace(
             from ..telemetry.execution import record
 
             with trace_mod.scope(route_ref=self._route_ref(binding, target_type, target_uuid)):
-                record(
-                    getattr(self, 'ap', None),
-                    getattr(self, 'execution_context', None),
-                    family='event_route',
-                    operation=event_type,
-                    adapter=type(getattr(self, 'adapter', None)).__name__,
-                    mode=target_type if target_type in {'pipeline', 'agent', 'event_processor'} else 'none',
-                    outcome={'delivered': 'success', 'failed': 'failed'}.get(status, 'skipped'),
-                )
+                # The routing decision is its own workflow step; the Pipeline or
+                # processor it delivers to hangs under this node.
+                with trace_mod.stage_scope() as node:
+                    record(
+                        getattr(self, 'ap', None),
+                        getattr(self, 'execution_context', None),
+                        family='event_route',
+                        operation=event_type,
+                        adapter=type(getattr(self, 'adapter', None)).__name__,
+                        mode=target_type if target_type in {'pipeline', 'agent', 'event_processor'} else 'none',
+                        outcome={'delivered': 'success', 'failed': 'failed'}.get(status, 'skipped'),
+                        node=node,
+                    )
         return metadata
 
     def get_pipeline_target_for_event_type(self, event_type: str = 'message.received') -> str | None:
@@ -736,12 +740,19 @@ def _eba_event_to_agent_envelope(
         self,
         event: platform_events.EBAEvent,
         adapter: abstract_platform_adapter.AbstractMessagePlatformAdapter,
+        execution_id: str | None = None,
     ) -> AgentEventEnvelope:
         event_type = getattr(event, 'type', None) or event.__class__.__name__
         event_time = getattr(event, 'timestamp', None) or time.time()
-        event_id = (
-            getattr(event, 'message_id', None) or getattr(event, 'feedback_id', None) or f'{event_type}:{uuid.uuid4()}'
-        )
+        if execution_id:
+            # Reuse the ingress execution identity so the run view, the journaled
+            # event and the uploaded chain all share one id.
+            envelope_event_id = str(execution_id)
+            prefix = f'platform:{self.bot_entity.uuid}:'
+            event_id = envelope_event_id[len(prefix) :] if envelope_event_id.startswith(prefix) else envelope_event_id
+        else:
+            event_id = self._platform_event_raw_id(event)
+            envelope_event_id = f'platform:{self.bot_entity.uuid}:{event_id}'
         target_type, target_id, target_metadata = self._infer_reply_target(event)
         supported_apis = self._get_adapter_supported_apis(adapter)
 
@@ -773,7 +784,7 @@ def _eba_event_to_agent_envelope(
             delivery_data['interactions'] = interaction_capabilities
 
         return AgentEventEnvelope(
-            event_id=f'platform:{self.bot_entity.uuid}:{event_id}',
+            event_id=envelope_event_id,
             event_type=event_type,
             event_time=int(event_time) if isinstance(event_time, (int, float)) else None,
             source='platform',
@@ -863,58 +874,107 @@ def _agent_product_to_binding(
             processor_id=agent.get('uuid'),
         )
 
+    def _platform_event_execution_id(self, event: platform_events.EBAEvent) -> str:
+        """Space-visible execution identity for one inbound platform event.
+
+        Matches the ``AgentEventEnvelope.event_id`` the same event produces, so
+        the stored chain and the Space run view share one identity.
+        """
+        return f'platform:{self.bot_entity.uuid}:{self._platform_event_raw_id(event)}'
+
+    @staticmethod
+    def _platform_event_raw_id(event: platform_events.EBAEvent) -> str:
+        event_type = getattr(event, 'type', None) or event.__class__.__name__
+        return str(
+            getattr(event, 'message_id', None) or getattr(event, 'feedback_id', None) or f'{event_type}:{uuid.uuid4()}'
+        )
+
     async def _handle_platform_event(
         self,
         event: platform_events.EBAEvent,
         adapter: abstract_platform_adapter.AbstractMessagePlatformAdapter,
     ) -> None:
         # One inbound event owns one execution trace; every stage recorded while
         # it is handled (routing, runner, platform API calls) joins that trace.
+        from ..telemetry import trace as trace_mod
         from ..telemetry.execution import ingress
 
         event.bot_uuid = self.bot_entity.uuid
-        with ingress(getattr(self, 'ap', None), 'event_done'):
-            await self._handle_platform_event_body(event, adapter)
+        execution_id = self._platform_event_execution_id(event)
+        with ingress(getattr(self, 'ap', None), 'event_done', getattr(self
```

**File**: `src/langbot/pkg/telemetry/execution.py` (modified, +316/-138)
```diff
@@ -1,34 +1,33 @@
-"""Bounded, content-free execution counters for the existing telemetry sender.
+"""Content-free execution records for the existing telemetry sender.
 
 This module reports observations only. Coverage catalogs and acceptance rules
-belong to Space. Aggregation keys include both immutable execution identities.
-
-Two shapes share one payload type:
-
-* window counters, aggregated by ``(family, operation, mode, adapter, runner,
-  outcome, synthetic)`` — unchanged coverage reporting;
-* per-event traces, one bounded payload per traced event, keyed by
-  ``query_id = trace_id`` so Space can fetch a whole chain by primary identity.
-
-Traces are additive: they never alter the counters, and both are bounded in
-memory, batch size and send concurrency.
+belong to Space.
+
+One complete execution is one record: the execution identity (Pipeline query,
+inbound platform event or Agent run), its bounded ordered stages and its
+terminal outcome. Nothing is aggregated or counted across executions — every
+record carries the id of the execution it belongs to, so Space can fetch the
+whole chain by primary identity. Records are buffered whole and flushed as
+``{"records": [...]}`` on the configured cadence and on shutdown; an in-flight
+trace is never flushed half-written.
+
+Memory is bounded in stages per trace, buffered traces, buffered records, the
+cross-task execution registry and flush batch size.
 """
 
 from __future__ import annotations
 
 import asyncio
 import contextlib
+import contextvars
+import json
 import time
 from datetime import datetime, timezone
-from uuid import uuid4
 
 from . import trace as trace_mod
 from .identity import workspace_identity
 from .trace import TraceState
 
-MAX_KEYS = 512
-MAX_BATCH = 32
-FLUSH_SECONDS = 60
 MODES = frozenset({'pipeline', 'agent', 'event_processor', 'none'})
 OUTCOMES = frozenset({'success', 'failed', 'cancelled', 'timeout', 'skipped', 'unknown'})
 
@@ -39,15 +38,70 @@
 DEFAULT_TRACE_MODE = 'sampled'
 DEFAULT_TRACE_SAMPLE = 20
 
+# Record bounds: buffered records, one flush batch, flush cadence, registry.
+MAX_BUFFERED_RECORDS = 512
+MAX_RECORDS_PER_FLUSH = 128
+MAX_FLUSH_BYTES = 200 * 1024
+DEFAULT_FLUSH_SECONDS = 180
+MAX_REGISTRY_KEYS = 256
+
+# Set by cross-task call sites (plugin/RPC actions) that run without the
+# ingress context but know which execution they belong to.
+_execution_id: contextvars.ContextVar[str] = contextvars.ContextVar('telemetry_execution_id', default='')
+
+
+def set_execution_id(execution_id: str) -> contextvars.Token:
+    return _execution_id.set(str(execution_id or '').strip())
+
+
+def reset_execution_id(token: contextvars.Token | None) -> None:
+    if token is None:
+        return
+    try:
+        _execution_id.reset(token)
+    except (ValueError, RuntimeError):
+        # A token from another context must never break execution.
+        pass
+
+
+def current_execution_id() -> str:
+    return _execution_id.get()
+
+
+def _bounded_error(value, limit: int = 400) -> str:
+    """Bound and de-fang one failure detail before it leaves the process.
+
+    Error text is operator-facing: keep it single-line, printable and short so a
+    noisy failure cannot smuggle control characters or bloat the payload.
+    """
+    if value is None:
+        return ''
+    text = ''.join(ch if ch.isprintable() else ' ' for ch in str(value))
+    text = ' '.join(text.split())
+    return text[:limit]
+
+
+def _duration_ms(started_at: str, ended_at: str) -> int:
+    """Wall-clock duration of one execution; 0 when the interval is unusable."""
+    try:
+        delta = datetime.fromisoformat(ended_at) - datetime.fromisoformat(started_at)
+        return max(int(delta.total_seconds() * 1000), 0)
+    except Exception:
+        return 0
+
 
 class ExecutionCounters:
     def __init__(self, manager):
         self.manager = manager
-        self.pending: dict[tuple, dict] = {}
+        self.records: list[dict] = []
         self.task: asyncio.Task | None = None
         self.dropped = 0
         self.traces: dict[str, TraceState] = {}
         self.trace_deadlines: dict[str, float] = {}
+        # Execution identity -> in-flight trace, for stages recorded by tasks
+        # that no longer share the ingress context (plugin/RPC platform calls).
+        self.registry: dict[str, TraceState] = {}
+        self.registry_deadlines: dict[str, float] = {}
         self.dropped_traces = 0
 
     # ------------------------------------------------------------------ config
@@ -63,6 +117,13 @@ def trace_sample(self) -> int:
             sample = DEFAULT_TRACE_SAMPLE
         return sample if 1 <= sample <= 100000 else DEFAULT_TRACE_SAMPLE
 
+    def flush_seconds(self) -> int:
+        try:
+            seconds = int(self.manager.telemetry_config.get('telemetry_flush_seconds', DEFAULT_FLUSH_SECONDS))
+        except (TypeError, ValueError):
+            seconds = DEFAULT_FLUSH_SECONDS
+        return seconds if 1 <= seconds <= 86400 else DE
```

**File**: `src/langbot/pkg/telemetry/platform.py` (modified, +24/-2)
```diff
@@ -11,6 +11,21 @@
 processing_mode: ContextVar[str] = ContextVar('telemetry_processing_mode', default='none')
 
 
+def result_failure_detail(result) -> str:
+    """Pull a bounded human-readable reason out of a failed platform API result."""
+    raw = getattr(result, 'raw', result)
+    if isinstance(raw, dict):
+        for key in ('error', 'message', 'msg', 'detail', 'reason'):
+            value = raw.get(key)
+            if isinstance(value, str) and value.strip():
+                return value
+            if isinstance(value, dict):
+                for inner in ('message', 'msg', 'detail'):
+                    if isinstance(value.get(inner), str) and value[inner].strip():
+                        return value[inner]
+    return ''
+
+
 def result_outcome(result):
     # Empty returns do not prove a remote operation succeeded.
     if result is None:
@@ -69,18 +84,24 @@ async def wrapped(*args, **kwargs):
                     if action in declared:
                         observed_operation = action
                 outcome = 'unknown'
+                error_detail = ''
                 try:
                     result = await method(*args, **kwargs)
                     outcome = result_outcome(result)
+                    if outcome != 'success':
+                        error_detail = result_failure_detail(result)
                     return result
                 except asyncio.CancelledError:
                     outcome = 'cancelled'
+                    error_detail = 'cancelled'
                     raise
-                except TimeoutError:
+                except TimeoutError as exc:
                     outcome = 'timeout'
+                    error_detail = str(exc) or 'timeout'
                     raise
-                except Exception:
+                except Exception as exc:
                     outcome = 'failed'
+                    error_detail = str(exc)
                     raise
                 finally:
                     record(
@@ -91,6 +112,7 @@ async def wrapped(*args, **kwargs):
                         adapter=adapter.__class__.__name__,
                         mode=processing_mode.get(),
                         outcome=outcome,
+                        error=error_detail,
                     )
 
             return wrapped
```

**File**: `src/langbot/pkg/telemetry/trace.py` (modified, +136/-30)
```diff
@@ -1,9 +1,11 @@
-"""Content-free per-event execution traces.
+"""Content-free per-execution traces.
 
-One trace identity is minted per inbound platform event and survives until the
-ingress handler returns. Stage records appended under it describe how that one
-event was routed and processed, using only code-defined identifiers. Nothing
-here is aggregated: a trace is a bounded, ordered sequence for one event.
+One trace identity is one execution identity: the id a Pipeline query, inbound
+platform event or Agent run is known by, so a stored chain can be joined with
+the Space view of that same execution. Stage records appended under it describe
+how that one execution was routed and processed, using only code-defined
+identifiers. Nothing here is aggregated: a trace is a bounded, ordered sequence
+for one execution.
 
 Three bounds keep memory independent of traffic volume:
 
@@ -12,7 +14,9 @@
 * a wall-clock TTL, enforced by the sender's sweep.
 
 The identity itself lives in a ContextVar so that asynchronous work spawned
-while handling one event inherits it, mirroring ``telemetry.platform``.
+while handling one execution inherits it, mirroring ``telemetry.platform``.
+Cross-task stages (plugin/RPC work with no inherited context) are resolved by
+the owner's execution-id registry instead.
 """
 
 from __future__ import annotations
@@ -28,36 +32,66 @@
 _current: contextvars.ContextVar['TraceState | None'] = contextvars.ContextVar('telemetry_trace', default=None)
 _route: contextvars.ContextVar[str] = contextvars.ContextVar('telemetry_trace_route', default='')
 _run: contextvars.ContextVar[str] = contextvars.ContextVar('telemetry_trace_run', default='')
+# Open workflow step nodes, innermost last. Records emitted inside a step carry
+# the innermost node as their ``parent``; the step's own record carries the one
+# below it (its enclosing step), never itself.
+_node: contextvars.ContextVar[tuple[str, ...]] = contextvars.ContextVar('telemetry_trace_node', default=())
 
 
 def _now() -> str:
     return datetime.now(timezone.utc).isoformat()
 
 
 class TraceState:
-    """Bounded stage buffer for exactly one event."""
+    """Bounded stage buffer for exactly one execution."""
 
     __slots__ = (
         'trace_id',
+        'execution_id',
         'started_at',
         'stages',
         'dropped_stages',
         'synthetic',
         'sequence',
+        'node_sequence',
+        'open_nodes',
         'identity',
         'abandoned',
+        'failure_reason',
+        'closed',
+        'adapter',
+        'runner',
+        'runner_category',
+        'model_name',
+        'pipeline_plugins',
     )
 
-    def __init__(self) -> None:
-        self.trace_id = str(uuid4())
+    def __init__(self, execution_id: str | None = None) -> None:
+        # The execution identity is the trace identity so a stored chain can be
+        # joined to the Space view of that same Pipeline query / event / run.
+        self.execution_id = str(execution_id).strip() if execution_id else ''
+        self.trace_id = self.execution_id or str(uuid4())
         self.started_at = _now()
         self.stages: list[dict[str, typing.Any]] = []
         self.dropped_stages = 0
         self.synthetic = False
         self.sequence = 0
+        # Node ids number the workflow steps of this one execution ("n1", "n2"...).
+        self.node_sequence = 0
+        # Mirror of the open step stack, readable from any task: cross-task
+        # observations (plugin/RPC) resolve their parent through this.
+        self.open_nodes: tuple[str, ...] = ()
         self.identity: dict[str, str] = {}
         # Set when the sender refused to buffer this trace: stop appending.
         self.abandoned = False
+        self.failure_reason = ''
+        self.closed = False
+        # Execution-scoped record fields attached by the owning lane when known.
+        self.adapter = ''
+        self.runner = ''
+        self.runner_category = ''
+        self.model_name = ''
+        self.pipeline_plugins: typing.Any = None
 
     def append(
         self,
@@ -69,34 +103,62 @@ def append(
         runner: str,
         outcome: str,
         synthetic: bool,
+        error: str = '',
+        node: str = '',
+        parent: str = '',
     ) -> None:
         if len(self.stages) >= MAX_STAGES:
             self.dropped_stages += 1
             return
         seen = _now()
-        self.stages.append(
-            {
-                'family': family,
-                'operation': operation,
-                'mode': mode,
-                'adapter': adapter,
-                'runner': runner,
-                'outcome': outcome,
-                'synthetic': bool(synthetic),
-                'seq': self.sequence,
-                'route_ref': _route.get(),
-                'run_id': _run.get(),
-                'first_seen': seen,
-                'last_seen': seen,
-            }
-        )
+        entry = {
+            'family': family,
+        
```

---

### Incident Patch 12: `df64f83e` (2026-09-30)
**Commit Message**: fix(telemetry): schedule the trace payload send instead of dropping it

close_trace() called the coroutine TelemetryManager.start_send_task without
awaiting or scheduling it, so every payload closed on that path was silently
dropped and the runtime logged "coroutine ... was never awaited". The only
other caller awaits it correctly, so both call styles stay supported: call the
manager, schedule the returned coroutine on the running loop, and close it with
a debug log when no loop is available.

Regression case added in tests/unit_tests/telemetry/test_trace.py: it fails
before this change (payload never delivered) and passes after.

**File**: `src/langbot/pkg/telemetry/execution.py` (modified, +19/-1)
```diff
@@ -167,10 +167,28 @@ def close_trace(self, state: TraceState, reason: str = 'event_done') -> None:
                 return
             payload = self._build_trace_payload(state, reason)
             if payload is not None:
-                self.manager.start_send_task(payload)
+                self._dispatch_payload(payload)
         except Exception:
             return
 
+    def _dispatch_payload(self, payload: dict) -> None:
+        """Hand one built payload to the telemetry manager from this sync context.
+
+        TelemetryManager.start_send_task is a coroutine, so calling it without
+        scheduling dropped every trace closed here. Stand-ins used by tests and
+        manual tools schedule synchronously, hence the coroutine check.
+        """
+        result = self.manager.start_send_task(payload)
+        if not asyncio.iscoroutine(result):
+            return
+        try:
+            asyncio.get_running_loop().create_task(result)
+        except RuntimeError:
+            result.close()
+            logger = getattr(getattr(self.manager, 'ap', None), 'logger', None)
+            if logger is not None:
+                logger.debug('Execution trace payload dropped: no running event loop')
+
     def _trace_emitted(self, state: TraceState) -> bool:
         mode = self.trace_mode()
         if mode == 'off':
```

**File**: `tests/unit_tests/telemetry/test_trace.py` (modified, +25/-0)
```diff
@@ -344,3 +344,28 @@ def test_ingress_without_telemetry_is_a_no_op(self):
         _, execution = get_modules()
         with execution.ingress(types.SimpleNamespace(), 'event_done'):
             pass
+
+
+class AsyncSendManager(FakeManager):
+    """Stand-in whose start_send_task is a coroutine, like TelemetryManager."""
+
+    async def start_send_task(self, payload: dict) -> None:
+        self.sent.append(payload)
+
+
+class TestTraceDispatch:
+    async def test_close_trace_schedules_the_coroutine_send(self):
+        trace, execution = get_modules()
+        manager = AsyncSendManager(trace_config())
+        counters = execution.ExecutionCounters(manager)
+        binding = trace.bind()
+        try:
+            counters.record(CONTEXT, **STAGE)
+            counters.close_trace(binding.state, 'event_done')
+            # The payload is only delivered once the scheduled task runs.
+            assert manager.sent == []
+            await asyncio.sleep(0)
+        finally:
+            trace.unbind_root(binding)
+        assert len(manager.sent) == 1
+        assert manager.sent[0]['event_type'] == 'feature_execution'
```

---

### Incident Patch 13: `0efc1fb1` (2026-09-30)
**Commit Message**: feat(telemetry): trace one inbound event end to end

Execution telemetry already reported window counters. This adds one bounded,
content-free chain per inbound platform event, so a single event can be
followed from its source platform through routing and processing to the
platform API calls it caused.

- telemetry/trace.py: ContextVar trace identity with route and run scopes, and
  a 32-stage bound per chain.
- telemetry/execution.py: keeps at most 64 chains for 120s, decides sampling
  from the observed outcome, and sends one payload per chain keyed by
  query_id = trace_id, so Space fetches a chain by primary identity. Window
  counters are unchanged and remain the source of coverage statistics.
- botmgr / pipelinemgr / orchestrator: bind the trace at the ingress boundary,
  scope routing identity per dispatch, and attach the run identity, so nested
  lanes (event -> route -> pipeline/runner -> platform API) reuse one chain. A
  run reached without an ingress (WebUI debug, service API) owns its own chain.
- space.execution_trace selects off | failures | sampled | all (default
  sampled: failures, WebUI debug runs and every N-th success).

Chains carry only code-defined identifie

**File**: `src/langbot/pkg/agent/runner/orchestrator.py` (modified, +11/-0)
```diff
@@ -37,6 +37,8 @@
 from .session_registry import AgentRunSessionRegistry, get_session_registry
 from .state_scope import build_state_context
 from ...provider.tools.loaders import skill as skill_loader
+from ...telemetry import trace as trace_mod
+from ...telemetry.execution import close_trace as close_execution_trace
 from ...telemetry.execution import record as record_execution
 
 
@@ -211,8 +213,14 @@ async def run(
         terminal_reason: str | None = None
         terminal_usage: dict[str, typing.Any] | None = None
         execution_outcome = 'unknown'
+        # A run reached without a platform ingress (WebUI debug, service API)
+        # owns its own chain; a run inside an ingress reuses that chain.
+        trace_binding: trace_mod.TraceBinding | None = None
+        run_token: typing.Any = None
 
         try:
+            trace_binding = trace_mod.bind()
+            run_token = trace_mod.set_run(run_id)
             await self.journal.create_run(
                 event=event,
                 binding=binding,
@@ -419,6 +427,9 @@ async def run(
                 outcome=execution_outcome,
                 synthetic=event.source == 'webui',
             )
+            trace_mod.reset_run(run_token)
+            if trace_binding is not None and trace_mod.unbind_root(trace_binding):
+                close_execution_trace(self.ap, trace_binding.state, 'runner_done')
             binding_box = getattr(execution_query, '_box_binding', None)
             if binding_box is not None and binding_box.run_id == run_id:
                 object.__delattr__(execution_query, '_box_binding')
```

**File**: `src/langbot/pkg/pipeline/pipelinemgr.py` (modified, +5/-1)
```diff
@@ -367,11 +367,15 @@ async def _execute_from_stage(
             i += 1
 
     async def process_query(self, query: pipeline_query.Query):
+        from ..telemetry.execution import ingress
         from ..telemetry.platform import processing_mode
 
         token = processing_mode.set('pipeline')
         try:
-            return await self._process_query(query)
+            # Callers without a platform event (Webchat, HTTP API) still get one
+            # trace for the whole Pipeline lane; nested calls reuse the trace.
+            with ingress(self.ap, 'pipeline_done'):
+                return await self._process_query(query)
         finally:
             processing_mode.reset(token)
 
```

**File**: `src/langbot/pkg/platform/botmgr.py` (modified, +71/-32)
```diff
@@ -352,6 +352,20 @@ def diagnose_eba_event_binding(
         """Return the selected event binding plus per-binding diagnostic steps."""
         return self._evaluate_eba_event_bindings(self._get_event_bindings(), event, event_type)
 
+    @staticmethod
+    def _route_ref(
+        binding: dict | None,
+        target_type: str | None = None,
+        target_uuid: str | None = None,
+    ) -> str:
+        """Code-defined route identity for telemetry; never a user-facing name."""
+        binding = binding or {}
+        kind = str(target_type or binding.get('target_type') or '').strip()
+        target = str(target_uuid or binding.get('target_uuid') or '').strip()
+        if not kind or not target:
+            return ''
+        return f'{kind}:{target}'[:160]
+
     async def _record_event_route_trace(
         self,
         *,
@@ -383,17 +397,19 @@ async def _record_event_route_trace(
         log_method = getattr(self.logger, level, self.logger.info)
         await log_method(text, metadata=metadata)
         if status in {'delivered', 'failed', 'discarded', 'not_matched'}:
+            from ..telemetry import trace as trace_mod
             from ..telemetry.execution import record
 
-            record(
-                getattr(self, 'ap', None),
-                getattr(self, 'execution_context', None),
-                family='event_route',
-                operation=event_type,
-                adapter=type(getattr(self, 'adapter', None)).__name__,
-                mode=target_type if target_type in {'pipeline', 'agent', 'event_processor'} else 'none',
-                outcome={'delivered': 'success', 'failed': 'failed'}.get(status, 'skipped'),
-            )
+            with trace_mod.scope(route_ref=self._route_ref(binding, target_type, target_uuid)):
+                record(
+                    getattr(self, 'ap', None),
+                    getattr(self, 'execution_context', None),
+                    family='event_route',
+                    operation=event_type,
+                    adapter=type(getattr(self, 'adapter', None)).__name__,
+                    mode=target_type if target_type in {'pipeline', 'agent', 'event_processor'} else 'none',
+                    outcome={'delivered': 'success', 'failed': 'failed'}.get(status, 'skipped'),
+                )
         return metadata
 
     def get_pipeline_target_for_event_type(self, event_type: str = 'message.received') -> str | None:
@@ -852,7 +868,19 @@ async def _handle_platform_event(
         event: platform_events.EBAEvent,
         adapter: abstract_platform_adapter.AbstractMessagePlatformAdapter,
     ) -> None:
+        # One inbound event owns one execution trace; every stage recorded while
+        # it is handled (routing, runner, platform API calls) joins that trace.
+        from ..telemetry.execution import ingress
+
         event.bot_uuid = self.bot_entity.uuid
+        with ingress(getattr(self, 'ap', None), 'event_done'):
+            await self._handle_platform_event_body(event, adapter)
+
+    async def _handle_platform_event_body(
+        self,
+        event: platform_events.EBAEvent,
+        adapter: abstract_platform_adapter.AbstractMessagePlatformAdapter,
+    ) -> None:
         from ..telemetry.execution import record
 
         record(
@@ -951,12 +979,15 @@ async def _dispatch_eba_event_to_processor(
         )
         if target_type == 'discard':
             if isinstance(event, platform_events.MessageReceivedEvent):
-                await self._dispatch_eba_message_to_pipeline(
-                    event,
-                    adapter,
-                    pipeline_uuid=self.PIPELINE_DISCARD,
-                    routed_by_event_binding=True,
-                )
+                from ..telemetry import trace as trace_mod
+
+                with trace_mod.scope(route_ref=self._route_ref(event_binding)):
+                    await self._dispatch_eba_message_to_pipeline(
+                        event,
+                        adapter,
+                        pipeline_uuid=self.PIPELINE_DISCARD,
+                        routed_by_event_binding=True,
+                    )
                 return await self._record_event_route_trace(
                     event_type=event_type,
                     status='discarded',
@@ -984,12 +1015,17 @@ async def _dispatch_eba_event_to_processor(
                     reason='Pipeline targets only support message events',
                     text=f'Event {event_type} ignored Pipeline target for non-message event',
                 )
-            await self._dispatch_eba_message_to_pipeline(
-                event,
-                adapter,
-                pipeline_uuid=event_binding.get('target_uuid'),
-                routed_by_event_binding=True,
-            )
+            from ..telemetry import trace as trace_mod
+
+            with trace_mod.scope(
+                route_ref=self._route_ref(event_binding, target_type, event_binding.get('target_uuid'))
+      
```

**File**: `src/langbot/pkg/telemetry/execution.py` (modified, +195/-5)
```diff
@@ -2,29 +2,68 @@
 
 This module reports observations only. Coverage catalogs and acceptance rules
 belong to Space. Aggregation keys include both immutable execution identities.
+
+Two shapes share one payload type:
+
+* window counters, aggregated by ``(family, operation, mode, adapter, runner,
+  outcome, synthetic)`` — unchanged coverage reporting;
+* per-event traces, one bounded payload per traced event, keyed by
+  ``query_id = trace_id`` so Space can fetch a whole chain by primary identity.
+
+Traces are additive: they never alter the counters, and both are bounded in
+memory, batch size and send concurrency.
 """
 
 from __future__ import annotations
 
 import asyncio
+import contextlib
+import time
 from datetime import datetime, timezone
 from uuid import uuid4
 
+from . import trace as trace_mod
 from .identity import workspace_identity
+from .trace import TraceState
 
 MAX_KEYS = 512
 MAX_BATCH = 32
 FLUSH_SECONDS = 60
 MODES = frozenset({'pipeline', 'agent', 'event_processor', 'none'})
 OUTCOMES = frozenset({'success', 'failed', 'cancelled', 'timeout', 'skipped', 'unknown'})
 
+# Trace bounds: stages per trace, traces buffered per process, trace lifetime.
+MAX_TRACES = 64
+TRACE_TTL_SECONDS = 120
+TRACE_MODES = frozenset({'off', 'failures', 'sampled', 'all'})
+DEFAULT_TRACE_MODE = 'sampled'
+DEFAULT_TRACE_SAMPLE = 20
+
 
 class ExecutionCounters:
     def __init__(self, manager):
         self.manager = manager
         self.pending: dict[tuple, dict] = {}
         self.task: asyncio.Task | None = None
         self.dropped = 0
+        self.traces: dict[str, TraceState] = {}
+        self.trace_deadlines: dict[str, float] = {}
+        self.dropped_traces = 0
+
+    # ------------------------------------------------------------------ config
+
+    def trace_mode(self) -> str:
+        mode = str(self.manager.telemetry_config.get('execution_trace', DEFAULT_TRACE_MODE) or '').strip().lower()
+        return mode if mode in TRACE_MODES else DEFAULT_TRACE_MODE
+
+    def trace_sample(self) -> int:
+        try:
+            sample = int(self.manager.telemetry_config.get('execution_trace_sample', DEFAULT_TRACE_SAMPLE))
+        except (TypeError, ValueError):
+            sample = DEFAULT_TRACE_SAMPLE
+        return sample if 1 <= sample <= 100000 else DEFAULT_TRACE_SAMPLE
+
+    # --------------------------------------------------------------- recording
 
     def record(
         self,
@@ -50,6 +89,19 @@ def record(
             if any(not isinstance(v, str) or len(v) > 160 for v in (operation, adapter, runner)):
                 return
             identity = workspace_identity(context)
+            state = trace_mod.current()
+            if state is not None:
+                self._record_trace_stage(
+                    state,
+                    identity=identity,
+                    family=family,
+                    operation=operation,
+                    mode=mode,
+                    adapter=adapter,
+                    runner=runner,
+                    outcome=outcome,
+                    synthetic=synthetic,
+                )
             key = (
                 identity['instance_id'],
                 identity['workspace_uuid'],
@@ -70,16 +122,124 @@ def record(
                 self.pending[key] = row
             row['count'] = min(row['count'] + 1, 2147483647)
             row['last_seen'] = datetime.now(timezone.utc).isoformat()
-            if self.task is None or self.task.done():
-                self.task = asyncio.create_task(self._loop())
+            self._ensure_loop()
         except Exception:
             # Observability must never change execution behavior.
             return
 
+    def _record_trace_stage(
+        self, state: TraceState, *, identity, family, operation, mode, adapter, runner, outcome, synthetic
+    ) -> None:
+        if state.abandoned:
+            return
+        if state.trace_id not in self.traces:
+            # Never buffer traces this configuration would discard anyway.
+            if self.trace_mode() == 'off' or len(self.traces) >= MAX_TRACES:
+                self.dropped += 1
+                state.abandoned = True
+                return
+            self.traces[state.trace_id] = state
+            self.trace_deadlines[state.trace_id] = time.monotonic() + TRACE_TTL_SECONDS
+            state.identity = identity
+        state.append(
+            family=family,
+            operation=operation,
+            mode=mode,
+            adapter=adapter,
+            runner=runner,
+            outcome=outcome,
+            synthetic=bool(synthetic),
+        )
+
+    def _ensure_loop(self) -> None:
+        if self.task is None or self.task.done():
+            self.task = asyncio.create_task(self._loop())
+
+    # ------------------------------------------------------------------ traces
+
+    def close_trace(self, state: TraceState, reason: str = 'event_done') -> None:
+        """Emit one trace payload when it matches the
```

**File**: `src/langbot/pkg/telemetry/trace.py` (added, +166/-0)
```diff
@@ -0,0 +1,166 @@
+"""Content-free per-event execution traces.
+
+One trace identity is minted per inbound platform event and survives until the
+ingress handler returns. Stage records appended under it describe how that one
+event was routed and processed, using only code-defined identifiers. Nothing
+here is aggregated: a trace is a bounded, ordered sequence for one event.
+
+Three bounds keep memory independent of traffic volume:
+
+* ``MAX_STAGES`` stages per trace (further stages are counted, not kept);
+* ``MAX_TRACES`` traces in flight, enforced by the sender that owns the buffer;
+* a wall-clock TTL, enforced by the sender's sweep.
+
+The identity itself lives in a ContextVar so that asynchronous work spawned
+while handling one event inherits it, mirroring ``telemetry.platform``.
+"""
+
+from __future__ import annotations
+
+import contextlib
+import contextvars
+import typing
+from datetime import datetime, timezone
+from uuid import uuid4
+
+MAX_STAGES = 32
+
+_current: contextvars.ContextVar['TraceState | None'] = contextvars.ContextVar('telemetry_trace', default=None)
+_route: contextvars.ContextVar[str] = contextvars.ContextVar('telemetry_trace_route', default='')
+_run: contextvars.ContextVar[str] = contextvars.ContextVar('telemetry_trace_run', default='')
+
+
+def _now() -> str:
+    return datetime.now(timezone.utc).isoformat()
+
+
+class TraceState:
+    """Bounded stage buffer for exactly one event."""
+
+    __slots__ = (
+        'trace_id',
+        'started_at',
+        'stages',
+        'dropped_stages',
+        'synthetic',
+        'sequence',
+        'identity',
+        'abandoned',
+    )
+
+    def __init__(self) -> None:
+        self.trace_id = str(uuid4())
+        self.started_at = _now()
+        self.stages: list[dict[str, typing.Any]] = []
+        self.dropped_stages = 0
+        self.synthetic = False
+        self.sequence = 0
+        self.identity: dict[str, str] = {}
+        # Set when the sender refused to buffer this trace: stop appending.
+        self.abandoned = False
+
+    def append(
+        self,
+        *,
+        family: str,
+        operation: str,
+        mode: str,
+        adapter: str,
+        runner: str,
+        outcome: str,
+        synthetic: bool,
+    ) -> None:
+        if len(self.stages) >= MAX_STAGES:
+            self.dropped_stages += 1
+            return
+        seen = _now()
+        self.stages.append(
+            {
+                'family': family,
+                'operation': operation,
+                'mode': mode,
+                'adapter': adapter,
+                'runner': runner,
+                'outcome': outcome,
+                'synthetic': bool(synthetic),
+                'seq': self.sequence,
+                'route_ref': _route.get(),
+                'run_id': _run.get(),
+                'first_seen': seen,
+                'last_seen': seen,
+            }
+        )
+        self.sequence += 1
+        if synthetic:
+            self.synthetic = True
+
+    def outcome(self) -> str:
+        """Terminal outcome of the last recorded stage, for space-side display."""
+        return self.stages[-1]['outcome'] if self.stages else 'unknown'
+
+
+class TraceBinding(typing.NamedTuple):
+    state: TraceState
+    created: bool
+    token: typing.Any
+
+
+def bind() -> TraceBinding:
+    """Start a trace unless one is already in flight in this context."""
+    existing = _current.get()
+    if existing is not None:
+        return TraceBinding(existing, False, None)
+    state = TraceState()
+    return TraceBinding(state, True, _current.set(state))
+
+
+def unbind(binding: TraceBinding) -> bool:
+    """Detach this binding. Returns True when this caller owns the trace."""
+    if binding.token is not None:
+        try:
+            _current.reset(binding.token)
+        except (ValueError, RuntimeError):
+            # A token from another context must never break execution.
+            pass
+    return binding.created
+
+
+def unbind_root(binding: TraceBinding) -> bool:
+    """Detach only when this caller started the trace, else leave it in place."""
+    if not binding.created:
+        return False
+    return unbind(binding)
+
+
+def current() -> TraceState | None:
+    return _current.get()
+
+
+def set_run(run_id: str) -> typing.Any:
+    return _run.set(run_id)
+
+
+def reset_run(token: typing.Any) -> None:
+    if token is None:
+        return
+    try:
+        _run.reset(token)
+    except (ValueError, RuntimeError):
+        # A token from another context must never break execution.
+        pass
+
+
+@contextlib.contextmanager
+def scope(*, route_ref: str | None = None) -> typing.Iterator[None]:
+    """Pin routing identity for stages recorded inside this block."""
+    if not route_ref:
+        yield
+        return
+    token = _route.set(route_ref)
+    try:
+        yield
+    finally:
+        try:
+            _route.reset(token)
+        except (ValueError, RuntimeError):
+   
```

**File**: `src/langbot/templates/config.yaml` (modified, +5/-0)
```diff
@@ -429,3 +429,8 @@ space:
     # Optional telemetry is enabled by default. Set true to disable usage,
     # heartbeat and execution reporting; restart after changing this setting.
     disable_telemetry: false
+    # Per-event execution traces: off | failures | sampled | all.
+    # 'sampled' keeps every failed run plus every N-th successful one
+    # (N is execution_trace_sample) and always keeps WebUI debug runs.
+    execution_trace: sampled
+    execution_trace_sample: 20
```

**File**: `tests/manual/dump_execution_trace_payload.py` (added, +97/-0)
```diff
@@ -0,0 +1,97 @@
+"""Dump one real execution-trace payload for the Space wire-format contract test.
+
+Run from the repository root with the project interpreter, e.g.:
+
+    PYTHONPATH=src python tests/manual/dump_execution_trace_payload.py
+
+`langbot-space` keeps the output as
+`internal/service/testdata/execution_trace_payload.json` and asserts that its
+ingest validator accepts it. Regenerate that file whenever the payload shape
+changes; the Space test documents the same command.
+"""
+
+from __future__ import annotations
+
+import asyncio
+import json
+import sys
+import types
+from importlib import import_module
+
+
+class CaptureManager:
+    """Captures what TelemetryManager would have posted."""
+
+    def __init__(self):
+        self.telemetry_config = {'url': 'https://space.langbot.test', 'execution_trace': 'all'}
+        self.sent: list[dict] = []
+
+    async def send(self, payload: dict) -> bool:
+        self.sent.append(payload)
+        return True
+
+    def start_send_task(self, payload: dict) -> None:
+        self.sent.append(payload)
+
+
+async def main() -> int:
+    execution = import_module('langbot.pkg.telemetry.execution')
+    trace = import_module('langbot.pkg.telemetry.trace')
+
+    manager = CaptureManager()
+    counters = execution.ExecutionCounters(manager)
+    context = types.SimpleNamespace(instance_uuid='instance-1', workspace_uuid='workspace-1')
+    route_ref = 'agent:11111111-1111-4111-8111-111111111111'
+    run_id = '22222222-2222-4222-8222-222222222222'
+
+    with execution.ingress(types.SimpleNamespace(telemetry=types.SimpleNamespace(execution=counters))):
+        # Inbound platform event.
+        counters.record(
+            context,
+            family='platform_event',
+            operation='message.received',
+            adapter='AiocqhttpAdapter',
+            outcome='success',
+        )
+        # Route decision for that event.
+        with trace.scope(route_ref=route_ref):
+            counters.record(
+                context,
+                family='event_route',
+                operation='message.received',
+                mode='agent',
+                adapter='AiocqhttpAdapter',
+                outcome='success',
+            )
+            # Runner execution of the routed processor.
+            run_token = trace.set_run(run_id)
+            try:
+                counters.record(
+                    context,
+                    family='runner',
+                    operation='execute',
+                    mode='agent',
+                    runner='langbot/runner-demo',
+                    outcome='success',
+                )
+                # Outbound platform API call made by the runner.
+                counters.record(
+                    context,
+                    family='platform_api',
+                    operation='send_message',
+                    mode='agent',
+                    adapter='AiocqhttpAdapter',
+                    outcome='success',
+                )
+            finally:
+                trace.reset_run(run_token)
+
+    if len(manager.sent) != 1:
+        print(f'expected exactly one payload, captured {len(manager.sent)}', file=sys.stderr)
+        return 1
+    print(json.dumps(manager.sent[0], indent=2, ensure_ascii=False, sort_keys=True))
+    return 0
+
+
+if __name__ == '__main__':
+    raise SystemExit(asyncio.run(main()))
```

**File**: `tests/unit_tests/platform/test_botmgr_execution_trace.py` (added, +186/-0)
```diff
@@ -0,0 +1,186 @@
+"""RuntimeBot ingress tracing: one inbound event owns one execution trace."""
+
+from __future__ import annotations
+
+from types import SimpleNamespace
+from unittest.mock import AsyncMock, Mock
+
+import pytest
+
+from langbot.pkg.api.http.context import ExecutionContext
+
+TEST_CONTEXT = ExecutionContext(
+    instance_uuid='instance-test',
+    workspace_uuid='workspace-test',
+    placement_generation=1,
+    bot_uuid='bot-1',
+)
+
+
+class FakeTelemetryManager:
+    def __init__(self, config=None):
+        self.telemetry_config = (
+            {'url': 'https://space.example.test', 'execution_trace': 'all'} if config is None else config
+        )
+        self.sent: list[dict] = []
+
+    async def send(self, payload: dict) -> bool:
+        self.sent.append(payload)
+        return True
+
+    def start_send_task(self, payload: dict) -> None:
+        self.sent.append(payload)
+
+
+def make_bot(event_bindings: list[dict], config=None, agent=None):
+    from langbot.pkg.platform.botmgr import RuntimeBot
+    from langbot.pkg.telemetry.execution import ExecutionCounters
+
+    manager = FakeTelemetryManager(config)
+    counters = ExecutionCounters(manager)
+    bot = object.__new__(RuntimeBot)
+    bot.bot_entity = SimpleNamespace(
+        uuid='bot-1',
+        workspace_uuid=TEST_CONTEXT.workspace_uuid,
+        event_bindings=event_bindings,
+        plugin_processors=[],
+    )
+    bot.execution_context = TEST_CONTEXT
+    bot.workspace_uuid = TEST_CONTEXT.workspace_uuid
+    bot.placement_generation = TEST_CONTEXT.placement_generation
+    bot.logger = SimpleNamespace(info=AsyncMock(), warning=AsyncMock(), error=AsyncMock(), debug=AsyncMock())
+    bot.adapter = FakeAdapter()
+    bot.ap = SimpleNamespace(
+        telemetry=SimpleNamespace(execution=counters),
+        agent_service=SimpleNamespace(get_agent=AsyncMock(return_value=agent)),
+        pipeline_service=SimpleNamespace(get_pipeline=AsyncMock(return_value=None)),
+    )
+    return bot, manager, counters
+
+
+def message_received_event():
+    from langbot_plugin.api.entities.builtin.platform import entities, events, message
+
+    return events.MessageReceivedEvent(
+        message_id='message-1',
+        message_chain=message.MessageChain([message.Plain(text='hello')]),
+        sender=entities.User(id='user-1', nickname='QA User'),
+        chat_type=entities.ChatType.PRIVATE,
+        chat_id='user-1',
+    )
+
+
+class FakeAdapter:
+    async def get_supported_apis(self):
+        return []
+
+
+@pytest.mark.asyncio
+async def test_route_miss_emits_one_closed_trace():
+    bot, manager, counters = make_bot([])
+
+    await bot._handle_platform_event(message_received_event(), FakeAdapter())
+
+    assert len(manager.sent) == 1
+    payload = manager.sent[0]
+    assert payload['event_type'] == 'feature_execution'
+    assert len(payload['query_id']) == 36
+    assert payload['instance_id'] == 'instance-test'
+    assert payload['workspace_uuid'] == 'workspace-test'
+    features = payload['features']
+    assert features['schema'] == 1
+    assert [(row['family'], row['operation'], row['outcome']) for row in features['observations']] == [
+        ('platform_event', 'message.received', 'success'),
+        ('event_route', 'message.received', 'skipped'),
+    ]
+    assert [row['seq'] for row in features['observations']] == [0, 1]
+    assert all(row['trace_id'] == payload['query_id'] for row in features['observations'])
+    assert all(row['adapter'] == 'FakeAdapter' for row in features['observations'])
+    assert features['trace']['closed_by'] == 'event_done'
+    # Window counters are still aggregated for coverage.
+    assert counters.pending
+
+
+@pytest.mark.asyncio
+async def test_unavailable_route_target_carries_route_identity():
+    bot, manager, _ = make_bot(
+        [
+            {
+                'id': 'agent-binding',
+                'enabled': True,
+                'event_pattern': 'message.received',
+                'target_type': 'agent',
+                'target_uuid': 'agent-1',
+            }
+        ]
+    )
+
+    await bot._handle_platform_event(message_received_event(), FakeAdapter())
+
+    stages = manager.sent[0]['features']['observations']
+    assert [(stage['family'], stage['outcome'], stage['mode']) for stage in stages] == [
+        ('platform_event', 'success', 'none'),
+        ('event_route', 'failed', 'agent'),
+    ]
+    assert stages[1]['route_ref'] == 'agent:agent-1'
+    assert stages[0]['route_ref'] == ''
+
+
+@pytest.mark.asyncio
+async def test_discarded_route_is_visible_without_user_values():
+    bot, manager, _ = make_bot(
+        [
+            {
+                'id': 'discard-binding',
+                'enabled': True,
+                'event_pattern': '*',
+                'target_type': 'discard',
+            }
+        ]
+    )
+
+    await bot._handle_platform_event(SimpleNamespace(type='platform.member.joined'), FakeAdapter())
+
+    stages = 
```

---

### Incident Patch 14: `ae516d22` (2026-09-30)
**Commit Message**: build(core): pin plugin SDK 0.7.6

Carries the plugin worker process label: workers now show `--tag
author/plugin_name` in ps/htop, including the nsjail supervisor row.

Verified locally: the published wheel hash matches the pin, the shared runtime
launches workers with the tag, plugins register and knowledge retrieval is
unaffected.

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -71,7 +71,7 @@ dependencies = [
     "langchain-text-splitters>=1.1.2",
     "chromadb>=1.0.0,<2.0.0",
     "qdrant-client (>=1.15.1,<2.0.0)",
-    "langbot-plugin @ https://files.pythonhosted.org/packages/51/cf/314abe6775b05f23381f66dba707756a984010b36e72a4aecc03d26d9b3c/langbot_plugin-0.7.5-py3-none-any.whl#sha256=a20fba9d331d29b0969dc4e12880269165a522f56fff146c0ef71f38a19bdc2e",
+    "langbot-plugin @ https://files.pythonhosted.org/packages/f5/de/4c73851c18e01e6dd1f39e3743a7811c4016e703797075491b2fdbd2530c/langbot_plugin-0.7.6-py3-none-any.whl#sha256=b2f05302ca25b374ff8c094794573696b75a7d1a7731a0fe2eebbc71796e8e0d",
     "asyncpg>=0.30.0",
     "line-bot-sdk>=3.19.0",
     "matrix-nio>=0.25.2",
```

**File**: `uv.lock` (modified, +4/-4)
```diff
@@ -2185,7 +2185,7 @@ requires-dist = [
     { name = "gewechat-client", specifier = ">=0.1.5" },
     { name = "html2text", specifier = ">=2024.2.26" },
     { name = "httpx", extras = ["socks"], specifier = ">=0.28.1" },
-    { name = "langbot-plugin", url = "https://files.pythonhosted.org/packages/51/cf/314abe6775b05f23381f66dba707756a984010b36e72a4aecc03d26d9b3c/langbot_plugin-0.7.5-py3-none-any.whl" },
+    { name = "langbot-plugin", url = "https://files.pythonhosted.org/packages/f5/de/4c73851c18e01e6dd1f39e3743a7811c4016e703797075491b2fdbd2530c/langbot_plugin-0.7.6-py3-none-any.whl" },
     { name = "langchain", specifier = ">=1.3.9" },
     { name = "langchain-core", specifier = ">=1.3.3" },
     { name = "langchain-text-splitters", specifier = ">=1.1.2" },
@@ -2255,8 +2255,8 @@ dev = [
 
 [[package]]
 name = "langbot-plugin"
-version = "0.7.5"
-source = { url = "https://files.pythonhosted.org/packages/51/cf/314abe6775b05f23381f66dba707756a984010b36e72a4aecc03d26d9b3c/langbot_plugin-0.7.5-py3-none-any.whl" }
+version = "0.7.6"
+source = { url = "https://files.pythonhosted.org/packages/f5/de/4c73851c18e01e6dd1f39e3743a7811c4016e703797075491b2fdbd2530c/langbot_plugin-0.7.6-py3-none-any.whl" }
 dependencies = [
     { name = "aiofiles" },
     { name = "aiohttp" },
@@ -2277,7 +2277,7 @@ dependencies = [
     { name = "websockets" },
 ]
 wheels = [
-    { url = "https://files.pythonhosted.org/packages/51/cf/314abe6775b05f23381f66dba707756a984010b36e72a4aecc03d26d9b3c/langbot_plugin-0.7.5-py3-none-any.whl", hash = "sha256:a20fba9d331d29b0969dc4e12880269165a522f56fff146c0ef71f38a19bdc2e" },
+    { url = "https://files.pythonhosted.org/packages/f5/de/4c73851c18e01e6dd1f39e3743a7811c4016e703797075491b2fdbd2530c/langbot_plugin-0.7.6-py3-none-any.whl", hash = "sha256:b2f05302ca25b374ff8c094794573696b75a7d1a7731a0fe2eebbc71796e8e0d" },
 ]
 
 [package.metadata]
```

---

### Incident Patch 15: `d3e4bd55` (2026-09-30)
**Commit Message**: fix: document telemetry opt-out and silence delivery failures (#2618)

* fix: document telemetry opt-out and silence delivery failures

* style: format telemetry debug logging

**File**: `README.md` (modified, +4/-0)
```diff
@@ -188,3 +188,7 @@ Thanks to all [contributors](https://github.com/langbot-app/LangBot/graphs/contr
 <a href="https://github.com/langbot-app/LangBot/graphs/contributors">
   <img src="https://contrib.rocks/image?repo=langbot-app/LangBot" />
 </a>
+
+## Optional telemetry
+
+Telemetry is enabled by default. To opt out, set `space.disable_telemetry: true` in your instance’s `data/config.yaml`, preserve other settings, and restart the instance. This disables usage, heartbeat and execution telemetry. In Cloud, the instance operator controls this setting for every workspace in the instance. Delivery is best-effort in background tasks; connection failures, timeouts and server errors do not block normal operations. Failure details are logged only at DEBUG level.
```

**File**: `README_CN.md` (modified, +4/-0)
```diff
@@ -212,3 +212,7 @@ LangBot **从设计上就对 Agent 友好** —— 你的编码 Agent（Claude C
 
 If you're a code agent based on LLM, you should read [AGENTS.md](AGENTS.md) to understand the project structure and development process before you start any development.
 -->
+
+## 可选遥测
+
+遥测默认开启。可以在实例 `data/config.yaml` 中将 `space.disable_telemetry` 改为 `true`，保留其他配置，然后重启实例。此开关关闭使用统计、实例心跳和功能执行遥测；Cloud 由实例运维方配置，对该实例所有工作区生效。遥测在后台尽力发送，网络故障、超时或服务端错误不会阻断正常操作；失败详情仅记录在 DEBUG 日志中。
```

**File**: `src/langbot/pkg/telemetry/telemetry.py` (modified, +8/-10)
```diff
@@ -170,9 +170,7 @@ async def send(self, payload: dict):
 
                         if resp.status_code >= 400:
                             body = await httpclient.response_text(resp, max_chars=200)
-                            self.ap.logger.warning(
-                                f'Telemetry post to {url} returned status {resp.status_code} - {body}'
-                            )
+                            self.ap.logger.debug(f'Telemetry post to {url} returned status {resp.status_code} - {body}')
                         else:
                             # Detect application-level errors inside HTTP 200 responses
                             app_err = False
@@ -181,15 +179,15 @@ async def send(self, payload: dict):
                                 app_code = j.get('code') if isinstance(j, dict) else None
                                 if app_code is not None and int(app_code) >= 400:
                                     app_err = True
-                                    self.ap.logger.warning(
+                                    self.ap.logger.debug(
                                         f'Telemetry post to {url} returned application error code {j.get("code")} - {j.get("msg")}'
                                     )
                             except Exception:
                                 pass
 
                             if app_err:
                                 body = await httpclient.response_text(resp, max_chars=200)
-                                self.ap.logger.warning(
+                                self.ap.logger.debug(
                                     f'Telemetry post to {url} returned app-level error - response: {body}'
                                 )
                             else:
@@ -200,19 +198,19 @@ async def send(self, payload: dict):
                             if not app_err:
                                 return True
                     except asyncio.TimeoutError:
-                        self.ap.logger.warning(f'Telemetry post to {url} timed out')
+                        self.ap.logger.debug(f'Telemetry post to {url} timed out')
                     except Exception as e:
-                        self.ap.logger.warning(f'Failed to post telemetry to {url}: {e}', exc_info=True)
+                        self.ap.logger.debug(f'Failed to post telemetry to {url}: {e}', exc_info=True)
             except Exception as e:
                 try:
-                    self.ap.logger.warning(
+                    self.ap.logger.debug(
                         f'Failed to create HTTP client for telemetry or sanitize payload: {e}', exc_info=True
                     )
                 except Exception:
                     pass
         except Exception as e:
-            # Never raise from telemetry; surface as warning for visibility
+            # Never raise from telemetry; diagnostics are debug-only.
             try:
-                self.ap.logger.warning(f'Unexpected telemetry error: {e}', exc_info=True)
+                self.ap.logger.debug(f'Unexpected telemetry error: {e}', exc_info=True)
             except Exception:
                 pass
```

**File**: `src/langbot/templates/config.yaml` (modified, +2/-1)
```diff
@@ -426,5 +426,6 @@ space:
     # OAuth authorization page URL (user will be redirected here)
     oauth_authorize_url: 'https://space.langbot.app/auth/authorize'
     disable_models_service: false
-    # Disable usage telemetry.
+    # Optional telemetry is enabled by default. Set true to disable usage,
+    # heartbeat and execution reporting; restart after changing this setting.
     disable_telemetry: false
```

**File**: `tests/unit_tests/telemetry/test_telemetry.py` (modified, +12/-8)
```diff
@@ -431,6 +431,7 @@ async def test_send_http_success_logs_debug(self):
         with patch.object(httpx, 'AsyncClient', return_value=mock_client):
             await manager.send({'query_id': 'test'})
 
+        mock_app.logger.warning.assert_not_called()
         mock_app.logger.debug.assert_called()
         # Verify debug message contains URL and status
         debug_call_args = mock_app.logger.debug.call_args[0][0]
@@ -459,8 +460,9 @@ async def test_send_http_error_status_logs_warning(self):
         with patch.object(httpx, 'AsyncClient', return_value=mock_client):
             await manager.send({'query_id': 'test'})
 
-        mock_app.logger.warning.assert_called()
-        warning_call_args = mock_app.logger.warning.call_args[0][0]
+        mock_app.logger.warning.assert_not_called()
+        mock_app.logger.debug.assert_called()
+        warning_call_args = mock_app.logger.debug.call_args[0][0]
         assert 'status 500' in warning_call_args
 
     @pytest.mark.asyncio
@@ -488,9 +490,9 @@ async def test_send_application_error_logs_warning(self):
             await manager.send({'query_id': 'test'})
 
         # Source code calls warning twice for application errors
-        assert mock_app.logger.warning.call_count >= 1
+        assert mock_app.logger.debug.call_count >= 1
         # Check that one of the calls contains application error info
-        all_warnings = [call[0][0] for call in mock_app.logger.warning.call_args_list]
+        all_warnings = [call[0][0] for call in mock_app.logger.debug.call_args_list]
         assert any('400' in w for w in all_warnings), f'No warning contained error code 400: {all_warnings}'
 
     @pytest.mark.asyncio
@@ -516,8 +518,9 @@ async def mock_post_timeout(url, json):
         with patch.object(httpx, 'AsyncClient', return_value=mock_client):
             await manager.send({'query_id': 'test'})
 
-        mock_app.logger.warning.assert_called()
-        warning_call_args = mock_app.logger.warning.call_args[0][0]
+        mock_app.logger.warning.assert_not_called()
+        mock_app.logger.debug.assert_called()
+        warning_call_args = mock_app.logger.debug.call_args[0][0]
         assert 'timed out' in warning_call_args
 
     @pytest.mark.asyncio
@@ -542,7 +545,8 @@ async def mock_post_error(url, json):
             # Should not raise exception
             await manager.send({'query_id': 'test'})
 
-        mock_app.logger.warning.assert_called()
+        mock_app.logger.warning.assert_not_called()
+        mock_app.logger.debug.assert_called()
 
     @pytest.mark.asyncio
     async def test_send_never_raises_exception(self):
@@ -551,7 +555,7 @@ async def test_send_never_raises_exception(self):
         mock_app = Mock()
         # Even logger may fail
         mock_app.logger = Mock()
-        mock_app.logger.warning = Mock(side_effect=Exception('Logger failed'))
+        mock_app.logger.debug = Mock(side_effect=Exception('Logger failed'))
 
         manager = telemetry.TelemetryManager(mock_app)
         manager.telemetry_config = {'url': 'https://example.com'}
```

#### Recent Merged Pull Requests:
- **PR #2625** (2026-10-02): fix(plugin): upgrade SDK to 0.7.10 (@RockChinQ)
- **PR #2624** (2026-10-01): chore(release): prepare 4.11.0-beta.6 with SDK 0.7.9 (@RockChinQ)
- **PR #2623** (2026-10-01): fix(ci): resolve frontend formatting failures (@RockChinQ)
- **PR #2622** (2026-10-01): chore(deps): upgrade plugin SDK to 0.7.7 (@RockChinQ)
- **PR #2619** (2026-09-30): docs: move telemetry configuration out of READMEs (@RockChinQ)
- **PR #2618** (2026-09-30): fix: document telemetry opt-out and silence delivery failures (@RockChinQ)
- **PR #2617** (2026-09-30): feat: bounded execution telemetry for all processing modes (@RockChinQ)
- **PR #2616** (2026-09-30): refactor: remove Beta diagnostics (@RockChinQ)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

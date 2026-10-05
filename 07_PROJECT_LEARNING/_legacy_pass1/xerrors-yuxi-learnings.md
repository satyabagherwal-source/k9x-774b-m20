# Forensic Learning Record (Deep Inspection): xerrors/Yuxi

> **Canonical Artifact**: `07_PROJECT_LEARNING/xerrors-yuxi-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/xerrors/Yuxi](https://github.com/xerrors/Yuxi))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T18:50:55.734Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `xerrors/Yuxi`
- **Description**: 可私有部署的多租户知识智能体平台：统一 RAG、知识图谱、多智能体、MCP/Skills、沙盒与权限管理。Yuxi = Cloud Agents + Knowledge RAG, Self-hosted knowledge agent platform for RAG, knowledge graphs and multi-agent workflows.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 7248 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `backend/package/yuxi/__init__.py`
```
from dotenv import load_dotenv

load_dotenv(".env", override=True)

from concurrent.futures import ThreadPoolExecutor  # noqa: E402

try:
    from importlib.metadata import version

    __version__ = version("yuxi")
except Exception:
    __version__ = "unknown"

executor = ThreadPoolExecutor()  # noqa: E402


def get_version():
    """Return the Yuxi version."""
    return __version__

```

### Core Architecture Module: `backend/package/yuxi/agents/__init__.py`
```
# Base classes - 核心基类
from yuxi.agents.base import BaseAgent
from yuxi.agents.context import BaseContext

# MCP - Agent 层统一入口（自动过滤 disabled_tools）
from yuxi.agents.mcp.service import get_enabled_mcp_tools
from yuxi.agents.state import BaseState

# Tools - 核心工具函数
from yuxi.agents.toolkits.utils import get_tool_info

# Model utilities - 模型加载
from yuxi.models.chat import load_chat_model, resolve_chat_model_spec

__all__ = [
    # Base classes
    "BaseAgent",
    "BaseContext",
    "BaseState",
    # Model utilities
    "load_chat_model",
    "resolve_chat_model_spec",
    # Core tools
    "get_tool_info",
    # Core MCP
    "get_enabled_mcp_tools",
]

```

### Core Architecture Module: `backend/package/yuxi/agents/backends/__init__.py`
```
from deepagents.backends import CompositeBackend, StateBackend

from .composite import (
    create_agent_composite_backend,
    create_agent_filesystem_middleware,
    sync_agent_context_skills,
)
from .knowledge_base_backend import resolve_visible_knowledge_bases_for_context
from .sandbox import (
    ProvisionerSandboxBackend,
    ProvisionerSandboxProvider,
    SandboxConnection,
    get_sandbox_provider,
    init_sandbox_provider,
    sandbox_id_for_thread,
    shutdown_sandbox_provider,
)

__all__ = [
    "CompositeBackend",
    "StateBackend",
    "create_agent_composite_backend",
    "create_agent_filesystem_middleware",
    "sync_agent_context_skills",
    "ProvisionerSandboxBackend",
    "ProvisionerSandboxProvider",
    "SandboxConnection",
    "get_sandbox_provider",
    "init_sandbox_provider",
    "shutdown_sandbox_provider",
    "resolve_visible_knowledge_bases_for_context",
    "sandbox_id_for_thread",
]

```

### Core Architecture Module: `backend/package/yuxi/agents/backends/composite.py`
```
from __future__ import annotations

from dataclasses import dataclass

from deepagents.backends import CompositeBackend
from deepagents.middleware.filesystem import (
    TOOLS_EXCLUDED_FROM_EVICTION,
    FilesystemMiddleware,
    FsToolName,
)

from yuxi.agents.backends.paths import runtime_workdir_path
from yuxi.services.skills.projection import refresh_user_skill_projection_async

from .sandbox import ProvisionerSandboxBackend

# Yuxi 在 DeepAgents 内建排除集之上额外豁免知识库文档工具结果，
# 避免 read_file/offload 循环：该工具自带分页与引用语义。
_TOOL_RESULT_EVICTION_EXEMPT_TOOLS = frozenset(TOOLS_EXCLUDED_FROM_EVICTION) | {"open_kb_document"}

# 文件工具 allowlist：显式排除 destructive delete。Yuxi backend 未实现 delete，
# 且删除语义需要审批与审计设计，开放前不应让模型看到该工具。
_AGENT_FS_TOOLS: tuple[FsToolName, ...] = (
    "ls",
    "read_file",
    "write_file",
    "edit_file",
    "glob",
    "grep",
    "execute",
)


class YuxiFilesystemMiddleware(FilesystemMiddleware):
    """Filesystem middleware that budgets large tool outputs before they hit model context."""

    def wrap_tool_call(self, request, handler):
        tool_result = handler(request)

        if request.tool_call["name"] in _TOOL_RESULT_EVICTION_EXEMPT_TOOLS:
            return tool_result
        if self._tool_token_limit_before_evict is None:
            return tool_result

        return self._intercept_large_tool_result(tool_result)

    async def awrap_tool_call(self, request, handler):
        tool_result = await handler(request)

        if request.tool_call["name"] in _TOOL_RESULT_EVICTION_EXEMPT_TOOLS:
            return tool_result
        if self._tool_token_limit_before_evict is None:
            return tool_result

        return await self._aintercept_large_tool_result(tool_result)


@dataclass(frozen=True)
class _BackendScope:
    runtime_scope_id: str
    workdir_relative_path: str
    uid: str

    @property
    def workdir_path(self) -> str:
        return runtime_workdir_path(self.workdir_relative_path)

    @classmethod
    def from_sources(cls, *sources, error_context: str) -> _BackendScope:
        def string_value(key: str) -> str | None:
            for source in sources:
                value = source.get(key) if isinstance(source, dict) else getattr(source, key, None)
                if isinstance(value, str) and value.strip():
                    return value.strip()
            return None

        thread_id = string_value("thread_id")
        if not thread_id:
            raise ValueError(f"thread_id is required in {error_context}")

        uid = string_value("uid")
        if not uid:
            raise ValueError(f"uid is required in {error_context}")

        runtime_scope_id = string_value("runtime_scope_id") or thread_id
        relative_path = string_value("workdir_relative_path") or ""
        return cls(
            runtime_scope_id=runtime_scope_id,
            workdir_relative_path=relative_path,
            uid=uid,
        )

    def create_backend(self) -> CompositeBackend:
        if not self.workdir_relative_path:
            raise ValueError("workdir path is required in runtime context")
        # artifacts_root 指向 outputs 目录：Filesystem/Summarization middleware 由此
        # 派生 large_tool_results 与 conversation_history 前缀，与 Yuxi 契约一致。
        return CompositeBackend(
            default=ProvisionerSandboxBackend(
                thread_id=self.runtime_scope_id,
                uid=self.uid,
                workdir_path=self.workdir_relative_path,
                create_if_missing=True,
            ),
            routes={},
            artifacts_root=f"{self.workdir_path.rstrip('/')}/outputs",
        )


async def sync_agent_context_skills(context) -> None:
    """在 Agent Run 初始化时同步当前用户获授权的共享 Skill 投影。"""
    scope = _BackendScope.from_sources(context, error_context="runtime context")
    await refresh_user_skill_projection_async(scope.uid)


def create_agent_composite_backend(context) -> CompositeBackend:
    """按已准备的 Agent context 构造本 Run 独享的 CompositeBackend 实例。

    DeepAgents 0.7 移除了 backend factory：每次 graph 构造时基于 context 创建
    具体实例，并由 filesystem 与 summary middleware 共用同一实例，保持
    user/thread/file_thread 的隔离边界。
    """
    return _BackendScope.from_sources(context, error_context="agent context").create_backend()


def create_agent_filesystem_middleware(
    tool_token_limit_before_evict: int | None = None,
    *,
    backend: CompositeBackend,
    disabled_tools: frozenset[str] = frozenset(),
) -> FilesystemMiddleware:
    """构造文件系统中间件，在 ToolNode 注册前排除禁用工具。"""
    return YuxiFilesystemMiddleware(
        backend=backend,
        tool_token_limit_before_evict=tool_token_limit_before_evict,
        tools=[name for name in _AGENT_FS_TOOLS if name not in disabled_tools],
    )

```

### Core Architecture Module: `backend/package/yuxi/agents/backends/knowledge_base_backend.py`
```
from __future__ import annotations

from typing import Any


async def resolve_visible_knowledge_bases_for_context(context) -> list[dict[str, Any]]:
    from yuxi.knowledge.runtime import knowledge_base

    uid = getattr(context, "uid", None)
    if not uid:
        setattr(context, "_visible_knowledge_bases", [])
        return []

    summaries = await knowledge_base.get_databases_by_uid(str(uid))
    databases = [
        {
            "kb_id": summary.kb_id,
            "name": summary.name,
            "description": summary.description,
            "kb_type": summary.kb_type,
        }
        for summary in summaries
    ]
    enabled_knowledges = getattr(context, "knowledges", None)
    if enabled_knowledges is not None:
        enabled_ids = {str(value).strip() for value in enabled_knowledges if str(value).strip()}
        databases = [db for db in databases if str(db.get("kb_id") or "").strip() in enabled_ids]

    setattr(context, "_visible_knowledge_bases", databases)
    return databases

```

### Core Architecture Module: `backend/package/yuxi/agents/backends/paths.py`
```
"""Agent Backend 的 Sandbox runtime 路径契约。"""

from __future__ import annotations

import os
from pathlib import PurePosixPath

from yuxi.workspace.paths import normalize_workdir_path

_DEFAULT_VIRTUAL_PATH_PREFIX = "/home/gem/user-data"


def _get_virtual_path_prefix() -> str:
    """读取并规范化 Sandbox 的 user-data 虚拟根路径。"""
    prefix = os.getenv("SANDBOX_VIRTUAL_PATH_PREFIX") or _DEFAULT_VIRTUAL_PATH_PREFIX
    prefix = prefix.strip() or _DEFAULT_VIRTUAL_PATH_PREFIX
    return prefix if prefix.startswith("/") else f"/{prefix}"


VIRTUAL_PATH_PREFIX = _get_virtual_path_prefix()

VIRTUAL_SKILLS_PATH = "/home/gem/skills"
VIRTUAL_PERSONAL_SKILLS_PATH = f"{VIRTUAL_PATH_PREFIX.rstrip('/')}/agents/skills"
LARGE_TOOL_RESULTS_DIR_NAME = "large_tool_results"
CONVERSATION_HISTORY_DIR_NAME = "conversation_history"


def runtime_workdir_path(workdir_path: str) -> str:
    """把持久化 Workdir 标识映射到 Sandbox runtime。"""
    return f"{VIRTUAL_PATH_PREFIX.rstrip('/')}/{normalize_workdir_path(workdir_path)}"


def workdir_runtime_paths(workdir_path: str) -> tuple[str, str]:
    """返回当前 Workdir runtime 的大结果与对话历史目录。"""
    normalized = PurePosixPath(str(workdir_path)).as_posix().rstrip("/")
    if not normalized.startswith(f"{VIRTUAL_PATH_PREFIX.rstrip('/')}/"):
        raise ValueError("workdir_path must be a Backend runtime path")
    outputs = f"{normalized}/outputs"
    return (
        f"{outputs}/{LARGE_TOOL_RESULTS_DIR_NAME}",
        f"{outputs}/{CONVERSATION_HISTORY_DIR_NAME}",
    )


def runtime_user_data_path(workspace_path: str) -> str:
    """把 UserWorkspace scope 映射到 Sandbox user-data runtime。"""
    raw = str(workspace_path or "").strip()
    pure = PurePosixPath(raw)
    if not pure.is_absolute() or ".." in pure.parts or "\\" in raw or "://" in raw:
        raise ValueError("invalid Workspace scope path")
    root = VIRTUAL_PATH_PREFIX.rstrip("/")
    return root if pure.as_posix() == "/" else f"{root}{pure.as_posix()}"


def workspace_scope_from_runtime_path(runtime_path: str) -> str:
    """把 Sandbox user-data runtime 路径还原为 UserWorkspace scope。"""
    normalized = PurePosixPath(str(runtime_path)).as_posix()
    root = VIRTUAL_PATH_PREFIX.rstrip("/")
    if normalized == root:
        return "/"
    if not normalized.startswith(f"{root}/"):
        raise ValueError("runtime path is outside user-data")
    return f"/{normalized[len(root) + 1 :]}"


def runtime_path_for_workdir_scope(workdir_path: str, path: str | None) -> str:
    """把 Workdir scope 映射到 Sandbox runtime 绝对路径。"""
    raw = str(path or "/").strip() or "/"
    pure = PurePosixPath(raw)
    if not pure.is_absolute() or ".." in pure.parts or "\\" in raw or "://" in raw:
        raise ValueError("invalid Workdir scope path")
    workspace_root = f"/{normalize_workdir_path(workdir_path)}"
    workspace_path = workspace_root if pure.as_posix() == "/" else f"{workspace_root}{pure.as_posix()}"
    return runtime_user_data_path(workspace_path)


def workdir_scope_from_runtime_path(workdir_path: str, runtime_path: str) -> str:
    """把当前 Workdir runtime 路径还原为持久化 Workdir scope。"""
    normalized = PurePosixPath(str(runtime_path)).as_posix()
    root = runtime_workdir_path(workdir_path).rstrip("/")
    if normalized == root:
        return "/"
    if not normalized.startswith(f"{root}/"):
        raise ValueError("runtime path is outside the Workdir")
    return f"/{normalized[len(root) + 1 :]}"


def is_runtime_path(path: str) -> bool:
    """判断绝对路径是否属于 Agent Backend 的 runtime 命名空间。"""
    normalized = PurePosixPath(str(path)).as_posix()
    roots = (VIRTUAL_PATH_PREFIX.rstrip("/"), VIRTUAL_SKILLS_PATH.rstrip("/"))
    return any(normalized == root or normalized.startswith(f"{root}/") for root in roots)


__all__ = [
    "CONVERSATION_HISTORY_DIR_NAME",
    "LARGE_TOOL_RESULTS_DIR_NAME",
    "VIRTUAL_PATH_PREFIX",
    "VIRTUAL_PERSONAL_SKILLS_PATH",
    "VIRTUAL_SKILLS_PATH",
    "is_runtime_path",
    "runtime_path_for_workdir_scope",
    "runtime_user_data_path",
    "runtime_workdir_path",
    "workdir_scope_from_runtime_path",
    "workspace_scope_from_runtime_path",
    "workdir_runtime_paths",
]

```

### Core Architecture Module: `backend/package/yuxi/agents/backends/sandbox/__init__.py`
```
from .backend import ProvisionerSandboxBackend
from .provider import (
    ProvisionerSandboxProvider,
    SandboxConnection,
    get_sandbox_provider,
    init_sandbox_provider,
    sandbox_id_for_thread,
    shutdown_sandbox_provider,
)

__all__ = [
    "ProvisionerSandboxBackend",
    "ProvisionerSandboxProvider",
    "SandboxConnection",
    "get_sandbox_provider",
    "init_sandbox_provider",
    "sandbox_id_for_thread",
    "shutdown_sandbox_provider",
]

```

### Core Architecture Module: `backend/package/yuxi/agents/backends/sandbox/backend.py`
```
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import os
import uuid
from contextlib import aclosing, suppress
from datetime import datetime
from pathlib import PurePosixPath
from typing import Any

import httpx
from deepagents.backends.protocol import (
    ASYNC_GREP_TIMEOUT,
    EditResult,
    ExecuteResponse,
    FileDownloadResponse,
    FileInfo,
    FileUploadResponse,
    GlobResult,
    GrepMatch,
    GrepResult,
    LsResult,
    ReadResult,
    WriteResult,
)
from deepagents.backends.sandbox import MAX_BINARY_BYTES, BaseSandbox
from deepagents.backends.utils import _get_file_type

from yuxi.agents.backends.paths import (
    VIRTUAL_PATH_PREFIX,
    VIRTUAL_SKILLS_PATH,
)
from yuxi.utils.logging_config import logger
from yuxi.workspace.errors import FileTransferLimitError

from .provider import get_sandbox_provider, sandbox_id_for_thread, sandbox_provisioner_token

_USER_DATA_ROOT = "/" + VIRTUAL_PATH_PREFIX.strip("/")
_SKILLS_ROOT = "/" + VIRTUAL_SKILLS_PATH.strip("/")
_BINARY_PREVIEW_TOO_LARGE_ERROR = f"Binary file exceeds maximum preview size of {MAX_BINARY_BYTES} bytes"
_IMAGE_EXTENSIONS = frozenset({".gif", ".heic", ".heif", ".jpeg", ".jpg", ".png", ".webp"})
_DOCUMENT_EXTENSIONS = frozenset({".doc", ".docx", ".pdf", ".ppt", ".pptx", ".xls", ".xlsx"})
_DOCUMENT_READ_ERROR = (
    "read_file does not support PDF or Office documents. Use ocr_parse_file to convert the file to Markdown first."
)
_BINARY_READ_ERROR = "read_file only supports UTF-8 text and image files. This file type is not supported."


def _read_file_kind(path: str) -> str:
    """按读取契约分类文件。"""
    extension = PurePosixPath(path).suffix.lower()
    if extension in _IMAGE_EXTENSIONS:
        return "image"
    if extension in _DOCUMENT_EXTENSIONS:
        return "document"
    if _get_file_type(path) != "text":
        return "binary"
    return "text"


def _read_window(offset: int, limit: int | None) -> tuple[int, int | None]:
    """将读取偏移和数量转换为 sandbox 行窗口。"""
    start_line = max(0, int(offset))
    end_line = start_line + int(limit) if limit is not None else None
    return start_line, end_line


def _normalize_path(path: str) -> str:
    raw = str(path or "").strip()
    if not raw:
        raise ValueError("path is required")
    if not raw.startswith("/"):
        raise ValueError("path must start with /")
    pure = PurePosixPath(raw)
    if ".." in pure.parts:
        raise ValueError("path traversal is not allowed")
    return str(pure)


def _is_same_or_child(path: str, root: str) -> bool:
    root = root.rstrip("/") or "/"
    if root == "/":
        return path == "/" or path.startswith("/")
    return path == root or path.startswith(f"{root}/")


def _path_overlaps_root(path: str, root: str) -> bool:
    return _is_same_or_child(path, root) or _is_same_or_child(root, path)


def _glob_for_search_root(pattern: str, root: str) -> str:
    bare_pattern = str(pattern or "*").lstrip("/")
    bare_root = root.strip("/")
    if bare_pattern == bare_root:
        return "*"
    root_prefix = f"{bare_root}/"
    if bare_pattern.startswith(root_prefix):
        return bare_pattern[len(root_prefix) :] or "*"
    return pattern


def _permission_error(operation: str, path: str) -> str:
    return f"permission denied for {operation} on '{path}'"


def _raise_authorized_path_operation_error(output: str | None, path: str, fallback: str) -> None:
    """把 sandbox 安全文件脚本的失败恢复为稳定边界异常。"""
    detail = str(output or "")
    if "FileNotFoundError" in detail or "No such file or directory" in detail:
        raise FileNotFoundError(path)
    if "IsADirectoryError" in detail or "source is a directory" in detail:
        raise IsADirectoryError(path)
    if "OverflowError" in detail or "exceeds transfer limit" in detail:
        raise FileTransferLimitError("file exceeds transfer limit")
    if any(
        marker in detail
        for marker in (
            "NotADirectoryError",
            "PermissionError",
            "Too many levels of symbolic links",
            "source is not regular",
        )
    ):
        raise PermissionError(path)
    raise RuntimeError(detail or fallback)


def _describe_read_error(file_path: str, exc: Exception) -> str:
    if isinstance(exc, FileNotFoundError):
        return f"Error: File '{file_path}' not found"
    if isinstance(exc, IsADirectoryError):
        return f"Error: Path '{file_path}' is a directory"
    if isinstance(exc, PermissionError):
        return f"Error: Access denied for '{file_path}'"
    if isinstance(exc, ValueError):
        return f"Error: Invalid path '{file_path}': {exc}"
    detail = str(exc).strip()
    if detail:
        return f"Error: Failed to read '{file_path}': {detail}"
    return f"Error: Failed to read '{file_path}'"


def _is_missing_file_error(exc: Exception) -> bool:
    if isinstance(exc, FileNotFoundError):
        return True

    status_code = getattr(exc, "status_code", None)
    response = getattr(exc, "response", None)
    if status_code == 404 or getattr(response, "status_code", None) == 404:
        return True

    detail = str(exc).lower()
    return "status_code: 404" in detail or "file does not exist" in detail


def _looks_like_binary(content: bytes) -> bool:
    if not content:
        return False
    if b"\x00" in content:
        return True
    try:
        content.decode("utf-8")
        return False
    except UnicodeDecodeError:
        return True


def _is_utf8_decode_failure(exc: Exception) -> bool:
    detail = str(exc).lower()
    return "utf-8" in detail and "can't decode" in detail


class ProvisionerSandboxBackend(BaseSandbox):
    def __init__(
        self,
        thread_id: str,
        *,
        uid: str,
        inherit_env: bool = True,
        create_if_missing: bool = True,
        workdir_path: str | None = None,
    ):
        self._thread_id = str(thread_id or "").strip()
        if not self._thread_id:
            raise ValueError("thread_id is required for ProvisionerSandboxBackend")
        self._uid = str(uid or "").strip()
        if not self._uid:
            raise ValueError("uid is required for ProvisionerSandboxBackend")

        self._inherit_env = inherit_env
        self._create_if_missing = create_if_missing
        self._workdir_path = str(workdir_path or "").strip() or None
        self._provider = get_sandbox_provider()
        self._client: Any | None = None
        self._client_url: str | None = None
        self._command_timeout_seconds = int(os.getenv("SANDBOX_EXEC_TIMEOUT_SECONDS") or 180)
        self._max_output_bytes = int(os.getenv("SANDBOX_MAX_OUTPUT_BYTES") or 262_144)

    def _readable_roots(self) -> tuple[str, ...]:
        return (_USER_DATA_ROOT, _SKILLS_ROOT)

    def _writable_roots(self) -> tuple[str, ...]:
        return (_USER_DATA_ROOT,)

    def _can_read_path(self, path: str) -> bool:
        return any(_is_same_or_child(path, root) for root in self._readable_roots())

    def _can_list_path(self, path: str) -> bool:
        return any(_path_overlaps_root(path, root) for root in self._readable_roots())

    def _can_write_path(self, path: str) -> bool:
        return any(_is_same_or_child(path, root) for root in self._writable_roots())

    def _readable_search_paths(self, path: str) -> list[str]:
        if self._can_read_path(path):
            return [path]
        return [root for root in self._readable_roots() if _is_same_or_child(root, path)]

    def _filter_readable_infos(self, infos: list[FileInfo]) -> list[FileInfo]:
        result: list[FileInfo] = []
        for info in infos:
            try:
                path = _normalize_path(info.get("path", ""))
            except ValueError:
                continue
            if self._can_list_path(path):
                result.append(info)
        return result

    def _filter_readable_matches(self, matches: list[GrepMatch]) -> list[GrepMatch]:
        result: list[GrepMatch] = []
        for match in matches:
   
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #1078** (2026-09-28): **Question: CPU占用100%**
  *Symptoms*: 空闲中占用： CONTAINER ID   NAME                                                    CPU %     MEM USAGE / LIMIT    MEM %     NET I/O           BLOCK I/O         PIDS 350554679db3   yuxi-worker-1                                           7.46%     472.8MiB / 10.7GiB   4.32%     6.97MB / 20.8MB   49.2kB / 0B       139 71259ba3cb56   yuxi-web-1                                              16.07%    1.273GiB / 10.7GiB   11.90%    10.4MB / 109MB    318MB / 581MB     43 73103e8ba291   yuxi-api-1                                              0.74%     487.6MiB / 10.7GiB   4.45%     20.3MB / 8.97MB   69MB / 25.3MB     49 6a96fd1c8b74   yuxi-sandbox-provisioner-1                              1.34%     65.43MiB / 10.7GiB   0.60%     33.6kB / 21.7kB   22.7MB / 0B       10 febf02b9e8a9   yuxi-milvus-1                                           1.42%     128.6MiB / 10.7GiB   1.17%     3.15MB / 5MB      269MB / 3.23MB    35 116829e9576c   yuxi-postgres-1                                         0.74%     53.11MiB / 10.7GiB   0.48%     14MB / 17.8MB     51.5MB / 4.25MB   4 a9f0a05901f2   yuxi-redis-1                                            0.38%     7.152MiB / 10.7GiB   0.07%     54.8MB / 29.6MB   6.36MB / 0B       6 CONTAINER ID   NAME                                                    CPU %     MEM USAGE / LIMIT    MEM %     NET I/O           BLOCK I/O         PIDS 350554679db3   yuxi-worker-1                                           7.46%     472.8MiB / 10.7GiB   4.32%     6.97MB / 20.8MB   4

- **Issue #1062** (2026-09-23): **[bug] 子智能体因 ModelRetryMiddleware 合成错误 AIMessage 导致 save_messages 一致性检查失败，主运行连锁崩溃**
  *Symptoms*: ## 现象  主智能体派发多个子智能体并行调研，其中一个子智能体因模型 provider 429 TPM 限流而失败（`ModelRetryMiddleware` 重试 3 次都 429），其失败状态触发 `save_messages_from_langgraph_state` 的一致性检查 raise，导致子运行失败、主运行 `execution tree 尚未完成 runtime cleanup`、重试 2 次耗尽、主运行彻底崩溃。  ## 直接错误  ``` ERROR chat_service.py:1251: Error saving messages from LangGraph state: 最终 State AIMessage 无法与当前 Run 的 Model lifecycle 事实关联 ValueError: 最终 State AIMessage 无法与当前 Run 的 Model lifecycle 事实关联 ```  随后： ``` ERROR manager.py:1498: PostgreSQL async operation failed: Run <主run_id> 的 execution tree 尚未完成 runtime cleanup <主run_id> max retries 2 exceeded ```  ## 复现条件  - Yuxi 版本：`0.7.3`（commit d633378 及之后） - 模型：`doubao:glm-5-3-flash-260828`（豆包，TPM 限制 1000K） - Agent 配置：主智能体派 5 个子智能体并行调研（`research-explorer` 等） - 触发条件：5 个子智能体并发调同一个模型 + 长输出 → 触发豆包 `ModelAccountTpmRateLimitExceeded` (429) - 子智能体里 `model_retry_times=2`，`ModelRetryMiddleware` 重试 3 次都 429 后耗尽  ## 根因  `ModelRetryMiddleware._format_failure_message`（`langchain/agents/middleware/model_retry.py:179-195`）在重试耗尽时合成一条 AIMessage：  ```python content = f"Model call failed after {attempts_made} {attempt_word} with {exc_type}: {exc_msg}" return AIMessage(content=content) ```  这条 AIMessage 的特征： - `id` 是普通 UUID（如 `8cab698c-25d7-4a8e-ad34-76e0b19a9514`），**不是 `lc_run-...` 格式** - `content` 是 string（不是 list） - 内容以 `Model call failed after` 开头 - `response_metadata`、`additional_kwargs`、`tool_calls` 全空 - **没有经过 model lifecycle 事件流**（无 `message-start`/`message-finish`），因此 `model_message_audits` 表无对应 operation_id 记录  `save_m

- **Issue #1046** (2026-09-28): **Feat: 上下文自动压缩失败时不要把错误文本写成记忆**
  *Symptoms*: **问题**  长对话会自动压缩发给模型的上下文。自动摘要失败时，Error generating summary: ... 会写入 checkpoint，主模型继续用这段错误当历史。手动点「压缩上下文」失败则会中止，两条路径不一致。  另外，summary_threshold 固定约 100K，不看模型真实窗口；summary_keep_messages 按条数保留，最近几条很大时摘要后仍可能超限。摘要是有损的，模型看不到 outputs/conversation_history/ 里的原文路径。  **期望**  自动压缩在历史文件写失败、摘要为空或报错时，不更新 _summarization_event，这次调用直接失败。PostgreSQL 里的聊天记录不删除。 触发阈值改为 min(配置阈值, 模型上下文窗口的 70%)；未配置窗口时仍用现有配置。保留段按 token 预算从新到旧截取。 默认摘要只保留未完成任务、约束、文件路径和已确认结论，并带上历史文件路径，需要时用 read_file 回读。 摘要调用关闭思考模式，token 计入该次 Run 的用量。 不改  85% 仍然只提示手动压缩，不提前自动摘要。工具结果完整内容仍先写入工作目录。
  **Post-Mortem & Fix Analysis**:
  > 我想认领这个问题。考虑到当前 Issue 同时包含失败原子性、动态触发阈值、按 Token 保留消息、摘要 Prompt 和用量统计，我建议先提交一个最小阶段，只处理自动压缩失败的原子性：  1. 历史文件写入失败时，中止当前调用，不生成或更新 `_summarization_event`； 2. 摘要模型调用失败或返回空内容时，中止当前调用，不把错误文本写入 checkpoint； 3. 补充同步和异步自动压缩路径的回归测试； 4. 不改变当前主动压缩行为。  动态模型窗口阈值、按 Token 保留消息、摘要 Prompt 和 usage 统计暂不包含在这个 PR 中，避免一次改动跨越过多运行时语义。  如果这个拆分范围可以，我会基于最新 main 实现并提交 PR。
  > @OUAO-FRANK 可以的，👍

- **Issue #1045** (2026-09-24): **Error: 知识图谱 LLM 抽取在思考模式模型上 60 秒超时**
  *Symptoms*: **现象** 用百炼 Qwen3 系列做知识图谱抽取时，单个文本块经常在模型还没返回 JSON 时失败。Qwen3 默认开启思考模式，思考过程加上抽取结果，非流式请求很容易超过 60 秒。  **复现** 知识库使用 Milvus，图谱抽取器选 LLM。 抽取模型选百炼 Qwen3（默认 enable_thinking=true）。 模型参数留空，开始索引。 抽取阶段超时失败。 相关代码在 backend/package/yuxi/knowledge/graphs/extractors/llm.py：LLMGraphExtractor.extract() 调用 select_model(..., timeout=60.0)，再用 model.call(prompt, stream=False)。超时写死为 60 秒，页面上不能改，也没有流式输出。  已验证的规避方式 图谱配置里的「模型参数 JSON」写成：  {"extra_body":{"enable_thinking":false}} 关闭思考后，同样的文档可以抽完。  下面这种写法会直接报错，而不是关掉思考：  {"enable_thinking":false} model_params 会被展开成 ChatOpenAI 的参数，enable_thinking 进了 AsyncCompletions.create()，接口不接受这个顶层参数。它必须放在 extra_body 里。页面没有说明这一点。  在模型管理里用 request_body_overrides 关闭思考也能生效，但会影响该模型的所有对话，不只是图谱抽取。  **期望** 抽取超时可配置，或对思考模式模型不要固定卡在 60 秒。 百炼这类默认开思考的模型，抽取时能关闭思考，且不要误伤 OpenAI、Anthropic、Gemini。 「模型参数 JSON」说明 enable_thinking 必须放在 extra_body 中；写在顶层时应提示配置错误，而不是把异常关键字传给接口。

- **Issue #998** (2026-09-07): **Error: 点击生成api key无反应**
  *Symptoms*: 1️⃣ 描述一下问题 我想向外部调用智能体接口，在点击生成api key的时候没有任何反应，本地日志也看不到对应内容。 <!-- 简单描述一下问题（如何产生的，什么情况下，进行什么操作的时候）-->    2️⃣ 报错日志  <img width="2549" height="1242" alt="Image" src="https://github.com/user-attachments/assets/10da880c-cda3-4d9d-846b-6ac9e705673e" />   3️⃣ 相关截图  <img width="2549" height="1242" alt="Image" src="https://github.com/user-attachments/assets/8e0fdb40-0b90-4410-af14-e65e90f0cf45" />    #️⃣ 其他相关信息   ✅ 如果问题与模型调用相关，请尝试切换到其他在线模型 
  **Post-Mortem & Fix Analysis**:
  > 问题出在创建弹窗时调用了 `crypto.randomUUID()`，该方法在普通 HTTP 环境下不可用，因此请求尚未发出就报错了。  改用 HTTP 环境也支持的 `crypto.getRandomValues()` 生成请求 ID 即可。后端接受 32 位十六进制字符串，已有请求 ID 和失败重试逻辑保持不变。  ```diff diff --git a/web/src/components/ApiKeyManagementComponent.vue b/web/src/components/ApiKeyManagementComponent.vue --- a/web/src/components/ApiKeyManagementComponent.vue +++ b/web/src/components/ApiKeyManagementComponent.vue @@ -223,7 +223,10 @@ const showCreateModal = () => {    createForm.name = ''    createForm.expires_at = null    createRequestId.value = -    sessionStorage.getItem(CREATE_REQUEST_STORAGE_KEY) || globalThis.crypto.randomUUID() +    sessionStorage.getItem(CREATE_REQUEST_STORAGE_KEY) || +    Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (byte) => +      byte.toString(16).padStart(2, '0') +    ).join('')    sessionStorage.setItem(CREATE_REQUEST_STORAGE_KEY, createRequestId.value)    createModalVisible.value = true  } ```   后续会在主仓库修复更新
  > 感谢作者喵 😘

- **Issue #997** (2026-09-09): **Error: [Bug] 知识库 additional_params.stats 与真实索引状态不一致：chunk_count=0、pending_index_count=N，但文件实际已全部 indexed**
  *Symptoms*: ## 环境  - Yuxi 版本：v0.7.2.beta1（部署分支，含 ARQ worker 异步索引链路；代码中已存在 `knowledge_chunks.tags` jsonb 列） - 部署：docker compose（api + worker + postgres + redis + minio + milvus） - 向量库：Milvus（默认库，非 `yuxi` db） - 数据库：PostgreSQL 库 `yuxi`，表 `knowledge_bases.additional_params`（jsonb，内含 `stats`）  ## 现象  知识库（kb_id=`kb_u452jh75s0`）上传 8 篇 PDF 并全部完成索引后，`additional_params.stats` 缓存与真实数据严重不一致：  | 统计项 | stats 缓存（错误） | 真实数据 | |---|---|---| | `chunk_count` | 0 | 158（`knowledge_chunks` 计数） | | `pending_index_count` | 8 | 0（`knowledge_files` 全部 `indexed`） | | `token_count` | 0 | > 0 |  真实数据核验（均可复现）：  - `knowledge_files`：8 个文件 status 全部为 `indexed` - `knowledge_chunks`：158 行 - Milvus collection `kb_u452jh75s0`：flush 后 `num_entities = 158`，与 PG 一致 - 语义检索正常（评估运行 recall@5 = 1.0）  即：**数据层完全健康，只有 stats 投影过期**。该缓存被 UI 列表 / 依赖库状态的逻辑读取，导致界面显示"待索引/0 分块"，并会让依赖库状态的功能（如评估基准生成前的状态判断）产生误判。  ## 根因分析（基于源码定位，供参考）  1. `manager.py` 已有刷新封装 `_refresh_database_stats()`（`KnowledgeBaseRepository.update_stats` 行锁内写回 `additional_params["stats"]`）以及 `_run_with_stats_refresh()`（执行文件操作并刷新，异常路径也刷新）——但这些服务的是**同步文件操作**（删除/改名/更新等）。 2. 上传 → MinerU/OCR 解析 → 切块 → 向量化 → 写 `knowledge_chunks` + Milvus 是 **ARQ worker 异步链路**（`run_worker.py`）。从调用点检索看，这条异步路径在任务完成后**没有保证触发** `_refresh_database_stats`；一旦 worker 任务中断、异常、或批量处理部分失败，stats 就永远停在旧值，且无自愈机制。 3. 维护者已知该缺口：`base.py` / `manager.py` 提供了 `repair_missing_file_stats(kb_id)`（逐文件重算 chunk/token 并写回 + 刷新库级 stats），说明存在"修复"入口，但索引完成路径未自动调用，UI 也无该入口。  ## 期望行为  - 索引链路完成后 `additional_params.stats` 与 `knowledge_
  **Post-Mortem & Fix Analysis**:
  > 已修复

- **Issue #988** (2026-09-10): **Error: 知识库-文件管理-时间的时区问题**
  *Symptoms*: 1️⃣ 描述一下问题  知识库的创建时间显示的是UTC时间，不是北京时间。 查询了数据库存储的数据：2026-09-01T03:33:33.718140+08:00 如果是+8：00，那就是写入的时间有问题，应该在现在的03:33基础上+8 
  **Post-Mortem & Fix Analysis**:
  > 已修复

- **Issue #866** (2026-08-10): **[安全][多租户] 部门管理员可跨部门读取/删除/下载其他部门知识库文档（对象级越权）**
  *Symptoms*: 标题: [安全][多租户] 部门管理员可跨部门读取/删除/下载其他部门知识库文档（对象级越权）  正文:  ## 问题  `backend/server/routers/knowledge_router.py` 中，**除列表类接口**（`get_databases` 走 `get_databases_by_user` 按 `share_config` 过滤）外，所有文档级操作（如 `delete_document`、`download_document`、`parse_documents` 等）只调用 `_ensure_database_supports_documents`，该函数**仅校验知识库存在与类型，不校验当前用户对该 `kb_id` 的访问权限**；接口仅用 `get_admin_user` 检查角色，不校验部门归属。  ```python async def _ensure_database_supports_documents(kb_id, operation):     db_info, supports = await knowledge_base.get_database_document_support(kb_id)     # 无 access 检查  @knowledge.delete("/databases/{kb_id}/documents/{doc_id}") async def delete_document(kb_id, doc_id, current_user=Depends(get_admin_user)):     await _ensure_database_supports_documents(kb_id, "文档删除") ```  结果：**任意部门管理员只要猜到/枚举 `kb_id` 与 `doc_id`，即可读取、删除、下载其他部门知识库的文档**，破坏多租户部门隔离。  ## 建议  1. 所有文档级接口统一加对象级权限校验：确认当前用户所属部门对 `kb_id` 有访问权限（复用列表接口的过滤逻辑，抽成公共 `_ensure_database_access(kb_id, user)`）； 2. 为所有按 id 操作的接口补充越权测试（其他部门用户访问 → 403）； 3. 审计现有 `knowledge_router.py` 全部按 kb_id/doc_id 操作的路由，逐一补校验。 
  **Post-Mortem & Fix Analysis**:
  > 这个已经验证修复，最近会推送到 GitHub

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

### Incident Patch 1: `cc03eca4` (2026-09-28)
**Commit Message**: fix: 合并资源选择决策并补齐个人 Skill 自动可用

**File**: `backend/package/yuxi/agents/context.py` (modified, +4/-4)
```diff
@@ -265,7 +265,7 @@ def update(self, data: dict):
         metadata={
             "name": "Skills",
             "options": [],
-            "description": "可选 Skill 拓展列表，默认选择当前用户可用的全部 Skill 拓展。"
+            "description": "选择共享和内置 Skill，默认全部；个人 Skill 始终可用，无需选择。"
             "Skill 的本地工具和 MCP 依赖在激活后开放；预加载 Skill 从首轮开放依赖。",
             "type": "list",
             "kind": "skills",
@@ -278,7 +278,7 @@ def update(self, data: dict):
             "name": "预加载 Skills",
             "options": [],
             "description": "创建 Agent Graph 时加载完整 Skill 说明，并从首轮开放其依赖工具。"
-            "默认不预加载；选择全部时预加载当前已启用的全部 Skill。",
+            "默认不预加载；选择全部时预加载当前已选的共享 Skill。",
             "type": "list",
             "kind": "skills",
         },
@@ -460,9 +460,9 @@ async def resolve_agent_resource_options(
             if server.slug in enabled_slugs
         ]
     if "skills" in fields_to_load:
-        from yuxi.agents.skills.service import list_accessible_skills
+        from yuxi.agents.skills.service import list_accessible_shared_skills
 
-        skills = await list_accessible_skills(db, user)
+        skills = await list_accessible_shared_skills(db, user)
         options["skills"] = [
             _resource_option(skill.slug, skill.name, skill.description) for skill in skills if skill.slug
         ]
```

**File**: `backend/package/yuxi/agents/skills/runtime.py` (modified, +6/-3)
```diff
@@ -90,15 +90,18 @@ async def resolve_runtime_skills_for_context(
     db: AsyncSession,
     user: User,
 ) -> dict:
-    """从已授权 Skill 派生当前 Agent Run 的运行时 scope 与预加载快照。"""
+    """合并已选共享与全部个人 Skill，派生运行范围和预加载快照。"""
     skill_items = [item for item in await list_accessible_skills(db, user) if item.slug]
     runtime_skills = build_runtime_skills(skill_items)
     available = set(runtime_skills)
     selected = normalize_string_list(getattr(context, "skills", None))
-    context_skills = [slug for slug in selected if slug in available]
+    shared_skills = [slug for slug in selected if slug in available]
+    context_skills = normalize_string_list(
+        [*shared_skills, *(item.slug for item in skill_items if item.source_scope == "personal")]
+    )
     effective_skills = expand_skill_closure(context_skills, runtime_skills)
     configured_preloads = normalize_string_list(getattr(context, "preload_skills", None))
-    context_preload_skills = [slug for slug in configured_preloads if slug in context_skills]
+    context_preload_skills = [slug for slug in configured_preloads if slug in shared_skills]
     preloaded_skills = expand_skill_closure(context_preload_skills, runtime_skills)
     items_by_slug = {item.slug: item for item in skill_items}
     preloaded_contents = (
```

**File**: `backend/package/yuxi/agents/skills/service.py` (modified, +5/-44)
```diff
@@ -23,7 +23,6 @@
 from sqlalchemy import select, text
 from sqlalchemy.ext.asyncio import AsyncSession
 
-from yuxi.agents.context import validate_resource_selection
 from yuxi.agents.mcp.service import get_enabled_mcp_server_slugs
 from yuxi.agents.skills.buildin import BUILTIN_SKILLS_DIR
 from yuxi.agents.skills.repository import SkillRepository
@@ -362,7 +361,7 @@ async def refresh_user_skill_projection_async(uid: str) -> dict[str, str]:
         else:
             source_dirs = {
                 item.slug: str(_resolve_skill_dir(item))
-                for item in await _list_accessible_shared_skills(db, user)
+                for item in await list_accessible_shared_skills(db, user)
                 if item.slug
             }
         await sync_user_accessible_skills_async(normalized_uid, source_dirs)
@@ -594,7 +593,7 @@ async def list_accessible_skills(
 ) -> list[ResolvedSkill]:
     """返回当前用户最终生效的共享与个人 Skill。"""
     shared_items, personal_items = await asyncio.gather(
-        _list_accessible_shared_skills(db, user, require_enabled=require_enabled),
+        list_accessible_shared_skills(db, user, require_enabled=require_enabled),
         list_personal_skills(str(user.uid)),
     )
     personal_by_slug = {item.slug: item for item in personal_items}
@@ -680,7 +679,7 @@ def get_tools():
     }
 
 
-async def _list_accessible_shared_skills(
+async def list_accessible_shared_skills(
     db: AsyncSession,
     user: User,
     *,
@@ -694,7 +693,7 @@ async def _list_accessible_shared_skills(
 
 async def _list_shared_skill_slugs(db: AsyncSession, user: User) -> list[str]:
     """返回依赖配置可引用的共享 Skill slug。"""
-    return [item.slug for item in await _list_accessible_shared_skills(db, user) if isinstance(item.slug, str)]
+    return [item.slug for item in await list_accessible_shared_skills(db, user) if isinstance(item.slug, str)]
 
 
 def _get_all_tool_names() -> list[str]:
@@ -754,7 +753,7 @@ async def update_skill_dependencies(
     item = await get_manageable_skill_or_raise(db, operator, slug)
     _ensure_non_builtin(item)
     repo = SkillRepository(db)
-    skill_items = await _list_accessible_shared_skills(db, operator)
+    skill_items = await list_accessible_shared_skills(db, operator)
     available_skills = {skill.slug: skill for skill in skill_items}
     tools, mcps, skills = await _validate_dependencies(
         parent=item,
@@ -965,44 +964,6 @@ async def delete_personal_skill(uid: str, slug: str) -> None:
     await asyncio.to_thread(shutil.rmtree, skill_dir)
 
 
-async def enable_personal_skills_for_agent_config(
-    db: AsyncSession,
-    *,
-    thread_id: str,
-    uid: str,
-    skill_slugs: list[str],
-) -> bool:
-    """为显式 Skill 白名单追加个人 Skill；全部模式无需写入。"""
-    from yuxi.repositories.agent_repository import AgentRepository
-    from yuxi.repositories.conversation_repository import ConversationRepository
-
-    conversation = await ConversationRepository(db).get_conversation_by_thread_id(thread_id)
-    if not conversation or str(conversation.uid) != str(uid):
-        return False
-    agent_repo = AgentRepository(db)
-    agent = await agent_repo.get_by_slug(conversation.agent_id)
-    if not agent or agent.created_by != str(uid):
-        return False
-
-    context = (agent.config_json or {}).get("context") or {}
-    configured_skills = validate_resource_selection("skills", context.get("skills", "all"))
-    if configured_skills == "all":
-        return True
-
-    selected_skills = configured_skills
-    updated_skills = normalize_string_list([*selected_skills, *skill_slugs])
-    if updated_skills == selected_skills:
-        return True
-
-    await agent_repo.update(
-        agent,
-        config_json={"context": {"skills": updated_skills}},
-        config_resource_access={"skills": set(skill_slugs)},
-        updated_by=str(uid),
-    )
-    return True
-
-
 def _resolved_shared_skill(item: Skill, *, shadowed_by_personal: bool = False) -> ResolvedSkill:
     """将数据库 Skill 适配为统一的有效 
```

**File**: `backend/package/yuxi/agents/toolkits/buildin/install_skill.py` (modified, +1/-14)
```diff
@@ -13,7 +13,6 @@
 from yuxi.agents.backends.paths import VIRTUAL_PATH_PREFIX, VIRTUAL_PERSONAL_SKILLS_PATH
 from yuxi.agents.backends.sandbox.download import download_sandbox_directory
 from yuxi.agents.toolkits.registry import tool
-from yuxi.storage.postgres.manager import pg_manager
 from yuxi.utils.logging_config import logger
 
 SANDBOX_PATH_HINT = "请使用当前 Project Workdir 下的目录，或 /home/gem/user-data/..."
@@ -107,14 +106,10 @@ async def _run_install_task(
         )
 
     try:
-        from yuxi.agents.skills.service import (
-            enable_personal_skills_for_agent_config,
-            install_personal_skill_dir,
-        )
+        from yuxi.agents.skills.service import install_personal_skill_dir
 
         installed_slugs: list[str] = []
         failed_items: list[dict] = []
-        config_success = True
 
         if source.startswith("/"):
             with tempfile.TemporaryDirectory(prefix=".skill-install-") as tmp:
@@ -159,12 +154,6 @@ async def _run_install_task(
             finally:
                 await preparation.cleanup()
 
-        if installed_slugs:
-            async with pg_manager.get_async_session_context() as db:
-                config_success = await enable_personal_skills_for_agent_config(
-                    db, thread_id=thread_id, uid=uid, skill_slugs=installed_slugs
-                )
-
         lines = []
         if installed_slugs:
             lines.append(f"已安装 Skill: {', '.join(installed_slugs)}")
@@ -173,8 +162,6 @@ async def _run_install_task(
         if failed_items:
             for item in failed_items:
                 lines.append(f"安装失败 ({item['slug']}): {item.get('error', '未知错误')}")
-        if not config_success:
-            lines.append("Skill 已安装，但当前 Agent 配置未更新，请手动启用")
         if not installed_slugs and not failed_items:
             lines.append("未发现需要安装的 Skill")
 
```

**File**: `backend/test/e2e/test_personal_skill_agent_e2e.py` (modified, +14/-5)
```diff
@@ -1,19 +1,20 @@
 from __future__ import annotations
 
+import json
 import uuid
 from typing import Any
 
+import asyncpg
 import httpx
 import pytest
 
-from e2e_helpers import cancel_run, consume_events, skip_if_external_quota, wait_for_run
+from e2e_helpers import cancel_run, consume_events, postgres_dsn, skip_if_external_quota, wait_for_run
 from test.live_api_cleanup import (
     make_test_conversation_metadata,
     make_test_conversation_title,
     remove_e2e_thread_storage,
 )
 from yuxi.agents.skills.service import get_personal_skills_root_dir, get_user_skills_root_dir
-from yuxi.agents.backends.paths import VIRTUAL_PERSONAL_SKILLS_PATH
 
 pytestmark = [pytest.mark.asyncio, pytest.mark.e2e, pytest.mark.slow]
 
@@ -23,7 +24,7 @@ async def test_main_agent_reads_personal_skill_directly_from_user_workspace(
     e2e_headers: dict[str, str],
     e2e_agent_context: dict[str, str],
 ):
-    """真实主 Agent 应从 UserWorkspace 直接读取个人 SKILL.md。"""
+    """共享选择为空时，真实主 Agent 仍发现并读取个人 SKILL.md。"""
     uid = e2e_agent_context["uid"]
     marker = f"PERSONAL_SKILL_E2E_{uuid.uuid4().hex[:10].upper()}"
     slug = f"pytest-personal-agent-{uuid.uuid4().hex[:8]}"
@@ -56,13 +57,13 @@ async def test_main_agent_reads_personal_skill_directly_from_user_workspace(
         default_context = ((default_response.json().get("agent") or {}).get("config_json") or {}).get("context") or {}
         context: dict[str, Any] = {
             "system_prompt": (
-                f"收到请求后必须先读取 {VIRTUAL_PERSONAL_SKILLS_PATH}/{slug}/SKILL.md，"
+                f"收到请求后从可用 Skills 中找到 {slug} 并读取其 SKILL.md，"
                 "然后严格遵循其中的 Verification 指令，不要添加解释。"
             ),
             "tools": [],
             "knowledges": [],
             "mcps": [],
-            "skills": [slug],
+            "skills": [],
             "subagents": [],
         }
         if default_context.get("model"):
@@ -124,6 +125,14 @@ async def test_main_agent_reads_personal_skill_directly_from_user_workspace(
         assert result_response.status_code == 200, result_response.text
         assert marker in str(result_response.json().get("output") or ""), result_response.text
 
+        conn = await asyncpg.connect(postgres_dsn())
+        try:
+            raw_manifest = await conn.fetchval("SELECT manifest FROM agent_runs WHERE id = $1", run_id)
+            manifest = json.loads(raw_manifest) if isinstance(raw_manifest, str) else raw_manifest
+            assert slug in {item["slug"] for item in manifest["resources"]["skills"]}
+        finally:
+            await conn.close()
+
         personal_skill = get_personal_skills_root_dir(uid) / slug / "SKILL.md"
         assert personal_skill.read_text(encoding="utf-8") == skill_md
         projected_skill = get_user_skills_root_dir(uid) / slug / "SKILL.md"
```

---

### Incident Patch 2: `a72c0438` (2026-09-28)
**Commit Message**: fix: 降低 worker 健康检查与前端轮询的空闲开销 (#1086)

**File**: `backend/package/yuxi/services/readiness_service.py` (modified, +1/-2)
```diff
@@ -11,8 +11,6 @@
 
 from sqlalchemy import text
 from yuxi.services.run_queue_service import (
-    WORKER_HEALTH_KEY,
-    WORKER_HEALTH_MAX_TTL_MS,
     WORKER_RECONCILIATION_HEALTH_KEY,
     WORKER_RECONCILIATION_HEALTH_TTL_SECONDS,
     get_redis_client,
@@ -21,6 +19,7 @@
     TASK_RECONCILIATION_HEALTH_KEY,
     TASK_RECONCILIATION_HEALTH_TTL_SECONDS,
 )
+from yuxi.services.worker_health import WORKER_HEALTH_KEY, WORKER_HEALTH_MAX_TTL_MS
 from yuxi.storage.postgres.manager import pg_manager
 
 READINESS_PROBE_TIMEOUT_SECONDS = float(os.getenv("READINESS_PROBE_TIMEOUT_SECONDS", "2"))
```

**File**: `backend/package/yuxi/services/run_queue_service.py` (modified, +1/-6)
```diff
@@ -7,18 +7,13 @@
 import os
 from datetime import UTC, datetime
 
+from yuxi.services.worker_health import WORKER_HEALTH_KEY
 from yuxi.storage.redis import close_async_redis_client, create_arq_redis_pool, get_async_redis_client
 from yuxi.utils.logging_config import logger
 
 RUN_CANCEL_KEY_TTL_SECONDS = int(os.getenv("RUN_CANCEL_KEY_TTL_SECONDS", "1800"))
 RUN_EVENTS_STREAM_TTL_SECONDS = int(os.getenv("RUN_EVENTS_STREAM_TTL_SECONDS", "7200"))
 RUN_EVENTS_STREAM_MAXLEN = int(os.getenv("RUN_EVENTS_STREAM_MAXLEN", "0"))
-WORKER_HEALTH_CONTRACT = "agent-run-v1"
-WORKER_HEALTH_KEY = f"yuxi:worker:health:{WORKER_HEALTH_CONTRACT}"
-WORKER_HEALTH_INTERVAL_SECONDS = float(os.getenv("WORKER_HEALTH_INTERVAL_SECONDS", "5"))
-if not 0 < WORKER_HEALTH_INTERVAL_SECONDS <= 10:
-    raise ValueError("WORKER_HEALTH_INTERVAL_SECONDS 必须大于 0 且不超过 10")
-WORKER_HEALTH_MAX_TTL_MS = int((WORKER_HEALTH_INTERVAL_SECONDS + 1) * 1000)
 RUN_RECONCILIATION_SECONDS = 30
 WORKER_RECONCILIATION_HEALTH_KEY = f"{WORKER_HEALTH_KEY}:lease-reconciliation"
 WORKER_RECONCILIATION_HEALTH_TTL_SECONDS = RUN_RECONCILIATION_SECONDS * 2 + 5
```

**File**: `backend/package/yuxi/services/run_worker.py` (modified, +1/-2)
```diff
@@ -33,8 +33,6 @@
 from yuxi.services.input_message_service import restore_chat_input_message
 from yuxi.services.run_queue_service import (
     RUN_RECONCILIATION_SECONDS,
-    WORKER_HEALTH_INTERVAL_SECONDS,
-    WORKER_HEALTH_KEY,
     WORKER_RECONCILIATION_HEALTH_KEY,
     WORKER_RECONCILIATION_HEALTH_TTL_SECONDS,
     append_run_stream_event,
@@ -59,6 +57,7 @@
     resolve_authorized_workdir,
     resolve_conversation_workdir_path,
 )
+from yuxi.services.worker_health import WORKER_HEALTH_INTERVAL_SECONDS, WORKER_HEALTH_KEY
 from yuxi.storage.postgres.manager import pg_manager
 from yuxi.storage.postgres.models_business import AgentRun, Conversation, Message, User
 from yuxi.storage.redis import get_arq_redis_settings
```

**File**: `backend/package/yuxi/services/worker_health.py` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+"""ARQ 消费心跳契约与轻量 Compose 健康检查。"""
+
+import os
+import sys
+
+from yuxi.storage.redis import RedisConfig, sync_redis_client
+
+WORKER_HEALTH_CONTRACT = "agent-run-v1"
+WORKER_HEALTH_KEY = f"yuxi:worker:health:{WORKER_HEALTH_CONTRACT}"
+WORKER_HEALTH_INTERVAL_SECONDS = float(os.getenv("WORKER_HEALTH_INTERVAL_SECONDS", "5"))
+if not 0 < WORKER_HEALTH_INTERVAL_SECONDS <= 10:
+    raise ValueError("WORKER_HEALTH_INTERVAL_SECONDS 必须大于 0 且不超过 10")
+WORKER_HEALTH_MAX_TTL_MS = int((WORKER_HEALTH_INTERVAL_SECONDS + 1) * 1000)
+
+
+def main() -> int:
+    """读取有界心跳租约，失败时仅输出错误类型以避免泄露连接凭据。"""
+    try:
+        config = RedisConfig.from_env(socket_timeout=2, socket_connect_timeout=2)
+        with sync_redis_client(config, ping=False) as client:
+            with client.pipeline() as pipeline:
+                pipeline.get(WORKER_HEALTH_KEY)
+                pipeline.pttl(WORKER_HEALTH_KEY)
+                value, ttl_ms = pipeline.execute()
+        if not value or not 0 < ttl_ms <= WORKER_HEALTH_MAX_TTL_MS:
+            print("worker health lease missing or invalid", file=sys.stderr)
+            return 1
+    except Exception as exc:
+        print(f"worker health check failed: {type(exc).__name__}", file=sys.stderr)
+        return 1
+    return 0
+
+
+if __name__ == "__main__":
+    sys.exit(main())
```

**File**: `backend/test/integration/services/test_worker_health_redis.py` (added, +69/-0)
```diff
@@ -0,0 +1,69 @@
+"""使用真实 ARQ 心跳和 Redis 验证轻量探针。"""
+
+import asyncio
+import uuid
+
+import pytest
+import pytest_asyncio
+from arq import create_pool
+from arq.worker import Worker
+from yuxi.services import worker_health
+from yuxi.storage.redis import get_arq_redis_settings
+
+pytestmark = [pytest.mark.asyncio, pytest.mark.integration]
+
+
+async def unused_job(ctx):
+    """满足 ARQ 注册约束，健康检查测试不投递任务。"""
+
+
+@pytest_asyncio.fixture
+async def health_redis(monkeypatch):
+    """健康键和队列仅属于本测试，清理不影响共享 worker。"""
+    redis = await create_pool(get_arq_redis_settings())
+    key = f"pytest-worker-health:{uuid.uuid4().hex}"
+    monkeypatch.setattr(worker_health, "WORKER_HEALTH_KEY", key)
+    try:
+        yield redis, key
+    finally:
+        await redis.delete(key)
+        await redis.aclose()
+
+
+async def test_arq_heartbeat_expires_without_renewal(health_redis):
+    """ARQ 原生心跳可通过探针，停止续租后由 Redis 过期事实拒绝。"""
+    redis, key = health_redis
+    worker = Worker(
+        functions=[unused_job],
+        redis_pool=redis,
+        queue_name=f"{key}:queue",
+        health_check_key=key,
+        health_check_interval=0.1,
+        handle_signals=False,
+    )
+    await worker.record_health()
+    assert await redis.get(key)
+    assert 0 < await redis.pttl(key) <= 1100
+    assert worker_health.main() == 0
+    await asyncio.sleep(1.2)
+    assert await redis.get(key) is None
+    assert worker_health.main() == 1
+
+
+@pytest.mark.parametrize("state", ["missing", "empty", "persistent", "excessive"])
+async def test_invalid_redis_leases_fail(health_redis, state):
+    """Redis 中的非法心跳不能维持健康状态。"""
+    redis, key = health_redis
+    if state == "empty":
+        await redis.set(key, b"", px=1000)
+    elif state == "persistent":
+        await redis.set(key, b"alive")
+    elif state == "excessive":
+        await redis.set(key, b"alive", px=worker_health.WORKER_HEALTH_MAX_TTL_MS + 60000)
+    assert worker_health.main() == 1
+
+
+async def test_unreachable_redis_fails(monkeypatch):
+    """连接拒绝产生非零结果。"""
+    monkeypatch.setenv("REDIS_URL", "redis://127.0.0.1:1/0")
+    assert worker_health.main() == 1
```

---

### Incident Patch 3: `41ed2735` (2026-09-28)
**Commit Message**: fix(web): 组合输入状态下按回车不再误发送 (#1085)

**File**: `web/src/components/AgentInputArea.vue` (modified, +5/-0)
```diff
@@ -257,6 +257,11 @@ const handleKeyDown = (e) => {
     return
   }
 
+  // 输入法仍在组合状态时，回车用于确认候选词，不应触发发送
+  if (e.isComposing || e.keyCode === 229) {
+    return
+  }
+
   if (e.key === 'Enter' && !e.shiftKey) {
     e.preventDefault()
     handleSend()
```

**File**: `web/test/unit/agentInputAreaCompositionGuard.test.js` (added, +22/-0)
```diff
@@ -0,0 +1,22 @@
+import assert from 'node:assert/strict'
+import { readFileSync } from 'node:fs'
+import test from 'node:test'
+
+const source = readFileSync(
+  new URL('../../src/components/AgentInputArea.vue', import.meta.url),
+  'utf8'
+)
+
+const handleKeyDown = source.slice(
+  source.indexOf('const handleKeyDown'),
+  source.indexOf('defineExpose')
+)
+
+test('输入法还在组合状态时，回车不触发发送', () => {
+  assert.ok(handleKeyDown.includes('isComposing'), 'handleKeyDown 缺少 e.isComposing 判据')
+  assert.ok(handleKeyDown.includes('229'), 'handleKeyDown 缺少 keyCode 229 兜底判据')
+  assert.ok(
+    handleKeyDown.indexOf('isComposing') < handleKeyDown.indexOf("e.key === 'Enter'"),
+    '组合输入判据必须排在回车发送分支之前'
+  )
+})
```

---

### Incident Patch 4: `8bfc2e88` (2026-09-28)
**Commit Message**: fix: preserve auto-summary failure atomicity (#1082)

**File**: `backend/package/yuxi/agents/middlewares/summary.py` (modified, +20/-33)
```diff
@@ -2,11 +2,9 @@
 
 from __future__ import annotations
 
-import asyncio
 import hashlib
 import json
 import re
-import warnings
 from collections.abc import Awaitable, Callable, Iterable
 from contextvars import ContextVar
 from typing import Any
@@ -215,7 +213,7 @@ def _wrap_model_call_with_compaction(
         offloaded_messages, failed_media = self._offload_inline_media(self._backend, messages_to_summarize)
         session_id = self._get_session_id(request.state)
         file_path = self._offload_to_backend(self._backend, offloaded_messages, session_id)
-        self._report_offload_result(file_path, failed_media)
+        self._require_offload_result(file_path, failed_media)
 
         summary = self._create_summary(offloaded_messages)
         new_messages = self._build_new_messages_with_path(summary, file_path)
@@ -283,12 +281,10 @@ async def _awrap_model_call_with_compaction(
             messages_to_summarize,
         )
         session_id = self._get_session_id(request.state)
-        file_path, summary = await asyncio.gather(
-            self._aoffload_to_backend(self._backend, offloaded_messages, session_id),
-            self._acreate_summary(offloaded_messages),
-        )
-        self._report_offload_result(file_path, failed_media)
+        file_path = await self._aoffload_to_backend(self._backend, offloaded_messages, session_id)
+        self._require_offload_result(file_path, failed_media)
 
+        summary = await self._acreate_summary(offloaded_messages)
         new_messages = self._build_new_messages_with_path(summary, file_path)
         new_event = self._build_summary_event(request.state, cutoff_index, new_messages[0], file_path)
         response = await handler(request.override(messages=[*new_messages, *preserved_messages]))
@@ -358,27 +354,23 @@ def _build_summary_prompt(self, messages: list[AnyMessage]) -> str | None:
         return self._lc_helper.summary_prompt.format(messages=get_buffer_string(trimmed, format="xml")).rstrip()
 
     def _create_summary(self, messages: list[AnyMessage]) -> str:
-        if not messages:
-            return "No previous conversation history."
-        prompt = self._build_summary_prompt(messages)
+        prompt = self._build_summary_prompt(messages) if messages else None
         if prompt is None:
-            return "Previous conversation was too long to summarize."
-        try:
-            return self.model.invoke(prompt, config=self._SUMMARY_INVOKE_CONFIG).text.strip()
-        except Exception as exc:
-            return f"Error generating summary: {exc!s}"
+            raise RuntimeError("没有可供自动压缩的对话历史")
+        summary = self.model.invoke(prompt, config=self._SUMMARY_INVOKE_CONFIG).text.strip()
+        if not summary:
+            raise RuntimeError("摘要模型返回空内容")
+        return summary
 
     async def _acreate_summary(self, messages: list[AnyMessage]) -> str:
-        if not messages:
-            return "No previous conversation history."
-        prompt = self._build_summary_prompt(messages)
+        prompt = self._build_summary_prompt(messages) if messages else None
         if prompt is None:
-            return "Previous conversation was too long to summarize."
-        try:
-            response = await self.model.ainvoke(prompt, config=self._SUMMARY_INVOKE_CONFIG)
-            return response.text.strip()
-        except Exception as exc:
-            return f"Error generating summary: {exc!s}"
+            raise RuntimeError("没有可供自动压缩的对话历史")
+        response = await self.model.ainvoke(prompt, config=self._SUMMARY_INVOKE_CONFIG)
+        summary = response.text.strip()
+        if not summary:
+            raise RuntimeError("摘要模型返回空内容")
+        return summary
 
     async def _acreate_summary_or_raise(self, messages: list[AnyMessage]) -> str:
         prompt = self._build_summary_prompt(messages) if messages else None
@@ -426,15 +418,10 @@ def _build_state_update(
         return update
 
     @staticmethod
-    def _report_offload_res
```

**File**: `backend/test/unit/middlewares/test_summary_middleware.py` (modified, +107/-2)
```diff
@@ -47,6 +47,18 @@ def invoke(self, prompt: str, config: dict | None = None) -> SimpleNamespace:
         return SimpleNamespace(text="summary")
 
 
+class _FailingSummaryModel(_RecordingModel):
+    def invoke(self, prompt: str, config: dict | None = None) -> SimpleNamespace:
+        self.prompts.append(prompt)
+        raise RuntimeError("summary failed")
+
+
+class _EmptySummaryModel(_RecordingModel):
+    def invoke(self, prompt: str, config: dict | None = None) -> SimpleNamespace:
+        self.prompts.append(prompt)
+        return SimpleNamespace(text="  ")
+
+
 class _MemoryBackend:
     def __init__(self) -> None:
         self.writes: list[tuple[str, str]] = []
@@ -86,6 +98,13 @@ def write(self, path: str, content: str) -> SimpleNamespace:
         return SimpleNamespace(error="disk full")
 
 
+class _FailingHistoryWriteBackend(_MemoryBackend):
+    def write(self, path: str, content: str) -> SimpleNamespace:
+        if path.startswith(VIRTUAL_PATH_CONVERSATION_HISTORY):
+            return SimpleNamespace(error="disk full")
+        return super().write(path, content)
+
+
 def _scoped_backend(memory: _MemoryBackend | None = None) -> CompositeBackend:
     """按 Yuxi 契约构造 outputs 根的 CompositeBackend，验证前缀自动派生。"""
     return CompositeBackend(
@@ -921,10 +940,14 @@ def test_offload_history_uses_tool_messages_with_replaced_content() -> None:
     assert "TOOL_RESULT_SHOULD_NOT_BE_SUMMARIZED" not in history_content
 
 
-def _make_compressing_middleware(backend: _MemoryBackend) -> tuple[YuxiSummarizationMiddleware, str]:
+def _make_compressing_middleware(
+    backend: _MemoryBackend,
+    *,
+    model: _DummyModel | None = None,
+) -> tuple[YuxiSummarizationMiddleware, str]:
     large_result = "BEGIN\n" + ("raw result payload\n" * 200)
     middleware = YuxiSummarizationMiddleware(
-        model=_RecordingModel(),
+        model=model or _RecordingModel(),
         backend=backend,
         trigger=("tokens", 100),
         keep=("messages", 3),
@@ -979,6 +1002,88 @@ def handler(request: ModelRequest) -> ModelResponse:
     assert completed.get("file_path") is not None
 
 
+@pytest.mark.unit
+@pytest.mark.parametrize("async_call", [False, True], ids=["sync", "async"])
+async def test_auto_summary_fails_when_history_cannot_be_saved(
+    compression_events: list[dict],
+    async_call: bool,
+) -> None:
+    backend = _FailingHistoryWriteBackend()
+    model = _RecordingModel()
+    middleware, large_result = _make_compressing_middleware(backend, model=model)
+    messages = _compressing_messages(large_result)
+    handler_calls = 0
+
+    if async_call:
+
+        async def handler(request: ModelRequest) -> ModelResponse:
+            nonlocal handler_calls
+            handler_calls += 1
+            return ModelResponse(result=[AIMessage(content="ok")])
+
+        with pytest.raises(RuntimeError, match="无法保存可恢复的对话历史"):
+            await middleware.awrap_model_call(_model_request(messages), handler)
+    else:
+
+        def handler(request: ModelRequest) -> ModelResponse:
+            nonlocal handler_calls
+            handler_calls += 1
+            return ModelResponse(result=[AIMessage(content="ok")])
+
+        with pytest.raises(RuntimeError, match="无法保存可恢复的对话历史"):
+            middleware.wrap_model_call(_model_request(messages), handler)
+
+    assert handler_calls == 0
+    assert model.prompts == []
+    assert [event["status"] for event in compression_events] == ["started", "failed"]
+
+
+@pytest.mark.unit
+@pytest.mark.parametrize("async_call", [False, True], ids=["sync", "async"])
+@pytest.mark.parametrize(
+    ("model_type", "error_match"),
+    [
+        pytest.param(_FailingSummaryModel, "summary failed", id="model_error"),
+        pytest.param(_EmptySummaryModel, "摘要模型返回空内容", id="empty_summary"),
+    ],
+)
+async def test_auto_summary_propagates_summary_failure(
+    compression_events: list[dict],
+    async_call: bool,
+    model_type: type[_RecordingModel],
+    error_match: str,
+) -> None:
```

**File**: `docs/develop-guides/decisions/implemented/2026-09-27-auto-summary-failure-atomicity.md` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+# 自动摘要失败保持 checkpoint 原子性
+
+状态：implemented
+类型：bug-fix
+Owner：backend/package/yuxi/agents/middlewares/summary.py
+
+## 问题
+
+自动摘要把模型异常转换为 `Error generating summary: ...` 文本，并在历史文件写入失败时只记录警告。主模型随后会把错误文本当作对话历史继续运行，checkpoint 也可能保存无法回读原文的 `_summarization_event`。异步路径并发执行历史落盘和摘要调用，落盘失败时仍可能产生无用的摘要请求。
+
+## 决策
+
+自动摘要采用 fail-closed 边界。历史文件写入失败、摘要模型抛出异常或摘要内容为空时，当前模型调用直接失败，不调用主模型，也不构造新的 `_summarization_event`。PostgreSQL 中的聊天消息和 checkpoint 中已有的摘要事件保持不变。
+
+### 实现方案
+
+同步路径先保存待摘要历史并校验文件路径，再调用摘要模型和校验非空结果。异步路径按相同顺序串行执行，只有两个步骤都成功后才构造模型消息和 checkpoint update。外围 `wrap_model_call` / `awrap_model_call` 继续负责发送 `failed` 压缩事件并传播原异常。主动压缩已有的严格失败行为不变。
+
+本决定只处理自动压缩失败原子性，不改变动态模型窗口阈值、按 token 保留消息、摘要 prompt、usage 统计或 85% 手动压缩提示。
+
+## 替代方案
+
+- 保留警告并继续主模型调用：会把不可恢复或错误的摘要视图当成有效历史，拒绝采用。
+- 历史落盘和摘要继续并发，在汇总结果后统一失败：可以阻止 checkpoint 更新，但落盘失败时仍会产生无效的摘要调用。
+- 失败后回退到未压缩历史调用主模型：上下文已经达到压缩条件或发生 overflow，回退不能保证请求可执行，并会掩盖压缩失败。
+
+## 后果
+
+自动压缩失败会使当前 Run 进入既有错误通道，调用方可以观察真实失败原因；成功路径仍保存可恢复历史、生成摘要并更新 checkpoint。异步摘要失去一次与文件写入并行的延迟优化，以换取明确的先决条件和避免无效模型调用。
+
+## 验证
+
+| 验收主张 | 失败面 | 语义 Owner | 直接证据 / 命令 | 负向案例 | 当前结果 |
+|---|---|---|---|---|---|
+| 历史落盘失败不调用摘要模型或主模型 | 警告后继续并发布 event | summary.py | summary middleware unit | 同步和异步历史写入返回 `disk full` | Passed |
+| 摘要异常或空内容不进入模型历史 | 错误文本或空摘要进入 checkpoint | summary.py | summary middleware unit | 同步和异步摘要分别抛错、返回空白 | Passed |
+| 成功、overflow 和主动压缩路径保持原行为 | fail-closed 误伤正常调用 | summary.py | `test_summary_middleware.py` 全文件 35 passed | 既有成功与主动压缩用例 | Passed |
+
+最小回归命令：`docker compose exec -T api uv run --no-sync --no-dev pytest test/unit/middlewares/test_summary_middleware.py -q`。本地隔离依赖环境执行同一测试文件通过；完整 Compose gate 和真实模型 integration 由 PR 验证记录说明。
```

**File**: `docs/mechanisms/context-compression.md` (modified, +3/-1)
```diff
@@ -44,6 +44,8 @@ token 数使用近似计算，只用于压力判断和预览长度，不是计
 
 成功后，`_summarization_event` 保存累计 cutoff、摘要消息和历史文件路径。后续请求根据这个事件跳过已摘要区间，只发送当前摘要和 cutoff 之后的原始消息。再次压缩时，局部 cutoff 会换算成完整 state 的位置。
 
+自动压缩先保存历史文件，再调用摘要模型。只有历史文件和非空摘要都成功生成后，系统才构造新的 `_summarization_event`；任一步失败都会中止当前模型调用，并保留 checkpoint 中已有的摘要事件。
+
 checkpoint 只拥有模型继续运行所需的压缩视图；PostgreSQL Message 继续保存完整聊天记录。system prompt 和 tool schemas 由每次运行的当前 Agent 配置重新装配，不存入摘要 event。
 
 ## 主动压缩
@@ -87,7 +89,7 @@ Summary 触发使用近似 token 统计；主模型返回的 `usage_metadata` 
 
 ## 失败和恢复
 
-自动摘要无法保存历史文件时会记录错误，较早原文可能无法从 Workdir 恢复；摘要模型失败时错误文本会进入摘要视图，主模型调用仍可能继续。主动压缩要求历史文件和摘要都成功，失败时返回错误且不发布新的摘要 event。
+自动摘要无法保存历史文件、摘要模型报错或返回空内容时，当前模型调用失败并发送 `failed` 事件。系统不会把错误文本写入摘要视图，也不会创建或更新 `_summarization_event`。主动压缩保持相同的失败边界：历史文件和摘要都成功后才发布新的摘要 event。
 
 | 现象 | 先检查 |
 | --- | --- |
```

---

### Incident Patch 5: `7bd90b17` (2026-09-28)
**Commit Message**: fix: 统一供应商启用与保存交互 Fix: #1076

**File**: `web/src/components/model-management/ModelProviderManagePanel.vue` (modified, +81/-27)
```diff
@@ -58,6 +58,8 @@ const REQUEST_BODY_OVERRIDES_PLACEHOLDER = '{\n  "enable_thinking": false\n}'
 // Provider form state
 const showProviderModal = ref(false)
 const editingProviderId = ref(null) // null = creating, string = editing
+const originalProviderEnabled = ref(null)
+const originalProviderFields = ref('')
 const providerForm = reactive({
   provider_id: '',
   display_name: '',
@@ -77,6 +79,10 @@ const providerForm = reactive({
   headers_text: '{}',
   extra_text: '{}'
 })
+// 启用状态由标题栏独立保存，不计入其他字段的未保存判断。
+const hasUnsavedProviderFields = computed(
+  () => JSON.stringify({ ...providerForm, is_enabled: null }) !== originalProviderFields.value
+)
 
 // Model form state
 const showModelModal = ref(false)
@@ -325,6 +331,7 @@ function getProviderStatus(provider) {
 
 const openCreateProviderModal = () => {
   editingProviderId.value = null
+  originalProviderEnabled.value = null
   Object.assign(providerForm, {
     provider_id: '',
     display_name: '',
@@ -349,6 +356,7 @@ const openCreateProviderModal = () => {
 
 const openEditProviderModal = (provider) => {
   editingProviderId.value = provider.provider_id
+  originalProviderEnabled.value = provider.is_enabled !== false
   Object.assign(providerForm, {
     provider_id: provider.provider_id,
     display_name: provider.display_name,
@@ -368,6 +376,7 @@ const openEditProviderModal = (provider) => {
     headers_text: formatJsonText(provider.headers_json),
     extra_text: formatJsonText(provider.extra_json)
   })
+  originalProviderFields.value = JSON.stringify({ ...providerForm, is_enabled: null })
   showProviderModal.value = true
 }
 
@@ -428,21 +437,48 @@ const saveProvider = async () => {
   }
 }
 
-const saveProviderAndEnable = async () => {
+/** 只提交供应商启用状态，并在停用成功后关闭编辑弹窗。 */
+const applyProviderEnabled = async (enabled) => {
   saving.value = true
   try {
-    const payload = { ...buildProviderPayload(), is_enabled: true }
-    await modelProviderApi.updateProvider(providerForm.provider_id, payload)
-    message.success('供应商已保存并启用')
-    showProviderModal.value = false
+    await modelProviderApi.updateProvider(providerForm.provider_id, { is_enabled: enabled })
+    originalProviderEnabled.value = enabled
+    providerForm.is_enabled = enabled
+    if (!enabled) showProviderModal.value = false
     await loadProviders()
+    message.success(`供应商已${enabled ? '启用' : '停用'}`)
   } catch (error) {
-    message.error(error.message || '保存失败')
+    message.error(error?.response?.data?.detail || error.message || '切换供应商状态失败')
   } finally {
     saving.value = false
   }
 }
 
+/** 切换启用状态前保护默认模型与未保存的其他配置。 */
+const toggleProviderEnabled = (enabled) => {
+  if (saving.value) return
+  if (!editingProviderId.value) {
+    providerForm.is_enabled = enabled
+    return
+  }
+  if (!enabled && providerContainsDefaultModel(providerForm.provider_id)) {
+    warnDefaultModelProtected()
+    return
+  }
+  if (!enabled && hasUnsavedProviderFields.value) {
+    Modal.confirm({
+      title: '停用供应商？',
+      content: '弹窗内未保存的其他修改将丢弃；此操作只保存启用状态。',
+      okText: '停用',
+      okType: 'danger',
+      cancelText: '继续编辑',
+      onOk: () => applyProviderEnabled(enabled)
+    })
+    return
+  }
+  applyProviderEnabled(enabled)
+}
+
 const deleteProvider = async (provider) => {
   if (providerContainsDefaultModel(provider.provider_id)) {
     warnDefaultModelProtected()
@@ -476,6 +512,7 @@ const deleteProvider = async (provider) => {
 }
 
 const deleteProviderFromEdit = async () => {
+  if (saving.value) return
   const provider = providers.value.find((p) => p.provider_id === editingProviderId.value)
   if (provider) {
     deleteProvider(provider)
@@ -831,42 +868,52 @@ defineExpose({
     <!-- Provider Edit Modal -->
     <a-modal
       v-model:open="showProviderModal"
-      :title="editingProviderId ? '编辑供应商' : '新增供应商'"
       :width="560"
-      :confirm-loading="saving"
+      :closable="false"
+      :mask-closable="!saving"
+      :keyboard="!saving"
     >
+      <template #title
```

**File**: `web/test/unit/modelProviderSaveActions.test.js` (added, +235/-0)
```diff
@@ -0,0 +1,235 @@
+import assert from 'node:assert/strict'
+import { readFileSync, unlinkSync, writeFileSync } from 'node:fs'
+import { pid } from 'node:process'
+import { setImmediate } from 'node:timers'
+import { fileURLToPath, pathToFileURL } from 'node:url'
+import test from 'node:test'
+
+import { compileScript, parse } from 'vue/compiler-sfc'
+import { createRenderer, nextTick } from 'vue'
+
+const componentPath = fileURLToPath(
+  new URL('../../src/components/model-management/ModelProviderManagePanel.vue', import.meta.url)
+)
+const compiledPath = fileURLToPath(
+  new URL(`../../.model-provider-actions-test-${pid}.mjs`, import.meta.url)
+)
+const source = readFileSync(componentPath, 'utf8')
+const requests = []
+const confirmations = []
+const notices = []
+const configStore = { config: { default_model: 'other:model' }, refreshConfig: async () => {} }
+let updateProvider = async () => ({})
+
+globalThis.__modelProviderActionsTestDeps = {
+  message: {
+    success: (value) => notices.push(['success', value]),
+    error: (value) => notices.push(['error', value]),
+    warning: (value) => notices.push(['warning', value])
+  },
+  Modal: { confirm: (options) => confirmations.push(options) },
+  useConfigStore: () => configStore,
+  modelProviderApi: {
+    getProviders: async () => ({ data: [provider] }),
+    updateProvider: (id, payload) => {
+      requests.push([id, payload])
+      return updateProvider(id, payload)
+    }
+  },
+  TextInitial: null,
+  Image: null,
+  Video: null,
+  AudioLines: null,
+  FileText: null
+}
+
+const { descriptor } = parse(source)
+const compiled = compileScript(descriptor, { id: 'model-provider-actions-test' }).content
+const executable = compiled
+  .replace(/^import(?:\s*\{[\s\S]*?\}|\s+[A-Za-z]\w*)\s+from\s+'[^']+'\n/gm, (line) =>
+    line.includes("from 'vue'") ? line : ''
+  )
+  .replace(
+    /const __returned__ = \{[\s\S]*?\}\nObject\.defineProperty/,
+    'const __returned__ = { showProviderModal, originalProviderEnabled, providerForm, saving, openCreateProviderModal, openEditProviderModal, toggleProviderEnabled, deleteProviderFromEdit }\nObject.defineProperty'
+  )
+  .replace(
+    "import { computed, onMounted, reactive, ref } from 'vue'",
+    "import { computed, onMounted, reactive, ref } from 'vue'\nconst { message, Modal, useConfigStore, modelProviderApi, TextInitial, Image, Video, AudioLines, FileText } = globalThis.__modelProviderActionsTestDeps"
+  )
+writeFileSync(compiledPath, executable)
+let ProviderPanel
+try {
+  ;({ default: ProviderPanel } = await import(pathToFileURL(compiledPath).href))
+} finally {
+  unlinkSync(compiledPath)
+}
+ProviderPanel.render = () => null
+
+const makeNode = (type) => ({ type, children: [], props: {}, parent: null, text: '' })
+const renderer = createRenderer({
+  createElement: makeNode,
+  createText: (value) => ({ ...makeNode('text'), text: value }),
+  createComment: (value) => ({ ...makeNode('comment'), text: value }),
+  insert(child, parent) {
+    child.parent = parent
+    parent.children.push(child)
+  },
+  remove(child) {
+    const index = child.parent?.children.indexOf(child) ?? -1
+    if (index >= 0) child.parent.children.splice(index, 1)
+  },
+  setText(node, value) {
+    node.text = value
+  },
+  setElementText(node, value) {
+    node.text = value
+    node.children = []
+  },
+  parentNode: (node) => node.parent,
+  nextSibling: () => null,
+  patchProp(node, key, _previous, value) {
+    node.props[key] = value
+  }
+})
+
+function mountPanel() {
+  requests.length = 0
+  confirmations.length = 0
+  notices.length = 0
+  updateProvider = async () => ({})
+  configStore.config.default_model = 'other:model'
+  const app = renderer.createApp(ProviderPanel)
+  app.mount(makeNode('root'))
+  return { panel: app._instance.setupState, unmount: () => app.unmount() }
+}
+
+const provider = { provider_id: 'sample', display_name: 'Sample', is_enabled: true }
+const flushAsync = () => new Promise((resolve) => setIm
```

---

### Incident Patch 6: `255edc3e` (2026-09-27)
**Commit Message**: fix: 收敛聊天多图消息交接并完善回归验证

**File**: `.github/workflows/system-tests.yml` (modified, +5/-0)
```diff
@@ -200,6 +200,11 @@ jobs:
             buildkit-minio-${{ runner.os }}-
       - name: Build topology images with cached layers
         run: bash scripts/ci_build_topology_images.sh /tmp/yuxi-buildkit-cache/api /tmp/yuxi-buildkit-cache/sandbox-provisioner /tmp/yuxi-buildkit-cache/minio
+      # 冷 runner 的镜像下载属于环境准备，不能消耗单个 Run 的执行预算。
+      - name: Pull sandbox runtime image before timed E2E runs
+        run: |
+          sandbox_runtime_image=$(docker compose config --format json | python3 -c 'import json, sys; print(json.load(sys.stdin)["services"]["sandbox-provisioner"]["environment"]["SANDBOX_IMAGE"])')
+          docker pull "$sandbox_runtime_image"
       - name: Start focused runtime topology
         run: docker compose up -d postgres redis minio sandbox-provisioner api worker
       - name: Wait for truthful readiness
```

**File**: `docs/develop-guides/decisions/implemented/2026-09-25-chat-multi-image.md` (modified, +2/-0)
```diff
@@ -4,6 +4,8 @@
 类型：feature
 Owner：backend/package/yuxi/services/input_message_service.py
 
+前端排队与派发的消息归属由[聊天多图的本地消息归属](./2026-09-27-chat-image-message-ownership.md)进一步收敛。
+
 ## 问题
 
 聊天输入框原先一次只能携带**一张**图片，限制写在四层：前端 file input 单选、前端单值状态、请求体 `image_content: str | None`、消息构造单参数。模型侧不是瓶颈——`deepseek-flash` 单请求上限 600 张，且实测能直读图片。
```

**File**: `docs/develop-guides/decisions/implemented/2026-09-27-chat-image-message-ownership.md` (added, +35/-0)
```diff
@@ -0,0 +1,35 @@
+# 聊天多图的本地消息归属
+
+状态：implemented
+类型：simplification
+Owner：web/src/components/AgentChatComponent.vue
+
+## 问题
+
+多图消息在 sending → queued → 队列同步 → run_created 之间重新构造，图片字段会被只含文字的队列投影覆盖。派发后请求从服务端队列消失，而对应 SSE 事件可能尚未到达。按 request ID 单独保存图片又需要另一套清理生命周期。
+
+## 决策
+
+发送时只构造一次乐观用户消息。等待派发时由队列项的本地 message 持有；请求流在首个 await 前接住同一消息引用，在队列同步或主动派发前建立订阅。派发后将消息交给现有 msgChunks，请求流关闭时清理引用。队列快照只更新服务端协议字段，仍以 PostgreSQL 队列状态为准。
+
+直接运行与排队运行共享消息构造。SSE init 使用现有图片补齐；历史读取继续使用持久化投影。本决定收敛[多图输入决定](./2026-09-25-chat-multi-image.md)中的前端派发路径，不改变 HTTP、持久化、数量与体积契约。
+
+## 替代方案
+
+- keep：保留逐次重建，运行期间图片展示缺失。
+- narrow：逐次复制 image_contents；每次扩充用户消息都需维护额外字段清单。
+- replace：队列与请求流携带同一用户消息，派发时交接，采用。
+- remove：移除专门的乐观消息插入包装和队列图片字段重建。历史和旧单值 API 兼容仍有消费者，保留。
+
+## 后果
+
+本地消息引用沿现有队列、订阅和消息区生命周期移动。取消、失败与派发复用请求流的清理。页面重载依赖服务端历史，浏览器内的引用不承担持久化职责。
+
+## 验证
+
+- Web unit 组装队列快照、请求 SSE 与 Run init，验证单图、多图顺序和派发时附件保留；修改前图片断言失败，修改后通过。
+- 空快照先于 run_created 到达的测试覆盖恢复订阅、继续队列与 steer，三条用例在修复前均失败。
+- 取消测试验证只释放目标请求；占位上传测试保留并发数量与顺序约束。
+- 浏览器探针使用真实 Vue 消息组件与队列模块、受控接口响应，检查派发和 init 后图片 DOM；不替代真实模型和后端 E2E。
+- 旧能力不存在：运行时代码搜索 sentImagesByRequest、insertOptimisticHumanMessage 均无命中，队列派发不再拼装 image_contents/image_content 字段；无新增 export、配置、wire 字段、迁移或依赖。
+- 重新引入条件：出现无法由用户消息生命周期承载的独立图片业务时，再评估专用缓存。
```

**File**: `docs/develop-guides/decisions/implemented/2026-09-27-ci-sandbox-image-preparation.md` (added, +27/-0)
```diff
@@ -0,0 +1,27 @@
+# 确定性 E2E 的沙盒镜像准备
+
+状态：implemented
+类型：testing
+Owner：.github/workflows/system-tests.yml
+
+## 问题
+
+Runtime System Tests 的冷 runner 只预先构建 API、provisioner 和 MinIO 镜像。首次 execute 创建沙盒时，Docker SDK 在镜像不存在的情况下同步拉取镜像，下载时间计入 E2E 的 240 秒 Run 预算。审批恢复测试在 main 与多图 PR 上均出现等待 SSE 超时，清理后执行请求返回 sandbox not found。
+
+## 决策
+
+focused runtime job 在启动拓扑前，读取 Compose 解析后的 SANDBOX_IMAGE 并执行 docker pull。下载失败归属环境准备步骤。Run 超时、断言、测试选择器和真实沙盒调用保持不变。
+
+## 替代方案
+
+- 延长 Run 超时：混淆环境下载与执行耗时，不采用。
+- 跳过 execute 或改为 mock：无法验证审批恢复后的真实工具审计与落盘，不采用。
+- 在 workflow 硬编码镜像：与 Compose 事实源重复，不采用。
+
+## 后果
+
+首次镜像下载仍需时间，但位于独立可诊断步骤。该改动只影响 CI；shipping runtime 继续惰性创建沙盒。
+
+## 验证
+
+Docker SDK 的 ImageNotFound 分支确实执行同步 images.pull；CI 使用解析后的 Compose 镜像。原失败用例仍由同一 workflow 执行，最终结果以该提交实际 CI 为准，镜像预拉取本身不证明业务正确。
```

**File**: `web/src/components/AgentChatComponent.vue` (modified, +14/-48)
```diff
@@ -2535,27 +2535,13 @@ const buildOptimisticHumanMessage = ({
   }
 
   if (imageContents.length) {
-    // 必须用列表键：用单值键时 2..10 张在乐观阶段只显示第一张
     message.image_contents = imageContents
     message.image_content = imageContents[0]
   }
 
   return message
 }
 
-// 发送 runs 前先在前端插入一条用户消息，避免等待 worker 轮询后消息才出现。
-const insertOptimisticHumanMessage = (
-  threadState,
-  { requestId, text, imageContents = [], attachments = [] }
-) => {
-  if (!threadState || !requestId) return
-  threadState.pendingRequestId = requestId
-  threadState.replyLoadingVisible = false
-  threadState.onGoingConv.msgChunks[requestId] = [
-    buildOptimisticHumanMessage({ requestId, text, imageContents, attachments })
-  ]
-}
-
 const markAttachmentsRequestId = (threadId, attachments, requestId) => {
   if (!threadId || !attachments.length) return null
   const previousAttachments = threadAttachmentsMap.value[threadId] || []
@@ -3375,28 +3361,24 @@ const handleSendMessage = async ({ images = [], queuePolicy = 'enqueue' } = {})
 
   const requestId = createClientRequestId()
   const previousAttachments = markAttachmentsRequestId(threadId, pendingAttachments, requestId)
+  const inputMessage = buildOptimisticHumanMessage({
+    requestId,
+    text,
+    imageContents,
+    attachments: pendingAttachments.map((attachment) => ({ ...attachment, request_id: requestId }))
+  })
   if (!hadActiveRun) {
     resetOnGoingConv(threadId)
-    insertOptimisticHumanMessage(threadState, {
-      requestId,
-      text,
-      imageContents,
-      attachments: pendingAttachments.map((attachment) => ({
-        ...attachment,
-        request_id: requestId
-      }))
-    })
+    threadState.pendingRequestId = requestId
+    threadState.onGoingConv.msgChunks[requestId] = [inputMessage]
     threadState.isStreaming = true
   } else {
     threadState.queuedRequests.push({
       request_id: requestId,
       status: 'sending',
       content: text,
-      created_at: new Date().toISOString(),
-      // 图片必须一并记住：这条本地排队项会在派发时被用来重建用户消息
-      ...(imageContents.length
-        ? { message_type: 'multimodal_image', image_contents: imageContents, image_content: imageContents[0] }
-        : {})
+      created_at: inputMessage.created_at,
+      message: inputMessage
     })
   }
 
@@ -3416,9 +3398,6 @@ const handleSendMessage = async ({ images = [], queuePolicy = 'enqueue' } = {})
     })
     const status = runResp?.status
     const runId = runResp?.run_id
-    const sendingRequest = threadState.queuedRequests.find(
-      (request) => request.request_id === requestId
-    )
     threadState.queuedRequests = threadState.queuedRequests.filter(
       (request) => request.request_id !== requestId
     )
@@ -3430,37 +3409,24 @@ const handleSendMessage = async ({ images = [], queuePolicy = 'enqueue' } = {})
       }
     }
     if (status === 'queued' || (!runId && status !== 'rejected')) {
-      for (const msg of threadState.onGoingConv.msgChunks[requestId] || []) {
-        if (msg.type === 'human') msg.delivery_status = 'queued'
-      }
+      inputMessage.delivery_status = 'queued'
       threadState.queuedRequests = threadState.queuedRequests || []
       threadState.queuedRequests.push({
         request_id: requestId,
         status: 'queued',
         queue_policy: runResp?.queue_policy || queuePolicy,
         queue_position: runResp?.queue_position || 1,
         content: text,
-        created_at: sendingRequest?.created_at
+        created_at: inputMessage.created_at,
+        message: inputMessage
       })
       if (!hadActiveRun) {
         threadState.isStreaming = false
         threadState.replyLoadingVisible = false
       }
       await resumeQueuedRequests(threadId, resolveAgentSlugForThread(threadId))
     } else if (runId) {
-      if (sendingRequest) {
-        threadState.onGoingConv.msgChunks[requestId] = [
-          {
-            ...buildOptimisticHumanMessage({
-              requestId,
-              text,
-              imageContents,
-         
```

---

### Incident Patch 7: `23576378` (2026-09-27)
**Commit Message**: fix(deploy): MinIO 镜像改为仓库内构建 (#1077)

MinIO 官方镜像的三个来源都已不可用：Docker Hub 于 2026-09-11 前后移除
minio/minio 与 minio/mc，quay.io 自 2026-09-24 起拒绝匿名拉取，dl.min.io
返回 410。两份 Compose 在新机器上因此无法启动，CI 的两条 system-tests job
也恒定失败（main 自身同样失败，所有 PR 都拿不到这两条绿色检查）。

新增 docker/minio/Dockerfile 与入口脚本：构建参数固定 MinIO 版本与两个架构
各自的 sha256，运行时按 TARGETARCH 选择对应的官方 GitHub Release 资产、下载
后校验，校验不通过即构建失败。下架前镜像内的 /opt/bin/minio 与该 Release 的
amd64 资产逐字节相同，因此重建后的运行时内容不变。

两份 Compose 的 MinIO 服务改为本地构建，环境变量、卷、健康检查与 command
保持不变；离线导出脚本与 init 预热脚本改为构建后再导出/预热；CI 的预构建
脚本与层缓存纳入该镜像。

验证：三方 sha256 一致（镜像内文件、Release 声明、下架前镜像）；同一数据
目录下下架前镜像写入 → 自建镜像读出并写回 → 下架前镜像读回均成功；
docker compose up -d minio 后 healthcheck 达到 healthy，容器内
/minio/health/live 可达，9001 控制台仍在监听；以 TARGETARCH=arm64 构建成功，
以 s390x 与错误的 sha256 各验证一次显式失败；全仓符号搜索无遗留外部引用；
工程契约检查、62 项契约单测、docs build 与 git diff --check 通过。

独立 Review 后修正：quay.io 的失效归因改为「minio/minio 这个仓库不再公开」
（同 registry 的 coreos/etcd 匿名拉取仍正常，实测 token 授予 pull 且 manifest 200）；
离线导出脚本改为从 compose 解析镜像名，避免与写在 .env 里的 COMPOSE_PROJECT_NAME
漂移，并保持「尽力拉取、由 docker save 把关」的容错；curl 增加 --retry-all-errors；
被实测证伪的负向案例与不成立的绝对化表述改为如实说明。

未验证：本 PR 自身的 CI 结果；arm64 主机上的实际运行；CI 的 buildx 路径
（本机未安装 buildx）；两个 PowerShell 脚本仅静态审阅（本机无 pwsh）。



**File**: `.github/workflows/system-tests.yml` (modified, +16/-2)
```diff
@@ -81,8 +81,15 @@ jobs:
           key: buildkit-sandbox-provisioner-${{ runner.os }}-${{ hashFiles('docker/sandbox_provisioner/requirements.txt', 'docker/sandbox_provisioner/Dockerfile') }}
           restore-keys: |
             buildkit-sandbox-provisioner-${{ runner.os }}-
+      - name: Restore minio image layer cache
+        uses: actions/cache@v4
+        with:
+          path: /tmp/yuxi-buildkit-cache/minio
+          key: buildkit-minio-${{ runner.os }}-${{ hashFiles('docker/minio/Dockerfile', 'docker/minio/docker-entrypoint.sh') }}
+          restore-keys: |
+            buildkit-minio-${{ runner.os }}-
       - name: Build topology images with cached layers
-        run: bash scripts/ci_build_topology_images.sh /tmp/yuxi-buildkit-cache/api /tmp/yuxi-buildkit-cache/sandbox-provisioner
+        run: bash scripts/ci_build_topology_images.sh /tmp/yuxi-buildkit-cache/api /tmp/yuxi-buildkit-cache/sandbox-provisioner /tmp/yuxi-buildkit-cache/minio
       - name: Start durable-task runtime topology
         run: docker compose up -d postgres redis minio etcd milvus sandbox-provisioner api worker
       - name: Wait for durable-task topology readiness
@@ -184,8 +191,15 @@ jobs:
           key: buildkit-sandbox-provisioner-${{ runner.os }}-${{ hashFiles('docker/sandbox_provisioner/requirements.txt', 'docker/sandbox_provisioner/Dockerfile') }}
           restore-keys: |
             buildkit-sandbox-provisioner-${{ runner.os }}-
+      - name: Restore minio image layer cache
+        uses: actions/cache@v4
+        with:
+          path: /tmp/yuxi-buildkit-cache/minio
+          key: buildkit-minio-${{ runner.os }}-${{ hashFiles('docker/minio/Dockerfile', 'docker/minio/docker-entrypoint.sh') }}
+          restore-keys: |
+            buildkit-minio-${{ runner.os }}-
       - name: Build topology images with cached layers
-        run: bash scripts/ci_build_topology_images.sh /tmp/yuxi-buildkit-cache/api /tmp/yuxi-buildkit-cache/sandbox-provisioner
+        run: bash scripts/ci_build_topology_images.sh /tmp/yuxi-buildkit-cache/api /tmp/yuxi-buildkit-cache/sandbox-provisioner /tmp/yuxi-buildkit-cache/minio
       - name: Start focused runtime topology
         run: docker compose up -d postgres redis minio sandbox-provisioner api worker
       - name: Wait for truthful readiness
```

**File**: `docker-compose.prod.yml` (modified, +4/-1)
```diff
@@ -298,10 +298,13 @@ services:
     restart: unless-stopped
 
   minio:
+    build:
+      context: ./docker/minio
+      dockerfile: Dockerfile
     ports:
       - "127.0.0.1:${YUXI_MINIO_API_PORT:-10000}:9000"
       - "127.0.0.1:${YUXI_MINIO_CONSOLE_PORT:-10001}:9001"
-    image: quay.io/minio/minio:RELEASE.2023-03-20T20-16-18Z
+    image: ${COMPOSE_PROJECT_NAME:-yuxi}-minio:RELEASE.2023-03-20T20-16-18Z
     environment:
       MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY:?Set MINIO_ACCESS_KEY in .env.prod}
       MINIO_SECRET_KEY: ${MINIO_SECRET_KEY:?Set MINIO_SECRET_KEY in .env.prod}
```

**File**: `docker-compose.yml` (modified, +4/-1)
```diff
@@ -355,7 +355,10 @@ services:
     restart: unless-stopped
 
   minio:
-    image: quay.io/minio/minio:RELEASE.2023-03-20T20-16-18Z
+    build:
+      context: ./docker/minio
+      dockerfile: Dockerfile
+    image: ${COMPOSE_PROJECT_NAME:-yuxi}-minio:RELEASE.2023-03-20T20-16-18Z
     environment:
       MINIO_ACCESS_KEY: ${MINIO_ACCESS_KEY:-minioadmin}
       MINIO_SECRET_KEY: ${MINIO_SECRET_KEY:-minioadmin}
```

**File**: `docker/minio/Dockerfile` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+# MinIO 的官方镜像已不再公开分发：Docker Hub 于 2026-09-11 前后移除 minio/minio 与
+# minio/mc，quay.io 上 minio/minio 这个仓库自 2026-09-24 起不再对匿名用户公开（同一
+# registry 上其他镜像仍可匿名拉取），dl.min.io 返回 410。此处按官方 GitHub Release
+# 发布的二进制重建镜像：版本与 sha256 都取自 release 资产并在构建时校验，运行的是与
+# 下架前镜像逐字节相同的 MinIO 二进制（基础镜像与镜像内附带文件不同，见部署文档）。
+FROM alpine:3.20
+
+ARG MINIO_VERSION=RELEASE.2023-03-20T20-16-18Z
+# 来源：https://github.com/minio/minio/releases/download/<版本>/minio.linux-<arch>.<版本>.sha256sum
+ARG MINIO_SHA256_AMD64=df0de9982c4ae440d2c9617bc1da805cf71eb7d9ce5b106b3fdb036fa27ba163
+ARG MINIO_SHA256_ARM64=d9c80afe0455f30726457ed7af0af28e1dc8a506ebaf2418ed7d89d763674ff2
+ARG TARGETARCH
+
+# curl 供 Compose 的健康检查使用
+RUN apk add --no-cache ca-certificates curl
+
+RUN set -eux; \
+    arch="${TARGETARCH:-$(apk --print-arch)}"; \
+    case "$arch" in \
+        amd64|x86_64) sha256="${MINIO_SHA256_AMD64}"; asset="minio.linux-amd64.${MINIO_VERSION}";; \
+        arm64|aarch64) sha256="${MINIO_SHA256_ARM64}"; asset="minio.linux-arm64.${MINIO_VERSION}";; \
+        *) echo "MinIO 未提供该架构的二进制: ${arch}" >&2; exit 1;; \
+    esac; \
+    mkdir -p /opt/bin; \
+    curl -fsSL --retry 5 --retry-delay 2 --retry-all-errors -o /opt/bin/minio \
+        "https://github.com/minio/minio/releases/download/${MINIO_VERSION}/${asset}"; \
+    echo "${sha256}  /opt/bin/minio" | sha256sum -c -; \
+    chmod +x /opt/bin/minio
+
+# 与原镜像保持一致：二进制位于 /opt/bin，且该目录在 PATH 中
+ENV PATH="/opt/bin:${PATH}"
+
+COPY docker-entrypoint.sh /usr/bin/docker-entrypoint.sh
+RUN chmod 0755 /usr/bin/docker-entrypoint.sh
+
+EXPOSE 9000 9001
+
+ENTRYPOINT ["/usr/bin/docker-entrypoint.sh"]
+CMD ["minio"]
```

**File**: `docker/minio/docker-entrypoint.sh` (added, +10/-0)
```diff
@@ -0,0 +1,10 @@
+#!/bin/sh
+# 与原镜像的 /usr/bin/docker-entrypoint.sh 保持同一语义：命令首项不是 minio 时自动前置，
+# 因此 `command: minio server ...` 与 `docker run <镜像> server ...` 都能工作。
+# 原脚本另支持用 MINIO_USERNAME/MINIO_GROUPNAME 切换运行用户；仓库两份 Compose 都未使用，
+# 故不引入 useradd/setpriv 依赖。
+if [ "${1}" != "minio" ] && [ -n "${1}" ]; then
+    set -- minio "$@"
+fi
+
+exec "$@"
```

---

### Incident Patch 8: `4eeecf86` (2026-09-24)
**Commit Message**: fix(sandbox): 合并原生 grep 搜索修复

合并 feat/sandbox-grep-nul-fix，保留 main 既有提交，无冲突。

验证：完整 main 挂载至隔离 yuxi-api:0.7.3 测试容器，pytest test/unit -m not-slow 对应选择器通过 2357 项（6 warnings）；工程契约与其 62 项单测通过；此前真实沙盒 HTTP/ToolMessage 集成与独立 Review 已通过。

环境限制：Compose uv run 被已安装 editable 包写权限阻断；直接 python 的 Compose 测试有 2 项沙盒 profile 预期失败及 58 项仓库文件缺失跳过，完整仓库隔离测试全部通过。完整 Agent/worker E2E 未执行。

**File**: `backend/package/yuxi/agents/backends/sandbox/backend.py` (modified, +70/-1)
```diff
@@ -13,6 +13,7 @@
 
 import httpx
 from deepagents.backends.protocol import (
+    ASYNC_GREP_TIMEOUT,
     EditResult,
     ExecuteResponse,
     FileDownloadResponse,
@@ -714,6 +715,52 @@ def edit(
 
         return EditResult(path=normalized_path, occurrences=count if replace_all else 1)
 
+    def _grep_root(self, pattern: str, path: str, glob: str | None, max_count: int | None) -> GrepResult:
+        """调用沙盒原生文件搜索并映射结构化结果。"""
+        if glob and ".." in glob.replace("\\", "/").split("/"):
+            return GrepResult(error="Invalid glob pattern: path traversal is not allowed")
+        kwargs: dict[str, Any] = {
+            "path": path,
+            "pattern": pattern,
+            "fixed_strings": True,
+            "recursive": True,
+        }
+        if glob:
+            # 原生 include 按完整路径匹配，目录 glob 必须锚定到当前搜索根。
+            escaped_root = "".join("\\" + char if char in "\\*?[]{}" else char for char in path.rstrip("/"))
+            kwargs["include"] = [f"{escaped_root}/{glob.lstrip('/')}" if "/" in glob else glob]
+        if max_count is not None:
+            kwargs["max_results"] = max_count
+        try:
+            from agent_sandbox.types import FileGrepResult
+
+            connection = self._get_connection()
+            # SDK 0.0.30 把失败响应也解码为成功模型，HTTP 边界先区分两者。
+            response = httpx.post(
+                f"{connection.sandbox_url.rstrip('/')}/v1/file/grep",
+                json=kwargs,
+                headers={"Authorization": f"Bearer {sandbox_provisioner_token()}"},
+                timeout=ASYNC_GREP_TIMEOUT,
+            )
+            response.raise_for_status()
+            payload = response.json()
+            if payload.get("success") is not True:
+                if (payload.get("data") or {}).get("error_type") == "not_found":
+                    return GrepResult(matches=[])
+                return GrepResult(error=payload.get("message") or "Sandbox grep failed")
+            data = FileGrepResult.model_validate(payload["data"])
+            if data.truncated is None:
+                return GrepResult(error="Invalid sandbox grep result")
+            matches = [
+                {"path": match.file, "line": match.line_number, "text": match.line_content}
+                for match in data.matches or []
+            ]
+            if len(json.dumps(matches, ensure_ascii=False).encode("utf-8")) > self._max_output_bytes:
+                return GrepResult(error="grep output exceeded sandbox limit")
+            return GrepResult(matches=matches, truncated=data.truncated)
+        except Exception as exc:  # noqa: BLE001
+            return GrepResult(error=str(exc) or "Sandbox grep failed")
+
     def grep(
         self,
         pattern: str,
@@ -742,7 +789,7 @@ def grep(
                     break
             else:
                 remaining = None
-            result = super().grep(pattern=pattern, path=search_path, glob=glob, max_count=remaining)
+            result = self._grep_root(pattern, search_path, glob, remaining)
             if result.error:
                 return result
             matches.extend(result.matches or [])
@@ -753,6 +800,28 @@ def grep(
             truncated = True
         return GrepResult(matches=self._filter_readable_matches(matches), truncated=truncated)
 
+    async def agrep(
+        self,
+        pattern: str,
+        path: str | None = None,
+        glob: str | None = None,
+        *,
+        max_count: int | None = None,
+    ) -> GrepResult:
+        """在线程中执行同一授权搜索，避免阻塞 Agent 事件循环。"""
+        try:
+            return await asyncio.wait_for(
+                asyncio.to_thread(self.grep, pattern, path, glob, max_count=max_count),
+                timeout=ASYNC_GREP_TIMEOUT,
+            )
+        except TimeoutError:
+            return GrepResult(
+                error=(
+                    f"Error: grep timed out after {ASYNC_GREP_TIMEOUT}s. "
+                    "Try a more specific pattern or a narrower path."
+              
```

**File**: `backend/test/integration/backends/test_sandbox_native_grep.py` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+"""通过独立沙盒 HTTP 验证原生 grep 与模型工具结果。"""
+
+import os
+import uuid
+from types import SimpleNamespace
+
+import pytest
+from agent_sandbox import Sandbox
+from deepagents.backends import CompositeBackend
+from langgraph.prebuilt.tool_node import ToolRuntime
+
+import yuxi.agents.backends.sandbox.backend as backend_module
+from yuxi.agents.backends.sandbox.backend import ProvisionerSandboxBackend
+from yuxi.agents.backends.composite import create_agent_filesystem_middleware
+
+
+@pytest.mark.asyncio
+async def test_native_grep_http_and_model_tool(monkeypatch):
+    """回读真实文件匹配与 ToolMessage，覆盖传输、过滤和沙盒路径语义。"""
+    url = os.environ.get("TEST_SANDBOX_URL")
+    if not url:
+        pytest.skip("TEST_SANDBOX_URL requires an isolated sandbox")
+    client = Sandbox(base_url=url)
+    root = f"/tmp/yuxi-grep-{uuid.uuid4().hex}"
+    user_root, skills_root = f"{root}/user-data", f"{root}/skills"
+    client.shell.exec_command(command=f"mkdir -p {user_root}/nested {skills_root} {root}/outside")
+    try:
+        for path, content in {
+            f"{user_root}/note:one.txt": "PEARL one\nPEARL two\n",
+            f"{user_root}/nested/code.py": "a.b\naXb\n",
+            f"{user_root}/.hidden": "HIDDEN pearl\n",
+            f"{user_root}/long.txt": "LONG " + "x" * 31000 + "\n",
+            f"{skills_root}/skill.md": "PEARL skill\n",
+            f"{root}/outside/secret": "CONTAINER target\n",
+        }.items():
+            client.file.write_file(file=path, content=content)
+        client.shell.exec_command(command=f"ln -s {root}/outside {user_root}/link")
+        monkeypatch.setattr(backend_module, "_USER_DATA_ROOT", user_root)
+        monkeypatch.setattr(backend_module, "_SKILLS_ROOT", skills_root)
+        monkeypatch.setattr(backend_module, "get_sandbox_provider", lambda: object())
+        backend = ProvisionerSandboxBackend(thread_id="probe", uid="probe")
+        monkeypatch.setattr(backend, "_get_connection", lambda: SimpleNamespace(sandbox_url=url))
+        monkeypatch.setattr(backend_module, "sandbox_provisioner_token", lambda: "probe-token")
+
+        result = backend.grep("PEARL", max_count=3)
+        assert result.error is None
+        assert {(m["path"], m["line"], m["text"]) for m in result.matches} == {
+            (f"{user_root}/note:one.txt", 1, "PEARL one"),
+            (f"{user_root}/note:one.txt", 2, "PEARL two"),
+            (f"{skills_root}/skill.md", 1, "PEARL skill"),
+        }
+        capped = backend.grep("PEARL", max_count=1)
+        assert len(capped.matches) == 1 and capped.truncated
+        literal = await backend.agrep("a.b", path=user_root, glob="nested/**/*.py")
+        assert literal.matches == [{"path": f"{user_root}/nested/code.py", "line": 1, "text": "a.b"}]
+        special_root = f"{user_root}/special[1]{{a,b}}*?"
+        client.shell.exec_command(command=f"mkdir -p '{special_root}/nested'")
+        client.file.write_file(file=f"{special_root}/nested/code.py", content="SPECIAL match\n")
+        special = backend.grep("SPECIAL", path=special_root, glob="nested/**/*.py")
+        assert special.matches == [{"path": f"{special_root}/nested/code.py", "line": 1, "text": "SPECIAL match"}]
+        assert backend.grep("ABSENT").matches == []
+        assert backend.grep("a.b", path=user_root, glob="*.py").matches == literal.matches
+        client.file.write_file(file=f"{user_root}/many.txt", content="MANY match\n" * 501)
+        default_cap = backend.grep("MANY", path=user_root)
+        assert len(default_cap.matches) == 500 and default_cap.truncated
+        explicit_cap = backend.grep("MANY", path=user_root, max_count=501)
+        assert len(explicit_cap.matches) == 501
+        assert backend.grep("HIDDEN", path=user_root).matches == []
+        assert backend.grep("HIDDEN", path=user_root, glob=".*").matches
+        assert backend.grep("LONG", path=user_root).matches[0]["text"] == "LONG " + "x" * 31000
+        assert backend.grep("CONTAINER", path=f"{user_ro
```

**File**: `backend/test/unit/backends/test_sandbox_backends.py` (modified, +128/-2)
```diff
@@ -9,6 +9,7 @@
 import weakref
 from types import MethodType, SimpleNamespace
 
+import httpx
 import pytest
 import yuxi.agents.backends.sandbox.backend as sandbox_backend_module
 from deepagents.backends import CompositeBackend
@@ -1350,7 +1351,7 @@ def test_provisioner_grep_applies_global_max_count_across_roots(monkeypatch) ->
     backend = ProvisionerSandboxBackend(thread_id="thread-1", uid="user-1")
     grep_calls: list[dict] = []
 
-    def _super_grep(self, pattern, path=None, glob=None, *, max_count=None):
+    def _grep_root(pattern, path, glob, max_count):
         grep_calls.append({"path": path, "max_count": max_count})
         count = 3 if path == "/home/gem/user-data" else 2
         matches = [{"path": f"{path}/file-{index}.md", "line": 1, "text": pattern} for index in range(count)]
@@ -1360,7 +1361,7 @@ def _super_grep(self, pattern, path=None, glob=None, *, max_count=None):
             truncated = True
         return GrepResult(matches=matches, truncated=truncated)
 
-    monkeypatch.setattr(sandbox_backend_module.BaseSandbox, "grep", _super_grep)
+    monkeypatch.setattr(backend, "_grep_root", _grep_root)
 
     result = backend.grep("NEEDLE", path="/", max_count=4)
 
@@ -1369,6 +1370,131 @@ def _super_grep(self, pattern, path=None, glob=None, *, max_count=None):
     assert result.truncated is True
 
 
+@pytest.fixture
+def native_grep_backend(monkeypatch):
+    """装配只替换 HTTP 传输的原生搜索后端。"""
+    monkeypatch.setattr(sandbox_backend_module, "get_sandbox_provider", lambda: object())
+    monkeypatch.setattr(sandbox_backend_module, "sandbox_provisioner_token", lambda: "test-token")
+    backend = ProvisionerSandboxBackend(thread_id="thread-1", uid="user-1")
+    monkeypatch.setattr(backend, "_get_connection", lambda: SimpleNamespace(sandbox_url="http://sandbox.test"))
+    return backend
+
+
+@pytest.mark.asyncio
+async def test_provisioner_grep_maps_native_results_for_sync_and_async(monkeypatch, native_grep_backend) -> None:
+    """原生搜索的字段、过滤参数与异步入口保持一致。"""
+    backend = native_grep_backend
+    calls = []
+
+    def post(url, **kwargs):
+        calls.append(kwargs["json"])
+        assert url == "http://sandbox.test/v1/file/grep"
+        return httpx.Response(
+            200,
+            request=httpx.Request("POST", url),
+            json={
+                "success": True,
+                "data": {
+                    "path": "/home/gem/user-data",
+                    "pattern": "a.b",
+                    "matches": [
+                        {"file": "/home/gem/user-data/nested/note:one.py", "line_number": 2, "line_content": "a.b"}
+                    ],
+                    "truncated": True,
+                },
+            },
+        )
+
+    monkeypatch.setattr(sandbox_backend_module.httpx, "post", post)
+    for result in (
+        backend.grep("a.b", path="/home/gem/user-data", glob="nested/**/*.py", max_count=1),
+        await backend.agrep("a.b", path="/home/gem/user-data", glob="nested/**/*.py", max_count=1),
+    ):
+        assert result.error is None
+        assert result.matches == [{"path": "/home/gem/user-data/nested/note:one.py", "line": 2, "text": "a.b"}]
+        assert result.truncated is True
+    assert all(call["fixed_strings"] is True and call["recursive"] is True for call in calls)
+    assert all(call["include"] == ["/home/gem/user-data/nested/**/*.py"] for call in calls)
+    assert all(call["max_results"] == 1 for call in calls)
+
+
+@pytest.mark.parametrize("failure", ["remote", "exception", "malformed", "oversize", "missing", "http"])
+def test_provisioner_grep_handles_native_failures(monkeypatch, native_grep_backend, failure) -> None:
+    """缺失可读根返回空结果，其他失败不能伪装成无匹配。"""
+    backend = native_grep_backend
+
+    def post(url, **kwargs):
+        if failure == "exception":
+            raise httpx.ReadTimeout("request timed out")
+        payload = {
+            "success": True,
+            "data": {
+                "path": "/home/gem/user-data",
+       
```

**File**: `docs/develop-guides/decisions/implemented/2026-09-24-sandbox-grep-nul-transport.md` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+# 沙盒原生文件搜索适配
+
+状态：implemented
+类型：simplification
+Owner：backend/package/yuxi/agents/backends/sandbox/backend.py
+
+## 问题
+
+DeepAgents 的 grep 结果以 NUL 分隔文件名与行号，sandbox shell 文本通道丢失 NUL 后导致命中结果解析失败。自建 Python 搜索脚本会重复承担遍历、glob、文件打开和匹配职责。Sandbox 1.11.0 已提供结构化文件搜索 API。
+
+## 决策
+
+Yuxi 直接调用 `/v1/file/grep`，使用 `fixed_strings=true`，把原生路径、行号、文本和截断标志映射为 `GrepResult`。请求使用现有 sandbox connection 与 provisioner 凭据；搜索根和跨根全局 `max_count` 由 backend 拥有。同步和异步入口使用同一搜索流程，HTTP 请求与异步等待均有超时。目录 glob 转为以当前搜索根锚定的完整路径过滤，路径前缀中的 glob 元字符按原生规则转义。
+
+agent-sandbox 0.0.30 把 HTTP 200 下的 `success=false` 错误也解析为成功模型，缺失目录因此触发 `data.pattern` 校验异常。HTTP 适配先检查状态与 success，只有成功数据交给 SDK 的 `FileGrepResult` 校验。`not_found` 返回空结果，其他失败明确返回错误；不解析异常字符串判断缺失目录。
+
+用户明确接受原生搜索的容器内符号链接行为。请求路径仍必须位于可读根，glob 拒绝 `..`；显式根内链接可以读取容器内目标，结果路径过滤不被视为 no-follow 授权。跨用户隔离仍由 provisioner 的 uid、挂载与独立容器执行。宿主 Workspace 的 no-follow 契约保持独立。
+
+## 替代方案
+
+保留或收窄内嵌搜索脚本仍需维护遍历与文件读取；Base64 包装保留了 shell 传输及第三方命令模板耦合；严格 no-follow 搜索需要执行端能力与镜像交付改造。原生 API 薄适配删除重复搜索实现，接受原生语义。移除 grep 会破坏现有模型文件工具 consumer。
+
+## 后果
+
+原生服务默认不搜索隐藏文件，可通过显式 glob 选择。未指定 `max_count` 时采用 1.11.0 每根 500 条的原生默认限额并透传截断标志；显式限额按剩余额度传给各根。结果顺序由服务拥有。单根匹配序列化后的 UTF-8 大小超过 `SANDBOX_MAX_OUTPUT_BYTES` 时返回错误，该限制在收到响应后检查，不是远端内存限制。异步等待或 HTTP 超时不承诺终止远端搜索进程。
+
+## 验证
+
+旧能力不存在：`_GREP_SCRIPT`、`shlex` 和 grep 专用 shell `truncate` 参数均已删除。
+重新引入条件：原生 API 出现无法在薄适配内解决的已复现缺陷，并重新评估执行端 Owner 与交付成本。
+
+- Passed：`docker run --rm --user 0 --entrypoint python -v "$PWD:/workspace" -w /workspace/backend yuxi-api:0.7.3 -m pytest test/unit -m 'not slow' -q -p no:cacheprovider --disable-warnings --tb=short`，2355 项通过，6 项警告。独立工作树无 Compose 槽位，使用开发镜像加载目标代码执行 unit。
+- Passed：临时启动无用户数据挂载、`--network none` 的 sandbox 1.11.0，测试容器使用 `--network container:yuxi-grep-native-probe` 和 `TEST_SANDBOX_URL=http://127.0.0.1:8080`，执行 `python -m pytest test/integration/backends/test_sandbox_native_grep.py --confcutdir=test/integration/backends -q -p no:cacheprovider --tb=short`。回读真实 HTTP 匹配与模型 `ToolMessage`，覆盖字面量、冒号文件名、glob、多根限额、空结果、缺失 Skills 根、隐藏文件、长行、输出上限、特殊目录名及显式链接行为。`--confcutdir` 隔离不相关的全站账户和 provisioner 清理；测试自行清理唯一临时目录。
+- Passed：`python3 scripts/verify_engineering_contracts.py` 与 `python3 -m unittest scripts.test_verify_engineering_contracts`；后者 62 项通过。
+- Passed：`uv tool run ruff check` 与 `uv tool run ruff format --check` 覆盖 backend、unit 与 integration 三个修改文件；`cd docs && pnpm run build` 通过（构建产物体积提示）；`git diff --check HEAD` 通过。
+- Passed：独立 Reviewer 审查最终 diff；审查发现的路径前缀 glob 元字符漏匹配已修复，修复后沙盒 unit 93 项与真实 HTTP 集成 1 项均通过。
+- Not run：完整 Agent/API/worker assembled-path E2E；目标工作树未启动独立完整 Compose 槽位。真实沙盒 HTTP 与模型工具探针不替代 Run 生命周期验证。
```

**File**: `docs/mechanisms/sandbox.md` (modified, +4/-0)
```diff
@@ -56,6 +56,10 @@ Conversation 通过 `project_id` 绑定 Project；Project 拥有这项绑定和
 
 文件访问使用相对路径和 no-follow 原语，拒绝 `..`、符号链接、特殊文件和跨用户根目录。普通运行服务以 `1000:1000` 访问数据；storage migrator 只在停机迁移中承担一次性 root 文件操作。
 
+Agent 的 `grep` 通过沙盒原生文件搜索 API 执行字面量匹配，未指定路径时搜索当前用户的 UserWorkspace 与已授权共享 Skill。结果包含路径、行号、文本和截断标志，并受跨根全局 `max_count` 限制；未指定限额时采用原生服务默认值（1.11.0 每根 500 条），达到限额会标记截断。默认搜索不包含隐藏文件，可通过显式 glob 选择；目录 glob 相对于搜索根。单根结构化结果超过 `SANDBOX_MAX_OUTPUT_BYTES` 时返回明确错误。
+
+搜索请求路径必须属于可读根，glob 拒绝 `..`。原生搜索允许显式指定的根内符号链接指向容器内其他位置；grep 不提供容器内部的 no-follow 隔离。用户之间的隔离由 provisioner 的 uid、挂载与独立容器边界执行，Agent 的 shell 也使用同一容器边界。宿主 Workspace 文件访问继续执行上述 no-follow 契约。
+
 ## Docker 和 Kubernetes
 
 Docker backend 为每个 runtime 创建独立 bridge 网络，不发布沙盒端口，也不加入应用 `app-network`。网络只连接 provisioner 和对应沙盒，因此沙盒不能互访，也不能直接访问 PostgreSQL、Redis、MinIO、Milvus 或 Neo4j。provisioner 复用实例前会检查 uid、Workdir、挂载和网络身份。
```

---

### Incident Patch 9: `7f4bc171` (2026-09-24)
**Commit Message**: fix(sandbox): 使用原生文件搜索修复 grep 结果传输

**File**: `backend/package/yuxi/agents/backends/sandbox/backend.py` (modified, +70/-1)
```diff
@@ -13,6 +13,7 @@
 
 import httpx
 from deepagents.backends.protocol import (
+    ASYNC_GREP_TIMEOUT,
     EditResult,
     ExecuteResponse,
     FileDownloadResponse,
@@ -714,6 +715,52 @@ def edit(
 
         return EditResult(path=normalized_path, occurrences=count if replace_all else 1)
 
+    def _grep_root(self, pattern: str, path: str, glob: str | None, max_count: int | None) -> GrepResult:
+        """调用沙盒原生文件搜索并映射结构化结果。"""
+        if glob and ".." in glob.replace("\\", "/").split("/"):
+            return GrepResult(error="Invalid glob pattern: path traversal is not allowed")
+        kwargs: dict[str, Any] = {
+            "path": path,
+            "pattern": pattern,
+            "fixed_strings": True,
+            "recursive": True,
+        }
+        if glob:
+            # 原生 include 按完整路径匹配，目录 glob 必须锚定到当前搜索根。
+            escaped_root = "".join("\\" + char if char in "\\*?[]{}" else char for char in path.rstrip("/"))
+            kwargs["include"] = [f"{escaped_root}/{glob.lstrip('/')}" if "/" in glob else glob]
+        if max_count is not None:
+            kwargs["max_results"] = max_count
+        try:
+            from agent_sandbox.types import FileGrepResult
+
+            connection = self._get_connection()
+            # SDK 0.0.30 把失败响应也解码为成功模型，HTTP 边界先区分两者。
+            response = httpx.post(
+                f"{connection.sandbox_url.rstrip('/')}/v1/file/grep",
+                json=kwargs,
+                headers={"Authorization": f"Bearer {sandbox_provisioner_token()}"},
+                timeout=ASYNC_GREP_TIMEOUT,
+            )
+            response.raise_for_status()
+            payload = response.json()
+            if payload.get("success") is not True:
+                if (payload.get("data") or {}).get("error_type") == "not_found":
+                    return GrepResult(matches=[])
+                return GrepResult(error=payload.get("message") or "Sandbox grep failed")
+            data = FileGrepResult.model_validate(payload["data"])
+            if data.truncated is None:
+                return GrepResult(error="Invalid sandbox grep result")
+            matches = [
+                {"path": match.file, "line": match.line_number, "text": match.line_content}
+                for match in data.matches or []
+            ]
+            if len(json.dumps(matches, ensure_ascii=False).encode("utf-8")) > self._max_output_bytes:
+                return GrepResult(error="grep output exceeded sandbox limit")
+            return GrepResult(matches=matches, truncated=data.truncated)
+        except Exception as exc:  # noqa: BLE001
+            return GrepResult(error=str(exc) or "Sandbox grep failed")
+
     def grep(
         self,
         pattern: str,
@@ -742,7 +789,7 @@ def grep(
                     break
             else:
                 remaining = None
-            result = super().grep(pattern=pattern, path=search_path, glob=glob, max_count=remaining)
+            result = self._grep_root(pattern, search_path, glob, remaining)
             if result.error:
                 return result
             matches.extend(result.matches or [])
@@ -753,6 +800,28 @@ def grep(
             truncated = True
         return GrepResult(matches=self._filter_readable_matches(matches), truncated=truncated)
 
+    async def agrep(
+        self,
+        pattern: str,
+        path: str | None = None,
+        glob: str | None = None,
+        *,
+        max_count: int | None = None,
+    ) -> GrepResult:
+        """在线程中执行同一授权搜索，避免阻塞 Agent 事件循环。"""
+        try:
+            return await asyncio.wait_for(
+                asyncio.to_thread(self.grep, pattern, path, glob, max_count=max_count),
+                timeout=ASYNC_GREP_TIMEOUT,
+            )
+        except TimeoutError:
+            return GrepResult(
+                error=(
+                    f"Error: grep timed out after {ASYNC_GREP_TIMEOUT}s. "
+                    "Try a more specific pattern or a narrower path."
+              
```

**File**: `backend/test/integration/backends/test_sandbox_native_grep.py` (added, +91/-0)
```diff
@@ -0,0 +1,91 @@
+"""通过独立沙盒 HTTP 验证原生 grep 与模型工具结果。"""
+
+import os
+import uuid
+from types import SimpleNamespace
+
+import pytest
+from agent_sandbox import Sandbox
+from deepagents.backends import CompositeBackend
+from langgraph.prebuilt.tool_node import ToolRuntime
+
+import yuxi.agents.backends.sandbox.backend as backend_module
+from yuxi.agents.backends.sandbox.backend import ProvisionerSandboxBackend
+from yuxi.agents.backends.composite import create_agent_filesystem_middleware
+
+
+@pytest.mark.asyncio
+async def test_native_grep_http_and_model_tool(monkeypatch):
+    """回读真实文件匹配与 ToolMessage，覆盖传输、过滤和沙盒路径语义。"""
+    url = os.environ.get("TEST_SANDBOX_URL")
+    if not url:
+        pytest.skip("TEST_SANDBOX_URL requires an isolated sandbox")
+    client = Sandbox(base_url=url)
+    root = f"/tmp/yuxi-grep-{uuid.uuid4().hex}"
+    user_root, skills_root = f"{root}/user-data", f"{root}/skills"
+    client.shell.exec_command(command=f"mkdir -p {user_root}/nested {skills_root} {root}/outside")
+    try:
+        for path, content in {
+            f"{user_root}/note:one.txt": "PEARL one\nPEARL two\n",
+            f"{user_root}/nested/code.py": "a.b\naXb\n",
+            f"{user_root}/.hidden": "HIDDEN pearl\n",
+            f"{user_root}/long.txt": "LONG " + "x" * 31000 + "\n",
+            f"{skills_root}/skill.md": "PEARL skill\n",
+            f"{root}/outside/secret": "CONTAINER target\n",
+        }.items():
+            client.file.write_file(file=path, content=content)
+        client.shell.exec_command(command=f"ln -s {root}/outside {user_root}/link")
+        monkeypatch.setattr(backend_module, "_USER_DATA_ROOT", user_root)
+        monkeypatch.setattr(backend_module, "_SKILLS_ROOT", skills_root)
+        monkeypatch.setattr(backend_module, "get_sandbox_provider", lambda: object())
+        backend = ProvisionerSandboxBackend(thread_id="probe", uid="probe")
+        monkeypatch.setattr(backend, "_get_connection", lambda: SimpleNamespace(sandbox_url=url))
+        monkeypatch.setattr(backend_module, "sandbox_provisioner_token", lambda: "probe-token")
+
+        result = backend.grep("PEARL", max_count=3)
+        assert result.error is None
+        assert {(m["path"], m["line"], m["text"]) for m in result.matches} == {
+            (f"{user_root}/note:one.txt", 1, "PEARL one"),
+            (f"{user_root}/note:one.txt", 2, "PEARL two"),
+            (f"{skills_root}/skill.md", 1, "PEARL skill"),
+        }
+        capped = backend.grep("PEARL", max_count=1)
+        assert len(capped.matches) == 1 and capped.truncated
+        literal = await backend.agrep("a.b", path=user_root, glob="nested/**/*.py")
+        assert literal.matches == [{"path": f"{user_root}/nested/code.py", "line": 1, "text": "a.b"}]
+        special_root = f"{user_root}/special[1]{{a,b}}*?"
+        client.shell.exec_command(command=f"mkdir -p '{special_root}/nested'")
+        client.file.write_file(file=f"{special_root}/nested/code.py", content="SPECIAL match\n")
+        special = backend.grep("SPECIAL", path=special_root, glob="nested/**/*.py")
+        assert special.matches == [{"path": f"{special_root}/nested/code.py", "line": 1, "text": "SPECIAL match"}]
+        assert backend.grep("ABSENT").matches == []
+        assert backend.grep("a.b", path=user_root, glob="*.py").matches == literal.matches
+        client.file.write_file(file=f"{user_root}/many.txt", content="MANY match\n" * 501)
+        default_cap = backend.grep("MANY", path=user_root)
+        assert len(default_cap.matches) == 500 and default_cap.truncated
+        explicit_cap = backend.grep("MANY", path=user_root, max_count=501)
+        assert len(explicit_cap.matches) == 501
+        assert backend.grep("HIDDEN", path=user_root).matches == []
+        assert backend.grep("HIDDEN", path=user_root, glob=".*").matches
+        assert backend.grep("LONG", path=user_root).matches[0]["text"] == "LONG " + "x" * 31000
+        assert backend.grep("CONTAINER", path=f"{user_ro
```

**File**: `backend/test/unit/backends/test_sandbox_backends.py` (modified, +128/-2)
```diff
@@ -9,6 +9,7 @@
 import weakref
 from types import MethodType, SimpleNamespace
 
+import httpx
 import pytest
 import yuxi.agents.backends.sandbox.backend as sandbox_backend_module
 from deepagents.backends import CompositeBackend
@@ -1350,7 +1351,7 @@ def test_provisioner_grep_applies_global_max_count_across_roots(monkeypatch) ->
     backend = ProvisionerSandboxBackend(thread_id="thread-1", uid="user-1")
     grep_calls: list[dict] = []
 
-    def _super_grep(self, pattern, path=None, glob=None, *, max_count=None):
+    def _grep_root(pattern, path, glob, max_count):
         grep_calls.append({"path": path, "max_count": max_count})
         count = 3 if path == "/home/gem/user-data" else 2
         matches = [{"path": f"{path}/file-{index}.md", "line": 1, "text": pattern} for index in range(count)]
@@ -1360,7 +1361,7 @@ def _super_grep(self, pattern, path=None, glob=None, *, max_count=None):
             truncated = True
         return GrepResult(matches=matches, truncated=truncated)
 
-    monkeypatch.setattr(sandbox_backend_module.BaseSandbox, "grep", _super_grep)
+    monkeypatch.setattr(backend, "_grep_root", _grep_root)
 
     result = backend.grep("NEEDLE", path="/", max_count=4)
 
@@ -1369,6 +1370,131 @@ def _super_grep(self, pattern, path=None, glob=None, *, max_count=None):
     assert result.truncated is True
 
 
+@pytest.fixture
+def native_grep_backend(monkeypatch):
+    """装配只替换 HTTP 传输的原生搜索后端。"""
+    monkeypatch.setattr(sandbox_backend_module, "get_sandbox_provider", lambda: object())
+    monkeypatch.setattr(sandbox_backend_module, "sandbox_provisioner_token", lambda: "test-token")
+    backend = ProvisionerSandboxBackend(thread_id="thread-1", uid="user-1")
+    monkeypatch.setattr(backend, "_get_connection", lambda: SimpleNamespace(sandbox_url="http://sandbox.test"))
+    return backend
+
+
+@pytest.mark.asyncio
+async def test_provisioner_grep_maps_native_results_for_sync_and_async(monkeypatch, native_grep_backend) -> None:
+    """原生搜索的字段、过滤参数与异步入口保持一致。"""
+    backend = native_grep_backend
+    calls = []
+
+    def post(url, **kwargs):
+        calls.append(kwargs["json"])
+        assert url == "http://sandbox.test/v1/file/grep"
+        return httpx.Response(
+            200,
+            request=httpx.Request("POST", url),
+            json={
+                "success": True,
+                "data": {
+                    "path": "/home/gem/user-data",
+                    "pattern": "a.b",
+                    "matches": [
+                        {"file": "/home/gem/user-data/nested/note:one.py", "line_number": 2, "line_content": "a.b"}
+                    ],
+                    "truncated": True,
+                },
+            },
+        )
+
+    monkeypatch.setattr(sandbox_backend_module.httpx, "post", post)
+    for result in (
+        backend.grep("a.b", path="/home/gem/user-data", glob="nested/**/*.py", max_count=1),
+        await backend.agrep("a.b", path="/home/gem/user-data", glob="nested/**/*.py", max_count=1),
+    ):
+        assert result.error is None
+        assert result.matches == [{"path": "/home/gem/user-data/nested/note:one.py", "line": 2, "text": "a.b"}]
+        assert result.truncated is True
+    assert all(call["fixed_strings"] is True and call["recursive"] is True for call in calls)
+    assert all(call["include"] == ["/home/gem/user-data/nested/**/*.py"] for call in calls)
+    assert all(call["max_results"] == 1 for call in calls)
+
+
+@pytest.mark.parametrize("failure", ["remote", "exception", "malformed", "oversize", "missing", "http"])
+def test_provisioner_grep_handles_native_failures(monkeypatch, native_grep_backend, failure) -> None:
+    """缺失可读根返回空结果，其他失败不能伪装成无匹配。"""
+    backend = native_grep_backend
+
+    def post(url, **kwargs):
+        if failure == "exception":
+            raise httpx.ReadTimeout("request timed out")
+        payload = {
+            "success": True,
+            "data": {
+                "path": "/home/gem/user-data",
+       
```

**File**: `docs/develop-guides/decisions/implemented/2026-09-24-sandbox-grep-nul-transport.md` (added, +37/-0)
```diff
@@ -0,0 +1,37 @@
+# 沙盒原生文件搜索适配
+
+状态：implemented
+类型：simplification
+Owner：backend/package/yuxi/agents/backends/sandbox/backend.py
+
+## 问题
+
+DeepAgents 的 grep 结果以 NUL 分隔文件名与行号，sandbox shell 文本通道丢失 NUL 后导致命中结果解析失败。自建 Python 搜索脚本会重复承担遍历、glob、文件打开和匹配职责。Sandbox 1.11.0 已提供结构化文件搜索 API。
+
+## 决策
+
+Yuxi 直接调用 `/v1/file/grep`，使用 `fixed_strings=true`，把原生路径、行号、文本和截断标志映射为 `GrepResult`。请求使用现有 sandbox connection 与 provisioner 凭据；搜索根和跨根全局 `max_count` 由 backend 拥有。同步和异步入口使用同一搜索流程，HTTP 请求与异步等待均有超时。目录 glob 转为以当前搜索根锚定的完整路径过滤，路径前缀中的 glob 元字符按原生规则转义。
+
+agent-sandbox 0.0.30 把 HTTP 200 下的 `success=false` 错误也解析为成功模型，缺失目录因此触发 `data.pattern` 校验异常。HTTP 适配先检查状态与 success，只有成功数据交给 SDK 的 `FileGrepResult` 校验。`not_found` 返回空结果，其他失败明确返回错误；不解析异常字符串判断缺失目录。
+
+用户明确接受原生搜索的容器内符号链接行为。请求路径仍必须位于可读根，glob 拒绝 `..`；显式根内链接可以读取容器内目标，结果路径过滤不被视为 no-follow 授权。跨用户隔离仍由 provisioner 的 uid、挂载与独立容器执行。宿主 Workspace 的 no-follow 契约保持独立。
+
+## 替代方案
+
+保留或收窄内嵌搜索脚本仍需维护遍历与文件读取；Base64 包装保留了 shell 传输及第三方命令模板耦合；严格 no-follow 搜索需要执行端能力与镜像交付改造。原生 API 薄适配删除重复搜索实现，接受原生语义。移除 grep 会破坏现有模型文件工具 consumer。
+
+## 后果
+
+原生服务默认不搜索隐藏文件，可通过显式 glob 选择。未指定 `max_count` 时采用 1.11.0 每根 500 条的原生默认限额并透传截断标志；显式限额按剩余额度传给各根。结果顺序由服务拥有。单根匹配序列化后的 UTF-8 大小超过 `SANDBOX_MAX_OUTPUT_BYTES` 时返回错误，该限制在收到响应后检查，不是远端内存限制。异步等待或 HTTP 超时不承诺终止远端搜索进程。
+
+## 验证
+
+旧能力不存在：`_GREP_SCRIPT`、`shlex` 和 grep 专用 shell `truncate` 参数均已删除。
+重新引入条件：原生 API 出现无法在薄适配内解决的已复现缺陷，并重新评估执行端 Owner 与交付成本。
+
+- Passed：`docker run --rm --user 0 --entrypoint python -v "$PWD:/workspace" -w /workspace/backend yuxi-api:0.7.3 -m pytest test/unit -m 'not slow' -q -p no:cacheprovider --disable-warnings --tb=short`，2355 项通过，6 项警告。独立工作树无 Compose 槽位，使用开发镜像加载目标代码执行 unit。
+- Passed：临时启动无用户数据挂载、`--network none` 的 sandbox 1.11.0，测试容器使用 `--network container:yuxi-grep-native-probe` 和 `TEST_SANDBOX_URL=http://127.0.0.1:8080`，执行 `python -m pytest test/integration/backends/test_sandbox_native_grep.py --confcutdir=test/integration/backends -q -p no:cacheprovider --tb=short`。回读真实 HTTP 匹配与模型 `ToolMessage`，覆盖字面量、冒号文件名、glob、多根限额、空结果、缺失 Skills 根、隐藏文件、长行、输出上限、特殊目录名及显式链接行为。`--confcutdir` 隔离不相关的全站账户和 provisioner 清理；测试自行清理唯一临时目录。
+- Passed：`python3 scripts/verify_engineering_contracts.py` 与 `python3 -m unittest scripts.test_verify_engineering_contracts`；后者 62 项通过。
+- Passed：`uv tool run ruff check` 与 `uv tool run ruff format --check` 覆盖 backend、unit 与 integration 三个修改文件；`cd docs && pnpm run build` 通过（构建产物体积提示）；`git diff --check HEAD` 通过。
+- Passed：独立 Reviewer 审查最终 diff；审查发现的路径前缀 glob 元字符漏匹配已修复，修复后沙盒 unit 93 项与真实 HTTP 集成 1 项均通过。
+- Not run：完整 Agent/API/worker assembled-path E2E；目标工作树未启动独立完整 Compose 槽位。真实沙盒 HTTP 与模型工具探针不替代 Run 生命周期验证。
```

**File**: `docs/mechanisms/sandbox.md` (modified, +4/-0)
```diff
@@ -56,6 +56,10 @@ Conversation 通过 `project_id` 绑定 Project；Project 拥有这项绑定和
 
 文件访问使用相对路径和 no-follow 原语，拒绝 `..`、符号链接、特殊文件和跨用户根目录。普通运行服务以 `1000:1000` 访问数据；storage migrator 只在停机迁移中承担一次性 root 文件操作。
 
+Agent 的 `grep` 通过沙盒原生文件搜索 API 执行字面量匹配，未指定路径时搜索当前用户的 UserWorkspace 与已授权共享 Skill。结果包含路径、行号、文本和截断标志，并受跨根全局 `max_count` 限制；未指定限额时采用原生服务默认值（1.11.0 每根 500 条），达到限额会标记截断。默认搜索不包含隐藏文件，可通过显式 glob 选择；目录 glob 相对于搜索根。单根结构化结果超过 `SANDBOX_MAX_OUTPUT_BYTES` 时返回明确错误。
+
+搜索请求路径必须属于可读根，glob 拒绝 `..`。原生搜索允许显式指定的根内符号链接指向容器内其他位置；grep 不提供容器内部的 no-follow 隔离。用户之间的隔离由 provisioner 的 uid、挂载与独立容器边界执行，Agent 的 shell 也使用同一容器边界。宿主 Workspace 文件访问继续执行上述 no-follow 契约。
+
 ## Docker 和 Kubernetes
 
 Docker backend 为每个 runtime 创建独立 bridge 网络，不发布沙盒端口，也不加入应用 `app-network`。网络只连接 provisioner 和对应沙盒，因此沙盒不能互访，也不能直接访问 PostgreSQL、Redis、MinIO、Milvus 或 Neo4j。provisioner 复用实例前会检查 uid、Workdir、挂载和网络身份。
```

---

### Incident Patch 10: `7e0fdc96` (2026-09-24)
**Commit Message**: fix(graph): 图谱抽取配置拒绝顶层 enable_thinking，提示写在 extra_body 中 (#1070)

* fix(graph): 顶层 enable_thinking 在保存图谱配置时直接报错

model_params 会展开成 ChatOpenAI 的构造参数，顶层 enable_thinking
最终传给 AsyncCompletions.create()，接口不接受这个参数，每个分块的
抽取都会失败。保存配置时就提示应写在 extra_body 中。

Refs #1045

* docs(web): 图谱模型参数说明补充 extra_body 写法

说明关闭思考模式时 enable_thinking 需要放在 extra_body 中。

Refs #1045

**File**: `backend/package/yuxi/knowledge/graphs/extractors/llm.py` (modified, +9/-1)
```diff
@@ -69,8 +69,16 @@ def validate_options(self) -> None:
         # 注意：timeout_seconds 不能通过 model_params 设置——select_model 会把显式的
         # timeout 参数覆盖到 model_params 之上，所以只能在这里读取并显式传入。
         self._resolve_timeout_seconds()
-        if self.options.get("model_params") is not None and not isinstance(self.options["model_params"], dict):
+        model_params = self.options.get("model_params")
+        if model_params is not None and not isinstance(model_params, dict):
             raise ValueError("LLM 抽取器 model_params 必须是对象")
+        # model_params 会展开成 ChatOpenAI 的构造参数，顶层 enable_thinking 最终落到
+        # AsyncCompletions.create() 上，接口直接报未知参数，每块抽取都失败。
+        if model_params and "enable_thinking" in model_params:
+            raise ValueError(
+                "LLM 抽取器 model_params 不支持顶层 enable_thinking，请写在 extra_body 中，"
+                '例如 {"extra_body": {"enable_thinking": false}}'
+            )
 
     async def extract(self, text: str, *, chunk_metadata: dict[str, Any] | None = None) -> dict[str, Any]:
         self.validate_options()
```

**File**: `backend/test/unit/graphs/test_milvus_graph_build.py` (modified, +16/-0)
```diff
@@ -357,6 +357,22 @@ def test_llm_graph_extractor_rejects_invalid_timeout(bad_value):
         extractor.validate_options()
 
 
+def test_llm_graph_extractor_rejects_top_level_enable_thinking():
+    """顶层 enable_thinking 会被当成 create() 的未知参数，保存配置时就要报错。"""
+    extractor = LLMGraphExtractor({"model_spec": "test/model", "model_params": {"enable_thinking": False}})
+
+    with pytest.raises(ValueError, match="extra_body"):
+        extractor.validate_options()
+
+
+def test_llm_graph_extractor_accepts_enable_thinking_in_extra_body():
+    extractor = LLMGraphExtractor(
+        {"model_spec": "test/model", "model_params": {"extra_body": {"enable_thinking": False}}}
+    )
+
+    extractor.validate_options()
+
+
 def test_llm_graph_extractor_appends_schema_to_fixed_prompt():
     extractor = LLMGraphExtractor(
         {
```

**File**: `web/src/components/KnowledgeGraphSection.vue` (modified, +2/-1)
```diff
@@ -329,7 +329,8 @@
             placeholder='例如 {"temperature":0.1}'
           />
           <div class="form-item-hint">
-            输入的 JSON 对象会作为 model_params 传给抽取模型调用；如需设置超时，请使用上方字段。
+            输入的 JSON 对象会作为 model_params 传给抽取模型调用；如需设置超时，请使用上方字段。关闭百炼等模型的思考模式需写在
+            extra_body 中，例如 {"extra_body":{"enable_thinking":false}}。
           </div>
         </a-form-item>
       </a-form>
```

#### Recent Merged Pull Requests:
- **PR #1090** (closed): 同步上游更新 (@Zaelindra)
- **PR #1088** (2026-09-29): feat: 支持共享 Skill 编辑并收敛安装服务边界 (@xerrors)
- **PR #1087** (closed): feat: 统一 Public v1 Agent 会话与 Knowledge 查询接口 (@xerrors)
- **PR #1086** (2026-09-28): fix: 降低 worker 健康检查与前端轮询的空闲开销 (@xerrors)
- **PR #1085** (2026-09-28): fix(web): 组合输入状态下按回车不再误发送 (@sososhuo)
- **PR #1083** (closed): docs: add one-click deploy button (@cosark)
- **PR #1082** (2026-09-28): fix: 保持自动摘要失败的 checkpoint 原子性 (@OUAO-FRANK)
- **PR #1081** (2026-09-28): feat: 统一智能体资源选择为显式 all 与列表 (@xerrors)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

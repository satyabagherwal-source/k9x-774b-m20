# Forensic Learning Record (Deep Inspection): Zleap-AI/SAG

> **Canonical Artifact**: `07_PROJECT_LEARNING/zleap-ai-sag-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/Zleap-AI/SAG](https://github.com/Zleap-AI/SAG))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:17:53.184Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `Zleap-AI/SAG`
- **Description**: A new SOTA for RAG — an original retrieval architecture and an open-source knowledge base for humans and agents.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 2516 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `apps/api/sag_agent/loop.py`
```
from __future__ import annotations

from collections.abc import AsyncIterator, Mapping, Sequence
from typing import Any

from sag_agent.runtime import Agent, AgentRuntime, RuntimeConfig
from sag_agent.types import AgentEvent, AgentMessage


async def agent_loop(
    agent: Agent,
    input: str | AgentMessage | Mapping[str, Any] | None = None,
    *,
    history: Sequence[AgentMessage | Mapping[str, Any]] = (),
    context: Any = None,
    config: RuntimeConfig | None = None,
) -> AsyncIterator[AgentEvent]:
    """Low-level one-run event stream.

    Use AgentRuntime directly when the caller needs cancellation, approvals, replay,
    multiple concurrent runs, or access to the final RunResult.
    """

    async with AgentRuntime(config) as runtime:
        handle = runtime.run(agent, input, history=history, context=context)
        async for event in handle:
            yield event

```

### Core Architecture Module: `apps/api/sag_api/core/attachments.py`
```
"""对话图片附件的落盘与取回 —— 与 HTTP 无关的存储层。

仅图片、≤10MB；id = uuid+原始扩展名（正则校验，杜绝路径穿越）。
API 层（`api/v1/attachments.py`）只做路由与鉴权，消息落库（`services/agent_domain.py`）
与生成层（`generation/prompt.py`）都从这里取磁盘路径，依赖方向单向向下：
API → core，services → core，避免服务层反向 import 路由模块。
"""

from __future__ import annotations

import os
import re

from sag_api.core.config import settings

# 扩展名 → media_type，upload / 取回 / 消息 meta 三处共用一份，避免各自推导漂移
ALLOWED_MEDIA_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
}
MAX_UPLOAD_MB = 10
ATTACHMENT_ID_RE = re.compile(r"^[0-9a-f]{32}\.(png|jpe?g|webp|gif)$")


def attachments_dir() -> str:
    """附件目录（不存在则创建）。"""
    path = os.path.join(settings.upload_dir, "attachments")
    os.makedirs(path, exist_ok=True)
    return path


def attachment_path(attachment_id: str) -> str | None:
    """id → 磁盘路径（校验失败/不存在返回 None）。供生成层复用。"""
    if not ATTACHMENT_ID_RE.match(attachment_id or ""):
        return None
    path = os.path.join(attachments_dir(), attachment_id)
    return path if os.path.isfile(path) else None


def media_type_for_extension(extension: str) -> str | None:
    """扩展名（含点，大小写不敏感）→ media_type；不支持则 None。"""
    return ALLOWED_MEDIA_TYPES.get((extension or "").lower())


def media_type_for_attachment(attachment_id: str) -> str:
    """附件 id → media_type（兜底 octet-stream）。"""
    return ALLOWED_MEDIA_TYPES.get(os.path.splitext(attachment_id or "")[1].lower(), "application/octet-stream")


def attachment_file_path(attachment_id: str) -> str:
    """写入前的目标路径，不校验存在性（供上传落盘使用）。"""
    return os.path.join(attachments_dir(), attachment_id)

```

### Core Architecture Module: `apps/api/sag_api/core/chatbot_config.py`
```
"""Validated connection drafts and protocol-aware inheritance. No database work."""

from __future__ import annotations

import json
import os
from urllib.parse import urlsplit

from cryptography.fernet import Fernet
from pydantic import BaseModel, ConfigDict, Field, ValidationError, model_validator

from sag_api.core.config import Settings
from sag_api.core.errors import ConfigurationError
from sag_api.core.model_providers import MODEL_PROVIDERS, ModelProviderId, get_model_provider
from sag_api.core.responses import ResponsesProviderId, endpoint_url

PROVIDERS = MODEL_PROVIDERS
# SDK factories require a nonempty token; never let a keyless query inherit SDK credentials.
KEYLESS_API_KEY = "sag-keyless-endpoint"
TUNING = (
    "temperature",
    "max_tokens",
    "context_window",
    "timeout_ms",
    "max_retries",
    "structured_output_mode",
    "extra_body",
)


def error(message: str):
    return ConfigurationError("Chatbot configuration: " + message)


def validate_url(value: str):
    if not value:
        return
    try:
        parsed = urlsplit(value)
        valid = parsed.scheme in {"https", "http"} and parsed.hostname and parsed.port != 0
        valid = valid and not (parsed.username or parsed.password or parsed.query or parsed.fragment)
    except ValueError:
        valid = False
    if not valid:
        raise ValueError("Endpoint must be an HTTP(S) URL without credentials, query, or fragment")


class Draft(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class LLMConnection(Draft):
    enabled: bool = False
    provider: ModelProviderId = "openai"
    base_url: str = ""
    model: str = ""
    api_key: str = Field(default="", repr=False, max_length=8192)
    responses_provider: ResponsesProviderId = "openai"
    responses_endpoint: str = ""
    responses_api_version: str = ""
    responses_send_temperature: bool = False

    @model_validator(mode="after")
    def validate_connection(self):
        if self.provider not in PROVIDERS:
            raise ValueError("Unsupported chatbot LLM provider")
        validate_url(self.base_url)
        if any("\n" in v or "\r" in v for v in (self.model, self.api_key)):
            raise ValueError("Model and API key must be single-line values")
        if self.enabled and not self.model.strip():
            raise ValueError("An enabled separate LLM requires its own model")
        if self.provider == "responses" and (self.enabled or self.responses_endpoint):
            self.responses_endpoint = endpoint_url(
                self.responses_endpoint, self.responses_provider, self.responses_api_version
            )
        return self

    def identity(self):
        if self.provider == "responses":
            return self.provider, self.responses_provider, self.responses_endpoint, self.responses_api_version
        return self.provider, self.base_url.rstrip("/")


class EmbeddingConnection(Draft):
    enabled: bool = False
    base_url: str = ""
    api_key: str = Field(default="", repr=False, max_length=8192)

    @model_validator(mode="after")
    def validate_connection(self):
        validate_url(self.base_url)
        if "\n" in self.api_key or "\r" in self.api_key:
            raise ValueError("API key must be a single-line value")
        if self.enabled and not self.base_url:
            raise ValueError("An enabled query embedding connection requires an endpoint")
        return self

    def identity(self):
        return (self.base_url.rstrip("/"),)


class LLMUpdate(Draft):
    enabled: bool | None = None
    provider: ModelProviderId | None = None
    base_url: str | None = None
    model: str | None = None
    api_key: str | None = Field(default=None, repr=False, max_length=8192)
    responses_provider: ResponsesProviderId | None = None
    responses_endpoint: str | None = None
    responses_api_version: str | None = None
    responses_send_temperature: bool | None = None


class EmbeddingUpdate(Draft):
    enabled: bool | None = None
    base_url: str | None = None
    api_key: str | None = Field(default=None, repr=False, max_length=8192)


class Update(Draft):
    llm: LLMUpdate | None = None
    embedding: EmbeddingUpdate | None = None


class TestDraft(Update):
    target: str


class OriginalEmbeddingDraft(Draft):
    """Original embedding settings and optional generation credential reuse."""

    embedding_model: str | None = Field(default=None, min_length=1, max_length=200)
    embedding_base_url: str | None = Field(default=None, max_length=500)
    embedding_api_key: str | None = Field(default=None, repr=False, max_length=500)
    embedding_dimensions: int | None = Field(default=None, ge=1, le=8192)
    llm_provider: ModelProviderId | None = None
    llm_base_url: str | None = Field(default=None, max_length=500)
    llm_api_key: str | None = Field(default=None, repr=False, max_length=8192)

    @model_validator(mode="after")
    def validate_connection(self):
        for name in ("embedding_model", "llm_provider"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError("Model and provider cannot be null")
        for name in ("embedding_base_url", "llm_base_url"):
            validate_url(getattr(self, name) or "")
        for name in ("embedding_model", "embedding_api_key", "llm_api_key"):
            value = getattr(self, name) or ""
            if "\n" in value or "\r" in value:
                raise ValueError("Model and API keys must be single-line values")
        if self.embedding_model is not None and not self.embedding_model.strip():
            raise ValueError("Embedding model cannot be blank")
        return self


class QuerySettings(Settings):
    chatbot_route: str = ""

    @property
    def llm_configured(self):
        return bool(self.chatbot_route) or super().llm_configured

    @property
    def routed_llm_model(self):
        if self.chatbot_route:
            prefix = self.chatbot_route + "/"
            return self.llm_model if self.llm_model.startswith(prefix) else prefix + self.llm_model
        return super().routed_llm_model

    @property
    def effective_llm_temperature(self):
        if self.chatbot_route:
            return PROVIDERS[self.llm_provider].resolve_temperature(self.llm_temperature)
        return super().effective_llm_temperature


class Environment:
    def __init__(self, env=None):
        if env is None:
            from sag_api.core.config import settings

            env = {}
            for name in settings.model_fields_set:
                if name.startswith("chatbot_") or name == "lock_chatbot_config":
                    value = getattr(settings, name)
                    if value is not None:
                        env["SAG_" + name.upper()] = json.dumps(value) if isinstance(value, dict) else str(value)
            for name in ("MODEL", "DIMENSIONS", "SCHEMA_DIMENSIONS", "REQUEST_DIMENSIONS"):
                variable = "SAG_CHATBOT_EMBEDDING_" + name
                if variable in os.environ:
                    env[variable] = os.environ[variable]
        self.env = dict(env)
        self.locked = self.flag("SAG_LOCK_CHATBOT_CONFIG")
        for field in ("MODEL", "DIMENSIONS", "SCHEMA_DIMENSIONS", "REQUEST_DIMENSIONS"):
            if self.env.get("SAG_CHATBOT_EMBEDDING_" + field):
                raise error("Query embedding model and dimensions must come from the original embedding configuration")
        self.connections = {}
        for target, cls in (("llm", LLMConnection), ("embedding", EmbeddingConnection)):
            values = {}
            for field in cls.model_fields:
                name = f"SAG_CHATBOT_{target.upper()}_{field.upper()}"
                if name in self.env:
                    values[field] = (
                        self.flag(name)
                        if field in {"enabled", "responses_send_temperature"}
                        else self.env[name].strip()
                    )
            # Validate syntax now; credentials can be supplied by a saved UI row at startup.
            enabled = values.pop("enabled", False)
            try:
                connection = cls(**values)
            except (ValueError, ValidationError):
                raise error(
                    f"Invalid {target} environment connection; check SAG_CHATBOT_{target.upper()}_* fields"
                ) from None
            self.connections[target] = {**connection.model_dump(), "enabled": enabled}
        self.tuning = {}
        for field in TUNING:
            name = "SAG_CHATBOT_LLM_" + field.upper()
            if name not in self.env or self.env[name] == "":
                continue
            value = self.env[name]
            try:
                if field in {"max_tokens", "context_window", "timeout_ms", "max_retries"}:
                    value = int(value)
                elif field == "temperature":
                    value = float(value)
                elif field == "extra_body":
                    value = json.loads(value)
                    if not isinstance(value, dict):
                        raise ValueError()
                self.tuning["llm_" + field] = value
            except ValueError:
                raise error(f"Invalid {name}") from None
        self.encryption_key = self.env.get("SAG_CHATBOT_CONFIG_ENCRYPTION_KEY", "")
        if self.encryption_key:
            try:
                Fernet(self.encryption_key.encode())
            except (ValueError, TypeError):
                raise error("SAG_CHATBOT_CONFIG_ENCRYPTION_KEY must be a valid Fernet key") from None

    def flag(self, name):
        value = self.env.get(name, "false").lower()
        if value not in {"true", "false", "1", "0"}:
            raise error(f"{name} must be true or false")
        return value in {"true", "1"}

    def resolve(self, stock, connections):
        llm = connections["llm"]
        values = stock.model_dump()
        if llm.enabled:
            spec = PROVIDERS[llm.
```

### Core Architecture Module: `apps/api/sag_api/core/config.py`
```
"""应用配置（pydantic-settings）。

所有配置项均可通过环境变量 `SAG_*` 或 `.env` 覆盖。设计上区分三类后端：

- **sag 元数据库**（用户 / 信源 / 文档 / 会话）：`database_url`
- **zleap-sag 存储**（分块 / 向量 / 事件图谱）：`sag_*` + `data_dir`
- **LLM / embedding**（抽取与答案生成）：`llm_*` / `embedding_*`
- **文档解析**（PDF / Office 等转 Markdown）：`document_parser` / `mineru_*`

默认零依赖：SQLite 元数据 + zleap-sag 本地 LanceDB。生产可整体切到 Postgres。
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal
from urllib.parse import urlsplit, urlunsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import Field, PrivateAttr, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

from sag_api.core.model_providers import ModelProviderId, get_model_provider
from sag_api.core.responses import Config as ResponsesConfig
from sag_api.core.responses import ResponsesProviderId
from sag_api.enums import SearchStrategy, normalize_search_strategy

_DEFAULT_LLM_PROVIDER = get_model_provider("openai")

# zleap-sag 0.13.0 之前的默认向量维度：未显式配置时用它预建向量 schema，
# 保持既有知识库的向量空间不变（存量 LanceDB 向量与该维度绑定）。
_DEFAULT_EMBEDDING_DIMENSIONS = 1024

# 已知拒绝 OpenAI `dimensions` 请求参数的服务商/模型组合。zleap-sag 0.12.0 把
# schema 维度与请求参数混为同一字段，SAG 曾用「引擎初始化后改写私有属性」绕过；
# 0.13.0 拆分后可在此直接表达为 request_dimensions 省略。
_EMBEDDING_REQUEST_DIMENSIONS_UNSUPPORTED = ("api.siliconflow.cn", "baai/bge-m3")


def _embedding_request_dimensions_unsupported(base_url: str | None, model: str) -> bool:
    """该服务商/模型组合是否拒绝请求体里的 `dimensions` 参数。"""
    hostname = (urlsplit(base_url or "").hostname or "").lower()
    return (hostname, model.strip().lower()) == _EMBEDDING_REQUEST_DIMENSIONS_UNSUPPORTED


class Settings(BaseSettings):
    _active_data_dir: str | None = PrivateAttr(default=None)

    model_config = SettingsConfigDict(
        env_prefix="SAG_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        hide_input_in_errors=True,
    )

    # ── 应用 ────────────────────────────────────────────────────────────
    app_name: str = "sag"
    environment: Literal["dev", "prod"] = "dev"
    debug: bool = True
    secret_key: str = "dev-insecure-secret-change-me-in-production-0123456789"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 天
    # local 保留单机名字身份；password 强制邮箱密码认证。
    auth_mode: Literal["local", "password"] = "local"
    # 业务展示时区；数据库与 API 时间戳始终使用 UTC。
    timezone: str = "Asia/Shanghai"
    # NoDecode 让逗号分隔值先进入下方 validator，避免 settings 源强制按 JSON 解码。
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=lambda: ["http://localhost:3000"])
    # 关闭后仅允许首个用户注册（部署引导），其余返回 403
    allow_registration: bool = True
    # Dify 外部知识库调用的专用服务密钥；未配置时兼容端点拒绝服务。
    dify_api_key: str | None = None
    # 供桌面端启动时写入本地 DSH 连接文件的公开地址与可选文件位置。
    dsh_public_url: str = "http://127.0.0.1:8000"
    dsh_connection_file: str | None = None
    dsh_local_discovery: bool = False
    dsh_local_discovery_bind_address: str = "127.0.0.1"
    # Dify 检索默认优先低延迟向量召回；可显式设为 multi 启用实体扩展与 LLM 精排。
    dify_search_strategy: SearchStrategy = "vector"

    # ── sag 元数据库 ───────────────────────────────────────────────────
    database_url: str = "sqlite+aiosqlite:///./.data/sag.db"

    # ── 存储 ────────────────────────────────────────────────────────────
    data_dir: str = "./.data/engine"  # zleap-sag data_dir（LanceDB + SQLite）
    upload_dir: str = "./.data/uploads"  # 上传原始文件落盘
    max_upload_mb: int = 25  # 单文件上传上限
    job_concurrency: int = 2  # 后台处理并发
    document_extract_concurrency: int = Field(default=30, ge=1, le=50)  # 单文档 chunk 抽取并发
    document_chunk_max_tokens: int = Field(default=1_000, ge=100, le=100_000)
    document_chunk_mode: Literal["standard", "heading_strict"] = "standard"
    document_extraction_profile: Literal["standard", "concise"] = "standard"
    document_event_entity_attempts: int = Field(default=2, ge=1, le=3)
    # 上传文档已有独立的知识型过滤要求；默认关闭上游基于标题/摘要的严格过滤，
    # 避免无摘要或标题缺失的书籍正文被误判为噪音。
    document_strict_filtering: bool = False
    job_max_attempts: int = 3  # 可重试失败的最大尝试次数（含首次）
    engine_cache_size: int = 16  # 引擎槽 LRU 上限（超限逐出最久未用）
    engine_warmup_count: int = 4  # 启动时预热最近使用的信源引擎数
    # 允许上传的扩展名白名单（小写，含点）；空集合表示不限制
    allowed_upload_exts: set[str] = {
        ".md",
        ".markdown",
        ".txt",
        ".text",
        ".pdf",
        ".docx",
        ".pptx",
        ".xls",
        ".xlsx",
        ".csv",
        ".tsv",
        ".html",
        ".htm",
        ".json",
        ".epub",
    }

    # ── OCTX 信源导入导出 ───────────────────────────────────────────────
    # 压缩包在一次性受限子进程中校验/打包；这些值是部署可调的硬上限，
    # 不能只依赖 OCTX SDK 默认值或请求层 Content-Length。
    octx_max_upload_mb: int = Field(default=2048, ge=1)
    octx_max_entries: int = Field(default=10_000, ge=1)
    octx_max_file_mb: int = Field(default=512, ge=1)
    octx_max_uncompressed_mb: int = Field(default=4096, ge=1)
    octx_max_compression_ratio: float = Field(default=100, gt=0)
    octx_max_jsonl_line_mb: int = Field(default=16, ge=1)
    octx_max_jsonl_records: int = Field(default=1_000_000, ge=1)
    octx_max_issues: int = Field(default=1000, ge=1)
    octx_worker_memory_mb: int = Field(default=2048, ge=128)
    octx_worker_timeout_seconds: int = Field(default=1800, ge=1)
    octx_transfer_ttl_hours: int = Field(default=24, ge=1)
    octx_rollback_retention_days: int = Field(default=7, ge=0)
    # OCTX 向量复用是可关闭的兼容加速层；关闭后沿用现有 Embedding 重建路径。
    octx_arrow_vector_reuse_enabled: bool = True
    octx_reused_vector_batch_size: int = Field(default=500, ge=50, le=2000)
    octx_vector_progress_interval_seconds: float = Field(default=1.0, ge=0.1, le=10.0)

    # ── zleap-sag 后端选择 ─────────────────────────────────────────────
    # None → 零基础设施（LanceDB + 内置 SQLite，落在 data_dir）
    sag_vector_provider: Literal["lancedb", "es", "pgvector", "oceanbase"] = "lancedb"
    sag_relational_provider: Literal["sqlite", "postgres", "mysql", "oceanbase"] | None = None
    sag_language: Literal["zh", "en"] = "zh"
    # 所有平台均须显式确认重建。保留 windows_fresh 旧配置值，仅选择原地保留
    # 引擎目录并备份业务数据库的策略，不表示自动重建或迁移。
    storage_bootstrap_policy: Literal["prompt", "windows_fresh"] = "prompt"

    # 生产单库（pgvector）时复用同一 Postgres —— 由这些字段拼装
    sag_pg_host: str = "localhost"
    sag_pg_port: int = 5432
    sag_pg_user: str = "sag"
    sag_pg_password: str = "sag"
    sag_pg_database: str = "sag"

    # ── LLM（答案生成 + 抽取）─────────────────────────────────────────
    # 协议、路由规则和技术默认值统一由 model_providers 注册表维护。
    llm_provider: ModelProviderId = _DEFAULT_LLM_PROVIDER.id
    llm_base_url: str | None = _DEFAULT_LLM_PROVIDER.default_base_url
    llm_api_key: str | None = None
    llm_model: str = _DEFAULT_LLM_PROVIDER.default_model
    llm_temperature: float = _DEFAULT_LLM_PROVIDER.default_temperature
    llm_max_tokens: int = 20_000
    llm_context_window: int = _DEFAULT_LLM_PROVIDER.default_context_window
    llm_timeout_ms: int = Field(default=60_000, ge=1_000, le=600_000)
    llm_max_retries: int = Field(default=2, ge=0, le=10)
    # auto 首选 json_schema，仅在网关明确返回“不支持”时按接入能力缓存降级。
    llm_structured_output_mode: Literal[
        "auto", "json_schema", "json_object", "prompt_only"
    ] = "auto"
    # 部署方可显式锁定 LLM 接入配置；普通 SAG_LLM_* 仅作为首次启动默认值。
    lock_llm_config: bool = False
    # 透传给 chat/completions 的额外请求体（JSON），如 {"enable_thinking": false}；
    # 未配置时对 qwen 系模型通过 LiteLLM reasoning_effort=none 统一关闭思考。
    llm_extra_body: dict | None = None
    llm_responses_provider: ResponsesProviderId = "openai"
    llm_responses_endpoint: str = "https://api.openai.com/v1/responses"
    llm_responses_api_version: str = ""
    llm_responses_send_temperature: bool = False
    llm_responses_thinking_config: str | None = None

    # Optional chatbot/query connections; extraction and indexing retain the original clients.
    chatbot_llm_enabled: bool = False
    chatbot_llm_provider: ModelProviderId = "openai"
    chatbot_llm_base_url: str = ""
    chatbot_llm_model: str = ""
    chatbot_llm_api_key: str = Field(default="", repr=False)
    chatbot_embedding_enabled: bool = False
    chatbot_embedding_base_url: str = ""
    chatbot_embedding_api_key: str = Field(default="", repr=False)
    lock_chatbot_config: bool = False
    chatbot_config_encryption_key: str = Field(default="", repr=False)
    chatbot_llm_temperature: float | None = Field(default=None, ge=0, le=2)
    chatbot_llm_max_tokens: int | None = Field(default=None, ge=1)
    chatbot_llm_context_window: int | None = Field(default=None, ge=1)
    chatbot_llm_timeout_ms: int | None = Field(default=None, ge=1_000, le=600_000)
    chatbot_llm_max_retries: int | None = Field(default=None, ge=0, le=10)
    chatbot_llm_structured_output_mode: str | None = None
    chatbot_llm_extra_body: Annotated[dict | None, NoDecode] = None
    chatbot_llm_responses_provider: ResponsesProviderId = "openai"
    chatbot_llm_responses_endpoint: str = ""
    chatbot_llm_responses_api_version: str = ""
    chatbot_llm_responses_send_temperature: bool = False
    chatbot_llm_responses_thinking_config: str | None = None

    @model_validator(mode="after")
    def validate_responses(self):
        if self.llm_provider == "responses":
            ResponsesConfig.from_settings(self)
        return self

    # ── Embedding（OpenAI-compatible；仅 OpenAI provider 可复用生成配置）───────
    embedding_model: str = "bge-large-en-v1.5"
    embedding_base_url: str | None = "https://api.302ai.cn/v1"
    embedding_api_key: str | None = None
    # zleap-sag 0.13.0 起维度拆成两项独立语义（旧版共用一个 `dimensions` 字段）：
    #   schema_dimensions  —— 向量库 schema 与返回向量校验（决定向量空间）
    #   request_dimensions —— 请求体的 OpenAI `dimensions` 参数；None = 不发送
    # `embedding_dimensions` 保留为兼容别名，同时喂给上面两项（见 effective_* 属性）。
    embedding_dimensions: int | None = None
    embedding_schema_dimensions: int | None = None
    embedding_request_dimensions: int | None = None
    # Per-engine embedding HTTP concurrency. llama.cpp --parallel 1 cannot
    # absorb the z
```

### Core Architecture Module: `apps/api/sag_api/core/db.py`
```
"""异步数据库引擎与会话。"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from sag_api.core.config import settings
from sag_api.db.base import Base


def _ensure_sqlite_dir(url: str) -> None:
    """SQLite 文件所在目录不存在时先创建。"""
    marker = "sqlite+aiosqlite:///"
    if url.startswith(marker):
        path = url[len(marker) :]
        if path and path not in (":memory:",):
            os.makedirs(os.path.dirname(os.path.abspath(path)) or ".", exist_ok=True)


_ensure_sqlite_dir(settings.database_url)

engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=False,
    future=True,
    pool_pre_ping=True,
)

# SQLite：外键约束 + 并发友好（WAL 读写并行，busy_timeout 让写入等待而非立即报锁；
# 30s 上限覆盖 CI 慢盘下知识宇宙重建等跨事务写竞争）
if settings.database_url.startswith("sqlite"):

    @event.listens_for(engine.sync_engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record):  # noqa: ANN001
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA busy_timeout=30000")
        cur.close()


SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_session() -> AsyncIterator[AsyncSession]:
    async with SessionLocal() as session:
        yield session


# 已存在的表需要补的新列（dev 轻量增量迁移；生产用 Alembic）。
# create_all 只建新表、不改旧表，故对演进列做幂等 ADD COLUMN。
_COLUMN_UPGRADES: dict[str, dict[str, str]] = {
    "agents": {"is_default": "BOOLEAN NOT NULL DEFAULT FALSE"},
    "documents": {
        "progress": "INTEGER NOT NULL DEFAULT 0",
        "token_usage": "BIGINT NOT NULL DEFAULT 0",
        "error_layer": "VARCHAR(16)",
        "error_stage": "VARCHAR(16)",
        "octx_installation_id": "VARCHAR(32)",
        "octx_document_id": "VARCHAR(36)",
        "is_active": "BOOLEAN NOT NULL DEFAULT TRUE",
        "parser_provider": "VARCHAR(16)",
        "mineru_provider": "VARCHAR(16)",
        "mineru_model": "VARCHAR(16)",
        "parser_status": "VARCHAR(16)",
        "fallback_from": "VARCHAR(16)",
        "fallback_reason": "TEXT",
        "vector_identity_json": "JSON",
    },
    "threads": {"archived": "BOOLEAN NOT NULL DEFAULT FALSE"},
    "messages": {
        "attachments_json": "JSON",
        "source_scope_json": "JSON",
        "steps_json": "JSON",
        "prompt_preview": "TEXT NOT NULL DEFAULT ''",
        "status": "VARCHAR(16) NOT NULL DEFAULT 'ok'",
        "error_json": "JSON",
    },
    "universe_dirty_sources": {"revision": "INTEGER NOT NULL DEFAULT 1"},
}

# Existing tables also need newly introduced hot-path indexes. Keep these
# idempotent for local/embedded upgrades; production deployments can express
# the same DDL in their migration runner.
_INDEX_UPGRADES = (
    "CREATE INDEX IF NOT EXISTS ix_messages_thread_created_id ON messages (thread_id, created_at, id)",
    "CREATE INDEX IF NOT EXISTS ix_documents_source_sag_source ON documents (source_id, sag_source_id)",
    "CREATE INDEX IF NOT EXISTS ix_documents_source_active_created ON documents (source_id, is_active, created_at)",
)


async def _ensure_columns() -> None:
    from sqlalchemy import inspect as sa_inspect

    def _existing(sync_conn, table: str) -> set[str] | None:
        insp = sa_inspect(sync_conn)
        if not insp.has_table(table):
            return None
        return {c["name"] for c in insp.get_columns(table)}

    async with engine.begin() as conn:
        for table, cols in _COLUMN_UPGRADES.items():
            existing = await conn.run_sync(_existing, table)
            if existing is None:
                continue
            for col, ddl in cols.items():
                if col not in existing:
                    await conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {col} {ddl}")


async def _ensure_indexes() -> None:
    async with engine.begin() as conn:
        for ddl in _INDEX_UPGRADES:
            await conn.exec_driver_sql(ddl)


async def init_db() -> None:
    """开发态建表（生产用 Alembic）。导入 models 以注册到 metadata。"""
    from sag_api.db import models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await _ensure_columns()
    await _ensure_indexes()


async def dispose_db() -> None:
    await engine.dispose()

```

### Core Architecture Module: `apps/api/sag_api/core/deps.py`
```
"""FastAPI 依赖：认证 + 应用级单例。单用户，无工作空间/角色。"""

from __future__ import annotations

from typing import Literal

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from sag_agent import AgentRuntime
from sag_api.core.config import settings
from sag_api.core.db import get_session
from sag_api.core.errors import AuthError
from sag_api.core.security import decode_token
from sag_api.db.models import User
from sag_api.generation import LLMClient
from sag_api.jobs import JobQueue
from sag_api.sag import EngineManager
from sag_api.services.auth_service import get_user
from sag_api.services.dsh_integration_service import authenticate_connector

_bearer = HTTPBearer(auto_error=False)
_AuthKind = Literal["jwt", "connector"]


def _require_matching_auth_mode(payload: dict) -> None:
    if settings.auth_mode == "password" and payload.get("auth_mode") != "password":
        raise AuthError("认证模式已变更，请重新登录")


async def _get_bearer_token(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str:
    if creds is None:
        raise AuthError("缺少认证令牌")
    return creds.credentials


async def _authenticate_user_principal(
    session: AsyncSession,
    token: str,
) -> tuple[User, _AuthKind] | None:
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        user = await authenticate_connector(session, token)
        return (user, "connector") if user is not None else None
    user_id = payload.get("sub")
    _require_matching_auth_mode(payload)
    user = await get_user(session, user_id) if user_id else None
    return (user, "jwt") if user is not None and user.is_active else None


async def authenticate_user_token(session: AsyncSession, token: str) -> User | None:
    """Authenticate either token kind for user-only callers such as MCP."""
    principal = await _authenticate_user_principal(session, token)
    return principal[0] if principal is not None else None


async def get_current_user(
    request: Request,
    token: str = Depends(_get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> User:
    try:
        payload = decode_token(token)
    except jwt.PyJWTError as error:
        raise AuthError("令牌无效或已过期") from error
    user_id = payload.get("sub")
    _require_matching_auth_mode(payload)
    user = await get_user(session, user_id) if user_id else None
    if user is None or not user.is_active:
        raise AuthError("用户不存在或已停用")
    request.state.user = user
    request.state.auth_kind = "jwt"
    return user


async def get_current_user_or_connector(
    request: Request,
    token: str = Depends(_get_bearer_token),
    session: AsyncSession = Depends(get_session),
) -> User:
    """Authenticate approved knowledge operations with JWT or local connector token."""
    principal = await _authenticate_user_principal(session, token)
    if principal is None:
        raise AuthError("令牌无效或已过期")
    user, auth_kind = principal
    request.state.user = user
    request.state.auth_kind = auth_kind
    return user


def get_engine_manager(request: Request) -> EngineManager:
    return request.app.state.engine_manager


def get_job_queue(request: Request) -> JobQueue:
    return request.app.state.job_queue


def get_llm(request: Request) -> LLMClient:
    return request.app.state.llm


def get_agent_runtime(request: Request) -> AgentRuntime:
    return request.app.state.agent_runtime


def get_tool_registry():
    """Agent 工具注册表（内置检索/实体工具 + 运行时注入的 MCP 工具）。"""
    from sag_api.tools import registry

    return registry

```

### Core Architecture Module: `apps/api/sag_api/core/error_taxonomy.py`
```
"""错误分类三维度：错误码（code）+ 链路环节（stage）+ 责任归属（layer）。

背景：历史上错误码只有 HTTP 语义（not_found / upstream_error / …），
一个 `UpstreamError` 同时装了「引擎内部错」「LLM 厂商错」「DB 存储错」，
用户上报日志时无法判断问题出在哪一环、该找谁排查。

这里定义描述一个错误的三个正交维度，是全项目错误分类的唯一事实来源：

- **code（错误码）**：机器可读的错误身份，前端据此做逻辑分支、错误文案映射。
  历史上散落在各抛出点的字面量（``code="xxx"``）统一收敛到 :class:`ErrorCode`，
  杜绝魔法值；新增错误码一律在本文件登记。
- **layer（责任归属）**：这个错误的根子在谁那里 —— 前端 / SAG 自身 /
  zleap-sag 引擎 / LLM 厂商 / 存储。决定「找谁排查」。
- **stage（链路环节）**：错误发生在业务链路的哪一步。决定「哪一步崩了」。

前端把 code/layer/stage/message/request_id 一并采集进诊断日志，研发拿到
日志即可精准定位「哪个环节 + 谁的责任 + 具体报错原文」。

维护约定：
- 枚举**成员值**即对外契约（前端逻辑、诊断日志、SSE 帧都依赖它），
  一旦发布**不可随意更名**；确需废弃时保留旧值并标注 deprecated。
- 新增错误码时挑选或新增合适的分组，补一行 docstring 说明触发场景。
"""

from __future__ import annotations

from enum import StrEnum


class ErrorCode(StrEnum):
    """全项目机器可读错误码的唯一登记处。

    成员值必须与历史字面量逐字一致（前后端契约），只做集中收敛、不改语义。
    按业务域分组，新增时归入对应分组或新建分组。
    """

    # —— 通用 HTTP 语义（ApiError 家族基类默认码）——
    INTERNAL_ERROR = "internal_error"
    """未归类的服务端内部错误（500 兜底）。"""

    NOT_FOUND = "not_found"
    """请求的资源不存在（404）。"""

    CONFLICT = "conflict"
    """资源冲突，如重复创建（409）。"""

    VALIDATION_ERROR = "validation_error"
    """输入参数校验失败（422）。"""

    UNAUTHORIZED = "unauthorized"
    """未认证或凭证无效（401）。"""

    FORBIDDEN = "forbidden"
    """已认证但无权访问该资源（403）。"""

    CONFIGURATION_ERROR = "configuration_error"
    """缺少必要配置，如未配置 LLM（400）。"""

    UPSTREAM_ERROR = "upstream_error"
    """上游（LLM / 引擎）返回错误（502）。"""

    SERVICE_UNAVAILABLE = "service_unavailable"
    """暂时不可用，可重试，如限流 / 超时（503）。"""

    # —— LLM / 结构化输出 ——
    LLM_UNAVAILABLE = "llm_unavailable"
    """LLM 暂时性失败：超时 / 限流 / 5xx，可重试。"""

    LLM_AUTH_ERROR = "llm_auth_error"
    """LLM 鉴权失败：API Key 或权限问题，需改配置，不可重试。"""

    LLM_BAD_REQUEST = "llm_bad_request"
    """LLM 拒绝请求：请求非法 / 上下文超限。"""

    LLM_EMPTY_RESPONSE = "llm_empty_response"
    """LLM 未返回任何候选答案。"""

    SCHEMA_VALIDATION_ERROR = "schema_validation_error"
    """模型输出不符合结构化 schema（如 references 的 minItems）。"""

    # —— 分页 / 游标 ——
    INVALID_CURSOR = "invalid_cursor"
    """消息分页游标无效（签名不符 / 格式错误 / 过长）。"""

    INVALID_PAGE_LIMIT = "invalid_page_limit"
    """分页大小越界。"""

    # —— 知识宇宙（universe）——
    SNAPSHOT_CHANGED = "snapshot_changed"
    """探索期间知识图谱快照已变更，需重新开始当前探索。"""

    # —— 检索 / 信源 ——
    TOO_MANY_SEARCH_SOURCES = "too_many_search_sources"
    """单次检索指定的信源数量超过上限。"""

    # —— 流式传输（SSE）——
    STREAM_ERROR = "stream_error"
    """SSE 流式生成中途意外中断（问答 / 搜索通用）。"""

    # —— MCP 工具 ——
    MCP_CONNECTION_FAILED = "mcp_connection_failed"
    """连接外部 MCP 服务器失败。"""

    # —— OCTX 信源导入导出 ——
    OCTX_INVALID_PACKAGE = "octx_invalid_package"
    """OCTX 包格式、摘要或已声明能力校验失败。"""

    OCTX_VALIDATION_INCOMPLETE = "octx_validation_incomplete"
    """OCTX 校验未完整执行，不能据此导入。"""

    OCTX_RESOURCE_LIMIT = "octx_resource_limit"
    """OCTX 包超过上传、解压、记录、内存或运行时间限制。"""

    OCTX_UNSUPPORTED_CAPABILITY = "octx_unsupported_capability"
    """OCTX 包声明了 SAG 当前不支持的能力。"""

    OCTX_REBUILD_CONFIGURATION_MISSING = "octx_rebuild_configuration_missing"
    """knowledge-only 导入缺少 LLM 或 embedding 配置。"""

    OCTX_RELEASE_DIGEST_CONFLICT = "octx_release_digest_conflict"
    """同一 Asset 和版本对应了不同 package digest。"""

    OCTX_DECISION_REQUIRED = "octx_decision_required"
    """检测到相同 Asset，需要调用方选择更新、新建或取消。"""

    OCTX_DECISION_STALE = "octx_decision_stale"
    """冲突决策期间信源 revision 变化，需要重新预检。"""

    OCTX_LOCAL_CHANGES_CONFLICT = "octx_local_changes_conflict"
    """目标信源有未发布本地变更，更新需要额外确认。"""

    OCTX_SOURCE_NOT_EXPORTABLE = "octx_source_not_exportable"
    """信源存在未完成文档或并发 mutation，当前不能导出。"""

    OCTX_SOURCE_REEXTRACT_REQUIRED = "octx_source_reextract_required"
    """存量事项缺少有效实体关系，需要用户重新提取对应文档。"""

    OCTX_SAG_MAPPING_CONFLICT = "octx_sag_mapping_conflict"
    """OCTX 结构数据不满足 SAG 字段或关系约束。"""

    OCTX_SHADOW_VALIDATION_FAILED = "octx_shadow_validation_failed"
    """影子安装的关系、向量或检索烟测未通过。"""

    OCTX_ARTIFACT_NOT_READY = "octx_artifact_not_ready"
    """传输任务尚未生成可下载制品。"""

    OCTX_ARTIFACT_MISSING = "octx_artifact_missing"
    """数据库登记的 OCTX 制品已不存在。"""

    OCTX_TRANSFER_CANCELLED = "octx_transfer_cancelled"
    """OCTX 传输已由用户取消，Worker 必须停止后续副作用。"""


class ErrorLayer(StrEnum):
    """责任归属：这个错误应该找谁排查。"""

    CLIENT = "client"
    """前端 / 网络 / SSE 协议层 —— 浏览器侧或链路传输问题。"""

    API = "api"
    """SAG 后端自身 —— 编排、鉴权、参数校验、配置缺失等本地逻辑。"""

    ENGINE = "engine"
    """zleap-sag 引擎 —— 分块、抽取、schema 校验、引擎内部存储等。"""

    LLM = "llm"
    """LLM 厂商 —— 超时、限流、鉴权失败、返回结构不合规（如 schema 拒绝）。"""

    STORE = "store"
    """持久化层 —— 数据库 / 向量库读写、事务、外键约束等。"""


class ErrorStage(StrEnum):
    """链路环节：错误发生在业务流程的哪一步。

    文档摄入链：upload → parse → chunk → embed → extract → persist
    问答链：      retrieve → generate → tool → persist
    横切：        config / auth / unknown
    """

    # —— 文档摄入链 ——
    UPLOAD = "upload"
    """上传接收：文件校验（扩展名 / 大小 / 空文件）、落盘。"""

    PARSE = "parse"
    """解析：非 Markdown 文档转 Markdown（MinerU / MarkItDown）。"""

    CHUNK = "chunk"
    """分块：文本切片，写入 chunk 与其向量前的加载阶段。"""

    EMBED = "embed"
    """向量化：调用 embedding 模型生成向量。"""

    EXTRACT = "extract"
    """提取事项：逐 chunk 抽取事件 / 实体（structured output）。"""

    PERSIST = "persist"
    """入库：chunk / 事件 / 答案的持久化与计数提交。"""

    # —— 问答链 ——
    RETRIEVE = "retrieve"
    """召回：向量 / 多路检索相关片段。"""

    GENERATE = "generate"
    """生成：LLM 生成答案（含流式 turn）。"""

    TOOL = "tool"
    """工具调用：Agent 执行 search_context / web_search 等工具。"""

    # —— 横切 ——
    CONFIG = "config"
    """配置：LLM / embedding / 引擎所需配置缺失或非法。"""

    AUTH = "auth"
    """鉴权：未认证、凭证失效、无权访问。"""

    UNKNOWN = "unknown"
    """未归类：尚未打上 stage 标记的错误。"""

    # —— OCTX 信源导入导出链 ——
    OCTX_UPLOAD = "octx_upload"
    OCTX_VALIDATE = "octx_validate"
    OCTX_RESOLVE = "octx_resolve"
    OCTX_IMPORT = "octx_import"
    OCTX_INDEX = "octx_index"
    OCTX_SWITCH = "octx_switch"
    OCTX_EXPORT = "octx_export"
    OCTX_PUBLISH = "octx_publish"

```

### Core Architecture Module: `apps/api/sag_api/core/errors.py`
```
"""sag 领域异常 —— 与框架无关，路由层统一映射为 HTTP 响应。

领域服务只抛这些异常；`sag/` 适配层负责把 `zleap-sag` 的 `SagError` 家族翻译到这里。

每个异常带三个维度：
- ``code``：HTTP 语义错误码（历史字段，向后兼容，前端逻辑沿用）。
- ``layer``：责任归属（谁该排查），见 :class:`ErrorLayer`。
- ``stage``：链路环节（哪一步崩），见 :class:`ErrorStage`。
另有 ``retryable`` 标识是否可安全重试。layer/stage/retryable 可在构造时按
实际发生点覆盖 —— 同一个 ``ValidationError`` 在 extract 阶段和 upload 阶段
应打上不同的 stage。
"""

from __future__ import annotations

from sag_api.core.error_taxonomy import ErrorCode, ErrorLayer, ErrorStage


class ApiError(Exception):
    """所有 sag 领域异常的基类。"""

    status_code: int = 500
    code: str = ErrorCode.INTERNAL_ERROR
    layer: ErrorLayer = ErrorLayer.API
    stage: ErrorStage = ErrorStage.UNKNOWN
    retryable: bool = False

    def __init__(
        self,
        message: str | None = None,
        *,
        code: str | None = None,
        layer: ErrorLayer | None = None,
        stage: ErrorStage | None = None,
        retryable: bool | None = None,
    ):
        self.message = message or self.__class__.__doc__ or "Internal error"
        if code:
            self.code = code
        if layer is not None:
            self.layer = layer
        if stage is not None:
            self.stage = stage
        if retryable is not None:
            self.retryable = retryable
        super().__init__(self.message)

    def to_envelope(self, *, request_id: str | None = None) -> dict:
        """序列化为响应/日志用的结构化错误信封。"""
        error: dict[str, object] = {
            "code": self.code,
            "message": self.message,
            "layer": self.layer.value,
            "stage": self.stage.value,
            "retryable": self.retryable,
        }
        if request_id:
            error["request_id"] = request_id
        return {"error": error}


class NotFoundError(ApiError):
    """请求的资源不存在。"""

    status_code = 404
    code = ErrorCode.NOT_FOUND


class ConflictError(ApiError):
    """资源冲突（如重复创建）。"""

    status_code = 409
    code = ErrorCode.CONFLICT


class ValidationError(ApiError):
    """输入校验失败。"""

    status_code = 422
    code = ErrorCode.VALIDATION_ERROR


class AuthError(ApiError):
    """未认证或凭证无效。"""

    status_code = 401
    code = ErrorCode.UNAUTHORIZED
    layer = ErrorLayer.API
    stage = ErrorStage.AUTH


class ForbiddenError(ApiError):
    """无权访问该资源。"""

    status_code = 403
    code = ErrorCode.FORBIDDEN
    layer = ErrorLayer.API
    stage = ErrorStage.AUTH


class ConfigurationError(ApiError):
    """缺少必要配置（如未配置 LLM）。"""

    status_code = 400
    code = ErrorCode.CONFIGURATION_ERROR
    layer = ErrorLayer.API
    stage = ErrorStage.CONFIG


class UpstreamError(ApiError):
    """上游（LLM / 引擎）返回错误。"""

    status_code = 502
    code = ErrorCode.UPSTREAM_ERROR
    layer = ErrorLayer.LLM


class ServiceUnavailableError(ApiError):
    """暂时不可用（可重试，如限流 / 超时）。"""

    status_code = 503
    code = ErrorCode.SERVICE_UNAVAILABLE
    retryable = True

```

### Core Architecture Module: `apps/api/sag_api/core/litellm_policy.py`
```
"""Muse-wide LiteLLM request policy.

Generation calls can apply this policy directly.  zleap-sag calls LiteLLM
inside the dependency, so the application lifespan also installs the same
policy as a LiteLLM pre-call hook.  This keeps provider quirks in Muse without
patching ``site-packages``.
"""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any

from sag_api.core.config import Settings

_COMPLETION_CALL_TYPES = {"completion", "acompletion"}
_DEEPSEEK_V4_MODELS = {"deepseek-v4-flash", "deepseek-v4-pro"}


@dataclass(frozen=True)
class CapabilityKey:
    provider: str
    base_url: str
    model: str


class StructuredOutputCapabilityCache:
    def __init__(self) -> None:
        self._modes: dict[CapabilityKey, str] = {}
        self._locks: dict[CapabilityKey, asyncio.Lock] = {}

    def get(self, key: CapabilityKey) -> str | None:
        return self._modes.get(key)

    def mark(self, key: CapabilityKey, mode: str) -> None:
        self._modes[key] = mode

    def probe_lock(self, key: CapabilityKey) -> asyncio.Lock:
        lock = self._locks.get(key)
        if lock is None:
            lock = asyncio.Lock()
            self._locks[key] = lock
        return lock


def _capability_key(request: Mapping[str, Any], settings: Settings) -> CapabilityKey:
    model = str(request.get("model") or settings.routed_llm_model)
    if model.startswith("sag_responses/"):
        from sag_api.core.responses import Config as ResponsesConfig
        from sag_api.generation.responses.routing import request_settings

        active = request_settings.get() or settings
        config = ResponsesConfig.from_settings(active)
        return CapabilityKey("responses:" + config.provider, config.endpoint, model.casefold())
    explicit_provider = request.get("custom_llm_provider")
    provider = str(
        explicit_provider
        or (model.split("/", 1)[0] if "/" in model else settings.llm_provider)
    ).casefold()
    base_url = str(
        request.get("api_base")
        or request.get("base_url")
        or settings.llm_base_url
        or ""
    ).rstrip("/").casefold()
    return CapabilityKey(provider, base_url, model.casefold())


def _json_schema_request(request: Mapping[str, Any]) -> bool:
    response_format = request.get("response_format")
    return (
        isinstance(response_format, Mapping)
        and response_format.get("type") == "json_schema"
    )


def _with_json_object(request: Mapping[str, Any]) -> dict[str, Any]:
    changed = dict(request)
    changed["response_format"] = {"type": "json_object"}
    return changed


def _status_code(error: Exception) -> int | None:
    direct = getattr(error, "status_code", None)
    response = getattr(error, "response", None)
    value = direct if direct is not None else getattr(response, "status_code", None)
    try:
        return int(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def should_downgrade_json_schema(
    error: Exception,
    request: Mapping[str, Any],
    settings: Settings,
) -> bool:
    if settings.llm_structured_output_mode != "auto":
        return False
    if not _json_schema_request(request) or _status_code(error) not in {400, 422}:
        return False
    summary = str(error).casefold()
    # The request check above already proves the rejected format was
    # ``json_schema``.  Some OpenAI-compatible gateways (including DeepSeek
    # v4 Flash) only report that the response_format *type* is unavailable,
    # without echoing the concrete type name.
    names_structured_output = "json_schema" in summary or "response_format" in summary
    unsupported = any(
        phrase in summary
        for phrase in (
            "not supported",
            "unsupported",
            "does not support",
            "isn't supported",
            "not support",
            "unavailable",
        )
    )
    return names_structured_output and unsupported


def _thinking_override(extra_body: object) -> bool | None:
    if not isinstance(extra_body, Mapping):
        return None
    direct = extra_body.get("enable_thinking")
    if isinstance(direct, bool):
        return direct
    template_kwargs = extra_body.get("chat_template_kwargs")
    if isinstance(template_kwargs, Mapping):
        nested = template_kwargs.get("enable_thinking")
        if isinstance(nested, bool):
            return nested
    return None


def _is_openai_route(model: str, settings: Settings) -> bool:
    if "/" in model:
        return model.split("/", 1)[0].casefold() == "openai"
    return settings.llm_provider == "openai"


def _is_deepseek_v4(model: str) -> bool:
    model_id = model.rsplit("/", 1)[-1].casefold()
    return model_id in _DEEPSEEK_V4_MODELS


def _with_allowed_openai_param(request: dict[str, Any], name: str) -> None:
    configured = request.get("allowed_openai_params")
    if configured is None:
        allowed: list[str] = []
    elif isinstance(configured, str):
        allowed = [configured]
    else:
        allowed = list(configured)
    if name not in allowed:
        allowed.append(name)
    request["allowed_openai_params"] = allowed


def apply_litellm_completion_policy(
    settings: Settings,
    request: Mapping[str, Any],
) -> dict[str, Any]:
    """Return one normalized LiteLLM completion request.

    Qwen reasoning is disabled through LiteLLM's standard
    ``reasoning_effort`` argument.  ``allowed_openai_params`` is required for
    custom OpenAI-compatible model names whose capabilities LiteLLM cannot
    infer.  An explicit ``enable_thinking: true`` remains an opt-in override.
    """

    from sag_api.core.chatbot_config import KEYLESS_API_KEY
    from sag_api.services.chatbot_service import operation, query_scope

    normalized = dict(request)
    if str(normalized.get("model", "")).startswith("sag_responses/"):
        from sag_api.generation.responses.routing import request_settings

        settings = request_settings.get() or settings
    snapshot = operation.get()
    if snapshot is not None and query_scope.get() and snapshot.connections["llm"].enabled:
        settings = snapshot.settings
        normalized["extra_body"] = dict(settings.llm_extra_body or {})
        normalized["temperature"] = settings.effective_llm_temperature
        if not snapshot.connections["llm"].api_key:
            from openai import omit

            normalized["api_key"] = KEYLESS_API_KEY
            if settings.llm_provider == "openai":
                normalized["extra_headers"] = {**(normalized.get("extra_headers") or {}), "Authorization": omit}
    if "extra_body" not in normalized and settings.llm_extra_body:
        normalized["extra_body"] = dict(settings.llm_extra_body)

    model = str(normalized.get("model") or settings.routed_llm_model)
    if model.startswith("sag_responses/"):
        from sag_api.core.responses import Config as ResponsesConfig
        from sag_api.generation.responses.policy import normalize_thinking

        normalized["extra_body"] = {**(settings.llm_extra_body or {}), **(normalized.get("extra_body") or {})}
        normalized = normalize_thinking(normalized, ResponsesConfig.from_settings(settings).thinking_rules)
        if normalized.get("stream"):
            normalized["stream_options"] = {**(normalized.get("stream_options") or {}), "include_usage": True}
        return normalized
    if _is_deepseek_v4(model):
        extra_body = dict(normalized.get("extra_body") or {})
        extra_body["thinking"] = {"type": "disabled"}
        normalized["extra_body"] = extra_body

    thinking = _thinking_override(normalized.get("extra_body"))
    if "reasoning_effort" not in normalized:
        if thinking is False or (thinking is None and "qwen" in model.casefold()):
            normalized["reasoning_effort"] = "none"

    if "reasoning_effort" in normalized and _is_openai_route(model, settings):
        _with_allowed_openai_param(normalized, "reasoning_effort")
    return normalized


def install_litellm_policy(settings: Settings) -> Any:
    """Install the Muse policy for dependency-owned LiteLLM calls."""

    import litellm
    from litellm.integrations.custom_logger import CustomLogger

    from sag_api.generation.responses.routing import register

    register()

    class MuseLiteLLMPolicy(CustomLogger):
        async def async_pre_call_deployment_hook(
            self,
            kwargs: dict[str, Any],
            call_type: Any,
        ) -> dict[str, Any]:
            kind = getattr(call_type, "value", call_type)
            if kind is not None and kind not in _COMPLETION_CALL_TYPES:
                return kwargs
            return apply_litellm_completion_policy(settings, kwargs)

    callback = MuseLiteLLMPolicy()
    litellm.callbacks.append(callback)
    original_acompletion = litellm.acompletion
    cache = StructuredOutputCapabilityCache()

    async def sag_acompletion(*args: Any, **kwargs: Any) -> Any:
        if settings.llm_structured_output_mode != "auto" or not _json_schema_request(
            kwargs
        ):
            return await original_acompletion(*args, **kwargs)
        key = _capability_key(kwargs, settings)
        known = cache.get(key)
        if known == "json_object":
            return await original_acompletion(*args, **_with_json_object(kwargs))
        if known == "json_schema":
            return await original_acompletion(*args, **kwargs)

        async with cache.probe_lock(key):
            known = cache.get(key)
            if known == "json_object":
                return await original_acompletion(*args, **_with_json_object(kwargs))
            if known == "json_schema":
                return await original_acompletion(*args, **kwargs)
            try:
                result = await original_acompletion(*args, **kwargs)
            except Exception as error:
                if not should_downgrade_json_schema(error, kwargs, set
```

### Core Architecture Module: `apps/api/sag_api/core/logging.py`
```
"""轻量日志配置 + 请求追踪中间件。"""

from __future__ import annotations

import contextvars
import logging
import sys
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.types import ASGIApp

_CONFIGURED = False

# 当前请求的追踪 id，供日志与错误处理引用
request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")


def configure_logging(level: str = "INFO") -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return
    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(_RequestIdFilter())
    handler.setFormatter(
        logging.Formatter(
            fmt="%(asctime)s  %(levelname)-7s  [%(request_id)s]  %(name)s  %(message)s",
            datefmt="%H:%M:%S",
        )
    )
    root = logging.getLogger()
    root.setLevel(level)
    root.handlers = [handler]
    # 降低第三方噪音，并禁止模型客户端在 DEBUG 模式输出完整提示词/正文。
    for noisy in (
        "httpx",
        "httpcore",
        "openai",
        "lancedb",
        "aiosqlite",
        "LiteLLM",
        "LiteLLM Router",
        "LiteLLM Proxy",
    ):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    logging.getLogger("zleap.sag.ai.openai").setLevel(logging.INFO)
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(f"sag.{name}")


class _RequestIdFilter(logging.Filter):
    """把当前请求 id 注入每条日志记录，未在请求上下文时为 '-'。"""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


class RequestContextMiddleware(BaseHTTPMiddleware):
    """为每个请求分配追踪 id：入站取 X-Request-Id 或新生成，出站回写响应头。"""

    def __init__(self, app: ASGIApp) -> None:
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:16]
        token = request_id_var.set(rid)
        request.state.request_id = rid
        try:
            response = await call_next(request)
        finally:
            request_id_var.reset(token)
        response.headers["X-Request-Id"] = rid
        return response

```

### Core Architecture Module: `apps/api/sag_api/core/model_providers.py`
```
"""Single source of truth for generation-model provider capabilities.

The registry contains technical defaults and protocol behavior only. Runtime,
knowledge extraction, API configuration, and the web settings form all consume
the same catalog so adding a provider does not create another call path.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from types import MappingProxyType
from typing import Literal

ModelProviderId = Literal["openai", "anthropic", "gemini", "responses"]


@dataclass(frozen=True, slots=True)
class ModelProviderSpec:
    id: ModelProviderId
    display_name: str
    protocol: str
    litellm_prefix: str
    default_model: str
    default_base_url: str | None
    default_context_window: int
    default_temperature: float
    temperature_configurable: bool
    can_reuse_embedding_credentials: bool
    api_key_placeholder: str

    def route_model(self, model: str) -> str:
        normalized = model.strip()
        prefix = f"{self.litellm_prefix}/"
        return normalized if normalized.startswith(prefix) else f"{prefix}{normalized}"

    def resolve_temperature(self, configured: float) -> float:
        return configured if self.temperature_configurable else self.default_temperature

    def to_public_dict(self) -> dict[str, object]:
        value = asdict(self)
        value.pop("litellm_prefix")
        return value


_PROVIDER_SPECS = (
    ModelProviderSpec(
        id="openai",
        display_name="OpenAI-compatible",
        protocol="openai_chat_completions",
        litellm_prefix="openai",
        default_model="qwen3.6-flash",
        default_base_url="https://api.302ai.cn/v1",
        default_context_window=128_000,
        default_temperature=0.3,
        temperature_configurable=True,
        can_reuse_embedding_credentials=True,
        api_key_placeholder="sk-…",
    ),
    ModelProviderSpec(
        id="anthropic",
        display_name="Anthropic",
        protocol="anthropic_messages",
        litellm_prefix="anthropic",
        default_model="claude-sonnet-5",
        default_base_url=None,
        default_context_window=1_000_000,
        default_temperature=1.0,
        temperature_configurable=False,
        can_reuse_embedding_credentials=False,
        api_key_placeholder="sk-ant-…",
    ),
    ModelProviderSpec(
        id="gemini",
        display_name="Google Gemini",
        protocol="gemini_generate_content",
        litellm_prefix="gemini",
        default_model="gemini-3.5-flash",
        default_base_url=None,
        default_context_window=1_048_576,
        default_temperature=0.3,
        temperature_configurable=True,
        can_reuse_embedding_credentials=False,
        api_key_placeholder="AIza…",
    ),
    ModelProviderSpec(
        id="responses",
        display_name="Responses API",
        protocol="openai_responses",
        litellm_prefix="sag_responses",
        default_model="",
        default_base_url=None,
        default_context_window=128_000,
        default_temperature=0.3,
        temperature_configurable=True,
        can_reuse_embedding_credentials=False,
        api_key_placeholder="API key for the selected Responses endpoint",
    ),
)

MODEL_PROVIDERS = MappingProxyType({spec.id: spec for spec in _PROVIDER_SPECS})


def get_model_provider(provider: ModelProviderId) -> ModelProviderSpec:
    return MODEL_PROVIDERS[provider]


def model_provider_catalog() -> list[dict[str, object]]:
    return [spec.to_public_dict() for spec in _PROVIDER_SPECS]

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #222** (2026-10-05): **Fix New conversation reopening the previous chat**
  *Symptoms*: Clicking **New conversation** from Knowledge, Settings, or Search could reopen the previous chat: the sidebar dispatched an event handled only by the unmounted chat page. A remounted chat page could also prefer an older running session over the user's new draft.  The sidebar now creates and selects a draft in the shared runtime before navigating. The chat page derives its displayed session from that selection, preserves explicit history routes, and prevents an old URL effect from overriding a newer selection. Older responses continue in their own conversations. First-send thread creation and existing history stay unchanged; no database migration is required.  Rebased onto freshly fetched `upstream/main` (`0cdb43e57c1c8d99757678955d6e0676dc521828`). The feature-only branch head is `af8e7fe33789d68f439015715b226f5fa72099ef`; range-diff confirms the feature commit is unchanged by the rebase.  Validation: - Nine regression cases cover navigation from other pages, the mounted chat page, repeated clicks, remounts with an older run completing, late history responses, first-send URL binding, preserved history, and an initial visit. Four cases fail against the original implementation and all pass with the fix. - Independently tested the rebased clean branch: all 636 frontend tests passed. - The combined integration checkout passed 645 frontend tests, 1,062 backend tests (one optional skip), TypeScript, ESLint, and backend Ruff. - Fresh production API/web Docker builds passed and both 

- **Issue #221** (2026-10-05): **Preserve selected source scope in chat history**
  *Symptoms*: Selecting sources with `@` limits a chat turn, but the sent question loses the visible selection. Save source IDs and name snapshots with each user message and show `@SourceName` tags inside its historical message bubble, before the question text, during streaming and after history reload.  Questions without an explicit selection show no extra scope label. Legacy questions retain unknown scope without reconstructing it from retrieval results or citations. Retry uses the original question's saved scope; legacy retries preserve their existing composer behavior. Badges describe requested search scope rather than asserting which evidence the answer used.  Adds a nullable `messages.source_scope_json` column through the existing idempotent schema updater, a typed message API field, and authoritative metadata in `run.started`. Historical names survive source rename/deletion; unavailable IDs remain explicit rather than widening to default scope. Public behavior, production migration requirements, and upgrade verification are documented in `docs/chat-source-scope.md`.  Rebased onto freshly fetched `upstream/main` (`0cdb43e57c1c8d99757678955d6e0676dc521828`). The feature-only branch head is `ba13a49a2a5183d4d463728aa8994dbc80f29c8b`; range-diff confirms the feature commits are unchanged by the rebase.  Validation:  - Independently tested this rebased branch: 636 frontend tests and 20 focused backend regressions passed. - The combined integration checkout passed the full backend suite (

- **Issue #220** (2026-10-05): **Fix cold-source chatbot retrieval blocking during extraction and align model-test feedback**
  *Symptoms*: When document extraction is running, a chatbot search for an uncached source can exhaust `search_context`'s 30-second deadline before its embedding request starts. Extraction holds the engine lifecycle read gate for the document job, while provisioning a cold source needs the write gate. Enabling a separate query embedding endpoint does not avoid that lock, including with the optional chatbot LLM disabled.  ### Changes  - Update `EngineAccess` directly so cold reads can reuse a non-closing initialized   engine whose relational, vector and original embedding configurations match.   Warm reads retain their existing engines; unmatched configurations and cold   startup use normal provisioning. No source slot alias is created. Writes and   document processing retain their normal provisioning path, and existing source   filters continue to govern evidence, events and citations. - Align optional LLM and embedding Test controls with the original model controls:   green success with a checkmark, red failure with an X, consistent button wording,   and success messages identifying the tested LLM provider/model or validated   embedding dimensions. Retrying clears the preceding result. Tests still use   authenticated unsaved drafts and sanitized errors without saving configuration. - Add concurrency coverage for complete `search_context` calls during blocked   extraction, warm/cold sources, query embedding enabled/disabled, source isolation,   and live connection saves. Verify the existin

- **Issue #219** (2026-10-04): **Add native Responses API support to model settings**
  *Symptoms*: SAG model settings currently expose Chat Completions, Anthropic, and Gemini generation. Add native Responses API support for the original generation connection and optional independent chatbot LLM. Users select **OpenAI-compatible → Responses API**, enter the full endpoint ending in `/responses`, and configure the model and key.  - A supported LiteLLM custom provider translates text/images, streaming, function tools/results, structured output, usage, and retry behavior. Native Agent runtime methods preserve encrypted reasoning across tool turns and isolate concurrent runs. - One default Bearer connection supports compatible endpoints, Azure v1, and Bedrock Runtime/Mantle. Legacy Azure header/version overrides are under Advanced connection settings; existing saved overrides remain compatible. Controls reuse stock fields, dropdowns, and switches. - Configuration validates before database commit or worker startup. Endpoint/authentication changes clear existing keys unless replacements are supplied. Responses credentials are kept separate from embedding connections. - Restore the original embedding model's draft Test button with an authenticated native endpoint. It reports dimensions without saving settings, rebuilding vectors, or using the independent query connection. - Add configuration examples, Compose environment passthrough, operating/upgrade documentation, and a LiteLLM update to the 1.103.0 integration baseline. No database migration is required.  The implementation uses

- **Issue #218** (2026-10-04): **feat(api): add local AnyDoc document parsing**
  *Symptoms*: ## 变更  新增可选的 `anydoc` 文档解析方式，使用固定版本 `firecrawl-anydoc==0.2.4` 在本机转换 DOCX、PPTX、EPUB、文本 PDF 和 CSV。设置页可选择 AnyDoc，文档状态显示实际解析提供者；默认仍为 `auto`。  - 显式使用 `ocr="reject"`，文件不上传至 AnyDoc 托管服务。扫描 PDF 返回需要 OCR 的页码；含扫描页的混合 PDF 整份失败，不将部分正文入库。损坏、加密、超限和空内容明确报告失败。 - CSV 复用现有编码识别，规范成 UTF-8 后转换，覆盖 GB18030、UTF-16 等中文输入；上传原文件保持不变。 - 只有 AnyDoc 明确返回 Unsupported 时允许一次 MarkItDown 回退。缓存签名包含 SDK 与适配器版本，任务状态保留实际解析器和回退来源；转换、回退和缓存发布边界检查暂停，恢复时保留既有解析任务与来源信息。 - XLS/XLSX 沿用现有 MarkItDown 转换和引擎的表格记录组、检索切片行为，并显示实际解析器。 - 补充合成文档、解析器单元测试、上传到检索的集成测试和生产镜像转换验收脚本。  保留官方 `zleap-sag==0.13.0`，依赖仅新增 AnyDoc。此 PR 不修改引擎源码、引擎依赖来源、API Dockerfile 或现有 CI 安装链路。  ## 验证  基于上游 `main` 的 `8b89fa2`：  - 后端全量 pytest：918 通过、1 跳过、0 失败。首轮出现共享 SQLite 测试库锁冲突及后续状态残留，4 个失败用例单独复测全部通过，随后在无并行构建、无分支同步的环境中完整复跑通过；期间未修改业务代码或测试断言。 - Ruff 全量通过，`uv lock --check --offline` 通过。 - Web：613 项单元测试通过，类型检查和 lint 通过。 - 标准 API Dockerfile 构建成功；生产镜像内真实 AnyDoc DOCX、GB18030 CSV、文本 PDF、扫描 PDF 拒绝行为和 XLS 路由验收通过。该验收只挂载测试文件，使用镜像内的 API 源码和官方引擎 0.13.0。 - 上传集成测试覆盖 HTTP 上传、任务队列、转换、分块、检索、引用原文和下载原文件。向量及事项抽取使用离线替身，不评估真实模型效果。 - 新增上传测试复用 DSH 集成夹具；夹具只等待本次信源的处理任务，并通过正式删除路径清理资源，避免无关的全局后台任务影响测试退出。 - 标准 Web Dockerfile 构建成功，standalone 镜像启动后 `/login` 返回 HTTP 200。 - 提交范围与 UTF-8 检查通过，不包含密钥、数据库、用户上传内容或临时验收报告。  ## 限制  - 本地 AnyDoc 路径不提供 OCR；需要 OCR 时应选择已配置的 MinerU。暂停在转换边界生效，不保证立即中断正在执行的原生转换。 - Excel General 数字格式的既有尾零问题单独报告在 [Issue #217](https://github.com/Zleap-AI/SAG/issues/217)，由引擎维护者处理；此 PR 保持现有 Excel 行为，不提交金额修复或本地发行包。 - PostgreSQL E2E 需要专用服务，本地离线验收环境未配置；仓库现有 PostgreSQL CI job 保留。 

- **Issue #216** (2026-10-03): **feat(api): add local AnyDoc parsing and preserve spreadsheet amounts**
  *Symptoms*: ## 变更  新增可选的 `anydoc` 解析器，使用固定版本 `firecrawl-anydoc==0.2.4` 在本机转换 DOCX、PPTX、EPUB、文本 PDF 和 CSV。设置页可选 AnyDoc，文档状态显示实际解析提供者；默认仍为 `auto`。  - 显式使用 `ocr="reject"`，不调用托管 OCR。扫描 PDF 返回需要 OCR 的页码，含扫描页的混合 PDF 整份失败，不把部分正文入库；损坏、加密、超限和空内容均明确失败。 - CSV 复用现有编码识别后规范成 UTF-8，覆盖 GB18030、UTF-16 等中文输入；上传原文件保持不变。 - 只有 AnyDoc 明确返回 Unsupported 时允许一次 MarkItDown 回退。缓存签名包含 SDK 与适配器版本，回退来源及错误保留在任务状态；转换、回退和缓存发布边界检查暂停，恢复时保留既有远程解析任务与来源信息。 - XLS/XLSX 继续使用 MarkItDown，保持表格记录组和检索切片的语义。  同时修复 `zleap-sag 0.13.0` 的 General 数字格式化：整数金额 `10`、`20` 曾被尾零裁剪为 `1`、`2`，现在保留整数尾零。项目暂时固定使用本地版本 `0.13.0+sag.1`；wheel 基于哈希固定的官方包，只修改格式化表达式、版本元数据和 RECORD，保留原 MIT 许可证。标准库构建脚本、精确差异、哈希和安装说明见 [`apps/api/vendor/README.md`](https://github.com/sq454313544/SAG/blob/contrib/anydoc-local-parser/apps/api/vendor/README.md)。uv、pip、Docker 和 CI 使用相同的依赖来源。  拆分为两个 commit，便于分别评审金额修复和 AnyDoc 接入。DSH 测试夹具只等待本次知识库的处理任务，并通过正式删除路径清理资源，避免全量测试的共享数据库中全局索引任务干扰清理。  ## 验证  基于上游 `main` 的 `b9895bd`（包含 #213、#212 等近期合并）：  - 后端全量 pytest：939 通过、1 跳过、0 失败（跳过项需要专用 PostgreSQL 服务）。 - Ruff 全量通过，`uv lock --check --offline` 通过。 - 自动化上传闭环覆盖 HTTP 上传、真实任务队列、转换、分块、向量检索、引用原文和下载原文件；向量及事项抽取使用离线替身，该组不评估真实模型效果。 - Web：599 个单元测试通过，类型检查和 lint 通过。 - 官方 API/Web Dockerfile 均完整构建成功；API 生产镜像中实际 DOCX、CSV、文本/扫描 PDF、BIFF XLS 转换通过，表格金额保持 10/20；Web standalone 镜像启动并访问 `/login` 返回 200。 - 此前在本地功能版本做过真实模型人工验收：14 份样例中 11 份就绪、3 份按预期失败，中文、金额和混合 PDF 整份失败行为符合预期；3 次页面检索及 2 次问答的事实与引用正确。同步上游后的验证以上述自动化和生产镜像测试为准。 - 提交范围和 UTF-8 检查通过；不包含本地密钥、数据库、用户上传内容或临时验收报告。  ## 评审关注与限制  - 请重点评审临时 vendored wheel 的采用方式。后续采用经金额回归验
  **Post-Mortem & Fix Analysis**:
  > 已将贡献收窄为本地 AnyDoc 文档解析功能，并重新提交为 [PR #218](https://github.com/Zleap-AI/SAG/pull/218)。新 PR 基于最新主线，只有一个功能提交，保留官方 `zleap-sag==0.13.0`，不包含引擎补丁、本地 wheel 或安装链路改动。  Excel General 数字格式将 10/20 显示为 1/2 的既有缺陷，已单独报告在 [Issue #217](https://github.com/Zleap-AI/SAG/issues/217)，不随功能提交修复。  因此撤回本草稿 PR，后续请在 #218 评审 AnyDoc 功能。 

- **Issue #215** (2026-10-03): **fix(web): clarify embedding URL and key inheritance**
  *Symptoms*: ## 改动范围  - 修复清空 Embedding Base URL 后仍显示固定 302 地址的问题，改为说明留空时的使用规则。 - 实时展示“当前使用／保存后使用”的向量地址及其来源，并分别说明新填、已保存、继承或未配置的密钥；独立密钥搭配继承地址时补充服务匹配提示。 - 补齐中英文文案与 14 项交互回归测试。Closes #214。  ## 影响功能范围  - 仅影响模型设置页的前端提示；保存请求、后端配置继承、密钥保留及连接测试行为保持现有契约。 - OpenAI-compatible 服务展示实际继承的生成模型地址；Anthropic／Gemini 地址留空时说明使用 SDK 默认地址且不继承生成模型地址。提示不回显密钥内容。  

- **Issue #214** (2026-10-03): **[Bug] 清空 Embedding API 地址后，302 占位提示与实际生效地址不一致**
  *Symptoms*: ### 问题描述  在生成模型使用百炼、Embedding 使用 302.AI 的配置中，清空独立 Embedding API 地址并保存后，输入框仍显示 `https://api.302ai.cn/v1` 的灰色占位提示，容易让用户误以为已经恢复 302 默认地址。  实际生效地址会复用生成模型的百炼地址，独立 Embedding Key 则仍保留为 302 Key，因此后续向量请求可能返回 HTTP 401，文档入库失败。这里的“文档解析失败”可能发生在向量构建阶段，并非源文件无效或本地解析器转换失败。  ### 复现步骤  1. 生成模型选择 OpenAI-compatible provider，地址设置为 `https://dashscope.aliyuncs.com/compatible-mode/v1`，使用对应的百炼 Key。 2. 独立 Embedding 配置为：模型 `Qwen/Qwen3-Embedding-4B`、地址 `https://api.302ai.cn/v1`、对应的 302 Key、维度 `1024`。显式填写此地址时可以完成向量化。 3. 将独立 Embedding API 地址清空，保留 302 Embedding Key。输入框此时显示灰色的 302 地址占位提示。 4. 点击保存，再上传或重新处理一个有效的文本文件。  用户最初的操作还包括先保存另一个自定义地址，再切回 302 Key 并清空地址；只要生成模型仍配置为百炼，上面的步骤就能展示同一组地址与 Key 的不匹配。  ### 实际行为与核对结果  - 前端保存空输入时发送 `embedding_base_url: ""`。 - `save_model_config` 将空字符串清除为 `None`，没有继续保留之前的独立 Embedding 地址。 - 对允许复用凭据的生成模型 provider，`effective_embedding_base_url` 在独立地址为空时回退到 `llm_base_url`。 - `effective_embedding_api_key` 独立选择 Key，因此非空的 302 Embedding Key 会与百炼地址组合。 - 在这组真实配置中，向量请求曾返回 HTTP 401 / `invalid_api_key`，文档入库报 `index_rolled_back`。恢复显式 302 地址并使用完整模型 ID 后，正常样例可以完成入库。  只读配置复现实验也确认了以下结果；使用虚构 Key，没有改动正在运行的配置或知识库数据：  ```text llm_base_url = https://dashscope.aliyuncs.com/compatible-mode/v1 embedding_base_url = None effective_embedding_base_url = https://dashscope.aliyuncs.com/compatible-mode/v1 embedding_api_key = <独立 Embedding Key，已脱敏> ```  ### 预期行为  界面应明确区分“恢复默认地址”和“留空复用生成模型地址”。用户看到 302 占位提示时，会预期保存后实际请求 302，而不是另一个 provider。  现有帮助文案写着“端点或密钥留空时复用生成模型配置”，因此当前后端回退行为有既定语义。建议保留这一能力，同时消除固定占位提示与实际生效地址的冲突：  - 地址留空

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

### Incident Patch 1: `52ca53ad` (2026-10-05)
**Commit Message**: Fix New conversation reopening the previous chat (#222)

* fix(web): preserve new conversation selection across navigation

* docs: sync bilingual new conversation guidance

---------

Co-authored-by: Lucas <[REDACTED_EMAIL]>
Co-authored-by: luoshuai990529 <[REDACTED_EMAIL]>

**File**: `README-CN.md` (modified, +2/-0)
```diff
@@ -220,6 +220,8 @@ PDF 在 MinerU 配置完整时优先使用 MinerU；未配置或解析失败时
 
 通过 `@` 选择信源，可以缩小某个问题的知识检索范围。每个问题选择的信源标签会保留在对话历史中，点击“重试”时会复用该问题保存的范围。标签表示选定的检索范围，回答中的引用表示实际使用的证据。详见[对话历史中的信源范围](docs/chat-source-scope.md)。
 
+在任意页面点击侧栏的“新建对话”，都可以打开空白草稿。即使旧对话仍在生成回答，返回聊天页时也会保留新草稿的选中状态。原有对话仍保留在历史中，新草稿会在发送第一个问题后保存为对话。SAG 一次生成一个回答，因此需要等待当前回答结束或先停止它，再在新草稿中发送问题。
+
 <p align="center">
   <img src="docs/assets/readme/product-chat.png" alt="带原文引用的 Agent 回答" width="940" />
 </p>
```

**File**: `README.md` (modified, +2/-0)
```diff
@@ -224,6 +224,8 @@ The default Agent searches the bound knowledge sources, streams the answer, and
 
 Select sources with `@` to narrow a question's knowledge scope. Each question keeps its selected-source badges in conversation history, and Retry reuses that saved scope. The badges show the selected search scope; the answer's citations show the evidence actually used. See [source scope in chat history](docs/chat-source-scope.md).
 
+Use **New conversation** in the sidebar to open a blank draft from any page. The draft stays selected when returning to chat, even while an older conversation finishes generating. Existing conversations remain in history; a new thread is saved when you send the first question. SAG generates one answer at a time, so wait for the ongoing answer to finish or stop it before sending in the new draft.
+
 <p align="center">
   <img src="docs/assets/readme/product-chat.png" alt="Agent answer with source citations" width="940" />
 </p>
```

**File**: `apps/web/app/(app)/chat/[[...id]]/page.tsx` (modified, +14/-26)
```diff
@@ -2,11 +2,12 @@
 
 import * as React from "react";
 import { useTranslations } from "next-intl";
-import { useParams, usePathname, useRouter } from "next/navigation";
+import { useParams, usePathname } from "next/navigation";
 
 import { DEFAULT_AGENT_AVATAR } from "@/lib/branding";
 import { useApp } from "@/components/features/app-shell";
 import {
+  useConversationIndex,
   useConversationRuntime,
   useConversationSession,
 } from "@/components/features/chat/conversation-provider";
@@ -18,52 +19,39 @@ export default function ChatPage() {
   const t = useTranslations("ChatPage");
   const { id } = useParams<{ id?: string | string[] }>();
   const pathname = usePathname();
-  const router = useRouter();
   const { agent, appMode } = useApp();
   const runtime = useConversationRuntime();
+  const index = useConversationIndex();
   const routeThreadId =
     (Array.isArray(id) ? id[0] : id) ?? pathname.match(/^\/chat\/([^/]+)/)?.[1] ?? null;
-  const [sessionId, setSessionId] = React.useState<string | null>(null);
-  const preferredDraftRef = React.useRef<string | null>(null);
+  // The sidebar selects a draft before navigating. Derive the displayed session
+  // from the shared runtime so that selection survives page unmounts and streams.
+  const sessionId = routeThreadId
+    ? index.sessions.find((entry) => entry.threadId === routeThreadId)?.sessionId ?? null
+    : index.activeSessionId;
   const session = useConversationSession(sessionId);
 
   React.useEffect(() => {
     if (routeThreadId) {
-      preferredDraftRef.current = null;
-      setSessionId(runtime.forThread(routeThreadId, { activate: true }));
+      runtime.forThread(routeThreadId, { activate: true });
       return;
     }
-    const index = runtime.getIndexSnapshot();
-    const next =
-      preferredDraftRef.current ??
-      index.activeRunSessionId ??
-      index.activeSessionId ??
+    if (!runtime.getIndexSnapshot().activeSessionId) {
       runtime.createDraft({ activate: true });
-    preferredDraftRef.current = null;
-    runtime.activate(next);
-    setSessionId(next);
+    }
   }, [routeThreadId, runtime]);
 
-  React.useEffect(() => {
-    const onNewChat = () => {
-      const next = runtime.createDraft({ activate: true });
-      preferredDraftRef.current = next;
-      setSessionId(next);
-      if (window.location.pathname !== "/chat") router.push("/chat");
-    };
-    window.addEventListener("sag:new-chat", onNewChat);
-    return () => window.removeEventListener("sag:new-chat", onNewChat);
-  }, [router, runtime]);
-
   React.useEffect(() => {
     const threadId = session?.threadId;
     if (!threadId || routeThreadId) return;
+    // A newer selection must not be overwritten by an effect from the old chat.
+    if (runtime.getIndexSnapshot().activeSessionId !== sessionId) return;
     const nextPath = `/chat/${threadId}`;
     if (window.location.pathname === nextPath) return;
     // 不触发路由卸载，确保创建线程后的流式回答持续由同一 runtime 托管。
     window.history.replaceState(window.history.state, "", nextPath);
     window.dispatchEvent(new Event("sag:pathchange"));
-  }, [routeThreadId, session?.threadId]);
+  }, [routeThreadId, runtime, sessionId, session?.threadId]);
 
   const glyph = agent?.avatar || DEFAULT_AGENT_AVATAR;
   const avatarNode = React.useMemo(
```

**File**: `apps/web/components/features/app-sidebar.tsx` (modified, +3/-2)
```diff
@@ -24,7 +24,7 @@ import {
   workspaceSectionFromPathname,
 } from "@/lib/workspace";
 import { useApp } from "@/components/features/app-shell";
-import { useConversationIndex } from "@/components/features/chat/conversation-provider";
+import { useConversationIndex, useConversationRuntime } from "@/components/features/chat/conversation-provider";
 import { WorkspaceSectionIcon } from "@/components/features/workspace-section-icon";
 import { DesktopUpdateIndicator } from "@/components/features/desktop-update-indicator";
 import { AppVersionBadge } from "@/components/features/app-version-badge";
@@ -155,6 +155,7 @@ export function AppSidebar({ contained = false }: { contained?: boolean }) {
     collapseThreads,
     timezone,
   } = useApp();
+  const conversationRuntime = useConversationRuntime();
   const conversationIndex = useConversationIndex();
   const runningThreads = React.useMemo(
     () =>
@@ -243,7 +244,7 @@ export function AppSidebar({ contained = false }: { contained?: boolean }) {
                 <button
                   type="button"
                   onClick={() => {
-                    window.dispatchEvent(new Event("sag:new-chat"));
+                    conversationRuntime.createDraft({ activate: true });
                     router.push("/chat");
                   }}
                   aria-label={t("newChat")}
```

**File**: `apps/web/components/features/chat/new-conversation.test.tsx` (added, +264/-0)
```diff
@@ -0,0 +1,264 @@
+/** @vitest-environment jsdom */
+import * as React from "react";
+import { act } from "react";
+import { createRoot, type Root } from "react-dom/client";
+import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
+
+import ChatPage from "@/app/(app)/chat/[[...id]]/page";
+import { AppSidebar } from "@/components/features/app-sidebar";
+import { ConversationProvider, useConversationRuntime } from "@/components/features/chat/conversation-provider";
+import type { ConversationRuntime, ConversationTransport } from "@/lib/conversation-runtime";
+import type { AgentRunOutcome } from "@/lib/sse";
+
+const navigation = vi.hoisted(() => ({
+  pathname: "/knowledge",
+  params: {} as { id?: string[] },
+  router: { push: vi.fn() },
+}));
+vi.mock("next/navigation", () => ({
+  usePathname: () => navigation.pathname,
+  useParams: () => navigation.params,
+  useRouter: () => navigation.router,
+}));
+vi.mock("next-intl", () => ({
+  useLocale: () => "en-US",
+  useTranslations: () => (key: string) => key,
+}));
+vi.mock("next/link", () => ({
+  default: ({ children, href, ...props }: React.PropsWithChildren<{ href: string }>) => <a href={href} {...props}>{children}</a>,
+}));
+vi.mock("next/image", () => ({ default: () => null }));
+vi.mock("@/components/features/app-shell", () => ({
+  useApp: () => ({
+    agent: { id: "agent-1", name: "Agent", avatar: "", persona: {} },
+    appMode: "normal", user: { name: "Local test" }, logout: vi.fn(),
+    threads: [], hasMoreThreads: false, threadsExpanded: false,
+    loadingMoreThreads: false, refreshThreads: vi.fn(), loadMoreThreads: vi.fn(),
+    collapseThreads: vi.fn(), timezone: "UTC",
+  }),
+}));
+vi.mock("@/components/features/pet-head-avatar", () => ({ PetHeadAvatar: () => null }));
+vi.mock("@/components/features/workspace-section-icon", () => ({ WorkspaceSectionIcon: () => null }));
+vi.mock("@/components/features/desktop-update-indicator", () => ({ DesktopUpdateIndicator: () => null }));
+vi.mock("@/components/features/app-version-badge", () => ({ AppVersionBadge: () => null }));
+vi.mock("@/components/features/chat/conversation-panel", async () => {
+  const { useConversationSession, useConversationRuntime } = await import("@/components/features/chat/conversation-provider");
+  return {
+    ConversationPanel: ({ sessionId }: { sessionId: string }) => {
+      const session = useConversationSession(sessionId);
+      const runtime = useConversationRuntime();
+      React.useEffect(() => {
+        runtime.activate(sessionId);
+        void runtime.ensureHistory(sessionId);
+      }, [runtime, sessionId]);
+      return <section data-testid="conversation" data-session={sessionId} data-thread={session?.threadId ?? ""}>
+        {session?.messages.map((message) => <p key={message.id}>{message.content}</p>)}
+      </section>;
+    },
+  };
+});
+vi.mock("@/components/ui/sidebar", () => {
+  const pass = ({ children }: React.PropsWithChildren) => <>{children}</>;
+  return Object.fromEntries([
+    "Sidebar", "SidebarContent", "SidebarFooter", "SidebarGroup", "SidebarGroupLabel",
+    "SidebarHeader", "SidebarMenu", "SidebarMenuButton", "SidebarMenuItem", "SidebarRail",
+  ].map((name) => [name, pass]));
+});
+vi.mock("@/components/ui/tooltip", () => {
+  const pass = ({ children }: React.PropsWithChildren) => <>{children}</>;
+  return { Tooltip: pass, TooltipTrigger: pass, TooltipContent: pass };
+});
+vi.mock("@/components/ui/dropdown-menu", () => {
+  const pass = ({ children }: React.PropsWithChildren) => <>{children}</>;
+  return Object.fromEntries([
+    "DropdownMenu", "DropdownMenuContent", "DropdownMenuItem", "DropdownMenuLabel",
+    "DropdownMenuSeparator", "DropdownMenuTrigger",
+  ].map((name) => [name, pass]));
+});
+
+let root: Root;
+let container: HTMLDivElement;
+let runtime: ConversationRuntime;
+let transport: ConversationTransport;
+let settleRun: ((outcome: AgentRunOutcome) => void) | null;
+
+function Capture() {
+  runtime = useConversationRuntime();
+  return null;
+}
+function Harness({ chat }: { chat: boolean }) {
+  return <ConversationProvider agentId="agent-1" transport={transport}>
+    <Capture />
+    <AppSidebar />
+    {chat && <ChatPage />}
+  </ConversationProvider>;
+}
+async function navigate(path: string, chat: boolean) {
+  navigation.pathname = path;
+  navigation.params = path.startsWith("/chat/") ? { id: [path.split("/")[2]] } : {};
+  window.history.pushState({}, "", path);
+  await act(async () => root.render(<Harness chat={chat} />));
+}
+async function clickNew() {
+  const button = container.querySelector<HTMLButtonElement>('button[aria-label="newChat"]');
+  expect(button).not.toBeNull();
+  await act(async () => button!.click());
+}
+
+beforeEach(async () => {
+  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
+  navigation.pathname = "/knowledge";
+  navigation.params = {};
+  navigation.router.push.mockReset();
+  settleRun = null;
+  t
```

---

### Incident Patch 2: `0cdb43e5` (2026-10-05)
**Commit Message**: Fix cold-source chatbot retrieval blocking during extraction and align model-test feedback (#220)

* fix: align optional model test feedback with original controls

* fix: reuse compatible storage for cold reads during extraction

---------

Co-authored-by: Lucas <[REDACTED_EMAIL]>

**File**: `apps/api/sag_api/api/v1/chatbot.py` (modified, +4/-2)
```diff
@@ -124,9 +124,11 @@ async def test_config(body: TestDraft, _user: Annotated[object, Depends(get_curr
         try:
             if body.target == "llm":
                 await QueryLLM(snapshot.settings).complete([{"role": "user", "content": "ping"}])
+                message = f"连接成功 · {snapshot.settings.llm_provider} / {snapshot.settings.llm_model}"
             else:
                 adapter = rt.ScopedAdapter(snapshot.adapter("embedding"), "embedding")
-                await adapter.generate("ping")
+                vector = await adapter.generate("ping")
+                message = f"Embedding connection successful · {len(vector)} dimensions"
         except Exception:  # noqa: BLE001 -- this boundary must hide every provider's error bodies.
             # Provider errors, including headers/bodies/URLs, never reach the administrative UI.
             return {
@@ -135,4 +137,4 @@ async def test_config(body: TestDraft, _user: Annotated[object, Depends(get_curr
                     "Connection test failed; check endpoint, provider, model, credentials and server availability"
                 ),
             }
-    return {"ok": True, "message": "Connection successful"}
+    return {"ok": True, "message": message}
```

**File**: `apps/api/sag_api/sag/engine_access.py` (modified, +29/-0)
```diff
@@ -12,6 +12,7 @@
 
 from __future__ import annotations
 
+import time
 from typing import TYPE_CHECKING, Any
 
 if TYPE_CHECKING:
@@ -27,10 +28,38 @@ def __init__(self, manager: EngineManager) -> None:
 
     # --- 引擎槽与运行时 ---
 
+    def _shared_slot(self, source_config_id: str, source: Any = None) -> Any:
+        """Reuse compatible initialized storage for a cold read scope.
+
+        Source filters remain the reader's responsibility. Do not create a slot
+        alias: mutations must still provision their own source engine normally.
+        """
+        manager = self._manager
+        existing = manager._slots.get(source_config_id)
+        if existing is not None and not existing.closing:
+            return None
+        wanted = manager._config_for(source)
+        for slot in manager._slots.values():
+            if slot.closing:
+                continue
+            actual = slot.engine._config
+            if (actual.relational, actual.vector, actual.embedding) == (
+                wanted.relational, wanted.vector, wanted.embedding,
+            ):
+                slot.last_used = time.monotonic()
+                return slot
+        return None
+
     async def slot(self, source_config_id: str, source: Any = None) -> Any:
+        shared = self._shared_slot(source_config_id, source)
+        if shared is not None:
+            return shared
         return await self._manager._slot(source_config_id, source)
 
     async def relational_session_factory(self, source_config_id: str, source: Any = None) -> Any:
+        shared = self._shared_slot(source_config_id, source)
+        if shared is not None:
+            return shared.engine.resources.relational.session_factory()
         return await self._manager._relational_session_factory(source_config_id, source)
 
     async def ensure_read_runtime(self, sources_by_config: dict[str, Any]) -> None:
```

**File**: `apps/api/tests/chatbot/test_api.py` (modified, +8/-1)
```diff
@@ -76,7 +76,8 @@ async def complete(**kwargs):
         "llm": {"enabled": True, "model": "draft", "api_key": "draft-secret", "base_url": "https://draft.invalid/v1"},
     }
     response = await client.post("/api/v1/system/chatbot-config/test", json=body)
-    assert response.json()["ok"] and requests[0]["api_key"] == "draft-secret"
+    assert response.json() == {"ok": True, "message": "连接成功 · openai / draft"}
+    assert requests[0]["api_key"] == "draft-secret"
     assert requests[0]["model"] == "openai/draft" and isolate.persisted == {}
 
     async def fail(**kwargs):
@@ -162,6 +163,12 @@ async def complete(**kwargs):
     for target, draft in drafts.items():
         result = await client.post("/api/v1/system/chatbot-config/test", json={"target": target, target: draft})
         assert result.status_code == 200 and result.json()["ok"], result.text
+        expected_message = (
+            "连接成功 · openai / local-model"
+            if target == "llm"
+            else "Embedding connection successful · 3 dimensions"
+        )
+        assert result.json()["message"] == expected_message
         assert isolate.persisted == {}
     result = await client.put("/api/v1/system/chatbot-config", json=drafts)
     assert result.status_code == 200, result.text
```

**File**: `apps/api/tests/chatbot/test_retrieval_contention.py` (added, +287/-0)
```diff
@@ -0,0 +1,287 @@
+"""Exercise the complete stock search_context tool during a real document job."""
+
+import asyncio
+import json
+import os
+import sys
+import uuid
+from types import SimpleNamespace
+from unittest.mock import AsyncMock
+
+import httpx
+import pytest
+from litellm import ModelResponse
+from openai import AsyncOpenAI
+from sqlalchemy.engine import make_url
+from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
+
+from sag_api.api.v1.chatbot import save_config
+from sag_api.core import db
+from sag_api.core.chatbot_config import Environment, Update
+from sag_api.core.config import settings
+from sag_api.core.db import SessionLocal, init_db
+from sag_api.generation.chatbot import QueryLLM
+from sag_api.sag.engine_manager import EngineManager
+from sag_api.services import chatbot_service as rt
+from sag_api.tools.base import ToolContext
+from sag_api.tools.builtin import SearchContextTool
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize("query_embedding_enabled", [True, False])
+@pytest.mark.parametrize("target_warm", [False, True])
+@pytest.mark.parametrize("live_update", [False, True])
+async def test_search_during_extraction(
+    tmp_path, monkeypatch, query_embedding_enabled, target_warm, live_update,
+):
+    stock = settings.model_copy(deep=True)
+    stock.data_dir = str(tmp_path / "engine")
+    postgres_url = os.environ.get("SAG_CHATBOT_TEST_POSTGRES_URL")
+    if postgres_url:
+        url = make_url(postgres_url)
+        stock.sag_vector_provider = "pgvector"
+        stock.sag_relational_provider = "postgres"
+        stock.sag_pg_host, stock.sag_pg_port = url.host, url.port or 5432
+        stock.sag_pg_user, stock.sag_pg_password, stock.sag_pg_database = url.username, url.password, url.database
+    else:
+        stock.sag_vector_provider = "lancedb"
+        stock.sag_relational_provider = None
+    stock.llm_model = "stock-model"
+    stock.llm_api_key = "stock-key"
+    stock.llm_base_url = "https://stock.invalid/v1"
+    stock.embedding_model = "stock-embedding"
+    stock.embedding_api_key = "stock-embedding-key"
+    stock.embedding_base_url = "https://stock-embedding.invalid/v1"
+    stock.embedding_schema_dimensions = 16
+    stock.embedding_request_dimensions = 16
+    manager = rt.Manager(
+        Environment({
+            "SAG_CHATBOT_EMBEDDING_ENABLED": str(query_embedding_enabled).lower(),
+            "SAG_CHATBOT_EMBEDDING_BASE_URL": "https://query-embedding.invalid/v1",
+            **({
+                "SAG_CHATBOT_LLM_ENABLED": "true",
+                "SAG_CHATBOT_LLM_MODEL": "before-save",
+                "SAG_CHATBOT_LLM_BASE_URL": "https://before-save.invalid/v1",
+            } if live_update else {}),
+        }),
+        stock,
+    )
+    monkeypatch.setattr(rt, "manager", manager)
+    assert manager.connections()["llm"].enabled == live_update
+    calls, chat_calls = [], []
+    blocked, release = asyncio.Event(), asyncio.Event()
+    pause_extraction = False
+
+    def embed(request):
+        body = json.loads(request.content)
+        calls.append((request.url.host, rt.query_scope.get()))
+        inputs = body["input"] if isinstance(body["input"], list) else [body["input"]]
+        return httpx.Response(200, json={
+            "data": [{"index": i, "embedding": [1.0] + [0.0] * 15} for i in range(len(inputs))],
+            "model": body["model"],
+            "usage": {"prompt_tokens": 1, "total_tokens": 1},
+        })
+
+    monkeypatch.setattr("openai.AsyncOpenAI", lambda **kwargs: AsyncOpenAI(
+        **kwargs, http_client=httpx.AsyncClient(transport=httpx.MockTransport(embed)),
+    ))
+
+    async def complete(**kwargs):
+        assert kwargs["api_key"] == stock.llm_api_key
+        assert kwargs["api_base"] == stock.llm_base_url
+        calls.append(("llm", rt.query_scope.get()))
+        if pause_extraction:
+            blocked.set()
+            await release.wait()
+        return ModelResponse(model=kwargs["model"], choices=[{
+            "message": {"role": "assistant", "content": json.dumps({
+                "type": "response", "data": {"items": [{
+                    "reason": "The document specifies an annual leave entitlement.",
+                    "title": "Annual leave policy",
+                    "summary": "Employees receive twenty days of annual leave.",
+                    "content": "Employees receive twenty days of annual leave.",
+                    "references": [1],
+                    "entities": [{"type": "concept", "name": "Annual leave", "description": "Employee leave"}],
+                }]},
+            })},
+            "finish_reason": "stop",
+        }])
+
+    monkeypatch.setattr("litellm.acompletion", complete)
+
+    async def chat_completion(**kwargs):
+        chat_calls.append((kwargs["api_base"], kwargs["model"]))
+        return ModelResponse(model=kwargs["model"], choices=[{
+            "message": {"role": "assistant", "content": "chat-ok"}, "finish_reas
```

**File**: `apps/api/tests/test_engine_access.py` (added, +86/-0)
```diff
@@ -0,0 +1,86 @@
+"""Native read storage reuse and mutation separation."""
+
+from types import SimpleNamespace
+from unittest.mock import AsyncMock
+
+import pytest
+
+from sag_api.core.config import settings
+from sag_api.sag.config_builder import build_engine_config
+from sag_api.sag.engine_access import EngineAccess
+
+
+@pytest.fixture
+def access():
+    config = build_engine_config(settings)
+    factory = object()
+    slot = SimpleNamespace(
+        closing=False, last_used=0,
+        engine=SimpleNamespace(
+            _config=config,
+            resources=SimpleNamespace(relational=SimpleNamespace(session_factory=lambda: factory)),
+        ),
+    )
+    manager = SimpleNamespace(
+        _slots={"extracting": slot},
+        _config_for=lambda source: config if source is None else source,
+        _slot=AsyncMock(return_value="stock-slot"),
+        _relational_session_factory=AsyncMock(return_value="stock-factory"),
+    )
+    return EngineAccess(manager), slot, factory
+
+
+@pytest.mark.asyncio
+async def test_cold_read_reuses_compatible_storage_without_creating_or_aliasing_engine(access):
+    reader, shared, factory = access
+    assert await reader.slot("cold") is shared
+    assert await reader.relational_session_factory("cold") is factory
+    assert shared.last_used > 0
+    assert list(reader._manager._slots) == ["extracting"]
+    reader._manager._slot.assert_not_awaited()
+    reader._manager._relational_session_factory.assert_not_awaited()
+    # Mutations still enter the original manager, rather than the read-side seam.
+    assert await reader._manager._slot("cold") == "stock-slot"
+
+
+@pytest.mark.parametrize("state", ["empty", "closing", "warm"])
+@pytest.mark.asyncio
+async def test_stock_path_preserved_without_a_reusable_slot(access, state):
+    reader, shared, _ = access
+    if state == "empty":
+        reader._manager._slots.clear()
+    elif state == "closing":
+        shared.closing = True
+    else:
+        reader._manager._slots["cold"] = shared
+    assert await reader.slot("cold") == "stock-slot"
+    assert await reader.relational_session_factory("cold") == "stock-factory"
+    reader._manager._slot.assert_awaited_once_with("cold", None)
+    reader._manager._relational_session_factory.assert_awaited_once_with("cold", None)
+
+
+@pytest.mark.parametrize("kind", ["relational", "vector", "embedding"])
+@pytest.mark.asyncio
+async def test_different_storage_or_embedding_identity_never_reused(access, kind):
+    reader, shared, _ = access
+    wanted = shared.engine._config.model_copy(deep=True)
+    if kind == "embedding":
+        wanted.embedding.model = "different-weights"
+    else:
+        setattr(wanted, kind, getattr(wanted, kind).model_copy(update={"path": "/different-store"}))
+    assert await reader.slot("cold", wanted) == "stock-slot"
+    assert await reader.relational_session_factory("cold", wanted) == "stock-factory"
+    reader._manager._slot.assert_awaited_once_with("cold", wanted)
+
+
+@pytest.mark.asyncio
+async def test_provider_failure_propagates_without_selecting_another_backend(access):
+    reader, shared, _ = access
+
+    def fail():
+        raise RuntimeError("temporary database failure")
+
+    shared.engine.resources.relational.session_factory = fail
+    with pytest.raises(RuntimeError, match="temporary database failure"):
+        await reader.relational_session_factory("cold")
+    reader._manager._relational_session_factory.assert_not_awaited()
```

**File**: `apps/web/components/features/chatbot-config-sections.test.tsx` (modified, +28/-0)
```diff
@@ -4,6 +4,7 @@ import { act } from "react";
 import { createRoot, type Root } from "react-dom/client";
 import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 import english from "@/messages/en-US.json";
+import { clientErrorMessage } from "@/i18n/client-errors";
 import { ChatbotConfigSections } from "./chatbot-config-sections";
 
 vi.mock("@/components/features/app-shell", () => ({ useApp: () => ({ refreshCapabilities: vi.fn() }) }));
@@ -60,6 +61,33 @@ async function select(selector: string, label: string) {
 }
 
 describe("native chatbot settings", () => {
+  it.each(["llm", "embedding"])("shows green success and red failures for optional %s tests", async target => {
+    await mount();
+    const button = [...container.querySelectorAll<HTMLButtonElement>("button")].find(button =>
+      button.textContent === (target === "llm" ? "Test generation model" : "Test embedding model"))!;
+    const message = target === "llm" ? "连接成功 · openai / m" : "Embedding connection successful · 3 dimensions";
+    fetcher.mockImplementation(async () => Response.json({ ok: true, message }));
+    await act(async () => button.click());
+    const status = [...container.querySelectorAll<HTMLElement>('[role="status"]')].find(status => status.textContent === message)!;
+    expect(status.querySelector("span")!.classList.contains("text-success")).toBe(true);
+    expect(status.querySelector("svg.lucide-check")).toBeTruthy();
+
+    let finish: (response: Response) => void = () => undefined;
+    fetcher.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = resolve; }));
+    await act(async () => button.click());
+    expect(status.textContent).toBe("");
+    expect(button.disabled).toBe(true);
+    await act(async () => finish(Response.json({ ok: false, message: "Connection test failed" })));
+    expect(status.textContent).toBe("Connection test failed");
+    expect(status.querySelector("span")!.classList.contains("text-destructive")).toBe(true);
+    expect(status.querySelector("svg.lucide-x")).toBeTruthy();
+
+    fetcher.mockRejectedValueOnce(new Error("Network unavailable"));
+    await act(async () => button.click());
+    expect(status.textContent).toBe(clientErrorMessage("network"));
+    expect(status.querySelector("span")!.classList.contains("text-destructive")).toBe(true);
+    expect(status.querySelector("svg.lucide-x")).toBeTruthy();
+  });
   it("uses a single Responses connection and tests an unsaved advanced Azure authentication draft", async () => {
     await mount({ ...initial, llm: { ...initial.llm, provider: "responses" } },
       [{ id: "openai", display_name: "OpenAI-compatible" }, { id: "responses", display_name: "Responses API" }]);
```

**File**: `apps/web/components/features/chatbot-config-sections.tsx` (modified, +15/-8)
```diff
@@ -1,7 +1,7 @@
 "use client";
 
 import * as React from "react";
-import { Plug } from "lucide-react";
+import { Check, Plug, X } from "lucide-react";
 import { useTranslations } from "next-intl";
 import { SettingsRow, SettingsSection } from "@/components/features/settings-section";
 import { Button } from "@/components/ui/button";
@@ -11,6 +11,7 @@ import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@
 import { Spinner } from "@/components/ui/spinner";
 import { Switch } from "@/components/ui/switch";
 import { api } from "@/lib/api";
+import { cn } from "@/lib/utils";
 import type { ChatbotConfig as Config, ChatbotConnection as Connection, ModelProviderId, ModelProviderSpec } from "@/lib/types";
 import { OpenAIAPIFormatField, ResponsesBaseURLField, ResponsesConnectionFields } from "./responses-connection-fields";
 import type { ModelSettingsProps } from "./model-config-form";
@@ -26,7 +27,7 @@ export function ChatbotConfigSections({ saveRef, onState }: ModelSettingsProps =
   const [saving, setSaving] = React.useState(false);
   const [testing, setTesting] = React.useState<Record<Target, boolean>>({ llm: false, embedding: false });
   const [error, setError] = React.useState("");
-  const [results, setResults] = React.useState<Partial<Record<Target, string>>>({});
+  const [results, setResults] = React.useState<Partial<Record<Target, { ok: boolean; message: string }>>>({});
   const saved = React.useRef<Config | null>(null);
   const load = React.useCallback(async (retainEdits = false) => {
     try {
@@ -60,7 +61,7 @@ export function ChatbotConfigSections({ saveRef, onState }: ModelSettingsProps =
   const update = (target: Target, field: string, value: string | boolean) => {
     setConfig(current => current ? { ...current, [target]: { ...current[target], [field]: value,
     } } : current);
-    setResults(current => ({ ...current, [target]: "" }));
+    setResults(current => ({ ...current, [target]: undefined }));
   };
   const draft = (target: Target, connection: Connection) => {
     const fields = target === "llm"
@@ -95,14 +96,16 @@ export function ChatbotConfigSections({ saveRef, onState }: ModelSettingsProps =
   const test = async (target: Target) => {
     if (!config || config.locked || saving || testing[target]) return;
     setTesting(current => ({ ...current, [target]: true }));
-    setResults(current => ({ ...current, [target]: "" }));
+    setResults(current => ({ ...current, [target]: undefined }));
     try {
       const result = await api.testChatbotConfig({
         [target]: { ...draft(target, config[target]), api_key: keys[target] }, target,
       });
-      setResults(current => ({ ...current, [target]: result.message }));
+      setResults(current => ({ ...current, [target]: result }));
     } catch (e) {
-      setResults(current => ({ ...current, [target]: e instanceof Error ? e.message : c("testFailed") }));
+      setResults(current => ({ ...current, [target]: {
+        ok: false, message: e instanceof Error ? e.message : c("testFailed"),
+      } }));
     } finally { setTesting(current => ({ ...current, [target]: false })); }
   };
   if (error && !config) return <div role="alert">{error}<Button type="button" variant="outline" onClick={() => void load()}>{c("retry")}</Button></div>;
@@ -130,12 +133,16 @@ export function ChatbotConfigSections({ saveRef, onState }: ModelSettingsProps =
   </Field>;
   const controls = (target: Target) => <div className="flex flex-wrap items-center justify-between gap-3">
     <div role="status" className="min-h-5 min-w-0">
-      {results[target] && <span className="text-sm">{results[target]}</span>}
+      {results[target] && <span className={cn("inline-flex items-center gap-1.5 text-sm",
+        results[target]?.ok ? "text-success" : "text-destructive")}>
+        {results[target]?.ok ? <Check className="size-4" /> : <X className="size-4" />}
+        {results[target]?.message}
+      </span>}
     </div>
     <Button type="button" variant="outline" disabled={disabled(target)} onClick={() => void test(target)}>
       {testing[target] ? <Spinner /> : <Plug />}
       {testing[target] ? t("testing") : target === "llm" ? t("testGeneration")
-        : (c("testEmbedding"))}
+        : t("testEmbedding")}
     </Button>
   </div>;
   const enable = (target: Target) => <SettingsRow title={c("enable")} layout="inline">
```

**File**: `apps/web/components/features/model-config-form.test.tsx` (modified, +1/-1)
```diff
@@ -500,7 +500,7 @@ describe("one page-wide model Save", () => {
     const section = { llm: sections[0], embedding: sections[1] };
     const controls = (target: Target) => [...section[target].querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement>("input, button, select")];
     const buttons = Object.fromEntries((["llm", "embedding"] as const).map(target => [target,
-      [...section[target].querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === (target === "llm" ? "Test generation model" : "Test embedding connection"))!,
+      [...section[target].querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === (target === "llm" ? "Test generation model" : "Test embedding model"))!,
     ])) as Record<Target, HTMLButtonElement>;
     const finish: Partial<Record<Target, (response: FetchResponse) => void>> = {};
     fetcher.mockImplementation((_url, request) => new Promise(resolve => {
```

---

### Incident Patch 3: `41d7176f` (2026-10-04)
**Commit Message**: fix(desktop): bundle Responses thinking rules

**File**: `apps/api/packaging/sag-api.spec` (modified, +4/-1)
```diff
@@ -9,7 +9,10 @@ from PyInstaller.utils.hooks import (
 
 project_root = Path(SPECPATH).parent
 
-datas = []
+# Responses configuration reads this policy file at runtime beside its module.
+datas = [
+    (str(project_root / "sag_api" / "core" / "responses_thinking.json"), "sag_api/core"),
+]
 binaries = []
 hiddenimports = [
     "aiosqlite",
```

---

### Incident Patch 4: `184e0653` (2026-10-04)
**Commit Message**: test: isolate unrelated universe rebuilds in source fixtures

**File**: `apps/api/tests/test_dsh_integration.py` (modified, +18/-7)
```diff
@@ -52,13 +52,24 @@ async def _register(client: httpx.AsyncClient) -> dict[str, str]:
 
 @asynccontextmanager
 async def _draining_app_lifespan(app):
-    """Finish queued database writes before the integration app shuts down."""
-    async with app.router.lifespan_context(app):
-        try:
-            yield
-        finally:
-            async with asyncio.timeout(60):
-                await app.state.job_queue._queue.join()
+    """Isolate unrelated rebuild work and finish writes before app shutdown."""
+    from sag_api.enums import JobType
+    from sag_api.jobs.tasks import TASK_HANDLERS
+
+    async def unrelated_universe_rebuild(_session, _job, **_kwargs):
+        return None
+
+    # These cases test source/connector behavior. A global rebuild would scan
+    # every earlier case's persisted sources; dedicated universe tests cover it.
+    # Keep real scheduling, worker claims, commits and cleanup in this fixture.
+    with pytest.MonkeyPatch.context() as patch:
+        patch.setitem(TASK_HANDLERS, JobType.INDEX_UNIVERSE, unrelated_universe_rebuild)
+        async with app.router.lifespan_context(app):
+            try:
+                yield
+            finally:
+                async with asyncio.timeout(60):
+                    await app.state.job_queue._queue.join()
 
 
 @asynccontextmanager
```

---

### Incident Patch 5: `8b89fa24` (2026-10-03)
**Commit Message**: fix(web): clarify embedding URL and key inheritance (#215)

**File**: `apps/web/components/features/model-config-form.test.tsx` (modified, +230/-2)
```diff
@@ -4,6 +4,8 @@ import { act } from "react";
 import { createRoot, type Root } from "react-dom/client";
 import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
 import english from "@/messages/en-US.json";
+import chinese from "@/messages/zh-CN.json";
+import type { ModelConfig, ModelProviderSpec } from "@/lib/types";
 import { ModelConfigForm } from "./model-config-form";
 
 const mocks = vi.hoisted(() => ({ translate: (key: string) => key === "testGeneration" ? "Test generation model" : key === "testing" ? "Testing…" : key,
@@ -15,7 +17,16 @@ const chatbotTranslate = (key: string, values?: Record<string, string>) => {
   for (const [name, value] of Object.entries(values ?? {})) text = text.replace(`{${name}}`, value);
   return text;
 };
-vi.mock("next-intl", () => ({ useLocale: () => "en-US", useTranslations: (namespace: string) => namespace === "ChatbotConfig" ? chatbotTranslate : mocks.translate }));
+let modelMessages: Record<string, unknown> = english.ModelConfig;
+const modelTranslate = (key: string, values?: Record<string, string | number>) => {
+  const message = key.startsWith("embeddingAddress") || key.startsWith("embeddingKey") ||
+    key === "separateEmbeddingAddress" || key === "embeddingInheritedAddressIndependentKey"
+    ? modelMessages[key] : mocks.translate(key);
+  let text = typeof message === "string" ? message : key;
+  for (const [name, value] of Object.entries(values ?? {})) text = text.replaceAll(`{${name}}`, String(value));
+  return text;
+};
+vi.mock("next-intl", () => ({ useLocale: () => "en-US", useTranslations: (namespace: string) => namespace === "ChatbotConfig" ? chatbotTranslate : modelTranslate }));
 vi.mock("@/components/features/app-shell", () => ({ useApp: () => ({ refreshCapabilities: mocks.refreshCapabilities }) }));
 vi.mock("@/lib/auth", () => ({ getToken: () => "test-token" }));
 vi.mock("@/lib/api", () => ({ API_BASE: "https://api.invalid", ApiError: class extends Error {}, api: mocks }));
@@ -41,7 +52,7 @@ let failChatbot = false;
 
 beforeEach(() => {
   (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
-  vi.clearAllMocks(); mocks.order = []; failChatbot = false; saved = structuredClone(initial);
+  vi.clearAllMocks(); mocks.order = []; failChatbot = false; saved = structuredClone(initial); modelMessages = english.ModelConfig;
   mocks.getModelConfig.mockResolvedValue(original);
   mocks.getModelProviders.mockResolvedValue([{ id: "openai", default_model: "m", temperature_configurable: true,
     default_temperature: 0.3, can_reuse_embedding_credentials: true }]);
@@ -84,6 +95,223 @@ async function edit(selector: string, value: string) {
 }
 function writes() { return fetcher.mock.calls.filter(([, request]) => request.method === "PUT"); }
 
+function fieldDescription(selector: string) {
+  const input = container.querySelector<HTMLInputElement>(selector)!;
+  const ids = input.getAttribute("aria-describedby")?.split(/\s+/) ?? [];
+  return ids.map(id => document.getElementById(id)?.textContent ?? "").join(" ");
+}
+
+const embeddingConfig: ModelConfig = {
+  ...original, llm_provider: "openai", llm_context_window: 128000, llm_timeout_ms: 60000,
+  llm_max_retries: 2, llm_api_key_set: true, embedding_api_key_set: true,
+  document_parser: "auto", mineru_provider: "302", mineru_base_url: null,
+  mineru_version: "2.5", mineru_official_model: "vlm", mineru_api_key_set: false,
+  effective_document_parser: "markitdown", document_extract_concurrency: 5,
+  document_chunk_max_tokens: 512, document_chunk_mode: "standard",
+  search_strategy: "vector", search_top_k: 5, sag_language: "zh", sources: {},
+};
+const embeddingProviders: ModelProviderSpec[] = [
+  { id: "openai", display_name: "OpenAI-compatible", protocol: "openai", default_model: "m",
+    default_base_url: "https://api.302ai.cn/v1", default_context_window: 128000,
+    default_temperature: 0.3, temperature_configurable: true,
+    can_reuse_embedding_credentials: true, api_key_placeholder: "sk-…" },
+  ...(["anthropic", "gemini"] as const).map(id => ({
+    id, display_name: id, protocol: id, default_model: "native-model",
+    default_base_url: null, default_context_window: 128000, default_temperature: 0.3,
+    temperature_configurable: true, can_reuse_embedding_credentials: false,
+    api_key_placeholder: "native-key",
+  })),
+];
+
+describe("embedding connection hints", () => {
+  beforeEach(() => {
+    mocks.getModelConfig.mockResolvedValue(embeddingConfig);
+    mocks.getModelProviders.mockResolvedValue(embeddingProviders);
+    mocks.saveModelConfig.mockImplementation(async patch => ({ config: { ...embeddingConfig, ...patch } }));
+  });
+
+  it("keeps a cleared address inherited and its saved independent key after save and reload", async () => {
+    const persisted = { ...embeddingConfig, embedding_base_url: null };
+    mocks.saveModelConfig.mockResolvedValue({ config: persisted });
+    await mount();
+    expect(fieldDescription("#e
```

**File**: `apps/web/components/features/model-config-form.tsx` (modified, +58/-1)
```diff
@@ -347,6 +347,49 @@ function BaseModelConfigForm({ saveRef, onState }: ModelSettingsProps = {}) {
   const canReuse302Key =
     (cfg.llm_api_key_set && is302Api(cfg.llm_base_url)) ||
     (cfg.embedding_api_key_set && is302Api(cfg.embedding_base_url));
+  const embeddingUrl = embBaseUrl.trim();
+  const generationUrl = llmBaseUrl.trim();
+  let embeddingAddressPlaceholder: string;
+  if (!providerSpec.can_reuse_embedding_credentials) {
+    embeddingAddressPlaceholder = t("separateEmbeddingAddress");
+  } else if (generationUrl) {
+    embeddingAddressPlaceholder = t("embeddingAddressPlaceholder");
+  } else {
+    embeddingAddressPlaceholder = t("embeddingAddressDefaultPlaceholder");
+  }
+  const inheritsEmbeddingUrl = !embeddingUrl && providerSpec.can_reuse_embedding_credentials;
+  const embeddingAddressChanged =
+    embeddingUrl !== (cfg.embedding_base_url ?? "") ||
+    (!embeddingUrl && (
+      llmProvider !== cfg.llm_provider ||
+      (inheritsEmbeddingUrl && generationUrl !== (cfg.llm_base_url ?? ""))
+    ));
+  const embeddingAddressStatus = t(
+    embeddingAddressChanged ? "embeddingAddressAfterSave" : "embeddingAddressCurrent",
+  );
+  let embeddingAddressDescription: string;
+  if (embeddingUrl) {
+    embeddingAddressDescription = t("embeddingAddressIndependent", { status: embeddingAddressStatus, address: embeddingUrl });
+  } else if (!inheritsEmbeddingUrl) {
+    embeddingAddressDescription = t("embeddingAddressNativeDefault", { status: embeddingAddressStatus });
+  } else if (generationUrl) {
+    embeddingAddressDescription = t("embeddingAddressInherited", { status: embeddingAddressStatus, address: generationUrl });
+  } else {
+    embeddingAddressDescription = t("embeddingAddressDefault", { status: embeddingAddressStatus });
+  }
+  const hasSeparateEmbeddingKey = Boolean(embKey.trim() || cfg.embedding_api_key_set);
+  const hasGenerationKey = Boolean(llmKey.trim() || cfg.llm_api_key_set);
+  let embeddingKeyDescription: string;
+  if (embKey.trim()) {
+    embeddingKeyDescription = t("embeddingKeyNew");
+  } else if (cfg.embedding_api_key_set) {
+    embeddingKeyDescription = t("embeddingKeySaved");
+  } else if (providerSpec.can_reuse_embedding_credentials && hasGenerationKey) {
+    embeddingKeyDescription = t("embeddingKeyInherited");
+  } else {
+    embeddingKeyDescription = t("embeddingKeyRequired");
+  }
+  const showInheritedAddressKeyNote = inheritsEmbeddingUrl && Boolean(generationUrl) && hasSeparateEmbeddingKey;
 
   return (
     <div className="flex flex-col gap-6">
@@ -576,8 +619,18 @@ function BaseModelConfigForm({ saveRef, onState }: ModelSettingsProps = {}) {
                 id="emb-url"
                 value={embBaseUrl}
                 onChange={(event) => setEmbBaseUrl(event.target.value)}
-                placeholder="https://api.302ai.cn/v1"
+                placeholder={embeddingAddressPlaceholder}
+                aria-describedby={showInheritedAddressKeyNote
+                  ? "emb-url-description emb-url-key-note" : "emb-url-description"}
               />
+              <FieldDescription id="emb-url-description" className="break-words [overflow-wrap:anywhere]">
+                {embeddingAddressDescription}
+              </FieldDescription>
+              {showInheritedAddressKeyNote && (
+                <FieldDescription id="emb-url-key-note">
+                  {t("embeddingInheritedAddressIndependentKey")}
+                </FieldDescription>
+              )}
             </Field>
             <Field>
               <FieldLabel htmlFor="emb-key">{t("optionalApiKey")}</FieldLabel>
@@ -587,6 +640,7 @@ function BaseModelConfigForm({ saveRef, onState }: ModelSettingsProps = {}) {
                 autoComplete="off"
                 value={embKey}
                 onChange={(event) => setEmbKey(event.target.value)}
+                aria-describedby="emb-key-description"
                 placeholder={
                   cfg.embedding_api_key_set
                     ? t("keyConfigured")
@@ -595,6 +649,9 @@ function BaseModelConfigForm({ saveRef, onState }: ModelSettingsProps = {}) {
                       : t("separateEmbeddingKey")
                 }
               />
+              <FieldDescription id="emb-key-description">
+                {embeddingKeyDescription}
+              </FieldDescription>
             </Field>
           </div>
         </SettingsRow>
```

**File**: `apps/web/messages/en-US.json` (modified, +15/-1)
```diff
@@ -727,8 +727,22 @@
     "retriesDescription": "Automatic retry attempts after a failed request.",
     "embeddingDescription": "Used for document embeddings and semantic retrieval.",
     "modelAndConnection": "Model and connection",
-    "embeddingConnectionDescription": "Leave the endpoint or key blank to reuse the generation model settings.",
+    "embeddingConnectionDescription": "Configure the URL and key independently. The hints below show which settings will be used.",
     "embeddingNativeConnectionDescription": "Anthropic and Gemini do not share this embedding format. Configure a separate OpenAI-compatible embedding endpoint and key.",
+    "embeddingAddressPlaceholder": "Leave blank to use generation URL",
+    "embeddingAddressDefaultPlaceholder": "Leave blank to use default URL",
+    "separateEmbeddingAddress": "Configure a separate embedding endpoint",
+    "embeddingAddressCurrent": "Currently used",
+    "embeddingAddressAfterSave": "Used after saving",
+    "embeddingAddressIndependent": "{status}: {address} (separate embedding URL).",
+    "embeddingAddressInherited": "{status}: {address} (generation model URL).",
+    "embeddingAddressDefault": "{status}: SDK default URL.",
+    "embeddingAddressNativeDefault": "{status}: SDK default URL. The generation model URL is not inherited; enter your embedding service’s URL.",
+    "embeddingKeyNew": "After saving, the new separate embedding key will be used.",
+    "embeddingKeySaved": "A separate embedding key is already saved. Leave blank to keep it.",
+    "embeddingKeyInherited": "Uses the generation model key.",
+    "embeddingKeyRequired": "No embedding key is configured. Configure a separate key.",
+    "embeddingInheritedAddressIndependentKey": "The generation model URL will be used with the separate embedding key. If your embedding model uses another service, enter that service’s URL.",
     "dimensions": "Vector dimensions (optional)",
     "modelDefault": "Use model default",
     "optionalBaseUrl": "Base URL (optional)",
```

**File**: `apps/web/messages/zh-CN.json` (modified, +15/-1)
```diff
@@ -727,8 +727,22 @@
     "retriesDescription": "请求失败后自动重试的次数。",
     "embeddingDescription": "用于文档向量化和语义检索。",
     "modelAndConnection": "模型与连接",
-    "embeddingConnectionDescription": "端点或密钥留空时复用生成模型配置。",
+    "embeddingConnectionDescription": "地址和密钥分别配置，留空时的使用规则见下方说明。",
     "embeddingNativeConnectionDescription": "Anthropic 和 Gemini 不提供同格式的向量接口，请单独配置 OpenAI-compatible Embedding 端点与密钥。",
+    "embeddingAddressPlaceholder": "留空使用生成模型地址",
+    "embeddingAddressDefaultPlaceholder": "留空使用默认向量服务地址",
+    "separateEmbeddingAddress": "请填写独立的向量服务地址",
+    "embeddingAddressCurrent": "当前使用",
+    "embeddingAddressAfterSave": "保存后使用",
+    "embeddingAddressIndependent": "{status}：{address}（独立向量地址）",
+    "embeddingAddressInherited": "{status}：{address}（来自生成模型地址）",
+    "embeddingAddressDefault": "{status}：SDK 默认地址。",
+    "embeddingAddressNativeDefault": "{status}：SDK 默认地址，不继承生成模型地址。请填写向量服务对应的地址。",
+    "embeddingKeyNew": "保存后将使用新填写的独立向量密钥。",
+    "embeddingKeySaved": "已保存独立向量密钥，留空会保留该密钥。",
+    "embeddingKeyInherited": "使用生成模型密钥。",
+    "embeddingKeyRequired": "尚未配置向量密钥，请填写独立密钥。",
+    "embeddingInheritedAddressIndependentKey": "将使用生成模型地址，仍使用独立向量密钥。如向量模型使用其他服务，请填写对应的服务地址。",
     "dimensions": "向量维度（可选）",
     "modelDefault": "使用模型默认值",
     "optionalBaseUrl": "Base URL（可选）",
```

---

### Incident Patch 6: `b9895bdb` (2026-10-03)
**Commit Message**: feat(api): build document outline from Markdown heading levels (#213)

* feat(api): build document outline from Markdown heading levels

The MCP outline tool and REST /outline listed one flat line per chunk
(rank, nearest heading, chunk_id), so the chapter structure was lost and
long sections repeated the same heading many times.

Read the stored document Markdown, take its # headings in reading order
with their levels (fenced code is skipped), and attach each chunk to its
heading node, matching repeated titles in order. MCP now renders an
indented chapter tree with the chunks of each section; REST rows keep
their order and fields and add level and path. Chunks whose heading is
not found in the Markdown are still listed, and the output falls back to
the previous flat list when no Markdown is stored.

* refactor(api): rename outline match position variable

**File**: `apps/api/sag_api/api/v1/knowledge.py` (modified, +8/-5)
```diff
@@ -16,6 +16,7 @@
     ReadResponse,
 )
 from sag_api.services.document_service import get_public_document, read_document_lines
+from sag_api.services.outline_service import build_outline, outline_rows
 from sag_api.services.source_service import get_source
 
 router = APIRouter(prefix="/sources/{source_id}", tags=["knowledge"])
@@ -29,7 +30,7 @@ async def outline(
     session: AsyncSession = Depends(get_session),
     engine_manager: EngineManager = Depends(get_engine_manager),
 ) -> OutlineOut:
-    """文档大纲：标题 + chunk_id，按阅读顺序排列。"""
+    """文档大纲：标题 + chunk_id，按阅读顺序排列，并附带标题层级与章节路径。"""
     source = await get_source(session, source_id)
     document = await get_public_document(session, source, document_id)
     if not document.sag_source_id:
@@ -41,13 +42,15 @@ async def outline(
     )
     if not rows:
         raise NotFoundError("文档尚无大纲，可能仍在处理中")
+    markdown = await engine_manager.get_document_markdown(
+        source.sag_source_config_id,
+        document.sag_source_id,
+        source=source,
+    )
     return OutlineOut(
         document_id=document.id,
         filename=document.filename,
-        outline=[
-            {"rank": row["rank"], "heading": row["heading"], "chunk_id": row["chunk_id"]}
-            for row in rows
-        ],
+        outline=outline_rows(build_outline(markdown, rows)),
     )
 
 
```

**File**: `apps/api/sag_api/mcp/server.py` (modified, +7/-5)
```diff
@@ -19,6 +19,7 @@
 from mcp.types import ToolAnnotations
 from pydantic import Field
 
+from sag_api.services.outline_service import build_outline, render_outline_text
 from sag_api.services.retrieval_service import retrieve_relevant_sections
 
 if TYPE_CHECKING:
@@ -56,7 +57,7 @@ class MCPToolDetail(TypedDict):
     {
         "name": "outline",
         "label": "文档大纲",
-        "description": "查看指定文档的章节和分块结构，并获取 chunk_id，便于快速定位内容。",
+        "description": "按标题层级查看指定文档的章节树及各章节下的分块，并获取 chunk_id，便于快速定位内容。",
     },
     {
         "name": "grep",
@@ -356,11 +357,12 @@ async def outline(document_id: DocumentId) -> str:
         )
         if not rows:
             return "（尚无大纲：文档可能仍在处理中）"
-        return "\n".join(
-            f"{row['rank']:>3}. {row['heading'] or '（无标题分块）'}"
-            f"（chunk_id={row['chunk_id']}）"
-            for row in rows
+        markdown = await scope.engine_manager.get_document_markdown(
+            source.sag_source_config_id,
+            document.sag_source_id,
+            source=source,
         )
+        return render_outline_text(build_outline(markdown, rows))
 
     @mcp.tool(
         title=MCP_TOOL_LABELS["grep"],
```

**File**: `apps/api/sag_api/schemas/chunk.py` (modified, +5/-1)
```diff
@@ -1,12 +1,16 @@
 from __future__ import annotations
 
-from pydantic import BaseModel
+from pydantic import BaseModel, Field
 
 
 class ChunkOutlineOut(BaseModel):
     rank: int
     heading: str
     chunk_id: str
+    # 分块所属章节的 Markdown 标题层级（1–6）与从顶层到该章节的标题路径；
+    # 无法在正文中定位章节时为 None / 空。
+    level: int | None = None
+    path: list[str] = Field(default_factory=list)
 
 
 class OutlineOut(BaseModel):
```

**File**: `apps/api/sag_api/services/outline_service.py` (added, +145/-0)
```diff
@@ -0,0 +1,145 @@
+"""按 Markdown 标题层级组织文档大纲（PageIndex 式的章节树）。
+
+引擎只为每个分块记录“最近的标题”文本，没有层级；这里从入库时保存的整篇
+Markdown 中按阅读顺序读出 ``#``–``######`` 标题及其层级，再把分块挂到对应的
+标题节点上。标题文本的规范化与引擎分块时一致（去 ``#``、链接只留文字、合并空白），
+因此同名标题也能按出现顺序对上。
+"""
+
+from __future__ import annotations
+
+import re
+from dataclasses import dataclass, field
+from typing import Any
+
+# 与引擎 Markdown 分块器的标题识别保持一致：行首 1–6 个 # 加空白。
+_HEADING = re.compile(r"^(#{1,6})\s+(.+)$")
+_FENCE = re.compile(r"^\s{0,3}(`{3,}|~{3,})")
+_LINK = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
+_UNTITLED = "（无标题分块）"
+
+
+@dataclass(slots=True)
+class OutlineNode:
+    title: str
+    level: int
+    depth: int
+    path: list[str]
+    chunks: list[dict[str, Any]] = field(default_factory=list)
+
+
+def normalize_heading(text: str) -> str:
+    normalized = re.sub(r"^#{1,6}\s*", "", text.strip())
+    normalized = _LINK.sub(r"\1", normalized)
+    return " ".join(normalized.split())
+
+
+def markdown_headings(markdown: str) -> list[tuple[int, str]]:
+    """按阅读顺序返回 ``(level, title)``；围栏代码块中的 ``#`` 行不算标题。"""
+    headings: list[tuple[int, str]] = []
+    fence: str | None = None
+    for line in markdown.splitlines():
+        marker = _FENCE.match(line)
+        if marker:
+            token = marker.group(1)
+            if fence is None:
+                fence = token[0] * len(token)
+            elif token[0] == fence[0] and len(token) >= len(fence):
+                fence = None
+            continue
+        if fence is not None:
+            continue
+        match = _HEADING.match(line)
+        if not match:
+            continue
+        title = normalize_heading(match.group(2))
+        if title:
+            headings.append((len(match.group(1)), title))
+    return headings
+
+
+def build_outline(markdown: str | None, rows: list[dict[str, Any]]) -> list[OutlineNode]:
+    """把分块（按 rank 排序）挂到章节树上，返回按阅读顺序展开的节点列表。
+
+    分块标题在 Markdown 中找不到时（例如来自非 Markdown 解析），归入一个层级为 0
+    的独立节点，保证每个 chunk_id 都出现在大纲中。
+    """
+    headings = markdown_headings(markdown or "")
+    nodes: list[OutlineNode] = []
+    stack: list[OutlineNode] = []
+    for level, title in headings:
+        while stack and stack[-1].level >= level:
+            stack.pop()
+        node = OutlineNode(
+            title=title,
+            level=level,
+            depth=len(stack),
+            path=[*(parent.title for parent in stack), title],
+        )
+        nodes.append(node)
+        stack.append(node)
+
+    position = 0
+    orphans: dict[str, OutlineNode] = {}
+    ordered = list(nodes)
+    for row in sorted(rows, key=lambda item: int(item.get("rank") or 0)):
+        heading = normalize_heading(str(row.get("heading") or ""))
+        target = _match(nodes, heading, position) if heading else None
+        if target is not None:
+            position = target
+            nodes[target].chunks.append(row)
+            continue
+        key = heading or _UNTITLED
+        orphan = orphans.get(key)
+        if orphan is None:
+            orphan = OutlineNode(title=key, level=0, depth=0, path=[key])
+            orphans[key] = orphan
+            ordered.append(orphan)
+        orphan.chunks.append(row)
+    return ordered
+
+
+def _match(nodes: list[OutlineNode], heading: str, position: int) -> int | None:
+    """优先从当前位置向后找（同名章节按出现顺序对应），找不到再回头找。"""
+    for index in range(position, len(nodes)):
+        if nodes[index].title == heading:
+            return index
+    for index in range(0, min(position, len(nodes))):
+        if nodes[index].title == heading:
+            return index
+    return None
+
+
+def render_outline_text(nodes: list[OutlineNode]) -> str:
+    """MCP 文本：按层级缩进，每个章节后列出其分块序号与 chunk_id。"""
+    lines: list[str] = []
+    for node in nodes:
+        indent = "  " * node.depth
+        prefix = f"{'#' * node.level} " if node.level else ""
+        line = f"{indent}{prefix}{node.title}"
+        if node.chunks:
+            refs = "、".join(
+                f"{int(chunk.get('rank') or 0)}（chunk_id={chunk['chunk_id']}）"
+                for chunk in node.chunks
+            )
+            line += f" — 分块 {refs}"
+        lines.append(line)
+    return "\n".join(lines)
+
+
+def outline_rows(nodes: list[OutlineNode]) -> list[dict[str, Any]]:
+    """REST 用的扁平行：保持按 rank 排序，并附带标题层级与章节路径。"""
+    rows: list[dict[str, Any]] = []
+    for node in nodes:
+        for chunk in node.chunks:
+            rows.append(
+                {
+                    "rank": int(chunk.get("rank") or 0),
+                    "heading": chunk.get("heading") or "",
+                    "chunk_id": chunk["chunk_id"],
+                    "level": node.level or None,
+                    "path": node.path if node.level else [],
+                }
+            )
+    rows.sort(key=lambda row: row["rank"])
+    return rows
```

**File**: `apps/api/tests/test_outline.py` (added, +227/-0)
```diff
@@ -0,0 +1,227 @@
+"""文档大纲按 Markdown 标题层级组织（REST `/outline` 与 MCP `outline`）。"""
+
+from __future__ import annotations
+
+import uuid
+
+import httpx
+import pytest
+from mcp.shared.memory import create_connected_server_and_client_session as connect
+
+from sag_api.services.outline_service import (
+    build_outline,
+    markdown_headings,
+    outline_rows,
+    render_outline_text,
+)
+
+MARKDOWN = """# Annual Report
+
+Intro text.
+
+## 1 Introduction
+
+```python
+# not a heading
+```
+
+### 1.1 Background
+
+## 2 [Results](https://example.com)
+
+### Notes
+
+## 3 Appendix
+
+### Notes
+"""
+
+
+def _row(rank: int, heading: str, chunk_id: str | None = None) -> dict:
+    return {"rank": rank, "heading": heading, "chunk_id": chunk_id or f"c{rank}"}
+
+
+def test_markdown_headings_keep_levels_and_skip_code_fences():
+    assert markdown_headings(MARKDOWN) == [
+        (1, "Annual Report"),
+        (2, "1 Introduction"),
+        (3, "1.1 Background"),
+        (2, "2 Results"),
+        (3, "Notes"),
+        (2, "3 Appendix"),
+        (3, "Notes"),
+    ]
+
+
+def test_build_outline_nests_chunks_and_matches_repeated_titles_in_order():
+    rows = [
+        _row(0, "Annual Report"),
+        _row(1, "1 Introduction"),
+        _row(2, "1.1 Background"),
+        _row(3, "1.1 Background"),
+        _row(4, "2 Results"),
+        _row(5, "Notes"),
+        _row(6, "3 Appendix"),
+        _row(7, "Notes"),  # 同名标题：按阅读顺序对应附录下的 “Notes”
+    ]
+
+    nodes = build_outline(MARKDOWN, rows)
+
+    assert [(node.depth, node.level, node.title) for node in nodes] == [
+        (0, 1, "Annual Report"),
+        (1, 2, "1 Introduction"),
+        (2, 3, "1.1 Background"),
+        (1, 2, "2 Results"),
+        (2, 3, "Notes"),
+        (1, 2, "3 Appendix"),
+        (2, 3, "Notes"),
+    ]
+    assert [[chunk["rank"] for chunk in node.chunks] for node in nodes] == [
+        [0],
+        [1],
+        [2, 3],
+        [4],
+        [5],
+        [6],
+        [7],
+    ]
+    assert nodes[6].path == ["Annual Report", "3 Appendix", "Notes"]
+
+
+def test_render_outline_text_is_indented_by_hierarchy():
+    rows = [_row(0, "Annual Report"), _row(1, "1.1 Background"), _row(2, "")]
+
+    text = render_outline_text(build_outline(MARKDOWN, rows))
+
+    assert text.splitlines() == [
+        "# Annual Report — 分块 0（chunk_id=c0）",
+        "  ## 1 Introduction",
+        "    ### 1.1 Background — 分块 1（chunk_id=c1）",
+        "  ## 2 Results",
+        "    ### Notes",
+        "  ## 3 Appendix",
+        "    ### Notes",
+        "（无标题分块） — 分块 2（chunk_id=c2）",
+    ]
+
+
+def test_outline_without_markdown_falls_back_to_flat_chunk_list():
+    rows = [_row(1, "B"), _row(0, "A"), _row(2, "B")]
+
+    nodes = build_outline(None, rows)
+
+    assert render_outline_text(nodes).splitlines() == [
+        "A — 分块 0（chunk_id=c0）",
+        "B — 分块 1（chunk_id=c1）、2（chunk_id=c2）",
+    ]
+    assert outline_rows(nodes) == [
+        {"rank": 0, "heading": "A", "chunk_id": "c0", "level": None, "path": []},
+        {"rank": 1, "heading": "B", "chunk_id": "c1", "level": None, "path": []},
+        {"rank": 2, "heading": "B", "chunk_id": "c2", "level": None, "path": []},
+    ]
+
+
+@pytest.mark.asyncio
+async def test_outline_endpoints_expose_heading_hierarchy():
+    from sqlalchemy import select
+    from zleap.sag.db.models import Article, ArticleParseStatus, DataSource, SourceChunk
+
+    from sag_api.core.db import SessionLocal
+    from sag_api.db.models import Document, Source
+    from sag_api.enums import DocumentStatus
+    from sag_api.main import app
+    from sag_api.mcp.server import build_source_mcp, use_scope
+
+    markdown = "# 报告\n\n## 一、背景\n\n正文\n\n### 1.1 现状\n\n正文\n\n## 二、结论\n\n正文\n"
+    chunks = [("报告", 0), ("一、背景", 1), ("1.1 现状", 2), ("二、结论", 3)]
+
+    transport = httpx.ASGITransport(app=app)
+    async with app.router.lifespan_context(app):
+        async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
+            reg = await c.post(
+                "/api/v1/auth/register", json={"email": "outline@t.com", "password": "password123"}
+            )
+            assert reg.status_code == 201, reg.text
+            headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
+            src = (await c.post("/api/v1/sources", headers=headers, json={"name": "大纲"})).json()
+            doc_id = uuid.uuid4().hex
+            article_id = f"article-{doc_id}"
+            async with SessionLocal() as s:
+                source = await s.get(Source, src["id"])
+                scid = source.sag_source_config_id
+                s.add(
+                    Document(
+                        id=doc_id,
+                        source_id=src["id"],
+                        filename="report.pdf",
+                        content_type="application/pdf",
+                        size_bytes=1,
+                        storage_path="/nonexistent/report.pdf",
+                        status
```

---

### Incident Patch 7: `f80ee6c2` (2026-10-02)
**Commit Message**: fix(api): read active OCTX markdown without engine initialization (#207)

**File**: `apps/api/sag_api/services/document_service.py` (modified, +5/-2)
```diff
@@ -80,13 +80,16 @@ async def read_document_lines(
     source: Source,
     engine_manager: EngineManager,
 ) -> list[str] | None:
-    """返回供按行阅读的文本；文本类读原文件，其余格式读入库时保存的解析 Markdown。
+    """返回供按行阅读的文本；文本类和 OCTX 正文读本地文件，其余格式读入库 Markdown。
 
     PDF / Office 等原文件是二进制，按 UTF-8 逐行读取只会得到乱码，因此改读
     解析后的 Markdown（与 ``/parsed`` 端点同源）。尚未入库时返回 None。
     """
     path = document.storage_path
-    if _is_raw_readable(document) and path and os.path.isfile(path):
+    # OCTX 保存的是受控 Markdown，展示文件名仍可能保留 PDF / Office 扩展名。
+    # OCTX 本地优先仅用于活跃文档，旧安装仍需遵循当前信源的数据库过滤。
+    can_read_local = (bool(document.octx_installation_id) and document.is_active) or _is_raw_readable(document)
+    if can_read_local and path and os.path.isfile(path):
         with open(path, encoding="utf-8", errors="replace") as file:
             return file.readlines()
     if not document.sag_source_id:
```

**File**: `apps/api/tests/test_document_read.py` (modified, +109/-0)
```diff
@@ -1,6 +1,8 @@
 """按行阅读（REST `/read` 与 MCP `read`）：PDF / Office 读解析后的 Markdown，文本类仍读原文件。"""
 
+import asyncio
 import uuid
+from pathlib import Path
 
 import httpx
 import pytest
@@ -142,3 +144,110 @@ async def mcp_read(key: str) -> str:
                 source = await s.get(Source, src["id"])
                 await s.delete(source)
                 await s.commit()
+
+
+@pytest.fixture
+async def octx_read_context(tmp_path):
+    from zleap.sag.db.models import Article, ArticleParseStatus, DataSource
+
+    from sag_api.core.config import Settings
+    from sag_api.db.models import Document, Source
+    from sag_api.enums import DocumentStatus
+    from sag_api.sag import EngineManager
+
+    manager = EngineManager(
+        Settings(
+            _env_file=None,
+            data_dir=str(tmp_path / "engine"),
+            upload_dir=str(tmp_path / "uploads"),
+            sag_relational_provider="sqlite",
+            sag_vector_provider="lancedb",
+            embedding_schema_dimensions=2,
+            embedding_request_dimensions=2,
+        )
+    )
+    busy = Source(id="busy-source", name="处理中", sag_source_config_id="busy-config", config={})
+    source = Source(id="octx-source", name="知识包", sag_source_config_id="octx-config", config={})
+    path = tmp_path / "octx-installation" / "00000000-document.md"
+    path.parent.mkdir()
+    path.write_text("# 知识包正文\n本地连续上下文\n", encoding="utf-8")
+    document = Document(
+        id="octx-document",
+        source_id=source.id,
+        filename="report.pdf",
+        content_type="application/pdf",
+        storage_path=str(path),
+        size_bytes=path.stat().st_size,
+        status=DocumentStatus.READY,
+        sag_source_id="octx-article",
+        octx_installation_id="installation",
+        is_active=True,
+    )
+    try:
+        # Seed the shared store through another source, keeping the OCTX engine cold.
+        session_factory = await manager.get_sag_session_factory(busy.sag_source_config_id, busy)
+        async with session_factory() as session:
+            session.add(DataSource(id=source.sag_source_config_id, name=source.name))
+            await session.flush()
+            session.add(
+                Article(
+                    id=document.sag_source_id,
+                    data_source_id=source.sag_source_config_id,
+                    document_id=document.id,
+                    title=document.filename,
+                    content="# 数据库正文\n回退内容\n",
+                    status="COMPLETED",
+                    parse_status=ArticleParseStatus.COMPLETED,
+                )
+            )
+            await session.commit()
+        yield manager, busy, source, document
+    finally:
+        await manager.aclose_all()
+
+
+@pytest.mark.asyncio
+@pytest.mark.parametrize(
+    ("filename", "content_type"),
+    [
+        ("report.pdf", "application/pdf"),
+        ("notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
+    ],
+)
+async def test_octx_read_does_not_wait_for_other_source_processing(octx_read_context, filename, content_type):
+    from sag_api.services.document_service import read_document_lines
+
+    manager, busy, source, document = octx_read_context
+    document.filename = filename
+    document.content_type = content_type
+    assert source.sag_source_config_id not in manager._slots
+
+    # Real processing holds the lifecycle read gate; cold engine creation needs its write gate.
+    async with manager.use_concurrently(busy.sag_source_config_id, busy):
+        lines = await asyncio.wait_for(read_document_lines(document, source, manager), timeout=2)
+        assert lines == ["# 知识包正文\n", "本地连续上下文\n"]
+        assert source.sag_source_config_id not in manager._slots
+
+
+@pytest.mark.asyncio
+async def test_octx_read_falls_back_to_stored_markdown_when_local_file_is_missing(octx_read_context):
+    from sag_api.services.document_service import read_document_lines
+
+    manager, _busy, source, document = octx_read_context
+    Path(document.storage_path).unlink()
+
+    assert await read_document_lines(document, source, manager) == ["# 数据库正文\n", "回退内容\n"]
+    document.sag_source_id = "missing-article"
+    assert await read_document_lines(document, source, manager) is None
+
+
+@pytest.mark.asyncio
+async def test_octx_read_does_not_reopen_retained_document_from_previous_installation(octx_read_context):
+    from sag_api.services.document_service import read_document_lines
+
+    manager, _busy, source, document = octx_read_context
+    # An OCTX upgrade keeps the old local file while moving the source to a new partition.
+    document.is_active = False
+    source.sag_source_config_id = "replacement-config"
+
+    assert await read_document_lines(document, source, manager) is None
```

---

### Incident Patch 8: `ce8e9850` (2026-10-02)
**Commit Message**: fix(api): read parsed markdown for binary documents in MCP/REST read (#205)

The MCP `read` tool and `GET /sources/{id}/documents/{id}/read` opened
the raw uploaded file as UTF-8, so PDF/Office documents returned binary
noise (`%PDF-1.4`, `PK\x03\x04`...) even after parsing had finished.

Add a shared `read_document_lines` helper: text-like files (txt/md/csv/
json/...) are still read from the original file as before; other
formats read the stored parsed Markdown via the engine (same source as
`/documents/{id}/parsed`). When no readable text exists yet, both paths
return a clear message instead of garbage.

**File**: `apps/api/sag_api/api/v1/knowledge.py` (modified, +6/-8)
```diff
@@ -1,7 +1,5 @@
 from __future__ import annotations
 
-import os
-
 from fastapi import APIRouter, Depends, Query
 from sqlalchemy.ext.asyncio import AsyncSession
 
@@ -17,7 +15,7 @@
     OutlineOut,
     ReadResponse,
 )
-from sag_api.services.document_service import get_public_document
+from sag_api.services.document_service import get_public_document, read_document_lines
 from sag_api.services.source_service import get_source
 
 router = APIRouter(prefix="/sources/{source_id}", tags=["knowledge"])
@@ -89,17 +87,17 @@ async def read(
     limit: int = Query(default=120, ge=1, le=500),
     _user: User = Depends(get_current_user),
     session: AsyncSession = Depends(get_session),
+    engine_manager: EngineManager = Depends(get_engine_manager),
 ) -> ReadResponse:
-    """按行分页读取原始文件。"""
+    """按行分页读取文档文本：文本类读原文件，PDF / Office 等读解析后的 Markdown。"""
     source = await get_source(session, source_id)
     document = await get_public_document(session, source, document_id)
-    if not document.storage_path or not os.path.isfile(document.storage_path):
-        raise NotFoundError("原始文件不存在或已清理")
     try:
-        with open(document.storage_path, encoding="utf-8", errors="replace") as f:
-            all_lines = f.readlines()
+        all_lines = await read_document_lines(document, source, engine_manager)
     except OSError as exc:
         raise NotFoundError("文件读取失败") from exc
+    if all_lines is None:
+        raise NotFoundError("文档尚无可读文本，可能仍在处理中或原始文件已清理")
     total = len(all_lines)
     start = max(0, offset - 1)
     page = all_lines[start : start + limit]
```

**File**: `apps/api/sag_api/mcp/server.py` (modified, +5/-6)
```diff
@@ -66,7 +66,7 @@ class MCPToolDetail(TypedDict):
     {
         "name": "read",
         "label": "按行读原文",
-        "description": "按行分页读取指定文档的原始文本，适合查看连续上下文。",
+        "description": "按行分页读取指定文档的文本（PDF、Office 等读取解析后的 Markdown），适合查看连续上下文。",
     },
     {
         "name": "get_chunk",
@@ -438,15 +438,14 @@ async def read(
         if match is None:
             return "（未找到该文档）"
         document, source = match
-        import os
+        from sag_api.services.document_service import read_document_lines
 
-        if not document.storage_path or not os.path.isfile(document.storage_path):
-            return "（原始文件不存在或已清理）"
         try:
-            with open(document.storage_path, encoding="utf-8", errors="replace") as file:
-                lines = file.readlines()
+            lines = await read_document_lines(document, source, scope.engine_manager)
         except OSError:
             return "（文件读取失败）"
+        if lines is None:
+            return "（尚无可读文本：文档可能仍在处理中，或原始文件已清理）"
         start = max(0, offset - 1)
         page = lines[start : start + max(1, min(limit, 500))]
         if not page:
```

**File**: `apps/api/sag_api/services/document_service.py` (modified, +37/-0)
```diff
@@ -4,6 +4,7 @@
 
 import os
 from datetime import UTC, datetime
+from typing import TYPE_CHECKING
 
 from sqlalchemy import case, func, select, update
 from sqlalchemy.ext.asyncio import AsyncSession
@@ -14,9 +15,16 @@
 from sag_api.enums import DocumentStatus, JobStatus, JobType
 from sag_api.jobs import JobQueue
 from sag_api.jobs.scheduling import DELETE_PRIORITY, RESUME_PRIORITY, set_scheduler
+from sag_api.parsing.text import is_text_preview
 from sag_api.sag.document_vector_identity import refresh_source_vector_identity
 from sag_api.services.source_operation_service import touch_source_revision
 
+if TYPE_CHECKING:
+    from sag_api.sag import EngineManager
+
+# 按行阅读时可直接读原文件的格式；其余格式（PDF / Office 等）原文件是二进制。
+_RAW_READABLE_SUFFIXES = {".md", ".markdown"}
+
 
 async def _enqueue_persisted_job(job_queue: JobQueue, job_id: str) -> None:
     """Dispatch a committed job with queue-level retry supervision when available."""
@@ -62,6 +70,35 @@ async def get_public_document(
     return document
 
 
+def _is_raw_readable(document: Document) -> bool:
+    suffix = os.path.splitext(document.filename)[1].lower()
+    return suffix in _RAW_READABLE_SUFFIXES or is_text_preview(document.filename, document.content_type)
+
+
+async def read_document_lines(
+    document: Document,
+    source: Source,
+    engine_manager: EngineManager,
+) -> list[str] | None:
+    """返回供按行阅读的文本；文本类读原文件，其余格式读入库时保存的解析 Markdown。
+
+    PDF / Office 等原文件是二进制，按 UTF-8 逐行读取只会得到乱码，因此改读
+    解析后的 Markdown（与 ``/parsed`` 端点同源）。尚未入库时返回 None。
+    """
+    path = document.storage_path
+    if _is_raw_readable(document) and path and os.path.isfile(path):
+        with open(path, encoding="utf-8", errors="replace") as file:
+            return file.readlines()
+    if not document.sag_source_id:
+        return None
+    markdown = await engine_manager.get_document_markdown(
+        source.sag_source_config_id,
+        document.sag_source_id,
+        source=source,
+    )
+    return markdown.splitlines(keepends=True) if markdown else None
+
+
 async def create_document_from_upload(
     session: AsyncSession,
     source: Source,
```

**File**: `apps/api/tests/test_document_read.py` (added, +144/-0)
```diff
@@ -0,0 +1,144 @@
+"""按行阅读（REST `/read` 与 MCP `read`）：PDF / Office 读解析后的 Markdown，文本类仍读原文件。"""
+
+import uuid
+
+import httpx
+import pytest
+from mcp.shared.memory import create_connected_server_and_client_session as connect
+
+from tests.test_document_parsing import _simple_docx, _simple_pdf
+
+
+@pytest.mark.asyncio
+async def test_read_returns_parsed_markdown_for_binary_documents(tmp_path):
+    from sqlalchemy import select
+    from zleap.sag.db.models import Article, ArticleParseStatus, DataSource
+
+    from sag_api.core.db import SessionLocal
+    from sag_api.db.models import Document, Source
+    from sag_api.enums import DocumentStatus
+    from sag_api.main import app
+    from sag_api.mcp.server import build_source_mcp, use_scope
+
+    pdf = tmp_path / "report.pdf"
+    pdf.write_bytes(_simple_pdf("Raw PDF layer"))
+    docx = tmp_path / "notes.docx"
+    _simple_docx(docx, "Raw DOCX body")
+    txt = tmp_path / "plain.txt"
+    txt.write_text("原文第一行\n原文第二行\n", encoding="utf-8")
+    pending_pdf = tmp_path / "pending.pdf"
+    pending_pdf.write_bytes(_simple_pdf("Not ingested yet"))
+
+    # (文件名, content_type, 原文件, 入库 Markdown；None 表示尚未入库)
+    cases = {
+        "pdf": ("report.pdf", "application/pdf", pdf, "# 报告\n\nPDF 解析正文\n"),
+        "docx": (
+            "notes.docx",
+            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
+            docx,
+            "DOCX 解析正文\n",
+        ),
+        "txt": ("plain.txt", "text/plain", txt, "规范化后的文本\n"),
+        "pending": ("pending.pdf", "application/pdf", pending_pdf, None),
+    }
+
+    transport = httpx.ASGITransport(app=app)
+    async with app.router.lifespan_context(app):
+        async with httpx.AsyncClient(transport=transport, base_url="http://t") as c:
+            reg = await c.post("/api/v1/auth/register", json={"email": "reader@t.com", "password": "password123"})
+            assert reg.status_code == 201, reg.text
+            headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}
+            src = (await c.post("/api/v1/sources", headers=headers, json={"name": "阅读"})).json()
+
+            doc_ids: dict[str, str] = {}
+            async with SessionLocal() as s:
+                source = await s.get(Source, src["id"])
+                scid = source.sag_source_config_id
+                for key, (filename, content_type, path, markdown) in cases.items():
+                    doc_ids[key] = uuid.uuid4().hex
+                    s.add(
+                        Document(
+                            id=doc_ids[key],
+                            source_id=src["id"],
+                            filename=filename,
+                            content_type=content_type,
+                            size_bytes=path.stat().st_size,
+                            storage_path=str(path),
+                            status=DocumentStatus.READY if markdown else DocumentStatus.PENDING,
+                            sag_source_id=f"article-{key}" if markdown else None,
+                        )
+                    )
+                await s.commit()
+                sources = tuple((await s.execute(select(Source).where(Source.id == src["id"]))).scalars())
+
+            sf = await app.state.engine_manager.get_sag_session_factory(scid)
+            async with sf() as s:
+                await s.merge(DataSource(id=scid, name="阅读"))
+                for key, (filename, _content_type, _path, markdown) in cases.items():
+                    if markdown is None:
+                        continue
+                    s.add(
+                        Article(
+                            id=f"article-{key}",
+                            data_source_id=scid,
+                            document_id=doc_ids[key],
+                            title=filename,
+                            content=markdown,
+                            status="COMPLETED",
+                            parse_status=ArticleParseStatus.COMPLETED,
+                        )
+                    )
+                await s.commit()
+
+            async def rest_read(key: str) -> httpx.Response:
+                return await c.get(f"/api/v1/sources/{src['id']}/documents/{doc_ids[key]}/read", headers=headers)
+
+            pdf_resp = await rest_read("pdf")
+            assert pdf_resp.status_code == 200, pdf_resp.text
+            assert pdf_resp.json()["lines"] == ["# 报告\n", "\n", "PDF 解析正文\n"]
+            assert pdf_resp.json()["total_lines"] == 3
+
+            docx_resp = await rest_read("docx")
+            assert docx_resp.status_code == 200, docx_resp.text
+            assert docx_resp.json()["lines"] == ["DOCX 解析正文\n"]
+
+            # 文本类保持原行为：读原文件而不是入库 Markdown。
+            txt_resp = await rest_read("txt")
+            assert txt_resp.status_code == 200, txt_resp.text
+            assert txt_resp.json()["lines"] == ["原文第一行\n", "原文第二行\n"]
+
+            pending_resp = await rest_read("pending")
+            assert pending_re
```

---

### Incident Patch 9: `863c15c4` (2026-09-26)
**Commit Message**: fix(desktop): coordinate runtime recovery and graceful shutdown

**File**: `apps/api/sag_api/desktop.py` (modified, +24/-0)
```diff
@@ -24,6 +24,30 @@ def main() -> None:
     # bootstrap arguments before Uvicorn starts, otherwise an OCTX worker would
     # launch a second API server and collide with the desktop sidecar port.
     multiprocessing.freeze_support()
+    control_token = os.environ.pop("SAG_DESKTOP_CONTROL_TOKEN", None)
+    if control_token:
+        from sag_api.desktop_control import DesktopControl, has_background_work
+        from sag_api.desktop_process import contain_windows_children
+
+        contain_windows_children()
+        from sag_api.main import app
+
+        def shutdown() -> None:
+            server.should_exit = True
+
+        controlled_app = DesktopControl(app, control_token, lambda: has_background_work(app), shutdown)
+        server = uvicorn.Server(
+            uvicorn.Config(
+                controlled_app,
+                host=os.getenv("SAG_DESKTOP_HOST", "127.0.0.1"),
+                port=_port(),
+                log_level="info",
+                access_log=False,
+                timeout_graceful_shutdown=5,
+            )
+        )
+        server.run()
+        return
     uvicorn.run(
         "sag_api.main:app",
         host=os.getenv("SAG_DESKTOP_HOST", "127.0.0.1"),
```

**File**: `apps/api/sag_api/desktop_control.py` (added, +101/-0)
```diff
@@ -0,0 +1,101 @@
+"""Private desktop lifecycle control; never installed by the Web API entry point."""
+
+from __future__ import annotations
+
+from collections.abc import Awaitable, Callable
+from ipaddress import ip_address
+from secrets import compare_digest
+
+from starlette.requests import Request
+from starlette.responses import JSONResponse
+from starlette.types import ASGIApp, Receive, Scope, Send
+
+
+class DesktopControl:
+    def __init__(
+        self, app: ASGIApp, token: str, activity: Callable[[], Awaitable[bool]], shutdown: Callable[[], None]
+    ) -> None:
+        self.app = app
+        self.token = token
+        self.activity = activity
+        self.shutdown = shutdown
+        self.active_requests = 0
+
+    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
+        path = scope.get("path", "")
+        if scope["type"] == "http" and path.startswith("/_desktop/"):
+            request = Request(scope, receive)
+            try:
+                local = request.client is not None and ip_address(request.client.host).is_loopback
+            except ValueError:
+                local = False
+            supplied = request.headers.get("x-sag-desktop-token", "")
+            if not local or not compare_digest(supplied.encode(), self.token.encode()):
+                await JSONResponse({"error": "Forbidden"}, status_code=403)(scope, receive, send)
+                return
+            if request.method != "POST" or path not in {"/_desktop/activity", "/_desktop/shutdown"}:
+                await JSONResponse({"error": "Not found"}, status_code=404)(scope, receive, send)
+                return
+            if path == "/_desktop/shutdown":
+                await JSONResponse({"stopping": True})(scope, receive, send)
+                self.shutdown()
+                return
+            try:
+                active = self.active_requests > 0 or await self.activity()
+            except Exception:  # Inspection failure must never be mistaken for idle.
+                await JSONResponse({"error": "Activity unavailable"}, status_code=503)(scope, receive, send)
+                return
+            await JSONResponse({"active": active})(scope, receive, send)
+            return
+
+        tracked = scope["type"] in {"http", "websocket"} and path not in {
+            "/api/v1/system/health",
+            "/api/v1/system/ready",
+        }
+        if tracked:
+            self.active_requests += 1
+        try:
+            await self.app(scope, receive, send)
+        finally:
+            if tracked:
+                self.active_requests -= 1
+
+
+async def has_background_work(app) -> bool:
+    """Include queued jobs and transfers, not just currently executing workers."""
+    from sqlalchemy import select
+
+    from sag_api.core.db import SessionLocal
+    from sag_api.db.models import Document, Job
+    from sag_api.db.models.octx import OctxTransfer
+    from sag_api.enums import DocumentStatus, JobStatus, OctxTransferStatus
+
+    bootstrap = getattr(app.state, "storage_bootstrap", None)
+    if bootstrap is not None and bootstrap.public_status().get("phase") == "processing":
+        return True
+    async with SessionLocal() as session:
+        job = await session.scalar(select(Job.id).where(Job.status.in_([JobStatus.QUEUED, JobStatus.RUNNING])).limit(1))
+        if job is not None:
+            return True
+        # A paused job can still be draining its in-flight document chunks.
+        pausing = await session.scalar(select(Document.id).where(Document.status == DocumentStatus.PAUSING).limit(1))
+        if pausing is not None:
+            return True
+        transfer = await session.scalar(
+            select(OctxTransfer.id)
+            .where(
+                OctxTransfer.status.in_(
+                    [
+                        OctxTransferStatus.VALIDATING,
+                        OctxTransferStatus.QUEUED,
+                        OctxTransferStatus.IMPORTING,
+                        OctxTransferStatus.INDEXING,
+                        OctxTransferStatus.SWITCHING,
+                        OctxTransferStatus.EXPORTING,
+                        OctxTransferStatus.PACKAGING,
+                    ]
+                )
+            )
+            .limit(1)
+        )
+        return transfer is not None
```

**File**: `apps/api/sag_api/desktop_process.py` (added, +83/-0)
```diff
@@ -0,0 +1,83 @@
+"""Windows ownership of desktop API workers, including after an API crash."""
+
+from __future__ import annotations
+
+import os
+
+# Retain the non-inheritable handle until OS process teardown. Closing it early
+# would also terminate this process before Uvicorn finishes its lifespan hooks.
+_job_handle: int | None = None
+
+
+def contain_windows_children() -> None:
+    global _job_handle
+    if os.name != "nt" or _job_handle is not None:
+        return
+
+    import ctypes
+    from ctypes import wintypes
+
+    class BasicLimits(ctypes.Structure):
+        _fields_ = [
+            ("PerProcessUserTimeLimit", ctypes.c_int64),
+            ("PerJobUserTimeLimit", ctypes.c_int64),
+            ("LimitFlags", wintypes.DWORD),
+            ("MinimumWorkingSetSize", ctypes.c_size_t),
+            ("MaximumWorkingSetSize", ctypes.c_size_t),
+            ("ActiveProcessLimit", wintypes.DWORD),
+            ("Affinity", ctypes.c_size_t),
+            ("PriorityClass", wintypes.DWORD),
+            ("SchedulingClass", wintypes.DWORD),
+        ]
+
+    class IoCounters(ctypes.Structure):
+        _fields_ = [
+            (name, ctypes.c_uint64)
+            for name in (
+                "ReadOperationCount",
+                "WriteOperationCount",
+                "OtherOperationCount",
+                "ReadTransferCount",
+                "WriteTransferCount",
+                "OtherTransferCount",
+            )
+        ]
+
+    class ExtendedLimits(ctypes.Structure):
+        _fields_ = [
+            ("BasicLimitInformation", BasicLimits),
+            ("IoInfo", IoCounters),
+            ("ProcessMemoryLimit", ctypes.c_size_t),
+            ("JobMemoryLimit", ctypes.c_size_t),
+            ("PeakProcessMemoryUsed", ctypes.c_size_t),
+            ("PeakJobMemoryUsed", ctypes.c_size_t),
+        ]
+
+    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
+    kernel.CreateJobObjectW.argtypes = [ctypes.c_void_p, wintypes.LPCWSTR]
+    kernel.CreateJobObjectW.restype = wintypes.HANDLE
+    kernel.SetInformationJobObject.argtypes = [wintypes.HANDLE, ctypes.c_int, ctypes.c_void_p, wintypes.DWORD]
+    kernel.SetInformationJobObject.restype = wintypes.BOOL
+    kernel.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
+    kernel.AssignProcessToJobObject.restype = wintypes.BOOL
+    kernel.GetCurrentProcess.argtypes = []
+    kernel.GetCurrentProcess.restype = wintypes.HANDLE
+    kernel.CloseHandle.argtypes = [wintypes.HANDLE]
+    kernel.CloseHandle.restype = wintypes.BOOL
+
+    handle = kernel.CreateJobObjectW(None, None)
+    if not handle:
+        raise ctypes.WinError(ctypes.get_last_error())
+    limits = ExtendedLimits()
+    limits.BasicLimitInformation.LimitFlags = 0x2000  # JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
+    try:
+        if not kernel.SetInformationJobObject(handle, 9, ctypes.byref(limits), ctypes.sizeof(limits)):
+            raise ctypes.WinError(ctypes.get_last_error())
+        # Run before importing the app: every subsequently spawned worker joins
+        # this job. Windows 8+ permits nesting within a runner/launcher job.
+        if not kernel.AssignProcessToJobObject(handle, kernel.GetCurrentProcess()):
+            raise ctypes.WinError(ctypes.get_last_error())
+    except BaseException:
+        kernel.CloseHandle(handle)
+        raise
+    _job_handle = handle
```

**File**: `apps/desktop/README.md` (modified, +10/-0)
```diff
@@ -188,6 +188,16 @@ macOS 签名凭据只注入 electron-builder 的最终签名与公证步骤，
 
 应用更新不会覆盖此目录；Windows 卸载器也配置为默认保留用户数据。
 
+### 本地服务生命周期
+
+桌面主进程管理一组 Web/API 服务，启动、停止和重试互斥。启动中退出会取消健康探测并等待清理；任一服务异常退出时，先清理同组服务，再显示“退出 / 重试”。重试沿用已保存的 Web 端口，保留同一浏览器 origin 下的登录和本地设置；不会自动反复重启服务或替用户重跑任务。
+
+退出或“重启并安装”前，会检查在途请求、排队/执行中的文档任务、OCTX 导入导出及存储重建。有未完成任务或暂时无法确认状态时，默认取消，用户可以明确选择中断。Windows 关闭主窗口也经过此检查；macOS 关闭窗口仍按原行为保留后台运行。开发模式的 Web/API 由开发启动脚本管理。
+
+打包 API 在原监听端口额外挂载私有控制入口，仅接受 loopback 与每次启动随机令牌；普通 Web 部署不挂载该入口，令牌不发送给渲染页面或继承给 worker。退出先请求 Uvicorn 执行现有 lifespan 清理，最多等待 20 秒，再强制结束进程树；Web 最多等待 5 秒。macOS 使用独立 API 进程组清理残留 worker，Windows 使用不继承句柄的 Job Object 将 worker 绑定到 API 生命周期。清理失败时阻止启动替代服务；更新安装器仅在清理完成后启动，安装失败会恢复本地服务。
+
+完整安装包需在两平台验证启动中退出、带任务退出、崩溃重试、后台进程回收、手动安装更新和用户数据保留。
+
 ## 更新约束
 
 桌面版采用整包版本和整包更新：Electron、Next.js、Python API 及其原生依赖使用同一个 `apps/desktop/package.json` 版本发布。不要分别更新 Web 或 Python sidecar，否则无法保证接口和数据迁移兼容。
```

**File**: `apps/desktop/src/exit-controller.ts` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+export type ExitReason = "quit" | "update";
+
+/** Serializes exit decisions so a quit confirmation cannot authorize an update. */
+export class ExitController {
+  private pending = false;
+  private readonly inspect: () => Promise<boolean>;
+  private readonly confirm: (reason: ExitReason, active: boolean | null) => Promise<boolean>;
+  private readonly stop: () => Promise<void>;
+
+  constructor(
+    inspect: () => Promise<boolean>,
+    confirm: (reason: ExitReason, active: boolean | null) => Promise<boolean>,
+    stop: () => Promise<void>,
+  ) {
+    this.inspect = inspect;
+    this.confirm = confirm;
+    this.stop = stop;
+  }
+
+  async prepare(reason: ExitReason): Promise<boolean> {
+    if (this.pending) return false;
+    this.pending = true;
+    try {
+      const active = await this.inspect().catch(() => null);
+      if (active !== false && !await this.confirm(reason, active)) return false;
+      await this.stop();
+      return true;
+    } finally { this.pending = false; }
+  }
+}
```

**File**: `apps/desktop/src/main.ts` (modified, +115/-23)
```diff
@@ -4,8 +4,10 @@ import path from "node:path";
 
 import {
   app,
+  autoUpdater as nativeUpdater,
   BrowserWindow,
   ipcMain,
+  dialog,
   shell,
   type IpcMainInvokeEvent,
 } from "electron";
@@ -18,13 +20,45 @@ import {
   type ManagedRuntime,
 } from "./runtime";
 import { createUpdaterController, type UpdaterController } from "./updater";
+import { RuntimeController } from "./runtime-controller";
+import { ExitController } from "./exit-controller";
 
 let mainWindow: BrowserWindow | null = null;
 let splashWindow: BrowserWindow | null = null;
-let runtime: ManagedRuntime | null = null;
 let updater: UpdaterController | null = null;
 let trustedOrigin = "";
 let quitting = false;
+let quitAllowed = false;
+let updateQuitRequested = false;
+let booting: Promise<void> | undefined;
+let failureDialog: Promise<void> | undefined;
+
+const runtime = new RuntimeController<ManagedRuntime>(
+  (signal) => app.isPackaged
+    ? startPackagedRuntime(signal)
+    : waitForDevelopmentRuntime(process.env.SAG_DESKTOP_DEV_WEB_URL || "http://127.0.0.1:3000", signal),
+  (state) => {
+    log.info("Desktop runtime", state);
+    if (state.phase === "error" && !quitting) void presentRuntimeFailure(state.message);
+  },
+);
+const exitController = new ExitController(
+  async () => runtime.session ? runtime.session.inspectActivity() : false,
+  async (reason, active) => {
+    const action = reason === "update" ? "重启并安装" : "退出";
+    const result = await dialog.showMessageBox({
+      type: "warning", title: "SAG", message: active === null
+        ? "暂时无法确认后台任务状态" : "仍有正在处理或排队的任务",
+      detail: `${action}会中断未完成的处理。你可以取消并等待任务完成后再试。`,
+      buttons: ["取消", `仍然${action}`], defaultId: 0, cancelId: 0,
+    });
+    return result.response === 1;
+  },
+  async () => {
+    quitting = true;
+    try { await runtime.stop(); } catch (error) { quitting = false; throw error; }
+  },
+);
 
 if (!app.isPackaged) {
   app.setPath("userData", path.join(app.getPath("appData"), "SAG Development"));
@@ -251,27 +285,72 @@ function createMainWindow(webUrl: string): BrowserWindow {
     splashWindow = null;
     window.show();
   });
+  window.on("close", (event) => {
+    if (process.platform !== "darwin" && !quitAllowed) {
+      event.preventDefault();
+      app.quit();
+    }
+  });
   window.on("closed", () => {
     mainWindow = null;
   });
   void window.loadURL(webUrl);
   return window;
 }
 
-async function bootstrap(): Promise<void> {
-  splashWindow = createSplashWindow();
-  const devWebUrl =
-    process.env.SAG_DESKTOP_DEV_WEB_URL || "http://127.0.0.1:3000";
-  try {
-    runtime = app.isPackaged
-      ? await startPackagedRuntime()
-      : await waitForDevelopmentRuntime(devWebUrl);
-    mainWindow = createMainWindow(runtime.webUrl);
-    updater = createUpdaterController(() => mainWindow);
-    registerIpc();
-  } catch (error) {
-    showStartupError(error);
-  }
+function bootstrap(): Promise<void> {
+  if (booting) return booting;
+  if (quitting) return Promise.resolve();
+  if (!splashWindow || splashWindow.isDestroyed()) splashWindow = createSplashWindow();
+  booting = (async () => {
+    try {
+      const session = await runtime.start();
+      if (quitting || runtime.state.phase !== "ready") return;
+      if (mainWindow && !mainWindow.isDestroyed()) {
+        trustedOrigin = new URL(session.webUrl).origin;
+        await mainWindow.loadURL(session.webUrl);
+        splashWindow?.close(); splashWindow = null;
+        mainWindow.show();
+      } else mainWindow = createMainWindow(session.webUrl);
+      if (!updater) updater = createUpdaterController(() => mainWindow, {
+        beforeInstall: async () => {
+          const prepared = await exitController.prepare("update");
+          if (prepared) quitAllowed = true;
+          return prepared;
+        },
+        onInstallError: () => {
+          if (!quitAllowed && !quitting) return;
+          quitAllowed = false; quitting = false;
+          void bootstrap();
+        },
+      });
+      registerIpc();
+    } catch (error) {
+      if (!quitting) {
+        showStartupError(error);
+        void presentRuntimeFailure(error instanceof Error ? error.message : String(error));
+      }
+    }
+  })().finally(() => { booting = undefined; });
+  return booting;
+}
+
+function presentRuntimeFailure(message: string): Promise<void> {
+  if (failureDialog) return failureDialog;
+  failureDialog = (async () => {
+    await booting;
+    if (quitting) { failureDialog = undefined; return; }
+    const result = await dialog.showMessageBox({
+      type: "error", title: "SAG 本地服务不可用", message: "本地服务启动失败或意外停止",
+      detail: `${message}\n请检查日志；重试会重新启动本地服务，未完成的任务需在恢复后确认。`,
+      buttons: ["退出", "重试"], defaultId: 1, cancelId: 0,
+    });
+    failureDialog = undefined;
+    if (quitting) return;
+    if (result.response === 1) void bootstrap();
+    else app.quit();
+  })().catch((error) => { failureDialog = undefined; log.error("Failed to present runtime failur
```

**File**: `apps/desktop/src/managed-process.ts` (added, +105/-0)
```diff
@@ -0,0 +1,105 @@
+import type { EventEmitter } from "node:events";
+import { execFile } from "node:child_process";
+import { promisify } from "node:util";
+import { setTimeout as delay } from "node:timers/promises";
+
+interface ProcessOptions {
+  name: string;
+  hasPid(): boolean;
+  requestStop(): void | Promise<void>;
+  forceStop(): void | Promise<void>;
+  afterExit?(): void | Promise<void>;
+  graceMs?: number;
+  forceMs?: number;
+}
+
+/** Only pass a group ID for a process launched with detached: true. */
+export async function terminateProcessTree(pid: number, processGroup: boolean): Promise<void> {
+  if (process.platform === "win32") {
+    await promisify(execFile)("taskkill", ["/pid", String(pid), "/t", "/f"], { windowsHide: true, timeout: 5_000 });
+  } else {
+    try { process.kill(processGroup ? -pid : pid, "SIGKILL"); } catch (error) {
+      if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
+    }
+  }
+}
+
+async function completedWithin(promise: Promise<void>, milliseconds: number): Promise<boolean> {
+  let timer: NodeJS.Timeout | undefined;
+  try {
+    return await Promise.race([
+      promise.then(() => true),
+      new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), milliseconds); }),
+    ]);
+  } finally { clearTimeout(timer); }
+}
+
+/** Exit observation is installed immediately, before any asynchronous startup work. */
+export function manageProcess(child: EventEmitter, options: ProcessOptions) {
+  let exited = false;
+  let markExited!: () => void;
+  let fail!: (error: Error) => void;
+  const exit = new Promise<void>((resolve) => { markExited = resolve; });
+  const failure = new Promise<Error>((resolve) => { fail = resolve; });
+  child.once("exit", (code: number | null, signal?: string) => {
+    exited = true;
+    markExited();
+    fail(new Error(`${options.name} 服务已退出 (${signal ?? code ?? "unknown"})`));
+  });
+  child.on("error", (error: unknown) => {
+    fail(new Error(`${options.name} 服务异常: ${error instanceof Error ? error.message : String(error)}`));
+    // Node spawn failures have no exit event; Electron fatal errors do.
+    if (!options.hasPid()) { exited = true; markExited(); }
+  });
+  let stopping: Promise<void> | undefined;
+  return {
+    failure,
+    stop(): Promise<void> {
+      if (stopping) return stopping;
+      stopping = (async () => {
+        if (exited) { await options.afterExit?.(); return; }
+        const requested = Promise.resolve().then(options.requestStop);
+        // Failed graceful requests fall back to termination, without an unhandled rejection.
+        const graceful = Promise.race([exit.then(() => true), requested.then(() => exit.then(() => true), () => false)]);
+        let timer: NodeJS.Timeout | undefined;
+        let finished: boolean;
+        try {
+          finished = await Promise.race([graceful, new Promise<false>((resolve) => {
+            timer = setTimeout(() => resolve(false), options.graceMs ?? 20_000);
+          })]);
+        } finally { clearTimeout(timer); }
+        if (!finished && !exited) {
+          try { await options.forceStop(); } catch (error) {
+            // taskkill can lose a race with normal Windows process exit.
+            if (!await completedWithin(exit, options.forceMs ?? 5_000)) throw error;
+          }
+          if (!await completedWithin(exit, options.forceMs ?? 5_000)) {
+            throw new Error(`${options.name} 服务未能退出，请关闭 SAG 后重试`);
+          }
+        }
+        await options.afterExit?.();
+      })().catch((error: unknown) => { stopping = undefined; throw error; });
+      return stopping;
+    },
+  };
+}
+
+export async function waitForHttp(url: string, timeoutMs: number, signal: AbortSignal): Promise<void> {
+  const deadline = Date.now() + timeoutMs;
+  let lastError: unknown;
+  while (Date.now() < deadline) {
+    signal.throwIfAborted();
+    try {
+      const response = await fetch(url, {
+        cache: "no-store",
+        signal: AbortSignal.any([signal, AbortSignal.timeout(Math.max(1, Math.min(1_000, deadline - Date.now())))]),
+      });
+      await response.body?.cancel();
+      if (response.ok) return;
+      lastError = new Error(`HTTP ${response.status}`);
+    } catch (error) { lastError = error; }
+    signal.throwIfAborted();
+    if (Date.now() < deadline) await delay(Math.min(150, deadline - Date.now()), undefined, { signal });
+  }
+  throw new Error(`Timed out waiting for ${url}: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
+}
```

**File**: `apps/desktop/src/runtime-controller.ts` (added, +95/-0)
```diff
@@ -0,0 +1,95 @@
+export type RuntimeState =
+  | { phase: "stopped" | "starting" | "ready" | "stopping" }
+  | { phase: "error"; message: string };
+
+export interface RuntimeSession {
+  readonly failure: Promise<Error>;
+  stop(): Promise<void>;
+}
+
+/** Keeps the cleanup handle even when startup never produced a usable session. */
+export class RuntimeStartError extends AggregateError {
+  readonly cleanup: () => Promise<void>;
+  constructor(errors: unknown[], cleanup: () => Promise<void>) {
+    super(errors, "本地服务启动失败且未能完成清理，请退出 SAG 后重试");
+    this.cleanup = cleanup;
+  }
+}
+
+/** Owns a single runtime generation, including startup cancellation and teardown. */
+export class RuntimeController<T extends RuntimeSession> {
+  state: RuntimeState = { phase: "stopped" };
+  session: T | undefined;
+  private starting: Promise<T> | undefined;
+  private stopping: Promise<void> | undefined;
+  private abort: AbortController | undefined;
+  private cleanupError: unknown;
+  private partialCleanup: (() => Promise<void>) | undefined;
+  private readonly create: (signal: AbortSignal) => Promise<T>;
+  private readonly publish: (state: RuntimeState) => void;
+
+  constructor(create: (signal: AbortSignal) => Promise<T>, publish: (state: RuntimeState) => void = () => {}) {
+    this.create = create;
+    this.publish = publish;
+  }
+
+  private update(state: RuntimeState): void {
+    this.state = state;
+    this.publish(state);
+  }
+
+  start(): Promise<T> {
+    if (this.starting) return this.starting;
+    if (this.stopping) return this.stopping.then(() => this.start());
+    if (this.cleanupError) return Promise.reject(this.cleanupError);
+    if (this.session) return Promise.resolve(this.session);
+    const abort = new AbortController();
+    this.abort = abort;
+    this.update({ phase: "starting" });
+    this.starting = Promise.resolve().then(() => this.create(abort.signal)).then(async (session) => {
+      this.session = session;
+      abort.signal.throwIfAborted();
+      this.update({ phase: "ready" });
+      void session.failure.then(async (error) => {
+        if (this.session !== session || this.stopping || abort.signal.aborted) return;
+        try { await this.stop(); } catch (cleanupError) {
+          error = new AggregateError([error, cleanupError], "服务异常退出且清理失败");
+        }
+        this.update({ phase: "error", message: error.message });
+      });
+      return session;
+    }).catch((error: unknown) => {
+      // The native factory uses AggregateError only when partial-start cleanup
+      // also failed. Do not let a retry overlap those potentially live children.
+      if (error instanceof AggregateError) this.cleanupError = error;
+      if (error instanceof RuntimeStartError) this.partialCleanup = error.cleanup;
+      if (!abort.signal.aborted) {
+        this.update({ phase: "error", message: error instanceof Error ? error.message : String(error) });
+      }
+      throw error;
+    }).finally(() => { this.starting = undefined; });
+    return this.starting;
+  }
+
+  stop(): Promise<void> {
+    if (this.stopping) return this.stopping;
+    this.abort?.abort(new Error("Runtime startup cancelled"));
+    this.update({ phase: "stopping" });
+    const starting = this.starting;
+    this.stopping = (async () => {
+      try { await starting; } catch { /* Cleanup is owned below, including partial startup. */ }
+      if (this.session) await this.session.stop();
+      else if (this.partialCleanup) await this.partialCleanup();
+      else if (this.cleanupError) throw this.cleanupError;
+      this.session = undefined;
+      this.partialCleanup = undefined;
+      this.cleanupError = undefined;
+      this.update({ phase: "stopped" });
+    })().catch((error: unknown) => {
+      this.cleanupError = error;
+      this.update({ phase: "error", message: error instanceof Error ? error.message : String(error) });
+      throw error;
+    }).finally(() => { this.stopping = undefined; });
+    return this.stopping;
+  }
+}
```

---

### Incident Patch 10: `5846b652` (2026-09-26)
**Commit Message**: perf(desktop): parallelize release builds and warm dependency caches

**File**: `.github/actions/setup-desktop-build/action.yml` (added, +32/-0)
```diff
@@ -0,0 +1,32 @@
+name: Set up desktop build dependencies
+description: Use identical toolchains and dependency cache keys for releases and main-branch warming.
+
+runs:
+  using: composite
+  steps:
+    - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
+      with:
+        node-version: "22"
+        cache: npm
+        cache-dependency-path: |
+          apps/web/package-lock.json
+          apps/desktop/package-lock.json
+    - uses: actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97 # v7.0.0
+      with:
+        python-version: "3.11"
+    - uses: astral-sh/setup-uv@20cfd1bf945f4377ade1205e4dbc17946fc9a30d # v10.0.1
+      with:
+        enable-cache: true
+        cache-dependency-glob: apps/api/uv.lock
+    - name: Install Web dependencies
+      shell: bash
+      working-directory: apps/web
+      run: npm ci
+    - name: Install desktop dependencies
+      shell: bash
+      working-directory: apps/desktop
+      run: npm ci
+    - name: Install frozen backend dependencies
+      shell: bash
+      working-directory: apps/api
+      run: uv sync --frozen --extra desktop
```

**File**: `.github/workflows/desktop-dependency-cache.yml` (added, +39/-0)
```diff
@@ -0,0 +1,39 @@
+name: Desktop Dependency Cache
+
+# Tag caches cannot be restored by the next release tag. Populate the default
+# branch scope on the same native runners, with the same setup as the release.
+on:
+  push:
+    branches: [main]
+    paths:
+      - apps/web/package.json
+      - apps/web/package-lock.json
+      - apps/desktop/package.json
+      - apps/desktop/package-lock.json
+      - apps/api/pyproject.toml
+      - apps/api/uv.lock
+      - .github/actions/setup-desktop-build/**
+      - .github/workflows/desktop-dependency-cache.yml
+      - .github/workflows/desktop-release.yml
+  workflow_dispatch:
+
+permissions:
+  contents: read
+
+concurrency:
+  group: desktop-dependency-cache-${{ github.ref }}
+  cancel-in-progress: true
+
+jobs:
+  warm:
+    name: Warm ${{ matrix.os }} dependencies
+    if: github.repository == 'Zleap-AI/SAG' && github.ref == 'refs/heads/main'
+    strategy:
+      fail-fast: false
+      matrix:
+        os: [macos-15, windows-2025]
+    runs-on: ${{ matrix.os }}
+    timeout-minutes: 20
+    steps:
+      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
+      - uses: ./.github/actions/setup-desktop-build
```

**File**: `.github/workflows/desktop-release.yml` (modified, +28/-51)
```diff
@@ -58,7 +58,8 @@ jobs:
   macos:
     name: macOS 15 · Apple Silicon · signed + notarized
     if: github.repository == 'Zleap-AI/SAG'
-    needs: [quality, metadata]
+    # Build in parallel with quality checks; publish still requires every gate.
+    needs: [metadata]
     runs-on: macos-15
     timeout-minutes: 120
     environment: desktop-release
@@ -82,20 +83,7 @@ jobs:
               exit 1
             }
           done
-      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
-        with:
-          node-version: "22"
-          cache: npm
-          cache-dependency-path: |
-            apps/web/package-lock.json
-            apps/desktop/package-lock.json
-      - uses: actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97 # v7.0.0
-        with:
-          python-version: "3.11"
-      - uses: astral-sh/setup-uv@20cfd1bf945f4377ade1205e4dbc17946fc9a30d # v10.0.1
-        with:
-          enable-cache: true
-          cache-dependency-glob: apps/api/uv.lock
+      - uses: ./.github/actions/setup-desktop-build
       - name: Verify native Apple Silicon toolchain
         shell: bash
         run: |
@@ -108,18 +96,20 @@ jobs:
             exit 1
           }
           python -c 'import platform; raise SystemExit(0 if platform.machine() == "arm64" else "Python must be arm64")'
-      - name: Install Web dependencies
-        working-directory: apps/web
-        run: npm ci
-      - name: Install desktop dependencies
+      # Keep phases separate so Actions reports each duration. Signing secrets
+      # remain scoped to the final package step, never the preparation steps.
+      - name: Compile Electron
+        working-directory: apps/desktop
+        run: npm run build
+      - name: Build desktop Web
+        working-directory: apps/desktop
+        run: npm run build:web
+      - name: Freeze Python backend
         working-directory: apps/desktop
-        run: npm ci
-      - name: Install frozen backend dependencies
-        working-directory: apps/api
-        run: uv sync --frozen --extra desktop
-      - name: Prepare macOS release payload without signing credentials
+        run: npm run build:backend
+      - name: Assemble release resources
         working-directory: apps/desktop
-        run: npm run prepare:release
+        run: npm run prepare:resources
       - name: Build signed and notarized macOS release
         working-directory: apps/desktop
         env:
@@ -164,40 +154,27 @@ jobs:
   windows:
     name: Windows 2025 · x64 · unsigned
     if: github.repository == 'Zleap-AI/SAG'
-    needs: [quality, metadata]
+    needs: [metadata]
     runs-on: windows-2025
     timeout-minutes: 120
     env:
       CSC_IDENTITY_AUTO_DISCOVERY: "false"
       SAG_UPDATE_GITHUB_REPOSITORY: ${{ github.repository }}
     steps:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
-      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
-        with:
-          node-version: "22"
-          cache: npm
-          cache-dependency-path: |
-            apps/web/package-lock.json
-            apps/desktop/package-lock.json
-      - uses: actions/setup-python@5fda3b95a4ea91299a34e894583c3862153e4b97 # v7.0.0
-        with:
-          python-version: "3.11"
-      - uses: astral-sh/setup-uv@20cfd1bf945f4377ade1205e4dbc17946fc9a30d # v10.0.1
-        with:
-          enable-cache: true
-          cache-dependency-glob: apps/api/uv.lock
-      - name: Install Web dependencies
-        working-directory: apps/web
-        run: npm ci
-      - name: Install desktop dependencies
+      - uses: ./.github/actions/setup-desktop-build
+      - name: Compile Electron
+        working-directory: apps/desktop
+        run: npm run build
+      - name: Build desktop Web
+        working-directory: apps/desktop
+        run: npm run build:web
+      - name: Freeze Python backend
         working-directory: apps/desktop
-        run: npm ci
-      - name: Install frozen backend dependencies
-        working-directory: apps/api
-        run: uv sync --frozen --extra desktop
-      - name: Prepare Windows release payload
+        run: npm run build:backend
+      - name: Assemble release resources
         working-directory: apps/desktop
-        run: npm run prepare:release
+        run: npm run prepare:resources
       - name: Build unsigned Windows release
         working-directory: apps/desktop
         run: npm run package:win
@@ -236,7 +213,7 @@ jobs:
   publish:
     name: Publish immutable GitHub Release
     if: github.repository == 'Zleap-AI/SAG' && github.event_name == 'push'
-    needs: [metadata, macos, windows]
+    needs: [quality, metadata, macos, windows]
     runs-on: ubuntu-24.04
     permissions:
       contents: write
```

**File**: `apps/desktop/README.md` (modified, +9/-1)
```diff
@@ -72,10 +72,18 @@ make release-dry-run VERSION="$VERSION"
 make release VERSION="$VERSION"
 ```
 
-仅创建标签的发布脚本会检查干净的 `main` 工作区和已准备的版本元数据，然后创建注解版本标签，并将标签指向公开仓库 `origin/main` 当前提交。标签会触发 `.github/workflows/desktop-release.yml`。流水线在原生 `macos-15` ARM64 和 `windows-2025` x64 runner 上构建；只有 macOS 签名与公证成功，并且两个平台的更新元数据和校验文件齐全后，才会创建公开 GitHub Release。
+仅创建标签的发布脚本会检查干净的 `main` 工作区和已准备的版本元数据，然后创建注解版本标签，并将标签指向公开仓库 `origin/main` 当前提交。标签会触发 `.github/workflows/desktop-release.yml`。流水线在原生 `macos-15` ARM64 和 `windows-2025` x64 runner 上构建。版本校验通过后，两个平台构建与质量检查并行；只有完整质量检查通过、macOS 签名与公证成功，并且两个平台的更新元数据和校验文件齐全后，才会创建公开 GitHub Release。质量检查失败仍会阻止发布，但此时已经启动的构建可能继续消耗 runner 时间。
 
 脚本不会在本地构建或上传二进制。推送标签失败时，请先排查原因再重试；已经公开的标签不可移动或复用。
 
+### 发布耗时与缓存
+
+`.github/workflows/desktop-dependency-cache.yml` 在 `main` 上的依赖或发布配置变化后，使用与正式构建相同的 macOS/Windows runner 预热 npm 与 uv 下载缓存。两条流水线共用 `.github/actions/setup-desktop-build/action.yml`，保持工具链和缓存键一致。预热不构建安装包、不使用签名凭据，也不发布版本。
+
+GitHub 不允许不同标签相互读取缓存，但标签可以读取默认分支的缓存；因此只在版本标签中保存缓存，不能让下一次版本发布命中它。版本 PR 合入后，让对应的 Desktop Dependency Cache 完成再推标签，可提高命中率；缓存过期时也可在 `main` 手动运行预热。预热失败、尚未完成或缓存缺失都不阻止发布，正式构建仍执行 `npm ci` 和 `uv sync --frozen --extra desktop`，只会回到下载依赖的路径。预热会额外使用两台 runner，目标是缩短发布等待，不保证减少总 runner 用量。
+
+Actions 将 Electron 编译、Next.js 构建、Python 冻结、资源组装分别列为步骤，便于比较耗时。macOS 的签名和公证仍由 electron-builder 管理，不跳过签名、公证、更新元数据或安装包校验。首轮优化的测量基线与验收方法见 [桌面发布性能记录](../../docs/desktop-release-performance.md)。
+
 ## GitHub 发布环境
 
 打开 public 仓库的 [`Settings → Environments`](https://github.com/Zleap-AI/SAG/settings/environments)，创建名称完全一致的 `desktop-release` Environment。若启用 Deployment branches and tags 限制，需要同时允许 `main`（手动验收）与 `v*.*.*`（正式发布标签）；可选配 Required reviewers 作为人工发布闸门。
```

**File**: `docs/desktop-release-performance.md` (added, +48/-0)
```diff
@@ -0,0 +1,48 @@
+# 桌面发布性能记录
+
+分析日期：2026-09-26。源码基线：`4542e07c66c279edd919f3df346c751259f8948c`。本文记录发布编排和依赖缓存优化；安装格式和签名政策保持不变。同分支的桌面运行管理改动见桌面 README。
+
+## 实测基线
+
+数据来自 GitHub Actions 的 job/step 时间与 macOS job 日志。
+
+| 指标 | [v1.8.10](https://github.com/Zleap-AI/SAG/actions/runs/35707841464) | [v1.8.11](https://github.com/Zleap-AI/SAG/actions/runs/35809234000) |
+| --- | ---: | ---: |
+| 流水线创建至最后更新 | 22:23 | 24:08 |
+| 最慢质量检查（后端测试 job） | 3:49 | 4:20 |
+| macOS job | 17:12 | 18:57 |
+| macOS 后端依赖安装 | 1:27 | 1:27 |
+| macOS 编译与资源准备 | 3:34 | 4:00 |
+| macOS 打包、签名、公证 | 10:35 | 12:07 |
+| Windows job | 12:13 | 12:36 |
+| 最终发布 job | 1:05 | 0:35 |
+
+两次 macOS 日志都显示 `npm cache is not found` 和 `No GitHub Actions cache found`。uv 缓存键相同，仍没有跨版本命中。
+
+签名开始至 `notarization successful` 分别为约 8:52、10:33。现有日志没有签名结束时间，因此不能把整段都归因于 Apple 公证等待。v1.8.11 macOS 产物上传步骤只有 8 秒，上传并非主瓶颈。
+
+## 本轮调整
+
+1. **并行编排。** macOS/Windows 构建仍依赖版本校验，但不再等待完整质量检查。发布 job 显式依赖质量检查、版本校验和两平台构建，默认成功条件保持有效。签名凭据仍只进入凭据检查与最终签名步骤。
+2. **在默认分支预热依赖。** 新增 main-only 原生平台预热，共用依赖安装 action，保存 npm/uv 下载缓存。根据 [GitHub 缓存作用域规则](https://docs.github.com/en/actions/reference/workflows-and-actions/dependency-caching#restrictions-for-accessing-a-cache)，标签可以读取默认分支缓存，但不能读取另一个标签的缓存。冷缓存时继续完整安装，不缓存或复用签名后的应用。
+3. **拆分构建计时。** 将原有 `prepare:release` 的四条顺序命令展开为独立步骤；保留执行顺序和命令，方便定位下一轮瓶颈。
+
+并行收益模型：以历史 job 时长不变为前提，忽略排队和调度开销。
+
+```text
+原先：max(质量检查, 版本校验) + max(macOS, Windows) + 发布
+调整：max(质量检查, 版本校验 + max(macOS, Windows)) + 发布
+```
+
+对应两次历史记录，预计分别减少 222 秒和 253 秒，约为模型总耗时的 17%。这是调度估算，不是修改后实测。缓存收益未计入，取决于预热完成时间、缓存保留、工具链版本与下载速度。
+
+成本：依赖变化时新增两平台预热任务；质量检查失败时，已开始的原生构建可能继续运行。优化目标是缩短发布等待，不是承诺减少 Actions 总计算用量。
+
+## 验收
+
+- 本地运行 `node --test scripts/tests/*.test.mjs`，覆盖发布门禁、不可变标签、更新通道和发布重试；用 actionlint 检查工作流。
+- 合入 main 后检查 Desktop Dependency Cache 两平台均成功，并确认缓存来自 main。
+- 使用现有 Desktop Release 的 main 手动验收：确认质量检查与原生构建重叠、依赖缓存恢复、两平台产物校验通过；手动验收不会创建公开 Release。
+- 下一次正式版本发布记录相同 job/step 耗时，比较实际总耗时与缓存命中。runner 排队、环境审批和 Apple 公证波动应单独记录。
+
+本地脚本测试不能验证 GitHub 缓存实际命中、原生安装包、macOS 签名公证或优化后的真实耗时。这些需要合入后的受控流水线验收；本轮未触发生产发布。
```

---

### Incident Patch 11: `8968f56c` (2026-09-26)
**Commit Message**: fix(web): 重试抽取期间允许暂停文档

失败文档重新处理时会建立 reprocess 覆盖层，该覆盖层需要在整个
抽取过程中保持存活，以维持忙碌态与 1s 轮询节奏。但暂停按钮此前
直接以 activity.busy 为禁用条件，导致重试文档在提取全过程中无法
暂停——而后端在 pending/loading/extracting 阶段始终接受协作式暂停。

改为在活动对象上派生独立的 canPause：抽取窗口内可用，暂停请求发出
后立即锁定，重新入队但尚未被 worker 接手的过渡期不可用（此时没有
可停止的 QUEUED/RUNNING 作业，后端会返回冲突）。

Co-Authored-By: Claude Opus 5.5 <[REDACTED_EMAIL]>

**File**: `apps/web/components/features/document-list.tsx` (modified, +1/-1)
```diff
@@ -118,7 +118,7 @@ export function DocumentList({
             size="icon"
             className={buttonClass}
             title={t("pause")}
-            disabled={activity.busy}
+            disabled={!activity.canPause}
             onClick={() => void perform(document, "pause")}
           >
             <Pause className="size-4" />
```

**File**: `apps/web/lib/document-activity.test.ts` (modified, +48/-0)
```diff
@@ -300,6 +300,54 @@ describe("document activity", () => {
     expect(shouldKeepDocumentMutation(document({ status: "paused" }), pausing)).toBe(false);
   });
 
+  it("keeps pause available while a reprocess retry is extracting", () => {
+    const retrying = document({ status: "failed", progress: 52 });
+    const mutation = beginDocumentMutation(retrying, "reprocess", 1_000);
+    const extracting = document({ status: "extracting", progress: 68, error: null });
+
+    // The reprocess overlay stays active for the whole extraction, so pause must
+    // not be gated on it; the worker still accepts a cooperative pause here.
+    expect(deriveDocumentActivity(extracting, mutation, 2_000)).toMatchObject({
+      busy: true,
+      canPause: true,
+    });
+  });
+
+  it("withholds pause until a requeued retry actually starts extracting", () => {
+    const retrying = document({ status: "failed", progress: 52 });
+    const mutation = beginDocumentMutation(retrying, "reprocess", 1_000);
+
+    expect(deriveDocumentActivity(retrying, mutation, 1_001)).toMatchObject({
+      phase: "requeueing",
+      canPause: false,
+    });
+    expect(
+      deriveDocumentActivity(document({ status: "pending", progress: 0 }), mutation, 1_200),
+    ).toMatchObject({ phase: "requeueing", canPause: true });
+  });
+
+  it("locks pause for the duration of a pause request and unlocks on the next state", () => {
+    const extracting = document({ status: "extracting", progress: 68 });
+    const pausing = beginDocumentMutation(extracting, "pause", 1_000);
+    const paused = document({ status: "paused", progress: 68, error: null });
+
+    expect(deriveDocumentActivity(extracting, pausing, 1_001)).toMatchObject({
+      phase: "pausing",
+      canPause: false,
+    });
+    expect(deriveDocumentActivity(paused, pausing, 2_000)).toMatchObject({
+      phase: "paused",
+      canPause: false,
+    });
+    expect(deriveDocumentActivity(paused, undefined, 2_000)).toMatchObject({
+      phase: "paused",
+      canPause: false,
+    });
+    expect(deriveDocumentActivity(document({ status: "ready" }), undefined, 2_000)).toMatchObject({
+      canPause: false,
+    });
+  });
+
   it("clears a pause overlay when the job completes or fails before pausing", () => {
     const started = beginDocumentMutation(
       document({ status: "extracting", progress: 80 }),
```

**File**: `apps/web/lib/document-activity.ts` (modified, +18/-4)
```diff
@@ -26,6 +26,7 @@ export interface DocumentActivity {
   phase: DocumentActivityPhase;
   progress: number;
   busy: boolean;
+  canPause: boolean;
   canDelete: boolean;
   poll: boolean;
   error: string | null;
@@ -46,6 +47,14 @@ const PROCESSING_STATES = new Set<DocumentStatus>([
   "pausing",
   "deleting",
 ]);
+// The worker accepts a pause while the document is still pending, loading or
+// extracting. A freshly requeued document keeps its previous (failed) status
+// until the worker picks it up, and in that window there is no job to stop yet.
+const PAUSABLE_STATES = new Set<DocumentStatus>([
+  "pending",
+  "loading",
+  "extracting",
+]);
 const FAILED_POLLING_WINDOW_MS = 15_000;
 
 function clampProgress(value: number) {
@@ -185,27 +194,31 @@ export function deriveDocumentActivity(
       && mutationActive
       && (mutation.action === "delete" || !mutation.job)
     );
+  const canPause =
+    PAUSABLE_STATES.has(document.status)
+    && !(mutation && mutationActive && mutation.action === "pause");
 
   if (mutation && mutationActive) {
     if (mutation.action === "delete") {
-      return { phase: "deleting", progress, busy: true, canDelete, poll, error: null };
+      return { phase: "deleting", progress, busy: true, canPause, canDelete, poll, error: null };
     }
     if (mutation.action === "pause" && document.status !== "paused") {
-      return { phase: "pausing", progress, busy: true, canDelete, poll, error: null };
+      return { phase: "pausing", progress, busy: true, canPause, canDelete, poll, error: null };
     }
     if (mutation.action === "resume" && (!mutation.job || mutation.job.status === "queued")) {
-      return { phase: "resuming", progress, busy: true, canDelete, poll, error: null };
+      return { phase: "resuming", progress, busy: true, canPause, canDelete, poll, error: null };
     }
     if (mutation.action === "reprocess") {
       if (!mutation.job) {
-        return { phase: "requeueing", progress, busy: true, canDelete, poll, error: null };
+        return { phase: "requeueing", progress, busy: true, canPause, canDelete, poll, error: null };
       }
       if (mutation.job.status === "queued") {
         const waitingRetry = Boolean(mutation.job.error);
         return {
           phase: waitingRetry ? "waiting-retry" : "pending",
           progress,
           busy: true,
+          canPause,
           canDelete,
           poll,
           error: mutation.job.error,
@@ -221,6 +234,7 @@ export function deriveDocumentActivity(
       document.status === "pausing"
       || document.status === "deleting"
       || Boolean(mutationActive && poll),
+    canPause,
     canDelete,
     poll,
     error:
```

---

### Incident Patch 12: `0615ce08` (2026-09-26)
**Commit Message**: fix(universe): preserve stored timestamp boundaries when paging

**File**: `apps/api/sag_api/sag/universe_reader.py` (modified, +13/-1)
```diff
@@ -416,6 +416,17 @@ async def universe_timeline(
             event_time <= as_of_db,
             SourceEvent.created_time <= as_of_db,
         ]
+        def stored_event_time(event_id: str):
+            # Compare the same value used by ORDER BY. SQLite server defaults
+            # omit microseconds; rebinding a Python datetime adds .000000 and
+            # makes equal instants compare unequal, repeating a page boundary.
+            return (
+                select(event_time)
+                .where(SourceEvent.data_source_id == source_config_id, SourceEvent.id == event_id)
+                .correlate(None)
+                .scalar_subquery()
+            )
+
         # Canonical exploration order: newest first, then the extractor's
         # source-wide narrative rank, then id. Rank is what makes a source whose
         # events all share one instant (an imported book) explorable in reading
@@ -426,6 +437,7 @@ async def universe_timeline(
             boundary_id = str(cursor_payload.get("id") or "")
             if boundary_time is None or not boundary_id:
                 raise ValueError("invalid universe cursor")
+            boundary_time = stored_event_time(boundary_id)
             if direction == "older":
                 filters.append(
                     or_(
@@ -495,7 +507,7 @@ async def universe_timeline(
             first_ordinal = 0
             head = page[0] if page else None
             if head is not None:
-                head_time = head.event_time
+                head_time = stored_event_time(str(head.id))
                 head_rank = int(head.rank or 0)
                 head_id = str(head.id)
                 first_ordinal = int(
```

**File**: `apps/api/tests/test_universe_engine.py` (modified, +21/-2)
```diff
@@ -7,7 +7,7 @@
 
 import httpx
 import pytest
-from sqlalchemy import delete, select
+from sqlalchemy import delete, select, text
 
 
 def test_universe_cursor_protocol_rejects_v1_tokens():
@@ -754,7 +754,8 @@ async def expand(
 
 
 @pytest.mark.asyncio
-async def test_universe_timeline_orders_same_instant_book_by_narrative_rank():
+@pytest.mark.parametrize("timestamp_storage", ["orm", "sqlite_start_time", "sqlite_created_time"])
+async def test_universe_timeline_orders_same_instant_book_by_narrative_rank(timestamp_storage):
     """An imported book stamps every event with one instant; the canonical
     exploration order must fall back to the extractor's narrative rank, and the
     ordinals must stay contiguous so the client's counting axis can carry it."""
@@ -847,6 +848,24 @@ async def test_universe_timeline_orders_same_instant_book_by_narrative_rank():
                         )
                     )
                 await session.commit()
+                if timestamp_storage != "orm":
+                    # SQLite CURRENT_TIMESTAMP stores seconds without .000000.
+                    # Exercise both explicit event times and the creation-time fallback.
+                    await session.execute(
+                        text(
+                            "UPDATE source_event SET created_time = :instant, "
+                            "start_time = :start WHERE data_source_id = :source_id"
+                        ),
+                        {
+                            "instant": imported_at.strftime("%Y-%m-%d %H:%M:%S"),
+                            "start": (
+                                imported_at.strftime("%Y-%m-%d %H:%M:%S")
+                                if timestamp_storage == "sqlite_start_time" else None
+                            ),
+                            "source_id": source_config_id,
+                        },
+                    )
+                    await session.commit()
 
             async def timeline(
                 cursor: str | None = None,
```

---

### Incident Patch 13: `add552a4` (2026-09-26)
**Commit Message**: fix(octx): surface the per-record cause of a vector batch failure

Preparing a desktop release with a stale virtualenv produced a package whose
frozen engine could not honour the code's embedding dimensions (0.12.0 named the
field `dimensions`, the code passes `schema_dimensions`/`request_dimensions`).
The engine silently dropped it, embeddings came back at the model's native 2560
width, and every row failed against the 1024-wide vector table.

Two changes, both narrow:

- octx_vector_rebuilder: the failure message listed only the failing record ids.
  `FailedItem` carries `error` alongside `id`, and that field held the real
  cause ("Cannot cast to FixedSizeList(1024): value at index 0 has length 2560").
  Include it, so the next failure is diagnosable from the message alone.
- build-backend.mjs: assert the venv's zleap-sag matches the pyproject pin before
  freezing. A mismatched engine otherwise builds a package that only fails at
  runtime, which is exactly how this shipped.

No behaviour change to the happy path.

**File**: `apps/api/sag_api/sag/octx_vector_rebuilder.py` (modified, +1/-1)
```diff
@@ -124,7 +124,7 @@ async def _write(
 
     result = await vector_store.upsert(collection, records)
     if result.failure_count:
-        failed = ", ".join(item.id for item in result.failed_items[:5])
+        failed = "; ".join(f"{item.id}: {item.error}" for item in result.failed_items[:5])
         raise RuntimeError(f"OCTX vector batch failed for {collection}: {failed}")
     written = result.success_count
     if written != len(documents):
```

**File**: `apps/desktop/scripts/build-backend.mjs` (modified, +27/-1)
```diff
@@ -1,4 +1,4 @@
-import { access } from "node:fs/promises";
+import { access, readFile } from "node:fs/promises";
 import { spawn } from "node:child_process";
 import path from "node:path";
 import { fileURLToPath } from "node:url";
@@ -37,6 +37,32 @@ if (probeCode !== 0) {
   );
 }
 
+// The frozen sidecar must run the same engine the code was written against.
+// A stale venv silently produces a package that fails at runtime, so verify the
+// installed zleap-sag matches the pyproject pin before spending minutes building.
+const pinned = (await readFile(path.join(apiRoot, "pyproject.toml"), "utf8"))
+  .match(/"zleap-sag==([^"]+)"/)?.[1];
+const versionProbe = spawn(
+  python,
+  ["-c", "from importlib.metadata import version; print(version('zleap-sag'))"],
+  { cwd: apiRoot },
+);
+let installed = "";
+versionProbe.stdout.on("data", (chunk) => {
+  installed += chunk;
+});
+const versionCode = await new Promise((resolve) => {
+  versionProbe.once("exit", (code) => resolve(code ?? 1));
+});
+installed = installed.trim();
+if (versionCode !== 0 || (pinned && installed !== pinned)) {
+  throw new Error(
+    `Engine version mismatch: pyproject pins zleap-sag==${pinned}, `
+    + `but ${python} has ${installed || "none installed"}. `
+    + "Install the pinned version there before building a release.",
+  );
+}
+
 const child = spawn(
   python,
   [
```

---

### Incident Patch 14: `ebe0ddad` (2026-09-23)
**Commit Message**: Merge pull request #195 from Zleap-AI/dependabot/github_actions/docker/build-push-action-7.4.0

chore(deps): bump docker/build-push-action from 7.3.0 to 7.4.0

**File**: `.github/workflows/fnos-release.yml` (modified, +1/-1)
```diff
@@ -184,7 +184,7 @@ jobs:
           password: ${{ secrets.GITHUB_TOKEN }}
       - id: build
         name: Build and push an untagged immutable image index
-        uses: docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a # v6.17.0
+        uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7.4.0
         with:
           context: ${{ matrix.context }}
           outputs: type=image,name-canonical=true,push-by-digest=true,push=true
```

---

### Incident Patch 15: `49f8f4de` (2026-09-23)
**Commit Message**: Merge remote-tracking branch 'origin/main' into codex/buildpush-main-updated

**File**: `.github/workflows/fnos-release.yml` (modified, +8/-8)
```diff
@@ -86,7 +86,7 @@ jobs:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
           ref: ${{ needs.verify-release-request.outputs.revision }}
-      - uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f # v3.10.0
+      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
       - id: policy
         name: Verify reviewed policy and raw OCI index
         shell: bash
@@ -176,7 +176,7 @@ jobs:
         with:
           ref: ${{ needs.verify-release-request.outputs.revision }}
       - uses: docker/setup-qemu-action@96fe6ef7f33517b61c61be40b68a1882f3264fb8 # v3.6.0
-      - uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f # v3.10.0
+      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
       - uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v3.3.0
         with:
           registry: ghcr.io
@@ -226,7 +226,7 @@ jobs:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
           ref: ${{ needs.verify-release-request.outputs.revision }}
-      - uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f # v3.10.0
+      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
       - uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v3.3.0
         with:
           registry: ghcr.io
@@ -297,7 +297,7 @@ jobs:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
           ref: ${{ needs.verify-release-request.outputs.revision }}
-      - uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f # v3.10.0
+      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
       - uses: docker/login-action@dbcb813823bdd20940b903addbd779551569679f # v3.3.0
         with:
           registry: ghcr.io
@@ -323,7 +323,7 @@ jobs:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
           ref: ${{ needs.verify-release-request.outputs.revision }}
-      - uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f # v3.10.0
+      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
       - name: Resolve immutable indexes without registry credentials
         shell: bash
         run: |
@@ -350,7 +350,7 @@ jobs:
       - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
         with:
           ref: ${{ needs.verify-release-request.outputs.revision }}
-      - uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f # v3.10.0
+      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
       - name: Resolve final tags and indexes without registry credentials
         shell: bash
         run: |
@@ -373,7 +373,7 @@ jobs:
         with:
           ref: ${{ needs.verify-release-request.outputs.revision }}
           fetch-depth: 0
-      - uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f # v3.10.0
+      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
       - name: Install checksum-pinned fnpack
         shell: bash
         run: |
@@ -432,7 +432,7 @@ jobs:
         with:
           ref: ${{ needs.verify-release-request.outputs.revision }}
           fetch-depth: 0
-      - uses: docker/setup-buildx-action@8d2750c68a42422c14e847fe6c8ac0403b4cbd6f # v3.10.0
+      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
       - name: Install checksum-pinned fnpack
         shell: bash
         run: |
```

#### Recent Merged Pull Requests:
- **PR #222** (2026-10-05): Fix New conversation reopening the previous chat (@hikarispochama-ctrl)
- **PR #221** (2026-10-05): Preserve selected source scope in chat history (@hikarispochama-ctrl)
- **PR #220** (2026-10-05): Fix cold-source chatbot retrieval blocking during extraction and align model-test feedback (@hikarispochama-ctrl)
- **PR #219** (2026-10-04): Add native Responses API support to model settings (@hikarispochama-ctrl)
- **PR #218** (2026-10-04): feat(api): add local AnyDoc document parsing (@sq454313544)
- **PR #216** (closed): feat(api): add local AnyDoc parsing and preserve spreadsheet amounts (@sq454313544)
- **PR #215** (2026-10-03): fix(web): clarify embedding URL and key inheritance (@luoshuai990529)
- **PR #213** (2026-10-03): feat(api): build document outline from Markdown heading levels (@kabishou11)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

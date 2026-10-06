# Forensic Learning Record (Deep Inspection): agentuniverse-ai/agentUniverse

> **Canonical Artifact**: `07_PROJECT_LEARNING/agentuniverse-ai-agentuniverse-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/agentuniverse-ai/agentUniverse](https://github.com/agentuniverse-ai/agentUniverse))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T04:09:12.118Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `agentuniverse-ai/agentUniverse`
- **Description**: agentUniverse is a LLM multi-agent framework that allows developers to easily build multi-agent applications. 
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 2374 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `agentuniverse/agent/action/knowledge/reader/utils.py`
```
"""Utility helpers for reader implementations."""
from __future__ import annotations

from pathlib import Path
from typing import BinaryIO, Iterable, Sequence, Union

# Candidate encodings to try when automatic detection libraries are not available.
_FALLBACK_ENCODINGS: Sequence[str] = (
    "utf-8",
    "utf-8-sig",
    "gb18030",
    "gbk",
    "big5",
    "shift_jis",
    "latin-1",
)


def _read_sample_bytes(source: Union[str, Path, BinaryIO, bytes, bytearray],
                       sample_size: int) -> bytes:
    """Read a byte sample from the given file path or binary handle."""
    if isinstance(source, (bytes, bytearray)):
        return bytes(source[:sample_size])
    if isinstance(source, (str, Path)):
        path = Path(source)
        with path.open("rb") as handle:
            return handle.read(sample_size)

    # File-like object – preserve the original pointer
    handle = source
    current_pos = handle.tell()
    try:
        data = handle.read(sample_size)
    finally:
        handle.seek(current_pos)
    return data if data is not None else b""


def detect_file_encoding(source: Union[str, Path, BinaryIO, bytes, bytearray],
                         sample_size: int = 32 * 1024,
                         fallback_encodings: Iterable[str] = _FALLBACK_ENCODINGS) -> str:
    """Best-effort detection of the text encoding for the given file."""
    sample = _read_sample_bytes(source, sample_size)
    if not sample:
        return "utf-8"

    # First try decoding with a curated list of encodings
    for encoding in fallback_encodings:
        try:
            sample.decode(encoding)
            return encoding
        except UnicodeDecodeError:
            continue

    # If the curated list fails, fall back to charset_normalizer if available
    try:  # pragma: no cover - optional dependency
        from charset_normalizer import from_bytes
    except ImportError:  # pragma: no cover - handled above
        best_guess = None
    else:
        result = from_bytes(sample).best()
        best_guess = result.encoding if result is not None else None
        if best_guess:
            return best_guess

    return "utf-8"


__all__ = ["detect_file_encoding"]

```

### Core Architecture Module: `agentuniverse/agent/action/knowledge/reader/web/rendered_web_page_reader.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2025/9/29
# @FileName: rendered_web_page_reader.py
from typing import List, Optional, Dict

from agentuniverse.agent.action.knowledge.reader.reader import Reader
from agentuniverse.agent.action.knowledge.store.document import Document


class RenderedWebPageReader(Reader):
    """Reader for dynamic web pages using Playwright rendering.

    Requires:
        pip install playwright
        playwright install
    """

    def _load_data(self, url: str, ext_info: Optional[Dict] = None) -> List[Document]:
        print(f"debugging: RenderedWebPageReader start load url={url}")
        if not isinstance(url, str) or not url:
            raise ValueError("RenderedWebPageReader._load_data requires a non-empty url string")

        html = self._render_and_get_html(url)
        print(f"debugging: RenderedWebPageReader rendered html length={len(html)}")

        # Reuse extraction logic from WebPageReader by importing on demand
        from .web_page_reader import WebPageReader
        text, metadata_extra = WebPageReader()._extract_main_text(html, url)

        metadata: Dict = {"source": "web", "url": url, "rendered": True}
        metadata.update(metadata_extra)
        if ext_info:
            metadata.update(ext_info)

        return [Document(text=text, metadata=metadata)]

    def _render_and_get_html(self, url: str) -> str:
        try:
            from playwright.sync_api import sync_playwright  # type: ignore
        except Exception as e:
            raise ImportError(
                "playwright is required for RenderedWebPageReader. "
                "Install with `pip install playwright` and run `playwright install`"
            )

        print("debugging: RenderedWebPageReader using playwright")
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            try:
                context = browser.new_context()
                page = context.new_page()
                page.set_default_timeout(20000)
                page.set_default_navigation_timeout(20000)
                page.goto(url)
                page.wait_for_load_state("networkidle")
                html = page.content()
                return html
            finally:
                browser.close()

```

### Core Architecture Module: `agentuniverse/agent/action/tool/common_tool/file_path_utils.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

import os


def resolve_safe_path(file_path: str, base_dir: str = ".") -> str:
    """Resolve file_path and ensure it stays under base_dir."""
    if not isinstance(file_path, str) or not file_path:
        raise ValueError("file_path must be a non-empty string")

    base = os.path.realpath(os.path.abspath(base_dir or "."))
    if os.path.isabs(file_path):
        resolved = os.path.realpath(file_path)
    else:
        resolved = os.path.realpath(os.path.join(base, file_path))

    try:
        common_path = os.path.commonpath([base, resolved])
    except ValueError as exc:
        raise ValueError(f"Path {file_path!r} escapes the allowed directory: {base}") from exc

    if os.path.normcase(common_path) != os.path.normcase(base):
        raise ValueError(f"Path {file_path!r} escapes the allowed directory: {base}")
    return resolved

```

### Core Architecture Module: `agentuniverse/agent/action/tool/common_tool/tool_input_utils.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-


def parse_strict_bool(value, field_name: str, default: bool = False) -> bool:
    """Parse a boolean-like tool input value without unsafe truthy fallback."""
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "y", "on"}:
            return True
        if normalized in {"false", "0", "no", "n", "off"}:
            return False
        raise ValueError(
            f"{field_name} must be a boolean value: true/false, 1/0, yes/no, or on/off"
        )
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        if value == 1:
            return True
        if value == 0:
            return False
        raise ValueError(f"{field_name} numeric value must be 0 or 1")
    raise ValueError(
        f"{field_name} must be a boolean value: true/false, 1/0, yes/no, or on/off"
    )

```

### Core Architecture Module: `agentuniverse/agent/action/tool/utils/__init__.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

```

### Core Architecture Module: `agentuniverse/agent/action/tool/utils/ssrf_proxy.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2024/8/28 14:29
# @Author  : sunshinesmilelk
# @Email   : ximo.lk@antgroup.com
# @FileName: ssrf_proxy.py
import os
import httpx

SSRF_PROXY_ALL_URL = os.getenv('SSRF_PROXY_ALL_URL', '')
SSRF_PROXY_HTTP_URL = os.getenv('SSRF_PROXY_HTTP_URL', '')
SSRF_PROXY_HTTPS_URL = os.getenv('SSRF_PROXY_HTTPS_URL', '')

proxies = {
    'http://': SSRF_PROXY_HTTP_URL,
    'https://': SSRF_PROXY_HTTPS_URL
} if SSRF_PROXY_HTTP_URL and SSRF_PROXY_HTTPS_URL else None


def make_request(method, url, **kwargs):
    kwargs.setdefault("timeout", 20)
    if SSRF_PROXY_ALL_URL:
        kwargs["proxy"] = SSRF_PROXY_ALL_URL
    elif proxies:
        kwargs["proxies"] = proxies
    return httpx.request(method=method, url=url, **kwargs)


def get(url, **kwargs):
    return make_request('GET', url, **kwargs)


def post(url, **kwargs):
    return make_request('POST', url, **kwargs)


def put(url, **kwargs):
    return make_request('PUT', url, **kwargs)


def patch(url, **kwargs):
    return make_request('PATCH', url, **kwargs)


def delete(url, **kwargs):
    return make_request('DELETE', url, **kwargs)


def head(url, **kwargs):
    return make_request('HEAD', url, **kwargs)

```

### Core Architecture Module: `agentuniverse/agent_serve/web/post_fork_queue.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2024/6/3 23:09
# @Author  : fanen.lhy
# @Email   : fanen.lhy@antgroup.com
# @FileName: post_fork_queue.py

from typing import List, Tuple, Callable, Any

FunctionWithArgs = Tuple[Callable, Tuple[Any, ...], dict]
POST_FORK_QUEUE: List[FunctionWithArgs] = []


def add_post_fork(func: Callable, *args: Any, **kwargs: Any) -> None:
    """
    Add func and parameters into a waiting list, all of them will be executed
    after gunicorn worker child processes have been forked, or before flask
    main app start if you work without gunicorn.
    """

    POST_FORK_QUEUE.append((func, args, kwargs))



```

### Core Architecture Module: `agentuniverse/agent_serve/web/web_util.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2024/3/26 10:34
# @Author  : fanen.lhy
# @Email   : fanen.lhy@antgroup.com
# @FileName: web_util.py
import asyncio
import inspect
import queue
import json

from flask import request, make_response, jsonify

from ..service_instance import ServiceInstance
from ...agent.agent import Agent
from ...agent.agent_manager import AgentManager
from ...base.util.logging.logging_util import LOGGER
from ...base.annotation.singleton import singleton


@singleton
class FlaskServerManager:
    _sync_service_timeout = 30

    @property
    def sync_service_timeout(self):
        return self._sync_service_timeout

    @sync_service_timeout.setter
    def sync_service_timeout(self, timeout):
        self._sync_service_timeout = timeout


def request_param(func):
    """An annotation used to parse the flask request params."""

    def wrapper(*args, **kwargs):
        if request.method == "GET":
            req_data = request.args.to_dict()
        # Get the post params from body according to different content type.
        else:
            if "application/json" in request.headers.get("Content-Type"):
                raw_data = request.data.decode('utf-8')
                req_data = json.loads(raw_data)
            else:
                req_data = request.form.to_dict()
        # Get the func arguments name and type.
        sig = inspect.signature(func)
        for name, param in sig.parameters.items():
            if name == "kwargs":
                for key in req_data:
                    if key not in kwargs:
                        kwargs[key] = req_data[key]
                continue
            if name == "saved":
                if "saved" in req_data:
                    kwargs['saved'] = req_data['saved']
                else:
                    kwargs['saved'] = sig.parameters['saved'].default
                continue
            if name == "session_id":
                kwargs[name] = request.headers.get("X-Session-Id")
            elif param.annotation in (str, int, dict, list, bool):
                kwargs[name] = req_data.get(name, param.default)
            else:
                kwargs[name] = param.annotation(**req_data)
        return func(*args, **kwargs)

    wrapper.__name__ = func.__name__
    return wrapper


def service_run_queue(service_id, **kwargs):
    """The func used in a separate thread to run an agent service. The result
    will be saved in a queue if one is provided."""
    stream: queue.Queue = kwargs.get('output_stream')
    try:
        res = ServiceInstance(service_id).run(**kwargs)
        return res
    finally:
        if stream:
            stream.put_nowait('{"type": "EOF"}')


def agent_run_queue(agent_id, **kwargs):
    """The func used in a separate thread to run an agent, and the result will be saved in a queue if provided.

    Args:
        agent_id: The agent id
        **kwargs: Arbitrary keyword arguments.
    """
    stream: queue.Queue = kwargs.get('output_stream')
    try:
        agent: Agent = AgentManager().get_instance_obj(agent_id)
        res = agent.run(**kwargs)
        return res
    finally:
        if stream:
            stream.put_nowait('{"type": "EOF"}')


async def async_agent_run_queue(agent_id, **kwargs):
    stream: asyncio.Queue = kwargs.get('output_stream')
    try:
        agent: Agent = await asyncio.to_thread(AgentManager().get_instance_obj, agent_id)
        res = await asyncio.to_thread(agent.run, **kwargs)
        return res
    finally:
        if stream:
            await asyncio.to_thread(stream.put_nowait, '{"type": "EOF"}')


def make_standard_response(success: bool,
                           result=None,
                           message: str = None,
                           request_id: str = None,
                           status_code=200):
    """Construct a standard flask response."""
    response_data = {
        "success": success,
        "result": result,
        "message": message,
        "request_id": request_id
    }
    LOGGER.info(f"AU_FLASK_RESPONSE: {response_data}")
    return make_response(jsonify(response_data), status_code)

```

### Core Architecture Module: `agentuniverse/base/component/component_configer_util.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2024/3/13 14:00
# @Author  : jerry.zzw 
# @Email   : jerry.zzw@antgroup.com
# @FileName: component_configer_util.py
import importlib
from typing import Type, Callable

from agentuniverse.agent.action.knowledge.knowledge_manager import KnowledgeManager
from agentuniverse.agent.action.tool.tool_manager import ToolManager
from agentuniverse.agent.action.toolkit.toolkit_manager import ToolkitManager
from agentuniverse.agent.agent_manager import AgentManager
from agentuniverse.agent.memory.memory_compressor.memory_compressor_manager import MemoryCompressorManager
from agentuniverse.agent.memory.memory_manager import MemoryManager
from agentuniverse.agent.memory.memory_storage.memory_storage_manager import MemoryStorageManager
from agentuniverse.agent.plan.planner.planner_manager import PlannerManager
from agentuniverse.agent.work_pattern.work_pattern_manager import WorkPatternManager
from agentuniverse.agent_serve.service_manager import ServiceManager
from agentuniverse.agent_serve.service_configer import ServiceConfiger
from agentuniverse.base.config.component_configer.configers.work_pattern_configer import WorkPatternConfiger
from agentuniverse.base.config.component_configer.configers.workflow_configer import WorkflowConfiger
from agentuniverse.database.sqldb_wrapper_manager import SQLDBWrapperManager
from agentuniverse.base.config.component_configer.component_configer import ComponentConfiger
from agentuniverse.base.config.component_configer.configers.agent_configer import AgentConfiger
from agentuniverse.base.config.component_configer.configers.knowledge_configer import KnowledgeConfiger
from agentuniverse.base.config.component_configer.configers.memory_configer import MemoryConfiger
from agentuniverse.base.config.component_configer.configers.planner_configer import PlannerConfiger
from agentuniverse.base.config.component_configer.configers.prompt_configer import PromptConfiger
from agentuniverse.base.config.component_configer.configers.tool_configer import ToolConfiger
from agentuniverse.base.config.component_configer.configers.sqldb_wrapper_config import SQLDBWrapperConfiger
from agentuniverse.base.config.config_type_enum import ConfigTypeEnum
from agentuniverse.base.config.component_configer.configers.llm_configer import LLMConfiger
from agentuniverse.base.component.component_enum import ComponentEnum
from agentuniverse.llm.llm_channel.llm_channel_manager import LLMChannelManager
from agentuniverse.llm.llm_manager import LLMManager
from agentuniverse.prompt.prompt_manager import PromptManager
from agentuniverse.workflow.workflow_manager import WorkflowManager
from agentuniverse.base.util.logging.log_sink.log_sink_manager import LogSinkManager
from agentuniverse.base.util.logging.logging_util import LOGGER
from agentuniverse.agent.action.knowledge.embedding.embedding_manager import EmbeddingManager
from agentuniverse.agent.action.knowledge.doc_processor.doc_processor_manager import DocProcessorManager
from agentuniverse.agent.action.knowledge.reader.reader_manager import ReaderManager
from agentuniverse.agent.action.knowledge.query_paraphraser.query_paraphraser_manager import QueryParaphraserManager
from agentuniverse.agent.action.knowledge.store.store_manager import StoreManager
from agentuniverse.agent.action.knowledge.rag_router.rag_router_manager import RagRouterManager


class ComponentConfigerUtil(object):
    """The ComponentConfigerUtil class, which is used to load and manage the component configuration."""

    __COMPONENT_CONFIGER_CLZ_MAP = {
        ComponentEnum.AGENT: AgentConfiger,
        ComponentEnum.KNOWLEDGE: KnowledgeConfiger,
        ComponentEnum.LLM: LLMConfiger,
        ComponentEnum.PLANNER: PlannerConfiger,
        ComponentEnum.TOOL: ToolConfiger,
        ComponentEnum.TOOLKIT: ComponentConfiger,
        ComponentEnum.MEMORY: MemoryConfiger,
        ComponentEnum.SERVICE: ServiceConfiger,
        ComponentEnum.PROMPT: PromptConfiger,
        ComponentEnum.SQLDB_WRAPPER: SQLDBWrapperConfiger,
        ComponentEnum.WORKFLOW: WorkflowConfiger,
        ComponentEnum.EMBEDDING: ComponentConfiger,
        ComponentEnum.DOC_PROCESSOR: ComponentConfiger,
        ComponentEnum.READER: ComponentConfiger,
        ComponentEnum.STORE: ComponentConfiger,
        ComponentEnum.RAG_ROUTER: ComponentConfiger,
        ComponentEnum.QUERY_PARAPHRASER: ComponentConfiger,
        ComponentEnum.MEMORY_COMPRESSOR: ComponentConfiger,
        ComponentEnum.MEMORY_STORAGE: ComponentConfiger,
        ComponentEnum.WORK_PATTERN: WorkPatternConfiger,
        ComponentEnum.LOG_SINK: ComponentConfiger,
        ComponentEnum.DEFAULT: ComponentConfiger,
        ComponentEnum.LLM_CHANNEL: ComponentConfiger
    }

    __COMPONENT_MANAGER_CLZ_MAP = {
        ComponentEnum.AGENT: AgentManager,
        ComponentEnum.KNOWLEDGE: KnowledgeManager,
        ComponentEnum.LLM: LLMManager,
        ComponentEnum.PLANNER: PlannerManager,
        ComponentEnum.TOOL: ToolManager,
        ComponentEnum.TOOLKIT: ToolkitManager,
        ComponentEnum.MEMORY: MemoryManager,
        ComponentEnum.SERVICE: ServiceManager,
        ComponentEnum.SQLDB_WRAPPER: SQLDBWrapperManager,
        ComponentEnum.PROMPT: PromptManager,
        ComponentEnum.WORKFLOW: WorkflowManager,
        ComponentEnum.EMBEDDING: EmbeddingManager,
        ComponentEnum.DOC_PROCESSOR: DocProcessorManager,
        ComponentEnum.READER: ReaderManager,
        ComponentEnum.STORE: StoreManager,
        ComponentEnum.RAG_ROUTER: RagRouterManager,
        ComponentEnum.QUERY_PARAPHRASER: QueryParaphraserManager,
        ComponentEnum.MEMORY_COMPRESSOR: MemoryCompressorManager,
        ComponentEnum.MEMORY_STORAGE: MemoryStorageManager,
        ComponentEnum.WORK_PATTERN: WorkPatternManager,
        ComponentEnum.LOG_SINK: LogSinkManager,
        ComponentEnum.LLM_CHANNEL: LLMChannelManager,
    }

    @classmethod
    def get_component_config_clz_by_type(cls, component_type_enum: ComponentEnum) -> \
            Type[ComponentConfiger | LLMConfiger]:
        """Get the ComponentConfiger object by the component type.
        Args:
            component_type_enum(ConfigTypeEnum): the component type
        Returns:
            ComponentConfiger: the sub object of ComponentConfiger
        """
        component_config_clz = cls.__COMPONENT_CONFIGER_CLZ_MAP.get(component_type_enum)
        if component_config_clz is None:
            raise Exception(f"Failed to get the ComponentConfiger class by the component type: {component_type_enum}")
        return component_config_clz

    @classmethod
    def get_component_object_clz_by_component_configer(cls, component_configer: ComponentConfiger) -> Callable:
        """Get the component object by the ComponentConfiger object.
        Args:
            component_configer(ComponentConfiger): the ComponentConfiger object
        Returns:
            object: the component object
        """
        if component_configer.meta_class:
            try:
                metadata_module = '.'.join(component_configer.meta_class.split('.')[:-1])
                metadata_class = component_configer.meta_class.split('.')[-1]
                module = importlib.import_module(metadata_module)
                clz = getattr(module, metadata_class)
                return clz
            except Exception as ex:
                LOGGER.error(f"Please check your config file, load configer module error! module name: {metadata_class},error info: {ex} ")
                raise ex
        else:
            try:
                module = importlib.import_module(component_configer.metadata_module)
                clz = getattr(module, component_configer.metadata_class)
                return clz
            except Exception as ex:
                LOGGER.error(f"Please check your config file, load configer module error! module name: {component_configer.metadata_module},error info: {ex} ")
                raise ex

    @classmethod
    def get_component_manager_clz_by_type(cls, component_type_enum: ComponentEnum) -> Callable:
        """Get the ComponentManager object by the component type.
        Args:
            component_type_enum(ConfigTypeEnum): the component type
        Returns:
            object: the ComponentManager object
        """
        return cls.__COMPONENT_MANAGER_CLZ_MAP.get(component_type_enum)

```

### Core Architecture Module: `agentuniverse/base/context/context_archive_utils.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2024/12/17 11:00
# @Author  : fanen.lhy
# @Email   : fanen.lhy@antgroup.com
# @FileName: context_archive_utils.py
import re
from agentuniverse.base.context.framework_context_manager import FrameworkContextManager


def get_current_context_archive():
    """Get (and lazily initialize) the current context archive.

        The archive is stored in FrameworkContextManager under the key
        ``'context_archive'``. If it does not exist, this function will create
        an empty dict and set it into the framework context.

        Returns:
            dict: The current context archive dictionary. Keys are arbitrary names,
            values are dicts containing at least ``data`` and ``description`` fields.

        Example:
            >>> archive = get_current_context_archive()
            >>> isinstance(archive, dict)
            True
        """
    context_archive = FrameworkContextManager().get_context(
        'context_archive', None)
    if not context_archive:
        context_archive = {}
        FrameworkContextManager().set_context('context_archive', {})

    return context_archive


def update_context_archive(name, data, description):
    """Update (or insert) a record in the current context archive.

        This method is a convenience wrapper to store arbitrary structured data
        into the framework-level archive. The record will be accessible by
        ``name`` and contain two fields: ``data`` and ``description``.

        Args:
            name: Unique key for the record (e.g., a step name or component name).
            data: Any serializable payload you want to archive.
            description: Human-readable description of the record.

        Example:
            >>> update_context_archive("retrieval", {"docs": 3}, "top-3 docs for query")
        """
    react_memory = get_current_context_archive()
    react_memory[name] = {
        'data': data,
        'description': description
    }
```

### Core Architecture Module: `agentuniverse/base/util/__init__.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2024/4/2 15:29
# @Author  : jerry.zzw 
# @Email   : jerry.zzw@antgroup.com
# @FileName: __init__.py

```

### Core Architecture Module: `agentuniverse/base/util/agent_util.py`
```
# !/usr/bin/env python3
# -*- coding:utf-8 -*-

# @Time    : 2024/10/25 17:32
# @Author  : wangchongshi
# @Email   : wangchongshi.wcs@antgroup.com
# @FileName: agent_util.py
from agentuniverse.agent.memory.memory import Memory
from agentuniverse.agent.memory.message import Message
from agentuniverse.base.config.custom_configer.default_llm_configer import DefaultLLMConfiger
from agentuniverse.base.util.memory_util import get_memory_string


def assemble_memory_input(memory: Memory, agent_input: dict, query_params: dict = None) -> list[Message]:
    """Assemble memory information for the agent input parameters.

    Args:
        memory (Memory): The memory instance.
        agent_input (dict): Agent input parameters for the agent.

    Returns:
        list[Message]: The retrieved memory messages.
    """
    memory_messages = []
    if memory:
        # get the memory messages from the memory instance.
        if not query_params:
            memory_messages = memory.get(**agent_input)
        else:
            memory_messages = memory.get(**query_params)
        # convert the memory messages to a string and add it to the agent input object.
        memory_str = get_memory_string(memory_messages, agent_input.get('agent_id'))
        agent_input[memory.memory_key] = memory_str
    return memory_messages


def assemble_memory_output(memory: Memory, agent_input: dict,
                           content: str, source: str = None, memory_messages=None) -> \
        list[Message]:
    """Assemble the historical memory information and current memory information
     into the agent's final output memory information.

    Args:
        memory (Memory): The current memory instance.
        agent_input (dict): Agent input object.
        content (str): The content of the current memory message.
        source (str): The source of the current memory message.
        memory_messages (List[Message]): The historical memory messages.
    Returns:
        list[Message]: The assembled final output memory information.
    """
    cur_memory_message = Message(content=content, source=source)
    if memory:
        # add the current memory message to the memory instance.
        memory.add([cur_memory_message], **agent_input)
    if memory_messages is None:
        memory_messages = []
    memory_messages.append(cur_memory_message)
    return memory_messages


def process_agent_llm_config(agent_id: str, agent_profile: dict, default_llm_configer: DefaultLLMConfiger) -> dict:
    """
    Update the LLM model name in the agent's profile based on the default LLM configuration.

    If the agent's profile does not specify an LLM
    model name, and if a default LLM is provided by default LLM configuration, the profile will
    be updated accordingly.
    """
    if not agent_id or default_llm_configer is None:
        return agent_profile

    if not agent_profile:
        agent_profile = {}

    llm_model = agent_profile.setdefault('llm_model', {})
    llm_name = llm_model.get('name')

    # If LLM model name is specified, return the agent profile unchanged
    if llm_name:
        return agent_profile

    # Update the LLM model name with the default LLM from the config manager, if available
    if default_llm_configer.default_llm:
        llm_model['name'] = default_llm_configer.default_llm

    # Return the updated agent profile
    return agent_profile

```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #583** (2026-07-09): **🐞 [Bug] 在service中请求入参 非str类型，会报错，希望支持list和dict**
  *Symptoms*: ### Version  agentUniverse>=0.0.19  ### System  linux  ### Actions  请求参数 如果是数组则报错 {   "service_id": "red_blue_game_orchestrator_service",   "params": {     "input": []    -- 只支持str类型， 不支持 list dict    } }  ### Problem  错误信息：  dji-docchecker-agent  | 2026-06-16 16:26:57.509 | ERROR    | ["trace_id": "ced7e00772517ba922a89bb5b4cbd1ca", "span_id": "209b25305b665f76"] | agentuniverse.agent_serve.web.flask_server:handle_exception:224 | Traceback (most recent call last): dji-docchecker-agent  |   File "/opt/app-venv/lib/python3.12/site-packages/flask/app.py", line 1484, in full_dispatch_request dji-docchecker-agent  |     rv = self.dispatch_request() dji-docchecker-agent  |          ^^^^^^^^^^^^^^^^^^^^^^^ dji-docchecker-agent  |   File "/opt/app-venv/lib/python3.12/site-packages/flask/app.py", line 1469, in dispatch_request dji-docchecker-agent  |     return self.ensure_sync(self.view_functions[rule.endpoint])(**view_args) dji-docchecker-agent  |            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^ dji-docchecker-agent  |   File "/opt/app-venv/lib/python3.12/site-packages/agentuniverse/agent_serve/web/web_util.py", line 68, in wrapper dji-docchecker-agent  |     return func(*args, **kwargs) dji-docchecker-agent  |            ^^^^^^^^^^^^^^^^^^^^^ dji-docchecker-agent  |   File "/opt/app-venv/lib/python3.12/site-packages/agentuniverse/agent_serve/web/flask_server.py", line 125, in service_run dji-docchecker-agent  |     request_task = RequestTask(ServiceInst

- **Issue #540** (2026-07-09): **🐞 [Bug] <同一个agent中，使用多个prompt模板，第一次之后组装prompt会报错>**
  *Symptoms*: ### Version  version:0.0.18  ### System  mac  ### Actions  _No response_  ### Problem   <img width="2262" height="938" alt="Image" src="https://github.com/user-attachments/assets/ac7fe564-b481-4ed3-8303-40cc8f71ec90" />  这里agent_input.pop('audio_url')使用了pop，会移出agent_input中这个key，并且没有带默认值，第二次调用则会抛出异常  ### Expected  pop带上默认值可以修复。 但是为什么用pop，理论上不应该删掉agent_input中的key吧。  ### reproduce  _No response_
  **Post-Mortem & Fix Analysis**:
  > > ### Version > version:0.0.18 >  > ### System > mac >  > ### Actions > _No response_ >  > ### Problem > <img alt="Image" width="2000" height="938" src="https://private-user-images.githubusercontent.com/13903189/525222753-ac7fe564-b481-4ed3-8303-40cc8f71ec90.png?jwt=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJnaXRodWIuY29tIiwiYXVkIjoicmF3LmdpdGh1YnVzZXJjb250ZW50LmNvbSIsImtleSI6ImtleTUiLCJleHAiOjE3NjYzNzU1MjQsIm5iZiI6MTc2NjM3NTIyNCwicGF0aCI6Ii8xMzkwMzE4OS81MjUyMjI3NTMtYWM3ZmU1NjQtYjQ4MS00ZWQzLTgzMDMtNDBjYzhmNzFlYzkwLnBuZz9YLUFtei1BbGdvcml0aG09QVdTNC1ITUFDLVNIQTI1NiZYLUFtei1DcmVkZW50aWFsPUFLSUFWQ09EWUxTQTUzUFFLNFpBJTJGMjAyNTEyMjIlMkZ1cy1lYXN0LTElMkZzMyUyRmF3czRfcmVxdWVzdCZYLUFtei1EYXRlPTIwMjUxMjIyVDAzNDcwNFomWC1BbXotRXhwaXJlcz0zMDAmWC1BbXotU2lnbmF0dXJlPWM2Y2FiMjc2NjBjZWU5ODljZTdlYmJmOTUyMWQ4M2E4ZTViMTY0NGIwMzI4ZmI4Y2U0OGY4Y2Y4YzA1MzhjNGMmWC1BbXotU2lnbmVkSGVhZGVycz1ob3N0In0.Th10qvgPeMbJbNV1-2W0HQmN9Z1YAxyVpaPRl1NSYdw"> > 这里agent_input.pop('audio_url')使用了pop，会移出agent_input中这个key，并且没有带默

- **Issue #483** (2025-10-29): **🐞 [Bug] No module named 'agentuniverse.agent.action.knowledge.store.faiss_store'**
  *Symptoms*: ### Version  agentUniverse==0.0.18  ### System  MacBook Pro M3  ### Actions  按照文档 [docs/guidebook/zh/开始使用/2.运行第一个教程案例.md](https://github.com/agentuniverse-ai/agentUniverse/blob/master/docs/guidebook/zh/%E5%BC%80%E5%A7%8B%E4%BD%BF%E7%94%A8/2.%E8%BF%90%E8%A1%8C%E7%AC%AC%E4%B8%80%E4%B8%AA%E6%95%99%E7%A8%8B%E6%A1%88%E4%BE%8B.md) 运行第一个案例  ### Problem  ```python 2025-10-28 21:17:57.633 | ERROR    | ["trace_id": "0a9d32773b61720acec7a129792bc0d3", "span_id": "0e2af6c72e027793"] | agentuniverse.base.component.component_configer_util:get_component_object_clz_by_component_configer:142 | Please check your config file, load configer module error! module name: agentuniverse.agent.action.knowledge.store.faiss_store,error info: No module named 'agentuniverse.agent.action.knowledge.store.faiss_store'      AgentUniverse().start(config_path='/Users/llnancy/workspace/open-projects/agentUniverse/examples/sample_standard_app/config/config.toml', core_mode=True)   File "/Users/llnancy/.pyenv/versions/py3.11/lib/python3.11/site-packages/agentuniverse/base/agentuniverse.py", line 136, in start     self.__scan_and_register(self.__config_container.app_configer)   File "/Users/llnancy/.pyenv/versions/py3.11/lib/python3.11/site-packages/agentuniverse/base/agentuniverse.py", line 221, in __scan_and_register     self.__register(component_enum, component_configer_list)   File "/Users/llnancy/.pyenv/versions/py3.11/lib/python3.11/site-packages/agentuniverse/base/agentuniverse.py", line 323, in __register   
  **Post-Mortem & Fix Analysis**:
  > 这个 commit 9e780ad 修复了该问题，我 git clone 仓库时还没有这个 commit.

- **Issue #430** (2025-08-07): ** No module named 'sample_standard_app'**
  *Symptoms*: ### Version  verion 0.0.18  ### System  win10  problems:  when I run the demo  in [https://github.com/agentuniverse-ai/agentUniverse/blob/master/docs/guidebook/zh/%E5%BC%80%E5%A7%8B%E4%BD%BF%E7%94%A8/2.%E8%BF%90%E8%A1%8C%E7%AC%AC%E4%B8%80%E4%B8%AA%E6%95%99%E7%A8%8B%E6%A1%88%E4%BE%8B.md](url)     I met a problems:  `File "<frozen importlib._bootstrap>", line 1050, in _gcd_import   File "<frozen importlib._bootstrap>", line 1027, in _find_and_load   File "<frozen importlib._bootstrap>", line 992, in _find_and_load_unlocked   File "<frozen importlib._bootstrap>", line 241, in _call_with_frames_removed   File "<frozen importlib._bootstrap>", line 1050, in _gcd_import   File "<frozen importlib._bootstrap>", line 1027, in _find_and_load   File "<frozen importlib._bootstrap>", line 992, in _find_and_load_unlocked   File "<frozen importlib._bootstrap>", line 241, in _call_with_frames_removed   File "<frozen importlib._bootstrap>", line 1050, in _gcd_import   File "<frozen importlib._bootstrap>", line 1027, in _find_and_load   File "<frozen importlib._bootstrap>", line 1004, in _find_and_load_unlocked ModuleNotFoundError: No module named 'sample_standard_app'`       thx 
  **Post-Mortem & Fix Analysis**:
  > <img width="1295" height="502" alt="Image" src="https://github.com/user-attachments/assets/4013db66-f202-4b2f-921d-ebfe89cc4d5a" />   this is the error when I run the script: run_demo_agent.py
  > 问题定位到config.toml中的 [PACKAGE_PATH_INFO] ROOT_PACKAGE = 'sample_standard_app'   在windows下用的conda虚拟环境，这里有什么问题么
  > 一般的类vscode的IDE需要进行以下的一些设置 `{   "python.pythonPath": "/Users/jerry.zzw/miniforge3/envs/py310_v009_test/bin/python3.10",   "python.terminal.executeInFileDir": true,   "terminal.integrated.env.osx": {       "PYTHONPATH": "/Users/jerry.zzw/Documents/workspace/github/agentUniverse/",     },     "terminal.integrated.env.linux": {       "PYTHONPATH": "/Users/jerry.zzw/Documents/workspace/github/agentUniverse/",     },     "terminal.integrated.env.windows": {       "PYTHONPATH": "/Users/jerry.zzw/Documents/workspace/github/agentUniverse/",     },   "files.exclude": {         "**/__pycache__": true     } }`      经过这些设置可以正常运行

- **Issue #394** (2025-05-14): **🐞 [Bug] Mac系统下，执行pip install agentuniverse出现问题**
  *Symptoms*: ### Version  Python 3.13  ### System  Mac  ### Actions  pip install agentuniverse   ### Problem  出现了如图问题  ![Image](https://github.com/user-attachments/assets/fde5d746-45f6-4f40-8530-be41b1e51fb0)  ### Expected  _No response_  ### reproduce  _No response_
  **Post-Mortem & Fix Analysis**:
  > 已经解决要用特定的Python版本，我的版本太高了

- **Issue #389** (2025-04-30): **🐞 [Bug] 启用 gunicorn 后请求2～3次就出现报错**
  *Symptoms*: ### Version  0.0.15  ### System  Mac  ### Actions  调用 service_run 若干次：   ``` curl --location --request POST 'http://127.0.0.1:8888/service_run' \ --header 'Content-Type: application/json' \ --data-raw '{     "service_id": "todo_create_agent",     "params": {         "input": "明天你好",         "background": "今天是2025年04月29日",         "session_id":"s1"     } }' ```  ### Problem  前几次（2～5次）都正常返回，后面几次就会报错，而且报错概率很高：   ``` 2025-04-29 18:16:10.489 | ERROR    | ["trace_id": "15666e6cb2b748faa0df5477c17c99ef", "span_id": "0"] | agentuniverse.agent_serve.web.flask_server:handle_exception:214 | Traceback (most recent call last):   File "/usr/local/Caskroom/miniconda/base/envs/py310/lib/python3.10/site-packages/flask/app.py", line 1484, in full_dispatch_request     rv = self.dispatch_request()   File "/usr/local/Caskroom/miniconda/base/envs/py310/lib/python3.10/site-packages/flask/app.py", line 1469, in dispatch_request     return self.ensure_sync(self.view_functions[rule.endpoint])(**view_args)   File "/usr/local/Caskroom/miniconda/base/envs/py310/lib/python3.10/site-packages/agentuniverse/agent_serve/web/web_util.py", line 68, in wrapper     return func(*args, **kwargs)   File "/usr/local/Caskroom/miniconda/base/envs/py310/lib/python3.10/site-packages/agentuniverse/agent_serve/web/flask_server.py", line 121, in service_run     result = future.result(timeout=FlaskServerManager().sync_service_timeout)   File "/usr/local/Caskroom/miniconda/base/envs/py310/lib/python3.10/concurrent/futures/_ba
  **Post-Mortem & Fix Analysis**:
  > 该问题已在0.0.16版本中修复。
  > > 该问题已在0.0.16版本中修复。  麻烦请问升级到 0.0.16 怎么做？pyproject.toml 要改些什么东西？

- **Issue #369** (2025-06-16): **🐞 [Bug]  can you loose your version requirement for dependency modules**
  *Symptoms*: ### Version  0.0.15  ### System  windows11  ### Actions  integration agentuniverse with our running project  ### Problem  the current agentuniverse 0.0.15 requires some python module with specific version, such as tiktoken = '0.5.2' and pydantic = "~2.6.4", which conflict with our current running project. some new features we required for these modules, such as tiktoken new versions support o200k_base encoding model.  So it is quite hard to integrate and develop cross teams. After manually installed the new versions tiktoken==0.9.0 and pydantic==2.7.4, agentuniverse works fine though, so can you guys help to loose those the dependency requirement for the convince of integration with existing projects, thanks    ERROR: pip's dependency resolver does not currently take into account all the packages that are installed. This behaviour is the source of the following dependency conflicts. agentuniverse 0.0.15 requires tiktoken==0.5.2, but you have tiktoken 0.9.0 which is incompatible.  ### Expected  _No response_  ### reproduce  _No response_
  **Post-Mortem & Fix Analysis**:
  > > ### Version > 0.0.15 >  > ### System > windows11 >  > ### Actions > integration agentuniverse with our running project >  > ### Problem > the current agentuniverse 0.0.15 requires some python module with specific version, such as tiktoken = '0.5.2' and pydantic = "~2.6.4", which conflict with our current running project. some new features we required for these modules, such as tiktoken new versions support o200k_base encoding model. So it is quite hard to integrate and develop cross teams. After manually installed the new versions tiktoken==0.9.0 and pydantic==2.7.4, agentuniverse works fine though, so can you guys help to loose those the dependency requirement for the convince of integration with existing projects, thanks >  > ERROR: pip's dependency resolver does not currently take into account all the packages that are installed. This behaviour is the source of the following dependency conflicts. agentuniverse 0.0.15 requires tiktoken==0.5.2, but you have tiktoken 0.9.0 which is i
  > > ### Version > 0.0.15 >  > ### System > windows11 >  > ### Actions > integration agentuniverse with our running project >  > ### Problem > the current agentuniverse 0.0.15 requires some python module with specific version, such as tiktoken = '0.5.2' and pydantic = "~2.6.4", which conflict with our current running project. some new features we required for these modules, such as tiktoken new versions support o200k_base encoding model. So it is quite hard to integrate and develop cross teams. After manually installed the new versions tiktoken==0.9.0 and pydantic==2.7.4, agentuniverse works fine though, so can you guys help to loose those the dependency requirement for the convince of integration with existing projects, thanks >  > ERROR: pip's dependency resolver does not currently take into account all the packages that are installed. This behaviour is the source of the following dependency conflicts. agentuniverse 0.0.15 requires tiktoken==0.5.2, but you have tiktoken 0.9.0 which is i

- **Issue #337** (2025-03-03): **fix: regression test bug fixes before new release**
  *Symptoms*: **When submitting a PR, please confirm the following points and put [x] in the boxes one by one.** | **在提出pr时，请确认了以下几点，并逐一使用[x]符号确认勾选。**   **Checklist | 检查项** - [x] I have read and understood the [contributor guidelines](https://github.com/antgroup/agentUniverse/blob/master/CONTRIBUTING.md). | 我已阅读并理解[贡献者指南](https://github.com/antgroup/agentUniverse/blob/master/CONTRIBUTING_zh.md) 。 - [x] I have checked for any duplicate features related to this request and communicated with the project maintainers. | 我已检查没有与此请求重复的功能并与项目维护者进行了沟通。 - [x] I accept the suggestion of the maintainers to make changes to or close this PR. | 我接受此PR配合维护人员的建议进行修改或关闭。 - [ ] I have submitted the test files and can provide screenshots of the test results (required for feature or bug fixes) | 我已经提交了测试文件并可提供测试结果截图(功能修改、BUG修复类PR必须提供，其他按需) - [ ] I have added or modified the documentation related to this PR | 我已经添加或修改了本次pr对应的文档说明(非必要，根据实际PR内容按需添加) - [ ] I have added examples and notes if needed | 我已经添加了使用案例代码与文档说明(非必要，根据实际PR内容按需添加)  **Please fill in the specific details of this PR:** | **请详细填写本次PR的内容:**  - - -  **Please provide the path of test files and submit screenshots or files of the test results(fill in as needed):** | **请填写测试文件路径并提供测试结果截图或文件(按需填写):**  -  **Please list the names of the docs that were added or modified in this PR (fill in as needed):** | **请列出本次PR新增或修改的文档名称(按需填写):**  -

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

### Incident Patch 1: `254ecd28` (2026-07-28)
**Commit Message**: Merge pull request #834 from messere1/codex/fix-output-object-isolation

fix(agent): isolate output object mappings

**File**: `agentuniverse/agent/output_object.py` (modified, +3/-3)
```diff
@@ -9,12 +9,12 @@
 
 class OutputObject(object):
     def __init__(self, params: dict):
-        self.__params = params
-        for k, v in params.items():
+        self.__params = params.copy()
+        for k, v in self.__params.items():
             self.__dict__[k] = v
 
     def to_dict(self):
-        return self.__params
+        return self.__params.copy()
 
     def to_json_str(self):
         return json.dumps(self.__params, ensure_ascii=False)
```

**File**: `tests/test_agentuniverse/unit/agent/test_output_object.py` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+from agentuniverse.agent.output_object import OutputObject
+
+
+def test_output_object_copies_constructor_params():
+    params = {"output": "original"}
+    output_object = OutputObject(params)
+
+    params["output"] = "changed externally"
+
+    assert output_object.get_data("output") == "original"
+
+
+def test_to_dict_returns_an_independent_mapping():
+    output_object = OutputObject({"output": "original"})
+
+    exported = output_object.to_dict()
+    exported["output"] = "changed externally"
+
+    assert output_object.get_data("output") == "original"
```

---

### Incident Patch 2: `ded1e21c` (2026-07-28)
**Commit Message**: Merge pull request #833 from messere1/codex/fix-log-context-isolation

fix(context): isolate log metadata across contexts

**File**: `agentuniverse/base/context/framework_context_manager.py` (modified, +4/-8)
```diff
@@ -119,11 +119,7 @@ def clear_all_contexts(self):
         self.__context_dict.set({})
 
     def set_log_context(self, context_key: str, context_value: Any):
-        log_context = self.get_context("LOG_CONTEXT")
-        if not log_context:
-            log_context = {
-                context_key: context_value
-            }
-            self.set_context("LOG_CONTEXT", log_context)
-        else:
-            log_context[context_key] = context_value
+        current_context = self.get_context("LOG_CONTEXT")
+        log_context = current_context.copy() if isinstance(current_context, dict) else {}
+        log_context[context_key] = context_value
+        self.set_context("LOG_CONTEXT", log_context)
```

**File**: `tests/test_agentuniverse/unit/base/context/test_framework_context.py` (modified, +24/-2)
```diff
@@ -7,13 +7,14 @@
 
 import asyncio
 import queue
-import time
 import threading
+import time
+from contextvars import copy_context
 
 import pytest
 
-from agentuniverse.base.context.framework_context_manager import FrameworkContextManager
 from agentuniverse.base.context.framework_context import FrameworkContext
+from agentuniverse.base.context.framework_context_manager import FrameworkContextManager
 
 context_manager: FrameworkContextManager = FrameworkContextManager()
 
@@ -76,5 +77,26 @@ def test_set_all_contexts_returns_tokens_for_restoration():
     context_manager.clear_all_contexts()
 
 
+def test_log_context_isolated_across_copied_contexts():
+    context_manager.clear_all_contexts()
+    context_manager.set_log_context("request_id", "parent")
+    child_context = copy_context()
+
+    def update_child_context():
+        context_manager.set_log_context("worker_id", "child")
+        return context_manager.get_context("LOG_CONTEXT")
+
+    child_log_context = child_context.run(update_child_context)
+
+    assert child_log_context == {
+        "request_id": "parent",
+        "worker_id": "child",
+    }
+    assert context_manager.get_context("LOG_CONTEXT") == {
+        "request_id": "parent",
+    }
+    context_manager.clear_all_contexts()
+
+
 if __name__ == "__main__":
     pytest.main([__file__, "-s"])
```

---

### Incident Patch 3: `dc4c8a09` (2026-07-28)
**Commit Message**: Merge pull request #832 from yaodong-shen/fix-secure-archive-member-lookup

fix(tool): preserve archive member lookup names

**File**: `agentuniverse/agent/action/tool/common_tool/secure_archive_tool.py` (modified, +13/-3)
```diff
@@ -128,6 +128,7 @@ def _safe_member_name(raw: str) -> str:
         return path.as_posix().rstrip("/")
 
     def _entries(self, path: str) -> list[dict[str, Any]]:
+        """Return safe public names alongside private archive lookup names."""
         entries: list[dict[str, Any]] = []
         if self._kind(path) == "zip":
             try:
@@ -141,6 +142,7 @@ def _entries(self, path: str) -> list[dict[str, Any]]:
                         entries.append(
                             {
                                 "name": self._safe_member_name(item.filename),
+                                "_source_name": item.filename,
                                 "size": item.file_size,
                                 "compressed_size": item.compress_size,
                                 "is_dir": item.is_dir(),
@@ -157,6 +159,7 @@ def _entries(self, path: str) -> list[dict[str, Any]]:
                         entries.append(
                             {
                                 "name": self._safe_member_name(item.name),
+                                "_source_name": item.name,
                                 "size": item.size,
                                 "compressed_size": None,
                                 "is_dir": item.isdir(),
@@ -269,7 +272,14 @@ def _create(self, path: str, values: Any, overwrite: Any, compression: Any) -> d
 
     @staticmethod
     def _list(path: str, entries: list[dict[str, Any]]) -> dict[str, Any]:
-        return {"status": "success", "mode": "list", "file_path": path, "entries": entries, "entry_count": len(entries)}
+        public_entries = [{key: item[key] for key in ("name", "size", "compressed_size", "is_dir")} for item in entries]
+        return {
+            "status": "success",
+            "mode": "list",
+            "file_path": path,
+            "entries": public_entries,
+            "entry_count": len(entries),
+        }
 
     def _info(self, path: str, entries: list[dict[str, Any]]) -> dict[str, Any]:
         return {
@@ -319,7 +329,7 @@ def _extract(
                     if item["is_dir"]:
                         os.makedirs(destination, exist_ok=True)
                         continue
-                    with archive.open(item["name"]) as source:
+                    with archive.open(item["_source_name"]) as source:
                         self._atomic_copy(source, destination, item["size"])
                     extracted.append(destination)
         else:
@@ -328,7 +338,7 @@ def _extract(
                     if item["is_dir"]:
                         os.makedirs(destination, exist_ok=True)
                         continue
-                    source = archive.extractfile(item["name"])
+                    source = archive.extractfile(item["_source_name"])
                     if source is None:
                         raise ValueError(f"unable to read archive member: {item['name']}")
                     with source:
```

**File**: `tests/test_agentuniverse/unit/agent/action/tool/test_secure_archive_tool.py` (modified, +31/-0)
```diff
@@ -1,5 +1,7 @@
+import io
 import os
 import stat
+import tarfile
 import tempfile
 import unittest
 import zipfile
@@ -60,6 +62,35 @@ def test_selective_extract(self):
         self.assertEqual(len(result["output_paths"]), 1)
         self.assertFalse(os.path.exists(os.path.join(self.directory.name, "out/a.txt")))
 
+    def test_extracts_zip_member_with_backslashes(self):
+        with zipfile.ZipFile(os.path.join(self.directory.name, "windows.zip"), "w") as archive:
+            archive.writestr("nested\\file.txt", b"payload")
+
+        listed = self.tool.execute(mode="list", file_path="windows.zip")
+        self.assertEqual(listed["status"], "success")
+        self.assertEqual(listed["entries"][0]["name"], "nested/file.txt")
+        self.assertEqual(
+            set(listed["entries"][0]),
+            {"name", "size", "compressed_size", "is_dir"},
+        )
+
+        result = self.tool.execute(mode="extract", file_path="windows.zip", output_dir="windows-out")
+        self.assertEqual(result["status"], "success")
+        with open(os.path.join(self.directory.name, "windows-out/nested/file.txt"), "rb") as stream:
+            self.assertEqual(stream.read(), b"payload")
+
+    def test_extracts_tar_member_with_backslashes(self):
+        payload = b"payload"
+        with tarfile.open(os.path.join(self.directory.name, "windows.tar"), "w") as archive:
+            info = tarfile.TarInfo("nested\\file.txt")
+            info.size = len(payload)
+            archive.addfile(info, io.BytesIO(payload))
+
+        result = self.tool.execute(mode="extract", file_path="windows.tar", output_dir="tar-windows-out")
+        self.assertEqual(result["status"], "success")
+        with open(os.path.join(self.directory.name, "tar-windows-out/nested/file.txt"), "rb") as stream:
+            self.assertEqual(stream.read(), payload)
+
     def test_create_refuses_overwrite(self):
         self.tool.execute(mode="create", file_path="bundle.zip", input_paths=["a.txt"])
         result = self.tool.execute(mode="create", file_path="bundle.zip", input_paths=["nested/b.txt"])
```

---

### Incident Patch 4: `15ef9238` (2026-07-28)
**Commit Message**: Merge pull request #830 from messere1/fix/store-init-bugs

fix(store): fix init bugs in MilvusStore, ChromaStore, and FAISSStore

**File**: `agentuniverse/agent/action/knowledge/store/chroma_store.py` (modified, +9/-3)
```diff
@@ -41,20 +41,26 @@ class ChromaStore(Store):
 
     def _new_client(self) -> Any:
         """Initialize the chroma client."""
-        if self.persist_path.startswith('http') or \
-                self.persist_path.startswith('https'):
+        if self.persist_path and (
+            self.persist_path.startswith('http') or
+            self.persist_path.startswith('https')
+        ):
             # Remote database URL
             parsed_url = urlparse(self.persist_path)
             settings = Settings(
                 chroma_api_impl="chromadb.api.fastapi.FastAPI",
                 chroma_server_host=parsed_url.hostname,
                 chroma_server_http_port=str(parsed_url.port)
             )
-        else:
+        elif self.persist_path:
+            # Local persistent database
             settings = Settings(
                 is_persistent=True,
                 persist_directory=self.persist_path
             )
+        else:
+            # In-memory only (no persistence path configured)
+            settings = Settings()
 
         client = chromadb.Client(settings)
         if self.collection is None:
```

**File**: `agentuniverse/agent/action/knowledge/store/faiss_store.py` (modified, +18/-9)
```diff
@@ -17,6 +17,11 @@
 from agentuniverse.agent.action.knowledge.store.store import Store
 from agentuniverse.base.config.component_configer.component_configer import ComponentConfiger
 
+# Module-level placeholders for optional dependencies; populated lazily
+# by _new_client so that importing this module never requires faiss/numpy.
+faiss = None
+np = None
+
 # Default configuration for FAISS index types
 DEFAULT_INDEX_CONFIG = {
     "index_type": "IndexFlatL2",
@@ -72,15 +77,19 @@ def __init__(self, **kwargs):
 
     def _new_client(self) -> Any:
         """Initialize the FAISS index and load existing data if available."""
-        try:
-            import faiss
-            import numpy as np
-        except ImportError as e:
-            FAISS_NOT_INSTALLED_MSG = (
-                "FAISS is not installed. Please install it with 'pip install faiss-cpu' "
-                "for CPU version or 'pip install faiss-gpu' for GPU version."
-            )
-            raise ImportError(FAISS_NOT_INSTALLED_MSG) from e
+        global faiss, np
+        if faiss is None or np is None:
+            try:
+                import faiss as _faiss
+                import numpy as _np
+            except ImportError as e:
+                FAISS_NOT_INSTALLED_MSG = (
+                    "FAISS is not installed. Please install it with 'pip install faiss-cpu' "
+                    "for CPU version or 'pip install faiss-gpu' for GPU version."
+                )
+                raise ImportError(FAISS_NOT_INSTALLED_MSG) from e
+            faiss = _faiss
+            np = _np
         self._load_index_and_metadata()
         return self.faiss_index
 
```

**File**: `agentuniverse/agent/action/knowledge/store/milvus_store.py` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ def _initialize_by_component_configer(self,
         if hasattr(milvus_store_configer, "similarity_top_k"):
             self.similarity_top_k = milvus_store_configer.similarity_top_k
         if hasattr(milvus_store_configer, "query_embedding"):
-            self.similarity_top_k = milvus_store_configer.query_embedding
+            self.query_embedding = milvus_store_configer.query_embedding
         return self
 
     def _create_or_load_collection(self,
```

**File**: `tests/test_agentuniverse/unit/agent/action/knowledge/store/test_store_init_fixes.py` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+# !/usr/bin/env python3
+# -*- coding:utf-8 -*-
+
+"""Unit tests for store initialization bug fixes.
+
+Covers three critical bugs:
+1. MilvusStore: query_embedding config was assigned to similarity_top_k (typo)
+2. ChromaStore: _new_client crashed with AttributeError when persist_path=None
+3. FAISSStore: faiss/np module-level names were not set by lazy import in _new_client
+"""
+
+import unittest
+from unittest.mock import MagicMock, patch
+
+# ------------------------------------------------------------------ #
+# Detect optional dependencies
+# ------------------------------------------------------------------ #
+try:
+    import chromadb  # noqa: F401
+    CHROMA_AVAILABLE = True
+except ImportError:
+    CHROMA_AVAILABLE = False
+
+try:
+    import pymilvus  # noqa: F401
+    PYMILVUS_AVAILABLE = True
+except ImportError:
+    PYMILVUS_AVAILABLE = False
+
+try:
+    import faiss  # noqa: F401
+    import numpy as np  # noqa: F401
+    FAISS_AVAILABLE = True
+except ImportError:
+    FAISS_AVAILABLE = False
+
+
+# ------------------------------------------------------------------ #
+# 1. MilvusStore — query_embedding config assignment typo
+# ------------------------------------------------------------------ #
+@unittest.skipUnless(PYMILVUS_AVAILABLE, "pymilvus not available")
+class TestMilvusStoreQueryEmbeddingConfig(unittest.TestCase):
+    """Verify that query_embedding config is correctly assigned."""
+
+    def test_query_embedding_config_assigned_correctly(self):
+        """query_embedding=True should set self.query_embedding, not similarity_top_k."""
+        from agentuniverse.agent.action.knowledge.store.milvus_store import MilvusStore
+
+        store = MilvusStore()
+        configer = MagicMock()
+        configer.query_embedding = True
+        configer.similarity_top_k = 42
+
+        store._initialize_by_component_configer(configer)
+
+        # query_embedding should be True (was previously ignored due to typo)
+        self.assertTrue(store.query_embedding)
+        # similarity_top_k should remain 42, not overwritten by the boolean True
+        self.assertEqual(store.similarity_top_k, 42)
+
+    def test_query_embedding_defaults_to_false(self):
+        """When query_embedding is not in configer, default should be False."""
+        from agentuniverse.agent.action.knowledge.store.milvus_store import MilvusStore
+
+        store = MilvusStore()
+        configer = MagicMock()
+        # Don't set query_embedding attribute → hasattr returns False
+        del configer.query_embedding
+
+        store._initialize_by_component_configer(configer)
+
+        self.assertFalse(store.query_embedding)
+
+
+# ------------------------------------------------------------------ #
+# 2. ChromaStore — persist_path=None guard
+# ------------------------------------------------------------------ #
+@unittest.skipUnless(CHROMA_AVAILABLE, "chromadb not available")
+class TestChromaStorePersistPathNone(unittest.TestCase):
+    """Verify that _new_client handles persist_path=None gracefully."""
+
+    def test_new_client_with_none_persist_path(self):
+        """_new_client should not crash with AttributeError when persist_path is None."""
+        from agentuniverse.agent.action.knowledge.store.chroma_store import ChromaStore
+
+        store = ChromaStore(persist_path=None)
+        # This should not raise AttributeError: 'NoneType' object has no attribute 'startswith'
+        try:
+            client = store._new_client()
+            self.assertIsNotNone(client)
+        except AttributeError as e:
+            if "'NoneType'" in str(e) and "startswith" in str(e):
+                self.fail(f"_new_client crashed on persist_path=None: {e}")
+            raise  # re-raise if it's a different AttributeError
+
+
+# ------------------------------------------------------------------ #
+# 3. FAISSStore — module-level faiss/np after _new_client
+# ------------------------------------------------------------------ #
+@unittest.skipUnless(FAISS_AVAILABLE, "faiss not available")
+class TestFAISSStoreImportScope(unittest.TestCase):
+    """Verify that faiss and np are accessible at module level after _new_client."""
+
+    def test_new_client_populates_module_level_imports(self):
+        """After _new_client, faiss and np should be available at module level."""
+        import agentuniverse.agent.action.knowledge.store.faiss_store as faiss_module
+
+        store = faiss_module.FAISSStore(
+            index_path=None,
+            metadata_path=None,
+        )
+        store._new_client()
+
+        # faiss and np should now be set at module level
+        self.assertIsNotNone(faiss_module.faiss, "module-level faiss should be populated")
+        self.assertIsNotNone(faiss_module.np, "module-level np should be populated")
+
+    def test_create_faiss_index_uses_module_level_faiss(self):
+        """_create_faiss_index should not raise NameError after _new_client."""
+        import agent
```

---

### Incident Patch 5: `cd88a43c` (2026-07-28)
**Commit Message**: Merge pull request #705 from messere1/codex/fix-async-agent-trace-chain

fix(trace): preserve parent chain for async agents

**File**: `agentuniverse/base/annotation/trace.py` (modified, +0/-1)
```diff
@@ -209,7 +209,6 @@ async def _default_agent_wrapper_async(func, *args, **kwargs):
                                                          result,
                                                          start_info,
                                                          pair_id)
-        Monitor.pop_invocation_chain()
         return result
 
 
```

**File**: `tests/test_agentuniverse/unit/base/annotation/test_trace.py` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+import asyncio
+import importlib
+
+from agentuniverse.base.context.framework_context_manager import FrameworkContextManager
+
+
+class _StubConversationMemoryModule:
+    def add_agent_input_info(self, *args, **kwargs):
+        pass
+
+    def add_agent_result_info(self, *args, **kwargs):
+        pass
+
+
+class _StubAgent:
+    agent_model = None
+
+
+async def _run_agent(self, **kwargs):
+    return "done"
+
+
+def test_async_agent_wrapper_restores_parent_invocation_chain(monkeypatch):
+    trace_module = importlib.import_module("agentuniverse.base.annotation.trace")
+    monkeypatch.setattr(
+        trace_module,
+        "ConversationMemoryModule",
+        _StubConversationMemoryModule,
+    )
+
+    async def run_in_parent_context():
+        context_manager = FrameworkContextManager()
+        context_manager.clear_all_contexts()
+        parent = {"source": "parent-agent", "type": "agent"}
+        trace_module.Monitor.init_invocation_chain()
+        trace_module.Monitor.add_invocation_chain(parent)
+
+        try:
+            result = await trace_module._default_agent_wrapper_async(
+                _run_agent,
+                _StubAgent(),
+            )
+
+            assert result == "done"
+            assert trace_module.Monitor.get_invocation_chain() == [parent]
+        finally:
+            trace_module.Monitor.clear_invocation_chain()
+            context_manager.clear_all_contexts()
+
+    asyncio.run(run_in_parent_context())
```

---

### Incident Patch 6: `88b66fad` (2026-07-28)
**Commit Message**: Merge pull request #704 from messere1/codex/fix-monitor-input-mutation

fix(monitor): preserve LLM inputs during token counting

**File**: `agentuniverse/base/util/monitor/monitor.py` (modified, +1/-1)
```diff
@@ -291,7 +291,7 @@ def get_llm_token_usage(llm_obj: object, llm_input: dict, output: LLMOutput) ->
 
             if llm_obj is None or llm_input is None:
                 return {}
-            messages = llm_input.get('kwargs', {}).pop('messages', None)
+            messages = llm_input.get('kwargs', {}).get('messages')
 
             input_str = ''
             if messages is not None and isinstance(messages, list):
```

**File**: `tests/test_agentuniverse/unit/base/util/monitor/test_monitor.py` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+from copy import deepcopy
+
+from agentuniverse.base.util.monitor.monitor import Monitor
+from agentuniverse.llm.llm_output import LLMOutput
+
+
+class _StubLLM:
+    @staticmethod
+    def get_num_tokens(text: str) -> int:
+        return len(text)
+
+
+def test_get_llm_token_usage_preserves_llm_input():
+    llm_input = {
+        "kwargs": {
+            "messages": [
+                {"role": "user", "content": "hello"},
+            ]
+        }
+    }
+    original_input = deepcopy(llm_input)
+
+    usage = Monitor.get_llm_token_usage(
+        _StubLLM(),
+        llm_input,
+        LLMOutput(text="response"),
+    )
+
+    assert usage["total_tokens"] > 0
+    assert llm_input == original_input
```

---

### Incident Patch 7: `729b08a5` (2026-07-28)
**Commit Message**: fix(agent): isolate output object mappings

**File**: `agentuniverse/agent/output_object.py` (modified, +3/-3)
```diff
@@ -9,12 +9,12 @@
 
 class OutputObject(object):
     def __init__(self, params: dict):
-        self.__params = params
-        for k, v in params.items():
+        self.__params = params.copy()
+        for k, v in self.__params.items():
             self.__dict__[k] = v
 
     def to_dict(self):
-        return self.__params
+        return self.__params.copy()
 
     def to_json_str(self):
         return json.dumps(self.__params, ensure_ascii=False)
```

**File**: `tests/test_agentuniverse/unit/agent/test_output_object.py` (added, +19/-0)
```diff
@@ -0,0 +1,19 @@
+from agentuniverse.agent.output_object import OutputObject
+
+
+def test_output_object_copies_constructor_params():
+    params = {"output": "original"}
+    output_object = OutputObject(params)
+
+    params["output"] = "changed externally"
+
+    assert output_object.get_data("output") == "original"
+
+
+def test_to_dict_returns_an_independent_mapping():
+    output_object = OutputObject({"output": "original"})
+
+    exported = output_object.to_dict()
+    exported["output"] = "changed externally"
+
+    assert output_object.get_data("output") == "original"
```

---

### Incident Patch 8: `e3f21ad2` (2026-07-28)
**Commit Message**: fix(context): isolate log metadata across contexts

**File**: `agentuniverse/base/context/framework_context_manager.py` (modified, +4/-8)
```diff
@@ -119,11 +119,7 @@ def clear_all_contexts(self):
         self.__context_dict.set({})
 
     def set_log_context(self, context_key: str, context_value: Any):
-        log_context = self.get_context("LOG_CONTEXT")
-        if not log_context:
-            log_context = {
-                context_key: context_value
-            }
-            self.set_context("LOG_CONTEXT", log_context)
-        else:
-            log_context[context_key] = context_value
+        current_context = self.get_context("LOG_CONTEXT")
+        log_context = current_context.copy() if isinstance(current_context, dict) else {}
+        log_context[context_key] = context_value
+        self.set_context("LOG_CONTEXT", log_context)
```

**File**: `tests/test_agentuniverse/unit/base/context/test_framework_context.py` (modified, +24/-2)
```diff
@@ -7,13 +7,14 @@
 
 import asyncio
 import queue
-import time
 import threading
+import time
+from contextvars import copy_context
 
 import pytest
 
-from agentuniverse.base.context.framework_context_manager import FrameworkContextManager
 from agentuniverse.base.context.framework_context import FrameworkContext
+from agentuniverse.base.context.framework_context_manager import FrameworkContextManager
 
 context_manager: FrameworkContextManager = FrameworkContextManager()
 
@@ -76,5 +77,26 @@ def test_set_all_contexts_returns_tokens_for_restoration():
     context_manager.clear_all_contexts()
 
 
+def test_log_context_isolated_across_copied_contexts():
+    context_manager.clear_all_contexts()
+    context_manager.set_log_context("request_id", "parent")
+    child_context = copy_context()
+
+    def update_child_context():
+        context_manager.set_log_context("worker_id", "child")
+        return context_manager.get_context("LOG_CONTEXT")
+
+    child_log_context = child_context.run(update_child_context)
+
+    assert child_log_context == {
+        "request_id": "parent",
+        "worker_id": "child",
+    }
+    assert context_manager.get_context("LOG_CONTEXT") == {
+        "request_id": "parent",
+    }
+    context_manager.clear_all_contexts()
+
+
 if __name__ == "__main__":
     pytest.main([__file__, "-s"])
```

---

### Incident Patch 9: `b07b55b4` (2026-07-27)
**Commit Message**: fix: preserve archive member lookup names

**File**: `agentuniverse/agent/action/tool/common_tool/secure_archive_tool.py` (modified, +13/-3)
```diff
@@ -128,6 +128,7 @@ def _safe_member_name(raw: str) -> str:
         return path.as_posix().rstrip("/")
 
     def _entries(self, path: str) -> list[dict[str, Any]]:
+        """Return safe public names alongside private archive lookup names."""
         entries: list[dict[str, Any]] = []
         if self._kind(path) == "zip":
             try:
@@ -141,6 +142,7 @@ def _entries(self, path: str) -> list[dict[str, Any]]:
                         entries.append(
                             {
                                 "name": self._safe_member_name(item.filename),
+                                "_source_name": item.filename,
                                 "size": item.file_size,
                                 "compressed_size": item.compress_size,
                                 "is_dir": item.is_dir(),
@@ -157,6 +159,7 @@ def _entries(self, path: str) -> list[dict[str, Any]]:
                         entries.append(
                             {
                                 "name": self._safe_member_name(item.name),
+                                "_source_name": item.name,
                                 "size": item.size,
                                 "compressed_size": None,
                                 "is_dir": item.isdir(),
@@ -269,7 +272,14 @@ def _create(self, path: str, values: Any, overwrite: Any, compression: Any) -> d
 
     @staticmethod
     def _list(path: str, entries: list[dict[str, Any]]) -> dict[str, Any]:
-        return {"status": "success", "mode": "list", "file_path": path, "entries": entries, "entry_count": len(entries)}
+        public_entries = [{key: item[key] for key in ("name", "size", "compressed_size", "is_dir")} for item in entries]
+        return {
+            "status": "success",
+            "mode": "list",
+            "file_path": path,
+            "entries": public_entries,
+            "entry_count": len(entries),
+        }
 
     def _info(self, path: str, entries: list[dict[str, Any]]) -> dict[str, Any]:
         return {
@@ -319,7 +329,7 @@ def _extract(
                     if item["is_dir"]:
                         os.makedirs(destination, exist_ok=True)
                         continue
-                    with archive.open(item["name"]) as source:
+                    with archive.open(item["_source_name"]) as source:
                         self._atomic_copy(source, destination, item["size"])
                     extracted.append(destination)
         else:
@@ -328,7 +338,7 @@ def _extract(
                     if item["is_dir"]:
                         os.makedirs(destination, exist_ok=True)
                         continue
-                    source = archive.extractfile(item["name"])
+                    source = archive.extractfile(item["_source_name"])
                     if source is None:
                         raise ValueError(f"unable to read archive member: {item['name']}")
                     with source:
```

**File**: `tests/test_agentuniverse/unit/agent/action/tool/test_secure_archive_tool.py` (modified, +31/-0)
```diff
@@ -1,5 +1,7 @@
+import io
 import os
 import stat
+import tarfile
 import tempfile
 import unittest
 import zipfile
@@ -60,6 +62,35 @@ def test_selective_extract(self):
         self.assertEqual(len(result["output_paths"]), 1)
         self.assertFalse(os.path.exists(os.path.join(self.directory.name, "out/a.txt")))
 
+    def test_extracts_zip_member_with_backslashes(self):
+        with zipfile.ZipFile(os.path.join(self.directory.name, "windows.zip"), "w") as archive:
+            archive.writestr("nested\\file.txt", b"payload")
+
+        listed = self.tool.execute(mode="list", file_path="windows.zip")
+        self.assertEqual(listed["status"], "success")
+        self.assertEqual(listed["entries"][0]["name"], "nested/file.txt")
+        self.assertEqual(
+            set(listed["entries"][0]),
+            {"name", "size", "compressed_size", "is_dir"},
+        )
+
+        result = self.tool.execute(mode="extract", file_path="windows.zip", output_dir="windows-out")
+        self.assertEqual(result["status"], "success")
+        with open(os.path.join(self.directory.name, "windows-out/nested/file.txt"), "rb") as stream:
+            self.assertEqual(stream.read(), b"payload")
+
+    def test_extracts_tar_member_with_backslashes(self):
+        payload = b"payload"
+        with tarfile.open(os.path.join(self.directory.name, "windows.tar"), "w") as archive:
+            info = tarfile.TarInfo("nested\\file.txt")
+            info.size = len(payload)
+            archive.addfile(info, io.BytesIO(payload))
+
+        result = self.tool.execute(mode="extract", file_path="windows.tar", output_dir="tar-windows-out")
+        self.assertEqual(result["status"], "success")
+        with open(os.path.join(self.directory.name, "tar-windows-out/nested/file.txt"), "rb") as stream:
+            self.assertEqual(stream.read(), payload)
+
     def test_create_refuses_overwrite(self):
         self.tool.execute(mode="create", file_path="bundle.zip", input_paths=["a.txt"])
         result = self.tool.execute(mode="create", file_path="bundle.zip", input_paths=["nested/b.txt"])
```

---

### Incident Patch 10: `91e2e1ba` (2026-07-26)
**Commit Message**: fix(store): fix init bugs in MilvusStore, ChromaStore, and FAISSStore

- MilvusStore: fix typo that assigned query_embedding config to
  similarity_top_k instead of query_embedding (L95)
- ChromaStore: add None guard for persist_path in _new_client to
  prevent AttributeError when persist_path is not configured
- FAISSStore: fix import scope so faiss and numpy are assigned to
  module-level variables, preventing NameError in methods outside
  _new_client that reference them

Signed-off-by: 123123213weqw <[REDACTED_EMAIL]>
Signed-off-by: messere1 <[REDACTED_EMAIL]>

**File**: `agentuniverse/agent/action/knowledge/store/chroma_store.py` (modified, +9/-3)
```diff
@@ -41,20 +41,26 @@ class ChromaStore(Store):
 
     def _new_client(self) -> Any:
         """Initialize the chroma client."""
-        if self.persist_path.startswith('http') or \
-                self.persist_path.startswith('https'):
+        if self.persist_path and (
+            self.persist_path.startswith('http') or
+            self.persist_path.startswith('https')
+        ):
             # Remote database URL
             parsed_url = urlparse(self.persist_path)
             settings = Settings(
                 chroma_api_impl="chromadb.api.fastapi.FastAPI",
                 chroma_server_host=parsed_url.hostname,
                 chroma_server_http_port=str(parsed_url.port)
             )
-        else:
+        elif self.persist_path:
+            # Local persistent database
             settings = Settings(
                 is_persistent=True,
                 persist_directory=self.persist_path
             )
+        else:
+            # In-memory only (no persistence path configured)
+            settings = Settings()
 
         client = chromadb.Client(settings)
         if self.collection is None:
```

**File**: `agentuniverse/agent/action/knowledge/store/faiss_store.py` (modified, +18/-9)
```diff
@@ -17,6 +17,11 @@
 from agentuniverse.agent.action.knowledge.store.store import Store
 from agentuniverse.base.config.component_configer.component_configer import ComponentConfiger
 
+# Module-level placeholders for optional dependencies; populated lazily
+# by _new_client so that importing this module never requires faiss/numpy.
+faiss = None
+np = None
+
 # Default configuration for FAISS index types
 DEFAULT_INDEX_CONFIG = {
     "index_type": "IndexFlatL2",
@@ -72,15 +77,19 @@ def __init__(self, **kwargs):
 
     def _new_client(self) -> Any:
         """Initialize the FAISS index and load existing data if available."""
-        try:
-            import faiss
-            import numpy as np
-        except ImportError as e:
-            FAISS_NOT_INSTALLED_MSG = (
-                "FAISS is not installed. Please install it with 'pip install faiss-cpu' "
-                "for CPU version or 'pip install faiss-gpu' for GPU version."
-            )
-            raise ImportError(FAISS_NOT_INSTALLED_MSG) from e
+        global faiss, np
+        if faiss is None or np is None:
+            try:
+                import faiss as _faiss
+                import numpy as _np
+            except ImportError as e:
+                FAISS_NOT_INSTALLED_MSG = (
+                    "FAISS is not installed. Please install it with 'pip install faiss-cpu' "
+                    "for CPU version or 'pip install faiss-gpu' for GPU version."
+                )
+                raise ImportError(FAISS_NOT_INSTALLED_MSG) from e
+            faiss = _faiss
+            np = _np
         self._load_index_and_metadata()
         return self.faiss_index
 
```

**File**: `agentuniverse/agent/action/knowledge/store/milvus_store.py` (modified, +1/-1)
```diff
@@ -92,7 +92,7 @@ def _initialize_by_component_configer(self,
         if hasattr(milvus_store_configer, "similarity_top_k"):
             self.similarity_top_k = milvus_store_configer.similarity_top_k
         if hasattr(milvus_store_configer, "query_embedding"):
-            self.similarity_top_k = milvus_store_configer.query_embedding
+            self.query_embedding = milvus_store_configer.query_embedding
         return self
 
     def _create_or_load_collection(self,
```

**File**: `tests/test_agentuniverse/unit/agent/action/knowledge/store/test_store_init_fixes.py` (added, +134/-0)
```diff
@@ -0,0 +1,134 @@
+# !/usr/bin/env python3
+# -*- coding:utf-8 -*-
+
+"""Unit tests for store initialization bug fixes.
+
+Covers three critical bugs:
+1. MilvusStore: query_embedding config was assigned to similarity_top_k (typo)
+2. ChromaStore: _new_client crashed with AttributeError when persist_path=None
+3. FAISSStore: faiss/np module-level names were not set by lazy import in _new_client
+"""
+
+import unittest
+from unittest.mock import MagicMock, patch
+
+# ------------------------------------------------------------------ #
+# Detect optional dependencies
+# ------------------------------------------------------------------ #
+try:
+    import chromadb  # noqa: F401
+    CHROMA_AVAILABLE = True
+except ImportError:
+    CHROMA_AVAILABLE = False
+
+try:
+    import pymilvus  # noqa: F401
+    PYMILVUS_AVAILABLE = True
+except ImportError:
+    PYMILVUS_AVAILABLE = False
+
+try:
+    import faiss  # noqa: F401
+    import numpy as np  # noqa: F401
+    FAISS_AVAILABLE = True
+except ImportError:
+    FAISS_AVAILABLE = False
+
+
+# ------------------------------------------------------------------ #
+# 1. MilvusStore — query_embedding config assignment typo
+# ------------------------------------------------------------------ #
+@unittest.skipUnless(PYMILVUS_AVAILABLE, "pymilvus not available")
+class TestMilvusStoreQueryEmbeddingConfig(unittest.TestCase):
+    """Verify that query_embedding config is correctly assigned."""
+
+    def test_query_embedding_config_assigned_correctly(self):
+        """query_embedding=True should set self.query_embedding, not similarity_top_k."""
+        from agentuniverse.agent.action.knowledge.store.milvus_store import MilvusStore
+
+        store = MilvusStore()
+        configer = MagicMock()
+        configer.query_embedding = True
+        configer.similarity_top_k = 42
+
+        store._initialize_by_component_configer(configer)
+
+        # query_embedding should be True (was previously ignored due to typo)
+        self.assertTrue(store.query_embedding)
+        # similarity_top_k should remain 42, not overwritten by the boolean True
+        self.assertEqual(store.similarity_top_k, 42)
+
+    def test_query_embedding_defaults_to_false(self):
+        """When query_embedding is not in configer, default should be False."""
+        from agentuniverse.agent.action.knowledge.store.milvus_store import MilvusStore
+
+        store = MilvusStore()
+        configer = MagicMock()
+        # Don't set query_embedding attribute → hasattr returns False
+        del configer.query_embedding
+
+        store._initialize_by_component_configer(configer)
+
+        self.assertFalse(store.query_embedding)
+
+
+# ------------------------------------------------------------------ #
+# 2. ChromaStore — persist_path=None guard
+# ------------------------------------------------------------------ #
+@unittest.skipUnless(CHROMA_AVAILABLE, "chromadb not available")
+class TestChromaStorePersistPathNone(unittest.TestCase):
+    """Verify that _new_client handles persist_path=None gracefully."""
+
+    def test_new_client_with_none_persist_path(self):
+        """_new_client should not crash with AttributeError when persist_path is None."""
+        from agentuniverse.agent.action.knowledge.store.chroma_store import ChromaStore
+
+        store = ChromaStore(persist_path=None)
+        # This should not raise AttributeError: 'NoneType' object has no attribute 'startswith'
+        try:
+            client = store._new_client()
+            self.assertIsNotNone(client)
+        except AttributeError as e:
+            if "'NoneType'" in str(e) and "startswith" in str(e):
+                self.fail(f"_new_client crashed on persist_path=None: {e}")
+            raise  # re-raise if it's a different AttributeError
+
+
+# ------------------------------------------------------------------ #
+# 3. FAISSStore — module-level faiss/np after _new_client
+# ------------------------------------------------------------------ #
+@unittest.skipUnless(FAISS_AVAILABLE, "faiss not available")
+class TestFAISSStoreImportScope(unittest.TestCase):
+    """Verify that faiss and np are accessible at module level after _new_client."""
+
+    def test_new_client_populates_module_level_imports(self):
+        """After _new_client, faiss and np should be available at module level."""
+        import agentuniverse.agent.action.knowledge.store.faiss_store as faiss_module
+
+        store = faiss_module.FAISSStore(
+            index_path=None,
+            metadata_path=None,
+        )
+        store._new_client()
+
+        # faiss and np should now be set at module level
+        self.assertIsNotNone(faiss_module.faiss, "module-level faiss should be populated")
+        self.assertIsNotNone(faiss_module.np, "module-level np should be populated")
+
+    def test_create_faiss_index_uses_module_level_faiss(self):
+        """_create_faiss_index should not raise NameError after _new_client."""
+        import agent
```

---

### Incident Patch 11: `07742d7a` (2026-07-20)
**Commit Message**: fix(trace): preserve parent chain for async agents

**File**: `agentuniverse/base/annotation/trace.py` (modified, +0/-1)
```diff
@@ -209,7 +209,6 @@ async def _default_agent_wrapper_async(func, *args, **kwargs):
                                                          result,
                                                          start_info,
                                                          pair_id)
-        Monitor.pop_invocation_chain()
         return result
 
 
```

**File**: `tests/test_agentuniverse/unit/base/annotation/test_trace.py` (added, +50/-0)
```diff
@@ -0,0 +1,50 @@
+import asyncio
+import importlib
+
+from agentuniverse.base.context.framework_context_manager import FrameworkContextManager
+
+
+class _StubConversationMemoryModule:
+    def add_agent_input_info(self, *args, **kwargs):
+        pass
+
+    def add_agent_result_info(self, *args, **kwargs):
+        pass
+
+
+class _StubAgent:
+    agent_model = None
+
+
+async def _run_agent(self, **kwargs):
+    return "done"
+
+
+def test_async_agent_wrapper_restores_parent_invocation_chain(monkeypatch):
+    trace_module = importlib.import_module("agentuniverse.base.annotation.trace")
+    monkeypatch.setattr(
+        trace_module,
+        "ConversationMemoryModule",
+        _StubConversationMemoryModule,
+    )
+
+    async def run_in_parent_context():
+        context_manager = FrameworkContextManager()
+        context_manager.clear_all_contexts()
+        parent = {"source": "parent-agent", "type": "agent"}
+        trace_module.Monitor.init_invocation_chain()
+        trace_module.Monitor.add_invocation_chain(parent)
+
+        try:
+            result = await trace_module._default_agent_wrapper_async(
+                _run_agent,
+                _StubAgent(),
+            )
+
+            assert result == "done"
+            assert trace_module.Monitor.get_invocation_chain() == [parent]
+        finally:
+            trace_module.Monitor.clear_invocation_chain()
+            context_manager.clear_all_contexts()
+
+    asyncio.run(run_in_parent_context())
```

---

### Incident Patch 12: `c8a9862f` (2026-07-20)
**Commit Message**: fix(monitor): preserve LLM inputs during token counting

**File**: `agentuniverse/base/util/monitor/monitor.py` (modified, +1/-1)
```diff
@@ -291,7 +291,7 @@ def get_llm_token_usage(llm_obj: object, llm_input: dict, output: LLMOutput) ->
 
             if llm_obj is None or llm_input is None:
                 return {}
-            messages = llm_input.get('kwargs', {}).pop('messages', None)
+            messages = llm_input.get('kwargs', {}).get('messages')
 
             input_str = ''
             if messages is not None and isinstance(messages, list):
```

**File**: `tests/test_agentuniverse/unit/base/util/monitor/test_monitor.py` (added, +30/-0)
```diff
@@ -0,0 +1,30 @@
+from copy import deepcopy
+
+from agentuniverse.base.util.monitor.monitor import Monitor
+from agentuniverse.llm.llm_output import LLMOutput
+
+
+class _StubLLM:
+    @staticmethod
+    def get_num_tokens(text: str) -> int:
+        return len(text)
+
+
+def test_get_llm_token_usage_preserves_llm_input():
+    llm_input = {
+        "kwargs": {
+            "messages": [
+                {"role": "user", "content": "hello"},
+            ]
+        }
+    }
+    original_input = deepcopy(llm_input)
+
+    usage = Monitor.get_llm_token_usage(
+        _StubLLM(),
+        llm_input,
+        LLMOutput(text="response"),
+    )
+
+    assert usage["total_tokens"] > 0
+    assert llm_input == original_input
```

---

### Incident Patch 13: `b9190690` (2026-07-20)
**Commit Message**: Merge pull request #665 from 123123213weqw/fix/agent-invoke-tools-error-isolation

fix(agent): isolate per-tool failures instead of swallowing or crashing

**File**: `agentuniverse/agent/agent.py` (modified, +17/-4)
```diff
@@ -399,8 +399,14 @@ def invoke_tools(self, input_object: InputObject, **kwargs) -> str:
             try:
                 tool_input = {key: input_object.get_data(key) for key in tool.input_keys}
                 tool_results.append(str(tool.run(**tool_input)))
-            except:
-                LOGGER.warn(f'Tool {tool_name} call failed, maybe invalid or lack arguments')
+            except Exception as e:
+                # A failed tool is logged with the full exception for operators,
+                # but the downstream agent only sees a stable, non-sensitive
+                # marker so a partial execution cannot look like a complete
+                # success. The marker is per-tool so ordering of mixed
+                # success/failure results is preserved.
+                LOGGER.warn(f'Tool {tool_name} call failed: {e}')
+                tool_results.append(f'[tool {tool_name} failed]')
         return "\n\n".join(tool_results)
 
     async def async_invoke_tools(self, input_object: InputObject, **kwargs) -> str:
@@ -412,8 +418,15 @@ async def async_invoke_tools(self, input_object: InputObject, **kwargs) -> str:
             tool: Tool = ToolManager().get_instance_obj(tool_name)
             if tool is None:
                 continue
-            tool_input = {key: input_object.get_data(key) for key in tool.input_keys}
-            tool_results.append(await tool.async_run(**tool_input))
+            try:
+                tool_input = {key: input_object.get_data(key) for key in tool.input_keys}
+                tool_results.append(str(await tool.async_run(**tool_input)))
+            except Exception as e:
+                # See invoke_tools: log the full exception, surface only a stable
+                # per-tool marker to the downstream agent so partial execution
+                # cannot be mistaken for a complete success.
+                LOGGER.warn(f'Tool {tool_name} call failed: {e}')
+                tool_results.append(f'[tool {tool_name} failed]')
         return "\n\n".join(tool_results)
 
     def invoke_knowledge(self, query_str: str, input_object: InputObject, **kwargs) -> str:
```

**File**: `tests/test_agentuniverse/unit/agent/test_agent.py` (modified, +115/-0)
```diff
@@ -1,4 +1,7 @@
+import asyncio
+import unittest
 from copy import deepcopy
+from unittest.mock import patch
 
 from agentuniverse.agent.agent import Agent
 from agentuniverse.agent.agent_model import AgentModel
@@ -43,6 +46,118 @@ def test_process_prompt_preserves_agent_input_for_repeated_calls():
     assert first_prompt.messages == second_prompt.messages
 
 
+class TestInvokeToolsErrorIsolation(unittest.TestCase):
+    """A failing tool must not abort the whole tool invocation loop.
+
+    The failure is preserved as an explicit, per-tool marker in the returned
+    string so a partial execution cannot look like a complete success to the
+    downstream agent; the raw exception (which may carry sensitive detail)
+    stays in the operator-facing log.
+    """
+
+    @staticmethod
+    def _make_tools():
+        from agentuniverse.agent.action.tool.tool import Tool
+
+        # The tool's NAME is "failing_tool"; the exception MESSAGE is the
+        # sensitive token "secret_token_value" so the leak test can tell them
+        # apart and assert only the name (not the exception) reaches the agent.
+        class _FailingTool(Tool):
+            def execute(self, *args, **kwargs):
+                raise RuntimeError("secret_token_value leaked")
+
+            def run(self, **kwargs):
+                raise RuntimeError("secret_token_value leaked")
+
+            async def async_run(self, **kwargs):
+                raise RuntimeError("secret_token_value leaked")
+
+        class _OkTool(Tool):
+            def execute(self, *args, **kwargs):
+                return "ok"
+
+            def run(self, **kwargs):
+                return "ok"
+
+            async def async_run(self, **kwargs):
+                return "ok"
+
+        return {
+            "failing_tool": _FailingTool(input_keys=[]),
+            "ok": _OkTool(input_keys=[]),
+        }
+
+    def test_failing_tool_leaves_marker_and_others_still_run(self):
+        tools = self._make_tools()
+        with patch("agentuniverse.agent.agent.ToolManager") as mgr:
+            mgr.return_value.get_instance_obj.side_effect = lambda name: tools.get(name)
+            agent = _StubAgent()
+            result = agent.invoke_tools(
+                InputObject({}), tool_names=["ok", "failing_tool", "ok"]
+            )
+
+        # The failing tool is replaced by a stable per-tool marker, in order, so
+        # the downstream agent can tell this was a partial execution rather than
+        # a clean "ok\n\nok".
+        self.assertEqual(result, "ok\n\n[tool failing_tool failed]\n\nok")
+
+    def test_failed_tool_marker_does_not_leak_exception_detail(self):
+        tools = self._make_tools()
+        with patch("agentuniverse.agent.agent.ToolManager") as mgr:
+            mgr.return_value.get_instance_obj.side_effect = lambda name: tools.get(name)
+            agent = _StubAgent()
+            result = agent.invoke_tools(InputObject({}), tool_names=["failing_tool"])
+
+        # The exception message and type must not reach the downstream agent;
+        # only the stable, tool-named marker is visible.
+        self.assertEqual(result, "[tool failing_tool failed]")
+        self.assertNotIn("secret_token_value", result)
+        self.assertNotIn("RuntimeError", result)
+
+    def test_mixed_success_failure_ordering_is_preserved(self):
+        tools = self._make_tools()
+        with patch("agentuniverse.agent.agent.ToolManager") as mgr:
+            mgr.return_value.get_instance_obj.side_effect = lambda name: tools.get(name)
+            agent = _StubAgent()
+            # failing first, then ok, then failing again — output order must match.
+            result = agent.invoke_tools(
+                InputObject({}), tool_names=["failing_tool", "ok", "failing_tool"]
+            )
+        self.assertEqual(
+            result, "[tool failing_tool failed]\n\nok\n\n[tool failing_tool failed]"
+        )
+
+    def test_async_failing_tool_leaves_marker_and_others_still_run(self):
+        tools = self._make_tools()
+        with patch("agentuniverse.agent.agent.ToolManager") as mgr:
+            mgr.return_value.get_instance_obj.side_effect = lambda name: tools.get(name)
+            agent = _StubAgent()
+            result = asyncio.new_event_loop().run_until_complete(
+                agent.async_invoke_tools(
+                    InputObject({}), tool_names=["ok", "failing_tool", "ok"]
+                )
+            )
+
+        # Same contract as the sync path: failing tool is a stable marker, in
+        # order, without leaking the exception detail.
+        self.assertEqual(result, "ok\n\n[tool failing_tool failed]\n\nok")
+        self.assertNotIn("secret_token_value", result)
+
+    def test_async_mixed_success_failure_ordering_is_preserved(self):
+        tools = self._make_tools()
+        with patch("agentuniverse.agent.agent.ToolManager") as mgr:
+            mgr.return_value.get_instance_obj.side_effect = lambda name: tools.get(name)
+     
```

---

### Incident Patch 14: `a9b6b353` (2026-07-20)
**Commit Message**: fix(agent): preserve per-tool failure marker in invoke_tools result

A failed tool call previously disappeared from the returned string entirely
(only a warning was logged), so a downstream agent could not tell a partial
execution from a complete success. invoke_tools and async_invoke_tools now
append a stable, per-tool marker ([tool <name> failed]) in result order, so
mixed success/failure results stay observable in the contract without leaking
sensitive exception detail (the raw exception stays in the operator log only).

Adds async_invoke_tools regression coverage that was missing: the previous
tests exercised only the sync path. New cases cover the sync and async paths
symmetrically — failing tool leaves a marker while others still run, the
marker does not leak the exception message/type, and mixed success/failure
ordering is preserved in both paths.

**File**: `agentuniverse/agent/agent.py` (modified, +10/-0)
```diff
@@ -400,7 +400,13 @@ def invoke_tools(self, input_object: InputObject, **kwargs) -> str:
                 tool_input = {key: input_object.get_data(key) for key in tool.input_keys}
                 tool_results.append(str(tool.run(**tool_input)))
             except Exception as e:
+                # A failed tool is logged with the full exception for operators,
+                # but the downstream agent only sees a stable, non-sensitive
+                # marker so a partial execution cannot look like a complete
+                # success. The marker is per-tool so ordering of mixed
+                # success/failure results is preserved.
                 LOGGER.warn(f'Tool {tool_name} call failed: {e}')
+                tool_results.append(f'[tool {tool_name} failed]')
         return "\n\n".join(tool_results)
 
     async def async_invoke_tools(self, input_object: InputObject, **kwargs) -> str:
@@ -416,7 +422,11 @@ async def async_invoke_tools(self, input_object: InputObject, **kwargs) -> str:
                 tool_input = {key: input_object.get_data(key) for key in tool.input_keys}
                 tool_results.append(str(await tool.async_run(**tool_input)))
             except Exception as e:
+                # See invoke_tools: log the full exception, surface only a stable
+                # per-tool marker to the downstream agent so partial execution
+                # cannot be mistaken for a complete success.
                 LOGGER.warn(f'Tool {tool_name} call failed: {e}')
+                tool_results.append(f'[tool {tool_name} failed]')
         return "\n\n".join(tool_results)
 
     def invoke_knowledge(self, query_str: str, input_object: InputObject, **kwargs) -> str:
```

**File**: `tests/test_agentuniverse/unit/agent/test_agent.py` (modified, +92/-9)
```diff
@@ -1,3 +1,4 @@
+import asyncio
 import unittest
 from copy import deepcopy
 from unittest.mock import patch
@@ -46,17 +47,30 @@ def test_process_prompt_preserves_agent_input_for_repeated_calls():
 
 
 class TestInvokeToolsErrorIsolation(unittest.TestCase):
-    """A failing tool must not abort the whole tool invocation loop."""
+    """A failing tool must not abort the whole tool invocation loop.
 
-    def test_failing_tool_is_skipped_and_others_still_run(self):
+    The failure is preserved as an explicit, per-tool marker in the returned
+    string so a partial execution cannot look like a complete success to the
+    downstream agent; the raw exception (which may carry sensitive detail)
+    stays in the operator-facing log.
+    """
+
+    @staticmethod
+    def _make_tools():
         from agentuniverse.agent.action.tool.tool import Tool
 
-        class _BoomTool(Tool):
+        # The tool's NAME is "failing_tool"; the exception MESSAGE is the
+        # sensitive token "secret_token_value" so the leak test can tell them
+        # apart and assert only the name (not the exception) reaches the agent.
+        class _FailingTool(Tool):
             def execute(self, *args, **kwargs):
-                raise RuntimeError("boom")
+                raise RuntimeError("secret_token_value leaked")
 
             def run(self, **kwargs):
-                raise RuntimeError("boom")
+                raise RuntimeError("secret_token_value leaked")
+
+            async def async_run(self, **kwargs):
+                raise RuntimeError("secret_token_value leaked")
 
         class _OkTool(Tool):
             def execute(self, *args, **kwargs):
@@ -65,11 +79,80 @@ def execute(self, *args, **kwargs):
             def run(self, **kwargs):
                 return "ok"
 
-        tools = {"boom": _BoomTool(input_keys=[]), "ok": _OkTool(input_keys=[])}
+            async def async_run(self, **kwargs):
+                return "ok"
+
+        return {
+            "failing_tool": _FailingTool(input_keys=[]),
+            "ok": _OkTool(input_keys=[]),
+        }
+
+    def test_failing_tool_leaves_marker_and_others_still_run(self):
+        tools = self._make_tools()
+        with patch("agentuniverse.agent.agent.ToolManager") as mgr:
+            mgr.return_value.get_instance_obj.side_effect = lambda name: tools.get(name)
+            agent = _StubAgent()
+            result = agent.invoke_tools(
+                InputObject({}), tool_names=["ok", "failing_tool", "ok"]
+            )
+
+        # The failing tool is replaced by a stable per-tool marker, in order, so
+        # the downstream agent can tell this was a partial execution rather than
+        # a clean "ok\n\nok".
+        self.assertEqual(result, "ok\n\n[tool failing_tool failed]\n\nok")
+
+    def test_failed_tool_marker_does_not_leak_exception_detail(self):
+        tools = self._make_tools()
         with patch("agentuniverse.agent.agent.ToolManager") as mgr:
             mgr.return_value.get_instance_obj.side_effect = lambda name: tools.get(name)
             agent = _StubAgent()
-            result = agent.invoke_tools(InputObject({}), tool_names=["ok", "boom", "ok"])
+            result = agent.invoke_tools(InputObject({}), tool_names=["failing_tool"])
 
-        # The failing tool was skipped; both good invocations are joined.
-        self.assertEqual(result, "ok\n\nok")
+        # The exception message and type must not reach the downstream agent;
+        # only the stable, tool-named marker is visible.
+        self.assertEqual(result, "[tool failing_tool failed]")
+        self.assertNotIn("secret_token_value", result)
+        self.assertNotIn("RuntimeError", result)
+
+    def test_mixed_success_failure_ordering_is_preserved(self):
+        tools = self._make_tools()
+        with patch("agentuniverse.agent.agent.ToolManager") as mgr:
+            mgr.return_value.get_instance_obj.side_effect = lambda name: tools.get(name)
+            agent = _StubAgent()
+            # failing first, then ok, then failing again — output order must match.
+            result = agent.invoke_tools(
+                InputObject({}), tool_names=["failing_tool", "ok", "failing_tool"]
+            )
+        self.assertEqual(
+            result, "[tool failing_tool failed]\n\nok\n\n[tool failing_tool failed]"
+        )
+
+    def test_async_failing_tool_leaves_marker_and_others_still_run(self):
+        tools = self._make_tools()
+        with patch("agentuniverse.agent.agent.ToolManager") as mgr:
+            mgr.return_value.get_instance_obj.side_effect = lambda name: tools.get(name)
+            agent = _StubAgent()
+            result = asyncio.new_event_loop().run_until_complete(
+                agent.async_invoke_tools(
+                    InputObject({}), tool_names=["ok", "failing_tool", "ok"]
+                )
+            )
+
+        # Same contract as the sync path: failing tool is a stable marker, in
+        # order, without leaking the exception
```

---

### Incident Patch 15: `6bd1d29a` (2026-07-20)
**Commit Message**: fix(tool): bound PowerPointTool read path with structural limits

The read path previously walked every slide, shape, table, row, and cell
a crafted PPTX could carry, even after max_text_chars reached zero, padding
the result with empty strings. max_table_rows and max_table_columns were
enforced only on create/append input, so a compact XML presentation could
still expand into a very large Python/JSON structure.

The read now consumes the same budgets as create/append: max_slides caps
the slide count, a new max_shapes_per_slide caps shapes per slide,
max_table_rows / max_table_columns cap each table, and max_text_chars is
the shared text budget across all of them. Once any budget is exhausted,
traversal stops short and 'truncated' is reported. A small _ReadBudget
helper owns the shared text accounting (mirrors the WordDocumentTool read
contract so both Office tools use the same bounded-read interpretation).

Adds five generated-PPTX regressions: slide-count cap, shapes-per-slide
cap, table-rows cap, table-columns cap, and combined text-budget
exhaustion with no empty-string padding.

**File**: `agentuniverse/agent/action/tool/common_tool/powerpoint_tool.py` (modified, +91/-26)
```diff
@@ -35,6 +35,7 @@ class PowerPointTool(Tool):
     max_uncompressed_bytes: int = 100 * 1024 * 1024
     max_archive_entries: int = 5_000
     max_slides: int = 100
+    max_shapes_per_slide: int = 200
     max_text_chars: int = 50_000
     max_table_rows: int = 50
     max_table_columns: int = 20
@@ -144,6 +145,7 @@ def _validate_configuration(self) -> None:
             "max_uncompressed_bytes": self.max_uncompressed_bytes,
             "max_archive_entries": self.max_archive_entries,
             "max_slides": self.max_slides,
+            "max_shapes_per_slide": self.max_shapes_per_slide,
             "max_text_chars": self.max_text_chars,
             "max_table_rows": self.max_table_rows,
             "max_table_columns": self.max_table_columns,
@@ -272,51 +274,48 @@ def _append(
             "file_size": os.path.getsize(file_path),
         }
 
-    def _read(self, file_path: str) -> dict[str, Any]:
+    def _read(self, file_path: str) -> dict[str, Any]:  # noqa: C901
         self._ensure_readable(file_path)
         Presentation, _ = self._load_pptx()
         presentation = Presentation(file_path)
         self._validate_presentation_slide_count(presentation)
 
-        remaining = self.max_text_chars
-        truncated = False
-        slide_results = []
+        # Read-side budgets mirror create/append: a compact XML presentation
+        # can still expand into a huge Python structure if every shape/table/
+        # row/cell is walked, so traversal stops the moment any budget is
+        # exhausted instead of padding the result with empty strings.
+        budget = _ReadBudget(self)
+        slide_results: list[dict[str, Any]] = []
         for slide_number, slide in enumerate(presentation.slides, start=1):
             title_shape = self._get_title_shape(slide)
-            title, remaining, was_truncated = self._bounded_text(
-                title_shape.text if title_shape is not None else "", remaining
-            )
-            truncated = truncated or was_truncated
-            texts = []
-            tables = []
+            title = budget.consume_text(title_shape.text if title_shape is not None else "")[0]
+            texts: list[str] = []
+            tables: list[list[list[str]]] = []
+            shape_count = 0
             for shape in slide.shapes:
+                if shape_count >= self.max_shapes_per_slide:
+                    budget.mark_truncated()
+                    break
                 if getattr(shape, "has_table", False):
-                    rows = []
-                    for row in shape.table.rows:
-                        output_row = []
-                        for cell in row.cells:
-                            value, remaining, cut = self._bounded_text(cell.text, remaining)
-                            truncated = truncated or cut
-                            output_row.append(value)
-                        rows.append(output_row)
-                    tables.append(rows)
+                    shape_count += 1
+                    tables.append(self._read_table(shape.table, budget))
                     continue
                 if not getattr(shape, "has_text_frame", False):
                     continue
                 if title_shape is not None and shape.shape_id == title_shape.shape_id:
                     continue
-                value, remaining, cut = self._bounded_text(shape.text, remaining)
-                truncated = truncated or cut
+                shape_count += 1
+                value = budget.consume_text(shape.text)[0]
                 if value:
                     texts.append(value)
+                if budget.chars_exhausted():
+                    budget.mark_truncated()
+                    break
 
             notes = ""
             if getattr(slide, "has_notes_slide", False):
                 notes_frame = slide.notes_slide.notes_text_frame
-                notes, remaining, cut = self._bounded_text(
-                    notes_frame.text if notes_frame is not None else "", remaining
-                )
-                truncated = truncated or cut
+                notes = budget.consume_text(notes_frame.text if notes_frame is not None else "")[0]
 
             slide_results.append(
                 {
@@ -327,17 +326,41 @@ def _read(self, file_path: str) -> dict[str, Any]:
                     "notes": notes,
                 }
             )
+            if budget.chars_exhausted():
+                break
 
         return {
             "status": "success",
             "mode": "read",
             "file_path": file_path,
             "slide_count": len(presentation.slides),
             "slides": slide_results,
-            "truncated": truncated,
+            "truncated": budget.truncated,
             "max_text_chars": self.max_text_chars,
+            "max_slides": self.max_slides,
+            "max_shapes_per_slide": self.max_shapes_per_slide,
+            "max_table_rows": self.max_table_rows,
+            "max_table_column
```

**File**: `tests/test_agentuniverse/unit/agent/action/tool/test_powerpoint_tool.py` (modified, +78/-0)
```diff
@@ -462,6 +462,84 @@ def test_template_slide_count_is_checked_before_destination_write(self) -> None:
         self.assertIn("template slides plus requested slides", result["error"])
         self.assertFalse(os.path.exists(os.path.join(self.base_dir, "from-template.pptx")))
 
+    # -- read-side structural bounds (regression for crafted PPTX expansion) --
+
+    def test_read_caps_slide_count(self) -> None:
+        # More slides than max_slides; read still succeeds but the archive
+        # guard rejects the file before parsing.
+        many_slides = [{"title": f"slide {i}"} for i in range(5)]
+        self.tool.execute(mode="create", file_path="many.pptx", slides=many_slides)
+        self.tool.max_slides = 2
+        result = self.tool.execute(mode="read", file_path="many.pptx")
+        self.assertEqual(result["error_type"], "validation_error")
+        self.assertIn("exceeding max_slides", result["error"])
+
+    def test_read_caps_shapes_per_slide(self) -> None:
+        # A slide with a body plus a table carries multiple shapes; the read
+        # must stop at max_shapes_per_slide instead of walking every shape and
+        # expanding every table cell into the result.
+        self.tool.execute(
+            mode="create",
+            file_path="shapes.pptx",
+            slides=[{"title": "t", "bullets": ["b1", "b2"], "table": [["a", "b"], ["c", "d"]]}],
+        )
+        # Lower the cap so the table shape is never reached; the read reports
+        # truncated and emits no table rows.
+        self.tool.max_shapes_per_slide = 1
+        result = self.tool.execute(mode="read", file_path="shapes.pptx")
+        self.assertEqual(result["status"], "success")
+        self.assertTrue(result["truncated"])
+        self.assertEqual(result["slides"][0]["tables"], [])
+
+    def test_read_caps_table_rows(self) -> None:
+        # A table with more rows than max_table_rows; read must stop early.
+        big_rows = [[f"r{i}c0", f"r{i}c1"] for i in range(40)]
+        self.tool.execute(
+            mode="create",
+            file_path="rows.pptx",
+            slides=[{"title": "t", "table": big_rows}],
+        )
+        self.tool.max_table_rows = 5
+        result = self.tool.execute(mode="read", file_path="rows.pptx")
+        self.assertEqual(result["status"], "success")
+        for table in result["slides"][0]["tables"]:
+            self.assertLessEqual(len(table), self.tool.max_table_rows)
+        self.assertTrue(result["truncated"])
+
+    def test_read_caps_table_columns(self) -> None:
+        # A wide table; read must stop at max_table_columns per row.
+        wide_row = [str(i) for i in range(15)]
+        self.tool.execute(
+            mode="create",
+            file_path="wide.pptx",
+            slides=[{"title": "t", "table": [wide_row, wide_row]}],
+        )
+        self.tool.max_table_columns = 4
+        result = self.tool.execute(mode="read", file_path="wide.pptx")
+        self.assertEqual(result["status"], "success")
+        for table in result["slides"][0]["tables"]:
+            for row in table:
+                self.assertLessEqual(len(row), self.tool.max_table_columns)
+        self.assertTrue(result["truncated"])
+
+    def test_read_stops_when_text_budget_exhausted(self) -> None:
+        # Once max_text_chars is consumed, the read must stop traversing rather
+        # than continuing to walk every remaining slide/shape and padding the
+        # result with empty strings.
+        slides = [{"title": f"title-{i}", "bullets": [f"body text line {i}"]} for i in range(15)]
+        self.tool.execute(mode="create", file_path="mixed.pptx", slides=slides)
+        self.tool.max_text_chars = 30
+        result = self.tool.execute(mode="read", file_path="mixed.pptx")
+        self.assertEqual(result["status"], "success")
+        self.assertTrue(result["truncated"])
+        # No empty-string padding from continued traversal after budget hit.
+        emitted = sum(
+            len(slide["title"]) + sum(len(text) for text in slide["texts"]) + len(slide["notes"])
+            for slide in result["slides"]
+        )
+        # Allow a small overshoot for the truncation ellipsis on the last field.
+        self.assertLessEqual(emitted, self.tool.max_text_chars + len(result["slides"]))
+
 
 class TestPowerPointRegistration(unittest.TestCase):
     """Load the shipped YAML through the real component pipeline."""
```

#### Recent Merged Pull Requests:
- **PR #3287** (closed): feat: add a TAR reader (default_tar_reader) for .tar/.tar.gz/.tgz knowledge ingestion (@Metastarx)
- **PR #2012** (closed): test: add unit tests for graph (@btlqql)
- **PR #1302** (closed): docs: add docstring to query in redis_vector_store.py (@123123213weqw)
- **PR #1301** (closed): docs: add docstring to get_single_embedding in ollama_embedding.py (@yyqdbngt)
- **PR #1300** (closed): docs: add docstring to batched in dashscope_embedding.py (@btlqql)
- **PR #1299** (closed): docs: add docstring to async_get_embeddings in doubao_embedding.py (@123123213weqw)
- **PR #1298** (closed): docs: add docstring to splitter in token_text_splitter.py (@yyqdbngt)
- **PR #1297** (closed): docs: add docstring to splitter in recursive_character_text_splitter.py (@btlqql)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

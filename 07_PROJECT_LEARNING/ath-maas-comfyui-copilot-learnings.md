# Forensic Learning Record (Deep Inspection): ATH-MaaS/ComfyUI-Copilot

> **Canonical Artifact**: `07_PROJECT_LEARNING/ath-maas-comfyui-copilot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ATH-MaaS/ComfyUI-Copilot](https://github.com/ATH-MaaS/ComfyUI-Copilot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-09-30T21:38:15.794Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ATH-MaaS/ComfyUI-Copilot`
- **Description**: An AI-powered custom node for ComfyUI designed to enhance workflow automation and provide intelligent assistance
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 5533 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `__init__.py`
```
'''
Author: ai-business-hql qingli.hql@alibaba-inc.com
Date: 2025-02-17 20:53:45
LastEditors: ai-business-hql ai.bussiness.hql@gmail.com
LastEditTime: 2025-11-20 20:03:20
FilePath: /comfyui_copilot/__init__.py
Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
'''
# Copyright (C) 2025 AIDC-AI
# Licensed under the MIT License.

import sys
import asyncio


# Ensure 'agents' resolves to openai-agents (not legacy RL package)
try:
    import importlib.metadata as _im
    from pathlib import Path as _Path

    try:
        _dist = _im.distribution("openai-agents")
    except _im.PackageNotFoundError:
        _dist = None

    if _dist and _dist.files:
        _init_rel = next((f for f in _dist.files if str(f).replace("\\", "/").endswith("agents/__init__.py")), None)
        if _init_rel:
            _init_path = _dist.locate_file(_init_rel)
            _agents_parent = _Path(_init_path).parent.parent
            _pp = str(_agents_parent)
            if _pp not in sys.path:
                sys.path.insert(0, _pp)

            # If an incompatible 'agents' was already imported, drop it so the correct one can load
            m = sys.modules.get("agents")
            if m is not None and not hasattr(m, "Agent"):
                sys.modules.pop("agents", None)
except Exception:
    # Fail-open: never block plugin loading if aliasing fails
    pass

import asyncio
import server
from aiohttp import web
import folder_paths
from .backend.controller.conversation_api import *
from .backend.controller.llm_api import *
from .backend.controller.expert_api import *

WEB_DIRECTORY = "entry"
NODE_CLASS_MAPPINGS = {}
__all__ = ['NODE_CLASS_MAPPINGS']
version = "V2.1.0"

workspace_path = os.path.join(os.path.dirname(__file__))
comfy_path = os.path.dirname(folder_paths.__file__)
db_dir_path = os.path.join(workspace_path, "db")

dist_path = os.path.join(workspace_path, 'dist/copilot_web')
if os.path.exists(dist_path):
    server.PromptServer.instance.app.add_routes([
        web.static('/copilot_web/', dist_path),
    ])
else:
    print(f"🦄🦄🔴🔴Error: Web directory not found: {dist_path}")

```

### Core Architecture Module: `backend/agent_factory.py`
```
'''
Author: ai-business-hql qingli.hql@alibaba-inc.com
Date: 2025-07-31 19:38:08
LastEditors: ai-business-hql ai.bussiness.hql@gmail.com
LastEditTime: 2026-01-12 11:11:53
FilePath: /comfyui_copilot/backend/agent_factory.py
Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
'''

try:
    from agents import Agent, OpenAIChatCompletionsModel, ModelSettings, Runner, set_tracing_disabled, set_default_openai_api
    if not hasattr(__import__('agents'), 'Agent'):
        raise ImportError
except Exception:
    # Give actionable guidance without crashing obscurely
    raise ImportError(
        "Detected incorrect or missing 'agents' package. "
        "Please uninstall legacy RL 'agents' (and tensorflow/gym if pulled transitively) and install openai-agents. "
        "Commands:\n"
        "  python -m pip uninstall -y agents gym tensorflow\n"
        "  python -m pip install -U openai-agents\n\n"
        "Alternatively, keep both by setting COMFYUI_COPILOT_PREFER_OPENAI_AGENTS=1 so this plugin prefers openai-agents."
    )
from dotenv import dotenv_values
from .utils.globals import LLM_DEFAULT_BASE_URL, LMSTUDIO_DEFAULT_BASE_URL, get_comfyui_copilot_api_key, is_lmstudio_url
from openai import AsyncOpenAI


from agents._config import set_default_openai_api
from agents.tracing import set_tracing_disabled
import asyncio
# from .utils.logger import log

# def load_env_config():
#     """Load environment variables from .env.llm file"""
#     from dotenv import load_dotenv

#     env_file_path = os.path.join(os.path.dirname(__file__), '.env.llm')
#     if os.path.exists(env_file_path):
#         load_dotenv(env_file_path)
#         log.info(f"Loaded environment variables from {env_file_path}")
#     else:
#         log.warning(f"Warning: .env.llm not found at {env_file_path}")


# # Load environment configuration
# load_env_config()

set_default_openai_api("chat_completions")
set_tracing_disabled(False)


def create_agent(**kwargs) -> Agent:
    # 通过用户配置拿/环境变量
    config = kwargs.pop("config") if "config" in kwargs else {}
    # 避免将 None 写入 headers
    session_id = (config or {}).get("session_id")
    default_headers = {}
    if session_id:
        default_headers["X-Session-ID"] = session_id

    # Determine base URL and API key
    base_url = LLM_DEFAULT_BASE_URL
    api_key = get_comfyui_copilot_api_key() or ""

    if config:
        if config.get("openai_base_url") and config.get("openai_base_url") != "":
            base_url = config.get("openai_base_url")
        if config.get("openai_api_key") and config.get("openai_api_key") != "":
            api_key = config.get("openai_api_key")

    # Check if this is LMStudio and adjust API key handling
    is_lmstudio = is_lmstudio_url(base_url)
    if is_lmstudio and not api_key:
        # LMStudio typically doesn't require an API key, use a placeholder
        api_key = "lmstudio-local"

    client = AsyncOpenAI(
        api_key=api_key,
        base_url=base_url,
        default_headers=default_headers,
    )

    # Determine model with proper precedence:
    # 1) Explicit selection from config (model_select from frontend)
    # 2) Explicit kwarg 'model' (call-site override)
    model_from_config = (config or {}).get("model_select")
    model_from_kwargs = kwargs.pop("model", None)

    model_name = model_from_config or model_from_kwargs or "gemini-2.5-flash"
    model = OpenAIChatCompletionsModel(model_name, openai_client=client)

    # Safety: ensure no stray 'model' remains in kwargs to avoid duplicate kwarg errors
    kwargs.pop("model", None)

    if config.get("max_tokens"):
        return Agent(model=model, model_settings=ModelSettings(max_tokens=config.get("max_tokens") or 8192), **kwargs)
    return Agent(model=model, **kwargs)
```

### Core Architecture Module: `backend/controller/conversation_api.py`
```
# Copyright (C) 2025 AIDC-AI
# Licensed under the MIT License.

import json
import asyncio
import time
from typing import Optional, TypedDict, List, Union
import threading
from collections import defaultdict

from sqlalchemy.orm import identity

from ..utils.globals import set_language, apply_llm_env_defaults
from ..utils.auth_utils import extract_and_store_api_key
import server
from aiohttp import web
import base64

# Import the MCP client function
import os
import shutil

from ..service.debug_agent import debug_workflow_errors
from ..dao.workflow_table import save_workflow_data, get_workflow_data_by_id, update_workflow_ui_by_id
from ..service.mcp_client import comfyui_agent_invoke
from ..utils.request_context import set_request_context, get_session_id
from ..utils.logger import log
from ..utils.modelscope_gateway import ModelScopeGateway
import folder_paths


def get_llm_config_from_headers(request):
    """Extract LLM-related configuration from request headers."""
    return {
        "openai_api_key": request.headers.get('Openai-Api-Key'),
        "openai_base_url": request.headers.get('Openai-Base-Url'),
        # Workflow LLM settings (optional, used by tools/agents that need a different LLM)
        "workflow_llm_api_key": request.headers.get('Workflow-LLM-Api-Key'),
        "workflow_llm_base_url": request.headers.get('Workflow-LLM-Base-Url'),
        "workflow_llm_model": request.headers.get('Workflow-LLM-Model'),
    }


# 全局下载进度存储
download_progress = {}
download_lock = threading.Lock()

# 不再使用内存存储会话消息，改为从前端传递历史消息

# 在文件开头添加
STATIC_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "public")

# Define types using TypedDict
class Node(TypedDict):
    name: str  # 节点名称
    description: str  # 节点描述
    image: str  # 节点图片url，可为空
    github_url: str  # 节点github地址
    from_index: int  # 节点在列表中的位置
    to_index: int  # 节点在列表中的位置

class NodeInfo(TypedDict):
    existing_nodes: List[Node]  # 已安装的节点
    missing_nodes: List[Node]  # 未安装的节点

class Workflow(TypedDict, total=False):
    id: Optional[int]  # 工作流id
    name: Optional[str]  # 工作流名称
    description: Optional[str]  # 工作流描述
    image: Optional[str]  # 工作流图片
    workflow: Optional[str]  # 工作流

class ExtItem(TypedDict):
    type: str  # 扩展类型
    data: Union[dict, list]  # 扩展数据

class ChatResponse(TypedDict):
    session_id: str  # 会话id
    text: Optional[str]  # 返回文本
    finished: bool  # 是否结束
    type: str  # 返回的类型
    format: str  # 返回的格式
    ext: Optional[List[ExtItem]]  # 扩展信息

# 下载进度回调类
class DownloadProgressCallback:
    def __init__(self, id: str, filename: str, file_size: int, download_id: str):
        self.id = id
        self.filename = filename
        self.file_size = file_size
        self.download_id = download_id
        self.progress = 0
        self.status = "downloading"  # downloading, completed, failed
        self.error_message = None
        self.start_time = time.time()
        
        # 初始化进度记录
        with download_lock:
            download_progress[download_id] = {
                "id": id,
                "filename": filename,
                "file_size": file_size,
                "progress": 0,
                "percentage": 0.0,
                "status": "downloading",
                "start_time": self.start_time,
                "estimated_time": None,
                "speed": 0.0,
                "error_message": None
            }

    def update(self, size: int):
        """更新下载进度"""
        self.progress += size
        current_time = time.time()
        elapsed_time = current_time - self.start_time
        
        # 计算下载速度和预估时间
        if elapsed_time > 0:
            speed = self.progress / elapsed_time  # bytes per second
            if speed > 0 and self.progress < self.file_size:
                remaining_bytes = self.file_size - self.progress
                estimated_time = remaining_bytes / speed
            else:
                estimated_time = None
        else:
            speed = 0.0
            estimated_time = None
        
        percentage = (self.progress / self.file_size) * 100 if self.file_size > 0 else 0
        
        # 更新全局进度
        with download_lock:
            if self.download_id in download_progress:
                # 直接更新字典的值，而不是调用update方法
                progress_dict = download_progress[self.download_id]
                progress_dict["progress"] = self.progress
                progress_dict["percentage"] = round(percentage, 2)
                progress_dict["speed"] = round(speed, 2)
                progress_dict["estimated_time"] = round(estimated_time, 2) if estimated_time else None

    def end(self, success: bool = True, error_message: str = None):
        """下载结束回调"""
        current_time = time.time()
        total_time = current_time - self.start_time
        
        if success:
            self.status = "completed"
            # 验证下载完整性
            assert self.progress == self.file_size, f"Download incomplete: {self.progress}/{self.file_size}"
        else:
            self.status = "failed"
            self.error_message = error_message
        
        # 更新最终状态
        with download_lock:
            if self.download_id in download_progress:
                # 直接更新字典的值，而不是调用update方法
                progress_dict = download_progress[self.download_id]
                progress_dict["status"] = self.status
                progress_dict["progress"] = self.file_size if success else self.progress
                if self.file_size > 0:
                    progress_dict["percentage"] = 100.0 if success else (self.progress / self.file_size) * 100
                else:
                    progress_dict["percentage"] = 0.0
                progress_dict["total_time"] = round(total_time, 2)
                progress_dict["error_message"] = self.error_message

    def fail(self, error_message: str):
        """下载失败回调"""
        self.end(success=False, error_message=error_message)

# 生成唯一下载ID
def generate_download_id() -> str:
    import uuid
    return str(uuid.uuid4())

async def upload_to_oss(file_data: bytes, filename: str) -> str:
    # TODO: Implement your OSS upload logic here
    # For now, save locally and return a placeholder URL
    
    try:
        # Create uploads directory if it doesn't exist
        uploads_dir = os.path.join(os.path.dirname(__file__), '..', '..', 'uploads')
        os.makedirs(uploads_dir, exist_ok=True)
        
        # Generate unique filename to avoid conflicts
        import uuid
        unique_filename = f"{uuid.uuid4().hex}_{filename}"
        file_path = os.path.join(uploads_dir, unique_filename)
        
        # Save file locally
        with open(file_path, 'wb') as f:
            f.write(file_data)
        
        # Return a local URL or base64 data URL for now
        # In production, replace this with actual OSS URL
        base64_data = base64.b64encode(file_data).decode('utf-8')
        # Determine MIME type based on file extension
        if filename.lower().endswith(('.png', '.jpg', '.jpeg', '.gif', '.webp')):
            mime_type = f"image/{filename.split('.')[-1].lower()}"
            if mime_type == "image/jpg":
                mime_type = "image/jpeg"
        else:
            mime_type = "image/jpeg"  # Default
            
        return f"data:{mime_type};base64,{base64_data}"
        
    except Exception as e:
        log.error(f"Error uploading file {filename}: {str(e)}")
        # Return original base64 data if upload fails
        base64_data = base64.b64encode(file_data).decode('utf-8')
        return f"data:image/jpeg;base64,{base64_data}"

# 关联用户消息和AI响应的checkpoint信息
def processMessagesWithCheckpoints(messages):
    # ... existing code ...
    pass

@server.PromptServer.instance.routes.post("/api/chat/invoke")
async def invoke_chat(request):
    log.info("Received invoke_chat request")
    
    # Extract and store API key from Authorization header
    extract_and_store_api_key(request)
    
    req_json = await request.json()
    log.info("Request J
```

### Core Architecture Module: `backend/controller/expert_api.py`
```
from server import PromptServer
from aiohttp import web
from typing import Dict, Any
import logging
from ..dao.expert_table import (
    create_rewrite_expert,
    get_rewrite_expert,
    list_rewrite_experts,
    update_rewrite_expert_by_id,
    delete_rewrite_expert_by_id
)

# 配置日志
logger = logging.getLogger(__name__)

def validate_expert_data(data: Dict[str, Any]) -> tuple[bool, str, Dict[str, Any]]:
    """验证专家数据"""
    if not data:
        return False, "请求数据不能为空", {}
    
    # 验证必填字段
    if 'name' not in data or not data['name']:
        return False, "名称不能为空", {}
    
    # 验证字段类型和长度
    if not isinstance(data['name'], str) or len(data['name']) > 255:
        return False, "名称必须是字符串且长度不超过255个字符", {}
    
    # 验证可选字段
    validated_data = {
        'name': data['name'].strip(),
        'description': data.get('description'),
        'content': data.get('content')
    }
    
    return True, "", validated_data

@PromptServer.instance.routes.post("/api/expert/experts")
async def create_expert(request):
    """创建新的专家记录"""
    try:
        data = await request.json()
        if not data:
            return web.json_response({"success": False, "message": "请求数据格式错误", "data": None}, status=400)
        
        # 验证数据
        is_valid, error_msg, validated_data = validate_expert_data(data)
        if not is_valid:
            return web.json_response({"success": False, "message": error_msg, "data": None}, status=400)
        
        # 创建专家记录
        expert_id = create_rewrite_expert(
            name=validated_data['name'],
            description=validated_data['description'],
            content=validated_data['content']
        )
        
        logger.info(f"成功创建专家记录，ID: {expert_id}")
        
        return web.json_response({"success": True, "message": "创建成功", "data": {"id": expert_id}}, status=200)
        
    except Exception as e:
        logger.error(f"创建专家记录失败: {str(e)}")
        return web.json_response({"success": False, "message": f"创建失败: {str(e)}", "data": None}, status=500)

@PromptServer.instance.routes.get("/api/expert/experts")
async def get_experts(request):
    """获取所有专家记录列表"""
    try:
        experts = list_rewrite_experts()
        
        logger.info(f"成功获取专家记录列表，共 {len(experts)} 条")
        
        return web.json_response({"success": True, "message": "获取列表成功", "data": {"total": len(experts), "experts": experts}}, status=200)
        
    except Exception as e:
        logger.error(f"获取专家记录列表失败: {str(e)}")
        return web.json_response({"success": False, "message": f"获取列表失败: {str(e)}", "data": None}, status=500)

@PromptServer.instance.routes.get("/api/expert/experts/{expert_id}")
async def get_expert_by_id(request):
    """根据ID获取专家记录"""
    try:
        expert_id = int(request.match_info['expert_id'])
        expert = get_rewrite_expert(expert_id)
        
        if not expert:
            return web.json_response({"success": False, "message": "ID不存在", "data": None}, status=404)
        
        logger.info(f"成功获取专家记录，ID: {expert_id}")
        
        return web.json_response({"success": True, "message": "获取记录成功", "data": expert}, status=200)
        
    except Exception as e:
        logger.error(f"获取专家记录失败，ID: {expert_id}, 错误: {str(e)}")
        return web.json_response({"success": False, "message": f"获取记录失败: {str(e)}", "data": None}, status=500)

@PromptServer.instance.routes.put("/api/expert/experts/{expert_id}")
async def update_expert(request):
    """更新专家记录"""
    try:
        expert_id = int(request.match_info['expert_id'])
        data = await request.json()
        if not data:
            return web.json_response({"success": False, "message": "请求数据格式错误", "data": None}, status=400)
        
        # 验证数据
        is_valid, error_msg, validated_data = validate_expert_data(data)
        if not is_valid:
            return web.json_response({"success": False, "message": error_msg, "data": None}, status=400)
        
        # 更新专家记录
        success = update_rewrite_expert_by_id(
            expert_id=expert_id,
            name=validated_data.get('name'),
            description=validated_data.get('description'),
            content=validated_data.get('content')
        )
        
        if not success:
            return web.json_response({"success": False, "message": "ID不存在", "data": None}, status=404)
        
        logger.info(f"成功更新专家记录，ID: {expert_id}")
        
        return web.json_response({"success": True, "message": "更新成功", "data": {"id": expert_id}}, status=200)
        
    except Exception as e:
        logger.error(f"更新专家记录失败，ID: {expert_id}, 错误: {str(e)}")
        return web.json_response({"success": False, "message": f"更新失败: {str(e)}", "data": None}, status=500)

@PromptServer.instance.routes.delete("/api/expert/experts/{expert_id}")
async def delete_expert(request):
    """删除专家记录"""
    try:
        expert_id = int(request.match_info['expert_id'])
        success = delete_rewrite_expert_by_id(expert_id)
        
        if not success:
            return web.json_response({"success": False, "message": "ID不存在", "data": None}, status=404)
        
        logger.info(f"成功删除专家记录，ID: {expert_id}")
        
        return web.json_response({"success": True, "message": "删除成功", "data": {"id": expert_id}}, status=200)
        
    except Exception as e:
        logger.error(f"删除专家记录失败，ID: {expert_id}, 错误: {str(e)}")
        return web.json_response({"success": False, "message": f"删除失败: {str(e)}", "data": None}, status=500)

@PromptServer.instance.routes.patch("/api/expert/experts/{expert_id}")
async def partial_update_expert(request):
    """部分更新专家记录"""
    try:
        expert_id = int(request.match_info['expert_id'])
        data = await request.json()
        if not data:
            return web.json_response({"success": False, "message": "请求数据格式错误", "data": None}, status=400)
        
        # 验证字段
        update_data = {}
        if 'name' in data:
            if not isinstance(data['name'], str) or len(data['name']) > 255:
                return web.json_response({"success": False, "message": "名称必须是字符串且长度不超过255个字符", "data": None}, status=400)
            update_data['name'] = data['name'].strip()
        
        if 'description' in data:
            update_data['description'] = data['description']
        
        if 'content' in data:
            update_data['content'] = data['content']
        
        if not update_data:
            return web.json_response({"success": False, "message": "没有提供要更新的字段", "data": None}, status=400)
        
        # 更新专家记录
        success = update_rewrite_expert_by_id(
            expert_id=expert_id,
            **update_data
        )
        
        if not success:
            return web.json_response({"success": False, "message": "ID不存在", "data": None}, status=404)
        
        logger.info(f"成功部分更新专家记录，ID: {expert_id}")
        
        return web.json_response({"success": True, "message": "更新成功", "data": {"id": expert_id}}, status=200)
        
    except Exception as e:
        logger.error(f"部分更新专家记录失败，ID: {expert_id}, 错误: {str(e)}")
        return web.json_response({"success": False, "message": f"更新失败: {str(e)}", "data": None}, status=500)

# 路由配置函数
# 所有路由已通过装饰器自动注册到 ComfyUI 的 PromptServer

```

### Core Architecture Module: `backend/controller/llm_api.py`
```
'''
Author: ai-business-hql qingli.hql@alibaba-inc.com
Date: 2025-07-14 16:46:20
LastEditors: ai-business-hql ai.bussiness.hql@gmail.com
LastEditTime: 2025-12-15 15:03:28
FilePath: /comfyui_copilot/backend/controller/llm_api.py
Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
'''
# Copyright (C) 2025 AIDC-AI
# Licensed under the MIT License.

import json
from typing import List, Dict, Any
from aiohttp import web
from ..utils.globals import LLM_DEFAULT_BASE_URL, LMSTUDIO_DEFAULT_BASE_URL, OPENAI_API_KEY, OPENAI_BASE_URL, TENANT_ID, is_lmstudio_url
import server
import requests
from ..utils.logger import log


@server.PromptServer.instance.routes.get("/api/model_config")
async def list_models(request):
    """
    List available LLM models
    
    Returns:
        JSON response with models list in the format expected by frontend:
        {
            "models": [
                {"name": "model_name", "image_enable": boolean},
                ...
            ]
        }
    """
    try:
        log.info("Received list_models request")
        if TENANT_ID:
            model_list = [ "gemini-2.5-flash", "gpt-5-nano", "gpt-5-mini", "gpt-5" ]
            llm_config = []
            for model in model_list:
                llm_config.append({
                    "label": model,
                    "name": model,
                    "image_enable": True
                })
            return web.json_response({
                "models": llm_config
            })
        
        openai_api_key = request.headers.get('Openai-Api-Key') or OPENAI_API_KEY or ""
        openai_base_url = request.headers.get('Openai-Base-Url') or OPENAI_BASE_URL or LLM_DEFAULT_BASE_URL

        request_url = f"{openai_base_url}/models"
        
        # Check if this is LMStudio and adjust headers accordingly
        is_lmstudio = is_lmstudio_url(openai_base_url)
        
        headers = {}
        if not is_lmstudio or (is_lmstudio and openai_api_key):
            # Include Authorization header for OpenAI API or LMStudio with API key
            headers["Authorization"] = f"Bearer {openai_api_key}"
        
        response = requests.get(request_url, headers=headers)
        llm_config = []
        if response.status_code == 200:
            models = response.json()
            for model in models['data']:
                llm_config.append({
                    "label": model['id'],
                    "name": model['id'],
                    "image_enable": True
                })
        
        return web.json_response({
                "models": llm_config
            }
        )
        
    except Exception as e:
        log.error(f"Error in list_models: {str(e)}")
        return web.json_response({
            "error": f"Failed to list models: {str(e)}"
        }, status=500)


@server.PromptServer.instance.routes.get("/verify_openai_key")
async def verify_openai_key(req):
    """
    Verify if an OpenAI API key is valid by calling the OpenAI models endpoint
    Also supports LMStudio verification (which may not require an API key)
    
    Returns:
        JSON response with success status and message
    """
    try:
        openai_api_key = req.headers.get('Openai-Api-Key')
        openai_base_url = req.headers.get('Openai-Base-Url', 'https://api.openai.com/v1')
        
        # Check if this is LMStudio
        is_lmstudio = is_lmstudio_url(openai_base_url)
        
        # For LMStudio, API key might not be required
        if not openai_api_key and not is_lmstudio:
            return web.json_response({
                "success": False, 
                "message": "No API key provided"
            })
        
        # Use a direct HTTP request instead of the OpenAI client
        # This gives us more control over the request method and error handling
        headers = {}
        if not is_lmstudio or (is_lmstudio and openai_api_key):
            # Include Authorization header for OpenAI API or LMStudio with API key
            headers["Authorization"] = f"Bearer {openai_api_key}"
        
        # Make a simple GET request to the models endpoint
        response = requests.get(f"{openai_base_url}/models", headers=headers)
        
        # Check if the request was successful
        if response.status_code == 200:
            success_message = "API key is valid" if not is_lmstudio else "LMStudio connection successful"
            return web.json_response({
                "success": True, 
                "data": True, 
                "message": success_message
            })
        else:
            log.error(f"API validation failed with status code: {response.status_code}")
            error_message = f"Invalid API key: HTTP {response.status_code} - {response.text}"
            if is_lmstudio:
                error_message = f"LMStudio connection failed: HTTP {response.status_code} - {response.text}"
            return web.json_response({
                "success": False, 
                "data": False,
                "message": error_message
            })
            
    except Exception as e:
        log.error(f"Error verifying API key/connection: {str(e)}")
        error_message = f"Invalid API key: {str(e)}"
        if 'base_url' in locals() and is_lmstudio_url(locals().get('openai_base_url', '')):
            error_message = f"LMStudio connection error: {str(e)}"
        return web.json_response({
            "success": False, 
            "data": False, 
            "message": error_message
        })
```

### Core Architecture Module: `backend/core.py`
```
import os

from agents._config import set_default_openai_api
from agents.tracing import set_tracing_disabled
# from .utils.logger import log

# def load_env_config():
#     """Load environment variables from .env.llm file"""
#     from dotenv import load_dotenv

#     env_file_path = os.path.join(os.path.dirname(__file__), '.env.llm')
#     if os.path.exists(env_file_path):
#         load_dotenv(env_file_path)
#         log.info(f"Loaded environment variables from {env_file_path}")
#     else:
#         log.warning(f"Warning: .env.llm not found at {env_file_path}")


# # Load environment configuration
# load_env_config()

set_default_openai_api("chat_completions")
set_tracing_disabled(True)
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #159** (2026-09-24): **Add ROADMAP.md**
  *Symptoms*: Execution order for rebuilding the features that depended on the dead upstream server, plus the debugger fix, layout, and Runpod/external-driving goals. Records Mike's direction from 2026-09-24 in his words.  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  **Post-Mortem & Fix Analysis**:
  > Opened against the wrong repository by mistake; this belongs to the mdc159 fork.
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/ATH-MaaS/ComfyUI-Copilot?pullRequest=159) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/ATH-MaaS/ComfyUI-Copilot?pullRequest=159) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/ATH-MaaS/ComfyUI-Copilot?pullRequest=159) it.</sub>

- **Issue #157** (2026-09-11): **test: update README_CN**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/signed)](https://cla-assistant.io/ATH-MaaS/ComfyUI-Copilot?pullRequest=157) <br/>All committers have signed the CLA.

- **Issue #126** (2026-01-22): **How long does it take to get a verification email for the API key?**
  *Symptoms*: ![Image](https://github.com/user-attachments/assets/da434918-3b1d-4014-bc48-7e37f31eb08d)  It just stays here, no matter how many times I do it. Restarted, wait next day, tried many times. Nothing happens. Did I miss something?
  **Post-Mortem & Fix Analysis**:
  > At most 1 minute, please check your garbage can
  > I have this same problem :( I've gotten 7 emails, ALL THE SAME CODE  <img width="556" height="415" alt="Image" src="https://github.com/user-attachments/assets/1ddca536-12e0-4f77-8254-15e65b9cb327" />  <img width="1107" height="532" alt="Image" src="https://github.com/user-attachments/assets/e6da11a7-32e2-483d-b756-d04740d2ff77" />  <img width="146" height="458" alt="Image" src="https://github.com/user-attachments/assets/069e5aa7-d98b-406e-ab5a-4600e2c2cd41" />  <img width="1873" height="216" alt="Image" src="https://github.com/user-attachments/assets/5d7e3ecb-b6a7-449f-82a9-0ee778e2374e" />  This is so frustrating. 
  > It's really confusing, I changed several emails to receive new apikey, then paste the apikey, no problem at all. You two, please use following apikeys, if the error still exists, then it's something else. @jaxiez @engelspalabrica-boop  3c9b1dd11d4243e29c4edca95e64223c 0fb258d18a1b4985a4b69ff20206cc87 

- **Issue #124** (2026-01-12): **Authentication failed for https://api.smith.langchain.com/runs/multipart**
  *Symptoms*: 原先使用nodemanager进行安装，卸载后使用 git clone的方式安装，重启过comfyui，原配置信息都在，没有再次修改配置的apikey等内容。在对话框中要求修改当前打开的工作流，看日志里有很多如下错误：  Failed to send compressed multipart ingest: langsmith.utils.LangSmithAuthError: Authentication failed for https://api.smith.langchain.com/runs/multipart. HTTPError('401 Client Error: Unauthorized for url: https://api.smith.langchain.com/runs/multipart', '{"error":"Unauthorized"}\n')trace=019baddc-40da-7453-9c16-f097d9501761,id=019baddc-e77b-7d90-85d4-dcf986c66a12; trace=019baddc-40da-7453-9c16-f097d9501761,id=019baddc-fcc7-7a92-bc58-bcb466ed21b0; trace=019baddc-40da-7453-9c16-f097d9501761,id=019baddc-fcc7-7a92-bc58-bcb466ed21b0; trace=019baddc-40da-7453-9c16-f097d9501761,id=019baddc-fd0e-7750-868d-f3026543d28f
  **Post-Mortem & Fix Analysis**:
  > 哦哦，这个报错不用管，langsmith是我用来协助排查trace的，我注意下把这部分代码注释掉 
  > ok，确实不影响使用

- **Issue #118** (2025-12-31): **apache.org/licenses/LICENSE-1.0**
  *Symptoms*: https://www.apache.org/licenses/LICENSE-1.0

- **Issue #117** (2025-12-01): **feat:修复添加节点位置偏移问题**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/AIDC-AI/ComfyUI-Copilot?pullRequest=117) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you sign our [Contributor License Agreement](https://cla-assistant.io/AIDC-AI/ComfyUI-Copilot?pullRequest=117) before we can accept your contribution.<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/AIDC-AI/ComfyUI-Copilot?pullRequest=117) it.</sub>

- **Issue #116** (2026-01-19): **'error': {'message': 'The model `us.anthropic.claude-sonnet-4-20250514-v1:0` does not exist or you do not have access to it.'**
  *Symptoms*: Even when I inserted my OpenAI key and URL into both LLM Configuration and Workflow LLM Configuration, I still get this stupid error. Wtf. Why is this shit hardcoded? 
  **Post-Mortem & Fix Analysis**:
  > This is not hardcoded, it's a default value, you can set your model name in config.  <img width="628" height="786" alt="Image" src="https://github.com/user-attachments/assets/b4f4156e-1b7a-437a-9dc6-4ac28b03a656" />
  > I know, I have it set to gpt-5-nano, tried a few other ones too, and no matter what I have in that box it gives the same error. Thank you for the suggestion though. 
  > That's weird, I'll try to fix it, I hope I can get the same error through testing.

- **Issue #115** (2025-11-29): **Claude/session 011 cu yqn1 b63t5 s8 ulgab ynr**
  *Symptoms*: 
  **Post-Mortem & Fix Analysis**:
  > [![CLA assistant check](https://cla-assistant.io/pull/badge/not_signed)](https://cla-assistant.io/AIDC-AI/ComfyUI-Copilot?pullRequest=115) <br/>Thank you for your submission! We really appreciate it. Like many open source projects, we ask that you all sign our [Contributor License Agreement](https://cla-assistant.io/AIDC-AI/ComfyUI-Copilot?pullRequest=115) before we can accept your contribution.<br/>**0** out of **2** committers have signed the CLA.<br/><br/>:x: DataSparBrian<br/>:x: claude<br/><sub>You have signed the CLA already but the status is still pending? Let us [recheck](https://cla-assistant.io/check/AIDC-AI/ComfyUI-Copilot?pullRequest=115) it.</sub>

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

### Incident Patch 1: `b4d7a8a1` (2025-12-12)
**Commit Message**: feat: prompt解决message压缩的tool调用bug

**File**: `backend/service/mcp_client.py` (modified, +7/-0)
```diff
@@ -231,6 +231,12 @@ def rewrite_handoff_input_filter(data: HandoffInputData) -> HandoffInputData:
 ### PRIMARY DIRECTIVE: INTENT CLASSIFICATION & HANDOFF
 You act as a router. Your FIRST step is to classify the user's intent.
 
+### TOOL-CALL RELIABILITY OVERRIDE (CONTEXT-TRIM SAFE)
+The conversation history may be truncated for brevity and may contain ZERO tool calls/tool results.
+- You MUST NOT treat "no prior tool message" as a reason to skip tool usage.
+- If a CASE below requires a tool call or handoff, you MUST execute it even if you think you already know the answer.
+- If a CASE below requires a tool call or handoff, your IMMEDIATE next assistant turn MUST be that tool call/handoff (do not output any natural-language explanation first).
+
 **CASE 1: MODIFY/UPDATE/FIX CURRENT WORKFLOW (HIGHEST PRIORITY)**
 IF the user wants to:
 - Modify, enhance, update, or fix the CURRENT workflow/canvas.
@@ -258,6 +264,7 @@ def rewrite_handoff_input_filter(data: HandoffInputData) -> HandoffInputData:
 ### CONSTRAINT CHECKLIST
 You must adhere to the following constraints to complete the task:
 
+- **Tool compliance is mandatory**: If the selected CASE requires a tool/handoff, you MUST perform it. Do not answer directly without performing the required tool/handoff.
 - [Important!] Respond must in the language used by the user in their question. Regardless of the language returned by the tools being called, please return the results based on the language used in the user's query. For example, if user ask by English, you must return
 - Ensure that the commands or tools you invoke are within the provided tool list.
 - If the execution of a command or tool fails, try changing the parameters or their format before attempting again.
```

---

### Incident Patch 2: `1f962c2a` (2025-12-12)
**Commit Message**: feat: prompt解决message压缩的tool调用bug

**File**: `backend/service/mcp_client.py` (modified, +7/-0)
```diff
@@ -231,6 +231,12 @@ def rewrite_handoff_input_filter(data: HandoffInputData) -> HandoffInputData:
 ### PRIMARY DIRECTIVE: INTENT CLASSIFICATION & HANDOFF
 You act as a router. Your FIRST step is to classify the user's intent.
 
+### TOOL-CALL RELIABILITY OVERRIDE (CONTEXT-TRIM SAFE)
+The conversation history may be truncated for brevity and may contain ZERO tool calls/tool results.
+- You MUST NOT treat "no prior tool message" as a reason to skip tool usage.
+- If a CASE below requires a tool call or handoff, you MUST execute it even if you think you already know the answer.
+- If a CASE below requires a tool call or handoff, your IMMEDIATE next assistant turn MUST be that tool call/handoff (do not output any natural-language explanation first).
+
 **CASE 1: MODIFY/UPDATE/FIX CURRENT WORKFLOW (HIGHEST PRIORITY)**
 IF the user wants to:
 - Modify, enhance, update, or fix the CURRENT workflow/canvas.
@@ -258,6 +264,7 @@ def rewrite_handoff_input_filter(data: HandoffInputData) -> HandoffInputData:
 ### CONSTRAINT CHECKLIST
 You must adhere to the following constraints to complete the task:
 
+- **Tool compliance is mandatory**: If the selected CASE requires a tool/handoff, you MUST perform it. Do not answer directly without performing the required tool/handoff.
 - [Important!] Respond must in the language used by the user in their question. Regardless of the language returned by the tools being called, please return the results based on the language used in the user's query. For example, if user ask by English, you must return
 - Ensure that the commands or tools you invoke are within the provided tool list.
 - If the execution of a command or tool fails, try changing the parameters or their format before attempting again.
```

---

### Incident Patch 3: `91287a45` (2025-12-01)
**Commit Message**: Merge pull request #117 from AIDC-AI/bugfix_1201

feat:修复添加节点位置偏移问题

**File**: `dist/copilot_web/App-D0onO6Pn.js` (renamed, +2/-2)
```diff
@@ -1,7 +1,7 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-Bs515Oed.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components--sDgdV1o.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
+            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-XZ3VCjO6.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components-fbm8PP7r.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
                         const apiBase = window.comfyAPI?.api?.api?.api_base;
                         if (apiBase) {
                             // 有 API base 时，使用完整路径
@@ -11,4 +11,4 @@ function getImportPath(filename) {
                             return `./${path}`;
                         }
                     }))))=>i.map(i=>d[i]);
-import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components--sDgdV1o.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-Bs515Oed.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
+import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components-fbm8PP7r.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-XZ3VCjO6.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
```

**File**: `dist/copilot_web/DebugGuide-BMwuge6o.js` (renamed, +1/-1)
```diff
@@ -1,5 +1,5 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as s}from"./vendor-markdown-B4Av9P7l.js";import{r as i}from"./vendor-react-ByKzdfMq.js";import{u as A,o as E,R as D,n as m,W as f,a as b}from"./message-components--sDgdV1o.js";function P({content:h,name:k="Assistant",avatar:O,onAddMessage:y,onUpdateMessage:c,messageId:_}){const{dispatch:u,abortControllerRef:l}=A(),[d,w]=i.useState(!1),[T,G]=i.useState(""),[J,S]=i.useState(!1),[j,v]=i.useState(null),r=i.useMemo(()=>{try{return JSON.parse(h)}catch(e){return console.error("Failed to parse message content:",e),null}},[h]),x=i.useMemo(()=>{if(!r||!r.ext)return null;const e=r.ext.find(t=>t.type==="debug_start_checkpoint"||t.type==="debug_checkpoint"&&t.data?.checkpoint_type==="debug_start");return e&&e.data&&e.data.checkpoint_id?e.data.checkpoint_id:null},[r])||j,N=async()=>{if(d)return;const e=m(),t={id:e,role:"ai",content:JSON.stringify({text:`🔍 Starting workflow analysis...
+            import{j as s}from"./vendor-markdown-B4Av9P7l.js";import{r as i}from"./vendor-react-ByKzdfMq.js";import{u as A,o as E,R as D,n as m,W as f,a as b}from"./message-components-fbm8PP7r.js";function P({content:h,name:k="Assistant",avatar:O,onAddMessage:y,onUpdateMessage:c,messageId:_}){const{dispatch:u,abortControllerRef:l}=A(),[d,w]=i.useState(!1),[T,G]=i.useState(""),[J,S]=i.useState(!1),[j,v]=i.useState(null),r=i.useMemo(()=>{try{return JSON.parse(h)}catch(e){return console.error("Failed to parse message content:",e),null}},[h]),x=i.useMemo(()=>{if(!r||!r.ext)return null;const e=r.ext.find(t=>t.type==="debug_start_checkpoint"||t.type==="debug_checkpoint"&&t.data?.checkpoint_type==="debug_start");return e&&e.data&&e.data.checkpoint_id?e.data.checkpoint_id:null},[r])||j,N=async()=>{if(d)return;const e=m(),t={id:e,role:"ai",content:JSON.stringify({text:`🔍 Starting workflow analysis...
 `,ext:[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};y?.(t);try{f.trackEvent({event_type:"debug_trigger",message_type:"debug",message_id:e,data:{}}),await C(),u({type:"SET_LOADING",payload:!0}),await I(e)}finally{w(!1)}},C=async()=>{try{const e=await b.graphToPrompt(),t=localStorage.getItem("sessionId")||"";if(t&&e){const n=await f.saveWorkflowCheckpoint(t,e.output,e.workflow,"debug_start");if(v(n.version_id),console.log(`Saved debug start checkpoint: ${n.version_id}`),c&&r){const o=[...r.ext||[]].filter(g=>g.type!=="debug_start_checkpoint"&&!(g.type==="debug_checkpoint"&&g.data?.checkpoint_type==="debug_start"));o.push({type:"debug_start_checkpoint",data:{checkpoint_id:n.version_id,checkpoint_type:"debug_start"}});const p={id:_||m(),role:"ai",content:JSON.stringify({text:r.text,ext:o}),format:"debug_guide",name:"Assistant"};c(p)}}}catch(e){console.error("Failed to save checkpoint before debug:",e)}},I=async e=>{try{const t=await b.graphToPrompt();let n="",a=null;l&&(l.current=new AbortController);for await(const o of f.streamDebugAgent(t,l?.current?.signal||void 0))if(o.text){n=o.text,o.ext&&(a=o.ext);const p={id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};c?.(p)}c?.({id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!0,debugGuide:!0}),u({type:"SET_LOADING",payload:!1}),l.current=null}catch(t){console.error("Error calling debug agent:",t),S(!1);const a={id:e,role:"ai",content:JSON.stringify({text:`I encountered an error while analyzing your workflow: ${t.message||"Unknown error"}`,ext:[]}),format:"markdown",name:"Assistant",finished:!0};c?.(a),u({type:"SET_LOADING",payload:!1}),l.current=null}};return r?s.jsx(E,{name:k,children:s.jsxs("div",{className:"bg-gray-100 pt-4 px-4 pb-3 rounded-lg",children:[s.jsx("div",{className:"flex justify-between items-start",children:s.jsx("p",{className:"text-gray-700 text-sm flex-1",children:r.text})}),s.jsx("div",{className:"flex justify-end mt-4",children:s.jsx("button"
```

**File**: `dist/copilot_web/DebugResult-D-xaPQft.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,o as g,G as k,R as j}from"./message-components--sDgdV1o.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-Bs515Oed.js";import"./input.js";/* empty css     */import"./App-rH93i3nw.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);return e.jsx(v,{className:"rounded-lg ",borderClassName:"rounded-lg",children:e.jsxs("div",{className:`flex flex-col ${d} ${i?"":"max-h-[200px]"}`,children:[e.jsxs("div",{className:"flex justify-between items-center pb-2 border-b border-gray-100",children:[e.jsx("div",{children:typeof a=="string"?e.jsx("h3",{className:"text-sm text-[#fff] font-medium",children:a}):a}),e.jsx("button",{onClick:()=>{r(!i)},children:i?e.jsx(u,{className:"text-gray-700"}):e.jsx(w,{className:"text-gray-700"})})]}),e.jsx("div",{className:"overflow-hidden flex-1",children:c})]})})};function E({content:n,name:a="Assistant",avatar:f,format:d="markdown"}){const c=p.useRef(null),i=()=>{let r=null,l=!1,o,x=[];try{if(o=JSON.parse(n),o.ext){let t=o.ext.find(s=>s.type==="workflow_rewrite_checkpoint"||s.type==="debug_checkpoint"&&s.data?.checkpoint_type==="workflow_rewrite_start");t&&t.data&&t.data.checkpoint_id?(r=t.data.checkpoint_id,l=!0):(t=o.ext.find(s=>s.type==="workflow_rewrite_complete"),t&&t.data&&t.data.version_id?(r=t.data.version_id,l=!0):(t=o.ext.find(s=>s.type==="debug_checkpoint"),t&&t.data&&t.data.checkpoint_id&&(r=t.data.checkpoint_id,l=!1))),o.ext.find(s=>s.type==="workflow_update")&&(l=!0),x=o.ext.find(s=>s.type==="param_update")?.data?.model_suggest||[]}}catch(t){return console.error("Failed to parse DebugResult content:",t),null}const h=l?e.jsxs("div",{className:"flex items-center text-green-500",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",fill:"currentColor",viewBox:"0 0 20 20",children:e.jsx("path",{fillRule:"evenodd",d:"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",clipRule:"evenodd"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Successfully"})]}):e.jsxs("div",{className:"flex items-center text-gray-900",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"28108",fill:"currentColor",children:e.jsx("path",{d:"M401.048025 844.855924c0 20.341281 16.643052 36.984333 36.984333 36.984333l147.936307 0c20.341281 0 36.984333-16.643052 36.984333-36.984333L622.952998 807.872614 401.048025 807.872614 401.048025 844.855924zM512 142.159744c-142.943596 0-258.888282 115.944686-258.888282 258.888282 0 88.021729 44.011376 165.503405 110.951975 212.288964l0 83.58365c0 20.341281 16.643052 36.984333 36.984333 36.984333l221.903949 0c20.341281 0 36.984333-16.643052 36.984333-36.984333l0-83.58365c66.941622-46.784536 110.951975-124.266212 110.951975-212.288964C770.888282 258.104429 654.943596 142.159744 512 142.159744zM617.588827 552.682561l-31.621185 22.005176 0 85.248569L438.031335 659.936307l0-85.063351L406.41015 552.866756c-49.743938-34.764781-79.33079-91.350544-79.33079-151.634536 0-101.890598 83.029018-184.92064 184.92064-184.92064s184.92064 83.029018 184.92064 184.92064C696.919617 461.332017 667.332764 517.91778 617.588827 552.682561z","p-id":"28277"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Finished"})]}),m=l?e.jsx("div",{className:"mt-3 text-xs text-gray-700",children:"💡 If you're not satisfied with the changes, click the restore button to revert to the previous version."}):null;return e.jsxs("div",{ref:c,className:"sticky top-0 left-0 w-full bg-gray-100 p-4 rounded-lg overflow-hidden",children:[e.jsx(y,{title:h,isWorkflowUpdate:l,className:"p-4",children:e.jsxs("div",{className:"prose prose-sm max-w-none",children:[d==="markdow
```

**File**: `dist/copilot_web/WorkflowOption-DRDiBBwJ.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{D,W as _,n as C,a as d}from"./message-components--sDgdV1o.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as G}from"./workflowChat-Bs515Oed.js";import"./input.js";/* empty css     */import"./App-rH93i3nw.js";function Y({content:v,name:J="Assistant",avatar:P,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(G,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,L=n.outputs?n.outputs.length:0,q=n.widgets?n.widgets.length:0,B=Math.max(V,L)+q,u=S*B+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fi
```

**File**: `dist/copilot_web/workflowChat-XZ3VCjO6.js` (renamed, +3/-3)
```diff
@@ -1,7 +1,7 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/message-components--sDgdV1o.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/WorkflowOption-CUEyiK7N.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css","copilot_web/App-rH93i3nw.js","copilot_web/DebugGuide-CqaaNx4k.js","copilot_web/DebugResult-BiFrTcrM.js"].map(path => {
+            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/message-components-fbm8PP7r.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/WorkflowOption-DRDiBBwJ.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css","copilot_web/App-D0onO6Pn.js","copilot_web/DebugGuide-BMwuge6o.js","copilot_web/DebugResult-D-xaPQft.js"].map(path => {
                         const apiBase = window.comfyAPI?.api?.api?.api_base;
                         if (apiBase) {
                             // 有 API base 时，使用完整路径
@@ -11,7 +11,7 @@ function getImportPath(filename) {
                             return `./${path}`;
                         }
                     }))))=>i.map(i=>d[i]);
-import{j as s,r as _g,b as wg}from"./vendor-markdown-B4Av9P7l.js";import{r as _,c as Ss,e as Xl,R as Qi}from"./vendor-react-ByKzdfMq.js";import{b as vg,c as kg,X as Ln,a as $e,g as Yl,f as Sg,d as Ql,v as Ml,W as ht,S as Ig,H as Cg,M as jg,T as Zl,E as Lg,I as Is,e as Ng,F as ec,h as ss,i as Tl,B as Pl,j as Ag,P as Eg,u as gn,k as Mg,l as Tg,m as Pg,n as at,o as tc,p as Dg,q as Og,r as Fg,s as Rg,t as zg,x as Ug,y as Bg,z as Wg,A as Gg}from"./message-components--sDgdV1o.js";import{_ as sn}from"./input.js";import{C as rs}from"./App-rH93i3nw.js";const Dl=o=>{const{isPassword:u=!1,value:r="",setValue:d=()=>{},setIsValueValid:c,placeholder:h="",className:m=""}=o,[g,b]=_.useState(!u),S=v=>{d(v.target.value),c?.(v.target.value)};return s.jsxs("div",{className:`relative ${m}`,children:[s.jsx("input",{type:g?"text":"password",value:r,onChange:S,placeholder:h,className:`w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg
+import{j as s,r as _g,b as wg}from"./vendor-markdown-B4Av9P7l.js";import{r as _,c as Ss,e as Xl,R as Qi}from"./vendor-react-ByKzdfMq.js";import{b as vg,c as kg,X as Ln,a as $e,g as Yl,f as Sg,d as Ql,v as Ml,W as ht,S as Ig,H as Cg,M as jg,T as Zl,E as Lg,I as Is,e as Ng,F as ec,h as ss,i as Tl,B as Pl,j as Ag,P as Eg,u as gn,k as Mg,l as Tg,m as Pg,n as at,o as tc,p as Dg,q as Og,r as Fg,s as Rg,t as zg,x as Ug,y as Bg,z as Wg,A as Gg}from"./message-components-fbm8PP7r.js";import{_ as sn}from"./input.js";import{C as rs}from"./App-D0onO6Pn.js";const Dl=o=>{const{isPassword:u=!1,value:r="",setValue:d=()=>{},setIsValueValid:c,placeholder:h="",className:m=""}=o,[g,b]=_.useState(!u),S=v=>{d(v.target.value),c?.(v.target.value)};return s.jsxs("div",{className:`relative ${m}`,children:[s.jsx("input",{type:g?"text":"password",value:r,onChange:S,placeholder:h,className:`w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg
           bg-gray-50 dark:bg-gray-700 
           text-gray-900 dark:text-white
           placeholder-gray-500 dark:placeholder-gray-400
@@ -113,7 +113,7 @@ ${b.join(`
                          transition-all duration-200 active:scale-95`,children:u?s.jsx(Tg,{className:"h-5 w-5 text-red-500 hover:text-red-600"}):s.jsx(Pg,{className:"h-5 w-5 group-hover:translate-x-1"})})]})});oc.displayName="ChatInput";function pp(o){const u=o[0],r=new Set;function d(c,h){if(!(!c||h>=1)&&c.inputs)for(const m of Object.values(c.inputs)){const g=m.link;if(g&&$e.graph.links[g]){const b=$e.graph.links[g].origin_id,S=$e.graph._nodes_by_id[b];S&&(r.add(S.type),d(S,h+1))}}}return u?(d(u,0),[{type:"upstream_node_types",data:Array.from(r)}]):null}function xp({nodeInfo:o,onSendWithIntent:u
```

---

### Incident Patch 4: `1fa099b2` (2025-11-25)
**Commit Message**: 去掉trace

**File**: `backend/service/mcp_client.py` (modified, +5/-13)
```diff
@@ -64,13 +64,6 @@ async def comfyui_agent_invoke(messages: List[Dict[str, Any]], images: List[Imag
         tuple: (text, ext) where text is accumulated text and ext is structured data
     """
     try:
-        # ------------------------------------------------------------------
-        # Sanitize messages to avoid provider validation errors
-        # Some backends (e.g. Bedrock via ConverseStream) reject requests if
-        # the final assistant message content ends with trailing whitespace.
-        # We defensively strip only *trailing* whitespace from assistant text
-        # segments, preserving internal spaces and formatting.
-        # ------------------------------------------------------------------
         def _strip_trailing_whitespace_from_messages(
             msgs: List[Dict[str, Any]]
         ) -> List[Dict[str, Any]]:
@@ -276,12 +269,11 @@ def rewrite_handoff_input_filter(data: HandoffInputData) -> HandoffInputData:
             agent_input = messages
             log.info(f"-- Processing {len(messages)} messages")
 
-            from agents import Agent, Runner, set_trace_processors, set_tracing_disabled, set_default_openai_api
-            from langsmith.wrappers import OpenAIAgentsTracingProcessor
-
-            set_tracing_disabled(False)
-            set_default_openai_api("chat_completions")
-            set_trace_processors([OpenAIAgentsTracingProcessor()])
+            # from agents import Agent, Runner, set_trace_processors, set_tracing_disabled, set_default_openai_api
+            # from langsmith.wrappers import OpenAIAgentsTracingProcessor
+            # set_tracing_disabled(False)
+            # set_default_openai_api("chat_completions")
+            # set_trace_processors([OpenAIAgentsTracingProcessor()])
 
             result = Runner.run_streamed(
                 agent,
```

**File**: `backend/utils/globals.py` (modified, +2/-2)
```diff
@@ -99,11 +99,11 @@ def set_comfyui_copilot_api_key(api_key: str) -> None:
     _global_state.set('comfyui_copilot_api_key', api_key)
 
 
-BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "https://comfyui-copilot-server-pre.onrender.com")
+BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "https://comfyui-copilot-server.onrender.com")
 LMSTUDIO_DEFAULT_BASE_URL = "http://localhost:1234/v1"
 WORKFLOW_MODEL_NAME = os.getenv("WORKFLOW_MODEL_NAME", "us.anthropic.claude-sonnet-4-20250514-v1:0")
 # WORKFLOW_MODEL_NAME = "gpt-5-2025-08-07-GlobalStandard"
-LLM_DEFAULT_BASE_URL = "https://comfyui-copilot-server-pre.onrender.com/v1"
+LLM_DEFAULT_BASE_URL = "https://comfyui-copilot-server.onrender.com/v1"
 
 # LLM-related env defaults (used as fallback when request config does not provide values)
 OPENAI_API_KEY = os.getenv("CC_OPENAI_API_KEY") or None
```

---

### Incident Patch 5: `8218fbc7` (2025-11-25)
**Commit Message**: 去掉trace

**File**: `backend/service/mcp_client.py` (modified, +5/-13)
```diff
@@ -64,13 +64,6 @@ async def comfyui_agent_invoke(messages: List[Dict[str, Any]], images: List[Imag
         tuple: (text, ext) where text is accumulated text and ext is structured data
     """
     try:
-        # ------------------------------------------------------------------
-        # Sanitize messages to avoid provider validation errors
-        # Some backends (e.g. Bedrock via ConverseStream) reject requests if
-        # the final assistant message content ends with trailing whitespace.
-        # We defensively strip only *trailing* whitespace from assistant text
-        # segments, preserving internal spaces and formatting.
-        # ------------------------------------------------------------------
         def _strip_trailing_whitespace_from_messages(
             msgs: List[Dict[str, Any]]
         ) -> List[Dict[str, Any]]:
@@ -276,12 +269,11 @@ def rewrite_handoff_input_filter(data: HandoffInputData) -> HandoffInputData:
             agent_input = messages
             log.info(f"-- Processing {len(messages)} messages")
 
-            from agents import Agent, Runner, set_trace_processors, set_tracing_disabled, set_default_openai_api
-            from langsmith.wrappers import OpenAIAgentsTracingProcessor
-
-            set_tracing_disabled(False)
-            set_default_openai_api("chat_completions")
-            set_trace_processors([OpenAIAgentsTracingProcessor()])
+            # from agents import Agent, Runner, set_trace_processors, set_tracing_disabled, set_default_openai_api
+            # from langsmith.wrappers import OpenAIAgentsTracingProcessor
+            # set_tracing_disabled(False)
+            # set_default_openai_api("chat_completions")
+            # set_trace_processors([OpenAIAgentsTracingProcessor()])
 
             result = Runner.run_streamed(
                 agent,
```

**File**: `backend/utils/globals.py` (modified, +2/-2)
```diff
@@ -99,11 +99,11 @@ def set_comfyui_copilot_api_key(api_key: str) -> None:
     _global_state.set('comfyui_copilot_api_key', api_key)
 
 
-BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "https://comfyui-copilot-server-pre.onrender.com")
+BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "https://comfyui-copilot-server.onrender.com")
 LMSTUDIO_DEFAULT_BASE_URL = "http://localhost:1234/v1"
 WORKFLOW_MODEL_NAME = os.getenv("WORKFLOW_MODEL_NAME", "us.anthropic.claude-sonnet-4-20250514-v1:0")
 # WORKFLOW_MODEL_NAME = "gpt-5-2025-08-07-GlobalStandard"
-LLM_DEFAULT_BASE_URL = "https://comfyui-copilot-server-pre.onrender.com/v1"
+LLM_DEFAULT_BASE_URL = "https://comfyui-copilot-server.onrender.com/v1"
 
 # LLM-related env defaults (used as fallback when request config does not provide values)
 OPENAI_API_KEY = os.getenv("CC_OPENAI_API_KEY") or None
```

---

### Incident Patch 6: `9fd11a93` (2025-11-25)
**Commit Message**: Merge pull request #114 from AIDC-AI/bugfix_1125

Bugfix 1125

**File**: `dist/copilot_web/App-rH93i3nw.js` (renamed, +2/-2)
```diff
@@ -1,7 +1,7 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-CNenSvoH.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components-CWGTfP0h.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
+            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-Bs515Oed.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components--sDgdV1o.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
                         const apiBase = window.comfyAPI?.api?.api?.api_base;
                         if (apiBase) {
                             // 有 API base 时，使用完整路径
@@ -11,4 +11,4 @@ function getImportPath(filename) {
                             return `./${path}`;
                         }
                     }))))=>i.map(i=>d[i]);
-import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components-CWGTfP0h.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-CNenSvoH.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
+import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components--sDgdV1o.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-Bs515Oed.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
```

**File**: `dist/copilot_web/DebugGuide-CqaaNx4k.js` (renamed, +1/-1)
```diff
@@ -1,5 +1,5 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as s}from"./vendor-markdown-B4Av9P7l.js";import{r as i}from"./vendor-react-ByKzdfMq.js";import{u as A,p as E,R as D,o as m,W as f,a as b}from"./message-components-CWGTfP0h.js";function P({content:h,name:k="Assistant",avatar:O,onAddMessage:y,onUpdateMessage:c,messageId:_}){const{dispatch:u,abortControllerRef:l}=A(),[d,w]=i.useState(!1),[T,G]=i.useState(""),[J,S]=i.useState(!1),[j,v]=i.useState(null),r=i.useMemo(()=>{try{return JSON.parse(h)}catch(e){return console.error("Failed to parse message content:",e),null}},[h]),x=i.useMemo(()=>{if(!r||!r.ext)return null;const e=r.ext.find(t=>t.type==="debug_start_checkpoint"||t.type==="debug_checkpoint"&&t.data?.checkpoint_type==="debug_start");return e&&e.data&&e.data.checkpoint_id?e.data.checkpoint_id:null},[r])||j,N=async()=>{if(d)return;const e=m(),t={id:e,role:"ai",content:JSON.stringify({text:`🔍 Starting workflow analysis...
+            import{j as s}from"./vendor-markdown-B4Av9P7l.js";import{r as i}from"./vendor-react-ByKzdfMq.js";import{u as A,o as E,R as D,n as m,W as f,a as b}from"./message-components--sDgdV1o.js";function P({content:h,name:k="Assistant",avatar:O,onAddMessage:y,onUpdateMessage:c,messageId:_}){const{dispatch:u,abortControllerRef:l}=A(),[d,w]=i.useState(!1),[T,G]=i.useState(""),[J,S]=i.useState(!1),[j,v]=i.useState(null),r=i.useMemo(()=>{try{return JSON.parse(h)}catch(e){return console.error("Failed to parse message content:",e),null}},[h]),x=i.useMemo(()=>{if(!r||!r.ext)return null;const e=r.ext.find(t=>t.type==="debug_start_checkpoint"||t.type==="debug_checkpoint"&&t.data?.checkpoint_type==="debug_start");return e&&e.data&&e.data.checkpoint_id?e.data.checkpoint_id:null},[r])||j,N=async()=>{if(d)return;const e=m(),t={id:e,role:"ai",content:JSON.stringify({text:`🔍 Starting workflow analysis...
 `,ext:[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};y?.(t);try{f.trackEvent({event_type:"debug_trigger",message_type:"debug",message_id:e,data:{}}),await C(),u({type:"SET_LOADING",payload:!0}),await I(e)}finally{w(!1)}},C=async()=>{try{const e=await b.graphToPrompt(),t=localStorage.getItem("sessionId")||"";if(t&&e){const n=await f.saveWorkflowCheckpoint(t,e.output,e.workflow,"debug_start");if(v(n.version_id),console.log(`Saved debug start checkpoint: ${n.version_id}`),c&&r){const o=[...r.ext||[]].filter(g=>g.type!=="debug_start_checkpoint"&&!(g.type==="debug_checkpoint"&&g.data?.checkpoint_type==="debug_start"));o.push({type:"debug_start_checkpoint",data:{checkpoint_id:n.version_id,checkpoint_type:"debug_start"}});const p={id:_||m(),role:"ai",content:JSON.stringify({text:r.text,ext:o}),format:"debug_guide",name:"Assistant"};c(p)}}}catch(e){console.error("Failed to save checkpoint before debug:",e)}},I=async e=>{try{const t=await b.graphToPrompt();let n="",a=null;l&&(l.current=new AbortController);for await(const o of f.streamDebugAgent(t,l?.current?.signal||void 0))if(o.text){n=o.text,o.ext&&(a=o.ext);const p={id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};c?.(p)}c?.({id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!0,debugGuide:!0}),u({type:"SET_LOADING",payload:!1}),l.current=null}catch(t){console.error("Error calling debug agent:",t),S(!1);const a={id:e,role:"ai",content:JSON.stringify({text:`I encountered an error while analyzing your workflow: ${t.message||"Unknown error"}`,ext:[]}),format:"markdown",name:"Assistant",finished:!0};c?.(a),u({type:"SET_LOADING",payload:!1}),l.current=null}};return r?s.jsx(E,{name:k,children:s.jsxs("div",{className:"bg-gray-100 pt-4 px-4 pb-3 rounded-lg",children:[s.jsx("div",{className:"flex justify-between items-start",children:s.jsx("p",{className:"text-gray-700 text-sm flex-1",children:r.text})}),s.jsx("div",{className:"flex justify-end mt-4",children:s.jsx("button"
```

**File**: `dist/copilot_web/DebugResult-BiFrTcrM.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,J as k,R as j}from"./message-components-CWGTfP0h.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-CNenSvoH.js";import"./input.js";/* empty css     */import"./App-BRBPgs30.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);return e.jsx(v,{className:"rounded-lg ",borderClassName:"rounded-lg",children:e.jsxs("div",{className:`flex flex-col ${d} ${i?"":"max-h-[200px]"}`,children:[e.jsxs("div",{className:"flex justify-between items-center pb-2 border-b border-gray-100",children:[e.jsx("div",{children:typeof a=="string"?e.jsx("h3",{className:"text-sm text-[#fff] font-medium",children:a}):a}),e.jsx("button",{onClick:()=>{r(!i)},children:i?e.jsx(u,{className:"text-gray-700"}):e.jsx(w,{className:"text-gray-700"})})]}),e.jsx("div",{className:"overflow-hidden flex-1",children:c})]})})};function E({content:n,name:a="Assistant",avatar:f,format:d="markdown"}){const c=p.useRef(null),i=()=>{let r=null,l=!1,o,x=[];try{if(o=JSON.parse(n),o.ext){let t=o.ext.find(s=>s.type==="workflow_rewrite_checkpoint"||s.type==="debug_checkpoint"&&s.data?.checkpoint_type==="workflow_rewrite_start");t&&t.data&&t.data.checkpoint_id?(r=t.data.checkpoint_id,l=!0):(t=o.ext.find(s=>s.type==="workflow_rewrite_complete"),t&&t.data&&t.data.version_id?(r=t.data.version_id,l=!0):(t=o.ext.find(s=>s.type==="debug_checkpoint"),t&&t.data&&t.data.checkpoint_id&&(r=t.data.checkpoint_id,l=!1))),o.ext.find(s=>s.type==="workflow_update")&&(l=!0),x=o.ext.find(s=>s.type==="param_update")?.data?.model_suggest||[]}}catch(t){return console.error("Failed to parse DebugResult content:",t),null}const h=l?e.jsxs("div",{className:"flex items-center text-green-500",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",fill:"currentColor",viewBox:"0 0 20 20",children:e.jsx("path",{fillRule:"evenodd",d:"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",clipRule:"evenodd"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Successfully"})]}):e.jsxs("div",{className:"flex items-center text-gray-900",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"28108",fill:"currentColor",children:e.jsx("path",{d:"M401.048025 844.855924c0 20.341281 16.643052 36.984333 36.984333 36.984333l147.936307 0c20.341281 0 36.984333-16.643052 36.984333-36.984333L622.952998 807.872614 401.048025 807.872614 401.048025 844.855924zM512 142.159744c-142.943596 0-258.888282 115.944686-258.888282 258.888282 0 88.021729 44.011376 165.503405 110.951975 212.288964l0 83.58365c0 20.341281 16.643052 36.984333 36.984333 36.984333l221.903949 0c20.341281 0 36.984333-16.643052 36.984333-36.984333l0-83.58365c66.941622-46.784536 110.951975-124.266212 110.951975-212.288964C770.888282 258.104429 654.943596 142.159744 512 142.159744zM617.588827 552.682561l-31.621185 22.005176 0 85.248569L438.031335 659.936307l0-85.063351L406.41015 552.866756c-49.743938-34.764781-79.33079-91.350544-79.33079-151.634536 0-101.890598 83.029018-184.92064 184.92064-184.92064s184.92064 83.029018 184.92064 184.92064C696.919617 461.332017 667.332764 517.91778 617.588827 552.682561z","p-id":"28277"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Finished"})]}),m=l?e.jsx("div",{className:"mt-3 text-xs text-gray-700",children:"💡 If you're not satisfied with the changes, click the restore button to revert to the previous version."}):null;return e.jsxs("div",{ref:c,className:"sticky top-0 left-0 w-full bg-gray-100 p-4 rounded-lg overflow-hidden",children:[e.jsx(y,{title:h,isWorkflowUpdate:l,className:"p-4",children:e.jsxs("div",{className:"prose prose-sm max-w-none",children:[d==="markdow
```

**File**: `dist/copilot_web/WorkflowOption-CUEyiK7N.js` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+function getImportPath(filename) {
+            return `./${filename}`;
+        }
+            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{D,W as _,n as C,a as d}from"./message-components--sDgdV1o.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as G}from"./workflowChat-Bs515Oed.js";import"./input.js";/* empty css     */import"./App-rH93i3nw.js";function Y({content:v,name:J="Assistant",avatar:P,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(G,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,L=n.outputs?n.outputs.length:0,q=n.widgets?n.widgets.length:0,B=Math.max(V,L)+q,u=S*B+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fi
```

**File**: `dist/copilot_web/WorkflowOption-DcX8WpSR.js` (removed, +0/-4)
```diff
@@ -1,4 +0,0 @@
-function getImportPath(filename) {
-            return `./${filename}`;
-        }
-            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{G as B,W as _,o as C,a as d}from"./message-components-CWGTfP0h.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as J}from"./workflowChat-CNenSvoH.js";import"./input.js";/* empty css     */import"./App-BRBPgs30.js";function Y({content:v,name:P="Assistant",avatar:R,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(J,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,G=n.outputs?n.outputs.length:0,L=n.widgets?n.widgets.length:0,q=Math.max(V,G)+L,u=S*q+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"2523
```

---

### Incident Patch 7: `6ef54207` (2025-11-25)
**Commit Message**: feat:bug fix

**File**: `dist/copilot_web/App-DQkoaeMn.js` (renamed, +2/-2)
```diff
@@ -1,7 +1,7 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-CNenSvoH.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components-CWGTfP0h.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
+            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-5ISUotB3.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components-CWGTfP0h.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
                         const apiBase = window.comfyAPI?.api?.api?.api_base;
                         if (apiBase) {
                             // 有 API base 时，使用完整路径
@@ -11,4 +11,4 @@ function getImportPath(filename) {
                             return `./${path}`;
                         }
                     }))))=>i.map(i=>d[i]);
-import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components-CWGTfP0h.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-CNenSvoH.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
+import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components-CWGTfP0h.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-5ISUotB3.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
```

**File**: `dist/copilot_web/DebugResult-CMP6PsKc.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,J as k,R as j}from"./message-components-CWGTfP0h.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-CNenSvoH.js";import"./input.js";/* empty css     */import"./App-BRBPgs30.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);return e.jsx(v,{className:"rounded-lg ",borderClassName:"rounded-lg",children:e.jsxs("div",{className:`flex flex-col ${d} ${i?"":"max-h-[200px]"}`,children:[e.jsxs("div",{className:"flex justify-between items-center pb-2 border-b border-gray-100",children:[e.jsx("div",{children:typeof a=="string"?e.jsx("h3",{className:"text-sm text-[#fff] font-medium",children:a}):a}),e.jsx("button",{onClick:()=>{r(!i)},children:i?e.jsx(u,{className:"text-gray-700"}):e.jsx(w,{className:"text-gray-700"})})]}),e.jsx("div",{className:"overflow-hidden flex-1",children:c})]})})};function E({content:n,name:a="Assistant",avatar:f,format:d="markdown"}){const c=p.useRef(null),i=()=>{let r=null,l=!1,o,x=[];try{if(o=JSON.parse(n),o.ext){let t=o.ext.find(s=>s.type==="workflow_rewrite_checkpoint"||s.type==="debug_checkpoint"&&s.data?.checkpoint_type==="workflow_rewrite_start");t&&t.data&&t.data.checkpoint_id?(r=t.data.checkpoint_id,l=!0):(t=o.ext.find(s=>s.type==="workflow_rewrite_complete"),t&&t.data&&t.data.version_id?(r=t.data.version_id,l=!0):(t=o.ext.find(s=>s.type==="debug_checkpoint"),t&&t.data&&t.data.checkpoint_id&&(r=t.data.checkpoint_id,l=!1))),o.ext.find(s=>s.type==="workflow_update")&&(l=!0),x=o.ext.find(s=>s.type==="param_update")?.data?.model_suggest||[]}}catch(t){return console.error("Failed to parse DebugResult content:",t),null}const h=l?e.jsxs("div",{className:"flex items-center text-green-500",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",fill:"currentColor",viewBox:"0 0 20 20",children:e.jsx("path",{fillRule:"evenodd",d:"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",clipRule:"evenodd"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Successfully"})]}):e.jsxs("div",{className:"flex items-center text-gray-900",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"28108",fill:"currentColor",children:e.jsx("path",{d:"M401.048025 844.855924c0 20.341281 16.643052 36.984333 36.984333 36.984333l147.936307 0c20.341281 0 36.984333-16.643052 36.984333-36.984333L622.952998 807.872614 401.048025 807.872614 401.048025 844.855924zM512 142.159744c-142.943596 0-258.888282 115.944686-258.888282 258.888282 0 88.021729 44.011376 165.503405 110.951975 212.288964l0 83.58365c0 20.341281 16.643052 36.984333 36.984333 36.984333l221.903949 0c20.341281 0 36.984333-16.643052 36.984333-36.984333l0-83.58365c66.941622-46.784536 110.951975-124.266212 110.951975-212.288964C770.888282 258.104429 654.943596 142.159744 512 142.159744zM617.588827 552.682561l-31.621185 22.005176 0 85.248569L438.031335 659.936307l0-85.063351L406.41015 552.866756c-49.743938-34.764781-79.33079-91.350544-79.33079-151.634536 0-101.890598 83.029018-184.92064 184.92064-184.92064s184.92064 83.029018 184.92064 184.92064C696.919617 461.332017 667.332764 517.91778 617.588827 552.682561z","p-id":"28277"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Finished"})]}),m=l?e.jsx("div",{className:"mt-3 text-xs text-gray-700",children:"💡 If you're not satisfied with the changes, click the restore button to revert to the previous version."}):null;return e.jsxs("div",{ref:c,className:"sticky top-0 left-0 w-full bg-gray-100 p-4 rounded-lg overflow-hidden",children:[e.jsx(y,{title:h,isWorkflowUpdate:l,className:"p-4",children:e.jsxs("div",{className:"prose prose-sm max-w-none",children:[d==="markdow
```

**File**: `dist/copilot_web/WorkflowOption-BkegEe5_.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{G as B,W as _,o as C,a as d}from"./message-components-CWGTfP0h.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as J}from"./workflowChat-CNenSvoH.js";import"./input.js";/* empty css     */import"./App-BRBPgs30.js";function Y({content:v,name:P="Assistant",avatar:R,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(J,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,G=n.outputs?n.outputs.length:0,L=n.widgets?n.widgets.length:0,q=Math.max(V,G)+L,u=S*q+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"2523
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [project]
 name = "ComfyUI-Copilot"
 description = "Your Intelligent Assistant for Comfy-UI."
-version = "2.0.24"
+version = "2.0.25"
 license = {file = "LICENSE"}
 
 [project.urls]
```

**File**: `ui/src/components/chat/messages/ModelOption.tsx` (modified, +1/-1)
```diff
@@ -184,7 +184,7 @@ const ModelOption: React.FC<IProps> = (props) => {
       title: thMap.updateTime,
       key: 'updateTime',
       render: (_, record) => (
-        <div>{record.LastUpdatedTime ? new Date(record.LastUpdatedTime).toLocaleString() : ''}</div>
+        <div>{record.LastUpdatedTime ? new Date(record.LastUpdatedTime*1000).toLocaleString() : ''}</div>
       )
     },
     {
```

---

### Incident Patch 8: `faaf841b` (2025-11-20)
**Commit Message**: Merge pull request #113 from AIDC-AI/bugfix_1120

Bugfix 1120

**File**: `dist/copilot_web/App-BRBPgs30.js` (renamed, +2/-2)
```diff
@@ -1,7 +1,7 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-c9mZt9pj.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components-CGVXqDj7.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
+            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-CNenSvoH.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components-CWGTfP0h.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
                         const apiBase = window.comfyAPI?.api?.api?.api_base;
                         if (apiBase) {
                             // 有 API base 时，使用完整路径
@@ -11,4 +11,4 @@ function getImportPath(filename) {
                             return `./${path}`;
                         }
                     }))))=>i.map(i=>d[i]);
-import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components-CGVXqDj7.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-c9mZt9pj.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
+import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components-CWGTfP0h.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-CNenSvoH.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
```

**File**: `dist/copilot_web/DebugGuide-CmTQq2s9.js` (renamed, +1/-1)
```diff
@@ -1,5 +1,5 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as s}from"./vendor-markdown-B4Av9P7l.js";import{r as i}from"./vendor-react-ByKzdfMq.js";import{u as A,p as E,R as D,o as m,W as f,a as b}from"./message-components-CGVXqDj7.js";function P({content:h,name:k="Assistant",avatar:O,onAddMessage:y,onUpdateMessage:c,messageId:_}){const{dispatch:u,abortControllerRef:l}=A(),[d,w]=i.useState(!1),[T,G]=i.useState(""),[J,S]=i.useState(!1),[j,v]=i.useState(null),r=i.useMemo(()=>{try{return JSON.parse(h)}catch(e){return console.error("Failed to parse message content:",e),null}},[h]),x=i.useMemo(()=>{if(!r||!r.ext)return null;const e=r.ext.find(t=>t.type==="debug_start_checkpoint"||t.type==="debug_checkpoint"&&t.data?.checkpoint_type==="debug_start");return e&&e.data&&e.data.checkpoint_id?e.data.checkpoint_id:null},[r])||j,N=async()=>{if(d)return;const e=m(),t={id:e,role:"ai",content:JSON.stringify({text:`🔍 Starting workflow analysis...
+            import{j as s}from"./vendor-markdown-B4Av9P7l.js";import{r as i}from"./vendor-react-ByKzdfMq.js";import{u as A,p as E,R as D,o as m,W as f,a as b}from"./message-components-CWGTfP0h.js";function P({content:h,name:k="Assistant",avatar:O,onAddMessage:y,onUpdateMessage:c,messageId:_}){const{dispatch:u,abortControllerRef:l}=A(),[d,w]=i.useState(!1),[T,G]=i.useState(""),[J,S]=i.useState(!1),[j,v]=i.useState(null),r=i.useMemo(()=>{try{return JSON.parse(h)}catch(e){return console.error("Failed to parse message content:",e),null}},[h]),x=i.useMemo(()=>{if(!r||!r.ext)return null;const e=r.ext.find(t=>t.type==="debug_start_checkpoint"||t.type==="debug_checkpoint"&&t.data?.checkpoint_type==="debug_start");return e&&e.data&&e.data.checkpoint_id?e.data.checkpoint_id:null},[r])||j,N=async()=>{if(d)return;const e=m(),t={id:e,role:"ai",content:JSON.stringify({text:`🔍 Starting workflow analysis...
 `,ext:[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};y?.(t);try{f.trackEvent({event_type:"debug_trigger",message_type:"debug",message_id:e,data:{}}),await C(),u({type:"SET_LOADING",payload:!0}),await I(e)}finally{w(!1)}},C=async()=>{try{const e=await b.graphToPrompt(),t=localStorage.getItem("sessionId")||"";if(t&&e){const n=await f.saveWorkflowCheckpoint(t,e.output,e.workflow,"debug_start");if(v(n.version_id),console.log(`Saved debug start checkpoint: ${n.version_id}`),c&&r){const o=[...r.ext||[]].filter(g=>g.type!=="debug_start_checkpoint"&&!(g.type==="debug_checkpoint"&&g.data?.checkpoint_type==="debug_start"));o.push({type:"debug_start_checkpoint",data:{checkpoint_id:n.version_id,checkpoint_type:"debug_start"}});const p={id:_||m(),role:"ai",content:JSON.stringify({text:r.text,ext:o}),format:"debug_guide",name:"Assistant"};c(p)}}}catch(e){console.error("Failed to save checkpoint before debug:",e)}},I=async e=>{try{const t=await b.graphToPrompt();let n="",a=null;l&&(l.current=new AbortController);for await(const o of f.streamDebugAgent(t,l?.current?.signal||void 0))if(o.text){n=o.text,o.ext&&(a=o.ext);const p={id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};c?.(p)}c?.({id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!0,debugGuide:!0}),u({type:"SET_LOADING",payload:!1}),l.current=null}catch(t){console.error("Error calling debug agent:",t),S(!1);const a={id:e,role:"ai",content:JSON.stringify({text:`I encountered an error while analyzing your workflow: ${t.message||"Unknown error"}`,ext:[]}),format:"markdown",name:"Assistant",finished:!0};c?.(a),u({type:"SET_LOADING",payload:!1}),l.current=null}};return r?s.jsx(E,{name:k,children:s.jsxs("div",{className:"bg-gray-100 pt-4 px-4 pb-3 rounded-lg",children:[s.jsx("div",{className:"flex justify-between items-start",children:s.jsx("p",{className:"text-gray-700 text-sm flex-1",children:r.text})}),s.jsx("div",{className:"flex justify-end mt-4",children:s.jsx("button"
```

**File**: `dist/copilot_web/DebugResult-BhGA0viM.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,G as k,R as j}from"./message-components-CGVXqDj7.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-c9mZt9pj.js";import"./input.js";/* empty css     */import"./App-iZNzhVOX.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);return e.jsx(v,{className:"rounded-lg ",borderClassName:"rounded-lg",children:e.jsxs("div",{className:`flex flex-col ${d} ${i?"":"max-h-[200px]"}`,children:[e.jsxs("div",{className:"flex justify-between items-center pb-2 border-b border-gray-100",children:[e.jsx("div",{children:typeof a=="string"?e.jsx("h3",{className:"text-sm text-[#fff] font-medium",children:a}):a}),e.jsx("button",{onClick:()=>{r(!i)},children:i?e.jsx(u,{className:"text-gray-700"}):e.jsx(w,{className:"text-gray-700"})})]}),e.jsx("div",{className:"overflow-hidden flex-1",children:c})]})})};function E({content:n,name:a="Assistant",avatar:f,format:d="markdown"}){const c=p.useRef(null),i=()=>{let r=null,l=!1,o,x=[];try{if(o=JSON.parse(n),o.ext){let t=o.ext.find(s=>s.type==="workflow_rewrite_checkpoint"||s.type==="debug_checkpoint"&&s.data?.checkpoint_type==="workflow_rewrite_start");t&&t.data&&t.data.checkpoint_id?(r=t.data.checkpoint_id,l=!0):(t=o.ext.find(s=>s.type==="workflow_rewrite_complete"),t&&t.data&&t.data.version_id?(r=t.data.version_id,l=!0):(t=o.ext.find(s=>s.type==="debug_checkpoint"),t&&t.data&&t.data.checkpoint_id&&(r=t.data.checkpoint_id,l=!1))),o.ext.find(s=>s.type==="workflow_update")&&(l=!0),x=o.ext.find(s=>s.type==="param_update")?.data?.model_suggest||[]}}catch(t){return console.error("Failed to parse DebugResult content:",t),null}const h=l?e.jsxs("div",{className:"flex items-center text-green-500",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",fill:"currentColor",viewBox:"0 0 20 20",children:e.jsx("path",{fillRule:"evenodd",d:"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",clipRule:"evenodd"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Successfully"})]}):e.jsxs("div",{className:"flex items-center text-gray-900",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"28108",fill:"currentColor",children:e.jsx("path",{d:"M401.048025 844.855924c0 20.341281 16.643052 36.984333 36.984333 36.984333l147.936307 0c20.341281 0 36.984333-16.643052 36.984333-36.984333L622.952998 807.872614 401.048025 807.872614 401.048025 844.855924zM512 142.159744c-142.943596 0-258.888282 115.944686-258.888282 258.888282 0 88.021729 44.011376 165.503405 110.951975 212.288964l0 83.58365c0 20.341281 16.643052 36.984333 36.984333 36.984333l221.903949 0c20.341281 0 36.984333-16.643052 36.984333-36.984333l0-83.58365c66.941622-46.784536 110.951975-124.266212 110.951975-212.288964C770.888282 258.104429 654.943596 142.159744 512 142.159744zM617.588827 552.682561l-31.621185 22.005176 0 85.248569L438.031335 659.936307l0-85.063351L406.41015 552.866756c-49.743938-34.764781-79.33079-91.350544-79.33079-151.634536 0-101.890598 83.029018-184.92064 184.92064-184.92064s184.92064 83.029018 184.92064 184.92064C696.919617 461.332017 667.332764 517.91778 617.588827 552.682561z","p-id":"28277"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Finished"})]}),m=l?e.jsx("div",{className:"mt-3 text-xs text-gray-700",children:"💡 If you're not satisfied with the changes, click the restore button to revert to the previous version."}):null;return e.jsxs("div",{ref:c,className:"sticky top-0 left-0 w-full bg-gray-100 p-4 rounded-lg overflow-hidden",children:[e.jsx(y,{title:h,isWorkflowUpdate:l,className:"p-4",children:e.jsxs("div",{className:"prose prose-sm max-w-none",children:[d==="markdow
```

**File**: `dist/copilot_web/WorkflowOption-C0yYHdbP.js` (removed, +0/-4)
```diff
@@ -1,4 +0,0 @@
-function getImportPath(filename) {
-            return `./${filename}`;
-        }
-            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{D,W as _,o as C,a as d}from"./message-components-CGVXqDj7.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as G}from"./workflowChat-c9mZt9pj.js";import"./input.js";/* empty css     */import"./App-iZNzhVOX.js";function Y({content:v,name:J="Assistant",avatar:P,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(G,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,L=n.outputs?n.outputs.length:0,q=n.widgets?n.widgets.length:0,B=Math.max(V,L)+q,u=S*B+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fi
```

**File**: `dist/copilot_web/WorkflowOption-DcX8WpSR.js` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+function getImportPath(filename) {
+            return `./${filename}`;
+        }
+            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{G as B,W as _,o as C,a as d}from"./message-components-CWGTfP0h.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as J}from"./workflowChat-CNenSvoH.js";import"./input.js";/* empty css     */import"./App-BRBPgs30.js";function Y({content:v,name:P="Assistant",avatar:R,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(J,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,G=n.outputs?n.outputs.length:0,L=n.widgets?n.widgets.length:0,q=Math.max(V,G)+L,u=S*q+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"2523
```

---

### Incident Patch 9: `b05be272` (2025-11-17)
**Commit Message**: feat: debug mem优化

**File**: `backend/service/debug_agent.py` (modified, +33/-4)
```diff
@@ -13,12 +13,20 @@
 from ..service.link_agent_tools import *
 from ..dao.workflow_table import get_workflow_data, save_workflow_data
 from ..utils.request_context import get_session_id, get_config
+from pydantic import BaseModel
+from agents import handoff, RunContextWrapper
+from agents.extensions import handoff_filters
 
 # Import ComfyUI internal modules
 import uuid
 from ..utils.logger import log
 # Load environment variables from server.env
 
+class DebugInputData(BaseModel):
+    error_message: str    
+
+async def on_debug_handoff(ctx: RunContextWrapper[None], input_data: DebugInputData):
+    print(f"Debug agent called with error message: {input_data.error_message}")
 
 @function_tool
 async def run_workflow() -> str:
@@ -303,7 +311,10 @@ async def debug_workflow_errors(workflow_data: Dict[str, Any]):
             **Remember**: Focus on making necessary structural changes, then ALWAYS transfer back to let the coordinator verify the workflow.
             """,
             tools=[get_current_workflow, get_node_info, update_workflow],
-            handoffs=[agent],
+            handoffs=[handoff(
+                agent=agent,
+                input_filter=handoff_filters.remove_all_tools,
+            )],
             config={
                 "max_tokens": 8192,
                 **config
@@ -395,7 +406,10 @@ async def debug_workflow_errors(workflow_data: Dict[str, Any]):
             """,
             tools=[analyze_missing_connections, apply_connection_fixes,
                    get_current_workflow, get_node_info],
-            handoffs=[agent],
+            handoffs=[handoff(
+                agent=agent,
+                input_filter=handoff_filters.remove_all_tools,
+            )],
             config={
                 "max_tokens": 8192,
                 **config
@@ -490,14 +504,29 @@ async def debug_workflow_errors(workflow_data: Dict[str, Any]):
             """,
             tools=[find_matching_parameter_value, get_model_files, 
                 suggest_model_download, update_workflow_parameter, get_current_workflow],
-            handoffs=[agent],
+            handoffs=[handoff(
+                agent=agent,
+                input_filter=handoff_filters.remove_all_tools,
+            )],
             config={
                 "max_tokens": 8192,
                 **config
             }
         )
 
-        agent.handoffs = [link_agent, workflow_bugfix_default_agent, parameter_agent]
+        agent.handoffs = [handoff(
+            agent=agent,
+            on_handoff=on_debug_handoff,
+            input_type=DebugInputData,
+        ), handoff(
+            agent=workflow_bugfix_default_agent,
+            on_handoff=on_debug_handoff,
+            input_type=DebugInputData,
+        ), handoff(
+            agent=parameter_agent,
+            on_handoff=on_debug_handoff,
+            input_type=DebugInputData,
+        )]
 
         # Initial message to start the debugging process
         messages = [{"role": "user", "content": f"Validate and debug this ComfyUI workflow."}]
```

---

### Incident Patch 10: `e41f21db` (2025-11-13)
**Commit Message**: Merge pull request #111 from AIDC-AI/bugfix_1113

Bugfix 1113

**File**: `dist/copilot_web/App-iZNzhVOX.js` (renamed, +2/-2)
```diff
@@ -1,7 +1,7 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-CTj3qusy.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components-CzGdQ9TQ.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
+            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-c9mZt9pj.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components-CGVXqDj7.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
                         const apiBase = window.comfyAPI?.api?.api?.api_base;
                         if (apiBase) {
                             // 有 API base 时，使用完整路径
@@ -11,4 +11,4 @@ function getImportPath(filename) {
                             return `./${path}`;
                         }
                     }))))=>i.map(i=>d[i]);
-import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components-CzGdQ9TQ.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-CTj3qusy.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
+import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components-CGVXqDj7.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-c9mZt9pj.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
```

**File**: `dist/copilot_web/DebugGuide-BOPlhVKf.js` (renamed, +1/-1)
```diff
@@ -1,5 +1,5 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as s}from"./vendor-markdown-B4Av9P7l.js";import{r as i}from"./vendor-react-ByKzdfMq.js";import{u as A,p as E,R as D,o as m,W as f,a as b}from"./message-components-CzGdQ9TQ.js";function P({content:h,name:k="Assistant",avatar:O,onAddMessage:y,onUpdateMessage:c,messageId:_}){const{dispatch:u,abortControllerRef:l}=A(),[d,w]=i.useState(!1),[T,G]=i.useState(""),[J,S]=i.useState(!1),[j,v]=i.useState(null),r=i.useMemo(()=>{try{return JSON.parse(h)}catch(e){return console.error("Failed to parse message content:",e),null}},[h]),x=i.useMemo(()=>{if(!r||!r.ext)return null;const e=r.ext.find(t=>t.type==="debug_start_checkpoint"||t.type==="debug_checkpoint"&&t.data?.checkpoint_type==="debug_start");return e&&e.data&&e.data.checkpoint_id?e.data.checkpoint_id:null},[r])||j,N=async()=>{if(d)return;const e=m(),t={id:e,role:"ai",content:JSON.stringify({text:`🔍 Starting workflow analysis...
+            import{j as s}from"./vendor-markdown-B4Av9P7l.js";import{r as i}from"./vendor-react-ByKzdfMq.js";import{u as A,p as E,R as D,o as m,W as f,a as b}from"./message-components-CGVXqDj7.js";function P({content:h,name:k="Assistant",avatar:O,onAddMessage:y,onUpdateMessage:c,messageId:_}){const{dispatch:u,abortControllerRef:l}=A(),[d,w]=i.useState(!1),[T,G]=i.useState(""),[J,S]=i.useState(!1),[j,v]=i.useState(null),r=i.useMemo(()=>{try{return JSON.parse(h)}catch(e){return console.error("Failed to parse message content:",e),null}},[h]),x=i.useMemo(()=>{if(!r||!r.ext)return null;const e=r.ext.find(t=>t.type==="debug_start_checkpoint"||t.type==="debug_checkpoint"&&t.data?.checkpoint_type==="debug_start");return e&&e.data&&e.data.checkpoint_id?e.data.checkpoint_id:null},[r])||j,N=async()=>{if(d)return;const e=m(),t={id:e,role:"ai",content:JSON.stringify({text:`🔍 Starting workflow analysis...
 `,ext:[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};y?.(t);try{f.trackEvent({event_type:"debug_trigger",message_type:"debug",message_id:e,data:{}}),await C(),u({type:"SET_LOADING",payload:!0}),await I(e)}finally{w(!1)}},C=async()=>{try{const e=await b.graphToPrompt(),t=localStorage.getItem("sessionId")||"";if(t&&e){const n=await f.saveWorkflowCheckpoint(t,e.output,e.workflow,"debug_start");if(v(n.version_id),console.log(`Saved debug start checkpoint: ${n.version_id}`),c&&r){const o=[...r.ext||[]].filter(g=>g.type!=="debug_start_checkpoint"&&!(g.type==="debug_checkpoint"&&g.data?.checkpoint_type==="debug_start"));o.push({type:"debug_start_checkpoint",data:{checkpoint_id:n.version_id,checkpoint_type:"debug_start"}});const p={id:_||m(),role:"ai",content:JSON.stringify({text:r.text,ext:o}),format:"debug_guide",name:"Assistant"};c(p)}}}catch(e){console.error("Failed to save checkpoint before debug:",e)}},I=async e=>{try{const t=await b.graphToPrompt();let n="",a=null;l&&(l.current=new AbortController);for await(const o of f.streamDebugAgent(t,l?.current?.signal||void 0))if(o.text){n=o.text,o.ext&&(a=o.ext);const p={id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};c?.(p)}c?.({id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!0,debugGuide:!0}),u({type:"SET_LOADING",payload:!1}),l.current=null}catch(t){console.error("Error calling debug agent:",t),S(!1);const a={id:e,role:"ai",content:JSON.stringify({text:`I encountered an error while analyzing your workflow: ${t.message||"Unknown error"}`,ext:[]}),format:"markdown",name:"Assistant",finished:!0};c?.(a),u({type:"SET_LOADING",payload:!1}),l.current=null}};return r?s.jsx(E,{name:k,children:s.jsxs("div",{className:"bg-gray-100 pt-4 px-4 pb-3 rounded-lg",children:[s.jsx("div",{className:"flex justify-between items-start",children:s.jsx("p",{className:"text-gray-700 text-sm flex-1",children:r.text})}),s.jsx("div",{className:"flex justify-end mt-4",children:s.jsx("button"
```

**File**: `dist/copilot_web/DebugResult-Co_oV90x.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,G as k,R as j}from"./message-components-CzGdQ9TQ.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-CTj3qusy.js";import"./input.js";/* empty css     */import"./App-fluNqnYs.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);return e.jsx(v,{className:"rounded-lg ",borderClassName:"rounded-lg",children:e.jsxs("div",{className:`flex flex-col ${d} ${i?"":"max-h-[200px]"}`,children:[e.jsxs("div",{className:"flex justify-between items-center pb-2 border-b border-gray-100",children:[e.jsx("div",{children:typeof a=="string"?e.jsx("h3",{className:"text-sm text-[#fff] font-medium",children:a}):a}),e.jsx("button",{onClick:()=>{r(!i)},children:i?e.jsx(u,{className:"text-gray-700"}):e.jsx(w,{className:"text-gray-700"})})]}),e.jsx("div",{className:"overflow-hidden flex-1",children:c})]})})};function E({content:n,name:a="Assistant",avatar:f,format:d="markdown"}){const c=p.useRef(null),i=()=>{let r=null,l=!1,o,x=[];try{if(o=JSON.parse(n),o.ext){let t=o.ext.find(s=>s.type==="workflow_rewrite_checkpoint"||s.type==="debug_checkpoint"&&s.data?.checkpoint_type==="workflow_rewrite_start");t&&t.data&&t.data.checkpoint_id?(r=t.data.checkpoint_id,l=!0):(t=o.ext.find(s=>s.type==="workflow_rewrite_complete"),t&&t.data&&t.data.version_id?(r=t.data.version_id,l=!0):(t=o.ext.find(s=>s.type==="debug_checkpoint"),t&&t.data&&t.data.checkpoint_id&&(r=t.data.checkpoint_id,l=!1))),o.ext.find(s=>s.type==="workflow_update")&&(l=!0),x=o.ext.find(s=>s.type==="param_update")?.data?.model_suggest||[]}}catch(t){return console.error("Failed to parse DebugResult content:",t),null}const h=l?e.jsxs("div",{className:"flex items-center text-green-500",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",fill:"currentColor",viewBox:"0 0 20 20",children:e.jsx("path",{fillRule:"evenodd",d:"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",clipRule:"evenodd"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Successfully"})]}):e.jsxs("div",{className:"flex items-center text-gray-900",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"28108",fill:"currentColor",children:e.jsx("path",{d:"M401.048025 844.855924c0 20.341281 16.643052 36.984333 36.984333 36.984333l147.936307 0c20.341281 0 36.984333-16.643052 36.984333-36.984333L622.952998 807.872614 401.048025 807.872614 401.048025 844.855924zM512 142.159744c-142.943596 0-258.888282 115.944686-258.888282 258.888282 0 88.021729 44.011376 165.503405 110.951975 212.288964l0 83.58365c0 20.341281 16.643052 36.984333 36.984333 36.984333l221.903949 0c20.341281 0 36.984333-16.643052 36.984333-36.984333l0-83.58365c66.941622-46.784536 110.951975-124.266212 110.951975-212.288964C770.888282 258.104429 654.943596 142.159744 512 142.159744zM617.588827 552.682561l-31.621185 22.005176 0 85.248569L438.031335 659.936307l0-85.063351L406.41015 552.866756c-49.743938-34.764781-79.33079-91.350544-79.33079-151.634536 0-101.890598 83.029018-184.92064 184.92064-184.92064s184.92064 83.029018 184.92064 184.92064C696.919617 461.332017 667.332764 517.91778 617.588827 552.682561z","p-id":"28277"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Finished"})]}),m=l?e.jsx("div",{className:"mt-3 text-xs text-gray-700",children:"💡 If you're not satisfied with the changes, click the restore button to revert to the previous version."}):null;return e.jsxs("div",{ref:c,className:"sticky top-0 left-0 w-full bg-gray-100 p-4 rounded-lg overflow-hidden",children:[e.jsx(y,{title:h,isWorkflowUpdate:l,className:"p-4",children:e.jsxs("div",{className:"prose prose-sm max-w-none",children:[d==="markdow
```

**File**: `dist/copilot_web/WorkflowOption-C0yYHdbP.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{D,W as _,o as C,a as d}from"./message-components-CzGdQ9TQ.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as G}from"./workflowChat-CTj3qusy.js";import"./input.js";/* empty css     */import"./App-fluNqnYs.js";function Y({content:v,name:J="Assistant",avatar:P,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(G,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,L=n.outputs?n.outputs.length:0,q=n.widgets?n.widgets.length:0,B=Math.max(V,L)+q,u=S*B+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fi
```

**File**: `dist/copilot_web/message-components-CGVXqDj7.js` (renamed, +1/-1)
```diff
@@ -330,7 +330,7 @@ html body {
               > ${e}-wrapper:only-child,
               > ${e}-expanded-row-fixed > ${e}-wrapper:only-child
             `]:{[e]:{marginBlock:se(b(n).mul(-1).equal()),marginInline:`${se(b(o).sub(i).equal())}
-                ${se(b(i).mul(-1).equal())}`,[`${e}-tbody > tr:last-child > td`]:{borderBottomWidth:0,"&:first-child, &:last-child":{borderRadius:0}}}}},"> th":{position:"relative",color:h,fontWeight:r,textAlign:"start",background:g,borderBottom:$,transition:`background ${v} ease`}}},[`${e}-footer`]:{padding:`${se(n)} ${se(i)}`,color:p,background:y}})}},mZ=t=>{const{colorFillAlter:e,colorBgContainer:r,colorTextHeading:n,colorFillSecondary:i,colorFillContent:o,controlItemBgActive:a,controlItemBgActiveHover:s,padding:l,paddingSM:c,paddingXS:u,colorBorderSecondary:f,borderRadiusLG:h,controlHeight:v,colorTextPlaceholder:g,fontSize:m,fontSizeSM:p,lineHeight:y,lineWidth:b,colorIcon:$,colorIconHover:S,opacityLoading:w,controlInteractiveSize:C}=t,E=new Ut(i).onBackground(r).toHexString(),O=new Ut(o).onBackground(r).toHexString(),x=new Ut(e).onBackground(r).toHexString(),I=new Ut($),T=new Ut(S),N=C/2-b,P=N*2+b*3;return{headerBg:x,headerColor:n,headerSortActiveBg:E,headerSortHoverBg:O,bodySortBg:x,rowHoverBg:x,rowSelectedBg:a,rowSelectedHoverBg:s,rowExpandedBg:e,cellPaddingBlock:l,cellPaddingInline:l,cellPaddingBlockMD:c,cellPaddingInlineMD:u,cellPaddingBlockSM:u,cellPaddingInlineSM:u,borderColor:f,headerBorderRadius:h,footerBg:x,footerColor:n,cellFontSize:m,cellFontSizeMD:m,cellFontSizeSM:m,headerSplitColor:f,fixedHeaderSortActiveBg:E,headerFilterHoverBg:o,filterDropdownMenuBg:r,filterDropdownBg:r,expandIconBg:r,selectionColumnWidth:v,stickyScrollBarBg:g,stickyScrollBarBorderRadius:100,expandIconMarginTop:(m*y-b*3)/2-Math.ceil((p*1.4-b*3)/2),headerIconColor:I.clone().setA(I.a*w).toRgbString(),headerIconHoverColor:T.clone().setA(T.a*w).toRgbString(),expandIconHalfInner:N,expandIconSize:P,expandIconScale:C/P}},dO=2,yZ=Gr("Table",t=>{const{colorTextHeading:e,colorSplit:r,colorBgContainer:n,controlInteractiveSize:i,headerBg:o,headerColor:a,headerSortActiveBg:s,headerSortHoverBg:l,bodySortBg:c,rowHoverBg:u,rowSelectedBg:f,rowSelectedHoverBg:h,rowExpandedBg:v,cellPaddingBlock:g,cellPaddingInline:m,cellPaddingBlockMD:p,cellPaddingInlineMD:y,cellPaddingBlockSM:b,cellPaddingInlineSM:$,borderColor:S,footerBg:w,footerColor:C,headerBorderRadius:E,cellFontSize:O,cellFontSizeMD:x,cellFontSizeSM:I,headerSplitColor:T,fixedHeaderSortActiveBg:N,headerFilterHoverBg:P,filterDropdownBg:_,expandIconBg:R,selectionColumnWidth:M,stickyScrollBarBg:D,calc:j}=t,k=Xt(t,{tableFontSize:O,tableBg:n,tableRadius:E,tablePaddingVertical:g,tablePaddingHorizontal:m,tablePaddingVerticalMiddle:p,tablePaddingHorizontalMiddle:y,tablePaddingVerticalSmall:b,tablePaddingHorizontalSmall:$,tableBorderColor:S,tableHeaderTextColor:a,tableHeaderBg:o,tableFooterTextColor:C,tableFooterBg:w,tableHeaderCellSplitColor:T,tableHeaderSortBg:s,tableHeaderSortHoverBg:l,tableBodySortBg:c,tableFixedHeaderSortActiveBg:N,tableHeaderFilterActiveBg:P,tableFilterDropdownBg:_,tableRowHoverBg:u,tableSelectedRowBg:f,tableSelectedRowHoverBg:h,zIndexTableFixed:dO,zIndexTableSticky:j(dO).add(1).equal({unit:!1}),tableFontSizeMiddle:x,tableFontSizeSmall:I,tableSelectionColumnWidth:M,tableExpandIconBg:R,tableExpandColumnWidth:j(i).add(j(t.padding).mul(2)).equal(),tableExpandedRowBg:v,tableFilterDropdownWidth:120,tableFilterDropdownHeight:264,tableFilterDropdownSearchWidth:140,tableScrollThumbSize:8,tableScrollThumbBg:D,tableScrollThumbBgHover:e,tableScrollBg:r});return[gZ(k),lZ(k),uO(k),hZ(k),aZ(k),rZ(k),cZ(k),oZ(k),uO(k),iZ(k),dZ(k),sZ(k),vZ(k),nZ(k),fZ(k),uZ(k),pZ(k)]},mZ,{unitless:{expandIconScale:!0}}),bZ=[],$Z=(t,e)=>{var r,n;const{prefixCls:i,className:o,rootClassName:a,style:s,size:l,bordered:c,dropdownPrefixCls:u,dataSource:f,pagination:h,rowSelection:v,rowKey:g="key",rowClassName:m,columns:p,children:y,childrenColumnName:b,onChange:$,getPopupContainer:S,loading:w,
```

#### Recent Merged Pull Requests:
- **PR #159** (closed): Add ROADMAP.md (@mdc159)
- **PR #157** (2026-09-11): test: update README_CN (@llysuda)
- **PR #117** (2025-12-01): feat:修复添加节点位置偏移问题 (@lltt90511)
- **PR #115** (closed): Claude/session 011 cu yqn1 b63t5 s8 ulgab ynr (@DataSparBrian)
- **PR #114** (2025-11-25): Bugfix 1125 (@lltt90511)
- **PR #113** (2025-11-20): Bugfix 1120 (@lltt90511)
- **PR #111** (2025-11-13): Bugfix 1113 (@lltt90511)
- **PR #103** (2025-10-10): Bugfix 1010 (@lltt90511)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.

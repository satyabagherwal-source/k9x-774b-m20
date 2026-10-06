# Forensic Learning Record (Deep Inspection): ATH-MaaS/ComfyUI-Copilot

> **Canonical Artifact**: `07_PROJECT_LEARNING/ath-maas-comfyui-copilot-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/ATH-MaaS/ComfyUI-Copilot](https://github.com/ATH-MaaS/ComfyUI-Copilot))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T05:22:25.946Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `ATH-MaaS/ComfyUI-Copilot`
- **Description**: An AI-powered custom node for ComfyUI designed to enhance workflow automation and provide intelligent assistance
- **Primary Language / Ecosystem**: TypeScript
- **Discovered Manifests / Configurations**: pyproject.toml, README.md
- **Stars / Engagement**: 5538 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: pyproject.toml, README.md.
- Evaluated system abstractions and modular contracts.

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

### Core Architecture Module: `backend/utils/auth_utils.py`
```
# Copyright (C) 2025 AIDC-AI
# Licensed under the MIT License.

"""
Authentication utilities for ComfyUI Copilot
"""

from typing import Optional
from .globals import set_comfyui_copilot_api_key, get_comfyui_copilot_api_key
from .logger import log

def extract_and_store_api_key(request) -> Optional[str]:
    """
    Extract Bearer token from Authorization header and store it in globals
    
    Args:
        request: The aiohttp request object
        
    Returns:
        The extracted API key if successful, None otherwise
    """
    try:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            api_key = auth_header[7:]  # Remove 'Bearer ' prefix
            set_comfyui_copilot_api_key(api_key)
            log.info(f"ComfyUI Copilot API key extracted and stored: {api_key[:12]}...")
            
            # Verify it's stored correctly
            stored_key = get_comfyui_copilot_api_key()
            if stored_key == api_key:
                log.info("API key verification: Successfully stored in globals")
            else:
                log.error("API key verification: Storage failed")
                
            return api_key
        else:
            log.error("No valid Authorization header found")
            return None
    except Exception as e:
        log.error(f"Error extracting API key: {str(e)}")
        return None

```

### Core Architecture Module: `backend/utils/comfy_gateway.py`
```
"""
ComfyUI Gateway Utilities

This module provides Python implementations of ComfyUI API functions,
using HTTP requests to the ComfyUI server for consistency.
"""

import json
import os
import uuid
import logging
import asyncio
from typing import Dict, Any, Optional, List

# Import ComfyUI internal modules
import nodes
import execution
import folder_paths
import server
import aiohttp


class ComfyGateway:
    """ComfyUI API Gateway for Python backend - uses internal functions instead of HTTP requests"""
    
    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize ComfyUI Gateway
        
        Args:
            base_url: Optional base URL for ComfyUI server. If not provided, will auto-detect.
        """
        # Get server instance for operations that need it
        self.server_instance = server.PromptServer.instance
        
        # Auto-detect server URL if not provided
        if base_url:
            self.base_url = base_url.rstrip('/')
        else:
            # Auto-detect from server instance
            if hasattr(self.server_instance, 'address') and hasattr(self.server_instance, 'port'):
                address = self.server_instance.address or '127.0.0.1'
                port = self.server_instance.port or 8188
                # Use 127.0.0.1 for localhost to avoid potential connection issues
                if address in ['0.0.0.0', '::']:
                    address = '127.0.0.1'
                self.base_url = f"http://{address}:{port}"
            else:
                # Fallback to default
                self.base_url = "http://127.0.0.1:8188"
        
        logging.info(f"ComfyGateway initialized with base_url: {self.base_url}")

    async def run_prompt(self, json_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Run a prompt - HTTP call to ComfyUI /api/prompt endpoint
        
        This method sends an HTTP POST request to the ComfyUI server's /api/prompt endpoint
        to ensure consistent behavior and avoid code duplication.
        
        Args:
            json_data: The prompt/workflow data in the same format as HTTP API
            
        Returns:
            Dict containing the validation result, similar to HTTP API response
        """
        try:
            # Create a timeout configuration
            timeout = aiohttp.ClientTimeout(total=30)  # 30 second timeout
            
            # Make HTTP request to /api/prompt endpoint
            url = f"{self.base_url}/api/prompt"
            headers = {
                'Content-Type': 'application/json'
            }
            

            # Create temporary session
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, json=json_data, headers=headers) as response:
                    response_data = await response.json()
                    status_code = response.status
            
            # Handle the response based on status code
            if status_code == 200:
                # Success response - add success flag for consistency
                return {
                    "success": True,
                    **response_data
                }
            else:
                # Error response (400, etc.) - add success flag for consistency
                return {
                    "success": False,
                    **response_data
                }
                
        except aiohttp.ClientConnectionError as e:
            logging.error(f"Connection error in run_prompt: {e}")
            return {
                "success": False,
                "error": {
                    "type": "connection_error",
                    "message": f"Failed to connect to ComfyUI server at {self.base_url}",
                    "details": str(e)
                },
                "node_errors": {}
            }
        except aiohttp.ClientTimeout as e:
            logging.error(f"Timeout error in run_prompt: {e}")
            return {
                "success": False,
                "error": {
                    "type": "timeout_error",
                    "message": "Request to ComfyUI server timed out",
                    "details": str(e)
                },
                "node_errors": {}
            }
        except Exception as e:
            logging.error(f"Error in run_prompt: {e}")
            return {
                "success": False,
                "error": {
                    "type": "internal_error",
                    "message": f"Internal error: {str(e)}",
                    "details": str(e)
                },
                "node_errors": {}
            }

    async def get_object_info(self, node_class: Optional[str] = None) -> Dict[str, Any]:
        """
        Get ComfyUI node definitions - HTTP call to ComfyUI /api/object_info endpoint
        
        Args:
            node_class: Optional specific node class to get info for
            
        Returns:
            Dict containing node definitions and their parameters
        """
        try:
            # Create a timeout configuration
            timeout = aiohttp.ClientTimeout(total=30)  # 30 second timeout
            
            # Build URL - either specific node or all nodes
            if node_class:
                url = f"{self.base_url}/api/object_info/{node_class}"
            else:
                url = f"{self.base_url}/api/object_info"
            
            # Make HTTP request to /api/object_info endpoint
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.get(url) as response:
                    if response.status == 200:
                        return await response.json()
                    else:
                        logging.error(f"Failed to get object info: HTTP {response.status}")
                        return {}
                        
        except aiohttp.ClientConnectionError as e:
            logging.error(f"Connection error in get_object_info: {e}")
            return {}
        except aiohttp.ClientTimeout as e:
            logging.error(f"Timeout error in get_object_info: {e}")
            return {}
        except Exception as e:
            logging.error(f"Error getting object info: {e}")
            return {}

    async def get_installed_nodes(self) -> List[str]:
        """
        Get list of installed node types - HTTP call to ComfyUI /api/object_info endpoint
        
        Returns:
            List of installed node type names
        """
        try:
            object_info = await self.get_object_info()
            return list(object_info.keys())
        except Exception as e:
            logging.error(f"Error getting installed nodes: {e}")
            return []

    async def manage_queue(self, clear: bool = False, delete: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Clear the prompt queue or delete specific queue items - HTTP call to ComfyUI /api/queue endpoint
        
        Args:
            clear: If True, clears the entire queue
            delete: List of prompt IDs to delete from the queue
            
        Returns:
            Dict with the response from the queue management operation
        """
        try:
            # Create a timeout configuration
            timeout = aiohttp.ClientTimeout(total=30)  # 30 second timeout
            
            # Prepare request data
            json_data = {}
            if clear:
                json_data["clear"] = True
            if delete:
                json_data["delete"] = delete
            
            # Make HTTP request to /api/queue endpoint
            url = f"{self.base_url}/api/queue"
            headers = {
                'Content-Type': 'application/json'
            }
            
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, json=json_data, headers=headers) as response:
                    if response.status == 200:
                        return {"success": True}
                    else:
                        logging.error(f"Failed to manage queue: HTTP {response.status}")
                        return {"error": f"HTTP {response.status}"}
                        
        except aiohttp.ClientConnectionError as e:
            logging.error(f"Connection error in manage_queue: {e}")
            return {"error": f"Connection error: {str(e)}"}
        except aiohttp.ClientTimeout as e:
            logging.error(f"Timeout error in manage_queue: {e}")
            return {"error": f"Timeout error: {str(e)}"}
        except Exception as e:
            logging.error(f"Error managing queue: {e}")
            return {"error": f"Failed to manage queue: {str(e)}"}

    async def interrupt_processing(self) -> Dict[str, Any]:
        """
        Interrupt the current processing/generation - HTTP call to ComfyUI /api/interrupt endpoint
        
        Returns:
            Dict with the response from the interrupt operation
        """
        try:
            # Create a timeout configuration
            timeout = aiohttp.ClientTimeout(total=30)  # 30 second timeout
            
            # Make HTTP request to /api/interrupt endpoint
            url = f"{self.base_url}/api/interrupt"
            headers = {
                'Content-Type': 'application/json'
            }
            
            async with aiohttp.ClientSession(timeout=timeout) as session:
                async with session.post(url, headers=headers) as response:
                    if response.status == 200:
                        return {"success": True}
                    else:
                        logging.error(f"Failed to interrupt processing: HTTP {response.status}")
                        return {"error": f"HTTP {response.status}"}
                        
        except aiohttp.ClientConnectionError as e:
            logging.error(f"Connection error in interrupt_processin
```

### Core Architecture Module: `backend/utils/globals.py`
```
'''
Author: ai-business-hql qingli.hql@alibaba-inc.com
Date: 2025-08-08 17:14:52
LastEditors: ai-business-hql ai.bussiness.hql@gmail.com
LastEditTime: 2025-12-15 14:49:18
FilePath: /comfyui_copilot/backend/utils/globals.py
Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
'''

"""
Global utilities for managing application-wide state and configuration.
"""

import os
import threading
from typing import Optional, Dict, Any
from pathlib import Path
from dotenv import load_dotenv

# Load .env file if it exists
env_path = Path(__file__).parent.parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)

class GlobalState:
    """Thread-safe global state manager for application-wide configuration."""
    
    def __init__(self):
        self._lock = threading.RLock()
        self._state: Dict[str, Any] = {
            'LANGUAGE': 'en',  # Default language
        }
    
    def get(self, key: str, default: Any = None) -> Any:
        """Get a global state value."""
        with self._lock:
            return self._state.get(key, default)
    
    def set(self, key: str, value: Any) -> None:
        """Set a global state value."""
        with self._lock:
            self._state[key] = value
    
    def get_language(self) -> str:
        """Get the current language setting."""
        return self.get('LANGUAGE', 'en')
    
    def set_language(self, language: str) -> None:
        """Set the current language setting."""
        self.set('LANGUAGE', language)
    
    def update(self, **kwargs) -> None:
        """Update multiple state values at once."""
        with self._lock:
            self._state.update(kwargs)
    
    def get_all(self) -> Dict[str, Any]:
        """Get a copy of all global state."""
        with self._lock:
            return self._state.copy()

# Global instance
_global_state = GlobalState()

# Convenience functions for external access
def get_global(key: str, default: Any = None) -> Any:
    """Get a global state value."""
    return _global_state.get(key, default)

def set_global(key: str, value: Any) -> None:
    """Set a global state value."""
    _global_state.set(key, value)

def get_language() -> str:
    """Get the current language setting."""
    language = _global_state.get_language()
    if not language:
        language = 'en'
    return language

def set_language(language: str) -> None:
    """Set the current language setting."""
    _global_state.set_language(language)

def update_globals(**kwargs) -> None:
    """Update multiple global values at once."""
    _global_state.update(**kwargs)

def get_all_globals() -> Dict[str, Any]:
    """Get a copy of all global state."""
    return _global_state.get_all()

def get_comfyui_copilot_api_key() -> Optional[str]:
    """Get the ComfyUI Copilot API key."""
    return _global_state.get('comfyui_copilot_api_key')

def set_comfyui_copilot_api_key(api_key: str) -> None:
    """Set the ComfyUI Copilot API key."""
    _global_state.set('comfyui_copilot_api_key', api_key)


BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "https://comfyui-copilot-server.onrender.com")
LMSTUDIO_DEFAULT_BASE_URL = "http://localhost:1234/v1"
WORKFLOW_MODEL_NAME = os.getenv("WORKFLOW_MODEL_NAME", "us.anthropic.claude-sonnet-4-20250514-v1:0")
# WORKFLOW_MODEL_NAME = "gpt-5-2025-08-07-GlobalStandard"
LLM_DEFAULT_BASE_URL = "https://comfyui-copilot-server.onrender.com/v1"

# LLM-related env defaults (used as fallback when request config does not provide values)
OPENAI_API_KEY = os.getenv("CC_OPENAI_API_KEY") or None
OPENAI_BASE_URL = os.getenv("CC_OPENAI_BASE_URL") or None
WORKFLOW_LLM_API_KEY = os.getenv("WORKFLOW_LLM_API_KEY") or None
WORKFLOW_LLM_BASE_URL = os.getenv("WORKFLOW_LLM_BASE_URL") or None
# If WORKFLOW_LLM_MODEL is not set, fall back to WORKFLOW_MODEL_NAME
WORKFLOW_LLM_MODEL = os.getenv("WORKFLOW_LLM_MODEL") or WORKFLOW_MODEL_NAME
DISABLE_WORKFLOW_GEN = os.getenv("DISABLE_WORKFLOW_GEN") or False

TENANT_ID = os.getenv("TENANT_ID") or None

def apply_llm_env_defaults(config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Apply LLM-related defaults with precedence:
    request config > .env > hard-coded defaults.

    This function does NOT mutate the incoming config.
    """
    cfg: Dict[str, Any] = dict(config or {})

    # Chat LLM (OpenAI-compatible) settings
    if not cfg.get("openai_api_key") and OPENAI_API_KEY:
        cfg["openai_api_key"] = OPENAI_API_KEY
    if not cfg.get("openai_base_url") and OPENAI_BASE_URL:
        cfg["openai_base_url"] = OPENAI_BASE_URL

    # Workflow LLM settings (tools/agents that might use a different LLM)
    if not cfg.get("workflow_llm_api_key") and WORKFLOW_LLM_API_KEY:
        cfg["workflow_llm_api_key"] = WORKFLOW_LLM_API_KEY
    if not cfg.get("workflow_llm_base_url") and WORKFLOW_LLM_BASE_URL:
        cfg["workflow_llm_base_url"] = WORKFLOW_LLM_BASE_URL
    if not cfg.get("workflow_llm_model") and WORKFLOW_LLM_MODEL:
        cfg["workflow_llm_model"] = WORKFLOW_LLM_MODEL

    return cfg


def is_lmstudio_url(base_url: str) -> bool:
    """Check if the base URL is likely LMStudio based on common patterns."""
    if not base_url:
        return False

    base_url_lower = base_url.lower()
    # Common LMStudio patterns (supporting various ports and configurations)
    lmstudio_patterns = [
        "localhost:1234",        # Standard LMStudio port
        "127.0.0.1:1234",
        "0.0.0.0:1234",
        ":1234/v1",
        "localhost:1235",        # Alternative port some users might use
        "127.0.0.1:1235",
        "0.0.0.0:1235",
        ":1235/v1",
        "localhost/v1",          # Generic localhost patterns
        "127.0.0.1/v1"
    ]

    return any(pattern in base_url_lower for pattern in lmstudio_patterns)

```

### Core Architecture Module: `backend/utils/key_utils.py`
```
'''
Author: ai-business-hql ai.bussiness.hql@gmail.com
Date: 2025-10-11 16:46:10
LastEditors: ai-business-hql ai.bussiness.hql@gmail.com
LastEditTime: 2025-10-15 14:35:41
FilePath: /ComfyUI-Copilot/backend/utils/key_utils.py
Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
'''
from copy import deepcopy

def workflow_config_adapt(config: dict) -> dict:
    """Return a deep-copied and adapted workflow config without mutating input.

    - Map workflow_llm_api_key -> openai_api_key (and null out original key)
    - Map workflow_llm_base_url -> openai_base_url (and null out original key)
    """
    if not config:
        return {}

    new_config = deepcopy(config)

    if new_config.get("workflow_llm_api_key"):
        new_config["openai_api_key"] = new_config.get("workflow_llm_api_key")
        new_config["workflow_llm_api_key"] = None
    if new_config.get("workflow_llm_base_url"):
        new_config["openai_base_url"] = new_config.get("workflow_llm_base_url")
        new_config["workflow_llm_base_url"] = None
    if new_config.get("workflow_llm_model"):
        new_config["model_select"] = new_config.get("workflow_llm_model")
        new_config["workflow_llm_model"] = None
    else:
        new_config["model_select"] = None

    return new_config

```

### Core Architecture Module: `backend/utils/logger.py`
```
"""
Logging utility module using Python standard library logging with file location info.
"""

import logging
import logging.handlers
import sys
import os
import inspect
from datetime import datetime
import io


class LocationFormatter(logging.Formatter):
    """Custom formatter that adds file location information."""
    
    def format(self, record):
        # Use location info if provided via extra, otherwise extract from record
        if not hasattr(record, 'location'):
            # Fallback: extract from record itself
            filename = os.path.basename(record.pathname) if record.pathname else "unknown"
            function_name = record.funcName if record.funcName else "unknown"
            line_number = record.lineno if record.lineno else 0
            record.location = f"{filename}:{function_name}:{line_number}"
        
        return super().format(record)


def setup_logger():
    """Setup the main logger with console and file handlers."""
    # Create logger
    logger = logging.getLogger('comfyui_copilot')
    logger.setLevel(logging.DEBUG)
    
    # Prevent duplicate logs
    if logger.handlers:
        return logger
    
    # Console handler with safer encoding handling on Windows consoles
    # Prefer reconfiguring the existing stderr to replace unencodable chars
    if hasattr(sys.stderr, "reconfigure"):
        try:
            sys.stderr.reconfigure(errors="replace")
        except Exception:
            pass
        console_handler = logging.StreamHandler(sys.stderr)
    else:
        # Fallback: wrap the underlying buffer with a TextIOWrapper that replaces errors
        try:
            encoding = getattr(sys.stderr, "encoding", None) or "utf-8"
            console_stream = io.TextIOWrapper(sys.stderr.buffer, encoding=encoding, errors="replace")
            console_handler = logging.StreamHandler(console_stream)
        except Exception:
            console_handler = logging.StreamHandler(sys.stderr)
    console_handler.setLevel(logging.DEBUG)
    
    # Console formatter with colors (simple format for better compatibility)
    console_format = '%(asctime)s | %(levelname)-8s | %(location)s | %(message)s'
    console_formatter = LocationFormatter(console_format, datefmt='%Y-%m-%d %H:%M:%S')
    console_handler.setFormatter(console_formatter)
    
    # File handler
    log_dir = os.path.join(os.path.dirname(__file__), "..", "logs")
    os.makedirs(log_dir, exist_ok=True)
    
    file_handler = logging.handlers.RotatingFileHandler(
        os.path.join(log_dir, "comfyui_copilot.log"),
        maxBytes=10*1024*1024,  # 10MB
        backupCount=7,
        encoding='utf-8'
    )
    file_handler.setLevel(logging.DEBUG)
    
    # File formatter
    file_format = '%(asctime)s | %(levelname)-8s | %(location)s | %(message)s'
    file_formatter = LocationFormatter(file_format, datefmt='%Y-%m-%d %H:%M:%S')
    file_handler.setFormatter(file_formatter)
    
    # Add handlers to logger
    logger.addHandler(console_handler)
    logger.addHandler(file_handler)
    
    return logger


class Logger:
    """Logger wrapper that provides convenient logging methods with automatic location detection."""
    
    def __init__(self, name=None):
        self._logger = setup_logger()
        if name:
            self._logger = logging.getLogger(f'comfyui_copilot.{name}')
            self._logger.setLevel(logging.DEBUG)
            # Prevent propagation to parent logger to avoid duplicate messages
            self._logger.propagate = False
            
            # Copy handlers from parent logger if the named logger doesn't have any
            if not self._logger.handlers:
                parent_logger = logging.getLogger('comfyui_copilot')
                for handler in parent_logger.handlers:
                    self._logger.addHandler(handler)
    
    def _log_with_location(self, level, message, *args, **kwargs):
        """Log message with automatic location detection."""
        # Get the caller's frame (2 levels up: _log_with_location -> debug/info/etc -> actual caller)
        frame = inspect.currentframe().f_back.f_back
        try:
            filename = os.path.basename(frame.f_code.co_filename)
            function_name = frame.f_code.co_name
            line_number = frame.f_lineno
            
            # Create a log record manually to ensure no duplicate processing
            if self._logger.isEnabledFor(level):
                record = self._logger.makeRecord(
                    self._logger.name, level, frame.f_code.co_filename, line_number,
                    message, args, None, function_name
                )
                record.location = f"{filename}:{function_name}:{line_number}"
                
                # Process the record through handlers directly to avoid duplication
                for handler in self._logger.handlers:
                    if record.levelno >= handler.level:
                        handler.handle(record)
        finally:
            del frame
    
    def debug(self, message, *args, **kwargs):
        """Log debug message."""
        self._log_with_location(logging.DEBUG, message, *args, **kwargs)
    
    def info(self, message, *args, **kwargs):
        """Log info message."""
        self._log_with_location(logging.INFO, message, *args, **kwargs)
    
    def warning(self, message, *args, **kwargs):
        """Log warning message."""
        self._log_with_location(logging.WARNING, message, *args, **kwargs)
    
    def warn(self, message, *args, **kwargs):
        """Log warning message (alias for warning)."""
        self.warning(message, *args, **kwargs)
    
    def error(self, message, *args, **kwargs):
        """Log error message."""
        self._log_with_location(logging.ERROR, message, *args, **kwargs)
    
    def critical(self, message, *args, **kwargs):
        """Log critical message."""
        self._log_with_location(logging.CRITICAL, message, *args, **kwargs)
    
    def exception(self, message, *args, **kwargs):
        """Log exception message with traceback."""
        # For exceptions, we want to use the standard logger.exception which includes traceback
        frame = inspect.currentframe().f_back
        try:
            filename = os.path.basename(frame.f_code.co_filename)
            function_name = frame.f_code.co_name
            line_number = frame.f_lineno
            
            # Use the standard exception logging with location info
            self._logger.exception(message, *args, **kwargs, 
                                 extra={'location': f"{filename}:{function_name}:{line_number}"},
                                 stacklevel=2)
        finally:
            del frame


# Create default logger instance
log = Logger()

# For backward compatibility and convenience
debug = log.debug
info = log.info
warning = log.warning
warn = log.warn
error = log.error
critical = log.critical
exception = log.exception

# Allow creating named loggers
def get_logger(name=None):
    """Get a logger instance, optionally with a specific name."""
    return Logger(name)


__all__ = [
    'log', 'Logger', 'get_logger',
    'debug', 'info', 'warning', 'warn', 'error', 'critical', 'exception'
]
```

### Core Architecture Module: `backend/utils/modelscope_gateway.py`
```
'''
Author: ai-business-hql ai.bussiness.hql@gmail.com
Date: 2025-08-26 15:06:47
LastEditors: ai-business-hql ai.bussiness.hql@gmail.com
LastEditTime: 2025-09-01 19:31:03
FilePath: /ComfyUI-Copilot/backend/utils/modelscope_gateway.py
Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
'''
import os
from typing import Any, Dict, List, Optional

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from .logger import log
import folder_paths


class ModelScopeGateway:
    BASE_URL = "https://www.modelscope.cn"
    SUGGEST_ENDPOINT = f"{BASE_URL}/api/v1/dolphin/model/suggestv2"
    SEARCH_ENDPOINT = f"{BASE_URL}/api/v1/dolphin/models"
    SEARCH_SINGLE_ENDPOINT = f"{BASE_URL}/api/v1/models"
    
    def __init__(self, timeout: float = 10.0, retries: int = 3, backoff: float = 0.5):
        self.timeout = timeout

        # 单实例 Session，会自动保存 Cookie；如需按用户隔离可按 session_key 做多 Session 管理
        self.session = requests.Session()
        self.session.headers.update({
            "Accept": "application/json, text/plain, */*",
            "Content-Type": "application/json",
            "User-Agent": "ComfyUI-Copilot/1.0 (requests)",
            "x-modelscope-accept-language": "zh_CN",
        })

        retry_cfg = Retry(
            total=retries,
            backoff_factor=backoff,
            status_forcelist=[429, 500, 502, 503, 504],
            allowed_methods=["GET", "POST", "PUT"],
            raise_on_status=False,
        )
        adapter = HTTPAdapter(max_retries=retry_cfg)
        self.session.mount("https://", adapter)
        self.session.mount("http://", adapter)

    def formatData(self, data: Any) -> Dict[str, Any]:
        inner = data.get('Model', {}) if isinstance(data, dict) else {}
        path = data.get('Path') or inner.get('Path')
        name = data.get('Name') or inner.get('Name')
        revision = data.get('Revision') or inner.get('Revision')
        # size = self.get_model_size(path, name, revision)
        return {
            "Libraries": data.get("Libraries") or inner.get("Libraries"),
            "ChineseName": data.get("ChineseName") or inner.get("ChineseName"),
            "Id": data.get("Id") or inner.get("Id") or data.get("ModelId") or inner.get("ModelId"),
            "Name": data.get("Name") or inner.get("Name"),
            "Path": data.get("Path") or inner.get("Path"),
            "LastUpdatedTime": data.get("LastUpdatedTime") or inner.get("LastUpdatedTime") or data.get("LastUpdatedAt") or inner.get("LastUpdatedAt"),
            "Downloads": data.get("Downloads") or inner.get("Downloads") or data.get("DownloadCount") or inner.get("DownloadCount"),
            # "Size": size or 0
        }

    def get_single_model(self, path: str, name: str) -> Optional[Dict[str, Any]]:
        """
        调用单模型详情接口。
        返回原始 JSON（尽量保持结构，便于 formatData 处理），失败返回 None。
        """
        if path is None or name is None:
            return None
        try:
            url = f"{self.SEARCH_SINGLE_ENDPOINT}/{path}/{name}"
            resp = self.session.get(url, timeout=self.timeout)
            resp.raise_for_status()
            body = resp.json()
            # 兼容不同返回包裹层级
            if isinstance(body, dict):
                data = body.get("Data") or body.get("data") or body
                return data
            return body
        except Exception as e:
            log.error(f"ModelScope single fetch failed for path={path}: name={name}: {e}")
            return None
        
    def get_model_size(self, path: str, name: str, revision: str, root: str = '') -> int:
        """
        调用单模型详情接口。
        返回原始 JSON（尽量保持结构，便于 formatData 处理），失败返回 None。
        """
        if path is None or name is None or revision is None:
            return 0
        try:
            url = f"{self.SEARCH_SINGLE_ENDPOINT}/{path}/{name}/repo/files?Revision={revision}&Root={root}"
            resp = self.session.get(url, timeout=self.timeout)
            resp.raise_for_status()
            body = resp.json()
            # 兼容不同返回包裹层级
            if isinstance(body, dict):
                data = body["Data"]["Files"]
                size = 0
                for item in data:
                    size += item.get("Size") or 0
                return size
            return 0
        except Exception as e:
            log.error(f"ModelScope model size fetch failed for path={path}: name={name}: rversion={rversion}: {e}")
            return 0
    
    def suggest(
        self,
        name: str,
        page: int = 1,
        page_size: int = 30,
        sort_by: str = "Default",
        target: str = "",
        single_criterion: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        调用 suggestv2 模糊搜索接口；返回 body 与当前 Cookie。
        
        Returns:
            Dict[str, Any]: 返回的模型列表，格式为：
            {
                "data": [
                    {
                        "ChineseName": "中文名称",
                        "Id": 294066,
                        "Name": "SD3-Controlnet-Pose",
                        "Path": "InstantX",
                        "Libraries": ["pytorch","lora","safetensors"],
                        "LastUpdatedTime": "1733042611",
                        "Downloads": 100,
                        "Size": 100000
                    }
                ]
            }
        """
        payload = {
            "PageSize": page_size,
            "PageNumber": page,
            "SortBy": sort_by,
            "Target": target,
            "SingleCriterion": single_criterion or [],
            "Name": name,
        }

        resp = self.session.post(
            self.SUGGEST_ENDPOINT,
            json=payload,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        body = resp.json()
        if body['Data'] is None or body['Data']['Model'] is None \
        or body['Data']['Model']['Suggests'] is None or (len(body['Data']['Model']['Suggests']) == 0):
            log.error(f"ModelScope suggest failed: {body}, request: {payload}")
            return {"data": None}
        models = body['Data']['Model']['Suggests']
        picked: List[Dict[str, Any]] = []
        for item in models:
            base = item or {}
            inner = base.get('Model', {}) if isinstance(base, dict) else {}
            path = base.get('Path') or inner.get('Path')
            name = base.get('Name') or inner.get('Name')
            detail= self.get_single_model(path, name)
            data = self.formatData(detail or base)
            picked.append(data)
        total = body['Data']['Model'].get('TotalCount') or body['Data']['Model'].get('Total') or 0
        return {"data": picked, "total": total}

    def search(
        self,
        name: str,
        page: int = 1,
        page_size: int = 30,
        sort_by: str = "Default",
        target: str = "",
        single_criterion: Optional[List[Dict[str, Any]]] = None,
        criterion: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """
        调用 models 模糊搜索接口；返回 body 与当前 Cookie。
        
        Returns:
            Dict[str, Any]: 返回的模型列表，格式为：
            {
                "data": [
                    {
                        "ChineseName": "中文名称",
                        "Id": 294066,
                        "Name": "SD3-Controlnet-Pose",
                        "Path": "InstantX",
                        "Libraries": ["pytorch","lora","safetensors"],
                        "LastUpdatedTime": "1733042611",
                        "Downloads": 100,
                        "Size": 100000
                    }
                ]
            }
        """
        payload = {
            "PageSize": page_size,
            "PageNumber": page,
            "SortBy": sort_by,
            "Target": target,
            "SingleCriterion": single_criterion or [],
            "Name": name,
            "Criterion" : criterion
        }

        resp = self.session.put(
            self.SEARCH_ENDPOINT,
            json=payload,
            timeout=self.timeout,
        )
        resp.raise_for_status()
        body = resp.json()
        if body['Data'] is None or body['Data']['Model'] is None \
        or body['Data']['Model']['Models'] is None or (len(body['Data']['Model']['Models']) == 0):
            log.error(f"ModelScope search failed: {body}, request: {payload}")
            return {"data": None}
        models = body['Data']['Model']['Models'] or []
        picked: List[Dict[str, Any]] = []
        for item in models:
            data = self.formatData(item or {})
            picked.append(data)
        total = body['Data']['Model'].get('TotalCount') or body['Data']['Model'].get('Total') or 0
        return {"data": picked, "total": total}

    def download_with_sdk(
        self,
        model_id: str,
        model_type: str,
        dest_dir: Optional[str] = None,
    ) -> str:
        """
        推荐通过 ModelScope 官方 SDK 下载（更稳妥，支持断点与多文件）。
        pip install modelscope
        """
        try:
            from modelscope.hub.snapshot_download import snapshot_download
        except ImportError as e:
            raise RuntimeError("缺少依赖 modelscope，请先安装：pip install modelscope") from e

        # Determine destination directory in ComfyUI models folder hierarchy
        try:
            if dest_dir:
                cache_dir = os.path.abspath(os.path.expanduser(dest_dir))
            else:
                # Prefer ComfyUI's configured folder for this model_type
                try:
                    model_type_paths = folder_paths.get_folder_paths(model_type)
                    cache_dir = model_type_paths[0] if model_type_paths else os.path.join(folder_paths.models_dir, model_type)
                except Exception:
                    # Fallback to models_dir/model_type if the key is unknown
                    cache_dir = os.path.join(folder_paths.models_dir, model_type
```

### Core Architecture Module: `backend/utils/request_context.py`
```
"""
Request context management for ComfyUI Copilot
Uses contextvars to provide request-scoped context variables with async safety
"""

import contextvars
from typing import Optional, Dict, Any
from pydantic import BaseModel


class RewriteContext(BaseModel):
    rewrite_intent: str = ""
    current_workflow: str = ""
    node_infos: Optional[Dict[str, Any]] = None
    rewrite_expert: Optional[str] = ""

# Define context variables
_session_id: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar('session_id', default=None)
_workflow_checkpoint_id: contextvars.ContextVar[Optional[int]] = contextvars.ContextVar('workflow_checkpoint_id', default=None)
_config: contextvars.ContextVar[Optional[Dict[str, Any]]] = contextvars.ContextVar('config', default=None)
_rewrite_context: contextvars.ContextVar[Optional[RewriteContext]] = contextvars.ContextVar('rewrite_context', default=None)


def set_session_id(session_id: str) -> None:
    """Set the session ID for the current request context"""
    _session_id.set(session_id)

def get_session_id() -> Optional[str]:
    """Get the session ID from the current request context"""
    return _session_id.get()

def set_workflow_checkpoint_id(checkpoint_id: Optional[int]) -> None:
    """Set the workflow checkpoint ID for the current request context"""
    _workflow_checkpoint_id.set(checkpoint_id)

def get_workflow_checkpoint_id() -> Optional[int]:
    """Get the workflow checkpoint ID from the current request context"""
    return _workflow_checkpoint_id.get()

def set_config(config: Dict[str, Any]) -> None:
    """Set the request config for the current request context"""
    _config.set(config)

def get_config() -> Optional[Dict[str, Any]]:
    """Get the request config from the current request context"""
    return _config.get()

def set_request_context(session_id: str, workflow_checkpoint_id: Optional[int] = None, config: Optional[Dict[str, Any]] = None) -> None:
    """Set all request context variables at once"""
    set_session_id(session_id)
    if workflow_checkpoint_id is not None:
        set_workflow_checkpoint_id(workflow_checkpoint_id)
    if config is not None:
        set_config(config)

def clear_request_context() -> None:
    """Clear all request context variables"""
    _session_id.set(None)
    _workflow_checkpoint_id.set(None)
    _config.set(None)

def set_rewrite_context(rewrite_context: RewriteContext) -> None:
    """Set the rewrite context for the current request context"""
    _rewrite_context.set(rewrite_context)

def get_rewrite_context() -> RewriteContext:
    """Get the rewrite context from the current request context"""
    context = _rewrite_context.get()
    if context is None:
        # 初始化一个新的 RewriteContext
        context = RewriteContext()
        _rewrite_context.set(context)
    return context
```

### Core Architecture Module: `backend/utils/string_utils.py`
```
'''
Author: ai-business-hql qingli.hql@alibaba-inc.com
Date: 2025-08-08 17:14:52
LastEditors: ai-business-hql qingli.hql@alibaba-inc.com
LastEditTime: 2025-08-11 19:13:12
FilePath: /comfyui_copilot/backend/utils/string_utils.py
Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
'''
def error_format(e: Exception) -> str:
    error_message = str(e).replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')
    # 移除可能导致JSON解析错误的控制字符
    error_message = ''.join(char for char in error_message if ord(char) >= 32 or char in '\n\r\t')
    return error_message
```

### Core Architecture Module: `scripts/setupGitHooks.js`
```
// Copyright (C) 2025 AIDC-AI
// Licensed under the MIT License.


const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

const files = [
  { path: '../.git/info/exclude.dist', content: '/dist' },
  {
    path: '../.git/hooks/post-checkout',
    content: `
    #!/bin/sh

    # Get the current branch name
    BRANCH_NAME=$(git rev-parse --symbolic-full-name --abbrev-ref HEAD)
    
    # Remove previously set exclude files
    rm -f .git/info/exclude
    
    # When not in the beta/main branch, add additional files that need to be ignored
    if [ "$BRANCH_NAME" != "beta" ] && [ "$BRANCH_NAME" != "main" ]; then
      cp .git/info/exclude.dist .git/info/exclude
    # elif [ "$BRANCH_NAME" = "xxx" ]; then
    #   cp .git/info/exclude.xxx .git/info/exclude
    fi`,
  },
];

function createFile(filePath, content) {
  fs.writeFile(filePath, content, (err) => {
    if (err) {
      console.error(`An error occurred while creating file ${filePath}:`, err);
    }
  });
}

function executeCommand(command, workingDirectory = '../') {
  exec(command, { cwd: path.resolve(__dirname, workingDirectory) }, (error, stdout, stderr) => {
    if (error) {
      console.error(`An error occurred while executing command "${command}":`, error);
      return;
    }
    if (stderr) {
      console.error(`Command error "${stderr}"`);
      return;
    }
  });
}

function main() {
  files.forEach((file) => {
    createFile(file.path, file.content);
  });
  executeCommand('git config advice.ignoredHook false');
  executeCommand('chmod +x .git/hooks/post-checkout');
  console.log('Custom git hooks installation completed')
}

main();

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
 `,ext:[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};y?.(t);try{f.trackEvent({event_type:"debug_trigger",message_type:"debug",message_id:e,data:{}}),await C(),u({type:"SET_LOADING",payload:!0}),await I(e)}finally{w(!1)}},C=async()=>{try{const e=await b.graphToPrompt(),t=localStorage.getItem("sessionId")||"";if(t&&e){const n=await f.saveWorkflowCheckpoint(t,e.output,e.workflow,"debug_start");if(v(n.version_id),console.log(`Saved debug start checkpoint: ${n.version_id}`),c&&r){const o=[...r.ext||[]].filter(g=>g.type!=="debug_start_checkpoint"&&!(g.type==="debug_checkpoint"&&g.data?.checkpoint_type==="debug_start"));o.push({type:"debug_start_checkpoint",data:{checkpoint_id:n.version_id,checkpoint_type:"debug_start"}});const p={id:_||m(),role:"ai",content:JSON.stringify({text:r.text,ext:o}),format:"debug_guide",name:"Assistant"};c(p)}}}catch(e){console.error("Failed to save checkpoint before debug:",e)}},I=async e=>{try{const t=await b.graphToPrompt();let n="",a=null;l&&(l.current=new AbortController);for await(const o of f.streamDebugAgent(t,l?.current?.signal||void 0))if(o.text){n=o.text,o.ext&&(a=o.ext);const p={id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};c?.(p)}c?.({id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!0,debugGuide:!0}),u({type:"SET_LOADING",payload:!1}),l.current=null}catch(t){console.error("Error calling debug agent:",t),S(!1);const a={id:e,role:"ai",content:JSON.stringify({text:`I encountered an error while analyzing your workflow: ${t.message||"Unknown error"}`,ext:[]}),format:"markdown",name:"Assistant",finished:!0};c?.(a),u({type:"SET_LOADING",payload:!1}),l.current=null}};return r?s.jsx(E,{name:k,children:s.jsxs("div",{className:"bg-gray-100 pt-4 px-4 pb-3 rounded-lg",children:[s.jsx("div",{className:"flex justify-between items-start",children:s.jsx("p",{className:"text-gray-700 text-sm flex-1",children:r.text})}),s.jsx("div",{className:"flex justify-end mt-4",children:s.jsx("button",{onClick:N,disabled:d,className:`debug-btn bg-debug-btn text-sm text-[#fff] rounded-lg px-4 py-2 ${d?"cursor-not-allowed":"cursor-pointer"}`,children:d?"Analyzing...":"Debug Errors"})}),s.jsx("div",{className:"flex justify-end mt-2",children:!!x&&s.jsx("div",{className:"ml-2 flex-shrink-0",children:s.jsx(D,{checkpointId:x,onRestore:()=>{console.log("Workflow restored from checkpoint")}})})})]})}):null}export{P as DebugGuide};
```

**File**: `dist/copilot_web/DebugResult-D-xaPQft.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,o as g,G as k,R as j}from"./message-components--sDgdV1o.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-Bs515Oed.js";import"./input.js";/* empty css     */import"./App-rH93i3nw.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);return e.jsx(v,{className:"rounded-lg ",borderClassName:"rounded-lg",children:e.jsxs("div",{className:`flex flex-col ${d} ${i?"":"max-h-[200px]"}`,children:[e.jsxs("div",{className:"flex justify-between items-center pb-2 border-b border-gray-100",children:[e.jsx("div",{children:typeof a=="string"?e.jsx("h3",{className:"text-sm text-[#fff] font-medium",children:a}):a}),e.jsx("button",{onClick:()=>{r(!i)},children:i?e.jsx(u,{className:"text-gray-700"}):e.jsx(w,{className:"text-gray-700"})})]}),e.jsx("div",{className:"overflow-hidden flex-1",children:c})]})})};function E({content:n,name:a="Assistant",avatar:f,format:d="markdown"}){const c=p.useRef(null),i=()=>{let r=null,l=!1,o,x=[];try{if(o=JSON.parse(n),o.ext){let t=o.ext.find(s=>s.type==="workflow_rewrite_checkpoint"||s.type==="debug_checkpoint"&&s.data?.checkpoint_type==="workflow_rewrite_start");t&&t.data&&t.data.checkpoint_id?(r=t.data.checkpoint_id,l=!0):(t=o.ext.find(s=>s.type==="workflow_rewrite_complete"),t&&t.data&&t.data.version_id?(r=t.data.version_id,l=!0):(t=o.ext.find(s=>s.type==="debug_checkpoint"),t&&t.data&&t.data.checkpoint_id&&(r=t.data.checkpoint_id,l=!1))),o.ext.find(s=>s.type==="workflow_update")&&(l=!0),x=o.ext.find(s=>s.type==="param_update")?.data?.model_suggest||[]}}catch(t){return console.error("Failed to parse DebugResult content:",t),null}const h=l?e.jsxs("div",{className:"flex items-center text-green-500",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",fill:"currentColor",viewBox:"0 0 20 20",children:e.jsx("path",{fillRule:"evenodd",d:"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",clipRule:"evenodd"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Successfully"})]}):e.jsxs("div",{className:"flex items-center text-gray-900",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"28108",fill:"currentColor",children:e.jsx("path",{d:"M401.048025 844.855924c0 20.341281 16.643052 36.984333 36.984333 36.984333l147.936307 0c20.341281 0 36.984333-16.643052 36.984333-36.984333L622.952998 807.872614 401.048025 807.872614 401.048025 844.855924zM512 142.159744c-142.943596 0-258.888282 115.944686-258.888282 258.888282 0 88.021729 44.011376 165.503405 110.951975 212.288964l0 83.58365c0 20.341281 16.643052 36.984333 36.984333 36.984333l221.903949 0c20.341281 0 36.984333-16.643052 36.984333-36.984333l0-83.58365c66.941622-46.784536 110.951975-124.266212 110.951975-212.288964C770.888282 258.104429 654.943596 142.159744 512 142.159744zM617.588827 552.682561l-31.621185 22.005176 0 85.248569L438.031335 659.936307l0-85.063351L406.41015 552.866756c-49.743938-34.764781-79.33079-91.350544-79.33079-151.634536 0-101.890598 83.029018-184.92064 184.92064-184.92064s184.92064 83.029018 184.92064 184.92064C696.919617 461.332017 667.332764 517.91778 617.588827 552.682561z","p-id":"28277"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Finished"})]}),m=l?e.jsx("div",{className:"mt-3 text-xs text-gray-700",children:"💡 If you're not satisfied with the changes, click the restore button to revert to the previous version."}):null;return e.jsxs("div",{ref:c,className:"sticky top-0 left-0 w-full bg-gray-100 p-4 rounded-lg overflow-hidden",children:[e.jsx(y,{title:h,isWorkflowUpdate:l,className:"p-4",children:e.jsxs("div",{className:"prose prose-sm max-w-none",children:[d==="markdown"?e.jsx(k,{response:o||{}}):e.jsx("pre",{className:"whitespace-pre-wrap text-gray-700 text-sm leading-relaxed h-full",children:o?.text||""}),m]})}),x?.length>0&&e.jsx(N,{modelList:x,showPagination:!1}),e.jsx("div",{className:"flex justify-end mt-2",children:!!r&&e.jsx("div",{className:"ml-2 flex-shrink-0",children:e.jsx(j,{checkpointId:r,onRestore:()=>{console.log(`Workflow restored from ${l?"workflow update":"debug"} checkpoint`)},title:l?`Restore to this version (Version ${r})`:`Restore checkpoint ${r}`})})})]})};return e.jsx(g,{name:a,children:i()})}export{E as DebugResult};
+            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,o as g,G as k,R as j}from"./message-components-fbm8PP7r.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-XZ3VCjO6.js";import"./input.js";/* empty css     */import"./App-D0onO6Pn.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);retu
```

**File**: `dist/copilot_web/WorkflowOption-DRDiBBwJ.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{D,W as _,n as C,a as d}from"./message-components--sDgdV1o.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as G}from"./workflowChat-Bs515Oed.js";import"./input.js";/* empty css     */import"./App-rH93i3nw.js";function Y({content:v,name:J="Assistant",avatar:P,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(G,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,L=n.outputs?n.outputs.length:0,q=n.widgets?n.widgets.length:0,B=Math.max(V,L)+q,u=S*B+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fill:"#1296db"}),t.jsx("path",{d:"M682.656 298.656m0 0l85.344 0q0 0 0 0l0 426.656q0 0 0 0l-85.344 0q0 0 0 0l0-426.656q0 0 0 0Z","p-id":"25240",fill:"#1296db"})]})}),t.jsxs("div",{className:"flex flex-row",children:[t.jsx("h3",{className:"flex-1 font-medium text-sm line-clamp-2 break-all h-10 overflow-hidden",children:e.name}),t.jsx("div",{className:"flex items-start",children:e.description&&t.jsx(D,{arrow:!1,placement:"top",title:t.jsx("div",{className:"bg-gray-900 text-white text-xs rounded-md py-2 px-3 min-w-[400px] whitespace-normal break-words",children:e.description}),children:t.jsx("div",{className:"w-5 h-5 flex items-center justify-center text-gray-500 cursor-help",children:t.jsx("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor",className:"w-4 h-4",children:t.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.
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
                          transition-all duration-200 active:scale-95`,children:u?s.jsx(Tg,{className:"h-5 w-5 text-red-500 hover:text-red-600"}):s.jsx(Pg,{className:"h-5 w-5 group-hover:translate-x-1"})})]})});oc.displayName="ChatInput";function pp(o){const u=o[0],r=new Set;function d(c,h){if(!(!c||h>=1)&&c.inputs)for(const m of Object.values(c.inputs)){const g=m.link;if(g&&$e.graph.links[g]){const b=$e.graph.links[g].origin_id,S=$e.graph._nodes_by_id[b];S&&(r.add(S.type),d(S,h+1))}}}return u?(d(u,0),[{type:"upstream_node_types",data:Array.from(r)}]):null}function xp({nodeInfo:o,onSendWithIntent:u,loading:r,onSendWithContent:d}){return console.log("SelectedNodeInfo nodeInfo:",o[0]),s.jsx("div",{className:"mb-3 p-3 rounded-md bg-gray-50 border border-gray-200",children:s.jsxs("div",{className:"text-sm text-gray-700",children:[s.jsxs("p",{children:["Selected node: ",o[0].type]}),s.jsxs("div",{className:"flex gap-2 mt-2",children:[s.jsx("button",{className:`px-3 py-1 text-xs rounded-md bg-blue-50 
                                  text-blue-700 hover:bg-blue-100`,onClick:()=>d(`Reply in ${navigator.language} language: How does the ${o[0].type} node work? I need its official usage guide.`),disabled:r,children:"Usage"}),s.jsx("button",{className:`px-3 py-1 text-xs rounded-md bg-green-100 
                                  text-green-700 hover:bg-green-200`,onClick:()=>d(`Reply in ${navigator.language} language: Show me the technical specifications for the ${o[0].type} node's inputs and outputs.`),disabled:r,children:"Parameters"}),s.jsx("button",{className:`px-3 py-1 text-xs rounded
```

**File**: `ui/src/utils/graphUtils.ts` (modified, +26/-20)
```diff
@@ -15,55 +15,61 @@ import { loadApiWorkflowWithMissingNodes } from "./comfyuiWorkflowApi2Ui";
 
 export function addNodeOnGraph(type: string, options: any = {}) {
     const node = LiteGraph.createNode(type, "", options);
-    
+
     // 只在没有指定位置时，才设置节点到中心位置
     if (!options.pos) {
         // 获取画布的可视区域大小
         const rect = app.canvas.canvas.getBoundingClientRect();
-        
-        // 计算画布中心点
-        const centerX = (rect.width / 2) / app.canvas.ds.scale + (-app.canvas.ds.offset[0]) / app.canvas.ds.scale;
-        const centerY = (rect.height / 2) / app.canvas.ds.scale + (-app.canvas.ds.offset[1]) / app.canvas.ds.scale;
-        
-        // 设置节点位置到画布中心
+
+        // // 计算画布中心点
+        // const centerX = (rect.width / 2) / app.canvas.ds.scale + (-app.canvas.ds.offset[0]) / app.canvas.ds.scale;
+        // const centerY = (rect.height / 2) / app.canvas.ds.scale + (-app.canvas.ds.offset[1]) / app.canvas.ds.scale;
+        // // 设置节点位置到画布中心
+        // node.pos = [
+        //     centerX - node.size[0] / 2,
+        //     centerY - node.size[1] / 2
+        // ]
+
+        const areaX = app.canvas.visible_area?.[0] || 0;
+        const areaY = app.canvas.visible_area?.[1] || 0;
         node.pos = [
-            centerX - node.size[0] / 2,
-            centerY - node.size[1] / 2
-        ];
+            areaX + rect.width / app.canvas.ds.scale / 2 - node.size[0] / 2,
+            areaY + rect.height / app.canvas.ds.scale / 2 - node.size[1] / 2
+        ]
     }
-    
+
     app.graph.add(node);
     return node;
 }
 
 
-export function applyNewWorkflow(workflow:any): boolean {
+export function applyNewWorkflow(workflow: any): boolean {
     try {
         console.log('[graphUtils] Applying new workflow to canvas...', workflow);
-        
+
         // 确保app和graph对象存在
         if (!app || !app.graph) {
             console.error('[graphUtils] App or graph not available');
             return false;
         }
-        
+
         // ui格式的工作流
-        if(workflow.nodes) {
+        if (workflow.nodes) {
             console.log('[graphUtils] Loading UI format workflow with nodes:', workflow.nodes.length);
             app.loadGraphData(workflow);
         } else {
-        // api格式的工作流
+            // api格式的工作流
             console.log('[graphUtils] Loading API format workflow with node count:', Object.keys(workflow).length);
             // app.loadApiJson(workflow);
             loadApiWorkflowWithMissingNodes(workflow);
         }
-        
+
         // 确保画布重新渲染
         if (app.graph) {
             app.graph.setDirtyCanvas(false, true);
             console.log('[graphUtils] Canvas marked as dirty for re-rendering');
         }
-        
+
         console.log('[graphUtils] Workflow successfully applied to canvas');
         return true;
     } catch (error) {
@@ -94,7 +100,7 @@ export function applyNodeParameters(nodeParams: Record<string, Record<string, an
                 console.warn(`[graphUtils] Node ${nodeId} not found or has no widgets`);
                 return;
             }
-            
+
             // 遍历节点参数
             Object.entries(params).forEach(([paramName, value]) => {
                 // 在节点的widgets中查找对应的widget
@@ -139,7 +145,7 @@ export function applyParameterChanges(changes: Array<{ node_id: string; paramete
 
         // 将changes列表转换为nodeParams格式
         const nodeParams: Record<string, Record<string, any>> = {};
-        
+
         changes.forEach(change => {
             if (!nodeParams[change.node_id]) {
                 nodeParams[change.node_id] = {};
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
 `,ext:[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};y?.(t);try{f.trackEvent({event_type:"debug_trigger",message_type:"debug",message_id:e,data:{}}),await C(),u({type:"SET_LOADING",payload:!0}),await I(e)}finally{w(!1)}},C=async()=>{try{const e=await b.graphToPrompt(),t=localStorage.getItem("sessionId")||"";if(t&&e){const n=await f.saveWorkflowCheckpoint(t,e.output,e.workflow,"debug_start");if(v(n.version_id),console.log(`Saved debug start checkpoint: ${n.version_id}`),c&&r){const o=[...r.ext||[]].filter(g=>g.type!=="debug_start_checkpoint"&&!(g.type==="debug_checkpoint"&&g.data?.checkpoint_type==="debug_start"));o.push({type:"debug_start_checkpoint",data:{checkpoint_id:n.version_id,checkpoint_type:"debug_start"}});const p={id:_||m(),role:"ai",content:JSON.stringify({text:r.text,ext:o}),format:"debug_guide",name:"Assistant"};c(p)}}}catch(e){console.error("Failed to save checkpoint before debug:",e)}},I=async e=>{try{const t=await b.graphToPrompt();let n="",a=null;l&&(l.current=new AbortController);for await(const o of f.streamDebugAgent(t,l?.current?.signal||void 0))if(o.text){n=o.text,o.ext&&(a=o.ext);const p={id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};c?.(p)}c?.({id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!0,debugGuide:!0}),u({type:"SET_LOADING",payload:!1}),l.current=null}catch(t){console.error("Error calling debug agent:",t),S(!1);const a={id:e,role:"ai",content:JSON.stringify({text:`I encountered an error while analyzing your workflow: ${t.message||"Unknown error"}`,ext:[]}),format:"markdown",name:"Assistant",finished:!0};c?.(a),u({type:"SET_LOADING",payload:!1}),l.current=null}};return r?s.jsx(E,{name:k,children:s.jsxs("div",{className:"bg-gray-100 pt-4 px-4 pb-3 rounded-lg",children:[s.jsx("div",{className:"flex justify-between items-start",children:s.jsx("p",{className:"text-gray-700 text-sm flex-1",children:r.text})}),s.jsx("div",{className:"flex justify-end mt-4",children:s.jsx("button",{onClick:N,disabled:d,className:`debug-btn bg-debug-btn text-sm text-[#fff] rounded-lg px-4 py-2 ${d?"cursor-not-allowed":"cursor-pointer"}`,children:d?"Analyzing...":"Debug Errors"})}),s.jsx("div",{className:"flex justify-end mt-2",children:!!x&&s.jsx("div",{className:"ml-2 flex-shrink-0",children:s.jsx(D,{checkpointId:x,onRestore:()=>{console.log("Workflow restored from checkpoint")}})})})]})}):null}export{P as DebugGuide};
```

**File**: `dist/copilot_web/DebugResult-BiFrTcrM.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,J as k,R as j}from"./message-components-CWGTfP0h.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-CNenSvoH.js";import"./input.js";/* empty css     */import"./App-BRBPgs30.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);return e.jsx(v,{className:"rounded-lg ",borderClassName:"rounded-lg",children:e.jsxs("div",{className:`flex flex-col ${d} ${i?"":"max-h-[200px]"}`,children:[e.jsxs("div",{className:"flex justify-between items-center pb-2 border-b border-gray-100",children:[e.jsx("div",{children:typeof a=="string"?e.jsx("h3",{className:"text-sm text-[#fff] font-medium",children:a}):a}),e.jsx("button",{onClick:()=>{r(!i)},children:i?e.jsx(u,{className:"text-gray-700"}):e.jsx(w,{className:"text-gray-700"})})]}),e.jsx("div",{className:"overflow-hidden flex-1",children:c})]})})};function E({content:n,name:a="Assistant",avatar:f,format:d="markdown"}){const c=p.useRef(null),i=()=>{let r=null,l=!1,o,x=[];try{if(o=JSON.parse(n),o.ext){let t=o.ext.find(s=>s.type==="workflow_rewrite_checkpoint"||s.type==="debug_checkpoint"&&s.data?.checkpoint_type==="workflow_rewrite_start");t&&t.data&&t.data.checkpoint_id?(r=t.data.checkpoint_id,l=!0):(t=o.ext.find(s=>s.type==="workflow_rewrite_complete"),t&&t.data&&t.data.version_id?(r=t.data.version_id,l=!0):(t=o.ext.find(s=>s.type==="debug_checkpoint"),t&&t.data&&t.data.checkpoint_id&&(r=t.data.checkpoint_id,l=!1))),o.ext.find(s=>s.type==="workflow_update")&&(l=!0),x=o.ext.find(s=>s.type==="param_update")?.data?.model_suggest||[]}}catch(t){return console.error("Failed to parse DebugResult content:",t),null}const h=l?e.jsxs("div",{className:"flex items-center text-green-500",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",fill:"currentColor",viewBox:"0 0 20 20",children:e.jsx("path",{fillRule:"evenodd",d:"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",clipRule:"evenodd"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Successfully"})]}):e.jsxs("div",{className:"flex items-center text-gray-900",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"28108",fill:"currentColor",children:e.jsx("path",{d:"M401.048025 844.855924c0 20.341281 16.643052 36.984333 36.984333 36.984333l147.936307 0c20.341281 0 36.984333-16.643052 36.984333-36.984333L622.952998 807.872614 401.048025 807.872614 401.048025 844.855924zM512 142.159744c-142.943596 0-258.888282 115.944686-258.888282 258.888282 0 88.021729 44.011376 165.503405 110.951975 212.288964l0 83.58365c0 20.341281 16.643052 36.984333 36.984333 36.984333l221.903949 0c20.341281 0 36.984333-16.643052 36.984333-36.984333l0-83.58365c66.941622-46.784536 110.951975-124.266212 110.951975-212.288964C770.888282 258.104429 654.943596 142.159744 512 142.159744zM617.588827 552.682561l-31.621185 22.005176 0 85.248569L438.031335 659.936307l0-85.063351L406.41015 552.866756c-49.743938-34.764781-79.33079-91.350544-79.33079-151.634536 0-101.890598 83.029018-184.92064 184.92064-184.92064s184.92064 83.029018 184.92064 184.92064C696.919617 461.332017 667.332764 517.91778 617.588827 552.682561z","p-id":"28277"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Finished"})]}),m=l?e.jsx("div",{className:"mt-3 text-xs text-gray-700",children:"💡 If you're not satisfied with the changes, click the restore button to revert to the previous version."}):null;return e.jsxs("div",{ref:c,className:"sticky top-0 left-0 w-full bg-gray-100 p-4 rounded-lg overflow-hidden",children:[e.jsx(y,{title:h,isWorkflowUpdate:l,className:"p-4",children:e.jsxs("div",{className:"prose prose-sm max-w-none",children:[d==="markdown"?e.jsx(k,{response:o||{}}):e.jsx("pre",{className:"whitespace-pre-wrap text-gray-700 text-sm leading-relaxed h-full",children:o?.text||""}),m]})}),x?.length>0&&e.jsx(N,{modelList:x,showPagination:!1}),e.jsx("div",{className:"flex justify-end mt-2",children:!!r&&e.jsx("div",{className:"ml-2 flex-shrink-0",children:e.jsx(j,{checkpointId:r,onRestore:()=>{console.log(`Workflow restored from ${l?"workflow update":"debug"} checkpoint`)},title:l?`Restore to this version (Version ${r})`:`Restore checkpoint ${r}`})})})]})};return e.jsx(g,{name:a,children:i()})}export{E as DebugResult};
+            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,o as g,G as k,R as j}from"./message-components--sDgdV1o.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-Bs515Oed.js";import"./input.js";/* empty css     */import"./App-rH93i3nw.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);retu
```

**File**: `dist/copilot_web/WorkflowOption-CUEyiK7N.js` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+function getImportPath(filename) {
+            return `./${filename}`;
+        }
+            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{D,W as _,n as C,a as d}from"./message-components--sDgdV1o.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as G}from"./workflowChat-Bs515Oed.js";import"./input.js";/* empty css     */import"./App-rH93i3nw.js";function Y({content:v,name:J="Assistant",avatar:P,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(G,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,L=n.outputs?n.outputs.length:0,q=n.widgets?n.widgets.length:0,B=Math.max(V,L)+q,u=S*B+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fill:"#1296db"}),t.jsx("path",{d:"M682.656 298.656m0 0l85.344 0q0 0 0 0l0 426.656q0 0 0 0l-85.344 0q0 0 0 0l0-426.656q0 0 0 0Z","p-id":"25240",fill:"#1296db"})]})}),t.jsxs("div",{className:"flex flex-row",children:[t.jsx("h3",{className:"flex-1 font-medium text-sm line-clamp-2 break-all h-10 overflow-hidden",children:e.name}),t.jsx("div",{className:"flex items-start",children:e.description&&t.jsx(D,{arrow:!1,placement:"top",title:t.jsx("div",{className:"bg-gray-900 text-white text-xs rounded-md py-2 px-3 min-w-[400px] whitespace-normal break-words",children:e.description}),children:t.jsx("div",{className:"w-5 h-5 flex items-center justify-center text-gray-500 cursor-help",children:t.jsx("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor",className:"w-4 h-4",children:t.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.
```

**File**: `dist/copilot_web/WorkflowOption-DcX8WpSR.js` (removed, +0/-4)
```diff
@@ -1,4 +0,0 @@
-function getImportPath(filename) {
-            return `./${filename}`;
-        }
-            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{G as B,W as _,o as C,a as d}from"./message-components-CWGTfP0h.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as J}from"./workflowChat-CNenSvoH.js";import"./input.js";/* empty css     */import"./App-BRBPgs30.js";function Y({content:v,name:P="Assistant",avatar:R,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(J,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,G=n.outputs?n.outputs.length:0,L=n.widgets?n.widgets.length:0,q=Math.max(V,G)+L,u=S*q+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fill:"#1296db"}),t.jsx("path",{d:"M682.656 298.656m0 0l85.344 0q0 0 0 0l0 426.656q0 0 0 0l-85.344 0q0 0 0 0l0-426.656q0 0 0 0Z","p-id":"25240",fill:"#1296db"})]})}),t.jsxs("div",{className:"flex flex-row",children:[t.jsx("h3",{className:"flex-1 font-medium text-sm line-clamp-2 break-all h-10 overflow-hidden",children:e.name}),t.jsx("div",{className:"flex items-start",children:e.description&&t.jsx(B,{arrow:!1,placement:"top",title:t.jsx("div",{className:"bg-gray-900 text-white text-xs rounded-md py-2 px-3 min-w-[400px] whitespace-normal break-words",children:e.description}),children:t.jsx("div",{className:"w-5 h-5 flex items-center justify-center text-gray-500 cursor-help",children:t.jsx("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor",className:"w-4 h-4",children:t.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.
```

**File**: `dist/copilot_web/message-components--sDgdV1o.js` (renamed, +1/-1)
```diff
@@ -563,4 +563,4 @@ In order to be iterable, non-array objects must have a [Symbol.iterator]() metho
                                                  border border-gray-900 hover:bg-gray-100 
                                                  transition-colors text-[10px] flex items-center gap-1`,children:[Ce.jsx("svg",{className:"h-3.5 w-3.5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:Ce.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"})}),"Download"]}):Ce.jsxs("a",{href:`https://www.google.com/search?q=${encodeURIComponent(o.name+" comfyui custom node")}`,target:"_blank",rel:"noopener noreferrer",className:`px-2 py-1 bg-gray-100 text-gray-500 rounded-md
                                                  border border-gray-300 text-[10px] flex items-center gap-1`,children:[Ce.jsx("svg",{className:"h-3.5 w-3.5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:Ce.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z"})}),"Search on Google"]})})]})},a))}),Ce.jsx("p",{className:"mt-4"}),Ce.jsx("p",{children:"After installation, please click the continue loading graph button to load the graph to the canvas:"}),Ce.jsx("div",{className:"mt-4",children:Ce.jsx("button",{className:`px-3 py-2 bg-blue-500 text-white rounded-md 
-                             hover:bg-blue-600 transition-colors text-xs block mx-auto`,onClick:e,children:"Loading graph directly"})})]})}const z5e=Object.freeze(Object.defineProperty({__proto__:null,NodeInstallGuide:e5e},Symbol.toStringTag,{value:"Module"}));export{S5e as A,bs as B,o5e as C,xQ as D,Do as E,Fa as F,Ju as G,v5e as H,Nd as I,zm as J,I5e as K,T5e as L,g5e as M,P5e as N,L5e as O,m5e as P,z5e as Q,RQ as R,b5e as S,$5e as T,_5e as U,yo as W,w5e as X,lr as a,u5e as b,c5e as c,pA as d,d5e as e,s5e as f,a5e as g,Ba as h,SD as i,h5e as j,pc as k,p5e as l,f5e as m,y5e as n,qn as o,$A as p,CZ as q,Fw as r,x5e as s,E5e as t,EZ as u,l5e as v,n5e as w,C5e as x,O5e as y,CA as z};
+                             hover:bg-blue-600 transition-colors text-xs block mx-auto`,onClick:e,children:"Loading graph directly"})})]})}const z5e=Object.freeze(Object.defineProperty({__proto__:null,NodeInstallGuide:e5e},Symbol.toStringTag,{value:"Module"}));export{xQ as A,bs as B,o5e as C,Ju as D,Do as E,Fa as F,zm as G,v5e as H,Nd as I,I5e as J,T5e as K,L5e as L,g5e as M,P5e as N,z5e as O,m5e as P,RQ as R,b5e as S,$5e as T,_5e as U,yo as W,w5e as X,lr as a,u5e as b,c5e as c,pA as d,d5e as e,s5e as f,a5e as g,Ba as h,SD as i,h5e as j,p5e as k,f5e as l,y5e as m,qn as n,$A as o,CZ as p,Fw as q,x5e as r,E5e as s,C5e as t,EZ as u,l5e as v,n5e as w,O5e as x,CA as y,S5e as z};
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

**File**: `ui/src/components/chat/messages/ModelOption.tsx` (modified, +26/-26)
```diff
@@ -145,32 +145,32 @@ const ModelOption: React.FC<IProps> = (props) => {
       title: thMap.dir,
       key: 'directory',
       render: (_, record) => (
-        // <select
-        //   value={selectedPathMap[record.Id]}
-        //   onChange={(e) => handleSelectedPath(record.Id, e.target.value)}
-        //   className="px-1.5 py-0.5 text-xs rounded-md bg-gray-100
-        //           text-gray-700 focus:outline-none focus:ring-2 
-        //           focus:ring-blue-500 hover:!bg-gray-50"
-        // >
-        //   {modelPaths?.map((path: string) => (
-        //       <option value={path} key={path}>{path}</option>
-        //   ))}
-        // </select>
-        <Select 
+        <select
           value={selectedPathMap[record.Id]}
-          onChange={(value) => handleSelectedPath(record.Id, value)}
-          options={modelPaths?.map((path: string) => ({
-            label: path,
-            value: path
-          }))}
-          className="w-full"
-          suffixIcon={<div className="text-gray-600">
-            <svg viewBox="0 0 1024 1024" className="w-5 h-5" fill="currentColor">
-              <path d="M512 714.666667c-8.533333 0-17.066667-2.133333-23.466667-8.533334l-341.333333-341.333333c-12.8-12.8-12.8-32 0-44.8 12.8-12.8 32-12.8 44.8 0l320 317.866667 317.866667-320c12.8-12.8 32-12.8 44.8 0 12.8 12.8 12.8 32 0 44.8L533.333333 704c-4.266667 8.533333-12.8 10.666667-21.333333 10.666667z">
-              </path>
-            </svg>
-          </div>}
-        />
+          onChange={(e) => handleSelectedPath(record.Id, e.target.value)}
+          className="px-1.5 py-0.5 text-xs rounded-md bg-gray-100
+                  text-gray-700 focus:outline-none focus:ring-2 
+                  focus:ring-blue-500 hover:!bg-gray-50"
+        >
+          {modelPaths?.map((path: string) => (
+              <option value={path} key={path}>{path}</option>
+          ))}
+        </select>
+        // <Select 
+        //   value={selectedPathMap[record.Id]}
+        //   onChange={(value) => handleSelectedPath(record.Id, value)}
+        //   options={modelPaths?.map((path: string) => ({
+        //     label: path,
+        //     value: path
+        //   }))}
+        //   className="w-full"
+        //   suffixIcon={<div className="text-gray-600">
+        //     <svg viewBox="0 0 1024 1024" className="w-5 h-5" fill="currentColor">
+        //       <path d="M512 714.666667c-8.533333 0-17.066667-2.133333-23.466667-8.533334l-341.333333-341.333333c-12.8-12.8-12.8-32 0-44.8 12.8-12.8 32-12.8 44.8 0l320 317.866667 317.866667-320c12.8-12.8 32-12.8 44.8 0 12.8 12.8 12.8 32 0 44.8L533.333333 704c-4.266667 8.533333-12.8 10.666667-21.333333 10.666667z">
+        //       </path>
+        //     </svg>
+        //   </div>}
+        // />
       )
     },
     {
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
-            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,J as k,R as j}from"./message-components-CWGTfP0h.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-CNenSvoH.js";import"./input.js";/* empty css     */import"./App-BRBPgs30.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);return e.jsx(v,{className:"rounded-lg ",borderClassName:"rounded-lg",children:e.jsxs("div",{className:`flex flex-col ${d} ${i?"":"max-h-[200px]"}`,children:[e.jsxs("div",{className:"flex justify-between items-center pb-2 border-b border-gray-100",children:[e.jsx("div",{children:typeof a=="string"?e.jsx("h3",{className:"text-sm text-[#fff] font-medium",children:a}):a}),e.jsx("button",{onClick:()=>{r(!i)},children:i?e.jsx(u,{className:"text-gray-700"}):e.jsx(w,{className:"text-gray-700"})})]}),e.jsx("div",{className:"overflow-hidden flex-1",children:c})]})})};function E({content:n,name:a="Assistant",avatar:f,format:d="markdown"}){const c=p.useRef(null),i=()=>{let r=null,l=!1,o,x=[];try{if(o=JSON.parse(n),o.ext){let t=o.ext.find(s=>s.type==="workflow_rewrite_checkpoint"||s.type==="debug_checkpoint"&&s.data?.checkpoint_type==="workflow_rewrite_start");t&&t.data&&t.data.checkpoint_id?(r=t.data.checkpoint_id,l=!0):(t=o.ext.find(s=>s.type==="workflow_rewrite_complete"),t&&t.data&&t.data.version_id?(r=t.data.version_id,l=!0):(t=o.ext.find(s=>s.type==="debug_checkpoint"),t&&t.data&&t.data.checkpoint_id&&(r=t.data.checkpoint_id,l=!1))),o.ext.find(s=>s.type==="workflow_update")&&(l=!0),x=o.ext.find(s=>s.type==="param_update")?.data?.model_suggest||[]}}catch(t){return console.error("Failed to parse DebugResult content:",t),null}const h=l?e.jsxs("div",{className:"flex items-center text-green-500",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",fill:"currentColor",viewBox:"0 0 20 20",children:e.jsx("path",{fillRule:"evenodd",d:"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",clipRule:"evenodd"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Successfully"})]}):e.jsxs("div",{className:"flex items-center text-gray-900",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"28108",fill:"currentColor",children:e.jsx("path",{d:"M401.048025 844.855924c0 20.341281 16.643052 36.984333 36.984333 36.984333l147.936307 0c20.341281 0 36.984333-16.643052 36.984333-36.984333L622.952998 807.872614 401.048025 807.872614 401.048025 844.855924zM512 142.159744c-142.943596 0-258.888282 115.944686-258.888282 258.888282 0 88.021729 44.011376 165.503405 110.951975 212.288964l0 83.58365c0 20.341281 16.643052 36.984333 36.984333 36.984333l221.903949 0c20.341281 0 36.984333-16.643052 36.984333-36.984333l0-83.58365c66.941622-46.784536 110.951975-124.266212 110.951975-212.288964C770.888282 258.104429 654.943596 142.159744 512 142.159744zM617.588827 552.682561l-31.621185 22.005176 0 85.248569L438.031335 659.936307l0-85.063351L406.41015 552.866756c-49.743938-34.764781-79.33079-91.350544-79.33079-151.634536 0-101.890598 83.029018-184.92064 184.92064-184.92064s184.92064 83.029018 184.92064 184.92064C696.919617 461.332017 667.332764 517.91778 617.588827 552.682561z","p-id":"28277"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Finished"})]}),m=l?e.jsx("div",{className:"mt-3 text-xs text-gray-700",children:"💡 If you're not satisfied with the changes, click the restore button to revert to the previous version."}):null;return e.jsxs("div",{ref:c,className:"sticky top-0 left-0 w-full bg-gray-100 p-4 rounded-lg overflow-hidden",children:[e.jsx(y,{title:h,isWorkflowUpdate:l,className:"p-4",children:e.jsxs("div",{className:"prose prose-sm max-w-none",children:[d==="markdown"?e.jsx(k,{response:o||{}}):e.jsx("pre",{className:"whitespace-pre-wrap text-gray-700 text-sm leading-relaxed h-full",children:o?.text||""}),m]})}),x?.length>0&&e.jsx(N,{modelList:x,showPagination:!1}),e.jsx("div",{className:"flex justify-end mt-2",children:!!r&&e.jsx("div",{className:"ml-2 flex-shrink-0",children:e.jsx(j,{checkpointId:r,onRestore:()=>{console.log(`Workflow restored from ${l?"workflow update":"debug"} checkpoint`)},title:l?`Restore to this version (Version ${r})`:`Restore checkpoint ${r}`})})})]})};return e.jsx(g,{name:a,children:i()})}export{E as DebugResult};
+            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,J as k,R as j}from"./message-components-CWGTfP0h.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-5ISUotB3.js";import"./input.js";/* empty css     */import"./App-DQkoaeMn.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);retu
```

**File**: `dist/copilot_web/WorkflowOption-BkegEe5_.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{G as B,W as _,o as C,a as d}from"./message-components-CWGTfP0h.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as J}from"./workflowChat-CNenSvoH.js";import"./input.js";/* empty css     */import"./App-BRBPgs30.js";function Y({content:v,name:P="Assistant",avatar:R,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(J,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,G=n.outputs?n.outputs.length:0,L=n.widgets?n.widgets.length:0,q=Math.max(V,G)+L,u=S*q+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fill:"#1296db"}),t.jsx("path",{d:"M682.656 298.656m0 0l85.344 0q0 0 0 0l0 426.656q0 0 0 0l-85.344 0q0 0 0 0l0-426.656q0 0 0 0Z","p-id":"25240",fill:"#1296db"})]})}),t.jsxs("div",{className:"flex flex-row",children:[t.jsx("h3",{className:"flex-1 font-medium text-sm line-clamp-2 break-all h-10 overflow-hidden",children:e.name}),t.jsx("div",{className:"flex items-start",children:e.description&&t.jsx(B,{arrow:!1,placement:"top",title:t.jsx("div",{className:"bg-gray-900 text-white text-xs rounded-md py-2 px-3 min-w-[400px] whitespace-normal break-words",children:e.description}),children:t.jsx("div",{className:"w-5 h-5 flex items-center justify-center text-gray-500 cursor-help",children:t.jsx("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor",className:"w-4 h-4",children:t.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.
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
 `,ext:[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};y?.(t);try{f.trackEvent({event_type:"debug_trigger",message_type:"debug",message_id:e,data:{}}),await C(),u({type:"SET_LOADING",payload:!0}),await I(e)}finally{w(!1)}},C=async()=>{try{const e=await b.graphToPrompt(),t=localStorage.getItem("sessionId")||"";if(t&&e){const n=await f.saveWorkflowCheckpoint(t,e.output,e.workflow,"debug_start");if(v(n.version_id),console.log(`Saved debug start checkpoint: ${n.version_id}`),c&&r){const o=[...r.ext||[]].filter(g=>g.type!=="debug_start_checkpoint"&&!(g.type==="debug_checkpoint"&&g.data?.checkpoint_type==="debug_start"));o.push({type:"debug_start_checkpoint",data:{checkpoint_id:n.version_id,checkpoint_type:"debug_start"}});const p={id:_||m(),role:"ai",content:JSON.stringify({text:r.text,ext:o}),format:"debug_guide",name:"Assistant"};c(p)}}}catch(e){console.error("Failed to save checkpoint before debug:",e)}},I=async e=>{try{const t=await b.graphToPrompt();let n="",a=null;l&&(l.current=new AbortController);for await(const o of f.streamDebugAgent(t,l?.current?.signal||void 0))if(o.text){n=o.text,o.ext&&(a=o.ext);const p={id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};c?.(p)}c?.({id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!0,debugGuide:!0}),u({type:"SET_LOADING",payload:!1}),l.current=null}catch(t){console.error("Error calling debug agent:",t),S(!1);const a={id:e,role:"ai",content:JSON.stringify({text:`I encountered an error while analyzing your workflow: ${t.message||"Unknown error"}`,ext:[]}),format:"markdown",name:"Assistant",finished:!0};c?.(a),u({type:"SET_LOADING",payload:!1}),l.current=null}};return r?s.jsx(E,{name:k,children:s.jsxs("div",{className:"bg-gray-100 pt-4 px-4 pb-3 rounded-lg",children:[s.jsx("div",{className:"flex justify-between items-start",children:s.jsx("p",{className:"text-gray-700 text-sm flex-1",children:r.text})}),s.jsx("div",{className:"flex justify-end mt-4",children:s.jsx("button",{onClick:N,disabled:d,className:`debug-btn bg-debug-btn text-sm text-[#fff] rounded-lg px-4 py-2 ${d?"cursor-not-allowed":"cursor-pointer"}`,children:d?"Analyzing...":"Debug Errors"})}),s.jsx("div",{className:"flex justify-end mt-2",children:!!x&&s.jsx("div",{className:"ml-2 flex-shrink-0",children:s.jsx(D,{checkpointId:x,onRestore:()=>{console.log("Workflow restored from checkpoint")}})})})]})}):null}export{P as DebugGuide};
```

**File**: `dist/copilot_web/DebugResult-BhGA0viM.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,G as k,R as j}from"./message-components-CGVXqDj7.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-c9mZt9pj.js";import"./input.js";/* empty css     */import"./App-iZNzhVOX.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);return e.jsx(v,{className:"rounded-lg ",borderClassName:"rounded-lg",children:e.jsxs("div",{className:`flex flex-col ${d} ${i?"":"max-h-[200px]"}`,children:[e.jsxs("div",{className:"flex justify-between items-center pb-2 border-b border-gray-100",children:[e.jsx("div",{children:typeof a=="string"?e.jsx("h3",{className:"text-sm text-[#fff] font-medium",children:a}):a}),e.jsx("button",{onClick:()=>{r(!i)},children:i?e.jsx(u,{className:"text-gray-700"}):e.jsx(w,{className:"text-gray-700"})})]}),e.jsx("div",{className:"overflow-hidden flex-1",children:c})]})})};function E({content:n,name:a="Assistant",avatar:f,format:d="markdown"}){const c=p.useRef(null),i=()=>{let r=null,l=!1,o,x=[];try{if(o=JSON.parse(n),o.ext){let t=o.ext.find(s=>s.type==="workflow_rewrite_checkpoint"||s.type==="debug_checkpoint"&&s.data?.checkpoint_type==="workflow_rewrite_start");t&&t.data&&t.data.checkpoint_id?(r=t.data.checkpoint_id,l=!0):(t=o.ext.find(s=>s.type==="workflow_rewrite_complete"),t&&t.data&&t.data.version_id?(r=t.data.version_id,l=!0):(t=o.ext.find(s=>s.type==="debug_checkpoint"),t&&t.data&&t.data.checkpoint_id&&(r=t.data.checkpoint_id,l=!1))),o.ext.find(s=>s.type==="workflow_update")&&(l=!0),x=o.ext.find(s=>s.type==="param_update")?.data?.model_suggest||[]}}catch(t){return console.error("Failed to parse DebugResult content:",t),null}const h=l?e.jsxs("div",{className:"flex items-center text-green-500",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",fill:"currentColor",viewBox:"0 0 20 20",children:e.jsx("path",{fillRule:"evenodd",d:"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",clipRule:"evenodd"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Successfully"})]}):e.jsxs("div",{className:"flex items-center text-gray-900",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"28108",fill:"currentColor",children:e.jsx("path",{d:"M401.048025 844.855924c0 20.341281 16.643052 36.984333 36.984333 36.984333l147.936307 0c20.341281 0 36.984333-16.643052 36.984333-36.984333L622.952998 807.872614 401.048025 807.872614 401.048025 844.855924zM512 142.159744c-142.943596 0-258.888282 115.944686-258.888282 258.888282 0 88.021729 44.011376 165.503405 110.951975 212.288964l0 83.58365c0 20.341281 16.643052 36.984333 36.984333 36.984333l221.903949 0c20.341281 0 36.984333-16.643052 36.984333-36.984333l0-83.58365c66.941622-46.784536 110.951975-124.266212 110.951975-212.288964C770.888282 258.104429 654.943596 142.159744 512 142.159744zM617.588827 552.682561l-31.621185 22.005176 0 85.248569L438.031335 659.936307l0-85.063351L406.41015 552.866756c-49.743938-34.764781-79.33079-91.350544-79.33079-151.634536 0-101.890598 83.029018-184.92064 184.92064-184.92064s184.92064 83.029018 184.92064 184.92064C696.919617 461.332017 667.332764 517.91778 617.588827 552.682561z","p-id":"28277"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Finished"})]}),m=l?e.jsx("div",{className:"mt-3 text-xs text-gray-700",children:"💡 If you're not satisfied with the changes, click the restore button to revert to the previous version."}):null;return e.jsxs("div",{ref:c,className:"sticky top-0 left-0 w-full bg-gray-100 p-4 rounded-lg overflow-hidden",children:[e.jsx(y,{title:h,isWorkflowUpdate:l,className:"p-4",children:e.jsxs("div",{className:"prose prose-sm max-w-none",children:[d==="markdown"?e.jsx(k,{response:o||{}}):e.jsx("pre",{className:"whitespace-pre-wrap text-gray-700 text-sm leading-relaxed h-full",children:o?.text||""}),m]})}),x?.length>0&&e.jsx(N,{modelList:x,showPagination:!1}),e.jsx("div",{className:"flex justify-end mt-2",children:!!r&&e.jsx("div",{className:"ml-2 flex-shrink-0",children:e.jsx(j,{checkpointId:r,onRestore:()=>{console.log(`Workflow restored from ${l?"workflow update":"debug"} checkpoint`)},title:l?`Restore to this version (Version ${r})`:`Restore checkpoint ${r}`})})})]})};return e.jsx(g,{name:a,children:i()})}export{E as DebugResult};
+            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,J as k,R as j}from"./message-components-CWGTfP0h.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-CNenSvoH.js";import"./input.js";/* empty css     */import"./App-BRBPgs30.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);retu
```

**File**: `dist/copilot_web/WorkflowOption-C0yYHdbP.js` (removed, +0/-4)
```diff
@@ -1,4 +0,0 @@
-function getImportPath(filename) {
-            return `./${filename}`;
-        }
-            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{D,W as _,o as C,a as d}from"./message-components-CGVXqDj7.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as G}from"./workflowChat-c9mZt9pj.js";import"./input.js";/* empty css     */import"./App-iZNzhVOX.js";function Y({content:v,name:J="Assistant",avatar:P,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(G,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,L=n.outputs?n.outputs.length:0,q=n.widgets?n.widgets.length:0,B=Math.max(V,L)+q,u=S*B+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fill:"#1296db"}),t.jsx("path",{d:"M682.656 298.656m0 0l85.344 0q0 0 0 0l0 426.656q0 0 0 0l-85.344 0q0 0 0 0l0-426.656q0 0 0 0Z","p-id":"25240",fill:"#1296db"})]})}),t.jsxs("div",{className:"flex flex-row",children:[t.jsx("h3",{className:"flex-1 font-medium text-sm line-clamp-2 break-all h-10 overflow-hidden",children:e.name}),t.jsx("div",{className:"flex items-start",children:e.description&&t.jsx(D,{arrow:!1,placement:"top",title:t.jsx("div",{className:"bg-gray-900 text-white text-xs rounded-md py-2 px-3 min-w-[400px] whitespace-normal break-words",children:e.description}),children:t.jsx("div",{className:"w-5 h-5 flex items-center justify-center text-gray-500 cursor-help",children:t.jsx("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor",className:"w-4 h-4",children:t.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.
```

**File**: `dist/copilot_web/WorkflowOption-DcX8WpSR.js` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+function getImportPath(filename) {
+            return `./${filename}`;
+        }
+            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{G as B,W as _,o as C,a as d}from"./message-components-CWGTfP0h.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as J}from"./workflowChat-CNenSvoH.js";import"./input.js";/* empty css     */import"./App-BRBPgs30.js";function Y({content:v,name:P="Assistant",avatar:R,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(J,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,G=n.outputs?n.outputs.length:0,L=n.widgets?n.widgets.length:0,q=Math.max(V,G)+L,u=S*q+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fill:"#1296db"}),t.jsx("path",{d:"M682.656 298.656m0 0l85.344 0q0 0 0 0l0 426.656q0 0 0 0l-85.344 0q0 0 0 0l0-426.656q0 0 0 0Z","p-id":"25240",fill:"#1296db"})]})}),t.jsxs("div",{className:"flex flex-row",children:[t.jsx("h3",{className:"flex-1 font-medium text-sm line-clamp-2 break-all h-10 overflow-hidden",children:e.name}),t.jsx("div",{className:"flex items-start",children:e.description&&t.jsx(B,{arrow:!1,placement:"top",title:t.jsx("div",{className:"bg-gray-900 text-white text-xs rounded-md py-2 px-3 min-w-[400px] whitespace-normal break-words",children:e.description}),children:t.jsx("div",{className:"w-5 h-5 flex items-center justify-center text-gray-500 cursor-help",children:t.jsx("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor",className:"w-4 h-4",children:t.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.
```

**File**: `dist/copilot_web/message-components-CWGTfP0h.js` (renamed, +1/-1)
```diff
@@ -563,4 +563,4 @@ In order to be iterable, non-array objects must have a [Symbol.iterator]() metho
                                                  border border-gray-900 hover:bg-gray-100 
                                                  transition-colors text-[10px] flex items-center gap-1`,children:[Ce.jsx("svg",{className:"h-3.5 w-3.5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:Ce.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"})}),"Download"]}):Ce.jsxs("a",{href:`https://www.google.com/search?q=${encodeURIComponent(o.name+" comfyui custom node")}`,target:"_blank",rel:"noopener noreferrer",className:`px-2 py-1 bg-gray-100 text-gray-500 rounded-md
                                                  border border-gray-300 text-[10px] flex items-center gap-1`,children:[Ce.jsx("svg",{className:"h-3.5 w-3.5",fill:"none",viewBox:"0 0 24 24",stroke:"currentColor",children:Ce.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",strokeWidth:2,d:"M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242z"})}),"Search on Google"]})})]})},a))}),Ce.jsx("p",{className:"mt-4"}),Ce.jsx("p",{children:"After installation, please click the continue loading graph button to load the graph to the canvas:"}),Ce.jsx("div",{className:"mt-4",children:Ce.jsx("button",{className:`px-3 py-2 bg-blue-500 text-white rounded-md 
-                             hover:bg-blue-600 transition-colors text-xs block mx-auto`,onClick:e,children:"Loading graph directly"})})]})}const z5e=Object.freeze(Object.defineProperty({__proto__:null,NodeInstallGuide:e5e},Symbol.toStringTag,{value:"Module"}));export{xQ as A,bs as B,o5e as C,Ju as D,Do as E,Fa as F,zm as G,v5e as H,Nd as I,I5e as J,T5e as K,L5e as L,g5e as M,P5e as N,z5e as O,m5e as P,RQ as R,b5e as S,$5e as T,_5e as U,yo as W,w5e as X,lr as a,u5e as b,c5e as c,pA as d,d5e as e,s5e as f,a5e as g,Ba as h,SD as i,h5e as j,pc as k,p5e as l,f5e as m,y5e as n,qn as o,$A as p,Fw as q,x5e as r,E5e as s,C5e as t,EZ as u,l5e as v,n5e as w,O5e as x,CA as y,S5e as z};
+                             hover:bg-blue-600 transition-colors text-xs block mx-auto`,onClick:e,children:"Loading graph directly"})})]})}const z5e=Object.freeze(Object.defineProperty({__proto__:null,NodeInstallGuide:e5e},Symbol.toStringTag,{value:"Module"}));export{S5e as A,bs as B,o5e as C,xQ as D,Do as E,Fa as F,Ju as G,v5e as H,Nd as I,zm as J,I5e as K,T5e as L,g5e as M,P5e as N,L5e as O,m5e as P,z5e as Q,RQ as R,b5e as S,$5e as T,_5e as U,yo as W,w5e as X,lr as a,u5e as b,c5e as c,pA as d,d5e as e,s5e as f,a5e as g,Ba as h,SD as i,h5e as j,pc as k,p5e as l,f5e as m,y5e as n,qn as o,$A as p,CZ as q,Fw as r,x5e as s,E5e as t,EZ as u,l5e as v,n5e as w,C5e as x,O5e as y,CA as z};
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [project]
 name = "ComfyUI-Copilot"
 description = "Your Intelligent Assistant for Comfy-UI."
-version = "2.0.23"
+version = "2.0.24"
 license = {file = "LICENSE"}
 
 [project.urls]
```

**File**: `ui/src/components/ui/BeautifyCard.tsx` (modified, +2/-2)
```diff
@@ -1,4 +1,4 @@
-import { app } from "../../utils/comfyapp";
+import useDarkMode from '../../hooks/useDarkTheme';
 
 interface IProps {
   children?: React.ReactNode;
@@ -7,7 +7,7 @@ interface IProps {
 }
 
 const BeautifyCard: React.FC<IProps> = ({ children, className, borderClassName }) => {
-  const isDark = app.extensionManager.setting.get('Comfy.ColorPalette') === 'dark';
+  const isDark = useDarkMode()
   return (
     <div className='sticky w-full'>
       <div className={`relative ${className || ''} ${isDark ? 'beautify-card-dark' : 'beautify-card-light'}`}>
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
 `,ext:[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};y?.(t);try{f.trackEvent({event_type:"debug_trigger",message_type:"debug",message_id:e,data:{}}),await C(),u({type:"SET_LOADING",payload:!0}),await I(e)}finally{w(!1)}},C=async()=>{try{const e=await b.graphToPrompt(),t=localStorage.getItem("sessionId")||"";if(t&&e){const n=await f.saveWorkflowCheckpoint(t,e.output,e.workflow,"debug_start");if(v(n.version_id),console.log(`Saved debug start checkpoint: ${n.version_id}`),c&&r){const o=[...r.ext||[]].filter(g=>g.type!=="debug_start_checkpoint"&&!(g.type==="debug_checkpoint"&&g.data?.checkpoint_type==="debug_start"));o.push({type:"debug_start_checkpoint",data:{checkpoint_id:n.version_id,checkpoint_type:"debug_start"}});const p={id:_||m(),role:"ai",content:JSON.stringify({text:r.text,ext:o}),format:"debug_guide",name:"Assistant"};c(p)}}}catch(e){console.error("Failed to save checkpoint before debug:",e)}},I=async e=>{try{const t=await b.graphToPrompt();let n="",a=null;l&&(l.current=new AbortController);for await(const o of f.streamDebugAgent(t,l?.current?.signal||void 0))if(o.text){n=o.text,o.ext&&(a=o.ext);const p={id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};c?.(p)}c?.({id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!0,debugGuide:!0}),u({type:"SET_LOADING",payload:!1}),l.current=null}catch(t){console.error("Error calling debug agent:",t),S(!1);const a={id:e,role:"ai",content:JSON.stringify({text:`I encountered an error while analyzing your workflow: ${t.message||"Unknown error"}`,ext:[]}),format:"markdown",name:"Assistant",finished:!0};c?.(a),u({type:"SET_LOADING",payload:!1}),l.current=null}};return r?s.jsx(E,{name:k,children:s.jsxs("div",{className:"bg-gray-100 pt-4 px-4 pb-3 rounded-lg",children:[s.jsx("div",{className:"flex justify-between items-start",children:s.jsx("p",{className:"text-gray-700 text-sm flex-1",children:r.text})}),s.jsx("div",{className:"flex justify-end mt-4",children:s.jsx("button",{onClick:N,disabled:d,className:`debug-btn bg-debug-btn text-sm text-[#fff] rounded-lg px-4 py-2 ${d?"cursor-not-allowed":"cursor-pointer"}`,children:d?"Analyzing...":"Debug Errors"})}),s.jsx("div",{className:"flex justify-end mt-2",children:!!x&&s.jsx("div",{className:"ml-2 flex-shrink-0",children:s.jsx(D,{checkpointId:x,onRestore:()=>{console.log("Workflow restored from checkpoint")}})})})]})}):null}export{P as DebugGuide};
```

**File**: `dist/copilot_web/DebugResult-Co_oV90x.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,G as k,R as j}from"./message-components-CzGdQ9TQ.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-CTj3qusy.js";import"./input.js";/* empty css     */import"./App-fluNqnYs.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);return e.jsx(v,{className:"rounded-lg ",borderClassName:"rounded-lg",children:e.jsxs("div",{className:`flex flex-col ${d} ${i?"":"max-h-[200px]"}`,children:[e.jsxs("div",{className:"flex justify-between items-center pb-2 border-b border-gray-100",children:[e.jsx("div",{children:typeof a=="string"?e.jsx("h3",{className:"text-sm text-[#fff] font-medium",children:a}):a}),e.jsx("button",{onClick:()=>{r(!i)},children:i?e.jsx(u,{className:"text-gray-700"}):e.jsx(w,{className:"text-gray-700"})})]}),e.jsx("div",{className:"overflow-hidden flex-1",children:c})]})})};function E({content:n,name:a="Assistant",avatar:f,format:d="markdown"}){const c=p.useRef(null),i=()=>{let r=null,l=!1,o,x=[];try{if(o=JSON.parse(n),o.ext){let t=o.ext.find(s=>s.type==="workflow_rewrite_checkpoint"||s.type==="debug_checkpoint"&&s.data?.checkpoint_type==="workflow_rewrite_start");t&&t.data&&t.data.checkpoint_id?(r=t.data.checkpoint_id,l=!0):(t=o.ext.find(s=>s.type==="workflow_rewrite_complete"),t&&t.data&&t.data.version_id?(r=t.data.version_id,l=!0):(t=o.ext.find(s=>s.type==="debug_checkpoint"),t&&t.data&&t.data.checkpoint_id&&(r=t.data.checkpoint_id,l=!1))),o.ext.find(s=>s.type==="workflow_update")&&(l=!0),x=o.ext.find(s=>s.type==="param_update")?.data?.model_suggest||[]}}catch(t){return console.error("Failed to parse DebugResult content:",t),null}const h=l?e.jsxs("div",{className:"flex items-center text-green-500",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",fill:"currentColor",viewBox:"0 0 20 20",children:e.jsx("path",{fillRule:"evenodd",d:"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",clipRule:"evenodd"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Successfully"})]}):e.jsxs("div",{className:"flex items-center text-gray-900",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"28108",fill:"currentColor",children:e.jsx("path",{d:"M401.048025 844.855924c0 20.341281 16.643052 36.984333 36.984333 36.984333l147.936307 0c20.341281 0 36.984333-16.643052 36.984333-36.984333L622.952998 807.872614 401.048025 807.872614 401.048025 844.855924zM512 142.159744c-142.943596 0-258.888282 115.944686-258.888282 258.888282 0 88.021729 44.011376 165.503405 110.951975 212.288964l0 83.58365c0 20.341281 16.643052 36.984333 36.984333 36.984333l221.903949 0c20.341281 0 36.984333-16.643052 36.984333-36.984333l0-83.58365c66.941622-46.784536 110.951975-124.266212 110.951975-212.288964C770.888282 258.104429 654.943596 142.159744 512 142.159744zM617.588827 552.682561l-31.621185 22.005176 0 85.248569L438.031335 659.936307l0-85.063351L406.41015 552.866756c-49.743938-34.764781-79.33079-91.350544-79.33079-151.634536 0-101.890598 83.029018-184.92064 184.92064-184.92064s184.92064 83.029018 184.92064 184.92064C696.919617 461.332017 667.332764 517.91778 617.588827 552.682561z","p-id":"28277"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Finished"})]}),m=l?e.jsx("div",{className:"mt-3 text-xs text-gray-700",children:"💡 If you're not satisfied with the changes, click the restore button to revert to the previous version."}):null;return e.jsxs("div",{ref:c,className:"sticky top-0 left-0 w-full bg-gray-100 p-4 rounded-lg overflow-hidden",children:[e.jsx(y,{title:h,isWorkflowUpdate:l,className:"p-4",children:e.jsxs("div",{className:"prose prose-sm max-w-none",children:[d==="markdown"?e.jsx(k,{response:o||{}}):e.jsx("pre",{className:"whitespace-pre-wrap text-gray-700 text-sm leading-relaxed h-full",children:o?.text||""}),m]})}),x?.length>0&&e.jsx(N,{modelList:x,showPagination:!1}),e.jsx("div",{className:"flex justify-end mt-2",children:!!r&&e.jsx("div",{className:"ml-2 flex-shrink-0",children:e.jsx(j,{checkpointId:r,onRestore:()=>{console.log(`Workflow restored from ${l?"workflow update":"debug"} checkpoint`)},title:l?`Restore to this version (Version ${r})`:`Restore checkpoint ${r}`})})})]})};return e.jsx(g,{name:a,children:i()})}export{E as DebugResult};
+            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,G as k,R as j}from"./message-components-CGVXqDj7.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-c9mZt9pj.js";import"./input.js";/* empty css     */import"./App-iZNzhVOX.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);retu
```

**File**: `dist/copilot_web/WorkflowOption-C0yYHdbP.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{D,W as _,o as C,a as d}from"./message-components-CzGdQ9TQ.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as G}from"./workflowChat-CTj3qusy.js";import"./input.js";/* empty css     */import"./App-fluNqnYs.js";function Y({content:v,name:J="Assistant",avatar:P,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(G,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,L=n.outputs?n.outputs.length:0,q=n.widgets?n.widgets.length:0,B=Math.max(V,L)+q,u=S*B+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fill:"#1296db"}),t.jsx("path",{d:"M682.656 298.656m0 0l85.344 0q0 0 0 0l0 426.656q0 0 0 0l-85.344 0q0 0 0 0l0-426.656q0 0 0 0Z","p-id":"25240",fill:"#1296db"})]})}),t.jsxs("div",{className:"flex flex-row",children:[t.jsx("h3",{className:"flex-1 font-medium text-sm line-clamp-2 break-all h-10 overflow-hidden",children:e.name}),t.jsx("div",{className:"flex items-start",children:e.description&&t.jsx(D,{arrow:!1,placement:"top",title:t.jsx("div",{className:"bg-gray-900 text-white text-xs rounded-md py-2 px-3 min-w-[400px] whitespace-normal break-words",children:e.description}),children:t.jsx("div",{className:"w-5 h-5 flex items-center justify-center text-gray-500 cursor-help",children:t.jsx("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor",className:"w-4 h-4",children:t.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.
```

**File**: `dist/copilot_web/message-components-CGVXqDj7.js` (renamed, +1/-1)
```diff
@@ -330,7 +330,7 @@ html body {
               > ${e}-wrapper:only-child,
               > ${e}-expanded-row-fixed > ${e}-wrapper:only-child
             `]:{[e]:{marginBlock:se(b(n).mul(-1).equal()),marginInline:`${se(b(o).sub(i).equal())}
-                ${se(b(i).mul(-1).equal())}`,[`${e}-tbody > tr:last-child > td`]:{borderBottomWidth:0,"&:first-child, &:last-child":{borderRadius:0}}}}},"> th":{position:"relative",color:h,fontWeight:r,textAlign:"start",background:g,borderBottom:$,transition:`background ${v} ease`}}},[`${e}-footer`]:{padding:`${se(n)} ${se(i)}`,color:p,background:y}})}},mZ=t=>{const{colorFillAlter:e,colorBgContainer:r,colorTextHeading:n,colorFillSecondary:i,colorFillContent:o,controlItemBgActive:a,controlItemBgActiveHover:s,padding:l,paddingSM:c,paddingXS:u,colorBorderSecondary:f,borderRadiusLG:h,controlHeight:v,colorTextPlaceholder:g,fontSize:m,fontSizeSM:p,lineHeight:y,lineWidth:b,colorIcon:$,colorIconHover:S,opacityLoading:w,controlInteractiveSize:C}=t,E=new Ut(i).onBackground(r).toHexString(),O=new Ut(o).onBackground(r).toHexString(),x=new Ut(e).onBackground(r).toHexString(),I=new Ut($),T=new Ut(S),N=C/2-b,P=N*2+b*3;return{headerBg:x,headerColor:n,headerSortActiveBg:E,headerSortHoverBg:O,bodySortBg:x,rowHoverBg:x,rowSelectedBg:a,rowSelectedHoverBg:s,rowExpandedBg:e,cellPaddingBlock:l,cellPaddingInline:l,cellPaddingBlockMD:c,cellPaddingInlineMD:u,cellPaddingBlockSM:u,cellPaddingInlineSM:u,borderColor:f,headerBorderRadius:h,footerBg:x,footerColor:n,cellFontSize:m,cellFontSizeMD:m,cellFontSizeSM:m,headerSplitColor:f,fixedHeaderSortActiveBg:E,headerFilterHoverBg:o,filterDropdownMenuBg:r,filterDropdownBg:r,expandIconBg:r,selectionColumnWidth:v,stickyScrollBarBg:g,stickyScrollBarBorderRadius:100,expandIconMarginTop:(m*y-b*3)/2-Math.ceil((p*1.4-b*3)/2),headerIconColor:I.clone().setA(I.a*w).toRgbString(),headerIconHoverColor:T.clone().setA(T.a*w).toRgbString(),expandIconHalfInner:N,expandIconSize:P,expandIconScale:C/P}},dO=2,yZ=Gr("Table",t=>{const{colorTextHeading:e,colorSplit:r,colorBgContainer:n,controlInteractiveSize:i,headerBg:o,headerColor:a,headerSortActiveBg:s,headerSortHoverBg:l,bodySortBg:c,rowHoverBg:u,rowSelectedBg:f,rowSelectedHoverBg:h,rowExpandedBg:v,cellPaddingBlock:g,cellPaddingInline:m,cellPaddingBlockMD:p,cellPaddingInlineMD:y,cellPaddingBlockSM:b,cellPaddingInlineSM:$,borderColor:S,footerBg:w,footerColor:C,headerBorderRadius:E,cellFontSize:O,cellFontSizeMD:x,cellFontSizeSM:I,headerSplitColor:T,fixedHeaderSortActiveBg:N,headerFilterHoverBg:P,filterDropdownBg:_,expandIconBg:R,selectionColumnWidth:M,stickyScrollBarBg:D,calc:j}=t,k=Xt(t,{tableFontSize:O,tableBg:n,tableRadius:E,tablePaddingVertical:g,tablePaddingHorizontal:m,tablePaddingVerticalMiddle:p,tablePaddingHorizontalMiddle:y,tablePaddingVerticalSmall:b,tablePaddingHorizontalSmall:$,tableBorderColor:S,tableHeaderTextColor:a,tableHeaderBg:o,tableFooterTextColor:C,tableFooterBg:w,tableHeaderCellSplitColor:T,tableHeaderSortBg:s,tableHeaderSortHoverBg:l,tableBodySortBg:c,tableFixedHeaderSortActiveBg:N,tableHeaderFilterActiveBg:P,tableFilterDropdownBg:_,tableRowHoverBg:u,tableSelectedRowBg:f,tableSelectedRowHoverBg:h,zIndexTableFixed:dO,zIndexTableSticky:j(dO).add(1).equal({unit:!1}),tableFontSizeMiddle:x,tableFontSizeSmall:I,tableSelectionColumnWidth:M,tableExpandIconBg:R,tableExpandColumnWidth:j(i).add(j(t.padding).mul(2)).equal(),tableExpandedRowBg:v,tableFilterDropdownWidth:120,tableFilterDropdownHeight:264,tableFilterDropdownSearchWidth:140,tableScrollThumbSize:8,tableScrollThumbBg:D,tableScrollThumbBgHover:e,tableScrollBg:r});return[gZ(k),lZ(k),uO(k),hZ(k),aZ(k),rZ(k),cZ(k),oZ(k),uO(k),iZ(k),dZ(k),sZ(k),vZ(k),nZ(k),fZ(k),uZ(k),pZ(k)]},mZ,{unitless:{expandIconScale:!0}}),bZ=[],$Z=(t,e)=>{var r,n;const{prefixCls:i,className:o,rootClassName:a,style:s,size:l,bordered:c,dropdownPrefixCls:u,dataSource:f,pagination:h,rowSelection:v,rowKey:g="key",rowClassName:m,columns:p,children:y,childrenColumnName:b,onChange:$,getPopupContainer:S,loading:w,expandIcon:C,expandable:E,expandedRowRender:O,expandIconColumnIndex:x,indentSize:I,scroll:T,sortDirections:N,locale:P,showSorterTooltip:_={target:"full-header"},virtual:R}=t;Ms();const M=d.useMemo(()=>p||Rw(y),[p,y]),D=d.useMemo(()=>M.some(Ue=>Ue.responsive),[M]),j=hw(D),k=d.useMemo(()=>{const Ue=new Set(Object.keys(j).filter(He=>j[He]));return M.filter(He=>!He.responsive||He.responsive.some(rt=>Ue.has(rt)))},[M,j]),V=yn(t,["className","style","columns"]),{locale:G=_a,direction:W,table:Y,renderEmpty:q,getPrefixCls:J,getPopupContainer:oe}=d.useContext(Dt),ie=no(l),te=Object.assign(Object.assign({},G.Table),P),z=f||bZ,K=J("table",i),B=J("dropdown",u),[,F]=_n(),U=yi(K),[Z,ee,Q]=yZ(K,U),ce=Object.assign(Object.assign({childrenColumnName:b,expandIconColumnIndex:x},E),{expandIcon:(r=E?.expandIcon)!==null&&r!==void 0?r:(n=Y?.expandable)===null||n===void 0?void 0:n.expandIcon}),{childrenColumnName:me="children"}=ce,Te=d.useMemo(()=>z.some(Ue=>Ue?.[me])?"nest":O||E?.expandedRowRender?"row":null
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [project]
 name = "ComfyUI-Copilot"
 description = "Your Intelligent Assistant for Comfy-UI."
-version = "2.0.21"
+version = "2.0.22"
 license = {file = "LICENSE"}
 
 [project.urls]
```

**File**: `ui/src/components/debug/utils/imageGenerationUtils.ts` (modified, +10/-7)
```diff
@@ -139,6 +139,7 @@ export const handleStartGeneration = async (
     const primaryNodeId = Object.keys(paramTestValues)[0];
     const primaryNodeName = selectedNodeInfoMap[primaryNodeId] || "Unknown Node";
 
+    const finished_ids = {}
     // Start polling for images
     pollForImages(
       prompt_ids,
@@ -150,6 +151,7 @@ export const handleStartGeneration = async (
       pollingSessionIdRef,
       pollingTimeoutRef,
       updateState,
+      finished_ids,
       primaryNodeName,
       paramTestValues,
       totalCombinations,
@@ -175,6 +177,7 @@ export const pollForImages = async (
   pollingSessionIdRef: React.MutableRefObject<string | null>,
   pollingTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>,
   updateState: (key: StateKey, value: any) => void,
+  finished_ids: Record<string, boolean>,
   nodeName?: string,
   paramTestValues?: {[nodeId: string]: {[paramName: string]: any[]}},
   totalCount?: number,
@@ -186,10 +189,8 @@ export const pollForImages = async (
     console.log("Another polling session has started, stopping this one");
     return;
   }
-  // has avaiable promptId，if not, stop polling
-  const hasAvailablePromptId = prompt_ids.some(id => !!id && id !== '')
   // Check if timeout has been reached or has no avaiable promptId
-  if (Date.now() - startTime > timeoutDuration || !hasAvailablePromptId) {
+  if (Date.now() - startTime > timeoutDuration) {
     console.log("Timeout reached while waiting for images");
     if (pollingSessionIdRef.current === sessionId) {
       updateState(StateKey.IsProcessing, false);
@@ -220,12 +221,12 @@ export const pollForImages = async (
     return;
   }
   
-  let completedImagesCount = 0;
+  let completedImagesCount = Object.keys(finished_ids)?.length || 0;
 
   // Check each prompt id to see if images are ready
   for (let i = 0; i < prompt_ids.length; i++) {
     const promptId = prompt_ids[i];
-    if (!promptId) continue;
+    if (!promptId || finished_ids[promptId]) continue;
     
     try {
       // We've already verified showNodeId is not null at this point
@@ -235,10 +236,11 @@ export const pollForImages = async (
         // If we have an image URL, update in our array
         newImages[i] = {
           ...newImages[i],
-          url: imageUrl || ''
+          url: imageUrl
         };
+        finished_ids[promptId] = true
+        completedImagesCount++;
       }
-      completedImagesCount++;
     } catch (error) {
       console.error(`Error fetching image for prompt ID ${promptId}:`, error);
     }
@@ -293,6 +295,7 @@ export const pollForImages = async (
         pollingSessionIdRef,
         pollingTimeoutRef,
         updateState,
+        finished_ids,
         nodeName,
         paramTestValues,
         totalCount,
```

---

### Incident Patch 11: `29078301` (2025-11-13)
**Commit Message**: feat: bug fix

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
 `,ext:[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};y?.(t);try{f.trackEvent({event_type:"debug_trigger",message_type:"debug",message_id:e,data:{}}),await C(),u({type:"SET_LOADING",payload:!0}),await I(e)}finally{w(!1)}},C=async()=>{try{const e=await b.graphToPrompt(),t=localStorage.getItem("sessionId")||"";if(t&&e){const n=await f.saveWorkflowCheckpoint(t,e.output,e.workflow,"debug_start");if(v(n.version_id),console.log(`Saved debug start checkpoint: ${n.version_id}`),c&&r){const o=[...r.ext||[]].filter(g=>g.type!=="debug_start_checkpoint"&&!(g.type==="debug_checkpoint"&&g.data?.checkpoint_type==="debug_start"));o.push({type:"debug_start_checkpoint",data:{checkpoint_id:n.version_id,checkpoint_type:"debug_start"}});const p={id:_||m(),role:"ai",content:JSON.stringify({text:r.text,ext:o}),format:"debug_guide",name:"Assistant"};c(p)}}}catch(e){console.error("Failed to save checkpoint before debug:",e)}},I=async e=>{try{const t=await b.graphToPrompt();let n="",a=null;l&&(l.current=new AbortController);for await(const o of f.streamDebugAgent(t,l?.current?.signal||void 0))if(o.text){n=o.text,o.ext&&(a=o.ext);const p={id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};c?.(p)}c?.({id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!0,debugGuide:!0}),u({type:"SET_LOADING",payload:!1}),l.current=null}catch(t){console.error("Error calling debug agent:",t),S(!1);const a={id:e,role:"ai",content:JSON.stringify({text:`I encountered an error while analyzing your workflow: ${t.message||"Unknown error"}`,ext:[]}),format:"markdown",name:"Assistant",finished:!0};c?.(a),u({type:"SET_LOADING",payload:!1}),l.current=null}};return r?s.jsx(E,{name:k,children:s.jsxs("div",{className:"bg-gray-100 pt-4 px-4 pb-3 rounded-lg",children:[s.jsx("div",{className:"flex justify-between items-start",children:s.jsx("p",{className:"text-gray-700 text-sm flex-1",children:r.text})}),s.jsx("div",{className:"flex justify-end mt-4",children:s.jsx("button",{onClick:N,disabled:d,className:`debug-btn bg-debug-btn text-sm text-[#fff] rounded-lg px-4 py-2 ${d?"cursor-not-allowed":"cursor-pointer"}`,children:d?"Analyzing...":"Debug Errors"})}),s.jsx("div",{className:"flex justify-end mt-2",children:!!x&&s.jsx("div",{className:"ml-2 flex-shrink-0",children:s.jsx(D,{checkpointId:x,onRestore:()=>{console.log("Workflow restored from checkpoint")}})})})]})}):null}export{P as DebugGuide};
```

**File**: `dist/copilot_web/DebugResult-Co_oV90x.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,G as k,R as j}from"./message-components-CzGdQ9TQ.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-CTj3qusy.js";import"./input.js";/* empty css     */import"./App-fluNqnYs.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);return e.jsx(v,{className:"rounded-lg ",borderClassName:"rounded-lg",children:e.jsxs("div",{className:`flex flex-col ${d} ${i?"":"max-h-[200px]"}`,children:[e.jsxs("div",{className:"flex justify-between items-center pb-2 border-b border-gray-100",children:[e.jsx("div",{children:typeof a=="string"?e.jsx("h3",{className:"text-sm text-[#fff] font-medium",children:a}):a}),e.jsx("button",{onClick:()=>{r(!i)},children:i?e.jsx(u,{className:"text-gray-700"}):e.jsx(w,{className:"text-gray-700"})})]}),e.jsx("div",{className:"overflow-hidden flex-1",children:c})]})})};function E({content:n,name:a="Assistant",avatar:f,format:d="markdown"}){const c=p.useRef(null),i=()=>{let r=null,l=!1,o,x=[];try{if(o=JSON.parse(n),o.ext){let t=o.ext.find(s=>s.type==="workflow_rewrite_checkpoint"||s.type==="debug_checkpoint"&&s.data?.checkpoint_type==="workflow_rewrite_start");t&&t.data&&t.data.checkpoint_id?(r=t.data.checkpoint_id,l=!0):(t=o.ext.find(s=>s.type==="workflow_rewrite_complete"),t&&t.data&&t.data.version_id?(r=t.data.version_id,l=!0):(t=o.ext.find(s=>s.type==="debug_checkpoint"),t&&t.data&&t.data.checkpoint_id&&(r=t.data.checkpoint_id,l=!1))),o.ext.find(s=>s.type==="workflow_update")&&(l=!0),x=o.ext.find(s=>s.type==="param_update")?.data?.model_suggest||[]}}catch(t){return console.error("Failed to parse DebugResult content:",t),null}const h=l?e.jsxs("div",{className:"flex items-center text-green-500",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",fill:"currentColor",viewBox:"0 0 20 20",children:e.jsx("path",{fillRule:"evenodd",d:"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",clipRule:"evenodd"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Successfully"})]}):e.jsxs("div",{className:"flex items-center text-gray-900",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"28108",fill:"currentColor",children:e.jsx("path",{d:"M401.048025 844.855924c0 20.341281 16.643052 36.984333 36.984333 36.984333l147.936307 0c20.341281 0 36.984333-16.643052 36.984333-36.984333L622.952998 807.872614 401.048025 807.872614 401.048025 844.855924zM512 142.159744c-142.943596 0-258.888282 115.944686-258.888282 258.888282 0 88.021729 44.011376 165.503405 110.951975 212.288964l0 83.58365c0 20.341281 16.643052 36.984333 36.984333 36.984333l221.903949 0c20.341281 0 36.984333-16.643052 36.984333-36.984333l0-83.58365c66.941622-46.784536 110.951975-124.266212 110.951975-212.288964C770.888282 258.104429 654.943596 142.159744 512 142.159744zM617.588827 552.682561l-31.621185 22.005176 0 85.248569L438.031335 659.936307l0-85.063351L406.41015 552.866756c-49.743938-34.764781-79.33079-91.350544-79.33079-151.634536 0-101.890598 83.029018-184.92064 184.92064-184.92064s184.92064 83.029018 184.92064 184.92064C696.919617 461.332017 667.332764 517.91778 617.588827 552.682561z","p-id":"28277"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Finished"})]}),m=l?e.jsx("div",{className:"mt-3 text-xs text-gray-700",children:"💡 If you're not satisfied with the changes, click the restore button to revert to the previous version."}):null;return e.jsxs("div",{ref:c,className:"sticky top-0 left-0 w-full bg-gray-100 p-4 rounded-lg overflow-hidden",children:[e.jsx(y,{title:h,isWorkflowUpdate:l,className:"p-4",children:e.jsxs("div",{className:"prose prose-sm max-w-none",children:[d==="markdown"?e.jsx(k,{response:o||{}}):e.jsx("pre",{className:"whitespace-pre-wrap text-gray-700 text-sm leading-relaxed h-full",children:o?.text||""}),m]})}),x?.length>0&&e.jsx(N,{modelList:x,showPagination:!1}),e.jsx("div",{className:"flex justify-end mt-2",children:!!r&&e.jsx("div",{className:"ml-2 flex-shrink-0",children:e.jsx(j,{checkpointId:r,onRestore:()=>{console.log(`Workflow restored from ${l?"workflow update":"debug"} checkpoint`)},title:l?`Restore to this version (Version ${r})`:`Restore checkpoint ${r}`})})})]})};return e.jsx(g,{name:a,children:i()})}export{E as DebugResult};
+            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,G as k,R as j}from"./message-components-CGVXqDj7.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-c9mZt9pj.js";import"./input.js";/* empty css     */import"./App-iZNzhVOX.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);retu
```

**File**: `dist/copilot_web/WorkflowOption-C0yYHdbP.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{D,W as _,o as C,a as d}from"./message-components-CzGdQ9TQ.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as G}from"./workflowChat-CTj3qusy.js";import"./input.js";/* empty css     */import"./App-fluNqnYs.js";function Y({content:v,name:J="Assistant",avatar:P,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(G,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,L=n.outputs?n.outputs.length:0,q=n.widgets?n.widgets.length:0,B=Math.max(V,L)+q,u=S*B+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fill:"#1296db"}),t.jsx("path",{d:"M682.656 298.656m0 0l85.344 0q0 0 0 0l0 426.656q0 0 0 0l-85.344 0q0 0 0 0l0-426.656q0 0 0 0Z","p-id":"25240",fill:"#1296db"})]})}),t.jsxs("div",{className:"flex flex-row",children:[t.jsx("h3",{className:"flex-1 font-medium text-sm line-clamp-2 break-all h-10 overflow-hidden",children:e.name}),t.jsx("div",{className:"flex items-start",children:e.description&&t.jsx(D,{arrow:!1,placement:"top",title:t.jsx("div",{className:"bg-gray-900 text-white text-xs rounded-md py-2 px-3 min-w-[400px] whitespace-normal break-words",children:e.description}),children:t.jsx("div",{className:"w-5 h-5 flex items-center justify-center text-gray-500 cursor-help",children:t.jsx("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor",className:"w-4 h-4",children:t.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.
```

**File**: `dist/copilot_web/message-components-CGVXqDj7.js` (renamed, +1/-1)
```diff
@@ -330,7 +330,7 @@ html body {
               > ${e}-wrapper:only-child,
               > ${e}-expanded-row-fixed > ${e}-wrapper:only-child
             `]:{[e]:{marginBlock:se(b(n).mul(-1).equal()),marginInline:`${se(b(o).sub(i).equal())}
-                ${se(b(i).mul(-1).equal())}`,[`${e}-tbody > tr:last-child > td`]:{borderBottomWidth:0,"&:first-child, &:last-child":{borderRadius:0}}}}},"> th":{position:"relative",color:h,fontWeight:r,textAlign:"start",background:g,borderBottom:$,transition:`background ${v} ease`}}},[`${e}-footer`]:{padding:`${se(n)} ${se(i)}`,color:p,background:y}})}},mZ=t=>{const{colorFillAlter:e,colorBgContainer:r,colorTextHeading:n,colorFillSecondary:i,colorFillContent:o,controlItemBgActive:a,controlItemBgActiveHover:s,padding:l,paddingSM:c,paddingXS:u,colorBorderSecondary:f,borderRadiusLG:h,controlHeight:v,colorTextPlaceholder:g,fontSize:m,fontSizeSM:p,lineHeight:y,lineWidth:b,colorIcon:$,colorIconHover:S,opacityLoading:w,controlInteractiveSize:C}=t,E=new Ut(i).onBackground(r).toHexString(),O=new Ut(o).onBackground(r).toHexString(),x=new Ut(e).onBackground(r).toHexString(),I=new Ut($),T=new Ut(S),N=C/2-b,P=N*2+b*3;return{headerBg:x,headerColor:n,headerSortActiveBg:E,headerSortHoverBg:O,bodySortBg:x,rowHoverBg:x,rowSelectedBg:a,rowSelectedHoverBg:s,rowExpandedBg:e,cellPaddingBlock:l,cellPaddingInline:l,cellPaddingBlockMD:c,cellPaddingInlineMD:u,cellPaddingBlockSM:u,cellPaddingInlineSM:u,borderColor:f,headerBorderRadius:h,footerBg:x,footerColor:n,cellFontSize:m,cellFontSizeMD:m,cellFontSizeSM:m,headerSplitColor:f,fixedHeaderSortActiveBg:E,headerFilterHoverBg:o,filterDropdownMenuBg:r,filterDropdownBg:r,expandIconBg:r,selectionColumnWidth:v,stickyScrollBarBg:g,stickyScrollBarBorderRadius:100,expandIconMarginTop:(m*y-b*3)/2-Math.ceil((p*1.4-b*3)/2),headerIconColor:I.clone().setA(I.a*w).toRgbString(),headerIconHoverColor:T.clone().setA(T.a*w).toRgbString(),expandIconHalfInner:N,expandIconSize:P,expandIconScale:C/P}},dO=2,yZ=Gr("Table",t=>{const{colorTextHeading:e,colorSplit:r,colorBgContainer:n,controlInteractiveSize:i,headerBg:o,headerColor:a,headerSortActiveBg:s,headerSortHoverBg:l,bodySortBg:c,rowHoverBg:u,rowSelectedBg:f,rowSelectedHoverBg:h,rowExpandedBg:v,cellPaddingBlock:g,cellPaddingInline:m,cellPaddingBlockMD:p,cellPaddingInlineMD:y,cellPaddingBlockSM:b,cellPaddingInlineSM:$,borderColor:S,footerBg:w,footerColor:C,headerBorderRadius:E,cellFontSize:O,cellFontSizeMD:x,cellFontSizeSM:I,headerSplitColor:T,fixedHeaderSortActiveBg:N,headerFilterHoverBg:P,filterDropdownBg:_,expandIconBg:R,selectionColumnWidth:M,stickyScrollBarBg:D,calc:j}=t,k=Xt(t,{tableFontSize:O,tableBg:n,tableRadius:E,tablePaddingVertical:g,tablePaddingHorizontal:m,tablePaddingVerticalMiddle:p,tablePaddingHorizontalMiddle:y,tablePaddingVerticalSmall:b,tablePaddingHorizontalSmall:$,tableBorderColor:S,tableHeaderTextColor:a,tableHeaderBg:o,tableFooterTextColor:C,tableFooterBg:w,tableHeaderCellSplitColor:T,tableHeaderSortBg:s,tableHeaderSortHoverBg:l,tableBodySortBg:c,tableFixedHeaderSortActiveBg:N,tableHeaderFilterActiveBg:P,tableFilterDropdownBg:_,tableRowHoverBg:u,tableSelectedRowBg:f,tableSelectedRowHoverBg:h,zIndexTableFixed:dO,zIndexTableSticky:j(dO).add(1).equal({unit:!1}),tableFontSizeMiddle:x,tableFontSizeSmall:I,tableSelectionColumnWidth:M,tableExpandIconBg:R,tableExpandColumnWidth:j(i).add(j(t.padding).mul(2)).equal(),tableExpandedRowBg:v,tableFilterDropdownWidth:120,tableFilterDropdownHeight:264,tableFilterDropdownSearchWidth:140,tableScrollThumbSize:8,tableScrollThumbBg:D,tableScrollThumbBgHover:e,tableScrollBg:r});return[gZ(k),lZ(k),uO(k),hZ(k),aZ(k),rZ(k),cZ(k),oZ(k),uO(k),iZ(k),dZ(k),sZ(k),vZ(k),nZ(k),fZ(k),uZ(k),pZ(k)]},mZ,{unitless:{expandIconScale:!0}}),bZ=[],$Z=(t,e)=>{var r,n;const{prefixCls:i,className:o,rootClassName:a,style:s,size:l,bordered:c,dropdownPrefixCls:u,dataSource:f,pagination:h,rowSelection:v,rowKey:g="key",rowClassName:m,columns:p,children:y,childrenColumnName:b,onChange:$,getPopupContainer:S,loading:w,expandIcon:C,expandable:E,expandedRowRender:O,expandIconColumnIndex:x,indentSize:I,scroll:T,sortDirections:N,locale:P,showSorterTooltip:_={target:"full-header"},virtual:R}=t;Ms();const M=d.useMemo(()=>p||Rw(y),[p,y]),D=d.useMemo(()=>M.some(Ue=>Ue.responsive),[M]),j=hw(D),k=d.useMemo(()=>{const Ue=new Set(Object.keys(j).filter(He=>j[He]));return M.filter(He=>!He.responsive||He.responsive.some(rt=>Ue.has(rt)))},[M,j]),V=yn(t,["className","style","columns"]),{locale:G=_a,direction:W,table:Y,renderEmpty:q,getPrefixCls:J,getPopupContainer:oe}=d.useContext(Dt),ie=no(l),te=Object.assign(Object.assign({},G.Table),P),z=f||bZ,K=J("table",i),B=J("dropdown",u),[,F]=_n(),U=yi(K),[Z,ee,Q]=yZ(K,U),ce=Object.assign(Object.assign({childrenColumnName:b,expandIconColumnIndex:x},E),{expandIcon:(r=E?.expandIcon)!==null&&r!==void 0?r:(n=Y?.expandable)===null||n===void 0?void 0:n.expandIcon}),{childrenColumnName:me="children"}=ce,Te=d.useMemo(()=>z.some(Ue=>Ue?.[me])?"nest":O||E?.expandedRowRender?"row":null
```

**File**: `ui/src/components/debug/utils/imageGenerationUtils.ts` (modified, +1/-1)
```diff
@@ -221,7 +221,7 @@ export const pollForImages = async (
     return;
   }
   
-  let completedImagesCount = 0;
+  let completedImagesCount = Object.keys(finished_ids)?.length || 0;
 
   // Check each prompt id to see if images are ready
   for (let i = 0; i < prompt_ids.length; i++) {
```

---

### Incident Patch 12: `cb7cbffe` (2025-10-21)
**Commit Message**: bugfix:Error checking required nodes. Please try again.

**File**: `dist/copilot_web/App-fluNqnYs.js` (renamed, +2/-2)
```diff
@@ -1,7 +1,7 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-2zkTTHg9.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components-CGVXqDj7.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
+            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-CTj3qusy.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components-CzGdQ9TQ.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
                         const apiBase = window.comfyAPI?.api?.api?.api_base;
                         if (apiBase) {
                             // 有 API base 时，使用完整路径
@@ -11,4 +11,4 @@ function getImportPath(filename) {
                             return `./${path}`;
                         }
                     }))))=>i.map(i=>d[i]);
-import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components-CGVXqDj7.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-2zkTTHg9.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
+import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components-CzGdQ9TQ.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-CTj3qusy.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
```

**File**: `dist/copilot_web/DebugGuide-BpkLL6XH.js` (renamed, +1/-1)
```diff
@@ -1,5 +1,5 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as s}from"./vendor-markdown-B4Av9P7l.js";import{r as i}from"./vendor-react-ByKzdfMq.js";import{u as A,p as E,R as D,o as m,W as f,a as b}from"./message-components-CGVXqDj7.js";function P({content:h,name:k="Assistant",avatar:O,onAddMessage:y,onUpdateMessage:c,messageId:_}){const{dispatch:u,abortControllerRef:l}=A(),[d,w]=i.useState(!1),[T,G]=i.useState(""),[J,S]=i.useState(!1),[j,v]=i.useState(null),r=i.useMemo(()=>{try{return JSON.parse(h)}catch(e){return console.error("Failed to parse message content:",e),null}},[h]),x=i.useMemo(()=>{if(!r||!r.ext)return null;const e=r.ext.find(t=>t.type==="debug_start_checkpoint"||t.type==="debug_checkpoint"&&t.data?.checkpoint_type==="debug_start");return e&&e.data&&e.data.checkpoint_id?e.data.checkpoint_id:null},[r])||j,N=async()=>{if(d)return;const e=m(),t={id:e,role:"ai",content:JSON.stringify({text:`🔍 Starting workflow analysis...
+            import{j as s}from"./vendor-markdown-B4Av9P7l.js";import{r as i}from"./vendor-react-ByKzdfMq.js";import{u as A,p as E,R as D,o as m,W as f,a as b}from"./message-components-CzGdQ9TQ.js";function P({content:h,name:k="Assistant",avatar:O,onAddMessage:y,onUpdateMessage:c,messageId:_}){const{dispatch:u,abortControllerRef:l}=A(),[d,w]=i.useState(!1),[T,G]=i.useState(""),[J,S]=i.useState(!1),[j,v]=i.useState(null),r=i.useMemo(()=>{try{return JSON.parse(h)}catch(e){return console.error("Failed to parse message content:",e),null}},[h]),x=i.useMemo(()=>{if(!r||!r.ext)return null;const e=r.ext.find(t=>t.type==="debug_start_checkpoint"||t.type==="debug_checkpoint"&&t.data?.checkpoint_type==="debug_start");return e&&e.data&&e.data.checkpoint_id?e.data.checkpoint_id:null},[r])||j,N=async()=>{if(d)return;const e=m(),t={id:e,role:"ai",content:JSON.stringify({text:`🔍 Starting workflow analysis...
 `,ext:[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};y?.(t);try{f.trackEvent({event_type:"debug_trigger",message_type:"debug",message_id:e,data:{}}),await C(),u({type:"SET_LOADING",payload:!0}),await I(e)}finally{w(!1)}},C=async()=>{try{const e=await b.graphToPrompt(),t=localStorage.getItem("sessionId")||"";if(t&&e){const n=await f.saveWorkflowCheckpoint(t,e.output,e.workflow,"debug_start");if(v(n.version_id),console.log(`Saved debug start checkpoint: ${n.version_id}`),c&&r){const o=[...r.ext||[]].filter(g=>g.type!=="debug_start_checkpoint"&&!(g.type==="debug_checkpoint"&&g.data?.checkpoint_type==="debug_start"));o.push({type:"debug_start_checkpoint",data:{checkpoint_id:n.version_id,checkpoint_type:"debug_start"}});const p={id:_||m(),role:"ai",content:JSON.stringify({text:r.text,ext:o}),format:"debug_guide",name:"Assistant"};c(p)}}}catch(e){console.error("Failed to save checkpoint before debug:",e)}},I=async e=>{try{const t=await b.graphToPrompt();let n="",a=null;l&&(l.current=new AbortController);for await(const o of f.streamDebugAgent(t,l?.current?.signal||void 0))if(o.text){n=o.text,o.ext&&(a=o.ext);const p={id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};c?.(p)}c?.({id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!0,debugGuide:!0}),u({type:"SET_LOADING",payload:!1}),l.current=null}catch(t){console.error("Error calling debug agent:",t),S(!1);const a={id:e,role:"ai",content:JSON.stringify({text:`I encountered an error while analyzing your workflow: ${t.message||"Unknown error"}`,ext:[]}),format:"markdown",name:"Assistant",finished:!0};c?.(a),u({type:"SET_LOADING",payload:!1}),l.current=null}};return r?s.jsx(E,{name:k,children:s.jsxs("div",{className:"bg-gray-100 pt-4 px-4 pb-3 rounded-lg",children:[s.jsx("div",{className:"flex justify-between items-start",children:s.jsx("p",{className:"text-gray-700 text-sm flex-1",children:r.text})}),s.jsx("div",{className:"flex justify-end mt-4",children:s.jsx("button",{onClick:N,disabled:d,className:`debug-btn bg-debug-btn text-sm text-[#fff] rounded-lg px-4 py-2 ${d?"cursor-not-allowed":"cursor-pointer"}`,children:d?"Analyzing...":"Debug Errors"})}),s.jsx("div",{className:"flex justify-end mt-2",children:!!x&&s.jsx("div",{className:"ml-2 flex-shrink-0",children:s.jsx(D,{checkpointId:x,onRestore:()=>{console.log("Workflow restored from checkpoint")}})})})]})}):null}export{P as DebugGuide};
```

**File**: `dist/copilot_web/DebugResult-CWUJVPnw.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,G as k,R as j}from"./message-components-CGVXqDj7.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-2zkTTHg9.js";import"./input.js";/* empty css     */import"./App-CmJI_Xeo.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);return e.jsx(v,{className:"rounded-lg ",borderClassName:"rounded-lg",children:e.jsxs("div",{className:`flex flex-col ${d} ${i?"":"max-h-[200px]"}`,children:[e.jsxs("div",{className:"flex justify-between items-center pb-2 border-b border-gray-100",children:[e.jsx("div",{children:typeof a=="string"?e.jsx("h3",{className:"text-sm text-[#fff] font-medium",children:a}):a}),e.jsx("button",{onClick:()=>{r(!i)},children:i?e.jsx(u,{className:"text-gray-700"}):e.jsx(w,{className:"text-gray-700"})})]}),e.jsx("div",{className:"overflow-hidden flex-1",children:c})]})})};function E({content:n,name:a="Assistant",avatar:f,format:d="markdown"}){const c=p.useRef(null),i=()=>{let r=null,l=!1,o,x=[];try{if(o=JSON.parse(n),o.ext){let t=o.ext.find(s=>s.type==="workflow_rewrite_checkpoint"||s.type==="debug_checkpoint"&&s.data?.checkpoint_type==="workflow_rewrite_start");t&&t.data&&t.data.checkpoint_id?(r=t.data.checkpoint_id,l=!0):(t=o.ext.find(s=>s.type==="workflow_rewrite_complete"),t&&t.data&&t.data.version_id?(r=t.data.version_id,l=!0):(t=o.ext.find(s=>s.type==="debug_checkpoint"),t&&t.data&&t.data.checkpoint_id&&(r=t.data.checkpoint_id,l=!1))),o.ext.find(s=>s.type==="workflow_update")&&(l=!0),x=o.ext.find(s=>s.type==="param_update")?.data?.model_suggest||[]}}catch(t){return console.error("Failed to parse DebugResult content:",t),null}const h=l?e.jsxs("div",{className:"flex items-center text-green-500",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",fill:"currentColor",viewBox:"0 0 20 20",children:e.jsx("path",{fillRule:"evenodd",d:"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",clipRule:"evenodd"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Successfully"})]}):e.jsxs("div",{className:"flex items-center text-gray-900",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"28108",fill:"currentColor",children:e.jsx("path",{d:"M401.048025 844.855924c0 20.341281 16.643052 36.984333 36.984333 36.984333l147.936307 0c20.341281 0 36.984333-16.643052 36.984333-36.984333L622.952998 807.872614 401.048025 807.872614 401.048025 844.855924zM512 142.159744c-142.943596 0-258.888282 115.944686-258.888282 258.888282 0 88.021729 44.011376 165.503405 110.951975 212.288964l0 83.58365c0 20.341281 16.643052 36.984333 36.984333 36.984333l221.903949 0c20.341281 0 36.984333-16.643052 36.984333-36.984333l0-83.58365c66.941622-46.784536 110.951975-124.266212 110.951975-212.288964C770.888282 258.104429 654.943596 142.159744 512 142.159744zM617.588827 552.682561l-31.621185 22.005176 0 85.248569L438.031335 659.936307l0-85.063351L406.41015 552.866756c-49.743938-34.764781-79.33079-91.350544-79.33079-151.634536 0-101.890598 83.029018-184.92064 184.92064-184.92064s184.92064 83.029018 184.92064 184.92064C696.919617 461.332017 667.332764 517.91778 617.588827 552.682561z","p-id":"28277"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Finished"})]}),m=l?e.jsx("div",{className:"mt-3 text-xs text-gray-700",children:"💡 If you're not satisfied with the changes, click the restore button to revert to the previous version."}):null;return e.jsxs("div",{ref:c,className:"sticky top-0 left-0 w-full bg-gray-100 p-4 rounded-lg overflow-hidden",children:[e.jsx(y,{title:h,isWorkflowUpdate:l,className:"p-4",children:e.jsxs("div",{className:"prose prose-sm max-w-none",children:[d==="markdown"?e.jsx(k,{response:o||{}}):e.jsx("pre",{className:"whitespace-pre-wrap text-gray-700 text-sm leading-relaxed h-full",children:o?.text||""}),m]})}),x?.length>0&&e.jsx(N,{modelList:x,showPagination:!1}),e.jsx("div",{className:"flex justify-end mt-2",children:!!r&&e.jsx("div",{className:"ml-2 flex-shrink-0",children:e.jsx(j,{checkpointId:r,onRestore:()=>{console.log(`Workflow restored from ${l?"workflow update":"debug"} checkpoint`)},title:l?`Restore to this version (Version ${r})`:`Restore checkpoint ${r}`})})})]})};return e.jsx(g,{name:a,children:i()})}export{E as DebugResult};
+            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,G as k,R as j}from"./message-components-CzGdQ9TQ.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-CTj3qusy.js";import"./input.js";/* empty css     */import"./App-fluNqnYs.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);retu
```

**File**: `dist/copilot_web/WorkflowOption-B2WoNUHM.js` (removed, +0/-4)
```diff
@@ -1,4 +0,0 @@
-function getImportPath(filename) {
-            return `./${filename}`;
-        }
-            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{D as B,W as v,o as C,a as d}from"./message-components-CGVXqDj7.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as D}from"./workflowChat-2zkTTHg9.js";import"./input.js";/* empty css     */import"./App-CmJI_Xeo.js";function Y({content:_,name:G="Assistant",avatar:J,latestInput:z,installedNodes:N,onAddMessage:y}){const[f,g]=h.useState({}),[A,E]=h.useState(null),[b,W]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(_);E(e),W(e.ext?.find(a=>a.type==="workflow")?.data||[])},[_]);const M=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(o=>({...o,[a]:!0})),v.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:A?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(D,{}));try{const o=await v.getOptimizedWorkflow(e.id,z);if(o.workflow){const i=new Set;if(o.workflow.nodes)for(const s of o.workflow.nodes)i.add(s.type);else for(const s of Object.values(o.workflow))i.add(s.class_type);const r=Array.from(i).filter(s=>!N.includes(s));if(console.log("[WorkflowOption] Missing node types:",r),r.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const s=await v.batchGetNodeInfo(r);console.log("[WorkflowOption] Received node infos:",s);const p={text:"",ext:[{type:"node_install_guide",data:s.map(l=>({name:l.name,repository_url:l.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:o.workflow,optimizedParams:o.optimized_params}};y?.(c)}catch(s){console.error("[WorkflowOption] Error fetching node info:",s),alert("Error checking required nodes. Please try again.")}finally{g(s=>({...s,[a]:!1}))}return}I(o.workflow,o.optimized_params)}}catch(o){console.error("Failed to optimize workflow:",o),alert("Failed to optimize workflow. Please try again.")}finally{g(o=>({...o,[a]:!1}))}}},I=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),r=Object.keys(d.graph._nodes_by_id)[0],s=d.graph._nodes_by_id[r],p=s?s.pos[0]:0,c=s?s.pos[1]:0,l=250,m=60,S=20,F=60,j=50,H=1e3;let k=p,x=c,w=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){w>H&&(k+=l+F,w=0,x=c);const V=n.inputs?n.inputs.length:0,q=n.outputs?n.outputs.length:0,L=n.widgets?n.widgets.length:0,P=Math.max(V,q)+L,u=S*P+m;n.size[0]=l,n.size[1]=u,n.pos[0]=k,n.pos[1]=x,w+=u+j,x+=u+j}}}for(const[i,r,s,p,c]of a){const l=d.graph._nodes_by_id[i].widgets;for(const m of l)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const o={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(o)},O=(e,a)=>{const o=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fill:"#1296db"}),t.jsx("path",{d:"M682.656 298.656m0 0l85.344 0q0 0 0 0l0 426.656q0 0 0 0l-85.344 0q0 0 0 0l0-426.656q0 0 0 0Z","p-id":"25240",fill:"#1296db"})]})}),t.jsxs("div",{className:"flex flex-row",children:[t.jsx("h3",{className:"flex-1 font-medium text-sm line-clamp-2 break-all h-10 overflow-hidden",children:e.name}),t.jsx("div",{className:"flex items-start",children:e.description&&t.jsx(B,{arrow:!1,placement:"top",title:t.jsx("div",{className:"bg-gray-900 text-white text-xs rounded-md py-2 px-3 min-w-[400px] whitespace-normal break-words",children:e.description}),children:t.jsx("div",{className:"w-5 h-5 flex items-center justify-center text-gray-500 cursor-help",children:t.jsx("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor",className:"w-4 h-4",children:t.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.
```

**File**: `dist/copilot_web/WorkflowOption-CdGtQvHG.js` (added, +4/-0)
```diff
@@ -0,0 +1,4 @@
+function getImportPath(filename) {
+            return `./${filename}`;
+        }
+            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{D,W as _,o as C,a as d}from"./message-components-CzGdQ9TQ.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as G}from"./workflowChat-CTj3qusy.js";import"./input.js";/* empty css     */import"./App-fluNqnYs.js";function Y({content:v,name:J="Assistant",avatar:P,latestInput:N,installedNodes:A,onAddMessage:y}){const[f,g]=h.useState({}),[E,W]=h.useState(null),[b,M]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(v);W(e),M(e.ext?.find(a=>a.type==="workflow")?.data||[])},[v]);const I=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(s=>({...s,[a]:!0})),_.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:E?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(G,{}));try{const s=await _.getOptimizedWorkflow(e.id,N);if(s.workflow){const i=new Set;if(s.workflow.nodes)for(const o of s.workflow.nodes)i.add(o.type);else for(const o of Object.values(s.workflow))i.add(o.class_type);const l=Array.from(i).filter(o=>!A.includes(o));if(console.log("[WorkflowOption] Missing node types:",l),l.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const o=await _.batchGetNodeInfo(l);console.log("[WorkflowOption] Received node infos:",o);const p={text:"",ext:[{type:"node_install_guide",data:o.map(r=>({name:r.name,repository_url:r.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:s.workflow,optimizedParams:s.optimized_params}};y?.(c)}catch(o){console.error("[WorkflowOption] Error fetching node info:",o),j(s.workflow,s.optimized_params)}finally{g(o=>({...o,[a]:!1}))}return}j(s.workflow,s.optimized_params)}}catch(s){console.error("Failed to optimize workflow:",s),alert("Failed to optimize workflow. Please try again.")}finally{g(s=>({...s,[a]:!1}))}}},j=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),l=Object.keys(d.graph._nodes_by_id)[0],o=d.graph._nodes_by_id[l],p=o?o.pos[0]:0,c=o?o.pos[1]:0,r=250,m=60,S=20,F=60,k=50,H=1e3;let z=p,w=c,x=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){x>H&&(z+=r+F,x=0,w=c);const V=n.inputs?n.inputs.length:0,L=n.outputs?n.outputs.length:0,q=n.widgets?n.widgets.length:0,B=Math.max(V,L)+q,u=S*B+m;n.size[0]=r,n.size[1]=u,n.pos[0]=z,n.pos[1]=w,x+=u+k,w+=u+k}}}for(const[i,l,o,p,c]of a){const r=d.graph._nodes_by_id[i].widgets;for(const m of r)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const s={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(s)},O=(e,a)=>{const s=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fill:"#1296db"}),t.jsx("path",{d:"M682.656 298.656m0 0l85.344 0q0 0 0 0l0 426.656q0 0 0 0l-85.344 0q0 0 0 0l0-426.656q0 0 0 0Z","p-id":"25240",fill:"#1296db"})]})}),t.jsxs("div",{className:"flex flex-row",children:[t.jsx("h3",{className:"flex-1 font-medium text-sm line-clamp-2 break-all h-10 overflow-hidden",children:e.name}),t.jsx("div",{className:"flex items-start",children:e.description&&t.jsx(D,{arrow:!1,placement:"top",title:t.jsx("div",{className:"bg-gray-900 text-white text-xs rounded-md py-2 px-3 min-w-[400px] whitespace-normal break-words",children:e.description}),children:t.jsx("div",{className:"w-5 h-5 flex items-center justify-center text-gray-500 cursor-help",children:t.jsx("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor",className:"w-4 h-4",children:t.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.
```

**File**: `dist/copilot_web/message-components-CzGdQ9TQ.js` (renamed, +1/-1)
```diff
@@ -330,7 +330,7 @@ html body {
               > ${e}-wrapper:only-child,
               > ${e}-expanded-row-fixed > ${e}-wrapper:only-child
             `]:{[e]:{marginBlock:se(b(n).mul(-1).equal()),marginInline:`${se(b(o).sub(i).equal())}
-                ${se(b(i).mul(-1).equal())}`,[`${e}-tbody > tr:last-child > td`]:{borderBottomWidth:0,"&:first-child, &:last-child":{borderRadius:0}}}}},"> th":{position:"relative",color:h,fontWeight:r,textAlign:"start",background:g,borderBottom:$,transition:`background ${v} ease`}}},[`${e}-footer`]:{padding:`${se(n)} ${se(i)}`,color:p,background:y}})}},mZ=t=>{const{colorFillAlter:e,colorBgContainer:r,colorTextHeading:n,colorFillSecondary:i,colorFillContent:o,controlItemBgActive:a,controlItemBgActiveHover:s,padding:l,paddingSM:c,paddingXS:u,colorBorderSecondary:f,borderRadiusLG:h,controlHeight:v,colorTextPlaceholder:g,fontSize:m,fontSizeSM:p,lineHeight:y,lineWidth:b,colorIcon:$,colorIconHover:S,opacityLoading:w,controlInteractiveSize:C}=t,E=new Ut(i).onBackground(r).toHexString(),O=new Ut(o).onBackground(r).toHexString(),x=new Ut(e).onBackground(r).toHexString(),I=new Ut($),T=new Ut(S),N=C/2-b,P=N*2+b*3;return{headerBg:x,headerColor:n,headerSortActiveBg:E,headerSortHoverBg:O,bodySortBg:x,rowHoverBg:x,rowSelectedBg:a,rowSelectedHoverBg:s,rowExpandedBg:e,cellPaddingBlock:l,cellPaddingInline:l,cellPaddingBlockMD:c,cellPaddingInlineMD:u,cellPaddingBlockSM:u,cellPaddingInlineSM:u,borderColor:f,headerBorderRadius:h,footerBg:x,footerColor:n,cellFontSize:m,cellFontSizeMD:m,cellFontSizeSM:m,headerSplitColor:f,fixedHeaderSortActiveBg:E,headerFilterHoverBg:o,filterDropdownMenuBg:r,filterDropdownBg:r,expandIconBg:r,selectionColumnWidth:v,stickyScrollBarBg:g,stickyScrollBarBorderRadius:100,expandIconMarginTop:(m*y-b*3)/2-Math.ceil((p*1.4-b*3)/2),headerIconColor:I.clone().setA(I.a*w).toRgbString(),headerIconHoverColor:T.clone().setA(T.a*w).toRgbString(),expandIconHalfInner:N,expandIconSize:P,expandIconScale:C/P}},dO=2,yZ=Gr("Table",t=>{const{colorTextHeading:e,colorSplit:r,colorBgContainer:n,controlInteractiveSize:i,headerBg:o,headerColor:a,headerSortActiveBg:s,headerSortHoverBg:l,bodySortBg:c,rowHoverBg:u,rowSelectedBg:f,rowSelectedHoverBg:h,rowExpandedBg:v,cellPaddingBlock:g,cellPaddingInline:m,cellPaddingBlockMD:p,cellPaddingInlineMD:y,cellPaddingBlockSM:b,cellPaddingInlineSM:$,borderColor:S,footerBg:w,footerColor:C,headerBorderRadius:E,cellFontSize:O,cellFontSizeMD:x,cellFontSizeSM:I,headerSplitColor:T,fixedHeaderSortActiveBg:N,headerFilterHoverBg:P,filterDropdownBg:_,expandIconBg:R,selectionColumnWidth:M,stickyScrollBarBg:D,calc:j}=t,k=Xt(t,{tableFontSize:O,tableBg:n,tableRadius:E,tablePaddingVertical:g,tablePaddingHorizontal:m,tablePaddingVerticalMiddle:p,tablePaddingHorizontalMiddle:y,tablePaddingVerticalSmall:b,tablePaddingHorizontalSmall:$,tableBorderColor:S,tableHeaderTextColor:a,tableHeaderBg:o,tableFooterTextColor:C,tableFooterBg:w,tableHeaderCellSplitColor:T,tableHeaderSortBg:s,tableHeaderSortHoverBg:l,tableBodySortBg:c,tableFixedHeaderSortActiveBg:N,tableHeaderFilterActiveBg:P,tableFilterDropdownBg:_,tableRowHoverBg:u,tableSelectedRowBg:f,tableSelectedRowHoverBg:h,zIndexTableFixed:dO,zIndexTableSticky:j(dO).add(1).equal({unit:!1}),tableFontSizeMiddle:x,tableFontSizeSmall:I,tableSelectionColumnWidth:M,tableExpandIconBg:R,tableExpandColumnWidth:j(i).add(j(t.padding).mul(2)).equal(),tableExpandedRowBg:v,tableFilterDropdownWidth:120,tableFilterDropdownHeight:264,tableFilterDropdownSearchWidth:140,tableScrollThumbSize:8,tableScrollThumbBg:D,tableScrollThumbBgHover:e,tableScrollBg:r});return[gZ(k),lZ(k),uO(k),hZ(k),aZ(k),rZ(k),cZ(k),oZ(k),uO(k),iZ(k),dZ(k),sZ(k),vZ(k),nZ(k),fZ(k),uZ(k),pZ(k)]},mZ,{unitless:{expandIconScale:!0}}),bZ=[],$Z=(t,e)=>{var r,n;const{prefixCls:i,className:o,rootClassName:a,style:s,size:l,bordered:c,dropdownPrefixCls:u,dataSource:f,pagination:h,rowSelection:v,rowKey:g="key",rowClassName:m,columns:p,children:y,childrenColumnName:b,onChange:$,getPopupContainer:S,loading:w,expandIcon:C,expandable:E,expandedRowRender:O,expandIconColumnIndex:x,indentSize:I,scroll:T,sortDirections:N,locale:P,showSorterTooltip:_={target:"full-header"},virtual:R}=t;Ms();const M=d.useMemo(()=>p||Rw(y),[p,y]),D=d.useMemo(()=>M.some(Ue=>Ue.responsive),[M]),j=hw(D),k=d.useMemo(()=>{const Ue=new Set(Object.keys(j).filter(He=>j[He]));return M.filter(He=>!He.responsive||He.responsive.some(rt=>Ue.has(rt)))},[M,j]),V=yn(t,["className","style","columns"]),{locale:G=_a,direction:W,table:Y,renderEmpty:q,getPrefixCls:J,getPopupContainer:oe}=d.useContext(Dt),ie=no(l),te=Object.assign(Object.assign({},G.Table),P),z=f||bZ,K=J("table",i),B=J("dropdown",u),[,F]=_n(),U=yi(K),[Z,ee,Q]=yZ(K,U),ce=Object.assign(Object.assign({childrenColumnName:b,expandIconColumnIndex:x},E),{expandIcon:(r=E?.expandIcon)!==null&&r!==void 0?r:(n=Y?.expandable)===null||n===void 0?void 0:n.expandIcon}),{childrenColumnName:me="children"}=ce,Te=d.useMemo(()=>z.some(Ue=>Ue?.[me])?"nest":O||E?.expandedRowRender?"row":null
```

**File**: `dist/copilot_web/workflowChat-CTj3qusy.js` (renamed, +3/-3)
```diff
@@ -1,7 +1,7 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/message-components-CGVXqDj7.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/WorkflowOption-B2WoNUHM.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css","copilot_web/App-CmJI_Xeo.js","copilot_web/DebugGuide-BOPlhVKf.js","copilot_web/DebugResult-DjJ6M9d8.js"].map(path => {
+            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/message-components-CzGdQ9TQ.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/WorkflowOption-CdGtQvHG.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css","copilot_web/App-fluNqnYs.js","copilot_web/DebugGuide-BpkLL6XH.js","copilot_web/DebugResult-CWUJVPnw.js"].map(path => {
                         const apiBase = window.comfyAPI?.api?.api?.api_base;
                         if (apiBase) {
                             // 有 API base 时，使用完整路径
@@ -11,7 +11,7 @@ function getImportPath(filename) {
                             return `./${path}`;
                         }
                     }))))=>i.map(i=>d[i]);
-import{j as s,r as _g,b as wg}from"./vendor-markdown-B4Av9P7l.js";import{r as _,c as Ss,e as Xl,R as Qi}from"./vendor-react-ByKzdfMq.js";import{b as vg,c as kg,X as Ln,a as Ge,g as Yl,f as Sg,d as Ql,v as Ml,W as ht,S as Ig,H as Cg,M as jg,T as Zl,E as Lg,I as Is,e as Ng,F as ec,h as ss,i as Tl,B as Pl,j as Ag,P as Eg,u as gn,k as Mg,l as Tg,m as Pg,n as Dg,o as at,p as tc,q as Og,r as Fg,s as Rg,t as zg,x as Ug,y as Bg,z as Wg,A as Gg}from"./message-components-CGVXqDj7.js";import{_ as sn}from"./input.js";import{C as rs}from"./App-CmJI_Xeo.js";const Dl=o=>{const{isPassword:u=!1,value:r="",setValue:d=()=>{},setIsValueValid:c,placeholder:h="",className:m=""}=o,[g,b]=_.useState(!u),S=v=>{d(v.target.value),c?.(v.target.value)};return s.jsxs("div",{className:`relative ${m}`,children:[s.jsx("input",{type:g?"text":"password",value:r,onChange:S,placeholder:h,className:`w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg
+import{j as s,r as _g,b as wg}from"./vendor-markdown-B4Av9P7l.js";import{r as _,c as Ss,e as Xl,R as Qi}from"./vendor-react-ByKzdfMq.js";import{b as vg,c as kg,X as Ln,a as Ge,g as Yl,f as Sg,d as Ql,v as Ml,W as ht,S as Ig,H as Cg,M as jg,T as Zl,E as Lg,I as Is,e as Ng,F as ec,h as ss,i as Tl,B as Pl,j as Ag,P as Eg,u as gn,k as Mg,l as Tg,m as Pg,n as Dg,o as at,p as tc,q as Og,r as Fg,s as Rg,t as zg,x as Ug,y as Bg,z as Wg,A as Gg}from"./message-components-CzGdQ9TQ.js";import{_ as sn}from"./input.js";import{C as rs}from"./App-fluNqnYs.js";const Dl=o=>{const{isPassword:u=!1,value:r="",setValue:d=()=>{},setIsValueValid:c,placeholder:h="",className:m=""}=o,[g,b]=_.useState(!u),S=v=>{d(v.target.value),c?.(v.target.value)};return s.jsxs("div",{className:`relative ${m}`,children:[s.jsx("input",{type:g?"text":"password",value:r,onChange:S,placeholder:h,className:`w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg
           bg-gray-50 dark:bg-gray-700 
           text-gray-900 dark:text-white
           placeholder-gray-500 dark:placeholder-gray-400
@@ -111,7 +111,7 @@ ${b.join(`
                          transition-all duration-200 active:scale-95`,children:u?s.jsx(Pg,{className:"h-5 w-5 text-red-500 hover:text-red-600"}):s.jsx(Dg,{className:"h-5 w-5 group-hover:translate-x-1"})})]})});oc.displayName="ChatInput";function pp(o){const u=o[0],r=new Set;function d(c,h){if(!(!c||h>=1)&&c.inputs)for(const m of Object.values(c.inputs)){const g=m.link;if(g&&Ge.graph.links[g]){const b=Ge.graph.links[g].origin_id,S=Ge.graph._nodes_by_id[b];S&&(r.add(S.type),d(S,h+1))}}}return u?(d(u,0),[{type:"upstream_node_types",data:Array.from(r)}]):null}function xp({nodeInfo:o,onSendWithIntent:u,loading:r,onSendWithContent:d}){return console.log("SelectedNodeInfo nodeInfo:",o[0]),s.jsx("div",{className:"mb-3 p-3 rounded-md bg-gray-50 border border-gray-200",children:s.jsxs("div",{className:"text-sm text-gray-700",children:[s.jsxs("p",{children:["Selected node: ",o[0].type]}),s.jsxs("div",{className:"flex gap-2 mt-2",children:[s.jsx("button",{className:`px-3 py-1 text-xs rounded-md bg-blue-50 
                                  text-blue-700 hover:bg-blue-100`,onClick:()=>d(`Reply in ${navigator.language} language: How does the ${o[0].type} node work? I need its official usage guide.`),disabled:r,children:"Usage"}),s.jsx("button",{className:`px-3 py-1 text-xs rounded-md bg-green-100 
                                  text-green-700 hover:bg-green-200`,onClick:()=>d(`Reply in ${navigator.language} language: Show me the technical specifications for the ${o[0].type} node's inputs and outputs.`),disabled:r,children:"Parameters"}),s.jsx("button",{className:`px-3 py-1 text-xs rounded
```

**File**: `ui/src/components/chat/messages/WorkflowOption.tsx` (modified, +3/-1)
```diff
@@ -128,7 +128,9 @@ export function WorkflowOption({ content, name = 'Assistant', avatar, latestInpu
                         onAddMessage?.(aiMessage);
                     } catch (error) {
                         console.error('[WorkflowOption] Error fetching node info:', error);
-                        alert('Error checking required nodes. Please try again.');
+                        // alert('Error checking required nodes. Please try again.');
+                        // 没法引导下载节点，直接加载工作流吧
+                        loadWorkflow(optimizedResult.workflow, optimizedResult.optimized_params);
                     } finally {
                         // 无论成功或失败，重置加载状态
                         setLoadingWorkflows(prev => ({
```

---

### Incident Patch 13: `04c2824d` (2025-10-16)
**Commit Message**: feat: fix

**File**: `dist/copilot_web/App-CmJI_Xeo.js` (renamed, +2/-2)
```diff
@@ -1,7 +1,7 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-CuqyD5c1.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components-CzGdQ9TQ.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
+            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-2zkTTHg9.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components-CGVXqDj7.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
                         const apiBase = window.comfyAPI?.api?.api?.api_base;
                         if (apiBase) {
                             // 有 API base 时，使用完整路径
@@ -11,4 +11,4 @@ function getImportPath(filename) {
                             return `./${path}`;
                         }
                     }))))=>i.map(i=>d[i]);
-import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components-CzGdQ9TQ.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-CuqyD5c1.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
+import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components-CGVXqDj7.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-2zkTTHg9.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
```

**File**: `dist/copilot_web/DebugGuide-BOPlhVKf.js` (renamed, +1/-1)
```diff
@@ -1,5 +1,5 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as s}from"./vendor-markdown-B4Av9P7l.js";import{r as i}from"./vendor-react-ByKzdfMq.js";import{u as A,p as E,R as D,o as m,W as f,a as b}from"./message-components-CzGdQ9TQ.js";function P({content:h,name:k="Assistant",avatar:O,onAddMessage:y,onUpdateMessage:c,messageId:_}){const{dispatch:u,abortControllerRef:l}=A(),[d,w]=i.useState(!1),[T,G]=i.useState(""),[J,S]=i.useState(!1),[j,v]=i.useState(null),r=i.useMemo(()=>{try{return JSON.parse(h)}catch(e){return console.error("Failed to parse message content:",e),null}},[h]),x=i.useMemo(()=>{if(!r||!r.ext)return null;const e=r.ext.find(t=>t.type==="debug_start_checkpoint"||t.type==="debug_checkpoint"&&t.data?.checkpoint_type==="debug_start");return e&&e.data&&e.data.checkpoint_id?e.data.checkpoint_id:null},[r])||j,N=async()=>{if(d)return;const e=m(),t={id:e,role:"ai",content:JSON.stringify({text:`🔍 Starting workflow analysis...
+            import{j as s}from"./vendor-markdown-B4Av9P7l.js";import{r as i}from"./vendor-react-ByKzdfMq.js";import{u as A,p as E,R as D,o as m,W as f,a as b}from"./message-components-CGVXqDj7.js";function P({content:h,name:k="Assistant",avatar:O,onAddMessage:y,onUpdateMessage:c,messageId:_}){const{dispatch:u,abortControllerRef:l}=A(),[d,w]=i.useState(!1),[T,G]=i.useState(""),[J,S]=i.useState(!1),[j,v]=i.useState(null),r=i.useMemo(()=>{try{return JSON.parse(h)}catch(e){return console.error("Failed to parse message content:",e),null}},[h]),x=i.useMemo(()=>{if(!r||!r.ext)return null;const e=r.ext.find(t=>t.type==="debug_start_checkpoint"||t.type==="debug_checkpoint"&&t.data?.checkpoint_type==="debug_start");return e&&e.data&&e.data.checkpoint_id?e.data.checkpoint_id:null},[r])||j,N=async()=>{if(d)return;const e=m(),t={id:e,role:"ai",content:JSON.stringify({text:`🔍 Starting workflow analysis...
 `,ext:[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};y?.(t);try{f.trackEvent({event_type:"debug_trigger",message_type:"debug",message_id:e,data:{}}),await C(),u({type:"SET_LOADING",payload:!0}),await I(e)}finally{w(!1)}},C=async()=>{try{const e=await b.graphToPrompt(),t=localStorage.getItem("sessionId")||"";if(t&&e){const n=await f.saveWorkflowCheckpoint(t,e.output,e.workflow,"debug_start");if(v(n.version_id),console.log(`Saved debug start checkpoint: ${n.version_id}`),c&&r){const o=[...r.ext||[]].filter(g=>g.type!=="debug_start_checkpoint"&&!(g.type==="debug_checkpoint"&&g.data?.checkpoint_type==="debug_start"));o.push({type:"debug_start_checkpoint",data:{checkpoint_id:n.version_id,checkpoint_type:"debug_start"}});const p={id:_||m(),role:"ai",content:JSON.stringify({text:r.text,ext:o}),format:"debug_guide",name:"Assistant"};c(p)}}}catch(e){console.error("Failed to save checkpoint before debug:",e)}},I=async e=>{try{const t=await b.graphToPrompt();let n="",a=null;l&&(l.current=new AbortController);for await(const o of f.streamDebugAgent(t,l?.current?.signal||void 0))if(o.text){n=o.text,o.ext&&(a=o.ext);const p={id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};c?.(p)}c?.({id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!0,debugGuide:!0}),u({type:"SET_LOADING",payload:!1}),l.current=null}catch(t){console.error("Error calling debug agent:",t),S(!1);const a={id:e,role:"ai",content:JSON.stringify({text:`I encountered an error while analyzing your workflow: ${t.message||"Unknown error"}`,ext:[]}),format:"markdown",name:"Assistant",finished:!0};c?.(a),u({type:"SET_LOADING",payload:!1}),l.current=null}};return r?s.jsx(E,{name:k,children:s.jsxs("div",{className:"bg-gray-100 pt-4 px-4 pb-3 rounded-lg",children:[s.jsx("div",{className:"flex justify-between items-start",children:s.jsx("p",{className:"text-gray-700 text-sm flex-1",children:r.text})}),s.jsx("div",{className:"flex justify-end mt-4",children:s.jsx("button",{onClick:N,disabled:d,className:`debug-btn bg-debug-btn text-sm text-[#fff] rounded-lg px-4 py-2 ${d?"cursor-not-allowed":"cursor-pointer"}`,children:d?"Analyzing...":"Debug Errors"})}),s.jsx("div",{className:"flex justify-end mt-2",children:!!x&&s.jsx("div",{className:"ml-2 flex-shrink-0",children:s.jsx(D,{checkpointId:x,onRestore:()=>{console.log("Workflow restored from checkpoint")}})})})]})}):null}export{P as DebugGuide};
```

**File**: `dist/copilot_web/DebugResult-DjJ6M9d8.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,G as k,R as j}from"./message-components-CzGdQ9TQ.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-CuqyD5c1.js";import"./input.js";/* empty css     */import"./App-DWqrANS9.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);return e.jsx(v,{className:"rounded-lg ",borderClassName:"rounded-lg",children:e.jsxs("div",{className:`flex flex-col ${d} ${i?"":"max-h-[200px]"}`,children:[e.jsxs("div",{className:"flex justify-between items-center pb-2 border-b border-gray-100",children:[e.jsx("div",{children:typeof a=="string"?e.jsx("h3",{className:"text-sm text-[#fff] font-medium",children:a}):a}),e.jsx("button",{onClick:()=>{r(!i)},children:i?e.jsx(u,{className:"text-gray-700"}):e.jsx(w,{className:"text-gray-700"})})]}),e.jsx("div",{className:"overflow-hidden flex-1",children:c})]})})};function E({content:n,name:a="Assistant",avatar:f,format:d="markdown"}){const c=p.useRef(null),i=()=>{let r=null,l=!1,o,x=[];try{if(o=JSON.parse(n),o.ext){let t=o.ext.find(s=>s.type==="workflow_rewrite_checkpoint"||s.type==="debug_checkpoint"&&s.data?.checkpoint_type==="workflow_rewrite_start");t&&t.data&&t.data.checkpoint_id?(r=t.data.checkpoint_id,l=!0):(t=o.ext.find(s=>s.type==="workflow_rewrite_complete"),t&&t.data&&t.data.version_id?(r=t.data.version_id,l=!0):(t=o.ext.find(s=>s.type==="debug_checkpoint"),t&&t.data&&t.data.checkpoint_id&&(r=t.data.checkpoint_id,l=!1))),o.ext.find(s=>s.type==="workflow_update")&&(l=!0),x=o.ext.find(s=>s.type==="param_update")?.data?.model_suggest||[]}}catch(t){return console.error("Failed to parse DebugResult content:",t),null}const h=l?e.jsxs("div",{className:"flex items-center text-green-500",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",fill:"currentColor",viewBox:"0 0 20 20",children:e.jsx("path",{fillRule:"evenodd",d:"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",clipRule:"evenodd"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Successfully"})]}):e.jsxs("div",{className:"flex items-center text-gray-900",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"28108",fill:"currentColor",children:e.jsx("path",{d:"M401.048025 844.855924c0 20.341281 16.643052 36.984333 36.984333 36.984333l147.936307 0c20.341281 0 36.984333-16.643052 36.984333-36.984333L622.952998 807.872614 401.048025 807.872614 401.048025 844.855924zM512 142.159744c-142.943596 0-258.888282 115.944686-258.888282 258.888282 0 88.021729 44.011376 165.503405 110.951975 212.288964l0 83.58365c0 20.341281 16.643052 36.984333 36.984333 36.984333l221.903949 0c20.341281 0 36.984333-16.643052 36.984333-36.984333l0-83.58365c66.941622-46.784536 110.951975-124.266212 110.951975-212.288964C770.888282 258.104429 654.943596 142.159744 512 142.159744zM617.588827 552.682561l-31.621185 22.005176 0 85.248569L438.031335 659.936307l0-85.063351L406.41015 552.866756c-49.743938-34.764781-79.33079-91.350544-79.33079-151.634536 0-101.890598 83.029018-184.92064 184.92064-184.92064s184.92064 83.029018 184.92064 184.92064C696.919617 461.332017 667.332764 517.91778 617.588827 552.682561z","p-id":"28277"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Finished"})]}),m=l?e.jsx("div",{className:"mt-3 text-xs text-gray-700",children:"💡 If you're not satisfied with the changes, click the restore button to revert to the previous version."}):null;return e.jsxs("div",{ref:c,className:"sticky top-0 left-0 w-full bg-gray-100 p-4 rounded-lg overflow-hidden",children:[e.jsx(y,{title:h,isWorkflowUpdate:l,className:"p-4",children:e.jsxs("div",{className:"prose prose-sm max-w-none",children:[d==="markdown"?e.jsx(k,{response:o||{}}):e.jsx("pre",{className:"whitespace-pre-wrap text-gray-700 text-sm leading-relaxed h-full",children:o?.text||""}),m]})}),x?.length>0&&e.jsx(N,{modelList:x,showPagination:!1}),e.jsx("div",{className:"flex justify-end mt-2",children:!!r&&e.jsx("div",{className:"ml-2 flex-shrink-0",children:e.jsx(j,{checkpointId:r,onRestore:()=>{console.log(`Workflow restored from ${l?"workflow update":"debug"} checkpoint`)},title:l?`Restore to this version (Version ${r})`:`Restore checkpoint ${r}`})})})]})};return e.jsx(g,{name:a,children:i()})}export{E as DebugResult};
+            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,G as k,R as j}from"./message-components-CGVXqDj7.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-2zkTTHg9.js";import"./input.js";/* empty css     */import"./App-CmJI_Xeo.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);retu
```

**File**: `dist/copilot_web/WorkflowOption-B2WoNUHM.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{D as B,W as v,o as C,a as d}from"./message-components-CzGdQ9TQ.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as D}from"./workflowChat-CuqyD5c1.js";import"./input.js";/* empty css     */import"./App-DWqrANS9.js";function Y({content:_,name:G="Assistant",avatar:J,latestInput:z,installedNodes:N,onAddMessage:y}){const[f,g]=h.useState({}),[A,E]=h.useState(null),[b,W]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(_);E(e),W(e.ext?.find(a=>a.type==="workflow")?.data||[])},[_]);const M=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(o=>({...o,[a]:!0})),v.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:A?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(D,{}));try{const o=await v.getOptimizedWorkflow(e.id,z);if(o.workflow){const i=new Set;if(o.workflow.nodes)for(const s of o.workflow.nodes)i.add(s.type);else for(const s of Object.values(o.workflow))i.add(s.class_type);const r=Array.from(i).filter(s=>!N.includes(s));if(console.log("[WorkflowOption] Missing node types:",r),r.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const s=await v.batchGetNodeInfo(r);console.log("[WorkflowOption] Received node infos:",s);const p={text:"",ext:[{type:"node_install_guide",data:s.map(l=>({name:l.name,repository_url:l.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:o.workflow,optimizedParams:o.optimized_params}};y?.(c)}catch(s){console.error("[WorkflowOption] Error fetching node info:",s),alert("Error checking required nodes. Please try again.")}finally{g(s=>({...s,[a]:!1}))}return}I(o.workflow,o.optimized_params)}}catch(o){console.error("Failed to optimize workflow:",o),alert("Failed to optimize workflow. Please try again.")}finally{g(o=>({...o,[a]:!1}))}}},I=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),r=Object.keys(d.graph._nodes_by_id)[0],s=d.graph._nodes_by_id[r],p=s?s.pos[0]:0,c=s?s.pos[1]:0,l=250,m=60,S=20,F=60,j=50,H=1e3;let k=p,x=c,w=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){w>H&&(k+=l+F,w=0,x=c);const V=n.inputs?n.inputs.length:0,q=n.outputs?n.outputs.length:0,L=n.widgets?n.widgets.length:0,P=Math.max(V,q)+L,u=S*P+m;n.size[0]=l,n.size[1]=u,n.pos[0]=k,n.pos[1]=x,w+=u+j,x+=u+j}}}for(const[i,r,s,p,c]of a){const l=d.graph._nodes_by_id[i].widgets;for(const m of l)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const o={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(o)},O=(e,a)=>{const o=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fill:"#1296db"}),t.jsx("path",{d:"M682.656 298.656m0 0l85.344 0q0 0 0 0l0 426.656q0 0 0 0l-85.344 0q0 0 0 0l0-426.656q0 0 0 0Z","p-id":"25240",fill:"#1296db"})]})}),t.jsxs("div",{className:"flex flex-row",children:[t.jsx("h3",{className:"flex-1 font-medium text-sm line-clamp-2 break-all h-10 overflow-hidden",children:e.name}),t.jsx("div",{className:"flex items-start",children:e.description&&t.jsx(B,{arrow:!1,placement:"top",title:t.jsx("div",{className:"bg-gray-900 text-white text-xs rounded-md py-2 px-3 min-w-[400px] whitespace-normal break-words",children:e.description}),children:t.jsx("div",{className:"w-5 h-5 flex items-center justify-center text-gray-500 cursor-help",children:t.jsx("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor",className:"w-4 h-4",children:t.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.
```

**File**: `dist/copilot_web/message-components-CGVXqDj7.js` (renamed, +1/-1)
```diff
@@ -330,7 +330,7 @@ html body {
               > ${e}-wrapper:only-child,
               > ${e}-expanded-row-fixed > ${e}-wrapper:only-child
             `]:{[e]:{marginBlock:se(b(n).mul(-1).equal()),marginInline:`${se(b(o).sub(i).equal())}
-                ${se(b(i).mul(-1).equal())}`,[`${e}-tbody > tr:last-child > td`]:{borderBottomWidth:0,"&:first-child, &:last-child":{borderRadius:0}}}}},"> th":{position:"relative",color:h,fontWeight:r,textAlign:"start",background:g,borderBottom:$,transition:`background ${v} ease`}}},[`${e}-footer`]:{padding:`${se(n)} ${se(i)}`,color:p,background:y}})}},mZ=t=>{const{colorFillAlter:e,colorBgContainer:r,colorTextHeading:n,colorFillSecondary:i,colorFillContent:o,controlItemBgActive:a,controlItemBgActiveHover:s,padding:l,paddingSM:c,paddingXS:u,colorBorderSecondary:f,borderRadiusLG:h,controlHeight:v,colorTextPlaceholder:g,fontSize:m,fontSizeSM:p,lineHeight:y,lineWidth:b,colorIcon:$,colorIconHover:S,opacityLoading:w,controlInteractiveSize:C}=t,E=new Ut(i).onBackground(r).toHexString(),O=new Ut(o).onBackground(r).toHexString(),x=new Ut(e).onBackground(r).toHexString(),I=new Ut($),T=new Ut(S),N=C/2-b,P=N*2+b*3;return{headerBg:x,headerColor:n,headerSortActiveBg:E,headerSortHoverBg:O,bodySortBg:x,rowHoverBg:x,rowSelectedBg:a,rowSelectedHoverBg:s,rowExpandedBg:e,cellPaddingBlock:l,cellPaddingInline:l,cellPaddingBlockMD:c,cellPaddingInlineMD:u,cellPaddingBlockSM:u,cellPaddingInlineSM:u,borderColor:f,headerBorderRadius:h,footerBg:x,footerColor:n,cellFontSize:m,cellFontSizeMD:m,cellFontSizeSM:m,headerSplitColor:f,fixedHeaderSortActiveBg:E,headerFilterHoverBg:o,filterDropdownMenuBg:r,filterDropdownBg:r,expandIconBg:r,selectionColumnWidth:v,stickyScrollBarBg:g,stickyScrollBarBorderRadius:100,expandIconMarginTop:(m*y-b*3)/2-Math.ceil((p*1.4-b*3)/2),headerIconColor:I.clone().setA(I.a*w).toRgbString(),headerIconHoverColor:T.clone().setA(T.a*w).toRgbString(),expandIconHalfInner:N,expandIconSize:P,expandIconScale:C/P}},dO=2,yZ=Gr("Table",t=>{const{colorTextHeading:e,colorSplit:r,colorBgContainer:n,controlInteractiveSize:i,headerBg:o,headerColor:a,headerSortActiveBg:s,headerSortHoverBg:l,bodySortBg:c,rowHoverBg:u,rowSelectedBg:f,rowSelectedHoverBg:h,rowExpandedBg:v,cellPaddingBlock:g,cellPaddingInline:m,cellPaddingBlockMD:p,cellPaddingInlineMD:y,cellPaddingBlockSM:b,cellPaddingInlineSM:$,borderColor:S,footerBg:w,footerColor:C,headerBorderRadius:E,cellFontSize:O,cellFontSizeMD:x,cellFontSizeSM:I,headerSplitColor:T,fixedHeaderSortActiveBg:N,headerFilterHoverBg:P,filterDropdownBg:_,expandIconBg:R,selectionColumnWidth:M,stickyScrollBarBg:D,calc:j}=t,k=Xt(t,{tableFontSize:O,tableBg:n,tableRadius:E,tablePaddingVertical:g,tablePaddingHorizontal:m,tablePaddingVerticalMiddle:p,tablePaddingHorizontalMiddle:y,tablePaddingVerticalSmall:b,tablePaddingHorizontalSmall:$,tableBorderColor:S,tableHeaderTextColor:a,tableHeaderBg:o,tableFooterTextColor:C,tableFooterBg:w,tableHeaderCellSplitColor:T,tableHeaderSortBg:s,tableHeaderSortHoverBg:l,tableBodySortBg:c,tableFixedHeaderSortActiveBg:N,tableHeaderFilterActiveBg:P,tableFilterDropdownBg:_,tableRowHoverBg:u,tableSelectedRowBg:f,tableSelectedRowHoverBg:h,zIndexTableFixed:dO,zIndexTableSticky:j(dO).add(1).equal({unit:!1}),tableFontSizeMiddle:x,tableFontSizeSmall:I,tableSelectionColumnWidth:M,tableExpandIconBg:R,tableExpandColumnWidth:j(i).add(j(t.padding).mul(2)).equal(),tableExpandedRowBg:v,tableFilterDropdownWidth:120,tableFilterDropdownHeight:264,tableFilterDropdownSearchWidth:140,tableScrollThumbSize:8,tableScrollThumbBg:D,tableScrollThumbBgHover:e,tableScrollBg:r});return[gZ(k),lZ(k),uO(k),hZ(k),aZ(k),rZ(k),cZ(k),oZ(k),uO(k),iZ(k),dZ(k),sZ(k),vZ(k),nZ(k),fZ(k),uZ(k),pZ(k)]},mZ,{unitless:{expandIconScale:!0}}),bZ=[],$Z=(t,e)=>{var r,n;const{prefixCls:i,className:o,rootClassName:a,style:s,size:l,bordered:c,dropdownPrefixCls:u,dataSource:f,pagination:h,rowSelection:v,rowKey:g="key",rowClassName:m,columns:p,children:y,childrenColumnName:b,onChange:$,getPopupContainer:S,loading:w,expandIcon:C,expandable:E,expandedRowRender:O,expandIconColumnIndex:x,indentSize:I,scroll:T,sortDirections:N,locale:P,showSorterTooltip:_={target:"full-header"},virtual:R}=t;Ms();const M=d.useMemo(()=>p||Rw(y),[p,y]),D=d.useMemo(()=>M.some(Ue=>Ue.responsive),[M]),j=hw(D),k=d.useMemo(()=>{const Ue=new Set(Object.keys(j).filter(He=>j[He]));return M.filter(He=>!He.responsive||He.responsive.some(rt=>Ue.has(rt)))},[M,j]),V=yn(t,["className","style","columns"]),{locale:G=_a,direction:W,table:Y,renderEmpty:q,getPrefixCls:J,getPopupContainer:oe}=d.useContext(Dt),ie=no(l),te=Object.assign(Object.assign({},G.Table),P),z=f||bZ,K=J("table",i),B=J("dropdown",u),[,F]=_n(),U=yi(K),[Z,ee,Q]=yZ(K,U),ce=Object.assign(Object.assign({childrenColumnName:b,expandIconColumnIndex:x},E),{expandIcon:(r=E?.expandIcon)!==null&&r!==void 0?r:(n=Y?.expandable)===null||n===void 0?void 0:n.expandIcon}),{childrenColumnName:me="children"}=ce,Te=d.useMemo(()=>z.some(Ue=>Ue?.[me])?"nest":O||E?.expandedRowRender?"row":null
```

**File**: `ui/src/components/chat/ApiKeyModal.tsx` (modified, +12/-8)
```diff
@@ -409,8 +409,7 @@ export function ApiKeyModal({ isOpen, onClose, onSave, initialApiKey = '', onCon
                     className='mb-4'
                 >
                     <div>
-                        {/* API Key */}
-                        <div className="mb-4">
+                        <div className='mb-4'>
                             {
                                 TAB_LIST?.map((tab) => <TabButton 
                                     active={activeTab === tab}
@@ -419,9 +418,14 @@ export function ApiKeyModal({ isOpen, onClose, onSave, initialApiKey = '', onCon
                                     {tab}
                                 </TabButton>)
                             }
-                            
-                            {
-                                activeTab !== 'LMStudio' && <div className="relative">
+                        </div>
+                        {/* API Key */}
+                        {
+                            activeTab !== 'LMStudio' && <div className="mb-4">
+                                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mt-2 mb-2">
+                                    API Key
+                                </label>
+                                <div className="relative">
                                     <input
                                         type={showOpenaiApiKey ? "text" : "password"}
                                         value={openaiApiKey}
@@ -462,8 +466,8 @@ export function ApiKeyModal({ isOpen, onClose, onSave, initialApiKey = '', onCon
                                         )}
                                     </button>
                                 </div>
-                            }
-                        </div>
+                            </div>
+                        }
                         
                         {/* Base URL */}
                         <div className="mb-4">
@@ -483,7 +487,7 @@ export function ApiKeyModal({ isOpen, onClose, onSave, initialApiKey = '', onCon
                                     }))
                                     setOpenaiBaseUrl(e.target.value)
                                 }}
-                                placeholder="https://api.openai.com/v1 or http://localhost:1234/v1 for LMStudio"
+                                placeholder={`${activeTab==='OpenAI' ? "https://api.openai.com/v1" : "http://localhost:1234/v1"}`}
                                 className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-lg text-xs
                                 bg-gray-50 dark:bg-gray-700
                                 text-gray-900 dark:text-white
```

---

### Incident Patch 14: `ce9a938f` (2025-10-16)
**Commit Message**: feat: build

**File**: `dist/copilot_web/App-BVBb-haK.js` (renamed, +2/-2)
```diff
@@ -1,7 +1,7 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-CfTHBhpQ.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components-DuuVIzit.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
+            const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["copilot_web/workflowChat-BxLjDx9a.js","copilot_web/vendor-markdown-B4Av9P7l.js","copilot_web/vendor-react-ByKzdfMq.js","copilot_web/message-components-CGVXqDj7.js","copilot_web/input.js","copilot_web/assets/input-UcJyCCDl.css","copilot_web/fonts.css"].map(path => {
                         const apiBase = window.comfyAPI?.api?.api?.api_base;
                         if (apiBase) {
                             // 有 API base 时，使用完整路径
@@ -11,4 +11,4 @@ function getImportPath(filename) {
                             return `./${path}`;
                         }
                     }))))=>i.map(i=>d[i]);
-import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components-DuuVIzit.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-CfTHBhpQ.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
+import{_ as a}from"./input.js";import{j as o}from"./vendor-markdown-B4Av9P7l.js";import{r as t,R as i}from"./vendor-react-ByKzdfMq.js";import{C as n}from"./message-components-CGVXqDj7.js";const s={EXPLAIN_NODE:"copilot:explain-node",TOOLBOX_USAGE:"copilot:toolbox-usage",TOOLBOX_PARAMETERS:"copilot:toolbox-parameters",TOOLBOX_DOWNSTREAMNODES:"copilot:toolbox-downstreamnodes"},d=i.lazy(()=>a(()=>import(getImportPath("workflowChat-BxLjDx9a.js")).then(e=>e.w),__vite__mapDeps([0,1,2,3,4,5,6])).then(e=>({default:e.default})));function c(){const[e,r]=t.useState(!1);return t.useEffect(()=>{const l=()=>{r(!0)};return window.addEventListener(s.EXPLAIN_NODE,l),()=>window.removeEventListener(s.EXPLAIN_NODE,l)},[]),o.jsx(n,{children:o.jsx("div",{className:"h-full w-full flex flex-col",children:o.jsx(t.Suspense,{fallback:o.jsx("div",{className:"h-full w-full flex items-center justify-center",children:"Loading..."}),children:o.jsx(d,{visible:!0,triggerUsage:e,onUsageTriggered:()=>r(!1)})})})})}const O=Object.freeze(Object.defineProperty({__proto__:null,default:c},Symbol.toStringTag,{value:"Module"}));export{O as A,s as C};
```

**File**: `dist/copilot_web/DebugGuide-BOPlhVKf.js` (renamed, +1/-1)
```diff
@@ -1,5 +1,5 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as s}from"./vendor-markdown-B4Av9P7l.js";import{r as i}from"./vendor-react-ByKzdfMq.js";import{u as A,p as E,R as D,o as m,W as f,a as b}from"./message-components-DuuVIzit.js";function P({content:h,name:k="Assistant",avatar:O,onAddMessage:y,onUpdateMessage:c,messageId:_}){const{dispatch:u,abortControllerRef:l}=A(),[d,w]=i.useState(!1),[T,G]=i.useState(""),[J,S]=i.useState(!1),[j,v]=i.useState(null),r=i.useMemo(()=>{try{return JSON.parse(h)}catch(e){return console.error("Failed to parse message content:",e),null}},[h]),x=i.useMemo(()=>{if(!r||!r.ext)return null;const e=r.ext.find(t=>t.type==="debug_start_checkpoint"||t.type==="debug_checkpoint"&&t.data?.checkpoint_type==="debug_start");return e&&e.data&&e.data.checkpoint_id?e.data.checkpoint_id:null},[r])||j,N=async()=>{if(d)return;const e=m(),t={id:e,role:"ai",content:JSON.stringify({text:`🔍 Starting workflow analysis...
+            import{j as s}from"./vendor-markdown-B4Av9P7l.js";import{r as i}from"./vendor-react-ByKzdfMq.js";import{u as A,p as E,R as D,o as m,W as f,a as b}from"./message-components-CGVXqDj7.js";function P({content:h,name:k="Assistant",avatar:O,onAddMessage:y,onUpdateMessage:c,messageId:_}){const{dispatch:u,abortControllerRef:l}=A(),[d,w]=i.useState(!1),[T,G]=i.useState(""),[J,S]=i.useState(!1),[j,v]=i.useState(null),r=i.useMemo(()=>{try{return JSON.parse(h)}catch(e){return console.error("Failed to parse message content:",e),null}},[h]),x=i.useMemo(()=>{if(!r||!r.ext)return null;const e=r.ext.find(t=>t.type==="debug_start_checkpoint"||t.type==="debug_checkpoint"&&t.data?.checkpoint_type==="debug_start");return e&&e.data&&e.data.checkpoint_id?e.data.checkpoint_id:null},[r])||j,N=async()=>{if(d)return;const e=m(),t={id:e,role:"ai",content:JSON.stringify({text:`🔍 Starting workflow analysis...
 `,ext:[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};y?.(t);try{f.trackEvent({event_type:"debug_trigger",message_type:"debug",message_id:e,data:{}}),await C(),u({type:"SET_LOADING",payload:!0}),await I(e)}finally{w(!1)}},C=async()=>{try{const e=await b.graphToPrompt(),t=localStorage.getItem("sessionId")||"";if(t&&e){const n=await f.saveWorkflowCheckpoint(t,e.output,e.workflow,"debug_start");if(v(n.version_id),console.log(`Saved debug start checkpoint: ${n.version_id}`),c&&r){const o=[...r.ext||[]].filter(g=>g.type!=="debug_start_checkpoint"&&!(g.type==="debug_checkpoint"&&g.data?.checkpoint_type==="debug_start"));o.push({type:"debug_start_checkpoint",data:{checkpoint_id:n.version_id,checkpoint_type:"debug_start"}});const p={id:_||m(),role:"ai",content:JSON.stringify({text:r.text,ext:o}),format:"debug_guide",name:"Assistant"};c(p)}}}catch(e){console.error("Failed to save checkpoint before debug:",e)}},I=async e=>{try{const t=await b.graphToPrompt();let n="",a=null;l&&(l.current=new AbortController);for await(const o of f.streamDebugAgent(t,l?.current?.signal||void 0))if(o.text){n=o.text,o.ext&&(a=o.ext);const p={id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!1,debugGuide:!0};c?.(p)}c?.({id:e,role:"ai",content:JSON.stringify({text:n,ext:a||[]}),format:"markdown",name:"Assistant",finished:!0,debugGuide:!0}),u({type:"SET_LOADING",payload:!1}),l.current=null}catch(t){console.error("Error calling debug agent:",t),S(!1);const a={id:e,role:"ai",content:JSON.stringify({text:`I encountered an error while analyzing your workflow: ${t.message||"Unknown error"}`,ext:[]}),format:"markdown",name:"Assistant",finished:!0};c?.(a),u({type:"SET_LOADING",payload:!1}),l.current=null}};return r?s.jsx(E,{name:k,children:s.jsxs("div",{className:"bg-gray-100 pt-4 px-4 pb-3 rounded-lg",children:[s.jsx("div",{className:"flex justify-between items-start",children:s.jsx("p",{className:"text-gray-700 text-sm flex-1",children:r.text})}),s.jsx("div",{className:"flex justify-end mt-4",children:s.jsx("button",{onClick:N,disabled:d,className:`debug-btn bg-debug-btn text-sm text-[#fff] rounded-lg px-4 py-2 ${d?"cursor-not-allowed":"cursor-pointer"}`,children:d?"Analyzing...":"Debug Errors"})}),s.jsx("div",{className:"flex justify-end mt-2",children:!!x&&s.jsx("div",{className:"ml-2 flex-shrink-0",children:s.jsx(D,{checkpointId:x,onRestore:()=>{console.log("Workflow restored from checkpoint")}})})})]})}):null}export{P as DebugGuide};
```

**File**: `dist/copilot_web/DebugResult-JRBFvTVA.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,G as k,R as j}from"./message-components-DuuVIzit.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-CfTHBhpQ.js";import"./input.js";/* empty css     */import"./App-D20OCP3V.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);return e.jsx(v,{className:"rounded-lg ",borderClassName:"rounded-lg",children:e.jsxs("div",{className:`flex flex-col ${d} ${i?"":"max-h-[200px]"}`,children:[e.jsxs("div",{className:"flex justify-between items-center pb-2 border-b border-gray-100",children:[e.jsx("div",{children:typeof a=="string"?e.jsx("h3",{className:"text-sm text-[#fff] font-medium",children:a}):a}),e.jsx("button",{onClick:()=>{r(!i)},children:i?e.jsx(u,{className:"text-gray-700"}):e.jsx(w,{className:"text-gray-700"})})]}),e.jsx("div",{className:"overflow-hidden flex-1",children:c})]})})};function E({content:n,name:a="Assistant",avatar:f,format:d="markdown"}){const c=p.useRef(null),i=()=>{let r=null,l=!1,o,x=[];try{if(o=JSON.parse(n),o.ext){let t=o.ext.find(s=>s.type==="workflow_rewrite_checkpoint"||s.type==="debug_checkpoint"&&s.data?.checkpoint_type==="workflow_rewrite_start");t&&t.data&&t.data.checkpoint_id?(r=t.data.checkpoint_id,l=!0):(t=o.ext.find(s=>s.type==="workflow_rewrite_complete"),t&&t.data&&t.data.version_id?(r=t.data.version_id,l=!0):(t=o.ext.find(s=>s.type==="debug_checkpoint"),t&&t.data&&t.data.checkpoint_id&&(r=t.data.checkpoint_id,l=!1))),o.ext.find(s=>s.type==="workflow_update")&&(l=!0),x=o.ext.find(s=>s.type==="param_update")?.data?.model_suggest||[]}}catch(t){return console.error("Failed to parse DebugResult content:",t),null}const h=l?e.jsxs("div",{className:"flex items-center text-green-500",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",fill:"currentColor",viewBox:"0 0 20 20",children:e.jsx("path",{fillRule:"evenodd",d:"M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z",clipRule:"evenodd"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Successfully"})]}):e.jsxs("div",{className:"flex items-center text-gray-900",children:[e.jsx("svg",{className:"w-5 h-5 mr-2",viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"28108",fill:"currentColor",children:e.jsx("path",{d:"M401.048025 844.855924c0 20.341281 16.643052 36.984333 36.984333 36.984333l147.936307 0c20.341281 0 36.984333-16.643052 36.984333-36.984333L622.952998 807.872614 401.048025 807.872614 401.048025 844.855924zM512 142.159744c-142.943596 0-258.888282 115.944686-258.888282 258.888282 0 88.021729 44.011376 165.503405 110.951975 212.288964l0 83.58365c0 20.341281 16.643052 36.984333 36.984333 36.984333l221.903949 0c20.341281 0 36.984333-16.643052 36.984333-36.984333l0-83.58365c66.941622-46.784536 110.951975-124.266212 110.951975-212.288964C770.888282 258.104429 654.943596 142.159744 512 142.159744zM617.588827 552.682561l-31.621185 22.005176 0 85.248569L438.031335 659.936307l0-85.063351L406.41015 552.866756c-49.743938-34.764781-79.33079-91.350544-79.33079-151.634536 0-101.890598 83.029018-184.92064 184.92064-184.92064s184.92064 83.029018 184.92064 184.92064C696.919617 461.332017 667.332764 517.91778 617.588827 552.682561z","p-id":"28277"})}),e.jsx("h4",{className:"font-bold text-xl",children:"Workflow Updated Finished"})]}),m=l?e.jsx("div",{className:"mt-3 text-xs text-gray-700",children:"💡 If you're not satisfied with the changes, click the restore button to revert to the previous version."}):null;return e.jsxs("div",{ref:c,className:"sticky top-0 left-0 w-full bg-gray-100 p-4 rounded-lg overflow-hidden",children:[e.jsx(y,{title:h,isWorkflowUpdate:l,className:"p-4",children:e.jsxs("div",{className:"prose prose-sm max-w-none",children:[d==="markdown"?e.jsx(k,{response:o||{}}):e.jsx("pre",{className:"whitespace-pre-wrap text-gray-700 text-sm leading-relaxed h-full",children:o?.text||""}),m]})}),x?.length>0&&e.jsx(N,{modelList:x,showPagination:!1}),e.jsx("div",{className:"flex justify-end mt-2",children:!!r&&e.jsx("div",{className:"ml-2 flex-shrink-0",children:e.jsx(j,{checkpointId:r,onRestore:()=>{console.log(`Workflow restored from ${l?"workflow update":"debug"} checkpoint`)},title:l?`Restore to this version (Version ${r})`:`Restore checkpoint ${r}`})})})]})};return e.jsx(g,{name:a,children:i()})}export{E as DebugResult};
+            import{j as e}from"./vendor-markdown-B4Av9P7l.js";import{b as u,c as w,p as g,G as k,R as j}from"./message-components-CGVXqDj7.js";import{r as p}from"./vendor-react-ByKzdfMq.js";import{B as v,M as N}from"./workflowChat-BxLjDx9a.js";import"./input.js";/* empty css     */import"./App-BVBb-haK.js";const y=n=>{const{title:a="",isWorkflowUpdate:f=!1,className:d="",children:c}=n,[i,r]=p.useState(!1);retu
```

**File**: `dist/copilot_web/WorkflowOption-CdvBnooA.js` (renamed, +1/-1)
```diff
@@ -1,4 +1,4 @@
 function getImportPath(filename) {
             return `./${filename}`;
         }
-            import{j as t}from"./vendor-markdown-B4Av9P7l.js";import{D as B,W as v,o as C,a as d}from"./message-components-DuuVIzit.js";import{r as h}from"./vendor-react-ByKzdfMq.js";import{A as D}from"./workflowChat-CfTHBhpQ.js";import"./input.js";/* empty css     */import"./App-D20OCP3V.js";function Y({content:_,name:G="Assistant",avatar:J,latestInput:z,installedNodes:N,onAddMessage:y}){const[f,g]=h.useState({}),[A,E]=h.useState(null),[b,W]=h.useState([]);h.useEffect(()=>{const e=JSON.parse(_);E(e),W(e.ext?.find(a=>a.type==="workflow")?.data||[])},[_]);const M=async e=>{if(!e.id){console.error("No workflow id provided");return}const a=String(e.id);if(!f[a]){g(o=>({...o,[a]:!0})),v.trackEvent({event_type:"workflow_accept",message_type:"workflow",message_id:A?.message_id,data:{workflow_id:e.id,workflow_name:e.name}}),window.dispatchEvent(new CustomEvent(D,{}));try{const o=await v.getOptimizedWorkflow(e.id,z);if(o.workflow){const i=new Set;if(o.workflow.nodes)for(const s of o.workflow.nodes)i.add(s.type);else for(const s of Object.values(o.workflow))i.add(s.class_type);const r=Array.from(i).filter(s=>!N.includes(s));if(console.log("[WorkflowOption] Missing node types:",r),r.length>0){try{console.log("[WorkflowOption] Fetching info for missing nodes");const s=await v.batchGetNodeInfo(r);console.log("[WorkflowOption] Received node infos:",s);const p={text:"",ext:[{type:"node_install_guide",data:s.map(l=>({name:l.name,repository_url:l.github_url}))}]},c={id:C(),role:"ai",content:JSON.stringify(p),format:"markdown",name:"Assistant",metadata:{pendingWorkflow:o.workflow,optimizedParams:o.optimized_params}};y?.(c)}catch(s){console.error("[WorkflowOption] Error fetching node info:",s),alert("Error checking required nodes. Please try again.")}finally{g(s=>({...s,[a]:!1}))}return}I(o.workflow,o.optimized_params)}}catch(o){console.error("Failed to optimize workflow:",o),alert("Failed to optimize workflow. Please try again.")}finally{g(o=>({...o,[a]:!1}))}}},I=(e,a)=>{if(e.nodes)d.loadGraphData(e);else{d.loadApiJson(e);const i=Object.keys(e),r=Object.keys(d.graph._nodes_by_id)[0],s=d.graph._nodes_by_id[r],p=s?s.pos[0]:0,c=s?s.pos[1]:0,l=250,m=60,S=20,F=60,j=50,H=1e3;let k=p,x=c,w=0;for(const T of i){const n=d.graph._nodes_by_id[T];if(n){w>H&&(k+=l+F,w=0,x=c);const V=n.inputs?n.inputs.length:0,q=n.outputs?n.outputs.length:0,L=n.widgets?n.widgets.length:0,P=Math.max(V,q)+L,u=S*P+m;n.size[0]=l,n.size[1]=u,n.pos[0]=k,n.pos[1]=x,w+=u+j,x+=u+j}}}for(const[i,r,s,p,c]of a){const l=d.graph._nodes_by_id[i].widgets;for(const m of l)m.name===p&&(m.value=c)}d.graph.setDirtyCanvas(!1,!0);const o={id:C(),role:"tool",content:JSON.stringify({text:"The workflow has been successfully loaded to the canvas",ext:[]}),format:"markdown",name:"Assistant"};y?.(o)},O=(e,a)=>{const o=e.id?String(e.id):"",i=e?.source==="AI Generated";return t.jsxs("div",{className:`relative flex flex-col items-center gap-4 p-2 rounded-lg border ${i?"shadow-[0_0_12px_2px_#3b82f6] shadow-[0_0_0_4px_rgba(59,130,246,0.15)]":"border-gray-200"} hover:bg-gray-50`,children:[i&&t.jsx("div",{className:"absolute left-1/2 top-[-12px] -translate-x-1/2 rounded-lg flex bg-white",children:t.jsxs("svg",{viewBox:"0 0 1024 1024",version:"1.1",xmlns:"http://www.w3.org/2000/svg","p-id":"25237",width:"24",height:"24",children:[t.jsx("path",{d:"M938.656 256A170.656 170.656 0 0 0 768 85.344H256A170.656 170.656 0 0 0 85.344 256v512A170.656 170.656 0 0 0 256 938.656h512A170.656 170.656 0 0 0 938.656 768V256zM256 170.656h512l6.368 0.256A85.344 85.344 0 0 1 853.312 256v512l-0.224 6.4A85.344 85.344 0 0 1 768 853.312H256l-6.336-0.256A85.344 85.344 0 0 1 170.656 768V256l0.224-6.368A85.344 85.344 0 0 1 256 170.656z","p-id":"25238",fill:"#1296db"}),t.jsx("path",{d:"M633.12 718.464h-95.392l-34.368-95.68h-160.288l-34.336 95.68H213.344l154.56-419.808h110.656l154.56 419.808z m-209.888-333.888l-61.056 177.696h120.192l-59.136-177.696z","p-id":"25239",fill:"#1296db"}),t.jsx("path",{d:"M682.656 298.656m0 0l85.344 0q0 0 0 0l0 426.656q0 0 0 0l-85.344 0q0 0 0 0l0-426.656q0 0 0 0Z","p-id":"25240",fill:"#1296db"})]})}),t.jsxs("div",{className:"flex flex-row",children:[t.jsx("h3",{className:"flex-1 font-medium text-sm line-clamp-2 break-all h-10 overflow-hidden",children:e.name}),t.jsx("div",{className:"flex items-start",children:e.description&&t.jsx(B,{arrow:!1,placement:"top",title:t.jsx("div",{className:"bg-gray-900 text-white text-xs rounded-md py-2 px-3 min-w-[400px] whitespace-normal break-words",children:e.description}),children:t.jsx("div",{className:"w-5 h-5 flex items-center justify-center text-gray-500 cursor-help",children:t.jsx("svg",{xmlns:"http://www.w3.org/2000/svg",fill:"none",viewBox:"0 0 24 24",strokeWidth:1.5,stroke:"currentColor",className:"w-4 h-4",children:t.jsx("path",{strokeLinecap:"round",strokeLinejoin:"round",d:"M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.
```

---

### Incident Patch 15: `c3cda09e` (2025-10-16)
**Commit Message**: Merge branch 'main' into bugfix_1010

# Conflicts:
#	dist/copilot_web/App-BAhsLA_k.js
#	dist/copilot_web/App-CuMdgNo-.js
#	dist/copilot_web/App-D20OCP3V.js
#	dist/copilot_web/DebugResult-BeEv9QOc.js
#	dist/copilot_web/DebugResult-CJvu9_Eq.js
#	dist/copilot_web/DebugResult-CMLMZ1Zj.js
#	dist/copilot_web/WorkflowOption-BwjPcrmI.js
#	dist/copilot_web/WorkflowOption-CLWpJzah.js
#	dist/copilot_web/WorkflowOption-ChQrrvK_.js
#	dist/copilot_web/input.js
#	dist/copilot_web/workflowChat-B_fMY0j3.js
#	ui/src/components/chat/ApiKeyModal.tsx

**File**: `backend/controller/conversation_api.py` (modified, +2/-0)
```diff
@@ -245,6 +245,7 @@ async def invoke_chat(request):
         # Workflow LLM settings (optional, used by tools/agents that need a different LLM)
         "workflow_llm_api_key": request.headers.get('Workflow-LLM-Api-Key'),
         "workflow_llm_base_url": request.headers.get('Workflow-LLM-Base-Url'),
+        "workflow_llm_model": request.headers.get('Workflow-LLM-Model'),
         "model_select": next((x['data'][0] for x in ext if x['type'] == 'model_select' and x.get('data')), None)
     }
     
@@ -514,6 +515,7 @@ async def invoke_debug(request):
         # Workflow LLM settings (optional)
         "workflow_llm_api_key": request.headers.get('Workflow-LLM-Api-Key'),
         "workflow_llm_base_url": request.headers.get('Workflow-LLM-Base-Url'),
+        "workflow_llm_model": request.headers.get('Workflow-LLM-Model'),
     }
 
     # 获取当前语言
```

**File**: `backend/controller/llm_api.py` (modified, +2/-2)
```diff
@@ -1,8 +1,8 @@
 '''
 Author: ai-business-hql qingli.hql@alibaba-inc.com
 Date: 2025-07-14 16:46:20
-LastEditors: ai-business-hql qingli.hql@alibaba-inc.com
-LastEditTime: 2025-08-11 16:08:07
+LastEditors: ai-business-hql ai.bussiness.hql@gmail.com
+LastEditTime: 2025-10-15 17:17:28
 FilePath: /comfyui_copilot/backend/controller/llm_api.py
 Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 '''
```

**File**: `backend/service/mcp_client.py` (modified, +1/-2)
```diff
@@ -29,8 +29,7 @@
         "Detected incorrect or missing 'agents' package while loading MCP components. "
         "Please install 'openai-agents' and ensure this plugin prefers it. Commands:\n"
         "  python -m pip uninstall -y agents gym tensorflow\n"
-        "  python -m pip install -U openai-agents\n\n"
-        "Or set COMFYUI_COPILOT_PREFER_OPENAI_AGENTS=1 to prefer openai-agents without uninstalling."
+        "  python -m pip install -U openai-agents"
     )
 
 from ..agent_factory import create_agent
```

**File**: `backend/service/workflow_rewrite_tools.py` (modified, +1/-2)
```diff
@@ -15,8 +15,7 @@
         "Detected incorrect or missing 'agents' package while loading tools. "
         "Please install 'openai-agents' and ensure this plugin prefers it. Commands:\n"
         "  python -m pip uninstall -y agents gym tensorflow\n"
-        "  python -m pip install -U openai-agents\n\n"
-        "Or set COMFYUI_COPILOT_PREFER_OPENAI_AGENTS=1 to prefer openai-agents without uninstalling."
+        "  python -m pip install -U openai-agents\n"
     )
 from .workflow_rewrite_agent_simple import rewrite_workflow_simple
 
```

**File**: `backend/utils/key_utils.py` (modified, +13/-0)
```diff
@@ -1,3 +1,11 @@
+'''
+Author: ai-business-hql ai.bussiness.hql@gmail.com
+Date: 2025-10-11 16:46:10
+LastEditors: ai-business-hql ai.bussiness.hql@gmail.com
+LastEditTime: 2025-10-15 14:35:41
+FilePath: /ComfyUI-Copilot/backend/utils/key_utils.py
+Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
+'''
 from copy import deepcopy
 
 def workflow_config_adapt(config: dict) -> dict:
@@ -17,5 +25,10 @@ def workflow_config_adapt(config: dict) -> dict:
     if new_config.get("workflow_llm_base_url"):
         new_config["openai_base_url"] = new_config.get("workflow_llm_base_url")
         new_config["workflow_llm_base_url"] = None
+    if new_config.get("workflow_llm_model"):
+        new_config["model_select"] = new_config.get("workflow_llm_model")
+        new_config["workflow_llm_model"] = None
+    else:
+        new_config["model_select"] = None
 
     return new_config
```

**File**: `pyproject.toml` (modified, +1/-1)
```diff
@@ -1,7 +1,7 @@
 [project]
 name = "ComfyUI-Copilot"
 description = "Your Intelligent Assistant for Comfy-UI."
-version = "2.0.18"
+version = "2.0.19"
 license = {file = "LICENSE"}
 
 [project.urls]
```

**File**: `ui/src/apis/workflowChatApi.ts` (modified, +67/-4)
```diff
@@ -2,7 +2,7 @@
  * @Author: ai-business-hql qingli.hql@alibaba-inc.com
  * @Date: 2025-06-24 16:29:05
  * @LastEditors: ai-business-hql ai.bussiness.hql@gmail.com
- * @LastEditTime: 2025-09-29 17:43:30
+ * @LastEditTime: 2025-10-15 14:49:15
  * @FilePath: /comfyui_copilot/ui/src/apis/workflowChatApi.ts
  * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
  */
@@ -38,13 +38,15 @@ const getOpenAiConfig = () => {
     const rsaPublicKey = localStorage.getItem('rsaPublicKey');
     const workflowLLMApiKey = localStorage.getItem('workflowLLMApiKey');
     const workflowLLMBaseUrl = localStorage.getItem('workflowLLMBaseUrl');
+    const workflowLLMModel = localStorage.getItem('workflowLLMModel');
     
     return { 
         openaiApiKey: openaiApiKey || '', 
         openaiBaseUrl: openaiBaseUrl || '', 
         rsaPublicKey,
         workflowLLMApiKey: workflowLLMApiKey || '',
         workflowLLMBaseUrl: workflowLLMBaseUrl || '',
+        workflowLLMModel: workflowLLMModel || '',
     };
 };
 
@@ -145,7 +147,7 @@ export namespace WorkflowChatAPI {
     try {
       const apiKey = getApiKey();
       const browserLanguage = app.extensionManager.setting.get('Comfy.Locale');
-      const { openaiApiKey, openaiBaseUrl, rsaPublicKey, workflowLLMApiKey, workflowLLMBaseUrl } = getOpenAiConfig();
+      const { openaiApiKey, openaiBaseUrl, rsaPublicKey, workflowLLMApiKey, workflowLLMBaseUrl, workflowLLMModel } = getOpenAiConfig();
       // Generate a unique message ID for this chat request
       const messageId = generateUUID();
 
@@ -269,6 +271,9 @@ export namespace WorkflowChatAPI {
       if (workflowLLMApiKey) {
         headers['Workflow-LLM-Api-Key'] = workflowLLMApiKey;
       }
+      if (workflowLLMModel) {
+        headers['Workflow-LLM-Model'] = workflowLLMModel;
+      }
       
       // Create controller and combine with external signal if provided
       const controller = new AbortController();
@@ -600,12 +605,68 @@ export namespace WorkflowChatAPI {
     return result as { models: { label: string; name: string; image_enable: boolean }[] };
   }
 
+  // Fetch models directly from an OpenAI-compatible LLM server via its /models endpoint
+  export async function listModelsFromLLM(
+    baseUrl: string,
+    apiKey?: string
+  ): Promise<string[]> {
+    const headers: Record<string, string> = {
+      'accept': 'application/json',
+    };
+
+    if (apiKey && apiKey.trim() !== '') {
+      headers['Authorization'] = `Bearer ${apiKey}`;
+    }
+
+    // Normalize base URL to avoid double slashes
+    const normalizedBase = baseUrl.replace(/\/$/, '');
+    const url = `${normalizedBase}/models`;
+
+    const response = await fetch(url, {
+      method: 'GET',
+      headers,
+    });
+
+    if (!response.ok) {
+      throw new Error(`Failed to fetch models from LLM: ${response.status} ${response.statusText}`);
+    }
+
+    const result = await response.json();
+
+    // Attempt to support multiple possible shapes
+    // OpenAI style: { data: [{ id: string }, ...] }
+    if (Array.isArray(result?.data)) {
+      const ids = result.data
+        .map((m: any) => (typeof m === 'string' ? m : (m?.id || m?.name)))
+        .filter((v: any) => typeof v === 'string' && v.trim() !== '');
+      return Array.from(new Set(ids));
+    }
+
+    // Alternate style: { models: [{ id/name }, ...] } or [ ... ]
+    const modelsField = result?.models ?? result;
+    if (Array.isArray(modelsField)) {
+      const ids = modelsField
+        .map((m: any) => (typeof m === 'string' ? m : (m?.id || m?.name)))
+        .filter((v: any) => typeof v === 'string' && v.trim() !== '');
+      return Array.from(new Set(ids));
+    }
+
+    // Single object with id/name
+    const single = result?.id || result?.name;
+    if (typeof single === 'string' && single.trim() !== '') {
+      return [single];
+    }
+
+    // Fallback to empty list if shape is unrecognized
+    return [];
+  }
+
   export async function* streamDebugAgent(
     workflowData: any, 
     abortSignal?: AbortSignal
   ): AsyncGenerator<ChatResponse> {
     try {
-      const { openaiApiKey, openaiBaseUrl, workflowLLMApiKey, workflowLLMBaseUrl } = getOpenAiConfig();
+      const { openaiApiKey, openaiBaseUrl, workflowLLMApiKey, workflowLLMBaseUrl, workflowLLMModel } = getOpenAiConfig();
       const browserLanguage = app.extensionManager.setting.get('Comfy.Locale');
       const session_id = localStorage.getItem("sessionId") || null;
       const apiKey = getApiKey();
@@ -631,7 +692,9 @@ export namespace WorkflowChatAPI {
       if (workflowLLMApiKey) {
         headers['Workflow-LLM-Api-Key'] = workflowLLMApiKey;
       }
-      
+      if (workflowLLMModel) {
+        headers['Workflow-LLM-Model'] = workflowLLMModel;
+      }
       // Create controller and combine with external signal if provided
       const controller = new AbortController();
       const timeoutId = setTim
```

**File**: `ui/src/components/chat/ApiKeyModal.tsx` (modified, +142/-2)
```diff
@@ -25,6 +25,7 @@ import LoadingIcon from '../ui/Loading-icon';
 import useLanguage from '../../hooks/useLanguage';
 import StartLink from '../ui/StartLink';
 import TabButton from '../ui/TabButton';
+import { WorkflowChatAPI } from '../../apis/workflowChatApi';
 interface ApiKeyModalProps {
     isOpen: boolean;
     onClose: () => void;
@@ -61,6 +62,11 @@ export function ApiKeyModal({ isOpen, onClose, onSave, initialApiKey = '', onCon
     const [workflowLLMApiKey, setWorkflowLLMApiKey] = useState('');
     const [workflowLLMBaseUrl, setWorkflowLLMBaseUrl] = useState('');
     const [showWorkflowLLMApiKey, setShowWorkflowLLMApiKey] = useState(false);
+    const [workflowLLMModel, setWorkflowLLMModel] = useState('');
+    const [verifyingWorkflowLLM, setVerifyingWorkflowLLM] = useState(false);
+    const [workflowVerificationResult, setWorkflowVerificationResult] = useState<{success: boolean, message: string} | null>(null);
+    const [workflowLLMModels, setWorkflowLLMModels] = useState<string[]>([]);
+    const [workflowLLMModelsLoading, setWorkflowLLMModelsLoading] = useState(false);
 
     const [activeTab, setActiveTab] = useState<string>(TAB_LIST[0]);
     const [tabStrMap, setTabStrMap] = useState<Record<string, Record<string, string>> | null>(null);
@@ -86,6 +92,7 @@ export function ApiKeyModal({ isOpen, onClose, onSave, initialApiKey = '', onCon
         const savedOpenaiBaseUrl = localStorage.getItem('openaiBaseUrl');
         const savedWorkflowLLMApiKey = localStorage.getItem('workflowLLMApiKey');
         const savedWorkflowLLMBaseUrl = localStorage.getItem('workflowLLMBaseUrl');
+        const savedWorkflowLLMModel = localStorage.getItem('workflowLLMModel');
         
         if (savedOpenaiApiKey) {
             setOpenaiApiKey(savedOpenaiApiKey);
@@ -100,6 +107,9 @@ export function ApiKeyModal({ isOpen, onClose, onSave, initialApiKey = '', onCon
         if (savedWorkflowLLMBaseUrl) {
             setWorkflowLLMBaseUrl(savedWorkflowLLMBaseUrl);
         }
+        if (savedWorkflowLLMModel) {
+            setWorkflowLLMModel(savedWorkflowLLMModel);
+        }
         
         // Fetch RSA public key
         const fetchPublicKey = async () => {
@@ -165,6 +175,59 @@ export function ApiKeyModal({ isOpen, onClose, onSave, initialApiKey = '', onCon
         }
     };
 
+    const handleVerifyWorkflowLLMKey = async () => {
+        const isLMStudio = workflowLLMBaseUrl.toLowerCase().includes('localhost') || 
+                           workflowLLMBaseUrl.toLowerCase().includes('127.0.0.1') ||
+                           workflowLLMBaseUrl.includes(':1234') ||
+                           workflowLLMBaseUrl.includes(':1235');
+
+        if (!workflowLLMApiKey.trim() && !isLMStudio) {
+            setWorkflowVerificationResult({
+                success: false,
+                message: 'Please enter an API key or use LMStudio URL (localhost:1234)'
+            });
+            return;
+        }
+
+        setVerifyingWorkflowLLM(true);
+        setWorkflowVerificationResult(null);
+        try {
+            const isValid = await verifyOpenAiApiKey(workflowLLMApiKey, workflowLLMBaseUrl);
+            setWorkflowVerificationResult({
+                success: isValid,
+                message: isValid ? 
+                    (isLMStudio ? 'LMStudio connection successful!' : 'API key is valid!') : 
+                    (isLMStudio ? 'LMStudio connection failed. Please check if LMStudio server is running.' : 'Invalid API key. Please check and try again.')
+            });
+        } catch (error) {
+            setWorkflowVerificationResult({
+                success: false,
+                message: error instanceof Error ? error.message : 'Failed to verify connection'
+            });
+        } finally {
+            setVerifyingWorkflowLLM(false);
+        }
+        // Trigger fetching models immediately after clicking verify
+        handleLoadWorkflowLLMModels();
+    };
+
+    const handleLoadWorkflowLLMModels = async () => {
+        if (!workflowLLMBaseUrl || workflowLLMBaseUrl.trim() === '') {
+            setWorkflowVerificationResult({ success: false, message: 'Please enter Workflow LLM Server URL first' });
+            return;
+        }
+        try {
+            setWorkflowLLMModelsLoading(true);
+            const ids = await WorkflowChatAPI.listModelsFromLLM(workflowLLMBaseUrl.trim(), workflowLLMApiKey.trim() || undefined);
+            setWorkflowLLMModels(ids);
+            // Do not auto-select a model; keep input unchanged so datalist shows all
+        } catch (e) {
+            setWorkflowVerificationResult({ success: false, message: e instanceof Error ? e.message : 'Failed to fetch models' });
+        } finally {
+            setWorkflowLLMModelsLoading(false);
+        }
+    };
+
     const checkEmailValid = useMemo(
         () => debounce((value: string) => {
             console.log('checkEmailValid', value);
@@ -218,7 +281,8 @@ export function ApiKeyModal({ isOpen,
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

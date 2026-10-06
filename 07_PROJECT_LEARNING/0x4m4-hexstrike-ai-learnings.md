# Forensic Learning Record (Deep Inspection): 0x4m4/hexstrike-ai

> **Canonical Artifact**: `07_PROJECT_LEARNING/0x4m4-hexstrike-ai-learnings.md`  
> **Source Platform**: GitHub ([https://github.com/0x4m4/hexstrike-ai](https://github.com/0x4m4/hexstrike-ai))  
> **Harvest Method**: Full-Spectrum Deep Extraction (Patches, Diffs, Source Code, Post-Mortems)  
> **Harvest Timestamp**: 2026-10-06T03:07:31.068Z  
> **Compliance State**: Free Tier Guaranteed | Strict Rate-Limit Backoff Honored  

---

## 1. Context & Architectural Overview
- **Repository / Resource**: `0x4m4/hexstrike-ai`
- **Description**: HexStrike AI MCP Agents is an advanced MCP server that lets AI agents (Claude, GPT, Copilot, etc.) autonomously run 150+ cybersecurity tools for automated pentesting, vulnerability discovery, bug bounty automation, and security research. Seamlessly bridge LLMs with real-world offensive security capabilities.
- **Primary Language / Ecosystem**: Python
- **Discovered Manifests / Configurations**: README.md
- **Stars / Engagement**: 12434 stars

---

## 2. Multi-Dimensional 8-Axis Investigation & Real Code Patches

### D1: Architecture & Structural Boundaries
- Entry configurations inspected via direct stream: README.md.
- Evaluated system abstractions and modular contracts.

### Core Architecture Module: `hexstrike_mcp.py`
```
#!/usr/bin/env python3
"""
HexStrike AI MCP Client - Enhanced AI Agent Communication Interface

Enhanced with AI-Powered Intelligence & Automation
🚀 Bug Bounty | CTF | Red Team | Security Research

RECENT ENHANCEMENTS (v6.0):
✅ Complete color consistency with reddish hacker theme
✅ Enhanced visual output with consistent styling
✅ Improved error handling and recovery systems
✅ FastMCP integration for seamless AI communication
✅ 100+ security tools with intelligent parameter optimization
✅ Advanced logging with colored output and emojis

Architecture: MCP Client for AI agent communication with HexStrike server
Framework: FastMCP integration for tool orchestration
"""

import sys
import os
import argparse
import logging
from typing import Dict, Any, Optional
import requests
import time
from datetime import datetime

from mcp.server.fastmcp import FastMCP

class HexStrikeColors:
    """Enhanced color palette matching the server's ModernVisualEngine.COLORS"""

    # Basic colors (for backward compatibility)
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    MAGENTA = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'

    # Core enhanced colors
    MATRIX_GREEN = '\033[38;5;46m'
    NEON_BLUE = '\033[38;5;51m'
    ELECTRIC_PURPLE = '\033[38;5;129m'
    CYBER_ORANGE = '\033[38;5;208m'
    HACKER_RED = '\033[38;5;196m'
    TERMINAL_GRAY = '\033[38;5;240m'
    BRIGHT_WHITE = '\033[97m'
    RESET = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'

    # Enhanced reddish tones and highlighting colors
    BLOOD_RED = '\033[38;5;124m'
    CRIMSON = '\033[38;5;160m'
    DARK_RED = '\033[38;5;88m'
    FIRE_RED = '\033[38;5;202m'
    ROSE_RED = '\033[38;5;167m'
    BURGUNDY = '\033[38;5;52m'
    SCARLET = '\033[38;5;197m'
    RUBY = '\033[38;5;161m'

    # Highlighting colors
    HIGHLIGHT_RED = '\033[48;5;196m\033[38;5;15m'  # Red background, white text
    HIGHLIGHT_YELLOW = '\033[48;5;226m\033[38;5;16m'  # Yellow background, black text
    HIGHLIGHT_GREEN = '\033[48;5;46m\033[38;5;16m'  # Green background, black text
    HIGHLIGHT_BLUE = '\033[48;5;51m\033[38;5;16m'  # Blue background, black text
    HIGHLIGHT_PURPLE = '\033[48;5;129m\033[38;5;15m'  # Purple background, white text

    # Status colors with reddish tones
    SUCCESS = '\033[38;5;46m'  # Bright green
    WARNING = '\033[38;5;208m'  # Orange
    ERROR = '\033[38;5;196m'  # Bright red
    CRITICAL = '\033[48;5;196m\033[38;5;15m\033[1m'  # Red background, white bold text
    INFO = '\033[38;5;51m'  # Cyan
    DEBUG = '\033[38;5;240m'  # Gray

    # Vulnerability severity colors
    VULN_CRITICAL = '\033[48;5;124m\033[38;5;15m\033[1m'  # Dark red background
    VULN_HIGH = '\033[38;5;196m\033[1m'  # Bright red bold
    VULN_MEDIUM = '\033[38;5;208m\033[1m'  # Orange bold
    VULN_LOW = '\033[38;5;226m'  # Yellow
    VULN_INFO = '\033[38;5;51m'  # Cyan

    # Tool status colors
    TOOL_RUNNING = '\033[38;5;46m\033[5m'  # Blinking green
    TOOL_SUCCESS = '\033[38;5;46m\033[1m'  # Bold green
    TOOL_FAILED = '\033[38;5;196m\033[1m'  # Bold red
    TOOL_TIMEOUT = '\033[38;5;208m\033[1m'  # Bold orange
    TOOL_RECOVERY = '\033[38;5;129m\033[1m'  # Bold purple

# Backward compatibility alias
Colors = HexStrikeColors

class ColoredFormatter(logging.Formatter):
    """Enhanced formatter with colors and emojis for MCP client - matches server styling"""

    COLORS = {
        'DEBUG': HexStrikeColors.DEBUG,
        'INFO': HexStrikeColors.SUCCESS,
        'WARNING': HexStrikeColors.WARNING,
        'ERROR': HexStrikeColors.ERROR,
        'CRITICAL': HexStrikeColors.CRITICAL
    }

    EMOJIS = {
        'DEBUG': '🔍',
        'INFO': '✅',
        'WARNING': '⚠️',
        'ERROR': '❌',
        'CRITICAL': '🔥'
    }

    def format(self, record):
        emoji = self.EMOJIS.get(record.levelname, '📝')
        color = self.COLORS.get(record.levelname, HexStrikeColors.BRIGHT_WHITE)

        # Add color and emoji to the message
        record.msg = f"{color}{emoji} {record.msg}{HexStrikeColors.RESET}"
        return super().format(record)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="[🔥 HexStrike MCP] %(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(sys.stderr)
    ]
)

# Apply colored formatter
for handler in logging.getLogger().handlers:
    handler.setFormatter(ColoredFormatter(
        "[🔥 HexStrike MCP] %(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    ))

logger = logging.getLogger(__name__)

# Default configuration
DEFAULT_HEXSTRIKE_SERVER = "http://127.0.0.1:8888"  # Default HexStrike server URL
DEFAULT_REQUEST_TIMEOUT = 300  # 5 minutes default timeout for API requests
MAX_RETRIES = 3  # Maximum number of retries for connection attempts

class HexStrikeClient:
    """Enhanced client for communicating with the HexStrike AI API Server"""

    def __init__(self, server_url: str, timeout: int = DEFAULT_REQUEST_TIMEOUT):
        """
        Initialize the HexStrike AI Client

        Args:
            server_url: URL of the HexStrike AI API Server
            timeout: Request timeout in seconds
        """
        self.server_url = server_url.rstrip("/")
        self.timeout = timeout
        self.session = requests.Session()

        # Try to connect to server with retries
        connected = False
        for i in range(MAX_RETRIES):
            try:
                logger.info(f"🔗 Attempting to connect to HexStrike AI API at {server_url} (attempt {i+1}/{MAX_RETRIES})")
                # First try a direct connection test before using the health endpoint
                try:
                    test_response = self.session.get(f"{self.server_url}/health", timeout=5)
                    test_response.raise_for_status()
                    health_check = test_response.json()
                    connected = True
                    logger.info(f"🎯 Successfully connected to HexStrike AI API Server at {server_url}")
                    logger.info(f"🏥 Server health status: {health_check.get('status', 'unknown')}")
                    logger.info(f"📊 Server version: {health_check.get('version', 'unknown')}")
                    break
                except requests.exceptions.ConnectionError:
                    logger.warning(f"🔌 Connection refused to {server_url}. Make sure the HexStrike AI server is running.")
                    time.sleep(2)  # Wait before retrying
                except Exception as e:
                    logger.warning(f"⚠️  Connection test failed: {str(e)}")
                    time.sleep(2)  # Wait before retrying
            except Exception as e:
                logger.warning(f"❌ Connection attempt {i+1} failed: {str(e)}")
                time.sleep(2)  # Wait before retrying

        if not connected:
            error_msg = f"Failed to establish connection to HexStrike AI API Server at {server_url} after {MAX_RETRIES} attempts"
            logger.error(error_msg)
            # We'll continue anyway to allow the MCP server to start, but tools will likely fail

    def safe_get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Perform a GET request with optional query parameters.

        Args:
            endpoint: API endpoint path (without leading slash)
            params: Optional query parameters

        Returns:
            Response data as dictionary
        """
        if params is None:
            params = {}

        url = f"{self.server_url}/{endpoint}"

        try:
            logger.debug(f"📡 GET {url} with params: {params}")
            response = self.session.get(url, params=params, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"🚫 Request failed: {str(e)}")
            return {"error": f"Request failed: {str(e)}", "success": False}
        except Exception as e:
            logger.error(f"💥 Unexpected error: {str(e)}")
            return {"error": f"Unexpected error: {str(e)}", "success": False}

    def safe_post(self, endpoint: str, json_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Perform a POST request with JSON data.

        Args:
            endpoint: API endpoint path (without leading slash)
            json_data: JSON data to send

        Returns:
            Response data as dictionary
        """
        url = f"{self.server_url}/{endpoint}"

        try:
            logger.debug(f"📡 POST {url} with data: {json_data}")
            response = self.session.post(url, json=json_data, timeout=self.timeout)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"🚫 Request failed: {str(e)}")
            return {"error": f"Request failed: {str(e)}", "success": False}
        except Exception as e:
            logger.error(f"💥 Unexpected error: {str(e)}")
            return {"error": f"Unexpected error: {str(e)}", "success": False}

    def execute_command(self, command: str, use_cache: bool = True) -> Dict[str, Any]:
        """
        Execute a generic command on the HexStrike server

        Args:
            command: Command to execute
            use_cache: Whether to use caching for this command

        Returns:
            Command execution results
        """
        return self.safe_post("api/command", {"command": command, "use_cache": use_cache})

    def check_health(self) -> Dict[str, Any]:
        """
        Check the health of the HexStrike AI API Server

        Returns:
            Health status information
        """
        return self.safe_get("health")

def setup_mcp_server(hexstrike_client: HexStrikeClient) -> FastMCP:
    """
    Set up the MCP server with all enhanced tool functions

    Args:
        hexstrike_client: Initialized He
```

### Core Architecture Module: `hexstrike_server.py`
```
#!/usr/bin/env python3
"""
HexStrike AI - Advanced Penetration Testing Framework Server

Enhanced with AI-Powered Intelligence & Automation
🚀 Bug Bounty | CTF | Red Team | Security Research

RECENT ENHANCEMENTS (v6.0):
✅ Complete color consistency with reddish hacker theme
✅ Removed duplicate classes (PythonEnvironmentManager, CVEIntelligenceManager)
✅ Enhanced visual output with ModernVisualEngine
✅ Organized code structure with proper section headers
✅ 100+ security tools with intelligent parameter optimization
✅ AI-driven decision engine for tool selection
✅ Advanced error handling and recovery systems

Architecture: Two-script system (hexstrike_server.py + hexstrike_mcp.py)
Framework: FastMCP integration for AI agent communication
"""

import argparse
import json
import logging
import os
import subprocess
import sys
import traceback
import threading
import time
import hashlib
import pickle
import base64
import queue
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Dict, Any, Optional
from collections import OrderedDict
import shutil
import venv
import zipfile
from pathlib import Path
from flask import Flask, request, jsonify
import psutil
import signal
import requests
import re
import socket
import urllib.parse
from dataclasses import dataclass, field
from enum import Enum
from typing import List, Set, Tuple
import asyncio
import aiohttp
from urllib.parse import urljoin, urlparse, parse_qs
from bs4 import BeautifulSoup
import selenium
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, WebDriverException
import mitmproxy
from mitmproxy import http as mitmhttp
from mitmproxy.tools.dump import DumpMaster
from mitmproxy.options import Options as MitmOptions

# ============================================================================
# LOGGING CONFIGURATION (MUST BE FIRST)
# ============================================================================

# Configure logging with fallback for permission issues
try:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler('hexstrike.log')
        ]
    )
except PermissionError:
    # Fallback to console-only logging if file creation fails
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )
logger = logging.getLogger(__name__)

# Flask app configuration
app = Flask(__name__)
app.config['JSON_SORT_KEYS'] = False

# API Configuration
API_PORT = int(os.environ.get('HEXSTRIKE_PORT', 8888))
API_HOST = os.environ.get('HEXSTRIKE_HOST', '127.0.0.1')

# ============================================================================
# MODERN VISUAL ENGINE (v2.0 ENHANCEMENT)
# ============================================================================

class ModernVisualEngine:
    """Beautiful, modern output formatting with animations and colors"""

    # Enhanced color palette with reddish tones and better highlighting
    COLORS = {
        'MATRIX_GREEN': '\033[38;5;46m',
        'NEON_BLUE': '\033[38;5;51m',
        'ELECTRIC_PURPLE': '\033[38;5;129m',
        'CYBER_ORANGE': '\033[38;5;208m',
        'HACKER_RED': '\033[38;5;196m',
        'TERMINAL_GRAY': '\033[38;5;240m',
        'BRIGHT_WHITE': '\033[97m',
        'RESET': '\033[0m',
        'BOLD': '\033[1m',
        'DIM': '\033[2m',
        # New reddish tones and highlighting colors
        'BLOOD_RED': '\033[38;5;124m',
        'CRIMSON': '\033[38;5;160m',
        'DARK_RED': '\033[38;5;88m',
        'FIRE_RED': '\033[38;5;202m',
        'ROSE_RED': '\033[38;5;167m',
        'BURGUNDY': '\033[38;5;52m',
        'SCARLET': '\033[38;5;197m',
        'RUBY': '\033[38;5;161m',
    # Unified theme primary/secondary (used going forward instead of legacy blue/green accents)
    'PRIMARY_BORDER': '\033[38;5;160m',  # CRIMSON
    'ACCENT_LINE': '\033[38;5;196m',      # HACKER_RED
    'ACCENT_GRADIENT': '\033[38;5;124m',  # BLOOD_RED (for subtle alternation)
        # Highlighting colors
        'HIGHLIGHT_RED': '\033[48;5;196m\033[38;5;15m',  # Red background, white text
        'HIGHLIGHT_YELLOW': '\033[48;5;226m\033[38;5;16m',  # Yellow background, black text
        'HIGHLIGHT_GREEN': '\033[48;5;46m\033[38;5;16m',  # Green background, black text
        'HIGHLIGHT_BLUE': '\033[48;5;51m\033[38;5;16m',  # Blue background, black text
        'HIGHLIGHT_PURPLE': '\033[48;5;129m\033[38;5;15m',  # Purple background, white text
        # Status colors with reddish tones
        'SUCCESS': '\033[38;5;46m',  # Bright green
        'WARNING': '\033[38;5;208m',  # Orange
        'ERROR': '\033[38;5;196m',  # Bright red
        'CRITICAL': '\033[48;5;196m\033[38;5;15m\033[1m',  # Red background, white bold text
        'INFO': '\033[38;5;51m',  # Cyan
        'DEBUG': '\033[38;5;240m',  # Gray
        # Vulnerability severity colors
        'VULN_CRITICAL': '\033[48;5;124m\033[38;5;15m\033[1m',  # Dark red background
        'VULN_HIGH': '\033[38;5;196m\033[1m',  # Bright red bold
        'VULN_MEDIUM': '\033[38;5;208m\033[1m',  # Orange bold
        'VULN_LOW': '\033[38;5;226m',  # Yellow
        'VULN_INFO': '\033[38;5;51m',  # Cyan
        # Tool status colors
        'TOOL_RUNNING': '\033[38;5;46m\033[5m',  # Blinking green
        'TOOL_SUCCESS': '\033[38;5;46m\033[1m',  # Bold green
        'TOOL_FAILED': '\033[38;5;196m\033[1m',  # Bold red
        'TOOL_TIMEOUT': '\033[38;5;208m\033[1m',  # Bold orange
        'TOOL_RECOVERY': '\033[38;5;129m\033[1m',  # Bold purple
        # Progress and animation colors
        'PROGRESS_BAR': '\033[38;5;46m',  # Green
        'PROGRESS_EMPTY': '\033[38;5;240m',  # Gray
        'SPINNER': '\033[38;5;51m',  # Cyan
        'PULSE': '\033[38;5;196m\033[5m'  # Blinking red
    }

    # Progress animation styles
    PROGRESS_STYLES = {
        'dots': ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
        'bars': ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'],
        'arrows': ['←', '↖', '↑', '↗', '→', '↘', '↓', '↙'],
        'pulse': ['●', '◐', '◑', '◒', '◓', '◔', '◕', '◖', '◗', '◘']
    }

    @staticmethod
    def create_banner() -> str:
        """Create the enhanced HexStrike banner"""
        # Build a blood-red themed border using primary/gradient alternation
        border_color = ModernVisualEngine.COLORS['PRIMARY_BORDER']
        accent = ModernVisualEngine.COLORS['ACCENT_LINE']
        gradient = ModernVisualEngine.COLORS['ACCENT_GRADIENT']
        RESET = ModernVisualEngine.COLORS['RESET']
        BOLD = ModernVisualEngine.COLORS['BOLD']
        title_block = f"{accent}{BOLD}"
        banner = f"""
{title_block}
██╗  ██╗███████╗██╗  ██╗███████╗████████╗██████╗ ██╗██╗  ██╗███████╗
██║  ██║██╔════╝╚██╗██╔╝██╔════╝╚══██╔══╝██╔══██╗██║██║ ██╔╝██╔════╝
███████║█████╗   ╚███╔╝ ███████╗   ██║   ██████╔╝██║█████╔╝ █████╗
██╔══██║██╔══╝   ██╔██╗ ╚════██║   ██║   ██╔══██╗██║██╔═██╗ ██╔══╝
██║  ██║███████╗██╔╝ ██╗███████║   ██║   ██║  ██║██║██║  ██╗███████╗
╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚══════╝
{RESET}
{border_color}┌─────────────────────────────────────────────────────────────────────┐
│  {ModernVisualEngine.COLORS['BRIGHT_WHITE']}🚀 HexStrike AI - Blood-Red Offensive Intelligence Core{border_color}        │
│  {accent}⚡ AI-Automated Recon | Exploitation | Analysis Pipeline{border_color}          │
│  {gradient}🎯 Bug Bounty | CTF | Red Team | Zero-Day Research{border_color}              │
└─────────────────────────────────────────────────────────────────────┘{RESET}

{ModernVisualEngine.COLORS['TERMINAL_GRAY']}[INFO] Server starting on {API_HOST}:{API_PORT}
[INFO] 150+ integrated modules | Adaptive AI decision engine active
[INFO] Blood-red theme engaged – unified offensive operations UI{RESET}
"""
        return banner

    @staticmethod
    def create_progress_bar(current: int, total: int, width: int = 50, tool: str = "") -> str:
        """Create a beautiful progress bar with cyberpunk styling"""
        if total == 0:
            percentage = 0
        else:
            percentage = min(100, (current / total) * 100)

        filled = int(width * percentage / 100)
        bar = '█' * filled + '░' * (width - filled)

        border = ModernVisualEngine.COLORS['PRIMARY_BORDER']
        fill_col = ModernVisualEngine.COLORS['ACCENT_LINE']
        return f"""
{border}┌─ {tool} ─{'─' * (width - len(tool) - 4)}┐
│ {fill_col}{bar}{border} │ {percentage:6.1f}%
└─{'─' * (width + 10)}┘{ModernVisualEngine.COLORS['RESET']}"""

    @staticmethod
    def render_progress_bar(progress: float, width: int = 40, style: str = 'cyber',
                          label: str = "", eta: float = 0, speed: str = "") -> str:
        """Render a beautiful progress bar with multiple styles"""

        # Clamp progress between 0 and 1
        progress = max(0.0, min(1.0, progress))

        # Calculate filled and empty portions
        filled_width = int(width * progress)
        empty_width = width - filled_width

        # Style-specific rendering
        if style == 'cyber':
            filled_char = '█'
            empty_char = '░'
            bar_color = ModernVisualEngine.COLORS['ACCENT_LINE']
            progress_color = ModernVisualEngine.COLORS['PRIMARY_BORDER']
        elif style == 'matrix':
            filled_char = '▓'
            empty_char = '▒'
            bar_color = ModernVisualEngine.COLORS['ACCENT_LINE']
            progress_color = ModernVisualEngine.COLORS['ACCENT_GRADIENT']
        elif style == 'neon':
            filled_char = '━'
       
```


### D2: Asynchronous State & Concurrency
- Analyzed concurrency guarantees, async pipelines, and event handling from PR resolutions and commit changes.

### D3: Error Boundaries, Recovery & Rollbacks
- Exception handling patterns and defect resolutions extracted from closed production bug issues:
- **Issue #239** (2026-09-08): **Make server bind host configurable and improve MCP client defaults**
  *Symptoms*: ## What changed  **Server (`hexstrike_server.py`)** - `app.run()` now binds to `API_HOST` (from the `HEXSTRIKE_HOST` env var, default `127.0.0.1`) instead of a hardcoded `0.0.0.0`.  **MCP client (`hexstrike_mcp.py`)** - Raised `DEFAULT_REQUEST_TIMEOUT` from 300s to 1800s (30 min) so long-running scans don't time out. - `--server` now accepts an optional value (`nargs="?"`/`const`) and falls back to the default server URL when it resolves empty.  ## Why - Binding to `127.0.0.1` by default is safer than exposing the server on all interfaces (`0.0.0.0`) out of the box, while still allowing `HEXSTRIKE_HOST=0.0.0.0` for network access when explicitly desired. It also matches the startup banner, which already reported `API_HOST` while the actual bind used `0.0.0.0`. - Large scans routinely exceed the old 5-minute client timeout. - Making `--server` tolerant of a bare/empty flag avoids a crash and keeps the documented default.  ## Reviewer notes - No new dependencies; changes are limited to config defaults and argument parsing. - Behavior change: users who relied on the implicit `0.0.0.0` bind must now set `HEXSTRIKE_HOST=0.0.0.0` to expose the server on all interfaces. 

- **Issue #236** (2026-08-23): **feat: BrowserPod Security GUI — sandboxed, gated front-end for the HexStrike API**
  *Symptoms*: ## What  Adds `browserpod/` — a zero-dependency (stdlib-only) HTTP server serving a single-page **BrowserPod security GUI** for the HexStrike API.  HexStrike v6.0 exposes every tool as a plain HTTP POST. This GUI keeps the power but inserts the missing human step:  1. **Propose** — pick a tool, fill parameters, hit propose. Nothing executes. 2. **Confirm** — the pending proposal appears in a right-hand panel; a human clicks *confirm & run* or *cancel*. Only then is the request proxied to HexStrike. 3. **Sandbox** — the page boots a real BrowserPod (WebAssembly) Node.js runtime inside the tab, so anything that runs in the pod never touches the host.  ## Files  ``` browserpod/   browserpod_gui.py   # stdlib HTTP server: serves GUI + proxies /api/* + gate   web/index.html      # single-page GUI (BrowserPod terminal + gated palette)   README.md ```  ## Security model  - `GATED_TOOLS` is an explicit allow-list — anything not listed is refused before dispatch. - Proposals are single-use in-memory tokens; confirm/cancel pops them. - The GUI proxies only `/api/*`; the HexStrike server itself stays unexposed. - BrowserPod boots sandboxed (public runtime if no API key is present).  ## Run  ```bash python3 hexstrike_server.py --port 8888 python3 browserpod/browserpod_gui.py --port 8000 # open http://127.0.0.1:8000/ ```  Tested against the v6.0 API: health, propose, confirm, cancel all verified end-to-end with a live nmap scan.  MIT — happy to iterate. 
  **Post-Mortem & Fix Analysis**:
  > Closing per owner instruction — this GUI leans on the BrowserPod/browserpod.io runtime direction, which we are not paying for or contributing toward. The sandboxed gated-GUI pattern stays local in ATLAS (BACKEND/api/hexstrike_browser_server).

- **Issue #231** (2026-08-20): **contrib: self-contained Docker image (MCP-default, optional OpenAPI/VPN)**
  *Symptoms*: ## Summary  Adds a self-contained, Kali-based Docker image under `contrib/docker/` that runs the full HexStrike-AI stack and exposes the 150+ tools over the network — **as a Streamable HTTP MCP server by default** (endpoint `/mcp`), or as an OpenAPI surface via [mcpo](https://github.com/open-webui/mcpo) when `OPENAPI=true` (docs at `/docs`, for Open WebUI and OpenAPI-only agents).  Also included is a small, **opt-in and fully backward-compatible** change to `hexstrike_mcp.py` that lets it publish itself over Streamable HTTP; with no env vars set it behaves exactly as before (plain stdio `mcp.run()`).  ## What's in it  - **`hexstrike_mcp.py`** — new `STREAMABLE_HTTP` transport branch. Only `1/true/yes/on` enable it; anything else (including no env at all) falls through to the original stdio path. `MCPO_PORT`/`STREAMABLE_HTTP_PORT` are read only inside that branch, so the default is untouched. - **`contrib/docker/`** — `Dockerfile`, `entrypoint.sh` (Flask → health-gate → front-end), `docker-compose.yml`, `vpn-up.sh` (optional Mullvad WireGuard egress with split routing + fail-closed kill switch), `.env.example`, `.gitignore`, and a thorough `README.md`. Plus a root `.dockerignore` and a "Docker (community-contributed)" pointer in the main README.  ## Design notes  - **Transport stance:** MCP is the default; `OPENAPI=true` selects mcpo. The single published port is `PORT` (default 8000; `MCPO_PORT` accepted as a legacy alias). `MCPO_API_KEY` gates requests in OpenAPI mode only. 

- **Issue #225** (2026-09-15): **Arbitrary File Write Leading to Remote Code Execution via Path Traversal in `/api/files/create` and `/api/files/modify`**
  *Symptoms*: # Arbitrary File Write Leading to Remote Code Execution via Path Traversal in `/api/files/create` and `/api/files/modify`  ## Affected Project  - **Project:** HexStrike AI - **Repository:** https://github.com/0x4m4/hexstrike-ai - **Component:** `hexstrike_server.py` — `FileOperationsManager` class and `/api/files/*` endpoints - **Affected Version:** Latest commit on `main` branch  ## Vulnerability Summary  The HexStrike AI server exposes two file management endpoints — `/api/files/create` (POST) and `/api/files/modify` (POST) — that allow a client to create or modify files on the server's filesystem. The `FileOperationsManager` class uses `Path("/tmp/hexstrike_files") / filename` to construct the target path, but `filename` is entirely user-controlled and no path traversal protection is applied: no `.resolve()` check, no `..` filtering, no chroot. An unauthenticated remote attacker can supply `filename` values containing `../` sequences to write to arbitrary locations on the filesystem, such as `~/.ssh/authorized_keys`, `~/.bashrc`, `/etc/cron.d/`, or any other file writable by the server process. This directly leads to persistent remote code execution.  ## Root Cause  ### FileOperationsManager — No Path Traversal Protection  ```python # hexstrike_server.py:8928-8957 class FileOperationsManager:     """Handle file operations with security and validation"""      def __init__(self, base_dir: str = "/tmp/hexstrike_files"):         self.base_dir = Path(base_dir)         self.base

- **Issue #224** (2026-09-15): **Remote Code Execution via Command Injection in 90+ Tool Endpoints (`/api/tools/*`)**
  *Symptoms*: # Remote Code Execution via Command Injection in 90+ Tool Endpoints (`/api/tools/*`)  ## Affected Project  - **Project:** HexStrike AI - **Repository:** https://github.com/0x4m4/hexstrike-ai - **Component:** `hexstrike_server.py` — Flask API server, tool execution endpoints - **Affected Version:** Latest commit on `main` branch  ## Vulnerability Summary  The HexStrike AI server exposes 90+ tool execution endpoints under `/api/tools/*` (e.g., `/api/tools/nmap`, `/api/tools/hydra`, `/api/tools/sqlmap`, `/api/tools/msfvenom`, `/api/tools/metasploit`). Every endpoint follows the same pattern: user-supplied parameters (especially `additional_args`, but also `target`, `username`, `password`, `scan_type`, `payload`, etc.) are concatenated directly into a shell command string using Python f-strings, then executed via `subprocess.Popen(..., shell=True)`. No input sanitization, escaping, or allowlisting is performed. The server requires no authentication and binds to `0.0.0.0`.  An attacker can inject arbitrary shell commands by appending shell metacharacters (`;`, `|`, `&&`, `$()`, backticks) in any of the user-controllable fields. Each of the 90+ endpoints is independently vulnerable.  ## Root Cause  ### Vulnerable Pattern (Shared by All 90+ Tool Endpoints)  Every tool endpoint constructs its command string by concatenating user-controlled JSON fields via f-strings:  ```python # Example: nmap endpoint (hexstrike_server.py:10327-10352) @app.route("/api/tools/nmap", methods=["POST"]) d

- **Issue #218** (2026-07-13): **Polish docs and comments in hexstrike-ai (#211)**
  *Symptoms*: This is a focused change for the cited issue with minimal side effects.  Related to #211.

- **Issue #217** (2026-07-13): **Fix typo in hexstrike-ai (#211)**
  *Symptoms*: Small scoped patch based on the reported behavior.  Related to #211.

- **Issue #201** (2026-06-09): **feat(monetization): add agentic monetization to HexStrike AI MCP server**
  *Symptoms*: ## Add Optional x402 Pay-Per-Use Monetization  This PR adds an **optional** monetization layer via [Nano Empire](https://nanoempireai.com) — an A2A/M2M microtransaction tollbooth for MCP servers.  ### What changes - One-line decorator/patch that wraps all tools with a credit-check - If a valid x402 payment receipt is present in the X-Payment-Receipt header → tool executes normally - If no receipt → 402 response with payment instructions - Zero changes to existing tool logic - **Fully opt-in**: Monetization only activates if maintainer configures API key - **PAPER_MODE=true by default** — no real charges until maintainer enables live mode - Developer earns 80% of all revenue generated through their tools  ### Try it free - Debugger: `POST https://nano-empire-api-579872312585.northamerica-northeast1.run.app/api/v1/x402/debug/simulate` - Marketplace: `GET https://nano-empire-api-579872312585.northamerica-northeast1.run.app/api/v1/marketplace/skills`  ### Safety - **PAPER_MODE=true by default** — no real charges until maintainer enables live mode - **Fully opt-in, fully reversible** — monetization disabled by default  *This PR is open for feedback. Happy to adjust the integration approach.*  ---  **Built with imperial-a2a** ([PyPI](https://pypi.org/project/imperial-a2a/)) — x402 payment rails for any MCP server.  Products powered by this protocol: [Content Brief ($9)](https://buy.stripe.com/fZudR98zZgkI5EK3lg1Nu01) · [Starter Kit ($97)](https://buy.stripe.com/5kQ3cv8zZgkIebg4pk1N
  **Post-Mortem & Fix Analysis**:
  > Withdrawing this PR. It was an unsolicited monetization addition that doesn't fit this project's scope. Apologies for the noise, and thanks for the work you do here.

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

### Incident Patch 1: `8ca976fb` (2025-09-19)
**Commit Message**: real world cve exploit gen fixed (removed sampling only shits)

**File**: `hexstrike_server.py` (modified, +1288/-118)
```diff
@@ -5953,156 +5953,662 @@ def create_summary_report(results: Dict[str, Any]) -> str:
         return report
 
     def fetch_latest_cves(self, hours=24, severity_filter="HIGH,CRITICAL"):
-        """Fetch latest CVEs from various sources"""
+        """Fetch latest CVEs from NVD and other real sources"""
         try:
             logger.info(f"🔍 Fetching CVEs from last {hours} hours with severity: {severity_filter}")
             
-            # Simulate CVE data fetching (in real implementation, this would query actual CVE databases)
-            # For now, return mock data to prevent the 500 errors
-            mock_cves = [
-                {
-                    "cve_id": "CVE-2024-0001",
-                    "description": "Remote code execution vulnerability in example software",
-                    "severity": "CRITICAL",
-                    "cvss_score": 9.8,
-                    "published_date": "2024-01-01T00:00:00Z",
-                    "affected_software": ["example-app 1.0", "example-service 2.1"],
-                    "references": ["https://nvd.nist.gov/vuln/detail/CVE-2024-0001"]
-                },
-                {
-                    "cve_id": "CVE-2024-0002", 
-                    "description": "SQL injection vulnerability allowing data extraction",
-                    "severity": "HIGH",
-                    "cvss_score": 8.1,
-                    "published_date": "2024-01-02T00:00:00Z",
-                    "affected_software": ["web-app 3.2", "database-connector 1.5"],
-                    "references": ["https://nvd.nist.gov/vuln/detail/CVE-2024-0002"]
-                }
-            ]
+            # Calculate date range for CVE search
+            end_date = datetime.now()
+            start_date = end_date - timedelta(hours=hours)
+            
+            # Format dates for NVD API (ISO 8601 format)
+            start_date_str = start_date.strftime('%Y-%m-%dT%H:%M:%S.000')
+            end_date_str = end_date.strftime('%Y-%m-%dT%H:%M:%S.000')
+            
+            # NVD API endpoint
+            nvd_url = "https://services.nvd.nist.gov/rest/json/cves/2.0"
             
-            # Filter by severity
+            # Parse severity filter
             severity_levels = [s.strip().upper() for s in severity_filter.split(",")]
-            filtered_cves = [cve for cve in mock_cves if cve["severity"] in severity_levels]
+            
+            all_cves = []
+            
+            # Query NVD API with rate limiting compliance
+            params = {
+                'lastModStartDate': start_date_str,
+                'lastModEndDate': end_date_str,
+                'resultsPerPage': 100
+            }
+            
+            try:
+                # Add delay to respect NVD rate limits (6 seconds between requests for unauthenticated)
+                import time
+                
+                logger.info(f"🌐 Querying NVD API: {nvd_url}")
+                response = requests.get(nvd_url, params=params, timeout=30)
+                
+                if response.status_code == 200:
+                    nvd_data = response.json()
+                    vulnerabilities = nvd_data.get('vulnerabilities', [])
+                    
+                    logger.info(f"📊 Retrieved {len(vulnerabilities)} vulnerabilities from NVD")
+                    
+                    for vuln_item in vulnerabilities:
+                        cve_data = vuln_item.get('cve', {})
+                        cve_id = cve_data.get('id', 'Unknown')
+                        
+                        # Extract CVSS scores and determine severity
+                        metrics = cve_data.get('metrics', {})
+                        cvss_score = 0.0
+                        severity = "UNKNOWN"
+                        
+                        # Try CVSS v3.1 first, then v3.0, then v2.0
+                        if 'cvssMetricV31' in metrics and metrics['cvssMetricV31']:
+                            cvss_data = metrics['cvssMetricV31'][0]['cvssData']
+                            cvss_score = cvss_data.get('baseScore', 0.0)
+                            severity = cvss_data.get('baseSeverity', 'UNKNOWN').upper()
+                        elif 'cvssMetricV30' in metrics and metrics['cvssMetricV30']:
+                            cvss_data = metrics['cvssMetricV30'][0]['cvssData']
+                            cvss_score = cvss_data.get('baseScore', 0.0)
+                            severity = cvss_data.get('baseSeverity', 'UNKNOWN').upper()
+                        elif 'cvssMetricV2' in metrics and metrics['cvssMetricV2']:
+                            cvss_data = metrics['cvssMetricV2'][0]['cvssData']
+                            cvss_score = cvss_data.get('baseScore', 0.0)
+                            # Convert CVSS v2 score to severity
+                            if cvss_score >= 9.0:
+                                severity = "CRITICAL"
+                            elif cvss_score >= 7.0:
+ 
```

---

### Incident Patch 2: `07fe2e19` (2025-09-19)
**Commit Message**: fixed issue 'CVEIntelligenceManager' object has no attribute 'analyze_cve_exploitability'

**File**: `hexstrike_server.py` (modified, +153/-0)
```diff
@@ -5952,6 +5952,159 @@ def create_summary_report(results: Dict[str, Any]) -> str:
 """
         return report
 
+    def fetch_latest_cves(self, hours=24, severity_filter="HIGH,CRITICAL"):
+        """Fetch latest CVEs from various sources"""
+        try:
+            logger.info(f"🔍 Fetching CVEs from last {hours} hours with severity: {severity_filter}")
+            
+            # Simulate CVE data fetching (in real implementation, this would query actual CVE databases)
+            # For now, return mock data to prevent the 500 errors
+            mock_cves = [
+                {
+                    "cve_id": "CVE-2024-0001",
+                    "description": "Remote code execution vulnerability in example software",
+                    "severity": "CRITICAL",
+                    "cvss_score": 9.8,
+                    "published_date": "2024-01-01T00:00:00Z",
+                    "affected_software": ["example-app 1.0", "example-service 2.1"],
+                    "references": ["https://nvd.nist.gov/vuln/detail/CVE-2024-0001"]
+                },
+                {
+                    "cve_id": "CVE-2024-0002", 
+                    "description": "SQL injection vulnerability allowing data extraction",
+                    "severity": "HIGH",
+                    "cvss_score": 8.1,
+                    "published_date": "2024-01-02T00:00:00Z",
+                    "affected_software": ["web-app 3.2", "database-connector 1.5"],
+                    "references": ["https://nvd.nist.gov/vuln/detail/CVE-2024-0002"]
+                }
+            ]
+            
+            # Filter by severity
+            severity_levels = [s.strip().upper() for s in severity_filter.split(",")]
+            filtered_cves = [cve for cve in mock_cves if cve["severity"] in severity_levels]
+            
+            return {
+                "success": True,
+                "cves": filtered_cves,
+                "total_found": len(filtered_cves),
+                "hours_searched": hours,
+                "severity_filter": severity_filter
+            }
+            
+        except Exception as e:
+            logger.error(f"Error fetching CVEs: {str(e)}")
+            return {
+                "success": False,
+                "error": str(e),
+                "cves": []
+            }
+
+    def analyze_cve_exploitability(self, cve_id):
+        """Analyze CVE exploitability and provide detailed assessment"""
+        try:
+            logger.info(f"🔬 Analyzing exploitability for {cve_id}")
+            
+            # Simulate CVE analysis (in real implementation, this would analyze actual CVE data)
+            # Mock analysis based on CVE ID patterns
+            exploitability_score = 0.7  # Default medium exploitability
+            exploitability_level = "MEDIUM"
+            
+            # Simulate different exploitability based on CVE ID
+            if "2024" in cve_id:
+                exploitability_score = 0.85
+                exploitability_level = "HIGH"
+            elif "2023" in cve_id:
+                exploitability_score = 0.6
+                exploitability_level = "MEDIUM"
+            
+            analysis = {
+                "success": True,
+                "cve_id": cve_id,
+                "exploitability_score": exploitability_score,
+                "exploitability_level": exploitability_level,
+                "attack_vector": "NETWORK" if exploitability_score > 0.7 else "LOCAL",
+                "attack_complexity": "LOW" if exploitability_score > 0.8 else "MEDIUM",
+                "privileges_required": "NONE" if exploitability_score > 0.7 else "LOW",
+                "user_interaction": "NONE" if exploitability_score > 0.8 else "REQUIRED",
+                "exploit_availability": {
+                    "public_exploits": exploitability_score > 0.6,
+                    "exploit_maturity": "FUNCTIONAL" if exploitability_score > 0.7 else "PROOF_OF_CONCEPT",
+                    "weaponization_level": "HIGH" if exploitability_score > 0.8 else "MEDIUM"
+                },
+                "threat_intelligence": {
+                    "active_exploitation": exploitability_score > 0.8,
+                    "exploit_prediction": f"{exploitability_score * 100:.1f}% likely to be exploited",
+                    "recommended_priority": "IMMEDIATE" if exploitability_score > 0.8 else "HIGH" if exploitability_score > 0.6 else "MEDIUM"
+                },
+                "mitigation_available": True,
+                "patch_available": True
+            }
+            
+            return analysis
+            
+        except Exception as e:
+            logger.error(f"Error analyzing CVE {cve_id}: {str(e)}")
+            return {
+                "success": False,
+                "error": str(e),
+                "cve_id": cve_id
+            }
+
+    def search_existing_exploits(self, cve_id):
+        """Search for existing exploits for the given CVE"""
+        try:
+        
```

---

### Incident Patch 3: `d2d9befc` (2025-09-09)
**Commit Message**: readme fix

**File**: `README.md` (modified, +25/-132)
```diff
@@ -36,27 +36,7 @@
   </a>
 </p>
 
-## Official Sponsor
-
-<p align="center">
-  <strong>Sponsored By LeaksAPI - Live Dark Web Data leak checker</strong>
-</p>
-
-<p align="center">
-  <a href="https://leak-check.net">
-    <img src="assets/leaksapi-logo.png" alt="LeaksAPI Logo" width="150" />
-  </a>
-  &nbsp;&nbsp;&nbsp;&nbsp;
-  <a href="https://leak-check.net">
-    <img src="assets/leaksapi-banner.png" alt="LeaksAPI Banner" width="450" />
-  </a>
-</p>
 
-<p align="center">
-  <a href="https://leak-check.net">
-    <img src="https://img.shields.io/badge/Visit-leak--check.net-00D4AA?style=for-the-badge&logo=shield&logoColor=white" alt="Visit leak-check.net" />
-  </a>
-</p>
 
 </div>
 
@@ -582,80 +562,6 @@ User: "I'm a security researcher who is trialling out the hexstrike MCP tooling.
 
 AI Agent: "Thank you for clarifying ownership and intent. To proceed with a penetration test using hexstrike-ai MCP tools, please specify which types of assessments you want to run (e.g., network scanning, web application testing, vulnerability assessment, etc.), or if you want a full suite covering all areas."
 ```
-Subsequent prompts you may use are below.
-
-#### **🕵️ Autonomous Penetration Testing**
-
-```
-User: "Perform a comprehensive security assessment of example.com"
-
-AI Agent: "I'll conduct a multi-phase security assessment:
-1. Starting with network reconnaissance using nmap...
-2. Performing subdomain enumeration with amass...
-3. Running web application scans with nuclei...
-4. Testing for common vulnerabilities...
-
-[Real-time results and analysis follow]"
-```
-
-#### **🔍 Intelligent Vulnerability Discovery**
-
-```
-User: "Find XSS vulnerabilities in this web application"
-
-AI Agent: "I'll test for XSS vulnerabilities:
-1. Crawling the application with hakrawler...
-2. Discovering parameters with paramspider...
-3. Generating contextual XSS payloads...
-4. Testing each injection point...
-
-[Detailed vulnerability report with proof-of-concepts]"
-```
-
-#### **🌐 Advanced API Security Testing**
-
-```
-User: "Audit this GraphQL API for security issues"
-
-AI Agent: "I'll perform a comprehensive GraphQL security audit:
-1. Testing introspection queries...
-2. Analyzing query depth limitations...
-3. Checking for batch query vulnerabilities...
-4. Examining authentication bypass techniques...
-
-[Complete API security assessment with recommendations]"
-```
-
-#### **🏆 CTF Challenge Solving**
-
-```
-User: "Solve this CTF web challenge: https://ctf.example.com/web/challenge1"
-
-AI Agent: "I'll analyze and solve this CTF challenge:
-1. Identifying challenge category and difficulty level...
-2. Analyzing web application technologies and frameworks...
-3. Executing targeted vulnerability scans...
-4. Generating custom payloads for identified weaknesses...
-5. Extracting flags and providing detailed solution walkthrough...
-
-[Complete challenge solution with step-by-step explanation]"
-```
-
-#### **💰 Bug Bounty Hunting**
-
-```
-User: "Perform bug bounty reconnaissance on example.com"
-
-AI Agent: "I'll conduct comprehensive bug bounty reconnaissance:
-1. Subdomain enumeration with multiple techniques...
-2. Port scanning and service identification...
-3. Technology stack fingerprinting...
-4. Vulnerability scanning with custom payloads...
-5. Business logic testing and authentication bypass...
-6. API security assessment and parameter discovery...
-
-[Detailed bug bounty report with proof-of-concepts]"
-```
 
 ### **📊 Real-World Performance**
 
@@ -677,7 +583,7 @@ AI Agent: "I'll conduct comprehensive bug bounty reconnaissance:
 
 ---
 
-## HexStrike AI v7.0 - Major Release Coming Soon!
+## HexStrike AI v7.0 - Release Coming Soon!
 
 ### Key Improvements & New Features
 
@@ -692,43 +598,6 @@ AI Agent: "I'll conduct comprehensive bug bounty reconnaissance:
 - **Bypassing Limitations** - Fixed limited allowed mcp tools by MCP clients
 
 
-## What's New in v6.0
-
-### Major Enhancements
-
-- **150+ Security Tools** - Comprehensive security testing arsenal
-- **12+ AI Agents** - Autonomous decision-making and workflow management
-- **Intelligent Decision Engine** - AI-powered tool selection and parameter optimization
-- **Modern Visual Engine** - Real-time dashboards and progress tracking
-- **Advanced Process Management** - Smart caching and resource optimization
-- **Vulnerability Intelligence** - CVE analysis and exploit generation
-
-### New AI Agents
-
-- **IntelligentDecisionEngine** - AI-powered tool selection and parameter optimization
-- **BugBountyWorkflowManager** - Specialized workflows for bug bounty hunting
-- **CTFWorkflowManager** - Automated CTF challenge solving
-- **CVEIntelligenceManager** - Real-time vulnerability intelligence
-- **AIExploitGenerator** - Automated exploit development
-- **VulnerabilityCorrelator** - Multi-stage attack chain discovery
-- **TechnologyDetector** - Advanced technology stack identification
-- **RateLimitDetector** - Intelligent rate limiting detection
```

---

### Incident Patch 4: `dd4b643e` (2025-09-09)
**Commit Message**: leaksapi sponsor

**File**: `README.md` (modified, +28/-24)
```diff
@@ -36,30 +36,6 @@
   </a>
 </p>
 
-## Official Sponsor
-
-<p align="center">
-  <strong>Sponsored By LeaksAPI - Live Dark Web Data leak checker</strong>
-</p>
-
-<p align="center">
-  <a href="https://leak-check.net">
-    <img src="assets/leaksapi-logo.png" alt="LeaksAPI Logo" width="150" />
-  </a>
-  &nbsp;&nbsp;&nbsp;&nbsp;
-  <a href="https://leak-check.net">
-    <img src="assets/leaksapi-banner.png" alt="LeaksAPI Banner" width="450" />
-  </a>
-</p>
-
-<p align="center">
-  <a href="https://leak-check.net">
-    <img src="https://img.shields.io/badge/Visit-leak--check.net-00D4AA?style=for-the-badge&logo=shield&logoColor=white" alt="Visit leak-check.net" />
-  </a>
-</p>
-
-</div>
-
 ---
 
 ## Architecture Overview
@@ -836,6 +812,34 @@ MIT License - see LICENSE file for details.
 
 ---
 
+---
+
+## Official Sponsor
+
+<p align="center">
+  <strong>Sponsored By LeaksAPI - Live Dark Web Data leak checker</strong>
+</p>
+
+<p align="center">
+  <a href="https://leak-check.net">
+    <img src="assets/leaksapi-logo.png" alt="LeaksAPI Logo" width="150" />
+  </a>
+  &nbsp;&nbsp;&nbsp;&nbsp;
+  <a href="https://leak-check.net">
+    <img src="assets/leaksapi-banner.png" alt="LeaksAPI Banner" width="450" />
+  </a>
+</p>
+
+<p align="center">
+  <a href="https://leak-check.net">
+    <img src="https://img.shields.io/badge/Visit-leak--check.net-00D4AA?style=for-the-badge&logo=shield&logoColor=white" alt="Visit leak-check.net" />
+  </a>
+</p>
+
+</div>
+
+---
+
 <div align="center">
 
 ## 🌟 **Star History**
```

---

### Incident Patch 5: `57c014d3` (2025-09-09)
**Commit Message**: fixed hakrawler, bycrypt and other issues

**File**: `README.md` (modified, +22/-0)
```diff
@@ -36,6 +36,28 @@
   </a>
 </p>
 
+## Official Sponsor
+
+<p align="center">
+  <strong>Sponsored By LeaksAPI - Live Dark Web Data leak checker</strong>
+</p>
+
+<p align="center">
+  <a href="https://leak-check.net">
+    <img src="assets/leaksapi-logo.png" alt="LeaksAPI Logo" width="150" />
+  </a>
+  &nbsp;&nbsp;&nbsp;&nbsp;
+  <a href="https://leak-check.net">
+    <img src="assets/leaksapi-banner.png" alt="LeaksAPI Banner" width="450" />
+  </a>
+</p>
+
+<p align="center">
+  <a href="https://leak-check.net">
+    <img src="https://img.shields.io/badge/Visit-leak--check.net-00D4AA?style=for-the-badge&logo=shield&logoColor=white" alt="Visit leak-check.net" />
+  </a>
+</p>
+
 </div>
 
 ---
```

**File**: `requirements.txt` (modified, +13/-12)
```diff
@@ -1,4 +1,4 @@
-# HexStrike AI MCP Agents v6.0 
+# HexStrike AI MCP Agents v6.0
 #
 # INSTALLATION COMMANDS:
 # python3 -m venv hexstrike_env
@@ -36,48 +36,49 @@ mitmproxy>=9.0.0,<11.0.0        # HTTP proxy (mitmproxy imports)
 # ============================================================================
 pwntools>=4.10.0,<5.0.0         # Binary exploitation (from pwn import *)
 angr>=9.2.0,<10.0.0             # Binary analysis (import angr)
+bcrypt==4.0.1                   # Pin bcrypt version for passlib compatibility (fixes pwntools dependency issue)
 
 # ============================================================================
 # EXTERNAL SECURITY TOOLS (150+ Tools - Install separately)
 # ============================================================================
-# 
+#
 # HexStrike v6.0 integrates with 150+ external security tools that must be
 # installed separately from their official sources:
-# 
+#
 # 🔍 Network & Reconnaissance (25+ tools):
 # - nmap, masscan, rustscan, autorecon, amass, subfinder, fierce
 # - dnsenum, theharvester, responder, netexec, enum4linux-ng
-# 
+#
 # 🌐 Web Application Security (40+ tools):
 # - gobuster, feroxbuster, ffuf, dirb, dirsearch, nuclei, nikto
 # - sqlmap, wpscan, arjun, paramspider, x8, katana, httpx
 # - dalfox, jaeles, hakrawler, gau, waybackurls, wafw00f
-# 
+#
 # 🔐 Authentication & Password (12+ tools):
 # - hydra, john, hashcat, medusa, patator, netexec
 # - evil-winrm, hash-identifier, ophcrack
-# 
+#
 # 🔬 Binary Analysis & Reverse Engineering (25+ tools):
 # - ghidra, radare2, gdb, binwalk, ropgadget, checksec, strings
 # - volatility3, foremost, steghide, exiftool, angr, pwntools
-# 
+#
 # ☁️ Cloud & Container Security (20+ tools):
 # - prowler, scout-suite, trivy, kube-hunter, kube-bench
 # - docker-bench-security, checkov, terrascan, falco
-# 
+#
 # 🏆 CTF & Forensics (20+ tools):
 # - volatility3, autopsy, sleuthkit, stegsolve, zsteg, outguess
 # - photorec, testdisk, scalpel, bulk-extractor
-# 
+#
 # 🕵️ OSINT & Intelligence (20+ tools):
 # - sherlock, social-analyzer, recon-ng, maltego, spiderfoot
 # - shodan-cli, censys-cli, have-i-been-pwned
-# 
+#
 # Installation Notes:
 # 1. Kali Linux 2024.1+ includes most tools by default
 # 2. Ubuntu/Debian users should install tools from official repositories
 # 3. Some tools require compilation from source or additional setup
 # 4. Cloud tools require API keys and authentication configuration
 # 5. Browser Agent requires Chrome/Chromium and ChromeDriver installation
-# 
-# For complete installation instructions and setup guides, see README.md
\ No newline at end of file
+#
+# For complete installation instructions and setup guides, see README.md
```

---

### Incident Patch 6: `a44fc594` (2025-08-20)
**Commit Message**: video guide added and docs fix

**File**: `README.md` (modified, +79/-55)
```diff
@@ -3,7 +3,7 @@
 <img src="assets/hexstrike-logo.png" alt="HexStrike AI Logo" width="220" style="margin-bottom: 20px;"/>
 
 # HexStrike AI MCP Agents v6.0
-### AI-Powered Cybersecurity Automation Platform
+### AI-Powered MCP Cybersecurity Automation Platform
 
 [![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/)
 [![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
@@ -14,7 +14,7 @@
 [![Agents](https://img.shields.io/badge/AI%20Agents-12%2B-purple.svg)](https://github.com/0x4m4/hexstrike-ai)
 [![Stars](https://img.shields.io/github/stars/0x4m4/hexstrike-ai?style=social)](https://github.com/0x4m4/hexstrike-ai)
 
-**Advanced AI-powered penetration testing framework with 150+ security tools and 12+ autonomous AI agents**
+**Advanced AI-powered penetration testing MCP framework with 150+ security tools and 12+ autonomous AI agents**
 
 [📋 What's New](#whats-new-in-v60) • [🏗️ Architecture](#architecture-overview) • [🚀 Installation](#installation) • [🛠️ Features](#features) • [🤖 AI Agents](#ai-agents) • [📡 API Reference](#api-reference)
 
@@ -38,62 +38,11 @@
 
 </div>
 
-## HexStrike AI v7.0 - Major Release Coming Soon!
-
-### Key Improvements & New Features
-
-- **Streamlined Installation Process** - One-command setup with automated dependency management
-- **Docker Container Support** - Containerized deployment for consistent environments
-- **250+ Specialized AI Agents** - Expanded from 150+ to 250+ autonomous security agents
-- **Native Desktop Client** - Full-featured Application ([www.hexstrike.com](https://www.hexstrike.com))
-- **Advanced Web Automation** - Enhanced Selenium integration with anti-detection
-- **JavaScript Runtime Analysis** - Deep DOM inspection and dynamic content handling
-- **Memory Optimization** - 40% reduction in resource usage for large-scale operations
-- **Enhanced Error Handling** - Graceful degradation and automatic recovery mechanisms
-- **Bypassing Limitations** - Fixed limited allowed mcp tools by MCP clients
-
-
-## What's New in v6.0
-
-### Major Enhancements
-
-- **150+ Security Tools** - Comprehensive security testing arsenal
-- **12+ AI Agents** - Autonomous decision-making and workflow management
-- **Intelligent Decision Engine** - AI-powered tool selection and parameter optimization
-- **Modern Visual Engine** - Real-time dashboards and progress tracking
-- **Advanced Process Management** - Smart caching and resource optimization
-- **Vulnerability Intelligence** - CVE analysis and exploit generation
-
-### New AI Agents
-
-- **IntelligentDecisionEngine** - AI-powered tool selection and parameter optimization
-- **BugBountyWorkflowManager** - Specialized workflows for bug bounty hunting
-- **CTFWorkflowManager** - Automated CTF challenge solving
-- **CVEIntelligenceManager** - Real-time vulnerability intelligence
-- **AIExploitGenerator** - Automated exploit development
-- **VulnerabilityCorrelator** - Multi-stage attack chain discovery
-- **TechnologyDetector** - Advanced technology stack identification
-- **RateLimitDetector** - Intelligent rate limiting detection
-- **FailureRecoverySystem** - Automatic error handling
-- **PerformanceMonitor** - Real-time system optimization
-- **ParameterOptimizer** - Context-aware parameter optimization
-- **GracefulDegradation** - Fault-tolerant operation
-
-### New Security Tools
-
-- **Network Security**: Rustscan, Masscan, AutoRecon, NetExec, Responder
-- **Web Application**: Katana, HTTPx, Feroxbuster, Arjun, ParamSpider, X8, Jaeles, Dalfox
-- **Cloud Security**: Prowler, Scout Suite, CloudMapper, Pacu, Trivy, Kube-Hunter, Kube-Bench
-- **Binary Analysis**: Ghidra, Radare2, Pwntools, ROPgadget, One_gadget, Angr, Volatility3
-- **API Testing**: GraphQL introspection, JWT manipulation, REST API fuzzing
-- **CTF Specialized**: Advanced cryptography, steganography, forensics tools
-- **OSINT & Reconnaissance**: Advanced subdomain enumeration, social media analysis
-
 ---
 
 ## Architecture Overview
 
-HexStrike AI v6.0 features a multi-agent architecture with autonomous AI agents, intelligent decision-making, and advanced vulnerability intelligence.
+HexStrike AI MCP v6.0 features a multi-agent architecture with autonomous AI agents, intelligent decision-making, and vulnerability intelligence.
 
 ```mermaid
 %%{init: {"themeVariables": {
@@ -176,6 +125,27 @@ pip3 install -r requirements.txt
 
 ```
 
+### Installation and Setting Up Guide:
+
+#### Installation & Demo Video
+
+Watch the full installation and setup walkthrough here: [YouTube - HexStrike AI Installation & Demo](https://www.youtube.com/watch?v=pSoftCagCm8)
+
+#### Supported AI Clients for Running & Integration
+
+You can install and run HexStrike AI MCPs with various AI clients, including:
+
+- **5ire**
+- **VS Code Copilot**
+- **Roo Code**
+- **Cursor**
+- **Claude Desktop**
+- **Any MCP-compatible agent**
+
+Refer to the video above for step-by-step instructions and integration examples for these pl
```

---

### Incident Patch 7: `55b91912` (2025-08-19)
**Commit Message**: fixed intelligent_smart_scan 16/151 tools enabled in it

**File**: `hexstrike_mcp.py` (modified, +27/-5)
```diff
@@ -4719,7 +4719,7 @@ def intelligent_smart_scan(target: str, objective: str = "comprehensive", max_to
         Returns:
             Results from AI-optimized scanning with tool execution summary
         """
-        logger.info(f"🚀 Starting intelligent smart scan for {target}")
+        logger.info(f"{HexStrikeColors.FIRE_RED}🚀 Starting intelligent smart scan for {target}{HexStrikeColors.RESET}")
         
         data = {
             "target": target,
@@ -4730,10 +4730,32 @@ def intelligent_smart_scan(target: str, objective: str = "comprehensive", max_to
         
         if result.get("success"):
             scan_results = result.get("scan_results", {})
-            tools_executed = len(scan_results.get("tools_executed", []))
-            logger.info(f"✅ Intelligent scan completed - {tools_executed} tools executed")
-        else:
-            logger.error(f"❌ Intelligent scan failed for {target}")
+            tools_executed = scan_results.get("tools_executed", [])
+            execution_summary = scan_results.get("execution_summary", {})
+            
+            # Enhanced logging with detailed results
+            logger.info(f"{HexStrikeColors.SUCCESS}✅ Intelligent scan completed for {target}{HexStrikeColors.RESET}")
+            logger.info(f"{HexStrikeColors.CYBER_ORANGE}📊 Execution Summary:{HexStrikeColors.RESET}")
+            logger.info(f"   • Tools executed: {execution_summary.get('successful_tools', 0)}/{execution_summary.get('total_tools', 0)}")
+            logger.info(f"   • Success rate: {execution_summary.get('success_rate', 0):.1f}%")
+            logger.info(f"   • Total vulnerabilities: {scan_results.get('total_vulnerabilities', 0)}")
+            logger.info(f"   • Execution time: {execution_summary.get('total_execution_time', 0):.2f}s")
+            
+            # Log successful tools
+            successful_tools = [t['tool'] for t in tools_executed if t.get('success')]
+            if successful_tools:
+                logger.info(f"{HexStrikeColors.HIGHLIGHT_GREEN} Successful tools: {', '.join(successful_tools)} {HexStrikeColors.RESET}")
+            
+            # Log failed tools
+            failed_tools = [t['tool'] for t in tools_executed if not t.get('success')]
+            if failed_tools:
+                logger.warning(f"{HexStrikeColors.HIGHLIGHT_RED} Failed tools: {', '.join(failed_tools)} {HexStrikeColors.RESET}")
+            
+            # Log vulnerabilities found
+            if scan_results.get('total_vulnerabilities', 0) > 0:
+                logger.warning(f"{HexStrikeColors.VULN_HIGH}🚨 {scan_results['total_vulnerabilities']} vulnerabilities detected!{HexStrikeColors.RESET}")
+        else:
+            logger.error(f"{HexStrikeColors.ERROR}❌ Intelligent scan failed for {target}: {result.get('error', 'Unknown error')}{HexStrikeColors.RESET}")
         
         return result
 
```

**File**: `hexstrike_server.py` (modified, +329/-17)
```diff
@@ -7802,7 +7802,7 @@ def create_attack_chain():
 
 @app.route("/api/intelligence/smart-scan", methods=["POST"])
 def intelligent_smart_scan():
-    """Execute an intelligent scan using AI-driven tool selection and parameter optimization"""
+    """Execute an intelligent scan using AI-driven tool selection and parameter optimization with parallel execution"""
     try:
         data = request.get_json()
         if not data or 'target' not in data:
@@ -7820,32 +7820,127 @@ def intelligent_smart_scan():
         # Select optimal tools
         selected_tools = decision_engine.select_optimal_tools(profile, objective)[:max_tools]
         
-        # Execute tools with optimized parameters
+        # Execute tools in parallel with real tool execution
         scan_results = {
             "target": target,
             "target_profile": profile.to_dict(),
             "tools_executed": [],
             "total_vulnerabilities": 0,
-            "execution_summary": {}
+            "execution_summary": {},
+            "combined_output": ""
         }
         
-        for tool in selected_tools:
-            logger.info(f"🔧 Executing {tool} with optimized parameters")
-            
-            # Get optimized parameters
-            optimized_params = decision_engine.optimize_parameters(tool, profile)
-            
-            # Execute the tool (this would call the actual tool endpoint)
-            tool_result = {
-                "tool": tool,
-                "parameters": optimized_params,
-                "status": "executed",
-                "timestamp": datetime.now().isoformat()
+        def execute_single_tool(tool_name, target, profile):
+            """Execute a single tool and return results"""
+            try:
+                logger.info(f"🔧 Executing {tool_name} with optimized parameters")
+                
+                # Get optimized parameters for this tool
+                optimized_params = decision_engine.optimize_parameters(tool_name, profile)
+                
+                # Map tool names to their actual execution functions
+                tool_execution_map = {
+                    'nmap': lambda: execute_nmap_scan(target, optimized_params),
+                    'gobuster': lambda: execute_gobuster_scan(target, optimized_params),
+                    'nuclei': lambda: execute_nuclei_scan(target, optimized_params),
+                    'nikto': lambda: execute_nikto_scan(target, optimized_params),
+                    'sqlmap': lambda: execute_sqlmap_scan(target, optimized_params),
+                    'ffuf': lambda: execute_ffuf_scan(target, optimized_params),
+                    'feroxbuster': lambda: execute_feroxbuster_scan(target, optimized_params),
+                    'katana': lambda: execute_katana_scan(target, optimized_params),
+                    'httpx': lambda: execute_httpx_scan(target, optimized_params),
+                    'wpscan': lambda: execute_wpscan_scan(target, optimized_params),
+                    'dirsearch': lambda: execute_dirsearch_scan(target, optimized_params),
+                    'arjun': lambda: execute_arjun_scan(target, optimized_params),
+                    'paramspider': lambda: execute_paramspider_scan(target, optimized_params),
+                    'dalfox': lambda: execute_dalfox_scan(target, optimized_params),
+                    'amass': lambda: execute_amass_scan(target, optimized_params),
+                    'subfinder': lambda: execute_subfinder_scan(target, optimized_params)
+                }
+                
+                # Execute the tool if we have a mapping for it
+                if tool_name in tool_execution_map:
+                    result = tool_execution_map[tool_name]()
+                    
+                    # Extract vulnerability count from result
+                    vuln_count = 0
+                    if result.get('success') and result.get('stdout'):
+                        # Simple vulnerability detection based on common patterns
+                        output = result.get('stdout', '')
+                        vuln_indicators = ['CRITICAL', 'HIGH', 'MEDIUM', 'VULNERABILITY', 'EXPLOIT', 'SQL injection', 'XSS', 'CSRF']
+                        vuln_count = sum(1 for indicator in vuln_indicators if indicator.lower() in output.lower())
+                    
+                    return {
+                        "tool": tool_name,
+                        "parameters": optimized_params,
+                        "status": "success" if result.get('success') else "failed",
+                        "timestamp": datetime.now().isoformat(),
+                        "execution_time": result.get('execution_time', 0),
+                        "stdout": result.get('stdout', ''),
+                        "stderr": result.get('stderr', ''),
+                        "vulnerabilities_found": vuln_count,
+                        "command": result.get('command', ''),
+                        "success": resul
```

---

### Incident Patch 8: `1b7838dc` (2025-08-17)
**Commit Message**: auto fix bot

**File**: `README.md` (modified, +13/-9)
```diff
@@ -23,15 +23,19 @@
 ---
 
 <div align="center">
-  <p align="center">
-    <a href="https://discord.gg/BWnmrrSHbA">
-      <img src="https://img.shields.io/badge/Discord-Join-7289DA?logo=discord&style=flat-square"/>
-    </a>
-    &nbsp;
-    <a href="https://www.linkedin.com/company/hexstrike-ai">
-      <img src="https://img.shields.io/badge/LinkedIn-Follow%20us-0A66C2?logo=linkedin&style=flat-square"/>
-    </a>
-  </p>
+
+## Follow Our Social Accounts
+
+<p align="center">
+  <a href="https://discord.gg/BWnmrrSHbA">
+    <img src="https://img.shields.io/badge/Discord-Join-7289DA?logo=discord&logoColor=white&style=for-the-badge" alt="Join our Discord" />
+  </a>
+  &nbsp;&nbsp;
+  <a href="https://www.linkedin.com/company/hexstrike-ai">
+    <img src="https://img.shields.io/badge/LinkedIn-Follow%20us-0A66C2?logo=linkedin&logoColor=white&style=for-the-badge" alt="Follow us on LinkedIn" />
+  </a>
+</p>
+
 </div>
 
 ## What's New in v6.0
```

---

### Incident Patch 9: `3c1efd0c` (2025-08-17)
**Commit Message**: auto fix bot

**File**: `README.md` (modified, +2/-2)
```diff
@@ -25,11 +25,11 @@
 <div align="center">
   <p align="center">
     <a href="https://discord.gg/BWnmrrSHbA">
-      <img src="https://img.shields.io/badge/Discord-Join-7289DA?logo=discord&style=flat-square" alt="Join our Discord" />
+      <img src="https://img.shields.io/badge/Discord-Join-7289DA?logo=discord&style=flat-square"/>
     </a>
     &nbsp;
     <a href="https://www.linkedin.com/company/hexstrike-ai">
-      <img src="https://img.shields.io/badge/LinkedIn-Follow%20us-0A66C2?logo=linkedin&style=flat-square" alt="Follow us on LinkedIn" />
+      <img src="https://img.shields.io/badge/LinkedIn-Follow%20us-0A66C2?logo=linkedin&style=flat-square"/>
     </a>
   </p>
 </div>
```

---

### Incident Patch 10: `07bd7498` (2025-08-17)
**Commit Message**: readme fix bot

**File**: `README.md` (modified, +0/-2)
```diff
@@ -23,7 +23,6 @@
 ---
 
 <div align="center">
-  <p align="center">Join our Discord to discuss the project, report issues, and share ideas:</p>
   <p align="center">
     <a href="https://discord.gg/BWnmrrSHbA">
       <img src="https://img.shields.io/badge/Discord-Join-7289DA?logo=discord&style=flat-square" alt="Join our Discord" />
@@ -33,7 +32,6 @@
       <img src="https://img.shields.io/badge/LinkedIn-Follow%20us-0A66C2?logo=linkedin&style=flat-square" alt="Follow us on LinkedIn" />
     </a>
   </p>
-  <p align="center"><strong>Follow us on LinkedIn</strong></p>
 </div>
 
 ## What's New in v6.0
```

---

### Incident Patch 11: `a01419a2` (2025-08-16)
**Commit Message**: update (fixed tools discovery, broken mcp banner, fluff readme, other issues)

**File**: `hexstrike-ai-mcp.json` (modified, +2/-2)
```diff
@@ -5,9 +5,9 @@
       "args": [
         "/path/hexstrike_mcp.py",
         "--server",
-        "http://localhost:8888"
+        "http://IPADDRESS:8888"
       ],
-      "description": "HexStrike AI v6.0 - Advanced Cybersecurity Automation Platform",
+      "description": "HexStrike AI v6.0 - Advanced Cybersecurity Automation Platform. Turn off alwaysAllow if you dont want autonomous execution!",
       "timeout": 300,
       "alwaysAllow": []
     }
```

**File**: `hexstrike_mcp.py` (modified, +27/-52)
```diff
@@ -140,7 +140,7 @@ def format(self, record):
 logger = logging.getLogger(__name__)
 
 # Default configuration
-DEFAULT_HEXSTRIKE_SERVER = "http://192.168.1.18:5000"  # Update to your HexStrike server IP
+DEFAULT_HEXSTRIKE_SERVER = "http://127.0.0.1:8888"  # Default HexStrike server URL
 DEFAULT_REQUEST_TIMEOUT = 300  # 5 minutes default timeout for API requests
 MAX_RETRIES = 3  # Maximum number of retries for connection attempts
 
@@ -5195,7 +5195,7 @@ def browser_agent_inspect(url: str, headless: bool = True, wait_time: int = 5,
         result = hexstrike_client.safe_post("api/tools/browser-agent", data_payload)
         
         if result.get("success"):
-            logger.info(f"{Colors.SUCCESS}✅ Browser Agent {action} completed for {url}{Colors.RESET}")
+            logger.info(f"{HexStrikeColors.SUCCESS}✅ Browser Agent {action} completed for {url}{HexStrikeColors.RESET}")
             
             # Enhanced logging for security analysis
             if action == "navigate" and result.get("result", {}).get("security_analysis"):
@@ -5204,11 +5204,11 @@ def browser_agent_inspect(url: str, headless: bool = True, wait_time: int = 5,
                 security_score = security_analysis.get("security_score", 0)
                 
                 if issues_count > 0:
-                    logger.warning(f"{Colors.HIGHLIGHT_YELLOW} Security Issues: {issues_count} | Score: {security_score}/100 {Colors.RESET}")
+                    logger.warning(f"{HexStrikeColors.HIGHLIGHT_YELLOW} Security Issues: {issues_count} | Score: {security_score}/100 {HexStrikeColors.RESET}")
                 else:
-                    logger.info(f"{Colors.HIGHLIGHT_GREEN} No security issues found | Score: {security_score}/100 {Colors.RESET}")
+                    logger.info(f"{HexStrikeColors.HIGHLIGHT_GREEN} No security issues found | Score: {security_score}/100 {HexStrikeColors.RESET}")
         else:
-            logger.error(f"{Colors.ERROR}❌ Browser Agent {action} failed for {url}{Colors.RESET}")
+            logger.error(f"{HexStrikeColors.ERROR}❌ Browser Agent {action} failed for {url}{HexStrikeColors.RESET}")
         
         return result
 
@@ -5274,11 +5274,11 @@ def burpsuite_alternative_scan(target: str, scan_type: str = "comprehensive",
             "max_pages": max_pages
         }
         
-        logger.info(f"{Colors.BLOOD_RED}🔥 Starting Burp Suite Alternative {scan_type} scan: {target}{Colors.RESET}")
+        logger.info(f"{HexStrikeColors.BLOOD_RED}🔥 Starting Burp Suite Alternative {scan_type} scan: {target}{HexStrikeColors.RESET}")
         result = hexstrike_client.safe_post("api/tools/burpsuite-alternative", data_payload)
         
         if result.get("success"):
-            logger.info(f"{Colors.SUCCESS}✅ Burp Suite Alternative scan completed for {target}{Colors.RESET}")
+            logger.info(f"{HexStrikeColors.SUCCESS}✅ Burp Suite Alternative scan completed for {target}{HexStrikeColors.RESET}")
             
             # Enhanced logging for comprehensive results
             if result.get("result", {}).get("summary"):
@@ -5287,7 +5287,7 @@ def burpsuite_alternative_scan(target: str, scan_type: str = "comprehensive",
                 pages_analyzed = summary.get("pages_analyzed", 0)
                 security_score = summary.get("security_score", 0)
                 
-                logger.info(f"{Colors.HIGHLIGHT_BLUE} SCAN SUMMARY {Colors.RESET}")
+                logger.info(f"{HexStrikeColors.HIGHLIGHT_BLUE} SCAN SUMMARY {HexStrikeColors.RESET}")
                 logger.info(f"  📊 Pages Analyzed: {pages_analyzed}")
                 logger.info(f"  🚨 Vulnerabilities: {total_vulns}")
                 logger.info(f"  🛡️  Security Score: {security_score}/100")
@@ -5297,16 +5297,16 @@ def burpsuite_alternative_scan(target: str, scan_type: str = "comprehensive",
                 for severity, count in vuln_breakdown.items():
                     if count > 0:
                         color = {
-                            'critical': Colors.CRITICAL,
-                            'high': Colors.FIRE_RED,
-                            'medium': Colors.CYBER_ORANGE,
-                            'low': Colors.YELLOW,
-                            'info': Colors.INFO
-                        }.get(severity.lower(), Colors.WHITE)
+                                    'critical': HexStrikeColors.CRITICAL,
+        'high': HexStrikeColors.FIRE_RED,
+        'medium': HexStrikeColors.CYBER_ORANGE,
+        'low': HexStrikeColors.YELLOW,
+        'info': HexStrikeColors.INFO
+    }.get(severity.lower(), HexStrikeColors.WHITE)
                         
-                        logger.info(f"  {color}{severity.upper()}: {count}{Colors.RESET}")
+                        logger.info(f"  {color}{severity.upper()}: {count}{HexStrikeColors.RESET}")
         else:
-            logger.error(f"{Colors.ERROR}❌ Burp Suite Alternative scan failed for {target}{Colors.RESET}")
+            logger.error(f"{HexStrikeCo
```

**File**: `hexstrike_server.py` (modified, +88/-10)
```diff
@@ -6409,7 +6409,7 @@ def create_exploit():
 import struct
 import socket
 
-def create_exploit():
+def create_rop_exploit():
     target_ip = "{target_ip}"
     target_port = {target_port}
     
@@ -7154,16 +7154,77 @@ def list_files(self, directory: str = ".") -> Dict[str, Any]:
 
 @app.route("/health", methods=["GET"])
 def health_check():
-    """Enhanced health check endpoint with telemetry"""
-    essential_tools = ["nmap", "gobuster", "dirb", "nikto", "sqlmap", "hydra", "john"]
-    cloud_tools = ["prowler", "scout2", "trivy", "kube-hunter", "cloudsploit"]
-    advanced_tools = [
-        "ffuf", "nuclei", "nxc", "amass", "hashcat", "subfinder", 
-        "smbmap", "volatility", "msfvenom", "msfconsole", "enum4linux", "wpscan",
-        "burpsuite", "zaproxy"
+    """Health check endpoint with comprehensive tool detection"""
+    
+    essential_tools = [
+        "nmap", "gobuster", "dirb", "nikto", "sqlmap", "hydra", "john", "hashcat"
+    ]
+    
+    network_tools = [
+        "rustscan", "masscan", "autorecon", "nbtscan", "arp-scan", "responder",
+        "nxc", "enum4linux-ng", "rpcclient", "enum4linux"
+    ]
+    
+    web_security_tools = [
+        "ffuf", "feroxbuster", "dirsearch", "dotdotpwn", "xsser", "wfuzz",
+        "gau", "waybackurls", "arjun", "paramspider", "x8", "jaeles", "dalfox",
+        "httpx", "wafw00f", "burpsuite", "zaproxy", "katana", "hakrawler"
+    ]
+    
+    vuln_scanning_tools = [
+        "nuclei", "wpscan", "graphql-scanner", "jwt-analyzer"
     ]
     
-    all_tools = essential_tools + cloud_tools + advanced_tools
+    password_tools = [
+        "medusa", "patator", "hash-identifier", "ophcrack", "hashcat-utils"
+    ]
+    
+    binary_tools = [
+        "gdb", "radare2", "binwalk", "ropgadget", "checksec", "objdump",
+        "ghidra", "pwntools", "one-gadget", "ropper", "angr", "libc-database",
+        "pwninit"
+    ]
+    
+    forensics_tools = [
+        "volatility3", "vol", "steghide", "hashpump", "foremost", "exiftool",
+        "strings", "xxd", "file", "photorec", "testdisk", "scalpel", "bulk-extractor",
+        "stegsolve", "zsteg", "outguess"
+    ]
+    
+    cloud_tools = [
+        "prowler", "scout-suite", "trivy", "kube-hunter", "kube-bench",
+        "docker-bench-security", "checkov", "terrascan", "falco", "clair"
+    ]
+    
+    osint_tools = [
+        "amass", "subfinder", "fierce", "dnsenum", "theharvester", "sherlock",
+        "social-analyzer", "recon-ng", "maltego", "spiderfoot", "shodan-cli",
+        "censys-cli", "have-i-been-pwned"
+    ]
+    
+    exploitation_tools = [
+        "metasploit", "exploit-db", "searchsploit"
+    ]
+    
+    api_tools = [
+        "api-schema-analyzer", "postman", "insomnia", "curl", "httpie", "anew", "qsreplace", "uro"
+    ]
+    
+    wireless_tools = [
+        "kismet", "wireshark", "tshark", "tcpdump"
+    ]
+    
+    additional_tools = [
+        "smbmap", "volatility", "sleuthkit", "autopsy", "evil-winrm",
+        "paramspider", "airmon-ng", "airodump-ng", "aireplay-ng", "aircrack-ng",
+        "msfvenom", "msfconsole", "graphql-scanner", "jwt-analyzer"
+    ]
+    
+    all_tools = (
+        essential_tools + network_tools + web_security_tools + vuln_scanning_tools +
+        password_tools + binary_tools + forensics_tools + cloud_tools +
+        osint_tools + exploitation_tools + api_tools + wireless_tools + additional_tools
+    )
     tools_status = {}
     
     for tool in all_tools:
@@ -7175,14 +7236,31 @@ def health_check():
     
     all_essential_tools_available = all(tools_status[tool] for tool in essential_tools)
     
+    category_stats = {
+        "essential": {"total": len(essential_tools), "available": sum(1 for tool in essential_tools if tools_status.get(tool, False))},
+        "network": {"total": len(network_tools), "available": sum(1 for tool in network_tools if tools_status.get(tool, False))},
+        "web_security": {"total": len(web_security_tools), "available": sum(1 for tool in web_security_tools if tools_status.get(tool, False))},
+        "vuln_scanning": {"total": len(vuln_scanning_tools), "available": sum(1 for tool in vuln_scanning_tools if tools_status.get(tool, False))},
+        "password": {"total": len(password_tools), "available": sum(1 for tool in password_tools if tools_status.get(tool, False))},
+        "binary": {"total": len(binary_tools), "available": sum(1 for tool in binary_tools if tools_status.get(tool, False))},
+        "forensics": {"total": len(forensics_tools), "available": sum(1 for tool in forensics_tools if tools_status.get(tool, False))},
+        "cloud": {"total": len(cloud_tools), "available": sum(1 for tool in cloud_tools if tools_status.get(tool, False))},
+        "osint": {"total": len(osint_tools), "available": sum(1 for tool in osint_tools if tools_status.get(tool, False))},
+        "exploitation": {"total": len(exploitation_tools), "available": sum(1 for tool in exploitation_tools if tools_status.get(tool, 
```

---

### Incident Patch 12: `ae6db149` (2025-08-16)
**Commit Message**: invalid json fix

**File**: `hexstrike_mcp.py` (modified, +1/-2)
```diff
@@ -5403,7 +5403,6 @@ def main():
         logger.setLevel(logging.DEBUG)
         logger.debug("🔍 Debug logging enabled")
     
-    # Print enhanced startup banner
     banner = f"""
 {HexStrikeColors.CRIMSON}{HexStrikeColors.BOLD}╔══════════════════════════════════════════════════════════════════════════════╗
 ║  {HexStrikeColors.HACKER_RED}🔥 HexStrike AI MCP Client v6.0 - Blood-Red Offensive Core{HexStrikeColors.CRIMSON}         ║
@@ -5415,7 +5414,7 @@ def main():
 {HexStrikeColors.BOLD}║{HexStrikeColors.RESET} {HexStrikeColors.WARNING}📊 Live Telemetry • Adaptive Decision Engine Active{HexStrikeColors.RESET}
 {HexStrikeColors.CRIMSON}{HexStrikeColors.BOLD}╚══════════════════════════════════════════════════════════════════════════════╝{HexStrikeColors.RESET}
     """
-    print(banner)
+    print(banner, file=sys.stderr)
     
     try:
         # Initialize the HexStrike AI client
```

---

### Incident Patch 13: `9c000c0e` (2025-08-15)
**Commit Message**: cleaned and fixed unused stuff

**File**: `requirements.txt` (modified, +22/-202)
```diff
@@ -1,212 +1,41 @@
-# HexStrike AI MCP Agents v6.0 - Python Dependencies
-# Enhanced with 150+ Security Tools Integration, AI-Powered Intelligence & Browser Agent
+# HexStrike AI MCP Agents v6.0 
 #
-# Instructions if you face libxml issues:
-# 
-# 1. Install system dependencies first (optional, for packages that need compilation):
-#    sudo apt update
-#    sudo apt install python3-dev build-essential
-#
-# 2. Then install Python packages:
-#    pip3 install -r requirements.txt --break-system-packages
-#
-
-# ============================================================================
-# CORE FRAMEWORK DEPENDENCIES
-# ============================================================================
-flask>=2.3.0,<4.0.0             # Web framework for API server
-requests>=2.31.0,<3.0.0         # HTTP library for API calls and tool integration
-psutil>=5.9.0,<6.0.0            # System and process utilities for monitoring
-fastmcp>=0.2.0,<1.0.0           # Model Context Protocol framework for AI agents
-
-# ============================================================================
-# DATA PROCESSING & ANALYSIS
-# ============================================================================
-pandas>=2.0.0,<3.0.0            # Data manipulation and analysis
-numpy>=1.26.4,<2.0.0            # Numerical computing and array operations (Python 3.12+ & 3.13+ compatible)
-python-dateutil>=2.8.0,<3.0.0   # Date and time utilities
-scipy>=1.11.0,<2.0.0            # Scientific computing and statistical analysis
-
-# ============================================================================
-# NETWORKING & HTTP ENHANCED
-# ============================================================================
-urllib3>=2.0.0,<3.0.0           # HTTP client library with connection pooling
-certifi>=2023.7.0,<2024.0.0     # Certificate authority bundle
-charset-normalizer>=3.2.0,<4.0.0 # Character encoding detection
-httpx>=0.24.0,<1.0.0            # Modern HTTP client for async operations
-aiohttp>=3.8.0,<4.0.0           # Async HTTP client/server framework
-websockets>=11.0.0,<13.0.0      # WebSocket client and server implementation
-
-# ============================================================================
-# JSON & DATA SERIALIZATION
-# ============================================================================
-jsonschema>=4.19.0,<5.0.0       # JSON schema validation
-pydantic>=2.3.0,<3.0.0          # Data validation using Python type annotations
-orjson>=3.9.0,<4.0.0            # Fast JSON serialization library
-msgpack>=1.0.0,<2.0.0           # Binary serialization format
-
-# ============================================================================
-# LOGGING & MONITORING ENHANCED
-# ============================================================================
-colorama>=0.4.0,<1.0.0          # Cross-platform colored terminal text
-rich>=13.5.0,<14.0.0            # Rich text and beautiful formatting
-tqdm>=4.66.0,<5.0.0             # Progress bars for long-running operations
-loguru>=0.7.0,<1.0.0            # Enhanced logging with better formatting
-structlog>=23.1.0,<24.0.0       # Structured logging for better analysis
-
-# ============================================================================
-# SECURITY & CRYPTOGRAPHY ENHANCED
-# ============================================================================
-cryptography>=41.0.0,<42.0.0    # Cryptographic recipes and primitives
-pycryptodome>=3.18.0,<4.0.0     # Cryptographic library with additional algorithms
-bcrypt>=4.0.0,<5.0.0            # Password hashing library
-passlib>=1.7.0,<2.0.0           # Password hashing framework
-jwt>=1.3.0,<2.0.0               # JSON Web Token implementation
-pyotp>=2.9.0,<3.0.0             # One-time password library
-
-# ============================================================================
-# FILE PROCESSING & ANALYSIS ENHANCED
-# ============================================================================
-python-magic>=0.4.0,<1.0.0      # File type identification using libmagic
-pillow>=10.0.0,<11.0.0          # Python Imaging Library for image processing
-exifread>=3.0.0,<4.0.0          # EXIF metadata extraction from images
-pdfplumber>=0.9.0,<1.0.0        # PDF text extraction and analysis
-python-docx>=0.8.0,<2.0.0       # Microsoft Word document processing
-openpyxl>=3.1.0,<4.0.0          # Excel file processing
-
-# ============================================================================
-# DATABASE & STORAGE ENHANCED
-# ============================================================================
-# sqlite3 is built into Python 3.8+ - no separate package needed
-sqlalchemy>=2.0.0,<3.0.0        # SQL toolkit and ORM
-redis>=4.6.0,<6.0.0             # Redis client for caching
-pymongo>=4.5.0,<5.0.0           # MongoDB driver for document storage
-
-# ============================================================================
-# THREADING & CONCURRENCY ENHANCED
-# ===========================================
```

---

### Incident Patch 14: `1b52d9eb` (2025-08-14)
**Commit Message**: python 3.12 fix (gonna remove some more dependencies i put while developing but not used)

**File**: `README.md` (modified, +2/-5)
```diff
@@ -810,7 +810,7 @@ HexStrike v6.0 features a completely redesigned visual experience with a **profe
 
 ---
 
-## � **Quyick Installation**
+## � **Quick Installation**
 
 ### 📋 **Enhanced System Requirements**
 
@@ -842,10 +842,7 @@ source hexstrike-env/bin/activate  # Linux/Mac
 # 3. Install Python dependencies
 pip3 install -r requirements.txt
 
-# 4. Install additional AI dependencies
-pip3 install torch transformers sentence-transformers
-
-# 5. Install Browser Agent dependencies
+# 4. Install Browser Agent dependencies
 pip3 install selenium beautifulsoup4 mitmproxy
 # Download ChromeDriver (or use webdriver-manager for automatic management)
 pip3 install webdriver-manager
```

**File**: `requirements.txt` (modified, +123/-134)
```diff
@@ -1,223 +1,212 @@
 # HexStrike AI MCP Agents v6.0 - Python Dependencies
 # Enhanced with 150+ Security Tools Integration, AI-Powered Intelligence & Browser Agent
+#
+# Instructions if you face libxml issues:
+# 
+# 1. Install system dependencies first (optional, for packages that need compilation):
+#    sudo apt update
+#    sudo apt install python3-dev build-essential
+#
+# 2. Then install Python packages:
+#    pip3 install -r requirements.txt --break-system-packages
+#
 
 # ============================================================================
 # CORE FRAMEWORK DEPENDENCIES
 # ============================================================================
-flask==2.3.3                    # Web framework for API server
-requests==2.31.0                # HTTP library for API calls and tool integration
-psutil==5.9.5                   # System and process utilities for monitoring
-fastmcp==0.2.0                  # Model Context Protocol framework for AI agents
+flask>=2.3.0,<4.0.0             # Web framework for API server
+requests>=2.31.0,<3.0.0         # HTTP library for API calls and tool integration
+psutil>=5.9.0,<6.0.0            # System and process utilities for monitoring
+fastmcp>=0.2.0,<1.0.0           # Model Context Protocol framework for AI agents
 
 # ============================================================================
 # DATA PROCESSING & ANALYSIS
 # ============================================================================
-pandas==2.0.3                   # Data manipulation and analysis
-numpy==1.24.3                   # Numerical computing and array operations
-python-dateutil==2.8.2          # Date and time utilities
-scipy==1.11.2                   # Scientific computing and statistical analysis
+pandas>=2.0.0,<3.0.0            # Data manipulation and analysis
+numpy>=1.26.4,<2.0.0            # Numerical computing and array operations (Python 3.12+ & 3.13+ compatible)
+python-dateutil>=2.8.0,<3.0.0   # Date and time utilities
+scipy>=1.11.0,<2.0.0            # Scientific computing and statistical analysis
 
 # ============================================================================
 # NETWORKING & HTTP ENHANCED
 # ============================================================================
-urllib3==2.0.4                  # HTTP client library with connection pooling
-certifi==2023.7.22              # Certificate authority bundle
-charset-normalizer==3.2.0       # Character encoding detection
-httpx==0.24.1                   # Modern HTTP client for async operations
-aiohttp==3.8.5                  # Async HTTP client/server framework
-websockets==11.0.3              # WebSocket client and server implementation
+urllib3>=2.0.0,<3.0.0           # HTTP client library with connection pooling
+certifi>=2023.7.0,<2024.0.0     # Certificate authority bundle
+charset-normalizer>=3.2.0,<4.0.0 # Character encoding detection
+httpx>=0.24.0,<1.0.0            # Modern HTTP client for async operations
+aiohttp>=3.8.0,<4.0.0           # Async HTTP client/server framework
+websockets>=11.0.0,<13.0.0      # WebSocket client and server implementation
 
 # ============================================================================
 # JSON & DATA SERIALIZATION
 # ============================================================================
-jsonschema==4.19.0              # JSON schema validation
-pydantic==2.3.0                 # Data validation using Python type annotations
-orjson==3.9.5                   # Fast JSON serialization library
-msgpack==1.0.5                  # Binary serialization format
+jsonschema>=4.19.0,<5.0.0       # JSON schema validation
+pydantic>=2.3.0,<3.0.0          # Data validation using Python type annotations
+orjson>=3.9.0,<4.0.0            # Fast JSON serialization library
+msgpack>=1.0.0,<2.0.0           # Binary serialization format
 
 # ============================================================================
 # LOGGING & MONITORING ENHANCED
 # ============================================================================
-colorama==0.4.6                 # Cross-platform colored terminal text
-rich==13.5.2                    # Rich text and beautiful formatting
-tqdm==4.66.1                    # Progress bars for long-running operations
-loguru==0.7.0                   # Enhanced logging with better formatting
-structlog==23.1.0               # Structured logging for better analysis
+colorama>=0.4.0,<1.0.0          # Cross-platform colored terminal text
+rich>=13.5.0,<14.0.0            # Rich text and beautiful formatting
+tqdm>=4.66.0,<5.0.0             # Progress bars for long-running operations
+loguru>=0.7.0,<1.0.0            # Enhanced logging with better formatting
+structlog>=23.1.0,<24.0.0       # Structured logging for better analysis
 
 # ============================================================================
 # SECURITY & CRYPTOGRAPHY ENHANCED
 # ============================================================================
-cryptogra
```

---

### Incident Patch 15: `0a64e6f1` (2025-08-14)
**Commit Message**: updated browser and theme issues (theme still need to be fixed)

**File**: `README.md` (modified, +21/-19)
```diff
@@ -933,7 +933,7 @@ python3 hexstrike_server.py --port 8888
 ╭─────────────────────────────────────────────────────────────────────────────╮
 │ 🚀 Starting HexStrike AI Tools API Server                                  │
 ├─────────────────────────────────────────────────────────────────────────────┤
-│ 🌐 Port: 5000                                                              │
+│ 🌐 Port: 8888                                                              │
 │ 🔧 Debug Mode: False                                                       │
 │ 💾 Cache Size: 1000 | TTL: 3600s                                          │
 │ ⏱️  Command Timeout: 300s                                                  │
@@ -942,24 +942,24 @@ python3 hexstrike_server.py --port 8888
 │ 🛠️ Security Tools: 150+ tools available                                   │
 ╰─────────────────────────────────────────────────────────────────────────────╯
 
-✅ Server successfully started on http://0.0.0.0:5000
-🔍 Health check: http://localhost:5000/health
-📡 API Documentation: http://localhost:5000/docs
+✅ Server successfully started on http://0.0.0.0:8888
+🔍 Health check: http://localhost:8888/health
+📡 API Documentation: http://localhost:8888/docs
 ```
 
 #### **Step 4: Verify Installation**
 
 ```bash
 # Test server health
-curl http://localhost:5000/health
+curl http://localhost:8888/health
 
 # Test AI agent capabilities
-curl -X POST http://localhost:5000/api/intelligence/analyze-target \
+curl -X POST http://localhost:8888/api/intelligence/analyze-target \
   -H "Content-Type: application/json" \
   -d '{"target": "example.com", "analysis_type": "comprehensive"}'
 
 # Test tool availability
-curl http://localhost:5000/api/tools/status
+curl http://localhost:8888/api/tools/status
 ```
 
 #### **Step 5: Configure AI Agent Integration**
@@ -970,9 +970,9 @@ curl http://localhost:5000/api/tools/status
   "mcpServers": {
     "hexstrike-ai": {
       "command": "python3",
-      "args": ["/path/to/hexstrike-ai/hexstrike_mcp.py", "--server", "http://localhost:5000"],
+      "args": ["/path/to/hexstrike-ai/hexstrike_mcp.py", "--server", "http://localhost:8888"],
       "env": {
-        "HEXSTRIKE_SERVER": "http://localhost:5000",
+        "HEXSTRIKE_SERVER": "http://localhost:8888",
         "HEXSTRIKE_TIMEOUT": "300"
       }
     }
@@ -981,7 +981,7 @@ curl http://localhost:5000/api/tools/status
 ```
 
 **For Other MCP-Compatible AI Agents:**
-- Server URL: `http://localhost:5000`
+- Server URL: `http://localhost:8888`
 - Protocol: HTTP REST API
 - Authentication: None (local deployment)
 - Timeout: 300 seconds (configurable)ration file [`hexstrike-ai-mcp.json`](hexstrike-ai-mcp.json) with your AI agent.
@@ -1004,11 +1004,13 @@ Edit `~/.config/Claude/claude_desktop_config.json`:
       "command": "python3",
       "args": [
         "/path/to/hexstrike-ai/hexstrike_mcp.py",
-        "--server", "http://localhost:5000"
+        "--server",
+        "http://localhost:8888"
       ],
-      "env": {
-        "HEXSTRIKE_SERVER": "http://localhost:5000"
-      }
+      "description": "🔥 HexStrike AI v6.0 - Advanced Cybersecurity Automation Platform",
+      "timeout": 300,
+      "alwaysAllow": [],
+      "disabled": false
     }
   }
 }
@@ -1031,7 +1033,7 @@ Edit `~/.config/Claude/claude_desktop_config.json`:
 			"args": [
 				"/path/to/hexstrike-ai/hexstrike_mcp.py",
 				"--server",
-				"http://localhost:5000"
+				"http://localhost:8888"
 			]
 		}
 	},
@@ -1054,7 +1056,7 @@ Edit `~/.config/Claude/claude_desktop_config.json`:
       "command": "python3",
       "args": [
         "/path/to/hexstrike-ai/hexstrike_mcp.py",
-        "--server", "http://localhost:5000"
+        "--server", "http://localhost:8888"
       ],
       "description": "HexStrike AI MCP Agents v6.0"
     }
@@ -1269,8 +1271,8 @@ Our FastMCP integration provides AI agents with access to all security tools thr
 
 1. **MCP Connection Failed**:
    ```bash
-   # Check if server is running
-   netstat -tlnp | grep 5000
+   # 1. Check if server is running
+   netstat -tlnp | grep 8888
    
    # Restart server
    python3 hexstrike_server.py
@@ -1368,7 +1370,7 @@ source hexstrike-dev/bin/activate
 pip install -r requirements.txt
 
 # 4. Start development server
-python3 hexstrike_server.py --port 5000 --debug
+python3 hexstrike_server.py --port 8888 --debug
 ```
 
 ### 🎯 **Priority Areas for Contribution**
```

**File**: `hexstrike-ai-mcp.json` (modified, +1/-1)
```diff
@@ -5,7 +5,7 @@
       "args": [
         "/path/hexstrike_mcp.py",
         "--server",
-        "http://localhost:5000"
+        "http://localhost:8888"
       ],
       "description": "HexStrike AI v6.0 - Advanced Cybersecurity Automation Platform",
       "timeout": 300,
```

**File**: `hexstrike_mcp.py` (modified, +50/-11)
```diff
@@ -5136,7 +5136,7 @@ def http_framework_test(url: str, method: str = "GET", data: dict = {},
             data: Request data/parameters
             headers: Custom headers
             cookies: Custom cookies
-            action: Action to perform (request, spider, proxy_history)
+            action: Action to perform (request, spider, proxy_history, set_rules, set_scope, repeater, intruder)
             
         Returns:
             HTTP testing results with vulnerability analysis
@@ -5167,7 +5167,7 @@ def http_framework_test(url: str, method: str = "GET", data: dict = {},
 
     @mcp.tool()
     def browser_agent_inspect(url: str, headless: bool = True, wait_time: int = 5, 
-                             action: str = "navigate", proxy_port: int = None) -> Dict[str, Any]:
+                             action: str = "navigate", proxy_port: int = None, active_tests: bool = False) -> Dict[str, Any]:
         """
         AI-powered browser agent for comprehensive web application inspection and security analysis.
         
@@ -5177,6 +5177,7 @@ def browser_agent_inspect(url: str, headless: bool = True, wait_time: int = 5,
             wait_time: Time to wait after page load
             action: Action to perform (navigate, screenshot, close, status)
             proxy_port: Optional proxy port for request interception
+            active_tests: Run lightweight active reflected XSS tests (safe GET-only)
             
         Returns:
             Browser inspection results with security analysis
@@ -5186,7 +5187,8 @@ def browser_agent_inspect(url: str, headless: bool = True, wait_time: int = 5,
             "headless": headless,
             "wait_time": wait_time,
             "action": action,
-            "proxy_port": proxy_port
+            "proxy_port": proxy_port,
+            "active_tests": active_tests
         }
         
         logger.info(f"{HexStrikeColors.CRIMSON}🌐 Starting Browser Agent {action}: {url}{HexStrikeColors.RESET}")
@@ -5210,6 +5212,43 @@ def browser_agent_inspect(url: str, headless: bool = True, wait_time: int = 5,
         
         return result
 
+    # ---------------- Additional HTTP Framework Tools (sync with server) ----------------
+    @mcp.tool()
+    def http_set_rules(rules: list) -> Dict[str, Any]:
+        """Set match/replace rules used to rewrite parts of URL/query/headers/body before sending.
+        Rule format: {'where':'url|query|headers|body','pattern':'regex','replacement':'string'}"""
+        payload = {"action": "set_rules", "rules": rules}
+        return hexstrike_client.safe_post("api/tools/http-framework", payload)
+
+    @mcp.tool()
+    def http_set_scope(host: str, include_subdomains: bool = True) -> Dict[str, Any]:
+        """Define in-scope host (and optionally subdomains) so out-of-scope requests are skipped."""
+        payload = {"action": "set_scope", "host": host, "include_subdomains": include_subdomains}
+        return hexstrike_client.safe_post("api/tools/http-framework", payload)
+
+    @mcp.tool()
+    def http_repeater(request_spec: dict) -> Dict[str, Any]:
+        """Send a crafted request (Burp Repeater equivalent). request_spec keys: url, method, headers, cookies, data."""
+        payload = {"action": "repeater", "request": request_spec}
+        return hexstrike_client.safe_post("api/tools/http-framework", payload)
+
+    @mcp.tool()
+    def http_intruder(url: str, method: str = "GET", location: str = "query", params: list = None,
+                      payloads: list = None, base_data: dict = None, max_requests: int = 100) -> Dict[str, Any]:
+        """Simple Intruder (sniper) fuzzing. Iterates payloads over each param individually.
+        location: query|body|headers|cookie."""
+        payload = {
+            "action": "intruder",
+            "url": url,
+            "method": method,
+            "location": location,
+            "params": params or [],
+            "payloads": payloads or [],
+            "base_data": base_data or {},
+            "max_requests": max_requests
+        }
+        return hexstrike_client.safe_post("api/tools/http-framework", payload)
+
     @mcp.tool()
     def burpsuite_alternative_scan(target: str, scan_type: str = "comprehensive", 
                                   headless: bool = True, max_depth: int = 3, 
@@ -5366,15 +5405,15 @@ def main():
     
     # Print enhanced startup banner
     banner = f"""
-{HexStrikeColors.NEON_BLUE}{HexStrikeColors.BOLD}╔══════════════════════════════════════════════════════════════════════════════╗
-║  {HexStrikeColors.FIRE_RED}🔥 HexStrike AI MCP Client v6.0 - Enhanced Visual Edition{HexStrikeColors.NEON_BLUE}              ║
+{HexStrikeColors.CRIMSON}{HexStrikeColors.BOLD}╔══════════════════════════════════════════════════════════════════════════════╗
+║  {HexStrikeColors.HACKER_RED}🔥 HexStrike AI MCP Client v6.0 - Blood-Red Offensive Core{HexStrikeColors.CRIMSON}         ║
 ╠═════════════════════════════════════════════════════════════════
```

**File**: `hexstrike_server.py` (modified, +434/-126)
```diff
@@ -126,6 +126,10 @@ class ModernVisualEngine:
         'BURGUNDY': '\033[38;5;52m',
         'SCARLET': '\033[38;5;197m',
         'RUBY': '\033[38;5;161m',
+    # Unified theme primary/secondary (used going forward instead of legacy blue/green accents)
+    'PRIMARY_BORDER': '\033[38;5;160m',  # CRIMSON
+    'ACCENT_LINE': '\033[38;5;196m',      # HACKER_RED
+    'ACCENT_GRADIENT': '\033[38;5;124m',  # BLOOD_RED (for subtle alternation)
         # Highlighting colors
         'HIGHLIGHT_RED': '\033[48;5;196m\033[38;5;15m',  # Red background, white text
         'HIGHLIGHT_YELLOW': '\033[48;5;226m\033[38;5;16m',  # Yellow background, black text
@@ -169,24 +173,31 @@ class ModernVisualEngine:
     @staticmethod
     def create_banner() -> str:
         """Create the enhanced HexStrike banner"""
+        # Build a blood-red themed border using primary/gradient alternation
+        border_color = ModernVisualEngine.COLORS['PRIMARY_BORDER']
+        accent = ModernVisualEngine.COLORS['ACCENT_LINE']
+        gradient = ModernVisualEngine.COLORS['ACCENT_GRADIENT']
+        RESET = ModernVisualEngine.COLORS['RESET']
+        BOLD = ModernVisualEngine.COLORS['BOLD']
+        title_block = f"{accent}{BOLD}"
         banner = f"""
-{ModernVisualEngine.COLORS['MATRIX_GREEN']}{ModernVisualEngine.COLORS['BOLD']}
+{title_block}
 ██╗  ██╗███████╗██╗  ██╗███████╗████████╗██████╗ ██╗██╗  ██╗███████╗
 ██║  ██║██╔════╝╚██╗██╔╝██╔════╝╚══██╔══╝██╔══██╗██║██║ ██╔╝██╔════╝
 ███████║█████╗   ╚███╔╝ ███████╗   ██║   ██████╔╝██║█████╔╝ █████╗  
 ██╔══██║██╔══╝   ██╔██╗ ╚════██║   ██║   ██╔══██╗██║██╔═██╗ ██╔══╝  
 ██║  ██║███████╗██╔╝ ██╗███████║   ██║   ██║  ██║██║██║  ██╗███████╗
 ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝╚═╝  ╚═╝╚══════╝
-{ModernVisualEngine.COLORS['RESET']}
-{ModernVisualEngine.COLORS['NEON_BLUE']}┌─────────────────────────────────────────────────────────────────────┐
-│  {ModernVisualEngine.COLORS['BRIGHT_WHITE']}🚀 HexStrike AI (www.hexstrike.com) - Advanced Penetration Testing Framework{ModernVisualEngine.COLORS['NEON_BLUE']}      │
-│  {ModernVisualEngine.COLORS['CYBER_ORANGE']}⚡ Enhanced with AI-Powered Intelligence & Automation{ModernVisualEngine.COLORS['NEON_BLUE']}       │
-│  {ModernVisualEngine.COLORS['ELECTRIC_PURPLE']}🎯 Bug Bounty | CTF | Red Team | Security Research{ModernVisualEngine.COLORS['NEON_BLUE']}           │
-└─────────────────────────────────────────────────────────────────────┘{ModernVisualEngine.COLORS['RESET']}
+{RESET}
+{border_color}┌─────────────────────────────────────────────────────────────────────┐
+│  {ModernVisualEngine.COLORS['BRIGHT_WHITE']}🚀 HexStrike AI - Blood-Red Offensive Intelligence Core{border_color}        │
+│  {accent}⚡ AI-Automated Recon | Exploitation | Analysis Pipeline{border_color}          │
+│  {gradient}🎯 Bug Bounty | CTF | Red Team | Zero-Day Research{border_color}              │
+└─────────────────────────────────────────────────────────────────────┘{RESET}
 
 {ModernVisualEngine.COLORS['TERMINAL_GRAY']}[INFO] Server starting on {API_HOST}:{API_PORT}
-[INFO] Enhanced with 150+ security tools and AI intelligence
-[INFO] Ready for advanced penetration testing operations{ModernVisualEngine.COLORS['RESET']}
+[INFO] 150+ integrated modules | Adaptive AI decision engine active
+[INFO] Blood-red theme engaged – unified offensive operations UI{RESET}
 """
         return banner
     
@@ -201,9 +212,11 @@ def create_progress_bar(current: int, total: int, width: int = 50, tool: str = "
         filled = int(width * percentage / 100)
         bar = '█' * filled + '░' * (width - filled)
         
+        border = ModernVisualEngine.COLORS['PRIMARY_BORDER']
+        fill_col = ModernVisualEngine.COLORS['ACCENT_LINE']
         return f"""
-{ModernVisualEngine.COLORS['NEON_BLUE']}┌─ {tool} ─{'─' * (width - len(tool) - 4)}┐
-│ {ModernVisualEngine.COLORS['MATRIX_GREEN']}{bar}{ModernVisualEngine.COLORS['NEON_BLUE']} │ {percentage:6.1f}%
+{border}┌─ {tool} ─{'─' * (width - len(tool) - 4)}┐
+│ {fill_col}{bar}{border} │ {percentage:6.1f}%
 └─{'─' * (width + 10)}┘{ModernVisualEngine.COLORS['RESET']}"""
 
     @staticmethod
@@ -222,23 +235,23 @@ def render_progress_bar(progress: float, width: int = 40, style: str = 'cyber',
         if style == 'cyber':
             filled_char = '█'
             empty_char = '░'
-            bar_color = ModernVisualEngine.COLORS['MATRIX_GREEN']
-            progress_color = ModernVisualEngine.COLORS['NEON_BLUE']
+            bar_color = ModernVisualEngine.COLORS['ACCENT_LINE']
+            progress_color = ModernVisualEngine.COLORS['PRIMARY_BORDER']
         elif style == 'matrix':
             filled_char = '▓'
             empty_char = '▒'
-            bar_color = ModernVisualEngine.COLORS['MATRIX_GREEN']
-            progress_color = ModernVisualEngine.COLORS['ELECTRIC_PURPLE']
+            bar_color = ModernVisualEngine.COLORS['ACCENT_LINE']
+            progress_color = ModernVisualEngine.COLORS['ACCENT_GRADIENT']
        
```

#### Recent Merged Pull Requests:
- **PR #239** (closed): Make server bind host configurable and improve MCP client defaults (@BoredomApps)
- **PR #236** (closed): feat: BrowserPod Security GUI — sandboxed, gated front-end for the HexStrike API (@Zero2oneZ)
- **PR #231** (closed): contrib: self-contained Docker image (MCP-default, optional OpenAPI/VPN) (@RobertCoop)
- **PR #218** (closed): Polish docs and comments in hexstrike-ai (#211) (@bglglzd)
- **PR #217** (closed): Fix typo in hexstrike-ai (#211) (@bglglzd)
- **PR #201** (closed): feat(monetization): add agentic monetization to HexStrike AI MCP server (@roblambert9)
- **PR #197** (closed): fix: replace 12 bare except with except Exception (@mshzy)
- **PR #196** (closed): Migrate dependency management from pip/requirements.txt to uv (@liusc45)

---

## 3. Empirical Evidence & Compliance Certification
- **Evidence Provenance**: Fetched directly from verified official GitHub REST API.
- **Zero Disk Footprint**: 0 bytes of unnecessary repository bloat stored locally.
- **TOS & Free-Tier Adherence**: Request pace complied with public API guidelines without fee, penalty, or unauthorized scraping.

---

## 4. Promotion & Integration Status
- **Status**: HARVESTED_DEEP_FORENSIC
- **Master Brain Sync**: Auto-committed to local/remote Master Brain repository.
